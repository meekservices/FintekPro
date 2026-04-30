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
import { unlistedEscrowService } from "../services/unlisted-escrow-service";
import { regulatoryReportingService } from "../services/regulatory-reporting-service";
import { auditLogArchivalService } from "../services/audit-log-archival";



const router = Router();

// ===================================================================
// COMPANY MANAGEMENT ROUTES
// ===================================================================

/**
 * GET /api/unlisted/companies
 * List only STORE-PUBLISHED unlisted companies (public - no KYC required for browsing)
 * Only returns companies where storeProductId is not null (published to store)
 */
router.delete('/cart', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    await db.delete(unlistedCart)
      .where(eq(unlistedCart.userId, req.user.id));

    return apiResponse.success(res, { cleared: true }, 'Cart cleared');
  } catch (error: any) {
    console.error('Error clearing cart:', error);
    return apiResponse.serverError(res, 'Failed to clear cart');
  }
});

/**
 * POST /api/unlisted/cart/checkout
 * Convert all cart items to buy requests (batch checkout)
 * Regulatory Requirements:
 * - Enhanced KYC (Level 2) required
 * - Risk disclosure acknowledgment required for each company
 * - Accredited investor check for high-value transactions
 */
router.post('/cart/checkout', requireLevel2, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const { acknowledgedDisclosureIds } = req.body;

    // Get cart items
    const cartItems = await db.select().from(unlistedCart)
      .where(eq(unlistedCart.userId, req.user.id));

    if (cartItems.length === 0) {
      return apiResponse.badRequest(res, 'Cart is empty');
    }

    // Calculate total transaction value
    const totalValue = cartItems.reduce((sum, item) => {
      const price = parseFloat(item.maxPrice) || 0;
      return sum + (item.quantity * price);
    }, 0);

    const ACCREDITED_INVESTOR_THRESHOLD = 5000000; // ₹50 lakhs

    // For high-value transactions, verify accredited investor status
    if (totalValue >= ACCREDITED_INVESTOR_THRESHOLD) {
      const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, req.user.id),
      });
      
      if (!profile?.accreditedInvestorType) {
        console.log(`[COMPLIANCE] cart_checkout_blocked: High-value transaction (₹${totalValue}) requires accredited investor status | userId: ${req.user.id}`);
        return apiResponse.forbidden(res, 
          `Cart total of ₹${(totalValue / 100000).toFixed(2)} lakhs exceeds the limit for non-accredited investors. Please complete your accredited investor verification.`
        );
      }
    }

    // Validate risk disclosure acknowledgment
    if (!acknowledgedDisclosureIds || !Array.isArray(acknowledgedDisclosureIds)) {
      return apiResponse.badRequest(res, 'Risk disclosure acknowledgment is required for batch checkout');
    }

    // Create buy requests for each cart item
    const createdRequests: BuyRequest[] = [];
    const errors: { companyId: string; error: string }[] = [];

    for (const item of cartItems) {
      try {
        // Validate disclosure for this company
        const disclosureValidation = unlistedRiskDisclosureService.validateAcknowledgment({
          acknowledgedDisclosureIds,
          userId: req.user.id,
          companyId: item.companyId,
          tradeType: 'buy',
        });

        if (!disclosureValidation.valid) {
          errors.push({
            companyId: item.companyId,
            error: 'Missing risk disclosure acknowledgment',
          });
          continue;
        }

        // Persist risk disclosure acknowledgment for audit trail
        await saveRiskAcknowledgment({
          userId: req.user.id,
          companyId: item.companyId,
          tradeType: 'buy',
          acknowledgedDisclosureIds,
          ipAddress: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
        });

        // Create buy request
        const buyRequest = await storage.createBuyRequest({
          buyerUserId: req.user.id,
          companyId: item.companyId,
          quantity: item.quantity,
          maxPrice: item.maxPrice,
          targetPrice: item.targetPrice,
          notes: item.notes,
          status: 'pending',
        });

        createdRequests.push(buyRequest);

        // Log compliance event
        console.log(`[COMPLIANCE] cart_checkout_buy_request: { userId: '${req.user.id}', companyId: '${item.companyId}', quantity: ${item.quantity}, buyRequestId: '${buyRequest.id}' }`);
      } catch (itemError: any) {
        errors.push({
          companyId: item.companyId,
          error: itemError.message || 'Failed to create buy request',
        });
      }
    }

    // Clear successful items from cart
    if (createdRequests.length > 0) {
      const successCompanyIds = createdRequests.map(r => r.companyId);
      for (const companyId of successCompanyIds) {
        await db.delete(unlistedCart)
          .where(and(
            eq(unlistedCart.userId, req.user.id),
            eq(unlistedCart.companyId, companyId)
          ));
      }
    }

    console.log(`[COMPLIANCE] cart_checkout_complete: { userId: '${req.user.id}', successCount: ${createdRequests.length}, errorCount: ${errors.length}, totalValue: ${totalValue} }`);

    return apiResponse.success(res, {
      createdRequests,
      errors,
      summary: {
        total: cartItems.length,
        successful: createdRequests.length,
        failed: errors.length,
      },
    }, `Checkout complete: ${createdRequests.length} buy request(s) created`);
  } catch (error: any) {
    console.error('Error during cart checkout:', error);
    return apiResponse.serverError(res, 'Failed to complete checkout');
  }
});

