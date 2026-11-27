import { describe, it, expect } from "vitest";
import {
	CorporateActionsService,
	CorporateAction,
	HistoricalPriceRecord,
} from "../services/corporate-actions-service";

describe("CorporateActionsService (NSE/BSE Institutional Standard)", () => {
	it("correctly calculates split factors", () => {
		// 10:1 split (old 1 share -> new 10 shares)
		const factor10to1 = CorporateActionsService.calculateSplitFactor(10, 1);
		expect(factor10to1.toNumber()).toBe(0.1);

		// 2:1 split (old 1 share -> new 2 shares)
		const factor2to1 = CorporateActionsService.calculateSplitFactor(2, 1);
		expect(factor2to1.toNumber()).toBe(0.5);

		// 5:1 split
		const factor5to1 = CorporateActionsService.calculateSplitFactor(5, 1);
		expect(factor5to1.toNumber()).toBe(0.2);
	});

	it("correctly calculates bonus factors", () => {
		// 1:1 bonus (1 bonus for 1 existing -> 2 total shares)
		const bonus1to1 = CorporateActionsService.calculateBonusFactor(1, 1);
		expect(bonus1to1.toNumber()).toBe(0.5);

		// 2:1 bonus (2 bonus for 1 existing -> 3 total shares)
		const bonus2to1 = CorporateActionsService.calculateBonusFactor(1, 2);
		expect(bonus2to1.toNumber()).toBeCloseTo(1 / 3, 5);

		// 1:2 bonus (1 bonus for 2 existing -> 3 total shares)
		const bonus1to2 = CorporateActionsService.calculateBonusFactor(2, 1);
		expect(bonus1to2.toNumber()).toBeCloseTo(2 / 3, 5);
	});

	it("adjusts historical price series backwards across multiple corporate actions", () => {
		const prices: HistoricalPriceRecord[] = [
			{ date: "2024-01-01", open: 1000, high: 1050, low: 990, close: 1000, volume: 10000 },
			{ date: "2024-02-01", open: 1100, high: 1150, low: 1080, close: 1100, volume: 12000 },
			{ date: "2024-06-01", open: 1200, high: 1250, low: 1180, close: 1200, volume: 15000 },
			{ date: "2024-07-01", open: 600, high: 620, low: 590, close: 600, volume: 25000 }, // post 1:1 bonus
			{ date: "2024-12-01", open: 700, high: 720, low: 690, close: 700, volume: 30000 },
		];

		const actions: CorporateAction[] = [
			{
				id: "act-1",
				symbol: "RELIANCE",
				actionType: "BONUS",
				exDate: "2024-06-15", // Ex-date between June and July
				ratioNumerator: 1, // 1 bonus
				ratioDenominator: 1, // 1 existing
			},
		];

		const adjusted = CorporateActionsService.adjustHistoricalSeries(prices, actions);

		expect(adjusted).toHaveLength(5);
		// Dates before 2024-06-15 should be multiplied by 0.5
		expect(adjusted[0].adjustedClose).toBe(500);
		expect(adjusted[1].adjustedClose).toBe(550);
		expect(adjusted[2].adjustedClose).toBe(600);

		// Dates after 2024-06-15 remain unscaled
		expect(adjusted[3].adjustedClose).toBe(600);
		expect(adjusted[4].adjustedClose).toBe(700);

		// Cumulative multiplier
		expect(adjusted[0].splitAdjustmentFactor).toBe(0.5);
		expect(adjusted[4].splitAdjustmentFactor).toBe(1.0);
	});

	it("accurately computes adjusted vs unadjusted return", () => {
		// Stock was 1000, split 1:2 (factor 0.5), currently trades at 600.
		// Unadjusted: (600 - 1000)/1000 = -40%
		// Adjusted: (600 - 500)/500 = +20%
		const returns = CorporateActionsService.calculateAdjustedReturn(1000, 600, 0.5);
		expect(returns.unadjustedReturnPct).toBe(-40);
		expect(returns.adjustedReturnPct).toBe(20);
	});
});
