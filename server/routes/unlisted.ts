/**
 * Unlisted Marketplace API Routes
 * 
 * Handles all routes related to unlisted share trading marketplace including:
 * - Company management
 * - Credhive integration for financial data
 * - Buy/Sell listings and deal matching
 * - Financials and ratios tracking
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { apiResponse } from '../utils/responses';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { credhiveService } from '../services/credhive-service';
import { credhiveAdapter } from '../services/vendor-adapters/credhive.adapter';
import { enrichUnlistedCompanyWithMCAData } from '../services/mca-enrichment-service';
import { PriceSuggestionService } from '../services/price-suggestion';
import { priceAggregationService } from '../services/price-aggregation';
import { moneyControlReconciliation } from '../services/moneycontrol-reconciliation';
import { mcaService } from '../services/mca-service';
import { unifiedCompanyDataService } from '../services/unified-company-data-service';
import { valuationService } from '../services/valuation-service';
import { unlistedPricingWorkflowService } from '../services/unlisted-pricing-workflow';
import { unlistedEligibilityService } from '../services/unlisted-eligibility';
import { unlistedRiskDisclosureService, saveRiskAcknowledgment, requireRiskDisclosure } from '../services/unlisted-risk-disclosures';
import {
  insertUnlistedCompanySchema,
  insertUnlistedPriceHistorySchema,
  insertSellListingSchema,
  insertBuyRequestSchema,
  insertUnlistedDealSchema,
  insertUnlistedCartSchema,
  sellListings,
  buyRequests,
  unlistedDeals,
  unlistedCart,
  userProfiles,
  type UnlistedCompany,
  type SellListing,
  type BuyRequest,
  type UnlistedCartItem,
} from '@shared/schema';
import { requireLevel2 } from '../middleware/kyc-level-gate';
import { requireAuth } from '../middleware/roleMiddleware';
import { orderAuditHook } from '../services/order-audit-hook';
import { dataEnrichmentService } from '../services/data-enrichment-service';
import { unlistedValuationGovernanceService } from '../services/unlisted-valuation-governance-service';
import { unlistedFinancialEnrichmentService } from '../services/unlisted-financial-enrichment-service';
import {
  insertUnlistedEquityValuationHistorySchema,
  clientUnlistedDisclosureLog,
  unlistedEquityValuationHistory,
} from '@shared/schema';

// Admin middleware for unlisted marketplace admin routes
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return apiResponse.unauthorized(res, 'Authentication required');
  }

  const userRoles = (req.user as any)?.roles || [];
  if (!userRoles.includes('admin') && !userRoles.includes('superadmin')) {
    return apiResponse.forbidden(res, 'Admin access required');
  }

  next();
};

const router = Router();

// ===================================================================
// COMPANY MANAGEMENT ROUTES
// ===================================================================

/**
 * GET /api/unlisted/companies
 * List only STORE-PUBLISHED unlisted companies (public - no KYC required for browsing)
 * Only returns companies where storeProductId is not null (published to store)
 */
router.get('/companies', async (req: Request, res: Response) => {
  try {
    const { status, sector } = req.query;
    
    const filters: { status?: string; sector?: string; storePublishedOnly?: boolean } = {};
    if (status && typeof status === 'string') filters.status = status;
    if (sector && typeof sector === 'string') filters.sector = sector;
    
    // Only return active companies for public browsing
    if (!filters.status) {
      filters.status = 'active';
    }
    
    // Client browse should ONLY see store-published companies
    filters.storePublishedOnly = true;
    
    const companies = await storage.getAllUnlistedCompanies(filters);
    return apiResponse.success(res, companies);
  } catch (error: any) {
    console.error('Error fetching unlisted companies:', error);
    return apiResponse.serverError(res, 'Failed to fetch companies');
  }
});

/**
 * GET /api/unlisted/companies/:id
 * Get detailed information about a specific company (public - no KYC required for browsing)
 * Trading and financials still require Level 2 KYC as per SEBI regulations
 */
router.get('/companies/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    return apiResponse.success(res, company);
  } catch (error: any) {
    console.error('Error fetching company:', error);
    return apiResponse.serverError(res, 'Failed to fetch company details');
  }
});

/**
 * GET /api/unlisted/companies/:id/data-quality
 * Get data quality information for a company (public)
 * Returns sources used, fallback status, and quality score
 */
router.get('/companies/:id/data-quality', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const unifiedData = await unifiedCompanyDataService.getCompanyData(id);
    
    if (!unifiedData) {
      return apiResponse.success(res, {
        fallbackUsed: false,
        fallbackReason: null,
        warnings: ['No data available'],
        primarySourceFailed: true,
        sourcesUsed: [],
        overallScore: 0,
      });
    }
    
    return apiResponse.success(res, unifiedData.dataQuality);
  } catch (error: any) {
    console.error('Error fetching data quality:', error);
    return apiResponse.serverError(res, 'Failed to fetch data quality');
  }
});

/**
 * POST /api/unlisted/companies
 * Create a new unlisted company (Admin only - no investor KYC required)
 */
router.post('/companies', requireAuth, async (req: Request, res: Response) => {
  try {
    // Admin-only operation
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const validatedData = insertUnlistedCompanySchema.parse(req.body);
    
    // Check if company with same CIN already exists
    if (validatedData.cin) {
      const existing = await storage.getUnlistedCompanyByCIN(validatedData.cin);
      if (existing) {
        return apiResponse.badRequest(res, 'Company with this CIN already exists');
      }
    }
    
    const company = await storage.createUnlistedCompany({
      ...validatedData,
      createdBy: req.user.id,
    });
    
    return apiResponse.created(res, company, 'Company created successfully');
  } catch (error: any) {
    console.error('Error creating company:', error);
    
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid input data', error.errors);
    }
    
    return apiResponse.serverError(res, 'Failed to create company');
  }
});

/**
 * PATCH /api/unlisted/companies/:id
 * Update company information (admin only)
 */
router.patch('/companies/:id', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    
    // Verify company exists
    const existing = await storage.getUnlistedCompanyById(id);
    if (!existing) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const validatedData = insertUnlistedCompanySchema.partial().parse(req.body);
    const updated = await storage.updateUnlistedCompany(id, validatedData);
    
    return apiResponse.success(res, updated, 'Company updated successfully');
  } catch (error: any) {
    console.error('Error updating company:', error);
    
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid input data', error.errors);
    }
    
    return apiResponse.serverError(res, 'Failed to update company');
  }
});

/**
 * DELETE /api/unlisted/companies/:id
 * Delete a company and all related data (admin only)
 */
router.delete('/companies/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    
    const existing = await storage.getUnlistedCompanyById(id);
    if (!existing) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    await storage.deleteUnlistedCompany(id);
    
    return apiResponse.success(res, { deleted: true }, `Company "${existing.name}" deleted successfully`);
  } catch (error: any) {
    console.error('Error deleting company:', error);
    return apiResponse.serverError(res, 'Failed to delete company');
  }
});

// ===================================================================
// CREDHIVE INTEGRATION ROUTES
// ===================================================================

/**
 * GET /api/unlisted/credhive/status
 * Check Credhive API health and configuration status
 */
router.get('/credhive/status', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    const available = credhiveService.isAvailable();
    let healthy = false;
    let healthMessage = 'API key not configured';
    if (available) {
      try {
        const test = await credhiveService.searchCompanies('test');
        healthy = test.success;
        healthMessage = test.success ? 'Healthy' : (test.error || 'API returned error');
      } catch (e: any) {
        healthMessage = e.message;
      }
    }
    return apiResponse.success(res, {
      provider: 'credhive',
      configured: available,
      healthy,
      healthMessage,
    });
  } catch (error: any) {
    console.error('Error checking Credhive status:', error);
    return apiResponse.serverError(res, 'Failed to check Credhive status');
  }
});

/**
 * GET /api/unlisted/credhive/search
 * Search for companies via Credhive
 */
router.get('/credhive/search', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return apiResponse.badRequest(res, 'Query parameter "q" is required');
    }
    if (q.length < 3) {
      return apiResponse.badRequest(res, 'Query must be at least 3 characters long');
    }
    const results = await credhiveService.searchCompanies(q);
    return apiResponse.success(res, results.data ?? []);
  } catch (error: any) {
    console.error('Error searching Credhive:', error);
    return apiResponse.serverError(res, error.message || 'Failed to search companies');
  }
});

/**
 * POST /api/unlisted/credhive/sync/:companyId
 * Sync company data from Credhive (Admin only)
 */
router.post('/credhive/sync/:companyId', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyId } = req.params;
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const cin = company.cin;
    if (!cin) {
      return apiResponse.badRequest(res, 'Company does not have a CIN — required for Credhive sync');
    }
    
    // Fetch company profile from Credhive
    const profileResp = await credhiveService.getCompanyProfile(cin);
    if (!profileResp.success || !profileResp.data) {
      return apiResponse.notFound(res, 'Company not found on Credhive');
    }
    const credhiveDetails = profileResp.data;
    
    // Fetch financials and directors
    const financialsResp = await credhiveService.getFinancials(cin);
    const financialsData = financialsResp.data ?? [];
    
    // Compute basic ratios from financials using the adapter
    const ratiosData = await credhiveAdapter.fetchRatios(cin, 5);
    
    // Auto-populate ISIN from Credhive if available
    let isinResult: { isin: string | null; source: string; matchScore: number } = { 
      isin: credhiveDetails.isin || company.isin || null, 
      source: credhiveDetails.isin ? 'credhive' : (company.isin ? 'existing' : 'none'),
      matchScore: 100 
    };
    
    // Try MoneyControl first (better for unlisted equity shares)
    if (!isinResult.isin) {
      try {
        const { moneyControlScraper } = await import('../services/moneycontrol-scraper');
        const mcResult = await moneyControlScraper.searchISINByCompanyName(company.name);
        
        if (mcResult.isin && mcResult.matchScore >= 60) {
          isinResult = {
            isin: mcResult.isin,
            source: 'moneycontrol',
            matchScore: mcResult.matchScore
          };
          console.log(`[Unlisted Sync] Auto-populated ISIN ${mcResult.isin} from MoneyControl for ${company.name} (${mcResult.matchScore.toFixed(1)}% match)`);
          
          // Also save the price if available
          if (mcResult.price) {
            try {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              await storage.upsertPriceHistory({
                companyId: company.id,
                date: today,
                price: mcResult.price.toString(),
                sourceType: 'MONEYCONTROL',
                notes: `Auto-imported during sync. Matched: ${mcResult.matchedName}`,
              });
              console.log(`[Unlisted Sync] Also saved price ₹${mcResult.price} from MoneyControl`);
            } catch (priceErr) {
              console.warn('[Unlisted Sync] Failed to save MoneyControl price:', priceErr);
            }
          }
        } else {
          console.log(`[Unlisted Sync] MoneyControl: No good match for "${company.name}" (best: ${mcResult.matchScore.toFixed(1)}%)`);
        }
      } catch (mcError) {
        console.warn('[Unlisted Sync] Failed to fetch ISIN from MoneyControl:', mcError);
      }
    }
    
    // Fallback to NSDL if MoneyControl didn't find ISIN
    if (!isinResult.isin) {
      try {
        const { nsdlISINService } = await import('../services/nsdl-isin-service');
        // Search all security types for unlisted companies (they might be equity, preference, etc.)
        const nsdlResults = await nsdlISINService.searchByCompanyName(company.name, { 
          securityType: 'all', 
          limit: 10 
        });
        
        console.log(`[Unlisted Sync] NSDL search for "${company.name}" returned ${nsdlResults.length} results`);
        if (nsdlResults.length > 0) {
          console.log(`[Unlisted Sync] Best match: ${nsdlResults[0].issuerName} (${nsdlResults[0].matchScore}% match) - ISIN: ${nsdlResults[0].isin} - Type: ${nsdlResults[0].securityType}`);
        }
        
        // Use highest confidence match (must be at least 60% match for unlisted shares)
        // Prioritize equity type if available with good match
        const equityMatch = nsdlResults.find(r => r.securityType === 'equity' && r.matchScore >= 60);
        const bestMatch = equityMatch || (nsdlResults.length > 0 && nsdlResults[0].matchScore >= 60 ? nsdlResults[0] : null);
        
        if (bestMatch) {
          isinResult = {
            isin: bestMatch.isin,
            source: 'nsdl',
            matchScore: bestMatch.matchScore
          };
          console.log(`[Unlisted Sync] Auto-populated ISIN ${bestMatch.isin} from NSDL for ${company.name} (${bestMatch.matchScore}% match, type: ${bestMatch.securityType})`);
        } else if (nsdlResults.length > 0) {
          console.log(`[Unlisted Sync] NSDL: Best match score (${nsdlResults[0].matchScore}%) below 60% threshold, skipping`);
        }
      } catch (nsdlError) {
        console.warn('[Unlisted Sync] Failed to fetch ISIN from NSDL:', nsdlError);
        // Continue without ISIN - not a critical error
      }
    }
    
    // Save financials with upsert logic
    let financialsCount = 0;
    let financialsUpdated = 0;
    for (const finData of financialsData) {
      const dbFinancials = {
        companyId,
        financialYear: finData.financial_year,
        revenue: finData.revenue?.toString() ?? null,
        ebitda: finData.ebitda?.toString() ?? null,
        ebit: finData.ebit?.toString() ?? null,
        pbt: finData.pbt?.toString() ?? null,
        pat: finData.pat?.toString() ?? null,
        netProfit: finData.net_profit?.toString() ?? null,
        totalAssets: finData.total_assets?.toString() ?? null,
        totalLiabilities: finData.total_liabilities?.toString() ?? null,
        networth: finData.networth?.toString() ?? null,
        shareCapital: finData.share_capital?.toString() ?? null,
        reserves: finData.reserves?.toString() ?? null,
        totalDebt: finData.total_debt?.toString() ?? null,
        longTermDebt: finData.long_term_debt?.toString() ?? null,
        shortTermDebt: finData.short_term_debt?.toString() ?? null,
        operatingCashFlow: finData.operating_cash_flow?.toString() ?? null,
        investingCashFlow: finData.investing_cash_flow?.toString() ?? null,
        financingCashFlow: finData.financing_cash_flow?.toString() ?? null,
        freeCashFlow: finData.free_cash_flow?.toString() ?? null,
        dataSource: 'credhive',
      };
      const existing = await storage.getCompanyFinancialsByYear(companyId, finData.financial_year);
      if (existing) {
        await storage.updateCompanyFinancials(existing.id, dbFinancials);
        financialsUpdated++;
      } else {
        await storage.createCompanyFinancials(dbFinancials);
        financialsCount++;
      }
    }
    
    // Save computed ratios with upsert logic
    let ratiosCount = 0;
    let ratiosUpdated = 0;
    for (const ratioData of ratiosData) {
      const dbRatios = {
        companyId,
        financialYear: ratioData.financialYear,
        roe: ratioData.roe?.toString() ?? null,
        roce: ratioData.roce?.toString() ?? null,
        debtEquity: ratioData.debtEquity?.toString() ?? null,
        currentRatio: ratioData.currentRatio?.toString() ?? null,
        revenueGrowth: ratioData.revenueGrowth?.toString() ?? null,
        profitGrowth: ratioData.profitGrowth?.toString() ?? null,
        marginEbitda: ratioData.marginEbitda?.toString() ?? null,
        marginPat: ratioData.marginPat?.toString() ?? null,
        peRatio: ratioData.peRatio?.toString() ?? null,
        dataSource: 'credhive',
      };
      const existing = await storage.getCompanyRatiosByYear(companyId, ratioData.financialYear);
      if (existing) {
        await storage.updateCompanyRatios(existing.id, dbRatios);
        ratiosUpdated++;
      } else {
        await storage.createCompanyRatios(dbRatios);
        ratiosCount++;
      }
    }
    
    // Update company metadata with Credhive profile data
    await storage.updateUnlistedCompany(companyId, {
      lastSyncedAt: new Date(),
      sector: credhiveDetails.sector || company.sector,
      industry: credhiveDetails.industry || company.industry,
      rocState: credhiveDetails.roc_state || company.rocState,
      incorporationDate: credhiveDetails.date_of_incorporation || company.incorporationDate,
      paidUpCapital: credhiveDetails.paid_up_capital?.toString() || company.paidUpCapital,
      authorizedCapital: credhiveDetails.authorized_capital?.toString() || company.authorizedCapital,
      faceValue: credhiveDetails.face_value?.toString() || company.faceValue,
      totalShares: credhiveDetails.total_shares || company.totalShares,
      website: credhiveDetails.website || company.website,
      description: credhiveDetails.description || company.description,
      isin: isinResult.isin || company.isin,
    });
    
    // Create sync log (stored in probe42_sync_log table for historical continuity)
    const totalNew = financialsCount + ratiosCount;
    const totalUpdated = financialsUpdated + ratiosUpdated;
    await storage.createProbe42SyncLog({
      companyId,
      probe42CompanyId: cin,
      syncType: 'full',
      lastSyncAt: new Date(),
      status: 'success',
      recordsSynced: totalNew + totalUpdated,
      recordsFailed: 0,
    });
    
    const isAutoPopulated = isinResult.source === 'moneycontrol' || isinResult.source === 'nsdl';
    const sourceLabel = isinResult.source === 'moneycontrol' ? 'MoneyControl' : 
                        isinResult.source === 'nsdl' ? 'NSDL' : null;
    
    return apiResponse.success(res, {
      success: true,
      financials: { created: financialsCount, updated: financialsUpdated },
      ratios: { created: ratiosCount, updated: ratiosUpdated },
      companyUpdated: true,
      isin: {
        value: isinResult.isin,
        source: isinResult.source,
        matchScore: isinResult.matchScore,
        autoPopulated: isAutoPopulated
      },
      message: `Synced ${totalNew} new records, updated ${totalUpdated} existing records${isAutoPopulated && isinResult.isin ? `. ISIN auto-populated from ${sourceLabel} (${Math.round(isinResult.matchScore)}% match)` : ''}`,
    });
  } catch (error: any) {
    console.error('Error syncing from Credhive:', error);
    
    const { companyId } = req.params;
    const company = await storage.getUnlistedCompanyById(companyId);
    if (company?.cin) {
      await storage.createProbe42SyncLog({
        companyId,
        probe42CompanyId: company.cin,
        syncType: 'full',
        lastSyncAt: new Date(),
        status: 'failed',
        recordsSynced: 0,
        recordsFailed: 0,
        errorMessage: error.message,
      });
    }
    
    return apiResponse.serverError(res, error.message || 'Failed to sync company data');
  }
});

/**
 * POST /api/unlisted/credhive/sync-all
 * Bulk sync all companies with Credhive (admin only)
 */
router.post('/credhive/sync-all', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { onlyUnsynced } = req.body;
    const allCompanies = await storage.getAllUnlistedCompanies({});
    const companies = onlyUnsynced
      ? allCompanies.filter(c => !c.lastSyncedAt && !!c.cin)
      : allCompanies.filter(c => !!c.cin);
    
    if (companies.length === 0) {
      return apiResponse.success(res, { success: true, message: 'No companies with CIN to sync', results: [] });
    }
    
    console.log(`[Bulk Sync] Starting Credhive sync for ${companies.length} companies...`);
    
    const results: Array<{
      companyId: string;
      companyName: string;
      success: boolean;
      credhiveLinked: boolean;
      message: string;
    }> = [];
    
    for (const company of companies) {
      try {
        console.log(`[Bulk Sync] Processing: ${company.name} (${company.cin})`);
        
        const profileResp = await credhiveService.getCompanyProfile(company.cin!);
        if (!profileResp.success || !profileResp.data) {
          results.push({ companyId: company.id, companyName: company.name, success: false, credhiveLinked: false, message: 'Not found on Credhive' });
          continue;
        }
        const credhiveDetails = profileResp.data;
        
        const financialsResp = await credhiveService.getFinancials(company.cin!);
        const financialsData = financialsResp.data ?? [];
        const ratiosData = await credhiveAdapter.fetchRatios(company.cin!, 5);
        
        // Auto-populate ISIN
        let isin = credhiveDetails.isin || company.isin;
        if (!isin) {
          try {
            const { moneyControlScraper } = await import('../services/moneycontrol-scraper');
            const mcResult = await moneyControlScraper.searchISINByCompanyName(company.name);
            if (mcResult.isin && mcResult.matchScore >= 60) {
              isin = mcResult.isin;
              console.log(`[Bulk Sync] Auto-populated ISIN ${isin} from MoneyControl for ${company.name}`);
              if (mcResult.price) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                await storage.upsertPriceHistory({ companyId: company.id, date: today, price: mcResult.price.toString(), sourceType: 'MONEYCONTROL', notes: 'Auto-imported during bulk sync' });
              }
            }
          } catch (e) {
            console.warn(`[Bulk Sync] MoneyControl ISIN lookup failed for ${company.name}`);
          }
        }
        
        // Save financials
        for (const finData of financialsData) {
          const dbFin = { companyId: company.id, financialYear: finData.financial_year, revenue: finData.revenue?.toString() ?? null, ebitda: finData.ebitda?.toString() ?? null, ebit: finData.ebit?.toString() ?? null, pbt: finData.pbt?.toString() ?? null, pat: finData.pat?.toString() ?? null, netProfit: finData.net_profit?.toString() ?? null, totalAssets: finData.total_assets?.toString() ?? null, totalLiabilities: finData.total_liabilities?.toString() ?? null, networth: finData.networth?.toString() ?? null, totalDebt: finData.total_debt?.toString() ?? null, operatingCashFlow: finData.operating_cash_flow?.toString() ?? null, dataSource: 'credhive' };
          const existing = await storage.getCompanyFinancialsByYear(company.id, finData.financial_year);
          existing ? await storage.updateCompanyFinancials(existing.id, dbFin) : await storage.createCompanyFinancials(dbFin);
        }
        
        // Save ratios
        for (const ratioData of ratiosData) {
          const dbRatio = { companyId: company.id, financialYear: ratioData.financialYear, roe: ratioData.roe?.toString() ?? null, roce: ratioData.roce?.toString() ?? null, debtEquity: ratioData.debtEquity?.toString() ?? null, marginEbitda: ratioData.marginEbitda?.toString() ?? null, marginPat: ratioData.marginPat?.toString() ?? null, revenueGrowth: ratioData.revenueGrowth?.toString() ?? null, profitGrowth: ratioData.profitGrowth?.toString() ?? null, dataSource: 'credhive' };
          const existing = await storage.getCompanyRatiosByYear(company.id, ratioData.financialYear);
          existing ? await storage.updateCompanyRatios(existing.id, dbRatio) : await storage.createCompanyRatios(dbRatio);
        }
        
        // Update metadata
        await storage.updateUnlistedCompany(company.id, {
          lastSyncedAt: new Date(),
          sector: credhiveDetails.sector || company.sector,
          industry: credhiveDetails.industry || company.industry,
          rocState: credhiveDetails.roc_state || company.rocState,
          incorporationDate: credhiveDetails.date_of_incorporation || company.incorporationDate,
          paidUpCapital: credhiveDetails.paid_up_capital?.toString() || company.paidUpCapital,
          authorizedCapital: credhiveDetails.authorized_capital?.toString() || company.authorizedCapital,
          faceValue: credhiveDetails.face_value?.toString() || company.faceValue,
          totalShares: credhiveDetails.total_shares || company.totalShares,
          website: credhiveDetails.website || company.website,
          description: credhiveDetails.description || company.description,
          isin: isin || company.isin,
        });
        
        results.push({ companyId: company.id, companyName: company.name, success: true, credhiveLinked: true, message: `Synced ${financialsData.length} financials, ${ratiosData.length} ratios` });
        console.log(`[Bulk Sync] Successfully synced ${company.name}`);
        
      } catch (companyError: any) {
        console.error(`[Bulk Sync] Error syncing ${company.name}:`, companyError.message);
        results.push({ companyId: company.id, companyName: company.name, success: false, credhiveLinked: false, message: companyError.message || 'Sync failed' });
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;
    console.log(`[Bulk Sync] Completed: ${successCount} success, ${failedCount} failed`);
    
    return apiResponse.success(res, {
      success: true,
      message: `Synced ${successCount} companies successfully, ${failedCount} failed`,
      totalProcessed: results.length,
      successCount,
      failedCount,
      results
    });
  } catch (error: any) {
    console.error('Error in bulk Credhive sync:', error);
    return apiResponse.serverError(res, error.message || 'Bulk sync failed');
  }
});

// ===================================================================
// FINANCIALS & RATIOS ROUTES
// ===================================================================

/**
 * GET /api/unlisted/companies/:id/financials
 * Get company financial statements
 * SEBI Compliance: Allow authenticated users to view for due diligence
 * KYC gates apply only at order placement, not information access
 */
router.get('/companies/:id/financials', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verify company exists
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const financials = await storage.getCompanyFinancials(id);
    return apiResponse.success(res, financials);
  } catch (error: any) {
    console.error('Error fetching financials:', error);
    return apiResponse.serverError(res, 'Failed to fetch financial data');
  }
});

/**
 * GET /api/unlisted/companies/:id/ratios
 * Get company financial ratios
 * SEBI Compliance: Allow authenticated users to view for due diligence
 */
router.get('/companies/:id/ratios', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verify company exists
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const ratios = await storage.getCompanyRatios(id);
    return apiResponse.success(res, ratios);
  } catch (error: any) {
    console.error('Error fetching ratios:', error);
    return apiResponse.serverError(res, 'Failed to fetch ratio data');
  }
});

/**
 * GET /api/unlisted/companies/:id/price-history
 * Get price history for a company
 * SEBI Compliance: Allow authenticated users to view for due diligence
 */
router.get('/companies/:id/price-history', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit } = req.query;
    
    // Verify company exists
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const limitNum = limit ? parseInt(limit as string, 10) : undefined;
    const priceHistory = await storage.getPriceHistory(id, limitNum);
    
    return apiResponse.success(res, priceHistory);
  } catch (error: any) {
    console.error('Error fetching price history:', error);
    return apiResponse.serverError(res, 'Failed to fetch price history');
  }
});

/**
 * POST /api/unlisted/companies/:id/price-history
 * Admin: Add price history entry for a company (Admin only - no investor KYC required)
 * Since there's no public API for unlisted stock prices, this allows manual entry
 */
router.post('/companies/:id/price-history', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const validatedData = insertUnlistedPriceHistorySchema.parse({
      ...req.body,
      companyId: id,
    });
    
    const priceHistory = await storage.createPriceHistory(validatedData);
    return apiResponse.created(res, priceHistory, 'Price history entry added successfully');
  } catch (error: any) {
    console.error('Error adding price history:', error);
    
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid price data', error.errors);
    }
    
    return apiResponse.serverError(res, 'Failed to add price history');
  }
});

/**
 * POST /api/unlisted/companies/:id/price-history/bulk
 * Admin: Bulk upload price history from CSV/array data (Admin only - no investor KYC required)
 */
router.post('/companies/:id/price-history/bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    const { prices } = req.body;
    
    if (!Array.isArray(prices) || prices.length === 0) {
      return apiResponse.badRequest(res, 'Prices array is required');
    }
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    
    for (const priceEntry of prices) {
      try {
        const validatedData = insertUnlistedPriceHistorySchema.parse({
          ...priceEntry,
          companyId: id,
        });
        
        await storage.upsertPriceHistory(validatedData);
        successCount++;
      } catch (err: any) {
        failedCount++;
        errors.push(`Row with date ${priceEntry.date}: ${err.message}`);
      }
    }
    
    return apiResponse.success(res, {
      success: true,
      imported: successCount,
      failed: failedCount,
      errors: errors.slice(0, 10),
      message: `Imported ${successCount} price entries, ${failedCount} failed`,
    });
  } catch (error: any) {
    console.error('Error bulk importing price history:', error);
    return apiResponse.serverError(res, 'Failed to import price history');
  }
});

// ===================================================================
// MONEYCONTROL PRICE SYNC
// ===================================================================

/**
 * GET /api/unlisted/moneycontrol/preview
 * Preview what companies would be matched and imported from MoneyControl (Admin only)
 */
router.get('/moneycontrol/preview', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { moneyControlScraper } = await import('../services/moneycontrol-scraper');
    const result = await moneyControlScraper.previewImport();
    
    return apiResponse.success(res, result);
  } catch (error: any) {
    console.error('Error previewing MoneyControl import:', error);
    return apiResponse.serverError(res, `Failed to preview MoneyControl data: ${error.message}`);
  }
});

/**
 * POST /api/unlisted/moneycontrol/import
 * Execute import of prices from MoneyControl (Admin only)
 */
router.post('/moneycontrol/import', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { moneyControlScraper } = await import('../services/moneycontrol-scraper');
    const result = await moneyControlScraper.executeImport();
    
    return apiResponse.success(res, {
      ...result,
      message: `Imported ${result.imported} prices from MoneyControl. ${result.unmatchedCompanies.length} companies could not be matched.`,
    });
  } catch (error: any) {
    console.error('Error importing from MoneyControl:', error);
    return apiResponse.serverError(res, `Failed to import from MoneyControl: ${error.message}`);
  }
});

/**
 * POST /api/unlisted/moneycontrol/add-company
 * Add a missing company from MoneyControl with CredHive enrichment (Admin only)
 * Creates company -> Searches CredHive -> Syncs data -> Imports MC price
 */
router.post('/moneycontrol/add-company', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const schema = z.object({
      name: z.string().min(2, 'Company name is required'),
      isin: z.string().min(10, 'Valid ISIN is required').max(12),
      price: z.number().optional(),
    });
    
    const { name, isin, price } = schema.parse(req.body);
    
    // Check if company with same ISIN already exists
    const existingByIsin = await storage.getUnlistedCompanyByISIN(isin);
    if (existingByIsin) {
      return apiResponse.badRequest(res, `Company with ISIN ${isin} already exists: ${existingByIsin.name}`);
    }
    
    const result: {
      companyId: string;
      companyName: string;
      credhiveFound: boolean;
      credhiveData: {
        cin?: string;
        sector?: string;
        industry?: string;
        financialsSynced: number;
        ratiosSynced: number;
      } | null;
      priceImported: boolean;
      importedPrice?: number;
    } = {
      companyId: '',
      companyName: name,
      credhiveFound: false,
      credhiveData: null,
      priceImported: false,
    };
    
    // Search CredHive for company by name
    let credhiveCompanyId: string | null = null;
    let credhiveDetails: any = null;
    
    try {
      const credhiveResults = await credhiveService.searchCompanyByNameOrCIN(name);
      
      if (credhiveResults && credhiveResults.length > 0) {
        // Find best match - exact name match or first result
        const exactMatch = credhiveResults.find(r => 
          r.name.toLowerCase() === name.toLowerCase()
        );
        const bestMatch = exactMatch || credhiveResults[0];
        
        credhiveCompanyId = bestMatch.company_id;
        
        // Get full company details from CredHive
        credhiveDetails = await credhiveService.getCompanyDetails(credhiveCompanyId);
        result.credhiveFound = true;
      }
    } catch (error: any) {
      console.warn('CredHive search failed, creating company with basic data:', error.message);
    }
    
    // Create the company
    const companyData: any = {
      name,
      isin,
      status: 'active',
      createdBy: req.user.id,
    };
    
    // Enrich with CredHive data if available
    if (credhiveDetails) {
      companyData.cin = credhiveDetails.cin;
      companyData.sector = credhiveDetails.sector;
      companyData.industry = credhiveDetails.industry;
      companyData.website = credhiveDetails.website;
      companyData.description = credhiveDetails.description;
      if (credhiveDetails.incorporation_date) {
        companyData.incorporationDate = credhiveDetails.incorporation_date;
      }
      if (credhiveDetails.paid_up_capital) {
        companyData.paidUpCapital = credhiveDetails.paid_up_capital.toString();
      }
      if (credhiveDetails.authorized_capital) {
        companyData.authorizedCapital = credhiveDetails.authorized_capital.toString();
      }
      if (credhiveDetails.face_value) {
        companyData.faceValue = credhiveDetails.face_value.toString();
      }
      if (credhiveDetails.total_shares) {
        companyData.totalShares = typeof credhiveDetails.total_shares === 'number' 
          ? credhiveDetails.total_shares 
          : parseInt(credhiveDetails.total_shares, 10);
      }
      companyData.probe42CompanyId = credhiveCompanyId;
      companyData.lastSyncedAt = new Date();
      
      result.credhiveData = {
        cin: credhiveDetails.cin,
        sector: credhiveDetails.sector,
        industry: credhiveDetails.industry,
        financialsSynced: 0,
        ratiosSynced: 0,
      };
    }
    
    const company = await storage.createUnlistedCompany(companyData);
    result.companyId = company.id;
    result.companyName = company.name;
    
    // Sync financials and ratios from CredHive if we have a company ID
    if (credhiveCompanyId && result.credhiveData) {
      try {
        const financials = await credhiveService.getCompanyFinancials(credhiveCompanyId, 5);
        for (const fin of financials) {
          const dbFormat = credhiveService.convertFinancialsToDbFormat(company.id, fin);
          await storage.createCompanyFinancials(dbFormat);
          result.credhiveData.financialsSynced++;
        }
        
        const ratios = await credhiveService.getCompanyRatios(credhiveCompanyId, 5);
        for (const ratio of ratios) {
          const dbFormat = credhiveService.convertRatiosToDbFormat(company.id, ratio);
          await storage.createCompanyRatios(dbFormat);
          result.credhiveData.ratiosSynced++;
        }
      } catch (error: any) {
        console.warn('Failed to sync financials/ratios from CredHive:', error.message);
      }
    }
    
    // Import price from MoneyControl if provided
    if (price && price > 0) {
      try {
        await storage.upsertPriceHistory({
          companyId: company.id,
          date: new Date(),
          price: price.toString(),
          sourceType: 'ADMIN_INPUT',
          notes: 'Imported from MoneyControl',
        });
        
        result.priceImported = true;
        result.importedPrice = price;
      } catch (error: any) {
        console.warn('Failed to import price from MoneyControl:', error.message);
      }
    }
    
    return apiResponse.created(res, result, 
      `Company "${name}" created successfully` + 
      (result.credhiveFound ? ' with CredHive data' : '') +
      (result.priceImported ? ` and price ₹${price?.toLocaleString('en-IN')}` : '')
    );
  } catch (error: any) {
    console.error('Error adding company from MoneyControl:', error);
    
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid input data', error.errors);
    }
    
    return apiResponse.serverError(res, `Failed to add company: ${error.message}`);
  }
});

