/**
 * @file alpha-picks-infrastructure.test.ts
 * @description Unit tests for institutional Alpha Picks infrastructure.
 */

import { describe, it, expect } from "vitest";
import { commoditySectorTransmissionEngine } from "../services/picks/commodity-sector-transmission";
import { smartMoneySurveillanceService } from "../services/picks/smart-money-surveillance-service";
import { volatilityPositionSizingEngine } from "../services/picks/volatility-position-sizing";

describe("Cross-Asset Commodity & Sector Transmission Engine", () => {
	it("boosts crude-sensitive sectors (Paints, Tyres) when Brent is below $75/bbl", () => {
		const paintImpact = commoditySectorTransmissionEngine.evaluateSectorImpact("Paints & Varnishes", {
			brentUsd: 72.50,
		});
		expect(paintImpact.scoreDelta).toBe(10);
		expect(paintImpact.tailwindType).toBe("STRONG_TAILWIND");

		const tyreImpact = commoditySectorTransmissionEngine.evaluateSectorImpact("Tyres & Rubber", {
			brentUsd: 71.00,
		});
		expect(tyreImpact.scoreDelta).toBe(10);
	});

	it("penalizes crude-sensitive sectors when Brent surges above $85/bbl", () => {
		const impact = commoditySectorTransmissionEngine.evaluateSectorImpact("Paints", {
			brentUsd: 88.00,
		});
		expect(impact.scoreDelta).toBe(-10);
		expect(impact.tailwindType).toBe("SEVERE_HEADWIND");
	});

	it("boosts upstream oil exploration when Brent is high (> $80/bbl)", () => {
		const impact = commoditySectorTransmissionEngine.evaluateSectorImpact("Oil & Gas Exploration", {
			brentUsd: 84.00,
		});
		expect(impact.scoreDelta).toBe(8);
		expect(impact.tailwindType).toBe("STRONG_TAILWIND");
	});

	it("boosts jewellery and bullion finance when MCX gold is elevated (>= 75,000)", () => {
		const impact = commoditySectorTransmissionEngine.evaluateSectorImpact("Gems & Jewellery", {
			goldMcxInr: 78250,
		});
		expect(impact.scoreDelta).toBe(8);
		expect(impact.tailwindType).toBe("STRONG_TAILWIND");
	});

	it("boosts power capex & cables when domestic copper is firm", () => {
		const impact = commoditySectorTransmissionEngine.evaluateSectorImpact("Wires & Cables", {
			copperMcxInr: 825.50,
		});
		expect(impact.scoreDelta).toBe(8);
	});

	it("boosts FMCG when agricultural commodity inflation is benign", () => {
		const impact = commoditySectorTransmissionEngine.evaluateSectorImpact("Consumer FMCG", {
			agriInflationStatus: "Benign",
		});
		expect(impact.scoreDelta).toBe(8);
	});
});

describe("Smart Money & Institutional Accumulation Surveillance", () => {
	it("detects high-conviction institutional accumulation on high delivery ratio & holding", () => {
		const signal = smartMoneySurveillanceService.getSmartMoneySignal("RELIANCE", {
			fundamentals: { institutionalHolding: 42.5 },
			technicals: { deliveryPct: 68.5 },
		});
		expect(signal.scoreBoost).toBe(14);
		expect(signal.isAccumulated).toBe(true);
		expect(signal.convictionTier).toBe("HIGH_CONVICTION");
	});

	it("penalizes low delivery ratio counters (< 25%) as speculative turnover", () => {
		const signal = smartMoneySurveillanceService.getSmartMoneySignal("SPECULATIVE_STOCK", {
			fundamentals: { institutionalHolding: 10 },
			technicals: { deliveryPct: 18.0 },
		});
		expect(signal.scoreBoost).toBe(-6);
		expect(signal.convictionTier).toBe("NEUTRAL");
	});

	it("registers verified marquee bulk/block deal accumulation events", () => {
		smartMoneySurveillanceService.registerDeal("TCS", "SBI MUTUAL FUND A/C", "BUY");
		const signal = smartMoneySurveillanceService.getSmartMoneySignal("TCS");
		expect(signal.scoreBoost).toBe(12);
		expect(signal.primaryBuyerType).toBe("DOMESTIC_MUTUAL_FUND");
	});
});

describe("Institutional Volatility Position Sizing & Impact Cost Engine", () => {
	it("calculates conservative weight and low impact cost for liquid large caps", () => {
		const sizing = volatilityPositionSizingEngine.calculateSizing(
			"INFY",
			1800, // current price
			1720, // stop loss (~4.4% SL)
			2500000, // 2.5M shares ADV (High liquidity)
			0.85, // beta
		);

		expect(sizing.recommendedWeightPct).toBeGreaterThanOrEqual(2.0);
		expect(sizing.recommendedWeightPct).toBeLessThanOrEqual(7.0);
		expect(sizing.liquidityTier).toBe("HIGHLY_LIQUID");
		expect(sizing.estimatedImpactCostBps).toBeLessThanOrEqual(10);
	});

	it("calculates disciplined smaller allocation and warns on illiquid counters", () => {
		const sizing = volatilityPositionSizingEngine.calculateSizing(
			"SMALLCAP_TIGHT",
			250,
			220, // 12% SL distance (volatile)
			5000, // only 5000 shares/day ADV (Illiquid)
			1.6, // high beta
		);

		expect(sizing.recommendedWeightPct).toBeLessThanOrEqual(3.5); // reduced sizing for volatile counter
		expect(sizing.riskBucket).toBe("AGGRESSIVE");
		expect(sizing.liquidityTier).toBe("ILLIQUID_CAUTION");
		expect(sizing.estimatedImpactCostBps).toBeGreaterThan(30);
	});
});
