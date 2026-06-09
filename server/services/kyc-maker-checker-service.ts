// @ts-nocheck
import { db } from "../db";
import {
	kycApprovals,
	kycAuditLogs,
	MAKER_CHECKER_ENTITY_TYPES,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "ESCALATED";

interface SubmitForApprovalParams {
	sessionId: string;
	userId: string;
	entityType: string;
	makerId: string;
	makerNotes?: string;
}

interface ApproveRejectParams {
	approvalId: string;
	checkerId: string;
	checkerIpAddress?: string;
	notes?: string;
	rejectionReason?: string;
}

class KycMakerCheckerService {
	constructor() {
		console.log("✅ KYC Maker-Checker Service initialized");
		console.log(`   Required for: ${MAKER_CHECKER_ENTITY_TYPES.join(", ")}`);
	}

	requiresMakerChecker(entityType: string | null): boolean {
		if (!entityType) return false;
		return (MAKER_CHECKER_ENTITY_TYPES as readonly string[]).includes(
			entityType.toUpperCase(),
		);
	}

	async submit(params: SubmitForApprovalParams): Promise<{
		success: boolean;
		approvalId?: string;
		error?: string;
	}> {
		try {
			if (!this.requiresMakerChecker(params.entityType)) {
				return {
					success: false,
					error: `Entity type ${params.entityType} does not require maker-checker approval`,
				};
			}

			const existing = await db
				.select()
				.from(kycApprovals)
				.where(
					and(
						eq(kycApprovals.sessionId, params.sessionId),
						eq(kycApprovals.status, "PENDING"),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				return { success: true, approvalId: existing[0].id };
			}

			const [approval] = await db
				.insert(kycApprovals)
				.values({
					sessionId: params.sessionId,
					userId: params.userId,
					entityType: params.entityType.toUpperCase(),
					makerId: params.makerId,
					makerNotes: params.makerNotes || null,
					status: "PENDING",
				})
				.returning();

			await db.insert(kycAuditLogs).values({
				sessionId: params.sessionId,
				userId: params.userId,
				action: "MAKER_CHECKER_SUBMITTED",
				step: "maker_checker",
				performedBy: params.makerId,
				performedByRole: "maker",
				newValue: { entityType: params.entityType, approvalId: approval.id },
			});

			return { success: true, approvalId: approval.id };
		} catch (error) {
			console.error("[MakerChecker] Error submitting:", error);
			return { success: false, error: "Failed to submit for approval" };
		}
	}

	async approve(params: ApproveRejectParams): Promise<{
		success: boolean;
		error?: string;
	}> {
		try {
			const [approval] = await db
				.select()
				.from(kycApprovals)
				.where(eq(kycApprovals.id, params.approvalId))
				.limit(1);

			if (!approval) {
				return { success: false, error: "Approval request not found" };
			}

			if (approval.status !== "PENDING") {
				return {
					success: false,
					error: `Approval already ${approval.status.toLowerCase()}`,
				};
			}

			if (approval.makerId === params.checkerId) {
				return {
					success: false,
					error:
						"Maker and Checker cannot be the same person (segregation of duties)",
				};
			}

			await db
				.update(kycApprovals)
				.set({
					checkerId: params.checkerId,
					checkerNotes: params.notes || null,
					checkerIpAddress: params.checkerIpAddress || null,
					status: "APPROVED",
					decidedAt: new Date(),
				})
				.where(eq(kycApprovals.id, params.approvalId));

			await db.insert(kycAuditLogs).values({
				sessionId: approval.sessionId,
				userId: approval.userId,
				action: "MAKER_CHECKER_APPROVED",
				step: "maker_checker",
				performedBy: params.checkerId,
				performedByRole: "checker",
				ipAddress: params.checkerIpAddress,
				previousValue: { status: "PENDING" },
				newValue: { status: "APPROVED", checkerNotes: params.notes },
			});

			return { success: true };
		} catch (error) {
			console.error("[MakerChecker] Error approving:", error);
			return { success: false, error: "Failed to approve" };
		}
	}

	async reject(params: ApproveRejectParams): Promise<{
		success: boolean;
		error?: string;
	}> {
		try {
			const [approval] = await db
				.select()
				.from(kycApprovals)
				.where(eq(kycApprovals.id, params.approvalId))
				.limit(1);

			if (!approval) {
				return { success: false, error: "Approval request not found" };
			}

			if (approval.status !== "PENDING") {
				return {
					success: false,
					error: `Approval already ${approval.status.toLowerCase()}`,
				};
			}

			if (approval.makerId === params.checkerId) {
				return {
					success: false,
					error: "Maker and Checker cannot be the same person",
				};
			}

			await db
				.update(kycApprovals)
				.set({
					checkerId: params.checkerId,
					checkerNotes: params.notes || null,
					checkerIpAddress: params.checkerIpAddress || null,
					rejectionReason: params.rejectionReason || "No reason provided",
					status: "REJECTED",
					decidedAt: new Date(),
				})
				.where(eq(kycApprovals.id, params.approvalId));

			await db.insert(kycAuditLogs).values({
				sessionId: approval.sessionId,
				userId: approval.userId,
				action: "MAKER_CHECKER_REJECTED",
				step: "maker_checker",
				performedBy: params.checkerId,
				performedByRole: "checker",
				ipAddress: params.checkerIpAddress,
				previousValue: { status: "PENDING" },
				newValue: { status: "REJECTED", reason: params.rejectionReason },
			});

			return { success: true };
		} catch (error) {
			console.error("[MakerChecker] Error rejecting:", error);
			return { success: false, error: "Failed to reject" };
		}
	}

	async getApproval(approvalId: string): Promise<any> {
		try {
			const [approval] = await db
				.select()
				.from(kycApprovals)
				.where(eq(kycApprovals.id, approvalId))
				.limit(1);
			return approval || null;
		} catch {
			return null;
		}
	}

	async getPendingApprovals(): Promise<any[]> {
		try {
			return await db
				.select()
				.from(kycApprovals)
				.where(eq(kycApprovals.status, "PENDING"))
				.orderBy(desc(kycApprovals.submittedAt));
		} catch {
			return [];
		}
	}

	async getApprovalHistory(limit: number = 50): Promise<any[]> {
		try {
			return await db
				.select()
				.from(kycApprovals)
				.orderBy(desc(kycApprovals.submittedAt))
				.limit(limit);
		} catch {
			return [];
		}
	}

	async getApprovalBySession(sessionId: string): Promise<any> {
		try {
			const [approval] = await db
				.select()
				.from(kycApprovals)
				.where(eq(kycApprovals.sessionId, sessionId))
				.orderBy(desc(kycApprovals.submittedAt))
				.limit(1);
			return approval || null;
		} catch {
			return null;
		}
	}
}

export const kycMakerCheckerService = new KycMakerCheckerService();
