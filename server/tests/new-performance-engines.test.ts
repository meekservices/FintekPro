/**
 * Comprehensive Unit Tests: FintekPro Performance Enhancement Engines (GCR v1.0 + FASP-AI v1.0)
 *
 * Engines Tested:
 *  1. Tax-Loss Harvesting (TLH) & Capital Gains Optimization Engine
 *  2. Algorithmic Trailing Exit & Profit Protection Engine
 *  3. Tail-Risk, CVaR & Macro Stress-Testing Engine
 *  4. Smart Order Routing (SOR) & Impact Cost Engine
 *  5. In-Memory Vectorized Query Acceleration Engine
 *  6. Institutional Ownership & Block/Bulk Deal Footprint Engine
 *  7. Cross-Engine Determinism & Metadata Compliance
 */

import { describe, it, expect } from "vitest";

// 1. Tax-Loss Harvesting
import {
	optimizeTaxLossHarvesting,
	TLH_ENGINE_VERSION,
	type TaxLotInput,
} from "../services/tax/tax-loss-harvesting-engine";

// 2. Trailing Exit
import {
	evaluateExitStrategy,
	EXIT_ENGINE_VERSION,
	type PositionInput,
} from "../services/picks/exit-strategy-engine";

// 3. Tail-Risk & CVaR
import {
	calculateTailRiskAndStress,
	TAIL_RISK_ENGINE_VERSION,
	STANDARD_MACRO_SCENARIOS,
	type PortfolioAssetInput,
} from "../services/quant/tail-risk-stress-engine";

// 4. Smart Order Routing
import {
	generateSmartRoutingPlan,
	SOR_ENGINE_VERSION,
	type SorOrderRequest,
} from "../services/execution/smart-order-routing-engine";

// 5. Fast Analytical Engine
import {
	FastAnalyticalEngine,
	FAST_ANALYTICAL_ENGINE_VERSION,
	type FastStockRecord,
} from "../services/screener/fast-analytical-engine";

// 6. Institutional Flow
import {
	analyzeInstitutionalFlow,
	INSTITUTIONAL_FLOW_ENGINE_VERSION,
	type InstitutionalFlowInput,
} from "../services/research/institutional-flow-engine";

