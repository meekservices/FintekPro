import { logger } from '../../logger';
import { quantOrchestrator } from "../quant/quant-orchestrator";

export interface DriftMetric {
  category: string;
  currentValue: number;
  currentPercent: number;
  targetPercent: number;
  targetValue: number;
  drift: number;
  driftPercent: number;
  driftStatus: 'DRIFT_BREACH' | 'WITHIN_BAND';
  holdings: any[];
  riskFlag?: string;
  costEstimate?: number;
  costFlag?: string;
  rawAction?: string;
  finalAction?: string;
  changeAmount?: number;
  rationaleCode?: string;
  rationaleDetail?: string;
}

const CATEGORY_RISK_MAP: Record<string, number> = {
  equity: 20, listed_stocks: 22, unlisted_stocks: 25, etf: 15,
  hybrid: 12, gold: 10, silver: 14, index: 13,
  debt: 6, bonds: 7, mld: 8, international: 18,
  reit: 14, invit: 13, pms: 20, aif: 22
};

export class DriftEngine {
  /**
   * Calculates portfolio drift and determines necessary rebalancing actions.
   * Integrates with QuantOrchestrator for MVO-based target optimization.
   */
  async calculateDrift(
    categories: string[],
    targetAllocations: Record<string, number>,
    currentByCategory: Record<string, { value: number; holdings: any[] }>,
    totalPortfolioValue: number,
    totalValue: number,
    policy: any,
    riskProfile: any,
    prospectId: string
  ): Promise<DriftMetric[]> {
    const driftMetrics: DriftMetric[] = [];

    // 1. Initial Drift Calculation
    for (const category of categories) {
      const targetPercent = targetAllocations[category] || 0;
      const targetValue = (targetPercent / 100) * totalPortfolioValue;
      const currentValue = currentByCategory[category]?.value || 0;
      const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
      const drift = currentPercent - targetPercent;
      const driftPercent = targetPercent > 0 ? drift / targetPercent : 0;
      const driftStatus: 'DRIFT_BREACH' | 'WITHIN_BAND' = Math.abs(drift) > (policy.toleranceBandPct ?? 5) ? 'DRIFT_BREACH' : 'WITHIN_BAND';

      driftMetrics.push({
        category,
        currentValue,
        currentPercent,
        targetPercent,
        targetValue,
        drift,
        driftPercent,
        driftStatus,
        holdings: currentByCategory[category]?.holdings || [],
      });
    }

    logger.info(`[DriftEngine] Initial drift analysis complete for ${prospectId}`);

    // 2. Quant Optimization (MVO)
    try {
      const quantInput = {
        assetsData: driftMetrics.filter(dm => dm.targetPercent > 0).map(dm => ({
          category: dm.category,
          returns: [] as number[],
          currentWeight: dm.currentPercent / 100,
        })),
        driftMetrics: driftMetrics.map(dm => ({
          category: dm.category,
          currentPercent: dm.currentPercent,
          targetPercent: dm.targetPercent,
          drift: dm.drift,
        })),
        riskProfile: riskProfile.riskTolerance,
        toleranceBandPct: policy.toleranceBandPct ?? 5,
        portfolioId: `prospect-${prospectId}`,
      };

      const quantResult = await quantOrchestrator.run(quantInput);

      if (quantResult.usedMvo && Object.keys(quantResult.optimizedWeights).length > 0) {
        const quantAllocations = quantOrchestrator.convertWeightsToAllocations(
          quantResult.optimizedWeights, categories
        );
        for (const dm of driftMetrics) {
          if (quantAllocations[dm.category] !== undefined) {
            const newTarget = quantAllocations[dm.category];
            if (newTarget !== dm.targetPercent) {
              logger.info(`[DriftEngine][Quant] ${dm.category}: target ${dm.targetPercent}% → ${newTarget}% (quant-optimized)`);
              dm.targetPercent = newTarget;
              dm.targetValue = (newTarget / 100) * totalPortfolioValue;
              dm.drift = dm.currentPercent - newTarget;
              dm.driftPercent = newTarget > 0 ? dm.drift / newTarget : 0;
              dm.driftStatus = Math.abs(dm.drift) > (policy.toleranceBandPct ?? 5) ? 'DRIFT_BREACH' : 'WITHIN_BAND';
            }
          }
        }
      }

      if (quantResult.preemptiveRebalanceRecommended) {
        logger.warn(`[DriftEngine][Quant] Preemptive rebalance triggered for: ${quantResult.highRiskCategories.join(', ')}`);
        for (const dm of driftMetrics) {
          if (quantResult.highRiskCategories.includes(dm.category) && dm.driftStatus === 'WITHIN_BAND') {
            dm.driftStatus = 'DRIFT_BREACH';
          }
        }
      }
    } catch (quantError: any) {
      logger.warn(`[DriftEngine] Quant orchestrator error: ${quantError.message}`);
    }

    // 3. Risk Engine (Volatility Limits)
    const currentPortfolioVolatility = totalValue > 0
      ? driftMetrics.reduce((sum, dm) => sum + (dm.currentPercent / 100) * (CATEGORY_RISK_MAP[dm.category] || 15), 0)
      : 0;

    for (const dm of driftMetrics) {
      const catVol = CATEGORY_RISK_MAP[dm.category] || 15;
      if (dm.drift < 0 && dm.driftStatus === 'DRIFT_BREACH') {
        const additionalWeight = Math.abs(dm.drift) / 100;
        const projectedVol = currentPortfolioVolatility + additionalWeight * catVol;
        dm.riskFlag = projectedVol > ((policy.targetVolatilityPct ?? 15) + (policy.riskToleranceBandPct ?? 3)) ? 'VOL_BREACH' : 'OK';
      } else {
        dm.riskFlag = 'OK';
      }
    }

    // 4. Transaction Cost Filter
    for (const dm of driftMetrics) {
      const changeAmount = Math.abs(dm.currentValue - dm.targetValue);
      const estimatedCost = changeAmount * ((policy.brokerageRatePct ?? 0.03) / 100);
      dm.costEstimate = estimatedCost;
      dm.costFlag = (changeAmount < (policy.minTradeValueInr ?? 5000) || estimatedCost > changeAmount * 0.02) ? 'TOO_EXPENSIVE' : 'ACCEPTABLE';
    }

    // 5. Action Determination
    for (const dm of driftMetrics) {
      dm.rawAction = this.determineAction(dm.drift, dm.driftStatus, dm.riskFlag || 'OK', dm.costFlag || 'ACCEPTABLE');
      dm.finalAction = dm.rawAction;
      dm.changeAmount = dm.currentValue - dm.targetValue;

      if (dm.rawAction === 'HOLD' || dm.rawAction === 'HOLD_COST_FILTER' || dm.rawAction === 'HOLD_RISK_LIMIT') {
        dm.rationaleCode = dm.rawAction === 'HOLD_COST_FILTER' ? 'COST_FILTER' : dm.rawAction === 'HOLD_RISK_LIMIT' ? 'RISK_LIMIT' : 'WITHIN_BAND';
      } else if (dm.rawAction === 'REDUCE') {
        dm.rationaleCode = 'OVERWEIGHT';
      } else if (dm.rawAction === 'INCREASE') {
        dm.rationaleCode = 'UNDERWEIGHT';
      }
      
      dm.rationaleDetail = `${dm.category}: drift=${dm.drift.toFixed(2)}%, action=${dm.rawAction}, risk=${dm.riskFlag}, cost=${dm.costFlag}`;
    }

    return driftMetrics;
  }

  private determineAction(drift: number, driftStatus: string, riskFlag: string, costFlag: string): string {
    if (costFlag === 'TOO_EXPENSIVE') return 'HOLD_COST_FILTER';
    if (riskFlag === 'VOL_BREACH') return drift > 0 ? 'REDUCE' : 'HOLD_RISK_LIMIT';
    if (driftStatus === 'DRIFT_BREACH') return drift > 0 ? 'REDUCE' : 'INCREASE';
    return 'HOLD';
  }
}

export const driftEngine = new DriftEngine();
