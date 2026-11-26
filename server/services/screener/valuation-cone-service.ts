/**
 * valuation-cone-service.ts
 *
 * Valuation Intelligence Engine — Trendlyne & Tijori Peer Parity (GCR v1.0 & FASP-AI v1.0).
 *
 * Responsibilities:
 * 1. Compute rolling 3Y (750 trading days) and 5Y (1250 trading days) historical P/E and P/B Valuation Cones (Bands).
 * 2. Calculate Median, Mean, Standard Deviation (σ), and the 5 standard cone bands:
 *    [-2σ, -1σ, Median, +1σ, +2σ]
 * 3. Classify current valuation status:
 *    DEEP_DISCOUNT | UNDERVALUED | FAIR_VALUE | PREMIUM | OVERVALUED
 * 4. Aggregate Sector & Industry Median Multiples (P/E, P/B, EV/EBITDA, ROE, DY) across active stocks.
 * 5. Provide relative sector valuation discount/premium comparisons.
 *
 * @module valuation-cone-service
 * @version 2.1.0
 */

import { db } from "../../db";
import { logger } from "../../logger";
import {
  screenerPriceHistory,
  screenerFinancials,
  listedStocks,
} from "@shared/schema";
import { eq, desc, and, gte, sql, isNotNull } from "drizzle-orm";
import { unifiedStockPriceService } from "../unified-stock-price-service";

// ─── Interfaces ─────────────────────────────────────────────────────────────

export type ValuationStatus =
  | "DEEP_DISCOUNT"
  | "UNDERVALUED"
  | "FAIR_VALUE"
  | "PREMIUM"
  | "OVERVALUED";

export interface ValuationBandSet {
  period: "3Y" | "5Y";
  metric: "PE" | "PB";
  currentMultiple: number;
  median: number;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  bands: {
    minus2Sigma: number;
    minus1Sigma: number;
    median: number;
    plus1Sigma: number;
    plus2Sigma: number;
  };
  valuationStatus: ValuationStatus;
  percentileRank: number; // 0 - 100% where current multiple sits in historical distribution
  discountPremiumVsMedianPercent: number; // ((current - median) / median) * 100
  sampleCount: number;
  timeSeries?: Array<{
    date: string;
    price: number;
    multiple: number;
    minus2Sigma: number;
    minus1Sigma: number;
    median: number;
    plus1Sigma: number;
    plus2Sigma: number;
  }>;
}

export interface ValuationConeResult {
  symbol: string;
  companyName?: string;
  currentPrice: number;
  currentPe: number | null;
  currentPb: number | null;
  ttmEps: number | null;
  bookValuePerShare: number | null;
  pe3Y: ValuationBandSet | null;
  pe5Y: ValuationBandSet | null;
  pb3Y: ValuationBandSet | null;
  pb5Y: ValuationBandSet | null;
  engineVersion: string;
  calculationTimestamp: string;
}

export interface SectorMultiples {
  sector: string;
  industry?: string;
  companyCount: number;
  medianPe: number;
  meanPe: number;
  medianPb: number;
  meanPb: number;
  medianEvToEbitda: number;
  medianRoe: number;
  medianDividendYield: number;
  updatedAt: string;
}

export interface CompanySectorRelativeValuation {
  symbol: string;
  sector: string;
  industry?: string;
  companyMetrics: {
    pe: number | null;
    pb: number | null;
    evToEbitda: number | null;
    roe: number | null;
    dividendYield: number | null;
  };
  sectorMedians: SectorMultiples;
  relativeComparison: {
    peDiscountPremiumPercent: number | null; // e.g. -12.5% = 12.5% discount to sector
    pbDiscountPremiumPercent: number | null;
    status: "DISCOUNT_TO_SECTOR" | "IN_LINE_WITH_SECTOR" | "PREMIUM_TO_SECTOR";
    summary: string;
  };
  engineVersion: string;
  calculationTimestamp: string;
}

// ─── Math & Statistical Helpers ─────────────────────────────────────────────

export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[half];
  }
  return (sorted[half - 1] + sorted[half]) / 2;
}

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

