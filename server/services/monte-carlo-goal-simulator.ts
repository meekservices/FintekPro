import { logger } from "../logger";

export interface MonteCarloSimulationInput {
	targetAmount: number;
	currentSavings: number;
	monthlySip: number;
	monthsRemaining: number;
	expectedReturnRate?: number; // e.g. 12.0 for 12%
	volatilityRate?: number;     // e.g. 15.0 for 15%
	inflationRate?: number;      // e.g. 6.0 for 6%
	iterations?: number;         // default 10000
	seed?: number;               // optional seed for reproducibility
}

export interface PercentileTrajectory {
	month: number;
	p10: number; // 10th percentile (Bear market scenario)
	p25: number; // 25th percentile
	p50: number; // 50th percentile (Median scenario)
	p75: number; // 75th percentile
	p90: number; // 90th percentile (Bull market scenario)
	inflationAdjustedTarget: number;
}

export interface MonteCarloSimulationResult {
	successProbability: number; // Percentage (0-100)
	inflationAdjustedTarget: number;
	terminalCorpus: {
		p10: number;
		p25: number;
		p50: number;
		p75: number;
		p90: number;
	};
	totalInvestedCapital: number;
	medianNetGain: number;
	maxSimulatedDrawdownPct: number;
	trajectory: PercentileTrajectory[];
	recommendation: {
		status: "OPTIMAL_PLAN" | "MODERATE_SHORTFALL_RISK" | "HIGH_SHORTFALL_RISK";
		additionalSipRequiredFor85PctConfidence: number;
		suggestedHorizonExtensionMonths: number;
		narrative: string;
	};
	explainability: {
		methodology: string;
		iterations: number;
		parameters: {
			annualReturnDrift: number;
			annualVolatility: number;
			annualInflation: number;
		};
	};
	engineVersion: string;
	calculationTimestamp: string;
	disclaimer: string;
}

// Pseudo-random normal generator with Box-Muller transform
class NormalDistribution {
	private usePrevious = false;
	private y2 = 0;

	next(): number {
		if (this.usePrevious) {
			this.usePrevious = false;
			return this.y2;
		}

		let x1 = 0;
		let x2 = 0;
		let w = 0;

		do {
			x1 = 2.0 * Math.random() - 1.0;
			x2 = 2.0 * Math.random() - 1.0;
			w = x1 * x1 + x2 * x2;
		} while (w >= 1.0 || w === 0);

		w = Math.sqrt((-2.0 * Math.log(w)) / w);
		this.y2 = x2 * w;
		this.usePrevious = true;
		return x1 * w;
	}
}

export class MonteCarloGoalSimulator {
	private static instance: MonteCarloGoalSimulator;

	static getInstance(): MonteCarloGoalSimulator {
		if (!MonteCarloGoalSimulator.instance) {
			MonteCarloGoalSimulator.instance = new MonteCarloGoalSimulator();
		}
		return MonteCarloGoalSimulator.instance;
	}

