/**
 * approvalService.ts — Universal Admin Copilot Approval State Machine
 * Handles all 9 agents via a single approval endpoint.
 * GUARDRAIL: External API calls (send email, issue invoice, send meeting invite)
 * require a 2-step confirmation token before executing.
 *
 * Purpose : Centralise admin approval, edit, reject, assign, convert, export actions.
 * Inputs  : ApprovalAction + entityId + adminUserId
 * Outputs : Updated entity + ai_admin_approvals record + ai_audit_log entry
 */

import { db } from "../../db";
import {
	aiAdminApprovals,
	aiEmailClassifications,
	aiProposalDrafts,
	aiAdminTasks,
	aiInvoiceDrafts,
	aiMeetingActions,
	aiMeetingNotes,
} from "@shared/schema/admin-copilot";
import { eq } from "drizzle-orm";
import { auditLog } from "../../logger";
import { createTaskFromSource } from "./taskAgent";
import { randomUUID } from "crypto";

export type ApprovalAction =
	| "approve"
	| "edit"
	| "reject"
	| "assign"
	| "convert_to_task"
	| "convert_to_proposal"
	| "send_email_after_confirm"
	| "issue_invoice_after_confirm"
	| "send_meeting_invite_after_confirm"
	| "export_pdf";

export interface ApprovalRequest {
	agentType: string;
	entityId: string;
	entityType: string;
	action: ApprovalAction;
	adminId: string;
	adminRole: string;
	editedContent?: Record<string, unknown>;
	assignedToRole?: string;
	assignedToUserId?: string;
	notes?: string;
	confirmationToken?: string; // required for 2-step actions
}

export interface ApprovalResult {
	success: boolean;
	approvalId: string;
	resultEntityId?: string;
	resultEntityType?: string;
	confirmationRequired?: boolean;
	confirmationToken?: string;
	message: string;
}

// ── 2-Step confirmation store (in-memory, short TTL) ─────────────────────────
const pendingConfirmations = new Map<
	string,
	{
		action: ApprovalAction;
		entityId: string;
		adminId: string;
		expiresAt: number;
	}
>();

function createConfirmationToken(
	action: ApprovalAction,
	entityId: string,
	adminId: string,
): string {
	const token = `confirm_${randomUUID()}`;
	pendingConfirmations.set(token, {
		action,
		entityId,
		adminId,
		expiresAt: Date.now() + 5 * 60 * 1000, // 5 min TTL
	});
	return token;
}

function validateConfirmationToken(token: string, adminId: string): boolean {
	const pending = pendingConfirmations.get(token);
	if (!pending) return false;
	if (pending.adminId !== adminId) return false;
	if (Date.now() > pending.expiresAt) {
		pendingConfirmations.delete(token);
		return false;
	}
	pendingConfirmations.delete(token);
	return true;
}

// ── Entity updaters by type ────────────────────────────────────────────────
async function markEntityApproved(
	entityType: string,
	entityId: string,
	adminId: string,
): Promise<void> {
	const now = new Date();
	switch (entityType) {
		case "ai_email_classifications":
			await db
				.update(aiEmailClassifications)
				.set({
					approvalStatus: "approved",
					approvedBy: adminId,
					approvedAt: now,
					updatedAt: now,
				})
				.where(eq(aiEmailClassifications.id, entityId));
			break;
		case "ai_proposal_drafts":
			await db
				.update(aiProposalDrafts)
				.set({
					approvalStatus: "approved",
					approvedBy: adminId,
					approvedAt: now,
					updatedAt: now,
				})
				.where(eq(aiProposalDrafts.id, entityId));
			break;
		case "ai_admin_tasks":
			await db
				.update(aiAdminTasks)
				.set({
					approvalStatus: "approved",
					approvedBy: adminId,
					approvedAt: now,
					status: "approved",
					updatedAt: now,
				})
				.where(eq(aiAdminTasks.id, entityId));
			break;
		case "ai_invoice_drafts":
			await db
				.update(aiInvoiceDrafts)
				.set({
					approvalStatus: "approved",
					approvedBy: adminId,
					approvedAt: now,
					updatedAt: now,
				})
				.where(eq(aiInvoiceDrafts.id, entityId));
			break;
		case "ai_meeting_actions":
			await db
				.update(aiMeetingActions)
				.set({
					approvalStatus: "approved",
					approvedBy: adminId,
					approvedAt: now,
					updatedAt: now,
				})
				.where(eq(aiMeetingActions.id, entityId));
			break;
		case "ai_meeting_notes":
			await db
				.update(aiMeetingNotes)
				.set({
					approvalStatus: "approved",
					approvedBy: adminId,
					approvedAt: now,
					updatedAt: now,
				})
				.where(eq(aiMeetingNotes.id, entityId));
			break;
	}
}

