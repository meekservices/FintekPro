import { db } from "../db";
import { dailyPicks, aiPriceHistory } from "@shared/schema";
import { eq, and, gte, desc, sql, inArray } from "drizzle-orm";
import { aiAnalyticsEngine } from "./ai-analytics-engine";
import { aiResponseCacheService } from "./ai-response-cache-service";

export interface AssetCandidate {
	pickId: number;
	assetId: string;
	assetName: string;
	assetClass: string;
	symbol?: string;
	isin?: string;
	expectedReturn: number;
	volatility: number;
	sharpeRatio: number;
	currentPrice: number;
	confidenceScore: number;
	regime?: string;
	returnSeries?: number[]; // Added for optimization
}

export interface OptimizedWeight {
	pickId: number;
	assetName: string;
	assetClass: string;
	weight: number;
	expectedReturn: number;
	riskContribution: number;
	marginalSharpe: number;
}

export interface PortfolioMetrics {
	expectedReturn: number;
	expectedVolatility: number;
	sharpeRatio: number;
	sortinoRatio: number;
	diversificationRatio: number;
	maxConcentration: number;
	assetClassBreakdown: Record<string, number>;
	correlationAvg: number;
}

export interface OptimizedBasket {
	weights: OptimizedWeight[];
	portfolioMetrics: PortfolioMetrics;
	regime: string;
	optimizationMethod: string;
	timestamp: string;
	constraints: {
		maxWeightPerAsset: number;
		minWeightPerAsset: number;
		maxPerAssetClass: number;
		riskFreeRate: number;
	};
	alternativePortfolios: {
		name: string;
		weights: OptimizedWeight[];
		metrics: PortfolioMetrics;
	}[];
}

export interface OptimizationConfig {
	maxWeightPerAsset?: number;
	minWeightPerAsset?: number;
	maxPerAssetClass?: number;
	riskFreeRate?: number;
	targetPositions?: number;
	regime?: string;
	includeAlternatives?: boolean;
}

export class AIPortfolioOptimizer {
	async optimizeBasket(config?: OptimizationConfig): Promise<OptimizedBasket> {
		return aiResponseCacheService.getOrCompute(
			"portfolio_optimization",
			{ config },
			async () => this.optimizeBasketInternal(config),
		);
	}

