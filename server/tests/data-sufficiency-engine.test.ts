import { describe, it, expect } from "vitest";
import {
	dataSufficiencyEngine,
	DataSufficiencyEngine,
} from "../services/data-sufficiency-engine";

describe("Data Sufficiency Engine (FASP-AI v1.0 & SEBI IA Compliance)", () => {
	const engine = new DataSufficiencyEngine();

	it("identifies fully-enriched and compliant stocks as HEALTHY", () => {
		const stock = {
			symbol: "TCS",
			companyName: "Tata Consultancy Services Ltd",
			exchange: "NSE",
			currentPrice: 3850.5,
			peRatio: 28.5,
			pbRatio: 12.1,
			roe: 45.2,
			roce: 58.4,
			piotroskiFScore: 9,
			lastDailyUpdate: new Date(),
			lastEnrichedAt: new Date(),
			marketCap: "large",
		};

		const metrics = {
			fiscalYearEnd: new Date(),
			revenue: 240000,
			netIncome: 45000,
			piotroskiFScore: 9,
		};

		const result = engine.evaluateStock(stock, metrics);

		expect(result.severity).toBe("HEALTHY");
		expect(result.sufficiencyScore).toBeGreaterThanOrEqual(80);
		expect(result.isExecutionAllowed).toBe(true);
		expect(result.isAiAllowed).toBe(true);
		expect(result.reasons).toHaveLength(0);
		expect(result.gaps.hasPrice).toBe(true);
		expect(result.gaps.hasFinancials).toBe(true);
		expect(result.gaps.hasRatios).toBe(true);
	});

	it("flags stocks with missing market prices as CRITICAL_INSUFFICIENT (auto-blocks execution & AI)", () => {
		const stock = {
			symbol: "SUSP1",
			companyName: "Suspended Trading Corp",
			exchange: "NSE",
			currentPrice: 0, // No price!
			peRatio: 15.0,
			pbRatio: 2.0,
			roe: 12.0,
			roce: 14.0,
			piotroskiFScore: 6,
			lastDailyUpdate: null,
			lastEnrichedAt: new Date(),
			marketCap: "small",
		};

		const result = engine.evaluateStock(stock);

		expect(result.severity).toBe("CRITICAL_INSUFFICIENT");
		expect(result.isExecutionAllowed).toBe(false);
		expect(result.isAiAllowed).toBe(false);
		expect(result.reasons.some((r) => r.includes("CRITICAL_MISSING_PRICE"))).toBe(true);
	});

	it("flags stocks without audited financials as CRITICAL_INSUFFICIENT", () => {
		const stock = {
			symbol: "SHELL1",
			companyName: "No Filing Shell Ltd",
			exchange: "BSE",
			currentPrice: 12.5,
			peRatio: null,
			pbRatio: null,
			roe: null,
			roce: null,
			piotroskiFScore: null,
			lastDailyUpdate: new Date(),
			lastEnrichedAt: null, // Never enriched!
			marketCap: "micro",
		};

		const result = engine.evaluateStock(stock, null);

		expect(result.severity).toBe("CRITICAL_INSUFFICIENT");
		expect(result.isExecutionAllowed).toBe(false);
		expect(result.isAiAllowed).toBe(false);
		expect(result.reasons.some((r) => r.includes("CRITICAL_MISSING_FINANCIALS"))).toBe(true);
	});

	it("generates STALE_WARNING when price is older than 5 days", () => {
		const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
		const stock = {
			symbol: "ILLIQ1",
			companyName: "Illiquid Infrequent Trading Ltd",
			exchange: "BSE",
			currentPrice: 150.0,
			peRatio: 18.0,
			pbRatio: 1.5,
			roe: 10.0,
			roce: 12.0,
			piotroskiFScore: 7,
			lastDailyUpdate: tenDaysAgo, // Stale!
			lastEnrichedAt: new Date(),
			marketCap: "small",
		};

		const result = engine.evaluateStock(stock);

		expect(result.severity).toBe("STALE_WARNING");
		expect(result.isExecutionAllowed).toBe(false); // Execution blocked on stale data
		expect(result.isAiAllowed).toBe(true); // AI decision support allowed with warning
		expect(result.gaps.isPriceStale).toBe(true);
		expect(result.reasons.some((r) => r.includes("STALE_PRICE"))).toBe(true);
	});

	it("generates STALE_WARNING when key ratios or Piotroski scores are missing", () => {
		const stock = {
			symbol: "MID1",
			companyName: "Midcap Without Ratios Ltd",
			exchange: "NSE",
			currentPrice: 420.0,
			peRatio: null, // Missing P/E
			pbRatio: null,
			roe: null,
			roce: null,
			piotroskiFScore: null, // Missing F-score
			lastDailyUpdate: new Date(),
			lastEnrichedAt: new Date(),
			marketCap: "mid",
		};

		const result = engine.evaluateStock(stock);

		expect(result.severity).toBe("STALE_WARNING");
		expect(result.isExecutionAllowed).toBe(false);
		expect(result.reasons.some((r) => r.includes("RATIO_DEFICIT"))).toBe(true);
		expect(result.reasons.some((r) => r.includes("QUANT_GAP"))).toBe(true);
	});

	it("evaluates universe stats and returns structured telemetry and alerts", async () => {
		const stats = await dataSufficiencyEngine.getUniverseSufficiencyStats();

		expect(stats).toBeDefined();
		expect(stats.totalStocks).toBeGreaterThan(0);
		expect(stats.coveragePct).toBeDefined();
		expect(stats.coveragePct.financials).toBeGreaterThanOrEqual(0);
		expect(stats.coveragePct.ratios).toBeGreaterThanOrEqual(0);
		expect(stats.engineVersion).toBe("1.0.0");
		expect(Array.isArray(stats.activeAlerts)).toBe(true);
	});
});

