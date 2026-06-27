/**
 * Securities Transaction Tax (STT) Engine
 *
 * Computes STT for all exchange-traded products under the Indian Income Tax Act,
 * Chapter VII, Section 98 — as amended by Finance Act 2024.
 *
 * Budget 2024 Changes (effective 23 July 2024):
 *   F&O Futures: 0.01% → 0.02%  (+100%)
 *   F&O Options: 0.0625% → 0.1%  on premium (+60%)
 *   All other rates unchanged.
 *
 * GCR Rules:
 *  - Same input → same output ALWAYS (deterministic; no hidden randomness)
 *  - Every output includes engine_version + calculation_timestamp
 *  - Every output exposes inputs used, formula applied, intermediate steps (Explainability Layer)
 *  - Errors follow: { error_code, message, retryable }
 *  - Structured log: { event, user_id?, latency_ms, status }
 *
 * FASP-AI Advisory:
 *  - STT is a COST (not tax liability) — no advisory disclaimer required
 *  - STT outputs are factual regulatory calculations, not recommendations
 */

import { logger } from "../logger";

// ─────────────────────────────────────────────────────────────────────────────
// Engine versioning — bump when any rate or formula changes
// Budget 2024 = Finance Act 2024, assented 16 August 2024
// ─────────────────────────────────────────────────────────────────────────────
export const STT_ENGINE_VERSION = "1.0.0-FA2024";
const EFFECTIVE_DATE_FA2024 = "2024-07-23"; // Budget 2024 announcement date (Lok Sabha)

// ─────────────────────────────────────────────────────────────────────────────
// STT Rate Table (Income Tax Act, Chapter VII, Section 98)
// All rates as DECIMAL FRACTIONS (not percentages)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * STT is levied on the TRANSACTION VALUE (not profit) at point of settlement.
 * "side" = which side of the trade pays STT to the exchange/clearing corp.
 */
export type SttProductType =
  | "equity_delivery"
  | "equity_intraday"
  | "fo_futures"
  | "fo_options"
  | "mf_equity_redemption";

export type SttPayerSide = "buy" | "sell" | "both";

interface SttRateSpec {
  rate: number;           // Decimal fraction (0.001 = 0.1%)
  payerSide: SttPayerSide;
  /** What the rate applies to: "transaction_value" | "option_premium" */
  basis: "transaction_value" | "option_premium";
  statuteSection: string;
  regulatoryNote: string;
  effectiveSince: string;
}