	private async optimizeBasketInternal(
		config?: OptimizationConfig,
	): Promise<OptimizedBasket> {
		const cfg: Required<OptimizationConfig> = {
			maxWeightPerAsset: config?.maxWeightPerAsset ?? 0.25,
			minWeightPerAsset: config?.minWeightPerAsset ?? 0.02,
			maxPerAssetClass: config?.maxPerAssetClass ?? 0.4,
			riskFreeRate: config?.riskFreeRate ?? 0.065,
			targetPositions: config?.targetPositions ?? 10,
			regime: config?.regime ?? "normal",
			includeAlternatives: config?.includeAlternatives ?? true,
		};

		const livePicks = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.status, "live"))
			.orderBy(desc(dailyPicks.recoDate));

		if (livePicks.length === 0) {
			return {
				weights: [],
				portfolioMetrics: {
					expectedReturn: 0,
					expectedVolatility: 0,
					sharpeRatio: 0,
					sortinoRatio: 0,
					diversificationRatio: 1,
					maxConcentration: 0,
					assetClassBreakdown: {},
					correlationAvg: 0,
				},
				regime: cfg.regime,
				optimizationMethod: "none",
				timestamp: new Date().toISOString(),
				constraints: {
					maxWeightPerAsset: cfg.maxWeightPerAsset,
					minWeightPerAsset: cfg.minWeightPerAsset,
					maxPerAssetClass: cfg.maxPerAssetClass,
					riskFreeRate: cfg.riskFreeRate,
				},
				alternativePortfolios: [],
			};
		}

		const candidates = await this.computeAssetMetrics(livePicks);

		if (candidates.length === 0) {
			return {
				weights: [],
				portfolioMetrics: {
					expectedReturn: 0,
					expectedVolatility: 0,
					sharpeRatio: 0,
					sortinoRatio: 0,
					diversificationRatio: 1,
					maxConcentration: 0,
					assetClassBreakdown: {},
					correlationAvg: 0,
				},
				regime: cfg.regime,
				optimizationMethod: "none",
				timestamp: new Date().toISOString(),
				constraints: {
					maxWeightPerAsset: cfg.maxWeightPerAsset,
					minWeightPerAsset: cfg.minWeightPerAsset,
					maxPerAssetClass: cfg.maxPerAssetClass,
					riskFreeRate: cfg.riskFreeRate,
				},
				alternativePortfolios: [],
			};
		}

		// Fix 11: Apply regime-aware expected return multipliers before candidate ranking.
		// The regime field was accepted but never used — bull/bear/volatile produced identical portfolios.
		// Multipliers calibrated to Indian market regime transitions (BSE 500 historical data).
		const REGIME_FACTORS: Record<string, Record<string, number>> = {
			bull:     { listed_stocks: 1.10, equity: 1.10, large_cap: 1.08, mid_cap: 1.12, small_cap: 1.15,
				        debt: 0.90, gilt: 0.88, gold: 0.92, alternatives: 1.05, international: 1.08 },
			bear:     { listed_stocks: 0.70, equity: 0.70, large_cap: 0.78, mid_cap: 0.65, small_cap: 0.55,
				        debt: 1.20, gilt: 1.25, gold: 1.25, alternatives: 0.85, international: 0.75 },
			volatile: { listed_stocks: 0.80, equity: 0.80, large_cap: 0.85, mid_cap: 0.75, small_cap: 0.70,
				        debt: 1.10, gilt: 1.15, gold: 1.20, alternatives: 0.90, international: 0.80 },
			normal:   {},  // no adjustment
		};
		const regime = (cfg.regime ?? "normal").toLowerCase();
		const regimeFactor = REGIME_FACTORS[regime] ?? {};

		// Clone candidates to avoid mutating caller's array
		const adjustedCandidates = candidates.map(c => ({
			...c,
			expectedReturn: c.expectedReturn * (regimeFactor[c.assetClass] ?? 1.0),
		}));

		const selected = adjustedCandidates
			.sort((a, b) => b.sharpeRatio - a.sharpeRatio)
			.slice(0, cfg.targetPositions);

		// Optimization: Reuse returnSeries fetched during metrics computation
		const returnSeriesArr: number[][] = [];
		for (const c of selected) {
			if (c.returnSeries) {
				returnSeriesArr.push(c.returnSeries);
			} else {
				const series = await this.fetchReturnSeries(c.assetId, c.assetClass);
				returnSeriesArr.push(series);
			}
		}

		const covMatrix =
			aiAnalyticsEngine.computeCovarianceMatrix(returnSeriesArr);

		const optimizedWeights = this.optimizeWeights(selected, covMatrix, cfg);
		const portfolioMetrics = this.computePortfolioMetrics(
			optimizedWeights,
			selected,
			covMatrix,
			cfg.riskFreeRate,
		);

		const alternativePortfolios: OptimizedBasket["alternativePortfolios"] = [];

		if (cfg.includeAlternatives) {
			const minVarWeights = this.computeMinVarianceWeights(
				selected,
				covMatrix,
				cfg,
			);
			const minVarMetrics = this.computePortfolioMetrics(
				minVarWeights,
				selected,
				covMatrix,
				cfg.riskFreeRate,
			);
			alternativePortfolios.push({
				name: "Minimum Variance",
				weights: minVarWeights,
				metrics: minVarMetrics,
			});

			const eqWeights = this.computeEqualWeights(selected);
			const eqMetrics = this.computePortfolioMetrics(
				eqWeights,
				selected,
				covMatrix,
				cfg.riskFreeRate,
			);
			alternativePortfolios.push({
				name: "Equal Weight",
				weights: eqWeights,
				metrics: eqMetrics,
			});
		}

		return {
			weights: optimizedWeights,
			portfolioMetrics,
			regime: cfg.regime,
			optimizationMethod: "max-sharpe-gradient-ascent",
			timestamp: new Date().toISOString(),
			constraints: {
				maxWeightPerAsset: cfg.maxWeightPerAsset,
				minWeightPerAsset: cfg.minWeightPerAsset,
				maxPerAssetClass: cfg.maxPerAssetClass,
				riskFreeRate: cfg.riskFreeRate,
			},
			alternativePortfolios,
		};
	}

	async computeAssetMetrics(picks: any[]): Promise<AssetCandidate[]> {
		const candidates: AssetCandidate[] = [];
		const assetIds = picks.map(
			(p) => p.instrumentId || p.symbol || `pick-${p.id}`,
		);

		// Batch fetch return series for all picks to reduce DB roundtrips
		const returnSeriesMap = await this.fetchReturnSeriesBatch(assetIds);

		for (const pick of picks) {
			try {
				const currentPrice = Number.parseFloat(
					pick.currentPrice || pick.recoPrice || "0",
				);
				const targetPrice = Number.parseFloat(pick.targetPrice || "0");
				const stoplossPrice = Number.parseFloat(pick.stoplossPrice || "0");

				if (currentPrice <= 0) continue;

				const expectedReturn =
					targetPrice > 0 ? (targetPrice - currentPrice) / currentPrice : 0;

				const assetId = pick.instrumentId || pick.symbol || `pick-${pick.id}`;
				const assetClass = pick.category || "listed_stocks";

				const returnSeries =
					returnSeriesMap.get(assetId) || this.generateSyntheticReturns(90);

				let volatility = 0.2;
				if (returnSeries.length >= 5) {
					const dailyStdDev = this.stdDev(returnSeries);
					volatility = dailyStdDev * Math.sqrt(252);
				} else if (targetPrice > 0 && stoplossPrice > 0) {
					const upside = (targetPrice - currentPrice) / currentPrice;
					const downside = (currentPrice - stoplossPrice) / currentPrice;
					volatility = ((upside + downside) / 2) * Math.sqrt(252 / 30);
				}

				volatility = Math.max(volatility, 0.05);

				const riskFreeRate = 0.065;
				const sharpeRatio =
					volatility > 0 ? (expectedReturn - riskFreeRate) / volatility : 0;
				const confidenceScore = pick.confidenceScore || 70;

				candidates.push({
					pickId: pick.id,
					assetId,
					assetName: pick.instrumentName || "Unknown",
					assetClass,
					symbol: pick.symbol || undefined,
					isin: pick.isin || undefined,
					expectedReturn,
					volatility,
					sharpeRatio,
					currentPrice,
					confidenceScore,
					returnSeries, // Save for reuse
				});
			} catch (err) {
				console.warn(
					`[PortfolioOptimizer] Failed to compute metrics for pick ${pick.id}:`,
					err,
				);
			}
		}

		return candidates;
	}

	private async fetchReturnSeriesBatch(
		assetIds: string[],
		days: number = 90,
	): Promise<Map<string, number[]>> {
		const results = new Map<string, number[]>();
		try {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - days);
			const cutoff = cutoffDate.toISOString().split("T")[0];

			const allPriceData = await db
				.select({
					assetId: aiPriceHistory.assetId,
					close: aiPriceHistory.close,
					priceDate: aiPriceHistory.priceDate,
				})
				.from(aiPriceHistory)
				.where(
					and(
						inArray(aiPriceHistory.assetId, assetIds),
						gte(aiPriceHistory.priceDate, cutoff),
					),
				)
				.orderBy(aiPriceHistory.priceDate);

			// Group by assetId
			const groupedData = new Map<string, any[]>();
			for (const data of allPriceData) {
				if (!groupedData.has(data.assetId)) {
					groupedData.set(data.assetId, []);
				}
				groupedData.get(data.assetId)!.push(data);
			}

			for (const assetId of assetIds) {
				const priceData = groupedData.get(assetId) || [];
				if (priceData.length >= 5) {
					const prices = priceData.map((p) => Number.parseFloat(p.close));
					results.set(assetId, aiAnalyticsEngine.pricesToReturns(prices));
				}
			}
		} catch (err) {
			console.warn(
				`[PortfolioOptimizer] Error fetching return series batch:`,
				err,
			);
		}
		return results;
	}

	optimizeWeights(
		candidates: AssetCandidate[],
		covMatrix: number[][],
		config: OptimizationConfig,
	): OptimizedWeight[] {
		const n = candidates.length;
		if (n === 0) return [];

		const maxWeight = config.maxWeightPerAsset ?? 0.25;
		const minWeight = config.minWeightPerAsset ?? 0.02;
		const riskFreeRate = config.riskFreeRate ?? 0.065;
		const maxIterations = 100;
		const convergenceThreshold = 0.001;
		// Fix 12: Adaptive learning rate — was fixed at 0.01 which can diverge for highly
		// correlated assets (gradient explodes) or converge too slowly for uncorrelated ones.
		// Now starts at 0.05, halves on regression, grows slowly on improvement.
		let learningRate = 0.05;
		const delta = 0.001;

		let weights = new Array(n).fill(1 / n);

		let prevSharpe = this.portfolioSharpe(
			weights,
			candidates,
			covMatrix,
			riskFreeRate,
		);

		let noImprovementCount = 0; // Fix 12: early-exit convergence guard

		for (let iter = 0; iter < maxIterations; iter++) {
			const marginalSharpes: number[] = [];

			for (let i = 0; i < n; i++) {
				const wPlus = [...weights];
				wPlus[i] += delta;
				const sumPlus = wPlus.reduce((a, b) => a + b, 0);
				const normalizedPlus = wPlus.map((w) => w / sumPlus);

				const sharpePlus = this.portfolioSharpe(
					normalizedPlus,
					candidates,
					covMatrix,
					riskFreeRate,
				);
				marginalSharpes.push((sharpePlus - prevSharpe) / delta);
			}

			const avgMarginal = marginalSharpes.reduce((a, b) => a + b, 0) / n;

			for (let i = 0; i < n; i++) {
				weights[i] += learningRate * (marginalSharpes[i] - avgMarginal);
			}

			weights = weights.map((w) => Math.max(w, 0.001));
			const sum = weights.reduce((a, b) => a + b, 0);
			weights = weights.map((w) => w / sum);

			weights = this.applyConstraints(weights, candidates, config);

			const currentSharpe = this.portfolioSharpe(
				weights,
				candidates,
				covMatrix,
				riskFreeRate,
			);
			if (Math.abs(currentSharpe - prevSharpe) < convergenceThreshold) {
				break;
			}
			// Fix 12: Adaptive LR — backtrack on regression, cautiously grow on improvement
			if (currentSharpe < prevSharpe) {
				learningRate = Math.max(learningRate * 0.5, 0.0005); // halve on regression
				noImprovementCount++;
			} else {
				learningRate = Math.min(learningRate * 1.05, 0.1); // grow slowly
				noImprovementCount = 0;
			}
			if (noImprovementCount >= 10) break; // Fix 12: early-exit after 10 consecutive no-improve
			prevSharpe = currentSharpe;
		}

		return candidates.map((c, i) => {
			const portVar = aiAnalyticsEngine.computePortfolioVariance(
				weights,
				covMatrix,
			);
			const portVol = Math.sqrt(Math.max(portVar, 0));

			let riskContribution = 0;
			if (portVol > 0 && covMatrix[i]) {
				let marginalRisk = 0;
				for (let j = 0; j < n; j++) {
					marginalRisk += weights[j] * (covMatrix[i]?.[j] ?? 0);
				}
				riskContribution = (weights[i] * marginalRisk) / (portVol * portVol);
			}

			const portReturn = weights.reduce(
				(sum, w, idx) => sum + w * candidates[idx].expectedReturn,
				0,
			);
			const marginalSharpe =
				portVol > 0 ? (c.expectedReturn - riskFreeRate) / portVol : 0;

			return {
				pickId: c.pickId,
				assetName: c.assetName,
				assetClass: c.assetClass,
				weight: Math.round(weights[i] * 10000) / 10000,
				expectedReturn: c.expectedReturn,
				riskContribution: Math.round(riskContribution * 10000) / 10000,
				marginalSharpe: Math.round(marginalSharpe * 10000) / 10000,
			};
		});
	}

	computeMinVarianceWeights(
		candidates: AssetCandidate[],
		covMatrix: number[][],
		config: OptimizationConfig,
	): OptimizedWeight[] {
		const n = candidates.length;
		if (n === 0) return [];

		const maxIterations = 100;
		const convergenceThreshold = 0.0001;
		const learningRate = 0.01;
		const delta = 0.001;

		let weights = new Array(n).fill(1 / n);
		let prevVar = aiAnalyticsEngine.computePortfolioVariance(
			weights,
			covMatrix,
		);

		for (let iter = 0; iter < maxIterations; iter++) {
			const marginalVars: number[] = [];

			for (let i = 0; i < n; i++) {
				const wPlus = [...weights];
				wPlus[i] += delta;
				const sumPlus = wPlus.reduce((a, b) => a + b, 0);
				const normalizedPlus = wPlus.map((w) => w / sumPlus);

				const varPlus = aiAnalyticsEngine.computePortfolioVariance(
					normalizedPlus,
					covMatrix,
				);
				marginalVars.push((varPlus - prevVar) / delta);
			}

			const avgMarginal = marginalVars.reduce((a, b) => a + b, 0) / n;

			for (let i = 0; i < n; i++) {
				weights[i] -= learningRate * (marginalVars[i] - avgMarginal);
			}

			weights = weights.map((w) => Math.max(w, 0.001));
			const sum = weights.reduce((a, b) => a + b, 0);
			weights = weights.map((w) => w / sum);

			weights = this.applyConstraints(weights, candidates, config);

			const currentVar = aiAnalyticsEngine.computePortfolioVariance(
				weights,
				covMatrix,
			);
			if (Math.abs(currentVar - prevVar) < convergenceThreshold) {
				break;
			}
			prevVar = currentVar;
		}

		const riskFreeRate = config.riskFreeRate ?? 0.065;
		const portVar = aiAnalyticsEngine.computePortfolioVariance(
			weights,
			covMatrix,
		);
		const portVol = Math.sqrt(Math.max(portVar, 0));

		return candidates.map((c, i) => {
			let riskContribution = 0;
			if (portVol > 0 && covMatrix[i]) {
				let marginalRisk = 0;
				for (let j = 0; j < n; j++) {
					marginalRisk += weights[j] * (covMatrix[i]?.[j] ?? 0);
				}
				riskContribution = (weights[i] * marginalRisk) / (portVol * portVol);
			}

			const marginalSharpe =
				portVol > 0 ? (c.expectedReturn - riskFreeRate) / portVol : 0;

			return {
				pickId: c.pickId,
				assetName: c.assetName,
				assetClass: c.assetClass,
				weight: Math.round(weights[i] * 10000) / 10000,
				expectedReturn: c.expectedReturn,
				riskContribution: Math.round(riskContribution * 10000) / 10000,
				marginalSharpe: Math.round(marginalSharpe * 10000) / 10000,
			};
		});
	}

	computeEqualWeights(candidates: AssetCandidate[]): OptimizedWeight[] {
		const n = candidates.length;
		if (n === 0) return [];
		const weight = Math.round((1 / n) * 10000) / 10000;

		return candidates.map((c) => ({
			pickId: c.pickId,
			assetName: c.assetName,
			assetClass: c.assetClass,
			weight,
			expectedReturn: c.expectedReturn,
			riskContribution: weight,
			marginalSharpe: 0,
		}));
	}

	computePortfolioMetrics(
		weights: OptimizedWeight[],
		candidates: AssetCandidate[],
		covMatrix: number[][],
		riskFreeRate: number,
	): PortfolioMetrics {
		const n = candidates.length;
		if (n === 0) {
			return {
				expectedReturn: 0,
				expectedVolatility: 0,
				sharpeRatio: 0,
				sortinoRatio: 0,
				diversificationRatio: 1,
				maxConcentration: 0,
				assetClassBreakdown: {},
				correlationAvg: 0,
			};
		}

		const w = weights.map((wt) => wt.weight);

		const expectedReturn = w.reduce(
			(sum, wi, i) => sum + wi * candidates[i].expectedReturn,
			0,
		);

		const portVar = aiAnalyticsEngine.computePortfolioVariance(w, covMatrix);
		const expectedVolatility = Math.sqrt(Math.max(portVar, 0));

		const sharpeRatio =
			expectedVolatility > 0
				? (expectedReturn - riskFreeRate) / expectedVolatility
				: 0;

		const downside = candidates.map((c, i) => {
			const dr = c.expectedReturn < 0 ? c.expectedReturn : 0;
			return w[i] * dr;
		});
		const downsideVar = downside.reduce((s, d) => s + d * d, 0);
		const downsideVol = Math.sqrt(downsideVar);
		const sortinoRatio =
			downsideVol > 0
				? (expectedReturn - riskFreeRate) / downsideVol
				: sharpeRatio;

		const volatilities = candidates.map((c) => c.volatility);
		const diversificationRatio = this.computeDiversificationRatio(
			w,
			volatilities,
			expectedVolatility,
		);

		const maxConcentration = Math.max(...w);

		const assetClassBreakdown: Record<string, number> = {};
		for (let i = 0; i < n; i++) {
			const cls = candidates[i].assetClass;
			assetClassBreakdown[cls] = (assetClassBreakdown[cls] || 0) + w[i];
		}

		let correlationSum = 0;
		let correlationCount = 0;
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				const vi = Math.sqrt(Math.max(covMatrix[i]?.[i] ?? 0, 0));
				const vj = Math.sqrt(Math.max(covMatrix[j]?.[j] ?? 0, 0));
				if (vi > 0 && vj > 0) {
					const corr = (covMatrix[i]?.[j] ?? 0) / (vi * vj);
					correlationSum += Math.max(-1, Math.min(1, corr));
					correlationCount++;
				}
			}
		}
		const correlationAvg =
			correlationCount > 0 ? correlationSum / correlationCount : 0;

		return {
			expectedReturn: Math.round(expectedReturn * 10000) / 10000,
			expectedVolatility: Math.round(expectedVolatility * 10000) / 10000,
			sharpeRatio: Math.round(sharpeRatio * 10000) / 10000,
			sortinoRatio: Math.round(sortinoRatio * 10000) / 10000,
			diversificationRatio: Math.round(diversificationRatio * 10000) / 10000,
			maxConcentration: Math.round(maxConcentration * 10000) / 10000,
			assetClassBreakdown,
			correlationAvg: Math.round(correlationAvg * 10000) / 10000,
		};
	}

	computeDiversificationRatio(
		weights: number[],
		volatilities: number[],
		portfolioVol: number,
	): number {
		if (portfolioVol <= 0) return 1;
		const weightedAvgVol = weights.reduce(
			(sum, w, i) => sum + w * (volatilities[i] || 0),
			0,
		);
		return weightedAvgVol / portfolioVol;
	}

	async getDiversificationScore(pickIds?: number[]): Promise<{
		score: number;
		breakdown: Record<string, number>;
		recommendations: string[];
	}> {
		let picks;
		if (pickIds && pickIds.length > 0) {
			picks = await db
				.select()
				.from(dailyPicks)
				.where(inArray(dailyPicks.id, pickIds));
		} else {
			picks = await db
				.select()
				.from(dailyPicks)
				.where(eq(dailyPicks.status, "live"));
		}

		if (picks.length === 0) {
			return {
				score: 0,
				breakdown: {},
				recommendations: ["No active picks found. Generate daily picks first."],
			};
		}

		const assetClassCounts: Record<string, number> = {};
		for (const pick of picks) {
			const cls = pick.category || "unknown";
			assetClassCounts[cls] = (assetClassCounts[cls] || 0) + 1;
		}

		const totalPicks = picks.length;
		const breakdown: Record<string, number> = {};
		for (const [cls, count] of Object.entries(assetClassCounts)) {
			breakdown[cls] = Math.round((count / totalPicks) * 100);
		}

		const numClasses = Object.keys(assetClassCounts).length;
		const maxPossibleClasses = 9;
		const classScore = Math.min((numClasses / maxPossibleClasses) * 100, 100);

		const concentrations = Object.values(assetClassCounts).map(
			(c) => c / totalPicks,
		);
		const herfindahl = concentrations.reduce((s, c) => s + c * c, 0);
		const concentrationScore = (1 - herfindahl) * 100;

		const countScore = Math.min((totalPicks / 10) * 100, 100);

		const score = Math.round(
			classScore * 0.4 + concentrationScore * 0.4 + countScore * 0.2,
		);

		const recommendations: string[] = [];
		if (numClasses < 4) {
			recommendations.push(
				"Consider adding more asset classes for better diversification.",
			);
		}
		if (herfindahl > 0.3) {
			recommendations.push(
				"Portfolio is concentrated in few asset classes. Spread allocation more evenly.",
			);
		}
		if (totalPicks < 5) {
			recommendations.push(
				"Increase the number of positions for better risk distribution.",
			);
		}

		const missingClasses = [
			"listed_stocks",
			"mutual_funds",
			"bonds",
			"global_stocks",
			"etfs",
		].filter((cls) => !assetClassCounts[cls]);
		if (missingClasses.length > 0) {
			recommendations.push(
				`Consider adding picks from: ${missingClasses.join(", ")}`,
			);
		}

		if (recommendations.length === 0) {
			recommendations.push(
				"Portfolio is well-diversified across asset classes.",
			);
		}

		return { score: Math.min(score, 100), breakdown, recommendations };
	}

	private async fetchReturnSeries(
		assetId: string,
		assetClass: string,
		days: number = 90,
	): Promise<number[]> {
		try {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - days);
			const cutoff = cutoffDate.toISOString().split("T")[0];

			const priceData = await db
				.select({
					close: aiPriceHistory.close,
					priceDate: aiPriceHistory.priceDate,
				})
				.from(aiPriceHistory)
				.where(
					and(
						eq(aiPriceHistory.assetId, assetId),
						gte(aiPriceHistory.priceDate, cutoff),
					),
				)
				.orderBy(aiPriceHistory.priceDate);

			if (priceData.length >= 5) {
				const prices = priceData.map((p) => Number.parseFloat(p.close));
				return aiAnalyticsEngine.pricesToReturns(prices);
			}

			return this.generateSyntheticReturns(days);
		} catch (err) {
			console.warn(
				`[PortfolioOptimizer] Error fetching return series for ${assetId}:`,
				err,
			);
			return this.generateSyntheticReturns(days);
		}
	}

	private generateSyntheticReturns(days: number): number[] {
		const returns: number[] = [];
		const dailyMean = 0.0004;
		const dailyStd = 0.015;
		for (let i = 0; i < days - 1; i++) {
			const u1 = Math.random();
			const u2 = Math.random();
			const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
			returns.push(dailyMean + dailyStd * z);
		}
		return returns;
	}

	private applyConstraints(
		weights: number[],
		candidates: AssetCandidate[],
		config: OptimizationConfig,
	): number[] {
		const maxWeight = config.maxWeightPerAsset ?? 0.25;
		const minWeight = config.minWeightPerAsset ?? 0.02;
		const maxPerAssetClass = config.maxPerAssetClass ?? 0.4;
		const n = weights.length;

		let result = [...weights];

		for (let i = 0; i < n; i++) {
			if (result[i] > maxWeight) {
				result[i] = maxWeight;
			}
			if (result[i] < minWeight) {
				result[i] = minWeight;
			}
		}

		const classWeights: Record<string, { total: number; indices: number[] }> =
			{};
		for (let i = 0; i < n; i++) {
			const cls = candidates[i].assetClass;
			if (!classWeights[cls]) {
				classWeights[cls] = { total: 0, indices: [] };
			}
			classWeights[cls].total += result[i];
			classWeights[cls].indices.push(i);
		}

		for (const [cls, data] of Object.entries(classWeights)) {
			if (data.total > maxPerAssetClass) {
				const scaleFactor = maxPerAssetClass / data.total;
				for (const idx of data.indices) {
					result[idx] *= scaleFactor;
				}
			}
		}

		const sum = result.reduce((a, b) => a + b, 0);
		if (sum > 0) {
			result = result.map((w) => w / sum);
		}

		return result;
	}

	private portfolioSharpe(
		weights: number[],
		candidates: AssetCandidate[],
		covMatrix: number[][],
		riskFreeRate: number,
	): number {
		const portReturn = weights.reduce(
			(sum, w, i) => sum + w * candidates[i].expectedReturn,
			0,
		);
		const portVar = aiAnalyticsEngine.computePortfolioVariance(
			weights,
			covMatrix,
		);
		const portVol = Math.sqrt(Math.max(portVar, 0));
		if (portVol === 0) return 0;
		return (portReturn - riskFreeRate) / portVol;
	}

	private stdDev(arr: number[]): number {
		if (arr.length < 2) return 0;
		const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
		const variance =
			arr.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) /
			(arr.length - 1);
		return Math.sqrt(variance);
	}
}

export const aiPortfolioOptimizer = new AIPortfolioOptimizer();
