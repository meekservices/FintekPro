import { db } from '../db';
import { 
  bondOrders,
  fixedIncomeAuditLog,
  fixedIncomeAgentCommissions,
  userProfiles,
  users
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

const SEVEN_YEARS_MS = 7 * 365 * 24 * 60 * 60 * 1000;

interface UnlistedBondOrder {
  userId: string;
  bondName: string;
  isin: string;
  bondType: 'unlisted_corporate' | 'unlisted_ncd';
  quantity: number;
  price: number;
  sellerDetails?: {
    name: string;
    pan: string;
    dematAccount: string;
  };
  partnerId?: string;
  agentId?: string;
}

interface TermSheetData {
  orderId: string;
  bondDetails: {
    name: string;
    isin: string;
    issuer: string;
    faceValue: number;
    couponRate: number;
    maturityDate: string;
    creditRating: string;
  };
  transactionDetails: {
    quantity: number;
    pricePerUnit: number;
    totalValue: number;
    settlementDate: string;
    transferMode: string;
  };
  terms: {
    transferType: string;
    stampDuty: number;
    transferFees: number;
    totalSettlement: number;
    escrowRequired: boolean;
  };
  disclosures: string[];
}

class UnlistedBondWorkflowService {

  async initiateUnlistedBondOrder(orderData: UnlistedBondOrder): Promise<{
    success: boolean;
    orderId?: string;
    termSheetId?: string;
    message: string;
  }> {
    try {
      const user = await db.select()
        .from(users)
        .where(eq(users.id, orderData.userId))
        .limit(1);

      if (!user[0]) {
        return { success: false, message: 'User not found' };
      }

      const profile = await db.select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, orderData.userId))
        .limit(1);

      const kycTier = profile[0]?.kycTier || 'basic';
      if (kycTier !== 'enhanced' && kycTier !== 'accredited') {
        return { 
          success: false, 
          message: 'Unlisted bond trading requires Enhanced or Accredited KYC status' 
        };
      }

      const totalValue = orderData.quantity * orderData.price;
      const stampDuty = this.calculateStampDuty(totalValue, orderData.bondType);
      const transferFees = this.calculateTransferFees(totalValue);
      const platformFee = totalValue * 0.005;
      const netAmount = totalValue + stampDuty + transferFees + platformFee;

      const [order] = await db.insert(bondOrders).values({
        userId: orderData.userId,
        bondType: orderData.bondType,
        isin: orderData.isin,
        bondName: orderData.bondName,
        orderType: 'buy',
        orderCategory: 'unlisted',
        quantity: orderData.quantity,
        price: orderData.price.toString(),
        netAmount: netAmount.toString(),
        stampDuty: stampDuty.toString(),
        stampDutyPaid: false,
        orderStatus: 'term_sheet_pending',
        paymentStatus: 'pending',
        exchange: 'otc',
        executionVenue: 'off_market'
      }).returning();

      const termSheet = this.generateTermSheet(order.id, orderData, totalValue, stampDuty, transferFees);

      if (orderData.partnerId || orderData.agentId) {
        await this.createCommissionRecord(order.id, totalValue, orderData.partnerId, orderData.agentId, orderData.userId, orderData.bondName, orderData.isin);
      }

      await this.logAuditEvent(orderData.userId, 'unlisted_order_initiated', 'trading', {
        orderId: order.id,
        bondName: orderData.bondName,
        isin: orderData.isin,
        quantity: orderData.quantity,
        price: orderData.price,
        totalValue,
        netAmount,
        partnerId: orderData.partnerId,
        agentId: orderData.agentId
      });

      return {
        success: true,
        orderId: order.id,
        termSheetId: `TS-${order.id}`,
        message: 'Unlisted bond order initiated. Please review and sign the term sheet.'
      };
    } catch (error) {
      console.error('Error initiating unlisted bond order:', error);
      return { success: false, message: 'Failed to initiate unlisted bond order' };
    }
  }

  private generateTermSheet(
    orderId: string,
    orderData: UnlistedBondOrder,
    totalValue: number,
    stampDuty: number,
    transferFees: number
  ): { id: string; data: TermSheetData } {
    const settlementDate = new Date();
    settlementDate.setDate(settlementDate.getDate() + 3);

    const termSheetData: TermSheetData = {
      orderId,
      bondDetails: {
        name: orderData.bondName,
        isin: orderData.isin,
        issuer: orderData.bondName.split(' ')[0],
        faceValue: 1000,
        couponRate: 9.5,
        maturityDate: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        creditRating: 'Unrated'
      },
      transactionDetails: {
        quantity: orderData.quantity,
        pricePerUnit: orderData.price,
        totalValue,
        settlementDate: settlementDate.toISOString().split('T')[0],
        transferMode: 'Off-Market Transfer via DP'
      },
      terms: {
        transferType: 'Off-Market Transfer',
        stampDuty,
        transferFees,
        totalSettlement: totalValue + stampDuty + transferFees,
        escrowRequired: totalValue > 1000000
      },
      disclosures: [
        'Unlisted securities carry higher risk and may have limited liquidity.',
        'Price discovery may be limited. The transaction price is negotiated.',
        'No guarantee of secondary market exit.',
        'Due diligence on issuer financials recommended.',
        'Settlement is subject to depository timelines.',
        'Buyer acknowledges understanding of all risks involved.'
      ]
    };

    return {
      id: `TS-${orderId}`,
      data: termSheetData
    };
  }

  async initiateESign(request: {
    orderId: string;
    documentType: string;
    signerId: string;
    signerType: string;
    documentHash: string;
    callbackUrl: string;
  }): Promise<{
    success: boolean;
    eSignUrl?: string;
    transactionId?: string;
    message: string;
  }> {
    try {
      const order = await db.select()
        .from(bondOrders)
        .where(eq(bondOrders.id, request.orderId))
        .limit(1);

      if (!order[0]) {
        return { success: false, message: 'Order not found' };
      }

      const transactionId = `ESIGN-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const eSignUrl = `/api/fixed-income/unlisted/esign/mock?transactionId=${transactionId}&orderId=${request.orderId}&signerType=${request.signerType}`;

      await this.logAuditEvent(request.signerId, 'esign_initiated', 'compliance', {
        orderId: request.orderId,
        documentType: request.documentType,
        signerType: request.signerType,
        transactionId,
        documentHash: request.documentHash
      });

      return {
        success: true,
        eSignUrl,
        transactionId,
        message: 'eSign session initiated. Please complete the signing process.'
      };
    } catch (error) {
      console.error('Error initiating eSign:', error);
      return { success: false, message: 'Failed to initiate eSign' };
    }
  }

  async processESignCallback(
    transactionId: string,
    orderId: string,
    signerType: 'buyer' | 'seller' | 'witness',
    signatureData: {
      signed: boolean;
      signedAt: string;
      signatureHash: string;
      aadhaarLastFour?: string;
    }
  ): Promise<{ success: boolean; orderStatus?: string }> {
    try {
      const order = await db.select()
        .from(bondOrders)
        .where(eq(bondOrders.id, orderId))
        .limit(1);

      if (!order[0]) {
        return { success: false };
      }

      let newStatus = order[0].orderStatus;

      if (signerType === 'buyer' && signatureData.signed) {
        if (order[0].orderStatus === 'term_sheet_pending') {
          newStatus = 'buyer_signed';
        }
      }

      if (signerType === 'seller' && signatureData.signed) {
        if (order[0].orderStatus === 'buyer_signed') {
          newStatus = 'fully_signed';
        }
      }

      if (newStatus === 'fully_signed') {
        newStatus = 'pending_payment';
      }

      await db.update(bondOrders)
        .set({
          orderStatus: newStatus,
          lastUpdated: new Date()
        })
        .where(eq(bondOrders.id, orderId));

      const signatureArtifact = {
        transactionId,
        signerType,
        signed: signatureData.signed,
        signedAt: signatureData.signedAt,
        signatureHash: signatureData.signatureHash,
        aadhaarLastFour: signatureData.aadhaarLastFour,
        complianceRetentionExpiry: new Date(Date.now() + SEVEN_YEARS_MS).toISOString(),
        capturedIpAddress: 'redacted',
        userAgent: 'redacted',
        signatureMethod: 'aadhaar_esign'
      };

      await this.logAuditEvent(order[0].userId, 'esign_signature_captured', 'compliance', {
        orderId,
        ...signatureArtifact,
        eventClassification: 'signature_artifact',
        retentionPolicy: '7_years_sebi'
      });

      await this.logAuditEvent(order[0].userId, 'esign_completed', 'compliance', {
        orderId,
        transactionId,
        signerType,
        signed: signatureData.signed,
        signedAt: signatureData.signedAt,
        signatureHash: signatureData.signatureHash,
        newStatus
      });

      return { success: true, orderStatus: newStatus };
    } catch (error) {
      console.error('Error processing eSign callback:', error);
      return { success: false };
    }
  }

  async createCommissionRecord(
    orderId: string,
    transactionValue: number,
    partnerId: string | undefined,
    agentId: string | undefined,
    clientId: string,
    productName: string,
    isin: string
  ): Promise<void> {
    const partnerRate = 1.0;
    const agentRate = 0.5;
    const TDS_RATE = 0.10;
    const GST_RATE = 0.18;

    const partnerGross = partnerId ? transactionValue * (partnerRate / 100) : 0;
    const agentGross = agentId ? transactionValue * (agentRate / 100) : 0;

    if (partnerId) {
      const tds = partnerGross * TDS_RATE;
      const gst = partnerGross * GST_RATE;
      const net = partnerGross - tds - gst;
      
      await db.insert(fixedIncomeAgentCommissions).values({
        productType: 'unlisted_bond',
        clientId,
        orderId,
        partnerId,
        agentId: partnerId,
        isin,
        productName,
        transactionType: 'buy',
        transactionAmount: transactionValue.toString(),
        commissionRate: partnerRate.toString(),
        grossCommission: partnerGross.toFixed(2),
        netCommission: net.toFixed(2),
        tds: tds.toFixed(2),
        gst: gst.toFixed(2),
        platformShare: '0',
        transactionDate: new Date()
      });
    }

    if (agentId && agentId !== partnerId) {
      const tds = agentGross * TDS_RATE;
      const gst = agentGross * GST_RATE;
      const net = agentGross - tds - gst;
      
      await db.insert(fixedIncomeAgentCommissions).values({
        productType: 'unlisted_bond',
        clientId,
        orderId,
        partnerId: partnerId || null,
        agentId,
        isin,
        productName,
        transactionType: 'buy',
        transactionAmount: transactionValue.toString(),
        commissionRate: agentRate.toString(),
        grossCommission: agentGross.toFixed(2),
        netCommission: net.toFixed(2),
        tds: tds.toFixed(2),
        gst: gst.toFixed(2),
        platformShare: '0',
        transactionDate: new Date()
      });
    }
  }

  async processCommissionPayout(orderId: string): Promise<{
    success: boolean;
    payouts?: Array<{ agentId: string; amount: number; status: string }>;
  }> {
    try {
      const order = await db.select()
        .from(bondOrders)
        .where(eq(bondOrders.id, orderId))
        .limit(1);

      if (!order[0] || order[0].orderStatus !== 'executed') {
        return { success: false };
      }

      const commissions = await db.select()
        .from(fixedIncomeAgentCommissions)
        .where(eq(fixedIncomeAgentCommissions.orderId, orderId));

      const payouts: Array<{ agentId: string; amount: number; status: string }> = [];

      for (const commission of commissions) {
        const payoutReference = `PAYOUT-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        
        await db.update(fixedIncomeAgentCommissions)
          .set({
            payoutReference,
            payoutCompletedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(fixedIncomeAgentCommissions.id, commission.id));

        payouts.push({
          agentId: commission.agentId || 'unknown',
          amount: parseFloat(commission.netCommission || '0'),
          status: 'completed'
        });

        await this.logAuditEvent(commission.agentId || 'system', 'commission_paid', 'payment', {
          orderId,
          commissionId: commission.id,
          amount: commission.netCommission,
          payoutReference
        });
      }

      return { success: true, payouts };
    } catch (error) {
      console.error('Error processing commission payout:', error);
      return { success: false };
    }
  }

  async getUnlistedOrderDetails(orderId: string, userId: string): Promise<{
    success: boolean;
    order?: any;
    commissions?: any[];
  }> {
    try {
      const [order] = await db.select()
        .from(bondOrders)
        .where(and(
          eq(bondOrders.id, orderId),
          eq(bondOrders.userId, userId)
        ))
        .limit(1);

      if (!order) {
        return { success: false };
      }

      const commissions = await db.select()
        .from(fixedIncomeAgentCommissions)
        .where(eq(fixedIncomeAgentCommissions.orderId, orderId));

      return {
        success: true,
        order,
        commissions: commissions.map(c => ({
          agentId: c.agentId,
          partnerId: c.partnerId,
          commissionRate: c.commissionRate,
          grossCommission: c.grossCommission,
          netCommission: c.netCommission,
          tds: c.tds,
          gst: c.gst
        }))
      };
    } catch (error) {
      console.error('Error fetching unlisted order details:', error);
      return { success: false };
    }
  }

  async getPartnerCommissionReport(partnerId: string): Promise<{
    success: boolean;
    summary?: {
      totalCommissions: number;
      pendingPayouts: number;
      completedPayouts: number;
      transactionCount: number;
    };
    commissions?: any[];
  }> {
    try {
      const commissions = await db.select()
        .from(fixedIncomeAgentCommissions)
        .where(eq(fixedIncomeAgentCommissions.partnerId, partnerId))
        .orderBy(desc(fixedIncomeAgentCommissions.createdAt));

      const totalCommissions = commissions.reduce((sum, c) => sum + parseFloat(c.netCommission || '0'), 0);
      const pendingPayouts = commissions.filter(c => !c.payoutCompletedAt).reduce((sum, c) => sum + parseFloat(c.netCommission || '0'), 0);
      const completedPayouts = commissions.filter(c => c.payoutCompletedAt).reduce((sum, c) => sum + parseFloat(c.netCommission || '0'), 0);

      return {
        success: true,
        summary: {
          totalCommissions,
          pendingPayouts,
          completedPayouts,
          transactionCount: commissions.length
        },
        commissions: commissions.map(c => ({
          orderId: c.orderId,
          transactionAmount: c.transactionAmount,
          commissionRate: c.commissionRate,
          grossCommission: c.grossCommission,
          netCommission: c.netCommission,
          payoutCompleted: !!c.payoutCompletedAt,
          createdAt: c.createdAt
        }))
      };
    } catch (error) {
      console.error('Error fetching partner commission report:', error);
      return { success: false };
    }
  }

  private calculateStampDuty(value: number, bondType: string): number {
    return value * 0.0001;
  }

  private calculateTransferFees(value: number): number {
    return Math.min(value * 0.0005, 500);
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
}

export const unlistedBondWorkflow = new UnlistedBondWorkflowService();
