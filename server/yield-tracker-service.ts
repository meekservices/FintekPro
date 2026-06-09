// @ts-nocheck
import { storage } from "./storage";
import type { YieldTracker, InsertYieldTracker } from "@shared/schema";

export interface YieldMetrics {
	totalReturn: number;
	annualizedReturn: number;
	volatility: number;
	sharpeRatio: number;
	maxDrawdown: number;
	beta: number;
	alpha: number;
	informationRatio: number;
	calmarRatio: number;
	sortinoRatio: number;
}

export interface BenchmarkComparison {
	benchmark: string;
	benchmarkReturn: number;
	activeReturn: number;
	trackingError: number;
	upCaptureRatio: number;
	downCaptureRatio: number;
}

export interface PerformanceAnalysis {
	period: string;
	startDate: Date;
	endDate: Date;
	metrics: YieldMetrics;
	benchmarkComparison: BenchmarkComparison;
	monthlyReturns: Array<{
		month: string;
		return: number;
		benchmarkReturn: number;
		activeReturn: number;
	}>;
	riskMetrics: {
		var95: number;
		var99: number;
		cvar95: number;
		cvar99: number;
		skewness: number;
		kurtosis: number;
	};
}

export class YieldTrackerService {
	private static riskFreeRate = 0.065; // 6.5% risk-free rate
	private static benchmarkReturns = {
		NIFTY50: 0.12,
		SENSEX: 0.115,
		NIFTY_MIDCAP: 0.135,
		NIFTY_SMALLCAP: 0.145,
		NIFTY_BANK: 0.125,
	};

	// Create a new yield tracker
	static async createTracker(
		userId: string,
		trackerData: Partial<YieldTracker>,
	): Promise<YieldTracker> {
		const tracker: InsertYieldTracker = {
			userId,
			portfolioId: trackerData.portfolioId || null,
			investmentId: trackerData.investmentId || null,
			symbol: trackerData.symbol || "",
			instrumentType: trackerData.instrumentType || "equity",
			initialInvestment: trackerData.initialInvestment || "0",
			totalInvestment: trackerData.totalInvestment || "0",
			currentValue: trackerData.currentValue || "0",
			unitsHeld: trackerData.unitsHeld || "0",
			averagePurchasePrice: trackerData.averagePurchasePrice || "0",
			currentPrice: trackerData.currentPrice || "0",
			totalDividends: trackerData.totalDividends || "0",
			totalInterest: trackerData.totalInterest || "0",
			totalCharges: trackerData.totalCharges || "0",
			purchaseDate: trackerData.purchaseDate || new Date(),
			benchmark: trackerData.benchmark || "NIFTY50",
			riskProfile: trackerData.riskProfile || "moderate",
			targetYield: trackerData.targetYield || "0",
			priceHistory: trackerData.priceHistory || [],
			performanceHistory: trackerData.performanceHistory || [],
			lastUpdated: new Date(),
		};

		return await storage.createYieldTracker(tracker);
	}

	// Update tracker with latest market data
	static async updateTrackerPrice(
		trackerId: string,
		currentPrice: number,
		marketData: any = {},
	): Promise<YieldTracker | undefined> {
		const tracker = await storage.getYieldTracker(trackerId);
		if (!tracker) return undefined;

		const currentValue = Number(tracker.unitsHeld || 0) * currentPrice;
		const totalInvestmentNum = Number(tracker.totalInvestment || 1);
		const totalDividendsNum = Number(tracker.totalDividends || 0);
		const totalInterestNum = Number(tracker.totalInterest || 0);
		const totalChargesNum = Number(tracker.totalCharges || 0);

		const totalReturn =
			((currentValue + totalDividendsNum + totalInterestNum - totalChargesNum) /
				totalInvestmentNum -
				1) *
			100;

		// Update price history
		const priceHistory = [...(tracker.priceHistory || [])];
		priceHistory.push({
			date: new Date().toISOString(),
			price: currentPrice,
			volume: marketData.volume || 0,
			change: currentPrice - Number(tracker.currentPrice || 0),
			changePercent:
				((currentPrice - Number(tracker.currentPrice || 0)) /
					(Number(tracker.currentPrice) || 1)) *
				100,
		});

		// Keep only last 365 days of price history
		if (priceHistory.length > 365) {
			priceHistory.splice(0, priceHistory.length - 365);
		}

		const updates: Partial<YieldTracker> = {
			currentPrice: currentPrice.toString(),
			currentValue: currentValue.toString(),
			totalReturn: totalReturn.toString(),
			priceHistory,
			lastUpdated: new Date(),
		};

		return await storage.updateYieldTracker(trackerId, updates);
	}

