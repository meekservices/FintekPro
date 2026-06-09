// @ts-nocheck
import { db } from "../db";
import {
	dailyPicks,
	aiFeatureSnapshots,
	aiPriceHistory,
	aiModelRegistry,
	aiPredictionLogs,
} from "@shared/schema";
import { eq, and, gte, lte, desc, sql, inArray, ne } from "drizzle-orm";
import { aiAnalyticsEngine } from "./ai-analytics-engine";
import * as ss from "simple-statistics";

export interface TrainingExample {
	assetId: string;
	assetClass: string;
	features: Record<string, number>;
	target: number;
	regime?: string;
	date: string;
}

export interface DecisionStump {
	featureName: string;
	threshold: number;
	leftValue: number;
	rightValue: number;
	weight: number;
	importance: number;
}

export interface ScoringModel {
	name: string;
	version: string;
	assetClass: string;
	stumps: DecisionStump[];
	intercept: number;
	featureNames: string[];
	featureMeans: Record<string, number>;
	featureStdDevs: Record<string, number>;
	trainingMetrics: {
		rmse: number;
		mae: number;
		r2: number;
		directionalAccuracy: number;
		sampleSize: number;
		trainedAt: string;
	};
	cvMetrics?: {
		folds: number;
		avgRmse: number;
		avgR2: number;
		avgDirectionalAccuracy: number;
	};
}

export interface ScoringResult {
	predictedReturn: number;
	confidence: number;
	featureContributions: Record<string, number>;
	modelVersion: string;
	modelName: string;
	regime?: string;
}

export interface TrainingConfig {
	assetClass?: string;
	targetDays?: number;
	maxStumps?: number;
	learningRate?: number;
	minSamples?: number;
	nFolds?: number;
	baggingFraction?: number;
}

export type AssetClass = string;

const FEATURE_KEYS = [
	"pe",
	"returns1y",
	"returns3y",
	"volatility",
	"sharpeRatio",
	"yield",
	"confidenceScore",
];

const ASSET_CLASSES: AssetClass[] = [
	"listed_stocks",
	"mutual_funds",
	"bonds",
	"unlisted",
	"global_stocks",
	"etfs",
	"reits_invits",
	"fixed_deposits",
	"sgb",
	"derivatives",
];

const MODEL_CACHE_TTL_MS = 60 * 60 * 1000;

class AIMLScoringEngine {
	private modelCache: Map<string, { model: ScoringModel; cachedAt: number }> =
		new Map();

	async buildTrainingDataset(
		config: TrainingConfig,
	): Promise<TrainingExample[]> {
		const completedStatuses = ["target_hit", "stoploss_hit", "expired"];

		const query = db
			.select()
			.from(dailyPicks)
			.where(inArray(dailyPicks.status, completedStatuses))
			.orderBy(desc(dailyPicks.recoDate))
			.limit(5000);

		const picks = await query;

		const examples: TrainingExample[] = [];

		for (const pick of picks) {
			if (config.assetClass && pick.category !== config.assetClass) continue;

			const returnPct = pick.returnPct
				? Number.parseFloat(pick.returnPct)
				: null;
			if (returnPct === null || Number.isNaN(returnPct)) continue;

			const keyMetrics = (pick.keyMetrics as Record<string, any>) || {};
			const features: Record<string, number> = {};
			let hasFeatures = false;

			for (const key of FEATURE_KEYS) {
				const val = keyMetrics[key];
				if (val !== null && val !== undefined && !Number.isNaN(Number(val))) {
					features[key] = Number(val);
					hasFeatures = true;
				}
			}

			if (pick.confidenceScore !== null && pick.confidenceScore !== undefined) {
				features.confidenceScore = pick.confidenceScore;
				hasFeatures = true;
			}

			if (!hasFeatures) continue;

			examples.push({
				assetId: pick.instrumentId || pick.symbol || pick.instrumentName,
				assetClass: pick.category,
				features,
				target: returnPct / 100,
				regime: keyMetrics.regime || undefined,
				date: pick.recoDate,
			});
		}

		return examples;
	}

