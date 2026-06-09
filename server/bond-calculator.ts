/**
 * Bond Calculator Utilities
 *
 * Financial calculations for bonds including:
 * - Yield to Maturity (YTM)
 * - Duration (Macaulay and Modified)
 * - Accrued Interest
 * - Bond Pricing
 * - Current Yield
 *
 * Python sidecar (scipy brentq) is used as primary engine for YTM, duration,
 * and convexity. Newton-Raphson is the fallback.
 */

import { callPython } from "./clients/python-client";

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
	const msPerDay = 1000 * 60 * 60 * 24;
	const diff = Math.abs(date2.getTime() - date1.getTime());
	return Math.floor(diff / msPerDay);
}

/**
 * Calculate accrued interest on a bond
 */
export function calculateAccruedInterest(params: {
	faceValue: number;
	couponRate: number; // Annual coupon rate as percentage
	lastCouponDate: Date;
	settlementDate: Date;
	frequency: "annual" | "semi_annual" | "quarterly" | "monthly";
}): number {
	const { faceValue, couponRate, lastCouponDate, settlementDate, frequency } =
		params;

	// Days per period
	const daysPerPeriod: Record<typeof frequency, number> = {
		annual: 365,
		semi_annual: 182.5,
		quarterly: 91.25,
		monthly: 30.42,
	};

	const daysSinceLastCoupon = daysBetween(lastCouponDate, settlementDate);
	const periodsPerYear: Record<typeof frequency, number> = {
		annual: 1,
		semi_annual: 2,
		quarterly: 4,
		monthly: 12,
	};

	const couponPerPeriod =
		(faceValue * (couponRate / 100)) / periodsPerYear[frequency];
	const accruedInterest =
		couponPerPeriod * (daysSinceLastCoupon / daysPerPeriod[frequency]);

	return Math.round(accruedInterest * 100) / 100;
}

const FREQ_MAP: Record<string, number> = {
	annual: 1,
	semi_annual: 2,
	quarterly: 4,
	monthly: 12,
};

/**
 * Shared Python bond analytics call — fetches all metrics in one round-trip.
 * Returns null when sidecar is unavailable.
 */
async function fetchPythonBondAnalytics(params: {
	faceValue: number;
	currentPrice?: number;
	ytm?: number;
	couponRate: number;
	yearsToMaturity: number;
	frequency: string;
}): Promise<{
	ytmPct: number;
	macaulayDuration: number;
	modifiedDuration: number;
	convexity: number;
} | null> {
	try {
		const payload: Record<string, number> = {
			faceValue: params.faceValue,
			couponRate: params.couponRate,
			yearsToMaturity: params.yearsToMaturity,
			frequency: FREQ_MAP[params.frequency] ?? 2,
		};
		if (params.currentPrice != null) payload.cleanPrice = params.currentPrice;
		if (params.ytm != null) payload.ytm = params.ytm;
		const r = await callPython<any>(
			"/api/fixed-income/bond-analytics",
			"POST",
			payload,
		);
		if (r && !r.error && r.ytmPct != null) {
			return {
				ytmPct: Number(r.ytmPct),
				macaulayDuration: Number(r.macaulayDuration),
				modifiedDuration: Number(r.modifiedDuration),
				convexity: Number(r.convexity),
			};
		}
	} catch {
		// sidecar unavailable
	}
	return null;
}

/**
 * Calculate Yield to Maturity (YTM).
 * Uses Python sidecar (scipy brentq) first; falls back to Newton-Raphson.
 */
