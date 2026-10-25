/**
 * HistoricalPerformanceService
 * FintekPro Time-Series Performance Analytics & Backtesting Engine (GCR v1.0)
 *
 * Responsibilities:
 * 1. Store and query daily OHLCV and NAV time-series across equities, funds, bonds, and indices
 * 2. Calculate deterministic performance metrics (1D, 1W, 1M, 3M, 1Y, 3Y, 5Y, CAGR, Sharpe, Drawdown)
 * 3. Benchmark comparative analysis against market indices (^NSEI / NIFTY 50)
 * 4. FASP Financial Logic Integrity: Every calculation outputs engine_version, calculation_timestamp,
 *    and an explainability audit payload (formula, inputs, steps)
 */

import { db } from "../../db";
import {
  historicalMarketPrices,
  instrumentPerformanceMetrics,
  type HistoricalMarketPrice,
  type InsertHistoricalMarketPrice,
  type InstrumentPerformanceMetrics,
} from "@shared/schema";
import { eq, and, desc, gte, lte, asc, sql } from "drizzle-orm";
import { logger } from "../../logger";

export interface PerformanceCalculationResult {
  isin: string;
  symbol?: string;
  benchmarkIsin: string;
  currentPrice: number;
  periodStats: {
    return1D?: number;
    return1W?: number;
    return1M?: number;
    return3M?: number;
    return6M?: number;
    return1Y?: number;
    return3Y?: number;
    return5Y?: number;
    cagr?: number;
  };
  riskMetrics: {
    volatility?: number;
    sharpeRatio?: number;
    sortinoRatio?: number;
    maxDrawdown?: number;
    beta?: number;
    alpha?: number;
  };
  explainability: {
    engine_version: string;
    calculation_timestamp: string;
    risk_free_rate_percent: number;
    formulas_applied: Record<string, string>;
    inputs_used: Record<string, any>;
    intermediate_steps: string[];
  };
}

export class HistoricalPerformanceService {
  private static instance: HistoricalPerformanceService;
  private readonly ENGINE_VERSION = "GCR-1.0";
  private readonly RISK_FREE_RATE = 0.07; // 7.0% RBI benchmark 10Y G-Sec yield

  private constructor() {}

  public static getInstance(): HistoricalPerformanceService {
    if (!HistoricalPerformanceService.instance) {
      HistoricalPerformanceService.instance = new HistoricalPerformanceService();
    }
    return HistoricalPerformanceService.instance;
  }

  /**
   * Ingest a batch of daily candles or NAV points into historical_market_prices
   */
  public async ingestHistoricalPrices(
    prices: InsertHistoricalMarketPrice[]
  ): Promise<number> {
    if (!prices.length) return 0;
    const startTime = Date.now();

    try {
      // Chunk insertions in batches of 500
      const batchSize = 500;
      let insertedCount = 0;

      for (let i = 0; i < prices.length; i += batchSize) {
        const chunk = prices.slice(i, i + batchSize);
        await db
          .insert(historicalMarketPrices)
          .values(chunk)
          .onConflictDoUpdate({
            target: [historicalMarketPrices.isin, historicalMarketPrices.priceDate],
            set: {
              open: sql`EXCLUDED.open`,
              high: sql`EXCLUDED.high`,
              low: sql`EXCLUDED.low`,
              close: sql`EXCLUDED.close`,
              adjClose: sql`EXCLUDED.adj_close`,
              volume: sql`EXCLUDED.volume`,
              change: sql`EXCLUDED.change`,
              changePercent: sql`EXCLUDED.change_percent`,
              dataSource: sql`EXCLUDED.data_source`,
            },
          });
        insertedCount += chunk.length;
      }

      logger.info("Historical prices ingested", {
        event: "HISTORICAL_PRICES_INGESTED",
        count: insertedCount,
        latency_ms: Date.now() - startTime,
        status: "success",
      });

      return insertedCount;
    } catch (error: any) {
      logger.error("Error ingesting historical prices", {
        event: "HISTORICAL_PRICES_INGEST_ERROR",
        error: error?.message,
        latency_ms: Date.now() - startTime,
        status: "error",
      });
      throw error;
    }
  }

  /**
   * Fetch historical series for charting & backtesting
   */
  public async getPriceSeries(
    isin: string,
    startDate?: string,
    endDate?: string,
    limit: number = 1000
  ): Promise<HistoricalMarketPrice[]> {
    try {
      const conditions = [eq(historicalMarketPrices.isin, isin)];
      if (startDate) {
        conditions.push(gte(historicalMarketPrices.priceDate, startDate));
      }
      if (endDate) {
        conditions.push(lte(historicalMarketPrices.priceDate, endDate));
      }

      return await db
        .select()
        .from(historicalMarketPrices)
        .where(and(...conditions))
        .orderBy(asc(historicalMarketPrices.priceDate))
        .limit(limit);
    } catch (error: any) {
      logger.error("Error fetching price series", {
        event: "GET_PRICE_SERIES_ERROR",
        isin,
        error: error?.message,
      });
      return [];
    }
  }

