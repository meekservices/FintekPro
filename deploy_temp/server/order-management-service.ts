/**
 * Unified Order Management Service
 * 
 * Handles complete order lifecycle across all product types:
 * - Mutual Funds, AIF, PMS, Bonds, Equity, IPOs, FDs, Loans
 * - Order creation, status tracking, payment processing
 * - Execution coordination, settlement tracking
 * - Document generation and notifications
 */

import { db } from "./db";
import { unifiedOrders, orderLifecycleEvents, orderDocuments, users } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface CreateOrderRequest {
  userId: string;
  productType: 'mutual_fund' | 'aif' | 'pms' | 'bond' | 'equity' | 'ipo' | 'fd' | 'loan';
  productId?: string;
  productName: string;
  orderType: 'buy' | 'sell' | 'subscription' | 'redemption' | 'sip' | 'application';
  quantity?: number;
  amount: number;
  currency?: string;
  cartId?: string;
  proposalId?: string;
  portfolioId?: string;
  metadata?: any;
  createdBy?: string;
}

export interface UpdateOrderStatusRequest {
  orderId: string;
  status?: string;
  paymentStatus?: string;
  paymentGateway?: string;
  paymentTransactionId?: string;
  paymentAmount?: number;
  kycStatus?: string;
  kycTier?: string;
  executionStatus?: string;
  externalOrderId?: string;
  externalReference?: string;
  executionPrice?: number;
  executedQuantity?: number;
  settlementStatus?: string;
  settlementDate?: Date;
  settlementReference?: string;
  notes?: string;
  metadata?: any;
  actorId?: string;
  actorType?: 'user' | 'system' | 'agent' | 'payment_gateway' | 'execution_service';
}

export interface OrderTimeline {
  orderId: string;
  events: Array<{
    id: string;
    eventType: string;
    eventName: string;
    eventDescription: string | null;
    previousState: any;
    newState: any;
    actorId: string | null;
    actorType: string | null;
    createdAt: Date | null;
  }>;
}

export class OrderManagementService {
  
