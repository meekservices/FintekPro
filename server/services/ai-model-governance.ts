// @ts-nocheck
import { db } from "../db";
import { aiModelRegistry, aiPredictionLogs, aiFeatureSnapshots, dailyPicks } from "@shared/schema";
import { eq, and, desc, sql, gte, lte, ne } from "drizzle-orm";
import { aiMLScoringEngine } from "./ai-ml-scoring-engine";
import { aiBacktestingEngine } from "./ai-backtesting-engine";
import * as ss from 'simple-statistics';

export interface DriftMetrics {
  featureName: string;
  psiScore: number;
  ksStatistic: number;
  meanShift: number;
  stdShift: number;
  isDrifted: boolean;
}

export interface ModelHealthReport {
  modelName: string;
  modelVersion: string;
  assetClass: string;
  status: 'healthy' | 'warning' | 'critical' | 'stale';
  overallDriftScore: number;
  featureDrift: DriftMetrics[];
  performanceMetrics: {
    recentSharpe: number;
    trainingSharpe: number;
    sharpeDecay: number;
    recentDirectionalAccuracy: number;
    trainingDirectionalAccuracy: number;
    accuracyDecay: number;
    recentRmse: number;
    trainingRmse: number;
    predictionCount: number;
    daysSinceTraining: number;
  };
  recommendations: string[];
  needsRetrain: boolean;
  lastCheckedAt: string;
}

export interface GovernanceConfig {
  psiThreshold?: number;
  ksThreshold?: number;
  sharpeDecayThreshold?: number;
  accuracyDecayThreshold?: number;
  staleModelDays?: number;
  maxPredictionsBeforeRecheck?: number;
}

export interface GovernanceSummary {
  totalModels: number;
  healthyModels: number;
  warningModels: number;
  criticalModels: number;
  staleModels: number;
  modelsNeedingRetrain: string[];
  lastGovernanceRun: string;
  reports: ModelHealthReport[];
}

class AIModelGovernance {

  async runGovernanceCheck(config?: GovernanceConfig): Promise<GovernanceSummary> {
    const cfg = this.resolveConfig(config);

    const activeModels = await db
      .select()
      .from(aiModelRegistry)
      .where(
        and(
          eq(aiModelRegistry.isActive, true),
          eq(aiModelRegistry.modelType, 'scoring')
        )
      )
      .orderBy(desc(aiModelRegistry.createdAt));

    const reports: ModelHealthReport[] = [];

    for (const model of activeModels) {
      try {
        const report = await this.checkModelHealth(model.modelName, model.modelVersion, cfg);
        reports.push(report);
      } catch (err) {
        console.error(`[AIModelGovernance] Error checking model ${model.modelName}:`, err);
      }
    }

    const healthyModels = reports.filter(r => r.status === 'healthy').length;
    const warningModels = reports.filter(r => r.status === 'warning').length;
    const criticalModels = reports.filter(r => r.status === 'critical').length;
    const staleModels = reports.filter(r => r.status === 'stale').length;
    const modelsNeedingRetrain = reports
      .filter(r => r.needsRetrain)
      .map(r => `${r.modelName}@${r.modelVersion}`);

    const summary: GovernanceSummary = {
      totalModels: reports.length,
      healthyModels,
      warningModels,
      criticalModels,
      staleModels,
      modelsNeedingRetrain,
      lastGovernanceRun: new Date().toISOString(),
      reports,
    };

    console.log(`[AIModelGovernance] Governance check complete: ${healthyModels} healthy, ${warningModels} warning, ${criticalModels} critical, ${staleModels} stale`);

    return summary;
  }

