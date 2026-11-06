export interface MsmePayableRecord {
	vendorName: string;
	vendorPan?: string;
	udyamRegistrationNumber?: string;
	enterpriseCategory: "MICRO" | "SMALL" | "MEDIUM" | "TRADER";
	invoiceNumber: string;
	invoiceDate: string;
	invoiceAmount: number;
	balanceOutstandingAsOfMarch31: number;
	writtenAgreementExists: boolean;
	agreedPaymentDays?: number; // Maximum 45 days under law
	actualPaymentDate?: string; // If paid after March 31
}

export interface MsmeAuditResultItem {
	vendorName: string;
	enterpriseCategory: "MICRO" | "SMALL" | "MEDIUM" | "TRADER";
	invoiceNumber: string;
	invoiceDate: string;
	statutoryDueDate: string;
	daysAllowed: number;
	daysDelayed: number;
	outstandingAmount: number;
	isDisallowedSec43Bh: boolean;
	disallowanceAmount: number;
	penalInterestSec16Msmed: number;
	auditReason: string;
}

export interface MsmeAuditReport {
	financialYear: string;
	engineVersion: string;
	calculationTimestamp: string;
	summary: {
		totalMicroSmallPayables: number;
		totalMediumTraderExemptPayables: number;
		totalDisallowedSec43Bh: number;
		totalEstimatedInterestSec16: number;
		disallowedInvoicesCount: number;
		compliantInvoicesCount: number;
	};
	items: MsmeAuditResultItem[];
	form3CdClause22Text: string;
	auditorGuidance: string[];
}

/**
 * Service to audit accounts payable under Section 43B(h) of the Income-tax Act, 1961
 * read with Sections 15 & 16 of the MSMED Act, 2006 for Form 3CD Clause 22 reporting.
 */
export class CAMsmeAuditService {
	private readonly engineVersion = "MSME_43BH_AUDIT_V1.0";
	// RBI Bank rate ~6.75%, 3 times = 20.25% per annum
	private readonly msmeInterestAnnualRate = 0.2025;

