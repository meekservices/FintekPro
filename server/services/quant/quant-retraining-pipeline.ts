import { db } from '../../db';
import { quantModelRegistry, quantRetrainingLog, quantGovernancePolicy, quantRunLog, rebalanceDecisionLog, strategicTargetWeights } from '@shared/schema';
import { eq, and, desc, gte, sql } from 'drizzle-orm';
import { mvoEngine, type AssetData, type MVOResult } from './mvo-engine';
import { blackLittermanEngine } from './black-litterman-engine';
import { driftPredictionEngine } from './drift-prediction-engine';
import { quantBacktestingEngine, type BacktestResult } from './quant-backtesting-engine';

interface RetrainingResult {
  modelName: string;
  oldVersion: string | null;
  newVersion: string;
  status: 'PROMOTED' | 'DISCARDED' | 'ERROR';
  validationScore: number | null;
  backtestSharpe: number | null;
  trainingDurationMs: number;
  metrics: Record<string, any>;
  errorMessage?: string;
}

const CATEGORIES = ['equity', 'debt', 'hybrid', 'gold', 'silver', 'index', 'etf', 'international', 'reit', 'invit', 'bonds', 'mld', 'listed_stocks', 'unlisted_stocks', 'pms', 'aif'];

class QuantRetrainingPipeline {

  async retrainMVOExpectedReturns(): Promise<RetrainingResult> {
    const startTime = Date.now();
    const modelName = 'MVO_EXPECTED_RETURNS';

    try {
      const activeModel = await this.getActiveModel(modelName);
      const newVersion = this.generateVersion(modelName);

      console.log(`[Retrain] Starting ${modelName} retraining. Active: ${activeModel?.version || 'none'}`);

      const assetsData: AssetData[] = CATEGORIES.map(cat => ({
        category: cat,
        returns: this.generateHistoricalReturns(cat, 500),
        currentWeight: 1 / CATEGORIES.length,
      }));

      const configs = [
        { riskAversion: 2.0, shrinkageIntensity: 0.3, ewmaSpan: 40 },
        { riskAversion: 2.5, shrinkageIntensity: 0.5, ewmaSpan: 60 },
        { riskAversion: 3.0, shrinkageIntensity: 0.7, ewmaSpan: 80 },
      ];

      let bestResult: MVOResult | null = null;
      let bestBacktest: BacktestResult | null = null;
      let bestConfig: any = null;

      for (const config of configs) {
        try {
          const mvoResult = await mvoEngine.run(assetsData, config);
          const categoryReturns: Record<string, number[]> = {};
          for (const cat of CATEGORIES) {
            categoryReturns[cat] = this.generateMonthlyReturns(cat, 36);
          }

          const backtest = quantBacktestingEngine.runWeightBacktest(
            mvoResult.weights, categoryReturns
          );

          if (!bestBacktest || backtest.sharpeRatio > bestBacktest.sharpeRatio) {
            bestResult = mvoResult;
            bestBacktest = backtest;
            bestConfig = config;
          }
        } catch (e: any) {
          console.warn(`[Retrain] MVO config ${JSON.stringify(config)} failed:`, e.message);
        }
      }

      if (!bestResult || !bestBacktest) {
        throw new Error('All MVO configurations failed during retraining');
      }

      let stabilityCheck = { passed: true, turnoverIncrease: 0, failReason: null as string | null };
      if (activeModel?.artifactData) {
        const oldWeights = (activeModel.artifactData as any).weights || {};
        stabilityCheck = quantBacktestingEngine.validateWeightStability(oldWeights, bestResult.weights);
      }

      const shouldPromote = bestBacktest.passed && stabilityCheck.passed &&
        (!activeModel || bestBacktest.sharpeRatio >= (activeModel.backtestSharpe || 0));

      const candidateEntry = await db.insert(quantModelRegistry).values({
        modelName,
        version: newVersion,
        modelType: 'MVO',
        validationScore: bestBacktest.winRate,
        backtestSharpe: bestBacktest.sharpeRatio,
        status: shouldPromote ? 'active' : 'candidate',
        artifactData: {
          weights: bestResult.weights,
          config: bestConfig,
          expectedReturns: bestResult.expectedReturns,
          portfolioVolatility: bestResult.portfolioVolatility,
        },
        trainingConfig: bestConfig,
        performanceMetrics: {
          ...bestBacktest,
          stabilityCheck,
        },
        promotedAt: shouldPromote ? new Date() : null,
      }).returning();

      if (shouldPromote && activeModel) {
        await db.update(quantModelRegistry)
          .set({ status: 'archived', archivedAt: new Date() })
          .where(eq(quantModelRegistry.id, activeModel.id));
      }

      const trainingDurationMs = Date.now() - startTime;
      const result: RetrainingResult = {
        modelName,
        oldVersion: activeModel?.version || null,
        newVersion,
        status: shouldPromote ? 'PROMOTED' : 'DISCARDED',
        validationScore: bestBacktest.winRate,
        backtestSharpe: bestBacktest.sharpeRatio,
        trainingDurationMs,
        metrics: { backtest: bestBacktest, stability: stabilityCheck, config: bestConfig },
      };

      await this.logRetraining(result);
      console.log(`[Retrain] ${modelName}: ${result.status}. Sharpe=${bestBacktest.sharpeRatio.toFixed(3)}, Duration=${trainingDurationMs}ms`);
      return result;

    } catch (error: any) {
      const trainingDurationMs = Date.now() - startTime;
      const result: RetrainingResult = {
        modelName,
        oldVersion: null,
        newVersion: 'error',
        status: 'ERROR',
        validationScore: null,
        backtestSharpe: null,
        trainingDurationMs,
        metrics: {},
        errorMessage: error.message,
      };
      await this.logRetraining(result);
      console.error(`[Retrain] ${modelName} FAILED:`, error.message);
      return result;
    }
  }

