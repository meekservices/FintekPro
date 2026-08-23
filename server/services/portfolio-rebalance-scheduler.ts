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
import {
	getEnrichedStockSnapshot,
	getEnrichedStockSnapshots,
} from "./screener/enriched-stock-data";
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
  | "risk_warning"
  | "momentum_signal"
  | "market_regime_shift"
  | "weight_drift"
  | `regime:${string}`;  // H-E5: regime-keyed triggers e.g. "regime:BEAR"

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

// ── Profit-guard thresholds ───────────────────────────────────────────────────
/**
 * Days before the LTCG threshold (12m equity / 24m debt) within which a SELL
 * is deferred by the profit-guard to save STCG→LTCG tax (7.5 pp saving).
 * Finance Act 2024: STCG equity = 20%, LTCG equity = 12.5%.
 */
const PROFIT_GUARD_MATURITY_BUFFER_DAYS = 60;

/** LTCG holding thresholds per asset class (calendar days). */
const LTCG_THRESHOLD_DAYS: Record<string, number> = {
  equity: 365,
  mf:     365,
  etf:    365,
  debt:   730,
  gold:   730,
  reit:   730,
  invit:  730,
  default: 365,
};

/**
 * Exit load above this % blocks auto-apply and routes to advisor queue.
 * Most equity MFs charge 1% within 1 year — even 0.5% materially erodes gain.
 */
const EXIT_LOAD_AUTO_BLOCK_PCT = 0.50;

/**
 * If (tax cost + exit load) / rebalancing benefit > this ratio,
 * the engine recommends cash-deploy (SIP new money into underweights) instead of selling.
 */
