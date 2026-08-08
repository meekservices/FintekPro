import { logger } from "../logger";
/**
 * Research Metrics Engine
 * Calculates portfolio performance metrics: CAGR, Standard Deviation, Sharpe Ratio, Max Drawdown
 */

import { getEnrichedStockSnapshot } from "./screener/enriched-stock-data";

export interface EnrichedMetrics {
	roic?: number | null;
	evToEbitda?: number | null;
	grahamNumber?: number | null;
	interestCoverage?: number | null;
	earningsYield?: number | null;
	epsGrowth?: number | null;
	revenueGrowth?: number | null;
	freeCashFlowGrowth?: number | null;
	dcfValue?: number | null;
	upsidePercent?: number | null;
	fmpRating?: string | null;
	ratingScore?: number | null;
}

export interface MetricsInput {
	returns: number[];
	riskFreeRate?: number;
	periods?: number;
}

export interface PortfolioMetrics {
	cagr: number;
	annualizedReturn: number;
	volatility: number;
	sharpeRatio: number;
	sortinoRatio: number;
	maxDrawdown: number;
	calmarRatio: number;
	beta: number;
	alpha: number;
	informationRatio: number;
	trackingError: number;
}

export interface ListPerformance {
	listId: string;
	listName: string;
	return1m: number | null;
	return3m: number | null;
	return6m: number | null;
	return1y: number | null;
	return3y: number | null;
	cagr: number | null;
	volatility: number | null;
	sharpeRatio: number | null;
	maxDrawdown: number | null;
	itemCount: number;
	dataStatus?: "calculated" | "insufficient_data";
}

export class ResearchMetricsEngine {
	private readonly DEFAULT_RISK_FREE_RATE = 0.065;
	private readonly TRADING_DAYS_PER_YEAR = 252;
	private readonly BENCHMARK_RETURNS = {
		nifty50: 0.12,
		niftyNext50: 0.14,
		sensex: 0.11,
	};

	calculateCAGR(
		beginningValue: number,
		endingValue: number,
		years: number,
	): number {
		if (beginningValue <= 0 || years <= 0) return 0;
		return (endingValue / beginningValue) ** (1 / years) - 1;
	}

	calculateAnnualizedReturn(
		returns: number[],
		periodsPerYear: number = 12,
	): number {
		if (returns.length === 0) return 0;
		const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
		return (1 + avgReturn) ** periodsPerYear - 1;
	}

	calculateVolatility(returns: number[], annualize: boolean = true): number {
		if (returns.length < 2) return 0;
		const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
		const squaredDiffs = returns.map((r) => (r - mean) ** 2);
		const variance =
			squaredDiffs.reduce((a, b) => a + b, 0) / (returns.length - 1);
		const stdDev = Math.sqrt(variance);
		return annualize ? stdDev * Math.sqrt(12) : stdDev;
	}

	calculateSharpeRatio(
		returns: number[],
		riskFreeRate: number = this.DEFAULT_RISK_FREE_RATE,
	): number {
		const annualizedReturn = this.calculateAnnualizedReturn(returns);
		const volatility = this.calculateVolatility(returns);
		if (volatility === 0) return 0;
		return (annualizedReturn - riskFreeRate) / volatility;
	}

	calculateSortinoRatio(
		returns: number[],
		riskFreeRate: number = this.DEFAULT_RISK_FREE_RATE,
	): number {
		const annualizedReturn = this.calculateAnnualizedReturn(returns);
		const negativeReturns = returns.filter((r) => r < 0);
		if (negativeReturns.length === 0) return annualizedReturn > 0 ? 999 : 0;

		const downsideDeviation = this.calculateVolatility(negativeReturns);
		if (downsideDeviation === 0) return 0;
		return (annualizedReturn - riskFreeRate) / downsideDeviation;
	}

	calculateMaxDrawdown(prices: number[]): number {
		if (prices.length < 2) return 0;
		let maxDrawdown = 0;
		let peak = prices[0];

		for (const price of prices) {
			if (price > peak) {
				peak = price;
			}
			const drawdown = (peak - price) / peak;
			if (drawdown > maxDrawdown) {
				maxDrawdown = drawdown;
			}
		}
		return -maxDrawdown;
	}

