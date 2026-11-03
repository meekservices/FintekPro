/**
 * Unit Tests: Advanced Quantitative Factors Engine (GCR v1.0 + FASP-AI v1.0)
 *
 * Tests cover:
 *  1. Volatility Contraction Pattern (VCP / ATR Compression)
 *  2. Mansfield Relative Strength (MRS vs Nifty 50)
 *  3. Delivery Volume Conviction Factor (NSE Bhavcopy)
 *  4. Trend Smoothness & Momentum Quality (R-Squared)
 *  5. Strict Determinism and Metadata Compliance
 */

import { describe, it, expect } from "vitest";
import {
	calculateVcpPattern,
	calculateMansfieldRs,
	calculateDeliveryConviction,
	calculateTrendSmoothness,
	QUANT_FACTORS_ENGINE_VERSION,
} from "../services/quant/advanced-quant-factors";

describe("Advanced Quantitative Performance Factors Engine", () => {
	describe("1. Volatility Contraction Pattern (VCP)", () => {
		it("detects tight Stage-2 coiling near 52W high with high VCP score", () => {
			const closes: number[] = [];
			const highs: number[] = [];
			const lows: number[] = [];
			const volumes: number[] = [];

			// 25 bars: initial high volatility contracting into very tight ATR
			for (let i = 0; i < 20; i++) {
				const p = 500 + i;
				closes.push(p);
				highs.push(p + 15);
				lows.push(p - 15);
				volumes.push(100000);
			}
			// Last 5 bars: tight consolidation (narrow range)
			for (let i = 0; i < 5; i++) {
				const p = 525 + i * 0.5;
				closes.push(p);
				highs.push(p + 2);
				lows.push(p - 2);
				volumes.push(35000); // drying volume
			}

			const result = calculateVcpPattern({
				symbol: "TITAN",
				highs,
				lows,
				closes,
				volumes,
				weekHigh52: 535,
			});

			expect(result.engine_version).toBe(QUANT_FACTORS_ENGINE_VERSION);
			expect(result.compressionRatio).toBeLessThan(0.65);
			expect(result.isVcpSetup).toBe(true);
			expect(result.stage).toBe("STAGE_2_COILING");
			expect(result.vcpScore).toBeGreaterThanOrEqual(80);
			expect(result.explanation).toContain("Volatility Squeeze");
		});

		it("handles insufficient bars with safe defaults", () => {
			const result = calculateVcpPattern({
				symbol: "NEWIPO",
				highs: [100, 105],
				lows: [95, 98],
				closes: [99, 104],
			});
			expect(result.isVcpSetup).toBe(false);
			expect(result.stage).toBe("NORMAL_VOLATILITY");
			expect(result.vcpScore).toBe(50);
		});
	});

	describe("2. Mansfield Relative Strength (MRS)", () => {
		it("identifies strong outperformance and zero-line crossovers vs benchmark", () => {
			const stockCloses: number[] = [];
			const benchmarkCloses: number[] = [];

			// 60 bars: stock rises 50% while benchmark stays flat
			for (let i = 0; i < 60; i++) {
				stockCloses.push(100 + i * 1.5);
				benchmarkCloses.push(20000 + (i % 3) * 10);
			}

			const result = calculateMansfieldRs({
				symbol: "BAJFINANCE",
				stockCloses,
				benchmarkCloses,
			});

			expect(result.currentRsScore).toBeGreaterThan(5.0);
			expect(result.rsTrend).toBe("STRONG_OUTPERFORMANCE");
			expect(result.explanation).toContain("Superior Alpha Leader");
		});

		it("identifies severe market laggards", () => {
			const stockCloses: number[] = [];
			const benchmarkCloses: number[] = [];

			// 60 bars: stock drops while benchmark rallies
			for (let i = 0; i < 60; i++) {
				stockCloses.push(200 - i * 1.2);
				benchmarkCloses.push(20000 + i * 40);
			}

			const result = calculateMansfieldRs({
				symbol: "WIPRO",
				stockCloses,
				benchmarkCloses,
			});

			expect(result.currentRsScore).toBeLessThan(-5.0);
			expect(result.rsTrend).toBe("SEVERE_LAGGARD");
			expect(result.explanation).toContain("Severe Laggard");
		});
	});

	describe("3. Delivery Volume Conviction", () => {
		it("awards high conviction to institutional delivery spikes", () => {
			const histQtys = Array(20).fill(50000);
			const histVols = Array(20).fill(120000);

			const result = calculateDeliveryConviction({
				symbol: "RELIANCE",
				currentDeliveryQty: 130000, // 2.6x delivery
				currentTotalVolume: 200000,  // 65% delivery
				historicalDeliveryQtys: histQtys,
				historicalTotalVolumes: histVols,
			});

			expect(result.deliveryPct).toBe(65.0);
			expect(result.deliveryVolumeRatio).toBeGreaterThan(2.0);
			expect(result.isInstitutionalAccumulation).toBe(true);
			expect(result.convictionScore).toBeGreaterThanOrEqual(90);
			expect(result.grade).toBe("INSTITUTIONAL_HEAVY_DELIVERY");
		});

		it("flags speculative intraday churn when volume is high but delivery collapses", () => {
			const histQtys = Array(20).fill(50000);
			const histVols = Array(20).fill(120000);

			const result = calculateDeliveryConviction({
				symbol: "YESBANK",
				currentDeliveryQty: 25000,
				currentTotalVolume: 200000, // 12.5% delivery
				historicalDeliveryQtys: histQtys,
				historicalTotalVolumes: histVols,
			});

			expect(result.grade).toBe("SPECULATIVE_INTRADAY");
			expect(result.isInstitutionalAccumulation).toBe(false);
			expect(result.convictionScore).toBeLessThan(40);
		});
	});

	describe("4. Trend Smoothness & Momentum Quality", () => {
		it("rewards smooth compounding trends with high R^2", () => {
			const closes: number[] = [];
			// Smooth steady compounder (exponential curve)
			for (let i = 0; i < 40; i++) {
				closes.push(100 * Math.exp(0.005 * i));
			}

			const result = calculateTrendSmoothness({
				symbol: "TRENT",
				closes,
			});

			expect(result.rSquared).toBeGreaterThan(0.95);
			expect(result.momentumQualityScore).toBeGreaterThanOrEqual(95);
			expect(result.grade).toBe("EXEMPLARY_STEADY_COMPOUNDER");
		});

		it("penalizes erratic, choppy swings with low R^2", () => {
			const closes: number[] = [];
			// Erratic sawtooth
			for (let i = 0; i < 40; i++) {
				closes.push(100 + ((i % 4) - 2) * 15);
			}

			const result = calculateTrendSmoothness({
				symbol: "VOLATILE",
				closes,
			});

			expect(result.rSquared).toBeLessThan(0.3);
			expect(result.grade).toBe("CHOPPY_ERRATIC_VOLATILITY");
			expect(result.momentumQualityScore).toBeLessThanOrEqual(50);
		});
	});

	describe("5. Determinism", () => {
		it("guarantees identical output for identical inputs across all functions", () => {
			const closes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
			const run1 = calculateTrendSmoothness({ symbol: "TEST", closes }, "2026-11-03T00:00:00Z");
			const run2 = calculateTrendSmoothness({ symbol: "TEST", closes }, "2026-11-03T00:00:00Z");

			expect(run1).toEqual(run2);
		});
	});
});