const FRICTION_BENEFIT_RATIO_BLOCK = 0.70;

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

  // ── Existing guardrails ────────────────────────────────────────────────────
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
    const currentWeight = suggestion.alphaDragHolding.weight;
    if (currentWeight > MAX_WEIGHT_CHANGE_AUTO) {
      reasons.push(`weight_change_${currentWeight}%_exceeds_auto_limit_${MAX_WEIGHT_CHANGE_AUTO}%`);
    }
    if (regime === "BEAR" && best.beta != null && best.beta > 1.2) {
      reasons.push(`bear_regime_blocks_high_beta_${best.beta?.toFixed(2)}`);
    }
  }

  // ── Guardrail A: LTCG Maturity Window (Profit Lock) ───────────────────────
  // If holding is within PROFIT_GUARD_MATURITY_BUFFER_DAYS of crossing into LTCG,
  // defer the SELL — saves up to 7.5% tax (20% STCG → 12.5% LTCG, Finance Act 2024).
  // Only fires when lot data is available (holdingPeriodDays != null).
  if (suggestion.holdingPeriodDays != null) {
    const assetClass  = (suggestion.assetClass ?? "equity").toLowerCase();
    const ltcgDays    = LTCG_THRESHOLD_DAYS[assetClass] ?? LTCG_THRESHOLD_DAYS.default;
    const daysToLtcg  = ltcgDays - suggestion.holdingPeriodDays;
    const taxSaving   = suggestion.estimatedTaxSaved ?? 0;

    if (daysToLtcg > 0 && daysToLtcg <= PROFIT_GUARD_MATURITY_BUFFER_DAYS && taxSaving > 0) {
      reasons.push(
        `profit_lock:${daysToLtcg}d_to_ltcg_threshold:defer_saves_₹${Math.round(taxSaving).toLocaleString("en-IN")}_tax`,
      );
      logger.info("[ProfitGuard] LTCG maturity window — SELL deferred", {
        event:        "PROFIT_GUARD_LTCG_MATURITY_DEFERRED",
        user_id:      "system",
        portfolioId:  suggestion.portfolioId,
        holding:      suggestion.alphaDragHolding.name,
        daysToLtcg,
        taxSavingRs:  Math.round(taxSaving),
        model_version: suggestion.model_version,
        timestamp:    new Date().toISOString(),
        latency_ms:   0,
        status:       "deferred",
      });
    }
  }

  // ── Guardrail B: Exit Load Cost ────────────────────────────────────────────
  // Block auto-apply if exit load exceeds EXIT_LOAD_AUTO_BLOCK_PCT.
  // Most equity MFs charge 1% within 1yr; even 0.5% materially erodes the gain.
  // Routes to advisor queue with exact ₹ cost shown.
  if (suggestion.exitLoadPct != null && suggestion.exitLoadPct > EXIT_LOAD_AUTO_BLOCK_PCT) {
    reasons.push(
      `exit_load_${suggestion.exitLoadPct.toFixed(2)}pct_₹${Math.round(suggestion.exitLoadCost ?? 0).toLocaleString("en-IN")}_exceeds_auto_threshold`,
    );
    logger.info("[ProfitGuard] Exit load guardrail triggered", {
      event:        "PROFIT_GUARD_EXIT_LOAD_BLOCKED",
      user_id:      "system",
      portfolioId:  suggestion.portfolioId,
      holding:      suggestion.alphaDragHolding.name,
      exitLoadPct:  suggestion.exitLoadPct,
      exitLoadCostRs: Math.round(suggestion.exitLoadCost ?? 0),
      model_version: suggestion.model_version,
      timestamp:    new Date().toISOString(),
      latency_ms:   0,
      status:       "advisor_queue",
    });
  }

  // ── Guardrail C: Friction-to-Benefit Ratio ────────────────────────────────
  // If (tax + exit load) > 70% of the rebalancing benefit,
  // block the SELL and recommend cash-deploy instead (put new SIP into underweights).
  // This avoids destroying notional profit when the rebalancing gain is marginal.
  const frictionCost  = (suggestion.estimatedTaxCost ?? 0) + (suggestion.exitLoadCost ?? 0);
  const rebalBenefit  = suggestion.driftBenefitRs ?? 0;
  if (rebalBenefit > 0 && frictionCost / rebalBenefit > FRICTION_BENEFIT_RATIO_BLOCK) {
    const frictionPct = Math.round((frictionCost / rebalBenefit) * 100);
    reasons.push(
      `friction_cost_${frictionPct}pct_of_benefit:recommend_cash_deploy_instead_of_sell`,
    );
    logger.info("[ProfitGuard] Friction exceeds rebalancing benefit — cash-deploy recommended", {
      event:         "PROFIT_GUARD_CASH_DEPLOY_RECOMMENDED",
      user_id:       "system",
      portfolioId:   suggestion.portfolioId,
      holding:       suggestion.alphaDragHolding.name,
      frictionCostRs: Math.round(frictionCost),
      rebalBenefitRs: Math.round(rebalBenefit),
      frictionPct,
      model_version: suggestion.model_version,
      timestamp:     new Date().toISOString(),
      latency_ms:    0,
      status:        "cash_deploy",
    });
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
  const t0 = Date.now(); // needed for latency_ms in the completion log
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
    latency_ms: Date.now() - t0,  // C-E4: real latency
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
  const _autoApplyStart = Date.now(); // C-E4: capture start for real latency
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
      // H-E5: Derive actual triggers from suggestion factors + regime, not hardcoded list
      triggers: [...new Set([
        ...(riskReport.hardBreaches.length > 0 ? ["risk_breach" as TriggerType] : []),
        ...(riskReport.softWarnings.length > 0 ? ["risk_warning" as TriggerType] : []),
        ...(factors.some(f => f.startsWith("regime")) ? [`regime:${regime.regime}` as TriggerType] : []),
        ...(pSuggestions.flatMap(s => s.factors_considered)
          .filter(f => f.includes("alpha") || f.includes("momentum"))
          .map(f => (f.includes("alpha") ? "alpha_breach" : "momentum_signal") as TriggerType)),
      ])],
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
      latency_ms: Date.now() - _autoApplyStart,  // C-E4: real latency
      status: "success",
    });

    results.push(result);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// autoApplyCalendarRebalancing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calendar-triggered autonomous rebalancing for all published portfolios.
 *
 * Purpose:
 *   Runs on a cron schedule and checks each portfolio against its configured
 *   rebalancingFrequency. If the portfolio is overdue, runs the full optimizer
 *   pipeline and auto-applies confident swaps to the template.
 *   No human intervention required — fully AI-driven per FASP-AI v1.0.
 *
 * Inputs:
 *   - All published model_portfolios with their holdings, lastRebalanced, frequency
 *   - Market regime from detectRegime()
 *   - Optimization suggestions from generateOptimizationSuggestions()
 *
 * Outputs:
 *   - Updated model_portfolios.holdings + lastRebalanced for due portfolios
 *   - Structured log: AUTO_CALENDAR_REBALANCE_APPLIED per portfolio
 *   - Summary log: CALENDAR_REBALANCE_RUN_COMPLETE
 *
 * FASP-AI v1.0 constraints:
 *   - AI is Decision Support only — it cannot execute real trades
 *   - Model template changes only (no client account execution)
 *   - Every output includes: confidence_score, factors_considered, model_version, timestamp
 *   - All events logged to FASP advisory outputs
 */
