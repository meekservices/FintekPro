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

export default router;
