import { db } from "../db";
import { eq } from "drizzle-orm";
import { agentItrCases, users, partners } from "@shared/schema";
import crypto from "crypto";

export interface ComputationSummarySheet {
	approvalToken: string;
	caseId: string;
	assessmentYear: string;
	financialYear: string;
	client: {
		id: string;
		fullName: string;
		pan: string;
		email: string;
		mobile?: string | null;
	};
	ca: {
		firmName: string;
		caName: string;
		icaiNumber?: string | null;
	};
	computation: {
		salaryIncome: number;
		interestIncome: number;
		dividendIncome: number;
		capitalGainsStcg: number;
		capitalGainsLtcg: number;
		businessIncome: number;
		otherIncome: number;
		grossTotalIncome: number;
		totalDeductions: number;
		taxableIncome: number;
		taxRegime: string;
		taxPayable: number;
		totalTaxesPaid: number;
		refundOrDue: number;
		resultType: "REFUND_DUE" | "TAX_PAYABLE" | "NIL_BALANCE";
	};
	statutoryDeclaration: string;
	approvalUrl: string;
	whatsAppShareUrl: string;
	whatsAppMessageText: string;
	generatedAt: string;
	status: "PENDING_APPROVAL" | "APPROVED";
	approvedAt?: string;
}

/**
 * Service to generate client-facing tax computation summary sheets
 * and handle 1-click WhatsApp/SMS consent sign-offs before return submission.
 */
export class CAClientApprovalService {
	// Cache active approval tokens
	private approvalTokens: Map<string, { caseId: string; approved: boolean; approvedAt?: string }> = new Map();

