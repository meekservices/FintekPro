/**
 * admin-copilot-routes.ts — FintekPro Admin Copilot API Router
 * ALL routes require role = 'admin' | 'superadmin' (RBAC enforced by requireAdminOrSuperadmin).
 * All responses follow: { success, data, meta: { timestamp, version } }
 * All list endpoints support: page, limit, total pagination.
 */

import {
	Router,
	type Request,
	type Response,
	type NextFunction,
} from "express";
import { db } from "../db";
import {
	aiEmailClassifications,
	aiAdminTasks,
	aiProposalDrafts,
	aiBiReports,
	aiComplianceAlerts,
	aiAuditLogs,
	aiInvoiceDrafts,
	aiPayoutSuggestions,
	aiRevenueReconciliation,
	aiMeetingActions,
	aiMeetingNotes,
	aiMeetingFollowups,
} from "@shared/schema/admin-copilot";
import { desc, eq, and, or, sql } from "drizzle-orm";
import {
	syncAndClassifyEmails,
	redraftReply,
} from "../services/admin-copilot/mailAgent";
import {
	createTaskFromSource,
	updateTaskStatus,
} from "../services/admin-copilot/taskAgent";
import { generateProposalDraft } from "../services/admin-copilot/proposalAgent";
import {
	generateBiSummary,
	answerBiQuestion,
} from "../services/admin-copilot/biAgent";
import { processApproval } from "../services/admin-copilot/approvalService";
import { auditLog } from "../logger";
// Phase 2 agents
import {
	syncCrmLeads,
	generateLeadIntelligence,
	updateLeadStage,
} from "../services/admin-copilot/crmAgent";
import {
	syncDeskTickets,
	generateDraftResponse as deskDraftResponse,
	flagSlaBreachRisk,
	escalateTicket,
} from "../services/admin-copilot/deskAgent";
import {
	syncBooksData,
	draftInvoiceFromCrmDeal,
	calculatePayoutSuggestion,
	runRevenueReconciliation,
	getGstSummary,
	issueInvoiceToZohoBooks,
} from "../services/admin-copilot/booksAgent";
import {
	scheduleMeeting,
	sendMeetingInvite,
	generatePostMeetingSummary,
	extractFollowupTasks,
	trackNoShows,
} from "../services/admin-copilot/meetingAgent";
import {
	aiCrmLeadActions,
	aiDeskTicketActions,
} from "@shared/schema/admin-copilot";

export const adminCopilotRouter = Router();

const API_VERSION = "1.0";

function successResponse(data: unknown, meta?: Record<string, unknown>) {
	return {
		success: true,
		data,
		meta: {
			timestamp: new Date().toISOString(),
			version: API_VERSION,
			...meta,
		},
	};
}

function errorResponse(
	message: string,
	errorCode = "INTERNAL_ERROR",
	retryable = false,
) {
	return {
		success: false,
		error: { error_code: errorCode, message, retryable },
		meta: { timestamp: new Date().toISOString(), version: API_VERSION },
	};
}

/** RBAC guard: admin and superadmin only */
function requireAdminOrSuperadmin(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	const user = (req as any).user;
	if (!user || !["admin", "superadmin"].includes(user.role)) {
		return res
			.status(403)
			.json(errorResponse("Admin or Superadmin role required", "FORBIDDEN"));
	}
	next();
}

adminCopilotRouter.use(requireAdminOrSuperadmin);

