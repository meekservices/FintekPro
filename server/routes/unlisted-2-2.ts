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
    
    const { acknowledgedDisclosureIds, ...orderData } = req.body;
    const validatedData = insertBuyRequestSchema.parse(orderData);
    
    // Validate risk disclosure acknowledgment (SEBI Compliance)
    if (!acknowledgedDisclosureIds || !Array.isArray(acknowledgedDisclosureIds)) {
      return apiResponse.badRequest(res, 'Risk disclosure acknowledgment is required. Please read and accept all mandatory disclosures before placing an order.');
    }
    
    const disclosureValidation = unlistedRiskDisclosureService.validateAcknowledgment({
      acknowledgedDisclosureIds,
      userId: req.user.id,
      companyId: validatedData.companyId,
      tradeType: 'buy',
    });
    
    if (!disclosureValidation.valid) {
      console.log(`[COMPLIANCE] buy_request_blocked: Missing risk disclosures | userId: ${req.user.id} | missing: ${disclosureValidation.missingDisclosures.join(', ')}`);
      return apiResponse.badRequest(res, 'All mandatory risk disclosures must be acknowledged before placing an order.', {
        missingDisclosures: disclosureValidation.missingDisclosures,
      });
    }
    
    // Persist risk disclosure acknowledgment for audit trail
    await saveRiskAcknowledgment({
      userId: req.user.id,
      companyId: validatedData.companyId,
      tradeType: 'buy',
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
    console.log(`[COMPLIANCE] unlisted_buy_request: { userId: '${req.user.id}', companyId: '${validatedData.companyId}', quantity: ${validatedData.quantity}, maxValue: ${transactionValue}, disclosureVersion: '${unlistedRiskDisclosureService.getDisclosureVersion()}', outcome: 'success' }`);
    
    // Create buy request
    const request = await storage.createBuyRequest({
      ...validatedData,
      buyerUserId: req.user.id,
    });

    // Log to immutable SEBI-compliant audit trail
    await orderAuditHook.logUnlistedOrderCreated(
      request.id,
      req.user.id,
      'client',
      {
        companyId: validatedData.companyId,
        companyName: company.name,
        orderType: 'buy',
        quantity: validatedData.quantity,
        maxPrice: validatedData.maxPrice,
        transactionValue,
      },
      req
    );
    
    return apiResponse.created(res, request, 'Buy request created successfully');
  } catch (error: any) {
    console.error('Error creating buy request:', error);
    
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid input data', error.issues);
    }
    
    return apiResponse.serverError(res, 'Failed to create buy request');
  }
});

// ===================================================================
// USER ORDER TRACKING ROUTES
// ===================================================================

/**
 * GET /api/unlisted/my-buy-requests
 * Get current user's buy requests with company names
 */
router.get('/my-buy-requests', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const requests = await db.select({
      id: buyRequests.id,
      companyId: buyRequests.companyId,
      quantity: buyRequests.quantity,
      maxPrice: buyRequests.maxPrice,
      targetPrice: buyRequests.targetPrice,
      status: buyRequests.status,
      validUntil: buyRequests.validUntil,
      createdAt: buyRequests.createdAt,
    }).from(buyRequests)
      .where(eq(buyRequests.buyerUserId, req.user.id))
      .orderBy(buyRequests.createdAt);

    // Enrich with company names
    const enrichedRequests = await Promise.all(
      requests.map(async (request) => {
        const company = await storage.getUnlistedCompanyById(request.companyId);
        return {
          ...request,
          companyName: company?.name || 'Unknown Company',
        };
      })
    );

    return apiResponse.success(res, enrichedRequests);
  } catch (error: any) {
    console.error('Error fetching user buy requests:', error);
    return apiResponse.serverError(res, 'Failed to fetch your buy requests');
  }
});

/**
 * GET /api/unlisted/my-sell-listings
 * Get current user's sell listings with company names
 */
router.get('/my-sell-listings', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const listings = await db.select({
      id: sellListings.id,
      companyId: sellListings.companyId,
      quantity: sellListings.quantity,
      askPrice: sellListings.askPrice,
      floorPrice: sellListings.floorPrice,
      status: sellListings.status,
      validUntil: sellListings.validUntil,
      createdAt: sellListings.createdAt,
    }).from(sellListings)
      .where(eq(sellListings.sellerUserId, req.user.id))
      .orderBy(sellListings.createdAt);

    // Enrich with company names
    const enrichedListings = await Promise.all(
      listings.map(async (listing) => {
        const company = await storage.getUnlistedCompanyById(listing.companyId);
        return {
          ...listing,
          minPrice: listing.floorPrice,
          companyName: company?.name || 'Unknown Company',
        };
      })
    );

    return apiResponse.success(res, enrichedListings);
  } catch (error: any) {
    console.error('Error fetching user sell listings:', error);
    return apiResponse.serverError(res, 'Failed to fetch your sell listings');
  }
});

