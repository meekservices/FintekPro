/**
 * W8/W9 Tax Form Service (Task 9)
 *
 * Determines and manages US tax form requirements for NRIs and foreign investors
 * FATCA/CRS compliant tax documentation
 */

interface W8FormData {
	formType: "W-8BEN" | "W-8BEN-E" | "W-8ECI" | "W-8EXP" | "W-8IMY";
	beneficialOwnerName: string;
	countryOfCitizenship: string;
	countryOfResidence: string;
	permanentResidenceAddress: {
		line1: string;
		line2?: string;
		city: string;
		stateProvince?: string;
		postalCode?: string;
		country: string;
	};
	mailingAddress?: {
		line1: string;
		line2?: string;
		city: string;
		stateProvince?: string;
		postalCode?: string;
		country: string;
	};
	tin?: string;
	tinType?: "SSN" | "ITIN" | "EIN" | "FOREIGN_TIN";
	foreignTIN?: string;
	foreignTINCountry?: string;
	dateOfBirth?: string;
	referenceNumber?: string;
	taxTreatyCountry?: string;
	taxTreatyArticle?: string;
	taxTreatyRate?: number;
	certificationDate: Date;
	signature?: string;
	expiresAt: Date;
}

interface W9FormData {
	name: string;
	businessName?: string;
	federalTaxClassification:
		| "individual"
		| "c_corporation"
		| "s_corporation"
		| "partnership"
		| "trust_estate"
		| "llc"
		| "other";
	llcClassification?: "C" | "S" | "P";
	exemptPayeeCode?: string;
	exemptFATCACode?: string;
	address: {
		line1: string;
		line2?: string;
		city: string;
		state: string;
		zipCode: string;
	};
	accountNumbers?: string;
	tin: string;
	tinType: "SSN" | "EIN";
	certificationDate: Date;
	signature?: string;
}

interface TaxFormDetermination {
	formRequired: "W-8BEN" | "W-8BEN-E" | "W-9" | "NONE";
	reason: string;
	taxTreatyBenefits: boolean;
	treatyCountry?: string;
	treatyRate?: number;
	withholdingRate: number;
}

interface TaxTreatyInfo {
	country: string;
	dividendRate: number;
	interestRate: number;
	royaltyRate: number;
	capitalGainsExempt: boolean;
	treatyArticles: { [key: string]: string };
}

class W8W9FormService {
	private forms: Map<string, W8FormData | W9FormData> = new Map();

	private readonly DEFAULT_WITHHOLDING_RATE = 30;
	private readonly FORM_VALIDITY_YEARS = 3;

	private readonly taxTreaties: Map<string, TaxTreatyInfo> = new Map([
		[
			"india",
			{
				country: "India",
				dividendRate: 15,
				interestRate: 10,
				royaltyRate: 10,
				capitalGainsExempt: true,
				treatyArticles: {
					dividends: "Article 10",
					interest: "Article 11",
					royalties: "Article 12",
					capitalGains: "Article 13",
				},
			},
		],
		[
			"uk",
			{
				country: "United Kingdom",
				dividendRate: 15,
				interestRate: 0,
				royaltyRate: 0,
				capitalGainsExempt: true,
				treatyArticles: {
					dividends: "Article 10",
					interest: "Article 11",
					royalties: "Article 12",
				},
			},
		],
		[
			"singapore",
			{
				country: "Singapore",
				dividendRate: 15,
				interestRate: 10,
				royaltyRate: 10,
				capitalGainsExempt: true,
				treatyArticles: {
					dividends: "Article 10",
					interest: "Article 11",
					royalties: "Article 12",
				},
			},
		],
		[
			"uae",
			{
				country: "United Arab Emirates",
				dividendRate: 0,
				interestRate: 0,
				royaltyRate: 0,
				capitalGainsExempt: true,
				treatyArticles: {
					general: "Article 4 - Resident",
				},
			},
		],
		[
			"canada",
			{
				country: "Canada",
				dividendRate: 15,
				interestRate: 10,
				royaltyRate: 0,
				capitalGainsExempt: true,
				treatyArticles: {
					dividends: "Article X",
					interest: "Article XI",
					royalties: "Article XII",
				},
			},
		],
		[
			"australia",
			{
				country: "Australia",
				dividendRate: 15,
				interestRate: 10,
				royaltyRate: 10,
				capitalGainsExempt: false,
				treatyArticles: {
					dividends: "Article 10",
					interest: "Article 11",
					royalties: "Article 12",
				},
			},
		],
	]);

