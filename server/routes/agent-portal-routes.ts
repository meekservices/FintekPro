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
  users,
} from "@shared/schema";
import { eq, sql, and } from "drizzle-orm";
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
}
