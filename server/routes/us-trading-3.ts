import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { users, kycVault, usLrsDeclarations } from "@shared/schema";
import { usTradingService } from "../services/us-trading-service";
import { alpacaMarketDataService } from "../services/alpaca-market-data-service";
import { alpacaBrokerService } from "../services/alpaca-broker-service";
import { alpacaSseService } from "../services/alpaca-sse-service";
import { massiveWebSocketService } from "../services/massive-websocket-service";
import { usOrderNotificationService } from "../services/us-order-notification-service";
import { usRebalancingEngine } from "../services/us-rebalancing-engine";
import { orderAuditHook } from "../services/order-audit-hook";
import { kycEncryptionService } from "../services/kyc-encryption-service";
import { auditLog } from "../middleware/audit-trail";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

import { requireAuth, requireAdmin } from "../middleware/auth";
import { alpacaAccountGuard } from "../middleware/rbac";
import type { AuthRequest } from "../types/broker-types";

const router = Router();

// Apply authentication to all routes in this file
router.use(requireAuth);

// ─── Rate Limiters ────────────────────────────────────────────────────────────
/**
 * Order placement: 30 orders/min per IP (Alpaca's recommended burst allowance).
 * This prevents accidental order floods and satisfies Alpaca audit requirements.
 */
const orderLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user?.id?.toString() || req.ip || "anon",
  message: { success: false, error: "Too many orders — max 30/minute. Please slow down.", retryable: true },
});

/** Journal / fund transfers: 10/min per user (lower — higher value actions). */
const fundingLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user?.id?.toString() || req.ip || "anon",
  message: { success: false, error: "Too many funding actions — max 10/minute.", retryable: true },
});

/** Compliance/suspension: 5/min (high-risk admin actions). */
const complianceLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user?.id?.toString() || req.ip || "anon",
  message: { success: false, error: "Too many compliance actions — max 5/minute.", retryable: false },
});


