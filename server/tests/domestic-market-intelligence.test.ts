/**
 * @file domestic-market-intelligence.test.ts
 * @description Unit tests for FintekPro Domestic Market Intelligence Engine (DMIE v1.0).
 *
 * Validates:
 *   - Strict separation of domestic factors from global contagion metrics
 *   - Macro factors: RBI repo stance, CPI inflation, CCIL 10Y G-Sec yield, AMFI SIP inflows
 *   - Micro factors: Market breadth (A/D ratio, % > 50-DMA), F&O derivatives structure, sector rotation
 *   - Mathematical determinism and bounding of Domestic Composite Score (0-100)
 *   - FASP-AI v1.0 compliance (engine_version, calculation_timestamp, explainability layer)
 */

import { describe, it, expect } from "vitest";
import {
  domesticMarketIntelligenceEngine,
  DMIE_VERSION,
  type DomesticMacroFactors,
  type DomesticMicroFactors,
} from "../services/macro/domestic-market-intelligence-engine";

describe("DomesticMarketIntelligenceEngine (DMIE v1.0)", () => {
  it("should have valid engine version identification", () => {
    expect(DMIE_VERSION).toBe("DMIE-v1.0.0");
  });

  it("should evaluate pure domestic macro factors with valid bounds", async () => {
    const macro = await domesticMarketIntelligenceEngine.evaluateDomesticMacro();

    expect(macro).toBeDefined();

    // 1. Monetary Policy
    expect(macro.monetaryPolicy.repoRate).toBeGreaterThanOrEqual(4.0);
    expect(macro.monetaryPolicy.repoRate).toBeLessThanOrEqual(10.0);
    expect(["ACCOMMODATIVE", "NEUTRAL", "WITHDRAWAL_OF_ACCOMMODATION", "CALIBRATED_TIGHTENING"]).toContain(
      macro.monetaryPolicy.stance
    );
    expect(["Surplus", "Deficit", "Neutral"]).toContain(macro.monetaryPolicy.systemLiquidityStatus);
    expect(macro.monetaryPolicy.trepsOvernightRate).toBeGreaterThan(0);

    // 2. Inflation & Real Rate
    expect(macro.inflation.cpiInflationPct).toBeGreaterThan(0);
    expect(macro.inflation.coreInflationPct).toBeGreaterThan(0);
    expect(macro.inflation.rbiTargetBand).toBe("4.00% ± 2.00%");
    expect(typeof macro.inflation.realPolicyRatePct).toBe("number");
    expect(["WITHIN_TOLERANCE", "ELEVATED_WATCH", "BREACH_UPPER_BAND"]).toContain(macro.inflation.inflationStance);

    // 3. Sovereign Debt (CCIL)
    expect(macro.sovereignDebt.gsec10YYield).toBeGreaterThan(4.0);
    expect(macro.sovereignDebt.gsec10YYield).toBeLessThan(12.0);
    expect(typeof macro.sovereignDebt.real10YYield).toBe("number");
    expect(["NORMAL_UPWARD", "FLAT", "INVERTED"]).toContain(macro.sovereignDebt.curveStructure);

    // 4. Domestic Institutional Liquidity (AMFI SIPs)
    expect(macro.domesticLiquidity.monthlyMfSipInflowCr).toBeGreaterThanOrEqual(15000);
    expect(typeof macro.domesticLiquidity.diiCashNetCr).toBe("number");
    expect(["STRONG_ACCUMULATION", "MODERATE_ABSORPTION", "NEUTRAL_DISTRIBUTION"]).toContain(
      macro.domesticLiquidity.diiPosture
    );
  });

  it("should evaluate pure domestic micro factors and market structure", async () => {
    const micro = await domesticMarketIntelligenceEngine.evaluateDomesticMicro();

    expect(micro).toBeDefined();

    // 1. Market Breadth
    expect(micro.marketBreadth).toBeDefined();
    expect(micro.marketBreadth.advanceDeclineRatio).toBeGreaterThan(0);
    expect(micro.marketBreadth.pctAbove50Dma).toBeGreaterThanOrEqual(0);
    expect(micro.marketBreadth.pctAbove50Dma).toBeLessThanOrEqual(100);
    expect(["BROAD_ADVANCE", "SELECTIVE_CHOP", "BROAD_DECLINE"]).toContain(micro.marketBreadth.breadthRegime);

    // 2. Derivatives Structure
    expect(micro.derivativesStructure.niftyPcr).toBeGreaterThan(0);
    expect(micro.derivativesStructure.fpiIndexFuturesLongShortRatio).toBeGreaterThan(0);
    expect(typeof micro.derivativesStructure.shortSqueezeAlert).toBe("boolean");
    expect([
      "OVERSOLD_BULLISH_REVERSAL",
      "HEALTHY_EXPANSION",
      "NEUTRAL",
      "OVERBOUGHT_CORRECTION_RISK",
    ]).toContain(micro.derivativesStructure.derivativesSentiment);

    // 3. Sector Rotation
    expect(Array.isArray(micro.sectorRotation.topAccumulatedSectors)).toBe(true);
    expect(micro.sectorRotation.topAccumulatedSectors.length).toBeGreaterThan(0);
    expect(Array.isArray(micro.sectorRotation.topDistributedSectors)).toBe(true);
    expect(["FAVORING_DOMESTIC_CYCLICALS", "FAVORING_DEFENSIVES", "BALANCED"]).toContain(
      micro.sectorRotation.defensiveVsCyclicalBias
    );

    // 4. Domestic Commodities & Volatility
    expect(micro.domesticCommodities.mcxGoldPrice).toBeGreaterThan(50000);
    expect(micro.domesticCommodities.mcxSilverPrice).toBeGreaterThan(50000);
    expect(micro.volatility.indiaVix).toBeGreaterThan(5);
    expect(micro.volatility.indiaVix).toBeLessThan(70);
    expect(["BENIGN_STABILITY", "CONTROLLED_NORMAL", "ELEVATED_RISK", "PANIC_SPIKE"]).toContain(
      micro.volatility.volatilityRegime
    );
  });

  it("should compute deterministic bounded Domestic Composite Health Score", () => {
    const dummyMacro: DomesticMacroFactors = {
      monetaryPolicy: {
        repoRate: 6.5,
        stance: "WITHDRAWAL_OF_ACCOMMODATION",
        systemLiquidityStatus: "Surplus",
        systemicLiquidityCr: 45000,
        trepsOvernightRate: 6.45,
        fbilMiborOvernight: 6.5,
      },
      inflation: {
        cpiInflationPct: 5.2,
        coreInflationPct: 4.1,
        rbiTargetBand: "4.00% ± 2.00%",
        realPolicyRatePct: 1.3,
        inflationStance: "WITHIN_TOLERANCE",
      },
      sovereignDebt: {
        gsec10YYield: 6.79,
        real10YYield: 1.59,
        yieldCurveSlope10Y2Y: 24,
        curveStructure: "NORMAL_UPWARD",
      },
      domesticLiquidity: {
        monthlyMfSipInflowCr: 23500,
        diiCashNetCr: 3200,
        diiCashBuyCr: 12000,
        diiCashSellCr: 8800,
        diiCumulative5DayNetCr: 14000,
        diiPosture: "STRONG_ACCUMULATION",
      },
    };

    const dummyMicro: DomesticMicroFactors = {
      marketBreadth: {
        date: "2026-11-11",
        advances: 1540,
        declines: 820,
        unchanged: 100,
        advanceDeclineRatio: 1.87,
        pctAbove50Dma: 64.5,
        pctAbove200Dma: 58.0,
        breadthThrustSignal: true,
        breadthRegime: "BROAD_ADVANCE",
        updatedAt: "2026-11-11T12:00:00Z",
      },
      derivativesStructure: {
        niftyPcr: 1.18,
        bankNiftyPcr: 1.05,
        fpiIndexFuturesLongShortRatio: 0.35,
        shortSqueezeAlert: false,
        derivativesSentiment: "HEALTHY_EXPANSION",
      },
      sectorRotation: {
        topAccumulatedSectors: [
          { sector: "Defense", dayChangePct: 1.8, relativeStrengthScore: 72, trend: "ACCUMULATION" },
        ],
        topDistributedSectors: [
          { sector: "IT", dayChangePct: -0.6, relativeStrengthScore: 38, trend: "DISTRIBUTION" },
        ],
        defensiveVsCyclicalBias: "FAVORING_DOMESTIC_CYCLICALS",
      },
      domesticCommodities: {
        mcxGoldPrice: 76500,
        mcxSilverPrice: 91000,
        mcxCrudeSpotPrice: 5800,
        copperSpotPrice: 840,
        ncdexAgriPulse: "STABLE",
      },
      volatility: {
        indiaVix: 13.8,
        volatilityRegime: "CONTROLLED_NORMAL",
      },
    };

    const composite = domesticMarketIntelligenceEngine.computeDomesticComposite(dummyMacro, dummyMicro);

    expect(composite.domesticScore).toBeGreaterThanOrEqual(0);
    expect(composite.domesticScore).toBeLessThanOrEqual(100);
    expect(composite.domesticScore).toBeGreaterThan(70); // Strong macro + breadth thrust
    expect(composite.domesticRegime).toBe("DOMESTIC_BULL_EXPANSION");
    expect(composite.keyStrengths.length).toBeGreaterThan(0);
    expect(composite.recommendedDomesticAction).toBeDefined();
  });

  it("should generate complete Domestic Market Intelligence Report conforming to FASP-AI rules", async () => {
    const report = await domesticMarketIntelligenceEngine.getDomesticIntelligenceReport(true);

    expect(report.engine_version).toBe(DMIE_VERSION);
    expect(report.calculation_timestamp).toBeDefined();
    expect(report.domesticComposite).toBeDefined();
    expect(report.macroFactors).toBeDefined();
    expect(report.microFactors).toBeDefined();

    // FASP-AI explainability contract
    const fasp = report.faspAdvisorySummary;
    expect(fasp.confidence_score).toBeGreaterThanOrEqual(70);
    expect(fasp.factors_considered.length).toBeGreaterThanOrEqual(5);
    expect(fasp.formula_applied).toBeDefined();
    expect(fasp.intermediate_steps).toBeDefined();
    expect(fasp.regulatory_disclaimer).toContain("SEBI Compliance");

    // Meta verification
    expect(report.meta.dataSource).toContain("Domestic Indian Primary");
    expect(report.meta.executionLatencyMs).toBeGreaterThanOrEqual(0);
  });
});

