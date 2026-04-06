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

export default router;