	async trainModel(config: TrainingConfig): Promise<ScoringModel> {
		const maxStumps = config.maxStumps ?? 50;
		const learningRate = config.learningRate ?? 0.1;
		const minSamples = config.minSamples ?? 30;
		const nFolds = config.nFolds ?? 5;
		const baggingFraction = config.baggingFraction ?? 0.8;
		const assetClass = config.assetClass || "all";

		const examples = await this.buildTrainingDataset(config);

		if (examples.length < minSamples) {
			throw new Error(
				`Insufficient training data for ${assetClass}: ${examples.length} samples (need ${minSamples})`,
			);
		}

		const allFeatureNames = new Set<string>();
		for (const ex of examples) {
			for (const key of Object.keys(ex.features)) {
				allFeatureNames.add(key);
			}
		}
		const featureNames = Array.from(allFeatureNames);

		const featureMeans: Record<string, number> = {};
		const featureStdDevs: Record<string, number> = {};

		for (const fname of featureNames) {
			const vals = examples.map((ex) => ex.features[fname] ?? 0);
			featureMeans[fname] = ss.mean(vals);
			const std = vals.length > 1 ? ss.standardDeviation(vals) : 1;
			featureStdDevs[fname] = std === 0 ? 1 : std;
		}

		const n = examples.length;
		const featureMatrix: number[][] = [];
		for (let i = 0; i < n; i++) {
			const row: number[] = [];
			for (const fname of featureNames) {
				const raw = examples[i].features[fname] ?? 0;
				row.push(
					this.standardizeFeature(
						raw,
						featureMeans[fname],
						featureStdDevs[fname],
					),
				);
			}
			featureMatrix.push(row);
		}

		const targets = examples.map((ex) => ex.target);
		const intercept = ss.mean(targets);

		const residuals = targets.map((t) => t - intercept);

		const stumps: DecisionStump[] = [];
		const allIndices = Array.from({ length: n }, (_, i) => i);

		for (let round = 0; round < maxStumps; round++) {
			const bagSize = Math.max(Math.floor(n * baggingFraction), minSamples);
			const sampleIndices: number[] = [];
			for (let s = 0; s < bagSize; s++) {
				sampleIndices.push(allIndices[Math.floor(Math.random() * n)]);
			}

			const stump = this.findBestStump(
				featureMatrix,
				featureNames,
				residuals,
				sampleIndices,
			);
			stump.weight = learningRate;

			for (let i = 0; i < n; i++) {
				const featureIdx = featureNames.indexOf(stump.featureName);
				const featureVal = featureMatrix[i][featureIdx];
				const prediction =
					featureVal <= stump.threshold ? stump.leftValue : stump.rightValue;
				residuals[i] -= learningRate * prediction;
			}

			stumps.push(stump);
		}

		const predictions = examples.map((_, i) =>
			this.predictWithStumps(
				stumps,
				this.featureRowToRecord(featureMatrix[i], featureNames),
				intercept,
				featureMeans,
				featureStdDevs,
				true,
			),
		);

		const errors = predictions.map((p, i) => p - targets[i]);
		const mse = ss.mean(errors.map((e) => e * e));
		const rmse = Math.sqrt(mse);
		const mae = ss.mean(errors.map((e) => Math.abs(e)));
		const totalVariance = ss.variance(targets);
		const r2 = totalVariance > 0 ? 1 - mse / totalVariance : 0;

		let correctDirection = 0;
		for (let i = 0; i < predictions.length; i++) {
			if (
				(predictions[i] >= 0 && targets[i] >= 0) ||
				(predictions[i] < 0 && targets[i] < 0)
			) {
				correctDirection++;
			}
		}
		const directionalAccuracy = correctDirection / predictions.length;

		const cvMetrics = this.crossValidate(examples, config);

		const modelName = `scoring_${assetClass}`;
		const modelVersion = `v${Date.now()}`;

		const model: ScoringModel = {
			name: modelName,
			version: modelVersion,
			assetClass,
			stumps,
			intercept,
			featureNames,
			featureMeans,
			featureStdDevs,
			trainingMetrics: {
				rmse,
				mae,
				r2: Math.max(0, r2),
				directionalAccuracy,
				sampleSize: n,
				trainedAt: new Date().toISOString(),
			},
			cvMetrics,
		};

		try {
			await db
				.update(aiModelRegistry)
				.set({ isActive: false, deactivatedAt: new Date() })
				.where(
					and(
						eq(aiModelRegistry.assetClass, assetClass),
						eq(aiModelRegistry.modelType, "scoring"),
						eq(aiModelRegistry.isActive, true),
					),
				);

			await db.insert(aiModelRegistry).values({
				modelName,
				modelVersion,
				assetClass,
				modelType: "scoring",
				parameters: model as any,
				performanceMetrics: {
					rmse,
					mae,
					r2: model.trainingMetrics.r2,
					directionalAccuracy,
					sampleSize: n,
					cv: cvMetrics,
				},
				isActive: true,
				activatedAt: new Date(),
				trainedOnWindow: `${examples[examples.length - 1]?.date || "unknown"} to ${examples[0]?.date || "unknown"}`,
				notes: `Trained with ${maxStumps} stumps, lr=${learningRate}, ${n} samples`,
				createdBy: "system",
			});
		} catch (err) {
			console.error("[AIMLScoringEngine] Failed to persist model:", err);
		}

		this.modelCache.set(assetClass, { model, cachedAt: Date.now() });

		console.log(
			`✅ [AIMLScoringEngine] Trained model for ${assetClass}: RMSE=${rmse.toFixed(4)}, R²=${model.trainingMetrics.r2.toFixed(4)}, DA=${(directionalAccuracy * 100).toFixed(1)}%, samples=${n}`,
		);

		return model;
	}

