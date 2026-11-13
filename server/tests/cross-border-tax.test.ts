/**
 * @file cross-border-tax.test.ts
 * @description Comprehensive Unit and Integration tests for FintekPro Cross-Border Indo-US Tax Engine:
 * 1. Residency Determination (IT Act Sec 6 ROR/RNOR/NR vs US IRC § 7701(b) SPT / Green Card)
 * 2. Foreign Financial Assets Compliance (US FBAR FinCEN 114 $10k & FATCA Form 8938 thresholds)
 * 3. PFIC (Passive Foreign Investment Company IRC §§ 1291-1298) Engine for Indian Mutual Funds
 * 4. Cross-Border Capital Gains & Foreign Tax Credit Bridge (Form 1116 § 904 Limit & Form 67)
 */

import { describe, it, expect } from "vitest";
import { crossBorderTaxService } from "../services/cross-border-tax-service";

describe("Cross-Border Tax Engine — Dual-Jurisdiction Residency Classifier", () => {
	it("should classify individual in India for 185 days as ROR and US Green Card holder as dual resident triggering DTAA Article 4", () => {
		const result = crossBorderTaxService.determineResidency({
			taxYear: 2025,
			daysInIndiaCurrentFY: 185,
			daysInIndiaPreceding4Years: 400,
			isIndianCitizenOrPIO: true,
			indianSourceIncomeInr: 2500000,
			isLiableToTaxInOtherCountry: true,
			isUsCitizen: false,
			isUsGreenCardHolder: true,
			daysInUsCurrentYear: 90,
			daysInUsYearMinus1: 120,
			daysInUsYearMinus2: 120,
		});

		expect(result.indianResidency.status).toBe("ROR");
		expect(result.indianResidency.globalIncomeTaxableInIndia).toBe(true);
		expect(result.usResidency.status).toBe("GREEN_CARD_HOLDER");
		expect(result.usResidency.globalIncomeTaxableInUS).toBe(true);
		expect(result.dtaaTieBreakerAdvice?.dualResident).toBe(true);
		expect(result.dtaaTieBreakerAdvice?.articleApplicable).toContain("Article 4");
	});

	it("should correctly classify Indian Citizen under 120-day high-income rule as RNOR", () => {
		const result = crossBorderTaxService.determineResidency({
			taxYear: 2025,
			daysInIndiaCurrentFY: 135, // Between 120 and 181
			daysInIndiaPreceding4Years: 420, // >= 365
			isIndianCitizenOrPIO: true,
			indianSourceIncomeInr: 2000000, // > ₹15 Lakhs
			isLiableToTaxInOtherCountry: true,
			isUsCitizen: false,
			isUsGreenCardHolder: false,
			daysInUsCurrentYear: 200,
			daysInUsYearMinus1: 180,
			daysInUsYearMinus2: 180,
		});

		expect(result.indianResidency.status).toBe("RNOR");
		expect(result.indianResidency.statutorySection).toContain("Explanation 1(b)");
		expect(result.indianResidency.globalIncomeTaxableInIndia).toBe(false);
	});

	it("should calculate US Substantial Presence Test correctly with weighted formula", () => {
		// Current: 140 days, Year -1: 120 days (1/3 = 40), Year -2: 60 days (1/6 = 10) => 140 + 40 + 10 = 190 days (>= 183)
		const result = crossBorderTaxService.determineResidency({
			taxYear: 2025,
			daysInIndiaCurrentFY: 45,
			daysInIndiaPreceding4Years: 100,
			isIndianCitizenOrPIO: true,
			indianSourceIncomeInr: 500000,
			isLiableToTaxInOtherCountry: true,
			isUsCitizen: false,
			isUsGreenCardHolder: false,
			daysInUsCurrentYear: 140,
			daysInUsYearMinus1: 120,
			daysInUsYearMinus2: 60,
		});

		expect(result.usResidency.status).toBe("RESIDENT_ALIEN");
		expect(result.usResidency.meetsSubstantialPresence).toBe(true);
		expect(result.usResidency.substantialPresenceDays).toBe(190);
		expect(result.indianResidency.status).toBe("NR");
	});

	it("should exempt F-1 student from Substantial Presence Test", () => {
		const result = crossBorderTaxService.determineResidency({
			taxYear: 2025,
			daysInIndiaCurrentFY: 30,
			daysInIndiaPreceding4Years: 800,
			isIndianCitizenOrPIO: true,
			indianSourceIncomeInr: 100000,
			isLiableToTaxInOtherCountry: true,
			isUsCitizen: false,
			isUsGreenCardHolder: false,
			daysInUsCurrentYear: 280,
			daysInUsYearMinus1: 280,
			daysInUsYearMinus2: 280,
			isF1OrJ1ExemptStudent: true,
		});

		expect(result.usResidency.status).toBe("NON_RESIDENT_ALIEN");
		expect(result.usResidency.meetsSubstantialPresence).toBe(false);
	});
});

