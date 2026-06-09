// @ts-nocheck
/**
 * FEMA Compliance Service
 *
 * Implements comprehensive Foreign Exchange Management Act (FEMA) 1999 compliance for:
 * - RBI Purpose Code validation for outward remittances
 * - Liberalized Remittance Scheme (LRS) limit tracking ($250,000/FY)
 * - Tax Collected at Source (TCS) on foreign remittance per Finance Act 2023
 * - Authorized Dealer (AD) Bank integration and certificate generation
 * - RBI A2 Form generation for current account transactions
 *
 * Regulatory References:
 * - FEMA 1999 (Act No. 42 of 1999)
 * - RBI Master Direction on LRS (RBI/2015-16/267)
 * - Finance Act 2023 — Section 206C(1G) TCS rates effective October 1, 2023:
 *     • Investment-purpose LRS (portfolio, ODI, etc.): 20% above ₹7 lakh/FY
 *     • Education (own funds): 5% above ₹7 lakh/FY
 *     • Education (bank loan): 0.5% above ₹7 lakh/FY
 *     • Medical treatment: 5% above ₹7 lakh/FY
 *     • Tour packages: 5% below ₹7 lakh; 20% above ₹7 lakh/FY
 * - RBI A2 Form requirements for current account transactions
 * - CBDT Circular 10/2023 (TCS on LRS — IT Section 206C(1G) amendment)
 */

import { db } from "../db";
import { complianceAuditTrail } from "@shared/schema";
import { nanoid } from "nanoid";
import crypto from "crypto";

// ==================== RBI PURPOSE CODES ====================

export interface PurposeCode {
	code: string;
	description: string;
	category: "capital_account" | "current_account";
	subCategory: string;
	lrsApplicable: boolean;
	maxLimitUSD: number | null;
	form15caRequired: boolean;
	form15cbRequired: boolean;
	a2FormRequired: boolean;
	documentsRequired: string[];
	tcsApplicable: boolean;
	tcsRate: number;
}

