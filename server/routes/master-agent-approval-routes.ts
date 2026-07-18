/**
 * Master Agent Approval Routes — /api/master-agent/pending-transactions/*
 *
 * The FintekPro Master Agent manages all transactions from agents/partners without EUIN.
 * These transactions are queued via Gate 8 of the compliance pipeline.
 *
 * Routes:
 *   GET  /api/master-agent/pending-transactions           — paginated queue (pending/all)
 *   GET  /api/master-agent/pending-transactions/dashboard — stats: pending, approved, rejected, executed
 *   GET  /api/master-agent/pending-transactions/:id       — single transaction detail
 *   POST /api/master-agent/pending-transactions/:id/approve — approve + forward to IRIS
 *   POST /api/master-agent/pending-transactions/:id/reject  — reject + return to initiator
 *
 * Access: master_agent, admin, superadmin only.
 *
 * FASP-AI v1.0:
 *   - Master Agent MUST explicitly approve — no autonomous execution
 *   - All approvals include full audit trail (approvedBy, approvedAt, notes)
 *   - Mandatory disclaimer on every approval: risk disclosure
 */

import { Express, Request, Response } from "express";
import { db } from "../db";
import { pendingTransactions, users } from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { requireRole } from "../middleware/roleMiddleware";
import { approvePendingTransaction, rejectPendingTransaction, getMasterAgentPendingStats } from "../services/masterAgentApprovalService";
import { logger } from "../logger";

function maLog(event: string, extra: Record<string, unknown> = {}, level: "info" | "warn" | "error" = "info") {
  const entry = { event, service: "master-agent-routes", timestamp: new Date().toISOString(), ...extra };
  if (level === "error") logger.error(JSON.stringify(entry));
  else if (level === "warn") logger.warn(JSON.stringify(entry));
  else logger.info(JSON.stringify(entry));
}

function apiOk(res: Response, data: unknown, meta: Record<string, unknown> = {}) {
  res.json({ success: true, data, meta: { timestamp: new Date().toISOString(), version: "1.0", ...meta } });
}

function apiErr(res: Response, status: number, code: string, message: string, retryable = false) {
  res.status(status).json({
    success: false,
    error: { error_code: code, message, retryable },
    meta: { timestamp: new Date().toISOString(), version: "1.0" },
  });
}

const requireMasterAgent = requireRole("master_agent", "admin", "superadmin");

