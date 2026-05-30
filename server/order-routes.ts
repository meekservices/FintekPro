/**
 * Unified Order Management API Routes
 * 
 * RESTful endpoints for order management across all product types
 */

import { Express, Request, Response } from "express";
import { orderManagementService } from "./order-management-service";
import { z } from "zod";
import { blockSubAgentTransactions } from "./kyc-middleware";

// Request validation schemas
const createOrderSchema = z.object({
  productType: z.enum(['mutual_fund', 'aif', 'pms', 'bond', 'equity', 'ipo', 'fd', 'loan']),
  productId: z.string().optional(),
  productName: z.string(),
  orderType: z.enum(['buy', 'sell', 'subscription', 'redemption', 'sip', 'application']),
  quantity: z.number().optional(),
  amount: z.number(),
  currency: z.string().default('INR'),
  cartId: z.string().optional(),
  proposalId: z.string().optional(),
  portfolioId: z.string().optional(),
  metadata: z.any().optional(),
});

const updateOrderStatusSchema = z.object({
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  paymentGateway: z.string().optional(),
  paymentTransactionId: z.string().optional(),
  paymentAmount: z.number().optional(),
  kycStatus: z.string().optional(),
  kycTier: z.string().optional(),
  executionStatus: z.string().optional(),
  externalOrderId: z.string().optional(),
  externalReference: z.string().optional(),
  executionPrice: z.number().optional(),
  executedQuantity: z.number().optional(),
  settlementStatus: z.string().optional(),
  settlementDate: z.string().optional(),
  settlementReference: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.any().optional(),
});