	findBestStump(
		features: number[][],
		featureNames: string[],
		residuals: number[],
		sampleIndices: number[],
	): DecisionStump {
		let bestStump: DecisionStump = {
			featureName: featureNames[0],
			threshold: 0,
			leftValue: 0,
			rightValue: 0,
			weight: 0,
			importance: 0,
		};
		let bestMSE = Number.POSITIVE_INFINITY;

		const percentiles = [10, 25, 50, 75, 90];

		for (let fIdx = 0; fIdx < featureNames.length; fIdx++) {
			const sampledValues = sampleIndices.map((i) => features[i][fIdx]);
			const sortedValues = [...sampledValues].sort((a, b) => a - b);

			for (const pct of percentiles) {
				const threshIdx = Math.floor((pct / 100) * (sortedValues.length - 1));
				const threshold = sortedValues[threshIdx];

				const leftResiduals: number[] = [];
				const rightResiduals: number[] = [];

				for (const idx of sampleIndices) {
					if (features[idx][fIdx] <= threshold) {
						leftResiduals.push(residuals[idx]);
					} else {
						rightResiduals.push(residuals[idx]);
					}
				}

				if (leftResiduals.length === 0 || rightResiduals.length === 0) continue;

				const leftMean = ss.mean(leftResiduals);
				const rightMean = ss.mean(rightResiduals);

				let mse = 0;
				for (const r of leftResiduals) {
					mse += (r - leftMean) * (r - leftMean);
				}
				for (const r of rightResiduals) {
					mse += (r - rightMean) * (r - rightMean);
				}
				mse /= sampleIndices.length;

				if (mse < bestMSE) {
					bestMSE = mse;
					bestStump = {
						featureName: featureNames[fIdx],
						threshold,
						leftValue: leftMean,
						rightValue: rightMean,
						weight: 0,
						importance: Math.abs(leftMean - rightMean),
					};
				}
			}
		}

		return bestStump;
	}

