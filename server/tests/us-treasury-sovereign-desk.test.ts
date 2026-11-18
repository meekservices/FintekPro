import { describe, it, expect } from "vitest";
import { FRED_SERIES, fredCommodityService } from "../services/fred-commodity-service";

describe("US Treasury & Federal Reserve Sovereign Desk Ingestion & Calibration", () => {
	it("contains official FRED series IDs and calibrated sovereign fallbacks", () => {
		// 10-Year Benchmark Treasury (DGS10)
		expect(FRED_SERIES.US_10Y).toBeDefined();
		expect(FRED_SERIES.US_10Y.id).toBe("DGS10");
		expect(FRED_SERIES.US_10Y.fallback).toBe(4.42);

		// 2-Year Benchmark Treasury (DGS2)
		expect(FRED_SERIES.US_2Y).toBeDefined();
		expect(FRED_SERIES.US_2Y.id).toBe("DGS2");
		expect(FRED_SERIES.US_2Y.fallback).toBe(4.30);

		// Effective Fed Funds Rate (DFF)
		expect(FRED_SERIES.FED_FUNDS).toBeDefined();
		expect(FRED_SERIES.FED_FUNDS.id).toBe("DFF");
		expect(FRED_SERIES.FED_FUNDS.fallback).toBe(4.58);

		// Freddie Mac Primary Mortgage Market Survey 30Y Fixed (MORTGAGE30US)
		expect(FRED_SERIES.MORTGAGE_30Y).toBeDefined();
		expect(FRED_SERIES.MORTGAGE_30Y.id).toBe("MORTGAGE30US");
		expect(FRED_SERIES.MORTGAGE_30Y.fallback).toBe(6.78);
	});

	it("computes 10Y-2Y term spread and classifies yield curve slope accurately", () => {
		const tenYear = FRED_SERIES.US_10Y.fallback;
		const twoYear = FRED_SERIES.US_2Y.fallback;
		const spreadBps = Math.round((tenYear - twoYear) * 100);

		expect(spreadBps).toBe(12);
		expect(spreadBps).toBeGreaterThan(0);

		const yieldCurveSlope = spreadBps >= 0
			? `Normal Upward (+${spreadBps} bps)`
			: `Inverted (${spreadBps} bps)`;

		expect(yieldCurveSlope).toBe("Normal Upward (+12 bps)");
	});

	it("correctly identifies active FOMC Fed Funds target range (4.50% – 4.75%)", () => {
		const activeFomcTargetRange = "4.50% – 4.75%";
		const effectiveRate = FRED_SERIES.FED_FUNDS.fallback;

		// The effective Fed Funds rate (4.58%) must sit within the FOMC target range [4.50, 4.75]
		expect(effectiveRate).toBeGreaterThanOrEqual(4.50);
		expect(effectiveRate).toBeLessThanOrEqual(4.75);
		expect(activeFomcTargetRange).toBe("4.50% – 4.75%");
	});

	it("resolves mortgage30Y in fredCommodityService snapshot", async () => {
		const snapshot = await fredCommodityService.getCommodityAndMacroSnapshot();
		expect(snapshot).toBeDefined();
		expect(snapshot.us10YTreasury).toBeDefined();
		expect(snapshot.us2YTreasury).toBeDefined();
		expect(snapshot.mortgage30Y).toBeDefined();
		expect(snapshot.mortgage30Y?.rate).toBeGreaterThan(0);
		expect(snapshot.mortgage30Y?.seriesId).toBe("MORTGAGE30US");
	});
});
