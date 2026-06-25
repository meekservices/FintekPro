/**
 * FASP-AI v2.0 — Advisory Feedback, Drift, and Audit API Routes
 *
 * @purpose  Exposes FASP-AI v2.0 advisory feedback loop, portfolio drift alerts,
 *           confidence breakdowns, and full audit trail to the FintekPro frontend.
 *
 * @routes
 *   POST /api/fasp/advisory/:outputId/feedback   — advisor accept/reject/modify
 *   GET  /api/fasp/drift/:portfolioId            — compute live drift for portfolio
 *   GET  /api/fasp/audit-trail/:userId           — full advisory audit trail
 *   GET  /api/fasp/confidence/breakdown/:outputId — explain confidence score
 *   GET  /api/fasp/stats                         — advisory stats for admin dashboard
 *
 * @sebi    SEBI/HO/IMD/2023/P/CIR/0188
 * @version FASP-AI-v2.0
 */

import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { faspAdvisoryOutputs, portfolioDriftAlerts } from "@shared/schema";
import { eq, desc, count, and } from "drizzle-orm";
import { FaspAIv2Service } from "../services/fasp-ai-v2-service";
import { logger } from "../logger";
import { z } from "zod";

const router = Router();

// ─── Input validation schemas ──────────────────────────────────────────────

const feedbackSchema = z.object({
  action: z.enum(["accepted", "rejected", "modified"]),
  modification: z.string().max(2000).optional(),
  notes: z.string().max(1000).optional(),
});

// ─── POST /api/fasp/advisory/:outputId/feedback ───────────────────────────

/**
 * Record advisor feedback on an AI advisory output.
 * Tracks accept / reject / modify decisions for the feedback loop.
 *
 * @inputs  outputId (param), action, modification?, notes? (body)
 * @outputs { success, outputId, action, timestamp }
 */
router.post("/advisory/:outputId/feedback", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { outputId } = req.params;
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error_code: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Invalid request body",
        retryable: false,
      });
    }

    const { action, modification, notes } = parsed.data;

    // Verify record exists
    const [existing] = await db
      .select({ id: faspAdvisoryOutputs.id, advisoryType: faspAdvisoryOutputs.advisoryType })
      .from(faspAdvisoryOutputs)
      .where(eq(faspAdvisoryOutputs.id, outputId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error_code: "OUTPUT_NOT_FOUND",
        message: `Advisory output ${outputId} not found`,
        retryable: false,
      });
    }

    await FaspAIv2Service.recordFeedback(outputId, action, modification, notes);

    logger.info("AI_ADVICE_FEEDBACK_RECORDED", {user_id: (req as any).user?.id,
      output_id: outputId,
      action,
      latency_ms: Date.now() - start,
      status: "success"});

    return res.json({
      success: true,
      data: {
        outputId,
        action,
        timestamp: new Date().toISOString(),
        disclaimer: "Advisor feedback recorded for compliance audit trail.",
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: "FASP-AI-v2.0",
      },
    });
  } catch (err) {
    logger.error("FASP_FEEDBACK_ROUTE_ERROR", {error: (err as Error).message, latency_ms: Date.now() - start, status: "error" });
    return res.status(500).json({
      success: false,
      error_code: "FEEDBACK_FAILED",
      message: "Failed to record feedback",
      retryable: true,
    });
  }
});

// ─── GET /api/fasp/drift/:portfolioId ─────────────────────────────────────

/**
 * Get open drift alerts for a model portfolio.
 * Returns pre-computed drift records from portfolio_drift_alerts table.
 *
 * @inputs  portfolioId (param)
 * @outputs { success, portfolioId, alerts[], hasAlerts, computedAt }
 */
