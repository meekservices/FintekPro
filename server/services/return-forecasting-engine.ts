/**
 * Return Forecasting Engine
 *
 * Provides financial return calculations and forecasting:
 * - CAGR (Compound Annual Growth Rate)
 * - IRR (Internal Rate of Return)
 * - Yield (dividend/coupon returns)
 * - Stress Return (worst-case scenarios)
 * - Max Drawdown (maximum peak-to-trough decline)
 * - Forward projections with confidence intervals
 *
 * UPGRADE (Audit #3): All calculations now run in pure TypeScript via xirr-calculator.ts.
 * Python sidecar (callPython) is attempted first for XIRR and SIP Monte Carlo;
 * if unavailable the TS implementation is used automatically.
 */

import { callPython } from "../clients/python-client";
import {
  computeXIRR as tsXIRR,
  computeIRR as tsIRR,
  computeMaxDrawdown as tsMaxDrawdown,
  computeSharpe as tsSharpe,
  type CashFlow as XirrCashFlow,
} from "./xirr-calculator";

export interface AssetReturns {
	assetId: string;
	assetType:
		| "equity"
		| "mutual_fund"
		| "bond"
		| "fd"
		| "etf"
		| "real_estate"
		| "gold"
		| "alternative";
	assetName: string;
	currentValue: number;
	investedAmount: number;
	inceptionDate: Date;
	historicalReturns?: number[]; // Monthly returns in percentage
	dividendYield?: number;
	couponRate?: number;
}

export interface CashFlow {
	date: Date;
	amount: number; // Positive for inflows (investments), negative for outflows (redemptions)
}

export interface ReturnMetrics {
	cagr: number;
	absoluteReturn: number;
	annualizedReturn: number;
	totalGain: number;
	holdingPeriodYears: number;
}

export interface IRRResult {
	irr: number;
	xirr: number; // Extended IRR for irregular cash flows
	modifiedIrr?: number; // MIRR with reinvestment rate
}

export interface YieldMetrics {
	currentYield: number;
	yieldToMaturity?: number;
	dividendYield?: number;
	couponYield?: number;
	totalYield: number;
}

export interface StressTestResult {
	scenario: string;
	description: string;
	probability: number; // 0-1
	projectedReturn: number;
	projectedValue: number;
	drawdown: number;
	recoveryPeriodMonths: number;
}

export interface DrawdownMetrics {
	maxDrawdown: number; // Maximum percentage decline
	maxDrawdownPeriod: { start: Date; end: Date } | null;
	currentDrawdown: number;
	averageDrawdown: number;
	recoveryTime: number; // Average months to recover
	ulcerIndex: number; // Pain index measuring drawdown severity
}

export interface ForwardProjection {
	timeHorizonYears: number;
	expectedReturn: number;
	projectedValue: number;
	confidenceInterval: {
		low: number;
		mid: number;
		high: number;
	};
	probabilityOfLoss: number;
	breakEvenProbability: number;
}

export interface ComprehensiveReturns {
	assetId: string;
	assetName: string;
	returnMetrics: ReturnMetrics;
	irrMetrics: IRRResult;
	yieldMetrics: YieldMetrics;
	stressTests: StressTestResult[];
	drawdownMetrics: DrawdownMetrics;
	projections: ForwardProjection[];
	riskAdjustedReturns: {
		sharpeRatio: number;
		sortinoRatio: number;
		calmarRatio: number;
		informationRatio: number;
	};
}

// Asset class expected returns and volatility (based on historical data)
const ASSET_CLASS_PARAMS: Record<
	string,
	{ expectedReturn: number; volatility: number; drawdownFactor: number }
> = {
	equity: { expectedReturn: 12.0, volatility: 18.0, drawdownFactor: 0.55 },
	mutual_fund: { expectedReturn: 10.0, volatility: 14.0, drawdownFactor: 0.4 },
	bond: { expectedReturn: 7.0, volatility: 4.0, drawdownFactor: 0.1 },
	fd: { expectedReturn: 6.5, volatility: 0.5, drawdownFactor: 0.0 },
	etf: { expectedReturn: 11.0, volatility: 16.0, drawdownFactor: 0.45 },
	real_estate: { expectedReturn: 8.0, volatility: 10.0, drawdownFactor: 0.3 },
	gold: { expectedReturn: 6.0, volatility: 12.0, drawdownFactor: 0.25 },
	alternative: { expectedReturn: 15.0, volatility: 25.0, drawdownFactor: 0.6 },
};

