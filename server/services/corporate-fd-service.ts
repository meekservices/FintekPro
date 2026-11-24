/**
 * Corporate Fixed Deposit (NBFC & Bank FD) Engine — FintekPro Financial Services LLP
 *
 * Implements high-yield corporate fixed deposit distribution:
 * - Product catalog: Bajaj Finance, Shriram Finance, Mahindra Finance, Utkarsh SFB
 * - Accurate financial math: Cumulative annual compounding vs Monthly/Quarterly non-cumulative
 * - Senior Citizen (+0.25% to +0.50%) & Women investor benefits
 * - Income Tax Section 194A TDS threshold modeling (₹5,000 NBFC / ₹50,000 Sr Citizen / 15G/15H)
 * - Partner agency attribution: 1.50% - 2.25% upfront distribution commission
 *
 * Adheres to FintekPro GCR v1.0 + FASP-AI v1.0.
 *
 * @engineVersion FINTEK-CORP-FD-v1.0
 */

import { logger } from "../logger";

export interface FdScheme {
  schemeKey: string;
  issuerName: string;
  ratingAgency: "CRISIL" | "ICRA" | "CARE" | "INDIA_RATINGS";
  creditRating: "AAA" | "AA+" | "AA" | "A+";
  minDepositAmount: number;
  maxDepositAmount: number;
  availableTenuresMonths: number[];
  baseInterestRates: Record<number, number>; // tenureMonths -> annual interest percentage
  seniorCitizenExtraPercent: number;
  womenExtraPercent: number;
  isRbiInsuredBank: boolean; // Utkarsh SFB DICGC insured up to ₹5L
  payoutOptions: Array<"CUMULATIVE" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL">;
  partnerCommissionRatePercent: number;
}

export interface FdMaturityCalculation {
  schemeKey: string;
  issuerName: string;
  principalAmount: number;
  tenureMonths: number;
  tenureYears: number;
  payoutFrequency: "CUMULATIVE" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL";
  baseRatePercent: number;
  seniorBonusPercent: number;
  womenBonusPercent: number;
  effectiveRatePercent: number;
  totalInterestEarned: number;
  maturityValue: number;
  periodicPayoutAmount: number; // For non-cumulative payouts
  estimatedTdsDeduction: number;
  is15g15hEligible: boolean;
  partnerCommissionEstimate: number;
  explainability: {
    formulaApplied: string;
    inputs: Record<string, unknown>;
    statutoryTdsSection: string;
  };
  meta: {
    engineVersion: string;
    calculationTimestamp: string;
  };
}

export class CorporateFdService {
  private static instance: CorporateFdService;
  static readonly ENGINE_VERSION = "FINTEK-CORP-FD-v1.0";

