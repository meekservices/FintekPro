import { Router } from "express";
import { aiBacktestingEngine } from "../services/ai-backtesting-engine";
import { aiRegimeDetectionEngine } from "../services/ai-regime-detection-engine";
import { aiPortfolioOptimizer } from "../services/ai-portfolio-optimizer";
import { aiAnalyticsEngine } from "../services/ai-analytics-engine";
import { aiMLScoringEngine } from "../services/ai-ml-scoring-engine";
import { aiXAIEngine } from "../services/ai-xai-engine";
import { aiFeedbackEngine } from "../services/ai-feedback-engine";
import { aiModelGovernance } from "../services/ai-model-governance";
import { db } from "../db";
import { aiModelRegistry, aiRegimeHistory, aiFeatureSnapshots, aiPriceHistory, dailyPicks, aiPredictionLogs } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";

const router = Router();

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  const user = (req as any).user;
  if (!user?.role || !['admin', 'super_admin'].includes(user.role)) {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
}

router.get("/backtest", requireAuth, async (req, res) => {
  try {
    const assetClass = req.query.assetClass as string | undefined;
    const windowMonths = parseInt(req.query.windowMonths as string) || 6;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const includeTransactionCosts = req.query.includeTransactionCosts !== 'false';

    const config = {
      assetClass,
      windowMonths,
      startDate,
      endDate,
      includeTransactionCosts,
    };

    const result = await aiBacktestingEngine.runBacktest(config);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error("[AI Alpha] Error running backtest:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to run backtest" });
  }
});

router.get("/backtest/walk-forward", requireAuth, async (req, res) => {
  try {
    const assetClass = req.query.assetClass as string | undefined;
    const windowMonths = parseInt(req.query.windowMonths as string) || 6;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const includeTransactionCosts = req.query.includeTransactionCosts !== 'false';

    const config = {
      assetClass,
      windowMonths,
      startDate,
      endDate,
      includeTransactionCosts,
    };

    const windows = await aiBacktestingEngine.runWalkForwardBacktest(config);
    res.json({ success: true, windows });
  } catch (error: any) {
    console.error("[AI Alpha] Error running walk-forward backtest:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to run walk-forward backtest" });
  }
});

router.get("/backtest/history", requireAuth, async (req, res) => {
  try {
    const assetClass = req.query.assetClass as string | undefined;
    const limit = parseInt(req.query.limit as string) || 10;

    const history = await aiBacktestingEngine.getBacktestHistory(assetClass, limit);
    res.json({ success: true, history });
  } catch (error: any) {
    console.error("[AI Alpha] Error fetching backtest history:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch backtest history" });
  }
});

router.get("/regime/current", requireAuth, async (req, res) => {
  try {
    let regime = await aiRegimeDetectionEngine.getCurrentRegime();

    if (!regime) {
      const result = await aiRegimeDetectionEngine.detectCurrentRegime();
      await aiRegimeDetectionEngine.persistRegime(result);
      regime = await aiRegimeDetectionEngine.getCurrentRegime();
    }

    if (!regime) {
      return res.json({ success: true, regime: null, message: "No regime data available" });
    }

    res.json({ success: true, regime });
  } catch (error: any) {
    console.error("[AI Alpha] Error fetching current regime:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch current regime" });
  }
});

router.get("/regime/detect", requireAdmin, async (req, res) => {
  try {
    const result = await aiRegimeDetectionEngine.detectCurrentRegime();
    await aiRegimeDetectionEngine.persistRegime(result);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error("[AI Alpha] Error detecting regime:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to detect regime" });
  }
});

router.get("/regime/history", requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const history = await aiRegimeDetectionEngine.getRegimeHistory(days);
    res.json({ success: true, history });
  } catch (error: any) {
    console.error("[AI Alpha] Error fetching regime history:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch regime history" });
  }
});

router.get("/regime/distribution", requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const distribution = await aiRegimeDetectionEngine.getRegimeDistribution(days);
    res.json({ success: true, distribution });
  } catch (error: any) {
    console.error("[AI Alpha] Error fetching regime distribution:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch regime distribution" });
  }
});

