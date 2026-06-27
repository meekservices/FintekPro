/**
 * @file model-portfolios-route.ts
 * @description /api/model-portfolios — serves curated model portfolios from DB
 *
 * Fix #6 from Engine Data Audit (2026-06-27):
 * Replaces the 100% hardcoded static array in agent-model-portfolios.tsx with
 * a DB-backed API. Portfolios are seeded via schema-repairs.ts on first boot.
 *
 * GCR Compliance:
 *   - All responses include engine_version + calculation_timestamp
 *   - AI insights are Decision Support only (FASP-AI v1.0)
 *   - Mandatory SEBI risk disclaimers on every advisory output
 *
 * @inputs  - Query params: riskProfile, assetClass, featured
 * @outputs - { success, data: ModelPortfolioRow[], meta }
 */
import { Router, Request, Response } from "express";
import { db } from "../db";
import { modelPortfolios } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../logger";

export const modelPortfoliosRouter = Router();

const ENGINE_VERSION = "1.0.0";

// ── GET /api/model-portfolios ──────────────────────────────────────────────────
modelPortfoliosRouter.get("/", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { riskProfile, assetClass, featured } = req.query;

    const conditions = [eq(modelPortfolios.isPublished, true)];
    if (riskProfile && typeof riskProfile === "string") {
      conditions.push(eq(modelPortfolios.riskProfile, riskProfile));
    }
    if (assetClass && typeof assetClass === "string") {
      conditions.push(eq(modelPortfolios.assetClass, assetClass));
    }
    if (featured === "true") {
      conditions.push(eq(modelPortfolios.isFeatured, true));
    }

    const portfolios = await db
      .select()
      .from(modelPortfolios)
      .where(and(...conditions))
      .orderBy(modelPortfolios.isFeatured, modelPortfolios.name);

    return res.json({
      success: true,
      data: portfolios,
      meta: {
        timestamp: new Date().toISOString(),
        version: ENGINE_VERSION,
        engine_version: ENGINE_VERSION,
        latency_ms: Date.now() - start,
        count: portfolios.length,
        disclaimer:
          "Model portfolios are for research and guidance only. Past performance does not guarantee future returns. Please consult your SEBI-registered investment advisor before making investment decisions.",
      },
    });
  } catch (error) {
    logger.error("[ModelPortfolios] GET / error:", error instanceof Error ? error : new Error(String(error)));
    return res.status(500).json({
      success: false,
      error_code: "MODEL_PORTFOLIO_FETCH_ERROR",
      message: "Failed to fetch model portfolios",
      retryable: true,
      meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION },
    });
  }
});

// ── GET /api/model-portfolios/:id ──────────────────────────────────────────────
modelPortfoliosRouter.get("/:id", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { id } = req.params;
    const result = await db
      .select()
      .from(modelPortfolios)
      .where(and(eq(modelPortfolios.id, id), eq(modelPortfolios.isPublished, true)))
      .limit(1);

    if (!result[0]) {
      return res.status(404).json({
        success: false,
        error_code: "MODEL_PORTFOLIO_NOT_FOUND",
        message: `Model portfolio '${id}' not found`,
        retryable: false,
      });
    }

    return res.json({
      success: true,
      data: result[0],
      meta: {
        timestamp: new Date().toISOString(),
        version: ENGINE_VERSION,
        engine_version: ENGINE_VERSION,
        latency_ms: Date.now() - start,
        disclaimer:
          "Model portfolios are for research and guidance only. Past performance does not guarantee future returns.",
      },
    });
  } catch (error) {
    logger.error("[ModelPortfolios] GET /:id error:", error instanceof Error ? error : new Error(String(error)));
    return res.status(500).json({
      success: false,
      error_code: "MODEL_PORTFOLIO_FETCH_ERROR",
      message: "Failed to fetch model portfolio",
      retryable: true,
      meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION },
    });
  }
});
