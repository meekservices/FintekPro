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
import { unlistedEscrowService } from '../services/unlisted-escrow-service';
import { auditLogArchivalService } from '../services/audit-log-archival';
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
router.post('/deals/:dealId/initiate-payment', requireAuth, requireLevel2, requireRiskDisclosure('buy'), async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const user = req.user as any;
    const { returnUrl } = req.body;

    const deal = await storage.getUnlistedDealById(dealId);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }

    const result = await unlistedEscrowService.initiateEscrowPayment({
      dealId,
      buyerUserId: user.id,
      buyerEmail: user.email,
      buyerPhone: user.phone,
      buyerName: user.name || user.firstName,
      returnUrl
    });

    if (!result.success) {
      return apiResponse.badRequest(res, result.message || 'Failed to initiate payment');
    }

    // Archive payment initiation event for immutable audit log
    const totalValue = parseFloat(deal.totalValue || '0');
    await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
      eventType: 'payment_initiated',
      userId: user.id,
      dealId,
      companyId: deal.companyId,
      action: 'Buyer initiated escrow payment',
      details: {
        totalValue,
        quantity: deal.quantity,
        agreedPrice: deal.agreedPrice,
        orderId: result.orderId,
      },
      riskLevel: totalValue >= 5000000 ? 'high' : 'low',
    });

    // Register regulatory event for high-value payments
    if (totalValue >= 1000000) {
      await regulatoryReportingService.registerReportableEvent({
        eventType: 'payment_initiation',
        triggeredBy: 'user_action',
        userId: user.id,
        dealId,
        amount: totalValue,
        currency: 'INR',
        riskIndicators: totalValue >= 5000000 ? ['high_value_transaction'] : [],
        riskScore: totalValue >= 5000000 ? 45 : 25,
        metadata: {
          companyId: deal.companyId,
          orderId: result.orderId,
        },
      });
    }

    return apiResponse.success(res, result, 'Payment initiated successfully');
  } catch (error: any) {
    console.error('Error initiating escrow payment:', error);
    return apiResponse.serverError(res, 'Failed to initiate payment');
  }
});

/**
 * GET /api/unlisted/deals/:dealId/payment-status
 * Get escrow payment status for a deal
 */
router.get('/deals/:dealId/payment-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const user = req.user as any;

    const deal = await storage.getUnlistedDealById(dealId);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }

    if (deal.buyerUserId !== user.id && deal.sellerUserId !== user.id) {
      return apiResponse.forbidden(res, 'Not authorized to view this deal');
    }

    const status = await unlistedEscrowService.getEscrowStatus(dealId);
    return apiResponse.success(res, status);
  } catch (error: any) {
    console.error('Error fetching payment status:', error);
    return apiResponse.serverError(res, 'Failed to fetch payment status');
  }
});

/**
 * GET /api/unlisted/deals/:dealId/fee-breakdown
 * Get fee breakdown for a deal before payment
 */
router.get('/deals/:dealId/fee-breakdown', requireAuth, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const user = req.user as any;

    const deal = await storage.getUnlistedDealById(dealId);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }

    if (deal.buyerUserId !== user.id && deal.sellerUserId !== user.id) {
      return apiResponse.forbidden(res, 'Not authorized to view this deal');
    }

    const totalValue = parseFloat(deal.totalValue);
    const fees = unlistedEscrowService.calculateFees(totalValue);

    return apiResponse.success(res, {
      dealId,
      quantity: deal.quantity,
      pricePerShare: parseFloat(deal.agreedPrice),
      totalValue,
      ...fees
    });
  } catch (error: any) {
    console.error('Error calculating fees:', error);
    return apiResponse.serverError(res, 'Failed to calculate fees');
  }
});

