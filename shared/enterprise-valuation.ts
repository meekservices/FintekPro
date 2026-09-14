/**
 * Enterprise Valuation Engine — FASP-EV-v1.0
 *
 * Purpose:
 *   Computes a blended Enterprise Value (EV) for unlisted / pre-IPO companies
 *   using 3 methods: Discounted Cash Flow (DCF), Comparable Company Multiples,
 *   and Book-Value-based approach.  The blended result is used to derive a
 *   fair per-share price and compare it against the current OTC market price.
 *
 * Methodology:
 *   1. Revenue CAGR  — computed over all available annual periods (1–5 years)
 *   2. EBITDA normalisation — trailing average margin × latest revenue
 *   3. DCF EV         — 5-year explicit FCF projection + Gordon-Growth terminal value
 *   4. Comparable EV  — sector median EV/EBITDA · P/E · P/S multiples
 *   5. Book Value EV  — Networth × (1 + ROE / sector P/B)
 *   6. Blended EV     — 40 % DCF + 35 % Comparables + 25 % Book Value
 *   7. Equity Value   — Blended EV − Net Debt + Cash
 *   8. Fair Price     — Equity Value / Total Shares Outstanding
 *
 * FASP-AI v1.0 Compliance:
 *   - Same input → same output (zero randomness)
 *   - Every output exposes inputs, formulas, and intermediate steps
 *   - confidence_score, model_version, calculation_timestamp on every result
 *   - Mandatory SEBI disclaimer on every advisory output
 *
 * SEBI Disclosure (mandatory):
 *   These estimates are INDICATIVE only. They are NOT SEBI-approved valuations.
 *   Unlisted / pre-IPO investments are highly illiquid and speculative. Past
 *   financial performance does not guarantee future results. Consult a SEBI-
 *   registered investment advisor before making any investment decision.
 */

export const ENGINE_VERSION = "FASP-EV-v1.0" as const;

// ─── Sector Comparable Multiples ─────────────────────────────────────────────
// Sourced from NSE/BSE public company medians; reviewed quarterly.
// All multiples are mid-points of observed trailing-twelve-month ranges.

interface SectorMultiples {
  evEbitda: number;   // EV / EBITDA
  pe: number;         // Price / Earnings (PAT)
  ps: number;         // Price / Sales (Revenue)
  pb: number;         // Price / Book Value
  wacc: number;       // Weighted Average Cost of Capital (%)
}

const SECTOR_MULTIPLES: Record<string, SectorMultiples> = {
  "technology":           { evEbitda: 32, pe: 47, ps: 9,  pb: 8,  wacc: 0.12 },
  "saas":                 { evEbitda: 36, pe: 55, ps: 11, pb: 10, wacc: 0.13 },
  "fintech":              { evEbitda: 20, pe: 28, ps: 6,  pb: 5,  wacc: 0.13 },
  "nbfc":                 { evEbitda: 18, pe: 25, ps: 5,  pb: 4,  wacc: 0.12 },
  "banking":              { evEbitda: 16, pe: 22, ps: 4,  pb: 3,  wacc: 0.11 },
  "financial services":   { evEbitda: 18, pe: 26, ps: 5,  pb: 4,  wacc: 0.12 },
  "consumer":             { evEbitda: 24, pe: 36, ps: 3,  pb: 6,  wacc: 0.11 },
  "ecommerce":            { evEbitda: 28, pe: 45, ps: 4,  pb: 7,  wacc: 0.14 },
  "food delivery":        { evEbitda: 30, pe: 50, ps: 4,  pb: 8,  wacc: 0.14 },
  "healthcare":           { evEbitda: 27, pe: 36, ps: 4,  pb: 6,  wacc: 0.11 },
  "pharma":               { evEbitda: 25, pe: 34, ps: 4,  pb: 6,  wacc: 0.11 },
  "manufacturing":        { evEbitda: 12, pe: 18, ps: 1.8,pb: 3,  wacc: 0.11 },
  "market infrastructure":{ evEbitda: 40, pe: 55, ps: 15, pb: 12, wacc: 0.10 },
  "stock exchanges":      { evEbitda: 40, pe: 55, ps: 15, pb: 12, wacc: 0.10 },
  "engineering":          { evEbitda: 18, pe: 25, ps: 2,  pb: 4,  wacc: 0.12 },
  "automotive":           { evEbitda: 14, pe: 20, ps: 1.5,pb: 3,  wacc: 0.12 },
  "electric vehicle":     { evEbitda: 30, pe: 60, ps: 6,  pb: 8,  wacc: 0.15 },
  "logistics":            { evEbitda: 18, pe: 28, ps: 2,  pb: 4,  wacc: 0.12 },
  "default":              { evEbitda: 18, pe: 28, ps: 3,  pb: 4,  wacc: 0.13 },
};