router.get("/picks/optimized", requireAuth, async (req, res) => {
  try {
    const maxPositions = parseInt(req.query.maxPositions as string) || 10;
    const includeAlternatives = req.query.includeAlternatives !== 'false';
    const maxWeightPerAsset = parseFloat(req.query.maxWeightPerAsset as string) || 0.25;

    const config = {
      targetPositions: maxPositions,
      includeAlternatives,
      maxWeightPerAsset,
    };

    const basket = await aiPortfolioOptimizer.optimizeBasket(config);
    res.json({ success: true, basket });
  } catch (error: any) {
    console.error("[AI Alpha] Error optimizing basket:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to optimize basket" });
  }
});

router.get("/picks/diversification", requireAuth, async (req, res) => {
  try {
    const diversification = await aiPortfolioOptimizer.getDiversificationScore();
    res.json({ success: true, diversification });
  } catch (error: any) {
    console.error("[AI Alpha] Error fetching diversification:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch diversification analysis" });
  }
});

router.get("/models", requireAdmin, async (req, res) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const type = req.query.type as string | undefined;

    const conditions: any[] = [];
    if (activeOnly) {
      conditions.push(eq(aiModelRegistry.isActive, true));
    }
    if (type) {
      conditions.push(eq(aiModelRegistry.modelType, type));
    }

    let query = db.select().from(aiModelRegistry).orderBy(desc(aiModelRegistry.createdAt));

    let models;
    if (conditions.length > 0) {
      models = await db.select().from(aiModelRegistry).where(and(...conditions)).orderBy(desc(aiModelRegistry.createdAt));
    } else {
      models = await query;
    }

    res.json({ success: true, models });
  } catch (error: any) {
    console.error("[AI Alpha] Error listing models:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to list models" });
  }
});

router.post("/models/:id/activate", requireAdmin, async (req, res) => {
  try {
    const modelId = parseInt(req.params.id);
    if (isNaN(modelId)) {
      return res.status(400).json({ success: false, error: "Invalid model ID" });
    }

    const [model] = await db.select().from(aiModelRegistry).where(eq(aiModelRegistry.id, modelId));
    if (!model) {
      return res.status(404).json({ success: false, error: "Model not found" });
    }

    await db.update(aiModelRegistry)
      .set({ isActive: false })
      .where(
        and(
          eq(aiModelRegistry.modelName, model.modelName),
          eq(aiModelRegistry.assetClass, model.assetClass)
        )
      );

    const [updated] = await db.update(aiModelRegistry)
      .set({ isActive: true })
      .where(eq(aiModelRegistry.id, modelId))
      .returning();

    res.json({ success: true, model: updated });
  } catch (error: any) {
    console.error("[AI Alpha] Error activating model:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to activate model" });
  }
});