  /**
   * Deterministically calculate performance and risk metrics for an instrument
   * Complies with GCR Financial Logic Integrity:
   * Same input -> same output ALWAYS. Full explainability exposed.
   */
  public async calculatePerformanceMetrics(
    isin: string,
    benchmarkIsin: string = "^NSEI"
  ): Promise<PerformanceCalculationResult | null> {
    const startTime = Date.now();
    const history = await this.getPriceSeries(isin);
    if (history.length < 2) return null;

    const benchmarkHistory = await this.getPriceSeries(benchmarkIsin);
    const benchmarkMap = new Map(
      benchmarkHistory.map((b) => [b.priceDate, Number(b.close)])
    );

    const latest = history[history.length - 1];
    const latestPrice = Number(latest.close);

    // Calculate standard periods
    const return1D = this.calculatePeriodReturn(history, 1);
    const return1W = this.calculatePeriodReturn(history, 5);
    const return1M = this.calculatePeriodReturn(history, 21);
    const return3M = this.calculatePeriodReturn(history, 63);
    const return6M = this.calculatePeriodReturn(history, 126);
    const return1Y = this.calculatePeriodReturn(history, 252);
    const return3Y = this.calculatePeriodReturn(history, 756);
    const return5Y = this.calculatePeriodReturn(history, 1260);

    // CAGR (for longest available period > 1 year)
    let cagr: number | undefined;
    if (history.length >= 252) {
      const oldest = history[0];
      const oldestPrice = Number(oldest.close);
      const days = (new Date(latest.priceDate).getTime() - new Date(oldest.priceDate).getTime()) / (1000 * 3600 * 24);
      if (days >= 365 && oldestPrice > 0) {
        const years = days / 365.25;
        cagr = (Math.pow(latestPrice / oldestPrice, 1 / years) - 1) * 100;
        cagr = Math.round(cagr * 100) / 100;
      }
    }

    // Daily returns array for risk analytics
    const dailyReturns: number[] = [];
    const benchmarkDailyReturns: number[] = [];

    for (let i = 1; i < history.length; i++) {
      const prev = Number(history[i - 1].close);
      const curr = Number(history[i].close);
      const r = (curr - prev) / prev;
      dailyReturns.push(r);

      const bPrev = benchmarkMap.get(history[i - 1].priceDate);
      const bCurr = benchmarkMap.get(history[i].priceDate);
      if (bPrev && bCurr && bPrev > 0) {
        benchmarkDailyReturns.push((bCurr - bPrev) / bPrev);
      }
    }

    // Volatility (Annualized standard deviation of daily returns)
    let volatility: number | undefined;
    let sharpeRatio: number | undefined;
    let sortinoRatio: number | undefined;
    let maxDrawdown: number | undefined;
    let beta: number | undefined;
    let alpha: number | undefined;

    if (dailyReturns.length >= 20) {
      const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (dailyReturns.length - 1);
      const dailyStdDev = Math.sqrt(variance);
      volatility = dailyStdDev * Math.sqrt(252) * 100; // Annualized %

      // Sharpe Ratio: (Annualized Return - Rf) / Annualized Volatility
      const annualizedReturn = mean * 252;
      const annualizedRf = this.RISK_FREE_RATE;
      if (volatility > 0) {
        sharpeRatio = (annualizedReturn - annualizedRf) / (volatility / 100);
        sharpeRatio = Math.round(sharpeRatio * 100) / 100;
      }

      // Max Drawdown
      let peak = -Infinity;
      let maxDd = 0;
      for (const p of history) {
        const close = Number(p.close);
        if (close > peak) peak = close;
        const dd = (peak - close) / peak;
        if (dd > maxDd) maxDd = dd;
      }
      maxDrawdown = Math.round(maxDd * 10000) / 100; // in %

      // Beta calculation against benchmark
      if (benchmarkDailyReturns.length === dailyReturns.length && benchmarkDailyReturns.length >= 30) {
        const bMean = benchmarkDailyReturns.reduce((a, b) => a + b, 0) / benchmarkDailyReturns.length;
        let cov = 0;
        let bVar = 0;
        for (let i = 0; i < dailyReturns.length; i++) {
          cov += (dailyReturns[i] - mean) * (benchmarkDailyReturns[i] - bMean);
          bVar += Math.pow(benchmarkDailyReturns[i] - bMean, 2);
        }
        if (bVar > 0) {
          beta = Math.round((cov / bVar) * 100) / 100;
          const annualizedBenchmark = bMean * 252;
          alpha = Math.round((annualizedReturn - (annualizedRf + beta * (annualizedBenchmark - annualizedRf))) * 10000) / 100;
        }
      }
    }

    const calculationTimestamp = new Date().toISOString();
    const result: PerformanceCalculationResult = {
      isin,
      symbol: latest.symbol || undefined,
      benchmarkIsin,
      currentPrice: latestPrice,
      periodStats: {
        return1D,
        return1W,
        return1M,
        return3M,
        return6M,
        return1Y,
        return3Y,
        return5Y,
        cagr,
      },
      riskMetrics: {
        volatility: volatility ? Math.round(volatility * 100) / 100 : undefined,
        sharpeRatio,
        sortinoRatio,
        maxDrawdown,
        beta,
        alpha,
      },
      explainability: {
        engine_version: this.ENGINE_VERSION,
        calculation_timestamp: calculationTimestamp,
        risk_free_rate_percent: this.RISK_FREE_RATE * 100,
        formulas_applied: {
          period_return: "((P_latest - P_lookback) / P_lookback) * 100",
          cagr: "((P_latest / P_initial) ** (365.25 / days_held) - 1) * 100",
          volatility: "std_dev(daily_returns) * sqrt(252) * 100",
          sharpe_ratio: "(annualized_return - risk_free_rate) / annualized_volatility",
          beta: "covariance(asset_returns, benchmark_returns) / variance(benchmark_returns)",
          alpha: "annualized_return - (Rf + beta * (benchmark_annualized_return - Rf))",
        },
        inputs_used: {
          history_points_count: history.length,
          start_date: history[0].priceDate,
          end_date: latest.priceDate,
          start_price: Number(history[0].close),
          latest_price: latestPrice,
          benchmark_symbol: benchmarkIsin,
        },
        intermediate_steps: [
          `Collected ${history.length} price candles from ${history[0].priceDate} to ${latest.priceDate}`,
          `Computed periodic price deltas (1D, 1W, 1M, 3M, 6M, 1Y, 3Y, 5Y)`,
          `Derived annualized standard deviation across ${dailyReturns.length} trading sessions`,
          `Computed risk-adjusted performance using RBI 10Y G-Sec benchmark (${this.RISK_FREE_RATE * 100}%)`,
        ],
      },
    };

    // Store pre-computed metrics into instrument_performance_metrics table asynchronously
    this.persistPerformanceMetrics(result).catch((err) =>
      logger.warn("Non-fatal error persisting performance metrics", { event: "PERSIST_METRICS_WARN", error: err?.message })
    );

    logger.info("Performance metrics calculated", {
      event: "PERFORMANCE_METRICS_CALCULATED",
      isin,
      latency_ms: Date.now() - startTime,
      status: "success",
    });

    return result;
  }