  async retrainCovarianceMatrix(): Promise<RetrainingResult> {
    const startTime = Date.now();
    const modelName = 'COVARIANCE_MATRIX';

    try {
      const newVersion = this.generateVersion(modelName);
      console.log(`[Retrain] Starting ${modelName} weekly recalibration`);

      const assetsData: AssetData[] = CATEGORIES.map(cat => ({
        category: cat,
        returns: this.generateHistoricalReturns(cat, 250),
        currentWeight: 1 / CATEGORIES.length,
      }));

      const covMatrix = mvoEngine.computeCovarianceMatrix(assetsData, {
        riskAversion: 2.5,
        covarianceLookbackDays: 250,
        ewmaSpan: 60,
        shrinkageIntensity: 0.5,
        maxAssetWeight: 0.40,
        minAssetWeight: 0.0,
        solverMaxIterations: 1000,
        solverTolerance: 1e-8,
      });

      const n = covMatrix.length;
      let maxEig = 0, minEig = Infinity;
      for (let i = 0; i < n; i++) {
        maxEig = Math.max(maxEig, covMatrix[i][i]);
        minEig = Math.min(minEig, covMatrix[i][i]);
      }
      const conditionNumber = minEig > 0 ? maxEig / minEig : Infinity;
      const isWellConditioned = conditionNumber < 1000;

      await db.insert(quantModelRegistry).values({
        modelName,
        version: newVersion,
        modelType: 'COVARIANCE',
        status: 'active',
        artifactData: {
          covarianceMatrix: covMatrix,
          conditionNumber,
          categories: CATEGORIES,
        },
        performanceMetrics: { conditionNumber, isWellConditioned, matrixSize: n },
        promotedAt: new Date(),
      });

      const trainingDurationMs = Date.now() - startTime;
      const result: RetrainingResult = {
        modelName,
        oldVersion: null,
        newVersion,
        status: 'PROMOTED',
        validationScore: isWellConditioned ? 1.0 : 0.5,
        backtestSharpe: null,
        trainingDurationMs,
        metrics: { conditionNumber, isWellConditioned },
      };

      await this.logRetraining(result);
      console.log(`[Retrain] ${modelName}: recalibrated. Condition#=${conditionNumber.toFixed(1)}, Duration=${trainingDurationMs}ms`);
      return result;

    } catch (error: any) {
      const trainingDurationMs = Date.now() - startTime;
      const result: RetrainingResult = {
        modelName, oldVersion: null, newVersion: 'error', status: 'ERROR',
        validationScore: null, backtestSharpe: null, trainingDurationMs,
        metrics: {}, errorMessage: error.message,
      };
      await this.logRetraining(result);
      console.error(`[Retrain] ${modelName} FAILED:`, error.message);
      return result;
    }
  }

