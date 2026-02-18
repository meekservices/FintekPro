import { db } from '../../db';
import { quantRunLog, strategicTargetWeights } from '@shared/schema';

export interface AssetData {
  category: string;
  returns: number[];
  currentWeight: number;
}

export interface MVOConfig {
  riskAversion: number;
  covarianceLookbackDays: number;
  ewmaSpan: number;
  shrinkageIntensity: number;
  maxAssetWeight: number;
  minAssetWeight: number;
  solverMaxIterations: number;
  solverTolerance: number;
}

export interface MVOResult {
  weights: Record<string, number>;
  expectedReturn: number;
  portfolioVolatility: number;
  sharpeRatio: number;
  covarianceMatrix: number[][];
  expectedReturns: number[];
  categories: string[];
  modelVersion: string;
}

const DEFAULT_CONFIG: MVOConfig = {
  riskAversion: 2.5,
  covarianceLookbackDays: 250,
  ewmaSpan: 60,
  shrinkageIntensity: 0.5,
  maxAssetWeight: 0.40,
  minAssetWeight: 0.0,
  solverMaxIterations: 1000,
  solverTolerance: 1e-8,
};

class MVOEngine {
  computeCovarianceMatrix(assetsData: AssetData[], config: MVOConfig): number[][] {
    const n = assetsData.length;
    const lookback = config.covarianceLookbackDays;

    const returnSeries = assetsData.map(a => {
      const r = a.returns.slice(-lookback);
      return r.length >= 20 ? r : this.generateSyntheticReturns(a.category, lookback);
    });

    const sampleCov = this.computeSampleCovariance(returnSeries);
    const shrunkCov = this.ledoitWolfShrinkage(sampleCov, config.shrinkageIntensity);

    return shrunkCov;
  }

  private computeSampleCovariance(returnSeries: number[][]): number[][] {
    const n = returnSeries.length;
    const T = Math.min(...returnSeries.map(r => r.length));

    const means = returnSeries.map(r => {
      const slice = r.slice(0, T);
      return slice.reduce((s, v) => s + v, 0) / T;
    });

    const cov: number[][] = Array.from({ length: n }, () => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        let sum = 0;
        for (let t = 0; t < T; t++) {
          sum += (returnSeries[i][t] - means[i]) * (returnSeries[j][t] - means[j]);
        }
        const value = sum / (T - 1);
        cov[i][j] = value;
        cov[j][i] = value;
      }
    }