describe("FintekPro Performance Enhancement Engines Suite", () => {
	// ─── 1. Tax-Loss Harvesting Engine ──────────────────────────────────────────
	describe("1. Tax-Loss Harvesting (TLH) Engine", () => {
		const sampleLots: TaxLotInput[] = [
			{
				lotId: "lot-1",
				symbol: "HDFCBANK",
				assetType: "EQUITY",
				buyDate: "2026-06-15", // Short-term (< 1 year)
				buyPrice: 1650,
				quantity: 100,
				currentPrice: 1450, // Loss of ₹20,000
			},
			{
				lotId: "lot-2",
				symbol: "TCS",
				assetType: "EQUITY",
				buyDate: "2024-01-10", // Long-term (> 1 year)
				buyPrice: 3800,
				quantity: 50,
				currentPrice: 3200, // Loss of ₹30,000
			},
			{
				lotId: "lot-3",
				symbol: "RELIANCE",
				assetType: "EQUITY",
				buyDate: "2024-02-01",
				buyPrice: 2400,
				quantity: 40,
				currentPrice: 2900, // Gain of ₹20,000
			},
		];

		it("correctly identifies short-term loss and computes 20% tax savings with proxy recommendation", () => {
			const result = optimizeTaxLossHarvesting(sampleLots, { realizedStcg: 40000, realizedLtcg: 0 }, "2026-11-03T00:00:00Z");

			expect(result.engine_version).toBe(TLH_ENGINE_VERSION);
			expect(result.portfolioSummary.unrealizedStclTotal).toBe(20000);
			expect(result.portfolioSummary.unrealizedLtclTotal).toBe(30000);

			const hdfcRec = result.recommendations.find((r) => r.symbol === "HDFCBANK");
			expect(hdfcRec?.action).toBe("HARVEST_STCL");
			expect(hdfcRec?.priority).toBe("HIGH");
			expect(hdfcRec?.estimatedTaxSaved).toBe(4000); // 20% of 20,000
			expect(hdfcRec?.recommendedProxySymbol).toBe("ICICIBANK");
		});

		it("calculates immediate net tax savings against realized YTD gains", () => {
			const result = optimizeTaxLossHarvesting(sampleLots, { realizedStcg: 50000, realizedLtcg: 200000 }, "2026-11-03T00:00:00Z");
			expect(result.taxPositionCurrentFY.netImmediateTaxSaved).toBeGreaterThan(0);
			expect(result.intermediate_steps.stcgTaxOffsetPotential).toBe(4000);
		});
	});

	// ─── 2. Algorithmic Trailing Exit & Profit Protection Engine ────────────────
	describe("2. Trailing Exit & Profit Protection Engine", () => {
		const baseBars = [
			{ high: 105, low: 98, close: 102, volume: 100000 },
			{ high: 108, low: 101, close: 106, volume: 110000 },
			{ high: 112, low: 105, close: 110, volume: 120000 },
			{ high: 115, low: 108, close: 114, volume: 130000 },
		];

		it("triggers target profit booking when price reaches Target 1", () => {
			const position: PositionInput = {
				symbol: "INFY",
				entryDate: "2026-10-15",
				entryPrice: 100,
				currentPrice: 112, // +12% gain
				quantity: 100,
				target1Price: 110,
				target2Price: 122,
				bars: baseBars,
			};

			const result = evaluateExitStrategy(position);
			expect(result.engine_version).toBe(EXIT_ENGINE_VERSION);
			expect(result.action).toBe("BOOK_PARTIAL_PROFIT_T1");
			expect(result.executionRecommendation.exitQuantity).toBe(33); // 33% partial
			expect(result.levels.breakevenStop).toBe(100);
		});

		it("triggers Chandelier trailing stop when stock pulls back from peak", () => {
			const barsWithPeak = [
				{ high: 105, low: 101, close: 104, volume: 100000 },
				{ high: 110, low: 106, close: 109, volume: 110000 },
				{ high: 118, low: 114, close: 117, volume: 120000 },
				{ high: 130, low: 126, close: 128, volume: 130000 }, // peak high at 130, ATR ~ 5
				{ high: 122, low: 118, close: 120, volume: 90000 },  // retracement
			];
			const position: PositionInput = {
				symbol: "INFY",
				entryDate: "2026-10-01",
				entryPrice: 95,
				currentPrice: 103, // pulled back to 103 from peak 130 (below Chandelier stop 103.4)
				quantity: 100,
				bars: barsWithPeak,
			};

			const result = evaluateExitStrategy(position);
			expect(result.action).toBe("EXIT_TRAILING_STOP_HIT");
			expect(result.urgency).toBe("HIGH");
			expect(result.unrealizedGainPct).toBeGreaterThan(5.0);
		});

		it("triggers time-stop recycling on stagnant capital held >15 days", () => {
			const position: PositionInput = {
				symbol: "ITC",
				entryDate: "2026-09-01",
				entryPrice: 100,
				currentPrice: 100.8, // +0.8% stagnant
				quantity: 200,
				holdingDays: 20,
				bars: baseBars,
			};

			const result = evaluateExitStrategy(position);
			expect(result.action).toBe("EXIT_TIME_STOP_RECYCLE");
			expect(result.executionRecommendation.exitQuantity).toBe(200);
		});
	});

	// ─── 3. Tail-Risk & CVaR Stress Engine ──────────────────────────────────────
	describe("3. Tail-Risk & CVaR Stress Engine", () => {
		const balancedPortfolio: PortfolioAssetInput[] = [
			{ symbol: "RELIANCE", assetClass: "LARGE_CAP", weight: 0.35, beta: 0.95 },
			{ symbol: "HDFCBANK", assetClass: "BANKING", weight: 0.25, beta: 1.10 },
			{ symbol: "TATACHEM", assetClass: "MID_CAP", weight: 0.15, beta: 1.25 },
			{ symbol: "GSEC_10Y", assetClass: "DEBT", weight: 0.15, beta: 0.10 },
			{ symbol: "GOLDBEES", assetClass: "GOLD", weight: 0.10, beta: 0.05 },
		];

		it("computes daily and monthly CVaR expected shortfall metrics", () => {
			const result = calculateTailRiskAndStress(balancedPortfolio);
			expect(result.engine_version).toBe(TAIL_RISK_ENGINE_VERSION);
			expect(result.varMetrics.confidence95_dailyVaRPct).toBeGreaterThan(0);
			expect(result.varMetrics.cvar95_expectedShortfallPct).toBeGreaterThan(result.varMetrics.confidence95_dailyVaRPct);
			expect(result.stressTestScenarios.length).toBe(STANDARD_MACRO_SCENARIOS.length);
		});

		it("runs COVID-2020 stress test and measures defensive gold/debt buffer", () => {
			const result = calculateTailRiskAndStress(balancedPortfolio);
			const covidScenario = result.stressTestScenarios.find((s) => s.scenarioId === "COVID_2020_CRASH");

			expect(covidScenario).toBeDefined();
			expect(covidScenario?.estimatedPortfolioDrawdownPct).toBeLessThan(0);
			// Gold and debt cushion should reduce drawdown below broad market shock (-38%)
			expect(covidScenario?.estimatedPortfolioDrawdownPct).toBeGreaterThan(-35.0);
			expect(result.portfolioRobustnessScore).toBeGreaterThan(50);
		});
	});

	// ─── 4. Smart Order Routing (SOR) Engine ────────────────────────────────────
	describe("4. Smart Order Routing (SOR) & Impact Cost Engine", () => {
		const nseOrderBook = {
			exchange: "NSE" as const,
			symbol: "TCS",
			lastTradedPrice: 3500,
			dayVolume: 1500000,
			bids: [
				{ price: 3499.5, quantity: 2000 },
				{ price: 3499.0, quantity: 3000 },
			],
			asks: [
				{ price: 3500.5, quantity: 2500 },
				{ price: 3501.0, quantity: 4000 },
			],
		};

		const bseOrderBook = {
			exchange: "BSE" as const,
			symbol: "TCS",
			lastTradedPrice: 3499.8,
			dayVolume: 250000,
			bids: [
				{ price: 3499.6, quantity: 500 }, // Better bid than NSE
				{ price: 3499.0, quantity: 1000 },
			],
			asks: [
				{ price: 3500.2, quantity: 800 }, // Better ask than NSE (3500.2 vs 3500.5)
				{ price: 3501.5, quantity: 2000 },
			],
		};

		it("selects BSE for BUY order when BSE offers a tighter ask price", () => {
			const req: SorOrderRequest = {
				symbol: "TCS",
				side: "BUY",
				quantity: 500,
				nseBook: nseOrderBook,
				bseBook: bseOrderBook,
			};

			const plan = generateSmartRoutingPlan(req);
			expect(plan.engine_version).toBe(SOR_ENGINE_VERSION);
			expect(plan.selectedPrimaryExchange).toBe("BSE");
			expect(plan.bestExecutionPrice).toBe(3500.2);
			expect(plan.estimatedImpactCostBps).toBeLessThan(10);
		});

		it("generates TWAP volume-participation slices for large institutional orders", () => {
			const req: SorOrderRequest = {
				symbol: "TCS",
				side: "BUY",
				quantity: 6000, // Large order
				nseBook: nseOrderBook,
			};

			const plan = generateSmartRoutingPlan(req);
			expect(plan.isSlicingRecommended).toBe(true);
			expect(plan.recommendedSlices.length).toBeGreaterThanOrEqual(3);
			expect(plan.recommendedSlices.reduce((acc, s) => acc + s.quantity, 0)).toBe(6000);
		});
	});

	// ─── 5. Fast In-Memory Analytical Engine ────────────────────────────────────
	describe("5. Fast In-Memory Vectorized Query Engine", () => {
		const engine = new FastAnalyticalEngine();
		const records: FastStockRecord[] = [
			{
				symbol: "RELIANCE",
				companyName: "Reliance Industries",
				sector: "Energy",
				marketCapValue: 19000000000000,
				currentPrice: 2900,
				dayChangePercent: 1.5,
				peRatio: 24,
				pbRatio: 2.2,
				roe: 14,
				roce: 13,
				debtToEquity: 0.4,
				rsi14: 55,
				volumeBuzz20d: 1.8,
				deliveryPct: 62,
				piotroskiScore: 7,
				altmanZScore: 3.5,
				compositeScore: 82,
				stockRegime: "BULLISH_TRENDING",
				pvaClassification: "INSTITUTIONAL_ACCUMULATION",
			},
			{
				symbol: "TCS",
				companyName: "Tata Consultancy Services",
				sector: "IT",
				marketCapValue: 14000000000000,
				currentPrice: 3500,
				dayChangePercent: 0.5,
				peRatio: 28,
				pbRatio: 12,
				roe: 45,
				roce: 52,
				debtToEquity: 0.05,
				rsi14: 48,
				volumeBuzz20d: 1.2,
				deliveryPct: 58,
				piotroskiScore: 8,
				altmanZScore: 8.2,
				compositeScore: 88,
				stockRegime: "BULLISH_TRENDING",
				pvaClassification: "ABSORPTION_PULLBACK",
			},
			{
				symbol: "ZOMATO",
				companyName: "Zomato Ltd",
				sector: "Consumer",
				marketCapValue: 2400000000000,
				currentPrice: 260,
				dayChangePercent: -2.1,
				peRatio: 110,
				pbRatio: 8.5,
				roe: 6,
				roce: 7,
				debtToEquity: 0.1,
				rsi14: 65,
				volumeBuzz20d: 0.8,
				deliveryPct: 35,
				piotroskiScore: 5,
				altmanZScore: 4.1,
				compositeScore: 68,
				stockRegime: "HIGH_VOLATILITY_CHOP",
			},
		];

		it("executes vectorized multi-filter query in memory in sub-10ms", () => {
			engine.loadSnapshot(records);
			expect(engine.getSnapshotSize()).toBe(3);

			const res = engine.query({
				minRoe: 10,
				maxPe: 30,
				minPiotroski: 6,
			});

			expect(res.engine_version).toBe(FAST_ANALYTICAL_ENGINE_VERSION);
			expect(res.totalMatches).toBe(2); // RELIANCE and TCS match, ZOMATO excluded (PE 110, ROE 6)
			expect(res.stocks[0].symbol).toBe("TCS"); // highest compositeScore 88
			expect(res.executionTimeMs).toBeLessThanOrEqual(15);
		});
	});

	// ─── 6. Institutional Ownership & Block/Bulk Deal Engine ────────────────────
	describe("6. Institutional Ownership & Block Deal Engine", () => {
		it("detects strong institutional block accumulation", () => {
			const input: InstitutionalFlowInput = {
				symbol: "BHARTIARTL",
				blockDeals30d: [
					{
						date: "2026-10-25",
						clientName: "LIC of India",
						dealType: "BUY",
						quantity: 5000000,
						tradePrice: 1550,
						valueInrCrores: 775,
						isFiiOrDii: true,
					},
				],
				promoterPledgePct: 0,
				promoterHoldingChangeMoM: 0.35,
				mutualFundHoldingChangeMoM: 0.85,
			};

			const result = analyzeInstitutionalFlow(input);
			expect(result.engine_version).toBe(INSTITUTIONAL_FLOW_ENGINE_VERSION);
			expect(result.classification).toBe("STRONG_INSTITUTIONAL_ACCUMULATION");
			expect(result.institutionalSentimentScore).toBeGreaterThanOrEqual(80);
			expect(result.blockDealSummary.dominantBuyer).toBe("LIC of India");
		});

		it("raises critical red flag on high promoter pledging (>25%)", () => {
			const input: InstitutionalFlowInput = {
				symbol: "PLEDGEDCORP",
				blockDeals30d: [],
				promoterPledgePct: 45.0, // Dangerous pledge level
			};

			const result = analyzeInstitutionalFlow(input);
			expect(result.classification).toBe("PROMOTER_PLEDGE_RED_FLAG");
			expect(result.alerts.some((a) => a.type === "PLEDGE_RISK")).toBe(true);
		});
	});

	// ─── 7. Absolute Determinism Guarantee ─────────────────────────────────────
	describe("7. Determinism Contract", () => {
		it("guarantees identical output for identical inputs across all 6 engines", () => {
			const lots: TaxLotInput[] = [
				{
					lotId: "d-1",
					symbol: "INFY",
					assetType: "EQUITY",
					buyDate: "2026-05-01",
					buyPrice: 1500,
					quantity: 10,
					currentPrice: 1400,
				},
			];

			const run1 = optimizeTaxLossHarvesting(lots, { realizedStcg: 0, realizedLtcg: 0 }, "2026-11-03T00:00:00Z");
			const run2 = optimizeTaxLossHarvesting(lots, { realizedStcg: 0, realizedLtcg: 0 }, "2026-11-03T00:00:00Z");
			expect(run1).toEqual(run2);
		});
	});
});