const RBI_PURPOSE_CODES: Map<string, PurposeCode> = new Map([
	// Capital Account - Investment Purposes
	[
		"S0001",
		{
			code: "S0001",
			description:
				"Investment in equity shares of overseas company (under ODI)",
			category: "capital_account",
			subCategory: "Overseas Direct Investment",
			lrsApplicable: false,
			maxLimitUSD: null,
			form15caRequired: true,
			form15cbRequired: true,
			a2FormRequired: true,
			documentsRequired: [
				"Board Resolution",
				"ODI Form",
				"Valuation Report",
				"CA Certificate",
			],
			tcsApplicable: false,
			tcsRate: 0,
		},
	],
	[
		"S0002",
		{
			code: "S0002",
			description:
				"Investment in equity/debt securities abroad (Portfolio Investment under LRS)",
			category: "capital_account",
			subCategory: "Portfolio Investment",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: true,
			form15cbRequired: false,
			a2FormRequired: true,
			documentsRequired: [
				"Investment details",
				"PAN Card",
				"Address Proof",
				"LRS Declaration",
				"Form A2",
			],
			tcsApplicable: true,
			tcsRate: 20, // Finance Act 2023: 20% TCS above ₹7L for investment-purpose LRS (effective Oct 1, 2023)
		},
	],
	[
		"S0003",
		{
			code: "S0003",
			description: "Purchase of immovable property abroad",
			category: "capital_account",
			subCategory: "Real Estate",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: true,
			form15cbRequired: true,
			a2FormRequired: true,
			documentsRequired: ["Property Agreement", "Valuation Report", "PAN Card"],
			tcsApplicable: true,
			tcsRate: 20, // Finance Act 2023: 20% TCS above ₹7L
		},
	],

	// LRS - Personal Purposes
	[
		"S0004",
		{
			code: "S0004",
			description: "Gift to NRI/foreign national (close relatives)",
			category: "current_account",
			subCategory: "Gifts",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: true,
			form15cbRequired: false,
			a2FormRequired: true,
			documentsRequired: [
				"Relationship proof",
				"Recipient details",
				"PAN Card",
			],
			tcsApplicable: true,
			tcsRate: 20, // Finance Act 2023: 20% TCS above ₹7L
		},
	],
	[
		"S0005",
		{
			code: "S0005",
			description: "Donations to foreign institutions",
			category: "current_account",
			subCategory: "Donations",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: true,
			form15cbRequired: false,
			a2FormRequired: true,
			documentsRequired: ["Institution registration", "Donation purpose"],
			tcsApplicable: true,
			tcsRate: 20, // Finance Act 2023: 20% TCS above ₹7L
		},
	],

	// Education
	[
		"S0301",
		{
			code: "S0301",
			description: "Education - fees, hostel, living expenses (from own funds)",
			category: "current_account",
			subCategory: "Education",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: true,
			form15cbRequired: false,
			a2FormRequired: true,
			documentsRequired: [
				"Admission letter",
				"Fee structure",
				"Visa",
				"PAN Card",
			],
			tcsApplicable: true,
			tcsRate: 5, // Finance Act 2023: 5% TCS above ₹7L for education from own funds (not loan-funded)
		},
	],
	[
		"S0302",
		{
			code: "S0302",
			description: "Education - funded by loan from financial institution",
			category: "current_account",
			subCategory: "Education (Loan Funded)",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: true,
			form15cbRequired: false,
			a2FormRequired: true,
			documentsRequired: ["Admission letter", "Loan sanction letter", "Visa"],
			tcsApplicable: true,
			tcsRate: 0.5,
		},
	],

	// Medical
	[
		"S0304",
		{
			code: "S0304",
			description: "Medical treatment abroad",
			category: "current_account",
			subCategory: "Medical",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: true,
			form15cbRequired: false,
			a2FormRequired: true,
			documentsRequired: [
				"Medical visa",
				"Hospital estimate",
				"Doctor recommendation",
			],
			tcsApplicable: true,
			tcsRate: 5, // Finance Act 2023: 5% TCS above ₹7L for medical treatment
		},
	],

	// Travel
	[
		"S0305",
		{
			code: "S0305",
			description: "Business travel",
			category: "current_account",
			subCategory: "Travel",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: false,
			form15cbRequired: false,
			a2FormRequired: true,
			documentsRequired: ["Passport", "Visa", "Travel itinerary"],
			tcsApplicable: true,
			tcsRate: 20, // Finance Act 2023: 20% TCS above ₹7L (general travel, not tour package)
		},
	],
	[
		"S0306",
		{
			code: "S0306",
			description: "Private visit / tourism",
			category: "current_account",
			subCategory: "Travel",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: false,
			form15cbRequired: false,
			a2FormRequired: true,
			documentsRequired: ["Passport", "Visa", "Travel tickets"],
			tcsApplicable: true,
			tcsRate: 20, // Finance Act 2023: 20% TCS above ₹7L
		},
	],

	// Employment & Emigration
	[
		"S0307",
		{
			code: "S0307",
			description: "Employment abroad - initial expenses",
			category: "current_account",
			subCategory: "Employment",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: false,
			form15cbRequired: false,
			a2FormRequired: true,
			documentsRequired: ["Employment contract", "Work visa", "PAN Card"],
			tcsApplicable: true,
			tcsRate: 20, // Finance Act 2023: 20% TCS above ₹7L
		},
	],
	[
		"S0308",
		{
			code: "S0308",
			description: "Emigration expenses",
			category: "current_account",
			subCategory: "Emigration",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: false,
			form15cbRequired: false,
			a2FormRequired: true,
			documentsRequired: ["PR visa", "Emigration approval"],
			tcsApplicable: true,
			tcsRate: 20, // Finance Act 2023: 20% TCS above ₹7L
		},
	],

	// Maintenance of Relatives
	[
		"S0309",
		{
			code: "S0309",
			description: "Maintenance of close relatives abroad",
			category: "current_account",
			subCategory: "Maintenance",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: true,
			form15cbRequired: false,
			a2FormRequired: true,
			documentsRequired: [
				"Relationship proof",
				"Dependent details",
				"Purpose declaration",
			],
			tcsApplicable: true,
			tcsRate: 20, // Finance Act 2023: 20% TCS above ₹7L
		},
	],

	// Business/Trade Services
	[
		"S0501",
		{
			code: "S0501",
			description: "Trade-related remittances (imports)",
			category: "current_account",
			subCategory: "Trade",
			lrsApplicable: false,
			maxLimitUSD: null,
			form15caRequired: true,
			form15cbRequired: true,
			a2FormRequired: true,
			documentsRequired: ["Import invoice", "Bill of Entry", "IEC Code"],
			tcsApplicable: false,
			tcsRate: 0,
		},
	],
	[
		"S0502",
		{
			code: "S0502",
			description: "Technical/professional services",
			category: "current_account",
			subCategory: "Services",
			lrsApplicable: false,
			maxLimitUSD: null,
			form15caRequired: true,
			form15cbRequired: true,
			a2FormRequired: true,
			documentsRequired: ["Service agreement", "Invoice", "PAN of remitter"],
			tcsApplicable: false,
			tcsRate: 0,
		},
	],
	[
		"S0503",
		{
			code: "S0503",
			description: "Royalty payments",
			category: "current_account",
			subCategory: "Royalty",
			lrsApplicable: false,
			maxLimitUSD: null,
			form15caRequired: true,
			form15cbRequired: true,
			a2FormRequired: true,
			documentsRequired: [
				"Royalty agreement",
				"RBI approval if needed",
				"Invoice",
			],
			tcsApplicable: false,
			tcsRate: 0,
		},
	],

	// Overseas Tour Package
	[
		"S1107",
		{
			code: "S1107",
			description: "Overseas tour package purchase",
			category: "current_account",
			subCategory: "Tour Package",
			lrsApplicable: true,
			maxLimitUSD: 250000,
			form15caRequired: false,
			form15cbRequired: false,
			a2FormRequired: true,
			documentsRequired: ["Tour package details", "Passport", "Visa"],
			tcsApplicable: true,
			tcsRate: 5,
		},
	],
]);

