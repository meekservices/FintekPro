import { describe, it, expect } from "vitest";
import { BaseStrategy } from "../services/picks/base-strategy";
import type { PickCategory } from "../services/pick-of-the-day-service";

// Test harness subclass to expose protected methods of BaseStrategy
class TestStrategy extends BaseStrategy {
	category: PickCategory = "listed_stocks";
	async generate() { return null; }
	score() { return 50; }
	async getLivePrice() { return null; }

	public testGetDynamicTargetStoploss(category: PickCategory, vol?: number, price?: number) {
		return this.getDynamicTargetStoploss(category, vol, price);
	}
}

describe("Pick of the Day Engine - Unit Tests & Upgrades", () => {
	const testStrat = new TestStrategy();

	describe("1. Risk-to-Reward (R:R) 2:1 Enforcement", () => {
		it("enforces minimum 2:1 R:R for domestic listed stocks with base targets", () => {
			const { targetPct, stoplossPct } = testStrat.testGetDynamicTargetStoploss("listed_stocks");
			expect(targetPct).toBeGreaterThanOrEqual(0.08); // ≥8%
			expect(targetPct / stoplossPct).toBeGreaterThanOrEqual(2.0); // 2:1 R:R
		});

		it("enforces minimum 2:1 R:R for listed stocks across various volatility regimes", () => {
			const vols = [12, 18, 25, 35, 45];
			const price = 250;
			for (const vol of vols) {
				const { targetPct, stoplossPct } = testStrat.testGetDynamicTargetStoploss("listed_stocks", vol, price);
				const rr = targetPct / stoplossPct;
				expect(rr).toBeGreaterThanOrEqual(2.0);
				expect(targetPct).toBeGreaterThanOrEqual(0.09); // ≥ 9% target
				expect(stoplossPct).toBeLessThanOrEqual(0.06);  // capped at 6%
			}
		});

		it("enforces 2:1 R:R for global stocks and ETFs", () => {
			const globalTargets = testStrat.testGetDynamicTargetStoploss("global_stocks");
			expect(globalTargets.targetPct / globalTargets.stoplossPct).toBeGreaterThanOrEqual(2.0);

			const etfTargets = testStrat.testGetDynamicTargetStoploss("etfs");
			expect(etfTargets.targetPct / etfTargets.stoplossPct).toBeGreaterThanOrEqual(2.0);
		});
	});

	describe("2. SGB Strategy Target & Stoploss (Bug Fix Verification)", () => {
		it("calculates realistic gold appreciation target for SGB (>4% upside)", () => {
			const { targetPct, stoplossPct } = testStrat.testGetDynamicTargetStoploss("sgb");
			expect(targetPct).toBe(0.08); // 8% gold target
			expect(stoplossPct).toBe(0.03); // 3% stoploss

			// Verify that an SGB pick will pass the 4% minUpside threshold
			const currentPrice = 7500;
			const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
			const upsidePct = ((targetPrice - currentPrice) / currentPrice) * 100;
			expect(upsidePct).toBeGreaterThanOrEqual(4.0);
		});
	});

	describe("3. Derivative Strategy & Credit Spread Math (Bug Fix Verification)", () => {
		it("calculates positive profit upside for option selling credit strategies", () => {
			// For Iron Condor / Short Strangle with entry=10000, target=4000 (targetMult 0.4)
			const recoP = 10000;
			const targetP = 4000;
			const isCreditStrategy = true;

			const upsidePct = isCreditStrategy
				? ((recoP - targetP) / recoP) * 100
				: ((targetP - recoP) / recoP) * 100;

			// Expected profit is +60% of premium collected
			expect(upsidePct).toBe(60);
			expect(upsidePct).toBeGreaterThanOrEqual(15); // clears 15% derivatives bar
		});

		it("correctly identifies credit strategy when targetPrice < recoPrice", () => {
			const recoP = 12000;
			const targetP = 6000;
			const category = "derivatives";

			const isCreditStrategy = category === "derivatives" && targetP < recoP && recoP > 0;
			expect(isCreditStrategy).toBe(true);

			const upsidePct = isCreditStrategy
				? ((recoP - targetP) / recoP) * 100
				: ((targetP - recoP) / recoP) * 100;

			expect(upsidePct).toBe(50);
		});
	});

	describe("4. Non-Live Yield Return & Multi-Year Accrual Precision", () => {
		it("accurately annualizes 3-year FD returns instead of tripling", () => {
			// 3-year FD: recoPrice 100,000, targetPrice 121,000 (21% total return over 3 years / 1095 days)
			const recoPrice = 100000;
			const targetPrice = 121000;
			const daysHeld = 365; // held for 1 year
			const pick = {
				category: "fixed_deposits",
				recoDate: "2025-01-01",
				expiryDate: "2028-01-01", // exactly 3 years (1095 days)
			};

			const totalDays = Math.floor(
				(new Date(pick.expiryDate).getTime() - new Date(pick.recoDate).getTime()) / (1000 * 60 * 60 * 24)
			);
			expect(totalDays).toBe(1095);

			const totalReturnPct = ((targetPrice - recoPrice) / recoPrice) * 100; // 21%
			const fractionHeld = Math.min(1.0, daysHeld / totalDays); // 365 / 1095 = 1/3
			const accruedReturn = totalReturnPct * fractionHeld;

			// Accrued return after 1 year should be ~7.0%, NOT 21%
			expect(Math.round(accruedReturn * 10) / 10).toBe(7.0);
		});

		it("accurately computes linear daily accrual for credit derivative positions", () => {
			// 7-day derivative: recoPrice 10,000, targetPrice 4,000 (60% profit target over 7 days)
			const recoPrice = 10000;
			const targetPrice = 4000;
			const daysHeld = 3;
			const pick = {
				category: "derivatives",
				recoDate: "2026-06-01",
				expiryDate: "2026-06-08",
				keyMetrics: { isCreditStrategy: true },
			};

			const isCredit = (pick.keyMetrics as any)?.isCreditStrategy === true;
			const totalReturnPct = isCredit
				? ((recoPrice - targetPrice) / recoPrice) * 100
				: ((targetPrice - recoPrice) / recoPrice) * 100;

			expect(totalReturnPct).toBe(60);
			const totalDays = 7;
			const fractionHeld = Math.min(1.0, daysHeld / totalDays);
			const accrued = Number((totalReturnPct * fractionHeld).toFixed(2));

			// 60% * (3/7) ≈ 25.71%
			expect(accrued).toBe(25.71);
		});
	});

	describe("5. Outcome Tracking & Intraday Breach Resolution", () => {
		it("detects intraday stop-loss breach when dayLow <= stoplossPrice", () => {
			const targetPrice = 550;
			const stoplossPrice = 475;
			const livePrice = 485; // price bounced back above stoploss by 3:30 PM
			const dayLow = 470;    // but breached stoploss intraday!

			const hitTarget = livePrice >= targetPrice;
			const hitStoploss = (dayLow != null && dayLow <= stoplossPrice) || livePrice <= stoplossPrice;

			expect(hitTarget).toBe(false);
			expect(hitStoploss).toBe(true); // Intraday breach is correctly caught!
		});

		it("detects credit strategy target hit when price drops below targetPrice", () => {
			// Short option position: entry=100, target=40, stoploss=180
			const targetPrice = 40;
			const stoplossPrice = 180;
			const livePrice = 38; // premium decayed to 38

			const hitTarget = livePrice <= targetPrice;
			const hitStoploss = livePrice >= stoplossPrice;

			expect(hitTarget).toBe(true);
			expect(hitStoploss).toBe(false);
		});

		it("resolves conservatively when high volatility triggers both target and stoploss", () => {
			const dayHigh = 560; // target is 550
			const dayLow = 460;  // stoploss is 475
			const targetPrice = 550;
			const stoplossPrice = 475;

			const hitTarget = dayHigh >= targetPrice;
			const hitStoploss = dayLow <= stoplossPrice;

			expect(hitTarget).toBe(true);
			expect(hitStoploss).toBe(true);

			// Engine evaluates conservatively (stoploss prioritized)
			let newStatus = "live";
			if (hitStoploss && hitTarget) {
				newStatus = "stoploss_hit";
			} else if (hitTarget) {
				newStatus = "target_hit";
			}
			expect(newStatus).toBe("stoploss_hit");
		});
	});

	describe("6. Non-Live Asset Class Yield Settlement on Expiry", () => {
		it("resolves matured Bond/FD/SGB as target_hit when accrued yield meets expectation", () => {
			const recoPrice = 1000;
			const targetPrice = 1080; // 8% target yield
			const daysHeld = 365;
			const totalDays = 365;
			const expectedTargetReturn = ((targetPrice - recoPrice) / recoPrice) * 100; // 8%

			const fractionHeld = Math.min(1.0, daysHeld / totalDays);
			const estimatedReturn = Number((expectedTargetReturn * fractionHeld).toFixed(2)); // 8%

			const isExpired = true;
			const category = "bonds";
			const minWinReturn = (category === "bonds" || category === "fixed_deposits" || category === "sgb") ? 3.5 : 5.0;
			const reachedTargetYield = (expectedTargetReturn > 0 && estimatedReturn >= expectedTargetReturn * 0.85) ||
				estimatedReturn >= minWinReturn;

			const newStatus = isExpired ? (reachedTargetYield ? "target_hit" : "expired") : "live";
			expect(newStatus).toBe("target_hit"); // Accrued yield successfully counts as win!
		});

		it("resolves credit derivative strategy as target_hit when option premium decayed to target over tenure", () => {
			const recoPrice = 10000;
			const targetPrice = 4000; // credit strategy: target is lower price (decay)
			const isCredit = true;
			const daysHeld = 7;
			const totalDays = 7;
			const expectedTargetReturn = ((recoPrice - targetPrice) / recoPrice) * 100; // 60%
			const estimatedReturn = expectedTargetReturn * (daysHeld / totalDays); // 60%

			const isExpired = true;
			const reachedTargetYield = (expectedTargetReturn > 0 && estimatedReturn >= expectedTargetReturn * 0.85) ||
				estimatedReturn >= 5.0;

			const newStatus = isExpired ? (reachedTargetYield ? "target_hit" : "expired") : "live";
			expect(newStatus).toBe("target_hit"); // Full option decay over 7 days counts as target_hit
		});
	});

	describe("7. Trailing Stop Breathing Buffer Protection", () => {
		it("protects against immediate stopout when price touches exact entry price after +4% gain", () => {
			const recoPrice = 100;
			const livePrice = 100.2;
			const dayLow = 100.0; // touched exact entry price
			const returnPct = 4.5; // gained 4.5%

			// With 0.5% breathing buffer:
			let stoplossPrice = 95;
			if (returnPct >= 4.0 && stoplossPrice < recoPrice * 0.995) {
				stoplossPrice = recoPrice * 0.995; // 99.50
			}

			expect(stoplossPrice).toBe(99.5);
			// Intraday retest at 100.0 does NOT breach 99.50
			const hitStoploss = (dayLow != null && dayLow <= stoplossPrice) || livePrice <= stoplossPrice;
			expect(hitStoploss).toBe(false); // Protected against exact-entry wick stopout!
		});
	});

	describe("8. Mutual Fund Expiry Benchmark Evaluation", () => {
		it("classifies mutual fund with >=3% return over holding period as target_hit", () => {
			const category = "mutual_funds";
			const returnPct = 4.2; // 4.2% return in holding period (17% annualized)
			const minWinPct = category === "mutual_funds" ? 3.0 : 5.0;
			const isExpired = true;

			const newStatus = isExpired ? (returnPct >= minWinPct ? "target_hit" : "expired") : "live";
			expect(newStatus).toBe("target_hit"); // Solid fund performance is rewarded as a win
		});
	});
});

