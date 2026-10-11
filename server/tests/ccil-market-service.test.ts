import { describe, it, expect } from "vitest";
import { ccilMarketService } from "../services/ccil-market-service";

describe("CCIL Sovereign Debt & Money Market Service", () => {
	it("returns valid sovereign benchmarks with 10Y G-Sec yield and TREPS", async () => {
		const res = await ccilMarketService.getSovereignBenchmarks();
		expect(res.success).toBe(true);
		expect(res.data).toBeDefined();

		const data = res.data!;
		// Verify 10Y Benchmark
		const tenYear = data.sovereignYields.find((y) => y.tenor === "10Y");
		expect(tenYear).toBeDefined();
		expect(tenYear!.yieldPercent).toBeGreaterThan(6.0);
		expect(tenYear!.yieldPercent).toBeLessThan(8.0);
		expect(tenYear!.securityName).toBeTruthy();

		// Verify TREPS
		expect(data.treps).toBeDefined();
		expect(data.treps.weightedAverageRate).toBeGreaterThan(5.5);
		expect(data.treps.totalVolumeCr).toBeGreaterThan(100000); // ≥ ₹1 Lakh Crore
		expect(data.treps.marketCondition).toBeTruthy();

		// Verify T-Bills
		const tbill91D = data.tBills.find((t) => t.tenor === "91D");
		expect(tbill91D).toBeDefined();
		expect(tbill91D!.cutoffYield).toBeGreaterThan(5.5);

		// Verify Yield Curve Analysis
		expect(data.yieldCurveAnalysis.realYield10Y).toBeGreaterThan(1.0); // Real yield > 1%
		expect(data.yieldCurveAnalysis.tenor10Y_minus_2Y_bps).toBeDefined();
		expect(data.yieldCurveAnalysis.commentary).toBeTruthy();

		// Verify SDL spread
		expect(data.sdlSpreadBps).toBeGreaterThanOrEqual(25);
		expect(data.source).toContain("CCIL");
	});

	it("generates structured advisor commentary for the daily brief", async () => {
		const commentary = await ccilMarketService.getDailyFixedIncomeBriefCommentary();
		expect(commentary).toBeDefined();
		expect(commentary.headline).toContain("10-Year Benchmark G-Sec");
		expect(commentary.headline).toContain("TREPS");
		expect(commentary.bulletPoints.length).toBeGreaterThanOrEqual(4);
		expect(commentary.gsecYield10Y).toBeGreaterThan(6.0);
		expect(commentary.trepsRate).toBeGreaterThan(5.5);
		expect(commentary.realYield).toBeGreaterThan(1.0);
	});
});
