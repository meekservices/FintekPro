// @ts-nocheck
// NOTE: @ts-nocheck maintained for compatibility — targeted type fixes tracked in CC-1 backlog
import { db } from "../db";
import {
	dailyPicks,
	aiFeatureSnapshots,
	aiPredictionLogs,
} from "@shared/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { aiMLScoringEngine } from "./ai-ml-scoring-engine";
import { aiAnalyticsEngine } from "./ai-analytics-engine";
import { AIRegimeDetectionEngine } from "./ai-regime-detection-engine";
import * as ss from "simple-statistics";

const regimeDetectionEngine = new AIRegimeDetectionEngine();

export interface FeatureContribution {
	featureName: string;
	featureValue: number;
	contribution: number;
	importance: number;
	description: string;
}

export interface ExplainResult {
	pickId: number;
	assetName: string;
	assetClass: string;
	predictedReturn: number;
	confidence: number;
	calibratedConfidence: number;
	baselineScore: number;
	featureContributions: FeatureContribution[];
	topPositiveDrivers: FeatureContribution[];
	topNegativeDrivers: FeatureContribution[];
	regime?: string;
	regimeImpact: string;
	explanation: string;
}

export interface SimilarPattern {
	pickId: number;
	assetName: string;
	assetClass: string;
	similarity: number;
	date: string;
	actualReturn: number;
	outcome: string;
	matchingFeatures: string[];
}

export interface FeatureImportanceResult {
	assetClass: string;
	modelVersion: string;
	features: {
		name: string;
		importance: number;
		avgContribution: number;
		description: string;
	}[];
	totalFeatures: number;
	sampleSize: number;
}

export interface ConfidenceCalibration {
	predictedBucket: string;
	actualHitRate: number;
	sampleSize: number;
	isCalibrated: boolean;
}

const FEATURE_NAME_MAP: Record<string, string> = {
	pe: "Price-to-Earnings ratio",
	returns1y: "1-year returns",
	returns3y: "3-year returns",
	volatility: "Price volatility",
	sharpeRatio: "Risk-adjusted returns (Sharpe)",
	yield: "Yield",
	confidenceScore: "AI confidence",
	rating: "Credit/fund rating",
	beta: "Market sensitivity (Beta)",
	marketCap: "Market capitalization",
	dividendYield: "Dividend yield",
	debtToEquity: "Debt-to-equity ratio",
	roe: "Return on equity",
	eps: "Earnings per share",
	nav: "Net asset value",
	expenseRatio: "Expense ratio",
	aum: "Assets under management",
	duration: "Bond duration",
	ytm: "Yield to maturity",
	couponRate: "Coupon rate",
	// Synthesized features (from pick guaranteed fields)
	expectedUpside: "Expected upside potential",
	riskReward: "Risk / Reward ratio",
	riskLevel: "Risk category",
	timeHorizon: "Investment time horizon",
};

const CALIBRATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

class AIXAIEngine {
	private calibrationCache: Map<
		string,
		{ data: ConfidenceCalibration[]; cachedAt: number }
	> = new Map();