/**
 * GET /api/unlisted/cart/count
 * Get cart item count for badge display
 */
router.get('/cart/count', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    const items = await db.select({ id: unlistedCart.id }).from(unlistedCart)
      .where(eq(unlistedCart.userId, req.user.id));

    return apiResponse.success(res, { count: items.length });
  } catch (error: any) {
    console.error('Error fetching cart count:', error);
    return apiResponse.serverError(res, 'Failed to fetch cart count');
  }
});

// ===================================================================
// ELIGIBILITY ROUTES
// ===================================================================

/**
 * GET /api/unlisted/eligibility
 * Check current user's eligibility for unlisted marketplace trading
 */
router.get('/eligibility', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const eligibility = await unlistedEligibilityService.checkUserEligibility(req.user.id);
    return apiResponse.success(res, eligibility);
  } catch (error: any) {
    console.error('Error checking eligibility:', error);
    return apiResponse.serverError(res, 'Failed to check eligibility');
  }
});

/**
 * POST /api/unlisted/eligibility/check-trade
 * Check if a specific trade is allowed based on user eligibility and trade value
 */
router.post('/eligibility/check-trade', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const { tradeValue, tradeType } = req.body;
    
    if (typeof tradeValue !== 'number' || tradeValue <= 0) {
      return apiResponse.badRequest(res, 'Valid trade value is required');
    }
    
    if (!['buy', 'sell'].includes(tradeType)) {
      return apiResponse.badRequest(res, 'Trade type must be "buy" or "sell"');
    }
    
    const eligibility = await unlistedEligibilityService.checkTradeEligibility({
      userId: req.user.id,
      tradeValue,
      tradeType,
    });
    
    return apiResponse.success(res, eligibility);
  } catch (error: any) {
    console.error('Error checking trade eligibility:', error);
    return apiResponse.serverError(res, 'Failed to check trade eligibility');
  }
});

/**
 * GET /api/unlisted/eligibility/requirements
 * Get the requirements for trading in the unlisted marketplace
 */
router.get('/eligibility/requirements', async (_req: Request, res: Response) => {
  try {
    const requirements = await unlistedEligibilityService.getEligibilityRequirements();
    return apiResponse.success(res, requirements);
  } catch (error: any) {
    console.error('Error fetching requirements:', error);
    return apiResponse.serverError(res, 'Failed to fetch requirements');
  }
});

/**
 * GET /api/unlisted/eligibility/kyc-upgrade
 * Get the user's KYC upgrade status and remaining steps
 */
