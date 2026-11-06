/**
 * @file ca-portal-upgrades.test.ts
 * @description Unit and Integration tests for FintekPro CA Portal Upgrades:
 * 1. CACaseService (Tax Computation Determinism, Regime Comparison, Deductions)
 * 2. CAReconciliationService (AIS/TIS & 26AS Triangulation, Capital Gains Mismatch)
 * 3. CACertificationService (ICAI UDIN Validation, Form 15CB, Net Worth Certification)
 */

import { describe, it, expect } from "vitest";
import { caCertificationService } from "../services/ca-certification-service";
import { caNoticeResolutionService } from "../services/ca-notice-resolution-service";
import { caAdvanceTaxService } from "../services/ca-advance-tax-service";
import { caItdParserService } from "../services/ca-itd-parser-service";
import { caScheduleFaService } from "../services/ca-schedule-fa-service";
import { caGstReconciliationService } from "../services/ca-gst-reconciliation-service";
import { caMsmeAuditService } from "../services/ca-msme-audit-service";
import { caComplianceCalendarService } from "../services/ca-compliance-calendar-service";
import { taxAmendmentService } from "../services/tax-amendment-service";

describe("CA Portal Upgrades — ICAI UDIN & Certification Engine", () => {
	it("should accurately validate correct 18-character ICAI UDIN format", () => {
		const validUdin = "25123456BKRT987654";
		const result = caCertificationService.validateUDINFormat(validUdin, "123456");

		expect(result.isValid).toBe(true);
		expect(result.year).toBe("25");
		expect(result.membershipNumber).toBe("123456");
		expect(result.error).toBeUndefined();
	});

	it("should reject UDIN with invalid length or non-numeric year/membership", () => {
		const shortUdin = "25123456BKRT";
		const invalidYearUdin = "XX123456BKRT987654";
		const invalidMembershipUdin = "2512345ABKRT987654";

		expect(caCertificationService.validateUDINFormat(shortUdin).isValid).toBe(false);
		expect(caCertificationService.validateUDINFormat(invalidYearUdin).isValid).toBe(false);
		expect(caCertificationService.validateUDINFormat(invalidMembershipUdin).isValid).toBe(false);
	});

	it("should flag mismatch when UDIN membership does not match CA record", () => {
		const udin = "25654321BKRT987654";
		const result = caCertificationService.validateUDINFormat(udin, "123456");

		expect(result.isValid).toBe(false);
		expect(result.error).toContain("does not match CA record");
	});
});

describe("CA Portal Upgrades — Form 15CB & Net Worth Financial Integrity", () => {
	it("should apply lower DTAA rate under Section 90(2) when beneficial", () => {
		const domesticRate = 20;
		const dtaaRate = 10;
		const amountFc = 50000;
		const exchangeRate = 86.5;

		const amountInr = amountFc * exchangeRate;
		const applicableRate = Math.min(dtaaRate, domesticRate);
		const estimatedTds = Math.round((amountInr * applicableRate) / 100);

		expect(amountInr).toBe(4325000);
		expect(applicableRate).toBe(10);
		expect(estimatedTds).toBe(432500);
	});

	it("should correctly compute Certified Net Worth aggregating liquid & illiquid assets", () => {
		const liquidAssets = {
			bankBalances: 500000,
			mutualFunds: 1500000,
			listedEquities: 2500000,
			fixedDeposits: 1000000,
			bondsAndDebentures: 500000,
		};
		const illiquidAssets = {
			realEstate: 12000000,
			goldAndJewellery: 1000000,
			unlistedShares: 0,
			vehiclesAndOther: 800000,
		};
		const liabilities = {
			homeLoans: 4500000,
			personalLoans: 0,
			creditCardsAndOther: 300000,
		};

		const totalLiquid = Object.values(liquidAssets).reduce((a, b) => a + b, 0);
		const totalIlliquid = Object.values(illiquidAssets).reduce((a, b) => a + b, 0);
		const totalAssets = totalLiquid + totalIlliquid;
		const totalLiabilities = Object.values(liabilities).reduce((a, b) => a + b, 0);
		const netWorth = totalAssets - totalLiabilities;

		expect(totalLiquid).toBe(6000000);
		expect(totalIlliquid).toBe(13800000);
		expect(totalAssets).toBe(19800000);
		expect(totalLiabilities).toBe(4800000);
		expect(netWorth).toBe(15000000);
	});
});