// ===================================================================
// NSDL ISIN LOOKUP ROUTES
// ===================================================================

/**
 * GET /api/unlisted/nsdl/search-isin
 * Search for ISIN codes by company name from NSDL database
 * Admin only - no KYC requirement as this is an admin tool
 */
router.get('/nsdl/search-isin', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { name, securityType, limit } = req.query;
    
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      return apiResponse.badRequest(res, 'Company name must be at least 3 characters');
    }
    
    const { nsdlISINService } = await import('../services/nsdl-isin-service');
    
    const results = await nsdlISINService.searchByCompanyName(name.trim(), {
      securityType: (securityType as any) || 'equity',
      limit: parseInt(limit as string) || 10,
    });
    
    return apiResponse.success(res, {
      query: name.trim(),
      results,
      resultCount: results.length,
    });
  } catch (error: any) {
    console.error('Error searching NSDL ISIN:', error);
    return apiResponse.serverError(res, `Failed to search ISIN: ${error.message}`);
  }
});

/**
 * POST /api/unlisted/nsdl/refresh-cache
 * Refresh the NSDL ISIN data cache
 * Admin only - no KYC requirement as this is an admin tool
 */
router.post('/nsdl/refresh-cache', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { nsdlISINService } = await import('../services/nsdl-isin-service');
    
    const result = await nsdlISINService.refreshCache();
    
    return apiResponse.success(res, result, `ISIN cache refreshed with ${result.recordCount} records`);
  } catch (error: any) {
    console.error('Error refreshing NSDL cache:', error);
    return apiResponse.serverError(res, `Failed to refresh cache: ${error.message}`);
  }
});

// ===================================================================
// TRADING ROUTES - SELL LISTINGS
// ===================================================================

import { regulatoryReportingService } from '../services/regulatory-reporting-service';
import { auditLogArchivalService } from '../services/audit-log-archival';

/**
 * GET /api/unlisted/listings/published
 * Get active sell listings for the public Marketplace tab (no company filter required)
 * Returns all published sell listings with company information
 */
router.get('/listings/published', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', sector } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));
    
    // Get all active sell listings
    const allListings = await db.select({
      id: sellListings.id,
      companyId: sellListings.companyId,
      quantity: sellListings.quantity,
      askPrice: sellListings.askPrice,
      floorPrice: sellListings.floorPrice,
      landingPrice: sellListings.landingPrice,
      status: sellListings.status,
      validUntil: sellListings.validUntil,
      createdAt: sellListings.createdAt,
      minimumLotSize: sellListings.minimumLotSize,
    }).from(sellListings)
      .where(eq(sellListings.status, 'active'))
      .orderBy(sellListings.createdAt);

    // Enrich with company details and filter by sector if needed
    const enrichedListings = await Promise.all(
      allListings.map(async (listing) => {
        const company = await storage.getUnlistedCompanyById(listing.companyId);
        return {
          ...listing,
          company: company ? {
            id: company.id,
            name: company.name,
            symbol: company.symbol,
            sector: company.sector,
            industry: company.industry,
            logoUrl: company.logoUrl,
            currentPrice: company.currentPrice,
          } : null,
        };
      })
    );

    // Filter by sector if provided
    let filteredListings = enrichedListings.filter(l => l.company !== null);
    if (sector && typeof sector === 'string') {
      filteredListings = filteredListings.filter(l => 
        l.company?.sector?.toLowerCase() === sector.toLowerCase()
      );
    }

    // Paginate
    const totalCount = filteredListings.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedListings = filteredListings.slice(startIndex, startIndex + limitNum);

    return apiResponse.success(res, {
      listings: paginatedListings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching published listings:', error);
    return apiResponse.serverError(res, 'Failed to fetch marketplace listings');
  }
});

/**
 * GET /api/unlisted/listings
 * Get active sell listings
 */
router.get('/listings', requireLevel2, async (req: Request, res: Response) => {
  try {
    const { companyId, status } = req.query;
    
    if (!companyId || typeof companyId !== 'string') {
      return apiResponse.badRequest(res, 'Company ID is required');
    }
    
    const listings = await storage.getSellListingsByCompany(companyId);
    
    // Filter by status if provided
    let filteredListings = listings;
    if (status && typeof status === 'string') {
      filteredListings = listings.filter(l => l.status === status);
    }
    
    return apiResponse.success(res, filteredListings);
  } catch (error: any) {
    console.error('Error fetching listings:', error);
    return apiResponse.serverError(res, 'Failed to fetch sell listings');
  }
});

/**
 * POST /api/unlisted/listings
 * Create a new sell listing
 * Regulatory Requirements:
 * - Enhanced KYC (Level 2) required
 * - Accredited investor status for high-value transactions (>₹50 lakhs)
 * - Compliance logging for audit trail
 */
router.post('/listings', requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const { acknowledgedDisclosureIds, ...orderData } = req.body;
    const validatedData = insertSellListingSchema.parse(orderData);
    
    // Validate risk disclosure acknowledgment (SEBI Compliance)
    if (!acknowledgedDisclosureIds || !Array.isArray(acknowledgedDisclosureIds)) {
      return apiResponse.badRequest(res, 'Risk disclosure acknowledgment is required. Please read and accept all mandatory disclosures before creating a listing.');
    }
    
    const disclosureValidation = unlistedRiskDisclosureService.validateAcknowledgment({
      acknowledgedDisclosureIds,
      userId: req.user.id,
      companyId: validatedData.companyId,
      tradeType: 'sell',
    });
    
    if (!disclosureValidation.valid) {
      console.log(`[COMPLIANCE] sell_listing_blocked: Missing risk disclosures | userId: ${req.user.id} | missing: ${disclosureValidation.missingDisclosures.join(', ')}`);
      return apiResponse.badRequest(res, 'All mandatory risk disclosures must be acknowledged before creating a listing.', {
        missingDisclosures: disclosureValidation.missingDisclosures,
      });
    }
    
    // Persist risk disclosure acknowledgment for audit trail
    await saveRiskAcknowledgment({
      userId: req.user.id,
      companyId: validatedData.companyId,
      tradeType: 'sell',
      acknowledgedDisclosureIds,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
    
    // Verify company exists
    const company = await storage.getUnlistedCompanyById(validatedData.companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    // Calculate transaction value for accredited investor threshold check
    const askPriceNum = parseFloat(validatedData.askPrice) || 0;
    const transactionValue = validatedData.quantity * askPriceNum;
    const ACCREDITED_INVESTOR_THRESHOLD = 5000000; // ₹50 lakhs
    
    // For high-value transactions, verify accredited investor status
    if (transactionValue >= ACCREDITED_INVESTOR_THRESHOLD) {
      const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, req.user.id),
      });
      
      // Check if user has any accredited investor type
      if (!profile?.accreditedInvestorType) {
        console.log(`[COMPLIANCE] unlisted_sell_blocked: High-value transaction (₹${transactionValue}) requires accredited investor status | userId: ${req.user.id}`);
        return apiResponse.forbidden(res, 
          `Transactions above ₹50 lakhs require Accredited Investor status. Please complete your accredited investor verification in the KYC section.`
        );
      }
    }
    
    // Log compliance event
    console.log(`[COMPLIANCE] unlisted_sell_listing: { userId: '${req.user.id}', companyId: '${validatedData.companyId}', quantity: ${validatedData.quantity}, value: ${transactionValue}, disclosureVersion: '${unlistedRiskDisclosureService.getDisclosureVersion()}', outcome: 'success' }`);
    
    // Create listing
    const listing = await storage.createSellListing({
      ...validatedData,
      sellerUserId: req.user.id,
      quantityRemaining: validatedData.quantity,
    });
    
    return apiResponse.created(res, listing, 'Sell listing created successfully');
  } catch (error: any) {
    console.error('Error creating sell listing:', error);
    
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid input data', error.errors);
    }
    
    return apiResponse.serverError(res, 'Failed to create sell listing');
  }
});

// ===================================================================
// TRADING ROUTES - BUY REQUESTS
// ===================================================================

/**
 * GET /api/unlisted/buy-requests
 * Get active buy requests
 */
router.get('/buy-requests', requireLevel2, async (req: Request, res: Response) => {
  try {
    const { companyId, status } = req.query;
    
    if (!companyId || typeof companyId !== 'string') {
      return apiResponse.badRequest(res, 'Company ID is required');
    }
    
    const requests = await storage.getBuyRequestsByCompany(companyId);
    
    // Filter by status if provided
    let filteredRequests = requests;
    if (status && typeof status === 'string') {
      filteredRequests = requests.filter(r => r.status === status);
    }
    
    return apiResponse.success(res, filteredRequests);
  } catch (error: any) {
    console.error('Error fetching buy requests:', error);
    return apiResponse.serverError(res, 'Failed to fetch buy requests');
  }
});

/**
 * POST /api/unlisted/buy-requests
 * Create a new buy request
 * Regulatory Requirements:
 * - Enhanced KYC (Level 2) required
 * - Accredited investor status for high-value transactions (>₹50 lakhs)
 * - Compliance logging for audit trail
 */
router.post('/buy-requests', requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const { acknowledgedDisclosureIds, ...orderData } = req.body;
    const validatedData = insertBuyRequestSchema.parse(orderData);
    
    // Validate risk disclosure acknowledgment (SEBI Compliance)
    if (!acknowledgedDisclosureIds || !Array.isArray(acknowledgedDisclosureIds)) {
      return apiResponse.badRequest(res, 'Risk disclosure acknowledgment is required. Please read and accept all mandatory disclosures before placing an order.');
    }
    
    const disclosureValidation = unlistedRiskDisclosureService.validateAcknowledgment({
      acknowledgedDisclosureIds,
      userId: req.user.id,
      companyId: validatedData.companyId,
      tradeType: 'buy',
    });
    
    if (!disclosureValidation.valid) {
      console.log(`[COMPLIANCE] buy_request_blocked: Missing risk disclosures | userId: ${req.user.id} | missing: ${disclosureValidation.missingDisclosures.join(', ')}`);
      return apiResponse.badRequest(res, 'All mandatory risk disclosures must be acknowledged before placing an order.', {
        missingDisclosures: disclosureValidation.missingDisclosures,
      });
    }
    
    // Persist risk disclosure acknowledgment for audit trail
    await saveRiskAcknowledgment({
      userId: req.user.id,
      companyId: validatedData.companyId,
      tradeType: 'buy',
      acknowledgedDisclosureIds,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
    
    // Verify company exists
    const company = await storage.getUnlistedCompanyById(validatedData.companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    // Calculate transaction value for accredited investor threshold check
    const maxPriceNum = parseFloat(validatedData.maxPrice) || 0;
    const transactionValue = validatedData.quantity * maxPriceNum;
    const ACCREDITED_INVESTOR_THRESHOLD = 5000000; // ₹50 lakhs
    
    // For high-value transactions, verify accredited investor status
    if (transactionValue >= ACCREDITED_INVESTOR_THRESHOLD) {
      const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, req.user.id),
      });
      
      // Check if user has any accredited investor type
      if (!profile?.accreditedInvestorType) {
        console.log(`[COMPLIANCE] unlisted_buy_blocked: High-value transaction (₹${transactionValue}) requires accredited investor status | userId: ${req.user.id}`);
        return apiResponse.forbidden(res, 
          `Transactions above ₹50 lakhs require Accredited Investor status. Please complete your accredited investor verification in the KYC section.`
        );
      }
    }
    
    // Log compliance event
    console.log(`[COMPLIANCE] unlisted_buy_request: { userId: '${req.user.id}', companyId: '${validatedData.companyId}', quantity: ${validatedData.quantity}, maxValue: ${transactionValue}, disclosureVersion: '${unlistedRiskDisclosureService.getDisclosureVersion()}', outcome: 'success' }`);
    
    // Create buy request
    const request = await storage.createBuyRequest({
      ...validatedData,
      buyerUserId: req.user.id,
    });

    // Log to immutable SEBI-compliant audit trail
    await orderAuditHook.logUnlistedOrderCreated(
      request.id,
      req.user.id,
      'client',
      {
        companyId: validatedData.companyId,
        companyName: company.name,
        orderType: 'buy',
        quantity: validatedData.quantity,
        maxPrice: validatedData.maxPrice,
        transactionValue,
      },
      req
    );
    
    return apiResponse.created(res, request, 'Buy request created successfully');
  } catch (error: any) {
    console.error('Error creating buy request:', error);
    
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid input data', error.errors);
    }
    
    return apiResponse.serverError(res, 'Failed to create buy request');
  }
});

// ===================================================================
// USER ORDER TRACKING ROUTES
// ===================================================================

/**
 * GET /api/unlisted/my-buy-requests
 * Get current user's buy requests with company names
 */
router.get('/my-buy-requests', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const requests = await db.select({
      id: buyRequests.id,
      companyId: buyRequests.companyId,
      quantity: buyRequests.quantity,
      maxPrice: buyRequests.maxPrice,
      targetPrice: buyRequests.targetPrice,
      status: buyRequests.status,
      validUntil: buyRequests.validUntil,
      createdAt: buyRequests.createdAt,
    }).from(buyRequests)
      .where(eq(buyRequests.buyerUserId, req.user.id))
      .orderBy(buyRequests.createdAt);

    // Enrich with company names
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const company = await storage.getUnlistedCompanyById(request.companyId);
        return {
          ...request,
          companyName: company?.name || 'Unknown Company',
        };
      })
    );

    return apiResponse.success(res, enrichedRequests);
  } catch (error: any) {
    console.error('Error fetching user buy requests:', error);
    return apiResponse.serverError(res, 'Failed to fetch your buy requests');
  }
});

/**
 * GET /api/unlisted/my-sell-listings
 * Get current user's sell listings with company names
 */
router.get('/my-sell-listings', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const listings = await db.select({
      id: sellListings.id,
      companyId: sellListings.companyId,
      quantity: sellListings.quantity,
      askPrice: sellListings.askPrice,
      floorPrice: sellListings.floorPrice,
      status: sellListings.status,
      validUntil: sellListings.validUntil,
      createdAt: sellListings.createdAt,
    }).from(sellListings)
      .where(eq(sellListings.sellerUserId, req.user.id))
      .orderBy(sellListings.createdAt);

    // Enrich with company names
    const enrichedListings = await Promise.all(
      listings.map(async (listing) => {
        const company = await storage.getUnlistedCompanyById(listing.companyId);
        return {
          ...listing,
          minPrice: listing.floorPrice,
          companyName: company?.name || 'Unknown Company',
        };
      })
    );

    return apiResponse.success(res, enrichedListings);
  } catch (error: any) {
    console.error('Error fetching user sell listings:', error);
    return apiResponse.serverError(res, 'Failed to fetch your sell listings');
  }
});

// ===================================================================
// CART ROUTES - Batch buy requests before checkout
// ===================================================================

/**
 * GET /api/unlisted/cart
 * Get current user's cart items with company details
 */
router.get('/cart', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const items = await db.select().from(unlistedCart)
      .where(eq(unlistedCart.userId, req.user.id))
      .orderBy(unlistedCart.createdAt);

    // Enrich with company details and current prices
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const company = await storage.getUnlistedCompanyById(item.companyId);
        return {
          ...item,
          companyName: company?.name || 'Unknown Company',
          companySector: company?.sector,
          currentPrice: company?.currentPrice,
          companyLogo: company?.logoUrl,
        };
      })
    );

    // Calculate cart summary
    const totalItems = enrichedItems.length;
    const totalValue = enrichedItems.reduce((sum, item) => {
      const price = parseFloat(item.maxPrice) || 0;
      return sum + (item.quantity * price);
    }, 0);

    return apiResponse.success(res, {
      items: enrichedItems,
      summary: {
        totalItems,
        totalValue,
        estimatedFees: totalValue * 0.02, // 2% total fees (platform + buyer)
      },
    });
  } catch (error: any) {
    console.error('Error fetching cart:', error);
    return apiResponse.serverError(res, 'Failed to fetch cart');
  }
});

/**
 * POST /api/unlisted/cart
 * Add item to cart
 */
router.post('/cart', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const validatedData = insertUnlistedCartSchema.parse({
      ...req.body,
      userId: req.user.id,
    });

    // Check if company exists
    const company = await storage.getUnlistedCompanyById(validatedData.companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }

    // Check if already in cart - update instead of adding duplicate
    const existing = await db.select().from(unlistedCart)
      .where(and(
        eq(unlistedCart.userId, req.user.id),
        eq(unlistedCart.companyId, validatedData.companyId)
      ));

    if (existing.length > 0) {
      // Update existing cart item
      const updated = await db.update(unlistedCart)
        .set({
          quantity: validatedData.quantity,
          maxPrice: validatedData.maxPrice,
          targetPrice: validatedData.targetPrice,
          notes: validatedData.notes,
          updatedAt: new Date(),
        })
        .where(eq(unlistedCart.id, existing[0].id))
        .returning();
      
      return apiResponse.success(res, updated[0], 'Cart item updated');
    }

    // Insert new cart item
    const inserted = await db.insert(unlistedCart)
      .values(validatedData)
      .returning();

    return apiResponse.created(res, inserted[0], 'Added to cart');
  } catch (error: any) {
    console.error('Error adding to cart:', error);
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid input data', error.errors);
    }
    return apiResponse.serverError(res, 'Failed to add to cart');
  }
});

/**
 * PATCH /api/unlisted/cart/:id
 * Update cart item quantity or price
 */
router.patch('/cart/:id', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const { id } = req.params;
    const { quantity, maxPrice, targetPrice, notes } = req.body;

    // Verify ownership
    const existing = await db.select().from(unlistedCart)
      .where(and(
        eq(unlistedCart.id, id),
        eq(unlistedCart.userId, req.user.id)
      ));

    if (existing.length === 0) {
      return apiResponse.notFound(res, 'Cart item not found');
    }

    const updateData: Partial<UnlistedCartItem> = { updatedAt: new Date() };
    if (quantity !== undefined) updateData.quantity = quantity;
    if (maxPrice !== undefined) updateData.maxPrice = maxPrice;
    if (targetPrice !== undefined) updateData.targetPrice = targetPrice;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await db.update(unlistedCart)
      .set(updateData)
      .where(eq(unlistedCart.id, id))
      .returning();

    return apiResponse.success(res, updated[0], 'Cart item updated');
  } catch (error: any) {
    console.error('Error updating cart item:', error);
    return apiResponse.serverError(res, 'Failed to update cart item');
  }
});

/**
 * DELETE /api/unlisted/cart/:id
 * Remove item from cart
 */
router.delete('/cart/:id', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const { id } = req.params;

    // Verify ownership and delete
    const deleted = await db.delete(unlistedCart)
      .where(and(
        eq(unlistedCart.id, id),
        eq(unlistedCart.userId, req.user.id)
      ))
      .returning();

    if (deleted.length === 0) {
      return apiResponse.notFound(res, 'Cart item not found');
    }

    return apiResponse.success(res, { deleted: true }, 'Removed from cart');
  } catch (error: any) {
    console.error('Error removing from cart:', error);
    return apiResponse.serverError(res, 'Failed to remove from cart');
  }
});

/**
 * DELETE /api/unlisted/cart
 * Clear entire cart
 */
router.delete('/cart', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    await db.delete(unlistedCart)
      .where(eq(unlistedCart.userId, req.user.id));

    return apiResponse.success(res, { cleared: true }, 'Cart cleared');
  } catch (error: any) {
    console.error('Error clearing cart:', error);
    return apiResponse.serverError(res, 'Failed to clear cart');
  }
});

/**
 * POST /api/unlisted/cart/checkout
 * Convert all cart items to buy requests (batch checkout)
 * Regulatory Requirements:
 * - Enhanced KYC (Level 2) required
 * - Risk disclosure acknowledgment required for each company
 * - Accredited investor check for high-value transactions
 */
router.post('/cart/checkout', requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const { acknowledgedDisclosureIds } = req.body;

    // Get cart items
    const cartItems = await db.select().from(unlistedCart)
      .where(eq(unlistedCart.userId, req.user.id));

    if (cartItems.length === 0) {
      return apiResponse.badRequest(res, 'Cart is empty');
    }

    // Calculate total transaction value
    const totalValue = cartItems.reduce((sum, item) => {
      const price = parseFloat(item.maxPrice) || 0;
      return sum + (item.quantity * price);
    }, 0);

    const ACCREDITED_INVESTOR_THRESHOLD = 5000000; // ₹50 lakhs

    // For high-value transactions, verify accredited investor status
    if (totalValue >= ACCREDITED_INVESTOR_THRESHOLD) {
      const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, req.user.id),
      });
      
      if (!profile?.accreditedInvestorType) {
        console.log(`[COMPLIANCE] cart_checkout_blocked: High-value transaction (₹${totalValue}) requires accredited investor status | userId: ${req.user.id}`);
        return apiResponse.forbidden(res, 
          `Cart total of ₹${(totalValue / 100000).toFixed(2)} lakhs exceeds the limit for non-accredited investors. Please complete your accredited investor verification.`
        );
      }
    }

    // Validate risk disclosure acknowledgment
    if (!acknowledgedDisclosureIds || !Array.isArray(acknowledgedDisclosureIds)) {
      return apiResponse.badRequest(res, 'Risk disclosure acknowledgment is required for batch checkout');
    }

    // Create buy requests for each cart item
    const createdRequests: BuyRequest[] = [];
    const errors: { companyId: string; error: string }[] = [];

    for (const item of cartItems) {
      try {
        // Validate disclosure for this company
        const disclosureValidation = unlistedRiskDisclosureService.validateAcknowledgment({
          acknowledgedDisclosureIds,
          userId: req.user.id,
          companyId: item.companyId,
          tradeType: 'buy',
        });

        if (!disclosureValidation.valid) {
          errors.push({
            companyId: item.companyId,
            error: 'Missing risk disclosure acknowledgment',
          });
          continue;
        }

        // Persist risk disclosure acknowledgment for audit trail
        await saveRiskAcknowledgment({
          userId: req.user.id,
          companyId: item.companyId,
          tradeType: 'buy',
          acknowledgedDisclosureIds,
          ipAddress: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
        });

        // Create buy request
        const buyRequest = await storage.createBuyRequest({
          buyerUserId: req.user.id,
          companyId: item.companyId,
          quantity: item.quantity,
          maxPrice: item.maxPrice,
          targetPrice: item.targetPrice,
          notes: item.notes,
          status: 'pending',
        });

        createdRequests.push(buyRequest);

        // Log compliance event
        console.log(`[COMPLIANCE] cart_checkout_buy_request: { userId: '${req.user.id}', companyId: '${item.companyId}', quantity: ${item.quantity}, buyRequestId: '${buyRequest.id}' }`);
      } catch (itemError: any) {
        errors.push({
          companyId: item.companyId,
          error: itemError.message || 'Failed to create buy request',
        });
      }
    }

    // Clear successful items from cart
    if (createdRequests.length > 0) {
      const successCompanyIds = createdRequests.map(r => r.companyId);
      for (const companyId of successCompanyIds) {
        await db.delete(unlistedCart)
          .where(and(
            eq(unlistedCart.userId, req.user.id),
            eq(unlistedCart.companyId, companyId)
          ));
      }
    }

    console.log(`[COMPLIANCE] cart_checkout_complete: { userId: '${req.user.id}', successCount: ${createdRequests.length}, errorCount: ${errors.length}, totalValue: ${totalValue} }`);

    return apiResponse.success(res, {
      createdRequests,
      errors,
      summary: {
        total: cartItems.length,
        successful: createdRequests.length,
        failed: errors.length,
      },
    }, `Checkout complete: ${createdRequests.length} buy request(s) created`);
  } catch (error: any) {
    console.error('Error during cart checkout:', error);
    return apiResponse.serverError(res, 'Failed to complete checkout');
  }
});

/**
 * GET /api/unlisted/cart/count
 * Get cart item count for badge display
 */
router.get('/cart/count', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const items = await db.select({ id: unlistedCart.id }).from(unlistedCart)
      .where(eq(unlistedCart.userId, req.user.id));

    return apiResponse.success(res, { count: items.length });
  } catch (error: any) {
    console.error('Error fetching cart count:', error);
    return apiResponse.serverError(res, 'Failed to fetch cart count');
  }
});

// ===================================================================
// ELIGIBILITY ROUTES
// ===================================================================

/**
 * GET /api/unlisted/eligibility
 * Check current user's eligibility for unlisted marketplace trading
 */
router.get('/eligibility', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const eligibility = await unlistedEligibilityService.checkUserEligibility(req.user.id);
    return apiResponse.success(res, eligibility);
  } catch (error: any) {
    console.error('Error checking eligibility:', error);
    return apiResponse.serverError(res, 'Failed to check eligibility');
  }
});

/**
 * POST /api/unlisted/eligibility/check-trade
 * Check if a specific trade is allowed based on user eligibility and trade value
 */
router.post('/eligibility/check-trade', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const { tradeValue, tradeType } = req.body;
    
    if (typeof tradeValue !== 'number' || tradeValue <= 0) {
      return apiResponse.badRequest(res, 'Valid trade value is required');
    }
    
    if (!['buy', 'sell'].includes(tradeType)) {
      return apiResponse.badRequest(res, 'Trade type must be "buy" or "sell"');
    }
    
    const eligibility = await unlistedEligibilityService.checkTradeEligibility({
      userId: req.user.id,
      tradeValue,
      tradeType,
    });
    
    return apiResponse.success(res, eligibility);
  } catch (error: any) {
    console.error('Error checking trade eligibility:', error);
    return apiResponse.serverError(res, 'Failed to check trade eligibility');
  }
});

/**
 * GET /api/unlisted/eligibility/requirements
 * Get the requirements for trading in the unlisted marketplace
 */
router.get('/eligibility/requirements', async (_req: Request, res: Response) => {
  try {
    const requirements = await unlistedEligibilityService.getEligibilityRequirements();
    return apiResponse.success(res, requirements);
  } catch (error: any) {
    console.error('Error fetching requirements:', error);
    return apiResponse.serverError(res, 'Failed to fetch requirements');
  }
});

/**
 * GET /api/unlisted/eligibility/kyc-upgrade
 * Get the user's KYC upgrade status and remaining steps
 */
router.get('/eligibility/kyc-upgrade', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const upgradeStatus = await unlistedEligibilityService.getKYCUpgradeStatus(req.user.id);
    return apiResponse.success(res, upgradeStatus);
  } catch (error: any) {
    console.error('Error fetching KYC upgrade status:', error);
    return apiResponse.serverError(res, 'Failed to fetch KYC upgrade status');
  }
});

// ===================================================================
// RISK DISCLOSURES ROUTES
// ===================================================================

/**
 * GET /api/unlisted/risk-disclosures
 * Get all SEBI-mandated risk disclosures for unlisted securities trading
 */
router.get('/risk-disclosures', async (_req: Request, res: Response) => {
  try {
    const formattedDisclosures = unlistedRiskDisclosureService.formatDisclosuresForDisplay();
    return apiResponse.success(res, formattedDisclosures);
  } catch (error: any) {
    console.error('Error fetching risk disclosures:', error);
    return apiResponse.serverError(res, 'Failed to fetch risk disclosures');
  }
});

/**
 * GET /api/unlisted/risk-disclosures/company/:companyId
 * Get company-specific risk warnings in addition to standard disclosures
 */
router.get('/risk-disclosures/company/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const ratios = await storage.getCompanyRatios(companyId);
    const latestRatios = ratios && ratios.length > 0 ? ratios[0] : null;
    
    const companyRisks = unlistedRiskDisclosureService.getCompanySpecificRisks({
      netWorth: (company as any).netWorth ? parseFloat((company as any).netWorth.toString()) : undefined,
      debtEquityRatio: latestRatios?.debtEquity ? parseFloat(latestRatios.debtEquity.toString()) : undefined,
      profitMargin: latestRatios?.marginPat ? parseFloat(latestRatios.marginPat.toString()) : undefined,
      riskScore: (company as any).riskScore ?? undefined,
    });
    
    const standardDisclosures = unlistedRiskDisclosureService.formatDisclosuresForDisplay();
    
    return apiResponse.success(res, {
      ...standardDisclosures,
      companySpecificRisks: companyRisks,
      companyName: company.name,
      companyRiskScore: (company as any).riskScore,
    });
  } catch (error: any) {
    console.error('Error fetching company risk disclosures:', error);
    return apiResponse.serverError(res, 'Failed to fetch company risk disclosures');
  }
});

/**
 * POST /api/unlisted/risk-disclosures/validate
 * Validate that all mandatory disclosures have been acknowledged
 */
router.post('/risk-disclosures/validate', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const { acknowledgedDisclosureIds, companyId, tradeType } = req.body;
    
    if (!Array.isArray(acknowledgedDisclosureIds)) {
      return apiResponse.badRequest(res, 'acknowledgedDisclosureIds must be an array');
    }
    
    if (!companyId || typeof companyId !== 'string') {
      return apiResponse.badRequest(res, 'companyId is required');
    }
    
    if (!['buy', 'sell'].includes(tradeType)) {
      return apiResponse.badRequest(res, 'tradeType must be "buy" or "sell"');
    }
    
    const validation = unlistedRiskDisclosureService.validateAcknowledgment({
      acknowledgedDisclosureIds,
      userId: req.user.id,
      companyId,
      tradeType,
    });
    
    if (!validation.valid) {
      return apiResponse.badRequest(res, 'Not all mandatory disclosures have been acknowledged', {
        missingDisclosures: validation.missingDisclosures,
      });
    }
    
    console.log(`[COMPLIANCE] risk_disclosure_acknowledged: { userId: '${req.user.id}', companyId: '${companyId}', tradeType: '${tradeType}', version: '${unlistedRiskDisclosureService.getDisclosureVersion()}' }`);
    
    return apiResponse.success(res, {
      valid: true,
      disclosureVersion: unlistedRiskDisclosureService.getDisclosureVersion(),
      acknowledgedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error validating risk disclosures:', error);
    return apiResponse.serverError(res, 'Failed to validate risk disclosures');
  }
});

// ===================================================================
// TRADING ROUTES - DEALS
// ===================================================================

/**
 * GET /api/unlisted/deals
 * Get matched deals
 */
router.get('/deals', requireLevel2, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.query;
    
    if (!companyId || typeof companyId !== 'string') {
      return apiResponse.badRequest(res, 'Company ID is required');
    }
    
    const deals = await storage.getUnlistedDealsByCompany(companyId);
    return apiResponse.success(res, deals);
  } catch (error: any) {
    console.error('Error fetching deals:', error);
    return apiResponse.serverError(res, 'Failed to fetch deals');
  }
});

/**
 * GET /api/unlisted/deals/:id
 * Get detailed information about a specific deal
 */
router.get('/deals/:id', requireLevel2, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const deal = await storage.getUnlistedDealById(id);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }
    
    return apiResponse.success(res, deal);
  } catch (error: any) {
    console.error('Error fetching deal:', error);
    return apiResponse.serverError(res, 'Failed to fetch deal details');
  }
});

/**
 * GET /api/unlisted/my-deals
 * Get all deals for the current user (as buyer or seller)
 */
router.get('/my-deals', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse.unauthorized(res, 'User not authenticated');
    }
    
    const deals = await storage.getUnlistedDealsByUser(userId);
    
    // Enrich deals with company information
    const enrichedDeals = await Promise.all(deals.map(async (deal) => {
      const company = await storage.getUnlistedCompanyById(deal.companyId);
      return {
        ...deal,
        company: company ? { id: company.id, name: company.name, symbol: company.symbol } : null,
        userRole: deal.buyerUserId === userId ? 'buyer' : 'seller',
      };
    }));
    
    return apiResponse.success(res, enrichedDeals);
  } catch (error: any) {
    console.error('Error fetching user deals:', error);
    return apiResponse.serverError(res, 'Failed to fetch deals');
  }
});

