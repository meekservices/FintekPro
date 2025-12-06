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

const router = Router();

// ===================================================================
// BOND CATALOG ROUTES (Public browsing, no KYC required)
// ===================================================================

/**
 * GET /api/bonds/catalog
 * Browse available bonds with filters
 */
router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const { 
      type, // 'government' | 'corporate' | 'all'
      bondType, // specific bond type
      minYield,
      maxYield,
      minMaturity,
      maxMaturity,
      creditRating,
      isListed,
      limit = '50',
      offset = '0'
    } = req.query;

    const bonds: any[] = [];

    // Fetch government securities
    if (!type || type === 'all' || type === 'government') {
      let govQuery = db.select().from(schema.governmentSecurities)
        .where(eq(schema.governmentSecurities.tradingStatus, 'active'));
      
      const govBonds = await govQuery.limit(parseInt(limit as string));
      bonds.push(...govBonds.map(b => ({
        ...b,
        instrumentType: 'government_security',
        source: 'government_securities'
      })));
    }

    // Fetch corporate bonds
    if (!type || type === 'all' || type === 'corporate') {
      let corpQuery = db.select().from(schema.corporateBonds)
        .where(eq(schema.corporateBonds.tradingStatus, 'active'));
      
      const corpBonds = await corpQuery.limit(parseInt(limit as string));
      bonds.push(...corpBonds.map(b => ({
        ...b,
        instrumentType: 'corporate_bond',
        source: 'corporate_bonds'
      })));
    }

    return apiResponse.success(res, {
      bonds,
      total: bonds.length,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error: any) {
    console.error('Error fetching bond catalog:', error);
    return apiResponse.serverError(res, 'Failed to fetch bond catalog');
  }
});

/**
 * GET /api/bonds/catalog/:isin
 * Get bond details by ISIN
 */
router.get('/catalog/:isin', async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;

    // Try government securities first
    const [govBond] = await db.select().from(schema.governmentSecurities)
      .where(eq(schema.governmentSecurities.isin, isin));
    
    if (govBond) {
      return apiResponse.success(res, {
        ...govBond,
        instrumentType: 'government_security',
        source: 'government_securities'
      });
    }

    // Try corporate bonds
    const [corpBond] = await db.select().from(schema.corporateBonds)
      .where(eq(schema.corporateBonds.isin, isin));
    
    if (corpBond) {
      return apiResponse.success(res, {
        ...corpBond,
        instrumentType: 'corporate_bond',
        source: 'corporate_bonds'
      });
    }

    return apiResponse.notFound(res, 'Bond not found');
  } catch (error: any) {
    console.error('Error fetching bond details:', error);
    return apiResponse.serverError(res, 'Failed to fetch bond details');
  }
});

// ===================================================================
// SELL LISTING ROUTES (Requires authentication)
// ===================================================================

/**
 * GET /api/bonds/sell-listings
 * Get active sell listings (public view for browsing)
 */
router.get('/sell-listings', async (req: Request, res: Response) => {
  try {
    const { bondType, isin, status = 'active' } = req.query;

    const conditions = [eq(schema.bondSellListings.status, status as string)];
    
    if (bondType) {
      conditions.push(eq(schema.bondSellListings.bondType, bondType as string));
    }
    if (isin) {
      conditions.push(eq(schema.bondSellListings.isin, isin as string));
    }

    const listings = await db.select().from(schema.bondSellListings)
      .where(and(...conditions))
      .orderBy(desc(schema.bondSellListings.createdAt))
      .limit(50);

    return apiResponse.success(res, listings);
  } catch (error: any) {
    console.error('Error fetching sell listings:', error);
    return apiResponse.serverError(res, 'Failed to fetch sell listings');
  }
});

/**
 * POST /api/bonds/sell-listings
 * Create a new sell listing (requires auth + SEBI tier compliance)
 */
