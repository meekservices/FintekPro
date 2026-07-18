/**
 * EUIN-Chain Approval Routes — /api/master-agent/pending-transactions/*
 *
 * Any EUIN-holder in the referral chain can approve transactions queued to them:
 *   - Parent Agent (role: agent, with verified EUIN)
 *   - Managing Partner (role: partner, with euinNumber)
 *   - Master Agent (role: master_agent)
 *   - Admin (role: admin) — fallback
 *
 * Access: Any authenticated user whose userId matches masterAgentUserId of the
 *         pending transaction (enforced per-transaction, not at route level).
 *         Admin/superadmin/master_agent can see ALL transactions.
 *
 * Routes:
 *   GET  /api/master-agent/pending-transactions/dashboard  — stats
 *   GET  /api/master-agent/pending-transactions            — paginated queue
 *   GET  /api/master-agent/pending-transactions/:id        — detail
 *   POST /api/master-agent/pending-transactions/:id/approve
 *   POST /api/master-agent/pending-transactions/:id/reject
 *
 * FASP-AI v1.0: Explicit human approval required at each level. No autonomous execution.
 */

import { Express, Request, Response } from "express";
import { db } from "../db";
import { pendingTransactions } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleMiddleware";
import {
  approvePendingTransaction,
  rejectPendingTransaction,
  getMasterAgentPendingStats,
} from "../services/masterAgentApprovalService";
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

/**
 * Admin / master_agent: can see ALL transactions.
 * Others (parent_agent, partner): can only see transactions assigned to them.
 */
function isElevated(user: any): boolean {
  const roles: string[] = user?.roles ?? [];
  return roles.some((r) => ["admin", "superadmin", "master_agent"].includes(r));
}

