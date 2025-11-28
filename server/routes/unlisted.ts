/**
 * Unlisted Marketplace API Routes
 * 
 * Handles all routes related to unlisted share trading marketplace including:
 * - Company management
 * - Probe42 integration for financial data
 * - Buy/Sell listings and deal matching
 * - Financials and ratios tracking
 */

import { Router, type Request, type Response } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { apiResponse } from '../utils/responses';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { probe42Service } from '../services/probe42-service';
import { PriceSuggestionService } from '../services/price-suggestion';
import {
  insertUnlistedCompanySchema,
  insertUnlistedPriceHistorySchema,
  insertSellListingSchema,
  insertBuyRequestSchema,
  insertUnlistedDealSchema,
  sellListings,
  buyRequests,
  unlistedDeals,
  type UnlistedCompany,
  type SellListing,
  type BuyRequest,
} from '@shared/schema';
import { requireLevel2 } from '../middleware/kyc-level-gate';

const router = Router();

// ===================================================================
// COMPANY MANAGEMENT ROUTES
// ===================================================================

/**
 * GET /api/unlisted/companies
 * List all unlisted companies with optional filters
 */
router.get('/companies', requireLevel2, async (req: Request, res: Response) => {
  try {
    const { status, sector } = req.query;
    
    const filters: { status?: string; sector?: string } = {};
    if (status && typeof status === 'string') filters.status = status;
    if (sector && typeof sector === 'string') filters.sector = sector;
    
    const companies = await storage.getAllUnlistedCompanies(filters);
    return apiResponse.success(res, companies);
  } catch (error: any) {
    console.error('Error fetching unlisted companies:', error);
    return apiResponse.serverError(res, 'Failed to fetch companies');
  }
});

/**
 * GET /api/unlisted/companies/:id
 * Get detailed information about a specific company
 */
router.get('/companies/:id', requireLevel2, async (req: Request, res: Response) => {
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
    
    // Update company metadata with full overview data
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
      isin: probe42Details.isin || company.isin,
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
    
    return apiResponse.success(res, {
      success: true,
      financials: { created: financialsCount, updated: financialsUpdated },
      ratios: { created: ratiosCount, updated: ratiosUpdated },
      companyUpdated: true,
      message: `Synced ${totalNew} new records, updated ${totalUpdated} existing records`,
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
 */
router.get('/nsdl/search-isin', requireLevel2, async (req: Request, res: Response) => {
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
 */
router.post('/nsdl/refresh-cache', requireLevel2, async (req: Request, res: Response) => {
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

export default router;
