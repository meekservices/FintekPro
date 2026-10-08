/**
 * Unit tests for Research Note Engine Returns:
 * 1. Unit normalization & corrupt data clamping (normalizeReturn in dataService.ts)
 * 2. Multi-period coverage: 1M, 3M, 6M, 1Y
 * 3. Frontend format verification (signPct logic)
 */

import { describe, it, expect } from "vitest";
import { normalizeReturn } from "../modules/research/dataService";

describe("Research Note Engine - Returns Normalization & Clamping", () => {
	it("normalizes listed_stocks percentage returns to decimal fractions", () => {
		// HDFC Bank real-world values from listed_stocks
		expect(normalizeReturn("2.06")).toBeCloseTo(0.0206, 4);
		expect(normalizeReturn(2.06)).toBeCloseTo(0.0206, 4);
		expect(normalizeReturn("-4.89")).toBeCloseTo(-0.0489, 4);
		expect(normalizeReturn(-4.89)).toBeCloseTo(-0.0489, 4);
	});

	it("preserves positive 1Y returns > 5% without falsely clamping to null", () => {
		// Crucial bug fix: previous code clamped Math.abs(n) > 5.0 to null,
		// wiping out all 1Y/multi-period returns with magnitude > 5%
		expect(normalizeReturn("15.2")).toBeCloseTo(0.152, 3);
		expect(normalizeReturn(15.2)).toBeCloseTo(0.152, 3);
		expect(normalizeReturn("42.5")).toBeCloseTo(0.425, 3);
		expect(normalizeReturn("-18.7")).toBeCloseTo(-0.187, 3);
		expect(normalizeReturn(125.0)).toBeCloseTo(1.25, 2);
	});

	it("clamps corrupt paise-unit price glitches (|return| > 500%) to null", () => {
		// Outlier guard: paise prices (e.g. ₹100 vs 100 paise) generating +5857%
		expect(normalizeReturn(5857)).toBeNull();
		expect(normalizeReturn("5857.0")).toBeNull();
		expect(normalizeReturn(-501)).toBeNull();
		expect(normalizeReturn(500)).toBeCloseTo(5.0, 2);
	});

	it("handles already-decimal fractions from Python without double-division", () => {
		// If Python returned return_1m as 0.0206
		expect(normalizeReturn(0.0206)).toBeCloseTo(0.0206, 4);
		expect(normalizeReturn(-0.0489)).toBeCloseTo(-0.0489, 4);
	});

	it("handles null, undefined, and non-numeric inputs safely", () => {
		expect(normalizeReturn(null)).toBeNull();
		expect(normalizeReturn(undefined)).toBeNull();
		expect(normalizeReturn("N/A")).toBeNull();
		expect(normalizeReturn("")).toBeNull();
		expect(normalizeReturn(Number.NaN)).toBeNull();
	});
});

describe("Research Note Frontend - signPct Formatter", () => {
	function signPct(val: number | null): string {
		if (val === null || val === undefined || Number.isNaN(val)) return "N/A";
		const pct = Math.abs(val) > 1.0 ? val : val * 100;
		const s = pct.toFixed(1);
		return pct >= 0 ? `+${s}%` : `${s}%`;
	}

	it("formats normalized decimal fractions into correct percentages", () => {
		expect(signPct(0.0206)).toBe("+2.1%");
		expect(signPct(-0.0489)).toBe("-4.9%");
		expect(signPct(0.152)).toBe("+15.2%");
		expect(signPct(-0.187)).toBe("-18.7%");
		expect(signPct(0)).toBe("+0.0%");
		expect(signPct(null)).toBe("N/A");
	});

	it("defensively handles pre-formatted percentages without multiplying by 100", () => {
		// Prevents the bug where 2.06 was multiplied to +206.0% and -4.89 to -489.0%
		expect(signPct(2.06)).toBe("+2.1%");
		expect(signPct(-4.89)).toBe("-4.9%");
		expect(signPct(15.2)).toBe("+15.2%");
		expect(signPct(-25.4)).toBe("-25.4%");
	});
});
