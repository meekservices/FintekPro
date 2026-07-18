/**
 * Master Agent / EUIN-Chain Approval Service — FintekPro
 *
 * When an agent or partner WITHOUT a verified EUIN tries to place a transaction,
 * the transaction is queued to the NEAREST EUIN-HOLDER in the referral chain
 * instead of always going to the global Master Agent.
 *
 * Chain resolution order (for an agent initiator):
 *   1. Parent agent (customerCareAgents.masterAgentId) — if they have verified EUIN
 *   2. Mapped partner (agentPartnerMappings → partners.euinNumber) — if set
 *   3. FintekPro Master Agent (role = 'master_agent') — global fallback
 *   4. Admin user — final safety net
 *
 * For a partner initiator:
 *   1. FintekPro Master Agent — partners have no parent in the hierarchy
 *
 * FASP-AI v1.0:
 *   - Never executes autonomously — requires explicit human approval at each level
 *   - approverRole field tracks who the transaction was queued to
 *   - EUIN of approver used for IRIS execution (SEBI-compliant)
 */

import { db } from "../db";
import {
  pendingTransactions,
  users,
  customerCareAgents,
  partners,
  agentPartnerMappings,
  type InsertPendingTransaction,
} from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { logger } from "../logger";
import { irisKfintechService } from "./iris-kfintech-service";
import { emailService } from "../email-service";
import { whatsappDispatcher } from "./whatsapp-dispatcher";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Role of the approver the transaction was queued to */
export type ApproverRole = "parent_agent" | "partner" | "master_agent" | "admin";

export interface ChainResolutionResult {
  userId:       string;
  euinNumber:   string | null;
  approverRole: ApproverRole;
  displayName?: string;
}

export interface QueueResult {
  success:              boolean;
  pendingTransactionId: string;
  masterAgentUserId:    string;
  masterAgentEuin:      string | null;
  approverRole:         ApproverRole;
  message:              string;
}

