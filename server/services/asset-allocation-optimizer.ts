/**
 * Asset Allocation Optimizer
 * 
 * Implements Modern Portfolio Theory (MPT) based optimization:
 * - True mean-variance optimization using constrained gradient descent
 * - Efficient frontier calculation with distinct points
 * - Risk profile-based constraint application
 * - Client segment-specific constraints
 */

export interface AssetClass {
  type: string;
  name: string;
  expectedReturn: number;
  volatility: number;
  minAllocation: number;
  maxAllocation: number;
  liquidityScore: number;
  taxEfficiency: number;
}

export interface CorrelationMatrix {
  [assetType: string]: { [otherAssetType: string]: number };
}

export interface AllocationResult {
  assetType: string;
  assetName: string;
  allocation: number;
  expectedReturn: number;
  contributionToRisk: number;
  amount?: number;
}

export interface PortfolioMetrics {
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  diversificationRatio: number;
  maxDrawdownEstimate: number;
}

export interface OptimizationResult {
  allocations: AllocationResult[];
  portfolioMetrics: PortfolioMetrics;
  efficientFrontier: EfficientFrontierPoint[];
  riskProfile: string;
  segment: string;
  constraints: AllocationConstraints;
  optimizationMethod: string;
  rationale: string[];
}

export interface EfficientFrontierPoint {
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  allocations: { [assetType: string]: number };
}

export interface AllocationConstraints {
  minEquity: number;
  maxEquity: number;
  minDebt: number;
  maxDebt: number;
  minAlternatives: number;
  maxAlternatives: number;
  minLiquidity: number;
  maxSingleAsset: number;
}

export interface OptimizationInput {
  riskScore: number;
  segment: 'retail' | 'hni' | 'shni' | 'bhni' | 'corporate';
  investableAmount?: number;
  investmentHorizon: number;
  goalType?: 'growth' | 'income' | 'preservation' | 'balanced';
  liquidityNeeds?: 'low' | 'medium' | 'high';
  taxBracket?: 'low' | 'medium' | 'high';
  existingAllocations?: { [assetType: string]: number };
}

interface AssetBounds {
  min: number;
  max: number;
}

export const ASSET_CLASSES: AssetClass[] = [
  { type: 'large_cap_equity', name: 'Large Cap Equity', expectedReturn: 12, volatility: 16, minAllocation: 0, maxAllocation: 60, liquidityScore: 9, taxEfficiency: 7 },
  { type: 'mid_cap_equity', name: 'Mid Cap Equity', expectedReturn: 14, volatility: 22, minAllocation: 0, maxAllocation: 40, liquidityScore: 8, taxEfficiency: 7 },
  { type: 'small_cap_equity', name: 'Small Cap Equity', expectedReturn: 16, volatility: 28, minAllocation: 0, maxAllocation: 30, liquidityScore: 6, taxEfficiency: 7 },
  { type: 'international_equity', name: 'International Equity', expectedReturn: 10, volatility: 18, minAllocation: 0, maxAllocation: 25, liquidityScore: 7, taxEfficiency: 6 },
  { type: 'government_bonds', name: 'Government Bonds', expectedReturn: 7, volatility: 4, minAllocation: 0, maxAllocation: 50, liquidityScore: 10, taxEfficiency: 5 },
  { type: 'corporate_bonds', name: 'Corporate Bonds', expectedReturn: 8.5, volatility: 6, minAllocation: 0, maxAllocation: 40, liquidityScore: 8, taxEfficiency: 5 },
  { type: 'money_market', name: 'Money Market/Liquid Funds', expectedReturn: 5.5, volatility: 1, minAllocation: 0, maxAllocation: 30, liquidityScore: 10, taxEfficiency: 4 },
  { type: 'gold', name: 'Gold/Precious Metals', expectedReturn: 6, volatility: 12, minAllocation: 0, maxAllocation: 15, liquidityScore: 9, taxEfficiency: 6 },
  { type: 'real_estate', name: 'Real Estate/REITs', expectedReturn: 9, volatility: 14, minAllocation: 0, maxAllocation: 20, liquidityScore: 4, taxEfficiency: 6 },
  { type: 'alternatives', name: 'Alternatives (PE/VC/AIF)', expectedReturn: 18, volatility: 30, minAllocation: 0, maxAllocation: 25, liquidityScore: 2, taxEfficiency: 8 }
];