// ==================== TYPES ====================

export interface LRSTransaction {
	id: string;
	userId: string;
	financialYear: string;
	transactionDate: Date;
	purposeCode: string;
	purposeDescription: string;
	amountINR: number;
	amountUSD: number;
	exchangeRate: number;
	beneficiaryName: string;
	beneficiaryCountry: string;
	beneficiaryBank: string;
	beneficiaryAccountNumber: string;
	swiftCode: string;
	adBankName: string;
	adBankBranch: string;
	adCode: string;
	form15caNumber?: string;
	form15cbNumber?: string;
	a2FormNumber?: string;
	tcsAmount: number;
	tcsRate: number;
	tcsPan?: string;
	status:
		| "draft"
		| "pending_ad_approval"
		| "approved"
		| "remitted"
		| "rejected";
	remarks?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface LRSLimitStatus {
	userId: string;
	financialYear: string;
	totalRemittedUSD: number;
	remainingLimitUSD: number;
	limitUSD: number;
	utilizationPercentage: number;
	transactions: LRSTransaction[];
	alerts: LRSAlert[];
	lastUpdated: Date;
}

export interface LRSAlert {
	type:
		| "threshold_50"
		| "threshold_75"
		| "threshold_90"
		| "limit_exceeded"
		| "tcs_threshold";
	message: string;
	triggeredAt: Date;
	acknowledged: boolean;
}

export interface TCSCalculation {
	remittanceAmountINR: number;
	financialYearUtilization: number;
	tcsThresholdINR: number;
	amountAboveThreshold: number;
	applicableRate: number;
	tcsAmount: number;
	breakdown: {
		belowThreshold: number;
		aboveThreshold: number;
		rateBelow: number;
		rateAbove: number;
	};
	educationLoanFunded: boolean;
	medicalOrEducation: boolean;
}

export interface A2FormData {
	formNumber: string;
	transactionId: string;
	applicantDetails: {
		name: string;
		pan: string;
		address: string;
		email: string;
		phone: string;
	};
	remittanceDetails: {
		purposeCode: string;
		purposeDescription: string;
		amountINR: number;
		amountFCY: number;
		currency: string;
		exchangeRate: number;
	};
	beneficiaryDetails: {
		name: string;
		address: string;
		country: string;
		bankName: string;
		bankAddress: string;
		accountNumber: string;
		swiftCode: string;
		iban?: string;
	};
	adBankDetails: {
		bankName: string;
		branchName: string;
		adCode: string;
		branchAddress: string;
	};
	declarations: {
		lrsCompliance: boolean;
		taxCompliance: boolean;
		femaCompliance: boolean;
		panVerified: boolean;
	};
	generatedAt: Date;
	status: "draft" | "generated" | "submitted" | "acknowledged";
	documentHash?: string;
}

export interface ADCertificate {
	certificateNumber: string;
	transactionId: string;
	adBankName: string;
	adBankBranch: string;
	adCode: string;
	applicantName: string;
	applicantPan: string;
	purposeCode: string;
	remittanceAmountUSD: number;
	remittanceAmountINR: number;
	exchangeRate: number;
	beneficiaryDetails: string;
	lrsUtilization: number;
	tcsDeducted: number;
	issuedAt: Date;
	validUntil: Date;
	status: "active" | "used" | "expired" | "cancelled";
	documentHash: string;
}

// ==================== SERVICE CLASS ====================

class FEMAComplianceService {
	private readonly LRS_LIMIT_USD = 250000;
	private readonly TCS_THRESHOLD_INR = 700000;
	// Finance Act 2023 — Section 206C(1G) rates (effective October 1, 2023)
	private readonly TCS_RATE_STANDARD = 5; // below ₹7L threshold (generally 0 for investments — AD bank collects)
	private readonly TCS_RATE_ABOVE_THRESHOLD = 20; // FIXED: was 10%; Finance Act 2023 raised to 20% for investment-purpose LRS
	private readonly TCS_RATE_EDUCATION_LOAN = 0.5; // education via bank loan: 0.5% above ₹7L
	private readonly TCS_RATE_EDUCATION_SELF = 5; // education via own funds: 5% above ₹7L
	private readonly TCS_RATE_MEDICAL = 5; // medical treatment: 5% above ₹7L
	private readonly TCS_RATE_EDUCATION_MEDICAL = 0.5; // legacy alias (loan-funded education)
	private readonly TCS_RATE_TOUR_PACKAGE = 5; // tour packages: 5% below ₹7L
	private readonly TCS_RATE_TOUR_ABOVE_THRESHOLD = 20; // tour packages: 20% above ₹7L

