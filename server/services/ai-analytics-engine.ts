import * as ss from 'simple-statistics';

export interface TransactionCostConfig {
  brokerageRate?: number;
  sttRate?: number;
  exchangeChargeRate?: number;
  gstRate?: number;
  sebiChargeRate?: number;
  stampDutyRate?: number;
  slippagePct?: number;
}

export interface TransactionCosts {
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  gst: number;
  sebiCharges: number;
  stampDuty: number;
  slippage: number;
  totalCost: number;
  totalCostPct: number;
}

export class AIAnalyticsEngine {

  computeSharpeRatio(returns: number[], riskFreeRate: number = 0.065): number {
    if (returns.length < 2) return 0;
    const meanReturn = ss.mean(returns);
    const stddev = ss.standardDeviation(returns);
    if (stddev === 0) return 0;
    return (meanReturn * 252 - riskFreeRate) / (stddev * Math.sqrt(252));
  }

  computeSortinoRatio(returns: number[], riskFreeRate: number = 0.065): number {
    if (returns.length < 2) return 0;
    const meanReturn = ss.mean(returns);
    const downsideReturns = returns.filter(r => r < 0);
    if (downsideReturns.length === 0) return 0;
    const downsideDeviation = Math.sqrt(
      ss.mean(downsideReturns.map(r => r * r))
    );
    if (downsideDeviation === 0) return 0;
    return (meanReturn * 252 - riskFreeRate) / (downsideDeviation * Math.sqrt(252));
  }

  computeCAGR(startValue: number, endValue: number, years: number): number {
    if (startValue <= 0 || endValue <= 0 || years <= 0) return 0;
    return Math.pow(endValue / startValue, 1 / years) - 1;
  }

  computeMaxDrawdown(equityCurve: number[]): { maxDrawdown: number; peakIndex: number; troughIndex: number } {
    if (equityCurve.length < 2) return { maxDrawdown: 0, peakIndex: 0, troughIndex: 0 };
    let maxDrawdown = 0;
    let peakIndex = 0;
    let troughIndex = 0;
    let currentPeakIndex = 0;
    let currentPeak = equityCurve[0];

    for (let i = 1; i < equityCurve.length; i++) {
      if (equityCurve[i] > currentPeak) {
        currentPeak = equityCurve[i];
        currentPeakIndex = i;
      }
      const drawdown = (currentPeak - equityCurve[i]) / currentPeak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        peakIndex = currentPeakIndex;
        troughIndex = i;
      }
    }