	calculateCalmarRatio(cagr: number, maxDrawdown: number): number {
		if (maxDrawdown === 0) return 0;
		return cagr / Math.abs(maxDrawdown);
	}

	calculateBeta(
		portfolioReturns: number[],
		benchmarkReturns: number[],
	): number {
		if (
			portfolioReturns.length !== benchmarkReturns.length ||
			portfolioReturns.length < 2
		) {
			return 1;
		}

		const portfolioMean =
			portfolioReturns.reduce((a, b) => a + b, 0) / portfolioReturns.length;
		const benchmarkMean =
			benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length;

		let covariance = 0;
		let benchmarkVariance = 0;

		for (let i = 0; i < portfolioReturns.length; i++) {
			const portfolioDiff = portfolioReturns[i] - portfolioMean;
			const benchmarkDiff = benchmarkReturns[i] - benchmarkMean;
			covariance += portfolioDiff * benchmarkDiff;
			benchmarkVariance += benchmarkDiff * benchmarkDiff;
		}

		covariance /= portfolioReturns.length - 1;
		benchmarkVariance /= portfolioReturns.length - 1;

		if (benchmarkVariance === 0) return 1;
		return covariance / benchmarkVariance;
	}

	calculateAlpha(
		portfolioReturn: number,
		benchmarkReturn: number,
		beta: number,
		riskFreeRate: number = this.DEFAULT_RISK_FREE_RATE,
	): number {
		return (
			portfolioReturn - (riskFreeRate + beta * (benchmarkReturn - riskFreeRate))
		);
	}

	calculateTrackingError(
		portfolioReturns: number[],
		benchmarkReturns: number[],
	): number {
		if (portfolioReturns.length !== benchmarkReturns.length) return 0;
		const excessReturns = portfolioReturns.map(
			(r, i) => r - benchmarkReturns[i],
		);
		return this.calculateVolatility(excessReturns);
	}

	calculateInformationRatio(
		portfolioReturns: number[],
		benchmarkReturns: number[],
	): number {
		if (portfolioReturns.length !== benchmarkReturns.length) return 0;
		const excessReturns = portfolioReturns.map(
			(r, i) => r - benchmarkReturns[i],
		);
		const meanExcess =
			excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
		const trackingError = this.calculateTrackingError(
			portfolioReturns,
			benchmarkReturns,
		);
		if (trackingError === 0) return 0;
		return (meanExcess * 12) / trackingError;
	}

	calculateAllMetrics(
		returns: number[],
		prices: number[],
		benchmarkReturns?: number[],
	): PortfolioMetrics {
		const annualizedReturn = this.calculateAnnualizedReturn(returns);
		const volatility = this.calculateVolatility(returns);
		const sharpeRatio = this.calculateSharpeRatio(returns);
		const sortinoRatio = this.calculateSortinoRatio(returns);
		const maxDrawdown = this.calculateMaxDrawdown(prices);
		const cagr =
			prices.length >= 2
				? this.calculateCAGR(
						prices[0],
						prices[prices.length - 1],
						prices.length / 12,
					)
				: annualizedReturn;
		const calmarRatio = this.calculateCalmarRatio(cagr, maxDrawdown);

		let beta = 1;
		let alpha = 0;
		let informationRatio = 0;
		let trackingError = 0;

		if (benchmarkReturns && benchmarkReturns.length > 0) {
			beta = this.calculateBeta(returns, benchmarkReturns);
			const benchmarkReturn = this.calculateAnnualizedReturn(benchmarkReturns);
			alpha = this.calculateAlpha(annualizedReturn, benchmarkReturn, beta);
			informationRatio = this.calculateInformationRatio(
				returns,
				benchmarkReturns,
			);
			trackingError = this.calculateTrackingError(returns, benchmarkReturns);
		}

		return {
			cagr: Math.round(cagr * 10000) / 100,
			annualizedReturn: Math.round(annualizedReturn * 10000) / 100,
			volatility: Math.round(volatility * 10000) / 100,
			sharpeRatio: Math.round(sharpeRatio * 100) / 100,
			sortinoRatio: Math.round(sortinoRatio * 100) / 100,
			maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
			calmarRatio: Math.round(calmarRatio * 100) / 100,
			beta: Math.round(beta * 100) / 100,
			alpha: Math.round(alpha * 10000) / 100,
			informationRatio: Math.round(informationRatio * 100) / 100,
			trackingError: Math.round(trackingError * 10000) / 100,
		};
	}

