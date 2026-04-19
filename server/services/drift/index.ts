export interface AssetWeight {
  asset: string;
  weight: number; 
}

export interface PortfolioTargetModel {
  portfolio_id: string;
  target_allocation: AssetWeight[];
  rebalance_policy: {
    frequency: string;
    drift_threshold: number;
    tax_aware: boolean;
  };
}

export interface DriftReport {
  has_drifted: boolean;
  largest_drift: number;
  drifting_assets: { asset: string; current: number; target: number; delta: number }[];
}

export class DriftDetectionEngine {

  /**
   * Evaluates the absolute discrepancy between current market valuations and target weights.
   * Drift_i = w_current - w_target
   */
  public calculateDrift(targetModel: PortfolioTargetModel, currentAllocation: AssetWeight[]): DriftReport {
    const analysisMap = [];
    let hasDrifted = false;
    let maxDrift = 0;

    for (const target of targetModel.target_allocation) {
      const current = currentAllocation.find(c => c.asset === target.asset);
      const currentWeight = current ? current.weight : 0.0;
      
      const delta = currentWeight - target.weight;
      const absoluteDrift = Math.abs(delta);

      if (absoluteDrift > maxDrift) {
        maxDrift = absoluteDrift;
      }

      if (absoluteDrift > targetModel.rebalance_policy.drift_threshold) {
        hasDrifted = true;
      }

      analysisMap.push({
        asset: target.asset,
        current: currentWeight,
        target: target.weight,
        delta: delta // Positive means overweight (need to sell), Negative means underweight (need to buy)
      });
    }

    return {
      has_drifted: hasDrifted,
      largest_drift: maxDrift,
      drifting_assets: analysisMap
    };
  }
}

export const driftEngine = new DriftDetectionEngine();
