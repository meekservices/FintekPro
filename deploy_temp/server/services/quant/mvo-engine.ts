import { db } from '../../db';
import { quantRunLog, strategicTargetWeights } from '@shared/schema';

export interface AssetData {
  category: string;
  returns: number[];
  currentWeight: number;
  sector?: string;
  instrumentType?: string;
}

export interface TransitionConstraints {
  gamma: number;
  maxPosition: number;
  turnoverCap: number;
  minWeight: number;
  categoryBindings?: Record<string, number>;
  sectorCaps?: Record<string, number>;
  maxGammaEscalation?: number;
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

export interface TransitionMetrics {
  turnover: number;
  maxWeight: number;
  sectorExposure: Record<string, number>;
  categoryExposure: Record<string, number>;
  gammaUsed: number;
  filteredCount: number;
  constraintsApplied: string[];
}

export interface MVOResult {
  weights: Record<string, number>;
  expectedReturn: number;
  portfolioVolatility: number;
  sharpeRatio: number;
  covarianceMatrix: number[][];            // daily covariance (used by optimizer)
  annualizedCovarianceMatrix: number[][];  // daily × 252 (used by Black-Litterman)
  expectedReturns: number[];
  categories: string[];
  modelVersion: string;
  transitionMetrics?: TransitionMetrics;
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

const DEFAULT_TRANSITION: TransitionConstraints = {
  gamma: 5.0,
  maxPosition: 0.20,
  turnoverCap: 0.40,
  minWeight: 0.01,
  maxGammaEscalation: 50.0,
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
    currentWeights?: number[],
    transitionConstraints?: TransitionConstraints,
    assetsData?: AssetData[]
  ): { weights: number[]; metrics: TransitionMetrics } {
    const n = expectedReturns.length;
    const w0 = currentWeights ? [...currentWeights] : Array(n).fill(1 / n);
    const tc = transitionConstraints || DEFAULT_TRANSITION;
    const lambda = config.riskAversion;
    const maxIter = config.solverMaxIterations;
    const tol = config.solverTolerance;

    const categoryMap = this.buildGroupMap(assetsData, 'instrumentType');
    const sectorMap = this.buildGroupMap(assetsData, 'sector');

    let gamma = tc.gamma;
    let weights = this.solveConstrainedQP(
      expectedReturns, covarianceMatrix, w0, lambda, gamma, tc, categoryMap, sectorMap, maxIter, tol
    );

    let turnover = this.computeTurnover(weights, w0);
    let escalationRounds = 0;
    const maxGamma = tc.maxGammaEscalation || 50.0;

    while (turnover > tc.turnoverCap && gamma < maxGamma && escalationRounds < 10) {
      gamma = Math.min(gamma * 1.5, maxGamma);
      escalationRounds++;

      weights = this.solveConstrainedQP(
        expectedReturns, covarianceMatrix, w0, lambda, gamma, tc, categoryMap, sectorMap, maxIter, tol
      );
      turnover = this.computeTurnover(weights, w0);
    }

    if (escalationRounds > 0) {
      console.log(`[MVO] Gamma escalated ${escalationRounds}x to ${gamma.toFixed(1)}, final turnover: ${(turnover * 100).toFixed(1)}%`);
    }

    const { filtered, filteredCount } = this.applyMinWeightFilter(
      weights, tc.minWeight, w0, tc, categoryMap, sectorMap, tc.maxPosition
    );
    weights = filtered;
    turnover = this.computeTurnover(weights, w0);

    const constraintsApplied: string[] = ['sum_to_one', 'box_bounds'];
    if (tc.gamma > 0) constraintsApplied.push('turnover_penalty');
    if (tc.categoryBindings && Object.keys(tc.categoryBindings).length > 0) constraintsApplied.push('category_binding');
    if (tc.sectorCaps && Object.keys(tc.sectorCaps).length > 0) constraintsApplied.push('sector_caps');
    if (tc.maxPosition < 1.0) constraintsApplied.push('max_position');
    if (escalationRounds > 0) constraintsApplied.push(`gamma_escalation_x${escalationRounds}`);
    if (filteredCount > 0) constraintsApplied.push(`min_weight_filter_removed_${filteredCount}`);

    const sectorExposure: Record<string, number> = {};
    for (const [sector, indices] of Object.entries(sectorMap)) {
      sectorExposure[sector] = indices.reduce((s, i) => s + weights[i], 0);
    }

    const categoryExposure: Record<string, number> = {};
    for (const [cat, indices] of Object.entries(categoryMap)) {
      categoryExposure[cat] = indices.reduce((s, i) => s + weights[i], 0);
    }

    const metrics: TransitionMetrics = {
      turnover,
      maxWeight: Math.max(...weights),
      sectorExposure,
      categoryExposure,
      gammaUsed: gamma,
      filteredCount,
      constraintsApplied,
    };

    return { weights, metrics };
  }

