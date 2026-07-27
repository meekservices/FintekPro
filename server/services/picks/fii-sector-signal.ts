/**
 * @file fii-sector-signal.ts
 * @description FII/DII flow-based sector rotation signal for the Pick of the Day engine.
 *
 * Purpose:
 *   FII (Foreign Institutional Investor) net flows are the single most reliable
 *   macro indicator for short-term sector rotation in Indian markets.
 *   - FII net buyer (positive flow) → risk-on, cyclicals preferred (Banking, IT, Auto)
 *   - FII net seller (negative flow) → risk-off, defensives preferred (FMCG, Pharma)
 *   - DII net buyer offsets FII selling → moderate signal strength
 *
 * Design Principles (FASP-AI v3.0):
 *   - This is a Decision Support Signal only — it reorders sector priority and
 *     applies a score bias. It NEVER autonomously selects or rejects a pick.
 *   - Non-fatal: if FII data is unavailable, engine proceeds with neutral ordering.
 *   - Cached per day: one MrChartist API call per market day (TTL 4h).
 *   - Score impact is bounded: max ±8 points (vs 120-pt total) — intentionally modest
 *     to avoid over-rotating into correlated picks.
 *
 * Architecture:
 *   Background cron (5:30 PM IST) → fetchFIISectorSignal() → cached in module-level var
 *   StockStrategy.generate() → getSectorPriorityOrder() to reorder BROAD_SECTORS loop
 *   StockStrategy.score()    → getFIISectorScoreBoost() to add ±8 pts per stock
 *
 * FASP-AI v3.0: all outputs carry { signal, confidence, factors_considered, model_version }.
 */

import { indianApiService } from "../indian-api-service";
import { logger } from "../../logger";

// ── Types ────────────────────────────────────────────────────────────────────

export type BroadSectorId =
  | "banking_finance"
  | "information_technology"
  | "healthcare_pharma"
  | "auto_infra"
  | "fmcg_consumer";

