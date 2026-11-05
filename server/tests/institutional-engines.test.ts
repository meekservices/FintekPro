import { describe, it, expect } from "vitest";
import {
	generateSmartRoutingPlan,
	alignToTick,
	SOR_ENGINE_VERSION,
	type SorOrderRequest,
} from "../services/execution/smart-order-routing-engine";
import {
	classifyFnoBuildup,
	classifyPcrSentiment,
	FNO_ENGINE_VERSION,
} from "../services/derivatives/fno-buildup-engine";
import {
	calculateTailRiskAndStress,
	STANDARD_MACRO_SCENARIOS,
	TAIL_RISK_ENGINE_VERSION,
} from "../services/quant/tail-risk-stress-engine";
import {
	optimizeTaxLossHarvesting,
	INDIAN_TAX_RATES_2024,
	TLH_ENGINE_VERSION,
	type TaxLotInput,
} from "../services/tax/tax-loss-harvesting-engine";

describe("FintekPro Institutional Engines Suite (GCR v1.0 + FASP-AI v3.0)", () => {
	// ── 1. Smart Order Routing (SOR) Engine ─────────────────────────────────
	describe("1. Smart Order Routing & SEBI Impact Cost Engine", () => {
		const mockNseBook = {
			exchange: "NSE" as const,
			symbol: "RELIANCE",
			lastTradedPrice: 2500,
			dayVolume: 1000000,
			bids: [
				{ price: 2499.5, quantity: 500 },
				{ price: 2499.0, quantity: 1000 },
			],
			asks: [
				{ price: 2500.5, quantity: 400 },
				{ price: 2501.0, quantity: 800 },
			],
		};

		const mockBseBookBetterAsk = {
			exchange: "BSE" as const,
			symbol: "RELIANCE",
			lastTradedPrice: 2498,
			dayVolume: 200000,
			bids: [
				{ price: 2498.0, quantity: 300 },
			],
			asks: [
				{ price: 2499.0, quantity: 400 }, // Cheaper than NSE 2500.50
				{ price: 2500.0, quantity: 600 },
			],
		};

		it("selects BSE when BSE offers a cheaper ask for a BUY order", () => {
			const req: SorOrderRequest = {
				symbol: "RELIANCE",
				side: "BUY",
				quantity: 200,
				nseBook: mockNseBook,
				bseBook: mockBseBookBetterAsk,
			};

			const plan = generateSmartRoutingPlan(req);

			expect(plan.engine_version).toBe(SOR_ENGINE_VERSION);
			expect(plan.selectedPrimaryExchange).toBe("BSE");
			expect(plan.brokerRouting.recommendedBroker).toBe("DHAN"); // Prefers Dhan for BSE routing
			expect(plan.recommendedSlices[0].targetExchange).toBe("BSE");
			// Limit price must use BSE ask (2499.00), not NSE ask (2500.50)
			expect(plan.recommendedSlices[0].estimatedLimitPrice).toBe(2499.0);
		});

		it("enforces Indian exchange tick size (0.05 multiples) for limit prices", () => {
			expect(alignToTick(102.341)).toBe(102.35);
			expect(alignToTick(102.324)).toBe(102.30);
			expect(alignToTick(2499.03)).toBe(2499.05);
			expect(alignToTick(0)).toBe(0.05);

			// Test slicing generates valid tick-aligned limit prices
			const largeReq: SorOrderRequest = {
				symbol: "RELIANCE",
				side: "BUY",
				quantity: 6000,
				nseBook: mockNseBook,
			};

			const plan = generateSmartRoutingPlan(largeReq);
			expect(plan.isSlicingRecommended).toBe(true);
			expect(plan.recommendedSlices.length).toBeGreaterThan(1);

			for (const slice of plan.recommendedSlices) {
				const remainder = Math.round(slice.estimatedLimitPrice * 100) % 5;
				expect(remainder).toBe(0); // Multiple of 5 paise (0.05)
			}
		});

		it("computes SEBI impact cost in basis points and explains intermediate steps", () => {
			const req: SorOrderRequest = {
				symbol: "RELIANCE",
				side: "BUY",
				quantity: 100,
				nseBook: mockNseBook,
			};

			const plan = generateSmartRoutingPlan(req);

			expect(plan.estimatedImpactCostBps).toBeGreaterThanOrEqual(0);
			expect(plan.formula_applied).toContain("SEBI_IMPACT_COST");
			expect(plan.intermediate_steps.fillWeightedAveragePrice).toBeGreaterThan(0);
			expect(plan.intermediate_steps.liquidityDepthAvailable).toBeGreaterThan(0);
		});
	});

	// ── 2. F&O Buildup & Sentiment Engine ───────────────────────────────────
	describe("2. F&O Buildup & Sentiment Engine", () => {
		it("correctly classifies all 4 quadrants of institutional F&O buildup", () => {
			// Long Buildup: Price UP, OI UP
			const lb = classifyFnoBuildup(1.2, 5.0);
			expect(lb.buildup).toBe("LONG_BUILDUP");
			expect(lb.interpretation).toContain("Fresh institutional accumulation");

			// Short Buildup: Price DOWN, OI UP
			const sb = classifyFnoBuildup(-1.5, 4.2);
			expect(sb.buildup).toBe("SHORT_BUILDUP");
			expect(sb.interpretation).toContain("institutional short creation");

			// Short Covering: Price UP, OI DOWN
			const sc = classifyFnoBuildup(1.8, -3.5);
			expect(sc.buildup).toBe("SHORT_COVERING");
			expect(sc.interpretation).toContain("short positions");

			// Long Unwinding: Price DOWN, OI DOWN
			const lu = classifyFnoBuildup(-2.0, -4.0);
			expect(lu.buildup).toBe("LONG_UNWINDING");
			expect(lu.interpretation).toContain("exhaustion of upward momentum");

			// Neutral: small movements
			const neutral = classifyFnoBuildup(0.1, 0.5);
			expect(neutral.buildup).toBe("NEUTRAL");
		});

		it("correctly classifies Put-Call Ratio (PCR) sentiment zones", () => {
			expect(classifyPcrSentiment(1.45)).toBe("EXTREMELY_BULLISH");
			expect(classifyPcrSentiment(1.15)).toBe("BULLISH");
			expect(classifyPcrSentiment(0.95)).toBe("NEUTRAL");
			expect(classifyPcrSentiment(0.70)).toBe("BEARISH");
			expect(classifyPcrSentiment(0.45)).toBe("EXTREMELY_BEARISH");
		});

		it("exposes current engine version 2.2.0", () => {
			expect(FNO_ENGINE_VERSION).toBe("2.2.0");
		});
	});

	// ── 3. Tail Risk & Macro Stress Testing Engine ───────────────────────────
	describe("3. Tail Risk & Stress Testing Engine", () => {
		const samplePortfolio = [
			{ symbol: "HDFCBANK", assetClass: "BANKING" as const, weight: 0.3, beta: 1.1 },
			{ symbol: "INFY", assetClass: "IT" as const, weight: 0.25, beta: 0.95 },
			{ symbol: "TCS", assetClass: "LARGE_CAP" as const, weight: 0.25, beta: 0.9 },
			{ symbol: "GSEC10Y", assetClass: "DEBT" as const, weight: 0.1, beta: 0.1 },
			{ symbol: "GOLDBEES", assetClass: "GOLD" as const, weight: 0.1, beta: 0.05 },
		];

		it("computes Parametric VaR and Cornish-Fisher fat-tailed CVaR", () => {
			const res = calculateTailRiskAndStress(samplePortfolio);

			expect(res.engine_version).toBe(TAIL_RISK_ENGINE_VERSION);
			expect(res.varMetrics.confidence95_dailyVaRPct).toBeGreaterThan(0);
			expect(res.varMetrics.confidence99_dailyVaRPct).toBeGreaterThan(res.varMetrics.confidence95_dailyVaRPct);
			// CVaR (Expected Shortfall) must exceed VaR due to fat tail expansion
			expect(res.varMetrics.cvar95_expectedShortfallPct).toBeGreaterThan(res.varMetrics.confidence95_dailyVaRPct);
			expect(res.varMetrics.cvar99_expectedShortfallPct).toBeGreaterThan(res.varMetrics.confidence99_dailyVaRPct);
		});

		it("runs all 4 standard historical macro crash scenarios", () => {
			const res = calculateTailRiskAndStress(samplePortfolio);

			expect(res.stressTestScenarios.length).toBe(STANDARD_MACRO_SCENARIOS.length);
			expect(res.stressTestScenarios.map((s) => s.scenarioId)).toEqual([
				"COVID_2020_CRASH",
				"GFC_2008_LIQUIDITY_FREEZE",
				"RATES_INFLATION_2022",
				"OIL_SPIKE_120",
			]);

			// Gold and Debt should act as hedging assets during COVID 2020 crash
			const covid = res.stressTestScenarios.find((s) => s.scenarioId === "COVID_2020_CRASH");
			expect(covid).toBeDefined();
			expect(covid?.hedgingAssets.length).toBeGreaterThan(0);
			expect(covid?.estimatedLossPer10LakhsInr).toBeGreaterThan(0);
		});
	});

	// ── 4. Tax-Loss Harvesting & Capital Gains Engine ────────────────────────
	describe("4. Tax-Loss Harvesting & Capital Gains Engine", () => {
		it("conforms to Indian Budget 2024 capital gains tax rates", () => {
			expect(INDIAN_TAX_RATES_2024.stcgRate).toBe(0.20); // 20% STCG
			expect(INDIAN_TAX_RATES_2024.ltcgRate).toBe(0.125); // 12.5% LTCG
			expect(INDIAN_TAX_RATES_2024.ltcgExemptionLimit).toBe(125000); // ₹1.25 Lakhs
		});

		it("identifies short-term losses and recommends harvesting with proxy replacement", () => {
			const taxLots: TaxLotInput[] = [
				{
					lotId: "LOT-1",
					symbol: "HDFCBANK",
					assetType: "EQUITY",
					buyDate: "2026-08-01", // ~3 months ago: STCL
					buyPrice: 1750,
					quantity: 100,
					currentPrice: 1550, // Unrealized loss = -₹20,000
				},
				{
					lotId: "LOT-2",
					symbol: "INFY",
					assetType: "EQUITY",
					buyDate: "2024-01-10", // > 12 months: LTCG
					buyPrice: 1400,
					quantity: 50,
					currentPrice: 1800, // Unrealized gain = +₹20,000
				},
			];

			const res = optimizeTaxLossHarvesting(taxLots, { realizedStcg: 25000, realizedLtcg: 0 }, "2026-11-05");

			expect(res.engine_version).toBe(TLH_ENGINE_VERSION);
			expect(res.portfolioSummary.unrealizedStclTotal).toBe(20000);

			const hdfcReco = res.recommendations.find((r) => r.symbol === "HDFCBANK");
			expect(hdfcReco).toBeDefined();
			expect(hdfcReco?.action).toBe("HARVEST_STCL");
			expect(hdfcReco?.recommendedProxySymbol).toBe("ICICIBANK"); // From proxy map
			expect(hdfcReco?.estimatedTaxSaved).toBe(4000); // 20% of ₹20,000 = ₹4,000
		});
	});
});

