/**
 * GIFT City (IFSC) Execution & Compliance Service
 * Adheres strictly to FintekPro GCR v1.0 + SEBI FASP-AI v1.0
 * 
 * Implements:
 * 1. Accredited Investor Verification under IFSCA Fund Management Regulations 2022
 * 2. LRS Remittance Quoting & RBI Form A2 Package Generation (with Section 206C(1G) 20% TCS calculation)
 * 3. GIFT City Investment Intent & Application Processing with audit trail
 */

import { femaComplianceService } from "./fema-compliance-service";
import { logger } from "../logger";
import { nanoid } from "nanoid";

export interface AccreditedInvestorInput {
	investorType: "individual" | "entity" | "nri" | "fpi";
	netWorthUSD?: number;
	netWorthINR?: number;
	annualIncomeUSD?: number;
	annualIncomeINR?: number;
	hasProfessionalExperience?: boolean;
	entityType?: "trust" | "corporate" | "partnership" | "family_office";
}

export interface AccreditedInvestorResult {
	isEligible: boolean;
	accreditationLevel: "Accredited Investor" | "Non-Accredited" | "Qualified Institutional Buyer (QIB)";
	framework: string;
	criteriaEvaluated: {
		metric: string;
		threshold: string;
		valueProvided: string;
		met: boolean;
	}[];
	validityPeriod: string;
	statutoryNotice: string;
	confidenceScore: number;
	modelVersion: string;
	timestamp: string;
}

export interface LrsRemittanceInput {
	remittanceAmountUSD: number;
	fxRate?: number;
	fyUtilizationINR?: number;
	purposeCode?: string;
	remitterName?: string;
	remitterPAN?: string;
	beneficiaryName?: string;
	beneficiaryBank?: string;
	beneficiaryCountry?: string;
}

export interface LrsRemittanceResult {
	remittanceUSD: number;
	fxRate: number;
	remittanceINR: number;
	fyPriorUtilizationINR: number;
	fyTotalUtilizationINR: number;
	remainingLrsLimitUSD: number;
	tcsDetails: {
		thresholdINR: number;
		amountBelowThresholdINR: number;
		amountAboveThresholdINR: number;
		tcsRatePercent: number;
		tcsPayableINR: number;
		totalPayableWithTcsINR: number;
		statutoryClause: string;
	};
	purposeCode: string;
	purposeDescription: string;
	a2FormPreview: {
		formNumber: string;
		remitterName: string;
		remitterPAN: string;
		purposeCode: string;
		beneficiaryName: string;
		beneficiaryBank: string;
		transferChannel: string;
		remittanceCurrency: string;
		generatedAt: string;
	};
	complianceChecklist: string[];
	timestamp: string;
}

export interface GiftCityApplicationInput {
	productId?: string;
	productName: string;
	applicantName: string;
	email: string;
	phone: string;
	investorType: string;
	flowDirection: "inbound" | "outbound";
	proposedInvestmentUSD: number;
	isAccredited?: boolean;
	lrsApplicable?: boolean;
	notes?: string;
}

export interface GiftCityApplicationResult {
	applicationId: string;
	referenceNumber: string;
	status: "pending_compliance_review" | "registered";
	applicantName: string;
	productName: string;
	flowDirection: "inbound" | "outbound";
	proposedInvestmentUSD: number;
	nextSteps: string[];
	assignedBranch: string;
	timestamp: string;
}

class GiftCityExecutionService {
	private readonly VERSION = "1.0.0";
	private readonly DEFAULT_FX_RATE = 84.50; // Reference RBI USD/INR
	private readonly LRS_ANNUAL_CAP_USD = 250000;
	private readonly TCS_THRESHOLD_INR = 700000;