	// REMOVED: generateMockReturns() - Deleted for regulatory compliance
	// All financial metrics must use real data sources
	// If synthetic data is needed for testing, use dedicated test utilities outside production code

	/**
	 * Helper method to generate price series from returns
	 * Used internally for metrics calculation when historical prices are available
	 */
	generatePricesFromReturns(initialPrice: number, returns: number[]): number[] {
		const prices: number[] = [initialPrice];
		for (const ret of returns) {
			prices.push(prices[prices.length - 1] * (1 + ret));
		}
		return prices;
	}

	calculateListPerformance(
		listId: string,
		listName: string,
		itemCount: number,
		instrumentReturns?: {
			returns1m?: number;
			returns3m?: number;
			returns6m?: number;
			returns1y?: number;
			returns3y?: number;
		}[],
	): ListPerformance {
		// No mock data - return null values when no real data is available
		// This ensures regulatory compliance and data integrity
		if (!instrumentReturns || instrumentReturns.length === 0) {
			return {
				listId,
				listName,
				return1m: null,
				return3m: null,
				return6m: null,
				return1y: null,
				return3y: null,
				cagr: null,
				volatility: null,
				sharpeRatio: null,
				maxDrawdown: null,
				itemCount,
				dataStatus: "insufficient_data",
			};
		}

		// Calculate weighted averages from real instrument data
		const validReturns = instrumentReturns.filter(
			(ir) =>
				ir.returns1m !== undefined ||
				ir.returns3m !== undefined ||
				ir.returns6m !== undefined ||
				ir.returns1y !== undefined,
		);

		if (validReturns.length === 0) {
			// No valid return data available - return null values
			return {
				listId,
				listName,
				return1m: null,
				return3m: null,
				return6m: null,
				return1y: null,
				return3y: null,
				cagr: null,
				volatility: null,
				sharpeRatio: null,
				maxDrawdown: null,
				itemCount,
				dataStatus: "insufficient_data",
			};
		}

		const avgReturn1m =
			validReturns.reduce((sum, ir) => sum + (ir.returns1m || 0), 0) /
			validReturns.length;
		const avgReturn3m =
			validReturns.reduce((sum, ir) => sum + (ir.returns3m || 0), 0) /
			validReturns.length;
		const avgReturn6m =
			validReturns.reduce((sum, ir) => sum + (ir.returns6m || 0), 0) /
			validReturns.length;
		const avgReturn1y =
			validReturns.reduce((sum, ir) => sum + (ir.returns1y || 0), 0) /
			validReturns.length;
		const avgReturn3y =
			validReturns.reduce((sum, ir) => sum + (ir.returns3y || 0), 0) /
			validReturns.length;

		// Calculate CAGR using real 3Y return if available, else 1Y
		// Formula: CAGR = (End/Start)^(1/years) - 1
		let cagr: number | null = null;
		if (avgReturn3y !== 0) {
			// Convert 3Y cumulative return to CAGR
			cagr =
				Math.round(((1 + avgReturn3y / 100) ** (1 / 3) - 1) * 100 * 100) / 100;
		} else if (avgReturn1y !== 0) {
			// Use 1Y return as CAGR approximation
			cagr = Math.round(avgReturn1y * 100) / 100;
		}

		// Note: Volatility, Sharpe Ratio, and Max Drawdown require historical price series
		// Without real time-series data, these metrics cannot be accurately calculated
		// Return null to indicate insufficient data for these advanced metrics
		return {
			listId,
			listName,
			return1m: Math.round(avgReturn1m * 100) / 100,
			return3m: Math.round(avgReturn3m * 100) / 100,
			return6m: Math.round(avgReturn6m * 100) / 100,
			return1y: Math.round(avgReturn1y * 100) / 100,
			return3y: Math.round(avgReturn3y * 100) / 100,
			cagr,
			volatility: null, // Requires historical price series - not available from return snapshots
			sharpeRatio: null, // Requires historical price series - not available from return snapshots
			maxDrawdown: null, // Requires historical price series - not available from return snapshots
			itemCount,
			dataStatus: "calculated",
		};
	}

