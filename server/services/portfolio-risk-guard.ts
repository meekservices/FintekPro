/**
 * @file portfolio-risk-guard.ts
 * @description Risk budget enforcement for model portfolio auto-rebalancing.
 *
 * Purpose:
 *   Validates proposed holding sets against per-type risk budgets before any
 *   auto-apply or advisor-apply action. Acts as a hard gate — no rebalance
 *   proceeds if a hard breach is detected.
 *
 * Inputs:
 *   - Proposed holdings array (from optimizer or rebalance scheduler)
 *   - Portfolio type/riskProfile from model_portfolios table
 *
 * Outputs:
 *   - RiskReport: approved boolean, hard breaches, soft warnings, riskScore 0-100
 *
 * Edge cases:
 *   - Holdings missing beta/volatility data: treated as neutral (beta=1, vol=15%)
 *   - Empty holdings array: returns approved=false, breach=["empty_portfolio"]
 *
 * FASP-AI v3.0: hard breaches block all auto-apply. Soft warnings allow with logging.
 */

import { logger } from "../logger";

const MODEL_VERSION = "FASP-AI v3.0 / risk-guard-v1";

// ── Risk Budgets by portfolio type ────────────────────────────────────────────

interface RiskBudget {
  maxVolatility: number;    // % annualised
  maxDrawdown: number;      // % (negative)
  betaCeiling: number;      // portfolio-level weighted beta
  sharpeFloor: number;      // minimum acceptable Sharpe ratio
  maxSingleWeight: number;  // % max weight in any single holding
  maxSectorWeight: number;  // % max combined weight in one sector
}

const RISK_BUDGETS: Record<string, RiskBudget> = {
  conservative:  { maxVolatility: 8,   maxDrawdown: -6,   betaCeiling: 0.4, sharpeFloor: 1.2, maxSingleWeight: 30, maxSectorWeight: 50 },
  moderate:      { maxVolatility: 16,  maxDrawdown: -14,  betaCeiling: 1.0, sharpeFloor: 0.7, maxSingleWeight: 25, maxSectorWeight: 40 },
  aggressive:    { maxVolatility: 26,  maxDrawdown: -24,  betaCeiling: 1.6, sharpeFloor: 0.4, maxSingleWeight: 15, maxSectorWeight: 35 },
  high:          { maxVolatility: 30,  maxDrawdown: -28,  betaCeiling: 1.9, sharpeFloor: 0.3, maxSingleWeight: 12, maxSectorWeight: 30 },
  all_weather:   { maxVolatility: 12,  maxDrawdown: -10,  betaCeiling: 0.7, sharpeFloor: 0.9, maxSingleWeight: 25, maxSectorWeight: 40 },
};

const DEFAULT_BUDGET = RISK_BUDGETS["moderate"];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RiskBreach {
  type: "hard" | "soft";
  field: string;
  actual: number;
  limit: number;
  message: string;
}

export interface RiskReport {
  portfolioId: string;
  riskProfile: string;
  approved: boolean;          // false = hard breach → blocks auto-apply
  riskScore: number;          // 0-100 (100 = worst risk)
  hardBreaches: RiskBreach[];
  softWarnings: RiskBreach[];
  metrics: {
    weightedBeta: number;
    maxSingleWeight: number;
    maxSectorWeight: number;
    estimatedVolatility: number;
  };
  model_version: string;
  timestamp: string;
}

// ── Core: checkRiskBudget ─────────────────────────────────────────────────────

/**
 * Validates proposed holdings against the portfolio's risk budget.
 *
 * @param portfolioId - for logging
 * @param riskProfile - conservative|moderate|aggressive|high|all_weather
 * @param proposedHoldings - array of holdings with weight, beta?, type?
 */