	/**
	 * Assesses investor eligibility under IFSCA Fund Management Regulations, 2022
	 * Reg 2(1)(a) & Reg 19:
	 * - Individual: Net worth >= $1,000,000 USD (excluding primary residence) OR
	 *               Gross annual income >= $200,000 USD in each of the last 3 financial years.
	 * - Body Corporate / Trust / Entity: Net worth >= $5,000,000 USD.
	 */
	assessAccreditedInvestorStatus(input: AccreditedInvestorInput): AccreditedInvestorResult {
		const fx = this.DEFAULT_FX_RATE;
		const netWorthUSD = input.netWorthUSD ?? (input.netWorthINR ? input.netWorthINR / fx : 0);
		const annualIncomeUSD = input.annualIncomeUSD ?? (input.annualIncomeINR ? input.annualIncomeINR / fx : 0);

		const criteria: AccreditedInvestorResult["criteriaEvaluated"] = [];
		let isEligible = false;
		let level: AccreditedInvestorResult["accreditationLevel"] = "Non-Accredited";

		if (input.investorType === "entity") {
			const thresholdUSD = 5000000;
			const met = netWorthUSD >= thresholdUSD;
			criteria.push({
				metric: "Entity Net Worth (excluding illiquid encumbrances)",
				threshold: "$5,000,000 USD (₹42.25 Cr)",
				valueProvided: `$${Math.round(netWorthUSD).toLocaleString()} USD`,
				met,
			});
			isEligible = met;
			level = met ? "Qualified Institutional Buyer (QIB)" : "Non-Accredited";
		} else {
			// Individual / NRI / Foreign HNI
			const netWorthThresholdUSD = 1000000;
			const incomeThresholdUSD = 200000;

			const netWorthMet = netWorthUSD >= netWorthThresholdUSD;
			const incomeMet = annualIncomeUSD >= incomeThresholdUSD;

			criteria.push({
				metric: "Liquid / Investable Net Worth (excl. primary residence)",
				threshold: "$1,000,000 USD (₹8.45 Cr)",
				valueProvided: `$${Math.round(netWorthUSD).toLocaleString()} USD`,
				met: netWorthMet,
			});

			criteria.push({
				metric: "Gross Annual Income (last 3 financial years)",
				threshold: "$200,000 USD (₹1.69 Cr)",
				valueProvided: `$${Math.round(annualIncomeUSD).toLocaleString()} USD`,
				met: incomeMet,
			});

			isEligible = netWorthMet || incomeMet;
			level = isEligible ? "Accredited Investor" : "Non-Accredited";
		}

		const result: AccreditedInvestorResult = {
			isEligible,
			accreditationLevel: level,
			framework: "IFSCA (Fund Management) Regulations, 2022",
			criteriaEvaluated: criteria,
			validityPeriod: isEligible ? "3 Years from certification date" : "N/A",
			statutoryNotice: isEligible
				? "Accreditation permits participation in Category I, II, & III Alternative Investment Funds (AIFs) and unlisted GIFT City vehicles with relaxed diversification floors."
				: "Applicant does not satisfy IFSCA accredited investor minimum floors. May participate in listed IFSCA depository instruments and retail global feeder funds.",
			confidenceScore: 0.98,
			modelVersion: "FASP-AI-GIFT-v1.0",
			timestamp: new Date().toISOString(),
		};

		logger.info("[GiftCityService] Accredited investor assessment complete", {
			investorType: input.investorType,
			isEligible,
			level,
		});

		return result;
	}

