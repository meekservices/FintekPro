/**
 * Financial Calculations Service
 *
 * Provides advanced financial calculations for portfolio analytics:
 * - XIRR (Extended Internal Rate of Return) for irregular cash flows
 * - IRR (Internal Rate of Return) for regular cash flows
 * - CAGR (Compound Annual Growth Rate)
 * - Portfolio returns and performance metrics
 */

import { callPython } from "../clients/python-client";

interface CashFlow {
	date: Date;
	amount: number; // Negative for investments, positive for returns
}

interface XIRRResult {
	xirr: number; // Annualized return as decimal (0.15 = 15%)
	xirrPercentage: number; // Formatted percentage (15.00)
	success: boolean;
	iterations?: number;
}

interface IRRResult {
	irr: number;
	irrPercentage: number;
	success: boolean;
}

interface CAGRResult {
	cagr: number;
	cagrPercentage: number;
	years: number;
}

export class FinancialCalculations {
	/**
	 * Calculate XIRR (Extended Internal Rate of Return)
	 * Tries Python sidecar first (scipy brentq), falls back to Newton-Raphson
	 *
	 * @param cashFlows Array of cash flows with dates and amounts
	 * @param guess Initial guess for the rate (default: 0.1 = 10%)
	 * @param maxIterations Maximum iterations for convergence (default: 100)
	 * @param tolerance Acceptable error tolerance (default: 0.0001)
	 */
	static async calculateXIRR(
		cashFlows: CashFlow[],
		guess: number = 0.1,
		maxIterations: number = 100,
		tolerance: number = 0.0001,
	): Promise<XIRRResult> {
		if (cashFlows.length < 2) {
			return { xirr: 0, xirrPercentage: 0, success: false };
		}

		// Python sidecar primary path
		try {
			const payload = cashFlows.map((cf) => ({
				date:
					cf.date instanceof Date
						? cf.date.toISOString().slice(0, 10)
						: String(cf.date),
				amount: cf.amount,
			}));
			const r = await callPython<{ xirr_pct: number | null; error?: string }>(
				"/api/quant/xirr",
				"POST",
				payload,
			);
			if (r?.xirr_pct != null && !r.error) {
				const rate = r.xirr_pct / 100;
				return {
					xirr: rate,
					xirrPercentage: Number.parseFloat(r.xirr_pct.toFixed(2)),
					success: true,
				};
			}
		} catch {
			// sidecar unavailable — fall through to Newton-Raphson
		}

		// Newton-Raphson fallback
		const sortedFlows = [...cashFlows].sort(
			(a, b) => a.date.getTime() - b.date.getTime(),
		);
		const baseDate = sortedFlows[0].date;
		const hasPositive = sortedFlows.some((cf) => cf.amount > 0);
		const hasNegative = sortedFlows.some((cf) => cf.amount < 0);
		if (!hasPositive || !hasNegative) {
			return { xirr: 0, xirrPercentage: 0, success: false };
		}

		let rate = guess;
		let iterations = 0;

		while (iterations < maxIterations) {
			let npv = 0;
			let dnpv = 0;

			for (const cf of sortedFlows) {
				const yearFraction = FinancialCalculations.getYearFraction(
					baseDate,
					cf.date,
				);
				const discountFactor = (1 + rate) ** yearFraction;
				npv += cf.amount / discountFactor;
				dnpv -= (cf.amount * yearFraction) / (1 + rate) ** (yearFraction + 1);
			}

			if (Math.abs(npv) < tolerance) {
				return {
					xirr: rate,
					xirrPercentage: Number.parseFloat((rate * 100).toFixed(2)),
					success: true,
					iterations,
				};
			}

			if (Math.abs(dnpv) < 1e-10) break;

			const newRate = rate - npv / dnpv;
			if (newRate < -0.99 || newRate > 10) break;

			rate = newRate;
			iterations++;
		}

		return { xirr: 0, xirrPercentage: 0, success: false };
	}