describe("Cross-Border Tax Engine — US FBAR (FinCEN 114) & FATCA (Form 8938) Scanner", () => {
	it("should trigger mandatory FBAR filing when aggregate peak value exceeds $10,000", () => {
		const result = crossBorderTaxService.scanFbarFatca({
			calendarYear: 2024,
			filingStatus: "SINGLE_DOMESTIC",
			exchangeRateInrPerUsd: 86.50,
			accounts: [
				{
					institutionName: "HDFC Bank",
					accountType: "NRE_SAVINGS",
					accountNumberMasked: "XXXX-1234",
					currency: "INR",
					peakBalanceOriginalCurrency: 600000, // ~$6,936
					yearEndBalanceOriginalCurrency: 300000,
				},
				{
					institutionName: "ICICI Bank",
					accountType: "NRO_SAVINGS",
					accountNumberMasked: "XXXX-5678",
					currency: "INR",
					peakBalanceOriginalCurrency: 400000, // ~$4,624
					yearEndBalanceOriginalCurrency: 200000,
				},
			],
		});

		// Aggregate Peak = 600,000 + 400,000 = 1,000,000 INR / 86.50 = ~$11,560.69 (> $10k)
		expect(result.totalPeakForeignBalanceUsd).toBeGreaterThan(10000);
		expect(result.fbarFinCen114.isFilingRequired).toBe(true);
		expect(result.fbarFinCen114.dueDate).toContain("April 15, 2025");
		// But FATCA single domestic threshold is $50k year-end / $75k peak, so FATCA is NOT triggered
		expect(result.fatcaForm8938.isFilingRequired).toBe(false);
	});

	it("should trigger FATCA Form 8938 when balances exceed filing status threshold", () => {
		const result = crossBorderTaxService.scanFbarFatca({
			calendarYear: 2024,
			filingStatus: "SINGLE_DOMESTIC",
			exchangeRateInrPerUsd: 86.50,
			accounts: [
				{
					institutionName: "State Bank of India",
					accountType: "FCNR_DEPOSIT",
					accountNumberMasked: "XXXX-9999",
					currency: "USD",
					peakBalanceOriginalCurrency: 80000, // $80,000 (> $75,000 peak threshold)
					yearEndBalanceOriginalCurrency: 60000, // $60,000 (> $50,000 year-end threshold)
				},
			],
		});

		expect(result.fbarFinCen114.isFilingRequired).toBe(true);
		expect(result.fatcaForm8938.isFilingRequired).toBe(true);
		expect(result.fatcaForm8938.filingForm).toContain("IRS Form 8938");
	});
});

describe("Cross-Border Tax Engine — PFIC (IRC §§ 1291-1298) Assessment", () => {
	it("should detect Indian Mutual Funds as PFICs and compute Section 1291 tax & interest and Section 1296 MTM ordinary income", () => {
		const result = crossBorderTaxService.assessPficHoldings({
			calendarYear: 2024,
			isUsTaxPerson: true,
			exchangeRateInrPerUsd: 86.50,
			fundHoldings: [
				{
					fundName: "Parag Parikh Flexi Cap Fund",
					fundCategory: "EQUITY_MF",
					acquisitionDate: "2022-01-15",
					unitsHeld: 1500,
					totalCostInr: 1000000,
					currentFmvInr: 1600000,
					unrealizedGainInr: 600000, // ~ $6,936.42
					distributionsReceivedInr: 0,
				},
				{
					fundName: "HDFC Balanced Advantage Fund",
					fundCategory: "HYBRID_MF",
					acquisitionDate: "2022-06-10",
					unitsHeld: 2000,
					totalCostInr: 800000,
					currentFmvInr: 1050000,
					unrealizedGainInr: 250000, // ~ $2,890.17
					distributionsReceivedInr: 20000,
				},
			],
		});

		expect(result.form8621FilingMandatory).toBe(true);
		expect(result.fundAnalyses.length).toBe(2);
		expect(result.fundAnalyses[0].isPfic).toBe(true);
		expect(result.fundAnalyses[0].section1291ExcessDistributionTaxUsd).toBeGreaterThan(0);
		expect(result.fundAnalyses[0].section1291InterestChargeUsd).toBeGreaterThan(0);
		expect(result.fundAnalyses[0].section1296MtmOrdinaryIncomeUsd).toBe(result.fundAnalyses[0].unrealizedGainUsd);
		expect(result.actionableAdvisorRecommendations[0]).toContain("Form 8621");
	});
});

