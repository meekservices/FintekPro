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
import { BSEStarApiService } from "./bseStarApi";
import { LoanProcessingService } from "./loan-processing-service";
import { BSEBondApiService } from "./bseBondApi";

// Feature flags for beta execution services
const FEATURE_FLAGS = {
  ENABLE_BOND_EXECUTION: process.env.ENABLE_BOND_EXECUTION === 'true',
  ENABLE_EQUITY_EXECUTION: process.env.ENABLE_EQUITY_EXECUTION === 'true',
  ENABLE_IPO_EXECUTION: process.env.ENABLE_IPO_EXECUTION === 'true',
  ENABLE_FD_EXECUTION: process.env.ENABLE_FD_EXECUTION === 'true',
};

export interface PaymentCallbackData {
  orderId: string;
  paymentStatus: 'success' | 'failed' | 'pending';
  paymentGateway: 'cashfree' | 'phonepe';
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
        // Detect if this is a balance payment or initial payment
        const orderMetadata = order.metadata as any || {};
        const paymentStage = orderMetadata.paymentStage;
        const isBalancePayment = paymentStage === 'balance_pending';
        
        // CRITICAL: Payment reconciliation - verify amount matches expected payment
        let expectedAmount = Number(order.amount);
        let paymentType = 'full';
        
        if (isBalancePayment) {
          // For balance payments, verify against balance amount
          expectedAmount = Number(orderMetadata.balanceAmount || 0);
          paymentType = 'balance';
          console.log(`[PaymentBridge] Processing BALANCE payment for order ${orderId}, expected: ₹${expectedAmount.toLocaleString()}, received: ₹${amount.toLocaleString()}`);
        } else if (orderMetadata.isPartialPayment) {
          // For initial partial payments, verify against initial payment amount
          expectedAmount = Number(orderMetadata.initialPaymentAmount || orderMetadata.paidAmount || order.amount);
          paymentType = 'initial';
          console.log(`[PaymentBridge] Processing INITIAL partial payment for order ${orderId}, expected: ₹${expectedAmount.toLocaleString()}, received: ₹${amount.toLocaleString()}`);
        }
        
        if (Math.abs(expectedAmount - Number(amount)) > 0.01) {  // Use floating point tolerance
          console.error(`[PaymentBridge] SECURITY ALERT: ${paymentType} payment amount mismatch for order ${orderId}. Expected: ${expectedAmount}, Received: ${amount}, Gateway: ${paymentGateway}, TxnID: ${transactionId}`);
          
          await orderManagementService.updateOrderStatus({
            orderId,
            status: 'payment_error',
            notes: `${paymentType} payment amount mismatch - requires manual verification`,
            metadata: { 
              ...orderMetadata,
              error: 'payment_amount_mismatch',
              paymentType,
              expectedAmount,
              receivedAmount: amount,
              paymentGateway,
              transactionId
            },
            actorId: 'system',
            actorType: 'system',
          });
          
          throw new Error(`${paymentType} payment amount mismatch: expected ${expectedAmount}, got ${amount}`);
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
        // Build metadata based on payment type
        const updatedMetadata: any = { 
          ...(order.metadata || {}),
          gatewayResponse 
        };
        
        let totalPaidAmount = amount; // Default to current payment amount
        
        if (isBalancePayment) {
          // For balance payments, update metadata with balance payment details
          updatedMetadata.balancePaymentAmount = amount;
          updatedMetadata.balancePaymentDate = new Date().toISOString();
          updatedMetadata.balancePaymentGateway = paymentGateway;
          updatedMetadata.balancePaymentTransactionId = transactionId;
          updatedMetadata.paymentStage = 'fully_paid';
          // Calculate total paid amount: initial payment + balance payment
          const initialPaid = orderMetadata.initialPaymentAmount || orderMetadata.paidAmount || 0;
          totalPaidAmount = initialPaid + amount;
          updatedMetadata.totalPaidAmount = totalPaidAmount;
          console.log(`[PaymentBridge] Balance payment completed for order ${orderId}, initial: ₹${initialPaid.toLocaleString()}, balance: ₹${amount.toLocaleString()}, total paid: ₹${totalPaidAmount.toLocaleString()}`);
        } else if (orderMetadata.isPartialPayment) {
          // For initial partial payments, mark as balance_pending
          updatedMetadata.paymentStage = 'balance_pending';
          updatedMetadata.initialPaymentAmount = amount;
          updatedMetadata.initialPaymentDate = new Date().toISOString();
          updatedMetadata.initialPaymentGateway = paymentGateway;
          updatedMetadata.initialPaymentTransactionId = transactionId;
          updatedMetadata.paidAmount = amount; // Track initial payment
          totalPaidAmount = amount;
          console.log(`[PaymentBridge] Initial partial payment completed for order ${orderId}, paid: ₹${amount.toLocaleString()}, balance pending: ₹${orderMetadata.balanceAmount?.toLocaleString()}`);
        }
        
        await orderManagementService.updateOrderStatus({
          orderId,
          status: 'payment_completed',
          paymentStatus: 'completed',
          paymentGateway,
          paymentTransactionId: transactionId,
          paymentAmount: totalPaidAmount, // Total amount paid so far
          metadata: updatedMetadata,
          actorId: 'system',
          actorType: 'system',
        });
        
        console.log(`[PaymentBridge] ${paymentType.toUpperCase()} payment completed for order ${orderId}, amount: ₹${amount.toLocaleString()}`);
        
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
   * Integrates with BSE Star MF platform for automated order processing
   */
  private async executeMutualFundOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId, userId, metadata } = order;
    