/**
 * GET /api/unlisted/deals-pending-acceptance
 * Get deals awaiting user's acceptance
 */
router.get('/deals-pending-acceptance', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse.unauthorized(res, 'User not authenticated');
    }
    
    const deals = await storage.getUnlistedDealsPendingAcceptance(userId);
    
    // Enrich with company info and determine if user has accepted
    const enrichedDeals = await Promise.all(deals.map(async (deal) => {
      const company = await storage.getUnlistedCompanyById(deal.companyId);
      const isBuyer = deal.buyerUserId === userId;
      const userHasAccepted = isBuyer ? deal.buyerAccepted : deal.sellerAccepted;
      
      return {
        ...deal,
        company: company ? { id: company.id, name: company.name, symbol: company.symbol } : null,
        userRole: isBuyer ? 'buyer' : 'seller',
        userHasAccepted,
        counterpartyAccepted: isBuyer ? deal.sellerAccepted : deal.buyerAccepted,
      };
    }));
    
    return apiResponse.success(res, enrichedDeals);
  } catch (error: any) {
    console.error('Error fetching pending deals:', error);
    return apiResponse.serverError(res, 'Failed to fetch pending deals');
  }
});

/**
 * POST /api/unlisted/deals/:id/accept
 * Accept a matched deal (buyer or seller)
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */
router.post('/deals/:id/accept', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return apiResponse.unauthorized(res, 'User not authenticated');
    }
    
    // Get the deal
    const deal = await storage.getUnlistedDealById(id);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }
    
    // Check if user is part of this deal
    const isBuyer = deal.buyerUserId === userId;
    const isSeller = deal.sellerUserId === userId;
    
    if (!isBuyer && !isSeller) {
      return apiResponse.forbidden(res, 'You are not authorized to accept this deal');
    }
    
    // Check if deal is in acceptable state
    if (deal.status !== 'pending' && deal.status !== 'awaiting_acceptance') {
      return apiResponse.badRequest(res, `Deal cannot be accepted in current status: ${deal.status}`);
    }
    
    // Check if user already accepted
    if (isBuyer && deal.buyerAccepted) {
      return apiResponse.badRequest(res, 'You have already accepted this deal');
    }
    if (isSeller && deal.sellerAccepted) {
      return apiResponse.badRequest(res, 'You have already accepted this deal');
    }
    
    // Check acceptance deadline
    if (deal.acceptanceDeadline && new Date() > new Date(deal.acceptanceDeadline)) {
      return apiResponse.badRequest(res, 'Acceptance deadline has passed');
    }
    
    // Require risk disclosure acknowledgment before deal acceptance
    const tradeType = isBuyer ? 'buy' : 'sell';
    const { acknowledgedDisclosureIds } = req.body;
    
    if (!acknowledgedDisclosureIds || !Array.isArray(acknowledgedDisclosureIds)) {
      return apiResponse.badRequest(res, 'Risk disclosure acknowledgment is required before accepting a deal', {
        requiresAcknowledgment: true,
        tradeType,
        companyId: deal.companyId,
        disclosures: unlistedRiskDisclosureService.formatDisclosuresForDisplay(),
      });
    }
    
    const disclosureValidation = unlistedRiskDisclosureService.validateAcknowledgment({
      acknowledgedDisclosureIds,
      userId,
      companyId: deal.companyId,
      tradeType,
    });
    
    if (!disclosureValidation.valid) {
      console.log(`[COMPLIANCE] deal_accept_blocked: Missing risk disclosures | userId: ${userId} | dealId: ${id} | missing: ${disclosureValidation.missingDisclosures.join(', ')}`);
      return apiResponse.badRequest(res, 'All mandatory risk disclosures must be acknowledged before accepting the deal.', {
        missingDisclosures: disclosureValidation.missingDisclosures,
      });
    }
    
    // Persist risk disclosure acknowledgment for audit trail
    await saveRiskAcknowledgment({
      userId,
      companyId: deal.companyId,
      tradeType,
      tradeEntityId: id,
      tradeEntityType: 'deal_acceptance',
      acknowledgedDisclosureIds,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
    
    // Update the deal with acceptance
    const updateData: any = {
      status: 'awaiting_acceptance',
    };
    
    if (isBuyer) {
      updateData.buyerAccepted = true;
      updateData.buyerAcceptedAt = new Date();
    } else {
      updateData.sellerAccepted = true;
      updateData.sellerAcceptedAt = new Date();
    }
    
    // Check if both parties have now accepted
    const otherPartyAccepted = isBuyer ? deal.sellerAccepted : deal.buyerAccepted;
    if (otherPartyAccepted) {
      updateData.status = 'confirmed';
    }
    
    const updatedDeal = await storage.updateUnlistedDeal(id, updateData);
    
    // Archive deal acceptance event for immutable audit log
    const totalValue = parseFloat(deal.totalValue || '0');
    await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
      eventType: 'deal_accepted',
      userId,
      dealId: id,
      companyId: deal.companyId,
      action: `Deal accepted by ${isBuyer ? 'buyer' : 'seller'}`,
      details: {
        role: isBuyer ? 'buyer' : 'seller',
        agreedPrice: deal.agreedPrice,
        quantity: deal.quantity,
        totalValue,
        bothAccepted: updateData.status === 'confirmed',
      },
      riskLevel: totalValue >= 5000000 ? 'high' : 'low',
    });
    
    // Register regulatory event for high-value deals
    if (totalValue >= 1000000) {
      await regulatoryReportingService.registerReportableEvent({
        eventType: 'deal_acceptance',
        triggeredBy: 'user_action',
        userId,
        dealId: id,
        amount: totalValue,
        currency: 'INR',
        riskIndicators: totalValue >= 5000000 ? ['high_value_transaction'] : [],
        riskScore: totalValue >= 5000000 ? 40 : 20,
        metadata: {
          role: isBuyer ? 'buyer' : 'seller',
          companyId: deal.companyId,
          bothAccepted: updateData.status === 'confirmed',
        },
      });
    }
    
    // If both accepted, trigger payment flow notification
    if (updateData.status === 'confirmed') {
      console.log(`[Deal ${id}] Both parties accepted - deal confirmed, ready for payment`);
    }
    
    return apiResponse.success(res, {
      deal: updatedDeal,
      message: otherPartyAccepted 
        ? 'Deal confirmed! Both parties have accepted. Proceed to payment.'
        : `You have accepted the deal. Waiting for ${isBuyer ? 'seller' : 'buyer'} confirmation.`,
      bothAccepted: updateData.status === 'confirmed',
    });
  } catch (error: any) {
    console.error('Error accepting deal:', error);
    return apiResponse.serverError(res, 'Failed to accept deal');
  }
});

/**
 * POST /api/unlisted/deals/:id/reject
 * Reject a matched deal (buyer or seller)
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */
router.post('/deals/:id/reject', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return apiResponse.unauthorized(res, 'User not authenticated');
    }
    
    // Get the deal
    const deal = await storage.getUnlistedDealById(id);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }
    
    // Check if user is part of this deal
    const isBuyer = deal.buyerUserId === userId;
    const isSeller = deal.sellerUserId === userId;
    
    if (!isBuyer && !isSeller) {
      return apiResponse.forbidden(res, 'You are not authorized to reject this deal');
    }
    
    // Check if deal can be rejected
    if (deal.status !== 'pending' && deal.status !== 'awaiting_acceptance') {
      return apiResponse.badRequest(res, `Deal cannot be rejected in current status: ${deal.status}`);
    }
    
    // Update the deal status to cancelled
    const updatedDeal = await storage.updateUnlistedDeal(id, {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: reason || `Rejected by ${isBuyer ? 'buyer' : 'seller'}`,
    });
    
    // Revert the buy request and sell listing status back to active
    await storage.updateBuyRequest(deal.buyRequestId, { status: 'active' });
    await storage.updateSellListing(deal.sellListingId, { status: 'active' });
    
    console.log(`[Deal ${id}] Rejected by ${isBuyer ? 'buyer' : 'seller'}`);
    
    return apiResponse.success(res, {
      deal: updatedDeal,
      message: 'Deal rejected. The listing and request have been restored.',
    });
  } catch (error: any) {
    console.error('Error rejecting deal:', error);
    return apiResponse.serverError(res, 'Failed to reject deal');
  }
});

/**
 * POST /api/unlisted/deals/:id/counter-offer
 * Propose a counter offer for price negotiation
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */
router.post('/deals/:id/counter-offer', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { proposedPrice, message } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return apiResponse.unauthorized(res, 'User not authenticated');
    }
    
    if (!proposedPrice || isNaN(parseFloat(proposedPrice))) {
      return apiResponse.badRequest(res, 'Valid proposed price is required');
    }
    
    // Get the deal
    const deal = await storage.getUnlistedDealById(id);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }
    
    // Check if user is part of this deal
    const isBuyer = deal.buyerUserId === userId;
    const isSeller = deal.sellerUserId === userId;
    
    if (!isBuyer && !isSeller) {
      return apiResponse.forbidden(res, 'You are not authorized to make a counter offer');
    }
    
    // Check if deal is in negotiable state
    if (deal.status !== 'pending' && deal.status !== 'awaiting_acceptance') {
      return apiResponse.badRequest(res, `Counter offers not allowed in current status: ${deal.status}`);
    }
    
    // Reset acceptances and update price
    const updatedDeal = await storage.updateUnlistedDeal(id, {
      agreedPrice: proposedPrice.toString(),
      totalValue: (parseFloat(proposedPrice) * deal.quantity).toString(),
      buyerAccepted: false,
      sellerAccepted: false,
      buyerAcceptedAt: null,
      sellerAcceptedAt: null,
      status: 'awaiting_acceptance',
      complianceNotes: deal.complianceNotes 
        ? `${deal.complianceNotes}\n[Counter-offer] ${isBuyer ? 'Buyer' : 'Seller'} proposed ₹${proposedPrice}: ${message || 'No message'}`
        : `[Counter-offer] ${isBuyer ? 'Buyer' : 'Seller'} proposed ₹${proposedPrice}: ${message || 'No message'}`,
    });
    
    console.log(`[Deal ${id}] Counter-offer: ${isBuyer ? 'Buyer' : 'Seller'} proposed ₹${proposedPrice}`);
    
    return apiResponse.success(res, {
      deal: updatedDeal,
      message: `Counter-offer of ₹${proposedPrice} sent. Both parties need to accept the new price.`,
    });
  } catch (error: any) {
    console.error('Error making counter offer:', error);
    return apiResponse.serverError(res, 'Failed to make counter offer');
  }
});

// ===================================================================
// PRICE SUGGESTION ROUTES
// ===================================================================

/**
 * POST /api/unlisted/price/suggest
 * Get AI-powered price suggestion for a company
 * Request body: { companyId: string }
 */
router.post('/price/suggest', requireLevel2, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.body;
    
    if (!companyId) {
      return apiResponse.badRequest(res, 'Company ID is required');
    }
    
    const priceSuggestionService = new PriceSuggestionService(storage);
    const suggestion = await priceSuggestionService.calculateSuggestedPrice(companyId);
    
    return apiResponse.success(res, suggestion);
  } catch (error: any) {
    console.error('Error calculating price suggestion:', error);
    
    if (error.message === 'Company not found') {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    if (error.message === 'Insufficient data to calculate price suggestion') {
      return apiResponse.badRequest(res, 'Insufficient data to calculate price suggestion');
    }
    
    return apiResponse.serverError(res, 'Failed to calculate price suggestion');
  }
});

/**
 * GET /api/unlisted/companies/:id/price-suggestion
 * DEPRECATED: Use POST /api/unlisted/price/suggest instead
 * Kept for backward compatibility
 */
router.get('/companies/:id/price-suggestion', requireLevel2, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const priceSuggestionService = new PriceSuggestionService(storage);
    const suggestion = await priceSuggestionService.calculateSuggestedPrice(id);
    
    return apiResponse.success(res, suggestion);
  } catch (error: any) {
    console.error('Error calculating price suggestion:', error);
    
    if (error.message === 'Company not found') {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    if (error.message === 'Insufficient data to calculate price suggestion') {
      return apiResponse.badRequest(res, 'Insufficient data to calculate price suggestion');
    }
    
    return apiResponse.serverError(res, 'Failed to calculate price suggestion');
  }
});

/**
 * POST /api/unlisted/price-suggestions/batch
 * Get price suggestions for multiple companies
 */
router.post('/price-suggestions/batch', requireLevel2, async (req: Request, res: Response) => {
  try {
    const { companyIds } = req.body;
    
    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return apiResponse.badRequest(res, 'Company IDs array is required');
    }
    
    const priceSuggestionService = new PriceSuggestionService(storage);
    const suggestions = await priceSuggestionService.calculateBatchSuggestions(companyIds);
    
    return apiResponse.success(res, suggestions);
  } catch (error: any) {
    console.error('Error calculating batch price suggestions:', error);
    return apiResponse.serverError(res, 'Failed to calculate price suggestions');
  }
});

/**
 * GET /api/unlisted/admin/negotiations
 * Get all active negotiations (sell listings with matching buy requests)
 * Admin only endpoint
 */
router.get('/admin/negotiations', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { 
      page = '1', 
      limit = '50',
      companySearch,
      minMatchScore,
      minPrice,
      maxPrice 
    } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    // Get all active sell listings
    const allSellListings = await db.select()
      .from(sellListings)
      .where(eq(sellListings.status, 'active'));
    
    // Get all active buy requests
    const allBuyRequests = await db.select()
      .from(buyRequests)
      .where(eq(buyRequests.status, 'active'));
    
    // Group buy requests by company
    const buyRequestsByCompany = allBuyRequests.reduce((acc: Record<string, BuyRequest[]>, buyRequest: BuyRequest) => {
      if (!acc[buyRequest.companyId]) {
        acc[buyRequest.companyId] = [];
      }
      acc[buyRequest.companyId].push(buyRequest);
      return acc;
    }, {} as Record<string, BuyRequest[]>);
    
    // Build negotiations data
    const negotiations = [];
    const priceSuggestionService = new PriceSuggestionService(storage);
    
    for (const sellListing of allSellListings) {
      const matchingBuyRequests = buyRequestsByCompany[sellListing.companyId] || [];
      
      if (matchingBuyRequests.length === 0) continue;
      
      // Get company details
      const company = await storage.getUnlistedCompanyById(sellListing.companyId);
      if (!company) continue;
      
      // Apply company search filter
      if (companySearch && typeof companySearch === 'string') {
        const query = companySearch.toLowerCase();
        if (!company.name.toLowerCase().includes(query) && 
            !company.cin?.toLowerCase().includes(query)) {
          continue;
        }
      }
      
      // Get latest ratios
      const ratios = await storage.getCompanyRatios(sellListing.companyId);
      const latestRatios = ratios[0];
      
      // Get last deal price
      const recentDeals = await db.select()
        .from(unlistedDeals)
        .where(eq(unlistedDeals.companyId, sellListing.companyId));
      const lastDeal = recentDeals.sort((a: any, b: any) => 
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      )[0];
      
      // Get price suggestion
      let priceSuggestion;
      try {
        priceSuggestion = await priceSuggestionService.calculateSuggestedPrice(sellListing.companyId);
      } catch (error) {
        console.error(`Error calculating price suggestion for ${company.name}:`, error);
      }
      
      // Find best matching buy request (highest max price)
      const bestBuyRequest = matchingBuyRequests.reduce((best: BuyRequest, current: BuyRequest) => {
        const bestPrice = parseFloat(best.maxPrice);
        const currentPrice = parseFloat(current.maxPrice);
        return currentPrice > bestPrice ? current : best;
      });
      
      // Calculate match score (0-100)
      const sellerLandingPrice = parseFloat(sellListing.landingPrice);
      const buyerMaxPrice = parseFloat(bestBuyRequest.maxPrice);
      const suggestedMidpoint = priceSuggestion?.suggestedPrice || (sellerLandingPrice + buyerMaxPrice) / 2;
      
      let matchScore = 0;
      if (buyerMaxPrice >= sellerLandingPrice) {
        matchScore = 100; // Perfect match
      } else {
        // Calculate based on how close they are
        const gap = sellerLandingPrice - buyerMaxPrice;
        const range = sellerLandingPrice;
        matchScore = Math.max(0, Math.round((1 - gap / range) * 100));
      }
      
      // Apply match score filter
      if (minMatchScore && matchScore < parseFloat(minMatchScore as string)) {
        continue;
      }
      
      // Apply price range filter
      if (minPrice && sellerLandingPrice < parseFloat(minPrice as string)) {
        continue;
      }
      if (maxPrice && sellerLandingPrice > parseFloat(maxPrice as string)) {
        continue;
      }
      
      negotiations.push({
        id: sellListing.id,
        company: {
          id: company.id,
          name: company.name,
          cin: company.cin,
          sector: company.sector,
        },
        sellListing: {
          id: sellListing.id,
          sellerUserId: sellListing.sellerUserId,
          quantity: sellListing.quantity,
          landingPrice: sellListing.landingPrice,
          floorPrice: sellListing.floorPrice,
          askPrice: sellListing.askPrice,
        },
        buyRequest: {
          id: bestBuyRequest.id,
          buyerUserId: bestBuyRequest.buyerUserId,
          quantity: bestBuyRequest.quantity,
          maxPrice: bestBuyRequest.maxPrice,
          targetPrice: bestBuyRequest.targetPrice,
        },
        matchingBuyRequestsCount: matchingBuyRequests.length,
        suggestedMidpoint,
        matchScore,
        confidence: priceSuggestion?.confidence || 'low',
        ratios: latestRatios ? {
          roe: latestRatios.roe,
          roce: latestRatios.roce,
          debtToEquity: latestRatios.debtEquity,
          currentRatio: latestRatios.currentRatio,
          peRatio: latestRatios.peRatio,
        } : null,
        lastDealPrice: lastDeal ? lastDeal.agreedPrice : null,
        lastDealDate: lastDeal ? lastDeal.createdAt : null,
      });
    }
    
    // Sort by match score (highest first)
    negotiations.sort((a, b) => b.matchScore - a.matchScore);
    
    // Apply pagination
    const total = negotiations.length;
    const paginatedNegotiations = negotiations.slice(offset, offset + limitNum);
    
    return apiResponse.success(res, {
      negotiations: paginatedNegotiations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching negotiations:', error);
    return apiResponse.serverError(res, 'Failed to fetch negotiations');
  }
});

// ===================================================================
// ADMIN DASHBOARD ROUTES
// ===================================================================

/**
 * GET /api/unlisted/admin/dashboard-metrics
 * Get dashboard metrics for admin overview
 */
router.get('/admin/dashboard-metrics', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    // Get all companies
    const allCompanies = await storage.getAllUnlistedCompanies({});
    const activeCompanies = allCompanies.filter(c => c.status === 'active');
    const suspendedCompanies = allCompanies.filter(c => c.tradingSuspended);
    const companiesNeedingPricing = allCompanies.filter(c => 
      c.status === 'active' && (!c.draftBuyPrice || !c.draftSellPrice)
    );
    const companiesWithDraftPrices = allCompanies.filter(c => 
      c.pricingStatus === 'draft' || c.pricingStatus === 'pending_review'
    );
    
    // Get high-risk companies
    const highRiskCompanies = allCompanies.filter(c => 
      c.complianceStatus === 'blocked' || ((c as any).riskScore && (c as any).riskScore > 70)
    );
    
    // Get all active sell listings
    const activeSellListings = await db.select()
      .from(sellListings)
      .where(eq(sellListings.status, 'active'));
    
    // Get all active buy requests
    const activeBuyRequests = await db.select()
      .from(buyRequests)
      .where(eq(buyRequests.status, 'active'));
    
    // Get pending deals (awaiting settlement)
    const pendingDeals = await db.select()
      .from(unlistedDeals)
      .where(eq(unlistedDeals.status, 'pending'));
    
    // Get completed deals in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentDeals = await db.select().from(unlistedDeals);
    const completedRecentDeals = recentDeals.filter(d => 
      d.status === 'completed' && new Date(d.createdAt || '') > sevenDaysAgo
    );
    
    // Calculate total trading volume (last 7 days)
    const tradingVolume = completedRecentDeals.reduce((sum, deal) => {
      const price = parseFloat(deal.agreedPrice || '0');
      const qty = deal.quantity || 0;
      return sum + (price * qty);
    }, 0);
    
    // Get compliance alerts
    const complianceAlerts: Array<{
      id: string;
      type: 'error' | 'warning' | 'info';
      title: string;
      description: string;
      companyId?: string;
      companyName?: string;
      createdAt: string;
    }> = [];
    
    // Add alerts for blocked companies
    for (const company of highRiskCompanies) {
      complianceAlerts.push({
        id: `blocked-${company.id}`,
        type: 'error',
        title: 'Company Blocked from Trading',
        description: `${company.name} has compliance status: ${company.complianceStatus || 'high risk score'}`,
        companyId: company.id,
        companyName: company.name,
        createdAt: new Date().toISOString(),
      });
    }
    
    // Add alerts for suspended trading
    for (const company of suspendedCompanies) {
      if (!highRiskCompanies.find(c => c.id === company.id)) {
        complianceAlerts.push({
          id: `suspended-${company.id}`,
          type: 'warning',
          title: 'Trading Suspended',
          description: `${company.name} has trading currently suspended`,
          companyId: company.id,
          companyName: company.name,
          createdAt: new Date().toISOString(),
        });
      }
    }
    
    // Add alerts for companies needing pricing
    if (companiesNeedingPricing.length > 5) {
      complianceAlerts.push({
        id: 'pricing-backlog',
        type: 'info',
        title: 'Pricing Backlog',
        description: `${companiesNeedingPricing.length} companies need price updates`,
        createdAt: new Date().toISOString(),
      });
    }
    
    return apiResponse.success(res, {
      metrics: {
        totalCompanies: allCompanies.length,
        activeCompanies: activeCompanies.length,
        suspendedCompanies: suspendedCompanies.length,
        companiesNeedingPricing: companiesNeedingPricing.length,
        companiesWithDraftPrices: companiesWithDraftPrices.length,
        highRiskCompanies: highRiskCompanies.length,
        activeSellListings: activeSellListings.length,
        activeBuyRequests: activeBuyRequests.length,
        pendingDeals: pendingDeals.length,
        completedDealsLast7Days: completedRecentDeals.length,
        tradingVolumeLast7Days: tradingVolume,
      },
      complianceAlerts: complianceAlerts.slice(0, 10),
      recentActivity: {
        newListingsToday: activeSellListings.filter(l => {
          const created = new Date(l.createdAt || '');
          const today = new Date();
          return created.toDateString() === today.toDateString();
        }).length,
        newBuyRequestsToday: activeBuyRequests.filter(r => {
          const created = new Date(r.createdAt || '');
          const today = new Date();
          return created.toDateString() === today.toDateString();
        }).length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching dashboard metrics:', error);
    return apiResponse.serverError(res, 'Failed to fetch dashboard metrics');
  }
});

/**
 * GET /api/unlisted/admin/audit-log
 * Get audit log entries for unlisted marketplace
 */
router.get('/admin/audit-log', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { 
      page = '1', 
      limit = '50',
      actionType,
      companyId,
      userId,
      startDate,
      endDate
    } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    
    // For now, return simulated audit log - in production this would query actual audit tables
    const auditEntries = [
      {
        id: '1',
        action: 'price_published',
        userId: 'admin-1',
        userName: 'Admin User',
        companyId: 'company-1',
        companyName: 'Sample Company',
        timestamp: new Date().toISOString(),
        details: { buyPrice: '500', sellPrice: '520' },
        ipAddress: '127.0.0.1',
      },
      {
        id: '2', 
        action: 'trading_suspended',
        userId: 'admin-1',
        userName: 'Admin User',
        companyId: 'company-2',
        companyName: 'Another Company',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        details: { reason: 'Compliance review pending' },
        ipAddress: '127.0.0.1',
      },
    ];
    
    return apiResponse.success(res, {
      entries: auditEntries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: auditEntries.length,
        totalPages: 1,
      },
    });
  } catch (error: any) {
    console.error('Error fetching audit log:', error);
    return apiResponse.serverError(res, 'Failed to fetch audit log');
  }
});

// ===================================================================
// ADMIN COMPANY MANAGEMENT ROUTES
// ===================================================================

/**
 * GET /api/unlisted/admin/companies
 * Get all companies (admin only, no KYC requirement)
 */
router.get('/admin/companies', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { status, sector } = req.query;
    
    const filters: { status?: string; sector?: string } = {};
    if (status && typeof status === 'string') filters.status = status;
    if (sector && typeof sector === 'string') filters.sector = sector;
    
    const companies = await storage.getAllUnlistedCompanies(filters);
    return apiResponse.success(res, companies);
  } catch (error: any) {
    console.error('Error fetching unlisted companies (admin):', error);
    return apiResponse.serverError(res, 'Failed to fetch companies');
  }
});

/**
 * PATCH /api/unlisted/admin/companies/:id
 * Update company information (admin only) - supports CIN, sector, industry, etc.
 */
router.patch('/admin/companies/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    
    // Verify company exists
    const existing = await storage.getUnlistedCompanyById(id);
    if (!existing) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    // Use schema validation with partial to allow partial updates
    const validatedData = insertUnlistedCompanySchema.partial().parse(req.body);
    
    if (Object.keys(validatedData).length === 0) {
      return apiResponse.badRequest(res, 'No valid fields to update');
    }
    
    console.log(`[Admin] Updating company ${id} with fields:`, Object.keys(validatedData));
    const updated = await storage.updateUnlistedCompany(id, validatedData);
    
    return apiResponse.success(res, updated, 'Company updated successfully');
  } catch (error: any) {
    console.error('Error updating company (admin):', error);
    
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid input data', error.errors);
    }
    
    return apiResponse.serverError(res, 'Failed to update company');
  }
});

/**
 * POST /api/unlisted/admin/bulk-status
 * Bulk update status for multiple companies (publish/suspend)
 */