  async checkModelHealth(modelName: string, modelVersion: string, config?: GovernanceConfig): Promise<ModelHealthReport> {
    const cfg = this.resolveConfig(config);

    const rows = await db
      .select()
      .from(aiModelRegistry)
      .where(
        and(
          eq(aiModelRegistry.modelName, modelName),
          eq(aiModelRegistry.modelVersion, modelVersion)
        )
      )
      .limit(1);

    if (rows.length === 0) {
      throw new Error(`Model ${modelName}@${modelVersion} not found`);
    }

    const model = rows[0];
    const params = model.parameters as any;
    const perfMetrics = model.performanceMetrics as any;

    const featureDrift = await this.detectFeatureDrift(model, cfg);
    const overallDriftScore = this.computeOverallDrift(featureDrift);

    const performanceDecay = await this.getPerformanceDecay(modelName, modelVersion);

    const trainedAt = params?.trainingMetrics?.trainedAt || model.createdAt?.toISOString() || new Date().toISOString();
    const daysSinceTraining = Math.floor((Date.now() - new Date(trainedAt).getTime()) / (1000 * 60 * 60 * 24));

    const trainingSharpe = perfMetrics?.sharpeRatio ?? perfMetrics?.cv?.avgDirectionalAccuracy ?? 0;
    const trainingDA = perfMetrics?.directionalAccuracy ?? params?.trainingMetrics?.directionalAccuracy ?? 0;
    const trainingRmse = perfMetrics?.rmse ?? params?.trainingMetrics?.rmse ?? 0;

    const recentSharpe = performanceDecay.recentSharpe ?? 0;
    const recentDA = performanceDecay.recentDirectionalAccuracy ?? 0;
    const recentRmse = performanceDecay.recentRmse ?? 0;
    const predictionCount = performanceDecay.predictionCount ?? 0;

    const sharpeDecay = trainingSharpe !== 0
      ? Math.max(0, (trainingSharpe - recentSharpe) / Math.abs(trainingSharpe))
      : 0;

    const accuracyDecay = trainingDA !== 0
      ? Math.max(0, (trainingDA - recentDA) / trainingDA)
      : 0;

    const metrics = {
      recentSharpe,
      trainingSharpe,
      sharpeDecay,
      recentDirectionalAccuracy: recentDA,
      trainingDirectionalAccuracy: trainingDA,
      accuracyDecay,
      recentRmse,
      trainingRmse,
      predictionCount,
      daysSinceTraining,
    };

    let status: ModelHealthReport['status'] = 'healthy';

    if (daysSinceTraining > cfg.staleModelDays! && predictionCount === 0) {
      status = 'stale';
    } else if (overallDriftScore > cfg.psiThreshold! || sharpeDecay > cfg.sharpeDecayThreshold!) {
      status = 'critical';
    } else if (
      overallDriftScore > cfg.psiThreshold! * 0.5 ||
      sharpeDecay > cfg.sharpeDecayThreshold! * 0.5 ||
      accuracyDecay > cfg.accuracyDecayThreshold!
    ) {
      status = 'warning';
    }

    const needsRetrain = status === 'critical' || status === 'stale';

    const report: ModelHealthReport = {
      modelName,
      modelVersion,
      assetClass: model.assetClass || 'unknown',
      status,
      overallDriftScore,
      featureDrift,
      performanceMetrics: metrics,
      recommendations: [],
      needsRetrain,
      lastCheckedAt: new Date().toISOString(),
    };

    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  computePSI(trainingDist: number[], liveDist: number[], bins: number = 10): number {
    if (trainingDist.length === 0 || liveDist.length === 0) return 0;

    const allValues = [...trainingDist, ...liveDist];
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);

    if (minVal === maxVal) return 0;

    const binWidth = (maxVal - minVal) / bins;
    const epsilon = 0.0001;

    const trainBins = new Array(bins).fill(0);
    const liveBins = new Array(bins).fill(0);

    for (const val of trainingDist) {
      const idx = Math.min(Math.floor((val - minVal) / binWidth), bins - 1);
      trainBins[idx]++;
    }

    for (const val of liveDist) {
      const idx = Math.min(Math.floor((val - minVal) / binWidth), bins - 1);
      liveBins[idx]++;
    }

    let psi = 0;
    for (let i = 0; i < bins; i++) {
      const trainPct = (trainBins[i] / trainingDist.length) + epsilon;
      const livePct = (liveBins[i] / liveDist.length) + epsilon;
      psi += (livePct - trainPct) * Math.log(livePct / trainPct);
    }

    return Math.max(0, psi);
  }