	/**
	 * Generates a branded computation summary sheet and WhatsApp approval payload.
	 *
	 * @param caseId Target case ID
	 * @param caPartnerId CA Partner ID
	 * @param baseUrl Application base URL for approval link
	 */
	async generateApprovalSheet(
		caseId: string,
		caPartnerId: string,
		baseUrl: string = "https://fintekpro.com",
	): Promise<ComputationSummarySheet> {
		const [caseRecord] = await db
			.select()
			.from(agentItrCases)
			.where(eq(agentItrCases.id, caseId))
			.limit(1);

		if (!caseRecord) {
			throw new Error("Case record not found");
		}

		const [client] = await db
			.select()
			.from(users)
			.where(eq(users.id, caseRecord.clientId))
			.limit(1);

		const [caPartner] = await db
			.select()
			.from(partners)
			.where(eq(partners.id, caPartnerId))
			.limit(1);

		const token = `comp_${crypto.randomBytes(12).toString("hex")}`;
		this.approvalTokens.set(token, { caseId, approved: false });

		const salary = Number(caseRecord.salaryIncome || 0);
		const interest = Number(caseRecord.interestIncome || 0);
		const dividend = Number(caseRecord.dividendIncome || 0);
		const stcg = Number(caseRecord.capitalGainsStcg || 0);
		const ltcg = Number(caseRecord.capitalGainsLtcg || 0);
		const business = Number(caseRecord.businessIncome || 0);
		const other = Number(caseRecord.otherIncome || 0);
		const gross = salary + interest + dividend + stcg + ltcg + business + other;

		const deductions = Number(caseRecord.totalDeductions || 0);
		const taxable = Number(caseRecord.taxableIncome || 0);
		const taxPayable = Number(caseRecord.taxPayable || 0);
		const tds = Number(caseRecord.tdsPaid || 0);
		const adv = Number(caseRecord.advanceTaxPaid || 0);
		const totalPaid = tds + adv;
		const refundOrDue = Number(caseRecord.refundOrDue || 0);

		const resultType = refundOrDue < 0 ? "REFUND_DUE" : refundOrDue > 0 ? "TAX_PAYABLE" : "NIL_BALANCE";
		const clientName = client
			? (`${client.firstName || ""} ${client.lastName || ""}`.trim() || client.email || "Client")
			: "Client";
		const caName = caPartner?.companyName || "Chartered Accountant";
		const caFirm = caPartner?.caFirmName || caName;

		const approvalUrl = `${baseUrl}/tax-approval/${token}`;
		const outcomeStr = resultType === "REFUND_DUE"
			? `Refund Due: ₹${Math.abs(refundOrDue).toLocaleString("en-IN")}`
			: resultType === "TAX_PAYABLE"
				? `Net Tax Due: ₹${refundOrDue.toLocaleString("en-IN")}`
				: "Nil Balance (No Tax Due / Refund)";

		const messageText = `Dear ${clientName},\n\nYour Income Tax Return computation for Assessment Year ${caseRecord.assessmentYear} (${caseRecord.itrFormType || "ITR"}) has been finalized by ${caFirm}.\n\n📋 Summary:\n• Gross Income: ₹${gross.toLocaleString("en-IN")}\n• Taxable Income: ₹${taxable.toLocaleString("en-IN")}\n• ${outcomeStr}\n\nPlease review your computation and click the link below to provide your approval before we submit to the Income Tax Department:\n\n🔗 ${approvalUrl}\n\nThank you,\n${caFirm}`;

		const mobileNumber = client?.mobile ? client.mobile.replace(/[^0-9]/g, "") : "";
		const whatsAppShareUrl = mobileNumber
			? `https://api.whatsapp.com/send?phone=${mobileNumber}&text=${encodeURIComponent(messageText)}`
			: `https://api.whatsapp.com/send?text=${encodeURIComponent(messageText)}`;

		return {
			approvalToken: token,
			caseId,
			assessmentYear: caseRecord.assessmentYear,
			financialYear: caseRecord.financialYear,
			client: {
				id: caseRecord.clientId,
				fullName: clientName,
				pan: client?.panNumber || "PAN_ON_FILE",
				email: client?.email || "",
				mobile: client?.mobile,
			},
			ca: {
				firmName: caFirm,
				caName,
				icaiNumber: caPartner?.icaiMembershipNumber,
			},
			computation: {
				salaryIncome: salary,
				interestIncome: interest,
				dividendIncome: dividend,
				capitalGainsStcg: stcg,
				capitalGainsLtcg: ltcg,
				businessIncome: business,
				otherIncome: other,
				grossTotalIncome: gross,
				totalDeductions: deductions,
				taxableIncome: taxable,
				taxRegime: caseRecord.taxRegime || "new",
				taxPayable,
				totalTaxesPaid: totalPaid,
				refundOrDue,
				resultType,
			},
			statutoryDeclaration:
				"I hereby confirm that I have verified the income, deductions, and tax calculation presented in this summary and authorize my Chartered Accountant to submit this return to the Income Tax Department.",
			approvalUrl,
			whatsAppShareUrl,
			whatsAppMessageText: messageText,
			generatedAt: new Date().toISOString(),
			status: "PENDING_APPROVAL",
		};
	}

	/**
	 * Verifies client approval using the generated token and updates the case record.
	 *
	 * @param token Approval token
	 */
	async verifyApproval(token: string) {
		const session = this.approvalTokens.get(token);
		if (!session) {
			throw new Error("Invalid or expired approval token");
		}

		session.approved = true;
		session.approvedAt = new Date().toISOString();

		// Append confirmation note to case
		const [currentCase] = await db
			.select()
			.from(agentItrCases)
			.where(eq(agentItrCases.id, session.caseId))
			.limit(1);

		if (currentCase) {
			const notes = (currentCase.internalNotes as any[]) || [];
			notes.push({
				note: "Client provided statutory 1-click consent on Tax Computation Summary Sheet via secure link.",
				by: "Client (Verified)",
				at: session.approvedAt,
			});

			await db
				.update(agentItrCases)
				.set({
					internalNotes: notes,
					status: "draft_ready",
					subStatus: "client_approved",
					updatedAt: new Date(),
				})
				.where(eq(agentItrCases.id, session.caseId));
		}

		return {
			success: true,
			caseId: session.caseId,
			approvedAt: session.approvedAt,
		};
	}
}

export const caClientApprovalService = new CAClientApprovalService();