/** Returns the best-matching sector multiples, falling back to "default". */
function getSectorMultiples(sector: string | null | undefined): SectorMultiples {
  if (!sector) return SECTOR_MULTIPLES["default"];
  const key = sector.toLowerCase();
  // Exact match first
  if (SECTOR_MULTIPLES[key]) return SECTOR_MULTIPLES[key];
  // Partial keyword match
  for (const [k, v] of Object.entries(SECTOR_MULTIPLES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return SECTOR_MULTIPLES["default"];
}

// ─── Input / Output Types ─────────────────────────────────────────────────────

/**
 * One year's worth of financial data for a company.
 * All monetary figures in ₹ Crore (Indian financial standard).
 */
export interface YearlyFinancial {
  financialYear: string;          // e.g. "FY2023-24"
  revenue: number | null;         // ₹ Cr
  ebitda: number | null;          // ₹ Cr
  pat: number | null;             // Profit After Tax, ₹ Cr
  netProfit: number | null;       // ₹ Cr (alias for pat if pat is null)
  freeCashFlow: number | null;    // ₹ Cr
  totalDebt: number | null;       // ₹ Cr
  networth: number | null;        // ₹ Cr (shareholders' equity)
  cash: number | null;            // ₹ Cr (cash & cash equivalents — operatingCashFlow proxy)
}

export interface EVInput {
  companyName: string;
  sector: string | null | undefined;
  totalSharesOutstanding: number;     // Absolute share count (not in Cr)
  currentOtcPricePerShare: number;    // ₹ per share (OTC / unlisted market price)
  yearlyFinancials: YearlyFinancial[]; // Min 1, max 5, in ASCENDING year order
}

export interface EVResult {
  // ── Inputs used (explainability) ─────────────────────────────────────────
  companyName: string;
  sector: string;
  yearsAnalysed: number;
  financialYears: string[];

  // ── Intermediate metrics ──────────────────────────────────────────────────
  revenueCAGR: number | null;         // % p.a. (null if <2 data points)
  ebitdaMarginAvg: number | null;     // % average EBITDA margin over period
  ebitdaNormalized: number | null;    // ₹ Cr — trailing avg margin × latest revenue
  patLatest: number | null;           // ₹ Cr — latest PAT
  revenueLatest: number | null;       // ₹ Cr — latest revenue
  fcfLatest: number | null;           // ₹ Cr — latest FCF
  netDebt: number;                    // ₹ Cr (totalDebt − cash; can be negative = net cash)
  networthLatest: number | null;      // ₹ Cr
  sectorWacc: number;                 // e.g. 0.12 for 12%
  terminalGrowthRate: number;         // e.g. 0.06 for 6%

  // ── Valuation outputs (₹ Cr) ─────────────────────────────────────────────
  dcfEV: number | null;               // DCF Enterprise Value
  comparablesEV: number | null;       // Comparable multiples EV
  bookValueEV: number | null;         // Book value implied EV
  blendedEV: number;                  // Final blended EV
  equityValue: number;                // blendedEV − netDebt

  // ── Per-share outputs ─────────────────────────────────────────────────────
  fairSharePrice: number;             // ₹ (equityValue / totalShares)
  currentOtcPrice: number;            // ₹ (echo of input)
  discountToPremiumPct: number;       // % (+ve = OTC premium, -ve = OTC discount = undervalued)

  // ── Confidence & metadata ─────────────────────────────────────────────────
  confidenceScore: number;            // 0.0 – 1.0
  dataGaps: string[];                 // Human-readable list of missing data
  engineVersion: typeof ENGINE_VERSION;
  calculationTimestamp: string;       // ISO-8601
  sebiDisclaimer: string;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

function n(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const parsed = typeof v === "string" ? parseFloat(v) : v;
  return isFinite(parsed) ? parsed : null;
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

/**
 * Calculates a blended Enterprise Value for an unlisted / pre-IPO company
 * using multi-year financial data.
 *
 * @param input - Company metadata + yearwise financials (ascending year order)
 * @returns     - Fully explainable EVResult with all intermediate steps
 *
 * @example
 * const result = calculateEnterpriseValue({
 *   companyName: "National Stock Exchange of India Limited",
 *   sector: "Market Infrastructure",
 *   totalSharesOutstanding: 495_000_000,
 *   currentOtcPricePerShare: 1850,
 *   yearlyFinancials: [fy21, fy22, fy23, fy24, fy25],
 * });
 */
export function calculateEnterpriseValue(input: EVInput): EVResult {
  const dataGaps: string[] = [];
  const multiples = getSectorMultiples(input.sector);
  const fys = input.yearlyFinancials;

  // ── Step 1: Extract latest year ────────────────────────────────────────────
  const latest = fys[fys.length - 1];
  const oldest = fys[0];
  const yearsAnalysed = fys.length;
  const financialYears = fys.map((f) => f.financialYear);

  const revenueLatest = n(latest?.revenue);
  const ebitdaLatest = n(latest?.ebitda);
  const patLatest = n(latest?.pat) ?? n(latest?.netProfit);
  const fcfLatest = n(latest?.freeCashFlow);
  const networthLatest = n(latest?.networth);
  const totalDebtLatest = n(latest?.totalDebt) ?? 0;
  const cashLatest = n(latest?.cash) ?? 0;
  const netDebt = totalDebtLatest - cashLatest;

  if (revenueLatest === null) dataGaps.push(`Revenue missing for ${latest?.financialYear}`);
  if (fcfLatest === null) dataGaps.push(`Free Cash Flow missing for ${latest?.financialYear}`);
  if (networthLatest === null) dataGaps.push(`Networth missing for ${latest?.financialYear}`);

  // ── Step 2: Revenue CAGR ───────────────────────────────────────────────────
  let revenueCAGR: number | null = null;
  const revenueOldest = n(oldest?.revenue);
  if (
    yearsAnalysed >= 2 &&
    revenueLatest !== null &&
    revenueOldest !== null &&
    revenueOldest > 0 &&
    revenueLatest > 0
  ) {
    const years = yearsAnalysed - 1;
    revenueCAGR = Math.pow(revenueLatest / revenueOldest, 1 / years) - 1;
  } else if (yearsAnalysed < 2) {
    dataGaps.push("Fewer than 2 years of data — CAGR cannot be computed");
  }

  // ── Step 3: EBITDA Normalisation ──────────────────────────────────────────
  const ebitdaMargins = fys.map((f) => {
    const rev = n(f.revenue);
    const eb = n(f.ebitda);
    if (rev !== null && rev > 0 && eb !== null) return eb / rev;
    return null;
  });
  const ebitdaMarginAvg = avg(ebitdaMargins);

  let ebitdaNormalized: number | null = null;
  if (ebitdaMarginAvg !== null && revenueLatest !== null) {
    ebitdaNormalized = ebitdaMarginAvg * revenueLatest;
  } else if (ebitdaLatest !== null) {
    // Fallback: use single year EBITDA
    ebitdaNormalized = ebitdaLatest;
    dataGaps.push("EBITDA normalised using single year (no multi-year margin available)");
  }

  // ── Step 4: DCF Enterprise Value ──────────────────────────────────────────
  let dcfEV: number | null = null;
  if (fcfLatest !== null && fcfLatest > 0) {
    const wacc = multiples.wacc;
    // Terminal growth = min(CAGR × 0.5, 8%) — conservative
    const cagr = revenueCAGR ?? 0.08; // default 8% if CAGR unknown
    const g = Math.min(cagr * 0.5, 0.08);
    const growthStepDown = 0.85; // each year's FCF growth tapers (reversion to mean)

    let pvFCF = 0;
    let projectedFCF = fcfLatest;
    for (let t = 1; t <= 5; t++) {
      projectedFCF *= (1 + cagr * growthStepDown);
      pvFCF += projectedFCF / Math.pow(1 + wacc, t);
    }
    // Terminal value (Gordon growth model)
    const terminalFCF = projectedFCF * (1 + g);
    const terminalValue = terminalFCF / (wacc - g);
    const pvTerminal = terminalValue / Math.pow(1 + wacc, 5);

    dcfEV = pvFCF + pvTerminal;
  } else {
    dataGaps.push("DCF skipped — FCF is null or negative (pre-revenue or investing stage)");
  }

  // ── Step 5: Comparable Multiples EV ──────────────────────────────────────
  let comparablesEV: number | null = null;
  const evByMethod: number[] = [];

  if (ebitdaNormalized !== null && ebitdaNormalized > 0) {
    evByMethod.push(ebitdaNormalized * multiples.evEbitda);
  }
  if (patLatest !== null && patLatest > 0) {
    // EV ≈ Market Cap for no-debt cos; PAT × PE ≈ Mkt Cap, EV = Mkt Cap + Net Debt
    evByMethod.push(patLatest * multiples.pe + netDebt);
  }
  if (revenueLatest !== null && revenueLatest > 0) {
    evByMethod.push(revenueLatest * multiples.ps + netDebt);
  }

  if (evByMethod.length > 0) {
    // Median of available methods
    const sorted = [...evByMethod].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    comparablesEV =
      sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
  } else {
    dataGaps.push("Comparable multiples EV skipped — no revenue, EBITDA, or PAT data");
  }

  // ── Step 6: Book Value EV ─────────────────────────────────────────────────
  let bookValueEV: number | null = null;
  const roeValues = fys.map((f) => {
    const nw = n(f.networth);
    const pat = n(f.pat) ?? n(f.netProfit);
    if (nw !== null && nw > 0 && pat !== null) return pat / nw;
    return null;
  });
  const roeAvg = avg(roeValues);

  if (networthLatest !== null && networthLatest > 0) {
    const roeMult = roeAvg !== null ? 1 + roeAvg / multiples.pb : 1;
    bookValueEV = networthLatest * multiples.pb * roeMult + netDebt;
  } else {
    dataGaps.push("Book value EV skipped — networth data unavailable");
  }

  // ── Step 7: Blended EV ────────────────────────────────────────────────────
  // Weights: DCF 40%, Comparables 35%, Book Value 25%
  // If a method is unavailable, redistribute weights proportionally
  type Method = { value: number | null; weight: number };
  const methods: Method[] = [
    { value: dcfEV,          weight: 0.40 },
    { value: comparablesEV,  weight: 0.35 },
    { value: bookValueEV,    weight: 0.25 },
  ];

  const available = methods.filter((m) => m.value !== null);
  let blendedEV = 0;
  if (available.length === 0) {
    // Ultimate fallback: use current OTC market cap as EV proxy
    blendedEV = (input.currentOtcPricePerShare * input.totalSharesOutstanding) / 1e7; // convert to ₹ Cr
    dataGaps.push("No financial data available — blended EV defaults to OTC market cap");
  } else {
    const totalWeight = available.reduce((s, m) => s + m.weight, 0);
    for (const m of available) {
      blendedEV += (m.value as number) * (m.weight / totalWeight);
    }
  }

  // ── Step 8: Equity Value & Fair Share Price ───────────────────────────────
  const equityValue = blendedEV - netDebt;
  // Convert ₹ Cr to ₹, then divide by total shares
  const equityValueRs = equityValue * 1e7; // 1 Cr = 1e7 rupees
  const fairSharePrice =
    input.totalSharesOutstanding > 0
      ? equityValueRs / input.totalSharesOutstanding
      : 0;

  // Discount (negative) or premium (positive) of OTC vs fair value
  const discountToPremiumPct =
    fairSharePrice > 0
      ? ((input.currentOtcPricePerShare - fairSharePrice) / fairSharePrice) * 100
      : 0;

  // ── Confidence Score ──────────────────────────────────────────────────────
  // Start at 1.0, deduct for each data gap and each missing method
  let confidenceScore = 1.0;
  if (yearsAnalysed < 3) confidenceScore -= 0.20 * (3 - yearsAnalysed);
  if (dcfEV === null) confidenceScore -= 0.20;
  if (comparablesEV === null) confidenceScore -= 0.20;
  if (bookValueEV === null) confidenceScore -= 0.10;
  if (revenueCAGR === null) confidenceScore -= 0.10;
  confidenceScore = Math.max(0.05, Math.round(confidenceScore * 100) / 100);

  // ── Terminal growth rate (for transparency) ───────────────────────────────
  const terminalGrowthRate = Math.min((revenueCAGR ?? 0.08) * 0.5, 0.08);

  const SEBI_DISCLAIMER =
    "INDICATIVE ESTIMATE — NOT A SEBI-APPROVED VALUATION. Unlisted/pre-IPO " +
    "investments are highly illiquid and speculative. This estimate is for " +
    "informational purposes only and must not be construed as investment " +
    "advice or a guaranteed return. Consult a SEBI-registered investment " +
    "advisor before making any investment decision.";

  return {
    companyName: input.companyName,
    sector: input.sector ?? "Unknown",
    yearsAnalysed,
    financialYears,

    revenueCAGR:
      revenueCAGR !== null ? Math.round(revenueCAGR * 10000) / 100 : null, // % with 2dp
    ebitdaMarginAvg:
      ebitdaMarginAvg !== null ? Math.round(ebitdaMarginAvg * 10000) / 100 : null,
    ebitdaNormalized:
      ebitdaNormalized !== null ? Math.round(ebitdaNormalized * 100) / 100 : null,
    patLatest: patLatest !== null ? Math.round(patLatest * 100) / 100 : null,
    revenueLatest: revenueLatest !== null ? Math.round(revenueLatest * 100) / 100 : null,
    fcfLatest: fcfLatest !== null ? Math.round(fcfLatest * 100) / 100 : null,
    netDebt: Math.round(netDebt * 100) / 100,
    networthLatest: networthLatest !== null ? Math.round(networthLatest * 100) / 100 : null,
    sectorWacc: multiples.wacc,
    terminalGrowthRate: Math.round(terminalGrowthRate * 10000) / 100,

    dcfEV: dcfEV !== null ? Math.round(dcfEV * 100) / 100 : null,
    comparablesEV: comparablesEV !== null ? Math.round(comparablesEV * 100) / 100 : null,
    bookValueEV: bookValueEV !== null ? Math.round(bookValueEV * 100) / 100 : null,
    blendedEV: Math.round(blendedEV * 100) / 100,
    equityValue: Math.round(equityValue * 100) / 100,

    fairSharePrice: Math.round(fairSharePrice * 100) / 100,
    currentOtcPrice: input.currentOtcPricePerShare,
    discountToPremiumPct: Math.round(discountToPremiumPct * 100) / 100,

    confidenceScore,
    dataGaps,
    engineVersion: ENGINE_VERSION,
    calculationTimestamp: new Date().toISOString(),
    sebiDisclaimer: SEBI_DISCLAIMER,
  };
}