export async function autoApplyCalendarRebalancing(): Promise<{
  portfoliosChecked: number;
  portfoliosRebalanced: number;
  portfoliosSkipped: number;
  timestamp: string;
}> {
  const runStart = Date.now();
  const today = new Date();
  logger.info("[CalendarRebalance] Starting autonomous calendar rebalance run", {
    event: "CALENDAR_REBALANCE_RUN_START",
    user_id: "system",
    timestamp: today.toISOString(),
    model_version: MODEL_VERSION,
    latency_ms: 0,  // correct: 0 at start
    status: "running",
  });

  // Fetch all published portfolios with equity holdings
  const allPortfolios = await db
    .select({
      id:                   modelPortfolios.id,
      name:                 modelPortfolios.name,
      holdings:             modelPortfolios.holdings,
      lastRebalanced:       modelPortfolios.lastRebalanced,
      rebalancingFrequency: modelPortfolios.rebalancingFrequency,
      riskProfile:          modelPortfolios.riskProfile,
    })
    .from(modelPortfolios)
    .where(eq(modelPortfolios.isPublished, true));

  let portfoliosChecked = 0;
  let portfoliosRebalanced = 0;
  let portfoliosSkipped = 0;

  for (const portfolio of allPortfolios) {
    portfoliosChecked++;

    // ── Calendar gate: check if rebalancing is due ────────────────────────────
    const isDue = isCalendarRebalanceDue(
      portfolio.lastRebalanced as string | null,
      portfolio.rebalancingFrequency as string | null,
    );

    if (!isDue) {
      portfoliosSkipped++;
      continue;
    }

    const holdings = (portfolio.holdings as any[]) ?? [];

    // BUG-2 FIX: Old check used isin.startsWith("INE") — INE* = equity stocks only.
    // MF ISINs are INF* (e.g. INF846K01EW2). This silently skipped ~80% of portfolios.
    // New: accept equity stocks (INE*), MF ISINs (INF*), AMFI scheme codes, or any
    // holding that has a positive weight (fallback for manually-seeded portfolios).
    const hasRebalancableHoldings = holdings.some(
      (h) =>
        (h.isin && (h.isin.startsWith("INE") || h.isin.startsWith("INF"))) ||
        h.amfiSchemeCode ||                              // mutual fund by AMFI code
        (h.type && ["equity", "MF", "debt", "hybrid", "gold", "reit"].includes(h.type)) ||
        (!h.isin && !h.type && Number(h.weight ?? 0) > 0) // fallback: seeded holding
    );
    if (!hasRebalancableHoldings) {
      portfoliosSkipped++;
      continue;
    }

    logger.info("[CalendarRebalance] Portfolio due for rebalancing", {
      portfolio_id:          portfolio.id,
      last_rebalanced:       portfolio.lastRebalanced,
      rebalancing_frequency: portfolio.rebalancingFrequency,
    });

    try {
      // Run optimizer pipeline for this specific portfolio only
      const regime = await detectRegime();
      const suggestions = await generateOptimizationSuggestions([portfolio.id]);

      // ── BUG-4 FIX: Weight rebalancing FIRST — before any fund swaps ───────────
      // Correct holdings back to their target weights WITHOUT changing any ISINs.
      // This mirrors real PMS operations: rebalance weights, then replace underperformers.
      const weightResult = applyWeightRebalancing(holdings, regime.regime);
      let updatedHoldings: any[] = weightResult.updated;
      const applied: string[] = [...weightResult.changes];

      if (weightResult.corrected > 0) {
        logger.info("[CalendarRebalance] Weight rebalancing applied", {
          portfolio_id:    portfolio.id,
          corrections:     weightResult.corrected,
          changes:         weightResult.changes.slice(0, 5),
        });
      }

      // Filter for high-confidence suggestions with actionable recommendations
      const applicableSuggestions = suggestions.filter(
        (s) =>
          s.confidence_score >= MIN_CONFIDENCE_AUTO_APPLY &&
          (s.recommendation === "replace" || s.recommendation === "reduce_weight")
      );

      if (applicableSuggestions.length === 0 && weightResult.corrected === 0) {
        // Portfolio is due but no corrections or confident suggestions — update date only
        await db
          .update(modelPortfolios)
          .set({ lastRebalanced: today.toISOString().split("T")[0], updatedAt: today })
          .where(eq(modelPortfolios.id, portfolio.id));

        logger.info("[CalendarRebalance] No swaps warranted, refreshed rebalance date", {
          portfolio_id: portfolio.id,
        });
        portfoliosSkipped++;
        continue;
      }

      // Apply up to MAX_AUTO_SWAPS_PER_RUN fund swaps (after weight correction)
      const swapLimit = Math.min(applicableSuggestions.length, MAX_AUTO_SWAPS_PER_RUN);

      for (let i = 0; i < swapLimit; i++) {
        const suggestion = applicableSuggestions[i];
        if (!suggestion) break;

        // Match drag holding by name or symbol (AlphaDragHolding has no isin field)
        const dragIdx = updatedHoldings.findIndex(
          (h) => h.name === suggestion.alphaDragHolding.name ||
                 (suggestion.alphaDragHolding.symbol && h.symbol === suggestion.alphaDragHolding.symbol)
        );
        if (dragIdx === -1) continue;

        if (suggestion.recommendation === "replace" && suggestion.alternatives.length > 0) {
          // Swap the drag holding with the highest-ranked alternative
          const best = suggestion.alternatives[0];
          updatedHoldings[dragIdx] = {
            ...updatedHoldings[dragIdx],
            name:   best.name,
            symbol: best.symbol,
            isin:   best.isin ?? (updatedHoldings[dragIdx].isin as string | null),
            // Preserve existing weight — swap the stock, not the allocation
          };
          applied.push(`Swap: ${suggestion.alphaDragHolding.name} → ${best.name}`);
        } else if (suggestion.recommendation === "reduce_weight") {
          // Trim weight by 5% (floor 1%)
          const WEIGHT_TRIM = 5;
          updatedHoldings[dragIdx] = {
            ...updatedHoldings[dragIdx],
            weight: Math.max(1, (updatedHoldings[dragIdx].weight as number) - WEIGHT_TRIM),
          };
          applied.push(`Reweight: ${suggestion.alphaDragHolding.name} -${WEIGHT_TRIM}%`);
        }
      }


      // Normalize weights to 100
      const totalWeight = updatedHoldings.reduce((sum, h) => sum + (h.weight ?? 0), 0);
      if (totalWeight > 0 && Math.abs(totalWeight - 100) > 0.1) {
        const scale = 100 / totalWeight;
        updatedHoldings = updatedHoldings.map((h) => ({
          ...h,
          weight: Math.round(h.weight * scale * 10) / 10,
        }));
      }

      // Persist updated template
      await db
        .update(modelPortfolios)
        .set({
          holdings:       updatedHoldings as any,
          lastRebalanced: today.toISOString().split("T")[0],
          updatedAt:      today,
        })
        .where(eq(modelPortfolios.id, portfolio.id));

      // ── Append structured event to rebalancingHistory JSONB ────────────────
      // This is what powers the rebalance-dot overlay on the bar chart card.
      // Each event: { date, trigger, swapsApplied, changes[], confidence, engine }
      const currentHistory: any[] = Array.isArray((portfolio as any).rebalancingHistory ?? (portfolio as any).rebalancing_history)
        ? ((portfolio as any).rebalancingHistory ?? (portfolio as any).rebalancing_history)
        : [];

      const rebalanceEvent = {
        date:         today.toISOString().split("T")[0],
        trigger:      "drift_triggered",                         // always drift-triggered per product decision
        swapsApplied: applied.length,
        changes:      applied.slice(0, 10),                      // cap at 10 for JSONB size
        confidence:   Math.round(
          (applicableSuggestions.slice(0, swapLimit)
            .reduce((s, sg) => s + sg.confidence_score, 0) / Math.max(swapLimit, 1)) * 100
        ),
        marketRegime: regime.regime,
        engine:       MODEL_VERSION,
        // Fix G: NAV at decision — SEBI audit trail requires recording the price in effect
        // at the time of the swap recommendation. Fetched from mf_nav_history; non-fatal if absent.
        navAtDecision: await (async () => {
          try {
            const firstSuggestion = applicableSuggestions[0];
            // The replacement candidate is at .alternatives[0] (HoldingCandidate)
            const best = firstSuggestion?.alternatives?.[0];
            const isin = best?.isin ?? null;  // HoldingCandidate has isin; AlphaDragHolding does not
            if (!isin) return null;
            const navRow = await db.execute(sql`
              SELECT nav_date, nav FROM mf_nav_history
              WHERE isin = ${String(isin)}
              ORDER BY nav_date DESC LIMIT 1
            `);
            const r = (navRow as any).rows?.[0];
            return r ? { navDate: r.nav_date, nav: Number(r.nav) } : null;
          } catch { return null; }
        })(),

      };

      // Keep only the last 24 events to prevent unbounded JSONB growth
      const updatedHistory = [...currentHistory, rebalanceEvent].slice(-24);

      await db.execute(sql`
        UPDATE model_portfolios
        SET rebalancing_history = ${JSON.stringify(updatedHistory)}::jsonb
        WHERE id = ${portfolio.id}
      `);

      logger.info("[CalendarRebalance] Rebalance event appended to history", {
        portfolio_id: portfolio.id,
        event_date:   rebalanceEvent.date,
        swaps:        applied.length,
      });

      // FASP-AI v1.0 audit trail
      const avgConfidence =
        applicableSuggestions
          .slice(0, swapLimit)
          .reduce((sum, s) => sum + s.confidence_score, 0) / swapLimit;

      await db.insert(faspAdvisoryOutputs).values({
        advisoryType:    "model_portfolio",
        userSegment:     "institutional",
        inputContext: {
          portfolioId:   portfolio.id,
          regime:        regime.regime,
          triggeredBy:   "calendar_rebalance",
          swapsApplied:  applied.length,
          frequency:     portfolio.rebalancingFrequency,
        } as any,
        recommendation:  `Calendar rebalance applied ${applied.length} changes: ${applied.join("; ").substring(0, 1000)}`,
        outputSnapshot: {
          applied,
          marketRegime:  regime.regime,
          avgConfidence,
        } as any,
        modelVersion:     "FASP-AI-v3.0",
        baseModel:        "rule-engine",
        confidenceScore:  Math.round(avgConfidence * 100),
        confidenceBreakdown: {} as any,
        confidenceThreshold: 70,
        meetsThreshold:   avgConfidence >= 0.70,
        humanReviewRequired: false,
        sebiCircularRef:  "SEBI/HO/IMD/2023/P/CIR/0188",
        source:           "cron",
      }).catch((err) => {
        logger.warn("[CalendarRebalance] FASP persist failed (non-fatal)", { error: err?.message });
      });

      logger.info("[CalendarRebalance] Calendar rebalance applied", {
        event:          "AUTO_CALENDAR_REBALANCE_APPLIED",
        user_id:        "system",
        portfolio_id:   portfolio.id,
        swaps_applied:  applied.length,
        market_regime:  regime.regime,
        avg_confidence: avgConfidence,
        model_version:  MODEL_VERSION,
        timestamp:      today.toISOString(),
        latency_ms:     Date.now() - runStart,
        status:         "success",
      });

      portfoliosRebalanced++;
    } catch (err: any) {
      logger.warn("[CalendarRebalance] Error processing portfolio", {
        portfolio_id: portfolio.id,
        error:        err?.message,
      });
      portfoliosSkipped++;
    }
  }

  const summary = {
    portfoliosChecked,
    portfoliosRebalanced,
    portfoliosSkipped,
    timestamp: today.toISOString(),
  };

  logger.info("[CalendarRebalance] Run complete", {
    event:                    "CALENDAR_REBALANCE_RUN_COMPLETE",
    user_id:                  "system",
    portfolios_checked:       portfoliosChecked,
    portfolios_rebalanced:    portfoliosRebalanced,
    portfolios_skipped:       portfoliosSkipped,
    latency_ms:               Date.now() - runStart,
    model_version:            MODEL_VERSION,
    timestamp:                today.toISOString(),
    status:                   "success",
  });

  return summary;
}

