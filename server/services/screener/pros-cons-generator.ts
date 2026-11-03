/**
 * @file pros-cons-generator.ts
 * @description Algorithmic financial strengths (Pros) and weaknesses (Cons) generator
 *              modeled on Screener.in standard rules. Evaluates balance sheet strength,
 *              profitability, CAGR, valuation, and capital allocation.
 *
 * @compliance GCR v1.0 — pure deterministic calculation (same input -> same output).
 */

export interface FinancialMetricInputs {
  roe?: number | null;
  roce?: number | null;
  pe?: number | null;
  pb?: number | null;
  debtToEquity?: number | null;
  dividendYield?: number | null;
  interestCoverage?: number | null;
  salesCagr3Y?: number | null;
  salesCagr5Y?: number | null;
  profitCagr3Y?: number | null;
  profitCagr5Y?: number | null;
  operatingCashFlow?: number | null;
  netIncome?: number | null;
  promoterHolding?: number | null;
  pledgedPercent?: number | null;
  existingPros?: string[] | null;
  existingCons?: string[] | null;
}

export interface ProsAndConsOutput {
  pros: string[];
  cons: string[];
}

/**
 * Normalizes percentage values that might be represented as either 0.15 or 15.0.
 * If val <= 1.0 (and > 0), returns val * 100.
 */
function normalizePercent(val: number | null | undefined): number | null {
  if (val == null || Number.isNaN(val)) return null;
  if (val > 0 && val <= 1.0) return +(val * 100).toFixed(2);
  return +val.toFixed(2);
}

/**
 * Generates financial Pros and Cons.
 * Preserves any verified existing pros/cons from exchange filings/Screener.in
 * and synthesizes additional algorithmic insights to guarantee high-quality analysis.
 */
export function generateProsAndCons(inputs: FinancialMetricInputs): ProsAndConsOutput {
  const prosSet = new Set<string>();
  const consSet = new Set<string>();

  // 1. Ingest existing verified points if provided
  if (Array.isArray(inputs.existingPros)) {
    for (const p of inputs.existingPros) {
      const clean = String(p).trim();
      if (clean.length > 5) prosSet.add(clean);
    }
  }
  if (Array.isArray(inputs.existingCons)) {
    for (const c of inputs.existingCons) {
      const clean = String(c).trim();
      if (clean.length > 5) consSet.add(clean);
    }
  }

  // 2. Normalize inputs
  const de = inputs.debtToEquity != null ? Number(inputs.debtToEquity) : null;
  const roePct = normalizePercent(inputs.roe);
  const rocePct = normalizePercent(inputs.roce);
  const dyPct = normalizePercent(inputs.dividendYield);
  const pb = inputs.pb != null ? Number(inputs.pb) : null;
  const pe = inputs.pe != null ? Number(inputs.pe) : null;
  const ic = inputs.interestCoverage != null ? Number(inputs.interestCoverage) : null;
  const pCagr5 = inputs.profitCagr5Y != null ? Number(inputs.profitCagr5Y) : null;
  const pCagr3 = inputs.profitCagr3Y != null ? Number(inputs.profitCagr3Y) : null;
  const sCagr5 = inputs.salesCagr5Y != null ? Number(inputs.salesCagr5Y) : null;
  const ocf = inputs.operatingCashFlow != null ? Number(inputs.operatingCashFlow) : null;
  const pat = inputs.netIncome != null ? Number(inputs.netIncome) : null;
  const pledged = inputs.pledgedPercent != null ? Number(inputs.pledgedPercent) : null;

  // ── Algorithmic Pros ─────────────────────────────────────────────────────────

  // Leverage & Solvency
  if (de !== null) {
    if (de <= 0.05) {
      prosSet.add("Company is almost debt free.");
    } else if (de < 0.35) {
      prosSet.add(`Company maintains a low debt-to-equity ratio (${de.toFixed(2)}x).`);
    }
  }

  if (ic !== null && ic >= 6.0) {
    prosSet.add(`Company has a healthy interest coverage ratio of ${ic.toFixed(1)}x.`);
  }

  // Profitability & Compounding
  if (pCagr5 !== null && pCagr5 >= 15.0) {
    prosSet.add(`Company has delivered good profit growth of ${pCagr5.toFixed(1)}% CAGR over the last 5 years.`);
  } else if (pCagr3 !== null && pCagr3 >= 18.0) {
    prosSet.add(`Company has delivered strong profit growth of ${pCagr3.toFixed(1)}% CAGR over the last 3 years.`);
  }

  if (rocePct !== null && rocePct >= 20.0) {
    prosSet.add(`Company has an attractive return on capital employed (ROCE) of ${rocePct.toFixed(1)}%.`);
  }

  if (roePct !== null && roePct >= 18.0) {
    prosSet.add(`Company has a good return on equity (ROE) track record: ${roePct.toFixed(1)}%.`);
  }

  // Dividends & Cash Flow
  if (dyPct !== null && dyPct >= 2.0) {
    prosSet.add(`Company has been maintaining a healthy dividend payout with a yield of ${dyPct.toFixed(2)}%.`);
  }

  if (ocf !== null && pat !== null && pat > 0 && ocf >= pat * 1.05) {
    prosSet.add("Operating cash flow exceeds net profit, indicating high earnings quality.");
  }

  // ── Algorithmic Cons ─────────────────────────────────────────────────────────

  // Valuation
  if (pb !== null && pb >= 6.0) {
    consSet.add(`Stock is trading at ${pb.toFixed(1)}x its book value.`);
  }

  if (pe !== null && pe >= 60.0) {
    consSet.add(`Stock is trading at an elevated price-to-earnings ratio of ${pe.toFixed(1)}x.`);
  }

  // Leverage Risk
  if (de !== null && de >= 1.8) {
    consSet.add(`Company has high financial leverage with debt-to-equity ratio of ${de.toFixed(2)}x.`);
  }

  if (ic !== null && ic > 0 && ic < 2.0) {
    consSet.add(`Company has a low interest coverage ratio of ${ic.toFixed(1)}x.`);
  }

  // Growth & Profitability Lags
  if (sCagr5 !== null && sCagr5 < 5.0 && sCagr5 > -50) {
    consSet.add(`Company has delivered poor sales growth of ${sCagr5.toFixed(1)}% over the past 5 years.`);
  }

  if (pCagr5 !== null && pCagr5 < 0) {
    consSet.add(`Company's profit growth has contracted by ${Math.abs(pCagr5).toFixed(1)}% CAGR over the past 5 years.`);
  }

  if (roePct !== null && roePct < 8.0 && roePct > 0) {
    consSet.add(`Company has a low return on equity (ROE) of ${roePct.toFixed(1)}%.`);
  }

  // Governance / Pledging
  if (pledged !== null && pledged > 10.0) {
    consSet.add(`Promoters have pledged ${pledged.toFixed(1)}% of their shareholding.`);
  }

  // Fallbacks if lists are empty
  if (prosSet.size === 0) {
    if (de !== null && de < 1.0) prosSet.add("Manageable debt levels relative to equity base.");
    else prosSet.add("Established market presence with active exchange liquidity.");
  }

  if (consSet.size === 0) {
    if (pb !== null && pb > 3.0) consSet.add("Stock trades at a premium to historical book value.");
    else consSet.add("Subject to macroeconomic and cyclical industry volatility.");
  }

  return {
    pros: Array.from(prosSet),
    cons: Array.from(consSet),
  };
}