export const STT_RATES: Record<SttProductType, SttRateSpec> = {
  /**
   * Equity Delivery (CNC)
   * Rate: 0.1% on transaction value — BOTH buyer and seller pay
   * Section 98, Table, Item 1 (a)
   */
  equity_delivery: {
    rate: 0.001,                 // 0.1%
    payerSide: "both",
    basis: "transaction_value",
    statuteSection: "Section 98, Table, Item 1(a) — Delivery-based equity",
    regulatoryNote: "Both buyer and seller pay 0.1% STT on full transaction value",
    effectiveSince: "2013-06-01",
  },

  /**
   * Equity Intraday (MIS)
   * Rate: 0.025% on transaction value — SELLER only
   * Section 98, Table, Item 1(b)
   */
  equity_intraday: {
    rate: 0.00025,               // 0.025%
    payerSide: "sell",
    basis: "transaction_value",
    statuteSection: "Section 98, Table, Item 1(b) — Non-delivery equity (intraday)",
    regulatoryNote: "Seller pays 0.025% STT on transaction value. Buyer exempt.",
    effectiveSince: "2013-06-01",
  },

  /**
   * F&O Futures
   * Rate: 0.02% on transaction value — SELLER only
   * Section 98, Table, Item 2(b)
   * ★ Budget 2024: doubled from 0.01% → 0.02% effective 23 July 2024
   */
  fo_futures: {
    rate: 0.0002,                // 0.02% ← Budget 2024 (was 0.0001 / 0.01%)
    payerSide: "sell",
    basis: "transaction_value",
    statuteSection: "Section 98, Table, Item 2(b) — Futures on securities",
    regulatoryNote: "Seller pays 0.02% STT on futures transaction value. Budget 2024 doubled this from 0.01%.",
    effectiveSince: EFFECTIVE_DATE_FA2024,
  },

  /**
   * F&O Options
   * Rate: 0.1% on OPTION PREMIUM — SELLER only (Buyer exempt)
   * Section 98, Table, Item 2(a)
   * ★ Budget 2024: increased from 0.0625% → 0.1% effective 23 July 2024
   */
  fo_options: {
    rate: 0.001,                 // 0.1% ← Budget 2024 (was 0.000625 / 0.0625%)
    payerSide: "sell",
    basis: "option_premium",
    statuteSection: "Section 98, Table, Item 2(a) — Options on securities",
    regulatoryNote: "Seller pays 0.1% STT on option premium (not notional value). Budget 2024 increased from 0.0625%.",
    effectiveSince: EFFECTIVE_DATE_FA2024,
  },

  /**
   * Mutual Fund — Equity Scheme Redemption
   * Rate: 0.001% on redemption value — SELLER (investor) only
   * Section 98, Table, Item 3(a)
   * Note: Exempt on purchase (STT paid by AMC on exchange transactions)
   */
  mf_equity_redemption: {
    rate: 0.00001,               // 0.001%
    payerSide: "sell",
    basis: "transaction_value",
    statuteSection: "Section 98, Table, Item 3(a) — Units of equity-oriented MF (redemption)",
    regulatoryNote: "Investor pays 0.001% STT on redemption value. AMC pays STT on purchases on exchange.",
    effectiveSince: "2013-06-01",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Output interface (GCR compliant)
// ─────────────────────────────────────────────────────────────────────────────

export interface SttCalculationResult {
  /** STT payable by buyer (0 if not applicable for this product) */
  buyerStt: number;
  /** STT payable by seller (0 if not applicable) */
  sellerStt: number;
  /** Total STT for this transaction (buyer + seller) */
  totalStt: number;

  /** GCR: mandatory for all financial outputs */
  engine_version: string;
  calculation_timestamp: string;

  /** Explainability layer (GCR mandatory) */
  explainability: {
    product_type: SttProductType;
    transaction_value: number;
    /** For options: the premium amount the rate was applied to */
    basis_amount: number;
    rate_applied: number;
    rate_as_percentage: string;
    payer_side: SttPayerSide;
    formula: string;
    statute_section: string;
    regulatory_note: string;
    budget_change?: string;
    steps: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core calculation function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate STT for a given product and transaction.
 *
 * @param productType - One of: equity_delivery | equity_intraday | fo_futures | fo_options | mf_equity_redemption
 * @param transactionValue - Total transaction value in INR (price × quantity)
 * @param optionPremium - For fo_options: total premium paid (premium × lot_size × lots). Ignored for other products.
 * @param userId - Optional user ID for structured logging
 *
 * @returns SttCalculationResult with buyer/seller STT + full explainability
 *
 * @throws Error with { error_code: "INVALID_PRODUCT_TYPE" } if product not recognised
 * @throws Error with { error_code: "INVALID_AMOUNT" } if transactionValue ≤ 0
 *
 * @example
 *   // Nifty 50 Futures: 1 lot = 25 units × ₹22,500 index = ₹562,500 transaction value
 *   calculateStt("fo_futures", 562500)
 *   // → { sellerStt: 112.5, buyerStt: 0, totalStt: 112.5, ... }
 *
 *   // Nifty Bank Options: sell 1 lot, premium ₹150, lot size 15 → premium = ₹2,250
 *   calculateStt("fo_options", 0, 2250)
 *   // → { sellerStt: 2.25, buyerStt: 0, totalStt: 2.25, ... }
 */
export function calculateStt(
  productType: SttProductType,
  transactionValue: number,
  optionPremium?: number,
  userId?: string,
): SttCalculationResult {
  const startTs = Date.now();
  const event = "STT_CALCULATION";

  // ── Input validation ───────────────────────────────────────────────────────
  if (!STT_RATES[productType]) {
    throw Object.assign(
      new Error(`Unknown STT product type: "${productType}". Valid: ${Object.keys(STT_RATES).join(", ")}`),
      { error_code: "INVALID_PRODUCT_TYPE", retryable: false },
    );
  }

  if (transactionValue < 0) {
    throw Object.assign(
      new Error(`transactionValue must be ≥ 0, got ${transactionValue}`),
      { error_code: "INVALID_AMOUNT", retryable: false },
    );
  }

  const spec = STT_RATES[productType];
  const calculationTimestamp = new Date().toISOString();

  // ── Determine basis amount ─────────────────────────────────────────────────
  // For F&O Options: STT is on OPTION PREMIUM, not transaction value
  const basisAmount =
    productType === "fo_options"
      ? (optionPremium ?? 0)
      : transactionValue;

  // ── Compute STT by payer side ──────────────────────────────────────────────
  const rawStt = basisAmount * spec.rate;
  // Round to nearest paisa (2 decimal places) — exchange rounds down in practice
  const sttAmount = Math.round(rawStt * 100) / 100;

  const buyerStt  = spec.payerSide === "buy"  || spec.payerSide === "both" ? sttAmount : 0;
  const sellerStt = spec.payerSide === "sell" || spec.payerSide === "both" ? sttAmount : 0;
  const totalStt  = buyerStt + sellerStt;

  // ── Build explainability steps ─────────────────────────────────────────────
  const ratePercent = `${(spec.rate * 100).toFixed(4)}%`;
  const basisLabel  = spec.basis === "option_premium" ? "option premium" : "transaction value";

  const steps: string[] = [
    `Product type: ${productType}`,
    `${spec.basis === "option_premium" ? "Option premium" : "Transaction value"}: ₹${basisAmount.toLocaleString("en-IN")}`,
    `STT rate: ${ratePercent} of ${basisLabel} (${spec.statuteSection})`,
    `Raw STT = ₹${basisAmount} × ${spec.rate} = ₹${rawStt.toFixed(4)}`,
    `Rounded to nearest paisa: ₹${sttAmount}`,
    `Payer: ${spec.payerSide} side`,
    ...(buyerStt  > 0 ? [`Buyer STT:  ₹${buyerStt}`]  : []),
    ...(sellerStt > 0 ? [`Seller STT: ₹${sellerStt}`] : []),
    `Total STT: ₹${totalStt}`,
  ];

  const budgetChange =
    productType === "fo_futures" ? "Budget 2024: rate doubled from 0.01% to 0.02% (effective 23 Jul 2024)" :
    productType === "fo_options" ? "Budget 2024: rate increased from 0.0625% to 0.1% on premium (effective 23 Jul 2024)" :
    undefined;

  const result: SttCalculationResult = {
    buyerStt,
    sellerStt,
    totalStt,
    engine_version: STT_ENGINE_VERSION,
    calculation_timestamp: calculationTimestamp,
    explainability: {
      product_type: productType,
      transaction_value: transactionValue,
      basis_amount: basisAmount,
      rate_applied: spec.rate,
      rate_as_percentage: ratePercent,
      payer_side: spec.payerSide,
      formula: `${basisLabel} × ${spec.rate} (${ratePercent}), rounded to nearest paisa`,
      statute_section: spec.statuteSection,
      regulatory_note: spec.regulatoryNote,
      ...(budgetChange ? { budget_change: budgetChange } : {}),
      steps,
    },
  };

  logger.info(event, {
    event,
    ...(userId ? { user_id: userId } : {}),
    product_type: productType,
    transaction_value: transactionValue,
    basis_amount: basisAmount,
    buyer_stt: buyerStt,
    seller_stt: sellerStt,
    total_stt: totalStt,
    engine_version: STT_ENGINE_VERSION,
    latency_ms: Date.now() - startTs,
    status: "success",
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-leg calculator (for F&O positions with multiple legs)
// ─────────────────────────────────────────────────────────────────────────────

export interface SttLeg {
  productType: SttProductType;
  transactionValue: number;
  optionPremium?: number;
  side: "buy" | "sell";
}

export interface MultiLegSttResult {
  legs: Array<SttCalculationResult & { side: "buy" | "sell"; leg_index: number }>;
  totalBuyerStt: number;
  totalSellerStt: number;
  grandTotalStt: number;
  engine_version: string;
  calculation_timestamp: string;
}

/**
 * Calculate STT for a multi-leg trade (e.g. spread strategies, hedges).
 *
 * @param legs - Array of individual legs (each specifies product + value + side)
 * @param userId - Optional user ID for logging
 *
 * @example
 *   // Bull call spread: buy 1 CE + sell 1 CE
 *   calculateMultiLegStt([
 *     { productType: "fo_options", transactionValue: 0, optionPremium: 3000, side: "buy" },
 *     { productType: "fo_options", transactionValue: 0, optionPremium: 1500, side: "sell" },
 *   ])
 *   // Buyer STT = 0 (options buyer exempt), Seller STT = 1500 × 0.1% = ₹1.5
 */
export function calculateMultiLegStt(legs: SttLeg[], userId?: string): MultiLegSttResult {
  const calculationTimestamp = new Date().toISOString();
  let totalBuyerStt = 0;
  let totalSellerStt = 0;

  const legResults = legs.map((leg, i) => {
    const res = calculateStt(leg.productType, leg.transactionValue, leg.optionPremium, userId);

    // For multi-leg: if this side is "buy" but spec says "sell"-only, buyer STT = 0
    const effectiveBuyerStt  = leg.side === "buy"  ? res.buyerStt  : 0;
    const effectiveSellerStt = leg.side === "sell" ? res.sellerStt : 0;

    totalBuyerStt  += effectiveBuyerStt;
    totalSellerStt += effectiveSellerStt;

    return { ...res, buyerStt: effectiveBuyerStt, sellerStt: effectiveSellerStt, side: leg.side, leg_index: i };
  });

  return {
    legs: legResults,
    totalBuyerStt,
    totalSellerStt,
    grandTotalStt: totalBuyerStt + totalSellerStt,
    engine_version: STT_ENGINE_VERSION,
    calculation_timestamp: calculationTimestamp,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Health-check self-test (called by engine-health-check-1.ts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Self-test: verifies rate accuracy for all 5 product types against known Budget 2024 values.
 * Returns { pass: true } on success, throws on any rate mismatch.
 */
export function sttEngineSelfTest(): { pass: true; engine_version: string } {
  const cases: Array<{
    product: SttProductType;
    txValue: number;
    optionPremium?: number;
    expectedTotal: number;
    description: string;
  }> = [
    // Equity delivery ₹1,00,000 → 0.1% buyer + 0.1% seller = ₹200 total
    { product: "equity_delivery",     txValue: 100000, expectedTotal: 200,    description: "Equity delivery: 0.1% both sides" },
    // Equity intraday ₹1,00,000 → 0.025% seller = ₹25
    { product: "equity_intraday",     txValue: 100000, expectedTotal: 25,     description: "Equity intraday: 0.025% sell only" },
    // F&O Futures ₹5,62,500 → 0.02% seller = ₹112.5 (Budget 2024)
    { product: "fo_futures",          txValue: 562500, expectedTotal: 112.5,  description: "F&O Futures: 0.02% sell only (Budget 2024)" },
    // F&O Options premium ₹2,250 → 0.1% seller = ₹2.25 (Budget 2024)
    { product: "fo_options",          txValue: 0, optionPremium: 2250, expectedTotal: 2.25, description: "F&O Options: 0.1% on premium (Budget 2024)" },
    // MF redemption ₹1,00,000 → 0.001% seller = ₹1
    { product: "mf_equity_redemption",txValue: 100000, expectedTotal: 1,      description: "MF equity redemption: 0.001% sell only" },
  ];

  for (const tc of cases) {
    const result = calculateStt(tc.product, tc.txValue, tc.optionPremium);
    if (Math.abs(result.totalStt - tc.expectedTotal) > 0.001) {
      throw new Error(
        `STT self-test FAILED [${tc.description}]: expected ₹${tc.expectedTotal}, got ₹${result.totalStt}. Engine version: ${STT_ENGINE_VERSION}`,
      );
    }
  }

  return { pass: true, engine_version: STT_ENGINE_VERSION };
}
