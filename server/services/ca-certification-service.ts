import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { partners, users, caVerificationStatus } from "@shared/schema";

export interface Form15CBInput {
	caPartnerId: string;
	remitterUserId: string;
	remitterName: string;
	remitterPan: string;
	beneficiaryName: string;
	beneficiaryCountry: string;
	currency: string;
	amountForeignCurrency: number;
	exchangeRate: number;
	natureOfRemittance: "ROYALTY" | "FTS" | "DIVIDEND" | "INTEREST" | "SOFTWARE" | "GIFT" | "EDUCATION" | "OTHER";
	dtaaApplicable: boolean;
	dtaaCountry?: string;
	dtaaArticle?: string;
	dtaaTaxRate?: number;
	domesticTaxRate?: number;
	peInIndia: boolean;
	udin?: string;
}

export interface NetWorthCertificateInput {
	caPartnerId: string;
	userId: string;
	asOfDate: string;
	liquidAssets: {
		bankBalances: number;
		mutualFunds: number;
		listedEquities: number;
		fixedDeposits: number;
		bondsAndDebentures: number;
	};
	illiquidAssets: {
		realEstate: number;
		goldAndJewellery: number;
		unlistedShares: number;
		vehiclesAndOther: number;
	};
	liabilities: {
		homeLoans: number;
		personalLoans: number;
		creditCardsAndOther: number;
	};
	purpose: "VISA" | "LRS_REMITTANCE" | "BANK_GUARANTEE" | "DIRECTORSHIP" | "OTHER";
	udin?: string;
}

export interface UDINValidationResult {
	isValid: boolean;
	udin: string;
	membershipNumber?: string;
	year?: string;
	error?: string;
}

/**
 * Service to generate statutory CA certifications (Form 15CB, Net Worth certificates)
 * and validate ICAI UDIN (Unique Document Identification Number) records.
 */
export class CACertificationService {
	private readonly engineVersion = "CA_CERT_ENGINE_V1.5";

	/**
	 * Validates an ICAI UDIN according to ICAI gazette guidelines.
	 * Format: 18 characters alphanumeric:
	 * First 2 digits: Year (e.g., 24, 25, 26)
	 * Next 6 digits: ICAI Membership Number
	 * Next 10 chars: Alphanumeric unique identifier
	 *
	 * @param udin The 18-character UDIN string
	 * @param expectedMembership Optional membership number to match
	 */
	validateUDINFormat(udin: string, expectedMembership?: string): UDINValidationResult {
		const cleanUdin = udin.trim().toUpperCase();

		if (cleanUdin.length !== 18) {
			return {
				isValid: false,
				udin: cleanUdin,
				error: "UDIN must be exactly 18 alphanumeric characters in length",
			};
		}

		const yearPart = cleanUdin.substring(0, 2);
		const membershipPart = cleanUdin.substring(2, 8);
		const hashPart = cleanUdin.substring(8);

		if (!/^\d{2}$/.test(yearPart)) {
			return {
				isValid: false,
				udin: cleanUdin,
				error: "First 2 characters of UDIN must be the 2-digit year (e.g., 25 or 26)",
			};
		}

		if (!/^\d{6}$/.test(membershipPart)) {
			return {
				isValid: false,
				udin: cleanUdin,
				error: "Characters 3 to 8 of UDIN must be the 6-digit ICAI membership number",
			};
		}

		if (!/^[A-Z0-9]{10}$/.test(hashPart)) {
			return {
				isValid: false,
				udin: cleanUdin,
				error: "Last 10 characters of UDIN must be alphanumeric",
			};
		}

		if (expectedMembership && membershipPart !== expectedMembership.padStart(6, "0")) {
			return {
				isValid: false,
				udin: cleanUdin,
				year: yearPart,
				membershipNumber: membershipPart,
				error: `UDIN membership (${membershipPart}) does not match CA record (${expectedMembership})`,
			};
		}

		return {
			isValid: true,
			udin: cleanUdin,
			year: yearPart,
			membershipNumber: membershipPart,
		};
	}

