import { db } from '../../db';
import { quantRunLog, rebalanceDecisionLog } from '@shared/schema';
import { desc, eq, and, gte } from 'drizzle-orm';

export interface DriftFeatures {
  category: string;
  currentWeight: number;
  targetWeight: number;
  currentDrift: number;
  historicalDriftMean: number;
  historicalDriftStd: number;
  driftVelocity: number;
  driftAcceleration: number;
  categoryVolatility: number;
  daysSinceLastRebalance: number;
  marketRegime: 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL' | 'CRISIS';
}

export interface DriftPrediction {
  category: string;
  breachProbability: number;
  predictedDrift: number;
  predictedDriftDirection: 'OVERWEIGHT' | 'UNDERWEIGHT' | 'STABLE';
  timeToBreachDays: number | null;
  confidence: number;
  features: DriftFeatures;
  triggerPreemptive: boolean;
}

export interface DriftPredictionResult {
  predictions: DriftPrediction[];
  portfolioBreachProbability: number;
  recommendPreemptiveRebalance: boolean;
  highRiskCategories: string[];
  modelVersion: string;
}

export interface DriftPredictionConfig {
  driftProbabilityTrigger: number;
  lookbackDays: number;
  emaAlpha: number;
  volatilityMultiplier: number;
}

const DEFAULT_CONFIG: DriftPredictionConfig = {
  driftProbabilityTrigger: 0.7,
  lookbackDays: 90,
  emaAlpha: 0.1,
  volatilityMultiplier: 1.5,
};

const CATEGORY_VOLATILITY: Record<string, number> = {
  equity: 0.20, listed_stocks: 0.22, unlisted_stocks: 0.25, etf: 0.15,
  hybrid: 0.12, gold: 0.10, silver: 0.14, index: 0.13,
  debt: 0.06, bonds: 0.07, mld: 0.08, international: 0.18,
  reit: 0.14, invit: 0.13, pms: 0.20, aif: 0.22,
};

