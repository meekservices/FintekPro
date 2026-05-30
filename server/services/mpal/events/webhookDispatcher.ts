/**
 * MPAL — WebhookDispatcher
 *
 * Purpose : Central entrypoint for all incoming provider webhooks.
 *           Routes to the correct domain handler, then updates the
 *           broker_orders audit table for order status changes.
 *
 * Adding a new broker's webhook:
 *   1. Add `case 'ZERODHA':` pointing to a zerodhaWebhookHandler
 *   2. Update broker_orders row status in the handler
 *   That's it — no other changes needed.
 */

import { logger } from '../../../logger';
import { irisWebhookHandler } from '../../../iris/irisWebhookHandler';
import { alpacaWebhookHandler } from '../../../alpaca/core/alpacaWebhookHandler';

export class WebhookDispatcher {

  /**
   * Central entrypoint for all incoming provider webhooks.
   * Standardizes error handling and routes to the correct domain handler.
   *
   * Inputs  : providerId — must match a registered broker ID (case-insensitive)
   * Outputs : { success: true }
   * Edge cases: Unknown providerId → logs warning, throws for 400 response
   */
  async dispatchEvent(providerId: string, payload: any, headers: Record<string, string> = {}) {
    const start = Date.now();
    logger.info(`[WebhookDispatcher] Received event`, {
      event: 'WEBHOOK_RECEIVED',
      providerId,
      latency_ms: 0,
      status: 'processing',
    });

    try {
      switch (providerId.toUpperCase()) {

        case 'IRIS':
          await irisWebhookHandler.handleWebhook(payload, headers['x-iris-signature']);
          break;

        case 'ALPACA':
          await alpacaWebhookHandler.handleEvent(payload);
          // broker_orders updated by alpacaWebhookHandler internally via order status events
          break;

        case 'IIFL':
          // TODO: Create server/iris/iiflWebhookHandler.ts when IIFL goes live
          // Expected payload shape from IIFL's push notification:
          // { AppOrderID, OrderStatus, FilledQty, AvgFillPrice, ErrorCode, ... }
          logger.info(`[WebhookDispatcher] IIFL webhook received — updating broker_orders`, {
            event: 'IIFL_WEBHOOK',
            appOrderId: payload?.AppOrderID,
            status: payload?.OrderStatus,
          });
          await this.updateBrokerOrderFromWebhook('IIFL', payload?.AppOrderID, {
            status: this.normalizeIIFLStatus(payload?.OrderStatus),
            filledQty: payload?.FilledQty?.toString(),
            filledPrice: payload?.AvgFillPrice?.toString(),
            errorCode: payload?.ErrorCode,
            errorMessage: payload?.ErrorMessage,
          });
          break;

        case 'M2P':
          logger.info(`[WebhookDispatcher] M2P webhook received`, { event: 'M2P_WEBHOOK', payload });
          // TODO: await m2pWebhookHandler.handleEvent(payload);
          break;

        case 'SETU':
          logger.info(`[WebhookDispatcher] Setu webhook received`, { event: 'SETU_WEBHOOK', payload });
          // TODO: await setuWebhookHandler.handleEvent(payload);
          break;

        default:
          logger.warn(`[WebhookDispatcher] Unrecognized provider: ${providerId}`, { event: 'WEBHOOK_UNKNOWN_PROVIDER', providerId });
          throw new Error(`Unrecognized provider: ${providerId}`);
      }

      logger.info(`[WebhookDispatcher] Event processed`, {
        event: 'WEBHOOK_PROCESSED',
        providerId,
        latency_ms: Date.now() - start,
        status: 'success',
      });
      return { success: true };

    } catch (error: any) {
      logger.error(`[WebhookDispatcher] Failed to dispatch event for ${providerId}`, {
        event: 'WEBHOOK_ERROR',
        providerId,
        latency_ms: Date.now() - start,
        status: 'error',
        error_code: error?.error_code ?? 'DISPATCH_FAILED',
        message: error?.message,
        retryable: true,
      });
      throw error;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Updates the broker_orders row for the given broker + brokerOrderId.
   * Safe to call even if the row doesn't exist (IIFL might push before we store).
   */
  private async updateBrokerOrderFromWebhook(
    brokerId: string,
    brokerOrderId: string | undefined,
    update: {
      status?: string;
      filledQty?: string;
      filledPrice?: string;
      errorCode?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    if (!brokerOrderId) return;
    try {
      const { db } = await import('../../../db');
      const { brokerOrders } = await import('../../../../shared/schema/mpal');
      const { eq, and } = await import('drizzle-orm');
      await db.update(brokerOrders)
        .set({
          status: update.status ?? 'submitted',
          brokerOrderId,
          filledQty: update.filledQty,
          filledPrice: update.filledPrice,
          errorCode: update.errorCode,
          errorMessage: update.errorMessage,
          updatedAt: new Date(),
          ...(update.status === 'filled' ? { filledAt: new Date() } : {}),
          ...(update.status === 'cancelled' ? { cancelledAt: new Date() } : {}),
        })
        .where(and(
          eq(brokerOrders.brokerId, brokerId),
          eq(brokerOrders.brokerOrderId, brokerOrderId),
        ));
    } catch (err) {
      logger.warn(`[WebhookDispatcher] Failed to update broker_orders for ${brokerId}/${brokerOrderId}`, err);
    }
  }

  /** Maps IIFL order status strings to MPAL canonical status values */
  private normalizeIIFLStatus(iiflStatus?: string): string {
    const map: Record<string, string> = {
      'Pending': 'pending',
      'Open': 'submitted',
      'Traded': 'filled',
      'PartiallyTraded': 'partially_filled',
      'Rejected': 'rejected',
      'Cancelled': 'cancelled',
      'CancelledAfterMarket': 'cancelled',
    };
    return map[iiflStatus ?? ''] ?? 'submitted';
  }
}

export const webhookDispatcher = new WebhookDispatcher();
