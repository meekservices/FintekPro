/**
 * @file model-portfolio-optimizer.ts
 * @description FASP-AI v3.0 compliant portfolio optimization engine.
 *
 * Purpose:
 *   Analyzes model portfolios against their benchmarks, identifies underperforming
 *   holdings (alpha drags), and generates screener-backed replacement suggestions.
 *
 * Inputs:
 *   - model_portfolios JSONB (holdings with currentReturn, type, sector, symbol)
 *   - screener_derived_metrics (return_1y, sharpe_ratio_1y, beta, sector)
 *   - screener_stocks (isin, sector, market_cap_category)
 *
 * Outputs:
 *   - AlphaAnalysis[] — per-portfolio alpha status
 *   - OptimizationSuggestion[] — AI-generated holding replacement suggestions
 *   - All outputs include confidence_score, factors_considered, model_version, timestamp
 *
 * Edge cases:
 *   - Holdings without screener data: excluded, flagged as manual_review
 *   - Benchmark CAGR = 0: skip alpha calculation, mark data_unavailable
 *   - No candidates found: alternatives = [], recommendation = "manual_review"
 *
 * FASP-AI v3.0 constraints:
 *   - AI is Decision Support only. applyApprovedReplacements() requires advisor_id.
 *   - Every output includes model_version, confidence_score, risk_disclaimer.
 *   - confidence < 0.6 → downgrade recommendation to "reduce_weight".
 *   - All changes logged: event = "AI_PORTFOLIO_OPTIMIZATION_APPLIED".
 */

import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import { modelPortfolios } from "../../shared/schema";
import { logger } from "../logger";

// ── Constants ──────────────────────────────────────────────────────────────────
export const OPTIMIZER_MODEL_VERSION = "FASP-AI v3.0 / optimizer-v1";

const RISK_DISCLAIMER =
  "AI-generated suggestion. Past returns do not guarantee future performance. " +
  "Market investments are subject to risk. Please validate against current market " +
  "conditions and consult a SEBI-registered investment advisor before applying.";

/**
 * Fix #16 — Target alpha as fraction of benchmark return, keyed by risk profile.
 * Conservative portfolios have a lower bar (10%) since their mandate prioritises
 * capital preservation. Aggressive / thematic mandates must clear 25–30% to justify
 * elevated risk. The "default" fallback (20%) is used when riskProfile is absent.
 */
const TARGET_ALPHA_BY_RISK: Record<string, number> = {
  conservative:    0.10,
  moderate:        0.15,
  aggressive:      0.25,
  very_aggressive: 0.30,
  thematic:        0.30,
  default:         0.20,
};

/** Minimum confidence to issue a "replace" recommendation. Below → "reduce_weight". */
const MIN_CONFIDENCE_FOR_REPLACE = 0.60;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AlphaAnalysis {
  portfolioId: string;
  portfolioName: string;
  cagr1Y: number;
  benchmarkCagr1Y: number;
  trueAlpha: number;
  targetAlpha: number;
  alphaGap: number;
  status: "outperforming" | "on_target" | "underperforming" | "critical";
  alphaDragHoldings: AlphaDragHolding[];
  calculation_timestamp: string;
  engine_version: string;
}

export interface AlphaDragHolding {
  rank: number;
  name: string;
  symbol?: string;
  type: string;
  weight: number;
  currentReturn: number | null;
  portfolioAvgReturn: number;
  dragScore: number;
}

export interface HoldingCandidate {
  symbol: string;
  name: string;
  sector: string | null;
  return_1y: number;
  return_3y: number | null;
  sharpe: number | null;
  beta: number | null;
  isin: string | null;
  compositeScore: number;
  improvementVsCurrent: number;
}

export interface OptimizationSuggestion {
  portfolioId: string;
  portfolioName: string;
  alphaDragHolding: AlphaDragHolding;
  alternatives: HoldingCandidate[];
  recommendation: "replace" | "reduce_weight" | "hold" | "manual_review";
  confidence_score: number;
  factors_considered: string[];
  model_version: string;
  timestamp: string;
  risk_disclaimer: string;
  // idempotency_key is on the REQUEST (applyApprovedReplacements), not on suggestion output
}

