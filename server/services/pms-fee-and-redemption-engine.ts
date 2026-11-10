/**
 * @file pms-fee-and-redemption-engine.ts
 * @description SEBI-Compliant PMS Multi-Option Fee Structure, High Water Mark (HWM)
 *              Crystallization, and Redemption Exit Load Engine for FintekPro.
 *
 * Implements:
 * 1. The 4 Regulatory Fee Options:
 *    - FIXED_ONLY: 2.00% p.a. Fixed, 0% Performance Fee.
 *    - HYBRID_BALANCED: 1.00% p.a. Fixed, 10% Hurdle, 15% Carry with HWM.
 *    - PURE_PERFORMANCE: 0.00% Fixed, 8% Hurdle, 20% Carry with HWM.
 *    - ADVISORY_UPSTOX_DIRECT: 0.50% p.a. Advisory, ₹20/trade, 0 bps Custody.
 *
 * 2. High Water Mark (HWM) Performance Fee Crystallization:
 *    - Strict compliance with SEBI (Portfolio Managers) Regulations, 2020.
 *    - Performance fee only charged if Current NAV > Max(HWM, Hurdle Target).
 *    - Updates HWM to new peak upon fee crystallization.
 *
 * 3. Redemption & Exit Load Calculation:
 *    - Residual Portfolio Value Check: Post-withdrawal value must be >= ₹50,00,000 for partial redemptions.
 *    - SEBI Exit Load Caps: Year 1: 2.5%, Year 2: 1.5%, Year 3: 1.0%, Year 4+: 0.0%.
 *    - Cash Settlement vs In-Specie Demat Transfer support.
 *
 * 4. Pass-through Statutory & Transaction Cost Computation (STT, GST, Brokerage, Custody).
 *
 * @engineVersion SEBI-PMS-FEE-v1.0
 * @compliance GCR v1.0 / FASP-AI v3.1
 */

import { logger } from "../logger";

export type PmsFeeOptionId =
  | "FIXED_ONLY"
  | "HYBRID_BALANCED"
  | "PURE_PERFORMANCE"
  | "ADVISORY_UPSTOX_DIRECT";

export interface PmsFeeOptionProfile {
  id: PmsFeeOptionId;
  name: string;
  tagline: string;
  targetInvestor: string;
  fixedManagementFeePct: number; // Annual %
  fixedFeeBillingFrequency: "QUARTERLY_IN_ARREARS" | "MONTHLY" | "NEVER";
  hurdleRatePct: number; // Annual % (0 if N/A)
  hurdleType: "ABSOLUTE_ANNUAL" | "BENCHMARK_TRI" | "NONE";
  performanceFeePct: number; // % of excess returns
  highWaterMarkMandatory: boolean;
  performanceBillingFrequency: "ANNUAL_CRYSTALLIZATION" | "NEVER";
  custodyModel: "UPSTOX_DIRECT_0_BPS" | "ORBIS_INSTITUTIONAL_4_BPS";
  brokerageModel: "FLAT_20_INR" | "INSTITUTIONAL_CP";
  statutoryDisclosures: string[];
}