	// Calculate comprehensive yield metrics
	static calculateYieldMetrics(tracker: YieldTracker): YieldMetrics {
		const returns = YieldTrackerService.calculateReturns(
			tracker.priceHistory || [],
		);
		const daysHeld = Math.max(
			1,
			(new Date().getTime() - new Date(tracker.createdAt!).getTime()) /
				(1000 * 60 * 60 * 24),
		);

		const totalReturn = Number(tracker.totalReturn) || 0;
		const annualizedReturn = (1 + totalReturn / 100) ** (365 / daysHeld) - 1;
		const volatility = YieldTrackerService.calculateVolatility(returns);
		const maxDrawdown = YieldTrackerService.calculateMaxDrawdown(
			tracker.priceHistory || [],
		);

		// Risk-adjusted metrics
		const excessReturn = annualizedReturn - YieldTrackerService.riskFreeRate;
		const sharpeRatio = volatility > 0 ? excessReturn / volatility : 0;

		// Beta calculation (simplified using benchmark correlation)
		const benchmarkValue = tracker.benchmark || "NIFTY50";
		const benchmarkReturn =
			YieldTrackerService.benchmarkReturns[
				benchmarkValue as keyof typeof YieldTrackerService.benchmarkReturns
			] || 0.12;
		const beta = YieldTrackerService.calculateBeta(returns, benchmarkReturn);
		const alpha =
			annualizedReturn -
			(YieldTrackerService.riskFreeRate +
				beta * (benchmarkReturn - YieldTrackerService.riskFreeRate));

		const downDeviation =
			YieldTrackerService.calculateDownsideDeviation(returns);
		const sortinoRatio = downDeviation > 0 ? excessReturn / downDeviation : 0;
		const calmarRatio =
			maxDrawdown > 0 ? annualizedReturn / Math.abs(maxDrawdown) : 0;

		return {
			totalReturn,
			annualizedReturn,
			volatility,
			sharpeRatio,
			maxDrawdown,
			beta,
			alpha,
			informationRatio: 0, // Simplified
			calmarRatio,
			sortinoRatio,
		};
	}

	// Calculate benchmark comparison
	static calculateBenchmarkComparison(
		tracker: YieldTracker,
	): BenchmarkComparison {
		const benchmarkValue = tracker.benchmark || "NIFTY50";
		const benchmarkReturn =
			YieldTrackerService.benchmarkReturns[
				benchmarkValue as keyof typeof YieldTrackerService.benchmarkReturns
			] || 0.12;
		const trackerReturn = (Number(tracker.totalReturn) || 0) / 100;
		const activeReturn = trackerReturn - benchmarkReturn;

		// Simplified tracking error calculation
		const trackingError = Math.abs(activeReturn) * 0.5; // Placeholder calculation

		return {
			benchmark: benchmarkValue,
			benchmarkReturn: benchmarkReturn * 100,
			activeReturn: activeReturn * 100,
			trackingError: trackingError * 100,
			upCaptureRatio:
				trackerReturn > 0
					? (trackerReturn / Math.max(benchmarkReturn, 0.01)) * 100
					: 0,
			downCaptureRatio:
				trackerReturn < 0
					? (Math.abs(trackerReturn) /
							Math.max(Math.abs(benchmarkReturn), 0.01)) *
						100
					: 0,
		};
	}

	// Generate comprehensive performance analysis
	static async generatePerformanceAnalysis(
		userId: string,
		period: string = "1Y",
	): Promise<PerformanceAnalysis[]> {
		const trackers = await storage.getYieldTrackers(userId);
		const analyses: PerformanceAnalysis[] = [];

		for (const tracker of trackers) {
			const metrics = YieldTrackerService.calculateYieldMetrics(tracker);
			const benchmarkComparison =
				YieldTrackerService.calculateBenchmarkComparison(tracker);
			const riskMetrics = YieldTrackerService.calculateRiskMetrics(
				tracker.priceHistory || [],
			);
			const monthlyReturns = YieldTrackerService.calculateMonthlyReturns(
				tracker.priceHistory || [],
			);

			const endDate = new Date();
			const startDate = new Date();
			startDate.setFullYear(endDate.getFullYear() - 1); // Default 1 year

			analyses.push({
				period,
				startDate,
				endDate,
				metrics,
				benchmarkComparison,
				monthlyReturns,
				riskMetrics,
			});
		}

		return analyses;
	}