describe("Cross-Border Tax Engine — Foreign Tax Credit (FTC Form 1116 & Form 67 Bridge)", () => {
	it("should enforce IRC § 904 limitation fraction and compute allowable credit and carryover", () => {
		// Worldwide income: $150,000, Foreign passive income: $30,000 (20%)
		// US Tax Before Credits: $35,000
		// Max FTC Allowed = 20% of $35,000 = $7,000
		// Foreign Taxes Paid in India = ₹700,000 / 86.50 = ~$8,092.49
		// Allowable FTC = $7,000, Excess = ~$1,092.49
		const result = crossBorderTaxService.calculateForeignTaxCredit({
			taxYear: 2024,
			foreignPassiveIncomeUsd: 30000,
			totalTaxableIncomeUsd: 150000,
			usTaxBeforeCreditsUsd: 35000,
			foreignTaxesPaidInr: 700000,
			exchangeRateInrPerUsd: 86.50,
		});

		expect(result.ftcLimitationFraction).toBe(0.2);
		expect(result.ircSec904MaxCreditAllowedUsd).toBe(7000);
		expect(result.actualFtcClaimableUsd).toBe(7000);
		expect(result.excessForeignTaxesUsd).toBeGreaterThan(1000);
		expect(result.dtaaReliefClause).toContain("Article 25");
		expect(result.reportingForms).toContain("US IRS Form 1116 (Foreign Tax Credit — Passive Category Income)");
		expect(result.reportingForms).toContain("Indian ITD Form 67 (Statement of income from a country or specified territory outside India and Foreign Tax Credit claim u/s 90/90A/91)");
	});
});

describe("Cross-Border Tax Engine — CA Preparer Credentials & Circular 230 Practice Validation", () => {
	it("should validate a valid IRS PTIN and assign correct representation rights for US CPA and Enrolled Agent", () => {
		const cpaCheck = crossBorderTaxService.validatePreparerCredentials({
			role: "US_CPA",
			preparerName: "Rajesh Sharma, CA & CPA",
			ptin: "P12345678",
			efin: "123456",
			cpaStateLicense: "CPA-998877",
			cpaStateJurisdiction: "California",
		});

		expect(cpaCheck.isValid).toBe(true);
		expect(cpaCheck.ptinValidated).toBe(true);
		expect(cpaCheck.efinValidated).toBe(true);
		expect(cpaCheck.canSignAsPaidPreparer).toBe(true);
		expect(cpaCheck.canDirectlyEfile).toBe(true);
		expect(cpaCheck.representationRights).toBe("UNLIMITED");

		const unenrolledCheck = crossBorderTaxService.validatePreparerCredentials({
			role: "UNENROLLED_PREPARER_PTIN",
			preparerName: "Amit Verma, CA",
			ptin: "P87654321",
		});

		expect(unenrolledCheck.isValid).toBe(true);
		expect(unenrolledCheck.canSignAsPaidPreparer).toBe(true);
		expect(unenrolledCheck.canDirectlyEfile).toBe(false);
		expect(unenrolledCheck.representationRights).toBe("NONE");
	});

	it("should reject invalid PTIN formats and flag missing credentials", () => {
		const invalidPtinCheck = crossBorderTaxService.validatePreparerCredentials({
			role: "US_CPA",
			ptin: "INVALID_PTIN",
		});

		expect(invalidPtinCheck.isValid).toBe(false);
		expect(invalidPtinCheck.ptinValidated).toBe(false);
		expect(invalidPtinCheck.errors.some((e) => e.includes("Invalid IRS PTIN"))).toBe(true);
	});
});