router.get('/eligibility/kyc-upgrade', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const upgradeStatus = await unlistedEligibilityService.getKYCUpgradeStatus(req.user.id);
    return apiResponse.success(res, upgradeStatus);
  } catch (error: any) {
    console.error('Error fetching KYC upgrade status:', error);
    return apiResponse.serverError(res, 'Failed to fetch KYC upgrade status');
  }
});

// ===================================================================
// RISK DISCLOSURES ROUTES
// ===================================================================

/**
 * GET /api/unlisted/risk-disclosures
 * Get all SEBI-mandated risk disclosures for unlisted securities trading
 */
router.get('/risk-disclosures', async (_req: Request, res: Response) => {
  try {
    const formattedDisclosures = unlistedRiskDisclosureService.formatDisclosuresForDisplay();
    return apiResponse.success(res, formattedDisclosures);
  } catch (error: any) {
    console.error('Error fetching risk disclosures:', error);
    return apiResponse.serverError(res, 'Failed to fetch risk disclosures');
  }
});

/**
 * GET /api/unlisted/risk-disclosures/company/:companyId
 * Get company-specific risk warnings in addition to standard disclosures
 */
router.get('/risk-disclosures/company/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const ratios = await storage.getCompanyRatios(companyId);
    const latestRatios = ratios && ratios.length > 0 ? ratios[0] : null;
    
    const companyRisks = unlistedRiskDisclosureService.getCompanySpecificRisks({
      netWorth: (company as any).netWorth ? parseFloat((company as any).netWorth.toString()) : undefined,
      debtEquityRatio: latestRatios?.debtEquity ? parseFloat(latestRatios.debtEquity.toString()) : undefined,
      profitMargin: latestRatios?.marginPat ? parseFloat(latestRatios.marginPat.toString()) : undefined,
      riskScore: (company as any).riskScore ?? undefined,
    });
    
    const standardDisclosures = unlistedRiskDisclosureService.formatDisclosuresForDisplay();
    
    return apiResponse.success(res, {
      ...standardDisclosures,
      companySpecificRisks: companyRisks,
      companyName: company.name,
      companyRiskScore: (company as any).riskScore,
    });
  } catch (error: any) {
    console.error('Error fetching company risk disclosures:', error);
    return apiResponse.serverError(res, 'Failed to fetch company risk disclosures');
  }
});

/**
 * POST /api/unlisted/risk-disclosures/validate
 * Validate that all mandatory disclosures have been acknowledged
 */
router.post('/risk-disclosures/validate', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    const { acknowledgedDisclosureIds, companyId, tradeType } = req.body;
    
    if (!Array.isArray(acknowledgedDisclosureIds)) {
      return apiResponse.badRequest(res, 'acknowledgedDisclosureIds must be an array');
    }
    
    if (!companyId || typeof companyId !== 'string') {
      return apiResponse.badRequest(res, 'companyId is required');
    }
    
    if (!['buy', 'sell'].includes(tradeType)) {
      return apiResponse.badRequest(res, 'tradeType must be "buy" or "sell"');
    }
    
    const validation = unlistedRiskDisclosureService.validateAcknowledgment({
      acknowledgedDisclosureIds,
      userId: req.user.id,
      companyId,
      tradeType,
    });
    
    if (!validation.valid) {
      return apiResponse.badRequest(res, 'Not all mandatory disclosures have been acknowledged', {
        missingDisclosures: validation.missingDisclosures,
      });
    }
    
    console.log(`[COMPLIANCE] risk_disclosure_acknowledged: { userId: '${req.user.id}', companyId: '${companyId}', tradeType: '${tradeType}', version: '${unlistedRiskDisclosureService.getDisclosureVersion()}' }`);
    
    return apiResponse.success(res, {
      valid: true,
      disclosureVersion: unlistedRiskDisclosureService.getDisclosureVersion(),
      acknowledgedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error validating risk disclosures:', error);
    return apiResponse.serverError(res, 'Failed to validate risk disclosures');
  }
});