    try {
      // Update to processing
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'processing',
        executionStatus: 'initiated',
        actorId: 'system',
        actorType: 'system',
      });
      
      // Extract MF-specific metadata
      const {
        schemeCode,
        schemeName,
        folioNumber,
        transactionType = 'P', // P = Purchase, R = Redeem
        orderType = 'LUMPSUM', // LUMPSUM or SIP
        clientCode,
        agentArn,
        agentEuin,
        euinDeclaration,
        sipFreq,
        sipStartDate,
        sipEndDate,
        amount: metadataAmount
      } = metadata || {};
      
      // Validate required fields
      if (!schemeCode) {
        throw new Error('Scheme code is required for MF order execution');
      }
      
      if (!clientCode) {
        throw new Error('Client code (BSE client ID) is required for MF order execution');
      }
      
      // Use BSE Star API service
      const bseService = new BSEStarApiService();
      
      // Determine payment amount - prioritize total paid amount over order amount
      const totalPaidAmount = metadata?.totalPaidAmount || metadata?.paidAmount || order.amount;
      
      // Build BSE order request
      const bseRequest = {
        proposalId: orderId,
        clientCode,
        orderType: orderType as 'LUMPSUM' | 'SIP',
        agentArn,
        agentEuin,
        euinDeclaration,
        items: [{
          schemeCode,
          amount: metadataAmount || totalPaidAmount,
          transactionType: transactionType as 'P' | 'R',
          folioNo: folioNumber,
          sipFreq: sipFreq as 'MONTHLY' | 'QUARTERLY' | 'DAILY',
          sipStartDate,
          sipEndDate
        }]
      };
      
      console.log(`[PaymentBridge] Executing MF order ${orderId} via BSE Star API`, {
        schemeCode,
        orderType,
        amount: bseRequest.items[0].amount,
        clientCode
      });
      
      // Execute order through BSE Star API
      const bseResponse = await bseService.completeOrder(bseRequest);
      
      if (bseResponse.success) {
        // BSE order executed successfully
        const externalOrderId = bseResponse.orderId || bseResponse.transNo || `BSE-${Date.now()}`;
        
        await orderManagementService.updateOrderStatus({
          orderId,
          status: 'executed',
          executionStatus: 'completed',
          externalOrderId,
          executionPrice: bseRequest.items[0].amount,
          executedQuantity: metadata?.units || 1,
          metadata: {
            ...metadata,
            bseOrderId: bseResponse.orderId,
            bseTransNo: bseResponse.transNo,
            bseReference: bseResponse.bseReference,
            bsePaymentUrl: bseResponse.paymentUrl,
            executedAt: new Date().toISOString()
          },
          actorId: 'system',
          actorType: 'system',
        });
        
        console.log(`[PaymentBridge] MF order ${orderId} executed successfully on BSE`, {
          externalOrderId,
          bseOrderId: bseResponse.orderId,
          bseTransNo: bseResponse.transNo
        });
        
        return {
          success: true,
          orderId,
          executionStatus: 'completed',
          message: bseResponse.message || 'Mutual fund order executed successfully via BSE Star',
          externalOrderId,
        };
      } else {
        // BSE execution failed
        console.error(`[PaymentBridge] BSE execution failed for order ${orderId}:`, bseResponse.message);
        
        await orderManagementService.updateOrderStatus({
          orderId,
          status: 'execution_failed',
          executionStatus: 'failed',
          metadata: {
            ...metadata,
            bseError: bseResponse.message,
            failedAt: new Date().toISOString()
          },
          actorId: 'system',
          actorType: 'system',
        });
        
        throw new Error(`BSE execution failed: ${bseResponse.message}`);
      }
      
    } catch (error) {
      console.error(`[PaymentBridge] MF execution error for order ${orderId}:`, error);
      
      // Log execution error but let caller handle status update
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
      
      // Determine paid amount based on payment stage
      const paidAmount = metadata?.totalPaidAmount || metadata?.paidAmount || metadata?.initialPaymentAmount || amount;
      
      // Execute AIF subscription
      const aifResponse = await aifExecutionService.executeOrder({
        orderId,
        userId,
        aifCategory,
        fundName,
        fundCode,
        investmentAmount: metadata?.totalInvestmentAmount || amount,
        paidAmount,
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
   * Execute Bond order via BSE Bond API (Feature Flagged)
   * Supports corporate bonds, NCDs, and debentures
   */
  private async executeBondOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId, userId, amount, metadata } = order;
    
    // Check feature flag
    if (!FEATURE_FLAGS.ENABLE_BOND_EXECUTION) {
      console.log(`[PaymentBridge] Bond execution disabled (feature flag), queueing for manual processing`);
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'pending_manual_processing',
        notes: 'Bond execution is currently disabled. Order queued for manual processing.',
        actorId: 'system',
        actorType: 'system',
      });
      
      return {
        success: true,
        orderId,
        executionStatus: 'pending',
        message: 'Bond order queued for manual processing (automated execution disabled)',
      };
    }
    
    try {
      // Update to processing
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'processing',
        executionStatus: 'initiated',
        actorId: 'system',
        actorType: 'system',
      });
      
      // Extract bond-specific metadata
      const {
        isin,
        bondCode,
        bondName,
        quantity,
        orderType = 'buy',
        orderCategory = 'limit',
        limitPrice,
        clientCode,
        dematAccountNumber
      } = metadata || {};
      
      // Validate required fields
      if (!isin && !bondCode) {
        throw new Error('ISIN or Bond Code is required for bond execution');
      }
      
      if (!clientCode) {
        throw new Error('Client code is required for bond execution');
      }
      
      if (!dematAccountNumber) {
        throw new Error('Demat account number is required for bond execution');
      }
      
      if (!quantity) {
        throw new Error('Quantity is required for bond execution');
      }
      
      // Use BSE Bond API Service
      const bondService = new BSEBondApiService();
      
      // Build bond order request
      const bondRequest = {
        userId: clientCode, // BSE Bond service handles userId internally
        clientCode,
        isin: isin || bondCode,
        bondType: 'corporate' as const,
        orderType: orderType as 'buy' | 'sell',
        quantity: Number(quantity),
        orderCategory: orderCategory as 'market' | 'limit',
        limitPrice: limitPrice ? Number(limitPrice) : undefined,
        dematAccountNumber
      };
      
      console.log(`[PaymentBridge] Executing bond order ${orderId} via BSE Bond API`, {
        isin: bondRequest.isin,
        orderType,
        quantity,
        clientCode
      });
      
      // Execute bond order through BSE Bond API
      const bondResponse = await bondService.placeBondOrder(bondRequest);
      
      if (bondResponse.success) {
        // Bond order executed successfully
        const externalOrderId = bondResponse.orderId || bondResponse.orderNumber || `BOND-${Date.now()}`;
        
        await orderManagementService.updateOrderStatus({
          orderId,
          status: 'executed',
          executionStatus: 'completed',
          externalOrderId,
          executionPrice: bondResponse.executionDetails?.executionPrice || limitPrice || 0,
          executedQuantity: quantity,
          metadata: {
            ...metadata,
            bondOrderId: bondResponse.orderId,
            bondOrderNumber: bondResponse.orderNumber,
            executionDetails: bondResponse.executionDetails,
            executedAt: new Date().toISOString()
          },
          actorId: 'system',
          actorType: 'system',
        });
        
        console.log(`[PaymentBridge] Bond order ${orderId} executed successfully on BSE`, {
          externalOrderId,
          executionPrice: bondResponse.executionDetails?.executionPrice
        });
        
        return {
          success: true,
          orderId,
          executionStatus: 'completed',
          message: bondResponse.message || 'Bond order executed successfully via BSE',
          externalOrderId,
        };
      } else {
        // Bond execution failed
        console.error(`[PaymentBridge] BSE bond execution failed for order ${orderId}:`, bondResponse.message);
        
        await orderManagementService.updateOrderStatus({
          orderId,
          status: 'execution_failed',
          executionStatus: 'failed',
          metadata: {
            ...metadata,
            bondError: bondResponse.message,
            failedAt: new Date().toISOString()
          },
          actorId: 'system',
          actorType: 'system',
        });
        
        throw new Error(`Bond execution failed: ${bondResponse.message}`);
      }
      
    } catch (error) {
      console.error(`[PaymentBridge] Bond execution error for order ${orderId}:`, error);
      throw new Error(`Bond execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Execute Equity order (Feature Flagged - Beta)
   * Note: Requires broker integration (e.g., Zerodha Kite, Angel One, ICICI Direct)
   */
  private async executeEquityOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId, userId, amount, metadata } = order;
    
    // Check feature flag
    if (!FEATURE_FLAGS.ENABLE_EQUITY_EXECUTION) {
      console.log(`[PaymentBridge] Equity execution disabled (feature flag), queueing for manual processing`);
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'pending_manual_processing',
        notes: 'Equity execution is currently in beta. Order queued for manual processing.',
        actorId: 'system',
        actorType: 'system',
      });
      
      return {
        success: true,
        orderId,
        executionStatus: 'pending',
        message: 'Equity order queued for manual processing (automated execution in beta)',
      };
    }
    
    try {
      // Update to processing
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'processing',
        executionStatus: 'initiated',
        actorId: 'system',
        actorType: 'system',
      });
      
      // Extract equity-specific metadata
      const {
        symbol,
        exchange = 'NSE',
        quantity,
        orderType = 'market', // market, limit, sl, sl-m
        price,
        triggerPrice,
        clientCode,
        tradingAccountId
      } = metadata || {};
      
      // Validate required fields
      if (!symbol) {
        throw new Error('Stock symbol is required for equity execution');
      }
      
      if (!quantity) {
        throw new Error('Quantity is required for equity execution');
      }
      
      if (!tradingAccountId) {
        throw new Error('Trading account ID is required for equity execution');
      }
      
      // TODO: Integrate with broker API (Zerodha Kite, Angel One, etc.)
      // const brokerService = new BrokerApiService();
      // const equityResponse = await brokerService.placeOrder({...});
      
      // For now, simulate placeholder
      const externalOrderId = `EQ-${Date.now()}`;
      
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'pending_manual_processing',
        executionStatus: 'pending',
        metadata: {
          ...metadata,
          pendingReason: 'Awaiting broker API integration',
          queuedAt: new Date().toISOString()
        },
        notes: 'Equity order pending broker integration - requires manual placement',
        actorId: 'system',
        actorType: 'system',
      });
      
      console.log(`[PaymentBridge] Equity order ${orderId} queued (broker integration pending)`, {
        symbol,
        quantity,
        exchange
      });
      
      return {
        success: true,
        orderId,
        executionStatus: 'pending',
        message: 'Equity order queued for manual processing (broker integration pending)',
        externalOrderId,
      };
      
    } catch (error) {
      console.error(`[PaymentBridge] Equity execution error for order ${orderId}:`, error);
      throw new Error(`Equity execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Execute IPO application (Feature Flagged - Beta)
   * Note: Requires ASBA (Application Supported by Blocked Amount) integration
   */
  private async executeIPOOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId, userId, amount, metadata } = order;
    
    // Check feature flag
    if (!FEATURE_FLAGS.ENABLE_IPO_EXECUTION) {
      console.log(`[PaymentBridge] IPO execution disabled (feature flag), queueing for manual processing`);
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'pending_manual_processing',
        notes: 'IPO execution is currently in beta. Application queued for manual processing.',
        actorId: 'system',
        actorType: 'system',
      });
      
      return {
        success: true,
        orderId,
        executionStatus: 'pending',
        message: 'IPO application queued for manual processing (automated execution in beta)',
      };
    }
    
    try {
      // Update to processing
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'processing',
        executionStatus: 'initiated',
        actorId: 'system',
        actorType: 'system',
      });
      
      // Extract IPO-specific metadata
      const {
        ipoName,
        ipoCode,
        category = 'retail', // retail, hni, qib
        lotSize,
        bids, // Array of bid details
        upiId,
        dpId,
        clientId,
        panNumber,
        bankAccountNumber
      } = metadata || {};
      
      // Validate required fields
      if (!ipoCode) {
        throw new Error('IPO code is required for IPO execution');
      }
      
      if (!lotSize && !bids) {
        throw new Error('Lot size or bid details required for IPO execution');
      }
      
      if (!upiId) {
        throw new Error('UPI ID is required for ASBA IPO execution');
      }
      
      // TODO: Integrate with IPO ASBA system (BSE IPO, NSE IPO, Bank ASBA)
      // const ipoService = new IPOApplicationService();
      // const ipoResponse = await ipoService.submitApplication({...});
      
      // For now, simulate placeholder
      const externalOrderId = `IPO-${Date.now()}`;
      
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'pending_manual_processing',
        executionStatus: 'pending',
        metadata: {
          ...metadata,
          pendingReason: 'Awaiting ASBA integration',
          queuedAt: new Date().toISOString()
        },
        notes: 'IPO application pending ASBA integration - requires manual submission',
        actorId: 'system',
        actorType: 'system',
      });
      
      console.log(`[PaymentBridge] IPO order ${orderId} queued (ASBA integration pending)`, {
        ipoName,
        category,
        lotSize
      });
      
      return {
        success: true,
        orderId,
        executionStatus: 'pending',
        message: 'IPO application queued for manual processing (ASBA integration pending)',
        externalOrderId,
      };
      
    } catch (error) {
      console.error(`[PaymentBridge] IPO execution error for order ${orderId}:`, error);
      throw new Error(`IPO execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Execute FD (Fixed Deposit) order (Feature Flagged - Beta)
   * Note: Requires bank FD API integration (ICICI, HDFC, SBI, etc.)
   */
  private async executeFDOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId, userId, amount, metadata } = order;
    
    // Check feature flag
    if (!FEATURE_FLAGS.ENABLE_FD_EXECUTION) {
      console.log(`[PaymentBridge] FD execution disabled (feature flag), queueing for manual processing`);
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'pending_manual_processing',
        notes: 'FD execution is currently in beta. Order queued for manual processing.',
        actorId: 'system',
        actorType: 'system',
      });
      
      return {
        success: true,
        orderId,
        executionStatus: 'pending',
        message: 'FD order queued for manual processing (automated execution in beta)',
      };
    }
    
    try {
      // Update to processing
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'processing',
        executionStatus: 'initiated',
        actorId: 'system',
        actorType: 'system',
      });
      
      // Extract FD-specific metadata
      const {
        bankName,
        fdSchemeCode,
        tenure, // in months
        interestRate,
        maturityAmount,
        payoutMode = 'maturity', // maturity, monthly, quarterly
        nomineeDetails,
        bankAccountNumber,
        panNumber
      } = metadata || {};
      
      // Validate required fields
      if (!bankName) {
        throw new Error('Bank name is required for FD execution');
      }
      
      if (!tenure) {
        throw new Error('FD tenure is required for FD execution');
      }
      
      if (!bankAccountNumber) {
        throw new Error('Bank account number is required for FD execution');
      }
      
      // TODO: Integrate with Bank FD APIs (ICICI, HDFC, SBI, etc.)
      // const fdService = new BankFDService();
      // const fdResponse = await fdService.createFD({...});
      
      // For now, simulate placeholder
      const externalOrderId = `FD-${Date.now()}`;
      
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'pending_manual_processing',
        executionStatus: 'pending',
        metadata: {
          ...metadata,
          pendingReason: 'Awaiting bank FD API integration',
          queuedAt: new Date().toISOString()
        },
        notes: 'FD order pending bank integration - requires manual processing',
        actorId: 'system',
        actorType: 'system',
      });
      
      console.log(`[PaymentBridge] FD order ${orderId} queued (bank integration pending)`, {
        bankName,
        amount,
        tenure
      });
      
      return {
        success: true,
        orderId,
        executionStatus: 'pending',
        message: 'FD order queued for manual processing (bank integration pending)',
        externalOrderId,
      };
      
    } catch (error) {
      console.error(`[PaymentBridge] FD execution error for order ${orderId}:`, error);
      throw new Error(`FD execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Execute Loan application via Loan Processing Service
   * Submits loan application to preferred lender (ICICI, HDFC, Tata Capital, Bajaj Finance)
   */
  private async executeLoanOrder(order: any): Promise<ExecutionResult> {
    const { id: orderId, userId, amount, metadata } = order;
    
    try {
      // Update to processing
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'processing',
        executionStatus: 'initiated',
        actorId: 'system',
        actorType: 'system',
      });
      
      // Extract loan-specific metadata
      const {
        loanType = 'personal',
        tenure,
        purpose,
        employmentType,
        monthlyIncome,
        cibilScore,
        existingLoans,
        collateralValue,
        applicantName,
        applicantEmail,
        applicantPhone,
        applicantPan,
        applicantAddress,
        applicantAge,
        preferredLender
      } = metadata || {};
      
      // Validate required fields
      if (!tenure) {
        throw new Error('Loan tenure is required for loan execution');
      }
      
      if (!applicantPan) {
        throw new Error('Applicant PAN is required for loan execution');
      }
      
      if (!monthlyIncome) {
        throw new Error('Monthly income is required for loan execution');
      }
      
      // Use Loan Processing Service
      const loanService = new LoanProcessingService();
      
      // Build loan application request
      const loanApplication = {
        id: orderId,
        applicantId: userId,
        loanType: loanType as any,
        amount: Number(amount),
        tenure: Number(tenure),
        purpose: purpose || 'Personal use',
        employmentType: employmentType as any || 'salaried',
        monthlyIncome: Number(monthlyIncome),
        cibilScore: cibilScore ? Number(cibilScore) : undefined,
        existingLoans: existingLoans ? Number(existingLoans) : undefined,
        collateralValue: collateralValue ? Number(collateralValue) : undefined,
        applicantDetails: {
          name: applicantName || 'Unknown',
          email: applicantEmail || '',
          phone: applicantPhone || '',
          pan: applicantPan,
          address: applicantAddress || '',
          age: applicantAge ? Number(applicantAge) : 25
        },
        preferredLender: preferredLender as any,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log(`[PaymentBridge] Executing loan order ${orderId} via Loan Processing Service`, {
        loanType,
        amount,
        tenure,
        preferredLender
      });
      
      // Submit loan application
      const loanResponse = await loanService.applyForLoan(loanApplication);
      
      if (loanResponse.success) {
        // Loan application submitted successfully
        const externalOrderId = loanResponse.applicationId || `LOAN-${Date.now()}`;
        
        await orderManagementService.updateOrderStatus({
          orderId,
          status: 'executed',
          executionStatus: 'completed',
          externalOrderId,
          executionPrice: amount,
          metadata: {
            ...metadata,
            loanApplicationId: loanResponse.applicationId,
            loanMessage: loanResponse.message,
            estimatedProcessingDays: loanResponse.estimatedProcessingDays,
            submittedAt: new Date().toISOString(),
            lender: preferredLender || 'auto_selected'
          },
          notes: loanResponse.message,
          actorId: 'system',
          actorType: 'system',
        });
        
        console.log(`[PaymentBridge] Loan order ${orderId} submitted successfully`, {
          externalOrderId,
          applicationId: loanResponse.applicationId,
          estimatedDays: loanResponse.estimatedProcessingDays
        });
        
        return {
          success: true,
          orderId,
          executionStatus: 'completed',
          message: loanResponse.message || 'Loan application submitted successfully',
          externalOrderId,
        };
      } else {
        // Loan application failed
        console.error(`[PaymentBridge] Loan submission failed for order ${orderId}:`, loanResponse.message);
        
        await orderManagementService.updateOrderStatus({
          orderId,
          status: 'execution_failed',
          executionStatus: 'failed',
          metadata: {
            ...metadata,
            loanError: loanResponse.message,
            failedAt: new Date().toISOString()
          },
          notes: loanResponse.message,
          actorId: 'system',
          actorType: 'system',
        });
        
        throw new Error(`Loan submission failed: ${loanResponse.message}`);
      }
      
    } catch (error) {
      console.error(`[PaymentBridge] Loan execution error for order ${orderId}:`, error);
      
      // Log execution error but let caller handle status update
      throw new Error(`Loan execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const paymentExecutionBridge = new PaymentExecutionBridge();
