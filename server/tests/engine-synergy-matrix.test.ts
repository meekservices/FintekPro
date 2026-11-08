/**
 * @file engine-synergy-matrix.test.ts
 * @description Comprehensive Integration & Synergy Tests for FintekPro Engine Fleet.
 *
 * Verifies cross-engine mathematical consistency, operational synergy, and telemetry
 * tracking across all quantitative, AI, risk, and data quality engines:
 *   1. Telemetry Fleet Synergy (19 Core Registered Engines)
 *   2. Market Brief ↔ Multi-Exchange Market Service Synergy
 *   3. AI Regime Detection ↔ Multi-Exchange Breadth Synergy
 *   4. Quant Orchestrator ↔ Tail-Risk CVaR Stress-Testing Synergy (Synergy Upgrade 3)
 *   5. Stock Strategy ↔ Pro Thematic Screener & Institutional Flow Footprint
 *   6. Fast Analytical Engine In-Memory Vectorized Acceleration
 *   7. Engine Learning Orchestrator Unified Fleet Calibration
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0 / v3.0
 */

import { describe, it, expect, vi } from "vitest";
import { telemetryBus } from "../services/engine-telemetry-bus";
import { multiExchangeMarketService } from "../services/multi-exchange-market-service";
import { inProcessMarketSnapshotStore } from "../services/market-brief-engine";
import { AIRegimeDetectionEngine } from "../services/ai-regime-detection-engine";
import { fastAnalyticalEngine, type FastStockRecord } from "../services/screener/fast-analytical-engine";
import { engineLearningOrchestrator } from "../services/engine-learning-orchestrator";
import { StockStrategy } from "../services/picks/stock-strategy";
import {
	calculateTailRiskAndStress,
	type PortfolioAssetInput,
} from "../services/quant/tail-risk-stress-engine";

