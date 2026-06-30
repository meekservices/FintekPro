/**
 * Model Portfolio Quant Alpha Service — FASP-AI-v2.0
 *
 * Purpose  : Wires all model portfolios to the quant alpha engine.
 *            Runs drift detection, alpha scoring, and rebalancing.
 * Inputs   : Portfolio holdings from DB or static config.
 * Outputs  : DriftReport, AlphaScore, RebalancePlan — all deterministic.
 *
 * Drift thresholds (asset-class aware, SEBI conservative):
 *   Debt    portfolios : 3%  drift triggers rebalance
 *   Hybrid  portfolios : 5%  drift triggers rebalance
 *   Equity  portfolios : 8%  drift triggers rebalance
 *
 * Engine version: FASP-AI-v2.0
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { rebalanceOptimizer } from "../core/rebalance-optimizer";
import { logger } from "../logger";

export const ENGINE_VERSION = "FASP-AI-v2.0";
const RISK_FREE_RATE = 7.1; // RBI repo rate proxy (annualised %)

// ── Asset-class drift thresholds ─────────────────────────────────────────────
function getDriftThreshold(portfolioId: string, assetClass?: string): number {
  const id = portfolioId.toLowerCase();
  if (id.includes("treasury") || id.includes("overnight")) return 0.02;
  if (id.startsWith("debt-") || id === "pure-debt-portfolio" || id === "emergency-fund" || id === "debt-liquid-park") return 0.03;
  if (id.includes("hybrid") || id.includes("balanced") || id.includes("all-weather") || id.includes("retirement")) return 0.05;
  if (id.startsWith("goal-")) return 0.05;
  if (id.startsWith("thematic-") || id.includes("smallcap") || id.includes("midcap") || id.includes("emerging") ||
      id.includes("multicap") || id.includes("flexicap") || id.includes("blue")) return 0.08;
  if (assetClass) {
    const ac = assetClass.toLowerCase();
    if (ac.includes("debt") || ac.includes("bond") || ac.includes("gilt")) return 0.03;
    if (ac.includes("hybrid") || ac.includes("balance")) return 0.05;
  }
  return 0.05;
}

// ── Public types ─────────────────────────────────────────────────────────────
export interface QuantHolding {
  rank: number;
  name: string;
  symbol?: string;
  category: string;
  weight: number;
  currentReturn: number;
  currentWeight?: number;
}

export interface PortfolioQuantInput {
  id: string;
  name: string;
  assetClass: string;
  cagr1Y: number;
  cagr3Y: number;
  cagr5Y: number;
  benchmarkCagr1Y: number;
  benchmarkName: string;
  sharpeRatio?: number;
  maxDrawdown?: number;
  volatility?: number;
  lastRebalanced?: string;
  holdings: QuantHolding[];
}

export interface HoldingDrift {
  asset: string;
  targetWeight: number;
  currentWeight: number;
  delta: number;
  driftPercent: number;
  exceedsThreshold: boolean;
  action: "SELL" | "BUY" | "HOLD";
  reason: string;
}

export interface PortfolioDriftReport {
  portfolioId: string;
  threshold: number;
  driftScore: number;
  holdingsDrift: HoldingDrift[];
  driftingCount: number;
  status: "balanced" | "minor_drift" | "needs_rebalance";
  computedAt: string;
  engineVersion: string;
}

export interface PortfolioAlphaScore {
  portfolioId: string;
  alpha: number;
  excessReturn3Y: number;
  sharpeRatio: number;
  confidenceScore: number;
  factors: string[];
  recommendation: string;
  modelVersion: string;
  timestamp: string;
}

export interface QuantRebalanceResult {
  portfolioId: string;
  driftReport: PortfolioDriftReport;
  alphaScore: PortfolioAlphaScore;
  rebalancePlan: {
    plan_id: string;
    actions: Array<{ action: "BUY" | "SELL"; asset: string; quantity_proxy: number; reason: string }>;
    estimated_cost: number;
    holdings_requiring_action: number;
  } | null;
  timestamp: string;
  engineVersion: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// computePortfolioDrift
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purpose  : Detects holding-level drift for a model portfolio.
 * Outputs  : PortfolioDriftReport — per-holding delta + composite drift score.
 *
 * If live currentWeight is unavailable, simulates drift from CAGR differential
 * (deterministic — no Math.random).
 */
