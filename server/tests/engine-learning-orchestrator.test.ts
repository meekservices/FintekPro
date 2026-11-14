import { describe, it, expect, vi } from "vitest";
import { engineLearningOrchestrator, LEARNING_ORCHESTRATOR_VERSION } from "../services/engine-learning-orchestrator";
import { telemetryBus } from "../services/engine-telemetry-bus";

describe("FintekPro Engine Learning & Self-Improvement System", () => {
  it("initializes in Active Learning Mode with FASP-AI compliance", async () => {
    const status = await engineLearningOrchestrator.getStatus();

    expect(status.isLearningModeActive).toBe(true);
    expect(status.orchestratorVersion).toBe(LEARNING_ORCHESTRATOR_VERSION);
    expect(status.faspAiCompliance.decisionSupportOnly).toBe(true);
    expect(status.engines.length).toBeGreaterThanOrEqual(4);
  });

  it("monitors all core engines across Alpha Generation, Portfolio, and Data Quality", async () => {
    const status = await engineLearningOrchestrator.getStatus();
    const engineIds = status.engines.map((e) => e.engineId);

    expect(engineIds).toContain("pick-of-the-day");
    expect(engineIds).toContain("pro-thematic-screener");
    expect(engineIds).toContain("model-portfolio-optimizer");
    expect(engineIds).toContain("ai-regime-detection");
  });

  it("allows dynamic reconfiguration of learning guardrails", async () => {
    const updated = await engineLearningOrchestrator.configureLearningMode({
      learningModeLevel: "continuous_adaptive",
      autoCalibrateScorer: true,
      maxDailyThresholdShift: 3,
    });

    expect(updated.learningModeLevel).toBe("continuous_adaptive");
    expect(updated.maxDailyThresholdShift).toBe(3);

    const status = await engineLearningOrchestrator.getStatus();
    expect(status.learningModeLevel).toBe("continuous_adaptive");
  });

  it("runs an autonomous self-improvement cycle and records performance metrics", async () => {
    // Mock slow external calls to execute lightning-fast
    const { pickOutcomeAnalyzer } = await import("../services/pick-outcome-analyzer");
    vi.spyOn(pickOutcomeAnalyzer, "analyzeOutcomes").mockResolvedValue({
      overallHitRate: 72.5,
      totalClosedPicks: 30,
      totalPicksAnalyzed: 30,
      periodDays: 90,
      fromDate: "2026-08-16",
      toDate: "2026-11-14",
      averageReturnPct: 5.4,
      byCategory: {} as any,
      byHoldingPeriod: {} as any,
      statisticalLift: { winRateLiftPct: 8.2, isStatisticallySignificant: true, pValue: 0.02 },
      recommendationSummary: "Signal Efficacy Strong",
    });

    const { globalMacroTransmissionService } = await import("../services/macro/global-macro-transmission-service");
    vi.spyOn(globalMacroTransmissionService, "getMacroTransmissionReport").mockResolvedValue({
      macroBias: "Constructive",
      globalTailwindScore: 78,
      channels: [] as any,
    } as any);

    const { multiExchangeMarketService } = await import("../services/multi-exchange-market-service");
    vi.spyOn(multiExchangeMarketService, "getMultiExchangeSnapshot").mockResolvedValue({
      success: true,
      data: {
        institutionalFlows: {
          liquidityRegime: "STRONG_DOMESTIC_ABSORPTION",
          fiiNetCr: 5736.55,
          diiNetCr: -2253.58,
          monthlySipCr: 26425,
          absorptionRatio: 0.39,
          asOfDate: "2026-11-13",
        },
      } as any,
    });

    const { globalFiiTrackerEngine } = await import("../services/macro/global-fii-tracker-engine");
    vi.spyOn(globalFiiTrackerEngine, "getGlobalFiiReport").mockResolvedValue({
      scorecards: [{ countryCode: "IN", countryName: "India", compositeFiiScore: 84.2 }],
    } as any);

    const { globalCreditCycleService } = await import("../services/macro/global-credit-cycle-service");
    vi.spyOn(globalCreditCycleService, "getCreditCycleReport").mockResolvedValue({
      creditCycleRegime: "EXPANSIONARY_CREDIT",
      compositeCreditScore: 76.5,
      indicators: { usHyOasBps: 285 },
      creditStressTripwire: false,
    } as any);

    // Record mock telemetry to verify bus ingestion
    telemetryBus.report({
      engineId: "pro-thematic-screener",
      engineName: "Pro Thematic Screener",
      category: "Alpha Generation",
      reportedAt: new Date().toISOString(),
      latencyMs: 145,
      qualityScore: 92,
      itemsProcessed: 105,
      errorCount: 0,
      meta: { totalCategories: 12 },
    });

    telemetryBus.report({
      engineId: "model-portfolio-optimizer",
      engineName: "Model Portfolio Quant Optimizer",
      category: "Portfolio",
      reportedAt: new Date().toISOString(),
      latencyMs: 310,
      qualityScore: 95,
      itemsProcessed: 14,
      errorCount: 0,
      meta: { suggestionsCount: 14 },
    });

    const result = await engineLearningOrchestrator.runSelfImprovementCycle();

    expect(result.success).toBe(true);
    expect(result.cycleId).toContain("cycle-");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    const postCycleStatus = await engineLearningOrchestrator.getStatus();
    expect(postCycleStatus.cycleCount).toBeGreaterThanOrEqual(1);
    expect(postCycleStatus.lastCycleAt).not.toBeNull();
  }, 60000);
});
