/**
 * Upstox Postback Webhook Handler — FASP-AI-v3.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Asynchronously processes real-time order updates dispatched by
 *           Upstox to the registered postback webhook endpoint.
 *
 * Compliance:
 *   - FASP-AI v3.0 & FintekPro GCR v1.0: Zero-trust input validation,
 *     structured event logging, idempotency, immutable audit trail.
 */

import { db } from "../db";
import {
  modelPortfolioTransactions,
  unifiedOrders,
  orderLifecycleEvents,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "../logger";

export interface UpstoxPostbackPayload {
  order_id?: string;
  orderId?: string;
  status?: string;
  filled_quantity?: number;
  filledQuantity?: number;
  average_price?: number;
  averagePrice?: number;
  quantity?: number;
  price?: number;
  transaction_type?: string;
  symbol?: string;
  instrument_token?: string;
  tag?: string;
  status_message?: string;
  order_timestamp?: string;
  data?: any;
}

export class UpstoxWebhookHandler {
  /**
   * Maps raw Upstox order status string to FintekPro transaction status
   */
  mapStatus(rawStatus: string): "executed" | "submitted" | "failed" | "cancelled" | "partially_filled" {
    const s = (rawStatus || "").toLowerCase();
    if (s === "complete") return "executed";
    if (s === "rejected") return "failed";
    if (s === "cancelled") return "cancelled";
    if (s.includes("partially")) return "partially_filled";
    return "submitted";
  }

  /**
   * Processes incoming Upstox postback event
   */
  async handlePostback(payload: UpstoxPostbackPayload): Promise<{
    processed: boolean;
    orderId?: string;
    transactionNumber?: string;
    status?: string;
    message: string;
  }> {
    const t0 = Date.now();
    const data = payload?.data || payload;

    const orderId = data?.order_id || data?.orderId || payload?.order_id;
    const rawStatus = data?.status || payload?.status || "";
    const tag = data?.tag || payload?.tag || "";
    const filledQty = Number(data?.filled_quantity ?? data?.filledQuantity ?? payload?.filled_quantity ?? 0);
    const avgPrice = Number(data?.average_price ?? data?.averagePrice ?? payload?.average_price ?? 0);
    const statusMsg = data?.status_message || payload?.status_message || "";

    if (!orderId && !tag) {
      logger.warn("[UpstoxWebhook] Received postback missing order_id and tag", { payload });
      return {
        processed: false,
        message: "Missing order_id or tag in webhook payload",
      };
    }

    const mappedStatus = this.mapStatus(rawStatus);

    logger.info("[UpstoxWebhook] Received order postback", {
      event: "UPSTOX_POSTBACK_RECEIVED",
      order_id: orderId,
      raw_status: rawStatus,
      mapped_status: mappedStatus,
      tag,
      filled_qty: filledQty,
      avg_price: avgPrice,
    });

    // 1. Locate matching modelPortfolioTransactions
    // Match by brokerOrderId, tag (which can be transactionNumber or idempotencyKey), or factorsConsidered
    const conditions = [];
    if (orderId) {
      conditions.push(sql`${modelPortfolioTransactions.brokerOrderId} = ${orderId}`);
      conditions.push(sql`${modelPortfolioTransactions.factorsConsidered}->>'brokerOrderId' = ${orderId}`);
    }
    if (tag) {
      conditions.push(sql`${modelPortfolioTransactions.transactionNumber} = ${tag}`);
      conditions.push(sql`${modelPortfolioTransactions.idempotencyKey} = ${tag}`);
    }

    const [tx] = await db
      .select()
      .from(modelPortfolioTransactions)
      .where(sql.join(conditions, sql` OR `))
      .limit(1);

    if (!tx) {
      logger.info("[UpstoxWebhook] No matching model_portfolio_transaction for postback", {
        orderId,
        tag,
      });
      return {
        processed: false,
        orderId,
        status: mappedStatus,
        message: "No matching internal transaction found for this postback.",
      };
    }

    const previousStatus = tx.executionStatus;

    // 2. Update modelPortfolioTransactions
    const updatePayload: Record<string, any> = {
      executionStatus: mappedStatus === "partially_filled" ? "submitted" : mappedStatus,
      brokerOrderId: orderId || tx.brokerOrderId,
      updatedAt: new Date(),
    };

    if (filledQty > 0) {
      updatePayload.units = filledQty.toFixed(4);
    }
    if (avgPrice > 0) {
      updatePayload.nav = avgPrice.toFixed(4);
    }
    if (filledQty > 0 && avgPrice > 0) {
      updatePayload.amount = (filledQty * avgPrice).toFixed(2);
    }

    await db
      .update(modelPortfolioTransactions)
      .set(updatePayload)
      .where(eq(modelPortfolioTransactions.id, tx.id));

    // 3. Update unifiedOrders and lifecycle events if linked
    if (tx.unifiedOrderId) {
      try {
        const unifiedStatus =
          mappedStatus === "executed"
            ? "executed"
            : mappedStatus === "failed"
            ? "failed"
            : mappedStatus === "cancelled"
            ? "cancelled"
            : "pending";

        await db
          .update(unifiedOrders)
          .set({
            status: unifiedStatus,
            executionStatus: mappedStatus,
            ...(avgPrice > 0 ? { executionPrice: avgPrice.toFixed(6) } : {}),
            ...(filledQty > 0 ? { executedQuantity: filledQty.toFixed(4) } : {}),
            updatedAt: new Date(),
          })
          .where(eq(unifiedOrders.id, tx.unifiedOrderId));

        if (previousStatus !== mappedStatus) {
          await db.insert(orderLifecycleEvents).values({
            orderId: tx.unifiedOrderId,
            eventType: `UPSTOX_WEBHOOK_${mappedStatus.toUpperCase()}`,
            eventName: `Upstox Webhook: ${mappedStatus.toUpperCase()}`,
            eventDescription: `Order ${orderId} status updated via Upstox postback to ${mappedStatus}. Filled: ${filledQty} shares at ₹${avgPrice}. ${statusMsg}`,
            newState: { status: mappedStatus, filledQty, avgPrice, orderId, rawStatus },
            actorId: "upstox_webhook",
            actorType: "webhook",
            isSystemGenerated: true,
          });
        }
      } catch (uniErr: any) {
        logger.warn(`[UpstoxWebhook] Error updating unified order for tx ${tx.transactionNumber}`, {
          error: uniErr.message,
        });
      }
    }

    logger.info("[UpstoxWebhook] Successfully processed postback", {
      event: "UPSTOX_POSTBACK_PROCESSED",
      transaction_number: tx.transactionNumber,
      order_id: orderId,
      previous_status: previousStatus,
      new_status: mappedStatus,
      latency_ms: Date.now() - t0,
    });

    return {
      processed: true,
      orderId,
      transactionNumber: tx.transactionNumber,
      status: mappedStatus,
      message: `Transaction ${tx.transactionNumber} updated to ${mappedStatus}`,
    };
  }
}

export const upstoxWebhookHandler = new UpstoxWebhookHandler();
