// @ts-nocheck
/**
 * Bond Marketplace Routes
 * SEBI NCS & RBI Compliant Two-Sided Marketplace for Listed & Unlisted Bonds
 */

import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { apiResponse } from '../utils/responses';
import { requireAuth } from '../middleware/roleMiddleware';
import { db } from '../db';
import { eq, and, or, desc, asc, gte, lte, sql, isNotNull } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { determineRegulatoryTier, checkTierEligibility } from '../bond-kyc-gate';
import { getBondRiskDisclosures, validateDisclosureAcknowledgments } from '../services/bond-risk-disclosures';
import { orderAuditHook } from '../services/order-audit-hook';

const router = Router();

// ===================================================================
// BOND CATALOG ROUTES (Public browsing, no KYC required)
// ===================================================================

/**
 * GET /api/bonds/catalog
 * Browse available bonds with filters
 */
router.get('/admin/listings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userRoles = (req.user as any)?.roles || [];
    if (!userRoles.includes('admin') && !userRoles.includes('superadmin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }

    const { status } = req.query;

    let query = db.select().from(schema.bondSellListings);
    if (status) {
      query = query.where(eq(schema.bondSellListings.status, status as string)) as any;
    }

    const listings = await query.orderBy(desc(schema.bondSellListings.createdAt)).limit(100);

    return apiResponse.success(res, listings);
  } catch (error: any) {
    console.error('Error fetching admin listings:', error);
    return apiResponse.serverError(res, 'Failed to fetch listings');
  }
});

/**
 * GET /api/bonds/admin/requests
 * Get all buy requests for admin management
 */
router.get('/admin/requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const userRoles = (req.user as any)?.roles || [];
    if (!userRoles.includes('admin') && !userRoles.includes('superadmin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }

    const { status } = req.query;

    let query = db.select().from(schema.bondBuyRequests);
    if (status) {
      query = query.where(eq(schema.bondBuyRequests.status, status as string)) as any;
    }

    const requests = await query.orderBy(desc(schema.bondBuyRequests.createdAt)).limit(100);

    return apiResponse.success(res, requests);
  } catch (error: any) {
    console.error('Error fetching admin requests:', error);
    return apiResponse.serverError(res, 'Failed to fetch requests');
  }
});

/**
 * PATCH /api/bonds/admin/listings/:id/status
 * Update listing status (admin)
 */
router.patch('/admin/listings/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRoles = (req.user as any)?.roles || [];
    if (!userRoles.includes('admin') && !userRoles.includes('superadmin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }

    const { id } = req.params;
    const { status, complianceNotes } = req.body;

    const [listing] = await db.select().from(schema.bondSellListings)
      .where(eq(schema.bondSellListings.id, id));
    
    if (!listing) {
      return apiResponse.notFound(res, 'Listing not found');
    }

    const [updated] = await db.update(schema.bondSellListings)
      .set({ 
        status, 
        complianceStatus: status === 'active' ? 'cleared' : listing.complianceStatus,
        updatedAt: new Date() 
      })
      .where(eq(schema.bondSellListings.id, id))
      .returning();

    // Log audit
    await db.insert(schema.bondMarketplaceAuditLogs).values({
      userId,
      userRole: 'admin',
      action: 'update_listing_status',
      entityType: 'sell_listing',
      entityId: id,
      isin: listing.isin,
      bondType: listing.bondType,
      instrumentType: listing.instrumentType,
      beforeValue: { status: listing.status },
      afterValue: { status },
      changeDescription: `Updated listing status from ${listing.status} to ${status}`,
      complianceRelated: true,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000)
    });

    return apiResponse.success(res, updated);
  } catch (error: any) {
    console.error('Error updating listing status:', error);
    return apiResponse.serverError(res, 'Failed to update listing');
  }
});

/**
 * POST /api/bonds/admin/match
 * Create a deal by matching a sell listing with a buy request
 */