	private transactions: Map<string, LRSTransaction[]> = new Map();
	private a2Forms: Map<string, A2FormData> = new Map();
	private adCertificates: Map<string, ADCertificate> = new Map();

	constructor() {
		console.log("✅ FEMA Compliance Service initialized");
		console.log(`   LRS Limit: $${this.LRS_LIMIT_USD.toLocaleString()}/FY`);
		console.log(
			`   TCS Threshold: ₹${this.TCS_THRESHOLD_INR.toLocaleString()}`,
		);
	}

	// ==================== PURPOSE CODE VALIDATION ====================

	getPurposeCode(code: string): PurposeCode | undefined {
		return RBI_PURPOSE_CODES.get(code);
	}

	getAllPurposeCodes(): PurposeCode[] {
		return Array.from(RBI_PURPOSE_CODES.values());
	}

	getPurposeCodesByCategory(
		category: "capital_account" | "current_account",
	): PurposeCode[] {
		return this.getAllPurposeCodes().filter((pc) => pc.category === category);
	}

	validatePurposeCode(
		code: string,
		amountUSD: number,
	): { valid: boolean; errors: string[]; warnings: string[] } {
		const purposeCode = this.getPurposeCode(code);
		const errors: string[] = [];
		const warnings: string[] = [];

		if (!purposeCode) {
			errors.push(`Invalid RBI purpose code: ${code}`);
			return { valid: false, errors, warnings };
		}

		if (
			purposeCode.lrsApplicable &&
			purposeCode.maxLimitUSD &&
			amountUSD > purposeCode.maxLimitUSD
		) {
			errors.push(
				`Amount exceeds LRS limit of $${purposeCode.maxLimitUSD.toLocaleString()} for purpose code ${code}`,
			);
		}

		if (purposeCode.form15cbRequired) {
			warnings.push(
				"Form 15CB (CA Certificate) is required for this remittance",
			);
		}

		if (purposeCode.a2FormRequired) {
			warnings.push("RBI A2 Form submission is mandatory");
		}

		if (purposeCode.documentsRequired.length > 3) {
			warnings.push(
				`Multiple documents required: ${purposeCode.documentsRequired.join(", ")}`,
			);
		}

		return { valid: errors.length === 0, errors, warnings };
	}

	// ==================== LRS LIMIT TRACKING ====================