// ── applyWeightRebalancing ───────────────────────────────────────────────────────
/**
 * BUG-4 FIX: Weight drift correction — adjusts holding weights back to target
 * WITHOUT swapping the fund or changing any ISINs.
 *
 * Purpose:
 *   When holdings drift from their target weights due to market returns
 *   (e.g. equity grew from 60% → 75% in a bull run), trim/add weights back to
 *   target. This is called BEFORE fund-swap suggestions — matching real PMS ops:
 *   first rebalance weights, then replace underperformers.
 *
 * Guardrails:
 *   - Max 15% absolute correction per holding per run (prevents extreme swings)
 *   - In BEAR regime: block weight increases to equity/thematic holdings
 *   - Minimum holding weight: 1% (never reduce to zero)
 *   - Normalizes corrected weights to sum = 100%
 *
 * Inputs:
 *   holdings      — array of holdings with .weight and .targetWeight fields
 *   regime        — market regime for BEAR guardrail
 * Outputs:
 *   { updated: holding[], changes: string[], corrected: number }
 *   corrected = 0 means no drift warranting correction was found
 */
export function applyWeightRebalancing(
  holdings: any[],
  regime: MarketRegime,
): { updated: any[]; changes: string[]; corrected: number } {
  const MAX_CORRECTION_PER_HOLDING = 15;  // % absolute
  const MIN_HOLDING_WEIGHT = 1;           // %
  const DRIFT_TOLERANCE = 2;              // % — don't correct within ±2% of target (transaction costs)

  const changes: string[] = [];
  let corrected = 0;

  const updated = holdings.map((h: any) => {
    const current = Number(h.weight ?? 0);
    const target  = Number(h.targetWeight ?? h.weight ?? current); // fall back to current if no target
    const drift   = current - target; // positive = overweight, negative = underweight

    // Within tolerance — no correction needed
    if (Math.abs(drift) <= DRIFT_TOLERANCE) return h;

    const equityLike = ["equity", "thematic", "small_cap", "mid_cap"].includes(
      (h.type ?? h.category ?? "").toLowerCase()
    );

    // BEAR guardrail: don't increase equity exposure in a bear market
    if (regime === "BEAR" && drift < 0 && equityLike) {
      changes.push(`HOLD ${h.name}: skip equity increase in BEAR regime (drift: ${drift.toFixed(1)}%)`);
      return h;
    }

    // Apply correction capped at MAX_CORRECTION_PER_HOLDING
    const correction = Math.sign(-drift) * Math.min(Math.abs(drift), MAX_CORRECTION_PER_HOLDING);
    const newWeight  = Math.max(MIN_HOLDING_WEIGHT, Math.round((current + correction) * 10) / 10);

    if (newWeight === current) return h; // rounding neutralized the change

    changes.push(
      `REWEIGHT ${h.name}: ${current.toFixed(1)}% → ${newWeight.toFixed(1)}% (target: ${target.toFixed(1)}%)`
    );
    corrected++;
    return { ...h, weight: newWeight };
  });

  // Normalize corrected weights to sum = 100%
  if (corrected > 0) {
    const total = updated.reduce((s: number, h: any) => s + Number(h.weight ?? 0), 0);
    if (total > 0 && Math.abs(total - 100) > 0.1) {
      const scale = 100 / total;
      return {
        updated: updated.map((h: any) => ({
          ...h,
          weight: Math.round(Number(h.weight) * scale * 10) / 10,
        })),
        changes,
        corrected,
      };
    }
  }

  return { updated, changes, corrected };
}