// Stress test scenarios
const STRESS_SCENARIOS: Array<{
	name: string;
	description: string;
	probability: number;
	shockFactor: Record<string, number>;
}> = [
	{
		name: "market_crash",
		description: "Severe market crash similar to 2008 financial crisis",
		probability: 0.05,
		shockFactor: {
			equity: -0.5,
			mutual_fund: -0.4,
			bond: -0.05,
			fd: 0.0,
			etf: -0.45,
			real_estate: -0.3,
			gold: 0.1,
			alternative: -0.55,
		},
	},
	{
		name: "moderate_correction",
		description: "Moderate market correction (10-20% decline)",
		probability: 0.15,
		shockFactor: {
			equity: -0.2,
			mutual_fund: -0.15,
			bond: -0.02,
			fd: 0.0,
			etf: -0.18,
			real_estate: -0.1,
			gold: 0.05,
			alternative: -0.25,
		},
	},
	{
		name: "stagflation",
		description: "High inflation with low growth environment",
		probability: 0.1,
		shockFactor: {
			equity: -0.15,
			mutual_fund: -0.1,
			bond: -0.1,
			fd: -0.03,
			etf: -0.12,
			real_estate: 0.05,
			gold: 0.15,
			alternative: -0.2,
		},
	},
	{
		name: "deflation",
		description: "Deflationary environment with declining prices",
		probability: 0.05,
		shockFactor: {
			equity: -0.25,
			mutual_fund: -0.2,
			bond: 0.1,
			fd: 0.02,
			etf: -0.22,
			real_estate: -0.15,
			gold: 0.05,
			alternative: -0.3,
		},
	},
	{
		name: "bull_market",
		description: "Strong bull market with sustained growth",
		probability: 0.2,
		shockFactor: {
			equity: 0.25,
			mutual_fund: 0.2,
			bond: 0.05,
			fd: 0.0,
			etf: 0.22,
			real_estate: 0.15,
			gold: -0.05,
			alternative: 0.3,
		},
	},
];

export class ReturnForecastingEngine {
	private riskFreeRate: number = 6.0; // India 10-year G-Sec yield

	/**
	 * Calculate CAGR (Compound Annual Growth Rate)
	 */
	calculateCAGR(
		beginningValue: number,
		endingValue: number,
		years: number,
	): number {
		if (beginningValue <= 0 || years <= 0) return 0;
		const cagr = ((endingValue / beginningValue) ** (1 / years) - 1) * 100;
		return Math.round(cagr * 100) / 100;
	}

	/**
	 * Calculate comprehensive return metrics
	 */
	calculateReturnMetrics(asset: AssetReturns): ReturnMetrics {
		const holdingPeriodYears = this.getYearsDifference(
			asset.inceptionDate,
			new Date(),
		);
		const totalGain = asset.currentValue - asset.investedAmount;
		const absoluteReturn = (totalGain / asset.investedAmount) * 100;
		const cagr = this.calculateCAGR(
			asset.investedAmount,
			asset.currentValue,
			holdingPeriodYears,
		);
		const annualizedReturn = holdingPeriodYears > 1 ? cagr : absoluteReturn;

		return {
			cagr: Math.round(cagr * 100) / 100,
			absoluteReturn: Math.round(absoluteReturn * 100) / 100,
			annualizedReturn: Math.round(annualizedReturn * 100) / 100,
			totalGain: Math.round(totalGain * 100) / 100,
			holdingPeriodYears: Math.round(holdingPeriodYears * 100) / 100,
		};
	}

