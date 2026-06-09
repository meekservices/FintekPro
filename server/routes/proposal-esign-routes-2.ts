// @ts-nocheck
import { Router, Request, Response } from "express";
import {
	proposalEsignWorkflowService,
	WorkflowStatus,
	ParticipantRole,
	SignatureMethod,
} from "../services/proposal-esign-workflow-service";
import { z } from "zod";
import { db } from "../db";
import {
	proposalEsignParticipants,
	proposalEsignWorkflows,
	proposalEsignFieldEdits,
	prospectProposals,
	proposalEsignComments,
} from "@shared/schema";
import { eq, or, and } from "drizzle-orm";

const router = Router();

const getAuditContext = (req: Request) => ({
	actorId: (req as any).user?.id,
	actorName: (req as any).user?.name,
	actorEmail: (req as any).user?.email,
	actorRole: (req as any).user?.role,
	actorType: "user" as const,
	ipAddress: req.ip || req.socket.remoteAddress,
	userAgent: req.headers["user-agent"],
	deviceType: req.headers["user-agent"]?.includes("Mobile")
		? "mobile"
		: "desktop",
});

const ADMIN_ROLES = ["admin", "super_admin", "compliance_officer"];
const ELEVATED_ROLES = [
	"admin",
	"super_admin",
	"compliance_officer",
	"agent",
	"partner",
];

async function isAuthorizedForWorkflow(
	userId: string,
	userEmail: string,
	userRole: string,
	workflowId: string,
): Promise<{
	authorized: boolean;
	participant?: any;
	isCreator?: boolean;
	isAdmin?: boolean;
	isElevated?: boolean;
}> {
	const isElevated = ELEVATED_ROLES.includes(userRole);
	if (ADMIN_ROLES.includes(userRole)) {
		return { authorized: true, isAdmin: true, isElevated: true };
	}

	const [workflow] = await db
		.select()
		.from(proposalEsignWorkflows)
		.where(eq(proposalEsignWorkflows.id, workflowId))
		.limit(1);

	if (!workflow) {
		return { authorized: false };
	}

	if (workflow.createdBy === userId) {
		return { authorized: true, isCreator: true, isElevated };
	}

	const [participant] = await db
		.select()
		.from(proposalEsignParticipants)
		.where(
			and(
				eq(proposalEsignParticipants.workflowId, workflowId),
				or(
					eq(proposalEsignParticipants.userId, userId),
					eq(proposalEsignParticipants.email, userEmail),
				),
			),
		)
		.limit(1);

	if (participant) {
		return { authorized: true, participant, isElevated };
	}

	return { authorized: false };
}

async function requireWorkflowAccess(
	req: Request,
	res: Response,
	workflowId: string,
): Promise<{
	authorized: boolean;
	participant?: any;
	isCreator?: boolean;
	isAdmin?: boolean;
	isElevated?: boolean;
} | null> {
	const user = (req as any).user;
	if (!user) {
		res.status(401).json({ error: "Unauthorized" });
		return null;
	}

	const auth = await isAuthorizedForWorkflow(
		user.id,
		user.email,
		user.role,
		workflowId,
	);
	if (!auth.authorized) {
		res.status(403).json({ error: "You do not have access to this workflow" });
		return null;
	}

	return auth;
}

const createWorkflowSchema = z.object({
	proposalId: z.string(),
	documentName: z.string(),
	documentUrl: z.string(),
	documentHash: z.string().optional(),
	allowEditing: z.boolean().optional(),
	isSequential: z.boolean().optional(),
	deadline: z.string().optional(),
	participants: z.array(
		z.object({
			userId: z.string().optional(),
			email: z.string().email().optional(),
			name: z.string().optional(),
			mobile: z.string().optional(),
			role: z.enum([
				"creator",
				"editor",
				"reviewer",
				"approver",
				"signer",
				"witness",
				"cc",
			]),
			actionOrder: z.number().optional(),
			canEdit: z.boolean().optional(),
			canApprove: z.boolean().optional(),
			canSign: z.boolean().optional(),
			preferredSignatureMethod: z
				.enum(["zoho_sign", "aadhaar_esign", "dsc_token", "otp"])
				.optional(),
		}),
	),
});