export function registerMasterAgentApprovalRoutes(app: Express): void {

  /**
   * GET /api/master-agent/pending-transactions/dashboard
   * Stats for the caller's approval dashboard.
   * Admin/master_agent see global stats; others see only their queue.
   */
  app.get(
    "/api/master-agent/pending-transactions/dashboard",
    requireAuth,
    async (req: Request, res: Response) => {
      const startMs = Date.now();
      const userId  = (req as any).user?.id as string;
      try {
        const stats = await getMasterAgentPendingStats(userId);

        // Also add approverRole breakdown for elevated users
        const byRole = await db
          .select({
            approverRole: pendingTransactions.approverRole,
            count: sql<number>`count(*)`,
          })
          .from(pendingTransactions)
          .where(
            isElevated((req as any).user)
              ? eq(pendingTransactions.status, "pending")            // elevated: all pending
              : and(eq(pendingTransactions.masterAgentUserId, userId), eq(pendingTransactions.status, "pending")),
          )
          .groupBy(pendingTransactions.approverRole);

        const roleBreakdown = Object.fromEntries(byRole.map((r) => [r.approverRole, Number(r.count)]));

        maLog("APPROVAL_DASHBOARD", { user_id: userId, latency_ms: Date.now() - startMs, status: "success" });
        apiOk(res, { ...stats, byApproverRole: roleBreakdown }, { latency_ms: Date.now() - startMs });
      } catch (e: any) {
        maLog("APPROVAL_DASHBOARD_ERROR", { user_id: userId, error: e.message }, "error");
        apiErr(res, 500, "DASHBOARD_ERROR", e.message, true);
      }
    },
  );

  /**
   * GET /api/master-agent/pending-transactions
   * Paginated queue. Each user only sees transactions assigned to them
   * (masterAgentUserId = req.user.id), except admin/master_agent who see all.
   */
  app.get(
    "/api/master-agent/pending-transactions",
    requireAuth,
    async (req: Request, res: Response) => {
      const startMs = Date.now();
      const userId  = (req as any).user?.id as string;
      const { status = "pending", page = "1", limit = "20" } = req.query as Record<string, string>;
      const pageNum  = Math.max(1, Number(page));
      const limitNum = Math.min(100, Math.max(1, Number(limit)));
      const offset   = (pageNum - 1) * limitNum;

      try {
        const validStatuses = ["pending", "approved", "rejected", "executed", "cancelled", "all"];
        const statusFilter  = validStatuses.includes(status) && status !== "all" ? status : null;

        // Scope: elevated users see all; others see only their assigned queue
        const scopeFilter = isElevated((req as any).user)
          ? undefined
          : eq(pendingTransactions.masterAgentUserId, userId);

        const baseWhere = scopeFilter && statusFilter
          ? and(scopeFilter, eq(pendingTransactions.status, statusFilter))
          : scopeFilter
            ? scopeFilter
            : statusFilter
              ? eq(pendingTransactions.status, statusFilter)
              : undefined;

        const [rows, [{ total }]] = await Promise.all([
          db.select({
            id:                pendingTransactions.id,
            initiatedByUserId: pendingTransactions.initiatedByUserId,
            initiatedByRole:   pendingTransactions.initiatedByRole,
            clientPan:         pendingTransactions.clientPan,
            transactionType:   pendingTransactions.transactionType,
            productType:       pendingTransactions.productType,
            status:            pendingTransactions.status,
            approverRole:      pendingTransactions.approverRole,       // ← chain-aware
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

        const safe = rows.map((r) => ({ ...r, clientPan: r.clientPan ? r.clientPan.slice(0, 5) + "*****" : null }));

        maLog("APPROVAL_TX_LIST", { user_id: userId, count: rows.length, status_filter: status, latency_ms: Date.now() - startMs, status: "success" });
        apiOk(res, safe, { page: pageNum, limit: limitNum, total: Number(total), totalPages: Math.ceil(Number(total) / limitNum), latency_ms: Date.now() - startMs });
      } catch (e: any) {
        maLog("APPROVAL_TX_LIST_ERROR", { user_id: userId, error: e.message }, "error");
        apiErr(res, 500, "TX_LIST_ERROR", e.message, true);
      }
    },
  );

  /**
   * GET /api/master-agent/pending-transactions/:id
   * Full detail of a single pending transaction.
   * Scoped: caller must be the assigned approver (or admin/master_agent).
   */
  app.get(
    "/api/master-agent/pending-transactions/:id",
    requireAuth,
    async (req: Request, res: Response) => {
      const startMs = Date.now();
      const userId  = (req as any).user?.id as string;
      const { id }  = req.params;

      try {
        const [tx] = await db.select()
          .from(pendingTransactions)
          .where(eq(pendingTransactions.id, id))
          .limit(1);

        if (!tx) return apiErr(res, 404, "TX_NOT_FOUND", "Pending transaction not found", false);

        // Access check: only assigned approver or elevated role can view
        if (!isElevated((req as any).user) && tx.masterAgentUserId !== userId) {
          return apiErr(res, 403, "TX_ACCESS_DENIED", "This transaction is not assigned to you", false);
        }

        const safe = { ...tx, clientPan: tx.clientPan ? tx.clientPan.slice(0, 5) + "*****" : null };
        maLog("APPROVAL_TX_DETAIL", { user_id: userId, tx_id: id, approver_role: tx.approverRole, latency_ms: Date.now() - startMs, status: "success" });
        apiOk(res, safe, { latency_ms: Date.now() - startMs });
      } catch (e: any) {
        maLog("APPROVAL_TX_DETAIL_ERROR", { user_id: userId, tx_id: id, error: e.message }, "error");
        apiErr(res, 500, "TX_DETAIL_ERROR", e.message, true);
      }
    },
  );

  /**
   * POST /api/master-agent/pending-transactions/:id/approve
   * EUIN holder explicitly approves the transaction.
   * Works for parent agents, partners, and master agents.
   *
   * FASP-AI: This is a HUMAN approval action — no autonomous execution.
   *
   * Inputs: { notes? }
   * Outputs: { pendingTransactionId, irisOrderId, status, approverRole }
   */
  app.post(
    "/api/master-agent/pending-transactions/:id/approve",
    requireAuth,
    async (req: Request, res: Response) => {
      const startMs = Date.now();
      const userId  = (req as any).user?.id as string;
      const { id }  = req.params;
      const { notes } = req.body ?? {};

      try {
        const [tx] = await db
          .select({
            id:                pendingTransactions.id,
            status:            pendingTransactions.status,
            masterAgentUserId: pendingTransactions.masterAgentUserId,
            approverRole:      pendingTransactions.approverRole,
          })
          .from(pendingTransactions)
          .where(eq(pendingTransactions.id, id))
          .limit(1);

        if (!tx) return apiErr(res, 404, "TX_NOT_FOUND", "Pending transaction not found", false);

        // Security: only the assigned approver (or elevated) can approve
        if (!isElevated((req as any).user) && tx.masterAgentUserId !== userId) {
          return apiErr(res, 403, "TX_ACCESS_DENIED", "This transaction is not assigned to you", false);
        }

        if (tx.status !== "pending") {
          return apiErr(res, 409, "TX_NOT_PENDING", `Transaction is already ${tx.status}`, false);
        }

        const result = await approvePendingTransaction(id, userId, notes);

        maLog("APPROVAL_TX_APPROVED", {
          user_id:       userId,
          approver_role: tx.approverRole,
          tx_id:         id,
          iris_order_id: result.irisOrderId,
          latency_ms:    Date.now() - startMs,
          status:        result.success ? "success" : "partial",
        });

        if (!result.success) {
          return apiErr(res, 502, "IRIS_EXECUTION_FAILED", result.message, true);
        }

        apiOk(res, {
          pendingTransactionId: id,
          irisOrderId:   result.irisOrderId,
          approverRole:  tx.approverRole,
          status:        result.irisOrderId ? "executed" : "approved",
          message:       result.message,
          disclaimer: "SEBI Disclosure: This transaction has been approved by a SEBI-registered EUIN holder. Market risks apply. Past performance is not indicative of future returns.",
        }, { latency_ms: Date.now() - startMs });
      } catch (e: any) {
        maLog("APPROVAL_TX_APPROVE_ERROR", { user_id: userId, tx_id: id, error: e.message }, "error");
        apiErr(res, 500, "TX_APPROVE_ERROR", e.message, true);
      }
    },
  );

  /**
   * POST /api/master-agent/pending-transactions/:id/reject
   * EUIN holder rejects the transaction with a mandatory reason.
   *
   * Inputs: { reason } (required, min 5 chars)
   * Outputs: { pendingTransactionId, status: "rejected" }
   */
  app.post(
    "/api/master-agent/pending-transactions/:id/reject",
    requireAuth,
    async (req: Request, res: Response) => {
      const startMs = Date.now();
      const userId  = (req as any).user?.id as string;
      const { id }  = req.params;
      const { reason } = req.body ?? {};

      if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
        return apiErr(res, 400, "REJECTION_REASON_REQUIRED", "A rejection reason of at least 5 characters is required", false);
      }

      try {
        const [tx] = await db
          .select({
            id:                pendingTransactions.id,
            status:            pendingTransactions.status,
            masterAgentUserId: pendingTransactions.masterAgentUserId,
            approverRole:      pendingTransactions.approverRole,
          })
          .from(pendingTransactions)
          .where(eq(pendingTransactions.id, id))
          .limit(1);

        if (!tx) return apiErr(res, 404, "TX_NOT_FOUND", "Pending transaction not found", false);

        if (!isElevated((req as any).user) && tx.masterAgentUserId !== userId) {
          return apiErr(res, 403, "TX_ACCESS_DENIED", "This transaction is not assigned to you", false);
        }

        if (!["pending", "approved"].includes(tx.status ?? "")) {
          return apiErr(res, 409, "TX_ALREADY_FINALISED", `Transaction is already ${tx.status}`, false);
        }

        const result = await rejectPendingTransaction(id, userId, reason.trim());

        maLog("APPROVAL_TX_REJECTED", { user_id: userId, approver_role: tx.approverRole, tx_id: id, reason: reason.trim(), latency_ms: Date.now() - startMs, status: "success" });

        apiOk(res, {
          pendingTransactionId: id,
          approverRole: tx.approverRole,
          status:  "rejected",
          message: result.message,
        }, { latency_ms: Date.now() - startMs });
      } catch (e: any) {
        maLog("APPROVAL_TX_REJECT_ERROR", { user_id: userId, tx_id: id, error: e.message }, "error");
        apiErr(res, 500, "TX_REJECT_ERROR", e.message, true);
      }
    },
  );
}
