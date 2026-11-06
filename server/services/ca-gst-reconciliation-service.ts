export interface PurchaseInvoice {
	supplierGstin: string;
	supplierName: string;
	invoiceNumber: string;
	invoiceDate: string;
	taxableValue: number;
	igst: number;
	cgst: number;
	sgst: number;
	totalTax: number;
}

export interface Gstr2bInvoice extends PurchaseInvoice {
	filingDate: string;
	itcEligibility: "Y" | "N";
	imsStatus?: "ACCEPT" | "REJECT" | "PENDING";
}

export interface GstReconciliationDiscrepancy {
	supplierGstin: string;
	supplierName: string;
	invoiceNumber: string;
	invoiceDate: string;
	category: "MATCHED" | "TAX_MISMATCH" | "MISSING_IN_GSTR2B" | "MISSING_IN_BOOKS";
	bookTax: number;
	gstr2bTax: number;
	variance: number;
	itcStatus: "ELIGIBLE" | "BLOCKED_RULE_36_4" | "UNCLAIMED_IN_BOOKS";
	suggestedImsAction: "ACCEPT" | "REJECT" | "PENDING";
	supplierActionNote: string;
}

export interface GstReconciliationReport {
	returnPeriod: string; // e.g. "102024" (Oct 2024)
	engineVersion: string;
	calculationTimestamp: string;
	summary: {
		totalBookTax: number;
		totalGstr2bTax: number;
		totalEligibleItc: number;
		totalBlockedItc: number;
		totalUnclaimedItc: number;
		matchedCount: number;
		mismatchCount: number;
		missingIn2bCount: number;
		missingInBooksCount: number;
	};
	discrepancies: GstReconciliationDiscrepancy[];
	imsSubmissionPayload: {
		acceptedInvoicesCount: number;
		rejectedInvoicesCount: number;
		pendingInvoicesCount: number;
	};
	complianceAdvice: string[];
}

/**
 * Service to execute GSTR-2B vs. Purchase Register 3-way reconciliation
 * and automate GSTN Invoice Management System (IMS) actions per Rule 36(4).
 */
export class CAGstReconciliationService {
	private readonly engineVersion = "GSTR2B_RECON_V1.0";