export async function calculateYieldToMaturity(params: {
	faceValue: number;
	currentPrice: number;
	couponRate: number;
	yearsToMaturity: number;
	frequency: "annual" | "semi_annual" | "quarterly" | "monthly";
}): Promise<number> {
	const { faceValue, currentPrice, couponRate, yearsToMaturity, frequency } =
		params;

	const pyResult = await fetchPythonBondAnalytics({
		faceValue,
		currentPrice,
		couponRate,
		yearsToMaturity,
		frequency,
	});
	if (pyResult) return pyResult.ytmPct;

	// Newton-Raphson fallback
	const n = FREQ_MAP[frequency] ?? 2;
	const totalPeriods = yearsToMaturity * n;
	const couponPayment = (faceValue * (couponRate / 100)) / n;
	let ytm =
		(couponPayment * n + (faceValue - currentPrice) / yearsToMaturity) /
		currentPrice;

	for (let i = 0; i < 100; i++) {
		const ytmPerPeriod = ytm / n;
		let pv = 0;
		for (let t = 1; t <= totalPeriods; t++)
			pv += couponPayment / (1 + ytmPerPeriod) ** t;
		pv += faceValue / (1 + ytmPerPeriod) ** totalPeriods;
		let dpv = 0;
		for (let t = 1; t <= totalPeriods; t++)
			dpv += (-t * couponPayment) / (n * (1 + ytmPerPeriod) ** (t + 1));
		dpv +=
			(-totalPeriods * faceValue) /
			(n * (1 + ytmPerPeriod) ** (totalPeriods + 1));
		const newYtm = ytm - (pv - currentPrice) / dpv;
		if (Math.abs(newYtm - ytm) < 0.000001)
			return Math.round(newYtm * 10000) / 100;
		ytm = newYtm;
	}
	return Math.round(ytm * 10000) / 100;
}

/**
 * Calculate current yield of a bond
 */
export function calculateCurrentYield(params: {
	faceValue: number;
	currentPrice: number;
	couponRate: number; // Annual coupon rate as percentage
}): number {
	const { faceValue, currentPrice, couponRate } = params;
	const annualCoupon = faceValue * (couponRate / 100);
	const currentYield = (annualCoupon / currentPrice) * 100;

	return Math.round(currentYield * 100) / 100;
}

/**
 * Calculate Macaulay Duration.
 * Uses Python sidecar first; falls back to TS implementation.
 */
export async function calculateMacaulayDuration(params: {
	faceValue: number;
	couponRate: number;
	yieldToMaturity: number;
	yearsToMaturity: number;
	frequency: "annual" | "semi_annual" | "quarterly" | "monthly";
}): Promise<number> {
	const { faceValue, couponRate, yieldToMaturity, yearsToMaturity, frequency } =
		params;

	const pyResult = await fetchPythonBondAnalytics({
		faceValue,
		couponRate,
		ytm: yieldToMaturity,
		yearsToMaturity,
		frequency,
	});
	if (pyResult) return pyResult.macaulayDuration;

	// TS fallback
	const n = FREQ_MAP[frequency] ?? 2;
	const totalPeriods = yearsToMaturity * n;
	const couponPayment = (faceValue * (couponRate / 100)) / n;
	const ytmPerPeriod = yieldToMaturity / 100 / n;
	let pvCashFlows = 0,
		weightedPv = 0;
	for (let t = 1; t <= totalPeriods; t++) {
		const pv = couponPayment / (1 + ytmPerPeriod) ** t;
		pvCashFlows += pv;
		weightedPv += (t / n) * pv;
	}
	const pvFace = faceValue / (1 + ytmPerPeriod) ** totalPeriods;
	pvCashFlows += pvFace;
	weightedPv += (totalPeriods / n) * pvFace;
	return Math.round((weightedPv / pvCashFlows) * 1000) / 1000;
}

/**
 * Calculate Modified Duration.
 * Uses Python sidecar first; falls back to TS implementation.
 */
export async function calculateModifiedDuration(params: {
	macaulayDuration: number;
	yieldToMaturity: number;
	frequency: "annual" | "semi_annual" | "quarterly" | "monthly";
	faceValue?: number;
	couponRate?: number;
	yearsToMaturity?: number;
}): Promise<number> {
	const {
		macaulayDuration,
		yieldToMaturity,
		frequency,
		faceValue,
		couponRate,
		yearsToMaturity,
	} = params;

	if (faceValue != null && couponRate != null && yearsToMaturity != null) {
		const pyResult = await fetchPythonBondAnalytics({
			faceValue,
			couponRate,
			ytm: yieldToMaturity,
			yearsToMaturity,
			frequency,
		});
		if (pyResult) return pyResult.modifiedDuration;
	}

	// TS fallback
	const n = FREQ_MAP[frequency] ?? 2;
	return (
		Math.round((macaulayDuration / (1 + yieldToMaturity / 100 / n)) * 1000) /
		1000
	);
}

/**
 * Calculate bond price given yield
 */
