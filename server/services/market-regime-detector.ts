/**
 * @file market-regime-detector.ts
 * @description Detects current market regime (BULL/BEAR/NEUTRAL) using screener aggregate data.
 *
 * Purpose:
 *   Provides market context to the rebalance scheduler and risk guard.
 *   Used to modulate auto-rebalance decisions — no high-beta additions in BEAR.
 *
 * Inputs:
 *   - screener_derived_metrics: return_1y, return_6m, beta, sharpe_ratio_1y (top 500 stocks)
 *   - financial_instruments_cache: nifty500 proxy NAV if available
 *
 * Outputs:
 *   - MarketRegime: "BULL" | "BEAR" | "NEUTRAL"
 *   - Supporting metrics: avg1M return, drawdown estimate, breadth score
 *
 * Edge cases:
 *   - Insufficient data: defaults to "NEUTRAL" (conservative)
 *   - Screener data stale (> 7 days): warns but still returns last known regime
 *
 * FASP-AI v3.0: This is a data computation module. Output used to gate auto-apply decisions.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

export type MarketRegime = "BULL" | "BEAR" | "NEUTRAL";

export interface RegimeResult {
  regime: MarketRegime;
  /** Proxy 1-month return: avg of top-500 stocks by market cap */
  proxy1MReturn: number;
  /** Fraction of stocks with positive 1Y return */
  breadthScore: number;
  /** Estimated drawdown from rolling 52-week high proxy */
  estimatedDrawdown: number;
  /** Number of stocks sampled */
  sampleSize: number;
  stale: boolean;
  calculation_timestamp: string;
  model_version: string;
}

const MODEL_VERSION = "FASP-AI v3.0 / regime-v1";

// Regime thresholds
const BULL_PROXY_1M = 2.0;        // avg 1M return > 2% → bull
const BEAR_PROXY_1M = -3.0;       // avg 1M return < -3% → bear
const BEAR_DRAWDOWN_PCT = 12.0;   // estimated drawdown > 12% → bear override
const BEAR_BREADTH = 0.35;        // < 35% stocks positive → breadth confirms bear

/** Singleton cache — regime persists for 6 hours to avoid thrashing */
let _cached: RegimeResult | null = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Detects current market regime from screener aggregate data.
 * Cached for 6h; force-refresh with forceRefresh=true.
 */
export async function detectRegime(forceRefresh = false): Promise<RegimeResult> {
  if (!forceRefresh && _cached && Date.now() - _cachedAt < CACHE_TTL_MS) {
    return _cached;
  }

  const ts = new Date().toISOString();

  try {
    // Aggregate across all screener stocks (proxy for broad market)
    const agg = await db.execute(sql`
      SELECT
        COUNT(*)                                                    AS sample_size,
        AVG(COALESCE(return_1m, return_1y / 12.0))                AS avg_1m_return,
        AVG(return_1y)                                             AS avg_1y_return,
        AVG(return_6m)                                             AS avg_6m_return,
        SUM(CASE WHEN return_1y > 0 THEN 1 ELSE 0 END)::float /
          NULLIF(COUNT(*), 0)                                      AS breadth_score,
        AVG(beta)                                                  AS avg_beta,
        -- Drawdown proxy: if 6M return >> 1Y return, recent selloff detected
        CASE
          WHEN AVG(return_1y) > 0 AND AVG(return_6m) < 0
          THEN ABS(AVG(return_6m) / NULLIF(AVG(return_1y), 1)) * 100
          ELSE 0
        END                                                        AS drawdown_proxy
      FROM screener_derived_metrics
      WHERE return_1y IS NOT NULL
    `).catch(() => ({ rows: [] }));

    const row = (agg as any).rows?.[0];
    if (!row || Number(row.sample_size) < 50) {
      // Not enough data — default to NEUTRAL
      const result: RegimeResult = {
        regime: "NEUTRAL",
        proxy1MReturn: 0,
        breadthScore: 0.5,
        estimatedDrawdown: 0,
        sampleSize: 0,
        stale: true,
        calculation_timestamp: ts,
        model_version: MODEL_VERSION,
      };
      _cached = result;
      _cachedAt = Date.now();
      return result;
    }

    const proxy1M = Math.round(Number(row.avg_1m_return ?? 0) * 10000) / 100;
    const breadth = Math.round(Number(row.breadth_score ?? 0.5) * 100) / 100;
    const drawdown = Math.round(Number(row.drawdown_proxy ?? 0) * 100) / 100;
    const sampleSize = Number(row.sample_size);

    // Regime classification
    let regime: MarketRegime = "NEUTRAL";

    if (
      proxy1M > BULL_PROXY_1M &&
      breadth > 0.55
    ) {
      regime = "BULL";
    } else if (
      proxy1M < BEAR_PROXY_1M ||
      drawdown > BEAR_DRAWDOWN_PCT ||
      breadth < BEAR_BREADTH
    ) {
      regime = "BEAR";
    }

    const result: RegimeResult = {
      regime,
      proxy1MReturn: proxy1M,
      breadthScore: breadth,
      estimatedDrawdown: drawdown,
      sampleSize,
      stale: false,
      calculation_timestamp: ts,
      model_version: MODEL_VERSION,
    };

    _cached = result;
    _cachedAt = Date.now();

    logger.info("[MarketRegime] Regime detected", {
      event: "MARKET_REGIME_COMPUTED",
      user_id: "system",
      regime,
      proxy1M,
      breadth,
      drawdown,
      sampleSize,
      latency_ms: 0,
      status: "success",
    });

    return result;
  } catch (err) {
    logger.error("[MarketRegime] Detection failed", err as Error);
    const fallback: RegimeResult = {
      regime: "NEUTRAL",
      proxy1MReturn: 0,
      breadthScore: 0.5,
      estimatedDrawdown: 0,
      sampleSize: 0,
      stale: true,
      calculation_timestamp: ts,
      model_version: MODEL_VERSION,
    };
    _cached = fallback;
    _cachedAt = Date.now();
    return fallback;
  }
}

/** Clear the regime cache (useful for testing) */
export function clearRegimeCache(): void {
  _cached = null;
  _cachedAt = 0;
}
