import crypto from 'crypto';
import { logger } from '../../../logger';
import { db } from '../../../db';
import { alpacaOrders } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';

// ─── HMAC Verification ──────────────────────────────────────────────────────
/**
 * Verifies the Alpaca webhook HMAC-SHA256 signature.
 *
 * Alpaca signs the raw request body with the webhook secret using HMAC-SHA256
 * and sends the hex digest in the `apca-signature` header.
 *
 * @param rawBody   - The raw request body buffer (must be captured before JSON parsing)
 * @param signature - Value of the `apca-signature` header from Alpaca
 * @returns true if the signature is valid, false otherwise
 */
export function verifyAlpacaWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const secret = process.env.ALPACA_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('[AlpacaWebhook] ALPACA_WEBHOOK_SECRET not set — skipping HMAC verification (INSECURE)');
    return true; // Degrade gracefully in dev; enforce in prod via startup check
  }
  if (!signature) {
    logger.warn('[AlpacaWebhook] Missing apca-signature header');
    return false;
  }
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    const expected = hmac.digest('hex');
    // Use timingSafeEqual to prevent timing attacks
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch (err: any) {
    logger.error('[AlpacaWebhook] HMAC verification error', { error: err.message });
    return false;
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

export class AlpacaWebhookHandler {

  /**
   * Process an Alpaca broker event payload.
   *
   * @param payload  - Parsed JSON body from Alpaca
   * @param rawBody  - Raw Buffer for HMAC signature verification
   * @param signature - Value of apca-signature header
   */
  async handleEvent(payload: unknown, rawBody?: Buffer, signature?: string): Promise<void> {
    // ── Signature verification ──────────────────────────────────────────────
    if (rawBody && signature !== undefined) {
      const valid = verifyAlpacaWebhookSignature(rawBody, signature);
      if (!valid) {
        logger.warn('[AlpacaWebhook] Invalid HMAC signature — rejecting event');
        throw new Error('Invalid Alpaca webhook signature');
      }
    }

    const eventData = payload as Record<string, unknown>;
    const eventType = eventData?.event as string;

    logger.info(`[AlpacaWebhook] Received event: ${eventType}`, {
      event: eventType,
      user_id: (eventData?.data as any)?.account_id,
      status: 'received',
    });

    switch (eventType) {
      case 'trade_updates':
        await this.handleTradeUpdate(eventData.data as Record<string, unknown>);
        break;
      case 'account_updates':
        await this.handleAccountUpdate(eventData.data as Record<string, unknown>);
        break;
      case 'journal_status':
        await this.handleJournalUpdate(eventData.data as Record<string, unknown>);
        break;
      default:
        logger.warn(`[AlpacaWebhook] Unhandled event type: ${eventType}`, {
          event: 'ALPACA_WEBHOOK_UNHANDLED',
          eventType,
          status: 'unhandled',
        });
    }
  }

  /**
   * Handles trade_updates events — updates order status in alpaca_orders table.
   * Event types: fill, partial_fill, canceled, pending_new, new, etc.
   */
  private async handleTradeUpdate(data: Record<string, unknown>): Promise<void> {
    const order = data?.order as Record<string, unknown> | undefined;
    const orderEvent = data?.event as string;
    const orderId = order?.id as string | undefined;

    logger.info('[AlpacaWebhook] Trade Update', {
      event: 'ALPACA_TRADE_UPDATE',
      order_id: orderId,
      order_event: orderEvent,
      status: order?.status,
      latency_ms: 0,
    });

    if (!orderId) return;

    try {
      // Update the order status in our DB if the order exists
      const existingOrders = await db
        .select()
        .from(alpacaOrders)
        .where(eq(alpacaOrders.providerOrderId, orderId))
        .limit(1);

      if (existingOrders.length > 0) {
        await db
          .update(alpacaOrders)
          .set({
            status: (order?.status as string) ?? existingOrders[0].status,
            filledQty: (order?.filled_qty as string) ?? existingOrders[0].filledQty,
            filledAvgPrice: (order?.filled_avg_price as string) ?? existingOrders[0].filledAvgPrice,
            updatedAt: new Date(),
          })
          .where(eq(alpacaOrders.providerOrderId, orderId));

        logger.info('[AlpacaWebhook] Order status updated in DB', {
          event: 'ALPACA_ORDER_DB_UPDATED',
          order_id: orderId,
          new_status: order?.status,
          status: 'success',
          latency_ms: 0,
        });
      }
    } catch (err: any) {
      logger.error('[AlpacaWebhook] Failed to update order in DB', {
        event: 'ALPACA_ORDER_DB_ERROR',
        order_id: orderId,
        error: err.message,
        retryable: true,
        status: 'error',
      });
    }
  }

  /**
   * Handles account_updates events — KYC status changes, account approval, etc.
   */
  private async handleAccountUpdate(data: Record<string, unknown>): Promise<void> {
    const accountId = data?.id as string | undefined;
    const status = data?.status as string | undefined;

    logger.info('[AlpacaWebhook] Account Update', {
      event: 'ALPACA_ACCOUNT_UPDATE',
      alpaca_account_id: accountId,
      account_status: status,
      status: 'received',
      latency_ms: 0,
    });
    // Future: update users.alpaca_status in DB, trigger KYC completion notification
  }

  /**
   * Handles journal_status events — ACH transfer / funding status changes.
   */
  private async handleJournalUpdate(data: Record<string, unknown>): Promise<void> {
    const journalId = data?.id as string | undefined;
    const journalStatus = data?.status as string | undefined;

    logger.info('[AlpacaWebhook] Journal Update', {
      event: 'ALPACA_JOURNAL_UPDATE',
      journal_id: journalId,
      journal_status: journalStatus,
      status: 'received',
      latency_ms: 0,
    });
    // Future: update transfer records in DB, notify user of deposit/withdrawal status
  }
}

export const alpacaWebhookHandler = new AlpacaWebhookHandler();
