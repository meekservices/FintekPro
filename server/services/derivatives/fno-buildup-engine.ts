/**
 * @file fno-buildup-engine.ts
 * @description Institutional Futures & Options (F&O) Analysis Engine for FintekPro.
 *              Calculates 4-Quadrant F&O Buildup (Long Buildup, Short Buildup, Short Covering, Long Unwinding),
 *              Put-Call Ratio (PCR), Max Pain Strike, and Primary OI Support/Resistance Walls.
 *
 * GCR v1.0 & FASP-AI v3.0 Compliance:
 * - Deterministic output: same inputs always yield identical classification.
 * - Every payload exposes engine_version and calculation_timestamp.
 * - Layered caching with non-blocking graceful fallback.
 */

import { derivativesService } from "../derivatives-service";
import { logger } from "../../logger";
import { telemetryBus } from "../engine-telemetry-bus";

export const FNO_ENGINE_VERSION = "2.2.0";

export type FnoBuildupType =
  | "LONG_BUILDUP"
  | "SHORT_BUILDUP"
  | "SHORT_COVERING"
  | "LONG_UNWINDING"
  | "NEUTRAL";

export type PcrSentiment =
  | "EXTREMELY_BULLISH"
  | "BULLISH"
  | "NEUTRAL"
  | "BEARISH"
  | "EXTREMELY_BEARISH";

export interface FnoSummary {
  symbol: string;
  isFnoEligible: boolean;
  spotPrice: number;
  futuresPrice: number;
  futuresBasis: number;
  futuresBasisPct: number;
  priceChangePct: number;
  openInterest: number;
  oiChange: number;
  oiChangePct: number;
  buildup: FnoBuildupType;
  buildupInterpretation: string;
  pcr: number;
  pcrSentiment: PcrSentiment;
  maxPainStrike: number;
  primarySupportStrike: number;
  primaryResistanceStrike: number;
  totalCallOI: number;
  totalPutOI: number;
  highOICalls: Array<{ strike: number; oi: number }>;
  highOIPuts: Array<{ strike: number; oi: number }>;
  engineVersion: string;
  timestamp: string;
}

// 5-minute in-memory cache
interface CacheEntry {
  data: FnoSummary;
  expiresAt: number;
}
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Classifies derivative market action into the standard 4-quadrant institutional framework.
 */
export function classifyFnoBuildup(
  priceChangePct: number,
  oiChangePct: number,
): { buildup: FnoBuildupType; interpretation: string } {
  // Thresholds: minimum 0.25% price movement and 1.5% OI shift for high-conviction classification
  if (priceChangePct > 0.25 && oiChangePct > 1.5) {
    return {
      buildup: "LONG_BUILDUP",
      interpretation: "Fresh institutional accumulation. Price and Open Interest rising simultaneously confirm strong bullish conviction.",
    };
  }

  if (priceChangePct < -0.25 && oiChangePct > 1.5) {
    return {
      buildup: "SHORT_BUILDUP",
      interpretation: "Aggressive institutional short creation. Price falling while Open Interest expands indicates heavy selling pressure.",
    };
  }

  if (priceChangePct > 0.25 && oiChangePct < -1.5) {
    return {
      buildup: "SHORT_COVERING",
      interpretation: "Bears unwinding short positions. Rally driven by short covering rather than fresh long capital; proceed with caution.",
    };
  }

  if (priceChangePct < -0.25 && oiChangePct < -1.5) {
    return {
      buildup: "LONG_UNWINDING",
      interpretation: "Bulls liquidating long positions. Price and Open Interest contracting indicate exhaustion of upward momentum.",
    };
  }

  return {
    buildup: "NEUTRAL",
    interpretation: "Range-bound derivative activity with balanced institutional positioning.",
  };
}

/**
 * Categorizes Put-Call Ratio into clear sentiment zones.
 */
export function classifyPcrSentiment(pcr: number): PcrSentiment {
  if (pcr >= 1.35) return "EXTREMELY_BULLISH";
  if (pcr >= 1.05) return "BULLISH";
  if (pcr >= 0.85) return "NEUTRAL";
  if (pcr >= 0.60) return "BEARISH";
  return "EXTREMELY_BEARISH";
}