export function calculateStdDev(values: number[], mean?: number): number {
  if (values.length <= 1) return 0;
  const m = mean ?? calculateMean(values);
  const variance =
    values.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function computePercentileRank(values: number[], current: number): number {
  if (values.length === 0) return 50;
  const sorted = [...values].sort((a, b) => a - b);
  const lowerCount = sorted.filter((v) => v < current).length;
  return Number(((lowerCount / sorted.length) * 100).toFixed(1));
}

export function determineValuationStatus(
  current: number,
  median: number,
  stdDev: number,
): ValuationStatus {
  if (stdDev <= 0) return "FAIR_VALUE";
  if (current < median - 1.5 * stdDev) return "DEEP_DISCOUNT";
  if (current < median - 0.5 * stdDev) return "UNDERVALUED";
  if (current <= median + 0.5 * stdDev) return "FAIR_VALUE";
  if (current <= median + 1.5 * stdDev) return "PREMIUM";
  return "OVERVALUED";
}

// ─── Service Class ──────────────────────────────────────────────────────────

export class ValuationConeService {
  private static instance: ValuationConeService;
  private readonly ENGINE_VERSION = "2.1.0";

  // In-memory cache for sector multiples with 6-hour TTL
  private sectorCache: {
    data: Map<string, SectorMultiples>;
    expiresAt: number;
  } = {
    data: new Map(),
    expiresAt: 0,
  };

  // In-memory cache for valuation cones with 1-hour TTL
  private coneCache: Map<string, { data: ValuationConeResult; expiresAt: number }> =
    new Map();

  static getInstance(): ValuationConeService {
    if (!ValuationConeService.instance) {
      ValuationConeService.instance = new ValuationConeService();
    }
    return ValuationConeService.instance;
  }

  /**
   * Compute 3Y & 5Y P/E and P/B Valuation Cones for a symbol.
   */
  async getValuationCone(
    rawSymbol: string,
    includeTimeSeries = true,
  ): Promise<ValuationConeResult | null> {
    const symbol = rawSymbol.trim().toUpperCase();
    const cacheKey = `${symbol}:${includeTimeSeries ? "with_ts" : "no_ts"}`;

    const cached = this.coneCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      // 1. Fetch current price from UnifiedStockPriceService (Tier -1 hot-tick enabled)
      const livePriceObj = await unifiedStockPriceService.getPrice(symbol);
      const currentPrice = livePriceObj?.price || 0;

      // 2. Fetch company financials (TTM EPS, Book Value, latest P/E, P/B)
      const [financials] = await db
        .select()
        .from(screenerFinancials)
        .where(eq(screenerFinancials.symbol, symbol))
        .orderBy(desc(screenerFinancials.fiscalYear))
        .limit(1);

      const [stockMeta] = await db
        .select({
          symbol: listedStocks.symbol,
          companyName: listedStocks.companyName,
          currentPrice: listedStocks.currentPrice,
          peRatio: listedStocks.peRatio,
          pbRatio: listedStocks.pbRatio,
        })
        .from(listedStocks)
        .where(eq(listedStocks.symbol, symbol))
        .limit(1);

      const effectivePrice =
        currentPrice > 0
          ? currentPrice
          : stockMeta?.currentPrice
            ? Number(stockMeta.currentPrice)
            : 0;

      const ttmEps = financials?.eps
        ? Number(financials.eps)
        : stockMeta?.peRatio && effectivePrice > 0
          ? Number((effectivePrice / Number(stockMeta.peRatio)).toFixed(2))
          : null;

      const bookValuePerShare = financials?.bookValue
        ? Number(financials.bookValue)
        : stockMeta?.pbRatio && effectivePrice > 0
          ? Number((effectivePrice / Number(stockMeta.pbRatio)).toFixed(2))
          : null;

      // Real-time live P/E & P/B computed dynamically (Live Price / TTM EPS)
      const currentPe =
        ttmEps && ttmEps > 0 && effectivePrice > 0
          ? Number((effectivePrice / ttmEps).toFixed(2))
          : financials?.peRatio
            ? Number(financials.peRatio)
            : stockMeta?.peRatio
              ? Number(stockMeta.peRatio)
              : null;

      const currentPb =
        bookValuePerShare && bookValuePerShare > 0 && effectivePrice > 0
          ? Number((effectivePrice / bookValuePerShare).toFixed(2))
          : financials?.pbRatio
            ? Number(financials.pbRatio)
            : stockMeta?.pbRatio
              ? Number(stockMeta.pbRatio)
              : null;

      // 3. Query 5-year daily OHLCV from screener_price_history (~1250 trading days)
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

      const priceRows = await db
        .select({
          date: screenerPriceHistory.date,
          close: screenerPriceHistory.close,
        })
        .from(screenerPriceHistory)
        .where(
          and(
            eq(screenerPriceHistory.symbol, symbol),
            gte(screenerPriceHistory.date, fiveYearsAgo.toISOString().split("T")[0] as any),
            isNotNull(screenerPriceHistory.close),
          ),
        )
        .orderBy(screenerPriceHistory.date);

      // 4. Construct daily P/E and P/B timeseries
      // Extract quarterly historical EPS/BVPS milestones if present
      const quarterlyList: Array<{ date: string; eps?: number; bvps?: number }> = [];
      if (Array.isArray(financials?.quarterlyHistory)) {
        for (const q of financials.quarterlyHistory as any[]) {
          const qDate = q.date || q.quarter || q.period;
          const qEps = q.eps || q.dilutedEps;
          const qBv = q.bookValue || q.bvps;
          if (qDate && (qEps != null || qBv != null)) {
            quarterlyList.push({
              date: String(qDate),
              eps: qEps != null ? Number(qEps) : undefined,
              bvps: qBv != null ? Number(qBv) : undefined,
            });
          }
        }
      }

      // Compute daily series
      interface DailyMultiplePoint {
        date: string;
        price: number;
        pe: number | null;
        pb: number | null;
      }

      const dailyPoints: DailyMultiplePoint[] = [];

      for (const row of priceRows) {
        const p = Number(row.close);
        if (p <= 0) continue;
        const rowDateStr = String(row.date);

        // Find active EPS for that date or use overall TTM EPS
        let activeEps = ttmEps;
        let activeBv = bookValuePerShare;

        if (quarterlyList.length > 0) {
          const prior = quarterlyList
            .filter((q) => q.date <= rowDateStr)
            .sort((a, b) => b.date.localeCompare(a.date))[0];
          if (prior?.eps && prior.eps > 0) activeEps = prior.eps;
          if (prior?.bvps && prior.bvps > 0) activeBv = prior.bvps;
        }

        // Filter valid non-outlier P/E and P/B
        const pe =
          activeEps && activeEps > 0 && p / activeEps <= 500
            ? Number((p / activeEps).toFixed(2))
            : null;

        const pb =
          activeBv && activeBv > 0 && p / activeBv <= 100
            ? Number((p / activeBv).toFixed(2))
            : null;

        dailyPoints.push({
          date: rowDateStr,
          price: p,
          pe,
          pb,
        });
      }

      // 5. Build 3Y & 5Y Cones
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      const threeYearsAgoStr = threeYearsAgo.toISOString().split("T")[0];

      const points3Y = dailyPoints.filter((pt) => pt.date >= threeYearsAgoStr);
      const points5Y = dailyPoints;

      const pe3Y = this.computeValuationBands(
        points3Y.map((pt) => ({ date: pt.date, price: pt.price, multiple: pt.pe })),
        currentPe,
        "3Y",
        "PE",
        includeTimeSeries,
      );

      const pe5Y = this.computeValuationBands(
        points5Y.map((pt) => ({ date: pt.date, price: pt.price, multiple: pt.pe })),
        currentPe,
        "5Y",
        "PE",
        includeTimeSeries,
      );

      const pb3Y = this.computeValuationBands(
        points3Y.map((pt) => ({ date: pt.date, price: pt.price, multiple: pt.pb })),
        currentPb,
        "3Y",
        "PB",
        includeTimeSeries,
      );

      const pb5Y = this.computeValuationBands(
        points5Y.map((pt) => ({ date: pt.date, price: pt.price, multiple: pt.pb })),
        currentPb,
        "5Y",
        "PB",
        includeTimeSeries,
      );

      const result: ValuationConeResult = {
        symbol,
        companyName: stockMeta?.companyName || symbol,
        currentPrice: effectivePrice,
        currentPe,
        currentPb,
        ttmEps,
        bookValuePerShare,
        pe3Y,
        pe5Y,
        pb3Y,
        pb5Y,
        engineVersion: this.ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
      };

      // Cache for 1 hour
      this.coneCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + 60 * 60 * 1000,
      });

      return result;
    } catch (err: any) {
      logger.error(`[ValuationCone] Failed to calculate valuation cone for ${symbol}: ${err?.message}`);
      return null;
    }
  }

  /**
   * Internal statistical band calculation.
   */
  public computeValuationBands(
    rawPoints: Array<{ date: string; price: number; multiple: number | null }>,
    currentMultiple: number | null,
    period: "3Y" | "5Y",
    metric: "PE" | "PB",
    includeTimeSeries = true,
  ): ValuationBandSet | null {
    const validPoints = rawPoints.filter((pt) => pt.multiple != null && pt.multiple > 0);
    const multiples = validPoints.map((pt) => pt.multiple as number);

    if (multiples.length < 10) {
      return null; // Insufficient history for statistical significance
    }

    const median = Number(calculateMedian(multiples).toFixed(2));
    const mean = Number(calculateMean(multiples).toFixed(2));
    const stdDev = Number(calculateStdDev(multiples, mean).toFixed(2));
    const min = Number(Math.min(...multiples).toFixed(2));
    const max = Number(Math.max(...multiples).toFixed(2));

    const minus2Sigma = Math.max(0.1, Number((median - 2 * stdDev).toFixed(2)));
    const minus1Sigma = Math.max(0.1, Number((median - 1 * stdDev).toFixed(2)));
    const plus1Sigma = Number((median + 1 * stdDev).toFixed(2));
    const plus2Sigma = Number((median + 2 * stdDev).toFixed(2));

    const effectiveCurrent = currentMultiple && currentMultiple > 0 ? currentMultiple : median;
    const valuationStatus = determineValuationStatus(effectiveCurrent, median, stdDev);
    const percentileRank = computePercentileRank(multiples, effectiveCurrent);
    const discountPremiumVsMedianPercent = Number(
      (((effectiveCurrent - median) / (median || 1)) * 100).toFixed(2),
    );

    let timeSeries: ValuationBandSet["timeSeries"] = undefined;
    if (includeTimeSeries) {
      // Downsample to max 80 points for client performance
      const step = Math.max(1, Math.floor(validPoints.length / 80));
      timeSeries = [];
      for (let i = 0; i < validPoints.length; i += step) {
        const pt = validPoints[i];
        timeSeries.push({
          date: pt.date,
          price: pt.price,
          multiple: pt.multiple as number,
          minus2Sigma,
          minus1Sigma,
          median,
          plus1Sigma,
          plus2Sigma,
        });
      }
      // Ensure the latest point is included
      const last = validPoints[validPoints.length - 1];
      if (timeSeries[timeSeries.length - 1]?.date !== last.date) {
        timeSeries.push({
          date: last.date,
          price: last.price,
          multiple: last.multiple as number,
          minus2Sigma,
          minus1Sigma,
          median,
          plus1Sigma,
          plus2Sigma,
        });
      }
    }

    return {
      period,
      metric,
      currentMultiple: effectiveCurrent,
      median,
      mean,
      stdDev,
      min,
      max,
      bands: {
        minus2Sigma,
        minus1Sigma,
        median,
        plus1Sigma,
        plus2Sigma,
      },
      valuationStatus,
      percentileRank,
      discountPremiumVsMedianPercent,
      sampleCount: multiples.length,
      timeSeries,
    };
  }

  /**
   * Aggregate Sector & Industry Median Multiples across active listed stocks.
   */
  async getSectorMultiples(): Promise<Map<string, SectorMultiples>> {
    if (
      this.sectorCache.expiresAt > Date.now() &&
      this.sectorCache.data.size > 0
    ) {
      return this.sectorCache.data;
    }

    try {
      // Group stocks by sector from listed_stocks joined with screener_financials
      const rows = await db.execute(sql`
        SELECT
          ls.sector,
          COUNT(ls.symbol)::int as company_count,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY NULLIF(sf.pe_ratio, '')::numeric) FILTER (WHERE sf.pe_ratio IS NOT NULL AND NULLIF(sf.pe_ratio, '')::numeric > 0 AND NULLIF(sf.pe_ratio, '')::numeric < 300) as median_pe,
          AVG(NULLIF(sf.pe_ratio, '')::numeric) FILTER (WHERE sf.pe_ratio IS NOT NULL AND NULLIF(sf.pe_ratio, '')::numeric > 0 AND NULLIF(sf.pe_ratio, '')::numeric < 300) as mean_pe,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY NULLIF(sf.pb_ratio, '')::numeric) FILTER (WHERE sf.pb_ratio IS NOT NULL AND NULLIF(sf.pb_ratio, '')::numeric > 0 AND NULLIF(sf.pb_ratio, '')::numeric < 50) as median_pb,
          AVG(NULLIF(sf.pb_ratio, '')::numeric) FILTER (WHERE sf.pb_ratio IS NOT NULL AND NULLIF(sf.pb_ratio, '')::numeric > 0 AND NULLIF(sf.pb_ratio, '')::numeric < 50) as mean_pb,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY NULLIF(sf.ev_to_ebitda, '')::numeric) FILTER (WHERE sf.ev_to_ebitda IS NOT NULL AND NULLIF(sf.ev_to_ebitda, '')::numeric > 0 AND NULLIF(sf.ev_to_ebitda, '')::numeric < 100) as median_ev_ebitda,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY NULLIF(sf.roe, '')::numeric) FILTER (WHERE sf.roe IS NOT NULL) as median_roe,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY NULLIF(sf.dividend_yield, '')::numeric) FILTER (WHERE sf.dividend_yield IS NOT NULL AND NULLIF(sf.dividend_yield, '')::numeric >= 0) as median_dy
        FROM listed_stocks ls
        LEFT JOIN screener_financials sf ON sf.symbol = ls.symbol
        WHERE ls.sector IS NOT NULL AND TRIM(ls.sector) != ''
        GROUP BY ls.sector
        HAVING COUNT(ls.symbol) >= 3
      `);

      const resultMap = new Map<string, SectorMultiples>();
      const rowsArr = (rows as any).rows || [];

      for (const r of rowsArr) {
        const sector = String(r.sector).trim();
        const multiples: SectorMultiples = {
          sector,
          companyCount: Number(r.company_count || 0),
          medianPe: Number(Number(r.median_pe || 25).toFixed(2)),
          meanPe: Number(Number(r.mean_pe || 25).toFixed(2)),
          medianPb: Number(Number(r.median_pb || 3).toFixed(2)),
          meanPb: Number(Number(r.mean_pb || 3).toFixed(2)),
          medianEvToEbitda: Number(Number(r.median_ev_ebitda || 15).toFixed(2)),
          medianRoe: Number(Number(r.median_roe || 0.15).toFixed(4)),
          medianDividendYield: Number(Number(r.median_dy || 0.015).toFixed(4)),
          updatedAt: new Date().toISOString(),
        };
        resultMap.set(sector.toUpperCase(), multiples);
      }

      this.sectorCache = {
        data: resultMap,
        expiresAt: Date.now() + 6 * 60 * 60 * 1000, // 6 hours
      };

      return resultMap;
    } catch (err: any) {
      logger.error(`[ValuationCone] Failed to aggregate sector multiples: ${err?.message}`);
      return new Map();
    }
  }

  /**
   * Compare a single stock against its sector and industry median benchmarks.
   */
  async getCompanySectorRelativeValuation(
    rawSymbol: string,
  ): Promise<CompanySectorRelativeValuation | null> {
    const symbol = rawSymbol.trim().toUpperCase();

    try {
      const [stock] = await db
        .select({
          symbol: listedStocks.symbol,
          companyName: listedStocks.companyName,
          sector: listedStocks.sector,
          industry: listedStocks.industry,
          peRatio: listedStocks.peRatio,
          pbRatio: listedStocks.pbRatio,
        })
        .from(listedStocks)
        .where(eq(listedStocks.symbol, symbol))
        .limit(1);

      if (!stock || !stock.sector) {
        return null;
      }

      const [fin] = await db
        .select({
          peRatio: screenerFinancials.peRatio,
          pbRatio: screenerFinancials.pbRatio,
          evToEbitda: screenerFinancials.evToEbitda,
          roe: screenerFinancials.roe,
          dividendYield: screenerFinancials.dividendYield,
        })
        .from(screenerFinancials)
        .where(eq(screenerFinancials.symbol, symbol))
        .orderBy(desc(screenerFinancials.fiscalYear))
        .limit(1);

      const companyPe = fin?.peRatio ? Number(fin.peRatio) : stock.peRatio ? Number(stock.peRatio) : null;
      const companyPb = fin?.pbRatio ? Number(fin.pbRatio) : stock.pbRatio ? Number(stock.pbRatio) : null;
      const companyEv = fin?.evToEbitda ? Number(fin.evToEbitda) : null;
      const companyRoe = fin?.roe ? Number(fin.roe) : null;
      const companyDy = fin?.dividendYield ? Number(fin.dividendYield) : null;

      const sectorMap = await this.getSectorMultiples();
      const sectorMultiples = sectorMap.get(stock.sector.trim().toUpperCase()) || {
        sector: stock.sector,
        companyCount: 1,
        medianPe: 25.0,
        meanPe: 25.0,
        medianPb: 3.0,
        meanPb: 3.0,
        medianEvToEbitda: 15.0,
        medianRoe: 0.15,
        medianDividendYield: 0.012,
        updatedAt: new Date().toISOString(),
      };

      let peDiscountPremiumPercent: number | null = null;
      if (companyPe != null && sectorMultiples.medianPe > 0) {
        peDiscountPremiumPercent = Number(
          (((companyPe - sectorMultiples.medianPe) / sectorMultiples.medianPe) * 100).toFixed(1),
        );
      }

      let pbDiscountPremiumPercent: number | null = null;
      if (companyPb != null && sectorMultiples.medianPb > 0) {
        pbDiscountPremiumPercent = Number(
          (((companyPb - sectorMultiples.medianPb) / sectorMultiples.medianPb) * 100).toFixed(1),
        );
      }

      let status: CompanySectorRelativeValuation["relativeComparison"]["status"] =
        "IN_LINE_WITH_SECTOR";
      let summary = `${stock.companyName || symbol} is trading in line with the ${stock.sector} sector median.`;

      if (peDiscountPremiumPercent != null) {
        if (peDiscountPremiumPercent <= -10) {
          status = "DISCOUNT_TO_SECTOR";
          summary = `${stock.companyName || symbol} trades at P/E ${companyPe?.toFixed(1)}x, a ${Math.abs(peDiscountPremiumPercent)}% discount to the ${stock.sector} sector median (${sectorMultiples.medianPe.toFixed(1)}x).`;
        } else if (peDiscountPremiumPercent >= 10) {
          status = "PREMIUM_TO_SECTOR";
          summary = `${stock.companyName || symbol} trades at P/E ${companyPe?.toFixed(1)}x, a ${peDiscountPremiumPercent}% premium to the ${stock.sector} sector median (${sectorMultiples.medianPe.toFixed(1)}x).`;
        }
      }

      return {
        symbol,
        sector: stock.sector,
        industry: stock.industry || undefined,
        companyMetrics: {
          pe: companyPe,
          pb: companyPb,
          evToEbitda: companyEv,
          roe: companyRoe,
          dividendYield: companyDy,
        },
        sectorMedians: sectorMultiples,
        relativeComparison: {
          peDiscountPremiumPercent,
          pbDiscountPremiumPercent,
          status,
          summary,
        },
        engineVersion: this.ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      logger.error(`[ValuationCone] Error comparing ${symbol} against sector: ${err?.message}`);
      return null;
    }
  }
}

export const valuationConeService = ValuationConeService.getInstance();