	/**
	 * Computes Section 43B(h) disallowances and Section 16 MSME compound interest.
	 *
	 * @param financialYear Financial Year being audited (e.g. "2024-25")
	 * @param payables List of trade payables
	 */
	auditPayables(financialYear: string, payables: MsmePayableRecord[]): MsmeAuditReport {
		const items: MsmeAuditResultItem[] = [];

		let totalMicroSmall = 0;
		let totalMediumTraderExempt = 0;
		let totalDisallowed = 0;
		let totalInterest = 0;
		let disallowedCount = 0;
		let compliantCount = 0;

		const endOfFy = new Date(`${Number(financialYear.split("-")[0]) + 1}-03-31`);

		for (const p of payables) {
			const isMicroOrSmall = p.enterpriseCategory === "MICRO" || p.enterpriseCategory === "SMALL";

			// Traders and Medium enterprises are exempt from Section 43B(h)
			if (!isMicroOrSmall) {
				totalMediumTraderExempt += p.balanceOutstandingAsOfMarch31;
				items.push({
					vendorName: p.vendorName,
					enterpriseCategory: p.enterpriseCategory,
					invoiceNumber: p.invoiceNumber,
					invoiceDate: p.invoiceDate,
					statutoryDueDate: "EXEMPT",
					daysAllowed: 0,
					daysDelayed: 0,
					outstandingAmount: p.balanceOutstandingAsOfMarch31,
					isDisallowedSec43Bh: false,
					disallowanceAmount: 0,
					penalInterestSec16Msmed: 0,
					auditReason: `Exempt from Section 43B(h): Enterprise classified as ${p.enterpriseCategory}. Only Micro & Small manufacturers/service providers are covered.`,
				});
				continue;
			}

			totalMicroSmall += p.balanceOutstandingAsOfMarch31;

			// Section 15 of MSMED Act: 45 days if written agreement exists, 15 days if no agreement
			const daysAllowed = p.writtenAgreementExists
				? Math.min(45, p.agreedPaymentDays || 45)
				: 15;

			const invDate = new Date(p.invoiceDate);
			const dueDate = new Date(invDate);
			dueDate.setDate(dueDate.getDate() + daysAllowed);
			const dueDateStr = dueDate.toISOString().split("T")[0];

			// Delay calculation as of March 31 (or actual payment date if paid later)
			const evalDate = p.actualPaymentDate ? new Date(p.actualPaymentDate) : endOfFy;
			const diffMs = evalDate.getTime() - dueDate.getTime();
			const daysDelayed = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

			// Section 43B(h) rule: If unpaid as of March 31 AND statutory due date crossed before/on March 31,
			// it is disallowed and added back to taxable income of this FY!
			const isDisallowed = p.balanceOutstandingAsOfMarch31 > 0 && dueDate <= endOfFy;
			const disallowanceAmt = isDisallowed ? p.balanceOutstandingAsOfMarch31 : 0;

			// Compound interest under Section 16 MSMED Act:
			// 3 times RBI Bank rate compounded monthly on delayed payments
			let interestAmt = 0;
			if (daysDelayed > 0 && p.balanceOutstandingAsOfMarch31 > 0) {
				const months = daysDelayed / 30;
				interestAmt = Math.round(
					p.balanceOutstandingAsOfMarch31 * Math.pow(1 + this.msmeInterestAnnualRate / 12, months) -
						p.balanceOutstandingAsOfMarch31,
				);
			}

			if (isDisallowed) {
				disallowedCount++;
				totalDisallowed += disallowanceAmt;
			} else {
				compliantCount++;
			}
			totalInterest += interestAmt;

			items.push({
				vendorName: p.vendorName,
				enterpriseCategory: p.enterpriseCategory,
				invoiceNumber: p.invoiceNumber,
				invoiceDate: p.invoiceDate,
				statutoryDueDate: dueDateStr,
				daysAllowed,
				daysDelayed,
				outstandingAmount: p.balanceOutstandingAsOfMarch31,
				isDisallowedSec43Bh: isDisallowed,
				disallowanceAmount: disallowanceAmt,
				penalInterestSec16Msmed: interestAmt,
				auditReason: isDisallowed
					? `DISALLOWED u/s 43B(h): Payment outstanding beyond ${daysAllowed} statutory days as on 31st March. Must be added back in Form 3CD Clause 22.`
					: "COMPLIANT: Payment terms within statutory limits or falling due in subsequent financial year.",
			});
		}

		const clause22Text = `Clause 22: Amount of interest inadmissible under Section 23 of the MSMED Act, 2006: ₹${totalInterest.toLocaleString("en-IN")}.\nTotal sum payable to Micro and Small enterprises disallowed under Section 43B(h) of the Income-tax Act, 1961 for non-payment within statutory limits: ₹${totalDisallowed.toLocaleString("en-IN")}.`;

		const guidance: string[] = [
			`Total Disallowance under Section 43B(h): ₹${totalDisallowed.toLocaleString("en-IN")} will increase client's taxable business income for AY ${Number(financialYear.split("-")[0]) + 1}-${(Number(financialYear.split("-")[0]) + 2).toString().slice(-2)}.`,
			"Deduction can be claimed in the subsequent financial year in which actual payment is remitted to the MSME vendor.",
			`Penal interest of ₹${totalInterest.toLocaleString("en-IN")} under Section 16 MSMED Act is strictly inadmissible as an expense under Section 23 of MSMED Act.`,
		];

		return {
			financialYear,
			engineVersion: this.engineVersion,
			calculationTimestamp: new Date().toISOString(),
			summary: {
				totalMicroSmallPayables: totalMicroSmall,
				totalMediumTraderExemptPayables: totalMediumTraderExempt,
				totalDisallowedSec43Bh: totalDisallowed,
				totalEstimatedInterestSec16: totalInterest,
				disallowedInvoicesCount: disallowedCount,
				compliantInvoicesCount: compliantCount,
			},
			items,
			form3CdClause22Text: clause22Text,
			auditorGuidance: guidance,
		};
	}
}

export const caMsmeAuditService = new CAMsmeAuditService();