// ===================================================================
// TRADING ROUTES - DEALS
// ===================================================================

/**
 * GET /api/unlisted/deals
 * Get matched deals
 */
router.get('/deals', requireLevel2, async (req: Request, res: Response) => {
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
router.get('/deals/:id', requireLevel2, async (req: Request, res: Response) => {
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

/**
 * GET /api/unlisted/my-deals
 * Get all deals for the current user (as buyer or seller)
 */
router.get('/my-deals', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse.unauthorized(res, 'User not authenticated');
    }
    
    const deals = await storage.getUnlistedDealsByUser(userId);
    
    // Enrich deals with company information
    const enrichedDeals = await Promise.all(deals.map(async (deal) => {
      const company = await storage.getUnlistedCompanyById(deal.companyId);
      return {
        ...deal,
        company: company ? { id: company.id, name: company.name, symbol: company.symbol } : null,
        userRole: deal.buyerUserId === userId ? 'buyer' : 'seller',
      };
    }));
    
    return apiResponse.success(res, enrichedDeals);
  } catch (error: any) {
    console.error('Error fetching user deals:', error);
    return apiResponse.serverError(res, 'Failed to fetch deals');
  }
});

/**
 * GET /api/unlisted/deals-pending-acceptance
 * Get deals awaiting user's acceptance
 */
router.get('/deals-pending-acceptance', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse.unauthorized(res, 'User not authenticated');
    }
    
    const deals = await storage.getUnlistedDealsPendingAcceptance(userId);
    
    // Enrich with company info and determine if user has accepted
    const enrichedDeals = await Promise.all(deals.map(async (deal) => {
      const company = await storage.getUnlistedCompanyById(deal.companyId);
      const isBuyer = deal.buyerUserId === userId;
      const userHasAccepted = isBuyer ? deal.buyerAccepted : deal.sellerAccepted;
      
      return {
        ...deal,
        company: company ? { id: company.id, name: company.name, symbol: company.symbol } : null,
        userRole: isBuyer ? 'buyer' : 'seller',
        userHasAccepted,
        counterpartyAccepted: isBuyer ? deal.sellerAccepted : deal.buyerAccepted,
      };
    }));
    
    return apiResponse.success(res, enrichedDeals);
  } catch (error: any) {
    console.error('Error fetching pending deals:', error);
    return apiResponse.serverError(res, 'Failed to fetch pending deals');
  }
});

