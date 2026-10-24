/**
 * @file sif-routes.ts
 * @description Dedicated REST API Router for Specified Investment Funds (SIF / New Asset Class).
 *
 * Exposes endpoints for:
 * - SIF Portfolio Catalog & Discovery
 * - SIF Statutory Investment Policies & 4-Tier SEBI Comparison Matrix
 * - SIF Ticket Size & Investor Eligibility Verification (₹10 Lakh statutory floor)
 * - SIF Statutory Compliance Auditing & Audit Trail Persistence
 *
 * Strict Compliance: GCR v1.0 & FASP-AI v3.1
 * - Explanatory metadata, engine version, timestamp
 * - Stateless, zero console logs (uses structured logger)
 * - Standard envelope: { success, data, meta }
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { modelPortfolios } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "../logger";
import { sifComplianceService } from "../services/sif-compliance-service";
import { statutoryInvestmentPolicyService } from "../services/statutory-investment-policy-service";

export const sifRouter = Router();

const SIF_ENGINE_VERSION = "SEBI-SIF-ROUTER-v1.0";

/**
 * GET /api/sif/catalog
 * Returns all active SIF model portfolios.
 */
sifRouter.get("/catalog", async (_req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const portfolios = await db
      .select()
      .from(modelPortfolios)
      .where(eq(modelPortfolios.portfolioTier, "affluent_sif"));

    return res.json({
      success: true,
      data: {
        total: portfolios.length,
        portfolios,
      },
      meta: {
        engineVersion: SIF_ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      },
    });
  } catch (error: any) {
    logger.error("[SifRouter] Error fetching SIF catalog:", { error: error?.message });
    return res.status(500).json({
      success: false,
      error: {
        code: "SIF_CATALOG_FETCH_FAILED",
        message: error?.message || "Failed to fetch SIF catalog",
        retryable: true,
      },
      meta: {
        engineVersion: SIF_ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/sif/policies
 * Returns statutory SIF investment policies and comparative 4-tier matrix.
 */
sifRouter.get("/policies", (_req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const sifPolicy = statutoryInvestmentPolicyService.getPolicy("affluent_sif");
    const matrix = statutoryInvestmentPolicyService.getComparativePolicyMatrix();

    return res.json({
      success: true,
      data: {
        sifPolicy,
        comparativeMatrix: matrix,
      },
      meta: {
        engineVersion: SIF_ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      },
    });
  } catch (error: any) {
    logger.error("[SifRouter] Error fetching SIF policies:", { error: error?.message });
    return res.status(500).json({
      success: false,
      error: {
        code: "SIF_POLICY_FETCH_FAILED",
        message: error?.message || "Failed to fetch SIF policies",
        retryable: false,
      },
      meta: {
        engineVersion: SIF_ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/sif/:id
 * Returns a specific SIF model portfolio with holdings and compliance status.
 */
sifRouter.get("/:id", async (req: Request, res: Response) => {
  const t0 = Date.now();
  const { id } = req.params;

  try {
    const [portfolio] = await db
      .select()
      .from(modelPortfolios)
      .where(eq(modelPortfolios.id, id))
      .limit(1);

    if (!portfolio) {
      return res.status(404).json({
        success: false,
        error: {
          code: "SIF_PORTFOLIO_NOT_FOUND",
          message: `SIF Portfolio not found with ID: ${id}`,
          retryable: false,
        },
        meta: {
          engineVersion: SIF_ENGINE_VERSION,
          calculationTimestamp: new Date().toISOString(),
        },
      });
    }

    return res.json({
      success: true,
      data: portfolio,
      meta: {
        engineVersion: SIF_ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      },
    });
  } catch (error: any) {
    logger.error(`[SifRouter] Error fetching SIF portfolio ${id}:`, { error: error?.message });
    return res.status(500).json({
      success: false,
      error: {
        code: "SIF_FETCH_ERROR",
        message: error?.message || "Failed to fetch SIF portfolio",
        retryable: true,
      },
      meta: {
        engineVersion: SIF_ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/sif/validate
 * Validates a proposed investment amount against the ₹10 Lakh statutory SIF floor.
 */
sifRouter.post("/validate", (req: Request, res: Response) => {
  const t0 = Date.now();
  const { amount, clientId, isAccreditedInvestor } = req.body;

  try {
    const validation = statutoryInvestmentPolicyService.validateInvestmentProposal({
      tierId: "affluent_sif",
      amount: Number(amount) || 0,
      clientId,
      isAccreditedInvestor: Boolean(isAccreditedInvestor),
    });

    return res.json({
      success: true,
      data: validation,
      meta: {
        engineVersion: SIF_ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      },
    });
  } catch (error: any) {
    logger.error("[SifRouter] Error validating SIF investment:", { error: error?.message });
    return res.status(400).json({
      success: false,
      error: {
        code: "SIF_VALIDATION_ERROR",
        message: error?.message || "Validation failed",
        retryable: false,
      },
      meta: {
        engineVersion: SIF_ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/sif/:id/compliance/audit
 * Audits a specific SIF portfolio and logs an immutable audit trail.
 */
sifRouter.post("/:id/compliance/audit", async (req: Request, res: Response) => {
  const t0 = Date.now();
  const { id } = req.params;

  try {
    const report = await sifComplianceService.auditSifPortfolio(id);

    return res.json({
      success: true,
      data: report,
      meta: {
        engineVersion: SIF_ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      },
    });
  } catch (error: any) {
    logger.error(`[SifRouter] Error auditing SIF portfolio ${id}:`, { error: error?.message });
    return res.status(500).json({
      success: false,
      error: {
        code: "SIF_AUDIT_ERROR",
        message: error?.message || "Failed to audit SIF portfolio",
        retryable: true,
      },
      meta: {
        engineVersion: SIF_ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/sif/compliance/audit-all
 * Audits all SIF portfolios and updates compliance records.
 */
sifRouter.post("/compliance/audit-all", async (_req: Request, res: Response) => {
  const t0 = Date.now();

  try {
    const sweepResult = await sifComplianceService.auditAllSifPortfolios();

    return res.json({
      success: true,
      data: sweepResult,
      meta: {
        engineVersion: SIF_ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      },
    });
  } catch (error: any) {
    logger.error("[SifRouter] Error in SIF audit-all:", { error: error?.message });
    return res.status(500).json({
      success: false,
      error: {
        code: "SIF_AUDIT_ALL_ERROR",
        message: error?.message || "Failed to audit all SIF portfolios",
        retryable: true,
      },
      meta: {
        engineVersion: SIF_ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
      },
    });
  }
});
