export interface AdvanceTaxPaymentRecord {
	installment: 1 | 2 | 3 | 4;
	datePaid: string;
	amount: number;
	challanNo?: string;
	bsrCode?: string;
}

export interface AdvanceTaxCalculationInput {
	financialYear: string; // e.g. "2024-25"
	estimatedGrossTax: number; // Tax payable before TDS/TCS
	estimatedTdsTcs: number; // Projected TDS/TCS credit
	actualPayments?: AdvanceTaxPaymentRecord[];
	asOfDate?: string; // Optional current evaluation date
}

export interface InstallmentScheduleItem {
	installmentNumber: 1 | 2 | 3 | 4;
	quarterName: string;
	dueDate: string;
	statutoryPercentage: number;
	concessionalThresholdPercentage: number;
	cumulativeTargetAmount: number;
	incrementalDueAmount: number;
	cumulativePaidAmount: number;
	shortfall: number;
	interestSec234C: number;
	status: "PAID" | "SHORTFALL" | "UPCOMING";
}

export interface AdvanceTaxSimulationReport {
	financialYear: string;
	assessmentYear: string;
	engineVersion: string;
	calculationTimestamp: string;
	isAdvanceTaxApplicable: boolean;
	summary: {
		estimatedGrossTax: number;
		estimatedTdsTcs: number;
		assessedTax: number;
		totalAdvanceTaxPaid: number;
		totalShortfall: number;
		totalInterest234C: number;
		totalInterest234B: number;
		totalAmountPayable: number;
	};
	schedule: InstallmentScheduleItem[];
	ePayTaxPaymentUrl: string;
	complianceAdvice: string[];
}

/**
 * Service to calculate Advance Tax liability under Section 208/211
 * and simulate penalty interest under Sections 234B and 234C.
 */
export class CAAdvanceTaxService {
	private readonly engineVersion = "ADVANCE_TAX_SIM_V1.0";

