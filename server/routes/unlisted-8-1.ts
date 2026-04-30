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

export default router;