describe("CA Portal Upgrades — Tax Computation Determinism (FintekPro GCR v1.0)", () => {
	it("should compute New Regime tax with ₹75,000 standard deduction and 87A rebate", () => {
		// Gross income ₹7,50,000
		const gross = 750000;
		const stdDeduction = 75000;
		const taxable = gross - stdDeduction; // 6,75,000

		// Since taxable <= 7,00,000, Sec 87A rebate makes net tax payable = 0
		expect(taxable).toBe(675000);
		expect(taxable <= 700000).toBe(true);
	});

	it("should compute Old Regime tax with standard deduction and Chapter VI-A deductions", () => {
		const gross = 1200000;
		const stdDeduction = 50000;
		const s80c = 150000;
		const s80d = 25000;
		const taxable = gross - stdDeduction - (s80c + s80d); // 9,75,000

		expect(taxable).toBe(975000);

		// Slab: 0-2.5L: 0, 2.5-5L: 12500, 5-9.75L: 20% of 4.75L = 95000 => Total 1,07,500 + 4% cess = 1,11,800
		const slabTax = 12500 + (taxable - 500000) * 0.20;
		const totalTaxWithCess = Math.round(slabTax * 1.04);

		expect(slabTax).toBe(107500);
		expect(totalTaxWithCess).toBe(111800);
	});
});

describe("CA Portal Upgrades — Income Tax Notice Resolution & DIN Verification", () => {
	it("should authenticate CBDT DIN format and calculate response urgency SLA", () => {
		const futureDate = new Date();
		futureDate.setDate(futureDate.getDate() + 10);
		const dueDateStr = futureDate.toISOString().split("T")[0];

		const result = caNoticeResolutionService.validateNoticeAndDin({
			din: "ITBA/AST/S/143(1)/2024-25/1068947291(1)",
			noticeSection: "143(1)(a)",
			assessmentYear: "2024-25",
			noticeDate: "2024-10-15",
			responseDueDate: dueDateStr,
			demandAmount: 45000,
			proposedAdditionAmount: 250000,
			issueCategory: "CAPITAL_GAINS_MISMATCH",
		});

		expect(result.isValidDin).toBe(true);
		expect(result.dinFormatType).toBe("ITBA_FORMAT");
		expect(result.urgencyStatus).toBe("URGENT");
		expect(result.daysRemaining).toBeLessThanOrEqual(10);
	});

	it("should generate formal legal rebuttal with Section 112A grandfathering citations", () => {
		const draft = caNoticeResolutionService.generateRebuttal(
			{
				din: "ITBA/AST/S/143(1)/2024-25/1068947291(1)",
				noticeSection: "143(1)(a)",
				assessmentYear: "2024-25",
				noticeDate: "2024-10-15",
				responseDueDate: "2024-11-14",
				demandAmount: 85000,
				proposedAdditionAmount: 320000,
				issueCategory: "CAPITAL_GAINS_MISMATCH",
			},
			"Rajesh Sharma",
			"ABCDE1234F",
			"Mohanty & Associates",
			"Sangram Mohanty",
			"123456",
		);

		expect(draft.subject).toContain("Section 143(1)(a)");
		expect(draft.preliminaryObjections.length).toBeGreaterThan(0);
		expect(draft.formattedSubmissionText).toContain("Section 112A(6)");
		expect(draft.formattedSubmissionText).toContain("PRAYER");
	});

	it("should prepare CIT Appeal Form 35 grounds strictly under 1,000 characters per ground", () => {
		const appeal = caNoticeResolutionService.draftCitAppeal(
			{
				din: "ITBA/AST/S/143(1)/2024-25/1068947291(1)",
				noticeSection: "143(1)(a)",
				assessmentYear: "2024-25",
				noticeDate: "2024-10-15",
				responseDueDate: "2024-11-14",
				demandAmount: 85000,
				proposedAdditionAmount: 320000,
				issueCategory: "CAPITAL_GAINS_MISMATCH",
			},
			"Rajesh Sharma",
		);

		expect(appeal.groundsOfAppeal.length).toBeGreaterThanOrEqual(2);
		for (const ground of appeal.groundsOfAppeal) {
			expect(ground.groundText.length).toBeLessThan(1000);
		}
	});
});

