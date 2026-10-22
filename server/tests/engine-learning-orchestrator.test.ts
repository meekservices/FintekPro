import { describe, it, expect } from "vitest";
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
  }, 30000);
});