// ===================================================================
// CART ROUTES - Batch buy requests before checkout
// ===================================================================

/**
 * GET /api/unlisted/cart
 * Get current user's cart items with company details
 */
router.get('/cart', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const items = await db.select().from(unlistedCart)
      .where(eq(unlistedCart.userId, req.user.id))
      .orderBy(unlistedCart.createdAt);

    // Enrich with company details and current prices
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const company = await storage.getUnlistedCompanyById(item.companyId);
        return {
          ...item,
          companyName: company?.name || 'Unknown Company',
          companySector: company?.sector,
          currentPrice: company?.currentPrice,
          companyLogo: company?.logoUrl,
        };
      })
    );

    // Calculate cart summary
    const totalItems = enrichedItems.length;
    const totalValue = enrichedItems.reduce((sum, item) => {
      const price = parseFloat(item.maxPrice) || 0;
      return sum + (item.quantity * price);
    }, 0);

    return apiResponse.success(res, {
      items: enrichedItems,
      summary: {
        totalItems,
        totalValue,
        estimatedFees: totalValue * 0.02, // 2% total fees (platform + buyer)
      },
    });
  } catch (error: any) {
    console.error('Error fetching cart:', error);
    return apiResponse.serverError(res, 'Failed to fetch cart');
  }
});

/**
 * POST /api/unlisted/cart
 * Add item to cart
 */
router.post('/cart', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const validatedData = insertUnlistedCartSchema.parse({
      ...req.body,
      userId: req.user.id,
    });

    // Check if company exists
    const company = await storage.getUnlistedCompanyById(validatedData.companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }

    // Check if already in cart - update instead of adding duplicate
    const existing = await db.select().from(unlistedCart)
      .where(and(
        eq(unlistedCart.userId, req.user.id),
        eq(unlistedCart.companyId, validatedData.companyId)
      ));

    if (existing.length > 0) {
      // Update existing cart item
      const updated = await db.update(unlistedCart)
        .set({
          quantity: validatedData.quantity,
          maxPrice: validatedData.maxPrice,
          targetPrice: validatedData.targetPrice,
          notes: validatedData.notes,
          updatedAt: new Date(),
        })
        .where(eq(unlistedCart.id, existing[0].id))
        .returning();
      
      return apiResponse.success(res, updated[0], 'Cart item updated');
    }

    // Insert new cart item
    const inserted = await db.insert(unlistedCart)
      .values(validatedData)
      .returning();

    return apiResponse.created(res, inserted[0], 'Added to cart');
  } catch (error: any) {
    console.error('Error adding to cart:', error);
    if (error instanceof z.ZodError) {
      return apiResponse.badRequest(res, 'Invalid input data', error.issues);
    }
    return apiResponse.serverError(res, 'Failed to add to cart');
  }
});

/**
 * PATCH /api/unlisted/cart/:id
 * Update cart item quantity or price
 */
router.patch('/cart/:id', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const { id } = req.params;
    const { quantity, maxPrice, targetPrice, notes } = req.body;

    // Verify ownership
    const existing = await db.select().from(unlistedCart)
      .where(and(
        eq(unlistedCart.id, id),
        eq(unlistedCart.userId, req.user.id)
      ));

    if (existing.length === 0) {
      return apiResponse.notFound(res, 'Cart item not found');
    }

    const updateData: Partial<UnlistedCartItem> = { updatedAt: new Date() };
    if (quantity !== undefined) updateData.quantity = quantity;
    if (maxPrice !== undefined) updateData.maxPrice = maxPrice;
    if (targetPrice !== undefined) updateData.targetPrice = targetPrice;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await db.update(unlistedCart)
      .set(updateData)
      .where(eq(unlistedCart.id, id))
      .returning();

    return apiResponse.success(res, updated[0], 'Cart item updated');
  } catch (error: any) {
    console.error('Error updating cart item:', error);
    return apiResponse.serverError(res, 'Failed to update cart item');
  }
});

/**
 * DELETE /api/unlisted/cart/:id
 * Remove item from cart
 */
router.delete('/cart/:id', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const { id } = req.params;

    // Verify ownership and delete
    const deleted = await db.delete(unlistedCart)
      .where(and(
        eq(unlistedCart.id, id),
        eq(unlistedCart.userId, req.user.id)
      ))
      .returning();

    if (deleted.length === 0) {
      return apiResponse.notFound(res, 'Cart item not found');
    }

    return apiResponse.success(res, { deleted: true }, 'Removed from cart');
  } catch (error: any) {
    console.error('Error removing from cart:', error);
    return apiResponse.serverError(res, 'Failed to remove from cart');
  }
});

/**
 * DELETE /api/unlisted/cart
 * Clear entire cart
 */


export default router;