router.post('/sell-listings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const {
      instrumentType,
      governmentSecurityId,
      corporateBondId,
      isin,
      bondName,
      bondType,
      couponRate,
      maturityDate,
      creditRating,
      isListed,
      faceValue,
      quantity,
      askPrice,
      askYield,
      floorPrice,
      minimumLotSize,
      validUntil,
      notes,
      dematAccountNumber,
      riskAcknowledgments
    } = req.body;

    // Validate required fields
    if (!instrumentType || !isin || !bondName || !bondType || !faceValue || !quantity || !askPrice || !floorPrice) {
      return apiResponse.badRequest(res, 'Missing required fields');
    }

    // SEBI Compliance: Determine regulatory tier based on bond type and transaction value
    const transactionValue = parseFloat(askPrice) * parseInt(quantity);
    const requiredTier = determineRegulatoryTier(bondType, transactionValue, isListed);
    
    // Check if user meets tier eligibility requirements
    const tierCheck = await checkTierEligibility(userId, requiredTier);
    if (!tierCheck.eligible) {
      await db.insert(schema.bondMarketplaceAuditLogs).values({
        userId,
        action: 'tier_check_failed',
        entityType: 'sell_listing',
        isin,
        bondType,
        instrumentType,
        changeDescription: `Tier check failed: ${tierCheck.reason}. Required tier: ${requiredTier}`,
        retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000)
      });
      return apiResponse.forbidden(res, `KYC tier requirement not met: ${tierCheck.reason}. Required tier: ${requiredTier}`);
    }

    // SEBI Compliance: Validate risk disclosure acknowledgments for unlisted/high-value bonds
    if (requiredTier === 'tier_3' || !isListed) {
      const disclosureResult = getBondRiskDisclosures(bondType, requiredTier);
      const requiredDisclosures = disclosureResult.disclosures.filter(d => d.requiresExplicitAck).map(d => d.category);
      
      if (!riskAcknowledgments || !validateDisclosureAcknowledgments(riskAcknowledgments, requiredDisclosures)) {
        return apiResponse.badRequest(res, 'Risk disclosure acknowledgments required for this bond type. Please acknowledge all mandatory risks before proceeding.');
      }
    }

    // Create sell listing
    const [listing] = await db.insert(schema.bondSellListings).values({
      sellerUserId: userId,
      instrumentType,
      governmentSecurityId,
      corporateBondId,
      isin,
      bondName,
      bondType,
      couponRate,
      maturityDate,
      creditRating,
      isListed: isListed ?? true,
      faceValue,
      quantity,
      askPrice,
      askYield,
      floorPrice,
      quantityRemaining: quantity,
      minimumLotSize: minimumLotSize || 1,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes,
      dematAccountNumber,
      status: 'pending'
    }).returning();

    // Log audit
    await db.insert(schema.bondMarketplaceAuditLogs).values({
      userId,
      action: 'create_listing',
      entityType: 'sell_listing',
      entityId: listing.id,
      isin,
      bondType,
      instrumentType,
      afterValue: listing,
      changeDescription: `Created sell listing for ${quantity} units of ${bondName}`,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000) // 7 years
    });

    return apiResponse.success(res, listing, 201);
  } catch (error: any) {
    console.error('Error creating sell listing:', error);
    return apiResponse.serverError(res, 'Failed to create sell listing');
  }
});

/**
 * GET /api/bonds/sell-listings/my
 * Get current user's sell listings
 */
router.get('/sell-listings/my', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const listings = await db.select().from(schema.bondSellListings)
      .where(eq(schema.bondSellListings.sellerUserId, userId))
      .orderBy(desc(schema.bondSellListings.createdAt));

    return apiResponse.success(res, listings);
  } catch (error: any) {
    console.error('Error fetching user sell listings:', error);
    return apiResponse.serverError(res, 'Failed to fetch sell listings');
  }
});

// ===================================================================
// BUY REQUEST ROUTES (Requires authentication)
// ===================================================================

/**
 * GET /api/bonds/buy-requests
 * Get active buy requests (admin view)
 */
router.get('/buy-requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const { bondType, isin, status = 'active' } = req.query;

    const conditions = [eq(schema.bondBuyRequests.status, status as string)];
    
    if (bondType) {
      conditions.push(eq(schema.bondBuyRequests.bondType, bondType as string));
    }
    if (isin) {
      conditions.push(eq(schema.bondBuyRequests.isin, isin as string));
    }

    const requests = await db.select().from(schema.bondBuyRequests)
      .where(and(...conditions))
      .orderBy(desc(schema.bondBuyRequests.createdAt))
      .limit(50);

    return apiResponse.success(res, requests);
  } catch (error: any) {
    console.error('Error fetching buy requests:', error);
    return apiResponse.serverError(res, 'Failed to fetch buy requests');
  }
});

/**
 * POST /api/bonds/buy-requests
 * Create a new buy request (requires auth + SEBI tier compliance)
 */
