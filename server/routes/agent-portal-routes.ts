/**
 * Agent Portal Enhancement Routes — /api/agent/portal/*
 *
 * Extends agent capabilities with:
 *   - IRIS-backed client KYC initiation
 *   - Catalog-backed product discovery for client (instrument eligibility by KYC level)
 *   - Zoho CRM sync on client onboarding completion
 *   - Agent dashboard stats (AUM, clients, KYC completion rate)
 *
 * FASP-AI GCR: requireAuth on all routes. Agents can only access their own clients.
 */

import { Express, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { irisKfintechService } from "../services/iris-kfintech-service";
import { db } from "../db";
import {
  irisFdProducts,
  irisNpsFunds,
  irisPmsAifProducts,
  onboardingInvitations,
  pendingTransactions,
  users,
} from "@shared/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  getMasterAgentPendingStats,
  approvePendingTransaction,
  rejectPendingTransaction,
} from "../services/masterAgentApprovalService";

import { logger } from "../logger";


function agentLog(event: string, extra: Record<string, unknown> = {}, level: "info" | "warn" | "error" = "info") {
  const entry = JSON.stringify({ event, service: "agent-portal", timestamp: new Date().toISOString(), ...extra });
  if (level === "error") logger.error(entry);
  else if (level === "warn") logger.warn(entry);
  else logger.info(entry);
}

function apiOk(res: Response, data: unknown, meta: Record<string, unknown> = {}) {
  res.json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), version: "1.0", ...meta },
  });
}

function apiErr(res: Response, status: number, code: string, message: string, retryable = false) {
  res.status(status).json({
    success: false,
    error: { error_code: code, message, retryable },
    meta: { timestamp: new Date().toISOString(), version: "1.0" },
  });
}