  computeKSStatistic(sample1: number[], sample2: number[]): number {
    if (sample1.length === 0 || sample2.length === 0) return 0;

    const sorted1 = [...sample1].sort((a, b) => a - b);
    const sorted2 = [...sample2].sort((a, b) => a - b);

    const allValues = [...new Set([...sorted1, ...sorted2])].sort((a, b) => a - b);

    let maxGap = 0;

    for (const val of allValues) {
      const ecdf1 = sorted1.filter(v => v <= val).length / sorted1.length;
      const ecdf2 = sorted2.filter(v => v <= val).length / sorted2.length;
      const gap = Math.abs(ecdf1 - ecdf2);
      if (gap > maxGap) maxGap = gap;
    }

    return maxGap;
  }

  async detectFeatureDrift(model: any, config: GovernanceConfig): Promise<DriftMetrics[]> {
    const cfg = this.resolveConfig(config);
    const params = model.parameters as any;

    if (!params?.featureMeans || !params?.featureStdDevs) {
      return [];
    }

    const featureNames: string[] = params.featureNames || Object.keys(params.featureMeans);
    const assetClass = model.assetClass || 'all';

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    let snapshots;
    try {
      snapshots = await db
        .select()
        .from(aiFeatureSnapshots)
        .where(
          and(
            eq(aiFeatureSnapshots.assetClass, assetClass),
            gte(aiFeatureSnapshots.snapshotDate, thirtyDaysAgoStr)
          )
        )
        .orderBy(desc(aiFeatureSnapshots.snapshotDate))
        .limit(1000);
    } catch (err) {
      console.warn('[AIModelGovernance] Failed to fetch feature snapshots:', err);
      return [];
    }

    if (snapshots.length === 0) {
      return featureNames.map(fname => ({
        featureName: fname,
        psiScore: 0,
        ksStatistic: 0,
        meanShift: 0,
        stdShift: 0,
        isDrifted: false,
      }));
    }

    const liveFeatureValues: Record<string, number[]> = {};
    for (const fname of featureNames) {
      liveFeatureValues[fname] = [];
    }

    for (const snap of snapshots) {
      const featureJson = snap.featureJson as Record<string, any>;
      if (!featureJson) continue;

      for (const fname of featureNames) {
        const val = featureJson[fname];
        if (val !== null && val !== undefined && !isNaN(Number(val))) {
          liveFeatureValues[fname].push(Number(val));
        }
      }
    }

    const driftMetrics: DriftMetrics[] = [];

    for (const fname of featureNames) {
      const trainingMean = params.featureMeans[fname] ?? 0;
      const trainingStd = params.featureStdDevs[fname] ?? 1;
      const liveValues = liveFeatureValues[fname];

      if (liveValues.length < 5) {
        driftMetrics.push({
          featureName: fname,
          psiScore: 0,
          ksStatistic: 0,
          meanShift: 0,
          stdShift: 0,
          isDrifted: false,
        });
        continue;
      }

      const liveMean = ss.mean(liveValues);
      const liveStd = liveValues.length > 1 ? ss.standardDeviation(liveValues) : 0;

      const syntheticTraining: number[] = [];
      for (let i = 0; i < Math.max(liveValues.length, 100); i++) {
        syntheticTraining.push(trainingMean + (Math.random() - 0.5) * 2 * trainingStd);
      }

      const psiScore = this.computePSI(syntheticTraining, liveValues);
      const ksStatistic = this.computeKSStatistic(syntheticTraining, liveValues);
      const meanShift = Math.abs(liveMean - trainingMean);
      const stdShift = Math.abs(liveStd - trainingStd);

      const isDrifted = psiScore > cfg.psiThreshold! || ksStatistic > cfg.ksThreshold!;

      driftMetrics.push({
        featureName: fname,
        psiScore: Math.round(psiScore * 10000) / 10000,
        ksStatistic: Math.round(ksStatistic * 10000) / 10000,
        meanShift: Math.round(meanShift * 10000) / 10000,
        stdShift: Math.round(stdShift * 10000) / 10000,
        isDrifted,
      });
    }

    return driftMetrics;
  }