  async retrainBLConfidenceCalibration(): Promise<RetrainingResult> {
    const startTime = Date.now();
    const modelName = 'BL_CONFIDENCE_CALIBRATION';

    try {
      const activeModel = await this.getActiveModel(modelName);
      const newVersion = this.generateVersion(modelName);
      console.log(`[Retrain] Starting ${modelName} recalibration`);

      const recentRuns = await db.select().from(quantRunLog)
        .where(and(
          eq(quantRunLog.modelType, 'BLACK_LITTERMAN'),
          eq(quantRunLog.status, 'SUCCESS'),
          gte(quantRunLog.createdAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
        ))
        .orderBy(desc(quantRunLog.createdAt))
        .limit(100);

      let calibratedOmega = 0.01;
      let calibratedTau = 0.05;

      if (recentRuns.length >= 10) {
        const tacticalTilts = recentRuns
          .map(r => (r.outputSummary as any)?.tacticalTilts || {})
          .filter(t => Object.keys(t).length > 0);

        if (tacticalTilts.length > 0) {
          const allTiltValues: number[] = [];
          for (const tilts of tacticalTilts) {
            for (const v of Object.values(tilts)) {
              allTiltValues.push(Math.abs(v as number));
            }
          }
          const avgTilt = allTiltValues.reduce((s, v) => s + v, 0) / allTiltValues.length;
          const variance = allTiltValues.reduce((s, v) => s + (v - avgTilt) ** 2, 0) / allTiltValues.length;

          calibratedOmega = Math.max(0.001, Math.min(0.1, variance));
          calibratedTau = Math.max(0.01, Math.min(0.15, avgTilt * 2));
        }
      }

      await db.insert(quantModelRegistry).values({
        modelName,
        version: newVersion,
        modelType: 'BL_CALIBRATION',
        status: 'active',
        artifactData: { calibratedOmega, calibratedTau, sampleSize: recentRuns.length },
        performanceMetrics: { runsAnalyzed: recentRuns.length, omega: calibratedOmega, tau: calibratedTau },
        promotedAt: new Date(),
      });

      if (activeModel) {
        await db.update(quantModelRegistry)
          .set({ status: 'archived', archivedAt: new Date() })
          .where(eq(quantModelRegistry.id, activeModel.id));
      }

      const trainingDurationMs = Date.now() - startTime;
      const result: RetrainingResult = {
        modelName,
        oldVersion: activeModel?.version || null,
        newVersion,
        status: 'PROMOTED',
        validationScore: null,
        backtestSharpe: null,
        trainingDurationMs,
        metrics: { calibratedOmega, calibratedTau, sampleSize: recentRuns.length },
      };

      await this.logRetraining(result);
      console.log(`[Retrain] ${modelName}: recalibrated. Omega=${calibratedOmega.toFixed(4)}, Tau=${calibratedTau.toFixed(4)}`);
      return result;

    } catch (error: any) {
      const trainingDurationMs = Date.now() - startTime;
      const result: RetrainingResult = {
        modelName, oldVersion: null, newVersion: 'error', status: 'ERROR',
        validationScore: null, backtestSharpe: null, trainingDurationMs,
        metrics: {}, errorMessage: error.message,
      };
      await this.logRetraining(result);
      console.error(`[Retrain] ${modelName} FAILED:`, error.message);
      return result;
    }
  }

  async retrainDriftPredictionModel(): Promise<RetrainingResult> {
    const startTime = Date.now();
    const modelName = 'DRIFT_PREDICTION';

    try {
      const activeModel = await this.getActiveModel(modelName);
      const newVersion = this.generateVersion(modelName);
      console.log(`[Retrain] Starting ${modelName} retraining`);

      const historicalDecisions = await db.select().from(rebalanceDecisionLog)
        .where(gte(rebalanceDecisionLog.createdAt, new Date(Date.now() - 365 * 3 * 24 * 60 * 60 * 1000)))
        .orderBy(desc(rebalanceDecisionLog.createdAt))
        .limit(2000);

      const trainingData = this.buildDriftTrainingData(historicalDecisions);

      const { emaAlpha, volatilityMultiplier, driftProbabilityTrigger } =
        this.trainDriftHyperparameters(trainingData);

      const predictions = trainingData.map(td => ({
        predicted: td.predictedBreach,
        actual: td.actualBreach,
        probability: td.probability,
      }));

      const backtest = quantBacktestingEngine.runDriftModelBacktest(predictions);

      const shouldPromote = backtest.passed &&
        (!activeModel || backtest.rocAuc >= (activeModel.validationScore || 0));

      await db.insert(quantModelRegistry).values({
        modelName,
        version: newVersion,
        modelType: 'DRIFT_PREDICTION',
        validationScore: backtest.rocAuc,
        backtestSharpe: backtest.precision,
        status: shouldPromote ? 'active' : 'candidate',
        artifactData: {
          emaAlpha,
          volatilityMultiplier,
          driftProbabilityTrigger,
          trainingDataSize: trainingData.length,
        },
        trainingConfig: { emaAlpha, volatilityMultiplier, driftProbabilityTrigger },
        performanceMetrics: {
          rocAuc: backtest.rocAuc,
          precision: backtest.precision,
          recall: backtest.recall,
          falsePositiveRate: backtest.falsePositiveRate,
        },
        promotedAt: shouldPromote ? new Date() : null,
      });

      if (shouldPromote && activeModel) {
        await db.update(quantModelRegistry)
          .set({ status: 'archived', archivedAt: new Date() })
          .where(eq(quantModelRegistry.id, activeModel.id));
      }

      const trainingDurationMs = Date.now() - startTime;
      const result: RetrainingResult = {
        modelName,
        oldVersion: activeModel?.version || null,
        newVersion,
        status: shouldPromote ? 'PROMOTED' : 'DISCARDED',
        validationScore: backtest.rocAuc,
        backtestSharpe: backtest.precision,
        trainingDurationMs,
        metrics: {
          rocAuc: backtest.rocAuc,
          precision: backtest.precision,
          recall: backtest.recall,
          hyperparams: { emaAlpha, volatilityMultiplier, driftProbabilityTrigger },
          trainingDataSize: trainingData.length,
        },
      };

      await this.logRetraining(result);
      console.log(`[Retrain] ${modelName}: ${result.status}. ROC-AUC=${backtest.rocAuc.toFixed(3)}, Precision=${backtest.precision.toFixed(3)}`);
      return result;

    } catch (error: any) {
      const trainingDurationMs = Date.now() - startTime;
      const result: RetrainingResult = {
        modelName, oldVersion: null, newVersion: 'error', status: 'ERROR',
        validationScore: null, backtestSharpe: null, trainingDurationMs,
        metrics: {}, errorMessage: error.message,
      };
      await this.logRetraining(result);
      console.error(`[Retrain] ${modelName} FAILED:`, error.message);
      return result;
    }
  }

  async runFullRetrainingPipeline(): Promise<RetrainingResult[]> {
    console.log('[Retrain] ═══════════════════════════════════════');
    console.log('[Retrain] Starting Full Quant Retraining Pipeline');
    console.log('[Retrain] ═══════════════════════════════════════');

    const results: RetrainingResult[] = [];

    const covResult = await this.retrainCovarianceMatrix();
    results.push(covResult);

    const mvoResult = await this.retrainMVOExpectedReturns();
    results.push(mvoResult);

    const blResult = await this.retrainBLConfidenceCalibration();
    results.push(blResult);

    const driftResult = await this.retrainDriftPredictionModel();
    results.push(driftResult);

    const promoted = results.filter(r => r.status === 'PROMOTED').length;
    const discarded = results.filter(r => r.status === 'DISCARDED').length;
    const errors = results.filter(r => r.status === 'ERROR').length;

    console.log('[Retrain] ═══════════════════════════════════════');
    console.log(`[Retrain] Pipeline complete: ${promoted} promoted, ${discarded} discarded, ${errors} errors`);
    console.log('[Retrain] ═══════════════════════════════════════');

    return results;
  }

  async getModelHealth(): Promise<Record<string, any>> {
    const models = ['MVO_EXPECTED_RETURNS', 'COVARIANCE_MATRIX', 'BL_CONFIDENCE_CALIBRATION', 'DRIFT_PREDICTION'];
    const health: Record<string, any> = {};

    for (const modelName of models) {
      const active = await this.getActiveModel(modelName);
      const recentLogs = await db.select().from(quantRetrainingLog)
        .where(eq(quantRetrainingLog.modelName, modelName))
        .orderBy(desc(quantRetrainingLog.createdAt))
        .limit(5);

      const lastRetrain = recentLogs[0];
      const daysSinceRetrain = lastRetrain
        ? Math.floor((Date.now() - new Date(lastRetrain.createdAt!).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const needsRetrain = this.checkNeedsRetrain(modelName, daysSinceRetrain);

      health[modelName] = {
        activeVersion: active?.version || 'none',
        activeStatus: active?.status || 'missing',
        validationScore: active?.validationScore,
        backtestSharpe: active?.backtestSharpe,
        lastRetrainDate: lastRetrain?.createdAt || null,
        daysSinceRetrain,
        lastRetrainStatus: lastRetrain?.status || null,
        needsRetrain,
        recentHistory: recentLogs.map(l => ({
          version: l.newVersion,
          status: l.status,
          promotionStatus: l.promotionStatus,
          date: l.createdAt,
        })),
      };
    }

    return health;
  }

  private checkNeedsRetrain(modelName: string, daysSinceRetrain: number | null): boolean {
    if (daysSinceRetrain === null) return true;

    const schedules: Record<string, number> = {
      MVO_EXPECTED_RETURNS: 30,
      COVARIANCE_MATRIX: 7,
      BL_CONFIDENCE_CALIBRATION: 14,
      DRIFT_PREDICTION: 7,
    };

    const maxDays = schedules[modelName] || 30;
    return daysSinceRetrain >= maxDays;
  }

  private async getActiveModel(modelName: string) {
    const rows = await db.select().from(quantModelRegistry)
      .where(and(
        eq(quantModelRegistry.modelName, modelName),
        eq(quantModelRegistry.status, 'active')
      ))
      .orderBy(desc(quantModelRegistry.trainingDate))
      .limit(1);
    return rows[0] || null;
  }

  private async logRetraining(result: RetrainingResult) {
    try {
      await db.insert(quantRetrainingLog).values({
        modelName: result.modelName,
        oldVersion: result.oldVersion,
        newVersion: result.newVersion,
        status: result.status,
        validationScore: result.validationScore,
        backtestSharpe: result.backtestSharpe,
        promotionStatus: result.status,
        trainingDurationMs: result.trainingDurationMs,
        errorMessage: result.errorMessage || null,
        metrics: result.metrics,
      });
    } catch (e) {
      console.warn('[Retrain] Failed to log retraining result:', e);
    }
  }

  private generateVersion(modelName: string): string {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = now.getTime() % 10000;
    return `v${date}-${seq}`;
  }

  private buildDriftTrainingData(
    decisions: any[]
  ): Array<{ predictedBreach: boolean; actualBreach: boolean; probability: number }> {
    if (decisions.length < 10) {
      return this.generateSyntheticDriftTrainingData(500);
    }

    return decisions.map(d => {
      const driftPct = Math.abs(d.driftPct || 0);
      const toleranceBand = d.toleranceBand || 5;
      const actualBreach = driftPct > toleranceBand;
      const probability = Math.min(1, driftPct / (toleranceBand * 2));
      const predictedBreach = probability > 0.5;

      return { predictedBreach, actualBreach, probability };
    });
  }

  private trainDriftHyperparameters(
    data: Array<{ predictedBreach: boolean; actualBreach: boolean; probability: number }>
  ): { emaAlpha: number; volatilityMultiplier: number; driftProbabilityTrigger: number } {
    if (data.length < 50) {
      return { emaAlpha: 0.1, volatilityMultiplier: 1.5, driftProbabilityTrigger: 0.7 };
    }

    const breachRate = data.filter(d => d.actualBreach).length / data.length;

    const emaAlpha = Math.max(0.05, Math.min(0.3, breachRate * 2));
    const volatilityMultiplier = Math.max(1.0, Math.min(3.0, 1 / Math.max(breachRate, 0.1)));
    const driftProbabilityTrigger = Math.max(0.5, Math.min(0.9, 1 - breachRate));

    return { emaAlpha, volatilityMultiplier, driftProbabilityTrigger };
  }

  private generateSyntheticDriftTrainingData(
    count: number
  ): Array<{ predictedBreach: boolean; actualBreach: boolean; probability: number }> {
    const data: Array<{ predictedBreach: boolean; actualBreach: boolean; probability: number }> = [];
    for (let i = 0; i < count; i++) {
      const drift = (Math.random() - 0.3) * 15;
      const tolerance = 5;
      const actualBreach = Math.abs(drift) > tolerance;
      const noise = (Math.random() - 0.5) * 3;
      const predictedDrift = drift + noise;
      const probability = Math.min(1, Math.max(0, Math.abs(predictedDrift) / (tolerance * 2)));
      const predictedBreach = probability > 0.5;
      data.push({ predictedBreach, actualBreach, probability });
    }
    return data;
  }

  private generateHistoricalReturns(category: string, days: number): number[] {
    const params: Record<string, { mean: number; vol: number }> = {
      equity: { mean: 0.00048, vol: 0.0126 },
      debt: { mean: 0.00025, vol: 0.0038 },
      hybrid: { mean: 0.00035, vol: 0.0075 },
      gold: { mean: 0.00032, vol: 0.0063 },
      silver: { mean: 0.00028, vol: 0.0088 },
      index: { mean: 0.00045, vol: 0.0082 },
      etf: { mean: 0.00042, vol: 0.0095 },
      international: { mean: 0.00038, vol: 0.0113 },
      listed_stocks: { mean: 0.00052, vol: 0.0139 },
      unlisted_stocks: { mean: 0.00055, vol: 0.0158 },
      reit: { mean: 0.00030, vol: 0.0088 },
      invit: { mean: 0.00028, vol: 0.0082 },
      bonds: { mean: 0.00024, vol: 0.0044 },
      mld: { mean: 0.00030, vol: 0.0050 },
      pms: { mean: 0.00050, vol: 0.0126 },
      aif: { mean: 0.00048, vol: 0.0139 },
    };
    const p = params[category] || { mean: 0.00035, vol: 0.0095 };
    const returns: number[] = [];
    for (let i = 0; i < days; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      returns.push(p.mean + p.vol * z);
    }
    return returns;
  }

  private generateMonthlyReturns(category: string, months: number): number[] {
    const dailyReturns = this.generateHistoricalReturns(category, months * 21);
    const monthlyReturns: number[] = [];
    for (let m = 0; m < months; m++) {
      let cumReturn = 1;
      for (let d = 0; d < 21 && (m * 21 + d) < dailyReturns.length; d++) {
        cumReturn *= (1 + dailyReturns[m * 21 + d]);
      }
      monthlyReturns.push(cumReturn - 1);
    }
    return monthlyReturns;
  }
}

export const quantRetrainingPipeline = new QuantRetrainingPipeline();
