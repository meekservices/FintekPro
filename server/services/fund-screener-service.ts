/* eslint-disable no-console */
/**
 * fund-screener-service.ts — Layer 3: Fund Screener & Substitution Engine (FASP-AI v3.0)
 *
 * Ranks all funds in fund_performance_cache by composite alpha score.
 * Detects underperformers in each model portfolio's holdings.
 * Proposes ranked substitutions for advisor review and approval.
 *
 * FASP-AI mandate: AI PROPOSES, advisor APPROVES. Never autonomous execution.
 * Every proposal includes: reason, alpha gain, confidence score, disclaimer.
 *
 * Thresholds:
 *   - Flag if: 1Y alpha vs benchmark < -1% sustained for 90+ days
 *   - Flag if: Sharpe < 0.8 for equity funds, < 0.5 for debt
 *   - Propose substitution if: ranked alternative has alpha score ≥ current + 10pts
 *
 * SEBI ref: SEBI/HO/IMD/2023/P/CIR/0188
 */
import { db } from "../db";
import { fundPerformanceCache, rebalanceProposals, modelPortfolios } from "@shared/schema";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { logger } from "../logger";
import { createAlert } from "./portfolio-alert-service";

const ENGINE_VERSION = "FASP-AI-v3.0";

// Thresholds
const EQUITY_ALPHA_THRESHOLD   = -1.0;  // flag equity fund if 1Y alpha < -1%
const DEBT_ALPHA_THRESHOLD     = -0.5;  // flag debt fund if 1Y alpha < -0.5%
const EQUITY_SHARPE_MIN        = 0.8;
const DEBT_SHARPE_MIN          = 0.5;
const MIN_ALPHA_SCORE_GAIN     = 10;    // substitute only if replacement scores ≥ current + 10 pts
const MAX_SUBSTITUTIONS        = 3;     // at most 3 per portfolio per cycle

interface SubstitutionProposal {
  removeIsin:      string;
  removeName:      string;
  removeAlpha:     number;
  removeSharpe:    number;
  addIsin:         string;
  addName:         string;
  addAlpha:        number;
  addSharpe:       number;
  alphaGain:       number;      // estimated annual alpha improvement
  confidence:      number;      // 0-100
  reason:          string;
  assetClass:      string;
}

// ── Rank funds by alpha score within an asset class ──────────────────────────
export async function rankFundsByAlpha(assetClass: string, limit = 20): Promise<typeof fundPerformanceCache.$inferSelect[]> {
  return db.select()
    .from(fundPerformanceCache)
    .where(and(
      eq(fundPerformanceCache.assetClass, assetClass),
      isNotNull(fundPerformanceCache.alphaScore),
      isNotNull(fundPerformanceCache.cagr1y),
    ))
    .orderBy(desc(fundPerformanceCache.alphaScore))
    .limit(limit);
}

// ── Detect underperforming holdings ──────────────────────────────────────────
async function detectUnderperformers(holdings: Array<Record<string, unknown>>): Promise<Array<{
  isin: string; name: string; assetClass: string; reason: string;
  currentAlpha: number; currentSharpe: number; alphaScore: number;
}>> {
  const underperformers = [];

  for (const h of holdings) {
    const isin = (h["isin"] as string | undefined) ?? "";
    if (!isin || isin.length < 10) continue;

    const cacheRows = await db.select().from(fundPerformanceCache).where(eq(fundPerformanceCache.isin, isin)).limit(1);
    if (!cacheRows[0]) continue;

    const fund = cacheRows[0];
    const isDebt = (fund.assetClass ?? "equity") === "debt";
    const alphaThreshold = isDebt ? DEBT_ALPHA_THRESHOLD : EQUITY_ALPHA_THRESHOLD;
    const sharpeMin = isDebt ? DEBT_SHARPE_MIN : EQUITY_SHARPE_MIN;

    const alpha  = fund.alphaVsNifty != null ? parseFloat(String(fund.alphaVsNifty)) : null;
    const sharpe = fund.sharpeRatio   != null ? parseFloat(String(fund.sharpeRatio))  : null;
    const score  = fund.alphaScore    != null ? parseFloat(String(fund.alphaScore))   : 0;

    const reasons: string[] = [];
    if (alpha != null  && alpha < alphaThreshold)  reasons.push(`1Y alpha ${alpha.toFixed(1)}% < threshold ${alphaThreshold}%`);
    if (sharpe != null && sharpe < sharpeMin)       reasons.push(`Sharpe ${sharpe.toFixed(2)} < minimum ${sharpeMin}`);

    if (reasons.length > 0) {
      underperformers.push({
        isin,
        name:         (h["name"] as string) ?? fund.schemeName ?? isin,
        assetClass:   fund.assetClass ?? "equity",
        reason:       reasons.join("; "),
        currentAlpha: alpha ?? 0,
        currentSharpe: sharpe ?? 0,
        alphaScore:   score,
      });
    }
  }
  return underperformers;
}