/**
 * POST /api/unlisted/deals/:dealId/mark-transfer-pending
 * Seller marks share transfer as initiated
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */
router.post('/deals/:dealId/mark-transfer-pending', requireAuth, requireLevel2, requireRiskDisclosure('sell'), async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const user = req.user as any;
    const { disSlipId } = req.body;

    const deal = await storage.getUnlistedDealById(dealId);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }

    const result = await unlistedEscrowService.markTransferPending(dealId, user.id, disSlipId);

    if (!result.success) {
      return apiResponse.badRequest(res, result.message);
    }

    // Archive transfer pending event for immutable audit log
    const totalValue = parseFloat(deal.totalValue || '0');
    await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
      eventType: 'transfer_pending',
      userId: user.id,
      dealId,
      companyId: deal.companyId,
      action: 'Seller marked share transfer as pending',
      details: {
        totalValue,
        quantity: deal.quantity,
        disSlipId,
      },
      riskLevel: totalValue >= 5000000 ? 'high' : 'low',
    });

    // Register regulatory event for high-value transfers
    if (totalValue >= 1000000) {
      await regulatoryReportingService.registerReportableEvent({
        eventType: 'transfer_initiated',
        triggeredBy: 'user_action',
        userId: user.id,
        dealId,
        amount: totalValue,
        currency: 'INR',
        riskIndicators: totalValue >= 5000000 ? ['high_value_transaction'] : [],
        riskScore: totalValue >= 5000000 ? 45 : 25,
        metadata: {
          companyId: deal.companyId,
          disSlipId,
        },
      });
    }

    return apiResponse.success(res, result, 'Transfer marked as pending');
  } catch (error: any) {
    console.error('Error marking transfer pending:', error);
    return apiResponse.serverError(res, 'Failed to update transfer status');
  }
});

/**
 * GET /api/unlisted/payment/callback
 * Handle payment gateway callback
 */
router.get('/payment/callback', async (req: Request, res: Response) => {
  try {
    const { order_id, escrow_id, deal_id } = req.query;

    if (!order_id || !escrow_id || !deal_id) {
      return res.redirect('/unlisted/my-orders?payment=error&message=Invalid callback parameters');
    }

    const result = await unlistedEscrowService.handlePaymentCallback(
      order_id as string,
      escrow_id as string,
      deal_id as string
    );

    if (result.success && result.status === 'escrowed') {
      return res.redirect(`/unlisted/my-orders?payment=success&deal=${deal_id}`);
    } else {
      return res.redirect(`/unlisted/my-orders?payment=failed&deal=${deal_id}&status=${result.status}`);
    }
  } catch (error: any) {
    console.error('Payment callback error:', error);
    return res.redirect('/unlisted/my-orders?payment=error');
  }
});

/**
 * POST /api/unlisted/payment/webhook
 * Handle Cashfree webhook for payment status updates
 */
router.post('/payment/webhook', async (req: Request, res: Response) => {
  try {
    const { order_id, order_status, cf_order_id } = req.body?.data || req.body;
    
    console.log('Received Cashfree webhook:', { order_id, order_status, cf_order_id });

    if (order_id && order_id.includes('escrow_')) {
      const parts = order_id.split('_');
      const dealId = parts[1];
      
      if (dealId) {
        await unlistedEscrowService.handlePaymentCallback(
          order_id,
          order_id,
          dealId
        );
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return res.status(200).json({ status: 'ok' });
  }
});

// ===================================================================
// ADMIN ESCROW MANAGEMENT ROUTES
// ===================================================================

/**
 * POST /api/unlisted/admin/deals/:dealId/release-escrow
 * Admin releases escrow after verifying share transfer
 */
router.post('/admin/deals/:dealId/release-escrow', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const adminUser = req.user as any;
    const { transferConfirmationId, notes, disSlipVerified, shareTransferVerified } = req.body;

    // Compliance: Route through maker-checker workflow for dual approval
    // This initiates the approval request - a second admin must approve it
    const result = await escrowMakerCheckerService.initiateApproval({
      dealId,
      makerUserId: adminUser.id,
      makerName: adminUser.name || adminUser.email,
      requestType: 'release',
      notes: notes || 'Escrow release requested',
      transferConfirmationId,
      disSlipVerified: disSlipVerified || false,
      shareTransferVerified: shareTransferVerified || false,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (!result.success) {
      return apiResponse.badRequest(res, result.error || 'Failed to initiate release approval');
    }

    // Compliance: Archive audit log for approval initiation
    try {
      const deal = await storage.getUnlistedDealById(dealId);
      if (deal) {
        await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
          eventType: 'escrow_release_initiated',
          dealId,
          userId: adminUser.id,
          amount: parseFloat((deal as any).totalAmount || '0'),
          metadata: { transferConfirmationId, approvalId: result.approvalId, makerAction: true }
        });
        
        const amount = parseFloat((deal as any).totalAmount || '0');
        if (amount >= 1000000) {
          await regulatoryReportingService.registerReportableEvent({
            eventType: 'high_value_release_initiated',
            dealId,
            amount,
            parties: { buyer: deal.buyerUserId, seller: deal.sellerUserId, maker: adminUser.id }
          });
        }
      }
    } catch (complianceError) {
      console.error('Compliance logging failed for escrow release initiation:', complianceError);
    }

    return apiResponse.success(res, result, 'Release approval initiated. Awaiting second admin approval.');
  } catch (error: any) {
    console.error('Error initiating escrow release:', error);
    return apiResponse.serverError(res, 'Failed to initiate release');
  }
});