	async getLRSStatus(
		userId: string,
		financialYear?: string,
	): Promise<LRSLimitStatus> {
		const fy = financialYear || this.getCurrentFinancialYear();
		const userTransactions = this.transactions.get(userId) || [];
		const fyTransactions = userTransactions.filter(
			(t) => t.financialYear === fy && t.status === "remitted",
		);

		const totalRemittedUSD = fyTransactions.reduce(
			(sum, t) => sum + t.amountUSD,
			0,
		);
		const remainingLimitUSD = Math.max(
			0,
			this.LRS_LIMIT_USD - totalRemittedUSD,
		);
		const utilizationPercentage = (totalRemittedUSD / this.LRS_LIMIT_USD) * 100;

		const alerts: LRSAlert[] = [];

		if (utilizationPercentage >= 90) {
			alerts.push({
				type: "threshold_90",
				message: `LRS utilization at ${utilizationPercentage.toFixed(1)}%. Only $${remainingLimitUSD.toLocaleString()} remaining.`,
				triggeredAt: new Date(),
				acknowledged: false,
			});
		} else if (utilizationPercentage >= 75) {
			alerts.push({
				type: "threshold_75",
				message: `LRS utilization at ${utilizationPercentage.toFixed(1)}%. Consider planning remaining remittances.`,
				triggeredAt: new Date(),
				acknowledged: false,
			});
		} else if (utilizationPercentage >= 50) {
			alerts.push({
				type: "threshold_50",
				message: `LRS utilization at ${utilizationPercentage.toFixed(1)}%. Half of annual limit utilized.`,
				triggeredAt: new Date(),
				acknowledged: false,
			});
		}

		if (totalRemittedUSD > this.LRS_LIMIT_USD) {
			alerts.push({
				type: "limit_exceeded",
				message: `LRS limit exceeded! Total remittances: $${totalRemittedUSD.toLocaleString()}. RBI approval required.`,
				triggeredAt: new Date(),
				acknowledged: false,
			});
		}

		return {
			userId,
			financialYear: fy,
			totalRemittedUSD,
			remainingLimitUSD,
			limitUSD: this.LRS_LIMIT_USD,
			utilizationPercentage,
			transactions: fyTransactions,
			alerts,
			lastUpdated: new Date(),
		};
	}

	async checkLRSEligibility(
		userId: string,
		proposedAmountUSD: number,
	): Promise<{
		eligible: boolean;
		remainingLimit: number;
		shortfall: number;
		requiresRBIApproval: boolean;
		message: string;
	}> {
		const status = await this.getLRSStatus(userId);
		const eligible = proposedAmountUSD <= status.remainingLimitUSD;
		const shortfall = eligible
			? 0
			: proposedAmountUSD - status.remainingLimitUSD;

		return {
			eligible,
			remainingLimit: status.remainingLimitUSD,
			shortfall,
			requiresRBIApproval: !eligible,
			message: eligible
				? `Eligible for remittance. Remaining LRS limit: $${status.remainingLimitUSD.toLocaleString()}`
				: `Exceeds LRS limit by $${shortfall.toLocaleString()}. RBI approval required under FEMA route.`,
		};
	}

	// ==================== TCS CALCULATION ====================

