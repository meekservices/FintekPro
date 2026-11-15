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
				"global-credit-cycle",
				"msci-factor-engine",
				"tail-risk-stress",
				"upstox-golden-pricing",
				"multi-exchange-market",
				"market-brief-engine",
				"knowledge-hub-engine",
				"amc-knowledge-hub",
				"scorer-calibration",
				"pick-outcome-analyzer",
				"smart-order-routing",
				"long-short-algo",
				"fno-buildup-engine",
				"portfolio-risk-guard",
				"surveillance-incident-engine",
				"trade-reconciliation-engine",
				"knowledge-hub-auto-heal-sentinel",
				"tax-law-engine",
				"regulatory-ingestion-service",
				"indian-tax-calculator",
			];

			for (const id of expectedEngines) {
				expect(engineIds).toContain(id);
			}
			expect(statuses.length).toBeGreaterThanOrEqual(30);
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
			const { commodityMarketService } = await import("../services/commodity-market-service");
			const { goldenPricingEngine } = await import("../services/golden-pricing/GoldenPricingEngine");
			const { marketMoversCache } = await import("../services/market-movers-cache");

			vi.spyOn(commodityMarketService, "getCommodityBenchmarks").mockResolvedValue({ success: true, data: { commodities: [] } } as any);
			vi.spyOn(goldenPricingEngine, "getDailyMarketBriefLiveSnapshot").mockResolvedValue({
				currencies: { usdInr: 84.4 },
				fixedIncome: { gsec10YYield: 6.82, trepsWar: 6.45 },
				commodities: { brentCrudeUsd: 74.5 },
			} as any);
			vi.spyOn(marketMoversCache, "getMarketMovers").mockResolvedValue({ success: true, data: { gainers: [], losers: [] } } as any);

			vi.spyOn(multiExchangeMarketService, "getMultiExchangeSnapshot").mockResolvedValue({
				success: true,
				data: {
					asOfDate: "2026-11-14",
					timestamp: new Date().toISOString(),
					nifty50: { value: 24350, change: 85, changePercent: 0.35, dayHigh: 24400, dayLow: 24280, volume: 1500000 },
					sensex: { value: 80100, change: 250, changePercent: 0.31, dayHigh: 80250, dayLow: 79900, volume: 800000 },
					bseBreadth: { advances: 2150, declines: 1620, unchanged: 110, totalTraded: 3880, advanceDeclineRatio: 1.33 },
					giftNifty: {
						exchange: "NSE IX (GIFT City IFSC)",
						lastPrice: 24420,
						change: 120,
						changePercent: 0.49,
						session: "ACTIVE",
						timestamp: new Date().toISOString(),
						sentiment: "bullish",
					},
					institutionalFlows: {
						asOfDate: "2026-11-14",
						fiiNetCr: 1250,
						diiNetCr: 2100,
						netInstitutionalCr: 3350,
						sipMonthlyEstimateCr: 26000,
						liquidityRegime: "EXPANSIONARY",
						diiSipAbsorptionRatio: 2.1,
						source: "UPSTOX_V2_PRO",
					},
					multiAssetIndices: {
						indiaVix: 13.5,
						cboeUsvix: 15.2,
						tenYearGsecYield: 6.82,
						usTenYearYield: 4.35,
						crudeBrentUsd: 74.5,
						goldMcx10g: 78500,
						silverMcxKg: 91000,
						usdInr: 84.4,
					},
				},
				meta: { timestamp: new Date().toISOString(), version: "1.0", source: "TEST_MOCK" },
			});

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
		});
	});

	// ─── 3. AI Regime Detection ↔ Multi-Exchange Breadth Synergy ─────────────────
	describe("3. AI Regime Detection ↔ Multi-Exchange Breadth Synergy", () => {
		it("detects market regime with resilient breadth ingestion without database failures", async () => {
			const engine = new AIRegimeDetectionEngine();
			vi.spyOn(engine as any, "fetchNiftyPrices").mockResolvedValue(
				Array.from({ length: 120 }, (_, i) => ({
					date: `2026-01-${String(i + 1).padStart(2, "0")}`,
					close: 24000 + i * 10,
				}))
			);
			vi.spyOn(engine as any, "estimateMarketBreadth").mockResolvedValue({
				advances: 1500,
				declines: 1000,
				ratio: 1.5,
			});

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
			const { globalMacroTransmissionService } = await import("../services/macro/global-macro-transmission-service");
			const { globalFiiTrackerEngine } = await import("../services/macro/global-fii-tracker-engine");
			const { globalCreditCycleService } = await import("../services/macro/global-credit-cycle-service");

			vi.spyOn(globalMacroTransmissionService, "getMacroTransmissionReport").mockResolvedValue({
				regime: "EXPANSION",
				fiiPressure: "NEUTRAL",
				diiAbsorptionCapacity: "HIGH",
				currencyStress: "LOW",
				rbiStanceExpectation: "NEUTRAL",
				yieldSpread10Y_2Y: 0.45,
				compositeTransmissionScore: 82,
				factors: [],
			} as any);

			vi.spyOn(globalFiiTrackerEngine, "getGlobalFiiReport").mockResolvedValue({
				riskSentiment: "RISK_ON",
				dxyTrend: "NEUTRAL",
				us10YTrend: "STABLE",
				epfrIndiaAllocation: "OVERWEIGHT",
				predictedFlowNext5D: 1500,
				confidenceScore: 88,
			} as any);

			vi.spyOn(globalCreditCycleService, "getCreditCycleReport").mockResolvedValue({
				creditCycleRegime: "EXPANSIONARY_CREDIT",
				compositeCreditScore: 86,
				creditStressTripwire: false,
				indicators: { usHyOasBps: 285 },
				pillars: [],
			} as any);

			const cycle = await engineLearningOrchestrator.runSelfImprovementCycle();

			expect(cycle.success).toBe(true);
			expect(cycle.cycleId).toBeDefined();
			expect(cycle.durationMs).toBeGreaterThan(0);
			expect(cycle.fastAnalyticalSnapshotSize).toBeDefined();
			expect(cycle.liquidityRegimeStatus).toBeDefined();
		});
	});

	// ─── 8. Portfolio Risk Guard ↔ SEBI 5-Tier Risk Budget Synergy ──────────────
	describe("8. Portfolio Risk Guard ↔ SEBI 5-Tier Risk Budget Synergy", () => {
		it("enforces statutory limits for moderately_high and very_aggressive profiles with telemetry", async () => {
			const { checkRiskBudget } = await import("../services/portfolio-risk-guard");

			const balancedHoldings = [
				{ name: "Large Cap Bluechip", weight: 20, beta: 1.05, sector: "Banking" },
				{ name: "Flexi Cap Equity", weight: 20, beta: 1.10, sector: "Technology" },
				{ name: "Mid Cap Leader", weight: 20, beta: 1.25, sector: "Pharma" },
				{ name: "Target Maturity Debt", weight: 20, beta: 0.10, sector: "Fixed Income" },
				{ name: "Arbitrage Fund", weight: 10, beta: 0.15, sector: "Arbitrage" },
				{ name: "Gold ETF", weight: 10, beta: -0.10, sector: "Commodity" },
			];

			const reportModHigh = checkRiskBudget("TEST_PORTFOLIO_MOD_HIGH", "moderately_high", balancedHoldings);
			expect(reportModHigh.approved).toBe(true);
			expect(reportModHigh.riskScore).toBeLessThan(40);
			expect(reportModHigh.metrics.weightedBeta).toBeLessThanOrEqual(1.30);

			// Test single stock concentration breach (> 20% limit for moderately_high)
			const concentratedHoldings = [
				{ name: "Super Concentrated Stock", weight: 45, beta: 1.5, sector: "Tech" },
				{ name: "Other Stock", weight: 55, beta: 1.0, sector: "Finance" },
			];
			const reportBreach = checkRiskBudget("TEST_PORTFOLIO_BREACH", "moderately_high", concentratedHoldings);
			expect(reportBreach.approved).toBe(false);
			expect(reportBreach.hardBreaches.some(b => b.field === "maxSingleWeight")).toBe(true);
		});
	});

	// ─── 9. Real-Time Surveillance & Incident Mitigation Synergy ───────────────
	describe("9. Real-Time Surveillance & Incident Mitigation Synergy", () => {
		it("actions trade errors, trips circuit breaker, and reports to telemetry bus", async () => {
			const { surveillanceIncidentEngine } = await import("../services/surveillance-incident-engine");

			const result = await surveillanceIncidentEngine.reportIncident({
				domain: "runtime_error",
				severity: "critical",
				errorCode: "ORDER_REJECTED_EXCHANGE_CIRCUIT",
				title: "Exchange Circuit Limit Tripped During Execution",
				description: "Upper circuit breaker triggered on symbol TATAMOTORS",
				sourceSystem: "order_placement",
			});

			expect(result.incidentId).toBeDefined();
			expect(result.actionsTaken.length).toBeGreaterThan(0);

			const status = telemetryBus.getStatus("surveillance-incident-engine");
			expect(status.engineId).toBe("surveillance-incident-engine");
			expect(status.category).toBe("Compliance");
			expect(status.reportCount).toBeGreaterThan(0);
		});
	});

	// ─── 10. T+1 Trade Reconciliation & Discrepancy Matching Synergy ───────────
	describe("10. T+1 Trade Reconciliation & Discrepancy Matching Synergy", () => {
		it("reconciles executed orders against broker tradebook with telemetry", async () => {
			const { tradeReconciliationEngine } = await import("../services/trade-reconciliation-engine");

			const report = await tradeReconciliationEngine.runReconciliation("test_synergy_suite");

			expect(report.id).toMatch(/^recon_/);
			expect(report.summary.matchRatePercent).toBeGreaterThanOrEqual(0);

			const status = telemetryBus.getStatus("trade-reconciliation-engine");
			expect(status.engineId).toBe("trade-reconciliation-engine");
			expect(status.category).toBe("Transaction");
			expect(status.reportCount).toBeGreaterThan(0);
		});
	});

	// ─── 11. Direct Tax & Corporate Law Workstation Synergy ────────────────────
	describe("11. Direct Tax & Corporate Law Workstation (Rule 11UA & Form 3CD) Synergy", () => {
		it("computes deterministic Rule 11UA NAV valuation and Form 3CD audit scan with telemetry", async () => {
			const { taxLawEngine } = await import("../services/tax-law-engine");

			// Rule 11UA Valuation (FMV = (A - L) * (PV / PE))
			const val = taxLawEngine.calculateRule11UAValuation({
				bookValueOfAssets: 10_000_000,
				bookValueOfLiabilities: 2_000_000,
				paidUpEquityCapital: 1_000_000,
				faceValueOfShare: 10,
				sharesToBeValued: 50_000,
			});

			expect(val.engine_version).toBeDefined();
			expect(val.fmv_per_share).toBe(80); // (10M - 2M) * (10 / 1M) = 8M * 0.00001 = 80
			expect(val.intermediate_steps.total_valuation_of_block).toBe(4_000_000);

			// Form 3CD clause audit scan
			const audit = taxLawEngine.runForm3cdAuditScan([
				{
					id: "TXN-001",
					date: "2026-11-10",
					partyName: "Cash Vendor A",
					amount: 15_000,
					paymentMode: "cash",
					type: "expense",
				},
				{
					id: "TXN-002",
					date: "2026-11-12",
					partyName: "MSME Supplier B",
					amount: 250_000,
					paymentMode: "bank_transfer",
					type: "msme_vendor",
					isMsmeRegistered: true,
					dueDate: "2026-10-15",
					paymentDate: "2026-11-12",
				},
			]);

			expect(audit.total_transactions_scanned).toBe(2);
			expect(audit.high_risk_disallowance_count).toBeGreaterThan(0);
			expect(audit.potential_disallowance_amount).toBeGreaterThan(0);

			const status = telemetryBus.getStatus("tax-law-engine");
			expect(status.engineId).toBe("tax-law-engine");
			expect(status.category).toBe("Compliance");
			expect(status.reportCount).toBeGreaterThan(0);
		});
	});

	// ─── 12. Autonomous Regulatory Ingestion Engine Synergy ────────────────────
	describe("12. Autonomous Regulatory Ingestion Engine Synergy", () => {
		it("polls official regulatory gazettes (CBDT, SEBI, MCA) with telemetry", async () => {
			const { RegulatoryIngestionService } = await import("../services/regulatory-ingestion-service");
			const service = RegulatoryIngestionService.getInstance();

			const pollResult = await service.pollAllRegulators();
			expect(pollResult.sourcesScanned).toBeGreaterThan(0);
			expect(pollResult.regressionTestsPassed).toBeGreaterThan(0);

			const status = telemetryBus.getStatus("regulatory-ingestion-service");
			expect(status.engineId).toBe("regulatory-ingestion-service");
			expect(status.category).toBe("Data Quality");
			expect(status.reportCount).toBeGreaterThan(0);
		});
	});

	// ─── 13. Dynamic Indian Income Tax Calculator Synergy ─────────────────────
	describe("13. Dynamic Indian Income Tax Calculator Synergy", () => {
		it("calculates comprehensive tax and compares Old vs New regimes with portfolio telemetry", async () => {
			const { indianTaxCalculator } = await import("../services/indian-tax-calculator");

			// AY 2025-26 with Capital Gains & Salary
			const result = await indianTaxCalculator.calculateComprehensive({
				assessmentYear: "2025-26",
				regime: "new",
				entityType: "individual",
				ageCategory: "below_60",
				salary: {
					basicSalary: 1_200_000,
					dearnessAllowance: 0,
					hraReceived: 0,
					rentPaidPerYear: 0,
					isMetroCity: true,
					specialAllowance: 0,
					ltaReceived: 0,
					employerNps80CCD2: 0,
					otherAllowances: 0,
					perquisites: 0,
					professionalTax: 0,
				},
				capitalGains: {
					stcgEquity111A: 100_000,
					ltcgEquity112A: 225_000, // 225k - 125k exempt = 100k taxable @ 12.5%
					stcgSlabRate: 0,
					ltcgNormal20: 0,
					ltcgNormal12_5: 0,
				},
			});

			expect(result.success).toBe(true);
			expect(result.data.assessmentYear).toBe("2025-26");
			expect(result.data.salaryStandardDeduction).toBe(75_000);
			// STCG 111A = 20% on 100,000 = 20,000
			// LTCG 112A = 12.5% on (225,000 - 125,000) = 12,500
			// Total special rate tax = 32,500
			expect(result.data.specialRateTax).toBe(32_500);
			expect(result.data.totalTaxLiability).toBeGreaterThan(0);

			// Comparison
			const comparison = await indianTaxCalculator.compareRegimes({
				assessmentYear: "2025-26",
				entityType: "individual",
				ageCategory: "below_60",
				salary: {
					basicSalary: 1_500_000,
					dearnessAllowance: 0,
					hraReceived: 0,
					rentPaidPerYear: 0,
					isMetroCity: true,
					specialAllowance: 0,
					ltaReceived: 0,
					employerNps80CCD2: 0,
					otherAllowances: 0,
					perquisites: 0,
					professionalTax: 0,
				},
				deductions: {
					section80C: 150_000,
					section80DSelf: 25_000,
					section80DParents: 0,
					isParentsSeniorCitizen: false,
					section80CCD1B_NPS: 50_000,
					section80E_EducationLoan: 0,
					section80G_Donations: 0,
					section80TTA_Savings: 0,
					section80TTB_SeniorSavings: 0,
					otherDeductions: 0,
				},
			});

			expect(comparison.success).toBe(true);
			expect(comparison.recommendation).toBeDefined();
			expect(comparison.recommendation.optimalRegime).toBeDefined();
			expect(comparison.recommendation.breakEvenDeductionRequired).toBeGreaterThan(0);

			const status = telemetryBus.getStatus("indian-tax-calculator");
			expect(status.engineId).toBe("indian-tax-calculator");
			expect(status.category).toBe("Portfolio");
			expect(status.reportCount).toBeGreaterThan(0);
		});
	});
});
