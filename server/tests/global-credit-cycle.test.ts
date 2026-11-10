/**
 * @file global-credit-cycle.test.ts
 * @description Unit & Institutional Integration Tests for the Global Credit Cycle Engine (GCCE).
 *
 * Verifies:
 *   1. Deterministic composite credit scoring & FASP-AI compliance
 *   2. 5-Pillar weighting math (HY OAS, SLOOS, Credit Impulse, EMBI, Copper/Gold)
 *   3. Dynamic regime mapping & systemic tripwire thresholding
 *   4. Machine-readable downstream feeds (AI Regime, Quant Orchestrator, Tail Risk)
 *   5. Tail-Risk scenario validation for GMIE_CREDIT_CRUNCH_OAS_650
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v3.0
 */

import { describe, it, expect } from "vitest";
import {
	globalCreditCycleService,
	CREDIT_CYCLE_ENGINE_VERSION,
	type CreditIndicatorInput,
} from "../services/macro/global-credit-cycle-service";
import {
	calculateTailRiskAndStress,
	STANDARD_MACRO_SCENARIOS,
	type PortfolioAssetInput,
} from "../services/quant/tail-risk-stress-engine";

describe("Global Credit Cycle Engine (GCCE-v1.0.0)", () => {
	// ─── 1. Governance & Determinism ───────────────────────────────────────────
	describe("1. Engine Compliance & Governance", () => {
		it("returns valid engine_version and calculation_timestamp", async () => {
			const report = await globalCreditCycleService.getCreditCycleReport(true);
			expect(report.engine_version).toBe(CREDIT_CYCLE_ENGINE_VERSION);
			expect(report.calculation_timestamp).toBeDefined();
			expect(new Date(report.calculation_timestamp).getTime()).toBeGreaterThan(0);
		});

		it("produces identical scores for identical inputs (zero hidden randomness)", () => {
			const inputs: CreditIndicatorInput = {
				usHyOasBps: 345,
				sloosNetTighteningPct: 8.5,
				embiGlobalSpreadBps: 290,
				chinaCreditImpulsePct: 24.5,
				indiaBankCreditGrowthYoY: 13.8,
				indiaCommercialPaperSpreadBps: 45,
				copperGoldRatio: 0.00175,
			};

			const run1 = globalCreditCycleService.evaluateCreditCycle(inputs, "2026-11-10");
			const run2 = globalCreditCycleService.evaluateCreditCycle(inputs, "2026-11-10");

			expect(run1.compositeCreditScore).toBe(run2.compositeCreditScore);
			expect(run1.creditCycleRegime).toBe(run2.creditCycleRegime);
			expect(run1.creditStressTripwire).toBe(run2.creditStressTripwire);
			expect(run1.pillars).toEqual(run2.pillars);
		});

		it("exposes full mathematical explainability layer", async () => {
			const report = await globalCreditCycleService.getCreditCycleReport();
			expect(report.explainability).toBeDefined();
			expect(report.explainability.formulaApplied).toContain("HY_OAS");
			expect(report.explainability.factorsConsidered.length).toBeGreaterThanOrEqual(5);
			expect(report.explainability.intermediateSteps).toBeDefined();
			expect(report.explainability.intermediateSteps.hyOasContribution).toBeGreaterThan(0);
		});
	});

	// ─── 2. 5-Pillar Credit Scoring Math ───────────────────────────────────────
	describe("2. 5-Pillar Credit Scoring Math", () => {
		it("correctly weights all 5 pillars summing to 1.0 (100%)", async () => {
			const report = await globalCreditCycleService.getCreditCycleReport();
			const totalWeight = report.pillars.reduce((acc, p) => acc + p.weight, 0);
			expect(Math.abs(totalWeight - 1.0)).toBeLessThan(0.001);

			const pillarIds = report.pillars.map((p) => p.pillarId);
			expect(pillarIds).toContain("P1_US_HY_OAS");
			expect(pillarIds).toContain("P2_SLOOS_LENDING_STANDARDS");
			expect(pillarIds).toContain("P3_CREDIT_IMPULSE");
			expect(pillarIds).toContain("P4_EMBI_SPREAD");
			expect(pillarIds).toContain("P5_COPPER_GOLD_BAROMETER");
		});

		it("accurately scores expansionary conditions (HY OAS < 350 bps)", () => {
			const expansionInputs: CreditIndicatorInput = {
				usHyOasBps: 310, // Expansionary (< 350 bps)
				sloosNetTighteningPct: 2.0, // Easy lending
				embiGlobalSpreadBps: 260, // EM appetite high
				chinaCreditImpulsePct: 28.0, // Robust credit impulse
				indiaBankCreditGrowthYoY: 14.5, // Strong credit growth
				indiaCommercialPaperSpreadBps: 38,
				copperGoldRatio: 0.00185,
			};

			const result = globalCreditCycleService.evaluateCreditCycle(expansionInputs);
			expect(result.compositeCreditScore).toBeGreaterThanOrEqual(70);
			expect(result.creditCycleRegime).toBe("EXPANSIONARY_CREDIT");
			expect(result.creditStressTripwire).toBe(false);
		});

		it("accurately detects severe credit crunch when HY OAS blows out (> 600 bps)", () => {
			const crisisInputs: CreditIndicatorInput = {
				usHyOasBps: 820, // Crisis band (> 750 bps)
				sloosNetTighteningPct: 55.0, // Aggressive lending freeze
				embiGlobalSpreadBps: 580, // EM distress
				chinaCreditImpulsePct: -6.5, // Negative contraction
				indiaBankCreditGrowthYoY: 7.0, // Slowdown
				indiaCommercialPaperSpreadBps: 220, // CP distress
				copperGoldRatio: 0.00120, // Copper collapse / Gold flight
			};

			const result = globalCreditCycleService.evaluateCreditCycle(crisisInputs);
			expect(result.compositeCreditScore).toBeLessThan(38);
			expect(result.creditCycleRegime).toBe("SEVERE_CREDIT_CRUNCH");
			expect(result.creditStressTripwire).toBe(true);
		});
	});

	// ─── 3. Downstream Institutional Synergy Feeds ─────────────────────────────
	describe("3. Downstream Institutional Synergy Feeds", () => {
		it("generates structured machine-readable feeds for AI Regime and Quant Orchestrator", async () => {
			const report = await globalCreditCycleService.getCreditCycleReport();
			const { downstreamFeeds } = report;

			expect(downstreamFeeds.aiRegimeFeed).toBeDefined();
			expect(["EXPANSIONARY_CREDIT", "NEUTRAL_LATE_CYCLE", "CREDIT_CONTRACTION", "SEVERE_CREDIT_CRUNCH"]).toContain(
				downstreamFeeds.aiRegimeFeed.creditRegime
			);
			expect(["NONE", "MODERATE", "SEVERE"]).toContain(downstreamFeeds.aiRegimeFeed.equityMultipleHeadwind);

			expect(downstreamFeeds.quantOrchestratorFeed).toBeDefined();
			expect(["OVERWEIGHT", "NEUTRAL", "UNDERWEIGHT"]).toContain(
				downstreamFeeds.quantOrchestratorFeed.recommendedCorporateBondTilt
			);

			expect(downstreamFeeds.tailRiskFeed).toBeDefined();
			expect(downstreamFeeds.tailRiskFeed.recommendedStressScenario).toBeDefined();
		});
	});

	// ─── 4. Forward Credit Shock Scenario Simulation ──────────────────────────
	describe("4. Forward Credit Shock Scenario Simulation", () => {
		it("includes GMIE_CREDIT_CRUNCH_OAS_650 in STANDARD_MACRO_SCENARIOS", () => {
			const creditCrunchScenario = STANDARD_MACRO_SCENARIOS.find(
				(s) => s.id === "GMIE_CREDIT_CRUNCH_OAS_650"
			);
			expect(creditCrunchScenario).toBeDefined();
			expect(creditCrunchScenario?.broadMarketShockPct).toBe(-17.5);
			expect(creditCrunchScenario?.sectorShocks.BANKING).toBe(-22.0);
			expect(creditCrunchScenario?.sectorShocks.GOLD).toBe(11.0);
		});

		it("simulates portfolio stress drawdown under credit crunch with banking hit and gold buffer", () => {
			const mockAssets: PortfolioAssetInput[] = [
				{ symbol: "HDFCBANK", name: "HDFC Bank Ltd", weight: 0.40, assetClass: "BANKING" },
				{ symbol: "TCS", name: "Tata Consultancy Services", weight: 0.30, assetClass: "IT" },
				{ symbol: "GOLDBEES", name: "Nippon India ETF Gold BeES", weight: 0.20, assetClass: "GOLD" },
				{ symbol: "LIQUIDBEES", name: "Nippon India ETF Liquid BeES", weight: 0.10, assetClass: "DEBT" },
			];

			const stressAnalysis = calculateTailRiskAndStress(mockAssets, [-0.02, 0.01, -0.015, 0.005]);
			const creditStress = stressAnalysis.stressTestScenarios.find(
				(s) => s.scenarioId === "GMIE_CREDIT_CRUNCH_OAS_650"
			);

			expect(creditStress).toBeDefined();
			expect(creditStress?.estimatedPortfolioDrawdownPct).toBeLessThan(0);
			expect(creditStress?.hedgingAssets.some((a) => a.includes("GOLDBEES"))).toBe(true);
			expect(creditStress?.vulnerableAssets.some((a) => a.includes("HDFCBANK"))).toBe(true);
		});
	});
});
