/**
 * KYC Sufficiency Service
 *
 * Central intelligence for "KYC Once, Reuse Everywhere".
 *
 * Product journeys (mutual funds, loans, equity, insurance, ITR, etc.) call
 * checkSufficiency() to learn:
 *   - Which KYC requirements are already satisfied from the vault
 *   - Which fields are genuinely missing and must be captured
 *   - Pre-filled data for forms (so the user never re-enters verified data)
 *
 * Regulatory basis:
 *   - SEBI KYC Master Circular (CIR/MIRSD/12/2010)
 *   - RBI Master Direction on KYC (RBI/2015-16/68 DBR.AML.BC.No.81)
 *   - PMLA 2002 & Prevention of Money-Laundering (Maintenance of Records) Rules 2005
 *   - IRDAI KYC Norms (IRDAI/LIFE/CIR/MISC/134/07/2011)
 *   - SEBI (Listing Obligations) Regulations for Bonds/NCDs
 */

import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { isPoolClosed } from "../db";
import { logger } from "../logger";

// ---------------------------------------------------------------------------
// Product KYC Requirement Profiles
// ---------------------------------------------------------------------------

export type ProductCode =
	| "MUTUAL_FUNDS"
	| "EQUITY_TRADING"
	| "F_AND_O"
	| "BONDS_NCD"
	| "FIXED_DEPOSITS"
	| "UNLISTED_SECURITIES"
	| "PMS_AIF"
	| "LOANS_PERSONAL"
	| "LOANS_BUSINESS"
	| "INSURANCE_LIFE"
	| "INSURANCE_HEALTH"
	| "ITR_FILING"
	| "CRYPTO";

export interface ProductProfile {
	productCode: ProductCode;
	productName: string;
	regulatoryBasis: string;
	minKycTier: "basic" | "enhanced" | "accredited_investor";
	requiredVerifications: VerificationRequirement[];
	requiredDataFields: DataFieldRequirement[];
	maxInvestmentWithoutVideoKyc?: number; // INR
}

export interface VerificationRequirement {
	key: string;
	label: string;
	description: string;
	mandatory: boolean;
	upgradeAvailable?: boolean; // Can be waived if KYC is upgraded
}

export interface DataFieldRequirement {
	key: string;
	label: string;
	description: string;
	mandatory: boolean;
	source:
		| "pan_api"
		| "aadhaar_okyc"
		| "ckyc"
		| "user_input"
		| "bank_verification";
}