router.post('/buy-requests', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const {
      instrumentType,
      governmentSecurityId,
      corporateBondId,
      isin,
      bondName,
      bondType,
      couponRate,
      maturityDate,
      creditRating,
      isListed,
      faceValue,
      quantity,
      maxPrice,
      targetPrice,
      targetYield,
      validUntil,
      notes,
      riskAcknowledged,
      riskAcknowledgments
    } = req.body;

    // Validate required fields
    if (!instrumentType || !isin || !bondName || !bondType || !faceValue || !quantity || !maxPrice) {
      return apiResponse.badRequest(res, 'Missing required fields');
    }

    // SEBI Compliance: Determine regulatory tier based on bond type and transaction value
    const transactionValue = parseFloat(maxPrice) * parseInt(quantity);
    const requiredTier = determineRegulatoryTier(bondType, transactionValue, isListed);
    
    // Check if user meets tier eligibility requirements
    const tierCheck = await checkTierEligibility(userId, requiredTier);
    if (!tierCheck.eligible) {
      await db.insert(schema.bondMarketplaceAuditLogs).values({
        userId,
        action: 'tier_check_failed',
        entityType: 'buy_request',
        isin,
        bondType,
        instrumentType,
        changeDescription: `Tier check failed: ${tierCheck.reason}. Required tier: ${requiredTier}`,
        retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000)
      });
      return apiResponse.forbidden(res, `KYC tier requirement not met: ${tierCheck.reason}. Required tier: ${requiredTier}`);
    }

    // SEBI Compliance: Validate risk disclosure acknowledgments for unlisted/high-value bonds
    if (requiredTier === 'tier_3' || !isListed) {
      const disclosureResult = getBondRiskDisclosures(bondType, requiredTier);
      const requiredDisclosures = disclosureResult.disclosures.filter(d => d.requiresExplicitAck).map(d => d.category);
      
      if (!riskAcknowledgments || !validateDisclosureAcknowledgments(riskAcknowledgments, requiredDisclosures)) {
        return apiResponse.badRequest(res, 'Risk disclosure acknowledgments required for this bond type. Please acknowledge all mandatory risks before proceeding.');
      }
    }

    // Create buy request
    const [request] = await db.insert(schema.bondBuyRequests).values({
      buyerUserId: userId,
      instrumentType,
      governmentSecurityId,
      corporateBondId,
      isin,
      bondName,
      bondType,
      couponRate,
      maturityDate,
      creditRating,
      isListed: isListed ?? true,
      faceValue,
      quantity,
      maxPrice,
      targetPrice,
      targetYield,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes,
      riskAcknowledged: riskAcknowledged || false,
      riskAcknowledgedAt: riskAcknowledged ? new Date() : null,
      status: 'pending'
    }).returning();

    // Log audit
    await db.insert(schema.bondMarketplaceAuditLogs).values({
      userId,
      action: 'create_request',
      entityType: 'buy_request',
      entityId: request.id,
      isin,
      bondType,
      instrumentType,
      afterValue: request,
      changeDescription: `Created buy request for ${quantity} units of ${bondName}`,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000)
    });

    return apiResponse.success(res, request, 201);
  } catch (error: any) {
    console.error('Error creating buy request:', error);
    return apiResponse.serverError(res, 'Failed to create buy request');
  }
});

/**
 * GET /api/bonds/buy-requests/my
 * Get current user's buy requests
 */
router.get('/buy-requests/my', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const requests = await db.select().from(schema.bondBuyRequests)
      .where(eq(schema.bondBuyRequests.buyerUserId, userId))
      .orderBy(desc(schema.bondBuyRequests.createdAt));

    return apiResponse.success(res, requests);
  } catch (error: any) {
    console.error('Error fetching user buy requests:', error);
    return apiResponse.serverError(res, 'Failed to fetch buy requests');
  }
});

// ===================================================================
// DEAL ROUTES (Requires admin for matching)
// ===================================================================

/**
 * GET /api/bonds/deals
 * Get deals (user sees their own, admin sees all)
 */
router.get('/deals', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRoles = (req.user as any)?.roles || [];
    const isAdmin = userRoles.includes('admin') || userRoles.includes('superadmin');

    let deals;
    if (isAdmin) {
      deals = await db.select().from(schema.bondDeals)
        .orderBy(desc(schema.bondDeals.matchedAt))
        .limit(100);
    } else {
      deals = await db.select().from(schema.bondDeals)
        .where(or(
          eq(schema.bondDeals.sellerUserId, userId),
          eq(schema.bondDeals.buyerUserId, userId)
        ))
        .orderBy(desc(schema.bondDeals.matchedAt));
    }

    return apiResponse.success(res, deals);
  } catch (error: any) {
    console.error('Error fetching deals:', error);
    return apiResponse.serverError(res, 'Failed to fetch deals');
  }
});

// ===================================================================
// ADMIN ROUTES
// ===================================================================

/**
 * GET /api/bonds/admin/listings
 * Get all listings for admin management
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
