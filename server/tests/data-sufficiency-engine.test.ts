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
		expect(stats.coveragePct).toBeDefined();
		expect(stats.coveragePct.financials).toBeGreaterThanOrEqual(0);
		expect(stats.coveragePct.ratios).toBeGreaterThanOrEqual(0);
		expect(stats.engineVersion).toBe("1.0.0");
		expect(Array.isArray(stats.activeAlerts)).toBe(true);

		if (stats.telemetryDegraded) {
			// When DB telemetry is offline, regulatory safety mandates reporting degraded mode rather than concealing outage
			expect(stats.overallSufficiencyPercent).toBe(0);
			expect(stats.activeAlerts.some((a) => a.id === "SYSTEM_TELEMETRY_UNAVAILABLE")).toBe(true);
		} else {
			expect(stats.totalStocks).toBeGreaterThan(0);
			expect(stats.overallSufficiencyPercent).toBeGreaterThanOrEqual(0);
		}
	});

	it("does NOT award freshness points when price update timestamp is missing", () => {
		const stockWithoutDate = {
			symbol: "NODATE",
			companyName: "No Date Corp",
			exchange: "NSE",
			currentPrice: 1000,
			peRatio: 20,
			pbRatio: 2.5,
			roe: 15,
			roce: 18,
			piotroskiFScore: 8,
			lastDailyUpdate: null, // No timestamp!
			lastEnrichedAt: new Date(),
		};

		const metrics = {
			fiscalYearEnd: new Date(),
			revenue: 10000,
			netIncome: 1500,
			piotroskiFScore: 8,
		};

		const result = engine.evaluateStock(stockWithoutDate, metrics);

		// Without lastDailyUpdate:
		// Price (25) + Financials (25) + Ratios (20) + Derived (15) = 85 (missing technicals=10, missing freshness=5)
		// It must NOT receive the 5 freshness points!
		expect(result.sufficiencyScore).toBe(85);
		expect(result.gaps.hasTechnicals).toBe(false);
	});

	it("flags filing staleness when fiscal year end is older than 210 days", () => {
		const eightMonthsAgo = new Date(Date.now() - 240 * 24 * 60 * 60 * 1000);
		const stock = {
			symbol: "STALEF",
			companyName: "Stale Filings Ltd",
			exchange: "BSE",
			currentPrice: 500,
			peRatio: 15,
			pbRatio: 1.8,
			roe: 12,
			roce: 14,
			piotroskiFScore: 7,
			lastDailyUpdate: new Date(),
			lastEnrichedAt: new Date(),
		};

		const metrics = {
			fiscalYearEnd: eightMonthsAgo, // > 210 days
			revenue: 5000,
			netIncome: 600,
			piotroskiFScore: 7,
		};

		const result = engine.evaluateStock(stock, metrics);

		expect(result.gaps.isFinancialsStale).toBe(true);
		expect(result.reasons.some((r) => r.includes("STALE_FILING"))).toBe(true);
		expect(result.severity).toBe("STALE_WARNING");
		expect(result.isExecutionAllowed).toBe(false); // Automated order execution blocked
		expect(result.isAiAllowed).toBe(true); // AI decision support permitted with caveat
	});

	it("correctly computes 100 score for pristine, freshly audited equity", () => {
		const stock = {
			symbol: "PRISTINE",
			companyName: "Pristine Benchmark Corp",
			exchange: "NSE",
			currentPrice: 2000,
			peRatio: 25,
			pbRatio: 5,
			roe: 30,
			roce: 35,
			piotroskiFScore: 9,
			lastDailyUpdate: new Date(),
			lastEnrichedAt: new Date(),
		};

		const metrics = {
			fiscalYearEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago (<210d)
			revenue: 100000,
			netIncome: 20000,
			piotroskiFScore: 9,
		};

		const result = engine.evaluateStock(stock, metrics);

		// Price (25) + Financials (25) + Ratios (20) + Derived (15) + Technicals (10) + Freshness (5) = 100
		expect(result.sufficiencyScore).toBe(100);
		expect(result.severity).toBe("HEALTHY");
		expect(result.isExecutionAllowed).toBe(true);
		expect(result.isAiAllowed).toBe(true);
		expect(result.reasons).toHaveLength(0);
	});

	it("inspects all 7 core financial domains and their respective subdomains", async () => {
		const domains = await engine.inspectAllDomains();

		expect(domains).toBeDefined();
		expect(domains).toHaveLength(7);

		const expectedDomains = [
			"EQUITIES",
			"MUTUAL_FUNDS",
			"FIXED_INCOME",
			"ALTERNATIVES",
			"REAL_ASSETS",
			"UNLISTED",
			"COMPLIANCE",
		];

		const actualCodes = domains.map((d) => d.code);
		expect(actualCodes).toEqual(expect.arrayContaining(expectedDomains));

		// Check Equities subdomains
		const equities = domains.find((d) => d.code === "EQUITIES");
		expect(equities).toBeDefined();
		expect(equities?.subdomains.length).toBeGreaterThanOrEqual(3);
		expect(equities?.subdomains.some((s) => s.name.includes("Large Cap"))).toBe(true);

		// Check Mutual Funds subdomains
		const mf = domains.find((d) => d.code === "MUTUAL_FUNDS");
		expect(mf).toBeDefined();
		expect(mf?.subdomains.some((s) => s.name.includes("Equity"))).toBe(true);
		expect(mf?.subdomains.some((s) => s.name.includes("Debt"))).toBe(true);

		// Check Fixed Income subdomains
		const debt = domains.find((d) => d.code === "FIXED_INCOME");
		expect(debt).toBeDefined();
		expect(debt?.subdomains.some((s) => s.name.includes("Sovereign"))).toBe(true);

		// Check Compliance / SEBI IA Reg 17 subdomains
		const compliance = domains.find((d) => d.code === "COMPLIANCE");
		expect(compliance).toBeDefined();
		expect(compliance?.freshnessThreshold).toContain("365 days");
		expect(compliance?.subdomains.some((s) => s.name.includes("SEBI IA Reg 17"))).toBe(true);
	});

	it("includes multi-domain telemetry in universe sufficiency stats response", async () => {
		const stats = await dataSufficiencyEngine.getUniverseSufficiencyStats();

		expect(stats.domains).toBeDefined();
		expect(stats.domains.length).toBe(7);

		for (const domain of stats.domains) {
			expect(domain.domain).toBeDefined();
			expect(domain.code).toBeDefined();
			expect(domain.freshnessThreshold).toBeDefined();
			expect(Array.isArray(domain.subdomains)).toBe(true);
			expect(domain.subdomains.length).toBeGreaterThan(0);
		}
	});

	it("evaluates autonomous self-healing and cooldown mechanics correctly", async () => {
		const res = await dataSufficiencyEngine.autoSelfHealIfDegraded(false);
		expect(res).toBeDefined();
		expect(typeof res.triggered).toBe("boolean");
		expect(typeof res.message).toBe("string");
		expect(res.stats).toBeDefined();

		// Immediate second call should respect cooldown or actively running lock
		const secondRes = await dataSufficiencyEngine.autoSelfHealIfDegraded(false);
		expect(secondRes).toBeDefined();
		if (res.triggered) {
			expect(secondRes.triggered).toBe(false);
			expect(
				secondRes.message.includes("cooldown") ||
				secondRes.message.includes("already actively running"),
			).toBe(true);
		}
	});
});