/**
 * POST /api/unlisted/deals/:id/accept
 * Accept a matched deal (buyer or seller)
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */
router.post('/deals/:id/accept', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
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
      return apiResponse.forbidden(res, 'You are not authorized to accept this deal');
    }
    
    // Check if deal is in acceptable state
    if (deal.status !== 'pending' && deal.status !== 'awaiting_acceptance') {
      return apiResponse.badRequest(res, `Deal cannot be accepted in current status: ${deal.status}`);
    }
    
    // Check if user already accepted
    if (isBuyer && deal.buyerAccepted) {
      return apiResponse.badRequest(res, 'You have already accepted this deal');
    }
    if (isSeller && deal.sellerAccepted) {
      return apiResponse.badRequest(res, 'You have already accepted this deal');
    }
    
    // Check acceptance deadline
    if (deal.acceptanceDeadline && new Date() > new Date(deal.acceptanceDeadline)) {
      return apiResponse.badRequest(res, 'Acceptance deadline has passed');
    }
    
    // Require risk disclosure acknowledgment before deal acceptance
    const tradeType = isBuyer ? 'buy' : 'sell';
    const { acknowledgedDisclosureIds } = req.body;
    
    if (!acknowledgedDisclosureIds || !Array.isArray(acknowledgedDisclosureIds)) {
      return apiResponse.badRequest(res, 'Risk disclosure acknowledgment is required before accepting a deal', {
        requiresAcknowledgment: true,
        tradeType,
        companyId: deal.companyId,
        disclosures: unlistedRiskDisclosureService.formatDisclosuresForDisplay(),
      });
    }
    
    const disclosureValidation = unlistedRiskDisclosureService.validateAcknowledgment({
      acknowledgedDisclosureIds,
      userId,
      companyId: deal.companyId,
      tradeType,
    });
    
    if (!disclosureValidation.valid) {
      console.log(`[COMPLIANCE] deal_accept_blocked: Missing risk disclosures | userId: ${userId} | dealId: ${id} | missing: ${disclosureValidation.missingDisclosures.join(', ')}`);
      return apiResponse.badRequest(res, 'All mandatory risk disclosures must be acknowledged before accepting the deal.', {
        missingDisclosures: disclosureValidation.missingDisclosures,
      });
    }
    
    // Persist risk disclosure acknowledgment for audit trail
    await saveRiskAcknowledgment({
      userId,
      companyId: deal.companyId,
      tradeType,
      tradeEntityId: id,
      tradeEntityType: 'deal_acceptance',
      acknowledgedDisclosureIds,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
    
    // Update the deal with acceptance
    const updateData: any = {
      status: 'awaiting_acceptance',
    };
    
    if (isBuyer) {
      updateData.buyerAccepted = true;
      updateData.buyerAcceptedAt = new Date();
    } else {
      updateData.sellerAccepted = true;
      updateData.sellerAcceptedAt = new Date();
    }
    
    // Check if both parties have now accepted
    const otherPartyAccepted = isBuyer ? deal.sellerAccepted : deal.buyerAccepted;
    if (otherPartyAccepted) {
      updateData.status = 'confirmed';
    }
    
    const updatedDeal = await storage.updateUnlistedDeal(id, updateData);
    
    // Archive deal acceptance event for immutable audit log
    const totalValue = parseFloat(deal.totalValue || '0');
    await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
      eventType: 'deal_accepted',
      userId,
      dealId: id,
      companyId: deal.companyId,
      action: `Deal accepted by ${isBuyer ? 'buyer' : 'seller'}`,
      details: {
        role: isBuyer ? 'buyer' : 'seller',
        agreedPrice: deal.agreedPrice,
        quantity: deal.quantity,
        totalValue,
        bothAccepted: updateData.status === 'confirmed',
      },
      riskLevel: totalValue >= 5000000 ? 'high' : 'low',
    });
    
    // Register regulatory event for high-value deals
    if (totalValue >= 1000000) {
      await regulatoryReportingService.registerReportableEvent({
        eventType: 'deal_acceptance',
        triggeredBy: 'user_action',
        userId,
        dealId: id,
        amount: totalValue,
        currency: 'INR',
        riskIndicators: totalValue >= 5000000 ? ['high_value_transaction'] : [],
        riskScore: totalValue >= 5000000 ? 40 : 20,
        metadata: {
          role: isBuyer ? 'buyer' : 'seller',
          companyId: deal.companyId,
          bothAccepted: updateData.status === 'confirmed',
        },
      });
    }
    
    // If both accepted, trigger payment flow notification
    if (updateData.status === 'confirmed') {
      console.log(`[Deal ${id}] Both parties accepted - deal confirmed, ready for payment`);
    }
    
    return apiResponse.success(res, {
      deal: updatedDeal,
      message: otherPartyAccepted 
        ? 'Deal confirmed! Both parties have accepted. Proceed to payment.'
        : `You have accepted the deal. Waiting for ${isBuyer ? 'seller' : 'buyer'} confirmation.`,
      bothAccepted: updateData.status === 'confirmed',
    });
  } catch (error: any) {
    console.error('Error accepting deal:', error);
    return apiResponse.serverError(res, 'Failed to accept deal');
  }
});

/**
 * POST /api/unlisted/deals/:id/reject
 * Reject a matched deal (buyer or seller)
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */

export default router;
