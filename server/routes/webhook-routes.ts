import { Router } from 'express';
import { logger } from '../logger';
import { irisWebhookHandler } from '../services/iris/irisWebhookHandler';
import { alpacaWebhookHandler } from '../services/alpaca/core/alpacaWebhookHandler';

const router = Router();

router.post('/iris', async (req, res) => {
  try {
    const payload = req.body;
    const signature = req.headers['x-iris-signature'] as string; // Adjust header based on actual IRIS docs

    logger.info('[Webhook] Received IRIS webhook', { eventType: payload?.eventType });

    await irisWebhookHandler.handleWebhook(payload, signature);

    res.status(200).json({ success: true, message: 'Webhook processed successfully' });
  } catch (error: any) {
    logger.error('[Webhook] Failed to process IRIS webhook', { error: error.message });
    // Still return 200 to prevent retries if it's a validation error, 
    // or return 500 if we want IRIS to retry.
    if (error.message.includes('signature')) {
       res.status(401).json({ success: false, message: 'Invalid signature' });
    } else {
       res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
});

router.post('/alpaca', async (req, res) => {
  try {
    const payload = req.body;
    
    // Alpaca uses HMAC signature in headers (e.g. 'Apca-Signature')
    // Ensure you validate the signature in a production environment
    const signature = req.headers['apca-signature'] as string;

    logger.info('[Webhook] Received Alpaca webhook', { event: payload?.event });

    await alpacaWebhookHandler.handleEvent(payload);

    res.status(200).json({ success: true, message: 'Alpaca webhook processed successfully' });
  } catch (error: any) {
    logger.error('[Webhook] Failed to process Alpaca webhook', { error: error.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export const webhookRoutes = router;
