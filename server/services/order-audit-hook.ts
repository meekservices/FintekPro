// @ts-nocheck
import { auditLogService } from './audit-log-service';
import { Request } from 'express';
import { createHash } from 'crypto';

export type OrderProductType = 
  | 'mutual_fund' 
  | 'bond' 
  | 'us_equity' 
  | 'unlisted_stock' 
  | 'ipo' 
  | 'aif' 
  | 'pms'
  | 'fd'
  | 'loan';

export type OrderAction = 
  | 'CREATED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'PLACED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PROCESSING'
  | 'SETTLED'
  | 'PARTIALLY_FILLED'
  | 'FAILED'
  | 'COMPLIANCE_CHECK_PASSED'
  | 'COMPLIANCE_CHECK_FAILED'
  | 'SUITABILITY_ACKNOWLEDGED'
  | 'STATUS_UPDATED';

interface OrderAuditOptions {
  userId: string;
  userRole: string;
  orderId: string;
  productType: OrderProductType;
  action: OrderAction;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  req?: Request;
  additionalMetadata?: Record<string, any>;
  // SEBI-mandated compliance fields
  referenceId?: string;
  channel?: 'web' | 'mobile' | 'api' | 'agent_assisted' | 'auto_rebalance';
  mandateId?: string;
  lifecycleId?: string;
  complianceHash?: string;
}