router.post(
	"/workflows/:workflowId/status",
	async (req: Request, res: Response) => {
		try {
			const user = (req as any).user;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { workflowId } = req.params;

			const auth = await requireWorkflowAccess(req, res, workflowId);
			if (!auth) return;

			if (!auth.isCreator && !auth.isAdmin) {
				return res
					.status(403)
					.json({
						error: "Only workflow creator or admin can change workflow status",
					});
			}

			const { status } = req.body;

			const validStatuses: WorkflowStatus[] = [
				"draft",
				"pending_edit",
				"pending_approval",
				"pending_signature",
				"cancelled",
			];
			if (!validStatuses.includes(status)) {
				return res.status(400).json({ error: "Invalid status" });
			}

			await proposalEsignWorkflowService.updateWorkflowStatus(
				workflowId,
				status,
				user.id,
			);

			res.json({ success: true, message: `Status updated to ${status}` });
		} catch (error) {
			console.error("Update status error:", error);
			res
				.status(500)
				.json({
					error:
						error instanceof Error ? error.message : "Failed to update status",
				});
		}
	},
);

const initiateSignatureSchema = z.object({
	participantId: z.string(),
	method: z.enum(["zoho_sign", "aadhaar_esign", "dsc_token", "otp"]),
});

router.post(
	"/workflows/:workflowId/sign/initiate",
	async (req: Request, res: Response) => {
		try {
			const user = (req as any).user;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { workflowId } = req.params;

			const auth = await requireWorkflowAccess(req, res, workflowId);
			if (!auth) return;

			const parsed = initiateSignatureSchema.safeParse(req.body);

			if (!parsed.success) {
				return res
					.status(400)
					.json({ error: "Invalid request", details: parsed.error.issues });
			}

			const [participant] = await db
				.select()
				.from(proposalEsignParticipants)
				.where(eq(proposalEsignParticipants.id, parsed.data.participantId))
				.limit(1);

			if (!participant || participant.workflowId !== workflowId) {
				return res.status(404).json({ error: "Participant not found" });
			}

			const isOwnSignature =
				participant.userId === user.id || participant.email === user.email;
			if (!isOwnSignature && !auth.isElevated) {
				return res
					.status(403)
					.json({
						error:
							"Only admin, agent, or partner can initiate signatures for others",
					});
			}

			if (!participant.canSign) {
				return res
					.status(403)
					.json({ error: "This participant does not have signing permission" });
			}

			const context = getAuditContext(req);
			const result = await proposalEsignWorkflowService.initiateSignature(
				workflowId,
				parsed.data.participantId,
				parsed.data.method as SignatureMethod,
				context,
			);

			res.json({ success: true, ...result });
		} catch (error) {
			console.error("Initiate signature error:", error);
			res
				.status(500)
				.json({
					error:
						error instanceof Error
							? error.message
							: "Failed to initiate signature",
				});
		}
	},
);

const recordSignatureSchema = z.object({
	participantId: z.string(),
	certificateId: z.string().optional(),
	signatureHash: z.string().optional(),
	signerName: z.string().optional(),
	signedDocumentUrl: z.string().optional(),
});

router.post(
	"/workflows/:workflowId/sign/complete",
	async (req: Request, res: Response) => {
		try {
			const user = (req as any).user;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { workflowId } = req.params;

			const auth = await requireWorkflowAccess(req, res, workflowId);
			if (!auth) return;

			const parsed = recordSignatureSchema.safeParse(req.body);

			if (!parsed.success) {
				return res
					.status(400)
					.json({ error: "Invalid request", details: parsed.error.issues });
			}

			const [participant] = await db
				.select()
				.from(proposalEsignParticipants)
				.where(eq(proposalEsignParticipants.id, parsed.data.participantId))
				.limit(1);

			if (!participant || participant.workflowId !== workflowId) {
				return res.status(404).json({ error: "Participant not found" });
			}

			const isOwnSignature =
				participant.userId === user.id || participant.email === user.email;
			if (!isOwnSignature && !auth.isElevated) {
				return res
					.status(403)
					.json({
						error:
							"Only admin, agent, or partner can complete signatures for others",
					});
			}

			const context = getAuditContext(req);
			await proposalEsignWorkflowService.recordSignature(
				workflowId,
				parsed.data.participantId,
				{
					certificateId: parsed.data.certificateId,
					signatureHash: parsed.data.signatureHash,
					signerName: parsed.data.signerName,
					signedDocumentUrl: parsed.data.signedDocumentUrl,
				},
				context,
			);

			res.json({ success: true, message: "Signature recorded" });
		} catch (error) {
			console.error("Record signature error:", error);
			res
				.status(500)
				.json({
					error:
						error instanceof Error
							? error.message
							: "Failed to record signature",
				});
		}
	},
);