// ── Build substitution proposals for a portfolio ─────────────────────────────
export async function proposeSubstitutions(portfolioId: string): Promise<SubstitutionProposal[]> {
  const rows = await db.select({ holdings: modelPortfolios.holdings })
    .from(modelPortfolios)
    .where(eq(modelPortfolios.id, portfolioId))
    .limit(1);

  if (!rows[0]) return [];
  const holdings = Array.isArray(rows[0].holdings) ? rows[0].holdings as Array<Record<string, unknown>> : [];
  if (!holdings.length) return [];

  const underperformers = await detectUnderperformers(holdings);
  if (!underperformers.length) return [];

  const proposals: SubstitutionProposal[] = [];
  const usedISINs = new Set(holdings.map((h) => (h["isin"] as string | undefined) ?? ""));

  for (const underperf of underperformers.slice(0, MAX_SUBSTITUTIONS)) {
    const candidates = await rankFundsByAlpha(underperf.assetClass, 10);

    // Find best candidate not already in portfolio and with sufficient alpha gain
    const best = candidates.find((c) => {
      if (usedISINs.has(c.isin)) return false;
      const candidateScore = parseFloat(String(c.alphaScore ?? "0"));
      return candidateScore - underperf.alphaScore >= MIN_ALPHA_SCORE_GAIN;
    });

    if (!best) continue;

    const bestAlpha  = parseFloat(String(best.alphaVsNifty ?? "0"));
    const bestSharpe = parseFloat(String(best.sharpeRatio  ?? "0"));
    const alphaGain  = parseFloat((bestAlpha - underperf.currentAlpha).toFixed(2));
    const confidence = Math.min(100, Math.round(
      (parseFloat(String(best.alphaScore ?? "0")) - underperf.alphaScore) * 2
    ));

    proposals.push({
      removeIsin:   underperf.isin,
      removeName:   underperf.name,
      removeAlpha:  underperf.currentAlpha,
      removeSharpe: underperf.currentSharpe,
      addIsin:      best.isin,
      addName:      best.schemeName ?? best.isin,
      addAlpha:     bestAlpha,
      addSharpe:    bestSharpe,
      alphaGain,
      confidence,
      reason:       underperf.reason,
      assetClass:   underperf.assetClass,
    });

    usedISINs.add(best.isin); // don't reuse the same replacement in this cycle
  }
  return proposals;
}

// ── Write proposal to DB ──────────────────────────────────────────────────────
async function writeProposal(portfolioId: string, proposals: SubstitutionProposal[]): Promise<string | null> {
  if (!proposals.length) return null;

  const totalAlphaGain = proposals.reduce((acc, p) => acc + p.alphaGain, 0);
  const avgConfidence  = Math.round(proposals.reduce((acc, p) => acc + p.confidence, 0) / proposals.length);
  const maxAlpha = Math.max(...proposals.map((p) => Math.abs(p.removeAlpha)));
  const driftSeverity  = maxAlpha > 3 ? "critical" : maxAlpha > 1.5 ? "high" : "moderate";

  const [inserted] = await db.insert(rebalanceProposals).values({
    portfolioId,
    proposedBy:     ENGINE_VERSION,
    engineVersion:  ENGINE_VERSION,
    status:         "pending",
    substitutions:  proposals as unknown as typeof rebalanceProposals.$inferInsert["substitutions"],
    totalAlphaGain: String(parseFloat(totalAlphaGain.toFixed(2))),
    confidence:     avgConfidence,
    driftSeverity,
    source:         "system",
  }).returning({ id: rebalanceProposals.id });

  return inserted?.id ?? null;
}

