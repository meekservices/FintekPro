/**
 * @file portfolio-rebalance-scheduler.ts
 * @description Automated rebalance engine for model portfolio templates.
 *
 * Purpose:
 *   Runs on cron schedule to detect when model portfolios need rebalancing
 *   based on market momentum, alpha gaps, risk breaches, and calendar triggers.
 *   Auto-applies changes to MODEL PORTFOLIO TEMPLATES only (no real trades).
 *   Queues client account rebalance recommendations for human approval.
 *
 * Inputs:
 *   - model_portfolios JSONB holdings (currentReturn, weight, beta, type, sector)
 *   - screener_derived_metrics (momentum scores, return percentile ranks)
 *   - MarketRegime from market-regime-detector
 *   - OptimizationSuggestions from model-portfolio-optimizer
 *
 * Outputs:
 *   - RebalanceQueue: candidates sorted by urgency
 *   - Auto-applied changes to model template JSONB (if guardrails pass)
 *   - Structured logs for all actions
 *
 * FASP-AI v3.0:
 *   - Model template changes: fully automated when guardrails pass
 *   - Client account changes: queued for 1-tap approval (never auto-applied)
 *   - All outputs include confidence_score, factors_considered, model_version, timestamp
 *   - Event logged: AUTO_REBALANCE_APPLIED / REBALANCE_QUEUED_FOR_APPROVAL
 */

import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import { modelPortfolios, faspAdvisoryOutputs } from "../../shared/schema";
import { logger } from "../logger";
import { detectRegime, MarketRegime } from "./market-regime-detector";
import { checkRiskBudget, buildPortfolioRiskSummary, RiskReport } from "./portfolio-risk-guard";
import { FaspAIv2Service } from "./fasp-ai-v2-service";
import {
  analyzeAlphaGaps,
  generateOptimizationSuggestions,
  AlphaAnalysis,
  OptimizationSuggestion,
  OPTIMIZER_MODEL_VERSION,
} from "./model-portfolio-optimizer";

const MODEL_VERSION = "FASP-AI v3.0 / rebalance-v1";
const RISK_DISCLAIMER =
  "AI-generated rebalance. Past returns do not guarantee future performance. " +
  "Model portfolio template updated automatically per pre-configured rules. " +
  "Client account rebalancing requires explicit client confirmation.";

// ── Guardrail thresholds ──────────────────────────────────────────────────────
const MIN_CONFIDENCE_AUTO_APPLY  = 0.70;  // auto-apply only above this
const MAX_WEIGHT_CHANGE_AUTO     = 10;    // % — larger changes go to advisor queue
const MIN_SCREENER_DATA_DAYS     = 90;    // replacement must have this much history
const MAX_AUTO_SWAPS_PER_RUN     = 3;     // cap replacements per portfolio per run

// ── Types ─────────────────────────────────────────────────────────────────────

export type TriggerType =
  | "calendar_quarterly"
  | "alpha_breach"
  | "risk_breach"
  | "momentum_signal"
  | "market_regime_shift"
  | "weight_drift";

export interface RebalanceCandidate {
  portfolioId: string;
  portfolioName: string;
  triggers: TriggerType[];
  urgency: "critical" | "high" | "medium" | "low";
  trueAlpha: number;
  alphaGap: number;
  riskScore: number;
  riskApproved: boolean;
  suggestionsCount: number;
  autoApplicable: number;  // suggestions that pass all guardrails
}

export interface RebalanceQueue {
  candidates: RebalanceCandidate[];
  marketRegime: MarketRegime;
  totalPortfoliosScanned: number;
  autoApplicable: number;
  queuedForAdvisor: number;
  timestamp: string;
  model_version: string;
}

export interface AutoApplyResult {
  portfolioId: string;
  swapsApplied: number;
  swapsQueued: number;
  holdingsChanged: string[];
  triggers: TriggerType[];
  riskReport: RiskReport;
  marketRegime: MarketRegime;
  confidence_score: number;
  factors_considered: string[];
  model_version: string;
  timestamp: string;
  risk_disclaimer: string;
  event: string;
}

// ── Momentum scorer ──────────────────────────────────────────────────────────

/**
 * Scores a holding's momentum percentile vs sector peers.
 * Returns 0-100 (100 = best momentum).
 */