/**
 * POST /api/unlisted/admin/deals/:dealId/refund-escrow
 * Admin refunds escrow to buyer (dispute resolution or failed transfer)
 */
router.post('/admin/deals/:dealId/refund-escrow', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const adminUser = req.user as any;
    const { reason, notes } = req.body;

    if (!reason || typeof reason !== 'string') {
      return apiResponse.badRequest(res, 'Refund reason is required');
    }

    // Compliance: Route through maker-checker workflow for dual approval
    // This initiates the approval request - a second admin must approve it
    const result = await escrowMakerCheckerService.initiateApproval({
      dealId,
      makerUserId: adminUser.id,
      makerName: adminUser.name || adminUser.email,
      requestType: 'refund',
      notes: notes || reason,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (!result.success) {
      return apiResponse.badRequest(res, result.error || 'Failed to initiate refund approval');
    }

    // Compliance: Archive audit log for approval initiation
    try {
      const deal = await storage.getUnlistedDealById(dealId);
      if (deal) {
        await auditLogArchivalService.archiveUnlistedMarketplaceEvent({
          eventType: 'escrow_refund_initiated',
          dealId,
          userId: adminUser.id,
          amount: parseFloat((deal as any).totalAmount || '0'),
          metadata: { reason, approvalId: result.approvalId, makerAction: true }
        });
        
        const amount = parseFloat((deal as any).totalAmount || '0');
        if (amount >= 1000000) {
          await regulatoryReportingService.registerReportableEvent({
            eventType: 'high_value_refund_initiated',
            dealId,
            amount,
            parties: { buyer: deal.buyerUserId, seller: deal.sellerUserId, maker: adminUser.id },
            reason
          });
        }
      }
    } catch (complianceError) {
      console.error('Compliance logging failed for escrow refund initiation:', complianceError);
    }

    return apiResponse.success(res, result, 'Refund approval initiated. Awaiting second admin approval.');
  } catch (error: any) {
    console.error('Error initiating escrow refund:', error);
    return apiResponse.serverError(res, 'Failed to initiate refund');
  }
});

/**
 * GET /api/unlisted/admin/deals/pending-escrow
 * Get all deals pending escrow release (admin view)
 */
router.get('/admin/deals/pending-escrow', requireAdmin, async (req: Request, res: Response) => {
  try {
    const deals = await db.select()
      .from(unlistedDeals)
      .where(eq(unlistedDeals.status, 'transfer_pending'));

    return apiResponse.success(res, deals);
  } catch (error: any) {
    console.error('Error fetching pending escrow deals:', error);
    return apiResponse.serverError(res, 'Failed to fetch pending deals');
  }
});

// ===================================================================
// DOCUMENT UPLOAD ROUTES
// ===================================================================

/**
 * POST /api/unlisted/documents/upload
 * Upload document for deal verification (DIS slip, transfer confirmation)
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */
router.post('/documents/upload', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    
    const uploadUrl = await objectStorage.getObjectEntityUploadURL();
    
    return apiResponse.success(res, {
      uploadUrl,
      message: 'Upload URL generated. Use PUT request to upload file.'
    });
  } catch (error: any) {
    console.error('Error generating upload URL:', error);
    return apiResponse.serverError(res, 'Failed to generate upload URL');
  }
});

/**
 * POST /api/unlisted/deals/:dealId/documents
 * Register uploaded document for a deal
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */
router.post('/deals/:dealId/documents', requireAuth, requireLevel2, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const user = req.user as any;
    const { objectPath, documentType, fileName } = req.body;

    const deal = await storage.getUnlistedDealById(dealId);
    if (!deal) {
      return apiResponse.notFound(res, 'Deal not found');
    }

    if (deal.sellerUserId !== user.id && deal.buyerUserId !== user.id) {
      return apiResponse.forbidden(res, 'Not authorized');
    }

    const normalizedPath = await objectStorage.trySetObjectEntityAclPolicy(objectPath, {
      visibility: 'private',
      allowedUsers: [deal.sellerUserId, deal.buyerUserId]
    });

    const document = {
      id: `doc_${Date.now()}`,
      dealId,
      documentType,
      fileName,
      objectPath: normalizedPath,
      uploadedBy: user.id,
      uploadedAt: new Date().toISOString(),
      status: 'pending'
    };

    if (documentType === 'dis_slip' && deal.status === 'escrowed') {
      await unlistedEscrowService.markTransferPending(dealId, user.id, document.id);
    }

    return apiResponse.success(res, { document }, 'Document registered successfully');
  } catch (error: any) {
    console.error('Error registering document:', error);
    return apiResponse.serverError(res, 'Failed to register document');
  }
});

