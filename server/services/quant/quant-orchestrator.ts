import { db } from '../../db';
import { quantGovernancePolicy, quantRunLog, quantTransitionLog } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { mvoEngine, type AssetData, type MVOResult, type TransitionConstraints } from './mvo-engine';
import { blackLittermanEngine, type ViewSignal, type BLResult } from './black-litterman-engine';
import { driftPredictionEngine, type DriftPredictionResult } from './drift-prediction-engine';

export interface QuantInput {
  assetsData: AssetData[];
  driftMetrics: Array<{
    category: string;
    currentPercent: number;
    targetPercent: number;
    drift: number;
  }>;
  potdPicks?: Array<{
    instrumentName: string;
    category: string;
    recoPrice: number;
    targetPrice: number;
    confidenceScore?: number;
  }>;
  riskProfile: string;
  toleranceBandPct: number;
  portfolioId?: string;
  transitionConstraints?: Partial<TransitionConstraints>;
}

export interface QuantOutput {
  optimizedWeights: Record<string, number>;
  mvoResult: MVOResult | null;
  blResult: BLResult | null;
  driftResult: DriftPredictionResult | null;
  usedMvo: boolean;
  usedBl: boolean;
  usedDriftPrediction: boolean;
  usedTransitionOptimizer: boolean;
  fallbackUsed: boolean;
  totalRunTimeMs: number;
  modelVersions: string[];
  preemptiveRebalanceRecommended: boolean;
  highRiskCategories: string[];
}