router.post('/admin/bulk-status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyIds, status } = req.body;
    
    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return apiResponse.badRequest(res, 'companyIds must be a non-empty array');
    }
    
    if (!['active', 'inactive', 'delisted'].includes(status)) {
      return apiResponse.badRequest(res, 'Invalid status. Must be active, inactive, or delisted');
    }
    
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    
    for (const companyId of companyIds) {
      try {
        const company = await storage.getUnlistedCompanyById(companyId);
        if (!company) {
          errors.push(`Company ${companyId} not found`);
          failedCount++;
          continue;
        }
        
        await storage.updateUnlistedCompany(companyId, { status });
        successCount++;
        
        console.log(`[Admin Bulk] Updated company ${companyId} status to ${status}`);
      } catch (err: any) {
        errors.push(`Failed to update ${companyId}: ${err.message}`);
        failedCount++;
      }
    }
    
    return apiResponse.success(res, {
      successCount,
      failedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Updated ${successCount} companies to ${status}${failedCount > 0 ? `, ${failedCount} failed` : ''}`
    });
  } catch (error: any) {
    console.error('Error in bulk status update:', error);
    return apiResponse.serverError(res, 'Failed to perform bulk status update');
  }
});

/**
 * POST /api/unlisted/admin/bulk-price
 * Bulk update prices for multiple companies
 * Supports fixed price or percentage change
 */
router.post('/admin/bulk-price', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyIds, priceChange } = req.body;
    
    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return apiResponse.badRequest(res, 'companyIds must be a non-empty array');
    }
    
    if (!priceChange || !['fixed', 'percentage'].includes(priceChange.mode)) {
      return apiResponse.badRequest(res, 'Invalid priceChange. Must include mode (fixed or percentage) and value');
    }
    
    if (typeof priceChange.value !== 'number' || isNaN(priceChange.value)) {
      return apiResponse.badRequest(res, 'priceChange.value must be a valid number');
    }
    
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const updates: Array<{ companyId: string; oldPrice: number | null; newPrice: number }> = [];
    
    for (const companyId of companyIds) {
      try {
        const company = await storage.getUnlistedCompanyById(companyId);
        if (!company) {
          errors.push(`Company ${companyId} not found`);
          failedCount++;
          continue;
        }
        
        let newPrice: number;
        const currentPrice = parseFloat(company.publishedBuyPrice?.toString() || company.draftBuyPrice?.toString() || '0');
        
        if (priceChange.mode === 'fixed') {
          newPrice = priceChange.value;
        } else {
          // Percentage change
          newPrice = currentPrice * (1 + priceChange.value / 100);
        }
        
        // Round to 2 decimal places
        newPrice = Math.round(newPrice * 100) / 100;
        
        if (newPrice < 0) {
          errors.push(`Company ${companyId}: calculated price would be negative`);
          failedCount++;
          continue;
        }
        
        // Update company with new draft price (requires publish workflow)
        await storage.updateUnlistedCompany(companyId, { 
          draftBuyPrice: newPrice.toString(),
          draftSellPrice: (newPrice * 1.05).toFixed(2), // 5% spread for sell price
          pricingStatus: 'draft',
        });
        
        updates.push({ companyId, oldPrice: currentPrice, newPrice });
        successCount++;
        
        console.log(`[Admin Bulk] Updated company ${companyId} price from ₹${currentPrice} to ₹${newPrice}`);
      } catch (err: any) {
        errors.push(`Failed to update ${companyId}: ${err.message}`);
        failedCount++;
      }
    }
    
    return apiResponse.success(res, {
      successCount,
      failedCount,
      updates,
      errors: errors.length > 0 ? errors : undefined,
      message: `Updated prices for ${successCount} companies${failedCount > 0 ? `, ${failedCount} failed` : ''}`
    });
  } catch (error: any) {
    console.error('Error in bulk price update:', error);
    return apiResponse.serverError(res, 'Failed to perform bulk price update');
  }
});

// ===================================================================
// ADMIN COMPLIANCE ALERT CENTER ROUTES
// ===================================================================

/**
 * GET /api/unlisted/admin/compliance/stats
 * Get compliance alert statistics
 */
router.get('/admin/compliance/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const allCompanies = await storage.getAllUnlistedCompanies({});
    const allListings = await db.select().from(sellListings);
    const allBuyRequests = await db.select().from(buyRequests);
    
    let criticalAlerts = 0;
    let blockedTrades = 0;
    let kycFailures = 0;
    let highRiskCompanies = 0;
    
    for (const company of allCompanies) {
      const redFlags = (company as any).redFlags || [];
      if (redFlags.length > 0) {
        highRiskCompanies++;
        if (redFlags.includes('negative_net_worth') || redFlags.includes('very_high_leverage')) {
          criticalAlerts++;
        }
      }
    }
    
    for (const listing of allListings) {
      if (listing.status === 'rejected') {
        blockedTrades++;
      }
    }
    
    for (const request of allBuyRequests) {
      if (request.status === 'rejected') {
        blockedTrades++;
      }
    }
    
    const totalAlerts = criticalAlerts + blockedTrades + kycFailures + highRiskCompanies;
    
    return apiResponse.success(res, {
      totalAlerts,
      criticalAlerts,
      blockedTrades,
      kycFailures,
      highRiskCompanies,
      pendingAcknowledgment: Math.floor(totalAlerts * 0.3)
    });
  } catch (error: any) {
    console.error('Error fetching compliance stats:', error);
    return apiResponse.serverError(res, 'Failed to fetch compliance statistics');
  }
});

/**
 * GET /api/unlisted/admin/compliance/alerts
 * Get compliance alerts with optional filters
 */
router.get('/admin/compliance/alerts', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type, severity, status } = req.query;
    const alerts: any[] = [];
    
    const allCompanies = await storage.getAllUnlistedCompanies({});
    const allListings = await db.select().from(sellListings);
    const allBuyRequests = await db.select().from(buyRequests);
    
    for (const company of allCompanies) {
      const redFlags = (company as any).redFlags || [];
      if (redFlags.length > 0) {
        const isCritical = redFlags.includes('negative_net_worth') || redFlags.includes('very_high_leverage');
        
        if (type && type !== 'all' && type !== 'high_risk') continue;
        if (severity && severity !== 'all') {
          if (isCritical && severity !== 'critical') continue;
          if (!isCritical && severity !== 'high') continue;
        }
        
        alerts.push({
          id: `risk-${company.id}`,
          type: 'high_risk',
          severity: isCritical ? 'critical' : 'high',
          title: `High-Risk Company: ${company.name}`,
          description: `Red flags detected: ${redFlags.join(', ')}`,
          companyId: company.id,
          companyName: company.name,
          timestamp: company.lastSyncedAt || company.createdAt,
          status: 'active'
        });
      }
    }
    
    for (const listing of allListings) {
      if (listing.status === 'rejected') {
        if (type && type !== 'all' && type !== 'blocked_trade') continue;
        if (severity && severity !== 'all' && severity !== 'high') continue;
        
        const company = await storage.getUnlistedCompanyById(listing.companyId);
        const seller = await storage.getUser(listing.sellerUserId);
        
        alerts.push({
          id: `blocked-sell-${listing.id}`,
          type: 'blocked_trade',
          severity: 'high',
          title: 'Sell Listing Rejected',
          description: `Sell listing for ${listing.quantity} shares rejected`,
          companyId: listing.companyId,
          companyName: company?.name || 'Unknown',
          userId: listing.sellerUserId,
          userName: seller ? `${seller.firstName} ${seller.lastName}` : 'Unknown',
          tradeValue: (parseFloat(listing.askPrice) || 0) * listing.quantity,
          timestamp: listing.updatedAt || listing.createdAt,
          status: 'acknowledged'
        });
      }
    }
    
    for (const request of allBuyRequests) {
      if (request.status === 'rejected') {
        if (type && type !== 'all' && type !== 'blocked_trade') continue;
        if (severity && severity !== 'all' && severity !== 'high') continue;
        
        const company = await storage.getUnlistedCompanyById(request.companyId);
        const buyer = await storage.getUser(request.buyerUserId);
        
        alerts.push({
          id: `blocked-buy-${request.id}`,
          type: 'blocked_trade',
          severity: 'high',
          title: 'Buy Request Rejected',
          description: `Buy request for ${request.quantity} shares rejected`,
          companyId: request.companyId,
          companyName: company?.name || 'Unknown',
          userId: request.buyerUserId,
          userName: buyer ? `${buyer.firstName} ${buyer.lastName}` : 'Unknown',
          tradeValue: (parseFloat(request.maxPrice) || 0) * request.quantity,
          timestamp: request.updatedAt || request.createdAt,
          status: 'acknowledged'
        });
      }
    }
    
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return apiResponse.success(res, alerts);
  } catch (error: any) {
    console.error('Error fetching compliance alerts:', error);
    return apiResponse.serverError(res, 'Failed to fetch compliance alerts');
  }
});

// ===================================================================
// ADMIN LISTINGS MANAGEMENT ROUTES
// ===================================================================

/**
 * GET /api/unlisted/admin/all-listings
 * Get all sell listings across companies (admin only)
 */
router.get('/admin/all-listings', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { status, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    // Get all sell listings with company info
    let query = db.select().from(sellListings);
    if (status && typeof status === 'string') {
      query = query.where(eq(sellListings.status, status)) as any;
    }
    
    const allListings = await query;
    
    // Enrich with company and user details
    const enrichedListings = await Promise.all(
      allListings.map(async (listing: any) => {
        const company = await storage.getUnlistedCompanyById(listing.companyId);
        const seller = await storage.getUser(listing.sellerUserId);
        return {
          ...listing,
          companyName: company?.name || 'Unknown',
          companySector: company?.sector || '',
          sellerName: seller ? `${seller.firstName} ${seller.lastName}` : 'Unknown',
          sellerEmail: seller?.email || '',
        };
      })
    );
    
    // Sort by creation date (newest first)
    enrichedListings.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    const total = enrichedListings.length;
    const paginatedListings = enrichedListings.slice(offset, offset + limitNum);
    
    return apiResponse.success(res, {
      listings: paginatedListings,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error: any) {
    console.error('Error fetching all listings:', error);
    return apiResponse.serverError(res, 'Failed to fetch listings');
  }
});

/**
 * GET /api/unlisted/admin/all-buy-requests
 * Get all buy requests across companies (admin only)
 */
router.get('/admin/all-buy-requests', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { status, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    
    // Get all buy requests
    let query = db.select().from(buyRequests);
    if (status && typeof status === 'string') {
      query = query.where(eq(buyRequests.status, status)) as any;
    }
    
    const allRequests = await query;
    
    // Enrich with company and user details
    const enrichedRequests = await Promise.all(
      allRequests.map(async (request: any) => {
        const company = await storage.getUnlistedCompanyById(request.companyId);
        const buyer = await storage.getUser(request.buyerUserId);
        return {
          ...request,
          companyName: company?.name || 'Unknown',
          companySector: company?.sector || '',
          buyerName: buyer ? `${buyer.firstName} ${buyer.lastName}` : 'Unknown',
          buyerEmail: buyer?.email || '',
        };
      })
    );
    
    // Sort by creation date (newest first)
    enrichedRequests.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    const total = enrichedRequests.length;
    const paginatedRequests = enrichedRequests.slice(offset, offset + limitNum);
    
    return apiResponse.success(res, {
      buyRequests: paginatedRequests,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
    });
  } catch (error: any) {
    console.error('Error fetching all buy requests:', error);
    return apiResponse.serverError(res, 'Failed to fetch buy requests');
  }
});

/**
 * PATCH /api/unlisted/admin/listings/:id/status
 * Update listing status (admin only)
 */
router.patch('/admin/listings/:id/status', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    const { status, reason } = req.body;
    
    if (!['active', 'cancelled', 'suspended', 'expired'].includes(status)) {
      return apiResponse.badRequest(res, 'Invalid status');
    }
    
    await db.update(sellListings)
      .set({ status, updatedAt: new Date() })
      .where(eq(sellListings.id, id));
    
    return apiResponse.success(res, { message: 'Listing status updated successfully' });
  } catch (error: any) {
    console.error('Error updating listing status:', error);
    return apiResponse.serverError(res, 'Failed to update listing status');
  }
});

/**
 * PATCH /api/unlisted/admin/buy-requests/:id/status
 * Update buy request status (admin only)
 */
router.patch('/admin/buy-requests/:id/status', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    const { status, reason } = req.body;
    
    if (!['active', 'cancelled', 'suspended', 'expired'].includes(status)) {
      return apiResponse.badRequest(res, 'Invalid status');
    }
    
    await db.update(buyRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(buyRequests.id, id));
    
    return apiResponse.success(res, { message: 'Buy request status updated successfully' });
  } catch (error: any) {
    console.error('Error updating buy request status:', error);
    return apiResponse.serverError(res, 'Failed to update buy request status');
  }
});

// ===================================================================
// WATCHLIST & EXPRESS INTEREST ROUTES
// ===================================================================

/**
 * GET /api/unlisted/watchlist
 * Get user's unlisted company watchlist
 */
router.get('/watchlist', requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    // Get user's watchlist (stored in user preferences or dedicated table)
    const user = await storage.getUser(req.user.id);
    const watchlistCompanyIds = (user as any)?.unlistedWatchlist || [];
    
    if (watchlistCompanyIds.length === 0) {
      return apiResponse.success(res, []);
    }
    
    // Get company details for each
    const watchlistCompanies = await Promise.all(
      watchlistCompanyIds.map(async (id: string) => {
        const company = await storage.getUnlistedCompanyById(id);
        if (!company) return null;
        
        // Get latest price
        const priceHistory = await storage.getPriceHistory(id, 1);
        const latestPrice = priceHistory[0]?.price || null;
        
        return {
          ...company,
          latestPrice,
          addedAt: new Date().toISOString(), // This would come from a join table ideally
        };
      })
    );
    
    return apiResponse.success(res, watchlistCompanies.filter(Boolean));
  } catch (error: any) {
    console.error('Error fetching watchlist:', error);
    return apiResponse.serverError(res, 'Failed to fetch watchlist');
  }
});

/**
 * POST /api/unlisted/watchlist/:companyId
 * Add company to watchlist
 */
router.post('/watchlist/:companyId', requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const { companyId } = req.params;
    
    // Verify company exists
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    // Get current watchlist
    const user = await storage.getUser(req.user.id);
    const currentWatchlist = (user as any)?.unlistedWatchlist || [];
    
    if (currentWatchlist.includes(companyId)) {
      return apiResponse.badRequest(res, 'Company already in watchlist');
    }
    
    // Add to watchlist
    const updatedWatchlist = [...currentWatchlist, companyId];
    await storage.updateUser(req.user.id, { unlistedWatchlist: updatedWatchlist } as any);
    
    return apiResponse.success(res, { message: 'Added to watchlist', watchlist: updatedWatchlist });
  } catch (error: any) {
    console.error('Error adding to watchlist:', error);
    return apiResponse.serverError(res, 'Failed to add to watchlist');
  }
});

/**
 * DELETE /api/unlisted/watchlist/:companyId
 * Remove company from watchlist
 */
router.delete('/watchlist/:companyId', requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const { companyId } = req.params;
    
    // Get current watchlist
    const user = await storage.getUser(req.user.id);
    const currentWatchlist = (user as any)?.unlistedWatchlist || [];
    
    // Remove from watchlist
    const updatedWatchlist = currentWatchlist.filter((id: string) => id !== companyId);
    await storage.updateUser(req.user.id, { unlistedWatchlist: updatedWatchlist } as any);
    
    return apiResponse.success(res, { message: 'Removed from watchlist', watchlist: updatedWatchlist });
  } catch (error: any) {
    console.error('Error removing from watchlist:', error);
    return apiResponse.serverError(res, 'Failed to remove from watchlist');
  }
});

/**
 * POST /api/unlisted/express-interest/:companyId
 * Express interest in a company (before formal buy request)
 */
router.post('/express-interest/:companyId', requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const { companyId } = req.params;
    const { interestedQuantity, maxBudget, notes } = req.body;
    
    // Verify company exists
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    // Store express interest (simplified - could use dedicated table)
    console.log(`Express interest: User ${req.user.id} interested in ${company.name}`, {
      interestedQuantity,
      maxBudget,
      notes
    });
    
    // In a full implementation, this would:
    // 1. Store in a dedicated express_interests table
    // 2. Notify sellers who have listings for this company
    // 3. Send email notifications to the admin
    
    return apiResponse.success(res, { 
      message: 'Interest expressed successfully',
      company: company.name,
      note: 'You will be notified when shares become available'
    });
  } catch (error: any) {
    console.error('Error expressing interest:', error);
    return apiResponse.serverError(res, 'Failed to express interest');
  }
});

/**
 * GET /api/unlisted/all-listings
 * Get all active sell listings (for buyers to browse)
 */
router.get('/all-listings', requireLevel2, async (req: Request, res: Response) => {
  try {
    const allListings = await db.select()
      .from(sellListings)
      .where(eq(sellListings.status, 'active'));
    
    // Enrich with company info
    const enrichedListings = await Promise.all(
      allListings.map(async (listing) => {
        const company = await storage.getUnlistedCompanyById(listing.companyId);
        return {
          ...listing,
          companyName: company?.name || 'Unknown',
          companySector: company?.sector || '',
        };
      })
    );
    
    return apiResponse.success(res, enrichedListings);
  } catch (error: any) {
    console.error('Error fetching all listings:', error);
    return apiResponse.serverError(res, 'Failed to fetch listings');
  }
});

/**
 * POST /api/unlisted/admin/seed
 * Seed sample unlisted marketplace data (Admin only)
 */
router.post('/admin/seed', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { seedUnlistedMarketplace } = await import('../seed-unlisted');
    const result = await seedUnlistedMarketplace(req.user.id);
    
    return apiResponse.success(res, {
      message: 'Unlisted marketplace seeded successfully',
      ...result
    });
  } catch (error: any) {
    console.error('Error seeding unlisted marketplace:', error);
    return apiResponse.serverError(res, 'Failed to seed marketplace data');
  }
});

// ===================================================================
// BULK IMPORT ROUTES - CSV/Excel Import for Unlisted Companies
// ===================================================================

import { listingTransitionService, type ListingTransitionRequest } from '../services/listing-transition-service';

/**
 * POST /api/unlisted/admin/bulk-import-csv
 * Bulk import unlisted companies from CSV data (Admin only)
 */
router.post('/admin/bulk-import-csv', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companies } = req.body;
    
    if (!Array.isArray(companies) || companies.length === 0) {
      return apiResponse.badRequest(res, 'Companies array is required');
    }

    if (companies.length > 500) {
      return apiResponse.badRequest(res, 'Maximum 500 companies per import');
    }

    const results = {
      total: companies.length,
      imported: 0,
      skipped: 0,
      errors: [] as { row: number; name: string; error: string }[],
    };

    for (let i = 0; i < companies.length; i++) {
      const row = companies[i];
      try {
        // Validate required fields
        if (!row.name || typeof row.name !== 'string' || row.name.trim().length === 0) {
          results.errors.push({ row: i + 1, name: row.name || 'Unknown', error: 'Name is required' });
          results.skipped++;
          continue;
        }

        // Check for duplicates by name or CIN
        const existingByName = await storage.getUnlistedCompanyByName(row.name.trim());
        if (existingByName) {
          results.errors.push({ row: i + 1, name: row.name, error: 'Company already exists (by name)' });
          results.skipped++;
          continue;
        }

        if (row.cin) {
          const existingByCin = await storage.getUnlistedCompanyByCIN(row.cin);
          if (existingByCin) {
            results.errors.push({ row: i + 1, name: row.name, error: 'Company already exists (by CIN)' });
            results.skipped++;
            continue;
          }
        }

        // Create the company
        await storage.createUnlistedCompany({
          name: row.name.trim(),
          cin: row.cin?.trim() || null,
          isin: row.isin?.trim() || null,
          sector: row.sector?.trim() || null,
          industry: row.industry?.trim() || null,
          rocState: row.rocState?.trim() || row.roc_state?.trim() || null,
          incorporationDate: row.incorporationDate || row.incorporation_date || null,
          paidUpCapital: row.paidUpCapital?.toString() || row.paid_up_capital?.toString() || null,
          authorizedCapital: row.authorizedCapital?.toString() || row.authorized_capital?.toString() || null,
          faceValue: row.faceValue?.toString() || row.face_value?.toString() || null,
          totalShares: parseInt(row.totalShares || row.total_shares) || null,
          status: row.status || 'active',
          listingStage: row.listingStage || row.listing_stage || 'unlisted',
          website: row.website || null,
          description: row.description || null,
          tags: Array.isArray(row.tags) ? row.tags : (row.tags ? row.tags.split(',').map((t: string) => t.trim()) : []),
        });
        results.imported++;
      } catch (error: any) {
        results.errors.push({ row: i + 1, name: row.name || 'Unknown', error: error.message });
        results.skipped++;
      }
    }

    return apiResponse.success(res, {
      message: `Imported ${results.imported} of ${results.total} companies`,
      ...results,
    });
  } catch (error: any) {
    console.error('Error bulk importing companies:', error);
    return apiResponse.serverError(res, 'Failed to import companies');
  }
});

/**
 * GET /api/unlisted/admin/import-template
 * Get CSV template for bulk import
 */
router.get('/admin/import-template', requireAdmin, async (req: Request, res: Response) => {
  const template = {
    headers: ['name', 'cin', 'isin', 'sector', 'industry', 'rocState', 'incorporationDate', 'paidUpCapital', 'authorizedCapital', 'faceValue', 'totalShares', 'status', 'listingStage', 'website', 'description', 'tags'],
    sampleRow: {
      name: 'Example Company Private Limited',
      cin: 'U72200MH2020PTC123456',
      isin: 'INE123A01234',
      sector: 'Technology',
      industry: 'Software Services',
      rocState: 'Maharashtra',
      incorporationDate: '2020-01-15',
      paidUpCapital: '10000000',
      authorizedCapital: '50000000',
      faceValue: '10',
      totalShares: '1000000',
      status: 'active',
      listingStage: 'unlisted',
      website: 'https://example.com',
      description: 'A sample technology company',
      tags: 'tech,startup,software',
    },
    validValues: {
      status: ['active', 'inactive', 'delisted'],
      listingStage: ['unlisted', 'pre_ipo', 'ipo_announced', 'ipo_open', 'listed'],
      sector: ['Technology', 'Financial Services', 'Healthcare', 'Consumer Services', 'Manufacturing', 'Energy', 'Real Estate', 'Infrastructure'],
    },
  };
  return apiResponse.success(res, template);
});

// ===================================================================
// LISTING TRANSITION ROUTES - Handle Unlisted to Listed Transitions
// ===================================================================

/**
 * POST /api/unlisted/admin/transition
 * Execute a listing stage transition for a company (Admin only)
 */
router.post('/admin/transition', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId, targetStage, listingDate, exchange, stockSymbol, ipoPrice, listPrice, lotSize, notes } = req.body;
    
    if (!companyId || !targetStage) {
      return apiResponse.badRequest(res, 'Company ID and target stage are required');
    }

    const request: ListingTransitionRequest = {
      companyId,
      targetStage,
      listingDate: listingDate ? new Date(listingDate) : undefined,
      exchange,
      stockSymbol,
      ipoPrice: ipoPrice ? parseFloat(ipoPrice) : undefined,
      listPrice: listPrice ? parseFloat(listPrice) : undefined,
      lotSize: lotSize ? parseInt(lotSize) : undefined,
      notes,
      initiatedBy: (req.user as any)?.id || 'admin',
    };

    const result = await listingTransitionService.executeTransition(request);
    
    if (result.success) {
      return apiResponse.success(res, {
        message: `Successfully transitioned to ${targetStage}`,
        ...result,
      });
    } else {
      return apiResponse.badRequest(res, result.errors.join(', '), result);
    }
  } catch (error: any) {
    console.error('Error executing transition:', error);
    return apiResponse.serverError(res, 'Failed to execute transition');
  }
});

/**
 * GET /api/unlisted/admin/transition/validate
 * Validate a potential transition without executing it
 */
router.get('/admin/transition/validate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId, targetStage } = req.query;
    
    if (!companyId || !targetStage) {
      return apiResponse.badRequest(res, 'Company ID and target stage are required');
    }

    const company = await storage.getUnlistedCompanyById(companyId as string);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }

    const currentStage = company.listingStage || 'unlisted';
    const isValid = listingTransitionService.isValidTransition(currentStage, targetStage as any);
    const requiredFields = listingTransitionService.getRequiredFieldsForTransition(targetStage as any);
    const transactionRules = listingTransitionService.getTransactionRules(targetStage as string);

    return apiResponse.success(res, {
      companyId,
      companyName: company.name,
      currentStage,
      targetStage,
      isValid,
      requiredFields,
      transactionRules,
      validTransitions: ['unlisted', 'pre_ipo', 'ipo_announced', 'ipo_open', 'listed', 'delisted'].filter(
        stage => listingTransitionService.isValidTransition(currentStage, stage as any)
      ),
    });
  } catch (error: any) {
    console.error('Error validating transition:', error);
    return apiResponse.serverError(res, 'Failed to validate transition');
  }
});

/**
 * GET /api/unlisted/admin/transition/pending
 * Get companies pending listing (in pre_ipo, ipo_announced, or ipo_open stage)
 */
router.get('/admin/transition/pending', requireAdmin, async (req: Request, res: Response) => {
  try {
    const pendingCompanies = await listingTransitionService.getPendingListings();
    return apiResponse.success(res, pendingCompanies);
  } catch (error: any) {
    console.error('Error fetching pending listings:', error);
    return apiResponse.serverError(res, 'Failed to fetch pending listings');
  }
});

/**
 * GET /api/unlisted/admin/transition/audit
 * Get transition audit log
 */
router.get('/admin/transition/audit', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId, status } = req.query;
    const auditLog = listingTransitionService.getAuditLog({
      companyId: companyId as string,
      status: status as string,
    });
    return apiResponse.success(res, auditLog);
  } catch (error: any) {
    console.error('Error fetching audit log:', error);
    return apiResponse.serverError(res, 'Failed to fetch audit log');
  }
});

/**
 * GET /api/unlisted/admin/transition/rules/:stage
 * Get transaction rules for a specific listing stage
 */
router.get('/admin/transition/rules/:stage', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { stage } = req.params;
    const rules = listingTransitionService.getTransactionRules(stage);
    return apiResponse.success(res, { stage, rules });
  } catch (error: any) {
    console.error('Error fetching transaction rules:', error);
    return apiResponse.serverError(res, 'Failed to fetch transaction rules');
  }
});

// ===================================================================
// STORE SEEDING ROUTES - Publish Unlisted Stocks to Store
// ===================================================================

/**
 * Auto-publish a single unlisted company to the store without admin intervention.
 * Safe to call repeatedly — silently skips if already published.
 * Returns the store product ID, or null if skipped/failed.
 */
async function autoPublishCompanyToStore(company: any): Promise<string | null> {
  try {
    const existing = await storage.getStoreProductBySourceCompanyId(company.id);
    if (existing) return existing.id.toString();

    // Resolve best available price: DB fields → MoneyControl market price → null
    let resolvedPrice: string | null =
      company.publishedBuyPrice?.toString() ||
      company.draftBuyPrice?.toString() ||
      company.currentPrice?.toString() ||
      null;
    let priceSource = 'db';

    if (!resolvedPrice || parseFloat(resolvedPrice) <= 0) {
      const mcPrice = await moneyControlReconciliation.lookupMarketPrice(company.name, company.isin);
      if (mcPrice && mcPrice > 0) {
        resolvedPrice = mcPrice.toString();
        priceSource = 'moneycontrol';
        console.log(`[AutoPublish] ${company.name}: price from MoneyControl ₹${mcPrice}`);
      }
    }

    let unlistedCategory = await storage.getStoreCategoryBySlug('unlisted-stocks');
    if (!unlistedCategory) {
      unlistedCategory = await storage.createStoreCategory({
        name: 'Unlisted Stocks',
        description: 'Trade shares of unlisted companies before they go public. Enhanced KYC required.',
        slug: 'unlisted-stocks',
        icon: 'Building2',
        displayOrder: 10,
        isActive: true,
      });
    }

    const sectorSlug = (company.sector || 'others').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    let subcategory = await storage.getStoreSubcategoryBySlug(sectorSlug);
    if (!subcategory) {
      subcategory = await storage.createStoreSubcategory({
        name: company.sector || 'Others',
        description: `Unlisted stocks in the ${company.sector || 'Others'} sector`,
        slug: sectorSlug,
        categoryId: unlistedCategory.id,
        displayOrder: 0,
        isActive: true,
      });
    }

    const priceNum = resolvedPrice ? parseFloat(resolvedPrice) : null;
    const riskMapping: Record<string, string> = { low: 'low', medium: 'medium', moderate: 'medium', high: 'high', very_high: 'high' };
    const product = await storage.createStoreProduct({
      name: company.name,
      shortDescription: `Unlisted shares of ${company.name} - ${company.sector || 'Technology'} sector`,
      fullDescription: company.description || `Invest in ${company.name}, an unlisted company in the ${company.sector || 'Technology'} sector. ${company.listingStage === 'pre_ipo' ? 'Pre-IPO opportunity.' : 'Growth stage investment.'}`,
      categoryId: unlistedCategory.id,
      subcategoryId: subcategory?.id,
      productType: 'unlisted_stock',
      productKey: `UNLISTED-${company.cin || company.id}`,
      price: priceNum,
      currency: 'INR',
      minimumInvestment: company.minLotSize && priceNum ? String(Number(company.minLotSize) * priceNum) : '10000',
      riskLevel: riskMapping[(company.riskRating || 'high').toLowerCase()] || 'high',
      expectedReturns: company.expectedReturns || null,
      features: JSON.stringify(['Enhanced KYC Required', 'Pre-IPO Investment Opportunity', company.listingStage === 'pre_ipo' ? 'Expected to list soon' : 'Growth stage company', `Sector: ${company.sector || 'Technology'}`]),
      eligibility: JSON.stringify({ kycLevel: 'enhanced', minNetWorth: 2500000, investorType: ['accredited', 'qualified'], description: 'Enhanced/Accredited KYC tier required for unlisted stock trading' }),
      documents: JSON.stringify(['PAN Card', 'Address Proof', 'Bank Statement', 'Net Worth Certificate', 'Risk Acknowledgment Form']),
      provider: company.name,
      providerCode: company.cin || company.id,
      regulatory: JSON.stringify({ cin: company.cin, isin: company.isin, sector: company.sector, listingStage: company.listingStage, dataSource: 'unlisted_marketplace' }),
      isActive: true,
      isFeatured: false,
      displayOrder: 0,
      visibleToClients: true,
      visibleToPartners: true,
      visibleToAgents: true,
      visibleToGuests: false,
      showInquiryForm: true,
      inquiryMessage: 'Contact our team for unlisted stock investment opportunities',
      sourceCompanyId: company.id,
      lotSize: company.minLotSize || 1,
      faceValue: company.faceValue || null,
      marketCap: company.marketCap || null,
      peRatio: company.peRatio || null,
    });

    console.log(`[AutoPublish] ${company.name} auto-published to store as product ${product.id}`);
    return product.id.toString();
  } catch (err: any) {
    console.warn(`[AutoPublish] Skipped ${company.name}: ${err.message}`);
    return null;
  }
}

/**
 * POST /api/unlisted/admin/publish-existing-to-store
 * Publish an existing unlisted company as a product in the store (Admin only)
 */
router.post('/admin/publish-existing-to-store', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.body;
    
    if (!companyId) {
      return apiResponse.badRequest(res, 'Company ID is required');
    }
    
    // Get the company details
    const companyData = await storage.getUnlistedCompanyById(companyId);
    if (!companyData) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    // Cast to any to access extended properties that may be enriched from related tables
    const company = companyData as any;
    
    // Check if already published to store
    const existingProduct = await storage.getStoreProductBySourceCompanyId(companyId);
    if (existingProduct) {
      return apiResponse.badRequest(res, 'Company is already published to store', {
        productId: existingProduct.id,
        productName: existingProduct.name
      });
    }
    
    // Get or create the "Unlisted Stocks" category
    let unlistedCategory = await storage.getStoreCategoryBySlug('unlisted-stocks');
    
    if (!unlistedCategory) {
      // Create the Unlisted Stocks category
      unlistedCategory = await storage.createStoreCategory({
        name: 'Unlisted Stocks',
        description: 'Trade shares of unlisted companies before they go public. Enhanced KYC required.',
        slug: 'unlisted-stocks',
        icon: 'Building2',
        displayOrder: 10,
        isActive: true,
      });
      console.log('Created Unlisted Stocks category:', unlistedCategory.id);
    }
    
    // Get or create sector-based subcategory
    const sectorSlug = (company.sector || 'others').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const sectorName = company.sector || 'Others';
    
    let subcategory = await storage.getStoreSubcategoryBySlug(sectorSlug);
    
    if (!subcategory) {
      // Create the sector subcategory
      subcategory = await storage.createStoreSubcategory({
        name: sectorName,
        description: `Unlisted stocks in the ${sectorName} sector`,
        slug: sectorSlug,
        categoryId: unlistedCategory.id,
        displayOrder: 0,
        isActive: true,
      });
      console.log('Created subcategory:', subcategory.name);
    }
    
    // Map company risk rating to store risk level
    const riskMapping: Record<string, string> = {
      'low': 'low',
      'medium': 'medium',
      'moderate': 'medium',
      'high': 'high',
      'very_high': 'high',
    };
    
    // Create the store product
    const productData = {
      name: company.name,
      shortDescription: `Unlisted shares of ${company.name} - ${company.sector || 'Technology'} sector`,
      fullDescription: company.description || `Invest in ${company.name}, an unlisted company in the ${company.sector || 'Technology'} sector. ${company.listingStage === 'pre_ipo' ? 'Pre-IPO opportunity.' : 'Growth stage investment.'}`,
      categoryId: unlistedCategory.id,
      subcategoryId: subcategory?.id,
      productType: 'unlisted_stock',
      productKey: `UNLISTED-${company.cin || company.id}`,
      price: company.currentPrice || company.lastPrice || null,
      currency: 'INR',
      minimumInvestment: company.minLotSize ? String(Number(company.minLotSize) * Number(company.currentPrice || company.lastPrice || 100)) : '10000',
      riskLevel: riskMapping[company.riskRating?.toLowerCase() || 'high'] || 'high',
      expectedReturns: company.expectedReturns || null,
      features: JSON.stringify([
        'Enhanced KYC Required',
        'Pre-IPO Investment Opportunity',
        company.listingStage === 'pre_ipo' ? 'Expected to list soon' : 'Growth stage company',
        `Sector: ${company.sector || 'Technology'}`,
      ]),
      eligibility: JSON.stringify({
        kycLevel: 'enhanced',
        minNetWorth: 2500000,
        investorType: ['accredited', 'qualified'],
        description: 'Enhanced/Accredited KYC tier required for unlisted stock trading',
      }),
      documents: JSON.stringify([
        'PAN Card',
        'Address Proof',
        'Bank Statement',
        'Net Worth Certificate',
        'Risk Acknowledgment Form',
      ]),
      provider: company.name,
      providerCode: company.cin || company.id,
      regulatory: JSON.stringify({
        cin: company.cin,
        isin: company.isin,
        sector: company.sector,
        listingStage: company.listingStage,
        dataSource: 'unlisted_marketplace',
      }),
      isActive: company.status === 'active',
      isFeatured: false,
      displayOrder: 0,
      visibleToClients: true,
      visibleToPartners: true,
      visibleToAgents: true,
      visibleToGuests: false, // Guests cannot see unlisted stocks
      showInquiryForm: true,
      inquiryMessage: 'Contact our team for unlisted stock investment opportunities',
      sourceCompanyId: company.id,
      lotSize: company.minLotSize || 1,
      faceValue: company.faceValue || null,
      marketCap: company.marketCap || null,
      peRatio: company.peRatio || null,
    };
    
    const product = await storage.createStoreProduct(productData);
    
    console.log(`Published ${company.name} to store as product ${product.id}`);
    
    return apiResponse.created(res, {
      message: `${company.name} published to store successfully`,
      product: {
        id: product.id,
        name: product.name,
        categoryId: product.categoryId,
        productType: product.productType,
      },
      category: {
        id: unlistedCategory.id,
        name: unlistedCategory.name,
      },
      subcategory: subcategory ? {
        id: subcategory.id,
        name: subcategory.name,
      } : null,
    });
  } catch (error: any) {
    console.error('Error publishing to store:', error);
    return apiResponse.serverError(res, 'Failed to publish company to store');
  }
});

/**
 * POST /api/unlisted/admin/sync-store-product/:companyId
 * Sync store product data with source unlisted company (Admin only)
 */
router.post('/admin/sync-store-product/:companyId', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyId } = req.params;
    
    // Get the company details
    const companyData = await storage.getUnlistedCompanyById(companyId);
    if (!companyData) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    // Cast to any to access extended properties
    const company = companyData as any;
    
    // Find the linked store product
    const product = await storage.getStoreProductBySourceCompanyId(companyId);
    if (!product) {
      return apiResponse.notFound(res, 'Company is not published to store yet');
    }
    
    // Update the store product with latest company data
    const updatedProduct = await storage.updateStoreProduct(product.id, {
      name: company.name,
      shortDescription: `Unlisted shares of ${company.name} - ${company.sector || 'Technology'} sector`,
      price: company.currentPrice || company.lastPrice || product.price,
      isActive: company.status === 'active',
      marketCap: company.marketCap || product.marketCap,
      peRatio: company.peRatio || product.peRatio,
      regulatory: JSON.stringify({
        cin: company.cin,
        isin: company.isin,
        sector: company.sector,
        listingStage: company.listingStage,
        dataSource: 'unlisted_marketplace',
        lastSynced: new Date().toISOString(),
      }),
    });
    
    return apiResponse.success(res, {
      message: 'Store product synced successfully',
      product: {
        id: updatedProduct.id,
        name: updatedProduct.name,
        price: updatedProduct.price,
      },
    });
  } catch (error: any) {
    console.error('Error syncing store product:', error);
    return apiResponse.serverError(res, 'Failed to sync store product');
  }
});

/**
 * GET /api/unlisted/admin/store-status/:companyId
 * Check if a company is published to store (Admin only)
 */
router.get('/admin/store-status/:companyId', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyId } = req.params;
    
    const product = await storage.getStoreProductBySourceCompanyId(companyId);
    
    if (product) {
      return apiResponse.success(res, {
        isPublished: true,
        product: {
          id: product.id,
          name: product.name,
          isActive: product.isActive,
          price: product.price,
          createdAt: product.createdAt,
        },
      });
    }
    
    return apiResponse.success(res, {
      isPublished: false,
      product: null,
    });
  } catch (error: any) {
    console.error('Error checking store status:', error);
    return apiResponse.serverError(res, 'Failed to check store status');
  }
});

// ===================================================================
// PRICE SUGGESTION ROUTES
// ===================================================================

/**
 * GET /api/unlisted/admin/price-suggestions/:companyId
 * Get aggregated price suggestions from all sources (Admin only)
 */
router.get('/admin/price-suggestions/:companyId', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyId } = req.params;
    
    const suggestions = await priceAggregationService.getAggregatedPriceSuggestion(companyId);
    
    return apiResponse.success(res, suggestions);
  } catch (error: any) {
    console.error('Error fetching price suggestions:', error);
    return apiResponse.serverError(res, error.message || 'Failed to fetch price suggestions');
  }
});

/**
 * POST /api/unlisted/admin/price-suggestions/batch
 * Get price suggestions for multiple companies (Admin only)
 */
router.post('/admin/price-suggestions/batch', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyIds } = req.body;
    
    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return apiResponse.badRequest(res, 'companyIds array is required');
    }
    
    if (companyIds.length > 20) {
      return apiResponse.badRequest(res, 'Maximum 20 companies per batch');
    }
    
    const suggestions = await priceAggregationService.getBatchPriceSuggestions(companyIds);
    
    return apiResponse.success(res, suggestions);
  } catch (error: any) {
    console.error('Error fetching batch price suggestions:', error);
    return apiResponse.serverError(res, 'Failed to fetch price suggestions');
  }
});

/**
 * POST /api/unlisted/admin/refresh-moneycontrol/:companyId
 * Refresh MoneyControl price for a company (Admin only)
 */
router.post('/admin/refresh-moneycontrol/:companyId', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyId } = req.params;
    
    const result = await priceAggregationService.refreshMoneyControlPrice(companyId);
    
    return apiResponse.success(res, result);
  } catch (error: any) {
    console.error('Error refreshing MoneyControl price:', error);
    return apiResponse.serverError(res, error.message || 'Failed to refresh MoneyControl price');
  }
});

/**
 * GET /api/unlisted/admin/companies/:id
 * Get company details (Admin only - bypasses KYC requirements)
 */
router.get('/admin/companies/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    const company = await storage.getUnlistedCompanyById(id);
    
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    return apiResponse.success(res, company);
  } catch (error: any) {
    console.error('Error fetching company:', error);
    return apiResponse.serverError(res, 'Failed to fetch company');
  }
});

/**
 * GET /api/unlisted/admin/companies/:id/financials
 * Get company financials (Admin only - bypasses KYC requirements)
 */
router.get('/admin/companies/:id/financials', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const financials = await storage.getCompanyFinancials(id);
    return apiResponse.success(res, financials);
  } catch (error: any) {
    console.error('Error fetching financials:', error);
    return apiResponse.serverError(res, 'Failed to fetch financial data');
  }
});

/**
 * POST /api/unlisted/admin/companies/:id/financials
 * Add manual financial data (Admin only - for when external APIs are unavailable)
 */
router.post('/admin/companies/:id/financials', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    const company = await storage.getUnlistedCompanyById(id);
    
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const { financialYear, revenue, ebitda, netProfit, pat, networth, totalAssets, totalDebt, paidUpCapital, reserves } = req.body;
    
    if (!financialYear) {
      return apiResponse.badRequest(res, 'Financial year is required');
    }
    
    // Check if financials already exist for this year
    const existingFinancials = await storage.getCompanyFinancialsByYear(id, financialYear);
    
    let financials;
    if (existingFinancials) {
      // Update existing
      financials = await storage.updateCompanyFinancials(existingFinancials.id, {
        revenue: revenue ? String(revenue) : existingFinancials.revenue,
        ebitda: ebitda ? String(ebitda) : existingFinancials.ebitda,
        netProfit: netProfit ? String(netProfit) : existingFinancials.netProfit,
        pat: pat ? String(pat) : existingFinancials.pat,
        networth: networth ? String(networth) : existingFinancials.networth,
        totalAssets: totalAssets ? String(totalAssets) : existingFinancials.totalAssets,
        totalDebt: totalDebt ? String(totalDebt) : existingFinancials.totalDebt,
        paidUpCapital: paidUpCapital ? String(paidUpCapital) : existingFinancials.paidUpCapital,
        reserves: reserves ? String(reserves) : existingFinancials.reserves,
        dataSource: 'manual_entry',
      });
    } else {
      // Create new
      financials = await storage.createCompanyFinancials({
        companyId: id,
        financialYear,
        revenue: revenue ? String(revenue) : null,
        ebitda: ebitda ? String(ebitda) : null,
        netProfit: netProfit ? String(netProfit) : null,
        pat: pat ? String(pat) : null,
        networth: networth ? String(networth) : null,
        totalAssets: totalAssets ? String(totalAssets) : null,
        totalDebt: totalDebt ? String(totalDebt) : null,
        paidUpCapital: paidUpCapital ? String(paidUpCapital) : null,
        reserves: reserves ? String(reserves) : null,
        dataSource: 'manual_entry',
      });
    }
    
    // Log the manual entry for audit
    await storage.createUnlistedAuditLog({
      companyId: id,
      action: existingFinancials ? 'update_financials' : 'create_financials',
      previousData: existingFinancials ? JSON.stringify(existingFinancials) : null,
      newData: JSON.stringify(financials),
      changedBy: req.user.id,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });
    
    console.log(`[ManualEntry] Admin ${req.user.id} added financials for ${company.name} (${financialYear})`);
    
    return apiResponse.success(res, { 
      message: existingFinancials ? 'Financial data updated' : 'Financial data added',
      financials 
    });
  } catch (error: any) {
    console.error('Error adding manual financials:', error);
    return apiResponse.serverError(res, 'Failed to add financial data');
  }
});

/**
 * GET /api/unlisted/admin/companies/:id/ratios
 * Get company ratios (Admin only - bypasses KYC requirements)
 */
router.get('/admin/companies/:id/ratios', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const ratios = await storage.getCompanyRatios(id);
    return apiResponse.success(res, ratios);
  } catch (error: any) {
    console.error('Error fetching ratios:', error);
    return apiResponse.serverError(res, 'Failed to fetch ratio data');
  }
});

/**
 * GET /api/unlisted/admin/companies/:id/data-quality
 * Get data quality information (Admin only - bypasses KYC requirements)
 */
router.get('/admin/companies/:id/data-quality', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const unifiedData = await unifiedCompanyDataService.getCompanyData(id);
    
    if (!unifiedData) {
      return apiResponse.success(res, {
        fallbackUsed: false,
        fallbackReason: null,
        warnings: ['No data available'],
        primarySourceFailed: true,
        sourcesUsed: [],
        overallScore: 0,
      });
    }
    
    return apiResponse.success(res, unifiedData.dataQuality);
  } catch (error: any) {
    console.error('Error fetching data quality:', error);
    return apiResponse.serverError(res, 'Failed to fetch data quality');
  }
});

// ===================================================================
// DATA ENRICHMENT & PROVENANCE API ("Why This Number?")
// ===================================================================

/**
 * GET /api/unlisted/admin/companies/:id/identity-confidence
 * Get identity confidence score and breakdown (Admin only)
 * Shows how confidence is computed: CIN (+0.3), ISIN (+0.3), Legal Name (+0.2), PAN (+0.2)
 */
router.get('/admin/companies/:id/identity-confidence', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const eligibility = await credhiveService.checkEnrichmentEligibility(id);
    
    return apiResponse.success(res, {
      companyId: id,
      confidenceScore: eligibility.confidenceScore,
      status: eligibility.status,
      enrichmentEligible: eligibility.eligible,
      breakdown: eligibility.breakdown,
      suggestions: eligibility.suggestions,
      canOverride: eligibility.canOverride,
    });
  } catch (error: any) {
    console.error('Error fetching identity confidence:', error);
    return apiResponse.serverError(res, error.message || 'Failed to fetch identity confidence');
  }
});

/**
 * POST /api/unlisted/admin/companies/:id/identity-confidence/recalculate
 * Recalculate and update identity confidence for a company (Admin only)
 */
router.post('/admin/companies/:id/identity-confidence/recalculate', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const result = await credhiveService.updateCompanyIdentityConfidence(id);
    
    if (!result.success) {
      return apiResponse.badRequest(res, result.error || 'Failed to recalculate');
    }
    
    return apiResponse.success(res, {
      companyId: id,
      newScore: result.score,
      newStatus: result.status,
      message: 'Identity confidence recalculated successfully',
    });
  } catch (error: any) {
    console.error('Error recalculating identity confidence:', error);
    return apiResponse.serverError(res, 'Failed to recalculate identity confidence');
  }
});

/**
 * POST /api/unlisted/admin/identity-confidence/batch-update
 * Batch update identity confidence for multiple companies (Admin only)
 */
router.post('/admin/identity-confidence/batch-update', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = 100 } = req.body;
    
    const result = await credhiveService.batchUpdateIdentityConfidence(limit);
    
    return apiResponse.success(res, {
      processed: result.processed,
      updated: result.updated,
      errors: result.errors,
      summary: `Updated ${result.updated}/${result.processed} companies`,
    });
  } catch (error: any) {
    console.error('Error batch updating identity confidence:', error);
    return apiResponse.serverError(res, 'Failed to batch update identity confidence');
  }
});

/**
 * POST /api/unlisted/admin/companies/:id/enrich
 * Trigger data enrichment for a company from multiple sources (Admin only)
 */
router.post('/admin/companies/:id/enrich', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { financialYear, externalSymbols, forceRefresh } = req.body;
    
    const currentYear = new Date().getFullYear();
    const fy = financialYear || `FY${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    
    const enriched = await dataEnrichmentService.enrichCompanyFinancials(id, fy, {
      externalSymbols,
      forceRefresh,
    });
    
    return apiResponse.success(res, {
      companyId: id,
      financialYear: fy,
      sources: enriched.sources,
      metricsEnriched: Object.keys(enriched.metrics).length,
      overallConfidence: enriched.overallConfidence,
      auditEntriesCreated: enriched.auditTrail.length,
      metrics: enriched.metrics,
    });
  } catch (error: any) {
    console.error('Error enriching company:', error);
    return apiResponse.serverError(res, error.message || 'Failed to enrich company data');
  }
});

