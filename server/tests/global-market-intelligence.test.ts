/**
 * @file global-market-intelligence.test.ts
 * @description Unit tests for FintekPro Global Market Intelligence Engine (GMIE).
 * Validates:
 *   - Mathematical determinism of capital flows & absorption ratio ($IAR$)
 *   - Decoupling score ($IDI$) bounded constraints
 *   - Multi-asset correlation matrix compliance
 *   - Downstream engine feed structures (AIRegime, BlackLitterman, TailRisk, Screener, FASP)
 *   - GCR v1.0 & FASP-AI v1.0 compliance (engine_version, calculation_timestamp, explainability)
 */

import { describe, it, expect } from "vitest";
import { globalMarketIntelligenceEngine, GMIE_VERSION } from "../services/macro/global-market-intelligence-engine";

describe("GlobalMarketIntelligenceEngine (GMIE v1.0)", () => {
  it("should have valid engine version identification", () => {
    expect(GMIE_VERSION).toBe("GMIE-v1.0.0");
  });

  it("should evaluate comprehensive capital flows and compute valid absorption ratios", async () => {
    const flows = await globalMarketIntelligenceEngine.evaluateCapitalFlows();

    expect(flows).toBeDefined();
    expect(typeof flows.fiiCashNetCr).toBe("number");
    expect(typeof flows.diiCashNetCr).toBe("number");
    expect(typeof flows.effectiveFlowCr).toBe("number");
    expect(typeof flows.diiAbsorptionRatio).toBe("number");
    expect(flows.diiAbsorptionRatio).toBeGreaterThan(0);
    expect(flows.fpiIndexFuturesLongShortRatio).toBeGreaterThanOrEqual(0);
    expect(flows.fdiQuarterlyRunRateCr).toBeGreaterThan(0);
    expect(flows.fdiRetentionRatePct).toBeGreaterThan(50);
    expect(["STRONG_ACCUMULATION", "DISTRIBUTION", "NEUTRAL"]).toContain(flows.institutionalSentiment);
    expect(Array.isArray(flows.fiiFavoredSectors)).toBe(true);
    expect(Array.isArray(flows.fiiPrunedSectors)).toBe(true);
  });

  it("should evaluate overnight transmission and opening bias", async () => {
    const transmission = await globalMarketIntelligenceEngine.evaluateOvernightTransmission();

    expect(transmission).toBeDefined();
    expect(["GAP_UP", "GAP_DOWN", "FLAT"]).toContain(transmission.overnightBias);
    expect(typeof transmission.giftNiftySpreadBps).toBe("number");
    expect(transmission.openingProbabilityScore).toBeGreaterThanOrEqual(50);
    expect(transmission.openingProbabilityScore).toBeLessThanOrEqual(100);
  }, 10000);

  it("should compute multi-horizon correlation matrix with valid statistical bounds", async () => {
    const matrix = await globalMarketIntelligenceEngine.computeCorrelationMatrix();

    expect(Array.isArray(matrix)).toBe(true);
    expect(matrix.length).toBeGreaterThanOrEqual(5);

    for (const item of matrix) {
      expect(item.domesticSymbol).toBeDefined();
      expect(item.globalSymbol).toBeDefined();
      // Correlation Pearson bounds: -1.0 <= rho <= +1.0
      expect(item.correlation30D).toBeGreaterThanOrEqual(-1.0);
      expect(item.correlation30D).toBeLessThanOrEqual(1.0);
      expect(item.correlation90D).toBeGreaterThanOrEqual(-1.0);
      expect(item.correlation90D).toBeLessThanOrEqual(1.0);
      expect(item.correlation365D).toBeGreaterThanOrEqual(-1.0);
      expect(item.correlation365D).toBeLessThanOrEqual(1.0);
      expect(typeof item.rollingBeta90D).toBe("number");
      expect(["GLOBAL_LEADS_DOMESTIC", "CO_INTEGRATED", "INDEPENDENT"]).toContain(item.leadLagRelationship);
    }
  });

  it("should calculate bounded and deterministic India Decoupling Score", () => {
    const dummyFlows = {
      date: "2026-11-06",
      fiiCashNetCr: -1500,
      diiCashNetCr: 3200,
      effectiveFlowCr: -540,
      diiAbsorptionRatio: 2.13,
      fpiIndexFuturesLongShortRatio: 0.42,
      fdiQuarterlyRunRateCr: 105000,
      fdiRetentionRatePct: 78.4,
      fedNetLiquidityUsdBn: 6400,
      institutionalSentiment: "STRONG_ACCUMULATION" as const,
      fiiFavoredSectors: ["Pharma"],
      fiiPrunedSectors: ["IT"],
    };

    const dummyTransmission = {
      overnightBias: "GAP_UP" as const,
      giftNiftySpreadBps: 28.5,
      nasdaqChangePct: 1.1,
      brentCrudeChangePct: -0.5,
      us10YChangeBps: -2.0,
      dxyChangePct: -0.1,
      openingProbabilityScore: 82,
    };

    const score = globalMarketIntelligenceEngine.calculateDecouplingScore(dummyFlows, dummyTransmission, []);
    expect(score).toBeGreaterThanOrEqual(-2.0);
    expect(score).toBeLessThanOrEqual(3.5);
    // With DII absorption > 2.0 and positive gift spread, decoupling score should be strongly positive
    expect(score).toBeGreaterThan(1.5);
  });

  it("should generate comprehensive intelligence report with complete downstream engine feeds", async () => {
    const report = await globalMarketIntelligenceEngine.getIntelligenceReport(true);

    expect(report.engine_version).toBe(GMIE_VERSION);
    expect(report.calculation_timestamp).toBeDefined();
    expect(["GLOBAL_RISK_ON", "GLOBAL_RISK_OFF", "DOMESTIC_DECOUPLING", "LIQUIDITY_CONTRACTION"]).toContain(
      report.macroRegime
    );
    expect(typeof report.indiaDecouplingScore).toBe("number");

    // Feeds verification
    const feeds = report.engineFeeds;
    expect(feeds.aiRegimeFeed).toBeDefined();
    expect(feeds.aiRegimeFeed.macroRegime).toBe(report.macroRegime);
    expect(feeds.aiRegimeFeed.indiaDecouplingScore).toBe(report.indiaDecouplingScore);

    expect(feeds.blackLittermanFeed).toBeDefined();
    expect(Array.isArray(feeds.blackLittermanFeed.viewsVectorQ)).toBe(true);
    expect(feeds.blackLittermanFeed.viewsVectorQ.length).toBeGreaterThan(0);
    expect(feeds.blackLittermanFeed.recommendedAssetTilts).toBeDefined();

    expect(feeds.tailRiskStressFeed).toBeDefined();
    expect(Array.isArray(feeds.tailRiskStressFeed.scenarios)).toBe(true);
    expect(feeds.tailRiskStressFeed.scenarios.length).toBeGreaterThanOrEqual(3);

    expect(feeds.screenerSectorSignalFeed).toBeDefined();
    expect(feeds.screenerSectorSignalFeed.overweightSectors.length).toBeGreaterThan(0);

    expect(feeds.faspAdvisoryFeed).toBeDefined();
    expect(feeds.faspAdvisoryFeed.engine_version).toBe(GMIE_VERSION);
    expect(feeds.faspAdvisoryFeed.formulaApplied).toBeDefined();
    expect(feeds.faspAdvisoryFeed.intermediateSteps).toBeDefined();
  });
});