// ── Helper: pagination ────────────────────────────────────────────────────────
function getPagination(query: Record<string, any>) {
	const page = Math.max(1, Number.parseInt(query.page ?? "1", 10));
	const limit = Math.min(100, Number.parseInt(query.limit ?? "20", 10));
	return { page, limit, offset: (page - 1) * limit };
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.get("/health", async (_req, res) => {
	try {
		await db.execute(sql`SELECT 1`);
		res.json(
			successResponse({
				status: "ok",
				phase: 2,
				agents: [
					"mail",
					"task",
					"proposal",
					"bi",
					"approval",
					"audit", // Phase 1
					"crm",
					"desk",
					"books",
					"meeting", // Phase 2 — LIVE
				],
			}),
		);
	} catch {
		res
			.status(503)
			.json(errorResponse("Database unavailable", "DB_UNAVAILABLE", true));
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIL AGENT
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post("/mail/sync", async (req: Request, res: Response) => {
	try {
		const {
			connectionId,
			accountId,
			limit = 50,
		} = req.body as {
			connectionId: string;
			accountId: string;
			limit?: number;
		};
		if (!connectionId || !accountId) {
			return res
				.status(400)
				.json(
					errorResponse(
						"connectionId and accountId are required",
						"VALIDATION_ERROR",
					),
				);
		}
		const adminId = (req as any).user.id;
		const result = await syncAndClassifyEmails(
			connectionId,
			accountId,
			adminId,
			limit,
		);
		res.json(successResponse(result));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message, "MAIL_SYNC_ERROR", true));
	}
});

adminCopilotRouter.get("/mail/inbox", async (req: Request, res: Response) => {
	try {
		const { page, limit, offset } = getPagination(req.query as any);
		const { category, urgency } = req.query as {
			category?: string;
			urgency?: string;
		};

		const conditions = [];
		if (category)
			conditions.push(eq(aiEmailClassifications.category, category));
		if (urgency) conditions.push(eq(aiEmailClassifications.urgency, urgency));

		const [items, [{ count }]] = await Promise.all([
			db
				.select()
				.from(aiEmailClassifications)
				.where(conditions.length ? and(...conditions) : undefined)
				.orderBy(desc(aiEmailClassifications.receivedAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)` })
				.from(aiEmailClassifications)
				.where(conditions.length ? and(...conditions) : undefined),
		]);

		res.json(successResponse(items, { page, limit, total: Number(count) }));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message));
	}
});

adminCopilotRouter.post(
	"/mail/draft-reply",
	async (req: Request, res: Response) => {
		try {
			const { classificationId, extraContext } = req.body as {
				classificationId: string;
				extraContext?: string;
			};
			const adminId = (req as any).user.id;
			const draft = await redraftReply(classificationId, adminId, extraContext);
			res.json(successResponse({ draftReply: draft, approvalStatus: "draft" }));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message, "DRAFT_REPLY_ERROR"));
		}
	},
);

// ─────────────────────────────────────────────────────────────────────────────
// TASK AGENT
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post(
	"/tasks/create",
	async (req: Request, res: Response) => {
		try {
			const adminId = (req as any).user.id;
			const task = await createTaskFromSource({
				...req.body,
				adminUserId: adminId,
			});
			res.status(201).json(successResponse(task));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message, "TASK_CREATE_ERROR"));
		}
	},
);

adminCopilotRouter.get("/tasks", async (req: Request, res: Response) => {
	try {
		const { page, limit, offset } = getPagination(req.query as any);
		const { status, priority, source } = req.query as {
			status?: string;
			priority?: string;
			source?: string;
		};

		const conditions = [];
		if (status) conditions.push(eq(aiAdminTasks.status, status));
		if (priority) conditions.push(eq(aiAdminTasks.priority, priority));
		if (source) conditions.push(eq(aiAdminTasks.source, source));

		const [items, [{ count }]] = await Promise.all([
			db
				.select()
				.from(aiAdminTasks)
				.where(conditions.length ? and(...conditions) : undefined)
				.orderBy(desc(aiAdminTasks.createdAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)` })
				.from(aiAdminTasks)
				.where(conditions.length ? and(...conditions) : undefined),
		]);

		res.json(successResponse(items, { page, limit, total: Number(count) }));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message));
	}
});

adminCopilotRouter.patch("/tasks/:id", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const { status, notes } = req.body as { status: string; notes?: string };
		const adminId = (req as any).user.id;
		await updateTaskStatus(id, status as any, adminId, notes);
		res.json(successResponse({ id, status }));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message));
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// CRM AGENT — Phase 2 LIVE
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post("/crm/sync", async (req: Request, res: Response) => {
	try {
		const { connectionId } = req.body as { connectionId: string };
		if (!connectionId)
			return res
				.status(400)
				.json(errorResponse("connectionId is required", "VALIDATION_ERROR"));
		const adminId = (req as any).user.id;
		const result = await syncCrmLeads(connectionId, adminId);
		res.json(successResponse(result));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message, "CRM_SYNC_ERROR", true));
	}
});

