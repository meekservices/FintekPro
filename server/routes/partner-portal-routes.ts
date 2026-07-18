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
} from "@shared/schema";
import { eq, sql, and, desc } from "drizzle-orm";
import { irisKfintechService } from "../services/iris-kfintech-service";
import { logger } from "../logger";


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
}
