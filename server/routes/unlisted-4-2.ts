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
router.get('/admin/companies', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.patch('/admin/companies/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.get('/admin/all-listings', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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
router.get('/admin/all-buy-requests', requireAdmin, async (req: Request, res: Response) => {
  try {
    
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


export default router;
