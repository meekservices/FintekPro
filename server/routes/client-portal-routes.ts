/**
 * Client Portal Routes — /api/client/*
 *
 * Thin, fast data APIs for the client-facing portal (PortalType.MAIN).
 * All catalog reads hit the local IRIS-seeded DB (< 5ms) — no live IRIS call.
 * Live data (eKYC status, portfolio) proxied from IRIS.
 *
 * FASP-AI: All routes require authenticated client session.
 * PAN is resolved from session — clients cannot query other clients' data.
 */

import { Express, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";
import {
  irisFdProducts,
  irisNpsFunds,
  irisPmsAifProducts,
  mutualFunds,
} from "@shared/schema";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { irisKfintechService } from "../services/iris-kfintech-service";
import { logger } from "../logger";


function clientLog(event: string, extra: Record<string, unknown> = {}) {
  logger.info(JSON.stringify({ event, service: "client-portal", timestamp: new Date().toISOString(), ...extra }));
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

export function registerClientPortalRoutes(app: Express): void {

  /**
   * GET /api/client/instruments
   * Instrument catalog summary for client discovery page.
   * Reads from locally seeded IRIS tables — no live API call, < 5ms.
   * Returns best FD rates, NPS fund overview, MF category count, PMS/AIF count.
   */
  app.get("/api/client/instruments", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const userId = (req as any).user?.id;
    try {
      const [fdRows, npsRows, pmsRows, aifRows, mfCount] = await Promise.all([
        db.select({
          irisProductId: irisFdProducts.irisProductId,
          issuerName:    irisFdProducts.issuerName,
          productName:   irisFdProducts.productName,
          interestRate:  irisFdProducts.interestRate,
          tenureMonths:  irisFdProducts.tenureMonths,
          minInvestment: irisFdProducts.minInvestment,
          creditRating:  irisFdProducts.creditRating,
          category:      irisFdProducts.category,
        })
          .from(irisFdProducts)
          .orderBy(sql`CAST(interest_rate AS DECIMAL) DESC NULLS LAST`)
          .limit(5),

        db.select({
          irisFundCode:    irisNpsFunds.irisFundCode,
          fundManagerName: irisNpsFunds.fundManagerName,
          tier:            irisNpsFunds.tier,
          return1y:        irisNpsFunds.return1y,
          return3y:        irisNpsFunds.return3y,
          return5y:        irisNpsFunds.return5y,
        })
          .from(irisNpsFunds)
          .limit(10),

        db.select({ count: sql<number>`count(*)` })
          .from(irisPmsAifProducts)
          .where(eq(irisPmsAifProducts.productType, "pms")),

        db.select({ count: sql<number>`count(*)` })
          .from(irisPmsAifProducts)
          .where(eq(irisPmsAifProducts.productType, "aif")),

        db.select({ count: sql<number>`count(*)` }).from(mutualFunds),
      ]);

      clientLog("CLIENT_INSTRUMENTS_FETCHED", {
        user_id: userId,
        fd_count: fdRows.length,
        latency_ms: Date.now() - startMs,
        status: "success",
      });

      apiOk(res, {
        fixedDeposits: { topRates: fdRows, count: fdRows.length },
        nps:           { funds: npsRows, count: npsRows.length },
        pms:           { count: Number(pmsRows[0]?.count ?? 0) },
        aif:           { count: Number(aifRows[0]?.count ?? 0) },
        mutualFunds:   { count: Number(mfCount[0]?.count ?? 0) },
      }, { latency_ms: Date.now() - startMs, source: "iris_catalog_db" });
    } catch (err: any) {
      logger.error(JSON.stringify({ event: "CLIENT_INSTRUMENTS_ERROR", service: "client-portal", ...({ user_id: userId, error: err.message }), timestamp: new Date().toISOString() }));
      apiErr(res, 500, "CLIENT_INSTRUMENTS_ERROR", err.message, true);
    }
  });

  /**
   * GET /api/client/kyc-status
   * eKYC status for the logged-in client's PAN.
   * Requires pan to be present in user profile.
   */
  app.get("/api/client/kyc-status", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const user = (req as any).user;
    const pan: string | undefined = user?.pan ?? user?.panNumber;

    if (!pan) {
      return apiErr(res, 400, "CLIENT_KYC_NO_PAN", "PAN not found in your profile. Please update your profile first.", false);
    }

    if (!irisKfintechService.isConfigured) {
      return apiErr(res, 503, "IRIS_NOT_CONFIGURED", "KYC service temporarily unavailable", true);
    }

    try {
      const [ekycStatus, kycDetails] = await Promise.allSettled([
        irisKfintechService.getEkycStatus(pan),
        irisKfintechService.getInvestorKycDetails(pan),
      ]);

      clientLog("CLIENT_KYC_STATUS", {
        user_id: user.id,
        pan_masked: pan.slice(0, 5) + "*****",
        latency_ms: Date.now() - startMs,
        status: "success",
      });

      apiOk(res, {
        ekyc: ekycStatus.status === "fulfilled" ? ekycStatus.value : null,
        kyc:  kycDetails.status === "fulfilled" ? kycDetails.value : null,
      }, { latency_ms: Date.now() - startMs });
    } catch (err: any) {
      apiErr(res, 502, "CLIENT_KYC_ERROR", err.message, true);
    }
  });

  /**
   * GET /api/client/portfolio
   * Client's portfolio summary from IRIS.
   * Requires PAN in user profile.
   */
  app.get("/api/client/portfolio", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const user = (req as any).user;
    const pan: string | undefined = user?.pan ?? user?.panNumber;

    if (!pan) {
      return apiErr(res, 400, "CLIENT_PORTFOLIO_NO_PAN", "PAN not found in your profile.", false);
    }

    if (!irisKfintechService.isConfigured) {
      return apiErr(res, 503, "IRIS_NOT_CONFIGURED", "Portfolio service temporarily unavailable", true);
    }

    try {
      const summary = await irisKfintechService.getPortfolioSummary(pan);
      clientLog("CLIENT_PORTFOLIO", { user_id: user.id, pan_masked: pan.slice(0, 5) + "*****", latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, summary, { latency_ms: Date.now() - startMs, source: "iris" });
    } catch (err: any) {
      apiErr(res, 502, "CLIENT_PORTFOLIO_ERROR", err.message, true);
    }
  });

  /**
   * GET /api/client/transactions
   * Client's transaction history from IRIS.
   */
  app.get("/api/client/transactions", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const user = (req as any).user;
    const pan: string | undefined = user?.pan ?? user?.panNumber;
    const { page = "1", limit = "20" } = req.query as Record<string, string>;

    if (!pan) {
      return apiErr(res, 400, "CLIENT_TX_NO_PAN", "PAN not found in your profile.", false);
    }

    if (!irisKfintechService.isConfigured) {
      return apiErr(res, 503, "IRIS_NOT_CONFIGURED", "Transaction service temporarily unavailable", true);
    }

    try {
      const txns = await irisKfintechService.getTransactionDetails(pan, { page, limit });
      clientLog("CLIENT_TRANSACTIONS", { user_id: user.id, pan_masked: pan.slice(0, 5) + "*****", latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, txns, {
        latency_ms: Date.now() - startMs,
        page: Number(page),
        limit: Number(limit),
      });
    } catch (err: any) {
      apiErr(res, 502, "CLIENT_TX_ERROR", err.message, true);
    }
  });
  /**
   * POST /api/client/kyc/initiate
   * Client self-service: send eKYC OTP/link via IRIS.
   * PAN is resolved from the authenticated session — client cannot spoof another PAN.
   *
   * Inputs: none (PAN from session)
   * Outputs: { triggered: true, message } | error
   * Edge cases:
   *   - PAN not in profile → 400
   *   - IRIS not configured → 503
   *   - IRIS error → 502 retryable
   */
  app.post("/api/client/kyc/initiate", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const user = (req as any).user;
    const pan: string | undefined = user?.pan ?? user?.panNumber;

    if (!pan) {
      return apiErr(res, 400, "CLIENT_KYC_NO_PAN", "PAN not found in your profile. Please update your profile first.", false);
    }
    if (!irisKfintechService.isConfigured) {
      return apiErr(res, 503, "IRIS_NOT_CONFIGURED", "KYC service temporarily unavailable", true);
    }

    try {
      const result = await irisKfintechService.sendEkycMail(pan);
      clientLog("CLIENT_KYC_INITIATE", {
        user_id: user.id,
        pan_masked: pan.slice(0, 5) + "*****",
        latency_ms: Date.now() - startMs,
        status: "success",
      });
      apiOk(res, {
        triggered: true,
        message: result?.message ?? "eKYC link sent to your registered email/mobile",
        pan_masked: pan.slice(0, 5) + "*****",
      }, { latency_ms: Date.now() - startMs });
    } catch (err: any) {
      clientLog("CLIENT_KYC_INITIATE_ERROR", { user_id: user.id, pan_masked: pan.slice(0, 5) + "*****", error: err.message, level: "error" });
      apiErr(res, 502, "CLIENT_KYC_INITIATE_ERROR", err.message, true);
    }
  });

  /**
   * POST /api/client/kyc/vault-sync
   * Trigger IRIS KYC → multi-broker vault write-back for the logged-in client.
   * Call this after eKYC is confirmed completed so all broker onboardings
   * can reuse the IRIS-verified data without re-collecting PII.
   *
   * Outputs: { fieldsWritten, isReusable, alreadyCurrent? }
   */
  app.post("/api/client/kyc/vault-sync", requireAuth, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const user = (req as any).user;
    const pan: string | undefined = user?.pan ?? user?.panNumber;

    if (!pan) {
      return apiErr(res, 400, "CLIENT_KYC_NO_PAN", "PAN not found in your profile.", false);
    }
    if (!irisKfintechService.isConfigured) {
      return apiErr(res, 503, "IRIS_NOT_CONFIGURED", "KYC sync service temporarily unavailable", true);
    }

    try {
      const { writeIrisKycToVault } = await import("../services/kyc/iris-kyc-vault-writeback-service");
      const result = await writeIrisKycToVault(user.id, pan, { agentId: "client-self" });
      clientLog("CLIENT_KYC_VAULT_SYNC", {
        user_id: user.id,
        pan_masked: pan.slice(0, 5) + "*****",
        fields_written: result.fieldsWritten.length,
        is_reusable: result.isReusable,
        latency_ms: Date.now() - startMs,
        status: result.success ? "success" : "failed",
      });
      if (!result.success) {
        return apiErr(res, 502, "VAULT_SYNC_FAILED", result.error ?? "Vault sync failed", true);
      }
      apiOk(res, {
        fieldsWritten: result.fieldsWritten,
        isReusable: result.isReusable,
        alreadyCurrent: result.alreadyCurrent ?? false,
      }, { latency_ms: Date.now() - startMs });
    } catch (err: any) {
      clientLog("CLIENT_KYC_VAULT_SYNC_ERROR", { user_id: user.id, pan_masked: pan.slice(0, 5) + "*****", error: err.message, level: "error" });
      apiErr(res, 502, "CLIENT_KYC_VAULT_SYNC_ERROR", err.message, true);
    }
  });
}