router.post(
	"/workflows/:workflowId/decline",
	async (req: Request, res: Response) => {
		try {
			const user = (req as any).user;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { workflowId } = req.params;

			const auth = await requireWorkflowAccess(req, res, workflowId);
			if (!auth) return;

			const { participantId, reason } = req.body;

			if (!participantId || !reason) {
				return res
					.status(400)
					.json({ error: "Participant ID and reason are required" });
			}

			const [participant] = await db
				.select()
				.from(proposalEsignParticipants)
				.where(eq(proposalEsignParticipants.id, participantId))
				.limit(1);

			if (!participant || participant.workflowId !== workflowId) {
				return res.status(404).json({ error: "Participant not found" });
			}

			const isOwnAction =
				participant.userId === user.id || participant.email === user.email;
			if (!isOwnAction && !auth.isCreator && !auth.isAdmin) {
				return res
					.status(403)
					.json({
						error:
							"You can only decline on your own behalf or be admin/creator",
					});
			}

			const context = getAuditContext(req);
			await proposalEsignWorkflowService.recordDecline(
				workflowId,
				participantId,
				reason,
				context,
			);

			res.json({ success: true, message: "Document declined" });
		} catch (error) {
			console.error("Decline error:", error);
			res
				.status(500)
				.json({
					error:
						error instanceof Error
							? error.message
							: "Failed to decline document",
				});
		}
	},
);

router.post(
	"/workflows/:workflowId/view",
	async (req: Request, res: Response) => {
		try {
			const user = (req as any).user;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { workflowId } = req.params;

			const auth = await requireWorkflowAccess(req, res, workflowId);
			if (!auth) return;

			const { participantId } = req.body;

			if (!participantId) {
				return res.status(400).json({ error: "Participant ID is required" });
			}

			const [participant] = await db
				.select()
				.from(proposalEsignParticipants)
				.where(eq(proposalEsignParticipants.id, participantId))
				.limit(1);

			if (!participant || participant.workflowId !== workflowId) {
				return res.status(404).json({ error: "Participant not found" });
			}

			const isOwnView =
				participant.userId === user.id || participant.email === user.email;
			if (!isOwnView && !auth.isCreator && !auth.isAdmin) {
				return res
					.status(403)
					.json({
						error: "You can only record your own views or be admin/creator",
					});
			}

			const context = getAuditContext(req);
			await proposalEsignWorkflowService.recordView(
				workflowId,
				participantId,
				context,
			);

			res.json({ success: true });
		} catch (error) {
			console.error("Record view error:", error);
			res.status(500).json({ error: "Failed to record view" });
		}
	},
);

router.post(
	"/workflows/:workflowId/negotiate",
	async (req: Request, res: Response) => {
		try {
			const user = (req as any).user;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { workflowId } = req.params;

			const auth = await requireWorkflowAccess(req, res, workflowId);
			if (!auth) return;

			await proposalEsignWorkflowService.startNegotiationRound(
				workflowId,
				user.id,
			);

			res.json({ success: true, message: "New negotiation round started" });
		} catch (error) {
			console.error("Start negotiation error:", error);
			res
				.status(500)
				.json({
					error:
						error instanceof Error
							? error.message
							: "Failed to start negotiation round",
				});
		}
	},
);

router.post(
	"/workflows/:workflowId/remind/:participantId",
	async (req: Request, res: Response) => {
		try {
			const { workflowId, participantId } = req.params;

			const auth = await requireWorkflowAccess(req, res, workflowId);
			if (!auth) return;

			if (!auth.isCreator && !auth.isAdmin) {
				return res
					.status(403)
					.json({ error: "Only workflow creator or admin can send reminders" });
			}

			await proposalEsignWorkflowService.sendReminder(
				workflowId,
				participantId,
			);

			res.json({ success: true, message: "Reminder sent" });
		} catch (error) {
			console.error("Send reminder error:", error);
			res.status(500).json({ error: "Failed to send reminder" });
		}
	},
);