const PRODUCT_PROFILES: Record<ProductCode, ProductProfile> = {
	MUTUAL_FUNDS: {
		productCode: "MUTUAL_FUNDS",
		productName: "Mutual Funds",
		regulatoryBasis: "SEBI KYC Master Circular + KRA Norms",
		minKycTier: "basic",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				description: "PAN must be verified via NSDL/UTI",
				mandatory: true,
			},
			{
				key: "aadhaar_verified",
				label: "Aadhaar e-KYC",
				description: "Aadhaar OTP-based verification",
				mandatory: true,
			},
			{
				key: "fatca_declared",
				label: "FATCA Declaration",
				description: "Foreign Account Tax Compliance Act declaration",
				mandatory: true,
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Full Name",
				description: "As per PAN card",
				mandatory: true,
				source: "pan_api",
			},
			{
				key: "dob",
				label: "Date of Birth",
				description: "As per PAN/Aadhaar",
				mandatory: true,
				source: "pan_api",
			},
			{
				key: "address",
				label: "Registered Address",
				description: "From Aadhaar",
				mandatory: true,
				source: "aadhaar_okyc",
			},
			{
				key: "occupation",
				label: "Occupation",
				description: "Current occupation category",
				mandatory: true,
				source: "user_input",
			},
			{
				key: "annual_income",
				label: "Annual Income",
				description: "Approximate annual income bracket",
				mandatory: true,
				source: "user_input",
			},
			{
				key: "bank_account",
				label: "Bank Account",
				description: "Verified bank account for redemptions",
				mandatory: true,
				source: "bank_verification",
			},
		],
	},

	EQUITY_TRADING: {
		productCode: "EQUITY_TRADING",
		productName: "Equity Trading (NSE/BSE)",
		regulatoryBasis: "SEBI MIRSD Circular + Stock Broker KYC Norms",
		minKycTier: "basic",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				description: "PAN verified via income tax database",
				mandatory: true,
			},
			{
				key: "aadhaar_verified",
				label: "Aadhaar e-KYC",
				description: "Identity and address verification",
				mandatory: true,
			},
			{
				key: "fatca_declared",
				label: "FATCA Declaration",
				description: "Tax residency declaration",
				mandatory: true,
			},
			{
				key: "in_person_verified",
				label: "IPV (In-Person Verification)",
				description: "One-time video-based identity confirmation",
				mandatory: true,
				upgradeAvailable: false,
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Full Name",
				description: "As per PAN card",
				mandatory: true,
				source: "pan_api",
			},
			{
				key: "dob",
				label: "Date of Birth",
				description: "As per PAN/Aadhaar",
				mandatory: true,
				source: "pan_api",
			},
			{
				key: "address",
				label: "Registered Address",
				description: "From Aadhaar",
				mandatory: true,
				source: "aadhaar_okyc",
			},
			{
				key: "bank_account",
				label: "Bank Account",
				description: "Linked bank account for settlements",
				mandatory: true,
				source: "bank_verification",
			},
			{
				key: "demat_account",
				label: "Demat Account",
				description: "NSDL/CDSL demat account",
				mandatory: true,
				source: "user_input",
			},
			{
				key: "occupation",
				label: "Occupation",
				description: "Current occupation",
				mandatory: true,
				source: "user_input",
			},
			{
				key: "annual_income",
				label: "Annual Income",
				description: "Income bracket",
				mandatory: true,
				source: "user_input",
			},
		],
	},

	F_AND_O: {
		productCode: "F_AND_O",
		productName: "Futures & Options (F&O)",
		regulatoryBasis:
			"SEBI F&O Eligibility Circular SEBI/HO/MIRSD/MIRSD-SEC-3/P/CIR/2023",
		minKycTier: "enhanced",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				mandatory: true,
				description: "PAN verified",
			},
			{
				key: "aadhaar_verified",
				label: "Aadhaar e-KYC",
				mandatory: true,
				description: "Identity verified",
			},
			{
				key: "fatca_declared",
				label: "FATCA Declaration",
				mandatory: true,
				description: "Tax declaration",
			},
			{
				key: "in_person_verified",
				label: "IPV (Video KYC)",
				mandatory: true,
				description: "Mandatory for derivatives",
				upgradeAvailable: false,
			},
			{
				key: "aml_cleared",
				label: "AML Screening",
				mandatory: true,
				description: "Anti-money laundering clearance",
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Full Name",
				mandatory: true,
				source: "pan_api",
				description: "From PAN",
			},
			{
				key: "dob",
				label: "Date of Birth",
				mandatory: true,
				source: "pan_api",
				description: "From PAN",
			},
			{
				key: "address",
				label: "Address",
				mandatory: true,
				source: "aadhaar_okyc",
				description: "From Aadhaar",
			},
			{
				key: "bank_account",
				label: "Bank Account",
				mandatory: true,
				source: "bank_verification",
				description: "For settlements",
			},
			{
				key: "annual_income",
				label: "Annual Income",
				mandatory: true,
				source: "user_input",
				description: "For eligibility assessment",
			},
			{
				key: "trading_experience",
				label: "Trading Experience",
				mandatory: true,
				source: "user_input",
				description: "Minimum 1 year required",
			},
		],
	},

	BONDS_NCD: {
		productCode: "BONDS_NCD",
		productName: "Bonds & NCDs",
		regulatoryBasis:
			"SEBI (Issue and Listing of Non-Convertible Securities) Regulations 2021",
		minKycTier: "basic",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				mandatory: true,
				description: "PAN verified",
			},
			{
				key: "aadhaar_verified",
				label: "Aadhaar e-KYC",
				mandatory: true,
				description: "Identity verified",
			},
			{
				key: "fatca_declared",
				label: "FATCA Declaration",
				mandatory: true,
				description: "Tax declaration",
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Full Name",
				mandatory: true,
				source: "pan_api",
				description: "From PAN",
			},
			{
				key: "dob",
				label: "Date of Birth",
				mandatory: true,
				source: "pan_api",
				description: "From PAN",
			},
			{
				key: "address",
				label: "Address",
				mandatory: true,
				source: "aadhaar_okyc",
				description: "From Aadhaar",
			},
			{
				key: "bank_account",
				label: "Bank Account",
				mandatory: true,
				source: "bank_verification",
				description: "For interest and principal payments",
			},
			{
				key: "demat_account",
				label: "Demat Account",
				mandatory: true,
				source: "user_input",
				description: "For holding securities in demat form",
			},
		],
	},

	FIXED_DEPOSITS: {
		productCode: "FIXED_DEPOSITS",
		productName: "Fixed Deposits (Company FD / NBFC)",
		regulatoryBasis:
			"RBI Master Direction on KYC + Companies (Acceptance of Deposits) Rules",
		minKycTier: "basic",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				mandatory: true,
				description: "PAN verified",
			},
			{
				key: "aadhaar_verified",
				label: "Aadhaar e-KYC",
				mandatory: true,
				description: "Identity verified",
			},
			{
				key: "fatca_declared",
				label: "FATCA Declaration",
				mandatory: true,
				description: "Tax declaration",
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Full Name",
				mandatory: true,
				source: "pan_api",
				description: "From PAN",
			},
			{
				key: "dob",
				label: "Date of Birth",
				mandatory: true,
				source: "pan_api",
				description: "From PAN",
			},
			{
				key: "address",
				label: "Address",
				mandatory: true,
				source: "aadhaar_okyc",
				description: "From Aadhaar",
			},
			{
				key: "bank_account",
				label: "Bank Account",
				mandatory: true,
				source: "bank_verification",
				description: "For maturity proceeds",
			},
		],
	},

	UNLISTED_SECURITIES: {
		productCode: "UNLISTED_SECURITIES",
		productName: "Unlisted Securities / Pre-IPO",
		regulatoryBasis:
			"SEBI (Prohibition of Fraudulent and Unfair Trade Practices) Regulations + PMLA",
		minKycTier: "enhanced",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				mandatory: true,
				description: "PAN verified",
			},
			{
				key: "aadhaar_verified",
				label: "Aadhaar e-KYC",
				mandatory: true,
				description: "Identity verified",
			},
			{
				key: "fatca_declared",
				label: "FATCA Declaration",
				mandatory: true,
				description: "Tax declaration",
			},
			{
				key: "aml_cleared",
				label: "AML Screening",
				mandatory: true,
				description: "Required for unlisted markets",
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Full Name",
				mandatory: true,
				source: "pan_api",
				description: "From PAN",
			},
			{
				key: "dob",
				label: "Date of Birth",
				mandatory: true,
				source: "pan_api",
				description: "From PAN",
			},
			{
				key: "address",
				label: "Address",
				mandatory: true,
				source: "aadhaar_okyc",
				description: "From Aadhaar",
			},
			{
				key: "annual_income",
				label: "Annual Income",
				mandatory: true,
				source: "user_input",
				description: "For suitability assessment",
			},
			{
				key: "source_of_funds",
				label: "Source of Funds",
				mandatory: true,
				source: "user_input",
				description: "Mandatory for PMLA",
			},
			{
				key: "bank_account",
				label: "Bank Account",
				mandatory: true,
				source: "bank_verification",
				description: "For settlement",
			},
		],
	},

	PMS_AIF: {
		productCode: "PMS_AIF",
		productName: "PMS / AIF (Portfolio Management / Alt Inv Funds)",
		regulatoryBasis:
			"SEBI PMS Regulations 2020 + SEBI AIF Regulations 2012 — min ₹50L investment",
		minKycTier: "accredited_investor",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				mandatory: true,
				description: "PAN verified",
			},
			{
				key: "aadhaar_verified",
				label: "Aadhaar e-KYC",
				mandatory: true,
				description: "Identity verified",
			},
			{
				key: "fatca_declared",
				label: "FATCA Declaration",
				mandatory: true,
				description: "Tax declaration",
			},
			{
				key: "aml_cleared",
				label: "AML Screening",
				mandatory: true,
				description: "Enhanced due diligence",
			},
			{
				key: "in_person_verified",
				label: "In-Person / Video KYC",
				mandatory: true,
				description: "Required for high-value products",
				upgradeAvailable: false,
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Full Name",
				mandatory: true,
				source: "pan_api",
				description: "From PAN",
			},
			{
				key: "dob",
				label: "Date of Birth",
				mandatory: true,
				source: "pan_api",
				description: "From PAN",
			},
			{
				key: "address",
				label: "Address",
				mandatory: true,
				source: "aadhaar_okyc",
				description: "From Aadhaar",
			},
			{
				key: "annual_income",
				label: "Annual Income",
				mandatory: true,
				source: "user_input",
				description: "Min threshold applies",
			},
			{
				key: "net_worth",
				label: "Net Worth Certificate",
				mandatory: true,
				source: "user_input",
				description: "CA-certified net worth",
			},
			{
				key: "source_of_funds",
				label: "Source of Funds",
				mandatory: true,
				source: "user_input",
				description: "Required for EDD",
			},
			{
				key: "bank_account",
				label: "Bank Account",
				mandatory: true,
				source: "bank_verification",
				description: "For large-value transactions",
			},
		],
	},

	LOANS_PERSONAL: {
		productCode: "LOANS_PERSONAL",
		productName: "Personal Loans",
		regulatoryBasis:
			"RBI Master Direction on KYC + Fair Practices Code for Lenders",
		minKycTier: "basic",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				mandatory: true,
				description: "PAN verified for credit check",
			},
			{
				key: "aadhaar_verified",
				label: "Aadhaar e-KYC",
				mandatory: true,
				description: "Identity and address verification",
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Full Name",
				mandatory: true,
				source: "pan_api",
				description: "As per PAN",
			},
			{
				key: "dob",
				label: "Date of Birth",
				mandatory: true,
				source: "pan_api",
				description: "For eligibility check",
			},
			{
				key: "address",
				label: "Current Address",
				mandatory: true,
				source: "aadhaar_okyc",
				description: "From Aadhaar",
			},
			{
				key: "occupation",
				label: "Occupation Type",
				mandatory: true,
				source: "user_input",
				description: "Salaried / Self-employed / Business",
			},
			{
				key: "employer",
				label: "Employer / Business Name",
				mandatory: true,
				source: "user_input",
				description: "Current employer or business",
			},
			{
				key: "annual_income",
				label: "Annual Income",
				mandatory: true,
				source: "user_input",
				description: "For repayment capacity",
			},
			{
				key: "bank_account",
				label: "Bank Account (3-month statement)",
				mandatory: true,
				source: "bank_verification",
				description: "For EMI mandate",
			},
		],
	},

	LOANS_BUSINESS: {
		productCode: "LOANS_BUSINESS",
		productName: "Business / MSME Loans",
		regulatoryBasis: "RBI KYC Norms + MSME Development Act",
		minKycTier: "enhanced",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				mandatory: true,
				description: "Individual + business PAN",
			},
			{
				key: "aadhaar_verified",
				label: "Aadhaar e-KYC",
				mandatory: true,
				description: "Promoter identity verification",
			},
			{
				key: "aml_cleared",
				label: "AML Screening",
				mandatory: true,
				description: "Business entity AML check",
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Promoter Full Name",
				mandatory: true,
				source: "pan_api",
				description: "From PAN",
			},
			{
				key: "dob",
				label: "Date of Birth",
				mandatory: true,
				source: "pan_api",
				description: "Promoter DOB",
			},
			{
				key: "address",
				label: "Business Address",
				mandatory: true,
				source: "user_input",
				description: "Registered business address",
			},
			{
				key: "business_type",
				label: "Business Type",
				mandatory: true,
				source: "user_input",
				description: "Proprietorship / Partnership / Private Ltd",
			},
			{
				key: "gstin",
				label: "GSTIN",
				mandatory: false,
				source: "user_input",
				description: "GST number if applicable",
			},
			{
				key: "annual_turnover",
				label: "Annual Business Turnover",
				mandatory: true,
				source: "user_input",
				description: "Last 2 years",
			},
			{
				key: "bank_account",
				label: "Business Bank Account",
				mandatory: true,
				source: "bank_verification",
				description: "Business current account",
			},
		],
	},

	INSURANCE_LIFE: {
		productCode: "INSURANCE_LIFE",
		productName: "Life Insurance",
		regulatoryBasis:
			"IRDAI KYC Circular (Ref: IRDAI/LIFE/CIR/MISC/134/07/2011)",
		minKycTier: "basic",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				mandatory: true,
				description: "For policies above ₹5L annual premium",
			},
			{
				key: "aadhaar_verified",
				label: "Aadhaar e-KYC",
				mandatory: true,
				description: "Identity and address for policy issuance",
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Full Name",
				mandatory: true,
				source: "pan_api",
				description: "Policy holder name",
			},
			{
				key: "dob",
				label: "Date of Birth",
				mandatory: true,
				source: "pan_api",
				description: "For premium calculation",
			},
			{
				key: "gender",
				label: "Gender",
				mandatory: true,
				source: "aadhaar_okyc",
				description: "From Aadhaar",
			},
			{
				key: "address",
				label: "Address",
				mandatory: true,
				source: "aadhaar_okyc",
				description: "For policy documents",
			},
			{
				key: "nominee_name",
				label: "Nominee Name",
				mandatory: true,
				source: "user_input",
				description: "Policy beneficiary",
			},
			{
				key: "nominee_relation",
				label: "Nominee Relationship",
				mandatory: true,
				source: "user_input",
				description: "Relation to insured",
			},
		],
	},

	INSURANCE_HEALTH: {
		productCode: "INSURANCE_HEALTH",
		productName: "Health Insurance",
		regulatoryBasis: "IRDAI (Health Insurance) Regulations 2016",
		minKycTier: "basic",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				mandatory: false,
				description: "Optional but recommended for high-value policies",
			},
			{
				key: "aadhaar_verified",
				label: "Aadhaar e-KYC",
				mandatory: true,
				description: "Identity verification for cashless claims",
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Full Name",
				mandatory: true,
				source: "pan_api",
				description: "Primary insured",
			},
			{
				key: "dob",
				label: "Date of Birth",
				mandatory: true,
				source: "pan_api",
				description: "For premium computation",
			},
			{
				key: "gender",
				label: "Gender",
				mandatory: true,
				source: "aadhaar_okyc",
				description: "From Aadhaar",
			},
			{
				key: "address",
				label: "Address",
				mandatory: true,
				source: "aadhaar_okyc",
				description: "Correspondence address",
			},
		],
	},

	ITR_FILING: {
		productCode: "ITR_FILING",
		productName: "Income Tax Return Filing",
		regulatoryBasis: "Income Tax Act 1961 — Section 139",
		minKycTier: "basic",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				mandatory: true,
				description: "Mandatory — PAN is the taxpayer identifier",
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Full Name",
				mandatory: true,
				source: "pan_api",
				description: "As per PAN records",
			},
			{
				key: "dob",
				label: "Date of Birth",
				mandatory: true,
				source: "pan_api",
				description: "As per PAN",
			},
			{
				key: "address",
				label: "Address",
				mandatory: true,
				source: "aadhaar_okyc",
				description: "For correspondence",
			},
			{
				key: "annual_income",
				label: "Income Details",
				mandatory: true,
				source: "user_input",
				description: "Salary / business income / capital gains",
			},
			{
				key: "bank_account",
				label: "Bank Account (for refunds)",
				mandatory: true,
				source: "bank_verification",
				description: "Refund account with IFSC",
			},
		],
	},

	CRYPTO: {
		productCode: "CRYPTO",
		productName: "Crypto Assets (VDA)",
		regulatoryBasis: "Finance Act 2022 — Section 115BBH + PMLA VDA Reporting",
		minKycTier: "basic",
		requiredVerifications: [
			{
				key: "pan_verified",
				label: "PAN Verification",
				mandatory: true,
				description: "Mandatory under PMLA amendment",
			},
			{
				key: "aadhaar_verified",
				label: "Aadhaar e-KYC",
				mandatory: true,
				description: "Identity verification",
			},
			{
				key: "aml_cleared",
				label: "AML / VASP Screening",
				mandatory: true,
				description: "VASP onboarding requirement",
			},
		],
		requiredDataFields: [
			{
				key: "full_name",
				label: "Full Name",
				mandatory: true,
				source: "pan_api",
				description: "As per PAN",
			},
			{
				key: "dob",
				label: "Date of Birth",
				mandatory: true,
				source: "pan_api",
				description: "For age eligibility",
			},
			{
				key: "address",
				label: "Address",
				mandatory: true,
				source: "aadhaar_okyc",
				description: "Residence address",
			},
			{
				key: "source_of_funds",
				label: "Source of Funds",
				mandatory: true,
				source: "user_input",
				description: "Required for PMLA compliance",
			},
			{
				key: "bank_account",
				label: "Bank Account",
				mandatory: true,
				source: "bank_verification",
				description: "INR settlement account",
			},
		],
	},
};

