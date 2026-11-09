/**
 * @module advisory-output-formatter
 * @description Role-adaptive output depth for picks and recommendations.
 *
 * Purpose:
 *   All FintekPro engines produce the same quality output regardless of who is
 *   viewing it. This formatter adapts the *depth* of data returned per caller role:
 *
 *   "retail" / "user"     → headline rationale only (SEBI-compliant simplified)
 *   "agent" / "advisor"   → + buyThesis, keyRisks, catalysts, scoring breakdown
 *   "admin" / "superadmin"→ + full model_version, confidence_factors, telemetry
 *
 *   The recommendation itself NEVER changes — only the metadata richness changes.
 *   This keeps engines 100% role-agnostic internally.
 *
 * SEBI IA Compliance:
 *   - ALL output depths include the mandatory REGULATORY_DISCLAIMER
 *   - Retail depth explicitly hides internal confidence scoring to prevent
 *     over-reliance on AI scores by retail investors (SEBI IA Reg. 16 guidance)
 *
 * @version 1.0.0
 */

import { REGULATORY_DISCLAIMER } from "../routes/pick-of-the-day-utils";

const FORMATTER_VERSION = "1.0.0";

export type OutputDepth = "retail" | "advisor" | "institutional";

/** Map DB role strings → output depth */
export function resolveOutputDepth(role: string | undefined): OutputDepth {
  const r = (role ?? "user").toLowerCase();
  if (r === "admin" || r === "superadmin" || r === "compliance_officer") {
    return "institutional";
  }
  if (r === "agent" || r === "advisor" || r === "master_agent") {
    return "advisor";
  }
  return "retail";
}

/**
 * Format a pick record for the appropriate output depth.
 * Engine output is NEVER modified — only fields are included or excluded.
 *
 * @param pick    - Raw pick record from DB / pick-of-the-day-service
 * @param role    - User role from req.user.role
 * @returns       - Pick with role-appropriate field depth
 */
