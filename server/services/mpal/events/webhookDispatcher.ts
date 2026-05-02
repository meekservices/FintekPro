import { logger } from '../../../../logger';
import { irisWebhookHandler } from '../../../iris/irisWebhookHandler';
import { alpacaWebhookHandler } from '../../../alpaca/core/alpacaWebhookHandler';
// Import credit webhook handlers when built (e.g. m2pWebhookHandler)

export class WebhookDispatcher {
  
  /**
   * Central entrypoint for all incoming provider webhooks.
   * Standardizes error handling and routes to the correct domain handler.
   */
  async dispatchEvent(providerId: string, payload: any, headers?: any) {
    logger.info(`[WebhookDispatcher] Received event for provider: ${providerId}`);

    try {
      switch (providerId.toUpperCase()) {
        case 'IRIS':
          // Re-routing to legacy IRIS handler
          await irisWebhookHandler.handleWebhook(payload, headers['x-iris-signature']);
          break;
        
        case 'ALPACA':
          // Re-routing to legacy Alpaca handler
          await alpacaWebhookHandler.handleEvent(payload);
          break;

        case 'M2P':
          logger.info(`[WebhookDispatcher] Routed to M2P handler`, payload);
          // await m2pWebhookHandler.handleEvent(payload);
          break;

        case 'SETU':
          logger.info(`[WebhookDispatcher] Routed to Setu handler`, payload);
          // await setuWebhookHandler.handleEvent(payload);
          break;

        default:
          logger.warn(`[WebhookDispatcher] Unrecognized provider: ${providerId}`);
          throw new Error(`Unrecognized provider: ${providerId}`);
      }
      
      return { success: true };
    } catch (error: any) {
      logger.error(`[WebhookDispatcher] Failed to dispatch event for ${providerId}`, error);
      throw error;
    }
  }
}

export const webhookDispatcher = new WebhookDispatcher();