// ---------------------------------------------------------------------------
// Sufficiency Check Result Types
// ---------------------------------------------------------------------------

export interface VerificationStatus {
	key: string;
	label: string;
	description: string;
	mandatory: boolean;
	satisfied: boolean;
	verifiedAt?: Date;
	expiresAt?: Date;
	upgradeAvailable?: boolean;
}

export interface DataFieldStatus {
	key: string;
	label: string;
	mandatory: boolean;
	satisfied: boolean;
	prefilledValue?: string | null;
	source: string;
	description: string;
}

export interface SufficiencyResult {
	productCode: ProductCode;
	productName: string;
	regulatoryBasis: string;
	canProceed: boolean;
	kycTier: string;
	kycVerifiedAt?: Date;
	kycExpiresAt?: Date;
	kycIsExpired: boolean;
	verifications: VerificationStatus[];
	dataFields: DataFieldStatus[];
	missingMandatory: string[];
	missingOptional: string[];
	prefilledData: Record<string, string | null>;
	completionPercentage: number;
	upgradeRequired?: string;
}

// ---------------------------------------------------------------------------
// Sufficiency Service
// ---------------------------------------------------------------------------

// ── T006: Per-user KYC data cache (3-minute TTL) ────────────────────────────
// Caches the 4 DB queries that every sufficiency check needs so that
// checking all 13 products at once costs a single round-trip instead of 13.
interface CachedKycData {
	user: any;
	userProfile: any;
	vault: any;
	bankAccountVerified: boolean;
	cachedAt: number;
}
const KYC_DATA_CACHE = new Map<string, CachedKycData>();
const KYC_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