	calculateTCS(
		remittanceAmountINR: number,
		fyUtilizationINR: number,
		purposeCode: string,
		isEducationLoanFunded: boolean = false,
	): TCSCalculation {
		const purpose = this.getPurposeCode(purposeCode);
		const subCat = purpose?.subCategory ?? "";

		// Finance Act 2023 — Section 206C(1G) — Classify remittance purpose
		const isEducationLoanFundedPurpose =
			subCat === "Education (Loan Funded)" || isEducationLoanFunded;
		const isEducationSelfFunded =
			subCat === "Education" && !isEducationLoanFundedPurpose;
		const isMedical = subCat === "Medical";
		const isTourPackage = subCat === "Tour Package";
		// Any other purpose (portfolio investment, ODI, gifts, etc.) → 20% above ₹7L
		const isInvestmentPurpose =
			!isEducationLoanFundedPurpose &&
			!isEducationSelfFunded &&
			!isMedical &&
			!isTourPackage;

		const belowThreshold = Math.max(
			0,
			Math.min(remittanceAmountINR, this.TCS_THRESHOLD_INR - fyUtilizationINR),
		);
		const aboveThreshold = Math.max(0, remittanceAmountINR - belowThreshold);

		let rateBelow = 0;
		let rateAbove = this.TCS_RATE_ABOVE_THRESHOLD; // default 20% for investment

		if (isEducationLoanFundedPurpose) {
			// Education via bank loan: 0.5% only above ₹7L threshold
			rateBelow = 0;
			rateAbove = this.TCS_RATE_EDUCATION_LOAN; // 0.5%
		} else if (isEducationSelfFunded) {
			// Education from own funds: 5% above ₹7L (Finance Act 2023)
			rateBelow = 0;
			rateAbove = this.TCS_RATE_EDUCATION_SELF; // 5%
		} else if (isMedical) {
			// Medical treatment abroad: 5% above ₹7L
			rateBelow = 0;
			rateAbove = this.TCS_RATE_MEDICAL; // 5%
		} else if (isTourPackage) {
			// Tour packages: 5% below ₹7L, 20% above ₹7L
			rateBelow = this.TCS_RATE_TOUR_PACKAGE; // 5%
			rateAbove = this.TCS_RATE_TOUR_ABOVE_THRESHOLD; // 20%
		} else {
			// Investment purposes (portfolio, ODI, gifts, maintenance): 20% above ₹7L
			// Finance Act 2023 — no TCS below ₹7L per FY for investment purposes
			rateBelow = 0;
			rateAbove = this.TCS_RATE_ABOVE_THRESHOLD; // 20%
		}

		const tcsBelow = (belowThreshold * rateBelow) / 100;
		const tcsAbove = (aboveThreshold * rateAbove) / 100;
		const totalTCS = tcsBelow + tcsAbove;
		const medicalOrEducation =
			isMedical || isEducationSelfFunded || isEducationLoanFundedPurpose;

		return {
			remittanceAmountINR,
			financialYearUtilization: fyUtilizationINR,
			tcsThresholdINR: this.TCS_THRESHOLD_INR,
			amountAboveThreshold: aboveThreshold,
			applicableRate: aboveThreshold > 0 ? rateAbove : rateBelow,
			tcsAmount: Math.round(totalTCS),
			breakdown: {
				belowThreshold,
				aboveThreshold,
				rateBelow,
				rateAbove,
			},
			educationLoanFunded: isEducationLoanFundedPurpose,
			medicalOrEducation,
		};
	}

	// ==================== A2 FORM GENERATION ====================