async function markEntityRejected(
	entityType: string,
	entityId: string,
	adminId: string,
	reason?: string,
): Promise<void> {
	const now = new Date();
	switch (entityType) {
		case "ai_email_classifications":
			await db
				.update(aiEmailClassifications)
				.set({
					approvalStatus: "rejected",
					draftReplyStatus: "rejected",
					updatedAt: now,
				})
				.where(eq(aiEmailClassifications.id, entityId));
			break;
		case "ai_proposal_drafts":
			await db
				.update(aiProposalDrafts)
				.set({
					approvalStatus: "rejected",
					rejectionReason: reason,
					updatedAt: now,
				})
				.where(eq(aiProposalDrafts.id, entityId));
			break;
		case "ai_admin_tasks":
			await db
				.update(aiAdminTasks)
				.set({
					approvalStatus: "rejected",
					status: "closed",
					updatedAt: now,
				})
				.where(eq(aiAdminTasks.id, entityId));
			break;
		case "ai_invoice_drafts":
			await db
				.update(aiInvoiceDrafts)
				.set({
					approvalStatus: "rejected",
					rejectionReason: reason,
					updatedAt: now,
				})
				.where(eq(aiInvoiceDrafts.id, entityId));
			break;
		case "ai_meeting_actions":
			await db
				.update(aiMeetingActions)
				.set({
					approvalStatus: "rejected",
					meetingStatus: "cancelled",
					updatedAt: now,
				})
				.where(eq(aiMeetingActions.id, entityId));
			break;
	}
}

// ── Main approval processor ────────────────────────────────────────────────
export async function processApproval(
	req: ApprovalRequest,
): Promise<ApprovalResult> {
	const {
		agentType,
		entityId,
		entityType,
		action,
		adminId,
		adminRole,
		editedContent,
		notes,
		confirmationToken,
	} = req;

	// 2-step actions: first call issues a token, second call with token executes
	const twoStepActions: ApprovalAction[] = [
		"send_email_after_confirm",
		"issue_invoice_after_confirm",
		"send_meeting_invite_after_confirm",
	];

	if (twoStepActions.includes(action)) {
		if (!confirmationToken) {
			// Step 1: issue confirmation token
			const token = createConfirmationToken(action, entityId, adminId);
			return {
				success: true,
				approvalId: randomUUID(),
				confirmationRequired: true,
				confirmationToken: token,
				message: `Confirmation required. Re-submit with token "${token}" to proceed.`,
			};
		}
		// Step 2: validate token
		if (!validateConfirmationToken(confirmationToken, adminId)) {
			return {
				success: false,
				approvalId: randomUUID(),
				message:
					"Invalid or expired confirmation token. Please restart the approval.",
			};
		}
		// Token valid — proceed with external call
		// NOTE: actual Zoho API call (send email / issue invoice / send invite)
		// is handled by the respective agent after this approval record is created.
	}

	// Apply entity update
	if (action === "approve") {
		await markEntityApproved(entityType, entityId, adminId);
	} else if (action === "reject") {
		await markEntityRejected(entityType, entityId, adminId, notes);
	} else if (action === "edit" && editedContent) {
		// Generic edit: the route handler applies specific field updates
		// This service records the edit approval action
	} else if (action === "assign" && req.assignedToRole) {
		if (entityType === "ai_admin_tasks") {
			await db
				.update(aiAdminTasks)
				.set({
					assignedToRole: req.assignedToRole,
					assignedToUserId: req.assignedToUserId,
					status: "assigned",
					updatedAt: new Date(),
				})
				.where(eq(aiAdminTasks.id, entityId));
		}
	}

	// Record in ai_admin_approvals
	const approvalId = randomUUID();
	await db.insert(aiAdminApprovals).values({
		id: approvalId,
		agentType,
		entityId,
		entityType,
		action,
		adminId,
		adminRole,
		editedContent: editedContent ?? null,
		notes,
		confirmedAt: twoStepActions.includes(action) ? new Date() : undefined,
		source: "admin",
	});

	// Audit log
	await auditLog({
		userId: adminId,
		userRole: adminRole,
		agentType,
		agentAction: `approval_${action}`,
		entityId,
		entityType,
		approvalStatus:
			action === "approve"
				? "approved"
				: action === "reject"
					? "rejected"
					: action,
		approvingAdmin: adminId,
		source: "admin",
		status: "success",
	});

	return {
		success: true,
		approvalId,
		message: `Action '${action}' applied to ${entityType} ${entityId}`,
	};
}
