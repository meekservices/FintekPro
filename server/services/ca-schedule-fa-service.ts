export interface ForeignAssetHoldingInput {
	symbol: string;
	companyName: string;
	countryCode?: string; // Default "02" (USA)
	currency?: string; // Default "USD"
	initialCostUsd: number;
	peakValueUsd: number;
	closingValueUsd: number;
	grossDividendsUsd: number;
	usWithholdingTaxUsd: number;
	grossSaleProceedsUsd?: number;
	acquisitionDate?: string;
}

export interface ScheduleFaInput {
	calendarYear: number; // e.g. 2024
	sbiTtBuyingRate: number; // SBI TT buying rate as on reference date, e.g. 84.50
	indianTaxSlabRatePercent: number; // e.g. 30% or 31.2% with cess
	holdings: ForeignAssetHoldingInput[];
}

export interface ScheduleFaTableA3Row {
	countryName: string;
	countryCode: string;
	nameOfEntity: string;
	zipCode: string;
	initialValueInr: number;
	peakValueInr: number;
	closingValueInr: number;
	grossAmountPaidCreditedInr: number;
	grossProceedsSaleRedemptionInr: number;
}

export interface Form67FtcCalculation {
	foreignIncomeInr: number;
	usTaxPaidInr: number;
	indianTaxPayableInr: number;
	eligibleForeignTaxCreditInr: number;
	articleDtaa: string;
	ruleApplicable: string;
}

export interface ScheduleFaReport {
	calendarYear: number;
	assessmentYear: string;
	engineVersion: string;
	calculationTimestamp: string;
	sbiTtBuyingRate: number;
	summary: {
		totalInitialValueInr: number;
		totalPeakValueInr: number;
		totalClosingValueInr: number;
		totalGrossDividendInr: number;
		totalForeignTaxPaidInr: number;
		totalEligibleFtcInr: number;
	};
	tableA3Rows: ScheduleFaTableA3Row[];
	form67Draft: Form67FtcCalculation;
	statutoryWarning: string;
}

/**
 * Service to generate statutory Schedule FA (Foreign Assets) Table A3 disclosures
 * and compute Form 67 Foreign Tax Credit (FTC) for foreign stocks and RSUs/ESOPs.
 */
export class CAScheduleFaService {
	private readonly engineVersion = "SCHEDULE_FA_FTC_V1.0";

	/**
	 * Computes Schedule FA disclosures and Form 67 FTC draft.
	 *
	 * @param input Schedule FA input holding records
	 */
	generateReport(input: ScheduleFaInput): ScheduleFaReport {
		const rate = input.sbiTtBuyingRate || 85.0;
		const slabRate = (input.indianTaxSlabRatePercent || 30) / 100;
		const cy = input.calendarYear || new Date().getFullYear() - 1;
		const ay = `${cy + 1}-${(cy + 2).toString().slice(-2)}`;

		const tableA3Rows: ScheduleFaTableA3Row[] = [];
		let totalInitialInr = 0;
		let totalPeakInr = 0;
		let totalClosingInr = 0;
		let totalDividendInr = 0;
		let totalUsTaxInr = 0;

		for (const h of input.holdings) {
			const initialInr = Math.round(h.initialCostUsd * rate);
			const peakInr = Math.round(h.peakValueUsd * rate);
			const closingInr = Math.round(h.closingValueUsd * rate);
			const divInr = Math.round(h.grossDividendsUsd * rate);
			const usTaxInr = Math.round(h.usWithholdingTaxUsd * rate);
			const saleInr = Math.round((h.grossSaleProceedsUsd || 0) * rate);

			totalInitialInr += initialInr;
			totalPeakInr += peakInr;
			totalClosingInr += closingInr;
			totalDividendInr += divInr;
			totalUsTaxInr += usTaxInr;

			tableA3Rows.push({
				countryName: "United States of America",
				countryCode: h.countryCode || "02",
				nameOfEntity: h.companyName,
				zipCode: "94043",
				initialValueInr: initialInr,
				peakValueInr: peakInr,
				closingValueInr: closingInr,
				grossAmountPaidCreditedInr: divInr,
				grossProceedsSaleRedemptionInr: saleInr,
			});
		}

		// Form 67 Foreign Tax Credit (FTC) under Section 90 and Rule 128
		// FTC is lower of:
		// 1. Tax paid in foreign country (US 25% withholding)
		// 2. Indian tax payable on such foreign income at assessee's slab rate
		const indianTaxOnForeignIncome = Math.round(totalDividendInr * slabRate);
		const eligibleFtc = Math.min(totalUsTaxInr, indianTaxOnForeignIncome);

		return {
			calendarYear: cy,
			assessmentYear: ay,
			engineVersion: this.engineVersion,
			calculationTimestamp: new Date().toISOString(),
			sbiTtBuyingRate: rate,
			summary: {
				totalInitialValueInr: totalInitialInr,
				totalPeakValueInr: totalPeakInr,
				totalClosingValueInr: totalClosingInr,
				totalGrossDividendInr: totalDividendInr,
				totalForeignTaxPaidInr: totalUsTaxInr,
				totalEligibleFtcInr: eligibleFtc,
			},
			tableA3Rows,
			form67Draft: {
				foreignIncomeInr: totalDividendInr,
				usTaxPaidInr: totalUsTaxInr,
				indianTaxPayableInr: indianTaxOnForeignIncome,
				eligibleForeignTaxCreditInr: eligibleFtc,
				articleDtaa: "Article 10 (Dividends) & Article 25 (Relief from Double Taxation) of Indo-US DTAA",
				ruleApplicable: "Rule 128 of Income-tax Rules, 1962 (Form 67 mandatory before filing ITR)",
			},
			statutoryWarning:
				"Non-disclosure of foreign assets in Schedule FA attracts ₹10,00,000 penalty under Section 43 of the Black Money Act, 2015, irrespective of taxable income.",
		};
	}
}

export const caScheduleFaService = new CAScheduleFaService();