	async generateA2Form(
		transactionId: string,
		data: Omit<
			A2FormData,
			"formNumber" | "generatedAt" | "status" | "documentHash"
		>,
	): Promise<A2FormData> {
		const formNumber = `A2-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;

		const a2Form: A2FormData = {
			...data,
			formNumber,
			generatedAt: new Date(),
			status: "generated",
			documentHash: this.generateDocumentHash(data),
		};

		this.a2Forms.set(formNumber, a2Form);

		await this.logAudit(
			"a2_form",
			formNumber,
			"generate",
			data.applicantDetails.pan,
			{
				transactionId,
				purposeCode: data.remittanceDetails.purposeCode,
				amountINR: data.remittanceDetails.amountINR,
			},
		);

		return a2Form;
	}

	async getA2Form(formNumber: string): Promise<A2FormData | undefined> {
		return this.a2Forms.get(formNumber);
	}

	async submitA2Form(
		formNumber: string,
	): Promise<{
		success: boolean;
		acknowledgementNumber?: string;
		error?: string;
	}> {
		const form = this.a2Forms.get(formNumber);
		if (!form) {
			return { success: false, error: "A2 Form not found" };
		}

		if (form.status !== "generated") {
			return {
				success: false,
				error: `Cannot submit form in ${form.status} status`,
			};
		}

		form.status = "submitted";
		const acknowledgementNumber = `ACK-${Date.now()}-${nanoid(6)}`;

		await this.logAudit(
			"a2_form",
			formNumber,
			"submit",
			form.applicantDetails.pan,
			{
				acknowledgementNumber,
			},
		);

		return { success: true, acknowledgementNumber };
	}

	// ==================== AD BANK CERTIFICATE ====================

	async generateADCertificate(
		transactionId: string,
		userId: string,
		data: {
			adBankName: string;
			adBankBranch: string;
			adCode: string;
			applicantName: string;
			applicantPan: string;
			purposeCode: string;
			remittanceAmountUSD: number;
			remittanceAmountINR: number;
			exchangeRate: number;
			beneficiaryDetails: string;
			tcsDeducted: number;
		},
	): Promise<ADCertificate> {
		const lrsStatus = await this.getLRSStatus(userId);
		const certificateNumber = `ADC-${data.adCode}-${Date.now()}-${nanoid(6)}`;

		const certificate: ADCertificate = {
			certificateNumber,
			transactionId,
			adBankName: data.adBankName,
			adBankBranch: data.adBankBranch,
			adCode: data.adCode,
			applicantName: data.applicantName,
			applicantPan: data.applicantPan,
			purposeCode: data.purposeCode,
			remittanceAmountUSD: data.remittanceAmountUSD,
			remittanceAmountINR: data.remittanceAmountINR,
			exchangeRate: data.exchangeRate,
			beneficiaryDetails: data.beneficiaryDetails,
			lrsUtilization: lrsStatus.totalRemittedUSD + data.remittanceAmountUSD,
			tcsDeducted: data.tcsDeducted,
			issuedAt: new Date(),
			validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
			status: "active",
			documentHash: this.generateDocumentHash(data),
		};

		this.adCertificates.set(certificateNumber, certificate);

		await this.logAudit(
			"ad_certificate",
			certificateNumber,
			"issue",
			data.applicantPan,
			{
				transactionId,
				purposeCode: data.purposeCode,
				amountUSD: data.remittanceAmountUSD,
				lrsUtilization: certificate.lrsUtilization,
			},
		);

		return certificate;
	}

	async getADCertificate(
		certificateNumber: string,
	): Promise<ADCertificate | undefined> {
		return this.adCertificates.get(certificateNumber);
	}

	async validateADCertificate(certificateNumber: string): Promise<{
		valid: boolean;
		certificate?: ADCertificate;
		errors: string[];
	}> {
		const certificate = this.adCertificates.get(certificateNumber);
		const errors: string[] = [];

		if (!certificate) {
			return { valid: false, errors: ["AD Certificate not found"] };
		}

		if (certificate.status === "expired") {
			errors.push("Certificate has expired");
		}

		if (certificate.status === "cancelled") {
			errors.push("Certificate has been cancelled");
		}

		if (certificate.status === "used") {
			errors.push("Certificate has already been used");
		}

		if (new Date() > certificate.validUntil) {
			certificate.status = "expired";
			errors.push("Certificate validity period has ended");
		}

		return {
			valid: errors.length === 0,
			certificate,
			errors,
		};
	}

	// ==================== TRANSACTION RECORDING ====================

	async recordTransaction(
		transaction: Omit<LRSTransaction, "id" | "createdAt" | "updatedAt">,
	): Promise<LRSTransaction> {
		const newTransaction: LRSTransaction = {
			...transaction,
			id: nanoid(),
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		const userTransactions = this.transactions.get(transaction.userId) || [];
		userTransactions.push(newTransaction);
		this.transactions.set(transaction.userId, userTransactions);

		await this.logAudit(
			"lrs_transaction",
			newTransaction.id,
			"create",
			transaction.userId,
			{
				purposeCode: transaction.purposeCode,
				amountUSD: transaction.amountUSD,
				beneficiaryCountry: transaction.beneficiaryCountry,
			},
		);

		return newTransaction;
	}

	async updateTransactionStatus(
		transactionId: string,
		userId: string,
		status: LRSTransaction["status"],
		remarks?: string,
	): Promise<LRSTransaction | null> {
		const userTransactions = this.transactions.get(userId);
		if (!userTransactions) return null;

		const transaction = userTransactions.find((t) => t.id === transactionId);
		if (!transaction) return null;

		const previousStatus = transaction.status;
		transaction.status = status;
		transaction.remarks = remarks;
		transaction.updatedAt = new Date();

		await this.logAudit(
			"lrs_transaction",
			transactionId,
			"status_change",
			userId,
			{
				previousStatus,
				newStatus: status,
				remarks,
			},
		);

		return transaction;
	}

	// ==================== HELPER METHODS ====================

	private getCurrentFinancialYear(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth();
		return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
	}

	private generateDocumentHash(data: any): string {
		return crypto
			.createHash("sha256")
			.update(JSON.stringify(data) + Date.now())
			.digest("hex");
	}

	private async logAudit(
		type:
			| "purpose_validation"
			| "lrs_check"
			| "tcs_calc"
			| "a2_form"
			| "ad_certificate"
			| "transaction",
		id: string,
		action: string,
		userId: string,
		details: any,
	): Promise<void> {
		try {
			await db.insert(complianceAuditTrail).values({
				userId,
				action: `fema_${type}_${action}`,
				fieldChanged: type,
				entityId: id,
				entityType: "fema_compliance",
				newValue: details,
				performedBy: "fema_compliance_system",
				performedByRole: "compliance_system",
				riskImpact: "low",
				complianceImpact: "none",
				metadata: {
					...details,
					timestamp: new Date().toISOString(),
					service: "FEMAComplianceService",
				},
			});
		} catch (error) {
			console.error(`[FEMA Audit] Failed to log ${type} audit:`, error);
		}
	}

	// ==================== COMPLIANCE REPORTS ====================

	async generateComplianceReport(
		userId: string,
		financialYear?: string,
	): Promise<{
		userId: string;
		financialYear: string;
		lrsStatus: LRSLimitStatus;
		transactionSummary: {
			totalTransactions: number;
			totalRemittedUSD: number;
			totalRemittedINR: number;
			totalTCSPaid: number;
			byPurpose: Record<string, { count: number; amountUSD: number }>;
			byCountry: Record<string, { count: number; amountUSD: number }>;
		};
		complianceStatus: {
			lrsCompliant: boolean;
			form15caCompliant: boolean;
			form15cbCompliant: boolean;
			a2FormCompliant: boolean;
			tcsCompliant: boolean;
			issues: string[];
		};
		generatedAt: Date;
	}> {
		const fy = financialYear || this.getCurrentFinancialYear();
		const lrsStatus = await this.getLRSStatus(userId, fy);
		const transactions = lrsStatus.transactions;

		const byPurpose: Record<string, { count: number; amountUSD: number }> = {};
		const byCountry: Record<string, { count: number; amountUSD: number }> = {};
		let totalRemittedINR = 0;
		let totalTCSPaid = 0;
		const issues: string[] = [];

		for (const t of transactions) {
			totalRemittedINR += t.amountINR;
			totalTCSPaid += t.tcsAmount;

			if (!byPurpose[t.purposeCode]) {
				byPurpose[t.purposeCode] = { count: 0, amountUSD: 0 };
			}
			byPurpose[t.purposeCode].count++;
			byPurpose[t.purposeCode].amountUSD += t.amountUSD;

			if (!byCountry[t.beneficiaryCountry]) {
				byCountry[t.beneficiaryCountry] = { count: 0, amountUSD: 0 };
			}
			byCountry[t.beneficiaryCountry].count++;
			byCountry[t.beneficiaryCountry].amountUSD += t.amountUSD;

			const purposeInfo = this.getPurposeCode(t.purposeCode);
			if (purposeInfo?.form15caRequired && !t.form15caNumber) {
				issues.push(`Transaction ${t.id}: Form 15CA missing`);
			}
			if (purposeInfo?.form15cbRequired && !t.form15cbNumber) {
				issues.push(`Transaction ${t.id}: Form 15CB missing`);
			}
			if (purposeInfo?.a2FormRequired && !t.a2FormNumber) {
				issues.push(`Transaction ${t.id}: A2 Form missing`);
			}
		}

		return {
			userId,
			financialYear: fy,
			lrsStatus,
			transactionSummary: {
				totalTransactions: transactions.length,
				totalRemittedUSD: lrsStatus.totalRemittedUSD,
				totalRemittedINR,
				totalTCSPaid,
				byPurpose,
				byCountry,
			},
			complianceStatus: {
				lrsCompliant: lrsStatus.totalRemittedUSD <= this.LRS_LIMIT_USD,
				form15caCompliant: !issues.some((i) => i.includes("Form 15CA")),
				form15cbCompliant: !issues.some((i) => i.includes("Form 15CB")),
				a2FormCompliant: !issues.some((i) => i.includes("A2 Form")),
				tcsCompliant: true,
				issues,
			},
			generatedAt: new Date(),
		};
	}
}

export const femaComplianceService = new FEMAComplianceService();