	// Calculate portfolio-level yield metrics
	static async calculatePortfolioYield(
		userId: string,
		portfolioId?: string,
	): Promise<{
		totalValue: number;
		totalInvestment: number;
		totalReturn: number;
		weightedYield: number;
		diversificationRatio: number;
		sectorAllocation: Record<string, number>;
	}> {
		const trackers = await storage.getYieldTrackers(userId);
		const portfolioTrackers = portfolioId
			? trackers.filter((t) => t.portfolioId === portfolioId)
			: trackers;

		const totalValue = portfolioTrackers.reduce(
			(sum, t) => sum + (Number(t.currentValue) || 0),
			0,
		);
		const totalInvestment = portfolioTrackers.reduce(
			(sum, t) => sum + Number(t.totalInvestment || 0),
			0,
		);
		const totalReturn =
			totalInvestment > 0
				? ((totalValue - totalInvestment) / totalInvestment) * 100
				: 0;

		// Calculate weighted yield
		const weightedYield = portfolioTrackers.reduce((sum, t) => {
			const weight = Number(t.totalInvestment || 0) / totalInvestment;
			return sum + weight * (Number(t.totalReturn) || 0);
		}, 0);

		// Calculate diversification metrics
		const sectorAllocation: Record<string, number> = {};
		portfolioTrackers.forEach((t) => {
			const sector = t.strategyType || "other";
			sectorAllocation[sector] =
				(sectorAllocation[sector] || 0) + Number(t.totalInvestment || 0);
		});

		// Normalize sector allocation to percentages
		Object.keys(sectorAllocation).forEach((sector) => {
			sectorAllocation[sector] =
				(sectorAllocation[sector] / totalInvestment) * 100;
		});

		// Simplified diversification ratio
		const numInstruments = portfolioTrackers.length;
		const concentrationRisk =
			numInstruments > 0
				? Math.max(...Object.values(sectorAllocation)) / 100
				: 0;
		const diversificationRatio =
			numInstruments > 0 ? ((1 - concentrationRisk) * numInstruments) / 10 : 0;

		return {
			totalValue,
			totalInvestment,
			totalReturn,
			weightedYield,
			diversificationRatio,
			sectorAllocation,
		};
	}

	// Helper methods for calculations
	private static calculateReturns(priceHistory: any[]): number[] {
		if (priceHistory.length < 2) return [];

		const returns: number[] = [];
		for (let i = 1; i < priceHistory.length; i++) {
			const currentPrice = priceHistory[i].price;
			const previousPrice = priceHistory[i - 1].price;
			if (previousPrice > 0) {
				returns.push((currentPrice - previousPrice) / previousPrice);
			}
		}
		return returns;
	}

	private static calculateVolatility(returns: number[]): number {
		if (returns.length < 2) return 0;

		const mean =
			returns.reduce((sum: any, r: any) => sum + r, 0) / returns.length;
		const variance =
			returns.reduce((sum: any, r: any) => sum + (r - mean) ** 2, 0) /
			(returns.length - 1);
		return Math.sqrt(variance * 252); // Annualized volatility
	}

	private static calculateMaxDrawdown(priceHistory: any[]): number {
		if (priceHistory.length < 2) return 0;

		let maxPrice = priceHistory[0].price;
		let maxDrawdown = 0;

		for (const point of priceHistory) {
			if (point.price > maxPrice) {
				maxPrice = point.price;
			}
			const drawdown = (point.price - maxPrice) / maxPrice;
			if (drawdown < maxDrawdown) {
				maxDrawdown = drawdown;
			}
		}

		return maxDrawdown * 100;
	}

	private static calculateBeta(
		returns: number[],
		benchmarkReturn: number,
	): number {
		// Simplified beta calculation
		if (returns.length === 0) return 1;

		const meanReturn =
			returns.reduce((sum: any, r: any) => sum + r, 0) / returns.length;
		const covariance =
			returns.reduce(
				(sum: any, r: any) => sum + (r - meanReturn) * (benchmarkReturn - 0.12),
				0,
			) / returns.length;
		const benchmarkVariance = 0.05 ** 2; // Assumed benchmark volatility

		return benchmarkVariance > 0 ? covariance / benchmarkVariance : 1;
	}

	private static calculateDownsideDeviation(returns: number[]): number {
		if (returns.length === 0) return 0;

		const downsideReturns = returns.filter((r: any) => r < 0);
		if (downsideReturns.length === 0) return 0;

		const meanDownside =
			downsideReturns.reduce((sum: any, r: any) => sum + r, 0) /
			downsideReturns.length;
		const downsideVariance =
			downsideReturns.reduce(
				(sum: any, r: any) => sum + (r - meanDownside) ** 2,
				0,
			) / downsideReturns.length;

		return Math.sqrt(downsideVariance * 252);
	}