const CORRELATION_MATRIX: CorrelationMatrix = {
  large_cap_equity: { large_cap_equity: 1.0, mid_cap_equity: 0.85, small_cap_equity: 0.80, international_equity: 0.70, government_bonds: -0.20, corporate_bonds: 0.10, money_market: 0.05, gold: 0.05, real_estate: 0.50, alternatives: 0.60 },
  mid_cap_equity: { large_cap_equity: 0.85, mid_cap_equity: 1.0, small_cap_equity: 0.90, international_equity: 0.65, government_bonds: -0.15, corporate_bonds: 0.15, money_market: 0.05, gold: 0.10, real_estate: 0.55, alternatives: 0.65 },
  small_cap_equity: { large_cap_equity: 0.80, mid_cap_equity: 0.90, small_cap_equity: 1.0, international_equity: 0.60, government_bonds: -0.10, corporate_bonds: 0.20, money_market: 0.05, gold: 0.15, real_estate: 0.45, alternatives: 0.70 },
  international_equity: { large_cap_equity: 0.70, mid_cap_equity: 0.65, small_cap_equity: 0.60, international_equity: 1.0, government_bonds: -0.10, corporate_bonds: 0.15, money_market: 0.05, gold: 0.20, real_estate: 0.40, alternatives: 0.50 },
  government_bonds: { large_cap_equity: -0.20, mid_cap_equity: -0.15, small_cap_equity: -0.10, international_equity: -0.10, government_bonds: 1.0, corporate_bonds: 0.80, money_market: 0.60, gold: 0.30, real_estate: 0.10, alternatives: -0.10 },
  corporate_bonds: { large_cap_equity: 0.10, mid_cap_equity: 0.15, small_cap_equity: 0.20, international_equity: 0.15, government_bonds: 0.80, corporate_bonds: 1.0, money_market: 0.50, gold: 0.20, real_estate: 0.25, alternatives: 0.10 },
  money_market: { large_cap_equity: 0.05, mid_cap_equity: 0.05, small_cap_equity: 0.05, international_equity: 0.05, government_bonds: 0.60, corporate_bonds: 0.50, money_market: 1.0, gold: 0.10, real_estate: 0.05, alternatives: 0.00 },
  gold: { large_cap_equity: 0.05, mid_cap_equity: 0.10, small_cap_equity: 0.15, international_equity: 0.20, government_bonds: 0.30, corporate_bonds: 0.20, money_market: 0.10, gold: 1.0, real_estate: 0.15, alternatives: 0.10 },
  real_estate: { large_cap_equity: 0.50, mid_cap_equity: 0.55, small_cap_equity: 0.45, international_equity: 0.40, government_bonds: 0.10, corporate_bonds: 0.25, money_market: 0.05, gold: 0.15, real_estate: 1.0, alternatives: 0.40 },
  alternatives: { large_cap_equity: 0.60, mid_cap_equity: 0.65, small_cap_equity: 0.70, international_equity: 0.50, government_bonds: -0.10, corporate_bonds: 0.10, money_market: 0.00, gold: 0.10, real_estate: 0.40, alternatives: 1.0 }
};

export const EQUITY_TYPES = ['large_cap_equity', 'mid_cap_equity', 'small_cap_equity', 'international_equity'];
export const DEBT_TYPES = ['government_bonds', 'corporate_bonds', 'money_market'];
export const ALTERNATIVE_TYPES = ['alternatives'];
export const LIQUID_TYPES = ['money_market', 'government_bonds'];

class AssetAllocationOptimizer {
  private riskFreeRate = 7.15; // India 10Y G-Sec as of Mar 2026 — update periodically
  private assetTypes = ASSET_CLASSES.map(a => a.type);

  getRiskProfile(riskScore: number): string {
    if (riskScore <= 25) return 'very_conservative';
    if (riskScore <= 40) return 'conservative';
    if (riskScore <= 55) return 'moderate';
    if (riskScore <= 70) return 'moderately_aggressive';
    if (riskScore <= 85) return 'aggressive';
    return 'very_aggressive';
  }

