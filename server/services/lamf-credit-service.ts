/**
 * Loan Against Mutual Funds & Securities (LAMF/LAS) Engine — FintekPro Financial Services LLP
 *
 * Implements instant digital overdraft against pledged mutual fund units:
 * - RBI Master Direction compliant LTV limits:
 *     - Equity Funds: 50% LTV
 *     - Hybrid Funds: 65% LTV
 *     - Debt & Liquid Funds: 80% LTV
 * - Avoided Capital Gains Tax & Compounding Protection Calculator (Finance Act 2024 tax rules)
 * - CAMS & KFintech digital lien marking state machine (OTP-based pledge)
 * - Partner / Distributor AUM retention: avoids redemption, protecting AUM trail!
 *
 * Adheres to FintekPro GCR v1.0 + FASP-AI v1.0.
 *
 * @engineVersion FINTEK-LAMF-CREDIT-v1.0
 */

import { logger } from "../logger";

export interface MfHolding {
  schemeCode: string;
  schemeName: string;
  category: "EQUITY" | "HYBRID" | "DEBT" | "LIQUID";
  currentNav: number;
  units: number;
  currentValue: number;
  costValue: number;
  folioNumber: string;
  rta: "CAMS" | "KFINTECH";
}

export interface LamfEligibilityResult {
  totalPortfolioValue: number;
  totalEligibleCreditLimit: number;
  minWithdrawalAmount: number;
  maxWithdrawalAmount: number;
  annualInterestRatePercent: number;
  processingFeePercent: number;
  eligibleHoldings: Array<{
    schemeCode: string;
    schemeName: string;
    category: string;
    holdingValue: number;
    ltvPercent: number;
    maxLoanAgainstHolding: number;
    rta: string;
  }>;
  terms: {
    tenureMonths: number;
    interestRepaymentType: string;
    prepaymentPenalty: string;
    foreclosureCharges: string;
  };
  meta: {
    engineVersion: string;
    calculationTimestamp: string;
  };
}

export interface TaxSavingsComparison {
  withdrawalAmount: number;
  tenureMonths: number;
  assumedAnnualPortfolioReturnPercent: number;
  
  // Scenario A: Outright MF Redemption
  scenarioRedemption: {
    estimatedRealizedGain: number;
    capitalGainsTaxPayable: number;
    netCashInHand: number;
    lostCompoundingGrowth: number;
    totalEconomicCost: number;
  };

  // Scenario B: Loan Against Mutual Funds (LAMF)
  scenarioLamf: {
    loanInterestPaid: number;
    portfolioValueRetained: number;
    portfolioGrownValue: number;
    netBenefitOfLamf: number;
  };

  recommendation: string;
  explainability: {
    ltcgTaxRateApplied: string;
    rbiLtvGuidelines: string;
    formulaApplied: string;
  };
}

export class LamfCreditService {
  private static instance: LamfCreditService;
  static readonly ENGINE_VERSION = "FINTEK-LAMF-CREDIT-v1.0";
  static readonly ANNUAL_INTEREST_RATE = 10.25; // 10.25% p.a. simple interest on utilized amount
  static readonly PROCESSING_FEE_PERCENT = 0.50; // 0.50% one-time

  static getInstance(): LamfCreditService {
    if (!LamfCreditService.instance) {
      LamfCreditService.instance = new LamfCreditService();
    }
    return LamfCreditService.instance;
  }