router.get("/status", async (_req, res) => {
  try {
    const [regimeRow] = await db
      .select()
      .from(aiRegimeHistory)
      .orderBy(desc(aiRegimeHistory.regimeDate))
      .limit(1);

    const currentRegime = regimeRow
      ? { label: regimeRow.regimeLabel, confidence: regimeRow.confidence, date: regimeRow.regimeDate }
      : { label: "not detected", confidence: null, date: null };

    const [livePicksCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sql`daily_picks`)
      .where(sql`status = 'live'`);

    const [snapshotsCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(aiFeatureSnapshots);

    const latestModels = await db
      .select()
      .from(aiModelRegistry)
      .where(eq(aiModelRegistry.isActive, true))
      .orderBy(desc(aiModelRegistry.createdAt))
      .limit(5);

    const [priceHistoryCount] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(aiPriceHistory);

    res.json({
      success: true,
      status: {
        currentRegime,
        livePicksCount: Number(livePicksCount?.count || 0),
        featureSnapshotsCount: Number(snapshotsCount?.count || 0),
        activeModels: latestModels.map(m => ({
          id: m.id,
          name: m.modelName,
          type: m.modelType,
          version: m.version,
          assetClass: m.assetClass,
        })),
        priceHistoryRecords: Number(priceHistoryCount?.count || 0),
        engineStatus: "operational",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[AI Alpha] Error fetching status:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch AI engine status" });
  }
});

// ==========================================
// BATCH 2: ML SCORING ENDPOINTS (Epic A4)
// ==========================================

router.post("/scoring/train", requireAdmin, async (req, res) => {
  try {
    const { assetClass, targetDays, maxStumps, learningRate, nFolds } = req.body;
    const config = {
      assetClass: assetClass || undefined,
      targetDays: targetDays ? parseInt(targetDays) : 7,
      maxStumps: maxStumps ? parseInt(maxStumps) : 50,
      learningRate: learningRate ? parseFloat(learningRate) : 0.1,
      nFolds: nFolds ? parseInt(nFolds) : 5,
    };

    if (assetClass) {
      const model = await aiMLScoringEngine.trainModel(config);
      res.json({ success: true, model: { name: model.name, version: model.version, assetClass: model.assetClass, metrics: model.trainingMetrics, cv: model.cvMetrics } });
    } else {
      const models = await aiMLScoringEngine.trainAllModels(config);
      res.json({ success: true, models: models.map(m => ({ name: m.name, version: m.version, assetClass: m.assetClass, metrics: m.trainingMetrics })) });
    }
  } catch (error: any) {
    console.error("[AI Scoring] Training error:", error);
    res.status(500).json({ success: false, error: error.message || "Training failed" });
  }
});

router.post("/scoring/predict", requireAuth, async (req, res) => {
  try {
    const { assetId, assetClass, features, regime } = req.body;
    if (!assetId || !assetClass || !features) {
      return res.status(400).json({ success: false, error: "assetId, assetClass, and features are required" });
    }
    const result = await aiMLScoringEngine.score(assetId, assetClass, features, regime);
    if (!result) {
      return res.json({ success: true, result: null, message: "No active model for this asset class, using rule-based scoring" });
    }
    res.json({ success: true, result });
  } catch (error: any) {
    console.error("[AI Scoring] Prediction error:", error);
    res.status(500).json({ success: false, error: error.message || "Prediction failed" });
  }
});

router.get("/scoring/evaluate/:modelName/:modelVersion", requireAdmin, async (req, res) => {
  try {
    const { modelName, modelVersion } = req.params;
    const evaluation = await aiMLScoringEngine.evaluateModel(modelName, modelVersion);
    res.json({ success: true, evaluation });
  } catch (error: any) {
    console.error("[AI Scoring] Evaluation error:", error);
    res.status(500).json({ success: false, error: error.message || "Evaluation failed" });
  }
});

// ==========================================
// BATCH 2: EXPLAINABLE AI ENDPOINTS (Epic A5)
// ==========================================

router.get("/xai/explain/:pickId", requireAuth, async (req, res) => {
  try {
    const pickId = parseInt(req.params.pickId);
    if (isNaN(pickId)) {
      return res.status(400).json({ success: false, error: "Invalid pick ID" });
    }
    const explanation = await aiXAIEngine.explainPick(pickId);
    res.json({ success: true, explanation });
  } catch (error: any) {
    console.error("[AI XAI] Explain error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to explain pick" });
  }
});

router.get("/xai/similar/:pickId", requireAuth, async (req, res) => {
  try {
    const pickId = parseInt(req.params.pickId);
    const limit = parseInt(req.query.limit as string) || 5;
    if (isNaN(pickId)) {
      return res.status(400).json({ success: false, error: "Invalid pick ID" });
    }
    const patterns = await aiXAIEngine.findSimilarPatterns(pickId, limit);
    res.json({ success: true, patterns });
  } catch (error: any) {
    console.error("[AI XAI] Similar patterns error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to find similar patterns" });
  }
});

router.get("/xai/feature-importance/:assetClass", requireAuth, async (req, res) => {
  try {
    const { assetClass } = req.params;
    const importance = await aiXAIEngine.getFeatureImportance(assetClass);
    res.json({ success: true, importance });
  } catch (error: any) {
    console.error("[AI XAI] Feature importance error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get feature importance" });
  }
});

router.get("/xai/calibration", requireAuth, async (req, res) => {
  try {
    const assetClass = req.query.assetClass as string | undefined;
    const calibration = await aiXAIEngine.getConfidenceCalibration(assetClass);
    res.json({ success: true, calibration });
  } catch (error: any) {
    console.error("[AI XAI] Calibration error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get calibration" });
  }
});

