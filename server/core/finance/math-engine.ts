/**
 * FintekPro Tier-1 Financial Numerical Precision Engine
 *
 * Mandate: Eliminates IEEE 754 binary floating-point drift across Indian capital market calculations.
 * Precision: 28 significant digits with Banker's Rounding (ROUND_HALF_EVEN).
 * Regulatory: Adheres to SEBI, BSE, NSE, and Indian Stamp Act / STT precision requirements.
 */

import Decimal from "decimal.js";

// Configure institutional numerical environment
Decimal.set({
	precision: 28,
	rounding: Decimal.ROUND_HALF_EVEN, // Banker's rounding reduces cumulative bias
	toExpNeg: -12,
	toExpPos: 28,
});

export { Decimal };

export class FinancialMath {
	/** Convert input to Decimal safely */
	static d(value: string | number | Decimal): Decimal {
		if (value instanceof Decimal) return value;
		if (typeof value === "number") {
			// Protect against float serialization artifacts by using string
			return new Decimal(value.toString());
		}
		return new Decimal(value || "0");
	}

	/** Exact addition */
	static add(...values: Array<string | number | Decimal>): Decimal {
		return values.reduce<Decimal>(
			(acc, v) => acc.plus(FinancialMath.d(v)),
			new Decimal(0),
		);
	}

	/** Exact subtraction: a - b */
	static sub(a: string | number | Decimal, b: string | number | Decimal): Decimal {
		return FinancialMath.d(a).minus(FinancialMath.d(b));
	}

	/** Exact multiplication: a * b */
	static mul(a: string | number | Decimal, b: string | number | Decimal): Decimal {
		return FinancialMath.d(a).times(FinancialMath.d(b));
	}

	/** Exact division: a / b */
	static div(a: string | number | Decimal, b: string | number | Decimal): Decimal {
		const denom = FinancialMath.d(b);
		if (denom.isZero()) throw new Error("FinancialMath: Division by zero");
		return FinancialMath.d(a).dividedBy(denom);
	}

	/** Convert Rupee amount to Paisa (integer subunit for zero-drift ledger storage) */
	static toPaisa(rupees: string | number | Decimal): number {
		return FinancialMath.d(rupees).times(100).round().toNumber();
	}

	/** Convert Paisa back to Rupee Decimal */
	static fromPaisa(paisa: number | string): Decimal {
		return FinancialMath.d(paisa).dividedBy(100);
	}

	/**
	 * Compute Securities Transaction Tax (STT) for Indian Equity / Commodity
	 * Equity Delivery: 0.1% on buy & sell (10 bps = 0.001)
	 * Equity Intraday: 0.025% on sell (2.5 bps = 0.00025)
	 * Futures: 0.02% on sell (2 bps = 0.0002)
	 * Options: 0.1% on sell premium (10 bps = 0.001)
	 */
	static calculateSTT(
		turnover: string | number | Decimal,
		rateBps: number,
	): Decimal {
		const rate = new Decimal(rateBps).dividedBy(10000);
		// Indian STT rounds to the nearest whole rupee (round half up or even per exchange rules)
		return FinancialMath.d(turnover).times(rate).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
	}

	/**
	 * Compute Stamp Duty under Indian Stamp Act (Uniform Schedule from July 1, 2020)
	 * Equity Delivery Buy: 0.015% (15 bps)
	 * Equity Intraday Buy: 0.003% (3 bps)
	 * Futures: 0.002% (2 bps)
	 * Options: 0.003% (3 bps)
	 */
	static calculateStampDuty(
		turnover: string | number | Decimal,
		rateBps: number,
	): Decimal {
		const rate = new Decimal(rateBps).dividedBy(10000);
		return FinancialMath.d(turnover).times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
	}

	/**
	 * Compound Annual Growth Rate (CAGR)
	 * CAGR = (EndValue / StartValue) ^ (1 / Years) - 1
	 */
	static calculateCAGR(
		startValue: string | number | Decimal,
		endValue: string | number | Decimal,
		years: string | number | Decimal,
	): Decimal {
		const s = FinancialMath.d(startValue);
		const e = FinancialMath.d(endValue);
		const y = FinancialMath.d(years);

		if (s.isZero() || y.isZero() || s.isNegative()) {
			return new Decimal(0);
		}

		// (e / s) ^ (1 / y) - 1
		const ratio = e.dividedBy(s);
		const exponent = new Decimal(1).dividedBy(y);
		const cagr = Decimal.pow(ratio, exponent).minus(1);
		return cagr.toDecimalPlaces(6, Decimal.ROUND_HALF_EVEN);
	}

	/**
	 * Percentage Change
	 * (current - previous) / previous * 100
	 */
	static calculatePercentageChange(
		current: string | number | Decimal,
		previous: string | number | Decimal,
	): Decimal {
		const c = FinancialMath.d(current);
		const p = FinancialMath.d(previous);
		if (p.isZero()) return new Decimal(0);
		return c.minus(p).dividedBy(p).times(100).toDecimalPlaces(4, Decimal.ROUND_HALF_EVEN);
	}

	/**
	 * Format INR currency with standard Indian numbering system (Lakhs & Crores)
	 */
	static formatINR(value: string | number | Decimal, decimalPlaces = 2): string {
		const d = FinancialMath.d(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_EVEN);
		const parts = d.toFixed(decimalPlaces).split(".");
		const integerPart = parts[0];
		const decimalPart = parts[1];

		// Indian format: last 3 digits, then groups of 2
		const isNegative = integerPart.startsWith("-");
		const cleanInt = isNegative ? integerPart.slice(1) : integerPart;

		let formatted = "";
		if (cleanInt.length <= 3) {
			formatted = cleanInt;
		} else {
			const lastThree = cleanInt.slice(-3);
			const remaining = cleanInt.slice(0, -3);
			const formattedRemaining = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
			formatted = `${formattedRemaining},${lastThree}`;
		}

		const sign = isNegative ? "-" : "";
		return decimalPlaces > 0 ? `₹${sign}${formatted}.${decimalPart}` : `₹${sign}${formatted}`;
	}
}