	/**
	 * Determine which form is required based on investor status
	 */
	determineRequiredForm(
		isUSPerson: boolean,
		isUSResident: boolean,
		countryOfResidence: string,
		isEntity: boolean,
	): TaxFormDetermination {
		// US Persons require W-9
		if (isUSPerson || isUSResident) {
			return {
				formRequired: "W-9",
				reason: "US person or resident for tax purposes",
				taxTreatyBenefits: false,
				withholdingRate: 0,
			};
		}

		// Foreign entities require W-8BEN-E
		if (isEntity) {
			const treaty = this.getTaxTreaty(countryOfResidence);
			return {
				formRequired: "W-8BEN-E",
				reason: "Foreign entity receiving US-source income",
				taxTreatyBenefits: !!treaty,
				treatyCountry: treaty?.country,
				treatyRate: treaty?.dividendRate,
				withholdingRate: treaty?.dividendRate ?? this.DEFAULT_WITHHOLDING_RATE,
			};
		}

		// Foreign individuals require W-8BEN
		const treaty = this.getTaxTreaty(countryOfResidence);
		return {
			formRequired: "W-8BEN",
			reason: "Foreign individual receiving US-source income",
			taxTreatyBenefits: !!treaty,
			treatyCountry: treaty?.country,
			treatyRate: treaty?.dividendRate,
			withholdingRate: treaty?.dividendRate ?? this.DEFAULT_WITHHOLDING_RATE,
		};
	}

	/**
	 * Get tax treaty information for a country
	 */
	getTaxTreaty(country: string): TaxTreatyInfo | undefined {
		const normalizedCountry = country.toLowerCase().replace(/\s+/g, "");
		return this.taxTreaties.get(normalizedCountry);
	}

	/**
	 * Create W-8BEN form
	 */
	createW8BEN(
		userId: string,
		data: Omit<W8FormData, "formType" | "expiresAt">,
	): W8FormData {
		const expiresAt = new Date();
		expiresAt.setFullYear(expiresAt.getFullYear() + this.FORM_VALIDITY_YEARS);

		const form: W8FormData = {
			...data,
			formType: "W-8BEN",
			expiresAt,
		};

		this.forms.set(`W8-${userId}`, form);
		console.log(
			`📋 [W8/W9] Created W-8BEN for user ${userId.substring(0, 8)}..., expires: ${expiresAt.toISOString()}`,
		);

		return form;
	}

	/**
	 * Create W-9 form
	 */
	createW9(
		userId: string,
		data: Omit<W9FormData, "certificationDate">,
	): W9FormData {
		const form: W9FormData = {
			...data,
			certificationDate: new Date(),
		};

		this.forms.set(`W9-${userId}`, form);
		console.log(`📋 [W8/W9] Created W-9 for user ${userId.substring(0, 8)}...`);

		return form;
	}

	/**
	 * Get user's form
	 */
	getForm(userId: string): (W8FormData | W9FormData) | null {
		return (
			this.forms.get(`W8-${userId}`) || this.forms.get(`W9-${userId}`) || null
		);
	}

	/**
	 * Check if form is expired (W-8 only)
	 */
	isFormExpired(userId: string): boolean {
		const form = this.forms.get(`W8-${userId}`) as W8FormData;
		if (!form || !form.expiresAt) return false;
		return new Date() > form.expiresAt;
	}

