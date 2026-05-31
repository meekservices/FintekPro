// @ts-nocheck
import { Express } from 'express';
import { storage } from '../../storage';
import { cashfreeService } from '../../cashfree-service';
import { phonePeService } from '../../phonepe-service';
import { complianceMonitor } from '../../compliance-monitor';
import { clientMoneySegregationService } from '../../services/client-money-segregation-service';
import { dailyReconciliationService } from '../../services/daily-reconciliation-service';
import { registerFemaComplianceRoutes } from '../fema-compliance';
import { unifiedPaymentGateway } from '../../services/unified-payment-gateway';

export function registerPaymentPart1Routes(app: Express): void {
  // ==================== UNIFIED PAYMENT GATEWAY ROUTES ====================

  app.post('/api/payments/create-order', async (req, res) => {
    const idempotencyKey = (req.headers['x-idempotency-key'] as string | undefined)?.trim();
    // Track whether we hold the pending lock AND whether the gateway already created an order.
    // CRITICAL: once gatewayOrderCreated=true, we must NEVER release the lock — doing so would
    // allow a retry with the same idempotency key to trigger a second charge.
    let idempotencyLockHeld = false;
    let gatewayOrderCreated = false;
    let userId: string | undefined;

    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const { amount, phone, email, name, returnUrl } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }

      const user = await storage.getUser((req.user as any)!.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      userId = user.id;

      if (idempotencyKey) {
        const { locked, cached } = await unifiedPaymentGateway.acquireIdempotencyLock(
          idempotencyKey,
          user.id,
        );

        if (!locked) {
          if (cached) {
            return res.json({ ...cached, idempotent: true });
          }
          return res.status(409).json({
            message: 'A request with this idempotency key is already in progress. Please retry shortly.',
          });
        }
        idempotencyLockHeld = true;
      }

      const orderResponse = await unifiedPaymentGateway.createOrder({
        amount,
        userId: user.id,
        phone: phone || user.mobile || '9999999999',
        email: email || user.email || `${user.id}@example.com`,
        name: name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer',
        returnUrl,
      });

      if (orderResponse.success) {
        // Gateway has created the order — mark this immediately so the catch block
        // knows NOT to release the lock (to prevent duplicate-charge on retry).
        gatewayOrderCreated = true;
      }

      if (!orderResponse.success) {
        // Gateway rejected or failed before creating an order — safe to release the lock
        // so the user can retry with the same idempotency key.
        if (idempotencyKey && idempotencyLockHeld) {
          await unifiedPaymentGateway.releaseIdempotencyLock(idempotencyKey, user.id);
          idempotencyLockHeld = false;
        }
        complianceMonitor.logEvent({
          eventType: 'transaction' as any,
          action: 'create_unified_order',
          outcome: 'failure',
          riskLevel: 'high',
          error: orderResponse.message,
          userId: user.id,
        });
        return res.status(400).json({ message: orderResponse.message || 'Order creation failed' });
      }

      if (idempotencyKey && orderResponse.orderId) {
        // Persist the completed response — if this fails, the lock stays as pending.
        // The user will get a 500 but retrying the same key returns 409 ("in progress"),
        // preventing a duplicate charge. They should check order status separately.
        await unifiedPaymentGateway.finaliseIdempotencyKey(
          idempotencyKey,
          user.id,
          orderResponse.orderId,
          orderResponse.gateway,
          orderResponse,
        );
        idempotencyLockHeld = false;
      }

      complianceMonitor.logEvent({
        eventType: 'transaction' as any,
        action: 'create_unified_order',
        resource: orderResponse.orderId,
        outcome: 'success',
        riskLevel: 'medium',
        userId: user.id,
        metadata: { gateway: orderResponse.gateway, fallbackUsed: orderResponse.fallbackUsed },
      });

      res.json({
        success: true,
        orderId: orderResponse.orderId,
        paymentSessionId: orderResponse.paymentSessionId,
        paymentUrl: orderResponse.paymentUrl,
        gateway: orderResponse.gateway,
        fallbackUsed: orderResponse.fallbackUsed,
        message: orderResponse.message,
      });

    } catch (error) {
      // Only release the lock if no gateway order was created yet.
      // If gatewayOrderCreated=true, keep the lock (pending) to block retries
      // from creating a duplicate charge. The user should check order status.
      if (idempotencyKey && idempotencyLockHeld && !gatewayOrderCreated && userId) {
        unifiedPaymentGateway.releaseIdempotencyLock(idempotencyKey, userId).catch(() => {});
      }
      console.error('Error creating unified order:', error);
      res.status(500).json({ message: 'Failed to create order' });
    }
  });

  app.get('/api/payments/gateway-health', async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const health = await unifiedPaymentGateway.getGatewayHealth();

      res.json({ success: true, ...health });
    } catch (error) {
      console.error('Error checking gateway health:', error);
      res.status(500).json({ message: 'Failed to check gateway health' });
    }
  });

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

      const user = await storage.getUser((req.user as any)!.id);
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
          error: (orderResponse as any).error
        });
      }

      const transaction = await storage.createCashfreeTransaction({
        userId: user.id,
        orderId: orderResponse.orderId,
        cashfreeOrderId: (orderResponse as any).cashfreeOrderId as any,
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
        eventType: 'transaction' as any,
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
        eventType: 'transaction' as any,
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

      if (transaction.userId !== (req.user as any)!.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const statusResult = await cashfreeService.getOrderStatus(orderId);

      if (statusResult) {
        await storage.updateCashfreeTransaction(transaction.id, {
          status: statusResult.orderStatus,
          cashfreeOrderId: statusResult.transactionId || (transaction as any).cashfreeOrderId as any,
          paymentMethod: statusResult.paymentMethod,
          completedAt: statusResult.orderStatus === 'PAID' ? new Date() : undefined
        });
      }

      complianceMonitor.logEvent({
        eventType: 'transaction' as any,
        action: 'check_cashfree_status',
        resource: orderId,
        outcome: 'success',
        riskLevel: 'low',
        userId: (req.user as any)!.id
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
      const signature = req.headers['x-webhook-signature'] as string;
      const timestamp = req.headers['x-webhook-timestamp'] as string;
      
      const rawBody = Buffer.isBuffer(req.body) 
        ? req.body.toString('utf8') 
        : typeof req.body === 'string' 
          ? req.body 
          : JSON.stringify(req.body);

      if (!signature || !timestamp) {
        console.error('⚠️ Cashfree webhook missing signature headers');
        complianceMonitor.logEvent({
          eventType: 'security',
          action: 'cashfree_webhook_signature_missing',
          outcome: 'failure',
          riskLevel: 'critical',
          metadata: { headers: Object.keys(req.headers) }
        });
        return res.status(401).json({ message: 'Missing webhook signature' });
      }

      const isValidSignature = cashfreeService.verifyWebhookSignature(signature, rawBody, timestamp);
      if (!isValidSignature) {
        console.error('⚠️ Cashfree webhook signature verification FAILED - potential spoofing attempt');
        complianceMonitor.logEvent({
          eventType: 'security',
          action: 'cashfree_webhook_signature_invalid',
          outcome: 'failure',
          riskLevel: 'critical',
          metadata: { timestamp, signaturePresent: !!signature }
        });
        return res.status(401).json({ message: 'Invalid webhook signature' });
      }

      console.log('✅ Cashfree webhook signature verified successfully');

      let body: any;
      try {
        body = JSON.parse(rawBody);
      } catch (parseError) {
        console.error('⚠️ Cashfree webhook body parse error:', parseError);
        complianceMonitor.logEvent({
          eventType: 'security',
          action: 'cashfree_webhook_malformed_body',
          outcome: 'failure',
          riskLevel: 'medium'
        });
        return res.status(400).json({ message: 'Malformed webhook body' });
      }
      const { order_id, order_status, cf_order_id, payment_method } = body;

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
        eventType: 'transaction' as any,
        action: 'cashfree_webhook',
        resource: order_id,
        outcome: 'success',
        riskLevel: 'low',
        metadata: { signatureVerified: true }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error processing Cashfree webhook:', error);
      res.status(500).json({ message: 'Webhook processing failed' });
    }
  });

  app.post('/api/payments/phonepe/callback', async (req, res) => {
    try {
      const { response: base64Response, checksum } = req.body;
      
      if (!base64Response || !checksum) {
        console.error('⚠️ PhonePe callback missing response or checksum');
        complianceMonitor.logEvent({
          eventType: 'security',
          action: 'phonepe_callback_data_missing',
          outcome: 'failure',
          riskLevel: 'critical'
        });
        return res.status(400).json({ message: 'Missing callback data' });
      }

      const isValidSignature = phonePeService.verifyCallback(base64Response, checksum);
      if (!isValidSignature) {
        console.error('⚠️ PhonePe callback signature verification FAILED - potential spoofing attempt');
        complianceMonitor.logEvent({
          eventType: 'security',
          action: 'phonepe_callback_signature_invalid',
          outcome: 'failure',
          riskLevel: 'critical'
        });
        return res.status(401).json({ message: 'Invalid callback signature' });
      }

      console.log('✅ PhonePe callback signature verified successfully');

      const decodedResponse = JSON.parse(Buffer.from(base64Response, 'base64').toString('utf8'));
      const { merchantTransactionId, transactionId, state, responseCode, paymentInstrument } = decodedResponse.data || {};

      if (!merchantTransactionId) {
        return res.status(400).json({ message: 'Missing merchantTransactionId' });
      }

      const transaction = await storage.getPhonePeTransactionByMerchantId(merchantTransactionId);
      if (transaction) {
        await storage.updatePhonePeTransaction(transaction.id, {
          transactionId: transactionId,
          state: state,
          responseCode: responseCode,
          status: state === 'COMPLETED' ? 'success' : state === 'FAILED' ? 'failed' : 'pending',
          paymentMethod: paymentInstrument?.type,
          completedAt: state === 'COMPLETED' ? new Date() : undefined
        });
      }

      complianceMonitor.logEvent({
        eventType: 'transaction' as any,
        action: 'phonepe_callback',
        resource: merchantTransactionId,
        outcome: 'success',
        riskLevel: 'low',
        metadata: { signatureVerified: true, state }
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error processing PhonePe callback:', error);
      res.status(500).json({ message: 'Callback processing failed' });
    }
  });

  app.get('/api/cashfree/transactions', async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const transactions = await storage.getCashfreeTransactionsByUserId((req.user as any)!.id);

      complianceMonitor.logEvent({
        eventType: 'data_access',
        action: 'list_cashfree_transactions',
        outcome: 'success',
        riskLevel: 'low',
        userId: (req.user as any)!.id
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

      const user = await storage.getUser((req.user as any)!.id);
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
        eventType: 'transaction' as any,
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
        eventType: 'transaction' as any,
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

      if (transaction.userId !== (req.user as any)!.id) {
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
        eventType: 'transaction' as any,
        action: 'check_phonepe_status',
        resource: orderId,
        outcome: 'success',
        riskLevel: 'low',
        userId: (req.user as any)!.id
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

}
