/**
 * TDS Withholding Engine
 *
 * Calculates Tax Deducted at Source (TDS) for investment-related income under
 * the Income Tax Act, 1961.
 *
 * Covered sections:
 *   Section 193  — Interest on securities (bonds, debentures, G-Secs)
 *   Section 194  — Dividend (from Indian companies, post-Finance Act 2020)
 *   Section 194A — Interest other than on securities (bank FD, RD, savings)
 *   Section 194K — Income from MF units
 *   Section 195  — Non-resident withholding (DTAA/FEMA rates)
 *   Section 196D — FII/FPI — income from securities
 *
 * GCR Rules:
 *  - Same input → same output ALWAYS (deterministic, no randomness)
 *  - Every output includes engine_version + calculation_timestamp
 *  - Full explainability: section_reference, threshold, formula, steps
 *  - Errors: { error_code, message, retryable }
 *  - Structured log: { event, user_id?, latency_ms, status }
 *
 * FASP-AI:
 *  - TDS is a regulatory deduction, NOT tax liability advice.
 *  - This engine DOES NOT autonomously file or deduct — it only calculates.
 */

import { logger } from "../logger";

export const TDS_ENGINE_VERSION = "1.0.0-FA2024";

// ─────────────────────────────────────────────────────────────────────────────
// Resident Rate Specs (Section 193 / 194 / 194A / 194K)
// ─────────────────────────────────────────────────────────────────────────────

interface TdsRateSpec {
  rate: number;
  rateWithoutPan: number;
  thresholdPerFY: number;
  statuteSection: string;
  description: string;
  effectiveSince: string;
}

export const TDS_BOND_INTEREST: TdsRateSpec = {
  rate: 0.10, rateWithoutPan: 0.20, thresholdPerFY: 10_000,
  statuteSection: "Section 193 — Interest on Securities",
  description: "Interest on listed bonds, debentures, G-Secs. Threshold ₹10,000 p.a.",
  effectiveSince: "2013-06-01",
};

export const TDS_UNLISTED_DEBENTURE_INTEREST: TdsRateSpec = {
  rate: 0.10, rateWithoutPan: 0.20, thresholdPerFY: 5_000,
  statuteSection: "Section 193 — Interest on Securities (unlisted debentures)",
  description: "Interest on unlisted debentures. Lower threshold of ₹5,000 applies.",
  effectiveSince: "2013-06-01",
};

export const TDS_DIVIDEND: TdsRateSpec = {
  rate: 0.10, rateWithoutPan: 0.20, thresholdPerFY: 5_000,
  statuteSection: "Section 194 — Dividend",
  description: "Dividend from Indian companies. DDT abolished Finance Act 2020. TDS @ 10% if annual dividend > ₹5,000.",
  effectiveSince: "2020-04-01",
};

export const TDS_BANK_INTEREST: TdsRateSpec = {
  rate: 0.10, rateWithoutPan: 0.20, thresholdPerFY: 40_000,
  statuteSection: "Section 194A — Interest other than on securities",
  description: "Interest from bank FD/RD. Threshold ₹40,000 (₹50,000 for senior citizens ≥60 years).",
  effectiveSince: "2019-04-01",
};

export const TDS_MF_INCOME: TdsRateSpec = {
  rate: 0.10, rateWithoutPan: 0.20, thresholdPerFY: 5_000,
  statuteSection: "Section 194K — Income in respect of units of Mutual Fund",
  description: "TDS on dividend/income distributions from MF units (not capital gains on redemption).",
  effectiveSince: "2020-04-01",
};

// ─────────────────────────────────────────────────────────────────────────────
// NRI / Non-Resident Specs (Section 195 / 196D)
// ─────────────────────────────────────────────────────────────────────────────

export type NonResidentCategory =
  | "fpi_equity_dividend"
  | "fpi_bond_interest"
  | "nri_equity_ltcg"
  | "nri_equity_stcg"
  | "nri_bond_interest"
  | "nri_dividend"
  | "nri_mf_income"
  | "royalty_technical_fees";

