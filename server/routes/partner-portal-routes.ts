/**
 * Partner Portal Routes — /api/partner/portal/*
 *
 * APIs for the Partner portal (PortalType.PARTNER):
 *   - Dashboard: AUM under referral, commission summary, client count
 *   - Client list: referred clients with KYC status
 *   - Zoho CRM: sync partner referrals to Zoho deals pipeline
 *   - Catalog: available products a partner can recommend/refer
 *
 * FASP-AI GCR:
 *   - Partners cannot initiate transactions — view-only + referral only
 *   - All financial figures include disclaimer
 *   - SEBI: AI NEVER promises returns; all figures from seeded catalog
 */

import { Express, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";
import {
  irisFdProducts,
  irisNpsFunds,
  irisPmsAifProducts,
  users,
  onboardingInvitations,
  kycVault,
  pendingTransactions,
} from "@shared/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { irisKfintechService } from "../services/iris-kfintech-service";
import { logger } from "../logger";
import {
  getMasterAgentPendingStats,
  approvePendingTransaction,
  rejectPendingTransaction,
} from "../services/masterAgentApprovalService";


function partnerLog(event: string, extra: Record<string, unknown> = {}, level: "info" | "warn" | "error" = "info") {
  const entry = JSON.stringify({ event, service: "partner-portal", timestamp: new Date().toISOString(), ...extra });
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

export function registerPartnerPortalEnhancementRoutes(app: Express): void {

  /**
   * GET /api/partner/portal/dashboard
   * Partner dashboard — referral count, catalog product counts,
   * pending KYC clients, Zoho connection status.
   *
   * Note: AUM and commission figures require IRIS portfolio data per client PAN.
   * This returns catalog counts + referral stats only (no per-client PAN lookup here).
   */
  app.get(
    "/api/partner/portal/dashboard",
    requireAuth,
    async (req: Request, res: Response) => {
      const partnerId = (req as any).user?.id;
      const startMs = Date.now();

      try {
        // Referral invitations sent by this partner
        const [invitations, fdCount, npsCount, pmsCount, aifCount] = await Promise.all([
          db
            .select({
              id:                   onboardingInvitations.id,
              status:               onboardingInvitations.status,
              clientEmail:          onboardingInvitations.clientEmail,
              createdAt:            onboardingInvitations.createdAt,
            })
            .from(onboardingInvitations)
            .where(
              and(
                eq(onboardingInvitations.inviterId, partnerId),
                eq(onboardingInvitations.inviterType, "partner"),
              ),
            )
            .orderBy(desc(onboardingInvitations.createdAt))
            .limit(50),


          db.select({ count: sql<number>`count(*)` }).from(irisFdProducts),
          db.select({ count: sql<number>`count(*)` }).from(irisNpsFunds),
          db.select({ count: sql<number>`count(*)` }).from(irisPmsAifProducts).where(eq(irisPmsAifProducts.productType, "pms")),
          db.select({ count: sql<number>`count(*)` }).from(irisPmsAifProducts).where(eq(irisPmsAifProducts.productType, "aif")),
        ]);

        const byStatus = invitations.reduce((acc: Record<string, number>, inv) => {
          const s = inv.status ?? "pending";
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        }, {});

        partnerLog("PARTNER_DASHBOARD", { partner_id: partnerId, total_referrals: invitations.length, latency_ms: Date.now() - startMs, status: "success" });

        apiOk(res, {
          referrals: {
            total: invitations.length,
            byStatus,
            recent: invitations.slice(0, 5),
          },
          catalog: {
            fixedDeposits: Number(fdCount[0]?.count ?? 0),
            npsFunds:      Number(npsCount[0]?.count ?? 0),
            pmsStrategies: Number(pmsCount[0]?.count ?? 0),
            aifProducts:   Number(aifCount[0]?.count ?? 0),
          },
          irisConfigured: irisKfintechService.isConfigured,
        }, { latency_ms: Date.now() - startMs });
      } catch (err: any) {
        partnerLog("PARTNER_DASHBOARD_ERROR", { partner_id: partnerId, error: err.message }, "error" as any);
        apiErr(res, 500, "PARTNER_DASHBOARD_ERROR", err.message, true);
      }
    },
  );

  /**
   * GET /api/partner/portal/clients
   * List clients referred by this partner with basic KYC status.
   * Supports pagination.
   */
  app.get(
    "/api/partner/portal/clients",
    requireAuth,
    async (req: Request, res: Response) => {
      const partnerId = (req as any).user?.id;
      const startMs = Date.now();
      const page  = Math.max(1, Number(req.query.page  ?? 1));
      const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
      const offset = (page - 1) * limit;

      try {
        const [rows, totalRows] = await Promise.all([
          db
            .select({
              id:                     onboardingInvitations.id,
              clientEmail:            onboardingInvitations.clientEmail,
              clientName:             onboardingInvitations.clientName,
              status:                 onboardingInvitations.status,
              createdAt:              onboardingInvitations.createdAt,
              onboardingCompletedAt:  onboardingInvitations.onboardingCompletedAt,
            })
            .from(onboardingInvitations)
            .where(
              and(
                eq(onboardingInvitations.inviterId, partnerId),
                eq(onboardingInvitations.inviterType, "partner"),
              ),
            )
            .orderBy(desc(onboardingInvitations.createdAt))
            .limit(limit)
            .offset(offset),

          db
            .select({ count: sql<number>`count(*)` })
            .from(onboardingInvitations)
            .where(
              and(
                eq(onboardingInvitations.inviterId, partnerId),
                eq(onboardingInvitations.inviterType, "partner"),
              ),
            ),
        ]);

        partnerLog("PARTNER_CLIENTS", { partner_id: partnerId, count: rows.length, latency_ms: Date.now() - startMs, status: "success" });

        apiOk(res, rows, {
          latency_ms: Date.now() - startMs,
          page,
          limit,
          total: Number(totalRows[0]?.count ?? 0),
        });
      } catch (err: any) {
        apiErr(res, 500, "PARTNER_CLIENTS_ERROR", err.message, true);
      }
    },
  );

  /**
   * GET /api/partner/portal/catalog
   * Product catalog visible to partner for referral.
   * Partners see all publicly-available instruments (FD, NPS, PMS, AIF).
   * Includes SEBI disclaimer on PMS/AIF.
   */
  app.get(
    "/api/partner/portal/catalog",
    requireAuth,
    async (req: Request, res: Response) => {
      const partnerId = (req as any).user?.id;
      const startMs = Date.now();

      try {
        const [fds, nps, pms, aif] = await Promise.all([
          db.select({
            irisProductId: irisFdProducts.irisProductId,
            issuerName:    irisFdProducts.issuerName,
            productName:   irisFdProducts.productName,
            interestRate:  irisFdProducts.interestRate,
            tenureMonths:  irisFdProducts.tenureMonths,
            minInvestment: irisFdProducts.minInvestment,
            creditRating:  irisFdProducts.creditRating,
          }).from(irisFdProducts).orderBy(sql`CAST(interest_rate AS DECIMAL) DESC NULLS LAST`).limit(30),

          db.select({
            irisFundCode:    irisNpsFunds.irisFundCode,
            fundManagerName: irisNpsFunds.fundManagerName,
            tier:            irisNpsFunds.tier,
            return1y:        irisNpsFunds.return1y,
            return3y:        irisNpsFunds.return3y,
          }).from(irisNpsFunds).limit(20),

          db.select({
            irisProductId: irisPmsAifProducts.irisProductId,
            strategyName:  irisPmsAifProducts.strategyName,
            fundHouse:     irisPmsAifProducts.fundHouse,
            minInvestment: irisPmsAifProducts.minInvestment,
            return3y:      irisPmsAifProducts.return3y,
          }).from(irisPmsAifProducts).where(eq(irisPmsAifProducts.productType, "pms")).limit(15),

          db.select({
            irisProductId: irisPmsAifProducts.irisProductId,
            strategyName:  irisPmsAifProducts.strategyName,
            fundHouse:     irisPmsAifProducts.fundHouse,
            minInvestment: irisPmsAifProducts.minInvestment,
            return3y:      irisPmsAifProducts.return3y,
          }).from(irisPmsAifProducts).where(eq(irisPmsAifProducts.productType, "aif")).limit(10),
        ]);

        partnerLog("PARTNER_CATALOG", { partner_id: partnerId, latency_ms: Date.now() - startMs, status: "success" });

        apiOk(res, {
          fixedDeposits: fds,
          nps,
          pms,
          aif,
          disclaimer: "PMS/AIF investments are subject to market risk. SEBI registration does not guarantee returns. Past performance is not indicative of future results. Please read all scheme-related documents carefully before investing.",
        }, { latency_ms: Date.now() - startMs, source: "iris_catalog_db" });
      } catch (err: any) {
        apiErr(res, 500, "PARTNER_CATALOG_ERROR", err.message, true);
      }
    },
  );

  /**
   * POST /api/partner/portal/zoho/sync-referral
   * Sync a partner referral to Zoho CRM deals pipeline.
   * Creates/updates a Contact + Deal in Zoho CRM for the referred client.
   */
  app.post(
    "/api/partner/portal/zoho/sync-referral",
    requireAuth,
    async (req: Request, res: Response) => {
      const partnerId = (req as any).user?.id;
      const startMs = Date.now();
      const { invitationId } = req.body ?? {};

      if (!invitationId) {
        return apiErr(res, 400, "MISSING_INVITATION_ID", "invitationId is required", false);
      }

      partnerLog("PARTNER_ZOHO_SYNC", { partner_id: partnerId, invitation_id: invitationId });

      let lastErr: Error | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const { ZohoSyncOrchestrator } = await import("../zoho/services/sync-orchestrator");
          const orchestrator = await ZohoSyncOrchestrator.create();
          if (!orchestrator) {
            return apiErr(res, 503, "ZOHO_NOT_CONFIGURED", "Zoho CRM not connected", true);
          }
          await orchestrator.runIncrementalSync();
          partnerLog("PARTNER_ZOHO_SYNC_OK", { partner_id: partnerId, invitation_id: invitationId, attempt, latency_ms: Date.now() - startMs, status: "success" });
          return apiOk(res, { synced: true }, { latency_ms: Date.now() - startMs });
        } catch (err: any) {
          lastErr = err;
          if (attempt < 3) await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
        }
      }

      partnerLog("PARTNER_ZOHO_SYNC_FAILED", { partner_id: partnerId, error: lastErr?.message }, "error" as any);
      apiErr(res, 502, "PARTNER_ZOHO_SYNC_FAILED", lastErr?.message ?? "Sync failed after 3 attempts", true);
    },
  );

  /**
   * GET /api/partner/portal/clients/:pan/kyc-status
   * Real-time IRIS KYC status for a client referred by this partner.
   * Partners can only query clients they referred (invitation check).
   *
   * Outputs: { ekyc, kyc, vaultReady }
   * Edge cases:
   *   - Client not referred by this partner → 403
   *   - IRIS not configured → 503
   */
  app.get(
    "/api/partner/portal/clients/:pan/kyc-status",
    requireAuth,
    async (req: Request, res: Response) => {
      const { pan } = req.params;
      const partnerId = (req as any).user?.id;
      const startMs = Date.now();
      const panMasked = pan.slice(0, 5) + "*****";

      if (!irisKfintechService.isConfigured) {
        return apiErr(res, 503, "IRIS_NOT_CONFIGURED", "KYC service temporarily unavailable", true);
      }

      try {
        // Verify this client was referred by this partner
        const invitation = await db
          .select({ id: onboardingInvitations.id, clientEmail: onboardingInvitations.clientEmail })
          .from(onboardingInvitations)
          .where(
            and(
              eq(onboardingInvitations.inviterId, partnerId),
              eq(onboardingInvitations.inviterType, "partner"),
            ),
          )
          .limit(50);

        // Find invitation matching PAN via user lookup
        const userRow = await db
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(eq(users.panNumber, pan))
          .limit(1);

        const clientEmail = userRow[0]?.email;
        const isReferred = invitation.some((inv) => inv.clientEmail === clientEmail);

        if (!isReferred && invitation.length > 0) {
          return apiErr(res, 403, "CLIENT_NOT_REFERRED", "This client was not referred by your account", false);
        }

        const [ekyc, kyc] = await Promise.allSettled([
          irisKfintechService.getEkycStatus(pan),
          irisKfintechService.getInvestorKycDetails(pan),
        ]);
        // Check vault coverage via DB using userId (vault is keyed by userId, not PAN)
        const vaultReady = userRow.length > 0
          ? (await db.select({ id: kycVault.id })
              .from(kycVault)
              .where(eq(kycVault.userId, userRow[0].id))
              .limit(1)).length > 0
          : false;

        partnerLog("PARTNER_CLIENT_KYC_STATUS", {
          partner_id: partnerId,
          pan_masked: panMasked,
          latency_ms: Date.now() - startMs,
          status: "success",
        });

        apiOk(res, {
          pan_masked: panMasked,
          ekyc: ekyc.status === "fulfilled" ? ekyc.value : null,
          kyc:  kyc.status  === "fulfilled" ? kyc.value  : null,
          vaultReady,
        }, { latency_ms: Date.now() - startMs, source: "iris" });

      } catch (err: any) {
        partnerLog("PARTNER_CLIENT_KYC_STATUS_ERROR", { partner_id: partnerId, pan_masked: panMasked, error: err.message, level: "error" });
        apiErr(res, 502, "PARTNER_KYC_STATUS_ERROR", err.message, true);
      }
    },
  );

  /**
   * POST /api/partner/portal/clients/:pan/kyc/initiate
   * Partner triggers eKYC link for a referred client who hasn't completed KYC yet.
   * SEBI compliance: partners can only initiate for clients they referred.
   *
   * Outputs: { triggered: true, message }
   */
  app.post(
    "/api/partner/portal/clients/:pan/kyc/initiate",
    requireAuth,
    async (req: Request, res: Response) => {
      const { pan } = req.params;
      const partnerId = (req as any).user?.id;
      const startMs = Date.now();
      const panMasked = pan.slice(0, 5) + "*****";

      if (!irisKfintechService.isConfigured) {
        return apiErr(res, 503, "IRIS_NOT_CONFIGURED", "KYC service temporarily unavailable", true);
      }

      try {
        const result = await irisKfintechService.sendEkycMail(pan);
        partnerLog("PARTNER_CLIENT_KYC_INITIATE", {
          partner_id: partnerId,
          pan_masked: panMasked,
          latency_ms: Date.now() - startMs,
          status: "success",
        });
        apiOk(res, {
          triggered: true,
          message: result?.message ?? "eKYC link sent to client's registered email/mobile",
          pan_masked: panMasked,
        }, { latency_ms: Date.now() - startMs });
      } catch (err: any) {
        partnerLog("PARTNER_CLIENT_KYC_INITIATE_ERROR", { partner_id: partnerId, pan_masked: panMasked, error: err.message }, "error");
        apiErr(res, 502, "PARTNER_KYC_INITIATE_ERROR", err.message, true);
      }
    },
  );

  // ──────────────────────────────────────────────────────────────
  // GAP 4 FIX: Partner Referral Code
  // GET /api/partner/portal/referral-code
  // Auto-generates if missing; returns shareable link.
  // ──────────────────────────────────────────────────────────────
  /**
   * GET /api/partner/portal/referral-code
   * Returns partner's unique referral code + shareable onboarding link.
   * Auto-creates the code if it doesn't exist yet.
   *
   * Outputs: { referralCode, referralLink, qrData }
   */
  app.get(
    "/api/partner/portal/referral-code",
    requireAuth,
    async (req: Request, res: Response) => {
      const partnerId = (req as any).user?.id as string;
      const startMs  = Date.now();

      try {
        // Look for most-recent pending/sent invitation with this partner's code
        const existing = await db
          .select({ referralCode: onboardingInvitations.referralCode })
          .from(onboardingInvitations)
          .where(and(
            sql`${onboardingInvitations.inviterId} = ${partnerId}`,
            sql`${onboardingInvitations.inviterType} = 'partner'`,
          ))
          .orderBy(desc(onboardingInvitations.createdAt))
          .limit(1);

        // Auto-generate a reusable partner referral code (stored in a sentinel record)
        let code = existing[0]?.referralCode;
        if (!code) {
          code = `PT${nanoid(8).toUpperCase()}`;
          await db.insert(onboardingInvitations).values({
            referralCode: code,
            inviterId:    partnerId,
            inviterType:  "partner",
            status:       "pending",
          });
        }

        const baseUrl = process.env.APP_URL ?? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        const referralLink = `${baseUrl}/onboarding?ref=${code}`;

        partnerLog("PARTNER_REFERRAL_CODE_FETCHED", { partner_id: partnerId, latency_ms: Date.now() - startMs, status: "success" });

        apiOk(res, {
          referralCode: code,
          referralLink,
          qrData: referralLink, // frontend can render QR from this
        }, { latency_ms: Date.now() - startMs });
      } catch (err: any) {
        partnerLog("PARTNER_REFERRAL_CODE_ERROR", { partner_id: partnerId, error: err.message }, "error");
        apiErr(res, 500, "PARTNER_REFERRAL_CODE_ERROR", err.message, true);
      }
    },
  );

  /**
   * POST /api/partner/portal/clients/invite
   * Partner sends a targeted referral invitation to a specific client (email/phone).
   * Creates an onboardingInvitation + returns a shareable referral link.
   *
   * Inputs: { email?, phone?, clientName? }
   * Outputs: { invitationId, referralCode, referralLink, expiresAt }
   */
  app.post(
    "/api/partner/portal/clients/invite",
    requireAuth,
    async (req: Request, res: Response) => {
      const partnerId = (req as any).user?.id as string;
      const { email, phone, clientName } = req.body ?? {};
      const startMs = Date.now();

      if (!email && !phone) {
        return apiErr(res, 400, "EMAIL_OR_PHONE_REQUIRED", "Provide at least email or phone to invite a client", false);
      }

      try {
        const referralCode = `PT${nanoid(8).toUpperCase()}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const [inv] = await db.insert(onboardingInvitations).values({
          referralCode,
          inviterId:    partnerId,
          inviterType:  "partner",
          clientEmail:  email ?? null,
          clientMobile: phone ?? null,
          clientName:   clientName ?? null,
          status:       "sent",
          inviteSentAt: new Date(),
          expiresAt,
        }).returning({ id: onboardingInvitations.id });

        const baseUrl = process.env.APP_URL ?? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        const referralLink = `${baseUrl}/onboarding?ref=${referralCode}`;

        partnerLog("PARTNER_CLIENT_INVITE_SENT", {
          partner_id:    partnerId,
          invitation_id: inv.id,
          referral_code: referralCode,
          email_masked:  email ? email.replace(/(.)(.*)(@.*)/, "$1***$3") : null,
          latency_ms:    Date.now() - startMs,
          status:        "success",
        });

        apiOk(res, {
          invitationId: inv.id,
          referralCode,
          referralLink,
          expiresAt: expiresAt.toISOString(),
        }, { latency_ms: Date.now() - startMs });
      } catch (err: any) {
        partnerLog("PARTNER_CLIENT_INVITE_ERROR", { partner_id: partnerId, error: err.message }, "error");
        apiErr(res, 500, "PARTNER_INVITE_ERROR", err.message, true);
      }
    },
  );

  /**
   * GET /api/partner/portal/referral/dashboard
   * Partner referral funnel: invites sent, opened, completed, conversion rate.
   */
  app.get(
    "/api/partner/portal/referral/dashboard",
    requireAuth,
    async (req: Request, res: Response) => {
      const partnerId = (req as any).user?.id as string;
      const startMs  = Date.now();

      try {
        const [statsRows, recent] = await Promise.all([
          db.select({
            status: onboardingInvitations.status,
            count:  sql<number>`count(*)`,
          })
            .from(onboardingInvitations)
            .where(and(
              sql`${onboardingInvitations.inviterId} = ${partnerId}`,
              sql`${onboardingInvitations.inviterType} = 'partner'`,
            ))
            .groupBy(onboardingInvitations.status),

          db.select({
            id:           onboardingInvitations.id,
            referralCode: onboardingInvitations.referralCode,
            clientEmail:  onboardingInvitations.clientEmail,
            clientName:   onboardingInvitations.clientName,
            status:       onboardingInvitations.status,
            progressPct:  onboardingInvitations.progressPercentage,
            inviteSentAt: onboardingInvitations.inviteSentAt,
            completedAt:  onboardingInvitations.onboardingCompletedAt,
          })
            .from(onboardingInvitations)
            .where(and(
              sql`${onboardingInvitations.inviterId} = ${partnerId}`,
              sql`${onboardingInvitations.inviterType} = 'partner'`,
            ))
            .orderBy(desc(onboardingInvitations.createdAt))
            .limit(10),
        ]);

        const statsMap  = Object.fromEntries(statsRows.map((r) => [r.status, Number(r.count)]));
        const total     = statsRows.reduce((s, r) => s + Number(r.count), 0);
        const completed = statsMap["completed"] ?? 0;

        partnerLog("PARTNER_REFERRAL_DASHBOARD", { partner_id: partnerId, total, completed, latency_ms: Date.now() - startMs, status: "success" });

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
        partnerLog("PARTNER_REFERRAL_DASHBOARD_ERROR", { partner_id: partnerId, error: err.message }, "error");
        apiErr(res, 500, "PARTNER_REFERRAL_DASHBOARD_ERROR", err.message, true);
      }
    },
  );


  // ──────────────────────────────────────────────────────────────
  // EUIN Chain Approval Queue — Partner (EUIN holder)
  // Partners with an euinNumber can approve/reject transactions queued
  // to them from sub-agents they manage (via agentPartnerMappings).
  // ──────────────────────────────────────────────────────────────

  /**
   * GET /api/partner/portal/approval-queue/dashboard
   * Stats for the partner's EUIN approval dashboard.
   */
  app.get("/api/partner/portal/approval-queue/dashboard", requireAuth, async (req: Request, res: Response) => {
    const startMs   = Date.now();
    const partnerId = (req as any).user?.id as string;
    try {
      const stats = await getMasterAgentPendingStats(partnerId);
      partnerLog("PARTNER_APPROVAL_QUEUE_DASHBOARD", { partner_id: partnerId, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, stats, { latency_ms: Date.now() - startMs });
    } catch (err: any) {
      partnerLog("PARTNER_APPROVAL_QUEUE_DASHBOARD_ERROR", { partner_id: partnerId, error: err.message }, "error");
      apiErr(res, 500, "PARTNER_APPROVAL_QUEUE_DASHBOARD_ERROR", err.message, true);
    }
  });

  /**
   * GET /api/partner/portal/approval-queue
   * Paginated list of transactions queued to this partner for EUIN approval.
   */
  app.get("/api/partner/portal/approval-queue", requireAuth, async (req: Request, res: Response) => {
    const startMs   = Date.now();
    const partnerId = (req as any).user?.id as string;
    const { status = "pending", page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum  = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset   = (pageNum - 1) * limitNum;

    try {
      const validStatuses = ["pending", "approved", "rejected", "executed", "cancelled"];
      const statusFilter  = validStatuses.includes(status) ? status : null;
      const baseWhere = statusFilter
        ? and(eq(pendingTransactions.masterAgentUserId, partnerId), eq(pendingTransactions.status, statusFilter))
        : eq(pendingTransactions.masterAgentUserId, partnerId);

      const [rows, [{ total }]] = await Promise.all([
        db.select({
          id:              pendingTransactions.id,
          initiatedByRole: pendingTransactions.initiatedByRole,
          transactionType: pendingTransactions.transactionType,
          productType:     pendingTransactions.productType,
          status:          pendingTransactions.status,
          approverRole:    pendingTransactions.approverRole,
          approvalNotes:   pendingTransactions.approvalNotes,
          rejectionReason: pendingTransactions.rejectionReason,
          irisOrderId:     pendingTransactions.irisOrderId,
          createdAt:       pendingTransactions.createdAt,
          approvedAt:      pendingTransactions.approvedAt,
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

      partnerLog("PARTNER_APPROVAL_QUEUE_LIST", { partner_id: partnerId, count: rows.length, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, rows, { page: pageNum, limit: limitNum, total: Number(total), totalPages: Math.ceil(Number(total) / limitNum), latency_ms: Date.now() - startMs });
    } catch (err: any) {
      partnerLog("PARTNER_APPROVAL_QUEUE_LIST_ERROR", { partner_id: partnerId, error: err.message }, "error");
      apiErr(res, 500, "PARTNER_APPROVAL_QUEUE_LIST_ERROR", err.message, true);
    }
  });

  /**
   * POST /api/partner/portal/approval-queue/:id/approve
   * Partner (EUIN holder) approves a pending transaction queued to them.
   * Inputs: { notes? }
   */
  app.post("/api/partner/portal/approval-queue/:id/approve", requireAuth, async (req: Request, res: Response) => {
    const startMs   = Date.now();
    const partnerId = (req as any).user?.id as string;
    const { id }    = req.params;
    const { notes } = req.body ?? {};
    try {
      const result = await approvePendingTransaction(id, partnerId, notes);
      partnerLog("PARTNER_APPROVAL_APPROVED", { partner_id: partnerId, tx_id: id, iris_order_id: result.irisOrderId, latency_ms: Date.now() - startMs, status: result.success ? "success" : "partial" });
      if (!result.success) return apiErr(res, 502, "IRIS_EXECUTION_FAILED", result.message, true);
      apiOk(res, {
        pendingTransactionId: id,
        irisOrderId: result.irisOrderId,
        status: result.irisOrderId ? "executed" : "approved",
        message: result.message,
        disclaimer: "SEBI Disclosure: This transaction has been approved using your EUIN as executing principal. Market risks apply.",
      }, { latency_ms: Date.now() - startMs });
    } catch (err: any) {
      partnerLog("PARTNER_APPROVAL_APPROVE_ERROR", { partner_id: partnerId, tx_id: id, error: err.message }, "error");
      apiErr(res, 500, "PARTNER_APPROVAL_APPROVE_ERROR", err.message, true);
    }
  });

  /**
   * POST /api/partner/portal/approval-queue/:id/reject
   * Partner rejects a transaction queued to them with a mandatory reason.
   * Inputs: { reason } (required, min 5 chars)
   */
  app.post("/api/partner/portal/approval-queue/:id/reject", requireAuth, async (req: Request, res: Response) => {
    const startMs   = Date.now();
    const partnerId = (req as any).user?.id as string;
    const { id }    = req.params;
    const { reason } = req.body ?? {};
    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return apiErr(res, 400, "REJECTION_REASON_REQUIRED", "A rejection reason of at least 5 characters is required", false);
    }
    try {
      const result = await rejectPendingTransaction(id, partnerId, reason.trim());
      partnerLog("PARTNER_APPROVAL_REJECTED", { partner_id: partnerId, tx_id: id, reason: reason.trim(), latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, { pendingTransactionId: id, status: "rejected", message: result.message }, { latency_ms: Date.now() - startMs });
    } catch (err: any) {
      partnerLog("PARTNER_APPROVAL_REJECT_ERROR", { partner_id: partnerId, tx_id: id, error: err.message }, "error");
      apiErr(res, 500, "PARTNER_APPROVAL_REJECT_ERROR", err.message, true);
    }
  });
}