/**
 * POST /api/unlisted/admin/companies/:id/enrich-mca
 * Trigger MCA/CredHive enrichment for an unlisted company (Admin only)
 * Fetches comprehensive data including financials, charges, legal cases, directors
 * and stores it in the companyFinancials table
 */
router.post('/admin/companies/:id/enrich-mca', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get company details
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    if (!company.cin) {
      return apiResponse.badRequest(res, 'Company CIN is required for MCA enrichment. Please set CIN first.');
    }
    
    console.log(`📊 Starting MCA enrichment for ${company.name} (CIN: ${company.cin})`);
    
    // Trigger MCA enrichment
    const result = await enrichUnlistedCompanyWithMCAData(id, company.cin);
    
    if (!result.success) {
      return apiResponse.serverError(res, result.message);
    }
    
    return apiResponse.success(res, {
      companyId: id,
      companyName: company.name,
      cin: company.cin,
      financialsStored: result.financialsStored,
      enrichedData: result.enrichedData,
      message: result.message,
    });
  } catch (error: any) {
    console.error('Error in MCA enrichment:', error);
    return apiResponse.serverError(res, error.message || 'Failed to enrich company with MCA data');
  }
});

/**
 * POST /api/unlisted/admin/companies/bulk-enrich-mca
 * Bulk MCA enrichment for all unlisted companies with CIN (Admin only)
 */
router.post('/admin/companies/bulk-enrich-mca', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.body;
    
    // Get all companies with CIN that haven't been synced recently
    const companies = await storage.getUnlistedCompanies({ status: 'active' });
    const companiesWithCIN = companies.filter(c => c.cin);
    
    // Sort by last synced (oldest first) and limit
    const toEnrich = companiesWithCIN
      .sort((a, b) => {
        if (!a.lastSyncedAt) return -1;
        if (!b.lastSyncedAt) return 1;
        return new Date(a.lastSyncedAt).getTime() - new Date(b.lastSyncedAt).getTime();
      })
      .slice(0, limit);
    
    console.log(`📊 Bulk MCA enrichment: Processing ${toEnrich.length} companies`);
    
    const results = {
      total: toEnrich.length,
      success: 0,
      failed: 0,
      companies: [] as { id: string; name: string; status: string; financialsStored?: number }[]
    };
    
    for (const company of toEnrich) {
      try {
        const result = await enrichUnlistedCompanyWithMCAData(company.id, company.cin!);
        if (result.success) {
          results.success++;
          results.companies.push({
            id: company.id,
            name: company.name,
            status: 'success',
            financialsStored: result.financialsStored
          });
        } else {
          results.failed++;
          results.companies.push({
            id: company.id,
            name: company.name,
            status: 'failed'
          });
        }
      } catch (err) {
        results.failed++;
        results.companies.push({
          id: company.id,
          name: company.name,
          status: 'error'
        });
      }
    }
    
    return apiResponse.success(res, results);
  } catch (error: any) {
    console.error('Error in bulk MCA enrichment:', error);
    return apiResponse.serverError(res, error.message || 'Failed bulk MCA enrichment');
  }
});

/**
 * GET /api/unlisted/admin/companies/:id/test-enrichment
 * Test endpoint to verify the data enrichment fallback chain is working (Admin only)
 * Returns detailed logs of which sources were attempted and their results
 * This is a dry-run that logs the fallback chain without persisting changes
 */