interface NriRateSpec {
  rateWithoutDtaa: number;
  surchargeApplicable: boolean;
  educationCessApplicable: boolean;
  statuteSection: string;
  description: string;
}

export const NRI_TDS_RATES: Record<NonResidentCategory, NriRateSpec> = {
  fpi_equity_dividend:   { rateWithoutDtaa: 0.20, surchargeApplicable: true,  educationCessApplicable: true,  statuteSection: "Section 196D — Income of FIIs/FPIs from securities",              description: "FPI dividend income. Surcharge + cess on gross." },
  fpi_bond_interest:     { rateWithoutDtaa: 0.05, surchargeApplicable: false, educationCessApplicable: false, statuteSection: "Section 194LD — Interest on G-Secs/Rupee Bonds (FPI)",           description: "5% concessional rate for FPI on listed bonds/G-Secs." },
  nri_equity_ltcg:       { rateWithoutDtaa: 0.125,surchargeApplicable: true,  educationCessApplicable: true,  statuteSection: "Section 115E/112A — LTCG on listed equity (NRI)",                description: "12.5% LTCG — Budget 2024 (was 10%)." },
  nri_equity_stcg:       { rateWithoutDtaa: 0.20, surchargeApplicable: true,  educationCessApplicable: true,  statuteSection: "Section 111A — STCG on equity (NRI)",                           description: "20% STCG — Budget 2024 (was 15%)." },
  nri_bond_interest:     { rateWithoutDtaa: 0.20, surchargeApplicable: true,  educationCessApplicable: true,  statuteSection: "Section 115A — Interest income for NRIs",                       description: "20% without DTAA; treaties typically 10-15%." },
  nri_dividend:          { rateWithoutDtaa: 0.20, surchargeApplicable: true,  educationCessApplicable: true,  statuteSection: "Section 115A — Dividend for NRIs",                              description: "20% gross TDS without DTAA; treaties typically 15%." },
  nri_mf_income:         { rateWithoutDtaa: 0.20, surchargeApplicable: true,  educationCessApplicable: true,  statuteSection: "Section 115A — MF income for NRIs",                             description: "20% without DTAA." },
  royalty_technical_fees:{ rateWithoutDtaa: 0.20, surchargeApplicable: true,  educationCessApplicable: true,  statuteSection: "Section 115A — Royalties/Technical service fees (NRI)",         description: "20% without DTAA; most treaties 10-15%." },
};

/** DTAA interest rate table (most-favoured bilateral treaty rates) */
export const DTAA_INTEREST_RATES: Record<string, number> = {
  USA: 0.15, UK: 0.15, UAE: 0.12, SINGAPORE: 0.15, MAURITIUS: 0.075,
  NETHERLANDS: 0.10, GERMANY: 0.10, FRANCE: 0.10, JAPAN: 0.10,
  CANADA: 0.15, AUSTRALIA: 0.15, LUXEMBOURG: 0.10, IRELAND: 0.10, SWITZERLAND: 0.10,
};

/** DTAA dividend rate table */
export const DTAA_DIVIDEND_RATES: Record<string, number> = {
  USA: 0.15, UK: 0.15, UAE: 0.10, SINGAPORE: 0.10, MAURITIUS: 0.05,
  NETHERLANDS: 0.10, GERMANY: 0.10, FRANCE: 0.10, JAPAN: 0.10,
  CANADA: 0.15, AUSTRALIA: 0.15, LUXEMBOURG: 0.10, IRELAND: 0.10, SWITZERLAND: 0.10,
};

// ─────────────────────────────────────────────────────────────────────────────
// Output interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface TdsCalculationResult {
  grossAmount: number;
  tdsApplicable: boolean;
  tdsAmount: number;
  netAmount: number;
  rateApplied: number;
  panFurnished: boolean;
  engine_version: string;
  calculation_timestamp: string;
  explainability: {
    section_reference: string;
    description: string;
    threshold_per_fy: number;
    threshold_crossed: boolean;
    income_this_payment: number;
    cumulative_income_fy: number;
    rate_without_pan: number;
    formula: string;
    steps: string[];
  };
}