  getConstraints(riskScore: number, segment: string): AllocationConstraints {
    const profile = this.getRiskProfile(riskScore);
    
    const profileConstraints: { [key: string]: AllocationConstraints } = {
      very_conservative: {
        minEquity: 10, maxEquity: 25,
        minDebt: 60, maxDebt: 80,
        minAlternatives: 0, maxAlternatives: 0,
        minLiquidity: 15, maxSingleAsset: 30
      },
      conservative: {
        minEquity: 20, maxEquity: 40,
        minDebt: 45, maxDebt: 65,
        minAlternatives: 0, maxAlternatives: 5,
        minLiquidity: 10, maxSingleAsset: 35
      },
      moderate: {
        minEquity: 35, maxEquity: 55,
        minDebt: 30, maxDebt: 50,
        minAlternatives: 0, maxAlternatives: 10,
        minLiquidity: 5, maxSingleAsset: 40
      },
      moderately_aggressive: {
        minEquity: 50, maxEquity: 70,
        minDebt: 15, maxDebt: 35,
        minAlternatives: 0, maxAlternatives: 15,
        minLiquidity: 3, maxSingleAsset: 45
      },
      aggressive: {
        minEquity: 65, maxEquity: 85,
        minDebt: 5, maxDebt: 25,
        minAlternatives: 0, maxAlternatives: 20,
        minLiquidity: 2, maxSingleAsset: 50
      },
      very_aggressive: {
        minEquity: 75, maxEquity: 95,
        minDebt: 0, maxDebt: 15,
        minAlternatives: 0, maxAlternatives: 25,
        minLiquidity: 0, maxSingleAsset: 55
      }
    };

    let constraints = { ...profileConstraints[profile] };

    if (segment === 'bhni' || segment === 'shni') {
      constraints.maxAlternatives = Math.min(constraints.maxAlternatives + 10, 35);
    } else if (segment === 'retail') {
      constraints.maxAlternatives = 0;
      constraints.minLiquidity = Math.max(constraints.minLiquidity, 5);
    } else if (segment === 'corporate') {
      constraints.minLiquidity = Math.max(constraints.minLiquidity + 10, 15);
      constraints.maxEquity = Math.max(constraints.maxEquity - 15, constraints.minEquity);
    }

    return constraints;
  }

  private getAssetBounds(
    constraints: AllocationConstraints,
    segment: string
  ): Map<string, AssetBounds> {
    const bounds = new Map<string, AssetBounds>();

    for (const asset of ASSET_CLASSES) {
      let min = asset.minAllocation;
      let max = asset.maxAllocation;

      if (segment === 'retail') {
        if (asset.type === 'alternatives') {
          min = 0;
          max = 0;
        }
        if (asset.type === 'real_estate') {
          max = Math.min(max, 5);
        }
      }

      max = Math.min(max, constraints.maxSingleAsset);
      bounds.set(asset.type, { min, max });
    }

    return bounds;
  }

  private calculatePortfolioVariance(weights: number[]): number {
    let variance = 0;
    const n = this.assetTypes.length;

    for (let i = 0; i < n; i++) {
      const asset1 = ASSET_CLASSES[i];
      const type1 = asset1.type;
      for (let j = 0; j < n; j++) {
        const asset2 = ASSET_CLASSES[j];
        const type2 = asset2.type;
        const w1 = weights[i] / 100;
        const w2 = weights[j] / 100;
        const sigma1 = asset1.volatility / 100;
        const sigma2 = asset2.volatility / 100;
        const correlation = CORRELATION_MATRIX[type1]?.[type2] ?? (type1 === type2 ? 1 : 0);
        variance += w1 * w2 * sigma1 * sigma2 * correlation;
      }
    }

    return variance;
  }

  private calculatePortfolioReturn(weights: number[]): number {
    let ret = 0;
    for (let i = 0; i < weights.length; i++) {
      ret += (weights[i] / 100) * ASSET_CLASSES[i].expectedReturn;
    }
    return ret;
  }

  private calculateSharpeRatio(expectedReturn: number, volatility: number): number {
    if (volatility === 0) return 0;
    return (expectedReturn - this.riskFreeRate) / volatility;
  }

  private calculateDiversificationRatio(weights: number[]): number {
    let weightedVolatility = 0;
    for (let i = 0; i < weights.length; i++) {
      weightedVolatility += (weights[i] / 100) * ASSET_CLASSES[i].volatility;
    }
    const portfolioVariance = this.calculatePortfolioVariance(weights);
    const portfolioVolatility = Math.sqrt(portfolioVariance) * 100;
    if (portfolioVolatility === 0) return 1;
    return weightedVolatility / portfolioVolatility;
  }

  private estimateMaxDrawdown(volatility: number, horizon: number = 1): number {
    const zScore95 = 1.645;
    return volatility * zScore95 * Math.sqrt(Math.min(horizon, 12) / 12);
  }

  private getGroupSum(weights: number[], types: string[]): number {
    let sum = 0;
    for (let i = 0; i < this.assetTypes.length; i++) {
      if (types.includes(this.assetTypes[i])) {
        sum += weights[i];
      }
    }
    return sum;
  }