	/**
	 * Calculates quarterly advance tax schedule, shortfalls, and interest.
	 *
	 * @param input Advance tax computation parameters
	 */
	calculateSchedule(input: AdvanceTaxCalculationInput): AdvanceTaxSimulationReport {
		const grossTax = Math.max(0, input.estimatedGrossTax);
		const tds = Math.max(0, input.estimatedTdsTcs);
		const assessedTax = Math.max(0, grossTax - tds);

		// Section 208: Advance tax applies only if assessed tax >= 10,000
		const isApplicable = assessedTax >= 10000;

		const startYear = Number.parseInt(input.financialYear.split("-")[0]) || new Date().getFullYear();
		const ay = `${startYear + 1}-${(startYear + 2).toString().slice(-2)}`;

		const payments = input.actualPayments || [];
		const paidByInstallment: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
		for (const p of payments) {
			if (paidByInstallment[p.installment] !== undefined) {
				paidByInstallment[p.installment] += p.amount;
			}
		}

		let cumulativePaid = 0;
		const schedule: InstallmentScheduleItem[] = [];

		// Quarter 1: June 15 (15% cumulative, threshold 12%)
		cumulativePaid += paidByInstallment[1];
		const q1Target = Math.round(assessedTax * 0.15);
		const q1Threshold = Math.round(assessedTax * 0.12);
		const q1Shortfall = isApplicable ? Math.max(0, q1Target - cumulativePaid) : 0;
		// Sec 234C: 1% per month for 3 months on shortfall if paid < 12%
		const q1Interest = (isApplicable && cumulativePaid < q1Threshold)
			? Math.round((q1Target - cumulativePaid) * 0.01 * 3)
			: 0;

		schedule.push({
			installmentNumber: 1,
			quarterName: "Q1 (April - June)",
			dueDate: `${startYear}-06-15`,
			statutoryPercentage: 15,
			concessionalThresholdPercentage: 12,
			cumulativeTargetAmount: q1Target,
			incrementalDueAmount: q1Target,
			cumulativePaidAmount: cumulativePaid,
			shortfall: q1Shortfall,
			interestSec234C: q1Interest,
			status: !isApplicable ? "PAID" : q1Shortfall === 0 ? "PAID" : "SHORTFALL",
		});

		// Quarter 2: Sept 15 (45% cumulative, threshold 36%)
		cumulativePaid += paidByInstallment[2];
		const q2Target = Math.round(assessedTax * 0.45);
		const q2Threshold = Math.round(assessedTax * 0.36);
		const q2Shortfall = isApplicable ? Math.max(0, q2Target - cumulativePaid) : 0;
		const q2Interest = (isApplicable && cumulativePaid < q2Threshold)
			? Math.round((q2Target - cumulativePaid) * 0.01 * 3)
			: 0;

		schedule.push({
			installmentNumber: 2,
			quarterName: "Q2 (July - September)",
			dueDate: `${startYear}-09-15`,
			statutoryPercentage: 45,
			concessionalThresholdPercentage: 36,
			cumulativeTargetAmount: q2Target,
			incrementalDueAmount: Math.max(0, q2Target - q1Target),
			cumulativePaidAmount: cumulativePaid,
			shortfall: q2Shortfall,
			interestSec234C: q2Interest,
			status: !isApplicable ? "PAID" : q2Shortfall === 0 ? "PAID" : "SHORTFALL",
		});

		// Quarter 3: Dec 15 (75% cumulative)
		cumulativePaid += paidByInstallment[3];
		const q3Target = Math.round(assessedTax * 0.75);
		const q3Shortfall = isApplicable ? Math.max(0, q3Target - cumulativePaid) : 0;
		const q3Interest = (isApplicable && cumulativePaid < q3Target)
			? Math.round((q3Target - cumulativePaid) * 0.01 * 3)
			: 0;

		schedule.push({
			installmentNumber: 3,
			quarterName: "Q3 (October - December)",
			dueDate: `${startYear}-12-15`,
			statutoryPercentage: 75,
			concessionalThresholdPercentage: 75,
			cumulativeTargetAmount: q3Target,
			incrementalDueAmount: Math.max(0, q3Target - q2Target),
			cumulativePaidAmount: cumulativePaid,
			shortfall: q3Shortfall,
			interestSec234C: q3Interest,
			status: !isApplicable ? "PAID" : q3Shortfall === 0 ? "PAID" : "SHORTFALL",
		});

		// Quarter 4: March 15 (100% cumulative)
		cumulativePaid += paidByInstallment[4];
		const q4Target = assessedTax;
		const q4Shortfall = isApplicable ? Math.max(0, q4Target - cumulativePaid) : 0;
		// 1% for 1 month
		const q4Interest = (isApplicable && cumulativePaid < q4Target)
			? Math.round((q4Target - cumulativePaid) * 0.01 * 1)
			: 0;

		schedule.push({
			installmentNumber: 4,
			quarterName: "Q4 (January - March)",
			dueDate: `${startYear + 1}-03-15`,
			statutoryPercentage: 100,
			concessionalThresholdPercentage: 100,
			cumulativeTargetAmount: q4Target,
			incrementalDueAmount: Math.max(0, q4Target - q3Target),
			cumulativePaidAmount: cumulativePaid,
			shortfall: q4Shortfall,
			interestSec234C: q4Interest,
			status: !isApplicable ? "PAID" : q4Shortfall === 0 ? "PAID" : "SHORTFALL",
		});

		const totalInterest234C = q1Interest + q2Interest + q3Interest + q4Interest;

		// Section 234B Interest: Applies if total advance tax paid by Mar 31 is < 90% of assessed tax
		// 1% per month on shortfall from April 1 of AY
		let totalInterest234B = 0;
		if (isApplicable && cumulativePaid < Math.round(assessedTax * 0.90)) {
			const bShortfall = assessedTax - cumulativePaid;
			totalInterest234B = Math.round(bShortfall * 0.01 * 3); // Estimated for first quarter of AY
		}

		const totalShortfall = isApplicable ? Math.max(0, assessedTax - cumulativePaid) : 0;
		const totalAmountPayable = totalShortfall + totalInterest234C + totalInterest234B;

		const advice: string[] = [];
		if (!isApplicable) {
			advice.push("Assessed tax is below ₹10,000 threshold. No advance tax required under Section 208.");
		} else {
			if (totalShortfall > 0) {
				advice.push(`Pay remaining shortfall of ₹${totalShortfall.toLocaleString("en-IN")} immediately to halt Section 234B/C interest accrual.`);
			}
			if (totalInterest234C > 0) {
				advice.push(`Section 234C deferment interest incurred: ₹${totalInterest234C.toLocaleString("en-IN")}.`);
			}
			advice.push("Capital gains & speculative business windfalls are exempt from 234C if paid in the remaining subsequent installments.");
		}

		return {
			financialYear: input.financialYear,
			assessmentYear: ay,
			engineVersion: this.engineVersion,
			calculationTimestamp: new Date().toISOString(),
			isAdvanceTaxApplicable: isApplicable,
			summary: {
				estimatedGrossTax: grossTax,
				estimatedTdsTcs: tds,
				assessedTax,
				totalAdvanceTaxPaid: cumulativePaid,
				totalShortfall,
				totalInterest234C,
				totalInterest234B,
				totalAmountPayable,
			},
			schedule,
			ePayTaxPaymentUrl: "https://eportal.incometax.gov.in/iec/foservices/#/e-pay-tax-prelogin/user-details",
			complianceAdvice: advice,
		};
	}
}

export const caAdvanceTaxService = new CAAdvanceTaxService();

