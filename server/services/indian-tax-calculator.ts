/** GCR: bump when any slab, deduction limit, or formula changes */
export const INDIAN_TAX_CALCULATOR_ENGINE_VERSION = "1.0.0-AY2026-27";

interface ITRCalculationResponse {
	success: boolean;
	data?: {
		totalIncome: number;
		taxableIncome: number;
		totalDeductions: number;
		taxLiability: number;
		taxPaid: number;
		refundAmount: number;
		taxPayable: number;
		effectiveTaxRate: number;
	};
	message: string;
	/** GCR Financial Logic Integrity */
	engine_version: string;
	calculation_timestamp: string;
}

type EntityType =
	| "individual"
	| "huf"
	| "partnership_firm"
	| "llp"
	| "aop"
	| "boi"
	| "cooperative_society"
	| "local_authority"
	| "company"
	| "trust"
	| "political_party"
	| "institution"
	| "research_association"
	| "news_agency";

type TaxRegime = "old" | "new";

interface IncomeDetails {
	salaryIncome: number;
	businessIncome: number;
	capitalGains: number;
	otherIncome: number;
	interestIncome: number;
	rentalIncome: number;
	dividendIncome: number;
}

interface Deductions {
	section80C: number;
	section80D: number;
	section80G: number;
	homeLoanInterest: number;
	standardDeduction: number;
	professionalTax: number;
	otherDeductions: number;
}

interface TaxPayments {
	tdsDeducted: number;
	advanceTaxPaid: number;
	selfAssessmentTax: number;
}

interface TaxCalculationParams {
	personalInfo: {
		pan: string;
		firstName: string;
		lastName: string;
		dateOfBirth: string;
		email: string;
		phone: string;
		aadhar: string;
		address: {
			line1: string;
			line2?: string;
			city: string;
			state: string;
			pincode: string;
		};
	};
	incomeDetails: IncomeDetails;
	deductions: Deductions;
	taxPayments: TaxPayments;
	bankDetails: {
		accountNumber: string;
		ifscCode: string;
		bankName: string;
		accountHolderName: string;
	};
	filingDetails: {
		assessmentYear: string;
		itrForm: string;
		filingStatus: string;
		isDefective?: boolean;
		acknowledgmentNumber?: string;
	};
	entityType?: EntityType;
	regime?: TaxRegime;
	isSeniorCitizen?: boolean;
	isSuperSeniorCitizen?: boolean;
	companyTurnover?: number;
	companySection?: "115BAA" | "115BAB" | "normal";
	aopMembersIdentifiable?: boolean;
}

interface WizardData {
	assessmentYear: string;
	entityType: string;
	salaryIncome: number;
	housePropertyIncome: number;
	capitalGainsSTCG: number;
	capitalGainsLTCG: number;
	capitalGainsExemptions: number;
	businessIncome: number;
	interestIncome: number;
	dividendIncome: number;
	otherIncome: number;
	agriculturalIncome?: number;
	foreignTaxCredit?: number;
	foreignIncomeCountry?: string;
	section80C: number;
	section80CCC?: number;
	section80CCD1?: number;
	section80CCD1B?: number;
	section80CCD2?: number;
	section80D: number;
	section80DD?: number;
	section80DDB?: number;
	section80E: number;
	section80EEA?: number;
	section80EEB?: number;
	section80G: number;
	section80GG?: number;
	section80TTA: number;
	section80TTB?: number;
	section80U?: number;
	otherDeductions: number;
	tdsDeducted: number;
	tdsSalary?: number;
	tdsOtherThanSalary?: number;
	tdsOnProperty?: number;
	tcsCollected?: number;
	advanceTaxPaid: number;
	selfAssessmentTax: number;
	reliefUs89?: number;
	standardDeduction: number;
	professionalTax: number;
	homeLoanInterest: number;
	residentialStatus?: string;
	filingSection?: string;
	employerName?: string;
	employerTAN?: string;
	bankDetails?: {
		accountNumber: string;
		ifscCode: string;
		bankName?: string;
		accountType?: string;
	};
	regime?: TaxRegime;
	isSeniorCitizen?: boolean;
	isSuperSeniorCitizen?: boolean;
	companyTurnover?: number;
	companySection?: "115BAA" | "115BAB" | "normal";
	aopMembersIdentifiable?: boolean;
}

