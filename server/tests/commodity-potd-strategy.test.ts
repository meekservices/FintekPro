/**
 * @file commodity-potd-strategy.test.ts
 * @description Unit tests for institutional MCX & NCDEX Commodity Strategy in POTD Engine.
 */

import { describe, it, expect } from "vitest";
import {
	CommodityStrategy,
	type NormalizedCommodityCandidate,
} from "../services/picks/commodity-strategy";
import { pickOfTheDayService } from "../services/pick-of-the-day-service";

describe("Institutional Commodity Strategy (MCX & NCDEX) in POTD Engine", () => {
	const strategy = new CommodityStrategy();

	describe("1. Registration in POTD Engine", () => {
		it("registers 'commodities' as a valid strategy in pickOfTheDayService", () => {
			const registered = (pickOfTheDayService as any).getStrategy("commodities");
			expect(registered).toBeDefined();
			expect(registered.category).toBe("commodities");
		});
	});

	describe("2. Institutional Quantitative Scoring Model", () => {
		it("awards higher score to Bullish trending commodities with healthy momentum (+0.5% to +2.0%)", () => {
			const bullishGold: NormalizedCommodityCandidate = {
				id: "MCX_GOLD",
				symbol: "GOLD",
				name: "Gold 24K (MCX Standard)",
				exchange: "MCX",
				price: 78500,
				unit: "₹ / 10g",
				changePercent: 0.85,
				trend: "Bullish",
				sectorCategory: "Commodities - Precious Metals",
				deliveryCenter: "Ahmedabad",
			};

			const score = strategy.score(bullishGold);
			expect(score).toBeGreaterThanOrEqual(75);
			expect(score).toBeLessThanOrEqual(95);
		});

		it("penalizes Bearish trending commodities under heavy distribution (< -1.5%)", () => {
			const weakCrude: NormalizedCommodityCandidate = {
				id: "MCX_CRUDE_OIL",
				symbol: "CRUDE_OIL",
				name: "Crude Oil (MCX Benchmark)",
				exchange: "MCX",
				price: 5800,
				unit: "₹ / bbl",
				changePercent: -2.4,
				trend: "Bearish",
				sectorCategory: "Commodities - Energy",
			};

			const score = strategy.score(weakCrude);
			expect(score).toBeLessThan(55);
		});

		it("evaluates NCDEX agricultural commodities with mandi basis and supply-demand tightness", () => {
			const bullishJeera: NormalizedCommodityCandidate = {
				id: "NCDEX_JEERA",
				symbol: "JEERA",
				name: "Jeera Cumin Seed (NCDEX Unjha)",
				exchange: "NCDEX",
				price: 24500,
				unit: "₹ / quintal",
				changePercent: 1.2,
				trend: "Bullish",
				sectorCategory: "Commodities - Agriculture (Spices)",
				deliveryCenter: "Unjha Mandi",
				macroImplication: "Lower arrival volumes in Unjha market supporting spot basis",
			};

			const score = strategy.score(bullishJeera);
			expect(score).toBeGreaterThanOrEqual(75);
		});
	});

	describe("3. Strict 2:1 Risk-to-Reward (R:R) Enforcement", () => {
		it("guarantees target distance is at least 2.0x stop-loss distance across all commodity groups", async () => {
			const mockContext: any = {
				today: new Date().toISOString().split("T")[0],
				regime: "NEUTRAL",
				recentIds: new Set<string>(),
				service: {
					generateRationale: async (p: any) =>
						`${p.name} selected with expected target of ${p.targetPrice} and SL ${p.stoplossPrice}.`,
				},
			};

			const pick = await strategy.generate(mockContext);
			expect(pick).toBeDefined();

			if (pick) {
				const recoP = pick.recoPrice;
				const targetP = pick.targetPrice;
				const slP = pick.stoplossPrice;

				// Boundary Invariant: Stoploss < Reco Price < Target Price
				expect(slP).toBeLessThan(recoP);
				expect(recoP).toBeLessThan(targetP);

				const targetDist = targetP - recoP;
				const slDist = recoP - slP;
				const rrRatio = targetDist / slDist;

				// Strict 2:1 R:R check
				expect(rrRatio).toBeGreaterThanOrEqual(1.99);

				// SEBI Segment & Risk check
				expect(pick.category).toBe("commodities");
				expect(pick.riskLevel).toBe("high");
				expect(pick.timeHorizon).toBe("short_term");
				expect(["MCX", "NCDEX"]).toContain(pick.exchange);
				expect(pick.confidenceScore).toBeGreaterThanOrEqual(55);
			}
		});
	});

	describe("4. Live Price Resolution", () => {
		it("resolves live or benchmark prices for MCX Gold", async () => {
			const price = await strategy.getLivePrice("MCX_GOLD");
			expect(price).toBeDefined();
			expect(typeof price).toBe("number");
			expect(price!).toBeGreaterThan(0);
		});

		it("resolves live or benchmark prices for NCDEX Jeera", async () => {
			const price = await strategy.getLivePrice("NCDEX_JEERA");
			expect(price).toBeDefined();
			expect(typeof price).toBe("number");
			expect(price!).toBeGreaterThan(0);
		});
	});
});