  /**
   * Generate unique order number with format: ORD-YYYYMMDD-XXXX
   */
  private generateOrderNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${dateStr}-${random}`;
  }

  /**
   * Create a new unified order
   */
  async createOrder(request: CreateOrderRequest) {
    const orderNumber = this.generateOrderNumber();
    const orderId = randomUUID();

    // Create the order
    const [order] = await db.insert(unifiedOrders).values({
      id: orderId,
      orderNumber,
      userId: request.userId,
      productType: request.productType,
      productId: request.productId,
      productName: request.productName,
      orderType: request.orderType,
      quantity: request.quantity?.toString(),
      amount: request.amount.toString(),
      currency: request.currency || 'INR',
      cartId: request.cartId,
      proposalId: request.proposalId,
      portfolioId: request.portfolioId,
      status: 'initiated',
      paymentStatus: 'pending',
      kycStatus: 'pending',
      executionStatus: 'pending',
      settlementStatus: 'pending',
      metadata: request.metadata,
      createdBy: request.createdBy || request.userId,
    }).returning();

    // Create initial lifecycle event
    await this.addLifecycleEvent({
      orderId: order.id,
      eventType: 'status_change',
      eventName: 'Order Initiated',
      eventDescription: `Order created for ${request.productName}`,
      newState: { status: 'initiated', paymentStatus: 'pending' },
      actorId: request.userId,
      actorType: 'user',
    });

    return order;
  }

  /**
   * Get order by ID with full details
   */
  async getOrderById(orderId: string) {
    const [order] = await db
      .select()
      .from(unifiedOrders)
      .where(eq(unifiedOrders.id, orderId));
    
    return order;
  }

  /**
   * Get order by order number
   */
  async getOrderByNumber(orderNumber: string) {
    const [order] = await db
      .select()
      .from(unifiedOrders)
      .where(eq(unifiedOrders.orderNumber, orderNumber));
    
    return order;
  }

  /**
   * Get all orders for a user
   */
  async getUserOrders(userId: string, filters?: {
    productType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    // Build WHERE conditions
    const conditions = [eq(unifiedOrders.userId, userId)];
    
    if (filters?.productType) {
      conditions.push(eq(unifiedOrders.productType, filters.productType));
    }
    
    if (filters?.status) {
      conditions.push(eq(unifiedOrders.status, filters.status));
    }

    // Build query with all conditions combined
    const query = db
      .select()
      .from(unifiedOrders)
      .where(and(...conditions))
      .orderBy(desc(unifiedOrders.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);

    return await query;
  }

  /**
   * Update order status and track changes
   */
  async updateOrderStatus(request: UpdateOrderStatusRequest) {
    const order = await this.getOrderById(request.orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const previousState = {
      status: order.status,
      paymentStatus: order.paymentStatus,
      kycStatus: order.kycStatus,
      executionStatus: order.executionStatus,
      settlementStatus: order.settlementStatus,
    };

    const updates: any = {
      updatedAt: new Date(),
    };

    if (request.status) updates.status = request.status;
    if (request.paymentStatus) updates.paymentStatus = request.paymentStatus;
    if (request.paymentGateway) updates.paymentGateway = request.paymentGateway;
    if (request.paymentTransactionId) updates.paymentTransactionId = request.paymentTransactionId;
    if (request.paymentAmount) updates.paymentAmount = request.paymentAmount.toString();
    if (request.kycStatus) updates.kycStatus = request.kycStatus;
    if (request.kycTier) updates.kycTier = request.kycTier;
    if (request.executionStatus) updates.executionStatus = request.executionStatus;
    if (request.externalOrderId) updates.externalOrderId = request.externalOrderId;
    if (request.externalReference) updates.externalReference = request.externalReference;
    if (request.executionPrice) updates.executionPrice = request.executionPrice.toString();
    if (request.executedQuantity) updates.executedQuantity = request.executedQuantity.toString();
    if (request.settlementStatus) updates.settlementStatus = request.settlementStatus;
    if (request.settlementDate) updates.settlementDate = request.settlementDate;
    if (request.settlementReference) updates.settlementReference = request.settlementReference;
    if (request.notes) updates.notes = request.notes;
    if (request.metadata) updates.metadata = request.metadata;

    // Handle timestamp updates based on status changes
    if (request.paymentStatus === 'completed') {
      updates.paymentCompletedAt = new Date();
    }
    if (request.kycStatus === 'verified') {
      updates.kycVerifiedAt = new Date();
    }
    if (request.executionStatus === 'completed') {
      updates.executedAt = new Date();
    }
    if (request.status === 'completed') {
      updates.completedAt = new Date();
    }
    if (request.status === 'cancelled') {
      updates.cancelledAt = new Date();
    }

    // Update the order
    const [updatedOrder] = await db
      .update(unifiedOrders)
      .set(updates)
      .where(eq(unifiedOrders.id, request.orderId))
      .returning();

    // Create lifecycle event
    const newState = {
      status: updatedOrder.status,
      paymentStatus: updatedOrder.paymentStatus,
      kycStatus: updatedOrder.kycStatus,
      executionStatus: updatedOrder.executionStatus,
      settlementStatus: updatedOrder.settlementStatus,
    };

    await this.addLifecycleEvent({
      orderId: request.orderId,
      eventType: 'status_change',
      eventName: this.getEventName(previousState, newState),
      eventDescription: request.notes,
      previousState,
      newState,
      actorId: request.actorId,
      actorType: request.actorType || 'system',
    });

    return updatedOrder;
  }

  /**
   * Add lifecycle event to order timeline
   */
  async addLifecycleEvent(event: {
    orderId: string;
    eventType: string;
    eventName: string;
    eventDescription?: string;
    previousState?: any;
    newState?: any;
    actorId?: string;
    actorType?: string;
    metadata?: any;
  }) {
    await db.insert(orderLifecycleEvents).values({
      orderId: event.orderId,
      eventType: event.eventType,
      eventName: event.eventName,
      eventDescription: event.eventDescription,
      previousState: event.previousState,
      newState: event.newState,
      actorId: event.actorId,
      actorType: event.actorType,
      metadata: event.metadata,
      isSystemGenerated: event.actorType === 'system',
    });
  }

  /**
   * Get order timeline with all lifecycle events
   */
  async getOrderTimeline(orderId: string): Promise<OrderTimeline> {
    const events = await db
      .select()
      .from(orderLifecycleEvents)
      .where(eq(orderLifecycleEvents.orderId, orderId))
      .orderBy(desc(orderLifecycleEvents.createdAt));

    return {
      orderId,
      events,
    };
  }

  /**
   * Add document to order
   */
  async addDocument(document: {
    orderId: string;
    documentType: string;
    documentName: string;
    documentUrl?: string;
    fileSize?: number;
    mimeType?: string;
    requiresSignature?: boolean;
    metadata?: any;
  }) {
    const [doc] = await db.insert(orderDocuments).values({
      orderId: document.orderId,
      documentType: document.documentType,
      documentName: document.documentName,
      documentUrl: document.documentUrl,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      requiresSignature: document.requiresSignature || false,
      status: 'generated',
      metadata: document.metadata,
    }).returning();

    // Add lifecycle event
    await this.addLifecycleEvent({
      orderId: document.orderId,
      eventType: 'document_generated',
      eventName: 'Document Generated',
      eventDescription: `${document.documentType} document generated`,
      metadata: { documentId: doc.id, documentName: document.documentName },
      actorType: 'system',
    });

    return doc;
  }

  /**
   * Get all documents for an order
   */
  async getOrderDocuments(orderId: string) {
    return await db
      .select()
      .from(orderDocuments)
      .where(eq(orderDocuments.orderId, orderId))
      .orderBy(desc(orderDocuments.createdAt));
  }

  /**
   * Helper: Get event name based on state changes
   */
  private getEventName(previousState: any, newState: any): string {
    if (previousState.paymentStatus !== newState.paymentStatus) {
      if (newState.paymentStatus === 'completed') return 'Payment Completed';
      if (newState.paymentStatus === 'failed') return 'Payment Failed';
    }
    
    if (previousState.kycStatus !== newState.kycStatus) {
      if (newState.kycStatus === 'verified') return 'KYC Verified';
      if (newState.kycStatus === 'rejected') return 'KYC Rejected';
    }
    
    if (previousState.executionStatus !== newState.executionStatus) {
      if (newState.executionStatus === 'in_progress') return 'Execution Started';
      if (newState.executionStatus === 'completed') return 'Order Executed';
      if (newState.executionStatus === 'failed') return 'Execution Failed';
    }
    
    if (previousState.settlementStatus !== newState.settlementStatus) {
      if (newState.settlementStatus === 'completed') return 'Settlement Completed';
    }
    
    if (previousState.status !== newState.status) {
      if (newState.status === 'completed') return 'Order Completed';
      if (newState.status === 'cancelled') return 'Order Cancelled';
      if (newState.status === 'processing') return 'Order Processing';
    }
    
    return 'Order Updated';
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, reason: string, userId: string) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    // Only allow cancellation if order is not yet executed
    if (['executed', 'settled', 'completed'].includes(order.executionStatus || '')) {
      throw new Error('Cannot cancel an executed order');
    }

    return await this.updateOrderStatus({
      orderId,
      status: 'cancelled',
      notes: reason,
      actorId: userId,
      actorType: 'user',
      metadata: { cancellationReason: reason },
    });
  }

  /**
   * Get order statistics for a user
   */
  async getUserOrderStats(userId: string) {
    const result = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(case when status = 'initiated' or status = 'payment_pending' then 1 end)::int`,
        processing: sql<number>`count(case when status = 'processing' then 1 end)::int`,
        completed: sql<number>`count(case when status = 'completed' then 1 end)::int`,
        cancelled: sql<number>`count(case when status = 'cancelled' then 1 end)::int`,
        totalAmount: sql<string>`sum(amount)::text`,
      })
      .from(unifiedOrders)
      .where(eq(unifiedOrders.userId, userId));

    return result[0] || {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
      totalAmount: '0',
    };
  }
}

// Export singleton instance
export const orderManagementService = new OrderManagementService();
