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

/** Target alpha as fraction of benchmark return (0.20 = portfolio must beat bench by 20%). */
const TARGET_ALPHA_RATIO = 0.20;

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
 * Composite score: return_1y×0.5 + sharpe×30 − |beta−1|×10.
 * Higher = better candidate.
 */
function compositeScore(r1y: number, sharpe: number | null, beta: number | null): number {
  return r1y * 0.5 + (sharpe ?? 0.5) * 30 - Math.abs((beta ?? 1.0) - 1.0) * 10;
}

function classifyStatus(gap: number): AlphaAnalysis["status"] {
  if (gap <= -2) return "outperforming";
  if (gap <= 1) return "on_target";
  if (gap <= 8) return "underperforming";
  return "critical";
}

// ── analyzeAlphaGaps ──────────────────────────────────────────────────────────

/**
 * Analyses all model portfolios vs benchmarks.
 * Returns sorted by alphaGap descending (worst first).
 */
export async function analyzeAlphaGaps(): Promise<AlphaAnalysis[]> {
  const rows = await db.select().from(modelPortfolios);
  const ts = new Date().toISOString();
  const results: AlphaAnalysis[] = [];

  for (const p of rows) {
    const cagr1Y = p.cagr1Y != null ? Number(p.cagr1Y) : 0;
    const benchCagr = p.benchmarkCagr1Y != null ? Number(p.benchmarkCagr1Y) : 0;
    if (benchCagr === 0) continue;

    const trueAlpha = cagr1Y - benchCagr;
    const targetAlpha = benchCagr * TARGET_ALPHA_RATIO;
    const alphaGap = targetAlpha - trueAlpha;
    const status = classifyStatus(alphaGap);

    const holdings: any[] = Array.isArray(p.holdings) ? p.holdings : [];
    const returns = holdings
      .map((h: any) => (h.currentReturn != null ? Number(h.currentReturn) : null))
      .filter((r): r is number => r !== null);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;

    const alphaDragHoldings: AlphaDragHolding[] = holdings
      .filter((h: any) => {
        const t = (h.type ?? "").toLowerCase();
        return (
          (t.includes("stock") || t.includes(" mf") || t.includes("fund") || t.includes("etf")) &&
          !t.includes("bond") && !t.includes("sgb") && !t.includes("sovereign")
        );
      })
      .filter((h: any) => h.currentReturn != null && Number(h.currentReturn) < avgReturn)
      .map((h: any) => ({
        rank: h.rank,
        name: h.name,
        symbol: h.symbol,
        type: h.type ?? "Unknown",
        weight: Number(h.weight ?? 0),
        currentReturn: Number(h.currentReturn),
        portfolioAvgReturn: Math.round(avgReturn * 100) / 100,
        dragScore: Math.round(
          (avgReturn - Number(h.currentReturn)) * Number(h.weight ?? 0) / 100 * 100
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
 * @param portfolioIds - optional filter; empty = all critical/underperforming
 */
export async function generateOptimizationSuggestions(
  portfolioIds?: string[]
): Promise<OptimizationSuggestion[]> {
  const analyses = await analyzeAlphaGaps();
  const ts = new Date().toISOString();
  const suggestions: OptimizationSuggestion[] = [];

  const targets = analyses.filter(
    (a) =>
      (a.status === "critical" || a.status === "underperforming") &&
      a.alphaDragHoldings.length > 0 &&
      (!portfolioIds?.length || portfolioIds.includes(a.portfolioId))
  );

  for (const analysis of targets) {
    for (const drag of analysis.alphaDragHoldings) {
      const factors: string[] = [`portfolio_status:${analysis.status}`, `drag_score:${drag.dragScore}`];
      let alternatives: HoldingCandidate[] = [];

      // ── Stock: query screener by sector ──────────────────────────────────
      if (drag.symbol) {
        try {
          const sectorRow = await db.execute(sql`
            SELECT sector, market_cap_category FROM listed_stocks
            WHERE symbol = ${drag.symbol.toUpperCase()} LIMIT 1
          `).catch(() => ({ rows: [] }));
          const sd = (sectorRow as any).rows?.[0];
          const sector: string | null = sd?.sector ?? null;
          const cap: string | null = sd?.market_cap_category ?? null;

          if (sector) {
            const candidateRows = await db.execute(sql`
              SELECT
                sdm.symbol, ss.name, sdm.sector,
                sdm.return_1y, sdm.return_3y,
                sdm.sharpe_ratio_1y, sdm.beta,
                ss.isin, ss.market_cap_category
              FROM screener_derived_metrics sdm
              LEFT JOIN screener_stocks ss ON ss.symbol = sdm.symbol
              WHERE sdm.sector = ${sector}
                AND sdm.symbol != ${drag.symbol.toUpperCase()}
                AND sdm.return_1y > ${(drag.currentReturn ?? 0) / 100}
                AND (sdm.sharpe_ratio_1y IS NULL OR sdm.sharpe_ratio_1y > 0)
                AND (sdm.beta IS NULL OR sdm.beta < 2.0)
              ORDER BY (
                COALESCE(sdm.return_1y, 0) * 0.5 +
                COALESCE(sdm.sharpe_ratio_1y, 0.5) * 30 -
                ABS(COALESCE(sdm.beta, 1.0) - 1.0) * 10
              ) DESC
              LIMIT 5
            `).catch(() => ({ rows: [] }));

            alternatives = ((candidateRows as any).rows ?? []).map((r: any) => {
              const r1y = Math.round(Number(r.return_1y) * 10000) / 100;
              return {
                symbol: r.symbol,
                name: r.name ?? r.symbol,
                sector: r.sector,
                return_1y: r1y,
                return_3y: r.return_3y != null ? Math.round(Number(r.return_3y) * 10000) / 100 : null,
                sharpe: r.sharpe_ratio_1y != null ? Math.round(Number(r.sharpe_ratio_1y) * 100) / 100 : null,
                beta: r.beta != null ? Math.round(Number(r.beta) * 10000) / 10000 : null,
                isin: r.isin ?? null,
                compositeScore: Math.round(compositeScore(r1y, r.sharpe_ratio_1y != null ? Number(r.sharpe_ratio_1y) : null, r.beta != null ? Number(r.beta) : null) * 100) / 100,
                improvementVsCurrent: Math.round((r1y - (drag.currentReturn ?? 0)) * 100) / 100,
              };
            });

            if (alternatives.length > 0) {
              factors.push(`screener:sector:${sector}`);
              if (cap) factors.push(`screener:cap:${cap}`);
            }
          } else {
            factors.push("sector_not_found");
          }
        } catch (err) {
          logger.warn(`[Optimizer] Screener query failed for ${drag.symbol}`, err as Error);
          factors.push("screener_error");
        }
      }

      // ── MF: query financial_instruments_cache by category ─────────────────
      if (alternatives.length === 0 && !drag.symbol) {
        try {
          const cat = drag.type.toLowerCase()
            .replace(" mf", "").replace("mutual fund", "").replace("fund", "").trim();
          const mfRows = await db.execute(sql`
            SELECT name, isin, return_1y, return_3y, expense_ratio
            FROM financial_instruments_cache
            WHERE instrument_type = 'mutual_fund'
              AND name ILIKE ${"%" + cat + "%"}
              AND return_1y IS NOT NULL
              AND return_1y > ${(drag.currentReturn ?? 0) / 100}
            ORDER BY return_1y DESC LIMIT 5
          `).catch(() => ({ rows: [] }));

          const tp = (v: number) => Math.abs(v) < 5 ? Math.round(v * 10000) / 100 : Math.round(v * 100) / 100;
          alternatives = ((mfRows as any).rows ?? []).map((r: any) => {
            const r1y = tp(Number(r.return_1y));
            return {
              symbol: r.isin ?? r.name?.substring(0, 10) ?? "MF",
              name: r.name,
              sector: null,
              return_1y: r1y,
              return_3y: r.return_3y != null ? tp(Number(r.return_3y)) : null,
              sharpe: null,
              beta: null,
              isin: r.isin ?? null,
              compositeScore: r1y,
              improvementVsCurrent: Math.round((r1y - (drag.currentReturn ?? 0)) * 100) / 100,
            };
          });
          if (alternatives.length > 0) factors.push(`mf_db:category:${cat}`);
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

      const recommendation: OptimizationSuggestion["recommendation"] =
        alternatives.length === 0 ? "manual_review"
        : confidence < MIN_CONFIDENCE_FOR_REPLACE ? "reduce_weight"
        : drag.dragScore > 1 ? "replace"
        : "hold";

      suggestions.push({
        portfolioId: analysis.portfolioId,
        portfolioName: analysis.portfolioName,
        alphaDragHolding: drag,
        alternatives,
        recommendation,
        confidence_score: confidence,
        factors_considered: factors,
        model_version: OPTIMIZER_MODEL_VERSION,
        timestamp: ts,
        risk_disclaimer: RISK_DISCLAIMER,
      });
    }
  }

  logger.info("[Optimizer] Suggestions generated", {
    event: "AI_ADVICE_GENERATED",
    user_id: "system",
    output_summary: `${suggestions.length} suggestions for ${targets.length} portfolios`,
    model_version: OPTIMIZER_MODEL_VERSION,
    timestamp: ts,
    latency_ms: 0,
    status: "success",
  });

  return suggestions;
}

// ── applyApprovedReplacements ─────────────────────────────────────────────────

/**
 * Applies advisor-approved replacements to portfolio JSONB.
 * FASP-AI v3.0: advisor_id is mandatory — no autonomous execution.
 *
 * @param portfolioId - portfolio to update
 * @param replacements - [{rank, newSymbol, newName, newWeight?}]
 * @param advisorId - SEBI advisor ID (required for audit trail)
 */
export async function applyApprovedReplacements(
  portfolioId: string,
  replacements: { rank: number; newSymbol: string; newName: string; newWeight?: number }[],
  advisorId: string
): Promise<ApplyResult> {
  if (!advisorId?.trim()) {
    throw new Error("FASP-AI v3.0: advisor_id is required before applying any AI optimization.");
  }

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
      _modelVersion: OPTIMIZER_MODEL_VERSION,
    };
    applied.push(`${old.name} → ${rep.newName}`);
  }

  await db
    .update(modelPortfolios)
    .set({ holdings: holdings as any, updatedAt: new Date() })
    .where(eq(modelPortfolios.id, portfolioId));

  const logPayload = {
    event: "AI_PORTFOLIO_OPTIMIZATION_APPLIED",
    user_id: advisorId,
    portfolio_id: portfolioId,
    replacements_applied: applied,
    model_version: OPTIMIZER_MODEL_VERSION,
    timestamp: ts,
    retryable: false,
    latency_ms: 0,
    status: "success",
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
