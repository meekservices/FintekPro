// @ts-nocheck
import { db } from "../db";
import {
	masterDsaClaims,
	masterDsaAttachments,
	masterDsaPayments,
	payoutClaims,
	leadRegistry,
	bankerConfirmationEmails,
	leadAuditLogs,
	MasterDsaClaim,
	MasterDsaAttachment,
	MasterDsaPayment,
} from "@shared/schema";
import { eq, and, sql, desc, sum } from "drizzle-orm";
import { emailService } from "../email-service";

const ALLOWED_ATTACHMENT_TYPES = ["pdf", "eml", "jpg", "jpeg", "png"];
const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024;

const DSA_CLAIM_STATUS_ORDER = [
	"DRAFT",
	"SUBMITTED",
	"ACKNOWLEDGED",
	"PAID",
] as const;

export class MasterDsaClaimService {
	private static instance: MasterDsaClaimService;

	static getInstance(): MasterDsaClaimService {
		if (!MasterDsaClaimService.instance)
			MasterDsaClaimService.instance = new MasterDsaClaimService();
		return MasterDsaClaimService.instance;
	}

	async createClaimFromPayout(
		payoutClaimId: string,
		adminId: string,
		data: {
			masterDsaEmail: string;
			masterDsaName: string;
			claimedAmount: string;
		},
	): Promise<{ success: boolean; claim?: MasterDsaClaim; error?: string }> {
		const [payoutClaim] = await db
			.select()
			.from(payoutClaims)
			.where(eq(payoutClaims.claimId, payoutClaimId));

		if (!payoutClaim) {
			return { success: false, error: "Payout claim not found" };
		}

		if (
			payoutClaim.status !== "CONFIRMED_BY_FINANCIER" &&
			payoutClaim.status !== "APPROVED" &&
			payoutClaim.status !== "ON_HOLD_PDD"
		) {
			return {
				success: false,
				error:
					"Payout claim must be confirmed/approved before creating Master DSA claim",
			};
		}

		const [existingDsaClaim] = await db
			.select()
			.from(masterDsaClaims)
			.where(eq(masterDsaClaims.payoutClaimId, payoutClaimId));

		if (existingDsaClaim) {
			return {
				success: false,
				error: "Master DSA claim already exists for this payout claim",
			};
		}

		const [lead] = await db
			.select()
			.from(leadRegistry)
			.where(eq(leadRegistry.leadId, payoutClaim.leadId));

		const emailBody = this.generateConfirmationEmailBody({
			customerName: lead?.customerName || "N/A",
			customerPan: lead?.pan || "N/A",
			financierName: payoutClaim.financierName,
			disbursementAmount: payoutClaim.disbursementAmount,
			disbursementDate: payoutClaim.disbursementDate,
			loanAccountNumber: payoutClaim.loanAccountNumber || "N/A",
			claimedAmount: data.claimedAmount,
		});

		const emailSubject = `Commission Claim – ${payoutClaim.financierName} – Loan A/C ${payoutClaim.loanAccountNumber || "N/A"} – ₹${data.claimedAmount}`;

		const [claim] = await db
			.insert(masterDsaClaims)
			.values({
				payoutClaimId,
				leadId: payoutClaim.leadId,
				agentId: payoutClaim.agentId,
				partnerId: payoutClaim.partnerId,
				financierName: payoutClaim.financierName,
				disbursementAmount: payoutClaim.disbursementAmount,
				disbursementDate: payoutClaim.disbursementDate,
				loanAccountNumber: payoutClaim.loanAccountNumber,
				customerName: lead?.customerName,
				customerPan: lead?.pan,
				claimedAmount: data.claimedAmount,
				outstandingAmount: data.claimedAmount,
				emailSubject,
				emailBody,
				masterDsaEmail: data.masterDsaEmail,
				masterDsaName: data.masterDsaName,
				status: "DRAFT" as any,
				createdByAdminId: adminId,
			})
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId: payoutClaim.leadId,
			claimId: payoutClaimId,
			actorId: adminId,
			actorRole: "ADMIN",
			action: "MASTER_DSA_CLAIM_CREATED",
			details: {
				dsaClaimId: claim.dsaClaimId,
				claimedAmount: data.claimedAmount,
				masterDsaName: data.masterDsaName,
			},
		});

		return { success: true, claim };
	}

	private generateConfirmationEmailBody(data: {
		customerName: string;
		customerPan: string;
		financierName: string;
		disbursementAmount: string;
		disbursementDate: string;
		loanAccountNumber: string;
		claimedAmount: string;
	}): string {
		return `Dear Master DSA,

We are writing to confirm the following disbursement and claim our commission as per our agreement:

DISBURSEMENT CONFIRMATION
────────────────────────────────────
Customer Name       : ${data.customerName}
PAN                 : ${data.customerPan}
Financier           : ${data.financierName}
Loan Account Number : ${data.loanAccountNumber}
Disbursement Amount : ₹${Number.parseFloat(data.disbursementAmount).toLocaleString("en-IN")}
Disbursement Date   : ${data.disbursementDate}

COMMISSION CLAIM
────────────────────────────────────
Commission Amount   : ₹${Number.parseFloat(data.claimedAmount).toLocaleString("en-IN")}

This claim is supported by the attached financier/banker confirmation email as proof of disbursement.

Please acknowledge receipt and process the commission payout at the earliest.

Regards,
FintekPro Support Team
support@fintekpro.com`;
	}

	async addAttachment(
		dsaClaimId: string,
		data: {
			fileName: string;
			fileType: string;
			fileSize: number;
			fileHash: string;
			storagePath: string;
			attachmentType: string;
			adminId: string;
		},
	): Promise<{
		success: boolean;
		attachment?: MasterDsaAttachment;
		error?: string;
	}> {
		const [claim] = await db
			.select()
			.from(masterDsaClaims)
			.where(eq(masterDsaClaims.dsaClaimId, dsaClaimId));

		if (!claim) {
			return { success: false, error: "Master DSA claim not found" };
		}

		if (claim.status !== "DRAFT") {
			return {
				success: false,
				error: "Attachments can only be added in DRAFT status",
			};
		}

		if (!ALLOWED_ATTACHMENT_TYPES.includes(data.fileType.toLowerCase())) {
			return {
				success: false,
				error: `Invalid file type. Allowed: ${ALLOWED_ATTACHMENT_TYPES.join(", ")}`,
			};
		}

		if (data.fileSize > MAX_ATTACHMENT_SIZE) {
			return { success: false, error: "File size exceeds 15MB limit" };
		}

		const [attachment] = await db
			.insert(masterDsaAttachments)
			.values({
				dsaClaimId,
				fileName: data.fileName,
				fileType: data.fileType,
				fileSize: data.fileSize,
				fileHash: data.fileHash,
				storagePath: data.storagePath,
				attachmentType: data.attachmentType,
				uploadedByAdminId: data.adminId,
			})
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId: claim.leadId,
			claimId: claim.payoutClaimId,
			actorId: data.adminId,
			actorRole: "ADMIN",
			action: "MASTER_DSA_ATTACHMENT_ADDED",
			details: {
				dsaClaimId,
				fileName: data.fileName,
				attachmentType: data.attachmentType,
			},
		});

		return { success: true, attachment };
	}

	async submitClaim(
		dsaClaimId: string,
		adminId: string,
	): Promise<{ success: boolean; claim?: MasterDsaClaim; error?: string }> {
		const [claim] = await db
			.select()
			.from(masterDsaClaims)
			.where(eq(masterDsaClaims.dsaClaimId, dsaClaimId));

		if (!claim) {
			return { success: false, error: "Master DSA claim not found" };
		}

		if (claim.status !== "DRAFT") {
			return {
				success: false,
				error: "Claim must be in DRAFT status to submit",
			};
		}

		const attachments = await db
			.select()
			.from(masterDsaAttachments)
			.where(eq(masterDsaAttachments.dsaClaimId, dsaClaimId));

		const hasConfirmationEmail = attachments.some(
			(a) => a.attachmentType === "CONFIRMATION_EMAIL",
		);
		if (!hasConfirmationEmail) {
			return {
				success: false,
				error:
					"Banker/financier confirmation email attachment is mandatory before submission",
			};
		}

		const [updated] = await db
			.update(masterDsaClaims)
			.set({
				status: "SUBMITTED" as any,
				submittedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(masterDsaClaims.dsaClaimId, dsaClaimId))
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId: claim.leadId,
			claimId: claim.payoutClaimId,
			actorId: adminId,
			actorRole: "ADMIN",
			action: "MASTER_DSA_CLAIM_SUBMITTED",
			details: { dsaClaimId, attachmentCount: attachments.length },
		});

		return { success: true, claim: updated };
	}

	async sendClaimEmail(
		dsaClaimId: string,
		adminId: string,
	): Promise<{ success: boolean; claim?: MasterDsaClaim; error?: string }> {
		const [claim] = await db
			.select()
			.from(masterDsaClaims)
			.where(eq(masterDsaClaims.dsaClaimId, dsaClaimId));

		if (!claim) {
			return { success: false, error: "Master DSA claim not found" };
		}

		if (claim.status !== "SUBMITTED") {
			return {
				success: false,
				error: "Claim must be SUBMITTED before sending email",
			};
		}

		if (!claim.masterDsaEmail) {
			return { success: false, error: "Master DSA email address not set" };
		}

		// Actually send the email via the email service
		const emailSent = await emailService.sendEmail({
			to: claim.masterDsaEmail,
			subject:
				claim.emailSubject ||
				`Commission Claim – ${claim.financierName} – ₹${claim.claimedAmount}`,
			html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${claim.emailBody || ""}</pre>`,
			text: claim.emailBody || "",
		});

		if (!emailSent) {
			console.warn(
				`[MasterDsaClaim] Email delivery failed or not configured for claim ${dsaClaimId}. Marking as sent anyway for record-keeping.`,
			);
		}

		const messageId = `mdsa-${dsaClaimId}-${Date.now()}@fintekpro.com`;

		const [updated] = await db
			.update(masterDsaClaims)
			.set({
				emailSentAt: new Date(),
				emailMessageId: messageId,
				updatedAt: new Date(),
			})
			.where(eq(masterDsaClaims.dsaClaimId, dsaClaimId))
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId: claim.leadId,
			claimId: claim.payoutClaimId,
			actorId: adminId,
			actorRole: "ADMIN",
			action: "MASTER_DSA_EMAIL_SENT",
			details: {
				dsaClaimId,
				messageId,
				masterDsaEmail: claim.masterDsaEmail,
				emailDelivered: emailSent,
			},
		});

		return { success: true, claim: updated };
	}

	async updateStatus(
		dsaClaimId: string,
		newStatus: string,
		adminId: string,
		reason?: string,
	): Promise<{ success: boolean; claim?: MasterDsaClaim; error?: string }> {
		const [claim] = await db
			.select()
			.from(masterDsaClaims)
			.where(eq(masterDsaClaims.dsaClaimId, dsaClaimId));

		if (!claim) {
			return { success: false, error: "Master DSA claim not found" };
		}

		const validTransitions: Record<string, string[]> = {
			SUBMITTED: ["ACKNOWLEDGED", "DISPUTED", "REJECTED"],
			ACKNOWLEDGED: ["PAID", "PARTIALLY_PAID", "DISPUTED", "REJECTED"],
			PARTIALLY_PAID: ["PAID", "DISPUTED"],
			DISPUTED: ["ACKNOWLEDGED", "REJECTED"],
		};

		const allowed = validTransitions[claim.status as string];
		if (!allowed || !allowed.includes(newStatus)) {
			return {
				success: false,
				error: `Cannot transition from ${claim.status} to ${newStatus}`,
			};
		}

		const updateData: any = {
			status: newStatus as any,
			updatedAt: new Date(),
		};

		switch (newStatus) {
			case "ACKNOWLEDGED":
				updateData.acknowledgedAt = new Date();
				break;
			case "PAID":
				updateData.paidAt = new Date();
				break;
			case "DISPUTED":
				updateData.disputedAt = new Date();
				break;
			case "REJECTED":
				updateData.rejectedAt = new Date();
				updateData.rejectionReason = reason;
				break;
		}

		const [updated] = await db
			.update(masterDsaClaims)
			.set(updateData)
			.where(eq(masterDsaClaims.dsaClaimId, dsaClaimId))
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId: claim.leadId,
			claimId: claim.payoutClaimId,
			actorId: adminId,
			actorRole: "ADMIN",
			action: "MASTER_DSA_STATUS_UPDATED",
			details: { dsaClaimId, previousStatus: claim.status, newStatus, reason },
		});

		return { success: true, claim: updated };
	}

	async recordPayment(
		dsaClaimId: string,
		data: {
			amount: string;
			paymentDate: string;
			referenceNumber?: string;
			paymentMode?: string;
			notes?: string;
			adminId: string;
		},
	): Promise<{
		success: boolean;
		payment?: MasterDsaPayment;
		claim?: MasterDsaClaim;
		discrepancy?: boolean;
		error?: string;
	}> {
		const [claim] = await db
			.select()
			.from(masterDsaClaims)
			.where(eq(masterDsaClaims.dsaClaimId, dsaClaimId));

		if (!claim) {
			return { success: false, error: "Master DSA claim not found" };
		}

		if (!["ACKNOWLEDGED", "PARTIALLY_PAID"].includes(claim.status as string)) {
			return {
				success: false,
				error:
					"Payments can only be recorded for ACKNOWLEDGED or PARTIALLY_PAID claims",
			};
		}

		const [payment] = await db
			.insert(masterDsaPayments)
			.values({
				dsaClaimId,
				amount: data.amount,
				paymentDate: data.paymentDate,
				referenceNumber: data.referenceNumber,
				paymentMode: data.paymentMode,
				notes: data.notes,
				recordedByAdminId: data.adminId,
			})
			.returning();

		const allPayments = await db
			.select()
			.from(masterDsaPayments)
			.where(eq(masterDsaPayments.dsaClaimId, dsaClaimId));

		const totalPaid = allPayments.reduce(
			(sum, p) => sum + Number.parseFloat(p.amount),
			0,
		);
		const claimedAmount = Number.parseFloat(claim.claimedAmount);
		const outstanding = claimedAmount - totalPaid;
		const discrepancy = totalPaid > claimedAmount;

		const claimUpdate: any = {
			paidAmount: totalPaid.toFixed(2),
			outstandingAmount: Math.max(0, outstanding).toFixed(2),
			discrepancyFlag: discrepancy,
			updatedAt: new Date(),
		};

		if (discrepancy) {
			claimUpdate.discrepancyNotes = `Overpayment detected: Paid ₹${totalPaid.toFixed(2)} vs Claimed ₹${claimedAmount.toFixed(2)}`;
		}

		if (totalPaid >= claimedAmount) {
			claimUpdate.status = "PAID";
			claimUpdate.paidAt = new Date();
		} else {
			claimUpdate.status = "PARTIALLY_PAID";
		}

		const [updatedClaim] = await db
			.update(masterDsaClaims)
			.set(claimUpdate)
			.where(eq(masterDsaClaims.dsaClaimId, dsaClaimId))
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId: claim.leadId,
			claimId: claim.payoutClaimId,
			actorId: data.adminId,
			actorRole: "ADMIN",
			action: "MASTER_DSA_PAYMENT_RECORDED",
			details: {
				dsaClaimId,
				paymentAmount: data.amount,
				totalPaid: totalPaid.toFixed(2),
				outstanding: outstanding.toFixed(2),
				discrepancy,
				referenceNumber: data.referenceNumber,
			},
		});

		return { success: true, payment, claim: updatedClaim, discrepancy };
	}

	async getClaimById(dsaClaimId: string): Promise<{
		claim: MasterDsaClaim | null;
		attachments: MasterDsaAttachment[];
		payments: MasterDsaPayment[];
	}> {
		const [claim] = await db
			.select()
			.from(masterDsaClaims)
			.where(eq(masterDsaClaims.dsaClaimId, dsaClaimId));

		if (!claim) return { claim: null, attachments: [], payments: [] };

		const attachments = await db
			.select()
			.from(masterDsaAttachments)
			.where(eq(masterDsaAttachments.dsaClaimId, dsaClaimId));

		const payments = await db
			.select()
			.from(masterDsaPayments)
			.where(eq(masterDsaPayments.dsaClaimId, dsaClaimId))
			.orderBy(desc(masterDsaPayments.createdAt));

		return { claim, attachments, payments };
	}

	async getClaimByPayoutId(
		payoutClaimId: string,
	): Promise<MasterDsaClaim | null> {
		const [claim] = await db
			.select()
			.from(masterDsaClaims)
			.where(eq(masterDsaClaims.payoutClaimId, payoutClaimId));
		return claim || null;
	}

	async getAllClaims(status?: string): Promise<MasterDsaClaim[]> {
		if (status) {
			return db
				.select()
				.from(masterDsaClaims)
				.where(eq(masterDsaClaims.status, status as any))
				.orderBy(desc(masterDsaClaims.createdAt));
		}
		return db
			.select()
			.from(masterDsaClaims)
			.orderBy(desc(masterDsaClaims.createdAt));
	}
}

export const masterDsaClaimService = MasterDsaClaimService.getInstance();