  private solveConstrainedQP(
    mu: number[],
    sigma: number[][],
    w0: number[],
    lambda: number,
    gamma: number,
    tc: TransitionConstraints,
    categoryMap: Record<string, number[]>,
    sectorMap: Record<string, number[]>,
    maxIter: number,
    tol: number
  ): number[] {
    const n = mu.length;
    let weights = [...w0];
    const sum = weights.reduce((s, w) => s + w, 0);
    if (Math.abs(sum - 1) > 0.01) {
      weights = sum > 0 ? weights.map(w => w / sum) : Array(n).fill(1 / n);
    }

    const maxPos = tc.maxPosition;

    for (let iter = 0; iter < maxIter; iter++) {
      const grad = new Array(n);
      for (let i = 0; i < n; i++) {
        let sigmaW = 0;
        for (let j = 0; j < n; j++) {
          sigmaW += sigma[i][j] * weights[j];
        }
        grad[i] = mu[i] - 2 * lambda * sigmaW - 2 * gamma * (weights[i] - w0[i]);
      }

      const learningRate = 0.005 / (1 + iter * 0.0005);

      const newWeights = weights.map((w, i) => {
        let updated = w + learningRate * grad[i];
        return Math.max(0, Math.min(maxPos, updated));
      });

      this.projectAllConstraints(newWeights, w0, tc, categoryMap, sectorMap, maxPos);

      const maxDiff = Math.max(...newWeights.map((w, i) => Math.abs(w - weights[i])));
      weights = newWeights;

      if (maxDiff < tol) {
        break;
      }
    }

    this.logProjectionSummary(weights, w0, tc, categoryMap, sectorMap, maxPos);

    return weights;
  }

  private _projectionNonConvergenceCount = 0;

  private projectAllConstraints(
    weights: number[],
    w0: number[],
    tc: TransitionConstraints,
    categoryMap: Record<string, number[]>,
    sectorMap: Record<string, number[]>,
    maxPos: number
  ): void {
    const MAX_ALTERNATING = 100;
    const FEASIBILITY_TOL = 1e-3;

    for (let round = 0; round < MAX_ALTERNATING; round++) {
      this.projectBoxBounds(weights, maxPos);
      this.projectSimplex(weights);

      if (tc.categoryBindings && Object.keys(tc.categoryBindings).length > 0) {
        this.projectCategoryBindings(weights, categoryMap, tc.categoryBindings, maxPos);
      }

      if (tc.sectorCaps && Object.keys(tc.sectorCaps).length > 0) {
        this.projectSectorCaps(weights, sectorMap, tc.sectorCaps);
      }

      this.projectTurnoverBall(weights, w0, tc.turnoverCap);

      this.projectBoxBounds(weights, maxPos);
      this.projectSimplex(weights);

      if (this.checkFeasibility(weights, w0, tc, categoryMap, sectorMap, maxPos, FEASIBILITY_TOL)) {
        return;
      }
    }

    this._projectionNonConvergenceCount++;
  }

  private logProjectionSummary(weights: number[], w0: number[], tc: TransitionConstraints,
    categoryMap: Record<string, number[]>, sectorMap: Record<string, number[]>, maxPos: number): void {
    if (this._projectionNonConvergenceCount > 0) {
      const violations = this.getConstraintViolations(weights, w0, tc, categoryMap, sectorMap, maxPos);
      console.warn(`[MVO] Constraint projection non-convergence: ${this._projectionNonConvergenceCount} iterations. Final violations: ${violations.join(', ') || 'none'}`);
      this._projectionNonConvergenceCount = 0;
    }
  }

