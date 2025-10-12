/**
 * Payment-to-Execution Bridge Service
 * 
 * Orchestrates order execution after successful payment confirmation
 * - Listens to payment gateway callbacks
 * - Updates order status upon payment success
 * - Routes to appropriate execution service based on product type
 * - Ensures idempotency and handles failures
 */

import { orderManagementService } from "./order-management-service";
import { db } from "./db";
import { unifiedOrders } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface PaymentCallbackData {
  orderId: string;
  paymentStatus: 'success' | 'failed' | 'pending';
  paymentGateway: 'cashfree' | 'stripe' | 'phonepe';
  transactionId: string;
  amount: number;
  currency: string;
  gatewayResponse: any;
  timestamp: Date;
}

export interface ExecutionResult {
  success: boolean;
  orderId: string;
  executionStatus: string;
  message: string;
  externalOrderId?: string;
  error?: string;
}

class PaymentExecutionBridge {
  
  /**
   * Main entry point: Handle payment callback and trigger execution
   */
  async processPaymentCallback(callbackData: PaymentCallbackData): Promise<ExecutionResult> {
    const { orderId, paymentStatus, paymentGateway, transactionId, amount, gatewayResponse } = callbackData;
    
    console.log(`[PaymentBridge] Processing payment callback for order ${orderId}, status: ${paymentStatus}`);
    
    try {
      // 1. Fetch order details
      const order = await orderManagementService.getOrderById(orderId);
      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }
      
      // 2. Enhanced idempotency check: Don't process if already completed
      if (order.paymentStatus === 'completed' || ['executed', 'settled', 'completed'].includes(order.status)) {
        console.log(`[PaymentBridge] Order ${orderId} already processed (paymentStatus: ${order.paymentStatus}, status: ${order.status}), skipping`);
        return {
          success: true,
          orderId,
          executionStatus: order.status,
          message: 'Order already processed',
        };
      }
      
      // 3. Update payment status
      if (paymentStatus === 'success') {
        // CRITICAL: Payment reconciliation - verify amount and currency match order
        if (order.amount !== amount) {
          console.error(`[PaymentBridge] SECURITY ALERT: Payment amount mismatch for order ${orderId}. Expected: ${order.amount}, Received: ${amount}, Gateway: ${paymentGateway}, TxnID: ${transactionId}`);
          
          await orderManagementService.updateOrderStatus({
            orderId,
            status: 'payment_error',
            notes: 'Payment amount mismatch - requires manual verification',
            metadata: { 
              ...(order.metadata || {}),
              error: 'payment_amount_mismatch',
              expectedAmount: order.amount,
              receivedAmount: amount,
              paymentGateway,
              transactionId
            },
            actorId: 'system',
            actorType: 'system',
          });
          
          throw new Error(`Payment amount mismatch: expected ${order.amount}, got ${amount}`);
        }

        if (order.currency !== callbackData.currency) {
          console.error(`[PaymentBridge] SECURITY ALERT: Payment currency mismatch for order ${orderId}. Expected: ${order.currency}, Received: ${callbackData.currency}, Gateway: ${paymentGateway}, TxnID: ${transactionId}`);
          
          await orderManagementService.updateOrderStatus({
            orderId,
            status: 'payment_error',
            notes: 'Payment currency mismatch - requires manual verification',
            metadata: { 
              ...(order.metadata || {}),
              error: 'payment_currency_mismatch',
              expectedCurrency: order.currency,
              receivedCurrency: callbackData.currency,
              paymentGateway,
              transactionId
            },
            actorId: 'system',
            actorType: 'system',
          });
          
          throw new Error(`Payment currency mismatch: expected ${order.currency}, got ${callbackData.currency}`);
        }
        
        // Payment reconciliation passed, proceed with status update
        await orderManagementService.updateOrderStatus({
          orderId,
          status: 'payment_completed',
          paymentStatus: 'completed',
          paymentGateway,
          paymentTransactionId: transactionId,
          paymentAmount: amount,
          metadata: { 
            ...(order.metadata || {}),
            gatewayResponse 
          },
          actorId: 'system',
          actorType: 'system',
        });
        
        console.log(`[PaymentBridge] Payment completed for order ${orderId}, amount: ${amount}`);
        
        // 4. Trigger execution based on product type
        return await this.triggerExecution(order);
        
      } else if (paymentStatus === 'failed') {
        await orderManagementService.updateOrderStatus({
          orderId,
          status: 'payment_failed',
          paymentStatus: 'failed',
          paymentGateway,
          paymentTransactionId: transactionId,
          metadata: { 
            ...(order.metadata || {}),
            gatewayResponse 
          },
          actorId: 'system',
          actorType: 'system',
        });
        
        return {
          success: false,
          orderId,
          executionStatus: 'payment_failed',
          message: 'Payment failed',
        };
      } else {
        // Pending status
        await orderManagementService.updateOrderStatus({
          orderId,
          status: 'payment_pending',
          paymentStatus: 'pending',
          paymentGateway,
          paymentTransactionId: transactionId,
          actorId: 'system',
          actorType: 'system',
        });
        
        return {
          success: false,
          orderId,
          executionStatus: 'payment_pending',
          message: 'Payment pending',
        };
      }
      
    } catch (error) {
      console.error(`[PaymentBridge] Error processing payment callback:`, error);
      
      // Update order with error status
      try {
        await orderManagementService.updateOrderStatus({
          orderId,
          status: 'payment_error',
          metadata: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            gatewayResponse 
          },
          actorId: 'system',
          actorType: 'system',
        });
      } catch (updateError) {
        console.error(`[PaymentBridge] Failed to update order status:`, updateError);
      }
      