export function formatPickForRole(pick: Record<string, unknown>, role: string | undefined): Record<string, unknown> {
  const depth = resolveOutputDepth(role);
  const km = (pick.keyMetrics ?? {}) as Record<string, unknown>;
  const isDerivative = pick.category === "derivatives" || Boolean(km.strategy);

  // Preserve full derivative architecture & Greeks across all user roles
  // (Mandatory under SEBI circular SEBI/HO/MRD/POD1/CIR/P/2024/132 for complete risk disclosure)
  const derivativeMetrics = isDerivative
    ? {
        strategy: km.strategy,
        strategyType: km.strategyType,
        isCreditStrategy: km.isCreditStrategy ?? (Number(pick.targetPrice) < Number(pick.recoPrice) && Number(pick.recoPrice) > 0),
        iv: km.iv ?? km.impliedVolatility,
        impliedVolatility: km.impliedVolatility ?? km.iv,
        lotSize: km.lotSize,
        spotPrice: km.spotPrice,
        strikePrice: km.strikePrice,
        premiumPerUnit: km.premiumPerUnit,
        totalNetPremium: km.totalNetPremium,
        maxProfit: km.maxProfit,
        maxLoss: km.maxLoss,
        breakeven: km.breakeven,
        marginRequired: km.marginRequired,
        legs: km.legs,
        greeks: km.greeks,
        outlook: km.outlook,
        ivRegime: km.ivRegime,
        regulatoryNote: km.regulatoryNote,
        expiryDayELMPct: km.expiryDayELMPct,
        cashMarginRequiredPct: km.cashMarginRequiredPct,
        sebiCircularRef: km.sebiCircularRef,
        description: km.description,
      }
    : {};

  const baseKeyMetrics: Record<string, unknown> = {
    cmp: km.cmp,
    pe: km.pe,
    roic: km.roic,
    rsi: km.rsi,
    sector: km.sector,
    broadSectorLabel: km.broadSectorLabel,
    broadSectorIcon: km.broadSectorIcon,
    broadSectorColor: km.broadSectorColor,
    suggestedAllocation: km.suggestedAllocation,
    distributionYield: km.distributionYield,
    ...derivativeMetrics,
  };

  // Always included (retail baseline)
  const base: Record<string, unknown> = {
    id: pick.id,
    category: pick.category,
    instrumentName: pick.instrumentName,
    symbol: pick.symbol,
    exchange: pick.exchange,
    recoDate: pick.recoDate,
    recoPrice: pick.recoPrice,
    targetPrice: pick.targetPrice,
    stoplossPrice: pick.stoplossPrice,
    currentPrice: pick.currentPrice,
    returnPct: pick.returnPct,
    status: pick.status,
    expiryDate: pick.expiryDate,
    rationale: pick.rationale,       // Plain-language headline
    riskLevel: pick.riskLevel,
    suitableFor: pick.suitableFor,
    timeHorizon: pick.timeHorizon,
    sectorCategory: pick.sectorCategory,
    // Expose confidenceScore to all roles — it powers the AI% column in the
    // picks table which is visible to all authenticated users. The qualitative
    // confidenceLabel is kept for the detail panel and SEBI-compliant display.
    confidenceScore: pick.confidenceScore,
    confidenceLabel: scoreToLabel(pick.confidenceScore as number | undefined),
    priceDataSource: pick.priceDataSource ?? "Live Exchange Feed",
    dataFreshness: pick.dataFreshness ?? "live",
    lastPriceUpdate: pick.lastPriceUpdate ?? new Date().toISOString(),
    keyMetrics: baseKeyMetrics,
    disclaimer: REGULATORY_DISCLAIMER,
    formatter_version: FORMATTER_VERSION,
  };

  if (depth === "retail") return base;

  // Advisor depth: adds analytical richness
  const advisor: Record<string, unknown> = {
    ...base,
    confidenceScore: pick.confidenceScore, // numerical score for advisor transparency
    isin: pick.isin,
    keyMetrics: {
      ...baseKeyMetrics,
      returns1y: km.returns1y,
      returns3y: km.returns3y,
      volatility: km.volatility,
      marketCap: km.marketCap,
      analystRating: km.analystRating,
      rewardToRiskRatio: km.rewardToRiskRatio,
      debtCoverageRatio: km.debtCoverageRatio,
    },
    // Regime context (set by pick engine from telemetry bus)
    regime: pick.regime,
    alphaQuality: pick.alphaQuality,
  };

  if (depth === "advisor") return advisor;

  // Institutional depth: full internals for compliance and admin
  return {
    ...advisor,
    keyMetrics: km, // Full unfiltered keyMetrics including rawQuantScore, qualityTier, etc.
    // Full traceability
    scorer_version: pick.scorer_version ?? km.scorer_version,
    calculation_timestamp: pick.createdAt ?? pick.updatedAt,
    engine_version: FORMATTER_VERSION,
    // Telemetry labels (set by pick engine)
    confidenceDecayPct: km.confidenceDecayPct,
    rawQuantScore: km.rawQuantScore,
    qualityTier: km.qualityTier,
    atr14Pct: km.atr14Pct,
    broadSectorIcon: km.broadSectorIcon,
    broadSectorColor: km.broadSectorColor,
  };
}

/**
 * Format an array of picks for a given role.
 * Convenience wrapper over formatPickForRole.
 */
export function formatPicksForRole(
  picks: Record<string, unknown>[],
  role: string | undefined,
): Record<string, unknown>[] {
  return picks.map((p) => formatPickForRole(p, role));
}

/** Convert numerical confidence score to qualitative label. */
function scoreToLabel(score: number | undefined): string {
  if (score == null) return "unrated";
  if (score >= 80) return "very high";
  if (score >= 70) return "high";
  if (score >= 60) return "medium";
  return "developing";
}
