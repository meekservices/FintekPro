/**
 * Unlisted Marketplace API Routes
 * 
 * Handles all routes related to unlisted share trading marketplace including:
 * - Company management
 * - Probe42 integration for financial data
 * - Buy/Sell listings and deal matching
 * - Financials and ratios tracking
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { apiResponse } from '../utils/responses';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { probe42Service } from '../services/probe42-service';
import { PriceSuggestionService } from '../services/price-suggestion';
import { priceAggregationService } from '../services/price-aggregation';
import { moneyControlReconciliation } from '../services/moneycontrol-reconciliation';
import { mcaService } from '../services/mca-service';
import { unifiedCompanyDataService } from '../services/unified-company-data-service';
import { valuationService } from '../services/valuation-service';
import {
  insertUnlistedCompanySchema,
  insertUnlistedPriceHistorySchema,
  insertSellListingSchema,
  insertBuyRequestSchema,
  insertUnlistedDealSchema,
  sellListings,
  buyRequests,
  unlistedDeals,
  userProfiles,
  type UnlistedCompany,
  type SellListing,
  type BuyRequest,
} from '@shared/schema';
import { requireLevel2 } from '../middleware/kyc-level-gate';

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
 * List all unlisted companies with optional filters (public - no KYC required for browsing)
 */
router.get('/companies', async (req: Request, res: Response) => {
  try {
    const { status, sector } = req.query;
    
    const filters: { status?: string; sector?: string } = {};
    if (status && typeof status === 'string') filters.status = status;
    if (sector && typeof sector === 'string') filters.sector = sector;
    
    // Only return active companies for public browsing
    if (!filters.status) {
      filters.status = 'active';
    }
    
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
 * Create a new unlisted company (admin only)
 */
router.post('/companies', requireLevel2, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
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
// PROBE42 INTEGRATION ROUTES
// ===================================================================

/**
 * GET /api/unlisted/probe42/status
 * Check Probe42 API health and configuration status
 */
router.get('/probe42/status', requireLevel2, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const currentStatus = probe42Service.getStatus();
    const healthCheck = await probe42Service.healthCheck();
    
    return apiResponse.success(res, {
      ...currentStatus,
      healthCheck,
    });
  } catch (error: any) {
    console.error('Error checking Probe42 status:', error);
    return apiResponse.serverError(res, 'Failed to check Probe42 status');
  }
});

/**
 * GET /api/unlisted/probe42/search
 * Search for companies on Probe42
 */
router.get('/probe42/search', requireLevel2, async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string') {
      return apiResponse.badRequest(res, 'Query parameter "q" is required');
    }
    
    if (q.length < 3) {
      return apiResponse.badRequest(res, 'Query must be at least 3 characters long');
    }
    
    const results = await probe42Service.searchCompanyByNameOrCIN(q);
    return apiResponse.success(res, results);
  } catch (error: any) {
    console.error('Error searching Probe42:', error);
    return apiResponse.serverError(res, error.message || 'Failed to search companies');
  }
});

/**
 * POST /api/unlisted/probe42/sync/:companyId
 * Sync company data from Probe42
 */