class QuantOrchestrator {
  async run(input: QuantInput): Promise<QuantOutput> {
    const startTime = Date.now();
    const { assetsData, driftMetrics, potdPicks, riskProfile, toleranceBandPct, portfolioId, transitionConstraints } = input;

    const policy = await this.loadGovernancePolicy(riskProfile);

    const result: QuantOutput = {
      optimizedWeights: {},
      mvoResult: null,
      blResult: null,
      driftResult: null,
      usedMvo: false,
      usedBl: false,
      usedDriftPrediction: false,
      usedTransitionOptimizer: false,
      fallbackUsed: false,
      totalRunTimeMs: 0,
      modelVersions: [],
      preemptiveRebalanceRecommended: false,
      highRiskCategories: [],
    };

    if (!policy.useMvo && !policy.useBlackLitterman && !policy.useAiDriftPrediction) {
      console.log('[QuantOrch] All quant features disabled for', riskProfile);
      result.fallbackUsed = true;
      result.totalRunTimeMs = Date.now() - startTime;
      return result;
    }

    console.log('[QuantOrch] Starting transition-aware quant pipeline for', riskProfile,
      `MVO=${policy.useMvo}, BL=${policy.useBlackLitterman}, Drift=${policy.useAiDriftPrediction}`);

    const tc: Partial<TransitionConstraints> = {
      gamma: 5.0,
      maxPosition: Math.min(policy.maxAssetWeight, 0.20),
      turnoverCap: 0.40,
      minWeight: 0.01,
      ...transitionConstraints,
    };

    let blPosteriorReturns: number[] | undefined;

    if (policy.useMvo) {
      try {
        const mvoStart = Date.now();
        const mvoResult = await mvoEngine.run(assetsData, {
          riskAversion: policy.riskAversion,
          covarianceLookbackDays: policy.covarianceLookbackDays,
          ewmaSpan: policy.ewmaSpan,
          shrinkageIntensity: policy.shrinkageIntensity,
          maxAssetWeight: policy.maxAssetWeight,
          minAssetWeight: policy.minAssetWeight,
          solverMaxIterations: policy.solverMaxIterations,
          solverTolerance: policy.solverTolerance,
        }, portfolioId, tc);

        result.mvoResult = mvoResult;
        result.usedMvo = true;
        result.usedTransitionOptimizer = true;
        result.optimizedWeights = { ...mvoResult.weights };
        result.modelVersions.push(mvoResult.modelVersion);

        const mvoTimeMs = Date.now() - mvoStart;
        if (mvoTimeMs > 2000) {
          console.warn(`[QuantOrch] MVO exceeded 2s target: ${mvoTimeMs}ms`);
        }

        const tm = mvoResult.transitionMetrics;
        console.log(`[QuantOrch] MVO transition complete: Sharpe=${mvoResult.sharpeRatio.toFixed(3)}, Vol=${(mvoResult.portfolioVolatility * 100).toFixed(1)}%, Turnover=${tm ? (tm.turnover * 100).toFixed(1) : '?'}%, Gamma=${tm?.gammaUsed.toFixed(1) || '?'}`);
      } catch (error: any) {
        console.error('[QuantOrch] MVO failed, using fallback:', error.message);
        result.fallbackUsed = true;
        await this.logFallback(portfolioId, 'MVO_TRANSITION', error.message);
      }
    }

    if (policy.useBlackLitterman && result.mvoResult) {
      try {
        const views: ViewSignal[] = [];

        if (potdPicks && potdPicks.length > 0) {
          const potdViews = blackLittermanEngine.convertPotdToViews(potdPicks);
          views.push(...potdViews);
        }

        if (views.length > 0) {
          const blResult = await blackLittermanEngine.run(
            result.mvoResult,
            views,
            {
              tau: policy.tau,
              tacticalBudget: policy.tacticalBudget,
              riskAversion: policy.riskAversion,
            },
            portfolioId
          );

          result.blResult = blResult;
          result.usedBl = true;
          result.modelVersions.push(blResult.modelVersion);

          blPosteriorReturns = blResult.posteriorReturns;

          console.log('[QuantOrch] BL overlay computed. Re-running transition optimizer with posterior returns...');

          try {
            const blConstrainedResult = await mvoEngine.run(assetsData, {
              riskAversion: policy.riskAversion,
              covarianceLookbackDays: policy.covarianceLookbackDays,
              ewmaSpan: policy.ewmaSpan,
              shrinkageIntensity: policy.shrinkageIntensity,
              maxAssetWeight: policy.maxAssetWeight,
              minAssetWeight: policy.minAssetWeight,
              solverMaxIterations: policy.solverMaxIterations,
              solverTolerance: policy.solverTolerance,
            }, portfolioId, tc, blPosteriorReturns);

            result.mvoResult = blConstrainedResult;
            result.optimizedWeights = { ...blConstrainedResult.weights };
            result.usedTransitionOptimizer = true;

            const tm = blConstrainedResult.transitionMetrics;
            console.log(`[QuantOrch] BL+Transition complete: Sharpe=${blConstrainedResult.sharpeRatio.toFixed(3)}, Turnover=${tm ? (tm.turnover * 100).toFixed(1) : '?'}%`);

            await this.logTransition(portfolioId, blConstrainedResult);
          } catch (blMvoError: any) {
            console.error('[QuantOrch] BL+Transition re-optimization failed, using BL weights:', blMvoError.message);
            result.optimizedWeights = { ...blResult.posteriorWeights };
          }

          console.log('[QuantOrch] BL active tilts:',
            Object.entries(blResult.tacticalTilts)
              .filter(([_, t]) => Math.abs(t) > 0.001)
              .map(([c, t]) => `${c}:${(t * 100).toFixed(1)}%`)
              .join(', '));
        } else {
          console.log('[QuantOrch] BL skipped: no views available');

          if (result.mvoResult) {
            await this.logTransition(portfolioId, result.mvoResult);
          }
        }
      } catch (error: any) {
        console.error('[QuantOrch] BL failed, using MVO weights:', error.message);
        await this.logFallback(portfolioId, 'BLACK_LITTERMAN', error.message);

        if (result.mvoResult) {
          await this.logTransition(portfolioId, result.mvoResult);
        }
      }
    } else if (result.mvoResult) {
      await this.logTransition(portfolioId, result.mvoResult);
    }

    if (policy.useAiDriftPrediction) {
      try {
        const driftResult = await driftPredictionEngine.run(
          driftMetrics,
          toleranceBandPct,
          {
            driftProbabilityTrigger: policy.driftProbabilityTrigger,
          },
          portfolioId
        );

        result.driftResult = driftResult;
        result.usedDriftPrediction = true;
        result.preemptiveRebalanceRecommended = driftResult.recommendPreemptiveRebalance;
        result.highRiskCategories = driftResult.highRiskCategories;
        result.modelVersions.push(driftResult.modelVersion);

        if (driftResult.recommendPreemptiveRebalance) {
          console.log('[QuantOrch] PREEMPTIVE REBALANCE recommended. High-risk categories:',
            driftResult.highRiskCategories.join(', '));
        }
      } catch (error: any) {
        console.error('[QuantOrch] Drift prediction failed:', error.message);
        await this.logFallback(portfolioId, 'AI_DRIFT_PREDICTION', error.message);
      }
    }

    result.totalRunTimeMs = Date.now() - startTime;

    if (result.totalRunTimeMs > 2000) {
      console.warn(`[QuantOrch] Total quant pipeline exceeded 2s: ${result.totalRunTimeMs}ms`);
    }

    try {
      await db.insert(quantRunLog).values({
        portfolioId: portfolioId || null,
        modelType: 'QUANT_ORCHESTRATOR',
        runTimeMs: result.totalRunTimeMs,
        status: result.fallbackUsed ? 'PARTIAL_FALLBACK' : 'SUCCESS',
        outputSummary: {
          usedMvo: result.usedMvo,
          usedBl: result.usedBl,
          usedDriftPrediction: result.usedDriftPrediction,
          usedTransitionOptimizer: result.usedTransitionOptimizer,
          fallbackUsed: result.fallbackUsed,
          preemptiveRebalance: result.preemptiveRebalanceRecommended,
          modelVersions: result.modelVersions,
        },
        fallbackUsed: result.fallbackUsed,
        governancePolicyId: policy.id,
      });
    } catch (e) {
      console.warn('[QuantOrch] Failed to log orchestrator run:', e);
    }

    console.log(`[QuantOrch] Pipeline complete in ${result.totalRunTimeMs}ms. Models: ${result.modelVersions.join(', ') || 'none (fallback)'}`);

    return result;
  }