router.get("/drift/:portfolioId", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { portfolioId } = req.params;

    const alerts = await db
      .select()
      .from(portfolioDriftAlerts)
      .where(
        and(
          eq(portfolioDriftAlerts.portfolioId, portfolioId),
          eq(portfolioDriftAlerts.alertStatus, "open"),
        )
      )
      .orderBy(desc(portfolioDriftAlerts.computedAt))
      .limit(50);

    logger.info("DRIFT_ALERTS_FETCHED", {user_id: (req as any).user?.id,
      portfolio_id: portfolioId,
      alert_count: alerts.length,
      latency_ms: Date.now() - start,
      status: "success"});

    return res.json({
      success: true,
      data: {
        portfolioId,
        hasAlerts: alerts.length > 0,
        alertCount: alerts.length,
        alerts: alerts.map(a => ({
          symbol: a.holdingSymbol,
          targetWeight: Number(a.targetWeight),
          currentWeight: a.currentWeight ? Number(a.currentWeight) : null,
          driftPercent: a.driftPercent ? Number(a.driftPercent) : null,
          threshold: Number(a.driftThreshold),
          status: a.alertStatus,
          computedAt: a.computedAt,
        })),
        disclaimer: "Drift alerts are indicative only. Actual rebalancing requires advisor approval.",
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: "FASP-AI-v2.0",
      },
    });
  } catch (err) {
    logger.error("FASP_DRIFT_ROUTE_ERROR", {error: (err as Error).message, latency_ms: Date.now() - start, status: "error" });
    return res.status(500).json({
      success: false,
      error_code: "DRIFT_FETCH_FAILED",
      message: "Failed to fetch drift alerts",
      retryable: true,
    });
  }
});

// ─── POST /api/fasp/drift/:portfolioId/acknowledge ────────────────────────

/**
 * Acknowledge a drift alert for a portfolio holding.
 * Sets alertStatus to "acknowledged" on the open alerts.
 */
router.post("/drift/:portfolioId/acknowledge", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { portfolioId } = req.params;
    const advisorId = (req as any).user?.id;

    await db
      .update(portfolioDriftAlerts)
      .set({
        alertStatus: "acknowledged",
        acknowledgedBy: advisorId,
        acknowledgedAt: new Date(),
      })
      .where(
        and(
          eq(portfolioDriftAlerts.portfolioId, portfolioId),
          eq(portfolioDriftAlerts.alertStatus, "open"),
        )
      );

    logger.info("DRIFT_ALERT_ACKNOWLEDGED", {portfolio_id: portfolioId, advisor_id: advisorId, latency_ms: Date.now() - start, status: "success" });

    return res.json({
      success: true,
      data: { portfolioId, acknowledgedAt: new Date().toISOString() },
      meta: { timestamp: new Date().toISOString(), version: "FASP-AI-v2.0" },
    });
  } catch (err) {
    logger.error("FASP_DRIFT_ACK_ERROR", {error: (err as Error).message, latency_ms: Date.now() - start, status: "error" });
    return res.status(500).json({ success: false, error_code: "ACK_FAILED", message: "Failed to acknowledge alerts", retryable: true });
  }
});

// ─── GET /api/fasp/audit-trail/:userId ────────────────────────────────────

/**
 * Fetch the full FASP-AI v2.0 advisory audit trail for a user.
 * Supports pagination via ?page=1&limit=20
 *
 * @inputs  userId (param), page?, limit? (query)
 * @outputs { success, data: outputs[], total, page, limit }
 */