    return cov;
  }

  private ledoitWolfShrinkage(sampleCov: number[][], intensity: number): number[][] {
    const n = sampleCov.length;
    const trace = sampleCov.reduce((s, row, i) => s + row[i], 0);
    const mu = trace / n;

    const target: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? mu : 0))
    );

    const shrunk: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) =>
        (1 - intensity) * sampleCov[i][j] + intensity * target[i][j]
      )
    );

    return shrunk;
  }

  computeExpectedReturns(assetsData: AssetData[], config: MVOConfig): number[] {
    const span = config.ewmaSpan;
    const alpha = 2 / (span + 1);

    return assetsData.map(asset => {
      const returns = asset.returns;
      if (returns.length < 5) {
        return this.getCategoryDefaultReturn(asset.category);
      }

      let ewma = returns[0];
      for (let i = 1; i < returns.length; i++) {
        ewma = alpha * returns[i] + (1 - alpha) * ewma;
      }

      return ewma * 252;
    });
  }

  optimize(
    expectedReturns: number[],
    covarianceMatrix: number[][],
    config: MVOConfig,
    currentWeights?: number[]
  ): number[] {
    const n = expectedReturns.length;
    let weights = currentWeights
      ? [...currentWeights]
      : Array(n).fill(1 / n);

    weights = this.normalizeWeights(weights);

    const lambda = config.riskAversion;
    const maxIter = config.solverMaxIterations;
    const tol = config.solverTolerance;
    const minW = config.minAssetWeight;
    const maxW = config.maxAssetWeight;

    for (let iter = 0; iter < maxIter; iter++) {
      const gradient = this.computeGradient(expectedReturns, covarianceMatrix, weights, lambda);

      const learningRate = 0.01 / (1 + iter * 0.001);

      const newWeights = weights.map((w, i) => {
        let updated = w + learningRate * gradient[i];
        return Math.max(minW, Math.min(maxW, updated));
      });

      const normalized = this.normalizeWeights(newWeights);

      const maxDiff = Math.max(...normalized.map((w, i) => Math.abs(w - weights[i])));
      weights = normalized;

      if (maxDiff < tol) {
        console.log(`[MVO] Converged at iteration ${iter}`);
        break;
      }
    }

    return weights;
  }

  private computeGradient(
    mu: number[], sigma: number[][], weights: number[], lambda: number
  ): number[] {
    const n = mu.length;
    const gradient = new Array(n);

    for (let i = 0; i < n; i++) {
      let sigmaW = 0;
      for (let j = 0; j < n; j++) {
        sigmaW += sigma[i][j] * weights[j];
      }
      gradient[i] = mu[i] - lambda * sigmaW;
    }

    return gradient;
  }

  private normalizeWeights(weights: number[]): number[] {
    const sum = weights.reduce((s, w) => s + w, 0);
    if (sum === 0) return weights.map(() => 1 / weights.length);
    return weights.map(w => w / sum);
  }

  async run(
    assetsData: AssetData[],
    config: Partial<MVOConfig> = {},
    portfolioId?: string
  ): Promise<MVOResult> {
    const startTime = Date.now();
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const categories = assetsData.map(a => a.category);

    try {
      const covarianceMatrix = this.computeCovarianceMatrix(assetsData, fullConfig);
      const expectedReturns = this.computeExpectedReturns(assetsData, fullConfig);
      const currentWeights = assetsData.map(a => a.currentWeight);

      const optimalWeights = this.optimize(
        expectedReturns, covarianceMatrix, fullConfig, currentWeights
      );

      let portfolioReturn = 0;
      let portfolioVariance = 0;
      for (let i = 0; i < optimalWeights.length; i++) {
        portfolioReturn += optimalWeights[i] * expectedReturns[i];
        for (let j = 0; j < optimalWeights.length; j++) {
          portfolioVariance += optimalWeights[i] * optimalWeights[j] * covarianceMatrix[i][j];
        }
      }
      const portfolioVolatility = Math.sqrt(Math.max(0, portfolioVariance));
      const sharpeRatio = portfolioVolatility > 0 ? (portfolioReturn - 0.06) / portfolioVolatility : 0;

      const weights: Record<string, number> = {};
      categories.forEach((cat, i) => {
        weights[cat] = Math.round(optimalWeights[i] * 10000) / 10000;
      });

      const runTimeMs = Date.now() - startTime;
      const modelVersion = `mvo-v1.0-lw${fullConfig.shrinkageIntensity}-ra${fullConfig.riskAversion}`;

      try {
        await db.insert(quantRunLog).values({
          portfolioId: portfolioId || null,
          modelType: 'MVO',
          runTimeMs,
          status: 'SUCCESS',
          inputHash: this.hashInput(categories, fullConfig),
          outputSummary: { weights, portfolioReturn, portfolioVolatility, sharpeRatio },
          fallbackUsed: false,
        });
      } catch (e) {
        console.warn('[MVO] Failed to log run:', e);
      }

      console.log(`[MVO] Optimization complete in ${runTimeMs}ms. Sharpe: ${sharpeRatio.toFixed(3)}, Vol: ${(portfolioVolatility * 100).toFixed(1)}%`);

      return {
        weights,
        expectedReturn: portfolioReturn,
        portfolioVolatility,
        sharpeRatio,
        covarianceMatrix,
        expectedReturns,
        categories,
        modelVersion,
      };
    } catch (error: any) {
      const runTimeMs = Date.now() - startTime;
      try {
        await db.insert(quantRunLog).values({
          portfolioId: portfolioId || null,
          modelType: 'MVO',
          runTimeMs,
          status: 'ERROR',
          errorMessage: error.message,
          fallbackUsed: true,
        });
      } catch (_) {}

      console.error('[MVO] Optimization failed:', error.message);
      throw error;
    }
  }

  async persistWeights(portfolioId: string, result: MVOResult): Promise<void> {
    const entries = result.categories.map((cat, i) => ({
      portfolioId,
      category: cat,
      weight: result.weights[cat] || 0,
      modelVersion: result.modelVersion,
      expectedReturn: result.expectedReturns[i] || null,
      volatility: result.covarianceMatrix[i]?.[i] ? Math.sqrt(result.covarianceMatrix[i][i]) : null,
      sharpeContribution: result.weights[cat] ? (result.weights[cat] * (result.expectedReturns[i] || 0)) / (result.sharpeRatio || 1) : null,
    }));

    try {
      await db.insert(strategicTargetWeights).values(entries);
      console.log(`[MVO] Persisted ${entries.length} strategic weights for portfolio ${portfolioId}`);
    } catch (e) {
      console.warn('[MVO] Failed to persist weights:', e);
    }
  }

  private generateSyntheticReturns(category: string, length: number): number[] {
    const params = this.getCategoryReturnParams(category);
    const returns: number[] = [];
    for (let i = 0; i < length; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      returns.push(params.dailyMean + params.dailyVol * z);
    }
    return returns;
  }

  private getCategoryReturnParams(category: string): { dailyMean: number; dailyVol: number } {
    const params: Record<string, { dailyMean: number; dailyVol: number }> = {
      equity: { dailyMean: 0.00048, dailyVol: 0.0126 },
      debt: { dailyMean: 0.00025, dailyVol: 0.0038 },
      hybrid: { dailyMean: 0.00035, dailyVol: 0.0075 },
      gold: { dailyMean: 0.00032, dailyVol: 0.0063 },
      silver: { dailyMean: 0.00028, dailyVol: 0.0088 },
      index: { dailyMean: 0.00045, dailyVol: 0.0082 },
      etf: { dailyMean: 0.00042, dailyVol: 0.0095 },
      international: { dailyMean: 0.00038, dailyVol: 0.0113 },
      listed_stocks: { dailyMean: 0.00052, dailyVol: 0.0139 },
      unlisted_stocks: { dailyMean: 0.00055, dailyVol: 0.0158 },
      reit: { dailyMean: 0.00030, dailyVol: 0.0088 },
      invit: { dailyMean: 0.00028, dailyVol: 0.0082 },
      bonds: { dailyMean: 0.00024, dailyVol: 0.0044 },
      mld: { dailyMean: 0.00030, dailyVol: 0.0050 },
      pms: { dailyMean: 0.00050, dailyVol: 0.0126 },
      aif: { dailyMean: 0.00048, dailyVol: 0.0139 },
    };
    return params[category] || { dailyMean: 0.00035, dailyVol: 0.0095 };
  }

  private getCategoryDefaultReturn(category: string): number {
    const annualReturns: Record<string, number> = {
      equity: 0.12, debt: 0.065, hybrid: 0.09, gold: 0.08,
      silver: 0.07, index: 0.115, etf: 0.105, international: 0.095,
      listed_stocks: 0.13, unlisted_stocks: 0.14, reit: 0.075,
      invit: 0.07, bonds: 0.06, mld: 0.075, pms: 0.125, aif: 0.12,
    };
    return (annualReturns[category] || 0.09) / 252;
  }

  private hashInput(categories: string[], config: MVOConfig): string {
    const str = JSON.stringify({ categories: categories.sort(), ra: config.riskAversion, si: config.shrinkageIntensity });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `mvo-${Math.abs(hash).toString(36)}`;
  }
}

export const mvoEngine = new MVOEngine();