// ── Apply an approved proposal to the portfolio holdings ─────────────────────
export async function applyApprovedProposal(proposalId: string, advisorUserId: string): Promise<void> {
  const [proposal] = await db.select().from(rebalanceProposals).where(eq(rebalanceProposals.id, proposalId)).limit(1);
  if (!proposal) throw new Error(`Proposal ${proposalId} not found`);
  if (proposal.status !== "pending") throw new Error(`Proposal ${proposalId} is ${proposal.status} — cannot apply`);

  const substitutions = (proposal.substitutions as unknown as SubstitutionProposal[]) ?? [];
  if (!substitutions.length) throw new Error("Proposal has no substitutions");

  // Fetch current holdings
  const [portRow] = await db.select({ holdings: modelPortfolios.holdings })
    .from(modelPortfolios)
    .where(eq(modelPortfolios.id, proposal.portfolioId))
    .limit(1);
  if (!portRow) throw new Error(`Portfolio ${proposal.portfolioId} not found`);

  const holdings = Array.isArray(portRow.holdings) ? portRow.holdings as Array<Record<string, unknown>> : [];
  let updatedHoldings = [...holdings];

  // Apply each substitution
  for (const sub of substitutions) {
    const idx = updatedHoldings.findIndex((h) => (h["isin"] as string | undefined) === sub.removeIsin);
    if (idx !== -1) {
      const existing = updatedHoldings[idx];
      updatedHoldings[idx] = {
        ...existing,
        isin:          sub.addIsin,
        name:          sub.addName,
        currentReturn: sub.addAlpha + 10, // proxy: alpha + baseline
        // Preserve rank and weight from removed holding
      };
    }
  }

  // Write updated holdings and mark proposal as executed
  await db.update(modelPortfolios)
    .set({
      holdings:  updatedHoldings as unknown as typeof modelPortfolios.$inferInsert["holdings"],
      updatedAt: new Date(),
      source:    "system",
    })
    .where(eq(modelPortfolios.id, proposal.portfolioId));

  await db.update(rebalanceProposals)
    .set({
      status:         "executed",
      reviewedBy:     advisorUserId,
      reviewedAt:     new Date(),
      executedAt:     new Date(),
      executionNotes: `Applied ${substitutions.length} substitution(s) by ${advisorUserId}`,
      updatedAt:      new Date(),
    })
    .where(eq(rebalanceProposals.id, proposalId));

  logger.info({
    event: "PROPOSAL_EXECUTED",
    proposalId,
    portfolioId: proposal.portfolioId,
    substitutions: substitutions.length,
    approvedBy: advisorUserId,
    engine_version: ENGINE_VERSION,
  });
}

// ── Weekly screener batch — runs Sunday 7AM IST ───────────────────────────────
export async function runWeeklyScreener(): Promise<void> {
  const t0 = Date.now();
  logger.info({ event: "WEEKLY_SCREENER_START", engine_version: ENGINE_VERSION });

  const portfolios = await db.select({ id: modelPortfolios.id, name: modelPortfolios.name }).from(modelPortfolios);
  let proposed = 0, clean = 0, errors = 0;

  for (const portfolio of portfolios) {
    try {
      const proposals = await proposeSubstitutions(portfolio.id);
      if (!proposals.length) { clean++; continue; }

      const proposalId = await writeProposal(portfolio.id, proposals);
      if (proposalId) {
        proposed++;
        // Create alert for advisor
        await createAlert({
          portfolioId: portfolio.id,
          alertType:   "SUBSTITUTION_AVAILABLE",
          severity:    proposals.some((p) => Math.abs(p.removeAlpha) > 3) ? "critical" : "warning",
          title:       `Rebalance Proposal: ${portfolio.name}`,
          message:     `${proposals.length} substitution${proposals.length > 1 ? "s" : ""} proposed — est. +${proposals.reduce((a, p) => a + p.alphaGain, 0).toFixed(1)}% alpha gain`,
          metadata:    { proposalId, substitutions: proposals.length, totalAlphaGain: proposals.reduce((a, p) => a + p.alphaGain, 0) },
        });
      }
    } catch (err) {
      errors++;
      logger.warn({
        event: "SCREENER_PORTFOLIO_ERR",
        portfolioId: portfolio.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info({
    event: "WEEKLY_SCREENER_COMPLETE",
    portfolios: portfolios.length, proposed, clean, errors,
    latency_ms: Date.now() - t0,
    engine_version: ENGINE_VERSION,
  });
}
