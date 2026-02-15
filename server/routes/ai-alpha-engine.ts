import { Router } from "express";
import { aiBacktestingEngine } from "../services/ai-backtesting-engine";
import { aiRegimeDetectionEngine } from "../services/ai-regime-detection-engine";
import { aiPortfolioOptimizer } from "../services/ai-portfolio-optimizer";
import { aiAnalyticsEngine } from "../services/ai-analytics-engine";
import { db } from "../db";
import { aiModelRegistry, aiRegimeHistory, aiFeatureSnapshots, aiPriceHistory } from "@shared/schema";
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

export default router;