export interface FIISectorSignal {
  /** Date the FII data is for (YYYY-MM-DD) */
  date: string;
  /** FII aggregate net flow in Crores (positive = net buyer, negative = net seller) */
  fiiNetCr: number;
  /** DII aggregate net flow in Crores */
  diiNetCr: number;
  /**
   * Combined sentiment: RISK_ON | RISK_OFF | NEUTRAL
   * RISK_ON  → cyclicals preferred (Banking, IT, Auto)
   * RISK_OFF → defensives preferred (FMCG, Pharma)
   * NEUTRAL  → no reordering, minimal score impact
   */
  sentiment: "RISK_ON" | "RISK_OFF" | "NEUTRAL";
  /**
   * Score boost (+ve) or penalty (-ve) per broad sector.
   * Bounded to [-8, +8] to avoid dominance over fundamental signals.
   */
  sectorScoreAdjustment: Record<BroadSectorId, number>;
  /**
   * Sector priority order — sectors earlier in the array are tried first in the BROAD_SECTORS loop.
   * This gives FII-favoured sectors a higher chance of being selected on net-positive flow days.
   */
  priorityOrder: BroadSectorId[];
  /** Signal confidence 0.0–1.0 (degrades when DII strongly offsets FII, or both are ~0) */
  confidence: number;
  /** FASP-AI v3.0 metadata */
  meta: {
    model_version: string;
    factors_considered: string[];
    disclaimer: string;
    retrievedAt: string;
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

const MODEL_VERSION = "fii-sector-signal/v1.0";
const SIGNAL_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Threshold (Cr) below which FII flow is considered NEUTRAL.
 * Prevents noise from small +/- 50 Cr flows from triggering sector rotation.
 */
const NEUTRAL_THRESHOLD_CR = 200;

/**
 * Sector priority for RISK_ON (FII net buyer) days.
 * Banking/Finance and IT receive the most FII inflows in bull runs.
 * Auto/Infra follows as capex cycle picks up.
 */
const RISK_ON_ORDER: BroadSectorId[] = [
  "banking_finance",
  "information_technology",
  "auto_infra",
  "fmcg_consumer",
  "healthcare_pharma",
];

/**
 * Sector priority for RISK_OFF (FII net seller) days.
 * Defensives (FMCG, Pharma) hold up better in sell-offs.
 * Healthcare tends to be non-cyclical.
 */
const RISK_OFF_ORDER: BroadSectorId[] = [
  "healthcare_pharma",
  "fmcg_consumer",
  "information_technology",  // IT is partially defensive (USD revenue hedge)
  "auto_infra",
  "banking_finance",
];

/**
 * Neutral order — standard BROAD_SECTORS declaration order.
 */
const NEUTRAL_ORDER: BroadSectorId[] = [
  "banking_finance",
  "information_technology",
  "healthcare_pharma",
  "auto_infra",
  "fmcg_consumer",
];

// ── Cache ────────────────────────────────────────────────────────────────────

let _cached: FIISectorSignal | null = null;
let _cachedAt = 0;

// ── Core logic ───────────────────────────────────────────────────────────────

/**
 * Derives FII/DII sector rotation signal from aggregate net flows.
 *
 * @param fiiNetCr FII net flow in Crores
 * @param diiNetCr DII net flow in Crores
 * @param date     Data date string
 * @returns        FIISectorSignal
 *
 * Algorithm:
 *   1. Compute "effective" signal = fiiNetCr + 0.3 × diiNetCr
 *      (DII partially offsets FII: DII buying on FII sell-off = moderate signal)
 *   2. If effective < -NEUTRAL_THRESHOLD_CR → RISK_OFF
 *      If effective > +NEUTRAL_THRESHOLD_CR → RISK_ON
 *      Else → NEUTRAL
 *   3. Score adjustments are proportional to flow magnitude, capped at ±8.
 *   4. Confidence = min(1, |fiiNetCr| / 2000) — full confidence at ₹2000 Cr flow.
 */
function deriveSignal(fiiNetCr: number, diiNetCr: number, date: string): FIISectorSignal {
  const effectiveFlow = fiiNetCr + 0.3 * diiNetCr;
  const magnitude = Math.abs(effectiveFlow);

  // Sentiment classification
  let sentiment: FIISectorSignal["sentiment"];
  if (effectiveFlow > NEUTRAL_THRESHOLD_CR) sentiment = "RISK_ON";
  else if (effectiveFlow < -NEUTRAL_THRESHOLD_CR) sentiment = "RISK_OFF";
  else sentiment = "NEUTRAL";

  // Confidence: 0.0 at <₹200Cr flow, 1.0 at ≥₹2000Cr flow
  const confidence = Math.min(1.0, magnitude / 2000);

  // Score adjustment per sector (bounded to ±8)
  // RISK_ON:  cyclicals get +boost, defensives get mild negative
  // RISK_OFF: defensives get +boost, cyclicals get mild negative
  // Scale by confidence so small flows yield small adjustments
  const maxBoost = 8;
  const boost = Math.round(maxBoost * confidence);
  const penalty = -Math.round((maxBoost / 2) * confidence);

  let sectorScoreAdjustment: Record<BroadSectorId, number>;
  let priorityOrder: BroadSectorId[];

  if (sentiment === "RISK_ON") {
    sectorScoreAdjustment = {
      banking_finance:       boost,
      information_technology: boost,
      auto_infra:            Math.round(boost * 0.6),
      fmcg_consumer:         penalty,
      healthcare_pharma:     penalty,
    };
    priorityOrder = RISK_ON_ORDER;
  } else if (sentiment === "RISK_OFF") {
    sectorScoreAdjustment = {
      healthcare_pharma:     boost,
      fmcg_consumer:         boost,
      information_technology: Math.round(boost * 0.4),   // partial defensive
      auto_infra:            penalty,
      banking_finance:       Math.round(penalty * 1.3), // banks hit hardest in sell-off
    };
    priorityOrder = RISK_OFF_ORDER;
  } else {
    sectorScoreAdjustment = {
      banking_finance:       0,
      information_technology: 0,
      healthcare_pharma:     0,
      auto_infra:            0,
      fmcg_consumer:         0,
    };
    priorityOrder = NEUTRAL_ORDER;
  }

  return {
    date,
    fiiNetCr,
    diiNetCr,
    sentiment,
    sectorScoreAdjustment,
    priorityOrder,
    confidence,
    meta: {
      model_version: MODEL_VERSION,
      factors_considered: [
        `FII net flow: ₹${fiiNetCr.toFixed(0)} Cr`,
        `DII net flow: ₹${diiNetCr.toFixed(0)} Cr`,
        `Effective flow: ₹${effectiveFlow.toFixed(0)} Cr`,
        `Sentiment: ${sentiment}`,
        `Confidence: ${(confidence * 100).toFixed(0)}%`,
        `Score adjustments: max ±${boost}pts`,
      ],
      disclaimer:
        "FII/DII flow is a macro signal only — individual stock fundamentals take precedence. " +
        "Sector rotation signal has max ±8pt weight vs 120pt total score. " +
        "Not a guarantee of sectoral outperformance. Market risk applies.",
      retrievedAt: new Date().toISOString(),
    },
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches and caches today's FII/DII sector signal.
 * Cached for 4 hours to avoid repeated MrChartist API calls during scoring loops.
 *
 * @returns FIISectorSignal (or null on fetch failure — engine proceeds with NEUTRAL)
 */
export async function fetchFIISectorSignal(): Promise<FIISectorSignal | null> {
  const now = Date.now();
  if (_cached && now - _cachedAt < SIGNAL_CACHE_TTL_MS) {
    return _cached;
  }

  try {
    const result = await indianApiService.getLatestFIIDII();
    if (!result.success || !result.data) {
      logger.warn("[FIISectorSignal] FII/DII data unavailable — using NEUTRAL signal");
      return null;
    }

    const { fii, dii, date } = result.data;
    const signal = deriveSignal(fii.net, dii.net, date);

    _cached = signal;
    _cachedAt = now;

    logger.info("[FIISectorSignal] Signal computed", {
      event: "FII_SECTOR_SIGNAL_COMPUTED",
      user_id: "SYSTEM",
      latency_ms: 0,
      status: "success",
      sentiment: signal.sentiment,
      fiiNetCr: signal.fiiNetCr,
      diiNetCr: signal.diiNetCr,
      confidence: signal.confidence,
      priorityOrder: signal.priorityOrder,
      model_version: MODEL_VERSION,
    });

    return signal;
  } catch (err) {
    logger.warn(
      `[FIISectorSignal] Failed to fetch FII/DII data (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Returns the score adjustment for a given broad sector based on today's FII signal.
 * Safe to call even if signal is null (returns 0).
 *
 * @param signal     Today's FII sector signal (can be null)
 * @param broadSectorId  One of the 5 BROAD_SECTOR ids
 */
export function getFIISectorScoreBoost(
  signal: FIISectorSignal | null,
  broadSectorId: string,
): number {
  if (!signal) return 0;
  return signal.sectorScoreAdjustment[broadSectorId as BroadSectorId] ?? 0;
}

/**
 * Returns the sector priority order from the FII signal.
 * If signal is null, falls back to the default NEUTRAL_ORDER.
 *
 * @param signal  Today's FII sector signal (can be null)
 */
export function getSectorPriorityOrder(
  signal: FIISectorSignal | null,
): BroadSectorId[] {
  return signal?.priorityOrder ?? NEUTRAL_ORDER;
}

/**
 * Reorders BROAD_SECTORS array according to FII signal priority.
 * Takes the original typed array and returns a new array with sectors
 * in FII-derived priority order.
 *
 * @param broadSectors The original BROAD_SECTORS const array
 * @param signal       Today's FII signal
 */
export function reorderBroadSectorsByFII<
  T extends { id: string }
>(broadSectors: readonly T[], signal: FIISectorSignal | null): T[] {
  const order = getSectorPriorityOrder(signal);
  const orderMap: Map<string, number> = new Map(order.map((id, idx) => [id, idx]));

  return [...broadSectors].sort((a, b) => {
    const ai = orderMap.get(a.id) ?? 99;
    const bi = orderMap.get(b.id) ?? 99;
    return ai - bi;
  });
}