	async score(
		assetId: string,
		assetClass: string,
		features: Record<string, number>,
		regime?: string,
	): Promise<ScoringResult | null> {
		const model = await this.getActiveModel(assetClass);
		if (!model) return null;

		let predictedReturn = this.predictWithStumps(
			model.stumps,
			features,
			model.intercept,
			model.featureMeans,
			model.featureStdDevs,
		);

		const featureContributions: Record<string, number> = {};
		for (const stump of model.stumps) {
			const rawVal = features[stump.featureName] ?? 0;
			const stdVal = this.standardizeFeature(
				rawVal,
				model.featureMeans[stump.featureName] ?? 0,
				model.featureStdDevs[stump.featureName] ?? 1,
			);
			const prediction =
				stdVal <= stump.threshold ? stump.leftValue : stump.rightValue;
			const contribution = stump.weight * prediction;
			featureContributions[stump.featureName] =
				(featureContributions[stump.featureName] || 0) + contribution;
		}

		if (regime) {
			const regimeAdjustments: Record<string, number> = {
				bull: 1.05,
				bear: 0.9,
				high_vol: 0.85,
				sideways: 0.95,
			};
			const adjustment = regimeAdjustments[regime] ?? 1.0;
			predictedReturn *= adjustment;
		}

		const predMagnitude = Math.abs(predictedReturn);
		const r2Factor = Math.max(0, model.trainingMetrics.r2);
		let confidence = Math.min(
			95,
			Math.max(
				10,
				Math.round(30 + r2Factor * 40 + Math.min(predMagnitude * 200, 25)),
			),
		);

		if (regime === "high_vol") confidence = Math.max(10, confidence - 10);

		try {
			const today = new Date().toISOString().split("T")[0];
			await db.insert(aiPredictionLogs).values({
				modelName: model.name,
				modelVersion: model.version,
				assetClass,
				predictedReturn: predictedReturn.toFixed(4),
				predictedConfidence: confidence.toFixed(2),
				featureVector: features,
				predictionDate: today,
			});
		} catch (err) {
			console.warn("[AIMLScoringEngine] Failed to log prediction:", err);
		}

		return {
			predictedReturn,
			confidence,
			featureContributions,
			modelVersion: model.version,
			modelName: model.name,
			regime,
		};
	}

	async trainAllModels(config?: TrainingConfig): Promise<ScoringModel[]> {
		const models: ScoringModel[] = [];

		for (const assetClass of ASSET_CLASSES) {
			try {
				const model = await this.trainModel({
					...config,
					assetClass,
				});
				models.push(model);
			} catch (err: any) {
				if (err.message?.includes("Insufficient training data")) {
					console.log(
						`[AIMLScoringEngine] Skipping ${assetClass}: ${err.message}`,
					);
				} else {
					console.error(
						`[AIMLScoringEngine] Error training ${assetClass}:`,
						err,
					);
				}
			}
		}

		console.log(
			`✅ [AIMLScoringEngine] Trained ${models.length}/${ASSET_CLASSES.length} models`,
		);
		return models;
	}

	async getActiveModel(assetClass: string): Promise<ScoringModel | null> {
		const cached = this.modelCache.get(assetClass);
		if (cached && Date.now() - cached.cachedAt < MODEL_CACHE_TTL_MS) {
			return cached.model;
		}

		try {
			const rows = await db
				.select()
				.from(aiModelRegistry)
				.where(
					and(
						eq(aiModelRegistry.assetClass, assetClass),
						eq(aiModelRegistry.modelType, "scoring"),
						eq(aiModelRegistry.isActive, true),
					),
				)
				.orderBy(desc(aiModelRegistry.createdAt))
				.limit(1);

			if (rows.length === 0) return null;

			const model = rows[0].parameters as unknown as ScoringModel;
			if (!model || !model.stumps) return null;

			this.modelCache.set(assetClass, { model, cachedAt: Date.now() });
			return model;
		} catch (err) {
			console.error(
				`[AIMLScoringEngine] Failed to load model for ${assetClass}:`,
				err,
			);
			return null;
		}
	}

