/**
 * Unit Tests: Native Screener Enrichment Engine (GCR v1.0 + FASP-AI v1.0)
 *
 * Tests cover:
 *  1. DCF Model with Free Cash Flow (FCF)
 *  2. DCF Model with Operating Cash Flow (OCF fallback)
 *  3. DCF Model with normalized EPS fallback
 *  4. DCF bounds and sanity checks
 *  5. Forward P/E calculation and bounding
 *  6. Forward P/E edge cases (loss-making, zero, extreme values)
 *  7. Multi-factor Quantitative Analyst Consensus baseline
 *  8. Determinism: Same inputs ALWAYS yield identical outputs
 */

import { describe, it, expect } from "vitest";
import {
	calculateMathematicalDCF,
	calculateForwardPe,
	calculateAnalystConsensus,
	type StockFundamentalInputs,
} from "../services/screener/screener-enrichment-engine";

describe("Screener Enrichment Engine — Mathematical DCF", () => {
	const relianceLikeStock: StockFundamentalInputs = {
		symbol: "RELIANCE",
		companyName: "Reliance Industries Ltd",
		currentPrice: 2850,
		marketCap: 19200000000000,
		peRatio: 26.5,
		roe: 0.14,
		freeCashFlow: 350000000000,
		earningsGrowth: 0.12,
		sharesCount: 6736000000,
		totalDebt: 3100000000000,
	};

	it("computes reasonable DCF intrinsic value from FCF", () => {
		const dcf = calculateMathematicalDCF(relianceLikeStock);
		expect(dcf.dcfIntrinsicValue).toBeGreaterThan(1000);
		expect(dcf.dcfIntrinsicValue).toBeLessThan(6000);
		expect(dcf.source).toBe("fcf");
		expect(dcf.discountRate).toBe(0.12);
		expect(dcf.terminalGrowthRate).toBe(0.05);
	});

	it("falls back to OCF when FCF is absent", () => {
		const stockWithoutFcf: StockFundamentalInputs = {
			...relianceLikeStock,
			freeCashFlow: undefined,
			operatingCashFlow: 500000000000,
		};
		const dcf = calculateMathematicalDCF(stockWithoutFcf);
		expect(dcf.source).toBe("ocf");
		expect(dcf.dcfIntrinsicValue).toBeGreaterThan(0);
	});

	it("falls back to normalized EPS when cash flows are absent", () => {
		const stockWithoutCF: StockFundamentalInputs = {
			...relianceLikeStock,
			freeCashFlow: undefined,
			operatingCashFlow: undefined,
			eps: 110,
		};
		const dcf = calculateMathematicalDCF(stockWithoutCF);
		expect(dcf.source).toBe("earnings_normalized");
		expect(dcf.dcfIntrinsicValue).toBeGreaterThan(0);
	});

	it("is strictly deterministic (same input → same output)", () => {
		const run1 = calculateMathematicalDCF(relianceLikeStock);
		const run2 = calculateMathematicalDCF(relianceLikeStock);
		expect(run1).toEqual(run2);
	});
});

describe("Screener Enrichment Engine — Forward P/E", () => {
	it("computes forward P/E correctly given positive earnings growth", () => {
		const pe = 25.0;
		const growth = 0.15; // 15% growth
		const forwardPe = calculateForwardPe(pe, growth);
		// 25 / 1.15 = 21.74
		expect(forwardPe).toBe(21.74);
	});

	it("computes forward P/E correctly given negative earnings growth", () => {
		const pe = 20.0;
		const growth = -0.10; // -10% contraction
		const forwardPe = calculateForwardPe(pe, growth);
		// 20 / 0.90 = 22.22
		expect(forwardPe).toBe(22.22);
	});

	it("returns null for loss-making companies (P/E <= 0)", () => {
		expect(calculateForwardPe(-15.0, 0.10)).toBeNull();
		expect(calculateForwardPe(0, 0.10)).toBeNull();
		expect(calculateForwardPe(null, 0.10)).toBeNull();
	});

	it("clamps extreme growth rates to avoid financial nonsense", () => {
		const pe = 30.0;
		// Extreme 300% growth clamped to 50%
		const forwardPe = calculateForwardPe(pe, 3.0);
		// 30 / (1 + 0.50) = 20.00
		expect(forwardPe).toBe(20.0);
	});
});

describe("Screener Enrichment Engine — Analyst Consensus Baseline", () => {
	it("assigns Strong Buy or Buy for high quality, undervalued stock", () => {
		const strongStock: StockFundamentalInputs = {
			symbol: "TCS",
			currentPrice: 3800,
			peRatio: 24,
			roe: 0.45,
			debtToEquity: 0.05,
		};
		const dcfResult = {
			dcfIntrinsicValue: 4600,
			upsidePercent: 21.05,
			discountRate: 0.12,
			growthRateUsed: 0.12,
			terminalGrowthRate: 0.05,
			source: "earnings_normalized" as const,
		};

		const consensus = calculateAnalystConsensus(strongStock, dcfResult);
		expect(["Strong Buy", "Buy"]).toContain(consensus.consensusRating);
		expect(consensus.buyCount).toBeGreaterThan(consensus.sellCount);
		expect(consensus.avgTargetPrice).toBeGreaterThan(strongStock.currentPrice);
		expect(consensus.confidenceScore).toBeGreaterThanOrEqual(60);
	});

	it("is strictly deterministic", () => {
		const stock: StockFundamentalInputs = {
			symbol: "INFY",
			currentPrice: 1800,
			peRatio: 22,
			roe: 0.28,
		};
		const dcf = calculateMathematicalDCF(stock);
		const c1 = calculateAnalystConsensus(stock, dcf);
		const c2 = calculateAnalystConsensus(stock, dcf);
		expect(c1).toEqual(c2);
	});
});
