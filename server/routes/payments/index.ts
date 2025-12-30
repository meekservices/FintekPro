import { Express } from 'express';
import { storage } from '../../storage';
import { cashfreeService } from '../../cashfree-service';
import { phonePeService } from '../../phonepe-service';
import { complianceMonitor } from '../../compliance-monitor';

export function registerPaymentRoutes(app: Express): void {
  // ==================== CASHFREE PAYMENT GATEWAY ROUTES ====================
  
  app.post('/api/payments/cashfree/create-order', async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { amount, cartId, itemType, itemId, phone, email, name } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const orderResponse = await cashfreeService.createOrder({
        amount,
        userId: user.id,
        phone: phone || user.mobile || '9999999999',
        email: email || user.email || `${user.id}@example.com`,
        name: name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer'
      });

      if (!orderResponse.success) {
        return res.status(400).json({ 
          message: orderResponse.message || 'Order creation failed',
          error: orderResponse.error
        });
      }

      const transaction = await storage.createCashfreeTransaction({
        userId: user.id,
        orderId: orderResponse.orderId,
        cashfreeOrderId: orderResponse.cashfreeOrderId,
        paymentSessionId: orderResponse.paymentSessionId,
        amount: amount.toString(),
        status: 'ACTIVE',
        paymentUrl: orderResponse.paymentUrl,
        cartId,
        itemType,
        itemId,
        customerName: name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer',
        customerEmail: email || user.email,
        customerPhone: phone || user.mobile
      });

      complianceMonitor.logEvent({
        eventType: 'payment',
        action: 'create_cashfree_order',
        resource: orderResponse.orderId,
        outcome: 'success',
        riskLevel: 'medium',
        userId: user.id
      });

      res.json({
        success: true,
        orderId: orderResponse.orderId,
        paymentSessionId: orderResponse.paymentSessionId,
        paymentUrl: orderResponse.paymentUrl,
        message: orderResponse.message
      });

    } catch (error) {
      console.error('Error creating Cashfree order:', error);
      complianceMonitor.logEvent({
        eventType: 'payment',
        action: 'create_cashfree_order',
        outcome: 'failure',
        riskLevel: 'high',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({ message: 'Failed to create order' });
    }
  });

  app.get('/api/payments/cashfree/status/:orderId', async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { orderId } = req.params;

      const transaction = await storage.getCashfreeTransaction(orderId);
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      if (transaction.userId !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const statusResult = await cashfreeService.getOrderStatus(orderId);

      if (statusResult) {
        await storage.updateCashfreeTransaction(transaction.id, {
          status: statusResult.orderStatus,
          cashfreeOrderId: statusResult.transactionId || transaction.cashfreeOrderId,
          paymentMethod: statusResult.paymentMethod,
          completedAt: statusResult.orderStatus === 'PAID' ? new Date() : undefined
        });
      }

      complianceMonitor.logEvent({
        eventType: 'payment',
        action: 'check_cashfree_status',
        resource: orderId,
        outcome: 'success',
        riskLevel: 'low',
        userId: req.user.id
      });

      res.json({
        success: !!statusResult,
        status: statusResult?.orderStatus,
        transactionId: statusResult?.transactionId,
        paymentMethod: statusResult?.paymentMethod
      });

    } catch (error) {
      console.error('Error checking Cashfree status:', error);
      res.status(500).json({ message: 'Failed to check status' });
    }
  });

  app.post('/api/payments/cashfree/webhook', async (req, res) => {
    try {
      const { order_id, order_status, cf_order_id, payment_method } = req.body;

      if (!order_id) {
        return res.status(400).json({ message: 'Missing order_id' });
      }

      const transaction = await storage.getCashfreeTransaction(order_id);
      if (transaction) {
        await storage.updateCashfreeTransaction(transaction.id, {
          status: order_status,
          cashfreeOrderId: cf_order_id,
          paymentMethod: payment_method,
          completedAt: order_status === 'PAID' ? new Date() : undefined
        });
      }

      complianceMonitor.logEvent({
        eventType: 'payment',
        action: 'cashfree_webhook',
        resource: order_id,
        outcome: 'success',
        riskLevel: 'low'
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error processing Cashfree webhook:', error);
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  app.get('/api/cashfree/transactions', async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const transactions = await storage.getCashfreeTransactionsByUserId(req.user.id);

      complianceMonitor.logEvent({
        eventType: 'data_access',
        action: 'list_cashfree_transactions',
        outcome: 'success',
        riskLevel: 'low',
        userId: req.user.id
      });

      res.json(transactions);

    } catch (error) {
      console.error('Error fetching Cashfree transactions:', error);
      res.status(500).json({ message: 'Failed to fetch transactions' });
    }
  });

  // ==================== PHONEPE PAYMENT GATEWAY ROUTES ====================
  
  app.post('/api/payments/phonepe/create-order', async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { amount, cartId, itemType, itemId, phone, email, name } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const orderResponse = await phonePeService.createOrder({
        amount,
        userId: user.id,
        phone: phone || user.mobile || '9999999999',
        email: email || user.email || `${user.id}@example.com`,
        name: name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer'
      });

      if (!orderResponse.success) {
        return res.status(400).json({
          message: orderResponse.message || 'Order creation failed'
        });
      }

      const transaction = await storage.createPhonePeTransaction({
        userId: user.id,
        orderId: orderResponse.orderId!,
        merchantTransactionId: orderResponse.merchantTransactionId!,
        amount: amount.toString(),
        status: 'initiated',
        state: 'PENDING',
        paymentUrl: orderResponse.paymentUrl,
        cartId,
        itemType,
        itemId,
        customerName: name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        customerEmail: email || user.email,
        customerPhone: phone || user.mobile
      });

      complianceMonitor.logEvent({
        eventType: 'payment',
        action: 'create_phonepe_order',
        resource: orderResponse.orderId!,
        outcome: 'success',
        riskLevel: 'medium',
        userId: user.id
      });

      res.json({
        success: true,
        orderId: orderResponse.orderId,
        merchantTransactionId: orderResponse.merchantTransactionId,
        transactionId: transaction.id,
        paymentUrl: orderResponse.paymentUrl,
        message: orderResponse.message
      });

    } catch (error) {
      console.error('Error creating PhonePe order:', error);
      complianceMonitor.logEvent({
        eventType: 'payment',
        action: 'create_phonepe_order',
        outcome: 'failure',
        riskLevel: 'high',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({ message: 'Failed to create order' });
    }
  });

  app.get('/api/payments/phonepe/status/:orderId', async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { orderId } = req.params;

      const transaction = await storage.getPhonePeTransactionByOrderId(orderId);
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      if (transaction.userId !== req.user.id) {
        return res.status(403).json({ message: 'Unauthorized access' });
      }

      const status = await phonePeService.checkOrderStatus(transaction.merchantTransactionId);

      if (status) {
        await storage.updatePhonePeTransaction(transaction.id, {
          transactionId: status.transactionId,
          state: status.state,
          responseCode: status.responseCode,
          status: status.state === 'COMPLETED' ? 'success' : status.state === 'FAILED' ? 'failed' : 'pending',
          paymentMethod: status.paymentInstrument?.type,
          completedAt: status.state === 'COMPLETED' ? new Date() : undefined
        });
      }

      complianceMonitor.logEvent({
        eventType: 'payment',
        action: 'check_phonepe_status',
        resource: orderId,
        outcome: 'success',
        riskLevel: 'low',
        userId: req.user.id
      });

      res.json({
        success: true,
        status: status?.state,
        transactionId: status?.transactionId,
        responseCode: status?.responseCode
      });

    } catch (error) {
      console.error('Error checking PhonePe status:', error);
      res.status(500).json({ message: 'Failed to check status' });
    }
  });

  app.get('/api/phonepe/transactions', async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const transactions = await storage.getPhonePeTransactionsByUserId(req.user.id);

      complianceMonitor.logEvent({
        eventType: 'data_access',
        action: 'list_phonepe_transactions',
        outcome: 'success',
        riskLevel: 'low',
        userId: req.user.id
      });

      res.json(transactions);

    } catch (error) {
      console.error('Error fetching PhonePe transactions:', error);
      res.status(500).json({ message: 'Failed to fetch transactions' });
    }
  });

  console.log("✅ Payment gateway routes registered (Cashfree, PhonePe)");
}
