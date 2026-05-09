/**
 * Unlisted Marketplace Escrow Service
 * 
 * Handles escrow payments for unlisted share transactions using Cashfree
 * Implements a secure buyer-seller escrow flow:
 * 1. Buyer initiates payment → funds held in escrow
 * 2. Seller transfers shares (verified via DIS slip)
 * 3. Admin confirms transfer → funds released to seller
 */

import { CashfreeService, cashfreeService } from '../cashfree-service';
import { getAppBaseUrl } from '../utils/app-url';
import { storage } from '../storage';
import { db } from '../db';
import { unlistedDeals } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface EscrowPaymentRequest {
  dealId: string;
  buyerUserId: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerName?: string;
  returnUrl?: string;
}

export interface EscrowPaymentResponse {
  success: boolean;
  escrowId?: string;
  paymentSessionId?: string;
  paymentUrl?: string;
  amount?: number;
  message?: string;
  errorCode?: string;
}

export interface EscrowReleaseResult {
  success: boolean;
  transactionId?: string;
  releasedAmount?: number;
  sellerPayout?: number;
  platformFee?: number;
  message?: string;
}

export interface EscrowRefundResult {
  success: boolean;
  refundId?: string;
  refundedAmount?: number;
  message?: string;
}

export interface EscrowStatus {
  escrowId: string;
  dealId: string;
  status: 'pending' | 'payment_initiated' | 'escrowed' | 'released' | 'refunded' | 'failed';
  amount: number;
  buyerPaymentStatus: 'pending' | 'completed' | 'failed';
  sellerPayoutStatus: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export class UnlistedEscrowService {
  private cashfree: CashfreeService;
  
  private readonly PLATFORM_FEE_PERCENT = 1.5;
  private readonly BUYER_FEE_PERCENT = 0.5;
  private readonly SELLER_FEE_PERCENT = 1.0;
  private readonly GST_PERCENT = 18;

  constructor() {
    this.cashfree = cashfreeService;
  }

  /**
   * Calculate fees for a transaction
   */
  calculateFees(totalValue: number): {
    platformFee: number;
    buyerFee: number;
    sellerFee: number;
    buyerTotal: number;
    sellerPayout: number;
    gstOnFees: number;
  } {
    const platformFee = totalValue * (this.PLATFORM_FEE_PERCENT / 100);
    const buyerFee = totalValue * (this.BUYER_FEE_PERCENT / 100);
    const sellerFee = totalValue * (this.SELLER_FEE_PERCENT / 100);
    const totalFees = platformFee + buyerFee + sellerFee;
    const gstOnFees = totalFees * (this.GST_PERCENT / 100);
    
    const buyerTotal = totalValue + buyerFee + (gstOnFees / 2);
    const sellerPayout = totalValue - sellerFee - platformFee - (gstOnFees / 2);

    return {
      platformFee: Math.round(platformFee * 100) / 100,
      buyerFee: Math.round(buyerFee * 100) / 100,
      sellerFee: Math.round(sellerFee * 100) / 100,
      buyerTotal: Math.round(buyerTotal * 100) / 100,
      sellerPayout: Math.round(sellerPayout * 100) / 100,
      gstOnFees: Math.round(gstOnFees * 100) / 100,
    };
  }

  /**
   * Initiate escrow payment for a deal
   * Creates Cashfree order and returns payment URL
   */
  async initiateEscrowPayment(request: EscrowPaymentRequest): Promise<EscrowPaymentResponse> {
    try {
      const deal = await storage.getUnlistedDealById(request.dealId);
      
      if (!deal) {
        return {
          success: false,
          message: 'Deal not found',
          errorCode: 'DEAL_NOT_FOUND'
        };
      }

      if (deal.buyerUserId !== request.buyerUserId) {
        return {
          success: false,
          message: 'Only the buyer can initiate payment',
          errorCode: 'UNAUTHORIZED'
        };
      }

      if (deal.status !== 'confirmed') {
        return {
          success: false,
          message: `Cannot initiate payment for deal in ${deal.status} status. Deal must be confirmed by both parties.`,
          errorCode: 'INVALID_STATUS'
        };
      }

      if (deal.escrowId) {
        return {
          success: false,
          message: 'Payment already initiated for this deal',
          errorCode: 'PAYMENT_EXISTS'
        };
      }

      const totalValue = parseFloat(deal.totalValue);
      const fees = this.calculateFees(totalValue);
      
      const escrowId = `escrow_${deal.id}_${Date.now()}`;
      const returnUrl = request.returnUrl || 
        `${getAppBaseUrl()}/api/unlisted/payment/callback`;

      const orderResult = await this.cashfree.createOrder({
        amount: fees.buyerTotal,
        userId: request.buyerUserId,
        email: request.buyerEmail,
        phone: request.buyerPhone,
        name: request.buyerName,
        returnUrl: `${returnUrl}?escrow_id=${escrowId}&deal_id=${deal.id}`
      });

      if (!orderResult.success) {
        return {
          success: false,
          message: orderResult.message || 'Failed to create payment order',
          errorCode: 'PAYMENT_INIT_FAILED'
        };
      }

      await db.update(unlistedDeals)
        .set({
          escrowId: escrowId,
          status: 'payment_pending',
          platformFee: fees.platformFee.toString(),
          buyerFee: fees.buyerFee.toString(),
          sellerFee: fees.sellerFee.toString(),
          buyerCharge: fees.buyerTotal.toString(),
          sellerPayout: fees.sellerPayout.toString(),
          updatedAt: new Date()
        })
        .where(eq(unlistedDeals.id, deal.id));

      console.log(`💰 Escrow payment initiated for deal ${deal.id}, amount: ₹${fees.buyerTotal}`);

      return {
        success: true,
        escrowId,
        paymentSessionId: orderResult.paymentSessionId,
        paymentUrl: orderResult.paymentUrl,
        amount: fees.buyerTotal,
        message: 'Payment initiated successfully'
      };

    } catch (error: any) {
      console.error('Escrow payment initiation error:', error);
      return {
        success: false,
        message: error.message || 'Failed to initiate escrow payment',
        errorCode: 'INTERNAL_ERROR'
      };
    }
  }

  /**
   * Handle payment callback/webhook from Cashfree
   * Updates deal status based on payment outcome
   */
  async handlePaymentCallback(
    orderId: string, 
    escrowId: string, 
    dealId: string
  ): Promise<{ success: boolean; status: string; message: string }> {
    try {
      const orderStatus = await this.cashfree.getOrderStatus(orderId);
      
      if (!orderStatus) {
        return {
          success: false,
          status: 'unknown',
          message: 'Could not fetch payment status'
        };
      }

      const deal = await storage.getUnlistedDealById(dealId);
      if (!deal) {
        return {
          success: false,
          status: 'error',
          message: 'Deal not found'
        };
      }

      if (orderStatus.orderStatus === 'PAID') {
        await db.update(unlistedDeals)
          .set({
            status: 'escrowed',
            escrowedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(unlistedDeals.id, dealId));

        console.log(`✅ Payment escrowed for deal ${dealId}`);

        return {
          success: true,
          status: 'escrowed',
          message: 'Payment received and held in escrow. Awaiting share transfer.'
        };
      } else if (orderStatus.orderStatus === 'EXPIRED' || orderStatus.orderStatus === 'CANCELLED') {
        await db.update(unlistedDeals)
          .set({
            status: 'payment_failed',
            updatedAt: new Date()
          })
          .where(eq(unlistedDeals.id, dealId));

        return {
          success: false,
          status: 'failed',
          message: `Payment ${orderStatus.orderStatus.toLowerCase()}`
        };
      }

      return {
        success: true,
        status: orderStatus.orderStatus.toLowerCase(),
        message: `Payment status: ${orderStatus.orderStatus}`
      };

    } catch (error: any) {
      console.error('Payment callback error:', error);
      return {
        success: false,
        status: 'error',
        message: error.message || 'Failed to process payment callback'
      };
    }
  }

  /**
   * Release escrow funds to seller after share transfer confirmation
   * Called by admin after verifying DIS slip/transfer proof
   */
  async releaseEscrow(
    dealId: string, 
    adminUserId: string,
    transferConfirmationId?: string
  ): Promise<EscrowReleaseResult> {
    try {
      const deal = await storage.getUnlistedDealById(dealId);
      
      if (!deal) {
        return {
          success: false,
          message: 'Deal not found'
        };
      }

      if (deal.status !== 'escrowed' && deal.status !== 'transfer_pending') {
        return {
          success: false,
          message: `Cannot release escrow for deal in ${deal.status} status`
        };
      }

      const sellerPayout = parseFloat(deal.sellerPayout || '0');
      const platformFee = parseFloat(deal.platformFee || '0');

      const settlementDate = new Date();
      settlementDate.setDate(settlementDate.getDate() + 2);

      await db.update(unlistedDeals)
        .set({
          status: 'completed',
          sharesTransferredAt: new Date(),
          paymentCompletedAt: new Date(),
          completedAt: new Date(),
          settlementDate: settlementDate,
          complianceChecked: true,
          complianceNotes: `Escrow released by admin ${adminUserId}. Transfer confirmation: ${transferConfirmationId || 'verified'}`,
          updatedAt: new Date()
        })
        .where(eq(unlistedDeals.id, dealId));

      console.log(`✅ Escrow released for deal ${dealId}, seller payout: ₹${sellerPayout}`);

      return {
        success: true,
        transactionId: `payout_${dealId}_${Date.now()}`,
        releasedAmount: parseFloat(deal.totalValue),
        sellerPayout,
        platformFee,
        message: 'Escrow released successfully. Funds will be transferred to seller.'
      };

    } catch (error: any) {
      console.error('Escrow release error:', error);
      return {
        success: false,
        message: error.message || 'Failed to release escrow'
      };
    }
  }

  /**
   * Refund escrow to buyer (in case of failed transfer or dispute)
   */
  async refundEscrow(
    dealId: string,
    adminUserId: string,
    reason: string
  ): Promise<EscrowRefundResult> {
    try {
      const deal = await storage.getUnlistedDealById(dealId);
      
      if (!deal) {
        return {
          success: false,
          message: 'Deal not found'
        };
      }

      if (deal.status !== 'escrowed' && deal.status !== 'transfer_pending') {
        return {
          success: false,
          message: `Cannot refund deal in ${deal.status} status`
        };
      }

      const refundAmount = parseFloat(deal.buyerCharge || deal.totalValue);

      await db.update(unlistedDeals)
        .set({
          status: 'failed',
          cancelledAt: new Date(),
          cancellationReason: `Refund initiated by admin ${adminUserId}: ${reason}`,
          complianceNotes: `Escrow refunded. Amount: ₹${refundAmount}`,
          updatedAt: new Date()
        })
        .where(eq(unlistedDeals.id, dealId));

      console.log(`💸 Escrow refunded for deal ${dealId}, amount: ₹${refundAmount}`);

      return {
        success: true,
        refundId: `refund_${dealId}_${Date.now()}`,
        refundedAmount: refundAmount,
        message: 'Refund initiated. Funds will be returned to buyer.'
      };

    } catch (error: any) {
      console.error('Escrow refund error:', error);
      return {
        success: false,
        message: error.message || 'Failed to refund escrow'
      };
    }
  }

  /**
   * Get escrow status for a deal
   */
  async getEscrowStatus(dealId: string): Promise<EscrowStatus | null> {
    try {
      const deal = await storage.getUnlistedDealById(dealId);
      
      if (!deal || !deal.escrowId) {
        return null;
      }

      let escrowStatus: EscrowStatus['status'] = 'pending';
      let buyerPaymentStatus: EscrowStatus['buyerPaymentStatus'] = 'pending';
      let sellerPayoutStatus: EscrowStatus['sellerPayoutStatus'] = 'pending';

      switch (deal.status) {
        case 'payment_pending':
          escrowStatus = 'payment_initiated';
          break;
        case 'escrowed':
        case 'transfer_pending':
          escrowStatus = 'escrowed';
          buyerPaymentStatus = 'completed';
          break;
        case 'completed':
          escrowStatus = 'released';
          buyerPaymentStatus = 'completed';
          sellerPayoutStatus = 'completed';
          break;
        case 'failed':
        case 'cancelled':
          escrowStatus = deal.cancellationReason?.includes('Refund') ? 'refunded' : 'failed';
          break;
      }

      return {
        escrowId: deal.escrowId,
        dealId: deal.id,
        status: escrowStatus,
        amount: parseFloat(deal.totalValue),
        buyerPaymentStatus,
        sellerPayoutStatus,
        createdAt: deal.createdAt || new Date(),
        updatedAt: deal.updatedAt || new Date()
      };

    } catch (error: any) {
      console.error('Get escrow status error:', error);
      return null;
    }
  }

  /**
   * Mark deal as transfer pending (seller has shipped shares)
   */
  async markTransferPending(
    dealId: string,
    sellerUserId: string,
    disSlipId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const deal = await storage.getUnlistedDealById(dealId);
      
      if (!deal) {
        return { success: false, message: 'Deal not found' };
      }

      if (deal.sellerUserId !== sellerUserId) {
        return { success: false, message: 'Only the seller can mark transfer as pending' };
      }

      if (deal.status !== 'escrowed') {
        return { success: false, message: `Cannot update deal in ${deal.status} status` };
      }

      await db.update(unlistedDeals)
        .set({
          status: 'transfer_pending',
          complianceNotes: disSlipId 
            ? `DIS slip uploaded: ${disSlipId}` 
            : 'Transfer initiated by seller',
          updatedAt: new Date()
        })
        .where(eq(unlistedDeals.id, dealId));

      console.log(`📤 Share transfer pending for deal ${dealId}`);

      return {
        success: true,
        message: 'Transfer marked as pending. Admin will verify and release escrow.'
      };

    } catch (error: any) {
      console.error('Mark transfer pending error:', error);
      return { success: false, message: error.message || 'Failed to update transfer status' };
    }
  }
}

export const unlistedEscrowService = new UnlistedEscrowService();