// ==========================================
// BATCH 2: FEEDBACK & PERSONALIZATION (Epic A6)
// ==========================================

router.post("/feedback/log", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "User ID required" });
    }
    const { pickId, interactionType, metadata, sessionId, deviceType } = req.body;
    if (!pickId || !interactionType) {
      return res.status(400).json({ success: false, error: "pickId and interactionType are required" });
    }
    await aiFeedbackEngine.logInteraction({
      userId, pickId: parseInt(pickId), interactionType, metadata, sessionId, deviceType,
    });
    res.json({ success: true, message: "Interaction logged" });
  } catch (error: any) {
    console.error("[AI Feedback] Log error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to log interaction" });
  }
});

router.get("/picks/personalized", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "User ID required" });
    }
    const limit = parseInt(req.query.limit as string) || 10;
    const picks = await aiFeedbackEngine.getPersonalizedPicks(userId, limit);
    res.json({ success: true, picks });
  } catch (error: any) {
    console.error("[AI Feedback] Personalized picks error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get personalized picks" });
  }
});

router.get("/feedback/profile", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "User ID required" });
    }
    const profile = await aiFeedbackEngine.getUserProfile(userId);
    res.json({ success: true, profile });
  } catch (error: any) {
    console.error("[AI Feedback] Profile error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get user profile" });
  }
});

router.get("/feedback/engagement", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "User ID required" });
    }
    const stats = await aiFeedbackEngine.getEngagementStats(userId);
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error("[AI Feedback] Engagement stats error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get engagement stats" });
  }
});

router.get("/feedback/history", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "User ID required" });
    }
    const limit = parseInt(req.query.limit as string) || 50;
    const history = await aiFeedbackEngine.getInteractionHistory(userId, limit);
    res.json({ success: true, history });
  } catch (error: any) {
    console.error("[AI Feedback] History error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get interaction history" });
  }
});

// ==========================================
// BATCH 2: MODEL GOVERNANCE (Epic A7)
// ==========================================

router.get("/governance/check", requireAdmin, async (req, res) => {
  try {
    const summary = await aiModelGovernance.runGovernanceCheck();
    res.json({ success: true, summary });
  } catch (error: any) {
    console.error("[AI Governance] Check error:", error);
    res.status(500).json({ success: false, error: error.message || "Governance check failed" });
  }
});

router.get("/governance/model/:modelName/:modelVersion", requireAdmin, async (req, res) => {
  try {
    const { modelName, modelVersion } = req.params;
    const report = await aiModelGovernance.checkModelHealth(modelName, modelVersion);
    res.json({ success: true, report });
  } catch (error: any) {
    console.error("[AI Governance] Model health error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to check model health" });
  }
});

router.post("/governance/retrain/:assetClass", requireAdmin, async (req, res) => {
  try {
    const { assetClass } = req.params;
    const result = await aiModelGovernance.triggerRetrain(assetClass);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error("[AI Governance] Retrain error:", error);
    res.status(500).json({ success: false, error: error.message || "Retrain failed" });
  }
});

router.post("/governance/rollback/:assetClass", requireAdmin, async (req, res) => {
  try {
    const { assetClass } = req.params;
    const { targetVersion } = req.body;
    const result = await aiModelGovernance.rollbackModel(assetClass, targetVersion);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error("[AI Governance] Rollback error:", error);
    res.status(500).json({ success: false, error: error.message || "Rollback failed" });
  }
});

router.get("/governance/history/:assetClass", requireAdmin, async (req, res) => {
  try {
    const { assetClass } = req.params;
    const history = await aiModelGovernance.getModelHistory(assetClass);
    res.json({ success: true, history });
  } catch (error: any) {
    console.error("[AI Governance] History error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to get model history" });
  }
});

router.post("/governance/update-outcomes", requireAdmin, async (req, res) => {
  try {
    const result = await aiModelGovernance.updatePredictionOutcomes();
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[AI Governance] Update outcomes error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update outcomes" });
  }
});

export default router;
