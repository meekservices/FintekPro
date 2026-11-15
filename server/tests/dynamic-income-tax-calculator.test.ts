import { describe, it, expect } from "vitest";
import { indianTaxCalculator } from "../services/indian-tax-calculator";
import { telemetryBus } from "../services/engine-telemetry-bus";
import type { TaxCalculationRequest } from "@shared/schema/tax-calculator";

describe("Dynamic Indian Income Tax Calculator Engine (GCR v1.0 & Finance Act 2024/2025)", () => {
	// ─── 1. Statutory Configuration Parity ────────────────────────────────────
	describe("1. Statutory Multi-Year Configuration Parity", () => {
		it("returns correct standard deduction and slabs for AY 2024-25, 2025-26, and 2026-27", () => {
			const config24 = indianTaxCalculator.getYearConfig("2024-25");
			expect(config24.newRegime.standardDeduction).toBe(50000);
			expect(config24.newRegime.rebate87ALimit).toBe(700000);

			const config25 = indianTaxCalculator.getYearConfig("2025-26");
			expect(config25.newRegime.standardDeduction).toBe(75000); // Finance Act 2024 hike
			expect(config25.newRegime.familyPensionStandardDeduction).toBe(25000);
			expect(config25.newRegime.rebate87ALimit).toBe(700000);

			const config26 = indianTaxCalculator.getYearConfig("2026-27");
			expect(config26.newRegime.standardDeduction).toBe(75000);
			expect(config26.newRegime.rebate87ALimit).toBe(1200000); // Budget 2025 hike
			expect(config26.newRegime.rebate87AMaxAmount).toBe(60000);
			expect(config26.newRegime.slabs.length).toBe(7);
		});
	});

	// ─── 2. AY 2025-26 New Regime Computation ─────────────────────────────────
	describe("2. AY 2025-26 New Regime Standard Deduction & Slabs", () => {
		it("applies ₹75,000 standard deduction and computes exact slab tax for ₹10L salary", () => {
			const req: TaxCalculationRequest = {
				assessmentYear: "2025-26",
				regime: "new",
				entityType: "individual",
				ageCategory: "below_60",
				salary: {
					basicSalary: 600000,
					dearnessAllowance: 100000,
					hraReceived: 100000,
					specialAllowance: 200000,
					rentPaidPerYear: 0,
					isMetroCity: false,
					ltaReceived: 0,
					employerNps80CCD2: 0,
					otherAllowances: 0,
					perquisites: 0,
					professionalTax: 0,
				},
			};

			const res = indianTaxCalculator.calculateComprehensive(req);
			expect(res.success).toBe(true);
			expect(res.data.grossSalary).toBe(1000000);
			expect(res.data.salaryStandardDeduction).toBe(75000);
			expect(res.data.netSalaryIncome).toBe(925000);
			expect(res.data.totalTaxableIncome).toBe(925000);

			// Slab calculation for 925,000:
			// 0-3L: Nil
			// 3-7L (4L @ 5%): ₹20,000
			// 7-9.25L (2.25L @ 10%): ₹22,500
			// Total Normal Tax: ₹42,500
			expect(res.data.normalSlabTax).toBe(42500);
			expect(res.data.rebateSection87A).toBe(0); // Above 7L

			// Cess: 4% of 42,500 = 1,700
			expect(res.data.healthAndEducationCess).toBe(1700);
			expect(res.data.totalTaxLiability).toBe(44200);
			expect(res.data.slabBreakdown.length).toBeGreaterThan(0);
		});

		it("awards full Section 87A rebate for income up to ₹7,00,000 in AY 2025-26", () => {
			const req: TaxCalculationRequest = {
				assessmentYear: "2025-26",
				regime: "new",
				entityType: "individual",
				ageCategory: "below_60",
				salary: {
					basicSalary: 500000,
					dearnessAllowance: 75000,
					hraReceived: 50000,
					specialAllowance: 150000, // Gross = 775,000
					rentPaidPerYear: 0,
					isMetroCity: false,
					ltaReceived: 0,
					employerNps80CCD2: 0,
					otherAllowances: 0,
					perquisites: 0,
					professionalTax: 0,
				},
			};

			const res = indianTaxCalculator.calculateComprehensive(req);
			// Gross 775,000 - 75,000 standard deduction = 700,000 taxable
			expect(res.data.totalTaxableIncome).toBe(700000);
			// Tax before rebate: 20,000
			expect(res.data.normalSlabTax).toBe(20000);
			// 87A rebate wipes out full tax
			expect(res.data.rebateSection87A).toBe(20000);
			expect(res.data.totalTaxLiability).toBe(0);
		});
	});

	// ─── 3. AY 2026-27 (Budget 2025) Slabs & ₹12L Rebate ──────────────────────
	describe("3. AY 2026-27 New Regime Slabs & ₹12L Exemption", () => {
		it("awards full ₹60,000 Section 87A rebate for ₹12.75L salary (₹12L taxable)", () => {
			const req: TaxCalculationRequest = {
				assessmentYear: "2026-27",
				regime: "new",
				entityType: "individual",
				ageCategory: "below_60",
				salary: {
					basicSalary: 800000,
					dearnessAllowance: 150000,
					hraReceived: 100000,
					specialAllowance: 225000, // Gross = 1,275,000
					rentPaidPerYear: 0,
					isMetroCity: false,
					ltaReceived: 0,
					employerNps80CCD2: 0,
					otherAllowances: 0,
					perquisites: 0,
					professionalTax: 0,
				},
			};

			const res = indianTaxCalculator.calculateComprehensive(req);
			// Gross 1,275,000 - 75,000 = 1,200,000 taxable
			expect(res.data.totalTaxableIncome).toBe(1200000);
			// 4-8L @ 5% = 20,000
			// 8-12L @ 10% = 40,000
			// Total before rebate = 60,000
			expect(res.data.normalSlabTax).toBe(60000);
			// Under AY 2026-27, 87A rebate is ₹60,000 for income up to 12L!
			expect(res.data.rebateSection87A).toBe(60000);
			expect(res.data.totalTaxLiability).toBe(0);
		});
	});

	// ─── 4. Capital Gains & Special Rates ─────────────────────────────────────
	describe("4. Capital Gains Special Rate Ingestion", () => {
		it("applies Section 111A (20%) and Section 112A (12.5% on >₹1.25L) in AY 2025-26", () => {
			const req: TaxCalculationRequest = {
				assessmentYear: "2025-26",
				regime: "new",
				entityType: "individual",
				ageCategory: "below_60",
				salary: {
					basicSalary: 600000,
					dearnessAllowance: 0,
					hraReceived: 0,
					specialAllowance: 0,
					rentPaidPerYear: 0,
					isMetroCity: false,
					ltaReceived: 0,
					employerNps80CCD2: 0,
					otherAllowances: 0,
					perquisites: 0,
					professionalTax: 0,
				},
				capitalGains: {
					stcgEquity111A: 50000, // 20% = ₹10,000
					ltcgEquity112A: 225000, // Exemption 1.25L -> 100,000 @ 12.5% = ₹12,500
					stcgSlabRate: 0,
					ltcgNormal20: 0,
					ltcgNormal12_5: 0,
				},
			};

			const res = indianTaxCalculator.calculateComprehensive(req);
			expect(res.data.netCapitalGainsIncome).toBe(275000);
			// Special rate tax = 10,000 (111A) + 12,500 (112A) = 22,500
			expect(res.data.specialRateTax).toBe(22500);
		});
	});

	// ─── 5. Advance Tax Default & Section 234A/B/C Penalties ───────────────────
	describe("5. Advance Tax & Section 234 Penalties", () => {
		it("computes 234B and 234C interest when high earner defaults on advance tax", () => {
			const req: TaxCalculationRequest = {
				assessmentYear: "2025-26",
				regime: "new",
				entityType: "individual",
				ageCategory: "below_60",
				salary: {
					basicSalary: 2000000,
					dearnessAllowance: 0,
					hraReceived: 0,
					specialAllowance: 0,
					rentPaidPerYear: 0,
					isMetroCity: false,
					ltaReceived: 0,
					employerNps80CCD2: 0,
					otherAllowances: 0,
					perquisites: 0,
					professionalTax: 0,
				},
				taxesPaid: {
					tdsSalary: 0,
					tdsOtherThanSalary: 0,
					tcsDeducted: 0,
					advanceTaxQ1: 0,
					advanceTaxQ2: 0,
					advanceTaxQ3: 0,
					advanceTaxQ4: 0,
					selfAssessmentTax: 0,
				},
			};

			const res = indianTaxCalculator.calculateComprehensive(req);
			expect(res.data.totalTaxLiability).toBeGreaterThan(10000);
			expect(res.data.interestSec234C).toBeGreaterThan(0);
			expect(res.data.interestSec234B).toBeGreaterThan(0);
			expect(res.data.totalInterestPenalties).toBeGreaterThan(0);
			expect(res.data.netTaxPayable).toBe(res.data.totalTaxAndInterest);
		});
	});

	// ─── 6. Regime Comparison & Break-Even Analysis ───────────────────────────
	describe("6. Regime Comparison & Decision Support", () => {
		it("recommends New Regime for salary with minimal deductions and calculates break-even", () => {
			const req: TaxCalculationRequest = {
				assessmentYear: "2025-26",
				regime: "new",
				entityType: "individual",
				ageCategory: "below_60",
				salary: {
					basicSalary: 1200000,
					dearnessAllowance: 0,
					hraReceived: 0,
					specialAllowance: 0,
					rentPaidPerYear: 0,
					isMetroCity: false,
					ltaReceived: 0,
					employerNps80CCD2: 0,
					otherAllowances: 0,
					perquisites: 0,
					professionalTax: 0,
				},
				deductions: {
					section80C: 50000,
					section80DSelf: 15000,
					section80DParents: 0,
					isParentsSeniorCitizen: false,
					section80CCD1B_NPS: 0,
					section80E_EducationLoan: 0,
					section80G_Donations: 0,
					section80TTA_Savings: 0,
					section80TTB_SeniorSavings: 0,
					otherDeductions: 0,
				},
			};

			const comparison = indianTaxCalculator.compareRegimes(req);
			expect(comparison.success).toBe(true);
			expect(comparison.recommendation.optimalRegime).toBe("new");
			expect(comparison.recommendation.savingsAmount).toBeGreaterThan(0);
			expect(comparison.recommendation.breakEvenDeductionRequired).toBeGreaterThan(0);
			expect(comparison.recommendation.advisoryNote).toContain("New Regime");
		});
	});

	// ─── 7. Telemetry Reporting ───────────────────────────────────────────────
	describe("7. Telemetry Reporting", () => {
		it("records calculation metrics in EngineTelemetryBus", () => {
			const status = telemetryBus.getStatus("indian-tax-calculator");
			expect(status.engineId).toBe("indian-tax-calculator");
			expect(status.category).toBe("Portfolio");
			expect(status.reportCount).toBeGreaterThan(0);
		});
	});
});
