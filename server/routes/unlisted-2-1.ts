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
router.get('/moneycontrol/preview', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.post('/moneycontrol/import', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.post('/moneycontrol/add-company', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.get('/nsdl/search-isin', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.post('/nsdl/refresh-cache', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
import * as schema from "@shared/schema";

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

export default router;