adminCopilotRouter.get("/crm/leads", async (req: Request, res: Response) => {
	try {
		const { page, limit, offset } = getPagination(req.query as any);
		const { approvalStatus, connectionId } = req.query as {
			approvalStatus?: string;
			connectionId?: string;
		};
		const conditions = [];
		if (approvalStatus)
			conditions.push(eq(aiCrmLeadActions.approvalStatus, approvalStatus));
		if (connectionId)
			conditions.push(eq(aiCrmLeadActions.connectionId, connectionId));
		const [items, [{ count }]] = await Promise.all([
			db
				.select()
				.from(aiCrmLeadActions)
				.where(conditions.length ? and(...conditions) : undefined)
				.orderBy(desc(aiCrmLeadActions.syncedAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)` })
				.from(aiCrmLeadActions)
				.where(conditions.length ? and(...conditions) : undefined),
		]);
		res.json(successResponse(items, { page, limit, total: Number(count) }));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message));
	}
});

adminCopilotRouter.get(
	"/crm/leads/:id",
	async (req: Request, res: Response) => {
		try {
			const [lead] = await db
				.select()
				.from(aiCrmLeadActions)
				.where(eq(aiCrmLeadActions.id, req.params.id))
				.limit(1);
			if (!lead)
				return res
					.status(404)
					.json(errorResponse("Lead not found", "NOT_FOUND"));
			res.json(successResponse(lead));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message));
		}
	},
);

adminCopilotRouter.post(
	"/crm/leads/:id/stage",
	async (req: Request, res: Response) => {
		try {
			const { newStage, connectionId } = req.body as {
				newStage: string;
				connectionId: string;
			};
			if (!newStage || !connectionId)
				return res
					.status(400)
					.json(
						errorResponse(
							"newStage and connectionId are required",
							"VALIDATION_ERROR",
						),
					);
			const adminId = (req as any).user.id;
			await updateLeadStage(req.params.id, newStage, connectionId, adminId);
			res.json(
				successResponse({
					id: req.params.id,
					newStage,
					approvalStatus: "approved",
				}),
			);
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message, "CRM_STAGE_ERROR"));
		}
	},
);

// ─────────────────────────────────────────────────────────────────────────────
// DESK AGENT — Phase 2 LIVE
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post("/desk/sync", async (req: Request, res: Response) => {
	try {
		const { connectionId } = req.body as { connectionId: string };
		if (!connectionId)
			return res
				.status(400)
				.json(errorResponse("connectionId is required", "VALIDATION_ERROR"));
		const adminId = (req as any).user.id;
		const result = await syncDeskTickets(connectionId, adminId);
		res.json(successResponse(result));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message, "DESK_SYNC_ERROR", true));
	}
});

adminCopilotRouter.get("/desk/tickets", async (req: Request, res: Response) => {
	try {
		const { page, limit, offset } = getPagination(req.query as any);
		const { category, isHighRisk, slaBreach } = req.query as {
			category?: string;
			isHighRisk?: string;
			slaBreach?: string;
		};
		const conditions = [];
		if (category) conditions.push(eq(aiDeskTicketActions.category, category));
		if (isHighRisk === "true")
			conditions.push(eq(aiDeskTicketActions.isHighRisk, true));
		if (slaBreach === "true")
			conditions.push(eq(aiDeskTicketActions.slaBreach, true));
		const [items, [{ count }]] = await Promise.all([
			db
				.select()
				.from(aiDeskTicketActions)
				.where(conditions.length ? and(...conditions) : undefined)
				.orderBy(desc(aiDeskTicketActions.syncedAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)` })
				.from(aiDeskTicketActions)
				.where(conditions.length ? and(...conditions) : undefined),
		]);
		res.json(successResponse(items, { page, limit, total: Number(count) }));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message));
	}
});

