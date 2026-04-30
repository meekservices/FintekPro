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
import { requireAuth, requireAdmin } from '../middleware/roleMiddleware';
import { orderAuditHook } from '../services/order-audit-hook';
import { dataEnrichmentService } from '../services/data-enrichment-service';
import { unlistedValuationGovernanceService } from '../services/unlisted-valuation-governance-service';
import { unlistedFinancialEnrichmentService } from '../services/unlisted-financial-enrichment-service';
import {
  insertUnlistedEquityValuationHistorySchema,
  clientUnlistedDisclosureLog,
  unlistedEquityValuationHistory,
} from '@shared/schema';



const router = Router();

// ===================================================================
// COMPANY MANAGEMENT ROUTES
// ===================================================================

/**
 * GET /api/unlisted/companies
 * List only STORE-PUBLISHED unlisted companies (public - no KYC required for browsing)
 * Only returns companies where storeProductId is not null (published to store)
 */
router.get('/credhive/search', requireAdmin, async (req: Request, res: Response) => {
  try {
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
router.post('/credhive/sync/:companyId', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.post('/credhive/sync-all', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.post('/companies/:id/price-history', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.post('/companies/:id/price-history/bulk', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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


export default router;