  private getConstraintViolations(
    weights: number[],
    w0: number[],
    tc: TransitionConstraints,
    categoryMap: Record<string, number[]>,
    sectorMap: Record<string, number[]>,
    maxPos: number
  ): string[] {
    const violations: string[] = [];
    const tol = 1e-4;

    const sum = weights.reduce((s, w) => s + w, 0);
    if (Math.abs(sum - 1) > tol) violations.push(`sum=${sum.toFixed(4)}`);

    const maxW = Math.max(...weights);
    if (maxW > maxPos + tol) violations.push(`maxWeight=${maxW.toFixed(4)}>${maxPos}`);

    const turnover = this.computeTurnover(weights, w0);
    if (turnover > tc.turnoverCap + tol) violations.push(`turnover=${(turnover*100).toFixed(1)}%>${(tc.turnoverCap*100).toFixed(0)}%`);

    if (tc.categoryBindings) {
      for (const [cat, target] of Object.entries(tc.categoryBindings)) {
        const indices = categoryMap[cat];
        if (!indices) continue;
        const catSum = indices.reduce((s, i) => s + weights[i], 0);
        if (Math.abs(catSum - target) > tol) violations.push(`cat:${cat}=${catSum.toFixed(4)}!=${target}`);
      }
    }

    if (tc.sectorCaps) {
      for (const [sector, cap] of Object.entries(tc.sectorCaps)) {
        const indices = sectorMap[sector];
        if (!indices) continue;
        const sectorSum = indices.reduce((s, i) => s + weights[i], 0);
        if (sectorSum > cap + tol) violations.push(`sector:${sector}=${(sectorSum*100).toFixed(1)}%>${(cap*100).toFixed(0)}%`);
      }
    }

    return violations;
  }

  private checkFeasibility(
    weights: number[],
    w0: number[],
    tc: TransitionConstraints,
    categoryMap: Record<string, number[]>,
    sectorMap: Record<string, number[]>,
    maxPos: number,
    tol: number
  ): boolean {
    const sum = weights.reduce((s, w) => s + w, 0);
    if (Math.abs(sum - 1) > tol) return false;

    for (const w of weights) {
      if (w < -tol || w > maxPos + tol) return false;
    }

    const turnover = this.computeTurnover(weights, w0);
    if (turnover > tc.turnoverCap + tol) return false;

    if (tc.categoryBindings) {
      for (const [cat, target] of Object.entries(tc.categoryBindings)) {
        const indices = categoryMap[cat];
        if (!indices || indices.length === 0) continue;
        const catSum = indices.reduce((s, i) => s + weights[i], 0);
        if (Math.abs(catSum - target) > tol) return false;
      }
    }

    if (tc.sectorCaps) {
      for (const [sector, cap] of Object.entries(tc.sectorCaps)) {
        const indices = sectorMap[sector];
        if (!indices || indices.length === 0) continue;
        const sectorSum = indices.reduce((s, i) => s + weights[i], 0);
        if (sectorSum > cap + tol) return false;
      }
    }

    return true;
  }

  private projectBoxBounds(weights: number[], maxPos: number): void {
    for (let i = 0; i < weights.length; i++) {
      weights[i] = Math.max(0, Math.min(maxPos, weights[i]));
    }
  }

  private projectSimplex(weights: number[]): void {
    const n = weights.length;
    const sorted = weights.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w);
    let tmpSum = 0;
    let tMax = 0;
    for (let j = 0; j < n; j++) {
      tmpSum += sorted[j].w;
      const t = (tmpSum - 1) / (j + 1);
      if (sorted[j].w - t > 0) {
        tMax = t;
      }
    }
    for (let i = 0; i < n; i++) {
      weights[i] = Math.max(0, weights[i] - tMax);
    }
  }

  private projectTurnoverBall(weights: number[], w0: number[], turnoverCap: number): void {
    const n = weights.length;
    const diff = weights.map((w, i) => w - (w0[i] || 0));
    const l1Norm = diff.reduce((s, d) => s + Math.abs(d), 0);

    if (l1Norm <= turnoverCap + 1e-8) return;

    const absDiff = diff.map(d => Math.abs(d));
    const sorted = [...absDiff].sort((a, b) => b - a);

    let rho = 0;
    let cumSum = 0;
    for (let j = 0; j < n; j++) {
      cumSum += sorted[j];
      const testTheta = (cumSum - turnoverCap) / (j + 1);
      if (sorted[j] > testTheta) {
        rho = j;
      }
    }

    let rhoSum = 0;
    for (let j = 0; j <= rho; j++) {
      rhoSum += sorted[j];
    }
    const theta = Math.max(0, (rhoSum - turnoverCap) / (rho + 1));

    for (let i = 0; i < n; i++) {
      const shrunk = Math.max(0, absDiff[i] - theta);
      weights[i] = (w0[i] || 0) + (diff[i] >= 0 ? 1 : -1) * shrunk;
    }
  }