  async getPerformanceDecay(modelName: string, modelVersion: string): Promise<any> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

      const recentLogs = await db
        .select()
        .from(aiPredictionLogs)
        .where(
          and(
            eq(aiPredictionLogs.modelName, modelName),
            eq(aiPredictionLogs.modelVersion, modelVersion),
            sql`${aiPredictionLogs.actualReturn} IS NOT NULL`,
            gte(aiPredictionLogs.predictionDate, thirtyDaysAgoStr)
          )
        )
        .orderBy(desc(aiPredictionLogs.predictionDate));

      if (recentLogs.length === 0) {
        const modelRows = await db
          .select()
          .from(aiModelRegistry)
          .where(
            and(
              eq(aiModelRegistry.modelName, modelName),
              eq(aiModelRegistry.modelVersion, modelVersion)
            )
          )
          .limit(1);

        const perfMetrics = modelRows[0]?.performanceMetrics as any;

        return {
          recentSharpe: 0,
          recentDirectionalAccuracy: 0,
          recentRmse: 0,
          predictionCount: 0,
          trainingSharpe: perfMetrics?.sharpeRatio ?? 0,
          trainingDirectionalAccuracy: perfMetrics?.directionalAccuracy ?? 0,
          trainingRmse: perfMetrics?.rmse ?? 0,
        };
      }

      const predictions = recentLogs.map(l => parseFloat(l.predictedReturn || '0'));
      const actuals = recentLogs.map(l => parseFloat(l.actualReturn || '0'));

      const errors = predictions.map((p, i) => p - actuals[i]);
      const mse = ss.mean(errors.map(e => e * e));
      const recentRmse = Math.sqrt(mse);

      let correctDirection = 0;
      for (let i = 0; i < predictions.length; i++) {
        if ((predictions[i] >= 0 && actuals[i] >= 0) || (predictions[i] < 0 && actuals[i] < 0)) {
          correctDirection++;
        }
      }
      const recentDirectionalAccuracy = correctDirection / predictions.length;

      const dailyReturns = actuals.map(a => a);
      const meanReturn = dailyReturns.length > 0 ? ss.mean(dailyReturns) : 0;
      const stdReturn = dailyReturns.length > 1 ? ss.standardDeviation(dailyReturns) : 1;
      const recentSharpe = stdReturn !== 0 ? (meanReturn / stdReturn) * Math.sqrt(252) : 0;