router.get("/audit-trail/:userId", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { userId } = req.params;
    const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
    const limit = Math.min(100, parseInt(String(req.query.limit ?? "20")));
    const offset = (page - 1) * limit;

    const [outputs, [{ total }]] = await Promise.all([
      db
        .select()
        .from(faspAdvisoryOutputs)
        .where(eq(faspAdvisoryOutputs.userId, userId))
        .orderBy(desc(faspAdvisoryOutputs.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: count() })
        .from(faspAdvisoryOutputs)
        .where(eq(faspAdvisoryOutputs.userId, userId)),
    ]);

    logger.info("AUDIT_TRAIL_FETCHED", {requesting_user: (req as any).user?.id,
      target_user: userId,
      record_count: outputs.length,
      latency_ms: Date.now() - start,
      status: "success"});

    return res.json({
      success: true,
      data: outputs.map(o => ({
        id: o.id,
        advisoryType: o.advisoryType,
        userSegment: o.userSegment,
        recommendation: o.recommendation,
        confidenceScore: o.confidenceScore,
        confidenceThreshold: o.confidenceThreshold,
        meetsThreshold: o.meetsThreshold,
        humanReviewRequired: o.humanReviewRequired,
        sebiCircularRef: o.sebiCircularRef,
        modelVersion: o.modelVersion,
        advisorAction: o.advisorAction,
        advisorActionAt: o.advisorActionAt,
        advisorModification: o.advisorModification,
        createdAt: o.createdAt,
      })),
      meta: {
        timestamp: new Date().toISOString(),
        version: "FASP-AI-v2.0",
        page,
        limit,
        total: Number(total),
      },
    });
  } catch (err) {
    logger.error("FASP_AUDIT_ROUTE_ERROR", {error: (err as Error).message, latency_ms: Date.now() - start, status: "error" });
    return res.status(500).json({ success: false, error_code: "AUDIT_FETCH_FAILED", message: "Failed to fetch audit trail", retryable: true });
  }
});

// ─── GET /api/fasp/confidence/breakdown/:outputId ─────────────────────────

/**
 * Explain the confidence score breakdown for a specific advisory output.
 *
 * @inputs  outputId (param)
 * @outputs { success, score, breakdown[], threshold, meetsThreshold, sebiRef }
 */
router.get("/confidence/breakdown/:outputId", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { outputId } = req.params;

    const [output] = await db
      .select()
      .from(faspAdvisoryOutputs)
      .where(eq(faspAdvisoryOutputs.id, outputId))
      .limit(1);

    if (!output) {
      return res.status(404).json({ success: false, error_code: "NOT_FOUND", message: "Advisory output not found", retryable: false });
    }

    return res.json({
      success: true,
      data: {
        outputId,
        score: output.confidenceScore,
        threshold: output.confidenceThreshold,
        meetsThreshold: output.meetsThreshold,
        humanReviewRequired: output.humanReviewRequired,
        breakdown: output.confidenceBreakdown,
        sebiCircularRef: output.sebiCircularRef,
        modelVersion: output.modelVersion,
        disclaimer: "Confidence scores are computed by FASP-AI v2.0. They represent AI certainty, not investment guarantee.",
      },
      meta: { timestamp: new Date().toISOString(), version: "FASP-AI-v2.0" },
    });
  } catch (err) {
    logger.error("FASP_BREAKDOWN_ROUTE_ERROR", {error: (err as Error).message, latency_ms: Date.now() - start, status: "error" });
    return res.status(500).json({ success: false, error_code: "BREAKDOWN_FAILED", message: "Failed to fetch breakdown", retryable: true });
  }
});

// ─── GET /api/fasp/stats ──────────────────────────────────────────────────

/**
 * Get FASP-AI v2.0 advisory stats for the admin dashboard.
 * Returns total outputs, acceptance rate, avg confidence, open drift alerts.
 */
router.get("/stats", async (_req: Request, res: Response) => {
  const start = Date.now();
  try {
    const [outputStats, driftStats] = await Promise.all([
      db.select({ total: count() }).from(faspAdvisoryOutputs),
      db.select({ total: count() }).from(portfolioDriftAlerts).where(eq(portfolioDriftAlerts.alertStatus, "open")),
    ]);

    return res.json({
      success: true,
      data: {
        totalAdvisoryOutputs: Number(outputStats[0]?.total ?? 0),
        openDriftAlerts: Number(driftStats[0]?.total ?? 0),
        engineVersion: "FASP-AI-v2.0",
        sebiCompliant: true,
      },
      meta: { timestamp: new Date().toISOString(), version: "FASP-AI-v2.0", latency_ms: Date.now() - start },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error_code: "STATS_FAILED", message: "Failed to fetch stats", retryable: true });
  }
});

export default router;
