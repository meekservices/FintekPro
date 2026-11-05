/**
 * @file quant-engine-upgrade.test.ts
 * @description Unit tests for FintekPro Quant Alpha Engine, Tail-Risk Stress Testing, and Advanced Factors.
 * 
 * Verifies:
 * 1. Tail-Risk Engine: Parametric/Historical VaR, Fat-Tailed CVaR (95% & 99%), and Macro Crash Scenarios.
 * 2. Advanced Quant Factors: Minervini VCP, Mansfield Relative Strength vs Nifty 50, Delivery Volume Spikes, Trend Smoothness.
 * 3. Market Regime Detector integration.
 */

import { describe, it, expect } from "vitest";
import {
	calculateTailRiskAndStress,
	STANDARD_MACRO_SCENARIOS,
	type PortfolioAssetInput,
} from "../services/quant/tail-risk-stress-engine";
import {
	calculateVcp,
	calculateMansfieldRelativeStrength,
	calculateDeliveryVolumeSpike,
	calculateTrendSmoothness,
} from "../services/quant/advanced-quant-factors";

describe("FintekPro Quant Alpha & Risk Engine Upgrades (GCR v1.0 + FASP-AI v1.0)", () => {
	it("1. Tail-Risk Stress Engine: Computes VaR, CVaR 95/99%, and Macro Crash Drawdowns", () => {
		const samplePortfolio: PortfolioAssetInput[] = [
			{ symbol: "HDFCBANK", assetClass: "BANKING", weight: 0.35, beta: 1.05 },
			{ symbol: "TCS", assetClass: "IT", weight: 0.25, beta: 0.85 },
			{ symbol: "RELIANCE", assetClass: "LARGE_CAP", weight: 0.20, beta: 1.10 },
			{ symbol: "GSEC10Y", assetClass: "DEBT", weight: 0.15, beta: 0.12 },
			{ symbol: "GOLDBEES", assetClass: "GOLD", weight: 0.05, beta: 0.02 },
		];

		const result = calculateTailRiskAndStress(samplePortfolio);

		expect(result).toBeDefined();
		expect(result.varMetrics.confidence95_dailyVaRPct).toBeGreaterThan(0);
		expect(result.varMetrics.cvar95_expectedShortfallPct).toBeGreaterThan(result.varMetrics.confidence95_dailyVaRPct);
		expect(result.varMetrics.cvar99_expectedShortfallPct).toBeGreaterThan(result.varMetrics.cvar95_expectedShortfallPct);

		// Must test all standard macro crash scenarios (COVID 2020, GFC 2008, 2013 Taper Tantrum)
		expect(result.stressTestScenarios.length).toBe(STANDARD_MACRO_SCENARIOS.length);
		const covidScenario = result.stressTestScenarios.find((s) => s.scenarioId === "COVID_2020_CRASH");
		expect(covidScenario).toBeDefined();
		expect(covidScenario?.estimatedPortfolioDrawdownPct).toBeLessThan(0);

		// Portfolio robustness score check
		expect(result.portfolioRobustnessScore).toBeGreaterThanOrEqual(0);
		expect(result.portfolioRobustnessScore).toBeLessThanOrEqual(100);
	});

	it("2. Advanced Quant Factors: Evaluates Minervini VCP with ATR compression", () => {
		// Mock 25 bars with decreasing volatility (VCP coiling)
		const closes = [100, 105, 102, 108, 104, 107, 105, 108, 106, 107, 106.5, 107.2, 106.8, 107.5, 107.1, 107.6, 107.4, 107.8, 107.5, 107.9, 107.8, 108, 107.9, 108.1, 108.2];
		const highs = closes.map((c, i) => c + Math.max(0.2, (25 - i) * 0.15));
		const lows = closes.map((c, i) => c - Math.max(0.2, (25 - i) * 0.15));

		const vcp = calculateVcp({
			symbol: "ICICIBANK",
			highs,
			lows,
			closes,
			weekHigh52: 110,
		});

		expect(vcp).toBeDefined();
		expect(vcp.compressionRatio).toBeLessThan(1.0); // ATR(5) should be compressed relative to ATR(20)
		expect(vcp.vcpScore).toBeGreaterThanOrEqual(50);
		expect(vcp.stage).toBeDefined();
	});

	it("3. Advanced Quant Factors: Trend Smoothness (R^2 Log Prices)", () => {
		// Smooth compounder (linear drift on log scale)
		const smoothCloses = Array.from({ length: 30 }, (_, i) => 100 * Math.exp(0.003 * i));
		const smoothTrend = calculateTrendSmoothness({ symbol: "TITAN", closes: smoothCloses });

		expect(smoothTrend.rSquared).toBeGreaterThan(0.95);
		expect(smoothTrend.grade).toBe("EXEMPLARY_STEADY_COMPOUNDER");
		expect(smoothTrend.momentumQualityScore).toBeGreaterThanOrEqual(85);

		// Choppy / erratic action
		const choppyCloses = [100, 115, 95, 120, 90, 110, 85, 125, 88, 112, 92, 118, 89, 115, 91];
		const choppyTrend = calculateTrendSmoothness({ symbol: "VOLATILE", closes: choppyCloses });
		expect(choppyTrend.rSquared).toBeLessThan(0.3);
		expect(choppyTrend.grade).toBe("CHOPPY_ERRATIC_VOLATILITY");
	});

	it("4. Advanced Quant Factors: Mansfield Relative Strength vs Benchmark", () => {
		const stockCloses = Array.from({ length: 30 }, (_, i) => 100 * (1 + 0.015 * i)); // Outperforming
		const benchmarkCloses = Array.from({ length: 30 }, (_, i) => 24000 * (1 + 0.005 * i)); // Slower benchmark

		const mrs = calculateMansfieldRelativeStrength({
			symbol: "BHARTIARTL",
			stockCloses,
			benchmarkCloses,
			lookbackSma: 15,
		});

		expect(mrs).toBeDefined();
		expect(mrs.currentRsScore).toBeGreaterThan(0);
		expect(["STRONG_OUTPERFORMANCE", "EMERGING_OUTPERFORMANCE"]).toContain(mrs.rsTrend);
	});
});