	/**
	 * Prepares a Form 15CB certification draft for cross-border foreign remittances.
	 *
	 * @param input Form 15CB data inputs
	 */
	async draftForm15CB(input: Form15CBInput) {
		const [caPartner] = await db
			.select()
			.from(partners)
			.where(eq(partners.id, input.caPartnerId))
			.limit(1);

		if (!caPartner) {
			throw new Error("CA Partner record not found");
		}

		const amountInr = Math.round(input.amountForeignCurrency * input.exchangeRate);

		// Determine tax withholding (TDS) under Section 195 vs DTAA
		let applicableTaxRate = input.domesticTaxRate || 20;
		if (input.dtaaApplicable && input.dtaaTaxRate !== undefined) {
			// Under Section 90(2), assessee can opt for DTAA or domestic rate, whichever is more beneficial
			applicableTaxRate = Math.min(input.dtaaTaxRate, applicableTaxRate);
		}

		const estimatedTds = Math.round((amountInr * applicableTaxRate) / 100);

		// Format certificate number
		const certNo = `15CB-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

		return {
			certificateNumber: certNo,
			formType: "Form 15CB",
			engineVersion: this.engineVersion,
			generatedAt: new Date().toISOString(),
			caDetails: {
				partnerId: caPartner.id,
				firmName: caPartner.caFirmName || caPartner.companyName,
				name: caPartner.companyName,
				icaiNumber: caPartner.icaiMembershipNumber,
				membershipType: caPartner.icaiMembershipType,
			},
			remitter: {
				name: input.remitterName,
				pan: input.remitterPan,
			},
			beneficiary: {
				name: input.beneficiaryName,
				country: input.beneficiaryCountry,
			},
			remittance: {
				currency: input.currency,
				amountForeignCurrency: input.amountForeignCurrency,
				exchangeRate: input.exchangeRate,
				amountInr,
				natureOfRemittance: input.natureOfRemittance,
			},
			taxDetermination: {
				dtaaApplicable: input.dtaaApplicable,
				dtaaCountry: input.dtaaCountry,
				dtaaArticle: input.dtaaArticle,
				applicableTaxRatePercent: applicableTaxRate,
				estimatedTdsInr: estimatedTds,
				peInIndia: input.peInIndia,
				statutoryClause: input.dtaaApplicable
					? `Beneficial rate claimed u/s 90(2) per Article ${input.dtaaArticle || "N/A"} of India-${input.dtaaCountry || "Foreign"} DTAA`
					: "Tax withheld under domestic provisions of Section 195 of the Income-tax Act, 1961",
			},
			udin: input.udin || "PENDING_CA_GENERATION",
			udinStatus: input.udin ? this.validateUDINFormat(input.udin).isValid : false,
		};
	}

	/**
	 * Generates a certified Net Worth Certificate and saves it in ca_verification_status.
	 *
	 * @param input Net Worth Certificate parameters
	 */
	async generateNetWorthCertificate(input: NetWorthCertificateInput) {
		const [caPartner] = await db
			.select()
			.from(partners)
			.where(eq(partners.id, input.caPartnerId))
			.limit(1);

		if (!caPartner) {
			throw new Error("CA Partner not found");
		}

		const totalLiquid =
			input.liquidAssets.bankBalances +
			input.liquidAssets.mutualFunds +
			input.liquidAssets.listedEquities +
			input.liquidAssets.fixedDeposits +
			input.liquidAssets.bondsAndDebentures;

		const totalIlliquid =
			input.illiquidAssets.realEstate +
			input.illiquidAssets.goldAndJewellery +
			input.illiquidAssets.unlistedShares +
			input.illiquidAssets.vehiclesAndOther;

		const totalAssets = totalLiquid + totalIlliquid;

		const totalLiabilities =
			input.liabilities.homeLoans +
			input.liabilities.personalLoans +
			input.liabilities.creditCardsAndOther;

		const certifiedNetWorth = totalAssets - totalLiabilities;
		const certNo = `NWC-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

		const [createdVerification] = await db
			.insert(caVerificationStatus)
			.values({
				userId: input.userId,
				caId: caPartner.id,
				verificationType: "networth_certificate",
				status: "verified",
				certificateNumber: certNo,
				issueDate: new Date().toISOString().split("T")[0],
				verifiedNetworth: certifiedNetWorth.toString(),
				financialYear: `${new Date().getFullYear() - 1}-${new Date().getFullYear().toString().slice(-2)}`,
				udin: input.udin,
				udinVerified: input.udin ? this.validateUDINFormat(input.udin).isValid : false,
				udinVerifiedAt: input.udin ? new Date() : null,
				notes: `Net Worth certificate generated for ${input.purpose}. Certified Net Worth: ₹${certifiedNetWorth.toLocaleString("en-IN")}`,
			})
			.returning();

		return {
			success: true,
			certificate: {
				certificateId: createdVerification.id,
				certificateNumber: certNo,
				asOfDate: input.asOfDate,
				purpose: input.purpose,
				ca: {
					name: caPartner.companyName,
					firmName: caPartner.caFirmName,
					icaiNumber: caPartner.icaiMembershipNumber,
					membershipType: caPartner.icaiMembershipType,
				},
				summary: {
					totalLiquidAssets: totalLiquid,
					totalIlliquidAssets: totalIlliquid,
					totalGrossAssets: totalAssets,
					totalLiabilities,
					certifiedNetWorth,
				},
				breakdown: {
					liquid: input.liquidAssets,
					illiquid: input.illiquidAssets,
					liabilities: input.liabilities,
				},
				udin: input.udin,
				udinStatus: createdVerification.udinVerified ? "VERIFIED" : "UNVERIFIED",
			},
			meta: {
				engineVersion: this.engineVersion,
				issuedAt: new Date().toISOString(),
			},
		};
	}

	/**
	 * Lists certification history issued by a CA partner.
	 *
	 * @param caPartnerId CA Partner ID
	 */
	async getCertificationHistory(caPartnerId: string) {
		const history = await db
			.select()
			.from(caVerificationStatus)
			.where(eq(caVerificationStatus.caId, caPartnerId))
			.orderBy(desc(caVerificationStatus.createdAt));

		return history;
	}
}

export const caCertificationService = new CACertificationService();

