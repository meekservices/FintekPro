/**
 * Master Agent Approval Service — FintekPro
 *
 * When an agent or partner WITHOUT a verified EUIN tries to place a transaction,
 * the transaction is queued here instead of being sent directly to IRIS.
 * The FintekPro Master Agent reviews and approves/rejects these transactions.
 *
 * On approval, the transaction is forwarded to IRIS using the Master Agent's EUIN
 * as the executing principal (SEBI-compliant).
 *
 * FASP-AI v1.0:
 *   - Never executes autonomously — requires master agent explicit approval
 *   - All queued transactions stored with full audit trail
 *   - EUIN of master agent used for IRIS execution (not initiator's absent EUIN)
 */

import { db } from "../db";
import {
  pendingTransactions,
  users,
  customerCareAgents,
  type InsertPendingTransaction,
} from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { logger } from "../logger";
import { irisKfintechService } from "./iris-kfintech-service";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QueueResult {
  success: boolean;
  pendingTransactionId: string;
  masterAgentUserId: string;
  masterAgentEuin: string | null;
  message: string;
}

export interface ApprovalResult {
  success: boolean;
  pendingTransactionId: string;
  irisOrderId?: string;
  message: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maLog(event: string, extra: Record<string, unknown> = {}, level: "info" | "warn" | "error" = "info") {
  const entry = { event, service: "master-agent-approval", timestamp: new Date().toISOString(), ...extra };
  if (level === "error") logger.error(JSON.stringify(entry));
  else if (level === "warn") logger.warn(JSON.stringify(entry));
  else logger.info(JSON.stringify(entry));
}

// ─── Master Agent Resolver ────────────────────────────────────────────────────

/**
 * Resolves the active FintekPro Master Agent.
 * Priority:
 *   1. User with role 'master_agent' AND a verified EUIN in customerCareAgents
 *   2. User with role 'master_agent' (any)
 *   3. Admin user as fallback (ensures nothing is ever orphaned)
 *
 * @returns { userId, euinNumber }
 */
export async function resolveMasterAgent(): Promise<{ userId: string; euinNumber: string | null }> {
  // Try: user with master_agent role + verified EUIN in agents table
  const withEuin = await db
    .select({
      userId: users.id,
      euinNumber: customerCareAgents.euinNumber,
    })
    .from(users)
    .leftJoin(customerCareAgents, eq(customerCareAgents.distributorId, users.id))
    .where(
      and(
        sql`${users.roles} @> ARRAY['master_agent']::varchar[]`,
        eq(customerCareAgents.euinVerificationStatus, "verified"),
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(1);

  if (withEuin.length > 0) {
    return { userId: withEuin[0].userId, euinNumber: withEuin[0].euinNumber ?? null };
  }

  // Try: any master_agent user (EUIN may not be in customerCareAgents table)
  const anyMaster = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.roles} @> ARRAY['master_agent']::varchar[]`)
    .orderBy(desc(users.createdAt))
    .limit(1);

  if (anyMaster.length > 0) {
    // Try to find their EUIN from agents table by userId
    const agentRow = await db
      .select({ euinNumber: customerCareAgents.euinNumber })
      .from(customerCareAgents)
      .where(and(
        eq(customerCareAgents.distributorId, anyMaster[0].id),
        eq(customerCareAgents.euinVerificationStatus, "verified"),
      ))
      .limit(1);

    return { userId: anyMaster[0].id, euinNumber: agentRow[0]?.euinNumber ?? null };
  }

  // Fallback: admin user (ensures nothing is orphaned — admin can always review)
  const admin = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.roles} @> ARRAY['admin']::varchar[]`)
    .orderBy(desc(users.createdAt))
    .limit(1);

  if (!admin.length) {
    throw new Error("No master_agent or admin user found. Cannot queue transaction.");
  }

  maLog("MASTER_AGENT_FALLBACK_TO_ADMIN", { admin_id: admin[0].id }, "warn");
  return { userId: admin[0].id, euinNumber: null };
}

// ─── Queue Transaction ────────────────────────────────────────────────────────

/**
 * Queue a transaction from a no-EUIN agent/partner for master agent approval.
 *
 * @param initiatedByUserId - The agent/partner user ID who initiated the transaction
 * @param initiatedByRole   - 'agent' | 'partner'
 * @param transactionType   - 'mf_purchase' | 'mf_redemption' | 'sip' | 'stp' | etc.
 * @param productType       - 'mutual_fund' | 'bond' | 'fd' | 'nps'
 * @param payload           - The original transaction request body
 * @param clientPan         - Client PAN (for IRIS execution on approval)
 * @param clientUserId      - Client user ID
 */
export async function queueTransactionForMasterApproval(
  initiatedByUserId: string,
  initiatedByRole: "agent" | "partner",
  transactionType: string,
  productType: string,
  payload: Record<string, unknown>,
  clientPan?: string,
  clientUserId?: string,
): Promise<QueueResult> {
  const master = await resolveMasterAgent();

  // Mask PAN in logs
  const panMasked = clientPan ? clientPan.slice(0, 5) + "*****" : null;

  const [row] = await db.insert(pendingTransactions).values({
    initiatedByUserId,
    initiatedByRole,
    initiatedByEuin: null, // null = no EUIN (this is why it's pending)
    clientUserId:    clientUserId ?? null,
    clientPan:       clientPan ?? null,
    masterAgentUserId: master.userId,
    masterAgentEuin:   master.euinNumber,
    transactionType,
    productType,
    payload,
    status: "pending",
    source: "api",
  } satisfies InsertPendingTransaction).returning({ id: pendingTransactions.id });

  maLog("TRANSACTION_QUEUED_FOR_MASTER_APPROVAL", {
    pending_tx_id:   row.id,
    initiator_id:    initiatedByUserId,
    initiator_role:  initiatedByRole,
    master_agent_id: master.userId,
    master_euin:     master.euinNumber,
    transaction_type: transactionType,
    product_type:    productType,
    pan_masked:      panMasked,
    status:          "success",
  });

  return {
    success: true,
    pendingTransactionId: row.id,
    masterAgentUserId: master.userId,
    masterAgentEuin: master.euinNumber,
    message: "Transaction queued for Master Agent approval. You will be notified once approved.",
  };
}

// ─── Approve Transaction ──────────────────────────────────────────────────────

/**
 * Master Agent approves a pending transaction and forwards it to IRIS.
 * Uses the master agent's EUIN as the executing principal.
 *
 * @param pendingTxId    - pendingTransactions.id to approve
 * @param approvedByUserId - Master agent user ID performing the approval
 * @param approvalNotes  - Optional notes from the master agent
 */
export async function approvePendingTransaction(
  pendingTxId: string,
  approvedByUserId: string,
  approvalNotes?: string,
): Promise<ApprovalResult> {
  const [tx] = await db
    .select()
    .from(pendingTransactions)
    .where(and(
      eq(pendingTransactions.id, pendingTxId),
      eq(pendingTransactions.status, "pending"),
    ))
    .limit(1);

  if (!tx) {
    return { success: false, pendingTransactionId: pendingTxId, message: "Pending transaction not found or already processed" };
  }

  // Mark as approved immediately (prevents double-execution)
  await db.update(pendingTransactions)
    .set({
      status:           "approved",
      approvedByUserId,
      approvedAt:       new Date(),
      approvalNotes:    approvalNotes ?? null,
      updatedAt:        new Date(),
    })
    .where(eq(pendingTransactions.id, pendingTxId));

  // Forward to IRIS using master agent's EUIN
  let irisOrderId: string | undefined;
  let irisResponse: unknown;

  if (irisKfintechService.isConfigured) {
    try {
      const enrichedPayload = {
        ...(tx.payload as Record<string, unknown>),
        euinCode: tx.masterAgentEuin ?? undefined, // override with master agent EUIN
        executingPrincipal: "master_agent",
        pendingTransactionRef: pendingTxId,
      };

      const result = await irisKfintechService.placeOrder(enrichedPayload) as any;
      irisOrderId = result?.orderId ?? result?.order_id ?? undefined;
      irisResponse = result;

      await db.update(pendingTransactions)
        .set({
          status:      "executed",
          irisOrderId: irisOrderId ?? null,
          irisResponse: irisResponse as any,
          executedAt:  new Date(),
          updatedAt:   new Date(),
        })
        .where(eq(pendingTransactions.id, pendingTxId));

      maLog("PENDING_TX_APPROVED_AND_EXECUTED", {
        pending_tx_id:    pendingTxId,
        approved_by:      approvedByUserId,
        iris_order_id:    irisOrderId,
        master_euin:      tx.masterAgentEuin,
        status:           "success",
      });

      return {
        success: true,
        pendingTransactionId: pendingTxId,
        irisOrderId,
        message: `Transaction approved and executed via IRIS. Order ID: ${irisOrderId}`,
      };
    } catch (irisErr: any) {
      // IRIS execution failed — revert to approved (not executed) for retry
      await db.update(pendingTransactions)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(pendingTransactions.id, pendingTxId));

      maLog("PENDING_TX_IRIS_EXECUTION_FAILED", {
        pending_tx_id: pendingTxId,
        error:         irisErr.message,
      }, "error");

      return {
        success: false,
        pendingTransactionId: pendingTxId,
        message: `Approved but IRIS execution failed: ${irisErr.message}. Will retry.`,
      };
    }
  } else {
    // IRIS not configured — mark approved, execution deferred
    maLog("PENDING_TX_APPROVED_IRIS_DEFERRED", { pending_tx_id: pendingTxId }, "warn");
    return {
      success: true,
      pendingTransactionId: pendingTxId,
      message: "Transaction approved. IRIS not configured — execution deferred until IRIS is connected.",
    };
  }
}