router.get('/admin/companies/:id/test-enrichment', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    console.log(`\n========================================`);
    console.log(`[TEST ENRICHMENT] Starting test for: ${company.name}`);
    console.log(`  Company ID: ${id}`);
    console.log(`  CIN: ${company.cin || 'NOT SET'}`);
    console.log(`  ISIN: ${company.isin || 'NOT SET'}`);
    console.log(`  Probe42 ID: ${company.probe42CompanyId || 'NOT SET'}`);
    console.log(`========================================\n`);
    
    const currentYear = new Date().getFullYear();
    const fy = `FY${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    
    const enriched = await dataEnrichmentService.enrichCompanyFinancials(id, fy, {
      forceRefresh: true,
    });
    
    const sourcesAttempted = enriched.auditTrail
      .filter(a => a.action === 'fetch')
      .map(a => ({
        source: a.source,
        success: a.confidence !== undefined && a.confidence > 0,
        reason: a.reason,
        confidence: a.confidence,
      }));
    
    console.log(`\n========================================`);
    console.log(`[TEST ENRICHMENT] Results for: ${company.name}`);
    console.log(`  Sources used: ${enriched.sources.join(', ') || 'NONE'}`);
    console.log(`  Metrics fetched: ${Object.keys(enriched.metrics).length}`);
    console.log(`  Overall confidence: ${(enriched.overallConfidence * 100).toFixed(1)}%`);
    console.log(`  Audit trail entries: ${enriched.auditTrail.length}`);
    console.log(`========================================\n`);
    
    return apiResponse.success(res, {
      company: {
        id: company.id,
        name: company.name,
        cin: company.cin,
        isin: company.isin,
        probe42CompanyId: company.probe42CompanyId,
      },
      financialYear: fy,
      fallbackChainOrder: ['credhive', 'mca', 'nse_bse', 'finnhub', 'yahoo'],
      sourcesAttempted,
      sourcesSucceeded: enriched.sources,
      metricsCollected: Object.keys(enriched.metrics),
      metrics: enriched.metrics,
      overallConfidence: enriched.overallConfidence,
      auditTrail: enriched.auditTrail,
      testStatus: enriched.sources.length > 0 ? 'SUCCESS' : 'NO_DATA_SOURCES',
    });
  } catch (error: any) {
    console.error('[TEST ENRICHMENT] Error:', error);
    return apiResponse.serverError(res, error.message || 'Test enrichment failed');
  }
});

/**
 * GET /api/unlisted/admin/companies/:id/financials/:metric/provenance
 * "Why This Number?" API - Get full provenance and audit trail for a specific metric (Admin only)
 * Returns source, retrieval time, confidence, and override history
 */
router.get('/admin/companies/:id/financials/:metric/provenance', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id, metric } = req.params;
    const { financialYear } = req.query;
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const provenance = await dataEnrichmentService.getMetricProvenance(
      id,
      metric,
      financialYear as string | undefined
    );
    
    const usageFlags = await dataEnrichmentService.getDataUsageFlags(
      id,
      financialYear as string || `FY${new Date().getFullYear() - 1}-${new Date().getFullYear().toString().slice(-2)}`
    );
    
    return apiResponse.success(res, {
      companyId: id,
      companyName: company.companyName,
      metric: provenance.metric,
      currentValue: provenance.currentValue,
      history: provenance.history,
      sourceBreakdown: provenance.sourceBreakdown,
      usageFlags: {
        aiAllowed: usageFlags.aiAllowed,
        executionAllowed: usageFlags.executionAllowed,
        lockedForAdvisory: usageFlags.lockedForAdvisory,
        confidenceScore: usageFlags.confidenceScore,
        dataQualityScore: usageFlags.dataQualityScore,
        blockReasons: usageFlags.blockReasons,
      },
      whyThisNumber: {
        explanation: provenance.currentValue 
          ? `This ${metric} value of ${provenance.currentValue.value} was sourced from ${provenance.currentValue.source} on ${provenance.currentValue.retrievedAt.toISOString()} with ${(provenance.currentValue.confidenceScore * 100).toFixed(0)}% confidence.`
          : `No value currently recorded for ${metric}.`,
        sourcePriority: dataEnrichmentService.getSourcePriority(),
        totalHistoricalRecords: provenance.history.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching metric provenance:', error);
    return apiResponse.serverError(res, 'Failed to fetch metric provenance');
  }
});

/**
 * GET /api/unlisted/admin/companies/:id/data-usage-flags
 * Get AI and execution guardrails for a company's data (Admin only)
 */
router.get('/admin/companies/:id/data-usage-flags', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { financialYear } = req.query;
    
    const fy = financialYear as string || `FY${new Date().getFullYear() - 1}-${new Date().getFullYear().toString().slice(-2)}`;
    
    const flags = await dataEnrichmentService.getDataUsageFlags(id, fy);
    
    return apiResponse.success(res, {
      companyId: id,
      financialYear: fy,
      ...flags,
      recommendation: flags.executionAllowed 
        ? 'Data suitable for trading and advisory' 
        : flags.aiAllowed 
          ? 'Data suitable for AI analysis only, not for trading'
          : 'Data quality too low for any automated use',
    });
  } catch (error: any) {
    console.error('Error fetching data usage flags:', error);
    return apiResponse.serverError(res, 'Failed to fetch data usage flags');
  }
});

/**
 * GET /api/unlisted/financial-reports/:symbol
 * Fetch financial reports from NSE and BSE for any stock symbol
 * Returns quarterly results, announcements, board meetings, corporate actions, shareholding pattern
 */
router.get('/financial-reports/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { scripcode, source } = req.query;
    
    if (!symbol) {
      return apiResponse.badRequest(res, 'Stock symbol is required');
    }

    console.log(`[Financial Reports] Fetching reports for ${symbol}`);

    if (source === 'nse') {
      const nseReports = await dataEnrichmentService.fetchNSEFinancialReports(symbol);
      return apiResponse.success(res, nseReports);
    } else if (source === 'bse') {
      const bseReports = await dataEnrichmentService.fetchBSEFinancialReports(symbol, scripcode as string | undefined);
      return apiResponse.success(res, bseReports);
    } else {
      const unifiedReports = await dataEnrichmentService.fetchUnifiedFinancialReports(symbol, scripcode as string | undefined);
      return apiResponse.success(res, unifiedReports);
    }
  } catch (error: any) {
    console.error('Error fetching financial reports:', error);
    return apiResponse.serverError(res, 'Failed to fetch financial reports');
  }
});

/**
 * PUT /api/unlisted/admin/companies/:id/peers
 * Update listed peer companies for comparison (Admin only)
 */
router.put('/admin/companies/:id/peers', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    const { listedPeers } = req.body;
    
    if (!Array.isArray(listedPeers)) {
      return apiResponse.badRequest(res, 'listedPeers must be an array');
    }
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    await storage.updateUnlistedCompany(id, { listedPeers });
    
    console.log(`[Peers] Updated ${listedPeers.length} listed peers for company ${id}`);
    
    return apiResponse.success(res, { 
      message: 'Listed peers updated successfully',
      peersCount: listedPeers.length 
    });
  } catch (error: any) {
    console.error('Error updating listed peers:', error);
    return apiResponse.serverError(res, 'Failed to update listed peers');
  }
});

/**
 * POST /api/unlisted/admin/companies/:id/auto-fetch-peers
 * Auto-fetch listed peer companies based on sector/industry using Yahoo Finance (Admin only)
 */
router.post('/admin/companies/:id/auto-fetch-peers', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    const { referenceSymbol, maxPeers = 5 } = req.body;
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const companyData = company as any;
    console.log(`[Auto-Fetch Peers] Starting for ${companyData.name}, sector: ${companyData.sector}, industry: ${companyData.industry}`);
    
    // Dynamic import of yahoo-finance2
    const yahooFinance = await import('yahoo-finance2').then(m => m.default);
    
    // Determine reference symbol to use for finding peers
    // Strategy: Use provided symbol, or find a major company in the same sector
    let symbolToUse = referenceSymbol;
    
    if (!symbolToUse) {
      // Map common sectors to major Indian listed companies
      const sectorToSymbolMap: Record<string, string> = {
        'Technology': 'TCS.NS',
        'Information Technology': 'TCS.NS',
        'IT': 'INFY.NS',
        'Software': 'WIPRO.NS',
        'Finance': 'HDFCBANK.NS',
        'Banking': 'HDFCBANK.NS',
        'Financial Services': 'BAJFINANCE.NS',
        'NBFC': 'BAJFINANCE.NS',
        'Fintech': 'PAYTM.NS',
        'Healthcare': 'SUNPHARMA.NS',
        'Pharmaceuticals': 'SUNPHARMA.NS',
        'Consumer': 'HINDUNILVR.NS',
        'FMCG': 'ITC.NS',
        'Retail': 'DMART.NS',
        'E-commerce': 'ETERNAL.NS',
        'Food Delivery': 'ETERNAL.NS',
        'Logistics': 'DELHIVERY.NS',
        'Manufacturing': 'TATAMOTORS.NS',
        'Auto': 'MARUTI.NS',
        'Automobile': 'MARUTI.NS',
        'Real Estate': 'DLF.NS',
        'Infrastructure': 'LT.NS',
        'Energy': 'RELIANCE.NS',
        'Oil & Gas': 'ONGC.NS',
        'Telecom': 'BHARTIARTL.NS',
        'Media': 'ZEEL.NS',
        'Entertainment': 'PVR.NS',
        'Insurance': 'SBILIFE.NS',
        'EdTech': 'INFY.NS', // No direct EdTech listing, use proxy
        'Agriculture': 'UPL.NS',
        'Chemicals': 'PIDILITIND.NS',
        'Metals': 'TATASTEEL.NS',
        'Power': 'NTPC.NS',
        'Cement': 'ULTRACEMCO.NS',
      };
      
      // Find matching sector/industry
      const sector = (companyData.sector || '').toLowerCase();
      const industry = (companyData.industry || '').toLowerCase();
      
      for (const [key, symbol] of Object.entries(sectorToSymbolMap)) {
        if (sector.includes(key.toLowerCase()) || industry.includes(key.toLowerCase()) || 
            key.toLowerCase().includes(sector) || key.toLowerCase().includes(industry)) {
          symbolToUse = symbol;
          break;
        }
      }
      
      // Default to NIFTY 50 company if no match
      if (!symbolToUse) {
        symbolToUse = 'RELIANCE.NS';
      }
    }
    
    console.log(`[Auto-Fetch Peers] Using reference symbol: ${symbolToUse}`);
    
    // Fetch recommended symbols from Yahoo Finance
    let recommendedSymbols: { symbol: string; score: number }[] = [];
    try {
      const recommendations = await yahooFinance.recommendationsBySymbol(symbolToUse);
      recommendedSymbols = recommendations.recommendedSymbols?.slice(0, maxPeers) || [];
    } catch (recError: any) {
      console.log(`[Auto-Fetch Peers] Could not get recommendations: ${recError.message}`);
      // Fallback: use sector-specific symbols
      const sectorFallbacks: Record<string, string[]> = {
        'Technology': ['TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS', 'TECHM.NS'],
        'Finance': ['HDFCBANK.NS', 'ICICIBANK.NS', 'KOTAKBANK.NS', 'SBIN.NS', 'AXISBANK.NS'],
        'Healthcare': ['SUNPHARMA.NS', 'DRREDDY.NS', 'CIPLA.NS', 'DIVISLAB.NS', 'APOLLOHOSP.NS'],
        'Consumer': ['HINDUNILVR.NS', 'ITC.NS', 'NESTLEIND.NS', 'DABUR.NS', 'BRITANNIA.NS'],
      };
      
      const sector = (companyData.sector || 'Technology').toLowerCase();
      const fallbackSymbols = Object.entries(sectorFallbacks).find(([key]) => 
        sector.includes(key.toLowerCase())
      )?.[1] || sectorFallbacks['Technology'];
      
      recommendedSymbols = fallbackSymbols.slice(0, maxPeers).map((s, i) => ({ symbol: s, score: 0.5 - (i * 0.05) }));
    }
    
    if (recommendedSymbols.length === 0) {
      return apiResponse.success(res, { 
        message: 'No peer recommendations found',
        peersAdded: 0,
        peers: []
      });
    }
    
    // Fetch detailed data for each peer
    const listedPeers: Array<{
      name: string;
      ticker: string;
      exchange: string;
      marketCap?: number;
      peRatio?: number;
      pbRatio?: number;
      evEbitda?: number;
      roe?: number;
      roce?: number;
      debtEquity?: number;
      revenueGrowth?: number;
    }> = [];
    
    for (const rec of recommendedSymbols) {
      try {
        // Ensure we're using Indian symbols
        let symbol = rec.symbol;
        if (!symbol.includes('.NS') && !symbol.includes('.BO')) {
          symbol = `${symbol}.NS`;
        }
        
        const quote = await yahooFinance.quote(symbol);
        
        if (quote) {
          // Try to get key statistics
          let keyStats: any = null;
          try {
            const quoteSummary = await yahooFinance.quoteSummary(symbol, { modules: ['defaultKeyStatistics', 'financialData'] });
            keyStats = quoteSummary;
          } catch (statsErr) {
            console.log(`[Auto-Fetch Peers] Could not fetch stats for ${symbol}`);
          }
          
          listedPeers.push({
            name: quote.longName || quote.shortName || symbol.replace('.NS', '').replace('.BO', ''),
            ticker: symbol.replace('.NS', '').replace('.BO', ''),
            exchange: symbol.includes('.NS') ? 'NSE' : 'BSE',
            marketCap: quote.marketCap,
            peRatio: quote.trailingPE,
            pbRatio: keyStats?.defaultKeyStatistics?.priceToBook,
            evEbitda: keyStats?.defaultKeyStatistics?.enterpriseToEbitda,
            roe: keyStats?.financialData?.returnOnEquity ? keyStats.financialData.returnOnEquity * 100 : undefined,
            roce: keyStats?.financialData?.returnOnAssets ? keyStats.financialData.returnOnAssets * 100 : undefined,
            debtEquity: keyStats?.financialData?.debtToEquity ? keyStats.financialData.debtToEquity / 100 : undefined,
            revenueGrowth: keyStats?.financialData?.revenueGrowth ? keyStats.financialData.revenueGrowth * 100 : undefined,
          });
        }
      } catch (quoteError: any) {
        console.log(`[Auto-Fetch Peers] Error fetching ${rec.symbol}: ${quoteError.message}`);
      }
    }
    
    if (listedPeers.length > 0) {
      // Merge with existing peers if any
      const existingPeers = Array.isArray(companyData.listedPeers) ? companyData.listedPeers : [];
      const existingTickers = new Set(existingPeers.map((p: any) => p.ticker?.toUpperCase()));
      const newPeers = listedPeers.filter(p => !existingTickers.has(p.ticker.toUpperCase()));
      const mergedPeers = [...existingPeers, ...newPeers];
      
      await storage.updateUnlistedCompany(id, { listedPeers: mergedPeers });
      
      console.log(`[Auto-Fetch Peers] Added ${newPeers.length} new peers for ${companyData.name}`);
      
      return apiResponse.success(res, { 
        message: `Successfully fetched ${newPeers.length} new peer companies`,
        referenceSymbol: symbolToUse,
        peersAdded: newPeers.length,
        totalPeers: mergedPeers.length,
        peers: newPeers
      });
    }
    
    return apiResponse.success(res, { 
      message: 'Could not fetch peer data',
      peersAdded: 0,
      peers: []
    });
    
  } catch (error: any) {
    console.error('Error auto-fetching peers:', error);
    return apiResponse.serverError(res, `Failed to auto-fetch peers: ${error.message}`);
  }
});

/**
 * POST /api/unlisted/admin/refresh-company-data/:companyId
 * Refresh all company data from external sources (Admin only)
 */
router.post('/admin/refresh-company-data/:companyId', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyId } = req.params;
    
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const companyData = company as any;
    const results: { source: string; status: string; error?: string; data?: any }[] = [];
    
    // Try MoneyControl price refresh
    try {
      const mcResult = await priceAggregationService.refreshMoneyControlPrice(companyId);
      results.push({ source: 'moneycontrol', status: mcResult ? 'success' : 'no_data' });
    } catch (mcError: any) {
      results.push({ source: 'moneycontrol', status: 'error', error: mcError.message });
    }
    
    // Try MCA data fetch if CIN is available
    if (companyData.cin && mcaService.isConfigured()) {
      try {
        console.log(`[Refresh] Fetching MCA data for CIN: ${companyData.cin}`);
        const mcaData = await mcaService.getCompanyByCIN(companyData.cin);
        
        if (mcaData) {
          // Update company with MCA data
          const companyUpdate = mcaService.toFintekProCompanyData(mcaData);
          await storage.updateUnlistedCompany(companyId, {
            industry: companyUpdate.industry || companyData.industry,
            sector: companyUpdate.sector || companyData.sector,
            faceValue: companyUpdate.faceValue || companyData.faceValue,
            totalShares: companyUpdate.totalShares ? parseInt(companyUpdate.totalShares) : companyData.totalShares,
            description: companyUpdate.registeredAddress || companyData.description,
            lastSyncedAt: new Date(),
          });
          
          // Calculate basic metrics from MCA data
          const metrics = mcaService.estimateBasicMetrics(mcaData);
          
          // Store MCA-derived ratios if we have them
          if (metrics.debtEquity !== undefined) {
            const currentYear = new Date().getFullYear();
            const financialYear = `${currentYear - 1}-${currentYear}`;
            
            try {
              await storage.createCompanyRatios({
                companyId,
                financialYear,
                debtEquity: metrics.debtEquity.toString(),
                dataSource: 'mca',
              });
            } catch (ratioError) {
              console.log('[Refresh] Could not store MCA ratios:', ratioError);
            }
          }
          
          results.push({ 
            source: 'mca', 
            status: 'success',
            data: {
              paidUpCapital: mcaData.paidUpCapital,
              authorizedCapital: mcaData.authorizedCapital,
              directors: mcaData.directors.length,
              charges: mcaData.charges.length,
            }
          });
        } else {
          results.push({ source: 'mca', status: 'no_data' });
        }
      } catch (mcaError: any) {
        console.error('[Refresh] MCA error:', mcaError);
        results.push({ source: 'mca', status: 'error', error: mcaError.message });
      }
    } else if (!companyData.cin) {
      results.push({ source: 'mca', status: 'skipped', error: 'No CIN available' });
    } else {
      results.push({ source: 'mca', status: 'skipped', error: 'API not configured' });
    }
    
    // Try CredHive sync - always attempt as it has mock data fallback in development
    try {
      let credhiveId = companyData.probe42CompanyId;
      
      // If no CredHive ID, try to search and link the company
      if (!credhiveId && companyData.name) {
        console.log(`[Refresh] No CredHive ID, searching for: ${companyData.name}`);
        const searchResults = await credhiveService.searchCompanyByNameOrCIN(companyData.name.substring(0, 50));
        
        if (searchResults.length > 0) {
          // Link the first matching company
          credhiveId = searchResults[0].company_id;
          console.log(`[Refresh] Found and linking CredHive company: ${credhiveId}`);
          
          // Update company with CredHive ID and CIN if available
          const updateData: any = { probe42CompanyId: credhiveId };
          if (searchResults[0].cin && !companyData.cin) {
            updateData.cin = searchResults[0].cin;
            console.log(`[Refresh] Auto-populated CIN: ${searchResults[0].cin}`);
          }
          
          await storage.updateUnlistedCompany(companyId, updateData);
        }
      }
      
      // Use company's CredHive ID if available for direct sync
      if (credhiveId) {
        // Fetch company details (includes directors), financials, and ratios
        const [companyDetails, financials, ratios] = await Promise.all([
          credhiveService.getCompanyDetails(credhiveId),
          credhiveService.getCompanyFinancials(credhiveId, 3),
          credhiveService.getCompanyRatios(credhiveId, 3),
        ]);
        
        // Update company with details from CredHive including CIN if missing
        if (companyDetails) {
          const updateData: any = { lastSyncedAt: new Date() };
          if (companyDetails.cin && !companyData.cin) {
            updateData.cin = companyDetails.cin;
            console.log(`[Refresh] Auto-populated CIN from CredHive details: ${companyDetails.cin}`);
          }
          // Add capital info if available
          if (companyDetails.paid_up_capital) {
            updateData.paidUpCapital = companyDetails.paid_up_capital.toString();
          }
          if (companyDetails.authorized_capital) {
            updateData.authorizedCapital = companyDetails.authorized_capital.toString();
          }
          if (companyDetails.face_value) {
            updateData.faceValue = companyDetails.face_value.toString();
          }
          if (companyDetails.total_shares) {
            updateData.totalShares = companyDetails.total_shares;
          }
          await storage.updateUnlistedCompany(companyId, updateData);
          
          if (companyDetails.directors && companyDetails.directors.length > 0) {
            console.log(`[Refresh] Got ${companyDetails.directors.length} directors from CredHive`);
          }
        }
        
        // Store financials in database
        let financialsSaved = 0;
        for (const fin of financials) {
          try {
            const existingFin = await storage.getCompanyFinancialsByYear(companyId, fin.financial_year);
            const finData = {
              companyId,
              financialYear: fin.financial_year,
              periodStart: fin.period_start,
              periodEnd: fin.period_end,
              revenue: fin.revenue?.toString(),
              ebitda: fin.ebitda?.toString(),
              pat: fin.pat?.toString(),
              netProfit: fin.pat?.toString(), // Use PAT as Net Profit for display
              totalAssets: fin.total_assets?.toString(),
              networth: fin.networth?.toString(),
              totalDebt: fin.total_debt?.toString(),
              dataSource: 'credhive' as const,
              verified: false,
            };
            if (existingFin) {
              await storage.updateCompanyFinancials(existingFin.id, finData);
            } else {
              await storage.createCompanyFinancials(finData);
            }
            financialsSaved++;
          } catch (finError) {
            console.log(`[Refresh] Could not save financial for ${fin.financial_year}:`, finError);
          }
        }
        console.log(`[Refresh] Saved ${financialsSaved} financials from CredHive`);
        
        // Store ratios in database
        let ratiosSaved = 0;
        for (const ratio of ratios) {
          try {
            const existingRatio = await storage.getCompanyRatiosByYear(companyId, ratio.financial_year);
            const ratioData = {
              companyId,
              financialYear: ratio.financial_year,
              peRatio: ratio.pe_ratio?.toString(),
              pbRatio: ratio.pb_ratio?.toString(),
              evEbitda: ratio.ev_ebitda?.toString(),
              roe: ratio.roe?.toString(),
              roce: ratio.roce?.toString(),
              marginEbitda: ratio.margin_ebitda?.toString(),
              marginPat: ratio.margin_pat?.toString(),
              debtEquity: ratio.debt_equity?.toString(),
              currentRatio: ratio.current_ratio?.toString(),
              revenueGrowth: ratio.revenue_growth?.toString(),
              profitGrowth: ratio.profit_growth?.toString(),
              dataSource: 'credhive' as const,
            };
            if (existingRatio) {
              await storage.updateCompanyRatios(existingRatio.id, ratioData);
            } else {
              await storage.createCompanyRatios(ratioData);
            }
            ratiosSaved++;
          } catch (ratioError) {
            console.log(`[Refresh] Could not save ratio for ${ratio.financial_year}:`, ratioError);
          }
        }
        console.log(`[Refresh] Saved ${ratiosSaved} ratios from CredHive`);
        
        if (financialsSaved > 0 || ratiosSaved > 0 || (companyDetails?.directors && companyDetails.directors.length > 0)) {
          results.push({ 
            source: 'credhive', 
            status: 'success',
            data: {
              financials: financialsSaved,
              ratios: ratiosSaved,
              directors: companyDetails?.directors?.length || 0,
            }
          });
        } else {
          results.push({ source: 'credhive', status: 'no_data' });
        }
      } else {
        results.push({ source: 'credhive', status: 'skipped', error: 'Could not find matching company in CredHive' });
      }
    } catch (p42Error: any) {
      results.push({ source: 'credhive', status: 'error', error: p42Error.message });
    }
    
    // Also run multi-source data enrichment with forceRefresh to bypass identity confidence check
    // This ensures MCA fallback is used when CIN/ISIN are present but no CredHive mapping exists
    try {
      const currentYear = new Date().getFullYear();
      const fy = `FY${currentYear - 1}-${currentYear.toString().slice(-2)}`;
      
      const enriched = await dataEnrichmentService.enrichCompanyFinancials(companyId, fy, {
        forceRefresh: true,
      });
      
      if (enriched.sources.length > 0) {
        results.push({
          source: 'data_enrichment',
          status: 'success',
          data: {
            sources: enriched.sources,
            metricsEnriched: Object.keys(enriched.metrics).length,
            overallConfidence: enriched.overallConfidence,
          }
        });
      } else {
        const blockReason = enriched.auditTrail.find(a => a.action === 'block')?.reason;
        const bypassReason = enriched.auditTrail.find(a => a.action === 'bypass')?.reason;
        results.push({
          source: 'data_enrichment',
          status: 'no_data',
          data: { reason: blockReason || bypassReason || 'No metrics fetched' }
        });
      }
    } catch (enrichError: any) {
      console.log('[Refresh] Data enrichment error:', enrichError.message);
      results.push({ source: 'data_enrichment', status: 'error', error: enrichError.message });
    }
    
    return apiResponse.success(res, {
      message: 'Company data refresh completed',
      companyId,
      companyName: companyData.name,
      results,
    });
  } catch (error: any) {
    console.error('Error refreshing company data:', error);
    return apiResponse.serverError(res, error.message || 'Failed to refresh company data');
  }
});

/**
 * POST /api/unlisted/admin/auto-enrich/:companyId
 * Auto-enrich company metadata (name, sector, industry) from MCA using CIN
 * with CredHive fallback. Used when sector/industry are "Unknown"
 */
router.post('/admin/auto-enrich/:companyId', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyId } = req.params;
    
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const companyData = company as any;
    const enrichedFields: { field: string; oldValue: string | null; newValue: string; source: string }[] = [];
    let enrichmentSource = 'none';
    
    // Check if enrichment is needed
    const needsSectorEnrich = !companyData.sector || companyData.sector.toLowerCase().includes('unknown');
    const needsIndustryEnrich = !companyData.industry || companyData.industry.toLowerCase().includes('unknown');
    
    if (!needsSectorEnrich && !needsIndustryEnrich) {
      return apiResponse.success(res, {
        message: 'Company metadata already complete',
        companyId,
        companyName: companyData.name,
        enrichedFields: [],
        alreadyComplete: true,
      });
    }
    
    // If CIN is missing but we have a company name, try to fetch CIN from CredHive search
    // Note: Sandbox.co.in MCA API doesn't support company name search, only CIN lookup
    let currentCIN = companyData.cin;
    if (!currentCIN && companyData.name) {
      try {
        console.log(`[Auto-Enrich] No CIN available, searching CredHive by company name: ${companyData.name}`);
        const credhiveResults = await credhiveService.searchCompanyByNameOrCIN(companyData.name);
        
        if (credhiveResults && credhiveResults.length > 0) {
          // Find best match by name similarity
          const searchNameLower = companyData.name.toLowerCase().replace(/\s+/g, ' ').trim();
          let bestMatch = credhiveResults[0];
          let bestScore = 0;
          
          for (const result of credhiveResults) {
            const resultNameLower = result.name.toLowerCase().replace(/\s+/g, ' ').trim();
            // Simple word match scoring
            const searchWords = searchNameLower.split(' ');
            const resultWords = resultNameLower.split(' ');
            let matchScore = 0;
            for (const word of searchWords) {
              if (resultWords.some(rw => rw.includes(word) || word.includes(rw))) {
                matchScore++;
              }
            }
            const score = matchScore / Math.max(searchWords.length, resultWords.length);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = result;
            }
          }
          
          if (bestMatch.cin && bestScore >= 0.4) {
            currentCIN = bestMatch.cin;
            companyData.cin = bestMatch.cin; // Update local reference to prevent overwrite
            console.log(`[Auto-Enrich] Found CIN ${bestMatch.cin} for "${companyData.name}" via CredHive (matched: "${bestMatch.name}", score: ${(bestScore * 100).toFixed(1)}%)`);
            
            // Save the CIN and CredHive ID to the company record
            const updatePayload: any = { cin: bestMatch.cin, lastSyncedAt: new Date() };
            if (bestMatch.company_id) {
              updatePayload.probe42CompanyId = bestMatch.company_id;
            }
            await storage.updateUnlistedCompany(companyId, updatePayload);
            
            enrichedFields.push({
              field: 'cin',
              oldValue: null,
              newValue: bestMatch.cin,
              source: 'CredHive'
            });
            enrichmentSource = 'CredHive';
            
            // Also update name if official name differs meaningfully
            if (bestMatch.name && bestMatch.name.toLowerCase() !== companyData.name.toLowerCase()) {
              await storage.updateUnlistedCompany(companyId, { name: bestMatch.name });
              enrichedFields.push({
                field: 'name',
                oldValue: companyData.name,
                newValue: bestMatch.name,
                source: 'CredHive'
              });
              companyData.name = bestMatch.name; // Update local reference
            }
          } else {
            console.log(`[Auto-Enrich] CredHive search found ${credhiveResults.length} results but no confident match (best score: ${(bestScore * 100).toFixed(1)}%)`);
          }
        } else {
          console.log(`[Auto-Enrich] Could not find CIN for "${companyData.name}" in CredHive search`);
        }
      } catch (cinError: any) {
        console.error('[Auto-Enrich] Error searching CredHive for CIN:', cinError.message);
      }
    }
    
    // Try MCA first if CIN is available (either from DB or newly fetched)
    if (currentCIN && mcaService.isConfigured()) {
      try {
        console.log(`[Auto-Enrich] Fetching MCA data for CIN: ${currentCIN}`);
        const mcaData = await mcaService.getCompanyByCIN(currentCIN);
        
        if (mcaData) {
          const mcaCompanyData = mcaService.toFintekProCompanyData(mcaData);
          const updateData: any = { lastSyncedAt: new Date() };
          
          console.log('[Auto-Enrich] MCA raw data:', JSON.stringify(mcaData, null, 2));
          console.log('[Auto-Enrich] MCA company data:', JSON.stringify(mcaCompanyData, null, 2));
          console.log('[Auto-Enrich] Current company name:', companyData.name);
          console.log('[Auto-Enrich] MCA company name:', mcaCompanyData.name);
          
          // Always use MCA company name as authoritative source (official government registry)
          // Force update even if names appear similar - MCA is the definitive source
          if (mcaCompanyData.name) {
            const normalizedMcaName = mcaCompanyData.name.trim();
            const normalizedCurrentName = (companyData.name || '').trim();
            
            console.log('[Auto-Enrich] Normalized MCA name:', normalizedMcaName);
            console.log('[Auto-Enrich] Normalized current name:', normalizedCurrentName);
            console.log('[Auto-Enrich] Names equal (case-insensitive)?', normalizedMcaName.toLowerCase() === normalizedCurrentName.toLowerCase());
            console.log('[Auto-Enrich] Names equal (exact)?', normalizedMcaName === normalizedCurrentName);
            
            // Update if names differ in any way (case, spacing, abbreviations like Ltd vs Limited)
            if (normalizedMcaName.toLowerCase() !== normalizedCurrentName.toLowerCase() || 
                normalizedMcaName !== normalizedCurrentName) {
              updateData.name = normalizedMcaName;
              enrichedFields.push({
                field: 'name',
                oldValue: companyData.name,
                newValue: normalizedMcaName,
                source: 'MCA'
              });
              console.log('[Auto-Enrich] Name will be updated to:', normalizedMcaName);
            } else {
              console.log('[Auto-Enrich] Name update skipped - names are identical');
            }
          } else {
            console.log('[Auto-Enrich] No name in MCA response');
          }
          
          // Update sector if available and needed
          if (mcaCompanyData.sector && needsSectorEnrich) {
            updateData.sector = mcaCompanyData.sector;
            enrichedFields.push({
              field: 'sector',
              oldValue: companyData.sector || 'Unknown',
              newValue: mcaCompanyData.sector,
              source: 'MCA'
            });
          }
          
          // Update industry if available and needed
          if (mcaCompanyData.industry && needsIndustryEnrich) {
            updateData.industry = mcaCompanyData.industry;
            enrichedFields.push({
              field: 'industry',
              oldValue: companyData.industry || 'Unknown',
              newValue: mcaCompanyData.industry,
              source: 'MCA'
            });
          }
          
          // Also update other useful MCA fields if missing
          if (mcaCompanyData.paidUpCapital && !companyData.paidUpCapital) {
            updateData.paidUpCapital = mcaCompanyData.paidUpCapital;
            enrichedFields.push({
              field: 'paidUpCapital',
              oldValue: null,
              newValue: mcaCompanyData.paidUpCapital,
              source: 'MCA'
            });
          }
          
          if (mcaCompanyData.authorizedCapital && !companyData.authorizedCapital) {
            updateData.authorizedCapital = mcaCompanyData.authorizedCapital;
            enrichedFields.push({
              field: 'authorizedCapital',
              oldValue: null,
              newValue: mcaCompanyData.authorizedCapital,
              source: 'MCA'
            });
          }
          
          if (mcaCompanyData.incorporationDate && !companyData.incorporationDate) {
            updateData.incorporationDate = mcaCompanyData.incorporationDate;
            enrichedFields.push({
              field: 'incorporationDate',
              oldValue: null,
              newValue: mcaCompanyData.incorporationDate,
              source: 'MCA'
            });
          }
          
          if (Object.keys(updateData).length > 1) {
            await storage.updateUnlistedCompany(companyId, updateData);
            // Combine sources if CIN was found via CredHive
            if (enrichmentSource === 'CredHive') {
              enrichmentSource = 'CredHive + MCA';
            } else if (enrichmentSource === 'none') {
              enrichmentSource = 'MCA';
            }
            console.log(`[Auto-Enrich] Updated ${enrichedFields.length} fields from MCA for ${companyData.name}`);
          }
        }
      } catch (mcaError: any) {
        console.error('[Auto-Enrich] MCA error:', mcaError.message);
      }
    }
    
    // If still missing sector/industry, try CredHive
    const stillNeedsSector = enrichedFields.every(f => f.field !== 'sector') && needsSectorEnrich;
    const stillNeedsIndustry = enrichedFields.every(f => f.field !== 'industry') && needsIndustryEnrich;
    
    if ((stillNeedsSector || stillNeedsIndustry) && companyData.probe42CompanyId) {
      try {
        console.log(`[Auto-Enrich] Fetching CredHive data for ID: ${companyData.probe42CompanyId}`);
        const credhiveDetails = await credhiveService.getCompanyDetails(companyData.probe42CompanyId);
        
        if (credhiveDetails) {
          const updateData: any = { lastSyncedAt: new Date() };
          
          if (credhiveDetails.sector && stillNeedsSector) {
            updateData.sector = credhiveDetails.sector;
            enrichedFields.push({
              field: 'sector',
              oldValue: companyData.sector || 'Unknown',
              newValue: credhiveDetails.sector,
              source: 'CredHive'
            });
          }
          
          if (credhiveDetails.industry && stillNeedsIndustry) {
            updateData.industry = credhiveDetails.industry;
            enrichedFields.push({
              field: 'industry',
              oldValue: companyData.industry || 'Unknown',
              newValue: credhiveDetails.industry,
              source: 'CredHive'
            });
          }
          
          if (Object.keys(updateData).length > 1) {
            await storage.updateUnlistedCompany(companyId, updateData);
            // Combine sources properly
            if (enrichmentSource.includes('MCA') && !enrichmentSource.includes('CredHive')) {
              enrichmentSource = enrichmentSource + ' + CredHive';
            } else if (enrichmentSource === 'none' || enrichmentSource === '') {
              enrichmentSource = 'CredHive';
            }
            console.log(`[Auto-Enrich] Updated ${enrichedFields.length} fields from CredHive for ${companyData.name}`);
          }
        }
      } catch (p42Error: any) {
        console.error('[Auto-Enrich] CredHive error:', p42Error.message);
      }
    }
    
    // Final fallback: Use NIC-based classification from CIN if still missing sector/industry
    const finalNeedsSector = enrichedFields.every(f => f.field !== 'sector') && needsSectorEnrich;
    const finalNeedsIndustry = enrichedFields.every(f => f.field !== 'industry') && needsIndustryEnrich;
    
    if ((finalNeedsSector || finalNeedsIndustry) && currentCIN) {
      try {
        const { classifyIndustryFromCIN } = await import('../utils/nic-industry-classifier');
        const nicClassification = classifyIndustryFromCIN(currentCIN);
        
        if (nicClassification) {
          console.log(`[Auto-Enrich] Using NIC-based classification for CIN ${currentCIN}: ${nicClassification.sector}/${nicClassification.industry}`);
          const updateData: any = { lastSyncedAt: new Date() };
          
          if (nicClassification.sector && finalNeedsSector) {
            updateData.sector = nicClassification.sector;
            enrichedFields.push({
              field: 'sector',
              oldValue: companyData.sector || 'Unknown',
              newValue: nicClassification.sector,
              source: 'NIC Classification (Derived from CIN)'
            });
          }
          
          if (nicClassification.industry && finalNeedsIndustry) {
            updateData.industry = nicClassification.industry;
            enrichedFields.push({
              field: 'industry',
              oldValue: companyData.industry || 'Unknown',
              newValue: nicClassification.industry,
              source: 'NIC Classification (Derived from CIN)'
            });
          }
          
          if (Object.keys(updateData).length > 1) {
            await storage.updateUnlistedCompany(companyId, updateData);
            if (enrichmentSource === 'none' || enrichmentSource === '') {
              enrichmentSource = 'NIC Classification';
            } else {
              enrichmentSource = enrichmentSource + ' + NIC Classification';
            }
            console.log(`[Auto-Enrich] Updated ${enrichedFields.filter(f => f.source.includes('NIC')).length} fields from NIC classification for ${companyData.name}`);
          }
        }
      } catch (nicError: any) {
        console.error('[Auto-Enrich] NIC classification error:', nicError.message);
      }
    }
    
    // Fetch the updated company data
    const updatedCompany = await storage.getUnlistedCompanyById(companyId);
    
    return apiResponse.success(res, {
      message: enrichedFields.length > 0 
        ? `Successfully enriched ${enrichedFields.length} field(s) from ${enrichmentSource}`
        : 'No enrichment data found from external sources',
      companyId,
      companyName: (updatedCompany as any)?.name || companyData.name,
      enrichedFields,
      enrichmentSource,
      updatedCompany: updatedCompany ? {
        id: (updatedCompany as any).id,
        name: (updatedCompany as any).name,
        sector: (updatedCompany as any).sector,
        industry: (updatedCompany as any).industry,
        cin: (updatedCompany as any).cin,
      } : null,
    });
  } catch (error: any) {
    console.error('Error auto-enriching company:', error);
    return apiResponse.serverError(res, error.message || 'Failed to auto-enrich company data');
  }
});

/**
 * POST /api/unlisted/companies/:companyId/publish-to-store-with-prices
 * Publish company to store with admin-set buy/sell prices (Admin only)
 */
router.post('/companies/:companyId/publish-to-store-with-prices', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyId } = req.params;
    const { buyPrice, sellPrice, priceSource } = req.body;
    
    // Validate prices
    if (!buyPrice || !sellPrice) {
      return apiResponse.badRequest(res, 'Both buyPrice and sellPrice are required');
    }
    
    const parsedBuyPrice = parseFloat(buyPrice);
    const parsedSellPrice = parseFloat(sellPrice);
    
    if (isNaN(parsedBuyPrice) || isNaN(parsedSellPrice)) {
      return apiResponse.badRequest(res, 'Invalid price values');
    }
    
    if (parsedBuyPrice <= 0 || parsedSellPrice <= 0) {
      return apiResponse.badRequest(res, 'Prices must be positive');
    }
    
    if (parsedBuyPrice >= parsedSellPrice) {
      return apiResponse.badRequest(res, 'Buy price must be less than sell price');
    }
    
    // Get the company
    const companyData = await storage.getUnlistedCompanyById(companyId);
    if (!companyData) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const company = companyData as any;
    
    // Check if already published
    const existingProduct = await storage.getStoreProductBySourceCompanyId(companyId);
    if (existingProduct) {
      // Update existing product with new prices
      const updatedProduct = await storage.updateStoreProduct(existingProduct.id, {
        buyPrice: parsedBuyPrice.toString(),
        sellPrice: parsedSellPrice.toString(),
        price: parsedSellPrice.toString(), // Use sell price as display price
        priceSource: priceSource || 'manual',
        priceUpdatedAt: new Date(),
        priceMetadata: JSON.stringify({
          updatedBy: req.user?.id,
          updatedAt: new Date().toISOString(),
          source: priceSource || 'manual',
        }),
      });
      
      return apiResponse.success(res, {
        message: 'Store product prices updated successfully',
        product: {
          id: updatedProduct.id,
          name: updatedProduct.name,
          buyPrice: updatedProduct.buyPrice,
          sellPrice: updatedProduct.sellPrice,
        },
        action: 'updated',
      });
    }
    
    // Get or create Unlisted Shares category
    let unlistedCategory = await storage.getStoreCategoryBySlug('unlisted');
    if (!unlistedCategory) {
      unlistedCategory = await storage.createStoreCategory({
        name: 'Unlisted Shares',
        description: 'Pre-IPO and unlisted company shares for sophisticated investors',
        slug: 'unlisted',
        icon: 'TrendingUp',
        displayOrder: 10,
        isActive: true,
      });
    }
    
    // Get or create subcategory for sector
    let subcategory = null;
    if (company.sector) {
      const sectorSlug = company.sector.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      subcategory = await storage.getStoreSubcategoryBySlug(sectorSlug);
      if (!subcategory) {
        subcategory = await storage.createStoreSubcategory({
          name: company.sector,
          description: `Unlisted shares in the ${company.sector} sector`,
          slug: sectorSlug,
          categoryId: unlistedCategory.id,
          displayOrder: 0,
          isActive: true,
        });
      }
    }
    
    // Create the store product with prices
    const productData = {
      name: company.name,
      shortDescription: `Unlisted shares of ${company.name} - ${company.sector || 'Technology'} sector`,
      fullDescription: company.description || `Invest in ${company.name}, an unlisted company in the ${company.sector || 'Technology'} sector.`,
      categoryId: unlistedCategory.id,
      subcategoryId: subcategory?.id,
      productType: 'unlisted_stock',
      productKey: `UNLISTED-${company.cin || company.id}`,
      price: parsedSellPrice.toString(),
      buyPrice: parsedBuyPrice.toString(),
      sellPrice: parsedSellPrice.toString(),
      priceSource: priceSource || 'manual',
      priceUpdatedAt: new Date(),
      priceMetadata: JSON.stringify({
        setBy: req.user?.id,
        setAt: new Date().toISOString(),
        source: priceSource || 'manual',
      }),
      currency: 'INR',
      minimumInvestment: company.minLotSize ? String(Number(company.minLotSize) * parsedSellPrice) : '10000',
      riskLevel: 'high',
      features: JSON.stringify([
        'Enhanced KYC Required',
        'Pre-IPO Investment Opportunity',
        `Sector: ${company.sector || 'Technology'}`,
      ]),
      eligibility: JSON.stringify({
        kycLevel: 'enhanced',
        minNetWorth: 2500000,
        investorType: ['accredited', 'qualified'],
      }),
      documents: JSON.stringify([
        'PAN Card',
        'Address Proof',
        'Bank Statement',
        'Net Worth Certificate',
      ]),
      provider: company.name,
      providerCode: company.cin || company.id,
      regulatory: JSON.stringify({
        cin: company.cin,
        isin: company.isin,
        sector: company.sector,
        listingStage: company.listingStage,
      }),
      isActive: company.status === 'active',
      isFeatured: false,
      displayOrder: 0,
      visibleToClients: true,
      visibleToPartners: true,
      visibleToAgents: true,
      visibleToGuests: false,
      showInquiryForm: true,
      sourceCompanyId: company.id,
      lotSize: company.minLotSize || 1,
      faceValue: company.faceValue || null,
      marketCap: company.marketCap || null,
      peRatio: company.peRatio || null,
    };
    
    const product = await storage.createStoreProduct(productData);
    
    return apiResponse.created(res, {
      message: `${company.name} published to store with prices`,
      product: {
        id: product.id,
        name: product.name,
        buyPrice: product.buyPrice,
        sellPrice: product.sellPrice,
      },
      category: {
        id: unlistedCategory.id,
        name: unlistedCategory.name,
      },
      action: 'created',
    });
  } catch (error: any) {
    console.error('Error publishing to store with prices:', error);
    return apiResponse.serverError(res, 'Failed to publish company to store');
  }
});

/**
 * PATCH /api/unlisted/admin/update-store-prices/:productId
 * Update buy/sell prices for an existing store product (Admin only)
 */
router.patch('/admin/update-store-prices/:productId', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { productId } = req.params;
    const { buyPrice, sellPrice, priceSource } = req.body;
    
    // Validate prices
    if (!buyPrice || !sellPrice) {
      return apiResponse.badRequest(res, 'Both buyPrice and sellPrice are required');
    }
    
    const parsedBuyPrice = parseFloat(buyPrice);
    const parsedSellPrice = parseFloat(sellPrice);
    
    if (isNaN(parsedBuyPrice) || isNaN(parsedSellPrice)) {
      return apiResponse.badRequest(res, 'Invalid price values');
    }
    
    if (parsedBuyPrice <= 0 || parsedSellPrice <= 0) {
      return apiResponse.badRequest(res, 'Prices must be positive');
    }
    
    if (parsedBuyPrice >= parsedSellPrice) {
      return apiResponse.badRequest(res, 'Buy price must be less than sell price');
    }
    
    // Update the product
    const updatedProduct = await storage.updateStoreProduct(productId, {
      buyPrice: parsedBuyPrice.toString(),
      sellPrice: parsedSellPrice.toString(),
      price: parsedSellPrice.toString(),
      priceSource: priceSource || 'manual',
      priceUpdatedAt: new Date(),
      priceMetadata: JSON.stringify({
        updatedBy: req.user?.id,
        updatedAt: new Date().toISOString(),
        source: priceSource || 'manual',
      }),
    });
    
    return apiResponse.success(res, {
      message: 'Prices updated successfully',
      product: {
        id: updatedProduct.id,
        name: updatedProduct.name,
        buyPrice: updatedProduct.buyPrice,
        sellPrice: updatedProduct.sellPrice,
        priceSource: updatedProduct.priceSource,
        priceUpdatedAt: updatedProduct.priceUpdatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating store prices:', error);
    return apiResponse.serverError(res, 'Failed to update prices');
  }
});

// ===================================================================
// MONEYCONTROL RECONCILIATION ROUTES (Admin only)
// ===================================================================

/**
 * GET /api/unlisted/admin/reconciliation/moneycontrol
 * Get list of companies on MoneyControl that are not in FintekPro (Admin only)
 */
router.get('/admin/reconciliation/moneycontrol', requireAdmin, async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const result = await moneyControlReconciliation.getReconciliationSuggestions(forceRefresh);
    
    return apiResponse.success(res, result);
  } catch (error: any) {
    console.error('Error fetching MoneyControl reconciliation:', error);
    return apiResponse.serverError(res, error.message || 'Failed to fetch reconciliation data');
  }
});

/**
 * POST /api/unlisted/admin/reconciliation/refresh
 * Force refresh the MoneyControl cache (Admin only)
 */
router.post('/admin/reconciliation/refresh', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await moneyControlReconciliation.getReconciliationSuggestions(true);
    
    return apiResponse.success(res, {
      message: 'Cache refreshed successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error refreshing MoneyControl cache:', error);
    return apiResponse.serverError(res, error.message || 'Failed to refresh cache');
  }
});

const moneyControlCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  isin: z.string().min(12).max(12).regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, 'Invalid ISIN format'),
  price: z.number().positive('Price must be positive'),
  change: z.number().optional().default(0),
  changePercent: z.number().optional().default(0),
  previousClose: z.number().optional().default(0),
  sector: z.string().optional(),
  scrapedAt: z.string().or(z.date()).optional(),
});

/**
 * POST /api/unlisted/admin/reconciliation/sync
 * Sync a company from MoneyControl to FintekPro (Admin only)
 */
router.post('/admin/reconciliation/sync', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { company } = req.body;
    
    if (!company) {
      return apiResponse.badRequest(res, 'Company data is required');
    }
    
    const validationResult = moneyControlCompanySchema.safeParse(company);
    if (!validationResult.success) {
      return apiResponse.badRequest(res, 'Invalid company data', validationResult.error.errors);
    }
    
    const validatedCompany = validationResult.data;
    
    const synced = await moneyControlReconciliation.syncCompanyFromMoneyControl({
      ...validatedCompany,
      scrapedAt: validatedCompany.scrapedAt ? new Date(validatedCompany.scrapedAt) : new Date(),
    }, (req.user as any)?.id);
    
    return apiResponse.created(res, {
      message: 'Company synced successfully',
      company: synced,
    });
  } catch (error: any) {
    console.error('Error syncing company from MoneyControl:', error);
    return apiResponse.serverError(res, error.message || 'Failed to sync company');
  }
});

/**
 * POST /api/unlisted/admin/reconciliation/sync-batch
 * Sync multiple companies from MoneyControl to FintekPro (Admin only)
 */
router.post('/admin/reconciliation/sync-batch', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companies } = req.body;
    
    if (!Array.isArray(companies) || companies.length === 0) {
      return apiResponse.badRequest(res, 'Companies array is required');
    }
    
    if (companies.length > 50) {
      return apiResponse.badRequest(res, 'Maximum 50 companies per batch');
    }
    
    const validatedCompanies = [];
    const validationErrors = [];
    
    for (let i = 0; i < companies.length; i++) {
      const result = moneyControlCompanySchema.safeParse(companies[i]);
      if (result.success) {
        validatedCompanies.push({
          ...result.data,
          scrapedAt: result.data.scrapedAt ? new Date(result.data.scrapedAt) : new Date(),
        });
      } else {
        validationErrors.push({ index: i, name: companies[i]?.name, errors: result.error.errors });
      }
    }
    
    if (validatedCompanies.length === 0) {
      return apiResponse.badRequest(res, 'No valid companies to sync', validationErrors);
    }
    
    const result = await moneyControlReconciliation.syncMultipleCompanies(validatedCompanies, req.user?.id);
    
    return apiResponse.success(res, {
      message: `Synced ${result.success.length} companies, ${result.failed.length} failed`,
      success: result.success,
      failed: result.failed,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    });
  } catch (error: any) {
    console.error('Error batch syncing companies:', error);
    return apiResponse.serverError(res, error.message || 'Failed to batch sync companies');
  }
});

/**
 * GET /api/unlisted/admin/reconciliation/cache-status
 * Get current cache status (Admin only)
 */
router.get('/admin/reconciliation/cache-status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = moneyControlReconciliation.getCacheStatus();
    return apiResponse.success(res, status);
  } catch (error: any) {
    console.error('Error getting cache status:', error);
    return apiResponse.serverError(res, 'Failed to get cache status');
  }
});

// ===================================================================
// UNIFIED SEARCH ROUTES (Admin only)
// Search across MoneyControl and CredHive simultaneously
// ===================================================================

interface UnifiedSearchResult {
  id: string;
  name: string;
  isin?: string;
  cin?: string;
  pan?: string;
  sector?: string;
  status?: string;
  incorporationDate?: string;
  source: 'moneycontrol' | 'credhive' | 'mca' | 'fintekpro';
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  isInFintekPro: boolean;
  fintekProId?: string;
  dataQuality?: number;
  rawData: any;
}

interface SourceError {
  code: number;
  message: string;
  troubleshooting: string;
  isRetryable: boolean;
}

interface SourceStatus {
  searched: boolean;
  resultCount: number;
  error?: SourceError;
  usedMockData?: boolean;
}

/**
 * GET /api/unlisted/admin/unified-search
 * Search companies across multiple data sources (Admin only)
 * Priority: FintekPro (internal) → MoneyControl → MCA → Credhive
 */
router.get('/admin/unified-search', requireAdmin, async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    
    if (!query || query.length < 2) {
      return apiResponse.badRequest(res, 'Search query must be at least 2 characters');
    }

    const results: UnifiedSearchResult[] = [];
    const existingCompanies = await storage.getAllUnlistedCompanies({});
    const existingIsins = new Set(existingCompanies.map((c: UnlistedCompany) => c.isin).filter(Boolean));
    const existingCins = new Set(existingCompanies.map((c: UnlistedCompany) => c.cin).filter(Boolean));
    const queryLower = query.toLowerCase();
    const seenCins = new Set<string>();
    const seenIsins = new Set<string>();
    
    // Track source statuses for detailed error reporting
    const sourceStatuses: Record<string, SourceStatus> = {
      moneycontrol: { searched: false, resultCount: 0 },
      mca: { searched: false, resultCount: 0 },
      credhive: { searched: false, resultCount: 0 }
    };

    // Search all sources in parallel with detailed error tracking
    const [moneyControlResults, mcaResults, credhiveResults] = await Promise.allSettled([
      // MoneyControl (price data)
      (async () => {
        sourceStatuses.moneycontrol.searched = true;
        try {
          const cached = await moneyControlReconciliation.getReconciliationSuggestions(false);
          const allCompanies = cached.suggestions.map(s => s.externalCompany);
          const filtered = allCompanies.filter((c: any) => 
            c.name.toLowerCase().includes(queryLower) ||
            c.isin?.toLowerCase().includes(queryLower)
          );
          sourceStatuses.moneycontrol.resultCount = filtered.length;
          return filtered;
        } catch (e: any) {
          console.error('MoneyControl search error:', e);
          sourceStatuses.moneycontrol.error = {
            code: 500,
            message: e.message || 'Unknown error',
            troubleshooting: 'MoneyControl data fetch failed. This is a web scraping source and may be temporarily unavailable.',
            isRetryable: true
          };
          return [];
        }
      })(),
      // MCA (official company filings via Sandbox.co.in)
      // Note: MCA doesn't have a search API, requires direct CIN lookup
      (async () => {
        // Check if query looks like a CIN (21 characters)
        const isCinFormat = query.length === 21 && /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(query);
        
        if (!isCinFormat) {
          // MCA doesn't support name search - only CIN lookup
          sourceStatuses.mca.searched = false;
          sourceStatuses.mca.error = {
            code: 400,
            message: 'MCA requires CIN lookup',
            troubleshooting: 'MCA (Sandbox.co.in API) only supports direct CIN lookup, not company name search. Enter a valid 21-character CIN to search MCA.',
            isRetryable: false
          };
          return [];
        }
        
        sourceStatuses.mca.searched = true;
        const mcaResult = await mcaService.getCompanyByCINWithDetails(query);
        
        if (mcaResult.success && mcaResult.data) {
          sourceStatuses.mca.resultCount = 1;
          return [mcaResult.data];
        } else if (mcaResult.error) {
          sourceStatuses.mca.error = mcaResult.error;
          return [];
        }
        return [];
      })(),
      // Credhive (unlisted company intelligence)
      (async () => {
        if (query.length < 3) {
          sourceStatuses.credhive.searched = false;
          return [];
        }
        
        sourceStatuses.credhive.searched = true;
        const credhiveResult = await credhiveService.searchCompanies(query);
        
        if (credhiveResult.success && credhiveResult.data) {
          sourceStatuses.credhive.resultCount = credhiveResult.data.length;
          return credhiveResult.data.map((c: any) => ({
            company_id: c.cin,
            name: c.company_name,
            cin: c.cin,
            status: c.status,
            incorporation_date: c.date_of_incorporation,
          }));
        } else if (credhiveResult.error) {
          sourceStatuses.credhive.error = { code: 503, message: credhiveResult.error, troubleshooting: 'Credhive API unavailable', isRetryable: true };
          return [];
        }
        return [];
      })()
    ]);

    // Process MoneyControl results (for price data)
    if (moneyControlResults.status === 'fulfilled') {
      for (const company of moneyControlResults.value) {
        if (company.isin && seenIsins.has(company.isin)) continue;
        if (company.isin) seenIsins.add(company.isin);
        
        const isInFintekPro = existingIsins.has(company.isin);
        const existing = isInFintekPro 
          ? existingCompanies.find((c: UnlistedCompany) => c.isin === company.isin)
          : null;

        results.push({
          id: `mc_${company.isin}`,
          name: company.name,
          isin: company.isin,
          sector: company.sector,
          source: 'moneycontrol',
          currentPrice: company.price,
          priceChange: company.change,
          priceChangePercent: company.changePercent,
          isInFintekPro,
          fintekProId: existing?.id || undefined,
          dataQuality: 70,
          rawData: company,
        });
      }
    }

    // Process MCA results (official government filings)
    if (mcaResults.status === 'fulfilled') {
      for (const company of mcaResults.value) {
        if (company.cin && seenCins.has(company.cin)) continue;
        if (company.cin) seenCins.add(company.cin);
        
        const isInFintekPro = company.cin ? existingCins.has(company.cin) : false;
        const existing = company.cin 
          ? existingCompanies.find((c: UnlistedCompany) => c.cin === company.cin)
          : null;

        results.push({
          id: `mca_${company.cin}`,
          name: company.companyName,
          cin: company.cin,
          status: company.companyStatus,
          source: 'mca',
          isInFintekPro,
          fintekProId: existing?.id || undefined,
          dataQuality: 90,
          rawData: company,
        });
      }
    }

    // Process Credhive results
    if (credhiveResults.status === 'fulfilled') {
      for (const company of credhiveResults.value) {
        if (company.cin && seenCins.has(company.cin)) continue;
        if (company.cin) seenCins.add(company.cin);
        
        const isInFintekPro = existingCins.has(company.cin);
        const existing = existingCompanies.find((c: UnlistedCompany) => c.cin === company.cin);

        results.push({
          id: `ch_${company.cin}`,
          name: company.name,
          cin: company.cin,
          status: company.status,
          incorporationDate: company.incorporation_date,
          source: 'credhive',
          isInFintekPro,
          fintekProId: existing?.id || undefined,
          dataQuality: 75,
          rawData: company,
        });
      }
    }

    // Sort: non-FintekPro first, then by data quality, then by name
    results.sort((a, b) => {
      if (a.isInFintekPro !== b.isInFintekPro) {
        return a.isInFintekPro ? 1 : -1;
      }
      if ((a.dataQuality || 0) !== (b.dataQuality || 0)) {
        return (b.dataQuality || 0) - (a.dataQuality || 0);
      }
      return a.name.localeCompare(b.name);
    });

    return apiResponse.success(res, {
      query,
      totalResults: results.length,
      results,
      sources: {
        moneycontrol: sourceStatuses.moneycontrol.resultCount,
        mca: sourceStatuses.mca.resultCount,
        credhive: sourceStatuses.credhive.resultCount,
      },
      sourceStatuses
    });
  } catch (error: any) {
    console.error('Error in unified search:', error);
    return apiResponse.serverError(res, error.message || 'Failed to search companies');
  }
});

/**
 * GET /api/unlisted/admin/company-details/:source/:id
 * Get detailed company information from a specific source for preview (Admin only)
 */
router.get('/admin/company-details/:source/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { source, id } = req.params;
    
    if (source === 'mca') {
      // MCA requires CIN for lookup
      const details = await mcaService.getCompanyByCIN(id);
      if (!details) {
        return apiResponse.notFound(res, 'Company not found in MCA records');
      }
      
      return apiResponse.success(res, {
        source: 'mca',
        company: details,
      });
    } else if (source === 'credhive') {
      const details = await credhiveService.getCompanyDetails(id);
      const financials = await credhiveService.getCompanyFinancials(id).catch(() => null);
      
      return apiResponse.success(res, {
        source: 'credhive',
        company: details,
        financials,
      });
    } else if (source === 'moneycontrol') {
      const cached = await moneyControlReconciliation.getReconciliationSuggestions(false);
      const company = cached.suggestions.find(s => s.externalCompany.isin === id);
      
      if (!company) {
        return apiResponse.notFound(res, 'Company not found in MoneyControl cache');
      }
      
      return apiResponse.success(res, {
        source: 'moneycontrol',
        company: company.externalCompany,
      });
    } else {
      return apiResponse.badRequest(res, 'Invalid source. Use "mca", "moneycontrol", or "credhive"');
    }
  } catch (error: any) {
    console.error('Error fetching company details:', error);
    return apiResponse.serverError(res, error.message || 'Failed to fetch company details');
  }
});

/**
 * GET /api/unlisted/admin/company-unified-data/:companyId
 * Get comprehensive unified data for a company from all sources (Admin only)
 */
router.get('/admin/company-unified-data/:companyId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const unifiedData = await unifiedCompanyDataService.getCompanyData(companyId);
    const valuationData = await valuationService.getValuationData({ companyId });
    
    return apiResponse.success(res, {
      companyId,
      companyName: company.name,
      ...unifiedData,
      valuation: valuationData.valuation,
    });
  } catch (error: any) {
    console.error('Error fetching unified company data:', error);
    return apiResponse.serverError(res, error.message || 'Failed to fetch unified company data');
  }
});

const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const cinRegex = /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const addToFintekProSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200, 'Company name too long'),
  isin: z.string().regex(isinRegex, 'Invalid ISIN format').optional().or(z.literal('')),
  cin: z.string().regex(cinRegex, 'Invalid CIN format').optional().or(z.literal('')),
  pan: z.string().regex(panRegex, 'Invalid PAN format').optional().or(z.literal('')),
  sector: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  incorporationDate: z.string().optional(),
  currentPrice: z.number().positive('Current price must be positive').optional(),
  buyPrice: z.number().positive('Buy price must be positive').max(10000000, 'Buy price too high').optional(),
  sellPrice: z.number().positive('Sell price must be positive').max(10000000, 'Sell price too high').optional(),
  source: z.enum(['moneycontrol', 'credhive', 'manual']),
  probe42CompanyId: z.string().optional(),
});

/**
 * POST /api/unlisted/admin/add-to-fintekpro
 * Add company to FintekPro database for review before publishing to store (Admin only)
 * This allows admin to review internal prices, client asks, and other details
 */
router.post('/admin/add-to-fintekpro', requireAdmin, async (req: Request, res: Response) => {
  try {
    const validation = addToFintekProSchema.safeParse(req.body);
    if (!validation.success) {
      return apiResponse.badRequest(res, 'Invalid request data', validation.error.errors);
    }

    const data = validation.data;
    const userId = (req.user as any)?.id;

    if (!data.isin && !data.cin) {
      return apiResponse.badRequest(res, 'Either ISIN or CIN is required');
    }

    const existingCompanies = await storage.getAllUnlistedCompanies({});
    const existingCompany = existingCompanies.find((c: UnlistedCompany) => 
      (data.isin && c.isin === data.isin) || (data.cin && c.cin === data.cin)
    );

    if (existingCompany) {
      return apiResponse.badRequest(res, 'This company already exists in FintekPro', {
        companyId: existingCompany.id,
        companyName: existingCompany.name
      });
    }

    const companyData: any = {
      name: data.name,
      isin: data.isin || '',
      cin: data.cin || '',
      sector: data.sector || 'Unlisted',
      status: data.status || 'active',
      isActive: true,
      probe42CompanyId: data.probe42CompanyId,
      currentPrice: data.currentPrice?.toString(),
      lastPrice: data.currentPrice?.toString(),
      metadata: {
        source: data.source,
        addedBy: userId,
        addedAt: new Date().toISOString(),
        initialBuyPrice: data.buyPrice,
        initialSellPrice: data.sellPrice,
        incorporationDate: data.incorporationDate,
        pan: data.pan,
      }
    };

    const newCompany = await storage.createUnlistedCompany(companyData);
    console.log(`[Add to FintekPro] Created new unlisted company: ${newCompany.id} - ${data.name} by admin ${userId}`);

    return apiResponse.created(res, {
      message: 'Company added to FintekPro successfully. You can now review it in the Unlisted Companies list and publish to store when ready.',
      company: newCompany,
    });
  } catch (error: any) {
    console.error('Error adding company to FintekPro:', error);
    return apiResponse.serverError(res, error.message || 'Failed to add company to FintekPro');
  }
});

const publishCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(200, 'Company name too long'),
  isin: z.string().regex(isinRegex, 'Invalid ISIN format').optional().or(z.literal('')),
  cin: z.string().regex(cinRegex, 'Invalid CIN format').optional().or(z.literal('')),
  pan: z.string().regex(panRegex, 'Invalid PAN format').optional().or(z.literal('')),
  sector: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  incorporationDate: z.string().optional(),
  currentPrice: z.number().positive('Current price must be positive').optional(),
  buyPrice: z.number().positive('Buy price must be positive').max(10000000, 'Buy price too high'),
  sellPrice: z.number().positive('Sell price must be positive').max(10000000, 'Sell price too high'),
  source: z.enum(['moneycontrol', 'credhive', 'manual']),
  probe42CompanyId: z.string().optional(),
}).refine(data => data.sellPrice > data.buyPrice, {
  message: 'Sell price must be greater than buy price',
  path: ['sellPrice'],
});

/**
 * POST /api/unlisted/admin/publish-to-store
 * Create unlisted company and publish to store in one action (Admin only)
 */
router.post('/admin/publish-to-store', requireAdmin, async (req: Request, res: Response) => {
  try {
    const validation = publishCompanySchema.safeParse(req.body);
    if (!validation.success) {
      return apiResponse.badRequest(res, 'Invalid request data', validation.error.errors);
    }

    const data = validation.data;
    const userId = (req.user as any)?.id;

    if (!data.isin && !data.cin) {
      return apiResponse.badRequest(res, 'Either ISIN or CIN is required');
    }

    const existingCompanies = await storage.getAllUnlistedCompanies({});
    let existingCompany = existingCompanies.find((c: UnlistedCompany) => 
      (data.isin && c.isin === data.isin) || (data.cin && c.cin === data.cin)
    );

    if (!existingCompany) {
      const companyData: any = {
        name: data.name,
        isin: data.isin || '',
        cin: data.cin || '',
        sector: data.sector || 'Unlisted',
        isActive: true,
        probe42CompanyId: data.probe42CompanyId,
      };

      existingCompany = await storage.createUnlistedCompany(companyData);
      console.log(`[Publish] Created new unlisted company: ${existingCompany.id} - ${data.name}`);
    }

    const allStoreProducts = await storage.getAllStoreProducts();
    const existingProduct = allStoreProducts.find((p: any) => 
      p.category === 'unlisted' && p.sourceCompanyId === existingCompany!.id
    );

    if (existingProduct) {
      return apiResponse.badRequest(res, 'This company is already published to the store');
    }

    const storeProduct = await storage.createStoreProduct({
      name: data.name,
      description: `Unlisted shares of ${data.name}`,
      category: 'unlisted',
      subcategory: data.sector || 'General',
      price: data.currentPrice?.toString() || '0',
      buyPrice: data.buyPrice.toString(),
      sellPrice: data.sellPrice.toString(),
      isActive: true,
      sourceCompanyId: existingCompany.id,
      metadata: {
        isin: data.isin,
        cin: data.cin,
        pan: data.pan,
        sector: data.sector,
        source: data.source,
        publishedAt: new Date().toISOString(),
        publishedBy: userId,
      },
    });

    return apiResponse.created(res, {
      message: 'Company published to store successfully',
      company: existingCompany,
      storeProduct,
    });
  } catch (error: any) {
    console.error('Error publishing company to store:', error);
    return apiResponse.serverError(res, error.message || 'Failed to publish company');
  }
});

// ===================================================================
// PRICING WORKFLOW ROUTES (Admin Only)
// ===================================================================

/**
 * POST /api/unlisted/companies/:companyId/save-draft-prices
 * Save draft prices for a company (Admin only)
 */
router.post('/companies/:companyId/save-draft-prices', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { buyPrice, sellPrice } = req.body;
    const userId = (req.user as any)?.id;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    if (typeof buyPrice !== 'number' || typeof sellPrice !== 'number') {
      return apiResponse.badRequest(res, 'buyPrice and sellPrice must be numbers');
    }

    const result = await unlistedPricingWorkflowService.saveDraftPrices(
      companyId,
      buyPrice,
      sellPrice,
      userId,
      ipAddress,
      userAgent
    );

    if (!result.success) {
      return apiResponse.badRequest(res, result.message);
    }

    return apiResponse.success(res, result, 'Draft prices saved successfully');
  } catch (error: any) {
    console.error('Error saving draft prices:', error);
    return apiResponse.serverError(res, 'Failed to save draft prices');
  }
});

/**
 * GET /api/unlisted/companies/:companyId/validate-prices
 * Validate prices for a company (Admin only)
 */
router.get('/companies/:companyId/validate-prices', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const buyPrice = Number(req.query.buyPrice);
    const sellPrice = Number(req.query.sellPrice);

    if (isNaN(buyPrice) || isNaN(sellPrice)) {
      return apiResponse.badRequest(res, 'buyPrice and sellPrice query parameters are required and must be numbers');
    }

    const result = await unlistedPricingWorkflowService.validatePrices(companyId, buyPrice, sellPrice);
    return apiResponse.success(res, result);
  } catch (error: any) {
    console.error('Error validating prices:', error);
    return apiResponse.serverError(res, 'Failed to validate prices');
  }
});

/**
 * POST /api/unlisted/companies/:companyId/publish-prices
 * Publish draft prices for a company (Admin only)
 */
router.post('/companies/:companyId/publish-prices', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const userId = (req.user as any)?.id;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    const result = await unlistedPricingWorkflowService.publishPrices(
      companyId,
      userId,
      ipAddress,
      userAgent
    );

    if (!result.success) {
      return apiResponse.badRequest(res, result.message);
    }

    return apiResponse.success(res, result, 'Prices published successfully');
  } catch (error: any) {
    console.error('Error publishing prices:', error);
    return apiResponse.serverError(res, 'Failed to publish prices');
  }
});

/**
 * POST /api/unlisted/companies/:companyId/check-compliance
 * Run compliance check and update company status (Admin only)
 */
router.post('/companies/:companyId/check-compliance', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    
    const result = await unlistedPricingWorkflowService.checkComplianceAndUpdate(companyId);
    return apiResponse.success(res, result, 'Compliance check completed');
  } catch (error: any) {
    console.error('Error checking compliance:', error);
    return apiResponse.serverError(res, 'Failed to check compliance');
  }
});

/**
 * POST /api/unlisted/companies/:companyId/suspend-trading
 * Suspend trading for a company (Admin only)
 */
router.post('/companies/:companyId/suspend-trading', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { reason } = req.body;
    const userId = (req.user as any)?.id;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    if (!reason || typeof reason !== 'string') {
      return apiResponse.badRequest(res, 'reason is required');
    }

    const result = await unlistedPricingWorkflowService.suspendTrading(
      companyId,
      reason,
      userId,
      ipAddress,
      userAgent
    );

    if (!result.success) {
      return apiResponse.badRequest(res, result.message);
    }

    return apiResponse.success(res, result, 'Trading suspended successfully');
  } catch (error: any) {
    console.error('Error suspending trading:', error);
    return apiResponse.serverError(res, 'Failed to suspend trading');
  }
});

/**
 * POST /api/unlisted/companies/:companyId/resume-trading
 * Resume trading for a company (Admin only)
 */
router.post('/companies/:companyId/resume-trading', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const userId = (req.user as any)?.id;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');

    const result = await unlistedPricingWorkflowService.resumeTrading(
      companyId,
      userId,
      ipAddress,
      userAgent
    );

    if (!result.success) {
      return apiResponse.badRequest(res, result.message);
    }

    return apiResponse.success(res, result, 'Trading resumed successfully');
  } catch (error: any) {
    console.error('Error resuming trading:', error);
    return apiResponse.serverError(res, 'Failed to resume trading');
  }
});

/**
 * GET /api/unlisted/companies/:companyId/audit-log
 * Get audit log for a company (Admin only)
 */
router.get('/companies/:companyId/audit-log', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const limit = Number(req.query.limit) || 50;

    const logs = await unlistedPricingWorkflowService.getAuditLog(companyId, limit);
    return apiResponse.success(res, logs);
  } catch (error: any) {
    console.error('Error fetching audit log:', error);
    return apiResponse.serverError(res, 'Failed to fetch audit log');
  }
});

// ===================================================================
// RISK DISCLOSURE ROUTES
// ===================================================================

/**
 * GET /api/unlisted/risk-disclosures
 * Get all risk disclosures for display to user
 */
router.get('/risk-disclosures', async (req: Request, res: Response) => {
  try {
    const disclosures = unlistedRiskDisclosureService.formatDisclosuresForDisplay();
    return apiResponse.success(res, disclosures);
  } catch (error: any) {
    console.error('Error fetching risk disclosures:', error);
    return apiResponse.serverError(res, 'Failed to fetch risk disclosures');
  }
});

/**
 * GET /api/unlisted/risk-disclosures/:companyId
 * Get risk disclosures with company-specific risks
 */
router.get('/risk-disclosures/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const financialsList = await storage.getCompanyFinancials(companyId);
    const financials = financialsList && financialsList.length > 0 ? financialsList[0] : null;
    
    const disclosures = unlistedRiskDisclosureService.formatDisclosuresForDisplay();
    const companySpecificRisks = unlistedRiskDisclosureService.getCompanySpecificRisks({
      netWorth: financials?.netWorth ? parseFloat(financials.netWorth) : undefined,
      debtEquityRatio: financials?.debtEquityRatio ? parseFloat(financials.debtEquityRatio) : undefined,
      profitMargin: financials?.profitMargin ? parseFloat(financials.profitMargin) : undefined,
    });
    
    return apiResponse.success(res, {
      ...disclosures,
      companySpecificRisks,
      company: { id: company.id, name: company.name },
    });
  } catch (error: any) {
    console.error('Error fetching company risk disclosures:', error);
    return apiResponse.serverError(res, 'Failed to fetch risk disclosures');
  }
});

/**
 * POST /api/unlisted/risk-disclosures/acknowledge
 * Submit risk disclosure acknowledgment
 * Regulatory: Required before any unlisted securities trade
 */
router.post('/risk-disclosures/acknowledge', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const { companyId, tradeType, acknowledgedDisclosureIds, companySpecificRisksAcknowledged } = req.body;
    
    if (!companyId || !tradeType || !acknowledgedDisclosureIds) {
      return apiResponse.badRequest(res, 'companyId, tradeType, and acknowledgedDisclosureIds are required');
    }
    
    if (!['buy', 'sell'].includes(tradeType)) {
      return apiResponse.badRequest(res, 'tradeType must be "buy" or "sell"');
    }
    
    const result = await saveRiskAcknowledgment({
      userId,
      companyId,
      tradeType,
      acknowledgedDisclosureIds,
      companySpecificRisksAcknowledged,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
    
    if (!result.success) {
      return apiResponse.badRequest(res, result.error || 'Failed to save acknowledgment');
    }
    
    return apiResponse.success(res, {
      acknowledged: true,
      record: result.record,
      message: 'Risk disclosures acknowledged successfully. You may now proceed with your order.',
    });
  } catch (error: any) {
    console.error('Error saving risk disclosure acknowledgment:', error);
    return apiResponse.serverError(res, 'Failed to save acknowledgment');
  }
});

// ===================================================================
// ESCROW PAYMENT ROUTES
// ===================================================================

import { unlistedEscrowService } from '../services/unlisted-escrow-service';
import { ObjectStorageService } from '../objectStorage';

const objectStorage = new ObjectStorageService();

/**
 * POST /api/unlisted/deals/:dealId/initiate-payment
 * Buyer initiates escrow payment for a confirmed deal
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */
router.post('/deals/:dealId/initiate-payment', requireAuth, requireLevel2, requireRiskDisclosure('buy'), async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const user = req.user as any;
    const { returnUrl } = req.body;

    const deal = await storage.getUnlistedDealById(dealId);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }

    const result = await unlistedEscrowService.initiateEscrowPayment({
      dealId,
      buyerUserId: user.id,
      buyerEmail: user.email,
      buyerPhone: user.phone,
      buyerName: user.name || user.firstName,
      returnUrl
    });

    if (!result.success) {
      return apiResponse.badRequest(res, result.message || 'Failed to initiate payment');
    }

    // Archive payment initiation event for immutable audit log
    const totalValue = parseFloat(deal.totalValue || '0');
    await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
      eventType: 'payment_initiated',
      userId: user.id,
      dealId,
      companyId: deal.companyId,
      action: 'Buyer initiated escrow payment',
      details: {
        totalValue,
        quantity: deal.quantity,
        agreedPrice: deal.agreedPrice,
        orderId: result.orderId,
      },
      riskLevel: totalValue >= 5000000 ? 'high' : 'low',
    });

    // Register regulatory event for high-value payments
    if (totalValue >= 1000000) {
      await regulatoryReportingService.registerReportableEvent({
        eventType: 'payment_initiation',
        triggeredBy: 'user_action',
        userId: user.id,
        dealId,
        amount: totalValue,
        currency: 'INR',
        riskIndicators: totalValue >= 5000000 ? ['high_value_transaction'] : [],
        riskScore: totalValue >= 5000000 ? 45 : 25,
        metadata: {
          companyId: deal.companyId,
          orderId: result.orderId,
        },
      });
    }

    return apiResponse.success(res, result, 'Payment initiated successfully');
  } catch (error: any) {
    console.error('Error initiating escrow payment:', error);
    return apiResponse.serverError(res, 'Failed to initiate payment');
  }
});

/**
 * GET /api/unlisted/deals/:dealId/payment-status
 * Get escrow payment status for a deal
 */
router.get('/deals/:dealId/payment-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const user = req.user as any;

    const deal = await storage.getUnlistedDealById(dealId);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }

    if (deal.buyerUserId !== user.id && deal.sellerUserId !== user.id) {
      return apiResponse.forbidden(res, 'Not authorized to view this deal');
    }

    const status = await unlistedEscrowService.getEscrowStatus(dealId);
    return apiResponse.success(res, status);
  } catch (error: any) {
    console.error('Error fetching payment status:', error);
    return apiResponse.serverError(res, 'Failed to fetch payment status');
  }
});

/**
 * GET /api/unlisted/deals/:dealId/fee-breakdown
 * Get fee breakdown for a deal before payment
 */
router.get('/deals/:dealId/fee-breakdown', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const user = req.user as any;

    const deal = await storage.getUnlistedDealById(dealId);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }

    if (deal.buyerUserId !== user.id && deal.sellerUserId !== user.id) {
      return apiResponse.forbidden(res, 'Not authorized to view this deal');
    }

    const totalValue = parseFloat(deal.totalValue);
    const fees = unlistedEscrowService.calculateFees(totalValue);

    return apiResponse.success(res, {
      dealId,
      quantity: deal.quantity,
      pricePerShare: parseFloat(deal.agreedPrice),
      totalValue,
      ...fees
    });
  } catch (error: any) {
    console.error('Error calculating fees:', error);
    return apiResponse.serverError(res, 'Failed to calculate fees');
  }
});

/**
 * POST /api/unlisted/deals/:dealId/mark-transfer-pending
 * Seller marks share transfer as initiated
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */
router.post('/deals/:dealId/mark-transfer-pending', requireAuth, requireLevel2, requireRiskDisclosure('sell'), async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const user = req.user as any;
    const { disSlipId } = req.body;

    const deal = await storage.getUnlistedDealById(dealId);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }

    const result = await unlistedEscrowService.markTransferPending(dealId, user.id, disSlipId);

    if (!result.success) {
      return apiResponse.badRequest(res, result.message);
    }

    // Archive transfer pending event for immutable audit log
    const totalValue = parseFloat(deal.totalValue || '0');
    await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
      eventType: 'transfer_pending',
      userId: user.id,
      dealId,
      companyId: deal.companyId,
      action: 'Seller marked share transfer as pending',
      details: {
        totalValue,
        quantity: deal.quantity,
        disSlipId,
      },
      riskLevel: totalValue >= 5000000 ? 'high' : 'low',
    });

    // Register regulatory event for high-value transfers
    if (totalValue >= 1000000) {
      await regulatoryReportingService.registerReportableEvent({
        eventType: 'transfer_initiated',
        triggeredBy: 'user_action',
        userId: user.id,
        dealId,
        amount: totalValue,
        currency: 'INR',
        riskIndicators: totalValue >= 5000000 ? ['high_value_transaction'] : [],
        riskScore: totalValue >= 5000000 ? 45 : 25,
        metadata: {
          companyId: deal.companyId,
          disSlipId,
        },
      });
    }

    return apiResponse.success(res, result, 'Transfer marked as pending');
  } catch (error: any) {
    console.error('Error marking transfer pending:', error);
    return apiResponse.serverError(res, 'Failed to update transfer status');
  }
});

/**
 * GET /api/unlisted/payment/callback
 * Handle payment gateway callback
 */
router.get('/payment/callback', async (req: Request, res: Response) => {
  try {
    const { order_id, escrow_id, deal_id } = req.query;

    if (!order_id || !escrow_id || !deal_id) {
      return res.redirect('/unlisted/my-orders?payment=error&message=Invalid callback parameters');
    }

    const result = await unlistedEscrowService.handlePaymentCallback(
      order_id as string,
      escrow_id as string,
      deal_id as string
    );

    if (result.success && result.status === 'escrowed') {
      return res.redirect(`/unlisted/my-orders?payment=success&deal=${deal_id}`);
    } else {
      return res.redirect(`/unlisted/my-orders?payment=failed&deal=${deal_id}&status=${result.status}`);
    }
  } catch (error: any) {
    console.error('Payment callback error:', error);
    return res.redirect('/unlisted/my-orders?payment=error');
  }
});

/**
 * POST /api/unlisted/payment/webhook
 * Handle Cashfree webhook for payment status updates
 */
router.post('/payment/webhook', async (req: Request, res: Response) => {
  try {
    const { order_id, order_status, cf_order_id } = req.body?.data || req.body;
    
    console.log('Received Cashfree webhook:', { order_id, order_status, cf_order_id });

    if (order_id && order_id.includes('escrow_')) {
      const parts = order_id.split('_');
      const dealId = parts[1];
      
      if (dealId) {
        await unlistedEscrowService.handlePaymentCallback(
          order_id,
          order_id,
          dealId
        );
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return res.status(200).json({ status: 'ok' });
  }
});

// ===================================================================
// ADMIN ESCROW MANAGEMENT ROUTES
// ===================================================================

/**
 * POST /api/unlisted/admin/deals/:dealId/release-escrow
 * Admin releases escrow after verifying share transfer
 */
router.post('/admin/deals/:dealId/release-escrow', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const adminUser = req.user as any;
    const { transferConfirmationId, notes, disSlipVerified, shareTransferVerified } = req.body;

    // Compliance: Route through maker-checker workflow for dual approval
    // This initiates the approval request - a second admin must approve it
    const result = await escrowMakerCheckerService.initiateApproval({
      dealId,
      makerUserId: adminUser.id,
      makerName: adminUser.name || adminUser.email,
      requestType: 'release',
      notes: notes || 'Escrow release requested',
      transferConfirmationId,
      disSlipVerified: disSlipVerified || false,
      shareTransferVerified: shareTransferVerified || false,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (!result.success) {
      return apiResponse.badRequest(res, result.error || 'Failed to initiate release approval');
    }

    // Compliance: Archive audit log for approval initiation
    try {
      const deal = await storage.getUnlistedDealById(dealId);
      if (deal) {
        await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
          eventType: 'escrow_release_initiated',
          dealId,
          userId: adminUser.id,
          amount: parseFloat(deal.totalAmount || '0'),
          metadata: { transferConfirmationId, approvalId: result.approvalId, makerAction: true }
        });
        
        const amount = parseFloat(deal.totalAmount || '0');
        if (amount >= 1000000) {
          await regulatoryReportingService.registerReportableEvent({
            eventType: 'high_value_release_initiated',
            dealId,
            amount,
            parties: { buyer: deal.buyerUserId, seller: deal.sellerUserId, maker: adminUser.id }
          });
        }
      }
    } catch (complianceError) {
      console.error('Compliance logging failed for escrow release initiation:', complianceError);
    }

    return apiResponse.success(res, result, 'Release approval initiated. Awaiting second admin approval.');
  } catch (error: any) {
    console.error('Error initiating escrow release:', error);
    return apiResponse.serverError(res, 'Failed to initiate release');
  }
});

/**
 * POST /api/unlisted/admin/deals/:dealId/refund-escrow
 * Admin refunds escrow to buyer (dispute resolution or failed transfer)
 */
router.post('/admin/deals/:dealId/refund-escrow', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const adminUser = req.user as any;
    const { reason, notes } = req.body;

    if (!reason || typeof reason !== 'string') {
      return apiResponse.badRequest(res, 'Refund reason is required');
    }

    // Compliance: Route through maker-checker workflow for dual approval
    // This initiates the approval request - a second admin must approve it
    const result = await escrowMakerCheckerService.initiateApproval({
      dealId,
      makerUserId: adminUser.id,
      makerName: adminUser.name || adminUser.email,
      requestType: 'refund',
      notes: notes || reason,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (!result.success) {
      return apiResponse.badRequest(res, result.error || 'Failed to initiate refund approval');
    }

    // Compliance: Archive audit log for approval initiation
    try {
      const deal = await storage.getUnlistedDealById(dealId);
      if (deal) {
        await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
          eventType: 'escrow_refund_initiated',
          dealId,
          userId: adminUser.id,
          amount: parseFloat(deal.totalAmount || '0'),
          metadata: { reason, approvalId: result.approvalId, makerAction: true }
        });
        
        const amount = parseFloat(deal.totalAmount || '0');
        if (amount >= 1000000) {
          await regulatoryReportingService.registerReportableEvent({
            eventType: 'high_value_refund_initiated',
            dealId,
            amount,
            parties: { buyer: deal.buyerUserId, seller: deal.sellerUserId, maker: adminUser.id },
            reason
          });
        }
      }
    } catch (complianceError) {
      console.error('Compliance logging failed for escrow refund initiation:', complianceError);
    }

    return apiResponse.success(res, result, 'Refund approval initiated. Awaiting second admin approval.');
  } catch (error: any) {
    console.error('Error initiating escrow refund:', error);
    return apiResponse.serverError(res, 'Failed to initiate refund');
  }
});

/**
 * GET /api/unlisted/admin/deals/pending-escrow
 * Get all deals pending escrow release (admin view)
 */
router.get('/admin/deals/pending-escrow', requireAdmin, async (req: Request, res: Response) => {
  try {
    const deals = await db.select()
      .from(unlistedDeals)
      .where(eq(unlistedDeals.status, 'transfer_pending'));

    return apiResponse.success(res, deals);
  } catch (error: any) {
    console.error('Error fetching pending escrow deals:', error);
    return apiResponse.serverError(res, 'Failed to fetch pending deals');
  }
});

// ===================================================================
// DOCUMENT UPLOAD ROUTES
// ===================================================================

/**
 * POST /api/unlisted/documents/upload
 * Upload document for deal verification (DIS slip, transfer confirmation)
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */
router.post('/documents/upload', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    
    const uploadUrl = await objectStorage.getObjectEntityUploadURL();
    
    return apiResponse.success(res, {
      uploadUrl,
      message: 'Upload URL generated. Use PUT request to upload file.'
    });
  } catch (error: any) {
    console.error('Error generating upload URL:', error);
    return apiResponse.serverError(res, 'Failed to generate upload URL');
  }
});

/**
 * POST /api/unlisted/deals/:dealId/documents
 * Register uploaded document for a deal
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */
router.post('/deals/:dealId/documents', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const user = req.user as any;
    const { objectPath, documentType, fileName } = req.body;

    const deal = await storage.getUnlistedDealById(dealId);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }

    if (deal.sellerUserId !== user.id && deal.buyerUserId !== user.id) {
      return apiResponse.forbidden(res, 'Not authorized');
    }

    const normalizedPath = await objectStorage.trySetObjectEntityAclPolicy(objectPath, {
      visibility: 'private',
      allowedUsers: [deal.sellerUserId, deal.buyerUserId]
    });

    const document = {
      id: `doc_${Date.now()}`,
      dealId,
      documentType,
      fileName,
      objectPath: normalizedPath,
      uploadedBy: user.id,
      uploadedAt: new Date().toISOString(),
      status: 'pending'
    };

    if (documentType === 'dis_slip' && deal.status === 'escrowed') {
      await unlistedEscrowService.markTransferPending(dealId, user.id, document.id);
    }

    return apiResponse.success(res, { document }, 'Document registered successfully');
  } catch (error: any) {
    console.error('Error registering document:', error);
    return apiResponse.serverError(res, 'Failed to register document');
  }
});

// ===================================================================
// MAKER-CHECKER ESCROW APPROVAL ROUTES (Admin Only)
// ===================================================================

import { escrowMakerCheckerService } from '../services/escrow-maker-checker';

/**
 * POST /api/unlisted/admin/escrow/initiate-approval
 * Maker (Admin 1) initiates an escrow release/refund request
 */
router.post('/admin/escrow/initiate-approval', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { dealId, requestType, notes, verificationDocuments, disSlipVerified, shareTransferVerified, transferConfirmationId } = req.body;

    if (!dealId || !requestType) {
      return apiResponse.badRequest(res, 'dealId and requestType are required');
    }

    if (!['release', 'refund'].includes(requestType)) {
      return apiResponse.badRequest(res, 'requestType must be "release" or "refund"');
    }

    const result = await escrowMakerCheckerService.initiateApproval({
      dealId,
      makerUserId: user.id,
      makerName: user.name || user.email,
      requestType,
      notes,
      verificationDocuments,
      disSlipVerified,
      shareTransferVerified,
      transferConfirmationId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (!result.success) {
      return apiResponse.badRequest(res, result.error || 'Failed to initiate approval');
    }

    return apiResponse.success(res, result, 'Approval request created. Awaiting second admin approval.');
  } catch (error: any) {
    console.error('Error initiating escrow approval:', error);
    return apiResponse.serverError(res, 'Failed to initiate approval');
  }
});

/**
 * POST /api/unlisted/admin/escrow/process-approval
 * Checker (Admin 2) approves or rejects the escrow request
 */
router.post('/admin/escrow/process-approval', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { approvalId, action, notes } = req.body;

    if (!approvalId || !action) {
      return apiResponse.badRequest(res, 'approvalId and action are required');
    }

    if (!['approved', 'rejected', 'requested_info'].includes(action)) {
      return apiResponse.badRequest(res, 'action must be "approved", "rejected", or "requested_info"');
    }

    const result = await escrowMakerCheckerService.processCheckerAction({
      approvalId,
      checkerUserId: user.id,
      checkerName: user.name || user.email,
      action,
      notes,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (!result.success) {
      return apiResponse.badRequest(res, result.error || 'Failed to process approval');
    }

    return apiResponse.success(res, result);
  } catch (error: any) {
    console.error('Error processing escrow approval:', error);
    return apiResponse.serverError(res, 'Failed to process approval');
  }
});

/**
 * GET /api/unlisted/admin/escrow/pending-approvals
 * Get pending approval requests for checker dashboard (excludes own requests)
 */
router.get('/admin/escrow/pending-approvals', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const approvals = await escrowMakerCheckerService.getPendingApprovals(user.id);
    return apiResponse.success(res, approvals);
  } catch (error: any) {
    console.error('Error fetching pending approvals:', error);
    return apiResponse.serverError(res, 'Failed to fetch pending approvals');
  }
});

/**
 * GET /api/unlisted/admin/escrow/deal/:dealId/history
 * Get approval history for a specific deal
 */
router.get('/admin/escrow/deal/:dealId/history', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const history = await escrowMakerCheckerService.getDealApprovalHistory(dealId);
    return apiResponse.success(res, history);
  } catch (error: any) {
    console.error('Error fetching deal approval history:', error);
    return apiResponse.serverError(res, 'Failed to fetch approval history');
  }
});

// ===================================================================
// SEBI/RBI REGULATORY REPORTING ROUTES (Admin Only)
// ===================================================================

import { regulatoryReportingService } from '../services/regulatory-reporting-service';

/**
 * GET /api/unlisted/admin/regulatory/reports
 * Get all regulatory reports with optional filters
 */
router.get('/admin/regulatory/reports', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, reportType, authority, startDate, endDate, userId } = req.query;
    
    const filters: any = {};
    if (status && typeof status === 'string') filters.status = status;
    if (reportType && typeof reportType === 'string') filters.reportType = reportType;
    if (authority && typeof authority === 'string') filters.authority = authority;
    if (userId && typeof userId === 'string') filters.userId = userId;
    if (startDate && typeof startDate === 'string') filters.startDate = new Date(startDate);
    if (endDate && typeof endDate === 'string') filters.endDate = new Date(endDate);

    const reports = await regulatoryReportingService.getAllReports(filters);
    return apiResponse.success(res, reports);
  } catch (error: any) {
    console.error('Error fetching regulatory reports:', error);
    return apiResponse.serverError(res, 'Failed to fetch reports');
  }
});

/**
 * GET /api/unlisted/admin/regulatory/reports/pending
 * Get reports pending review
 */
router.get('/admin/regulatory/reports/pending', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const reports = await regulatoryReportingService.getPendingReports();
    return apiResponse.success(res, reports);
  } catch (error: any) {
    console.error('Error fetching pending reports:', error);
    return apiResponse.serverError(res, 'Failed to fetch pending reports');
  }
});

/**
 * GET /api/unlisted/admin/regulatory/reports/stats
 * Get regulatory report statistics
 */
router.get('/admin/regulatory/reports/stats', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await regulatoryReportingService.getReportStats();
    return apiResponse.success(res, stats);
  } catch (error: any) {
    console.error('Error fetching report stats:', error);
    return apiResponse.serverError(res, 'Failed to fetch stats');
  }
});

/**
 * GET /api/unlisted/admin/regulatory/reports/:reportId
 * Get a specific regulatory report
 */
router.get('/admin/regulatory/reports/:reportId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const report = await regulatoryReportingService.getReport(reportId);
    
    if (!report) {
      return apiResponse.notFound(res, 'Report not found');
    }
    
    return apiResponse.success(res, report);
  } catch (error: any) {
    console.error('Error fetching report:', error);
    return apiResponse.serverError(res, 'Failed to fetch report');
  }
});

/**
 * POST /api/unlisted/admin/regulatory/reports/str
 * Create a new Suspicious Transaction Report (STR)
 */
router.post('/admin/regulatory/reports/str', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { userId, dealId, transactionIds, amount, currency, suspicionIndicators, narrative, metadata } = req.body;

    if (!userId || !suspicionIndicators || !narrative) {
      return apiResponse.badRequest(res, 'userId, suspicionIndicators, and narrative are required');
    }

    const report = await regulatoryReportingService.createSTR({
      userId,
      dealId,
      transactionIds: transactionIds || [],
      amount: amount || 0,
      currency,
      suspicionIndicators,
      narrative,
      createdBy: user.id,
      metadata,
    });

    return apiResponse.created(res, report, 'STR created successfully');
  } catch (error: any) {
    console.error('Error creating STR:', error);
    return apiResponse.serverError(res, 'Failed to create STR');
  }
});

/**
 * POST /api/unlisted/admin/regulatory/reports/ctr
 * Create a new Cash Transaction Report (CTR)
 */
router.post('/admin/regulatory/reports/ctr', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { userId, dealId, transactionIds, amount, currency, narrative, metadata } = req.body;

    if (!userId || !amount || !narrative) {
      return apiResponse.badRequest(res, 'userId, amount, and narrative are required');
    }

    const report = await regulatoryReportingService.createCTR({
      userId,
      dealId,
      transactionIds: transactionIds || [],
      amount,
      currency,
      narrative,
      createdBy: user.id,
      metadata,
    });

    return apiResponse.created(res, report, 'CTR created successfully');
  } catch (error: any) {
    console.error('Error creating CTR:', error);
    return apiResponse.serverError(res, 'Failed to create CTR');
  }
});

/**
 * POST /api/unlisted/admin/regulatory/reports/:reportId/submit-for-review
 * Submit a report for review (draft -> pending_review)
 */
router.post('/admin/regulatory/reports/:reportId/submit-for-review', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { reportId } = req.params;

    const report = await regulatoryReportingService.submitForReview(reportId, user.id);
    return apiResponse.success(res, report, 'Report submitted for review');
  } catch (error: any) {
    console.error('Error submitting report for review:', error);
    if (error.message.includes('not found')) {
      return apiResponse.notFound(res, error.message);
    }
    return apiResponse.badRequest(res, error.message);
  }
});

/**
 * POST /api/unlisted/admin/regulatory/reports/:reportId/approve
 * Approve a report (pending_review -> approved)
 */
router.post('/admin/regulatory/reports/:reportId/approve', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { reportId } = req.params;
    const { reviewNotes } = req.body;

    const report = await regulatoryReportingService.approveReport(reportId, user.id, reviewNotes);
    return apiResponse.success(res, report, 'Report approved');
  } catch (error: any) {
    console.error('Error approving report:', error);
    if (error.message.includes('not found')) {
      return apiResponse.notFound(res, error.message);
    }
    return apiResponse.badRequest(res, error.message);
  }
});

/**
 * POST /api/unlisted/admin/regulatory/reports/:reportId/reject
 * Reject a report (pending_review -> rejected)
 */
router.post('/admin/regulatory/reports/:reportId/reject', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { reportId } = req.params;
    const { reviewNotes } = req.body;

    if (!reviewNotes) {
      return apiResponse.badRequest(res, 'reviewNotes is required when rejecting a report');
    }

    const report = await regulatoryReportingService.rejectReport(reportId, user.id, reviewNotes);
    return apiResponse.success(res, report, 'Report rejected');
  } catch (error: any) {
    console.error('Error rejecting report:', error);
    if (error.message.includes('not found')) {
      return apiResponse.notFound(res, error.message);
    }
    return apiResponse.badRequest(res, error.message);
  }
});

/**
 * POST /api/unlisted/admin/regulatory/reports/:reportId/submit
 * Submit an approved report to the regulatory authority
 */
router.post('/admin/regulatory/reports/:reportId/submit', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { reportId } = req.params;

    const report = await regulatoryReportingService.submitToAuthority(reportId, user.id);
    return apiResponse.success(res, report, `Report submitted to ${report.authority}`);
  } catch (error: any) {
    console.error('Error submitting report to authority:', error);
    if (error.message.includes('not found')) {
      return apiResponse.notFound(res, error.message);
    }
    return apiResponse.badRequest(res, error.message);
  }
});

/**
 * POST /api/unlisted/admin/regulatory/reports/:reportId/acknowledge
 * Mark a submitted report as acknowledged by authority
 */
router.post('/admin/regulatory/reports/:reportId/acknowledge', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const { referenceNumber } = req.body;

    const report = await regulatoryReportingService.acknowledgeReport(reportId, referenceNumber);
    return apiResponse.success(res, report, 'Report acknowledged');
  } catch (error: any) {
    console.error('Error acknowledging report:', error);
    if (error.message.includes('not found')) {
      return apiResponse.notFound(res, error.message);
    }
    return apiResponse.badRequest(res, error.message);
  }
});

/**
 * POST /api/unlisted/admin/regulatory/events
 * Manually register a reportable event
 */
router.post('/admin/regulatory/events', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { eventType, userId, dealId, amount, currency, riskIndicators, riskScore, metadata } = req.body;

    if (!eventType || !riskIndicators || riskScore === undefined) {
      return apiResponse.badRequest(res, 'eventType, riskIndicators, and riskScore are required');
    }

    const event = await regulatoryReportingService.registerReportableEvent({
      eventType,
      triggeredBy: user.id,
      userId,
      dealId,
      amount,
      currency,
      riskIndicators,
      riskScore,
      metadata,
    });

    return apiResponse.created(res, event, event.requiresReporting 
      ? `Event registered and auto-generated ${event.reportType} report` 
      : 'Event registered (does not require reporting)');
  } catch (error: any) {
    console.error('Error registering event:', error);
    return apiResponse.serverError(res, 'Failed to register event');
  }
});

/**
 * GET /api/unlisted/admin/regulatory/events
 * Get reportable event queue
 */
router.get('/admin/regulatory/events', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { requiresReporting, processed } = req.query;
    
    const filters: any = {};
    if (requiresReporting !== undefined) filters.requiresReporting = requiresReporting === 'true';
    if (processed !== undefined) filters.processed = processed === 'true';

    const events = await regulatoryReportingService.getEventQueue(filters);
    return apiResponse.success(res, events);
  } catch (error: any) {
    console.error('Error fetching event queue:', error);
    return apiResponse.serverError(res, 'Failed to fetch events');
  }
});

// ===================================================================
// AI RECOMMENDATION ROUTES
// ===================================================================

import { aiUnlistedRecommendationService, type UnlistedStockAsset } from '../services/ai-unlisted-recommendation-service';
import { regulatoryComplianceService } from '../services/unlisted-regulatory-compliance-service';

/**
 * GET /api/unlisted/ai-recommendations
 * Get AI-powered personalized recommendations for unlisted/pre-IPO stocks
 */
router.get('/ai-recommendations', async (req: Request, res: Response) => {
  try {
    const { riskProfile, investmentHorizon, investmentGoal, investmentAmount } = req.query;
    
    // Fetch all active companies — no store-publish gate on AI picks
    const allCompanies = await storage.getAllUnlistedCompanies({ status: 'active' });
    
    // Only exclude suspended instruments; AI can recommend even without a published price
    const companies = (allCompanies as any[]).filter(c => !c.tradingSuspended);
    
    if (!companies || companies.length === 0) {
      return apiResponse.success(res, {
        recommendations: [],
        summary: {
          totalRecommendations: 0,
          message: 'No unlisted companies available for recommendations',
        },
      });
    }

    // Auto-publish any company not yet in the store — fire-and-forget, non-blocking
    setImmediate(async () => {
      try {
        const publishTasks = companies.map(c => autoPublishCompanyToStore(c));
        const results = await Promise.allSettled(publishTasks);
        const published = results.filter(r => r.status === 'fulfilled' && (r as any).value).length;
        if (published > 0) {
          console.log(`[AutoPublish] Auto-published ${published} unlisted companies to store`);
        }
      } catch (e) { /* non-blocking */ }
    });

    // Pre-fetch MoneyControl prices once (6h cache) to enrich companies missing a price
    let mcPriceByIsin = new Map<string, number>();
    let mcPriceByName = new Map<string, number>();
    try {
      const mcCompanies = await moneyControlReconciliation.fetchAndCacheMoneyControlCompanies();
      for (const mc of mcCompanies) {
        if (mc.price > 0) {
          if (mc.isin) mcPriceByIsin.set(mc.isin.toUpperCase(), mc.price);
          mcPriceByName.set(mc.name.toLowerCase().trim(), mc.price);
        }
      }
    } catch (_) { /* non-blocking enrichment */ }

    const resolveMarketPrice = (company: any): string | undefined => {
      const dbPrice = company.publishedBuyPrice || company.draftBuyPrice || company.currentPrice;
      if (dbPrice && parseFloat(dbPrice) > 0) return dbPrice.toString();
      if (company.isin) {
        const byIsin = mcPriceByIsin.get(company.isin.toUpperCase());
        if (byIsin) return byIsin.toString();
      }
      const byName = mcPriceByName.get(company.name.toLowerCase().trim());
      if (byName) return byName.toString();
      return undefined;
    };
    
    const assets: UnlistedStockAsset[] = companies.map((company: any) => ({
      id: company.id,
      name: company.name,
      cin: company.cin,
      sector: company.sector,
      industry: company.industry,
      listingStage: company.listingStage,
      publishedBuyPrice: resolveMarketPrice(company),
      publishedSellPrice: company.publishedSellPrice?.toString(),
      paidUpCapital: company.paidUpCapital?.toString(),
      revenue: company.latestFinancials?.revenue?.toString(),
      pat: company.latestFinancials?.pat?.toString(),
      networth: company.latestFinancials?.networth?.toString(),
      peRatio: company.latestRatios?.peRatio?.toString(),
      pbRatio: company.latestRatios?.pbRatio?.toString(),
      roe: company.latestRatios?.roe?.toString(),
      debtToEquity: company.latestRatios?.debtToEquity?.toString(),
      revenueGrowth: company.latestRatios?.revenueGrowth?.toString(),
      profitGrowth: company.latestRatios?.profitGrowth?.toString(),
      complianceStatus: company.complianceStatus,
      complianceRiskScore: company.complianceRiskScore,
    }));
    
    const userProfile = {
      riskProfile: (riskProfile as 'conservative' | 'moderate' | 'aggressive') || 'moderate',
      investmentHorizon: investmentHorizon as 'short_term' | 'medium_term' | 'long_term' | undefined,
      investmentGoal: investmentGoal as 'income' | 'growth' | 'balanced' | 'capital_preservation' | undefined,
      investmentAmount: investmentAmount ? parseFloat(investmentAmount as string) : undefined,
    };
    
    const recommendations = await aiUnlistedRecommendationService.generatePersonalizedRecommendations(assets, userProfile);
    
    const buySignals = recommendations.filter(r => r.aiSignal === 'buy').length;
    const safeParseFloat = (val: string | undefined): number => {
      const num = parseFloat(val || '0');
      return Number.isFinite(num) ? num : 0;
    };
    const avgConfidence = recommendations.length > 0
      ? (recommendations.reduce((sum, r) => sum + safeParseFloat(r.aiConfidence), 0) / recommendations.length).toFixed(1)
      : '0';
    const avgSuitability = recommendations.length > 0
      ? (recommendations.reduce((sum, r) => sum + (r.suitabilityScore || 0), 0) / recommendations.length).toFixed(0)
      : '0';
    
    return apiResponse.success(res, {
      recommendations,
      summary: {
        totalRecommendations: recommendations.length,
        buySignals,
        holdSignals: recommendations.filter(r => r.aiSignal === 'hold').length,
        avoidSignals: recommendations.filter(r => r.aiSignal === 'avoid').length,
        avgConfidence,
        avgSuitability,
        riskProfile: userProfile.riskProfile,
        investmentGoal: userProfile.investmentGoal || 'growth',
        disclaimer: 'Unlisted/pre-IPO investments carry high risk including illiquidity and potential total loss. These recommendations are AI-generated and should not be considered as investment advice. Consult a SEBI-registered advisor.',
      },
    });
  } catch (error: any) {
    console.error('Error fetching AI recommendations:', error);
    return apiResponse.serverError(res, 'Failed to fetch AI recommendations');
  }
});

// ==================== REGULATORY COMPLIANCE API ROUTES ====================

/**
 * GET /api/unlisted/admin/compliance/overview
 * Get regulatory compliance overview for admin dashboard
 */
router.get('/admin/compliance/overview', requireAdmin, async (req: Request, res: Response) => {
  try {
    const overview = await regulatoryComplianceService.getComplianceOverview();
    return apiResponse.success(res, {
      message: 'Regulatory compliance overview retrieved',
      data: overview,
    });
  } catch (error: any) {
    console.error('[RegCompliance] Error fetching overview:', error);
    return apiResponse.serverError(res, 'Failed to fetch compliance overview');
  }
});

/**
 * GET /api/unlisted/admin/compliance/investor-count/:companyId
 * Get investor count for a specific company
 */
router.get('/admin/compliance/investor-count/:companyId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const data = await regulatoryComplianceService.getInvestorCount(companyId);
    return apiResponse.success(res, {
      message: 'Investor count retrieved',
      data,
    });
  } catch (error: any) {
    console.error('[RegCompliance] Error fetching investor count:', error);
    return apiResponse.serverError(res, 'Failed to fetch investor count');
  }
});

/**
 * POST /api/unlisted/admin/compliance/check-investor-limit
 * Check if a transaction would exceed the 200 investor limit
 */
router.post('/admin/compliance/check-investor-limit', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = req.body;
    
    if (!companyId || !userId) {
      return apiResponse.badRequest(res, 'companyId and userId are required');
    }
    
    const result = await regulatoryComplianceService.checkInvestorLimit(companyId, userId);
    return apiResponse.success(res, {
      message: 'Investor limit check completed',
      data: result,
    });
  } catch (error: any) {
    console.error('[RegCompliance] Error checking investor limit:', error);
    return apiResponse.serverError(res, 'Failed to check investor limit');
  }
});

/**
 * GET /api/unlisted/admin/compliance/str-flags
 * Get pending STR flags for admin review
 */
router.get('/admin/compliance/str-flags', requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = await regulatoryComplianceService.getPendingSTRFlags();
    return apiResponse.success(res, {
      message: 'STR flags retrieved',
      data,
    });
  } catch (error: any) {
    console.error('[RegCompliance] Error fetching STR flags:', error);
    return apiResponse.serverError(res, 'Failed to fetch STR flags');
  }
});

/**
 * POST /api/unlisted/compliance/check-lockin
 * Check if shares can be sold (lock-in check)
 * User can only check their own lock-in status
 */
router.post('/compliance/check-lockin', requireAuth, async (req: Request, res: Response) => {
  try {
    const { companyId, sharesToSell } = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    if (!companyId || !sharesToSell) {
      return apiResponse.badRequest(res, 'companyId and sharesToSell are required');
    }
    
    const result = await regulatoryComplianceService.checkLockInStatus(companyId, userId, sharesToSell);
    return apiResponse.success(res, {
      message: 'Lock-in check completed',
      data: result,
    });
  } catch (error: any) {
    console.error('[RegCompliance] Error checking lock-in:', error);
    return apiResponse.serverError(res, 'Failed to check lock-in status');
  }
});

/**
 * POST /api/unlisted/admin/compliance/check-company-status
 * Check company listing status from MCA
 */
router.post('/admin/compliance/check-company-status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.body;
    
    if (!companyId) {
      return apiResponse.badRequest(res, 'companyId is required');
    }
    
    const result = await regulatoryComplianceService.checkCompanyListingStatus(companyId);
    return apiResponse.success(res, {
      message: 'Company status check completed',
      data: result,
    });
  } catch (error: any) {
    console.error('[RegCompliance] Error checking company status:', error);
    return apiResponse.serverError(res, 'Failed to check company status');
  }
});

/**
 * POST /api/unlisted/admin/compliance/verify-source-of-funds
 * Mark source of funds as verified for a user
 */
router.post('/admin/compliance/verify-source-of-funds', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = req.body;
    const adminId = (req as any).user?.id || 'admin';
    
    if (!companyId || !userId) {
      return apiResponse.badRequest(res, 'companyId and userId are required');
    }
    
    const result = await regulatoryComplianceService.markSourceOfFundsVerified(companyId, userId, adminId);
    return apiResponse.success(res, {
      message: result.success ? 'Source of funds verified successfully' : 'Failed to verify source of funds',
      data: result,
    });
  } catch (error: any) {
    console.error('[RegCompliance] Error verifying source of funds:', error);
    return apiResponse.serverError(res, 'Failed to verify source of funds');
  }
});

// ==================== END REGULATORY COMPLIANCE API ROUTES ====================

// ==================== INSTITUTIONAL VALUATION GOVERNANCE API ROUTES ====================

/**
 * POST /api/unlisted/companies/:id/valuation
 * Append-only valuation entry for an unlisted instrument (Admin only).
 * Rules: must include valuation_method + valuation_date + price.
 * Supporting document URL optional. Never overwrites existing rows.
 */
router.post('/companies/:id/valuation', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      valuationMethod: z.enum(['dcf', 'nav', 'comparable', 'book_value', 'market_implied', 'ca_certified', 'other']),
      price: z.number().positive('Price must be positive'),
      valuationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
      supportingDocumentUrl: z.string().url().optional(),
      notes: z.string().max(1000).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return apiResponse.badRequest(res, parsed.error.errors[0].message);
    }

    const result = await unlistedValuationGovernanceService.addValuation(id, {
      ...parsed.data,
      addedBy: (req.user as any)?.id,
    });

    return apiResponse.success(res, result, 'Valuation recorded successfully');
  } catch (error: any) {
    console.error('[ValuationGovernance] Error adding valuation:', error);
    if (error.message?.includes('not found')) {
      return apiResponse.notFound(res, error.message);
    }
    return apiResponse.serverError(res, 'Failed to record valuation');
  }
});

/**
 * GET /api/unlisted/companies/:id/valuation
 * Full versioned valuation history for a company (newest first).
 */
router.get('/companies/:id/valuation', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [history, latest] = await Promise.all([
      unlistedValuationGovernanceService.getValuationHistory(id),
      unlistedValuationGovernanceService.getLatestValuation(id),
    ]);

    return apiResponse.success(res, {
      companyId: id,
      latestValuation: latest,
      history,
      totalEntries: history.length,
    });
  } catch (error: any) {
    console.error('[ValuationGovernance] Error fetching history:', error);
    return apiResponse.serverError(res, 'Failed to fetch valuation history');
  }
});

/**
 * POST /api/unlisted/client-disclosure
 * Log a client's acknowledgment of the unlisted equity risk disclosure.
 * Required before any unlisted instrument appears in a finalized proposal.
 */
router.post('/client-disclosure', requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      companyId: z.string().optional(),
      proposalId: z.string().optional(),
      disclosureVersion: z.string().default('1.0.0'),
      disclosureHash: z.string().length(64),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return apiResponse.badRequest(res, parsed.error.errors[0].message);
    }

    const clientId = (req.user as any)?.id;
    if (!clientId) return apiResponse.unauthorized(res, 'Authentication required');

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || null;

    await db.insert(clientUnlistedDisclosureLog).values({
      clientId,
      companyId: parsed.data.companyId ?? null,
      proposalId: parsed.data.proposalId ?? null,
      disclosureVersion: parsed.data.disclosureVersion,
      disclosureHash: parsed.data.disclosureHash,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] ?? null,
    } as any);

    return apiResponse.success(res, { acknowledged: true, acknowledgedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('[Disclosure] Error logging disclosure:', error);
    return apiResponse.serverError(res, 'Failed to log disclosure acknowledgment');
  }
});

/**
 * GET /api/unlisted/admin/health
 * Institutional monitoring dashboard: stale valuations, compliance flags, enrichment failures.
 */
router.get('/admin/health', requireAdmin, async (req: Request, res: Response) => {
  try {
    const report = await unlistedValuationGovernanceService.getHealthReport();
    return apiResponse.success(res, report);
  } catch (error: any) {
    console.error('[UnlistedHealth] Error generating report:', error);
    return apiResponse.serverError(res, 'Failed to generate health report');
  }
});

/**
 * POST /api/unlisted/admin/valuation/check-stale
 * Manually trigger the valuation staleness sweep (also runs quarterly via cron).
 */
router.post('/admin/valuation/check-stale', requireAdmin, async (req: Request, res: Response) => {
  try {
    const report = await unlistedValuationGovernanceService.runStalenessSweep();
    return apiResponse.success(res, report, `Staleness sweep complete: ${report.markedStale} newly marked stale`);
  } catch (error: any) {
    console.error('[UnlistedHealth] Error in staleness sweep:', error);
    return apiResponse.serverError(res, 'Failed to run staleness sweep');
  }
});

/**
 * GET /api/unlisted/companies/:id/proposal-modifiers
 * Returns the unlisted-specific portfolio modifiers for a given instrument
 * (liquidity_weight=0, rebalance_eligible=false, stress_haircut=40%).
 * Used by the proposal engine before generating allocation.
 */
router.get('/companies/:id/proposal-modifiers', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const modifiers = unlistedValuationGovernanceService.getProposalModifiers(id);
    const latest = await unlistedValuationGovernanceService.getLatestValuation(id);
    return apiResponse.success(res, {
      companyId: id,
      ...modifiers,
      latestValuation: latest,
    });
  } catch (error: any) {
    console.error('[ProposalModifiers] Error:', error);
    return apiResponse.serverError(res, 'Failed to fetch proposal modifiers');
  }
});

// ==================== END INSTITUTIONAL VALUATION GOVERNANCE API ROUTES ====================

// ==================== PROBE42 FINANCIAL ENRICHMENT API ROUTES ====================

/**
 * GET /api/unlisted/admin/financial-health
 * Admin dashboard: negative NW companies, high leverage, no financials, consecutive losses.
 * Fully derived from CredHive data stored in company_financials / company_ratios.
 */
router.get('/admin/financial-health', requireAdmin, async (req: Request, res: Response) => {
  try {
    const report = await unlistedFinancialEnrichmentService.getFinancialHealthReport();
    return apiResponse.success(res, report);
  } catch (error: any) {
    console.error('[FinancialHealth] Error generating report:', error);
    return apiResponse.serverError(res, 'Failed to generate financial health report');
  }
});

/**
 * POST /api/unlisted/admin/companies/:id/enrich
 * Trigger on-demand CredHive enrichment for a single company.
 * Useful immediately after adding a new instrument or after subscription upgrade.
 */
router.post('/admin/companies/:id/enrich', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await unlistedFinancialEnrichmentService.enrichCompany(id);
    return apiResponse.success(res, result, `Enrichment complete. FHS: ${result.fhs?.toFixed(3) ?? 'N/A'}`);
  } catch (error: any) {
    console.error('[FinancialEnrichment] Error:', error);
    if (error.message?.includes('not found')) return apiResponse.notFound(res, error.message);
    return apiResponse.serverError(res, 'Enrichment failed: ' + error.message);
  }
});

/**
 * POST /api/unlisted/admin/enrich/batch
 * Trigger batch enrichment for all stale companies (>90 days without sync).
 * Rate-controlled: max 50 companies per call, 200ms inter-call delay.
 */
router.post('/admin/enrich/batch', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const result = await unlistedFinancialEnrichmentService.enrichStaleBatch(limit);
    return apiResponse.success(res, result,
      `Batch enrichment: ${result.succeeded} succeeded, ${result.failed} failed of ${result.processed} processed`);
  } catch (error: any) {
    console.error('[FinancialEnrichment] Batch error:', error);
    return apiResponse.serverError(res, 'Batch enrichment failed');
  }
});

/**
 * GET /api/unlisted/companies/:id/fhs
 * Compute Financial Health Score for a company from stored ratio data.
 * Returns FHS [0,1], volatility proxy, and risk label.
 */
router.get('/companies/:id/fhs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const fhs = await unlistedFinancialEnrichmentService.computeFHSFromDb(id);
    return apiResponse.success(res, { companyId: id, ...fhs });
  } catch (error: any) {
    console.error('[FHS] Error computing FHS:', error);
    return apiResponse.serverError(res, 'Failed to compute financial health score');
  }
});

/**
 * GET /api/unlisted/admin/vendor-calls
 * View CredHive API call log (rate/cost monitoring).
 */
router.get('/admin/vendor-calls', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { vendor = 'credhive', limit = '100', success } = req.query;
    const { db: dbConn } = await import('../db');
    const { vendorApiCallLog } = await import('@shared/schema');
    const { desc: descOrd, eq: eqOp, and: andOp } = await import('drizzle-orm');

    const filters: any[] = [eqOp(vendorApiCallLog.vendor, String(vendor))];
    if (success !== undefined) {
      filters.push(eqOp(vendorApiCallLog.success, success === 'true'));
    }

    const rows = await dbConn
      .select()
      .from(vendorApiCallLog)
      .where(filters.length === 1 ? filters[0] : andOp(...filters))
      .orderBy(descOrd(vendorApiCallLog.calledAt))
      .limit(Math.min(Number(limit), 500));

    const totalCost = rows.reduce((sum, r) => sum + (r.costUnit ?? 1), 0);
    const errorRate = rows.length ? rows.filter(r => !r.success).length / rows.length : 0;

    return apiResponse.success(res, {
      rows,
      summary: {
        totalCalls: rows.length,
        totalCostUnits: totalCost,
        errorRate: (errorRate * 100).toFixed(1) + '%',
        vendor: String(vendor),
      },
    });
  } catch (error: any) {
    console.error('[VendorCalls] Error:', error);
    return apiResponse.serverError(res, 'Failed to fetch vendor call log');
  }
});

// ==================== END PROBE42 FINANCIAL ENRICHMENT API ROUTES ====================

export default router;
