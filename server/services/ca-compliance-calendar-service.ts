export interface ComplianceDeadlineItem {
	id: string;
	title: string;
	regime: "GST" | "INCOME_TAX" | "TDS_TCS" | "ROC_MCA";
	formOrChallan: string;
	statutorySection: string;
	dueDate: string;
	period: string;
	applicability: string;
	daysRemaining: number;
	urgency: "OVERDUE" | "DUE_TODAY" | "DUE_THIS_WEEK" | "UPCOMING";
	penaltyConsequence: string;
	clientReminderTemplate: string;
}

/**
 * Service providing the Master Statutory Compliance Radar for CAs,
 * dynamically computing tax and corporate deadlines with automated client notification payloads.
 */
export class CAComplianceCalendarService {
	/**
	 * Generates compliance events for a given month and year.
	 *
	 * @param year Reference year (defaults to current year)
	 * @param month Reference month (1-12, defaults to current month)
	 */
	getDeadlines(year?: number, month?: number): ComplianceDeadlineItem[] {
		const now = new Date();
		const currentYear = year || now.getFullYear();
		const currentMonth = month || now.getMonth() + 1; // 1-12
		const mStr = currentMonth.toString().padStart(2, "0");

		const rawEvents: Array<{
			id: string;
			title: string;
			regime: "GST" | "INCOME_TAX" | "TDS_TCS" | "ROC_MCA";
			formOrChallan: string;
			statutorySection: string;
			day: number;
			period: string;
			applicability: string;
			penalty: string;
		}> = [
			{
				id: `tds-deposit-${currentYear}-${mStr}`,
				title: "Monthly TDS / TCS Payment Deposit",
				regime: "TDS_TCS",
				formOrChallan: "Challan ITNS 281",
				statutorySection: "Section 200(1) / Rule 30",
				day: 7,
				period: `Tax deducted during ${currentMonth === 1 ? 12 : currentMonth - 1}/${currentMonth === 1 ? currentYear - 1 : currentYear}`,
				applicability: "All corporate & business deductors who withheld tax",
				penalty: "1.5% interest per month u/s 201(1A) from deduction date till deposit",
			},
			{
				id: `gstr-1-${currentYear}-${mStr}`,
				title: "GSTR-1 (Outward Supplies Return)",
				regime: "GST",
				formOrChallan: "Form GSTR-1",
				statutorySection: "Section 37 / Rule 59",
				day: 11,
				period: `Outward sales of previous month`,
				applicability: "Regular monthly GST registered taxpayers (Turnover > ₹5 Cr or monthly scheme)",
				penalty: "Late fee ₹50/day (₹20/day for Nil return) up to ₹10,000 max under Section 47",
			},
			{
				id: `gstr-3b-${currentYear}-${mStr}`,
				title: "GSTR-3B (Summary Return & Tax Payment)",
				regime: "GST",
				formOrChallan: "Form GSTR-3B",
				statutorySection: "Section 39 / Rule 61",
				day: 20,
				period: `Tax liability & ITC for previous month`,
				applicability: "All regular GST registered taxpayers",
				penalty: "Late fee ₹50/day + 18% p.a. interest u/s 50 on net cash tax liability",
			},
		];

		// Add Quarterly / Annual Deadlines
		if ([3, 6, 9, 12].includes(currentMonth)) {
			const installmentNo = currentMonth === 6 ? "Q1 (15%)" : currentMonth === 9 ? "Q2 (45%)" : currentMonth === 12 ? "Q3 (75%)" : "Q4 (100%)";
			rawEvents.push({
				id: `advance-tax-${currentYear}-${mStr}`,
				title: `Advance Tax Installment ${installmentNo}`,
				regime: "INCOME_TAX",
				formOrChallan: "Challan ITNS 280",
				statutorySection: "Section 208 / 211",
				day: 15,
				period: `FY ${currentYear}-${(currentYear + 1).toString().slice(-2)}`,
				applicability: "All taxpayers with assessed tax liability ≥ ₹10,000",
				penalty: "1% per month deferment interest under Section 234C on shortfall",
			});
		}

		if (currentMonth === 7) {
			rawEvents.push({
				id: `itr-non-audit-${currentYear}`,
				title: "Income Tax Return (ITR) Filing (Non-Audit)",
				regime: "INCOME_TAX",
				formOrChallan: "ITR-1, ITR-2, ITR-4",
				statutorySection: "Section 139(1)",
				day: 31,
				period: `AY ${currentYear}-${(currentYear + 1).toString().slice(-2)}`,
				applicability: "Individuals, HUFs, and non-audit business entities",
				penalty: "Late fee ₹5,000 u/s 234F (₹1,000 if income < ₹5L) + 1% p.m. interest u/s 234A",
			});
		}

		if (currentMonth === 9) {
			rawEvents.push(
				{
					id: `tax-audit-${currentYear}`,
					title: "Tax Audit Report Submission (Form 3CA/3CD)",
					regime: "INCOME_TAX",
					formOrChallan: "Form 3CA/3CD & Form 3CB/3CD",
					statutorySection: "Section 44AB",
					day: 30,
					period: `AY ${currentYear}-${(currentYear + 1).toString().slice(-2)}`,
					applicability: "Businesses turnover > ₹1 Cr (or ₹10 Cr if cash < 5%) & Professionals > ₹50L",
					penalty: "0.5% of turnover up to ₹1,50,000 under Section 271B",
				},
				{
					id: `dir-3-kyc-${currentYear}`,
					title: "Director KYC Annual Verification (DIR-3 KYC)",
					regime: "ROC_MCA",
					formOrChallan: "e-Form DIR-3 KYC / Web KYC",
					statutorySection: "Rule 12A of Companies (Appointment and Qualification of Directors) Rules",
					day: 30,
					period: `FY ${currentYear - 1}-${currentYear.toString().slice(-2)}`,
					applicability: "Every person holding an active DIN as on 31st March",
					penalty: "Mandatory penalty of ₹5,000 per DIN + deactivation of DIN",
				},
			);
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		return rawEvents.map((evt) => {
			const dueDate = new Date(currentYear, currentMonth - 1, evt.day);
			dueDate.setHours(0, 0, 0, 0);

			const diffMs = dueDate.getTime() - today.getTime();
			const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

			let urgency: "OVERDUE" | "DUE_TODAY" | "DUE_THIS_WEEK" | "UPCOMING" = "UPCOMING";
			if (daysRemaining < 0) {
				urgency = "OVERDUE";
			} else if (daysRemaining === 0) {
				urgency = "DUE_TODAY";
			} else if (daysRemaining <= 7) {
				urgency = "DUE_THIS_WEEK";
			}

			const dateStr = `${currentYear}-${mStr}-${evt.day.toString().padStart(2, "0")}`;
			const reminderMsg = `Dear Client,\n\nThis is an advance statutory reminder from your Chartered Accountant. The due date for ${evt.title} (${evt.formOrChallan}) is ${dateStr} (${daysRemaining > 0 ? `${daysRemaining} days left` : "DUE TODAY"}).\n\nPlease submit all pending invoices, challans, or records to avoid statutory interest and late fees (${evt.penalty}).\n\nThank you.`;

			return {
				id: evt.id,
				title: evt.title,
				regime: evt.regime,
				formOrChallan: evt.formOrChallan,
				statutorySection: evt.statutorySection,
				dueDate: dateStr,
				period: evt.period,
				applicability: evt.applicability,
				daysRemaining,
				urgency,
				penaltyConsequence: evt.penalty,
				clientReminderTemplate: reminderMsg,
			};
		});
	}
}

export const caComplianceCalendarService = new CAComplianceCalendarService();
