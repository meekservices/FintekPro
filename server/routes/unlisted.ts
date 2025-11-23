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

const router = Router();

// ===================================================================
// COMPANY MANAGEMENT ROUTES
// ===================================================================

/**
 * GET /api/unlisted/companies
 * List all unlisted companies with optional filters
 */
router.get('/companies', async (req: Request, res: Response) => {
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
 * POST /api/unlisted/companies
 * Create a new unlisted company (admin only)
 */
router.post('/companies', async (req: Request, res: Response) => {
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

// ===================================================================
// PROBE42 INTEGRATION ROUTES
// ===================================================================

/**
 * GET /api/unlisted/probe42/search
 * Search for companies on Probe42
 */
router.get('/probe42/search', async (req: Request, res: Response) => {
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
router.post('/probe42/sync/:companyId', async (req: Request, res: Response) => {
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
    
    // Save financials
    let financialsCount = 0;
    for (const finData of financialsData) {
      const dbFinancials = probe42Service.convertFinancialsToDbFormat(companyId, finData);
      
      // Check if already exists
      const existing = await storage.getCompanyFinancialsByYear(companyId, finData.financial_year);
      if (!existing) {
        await storage.createCompanyFinancials(dbFinancials);
        financialsCount++;
      }
    }
    
    // Save ratios
    let ratiosCount = 0;
    for (const ratioData of ratiosData) {
      const dbRatios = probe42Service.convertRatiosToDbFormat(companyId, ratioData);
      await storage.createCompanyRatios(dbRatios);
      ratiosCount++;
    }
    
    // Update company metadata
    await storage.updateUnlistedCompany(companyId, {
      lastSyncedAt: new Date(),
      sector: probe42Details.sector || company.sector,
      industry: probe42Details.industry || company.industry,
    });
    
    // Create sync log
    await storage.createProbe42SyncLog({
      companyId,
      probe42CompanyId: company.probe42CompanyId,
      syncType: 'full',
      lastSyncAt: new Date(),
      status: 'success',
      recordsSynced: financialsCount + ratiosCount,
      recordsFailed: 0,
    });
    
    return apiResponse.success(res, {
      success: true,
      financialsCount,
      ratiosCount,
      message: `Synced ${financialsCount} financial records and ${ratiosCount} ratio records`,
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
router.get('/companies/:id/financials', async (req: Request, res: Response) => {
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
router.get('/companies/:id/ratios', async (req: Request, res: Response) => {
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
router.get('/companies/:id/price-history', async (req: Request, res: Response) => {
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

// ===================================================================
// TRADING ROUTES - SELL LISTINGS
// ===================================================================

/**
 * GET /api/unlisted/listings
 * Get active sell listings
 */
router.get('/listings', async (req: Request, res: Response) => {
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
router.post('/listings', async (req: Request, res: Response) => {
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
router.get('/buy-requests', async (req: Request, res: Response) => {
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
router.post('/buy-requests', async (req: Request, res: Response) => {
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
router.get('/deals', async (req: Request, res: Response) => {
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
router.get('/deals/:id', async (req: Request, res: Response) => {
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
router.post('/price/suggest', async (req: Request, res: Response) => {
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
router.get('/companies/:id/price-suggestion', async (req: Request, res: Response) => {
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
router.post('/price-suggestions/batch', async (req: Request, res: Response) => {
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

export default router;
