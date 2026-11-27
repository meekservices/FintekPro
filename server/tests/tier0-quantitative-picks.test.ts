/**
 * @file tier0-quantitative-picks.test.ts
 * @description Unit tests for FintekPro Tier-0 Institutional Quantitative Upgrades:
 *              1. 4-State Macro Regime Classifier
 *              2. Cross-Asset Factor Covariance & Portfolio Risk Engine
 *              3. Real-Time Alpha Decay Surveillance & Trailing Re-underwriting
 */

import { describe, it, expect } from "vitest";
import { macroRegimeClassifier } from "../services/picks/macro-regime-classifier";
import { crossAssetCovarianceEngine } from "../services/picks/cross-asset-covariance-engine";
import { alphaDecaySurveillanceEngine } from "../services/picks/alpha-decay-surveillance-engine";
import type { DailyPickData } from "../services/pick-of-the-day-service";

describe("Tier-0 Institutional Quantitative Picks Architecture", () => {
	// =========================================================================
	// 1. Macro Regime Classifier
	// =========================================================================
	describe("1. Macro Regime Classifier (Reflation, Stagflation, Deflation, Goldilocks)", () => {
		it("accurately detects GOLDILOCKS regime under strong growth and benign inflation", () => {
			const result = macroRegimeClassifier.classify({
				indiaVix: 12.5,
				nifty50PeRatio: 23.0,
				gSec10YYield: 6.80,
				crudeBrentUsd: 72.0,
				cpiInflationPct: 4.2,
				fiiNetFlowTrend: "INFLOW",
			});

			expect(result.regime).toBe("GOLDILOCKS");
			expect(result.confidenceScore).toBeGreaterThanOrEqual(80);
			expect(result.categoryWeightMultipliers.listed_stocks).toBeGreaterThan(1.2);
			expect(result.categoryWeightMultipliers.etfs).toBeGreaterThan(1.2);
			expect(result.overweightSegments).toContain("listed_stocks");
			expect(result.engine_version).toBe("1.0.0-tier0");
		});

		it("accurately detects STAGFLATION regime under elevated energy prices, high CPI, and FII outflows", () => {
			const result = macroRegimeClassifier.classify({
				indiaVix: 21.0,
				nifty50PeRatio: 19.5,
				gSec10YYield: 7.25,
				crudeBrentUsd: 92.0,
				cpiInflationPct: 6.2,
				fiiNetFlowTrend: "OUTFLOW",
			});

			expect(result.regime).toBe("STAGFLATION");
			expect(result.confidenceScore).toBeGreaterThanOrEqual(75);
			// In Stagflation, SGB & safe commodities MUST be heavily overweighted
			expect(result.categoryWeightMultipliers.sgb).toBeGreaterThan(1.3);
			expect(result.categoryWeightMultipliers.commodities).toBeGreaterThan(1.3);
			// Equities should be tactically underweighted
			expect(result.categoryWeightMultipliers.listed_stocks).toBeLessThan(0.85);
			expect(result.underweightSegments).toContain("listed_stocks");
		});

		it("accurately detects REFLATION regime under robust equity momentum and moderate commodity demand", () => {
			const result = macroRegimeClassifier.classify({
				indiaVix: 15.0,
				nifty50PeRatio: 24.5,
				gSec10YYield: 7.00,
				crudeBrentUsd: 82.0,
				cpiInflationPct: 5.2,
				fiiNetFlowTrend: "INFLOW",
			});

			expect(result.regime).toBe("REFLATION");
			expect(result.categoryWeightMultipliers.commodities).toBeGreaterThanOrEqual(1.3);
			expect(result.categoryWeightMultipliers.listed_stocks).toBeGreaterThanOrEqual(1.25);
			expect(result.overweightSegments).toContain("commodities");
		});

		it("accurately detects DEFLATION / SLOWDOWN regime under cooling inflation and softening demand", () => {
			const result = macroRegimeClassifier.classify({
				indiaVix: 18.0,
				nifty50PeRatio: 17.0,
				gSec10YYield: 6.40,
				crudeBrentUsd: 64.0,
				cpiInflationPct: 3.5,
				fiiNetFlowTrend: "OUTFLOW",
			});

			expect(result.regime).toBe("DEFLATION");
			// In Deflation, long-duration debt and fixed income outperform
			expect(result.categoryWeightMultipliers.bonds).toBeGreaterThan(1.3);
			expect(result.categoryWeightMultipliers.fixed_deposits).toBeGreaterThan(1.2);
			expect(result.underweightSegments).toContain("commodities");
		});
	});

	// =========================================================================
	// 2. Cross-Asset Factor Covariance & Portfolio Risk Engine
	// =========================================================================
	describe("2. Cross-Asset Factor Covariance & Portfolio Risk Engine", () => {
		const mockBasket: DailyPickData[] = [
			{
				id: 1,
				category: "listed_stocks",
				instrumentName: "Tata Consultancy Services Ltd",
				symbol: "TCS",
				recoDate: "2026-11-27",
				recoPrice: 4250,
				targetPrice: 4800,
				stoplossPrice: 4050,
				status: "live",
				rationale: "Enterprise cloud transformation leader with 28% ROE.",
				riskLevel: "medium",
				keyMetrics: { positionSizing: { recommendedWeightPct: 25 } },
			},
			{
				id: 2,
				category: "bonds",
				instrumentName: "NABARD 7.64% 2029 NCD",
				symbol: "NABARD29",
				recoDate: "2026-11-27",
				recoPrice: 10000,
				targetPrice: 10500,
				stoplossPrice: 9800,
				status: "live",
				rationale: "AAA quasi-sovereign bond yielding 7.64% YTM.",
				riskLevel: "low",
				keyMetrics: { positionSizing: { recommendedWeightPct: 25 } },
			},
			{
				id: 3,
				category: "sgb",
				instrumentName: "Sovereign Gold Bond 2023-24 Series IV",
				symbol: "SGBMAR32",
				recoDate: "2026-11-27",
				recoPrice: 12487,
				targetPrice: 15000,
				stoplossPrice: 11200,
				status: "live",
				rationale: "Sovereign gold exposure with 2.5% tax-free coupon.",
				riskLevel: "low",
				keyMetrics: { positionSizing: { recommendedWeightPct: 25 } },
			},
			{
				id: 4,
				category: "fixed_deposits",
				instrumentName: "State Bank of India 3-Year Green FD",
				symbol: "SBIFD3Y",
				recoDate: "2026-11-27",
				recoPrice: 100000,
				targetPrice: 124500,
				stoplossPrice: 100000,
				status: "live",
				rationale: "DICGC protected 7.20% APY quarterly compounded.",
				riskLevel: "low",
				keyMetrics: { positionSizing: { recommendedWeightPct: 25 } },
			},
		];

		it("computes portfolio volatility, correlation matrix, and Diversification Ratio (DR)", () => {
			const report = crossAssetCovarianceEngine.analyzeBasket(mockBasket);

			expect(report.assetCount).toBe(4);
			expect(report.portfolioAnnualVolatilityPct).toBeGreaterThan(0);
			// Multi-asset diversification MUST reduce portfolio vol below weighted average asset vol
			expect(report.portfolioAnnualVolatilityPct).toBeLessThan(report.weightedAverageVolatilityPct);
			// Diversification Ratio = avgVol / portVol MUST exceed 1.25x for this non-correlated basket
			expect(report.diversificationRatio).toBeGreaterThanOrEqual(1.25);
			expect(report.diversificationTier).toBe("EXCELLENT");

			// Parametric VaR (95%) and CVaR (95%) calculations
			expect(report.parametricVaR95_1DayPct).toBeGreaterThan(0);
			expect(report.conditionalVaR95_1DayPct).toBeGreaterThan(report.parametricVaR95_1DayPct);

			// Check asset risk contributions sum up reasonably
			const totalPcr = report.assetContributions.reduce((sum, c) => sum + c.percentageContributionToRiskPct, 0);
			expect(Math.abs(totalPcr - 100)).toBeLessThan(5); // Within rounding variance

			// Equity should contribute the most risk; FD should contribute almost zero
			const stockContrib = report.assetContributions.find((c) => c.category === "listed_stocks");
			const fdContrib = report.assetContributions.find((c) => c.category === "fixed_deposits");
			expect(stockContrib?.percentageContributionToRiskPct).toBeGreaterThan(50);
			expect(fdContrib?.percentageContributionToRiskPct).toBeLessThan(5);
		});
	});

	// =========================================================================
	// 3. Alpha Decay Surveillance & Trailing Re-underwriting Engine
	// =========================================================================
	describe("3. Real-Time Alpha Decay Surveillance & Trailing Re-underwriting", () => {
		const basePick: Pick<
			DailyPickData,
			"instrumentName" | "category" | "recoPrice" | "currentPrice" | "targetPrice" | "stoplossPrice" | "recoDate" | "timeHorizon"
		> = {
			instrumentName: "Reliance Industries Ltd",
			category: "listed_stocks",
			recoPrice: 2500,
			currentPrice: 2600,
			targetPrice: 2800,
			stoplossPrice: 2400,
			recoDate: "2026-11-01",
			timeHorizon: "short_term", // 30 days benchmark
		};

		it("confirms HEALTHY status and MAINTAIN_POSITION for steady momentum", () => {
			// Held 10 days out of 30, current price 2600 (+4% gain out of +12% target)
			const evaluation = alphaDecaySurveillanceEngine.evaluate(basePick, 2600, {
				daysHeldOverride: 10,
				highestPriceSeen: 2620,
			});

			expect(evaluation.alphaHealthScore).toBeGreaterThanOrEqual(70);
			expect(evaluation.healthStatus).toBe("HEALTHY");
			expect(evaluation.recommendedAction).toBe("MAINTAIN_POSITION");
			expect(evaluation.metrics.profitRetentionPct).toBeGreaterThan(80);
		});

		it("triggers TIGHTEN_STOPLOSS when profit surrender is detected from peak", () => {
			// Rallied to 2750 (+10%), but retraced sharply to 2580 (+3.2%)
			const evaluation = alphaDecaySurveillanceEngine.evaluate(basePick, 2580, {
				daysHeldOverride: 15,
				highestPriceSeen: 2750,
			});

			expect(evaluation.healthStatus).toBe("THESIS_DECAYING");
			expect(evaluation.recommendedAction).toBe("TIGHTEN_STOPLOSS");
			expect(evaluation.updatedTrailingStopLoss).toBeGreaterThan(basePick.recoPrice);
			// Trailing stoploss should be elevated to lock in gains
			expect(evaluation.updatedTrailingStopLoss).toBeGreaterThanOrEqual(2540);
		});

		it("triggers TRIM_HALF or TACTICAL_EXIT when holding horizon is exhausted without progress", () => {
			// Held 28 days out of 30 days horizon, but price has stagnated at 2510 (virtually 0% return)
			const evaluation = alphaDecaySurveillanceEngine.evaluate(basePick, 2510, {
				daysHeldOverride: 28,
				highestPriceSeen: 2520,
			});

			expect(evaluation.alphaHealthScore).toBeLessThan(70);
			expect(evaluation.metrics.timeElapsedPct).toBeGreaterThanOrEqual(90);
			expect(["TRIM_HALF", "TACTICAL_EXIT"]).toContain(evaluation.recommendedAction);
		});

		it("triggers CRITICAL_REUNDERWRITE and TACTICAL_EXIT on negative return near stoploss", () => {
			// Held 20 days, current price 2420 (down -3.2%, close to 2400 SL)
			const evaluation = alphaDecaySurveillanceEngine.evaluate(basePick, 2420, {
				daysHeldOverride: 20,
				highestPriceSeen: 2510,
			});

			expect(evaluation.alphaHealthScore).toBeLessThan(50);
			expect(evaluation.healthStatus).toBe("CRITICAL_REUNDERWRITE");
			expect(evaluation.recommendedAction).toBe("TACTICAL_EXIT");
			expect(evaluation.urgency).toBe("HIGH");
		});
	});
});
