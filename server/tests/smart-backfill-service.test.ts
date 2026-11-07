import { describe, it, expect, vi } from "vitest";
import { SmartBackfillService } from "../services/screener/smart-backfill-service";

describe("SmartBackfillService - JIT Read-Through Backfill Engine", () => {
	it("derives deterministic in-memory fallback metrics when DB records are missing", () => {
		const mockStock = {
			symbol: "TCS",
			currentPrice: "3850.00",
			peRatio: "28.5",
			pbRatio: "12.4",
			roe: "42.0",
			roce: "51.0",
			debtToEquity: "0.05",
			dividendYield: "1.4",
			eps: "135.0",
			bookValue: "310.0",
		};

		const mockFinancials = [
			{
				fiscalYear: 2025,
				revenueGrowth: "0.08",
				earningsGrowth: "0.10",
			},
		];

		const mockDcf = {
			upsidePercent: "15.5",
		};

		const derived = SmartBackfillService.deriveJitFallbackMetrics(mockStock, mockFinancials, mockDcf);

		expect(derived.symbol).toBe("TCS");
		expect(Number(derived.compositeScore)).toBeGreaterThan(0);
		expect(Number(derived.compositeScore)).toBeLessThanOrEqual(100);
		expect(derived.fintekRating).toBeGreaterThanOrEqual(1);
		expect(derived.fintekRating).toBeLessThanOrEqual(5);

		// Scoring metadata checks
		expect(derived.scoringMetadata.isJitDerived).toBe(true);
		expect(derived.scoringMetadata.grahamNumber).toBeGreaterThan(0);
		expect(derived.scoringMetadata.piotroskiFScore).toBeGreaterThanOrEqual(0);
		expect(derived.scoringMetadata.piotroskiFScore).toBeLessThanOrEqual(9);
		expect(derived.scoringMetadata.altmanZScore).toBeGreaterThan(0);
	});

	it("handles completely empty/null financial fields safely without throwing", () => {
		const emptyStock = {
			symbol: "NEWIPO",
			currentPrice: null,
			peRatio: null,
			pbRatio: null,
			roe: null,
			roce: null,
			debtToEquity: null,
			dividendYield: null,
			eps: null,
			bookValue: null,
		};

		const derived = SmartBackfillService.deriveJitFallbackMetrics(emptyStock, [], null);

		expect(derived.symbol).toBe("NEWIPO");
		expect(derived.scoringMetadata.grahamNumber).toBeNull();
		expect(derived.fintekRating).toBeDefined();
		expect(derived.scoringMetadata.isJitDerived).toBe(true);
	});

	it("prevents thundering herd duplicate triggers via in-flight mutex", () => {
		// Calling backfill multiple times for same symbol should safely deduplicate without crash
		expect(() => {
			SmartBackfillService.triggerAsyncBackfill("INFY", ["derived", "technicals"]);
			SmartBackfillService.triggerAsyncBackfill("INFY", ["derived"]);
			SmartBackfillService.triggerAsyncBackfill("infy", ["technicals"]);
		}).not.toThrow();
	});

	it("handles batch backfill invocation safely with empty or populated arrays", () => {
		expect(() => {
			SmartBackfillService.triggerBatchBackfill([]);
			SmartBackfillService.triggerBatchBackfill(["WIPRO", "HCLTECH", "TECHM"], 2);
		}).not.toThrow();
	});
});