export const PMS_FEE_OPTIONS: Record<PmsFeeOptionId, PmsFeeOptionProfile> = {
  FIXED_ONLY: {
    id: "FIXED_ONLY",
    name: "Option 1: Fixed Management Fee Only",
    tagline: "Predictable, transparent cost with zero profit-sharing",
    targetInvestor: "Conservative HNIs who prefer stable, predictable fee deductions regardless of market upside.",
    fixedManagementFeePct: 2.0,
    fixedFeeBillingFrequency: "QUARTERLY_IN_ARREARS",
    hurdleRatePct: 0,
    hurdleType: "NONE",
    performanceFeePct: 0,
    highWaterMarkMandatory: false,
    performanceBillingFrequency: "NEVER",
    custodyModel: "UPSTOX_DIRECT_0_BPS",
    brokerageModel: "FLAT_20_INR",
    statutoryDisclosures: [
      "Fixed fee of 2.0% p.a. is calculated on daily average portfolio value and billed quarterly in arrears.",
      "Zero performance fee or carried interest will be charged on profits.",
      "Statutory transaction charges, STT, GST (18%), and stamp duty apply at actuals.",
    ],
  },

  HYBRID_BALANCED: {
    id: "HYBRID_BALANCED",
    name: "Option 2: Hybrid Balanced Model (Most Popular)",
    tagline: "Low fixed management fee with performance alignment",
    targetInvestor: "Balanced investors seeking lower fixed cash drag with manager skin-in-the-game.",
    fixedManagementFeePct: 1.0,
    fixedFeeBillingFrequency: "QUARTERLY_IN_ARREARS",
    hurdleRatePct: 10.0,
    hurdleType: "ABSOLUTE_ANNUAL",
    performanceFeePct: 15.0,
    highWaterMarkMandatory: true,
    performanceBillingFrequency: "ANNUAL_CRYSTALLIZATION",
    custodyModel: "ORBIS_INSTITUTIONAL_4_BPS",
    brokerageModel: "FLAT_20_INR",
    statutoryDisclosures: [
      "Fixed fee of 1.0% p.a. billed quarterly in arrears.",
      "Performance fee of 15% applies only on net gains generated above the 10% annualized hurdle rate.",
      "High Water Mark (HWM) principle strictly enforced: Past drawdowns must be 100% recovered before performance fees apply.",
    ],
  },

  PURE_PERFORMANCE: {
    id: "PURE_PERFORMANCE",
    name: "Option 3: Pure Performance / Zero Fixed Fee",
    tagline: "Zero fixed management fees — pay only if we generate alpha",
    targetInvestor: "Aggressive investors who demand absolute alignment: the manager earns only when the client earns.",
    fixedManagementFeePct: 0.0,
    fixedFeeBillingFrequency: "NEVER",
    hurdleRatePct: 8.0,
    hurdleType: "ABSOLUTE_ANNUAL",
    performanceFeePct: 20.0,
    highWaterMarkMandatory: true,
    performanceBillingFrequency: "ANNUAL_CRYSTALLIZATION",
    custodyModel: "ORBIS_INSTITUTIONAL_4_BPS",
    brokerageModel: "FLAT_20_INR",
    statutoryDisclosures: [
      "Zero fixed management fee. No management fee is debited during market downturns or stagnant periods.",
      "Performance fee of 20% applies on returns exceeding the 8% annualized hurdle rate.",
      "High Water Mark strictly applied. No performance fee without surpassing historical peak portfolio NAV.",
    ],
  },

  ADVISORY_UPSTOX_DIRECT: {
    id: "ADVISORY_UPSTOX_DIRECT",
    name: "Option 4: Upstox Direct Segregated Demat Model",
    tagline: "2.0% p.a. management fee with zero custody drag & flat ₹20 execution",
    targetInvestor: "Investors seeking full portfolio management with securities resting directly in their own Upstox CDSL Demat.",
    fixedManagementFeePct: 2.0,
    fixedFeeBillingFrequency: "QUARTERLY_IN_ARREARS",
    hurdleRatePct: 0,
    hurdleType: "NONE",
    performanceFeePct: 0,
    highWaterMarkMandatory: false,
    performanceBillingFrequency: "NEVER",
    custodyModel: "UPSTOX_DIRECT_0_BPS",
    brokerageModel: "FLAT_20_INR",
    statutoryDisclosures: [
      "Fixed management fee of 2.0% p.a. calculated on daily average portfolio value and billed quarterly in arrears.",
      "Securities held directly in investor's individual CDSL Demat at Upstox with 0 bps custody fees.",
      "All trades executed at flat ₹20 per order via Upstox API v2.",
      "Zero performance fee or carried interest.",
    ],
  },
};

export interface HwmCalculationInput {
  startingNav: number;
  currentNav: number;
  highWaterMarkNav: number;
  hurdleRatePct: number;
  performanceFeePct: number;
  holdingPeriodDays: number;
  portfolioAmount: number;
}

export interface HwmCalculationResult {
  engineVersion: string;
  calculationTimestamp: string;
  isEligibleForPerformanceFee: boolean;
  hwmExceeded: boolean;
  hurdleExceeded: boolean;
  grossReturnPct: number;
  hurdleBenchmarkNav: number;
  effectiveThresholdNav: number;
  excessAlphaPerUnit: number;
  performanceFeeRatePct: number;
  totalPerformanceFeeAmount: number;
  newHighWaterMarkNav: number;
  netNavPostFee: number;
  explainability: {
    formula: string;
    intermediateSteps: string[];
  };
}

export interface FeeSimulationInput {
  portfolioAmount: number; // Default ₹50L+
  expectedGrossReturnPct: number; // e.g. 15 for 15%
  holdingPeriodDays?: number; // Default 365
  annualTrades?: number; // Default 60
}

