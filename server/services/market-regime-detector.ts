/**
 * @file market-regime-detector.ts
 * @description Thin adapter that wraps AIRegimeDetectionEngine (the authoritative, signal-rich
 *              engine) and exposes the MarketRegime type used by:
 *                - portfolio-rebalance-scheduler.ts
 *                - portfolio-risk-guard.ts
 *                - background-schedulers.ts
 *
 * UPGRADE (Audit #2): Previous version used a simple screener proxy (return_1m aggregate).
 * This version delegates to AIRegimeDetectionEngine which uses:
 *   - India VIX proxy (annualized vol from NIFTY prices)
 *   - 50-DMA / 200-DMA breadth (% stocks above DMA)
 *   - Advance/Decline ratio from listed_stocks
 *   - Momentum (5/10/20/50-day multi-period)
 *   - Trend strength (R² of linear regression on 50-day price series)
 *   - Volatility clustering (10-day vs 60-day vol ratio)
 *
 * NSE breadth data is optionally injected (Audit #6) when available.
 *
 * Cache: Redis 6h (shared across pods). Falls back to in-memory if Redis is unavailable.
 *
 * FASP-AI v3.0: Every regime detection is persisted to ai_regime_history for audit.
 */

import { aiRegimeDetectionEngine, RegimeLabel } from "./ai-regime-detection-engine";
import { logger } from "../logger";
import { getNSEMarketBreadth } from "./screener/nse-india-provider";

export type MarketRegime = "BULL" | "BEAR" | "NEUTRAL" | "HIGH_VOL";

export interface RegimeResult {
  regime: MarketRegime;
  label: RegimeLabel;           // raw label from AIRegimeDetectionEngine
  confidence: number;           // 0–100
  breadthScore: number;         // advance/decline ratio
  vixProxy: number;             // India VIX proxy
  pctAbove50DMA: number;        // % stocks above 50-DMA
  signals: string[];            // human-readable signal descriptions
  source: string;               // "ai_regime_engine" | "fallback"
  timestamp: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
let _memCache: { result: RegimeResult; at: number } | null = null;

// ── Redis ─────────────────────────────────────────────────────────────────────
let _redis: any = null;
async function getRedis() {
  if (_redis) return _redis;
  try {
    if (!process.env.REDIS_URL) return null;
    const { createClient } = await import("redis");
    _redis = createClient({ url: process.env.REDIS_URL });
    _redis.on("error", () => { _redis = null; });
    await _redis.connect();
    return _redis;
  } catch { return null; }
}

const REDIS_KEY = "market:regime";

// ── Label → MarketRegime mapping ─────────────────────────────────────────────
function toMarketRegime(label: RegimeLabel): MarketRegime {
  switch (label) {
    case "bull":     return "BULL";
    case "bear":     return "BEAR";
    case "high_vol": return "HIGH_VOL";
    default:         return "NEUTRAL";
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Detects current market regime using the full AI signal stack.
 *
 * @param forceRefresh - If true, bypasses both Redis and in-memory cache
 */
export async function detectRegime(forceRefresh = false): Promise<RegimeResult> {
  const ts = new Date().toISOString();

  // 1. Redis cache check
  if (!forceRefresh) {
    const redis = await getRedis();
    if (redis) {
      try {
        const cached = await redis.get(REDIS_KEY);
        if (cached) {
          const r = JSON.parse(cached) as RegimeResult;
          logger.info("[MarketRegime] Redis cache HIT", {
            event: "REGIME_CACHE_HIT",
            user_id: "system",
            regime: r.regime,
            latency_ms: 0,
            status: "success",
          });
          return r;
        }
      } catch { /* fall through */ }
    }

    // 2. In-memory cache fallback
    if (_memCache && Date.now() - _memCache.at < CACHE_TTL_MS) {
      return _memCache.result;
    }
  }

  // 3. Call AIRegimeDetectionEngine (authoritative)
  let result: RegimeResult;
  try {
    const [aiResult, nseData] = await Promise.allSettled([
      aiRegimeDetectionEngine.detectCurrentRegime(),
      getNSEMarketBreadth(),
    ]);

    const ai = aiResult.status === "fulfilled" ? aiResult.value : null;
    const nse = nseData.status === "fulfilled" ? nseData.value : null;

    if (!ai) throw new Error("AIRegimeDetectionEngine returned null");

    // Blend NSE live breadth with AI breadth estimate
    const breadthScore = nse?.advanceDeclineRatio ?? ai.marketData.advanceDeclineRatio;
    const pctAbove50DMA = nse?.pctAbove50DMAProxy ?? ai.marketData.pctAbove50DMA;

    result = {
      regime: toMarketRegime(ai.regimeLabel),
      label: ai.regimeLabel,
      confidence: ai.confidence,
      breadthScore,
      vixProxy: ai.marketData.indiaVix,
      pctAbove50DMA,
      signals: ai.signals.map(s => `${s.name}: ${s.description}`),
      source: "ai_regime_engine",
      timestamp: ts,
    };

    // 4. Persist to ai_regime_history
    await aiRegimeDetectionEngine.persistRegime(ai).catch(() => {});

    logger.info("[MarketRegime] Detected", {
      event: "REGIME_DETECTED",
      user_id: "system",
      regime: result.regime,
      confidence: result.confidence,
      vix_proxy: result.vixProxy,
      breadth: result.breadthScore,
      pct_above_50dma: result.pctAbove50DMA,
      nse_data_used: !!nse,
      latency_ms: 0,
      status: "success",
    });
  } catch (err) {
    logger.warn("[MarketRegime] Engine failed, using NEUTRAL fallback", {
      event: "REGIME_FALLBACK",
      user_id: "system",
      error: (err as Error).message,
      latency_ms: 0,
      status: "warning",
    });
    result = {
      regime: "NEUTRAL",
      label: "sideways",
      confidence: 30,
      breadthScore: 1.0,
      vixProxy: 15,
      pctAbove50DMA: 50,
      signals: ["Fallback: insufficient data"],
      source: "fallback",
      timestamp: ts,
    };
  }

  // 5. Update caches
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.setEx(REDIS_KEY, CACHE_TTL_MS / 1000, JSON.stringify(result));
    } catch { /* non-fatal */ }
  }
  _memCache = { result, at: Date.now() };

  return result;
}