  // Pre-vetted Institutional Corporate FD Catalog
  private readonly schemes: Record<string, FdScheme> = {
    BAJAJ_FINANCE: {
      schemeKey: "BAJAJ_FINANCE",
      issuerName: "Bajaj Finance Limited",
      ratingAgency: "CRISIL",
      creditRating: "AAA",
      minDepositAmount: 15000,
      maxDepositAmount: 50000000,
      availableTenuresMonths: [12, 18, 24, 36, 44, 60],
      baseInterestRates: {
        12: 7.40,
        18: 7.80,
        24: 7.95,
        36: 8.10,
        44: 8.25, // Special tenure
        60: 8.10,
      },
      seniorCitizenExtraPercent: 0.25,
      womenExtraPercent: 0.10,
      isRbiInsuredBank: false,
      payoutOptions: ["CUMULATIVE", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"],
      partnerCommissionRatePercent: 1.75,
    },
    SHRIRAM_FINANCE: {
      schemeKey: "SHRIRAM_FINANCE",
      issuerName: "Shriram Finance Limited",
      ratingAgency: "CRISIL",
      creditRating: "AA+",
      minDepositAmount: 10000,
      maxDepositAmount: 25000000,
      availableTenuresMonths: [12, 24, 36, 48, 60],
      baseInterestRates: {
        12: 7.85,
        24: 8.15,
        36: 8.70,
        48: 8.75,
        60: 8.80,
      },
      seniorCitizenExtraPercent: 0.50,
      womenExtraPercent: 0.10,
      isRbiInsuredBank: false,
      payoutOptions: ["CUMULATIVE", "MONTHLY", "QUARTERLY", "ANNUAL"],
      partnerCommissionRatePercent: 2.20,
    },
    MAHINDRA_FINANCE: {
      schemeKey: "MAHINDRA_FINANCE",
      issuerName: "Mahindra & Mahindra Financial Services",
      ratingAgency: "CRISIL",
      creditRating: "AAA",
      minDepositAmount: 10000,
      maxDepositAmount: 30000000,
      availableTenuresMonths: [12, 24, 36, 48, 60],
      baseInterestRates: {
        12: 7.60,
        24: 7.75,
        36: 8.05,
        48: 8.05,
        60: 8.10,
      },
      seniorCitizenExtraPercent: 0.35,
      womenExtraPercent: 0.0,
      isRbiInsuredBank: false,
      payoutOptions: ["CUMULATIVE", "HALF_YEARLY", "ANNUAL"],
      partnerCommissionRatePercent: 1.60,
    },
    UTKARSH_SFB: {
      schemeKey: "UTKARSH_SFB",
      issuerName: "Utkarsh Small Finance Bank",
      ratingAgency: "CARE",
      creditRating: "A+",
      minDepositAmount: 5000,
      maxDepositAmount: 20000000,
      availableTenuresMonths: [12, 24, 36, 48, 60],
      baseInterestRates: {
        12: 8.00,
        24: 8.50,
        36: 8.50,
        48: 8.25,
        60: 7.75,
      },
      seniorCitizenExtraPercent: 0.60,
      womenExtraPercent: 0.0,
      isRbiInsuredBank: true, // DICGC protected up to ₹5,00,000
      payoutOptions: ["CUMULATIVE", "MONTHLY", "QUARTERLY"],
      partnerCommissionRatePercent: 1.25,
    },
  };

  static getInstance(): CorporateFdService {
    if (!CorporateFdService.instance) {
      CorporateFdService.instance = new CorporateFdService();
    }
    return CorporateFdService.instance;
  }

  /**
   * Returns all active corporate FD schemes
   */
  getAvailableSchemes(): FdScheme[] {
    return Object.values(this.schemes);
  }

  /**
   * Calculates FD returns, maturity value, periodic payout, and TDS implications
   */
  calculateMaturity(params: {
    schemeKey: string;
    principalAmount: number;
    tenureMonths: number;
    isSeniorCitizen?: boolean;
    isWomanInvestor?: boolean;
    payoutFrequency?: "CUMULATIVE" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL";
  }): FdMaturityCalculation {
    const scheme = this.schemes[params.schemeKey];
    if (!scheme) {
      throw new Error(`Unknown corporate FD scheme: ${params.schemeKey}`);
    }

    const {
      principalAmount,
      tenureMonths,
      isSeniorCitizen = false,
      isWomanInvestor = false,
      payoutFrequency = "CUMULATIVE",
    } = params;

    // Validate principal limits
    if (principalAmount < scheme.minDepositAmount) {
      throw new Error(`Minimum deposit for ${scheme.issuerName} is ₹${scheme.minDepositAmount.toLocaleString("en-IN")}`);
    }
    if (principalAmount > scheme.maxDepositAmount) {
      throw new Error(`Maximum deposit for ${scheme.issuerName} is ₹${scheme.maxDepositAmount.toLocaleString("en-IN")}`);
    }

    // Resolve nearest tenure rate
    const availableTenures = scheme.availableTenuresMonths;
    let resolvedTenure = availableTenures.find((t) => t === tenureMonths);
    if (!resolvedTenure) {
      // Find closest lower tenure
      const sorted = [...availableTenures].sort((a, b) => a - b);
      resolvedTenure = sorted.reverse().find((t) => t <= tenureMonths) || sorted[0];
    }

    const baseRatePercent = scheme.baseInterestRates[resolvedTenure];
    const seniorBonusPercent = isSeniorCitizen ? scheme.seniorCitizenExtraPercent : 0;
    const womenBonusPercent = isWomanInvestor ? scheme.womenExtraPercent : 0;
    const effectiveRatePercent = baseRatePercent + seniorBonusPercent + womenBonusPercent;

    const r = effectiveRatePercent / 100;
    const tenureYears = tenureMonths / 12;

    let maturityValue: number;
    let totalInterestEarned: number;
    let periodicPayoutAmount = 0;
    let formulaApplied: string;

    if (payoutFrequency === "CUMULATIVE") {
      // Compounded annually: A = P * (1 + r)^t
      maturityValue = Math.round(principalAmount * Math.pow(1 + r, tenureYears));
      totalInterestEarned = maturityValue - principalAmount;
      formulaApplied = "A = P * (1 + r)^t (Annual Compounding)";
    } else {
      // Non-cumulative simple interest payout
      totalInterestEarned = Math.round(principalAmount * r * tenureYears);
      maturityValue = principalAmount;

      let periodsPerYear = 1;
      if (payoutFrequency === "MONTHLY") periodsPerYear = 12;
      else if (payoutFrequency === "QUARTERLY") periodsPerYear = 4;
      else if (payoutFrequency === "HALF_YEARLY") periodsPerYear = 2;
      else if (payoutFrequency === "ANNUAL") periodsPerYear = 1;

      periodicPayoutAmount = Math.round((principalAmount * r) / periodsPerYear);
      formulaApplied = `Periodic Payout = (P * r) / ${periodsPerYear} (${payoutFrequency})`;
    }

    // Section 194A TDS Modeling:
    // Threshold: ₹5,000/year for NBFCs, ₹50,000 for Senior Citizens in Banks
    const annualInterest = totalInterestEarned / tenureYears;
    const tdsThreshold = isSeniorCitizen ? 50000 : 5000;
    const isTdsApplicable = annualInterest > tdsThreshold;
    const estimatedTdsDeduction = isTdsApplicable ? Math.round(totalInterestEarned * 0.10) : 0;

    // Partner Agency Commission
    const partnerCommissionEstimate = Math.round(
      (principalAmount * scheme.partnerCommissionRatePercent) / 100
    );

    return {
      schemeKey: scheme.schemeKey,
      issuerName: scheme.issuerName,
      principalAmount,
      tenureMonths,
      tenureYears,
      payoutFrequency,
      baseRatePercent,
      seniorBonusPercent,
      womenBonusPercent,
      effectiveRatePercent,
      totalInterestEarned,
      maturityValue,
      periodicPayoutAmount,
      estimatedTdsDeduction,
      is15g15hEligible: isTdsApplicable, // Can submit 15G/15H to avoid TDS if total income below exemption
      partnerCommissionEstimate,
      explainability: {
        formulaApplied,
        inputs: {
          principalAmount,
          tenureMonths,
          baseRatePercent,
          seniorBonusPercent,
          womenBonusPercent,
          effectiveRatePercent,
        },
        statutoryTdsSection: "Income Tax Act, 1961 — Section 194A (10% TDS on interest above threshold)",
      },
      meta: {
        engineVersion: CorporateFdService.ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Simulates end-to-end digital FD booking
   */
  simulateBooking(params: {
    schemeKey: string;
    principalAmount: number;
    tenureMonths: number;
    investorPan: string;
    investorName: string;
    bankAccountNumber: string;
    ifscCode: string;
    nomineeName: string;
    nomineeRelation: string;
    isSeniorCitizen?: boolean;
    isWomanInvestor?: boolean;
    payoutFrequency?: "CUMULATIVE" | "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL";
  }) {
    const calc = this.calculateMaturity(params);
    const bookingRef = `FD_SIM_${params.schemeKey}_${Date.now()}`;
    const fdrNumber = `FDR-${Math.floor(100000000 + Math.random() * 900000000)}`;

    logger.info("CORPORATE_FD_BOOKING_SIMULATED", {
      event: "CORPORATE_FD_BOOKED",
      bookingRef,
      fdrNumber,
      issuer: calc.issuerName,
      amount: params.principalAmount,
      maturityValue: calc.maturityValue,
      partnerCommission: calc.partnerCommissionEstimate,
    });

    return {
      success: true,
      bookingRef,
      fdrNumber,
      issuerName: calc.issuerName,
      principalAmount: params.principalAmount,
      effectiveRatePercent: calc.effectiveRatePercent,
      maturityValue: calc.maturityValue,
      tenureMonths: params.tenureMonths,
      bookingDate: new Date().toISOString(),
      maturityDate: new Date(Date.now() + params.tenureMonths * 30.5 * 24 * 60 * 60 * 1000).toISOString(),
      payoutFrequency: calc.payoutFrequency,
      fdrDocumentUrl: `/api/admin/desks/fd/receipt/${bookingRef}`,
      partnerAgencyCommission: calc.partnerCommissionEstimate,
      message: `Digital Fixed Deposit placed successfully with ${calc.issuerName}. FDR Certificate generated.`,
    };
  }
}

export const corporateFdService = CorporateFdService.getInstance();