  convertWeightsToAllocations(
    weights: Record<string, number>,
    categories: string[]
  ): Record<string, number> {
    const allocations: Record<string, number> = {};
    let total = 0;

    for (const cat of categories) {
      const pct = Math.round((weights[cat] || 0) * 100);
      allocations[cat] = pct;
      total += pct;
    }

    if (total !== 100 && total > 0) {
      const maxCat = Object.entries(allocations).sort(([, a], [, b]) => b - a)[0];
      if (maxCat) {
        allocations[maxCat[0]] += (100 - total);
      }
    }

    return allocations;
  }

  private async logTransition(portfolioId: string | undefined, mvoResult: MVOResult): Promise<void> {
    if (!mvoResult.transitionMetrics) return;

    const tm = mvoResult.transitionMetrics;
    try {
      await db.insert(quantTransitionLog).values({
        portfolioId: portfolioId || null,
        turnover: tm.turnover,
        maxWeight: tm.maxWeight,
        sectorExposure: tm.sectorExposure,
        categoryExposure: tm.categoryExposure,
        gammaUsed: tm.gammaUsed,
        filteredCount: tm.filteredCount,
        constraintsApplied: tm.constraintsApplied,
        weightsSnapshot: mvoResult.weights,
        sharpeRatio: mvoResult.sharpeRatio,
        portfolioReturn: mvoResult.expectedReturn,
        portfolioVolatility: mvoResult.portfolioVolatility,
        modelVersion: mvoResult.modelVersion,
      });
    } catch (e) {
      console.warn('[QuantOrch] Failed to log transition:', e);
    }
  }

  private async loadGovernancePolicy(riskProfile: string) {
    try {
      const rows = await db.select().from(quantGovernancePolicy)
        .where(eq(quantGovernancePolicy.riskProfile, riskProfile))
        .limit(1);

      if (rows[0]) return rows[0];
    } catch (e) {
      console.warn('[QuantOrch] Failed to load governance policy:', e);
    }

    return {
      id: 0,
      riskProfile,
      useMvo: false,
      useBlackLitterman: false,
      useAiDriftPrediction: false,
      riskAversion: 2.5,
      tau: 0.05,
      tacticalBudget: 0.10,
      driftProbabilityTrigger: 0.7,
      maxAssetWeight: 0.40,
      minAssetWeight: 0.0,
      covarianceLookbackDays: 250,
      ewmaSpan: 60,
      shrinkageIntensity: 0.5,
      solverMaxIterations: 1000,
      solverTolerance: 1e-8,
      updatedAt: new Date(),
    };
  }

  private async logFallback(portfolioId: string | undefined, modelType: string, errorMessage: string) {
    try {
      await db.insert(quantRunLog).values({
        portfolioId: portfolioId || null,
        modelType,
        status: 'FALLBACK',
        errorMessage,
        fallbackUsed: true,
      });
    } catch (_) {}
  }
}

export const quantOrchestrator = new QuantOrchestrator();