adminCopilotRouter.get(
	"/desk/tickets/:id",
	async (req: Request, res: Response) => {
		try {
			const [ticket] = await db
				.select()
				.from(aiDeskTicketActions)
				.where(eq(aiDeskTicketActions.id, req.params.id))
				.limit(1);
			if (!ticket)
				return res
					.status(404)
					.json(errorResponse("Ticket not found", "NOT_FOUND"));
			res.json(successResponse(ticket));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message));
		}
	},
);

adminCopilotRouter.post(
	"/desk/tickets/:id/draft-response",
	async (req: Request, res: Response) => {
		try {
			const adminId = (req as any).user.id;
			const result = await deskDraftResponse(
				req.params.id,
				adminId,
				req.body?.extraContext,
			);
			res.json(successResponse(result));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message, "DESK_DRAFT_ERROR"));
		}
	},
);

adminCopilotRouter.post(
	"/desk/tickets/:id/escalate",
	async (req: Request, res: Response) => {
		try {
			const { reason, connectionId } = req.body as {
				reason: string;
				connectionId: string;
			};
			if (!connectionId)
				return res
					.status(400)
					.json(errorResponse("connectionId is required", "VALIDATION_ERROR"));
			const adminId = (req as any).user.id;
			await escalateTicket(
				req.params.id,
				reason || "Admin escalation",
				connectionId,
				adminId,
			);
			res.json(successResponse({ id: req.params.id, escalated: true }));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message, "DESK_ESCALATE_ERROR"));
		}
	},
);

adminCopilotRouter.post(
	"/desk/sla-check",
	async (req: Request, res: Response) => {
		try {
			const { connectionId } = req.body as { connectionId: string };
			if (!connectionId)
				return res
					.status(400)
					.json(errorResponse("connectionId is required", "VALIDATION_ERROR"));
			const adminId = (req as any).user.id;
			const flagged = await flagSlaBreachRisk(connectionId, adminId);
			res.json(successResponse({ flagged }));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message, "DESK_SLA_ERROR", true));
		}
	},
);

// ─────────────────────────────────────────────────────────────────────────────
// PROPOSAL AGENT
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post(
	"/proposals/generate",
	async (req: Request, res: Response) => {
		try {
			const adminId = (req as any).user.id;
			const result = await generateProposalDraft(req.body, adminId);
			res.status(201).json(successResponse(result));
		} catch (err: any) {
			res
				.status(500)
				.json(errorResponse(err.message, "PROPOSAL_GENERATE_ERROR"));
		}
	},
);