	/**
	 * Generates risk/return data for research lists
	 * NOTE: No mock data - returns empty array when no real performance data available
	 * Real implementation would require historical price series for each list's instruments
	 */
	generateRiskReturnData(
		lists: { id: string; name: string; itemCount: number }[],
		performanceData?: Map<string, { volatility?: number; cagr?: number }>,
	): {
		name: string;
		risk: number | null;
		return: number | null;
		size: number;
	}[] {
		return lists.map((list) => {
			const perf = performanceData?.get(list.id);
			return {
				name: list.name,
				risk: perf?.volatility ?? null,
				return: perf?.cagr ?? null,
				size: list.itemCount * 10 + 20,
			};
		});
	}

	/**
	 * Generates rolling returns chart data
	 * NOTE: No mock data - returns empty array when no real historical data available
	 * Real implementation would require monthly return series from database
	 */
	generateRollingReturns(
		historicalReturns?: {
			month: string;
			portfolio: number;
			benchmark: number;
		}[],
	): { month: string; portfolio: number; benchmark: number }[] {
		// Return real historical data if provided, otherwise empty array
		// No mock data generation for regulatory compliance
		return historicalReturns || [];
	}

	/**
	 * Generates sector allocation breakdown
	 * NOTE: No mock data - returns empty array when no real allocation data available
	 * Real implementation would calculate from actual portfolio holdings
	 */
	generateSectorAllocation(
		holdings?: { sector: string; value: number }[],
	): { sector: string; allocation: number; color: string }[] {
		if (!holdings || holdings.length === 0) {
			// Return empty array - no mock data for regulatory compliance
			return [];
		}

		const sectorColors: Record<string, string> = {
			IT: "#3B82F6",
			Banking: "#10B981",
			Pharma: "#F59E0B",
			Auto: "#EF4444",
			FMCG: "#8B5CF6",
			Energy: "#06B6D4",
			Others: "#6B7280",
		};

		const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
		if (totalValue === 0) return [];

		return holdings.map((h) => ({
			sector: h.sector,
			allocation: Math.round((h.value / totalValue) * 100 * 100) / 100,
			color: sectorColors[h.sector] || "#6B7280",
		}));
	}

	async calculateAllMetricsWithEnriched(
		symbol: string,
		returns: number[],
		prices: number[],
		benchmarkReturns?: number[],
	): Promise<PortfolioMetrics & { enriched?: EnrichedMetrics }> {
		const baseMetrics = this.calculateAllMetrics(
			returns,
			prices,
			benchmarkReturns,
		);

		let enriched: EnrichedMetrics | undefined;
		try {
			const snapshot = await getEnrichedStockSnapshot(symbol);
			if (snapshot) {
				enriched = {};

				if (snapshot.fundamentals) {
					enriched.roic = snapshot.fundamentals.roic;
					enriched.evToEbitda = snapshot.fundamentals.evToEbitda;
					enriched.grahamNumber = snapshot.fundamentals.grahamNumber;
					enriched.interestCoverage = snapshot.fundamentals.interestCoverage;
					enriched.earningsYield = snapshot.fundamentals.earningsYield;
				}

				if (snapshot.growth) {
					enriched.epsGrowth = snapshot.growth.epsGrowth;
					enriched.revenueGrowth = snapshot.growth.revenueGrowth;
					enriched.freeCashFlowGrowth = snapshot.growth.freeCashFlowGrowth;
				}

				if (snapshot.dcf) {
					enriched.dcfValue = snapshot.dcf.dcfValue;
					enriched.upsidePercent = snapshot.dcf.upsidePercent;
				}

				if (snapshot.companyRating) {
					enriched.fmpRating = snapshot.companyRating.rating;
					enriched.ratingScore = snapshot.companyRating.ratingScore;
				}
			}
		} catch (error: any) {
			logger.error(
				`[ResearchMetricsEngine] Failed to fetch enriched data for ${symbol}:`,
				error.message,
			);
		}

		return { ...baseMetrics, enriched };
	}
}

export const researchMetricsEngine = new ResearchMetricsEngine();