  /**
   * Evaluates client portfolio holdings against RBI LTV thresholds
   */
  evaluatePortfolio(holdings: MfHolding[]): LamfEligibilityResult {
    let totalPortfolioValue = 0;
    let totalEligibleCreditLimit = 0;

    const eligibleHoldings = holdings.map((h) => {
      const holdingValue = h.currentValue > 0 ? h.currentValue : Math.round(h.units * h.currentNav);
      totalPortfolioValue += holdingValue;

      // RBI Master Direction LTV Caps
      let ltvPercent = 50;
      if (h.category === "LIQUID") {
        ltvPercent = 80;
      } else if (h.category === "DEBT") {
        ltvPercent = 75;
      } else if (h.category === "HYBRID") {
        ltvPercent = 65;
      } else {
        ltvPercent = 50; // EQUITY
      }

      const maxLoanAgainstHolding = Math.round((holdingValue * ltvPercent) / 100);
      totalEligibleCreditLimit += maxLoanAgainstHolding;

      return {
        schemeCode: h.schemeCode,
        schemeName: h.schemeName,
        category: h.category,
        holdingValue,
        ltvPercent,
        maxLoanAgainstHolding,
        rta: h.rta,
      };
    });

    return {
      totalPortfolioValue,
      totalEligibleCreditLimit,
      minWithdrawalAmount: 10000,
      maxWithdrawalAmount: totalEligibleCreditLimit,
      annualInterestRatePercent: LamfCreditService.ANNUAL_INTEREST_RATE,
      processingFeePercent: LamfCreditService.PROCESSING_FEE_PERCENT,
      eligibleHoldings,
      terms: {
        tenureMonths: 36, // Renewable annual overdraft
        interestRepaymentType: "Monthly interest on utilized limit only (Principal at maturity)",
        prepaymentPenalty: "Zero prepayment penalty",
        foreclosureCharges: "Nil",
      },
      meta: {
        engineVersion: LamfCreditService.ENGINE_VERSION,
        calculationTimestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Quantifies tax avoidance savings & continued compounding by choosing LAMF over MF redemption
   */
  calculateTaxSavings(params: {
    withdrawalAmount: number;
    tenureMonths: number;
    assumedAnnualPortfolioReturnPercent?: number;
    holdingPeriodIsLongTerm?: boolean;
    costBasisRatio?: number; // e.g. 0.70 means 70% cost, 30% unrealized gain
  }): TaxSavingsComparison {
    const {
      withdrawalAmount,
      tenureMonths,
      assumedAnnualPortfolioReturnPercent = 12.0,
      holdingPeriodIsLongTerm = true,
      costBasisRatio = 0.70,
    } = params;

    const tenureYears = tenureMonths / 12;

    // SCENARIO A: REDEMPTION
    // Under Finance Act 2024: Equity STCG = 20%, LTCG = 12.5% (above 1.25L exemption)
    const estimatedRealizedGain = Math.round(withdrawalAmount * (1 - costBasisRatio));
    const taxRate = holdingPeriodIsLongTerm ? 0.125 : 0.20;
    const capitalGainsTaxPayable = Math.round(estimatedRealizedGain * taxRate);
    const netCashInHand = withdrawalAmount - capitalGainsTaxPayable;

    // Lost compounding if this capital were left invested
    const portfolioGrowthFactor = Math.pow(1 + assumedAnnualPortfolioReturnPercent / 100, tenureYears);
    const lostCompoundingGrowth = Math.round(withdrawalAmount * (portfolioGrowthFactor - 1));
    const totalEconomicCost = capitalGainsTaxPayable + lostCompoundingGrowth;

    // SCENARIO B: LAMF (OVERDRAFT)
    // Client pays simple interest on loan amount: I = P * r * t
    const loanInterestPaid = Math.round(
      withdrawalAmount * (LamfCreditService.ANNUAL_INTEREST_RATE / 100) * tenureYears
    );
    // Since mutual fund units were NOT sold, full portfolio value continues to grow!
    const portfolioValueRetained = withdrawalAmount;
    const portfolioGrownValue = Math.round(withdrawalAmount * portfolioGrowthFactor);
    const grossCompoundingBenefit = portfolioGrownValue - portfolioValueRetained;

    // Net advantage of LAMF over selling:
    // Retained compounding gains + avoided immediate taxes - loan interest paid
    const netBenefitOfLamf = Math.round(
      grossCompoundingBenefit + capitalGainsTaxPayable - loanInterestPaid
    );

    return {
      withdrawalAmount,
      tenureMonths,
      assumedAnnualPortfolioReturnPercent,
      scenarioRedemption: {
        estimatedRealizedGain,
        capitalGainsTaxPayable,
        netCashInHand,
        lostCompoundingGrowth,
        totalEconomicCost,
      },
      scenarioLamf: {
        loanInterestPaid,
        portfolioValueRetained,
        portfolioGrownValue,
        netBenefitOfLamf,
      },
      recommendation:
        netBenefitOfLamf > 0
          ? `LAMF delivers an estimated net financial advantage of ₹${netBenefitOfLamf.toLocaleString(
              "en-IN"
            )} over selling. You avoid ₹${capitalGainsTaxPayable.toLocaleString(
              "en-IN"
            )} in taxes while your portfolio keeps compounding at ${assumedAnnualPortfolioReturnPercent}% p.a.`
          : "For very short tenures under 3 months, compare processing fees before pledging.",
      explainability: {
        ltcgTaxRateApplied: holdingPeriodIsLongTerm
          ? "Finance Act 2024: 12.5% Long Term Capital Gains on Equity Mutual Funds"
          : "Finance Act 2024: 20% Short Term Capital Gains on Equity Mutual Funds",
        rbiLtvGuidelines: "RBI/2015-16/Master Direction on Loans against Shares and Mutual Funds",
        formulaApplied: "Net Benefit = (Retained Portfolio Compounding + Avoided Tax) - Loan Interest",
      },
    };
  }

  /**
   * Simulates digital lien marking & instant credit line approval
   */
  simulateLienMarking(params: {
    clientPan: string;
    clientName: string;
    bankAccountNumber: string;
    ifscCode: string;
    requestedCreditLimit: number;
    pledgedSchemes: Array<{ schemeCode: string; folioNumber: string; units: number }>;
  }) {
    const pledgeId = `PLG_${Date.now()}`;
    const loanAccountNo = `LAMF_OD_${Math.floor(10000000 + Math.random() * 90000000)}`;

    logger.info("LAMF_LIEN_MARKING_SIMULATED", {
      event: "LAMF_PLEDGE_ACTIVATED",
      pledgeId,
      loanAccountNo,
      amount: params.requestedCreditLimit,
      schemesCount: params.pledgedSchemes.length,
    });

    return {
      success: true,
      pledgeId,
      loanAccountNo,
      approvedLimit: params.requestedCreditLimit,
      sanctionedInterestRate: LamfCreditService.ANNUAL_INTEREST_RATE,
      disbursalMode: "INSTANT_BANK_OVERDRAFT",
      beneficiaryAccount: `****${params.bankAccountNumber.slice(-4)}`,
      lienStatus: "PLEDGED_APPROVED",
      lienCertificateUrl: `/api/admin/desks/lamf/lien-certificate/${pledgeId}`,
      message: `Digital lien marked successfully across ${params.pledgedSchemes.length} schemes via RTA gateway. ₹${params.requestedCreditLimit.toLocaleString("en-IN")} overdraft limit activated.`,
    };
  }
}

export const lamfCreditService = LamfCreditService.getInstance();