  private projectToConstraints(
    weights: number[],
    bounds: Map<string, AssetBounds>,
    constraints: AllocationConstraints
  ): number[] {
    let projected = weights.slice();

    for (let i = 0; i < projected.length; i++) {
      const b = bounds.get(this.assetTypes[i])!;
      projected[i] = Math.max(b.min, Math.min(b.max, projected[i]));
    }

    for (let iter = 0; iter < 50; iter++) {
      let changed = false;
      let equitySum = this.getGroupSum(projected, EQUITY_TYPES);
      let debtSum = this.getGroupSum(projected, DEBT_TYPES);
      let altSum = this.getGroupSum(projected, ALTERNATIVE_TYPES);
      let liqSum = this.getGroupSum(projected, LIQUID_TYPES);

      if (equitySum > constraints.maxEquity + 0.1) {
        const excess = equitySum - constraints.maxEquity;
        this.forceReduceGroup(projected, EQUITY_TYPES, excess, bounds);
        this.forceIncreaseGroup(projected, DEBT_TYPES, excess, bounds);
        changed = true;
      } else if (equitySum < constraints.minEquity - 0.1) {
        const deficit = constraints.minEquity - equitySum;
        this.forceIncreaseGroup(projected, EQUITY_TYPES, deficit, bounds);
        this.forceReduceGroup(projected, DEBT_TYPES, deficit, bounds);
        changed = true;
      }

      debtSum = this.getGroupSum(projected, DEBT_TYPES);
      if (debtSum > constraints.maxDebt + 0.1) {
        const excess = debtSum - constraints.maxDebt;
        this.forceReduceGroup(projected, DEBT_TYPES, excess, bounds);
        changed = true;
      } else if (debtSum < constraints.minDebt - 0.1) {
        const deficit = constraints.minDebt - debtSum;
        this.forceIncreaseGroup(projected, DEBT_TYPES, deficit, bounds);
        changed = true;
      }

      altSum = this.getGroupSum(projected, ALTERNATIVE_TYPES);
      if (altSum > constraints.maxAlternatives + 0.1) {
        const excess = altSum - constraints.maxAlternatives;
        this.forceReduceGroup(projected, ALTERNATIVE_TYPES, excess, bounds);
        changed = true;
      }

      liqSum = this.getGroupSum(projected, LIQUID_TYPES);
      if (liqSum < constraints.minLiquidity - 0.1) {
        const deficit = constraints.minLiquidity - liqSum;
        this.forceIncreaseGroup(projected, LIQUID_TYPES, deficit, bounds);
        changed = true;
      }

      for (let i = 0; i < projected.length; i++) {
        const b = bounds.get(this.assetTypes[i])!;
        projected[i] = Math.max(b.min, Math.min(b.max, projected[i]));
      }

      if (!changed) break;
    }

    const total = projected.reduce((s, w) => s + w, 0);
    if (Math.abs(total - 100) > 0.01) {
      const factor = 100 / total;
      projected = projected.map(w => w * factor);
    }

    for (let i = 0; i < projected.length; i++) {
      const b = bounds.get(this.assetTypes[i])!;
      projected[i] = Math.max(b.min, Math.min(b.max, projected[i]));
    }

    for (let finalPass = 0; finalPass < 20; finalPass++) {
      const total = projected.reduce((s, w) => s + w, 0);
      if (Math.abs(total - 100) > 0.1) {
        const diff = 100 - total;
        this.distributeNormalizationDiff(projected, diff, bounds, constraints);
      }
      
      let equitySum = this.getGroupSum(projected, EQUITY_TYPES);
      let debtSum = this.getGroupSum(projected, DEBT_TYPES);
      const altSum = this.getGroupSum(projected, ALTERNATIVE_TYPES);
      const liqSum = this.getGroupSum(projected, LIQUID_TYPES);
      
      let changed = false;
      
      if (equitySum < constraints.minEquity - 0.1) {
        const deficit = constraints.minEquity - equitySum;
        this.forceIncreaseGroup(projected, EQUITY_TYPES, deficit, bounds);
        
        debtSum = this.getGroupSum(projected, DEBT_TYPES);
        if (debtSum > constraints.minDebt) {
          const canReduce = Math.min(deficit, debtSum - constraints.minDebt);
          this.forceReduceGroup(projected, DEBT_TYPES, canReduce, bounds);
        }
        
        const newAlt = this.getGroupSum(projected, ALTERNATIVE_TYPES);
        if (newAlt > 0 && deficit > 0) {
          const canReduce = Math.min(deficit * 0.5, newAlt);
          this.forceReduceGroup(projected, ALTERNATIVE_TYPES, canReduce, bounds);
        }
        changed = true;
      } else if (equitySum > constraints.maxEquity + 0.1) {
        const excess = equitySum - constraints.maxEquity;
        this.forceReduceGroup(projected, EQUITY_TYPES, excess, bounds);
        this.forceIncreaseGroup(projected, DEBT_TYPES, excess, bounds);
        changed = true;
      }
      
      debtSum = this.getGroupSum(projected, DEBT_TYPES);
      if (debtSum < constraints.minDebt - 0.1) {
        const deficit = constraints.minDebt - debtSum;
        this.forceIncreaseGroup(projected, DEBT_TYPES, deficit, bounds);
        changed = true;
      } else if (debtSum > constraints.maxDebt + 0.1) {
        const excess = debtSum - constraints.maxDebt;
        this.forceReduceGroup(projected, DEBT_TYPES, excess, bounds);
        this.forceIncreaseGroup(projected, EQUITY_TYPES, excess, bounds);
        changed = true;
      }
      
      if (liqSum < constraints.minLiquidity - 0.1) {
        const deficit = constraints.minLiquidity - liqSum;
        this.forceIncreaseGroup(projected, LIQUID_TYPES, deficit, bounds);
        changed = true;
      }
      
      for (let i = 0; i < projected.length; i++) {
        const b = bounds.get(this.assetTypes[i])!;
        projected[i] = Math.max(b.min, Math.min(b.max, projected[i]));
      }
      
      equitySum = this.getGroupSum(projected, EQUITY_TYPES);
      debtSum = this.getGroupSum(projected, DEBT_TYPES);
      
      const constraintsOK = 
        equitySum >= constraints.minEquity - 0.5 &&
        equitySum <= constraints.maxEquity + 0.5 &&
        debtSum >= constraints.minDebt - 0.5 &&
        debtSum <= constraints.maxDebt + 0.5;
      
      const sumOK = Math.abs(projected.reduce((s, w) => s + w, 0) - 100) < 0.5;
      
      if (constraintsOK && sumOK && !changed) {
        break;
      }
    }
    
    const finalTotal = projected.reduce((s, w) => s + w, 0);
    if (Math.abs(finalTotal - 100) > 0.01) {
      const factor = 100 / finalTotal;
      projected = projected.map(w => w * factor);
    }

    return projected.map(w => Math.round(w * 100) / 100);
  }
  