  private projectCategoryBindings(
    weights: number[],
    categoryMap: Record<string, number[]>,
    bindings: Record<string, number>,
    maxPos: number
  ): void {
    for (const [category, targetSum] of Object.entries(bindings)) {
      const indices = categoryMap[category];
      if (!indices || indices.length === 0) continue;

      const currentSum = indices.reduce((s, i) => s + weights[i], 0);
      if (Math.abs(currentSum - targetSum) < 1e-8) continue;

      if (currentSum > 1e-12) {
        const scale = targetSum / currentSum;
        for (const i of indices) {
          weights[i] = Math.min(weights[i] * scale, maxPos);
        }
        const afterCap = indices.reduce((s, i) => s + weights[i], 0);
        if (Math.abs(afterCap - targetSum) > 1e-8) {
          const uncapped = indices.filter(i => weights[i] < maxPos);
          const deficit = targetSum - afterCap;
          if (uncapped.length > 0) {
            const add = deficit / uncapped.length;
            for (const i of uncapped) {
              weights[i] = Math.max(0, Math.min(maxPos, weights[i] + add));
            }
          }
        }
      } else if (targetSum > 0) {
        const share = Math.min(targetSum / indices.length, maxPos);
        for (const i of indices) {
          weights[i] = share;
        }
        const afterShare = indices.reduce((s, i) => s + weights[i], 0);
        if (afterShare > 0 && Math.abs(afterShare - targetSum) > 1e-8) {
          const correction = targetSum / afterShare;
          for (const i of indices) {
            weights[i] *= correction;
          }
        }
      }
    }
  }

  private projectSectorCaps(
    weights: number[],
    sectorMap: Record<string, number[]>,
    sectorCaps: Record<string, number>
  ): void {
    for (const [sector, cap] of Object.entries(sectorCaps)) {
      const indices = sectorMap[sector];
      if (!indices || indices.length === 0) continue;

      const sectorSum = indices.reduce((s, i) => s + weights[i], 0);
      if (sectorSum <= cap + 1e-8) continue;

      const scale = cap / sectorSum;
      for (const i of indices) {
        weights[i] *= scale;
      }
    }
  }

  private computeTurnover(weights: number[], w0: number[]): number {
    return weights.reduce((sum, w, i) => sum + Math.abs(w - (w0[i] || 0)), 0);
  }

  private applyMinWeightFilter(
    weights: number[],
    minWeight: number,
    w0?: number[],
    tc?: TransitionConstraints,
    categoryMap?: Record<string, number[]>,
    sectorMap?: Record<string, number[]>,
    maxPos?: number
  ): { filtered: number[]; filteredCount: number } {
    let filteredCount = 0;
    const filtered = weights.map(w => {
      if (w > 0 && w < minWeight) {
        filteredCount++;
        return 0;
      }
      return w;
    });

    if (filteredCount > 0 && w0 && tc && categoryMap && sectorMap && maxPos) {
      this.projectAllConstraints(filtered, w0, tc, categoryMap, sectorMap, maxPos);
    } else {
      const total = filtered.reduce((s, w) => s + w, 0);
      if (total > 0 && Math.abs(total - 1) > 1e-6) {
        for (let i = 0; i < filtered.length; i++) {
          filtered[i] /= total;
        }
      }
    }

    return { filtered, filteredCount };
  }

  private buildGroupMap(assetsData: AssetData[] | undefined, field: 'sector' | 'instrumentType'): Record<string, number[]> {
    const map: Record<string, number[]> = {};
    if (!assetsData) return map;

    for (let i = 0; i < assetsData.length; i++) {
      const key = field === 'sector' ? assetsData[i].sector : assetsData[i].instrumentType;
      if (key) {
        if (!map[key]) map[key] = [];
        map[key].push(i);
      }
    }
    return map;
  }