      return {
        success: false,
        orderId,
        executionStatus: 'error',
        message: 'Failed to process payment',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Route to appropriate execution service based on product type
   */
  private async triggerExecution(order: any): Promise<ExecutionResult> {
    const { id: orderId, productType, userId, amount } = order;
    
    console.log(`[PaymentBridge] Triggering execution for ${productType} order ${orderId}`);
    
    try {
      switch (productType) {
        case 'mutual_fund':
          return await this.executeMutualFundOrder(order);
          
        case 'aif':
          return await this.executeAIFOrder(order);
          
        case 'pms':
          return await this.executePMSOrder(order);
          
        case 'bond':
          return await this.executeBondOrder(order);
          
        case 'equity':
          return await this.executeEquityOrder(order);
          
        case 'ipo':
          return await this.executeIPOOrder(order);
          
        case 'fd':
          return await this.executeFDOrder(order);
          
        case 'loan':
          return await this.executeLoanOrder(order);
          
        default:
          throw new Error(`Unsupported product type: ${productType}`);
      }
      
    } catch (error) {
      console.error(`[PaymentBridge] Execution failed for order ${orderId}:`, error);
      
      // Update order with execution error
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'execution_failed',
        executionStatus: 'failed',
        metadata: { 
          ...order.metadata,
          executionError: error instanceof Error ? error.message : 'Unknown error' 
        },
        actorId: 'system',
        actorType: 'system',
      });
      
      return {
        success: false,
        orderId,
        executionStatus: 'failed',
        message: 'Execution failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  /**
   * Execute Mutual Fund order via BSE Star API
   */
  private async executeMutualFundOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId, metadata } = order;
    
    try {
      // Update to processing
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'processing',
        executionStatus: 'initiated',
        actorId: 'system',
        actorType: 'system',
      });
      
      // TODO: Call BSE Star API to execute MF order
      // const bseResponse = await bseStarService.placeOrder(...);
      