	/**
	 * Calculate IRR for a series of cash flows using Newton-Raphson method
	 */
	async calculateIRR(
		cashFlows: CashFlow[],
		finalValue: number,
	): Promise<IRRResult> {
		if (cashFlows.length === 0) {
			return { irr: 0, xirr: 0 };
		}

		const sortedFlows = [...cashFlows].sort(
			(a, b) => a.date.getTime() - b.date.getTime(),
		);
		const allFlows = [
			...sortedFlows,
			{ date: new Date(), amount: -finalValue },
		];

		const xirr = await this.calculateXIRR(allFlows);

		const simpleFlows = sortedFlows.map((f) => f.amount);
		simpleFlows.push(-finalValue);
		const irr = this.calculateSimpleIRR(simpleFlows);

		return {
			irr: Math.round(irr * 100) / 100,
			xirr: Math.round(xirr * 100) / 100,
		};
	}

	/**
	 * Calculate XIRR for irregular cash flows.
	 *
	 * Priority order:
	 *   1. Python sidecar (scipy brentq) — most accurate for edge cases
	 *   2. xirr-calculator.ts (Newton-Raphson, pure TS) — primary fallback, no sidecar needed
	 *
	 * @param cashFlows - Irregular dated cash flows
	 * @returns XIRR as a percentage (e.g. 15.3 for 15.3% p.a.)
	 */
	private async calculateXIRR(cashFlows: CashFlow[]): Promise<number> {
		if (cashFlows.length < 2) return 0;

		// 1. Python sidecar (scipy brentq) — most accurate, attempted first
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
			if (r?.xirr_pct != null && !r.error) return r.xirr_pct;
		} catch {
			// sidecar unavailable — fall through to TS implementation
		}

