export interface MonteCarloConfig {
	portfolioVolatility: number; // e.g. 0.18 for 18%
	expectedAnnualReturn: number; // e.g. 0.10 for 10%
	timeHorizonYears: number;
}

export interface MonteCarloResult {
	expectedReturn: number;
	volatility: number;
	maxDrawdown: number;
	valueAtRisk95: number;
	confidenceIntervals: {
		p5: number; // 5th percentile worst outcome
		p50: number; // Median
		p95: number; // 95th percentile best outcome
	};
}

export class MonteCarloSimulator {
	private readonly NUM_SIMULATIONS = 1000;
	private readonly TRADING_DAYS_PER_YEAR = 252;

	/**
	 * Generates a Geometric Brownian Motion (GBM) probability trace array
	 */
	public simulatePortfolio(config: MonteCarloConfig): MonteCarloResult {
		const dt = config.timeHorizonYears / this.TRADING_DAYS_PER_YEAR;
		const finalValues: number[] = [];
		const maxDrawdowns: number[] = [];

		// Drift & Diffusion components for standard GBM Math
		const drift =
			(config.expectedAnnualReturn - 0.5 * config.portfolioVolatility ** 2) *
			dt;
		const diffusion = config.portfolioVolatility * Math.sqrt(dt);

		for (let sim = 0; sim < this.NUM_SIMULATIONS; sim++) {
			let currentValue = 1.0; // Start proxy at $1
			let localPeak = 1.0;
			let maxDrawdown = 0;

			for (let day = 0; day < this.TRADING_DAYS_PER_YEAR; day++) {
				// Standard normal random variable using Box-Muller transform
				const z = this.generateStandardNormal();

				currentValue = currentValue * Math.exp(drift + diffusion * z);

				// Track local drawdowns
				if (currentValue > localPeak) {
					localPeak = currentValue;
				}
				const drawdown = (localPeak - currentValue) / localPeak;
				if (drawdown > maxDrawdown) {
					maxDrawdown = drawdown;
				}
			}

			finalValues.push(currentValue);
			maxDrawdowns.push(maxDrawdown);
		}

		finalValues.sort((a, b) => a - b); // Sort ascending (worst to best)

		// Parse distribution arrays
		const p5Index = Math.floor(this.NUM_SIMULATIONS * 0.05);
		const p50Index = Math.floor(this.NUM_SIMULATIONS * 0.5);
		const p95Index = Math.floor(this.NUM_SIMULATIONS * 0.95);

		const medianReturn = finalValues[p50Index] - 1.0; // convert $ proxy back to percentage growth
		const worstCaseReturn = finalValues[p5Index] - 1.0;

		// Value at Risk 95% = The threshold where 95% of outcomes are BETTER
		const valueAtRisk95 = worstCaseReturn;

		// Average all max drawdowns captured over paths
		const avgMaxDrawdown =
			maxDrawdowns.reduce((a, b) => a + b, 0) / this.NUM_SIMULATIONS;

		return {
			expectedReturn: medianReturn,
			volatility: config.portfolioVolatility,
			maxDrawdown: avgMaxDrawdown,
			valueAtRisk95: valueAtRisk95,
			confidenceIntervals: {
				p5: worstCaseReturn,
				p50: medianReturn,
				p95: finalValues[p95Index] - 1.0,
			},
		};
	}

	// Box-Muller transform for standard normal distribution Z-scores
	private generateStandardNormal(): number {
		let u = 0,
			v = 0;
		while (u === 0) u = Math.random();
		while (v === 0) v = Math.random();
		return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
	}
}

export const monteCarloEngine = new MonteCarloSimulator();