// ── Helper: is the portfolio's rebalancing calendar due? ─────────────────────

/**
 * Determines if a portfolio is due for calendar rebalancing.
 *
 * @param lastRebalanced - ISO date string of last rebalance (e.g. "2026-04-01")
 * @param frequency - "weekly" | "monthly" | "quarterly" | "annually"
 * @returns true if the portfolio has passed its rebalancing interval
 */
function isCalendarRebalanceDue(
  lastRebalanced: string | null,
  frequency: string | null,
): boolean {
  if (!lastRebalanced || !frequency) return true; // never rebalanced → always due

  const last = new Date(lastRebalanced);
  const now  = new Date();
  const daysSinceLast = Math.floor((now.getTime() - last.getTime()) / 86_400_000);

  const thresholds: Record<string, number> = {
    weekly:    7,
    monthly:   30,
    quarterly: 90,
    annually:  365,
  };

  const threshold = thresholds[frequency.toLowerCase()] ?? 90;
  return daysSinceLast >= threshold;
}

// ── refreshDriftScores ───────────────────────────────────────────────────────────
/**
 * Computes per-portfolio drift scores for every published portfolio and writes
 * them back to model_portfolios.drift_score + model_portfolios.drift_details.
 *
 * Called daily after calendar rebalance check. Powers the drift meter progress
 * bar shown on the portfolio card (brief §4).
 *
 * @param portfolioIds - optional subset; if omitted, refreshes ALL published portfolios
 */