adminCopilotRouter.get("/proposals", async (req: Request, res: Response) => {
	try {
		const { page, limit, offset } = getPagination(req.query as any);
		const { approvalStatus, productType } = req.query as {
			approvalStatus?: string;
			productType?: string;
		};

		const conditions = [];
		if (approvalStatus)
			conditions.push(eq(aiProposalDrafts.approvalStatus, approvalStatus));
		if (productType)
			conditions.push(eq(aiProposalDrafts.productType, productType));

		const [items, [{ count }]] = await Promise.all([
			db
				.select({
					id: aiProposalDrafts.id,
					investorName: aiProposalDrafts.investorName,
					productType: aiProposalDrafts.productType,
					amount: aiProposalDrafts.amount,
					riskProfile: aiProposalDrafts.riskProfile,
					approvalStatus: aiProposalDrafts.approvalStatus,
					confidenceScore: aiProposalDrafts.confidenceScore,
					createdAt: aiProposalDrafts.createdAt,
				})
				.from(aiProposalDrafts)
				.where(conditions.length ? and(...conditions) : undefined)
				.orderBy(desc(aiProposalDrafts.createdAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)` })
				.from(aiProposalDrafts)
				.where(conditions.length ? and(...conditions) : undefined),
		]);

		res.json(successResponse(items, { page, limit, total: Number(count) }));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message));
	}
});

adminCopilotRouter.get(
	"/proposals/:id",
	async (req: Request, res: Response) => {
		try {
			const [proposal] = await db
				.select()
				.from(aiProposalDrafts)
				.where(eq(aiProposalDrafts.id, req.params.id))
				.limit(1);
			if (!proposal)
				return res
					.status(404)
					.json(errorResponse("Proposal not found", "NOT_FOUND"));
			res.json(successResponse(proposal));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message));
		}
	},
);

// ─────────────────────────────────────────────────────────────────────────────
// BI AGENT
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.get("/bi/summary", async (req: Request, res: Response) => {
	try {
		const adminId = (req as any).user.id;
		const date = req.query.date as string | undefined;
		const summary = await generateBiSummary(adminId, date);
		res.json(successResponse(summary));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message, "BI_SUMMARY_ERROR"));
	}
});

adminCopilotRouter.post("/bi/ask", async (req: Request, res: Response) => {
	try {
		const { question, biSummary } = req.body as {
			question: string;
			biSummary: any;
		};
		if (!question)
			return res
				.status(400)
				.json(errorResponse("question is required", "VALIDATION_ERROR"));
		const adminId = (req as any).user.id;
		const answer = await answerBiQuestion(question, biSummary, adminId);
		res.json(successResponse(answer));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message, "BI_ASK_ERROR"));
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKS FINANCE AGENT — Phase 2 LIVE
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post("/books/sync", async (req: Request, res: Response) => {
	try {
		const { connectionId } = req.body as { connectionId: string };
		if (!connectionId)
			return res
				.status(400)
				.json(errorResponse("connectionId is required", "VALIDATION_ERROR"));
		const adminId = (req as any).user.id;
		const result = await syncBooksData(connectionId, adminId);
		res.json(successResponse(result));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message, "BOOKS_SYNC_ERROR", true));
	}
});
adminCopilotRouter.get(
	"/books/invoices",
	async (req: Request, res: Response) => {
		try {
			const { page, limit, offset } = getPagination(req.query as any);
			const [items, [{ count }]] = await Promise.all([
				db
					.select()
					.from(aiInvoiceDrafts)
					.orderBy(desc(aiInvoiceDrafts.createdAt))
					.limit(limit)
					.offset(offset),
				db.select({ count: sql<number>`count(*)` }).from(aiInvoiceDrafts),
			]);
			res.json(successResponse(items, { page, limit, total: Number(count) }));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message));
		}
	},
);
adminCopilotRouter.get(
	"/books/invoices/overdue",
	async (req: Request, res: Response) => {
		try {
			const items = await db
				.select()
				.from(aiInvoiceDrafts)
				.where(
					and(
						eq(aiInvoiceDrafts.issuedToZohoBooks, false),
						sql`due_date < NOW()`,
					),
				)
				.orderBy(desc(aiInvoiceDrafts.dueDate));
			res.json(successResponse(items));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message));
		}
	},
);
adminCopilotRouter.post(
	"/books/invoices/draft",
	async (req: Request, res: Response) => {
		try {
			const {
				connectionId,
				dealName,
				customerName,
				customerEmail,
				amount,
				description,
				zohoCrmDealId,
			} = req.body as {
				connectionId: string;
				dealName: string;
				customerName: string;
				customerEmail?: string;
				amount: number;
				description: string;
				zohoCrmDealId?: string;
			};
			if (!connectionId || !customerName || !amount || !description) {
				return res
					.status(400)
					.json(
						errorResponse(
							"connectionId, customerName, amount, description required",
							"VALIDATION_ERROR",
						),
					);
			}
			const adminId = (req as any).user.id;
			const result = await draftInvoiceFromCrmDeal(
				{
					dealName: dealName || description,
					customerName,
					customerEmail,
					amount,
					description,
					zohoCrmDealId,
				},
				connectionId,
				adminId,
			);
			res.status(201).json(successResponse(result));
		} catch (err: any) {
			res
				.status(500)
				.json(errorResponse(err.message, "BOOKS_DRAFT_INVOICE_ERROR"));
		}
	},
);

adminCopilotRouter.post(
	"/books/invoices/:id/issue",
	async (req: Request, res: Response) => {
		try {
			const { connectionId } = req.body as { connectionId: string };
			if (!connectionId)
				return res
					.status(400)
					.json(errorResponse("connectionId is required", "VALIDATION_ERROR"));
			const adminId = (req as any).user.id;
			const result = await issueInvoiceToZohoBooks(
				req.params.id,
				connectionId,
				adminId,
			);
			res.json(successResponse(result));
		} catch (err: any) {
			res
				.status(500)
				.json(errorResponse(err.message, "BOOKS_ISSUE_INVOICE_ERROR"));
		}
	},
);
adminCopilotRouter.get(
	"/books/payouts",
	async (req: Request, res: Response) => {
		try {
			const { page, limit, offset } = getPagination(req.query as any);
			const [items, [{ count }]] = await Promise.all([
				db
					.select()
					.from(aiPayoutSuggestions)
					.orderBy(desc(aiPayoutSuggestions.createdAt))
					.limit(limit)
					.offset(offset),
				db.select({ count: sql<number>`count(*)` }).from(aiPayoutSuggestions),
			]);
			res.json(successResponse(items, { page, limit, total: Number(count) }));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message));
		}
	},
);
adminCopilotRouter.get(
	"/books/reconciliation",
	async (req: Request, res: Response) => {
		try {
			const items = await db
				.select()
				.from(aiRevenueReconciliation)
				.orderBy(desc(aiRevenueReconciliation.periodEnd))
				.limit(12);
			res.json(successResponse(items));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message));
		}
	},
);
adminCopilotRouter.get(
	"/books/gst-summary",
	async (req: Request, res: Response) => {
		try {
			const { connectionId, startDate, endDate } = req.query as {
				connectionId?: string;
				startDate?: string;
				endDate?: string;
			};
			if (!connectionId)
				return res
					.status(400)
					.json(errorResponse("connectionId is required", "VALIDATION_ERROR"));
			const adminId = (req as any).user.id;
			const period = {
				start: startDate
					? new Date(startDate)
					: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
				end: endDate ? new Date(endDate) : new Date(),
			};
			const result = await getGstSummary(connectionId, adminId, period);
			res.json(successResponse(result));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message, "BOOKS_GST_ERROR"));
		}
	},
);

adminCopilotRouter.post(
	"/books/payouts/calculate",
	async (req: Request, res: Response) => {
		try {
			const { connectionId, ...params } = req.body as {
				connectionId: string;
				recipientId: string;
				recipientName: string;
				recipientType: "agent" | "partner" | "ca";
				periodStart: string;
				periodEnd: string;
				brokerageAmount: number;
				trailAmount: number;
				incentiveAmount: number;
			};
			if (!connectionId || !params.recipientId) {
				return res
					.status(400)
					.json(
						errorResponse(
							"connectionId and recipientId required",
							"VALIDATION_ERROR",
						),
					);
			}
			const adminId = (req as any).user.id;
			const result = await calculatePayoutSuggestion(
				{
					...params,
					periodStart: new Date(params.periodStart),
					periodEnd: new Date(params.periodEnd),
				},
				connectionId,
				adminId,
			);
			res.status(201).json(successResponse(result));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message, "BOOKS_PAYOUT_ERROR"));
		}
	},
);

adminCopilotRouter.post(
	"/books/reconciliation/run",
	async (req: Request, res: Response) => {
		try {
			const { connectionId, startDate, endDate } = req.body as {
				connectionId: string;
				startDate: string;
				endDate: string;
			};
			if (!connectionId || !startDate || !endDate) {
				return res
					.status(400)
					.json(
						errorResponse(
							"connectionId, startDate, endDate required",
							"VALIDATION_ERROR",
						),
					);
			}
			const adminId = (req as any).user.id;
			const result = await runRevenueReconciliation(connectionId, adminId, {
				start: new Date(startDate),
				end: new Date(endDate),
			});
			res.json(successResponse(result));
		} catch (err: any) {
			res
				.status(500)
				.json(errorResponse(err.message, "BOOKS_RECONCILIATION_ERROR", true));
		}
	},
);

// ─────────────────────────────────────────────────────────────────────────────
// MEETING AGENT — Phase 2 LIVE
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post(
	"/meetings/schedule",
	async (req: Request, res: Response) => {
		try {
			const { connectionId, ...params } = req.body as {
				connectionId: string;
				meetingType: string;
				title: string;
				description?: string;
				scheduledAt: string;
				durationMin?: number;
				timezone?: string;
				hostEmail?: string;
				attendees?: { name: string; email: string; role?: string }[];
				linkedCrmLeadId?: string;
				linkedTicketId?: string;
				linkedProposalId?: string;
			};
			if (
				!connectionId ||
				!params.meetingType ||
				!params.title ||
				!params.scheduledAt
			) {
				return res
					.status(400)
					.json(
						errorResponse(
							"connectionId, meetingType, title, scheduledAt required",
							"VALIDATION_ERROR",
						),
					);
			}
			const adminId = (req as any).user.id;
			const result = await scheduleMeeting(
				{ ...params, scheduledAt: new Date(params.scheduledAt) },
				connectionId,
				adminId,
			);
			res.status(201).json(successResponse(result));
		} catch (err: any) {
			res
				.status(500)
				.json(errorResponse(err.message, "MEETING_SCHEDULE_ERROR"));
		}
	},
);
adminCopilotRouter.get("/meetings", async (req: Request, res: Response) => {
	try {
		const { page, limit, offset } = getPagination(req.query as any);
		const [items, [{ count }]] = await Promise.all([
			db
				.select()
				.from(aiMeetingActions)
				.orderBy(desc(aiMeetingActions.scheduledAt))
				.limit(limit)
				.offset(offset),
			db.select({ count: sql<number>`count(*)` }).from(aiMeetingActions),
		]);
		res.json(successResponse(items, { page, limit, total: Number(count) }));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message));
	}
});
adminCopilotRouter.get("/meetings/:id", async (req: Request, res: Response) => {
	try {
		const [meeting] = await db
			.select()
			.from(aiMeetingActions)
			.where(eq(aiMeetingActions.id, req.params.id))
			.limit(1);
		if (!meeting)
			return res
				.status(404)
				.json(errorResponse("Meeting not found", "NOT_FOUND"));
		res.json(successResponse(meeting));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message));
	}
});
adminCopilotRouter.get(
	"/meetings/:id/agenda",
	async (req: Request, res: Response) => {
		try {
			const [meeting] = await db
				.select()
				.from(aiMeetingActions)
				.where(eq(aiMeetingActions.id, req.params.id))
				.limit(1);
			if (!meeting)
				return res
					.status(404)
					.json(errorResponse("Meeting not found", "NOT_FOUND"));
			res.json(
				successResponse({ agenda: meeting.description, meetingId: meeting.id }),
			);
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message));
		}
	},
);

adminCopilotRouter.post(
	"/meetings/:id/invite",
	async (req: Request, res: Response) => {
		try {
			const { connectionId } = req.body as { connectionId: string };
			if (!connectionId)
				return res
					.status(400)
					.json(errorResponse("connectionId is required", "VALIDATION_ERROR"));
			const adminId = (req as any).user.id;
			const result = await sendMeetingInvite(
				req.params.id,
				connectionId,
				adminId,
			);
			res.json(successResponse(result));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message, "MEETING_INVITE_ERROR"));
		}
	},
);

adminCopilotRouter.post(
	"/meetings/:id/summary",
	async (req: Request, res: Response) => {
		try {
			const {
				transcript,
				attendeesPresent,
				attendeesAbsent,
				actualDurationMin,
			} = req.body as {
				transcript: string;
				attendeesPresent?: { name: string; email?: string }[];
				attendeesAbsent?: { name: string; email?: string }[];
				actualDurationMin?: number;
			};
			if (!transcript)
				return res
					.status(400)
					.json(errorResponse("transcript is required", "VALIDATION_ERROR"));
			const adminId = (req as any).user.id;
			const result = await generatePostMeetingSummary(
				req.params.id,
				transcript,
				{
					present: attendeesPresent,
					absent: attendeesAbsent,
					actualDurationMin,
				},
				adminId,
			);
			res.json(successResponse(result));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message, "MEETING_SUMMARY_ERROR"));
		}
	},
);
adminCopilotRouter.post(
	"/meetings/:id/followups/extract",
	async (req: Request, res: Response) => {
		try {
			const adminId = (req as any).user.id;
			const result = await extractFollowupTasks(req.params.id, adminId);
			res.json(successResponse(result));
		} catch (err: any) {
			res
				.status(500)
				.json(errorResponse(err.message, "MEETING_FOLLOWUP_ERROR"));
		}
	},
);

adminCopilotRouter.post(
	"/meetings/track-no-shows",
	async (req: Request, res: Response) => {
		try {
			const { connectionId } = req.body as { connectionId: string };
			if (!connectionId)
				return res
					.status(400)
					.json(errorResponse("connectionId is required", "VALIDATION_ERROR"));
			const adminId = (req as any).user.id;
			const count = await trackNoShows(connectionId, adminId);
			res.json(successResponse({ noShowsFollowedUp: count }));
		} catch (err: any) {
			res
				.status(500)
				.json(errorResponse(err.message, "MEETING_NO_SHOW_ERROR", true));
		}
	},
);

adminCopilotRouter.get(
	"/meetings/:id/followups",
	async (req: Request, res: Response) => {
		try {
			const items = await db
				.select()
				.from(aiMeetingFollowups)
				.where(eq(aiMeetingFollowups.meetingActionId, req.params.id))
				.orderBy(desc(aiMeetingFollowups.createdAt));
			res.json(successResponse(items));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message));
		}
	},
);
adminCopilotRouter.get(
	"/meetings/no-shows",
	async (req: Request, res: Response) => {
		try {
			const items = await db
				.select()
				.from(aiMeetingActions)
				.where(eq(aiMeetingActions.meetingStatus, "no_show"))
				.orderBy(desc(aiMeetingActions.scheduledAt));
			res.json(successResponse(items));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message));
		}
	},
);

// ─────────────────────────────────────────────────────────────────────────────
// COMPLIANCE ALERTS
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.get(
	"/compliance/alerts",
	async (req: Request, res: Response) => {
		try {
			const { page, limit, offset } = getPagination(req.query as any);
			const { severity, status } = req.query as {
				severity?: string;
				status?: string;
			};

			const conditions = [];
			if (severity) conditions.push(eq(aiComplianceAlerts.severity, severity));
			if (status) conditions.push(eq(aiComplianceAlerts.status, status));
			else conditions.push(eq(aiComplianceAlerts.status, "open"));

			const [items, [{ count }]] = await Promise.all([
				db
					.select()
					.from(aiComplianceAlerts)
					.where(and(...conditions))
					.orderBy(desc(aiComplianceAlerts.createdAt))
					.limit(limit)
					.offset(offset),
				db
					.select({ count: sql<number>`count(*)` })
					.from(aiComplianceAlerts)
					.where(and(...conditions)),
			]);

			res.json(successResponse(items, { page, limit, total: Number(count) }));
		} catch (err: any) {
			res.status(500).json(errorResponse(err.message));
		}
	},
);

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL APPROVAL
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post("/approve", async (req: Request, res: Response) => {
	try {
		const user = (req as any).user;
		const result = await processApproval({
			...req.body,
			adminId: user.id,
			adminRole: user.role,
		});
		res.json(successResponse(result));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message, "APPROVAL_ERROR"));
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.get("/audit-logs", async (req: Request, res: Response) => {
	try {
		const { page, limit, offset } = getPagination(req.query as any);
		const { agentType, agentAction, status, userId } = req.query as {
			agentType?: string;
			agentAction?: string;
			status?: string;
			userId?: string;
		};

		const conditions = [];
		if (agentType) conditions.push(eq(aiAuditLogs.agentType, agentType));
		if (agentAction) conditions.push(eq(aiAuditLogs.agentAction, agentAction));
		if (status) conditions.push(eq(aiAuditLogs.status, status));
		if (userId) conditions.push(eq(aiAuditLogs.userId, userId));

		const [items, [{ count }]] = await Promise.all([
			db
				.select()
				.from(aiAuditLogs)
				.where(conditions.length ? and(...conditions) : undefined)
				.orderBy(desc(aiAuditLogs.timestamp))
				.limit(limit)
				.offset(offset),
			db
				.select({ count: sql<number>`count(*)` })
				.from(aiAuditLogs)
				.where(conditions.length ? and(...conditions) : undefined),
		]);

		res.json(successResponse(items, { page, limit, total: Number(count) }));
	} catch (err: any) {
		res.status(500).json(errorResponse(err.message));
	}
});
