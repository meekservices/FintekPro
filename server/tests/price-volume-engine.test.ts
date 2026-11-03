/**
 * Unit Tests: Institutional Price Volume Action (PVA) Engine (GCR v1.0 + FASP-AI v1.0)
 *
 * Test cases:
 *  1. Institutional Accumulation (Price Up + Surge Volume + High Close)
 *  2. Institutional Distribution (Price Down + Surge Volume + Low Close)
 *  3. Absorption / Low-Volume Pullback (Healthy Consolidation)
 *  4. Exhaustion Rally (Price Up on Low/Drying Volume)
 *  5. Volume Climax Reversal (Rejection Wick + Ultra Volume)
 *  6. Delivery Volume Conviction Boost
 *  7. Insufficient Bars Fallback (< 5 bars)
 *  8. Determinism: Same inputs ALWAYS produce identical outputs
 *  9. Metadata compliance: engine_version and calculation_timestamp present
 */

import { describe, it, expect } from "vitest";
import {
	analyzePriceVolumeAction,
	PVA_ENGINE_VERSION,
	type PvaBarInput,
} from "../services/quant/price-volume-engine";

function generateBaselineBars(count: number = 25, basePrice: number = 1000, baseVolume: number = 100000): PvaBarInput[] {
	const bars: PvaBarInput[] = [];
	let price = basePrice;
	for (let i = 0; i < count; i++) {
		const change = ((i % 3) - 1) * 2; // subtle price variation
		price += change;
		bars.push({
			open: price - 1,
			high: price + 4,
			low: price - 4,
			close: price,
			volume: baseVolume + (i % 5) * 5000,
			deliveryPct: 40,
			timestamp: `2026-10-${String(i + 1).padStart(2, "0")}`,
		});
	}
	return bars;
}

describe("Price Volume Action (PVA) Engine", () => {
	it("verifies engine_version and calculation_timestamp contract", () => {
		const bars = generateBaselineBars(20);
		const result = analyzePriceVolumeAction("TCS", bars, "2026-11-03T10:00:00Z");

		expect(result.engine_version).toBe(PVA_ENGINE_VERSION);
		expect(result.calculation_timestamp).toBe("2026-11-03T10:00:00Z");
		expect(result.formula_applied).toBeDefined();
		expect(result.intermediate_steps).toBeDefined();
		expect(result.intermediate_steps.confidenceScore).toBeGreaterThan(0);
	});

	it("detects Institutional Accumulation on high volume breakout closing near highs", () => {
		const bars = generateBaselineBars(22);
		// Add breakout bar: +2.5% price gain, 2.5x volume surge, closing at 90% of range
		const prevClose = bars[bars.length - 1].close;
		bars.push({
			open: prevClose + 5,
			high: prevClose + 30,
			low: prevClose + 2,
			close: prevClose + 28, // close near high (28 / 30 = 93%)
			volume: 250000,        // 2.5x 100k avg
			deliveryPct: 60,       // high delivery
		});

		const result = analyzePriceVolumeAction("RELIANCE", bars);

		expect(result.classification).toBe("INSTITUTIONAL_ACCUMULATION");
		expect(result.pvaScore).toBeGreaterThanOrEqual(75);
		expect(result.quantBoostFactor).toBeGreaterThanOrEqual(1.15);
		expect(result.conviction).toBe("VERY_HIGH");
		expect(result.metrics.deliveryConviction).toBe("HIGH_DELIVERY");
		expect(result.explanation).toContain("Institutional Accumulation");
	});

	it("detects Institutional Distribution on high volume breakdown closing near lows", () => {
		const bars = generateBaselineBars(22);
		const prevClose = bars[bars.length - 1].close;
		bars.push({
			open: prevClose - 5,
			high: prevClose - 2,
			low: prevClose - 35,
			close: prevClose - 33, // close near low
			volume: 240000,        // heavy volume
			deliveryPct: 45,
		});

		const result = analyzePriceVolumeAction("HDFCBANK", bars);

		expect(result.classification).toBe("INSTITUTIONAL_DISTRIBUTION");
		expect(result.pvaScore).toBeLessThanOrEqual(30);
		expect(result.quantBoostFactor).toBeLessThanOrEqual(0.85);
		expect(result.conviction).toBe("BEARISH_ALERT");
		expect(result.explanation).toContain("Institutional Distribution");
	});

	it("detects Absorption / Low-Volume Pullback (Healthy consolidation)", () => {
		const bars = generateBaselineBars(22);
		const prevClose = bars[bars.length - 1].close;
		bars.push({
			open: prevClose - 2,
			high: prevClose + 1,
			low: prevClose - 8,
			close: prevClose - 5, // -0.5% mild pullback
			volume: 45000,        // < 0.5x average (dry volume)
			deliveryPct: 40,
		});

		const result = analyzePriceVolumeAction("INFY", bars);

		expect(result.classification).toBe("ABSORPTION_PULLBACK");
		expect(result.pvaScore).toBeGreaterThanOrEqual(65);
		expect(result.quantBoostFactor).toBeGreaterThanOrEqual(1.05);
		expect(result.conviction).toBe("HIGH");
		expect(result.explanation).toContain("Low-Volume Pullback");
	});

	it("detects Exhaustion Rally when price rises on drying volume (retail trap)", () => {
		const bars = generateBaselineBars(22);
		const prevClose = bars[bars.length - 1].close;
		bars.push({
			open: prevClose + 2,
			high: prevClose + 15,
			low: prevClose + 1,
			close: prevClose + 12, // +1.2% rally
			volume: 50000,         // 0.5x average volume (drying)
			deliveryPct: 30,
		});

		const result = analyzePriceVolumeAction("TATAMOTORS", bars);

		expect(result.classification).toBe("EXHAUSTION_RALLY");
		expect(result.pvaScore).toBeLessThan(50);
		expect(result.quantBoostFactor).toBeLessThan(1.0);
		expect(result.explanation).toContain("Exhaustion Rally");
	});

	it("detects Volume Climax Reversal on ultra volume with upper wick rejection", () => {
		const bars = generateBaselineBars(22);
		const prevClose = bars[bars.length - 1].close;
		bars.push({
			open: prevClose + 5,
			high: prevClose + 60, // spiked huge
			low: prevClose - 2,
			close: prevClose + 8, // collapsed back down to lower 16% of candle range
			volume: 350000,       // 3.5x massive volume
			deliveryPct: 20,
		});

		const result = analyzePriceVolumeAction("ADANIENT", bars);

		expect(result.classification).toBe("VOLUME_CLIMAX_REVERSAL");
		expect(result.conviction).toBe("BEARISH_ALERT");
		expect(result.quantBoostFactor).toBeLessThan(0.9);
	});

	it("handles insufficient bars gracefully with safe fallback defaults", () => {
		const result = analyzePriceVolumeAction("NEWIPO", [
			{ high: 105, low: 95, close: 100, volume: 1000 },
			{ high: 108, low: 99, close: 104, volume: 1200 },
		]);

		expect(result.classification).toBe("NEUTRAL_CONSOLIDATION");
		expect(result.pvaScore).toBe(50);
		expect(result.quantBoostFactor).toBe(1.0);
		expect(result.conviction).toBe("LOW");
	});

	it("guarantees absolute determinism (identical input produces exact identical output)", () => {
		const bars = generateBaselineBars(25);
		const run1 = analyzePriceVolumeAction("ICICIBANK", bars, "2026-11-03T12:00:00Z");
		const run2 = analyzePriceVolumeAction("ICICIBANK", bars, "2026-11-03T12:00:00Z");

		expect(run1).toEqual(run2);
	});
});