router.get(
	"/workflows/:workflowId/audit",
	async (req: Request, res: Response) => {
		try {
			const { workflowId } = req.params;

			const auth = await requireWorkflowAccess(req, res, workflowId);
			if (!auth) return;

			if (!auth.isElevated) {
				return res
					.status(403)
					.json({ error: "Only admin, agent, or partner can view audit logs" });
			}

			const limit = Number.parseInt(req.query.limit as string) || 100;

			const auditLog = await proposalEsignWorkflowService.getAuditLog(
				workflowId,
				limit,
			);

			res.json({ success: true, auditLog });
		} catch (error) {
			console.error("Get audit log error:", error);
			res.status(500).json({ error: "Failed to get audit log" });
		}
	},
);

router.post("/webhooks/zoho-sign", async (req: Request, res: Response) => {
	try {
		const { request_id, request_status, actions } = req.body;

		console.log("Zoho Sign webhook received:", { request_id, request_status });

		res.json({ success: true });
	} catch (error) {
		console.error("Zoho Sign webhook error:", error);
		res.status(500).json({ error: "Webhook processing failed" });
	}
});

import { investmentAgreementGenerator } from "../services/investment-agreement-generator";

async function isAuthorizedForProposal(
	userId: string,
	userEmail: string,
	userRole: string,
	proposalId: string,
): Promise<boolean> {
	if (ADMIN_ROLES.includes(userRole)) {
		return true;
	}

	const [proposal] = await db
		.select()
		.from(prospectProposals)
		.where(eq(prospectProposals.id, proposalId))
		.limit(1);

	if (!proposal) {
		return false;
	}

	if (proposal.agentId === userId || proposal.clientUserId === userId) {
		return true;
	}

	const [workflow] = await db
		.select()
		.from(proposalEsignWorkflows)
		.where(eq(proposalEsignWorkflows.proposalId, proposalId))
		.limit(1);

	if (!workflow) {
		return true;
	}

	const auth = await isAuthorizedForWorkflow(
		userId,
		userEmail,
		userRole,
		workflow.id,
	);
	return auth.authorized;
}

router.get(
	"/agreements/:proposalId/preview",
	async (req: Request, res: Response) => {
		try {
			const user = (req as any).user;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { proposalId } = req.params;

			if (
				!(await isAuthorizedForProposal(
					user.id,
					user.email,
					user.role,
					proposalId,
				))
			) {
				return res
					.status(403)
					.json({ error: "You do not have access to this proposal" });
			}

			const html =
				await investmentAgreementGenerator.previewAgreement(proposalId);

			res.setHeader("Content-Type", "text/html");
			res.send(html);
		} catch (error) {
			console.error("Preview agreement error:", error);
			res
				.status(500)
				.json({
					error:
						error instanceof Error
							? error.message
							: "Failed to generate preview",
				});
		}
	},
);

router.post(
	"/agreements/:proposalId/generate",
	async (req: Request, res: Response) => {
		try {
			const user = (req as any).user;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { proposalId } = req.params;

			if (
				!(await isAuthorizedForProposal(
					user.id,
					user.email,
					user.role,
					proposalId,
				))
			) {
				return res
					.status(403)
					.json({ error: "You do not have access to this proposal" });
			}

			const { versionNumber, watermark } = req.body;

			let agreement;
			if (versionNumber && versionNumber > 1) {
				agreement = await investmentAgreementGenerator.createRevisedAgreement(
					proposalId,
					versionNumber,
					watermark,
				);
			} else {
				agreement =
					await investmentAgreementGenerator.createFinalAgreement(proposalId);
			}

			res.json({ success: true, agreement });
		} catch (error) {
			console.error("Generate agreement error:", error);
			res
				.status(500)
				.json({
					error:
						error instanceof Error
							? error.message
							: "Failed to generate agreement",
				});
		}
	},
);

router.get(
	"/agreements/:proposalId/fields",
	async (req: Request, res: Response) => {
		try {
			const user = (req as any).user;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const { proposalId } = req.params;

			if (
				!(await isAuthorizedForProposal(
					user.id,
					user.email,
					user.role,
					proposalId,
				))
			) {
				return res
					.status(403)
					.json({ error: "You do not have access to this proposal" });
			}

			const agreement =
				await investmentAgreementGenerator.createFinalAgreement(proposalId);

			res.json({ success: true, editableFields: agreement.editableFields });
		} catch (error) {
			console.error("Get editable fields error:", error);
			res
				.status(500)
				.json({
					error:
						error instanceof Error
							? error.message
							: "Failed to get editable fields",
				});
		}
	},
);

export default router;
