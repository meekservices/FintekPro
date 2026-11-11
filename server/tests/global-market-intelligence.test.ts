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
import { msciFactorService, MSCI_SERVICE_VERSION } from "../services/macro/msci-factor-service";
import { globalFiiTrackerEngine, FII_TRACKER_VERSION } from "../services/macro/global-fii-tracker-engine";

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

    // MSCI & ADR Embedded Verification
    expect(report.msciAnalysis).toBeDefined();
    expect(report.msciAnalysis?.engine_version).toBe(MSCI_SERVICE_VERSION);
    expect(Array.isArray(report.indianAdrs)).toBe(true);
    expect(report.indianAdrs!.length).toBeGreaterThanOrEqual(5);
  });

  it("should evaluate MSCI factor indices, rebalancing estimates, and country market profiles", async () => {
    const report = await msciFactorService.getGlobalCountryReport();

    expect(report).toBeDefined();
    expect(report.engine_version).toBe(MSCI_SERVICE_VERSION);
    expect(report.indiaMsciProfile.weightInMsciEmPct).toBeGreaterThan(15);
    expect(report.indiaMsciProfile.valuationPremiumOverEmPct).toBeGreaterThan(50);
    expect(report.indiaMsciProfile.valuationPremiumOverChinaPct).toBeGreaterThan(80);

    // Rebalancing inflows
    expect(report.msciRebalancing.estimatedPassiveInflowUsdMn).toBeGreaterThan(0);
    expect(report.msciRebalancing.estimatedPassiveInflowInrCr).toBeGreaterThan(0);
    expect(report.msciRebalancing.keyCandidateStocks.length).toBeGreaterThan(0);

    // Factors
    const factors = report.factorAttribution.factors;
    expect(factors.length).toBeGreaterThanOrEqual(8);
    const momentum = factors.find((f) => f.indexCode === "MSCI_INDIA_MOMENTUM");
    const value = factors.find((f) => f.indexCode === "MSCI_INDIA_VALUE");
    expect(momentum).toBeDefined();
    expect(value).toBeDefined();
    expect(momentum!.return1Y).toBeGreaterThan(value!.return1Y);

    // Country Markets
    const countries = report.countryMarkets;
    expect(countries.length).toBeGreaterThanOrEqual(8);
    const us = countries.find((c) => c.countryCode === "US");
    const china = countries.find((c) => c.countryCode === "CN");
    const japan = countries.find((c) => c.countryCode === "JP");
    expect(us).toBeDefined();
    expect(china).toBeDefined();
    expect(japan).toBeDefined();
    expect(us!.sovereignYield10Y).toBeGreaterThan(4.0);
    expect(typeof us!.yieldSpreadVsIndiaBps).toBe("number");
  });

  it("should evaluate Indian ADRs with accurate arbitrage spreads and overnight sector signals", () => {
    const adrs = msciFactorService.getIndianAdrPerformances();

    expect(Array.isArray(adrs)).toBe(true);
    expect(adrs.length).toBeGreaterThanOrEqual(5);

    const hdb = adrs.find((a) => a.symbol === "HDB");
    const infy = adrs.find((a) => a.symbol === "INFY");
    const ibn = adrs.find((a) => a.symbol === "IBN");

    expect(hdb).toBeDefined();
    expect(infy).toBeDefined();
    expect(ibn).toBeDefined();

    expect(hdb!.underlyingNseSymbol).toBe("HDFCBANK");
    expect(hdb!.impliedInrPrice).toBeGreaterThan(1500);
    expect(typeof hdb!.premiumDiscountPct).toBe("number");

    expect(infy!.underlyingNseSymbol).toBe("INFY");
    expect(infy!.impliedInrPrice).toBeGreaterThan(1800);
    expect(typeof infy!.premiumDiscountPct).toBe("number");

    // Composite Sentiment
    const composite = msciFactorService.computeAdrComposite(adrs);
    expect(composite).toBeDefined();
    expect(typeof composite.averagePremiumPct).toBe("number");
    expect(typeof composite.bankingAdrLeadPct).toBe("number");
    expect(typeof composite.itAdrLeadPct).toBe("number");
    expect(["STRONG_FOREIGN_DEMAND", "NEUTRAL_FLOW", "FOREIGN_SELLING"]).toContain(composite.compositeSentiment);
  });

  it("should evaluate the 6 institutional allocation pillars and generate global FII scorecards", async () => {
    const report = await globalFiiTrackerEngine.getGlobalFiiReport();

    expect(report).toBeDefined();
    expect(report.engine_version).toBe(FII_TRACKER_VERSION);
    expect(report.calculation_timestamp).toBeDefined();

    // Stance overview
    expect(report.globalFiiStanceOverview.topFavoredDestinations.length).toBeGreaterThan(0);
    expect(report.globalFiiStanceOverview.leastFavoredDestinations.length).toBeGreaterThan(0);

    // India deep dive
    expect(report.indiaDeepDive.compositeScore).toBeGreaterThan(80.0);
    expect(report.indiaDeepDive.allocationStance).toBe("STRONG_OVERWEIGHT");
    expect(report.indiaDeepDive.rankInEmergingMarkets).toBe(1);
    expect(report.indiaDeepDive.fpiIndexFuturesLsRatio).toBeGreaterThan(0);

    // Multi-country scorecards
    const cards = report.scorecards;
    expect(cards.length).toBeGreaterThanOrEqual(8);

    for (const sc of cards) {
      expect(sc.countryCode).toBeDefined();
      expect(sc.compositeFiiScore).toBeGreaterThanOrEqual(0);
      expect(sc.compositeFiiScore).toBeLessThanOrEqual(100);

      // Verify the 6 institutional pillars are present and within valid range
      expect(sc.macroGrowthScore).toBeGreaterThanOrEqual(0);
      expect(sc.macroGrowthScore).toBeLessThanOrEqual(100);
      expect(sc.fxRiskScore).toBeGreaterThanOrEqual(0);
      expect(sc.fxRiskScore).toBeLessThanOrEqual(100);
      expect(sc.valuationAttractivenessScore).toBeGreaterThanOrEqual(0);
      expect(sc.valuationAttractivenessScore).toBeLessThanOrEqual(100);
      expect(sc.liquidityPolicyScore).toBeGreaterThanOrEqual(0);
      expect(sc.liquidityPolicyScore).toBeLessThanOrEqual(100);
      expect(sc.marketAccessibilityScore).toBeGreaterThanOrEqual(0);
      expect(sc.marketAccessibilityScore).toBeLessThanOrEqual(100);
      expect(sc.geopoliticalStabilityScore).toBeGreaterThanOrEqual(0);
      expect(sc.geopoliticalStabilityScore).toBeLessThanOrEqual(100);

      // Mathematical consistency of composite score
      const expectedComposite = Number(
        (
          sc.macroGrowthScore * 0.2 +
          sc.fxRiskScore * 0.2 +
          sc.valuationAttractivenessScore * 0.2 +
          sc.liquidityPolicyScore * 0.15 +
          sc.marketAccessibilityScore * 0.15 +
          sc.geopoliticalStabilityScore * 0.1
        ).toFixed(1)
      );
      expect(Math.abs(sc.compositeFiiScore - expectedComposite)).toBeLessThanOrEqual(0.1);

      expect([
        "STRONG_OVERWEIGHT",
        "MODERATE_OVERWEIGHT",
        "NEUTRAL",
        "UNDERWEIGHT",
        "TACTICAL_AVOID",
      ]).toContain(sc.fiiAllocationStance);
    }

    // Cross-border realized flows
    expect(report.recentFlows.length).toBeGreaterThanOrEqual(8);
    const inFlow = report.recentFlows.find((f) => f.countryCode === "IN");
    const usFlow = report.recentFlows.find((f) => f.countryCode === "US");
    expect(inFlow).toBeDefined();
    expect(usFlow).toBeDefined();
    expect(typeof inFlow!.trailing30dCumulativeUsdMn).toBe("number");
    expect(typeof usFlow!.foreignOwnershipPctOfMcap).toBe("number");

    // Tactical pair trades
    expect(report.crossCountryPairTrades.length).toBeGreaterThanOrEqual(2);
    expect(report.explainability.factorsConsidered.length).toBe(6);
  });

  it("should compute dynamic Pearson correlation and validate statistical bounding", () => {
    // Perfect positive correlation
    const seriesA = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
    const seriesB = [2.0, 4.0, 6.0, 8.0, 10.0, 12.0];
    const rhoPos = globalMarketIntelligenceEngine.calculatePearsonCorrelation(seriesA, seriesB);
    expect(rhoPos).toBe(1.0);

    // Perfect inverse correlation
    const seriesC = [10.0, 8.0, 6.0, 4.0, 2.0, 0.0];
    const rhoNeg = globalMarketIntelligenceEngine.calculatePearsonCorrelation(seriesA, seriesC);
    expect(rhoNeg).toBe(-1.0);

    // Uncorrelated series
    const seriesD = [1.0, -1.0, 1.0, -1.0, 1.0, -1.0];
    const rhoUncorr = globalMarketIntelligenceEngine.calculatePearsonCorrelation(seriesA, seriesD);
    expect(Math.abs(rhoUncorr)).toBeLessThan(0.3);

    // Bounds checking
    expect(rhoPos).toBeLessThanOrEqual(1.0);
    expect(rhoNeg).toBeGreaterThanOrEqual(-1.0);
  });

  it("should evaluate Macro-Micro Coherence Index (MMCI) and detect market breadth divergence", async () => {
    const { aiRegimeDetectionEngine } = await import("../services/ai-regime-detection-engine");
    const result = await aiRegimeDetectionEngine.detectCurrentRegime();

    expect(result).toBeDefined();
    expect(result.macroMicroCoherence).toBeDefined();
    expect(result.macroMicroCoherence!.score).toBeGreaterThanOrEqual(0);
    expect(result.macroMicroCoherence!.score).toBeLessThanOrEqual(100);
    expect([
      "NONE",
      "BEARISH_BREADTH_DIVERGENCE",
      "BULLISH_ABSORPTION_CONVERGENCE",
    ]).toContain(result.macroMicroCoherence!.divergenceType);
    expect(typeof result.macroMicroCoherence!.breadthThrust).toBe("boolean");
    expect(typeof result.macroMicroCoherence!.shortSqueezeRisk).toBe("boolean");
    expect(result.macroMicroCoherence!.summaryNote).toBeDefined();
  });
});