export function checkRiskBudget(
  portfolioId: string,
  riskProfile: string,
  proposedHoldings: Array<{
    name: string;
    weight: number;
    beta?: number | null;
    sector?: string | null;
    type?: string;
    currentReturn?: number | null;
    sharpe?: number | null;
  }>
): RiskReport {
  const _guardStart = Date.now(); // C-E4: capture for real latency
  const ts = new Date().toISOString();
  const budget = RISK_BUDGETS[riskProfile] ?? DEFAULT_BUDGET;
  const hardBreaches: RiskBreach[] = [];
  const softWarnings: RiskBreach[] = [];

  if (!proposedHoldings.length) {
    return {
      portfolioId,
      riskProfile,
      approved: false,
      riskScore: 100,
      hardBreaches: [{ type: "hard", field: "holdings", actual: 0, limit: 1, message: "Empty holdings array" }],
      softWarnings: [],
      metrics: { weightedBeta: 0, maxSingleWeight: 0, maxSectorWeight: 0, estimatedVolatility: 0 },
      model_version: MODEL_VERSION,
      timestamp: ts,
    };
  }

  // 1. Weighted beta
  let totalWeight = 0;
  let weightedBeta = 0;
  for (const h of proposedHoldings) {
    const w = Number(h.weight ?? 0);
    const b = h.beta != null ? Number(h.beta) : 1.0; // default beta = 1 (market)
    weightedBeta += (w / 100) * b;
    totalWeight += w;
  }
  if (weightedBeta > budget.betaCeiling) {
    const breach: RiskBreach = {
      type: weightedBeta > budget.betaCeiling * 1.2 ? "hard" : "soft",
      field: "weightedBeta",
      actual: Math.round(weightedBeta * 100) / 100,
      limit: budget.betaCeiling,
      message: `Portfolio beta ${weightedBeta.toFixed(2)} exceeds ceiling ${budget.betaCeiling} for ${riskProfile} profile`,
    };
    breach.type === "hard" ? hardBreaches.push(breach) : softWarnings.push(breach);
  }

  // 2. Max single holding weight
  const maxSingle = Math.max(...proposedHoldings.map(h => Number(h.weight ?? 0)));
  if (maxSingle > budget.maxSingleWeight) {
    const breach: RiskBreach = {
      type: maxSingle > budget.maxSingleWeight * 1.3 ? "hard" : "soft",
      field: "maxSingleWeight",
      actual: maxSingle,
      limit: budget.maxSingleWeight,
      message: `Single holding weight ${maxSingle}% exceeds ${budget.maxSingleWeight}% limit`,
    };
    breach.type === "hard" ? hardBreaches.push(breach) : softWarnings.push(breach);
  }

  // 3. Sector concentration
  const sectorWeights: Record<string, number> = {};
  for (const h of proposedHoldings) {
    const sector = h.sector ?? h.type ?? "unknown";
    sectorWeights[sector] = (sectorWeights[sector] ?? 0) + Number(h.weight ?? 0);
  }
  const maxSectorW = Math.max(...Object.values(sectorWeights));
  const maxSectorName = Object.entries(sectorWeights).find(([, v]) => v === maxSectorW)?.[0] ?? "";
  if (maxSectorW > budget.maxSectorWeight) {
    const breach: RiskBreach = {
      type: maxSectorW > budget.maxSectorWeight * 1.2 ? "hard" : "soft",
      field: "sectorConcentration",
      actual: maxSectorW,
      limit: budget.maxSectorWeight,
      message: `Sector '${maxSectorName}' weight ${maxSectorW}% exceeds ${budget.maxSectorWeight}% limit`,
    };
    breach.type === "hard" ? hardBreaches.push(breach) : softWarnings.push(breach);
  }

  // 4. Estimated portfolio volatility (proxy: avg beta × market vol 15%)
  const MARKET_VOL = 15;
  const estimatedVolatility = Math.round(weightedBeta * MARKET_VOL * 100) / 100;
  if (estimatedVolatility > budget.maxVolatility) {
    const breach: RiskBreach = {
      type: estimatedVolatility > budget.maxVolatility * 1.25 ? "hard" : "soft",
      field: "estimatedVolatility",
      actual: estimatedVolatility,
      limit: budget.maxVolatility,
      message: `Estimated volatility ${estimatedVolatility}% exceeds ${budget.maxVolatility}% budget`,
    };
    breach.type === "hard" ? hardBreaches.push(breach) : softWarnings.push(breach);
  }

  // 5. Total weight sanity
  if (Math.abs(totalWeight - 100) > 2) {
    hardBreaches.push({
      type: "hard",
      field: "totalWeight",
      actual: totalWeight,
      limit: 100,
      message: `Holdings total ${totalWeight}% — must sum to ~100%`,
    });
  }

  // Risk score: 0-100
  const riskScore = Math.min(
    100,
    Math.round(
      (hardBreaches.length * 25) +
      (softWarnings.length * 10) +
      (Math.max(0, weightedBeta - 1) * 15) +
      (Math.max(0, estimatedVolatility - 10) * 2)
    )
  );

  const report: RiskReport = {
    portfolioId,
    riskProfile,
    approved: hardBreaches.length === 0,
    riskScore,
    hardBreaches,
    softWarnings,
    metrics: {
      weightedBeta: Math.round(weightedBeta * 100) / 100,
      maxSingleWeight: maxSingle,
      maxSectorWeight: maxSectorW,
      estimatedVolatility,
    },
    model_version: MODEL_VERSION,
    timestamp: ts,
  };

  if (!report.approved) {
    logger.warn("[RiskGuard] Hard breach — auto-apply blocked", {
      event: "RISK_GUARD_BREACH",
      user_id: "system",
      portfolio_id: portfolioId,
      breaches: hardBreaches.map(b => b.field),
      latency_ms: Date.now() - _guardStart,  // C-E4: real latency
      status: "blocked",
    });
  }

  return report;
}

/**
 * Scans all portfolios and returns a risk summary.
 * Used by the daily cron and GET /admin/risk-report endpoint.
 */
export async function buildPortfolioRiskSummary(
  portfolios: Array<{ id: string; riskProfile: string; holdings: any[] }>
): Promise<RiskReport[]> {
  return portfolios.map(p =>
    checkRiskBudget(p.id, p.riskProfile, Array.isArray(p.holdings) ? p.holdings : [])
  );
}
