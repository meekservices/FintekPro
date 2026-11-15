/**
 * @file tax-calculator.ts
 * @description Dynamic Income Tax Calculator Schemas & Data Contracts for FintekPro.
 * Compliant with FintekPro GCR v1.0, FASP-AI v1.0, and Finance Act 2024 / Budget 2025 provisions.
 */

import { z } from "zod";

export const AssessmentYearEnum = z.enum(["2024-25", "2025-26", "2026-27"]);
export type AssessmentYear = z.infer<typeof AssessmentYearEnum>;

export const TaxRegimeEnum = z.enum(["new", "old"]);
export type TaxRegime = z.infer<typeof TaxRegimeEnum>;

export const TaxEntityTypeEnum = z.enum([
  "individual",
  "huf",
  "partnership_firm",
  "llp",
  "domestic_company",
  "foreign_company",
  "aop_boi",
]);
export type TaxEntityType = z.infer<typeof TaxEntityTypeEnum>;

export const AgeCategoryEnum = z.enum(["below_60", "senior_60_to_80", "super_senior_above_80"]);
export type AgeCategory = z.infer<typeof AgeCategoryEnum>;

// ── Income Breakdown Schemas ─────────────────────────────────────────────────

export const SalaryIncomeSchema = z.object({
  basicSalary: z.number().nonnegative().default(0),
  dearnessAllowance: z.number().nonnegative().default(0),
  hraReceived: z.number().nonnegative().default(0),
  rentPaidPerYear: z.number().nonnegative().default(0),
  isMetroCity: z.boolean().default(false),
  specialAllowance: z.number().nonnegative().default(0),
  ltaReceived: z.number().nonnegative().default(0),
  employerNps80CCD2: z.number().nonnegative().default(0),
  otherAllowances: z.number().nonnegative().default(0),
  perquisites: z.number().nonnegative().default(0),
  professionalTax: z.number().nonnegative().default(0),
});
export type SalaryIncome = z.infer<typeof SalaryIncomeSchema>;

export const HousePropertyIncomeSchema = z.object({
  isSelfOccupied: z.boolean().default(true),
  grossAnnualRent: z.number().nonnegative().default(0),
  municipalTaxesPaid: z.number().nonnegative().default(0),
  homeLoanInterestSec24b: z.number().nonnegative().default(0),
});
export type HousePropertyIncome = z.infer<typeof HousePropertyIncomeSchema>;

export const CapitalGainsIncomeSchema = z.object({
  stcgEquity111A: z.number().nonnegative().default(0), // 15% pre-Budget 2024 / 20% post
  ltcgEquity112A: z.number().nonnegative().default(0), // 10% pre-Budget 2024 / 12.5% post (exemption: 1L or 1.25L)
  stcgSlabRate: z.number().nonnegative().default(0),   // Debt funds / unlisted short term
  ltcgNormal20: z.number().nonnegative().default(0),   // Real estate with indexation (pre-July 2024) / gold
  ltcgNormal12_5: z.number().nonnegative().default(0), // Non-equity/real estate unindexed
});
export type CapitalGainsIncome = z.infer<typeof CapitalGainsIncomeSchema>;

export const BusinessIncomeSchema = z.object({
  netProfit: z.number().default(0),
  presumptiveSection: z.enum(["none", "44AD", "44ADA", "44AE"]).default("none"),
  grossReceiptsOrTurnover: z.number().nonnegative().default(0),
});
export type BusinessIncome = z.infer<typeof BusinessIncomeSchema>;

export const OtherSourcesIncomeSchema = z.object({
  savingsBankInterest: z.number().nonnegative().default(0),
  fixedDepositInterest: z.number().nonnegative().default(0),
  dividendIncome: z.number().nonnegative().default(0),
  familyPension: z.number().nonnegative().default(0),
  lotteryWinningsSec115BB: z.number().nonnegative().default(0),
  vdaCryptoSec115BBH: z.number().nonnegative().default(0),
  anyOtherIncome: z.number().nonnegative().default(0),
});
export type OtherSourcesIncome = z.infer<typeof OtherSourcesIncomeSchema>;

// ── Chapter VI-A Deductions ──────────────────────────────────────────────────

export const DeductionsSchema = z.object({
  section80C: z.number().nonnegative().default(0),         // PPF, ELSS, EPF, LIC (Max 1.5L)
  section80DSelf: z.number().nonnegative().default(0),     // Mediclaim self & family (25k or 50k)
  section80DParents: z.number().nonnegative().default(0),  // Mediclaim parents (25k or 50k if senior)
  isParentsSeniorCitizen: z.boolean().default(false),
  section80CCD1B_NPS: z.number().nonnegative().default(0), // Additional NPS (Max 50k)
  section80E_EducationLoan: z.number().nonnegative().default(0),
  section80G_Donations: z.number().nonnegative().default(0),
  section80TTA_Savings: z.number().nonnegative().default(0), // Max 10k (non-seniors)
  section80TTB_SeniorSavings: z.number().nonnegative().default(0), // Max 50k (seniors)
  otherDeductions: z.number().nonnegative().default(0),
});
export type Deductions = z.infer<typeof DeductionsSchema>;

// ── Taxes Paid & Advance Tax ─────────────────────────────────────────────────