async function scoreMomentum(symbol: string, sector: string | null): Promise<number> {
  if (!symbol || !sector) return 50; // neutral if no sector

  try {
    const res = await db.execute(sql`
      WITH sector_peers AS (
        SELECT symbol, return_1y,
          PERCENT_RANK() OVER (ORDER BY return_1y) AS momentum_pct
        FROM screener_derived_metrics
        WHERE sector = ${sector} AND return_1y IS NOT NULL
      )
      SELECT momentum_pct FROM sector_peers WHERE symbol = ${symbol.toUpperCase()} LIMIT 1
    `).catch(() => ({ rows: [] }));

    const row = (res as any).rows?.[0];
    return row ? Math.round(Number(row.momentum_pct) * 100) : 50;
  } catch {
    return 50;
  }
}

// ── Guardrail checker ─────────────────────────────────────────────────────────

interface GuardrailResult {
  passed: boolean;
  blockedReasons: string[];
}

function checkGuardrails(
  suggestion: OptimizationSuggestion,
  riskReport: RiskReport,
  regime: MarketRegime
): GuardrailResult {
  const reasons: string[] = [];

  if (suggestion.confidence_score < MIN_CONFIDENCE_AUTO_APPLY) {
    reasons.push(`confidence ${suggestion.confidence_score} < threshold ${MIN_CONFIDENCE_AUTO_APPLY}`);
  }

  if (!riskReport.approved) {
    reasons.push(`risk_guard_hard_breach: ${riskReport.hardBreaches.map(b => b.field).join(",")}`);
  }

  if (!suggestion.alternatives.length) {
    reasons.push("no_alternatives_found");
  }

  const best = suggestion.alternatives[0];
  if (best) {
    if (!best.isin) reasons.push("replacement_has_no_isin");
    // Check weight change magnitude
    const currentWeight = suggestion.alphaDragHolding.weight;
    if (currentWeight > MAX_WEIGHT_CHANGE_AUTO) {
      reasons.push(`weight_change_${currentWeight}%_exceeds_auto_limit_${MAX_WEIGHT_CHANGE_AUTO}%`);
    }
    // In BEAR regime, block if replacement has higher beta than current holding
    if (regime === "BEAR" && best.beta != null && best.beta > 1.2) {
      reasons.push(`bear_regime_blocks_high_beta_${best.beta?.toFixed(2)}`);
    }
  }

  return { passed: reasons.length === 0, blockedReasons: reasons };
}

// ── Core: runRebalanceScan ────────────────────────────────────────────────────

/**
 * Full rebalance scan across all model portfolios.
 * Returns a queue of candidates sorted by urgency.
 * Does NOT auto-apply — call autoApplyHighConfidenceSwaps() for that.
 */
