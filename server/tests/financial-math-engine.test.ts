import { describe, expect, it } from "vitest";
import { FinancialMath, Decimal } from "../core/finance/math-engine";

describe("FinancialMath Precision Engine (Institutional Grade)", () => {
	it("eliminates binary floating-point drift (0.1 + 0.2 === 0.3)", () => {
		// Native JS float fails this: 0.1 + 0.2 = 0.30000000000000004
		const nativeSum = 0.1 + 0.2;
		expect(nativeSum).not.toBe(0.3);

		// FinancialMath succeeds
		const decimalSum = FinancialMath.add(0.1, 0.2);
		expect(decimalSum.toString()).toBe("0.3");
		expect(decimalSum.equals(new Decimal("0.3"))).toBe(true);
	});

	it("converts Rupee amounts to Paisa integers without rounding loss", () => {
		expect(FinancialMath.toPaisa("124870.50")).toBe(12487050);
		expect(FinancialMath.toPaisa(78250.25)).toBe(7825025);
		expect(FinancialMath.fromPaisa(7825025).toString()).toBe("78250.25");
	});

	it("computes STT with Indian exchange rounding rules (nearest rupee)", () => {
		// Turnover: ₹10,00,000 Equity Delivery Buy @ 10 bps (0.1%)
		// STT = ₹1,000
		const stt = FinancialMath.calculateSTT(1000000, 10);
		expect(stt.toString()).toBe("1000");

		// Turnover: ₹1,23,456 Equity Intraday Sell @ 2.5 bps (0.025%)
		// 123456 * 0.00025 = 30.864 -> rounds to ₹31
		const intradayStt = FinancialMath.calculateSTT(123456, 2.5);
		expect(intradayStt.toString()).toBe("31");
	});

	it("computes Stamp Duty according to Indian Stamp Act uniform schedule", () => {
		// Equity Delivery Buy: 1.5 bps (0.015%) on ₹5,00,000 turnover
		// Stamp duty = 500000 * 0.00015 = 75.00
		const stampDuty = FinancialMath.calculateStampDuty(500000, 1.5);
		expect(stampDuty.toString()).toBe("75");
	});

	it("computes CAGR accurately across multi-year holding periods", () => {
		// ₹1,00,000 growing to ₹2,00,000 in 3 years
		// CAGR = (200000 / 100000) ^ (1/3) - 1 ≈ 25.9921%
		const cagr = FinancialMath.calculateCAGR(100000, 200000, 3);
		expect(cagr.times(100).toDecimalPlaces(2).toString()).toBe("25.99");
	});

	it("formats INR currency in standard Indian numbering (Lakhs and Crores)", () => {
		expect(FinancialMath.formatINR("1234567.89")).toBe("₹12,34,567.89");
		expect(FinancialMath.formatINR(78250)).toBe("₹78,250.00");
		expect(FinancialMath.formatINR("100000000")).toBe("₹10,00,00,000.00");
		expect(FinancialMath.formatINR("-54321.50")).toBe("₹-54,321.50");
	});
});