export function computePortfolioDrift(portfolio: PortfolioQuantInput): PortfolioDriftReport {
  const threshold = getDriftThreshold(portfolio.id, portfolio.assetClass);
  const holdingsDrift: HoldingDrift[] = [];

  const avgReturn = portfolio.holdings.length > 0
    ? portfolio.holdings.reduce((s, x) => s + x.currentReturn, 0) / portfolio.holdings.length
    : 0;

  const monthsSinceRebalance = portfolio.lastRebalanced
    ? Math.min(24, Math.round((Date.now() - new Date(portfolio.lastRebalanced).getTime()) / (30 * 24 * 3600 * 1000)))
    : 6;

  for (const h of portfolio.holdings) {
    const returnDiff = (h.currentReturn - avgReturn) / 100;
    const simulatedDrift = returnDiff * (h.weight / 100) * (monthsSinceRebalance / 12);
    const currentWeight = h.currentWeight ?? (h.weight / 100 + simulatedDrift) * 100;
    const delta = (currentWeight - h.weight) / 100;
    const exceedsThreshold = Math.abs(delta) > threshold;

    holdingsDrift.push({
      asset: h.name,
      targetWeight: h.weight,
      currentWeight: parseFloat(currentWeight.toFixed(2)),
      delta: parseFloat(delta.toFixed(4)),
      driftPercent: parseFloat((Math.abs(delta) * 100).toFixed(2)),
      exceedsThreshold,
      action: delta > threshold ? "SELL" : delta < -threshold ? "BUY" : "HOLD",
      reason: exceedsThreshold
        ? `${delta > 0 ? "Overweight" : "Underweight"} by ${(Math.abs(delta) * 100).toFixed(2)}% (threshold: ${(threshold * 100).toFixed(0)}%)`
        : "Within tolerance",
    });
  }

  const totalWeight = portfolio.holdings.reduce((s, h) => s + h.weight, 0) || 100;
  const weightedDrift = holdingsDrift.reduce((s, h) => s + Math.abs(h.delta) * (h.targetWeight / totalWeight), 0);
  const driftScore = Math.min(100, Math.round(weightedDrift * 1000));
  const driftingCount = holdingsDrift.filter(h => h.exceedsThreshold).length;

  const status: PortfolioDriftReport["status"] =
    driftScore > 15 ? "needs_rebalance" :
    driftScore > 5  ? "minor_drift"     : "balanced";

  return {
    portfolioId:   portfolio.id,
    threshold,
    driftScore,
    holdingsDrift,
    driftingCount,
    status,
    computedAt:    new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// scorePortfolioAlpha — FASP-AI-v2.0
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Confidence score formula:
 *   Base     = 50
 *   +Sharpe  up to +15  (Sharpe ≥ 1.5 = max)
 *   +Alpha   up to +15  (Alpha ≥ 3% = max)
 *   +Diversity up to +10 (≥ 15 holdings = max)
 *   +Recency up to +10  (rebalanced < 30 days = max)
 */
export function scorePortfolioAlpha(portfolio: PortfolioQuantInput): PortfolioAlphaScore {
  const alpha = parseFloat((portfolio.cagr1Y - portfolio.benchmarkCagr1Y).toFixed(2));
  const excessReturn3Y = parseFloat((portfolio.cagr3Y - portfolio.benchmarkCagr1Y).toFixed(2));
  const volatility = portfolio.volatility ?? 12;
  const sharpeRatio = portfolio.sharpeRatio ??
    parseFloat(((portfolio.cagr1Y - RISK_FREE_RATE) / volatility).toFixed(2));

  let confidence = 50;
  const factors: string[] = [];

  const sharpeScore = Math.min(15, Math.round(Math.max(0, sharpeRatio) * 10));
  confidence += sharpeScore;
  if (sharpeScore > 0) factors.push(`Sharpe ratio: ${sharpeRatio.toFixed(2)}`);

  const alphaScore = Math.min(15, Math.max(0, Math.round(alpha * 3)));
  confidence += alphaScore;
  if (alpha > 0) factors.push(`Positive alpha vs ${portfolio.benchmarkName}: +${alpha}%`);
  else factors.push(`Alpha vs ${portfolio.benchmarkName}: ${alpha}%`);

  const diversityScore = Math.min(10, Math.round(portfolio.holdings.length * 0.5));
  confidence += diversityScore;
  factors.push(`${portfolio.holdings.length} holdings`);

  let recencyScore = 5;
  if (portfolio.lastRebalanced) {
    const daysSince = Math.round((Date.now() - new Date(portfolio.lastRebalanced).getTime()) / (24 * 3600 * 1000));
    recencyScore = daysSince < 30 ? 10 : daysSince < 90 ? 7 : daysSince < 180 ? 4 : 1;
    factors.push(`Last rebalanced: ${daysSince}d ago`);
  }
  confidence += recencyScore;
  confidence = Math.min(97, Math.max(40, confidence));

  const recommendation = alpha > 2 && sharpeRatio > 1.0
    ? `${portfolio.name} demonstrates strong risk-adjusted performance (+${alpha.toFixed(1)}% alpha). Past performance is not indicative of future results. Advisor review required before investing.`
    : alpha > 0
    ? `${portfolio.name} shows positive alpha of +${alpha.toFixed(1)}% vs benchmark. Moderate conviction — advisor review recommended.`
    : `${portfolio.name} is underperforming its benchmark by ${Math.abs(alpha).toFixed(1)}%. Review allocation with your advisor.`;

  return {
    portfolioId:     portfolio.id,
    alpha,
    excessReturn3Y,
    sharpeRatio,
    confidenceScore: confidence,
    factors,
    recommendation,
    modelVersion:    ENGINE_VERSION,
    timestamp:       new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// runPortfolioRebalance
// ─────────────────────────────────────────────────────────────────────────────
export function runPortfolioRebalance(
  portfolio: PortfolioQuantInput,
  totalPortfolioValue: number = 1_000_000,
): QuantRebalanceResult {
  const driftReport = computePortfolioDrift(portfolio);
  const alphaScore  = scorePortfolioAlpha(portfolio);
  let rebalancePlan: QuantRebalanceResult["rebalancePlan"] = null;

  if (driftReport.status !== "balanced") {
    const driftData = {
      drifting_assets: driftReport.holdingsDrift
        .filter(h => h.exceedsThreshold)
        .map(h => ({
          asset: h.asset,
          delta: h.delta,
          currentWeight: h.currentWeight / 100,
          targetWeight: h.targetWeight / 100,
        })),
    };
    const { plan } = rebalanceOptimizer.generateOptimizedPlan(driftData as any, totalPortfolioValue);
    rebalancePlan = { ...plan, holdings_requiring_action: driftReport.driftingCount };
  }

  return {
    portfolioId:   portfolio.id,
    driftReport,
    alphaScore,
    rebalancePlan,
    timestamp:     new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildInvestAllocation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Purpose  : Per-holding allocation amounts for a given investment total.
 * Edge case: Rounding residual added to the largest-weight holding.
 *            Flags holdings where computed amount < ₹100 MF minimum.
 */
export function buildInvestAllocation(
  holdings: QuantHolding[],
  totalAmount: number,
): Array<{
  rank: number;
  name: string;
  category: string;
  targetWeight: number;
  targetAmount: number;
  isBelowMinimum: boolean;
}> {
  const MF_MINIMUM = 100;
  const totalWeight = holdings.reduce((s, h) => s + h.weight, 0) || 100;

  const allocations = holdings.map(h => ({
    rank:           h.rank,
    name:           h.name,
    category:       h.category,
    targetWeight:   h.weight,
    targetAmount:   Math.round((h.weight / totalWeight) * totalAmount),
    isBelowMinimum: false,
  }));

  // Fix rounding residual
  const allocated = allocations.reduce((s, a) => s + a.targetAmount, 0);
  const residual  = totalAmount - allocated;
  if (residual !== 0 && allocations.length > 0) {
    const largest = allocations.reduce((m, a) => a.targetAmount > m.targetAmount ? a : m, allocations[0]);
    largest.targetAmount += residual;
  }

  allocations.forEach(a => { a.isBelowMinimum = a.targetAmount < MF_MINIMUM; });
  return allocations;
}

// ─────────────────────────────────────────────────────────────────────────────
// runNightlyModelPortfolioRebalance — batch cron job
// ─────────────────────────────────────────────────────────────────────────────
export async function runNightlyModelPortfolioRebalance(): Promise<{
  portfolios_scored: number;
  drifting: number;
  needing_rebalance: number;
  errors: number;
  latency_ms: number;
}> {
  const t0 = Date.now();
  let scored = 0, drifting = 0, needingRebalance = 0, errors = 0;

  logger.info("[QuantEngine] Nightly model portfolio rebalance started", {
    event: "NIGHTLY_PORTFOLIO_REBALANCE_START",
    engine: ENGINE_VERSION,
    timestamp: new Date().toISOString(),
  });

  try {
    const portfolios = await db.execute(sql`
      SELECT id, name, asset_class, cagr_1y, cagr_3y, cagr_5y,
             benchmark_cagr_1y, benchmark_name, sharpe_ratio,
             max_drawdown, volatility, holdings, last_rebalanced
      FROM model_portfolios
      WHERE id IS NOT NULL
      ORDER BY id
    `);

    for (const row of portfolios.rows as any[]) {
      try {
        const holdings: QuantHolding[] = ((row.holdings as any[]) ?? []).map((h: any) => ({
          rank:          Number(h.rank ?? 0),
          name:          String(h.name ?? h.instrumentName ?? "Unknown"),
          category:      String(h.category ?? h.type ?? "MF"),
          weight:        parseFloat(h.weight ?? h.targetWeight ?? 0),
          currentReturn: parseFloat(h.currentReturn ?? h.returns_1y ?? 0),
          currentWeight: h.currentWeight ? parseFloat(h.currentWeight) : undefined,
        }));

        if (holdings.length === 0) continue;

        const portfolio: PortfolioQuantInput = {
          id:              row.id,
          name:            row.name,
          assetClass:      row.asset_class ?? "hybrid",
          cagr1Y:          parseFloat(row.cagr_1y ?? 0),
          cagr3Y:          parseFloat(row.cagr_3y ?? 0),
          cagr5Y:          parseFloat(row.cagr_5y ?? 0),
          benchmarkCagr1Y: parseFloat(row.benchmark_cagr_1y ?? 0),
          benchmarkName:   row.benchmark_name ?? "NIFTY 50 TRI",
          sharpeRatio:     row.sharpe_ratio != null ? parseFloat(row.sharpe_ratio) : undefined,
          maxDrawdown:     row.max_drawdown  != null ? parseFloat(row.max_drawdown)  : undefined,
          volatility:      row.volatility    != null ? parseFloat(row.volatility)    : undefined,
          lastRebalanced:  row.last_rebalanced ?? undefined,
          holdings,
        };

        const driftReport = computePortfolioDrift(portfolio);
        const alphaScore  = scorePortfolioAlpha(portfolio);

        await db.execute(sql`
          UPDATE model_portfolios
          SET
            drift_score          = ${driftReport.driftScore},
            drift_details        = ${JSON.stringify(driftReport.holdingsDrift.slice(0, 5))}::jsonb,
            quant_engine_version = ${ENGINE_VERSION},
            last_quant_run       = NOW(),
            alpha                = ${alphaScore.alpha},
            updated_at           = NOW()
          WHERE id = ${row.id}
        `);

        scored++;
        if (driftReport.status !== "balanced") drifting++;
        if (driftReport.status === "needs_rebalance") needingRebalance++;

      } catch (rowErr: any) {
        errors++;
        logger.error(`[QuantEngine] Error scoring portfolio ${row.id}`, {
          event: "NIGHTLY_PORTFOLIO_REBALANCE_ROW_ERROR",
          portfolio_id: row.id,
          error_code: "QUANT_ROW_ERROR",
          message: rowErr.message,
          retryable: true,
        });
      }
    }
  } catch (err: any) {
    errors++;
    logger.error("[QuantEngine] Nightly rebalance batch failed", {
      event: "NIGHTLY_PORTFOLIO_REBALANCE_ERROR",
      error_code: "QUANT_BATCH_ERROR",
      message: err.message,
      retryable: true,
    });
  }

  const latency_ms = Date.now() - t0;
  const result = { portfolios_scored: scored, drifting, needing_rebalance: needingRebalance, errors, latency_ms };

  logger.info("[QuantEngine] Nightly model portfolio rebalance complete", {
    event: "NIGHTLY_PORTFOLIO_REBALANCE_COMPLETE",
    ...result,
    engine: ENGINE_VERSION,
    status: errors === 0 ? "success" : "partial",
  });

  return result;
}