	async explainPick(pickId: number): Promise<ExplainResult> {
		const picks = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.id, pickId))
			.limit(1);

		if (picks.length === 0) {
			throw new Error(`Pick ${pickId} not found`);
		}

		const pick = picks[0];
		const assetClass = pick.category;
		const keyMetrics = (pick.keyMetrics as Record<string, any>) || {};

		const features: Record<string, number> = {};
		const featureKeys = [
			"pe",
			"returns1y",
			"returns3y",
			"volatility",
			"sharpeRatio",
			"yield",
			"rating",
			"beta",
			"marketCap",
			"dividendYield",
			"debtToEquity",
			"roe",
			"eps",
		];
		for (const key of featureKeys) {
			const val = keyMetrics[key];
			if (val !== null && val !== undefined && !Number.isNaN(Number(val))) {
				features[key] = Number(val);
			}
		}

		if (pick.confidenceScore !== null && pick.confidenceScore !== undefined) {
			features.confidenceScore = pick.confidenceScore;
		}

		let predictedReturn = 0;
		let confidence = pick.confidenceScore ?? 70;
		const featureContributions: FeatureContribution[] = [];
		let regime: string | undefined;
		let modelUsed = false;

		const scoringResult = await aiMLScoringEngine.score(
			pick.instrumentId || pick.symbol || pick.instrumentName,
			assetClass,
			features,
			keyMetrics.regime,
		);

		if (scoringResult) {
			predictedReturn = scoringResult.predictedReturn;
			confidence = scoringResult.confidence;
			regime = scoringResult.regime;
			modelUsed = true;

			const ruleImportance = this.getRuleBasedImportance(assetClass);
			const importanceMap: Record<string, number> = {};
			for (const ri of ruleImportance) {
				importanceMap[ri.name] = ri.importance;
			}

			for (const [fname, contrib] of Object.entries(
				scoringResult.featureContributions,
			)) {
				const safeContrib = Number.isFinite(contrib) ? contrib * 100 : 0;
				const safeVal = Number.isFinite(features[fname]) ? features[fname] : 0;
				const safeImportance = Number.isFinite(importanceMap[fname]) ? importanceMap[fname] : 5;
				featureContributions.push({
					featureName: fname,
					featureValue: safeVal,
					contribution: safeContrib,
					importance: safeImportance,
					description: this.featureDescription(fname, safeVal, safeContrib),
				});
			}
		} else {
			const ruleImportance = this.getRuleBasedImportance(assetClass);
			regime = keyMetrics.regime;

			// ── Primary: use keyMetrics if populated ──────────────────────
			for (const ri of ruleImportance) {
				const val = features[ri.name];
				if (val !== undefined) {
					const contribution =
						val > 0
							? (ri.importance / 100) * val
							: -(ri.importance / 100) * Math.abs(val);
					featureContributions.push({
						featureName: ri.name,
						featureValue: val,
						contribution: contribution,
						importance: ri.importance,
						description: this.featureDescription(ri.name, val, contribution),
					});
					predictedReturn += contribution / 100;
				}
			}

			// ── Fallback: synthesize from pick's guaranteed fields ────────
			// When keyMetrics is empty (unlisted/new stocks), derive contributions
			// from recoPrice / targetPrice / stoplossPrice / confidenceScore / riskLevel.
			if (featureContributions.length === 0) {
				const reco = Number(pick.recoPrice) || 0;
				const target = Number(pick.targetPrice) || 0;
				const stoploss = Number(pick.stoplossPrice) || 0;
				const confScore = Number(pick.confidenceScore) || 70;
				const riskLvl = (pick.riskLevel || "medium").toLowerCase();
				const horizon = (pick.timeHorizon || "medium_term").toLowerCase();

				// Implied upside (%) from recommendation
				const upside = reco > 0 && target > reco ? ((target - reco) / reco) * 100 : 0;
				// Implied downside risk (%)
				const downside = reco > 0 && stoploss > 0 && stoploss < reco ? ((reco - stoploss) / reco) * 100 : 0;
				// Risk/reward ratio contribution (positive when R:R > 1.5)
				const riskReward = downside > 0 ? upside / downside : 1;
				const rrContrib = riskReward > 1.5 ? Math.min(riskReward * 1.5, 8) : -1;
				// Confidence contribution
				const confContrib = ((confScore - 50) / 50) * 5; // -5% to +5%
				// Risk level penalty
				const riskPenalty = riskLvl === "high" ? -3 : riskLvl === "very_high" ? -5 : riskLvl === "low" ? 2 : 0;
				// Time horizon bonus (short term = more certain)
				const horizonBonus = horizon.includes("short") ? 1.5 : horizon.includes("long") ? -0.5 : 0;

				predictedReturn = (upside / 100) * 0.6; // 60% of implied upside as expected return

				const syntheticFeatures = [
					{
						featureName: "expectedUpside",
						featureValue: Math.round(upside * 100) / 100,
						contribution: Math.min(upside * 0.4, 10),
						importance: 30,
						description: `Implied upside of ${upside.toFixed(1)}% from entry to target price`,
					},
					{
						featureName: "confidenceScore",
						featureValue: confScore,
						contribution: confContrib,
						importance: 25,
						description: `AI model confidence at ${confScore}% — ${confScore >= 75 ? "strong" : confScore >= 55 ? "moderate" : "low"} conviction`,
					},
					{
						featureName: "riskReward",
						featureValue: Math.round(riskReward * 100) / 100,
						contribution: rrContrib,
						importance: 20,
						description: `Risk/reward ratio of ${riskReward.toFixed(2)}x — ${riskReward >= 2 ? "favourable" : riskReward >= 1.5 ? "acceptable" : "tight"}`,
					},
					{
						featureName: "riskLevel",
						featureValue: riskPenalty,
						contribution: riskPenalty,
						importance: 15,
						description: `Risk category: ${riskLvl} — ${riskPenalty < 0 ? "adds caution to" : "supports"} the recommendation`,
					},
					{
						featureName: "timeHorizon",
						featureValue: horizonBonus,
						contribution: horizonBonus,
						importance: 10,
						description: `Time horizon: ${horizon.replace(/_/g, " ")} — affects return certainty`,
					},
				];

				for (const sf of syntheticFeatures) {
					if (Number.isFinite(sf.contribution)) {
						featureContributions.push(sf);
					}
				}
			}
		}

		featureContributions.sort(
			(a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
		);

		const baselineScore = await this.computeBaselineScore(assetClass);
		const calibratedConfidence = this.calibrateConfidence(
			confidence,
			assetClass,
		);

		const topPositiveDrivers = featureContributions
			.filter((fc) => fc.contribution > 0)
			.sort((a, b) => b.contribution - a.contribution)
			.slice(0, 3);

		const topNegativeDrivers = featureContributions
			.filter((fc) => fc.contribution < 0)
			.sort((a, b) => a.contribution - b.contribution)
			.slice(0, 2);

		// ── Regime: ML result → keyMetrics → live DB → sideways default ──
		if (!regime) regime = keyMetrics.regime;
		if (!regime) {
			try {
				const currentRegime = await regimeDetectionEngine.getCurrentRegime();
				if (currentRegime?.regimeLabel) {
					regime = currentRegime.regimeLabel;
				}
			} catch {
				// non-fatal — use default
			}
		}
		// Final default: sideways (neutral assumption for Indian markets)
		if (!regime) regime = "sideways";

		let regimeImpact = "Neutral market conditions";
		if (regime) {
			const regimeDescriptions: Record<string, string> = {
				bull: "Bull market regime boosts confidence in equity-oriented picks",
				bear: "Bear market regime reduces expected returns and confidence",
				high_vol: "High volatility regime increases uncertainty and risk",
				sideways: "Sideways market regime suggests range-bound returns",
			};
			regimeImpact = regimeDescriptions[regime] || `Current regime: ${regime}`;
		}

		const explanation = this.generateExplanation(
			featureContributions,
			predictedReturn,
			regime,
		);

		const result: ExplainResult = {
			pickId,
			assetName: pick.instrumentName,
			assetClass,
			predictedReturn: predictedReturn * 100,
			confidence,
			calibratedConfidence,
			baselineScore,
			featureContributions,
			topPositiveDrivers,
			topNegativeDrivers,
			regime,
			regimeImpact,
			explanation,
		};

		// PM-XAI-1 FIX: FASP-AI v1.0 — every AI advisory output must be logged.
		// Required fields: event, user_id, input_context, output_summary, model_version, timestamp.
		try {
			const { logger } = await import("../logger");
			logger.info("[AIXAI] AI_ADVICE_GENERATED", {
				event: "AI_ADVICE_GENERATED",
				pick_id: pickId,
				instrument: pick.instrumentName,
				input_context: {
					asset_class: assetClass,
					feature_count: Object.keys(features).length,
					model_used: modelUsed,
					regime,
				},
				output_summary: {
					predicted_return_pct: +(predictedReturn * 100).toFixed(2),
					confidence,
					calibrated_confidence: calibratedConfidence,
					top_driver: topPositiveDrivers[0]?.featureName ?? null,
				},
				model_version: modelUsed ? "ai-ml-scoring-engine" : "rule-based-xai",
				timestamp: new Date().toISOString(),
			});
		} catch { /* logging is best-effort — never block advisory delivery */ }

		return result;
	}

	async findSimilarPatterns(
		pickId: number,
		limit: number = 5,
	): Promise<SimilarPattern[]> {
		const picks = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.id, pickId))
			.limit(1);

		if (picks.length === 0) {
			throw new Error(`Pick ${pickId} not found`);
		}

		const pick = picks[0];
		const keyMetrics = (pick.keyMetrics as Record<string, any>) || {};
		const currentFeatures: Record<string, number> = {};
		const featureKeys = [
			"pe",
			"returns1y",
			"returns3y",
			"volatility",
			"sharpeRatio",
			"yield",
			"confidenceScore",
		];

		for (const key of featureKeys) {
			const val = keyMetrics[key];
			if (val !== null && val !== undefined && !Number.isNaN(Number(val))) {
				currentFeatures[key] = Number(val);
			}
		}

		if (pick.confidenceScore !== null && pick.confidenceScore !== undefined) {
			currentFeatures.confidenceScore = pick.confidenceScore;
		}

		if (Object.keys(currentFeatures).length === 0) {
			return [];
		}

		const snapshots = await db
			.select()
			.from(aiFeatureSnapshots)
			.where(eq(aiFeatureSnapshots.assetClass, pick.category))
			.orderBy(desc(aiFeatureSnapshots.snapshotDate))
			.limit(500);

		const similarities: {
			snapshot: (typeof snapshots)[0];
			similarity: number;
			matchingFeatures: string[];
		}[] = [];

		for (const snapshot of snapshots) {
			const snapshotFeatures =
				(snapshot.featureJson as Record<string, any>) || {};
			const histFeatures: Record<string, number> = {};

			for (const key of featureKeys) {
				const val = snapshotFeatures[key];
				if (val !== null && val !== undefined && !Number.isNaN(Number(val))) {
					histFeatures[key] = Number(val);
				}
			}

			if (Object.keys(histFeatures).length === 0) continue;

			const similarity = this.computeCosineSimilarity(
				currentFeatures,
				histFeatures,
			);
			if (similarity < 0.5) continue;

			const matchingFeatures: string[] = [];
			for (const key of Object.keys(currentFeatures)) {
				if (histFeatures[key] !== undefined) {
					const diff = Math.abs(currentFeatures[key] - histFeatures[key]);
					const maxVal = Math.max(
						Math.abs(currentFeatures[key]),
						Math.abs(histFeatures[key]),
						1,
					);
					if (diff / maxVal < 0.3) {
						matchingFeatures.push(key);
					}
				}
			}

			similarities.push({ snapshot, similarity, matchingFeatures });
		}

		similarities.sort((a, b) => b.similarity - a.similarity);
		const topSimilar = similarities.slice(0, limit * 3);

		const results: SimilarPattern[] = [];

		for (const sim of topSimilar) {
			if (results.length >= limit) break;

			const matchedPicks = await db
				.select()
				.from(dailyPicks)
				.where(
					and(
						eq(dailyPicks.category, pick.category),
						eq(dailyPicks.instrumentId, sim.snapshot.assetId),
						sql`${dailyPicks.status} IN ('target_hit', 'stoploss_hit', 'expired')`,
					),
				)
				.orderBy(desc(dailyPicks.recoDate))
				.limit(1);

			if (matchedPicks.length > 0) {
				const mp = matchedPicks[0];
				results.push({
					pickId: mp.id,
					assetName: mp.instrumentName,
					assetClass: mp.category,
					similarity: sim.similarity,
					date: mp.recoDate,
					actualReturn: mp.returnPct ? Number.parseFloat(mp.returnPct) : 0,
					outcome: mp.status,
					matchingFeatures: sim.matchingFeatures,
				});
			}
		}

		return results;
	}

	async getFeatureImportance(
		assetClass: string,
	): Promise<FeatureImportanceResult> {
		const model = await aiMLScoringEngine.getActiveModel(assetClass);

		if (model?.stumps && model.stumps.length > 0) {
			const importanceMap: Record<string, { total: number; count: number }> =
				{};

			for (const stump of model.stumps) {
				if (!importanceMap[stump.featureName]) {
					importanceMap[stump.featureName] = { total: 0, count: 0 };
				}
				importanceMap[stump.featureName].total +=
					stump.importance * stump.weight;
				importanceMap[stump.featureName].count += 1;
			}

			const totalImportance = Object.values(importanceMap).reduce(
				(sum, v) => sum + v.total,
				0,
			);

			const features = Object.entries(importanceMap)
				.map(([name, data]) => ({
					name,
					importance:
						totalImportance > 0
							? Math.round((data.total / totalImportance) * 100)
							: 0,
					avgContribution: data.count > 0 ? data.total / data.count : 0,
					description: FEATURE_NAME_MAP[name] || name,
				}))
				.sort((a, b) => b.importance - a.importance);

			return {
				assetClass,
				modelVersion: model.version,
				features,
				totalFeatures: features.length,
				sampleSize: model.trainingMetrics?.sampleSize || 0,
			};
		}

		const ruleImportance = this.getRuleBasedImportance(assetClass);
		return {
			assetClass,
			modelVersion: "rule-based",
			features: ruleImportance.map((ri) => ({
				name: ri.name,
				importance: ri.importance,
				avgContribution: 0,
				description: ri.description,
			})),
			totalFeatures: ruleImportance.length,
			sampleSize: 0,
		};
	}

	async getConfidenceCalibration(
		assetClass?: string,
	): Promise<ConfidenceCalibration[]> {
		const completedStatuses = ["target_hit", "stoploss_hit", "expired"];

		let query = db
			.select({
				confidenceScore: dailyPicks.confidenceScore,
				status: dailyPicks.status,
			})
			.from(dailyPicks)
			.where(
				sql`${dailyPicks.status} IN ('target_hit', 'stoploss_hit', 'expired')`,
			);

		if (assetClass) {
			query = query.where(
				and(
					sql`${dailyPicks.status} IN ('target_hit', 'stoploss_hit', 'expired')`,
					eq(dailyPicks.category, assetClass),
				),
			) as any;
		}

		const picks = await query;

		const buckets: {
			label: string;
			min: number;
			max: number;
			hits: number;
			total: number;
		}[] = [
			{ label: "0-30%", min: 0, max: 30, hits: 0, total: 0 },
			{ label: "30-50%", min: 30, max: 50, hits: 0, total: 0 },
			{ label: "50-70%", min: 50, max: 70, hits: 0, total: 0 },
			{ label: "70-85%", min: 70, max: 85, hits: 0, total: 0 },
			{ label: "85-100%", min: 85, max: 100, hits: 0, total: 0 },
		];

		for (const pick of picks) {
			const conf = pick.confidenceScore ?? 70;
			const isHit = pick.status === "target_hit";

			for (const bucket of buckets) {
				if (conf >= bucket.min && conf < bucket.max) {
					bucket.total += 1;
					if (isHit) bucket.hits += 1;
					break;
				}
				if (conf === 100 && bucket.max === 100) {
					bucket.total += 1;
					if (isHit) bucket.hits += 1;
					break;
				}
			}
		}

		return buckets.map((bucket) => {
			const actualHitRate =
				bucket.total > 0 ? (bucket.hits / bucket.total) * 100 : 0;
			const midpoint = (bucket.min + bucket.max) / 2;
			return {
				predictedBucket: bucket.label,
				actualHitRate: Math.round(actualHitRate * 100) / 100,
				sampleSize: bucket.total,
				isCalibrated:
					bucket.total > 0 ? Math.abs(actualHitRate - midpoint) <= 10 : false,
			};
		});
	}

	calibrateConfidence(rawConfidence: number, assetClass: string): number {
		const cached = this.calibrationCache.get(assetClass);
		let calibrationData: ConfidenceCalibration[] | null = null;

		if (cached && Date.now() - cached.cachedAt < CALIBRATION_CACHE_TTL_MS) {
			calibrationData = cached.data;
		}

		if (!calibrationData) {
			return Math.max(0, Math.min(100, rawConfidence));
		}

		let bucketData: ConfidenceCalibration | undefined;
		if (rawConfidence < 30)
			bucketData = calibrationData.find((c) => c.predictedBucket === "0-30%");
		else if (rawConfidence < 50)
			bucketData = calibrationData.find((c) => c.predictedBucket === "30-50%");
		else if (rawConfidence < 70)
			bucketData = calibrationData.find((c) => c.predictedBucket === "50-70%");
		else if (rawConfidence < 85)
			bucketData = calibrationData.find((c) => c.predictedBucket === "70-85%");
		else
			bucketData = calibrationData.find((c) => c.predictedBucket === "85-100%");

		if (!bucketData || bucketData.sampleSize < 5) {
			return Math.max(0, Math.min(100, rawConfidence));
		}

		const adjustment =
			bucketData.actualHitRate -
			(rawConfidence < 30
				? 15
				: rawConfidence < 50
					? 40
					: rawConfidence < 70
						? 60
						: rawConfidence < 85
							? 77.5
							: 92.5);
		const calibrated = rawConfidence + adjustment * 0.5;

		return Math.max(0, Math.min(100, Math.round(calibrated * 100) / 100));
	}

	generateExplanation(
		contributions: FeatureContribution[],
		predictedReturn: number,
		regime?: string,
	): string {
		const sorted = [...contributions].sort(
			(a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
		);
		const topPositive = sorted.filter((c) => c.contribution > 0).slice(0, 3);
		const topNegative = sorted.filter((c) => c.contribution < 0).slice(0, 2);

		const parts: string[] = [];

		if (topPositive.length > 0) {
			const drivers = topPositive.map((c) => {
				const name = FEATURE_NAME_MAP[c.featureName] || c.featureName;
				return `${name.toLowerCase()} (contributing +${Math.abs(c.contribution).toFixed(1)}%)`;
			});

			if (drivers.length === 1) {
				parts.push(`This pick is primarily driven by strong ${drivers[0]}`);
			} else {
				const last = drivers.pop();
				parts.push(
					`This pick is primarily driven by strong ${drivers.join(", ")} and ${last}`,
				);
			}
		}

		if (topNegative.length > 0) {
			const risks = topNegative.map((c) => {
				const name = FEATURE_NAME_MAP[c.featureName] || c.featureName;
				return `${name.toLowerCase()} (${c.contribution.toFixed(1)}%)`;
			});
			parts.push(`Risk factors include ${risks.join(" and ")}`);
		}

		if (regime) {
			const regimeMessages: Record<string, string> = {
				bull: "In the current bull regime, equity picks receive a confidence boost",
				bear: "The bear regime introduces additional downside risk",
				high_vol:
					"High market volatility increases uncertainty around this prediction",
				sideways: "The sideways market may limit upside potential",
			};
			parts.push(regimeMessages[regime] || `Current market regime: ${regime}`);
		}

		const returnDir = predictedReturn >= 0 ? "positive" : "negative";
		parts.push(
			`Expected ${returnDir} return of ${(predictedReturn * 100).toFixed(1)}%`,
		);

		return parts.join(". ") + ".";
	}

	private computeCosineSimilarity(
		a: Record<string, number>,
		b: Record<string, number>,
	): number {
		const sharedKeys = Object.keys(a).filter((k) => b[k] !== undefined);
		if (sharedKeys.length === 0) return 0;

		let dotProduct = 0;
		let normA = 0;
		let normB = 0;

		for (const key of sharedKeys) {
			dotProduct += a[key] * b[key];
			normA += a[key] * a[key];
			normB += b[key] * b[key];
		}

		const denominator = Math.sqrt(normA) * Math.sqrt(normB);
		if (denominator === 0) return 0;

		return dotProduct / denominator;
	}

	private featureDescription(
		featureName: string,
		value: number,
		contribution: number,
	): string {
		const name = FEATURE_NAME_MAP[featureName] || featureName;
		const direction = contribution > 0 ? "positive" : "negative";
		const strength =
			Math.abs(contribution) > 5
				? "strong"
				: Math.abs(contribution) > 2
					? "moderate"
					: "slight";

		return `${name} at ${value.toFixed(2)} has a ${strength} ${direction} impact (${contribution > 0 ? "+" : ""}${contribution.toFixed(1)}%)`;
	}

	private getRuleBasedImportance(
		assetClass: string,
	): { name: string; importance: number; description: string }[] {
		const importanceMap: Record<
			string,
			{ name: string; importance: number; description: string }[]
		> = {
			listed_stocks: [
				{ name: "pe", importance: 25, description: "Price-to-Earnings ratio" },
				{ name: "returns1y", importance: 20, description: "1-year returns" },
				{ name: "volatility", importance: 15, description: "Price volatility" },
				{
					name: "sharpeRatio",
					importance: 15,
					description: "Risk-adjusted returns (Sharpe)",
				},
				{ name: "returns3y", importance: 10, description: "3-year returns" },
				{ name: "yield", importance: 10, description: "Yield" },
				{
					name: "confidenceScore",
					importance: 5,
					description: "AI confidence",
				},
			],
			mutual_funds: [
				{ name: "returns3y", importance: 25, description: "3-year returns" },
				{ name: "returns1y", importance: 20, description: "1-year returns" },
				{ name: "volatility", importance: 15, description: "Price volatility" },
				{
					name: "sharpeRatio",
					importance: 15,
					description: "Risk-adjusted returns (Sharpe)",
				},
				{ name: "yield", importance: 10, description: "Yield" },
				{ name: "rating", importance: 10, description: "Credit/fund rating" },
				{
					name: "confidenceScore",
					importance: 5,
					description: "AI confidence",
				},
			],
			bonds: [
				{ name: "yield", importance: 30, description: "Yield" },
				{ name: "rating", importance: 25, description: "Credit/fund rating" },
				{ name: "volatility", importance: 15, description: "Price volatility" },
				{ name: "returns1y", importance: 15, description: "1-year returns" },
				{
					name: "confidenceScore",
					importance: 10,
					description: "AI confidence",
				},
				{ name: "pe", importance: 5, description: "Price-to-Earnings ratio" },
			],
			etfs: [
				{ name: "returns1y", importance: 25, description: "1-year returns" },
				{ name: "volatility", importance: 20, description: "Price volatility" },
				{
					name: "sharpeRatio",
					importance: 20,
					description: "Risk-adjusted returns (Sharpe)",
				},
				{ name: "returns3y", importance: 15, description: "3-year returns" },
				{ name: "yield", importance: 10, description: "Yield" },
				{
					name: "confidenceScore",
					importance: 10,
					description: "AI confidence",
				},
			],
			global_stocks: [
				{ name: "pe", importance: 20, description: "Price-to-Earnings ratio" },
				{ name: "returns1y", importance: 20, description: "1-year returns" },
				{ name: "volatility", importance: 15, description: "Price volatility" },
				{
					name: "sharpeRatio",
					importance: 15,
					description: "Risk-adjusted returns (Sharpe)",
				},
				{ name: "returns3y", importance: 10, description: "3-year returns" },
				{ name: "yield", importance: 10, description: "Yield" },
				{
					name: "confidenceScore",
					importance: 10,
					description: "AI confidence",
				},
			],
			unlisted: [
				{ name: "pe", importance: 20, description: "Price-to-Earnings ratio" },
				{ name: "returns1y", importance: 15, description: "1-year returns" },
				{ name: "volatility", importance: 20, description: "Price volatility" },
				{
					name: "sharpeRatio",
					importance: 15,
					description: "Risk-adjusted returns (Sharpe)",
				},
				{ name: "returns3y", importance: 10, description: "3-year returns" },
				{ name: "yield", importance: 10, description: "Yield" },
				{
					name: "confidenceScore",
					importance: 10,
					description: "AI confidence",
				},
			],
			reits_invits: [
				{ name: "yield", importance: 30, description: "Yield" },
				{ name: "returns1y", importance: 20, description: "1-year returns" },
				{ name: "volatility", importance: 15, description: "Price volatility" },
				{
					name: "sharpeRatio",
					importance: 15,
					description: "Risk-adjusted returns (Sharpe)",
				},
				{ name: "pe", importance: 10, description: "Price-to-Earnings ratio" },
				{
					name: "confidenceScore",
					importance: 10,
					description: "AI confidence",
				},
			],
			fixed_deposits: [
				{ name: "yield", importance: 35, description: "Yield" },
				{ name: "rating", importance: 30, description: "Credit/fund rating" },
				{ name: "volatility", importance: 10, description: "Price volatility" },
				{ name: "returns1y", importance: 10, description: "1-year returns" },
				{
					name: "confidenceScore",
					importance: 15,
					description: "AI confidence",
				},
			],
			sgb: [
				{ name: "returns1y", importance: 25, description: "1-year returns" },
				{ name: "yield", importance: 25, description: "Yield" },
				{ name: "volatility", importance: 20, description: "Price volatility" },
				{ name: "returns3y", importance: 15, description: "3-year returns" },
				{
					name: "confidenceScore",
					importance: 15,
					description: "AI confidence",
				},
			],
			derivatives: [
				{ name: "volatility", importance: 30, description: "Price volatility" },
				{ name: "returns1y", importance: 20, description: "1-year returns" },
				{
					name: "sharpeRatio",
					importance: 20,
					description: "Risk-adjusted returns (Sharpe)",
				},
				{ name: "pe", importance: 10, description: "Price-to-Earnings ratio" },
				{ name: "yield", importance: 10, description: "Yield" },
				{
					name: "confidenceScore",
					importance: 10,
					description: "AI confidence",
				},
			],
		};

		return (
			importanceMap[assetClass] || [
				{ name: "returns1y", importance: 25, description: "1-year returns" },
				{ name: "volatility", importance: 20, description: "Price volatility" },
				{
					name: "sharpeRatio",
					importance: 15,
					description: "Risk-adjusted returns (Sharpe)",
				},
				{ name: "pe", importance: 15, description: "Price-to-Earnings ratio" },
				{ name: "yield", importance: 10, description: "Yield" },
				{ name: "returns3y", importance: 10, description: "3-year returns" },
				{
					name: "confidenceScore",
					importance: 5,
					description: "AI confidence",
				},
			]
		);
	}

	private async computeBaselineScore(assetClass: string): Promise<number> {
		try {
			const result = await db
				.select({
					avgScore: sql<number>`AVG(${dailyPicks.confidenceScore})`,
				})
				.from(dailyPicks)
				.where(eq(dailyPicks.category, assetClass));

			return result[0]?.avgScore ?? 50;
		} catch {
			return 50;
		}
	}

	async refreshCalibrationCache(assetClass: string): Promise<void> {
		const data = await this.getConfidenceCalibration(assetClass);
		this.calibrationCache.set(assetClass, { data, cachedAt: Date.now() });
	}
}

export const aiXAIEngine = new AIXAIEngine();