      return {
        recentSharpe: Math.round(recentSharpe * 100) / 100,
        recentDirectionalAccuracy: Math.round(recentDirectionalAccuracy * 10000) / 10000,
        recentRmse: Math.round(recentRmse * 10000) / 10000,
        predictionCount: recentLogs.length,
      };
    } catch (err) {
      console.error('[AIModelGovernance] Failed to compute performance decay:', err);
      return {
        recentSharpe: 0,
        recentDirectionalAccuracy: 0,
        recentRmse: 0,
        predictionCount: 0,
      };
    }
  }

  async triggerRetrain(assetClass: string): Promise<any> {
    try {
      console.log(`[AIModelGovernance] Triggering retrain for ${assetClass}`);

      const result = await aiMLScoringEngine.trainModel({ assetClass });

      console.log(`[AIModelGovernance] Retrain complete for ${assetClass}: ${result.version}`);

      return {
        success: true,
        assetClass,
        newModelName: result.name,
        newModelVersion: result.version,
        trainingMetrics: result.trainingMetrics,
      };
    } catch (err: any) {
      console.error(`[AIModelGovernance] Retrain failed for ${assetClass}:`, err);
      return {
        success: false,
        assetClass,
        error: err.message || String(err),
      };
    }
  }

  async rollbackModel(assetClass: string, targetVersion?: string): Promise<any> {
    try {
      const currentModels = await db
        .select()
        .from(aiModelRegistry)
        .where(
          and(
            eq(aiModelRegistry.assetClass, assetClass),
            eq(aiModelRegistry.modelType, 'scoring'),
            eq(aiModelRegistry.isActive, true)
          )
        )
        .limit(1);

      if (currentModels.length === 0) {
        return { success: false, error: `No active model found for ${assetClass}` };
      }

      const currentModel = currentModels[0];

      let targetModel;

      if (targetVersion) {
        const targetRows = await db
          .select()
          .from(aiModelRegistry)
          .where(
            and(
              eq(aiModelRegistry.assetClass, assetClass),
              eq(aiModelRegistry.modelType, 'scoring'),
              eq(aiModelRegistry.modelVersion, targetVersion)
            )
          )
          .limit(1);

        if (targetRows.length === 0) {
          return { success: false, error: `Target version ${targetVersion} not found for ${assetClass}` };
        }
        targetModel = targetRows[0];
      } else {
        const previousModels = await db
          .select()
          .from(aiModelRegistry)
          .where(
            and(
              eq(aiModelRegistry.assetClass, assetClass),
              eq(aiModelRegistry.modelType, 'scoring'),
              eq(aiModelRegistry.isActive, false)
            )
          )
          .orderBy(desc(aiModelRegistry.createdAt))
          .limit(1);

        if (previousModels.length === 0) {
          return { success: false, error: `No previous model version found for ${assetClass}` };
        }
        targetModel = previousModels[0];
      }

      await db.update(aiModelRegistry)
        .set({ isActive: false, deactivatedAt: new Date() })
        .where(eq(aiModelRegistry.id, currentModel.id));

      await db.update(aiModelRegistry)
        .set({ isActive: true, activatedAt: new Date(), deactivatedAt: null })
        .where(eq(aiModelRegistry.id, targetModel.id));

      (aiMLScoringEngine as any).modelCache?.clear?.();

      console.log(`[AIModelGovernance] Rolled back ${assetClass} from ${currentModel.modelVersion} to ${targetModel.modelVersion}`);

      return {
        success: true,
        assetClass,
        previousVersion: currentModel.modelVersion,
        activatedVersion: targetModel.modelVersion,
        activatedModelName: targetModel.modelName,
      };
    } catch (err: any) {
      console.error(`[AIModelGovernance] Rollback failed for ${assetClass}:`, err);
      return { success: false, error: err.message || String(err) };
    }
  }

  async getModelHistory(assetClass: string): Promise<any[]> {
    const models = await db
      .select()
      .from(aiModelRegistry)
      .where(
        and(
          eq(aiModelRegistry.assetClass, assetClass),
          eq(aiModelRegistry.modelType, 'scoring')
        )
      )
      .orderBy(desc(aiModelRegistry.createdAt));

    return models.map(m => ({
      id: m.id,
      modelName: m.modelName,
      modelVersion: m.modelVersion,
      assetClass: m.assetClass,
      isActive: m.isActive,
      performanceMetrics: m.performanceMetrics,
      trainedOnWindow: m.trainedOnWindow,
      notes: m.notes,
      createdAt: m.createdAt?.toISOString(),
      activatedAt: m.activatedAt?.toISOString(),
      deactivatedAt: m.deactivatedAt?.toISOString(),
    }));
  }

  async updatePredictionOutcomes(): Promise<{ updated: number }> {
    try {
      const completedStatuses = ['target_hit', 'stoploss_hit', 'expired'];

      const pendingLogs = await db
        .select({
          logId: aiPredictionLogs.id,
          pickId: aiPredictionLogs.pickId,
          predictedReturn: aiPredictionLogs.predictedReturn,
        })
        .from(aiPredictionLogs)
        .where(
          and(
            sql`${aiPredictionLogs.actualReturn} IS NULL`,
            sql`${aiPredictionLogs.pickId} IS NOT NULL`
          )
        )
        .limit(1000);

      if (pendingLogs.length === 0) {
        return { updated: 0 };
      }

      let updated = 0;

      for (const log of pendingLogs) {
        if (!log.pickId) continue;

        const picks = await db
          .select()
          .from(dailyPicks)
          .where(
            and(
              eq(dailyPicks.id, log.pickId),
              sql`${dailyPicks.status} IN ('target_hit', 'stoploss_hit', 'expired')`
            )
          )
          .limit(1);

        if (picks.length === 0) continue;

        const pick = picks[0];
        const actualReturn = pick.returnPct ? parseFloat(pick.returnPct) / 100 : null;

        if (actualReturn === null) continue;

        const predictedReturn = parseFloat(log.predictedReturn || '0');
        const isCorrectDirection =
          (predictedReturn >= 0 && actualReturn >= 0) ||
          (predictedReturn < 0 && actualReturn < 0);

        const outcomeDate = pick.statusUpdatedAt
          ? new Date(pick.statusUpdatedAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0];

        await db.update(aiPredictionLogs)
          .set({
            actualReturn: actualReturn.toFixed(4),
            isCorrectDirection,
            outcomeDate,
          })
          .where(eq(aiPredictionLogs.id, log.id));

        updated++;
      }

      console.log(`[AIModelGovernance] Updated ${updated} prediction outcomes`);
      return { updated };
    } catch (err) {
      console.error('[AIModelGovernance] Failed to update prediction outcomes:', err);
      return { updated: 0 };
    }
  }

  private computeOverallDrift(driftMetrics: DriftMetrics[]): number {
    if (driftMetrics.length === 0) return 0;

    const avgPSI = ss.mean(driftMetrics.map(d => d.psiScore));
    return Math.min(1, Math.max(0, avgPSI));
  }

  private generateRecommendations(report: Partial<ModelHealthReport>): string[] {
    const recommendations: string[] = [];
    const metrics = report.performanceMetrics;
    const drift = report.featureDrift || [];
    const status = report.status;

    const driftedFeatures = drift.filter(d => d.isDrifted);
    for (const d of driftedFeatures) {
      recommendations.push(
        `Feature '${d.featureName}' has drifted significantly (PSI=${d.psiScore.toFixed(2)}, KS=${d.ksStatistic.toFixed(2)}). Consider retraining.`
      );
    }

    if (metrics) {
      if (metrics.sharpeDecay > 0.3) {
        recommendations.push(
          `Sharpe ratio has declined by ${(metrics.sharpeDecay * 100).toFixed(0)}%. Model may be outdated.`
        );
      }

      if (metrics.accuracyDecay > 0.15) {
        recommendations.push(
          `Directional accuracy has declined by ${(metrics.accuracyDecay * 100).toFixed(0)}%. Model predictions are becoming less reliable.`
        );
      }

      if (metrics.daysSinceTraining > 30 && metrics.predictionCount === 0) {
        recommendations.push(
          `Model is ${metrics.daysSinceTraining} days old with no recent predictions. Consider refreshing.`
        );
      }

      if (metrics.daysSinceTraining > 60) {
        recommendations.push(
          `Model is ${metrics.daysSinceTraining} days old. Periodic retraining recommended.`
        );
      }

      if (metrics.predictionCount > 500) {
        recommendations.push(
          `Model has made ${metrics.predictionCount} predictions. Consider running a governance check more frequently.`
        );
      }
    }

    if (status === 'critical') {
      recommendations.push('CRITICAL: Immediate retraining recommended to restore model performance.');
    } else if (status === 'stale') {
      recommendations.push('Model is stale. Consider retraining or deactivating if no longer needed.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Model is performing within expected parameters. No action needed.');
    }

    return recommendations;
  }

  private resolveConfig(config?: GovernanceConfig): Required<GovernanceConfig> {
    return {
      psiThreshold: config?.psiThreshold ?? 0.2,
      ksThreshold: config?.ksThreshold ?? 0.1,
      sharpeDecayThreshold: config?.sharpeDecayThreshold ?? 0.30,
      accuracyDecayThreshold: config?.accuracyDecayThreshold ?? 0.15,
      staleModelDays: config?.staleModelDays ?? 30,
      maxPredictionsBeforeRecheck: config?.maxPredictionsBeforeRecheck ?? 500,
    };
  }
}

export const aiModelGovernance = new AIModelGovernance();
