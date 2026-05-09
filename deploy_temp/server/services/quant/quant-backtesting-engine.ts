export interface BacktestConfig {
  windowYears: number;
  rollingStepDays: number;
  riskFreeRate: number;
  benchmarkReturn: number;
}

export interface BacktestResult {
  sharpeRatio: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  maxDrawdown: number;
  turnover: number;
  informationRatio: number;
  trackingError: number;
  calmarRatio: number;
  sortinoRatio: number;
  winRate: number;
  totalPeriods: number;
  volatilityReduction: number;
  passed: boolean;
  failReasons: string[];
}

const DEFAULT_CONFIG: BacktestConfig = {
  windowYears: 3,
  rollingStepDays: 30,
  riskFreeRate: 0.0715, // India 10Y G-Sec as of Mar 2026 — update periodically
  benchmarkReturn: 0.12,
};

const PROMOTION_THRESHOLDS = {
  minSharpe: 0.3,
  minROCAUC: 0.65,
  minPrecision: 0.60,
  maxFalsePositiveRate: 0.35,
  maxTurnoverIncrease: 0.15,
  maxDrawdown: -0.25,
  minWinRate: 0.45,
};

class QuantBacktestingEngine {
  runWeightBacktest(
    weights: Record<string, number>,
    categoryReturns: Record<string, number[]>,
    config: Partial<BacktestConfig> = {}
  ): BacktestResult {
    const fullConfig = { ...DEFAULT_CONFIG, ...config };
    const categories = Object.keys(weights);
    const failReasons: string[] = [];

    const minLen = categories.length === 0
      ? 0
      : Math.min(...categories.map(c => (categoryReturns[c] || []).length));
    const periods = Math.max(minLen, 36);

    const portfolioReturns: number[] = [];
    for (let t = 0; t < periods; t++) {
      let periodReturn = 0;
      for (const cat of categories) {
        const w = weights[cat] || 0;
        const ret = (categoryReturns[cat] || [])[t] ?? this.getDefaultMonthlyReturn(cat);
        periodReturn += w * ret;
      }
      portfolioReturns.push(periodReturn);
    }

    const annualizedReturn = this.annualizeMonthlyReturns(portfolioReturns);
    const annualizedVolatility = this.annualizeMonthlyVolatility(portfolioReturns);
    const sharpeRatio = annualizedVolatility > 0
      ? (annualizedReturn - fullConfig.riskFreeRate) / annualizedVolatility
      : 0;

    const maxDrawdown = this.computeMaxDrawdown(portfolioReturns);
    const turnover = this.estimateTurnover(weights, categories);

    const excessReturns = portfolioReturns.map(r => r - fullConfig.benchmarkReturn / 12);
    const trackingError = this.computeStdDev(excessReturns) * Math.sqrt(12);
    const informationRatio = trackingError > 0
      ? (annualizedReturn - fullConfig.benchmarkReturn) / trackingError
      : 0;

    // Sortino denominator: semi-deviation of returns BELOW the monthly MAR (= Rf / 12).
    // Standard formula: sqrt(mean of squared below-MAR deviations over ALL periods) × sqrt(12).
    // Using total periods (not just bad months) correctly penalises frequent below-MAR outcomes.
    const monthlyRf = fullConfig.riskFreeRate / 12;
    const squaredBelowMAR = portfolioReturns.map(r => {
      const excess = r - monthlyRf;
      return excess < 0 ? excess * excess : 0;
    });
    const downsideVariance = squaredBelowMAR.reduce((s, v) => s + v, 0) / Math.max(portfolioReturns.length, 1);
    const downside = Math.sqrt(downsideVariance) * Math.sqrt(12) || 0.001;
    const sortinoRatio = (annualizedReturn - fullConfig.riskFreeRate) / downside;

    const calmarRatio = maxDrawdown < 0
      ? annualizedReturn / Math.abs(maxDrawdown)
      : annualizedReturn;

    const winRate = portfolioReturns.filter(r => r > 0).length / Math.max(portfolioReturns.length, 1);
    const volatilityReduction = 1 - annualizedVolatility / 0.15;

    if (sharpeRatio < PROMOTION_THRESHOLDS.minSharpe) failReasons.push(`Sharpe ${sharpeRatio.toFixed(3)} < ${PROMOTION_THRESHOLDS.minSharpe}`);
    if (maxDrawdown < PROMOTION_THRESHOLDS.maxDrawdown) failReasons.push(`MaxDD ${(maxDrawdown * 100).toFixed(1)}% < ${(PROMOTION_THRESHOLDS.maxDrawdown * 100)}%`);
    if (winRate < PROMOTION_THRESHOLDS.minWinRate) failReasons.push(`WinRate ${(winRate * 100).toFixed(1)}% < ${(PROMOTION_THRESHOLDS.minWinRate * 100)}%`);

    return {
      sharpeRatio,
      annualizedReturn,
      annualizedVolatility,
      maxDrawdown,
      turnover,
      informationRatio,
      trackingError,
      calmarRatio,
      sortinoRatio,
      winRate,
      totalPeriods: periods,
      volatilityReduction,
      passed: failReasons.length === 0,
      failReasons,
    };
  }

