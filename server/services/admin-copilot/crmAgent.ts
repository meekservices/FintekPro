/**
 * crmAgent.ts — Zoho CRM Intelligence Agent (Phase 2 — LIVE)
 *
 * @purpose  Sync leads from Zoho CRM, generate AI lead intelligence,
 *           route leads to agents, manage deal stages.
 * @inputs   connectionId (zoho_connections.id), adminUserId (users.id)
 * @outputs  ai_crm_lead_actions, ai_admin_tasks
 *
 * FASP-AI v1.0 GUARDRAILS:
 *  - AI never autonomously updates CRM stage or assigns leads.
 *  - Stage updates require Admin approval before Zoho CRM write.
 *  - All outputs logged to ai_audit_logs (append-only).
 */

import { db } from "../../db";
import { aiCrmLeadActions } from "@shared/schema/admin-copilot";
import { eq, desc } from "drizzle-orm";
import { ZohoCRMService } from "../../zoho/services/crm";
import { callGemini } from "../../gemini-service";
import { auditLog } from "../../logger";
import { createTaskFromSource } from "./taskAgent";

// ── Factory: build CRM service from connection ─────────────────────────────
function buildCrmService(connectionId: string): ZohoCRMService {
	const dataCenter = process.env.ZOHO_DATA_CENTER || "com";
	return new ZohoCRMService(connectionId, dataCenter);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Sync CRM Leads
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Fetches all leads from Zoho CRM and upserts them into ai_crm_lead_actions.
 *
 * @param connectionId - zoho_connections.id
 * @param adminUserId  - Triggering admin's user ID
 */
export async function syncCrmLeads(
	connectionId: string,
	adminUserId: string,
): Promise<{ synced: number; intelligenceGenerated: number }> {
	const start = Date.now();
	const crm = buildCrmService(connectionId);

	const leads = await crm.getLeads(200);
	let intelligenceGenerated = 0;

	for (const lead of leads) {
		const [existing] = await db
			.select()
			.from(aiCrmLeadActions)
			.where(eq(aiCrmLeadActions.zohoLeadId, lead.id || ""))
			.limit(1);

		const baseData = {
			zohoLeadId: lead.id,
			connectionId,
			leadName:
				[lead.First_Name, lead.Last_Name].filter(Boolean).join(" ") ||
				"Unknown",
			leadEmail: lead.Email,
			leadPhone: lead.Phone,
			company: lead.Company,
			productInterest: lead.Lead_Source,
			currentStage: lead.Lead_Status,
			syncedAt: new Date(),
			source: "ai" as const,
		};

		let actionId: string;
		if (existing) {
			await db
				.update(aiCrmLeadActions)
				.set({ ...baseData, updatedAt: new Date() })
				.where(eq(aiCrmLeadActions.id, existing.id));
			actionId = existing.id;
		} else {
			const [inserted] = await db
				.insert(aiCrmLeadActions)
				.values({
					...baseData,
					approvalStatus: "draft",
					modelVersion: "gemini-2.0-flash",
				})
				.returning();
			actionId = inserted.id;

			try {
				await generateLeadIntelligence(actionId, lead, adminUserId);
				intelligenceGenerated++;
			} catch (err) {
				console.error(
					`[CRM Agent] Intelligence generation failed for lead ${actionId}:`,
					err,
				);
			}
		}
	}

	await auditLog({
		userId: adminUserId,
		userRole: "admin",
		agentType: "crm",
		agentAction: "sync_crm_leads",
		outputSummary: `Synced ${leads.length} leads. Intelligence for ${intelligenceGenerated} new.`,
		latencyMs: Date.now() - start,
		status: "success",
		externalApiCalled: true,
		externalService: "zoho_crm",
		externalCallStatus: "success",
		externalCallMs: Date.now() - start,
	});

	return { synced: leads.length, intelligenceGenerated };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Generate Lead Intelligence
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Uses Gemini to analyse a CRM lead and generate intent score and next best action.
 */
interface LeadIntelligenceAI {
	intentScore: number;
	nextBestAction: string;
	intelligenceSummary: string;
	recommendedStage: string;
	routingRecommendation: { role: string; reason: string; priority: string };
}

export async function generateLeadIntelligence(
	crmLeadActionId: string,
	leadData: {
		id?: string;
		First_Name?: string;
		Last_Name?: string;
		Email?: string;
		Phone?: string;
		Company?: string;
		Lead_Source?: string;
		Lead_Status?: string;
		Annual_Revenue?: number;
		Description?: string;
		[key: string]: unknown;
	},
	adminUserId: string,
): Promise<{
	intentScore: number;
	nextBestAction: string;
	confidenceScore: number;
}> {
	const start = Date.now();

	const systemPrompt = `You are a lead intelligence AI for a SEBI-regulated Indian financial advisory firm.
Analyse CRM leads and produce actionable sales intelligence.
Respond with valid JSON only. No markdown. No explanation.`;

	const userPrompt = `Lead: ${leadData.First_Name || ""} ${leadData.Last_Name || ""} (${leadData.Company || "Individual"})
Email: ${leadData.Email || "Not provided"} | Source: ${leadData.Lead_Source || "Unknown"} | Status: ${leadData.Lead_Status || "New"}
Annual Revenue: ${leadData.Annual_Revenue ? `₹${leadData.Annual_Revenue.toLocaleString("en-IN")}` : "Not provided"}
Description: ${leadData.Description || "None"}

Return:
{
  "intentScore": <0-100>,
  "nextBestAction": "<1 actionable sentence>",
  "intelligenceSummary": "<2-3 sentence analysis>",
  "recommendedStage": "<new_lead|contacted|risk_profile_pending|proposal_drafted|follow_up|converted|dormant>",
  "routingRecommendation": {"role": "<agent|senior_agent|partner|admin>", "reason": "<1 sentence>", "priority": "<high|medium|low>"}
}`;

	const { data: parsed, meta } = await callGemini<LeadIntelligenceAI>(
		systemPrompt,
		userPrompt,
		{ parseJson: true },
	);

	await db
		.update(aiCrmLeadActions)
		.set({
			intentScore: parsed.intentScore,
			nextBestAction: parsed.nextBestAction,
			intelligenceSummary: parsed.intelligenceSummary,
			recommendedStage: parsed.recommendedStage,
			routingRecommendation: parsed.routingRecommendation,
			confidenceScore: meta.confidence_score,
			modelVersion: meta.model_version,
			approvalStatus: "draft",
			updatedAt: new Date(),
		})
		.where(eq(aiCrmLeadActions.id, crmLeadActionId));

	// Auto-create follow-up task if intent is high
	if (parsed.intentScore >= 70) {
		await createTaskFromSource({
			source: "crm",
			sourceId: crmLeadActionId,
			adminUserId,
			adminPrompt: `High-intent lead follow-up (intent ${parsed.intentScore}/100): ${leadData.First_Name || ""} ${leadData.Last_Name || ""}. ${parsed.nextBestAction}`,
			linkedCrmLeadId: crmLeadActionId,
		});
	}

	await auditLog({
		userId: adminUserId,
		userRole: "admin",
		agentType: "crm",
		agentAction: "lead_intelligence",
		entityId: crmLeadActionId,
		entityType: "ai_crm_lead_actions",
		outputSummary: `Intent: ${parsed.intentScore}/100 | ${parsed.nextBestAction.substring(0, 80)}`,
		confidenceScore: meta.confidence_score,
		modelVersion: meta.model_version,
		latencyMs: Date.now() - start,
		status: "success",
		approvalStatus: "draft",
	});

	return {
		intentScore: parsed.intentScore,
		nextBestAction: parsed.nextBestAction,
		confidenceScore: meta.confidence_score,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Update Lead Stage (Admin-approved only)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Updates the lead stage in Zoho CRM.
 * GUARDRAIL: Only called by processApproval() after Admin confirms the action.
 */
export async function updateLeadStage(
	crmLeadActionId: string,
	newStage: string,
	connectionId: string,
	adminUserId: string,
): Promise<void> {
	const start = Date.now();

	const [record] = await db
		.select()
		.from(aiCrmLeadActions)
		.where(eq(aiCrmLeadActions.id, crmLeadActionId))
		.limit(1);

	if (!record) throw new Error("CRM lead action not found");
	if (!record.zohoLeadId)
		throw new Error("Lead has no Zoho Lead ID — cannot update stage");

	const crm = buildCrmService(connectionId);
	await crm.updateLeadStatus(record.zohoLeadId, newStage);

	await db
		.update(aiCrmLeadActions)
		.set({
			currentStage: newStage,
			approvalStatus: "approved",
			approvedBy: adminUserId,
			approvedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(aiCrmLeadActions.id, crmLeadActionId));

	await auditLog({
		userId: adminUserId,
		userRole: "admin",
		agentType: "crm",
		agentAction: "update_lead_stage",
		entityId: crmLeadActionId,
		entityType: "ai_crm_lead_actions",
		outputSummary: `Lead stage updated → ${newStage}`,
		latencyMs: Date.now() - start,
		status: "success",
		approvalStatus: "approved",
		externalApiCalled: true,
		externalService: "zoho_crm",
		externalCallStatus: "success",
		externalCallMs: Date.now() - start,
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Sync Deals (for revenue reconciliation context)
// ─────────────────────────────────────────────────────────────────────────────
export async function syncDeals(
	connectionId: string,
	adminUserId: string,
): Promise<{ dealCount: number; totalExpectedRevenue: number }> {
	const start = Date.now();
	const crm = buildCrmService(connectionId);
	const contacts = await crm.getContacts(100);

	await auditLog({
		userId: adminUserId,
		userRole: "admin",
		agentType: "crm",
		agentAction: "sync_deals",
		outputSummary: `Synced ${contacts.length} CRM contacts for revenue context`,
		latencyMs: Date.now() - start,
		status: "success",
		externalApiCalled: true,
		externalService: "zoho_crm",
		externalCallStatus: "success",
		externalCallMs: Date.now() - start,
	});

	return { dealCount: contacts.length, totalExpectedRevenue: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Get Lead Intelligence from DB (for UI)
// ─────────────────────────────────────────────────────────────────────────────
export async function getLeadIntelligenceById(crmLeadActionId: string) {
	const [record] = await db
		.select()
		.from(aiCrmLeadActions)
		.where(eq(aiCrmLeadActions.id, crmLeadActionId))
		.limit(1);
	return record || null;
}