// ─── Reject Transaction ───────────────────────────────────────────────────────

/**
 * Master Agent rejects a pending transaction, returning it to the initiating agent.
 */
export async function rejectPendingTransaction(
  pendingTxId: string,
  rejectedByUserId: string,
  rejectionReason: string,
): Promise<{ success: boolean; message: string }> {
  const result = await db.update(pendingTransactions)
    .set({
      status:           "rejected",
      rejectionReason,
      approvedByUserId: rejectedByUserId,
      approvedAt:       new Date(),
      updatedAt:        new Date(),
    })
    .where(and(
      eq(pendingTransactions.id, pendingTxId),
      inArray(pendingTransactions.status, ["pending", "approved"]),
    ))
    .returning({ id: pendingTransactions.id });

  if (!result.length) {
    return { success: false, message: "Pending transaction not found or already executed" };
  }

  maLog("PENDING_TX_REJECTED", { pending_tx_id: pendingTxId, rejected_by: rejectedByUserId, reason: rejectionReason });
  return { success: true, message: "Transaction rejected and returned to initiating agent." };
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getMasterAgentPendingStats(masterAgentUserId: string) {
  const [pending, approved, rejected, executed] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(pendingTransactions).where(and(eq(pendingTransactions.masterAgentUserId, masterAgentUserId), eq(pendingTransactions.status, "pending"))),
    db.select({ count: sql<number>`count(*)` }).from(pendingTransactions).where(and(eq(pendingTransactions.masterAgentUserId, masterAgentUserId), eq(pendingTransactions.status, "approved"))),
    db.select({ count: sql<number>`count(*)` }).from(pendingTransactions).where(and(eq(pendingTransactions.masterAgentUserId, masterAgentUserId), eq(pendingTransactions.status, "rejected"))),
    db.select({ count: sql<number>`count(*)` }).from(pendingTransactions).where(and(eq(pendingTransactions.masterAgentUserId, masterAgentUserId), eq(pendingTransactions.status, "executed"))),
  ]);
  return {
    pending:  Number(pending[0]?.count) || 0,
    approved: Number(approved[0]?.count) || 0,
    rejected: Number(rejected[0]?.count) || 0,
    executed: Number(executed[0]?.count) || 0,
  };
}