	async evaluateModel(modelName: string, modelVersion: string): Promise<any> {
		try {
			const logs = await db
				.select()
				.from(aiPredictionLogs)
				.where(
					and(
						eq(aiPredictionLogs.modelName, modelName),
						eq(aiPredictionLogs.modelVersion, modelVersion),
						sql`${aiPredictionLogs.actualReturn} IS NOT NULL`,
					),
				)
				.orderBy(desc(aiPredictionLogs.predictionDate));

			if (logs.length === 0) {
				return { error: "No evaluated predictions found", predictions: 0 };
			}

			const predictions = logs.map((l) =>
				Number.parseFloat(l.predictedReturn || "0"),
			);
			const actuals = logs.map((l) => Number.parseFloat(l.actualReturn || "0"));

			const errors = predictions.map((p, i) => p - actuals[i]);
			const mse = ss.mean(errors.map((e) => e * e));
			const rmse = Math.sqrt(mse);
			const mae = ss.mean(errors.map((e) => Math.abs(e)));
			const totalVariance = actuals.length > 1 ? ss.variance(actuals) : 1;
			const r2 = totalVariance > 0 ? 1 - mse / totalVariance : 0;

			let correctDirection = 0;
			for (let i = 0; i < predictions.length; i++) {
				if (
					(predictions[i] >= 0 && actuals[i] >= 0) ||
					(predictions[i] < 0 && actuals[i] < 0)
				) {
					correctDirection++;
				}
			}

			return {
				modelName,
				modelVersion,
				totalPredictions: logs.length,
				rmse,
				mae,
				r2: Math.max(0, r2),
				directionalAccuracy: correctDirection / logs.length,
				avgPredicted: ss.mean(predictions),
				avgActual: ss.mean(actuals),
			};
		} catch (err) {
			console.error("[AIMLScoringEngine] Failed to evaluate model:", err);
			return { error: "Evaluation failed", details: String(err) };
		}
	}