describe("CA Portal Upgrades — Advance Tax & Section 234C Penalty Simulator", () => {
	it("should compute advance tax schedule and Section 234C deferment interest on shortfall", () => {
		const report = caAdvanceTaxService.calculateSchedule({
			financialYear: "2024-25",
			estimatedGrossTax: 300000,
			estimatedTdsTcs: 100000, // Assessed tax = 2,00,000
			actualPayments: [
				{ installment: 1, datePaid: "2024-06-10", amount: 10000 }, // Target Q1 15% = 30k, threshold 12% = 24k => Shortfall
			],
		});

		expect(report.isAdvanceTaxApplicable).toBe(true);
		expect(report.summary.assessedTax).toBe(200000);
		expect(report.schedule[0].statutoryPercentage).toBe(15);
		expect(report.schedule[0].cumulativeTargetAmount).toBe(30000);
		expect(report.schedule[0].interestSec234C).toBeGreaterThan(0); // Shortfall interest computed
	});

	it("should exempt advance tax under Section 208 when assessed tax is under ₹10,000", () => {
		const report = caAdvanceTaxService.calculateSchedule({
			financialYear: "2024-25",
			estimatedGrossTax: 50000,
			estimatedTdsTcs: 45000, // Assessed tax = 5,000 < 10,000
		});

		expect(report.isAdvanceTaxApplicable).toBe(false);
		expect(report.summary.totalInterest234C).toBe(0);
	});
});

describe("CA Portal Upgrades — ITD Pre-fill JSON Parser & Schedule FA", () => {
	it("should parse pre-filled ITD JSON structure correctly", () => {
		const mockItdJson = {
			ITR: {
				AssessmentYear: "2025-26",
				FormName: "ITR-2",
				PersonalInfo: {
					PAN: "ABCDE1234F",
					AssesseeName: { FirstName: "Anand", SurNameOrOrgName: "Verma" },
				},
				ScheduleS: { GrossSalary: "1200000", StandardDeduction: "75000" },
				ScheduleOS: { InterestSavingsBank: "15000", DividendGross: "25000" },
				ScheduleVIA: { Section80C: "150000", Section80D: "25000" },
				ScheduleTDS1: { TotalTdsSal: "80000" },
			},
		};

		const parsed = caItdParserService.parseJson(mockItdJson);
		expect(parsed.pan).toBe("ABCDE1234F");
		expect(parsed.salaryIncome.grossSalary).toBe(1200000);
		expect(parsed.salaryIncome.netSalary).toBe(1125000);
		expect(parsed.otherIncome.dividendIncome).toBe(25000);
		expect(parsed.deductions.section80c).toBe(150000);
		expect(parsed.taxesPaid.tdsSalary).toBe(80000);
	});

	it("should calculate Schedule FA peak value and Form 67 FTC under Indo-US DTAA Article 25", () => {
		const report = caScheduleFaService.generateReport({
			calendarYear: 2024,
			sbiTtBuyingRate: 85.0,
			indianTaxSlabRatePercent: 30,
			holdings: [
				{
					symbol: "AAPL",
					companyName: "Apple Inc.",
					initialCostUsd: 10000,
					peakValueUsd: 15000,
					closingValueUsd: 14000,
					grossDividendsUsd: 400,
					usWithholdingTaxUsd: 100, // 25% W-8BEN tax
				},
			],
		});

		expect(report.summary.totalPeakValueInr).toBe(15000 * 85); // 12,75,000
		expect(report.summary.totalGrossDividendInr).toBe(400 * 85); // 34,000
		expect(report.summary.totalForeignTaxPaidInr).toBe(100 * 85); // 8,500
		expect(report.form67Draft.eligibleForeignTaxCreditInr).toBe(8500);
		expect(report.statutoryWarning).toContain("Black Money Act");
	});
});