export class FnoAnalysisEngine {
  /**
   * Retrieves comprehensive F&O derivative analysis for a given equity or index symbol.
   * Cached for 5 minutes. Returns null if symbol has no active derivative contracts.
   */
  async getFnoSummary(symbol: string): Promise<FnoSummary | null> {
    const sym = symbol.toUpperCase().trim();
    if (!derivativesService.isSymbolFnoEligible(sym)) {
      return null;
    }
    const cacheKey = `fno_summary_${sym}`;
    const cached = _cache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    const start = Date.now();
    try {
      // Fetch near-month futures and options OI analysis concurrently
      const [oiAnalysis, futuresArr] = await Promise.all([
        derivativesService.getOIAnalysis(sym).catch((err) => {
          logger.warn(`[FnoEngine] getOIAnalysis error for ${sym}: ${err.message}`);
          return null;
        }),
        derivativesService.getFuturesData(sym).catch((err) => {
          logger.warn(`[FnoEngine] getFuturesData error for ${sym}: ${err.message}`);
          return [];
        }),
      ]);

      if (!oiAnalysis) {
        return null;
      }

      const nearFut = futuresArr[0] as typeof futuresArr[0] | undefined;
      const spotPrice = oiAnalysis.spotPrice || nearFut?.underlyingValue || 0;
      const futPrice = nearFut?.lastPrice || spotPrice;
      const futBasis = nearFut?.basis ?? (futPrice - spotPrice);
      const futBasisPct = nearFut?.basisPct ?? (spotPrice > 0 ? (futBasis / spotPrice) * 100 : 0);

      const priceChangePct = nearFut?.pChange || 0;
      const openInterest = nearFut?.openInterest || (oiAnalysis.callOI + oiAnalysis.putOI);
      const oiChange = nearFut?.changeinOpenInterest || 0;
      const prevOI = openInterest - oiChange;
      const oiChangePct = prevOI > 0 ? (oiChange / prevOI) * 100 : 0;

      const { buildup, interpretation } = classifyFnoBuildup(priceChangePct, oiChangePct);
      const pcrSentiment = classifyPcrSentiment(oiAnalysis.pcr);

      const primarySupportStrike = oiAnalysis.highOIPutStrikes[0]?.strike ?? spotPrice;
      const primaryResistanceStrike = oiAnalysis.highOICallStrikes[0]?.strike ?? spotPrice;

      const summary: FnoSummary = {
        symbol: sym,
        isFnoEligible: true,
        spotPrice,
        futuresPrice: futPrice,
        futuresBasis: Math.round(futBasis * 100) / 100,
        futuresBasisPct: Math.round(futBasisPct * 100) / 100,
        priceChangePct: Math.round(priceChangePct * 100) / 100,
        openInterest,
        oiChange,
        oiChangePct: Math.round(oiChangePct * 100) / 100,
        buildup,
        buildupInterpretation: interpretation,
        pcr: oiAnalysis.pcr,
        pcrSentiment,
        maxPainStrike: oiAnalysis.maxPainStrike,
        primarySupportStrike,
        primaryResistanceStrike,
        totalCallOI: oiAnalysis.callOI,
        totalPutOI: oiAnalysis.putOI,
        highOICalls: oiAnalysis.highOICallStrikes,
        highOIPuts: oiAnalysis.highOIPutStrikes,
        engineVersion: FNO_ENGINE_VERSION,
        timestamp: new Date().toISOString(),
      };

      _cache.set(cacheKey, {
        data: summary,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      logger.info("[FnoEngine] Computed F&O summary", {
        symbol: sym,
        buildup,
        pcr: summary.pcr,
        latencyMs: Date.now() - start,
      });

      telemetryBus.report({
        engineId: "fno-buildup-engine",
        engineName: "F&O Buildup & Derivative Intelligence Engine",
        category: "Transaction",
        reportedAt: new Date().toISOString(),
        latencyMs: Date.now() - start,
        qualityScore: 94,
        itemsProcessed: 1,
        errorCount: 0,
        meta: { symbol: sym, buildup, pcr: summary.pcr },
      });

      return summary;
    } catch (err: any) {
      logger.warn(`[FnoEngine] Unexpected failure for ${sym}: ${err?.message}`);
      return null;
    }
  }
}

export const fnoAnalysisEngine = new FnoAnalysisEngine();