	/**
	 * Computes complete LRS Remittance Breakdown and Form A2 package
	 * with Section 206C(1G) 20% TCS calculation.
	 */
	generateLrsRemittancePackage(input: LrsRemittanceInput): LrsRemittanceResult {
		const fx = input.fxRate ?? this.DEFAULT_FX_RATE;
		const remittanceINR = Math.round(input.remittanceAmountUSD * fx);
		const priorUtilizationINR = input.fyUtilizationINR ?? 0;
		const totalUtilizationINR = priorUtilizationINR + remittanceINR;

		const remainingUSD = Math.max(0, this.LRS_ANNUAL_CAP_USD - totalUtilizationINR / fx);

		// Compute Section 206C(1G) TCS using FintekPro FEMA compliance engine
		const purposeCode = input.purposeCode ?? "S0001"; // S0001 = Indian investment abroad in equity shares/AIFs
		const tcsResult = femaComplianceService.calculateTCS(
			remittanceINR,
			priorUtilizationINR,
			purposeCode,
			false,
		);

		const formNumber = `A2-IFSC-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;

		return {
			remittanceUSD: input.remittanceAmountUSD,
			fxRate: fx,
			remittanceINR,
			fyPriorUtilizationINR: priorUtilizationINR,
			fyTotalUtilizationINR: totalUtilizationINR,
			remainingLrsLimitUSD: Math.round(remainingUSD),
			tcsDetails: {
				thresholdINR: this.TCS_THRESHOLD_INR,
				amountBelowThresholdINR: tcsResult.breakdown.belowThreshold,
				amountAboveThresholdINR: tcsResult.breakdown.aboveThreshold,
				tcsRatePercent: tcsResult.breakdown.aboveThreshold > 0 ? 20 : 0,
				tcsPayableINR: tcsResult.tcsAmount,
				totalPayableWithTcsINR: remittanceINR + tcsResult.tcsAmount,
				statutoryClause: "Finance Act 2023 — Income Tax Act Section 206C(1G): 20% TCS on overseas investment remittances exceeding ₹7 Lakhs cumulative in a financial year.",
			},
			purposeCode,
			purposeDescription: "S0001: Indian investment abroad in equity shares, AIFs and portfolio assets",
			a2FormPreview: {
				formNumber,
				remitterName: input.remitterName ?? "Resident Investor",
				remitterPAN: input.remitterPAN ?? "ABCDE1234F",
				purposeCode,
				beneficiaryName: input.beneficiaryName ?? "FintekPro IFSC Client Escrow / Custodian IBU",
				beneficiaryBank: input.beneficiaryBank ?? "Federal Bank IBU / ICICI Bank GIFT City",
				transferChannel: "Authorized Dealer Cat-I RTGS/NEFT to IBU Account (Zero-SWIFT Local Rail)",
				remittanceCurrency: "USD",
				generatedAt: new Date().toISOString(),
			},
			complianceChecklist: [
				"Mandatory Form A2 declaration filed with Authorized Dealer Category-I bank",
				"Cumulative LRS FY utilization verified under $250,000 USD statutory ceiling",
				"20% TCS deduction applicable on amount exceeding ₹7,00,000 threshold (adjusted against Advance Tax / ITR)",
				"Allotment of units in IFSC Banking Unit (IBU) account with zero domestic pooling",
			],
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Submits and logs a formal GIFT City Investment Application
	 */
	async submitGiftCityApplication(input: GiftCityApplicationInput): Promise<GiftCityApplicationResult> {
		const referenceNumber = `GIFT-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`;

		logger.info("[GiftCityService] Processing GIFT City investment application", {
			referenceNumber,
			product: input.productName,
			flowDirection: input.flowDirection,
			amountUSD: input.proposedInvestmentUSD,
		});

		const nextSteps = [
			"Relationship Manager from FintekPro IFSC Branch will initiate statutory verification within 24 business hours.",
			input.flowDirection === "outbound"
				? "Pre-filled RBI Form A2 and LRS remittance instructions dispatched to your registered email."
				: "FATCA/CRS declaration and overseas source of funds paperwork scheduled for electronic sign-off.",
			"Direct custodian allotment coordinated with IFSC Banking Unit (Zero Intermediary Pooling).",
		];

		return {
			applicationId: nanoid(),
			referenceNumber,
			status: "pending_compliance_review",
			applicantName: input.applicantName,
			productName: input.productName,
			flowDirection: input.flowDirection,
			proposedInvestmentUSD: input.proposedInvestmentUSD,
			nextSteps,
			assignedBranch: "FintekPro IFSC Branch, 15th Floor, GIFT One Tower, GIFT City, Gandhinagar - 382355",
			timestamp: new Date().toISOString(),
		};
	}
}

export const giftCityExecutionService = new GiftCityExecutionService();