	private static calculateRiskMetrics(priceHistory: any[]): any {
		const returns = YieldTrackerService.calculateReturns(priceHistory);
		if (returns.length === 0) {
			return {
				var95: 0,
				var99: 0,
				cvar95: 0,
				cvar99: 0,
				skewness: 0,
				kurtosis: 0,
			};
		}

		const sortedReturns = [...returns].sort((a: any, b: any) => a - b);
		const var95Index = Math.floor(returns.length * 0.05);
		const var99Index = Math.floor(returns.length * 0.01);

		const var95 = sortedReturns[var95Index] || 0;
		const var99 = sortedReturns[var99Index] || 0;

		// Conditional VaR (Expected Shortfall)
		const cvar95 =
			var95Index > 0
				? sortedReturns
						.slice(0, var95Index)
						.reduce((sum: any, r: any) => sum + r, 0) / var95Index
				: 0;
		const cvar99 =
			var99Index > 0
				? sortedReturns
						.slice(0, var99Index)
						.reduce((sum: any, r: any) => sum + r, 0) / var99Index
				: 0;

		// Skewness and Kurtosis
		const mean =
			returns.reduce((sum: any, r: any) => sum + r, 0) / returns.length;
		const variance =
			returns.reduce((sum: any, r: any) => sum + (r - mean) ** 2, 0) /
			returns.length;
		const std = Math.sqrt(variance);

		const skewness =
			std > 0
				? returns.reduce(
						(sum: any, r: any) => sum + ((r - mean) / std) ** 3,
						0,
					) / returns.length
				: 0;
		const kurtosis =
			std > 0
				? returns.reduce(
						(sum: any, r: any) => sum + ((r - mean) / std) ** 4,
						0,
					) /
						returns.length -
					3
				: 0;

		return {
			var95: var95 * 100,
			var99: var99 * 100,
			cvar95: cvar95 * 100,
			cvar99: cvar99 * 100,
			skewness,
			kurtosis,
		};
	}

	private static calculateMonthlyReturns(priceHistory: any[]): Array<{
		month: string;
		return: number;
		benchmarkReturn: number;
		activeReturn: number;
	}> {
		// Simplified monthly returns calculation
		const monthlyReturns = [];
		const months = [
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Oct",
			"Nov",
			"Dec",
		];

		for (let i = 0; i < 12; i++) {
			const monthReturn = Math.random() * 4 - 2; // Mock data for now
			const benchmarkReturn = Math.random() * 3 - 1;

			monthlyReturns.push({
				month: months[i],
				return: monthReturn,
				benchmarkReturn,
				activeReturn: monthReturn - benchmarkReturn,
			});
		}

		return monthlyReturns;
	}

	// Portfolio optimization suggestions
	static async generateOptimizationSuggestions(userId: string): Promise<
		Array<{
			type: "rebalance" | "diversify" | "risk_adjust" | "yield_enhance";
			priority: "high" | "medium" | "low";
			description: string;
			expectedImpact: string;
			actionRequired: string;
		}>
	> {
		const portfolioYield =
			await YieldTrackerService.calculatePortfolioYield(userId);
		const suggestions: Array<{
			type: "rebalance" | "diversify" | "risk_adjust" | "yield_enhance";
			priority: "high" | "medium" | "low";
			description: string;
			expectedImpact: string;
			actionRequired: string;
		}> = [];

		// Concentration risk check
		const maxAllocation = Math.max(
			...Object.values(portfolioYield.sectorAllocation),
		);
		if (maxAllocation > 30) {
			suggestions.push({
				type: "diversify",
				priority: "high",
				description: `High concentration risk detected: ${maxAllocation.toFixed(1)}% in single sector`,
				expectedImpact: "Reduce portfolio volatility by 15-25%",
				actionRequired: "Diversify holdings across sectors",
			});
		}

		// Low diversification ratio
		if (portfolioYield.diversificationRatio < 0.6) {
			suggestions.push({
				type: "diversify",
				priority: "medium",
				description: "Portfolio lacks sufficient diversification",
				expectedImpact: "Improve risk-adjusted returns",
				actionRequired: "Add holdings from underrepresented sectors",
			});
		}

		// Rebalancing suggestion
		suggestions.push({
			type: "rebalance",
			priority: "medium",
			description: "Quarterly rebalancing recommended",
			expectedImpact: "Maintain target allocation and risk profile",
			actionRequired: "Review and adjust position sizes",
		});

		return suggestions;
	}
}

export const yieldTrackerService = YieldTrackerService;