router.post('/probe42/sync/:companyId', requireLevel2, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyId } = req.params;
    
    // Get company
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    if (!company.probe42CompanyId) {
      return apiResponse.badRequest(res, 'Company does not have Probe42 integration');
    }
    
    // Fetch company details from Probe42
    const probe42Details = await probe42Service.getCompanyDetails(company.probe42CompanyId);
    if (!probe42Details) {
      return apiResponse.notFound(res, 'Company not found on Probe42');
    }
    
    // Fetch financials (last 3 years)
    const financialsData = await probe42Service.getCompanyFinancials(company.probe42CompanyId, 3);
    const ratiosData = await probe42Service.getCompanyRatios(company.probe42CompanyId, 3);
    
    // Auto-populate ISIN from NSDL if not available from Probe42
    let isinResult: { isin: string | null; source: string; matchScore: number } = { 
      isin: probe42Details.isin || company.isin || null, 
      source: probe42Details.isin ? 'probe42' : (company.isin ? 'existing' : 'none'),
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
      const dbFinancials = probe42Service.convertFinancialsToDbFormat(companyId, finData);
      
      // Check if already exists - update if so, create if not
      const existing = await storage.getCompanyFinancialsByYear(companyId, finData.financial_year);
      if (existing) {
        await storage.updateCompanyFinancials(existing.id, dbFinancials);
        financialsUpdated++;
      } else {
        await storage.createCompanyFinancials(dbFinancials);
        financialsCount++;
      }
    }
    
    // Save ratios with upsert logic
    let ratiosCount = 0;
    let ratiosUpdated = 0;
    for (const ratioData of ratiosData) {
      const dbRatios = probe42Service.convertRatiosToDbFormat(companyId, ratioData);
      
      // Check if already exists
      const existing = await storage.getCompanyRatiosByYear(companyId, ratioData.financial_year);
      if (existing) {
        await storage.updateCompanyRatios(existing.id, dbRatios);
        ratiosUpdated++;
      } else {
        await storage.createCompanyRatios(dbRatios);
        ratiosCount++;
      }
    }
    
    // Update company metadata with full overview data (including auto-populated ISIN)
    await storage.updateUnlistedCompany(companyId, {
      lastSyncedAt: new Date(),
      sector: probe42Details.sector || company.sector,
      industry: probe42Details.industry || company.industry,
      rocState: probe42Details.roc_state || company.rocState,
      incorporationDate: probe42Details.incorporation_date || company.incorporationDate,
      paidUpCapital: probe42Details.paid_up_capital?.toString() || company.paidUpCapital,
      authorizedCapital: probe42Details.authorized_capital?.toString() || company.authorizedCapital,
      faceValue: probe42Details.face_value?.toString() || company.faceValue,
      totalShares: probe42Details.total_shares || company.totalShares,
      website: probe42Details.website || company.website,
      description: probe42Details.description || company.description,
      isin: isinResult.isin || company.isin,
    });
    
    // Create sync log
    const totalNew = financialsCount + ratiosCount;
    const totalUpdated = financialsUpdated + ratiosUpdated;
    await storage.createProbe42SyncLog({
      companyId,
      probe42CompanyId: company.probe42CompanyId,
      syncType: 'full',
      lastSyncAt: new Date(),
      status: 'success',
      recordsSynced: totalNew + totalUpdated,
      recordsFailed: 0,
    });
    
    // Determine if ISIN was auto-populated from external source
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
    console.error('Error syncing from Probe42:', error);
    
    // Log failed sync
    const { companyId } = req.params;
    const company = await storage.getUnlistedCompanyById(companyId);
    if (company && company.probe42CompanyId) {
      await storage.createProbe42SyncLog({
        companyId,
        probe42CompanyId: company.probe42CompanyId,
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
 * POST /api/unlisted/probe42/sync-all
 * Bulk sync all companies with Probe42 (admin only)
 */
router.post('/probe42/sync-all', requireLevel2, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { onlyUnsynced } = req.body;
    
    // Get all companies (or only unsynced ones)
    const allCompanies = await storage.getAllUnlistedCompanies({});
    const companies = onlyUnsynced 
      ? allCompanies.filter(c => !c.lastSyncedAt)
      : allCompanies;
    
    if (companies.length === 0) {
      return apiResponse.success(res, {
        success: true,
        message: 'No companies to sync',
        results: []
      });
    }
    
    console.log(`[Bulk Sync] Starting sync for ${companies.length} companies...`);
    
    const results: Array<{
      companyId: string;
      companyName: string;
      success: boolean;
      probe42Linked: boolean;
      message: string;
    }> = [];
    
    for (const company of companies) {
      try {
        console.log(`[Bulk Sync] Processing: ${company.name}`);
        
        // If company doesn't have probe42CompanyId, try to find and link it
        let probe42Id = company.probe42CompanyId;
        
        if (!probe42Id) {
          // Search Probe42 by company name or CIN
          const searchResults = await probe42Service.searchCompanyByNameOrCIN(company.cin || company.name);
          
          if (searchResults.length > 0) {
            // Take the best match
            const bestMatch = searchResults[0];
            probe42Id = bestMatch.company_id;
            
            // Link the company to Probe42
            await storage.updateUnlistedCompany(company.id, {
              probe42CompanyId: probe42Id,
              cin: bestMatch.cin || company.cin,
            });
            
            console.log(`[Bulk Sync] Linked ${company.name} to Probe42 ID: ${probe42Id}`);
          } else {
            console.log(`[Bulk Sync] No Probe42 match for ${company.name}`);
            results.push({
              companyId: company.id,
              companyName: company.name,
              success: false,
              probe42Linked: false,
              message: 'No match found on Probe42'
            });
            continue;
          }
        }
        
        // Now sync the company data
        const probe42Details = await probe42Service.getCompanyDetails(probe42Id);
        if (!probe42Details) {
          results.push({
            companyId: company.id,
            companyName: company.name,
            success: false,
            probe42Linked: !!company.probe42CompanyId,
            message: 'Failed to fetch details from Probe42'
          });
          continue;
        }
        
        // Fetch financials and ratios
        const financialsData = await probe42Service.getCompanyFinancials(probe42Id, 3);
        const ratiosData = await probe42Service.getCompanyRatios(probe42Id, 3);
        
        // Auto-populate ISIN if not available
        let isin = probe42Details.isin || company.isin;
        
        if (!isin) {
          try {
            const { moneyControlScraper } = await import('../services/moneycontrol-scraper');
            const mcResult = await moneyControlScraper.searchISINByCompanyName(company.name);
            if (mcResult.isin && mcResult.matchScore >= 60) {
              isin = mcResult.isin;
              console.log(`[Bulk Sync] Auto-populated ISIN ${isin} from MoneyControl for ${company.name}`);
              
              // Save price if available
              if (mcResult.price) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                await storage.upsertPriceHistory({
                  companyId: company.id,
                  date: today,
                  price: mcResult.price.toString(),
                  sourceType: 'MONEYCONTROL',
                  notes: `Auto-imported during bulk sync`,
                });
              }
            }
          } catch (e) {
            console.warn(`[Bulk Sync] Failed to fetch ISIN from MoneyControl for ${company.name}`);
          }
        }
        
        // Save financials
        for (const finData of financialsData) {
          const dbFinancials = probe42Service.convertFinancialsToDbFormat(company.id, finData);
          const existing = await storage.getCompanyFinancialsByYear(company.id, finData.financial_year);
          if (existing) {
            await storage.updateCompanyFinancials(existing.id, dbFinancials);
          } else {
            await storage.createCompanyFinancials(dbFinancials);
          }
        }
        
        // Save ratios
        for (const ratioData of ratiosData) {
          const dbRatios = probe42Service.convertRatiosToDbFormat(company.id, ratioData);
          const existing = await storage.getCompanyRatiosByYear(company.id, ratioData.financial_year);
          if (existing) {
            await storage.updateCompanyRatios(existing.id, dbRatios);
          } else {
            await storage.createCompanyRatios(dbRatios);
          }
        }
        
        // Update company metadata
        await storage.updateUnlistedCompany(company.id, {
          lastSyncedAt: new Date(),
          sector: probe42Details.sector || company.sector,
          industry: probe42Details.industry || company.industry,
          rocState: probe42Details.roc_state || company.rocState,
          incorporationDate: probe42Details.incorporation_date || company.incorporationDate,
          paidUpCapital: probe42Details.paid_up_capital?.toString() || company.paidUpCapital,
          authorizedCapital: probe42Details.authorized_capital?.toString() || company.authorizedCapital,
          faceValue: probe42Details.face_value?.toString() || company.faceValue,
          totalShares: probe42Details.total_shares || company.totalShares,
          website: probe42Details.website || company.website,
          description: probe42Details.description || company.description,
          isin: isin || company.isin,
        });
        
        results.push({
          companyId: company.id,
          companyName: company.name,
          success: true,
          probe42Linked: true,
          message: `Synced ${financialsData.length} financials, ${ratiosData.length} ratios`
        });
        
        console.log(`[Bulk Sync] Successfully synced ${company.name}`);
        
      } catch (companyError: any) {
        console.error(`[Bulk Sync] Error syncing ${company.name}:`, companyError.message);
        results.push({
          companyId: company.id,
          companyName: company.name,
          success: false,
          probe42Linked: !!company.probe42CompanyId,
          message: companyError.message || 'Sync failed'
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
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
    console.error('Error in bulk sync:', error);
    return apiResponse.serverError(res, error.message || 'Bulk sync failed');
  }
});

// ===================================================================
// FINANCIALS & RATIOS ROUTES
// ===================================================================

/**
 * GET /api/unlisted/companies/:id/financials
 * Get company financial statements
 */
router.get('/companies/:id/financials', requireLevel2, async (req: Request, res: Response) => {
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
 */
router.get('/companies/:id/ratios', requireLevel2, async (req: Request, res: Response) => {
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
 */
router.get('/companies/:id/price-history', requireLevel2, async (req: Request, res: Response) => {
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
 * Admin: Add price history entry for a company
 * Since there's no public API for unlisted stock prices, this allows manual entry
 */
router.post('/companies/:id/price-history', requireLevel2, async (req: Request, res: Response) => {
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
 * Admin: Bulk upload price history from CSV/array data
 */
router.post('/companies/:id/price-history/bulk', requireLevel2, async (req: Request, res: Response) => {
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
 * Preview what companies would be matched and imported from MoneyControl
 */
router.get('/moneycontrol/preview', requireLevel2, async (req: Request, res: Response) => {
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
 * Execute import of prices from MoneyControl
 */
router.post('/moneycontrol/import', requireLevel2, async (req: Request, res: Response) => {
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
 * Add a missing company from MoneyControl with Probe42 enrichment
 * Creates company -> Searches Probe42 -> Syncs data -> Imports MC price
 */
router.post('/moneycontrol/add-company', requireLevel2, async (req: Request, res: Response) => {
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
      probe42Found: boolean;
      probe42Data: {
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
      probe42Found: false,
      probe42Data: null,
      priceImported: false,
    };
    
    // Search Probe42 for company by name
    let probe42CompanyId: string | null = null;
    let probe42Details: any = null;
    
    try {
      const probe42Results = await probe42Service.searchCompanyByNameOrCIN(name);
      
      if (probe42Results && probe42Results.length > 0) {
        // Find best match - exact name match or first result
        const exactMatch = probe42Results.find(r => 
          r.name.toLowerCase() === name.toLowerCase()
        );
        const bestMatch = exactMatch || probe42Results[0];
        
        probe42CompanyId = bestMatch.company_id;
        
        // Get full company details from Probe42
        probe42Details = await probe42Service.getCompanyDetails(probe42CompanyId);
        result.probe42Found = true;
      }
    } catch (error: any) {
      console.warn('Probe42 search failed, creating company with basic data:', error.message);
    }
    
    // Create the company
    const companyData: any = {
      name,
      isin,
      status: 'active',
      createdBy: req.user.id,
    };
    
    // Enrich with Probe42 data if available
    if (probe42Details) {
      companyData.cin = probe42Details.cin;
      companyData.sector = probe42Details.sector;
      companyData.industry = probe42Details.industry;
      companyData.website = probe42Details.website;
      companyData.description = probe42Details.description;
      if (probe42Details.incorporation_date) {
        companyData.incorporationDate = probe42Details.incorporation_date;
      }
      if (probe42Details.paid_up_capital) {
        companyData.paidUpCapital = probe42Details.paid_up_capital.toString();
      }
      if (probe42Details.authorized_capital) {
        companyData.authorizedCapital = probe42Details.authorized_capital.toString();
      }
      if (probe42Details.face_value) {
        companyData.faceValue = probe42Details.face_value.toString();
      }
      if (probe42Details.total_shares) {
        companyData.totalShares = typeof probe42Details.total_shares === 'number' 
          ? probe42Details.total_shares 
          : parseInt(probe42Details.total_shares, 10);
      }
      companyData.probe42CompanyId = probe42CompanyId;
      companyData.lastSyncedAt = new Date();
      
      result.probe42Data = {
        cin: probe42Details.cin,
        sector: probe42Details.sector,
        industry: probe42Details.industry,
        financialsSynced: 0,
        ratiosSynced: 0,
      };
    }
    
    const company = await storage.createUnlistedCompany(companyData);
    result.companyId = company.id;
    result.companyName = company.name;
    
    // Sync financials and ratios from Probe42 if we have a company ID
    if (probe42CompanyId && result.probe42Data) {
      try {
        const financials = await probe42Service.getCompanyFinancials(probe42CompanyId, 5);
        for (const fin of financials) {
          const dbFormat = probe42Service.convertFinancialsToDbFormat(company.id, fin);
          await storage.createCompanyFinancials(dbFormat);
          result.probe42Data.financialsSynced++;
        }
        
        const ratios = await probe42Service.getCompanyRatios(probe42CompanyId, 5);
        for (const ratio of ratios) {
          const dbFormat = probe42Service.convertRatiosToDbFormat(company.id, ratio);
          await storage.createCompanyRatios(dbFormat);
          result.probe42Data.ratiosSynced++;
        }
      } catch (error: any) {
        console.warn('Failed to sync financials/ratios from Probe42:', error.message);
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
      (result.probe42Found ? ' with Probe42 data' : '') +
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
    
    const validatedData = insertSellListingSchema.parse(req.body);
    
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
    console.log(`[COMPLIANCE] unlisted_sell_listing: { userId: '${req.user.id}', companyId: '${validatedData.companyId}', quantity: ${validatedData.quantity}, value: ${transactionValue}, outcome: 'success' }`);
    
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
    
    const validatedData = insertBuyRequestSchema.parse(req.body);
    
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
    console.log(`[COMPLIANCE] unlisted_buy_request: { userId: '${req.user.id}', companyId: '${validatedData.companyId}', quantity: ${validatedData.quantity}, maxValue: ${transactionValue}, outcome: 'success' }`);
    
    // Create buy request
    const request = await storage.createBuyRequest({
      ...validatedData,
      buyerUserId: req.user.id,
    });
    
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
// STORE SEEDING ROUTES - Publish Unlisted Stocks to Store
// ===================================================================

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
      subcategory = await storage.getStoreCategoryBySlug(sectorSlug);
      if (!subcategory) {
        subcategory = await storage.createStoreCategory({
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
// Search across MoneyControl and Probe42 simultaneously
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
  source: 'moneycontrol' | 'probe42' | 'mca' | 'fintekpro';
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  isInFintekPro: boolean;
  fintekProId?: string;
  dataQuality?: number;
  rawData: any;
}

/**
 * GET /api/unlisted/admin/unified-search
 * Search companies across multiple data sources (Admin only)
 * Priority: FintekPro (internal) → MoneyControl → MCA → Probe42 (legacy)
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

    // Search all sources in parallel
    const [moneyControlResults, mcaResults, probe42Results] = await Promise.allSettled([
      // MoneyControl (price data)
      (async () => {
        try {
          const cached = await moneyControlReconciliation.getReconciliationSuggestions(false);
          const allCompanies = cached.suggestions.map(s => s.externalCompany);
          return allCompanies.filter((c: any) => 
            c.name.toLowerCase().includes(queryLower) ||
            c.isin?.toLowerCase().includes(queryLower)
          );
        } catch (e) {
          console.error('MoneyControl search error:', e);
          return [];
        }
      })(),
      // MCA (official company filings via Sandbox.co.in)
      // Note: MCA doesn't have a search API, requires direct CIN lookup
      // We skip this in unified search and use it for direct company details
      (async () => {
        try {
          // Check if query looks like a CIN (21 characters)
          if (query.length === 21 && /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/.test(query)) {
            const company = await mcaService.getCompanyByCIN(query);
            return company ? [company] : [];
          }
          return [];
        } catch (e) {
          console.error('MCA search error:', e);
          return [];
        }
      })(),
      // Probe42 (legacy, will be deprecated)
      (async () => {
        try {
          if (query.length >= 3) {
            return await probe42Service.searchCompanyByNameOrCIN(query);
          }
          return [];
        } catch (e) {
          console.error('Probe42 search error:', e);
          return [];
        }
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

    // Process Probe42 results (legacy, lower priority)
    if (probe42Results.status === 'fulfilled') {
      for (const company of probe42Results.value) {
        if (company.cin && seenCins.has(company.cin)) continue;
        if (company.cin) seenCins.add(company.cin);
        
        const isInFintekPro = existingCins.has(company.cin);
        const existing = existingCompanies.find((c: UnlistedCompany) => c.cin === company.cin);

        results.push({
          id: `p42_${company.company_id}`,
          name: company.name,
          cin: company.cin,
          pan: company.pan,
          status: company.status,
          incorporationDate: company.incorporation_date,
          source: 'probe42',
          isInFintekPro,
          fintekProId: existing?.id || undefined,
          dataQuality: 60,
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
        moneycontrol: moneyControlResults.status === 'fulfilled' ? moneyControlResults.value.length : 0,
        mca: mcaResults.status === 'fulfilled' ? mcaResults.value.length : 0,
        probe42: probe42Results.status === 'fulfilled' ? probe42Results.value.length : 0,
      }
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
    } else if (source === 'probe42') {
      const details = await probe42Service.getCompanyDetails(id);
      const financials = await probe42Service.getCompanyFinancials(id).catch(() => null);
      
      return apiResponse.success(res, {
        source: 'probe42',
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
      return apiResponse.badRequest(res, 'Invalid source. Use "mca", "moneycontrol", or "probe42"');
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
  source: z.enum(['moneycontrol', 'probe42', 'manual']),
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
  source: z.enum(['moneycontrol', 'probe42', 'manual']),
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

export default router;
