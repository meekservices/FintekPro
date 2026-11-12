/**
 * @file upstox-option-chain-and-kill-switch.test.ts
 * @description Unit & integration tests for Upstox-benchmarked Option Chain, Live Greeks,
 * and Client F&O Segment Kill-Switch under FintekPro GCR v1.0 & SEBI 2026 Framework.
 */

import { describe, it, expect } from "vitest";
import { derivativesService } from "../services/derivatives-service";

describe("Upstox Pro Benchmarked Option Chain & F&O Risk Controls", () => {
	describe("1. Option Chain Greeks & Sentiment Metrics", () => {
		it("calculates real-time Greeks for calls and puts with valid delta and positive IV", async () => {
			const chain = await derivativesService.getOptionsChain("NIFTY");
			expect(chain).toBeDefined();
			expect(chain.symbol).toBe("NIFTY");
			expect(chain.strikePrices.length).toBeGreaterThan(0);
			expect(chain.options.calls.length).toBeGreaterThan(0);
			expect(chain.options.puts.length).toBeGreaterThan(0);

			// Verify Greeks are populated on calls
			const sampleCall = chain.options.calls[0];
			expect(sampleCall).toBeDefined();
			expect(typeof sampleCall.delta).toBe("number");
			expect(typeof sampleCall.gamma).toBe("number");
			expect(typeof sampleCall.theta).toBe("number");
			expect(typeof sampleCall.vega).toBe("number");
			expect(sampleCall.impliedVolatility).toBeGreaterThan(0);

			// Verify Greeks are populated on puts
			const samplePut = chain.options.puts[0];
			expect(samplePut).toBeDefined();
			expect(typeof samplePut.delta).toBe("number");
			expect(typeof samplePut.gamma).toBe("number");
			expect(typeof samplePut.theta).toBe("number");
			expect(typeof samplePut.vega).toBe("number");
			expect(samplePut.impliedVolatility).toBeGreaterThan(0);
		});

		it("computes Put-Call Ratio (PCR), ATM strike, and Max Pain level", async () => {
			const chain = await derivativesService.getOptionsChain("NIFTY");
			expect(chain.pcr).toBeDefined();
			expect(typeof chain.pcr).toBe("number");
			expect(chain.pcr).toBeGreaterThan(0);

			expect(chain.atmStrike).toBeDefined();
			expect(typeof chain.atmStrike).toBe("number");

			expect(chain.maxPain).toBeDefined();
			expect(typeof chain.maxPain).toBe("number");

			expect(chain.totalCallOI).toBeDefined();
			expect(chain.totalPutOI).toBeDefined();
			expect(chain.totalCallOI! + chain.totalPutOI!).toBeGreaterThan(0);
		});

		it("verifies mathematical consistency of computeChainMetrics", () => {
			const calls = [
				{
					strikePrice: 24000,
					expiryDate: "2026-11-26",
					optionType: "CE" as const,
					openInterest: 100000,
					changeinOpenInterest: 5000,
					totalTradedVolume: 50000,
					impliedVolatility: 14.5,
					lastPrice: 150,
					change: 10,
					pChange: 7.1,
					totalBuyQuantity: 20000,
					totalSellQuantity: 20000,
					bidQty: 500,
					bidPrice: 149.5,
					askQty: 500,
					askPrice: 150.5,
					underlyingValue: 24050,
				},
			];
			const puts = [
				{
					strikePrice: 24000,
					expiryDate: "2026-11-26",
					optionType: "PE" as const,
					openInterest: 120000,
					changeinOpenInterest: 12000,
					totalTradedVolume: 60000,
					impliedVolatility: 15.2,
					lastPrice: 110,
					change: -5,
					pChange: -4.3,
					totalBuyQuantity: 25000,
					totalSellQuantity: 25000,
					bidQty: 500,
					bidPrice: 109.5,
					askQty: 500,
					askPrice: 110.5,
					underlyingValue: 24050,
				},
			];

			const metrics = derivativesService.computeChainMetrics(calls, puts, [24000], 24050);
			expect(metrics.pcr).toBe(1.2); // 120,000 / 100,000
			expect(metrics.atmStrike).toBe(24000);
			expect(metrics.maxPain).toBe(24000);
			expect(metrics.totalCallOI).toBe(100000);
			expect(metrics.totalPutOI).toBe(120000);
		});
	});

	describe("2. Client F&O Segment Kill-Switch (SEBI Voluntary Halt)", () => {
		const testUserId = "test-trader-upstox-fno";

		it("defaults to inactive state for a new client", () => {
			const status = derivativesService.getUserKillSwitch(testUserId);
			expect(status.active).toBe(false);
			expect(status.segment).toBe("FO");
		});

		it("locks F&O segment with 12-hour cooling-off lock period upon activation", () => {
			const updated = derivativesService.setUserKillSwitch(
				testUserId,
				true,
				"Trader emotional fatigue lock",
			);
			expect(updated.active).toBe(true);
			expect(updated.activatedAt).toBeDefined();
			expect(updated.lockUntil).toBeDefined();

			const lockTime = new Date(updated.lockUntil!).getTime();
			const now = Date.now();
			// Should be locked ~12 hours in future (at least 11.9 hours)
			expect(lockTime - now).toBeGreaterThan(11.8 * 60 * 60 * 1000);

			// Retrieve and check persistence
			const current = derivativesService.getUserKillSwitch(testUserId);
			expect(current.active).toBe(true);
		});

		it("allows unlocking when deactivated by client", () => {
			const unlocked = derivativesService.setUserKillSwitch(testUserId, false);
			expect(unlocked.active).toBe(false);
			expect(unlocked.lockUntil).toBeUndefined();

			const current = derivativesService.getUserKillSwitch(testUserId);
			expect(current.active).toBe(false);
		});
	});
});