  private distributeNormalizationDiff(
    weights: number[],
    diff: number,
    bounds: Map<string, AssetBounds>,
    constraints: AllocationConstraints
  ): void {
    const equitySum = this.getGroupSum(weights, EQUITY_TYPES);
    const debtSum = this.getGroupSum(weights, DEBT_TYPES);
    
    if (diff > 0) {
      if (equitySum < constraints.minEquity) {
        this.forceIncreaseGroup(weights, EQUITY_TYPES, diff, bounds);
      } else if (debtSum < constraints.minDebt) {
        this.forceIncreaseGroup(weights, DEBT_TYPES, diff, bounds);
      } else {
        const indices = this.assetTypes.map((t, i) => i).filter(i => {
          const b = bounds.get(this.assetTypes[i])!;
          return weights[i] < b.max;
        });
        if (indices.length > 0) {
          const perAsset = diff / indices.length;
          for (const i of indices) {
            const b = bounds.get(this.assetTypes[i])!;
            weights[i] = Math.min(b.max, weights[i] + perAsset);
          }
        }
      }
    } else {
      const reduction = -diff;
      if (equitySum > constraints.maxEquity) {
        this.forceReduceGroup(weights, EQUITY_TYPES, reduction, bounds);
      } else if (debtSum > constraints.maxDebt) {
        this.forceReduceGroup(weights, DEBT_TYPES, reduction, bounds);
      } else {
        const indices = this.assetTypes.map((t, i) => i)
          .filter(i => {
            const b = bounds.get(this.assetTypes[i])!;
            return weights[i] > b.min;
          })
          .sort((a, b) => weights[b] - weights[a]);
        
        let remaining = reduction;
        for (const i of indices) {
          if (remaining <= 0) break;
          const b = bounds.get(this.assetTypes[i])!;
          const canReduce = weights[i] - b.min;
          const reduce = Math.min(remaining, canReduce);
          weights[i] -= reduce;
          remaining -= reduce;
        }
      }
    }
  }

  private adjustGroup(
    weights: number[],
    types: string[],
    delta: number,
    bounds: Map<string, AssetBounds>,
    respectBounds: boolean
  ): void {
    const indices = this.assetTypes
      .map((t, i) => types.includes(t) ? i : -1)
      .filter(i => i >= 0);

    if (indices.length === 0) return;

    const perAsset = delta / indices.length;

    for (const i of indices) {
      const b = bounds.get(this.assetTypes[i])!;
      let newVal = weights[i] + perAsset;
      if (respectBounds) {
        newVal = Math.max(b.min, Math.min(b.max, newVal));
      }
      weights[i] = newVal;
    }
  }