describe("Cross-Border Tax Engine — US Tax Filing Package & Form 1040 Orchestration", () => {
	it("should compute full Form 1040 line-by-line figures, apply standard deduction & FTC, and produce Paid Preparer signature block", () => {
		const result = crossBorderTaxService.generateUsTaxFilingPackage({
			taxYear: 2024,
			taxpayer: {
				fullName: "Aditya Roy",
				maskedSsnOrItin: "XXX-XX-4321",
				filingStatus: "SINGLE",
				address: "San Jose, CA, USA",
			},
			preparer: {
				role: "UNENROLLED_PREPARER_PTIN",
				preparerName: "Pooja Mehta, CA",
				ptin: "P99887766",
				firmName: "Mehta & Associates Global Advisory",
			},
			income: {
				w2WagesUsd: 120000,
				federalWithholdingUsd: 18000,
				taxableInterestUsd: 3000, // US + Indian interest
				ordinaryDividendsUsd: 4000,
				shortTermCapitalGainsUsd: 5000,
				longTermCapitalGainsUsd: 15000,
			},
			foreignTaxCredit: {
				foreignPassiveIncomeUsd: 20000,
				foreignTaxesPaidInr: 250000, // ~ $2,890.17
				exchangeRateInrPerUsd: 86.50,
			},
		});

		// AGI = 120k + 3k + 4k + 5k + 15k = $147,000
		expect(result.computation.adjustedGrossIncome).toBe(147000);
		// Single 2024 Standard deduction = $14,600
		expect(result.computation.standardDeductionUsed).toBe(14600);
		// Taxable income = 147k - 14.6k = $132,400
		expect(result.computation.taxableIncome).toBe(132400);

		// Verified preliminary tax > 0
		expect(result.computation.preliminaryUsTax).toBeGreaterThan(20000);
		// Foreign Tax Credit claimed
		expect(result.computation.foreignTaxCreditClaimedUsd).toBeGreaterThan(2000);
		expect(result.computation.netUsTaxPayable).toBe(
			Math.round((result.computation.preliminaryUsTax - result.computation.foreignTaxCreditClaimedUsd) * 100) / 100
		);

		// Paid Preparer signature block verified
		expect(result.preparerStatus.isPaidPreparer).toBe(true);
		expect(result.preparerStatus.signatureBlock?.ptin).toBe("P99887766");
		expect(result.preparerStatus.signatureBlock?.preparerName).toBe("Pooja Mehta, CA");

		// Line-by-line Form 1040 guide
		expect(result.lineByLineForm1040.line1a_Wages).toBe(120000);
		expect(result.lineByLineForm1040.line11_AGI).toBe(147000);
		expect(result.lineByLineForm1040.line12_StandardOrItemizedDeduction).toBe(14600);
		expect(result.lineByLineForm1040.line15_TaxableIncome).toBe(132400);
		expect(result.lineByLineForm1040.schedule3_Line1_ForeignTaxCredit).toBe(result.computation.foreignTaxCreditClaimedUsd);

		// Cryptographic SHA-256 seal present
		expect(result.auditTrailHash).toMatch(/^[a-f0-9]{64}$/);
	});

	it("should generate client self-filing action instructions when no paid preparer is designated", () => {
		const result = crossBorderTaxService.generateUsTaxFilingPackage({
			taxYear: 2024,
			taxpayer: {
				fullName: "Sneha Patel",
				maskedSsnOrItin: "XXX-XX-7890",
				filingStatus: "MFJ",
				address: "Austin, TX, USA",
			},
			income: {
				w2WagesUsd: 180000,
				federalWithholdingUsd: 25000,
				taxableInterestUsd: 1000,
				ordinaryDividendsUsd: 2000,
				shortTermCapitalGainsUsd: 0,
				longTermCapitalGainsUsd: 0,
			},
		});

		expect(result.preparerStatus.isPaidPreparer).toBe(false);
		expect(result.filingInstructions.submissionMethod).toBe("TAXPAYER_SELF_FILE_ONLINE");
		expect(result.filingInstructions.instructions[0]).toContain("Line-by-Line Guide");
		expect(result.computation.standardDeductionUsed).toBe(29200); // MFJ Standard deduction
	});
});

describe("Cross-Border Tax Engine — Bilateral Dual-Sign Audit Pack (ICAI UDIN + US PTIN)", () => {
	it("should generate bilateral audit pack and verify alignment between Indian taxes and US FTC claim", () => {
		const result = crossBorderTaxService.generateBilateralAuditPack({
			taxYear: 2024,
			clientPanMasked: "ABCDE1234F",
			clientSsnMasked: "XXX-XX-9876",
			indianCaUdin: "24123456BKRT987654",
			indianCaMembership: "123456",
			usPreparerPtin: "P12345678",
			usPreparerRole: "ENROLLED_AGENT",
			indianNetTaxInr: 346000,
			usNetTaxUsd: 15400,
			dtaaReliefClaimedUsd: 4000, // 346,000 / 86.50 = 4,000 USD
			dtaaReliefClaimedInr: 346000,
			exchangeRateUsed: 86.50,
		});

		expect(result.packId).toContain("BILATERAL-AUDIT-2024");
		expect(result.bilateralSummary.isDtaaArticle25Aligned).toBe(true);
		expect(result.complianceCertifications.some((c) => c.includes("24123456BKRT987654"))).toBe(true);
		expect(result.complianceCertifications.some((c) => c.includes("P12345678"))).toBe(true);
		expect(result.verificationSealHash).toMatch(/^[a-f0-9]{64}$/);
	});
});