export function registerMasterAgentApprovalRoutes(app: Express): void {

  /**
   * GET /api/master-agent/pending-transactions/dashboard
   * Stats for the master agent's approval dashboard.
   */
  app.get("/api/master-agent/pending-transactions/dashboard", requireMasterAgent, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const masterAgentUserId = (req as any).user?.id;
    try {
      const stats = await getMasterAgentPendingStats(masterAgentUserId);
      maLog("MASTER_AGENT_DASHBOARD", { master_agent_id: masterAgentUserId, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, stats, { latency_ms: Date.now() - startMs });
    } catch (e: any) {
      maLog("MASTER_AGENT_DASHBOARD_ERROR", { master_agent_id: masterAgentUserId, error: e.message }, "error");
      apiErr(res, 500, "DASHBOARD_ERROR", e.message, true);
    }
  });

  /**
   * GET /api/master-agent/pending-transactions
   * Paginated list of queued transactions for this master agent.
   * Filter by: status (pending|approved|rejected|executed|all), page, limit
   */
  app.get("/api/master-agent/pending-transactions", requireMasterAgent, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const masterAgentUserId = (req as any).user?.id;
    const { status = "pending", page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset   = (pageNum - 1) * limitNum;

    try {
      const validStatuses = ["pending", "approved", "rejected", "executed", "cancelled"];
      const statusFilter  = validStatuses.includes(status) ? status : null;

      const baseWhere = statusFilter
        ? and(eq(pendingTransactions.masterAgentUserId, masterAgentUserId), eq(pendingTransactions.status, statusFilter))
        : eq(pendingTransactions.masterAgentUserId, masterAgentUserId);

      const [rows, [{ total }]] = await Promise.all([
        db.select({
          id:                pendingTransactions.id,
          initiatedByUserId: pendingTransactions.initiatedByUserId,
          initiatedByRole:   pendingTransactions.initiatedByRole,
          clientPan:         pendingTransactions.clientPan,
          transactionType:   pendingTransactions.transactionType,
          productType:       pendingTransactions.productType,
          status:            pendingTransactions.status,
          approvalNotes:     pendingTransactions.approvalNotes,
          rejectionReason:   pendingTransactions.rejectionReason,
          irisOrderId:       pendingTransactions.irisOrderId,
          createdAt:         pendingTransactions.createdAt,
          approvedAt:        pendingTransactions.approvedAt,
          executedAt:        pendingTransactions.executedAt,
        })
          .from(pendingTransactions)
          .where(baseWhere)
          .orderBy(desc(pendingTransactions.createdAt))
          .limit(limitNum)
          .offset(offset),
        db.select({ total: sql<number>`count(*)` })
          .from(pendingTransactions)
          .where(baseWhere),
      ]);

      // Mask PAN in response
      const safe = rows.map((r) => ({
        ...r,
        clientPan: r.clientPan ? r.clientPan.slice(0, 5) + "*****" : null,
      }));

      maLog("MASTER_AGENT_TX_LIST", { master_agent_id: masterAgentUserId, count: rows.length, status_filter: status, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, safe, { page: pageNum, limit: limitNum, total: Number(total), totalPages: Math.ceil(Number(total) / limitNum), latency_ms: Date.now() - startMs });
    } catch (e: any) {
      maLog("MASTER_AGENT_TX_LIST_ERROR", { master_agent_id: masterAgentUserId, error: e.message }, "error");
      apiErr(res, 500, "TX_LIST_ERROR", e.message, true);
    }
  });

  /**
   * GET /api/master-agent/pending-transactions/:id
   * Full detail of a single pending transaction (scoped to this master agent).
   */
  app.get("/api/master-agent/pending-transactions/:id", requireMasterAgent, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const masterAgentUserId = (req as any).user?.id;
    const { id } = req.params;

    try {
      const [tx] = await db.select()
        .from(pendingTransactions)
        .where(and(eq(pendingTransactions.id, id), eq(pendingTransactions.masterAgentUserId, masterAgentUserId)))
        .limit(1);

      if (!tx) return apiErr(res, 404, "TX_NOT_FOUND", "Pending transaction not found or not assigned to you", false);

      const safe = {
        ...tx,
        clientPan: tx.clientPan ? tx.clientPan.slice(0, 5) + "*****" : null,
      };

      maLog("MASTER_AGENT_TX_DETAIL", { master_agent_id: masterAgentUserId, tx_id: id, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, safe, { latency_ms: Date.now() - startMs });
    } catch (e: any) {
      maLog("MASTER_AGENT_TX_DETAIL_ERROR", { master_agent_id: masterAgentUserId, tx_id: id, error: e.message }, "error");
      apiErr(res, 500, "TX_DETAIL_ERROR", e.message, true);
    }
  });

  /**
   * POST /api/master-agent/pending-transactions/:id/approve
   * Master Agent explicitly approves the transaction.
   * On approval → transaction forwarded to IRIS using master agent's EUIN.
   *
   * FASP-AI: This is a HUMAN approval action — no autonomous execution.
   * Mandatory: Master Agent must explicitly call this endpoint.
   *
   * Inputs: { notes? }
   * Outputs: { pendingTransactionId, irisOrderId, status }
   */
  app.post("/api/master-agent/pending-transactions/:id/approve", requireMasterAgent, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const masterAgentUserId = (req as any).user?.id;
    const { id } = req.params;
    const { notes } = req.body ?? {};

    try {
      // Verify this transaction belongs to this master agent
      const [tx] = await db.select({ id: pendingTransactions.id, status: pendingTransactions.status, masterAgentUserId: pendingTransactions.masterAgentUserId })
        .from(pendingTransactions)
        .where(and(eq(pendingTransactions.id, id), eq(pendingTransactions.masterAgentUserId, masterAgentUserId)))
        .limit(1);

      if (!tx) return apiErr(res, 404, "TX_NOT_FOUND", "Pending transaction not found or not assigned to you", false);
      if (tx.status !== "pending") return apiErr(res, 409, "TX_NOT_PENDING", `Transaction is already ${tx.status}`, false);

      const result = await approvePendingTransaction(id, masterAgentUserId, notes);

      maLog("MASTER_AGENT_TX_APPROVED", {
        master_agent_id:  masterAgentUserId,
        tx_id:            id,
        iris_order_id:    result.irisOrderId,
        latency_ms:       Date.now() - startMs,
        status:           result.success ? "success" : "partial",
      });

      if (!result.success) {
        return apiErr(res, 502, "IRIS_EXECUTION_FAILED", result.message, true);
      }

      apiOk(res, {
        pendingTransactionId: id,
        irisOrderId:          result.irisOrderId,
        status:               result.irisOrderId ? "executed" : "approved",
        message:              result.message,
        disclaimer: "SEBI Disclosure: This transaction has been approved by a SEBI-registered Master Agent. Market risks apply. Past performance is not indicative of future returns.",
      }, { latency_ms: Date.now() - startMs });
    } catch (e: any) {
      maLog("MASTER_AGENT_TX_APPROVE_ERROR", { master_agent_id: masterAgentUserId, tx_id: id, error: e.message }, "error");
      apiErr(res, 500, "TX_APPROVE_ERROR", e.message, true);
    }
  });

  /**
   * POST /api/master-agent/pending-transactions/:id/reject
   * Master Agent rejects the transaction. Returns it to initiating agent with reason.
   *
   * Inputs: { reason } (required)
   * Outputs: { pendingTransactionId, status: "rejected" }
   */
  app.post("/api/master-agent/pending-transactions/:id/reject", requireMasterAgent, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const masterAgentUserId = (req as any).user?.id;
    const { id } = req.params;
    const { reason } = req.body ?? {};

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return apiErr(res, 400, "REJECTION_REASON_REQUIRED", "A rejection reason of at least 5 characters is required", false);
    }

    try {
      const [tx] = await db.select({ id: pendingTransactions.id, status: pendingTransactions.status, masterAgentUserId: pendingTransactions.masterAgentUserId })
        .from(pendingTransactions)
        .where(and(eq(pendingTransactions.id, id), eq(pendingTransactions.masterAgentUserId, masterAgentUserId)))
        .limit(1);

      if (!tx) return apiErr(res, 404, "TX_NOT_FOUND", "Pending transaction not found or not assigned to you", false);
      if (!["pending", "approved"].includes(tx.status ?? "")) return apiErr(res, 409, "TX_ALREADY_FINALISED", `Transaction is already ${tx.status}`, false);

      const result = await rejectPendingTransaction(id, masterAgentUserId, reason.trim());

      maLog("MASTER_AGENT_TX_REJECTED", { master_agent_id: masterAgentUserId, tx_id: id, reason: reason.trim(), latency_ms: Date.now() - startMs, status: "success" });

      apiOk(res, {
        pendingTransactionId: id,
        status:  "rejected",
        message: result.message,
      }, { latency_ms: Date.now() - startMs });
    } catch (e: any) {
      maLog("MASTER_AGENT_TX_REJECT_ERROR", { master_agent_id: masterAgentUserId, tx_id: id, error: e.message }, "error");
      apiErr(res, 500, "TX_REJECT_ERROR", e.message, true);
    }
  });
}