	crossValidate(
		examples: TrainingExample[],
		config: TrainingConfig,
	): {
		folds: number;
		avgRmse: number;
		avgR2: number;
		avgDirectionalAccuracy: number;
	} {
		const nFolds = config.nFolds ?? 5;
		const maxStumps = config.maxStumps ?? 50;
		const learningRate = config.learningRate ?? 0.1;

		const shuffled = [...examples].sort(() => Math.random() - 0.5);
		const foldSize = Math.floor(shuffled.length / nFolds);

		const foldRmses: number[] = [];
		const foldR2s: number[] = [];
		const foldDAs: number[] = [];

		for (let fold = 0; fold < nFolds; fold++) {
			const testStart = fold * foldSize;
			const testEnd =
				fold === nFolds - 1 ? shuffled.length : testStart + foldSize;
			const testSet = shuffled.slice(testStart, testEnd);
			const trainSet = [
				...shuffled.slice(0, testStart),
				...shuffled.slice(testEnd),
			];

			if (trainSet.length < 5 || testSet.length < 2) continue;

			const allFeatureNames = new Set<string>();
			for (const ex of trainSet) {
				for (const key of Object.keys(ex.features)) {
					allFeatureNames.add(key);
				}
			}
			const featureNames = Array.from(allFeatureNames);

			const fMeans: Record<string, number> = {};
			const fStds: Record<string, number> = {};
			for (const fname of featureNames) {
				const vals = trainSet.map((ex) => ex.features[fname] ?? 0);
				fMeans[fname] = ss.mean(vals);
				const std = vals.length > 1 ? ss.standardDeviation(vals) : 1;
				fStds[fname] = std === 0 ? 1 : std;
			}

			const trainMatrix: number[][] = trainSet.map((ex) =>
				featureNames.map((fname) =>
					this.standardizeFeature(
						ex.features[fname] ?? 0,
						fMeans[fname],
						fStds[fname],
					),
				),
			);

			const trainTargets = trainSet.map((ex) => ex.target);
			const fIntercept = ss.mean(trainTargets);
			const fResiduals = trainTargets.map((t) => t - fIntercept);

			const fStumps: DecisionStump[] = [];
			const trainIndices = Array.from({ length: trainSet.length }, (_, i) => i);

			for (let round = 0; round < maxStumps; round++) {
				const stump = this.findBestStump(
					trainMatrix,
					featureNames,
					fResiduals,
					trainIndices,
				);
				stump.weight = learningRate;

				for (let i = 0; i < trainSet.length; i++) {
					const featureIdx = featureNames.indexOf(stump.featureName);
					const featureVal = trainMatrix[i][featureIdx];
					const prediction =
						featureVal <= stump.threshold ? stump.leftValue : stump.rightValue;
					fResiduals[i] -= learningRate * prediction;
				}

				fStumps.push(stump);
			}

			const testPredictions = testSet.map((ex) =>
				this.predictWithStumps(fStumps, ex.features, fIntercept, fMeans, fStds),
			);
			const testTargets = testSet.map((ex) => ex.target);

			const testErrors = testPredictions.map((p, i) => p - testTargets[i]);
			const testMSE = ss.mean(testErrors.map((e) => e * e));
			foldRmses.push(Math.sqrt(testMSE));

			const testVariance =
				testTargets.length > 1 ? ss.variance(testTargets) : 1;
			foldR2s.push(
				testVariance > 0 ? Math.max(0, 1 - testMSE / testVariance) : 0,
			);

			let correctDir = 0;
			for (let i = 0; i < testPredictions.length; i++) {
				if (
					(testPredictions[i] >= 0 && testTargets[i] >= 0) ||
					(testPredictions[i] < 0 && testTargets[i] < 0)
				) {
					correctDir++;
				}
			}
			foldDAs.push(correctDir / testPredictions.length);
		}

		return {
			folds: nFolds,
			avgRmse: foldRmses.length > 0 ? ss.mean(foldRmses) : 0,
			avgR2: foldR2s.length > 0 ? ss.mean(foldR2s) : 0,
			avgDirectionalAccuracy: foldDAs.length > 0 ? ss.mean(foldDAs) : 0,
		};
	}

	private standardizeFeature(
		value: number,
		mean: number,
		stddev: number,
	): number {
		if (stddev === 0 || Number.isNaN(stddev)) return 0;
		return (value - mean) / stddev;
	}

	private predictWithStumps(
		stumps: DecisionStump[],
		features: Record<string, number>,
		intercept: number,
		featureMeans: Record<string, number>,
		featureStdDevs: Record<string, number>,
		alreadyStandardized: boolean = false,
	): number {
		let prediction = intercept;

		for (const stump of stumps) {
			let featureVal: number;
			if (alreadyStandardized) {
				featureVal = features[stump.featureName] ?? 0;
			} else {
				const rawVal = features[stump.featureName] ?? 0;
				featureVal = this.standardizeFeature(
					rawVal,
					featureMeans[stump.featureName] ?? 0,
					featureStdDevs[stump.featureName] ?? 1,
				);
			}

			const stumpPrediction =
				featureVal <= stump.threshold ? stump.leftValue : stump.rightValue;
			prediction += stump.weight * stumpPrediction;
		}

		return prediction;
	}

	private featureRowToRecord(
		row: number[],
		featureNames: string[],
	): Record<string, number> {
		const record: Record<string, number> = {};
		for (let i = 0; i < featureNames.length; i++) {
			record[featureNames[i]] = row[i];
		}
		return record;
	}
}

export const aiMLScoringEngine = new AIMLScoringEngine();