  private forceReduceGroup(
    weights: number[],
    types: string[],
    amount: number,
    bounds: Map<string, AssetBounds>
  ): void {
    const indices = this.assetTypes
      .map((t, i) => types.includes(t) ? i : -1)
      .filter(i => i >= 0);

    if (indices.length === 0) return;

    let remaining = amount;
    const sortedIndices = indices.sort((a, b) => weights[b] - weights[a]);

    for (const i of sortedIndices) {
      if (remaining <= 0) break;
      const b = bounds.get(this.assetTypes[i])!;
      const canReduce = Math.max(0, weights[i] - b.min);
      const reduction = Math.min(remaining, canReduce);
      weights[i] -= reduction;
      remaining -= reduction;
    }
  }

  private forceIncreaseGroup(
    weights: number[],
    types: string[],
    amount: number,
    bounds: Map<string, AssetBounds>
  ): void {
    const indices = this.assetTypes
      .map((t, i) => types.includes(t) ? i : -1)
      .filter(i => i >= 0);

    if (indices.length === 0) return;

    let remaining = amount;
    const sortedIndices = indices.sort((a, b) => weights[a] - weights[b]);

    for (const i of sortedIndices) {
      if (remaining <= 0) break;
      const b = bounds.get(this.assetTypes[i])!;
      const canIncrease = Math.max(0, b.max - weights[i]);
      const increase = Math.min(remaining, canIncrease);
      weights[i] += increase;
      remaining -= increase;
    }
  }

  private optimizeForTargetVolatility(
    targetVolatility: number,
    bounds: Map<string, AssetBounds>,
    constraints: AllocationConstraints
  ): number[] {
    const n = ASSET_CLASSES.length;
    let weights = new Array(n).fill(100 / n);

    weights = this.projectToConstraints(weights, bounds, constraints);

    const maxIter = 500;
    const learningRate = 2.0;
    const momentum = 0.7;
    let velocity = new Array(n).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
      const variance = this.calculatePortfolioVariance(weights);
      const volatility = Math.sqrt(variance) * 100;
      const portfolioReturn = this.calculatePortfolioReturn(weights);

      const volGap = volatility - targetVolatility;

      if (Math.abs(volGap) < 0.1) break;

      const gradient = new Array(n).fill(0);

      for (let i = 0; i < n; i++) {
        const asset = ASSET_CLASSES[i];
        const returnGrad = asset.expectedReturn / 100;

        let varianceGrad = 0;
        for (let j = 0; j < n; j++) {
          const asset2 = ASSET_CLASSES[j];
          const correlation = CORRELATION_MATRIX[asset.type]?.[asset2.type] ?? 0;
          varianceGrad += (weights[j] / 100) * (asset.volatility / 100) * (asset2.volatility / 100) * correlation;
        }
        varianceGrad *= 2;

        const volGrad = varianceGrad / (2 * Math.sqrt(variance) + 1e-8);

        if (volGap > 0) {
          gradient[i] = -volGrad * 50 + returnGrad * 10;
        } else {
          gradient[i] = volGrad * 50 + returnGrad * 10;
        }
      }

      for (let i = 0; i < n; i++) {
        velocity[i] = momentum * velocity[i] + learningRate * gradient[i];
        weights[i] += velocity[i];
      }

      weights = this.projectToConstraints(weights, bounds, constraints);
    }