function getCachedKycData(userId: string): CachedKycData | null {
	const entry = KYC_DATA_CACHE.get(userId);
	if (!entry) return null;
	if (Date.now() - entry.cachedAt > KYC_CACHE_TTL_MS) {
		KYC_DATA_CACHE.delete(userId);
		return null;
	}
	return entry;
}

/** Call this after any KYC event to force re-fetch on the next sufficiency check. */
export function invalidateSufficiencyCache(userId: string): void {
	KYC_DATA_CACHE.delete(userId);
}
// ────────────────────────────────────────────────────────────────────────────

class KycSufficiencyService {
	/**
	 * Fetch and cache the raw KYC data for a user.
	 * Internal helper — keeps DB access to a single Promise.all per user per TTL window.
	 */
	private async fetchKycData(
		userId: string,
	): Promise<{
		user: any;
		userProfile: any;
		vault: any;
		bankAccountVerified: boolean;
	}> {
		const cached = getCachedKycData(userId);
		if (cached) return cached;

		// ── T003 + T006: parallel fetch including bank account ─────────────────
		const [user, userProfile, vault, bankRows] = await Promise.all([
			db.query.users.findFirst({ where: eq(schema.users.id, userId) }),
			db.query.userProfiles.findFirst({
				where: eq(schema.userProfiles.userId, userId),
			}),
			db
				.select()
				.from(schema.kycVault)
				.where(eq(schema.kycVault.userId, userId))
				.limit(1)
				.then((r) => r[0] ?? null),
			// T003: check for at least one verified bank account
			db
				.select({ id: schema.userBankAccounts.id })
				.from(schema.userBankAccounts)
				.where(
					and(
						eq(schema.userBankAccounts.userId, userId),
						eq(schema.userBankAccounts.verificationStatus, "verified"),
					),
				)
				.limit(1),
		]);

		const bankAccountVerified = bankRows.length > 0;
		const entry: CachedKycData = {
			user,
			userProfile,
			vault,
			bankAccountVerified,
			cachedAt: Date.now(),
		};
		KYC_DATA_CACHE.set(userId, entry);
		return entry;
	}

