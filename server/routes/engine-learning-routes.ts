/**
 * @module engine-learning-routes
 * @description REST API routes for FintekPro Engine Learning & Self-Improvement System.
 *
 * Endpoints:
 *   GET  /api/engine-learning/status        — Complete learning health, active calibrations, and performance
 *   POST /api/engine-learning/toggle        — Enable/disable learning mode or reconfigure thresholds
 *   POST /api/engine-learning/trigger-cycle — Manually trigger an immediate self-improvement cycle
 *
 * Compliance: GCR v1.0, FASP-AI v3.0
 */

import { Router, Request, Response } from "express";
import { engineLearningOrchestrator } from "../services/engine-learning-orchestrator";
import { logger } from "../logger";

const router = Router();

// ── GET /status ─────────────────────────────────────────────────────────────
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const status = await engineLearningOrchestrator.getStatus();
    res.json({
      success: true,
      data: status,
      meta: {
        timestamp: new Date().toISOString(),
        version: status.orchestratorVersion,
      },
    });
  } catch (err: any) {
    logger.error("[EngineLearningRoutes] Failed to fetch learning status", {
      error: err?.message,
    });
    res.status(500).json({
      success: false,
      error_code: "LEARNING_STATUS_ERROR",
      message: "Failed to retrieve engine learning status",
      retryable: true,
    });
  }
});

// ── POST /toggle ────────────────────────────────────────────────────────────
router.post("/toggle", async (req: Request, res: Response) => {
  try {
    const { isLearningModeActive, learningModeLevel, autoCalibrateScorer, autoTuneThematicWeights } = req.body;
    const updatedConfig = await engineLearningOrchestrator.configureLearningMode({
      ...(typeof isLearningModeActive === "boolean" ? { isLearningModeActive } : {}),
      ...(learningModeLevel ? { learningModeLevel } : {}),
      ...(typeof autoCalibrateScorer === "boolean" ? { autoCalibrateScorer } : {}),
      ...(typeof autoTuneThematicWeights === "boolean" ? { autoTuneThematicWeights } : {}),
    });

    res.json({
      success: true,
      message: `Learning mode ${updatedConfig.isLearningModeActive ? "activated" : "deactivated"} (${updatedConfig.learningModeLevel})`,
      data: updatedConfig,
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
    });
  } catch (err: any) {
    logger.error("[EngineLearningRoutes] Failed to toggle learning mode", {
      error: err?.message,
    });
    res.status(500).json({
      success: false,
      error_code: "LEARNING_TOGGLE_ERROR",
      message: "Failed to update learning configuration",
      retryable: false,
    });
  }
});

// ── POST /trigger-cycle ─────────────────────────────────────────────────────
router.post("/trigger-cycle", async (_req: Request, res: Response) => {
  try {
    const result = await engineLearningOrchestrator.runSelfImprovementCycle();
    res.json({
      success: result.success,
      message: result.success
        ? "Autonomous self-improvement cycle completed successfully"
        : "Self-improvement cycle skipped (already executing)",
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        version: result.meta.version,
      },
    });
  } catch (err: any) {
    logger.error("[EngineLearningRoutes] Self-improvement cycle execution failed", {
      error: err?.message,
    });
    res.status(500).json({
      success: false,
      error_code: "LEARNING_CYCLE_FAILED",
      message: err?.message || "Failed to execute self-improvement cycle",
      retryable: true,
    });
  }
});

export default router;
