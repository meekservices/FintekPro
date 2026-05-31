// @ts-nocheck
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
router.post('/admin/sync-store-product/:companyId', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.get('/admin/store-status/:companyId', requireAdmin, async (req: Request, res: Response) => {
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
router.get('/admin/price-suggestions/:companyId', requireAdmin, async (req: Request, res: Response) => {
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
router.post('/admin/price-suggestions/batch', requireAdmin, async (req: Request, res: Response) => {
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
router.post('/admin/refresh-moneycontrol/:companyId', requireAdmin, async (req: Request, res: Response) => {
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
router.get('/admin/companies/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.get('/admin/companies/:id/financials', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.post('/admin/companies/:id/financials', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
      changedBy: req.user!.id,
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    });
    
    console.log(`[ManualEntry] Admin ${req.user!.id} added financials for ${company.name} (${financialYear})`);
    
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
router.get('/admin/companies/:id/ratios', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.get('/admin/companies/:id/data-quality', requireAdmin, async (req: Request, res: Response) => {
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

export default router;