  private calculatePeriodReturn(history: HistoricalMarketPrice[], lookbackDays: number): number | undefined {
    if (history.length <= lookbackDays) return undefined;
    const current = Number(history[history.length - 1].close);
    const targetIdx = history.length - 1 - lookbackDays;
    const base = Number(history[targetIdx].close);
    if (base <= 0) return undefined;
    return Math.round(((current - base) / base) * 10000) / 100;
  }

  private async persistPerformanceMetrics(metrics: PerformanceCalculationResult): Promise<void> {
    await db.insert(instrumentPerformanceMetrics).values({
      isin: metrics.isin,
      benchmarkIsin: metrics.benchmarkIsin,
      return1D: metrics.periodStats.return1D ? String(metrics.periodStats.return1D) : null,
      return1W: metrics.periodStats.return1W ? String(metrics.periodStats.return1W) : null,
      return1M: metrics.periodStats.return1M ? String(metrics.periodStats.return1M) : null,
      return3M: metrics.periodStats.return3M ? String(metrics.periodStats.return3M) : null,
      return6M: metrics.periodStats.return6M ? String(metrics.periodStats.return6M) : null,
      return1Y: metrics.periodStats.return1Y ? String(metrics.periodStats.return1Y) : null,
      return3Y: metrics.periodStats.return3Y ? String(metrics.periodStats.return3Y) : null,
      return5Y: metrics.periodStats.return5Y ? String(metrics.periodStats.return5Y) : null,
      cagr: metrics.periodStats.cagr ? String(metrics.periodStats.cagr) : null,
      volatility: metrics.riskMetrics.volatility ? String(metrics.riskMetrics.volatility) : null,
      sharpeRatio: metrics.riskMetrics.sharpeRatio ? String(metrics.riskMetrics.sharpeRatio) : null,
      sortinoRatio: metrics.riskMetrics.sortinoRatio ? String(metrics.riskMetrics.sortinoRatio) : null,
      maxDrawdown: metrics.riskMetrics.maxDrawdown ? String(metrics.riskMetrics.maxDrawdown) : null,
      beta: metrics.riskMetrics.beta ? String(metrics.riskMetrics.beta) : null,
      alpha: metrics.riskMetrics.alpha ? String(metrics.riskMetrics.alpha) : null,
      engineVersion: metrics.explainability.engine_version,
      calculationTimestamp: new Date(metrics.explainability.calculation_timestamp),
      explainability: metrics.explainability,
      source: "engine",
    });
  }
}

export const historicalPerformanceService = HistoricalPerformanceService.getInstance();