    return { maxDrawdown, peakIndex, troughIndex };
  }

  computeWinRate(trades: { returnPct: number }[]): number {
    if (trades.length === 0) return 0;
    const wins = trades.filter(t => t.returnPct > 0).length;
    return wins / trades.length;
  }

  computeExpectancy(trades: { returnPct: number }[]): number {
    if (trades.length === 0) return 0;
    const wins = trades.filter(t => t.returnPct > 0);
    const losses = trades.filter(t => t.returnPct <= 0);
    const winRate = wins.length / trades.length;
    const lossRate = 1 - winRate;
    const avgWin = wins.length > 0 ? ss.mean(wins.map(t => t.returnPct)) : 0;
    const avgLoss = losses.length > 0 ? Math.abs(ss.mean(losses.map(t => t.returnPct))) : 0;
    return (winRate * avgWin) - (lossRate * avgLoss);
  }

  computeCalmarRatio(cagr: number, maxDrawdown: number): number {
    if (maxDrawdown === 0) return 0;
    return cagr / maxDrawdown;
  }

  rollingMean(data: number[], window: number): number[] {
    if (data.length === 0 || window <= 0) return [];
    const result: number[] = [];
    for (let i = window - 1; i < data.length; i++) {
      const slice = data.slice(i - window + 1, i + 1);
      result.push(ss.mean(slice));
    }
    return result;
  }

  rollingStdDev(data: number[], window: number): number[] {
    if (data.length === 0 || window <= 1) return [];
    const result: number[] = [];
    for (let i = window - 1; i < data.length; i++) {
      const slice = data.slice(i - window + 1, i + 1);
      result.push(ss.standardDeviation(slice));
    }
    return result;
  }

  zScore(value: number, mean: number, stddev: number): number {
    if (stddev === 0) return 0;
    return (value - mean) / stddev;
  }

  rollingZScore(data: number[], window: number): number[] {
    if (data.length === 0 || window <= 1) return [];
    const result: number[] = [];
    for (let i = window - 1; i < data.length; i++) {
      const slice = data.slice(i - window + 1, i + 1);
      const mean = ss.mean(slice);
      const stddev = ss.standardDeviation(slice);
      result.push(this.zScore(data[i], mean, stddev));
    }
    return result;
  }

  exponentialMovingAverage(data: number[], span: number): number[] {
    if (data.length === 0 || span <= 0) return [];
    const multiplier = 2 / (span + 1);
    const result: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
      const ema = (data[i] - result[i - 1]) * multiplier + result[i - 1];
      result.push(ema);
    }
    return result;
  }

  computeCovarianceMatrix(returnSeries: number[][]): number[][] {
    const n = returnSeries.length;
    if (n === 0) return [];
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const minLen = Math.min(returnSeries[i].length, returnSeries[j].length);
        if (minLen < 2) {
          matrix[i][j] = 0;
          matrix[j][i] = 0;
          continue;
        }
        const seriesI = returnSeries[i].slice(0, minLen);
        const seriesJ = returnSeries[j].slice(0, minLen);
        const meanI = ss.mean(seriesI);
        const meanJ = ss.mean(seriesJ);
        let cov = 0;
        for (let k = 0; k < minLen; k++) {
          cov += (seriesI[k] - meanI) * (seriesJ[k] - meanJ);
        }
        cov /= (minLen - 1);
        matrix[i][j] = cov;
        matrix[j][i] = cov;
      }
    }
    return matrix;
  }

  computeCorrelationMatrix(returnSeries: number[][]): number[][] {
    const n = returnSeries.length;
    if (n === 0) return [];
    const covMatrix = this.computeCovarianceMatrix(returnSeries);
    const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          const stdI = Math.sqrt(Math.max(covMatrix[i][i], 0));
          const stdJ = Math.sqrt(Math.max(covMatrix[j][j], 0));
          if (stdI === 0 || stdJ === 0) {
            matrix[i][j] = 0;
            matrix[j][i] = 0;
          } else {
            const corr = covMatrix[i][j] / (stdI * stdJ);
            matrix[i][j] = Math.max(-1, Math.min(1, corr));
            matrix[j][i] = matrix[i][j];
          }
        }
      }
    }
    return matrix;
  }

  computePortfolioVariance(weights: number[], covMatrix: number[][]): number {
    const n = weights.length;
    if (n === 0 || covMatrix.length !== n) return 0;
    let variance = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += weights[i] * weights[j] * (covMatrix[i]?.[j] ?? 0);
      }
    }
    return variance;
  }

  pricesToReturns(prices: number[]): number[] {
    if (prices.length < 2) return [];
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] <= 0) {
        returns.push(0);
      } else {
        returns.push(Math.log(prices[i] / prices[i - 1]));
      }
    }
    return returns;
  }

  pricesToSimpleReturns(prices: number[]): number[] {
    if (prices.length < 2) return [];
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] === 0) {
        returns.push(0);
      } else {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
    }
    return returns;
  }

  annualizeReturn(dailyReturn: number, tradingDays: number = 252): number {
    return Math.pow(1 + dailyReturn, tradingDays) - 1;
  }

  annualizeVolatility(dailyStdDev: number, tradingDays: number = 252): number {
    return dailyStdDev * Math.sqrt(tradingDays);
  }

  computeVolatilityClustering(
    returns: number[],
    shortWindow: number = 10,
    longWindow: number = 60
  ): { currentVol: number; avgVol: number; volRatio: number; zScore: number } {
    if (returns.length < longWindow) {
      return { currentVol: 0, avgVol: 0, volRatio: 0, zScore: 0 };
    }
    const recentReturns = returns.slice(-shortWindow);
    const currentVol = ss.standardDeviation(recentReturns) * Math.sqrt(252);

    const rollingVols: number[] = [];
    for (let i = shortWindow - 1; i < returns.length; i++) {
      const slice = returns.slice(i - shortWindow + 1, i + 1);
      rollingVols.push(ss.standardDeviation(slice) * Math.sqrt(252));
    }

    const longVols = rollingVols.slice(-longWindow);
    const avgVol = longVols.length > 0 ? ss.mean(longVols) : 0;
    const volStdDev = longVols.length > 1 ? ss.standardDeviation(longVols) : 0;
    const volRatio = avgVol === 0 ? 0 : currentVol / avgVol;
    const zScoreVal = this.zScore(currentVol, avgVol, volStdDev);

    return { currentVol, avgVol, volRatio, zScore: zScoreVal };
  }

  computeTrendStrength(
    prices: number[],
    window: number = 50
  ): { slope: number; r2: number; direction: 'up' | 'down' | 'flat' } {
    if (prices.length < 2) return { slope: 0, r2: 0, direction: 'flat' };
    const usePrices = prices.slice(-window);
    const logPrices = usePrices.map(p => (p > 0 ? Math.log(p) : 0));
    const points: [number, number][] = logPrices.map((lp, i) => [i, lp]);

    const regression = ss.linearRegression(points);
    const regressionLine = ss.linearRegressionLine(regression);
    const r2 = ss.rSquared(points, regressionLine);
    const slope = regression.m;

    let direction: 'up' | 'down' | 'flat' = 'flat';
    if (slope > 0.0001 && r2 > 0.3) direction = 'up';
    else if (slope < -0.0001 && r2 > 0.3) direction = 'down';

    return { slope, r2, direction };
  }

  computeMomentum(
    prices: number[],
    periods: number[] = [5, 10, 20, 50]
  ): { momentum: Record<number, number>; avgMomentum: number } {
    const momentum: Record<number, number> = {};
    const values: number[] = [];

    for (const period of periods) {
      if (prices.length <= period || prices[prices.length - 1 - period] === 0) {
        momentum[period] = 0;
      } else {
        const current = prices[prices.length - 1];
        const past = prices[prices.length - 1 - period];
        const mom = (current - past) / past;
        momentum[period] = mom;
        values.push(mom);
      }
    }

    const avgMomentum = values.length > 0 ? ss.mean(values) : 0;
    return { momentum, avgMomentum };
  }

  computeAdvanceDeclineRatio(advances: number, declines: number): number {
    if (declines === 0) return advances > 0 ? Infinity : 0;
    return advances / declines;
  }

  computeTransactionCosts(tradeValue: number, config?: TransactionCostConfig): TransactionCosts {
    const brokerageRate = config?.brokerageRate ?? 0.0003;
    const sttRate = config?.sttRate ?? 0.001;
    const exchangeChargeRate = config?.exchangeChargeRate ?? 0.0000345;
    const gstRate = config?.gstRate ?? 0.18;
    const sebiChargeRate = config?.sebiChargeRate ?? 0.000001;
    const stampDutyRate = config?.stampDutyRate ?? 0.00015;
    const slippagePct = config?.slippagePct ?? 0.001;

    const absValue = Math.abs(tradeValue);
    const brokerage = absValue * brokerageRate;
    const stt = absValue * sttRate;
    const exchangeCharges = absValue * exchangeChargeRate;
    const gst = brokerage * gstRate;
    const sebiCharges = absValue * sebiChargeRate;
    const stampDuty = absValue * stampDutyRate;
    const slippage = absValue * slippagePct;

    const totalCost = brokerage + stt + exchangeCharges + gst + sebiCharges + stampDuty + slippage;
    const totalCostPct = absValue === 0 ? 0 : totalCost / absValue;

    return {
      brokerage,
      stt,
      exchangeCharges,
      gst,
      sebiCharges,
      stampDuty,
      slippage,
      totalCost,
      totalCostPct,
    };
  }
}

export const aiAnalyticsEngine = new AIAnalyticsEngine();
