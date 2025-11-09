import { subDays, subMonths, subYears, format, parseISO } from 'date-fns';
import { logger } from './logger';
import yahooFinance from 'yahoo-finance2';

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

export interface NormalizedDataPoint {
  date: string;
  percentChange: number;
  value: number;
}

export interface ComparisonData {
  symbol: string;
  name: string;
  data: NormalizedDataPoint[];
  currentPrice: number;
  totalReturn: number;
  volatility: number;
}

export interface PerformanceMetrics {
  symbol: string;
  returns: {
    absolute: number;
    percentage: number;
  };
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export class ChartService {
  /**
   * Calculate date range based on preset or custom dates
   */
  private getDateRange(
    rangeType: string,
    customStartDate?: string,
    customEndDate?: string
  ): { startDate: Date; endDate: Date } {
    const endDate = customEndDate ? parseISO(customEndDate) : new Date();
    let startDate: Date;

    if (rangeType === 'custom' && customStartDate) {
      startDate = parseISO(customStartDate);
    } else {
      switch (rangeType) {
        case '1M':
          startDate = subMonths(endDate, 1);
          break;
        case '3M':
          startDate = subMonths(endDate, 3);
          break;
        case '6M':
          startDate = subMonths(endDate, 6);
          break;
        case '1Y':
          startDate = subYears(endDate, 1);
          break;
        case '3Y':
          startDate = subYears(endDate, 3);
          break;
        case '5Y':
          startDate = subYears(endDate, 5);
          break;
        default:
          startDate = subYears(endDate, 1); // Default to 1 year
      }
    }

    return { startDate, endDate };
  }

  /**
   * Fetch historical data for a single symbol
   */
  async fetchHistoricalData(
    symbol: string,
    rangeType: string,
    customStartDate?: string,
    customEndDate?: string
  ): Promise<HistoricalDataPoint[]> {
    try {
      const { startDate, endDate } = this.getDateRange(rangeType, customStartDate, customEndDate);

      logger.info('[Chart Service] Fetching historical data', {
        symbol,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        rangeType,
      });

      // Use Yahoo Finance for historical data
      const historical = await yahooFinance.historical(symbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      });

      return historical.map((item: any) => ({
        date: format(new Date(item.date), 'yyyy-MM-dd'),
        open: item.open || 0,
        high: item.high || 0,
        low: item.low || 0,
        close: item.close || 0,
        volume: item.volume || 0,
        adjClose: item.adjClose,
      }));
    } catch (error) {
      logger.error('[Chart Service] Error fetching historical data', {
        symbol,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to fetch historical data for ${symbol}`);
    }
  }

  /**
   * Normalize data to percentage change for comparison
   */
  private normalizeData(data: HistoricalDataPoint[]): NormalizedDataPoint[] {
    if (data.length === 0) return [];

    const basePrice = data[0].close;

    return data.map((point) => ({
      date: point.date,
      value: point.close,
      percentChange: ((point.close - basePrice) / basePrice) * 100,
    }));
  }

  /**
   * Calculate performance metrics for a symbol
   */
  private calculatePerformanceMetrics(data: HistoricalDataPoint[]): PerformanceMetrics {
    if (data.length === 0) {
      return {
        symbol: '',
        returns: { absolute: 0, percentage: 0 },
        volatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
      };
    }

    const startPrice = data[0].close;
    const endPrice = data[data.length - 1].close;

    // Calculate returns
    const absoluteReturn = endPrice - startPrice;
    const percentageReturn = (absoluteReturn / startPrice) * 100;

    // Calculate daily returns for volatility
    const dailyReturns = [];
    for (let i = 1; i < data.length; i++) {
      const dailyReturn = (data[i].close - data[i - 1].close) / data[i - 1].close;
      dailyReturns.push(dailyReturn);
    }

    // Calculate volatility (annualized standard deviation)
    const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const variance =
      dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance * 252) * 100; // Annualized

    // Calculate Sharpe Ratio (assuming 5% risk-free rate)
    const riskFreeRate = 0.05;
    const excessReturn = percentageReturn / 100 - riskFreeRate;
    const sharpeRatio = volatility > 0 ? excessReturn / (volatility / 100) : 0;

    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = data[0].close;
    for (const point of data) {
      if (point.close > peak) {
        peak = point.close;
      }
      const drawdown = ((point.close - peak) / peak) * 100;
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      symbol: '',
      returns: {
        absolute: absoluteReturn,
        percentage: percentageReturn,
      },
      volatility,
      sharpeRatio,
      maxDrawdown,
    };
  }

  /**
   * Fetch and compare multiple symbols
   */
  async compareSymbols(
    symbols: string[],
    rangeType: string,
    customStartDate?: string,
    customEndDate?: string
  ): Promise<{
    comparison: ComparisonData[];
    metrics: PerformanceMetrics[];
    correlation: number[][];
  }> {
    try {
      logger.info('[Chart Service] Comparing symbols', { symbols, rangeType });

      // Fetch historical data for all symbols in parallel
      const historicalDataPromises = symbols.map((symbol) =>
        this.fetchHistoricalData(symbol, rangeType, customStartDate, customEndDate)
      );

      const historicalDataResults = await Promise.allSettled(historicalDataPromises);

      // Process successful results
      const comparison: ComparisonData[] = [];
      const metrics: PerformanceMetrics[] = [];
      const allNormalizedData: NormalizedDataPoint[][] = [];

      for (let i = 0; i < symbols.length; i++) {
        const result = historicalDataResults[i];
        const symbol = symbols[i];

        if (result.status === 'fulfilled' && result.value.length > 0) {
          const data = result.value;
          const normalizedData = this.normalizeData(data);
          const performanceMetrics = this.calculatePerformanceMetrics(data);

          const currentPrice = data[data.length - 1].close;
          const totalReturn = performanceMetrics.returns.percentage;

          comparison.push({
            symbol,
            name: symbol, // In production, fetch actual company name
            data: normalizedData,
            currentPrice,
            totalReturn,
            volatility: performanceMetrics.volatility,
          });

          metrics.push({
            ...performanceMetrics,
            symbol,
          });

          allNormalizedData.push(normalizedData);
        } else {
          logger.warn('[Chart Service] Failed to fetch data for symbol', {
            symbol,
            error: result.status === 'rejected' ? result.reason : 'No data',
          });
        }
      }

      // Calculate correlation matrix
      const correlation = this.calculateCorrelationMatrix(allNormalizedData);

      return {
        comparison,
        metrics,
        correlation,
      };
    } catch (error) {
      logger.error('[Chart Service] Error comparing symbols', {
        symbols,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Calculate correlation matrix between multiple time series
   */
  private calculateCorrelationMatrix(dataSets: NormalizedDataPoint[][]): number[][] {
    const n = dataSets.length;
    const correlation: number[][] = Array(n)
      .fill(0)
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          correlation[i][j] = 1;
        } else if (i < j) {
          correlation[i][j] = this.calculateCorrelation(dataSets[i], dataSets[j]);
          correlation[j][i] = correlation[i][j]; // Symmetric matrix
        }
      }
    }

    return correlation;
  }

  /**
   * Calculate correlation coefficient between two time series
   */
  private calculateCorrelation(data1: NormalizedDataPoint[], data2: NormalizedDataPoint[]): number {
    if (data1.length !== data2.length || data1.length === 0) {
      return 0;
    }

    const n = data1.length;
    const values1 = data1.map((d) => d.percentChange);
    const values2 = data2.map((d) => d.percentChange);

    const mean1 = values1.reduce((sum, v) => sum + v, 0) / n;
    const mean2 = values2.reduce((sum, v) => sum + v, 0) / n;

    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Calculate technical indicators (SMA, EMA, RSI, etc.)
   */
  calculateIndicators(
    data: HistoricalDataPoint[],
    indicatorSettings: Array<{ type: string; params: Record<string, any> }>
  ): Record<string, any[]> {
    const indicators: Record<string, any[]> = {};

    for (const setting of indicatorSettings) {
      switch (setting.type) {
        case 'sma':
          indicators[`sma_${setting.params.period}`] = this.calculateSMA(
            data,
            setting.params.period
          );
          break;
        case 'ema':
          indicators[`ema_${setting.params.period}`] = this.calculateEMA(
            data,
            setting.params.period
          );
          break;
        case 'rsi':
          indicators.rsi = this.calculateRSI(data, setting.params.period || 14);
          break;
        case 'macd':
          indicators.macd = this.calculateMACD(data);
          break;
        case 'bollinger':
          indicators.bollinger = this.calculateBollingerBands(data, setting.params.period || 20);
          break;
      }
    }

    return indicators;
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(data: HistoricalDataPoint[], period: number): number[] {
    const sma: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        sma.push(NaN);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  }

  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(data: HistoricalDataPoint[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // Start with SMA for first value
    let prevEMA = data.slice(0, period).reduce((acc, d) => acc + d.close, 0) / period;
    ema.push(...Array(period - 1).fill(NaN));
    ema.push(prevEMA);

    for (let i = period; i < data.length; i++) {
      const currentEMA = (data[i].close - prevEMA) * multiplier + prevEMA;
      ema.push(currentEMA);
      prevEMA = currentEMA;
    }

    return ema;
  }

  /**
   * Calculate Relative Strength Index
   */
  private calculateRSI(data: HistoricalDataPoint[], period: number = 14): number[] {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }

    // Calculate RSI
    rsi.push(NaN); // First value is undefined
    for (let i = 0; i < gains.length; i++) {
      if (i < period - 1) {
        rsi.push(NaN);
      } else {
        const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsiValue = 100 - 100 / (1 + rs);
        rsi.push(rsiValue);
      }
    }

    return rsi;
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  private calculateMACD(data: HistoricalDataPoint[]): any {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    const macdLine = ema12.map((val, i) => (isNaN(val) || isNaN(ema26[i]) ? NaN : val - ema26[i]));

    // Signal line is 9-day EMA of MACD line
    const macdData: HistoricalDataPoint[] = macdLine.map((val, i) => ({
      ...data[i],
      close: val,
    }));
    const signalLine = this.calculateEMA(macdData, 9);

    const histogram = macdLine.map((val, i) =>
      isNaN(val) || isNaN(signalLine[i]) ? NaN : val - signalLine[i]
    );

    return {
      macd: macdLine,
      signal: signalLine,
      histogram,
    };
  }

  /**
   * Calculate Bollinger Bands
   */
  private calculateBollingerBands(data: HistoricalDataPoint[], period: number = 20): any {
    const sma = this.calculateSMA(data, period);
    const upperBand: number[] = [];
    const lowerBand: number[] = [];

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        upperBand.push(NaN);
        lowerBand.push(NaN);
      } else {
        const slice = data.slice(i - period + 1, i + 1);
        const mean = sma[i];
        const variance =
          slice.reduce((acc, d) => acc + Math.pow(d.close - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        upperBand.push(mean + 2 * stdDev);
        lowerBand.push(mean - 2 * stdDev);
      }
    }

    return {
      middle: sma,
      upper: upperBand,
      lower: lowerBand,
    };
  }
}

export const chartService = new ChartService();