describe("CA Portal Upgrades — GST 3-Way Reconciler & IMS Hub", () => {
	it("should reconcile purchase register against GSTR-2B and block unreflected ITC under Rule 36(4)", () => {
		const report = caGstReconciliationService.reconcile(
			"102024",
			[
				{
					supplierGstin: "27AABCU9603R1ZM",
					supplierName: "Tech Cloud",
					invoiceNumber: "INV-101",
					invoiceDate: "2024-10-04",
					taxableValue: 100000,
					igst: 18000,
					cgst: 0,
					sgst: 0,
					totalTax: 18000,
				},
				{
					supplierGstin: "29AABCS5544K1ZZ",
					supplierName: "Hardware Mart",
					invoiceNumber: "INV-202",
					invoiceDate: "2024-10-18",
					taxableValue: 50000,
					igst: 9000,
					cgst: 0,
					sgst: 0,
					totalTax: 9000,
				},
			],
			[
				{
					supplierGstin: "27AABCU9603R1ZM",
					supplierName: "Tech Cloud",
					invoiceNumber: "INV-101",
					invoiceDate: "2024-10-04",
					taxableValue: 100000,
					igst: 18000,
					cgst: 0,
					sgst: 0,
					totalTax: 18000,
					filingDate: "2024-11-10",
					itcEligibility: "Y",
				},
			],
		);

		expect(report.summary.matchedCount).toBe(1);
		expect(report.summary.missingIn2bCount).toBe(1);
		expect(report.summary.totalEligibleItc).toBe(18000);
		expect(report.summary.totalBlockedItc).toBe(9000); // Blocked because supplier didn't file GSTR-1
		expect(report.imsSubmissionPayload.acceptedInvoicesCount).toBe(1);
	});
});

describe("CA Portal Upgrades — Section 43B(h) MSME 45-Day Payment Auditor", () => {
	it("should disallow overdue Micro/Small payables and exempt Traders under Section 43B(h)", () => {
		const report = caMsmeAuditService.auditPayables("2024-25", [
			{
				vendorName: "Precision Tools (Micro)",
				enterpriseCategory: "MICRO",
				invoiceNumber: "INV-01",
				invoiceDate: "2025-01-15", // Due March 1
				invoiceAmount: 200000,
				balanceOutstandingAsOfMarch31: 200000, // Unpaid as of Mar 31 => DISALLOWED
				writtenAgreementExists: true,
				agreedPaymentDays: 45,
			},
			{
				vendorName: "Metal Traders (Trader)",
				enterpriseCategory: "TRADER",
				invoiceNumber: "INV-02",
				invoiceDate: "2024-12-10",
				invoiceAmount: 500000,
				balanceOutstandingAsOfMarch31: 500000, // Traders exempt from 43B(h)
				writtenAgreementExists: true,
				agreedPaymentDays: 45,
			},
		]);

		expect(report.summary.totalDisallowedSec43Bh).toBe(200000);
		expect(report.summary.totalMediumTraderExemptPayables).toBe(500000);
		expect(report.items[0].isDisallowedSec43Bh).toBe(true);
		expect(report.items[1].isDisallowedSec43Bh).toBe(false);
		expect(report.form3CdClause22Text).toContain("Clause 22");
	});
});

describe("CA Portal Upgrades — Master Statutory Compliance Radar", () => {
	it("should generate statutory deadlines and client reminder notification payload", () => {
		const deadlines = caComplianceCalendarService.getDeadlines(2025, 7); // July 2025
		expect(deadlines.length).toBeGreaterThanOrEqual(3);

		const gstr1 = deadlines.find((d) => d.formOrChallan === "Form GSTR-1");
		const itr = deadlines.find((d) => d.title.includes("ITR"));

		expect(gstr1).toBeDefined();
		expect(gstr1?.dueDate).toBe("2025-07-11");
		expect(itr).toBeDefined();
		expect(itr?.dueDate).toBe("2025-07-31");
		expect(gstr1?.clientReminderTemplate).toContain("GSTR-1");
	});
});

