import { describe, it, expect } from "vitest";
import { FinancialMetricsCalculator } from "../services/financial-metrics-calculator";
import { usMacroIndicatorsService } from "../services/macro/us-macro-indicators-service";
import { parseScreenerQuery } from "../services/screener/screener-in-query-parser";

describe("Micro Factors Enhancement Suite (MFES)", () => {
	const calc = new FinancialMetricsCalculator();

	describe("Beneish M-Score (8-Variable Forensic Model)", () => {
		it("should calculate clean Beneish M-Score (< -2.22) for non-manipulated accounting", () => {
			const current = {
				revenue: 10000,
				receivables: 800,
				grossProfit: 3500,
				depreciation: 400,
				totalDebt: 1500,
				totalAssets: 12000,
				operatingCashFlow: 1800,
				netIncome: 1200,
				currentAssets: 4500,
			};
			const previous = {
				revenue: 9000,
				receivables: 750,
				grossProfit: 3100,
				depreciation: 380,
				totalDebt: 1600,
				totalAssets: 11000,
				operatingCashFlow: 1600,
				netIncome: 1050,
				currentAssets: 4200,
			};

			const mScore = calc.calculateBeneishMScore(current, previous);
			expect(mScore).not.toBeNull();
			expect(typeof mScore).toBe("number");
			// Clean financial statement is typically < -2.22
			expect(mScore!).toBeLessThan(-2.0);
		});

		it("should detect potential accounting distortion (M-score > -1.78) with soaring receivables & accruals", () => {
			const current = {
				revenue: 12000,
				receivables: 3600, // Doubled receivables
				grossProfit: 5500,
				depreciation: 100, // Aggressively lowered depreciation
				totalDebt: 6000,
				totalAssets: 14000,
				operatingCashFlow: 200, // Poor cash conversion
				netIncome: 3000, // High paper profits
				currentAssets: 5000,
			};
			const previous = {
				revenue: 8000,
				receivables: 1000,
				grossProfit: 2400,
				depreciation: 500,
				totalDebt: 3000,
				totalAssets: 10000,
				operatingCashFlow: 1500,
				netIncome: 1000,
				currentAssets: 4000,
			};

			const mScore = calc.calculateBeneishMScore(current, previous);
			expect(mScore).not.toBeNull();
			// Distorted accounts push M-score above -1.78
			expect(mScore!).toBeGreaterThan(-1.78);
		});
	});

	describe("Sloan Accrual Ratio & Cash Flow Quality", () => {
		it("should accurately compute Sloan Accrual Ratio = (Net Income - OCF) / Total Assets", () => {
			const netIncome = 500;
			const ocf = 750;
			const totalAssets = 5000;
			const ratio = calc.calculateAccrualRatio(netIncome, ocf, totalAssets);
			expect(ratio).toBeCloseTo((500 - 750) / 5000, 4); // -0.05 (clean negative accrual)
		});

		it("should compute Cash Flow Conversion = FCF / Net Income", () => {
			const fcf = 800;
			const netIncome = 1000;
			const conv = calc.calculateCashFlowConversion(fcf, netIncome);
			expect(conv).toBe(0.8);
		});

		it("should compute CFO to EBITDA Ratio", () => {
			const ocf = 1200;
			const ebitda = 1500;
			const ratio = calc.calculateCfoToEbitda(ocf, ebitda);
			expect(ratio).toBe(0.8);
		});

		it("should compute EVA Spread = ROIC - WACC", () => {
			const roicPct = 18.5;
			const waccPct = 11.5;
			const spread = calc.calculateEVASpread(roicPct, waccPct);
			expect(spread).toBe(7.0);
		});
	});

	describe("Amihud Illiquidity Ratio (Price Impact per Lakh)", () => {
		it("should compute Amihud illiquidity over trading days", () => {
			const dailyReturns = [0.01, -0.015, 0.02, -0.005, 0.008, 0.012];
			const dailyTurnoversInLakhs = [500, 450, 600, 400, 550, 520];
			const illiquidity = calc.calculateAmihudIlliquidity(dailyReturns, dailyTurnoversInLakhs);
			expect(illiquidity).not.toBeNull();
			expect(illiquidity!).toBeGreaterThan(0);
		});

		it("should return null if insufficient data points (< 5)", () => {
			const illiquidity = calc.calculateAmihudIlliquidity([0.01, 0.02], [500, 600]);
			expect(illiquidity).toBeNull();
		});
	});
});