	/**
	 * Calculate IRR (Internal Rate of Return) for regular cash flows
	 *
	 * @param cashFlows Array of regular periodic cash flows
	 * @param guess Initial guess for the rate
	 */
	static calculateIRR(
		cashFlows: number[],
		guess: number = 0.1,
		maxIterations: number = 100,
		tolerance: number = 0.0001,
	): IRRResult {
		if (cashFlows.length < 2) {
			return { irr: 0, irrPercentage: 0, success: false };
		}

		let rate = guess;
		let iterations = 0;

		while (iterations < maxIterations) {
			let npv = 0;
			let dnpv = 0;

			for (let i = 0; i < cashFlows.length; i++) {
				npv += cashFlows[i] / (1 + rate) ** i;
				dnpv -= (i * cashFlows[i]) / (1 + rate) ** (i + 1);
			}

			if (Math.abs(npv) < tolerance) {
				return {
					irr: rate,
					irrPercentage: Number.parseFloat((rate * 100).toFixed(2)),
					success: true,
				};
			}

			if (Math.abs(dnpv) < 1e-10) {
				break;
			}

			const newRate = rate - npv / dnpv;

			if (newRate < -0.99 || newRate > 10) {
				break;
			}

			rate = newRate;
			iterations++;
		}

		return { irr: 0, irrPercentage: 0, success: false };
	}

	/**
	 * Calculate CAGR (Compound Annual Growth Rate)
	 *
	 * @param beginningValue Initial investment value
	 * @param endingValue Final investment value
	 * @param years Number of years
	 */
	static calculateCAGR(
		beginningValue: number,
		endingValue: number,
		years: number,
	): CAGRResult {
		if (beginningValue <= 0 || endingValue <= 0 || years <= 0) {
			return { cagr: 0, cagrPercentage: 0, years: 0 };
		}

		const cagr = (endingValue / beginningValue) ** (1 / years) - 1;

		return {
			cagr,
			cagrPercentage: Number.parseFloat((cagr * 100).toFixed(2)),
			years,
		};
	}

	/**
	 * Calculate year fraction between two dates (actual/365 convention)
	 */
	private static getYearFraction(startDate: Date, endDate: Date): number {
		const msPerDay = 1000 * 60 * 60 * 24;
		const daysDiff = (endDate.getTime() - startDate.getTime()) / msPerDay;
		return daysDiff / 365;
	}

	/**
	 * Calculate absolute returns
	 */
	static calculateAbsoluteReturns(invested: number, current: number): number {
		if (invested === 0) return 0;
		return ((current - invested) / invested) * 100;
	}

	/**
	 * Calculate total portfolio XIRR from multiple holdings
	 * Each holding provides its own cash flows
	 */
	static calculatePortfolioXIRR(allCashFlows: CashFlow[]): XIRRResult {
		return FinancialCalculations.calculateXIRR(allCashFlows);
	}

	/**
	 * Generate cash flows from investment data
	 * For mutual funds, SIPs, etc.
	 */
	static generateCashFlowsFromInvestments(
		purchases: Array<{ date: Date; amount: number }>,
		currentValue: number,
		currentDate: Date = new Date(),
	): CashFlow[] {
		const cashFlows: CashFlow[] = [];

		// Add all purchase transactions (negative = outflow)
		for (const purchase of purchases) {
			cashFlows.push({
				date: purchase.date,
				amount: -Math.abs(purchase.amount),
			});
		}

		// Add current value (positive = inflow)
		cashFlows.push({
			date: currentDate,
			amount: Math.abs(currentValue),
		});

		return cashFlows;
	}

	/**
	 * Calculate Simple Returns (point-to-point return)
	 */
	static calculateSimpleReturns(
		invested: number,
		current: number,
		startDate: Date,
		endDate: Date = new Date(),
	): {
		returns: number;
		returnsPercentage: number;
		years: number;
		annualizedReturn: number;
	} {
		const returns = current - invested;
		const returnsPercentage = invested > 0 ? (returns / invested) * 100 : 0;
		const years = FinancialCalculations.getYearFraction(startDate, endDate);

		// Annualized return (simple compounding)
		const annualizedReturn =
			years > 0 ? ((current / invested) ** (1 / years) - 1) * 100 : 0;

		return {
			returns,
			returnsPercentage: Number.parseFloat(returnsPercentage.toFixed(2)),
			years: Number.parseFloat(years.toFixed(2)),
			annualizedReturn: Number.parseFloat(annualizedReturn.toFixed(2)),
		};
	}
}

export type { CashFlow, XIRRResult, IRRResult, CAGRResult };