export async function refreshDriftScores(portfolioIds?: string[]): Promise<{
  refreshed: number;
  errors: number;
}> {
  const t0 = Date.now();
  let refreshed = 0;
  let errors = 0;

  try {
    const { driftEngine } = await import("./drift");

    // Fetch portfolios to evaluate
    const whereClause = portfolioIds?.length
      ? sql`WHERE p.id = ANY(${portfolioIds}) AND p.is_published = TRUE`
      : sql`WHERE p.is_published = TRUE`;

    const res = await db.execute(
      sql`SELECT p.id, p.holdings, p.allocation, p.drift_threshold FROM model_portfolios p ${whereClause} ORDER BY p.created_at ASC`
    );
    const portfolios = ((res as any).rows ?? []) as any[];

    for (const p of portfolios) {
      try {
        const holdings: any[]   = Array.isArray(p.holdings)   ? p.holdings   : [];
        const allocation: any[] = Array.isArray(p.allocation) ? p.allocation : [];
        if (holdings.length === 0) continue;

        // Build target allocation from holdings.weight
        const targetAllocation = holdings.map((h: any) => ({
          asset:  h.name ?? h.isin ?? h.symbol ?? "unknown",
          weight: Number(h.weight ?? 0),
        }));

        // Build current allocation from allocation array (market-value weights)
        const currentAllocation = allocation.length > 0
          ? allocation.map((a: any) => ({
              asset:  a.label ?? a.category ?? a.type ?? "other",
              weight: Number(a.weight ?? a.percentage ?? 0),
            }))
          : targetAllocation; // If no current allocation, drift = 0

        const driftThreshold = Number(p.drift_threshold ?? 5);
        const report = driftEngine.calculateDrift(
          { portfolio_id: p.id, target_allocation: targetAllocation, rebalance_policy: { frequency: "drift_triggered", drift_threshold: driftThreshold, tax_aware: true } }, // profit-guard enabled
          currentAllocation,
        );

        // Map to 0-100 drift score (largest drift as % of threshold band, capped at 100)
        const driftScore = Math.min(100, Math.round((report.largest_drift / Math.max(driftThreshold, 1)) * 100));
        const top5 = report.drifting_assets
          .filter((d) => Math.abs(d.delta) > 0)
          .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
          .slice(0, 5);

        await db.execute(sql`
          UPDATE model_portfolios
          SET drift_score   = ${driftScore},
              drift_details = ${JSON.stringify(top5)}::jsonb,
              updated_at    = NOW()
          WHERE id = ${p.id}
        `);
        refreshed++;
      } catch (err: any) {
        logger.warn("[DriftRefresh] Error scoring portfolio", { portfolio_id: p.id, error: err?.message });
        errors++;
      }
    }
  } catch (err: any) {
    logger.error("[DriftRefresh] Fatal error", { error: err?.message });
    errors++;
  }

  logger.info("[DriftRefresh] Drift score refresh complete", {
    event: "DRIFT_SCORES_REFRESHED",
    refreshed, errors,
    latency_ms: Date.now() - t0,
    status: errors === 0 ? "ok" : "partial",
  });

  return { refreshed, errors };
}