	/**
	 * Check if a user's existing KYC data satisfies requirements for a specific product.
	 * Returns exactly what's satisfied (pre-filled) and what's genuinely missing.
	 */
	async checkSufficiency(
		userId: string,
		productCode: ProductCode,
	): Promise<SufficiencyResult> {
		if (isPoolClosed()) {
			throw new Error("Database pool closed");
		}

		const profile = PRODUCT_PROFILES[productCode];
		if (!profile) {
			throw new Error(`Unknown product code: ${productCode}`);
		}

		const { user, userProfile, vault, bankAccountVerified } =
			await this.fetchKycData(userId);

		// -----------------------------------------------------------------------
		// Build the truth table from verified data
		// -----------------------------------------------------------------------
		const kycExpired =
			vault?.isExpired ||
			(vault?.kycExpiryDate
				? new Date() > new Date(vault.kycExpiryDate)
				: false);
		const panVerified = !!user?.panVerifiedViaSmartKyc && !kycExpired;
		const aadhaarVerified = !!user?.aadhaarVerifiedViaSmartKyc && !kycExpired;
		const fatcaDeclared = !!userProfile?.fatcaDeclarationDate;
		// AML is cleared only when amlRiskLevel has been set AND it is LOW or MEDIUM
		const amlCleared = !!(
			userProfile?.amlRiskLevel &&
			userProfile.amlRiskLevel !== "CRITICAL" &&
			userProfile.amlRiskLevel !== "HIGH"
		);
		const videoKycDone = !!userProfile?.videoKycCompletedAt;
		const kycTier = userProfile?.kycTier || "none";

		// Pre-filled data from verified sources
		const prefilledData: Record<string, string | null> = {
			full_name: user?.firstName
				? `${user.firstName}${user.middleName ? " " + user.middleName : ""} ${user.lastName || ""}`.trim()
				: null,
			dob: user?.dateOfBirth ? String(user.dateOfBirth) : null,
			gender: userProfile?.gender || null,
			address: userProfile?.address || null,
			city: userProfile?.city || null,
			state: userProfile?.state || null,
			pincode: userProfile?.pincode || null,
			occupation: userProfile?.occupation || null,
			annual_income: userProfile?.annualIncome || null,
			email: user?.email || null,
			mobile: user?.mobileNumber || null,
			// T003: bank account verified via penny drop / IMPS
			bank_account: bankAccountVerified ? "verified" : null,
		};

		// -----------------------------------------------------------------------
		// Check verifications
		// -----------------------------------------------------------------------
		const verifications: VerificationStatus[] =
			profile.requiredVerifications.map((req) => {
				let satisfied = false;
				let verifiedAt: Date | undefined;
				let expiresAt: Date | undefined;

				switch (req.key) {
					case "pan_verified":
						satisfied = panVerified;
						verifiedAt = user?.panVerificationDate
							? new Date(user.panVerificationDate)
							: undefined;
						expiresAt = vault?.kycExpiryDate
							? new Date(vault.kycExpiryDate)
							: undefined;
						break;
					case "aadhaar_verified":
						satisfied = aadhaarVerified;
						verifiedAt = user?.aadhaarVerificationDate
							? new Date(user.aadhaarVerificationDate)
							: undefined;
						expiresAt = vault?.kycExpiryDate
							? new Date(vault.kycExpiryDate)
							: undefined;
						break;
					case "fatca_declared":
						satisfied = fatcaDeclared;
						verifiedAt = userProfile?.fatcaDeclarationDate
							? new Date(userProfile.fatcaDeclarationDate)
							: undefined;
						break;
					case "aml_cleared":
						satisfied = amlCleared;
						break;
					case "in_person_verified":
						satisfied = videoKycDone;
						verifiedAt = userProfile?.videoKycCompletedAt
							? new Date(userProfile.videoKycCompletedAt)
							: undefined;
						break;
					default:
						satisfied = false;
				}

				return {
					key: req.key,
					label: req.label,
					description: req.description,
					mandatory: req.mandatory,
					satisfied,
					verifiedAt,
					expiresAt,
					upgradeAvailable: req.upgradeAvailable,
				};
			});

		// -----------------------------------------------------------------------
		// Check data fields
		// -----------------------------------------------------------------------
		const dataFields: DataFieldStatus[] = profile.requiredDataFields.map(
			(field) => {
				const prefilledValue = prefilledData[field.key] || null;
				const satisfied = !!prefilledValue;

				return {
					key: field.key,
					label: field.label,
					mandatory: field.mandatory,
					satisfied,
					prefilledValue,
					source: field.source,
					description: field.description,
				};
			},
		);

		// -----------------------------------------------------------------------
		// Compute missing
		// -----------------------------------------------------------------------
		const missingVerifications = verifications
			.filter((v) => v.mandatory && !v.satisfied)
			.map((v) => v.label);
		const missingDataFields = dataFields
			.filter((f) => f.mandatory && !f.satisfied)
			.map((f) => f.label);
		const missingOptionalData = dataFields
			.filter((f) => !f.mandatory && !f.satisfied)
			.map((f) => f.label);

		const missingMandatory = [...missingVerifications, ...missingDataFields];
		const missingOptional = missingOptionalData;

		// Tier check
		const tierRank = { none: 0, basic: 1, enhanced: 2, accredited_investor: 3 };
		const userTierRank = tierRank[kycTier as keyof typeof tierRank] ?? 0;
		const requiredTierRank = tierRank[profile.minKycTier];
		const tierSatisfied = userTierRank >= requiredTierRank;
		if (!tierSatisfied) {
			missingMandatory.push(
				`${profile.minKycTier} KYC tier required (current: ${kycTier || "none"})`,
			);
		}

		const canProceed = missingMandatory.length === 0;

		// Completion percentage
		const totalMandatory =
			verifications.filter((v) => v.mandatory).length +
			dataFields.filter((f) => f.mandatory).length;
		const completedMandatory =
			verifications.filter((v) => v.mandatory && v.satisfied).length +
			dataFields.filter((f) => f.mandatory && f.satisfied).length;
		const completionPercentage =
			totalMandatory > 0
				? Math.round((completedMandatory / totalMandatory) * 100)
				: 100;

		return {
			productCode,
			productName: profile.productName,
			regulatoryBasis: profile.regulatoryBasis,
			canProceed,
			kycTier: kycTier || "none",
			kycVerifiedAt: vault?.kycVerifiedAt
				? new Date(vault.kycVerifiedAt)
				: undefined,
			kycExpiresAt: vault?.kycExpiryDate
				? new Date(vault.kycExpiryDate)
				: undefined,
			kycIsExpired: kycExpired,
			verifications,
			dataFields,
			missingMandatory,
			missingOptional,
			prefilledData,
			completionPercentage,
		};
	}