	/**
	 * Reconciles purchase register against GSTR-2B.
	 *
	 * @param returnPeriod GST return period (MMYYYY)
	 * @param booksInvoices Purchase invoices recorded in accounting books
	 * @param gstr2bInvoices Invoices downloaded from GSTN GSTR-2B
	 */
	reconcile(
		returnPeriod: string,
		booksInvoices: PurchaseInvoice[],
		gstr2bInvoices: Gstr2bInvoice[],
	): GstReconciliationReport {
		const discrepancies: GstReconciliationDiscrepancy[] = [];

		const gstr2bMap = new Map<string, Gstr2bInvoice>();
		for (const inv of gstr2bInvoices) {
			const key = `${inv.supplierGstin.trim().toUpperCase()}_${inv.invoiceNumber.trim().toUpperCase()}`;
			gstr2bMap.set(key, inv);
		}

		let totalBookTax = 0;
		let totalGstr2bTax = 0;
		let totalEligibleItc = 0;
		let totalBlockedItc = 0;
		let totalUnclaimedItc = 0;

		let matchedCount = 0;
		let mismatchCount = 0;
		let missingIn2bCount = 0;

		const processedKeys = new Set<string>();

		// 1. Process books invoices
		for (const b of booksInvoices) {
			totalBookTax += b.totalTax;
			const key = `${b.supplierGstin.trim().toUpperCase()}_${b.invoiceNumber.trim().toUpperCase()}`;
			processedKeys.add(key);

			const match2b = gstr2bMap.get(key);

			if (match2b) {
				const taxDiff = Math.abs(b.totalTax - match2b.totalTax);
				if (taxDiff <= 1.0) {
					// MATCHED: ITC eligible under Sec 16(2)(aa)
					matchedCount++;
					totalEligibleItc += b.totalTax;
					discrepancies.push({
						supplierGstin: b.supplierGstin,
						supplierName: b.supplierName,
						invoiceNumber: b.invoiceNumber,
						invoiceDate: b.invoiceDate,
						category: "MATCHED",
						bookTax: b.totalTax,
						gstr2bTax: match2b.totalTax,
						variance: 0,
						itcStatus: "ELIGIBLE",
						suggestedImsAction: "ACCEPT",
						supplierActionNote: "Invoice matched in GSTR-2B. Safe to claim ITC in GSTR-3B.",
					});
				} else {
					// TAX MISMATCH
					mismatchCount++;
					const eligibleAmount = Math.min(b.totalTax, match2b.totalTax);
					totalEligibleItc += eligibleAmount;
					totalBlockedItc += Math.max(0, b.totalTax - match2b.totalTax);

					discrepancies.push({
						supplierGstin: b.supplierGstin,
						supplierName: b.supplierName,
						invoiceNumber: b.invoiceNumber,
						invoiceDate: b.invoiceDate,
						category: "TAX_MISMATCH",
						bookTax: b.totalTax,
						gstr2bTax: match2b.totalTax,
						variance: taxDiff,
						itcStatus: "BLOCKED_RULE_36_4",
						suggestedImsAction: "PENDING",
						supplierActionNote: `Tax rate mismatch. Books report ₹${b.totalTax} vs GSTR-2B ₹${match2b.totalTax}. Request credit/debit note from vendor.`,
					});
				}
			} else {
				// MISSING IN 2B: ITC blocked under Rule 36(4)
				missingIn2bCount++;
				totalBlockedItc += b.totalTax;
				discrepancies.push({
					supplierGstin: b.supplierGstin,
					supplierName: b.supplierName,
					invoiceNumber: b.invoiceNumber,
					invoiceDate: b.invoiceDate,
					category: "MISSING_IN_GSTR2B",
					bookTax: b.totalTax,
					gstr2bTax: 0,
					variance: b.totalTax,
					itcStatus: "BLOCKED_RULE_36_4",
					suggestedImsAction: "REJECT",
					supplierActionNote: "Supplier has not filed GSTR-1. Put vendor payment on hold until invoice reflects in GSTR-2B.",
				});
			}
		}

		// 2. Process GSTR-2B invoices missing in Books
		let missingInBooksCount = 0;
		for (const g of gstr2bInvoices) {
			totalGstr2bTax += g.totalTax;
			const key = `${g.supplierGstin.trim().toUpperCase()}_${g.invoiceNumber.trim().toUpperCase()}`;
			if (!processedKeys.has(key)) {
				missingInBooksCount++;
				totalUnclaimedItc += g.totalTax;
				discrepancies.push({
					supplierGstin: g.supplierGstin,
					supplierName: g.supplierName,
					invoiceNumber: g.invoiceNumber,
					invoiceDate: g.invoiceDate,
					category: "MISSING_IN_BOOKS",
					bookTax: 0,
					gstr2bTax: g.totalTax,
					variance: g.totalTax,
					itcStatus: "UNCLAIMED_IN_BOOKS",
					suggestedImsAction: "PENDING",
					supplierActionNote: "Invoice reflected in GSTR-2B but missing in client purchase ledger. Verify accounting booking.",
				});
			}
		}

		const acceptedCount = discrepancies.filter((d) => d.suggestedImsAction === "ACCEPT").length;
		const rejectedCount = discrepancies.filter((d) => d.suggestedImsAction === "REJECT").length;
		const pendingCount = discrepancies.filter((d) => d.suggestedImsAction === "PENDING").length;

		const advice: string[] = [];
		if (missingIn2bCount > 0) {
			advice.push(`Blocked ITC: ₹${totalBlockedItc.toLocaleString("en-IN")} cannot be claimed in GSTR-3B under Section 16(2)(aa). Send automated payment hold notifications to affected suppliers.`);
		}
		if (mismatchCount > 0) {
			advice.push(`Tax Mismatch: ${mismatchCount} invoices require vendor reconciliation before filing GSTR-3B.`);
		}
		if (missingInBooksCount > 0) {
			advice.push(`Unclaimed ITC: ₹${totalUnclaimedItc.toLocaleString("en-IN")} available in GSTR-2B awaiting accounting booking in Purchase Register.`);
		}

		return {
			returnPeriod,
			engineVersion: this.engineVersion,
			calculationTimestamp: new Date().toISOString(),
			summary: {
				totalBookTax,
				totalGstr2bTax,
				totalEligibleItc,
				totalBlockedItc,
				totalUnclaimedItc,
				matchedCount,
				mismatchCount,
				missingIn2bCount,
				missingInBooksCount,
			},
			discrepancies,
			imsSubmissionPayload: {
				acceptedInvoicesCount: acceptedCount,
				rejectedInvoicesCount: rejectedCount,
				pendingInvoicesCount: pendingCount,
			},
			complianceAdvice: advice,
		};
	}
}

export const caGstReconciliationService = new CAGstReconciliationService();

