/**
 * @file sector-benchmark-service.ts
 * @description Computes and exposes sector and industry medians (P/E, P/B, ROE, ROCE, D/E)
 *              for Screener.in-grade peer comparison and relative valuation analysis.
 *
 * GCR v1.0 & FASP-AI v3.0:
 * - Deterministic percentiles using PostgreSQL percentile_cont(0.5)
 * - Layered caching for instant sub-5ms retrieval
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../logger";

export interface SectorBenchmarkData {
  sector: string;
  industry: string;
  stockCount: number;
  medianPe: number | null;
  medianPb: number | null;
  medianRoe: number | null;
  medianRoce: number | null;
  medianDebtToEquity: number | null;
  medianDividendYield: number | null;
  updatedAt: string;
}

export interface PeerComparisonItem {
  symbol: string;
  companyName: string;
  currentPrice: number;
  marketCapCr: number;
  peRatio: number | null;
  pbRatio: number | null;
  roe: number | null;
  roce: number | null;
  debtToEquity: number | null;
  dividendYield: number | null;
}

export interface RelativeValuationResult {
  benchmark: SectorBenchmarkData | null;
  peDiscountPct: number | null;   // negative = trading at a discount (cheap), positive = premium
  roePremiumPct: number | null;    // positive = higher ROE than peers
  peers: PeerComparisonItem[];
}

const _benchmarkCache = new Map<string, { data: SectorBenchmarkData; expiresAt: number }>();
const BENCHMARK_TTL_MS = 60 * 60 * 1000; // 1 hour

export class SectorBenchmarkService {
  /**
   * Nightly aggregator: computes median valuation metrics across all sectors & industries
   * directly from screener_master_snapshots using SQL window functions.
   */
  async computeAllSectorBenchmarks(): Promise<number> {
    const t0 = Date.now();
    try {
      const res = await db.execute(sql`
        INSERT INTO screener_sector_benchmarks (
          sector, industry, stock_count,
          median_pe, median_pb, median_roe, median_roce,
          median_debt_to_equity, median_dividend_yield,
          updated_at
        )
        SELECT
          sector,
          industry,
          count(*)::int AS stock_count,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(pe_ratio::numeric, 0))::numeric(10,2) AS median_pe,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(pb_ratio::numeric, 0))::numeric(10,2) AS median_pb,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(roe::numeric, 0))::numeric(10,4) AS median_roe,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY NULLIF(roce::numeric, 0))::numeric(10,4) AS median_roce,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY debt_to_equity::numeric)::numeric(10,4) AS median_debt_to_equity,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY dividend_yield::numeric)::numeric(10,4) AS median_dividend_yield,
          NOW()
        FROM screener_master_snapshots
        WHERE sector IS NOT NULL AND sector != '' AND industry IS NOT NULL AND industry != ''
        GROUP BY sector, industry
        ON CONFLICT (sector, industry) DO UPDATE SET
          stock_count = EXCLUDED.stock_count,
          median_pe = EXCLUDED.median_pe,
          median_pb = EXCLUDED.median_pb,
          median_roe = EXCLUDED.median_roe,
          median_roce = EXCLUDED.median_roce,
          median_debt_to_equity = EXCLUDED.median_debt_to_equity,
          median_dividend_yield = EXCLUDED.median_dividend_yield,
          updated_at = NOW()
        RETURNING sector;
      `);

      _benchmarkCache.clear();
      const count = res.rowCount ?? 0;
      logger.info("[SectorBenchmark] Materialized sector benchmarks", {
        event: "SECTOR_BENCHMARKS_COMPUTED",
        groups_computed: count,
        latency_ms: Date.now() - t0,
        status: "success",
      });

      return count;
    } catch (err: any) {
      logger.error("[SectorBenchmark] Failed to compute benchmarks", {
        error: err?.message,
      });
      return 0;
    }
  }

  /**
   * Retrieves benchmark for a given sector and industry.
   */
  async getBenchmark(sector: string, industry: string): Promise<SectorBenchmarkData | null> {
    const key = `${sector}__${industry}`.toLowerCase();
    const cached = _benchmarkCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const res = await db.execute(sql`
        SELECT
          sector, industry, stock_count,
          median_pe, median_pb, median_roe, median_roce,
          median_debt_to_equity, median_dividend_yield,
          updated_at
        FROM screener_sector_benchmarks
        WHERE LOWER(sector) = LOWER(${sector}) AND LOWER(industry) = LOWER(${industry})
        LIMIT 1
      `);

      if (res.rows.length === 0) return null;
      const row = res.rows[0] as any;
      const data: SectorBenchmarkData = {
        sector: row.sector,
        industry: row.industry,
        stockCount: Number(row.stock_count) || 0,
        medianPe: row.median_pe ? parseFloat(row.median_pe) : null,
        medianPb: row.median_pb ? parseFloat(row.median_pb) : null,
        medianRoe: row.median_roe ? parseFloat(row.median_roe) : null,
        medianRoce: row.median_roce ? parseFloat(row.median_roce) : null,
        medianDebtToEquity: row.median_debt_to_equity ? parseFloat(row.median_debt_to_equity) : null,
        medianDividendYield: row.median_dividend_yield ? parseFloat(row.median_dividend_yield) : null,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      };

      _benchmarkCache.set(key, { data, expiresAt: Date.now() + BENCHMARK_TTL_MS });
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Computes relative valuation metrics and fetches top 5-7 peers in the same industry.
   */
  async getRelativeValuationAndPeers(
    symbol: string,
    sector: string | null,
    industry: string | null,
    stockPe: number | null,
    stockRoe: number | null,
  ): Promise<RelativeValuationResult> {
    const emptyResult: RelativeValuationResult = {
      benchmark: null,
      peDiscountPct: null,
      roePremiumPct: null,
      peers: [],
    };

    if (!sector || !industry) return emptyResult;

    try {
      const [benchmark, peersRes] = await Promise.all([
        this.getBenchmark(sector, industry),
        db.execute(sql`
          SELECT
            symbol,
            company_name,
            current_price::numeric,
            (market_cap_value::numeric / 10000000) AS market_cap_cr,
            pe_ratio::numeric,
            pb_ratio::numeric,
            roe::numeric,
            roce::numeric,
            debt_to_equity::numeric,
            dividend_yield::numeric
          FROM screener_master_snapshots
          WHERE LOWER(industry) = LOWER(${industry})
          ORDER BY market_cap_value::numeric DESC NULLS LAST
          LIMIT 7
        `),
      ]);

      const peers: PeerComparisonItem[] = (peersRes.rows as any[]).map((r) => ({
        symbol: r.symbol,
        companyName: r.company_name,
        currentPrice: parseFloat(r.current_price || "0"),
        marketCapCr: Math.round(parseFloat(r.market_cap_cr || "0")),
        peRatio: r.pe_ratio ? parseFloat(r.pe_ratio) : null,
        pbRatio: r.pb_ratio ? parseFloat(r.pb_ratio) : null,
        roe: r.roe ? parseFloat(r.roe) : null,
        roce: r.roce ? parseFloat(r.roce) : null,
        debtToEquity: r.debt_to_equity ? parseFloat(r.debt_to_equity) : null,
        dividendYield: r.dividend_yield ? parseFloat(r.dividend_yield) : null,
      }));

      let peDiscountPct: number | null = null;
      if (stockPe && benchmark?.medianPe && benchmark.medianPe > 0) {
        peDiscountPct = Math.round(((stockPe - benchmark.medianPe) / benchmark.medianPe) * 10000) / 100;
      }

      let roePremiumPct: number | null = null;
      if (stockRoe && benchmark?.medianRoe && benchmark.medianRoe > 0) {
        roePremiumPct = Math.round(((stockRoe - benchmark.medianRoe) / benchmark.medianRoe) * 10000) / 100;
      }

      return {
        benchmark,
        peDiscountPct,
        roePremiumPct,
        peers,
      };
    } catch {
      return emptyResult;
    }
  }
}

export const sectorBenchmarkService = new SectorBenchmarkService();