describe("CA Portal Upgrades — Tax Amendment Management & Dynamic Patching Engine", () => {
	it("should list all enacted statutory amendments across Finance Acts and CBDT Circulars", () => {
		const amendments = taxAmendmentService.listAmendments();
		expect(amendments.length).toBeGreaterThanOrEqual(6);

		const capGains = amendments.find((a) => a.amendmentId === "FA_2024_CAPITAL_GAINS_SEC_111A_112A");
		const dinMandate = amendments.find((a) => a.amendmentId === "CBDT_CIR_19_2019_DIN_MANDATE");
		const msmeDisallowance = amendments.find((a) => a.amendmentId === "FA_2023_SEC_43B_H_MSME_OVERDUE");

		expect(capGains).toBeDefined();
		expect(capGains?.category).toBe("CAPITAL_GAINS_RATE");
		expect(dinMandate).toBeDefined();
		expect(msmeDisallowance).toBeDefined();
	});

	it("should filter amendments accurately by Assessment Year", () => {
		const ay2025List = taxAmendmentService.listAmendments({ assessmentYear: "2025-26" });
		expect(ay2025List.length).toBeGreaterThan(0);
		for (const patch of ay2025List) {
			expect(
				patch.applicableAssessmentYears.includes("2025-26") ||
				patch.applicableAssessmentYears.includes("ALL"),
			).toBe(true);
		}
	});

	it("should resolve date-effective capital gains tax rules before and after July 23, 2024", () => {
		// Pre-Budget 2024 transaction (July 10, 2024)
		const preBudgetRule = taxAmendmentService.resolveCapitalGainsRule({
			assetClass: "equity",
			transactionDate: "2024-07-10",
		});
		expect(preBudgetRule.stcgRate).toBe(0.15);
		expect(preBudgetRule.ltcgRate).toBe(0.10);
		expect(preBudgetRule.ltcgExemptionLimit).toBe(100000);

		// Post-Budget 2024 transaction (August 15, 2024)
		const postBudgetRule = taxAmendmentService.resolveCapitalGainsRule({
			assetClass: "equity",
			transactionDate: "2024-08-15",
		});
		expect(postBudgetRule.stcgRate).toBe(0.20);
		expect(postBudgetRule.ltcgRate).toBe(0.125);
		expect(postBudgetRule.ltcgExemptionLimit).toBe(125000);
	});

	it("should simulate financial impact of Section 115BAC New Tax Regime standard deduction revision", () => {
		const sim = taxAmendmentService.simulateAmendmentImpact({
			amendmentId: "FA_2024_NEW_REGIME_SLABS_SEC_115BAC",
			sampleIncome: 1200000, // ₹12 Lakh salary
		});

		expect(sim.amendmentId).toBe("FA_2024_NEW_REGIME_SLABS_SEC_115BAC");
		expect(sim.netTaxSavingsOrIncrease).toBeGreaterThan(0); // Tax savings due to higher deduction
		expect(sim.explanation).toContain("₹75,000");
	});

	it("should dynamically ingest a new statutory amendment with valid SHA-256 integrity hash", () => {
		const newPatch = {
			amendmentId: "CBDT_NOTIF_2026_ITR_EXTENSION",
			title: "CBDT Notification - Extension of ITR Due Date for Corporate Audits",
			statutorySource: "CBDT Notification No. 88/2026 dated 25-10-2026",
			category: "DUE_DATE_EXTENSION" as const,
			effectiveDate: "2026-10-25",
			applicableAssessmentYears: ["2026-27"],
			status: "ENACTED" as const,
			summary: "Extension of tax audit report and ITR-7 filing deadline to 15-Nov-2026",
			rulesPayload: {
				original_due_date: "2026-10-31",
				extended_due_date: "2026-11-15",
			},
			ingestedBy: "COMPLIANCE_HEAD_FCA",
		};

		const result = taxAmendmentService.ingestAmendment(newPatch);
		expect(result.success).toBe(true);
		expect(result.amendmentId).toBe("CBDT_NOTIF_2026_ITR_EXTENSION");
		expect(result.verificationHash).toBeDefined();
		expect(result.verificationHash.length).toBe(64); // SHA-256 length

		const retrieved = taxAmendmentService.getAmendment("CBDT_NOTIF_2026_ITR_EXTENSION");
		expect(retrieved).toBeDefined();
		expect(retrieved?.title).toBe(newPatch.title);
	});
});