export interface ApprovalResult {
  success:              boolean;
  pendingTransactionId: string;
  irisOrderId?:         string;
  message:              string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maLog(
  event: string,
  extra: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info",
) {
  const entry = { event, service: "master-agent-approval", timestamp: new Date().toISOString(), ...extra };
  if (level === "error") logger.error(JSON.stringify(entry));
  else if (level === "warn")  logger.warn(JSON.stringify(entry));
  else                         logger.info(JSON.stringify(entry));
}

// ─── Master Agent Resolver (global fallback) ──────────────────────────────────

/**
 * Resolves the global FintekPro Master Agent.
 * Used as the final fallback when no EUIN holder exists in the referral chain.
 * Priority:
 *   1. User with role 'master_agent' AND verified EUIN in customerCareAgents
 *   2. Any user with role 'master_agent'
 *   3. Admin user (ensures nothing is ever orphaned)
 */
export async function resolveMasterAgent(): Promise<ChainResolutionResult> {
  // 1. master_agent with verified EUIN
  const withEuin = await db
    .select({ userId: users.id, euinNumber: customerCareAgents.euinNumber })
    .from(users)
    .leftJoin(customerCareAgents, eq(customerCareAgents.distributorId, users.id))
    .where(and(
      sql`${users.roles} @> ARRAY['master_agent']::varchar[]`,
      eq(customerCareAgents.euinVerificationStatus, "verified"),
    ))
    .orderBy(desc(users.createdAt))
    .limit(1);

  if (withEuin.length > 0) {
    return { userId: withEuin[0].userId, euinNumber: withEuin[0].euinNumber ?? null, approverRole: "master_agent" };
  }

  // 2. Any master_agent user (resolve EUIN separately)
  const anyMaster = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.roles} @> ARRAY['master_agent']::varchar[]`)
    .orderBy(desc(users.createdAt))
    .limit(1);

  if (anyMaster.length > 0) {
    const agentRow = await db
      .select({ euinNumber: customerCareAgents.euinNumber })
      .from(customerCareAgents)
      .where(and(
        eq(customerCareAgents.distributorId, anyMaster[0].id),
        eq(customerCareAgents.euinVerificationStatus, "verified"),
      ))
      .limit(1);
    return { userId: anyMaster[0].id, euinNumber: agentRow[0]?.euinNumber ?? null, approverRole: "master_agent" };
  }

  // 3. Admin fallback
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
  return { userId: admin[0].id, euinNumber: null, approverRole: "admin" };
}

// ─── EUIN Chain Resolver ──────────────────────────────────────────────────────

/**
 * Walks the referral / hierarchy chain upward from the initiator to find
 * the NEAREST ancestor with a verified EUIN.
 *
 * Walk order (agent initiator):
 *   1. Parent agent via customerCareAgents.masterAgentId
 *      → if euinVerificationStatus === 'verified' → stop here
 *   2. Mapped partner via agentPartnerMappings (primary mapping)
 *      → if partners.euinNumber is set → stop here
 *   3. Global fallback: resolveMasterAgent()
 *
 * Walk order (partner initiator):
 *   Partners have no parent in the hierarchy → skip to resolveMasterAgent()
 *
 * @param initiatorUserId - auth user.id of the initiating agent/partner
 * @param initiatorRole   - 'agent' | 'partner'
 * @param maxHops         - safety limit (default 5) to prevent infinite recursion
 */
export async function resolveEuinChain(
  initiatorUserId: string,
  initiatorRole: "agent" | "partner",
  maxHops = 5,
): Promise<ChainResolutionResult> {

  // Partners have no parent agent — go straight to master agent
  if (initiatorRole === "partner") {
    maLog("EUIN_CHAIN_PARTNER_DIRECT_TO_MASTER", { initiator_id: initiatorUserId });
    return resolveMasterAgent();
  }

  // ── Agent walk ───────────────────────────────────────────────────────────
  // Step 1: Find this agent's customerCareAgents row via distributorId = userId
  const agentRow = await db
    .select({
      id:           customerCareAgents.id,
      masterAgentId: customerCareAgents.masterAgentId,
      euinNumber:   customerCareAgents.euinNumber,
      euinStatus:   customerCareAgents.euinVerificationStatus,
    })
    .from(customerCareAgents)
    .where(eq(customerCareAgents.distributorId, initiatorUserId))
    .limit(1);

  if (!agentRow.length) {
    // Agent not found in customerCareAgents — fall back to master
    maLog("EUIN_CHAIN_AGENT_ROW_NOT_FOUND", { initiator_id: initiatorUserId }, "warn");
    return resolveMasterAgent();
  }

  const agent = agentRow[0];

  // Step 2: Walk up masterAgentId chain (max maxHops hops)
  let currentAgentCcaId: string | null = agent.masterAgentId ?? null;
  let hops = 0;

  while (currentAgentCcaId && hops < maxHops) {
    hops++;
    const parentRows = await db
      .select({
        distributorId: customerCareAgents.distributorId,
        euinNumber:    customerCareAgents.euinNumber,
        euinStatus:    customerCareAgents.euinVerificationStatus,
        masterAgentId: customerCareAgents.masterAgentId,
      })
      .from(customerCareAgents)
      .where(eq(customerCareAgents.id, currentAgentCcaId))
      .limit(1);

    if (!parentRows.length) break;
    const parent = parentRows[0];

    if (parent.euinStatus === "verified" && parent.euinNumber && parent.distributorId) {
      maLog("EUIN_CHAIN_RESOLVED_TO_PARENT_AGENT", {
        initiator_id:  initiatorUserId,
        approver_id:   parent.distributorId,
        approver_euin: parent.euinNumber,
        hops,
      });
      return {
        userId:       parent.distributorId,
        euinNumber:   parent.euinNumber,
        approverRole: "parent_agent",
      };
    }

    // Move up one more level
    currentAgentCcaId = parent.masterAgentId ?? null;
  }

  // Step 3: Check agentPartnerMappings → partner with EUIN
  const mappingRows = await db
    .select({
      partnerId:   agentPartnerMappings.partnerId,
      priority:    agentPartnerMappings.priority,
    })
    .from(agentPartnerMappings)
    .where(and(
      eq(agentPartnerMappings.agentId, agent.id),
      eq(agentPartnerMappings.isActive, true),
    ))
    .orderBy(agentPartnerMappings.priority)
    .limit(3); // check up to 3 mappings (primary first)

  for (const mapping of mappingRows) {
    const partnerRows = await db
      .select({
        userId:     partners.userId,
        euinNumber: partners.euinNumber,
      })
      .from(partners)
      .where(eq(partners.id, mapping.partnerId))
      .limit(1);

    const p = partnerRows[0];
    if (p?.euinNumber && p.userId) {
      maLog("EUIN_CHAIN_RESOLVED_TO_PARTNER", {
        initiator_id:  initiatorUserId,
        approver_id:   p.userId,
        approver_euin: p.euinNumber,
        partner_id:    mapping.partnerId,
      });
      return {
        userId:       p.userId,
        euinNumber:   p.euinNumber,
        approverRole: "partner",
      };
    }
  }

  // Step 4: Global fallback — master agent
  maLog("EUIN_CHAIN_FALLBACK_TO_MASTER", {
    initiator_id: initiatorUserId,
    hops_walked:  hops,
    mappings_checked: mappingRows.length,
  }, "warn");

  return resolveMasterAgent();
}

// ─── Queue Transaction ────────────────────────────────────────────────────────

/**
 * Queue a no-EUIN transaction to the nearest EUIN holder in the referral chain.
 * Uses resolveEuinChain() — which walks: parent agent → mapped partner → master agent.
 *
 * @param initiatedByUserId - The agent/partner user ID who initiated the transaction
 * @param initiatedByRole   - 'agent' | 'partner'
 * @param transactionType   - 'mf_purchase' | 'mf_redemption' | 'sip' | 'stp' | etc.
 * @param productType       - 'mutual_fund' | 'bond' | 'fd' | 'nps'
 * @param payload           - The original transaction request body
 * @param clientPan         - Client PAN (masked in logs, used for IRIS execution)
 * @param clientUserId      - Client user ID
 */
export async function queueTransactionForMasterApproval(
  initiatedByUserId: string,
  initiatedByRole:   "agent" | "partner",
  transactionType:   string,
  productType:       string,
  payload:           Record<string, unknown>,
  clientPan?:        string,
  clientUserId?:     string,
): Promise<QueueResult> {

  // Resolve nearest EUIN holder in chain
  const approver = await resolveEuinChain(initiatedByUserId, initiatedByRole);

  const panMasked = clientPan ? clientPan.slice(0, 5) + "*****" : null;

  const [row] = await db.insert(pendingTransactions).values({
    initiatedByUserId,
    initiatedByRole,
    initiatedByEuin:   null,              // null = no EUIN (reason it is pending)
    clientUserId:      clientUserId ?? null,
    clientPan:         clientPan ?? null,
    masterAgentUserId: approver.userId,
    masterAgentEuin:   approver.euinNumber,
    approverRole:      approver.approverRole,
    transactionType,
    productType,
    payload,
    status: "pending",
    source: "api",
  } satisfies InsertPendingTransaction).returning({ id: pendingTransactions.id });

  maLog("TRANSACTION_QUEUED_VIA_CHAIN", {
    pending_tx_id:    row.id,
    initiator_id:     initiatedByUserId,
    initiator_role:   initiatedByRole,
    approver_id:      approver.userId,
    approver_role:    approver.approverRole,
    approver_euin:    approver.euinNumber,
    transaction_type: transactionType,
    product_type:     productType,
    pan_masked:       panMasked,
    status:           "queued",
  });

  // ── Notify the approver (non-fatal) ─────────────────────────────────────────
  // Fire-and-forget: look up approver contact details and send WhatsApp + email.
  // Errors here must NOT block the queue operation.
  notifyApprover(approver, row.id, transactionType, productType).catch((notifyErr) =>
    maLog("APPROVER_NOTIFY_FAILED", { pending_tx_id: row.id, error: notifyErr?.message }, "warn"),
  );

  const approverLabel: Record<ApproverRole, string> = {
    parent_agent: "your supervising agent",
    partner:      "your managing partner",
    master_agent: "the FintekPro Master Agent",
    admin:        "a FintekPro administrator",
  };

  return {
    success:              true,
    pendingTransactionId: row.id,
    masterAgentUserId:    approver.userId,
    masterAgentEuin:      approver.euinNumber,
    approverRole:         approver.approverRole,
    message: `Transaction queued for approval by ${approverLabel[approver.approverRole]}. You will be notified once reviewed.`,
  };
}

// ─── Approver Notification ────────────────────────────────────────────────────

/**
 * Sends WhatsApp (primary) + Email (secondary) notification to the assigned approver.
 * Fire-and-forget — must NOT throw; errors are logged and swallowed.
 *
 * Purpose : Ensure parent agents and partners know a transaction awaits them.
 * Inputs  : ChainResolutionResult (approver), pendingTxId, transaction context
 * Outputs : void (side-effect only)
 * Edge    : If approver has no mobile/email, gracefully skips that channel.
 */
async function notifyApprover(
  approver:        ChainResolutionResult,
  pendingTxId:     string,
  transactionType: string,
  productType:     string,
): Promise<void> {
  // Fetch approver's contact details from users table
  const [approverUser] = await db
    .select({ email: users.email, mobile: users.mobile })
    .from(users)
    .where(eq(users.id, approver.userId))
    .limit(1);

  if (!approverUser) return;

  const roleLabel: Record<ApproverRole, string> = {
    parent_agent: "Supervising Agent",
    partner:      "Managing Partner",
    master_agent: "Master Agent",
    admin:        "Administrator",
  };

  const subject = `Action Required: Transaction Pending Your Approval [${pendingTxId.slice(0, 8).toUpperCase()}]`;
  const body = [
    `A new ${transactionType.replace(/_/g, " ").toUpperCase()} transaction (${productType.replace(/_/g, " ")}) has been queued for your approval as ${roleLabel[approver.approverRole]}.`,
    ``,
    `Transaction ID: ${pendingTxId}`,
    ``,
    `Please log in to FintekPro and review the Pending Transactions queue.`,
    ``,
    `SEBI Compliance: EUIN is mandatory for MF transactions. Your EUIN (${approver.euinNumber ?? "N/A"}) will be used as the executing principal upon approval.`,
    ``,
    `This is a time-sensitive action. Unapproved transactions may impact client experience.`,
  ].join("\n");

  // WhatsApp (primary)
  if (approverUser.mobile) {
    await whatsappDispatcher.send({
      mobile:  approverUser.mobile,
      message: `[FintekPro] ${roleLabel[approver.approverRole]} — A ${transactionType.replace(/_/g, " ")} transaction requires your approval. TX ID: ${pendingTxId.slice(0, 8).toUpperCase()}. Login to approve/reject.`,
      category: "TRANSACTION",
    }).catch(() => null); // swallow — email is fallback
  }

  // Email (secondary)
  if (approverUser.email) {
    await emailService.sendNotificationEmail(
      approverUser.email,
      subject,
      body.replace(/\n/g, "<br/>"),
    ).catch(() => null);
  }

  maLog("APPROVER_NOTIFIED", {
    pending_tx_id:  pendingTxId,
    approver_id:    approver.userId,
    approver_role:  approver.approverRole,
    email_sent:     !!approverUser.email,
    whatsapp_sent:  !!approverUser.mobile,
    status:         "success",
  });
}

// ─── Approve Transaction ──────────────────────────────────────────────────────

/**
 * Approves a pending transaction and forwards it to IRIS.
 * Can be called by any EUIN holder the transaction was queued to
 * (parent agent, partner, or master agent — identified by masterAgentUserId).
 *
 * Uses the approver's EUIN as the executing principal (SEBI-compliant).
 *
 * @param pendingTxId      - pendingTransactions.id to approve
 * @param approvedByUserId - User ID of the EUIN holder performing the approval
 * @param approvalNotes    - Optional notes from the approver
 */
export async function approvePendingTransaction(
  pendingTxId:      string,
  approvedByUserId: string,
  approvalNotes?:   string,
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

  // Verify caller is the assigned approver (security gate)
  if (tx.masterAgentUserId !== approvedByUserId) {
    return { success: false, pendingTransactionId: pendingTxId, message: "You are not the assigned approver for this transaction" };
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

  // Forward to IRIS using approver's EUIN
  let irisOrderId: string | undefined;
  let irisResponse: unknown;

  if (irisKfintechService.isConfigured) {
    try {
      const enrichedPayload = {
        ...(tx.payload as Record<string, unknown>),
        euinCode:              tx.masterAgentEuin ?? undefined, // approver EUIN as executing principal
        executingPrincipal:    tx.approverRole,
        pendingTransactionRef: pendingTxId,
      };

      const result = await irisKfintechService.placeOrder(enrichedPayload) as any;
      irisOrderId  = result?.orderId ?? result?.order_id ?? undefined;
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
        pending_tx_id:  pendingTxId,
        approved_by:    approvedByUserId,
        approver_role:  tx.approverRole,
        iris_order_id:  irisOrderId,
        approver_euin:  tx.masterAgentEuin,
        status:         "success",
      });

      return {
        success: true,
        pendingTransactionId: pendingTxId,
        irisOrderId,
        message: `Transaction approved and executed via IRIS. Order ID: ${irisOrderId}`,
      };

    } catch (irisErr: any) {
      await db.update(pendingTransactions)
        .set({ status: "approved", updatedAt: new Date() })
        .where(eq(pendingTransactions.id, pendingTxId));

      maLog("PENDING_TX_IRIS_EXECUTION_FAILED", { pending_tx_id: pendingTxId, error: irisErr.message }, "error");

      return {
        success: false,
        pendingTransactionId: pendingTxId,
        message: `Approved but IRIS execution failed: ${irisErr.message}. Will retry.`,
      };
    }
  } else {
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
 * Rejects a pending transaction. Can be called by the assigned approver only.
 */
export async function rejectPendingTransaction(
  pendingTxId:      string,
  rejectedByUserId: string,
  rejectionReason:  string,
): Promise<{ success: boolean; message: string }> {

  const [tx] = await db
    .select({ masterAgentUserId: pendingTransactions.masterAgentUserId })
    .from(pendingTransactions)
    .where(eq(pendingTransactions.id, pendingTxId))
    .limit(1);

  if (tx && tx.masterAgentUserId !== rejectedByUserId) {
    return { success: false, message: "You are not the assigned approver for this transaction" };
  }

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

/**
 * Stats for any EUIN-holder's approval dashboard.
 * Works for parent agents, partners, and master agents alike
 * (all use masterAgentUserId as the approver identifier).
 */
export async function getMasterAgentPendingStats(masterAgentUserId: string) {
  const [pending, approved, rejected, executed] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(pendingTransactions)
      .where(and(eq(pendingTransactions.masterAgentUserId, masterAgentUserId), eq(pendingTransactions.status, "pending"))),
    db.select({ count: sql<number>`count(*)` }).from(pendingTransactions)
      .where(and(eq(pendingTransactions.masterAgentUserId, masterAgentUserId), eq(pendingTransactions.status, "approved"))),
    db.select({ count: sql<number>`count(*)` }).from(pendingTransactions)
      .where(and(eq(pendingTransactions.masterAgentUserId, masterAgentUserId), eq(pendingTransactions.status, "rejected"))),
    db.select({ count: sql<number>`count(*)` }).from(pendingTransactions)
      .where(and(eq(pendingTransactions.masterAgentUserId, masterAgentUserId), eq(pendingTransactions.status, "executed"))),
  ]);
  return {
    pending:  Number(pending[0]?.count)  || 0,
    approved: Number(approved[0]?.count) || 0,
    rejected: Number(rejected[0]?.count) || 0,
    executed: Number(executed[0]?.count) || 0,
  };
}