router.post('/admin/match', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRoles = (req.user as any)?.roles || [];
    if (!userRoles.includes('admin') && !userRoles.includes('superadmin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }

    const { sellListingId, buyRequestId, agreedPrice, quantity, accruedInterest = 0 } = req.body;

    // Fetch sell listing
    const [sellListing] = await db.select().from(schema.bondSellListings)
      .where(eq(schema.bondSellListings.id, sellListingId));
    
    if (!sellListing) {
      return apiResponse.notFound(res, 'Sell listing not found');
    }

    // Fetch buy request
    const [buyRequest] = await db.select().from(schema.bondBuyRequests)
      .where(eq(schema.bondBuyRequests.id, buyRequestId));
    
    if (!buyRequest) {
      return apiResponse.notFound(res, 'Buy request not found');
    }

    // Validate ISIN match
    if (sellListing.isin !== buyRequest.isin) {
      return apiResponse.badRequest(res, 'ISIN mismatch between listing and request');
    }

    // Calculate deal values
    const dirtyPrice = parseFloat(agreedPrice) + parseFloat(accruedInterest || '0');
    const totalValue = quantity * dirtyPrice;

    // Create deal
    const [deal] = await db.insert(schema.bondDeals).values({
      sellListingId,
      buyRequestId,
      sellerUserId: sellListing.sellerUserId,
      buyerUserId: buyRequest.buyerUserId,
      instrumentType: sellListing.instrumentType,
      governmentSecurityId: sellListing.governmentSecurityId,
      corporateBondId: sellListing.corporateBondId,
      isin: sellListing.isin,
      bondName: sellListing.bondName,
      bondType: sellListing.bondType,
      quantity,
      agreedPrice,
      accruedInterest: accruedInterest?.toString() || '0',
      dirtyPrice: dirtyPrice.toString(),
      totalValue: totalValue.toString(),
      status: 'pending',
      matchedBy: userId
    }).returning();

    // Update sell listing
    const newRemaining = (sellListing.quantityRemaining || sellListing.quantity) - quantity;
    await db.update(schema.bondSellListings)
      .set({
        quantityRemaining: newRemaining,
        status: newRemaining <= 0 ? 'matched' : 'partial',
        updatedAt: new Date()
      })
      .where(eq(schema.bondSellListings.id, sellListingId));

    // Update buy request
    const newFilled = (buyRequest.quantityFilled || 0) + quantity;
    await db.update(schema.bondBuyRequests)
      .set({
        quantityFilled: newFilled,
        status: newFilled >= buyRequest.quantity ? 'matched' : 'partial',
        updatedAt: new Date()
      })
      .where(eq(schema.bondBuyRequests.id, buyRequestId));

    // Log audit
    await db.insert(schema.bondMarketplaceAuditLogs).values({
      userId,
      userRole: 'admin',
      action: 'match_deal',
      entityType: 'deal',
      entityId: deal.id,
      isin: sellListing.isin,
      bondType: sellListing.bondType,
      instrumentType: sellListing.instrumentType,
      afterValue: deal,
      changeDescription: `Matched ${quantity} units at ${agreedPrice} per unit. Total: ${totalValue}`,
      complianceRelated: true,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000)
    });

    return apiResponse.success(res, deal, 201);
  } catch (error: any) {
    console.error('Error creating deal:', error);
    return apiResponse.serverError(res, 'Failed to create deal');
  }
});

// ===================================================================
// ONE-CLICK BOND ORDER ROUTES
// ===================================================================

/**
 * POST /api/bonds/orders
 * Create a new bond order (one-click investment)
 */