    weights = this.projectToConstraints(weights, bounds, constraints);
    return weights;
  }

  private optimizeForMaxSharpe(
    bounds: Map<string, AssetBounds>,
    constraints: AllocationConstraints
  ): number[] {
    const n = ASSET_CLASSES.length;
    let bestWeights = new Array(n).fill(100 / n);
    let bestSharpe = -Infinity;

    for (let trial = 0; trial < 20; trial++) {
      let weights: number[];

      if (trial === 0) {
        weights = new Array(n).fill(100 / n);
      } else {
        weights = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
          const b = bounds.get(this.assetTypes[i])!;
          weights[i] = b.min + Math.random() * (b.max - b.min);
        }
      }

      weights = this.projectToConstraints(weights, bounds, constraints);

      for (let iter = 0; iter < 200; iter++) {
        const variance = this.calculatePortfolioVariance(weights);
        const volatility = Math.sqrt(variance) * 100;
        const portfolioReturn = this.calculatePortfolioReturn(weights);
        const sharpe = this.calculateSharpeRatio(portfolioReturn, volatility);

        const gradient = new Array(n).fill(0);

        for (let i = 0; i < n; i++) {
          const asset = ASSET_CLASSES[i];
          const returnGrad = asset.expectedReturn;

          let varianceGrad = 0;
          for (let j = 0; j < n; j++) {
            const asset2 = ASSET_CLASSES[j];
            const correlation = CORRELATION_MATRIX[asset.type]?.[asset2.type] ?? 0;
            varianceGrad += (weights[j] / 100) * (asset.volatility / 100) * (asset2.volatility / 100) * correlation;
          }
          varianceGrad *= 2;

          const dSharpeReturn = 1 / (volatility + 1e-8);
          const dSharpeVol = -(portfolioReturn - this.riskFreeRate) / ((volatility * volatility) + 1e-8);
          const volGrad = varianceGrad / (2 * Math.sqrt(variance) + 1e-8) * 100;

          gradient[i] = dSharpeReturn * returnGrad + dSharpeVol * volGrad;
        }

        for (let i = 0; i < n; i++) {
          weights[i] += 0.5 * gradient[i];
        }

        weights = this.projectToConstraints(weights, bounds, constraints);
      }

      const variance = this.calculatePortfolioVariance(weights);
      const volatility = Math.sqrt(variance) * 100;
      const portfolioReturn = this.calculatePortfolioReturn(weights);
      const sharpe = this.calculateSharpeRatio(portfolioReturn, volatility);

      if (sharpe > bestSharpe) {
        bestSharpe = sharpe;
        bestWeights = weights.slice();
      }
    }

    return bestWeights;
  }

  generateEfficientFrontier(input: OptimizationInput, points: number = 11): EfficientFrontierPoint[] {
    const constraints = this.getConstraints(input.riskScore, input.segment);
    const bounds = this.getAssetBounds(constraints, input.segment);

    const minVolWeights = this.optimizeForTargetVolatility(2, bounds, constraints);
    const maxSharpeWeights = this.optimizeForMaxSharpe(bounds, constraints);

    const minVol = Math.sqrt(this.calculatePortfolioVariance(minVolWeights)) * 100;
    const maxVol = Math.sqrt(this.calculatePortfolioVariance(maxSharpeWeights)) * 100;

    const frontier: EfficientFrontierPoint[] = [];
    const volRange = Math.max(maxVol - minVol, 5);

    for (let i = 0; i < points; i++) {
      const targetVol = minVol + (i / (points - 1)) * volRange * 1.5;
      const weights = this.optimizeForTargetVolatility(targetVol, bounds, constraints);

      const variance = this.calculatePortfolioVariance(weights);
      const actualVol = Math.sqrt(variance) * 100;
      const expectedReturn = this.calculatePortfolioReturn(weights);
      const sharpe = this.calculateSharpeRatio(expectedReturn, actualVol);

      const allocations: { [type: string]: number } = {};
      for (let j = 0; j < this.assetTypes.length; j++) {
        if (weights[j] > 0.01) {
          allocations[this.assetTypes[j]] = Math.round(weights[j] * 100) / 100;
        }
      }

      frontier.push({
        expectedReturn: Math.round(expectedReturn * 100) / 100,
        volatility: Math.round(actualVol * 100) / 100,
        sharpeRatio: Math.round(sharpe * 100) / 100,
        allocations
      });
    }

    return frontier;
  }

  optimize(input: OptimizationInput): OptimizationResult {
    const { riskScore, segment, investableAmount, investmentHorizon, goalType } = input;
    const profile = this.getRiskProfile(riskScore);
    const constraints = this.getConstraints(riskScore, segment);
    const bounds = this.getAssetBounds(constraints, input.segment);

    const targetVolatilityMap: { [key: string]: number } = {
      very_conservative: 4,
      conservative: 7,
      moderate: 11,
      moderately_aggressive: 14,
      aggressive: 17,
      very_aggressive: 20
    };

    let targetVol = targetVolatilityMap[profile] || 11;

    if (goalType === 'growth') targetVol *= 1.15;
    if (goalType === 'preservation') targetVol *= 0.75;
    if (goalType === 'income') targetVol *= 0.85;

    const weights = this.optimizeForTargetVolatility(targetVol, bounds, constraints);

    const variance = this.calculatePortfolioVariance(weights);
    const volatility = Math.sqrt(variance) * 100;
    const expectedReturn = this.calculatePortfolioReturn(weights);
    const sharpeRatio = this.calculateSharpeRatio(expectedReturn, volatility);
    const diversificationRatio = this.calculateDiversificationRatio(weights);
    const maxDrawdownEstimate = this.estimateMaxDrawdown(volatility, investmentHorizon);

    const allocationResults: AllocationResult[] = [];

    for (let i = 0; i < weights.length; i++) {
      if (weights[i] > 0.01) {
        const asset = ASSET_CLASSES[i];
        const contribution = (weights[i] / 100) * asset.volatility;

        allocationResults.push({
          assetType: asset.type,
          assetName: asset.name,
          allocation: Math.round(weights[i] * 100) / 100,
          expectedReturn: asset.expectedReturn,
          contributionToRisk: Math.round((contribution / volatility) * 100 * 100) / 100,
          amount: investableAmount ? Math.round(investableAmount * weights[i] / 100) : undefined
        });
      }
    }

    allocationResults.sort((a, b) => b.allocation - a.allocation);

    const efficientFrontier = this.generateEfficientFrontier(input, 11);

    const rationale = this.generateRationale(input, allocationResults, {
      expectedReturn,
      volatility,
      sharpeRatio,
      diversificationRatio,
      maxDrawdownEstimate
    });

    return {
      allocations: allocationResults,
      portfolioMetrics: {
        expectedReturn: Math.round(expectedReturn * 100) / 100,
        volatility: Math.round(volatility * 100) / 100,
        sharpeRatio: Math.round(sharpeRatio * 100) / 100,
        diversificationRatio: Math.round(diversificationRatio * 100) / 100,
        maxDrawdownEstimate: Math.round(maxDrawdownEstimate * 100) / 100
      },
      efficientFrontier,
      riskProfile: profile,
      segment,
      constraints,
      optimizationMethod: 'mean_variance_constrained',
      rationale
    };
  }

  private generateRationale(
    input: OptimizationInput,
    allocations: AllocationResult[],
    metrics: PortfolioMetrics
  ): string[] {
    const rationale: string[] = [];
    const profile = this.getRiskProfile(input.riskScore);
    const equityAllocation = allocations
      .filter(a => EQUITY_TYPES.includes(a.assetType))
      .reduce((sum, a) => sum + a.allocation, 0);
    const debtAllocation = allocations
      .filter(a => DEBT_TYPES.includes(a.assetType))
      .reduce((sum, a) => sum + a.allocation, 0);

    rationale.push(`Based on your risk score of ${input.riskScore}/100, you fall into the "${profile.replace(/_/g, ' ')}" risk category.`);
    rationale.push(`Mean-variance optimization produced a portfolio with ${Math.round(equityAllocation)}% equity and ${Math.round(debtAllocation)}% debt.`);

    if (input.goalType) {
      const goalDescriptions: { [key: string]: string } = {
        growth: 'capital appreciation with higher equity exposure',
        income: 'regular income generation with higher debt allocation',
        preservation: 'capital preservation with emphasis on low-volatility assets',
        balanced: 'a balance between growth and income'
      };
      rationale.push(`The allocation is optimized for ${goalDescriptions[input.goalType]}.`);
    }

    rationale.push(`Expected portfolio return: ${metrics.expectedReturn.toFixed(1)}% with volatility of ${metrics.volatility.toFixed(1)}%.`);
    rationale.push(`Risk-adjusted return (Sharpe ratio): ${metrics.sharpeRatio.toFixed(2)}.`);

    if (input.segment === 'retail') {
      rationale.push(`As a retail investor, complex alternatives are excluded to ensure liquidity and accessibility.`);
    } else if (input.segment === 'bhni' || input.segment === 'shni') {
      rationale.push(`Your HNI status enables access to alternative investments for enhanced diversification.`);
    }

    return rationale;
  }

  getAvailableAssetClasses(segment: string): AssetClass[] {
    return ASSET_CLASSES.map(asset => {
      const adjustedAsset = { ...asset };

      if (segment === 'retail') {
        if (asset.type === 'alternatives') {
          adjustedAsset.maxAllocation = 0;
        }
        if (asset.type === 'real_estate') {
          adjustedAsset.maxAllocation = Math.min(adjustedAsset.maxAllocation, 5);
        }
      }

      return adjustedAsset;
    });
  }

  calculateRebalancingTrades(
    currentAllocations: { [type: string]: number },
    targetAllocations: { [type: string]: number },
    totalValue: number,
    threshold: number = 5
  ): { assetType: string; action: 'buy' | 'sell' | 'hold'; amount: number; percentage: number }[] {
    const trades: { assetType: string; action: 'buy' | 'sell' | 'hold'; amount: number; percentage: number }[] = [];

    const allTypes = Array.from(new Set([...Object.keys(currentAllocations), ...Object.keys(targetAllocations)]));

    for (const type of allTypes) {
      const current = currentAllocations[type] || 0;
      const target = targetAllocations[type] || 0;
      const diff = target - current;

      if (Math.abs(diff) >= threshold) {
        trades.push({
          assetType: type,
          action: diff > 0 ? 'buy' : 'sell',
          amount: Math.round(Math.abs(diff) * totalValue / 100),
          percentage: Math.round(Math.abs(diff) * 100) / 100
        });
      } else if (Math.abs(diff) > 0.1) {
        trades.push({
          assetType: type,
          action: 'hold',
          amount: 0,
          percentage: Math.round(diff * 100) / 100
        });
      }
    }

    return trades.sort((a, b) => b.amount - a.amount);
  }
}

export const assetAllocationOptimizer = new AssetAllocationOptimizer();