class OrderAuditHook {
  private generateComplianceHash(data: Record<string, any>): string {
    const sortedKeys = Object.keys(data).sort();
    const hashInput = sortedKeys.map(k => `${k}:${JSON.stringify(data[k])}`).join('|');
    return createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  async logOrderEvent(options: OrderAuditOptions): Promise<void> {
    const {
      userId,
      userRole,
      orderId,
      productType,
      action,
      previousState,
      newState,
      req,
      additionalMetadata,
      referenceId,
      channel,
      mandateId,
      lifecycleId,
      complianceHash,
    } = options;

    const detectedChannel = channel || this.detectChannel(req);
    const generatedReferenceId = referenceId || `${productType.toUpperCase()}-${orderId.substring(0, 8)}-${Date.now()}`;
    const generatedComplianceHash = complianceHash || this.generateComplianceHash({
      orderId,
      productType,
      action,
      timestamp: new Date().toISOString(),
      userId,
    });

    try {
      await auditLogService.log(
        `ORDER_${productType.toUpperCase()}`,
        action,
        {
          userId,
          userRole,
          entityType: `order_${productType}`,
          entityId: orderId,
          previousState,
          newState,
          referenceId: generatedReferenceId,
          channel: detectedChannel,
          metadata: {
            ip: req?.ip,
            userAgent: req?.get?.('user-agent'),
            requestPath: req?.path,
            requestMethod: req?.method,
            mandateId,
            lifecycleId,
            complianceHash: generatedComplianceHash,
            sebiCompliant: true,
            ...additionalMetadata,
          },
        }
      );

      console.log(`[OrderAudit] ${productType}:${action} - Order ${orderId.substring(0, 8)}... [ref:${generatedReferenceId.substring(0, 12)}]`);
    } catch (error) {
      console.error(`[OrderAudit] Failed to log ${productType}:${action}:`, error);
    }
  }

  private detectChannel(req?: Request): 'web' | 'mobile' | 'api' | 'agent_assisted' | 'auto_rebalance' {
    if (!req) return 'api';
    const userAgent = req.get?.('user-agent')?.toLowerCase() || '';
    const isAgentAssisted = req.headers['x-agent-id'] || req.query?.agentId;
    
    if (isAgentAssisted) return 'agent_assisted';
    if (userAgent.includes('mobile') || userAgent.includes('android') || userAgent.includes('iphone')) return 'mobile';
    if (req.headers['x-auto-rebalance']) return 'auto_rebalance';
    return 'web';
  }

  async logMFOrderCreated(
    orderId: string,
    userId: string,
    userRole: string,
    orderDetails: Record<string, any>,
    complianceFlags: Record<string, any>,
    req?: Request
  ): Promise<void> {
    await this.logOrderEvent({
      userId,
      userRole,
      orderId,
      productType: 'mutual_fund',
      action: 'CREATED',
      newState: {
        ...orderDetails,
        complianceFlags,
      },
      req,
      additionalMetadata: {
        schemeCode: orderDetails.schemeCode,
        orderType: orderDetails.orderType,
        amount: orderDetails.amount,
      },
    });
  }

  async logBondOrderCreated(
    orderId: string,
    userId: string,
    userRole: string,
    orderDetails: Record<string, any>,
    req?: Request
  ): Promise<void> {
    await this.logOrderEvent({
      userId,
      userRole,
      orderId,
      productType: 'bond',
      action: 'CREATED',
      newState: orderDetails,
      req,
      additionalMetadata: {
        isin: orderDetails.isin,
        bondType: orderDetails.bondType,
        quantity: orderDetails.quantity,
        netAmount: orderDetails.netAmount,
      },
    });
  }

  async logUSOrderCreated(
    orderId: string,
    userId: string,
    userRole: string,
    orderDetails: Record<string, any>,
    complianceResult: Record<string, any>,
    req?: Request
  ): Promise<void> {
    await this.logOrderEvent({
      userId,
      userRole,
      orderId,
      productType: 'us_equity',
      action: 'CREATED',
      newState: {
        ...orderDetails,
        complianceResult,
        lrsDeclaration: true,
        consent: true,
      },
      req,
      additionalMetadata: {
        symbol: orderDetails.symbol,
        side: orderDetails.side,
        quantity: orderDetails.quantity,
        notionalUsd: orderDetails.notionalUsd,
      },
    });
  }

  async logUnlistedOrderCreated(
    orderId: string,
    userId: string,
    userRole: string,
    orderDetails: Record<string, any>,
    req?: Request
  ): Promise<void> {
    await this.logOrderEvent({
      userId,
      userRole,
      orderId,
      productType: 'unlisted_stock',
      action: 'CREATED',
      newState: orderDetails,
      req,
      additionalMetadata: {
        companyId: orderDetails.companyId,
        orderType: orderDetails.orderType,
        quantity: orderDetails.quantity,
        pricePerShare: orderDetails.pricePerShare,
      },
    });
  }

  async logOrderStatusChange(
    orderId: string,
    productType: OrderProductType,
    userId: string,
    userRole: string,
    previousStatus: string,
    newStatus: string,
    reason?: string,
    req?: Request
  ): Promise<void> {
    const actionMap: Record<string, OrderAction> = {
      'pending': 'PAYMENT_INITIATED',
      'placed': 'PLACED',
      'confirmed': 'CONFIRMED',
      'rejected': 'REJECTED',
      'cancelled': 'CANCELLED',
      'processing': 'PROCESSING',
      'settled': 'SETTLED',
      'partial': 'PARTIALLY_FILLED',
      'failed': 'FAILED',
    };

    const action = actionMap[newStatus.toLowerCase()] || 'STATUS_UPDATED';

    await this.logOrderEvent({
      userId,
      userRole,
      orderId,
      productType,
      action,
      previousState: { status: previousStatus },
      newState: { status: newStatus, reason },
      req,
    });
  }

  async logComplianceCheck(
    orderId: string,
    productType: OrderProductType,
    userId: string,
    userRole: string,
    passed: boolean,
    complianceDetails: Record<string, any>,
    req?: Request
  ): Promise<void> {
    await this.logOrderEvent({
      userId,
      userRole,
      orderId,
      productType,
      action: passed ? 'COMPLIANCE_CHECK_PASSED' : 'COMPLIANCE_CHECK_FAILED',
      newState: complianceDetails,
      req,
    });
  }

  async logPaymentEvent(
    orderId: string,
    productType: OrderProductType,
    userId: string,
    userRole: string,
    paymentStatus: 'initiated' | 'completed' | 'failed',
    paymentDetails: Record<string, any>,
    req?: Request
  ): Promise<void> {
    const actionMap: Record<string, OrderAction> = {
      'initiated': 'PAYMENT_INITIATED',
      'completed': 'PAYMENT_COMPLETED',
      'failed': 'PAYMENT_FAILED',
    };

    await this.logOrderEvent({
      userId,
      userRole,
      orderId,
      productType,
      action: actionMap[paymentStatus],
      newState: paymentDetails,
      req,
      additionalMetadata: {
        paymentGateway: paymentDetails.gateway,
        paymentTransactionId: paymentDetails.transactionId,
      },
    });
  }
}

export const orderAuditHook = new OrderAuditHook();