router.post('/orders', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const {
      isin,
      bondType,
      quantity,
      orderType = 'market',
      limitPrice,
      price,
      dematAccountNumber,
      dpId,
    } = req.body;

    // Validate required fields
    if (!isin || !quantity || quantity < 1) {
      return apiResponse.badRequest(res, 'ISIN and valid quantity are required');
    }

    // Look up bond details
    let bondDetails: any = null;
    let bondName = '';
    let issuer = '';
    let faceValue = 1000;
    let actualBondType = bondType || 'corporate';

    // Try government securities first
    const [govBond] = await db.select().from(schema.governmentSecurities)
      .where(eq(schema.governmentSecurities.isin, isin));
    
    if (govBond) {
      bondDetails = govBond;
      bondName = govBond.securityName || govBond.isin;
      issuer = 'Government of India';
      faceValue = parseFloat(govBond.faceValue?.toString() || '1000');
      actualBondType = 'government';
    } else {
      // Try corporate bonds
      const [corpBond] = await db.select().from(schema.corporateBonds)
        .where(eq(schema.corporateBonds.isin, isin));
      
      if (corpBond) {
        bondDetails = corpBond;
        bondName = corpBond.bondName || corpBond.isin;
        issuer = corpBond.issuer || 'Unknown';
        faceValue = parseFloat(corpBond.faceValue?.toString() || '1000');
        actualBondType = 'corporate';
      }
    }

    if (!bondDetails) {
      return apiResponse.notFound(res, 'Bond not found with the specified ISIN');
    }

    // Calculate order amounts
    const orderPrice = price || parseFloat(bondDetails.currentPrice?.toString() || bondDetails.lastPrice?.toString() || '1000');
    const grossAmount = orderPrice * quantity;
    const totalFaceValue = faceValue * quantity;
    
    // Calculate accrued interest (simplified)
    const accruedInterest = 0; // Would need coupon rate and last coupon date for accurate calculation
    const netAmount = grossAmount + accruedInterest;

    // Generate order number
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNumber = `BND${timestamp}${random}`;

    // Create bond order
    const [order] = await db.insert(schema.bondOrders).values({
      orderNumber,
      userId,
      clientCode: dematAccountNumber || null,
      bondId: bondDetails.id,
      bondType: actualBondType,
      isin,
      bondName,
      orderType: 'buy',
      orderCategory: orderType,
      quantity,
      faceValue: faceValue.toString(),
      totalFaceValue: totalFaceValue.toString(),
      orderPrice: orderPrice.toString(),
      limitPrice: limitPrice?.toString() || null,
      grossAmount: grossAmount.toString(),
      accruedInterest: accruedInterest.toString(),
      netAmount: netAmount.toString(),
      orderStatus: 'pending',
      dematAccountNumber: dematAccountNumber || null,
      orderPlacedBy: 'client',
      exchange: 'bse',
      paymentStatus: 'pending',
    }).returning();

    // Log audit to domain-specific table
    await db.insert(schema.bondMarketplaceAuditLogs).values({
      userId,
      userRole: 'client',
      action: 'place_order',
      entityType: 'bond_order',
      entityId: order.id,
      isin,
      bondType: actualBondType,
      instrumentType: actualBondType === 'government' ? 'government_security' : 'corporate_bond',
      afterValue: {
        orderNumber,
        quantity,
        price: orderPrice,
        netAmount,
        orderType,
      },
      changeDescription: `One-click bond order: ${quantity} units of ${bondName} at ₹${orderPrice} each. Total: ₹${netAmount.toFixed(2)}`,
      complianceRelated: true,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000)
    });

    // Log to immutable SEBI-compliant audit trail
    await orderAuditHook.logBondOrderCreated(
      order.id,
      userId,
      'client',
      {
        orderNumber,
        isin,
        bondType: actualBondType,
        bondName,
        quantity,
        orderPrice,
        netAmount,
        faceValue,
      },
      req
    );

    return apiResponse.success(res, {
      order,
      message: 'Bond order placed successfully',
      orderNumber: order.orderNumber,
    }, 201);
  } catch (error: any) {
    console.error('Error creating bond order:', error);
    return apiResponse.serverError(res, 'Failed to place bond order');
  }
});

/**
 * GET /api/bonds/orders
 * Get user's bond orders
 */