export interface NriTdsCalculationResult {
  grossAmount: number;
  dtaaApplied: boolean;
  dtaaCountry?: string;
  rateApplied: number;
  surchargeRate: number;
  cessRate: number;
  tdsAmount: number;
  netAmount: number;
  engine_version: string;
  calculation_timestamp: string;
  explainability: {
    category: NonResidentCategory;
    section_reference: string;
    gross_rate: number;
    surcharge_amount: number;
    cess_amount: number;
    formula: string;
    steps: string[];
    dtaa_note?: string;
    disclaimer: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resident TDS Calculator
// ─────────────────────────────────────────────────────────────────────────────

export type ResidentTdsType =
  | "bond_interest_listed"
  | "bond_interest_unlisted"
  | "dividend"
  | "bank_interest"
  | "bank_interest_senior_citizen"
  | "mf_income";

const RESIDENT_RATE_MAP: Record<ResidentTdsType, TdsRateSpec> = {
  bond_interest_listed:          TDS_BOND_INTEREST,
  bond_interest_unlisted:        TDS_UNLISTED_DEBENTURE_INTEREST,
  dividend:                      TDS_DIVIDEND,
  bank_interest:                 TDS_BANK_INTEREST,
  bank_interest_senior_citizen:  { ...TDS_BANK_INTEREST, thresholdPerFY: 50_000 },
  mf_income:                     TDS_MF_INCOME,
};

/**
 * Calculate TDS for resident Indians on investment income.
 *
 * @param incomeType - Income category (bond_interest_listed | dividend | bank_interest | ...)
 * @param paymentAmount - Gross amount for THIS payment (₹)
 * @param cumulativeFyIncome - Running total from same deductor this FY including this payment (₹)
 * @param panFurnished - Whether valid PAN furnished (default: true)
 * @param userId - Optional for structured logging
 */
export function calculateResidentTds(
  incomeType: ResidentTdsType,
  paymentAmount: number,
  cumulativeFyIncome: number,
  panFurnished = true,
  userId?: string,
): TdsCalculationResult {
  const startTs = Date.now();
  const calculationTimestamp = new Date().toISOString();

  if (paymentAmount < 0) throw Object.assign(new Error("paymentAmount must be >= 0"), { error_code: "INVALID_AMOUNT", retryable: false });

  const spec = RESIDENT_RATE_MAP[incomeType];
  const effectiveRate    = panFurnished ? spec.rate : spec.rateWithoutPan;
  const thresholdCrossed = cumulativeFyIncome > spec.thresholdPerFY;
  const tdsApplicable    = thresholdCrossed;
  const tdsAmount        = tdsApplicable ? Math.round(paymentAmount * effectiveRate * 100) / 100 : 0;
  const netAmount        = paymentAmount - tdsAmount;

  const steps = [
    `Income type: ${incomeType} | ${spec.statuteSection}`,
    `Threshold/FY: ₹${spec.thresholdPerFY.toLocaleString("en-IN")} | Cumulative: ₹${cumulativeFyIncome.toLocaleString("en-IN")}`,
    `Threshold crossed: ${thresholdCrossed ? "YES" : "NO"}`,
    tdsApplicable
      ? `TDS = ₹${paymentAmount} × ${(effectiveRate * 100).toFixed(2)}% = ₹${tdsAmount}`
      : `TDS = ₹0 (cumulative ≤ threshold)`,
    `Net payment = ₹${netAmount.toLocaleString("en-IN")}`,
  ];

  const result: TdsCalculationResult = {
    grossAmount: paymentAmount, tdsApplicable, tdsAmount, netAmount,
    rateApplied: tdsApplicable ? effectiveRate : 0, panFurnished,
    engine_version: TDS_ENGINE_VERSION, calculation_timestamp: calculationTimestamp,
    explainability: {
      section_reference: spec.statuteSection, description: spec.description,
      threshold_per_fy: spec.thresholdPerFY, threshold_crossed: thresholdCrossed,
      income_this_payment: paymentAmount, cumulative_income_fy: cumulativeFyIncome,
      rate_without_pan: spec.rateWithoutPan,
      formula: `paymentAmount × ${(effectiveRate * 100).toFixed(2)}%, if cumulative FY income > ₹${spec.thresholdPerFY}`,
      steps,
    },
  };

  logger.info("TDS_RESIDENT_CALCULATION", {
    event: "TDS_RESIDENT_CALCULATION", ...(userId ? { user_id: userId } : {}),
    income_type: incomeType, payment_amount: paymentAmount, cumulative_fy: cumulativeFyIncome,
    tds_applicable: tdsApplicable, tds_amount: tdsAmount,
    engine_version: TDS_ENGINE_VERSION, latency_ms: Date.now() - startTs, status: "success",
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// NRI / Non-Resident TDS Calculator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate TDS for NRI/non-residents under Section 195 / 196D.
 * Applies surcharge + 4% cess for applicable categories.
 * Uses DTAA rate if available and beneficial.
 *
 * @param category - NRI income category
 * @param grossAmount - Gross payment in ₹
 * @param dtaaCountry - Country name (e.g. "USA", "Mauritius") — undefined = no treaty
 * @param grossIncome - Annual gross income for surcharge slab (₹)
 * @param userId - Optional for logging
 */
export function calculateNriTds(
  category: NonResidentCategory,
  grossAmount: number,
  dtaaCountry?: string,
  grossIncome = 0,
  userId?: string,
): NriTdsCalculationResult {
  const startTs = Date.now();
  const calculationTimestamp = new Date().toISOString();

  if (grossAmount < 0) throw Object.assign(new Error("grossAmount must be >= 0"), { error_code: "INVALID_AMOUNT", retryable: false });

  const spec = NRI_TDS_RATES[category];
  let baseRate = spec.rateWithoutDtaa;
  let dtaaApplied = false;
  let dtaaNote: string | undefined;

  if (dtaaCountry) {
    const key = dtaaCountry.toUpperCase();
    const isDividend = category.includes("dividend");
    const treatyRate = isDividend ? DTAA_DIVIDEND_RATES[key] : DTAA_INTEREST_RATES[key];
    if (treatyRate !== undefined && treatyRate < baseRate) {
      baseRate = treatyRate;
      dtaaApplied = true;
      dtaaNote = `DTAA India-${dtaaCountry}: treaty rate ${(treatyRate * 100).toFixed(1)}% (domestic ${(spec.rateWithoutDtaa * 100).toFixed(0)}%)`;
    } else {
      dtaaNote = treatyRate === undefined
        ? `No DTAA entry for "${dtaaCountry}" — domestic rate applied`
        : `DTAA rate ${(treatyRate * 100).toFixed(1)}% not lower than domestic — domestic rate applied`;
    }
  }

  const surchargeRate = spec.surchargeApplicable
    ? grossIncome > 10_000_000 ? 0.15 : grossIncome > 5_000_000 ? 0.10 : 0
    : 0;
  const cessRate = spec.educationCessApplicable ? 0.04 : 0;

  const baseTax      = grossAmount * baseRate;
  const surchargeAmt = baseTax * surchargeRate;
  const cessAmt      = (baseTax + surchargeAmt) * cessRate;
  const tdsAmount    = Math.round((baseTax + surchargeAmt + cessAmt) * 100) / 100;
  const netAmount    = grossAmount - tdsAmount;

  const steps = [
    `Category: ${category} | ${spec.statuteSection}`,
    `Gross: ₹${grossAmount.toLocaleString("en-IN")}`,
    ...(dtaaNote ? [`DTAA: ${dtaaNote}`] : []),
    `Base TDS = ₹${grossAmount} × ${(baseRate * 100).toFixed(2)}% = ₹${baseTax.toFixed(2)}`,
    surchargeRate > 0 ? `Surcharge = ₹${baseTax.toFixed(2)} × ${surchargeRate * 100}% = ₹${surchargeAmt.toFixed(2)}` : "Surcharge: ₹0",
    cessRate > 0 ? `Cess = (₹${baseTax.toFixed(2)} + ₹${surchargeAmt.toFixed(2)}) × 4% = ₹${cessAmt.toFixed(2)}` : "Cess: ₹0",
    `Total TDS = ₹${tdsAmount} | Net = ₹${netAmount.toFixed(2)}`,
  ];

  const result: NriTdsCalculationResult = {
    grossAmount, dtaaApplied, ...(dtaaCountry ? { dtaaCountry } : {}),
    rateApplied: baseRate, surchargeRate, cessRate, tdsAmount, netAmount,
    engine_version: TDS_ENGINE_VERSION, calculation_timestamp: calculationTimestamp,
    explainability: {
      category, section_reference: spec.statuteSection, gross_rate: baseRate,
      surcharge_amount: Math.round(surchargeAmt * 100) / 100,
      cess_amount: Math.round(cessAmt * 100) / 100,
      formula: "grossAmount × baseRate + surcharge(baseRate%) + cess(4%)",
      steps, ...(dtaaNote ? { dtaa_note: dtaaNote } : {}),
      disclaimer: "TDS computation is indicative. DTAA benefit requires Tax Residency Certificate (TRC). Consult a CA for FEMA/RBI compliance.",
    },
  };

  logger.info("TDS_NRI_CALCULATION", {
    event: "TDS_NRI_CALCULATION", ...(userId ? { user_id: userId } : {}),
    category, gross_amount: grossAmount, dtaa_applied: dtaaApplied,
    tds_amount: tdsAmount, engine_version: TDS_ENGINE_VERSION,
    latency_ms: Date.now() - startTs, status: "success",
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-test (health check integration)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates 6 key TDS scenarios. Throws on any rate mismatch.
 */
export function tdsEngineSelfTest(): { pass: true; engine_version: string; scenarios_tested: number } {
  const cases: Array<{ label: string; run: () => number; expected: number }> = [
    // 1. Bond interest listed: cumulative ₹10,500 > ₹10,000 → 10% of ₹3,500 = ₹350
    { label: "Bond interest listed: threshold crossed → 10%", run: () => calculateResidentTds("bond_interest_listed", 3500, 10500, true).tdsAmount, expected: 350 },
    // 2. Dividend ₹4,000 < ₹5,000 → TDS = 0
    { label: "Dividend below threshold → no TDS", run: () => calculateResidentTds("dividend", 4000, 4000, true).tdsAmount, expected: 0 },
    // 3. Dividend ₹10,000 cumulative > ₹5,000 → 10% = ₹1,000
    { label: "Dividend above threshold → 10%", run: () => calculateResidentTds("dividend", 10000, 10000, true).tdsAmount, expected: 1000 },
    // 4. No PAN: bond interest ₹10,000, cumulative ₹20,000 → 20% = ₹2,000
    { label: "No PAN → 20% rate", run: () => calculateResidentTds("bond_interest_listed", 10000, 20000, false).tdsAmount, expected: 2000 },
    // 5. FPI dividend Mauritius DTAA 5%, income < ₹50L → 5% flat, no surcharge/cess (fpi_equity_dividend has cess)
    //    ₹1,00,000 × 5% × 1.04 (cess) = ₹5,200
    { label: "FPI dividend Mauritius DTAA 5% + 4% cess", run: () => calculateNriTds("fpi_equity_dividend", 100000, "Mauritius", 4000000).tdsAmount, expected: 5200 },
    // 6. NRI bond interest: no DTAA → 20% + 4% cess (income < 50L, no surcharge)
    //    ₹1,00,000 × 20% = ₹20,000; cess = ₹800; total = ₹20,800
    { label: "NRI bond interest: no DTAA, no surcharge → 20% + 4% cess", run: () => calculateNriTds("nri_bond_interest", 100000, undefined, 3000000).tdsAmount, expected: 20800 },
  ];

  for (const tc of cases) {
    const got = tc.run();
    if (Math.abs(got - tc.expected) > 0.01) {
      throw new Error(`TDS self-test FAILED [${tc.label}]: expected ₹${tc.expected}, got ₹${got}. Engine: ${TDS_ENGINE_VERSION}`);
    }
  }
  return { pass: true, engine_version: TDS_ENGINE_VERSION, scenarios_tested: cases.length };
}