export interface FeeSimulationOptionResult {
  optionId: PmsFeeOptionId;
  optionName: string;
  grossGains: number;
  fixedFee: number;
  hurdleAmount: number;
  performanceFee: number;
  brokerageAndTxCharges: number;
  gstAmount: number;
  totalDeductions: number;
  netProfitToInvestor: number;
  netReturnPct: number;
}

export interface RedemptionQuoteInput {
  currentPortfolioValue: number;
  requestedWithdrawalAmount: number;
  holdingPeriodDays: number;
  settlementMode: "CASH_LIQUIDATION" | "IN_SPECIE_DEMAT_TRANSFER";
  pendingPerformanceFee?: number;
  pendingManagementFee?: number;
}

export interface RedemptionQuoteResult {
  engineVersion: string;
  calculationTimestamp: string;
  isPermitted: boolean;
  requestedAmount: number;
  settlementMode: "CASH_LIQUIDATION" | "IN_SPECIE_DEMAT_TRANSFER";
  residualPortfolioValue: number;
  isPartialWithdrawal: boolean;
  sebiResidualFloorSatisfied: boolean; // Must be >= ₹50,00,000 if partial
  holdingPeriodDays: number;
  exitLoadTier: "YEAR_1" | "YEAR_2" | "YEAR_3" | "YEAR_4_PLUS";
  exitLoadPct: number;
  exitLoadAmount: number;
  pendingFeesDeducted: number;
  netPayoutAmount: number;
  settlementTimelineDays: string;
  rejectionReason?: string;
  explainability: string[];
}

export class PmsFeeAndRedemptionEngine {
  private static instance: PmsFeeAndRedemptionEngine;
  private readonly ENGINE_VERSION = "SEBI-PMS-FEE-v1.0";
  private readonly STATUTORY_PMS_FLOOR = 50_00_000; // ₹50 Lakhs

  static getInstance(): PmsFeeAndRedemptionEngine {
    if (!PmsFeeAndRedemptionEngine.instance) {
      PmsFeeAndRedemptionEngine.instance = new PmsFeeAndRedemptionEngine();
    }
    return PmsFeeAndRedemptionEngine.instance;
  }

  /**
   * Returns all available PMS fee options with regulatory terms
   */
  getFeeOptions(): PmsFeeOptionProfile[] {
    return Object.values(PMS_FEE_OPTIONS);
  }

  /**
   * Calculate High Water Mark (HWM) Performance Fee
   */
  calculateHwmPerformanceFee(input: HwmCalculationInput): HwmCalculationResult {
    const {
      startingNav,
      currentNav,
      highWaterMarkNav,
      hurdleRatePct,
      performanceFeePct,
      holdingPeriodDays,
      portfolioAmount,
    } = input;

    const annualizedFactor = holdingPeriodDays / 365;
    const hurdleMultiplier = 1 + (hurdleRatePct / 100) * annualizedFactor;
    const hurdleBenchmarkNav = Number((startingNav * hurdleMultiplier).toFixed(4));
    const effectiveThresholdNav = Math.max(highWaterMarkNav, hurdleBenchmarkNav);

    const hwmExceeded = currentNav > highWaterMarkNav;
    const hurdleExceeded = currentNav > hurdleBenchmarkNav;
    const isEligible = hwmExceeded && hurdleExceeded && performanceFeePct > 0;

    const excessAlphaPerUnit = isEligible ? Math.max(0, currentNav - effectiveThresholdNav) : 0;
    const totalUnits = portfolioAmount / startingNav;
    const totalAlphaGains = excessAlphaPerUnit * totalUnits;
    const totalPerformanceFeeAmount = Number(((totalAlphaGains * performanceFeePct) / 100).toFixed(2));

    const newHwmNav = isEligible ? currentNav : highWaterMarkNav;
    const feePerUnit = totalPerformanceFeeAmount / totalUnits;
    const netNavPostFee = Number((currentNav - feePerUnit).toFixed(4));
    const grossReturnPct = Number((((currentNav - startingNav) / startingNav) * 100).toFixed(2));

    const steps = [
      `1. Base Starting NAV: ₹${startingNav.toFixed(2)}, Current NAV: ₹${currentNav.toFixed(2)}, Historical HWM: ₹${highWaterMarkNav.toFixed(2)}`,
      `2. Hurdle Rate (${hurdleRatePct}% p.a. for ${holdingPeriodDays} days): Target NAV is ₹${hurdleBenchmarkNav.toFixed(2)}`,
      `3. Effective Threshold (Max of HWM & Hurdle): ₹${effectiveThresholdNav.toFixed(2)}`,
      isEligible
        ? `4. Current NAV exceeds effective threshold by ₹${excessAlphaPerUnit.toFixed(4)}/unit. Fee (${performanceFeePct}%): ₹${totalPerformanceFeeAmount.toLocaleString("en-IN")}`
        : `4. Current NAV did not breach effective threshold. Zero performance fee charged.`,
      `5. Updated High Water Mark for next cycle: ₹${newHwmNav.toFixed(2)}`,
    ];

    return {
      engineVersion: this.ENGINE_VERSION,
      calculationTimestamp: new Date().toISOString(),
      isEligibleForPerformanceFee: isEligible,
      hwmExceeded,
      hurdleExceeded,
      grossReturnPct,
      hurdleBenchmarkNav,
      effectiveThresholdNav,
      excessAlphaPerUnit: Number(excessAlphaPerUnit.toFixed(4)),
      performanceFeeRatePct: performanceFeePct,
      totalPerformanceFeeAmount,
      newHighWaterMarkNav: newHwmNav,
      netNavPostFee,
      explainability: {
        formula: "Fee = Max(0, Current_NAV - Max(HWM_NAV, Hurdle_NAV)) * Units * Carry_%",
        intermediateSteps: steps,
      },
    };
  }

