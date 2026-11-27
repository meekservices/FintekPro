import { describe, it, expect } from "vitest";
import {
	TickArbitrationEngine,
	MarketTick,
} from "../services/tick-arbitration-service";

describe("TickArbitrationEngine (SEBI Institutional Market Data)", () => {
	const engine = new TickArbitrationEngine({
		maxDeviationPct: 10.0,
		maxStalenessMs: 60000,
	});

	const now = Date.now();

	it("validates a healthy tick within normal parameters", () => {
		const tick: MarketTick = {
			symbol: "TCS",
			price: 3500,
			bid: 3499.5,
			ask: 3500.5,
			volume: 50000,
			timestamp: now - 5000,
			source: "UPSTOX",
		};

		const res = engine.validateTick(tick, 3480, now);
		expect(res.isValid).toBe(true);
		expect(res.deviationPct).toBeLessThan(1.0);
	});

	it("rejects an outlier tick deviating beyond threshold", () => {
		const outlierTick: MarketTick = {
			symbol: "TCS",
			price: 4000, // +14.2% deviation from 3500
			bid: 3990,
			ask: 4010,
			timestamp: now - 2000,
			source: "ANGEL_ONE",
		};

		const res = engine.validateTick(outlierTick, 3500, now);
		expect(res.isValid).toBe(false);
		expect(res.reason).toContain("OUTLIER_DEVIATION");
	});

	it("rejects a stale tick exceeding staleness timeout", () => {
		const staleTick: MarketTick = {
			symbol: "INFY",
			price: 1500,
			timestamp: now - 90000, // 90 seconds old, limit is 60s
			source: "UPSTOX",
		};

		const res = engine.validateTick(staleTick, 1500, now);
		expect(res.isValid).toBe(false);
		expect(res.reason).toContain("STALE_TICK");
	});

	it("arbitrates between Upstox and Angel One based on freshness and spread", () => {
		const upstoxTick: MarketTick = {
			symbol: "RELIANCE",
			price: 2500,
			bid: 2499,
			ask: 2501,
			timestamp: now - 3000,
			source: "UPSTOX",
		};

		const angelTick: MarketTick = {
			symbol: "RELIANCE",
			price: 2500.5,
			bid: 2500,
			ask: 2501,
			timestamp: now - 500, // Much fresher!
			source: "ANGEL_ONE",
		};

		const arbitrated = engine.arbitrate([upstoxTick, angelTick], 2500, now);
		expect(arbitrated.isOutlier).toBe(false);
		expect(arbitrated.source).toBe("ANGEL_ONE");
		expect(arbitrated.price).toBe(2500.5);
		expect(arbitrated.confidenceScore).toBeGreaterThanOrEqual(0.8);
	});

	it("discards outlier candidate and selects valid peer", () => {
		const normalTick: MarketTick = {
			symbol: "SBIN",
			price: 600,
			bid: 599.8,
			ask: 600.2,
			timestamp: now - 2000,
			source: "UPSTOX",
		};

		const corruptSpikeTick: MarketTick = {
			symbol: "SBIN",
			price: 800, // 33% spike glitch
			timestamp: now - 1000,
			source: "ANGEL_ONE",
		};

		const arbitrated = engine.arbitrate([normalTick, corruptSpikeTick], 600, now);
		expect(arbitrated.isOutlier).toBe(false);
		expect(arbitrated.source).toBe("UPSTOX");
		expect(arbitrated.price).toBe(600);
	});
});