export const TaxesPaidSchema = z.object({
  tdsSalary: z.number().nonnegative().default(0),
  tdsOtherThanSalary: z.number().nonnegative().default(0),
  tcsDeducted: z.number().nonnegative().default(0),
  advanceTaxQ1: z.number().nonnegative().default(0), // By June 15
  advanceTaxQ2: z.number().nonnegative().default(0), // By Sep 15
  advanceTaxQ3: z.number().nonnegative().default(0), // By Dec 15
  advanceTaxQ4: z.number().nonnegative().default(0), // By Mar 15
  selfAssessmentTax: z.number().nonnegative().default(0),
});
export type TaxesPaid = z.infer<typeof TaxesPaidSchema>;

// ── Calculation Request & Response DTOs ──────────────────────────────────────

export const TaxCalculationRequestSchema = z.object({
  assessmentYear: AssessmentYearEnum.default("2025-26"),
  regime: TaxRegimeEnum.default("new"),
  entityType: TaxEntityTypeEnum.default("individual"),
  ageCategory: AgeCategoryEnum.default("below_60"),
  salary: SalaryIncomeSchema.optional().default(() => SalaryIncomeSchema.parse({})),
  houseProperty: HousePropertyIncomeSchema.optional().default(() => HousePropertyIncomeSchema.parse({})),
  capitalGains: CapitalGainsIncomeSchema.optional().default(() => CapitalGainsIncomeSchema.parse({})),
  business: BusinessIncomeSchema.optional().default(() => BusinessIncomeSchema.parse({})),
  otherSources: OtherSourcesIncomeSchema.optional().default(() => OtherSourcesIncomeSchema.parse({})),
  deductions: DeductionsSchema.optional().default(() => DeductionsSchema.parse({})),
  taxesPaid: TaxesPaidSchema.optional().default(() => TaxesPaidSchema.parse({})),
});
export type TaxCalculationRequest = z.infer<typeof TaxCalculationRequestSchema>;

export interface SlabBreakdownItem {
  slabRange: string;
  ratePercent: number;
  taxableAmountInSlab: number;
  taxAmount: number;
}

export interface TaxCalculationResultData {
  assessmentYear: string;
  regime: TaxRegime;
  entityType: TaxEntityType;
  ageCategory: AgeCategory;

  // Heads of Income
  grossSalary: number;
  salaryStandardDeduction: number;
  netSalaryIncome: number;
  netHousePropertyIncome: number;
  netCapitalGainsIncome: number;
  netBusinessIncome: number;
  netOtherSourcesIncome: number;

  grossTotalIncome: number;
  totalEligibleDeductions: number;
  totalTaxableIncome: number;

  // Tax Breakdown
  normalSlabTax: number;
  specialRateTax: number;
  rebateSection87A: number;
  taxAfterRebate: number;
  surchargeAmount: number;
  marginalReliefAmount: number;
  healthAndEducationCess: number;
  totalTaxLiability: number;

  // Interest & Penalties
  interestSec234A: number;
  interestSec234B: number;
  interestSec234C: number;
  totalInterestPenalties: number;

  // Final Settlement
  totalTaxAndInterest: number;
  totalTaxesPaid: number;
  netTaxPayable: number;
  netRefundDue: number;
  effectiveTaxRatePercent: number;

  slabBreakdown: SlabBreakdownItem[];
}

export interface TaxCalculationResponse {
  success: boolean;
  data: TaxCalculationResultData;
  explainability: {
    inputs_used: Record<string, any>;
    formula_applied: string;
    intermediate_steps: Record<string, any>;
    statutory_citations: string[];
  };
  meta: {
    engine_version: string;
    calculation_timestamp: string;
  };
}

export interface RegimeComparisonItem {
  regime: TaxRegime;
  grossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  slabTax: number;
  rebate87A: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  effectiveTaxRate: number;
  takeHomeIncome: number;
}

export interface RegimeComparisonResponse {
  success: boolean;
  assessmentYear: AssessmentYear;
  oldRegime: RegimeComparisonItem;
  newRegime: RegimeComparisonItem;
  recommendation: {
    optimalRegime: TaxRegime;
    savingsAmount: number;
    savingsPercentage: number;
    breakEvenDeductionRequired?: number;
    advisoryNote: string;
  };
  meta: {
    engine_version: string;
    calculation_timestamp: string;
  };
}

export interface TaxSlabConfig {
  min: number;
  max: number | null;
  rate: number;
}

export interface TaxYearConfigResponse {
  assessmentYear: AssessmentYear;
  newRegime: {
    standardDeduction: number;
    familyPensionStandardDeduction: number;
    rebate87ALimit: number;
    rebate87AMaxAmount: number;
    slabs: TaxSlabConfig[];
    maxSurchargeRate: number;
  };
  oldRegime: {
    standardDeduction: number;
    familyPensionStandardDeduction: number;
    rebate87ALimit: number;
    rebate87AMaxAmount: number;
    slabs: {
      below60: TaxSlabConfig[];
      senior60to80: TaxSlabConfig[];
      superSeniorAbove80: TaxSlabConfig[];
    };
    maxSurchargeRate: number;
  };
  cessRatePercent: number;
  statutoryAct: string;
  effectiveDate: string;
}