export function calculateBondPrice(params: {
	faceValue: number;
	couponRate: number; // Annual coupon rate as percentage
	yieldToMaturity: number; // Annual YTM as percentage
	yearsToMaturity: number;
	frequency: "annual" | "semi_annual" | "quarterly" | "monthly";
}): number {
	const { faceValue, couponRate, yieldToMaturity, yearsToMaturity, frequency } =
		params;

	const periodsPerYear: Record<typeof frequency, number> = {
		annual: 1,
		semi_annual: 2,
		quarterly: 4,
		monthly: 12,
	};

	const n = periodsPerYear[frequency];
	const totalPeriods = yearsToMaturity * n;
	const couponPayment = (faceValue * (couponRate / 100)) / n;
	const ytmPerPeriod = yieldToMaturity / 100 / n;

	// Calculate present value of coupon payments
	let price = 0;
	for (let t = 1; t <= totalPeriods; t++) {
		price += couponPayment / (1 + ytmPerPeriod) ** t;
	}

	// Add present value of face value
	price += faceValue / (1 + ytmPerPeriod) ** totalPeriods;

	return Math.round(price * 100) / 100;
}

/**
 * Calculate convexity of a bond.
 * Uses Python sidecar first; falls back to TS implementation.
 */
export async function calculateConvexity(params: {
	faceValue: number;
	couponRate: number;
	yieldToMaturity: number;
	yearsToMaturity: number;
	frequency: "annual" | "semi_annual" | "quarterly" | "monthly";
}): Promise<number> {
	const { faceValue, couponRate, yieldToMaturity, yearsToMaturity, frequency } =
		params;

	const pyResult = await fetchPythonBondAnalytics({
		faceValue,
		couponRate,
		ytm: yieldToMaturity,
		yearsToMaturity,
		frequency,
	});
	if (pyResult) return pyResult.convexity;

	// TS fallback
	const n = FREQ_MAP[frequency] ?? 2;
	const totalPeriods = yearsToMaturity * n;
	const couponPayment = (faceValue * (couponRate / 100)) / n;
	const ytmPerPeriod = yieldToMaturity / 100 / n;
	const bondPrice = calculateBondPrice({
		faceValue,
		couponRate,
		yieldToMaturity,
		yearsToMaturity,
		frequency,
	});
	let convexitySum = 0;
	for (let t = 1; t <= totalPeriods; t++) {
		const pv = couponPayment / (1 + ytmPerPeriod) ** t;
		convexitySum += pv * t * (t + 1);
	}
	const pvFace = faceValue / (1 + ytmPerPeriod) ** totalPeriods;
	convexitySum += pvFace * totalPeriods * (totalPeriods + 1);
	return (
		Math.round(
			(convexitySum / (bondPrice * (1 + ytmPerPeriod) ** 2 * n * n)) * 1000,
		) / 1000
	);
}

/**
 * Calculate next coupon payment date
 */
export function calculateNextCouponDate(params: {
	lastCouponDate: Date;
	frequency: "annual" | "semi_annual" | "quarterly" | "monthly";
	currentDate?: Date;
}): Date {
	const { lastCouponDate, frequency, currentDate = new Date() } = params;

	const monthsToAdd: Record<typeof frequency, number> = {
		annual: 12,
		semi_annual: 6,
		quarterly: 3,
		monthly: 1,
	};

	const nextDate = new Date(lastCouponDate);

	while (nextDate <= currentDate) {
		nextDate.setMonth(nextDate.getMonth() + monthsToAdd[frequency]);
	}

	return nextDate;
}

/**
 * Calculate total return from coupon payments over holding period
 */
export function calculateTotalCouponIncome(params: {
	faceValue: number;
	couponRate: number; // Annual coupon rate as percentage
	purchaseDate: Date;
	currentDate: Date;
	frequency: "annual" | "semi_annual" | "quarterly" | "monthly";
}): number {
	const { faceValue, couponRate, purchaseDate, currentDate, frequency } =
		params;

	const periodsPerYear: Record<typeof frequency, number> = {
		annual: 1,
		semi_annual: 2,
		quarterly: 4,
		monthly: 12,
	};

	const n = periodsPerYear[frequency];
	const couponPerPeriod = (faceValue * (couponRate / 100)) / n;

	// Calculate number of coupon payments received
	const monthsDiff =
		(currentDate.getFullYear() - purchaseDate.getFullYear()) * 12 +
		(currentDate.getMonth() - purchaseDate.getMonth());

	const monthsPerPeriod = 12 / n;
	const periodsElapsed = Math.floor(monthsDiff / monthsPerPeriod);

	const totalCouponIncome = couponPerPeriod * periodsElapsed;

	return Math.round(totalCouponIncome * 100) / 100;
}