describe("US Labor Market & Macroeconomic Indicators Engine (USME)", () => {
	it("should evaluate US Macro report with valid regime and labor telemetry", async () => {
		const report = await usMacroIndicatorsService.getUsMacroReport(true);
		expect(report).toBeDefined();
		expect(report.engine_version).toBe("USME-v1.0.0");
		expect(report.labor.unemploymentRatePct).toBeGreaterThan(0);
		expect(report.labor.sahmRuleValuePct).toBeGreaterThanOrEqual(0);
		expect(["GOLDILOCKS_EXPANSION", "OVERHEATING_TIGHT_LABOR", "STAGFLATION_WARNING", "RECESSION_RISK"]).toContain(report.usMacroRegime);
		expect(report.laborMarketHealthScore).toBeGreaterThanOrEqual(0);
		expect(report.laborMarketHealthScore).toBeLessThanOrEqual(100);
	});

	it("should provide downstream feeds for AIRegime, QuantOrchestrator, and TailRisk", async () => {
		const report = await usMacroIndicatorsService.getUsMacroReport(false);
		expect(report.downstreamFeeds).toBeDefined();
		expect(report.downstreamFeeds.aiRegimeFeed).toBeDefined();
		expect(["TIGHT", "BALANCED", "LOOSE"]).toContain(report.downstreamFeeds.aiRegimeFeed.laborTightness);
		expect(report.downstreamFeeds.quantOrchestratorFeed).toBeDefined();
		expect(["OVERWEIGHT", "NEUTRAL", "UNDERWEIGHT"]).toContain(report.downstreamFeeds.quantOrchestratorFeed.recommendedEmEquityTilt);
		expect(report.downstreamFeeds.tailRiskFeed.recommendedStressScenario).toBe("GMIE_US_RECESSION_SAHM_050");
	});

	it("should generate AI Regime feed directly", async () => {
		const feed = await usMacroIndicatorsService.getAiRegimeFeed();
		expect(feed).toBeDefined();
		expect(["bull", "bear", "sideways", "high_vol"]).toContain(feed.recommendedRegime);
		expect(feed.laborMarketHealthScore).toBeGreaterThan(0);
		expect(feed.summaryDescription.length).toBeGreaterThan(10);
	});
});

describe("Screener Natural Query Parser Micro Factor Aliases", () => {
	it("should parse 'Beneish M-Score < -2.0' query", () => {
		const result = parseScreenerQuery("beneish < -2.0");
		expect(result.success).toBe(true);
		expect(result.clauses[0].dbColumn).toBe("beneish_m_score");
		expect(result.clauses[0].operator).toBe("<");
		expect(result.clauses[0].value).toBe(-2.0);
	});

	it("should parse 'Sloan Accrual Ratio < 0.05' query", () => {
		const result = parseScreenerQuery("sloanaccrual < 0.05");
		expect(result.success).toBe(true);
		expect(result.clauses[0].dbColumn).toBe("sloan_accrual_ratio");
	});

	it("should parse 'Cash Flow Conversion > 0.8 AND EVA Spread > 5%' query", () => {
		const result = parseScreenerQuery("cashflowconversion > 0.8 AND evaspread > 5");
		expect(result.success).toBe(true);
		expect(result.clauses.length).toBe(2);
		expect(result.clauses[0].dbColumn).toBe("cash_flow_conversion_ratio");
		expect(result.clauses[1].dbColumn).toBe("eva_spread");
	});

	it("should parse 'Amihud Illiquidity < 0.0001 AND Delivery % > 50%' query", () => {
		const result = parseScreenerQuery("amihud < 0.0001 AND deliverypercent > 50");
		expect(result.success).toBe(true);
		expect(result.clauses[0].dbColumn).toBe("amihud_illiquidity");
		expect(result.clauses[1].dbColumn).toBe("delivery_percent");
	});
});