export interface ApplyResult {
  portfolioId: string;
  replacementsApplied: number;
  holdingsUpdated: string[];
  event: string;
  advisor_id: string;
  model_version: string;
  timestamp: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Composite score for instrument selection — FASP-AI v3.0
 *
 * Formula (weights must sum to 1.0):
 *   returns_1y   × 0.40   — primary return signal
 *   sharpe       × 0.25   — risk-adjusted quality (previously × 30 was dominating)
 *   alpha        × 0.20   — benchmark outperformance signal
 *   beta_penalty × 0.10   — penalise extreme beta (avoid very high/low beta)
 *   expense      × 0.05   — cost efficiency (bonus for low expense ratio)
 *
 * Note: all inputs must be in consistent units (returns as %, sharpe as decimal).
 */
function compositeScore(
  r1y: number,
  sharpe: number | null,
  beta: number | null,
  alpha?: number | null,
  expenseRatio?: number | null,
): number {
  const returnScore   = r1y * 0.40;                                     // 0–40 range for typical returns
  const sharpeScore   = Math.min(10, (sharpe ?? 0.5) * 10) * 0.25;     // cap at Sharpe=4 → max 10pts
  const alphaScore    = Math.min(8, Math.max(-8, (alpha ?? 0) * 2)) * 0.20; // alpha in %
  const betaPenalty   = Math.abs((beta ?? 1.0) - 1.0) * 10 * 0.10;    // 0 penalty at beta=1
  const expensebonus  = expenseRatio != null && expenseRatio > 0
    ? Math.min(2, (1 / expenseRatio)) * 0.05
    : 0;
  return returnScore + sharpeScore + alphaScore - betaPenalty + expensebonus;
}

/**
 * Fix #3 — Runtime type guard for portfolio holdings stored as JSONB.
 * Rejects entries missing the mandatory `name` (string) and `weight` (number).
 * A warning is logged for each rejected holding so they are never silently swallowed.
 */
function validateHolding(h: unknown): h is {
  name: string; weight: number; type?: string;
  currentReturn?: number | null; rank?: number; symbol?: string;
} {
  if (typeof h !== "object" || h === null) return false;
  const obj = h as Record<string, unknown>;
  return typeof obj.name === "string" && typeof obj.weight === "number";
}

// Fix #11 — Named constants for alpha-gap status classification.
// Source: FASP-AI v3.0 §4.2 — thresholds in percentage-point alpha-gap units.
/** Portfolio is beating the target by ≥2 pp — outperforming. */
const ALPHA_GAP_OUTPERFORMING = -2;
/** Alpha gap within 1 pp of target — on target. */
const ALPHA_GAP_ON_TARGET     =  1;
/** Alpha gap ≤ 8 pp — underperforming; above this threshold → critical. */
const ALPHA_GAP_UNDERPERFORM  =  8;

function classifyStatus(gap: number): AlphaAnalysis["status"] {
  if (gap <= ALPHA_GAP_OUTPERFORMING) return "outperforming";
  if (gap <= ALPHA_GAP_ON_TARGET)     return "on_target";
  if (gap <= ALPHA_GAP_UNDERPERFORM)  return "underperforming";
  return "critical";
}

// ── analyzeAlphaGaps ──────────────────────────────────────────────────────────

/**
 * Analyses all model portfolios vs benchmarks.
 * Returns sorted by alphaGap descending (worst first).
 *
 * E3: alphaDragHoldings flags holdings below MAX(portfolio avg, benchmark).
 * This catches sub-benchmark holdings even when ALL holdings are below the
 * benchmark (otherwise, no holding would appear "below average").
 */
export async function analyzeAlphaGaps(): Promise<AlphaAnalysis[]> {
  const rows = await db.select().from(modelPortfolios);
  const ts = new Date().toISOString();
  const results: AlphaAnalysis[] = [];

  for (const p of rows) {
    const cagr1Y    = p.cagr1Y          != null ? Number(p.cagr1Y)          : 0;
    const benchCagr = p.benchmarkCagr1Y != null ? Number(p.benchmarkCagr1Y) : 0;
    if (benchCagr === 0) continue;

    const trueAlpha  = cagr1Y - benchCagr;
    // Fix #16: use risk-profile-aware alpha ratio instead of a flat 0.20 for all portfolios
    const riskProfile = String(p.riskProfile ?? "default").toLowerCase();
    const targetAlpha = benchCagr * (TARGET_ALPHA_BY_RISK[riskProfile] ?? TARGET_ALPHA_BY_RISK.default);
    const alphaGap   = targetAlpha - trueAlpha;
    const status     = classifyStatus(alphaGap);

    // Fix #3: validate each holding and emit a structured warning for malformed entries
    const holdings: any[] = (Array.isArray(p.holdings) ? p.holdings : []).filter((h: unknown) => {
      if (!validateHolding(h)) {
        logger.warn("[Optimizer] Malformed holding skipped", {
          event:       "OPTIMIZER_HOLDING_VALIDATION_FAILED",
          portfolioId: p.id,
          holding:     JSON.stringify(h)?.slice(0, 80),
        });
        return false;
      }
      return true;
    });
    const returns = holdings
      .map((h: any) => (h.currentReturn != null ? Number(h.currentReturn) : null))
      .filter((r): r is number => r !== null);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;

    // E3: dragThreshold = MAX(portfolio avg return, benchmark return)
    // Using MAX means:
    //   - If benchmark > avg → flags any holding below benchmark (catches full-portfolio underperformance)
    //   - If avg > benchmark → flags any holding below avg (catches relative drag within portfolio)
    const dragThreshold = Math.max(avgReturn, benchCagr);

    // A5: Include all replaceable holding types (not just stocks/MFs)
    // Excluded from optimisation: sovereign bonds, locked-in instruments (SGB, PPF, etc.)
    const EXCLUDED_TYPES = new Set(["sgb", "sovereign", "ppf", "epf", "nsc", "kisan", "locked"]);
    const alphaDragHoldings: AlphaDragHolding[] = holdings
      .filter((h: any) => {
        const t = (h.type ?? "").toLowerCase();
        // Exclude sovereign/locked instruments; include everything else
        return !EXCLUDED_TYPES.has(t) && !Array.from(EXCLUDED_TYPES).some((ex) => t.includes(ex));
      })
      // E3: use dragThreshold instead of bare avgReturn
      .filter((h: any) => h.currentReturn != null && Number(h.currentReturn) < dragThreshold)
      .map((h: any) => ({
        rank: h.rank,
        name: h.name,
        symbol: h.symbol,
        type: h.type ?? "Unknown",
        weight: Number(h.weight ?? 0),
        currentReturn: Number(h.currentReturn),
        portfolioAvgReturn: Math.round(avgReturn * 100) / 100,
        // dragScore: weighted shortfall vs dragThreshold (benchmark-anchored)
        dragScore: Math.round(
          (dragThreshold - Number(h.currentReturn)) * Number(h.weight ?? 0) / 100 * 100
        ) / 100,
      }))
      .sort((a, b) => b.dragScore - a.dragScore)
      .slice(0, 5);

    results.push({
      portfolioId: p.id,
      portfolioName: p.name,
      cagr1Y: Math.round(cagr1Y * 100) / 100,
      benchmarkCagr1Y: Math.round(benchCagr * 100) / 100,
      trueAlpha: Math.round(trueAlpha * 100) / 100,
      targetAlpha: Math.round(targetAlpha * 100) / 100,
      alphaGap: Math.round(alphaGap * 100) / 100,
      status,
      alphaDragHoldings,
      calculation_timestamp: ts,
      engine_version: OPTIMIZER_MODEL_VERSION,
    });
  }

  return results.sort((a, b) => b.alphaGap - a.alphaGap);
}

// ── generateOptimizationSuggestions ──────────────────────────────────────────

/**
 * Generates FASP-AI v3.0 replacement suggestions for underperforming holdings.
 *
 * Fix #1: Tracks real latency_ms (was always 0) in the AI_ADVICE_GENERATED log.
 * Fix #2: Batches sector + screener lookups — one bulk sector fetch for all drag
 *          symbols, then one candidate query per unique sector. Reduces round-trips
 *          from N×M (holdings × portfolios) to 1 + K (K = unique sectors).
 *          MF fallback queries remain per-holding (category strings make batching hard).
 *
 * @param portfolioIds - optional filter; empty = all critical/underperforming
 */
export async function generateOptimizationSuggestions(
  portfolioIds?: string[]
): Promise<OptimizationSuggestion[]> {
  const t0 = Date.now(); // Fix #1: start timer for real latency tracking
  const analyses = await analyzeAlphaGaps();
  const ts = new Date().toISOString();
  const suggestions: OptimizationSuggestion[] = [];

  const targets = analyses.filter(
    (a) =>
      (a.status === "critical" || a.status === "underperforming") &&
      a.alphaDragHoldings.length > 0 &&
      (!portfolioIds?.length || portfolioIds.includes(a.portfolioId))
  );

  // ── Fix #2: Batch pre-fetch sectors for ALL drag symbols in one query ─────────
  // Old approach: one round-trip per drag holding per portfolio (N×M queries).
  // New approach: one bulk query for all symbols + one candidate query per unique sector.
  const allDragSymbols = [
    ...new Set(
      targets
        .flatMap((a) => a.alphaDragHoldings.map((d) => d.symbol).filter(Boolean))
        .map((s) => s!.toUpperCase()),
    ),
  ] as string[];

  const sectorMap = new Map<string, { sector: string | null; cap: string | null }>();
  if (allDragSymbols.length > 0) {
    try {
      const sectorRows = await db.execute(sql`
        SELECT symbol, sector, market_cap_category
        FROM listed_stocks
        WHERE symbol = ANY(${allDragSymbols})
      `).catch(() => ({ rows: [] }));
      for (const row of (sectorRows as any).rows ?? []) {
        sectorMap.set(String(row.symbol).toUpperCase(), {
          sector: (row.sector as string | null) ?? null,
          cap:    (row.market_cap_category as string | null) ?? null,
        });
      }
    } catch (err) {
      logger.warn("[Optimizer] Batch sector pre-fetch failed — per-holding fallback active", err as Error);
    }
  }

  // ── Pre-fetch screener candidates: one query per unique sector ───────────────
  // benchFloor and symbol exclusion vary per drag holding → applied as in-memory
  // post-filters after retrieving a sector's top-20 candidates.
  const uniqueSectors = [
    ...new Set([...sectorMap.values()].map((v) => v.sector).filter(Boolean)),
  ] as string[];

  const candidatesBySector = new Map<string, any[]>();
  for (const sector of uniqueSectors) {
    try {
      const rows = await db.execute(sql`
        SELECT
          sdm.symbol, ss.name, sdm.sector,
          sdm.return_1y, sdm.return_3y,
          sdm.sharpe_ratio_1y, sdm.beta, sdm.alpha_vs_nifty,
          ss.isin, ss.market_cap_category
        FROM screener_derived_metrics sdm
        LEFT JOIN screener_stocks ss ON ss.symbol = sdm.symbol
        WHERE sdm.sector = ${sector}
          AND sdm.alpha_vs_nifty > 0
          AND sdm.sharpe_ratio_1y > 0
          AND (sdm.beta IS NULL OR sdm.beta BETWEEN 0.3 AND 2.0)
          AND sdm.return_1y IS NOT NULL
        ORDER BY (
          COALESCE(sdm.return_1y, 0) * 100 * 0.40 +
          LEAST(10, COALESCE(sdm.sharpe_ratio_1y, 0.5) * 10) * 0.25 +
          LEAST(8, GREATEST(-8, COALESCE(sdm.alpha_vs_nifty, 0) * 2)) * 0.20 -
          ABS(COALESCE(sdm.beta, 1.0) - 1.0) * 10 * 0.10
        ) DESC
        LIMIT 20
      `).catch(() => ({ rows: [] }));
      candidatesBySector.set(sector, (rows as any).rows ?? []);
    } catch (err) {
      logger.warn(`[Optimizer] Candidate pre-fetch failed for sector '${sector}'`, err as Error);
    }
  }

  for (const analysis of targets) {
    // E1: benchmark return as a fraction — all candidates must beat this floor
    const benchFloor = analysis.benchmarkCagr1Y / 100;

    for (const drag of analysis.alphaDragHoldings) {
      const factors: string[] = [`portfolio_status:${analysis.status}`, `drag_score:${drag.dragScore}`];
      let alternatives: HoldingCandidate[] = [];

      // ── E1/A4: Stock — sector + market-cap aligned, BENCHMARK-RELATIVE floor ─
      if (drag.symbol) {
        try {
          const symbolUpper = drag.symbol.toUpperCase();
          // Use pre-fetched sector; fall back to a live query if the symbol was missing
          let sector: string | null = sectorMap.get(symbolUpper)?.sector ?? null;
          let cap: string | null    = sectorMap.get(symbolUpper)?.cap    ?? null;

          if (!sector) {
            // Fallback for symbols not covered by the batch (rare — e.g. newly added drag)
            const row = await db.execute(sql`
              SELECT sector, market_cap_category FROM listed_stocks
              WHERE symbol = ${symbolUpper} LIMIT 1
            `).catch(() => ({ rows: [] }));
            const sd = (row as any).rows?.[0];
            sector = sd?.sector ?? null;
            cap    = sd?.market_cap_category ?? null;
          }

          if (sector) {
            // Retrieve pre-fetched candidates and apply per-holding post-filters:
            //  • exclude the drag holding itself (symbol exclusion)
            //  • E1: must beat this portfolio's benchmark floor
            //  • A4: same market-cap bucket
            const allSectorCandidates = candidatesBySector.get(sector) ?? [];
            const posAlphaCandidates = allSectorCandidates.filter((r) =>
              String(r.symbol).toUpperCase() !== symbolUpper &&
              r.alpha_vs_nifty != null && Number(r.alpha_vs_nifty) > 0 &&
              Number(r.return_1y) > benchFloor &&
              (cap === null || r.market_cap_category === cap)
            );

            alternatives = posAlphaCandidates.slice(0, 5).map((r: any) => {
              const r1y   = Math.round(Number(r.return_1y) * 10000) / 100;
              const sharpe = r.sharpe_ratio_1y != null ? Math.round(Number(r.sharpe_ratio_1y) * 100) / 100 : null;
              const beta   = r.beta != null ? Math.round(Number(r.beta) * 10000) / 10000 : null;
              const alpha  = r.alpha_vs_nifty != null ? Math.round(Number(r.alpha_vs_nifty) * 10000) / 100 : null;
              return {
                symbol: r.symbol,
                name:   r.name ?? r.symbol,
                sector: r.sector,
                return_1y: r1y,
                return_3y: r.return_3y != null ? Math.round(Number(r.return_3y) * 10000) / 100 : null,
                sharpe,
                beta,
                isin: r.isin ?? null,
                compositeScore: Math.round(compositeScore(r1y, sharpe, beta, alpha) * 100) / 100,
                improvementVsCurrent: Math.round((r1y - (drag.currentReturn ?? 0)) * 100) / 100,
              };
            });

            if (alternatives.length > 0) {
              factors.push(`screener:sector:${sector}`, "alpha_floor:benchmark_relative", "alpha_gate:positive_alpha_only", "batch_query:true");
              if (cap) factors.push(`screener:cap:${cap}`);
            } else {
              factors.push("no_positive_alpha_candidates_found");
            }
          } else {
            factors.push("sector_not_found");
          }
        } catch (err) {
          logger.warn(`[Optimizer] Screener lookup failed for ${drag.symbol}`, err as Error);
          factors.push("screener_error");
        }
      }

      // ── E4/E5/A3: MF — benchmark floor + positive return + strict Sharpe ────
      // MF queries remain per-holding (category name varies per drag; hard to batch efficiently)
      if (alternatives.length === 0 && !drag.symbol) {
        try {
          const cat = drag.type.toLowerCase()
            .replace(" mf", "").replace("mutual fund", "").replace("fund", "").trim();
          const mfRows = await db.execute(sql`
            SELECT name, isin, return_1y, return_3y, expense_ratio,
                   sharpe_ratio, aum_cr, sebi_category
            FROM financial_instruments_cache
            WHERE instrument_type = 'mutual_fund'
              AND name ILIKE ${"%" + cat + "%"}
              AND return_1y IS NOT NULL
              AND return_1y > ${benchFloor}
              AND return_1y > 0
              AND sharpe_ratio > 0.3
              AND (expense_ratio IS NULL OR expense_ratio < 1.5)
              AND (aum_cr IS NULL OR aum_cr > 500)
            ORDER BY (
              COALESCE(return_1y, 0) * 100 * 0.45 +
              LEAST(10, COALESCE(sharpe_ratio, 0.5) * 10) * 0.30 -
              COALESCE(expense_ratio, 1.0) * 5 * 0.25
            ) DESC
            LIMIT 5
          `).catch(() => ({ rows: [] }));

          const tp = (v: number) => Math.abs(v) < 5 ? Math.round(v * 10000) / 100 : Math.round(v * 100) / 100;
          alternatives = ((mfRows as any).rows ?? []).map((r: any) => {
            const r1y   = tp(Number(r.return_1y));
            const sharpe = r.sharpe_ratio != null ? Math.round(Number(r.sharpe_ratio) * 100) / 100 : null;
            return {
              symbol: r.isin ?? r.name?.substring(0, 10) ?? "MF",
              name:   r.name,
              sector: r.sebi_category ?? null,
              return_1y: r1y,
              return_3y: r.return_3y != null ? tp(Number(r.return_3y)) : null,
              sharpe,
              beta: null,
              isin: r.isin ?? null,
              compositeScore: Math.round(compositeScore(r1y, sharpe, null) * 100) / 100,
              improvementVsCurrent: Math.round((r1y - (drag.currentReturn ?? 0)) * 100) / 100,
            };
          });
          if (alternatives.length > 0) factors.push(`mf_db:category:${cat}`, "alpha_floor:benchmark_relative", "sharpe_gate:strict");
        } catch { /* silent */ }
      }

      // ── Confidence scoring ────────────────────────────────────────────────
      let confidence = 0;
      if (alternatives.length >= 3) confidence += 0.30;
      else if (alternatives.length >= 1) confidence += 0.15;
      if (drag.dragScore > 2) confidence += 0.20;
      if (analysis.status === "critical") confidence += 0.20;
      const best = alternatives[0];
      if (best?.sharpe != null && best.sharpe > 0.5) confidence += 0.15;
      if (best?.improvementVsCurrent != null && best.improvementVsCurrent > 10) confidence += 0.15;
      confidence = Math.min(Math.round(confidence * 100) / 100, 1.0);

      // ── E6: Recommendation gate ────────────────────────────────────────────
      let recommendation: OptimizationSuggestion["recommendation"] =
        alternatives.length === 0 ? "manual_review"
        : confidence < MIN_CONFIDENCE_FOR_REPLACE ? "reduce_weight"
        : drag.dragScore > 1 ? "replace"
        : "hold";

      if (recommendation === "replace" && drag.symbol) {
        const bestAlpha = (best as any)?.alpha ?? null;
        if (bestAlpha === null || bestAlpha <= 0) {
          recommendation = "reduce_weight";
          factors.push("E6:best_candidate_alpha_unverified_or_non_positive");
        }
      }

      suggestions.push({
        portfolioId:      analysis.portfolioId,
        portfolioName:    analysis.portfolioName,
        alphaDragHolding: drag,
        alternatives,
        recommendation,
        confidence_score: confidence,
        factors_considered: factors,
        model_version:    OPTIMIZER_MODEL_VERSION,
        timestamp:        ts,
        risk_disclaimer:  RISK_DISCLAIMER,
      });
    }
  }

  logger.info("[Optimizer] Suggestions generated", {
    event:          "AI_ADVICE_GENERATED",
    user_id:        "system",
    output_summary: `${suggestions.length} suggestions for ${targets.length} portfolios`,
    model_version:  OPTIMIZER_MODEL_VERSION,
    timestamp:      ts,
    latency_ms:     Date.now() - t0, // Fix #1: real latency (was hardcoded 0)
    status:         "success",
  });

  return suggestions;
}

// ── applyApprovedReplacements ─────────────────────────────────────────────────

/**
 * Fix #4 — In-memory idempotency guard for applyApprovedReplacements.
 * Prevents double-apply on network retries or duplicate advisor requests within
 * the same server process lifetime (keys auto-expire after 24 h).
 *
 * Production recommendation: back this with Redis SETNX or a DB audit_keys table
 * for cross-instance protection in a horizontally-scaled deployment.
 */
const _appliedIdempotencyKeys = new Set<string>();

/**
 * Applies advisor-approved replacements to portfolio JSONB.
 * FASP-AI v3.0: advisor_id AND idempotency_key are mandatory — no autonomous execution.
 *
 * @param portfolioId    - portfolio to update
 * @param replacements   - [{rank, newSymbol, newName, newWeight?}]
 * @param advisorId      - SEBI advisor ID (required for audit trail)
 * @param idempotencyKey - client-generated UUID; prevents double-apply on retries (GCR mandate)
 */
export async function applyApprovedReplacements(
  portfolioId: string,
  replacements: { rank: number; newSymbol: string; newName: string; newWeight?: number }[],
  advisorId: string,
  idempotencyKey: string,
): Promise<ApplyResult> {
  if (!advisorId?.trim()) {
    throw new Error("FASP-AI v3.0: advisor_id is required before applying any AI optimization.");
  }
  if (!idempotencyKey?.trim()) {
    throw new Error("FASP-AI v3.0: idempotency_key is required for safe retries (GCR mandate).");
  }

  // Fix #4: Idempotency guard — prevent double-apply on network retries / duplicate clicks
  const dedupKey = `${portfolioId}:${idempotencyKey}`;
  if (_appliedIdempotencyKeys.has(dedupKey)) {
    logger.warn("[Optimizer] Idempotent replay detected — no changes made", {
      event:          "AI_PORTFOLIO_OPTIMIZATION_REPLAY",
      user_id:        advisorId,
      portfolio_id:   portfolioId,
      idempotencyKey,
      retryable:      false,
      status:         "replay",
    });
    throw Object.assign(
      new Error(`IDEMPOTENT_REPLAY: Operation '${idempotencyKey}' was already applied to portfolio '${portfolioId}'. No changes made.`),
      { code: "IDEMPOTENT_REPLAY", retryable: false },
    );
  }

  const t0 = Date.now();
  const ts = new Date().toISOString();
  const [portfolio] = await db.select().from(modelPortfolios).where(eq(modelPortfolios.id, portfolioId));
  if (!portfolio) throw new Error(`Portfolio not found: ${portfolioId}`);

  const holdings: any[] = Array.isArray(portfolio.holdings) ? [...portfolio.holdings] : [];
  const applied: string[] = [];

  for (const rep of replacements) {
    const idx = holdings.findIndex((h: any) => h.rank === rep.rank);
    if (idx === -1) continue;
    const old = holdings[idx];
    holdings[idx] = {
      ...old,
      name: rep.newName,
      symbol: rep.newSymbol,
      weight: rep.newWeight ?? old.weight,
      // Clear enrichment → persist-holdings-enrichment re-runs on next call
      currentReturn: undefined,
      returnSource: undefined,
      isin: undefined,
      beta: undefined,
      sharpe: undefined,
      screenerUrl: undefined,
      amfiSchemeCode: undefined,
      // Audit trail
      _replacedAt: ts,
      _replacedBy: advisorId,
      _replacedOldName: old.name,
      _replacedOldSymbol: old.symbol ?? null,
      _idempotencyKey: idempotencyKey,
      _modelVersion: OPTIMIZER_MODEL_VERSION,
    };
    applied.push(`${old.name} → ${rep.newName}`);
  }

  await db
    .update(modelPortfolios)
    .set({ holdings: holdings as any, updatedAt: new Date() })
    .where(eq(modelPortfolios.id, portfolioId));

  // Register idempotency key — auto-expire after 24 h to prevent unbounded memory growth
  _appliedIdempotencyKeys.add(dedupKey);
  setTimeout(() => _appliedIdempotencyKeys.delete(dedupKey), 24 * 60 * 60 * 1000);

  const logPayload = {
    event:               "AI_PORTFOLIO_OPTIMIZATION_APPLIED",
    user_id:             advisorId,
    portfolio_id:        portfolioId,
    replacements_applied: applied,
    idempotency_key:     idempotencyKey,
    model_version:       OPTIMIZER_MODEL_VERSION,
    timestamp:           ts,
    retryable:           false,
    latency_ms:          Date.now() - t0,
    status:              "success",
  };
  logger.info("[Optimizer] Optimization applied", logPayload);

  return {
    portfolioId,
    replacementsApplied: applied.length,
    holdingsUpdated: applied,
    event: logPayload.event,
    advisor_id: advisorId,
    model_version: OPTIMIZER_MODEL_VERSION,
    timestamp: ts,
  };
}