router.get('/orders', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const { status, limit = '50', offset = '0' } = req.query;

    const conditions = [eq(schema.bondOrders.userId, userId)];
    
    if (status && typeof status === 'string') {
      conditions.push(eq(schema.bondOrders.orderStatus, status));
    }

    const orders = await db.select().from(schema.bondOrders)
      .where(and(...conditions))
      .orderBy(desc(schema.bondOrders.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    return apiResponse.success(res, {
      orders,
      total: orders.length,
    });
  } catch (error: any) {
    console.error('Error fetching bond orders:', error);
    return apiResponse.serverError(res, 'Failed to fetch orders');
  }
});

/**
 * GET /api/bonds/orders/:id
 * Get a specific bond order
 */
router.get('/orders/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { id } = req.params;

    const [order] = await db.select().from(schema.bondOrders)
      .where(and(
        eq(schema.bondOrders.id, id),
        eq(schema.bondOrders.userId, userId)
      ));

    if (!order) {
      return apiResponse.notFound(res, 'Order not found');
    }

    return apiResponse.success(res, order);
  } catch (error: any) {
    console.error('Error fetching bond order:', error);
    return apiResponse.serverError(res, 'Failed to fetch order');
  }
});

/**
 * PATCH /api/bonds/orders/:id/cancel
 * Cancel a pending bond order
 */
router.patch('/orders/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { id } = req.params;

    const [order] = await db.select().from(schema.bondOrders)
      .where(and(
        eq(schema.bondOrders.id, id),
        eq(schema.bondOrders.userId, userId)
      ));

    if (!order) {
      return apiResponse.notFound(res, 'Order not found');
    }

    if (order.orderStatus !== 'pending') {
      return apiResponse.badRequest(res, 'Only pending orders can be cancelled');
    }

    const [updated] = await db.update(schema.bondOrders)
      .set({
        orderStatus: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(schema.bondOrders.id, id))
      .returning();

    // Log audit
    await db.insert(schema.bondMarketplaceAuditLogs).values({
      userId,
      userRole: 'client',
      action: 'cancel_order',
      entityType: 'bond_order',
      entityId: id,
      isin: order.isin,
      bondType: order.bondType,
      beforeValue: { status: order.orderStatus },
      afterValue: { status: 'cancelled' },
      changeDescription: `Cancelled order ${order.orderNumber}`,
      complianceRelated: true,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000)
    });

    return apiResponse.success(res, updated);
  } catch (error: any) {
    console.error('Error cancelling bond order:', error);
    return apiResponse.serverError(res, 'Failed to cancel order');
  }
});

/**
 * GET /api/bonds/admin/stats
 * Get bond marketplace statistics
 */
router.get('/admin/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const userRoles = (req.user as any)?.roles || [];
    if (!userRoles.includes('admin') && !userRoles.includes('superadmin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }

    // Get counts
    const [sellListingsCount] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.bondSellListings);
    
    const [buyRequestsCount] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.bondBuyRequests);
    
    const [dealsCount] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.bondDeals);

    const [activeSellListings] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.bondSellListings)
      .where(eq(schema.bondSellListings.status, 'active'));

    const [activeBuyRequests] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.bondBuyRequests)
      .where(eq(schema.bondBuyRequests.status, 'active'));

    const [pendingDeals] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.bondDeals)
      .where(eq(schema.bondDeals.status, 'pending'));

    // Get total volume
    const [totalVolume] = await db.select({ 
      total: sql<string>`COALESCE(SUM(total_value), 0)` 
    }).from(schema.bondDeals)
      .where(eq(schema.bondDeals.status, 'completed'));

    return apiResponse.success(res, {
      totalSellListings: sellListingsCount?.count || 0,
      totalBuyRequests: buyRequestsCount?.count || 0,
      totalDeals: dealsCount?.count || 0,
      activeSellListings: activeSellListings?.count || 0,
      activeBuyRequests: activeBuyRequests?.count || 0,
      pendingDeals: pendingDeals?.count || 0,
      totalVolume: totalVolume?.total || '0'
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    return apiResponse.serverError(res, 'Failed to fetch statistics');
  }
});


export default router;