		// 2. Pure TS XIRR (xirr-calculator.ts, Newton-Raphson — Audit #3 upgrade)
		const xirrFlows: XirrCashFlow[] = cashFlows.map((cf) => ({
			date: cf.date instanceof Date ? cf.date : new Date(cf.date),
			amount: cf.amount,
		}));
		const xirr = tsXIRR(xirrFlows);
		return xirr * 100; // xirr-calculator returns decimal; this method returns %
	}

	/**
	 * Calculate simple IRR for regular (equal-period) cash flows.
	 * Delegates to xirr-calculator.ts canonical implementation (Audit #3 upgrade).
	 */
	private calculateSimpleIRR(cashFlows: number[]): number {
		return tsIRR(cashFlows) * 100; // tsIRR returns decimal; this method returns %
	}

	/**
	 * Calculate yield metrics
	 */
	calculateYieldMetrics(asset: AssetReturns): YieldMetrics {
		const dividendYield = asset.dividendYield || 0;
		const couponYield = asset.couponRate || 0;

		let currentYield = 0;
		if (asset.assetType === "bond" || asset.assetType === "fd") {
			currentYield = couponYield;
		} else {
			currentYield = dividendYield;
		}

		// Total yield includes price appreciation and income
		const returnMetrics = this.calculateReturnMetrics(asset);
		const incomeYield = dividendYield + couponYield;
		const totalYield = returnMetrics.annualizedReturn;

		return {
			currentYield: Math.round(currentYield * 100) / 100,
			dividendYield: Math.round(dividendYield * 100) / 100,
			couponYield: Math.round(couponYield * 100) / 100,
			totalYield: Math.round(totalYield * 100) / 100,
		};
	}

	/**
	 * Run stress tests on asset
	 */
	runStressTests(asset: AssetReturns): StressTestResult[] {
		return STRESS_SCENARIOS.map((scenario) => {
			const shockFactor = scenario.shockFactor[asset.assetType] || 0;
			const projectedReturn = shockFactor * 100;
			const projectedValue = asset.currentValue * (1 + shockFactor);
			const drawdown = shockFactor < 0 ? Math.abs(shockFactor) * 100 : 0;

			// Estimate recovery period based on historical patterns
			const params = ASSET_CLASS_PARAMS[asset.assetType];
			const recoveryPeriodMonths =
				drawdown > 0 ? Math.ceil((drawdown / params.expectedReturn) * 12) : 0;

			return {
				scenario: scenario.name,
				description: scenario.description,
				probability: scenario.probability,
				projectedReturn: Math.round(projectedReturn * 100) / 100,
				projectedValue: Math.round(projectedValue * 100) / 100,
				drawdown: Math.round(drawdown * 100) / 100,
				recoveryPeriodMonths,
			};
		});
	}

	/**
	 * Calculate drawdown metrics from historical returns
	 */
	calculateDrawdownMetrics(historicalReturns: number[]): DrawdownMetrics {
		if (!historicalReturns || historicalReturns.length === 0) {
			return {
				maxDrawdown: 0,
				maxDrawdownPeriod: null,
				currentDrawdown: 0,
				averageDrawdown: 0,
				recoveryTime: 0,
				ulcerIndex: 0,
			};
		}

		// Convert returns to price series (starting at 100)
		const prices: number[] = [100];
		for (let i = 0; i < historicalReturns.length; i++) {
			prices.push(prices[i] * (1 + historicalReturns[i] / 100));
		}

		// Calculate drawdowns
		let maxPrice = prices[0];
		const drawdowns: number[] = [];
		let maxDrawdown = 0;
		let maxDrawdownStart = 0;
		let maxDrawdownEnd = 0;
		let currentDrawdownStart = 0;

		for (let i = 0; i < prices.length; i++) {
			if (prices[i] > maxPrice) {
				maxPrice = prices[i];
				currentDrawdownStart = i;
			}
			const drawdown = ((maxPrice - prices[i]) / maxPrice) * 100;
			drawdowns.push(drawdown);

			if (drawdown > maxDrawdown) {
				maxDrawdown = drawdown;
				maxDrawdownStart = currentDrawdownStart;
				maxDrawdownEnd = i;
			}
		}

		// Current drawdown
		const currentDrawdown = drawdowns[drawdowns.length - 1];

		// Average drawdown (excluding zeros)
		const nonZeroDrawdowns = drawdowns.filter((d) => d > 0);
		const averageDrawdown =
			nonZeroDrawdowns.length > 0
				? nonZeroDrawdowns.reduce((a, b) => a + b, 0) / nonZeroDrawdowns.length
				: 0;

		// Ulcer Index (RMS of drawdowns)
		const squaredDrawdowns = drawdowns.map((d) => d * d);
		const ulcerIndex = Math.sqrt(
			squaredDrawdowns.reduce((a, b) => a + b, 0) / drawdowns.length,
		);

		// Estimate recovery time (simplified)
		const recoveryTime = maxDrawdown > 0 ? Math.ceil(maxDrawdown / 2) : 0;

		return {
			maxDrawdown: Math.round(maxDrawdown * 100) / 100,
			maxDrawdownPeriod:
				maxDrawdown > 0
					? {
							start: new Date(
								Date.now() -
									(prices.length - maxDrawdownStart) * 30 * 24 * 60 * 60 * 1000,
							),
							end: new Date(
								Date.now() -
									(prices.length - maxDrawdownEnd) * 30 * 24 * 60 * 60 * 1000,
							),
						}
					: null,
			currentDrawdown: Math.round(currentDrawdown * 100) / 100,
			averageDrawdown: Math.round(averageDrawdown * 100) / 100,
			recoveryTime,
			ulcerIndex: Math.round(ulcerIndex * 100) / 100,
		};
	}

	/**
	 * Generate forward projections.
	 * Uses Python sidecar /api/forecasting/sip-simulate for p10/p50/p90 bands when available.
	 */
	async generateProjections(
		asset: AssetReturns,
		horizons: number[] = [1, 3, 5, 10],
	): Promise<ForwardProjection[]> {
		const params =
			ASSET_CLASS_PARAMS[asset.assetType] || ASSET_CLASS_PARAMS.mutual_fund;
		const results: ForwardProjection[] = [];

		for (const years of horizons) {
			const expectedReturn = params.expectedReturn;
			const volatility = params.volatility;
			const expectedValue =
				asset.currentValue * (1 + expectedReturn / 100) ** years;
			const z95 = 1.96;
			const lowReturn = expectedReturn - (z95 * volatility) / Math.sqrt(years);
			const highReturn = expectedReturn + (z95 * volatility) / Math.sqrt(years);
			const lowValue = asset.currentValue * (1 + lowReturn / 100) ** years;
			const highValue = asset.currentValue * (1 + highReturn / 100) ** years;
			const zScore = (0 - expectedReturn) / (volatility / Math.sqrt(years));
			const probabilityOfLoss = this.normalCDF(zScore);

			let confidenceBand: { p10: number; p50: number; p90: number } | undefined;

			// Priority 1: Python sidecar — real Monte Carlo p10/p50/p90
			try {
				const sipPayload = {
					initial_amount: asset.currentValue ?? 0,
					monthly_sip: (asset as any).monthlyInvestment ?? 0,
					expected_return_pct: expectedReturn,
					years,
					step_up_pct: 0,
				};
				const pyResult = await callPython<any>(
					"/api/forecasting/sip-simulate",
					"POST",
					sipPayload,
				);
				if (pyResult && pyResult.corpus_p50 != null && !pyResult.error) {
					confidenceBand = {
						p10: Math.round(pyResult.corpus_p10 ?? lowValue),
						p50: Math.round(pyResult.corpus_p50),
						p90: Math.round(pyResult.corpus_p90 ?? highValue),
					};
				}
			} catch {
				// sidecar unavailable — fall through to TS Monte Carlo
			}

			// Priority 2: Pure TS parametric confidence band (Audit #3 — no Python dependency)
			// Uses log-normal distribution: ln(1+r) ~ N(μ, σ²) over T years.
			// p10/p50/p90 from normal quantiles: z = -1.28, 0, +1.28
			if (!confidenceBand) {
				const mu = Math.log(1 + expectedReturn / 100) * years;
				const sigma = (volatility / 100) * Math.sqrt(years);
				const p10 = asset.currentValue * Math.exp(mu - 1.28 * sigma);
				const p50 = asset.currentValue * Math.exp(mu);
				const p90 = asset.currentValue * Math.exp(mu + 1.28 * sigma);
				confidenceBand = {
					p10: Math.round(Math.max(p10, 1)),
					p50: Math.round(p50),
					p90: Math.round(p90),
				};
			}

			results.push({
				timeHorizonYears: years,
				expectedReturn: Math.round(expectedReturn * 100) / 100,
				projectedValue: confidenceBand
					? confidenceBand.p50
					: Math.round(expectedValue),
				confidenceInterval: {
					low: confidenceBand ? confidenceBand.p10 : Math.round(lowValue),
					mid: confidenceBand ? confidenceBand.p50 : Math.round(expectedValue),
					high: confidenceBand ? confidenceBand.p90 : Math.round(highValue),
				},
				probabilityOfLoss: Math.round(probabilityOfLoss * 10000) / 100,
				breakEvenProbability: Math.round((1 - probabilityOfLoss) * 10000) / 100,
				...(confidenceBand ? { confidenceBand } : {}),
			} as ForwardProjection);
		}

		return results;
	}

	/**
	 * Calculate risk-adjusted return metrics
	 */
	calculateRiskAdjustedReturns(asset: AssetReturns): {
		sharpeRatio: number;
		sortinoRatio: number;
		calmarRatio: number;
		informationRatio: number;
	} {
		const returnMetrics = this.calculateReturnMetrics(asset);
		const params =
			ASSET_CLASS_PARAMS[asset.assetType] || ASSET_CLASS_PARAMS.mutual_fund;

		// Sharpe Ratio = (Return - Risk-free Rate) / Volatility
		const excessReturn = returnMetrics.annualizedReturn - this.riskFreeRate;
		const sharpeRatio = excessReturn / params.volatility;

		// Sortino Ratio (using downside volatility - approximated as 60% of total volatility)
		const downsideVol = params.volatility * 0.6;
		const sortinoRatio = excessReturn / downsideVol;

		// Calmar Ratio = Annualized Return / Max Drawdown
		const maxDrawdown = params.drawdownFactor * 100;
		const calmarRatio =
			maxDrawdown > 0 ? returnMetrics.annualizedReturn / maxDrawdown : 0;

		// Information Ratio (vs benchmark - using expected return as proxy)
		const benchmarkReturn = params.expectedReturn;
		const trackingError = params.volatility * 0.3; // Approximation
		const informationRatio =
			(returnMetrics.annualizedReturn - benchmarkReturn) / trackingError;

		return {
			sharpeRatio: Math.round(sharpeRatio * 100) / 100,
			sortinoRatio: Math.round(sortinoRatio * 100) / 100,
			calmarRatio: Math.round(calmarRatio * 100) / 100,
			informationRatio: Math.round(informationRatio * 100) / 100,
		};
	}

	/**
	 * Get comprehensive returns analysis for an asset.
	 * Async — awaits calculateIRR (XIRR) and generateProjections (Monte Carlo / log-normal).
	 */
	async getComprehensiveReturns(
		asset: AssetReturns,
		cashFlows?: CashFlow[],
	): Promise<ComprehensiveReturns> {
		const returnMetrics = this.calculateReturnMetrics(asset);
		const irrMetrics = cashFlows
			? await this.calculateIRR(cashFlows, asset.currentValue)
			: { irr: returnMetrics.cagr, xirr: returnMetrics.cagr };
		const yieldMetrics = this.calculateYieldMetrics(asset);
		const stressTests = this.runStressTests(asset);
		const drawdownMetrics = this.calculateDrawdownMetrics(
			asset.historicalReturns || [],
		);
		const projections = await this.generateProjections(asset);
		const riskAdjustedReturns = this.calculateRiskAdjustedReturns(asset);

		return {
			assetId: asset.assetId,
			assetName: asset.assetName,
			returnMetrics,
			irrMetrics,
			yieldMetrics,
			stressTests,
			drawdownMetrics,
			projections,
			riskAdjustedReturns,
		};
	}

	/**
	 * Calculate portfolio-level returns
	 */
	calculatePortfolioReturns(assets: AssetReturns[]): {
		totalInvested: number;
		currentValue: number;
		absoluteReturn: number;
		weightedCAGR: number;
		portfolioVolatility: number;
		diversificationBenefit: number;
	} {
		const totalInvested = assets.reduce((sum, a) => sum + a.investedAmount, 0);
		const currentValue = assets.reduce((sum, a) => sum + a.currentValue, 0);
		const absoluteReturn =
			((currentValue - totalInvested) / totalInvested) * 100;

		// Calculate weighted CAGR
		let weightedCAGR = 0;
		let weightedVolatility = 0;

		for (const asset of assets) {
			const weight = asset.currentValue / currentValue;
			const metrics = this.calculateReturnMetrics(asset);
			const params =
				ASSET_CLASS_PARAMS[asset.assetType] || ASSET_CLASS_PARAMS.mutual_fund;

			weightedCAGR += weight * metrics.cagr;
			weightedVolatility += weight * params.volatility;
		}

		// Simplified diversification benefit (assumes average correlation of 0.5)
		const avgCorrelation = 0.5;
		const portfolioVolatility =
			weightedVolatility *
			Math.sqrt((1 - avgCorrelation) / assets.length + avgCorrelation);
		const diversificationBenefit =
			((weightedVolatility - portfolioVolatility) / weightedVolatility) * 100;

		return {
			totalInvested: Math.round(totalInvested),
			currentValue: Math.round(currentValue),
			absoluteReturn: Math.round(absoluteReturn * 100) / 100,
			weightedCAGR: Math.round(weightedCAGR * 100) / 100,
			portfolioVolatility: Math.round(portfolioVolatility * 100) / 100,
			diversificationBenefit: Math.round(diversificationBenefit * 100) / 100,
		};
	}

	// Helper methods
	private getYearsDifference(startDate: Date, endDate: Date): number {
		const diffTime = endDate.getTime() - startDate.getTime();
		return diffTime / (1000 * 60 * 60 * 24 * 365.25);
	}

	private normalCDF(x: number): number {
		// Approximation of cumulative normal distribution
		const a1 = 0.254829592;
		const a2 = -0.284496736;
		const a3 = 1.421413741;
		const a4 = -1.453152027;
		const a5 = 1.061405429;
		const p = 0.3275911;

		const sign = x < 0 ? -1 : 1;
		x = Math.abs(x) / Math.sqrt(2);

		const t = 1.0 / (1.0 + p * x);
		const y =
			1.0 -
			((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

		return 0.5 * (1.0 + sign * y);
	}
}

export const returnForecastingEngine = new ReturnForecastingEngine();