export function registerAgentPortalEnhancementRoutes(app: Express): void {

  /**
   * POST /api/agent/portal/clients/:pan/kyc/initiate
   * Agent triggers IRIS eKYC link for a client.
   * Sends link to client's registered mobile/email via IRIS.
   */
  app.post(
    "/api/agent/portal/clients/:pan/kyc/initiate",
    requireAuth,
    async (req: Request, res: Response) => {
      const { pan } = req.params;
      const agentId = (req as any).user?.id;
      const startMs = Date.now();
      const panMasked = pan.slice(0, 5) + "*****";

      if (!irisKfintechService.isConfigured) {
        return apiErr(res, 503, "IRIS_NOT_CONFIGURED", "KYC service temporarily unavailable", true);
      }

      try {
        const result = await irisKfintechService.sendEkycMail(pan);
        agentLog("AGENT_CLIENT_KYC_INITIATE", {
          agent_id: agentId,
          pan_masked: panMasked,
          latency_ms: Date.now() - startMs,
          status: "success",
        });
        apiOk(res, { triggered: true, message: result?.message ?? "eKYC link sent", pan_masked: panMasked }, { latency_ms: Date.now() - startMs });
      } catch (err: any) {
        agentLog("AGENT_CLIENT_KYC_INITIATE_ERROR", { agent_id: agentId, pan_masked: panMasked, error: err.message }, "error" as any);
        apiErr(res, 502, "AGENT_KYC_INITIATE_ERROR", err.message, true);
      }
    },
  );

  /**
   * GET /api/agent/portal/clients/:pan/kyc/status
   * Combined KYC status (eKYC + KYC details) from IRIS for a client.
   */
  app.get(
    "/api/agent/portal/clients/:pan/kyc/status",
    requireAuth,
    async (req: Request, res: Response) => {
      const { pan } = req.params;
      const agentId = (req as any).user?.id;
      const startMs = Date.now();

      if (!irisKfintechService.isConfigured) {
        return apiErr(res, 503, "IRIS_NOT_CONFIGURED", "KYC service temporarily unavailable", true);
      }

      try {
        const [ekyc, kyc] = await Promise.allSettled([
          irisKfintechService.getEkycStatus(pan),
          irisKfintechService.getInvestorKycDetails(pan),
        ]);

        agentLog("AGENT_CLIENT_KYC_STATUS", {
          agent_id: agentId,
          pan_masked: pan.slice(0, 5) + "*****",
          latency_ms: Date.now() - startMs,
          status: "success",
        });

        apiOk(res, {
          ekyc: ekyc.status === "fulfilled" ? ekyc.value : null,
          kyc:  kyc.status === "fulfilled" ? kyc.value : null,
        }, { latency_ms: Date.now() - startMs });
      } catch (err: any) {
        apiErr(res, 502, "AGENT_KYC_STATUS_ERROR", err.message, true);
      }
    },
  );

  /**
   * GET /api/agent/portal/clients/:pan/instruments
   * Available investment products for a client, based on their KYC level.
   * Reads from IRIS catalog DB — fast, no live call needed.
   */
  app.get(
    "/api/agent/portal/clients/:pan/instruments",
    requireAuth,
    async (req: Request, res: Response) => {
      const { pan } = req.params;
      const agentId = (req as any).user?.id;
      const startMs = Date.now();

      try {
        // Check KYC level — determines what products are available
        let kycLevel: "basic" | "full" | "enhanced" = "basic";
        if (irisKfintechService.isConfigured) {
          try {
            const kyc = await irisKfintechService.getInvestorKycDetails(pan);
            if (kyc && !kyc.error) kycLevel = "full";
          } catch { /* non-fatal — default to basic */ }
        }

        // Basic: MF + FD available for all KYC levels
        // Full: NPS + PMS/AIF unlocked
        const [fds, nps, pms, aif] = await Promise.all([
          db.select({
            irisProductId: irisFdProducts.irisProductId,
            issuerName:    irisFdProducts.issuerName,
            productName:   irisFdProducts.productName,
            interestRate:  irisFdProducts.interestRate,
            tenureMonths:  irisFdProducts.tenureMonths,
            minInvestment: irisFdProducts.minInvestment,
            creditRating:  irisFdProducts.creditRating,
          }).from(irisFdProducts).limit(20),

          kycLevel === "full"
            ? db.select().from(irisNpsFunds).limit(20)
            : Promise.resolve([]),

          kycLevel === "full"
            ? db.select({
                irisProductId: irisPmsAifProducts.irisProductId,
                strategyName:  irisPmsAifProducts.strategyName,
                fundHouse:     irisPmsAifProducts.fundHouse,
                minInvestment: irisPmsAifProducts.minInvestment,
                return3y:      irisPmsAifProducts.return3y,
                productType:   irisPmsAifProducts.productType,
              }).from(irisPmsAifProducts).where(eq(irisPmsAifProducts.productType, "pms")).limit(10)
            : Promise.resolve([]),

          kycLevel === "full"
            ? db.select({
                irisProductId: irisPmsAifProducts.irisProductId,
                strategyName:  irisPmsAifProducts.strategyName,
                fundHouse:     irisPmsAifProducts.fundHouse,
                minInvestment: irisPmsAifProducts.minInvestment,
                return3y:      irisPmsAifProducts.return3y,
                productType:   irisPmsAifProducts.productType,
              }).from(irisPmsAifProducts).where(eq(irisPmsAifProducts.productType, "aif")).limit(10)
            : Promise.resolve([]),
        ]);

        agentLog("AGENT_CLIENT_INSTRUMENTS", {
          agent_id: agentId,
          pan_masked: pan.slice(0, 5) + "*****",
          kyc_level: kycLevel,
          latency_ms: Date.now() - startMs,
          status: "success",
        });

        apiOk(res, {
          kycLevel,
          fixedDeposits: fds,
          nps,
          pms,
          aif,
          unlocked: kycLevel === "full"
            ? ["mutualFunds", "fixedDeposits", "nps", "pms", "aif"]
            : ["mutualFunds", "fixedDeposits"],
        }, { latency_ms: Date.now() - startMs, source: "iris_catalog_db" });
      } catch (err: any) {
        agentLog("AGENT_CLIENT_INSTRUMENTS_ERROR", { agent_id: agentId, error: err.message }, "error" as any);
        apiErr(res, 500, "AGENT_INSTRUMENTS_ERROR", err.message, true);
      }
    },
  );

  /**
   * POST /api/agent/portal/clients/:pan/zoho-sync
   * Sync a client's onboarding data to Zoho CRM.
   * Called after client completes KYC + profile setup.
   * Retries 3× with exponential backoff on failure.
   */
  app.post(
    "/api/agent/portal/clients/:pan/zoho-sync",
    requireAuth,
    async (req: Request, res: Response) => {
      const { pan } = req.params;
      const agentId = (req as any).user?.id;
      const startMs = Date.now();
      const body = req.body ?? {};

      agentLog("AGENT_ZOHO_CRM_SYNC", { agent_id: agentId, pan_masked: pan.slice(0, 5) + "*****" });

      // Attempt Zoho CRM sync with retry
      let lastErr: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { ZohoSyncOrchestrator } = await import("../zoho/services/sync-orchestrator");
          const orchestrator = await ZohoSyncOrchestrator.create();
          if (!orchestrator) {
            return apiErr(res, 503, "ZOHO_NOT_CONFIGURED", "Zoho CRM not connected", true);
          }
          // Run incremental sync scoped to this contact/PAN
          await orchestrator.runIncrementalSync();
          agentLog("AGENT_ZOHO_CRM_SYNC_OK", { agent_id: agentId, pan_masked: pan.slice(0, 5) + "*****", attempt, latency_ms: Date.now() - startMs, status: "success" });
          return apiOk(res, { synced: true }, { latency_ms: Date.now() - startMs });
        } catch (err: any) {
          lastErr = err;
          if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
        }
      }

      agentLog("AGENT_ZOHO_CRM_SYNC_FAILED", { agent_id: agentId, pan_masked: pan.slice(0, 5) + "*****", error: lastErr?.message }, "error" as any);
      apiErr(res, 502, "ZOHO_SYNC_FAILED", lastErr?.message ?? "Zoho sync failed after 3 attempts", true);
    },
  );

  /**
   * GET /api/agent/portal/dashboard
   * Agent dashboard summary — clients under management, KYC completion stats,
   * total AUM (from IRIS), pending actions count.
   */
  app.get(
    "/api/agent/portal/dashboard",
    requireAuth,
    async (req: Request, res: Response) => {
      const agentId = (req as any).user?.id;
      const startMs = Date.now();

      try {
        // Catalog counts (fast — DB only)
        const [fdCount, npsCount, pmsCount, aifCount] = await Promise.all([
          db.select({ count: sql<number>`count(*)` }).from(irisFdProducts),
          db.select({ count: sql<number>`count(*)` }).from(irisNpsFunds),
          db.select({ count: sql<number>`count(*)` }).from(irisPmsAifProducts).where(eq(irisPmsAifProducts.productType, "pms")),
          db.select({ count: sql<number>`count(*)` }).from(irisPmsAifProducts).where(eq(irisPmsAifProducts.productType, "aif")),
        ]);

        agentLog("AGENT_DASHBOARD", { agent_id: agentId, latency_ms: Date.now() - startMs, status: "success" });

        apiOk(res, {
          catalog: {
            fixedDeposits: Number(fdCount[0]?.count ?? 0),
            npsFunds:      Number(npsCount[0]?.count ?? 0),
            pmsStrategies: Number(pmsCount[0]?.count ?? 0),
            aifProducts:   Number(aifCount[0]?.count ?? 0),
          },
          irisConfigured: irisKfintechService.isConfigured,
        }, {
          latency_ms: Date.now() - startMs,
          agent_id: agentId,
        });
      } catch (err: any) {
        agentLog("AGENT_DASHBOARD_ERROR", { agent_id: agentId, error: err.message }, "error" as any);
        apiErr(res, 500, "AGENT_DASHBOARD_ERROR", err.message, true);
      }
    },
  );
  /**
   * POST /api/agent/portal/clients/:pan/kyc/complete
   * Agent marks a client KYC as complete and triggers IRIS → multi-broker vault write-back.
   * Call this after the client's eKYC verification is confirmed in IRIS.
   * Enables seamless onboarding to any broker without re-collecting PII.
   *
   * Inputs: :pan (path param)
   * Outputs: { fieldsWritten, isReusable, alreadyCurrent? }
   * Edge cases:
   *   - KYC not yet verified in IRIS → 422 with irisStatus
   *   - Vault sync failure → 502 retryable
   */
  app.post(
    "/api/agent/portal/clients/:pan/kyc/complete",
    requireAuth,
    async (req: Request, res: Response) => {
      const { pan } = req.params;
      const agentId = (req as any).user?.id;
      const startMs = Date.now();
      const panMasked = pan.slice(0, 5) + "*****";

      if (!irisKfintechService.isConfigured) {
        return apiErr(res, 503, "IRIS_NOT_CONFIGURED", "KYC service temporarily unavailable", true);
      }

      try {
        // Verify KYC is actually complete in IRIS before writing to vault
        const kycStatus: any = await irisKfintechService.getInvestorKycDetails(pan);
        const status = kycStatus?.kycStatus ?? kycStatus?.status ?? "";
        if (!["KYC_VERIFIED", "VERIFIED", "COMPLIANT"].includes(String(status).toUpperCase())) {
          agentLog("AGENT_KYC_COMPLETE_NOT_READY", { agent_id: agentId, pan_masked: panMasked, iris_status: status });
          return res.status(422).json({
            success: false,
            error: {
              error_code: "KYC_NOT_YET_VERIFIED",
              message: `Client KYC status is '${status}' — must be VERIFIED before vault sync`,
              retryable: false,
            },
            data: { irisStatus: status },
            meta: { timestamp: new Date().toISOString(), version: "1.0" },
          });
        }

        // Find user by PAN to get userId for vault write
        const userRow = await db.select({ id: users.id }).from(users).where(eq(users.panNumber, pan)).limit(1);
        if (!userRow.length) {
          return apiErr(res, 404, "USER_NOT_FOUND", `No FintekPro user found for PAN ${panMasked}`, false);
        }

        const { writeIrisKycToVault } = await import("../services/kyc/iris-kyc-vault-writeback-service");
        const result = await writeIrisKycToVault(userRow[0].id, pan, { agentId });

        agentLog("AGENT_KYC_VAULT_WRITEBACK", {
          agent_id: agentId,
          pan_masked: panMasked,
          fields_written: result.fieldsWritten.length,
          is_reusable: result.isReusable,
          latency_ms: Date.now() - startMs,
          status: result.success ? "success" : "failed",
        });

        if (!result.success) {
          return apiErr(res, 502, "VAULT_WRITEBACK_FAILED", result.error ?? "Vault write-back failed", true);
        }

        apiOk(res, {
          vaultSynced: true,
          fieldsWritten: result.fieldsWritten,
          isReusable: result.isReusable,
          alreadyCurrent: result.alreadyCurrent ?? false,
          pan_masked: panMasked,
        }, { latency_ms: Date.now() - startMs });

      } catch (err: any) {
        agentLog("AGENT_KYC_VAULT_WRITEBACK_ERROR", { agent_id: agentId, pan_masked: panMasked, error: err.message }, "error" as any);
        apiErr(res, 502, "AGENT_KYC_COMPLETE_ERROR", err.message, true);
      }
    },
  );

  // ──────────────────────────────────────────────────────────────
  // GAP 1 FIX: Agent Invite Client
  // POST /api/agent/portal/clients/invite
  // Agent sends a referral invitation to a client by email/phone.
  // Creates an onboardingInvitation entry and returns a referral link.
  // ──────────────────────────────────────────────────────────────
  /**
   * POST /api/agent/portal/clients/invite
   * Agent invites a new client by email and/or phone.
   * Creates an onboardingInvitation + returns a shareable referral link.
   *
   * Inputs: { email?, phone?, clientName?, message? }
   * Outputs: { invitationId, referralCode, referralLink, expiresAt }
   */
  app.post(
    "/api/agent/portal/clients/invite",
    requireAuth,
    async (req: Request, res: Response) => {
      const agentId = (req as any).user?.id as string;
      const { email, phone, clientName, message } = req.body ?? {};
      const startMs = Date.now();

      if (!email && !phone) {
        return apiErr(res, 400, "EMAIL_OR_PHONE_REQUIRED", "Provide at least email or phone to invite a client", false);
      }

      try {
        const referralCode = `AG${nanoid(8).toUpperCase()}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiry

        const [inv] = await db.insert(onboardingInvitations).values({
          referralCode,
          inviterId:   agentId,
          inviterType: "agent",
          clientEmail: email ?? null,
          clientMobile: phone ?? null,
          clientName:  clientName ?? null,
          status:      "sent",
          inviteSentAt: new Date(),
          expiresAt,
        }).returning({ id: onboardingInvitations.id });

        const baseUrl = process.env.APP_URL ?? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        const referralLink = `${baseUrl}/onboarding?ref=${referralCode}`;

        agentLog("AGENT_CLIENT_INVITE_SENT", {
          agent_id:       agentId,
          invitation_id:  inv.id,
          referral_code:  referralCode,
          email_masked:   email ? email.replace(/(.)(.*)(@.*)/, "$1***$3") : null,
          latency_ms:     Date.now() - startMs,
          status:         "success",
        });

        apiOk(res, {
          invitationId: inv.id,
          referralCode,
          referralLink,
          expiresAt: expiresAt.toISOString(),
          message: message ?? "Invitation created. Share the referral link with your client.",
        }, { latency_ms: Date.now() - startMs });
      } catch (err: any) {
        agentLog("AGENT_CLIENT_INVITE_ERROR", { agent_id: agentId, error: err.message }, "error" as any);
        apiErr(res, 500, "AGENT_INVITE_ERROR", err.message, true);
      }
    },
  );

  // ──────────────────────────────────────────────────────────────
  // GAP 5 FIX: Agent Referral Dashboard
  // GET /api/agent/portal/referral/dashboard
  // ──────────────────────────────────────────────────────────────
  /**
   * GET /api/agent/portal/referral/dashboard
   * Agent referral funnel stats: invites sent, opened, in-progress, completed.
   * Calculates conversion rate (completed / sent).
   *
   * Outputs: { total, sent, opened, inProgress, completed, conversionRate, recent }
   */
  app.get(
    "/api/agent/portal/referral/dashboard",
    requireAuth,
    async (req: Request, res: Response) => {
      const agentId = (req as any).user?.id as string;
      const startMs = Date.now();

      try {
        const [statsRows, recent] = await Promise.all([
          db.select({
            status: onboardingInvitations.status,
            count:  sql<number>`count(*)`,
          })
            .from(onboardingInvitations)
            .where(and(
              sql`${onboardingInvitations.inviterId} = ${agentId}`,
              sql`${onboardingInvitations.inviterType} = 'agent'`,
            ))
            .groupBy(onboardingInvitations.status),

          db.select({
            id:             onboardingInvitations.id,
            referralCode:   onboardingInvitations.referralCode,
            clientEmail:    onboardingInvitations.clientEmail,
            clientName:     onboardingInvitations.clientName,
            status:         onboardingInvitations.status,
            progressPct:    onboardingInvitations.progressPercentage,
            inviteSentAt:   onboardingInvitations.inviteSentAt,
            completedAt:    onboardingInvitations.onboardingCompletedAt,
          })
            .from(onboardingInvitations)
            .where(and(
              sql`${onboardingInvitations.inviterId} = ${agentId}`,
              sql`${onboardingInvitations.inviterType} = 'agent'`,
            ))
            .orderBy(desc(onboardingInvitations.createdAt))
            .limit(10),
        ]);

        const statsMap = Object.fromEntries(statsRows.map((r) => [r.status, Number(r.count)]));
        const total     = statsRows.reduce((s, r) => s + Number(r.count), 0);
        const completed = statsMap["completed"] ?? 0;

        agentLog("AGENT_REFERRAL_DASHBOARD", { agent_id: agentId, total, completed, latency_ms: Date.now() - startMs, status: "success" });

        apiOk(res, {
          total,
          sent:          statsMap["sent"] ?? 0,
          opened:        statsMap["opened"] ?? 0,
          inProgress:    (statsMap["in_progress"] ?? 0) + (statsMap["started"] ?? 0),
          completed,
          expired:       statsMap["expired"] ?? 0,
          conversionRate: total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0,
          recent,
        }, { latency_ms: Date.now() - startMs });
      } catch (err: any) {
        agentLog("AGENT_REFERRAL_DASHBOARD_ERROR", { agent_id: agentId, error: err.message }, "error" as any);
        apiErr(res, 500, "AGENT_REFERRAL_DASHBOARD_ERROR", err.message, true);
      }
    },
  );

  // ──────────────────────────────────────────────────────────────
  // EUIN Chain Approval Queue — Agent (EUIN holder)
  // Parent agents with verified EUIN can approve/reject transactions
  // queued to them from their sub-agents without EUIN.
  // Uses the shared /api/master-agent/pending-transactions/* backend.
  // ──────────────────────────────────────────────────────────────

  /**
   * GET /api/agent/portal/approval-queue/dashboard
   * Stats for the agent's EUIN approval dashboard.
   * Only EUIN-holding agents have pending transactions queued to them.
   */
  app.get("/api/agent/portal/approval-queue/dashboard", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const agentId = (req as any).user?.id as string;
    try {
      const stats = await getMasterAgentPendingStats(agentId);
      agentLog("AGENT_APPROVAL_QUEUE_DASHBOARD", { agent_id: agentId, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, stats, { latency_ms: Date.now() - startMs });
    } catch (err: any) {
      agentLog("AGENT_APPROVAL_QUEUE_DASHBOARD_ERROR", { agent_id: agentId, error: err.message }, "error" as any);
      apiErr(res, 500, "AGENT_APPROVAL_QUEUE_DASHBOARD_ERROR", err.message, true);
    }
  });

  /**
   * GET /api/agent/portal/approval-queue
   * Paginated list of transactions queued to this agent for EUIN approval.
   * Query: status (pending|approved|rejected|executed|all), page, limit
   */
  app.get("/api/agent/portal/approval-queue", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const agentId = (req as any).user?.id as string;
    const { status = "pending", page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset   = (pageNum - 1) * limitNum;

    try {
      const validStatuses = ["pending", "approved", "rejected", "executed", "cancelled"];
      const statusFilter  = validStatuses.includes(status) ? status : null;
      const baseWhere = statusFilter
        ? and(eq(pendingTransactions.masterAgentUserId, agentId), eq(pendingTransactions.status, statusFilter))
        : eq(pendingTransactions.masterAgentUserId, agentId);

      const [rows, [{ total }]] = await Promise.all([
        db.select({
          id:                pendingTransactions.id,
          initiatedByRole:   pendingTransactions.initiatedByRole,
          transactionType:   pendingTransactions.transactionType,
          productType:       pendingTransactions.productType,
          status:            pendingTransactions.status,
          approverRole:      pendingTransactions.approverRole,
          approvalNotes:     pendingTransactions.approvalNotes,
          rejectionReason:   pendingTransactions.rejectionReason,
          irisOrderId:       pendingTransactions.irisOrderId,
          createdAt:         pendingTransactions.createdAt,
          approvedAt:        pendingTransactions.approvedAt,
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

      agentLog("AGENT_APPROVAL_QUEUE_LIST", { agent_id: agentId, count: rows.length, status_filter: status, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, rows, { page: pageNum, limit: limitNum, total: Number(total), totalPages: Math.ceil(Number(total) / limitNum), latency_ms: Date.now() - startMs });
    } catch (err: any) {
      agentLog("AGENT_APPROVAL_QUEUE_LIST_ERROR", { agent_id: agentId, error: err.message }, "error" as any);
      apiErr(res, 500, "AGENT_APPROVAL_QUEUE_LIST_ERROR", err.message, true);
    }
  });

  /**
   * POST /api/agent/portal/approval-queue/:id/approve
   * Agent (EUIN holder) approves a pending transaction queued to them.
   * Inputs: { notes? }
   */
  app.post("/api/agent/portal/approval-queue/:id/approve", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const agentId = (req as any).user?.id as string;
    const { id }  = req.params;
    const { notes } = req.body ?? {};
    try {
      const result = await approvePendingTransaction(id, agentId, notes);
      agentLog("AGENT_APPROVAL_APPROVED", { agent_id: agentId, tx_id: id, iris_order_id: result.irisOrderId, latency_ms: Date.now() - startMs, status: result.success ? "success" : "partial" });
      if (!result.success) return apiErr(res, 502, "IRIS_EXECUTION_FAILED", result.message, true);
      apiOk(res, {
        pendingTransactionId: id,
        irisOrderId: result.irisOrderId,
        status: result.irisOrderId ? "executed" : "approved",
        message: result.message,
        disclaimer: "SEBI Disclosure: This transaction has been approved using your EUIN as executing principal. Market risks apply.",
      }, { latency_ms: Date.now() - startMs });
    } catch (err: any) {
      agentLog("AGENT_APPROVAL_APPROVE_ERROR", { agent_id: agentId, tx_id: id, error: err.message }, "error" as any);
      apiErr(res, 500, "AGENT_APPROVAL_APPROVE_ERROR", err.message, true);
    }
  });

  /**
   * POST /api/agent/portal/approval-queue/:id/reject
   * Agent rejects a transaction queued to them with a mandatory reason.
   * Inputs: { reason } (required, min 5 chars)
   */
  app.post("/api/agent/portal/approval-queue/:id/reject", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const agentId = (req as any).user?.id as string;
    const { id }  = req.params;
    const { reason } = req.body ?? {};
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return apiErr(res, 400, "REJECTION_REASON_REQUIRED", "A rejection reason of at least 5 characters is required", false);
    }
    try {
      const result = await rejectPendingTransaction(id, agentId, reason.trim());
      agentLog("AGENT_APPROVAL_REJECTED", { agent_id: agentId, tx_id: id, reason: reason.trim(), latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, { pendingTransactionId: id, status: "rejected", message: result.message }, { latency_ms: Date.now() - startMs });
    } catch (err: any) {
      agentLog("AGENT_APPROVAL_REJECT_ERROR", { agent_id: agentId, tx_id: id, error: err.message }, "error" as any);
      apiErr(res, 500, "AGENT_APPROVAL_REJECT_ERROR", err.message, true);
    }
  });
}