class DriftPredictionEngine {
  async extractFeatures(
    driftMetrics: Array<{
      category: string;
      currentPercent: number;
      targetPercent: number;
      drift: number;
    }>,
    toleranceBandPct: number,
    config: DriftPredictionConfig = DEFAULT_CONFIG
  ): Promise<DriftFeatures[]> {
    const historicalData = await this.getHistoricalDriftData(config.lookbackDays);

    return driftMetrics.map(dm => {
      const catHistory = historicalData.filter(h => h.assetCategory === dm.category);
      const driftHistory = catHistory.map(h => h.driftPct || 0);

      const historicalDriftMean = driftHistory.length > 0
        ? driftHistory.reduce((s, d) => s + d, 0) / driftHistory.length
        : 0;

      const historicalDriftStd = driftHistory.length > 2
        ? Math.sqrt(driftHistory.reduce((s, d) => s + (d - historicalDriftMean) ** 2, 0) / (driftHistory.length - 1))
        : Math.abs(dm.drift) * 0.5;

      const recentDrifts = driftHistory.slice(-5);
      const driftVelocity = recentDrifts.length >= 2
        ? (recentDrifts[recentDrifts.length - 1] - recentDrifts[0]) / recentDrifts.length
        : dm.drift * 0.01;

      const driftAcceleration = recentDrifts.length >= 3
        ? this.computeAcceleration(recentDrifts)
        : 0;

      const catVol = CATEGORY_VOLATILITY[dm.category] || 0.15;

      const lastRebalance = catHistory.find(h =>
        h.finalAction === 'REDUCE' || h.finalAction === 'INCREASE' || h.finalAction === 'SELL' || h.finalAction === 'BUY'
      );
      const daysSinceLastRebalance = lastRebalance?.createdAt
        ? Math.floor((Date.now() - new Date(lastRebalance.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 90;

      const marketRegime = this.detectMarketRegime(catVol, historicalDriftStd);

      return {
        category: dm.category,
        currentWeight: dm.currentPercent / 100,
        targetWeight: dm.targetPercent / 100,
        currentDrift: dm.drift,
        historicalDriftMean,
        historicalDriftStd,
        driftVelocity,
        driftAcceleration,
        categoryVolatility: catVol,
        daysSinceLastRebalance,
        marketRegime,
      };
    });
  }

  predict(
    features: DriftFeatures[],
    toleranceBandPct: number,
    config: DriftPredictionConfig = DEFAULT_CONFIG
  ): DriftPrediction[] {
    return features.map(f => {
      const predictedDrift = this.predictDriftEMA(f, config);
      const breachProbability = this.computeBreachProbability(f, predictedDrift, toleranceBandPct, config);

      const predictedDirection: 'OVERWEIGHT' | 'UNDERWEIGHT' | 'STABLE' =
        Math.abs(predictedDrift) < toleranceBandPct * 0.3 ? 'STABLE'
          : predictedDrift > 0 ? 'OVERWEIGHT' : 'UNDERWEIGHT';

      const timeToBreachDays = this.estimateTimeToBreachDays(f, toleranceBandPct);

      const confidence = this.computeConfidence(f);

      return {
        category: f.category,
        breachProbability,
        predictedDrift,
        predictedDriftDirection: predictedDirection,
        timeToBreachDays,
        confidence,
        features: f,
        triggerPreemptive: breachProbability >= config.driftProbabilityTrigger,
      };
    });
  }

  async run(
    driftMetrics: Array<{
      category: string;
      currentPercent: number;
      targetPercent: number;
      drift: number;
    }>,
    toleranceBandPct: number,
    config: Partial<DriftPredictionConfig> = {},
    portfolioId?: string
  ): Promise<DriftPredictionResult> {
    const startTime = Date.now();
    const fullConfig = { ...DEFAULT_CONFIG, ...config };

    try {
      const features = await this.extractFeatures(driftMetrics, toleranceBandPct, fullConfig);
      const predictions = this.predict(features, toleranceBandPct, fullConfig);

      const highRiskCategories = predictions
        .filter(p => p.triggerPreemptive)
        .map(p => p.category);

      const portfolioBreachProbability = predictions.length > 0
        ? 1 - predictions.reduce((prod, p) => prod * (1 - p.breachProbability), 1)
        : 0;

      const recommendPreemptiveRebalance = highRiskCategories.length > 0 ||
        portfolioBreachProbability > fullConfig.driftProbabilityTrigger;

      const runTimeMs = Date.now() - startTime;
      const modelVersion = `drift-pred-v1.0-ema${fullConfig.emaAlpha}`;

      try {
        await db.insert(quantRunLog).values({
          portfolioId: portfolioId || null,
          modelType: 'AI_DRIFT_PREDICTION',
          runTimeMs,
          status: 'SUCCESS',
          outputSummary: {
            predictionsCount: predictions.length,
            highRiskCategories,
            portfolioBreachProbability,
            recommendPreemptiveRebalance,
          },
          fallbackUsed: false,
        });
      } catch (e) {
        console.warn('[DriftPred] Failed to log run:', e);
      }

      console.log(`[DriftPred] Prediction complete in ${runTimeMs}ms. High-risk: ${highRiskCategories.join(', ') || 'none'}. Portfolio breach prob: ${(portfolioBreachProbability * 100).toFixed(1)}%`);

      return {
        predictions,
        portfolioBreachProbability,
        recommendPreemptiveRebalance,
        highRiskCategories,
        modelVersion,
      };
    } catch (error: any) {
      const runTimeMs = Date.now() - startTime;
      try {
        await db.insert(quantRunLog).values({
          portfolioId: portfolioId || null,
          modelType: 'AI_DRIFT_PREDICTION',
          runTimeMs,
          status: 'ERROR',
          errorMessage: error.message,
          fallbackUsed: true,
        });
      } catch (_) {}

      console.error('[DriftPred] Prediction failed:', error.message);
      throw error;
    }
  }

  private predictDriftEMA(features: DriftFeatures, config: DriftPredictionConfig): number {
    const alpha = config.emaAlpha;
    const currentDrift = features.currentDrift;
    const velocity = features.driftVelocity;
    const acceleration = features.driftAcceleration;

    const momentum = velocity + 0.5 * acceleration;
    const volAdjustment = features.categoryVolatility * config.volatilityMultiplier;

    const regimeMultiplier = features.marketRegime === 'CRISIS' ? 2.0
      : features.marketRegime === 'HIGH_VOL' ? 1.5
      : features.marketRegime === 'NORMAL' ? 1.0
      : 0.7;

    const predicted = currentDrift + momentum * regimeMultiplier * 5;

    const timeFactor = Math.min(features.daysSinceLastRebalance / 30, 3);
    const timeAdjusted = predicted + (currentDrift * 0.01 * timeFactor);

    return timeAdjusted;
  }

  private computeBreachProbability(
    features: DriftFeatures,
    predictedDrift: number,
    toleranceBandPct: number,
    config: DriftPredictionConfig
  ): number {
    const distanceToBreachUp = toleranceBandPct - features.currentDrift;
    const distanceToBreachDown = toleranceBandPct + features.currentDrift;
    const minDistance = Math.min(Math.abs(distanceToBreachUp), Math.abs(distanceToBreachDown));

    const driftStd = Math.max(features.historicalDriftStd, features.categoryVolatility * 5);

    if (driftStd === 0) return Math.abs(features.currentDrift) >= toleranceBandPct ? 1.0 : 0.0;

    const zScore = minDistance / driftStd;

    const baseProbability = 1 - this.normalCDF(zScore);

    const velocityFactor = Math.abs(features.driftVelocity) > 0.5 ? 1.3 : 1.0;
    const regimeFactor = features.marketRegime === 'CRISIS' ? 1.5
      : features.marketRegime === 'HIGH_VOL' ? 1.2
      : 1.0;
    const timeFactor = 1 + Math.min(features.daysSinceLastRebalance / 90, 1) * 0.3;

    const adjustedProbability = Math.min(
      baseProbability * velocityFactor * regimeFactor * timeFactor,
      1.0
    );

    if (Math.abs(predictedDrift) > toleranceBandPct) {
      return Math.max(adjustedProbability, 0.8);
    }

    return adjustedProbability;
  }

  private estimateTimeToBreachDays(features: DriftFeatures, toleranceBandPct: number): number | null {
    const distanceToBreach = toleranceBandPct - Math.abs(features.currentDrift);
    if (distanceToBreach <= 0) return 0;

    const driftRate = Math.abs(features.driftVelocity);
    if (driftRate < 0.001) return null;

    return Math.round(distanceToBreach / driftRate);
  }

  private computeConfidence(features: DriftFeatures): number {
    let confidence = 0.5;

    if (features.historicalDriftStd > 0 && features.historicalDriftMean !== 0) {
      confidence += 0.1;
    }

    if (features.daysSinceLastRebalance < 30) {
      confidence += 0.15;
    } else if (features.daysSinceLastRebalance > 90) {
      confidence -= 0.1;
    }

    if (features.marketRegime === 'LOW_VOL' || features.marketRegime === 'NORMAL') {
      confidence += 0.1;
    } else {
      confidence -= 0.05;
    }

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private computeAcceleration(drifts: number[]): number {
    if (drifts.length < 3) return 0;
    const velocities: number[] = [];
    for (let i = 1; i < drifts.length; i++) {
      velocities.push(drifts[i] - drifts[i - 1]);
    }
    if (velocities.length < 2) return 0;
    return velocities[velocities.length - 1] - velocities[0];
  }

  private detectMarketRegime(
    categoryVolatility: number,
    historicalDriftStd: number
  ): 'LOW_VOL' | 'NORMAL' | 'HIGH_VOL' | 'CRISIS' {
    const combinedVol = categoryVolatility + historicalDriftStd * 0.01;
    if (combinedVol > 0.35) return 'CRISIS';
    if (combinedVol > 0.25) return 'HIGH_VOL';
    if (combinedVol < 0.10) return 'LOW_VOL';
    return 'NORMAL';
  }

  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  private async getHistoricalDriftData(lookbackDays: number) {
    try {
      const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
      const rows = await db.select().from(rebalanceDecisionLog)
        .where(gte(rebalanceDecisionLog.createdAt, cutoff))
        .orderBy(desc(rebalanceDecisionLog.createdAt))
        .limit(500);
      return rows;
    } catch (e) {
      console.warn('[DriftPred] Failed to fetch historical drift data:', e);
      return [];
    }
  }
}

export const driftPredictionEngine = new DriftPredictionEngine();