interface OptimalRegimeResult {
	recommended: TaxRegime;
	oldRegimeTax: number;
	newRegimeTax: number;
	savings: number;
}

export class IndianTaxCalculator {
	private getAge(dateOfBirth: string): number {
		const dob = new Date(dateOfBirth);
		const today = new Date();
		let age = today.getFullYear() - dob.getFullYear();
		const monthDiff = today.getMonth() - dob.getMonth();
		if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
			age--;
		}
		return age;
	}

	private isIndividualOrHUF(entityType: EntityType): boolean {
		return entityType === "individual" || entityType === "huf";
	}

	private isFirmOrLLP(entityType: EntityType): boolean {
		return entityType === "partnership_firm" || entityType === "llp";
	}

	private isCompany(entityType: EntityType): boolean {
		return entityType === "company";
	}

	private isTrustOrInstitution(entityType: EntityType): boolean {
		return [
			"trust",
			"political_party",
			"institution",
			"research_association",
			"news_agency",
		].includes(entityType);
	}

	private isAOPBOI(entityType: EntityType): boolean {
		return entityType === "aop" || entityType === "boi";
	}

	private computeGrossIncome(income: IncomeDetails): number {
		return (
			(income.salaryIncome || 0) +
			(income.businessIncome || 0) +
			(income.capitalGains || 0) +
			(income.otherIncome || 0) +
			(income.interestIncome || 0) +
			(income.rentalIncome || 0) +
			(income.dividendIncome || 0)
		);
	}

	private computeDeductionsOldRegime(
		deductions: Deductions,
		income: IncomeDetails,
		isSeniorCitizen: boolean,
		isSuperSeniorCitizen: boolean,
		hasSalary: boolean,
	): number {
		let total = 0;

		if (hasSalary) {
			total += Math.min(deductions.standardDeduction || 0, 50000);
		}

		total += Math.min(deductions.professionalTax || 0, 250000);
		total += Math.min(deductions.section80C || 0, 150000);
		total += Math.min(deductions.homeLoanInterest || 0, 200000);

		if (isSuperSeniorCitizen || isSeniorCitizen) {
			total += Math.min(deductions.section80D || 0, 50000);
		} else {
			total += Math.min(deductions.section80D || 0, 25000);
		}

		total += deductions.section80G || 0;
		total += deductions.otherDeductions || 0;

		return total;
	}

	private computeDeductionsOldRegimeWizard(
		wizardData: WizardData,
		hasSalary: boolean,
	): number {
		let total = 0;
		const isSenior = wizardData.isSeniorCitizen || false;
		const isSuperSenior = wizardData.isSuperSeniorCitizen || false;

		if (hasSalary) {
			total += Math.min(wizardData.standardDeduction || 0, 50000);
		}

		total += Math.min(wizardData.professionalTax || 0, 250000);

		const combined80C = Math.min(
			(wizardData.section80C || 0) +
				(wizardData.section80CCC || 0) +
				(wizardData.section80CCD1 || 0),
			150000,
		);
		total += combined80C;

		total += Math.min(wizardData.section80CCD1B || 0, 50000);

		const salaryForNPS = wizardData.salaryIncome || 0;
		total += Math.min(wizardData.section80CCD2 || 0, salaryForNPS * 0.1);

		if (isSuperSenior || isSenior) {
			total += Math.min(wizardData.section80D || 0, 50000);
		} else {
			total += Math.min(wizardData.section80D || 0, 25000);
		}

		total += Math.min(wizardData.section80DD || 0, 125000);
		total += Math.min(wizardData.section80DDB || 0, 100000);
		total += wizardData.section80E || 0;
		total += Math.min(wizardData.section80EEA || 0, 150000);
		total += Math.min(wizardData.section80EEB || 0, 150000);
		total += wizardData.section80G || 0;
		total += Math.min(wizardData.section80GG || 0, 60000);

		if (isSuperSenior || isSenior) {
			total += Math.min(wizardData.section80TTB || 0, 50000);
		} else {
			total += Math.min(wizardData.section80TTA || 0, 10000);
		}

		total += Math.min(wizardData.section80U || 0, 125000);
		total += Math.min(wizardData.homeLoanInterest || 0, 200000);
		total += wizardData.otherDeductions || 0;

		return total;
	}

	private computeDeductionsNewRegime(hasSalary: boolean): number {
		return hasSalary ? 75000 : 0;
	}

	private computeDeductionsNewRegimeWizard(
		wizardData: WizardData,
		hasSalary: boolean,
	): number {
		let total = hasSalary ? 75000 : 0;
		const salaryForNPS = wizardData.salaryIncome || 0;
		total += Math.min(wizardData.section80CCD2 || 0, salaryForNPS * 0.14);
		return total;
	}

	private computeIndividualTaxOldRegime(
		taxableIncome: number,
		isSeniorCitizen: boolean,
		isSuperSeniorCitizen: boolean,
	): number {
		let exemptionLimit = 250000;
		if (isSuperSeniorCitizen) exemptionLimit = 500000;
		else if (isSeniorCitizen) exemptionLimit = 300000;

		if (taxableIncome <= exemptionLimit) return 0;

		let tax = 0;
		let remaining = taxableIncome;

		if (remaining > 1000000) {
			tax += (remaining - 1000000) * 0.3;
			remaining = 1000000;
		}
		if (remaining > 500000) {
			tax += (remaining - 500000) * 0.2;
			remaining = 500000;
		}
		if (remaining > exemptionLimit) {
			tax += (remaining - exemptionLimit) * 0.05;
		}

		if (taxableIncome <= 500000) {
			const rebate = Math.min(tax, 12500);
			tax -= rebate;
		}

		return Math.max(0, tax);
	}

	/**
	 * Budget 2025-26 new regime slabs (AY 2026-27 onwards):
	 * Nil → ₹4,00,000 | 5% → ₹8,00,000 | 10% → ₹12,00,000
	 * 15% → ₹16,00,000 | 20% → ₹20,00,000 | 25% → ₹24,00,000 | 30% above
	 * 87A rebate: ₹60,000 for taxable income ≤ ₹12,00,000 (effective nil tax up to ₹12L)
	 */
	private computeIndividualTaxNewRegimeAY2026(taxableIncome: number): number {
		if (taxableIncome <= 400000) return 0;

		let tax = 0;
		let remaining = taxableIncome;

		if (remaining > 2400000) {
			tax += (remaining - 2400000) * 0.3;
			remaining = 2400000;
		}
		if (remaining > 2000000) {
			tax += (remaining - 2000000) * 0.25;
			remaining = 2000000;
		}
		if (remaining > 1600000) {
			tax += (remaining - 1600000) * 0.2;
			remaining = 1600000;
		}
		if (remaining > 1200000) {
			tax += (remaining - 1200000) * 0.15;
			remaining = 1200000;
		}
		if (remaining > 800000) {
			tax += (remaining - 800000) * 0.1;
			remaining = 800000;
		}
		if (remaining > 400000) {
			tax += (remaining - 400000) * 0.05;
		}

		if (taxableIncome <= 1200000) {
			const rebate = Math.min(tax, 60000);
			tax -= rebate;
		}

		return Math.max(0, tax);
	}

	/**
	 * AY 2025-26 and earlier new regime slabs:
	 * Nil → ₹3,00,000 | 5% → ₹7,00,000 | 10% → ₹10,00,000
	 * 15% → ₹12,00,000 | 20% → ₹15,00,000 | 30% above
	 * 87A rebate: ₹25,000 for taxable income ≤ ₹7,00,000
	 */
	private computeIndividualTaxNewRegimeAY2025(taxableIncome: number): number {
		if (taxableIncome <= 300000) return 0;

		let tax = 0;
		let remaining = taxableIncome;

		if (remaining > 1500000) {
			tax += (remaining - 1500000) * 0.3;
			remaining = 1500000;
		}
		if (remaining > 1200000) {
			tax += (remaining - 1200000) * 0.2;
			remaining = 1200000;
		}
		if (remaining > 1000000) {
			tax += (remaining - 1000000) * 0.15;
			remaining = 1000000;
		}
		if (remaining > 700000) {
			tax += (remaining - 700000) * 0.1;
			remaining = 700000;
		}
		if (remaining > 300000) {
			tax += (remaining - 300000) * 0.05;
		}

		if (taxableIncome <= 700000) {
			const rebate = Math.min(tax, 25000);
			tax -= rebate;
		}

		return Math.max(0, tax);
	}

	private computeIndividualTaxNewRegime(
		taxableIncome: number,
		assessmentYear?: string,
	): number {
		if (assessmentYear === "2026-27") {
			return this.computeIndividualTaxNewRegimeAY2026(taxableIncome);
		}
		return this.computeIndividualTaxNewRegimeAY2025(taxableIncome);
	}

	private computeFirmTax(taxableIncome: number): number {
		return taxableIncome * 0.3;
	}

	private computeCompanyTax(
		taxableIncome: number,
		companySection?: "115BAA" | "115BAB" | "normal",
		companyTurnover?: number,
	): number {
		if (companySection === "115BAB") {
			return taxableIncome * 0.15;
		}
		if (companySection === "115BAA") {
			return taxableIncome * 0.22;
		}
		if (companyTurnover !== undefined && companyTurnover <= 4000000000) {
			return taxableIncome * 0.25;
		}
		return taxableIncome * 0.3;
	}

	private computeSurchargeIndividual(
		basicTax: number,
		taxableIncome: number,
		regime: TaxRegime,
		assessmentYear?: string,
	): number {
		let rate = 0;
		if (taxableIncome > 50000000) rate = 0.37;
		else if (taxableIncome > 20000000) rate = 0.25;
		else if (taxableIncome > 10000000) rate = 0.15;
		else if (taxableIncome > 5000000) rate = 0.1;

		if (regime === "new" && rate > 0.25) {
			rate = 0.25;
		}

		let surcharge = basicTax * rate;

		if (rate > 0) {
			const prevThreshold = this.getSurchargeThreshold(rate);
			const taxAtThreshold = this.computeTaxAtThreshold(
				prevThreshold,
				regime,
				assessmentYear,
			);
			const prevRate = this.getPrevSurchargeRate(rate);
			const prevSurcharge = taxAtThreshold * prevRate;
			const prevCess = (taxAtThreshold + prevSurcharge) * 0.04;
			const totalAtThreshold = taxAtThreshold + prevSurcharge + prevCess;

			const currentTaxBeforeCess = basicTax + surcharge;
			const currentCess = currentTaxBeforeCess * 0.04;
			const totalCurrent = currentTaxBeforeCess + currentCess;

			const incomeAboveThreshold = taxableIncome - prevThreshold;
			if (totalCurrent - totalAtThreshold > incomeAboveThreshold) {
				surcharge = Math.max(
					0,
					totalAtThreshold + incomeAboveThreshold - basicTax - basicTax * 0.04,
				);
			}
		}

		return surcharge;
	}

	private getSurchargeThreshold(rate: number): number {
		if (rate === 0.37) return 50000000;
		if (rate === 0.25) return 20000000;
		if (rate === 0.15) return 10000000;
		if (rate === 0.1) return 5000000;
		return 0;
	}

	private getPrevSurchargeRate(rate: number): number {
		if (rate === 0.37) return 0.25;
		if (rate === 0.25) return 0.15;
		if (rate === 0.15) return 0.1;
		if (rate === 0.1) return 0;
		return 0;
	}

	private computeTaxAtThreshold(
		threshold: number,
		regime: TaxRegime,
		assessmentYear?: string,
	): number {
		if (regime === "new")
			return this.computeIndividualTaxNewRegime(threshold, assessmentYear);
		return this.computeIndividualTaxOldRegime(threshold, false, false);
	}

	private computeSurchargeFirm(
		basicTax: number,
		taxableIncome: number,
	): number {
		if (taxableIncome > 10000000) {
			return basicTax * 0.12;
		}
		return 0;
	}

	private computeSurchargeCompany(
		basicTax: number,
		taxableIncome: number,
		companySection?: "115BAA" | "115BAB" | "normal",
	): number {
		const isConcessional =
			companySection === "115BAA" || companySection === "115BAB";

		if (isConcessional) {
			if (taxableIncome > 100000000) return basicTax * 0.12;
			if (taxableIncome > 10000000) return basicTax * 0.07;
		} else {
			if (taxableIncome > 100000000) return basicTax * 0.12;
			if (taxableIncome > 10000000) return basicTax * 0.1;
		}
		return 0;
	}

	private computeFull(
		grossIncome: number,
		totalDeductions: number,
		taxPaid: number,
		entityType: EntityType,
		regime: TaxRegime,
		options: {
			isSeniorCitizen?: boolean;
			isSuperSeniorCitizen?: boolean;
			companyTurnover?: number;
			companySection?: "115BAA" | "115BAB" | "normal";
			aopMembersIdentifiable?: boolean;
			assessmentYear?: string;
		} = {},
	): ITRCalculationResponse["data"] {
		const taxableIncome = Math.max(0, grossIncome - totalDeductions);
		const ay = options.assessmentYear;

		let basicTax = 0;
		let surcharge = 0;

		if (this.isIndividualOrHUF(entityType)) {
			if (regime === "new") {
				basicTax = this.computeIndividualTaxNewRegime(taxableIncome, ay);
			} else {
				basicTax = this.computeIndividualTaxOldRegime(
					taxableIncome,
					options.isSeniorCitizen || false,
					options.isSuperSeniorCitizen || false,
				);
			}
			surcharge = this.computeSurchargeIndividual(
				basicTax,
				taxableIncome,
				regime,
				ay,
			);
		} else if (this.isFirmOrLLP(entityType)) {
			basicTax = this.computeFirmTax(taxableIncome);
			surcharge = this.computeSurchargeFirm(basicTax, taxableIncome);
		} else if (this.isCompany(entityType)) {
			basicTax = this.computeCompanyTax(
				taxableIncome,
				options.companySection,
				options.companyTurnover,
			);
			surcharge = this.computeSurchargeCompany(
				basicTax,
				taxableIncome,
				options.companySection,
			);
		} else if (this.isAOPBOI(entityType)) {
			if (options.aopMembersIdentifiable) {
				if (regime === "new") {
					basicTax = this.computeIndividualTaxNewRegime(taxableIncome, ay);
				} else {
					basicTax = this.computeIndividualTaxOldRegime(
						taxableIncome,
						false,
						false,
					);
				}
				surcharge = this.computeSurchargeIndividual(
					basicTax,
					taxableIncome,
					regime,
					ay,
				);
			} else {
				basicTax = taxableIncome * 0.3;
				surcharge = this.computeSurchargeIndividual(
					basicTax,
					taxableIncome,
					regime,
					ay,
				);
			}
		} else if (this.isTrustOrInstitution(entityType)) {
			basicTax = taxableIncome * 0.3;
			surcharge = this.computeSurchargeIndividual(
				basicTax,
				taxableIncome,
				regime,
				ay,
			);
		} else {
			if (regime === "new") {
				basicTax = this.computeIndividualTaxNewRegime(taxableIncome, ay);
			} else {
				basicTax = this.computeIndividualTaxOldRegime(
					taxableIncome,
					false,
					false,
				);
			}
			surcharge = this.computeSurchargeIndividual(
				basicTax,
				taxableIncome,
				regime,
				ay,
			);
		}

		const cess = Math.round((basicTax + surcharge) * 0.04);
		const totalTax = Math.round(basicTax + surcharge + cess);

		const taxPayable = Math.max(0, totalTax - taxPaid);
		const refundAmount = Math.max(0, taxPaid - totalTax);

		const effectiveTaxRate =
			grossIncome > 0 ? Math.round((totalTax / grossIncome) * 10000) / 100 : 0;

		return {
			totalIncome: Math.round(grossIncome),
			taxableIncome: Math.round(taxableIncome),
			totalDeductions: Math.round(totalDeductions),
			taxLiability: Math.round(totalTax),
			taxPaid: Math.round(taxPaid),
			refundAmount: Math.round(refundAmount),
			taxPayable: Math.round(taxPayable),
			effectiveTaxRate,
		};
	}

	calculateTax(params: TaxCalculationParams): ITRCalculationResponse {
		try {
			const entityType: EntityType = params.entityType || "individual";
			const regime: TaxRegime = params.regime || "new";

			let isSeniorCitizen = params.isSeniorCitizen || false;
			let isSuperSeniorCitizen = params.isSuperSeniorCitizen || false;

			if (entityType === "individual" && params.personalInfo?.dateOfBirth) {
				const age = this.getAge(params.personalInfo.dateOfBirth);
				if (age >= 80) isSuperSeniorCitizen = true;
				else if (age >= 60) isSeniorCitizen = true;
			}

			const income = params.incomeDetails;
			const grossIncome = this.computeGrossIncome(income);
			const hasSalary = (income.salaryIncome || 0) > 0;

			let totalDeductions = 0;
			if (this.isIndividualOrHUF(entityType)) {
				if (regime === "old") {
					totalDeductions = this.computeDeductionsOldRegime(
						params.deductions,
						income,
						isSeniorCitizen,
						isSuperSeniorCitizen,
						hasSalary,
					);
				} else {
					totalDeductions = this.computeDeductionsNewRegime(hasSalary);
				}
			}

			const taxPaid =
				(params.taxPayments.tdsDeducted || 0) +
				(params.taxPayments.advanceTaxPaid || 0) +
				(params.taxPayments.selfAssessmentTax || 0);

			const assessmentYear = params.filingDetails?.assessmentYear || "2025-26";

			const data = this.computeFull(
				grossIncome,
				totalDeductions,
				taxPaid,
				entityType,
				regime,
				{
					isSeniorCitizen,
					isSuperSeniorCitizen,
					companyTurnover: params.companyTurnover,
					companySection: params.companySection,
					aopMembersIdentifiable: params.aopMembersIdentifiable,
					assessmentYear,
				},
			);

			return {
				success: true,
				data: data!,
				message: `Tax calculated using native Indian Tax Calculator (${regime.toUpperCase()} regime, AY ${assessmentYear})`,
				engine_version: INDIAN_TAX_CALCULATOR_ENGINE_VERSION,
				calculation_timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error("[IndianTaxCalculator] calculateTax error:", error);
			return {
				success: false,
				message:
					error instanceof Error ? error.message : "Tax calculation failed",
				engine_version: INDIAN_TAX_CALCULATOR_ENGINE_VERSION,
				calculation_timestamp: new Date().toISOString(),
			};
		}
	}

	calculateTaxFromWizard(wizardData: WizardData): ITRCalculationResponse {
		try {
			const entityType = (wizardData.entityType || "individual") as EntityType;
			const regime: TaxRegime = wizardData.regime || "new";

			const totalCapitalGains = Math.max(
				0,
				(wizardData.capitalGainsSTCG || 0) +
					(wizardData.capitalGainsLTCG || 0) -
					(wizardData.capitalGainsExemptions || 0),
			);

			const grossIncome =
				(wizardData.salaryIncome || 0) +
				(wizardData.housePropertyIncome || 0) +
				totalCapitalGains +
				(wizardData.businessIncome || 0) +
				(wizardData.interestIncome || 0) +
				(wizardData.dividendIncome || 0) +
				(wizardData.otherIncome || 0);

			const hasSalary = (wizardData.salaryIncome || 0) > 0;
			const isSenior = wizardData.isSeniorCitizen || false;
			const isSuperSenior = wizardData.isSuperSeniorCitizen || false;

			let totalDeductions = 0;

			if (this.isIndividualOrHUF(entityType) || this.isAOPBOI(entityType)) {
				if (regime === "old") {
					totalDeductions = this.computeDeductionsOldRegimeWizard(
						wizardData,
						hasSalary,
					);
				} else {
					totalDeductions = this.computeDeductionsNewRegimeWizard(
						wizardData,
						hasSalary,
					);
				}
			}

			const taxPaid =
				(wizardData.tdsDeducted || 0) +
				(wizardData.advanceTaxPaid || 0) +
				(wizardData.selfAssessmentTax || 0) +
				(wizardData.tcsCollected || 0);

			const relief89 = wizardData.reliefUs89 || 0;
			const foreignTaxCredit = wizardData.foreignTaxCredit || 0;

			const data = this.computeFull(
				grossIncome,
				totalDeductions,
				taxPaid,
				entityType,
				regime,
				{
					isSeniorCitizen: isSenior,
					isSuperSeniorCitizen: isSuperSenior,
					companyTurnover: wizardData.companyTurnover,
					companySection: wizardData.companySection,
					aopMembersIdentifiable: wizardData.aopMembersIdentifiable,
					assessmentYear: wizardData.assessmentYear,
				},
			);

			if (data) {
				const totalRelief = relief89 + foreignTaxCredit;
				if (totalRelief > 0) {
					data.taxLiability = Math.max(0, data.taxLiability - totalRelief);
					data.taxPayable = Math.max(0, data.taxLiability - data.taxPaid);
					data.refundAmount = Math.max(0, data.taxPaid - data.taxLiability);
					data.effectiveTaxRate =
						grossIncome > 0
							? Math.round((data.taxLiability / grossIncome) * 10000) / 100
							: 0;
				}
			}

			return {
				success: true,
				data: data!,
				message: `Tax calculated using native Indian Tax Calculator (${regime.toUpperCase()} regime, AY ${wizardData.assessmentYear || "2025-26"})`,
				engine_version: INDIAN_TAX_CALCULATOR_ENGINE_VERSION,
				calculation_timestamp: new Date().toISOString(),
			};
		} catch (error) {
			console.error(
				"[IndianTaxCalculator] calculateTaxFromWizard error:",
				error,
			);
			return {
				success: false,
				message:
					error instanceof Error
						? error.message
						: "Wizard tax calculation failed",
				engine_version: INDIAN_TAX_CALCULATOR_ENGINE_VERSION,
				calculation_timestamp: new Date().toISOString(),
			};
		}
	}

	getOptimalRegime(
		incomeDetailsOrWizard: IncomeDetails | WizardData,
		deductions?: Deductions,
		options?: {
			isSeniorCitizen?: boolean;
			isSuperSeniorCitizen?: boolean;
			entityType?: EntityType;
		},
	): OptimalRegimeResult {
		const entityType = options?.entityType || "individual";

		if (!this.isIndividualOrHUF(entityType)) {
			return {
				recommended: "new",
				oldRegimeTax: 0,
				newRegimeTax: 0,
				savings: 0,
			};
		}

		if ("capitalGainsSTCG" in incomeDetailsOrWizard) {
			const wizardData = incomeDetailsOrWizard as WizardData;

			const oldResult = this.calculateTaxFromWizard({
				...wizardData,
				regime: "old",
				isSeniorCitizen: options?.isSeniorCitizen || wizardData.isSeniorCitizen,
				isSuperSeniorCitizen:
					options?.isSuperSeniorCitizen || wizardData.isSuperSeniorCitizen,
			});

			const newResult = this.calculateTaxFromWizard({
				...wizardData,
				regime: "new",
				isSeniorCitizen: options?.isSeniorCitizen || wizardData.isSeniorCitizen,
				isSuperSeniorCitizen:
					options?.isSuperSeniorCitizen || wizardData.isSuperSeniorCitizen,
			});

			const oldTax = oldResult.data?.taxLiability || 0;
			const newTax = newResult.data?.taxLiability || 0;

			return {
				recommended: oldTax <= newTax ? "old" : "new",
				oldRegimeTax: oldTax,
				newRegimeTax: newTax,
				savings: Math.abs(oldTax - newTax),
			};
		}

		const income = incomeDetailsOrWizard as IncomeDetails;
		const ded = deductions || {
			section80C: 0,
			section80D: 0,
			section80G: 0,
			homeLoanInterest: 0,
			standardDeduction: 50000,
			professionalTax: 0,
			otherDeductions: 0,
		};

		const grossIncome = this.computeGrossIncome(income);
		const hasSalary = (income.salaryIncome || 0) > 0;
		const isSenior = options?.isSeniorCitizen || false;
		const isSuperSenior = options?.isSuperSeniorCitizen || false;

		const oldDeductions = this.computeDeductionsOldRegime(
			ded,
			income,
			isSenior,
			isSuperSenior,
			hasSalary,
		);
		const newDeductions = this.computeDeductionsNewRegime(hasSalary);

		const oldData = this.computeFull(
			grossIncome,
			oldDeductions,
			0,
			entityType,
			"old",
			{
				isSeniorCitizen: isSenior,
				isSuperSeniorCitizen: isSuperSenior,
			},
		);

		const newData = this.computeFull(
			grossIncome,
			newDeductions,
			0,
			entityType,
			"new",
			{
				isSeniorCitizen: isSenior,
				isSuperSeniorCitizen: isSuperSenior,
			},
		);

		const oldTax = oldData?.taxLiability || 0;
		const newTax = newData?.taxLiability || 0;

		return {
			recommended: oldTax <= newTax ? "old" : "new",
			oldRegimeTax: oldTax,
			newRegimeTax: newTax,
			savings: Math.abs(oldTax - newTax),
		};
	}
}

export const indianTaxCalculator = new IndianTaxCalculator();