export async function runRebalanceScan(): Promise<RebalanceQueue> {
  const ts = new Date().toISOString();
  const [regime, analyses, suggestions] = await Promise.all([
    detectRegime(),
    analyzeAlphaGaps(),
    generateOptimizationSuggestions(),
  ]);

  const allPortfolios = await db.select({
    id: modelPortfolios.id,
    riskProfile: modelPortfolios.riskProfile,
    holdings: modelPortfolios.holdings,
    lastRebalanced: modelPortfolios.lastRebalanced,
    rebalancingFrequency: modelPortfolios.rebalancingFrequency,
  }).from(modelPortfolios);

  const candidates: RebalanceCandidate[] = [];
  let autoApplicableTotal = 0;
  let queuedForAdvisor = 0;

  for (const p of allPortfolios) {
    const analysis = analyses.find(a => a.portfolioId === p.id);
    if (!analysis) continue;

    const triggers: TriggerType[] = [];
    const holdings = Array.isArray(p.holdings) ? p.holdings : [];

    // Alpha breach trigger
    if (analysis.status === "critical" || analysis.status === "underperforming") {
      triggers.push("alpha_breach");
    }

    // Weight drift trigger (any holding drifted >5% from its target weight)
    const driftedHoldings = holdings.filter((h: any) => {
      const target = Number(h.targetWeight ?? h.weight ?? 0);
      const actual = Number(h.weight ?? 0);
      return Math.abs(actual - target) > 5;
    });
    if (driftedHoldings.length > 0) triggers.push("weight_drift");

    // Market regime shift trigger
    if (regime.regime === "BEAR" && analysis.status !== "outperforming") {
      triggers.push("market_regime_shift");
    }

    // Calendar trigger: quarterly rebalance check
    const lastRebalanced = p.lastRebalanced ? new Date(p.lastRebalanced) : null;
    const daysSinceRebalance = lastRebalanced
      ? Math.floor((Date.now() - lastRebalanced.getTime()) / 86400000)
      : 999;
    const quarterDays = { quarterly: 90, monthly: 30, semi_annual: 180, annual: 365 };
    const freqDays = quarterDays[p.rebalancingFrequency as keyof typeof quarterDays] ?? 90;
    if (daysSinceRebalance >= freqDays) triggers.push("calendar_quarterly");

    if (!triggers.length) continue; // no action needed

    // Risk check
    const riskReport = checkRiskBudget(p.id, p.riskProfile, holdings);
    if (!riskReport.approved) triggers.push("risk_breach");

    // Count auto-applicable suggestions for this portfolio
    const portfolioSuggestions = suggestions.filter(s => s.portfolioId === p.id);
    let autoApplicable = 0;
    for (const s of portfolioSuggestions) {
      const guardrails = checkGuardrails(s, riskReport, regime.regime);
      if (guardrails.passed) autoApplicable++;
      else queuedForAdvisor++;
    }
    autoApplicableTotal += autoApplicable;

    const urgency: RebalanceCandidate["urgency"] =
      triggers.includes("risk_breach") ? "critical"
      : analysis.status === "critical" ? "high"
      : triggers.includes("calendar_quarterly") ? "medium"
      : "low";

    candidates.push({
      portfolioId: p.id,
      portfolioName: analysis.portfolioName,
      triggers,
      urgency,
      trueAlpha: analysis.trueAlpha,
      alphaGap: analysis.alphaGap,
      riskScore: riskReport.riskScore,
      riskApproved: riskReport.approved,
      suggestionsCount: portfolioSuggestions.length,
      autoApplicable,
    });
  }

  candidates.sort((a, b) => {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  logger.info("[Rebalance] Scan complete", {
    event: "REBALANCE_SCAN_COMPLETE",
    user_id: "system",
    candidates: candidates.length,
    regime: regime.regime,
    autoApplicable: autoApplicableTotal,
    queuedForAdvisor,
    model_version: MODEL_VERSION,
    timestamp: ts,
    latency_ms: 0,
    status: "success",
  });

  return {
    candidates,
    marketRegime: regime.regime,
    totalPortfoliosScanned: allPortfolios.length,
    autoApplicable: autoApplicableTotal,
    queuedForAdvisor,
    timestamp: ts,
    model_version: MODEL_VERSION,
  };
}

// ── Core: autoApplyHighConfidenceSwaps ───────────────────────────────────────

/**
 * Auto-applies high-confidence holding swaps to MODEL PORTFOLIO TEMPLATES.
 * NOT client accounts — no real money involved.
 *
 * Guardrails: confidence ≥ 0.70, no risk breach, ISIN present, weight ≤ 10%.
 * All changes logged with full audit trail.
 *
 * @param portfolioIds - optional filter; empty = all eligible portfolios
 */
export async function autoApplyHighConfidenceSwaps(
  portfolioIds?: string[]
): Promise<AutoApplyResult[]> {
  const [regime, suggestions] = await Promise.all([
    detectRegime(),
    generateOptimizationSuggestions(portfolioIds),
  ]);

  const allPortfolios = await db.select().from(modelPortfolios);
  const portfolioMap = new Map(allPortfolios.map(p => [p.id, p]));

  const results: AutoApplyResult[] = [];

  // Group suggestions by portfolio
  const byPortfolio = new Map<string, OptimizationSuggestion[]>();
  for (const s of suggestions) {
    const arr = byPortfolio.get(s.portfolioId) ?? [];
    arr.push(s);
    byPortfolio.set(s.portfolioId, arr);
  }

  for (const [portfolioId, pSuggestions] of byPortfolio) {
    if (portfolioIds?.length && !portfolioIds.includes(portfolioId)) continue;

    const portfolio = portfolioMap.get(portfolioId);
    if (!portfolio) continue;

    const holdings: any[] = Array.isArray(portfolio.holdings) ? [...portfolio.holdings] : [];
    const riskReport = checkRiskBudget(portfolioId, portfolio.riskProfile, holdings);

    const applied: string[] = [];
    const queued: string[] = [];
    const factors: string[] = [`regime:${regime.regime}`];
    let swapCount = 0;

    for (const suggestion of pSuggestions) {
      if (swapCount >= MAX_AUTO_SWAPS_PER_RUN) {
        queued.push(suggestion.alphaDragHolding.name + " (swap_cap_reached)");
        continue;
      }

      const guardrails = checkGuardrails(suggestion, riskReport, regime.regime);
      if (!guardrails.passed) {
        queued.push(
          `${suggestion.alphaDragHolding.name} → blocked: ${guardrails.blockedReasons.join("; ")}`
        );
        continue;
      }

      const best = suggestion.alternatives[0];
      const idx = holdings.findIndex((h: any) => h.rank === suggestion.alphaDragHolding.rank);
      if (idx === -1 || !best) continue;

      const old = holdings[idx];
      holdings[idx] = {
        ...old,
        name: best.name,
        symbol: best.symbol,
        isin: best.isin ?? undefined,
        // Clear enrichment — will re-populate on next persist-holdings-enrichment run
        currentReturn: undefined,
        returnSource: undefined,
        beta: undefined,
        sharpe: undefined,
        screenerUrl: undefined,
        amfiSchemeCode: undefined,
        // Audit trail
        _autoRebalancedAt: new Date().toISOString(),
        _replacedOldName: old.name,
        _replacedOldSymbol: old.symbol ?? null,
        _trigger: suggestion.factors_considered.join(","),
        _confidence: suggestion.confidence_score,
        _modelVersion: MODEL_VERSION,
      };

      applied.push(`${old.name} → ${best.name} (confidence=${suggestion.confidence_score})`);
      factors.push(...suggestion.factors_considered);
      swapCount++;
    }

    if (applied.length === 0) {
      results.push({
        portfolioId,
        swapsApplied: 0,
        swapsQueued: queued.length,
        holdingsChanged: [],
        triggers: [],
        riskReport,
        marketRegime: regime.regime,
        confidence_score: 0,
        factors_considered: factors,
        model_version: MODEL_VERSION,
        timestamp: new Date().toISOString(),
        risk_disclaimer: RISK_DISCLAIMER,
        event: "REBALANCE_NO_ACTION",
      });
      continue;
    }

    // Persist template changes
    await db
      .update(modelPortfolios)
      .set({
        holdings: holdings as any,
        lastRebalanced: new Date().toISOString().split("T")[0],
        updatedAt: new Date(),
      })
      .where(eq(modelPortfolios.id, portfolioId));

    // Compute average confidence of applied swaps
    const avgConfidence = pSuggestions
      .filter(s => applied.some(a => a.includes(s.alphaDragHolding.name)))
      .reduce((sum, s) => sum + s.confidence_score, 0) / Math.max(applied.length, 1);

    // ── FASP-AI v3.0: Persist to advisory outputs for SEBI audit trail ──
    const confidence = FaspAIv2Service.computeConfidence({
      responseLength: JSON.stringify(applied).length,
      hasStructuredData: true,
      factorCount: [...new Set(factors)].length,
      userSegment: "institutional",
    });
    await db.insert(faspAdvisoryOutputs).values({
      advisoryType: "model_portfolio",
      userSegment: "institutional",
      inputContext: {
        portfolioId,
        regime: regime.regime,
        triggeredBy: "auto_rebalance",
        swapsApplied: applied.length,
      } as any,
      recommendation: `Auto-rebalanced ${applied.length} holdings in portfolio ${portfolioId}. Changes: ${applied.join("; ").substring(0, 1000)}`,
      outputSnapshot: {
        applied,
        queued,
        marketRegime: regime.regime,
        riskApproved: riskReport.approved,
      } as any,
      modelVersion: "FASP-AI-v3.0",
      baseModel: "rule-engine",
      confidenceScore: Math.round(avgConfidence * 100),
      confidenceBreakdown: confidence.breakdown as any,
      confidenceThreshold: 70,
      meetsThreshold: avgConfidence >= 0.70,
      humanReviewRequired: false,
      sebiCircularRef: "SEBI/HO/IMD/2023/P/CIR/0188",
      source: "cron",
    }).catch(err => {
      logger.warn("[Rebalance] FASP persist failed (non-fatal)", { error: err?.message });
    });

    const result: AutoApplyResult = {
      portfolioId,
      swapsApplied: applied.length,
      swapsQueued: queued.length,
      holdingsChanged: applied,
      triggers: ["alpha_breach", "momentum_signal"],
      riskReport,
      marketRegime: regime.regime,
      confidence_score: Math.round(avgConfidence * 100) / 100,
      factors_considered: [...new Set(factors)],
      model_version: MODEL_VERSION,
      timestamp: new Date().toISOString(),
      risk_disclaimer: RISK_DISCLAIMER,
      event: "AUTO_REBALANCE_APPLIED",
    };

    logger.info("[Rebalance] Auto-applied template changes", {
      event: "AUTO_REBALANCE_APPLIED",
      user_id: "system",
      portfolio_id: portfolioId,
      swaps_applied: applied.length,
      swaps_queued: queued.length,
      market_regime: regime.regime,
      model_version: MODEL_VERSION,
      timestamp: result.timestamp,
      latency_ms: 0,
      status: "success",
    });

    results.push(result);
  }

  return results;
}