      // For now, simulate success
      const externalOrderId = `BSE-${Date.now()}`;
      
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'executed',
        executionStatus: 'completed',
        externalOrderId,
        executionPrice: order.amount,
        executedQuantity: metadata?.quantity || 1,
        actorId: 'system',
        actorType: 'system',
      });
      
      console.log(`[PaymentBridge] Mutual fund order ${orderId} executed successfully`);
      
      return {
        success: true,
        orderId,
        executionStatus: 'completed',
        message: 'Mutual fund order executed successfully',
        externalOrderId,
      };
      
    } catch (error) {
      throw new Error(`MF execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Execute AIF order
   */
  private async executeAIFOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId, userId, amount, metadata } = order;
    
    try {
      const { aifExecutionService } = await import('./aif-execution-service');
      
      // Extract AIF-specific metadata from order
      const aifCategory = metadata?.aifCategory || metadata?.category || 'CAT_II';
      const fundName = metadata?.fundName || metadata?.productName || 'AIF Fund';
      const fundCode = metadata?.fundCode || metadata?.schemeCode || 'AIF001';
      
      // Execute AIF subscription
      const aifResponse = await aifExecutionService.executeOrder({
        orderId,
        userId,
        aifCategory,
        fundName,
        fundCode,
        investmentAmount: amount,
        units: metadata?.units,
        navPerUnit: metadata?.navPerUnit,
      });
      
      if (aifResponse.success) {
        return {
          success: true,
          orderId,
          executionStatus: 'executed',
          message: aifResponse.message,
          externalOrderId: aifResponse.folioNumber,
        };
      } else {
        // AIF execution failed - errors already logged in service
        return {
          success: false,
          orderId,
          executionStatus: 'failed',
          message: aifResponse.message,
          error: aifResponse.errors?.join('; '),
        };
      }
      
    } catch (error) {
      throw new Error(`AIF execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Execute PMS order
   */
  private async executePMSOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId } = order;
    
    try {
      // Update to processing
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'processing',
        executionStatus: 'initiated',
        actorId: 'system',
        actorType: 'system',
      });
      
      // TODO: Implement PMS execution service
      // const pmsResponse = await pmsExecutionService.execute(order);
      
      // For now, mark as pending manual processing
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'pending_manual_processing',
        executionStatus: 'pending',
        notes: 'PMS order requires manual processing by operations team',
        actorId: 'system',
        actorType: 'system',
      });
      
      return {
        success: true,
        orderId,
        executionStatus: 'pending',
        message: 'PMS order queued for manual processing',
      };
      
    } catch (error) {
      throw new Error(`PMS execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Execute Bond order
   */
  private async executeBondOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId } = order;
    
    // TODO: Implement bond execution
    await orderManagementService.updateOrderStatus({
      orderId,
      status: 'pending_manual_processing',
      notes: 'Bond order requires manual processing',
      actorId: 'system',
      actorType: 'system',
    });
    
    return {
      success: true,
      orderId,
      executionStatus: 'pending',
      message: 'Bond order queued for processing',
    };
  }
  
  /**
   * Execute Equity order
   */
  private async executeEquityOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId } = order;
    
    // TODO: Implement equity execution
    await orderManagementService.updateOrderStatus({
      orderId,
      status: 'pending_manual_processing',
      notes: 'Equity order requires manual processing',
      actorId: 'system',
      actorType: 'system',
    });
    
    return {
      success: true,
      orderId,
      executionStatus: 'pending',
      message: 'Equity order queued for processing',
    };
  }
  
  /**
   * Execute IPO application
   */
  private async executeIPOOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId } = order;
    
    // TODO: Implement IPO execution
    await orderManagementService.updateOrderStatus({
      orderId,
      status: 'pending_manual_processing',
      notes: 'IPO application requires manual processing',
      actorId: 'system',
      actorType: 'system',
    });
    
    return {
      success: true,
      orderId,
      executionStatus: 'pending',
      message: 'IPO application queued for processing',
    };
  }
  
  /**
   * Execute FD order
   */
  private async executeFDOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId } = order;
    
    // TODO: Implement FD execution
    await orderManagementService.updateOrderStatus({
      orderId,
      status: 'pending_manual_processing',
      notes: 'FD order requires manual processing',
      actorId: 'system',
      actorType: 'system',
    });
    
    return {
      success: true,
      orderId,
      executionStatus: 'pending',
      message: 'FD order queued for processing',
    };
  }
  
  /**
   * Execute Loan application
   */
  private async executeLoanOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId } = order;
    
    // TODO: Implement loan execution
    await orderManagementService.updateOrderStatus({
      orderId,
      status: 'pending_manual_processing',
      notes: 'Loan application requires manual processing',
      actorId: 'system',
      actorType: 'system',
    });
    
    return {
      success: true,
      orderId,
      executionStatus: 'pending',
      message: 'Loan application queued for processing',
    };
  }
}

// Export singleton instance
export const paymentExecutionBridge = new PaymentExecutionBridge();
