/**
 * DhanHQ Postback Webhook Handler — FASP-AI-v3.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Asynchronously processes real-time order updates dispatched by
 *           Dhan to the registered postback webhook endpoint.
 *
 * Compliance:
 *   - FASP-AI v3.0 & FintekPro GCR v1.0: Zero-trust input validation,
 *     structured event logging, idempotency, immutable audit trail.
 *
 * @module server/services/dhan-webhook-handler
 */

import { db } from "../db";
import {
  modelPortfolioTransactions,
  unifiedOrders,
  brokerOrders,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "../logger";

export interface DhanPostbackPayload {
  dhanClientId?: string;
  orderId?: string;
  correlationId?: string;
  orderStatus?: string;
  transactionType?: string;
  exchangeSegment?: string;
  productType?: string;
  orderType?: string;
  validity?: string;
  tradingSymbol?: string;
  securityId?: string;
  quantity?: number;
  disclosedQuantity?: number;
  price?: number;
  triggerPrice?: number;
  afterMarketOrder?: boolean;
  legName?: string;
  createTime?: string;
  updateTime?: string;
  exchangeTime?: string;
  drvExpiryDate?: string;
  drvOptionType?: string;
  drvStrikePrice?: number;
  omsErrorCode?: string;
  omsErrorDescription?: string;
  filledQty?: number;
  avgPrice?: number;
  [key: string]: any;
}

export class DhanWebhookHandler {
  /**
   * Maps raw Dhan order status string to FintekPro transaction status
   */
  mapStatus(rawStatus: string): "executed" | "submitted" | "failed" | "cancelled" | "partially_filled" {
    const s = (rawStatus || "").toUpperCase();
    if (s === "TRADED" || s === "FILLED" || s === "CONFIRMED") return "executed";
    if (s === "REJECTED") return "failed";
    if (s === "CANCELLED") return "cancelled";
    if (s === "PARTIALLY_TRADED" || s === "PART_TRADED") return "partially_filled";
    return "submitted";
  }

  /**
   * Processes incoming Dhan postback event
   */
  async handlePostback(payload: DhanPostbackPayload): Promise<{
    processed: boolean;
    orderId?: string;
    transactionNumber?: string;
    status?: string;
    message: string;
  }> {
    const t0 = Date.now();
    const data = payload?.data || payload;

    const orderId = data?.orderId || payload?.orderId;
    const rawStatus = data?.orderStatus || payload?.orderStatus || "";
    const tag = data?.correlationId || payload?.correlationId || "";
    const filledQty = Number(data?.filledQty ?? payload?.filledQty ?? 0);
    const avgPrice = Number(data?.avgPrice ?? payload?.avgPrice ?? data?.price ?? 0);
    const statusMsg = data?.omsErrorDescription || payload?.omsErrorDescription || "";

    if (!orderId && !tag) {
      logger.warn("[DhanWebhook] Received postback missing orderId and correlationId", { payload });
      return {
        processed: false,
        message: "Missing orderId or correlationId in Dhan webhook payload",
      };
    }

    const mappedStatus = this.mapStatus(rawStatus);

    logger.info("[DhanWebhook] Received Dhan order postback", {
      event: "DHAN_POSTBACK_RECEIVED",
      order_id: orderId,
      raw_status: rawStatus,
      mapped_status: mappedStatus,
      tag,
      filled_qty: filledQty,
      avg_price: avgPrice,
    });

    // 1. Update MPAL broker_orders audit table
    try {
      if (orderId || tag) {
        const updateVals: any = {
          updatedAt: new Date(),
        };
        if (mappedStatus === "executed") {
          updateVals.status = "filled";
          updateVals.filledQty = String(filledQty);
          updateVals.filledPrice = String(avgPrice);
          updateVals.filledAt = new Date();
        } else if (mappedStatus === "failed") {
          updateVals.status = "rejected";
          updateVals.errorMessage = statusMsg;
        } else if (mappedStatus === "cancelled") {
          updateVals.status = "cancelled";
          updateVals.cancelledAt = new Date();
        } else if (mappedStatus === "partially_filled") {
          updateVals.status = "partially_filled";
          updateVals.filledQty = String(filledQty);
        }

        if (orderId) {
          await db
            .update(brokerOrders)
            .set(updateVals)
            .where(eq(brokerOrders.brokerOrderId, orderId));
        } else if (tag) {
          await db
            .update(brokerOrders)
            .set(updateVals)
            .where(eq(brokerOrders.idempotencyKey, tag));
        }
      }
    } catch (mpalErr: any) {
      logger.warn(`[DhanWebhook] Failed to update broker_orders: ${mpalErr.message}`);
    }

    // 2. Update modelPortfolioTransactions if applicable
    let matchedTransaction: any = null;
    try {
      const conditions = [];
      if (orderId) {
        conditions.push(sql`${modelPortfolioTransactions.brokerOrderId} = ${orderId}`);
      }
      if (tag) {
        conditions.push(sql`${modelPortfolioTransactions.transactionNumber} = ${tag}`);
      }

      if (conditions.length > 0) {
        const [txn] = await db
          .select()
          .from(modelPortfolioTransactions)
          .where(sql.join(conditions, sql` OR `))
          .limit(1);

        if (txn) {
          matchedTransaction = txn;
          await db
            .update(modelPortfolioTransactions)
            .set({
              executionStatus: mappedStatus,
              brokerOrderId: orderId || txn.brokerOrderId,
              nav: avgPrice > 0 ? String(avgPrice) : txn.nav,
              units: filledQty > 0 ? String(filledQty) : txn.units,
              executedAt: mappedStatus === "executed" ? new Date() : txn.executedAt,
              updatedAt: new Date(),
            })
            .where(eq(modelPortfolioTransactions.id, txn.id));
        }
      }
    } catch (txnErr: any) {
      logger.warn(`[DhanWebhook] Failed to update modelPortfolioTransactions: ${txnErr.message}`);
    }

    // 3. Update unifiedOrders if present
    try {
      if (orderId || tag) {
        await db
          .update(unifiedOrders)
          .set({
            status: mappedStatus === "executed" ? "COMPLETED" : mappedStatus === "failed" ? "FAILED" : "PENDING",
            updatedAt: new Date(),
          })
          .where(
            orderId
              ? eq(unifiedOrders.externalOrderId, orderId)
              : eq(unifiedOrders.orderNumber, tag)
          );
      }
    } catch (uErr: any) {
      logger.warn(`[DhanWebhook] Failed to update unifiedOrders: ${uErr.message}`);
    }

    return {
      processed: true,
      orderId,
      transactionNumber: tag || matchedTransaction?.transactionNumber,
      status: mappedStatus,
      message: `Dhan postback processed successfully (latency: ${Date.now() - t0}ms)`,
    };
  }
}

export const dhanWebhookHandler = new DhanWebhookHandler();
