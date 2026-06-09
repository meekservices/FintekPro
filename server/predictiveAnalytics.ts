import type { PortfolioHolding, InsertAssetForecast } from "@shared/schema";

// Statistical helper functions
class PredictiveAnalytics {
	// Calculate Compound Annual Growth Rate
	calculateCAGR(startValue: number, endValue: number, years: number): number {
		if (startValue <= 0 || years <= 0) return 0;
		return ((endValue / startValue) ** (1 / years) - 1) * 100;
	}

	// Calculate volatility (standard deviation of returns)
	calculateVolatility(returns: number[]): number {
		if (returns.length < 2) return 0;
		const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
		const squaredDiffs = returns.map((r) => (r - mean) ** 2);
		const variance =
			squaredDiffs.reduce((sum, sd) => sum + sd, 0) / returns.length;
		return Math.sqrt(variance) * Math.sqrt(252); // Annualized
	}

	// Calculate Sharpe Ratio (risk-adjusted return)
	calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.05): number {
		const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
		const volatility = this.calculateVolatility(returns);
		if (volatility === 0) return 0;
		return ((avgReturn - riskFreeRate) / volatility) * Math.sqrt(252);
	}

	// Calculate Beta (market correlation)
	calculateBeta(assetReturns: number[], marketReturns: number[]): number {
		if (assetReturns.length !== marketReturns.length || assetReturns.length < 2)
			return 1.0;

		const meanAsset =
			assetReturns.reduce((sum, r) => sum + r, 0) / assetReturns.length;
		const meanMarket =
			marketReturns.reduce((sum, r) => sum + r, 0) / marketReturns.length;

		let covariance = 0;
		let marketVariance = 0;

		for (let i = 0; i < assetReturns.length; i++) {
			covariance +=
				(assetReturns[i] - meanAsset) * (marketReturns[i] - meanMarket);
			marketVariance += (marketReturns[i] - meanMarket) ** 2;
		}

		if (marketVariance === 0) return 1.0;
		return covariance / marketVariance;
	}

	// Calculate Value at Risk (VaR) at 95% confidence
	calculateVaR(
		portfolioValue: number,
		volatility: number,
		confidenceLevel: number = 0.95,
	): number {
		const zScore =
			confidenceLevel === 0.95 ? 1.65 : confidenceLevel === 0.99 ? 2.33 : 1.65;
		return (portfolioValue * volatility * zScore) / Math.sqrt(252);
	}

	// Calculate Maximum Drawdown
	calculateMaxDrawdown(values: number[]): number {
		if (values.length < 2) return 0;

		let maxDrawdown = 0;
		let peak = values[0];

		for (const value of values) {
			if (value > peak) {
				peak = value;
			}
			const drawdown = (peak - value) / peak;
			maxDrawdown = Math.max(maxDrawdown, drawdown);
		}

		return maxDrawdown * 100;
	}

	// Calculate moving average
	calculateMovingAverage(prices: number[], period: number): number {
		if (prices.length < period) return prices[prices.length - 1] || 0;
		const recentPrices = prices.slice(-period);
		return recentPrices.reduce((sum, p) => sum + p, 0) / period;
	}

	// Calculate RSI (Relative Strength Index)
	calculateRSI(prices: number[], period: number = 14): number {
		if (prices.length < period + 1) return 50;

		const changes = [];
		for (let i = 1; i < prices.length; i++) {
			changes.push(prices[i] - prices[i - 1]);
		}

		const recentChanges = changes.slice(-period);
		const gains =
			recentChanges.filter((c) => c > 0).reduce((sum, c) => sum + c, 0) /
			period;
		const losses =
			Math.abs(
				recentChanges.filter((c) => c < 0).reduce((sum, c) => sum + c, 0),
			) / period;

		if (losses === 0) return 100;
		const rs = gains / losses;
		return 100 - 100 / (1 + rs);
	}

	// Calculate momentum
	calculateMomentum(prices: number[], period: number = 20): number {
		if (prices.length < period + 1) return 0;
		const currentPrice = prices[prices.length - 1];
		const oldPrice = prices[prices.length - period - 1];
		return ((currentPrice - oldPrice) / oldPrice) * 100;
	}

	// Predict future value using exponential smoothing
	predictFutureValue(
		historicalValues: number[],
		horizon: string,
		confidenceLevel: number = 0.95,
	): { predicted: number; lowerBound: number; upperBound: number } {
		if (historicalValues.length < 2) {
			const currentValue = historicalValues[0] || 0;
			return {
				predicted: currentValue,
				lowerBound: currentValue * 0.8,
				upperBound: currentValue * 1.2,
			};
		}

		// Simple exponential smoothing with alpha = 0.3
		const alpha = 0.3;
		let smoothed = historicalValues[0];

		for (let i = 1; i < historicalValues.length; i++) {
			smoothed = alpha * historicalValues[i] + (1 - alpha) * smoothed;
		}

		// Calculate forecast based on horizon
		const horizonMonths = this.parseHorizon(horizon);
		const avgGrowthRate = this.calculateAverageGrowthRate(historicalValues);
		const predicted =
			smoothed * (1 + avgGrowthRate / 100) ** (horizonMonths / 12);

		// Calculate confidence interval
		const volatility = this.calculateVolatility(
			this.calculateReturns(historicalValues),
		);
		const margin =
			volatility *
			Math.sqrt(horizonMonths / 12) *
			(confidenceLevel === 0.95 ? 1.96 : 2.58);

		return {
			predicted,
			lowerBound: predicted * (1 - margin),
			upperBound: predicted * (1 + margin),
		};
	}

	// Determine trend direction
	analyzeTrend(prices: number[]): { direction: string; strength: number } {
		if (prices.length < 50) {
			return { direction: "neutral", strength: 50 };
		}

		const ma50 = this.calculateMovingAverage(prices, 50);
		const ma200 = this.calculateMovingAverage(prices, 200);
		const currentPrice = prices[prices.length - 1];
		const momentum = this.calculateMomentum(prices, 20);

		let direction: string;
		let strength: number;

		if (currentPrice > ma50 && ma50 > ma200) {
			direction = "bullish";
			strength = Math.min(100, 50 + Math.abs(momentum));
		} else if (currentPrice < ma50 && ma50 < ma200) {
			direction = "bearish";
			strength = Math.min(100, 50 + Math.abs(momentum));
		} else {
			direction = "neutral";
			strength = 50;
		}

		return { direction, strength };
	}

	// Generate buy/sell recommendation
	generateRecommendation(
		currentPrice: number,
		predictedPrice: number,
		rsi: number,
		trend: string,
	): { recommendation: string; reason: string } {
		const priceChange = ((predictedPrice - currentPrice) / currentPrice) * 100;

		if (priceChange > 15 && rsi < 70 && trend === "bullish") {
			return {
				recommendation: "strong_buy",
				reason: `Strong upward momentum with ${priceChange.toFixed(1)}% predicted growth. RSI at ${rsi.toFixed(1)} indicates room for growth.`,
			};
		}
		if (priceChange > 5 && rsi < 75) {
			return {
				recommendation: "buy",
				reason: `Positive trend with ${priceChange.toFixed(1)}% expected return. Technical indicators favorable.`,
			};
		}
		if (priceChange < -15 || rsi > 80) {
			return {
				recommendation: "strong_sell",
				reason: `Significant downside risk (${priceChange.toFixed(1)}%) or overbought conditions (RSI: ${rsi.toFixed(1)}).`,
			};
		}
		if (priceChange < -5 || rsi > 70) {
			return {
				recommendation: "sell",
				reason: `Negative outlook with potential ${priceChange.toFixed(1)}% decline. Consider reducing exposure.`,
			};
		}
		return {
			recommendation: "hold",
			reason: `Stable outlook with ${priceChange.toFixed(1)}% expected change. Maintain current position.`,
		};
	}

	// Calculate diversification score
	calculateDiversificationScore(holdings: PortfolioHolding[]): number {
		if (holdings.length === 0) return 0;
		if (holdings.length === 1) return 20;

		const totalValue = holdings.reduce(
			(sum, h) => sum + Number.parseFloat(h.currentValue ?? "0"),
			0,
		);

		// Calculate Herfindahl-Hirschman Index (HHI)
		let hhi = 0;
		for (const holding of holdings) {
			const marketShare =
				Number.parseFloat(holding.currentValue ?? "0") / totalValue;
			hhi += marketShare * marketShare;
		}

		// Convert HHI to diversification score (0-100)
		const diversificationScore = (1 - hhi) * 100;
		return Math.max(0, Math.min(100, diversificationScore * 1.5)); // Scale for better distribution
	}

	// Helper functions
	private parseHorizon(horizon: string): number {
		const match = horizon.match(/(\d+)([MY])/);
		if (!match) return 12;
		const value = Number.parseInt(match[1]);
		const unit = match[2];
		return unit === "Y" ? value * 12 : value;
	}

	private calculateReturns(values: number[]): number[] {
		const returns = [];
		for (let i = 1; i < values.length; i++) {
			returns.push((values[i] - values[i - 1]) / values[i - 1]);
		}
		return returns;
	}

	private calculateAverageGrowthRate(values: number[]): number {
		if (values.length < 2) return 0;
		const returns = this.calculateReturns(values);
		return (returns.reduce((sum, r) => sum + r, 0) / returns.length) * 100;
	}

	// Calculate concentration risk
	calculateConcentrationRisk(holdings: PortfolioHolding[]): number {
		if (holdings.length === 0) return 100;

		const totalValue = holdings.reduce(
			(sum, h) => sum + Number.parseFloat(h.currentValue ?? "0"),
			0,
		);
		const maxHolding = Math.max(
			...holdings.map((h) => Number.parseFloat(h.currentValue ?? "0")),
		);
		const concentration = (maxHolding / totalValue) * 100;

		return Math.min(100, concentration);
	}

	// Run stress test scenarios
	runStressTests(portfolioValue: number, holdings: PortfolioHolding[]) {
		return {
			marketCrashScenario: {
				scenario: "20% Market Crash",
				impactOnPortfolio: -portfolioValue * 0.2,
				newValue: portfolioValue * 0.8,
				recoveryTime: "12-18 months",
				impactedAssets: holdings.filter((h) => h.assetType === "stock").length,
			},
			recessionScenario: {
				scenario: "Economic Recession",
				impactOnPortfolio: -portfolioValue * 0.15,
				newValue: portfolioValue * 0.85,
				recoveryTime: "18-24 months",
				impactedSectors: [
					"Technology",
					"Real Estate",
					"Consumer Discretionary",
				],
			},
			interestRateRise: {
				scenario: "2% Interest Rate Increase",
				impactOnPortfolio: -portfolioValue * 0.08,
				newValue: portfolioValue * 0.92,
				mostAffectedAssets: holdings.filter((h) => h.assetType === "bond"),
			},
			inflationScenario: {
				scenario: "6% High Inflation",
				realReturnImpact: -6.0,
				hedgeRecommendations: [
					"Commodities",
					"Real Estate",
					"Inflation-Protected Securities",
				],
			},
		};
	}
}

export const predictiveAnalytics = new PredictiveAnalytics();