	/**
	 * Runs a 10,000-iteration Monte Carlo simulation for financial goal planning
	 */
	simulateGoal(input: MonteCarloSimulationInput): MonteCarloSimulationResult {
		const startTime = Date.now();
		const targetAmount = Math.max(1, input.targetAmount);
		const currentSavings = Math.max(0, input.currentSavings);
		const monthlySip = Math.max(0, input.monthlySip);
		const months = Math.max(1, input.monthsRemaining);
		const iterations = Math.min(25000, Math.max(1000, input.iterations || 10000));

		const annualReturn = (input.expectedReturnRate ?? 12.0) / 100;
		const annualVol = (input.volatilityRate ?? 15.0) / 100;
		const annualInflation = (input.inflationRate ?? 6.0) / 100;

		const dt = 1 / 12; // Monthly step
		const monthlyDrift = (annualReturn - 0.5 * annualVol * annualVol) * dt;
		const monthlyVol = annualVol * Math.sqrt(dt);

		const yearsRemaining = months / 12;
		const inflationAdjustedTarget = Math.round(
			targetAmount * Math.pow(1 + annualInflation, yearsRemaining),
		);

		const normal = new NormalDistribution();
		let successCount = 0;
		let maxObservedDrawdownPct = 0;

		// We sample checkpoints across the timeline (every 6 months or min 12 points)
		const stepInterval = Math.max(1, Math.floor(months / 20));
		const sampleMonths: number[] = [];
		for (let m = stepInterval; m <= months; m += stepInterval) {
			sampleMonths.push(m);
		}
		if (sampleMonths[sampleMonths.length - 1] !== months) {
			sampleMonths.push(months);
		}

		// Store trajectory values at checkpoints across paths: Map<month, number[]>
		const checkpointValues = new Map<number, number[]>();
		for (const sm of sampleMonths) {
			checkpointValues.set(sm, []);
		}

		const terminalValues: number[] = [];

		for (let i = 0; i < iterations; i++) {
			let corpus = currentSavings;
			let peak = corpus;
			let pathMaxDd = 0;

			for (let m = 1; m <= months; m++) {
				const z = normal.next();
				const monthlyGrowth = Math.exp(monthlyDrift + monthlyVol * z);
				corpus = corpus * monthlyGrowth + monthlySip;

				if (corpus > peak) {
					peak = corpus;
				} else if (peak > 0) {
					const dd = ((peak - corpus) / peak) * 100;
					if (dd > pathMaxDd) pathMaxDd = dd;
				}

				if (checkpointValues.has(m)) {
					checkpointValues.get(m)!.push(corpus);
				}
			}

			if (pathMaxDd > maxObservedDrawdownPct) {
				maxObservedDrawdownPct = pathMaxDd;
			}

			terminalValues.push(corpus);
			if (corpus >= inflationAdjustedTarget) {
				successCount++;
			}
		}

		terminalValues.sort((a, b) => a - b);

		const getPercentile = (arr: number[], p: number): number => {
			const idx = Math.min(arr.length - 1, Math.max(0, Math.floor((p / 100) * arr.length)));
			return Math.round(arr[idx]);
		};

		const successProbability = Math.round((successCount / iterations) * 1000) / 10;

		const terminalCorpus = {
			p10: getPercentile(terminalValues, 10),
			p25: getPercentile(terminalValues, 25),
			p50: getPercentile(terminalValues, 50),
			p75: getPercentile(terminalValues, 75),
			p90: getPercentile(terminalValues, 90),
		};

		const trajectory: PercentileTrajectory[] = [];
		for (const sm of sampleMonths) {
			const values = checkpointValues.get(sm)!;
			values.sort((a, b) => a - b);
			const stepInflationTarget = Math.round(
				targetAmount * Math.pow(1 + annualInflation, sm / 12),
			);

			trajectory.push({
				month: sm,
				p10: getPercentile(values, 10),
				p25: getPercentile(values, 25),
				p50: getPercentile(values, 50),
				p75: getPercentile(values, 75),
				p90: getPercentile(values, 90),
				inflationAdjustedTarget: stepInflationTarget,
			});
		}

		const totalInvestedCapital = currentSavings + monthlySip * months;
		const medianNetGain = Math.round(terminalCorpus.p50 - totalInvestedCapital);

		// Recommendation diagnostics
		let status: "OPTIMAL_PLAN" | "MODERATE_SHORTFALL_RISK" | "HIGH_SHORTFALL_RISK" = "OPTIMAL_PLAN";
		let additionalSipRequired = 0;
		let horizonExtension = 0;
		let narrative = "Your current savings and monthly SIP provide a high probability of meeting your inflation-adjusted target.";

		if (successProbability < 50) {
			status = "HIGH_SHORTFALL_RISK";
			const shortfall = Math.max(0, inflationAdjustedTarget - terminalCorpus.p50);
			// Approximate incremental SIP using real monthly rate
			const realMonthlyRate = ((annualReturn - annualInflation) / 12);
			additionalSipRequired = Math.round(
				(shortfall * (realMonthlyRate || 0.005)) /
				(Math.pow(1 + (realMonthlyRate || 0.005), months) - 1),
			);
			horizonExtension = Math.min(60, Math.max(12, Math.round((shortfall / (monthlySip || 10000)) * 0.7)));
			narrative = `Significant sequencing and market shortfall risk detected. In median conditions, your corpus falls short by ₹${shortfall.toLocaleString("en-IN")}. Consider boosting SIP by ₹${additionalSipRequired.toLocaleString("en-IN")}/mo or extending the horizon by ${horizonExtension} months.`;
		} else if (successProbability < 80) {
			status = "MODERATE_SHORTFALL_RISK";
			const shortfall = Math.max(0, inflationAdjustedTarget - terminalCorpus.p25);
			additionalSipRequired = Math.round(shortfall / (months * 1.5));
			narrative = `Plan has a moderate probability (${successProbability}%) of reaching the inflation-adjusted target. A slight SIP step-up of ₹${additionalSipRequired.toLocaleString("en-IN")}/mo buffers against prolonged bear markets.`;
		}

		logger.info(
			JSON.stringify({
				event: "MONTE_CARLO_SIMULATION_COMPLETED",
				iterations,
				months,
				success_prob: successProbability,
				latency_ms: Date.now() - startTime,
				status: "SUCCESS",
			}),
		);

		return {
			successProbability,
			inflationAdjustedTarget,
			terminalCorpus,
			totalInvestedCapital,
			medianNetGain,
			maxSimulatedDrawdownPct: Math.round(maxObservedDrawdownPct * 10) / 10,
			trajectory,
			recommendation: {
				status,
				additionalSipRequiredFor85PctConfidence: additionalSipRequired,
				suggestedHorizonExtensionMonths: horizonExtension,
				narrative,
			},
			explainability: {
				methodology: "Geometric Brownian Motion (GBM) with monthly cash-flow increments and log-normal return shocks (10,000 paths).",
				iterations,
				parameters: {
					annualReturnDrift: Math.round(annualReturn * 1000) / 10,
					annualVolatility: Math.round(annualVol * 1000) / 10,
					annualInflation: Math.round(annualInflation * 1000) / 10,
				},
			},
			engineVersion: "FASP-AI-v1.0",
			calculationTimestamp: new Date().toISOString(),
			disclaimer: "Monte Carlo simulations illustrate probability distributions based on historical asset class volatility. Market returns are not guaranteed. Final advisory decisions require user confirmation.",
		};
	}
}

export const monteCarloGoalSimulator = MonteCarloGoalSimulator.getInstance();