	/**
	 * Check sufficiency for all products at once.
	 * Used by the KYC Product Access Panel to show which products are accessible.
	 */
	async checkAllProducts(userId: string): Promise<SufficiencyResult[]> {
		const productCodes = Object.keys(PRODUCT_PROFILES) as ProductCode[];
		const results = await Promise.all(
			productCodes.map((code) =>
				this.checkSufficiency(userId, code).catch((err) => {
					logger.error(`[KYCSufficiency] Error checking ${code}`, {
						error: err instanceof Error ? err.message : String(err),
					});
					return null;
				}),
			),
		);
		return results.filter(Boolean) as SufficiencyResult[];
	}

	/**
	 * Get all product profiles (for frontend to render product list without auth check).
	 */
	getProductProfiles(): ProductProfile[] {
		return Object.values(PRODUCT_PROFILES);
	}

	/**
	 * Get incrementally required fields — i.e., what a user still needs to fill
	 * to proceed with a specific product, given their current KYC state.
	 * This powers the "incremental KYC" flow where users are NOT shown fields
	 * they've already verified.
	 */
	async getIncrementalRequirements(
		userId: string,
		productCode: ProductCode,
	): Promise<{
		alreadySatisfied: string[];
		needsVerification: VerificationStatus[];
		needsDataEntry: DataFieldStatus[];
		prefilledData: Record<string, string | null>;
	}> {
		const result = await this.checkSufficiency(userId, productCode);

		return {
			alreadySatisfied: [
				...result.verifications.filter((v) => v.satisfied).map((v) => v.label),
				...result.dataFields.filter((f) => f.satisfied).map((f) => f.label),
			],
			needsVerification: result.verifications.filter((v) => !v.satisfied),
			needsDataEntry: result.dataFields.filter((f) => !f.satisfied),
			prefilledData: result.prefilledData,
		};
	}
}

export const kycSufficiencyService = new KycSufficiencyService();
export { PRODUCT_PROFILES };