  private normalizeWeights(weights: number[]): number[] {
    const sum = weights.reduce((s, w) => s + w, 0);
    if (sum === 0) return weights.map(() => 1 / weights.length);
    return weights.map(w => w / sum);
  }

  async run(
    assetsData: AssetData[],
    config: Partial<MVOConfig> = {},
    portfolioId?: string,
    transitionConstraints?: Partial<TransitionConstraints>,
    expectedReturnsOverride?: number[]
  ): Promise<MVOResult> {
    const startTime = Date.now();
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const tc = { ...DEFAULT_TRANSITION, ...transitionConstraints };
    const categories = assetsData.map(a => a.category);

    try {
      const covarianceMatrix = this.computeCovarianceMatrix(assetsData, fullConfig);
      const expectedReturns = expectedReturnsOverride || this.computeExpectedReturns(assetsData, fullConfig);
      const currentWeights = assetsData.map(a => a.currentWeight);

      const { weights: optimalWeights, metrics } = this.optimize(
        expectedReturns, covarianceMatrix, fullConfig, currentWeights, tc, assetsData
      );

      let portfolioReturn = 0;
      let portfolioVariance = 0;
      for (let i = 0; i < optimalWeights.length; i++) {
        portfolioReturn += optimalWeights[i] * expectedReturns[i];
        for (let j = 0; j < optimalWeights.length; j++) {
          portfolioVariance += optimalWeights[i] * optimalWeights[j] * covarianceMatrix[i][j];
        }
      }
      // covarianceMatrix is built from daily returns → variance is in daily terms.
      // expectedReturns are annualised (EWMA × 252). Annualise variance before Sharpe.
      const portfolioVolatility = Math.sqrt(Math.max(0, portfolioVariance * 252));
      const sharpeRatio = portfolioVolatility > 0 ? (portfolioReturn - 0.0715) / portfolioVolatility : 0;

      const weights: Record<string, number> = {};
      categories.forEach((cat, i) => {
        weights[cat] = Math.round(optimalWeights[i] * 10000) / 10000;
      });

      const runTimeMs = Date.now() - startTime;
      const modelVersion = `mvo-v2.0-transition-lw${fullConfig.shrinkageIntensity}-ra${fullConfig.riskAversion}-g${tc.gamma}`;

      try {
        await db.insert(quantRunLog).values({
          portfolioId: portfolioId || null,
          modelType: 'MVO_TRANSITION',
          runTimeMs,
          status: 'SUCCESS',
          inputHash: this.hashInput(categories, fullConfig),
          outputSummary: {
            weights,
            portfolioReturn,
            portfolioVolatility,
            sharpeRatio,
            transitionMetrics: metrics,
          },
          fallbackUsed: false,
        });
      } catch (e) {
        console.warn('[MVO] Failed to log run:', e);
      }

      console.log(`[MVO] Transition optimization complete in ${runTimeMs}ms. Sharpe: ${sharpeRatio.toFixed(3)}, Vol: ${(portfolioVolatility * 100).toFixed(1)}%, Turnover: ${(metrics.turnover * 100).toFixed(1)}%, Gamma: ${metrics.gammaUsed.toFixed(1)}`);

      // Annualise the covariance matrix for Black-Litterman (BL uses annual-scale views/returns)
      const annualizedCovarianceMatrix = covarianceMatrix.map(row => row.map(v => v * 252));

      return {
        weights,
        expectedReturn: portfolioReturn,
        portfolioVolatility,
        sharpeRatio,
        covarianceMatrix,
        annualizedCovarianceMatrix,
        expectedReturns,
        categories,
        modelVersion,
        transitionMetrics: metrics,
      };
    } catch (error: any) {
      const runTimeMs = Date.now() - startTime;
      try {
        await db.insert(quantRunLog).values({
          portfolioId: portfolioId || null,
          modelType: 'MVO_TRANSITION',
          runTimeMs,
          status: 'ERROR',
          errorMessage: error.message,
          fallbackUsed: true,
        });
      } catch (reportErr: any) {
        console.warn('[MVO] Failed to record error status:', reportErr?.message);
      }

      console.error('[MVO] Transition optimization failed:', error.message);
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