const orderSchema = z.object({
  symbol: z.string().min(1).max(10),
  side: z.enum(["buy", "sell"]),
  orderType: z.enum(["market", "limit", "stop", "stop_limit"]).default("market"),
  timeInForce: z.enum(["day", "gtc", "ioc", "fok"]).default("day"),
  quantity: z.number().positive().optional(),
  notionalUsd: z.number().positive().optional(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  consent: z.boolean(),
  lrsDeclaration: z.boolean(),
});

// Get all accounts (Admin only)
router.get("/broker/accounts", requireAdmin, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({ configured: false, accounts: [] });
    }
    const accounts = await alpacaBrokerService.listAccounts({
      query: req.query.query as string,
      status: req.query.status as string,
      created_after: req.query.created_after as string,
      created_before: req.query.created_before as string,
      sort: (req.query.sort as "asc" | "desc") || "desc",
      entities: (req.query.entities as string) || "identity,contact,disclosures",
    });
    res.json({ configured: true, accounts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Create a new end-user trading account (Admin only) */
router.post("/broker/accounts", requireAdmin, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const account = await alpacaBrokerService.createBrokerAccount(req.body);
    res.status(201).json({ success: true, account });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Get a single account (Admin/Agent/Owner) */
router.get("/broker/accounts/:accountId", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const account = await alpacaBrokerService.getAccount(req.params.accountId);
    if (!account) return res.status(404).json({ success: false, error: "Account not found" });
    res.json({ success: true, account });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Update account information (Admin only) */
router.patch("/broker/accounts/:accountId", requireAdmin, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const account = await alpacaBrokerService.updateBrokerAccount(req.params.accountId, req.body);
    res.json({ success: true, account });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Close / deactivate an account (Admin only) */
router.delete("/broker/accounts/:accountId", requireAdmin, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    await alpacaBrokerService.closeBrokerAccount(req.params.accountId);
    res.json({ success: true, message: "Account closure initiated" });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Get trading account details (equity, cash, buying power) for a sub-account */
router.get("/broker/accounts/:accountId/trading", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const account = await alpacaBrokerService.getTradingAccount(req.params.accountId);
    res.json({ success: true, account });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── CIP / KYC ────────────────────────────────────────────────────────────────

/** Submit CIP (Customer Identification Program) data for an account (Admin only) */
router.post("/broker/accounts/:accountId/cip", requireAdmin, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const cip = await alpacaBrokerService.submitCip(req.params.accountId, req.body);
    res.json({ success: true, cip });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Get CIP status for an account (Admin/Agent/Owner) */
router.get("/broker/accounts/:accountId/cip", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const cip = await alpacaBrokerService.getCip(req.params.accountId);
    res.json({ success: true, cip });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Documents ────────────────────────────────────────────────────────────────

/** List documents for an account (Admin/Agent/Owner) */
router.get("/broker/accounts/:accountId/documents", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const docs = await alpacaBrokerService.listDocuments(req.params.accountId, {
      documents_type: req.query.documents_type as string,
      start: req.query.start as string,
      end: req.query.end as string,
    });
    res.json({ success: true, documents: docs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Upload a KYC/compliance document (Admin only) */
router.post("/broker/accounts/:accountId/documents", requireAdmin, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const doc = await alpacaBrokerService.uploadDocument(req.params.accountId, req.body);
    res.status(201).json({ success: true, document: doc });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Get a signed download URL for a document (Admin/Agent/Owner) */
router.get("/broker/accounts/:accountId/documents/:documentId/download", alpacaAccountGuard, async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const url = await alpacaBrokerService.downloadDocument(req.params.accountId, req.params.documentId);
    if (!url) return res.status(404).json({ success: false, error: "Document not found" });
    res.json({ success: true, url });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ACH Relationships ────────────────────────────────────────────────────────

/** List ACH bank relationships for an account */
router.get("/broker/accounts/:accountId/ach-relationships", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const relationships = await alpacaBrokerService.listAchRelationships(
      req.params.accountId,
      req.query.statuses as string,
    );
    res.json({ success: true, relationships });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Create an ACH relationship (link bank account) */
router.post("/broker/accounts/:accountId/ach-relationships", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const relationship = await alpacaBrokerService.createAchRelationship(req.params.accountId, req.body);
    res.status(201).json({ success: true, relationship });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Delete an ACH relationship */
router.delete("/broker/accounts/:accountId/ach-relationships/:achId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    await alpacaBrokerService.deleteAchRelationship(req.params.accountId, req.params.achId);
    res.json({ success: true });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── Transfers / Funding ──────────────────────────────────────────────────────

/** List transfers for an account */
router.get("/broker/accounts/:accountId/transfers", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const transfers = await alpacaBrokerService.listTransfers(req.params.accountId, {
      direction: req.query.direction as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    });
    res.json({ success: true, transfers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Initiate a transfer (deposit/withdrawal) */
router.post("/broker/accounts/:accountId/transfers", fundingLimiter, async (req, res) => {
  const userId = (req as AuthRequest).user?.id;
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const transfer = await alpacaBrokerService.createTransfer(req.params.accountId, req.body);
    await auditLog({
      action: "us_trading_transfer_initiated",
      category: "trading",
      outcome: "success",
      riskLevel: "high",
      details: {
        event: "US_TRANSFER_INITIATED",
        user_id: userId,
        account_id: req.params.accountId,
        transfer_type: req.body.transfer_type,
        direction: req.body.direction,
        amount: req.body.amount,
        transfer_id: transfer?.id,
      },
    }).catch(() => {});
    res.status(201).json({ success: true, transfer });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Cancel a pending transfer */
router.delete("/broker/accounts/:accountId/transfers/:transferId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    await alpacaBrokerService.cancelTransfer(req.params.accountId, req.params.transferId);
    res.json({ success: true });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── Account Activities ───────────────────────────────────────────────────────

/** Get activity log for a specific account (trade confirmations, dividends, etc.) */
router.get("/broker/accounts/:accountId/activities", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const activities = await alpacaBrokerService.getAccountActivities(req.params.accountId, {
      activity_type: req.query.activity_type as string,
      date: req.query.date as string,
      until: req.query.until as string,
      after: req.query.after as string,
      direction: req.query.direction as string,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 50,
    });
    res.json({ success: true, activities });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Get activities across ALL accounts (admin-level view) */
router.get("/broker/activities", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const activities = await alpacaBrokerService.getAllActivities({
      activity_type: req.query.activity_type as string,
      account_id: req.query.account_id as string,
      date: req.query.date as string,
      until: req.query.until as string,
      after: req.query.after as string,
      direction: req.query.direction as string,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 100,
    });
    res.json({ success: true, activities });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Journals (Broker-to-Broker Fund / Securities Transfers) ─────────────────

/** List all journal entries (admin) */
router.get("/broker/journals", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const journals = await alpacaBrokerService.listJournals({
      after: req.query.after as string,
      before: req.query.before as string,
      status: req.query.status as string,
      entry_type: req.query.entry_type as string,
      to_account: req.query.to_account as string,
      from_account: req.query.from_account as string,
    });
    res.json({ success: true, journals });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Create a journal entry (JNLC = cash, JNLS = securities) (admin) */
router.post("/broker/journals", fundingLimiter, requireAdmin, async (req, res) => {
  const userId = (req as AuthRequest).user?.id;
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const journal = await alpacaBrokerService.createJournal(req.body);
    await auditLog({
      action: "us_trading_journal_created",
      category: "trading",
      outcome: "success",
      riskLevel: "high",
      details: {
        event: "US_JOURNAL_CREATED",
        user_id: userId,
        entry_type: req.body.entry_type,
        from_account: req.body.from_account,
        to_account: req.body.to_account,
        amount: req.body.amount,
        journal_id: journal?.id,
      },
    }).catch(() => {});
    res.status(201).json({ success: true, journal });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Cancel a pending journal */
router.delete("/broker/journals/:journalId", fundingLimiter, requireAdmin, async (req, res) => {
  const userId = (req as AuthRequest).user?.id;
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    await alpacaBrokerService.cancelJournal(req.params.journalId);
    await auditLog({
      action: "us_trading_journal_cancelled",
      category: "trading",
      outcome: "success",
      riskLevel: "high",
      details: { event: "US_JOURNAL_CANCELLED", user_id: userId, journal_id: req.params.journalId },
    }).catch(() => {});
    res.json({ success: true });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── Trading: Orders per account ─────────────────────────────────────────────

/** List orders for a specific broker account */
router.get("/broker/accounts/:accountId/orders", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const orders = await alpacaBrokerService.getOrders(
      (req.query.status as string) || "all",
      req.query.limit ? parseInt(req.query.limit as string) : 50,
      req.params.accountId,
    );
    res.json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Place an order for a specific broker account */
router.post("/broker/accounts/:accountId/orders", orderLimiter, async (req, res) => {
  const userId = (req as AuthRequest).user?.id;
  const { accountId } = req.params;
  const startMs = Date.now();
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }

    // ── Idempotency key: prefer client-supplied header, else generate deterministic key
    const idempotencyKey =
      (req.headers["idempotency-key"] as string) ||
      crypto
        .createHash("sha256")
        .update(`${userId}-${accountId}-${req.body.symbol}-${req.body.side}-${req.body.qty || req.body.notional || ""}-${Date.now()}`)
        .digest("hex")
        .slice(0, 36);

    // ── Pre-trade audit hook (before Alpaca)
    try { await orderAuditHook.before(req.body, userId?.toString()); } catch { /* non-fatal */ }

    const order = await alpacaBrokerService.placeOrder(
      { ...req.body, account_id: accountId },
      idempotencyKey,
    );

    // ── Post-trade audit hook (after Alpaca)
    try { await orderAuditHook.after(order, userId?.toString()); } catch { /* non-fatal */ }

    // ── Structured audit log (SEBI/Alpaca audit requirement)
    await auditLog({
      action: "us_trading_order_placed",
      category: "trading",
      outcome: "success",
      riskLevel: "medium",
      details: {
        event: "US_ORDER_PLACED",
        user_id: userId,
        account_id: accountId,
        symbol: req.body.symbol,
        side: req.body.side,
        order_type: req.body.orderType || req.body.order_type,
        qty: req.body.qty,
        notional: req.body.notional,
        order_id: order?.id,
        idempotency_key: idempotencyKey,
        latency_ms: Date.now() - startMs,
        status: "accepted",
      },
    }).catch(() => { /* non-fatal — don't block order response */ });

    res.status(201).json({ success: true, order, idempotencyKey });
  } catch (error: any) {
    await auditLog({
      action: "us_trading_order_placed",
      category: "trading",
      outcome: "failure",
      riskLevel: "medium",
      details: {
        event: "US_ORDER_FAILED",
        user_id: userId,
        account_id: accountId,
        symbol: req.body?.symbol,
        side: req.body?.side,
        error: error.response?.data?.message || error.message,
        latency_ms: Date.now() - startMs,
        status: "rejected",
      },
    }).catch(() => {});
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Cancel a specific order for an account */
router.delete("/broker/accounts/:accountId/orders/:orderId", orderLimiter, async (req, res) => {
  const userId = (req as AuthRequest).user?.id;
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const ok = await alpacaBrokerService.cancelOrder(req.params.orderId, req.params.accountId);
    await auditLog({
      action: "us_trading_order_cancelled",
      category: "trading",
      outcome: ok ? "success" : "failure",
      riskLevel: "medium",
      details: { event: "US_ORDER_CANCELLED", user_id: userId, account_id: req.params.accountId, order_id: req.params.orderId, status: ok ? "cancelled" : "cancel_failed" },
    }).catch(() => {});
    res.json({ success: ok });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Cancel ALL orders for an account */
router.delete("/broker/accounts/:accountId/orders", orderLimiter, async (req, res) => {
  const userId = (req as AuthRequest).user?.id;
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const cancelled = await alpacaBrokerService.cancelAllOrders(req.params.accountId);
    await auditLog({
      action: "us_trading_orders_cancelled_all",
      category: "trading",
      outcome: "success",
      riskLevel: "high",
      details: { event: "US_ORDERS_CANCEL_ALL", user_id: userId, account_id: req.params.accountId, cancelled_count: Array.isArray(cancelled) ? cancelled.length : 0 },
    }).catch(() => {});
    res.json({ success: true, cancelled });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Trading: Positions per account ──────────────────────────────────────────

/** List positions for a specific broker account */
router.get("/broker/accounts/:accountId/positions", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const positions = await alpacaBrokerService.getPositions(req.params.accountId);
    res.json({ success: true, positions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Close a specific position for an account */
router.delete("/broker/accounts/:accountId/positions/:symbol", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const ok = await alpacaBrokerService.closePosition(req.params.symbol.toUpperCase(), req.params.accountId);
    res.json({ success: ok });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Close ALL positions for an account */
router.delete("/broker/accounts/:accountId/positions", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const ok = await alpacaBrokerService.closeAllPositions(
      req.params.accountId,
      req.query.cancel_orders !== "false",
    );
    res.json({ success: ok });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Portfolio History per account ────────────────────────────────────────────

router.get("/broker/accounts/:accountId/portfolio/history", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const history = await alpacaBrokerService.getPortfolioHistory(
      (req.query.period as string) || "1M",
      (req.query.timeframe as string) || "1D",
      req.params.accountId,
    );
    res.json({ success: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Watchlists ────────────────────────────────────────────────────────────────

router.get("/broker/accounts/:accountId/watchlists", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const watchlists = await alpacaBrokerService.listWatchlists(req.params.accountId);
    res.json({ success: true, watchlists });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/broker/accounts/:accountId/watchlists", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const { name, symbols } = req.body;
    const watchlist = await alpacaBrokerService.createWatchlist(req.params.accountId, name, symbols || []);
    res.status(201).json({ success: true, watchlist });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

router.put("/broker/accounts/:accountId/watchlists/:watchlistId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const watchlist = await alpacaBrokerService.updateWatchlist(
      req.params.accountId,
      req.params.watchlistId,
      req.body,
    );
    res.json({ success: true, watchlist });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Add a single symbol to an existing watchlist */
router.post("/broker/accounts/:accountId/watchlists/:watchlistId/symbols", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const { symbol } = req.body;
    if (!symbol || typeof symbol !== "string") {
      return res.status(400).json({ success: false, error: "symbol is required" });
    }
    const watchlist = await alpacaBrokerService.addToWatchlist(
      req.params.accountId,
      req.params.watchlistId,
      symbol.toUpperCase().trim(),
    );
    res.json({ success: true, watchlist });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Remove a single symbol from a watchlist */
router.delete("/broker/accounts/:accountId/watchlists/:watchlistId/symbols/:symbol", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    await alpacaBrokerService.removeFromWatchlist(
      req.params.accountId,
      req.params.watchlistId,
      req.params.symbol.toUpperCase(),
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Corporate Action Elections ────────────────────────────────────────────────

/** Get account-scoped corporate action announcements (voluntary actions) */
router.get("/broker/accounts/:accountId/corporate-actions", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const announcements = await alpacaBrokerService.getAccountCorporateActions(req.params.accountId, {
      symbol: req.query.symbol as string,
      types: req.query.types as string,
      date_from: req.query.date_from as string,
      date_to: req.query.date_to as string,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, announcements });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Get a single corporate action announcement by ID */
router.get("/broker/corporate-actions/announcements/:announcementId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const announcement = await alpacaBrokerService.getCorporateActionAnnouncement(req.params.announcementId);
    if (!announcement) return res.status(404).json({ success: false, error: "Announcement not found" });
    res.json({ success: true, announcement });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Get elections already submitted for an announcement */
router.get("/broker/accounts/:accountId/corporate-actions/:announcementId/elections", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const elections = await alpacaBrokerService.getCorporateActionElections(
      req.params.accountId,
      req.params.announcementId,
    );
    res.json({ success: true, elections });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Submit a voluntary corporate action election
 * Body: { election_type: "cash" | "stock" | "mixed" | "none", ...opts }
 */
router.post("/broker/accounts/:accountId/corporate-actions/:announcementId/elections", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const { election_type, ...rest } = req.body;
    if (!election_type) {
      return res.status(400).json({ success: false, error: "election_type is required (cash|stock|mixed|none)" });
    }
    const result = await alpacaBrokerService.submitCorporateActionElection(
      req.params.accountId,
      req.params.announcementId,
      election_type,
      rest,
    );
    res.status(201).json({ success: true, election: result });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── Tax Lot Management ─────────────────────────────────────────────────────────
// Useful for India investors optimising LTCG/STCG on US-equity positions
// (US LTCG threshold: >1 yr; India tax treatment for US stocks follows FEMA/DTAA)

/** Get all tax lots across all positions for an account */
router.get("/broker/accounts/:accountId/positions/tax-lots", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const lots = await alpacaBrokerService.getAllPositionTaxLots(req.params.accountId);
    res.json({ success: true, tax_lots: lots });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Get tax lots for a single position/symbol */
router.get("/broker/accounts/:accountId/positions/:symbol/tax-lots", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const lots = await alpacaBrokerService.getPositionTaxLots(
      req.params.accountId,
      req.params.symbol,
    );
    res.json({ success: true, symbol: req.params.symbol, tax_lots: lots });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ACH Relationship Verification (Micro-deposits) ───────────────────────────

/**
 * Verify an ACH relationship using micro-deposit amounts.
 * Alpaca sends two small deposits; user must confirm exact values here.
 * Body: { amount1: number, amount2: number }
 */
router.post("/broker/accounts/:accountId/ach-relationships/:achId/verify", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const { amount1, amount2 } = req.body;
    if (amount1 == null || amount2 == null) {
      return res.status(400).json({ success: false, error: "amount1 and amount2 are required" });
    }
    const result = await alpacaBrokerService.verifyAchRelationship(
      req.params.accountId,
      req.params.achId,
      Number(amount1),
      Number(amount2),
    );
    res.json({ success: true, relationship: result });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── Account Trading Restrictions (Admin/Compliance) ──────────────────────────

/** Get current trading restrictions for an account */
router.get("/broker/accounts/:accountId/restrictions", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const restrictions = await alpacaBrokerService.getAccountRestrictions(req.params.accountId);
    res.json({ success: true, restrictions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update trading restrictions on an account (admin/compliance only).
 * Body: { restrict_trading?, restrict_short_selling?, restrict_options_trading?,
 *         restrict_margin?, max_margin_multiplier?, suspend_trading? }
 */
router.patch("/broker/accounts/:accountId/restrictions", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const result = await alpacaBrokerService.updateAccountRestrictions(req.params.accountId, req.body);
    res.json({ success: true, restrictions: result });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Suspend all trading on an account (compliance/AML — requires reason) */
router.post("/broker/accounts/:accountId/suspend", complianceLimiter, requireAdmin, async (req, res) => {
  const userId = (req as AuthRequest).user?.id;
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: "reason is required for account suspension" });
    const result = await alpacaBrokerService.suspendAccount(req.params.accountId, reason);
    await auditLog({
      action: "us_trading_account_suspended",
      category: "compliance",
      outcome: "success",
      riskLevel: "critical",
      details: { event: "US_ACCOUNT_SUSPENDED", user_id: userId, account_id: req.params.accountId, reason },
    }).catch(() => {});
    res.json({ success: true, account: result });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Reinstate a suspended account */
router.post("/broker/accounts/:accountId/reinstate", complianceLimiter, requireAdmin, async (req, res) => {
  const userId = (req as AuthRequest).user?.id;
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const result = await alpacaBrokerService.reinstateAccount(req.params.accountId);
    await auditLog({
      action: "us_trading_account_reinstated",
      category: "compliance",
      outcome: "success",
      riskLevel: "high",
      details: { event: "US_ACCOUNT_REINSTATED", user_id: userId, account_id: req.params.accountId },
    }).catch(() => {});
    res.json({ success: true, account: result });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── Get single order (account-scoped) ────────────────────────────────────────
router.get("/broker/accounts/:accountId/orders/:orderId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const order = await alpacaBrokerService.getAccountOrder(req.params.accountId, req.params.orderId);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });
    res.json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Replace (modify) an open order ───────────────────────────────────────────
router.patch("/broker/accounts/:accountId/orders/:orderId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const order = await alpacaBrokerService.replaceOrder(
      req.params.accountId,
      req.params.orderId,
      req.body,
    );
    res.json({ success: true, order });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── Get single position (account-scoped) ─────────────────────────────────────
router.get("/broker/accounts/:accountId/positions/:symbol", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const position = await alpacaBrokerService.getAccountPosition(
      req.params.accountId,
      req.params.symbol,
    );
    if (!position) return res.status(404).json({ success: false, error: "Position not found" });
    res.json({ success: true, position });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Trusted Contacts ──────────────────────────────────────────────────────────

/** Get trusted contact for an account */
router.get("/broker/accounts/:accountId/trusted-contact", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const contact = await alpacaBrokerService.getTrustedContact(req.params.accountId);
    res.json({ success: true, contact });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Add or update trusted contact */
router.post("/broker/accounts/:accountId/trusted-contact", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const contact = await alpacaBrokerService.updateTrustedContact(req.params.accountId, req.body);
    res.json({ success: true, contact });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Delete trusted contact */
router.delete("/broker/accounts/:accountId/trusted-contact", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    await alpacaBrokerService.deleteTrustedContact(req.params.accountId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Cash Interest Status ──────────────────────────────────────────────────────

/** Get current cash interest enrollment status for an account */
router.get("/broker/accounts/:accountId/cash-interest", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const status = await alpacaBrokerService.getCashInterestStatus(req.params.accountId);
    res.json({ success: true, status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── All Transfers (Admin) ─────────────────────────────────────────────────────

/** List transfers across ALL accounts (broker admin view) */
router.get("/broker/transfers", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const transfers = await alpacaBrokerService.listAllTransfers({
      direction: req.query.direction as "INCOMING" | "OUTGOING" | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    });
    res.json({ success: true, transfers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Journal Reversal ──────────────────────────────────────────────────────────

/** Reverse a journal entry */
router.post("/broker/journals/:journalId/reverse", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const result = await alpacaBrokerService.reverseJournal(req.params.journalId);
    res.json({ success: true, result });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── Report Download ───────────────────────────────────────────────────────────

/** Get download URL for a completed report */
router.get("/broker/reports/:reportId/download", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    const url = await alpacaBrokerService.downloadReport(req.params.reportId);
    if (!url) return res.status(404).json({ success: false, error: "Report not available for download" });
    res.json({ success: true, url });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Delete Rebalancing Portfolio ──────────────────────────────────────────────

/** Delete a rebalancing portfolio */
router.delete("/broker/rebalancing/portfolios/:portfolioId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca Broker API not configured" });
    }
    await alpacaBrokerService.deleteRebalancingPortfolio(req.params.portfolioId);
    res.json({ success: true });
  } catch (error: any) {
    const status = error.response?.status || 500;
    res.status(status).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

// ─── Admin Oversight & Production Readiness ───────────────────────────────────

/** Get Firm Account details (Admin only) */
router.get("/broker/firm-account", requireAdmin, async (req, res) => {
  try {
    const account = await alpacaBrokerService.getFirmAccount();
    res.json({ success: true, account });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Get IP Allowlist (Admin only) */
router.get("/broker/ip-allowlist", requireAdmin, async (req, res) => {
  try {
    const ips = await alpacaBrokerService.getIpAllowlist();
    res.json({ success: true, ips });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** Add IP to allowlist (Admin only) */
router.post("/broker/ip-allowlist", requireAdmin, async (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ success: false, error: "IP address required" });
    await alpacaBrokerService.addIpToAllowlist(ip);
    res.json({ success: true });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Remove IP from allowlist (Admin only) */
router.delete("/broker/ip-allowlist", requireAdmin, async (req, res) => {
  try {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ success: false, error: "IP address required" });
    await alpacaBrokerService.removeIpFromAllowlist(ip);
    res.json({ success: true });
  } catch (error: any) {
    res.status(error.response?.status || 500).json({ success: false, error: error.response?.data?.message || error.message });
  }
});

/** Get Global LRS Summary (Admin only) */
router.get("/broker/lrs-summary", requireAdmin, async (req, res) => {
  try {
    const fy = new Date().getMonth() + 1 >= 4 
      ? `${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`
      : `${new Date().getFullYear() - 1}-${new Date().getFullYear().toString().slice(-2)}`;
    
    const summary = await db.select({
      totalUsed: sql<number>`SUM(CAST(${usLrsDeclarations.amountUsd} AS NUMERIC))`,
      count: sql<number>`COUNT(*)`,
    }).from(usLrsDeclarations).where(eq(usLrsDeclarations.financialYear, fy));

    res.json({ success: true, summary: summary[0] || { totalUsed: 0, count: 0 } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** List Team Members (Admins/Agents) with enhanced audit data */
router.get("/admin/team", requireAdmin, async (req, res) => {
  try {
    const team = await db.select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      roles: users.roles,
      lastLoginAt: users.lastLoginAt,
      lastLoginIp: users.lastLoginIp,
      isActive: users.isActive,
    }).from(users).where(
      sql`'admin' = ANY(${users.roles}) OR 'superadmin' = ANY(${users.roles}) OR 'agent' = ANY(${users.roles})`
    );
    res.json({ success: true, team });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