	/**
	 * Get users with expiring W-8 forms (for renewal reminders)
	 */
	getExpiringForms(daysBeforeExpiry: number = 30): Array<{
		userId: string;
		formType: string;
		expiresAt: Date;
		daysUntilExpiry: number;
	}> {
		const expiring: Array<{
			userId: string;
			formType: string;
			expiresAt: Date;
			daysUntilExpiry: number;
		}> = [];

		const now = new Date();
		const cutoffDate = new Date(now);
		cutoffDate.setDate(cutoffDate.getDate() + daysBeforeExpiry);

		for (const [key, form] of this.forms.entries()) {
			if (key.startsWith("W8-") && "expiresAt" in form) {
				const w8Form = form as W8FormData;
				if (w8Form.expiresAt <= cutoffDate && w8Form.expiresAt > now) {
					const daysUntilExpiry = Math.ceil(
						(w8Form.expiresAt.getTime() - now.getTime()) /
							(24 * 60 * 60 * 1000),
					);
					expiring.push({
						userId: key.replace("W8-", ""),
						formType: w8Form.formType,
						expiresAt: w8Form.expiresAt,
						daysUntilExpiry,
					});
				}
			}
		}

		return expiring;
	}

	/**
	 * Calculate withholding rate
	 */
	calculateWithholdingRate(
		countryOfResidence: string,
		incomeType: "dividend" | "interest" | "royalty" | "capital_gains",
	): { rate: number; treatyApplied: boolean; treatyArticle?: string } {
		const treaty = this.getTaxTreaty(countryOfResidence);

		if (!treaty) {
			return { rate: this.DEFAULT_WITHHOLDING_RATE, treatyApplied: false };
		}

		let rate: number;
		let treatyArticle: string | undefined;

		switch (incomeType) {
			case "dividend":
				rate = treaty.dividendRate;
				treatyArticle = treaty.treatyArticles.dividends;
				break;
			case "interest":
				rate = treaty.interestRate;
				treatyArticle = treaty.treatyArticles.interest;
				break;
			case "royalty":
				rate = treaty.royaltyRate;
				treatyArticle = treaty.treatyArticles.royalties;
				break;
			case "capital_gains":
				rate = treaty.capitalGainsExempt ? 0 : this.DEFAULT_WITHHOLDING_RATE;
				treatyArticle = treaty.treatyArticles.capitalGains;
				break;
			default:
				rate = this.DEFAULT_WITHHOLDING_RATE;
		}

		return { rate, treatyApplied: true, treatyArticle };
	}

	/**
	 * Validate form data
	 */
	validateW8BEN(data: Partial<W8FormData>): {
		isValid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];

		if (!data.beneficialOwnerName)
			errors.push("Beneficial owner name is required");
		if (!data.countryOfCitizenship)
			errors.push("Country of citizenship is required");
		if (!data.countryOfResidence)
			errors.push("Country of residence is required");
		if (!data.permanentResidenceAddress?.line1)
			errors.push("Permanent residence address is required");
		if (!data.permanentResidenceAddress?.country)
			errors.push("Country in address is required");

		// Check for US person indicators
		if (
			data.countryOfCitizenship?.toLowerCase() === "usa" ||
			data.countryOfCitizenship?.toLowerCase() === "united states"
		) {
			errors.push("US citizens should complete Form W-9, not W-8BEN");
		}

		// Validate TIN if claiming treaty benefits
		if (data.taxTreatyCountry && !data.foreignTIN) {
			errors.push("Foreign TIN is required when claiming treaty benefits");
		}

		return { isValid: errors.length === 0, errors };
	}

	/**
	 * Export form for compliance reporting
	 */
	exportForCompliance(userId: string): {
		userId: string;
		hasForm: boolean;
		formType?: string;
		isExpired?: boolean;
		certificationType?: string;
		countryOfResidence?: string;
		withholdingRate?: number;
	} {
		const form = this.getForm(userId);

		if (!form) {
			return { userId, hasForm: false };
		}

		const isW8 = "formType" in form;

		return {
			userId,
			hasForm: true,
			formType: isW8 ? (form as W8FormData).formType : "W-9",
			isExpired: isW8 ? this.isFormExpired(userId) : false,
			certificationType: isW8 ? "W-8" : "W-9",
			countryOfResidence: isW8
				? (form as W8FormData).countryOfResidence
				: "United States",
		};
	}
}

export const w8W9FormService = new W8W9FormService();
export type { W8FormData, W9FormData, TaxFormDetermination, TaxTreatyInfo };