export function registerOrderRoutes(app: Express) {
  
  /**
   * GET /api/orders
   * List all orders for authenticated user
   */
  app.get('/api/orders', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { productType, status, limit = '20', offset = '0' } = req.query;

      const orders = await orderManagementService.getUserOrders(userId, {
        productType: productType as string,
        status: status as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      res.json({
        success: true,
        orders,
        count: orders.length,
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch orders',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/orders/stats
   * Get order statistics for authenticated user
   */
  app.get('/api/orders/stats', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const stats = await orderManagementService.getUserOrderStats(userId);

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('Error fetching order stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order statistics',
      });
    }
  });

  /**
   * GET /api/orders/:orderId
   * Get order details by ID
   */
  app.get('/api/orders/:orderId', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { orderId } = req.params;
      const order = await orderManagementService.getOrderById(orderId);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }

      // Verify ownership
      if (order.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to view this order',
        });
      }

      res.json({
        success: true,
        order,
      });
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order',
      });
    }
  });

  /**
   * GET /api/orders/:orderId/timeline
   * Get order lifecycle timeline with all events
   */
  app.get('/api/orders/:orderId/timeline', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { orderId } = req.params;
      
      // Verify ownership
      const order = await orderManagementService.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }
      
      if (order.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to view this order',
        });
      }

      const timeline = await orderManagementService.getOrderTimeline(orderId);

      res.json({
        success: true,
        timeline,
      });
    } catch (error) {
      console.error('Error fetching order timeline:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order timeline',
      });
    }
  });

  /**
   * GET /api/orders/:orderId/documents
   * Get all documents for an order
   */
  app.get('/api/orders/:orderId/documents', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { orderId } = req.params;
      
      // Verify order exists
      const order = await orderManagementService.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }

      // Verify ownership
      if (order.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to view order documents',
        });
      }

      const documents = await orderManagementService.getOrderDocuments(orderId);

      res.json({
        success: true,
        documents,
      });
    } catch (error) {
      console.error('Error fetching order documents:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch order documents',
      });
    }
  });

  /**
   * POST /api/orders
   * Create a new order
   * SECURITY: Sub-agents are blocked from executing transactions
   */
  app.post('/api/orders', blockSubAgentTransactions(), async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const validatedData = createOrderSchema.parse(req.body);

      const order = await orderManagementService.createOrder({
        ...validatedData,
        userId,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        order,
        message: 'Order created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.issues,
        });
      }

      console.error('Error creating order:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create order',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * PUT /api/orders/:orderId/status
   * Update order status (INTERNAL API ONLY - called by payment/execution services)
   * 
   * CRITICAL: This endpoint should ONLY be accessible to:
   * - System administrators (admin, superadmin)
   * - Internal service accounts (future: with service tokens)
   * 
   * Order owners CANNOT update their own order status to prevent fraud
   * (e.g., marking orders as paid/executed without actual payment/execution)
   */
  app.put('/api/orders/:orderId/status', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { orderId } = req.params;
      
      // Verify order exists
      const order = await orderManagementService.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }

      // ONLY allow admin or system roles - NOT order owners
      // This prevents users from fraudulently marking their orders as paid/executed
      const userRole = (req as any).user?.role;
      const isAuthorized = userRole === 'admin' || userRole === 'superadmin';
      
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: This endpoint is restricted to system administrators only',
          message: 'Order status updates can only be performed by internal services or administrators',
        });
      }

      const validatedData = updateOrderStatusSchema.parse(req.body);

      const updatedOrder = await orderManagementService.updateOrderStatus({
        orderId,
        ...validatedData,
        settlementDate: validatedData.settlementDate ? new Date(validatedData.settlementDate) : undefined,
        actorId: userId,
        actorType: 'system',
      });

      res.json({
        success: true,
        order: updatedOrder,
        message: 'Order status updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: error.issues,
        });
      }

      console.error('Error updating order status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update order status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/orders/:orderId/cancel
   * Cancel an order
   */
  app.post('/api/orders/:orderId/cancel', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { orderId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Cancellation reason is required',
        });
      }

      // Verify ownership
      const order = await orderManagementService.getOrderById(orderId);
      if (!order || order.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to cancel this order',
        });
      }

      const cancelledOrder = await orderManagementService.cancelOrder(orderId, reason, userId);

      res.json({
        success: true,
        order: cancelledOrder,
        message: 'Order cancelled successfully',
      });
    } catch (error) {
      console.error('Error cancelling order:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel order',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/orders/:orderId/balance-payment
   * Process balance payment for AIF orders with partial payment
   */
  app.post('/api/orders/:orderId/balance-payment', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { orderId } = req.params;
      const { paymentAmount, paymentMethod, paymentGateway, transactionId } = req.body;

      // Validate required fields
      if (!paymentAmount || !paymentMethod || !paymentGateway) {
        return res.status(400).json({
          success: false,
          error: 'Payment amount, method, and gateway are required',
        });
      }

      // Verify order exists and belongs to user
      const order = await orderManagementService.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }

      if (order.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to make payment for this order',
        });
      }

      // Verify order is in balance_pending state
      const orderMetadata = order.metadata as any;
      if (orderMetadata?.paymentStage !== 'balance_pending') {
        return res.status(400).json({
          success: false,
          error: 'Order does not require balance payment',
          currentStage: orderMetadata?.paymentStage,
        });
      }

      // Verify payment amount matches balance amount
      const balanceAmount = orderMetadata?.balanceAmount || 0;
      if (Math.abs(paymentAmount - balanceAmount) > 0.01) {
        return res.status(400).json({
          success: false,
          error: `Payment amount ₹${paymentAmount.toLocaleString()} does not match balance due ₹${balanceAmount.toLocaleString()}`,
        });
      }

      // Update order with balance payment info
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'payment_completed',
        paymentStatus: 'completed',
        paymentAmount: (order.amount || 0) + paymentAmount, // Total amount including initial + balance
        paymentGateway,
        paymentTransactionId: transactionId || `BAL-${Date.now()}`,
        notes: `Balance payment of ₹${paymentAmount.toLocaleString()} received via ${paymentGateway}`,
        metadata: {
          ...orderMetadata,
          balancePaymentAmount: paymentAmount,
          balancePaymentDate: new Date().toISOString(),
          balancePaymentMethod: paymentMethod,
          balancePaymentGateway: paymentGateway,
          balancePaymentTransactionId: transactionId,
          paymentStage: 'fully_paid',
          totalPaidAmount: (orderMetadata?.paidAmount || 0) + paymentAmount,
        },
        actorId: userId,
        actorType: 'user',
      });

      // Get updated order
      const updatedOrder = await orderManagementService.getOrderById(orderId);

      res.json({
        success: true,
        order: updatedOrder,
        message: `Balance payment of ₹${paymentAmount.toLocaleString()} processed successfully`,
      });
    } catch (error) {
      console.error('Error processing balance payment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process balance payment',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/orders/:orderId/documents
   * Add a document to an order (internal API - called by execution services)
   * Requires authentication and proper authorization
   */
  app.post('/api/orders/:orderId/documents', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { orderId } = req.params;
      
      // Verify order exists
      const order = await orderManagementService.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }

      // Only allow order owner, admin, or system to add documents
      const userRole = (req as any).user?.role;
      const isAdmin = userRole === 'admin' || userRole === 'superadmin';
      const isOwner = order.userId === userId;
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to add documents to this order',
        });
      }

      const { documentType, documentName, documentUrl, fileSize, mimeType, requiresSignature, metadata } = req.body;

      if (!documentType || !documentName) {
        return res.status(400).json({
          success: false,
          error: 'documentType and documentName are required',
        });
      }

      const document = await orderManagementService.addDocument({
        orderId,
        documentType,
        documentName,
        documentUrl,
        fileSize,
        mimeType,
        requiresSignature,
        metadata,
      });

      res.status(201).json({
        success: true,
        document,
        message: 'Document added successfully',
      });
    } catch (error) {
      console.error('Error adding document:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add document',
      });
    }
  });
}