  runDriftModelBacktest(
    predictions: Array<{ predicted: boolean; actual: boolean; probability: number }>,
  ): BacktestResult & { rocAuc: number; precision: number; recall: number; falsePositiveRate: number } {
    const failReasons: string[] = [];

    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (const p of predictions) {
      if (p.predicted && p.actual) tp++;
      else if (p.predicted && !p.actual) fp++;
      else if (!p.predicted && p.actual) fn++;
      else tn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const falsePositiveRate = fp + tn > 0 ? fp / (fp + tn) : 0;

    const rocAuc = this.computeApproxROCAUC(predictions);

    if (rocAuc < PROMOTION_THRESHOLDS.minROCAUC) failReasons.push(`ROC-AUC ${rocAuc.toFixed(3)} < ${PROMOTION_THRESHOLDS.minROCAUC}`);
    if (precision < PROMOTION_THRESHOLDS.minPrecision) failReasons.push(`Precision ${precision.toFixed(3)} < ${PROMOTION_THRESHOLDS.minPrecision}`);
    if (falsePositiveRate > PROMOTION_THRESHOLDS.maxFalsePositiveRate) failReasons.push(`FPR ${falsePositiveRate.toFixed(3)} > ${PROMOTION_THRESHOLDS.maxFalsePositiveRate}`);

    return {
      sharpeRatio: 0,
      annualizedReturn: 0,
      annualizedVolatility: 0,
      maxDrawdown: 0,
      turnover: 0,
      informationRatio: 0,
      trackingError: 0,
      calmarRatio: 0,
      sortinoRatio: 0,
      winRate: precision,
      totalPeriods: predictions.length,
      volatilityReduction: 0,
      passed: failReasons.length === 0,
      failReasons,
      rocAuc,
      precision,
      recall,
      falsePositiveRate,
    };
  }

  validateWeightStability(
    oldWeights: Record<string, number>,
    newWeights: Record<string, number>
  ): { turnoverIncrease: number; passed: boolean; failReason: string | null } {
    const categories = [...new Set([...Object.keys(oldWeights), ...Object.keys(newWeights)])];
    let turnover = 0;
    for (const cat of categories) {
      turnover += Math.abs((newWeights[cat] || 0) - (oldWeights[cat] || 0));
    }
    const turnoverIncrease = turnover / 2;
    const passed = turnoverIncrease <= PROMOTION_THRESHOLDS.maxTurnoverIncrease;
    return {
      turnoverIncrease,
      passed,
      failReason: passed ? null : `Turnover increase ${(turnoverIncrease * 100).toFixed(1)}% > ${(PROMOTION_THRESHOLDS.maxTurnoverIncrease * 100)}%`,
    };
  }

  private computeApproxROCAUC(
    predictions: Array<{ predicted: boolean; actual: boolean; probability: number }>
  ): number {
    if (predictions.length === 0) return 0.5;

    const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
    const totalPositive = sorted.filter(p => p.actual).length;
    const totalNegative = sorted.length - totalPositive;

    if (totalPositive === 0 || totalNegative === 0) return 0.5;

    let auc = 0;
    let tpCount = 0;
    let fpCount = 0;

    for (const pred of sorted) {
      if (pred.actual) {
        tpCount++;
      } else {
        fpCount++;
        auc += tpCount;
      }
    }

    return auc / (totalPositive * totalNegative);
  }

  private annualizeMonthlyReturns(monthlyReturns: number[]): number {
    if (monthlyReturns.length === 0) return 0;
    const avgMonthly = monthlyReturns.reduce((s, r) => s + r, 0) / monthlyReturns.length;
    return Math.pow(1 + avgMonthly, 12) - 1;
  }

  private annualizeMonthlyVolatility(monthlyReturns: number[]): number {
    return this.computeStdDev(monthlyReturns) * Math.sqrt(12);
  }

  private computeStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  private computeMaxDrawdown(returns: number[]): number {
    let cumulative = 1;
    let peak = 1;
    let maxDD = 0;

    for (const r of returns) {
      cumulative *= (1 + r);
      peak = Math.max(peak, cumulative);
      const dd = (cumulative - peak) / peak;
      maxDD = Math.min(maxDD, dd);
    }

    return maxDD;
  }

  private estimateTurnover(weights: Record<string, number>, categories: string[]): number {
    let sum = 0;
    const equalWeight = 1 / Math.max(categories.length, 1);
    for (const cat of categories) {
      sum += Math.abs((weights[cat] || 0) - equalWeight);
    }
    return sum / 2;
  }

  private getDefaultMonthlyReturn(category: string): number {
    // Monthly returns consistent with current yield environment (India 10Y G-Sec 7.15%, Mar 2026).
    // Debt/bonds: ~7.4% p.a. → 0.006/month. Equity: ~12% p.a. → 0.01/month.
    const defaults: Record<string, number> = {
      equity: 0.01, debt: 0.0060, hybrid: 0.0075, gold: 0.006,
      silver: 0.005, index: 0.009, etf: 0.008, international: 0.007,
      listed_stocks: 0.011, unlisted_stocks: 0.012, reit: 0.006,
      invit: 0.0055, bonds: 0.0060, mld: 0.0065, pms: 0.01, aif: 0.01,
    };
    return defaults[category] || 0.007;
  }
}

export const quantBacktestingEngine = new QuantBacktestingEngine();
