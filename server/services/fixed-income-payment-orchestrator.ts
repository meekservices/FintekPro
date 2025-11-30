import { db } from '../db';
import { 
  bondOrders,
  fixedIncomeOrderPayments,
  fixedIncomeSettlements,
  fixedIncomeAuditLog,
  users
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

const SEVEN_YEARS_MS = 7 * 365 * 24 * 60 * 60 * 1000;

interface PaymentInitiationRequest {
  orderId: string;
  userId: string;
  amount: number;
  paymentMethod: 'upi' | 'netbanking' | 'neft' | 'rtgs' | 'asba';
  returnUrl?: string;
  notifyUrl?: string;
}

interface PaymentResult {
  success: boolean;
  paymentId?: string;
  gatewayOrderId?: string;
  paymentUrl?: string;
  status: string;
  message: string;
}

interface PaymentCallbackData {
  gatewayOrderId: string;
  gatewayPaymentId?: string;
  gatewayTransactionId?: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'CANCELLED';
  amount: number;
  currency: string;
  payerVpa?: string;
  payerBankName?: string;
  signature: string;
  rawResponse: Record<string, any>;
}

interface SettlementInitiationResult {
  success: boolean;
  settlementId?: string;
  expectedSettlementDate?: string;
  message: string;
}

class FixedIncomePaymentOrchestrator {
  private readonly CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
  private readonly CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
  private readonly CASHFREE_API_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api.cashfree.com/pg' 
    : 'https://sandbox.cashfree.com/pg';

  async initiatePayment(request: PaymentInitiationRequest): Promise<PaymentResult> {
    try {
      const order = await db.select()
        .from(bondOrders)
        .where(eq(bondOrders.id, request.orderId))
        .limit(1);

      if (!order[0]) {
        return { success: false, status: 'error', message: 'Order not found' };
      }

      const bondOrder = order[0];
      if (bondOrder.paymentStatus === 'paid') {
        return { success: false, status: 'already_paid', message: 'Order is already paid' };
      }

      const user = await db.select()
        .from(users)
        .where(eq(users.id, request.userId))
        .limit(1);

      if (!user[0]) {
        return { success: false, status: 'error', message: 'User not found' };
      }

      const gatewayOrderId = `FI_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      
      const convenienceFee = this.calculateConvenienceFee(request.amount, request.paymentMethod);
      const gstOnFee = convenienceFee * 0.18;
      const totalAmount = request.amount + convenienceFee + gstOnFee;

      const [payment] = await db.insert(fixedIncomeOrderPayments).values({
        orderId: request.orderId,
        userId: request.userId,
        paymentType: 'full_payment',
        paymentMethod: request.paymentMethod,
        orderAmount: request.amount.toString(),
        paymentAmount: request.amount.toString(),
        convenienceFee: convenienceFee.toString(),
        gstOnFee: gstOnFee.toString(),
        totalAmount: totalAmount.toString(),
        paymentGateway: 'cashfree',
        gatewayOrderId,
        paymentStatus: 'initiated',
        paymentInitiatedAt: new Date(),
        paymentLinkExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }).returning();

      const paymentSessionResponse = await this.createCashfreeOrder({
        orderId: gatewayOrderId,
        amount: totalAmount,
        currency: 'INR',
        customerEmail: user[0].email || '',
        customerPhone: user[0].mobile || '',
        customerName: `${user[0].firstName || ''} ${user[0].lastName || ''}`.trim() || 'Customer',
        returnUrl: request.returnUrl || `${process.env.BASE_URL || ''}/api/fixed-income/payment/callback`,
        notifyUrl: request.notifyUrl || `${process.env.BASE_URL || ''}/api/fixed-income/payment/webhook`,
      });

      if (!paymentSessionResponse.success) {
        await db.update(fixedIncomeOrderPayments)
          .set({
            paymentStatus: 'failed',
            errorCode: 'GATEWAY_ERROR',
            errorMessage: paymentSessionResponse.message,
            updatedAt: new Date()
          })
          .where(eq(fixedIncomeOrderPayments.id, payment.id));

        return {
          success: false,
          status: 'gateway_error',
          message: paymentSessionResponse.message || 'Failed to create payment session'
        };
      }

      await db.update(fixedIncomeOrderPayments)
        .set({
          paymentLinkUrl: paymentSessionResponse.paymentUrl,
          paymentStatus: 'pending',
          updatedAt: new Date()
        })
        .where(eq(fixedIncomeOrderPayments.id, payment.id));

      await db.update(bondOrders)
        .set({
          paymentStatus: 'pending',
          paymentMethod: request.paymentMethod,
          lastUpdated: new Date()
        })
        .where(eq(bondOrders.id, request.orderId));

      await this.logAuditEvent(request.userId, 'payment_initiated', 'payment', {
        orderId: request.orderId,
        paymentId: payment.id,
        gatewayOrderId,
        amount: totalAmount,
        paymentMethod: request.paymentMethod
      });

      return {
        success: true,
        paymentId: payment.id,
        gatewayOrderId,
        paymentUrl: paymentSessionResponse.paymentUrl,
        status: 'pending',
        message: 'Payment initiated successfully'
      };
    } catch (error) {
      console.error('Error initiating payment:', error);
      return {
        success: false,
        status: 'error',
        message: 'Failed to initiate payment'
      };
    }
  }

  async handlePaymentCallback(callbackData: PaymentCallbackData): Promise<{ success: boolean; orderId?: string }> {
    try {
      // 1. Verify signature (skip in dev if no credentials)
      const isValid = this.verifyPaymentSignature(callbackData);
      if (!isValid) {
        await this.logAuditEvent('system', 'payment_callback_signature_invalid', 'security', {
          gatewayOrderId: callbackData.gatewayOrderId,
          rawPayload: callbackData.rawResponse,
          timestamp: new Date().toISOString()
        });
        console.error('Invalid payment signature');
        return { success: false };
      }

      const payment = await db.select()
        .from(fixedIncomeOrderPayments)
        .where(eq(fixedIncomeOrderPayments.gatewayOrderId, callbackData.gatewayOrderId))
        .limit(1);

      if (!payment[0]) {
        await this.logAuditEvent('system', 'payment_callback_not_found', 'payment', {
          gatewayOrderId: callbackData.gatewayOrderId,
          rawPayload: callbackData.rawResponse
        });
        console.error('Payment record not found:', callbackData.gatewayOrderId);
        return { success: false };
      }

      const paymentRecord = payment[0];

      // 2. Idempotency check - skip if already processed
      if (paymentRecord.paymentStatus === 'completed' || paymentRecord.paymentStatus === 'failed') {
        await this.logAuditEvent(paymentRecord.userId, 'payment_callback_duplicate', 'payment', {
          orderId: paymentRecord.orderId,
          paymentId: paymentRecord.id,
          existingStatus: paymentRecord.paymentStatus,
          incomingStatus: callbackData.status,
          rawPayload: callbackData.rawResponse
        });
        console.log('Payment already processed, skipping:', callbackData.gatewayOrderId);
        return { success: true, orderId: paymentRecord.orderId };
      }

      // 3. Amount and currency validation
      const expectedAmount = parseFloat(paymentRecord.totalAmount);
      const amountTolerance = 0.01; // Allow 1 paisa difference due to rounding
      if (Math.abs(callbackData.amount - expectedAmount) > amountTolerance) {
        await this.logAuditEvent(paymentRecord.userId, 'payment_amount_mismatch', 'security', {
          orderId: paymentRecord.orderId,
          paymentId: paymentRecord.id,
          expectedAmount,
          receivedAmount: callbackData.amount,
          rawPayload: callbackData.rawResponse
        });
        console.error('Amount mismatch:', { expected: expectedAmount, received: callbackData.amount });
        return { success: false };
      }

      if (callbackData.currency !== 'INR') {
        await this.logAuditEvent(paymentRecord.userId, 'payment_currency_mismatch', 'security', {
          orderId: paymentRecord.orderId,
          expectedCurrency: 'INR',
          receivedCurrency: callbackData.currency,
          rawPayload: callbackData.rawResponse
        });
        console.error('Currency mismatch:', callbackData.currency);
        return { success: false };
      }

      let newPaymentStatus: string;
      let newOrderStatus: string;

      switch (callbackData.status) {
        case 'SUCCESS':
          newPaymentStatus = 'completed';
          newOrderStatus = 'confirmed';
          break;
        case 'FAILED':
          newPaymentStatus = 'failed';
          newOrderStatus = 'payment_failed';
          break;
        case 'CANCELLED':
          newPaymentStatus = 'cancelled';
          newOrderStatus = 'cancelled';
          break;
        default:
          newPaymentStatus = 'pending';
          newOrderStatus = 'pending';
      }

      await db.update(fixedIncomeOrderPayments)
        .set({
          gatewayPaymentId: callbackData.gatewayPaymentId,
          gatewayTransactionId: callbackData.gatewayTransactionId,
          paymentStatus: newPaymentStatus,
          paymentCompletedAt: callbackData.status === 'SUCCESS' ? new Date() : null,
          payerVpa: callbackData.payerVpa,
          payerBankName: callbackData.payerBankName,
          gatewayResponse: callbackData.rawResponse,
          callbackReceivedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(fixedIncomeOrderPayments.id, paymentRecord.id));

      await db.update(bondOrders)
        .set({
          paymentStatus: callbackData.status === 'SUCCESS' ? 'paid' : newPaymentStatus,
          orderStatus: newOrderStatus,
          lastUpdated: new Date()
        })
        .where(eq(bondOrders.id, paymentRecord.orderId));

      // 4. Store FULL raw payload for 7-year audit compliance
      await this.logAuditEvent(paymentRecord.userId, 'payment_callback_received', 'payment', {
        orderId: paymentRecord.orderId,
        paymentId: paymentRecord.id,
        gatewayOrderId: callbackData.gatewayOrderId,
        gatewayPaymentId: callbackData.gatewayPaymentId,
        gatewayTransactionId: callbackData.gatewayTransactionId,
        status: callbackData.status,
        amount: callbackData.amount,
        currency: callbackData.currency,
        payerVpa: callbackData.payerVpa,
        payerBankName: callbackData.payerBankName,
        convenienceFee: paymentRecord.convenienceFee,
        gstOnFee: paymentRecord.gstOnFee,
        rawPayload: callbackData.rawResponse,
        processedAt: new Date().toISOString()
      });

      if (callbackData.status === 'SUCCESS') {
        await this.initiateSettlement(paymentRecord.orderId, paymentRecord.userId);
      }

      return { success: true, orderId: paymentRecord.orderId };
    } catch (error) {
      console.error('Error handling payment callback:', error);
      return { success: false };
    }
  }

  async initiateSettlement(orderId: string, userId: string): Promise<SettlementInitiationResult> {
    try {
      // Fetch both order and payment for reconciliation
      const [order, payment] = await Promise.all([
        db.select().from(bondOrders).where(eq(bondOrders.id, orderId)).limit(1),
        db.select().from(fixedIncomeOrderPayments)
          .where(and(eq(fixedIncomeOrderPayments.orderId, orderId), eq(fixedIncomeOrderPayments.paymentStatus, 'completed')))
          .orderBy(desc(fixedIncomeOrderPayments.createdAt))
          .limit(1)
      ]);

      if (!order[0]) {
        return { success: false, message: 'Order not found' };
      }

      if (!payment[0]) {
        await this.logAuditEvent(userId, 'settlement_blocked_no_payment', 'trading', {
          orderId,
          reason: 'No completed payment found'
        });
        return { success: false, message: 'No completed payment found for this order' };
      }

      const bondOrder = order[0];
      const paymentRecord = payment[0];

      // Validate order has required fields for settlement
      if (!bondOrder.netAmount || bondOrder.netAmount === '0') {
        await this.logAuditEvent(userId, 'settlement_blocked_invalid_amount', 'trading', {
          orderId,
          netAmount: bondOrder.netAmount,
          reason: 'Order has no valid net amount'
        });
        return { success: false, message: 'Order has invalid net amount for settlement' };
      }

      // Reconcile payment amount with order amount
      const orderAmount = parseFloat(bondOrder.netAmount);
      const paidAmount = parseFloat(paymentRecord.orderAmount);
      const tolerance = 0.01;

      if (Math.abs(orderAmount - paidAmount) > tolerance) {
        await this.logAuditEvent(userId, 'settlement_amount_mismatch', 'trading', {
          orderId,
          orderAmount,
          paidAmount,
          difference: Math.abs(orderAmount - paidAmount)
        });
        return { success: false, message: 'Payment amount does not match order amount' };
      }
      
      const tradeDate = new Date();
      const settlementDays = 1;
      const expectedSettlementDate = new Date(tradeDate);
      expectedSettlementDate.setDate(expectedSettlementDate.getDate() + settlementDays);

      const [settlement] = await db.insert(fixedIncomeSettlements).values({
        orderId,
        userId,
        settlementType: 'regular',
        settlementCycle: 'T+1',
        isin: bondOrder.isin,
        securityName: bondOrder.bondName,
        quantity: bondOrder.quantity,
        settlementValue: bondOrder.netAmount,
        tradeDate: tradeDate.toISOString().split('T')[0],
        expectedSettlementDate: expectedSettlementDate.toISOString().split('T')[0],
        depository: 'nsdl',
        dpId: bondOrder.dematAccountNumber?.substring(0, 8) || 'IN300000',
        clientId: bondOrder.dematAccountNumber?.substring(8) || '00000000',
        dematAccountNumber: bondOrder.dematAccountNumber || '',
        settlementStatus: 'pending',
        statusHistory: [{
          status: 'pending',
          timestamp: new Date().toISOString(),
          remarks: 'Settlement initiated after payment confirmation',
          paymentId: paymentRecord.id,
          reconciledAmount: paidAmount
        }]
      }).returning();

      await db.update(bondOrders)
        .set({
          orderStatus: 'processing',
          settlementDate: expectedSettlementDate.toISOString().split('T')[0],
          lastUpdated: new Date()
        })
        .where(eq(bondOrders.id, orderId));

      await this.logAuditEvent(userId, 'settlement_initiated', 'trading', {
        orderId,
        settlementId: settlement.id,
        paymentId: paymentRecord.id,
        orderAmount,
        paidAmount,
        settlementValue: bondOrder.netAmount,
        expectedSettlementDate: expectedSettlementDate.toISOString().split('T')[0],
        settlementCycle: 'T+1',
        isin: bondOrder.isin,
        quantity: bondOrder.quantity
      });

      return {
        success: true,
        settlementId: settlement.id,
        expectedSettlementDate: expectedSettlementDate.toISOString().split('T')[0],
        message: 'Settlement initiated successfully'
      };
    } catch (error) {
      console.error('Error initiating settlement:', error);
      return { success: false, message: 'Failed to initiate settlement' };
    }
  }

  async processSettlement(settlementId: string): Promise<{ success: boolean; message: string }> {
    try {
      const settlement = await db.select()
        .from(fixedIncomeSettlements)
        .where(eq(fixedIncomeSettlements.id, settlementId))
        .limit(1);

      if (!settlement[0]) {
        return { success: false, message: 'Settlement not found' };
      }

      const settlementRecord = settlement[0];
      const currentHistory = (settlementRecord.statusHistory as any[]) || [];

      await db.update(fixedIncomeSettlements)
        .set({
          settlementStatus: 'credited',
          actualSettlementDate: new Date().toISOString().split('T')[0],
          depositoryTransactionId: `NSDL_${Date.now()}`,
          payoutStatus: 'completed',
          statusHistory: [
            ...currentHistory,
            {
              status: 'credited',
              timestamp: new Date().toISOString(),
              remarks: 'Securities credited to demat account'
            }
          ],
          updatedAt: new Date()
        })
        .where(eq(fixedIncomeSettlements.id, settlementId));

      await db.update(bondOrders)
        .set({
          orderStatus: 'executed',
          executionDate: new Date(),
          lastUpdated: new Date()
        })
        .where(eq(bondOrders.id, settlementRecord.orderId));

      await this.logAuditEvent(settlementRecord.userId, 'settlement_completed', 'trading', {
        orderId: settlementRecord.orderId,
        settlementId,
        isin: settlementRecord.isin,
        quantity: settlementRecord.quantity
      });

      return { success: true, message: 'Settlement processed successfully' };
    } catch (error) {
      console.error('Error processing settlement:', error);
      return { success: false, message: 'Failed to process settlement' };
    }
  }

  async initiateRefund(
    paymentId: string, 
    reason: string,
    amount?: number
  ): Promise<{ success: boolean; refundId?: string; message: string }> {
    try {
      const payment = await db.select()
        .from(fixedIncomeOrderPayments)
        .where(eq(fixedIncomeOrderPayments.id, paymentId))
        .limit(1);

      if (!payment[0]) {
        return { success: false, message: 'Payment not found' };
      }

      const paymentRecord = payment[0];
      if (paymentRecord.paymentStatus !== 'completed') {
        return { success: false, message: 'Only completed payments can be refunded' };
      }

      if (paymentRecord.refundStatus === 'completed' || paymentRecord.refundStatus === 'processing') {
        return { success: false, message: 'Refund already in progress or completed' };
      }

      const totalPaid = parseFloat(paymentRecord.totalAmount);
      const refundAmount = amount || totalPaid;
      
      if (refundAmount > totalPaid) {
        return { success: false, message: 'Refund amount cannot exceed paid amount' };
      }

      const refundReference = `REF_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      // Mark refund as initiated
      await db.update(fixedIncomeOrderPayments)
        .set({
          refundStatus: 'initiated',
          refundAmount: refundAmount.toString(),
          refundReason: reason,
          refundReference,
          updatedAt: new Date()
        })
        .where(eq(fixedIncomeOrderPayments.id, paymentId));

      // Call Cashfree Refund API
      const gatewayResult = await this.processCashfreeRefund({
        orderId: paymentRecord.gatewayOrderId!,
        refundId: refundReference,
        refundAmount,
        refundReason: reason
      });

      if (gatewayResult.success) {
        // Update status to processing (waiting for webhook confirmation)
        await db.update(fixedIncomeOrderPayments)
          .set({
            refundStatus: 'processing',
            updatedAt: new Date()
          })
          .where(eq(fixedIncomeOrderPayments.id, paymentId));

        await db.update(bondOrders)
          .set({
            orderStatus: 'refund_initiated',
            lastUpdated: new Date()
          })
          .where(eq(bondOrders.id, paymentRecord.orderId));

        await this.logAuditEvent(paymentRecord.userId, 'refund_initiated', 'payment', {
          paymentId,
          orderId: paymentRecord.orderId,
          gatewayOrderId: paymentRecord.gatewayOrderId,
          refundAmount,
          totalPaid,
          isPartialRefund: refundAmount < totalPaid,
          reason,
          refundReference,
          gatewayResponse: gatewayResult.data
        });

        return {
          success: true,
          refundId: refundReference,
          message: 'Refund initiated successfully, awaiting gateway confirmation'
        };
      } else {
        // Revert status on failure
        await db.update(fixedIncomeOrderPayments)
          .set({
            refundStatus: 'failed',
            updatedAt: new Date()
          })
          .where(eq(fixedIncomeOrderPayments.id, paymentId));

        await this.logAuditEvent(paymentRecord.userId, 'refund_gateway_failed', 'payment', {
          paymentId,
          orderId: paymentRecord.orderId,
          refundAmount,
          reason,
          refundReference,
          gatewayError: gatewayResult.message
        });

        return { success: false, message: gatewayResult.message || 'Gateway refund failed' };
      }
    } catch (error) {
      console.error('Error initiating refund:', error);
      return { success: false, message: 'Failed to initiate refund' };
    }
  }

  private async processCashfreeRefund(params: {
    orderId: string;
    refundId: string;
    refundAmount: number;
    refundReason: string;
  }): Promise<{ success: boolean; data?: any; message?: string }> {
    if (!this.CASHFREE_APP_ID || !this.CASHFREE_SECRET_KEY) {
      console.log('Cashfree credentials not configured, simulating refund');
      return {
        success: true,
        data: { 
          mock: true, 
          refund_id: params.refundId,
          status: 'SUCCESS',
          processed_at: new Date().toISOString()
        }
      };
    }

    try {
      const response = await fetch(`${this.CASHFREE_API_URL}/orders/${params.orderId}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.CASHFREE_APP_ID,
          'x-client-secret': this.CASHFREE_SECRET_KEY,
          'x-api-version': '2023-08-01'
        },
        body: JSON.stringify({
          refund_id: params.refundId,
          refund_amount: params.refundAmount,
          refund_note: params.refundReason
        })
      });

      const data = await response.json();

      if (response.ok && data.refund_status) {
        return {
          success: true,
          data
        };
      }

      return {
        success: false,
        message: data.message || 'Refund request failed',
        data
      };
    } catch (error) {
      console.error('Cashfree refund API error:', error);
      return {
        success: false,
        message: 'Failed to connect to payment gateway for refund'
      };
    }
  }

  async getPaymentStatus(orderId: string): Promise<{
    found: boolean;
    payment?: {
      id: string;
      status: string;
      amount: number;
      paymentMethod: string;
      gatewayOrderId?: string;
      paymentUrl?: string;
      completedAt?: Date;
    };
  }> {
    const payment = await db.select()
      .from(fixedIncomeOrderPayments)
      .where(eq(fixedIncomeOrderPayments.orderId, orderId))
      .orderBy(desc(fixedIncomeOrderPayments.createdAt))
      .limit(1);

    if (!payment[0]) {
      return { found: false };
    }

    return {
      found: true,
      payment: {
        id: payment[0].id,
        status: payment[0].paymentStatus || 'unknown',
        amount: parseFloat(payment[0].totalAmount),
        paymentMethod: payment[0].paymentMethod,
        gatewayOrderId: payment[0].gatewayOrderId || undefined,
        paymentUrl: payment[0].paymentLinkUrl || undefined,
        completedAt: payment[0].paymentCompletedAt || undefined
      }
    };
  }

  async getSettlementStatus(orderId: string): Promise<{
    found: boolean;
    settlement?: {
      id: string;
      status: string;
      tradeDate: string;
      expectedDate: string;
      actualDate?: string;
      depository: string;
    };
  }> {
    const settlement = await db.select()
      .from(fixedIncomeSettlements)
      .where(eq(fixedIncomeSettlements.orderId, orderId))
      .orderBy(desc(fixedIncomeSettlements.createdAt))
      .limit(1);

    if (!settlement[0]) {
      return { found: false };
    }

    return {
      found: true,
      settlement: {
        id: settlement[0].id,
        status: settlement[0].settlementStatus || 'unknown',
        tradeDate: settlement[0].tradeDate,
        expectedDate: settlement[0].expectedSettlementDate,
        actualDate: settlement[0].actualSettlementDate || undefined,
        depository: settlement[0].depository
      }
    };
  }

  private calculateConvenienceFee(amount: number, method: string): number {
    switch (method) {
      case 'upi':
        return 0;
      case 'netbanking':
        return Math.min(amount * 0.005, 500);
      case 'neft':
      case 'rtgs':
        return amount > 200000 ? 20 : 10;
      case 'asba':
        return 0;
      default:
        return 0;
    }
  }

  private async createCashfreeOrder(params: {
    orderId: string;
    amount: number;
    currency: string;
    customerEmail: string;
    customerPhone: string;
    customerName: string;
    returnUrl: string;
    notifyUrl: string;
  }): Promise<{ success: boolean; paymentUrl?: string; message?: string }> {
    if (!this.CASHFREE_APP_ID || !this.CASHFREE_SECRET_KEY) {
      console.log('Cashfree credentials not configured, using mock payment');
      return {
        success: true,
        paymentUrl: `/api/fixed-income/payment/mock?orderId=${params.orderId}&amount=${params.amount}`
      };
    }

    try {
      const response = await fetch(`${this.CASHFREE_API_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.CASHFREE_APP_ID,
          'x-client-secret': this.CASHFREE_SECRET_KEY,
          'x-api-version': '2023-08-01'
        },
        body: JSON.stringify({
          order_id: params.orderId,
          order_amount: params.amount,
          order_currency: params.currency,
          customer_details: {
            customer_id: params.orderId.split('_')[1],
            customer_email: params.customerEmail || 'customer@example.com',
            customer_phone: params.customerPhone || '9999999999',
            customer_name: params.customerName
          },
          order_meta: {
            return_url: params.returnUrl,
            notify_url: params.notifyUrl
          }
        })
      });

      const data = await response.json();

      if (response.ok && data.payment_session_id) {
        return {
          success: true,
          paymentUrl: `${this.CASHFREE_API_URL}/pay/${data.payment_session_id}`
        };
      }

      return {
        success: false,
        message: data.message || 'Failed to create payment session'
      };
    } catch (error) {
      console.error('Cashfree API error:', error);
      return {
        success: false,
        message: 'Failed to connect to payment gateway'
      };
    }
  }

  private verifyPaymentSignature(callbackData: PaymentCallbackData): boolean {
    if (!this.CASHFREE_SECRET_KEY) {
      return true;
    }

    try {
      const dataToVerify = `${callbackData.gatewayOrderId}${callbackData.amount}${callbackData.gatewayTransactionId}${callbackData.status}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.CASHFREE_SECRET_KEY)
        .update(dataToVerify)
        .digest('base64');

      return callbackData.signature === expectedSignature;
    } catch {
      return false;
    }
  }

  private async logAuditEvent(
    userId: string,
    eventType: string,
    eventCategory: string,
    eventData: Record<string, any>
  ) {
    try {
      await db.insert(fixedIncomeAuditLog).values({
        userId,
        eventType,
        eventCategory,
        eventData,
        eventResult: 'success',
        eventSource: 'system',
        retentionExpiresAt: new Date(Date.now() + SEVEN_YEARS_MS)
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }

  async initiateSellOrderPayout(orderId: string): Promise<{
    success: boolean;
    payoutId?: string;
    message: string;
    estimatedCreditDate?: string;
  }> {
    try {
      const order = await db.select()
        .from(bondOrders)
        .where(eq(bondOrders.id, orderId))
        .limit(1);

      if (!order[0]) {
        return { success: false, message: 'Order not found' };
      }

      const bondOrder = order[0];
      if (bondOrder.orderType !== 'sell') {
        return { success: false, message: 'Not a sell order' };
      }

      if (bondOrder.orderStatus !== 'awaiting_settlement' && bondOrder.orderStatus !== 'executed') {
        return { success: false, message: 'Order not ready for payout' };
      }

      const user = await db.select()
        .from(users)
        .where(eq(users.id, bondOrder.userId))
        .limit(1);

      if (!user[0]) {
        return { success: false, message: 'User not found' };
      }

      const payoutAmount = parseFloat(bondOrder.netAmount);
      const payoutReference = `SELL_PAY_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const estimatedCreditDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.update(bondOrders)
        .set({
          orderStatus: 'payout_initiated',
          paymentReference: payoutReference,
          lastUpdated: new Date()
        })
        .where(eq(bondOrders.id, orderId));

      await this.logAuditEvent(bondOrder.userId, 'sell_payout_initiated', 'payment', {
        orderId,
        orderNumber: bondOrder.orderNumber,
        isin: bondOrder.isin,
        quantity: bondOrder.quantity,
        payoutAmount,
        payoutReference,
        estimatedCreditDate: estimatedCreditDate.toISOString()
      });

      // In production, this would call Cashfree Payouts API
      // For now, simulate successful payout initiation
      setTimeout(async () => {
        try {
          await db.update(bondOrders)
            .set({
              orderStatus: 'completed',
              paymentStatus: 'paid',
              executionDate: new Date(),
              settlementDate: new Date().toISOString().split('T')[0],
              lastUpdated: new Date()
            })
            .where(eq(bondOrders.id, orderId));

          await this.logAuditEvent(bondOrder.userId, 'sell_payout_completed', 'payment', {
            orderId,
            payoutReference,
            payoutAmount,
            creditedAt: new Date().toISOString()
          });
        } catch (error) {
          console.error('Error completing payout:', error);
        }
      }, 5000);

      return {
        success: true,
        payoutId: payoutReference,
        message: 'Payout initiated successfully. Funds will be credited to your bank account.',
        estimatedCreditDate: estimatedCreditDate.toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('Error initiating sell payout:', error);
      return { success: false, message: 'Failed to initiate payout' };
    }
  }

  async getSellOrderPayoutStatus(orderId: string): Promise<{
    success: boolean;
    status?: string;
    payoutReference?: string;
    amount?: number;
    message: string;
  }> {
    try {
      const order = await db.select()
        .from(bondOrders)
        .where(eq(bondOrders.id, orderId))
        .limit(1);

      if (!order[0]) {
        return { success: false, message: 'Order not found' };
      }

      const bondOrder = order[0];
      if (bondOrder.orderType !== 'sell') {
        return { success: false, message: 'Not a sell order' };
      }

      const statusMap: Record<string, string> = {
        'pending': 'Order pending',
        'awaiting_settlement': 'Settlement in progress',
        'payout_initiated': 'Payout initiated, awaiting bank credit',
        'completed': 'Payout completed'
      };

      const orderStatus = bondOrder.orderStatus || 'pending';

      return {
        success: true,
        status: orderStatus,
        payoutReference: bondOrder.paymentReference ?? undefined,
        amount: parseFloat(bondOrder.netAmount),
        message: statusMap[orderStatus] || 'Processing'
      };
    } catch (error) {
      console.error('Error getting payout status:', error);
      return { success: false, message: 'Failed to get payout status' };
    }
  }
}

export const fixedIncomePaymentOrchestrator = new FixedIncomePaymentOrchestrator();