  /**
   * Simulate and compare investor net returns across all 4 fee models
   */
  simulateFeeOptions(input: FeeSimulationInput): FeeSimulationOptionResult[] {
    const { portfolioAmount, expectedGrossReturnPct } = input;
    const days = input.holdingPeriodDays ?? 365;
    const trades = input.annualTrades ?? 60;
    const annualizedFactor = days / 365;

    const grossGains = Number(((portfolioAmount * expectedGrossReturnPct) / 100).toFixed(2));
    const brokerageAndTxCharges = trades * 20 + trades * 18.5; // Upstox flat ₹20 + CDSL DP charges

    return Object.values(PMS_FEE_OPTIONS).map((opt) => {
      // 1. Fixed Fee
      const fixedFee = Number(
        (((portfolioAmount * opt.fixedManagementFeePct) / 100) * annualizedFactor).toFixed(2)
      );

      // 2. Performance Fee
      let performanceFee = 0;
      let hurdleAmount = 0;
      if (opt.performanceFeePct > 0 && opt.hurdleRatePct > 0) {
        hurdleAmount = Number((((portfolioAmount * opt.hurdleRatePct) / 100) * annualizedFactor).toFixed(2));
        if (grossGains > hurdleAmount) {
          const excessGains = grossGains - hurdleAmount;
          performanceFee = Number(((excessGains * opt.performanceFeePct) / 100).toFixed(2));
        }
      }

      // 3. GST (18% on fixed fee, performance fee, and brokerage)
      const taxableFees = fixedFee + performanceFee + trades * 20;
      const gstAmount = Number(((taxableFees * 18) / 100).toFixed(2));

      // 4. Totals
      const totalDeductions = Number(
        (fixedFee + performanceFee + brokerageAndTxCharges + gstAmount).toFixed(2)
      );
      const netProfitToInvestor = Number((grossGains - totalDeductions).toFixed(2));
      const netReturnPct = Number(((netProfitToInvestor / portfolioAmount) * 100).toFixed(2));

      return {
        optionId: opt.id,
        optionName: opt.name,
        grossGains,
        fixedFee,
        hurdleAmount,
        performanceFee,
        brokerageAndTxCharges,
        gstAmount,
        totalDeductions,
        netProfitToInvestor,
        netReturnPct,
      };
    });
  }

