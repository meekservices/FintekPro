import { db } from "../db";
import {
	payoutClaims,
	proofUploads,
	bankerConfirmationEmails,
	leadRegistry,
	leadAuditLogs,
	progressiveCommissionLedger,
	reversalLedger,
	partnerWallets,
	PayoutClaim,
} from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

const ALLOWED_FILE_TYPES = ["jpg", "jpeg", "png", "pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export class PayoutClaimService {
	private static instance: PayoutClaimService;

	static getInstance(): PayoutClaimService {
		if (!PayoutClaimService.instance)
			PayoutClaimService.instance = new PayoutClaimService();
		return PayoutClaimService.instance;
	}

	async submitClaim(data: {
		leadId: string;
		agentId: string;
		partnerId: string;
		disbursementAmount: string;
		disbursementDate: string;
		loanAccountNumber?: string;
		financierName: string;
		pddStatus: string;
		pddExceptionAllowedByFinancier?: boolean;
		subventionFlag?: boolean;
		teamCase?: boolean;
		teamMembers?: any[];
		transactionStatus?: string;
	}): Promise<{ success: boolean; claim?: PayoutClaim; error?: string }> {
		const [lead] = await db
			.select()
			.from(leadRegistry)
			.where(eq(leadRegistry.leadId, data.leadId));

		if (!lead) {
			return { success: false, error: "Lead not found" };
		}

		const disbursementDate = new Date(data.disbursementDate);
		if (lead.firstTouchTimestamp > disbursementDate) {
			return {
				success: false,
				error:
					"Lead was registered after disbursement date — anti-fraud check failed",
			};
		}

		if (lead.firstAgentId !== data.agentId) {
			return {
				success: false,
				error: "Agent does not match lead's first agent",
			};
		}

		const [claim] = await db
			.insert(payoutClaims)
			.values({
				leadId: data.leadId,
				agentId: data.agentId,
				partnerId: data.partnerId,
				disbursementAmount: data.disbursementAmount,
				disbursementDate: data.disbursementDate,
				loanAccountNumber: data.loanAccountNumber,
				financierName: data.financierName,
				pddStatus: data.pddStatus as any,
				pddExceptionAllowedByFinancier: data.pddExceptionAllowedByFinancier,
				subventionFlag: data.subventionFlag,
				teamCase: data.teamCase,
				teamMembers: data.teamMembers || [],
				transactionStatus: data.transactionStatus,
				status: "PENDING_VERIFICATION" as any,
			})
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId: data.leadId,
			claimId: claim.claimId,
			actorId: data.agentId,
			actorRole: "AGENT",
			action: "PAYOUT_CLAIM_SUBMITTED",
			details: {
				disbursementAmount: data.disbursementAmount,
				financierName: data.financierName,
			},
		});

		return { success: true, claim };
	}

	async addProof(
		claimId: string,
		data: {
			fileName: string;
			fileType: string;
			fileSize: number;
			fileHash: string;
			storagePath: string;
			uploaderRole: string;
			uploaderId: string;
		},
	): Promise<{ success: boolean; proof?: any; error?: string }> {
		const [claim] = await db
			.select()
			.from(payoutClaims)
			.where(eq(payoutClaims.claimId, claimId));

		if (!claim) {
			return { success: false, error: "Claim not found" };
		}

		if (!ALLOWED_FILE_TYPES.includes(data.fileType.toLowerCase())) {
			return {
				success: false,
				error: `Invalid file type. Allowed: ${ALLOWED_FILE_TYPES.join(", ")}`,
			};
		}

		if (data.fileSize > MAX_FILE_SIZE) {
			return { success: false, error: "File size exceeds 10MB limit" };
		}

		const [proof] = await db
			.insert(proofUploads)
			.values({
				claimId,
				fileName: data.fileName,
				fileType: data.fileType,
				fileSize: data.fileSize,
				fileHash: data.fileHash,
				storagePath: data.storagePath,
				uploaderRole: data.uploaderRole,
				uploaderId: data.uploaderId,
			})
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId: claim.leadId,
			claimId,
			actorId: data.uploaderId,
			actorRole: data.uploaderRole,
			action: "PROOF_UPLOADED",
			details: {
				fileName: data.fileName,
				fileType: data.fileType,
				fileSize: data.fileSize,
			},
		});

		return { success: true, proof };
	}

	async sendBankerConfirmation(
		claimId: string,
		data: {
			bankerEmail: string;
			seniorEmail?: string;
			ccAdminEmail?: string;
			emailSubject: string;
			emailBody: string;
		},
	): Promise<{ success: boolean; email?: any; error?: string }> {
		const [claim] = await db
			.select()
			.from(payoutClaims)
			.where(eq(payoutClaims.claimId, claimId));

		if (!claim) {
			return { success: false, error: "Claim not found" };
		}

		const [email] = await db
			.insert(bankerConfirmationEmails)
			.values({
				claimId,
				bankerEmail: data.bankerEmail,
				seniorEmail: data.seniorEmail,
				ccAdminEmail: data.ccAdminEmail,
				emailSubject: data.emailSubject,
				emailBody: data.emailBody,
			})
			.returning();

		await db
			.update(payoutClaims)
			.set({
				bankerConfirmationEmailId: email.emailId,
				updatedAt: new Date(),
			})
			.where(eq(payoutClaims.claimId, claimId));

		await db.insert(leadAuditLogs).values({
			leadId: claim.leadId,
			claimId,
			actorId: claim.agentId,
			actorRole: "AGENT",
			action: "BANKER_EMAIL_SENT",
			details: {
				bankerEmail: data.bankerEmail,
				emailSubject: data.emailSubject,
			},
		});

		return { success: true, email };
	}

	async adminConfirmBankerReply(
		claimId: string,
		adminId: string,
		emailContent?: string,
	): Promise<{
		success: boolean;
		claim?: PayoutClaim;
		decisionApplied?: string;
		error?: string;
	}> {
		const [claim] = await db
			.select()
			.from(payoutClaims)
			.where(eq(payoutClaims.claimId, claimId));

		if (!claim) {
			return { success: false, error: "Claim not found" };
		}

		if (!claim.bankerConfirmationEmailId) {
			return {
				success: false,
				error: "No banker confirmation email associated with this claim",
			};
		}

		await db
			.update(bankerConfirmationEmails)
			.set({
				replyReceived: true,
				replyReceivedAt: new Date(),
				replyContent: emailContent,
				taggedByAdminId: adminId,
				taggedAt: new Date(),
			})
			.where(
				eq(bankerConfirmationEmails.emailId, claim.bankerConfirmationEmailId),
			);

		await db
			.update(payoutClaims)
			.set({
				status: "CONFIRMED_BY_FINANCIER" as any,
				bankerConfirmedAt: new Date(),
				confirmedByAdminId: adminId,
				updatedAt: new Date(),
			})
			.where(eq(payoutClaims.claimId, claimId));

		let finalStatus: string;
		let decisionApplied: string;

		if (claim.pddStatus === "CLEARED") {
			finalStatus = "APPROVED";
			decisionApplied = "PDD already cleared — claim approved";
		} else if (
			claim.pddStatus === "PENDING" &&
			claim.pddExceptionAllowedByFinancier
		) {
			finalStatus = "APPROVED";
			decisionApplied =
				"PDD pending but exception allowed by financier — claim approved";
		} else if (claim.pddStatus === "PENDING") {
			finalStatus = "ON_HOLD_PDD";
			decisionApplied = "PDD pending without exception — claim on hold";
		} else if (claim.pddStatus === "NOT_APPLICABLE") {
			finalStatus = "APPROVED";
			decisionApplied = "PDD not applicable — claim approved";
		} else {
			finalStatus = "CONFIRMED_BY_FINANCIER";
			decisionApplied = "Confirmed by financier — no PDD decision applicable";
		}

		const updateData: any = {
			status: finalStatus as any,
			updatedAt: new Date(),
		};

		if (finalStatus === "APPROVED") {
			updateData.approvedAt = new Date();
		}

		const [updatedClaim] = await db
			.update(payoutClaims)
			.set(updateData)
			.where(eq(payoutClaims.claimId, claimId))
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId: claim.leadId,
			claimId,
			actorId: adminId,
			actorRole: "ADMIN",
			action: "BANKER_CONFIRMATION_TAGGED",
			details: { decisionApplied, finalStatus },
		});

		return { success: true, claim: updatedClaim, decisionApplied };
	}

	async confirmPddClearance(
		claimId: string,
		actorId: string,
		ipAddress?: string,
	): Promise<{ success: boolean; claim?: PayoutClaim; error?: string }> {
		const [claim] = await db
			.select()
			.from(payoutClaims)
			.where(eq(payoutClaims.claimId, claimId));

		if (!claim) {
			return { success: false, error: "Claim not found" };
		}

		if (claim.status !== "ON_HOLD_PDD") {
			return {
				success: false,
				error: "Claim is not on hold for PDD clearance",
			};
		}

		const [updatedClaim] = await db
			.update(payoutClaims)
			.set({
				pddStatus: "CLEARED" as any,
				pddClearedAt: new Date(),
				status: "APPROVED" as any,
				approvedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(payoutClaims.claimId, claimId))
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId: claim.leadId,
			claimId,
			actorId,
			actorRole: "ADMIN",
			action: "PDD_CLEARED",
			details: { previousStatus: "ON_HOLD_PDD" },
			ipAddress,
		});

		return { success: true, claim: updatedClaim };
	}

	async rejectClaim(
		claimId: string,
		adminId: string,
		reason: string,
	): Promise<{ success: boolean; claim?: PayoutClaim; error?: string }> {
		const [claim] = await db
			.select()
			.from(payoutClaims)
			.where(eq(payoutClaims.claimId, claimId));

		if (!claim) {
			return { success: false, error: "Claim not found" };
		}

		const [updatedClaim] = await db
			.update(payoutClaims)
			.set({
				status: "REJECTED" as any,
				rejectedAt: new Date(),
				rejectionReason: reason,
				updatedAt: new Date(),
			})
			.where(eq(payoutClaims.claimId, claimId))
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId: claim.leadId,
			claimId,
			actorId: adminId,
			actorRole: "ADMIN",
			action: "CLAIM_REJECTED",
			details: { reason },
		});

		return { success: true, claim: updatedClaim };
	}

	async executeClawback(
		claimId: string,
		actorId: string,
		reason: string,
	): Promise<{ success: boolean; claim?: PayoutClaim; error?: string }> {
		const [claim] = await db
			.select()
			.from(payoutClaims)
			.where(eq(payoutClaims.claimId, claimId));

		if (!claim) {
			return { success: false, error: "Claim not found" };
		}

		if (claim.status !== "APPROVED") {
			return {
				success: false,
				error: "Only approved claims can be clawed back",
			};
		}

		const [updatedClaim] = await db
			.update(payoutClaims)
			.set({
				status: "CLAWED_BACK" as any,
				updatedAt: new Date(),
			})
			.where(eq(payoutClaims.claimId, claimId))
			.returning();

		if (claim.commissionLedgerId) {
			const [ledgerEntry] = await db
				.select()
				.from(progressiveCommissionLedger)
				.where(
					eq(progressiveCommissionLedger.ledgerId, claim.commissionLedgerId),
				);

			if (ledgerEntry) {
				await db.insert(reversalLedger).values({
					originalLedgerId: claim.commissionLedgerId,
					transactionId: claim.claimId,
					partnerId: ledgerEntry.partnerId,
					reversalAmount: ledgerEntry.amount,
					reversalType: "FULL",
					walletDebited: false,
					negativeCarryForward: "0.00",
				});
			}
		}

		await db.insert(leadAuditLogs).values({
			leadId: claim.leadId,
			claimId,
			actorId,
			actorRole: "ADMIN",
			action: "COMMISSION_CLAWED_BACK",
			details: { reason, commissionLedgerId: claim.commissionLedgerId },
		});

		return { success: true, claim: updatedClaim };
	}

	async getClaimById(claimId: string): Promise<PayoutClaim | null> {
		const [claim] = await db
			.select()
			.from(payoutClaims)
			.where(eq(payoutClaims.claimId, claimId));
		return claim || null;
	}

	async getClaimsByAgent(agentId: string): Promise<PayoutClaim[]> {
		return db
			.select()
			.from(payoutClaims)
			.where(eq(payoutClaims.agentId, agentId))
			.orderBy(desc(payoutClaims.createdAt));
	}

	async getClaimsByLead(leadId: string): Promise<PayoutClaim[]> {
		return db
			.select()
			.from(payoutClaims)
			.where(eq(payoutClaims.leadId, leadId));
	}

	async getProofsByClaimId(claimId: string) {
		return db
			.select()
			.from(proofUploads)
			.where(eq(proofUploads.claimId, claimId));
	}

	async getClaimsByStatus(status: string): Promise<PayoutClaim[]> {
		return db
			.select()
			.from(payoutClaims)
			.where(eq(payoutClaims.status, status as any));
	}

	async getAuditLogs(leadId?: string, claimId?: string) {
		const conditions: any[] = [];
		if (leadId) conditions.push(eq(leadAuditLogs.leadId, leadId));
		if (claimId) conditions.push(eq(leadAuditLogs.claimId, claimId));

		const query =
			conditions.length > 0
				? db
						.select()
						.from(leadAuditLogs)
						.where(and(...conditions))
				: db.select().from(leadAuditLogs);

		return query.orderBy(desc(leadAuditLogs.createdAt));
	}
}

export const payoutClaimService = PayoutClaimService.getInstance();