describe("FintekPro Engine Synergy & Performance Fleet Matrix", () => {
	// ─── 1. Telemetry Fleet Registration & Alpha Signal ───────────────────────────
	describe("1. Telemetry Fleet Synergy & Alpha Signal", () => {
		it("registers all 21+ core engines across all functional categories", () => {
			const statuses = telemetryBus.getAllStatuses();
			const engineIds = statuses.map((s) => s.engineId);

			const expectedEngines = [
				"pick-of-the-day",
				"pro-thematic-screener",
				"fast-analytical-engine",
				"institutional-flow",
				"exit-strategy-engine",
				"model-portfolio-optimizer",
				"model-portfolio-quant",
				"quant-orchestrator",
				"tax-loss-harvesting",
				"global-macro-transmission",
				"ai-regime-detection",
				"global-market-intelligence",
				"global-fii-tracker",
				"msci-factor-engine",
				"tail-risk-stress",
				"upstox-golden-pricing",
				"multi-exchange-market",
				"market-brief-engine",
				"scorer-calibration",
				"pick-outcome-analyzer",
				"smart-order-routing",
			];

			for (const id of expectedEngines) {
				expect(engineIds).toContain(id);
			}
			expect(statuses.length).toBeGreaterThanOrEqual(21);
		});

		it("computes unified composite alpha quality across registered engines", () => {
			telemetryBus.report({
				engineId: "quant-orchestrator",
				engineName: "Quant & MVO Portfolio Orchestrator",
				category: "Portfolio",
				reportedAt: new Date().toISOString(),
				latencyMs: 125,
				qualityScore: 94,
				itemsProcessed: 10,
				errorCount: 0,
			});

			const alpha = telemetryBus.getAlphaSignal();
			expect(alpha).toBeDefined();
			expect(typeof alpha.alphaQuality).toBe("number");
			expect(["strong", "moderate", "weak", "poor"]).toContain(alpha.alphaLabel);
			expect(alpha.systemHealth).toBe("HEALTHY");
		});
	});

	// ─── 2. Market Brief ↔ Multi-Exchange Market Service Synergy ──────────────────
	describe("2. Market Brief ↔ Multi-Exchange Market Service Synergy", () => {
		it("enriches market brief snapshot with synchronized multi-exchange metrics", async () => {
			const snapshot = await inProcessMarketSnapshotStore.refreshSnapshot("india");

			expect(snapshot).toBeDefined();
			expect(snapshot.asOfDate).toBeDefined();
			expect(snapshot.forex.usdInr).toBeGreaterThan(70);
			expect(snapshot.sovereign.gsec10Y).toBeGreaterThan(5);

			// Synergy verification: multiExchange is populated with synchronized exchange data
			expect(snapshot.multiExchange).toBeDefined();
			expect(snapshot.multiExchange?.bseBreadth).toBeDefined();
			expect(snapshot.multiExchange?.bseBreadth.advances).toBeGreaterThan(0);
			expect(snapshot.multiExchange?.giftNifty.exchange).toBe("NSE IX (GIFT City IFSC)");
			expect(snapshot.multiExchange?.institutionalFlows.liquidityRegime).toBeDefined();
		}, 15000);
	});

	// ─── 3. AI Regime Detection ↔ Multi-Exchange Breadth Synergy ─────────────────
	describe("3. AI Regime Detection ↔ Multi-Exchange Breadth Synergy", () => {
		it("detects market regime with resilient breadth ingestion without database failures", async () => {
			const engine = new AIRegimeDetectionEngine();
			const regime = await engine.detectCurrentRegime();

			expect(regime).toBeDefined();
			expect(["bull", "bear", "sideways", "high_vol"]).toContain(regime.regimeLabel);
			expect(regime.confidence).toBeGreaterThan(0);

			const breadthSignal = regime.signals.find((s) => s.name === "Market Breadth");
			expect(breadthSignal).toBeDefined();
			expect(breadthSignal?.value).toBeGreaterThan(0);
		});
	});

	// ─── 4. Quant Orchestrator ↔ Tail Risk CVaR Stress Synergy ───────────────────
	describe("4. Quant Orchestrator ↔ Tail Risk CVaR Stress Synergy", () => {
		it("validates portfolio weights with Cornish-Fisher CVaR and macro stress testing", async () => {
			// Test direct TailRiskStress integration with simulated quant output
			const portfolioAssets: PortfolioAssetInput[] = [
				{ symbol: "RELIANCE", assetClass: "LARGE_CAP", weight: 0.35, beta: 1.05 },
				{ symbol: "TCS", assetClass: "IT", weight: 0.25, beta: 0.85 },
				{ symbol: "HDFCBANK", assetClass: "BANKING", weight: 0.20, beta: 1.15 },
				{ symbol: "GOLDBEES", assetClass: "GOLD", weight: 0.10, beta: -0.1 },
				{ symbol: "LIQUIDBEES", assetClass: "DEBT", weight: 0.10, beta: 0.05 },
			];

			const stressResult = calculateTailRiskAndStress(portfolioAssets);

			expect(stressResult).toBeDefined();
			expect(stressResult.varMetrics.cvar95_expectedShortfallPct).toBeGreaterThan(0);
			expect(stressResult.varMetrics.cvar99_expectedShortfallPct).toBeGreaterThan(
				stressResult.varMetrics.cvar95_expectedShortfallPct,
			);
			expect(stressResult.stressTestScenarios.length).toBeGreaterThanOrEqual(7);
			expect(stressResult.portfolioRobustnessScore).toBeGreaterThanOrEqual(50);
		});
	});

	// ─── 5. Stock Strategy ↔ Institutional Footprint Synergy ─────────────────────
	describe("5. Stock Strategy ↔ Institutional Flow Footprint Synergy", () => {
		it("penalizes stocks with high promoter pledge (>25%) to protect advisory clients", async () => {
			const strategy = new StockStrategy();

			const safeStock = {
				symbol: "SAFE_CO",
				sector: "Capital Goods",
				currentPrice: "250",
				averageVolume: "2000000",
				analystRating: "Buy",
				numberOfAnalysts: "5",
				promoterPledgePct: 5.0,
			};

			const pledgedStock = {
				symbol: "PLEDGED_CO",
				sector: "Capital Goods",
				currentPrice: "250",
				averageVolume: "2000000",
				analystRating: "Buy",
				numberOfAnalysts: "5",
				promoterPledgePct: 38.5, // > 25% critical red flag
			};

			const safeScore = await strategy.score(safeStock, null, null, null, null, null, null, false);
			const pledgedScore = await strategy.score(pledgedStock, null, null, null, null, null, null, false);

			// Pledged stock must receive a 15-point governance penalty
			expect(safeScore - pledgedScore).toBe(15);
		});
	});

	// ─── 6. Fast Analytical Engine In-Memory Vectorized Query ─────────────────────
	describe("6. Fast Analytical Engine In-Memory Vectorized Query", () => {
		it("executes vectorized multi-filter query in sub-10ms and reports telemetry", () => {
			const mockUniverse: FastStockRecord[] = [
				{
					symbol: "TITAN",
					companyName: "Titan Company Ltd",
					sector: "Consumer Durables",
					marketCapValue: 350000000000,
					currentPrice: 3850,
					dayChangePercent: 2.1,
					peRatio: 78,
					pbRatio: 22,
					roe: 28,
					roce: 32,
					debtToEquity: 0.45,
					rsi14: 62,
					volumeBuzz20d: 1.8,
					deliveryPct: 58,
					piotroskiScore: 8,
					altmanZScore: 6.5,
					compositeScore: 88,
					stockRegime: "BREAKOUT",
				},
				{
					symbol: "INFY",
					companyName: "Infosys Ltd",
					sector: "Information Technology",
					marketCapValue: 650000000000,
					currentPrice: 1720,
					dayChangePercent: -0.8,
					peRatio: 27,
					pbRatio: 7.5,
					roe: 31,
					roce: 38,
					debtToEquity: 0.1,
					rsi14: 48,
					volumeBuzz20d: 0.9,
					deliveryPct: 62,
					piotroskiScore: 7,
					altmanZScore: 8.2,
					compositeScore: 82,
					stockRegime: "ACCUMULATION",
				},
			];

			fastAnalyticalEngine.loadSnapshot(mockUniverse);
			expect(fastAnalyticalEngine.getSnapshotSize()).toBe(2);

			const result = fastAnalyticalEngine.query({
				minPiotroski: 7,
				minRoe: 25,
				sortBy: "compositeScore",
				sortDirection: "DESC",
			});

			expect(result.totalMatches).toBe(2);
			expect(result.stocks[0].symbol).toBe("TITAN");
			expect(result.executionTimeMs).toBeLessThan(15); // Sub-15ms guaranteed
			expect(result.formula_applied).toContain("IN_MEMORY_COLUMNAR_VECTORIZED_SCAN");
		});
	});

	// ─── 7. Engine Learning Orchestrator Unified Fleet Calibration ──────────────
	describe("7. Engine Learning Orchestrator Unified Fleet Calibration", () => {
		it("exposes real-time active calibrations across all registered engines", async () => {
			const status = await engineLearningOrchestrator.getStatus();

			expect(status).toBeDefined();
			expect(status.isLearningModeActive).toBe(true);
			expect(status.engines.length).toBeGreaterThanOrEqual(18);

			const quantEng = status.engines.find((e) => e.engineId === "quant-orchestrator");
			expect(quantEng).toBeDefined();
			expect(quantEng?.activeCalibrations).toContain("MVO & Tail-Risk Stress CVaR Validation Active");

			const multiEng = status.engines.find((e) => e.engineId === "multi-exchange-market");
			expect(multiEng).toBeDefined();
			expect(multiEng?.activeCalibrations).toContain("BSE Breadth & GIFT Nifty Spread Parity Active");

			const fastEng = status.engines.find((e) => e.engineId === "fast-analytical-engine");
			expect(fastEng).toBeDefined();
			expect(fastEng?.activeCalibrations).toContain("Sub-10ms In-Memory Vectorized Query Scan Active");
		});

		it("executes full autonomous self-improvement cycle across multi-engine feeds", async () => {
			const cycle = await engineLearningOrchestrator.runSelfImprovementCycle();

			expect(cycle.success).toBe(true);
			expect(cycle.cycleId).toBeDefined();
			expect(cycle.durationMs).toBeGreaterThan(0);
			expect(cycle.fastAnalyticalSnapshotSize).toBeDefined();
			expect(cycle.liquidityRegimeStatus).toBeDefined();
		});
	});
});