  /**
   * Calculate Redemption Quote, SEBI Exit Loads, and Validate Residual Floor
   */
  calculateRedemptionQuote(input: RedemptionQuoteInput): RedemptionQuoteResult {
    const {
      currentPortfolioValue,
      requestedWithdrawalAmount,
      holdingPeriodDays,
      settlementMode,
    } = input;

    const isPartialWithdrawal = requestedWithdrawalAmount < currentPortfolioValue;
    const residualPortfolioValue = Math.max(0, currentPortfolioValue - requestedWithdrawalAmount);
    const pendingFees = (input.pendingPerformanceFee ?? 0) + (input.pendingManagementFee ?? 0);

    // 1. Validate SEBI Regulation 23(2) Residual Floor
    // Partial withdrawals must not breach the ₹50 Lakh minimum
    let isPermitted = true;
    let rejectionReason: string | undefined;

    if (isPartialWithdrawal && residualPortfolioValue < this.STATUTORY_PMS_FLOOR) {
      isPermitted = false;
      rejectionReason = `Breach of SEBI (Portfolio Managers) Regulations, 2020: Residual portfolio value after withdrawal would be ₹${residualPortfolioValue.toLocaleString("en-IN")}, which is below the mandatory statutory floor of ₹50,00,000. Client must either reduce withdrawal amount to retain at least ₹50L or execute a FULL redemption.`;
    }

    if (requestedWithdrawalAmount > currentPortfolioValue) {
      isPermitted = false;
      rejectionReason = `Requested withdrawal amount (₹${requestedWithdrawalAmount.toLocaleString("en-IN")}) exceeds current portfolio valuation (₹${currentPortfolioValue.toLocaleString("en-IN")}).`;
    }

    // 2. SEBI Exit Load Tier Determination
    let exitLoadTier: "YEAR_1" | "YEAR_2" | "YEAR_3" | "YEAR_4_PLUS";
    let exitLoadPct: number;

    if (holdingPeriodDays <= 365) {
      exitLoadTier = "YEAR_1";
      exitLoadPct = 2.5; // Standard 2.5% in Year 1 (SEBI max: 3.0%)
    } else if (holdingPeriodDays <= 730) {
      exitLoadTier = "YEAR_2";
      exitLoadPct = 1.5; // Standard 1.5% in Year 2 (SEBI max: 2.0%)
    } else if (holdingPeriodDays <= 1095) {
      exitLoadTier = "YEAR_3";
      exitLoadPct = 1.0; // Standard 1.0% in Year 3 (SEBI max: 1.0%)
    } else {
      exitLoadTier = "YEAR_4_PLUS";
      exitLoadPct = 0.0; // 0% after 3 years
    }

    // In-specie demat share transfers incur standard exit load unless contractually waived
    const exitLoadAmount = Number(((requestedWithdrawalAmount * exitLoadPct) / 100).toFixed(2));
    const netPayoutAmount = isPermitted
      ? Math.max(0, Number((requestedWithdrawalAmount - exitLoadAmount - pendingFees).toFixed(2)))
      : 0;

    const explainability = [
      `Holding period: ${holdingPeriodDays} days (${exitLoadTier.replace("_", " ")}). Exit load rate applied: ${exitLoadPct}%.`,
      `Gross Redemption Amount: ₹${requestedWithdrawalAmount.toLocaleString("en-IN")}`,
      `Exit Load Deduction: ₹${exitLoadAmount.toLocaleString("en-IN")}`,
      `Pending Fees & Taxes Deducted: ₹${pendingFees.toLocaleString("en-IN")}`,
      `Net Settlement Payout: ₹${netPayoutAmount.toLocaleString("en-IN")}`,
      isPartialWithdrawal
        ? `Residual Portfolio Valuation: ₹${residualPortfolioValue.toLocaleString("en-IN")} (SEBI ₹50L Floor Verified: ${residualPortfolioValue >= this.STATUTORY_PMS_FLOOR ? "PASS" : "FAIL"}).`
        : `Full portfolio redemption executed. Account marked for statutory closure.`,
    ];

    return {
      engineVersion: this.ENGINE_VERSION,
      calculationTimestamp: new Date().toISOString(),
      isPermitted,
      requestedAmount: requestedWithdrawalAmount,
      settlementMode,
      residualPortfolioValue,
      isPartialWithdrawal,
      sebiResidualFloorSatisfied: !isPartialWithdrawal || residualPortfolioValue >= this.STATUTORY_PMS_FLOOR,
      holdingPeriodDays,
      exitLoadTier,
      exitLoadPct,
      exitLoadAmount,
      pendingFeesDeducted: pendingFees,
      netPayoutAmount,
      settlementTimelineDays: settlementMode === "CASH_LIQUIDATION" ? "7 to 10 business days" : "3 to 5 business days",
      rejectionReason,
      explainability,
    };
  }
}

export const pmsFeeAndRedemptionEngine = PmsFeeAndRedemptionEngine.getInstance();