// ===================================================================
// MAKER-CHECKER ESCROW APPROVAL ROUTES (Admin Only)
// ===================================================================

import { escrowMakerCheckerService } from '../services/escrow-maker-checker';

/**
 * POST /api/unlisted/admin/escrow/initiate-approval
 * Maker (Admin 1) initiates an escrow release/refund request
 */
router.post('/admin/escrow/initiate-approval', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { dealId, requestType, notes, verificationDocuments, disSlipVerified, shareTransferVerified, transferConfirmationId } = req.body;

    if (!dealId || !requestType) {
      return apiResponse.badRequest(res, 'dealId and requestType are required');
    }

    if (!['release', 'refund'].includes(requestType)) {
      return apiResponse.badRequest(res, 'requestType must be "release" or "refund"');
    }

    const result = await escrowMakerCheckerService.initiateApproval({
      dealId,
      makerUserId: user.id,
      makerName: user.name || user.email,
      requestType,
      notes,
      verificationDocuments,
      disSlipVerified,
      shareTransferVerified,
      transferConfirmationId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (!result.success) {
      return apiResponse.badRequest(res, result.error || 'Failed to initiate approval');
    }

    return apiResponse.success(res, result, 'Approval request created. Awaiting second admin approval.');
  } catch (error: any) {
    console.error('Error initiating escrow approval:', error);
    return apiResponse.serverError(res, 'Failed to initiate approval');
  }
});

/**
 * POST /api/unlisted/admin/escrow/process-approval
 * Checker (Admin 2) approves or rejects the escrow request
 */
router.post('/admin/escrow/process-approval', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { approvalId, action, notes } = req.body;

    if (!approvalId || !action) {
      return apiResponse.badRequest(res, 'approvalId and action are required');
    }

    if (!['approved', 'rejected', 'requested_info'].includes(action)) {
      return apiResponse.badRequest(res, 'action must be "approved", "rejected", or "requested_info"');
    }

    const result = await escrowMakerCheckerService.processCheckerAction({
      approvalId,
      checkerUserId: user.id,
      checkerName: user.name || user.email,
      action,
      notes,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (!result.success) {
      return apiResponse.badRequest(res, result.error || 'Failed to process approval');
    }

    return apiResponse.success(res, result);
  } catch (error: any) {
    console.error('Error processing escrow approval:', error);
    return apiResponse.serverError(res, 'Failed to process approval');
  }
});

/**
 * GET /api/unlisted/admin/escrow/pending-approvals
 * Get pending approval requests for checker dashboard (excludes own requests)
 */
router.get('/admin/escrow/pending-approvals', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const approvals = await escrowMakerCheckerService.getPendingApprovals(user.id);
    return apiResponse.success(res, approvals);
  } catch (error: any) {
    console.error('Error fetching pending approvals:', error);
    return apiResponse.serverError(res, 'Failed to fetch pending approvals');
  }
});

/**
 * GET /api/unlisted/admin/escrow/deal/:dealId/history
 * Get approval history for a specific deal
 */
router.get('/admin/escrow/deal/:dealId/history', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const history = await escrowMakerCheckerService.getDealApprovalHistory(dealId);
    return apiResponse.success(res, history);
  } catch (error: any) {
    console.error('Error fetching deal approval history:', error);
    return apiResponse.serverError(res, 'Failed to fetch approval history');
  }
});

// ===================================================================
// SEBI/RBI REGULATORY REPORTING ROUTES (Admin Only)
// ===================================================================

import { regulatoryReportingService } from '../services/regulatory-reporting-service';
import { marketingService } from "../marketing-automation";
import { objectStorageClient as objectStorage } from "../objectStorage";
import { whatsappService } from "../whatsapp";
import { portfolioIntelligence } from "../portfolio-intelligence";
import { generateMarketInsight, analyzePortfolio, generateInvestmentStory, explainFinancialConcept } from "../gemini-service";

/**
 * GET /api/unlisted/admin/regulatory/reports
 * Get all regulatory reports with optional filters
 */

export default router;
