/**
 * taskAgent.ts — Admin Copilot Task Agent
 * Converts emails, CRM events, Desk tickets, and admin prompts into structured tasks.
 *
 * Purpose : Source → AI extract → ai_admin_tasks (DRAFT)
 * Inputs  : source type + source record ID + adminUserId
 * Outputs : AiAdminTask created in DB + audit logged
 * Edge    : Missing source record → throws; partial AI output → fills with defaults
 */

import { db } from "../../db";
import {
	aiAdminTasks,
	aiEmailClassifications,
	aiDeskTicketActions,
	aiCrmLeadActions,
} from "@shared/schema/admin-copilot";
import { eq } from "drizzle-orm";
import { callGemini } from "../../gemini-service";
import { auditLog, logCopilotEvent } from "../../logger";
import { randomUUID } from "crypto";

type TaskSource =
	| "email"
	| "crm"
	| "desk"
	| "meeting"
	| "books"
	| "admin_prompt"
	| "manual";
type TaskPriority = "critical" | "high" | "medium" | "low";
type TaskStatus =
	| "draft"
	| "approved"
	| "assigned"
	| "in_progress"
	| "completed"
	| "escalated"
	| "closed";

interface TaskExtraction {
	title: string;
	description: string;
	priority: TaskPriority;
	assignedToRole: string; // admin | agent | ca | compliance
	dueDateDays: number; // days from now
	notes: string;
}

const TASK_SYSTEM = `
You are a task extraction engine for FintekPro admin operations.
Given a source context (email, CRM, ticket, or admin prompt), extract a structured task.

Return strict JSON:
{
  "title": "Short, actionable task title (max 80 chars)",
  "description": "Detailed description of what needs to be done",
  "priority": "critical|high|medium|low",
  "assignedToRole": "admin|agent|ca|compliance",
  "dueDateDays": number (days from today — 1 for critical, 3 for high, 7 for medium, 14 for low),
  "notes": "Any additional context or instructions"
}

Be specific. Priority 'critical' = regulatory/complaint matters. 'high' = investor-facing. 'medium' = operational. 'low' = informational.
`.trim();

async function buildContextFromSource(
	source: TaskSource,
	sourceId: string,
): Promise<string> {
	if (source === "email") {
		const [rec] = await db
			.select()
			.from(aiEmailClassifications)
			.where(eq(aiEmailClassifications.id, sourceId))
			.limit(1);
		if (!rec) throw new Error(`Email classification ${sourceId} not found`);
		return `Email from ${rec.senderName ?? rec.senderEmail}
Subject: ${rec.subject}
Category: ${rec.category} | Urgency: ${rec.urgency}
Intent: ${rec.intent}
Action required: ${rec.actionRequired}`;
	}
	if (source === "desk") {
		const [rec] = await db
			.select()
			.from(aiDeskTicketActions)
			.where(eq(aiDeskTicketActions.id, sourceId))
			.limit(1);
		if (!rec) throw new Error(`Desk ticket action ${sourceId} not found`);
		return `Zoho Desk Ticket
Subject: ${rec.subject}
Contact: ${rec.contactName ?? rec.contactEmail}
Category: ${rec.category} | SLA Breach Risk: ${rec.slaBreachRiskPct}%
Escalation: ${rec.escalationReason ?? "none"}`;
	}
	if (source === "crm") {
		const [rec] = await db
			.select()
			.from(aiCrmLeadActions)
			.where(eq(aiCrmLeadActions.id, sourceId))
			.limit(1);
		if (!rec) throw new Error(`CRM lead action ${sourceId} not found`);
		return `CRM Lead: ${rec.leadName}
Stage: ${rec.currentStage} → Recommended: ${rec.recommendedStage}
Product: ${rec.productInterest}
Next Best Action: ${rec.nextBestAction}`;
	}
	return `Admin prompt context (ID: ${sourceId})`;
}

export async function createTaskFromSource(params: {
	source: TaskSource;
	sourceId?: string;
	adminUserId: string;
	adminPrompt?: string;
	linkedEmailId?: string;
	linkedCrmLeadId?: string;
	linkedTicketId?: string;
	linkedProposalId?: string;
	linkedMeetingId?: string;
}): Promise<{ id: string; title: string }> {
	const startMs = Date.now();
	const {
		source,
		sourceId,
		adminUserId,
		adminPrompt,
		linkedEmailId,
		linkedCrmLeadId,
		linkedTicketId,
		linkedProposalId,
		linkedMeetingId,
	} = params;

	let context = adminPrompt ?? "";
	if (sourceId && source !== "admin_prompt") {
		context = await buildContextFromSource(source, sourceId);
	}

	const { data, meta } = await callGemini<TaskExtraction>(
		TASK_SYSTEM,
		`Source type: ${source}\n\nContext:\n${context}`,
	);

	const dueDate = new Date();
	dueDate.setDate(dueDate.getDate() + (data.dueDateDays ?? 7));

	const auditId = randomUUID();

	const [task] = await db
		.insert(aiAdminTasks)
		.values({
			title: data.title,
			description: data.description,
			source,
			priority: data.priority ?? "medium",
			status: "draft",
			assignedToRole: data.assignedToRole,
			dueDate,
			linkedEmailId:
				linkedEmailId ?? (source === "email" ? sourceId : undefined),
			linkedCrmLeadId:
				linkedCrmLeadId ?? (source === "crm" ? sourceId : undefined),
			linkedTicketId:
				linkedTicketId ?? (source === "desk" ? sourceId : undefined),
			linkedProposalId,
			linkedMeetingId,
			confidenceScore: meta.confidence_score,
			modelVersion: meta.model_version,
			auditId,
			createdByAi: true,
			approvalStatus: "draft",
			source_meta: { originalSource: source, sourceId, adminPrompt },
			createdBy: adminUserId,
			source_label: "ai",
			notes: data.notes,
		})
		.returning({ id: aiAdminTasks.id, title: aiAdminTasks.title });

	await auditLog({
		userId: adminUserId,
		agentType: "task",
		agentAction: "task_created",
		entityId: task.id,
		entityType: "ai_admin_tasks",
		inputContext: { source, sourceId },
		outputSummary: task.title,
		confidenceScore: meta.confidence_score,
		approvalStatus: "draft",
		latencyMs: Date.now() - startMs,
		status: "success",
	});

	logCopilotEvent(
		"TASK_AGENT_CREATE",
		adminUserId,
		Date.now() - startMs,
		"success",
		{
			taskId: task.id,
			source,
			priority: data.priority,
		},
	);

	return { id: task.id, title: task.title };
}

export async function updateTaskStatus(
	taskId: string,
	status: TaskStatus,
	adminUserId: string,
	notes?: string,
): Promise<void> {
	const updates: Partial<typeof aiAdminTasks.$inferInsert> = {
		status,
		updatedAt: new Date(),
		...(notes ? { notes } : {}),
		...(status === "completed"
			? { completedAt: new Date(), completedBy: adminUserId }
			: {}),
		...(status === "approved"
			? {
					approvalStatus: "approved",
					approvedBy: adminUserId,
					approvedAt: new Date(),
				}
			: {}),
	};

	await db.update(aiAdminTasks).set(updates).where(eq(aiAdminTasks.id, taskId));

	await auditLog({
		userId: adminUserId,
		agentType: "task",
		agentAction: `task_status_${status}`,
		entityId: taskId,
		entityType: "ai_admin_tasks",
		approvalStatus: status,
		approvingAdmin: adminUserId,
		source: "admin",
	});
}
