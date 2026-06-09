// @ts-nocheck
/**
 * mailAgent.ts — Zoho Mail Intelligence Agent
 * Fetches emails via Zoho Mail API, classifies with Gemini, and drafts replies.
 * GUARDRAIL: Never sends emails. All drafts require Admin approval.
 *
 * Purpose : Read → Classify → Extract → Draft (DRAFT status only)
 * Inputs  : connectionId (zoho_connections.id), adminUserId
 * Outputs : AiEmailClassification[] stored to DB + audit logged
 * Edge    : Zoho API failure → partial result with warning; DB failure → throws
 */

import axios from "axios";
import { db } from "../../db";
import { aiEmailClassifications } from "@shared/schema/admin-copilot";
import { ZohoOAuthService } from "../../zoho/oauth";
import { callGemini } from "../../gemini-service";
import { auditLog, logCopilotEvent } from "../../logger";
import { randomUUID } from "crypto";

const zohoOAuth = new ZohoOAuthService();

// ── Email Categories ───────────────────────────────────────────────────────
type EmailCategory =
	| "investor_enquiry"
	| "kyc_issue"
	| "complaint"
	| "partner_enquiry"
	| "loan_enquiry"
	| "mf_enquiry"
	| "pms_aif_enquiry"
	| "reit_invit"
	| "compliance"
	| "support"
	| "other";

type Urgency = "critical" | "high" | "medium" | "low";

interface ZohoMailMessage {
	messageId: string;
	subject: string;
	fromAddress: string;
	fromName?: string;
	receivedTime: number;
	folderId: string;
	summary?: string;
	content?: string;
}

interface EmailClassificationResult {
	category: EmailCategory;
	urgency: Urgency;
	intent: string;
	clientName: string | null;
	productInterest: string | null;
	actionRequired: string;
	draftReply: string;
	confidence: number;
}

// ── Fetch emails from Zoho Mail API ──────────────────────────────────────────
async function fetchZohoEmails(
	accessToken: string,
	accountId: string,
	limit = 50,
): Promise<ZohoMailMessage[]> {
	const url = `https://mail.zoho.in/api/accounts/${accountId}/messages/view`;
	const resp = await axios.get(url, {
		headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
		params: { limit, searchKey: "unread", sortorder: "false" },
		timeout: 15_000,
	});
	return (resp.data?.data ?? []) as ZohoMailMessage[];
}

async function fetchEmailContent(
	accessToken: string,
	accountId: string,
	messageId: string,
): Promise<string> {
	try {
		const url = `https://mail.zoho.in/api/accounts/${accountId}/messages/${messageId}/content`;
		const resp = await axios.get(url, {
			headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
			timeout: 10_000,
		});
		return resp.data?.data?.content ?? "";
	} catch {
		return "";
	}
}

// ── AI classification prompt ──────────────────────────────────────────────────
const CLASSIFY_SYSTEM = `
You are an expert email classifier for FintekPro, a SEBI-regulated investment advisory platform.

Classify each email and return a strict JSON object with these exact fields:
{
  "category": one of [investor_enquiry|kyc_issue|complaint|partner_enquiry|loan_enquiry|mf_enquiry|pms_aif_enquiry|reit_invit|compliance|support|other],
  "urgency": one of [critical|high|medium|low],
  "intent": "One sentence — what does the sender want?",
  "clientName": "Extracted client name or null",
  "productInterest": "Extracted product interest or null",
  "actionRequired": "What the admin must do next — be specific",
  "draftReply": "Professional, compliant draft reply (150–300 words). MUST end with: 'This is an AI-generated draft. Please review before sending.' NEVER promise returns or give specific investment advice.",
  "confidence": 0.0–1.0
}

SEBI compliance: Never promise returns. Never give personalized advice without risk profiling. Flag complaints immediately as high or critical urgency.
`.trim();

// ── Main function: sync + classify ────────────────────────────────────────────
export async function syncAndClassifyEmails(
	connectionId: string,
	accountId: string,
	adminUserId: string,
	limit = 50,
): Promise<{
	classified: number;
	errors: number;
	results: Array<{ id: string }>;
}> {
	const startMs = Date.now();
	let classified = 0;
	let errors = 0;
	const results: Array<{ id: string }> = [];

	const accessToken = await zohoOAuth.getValidAccessToken(connectionId);

	let messages: ZohoMailMessage[] = [];
	try {
		messages = await fetchZohoEmails(accessToken, accountId, limit);
	} catch (err: any) {
		await auditLog({
			userId: adminUserId,
			agentType: "mail",
			agentAction: "fetch_emails",
			status: "failure",
			errorMessage: err.message,
			retryable: true,
			externalApiCalled: true,
			externalService: "zoho_mail",
		});
		throw err;
	}

	for (const msg of messages) {
		try {
			const content = await fetchEmailContent(
				accessToken,
				accountId,
				msg.messageId,
			);

			const userPrompt = `
Subject: ${msg.subject}
From: ${msg.fromName ?? ""} <${msg.fromAddress}>
Body preview: ${(content || msg.summary || "").slice(0, 1500)}
`.trim();

			const { data, meta } = await callGemini<EmailClassificationResult>(
				CLASSIFY_SYSTEM,
				userPrompt,
			);

			const auditId = randomUUID();

			const [record] = await db
				.insert(aiEmailClassifications)
				.values({
					zohoMailId: msg.messageId,
					zohoFolderId: msg.folderId,
					connectionId,
					senderEmail: msg.fromAddress,
					senderName: msg.fromName,
					subject: msg.subject,
					receivedAt: msg.receivedTime
						? new Date(msg.receivedTime)
						: new Date(),
					category: data.category ?? "other",
					urgency: data.urgency ?? "medium",
					intent: data.intent,
					clientName: data.clientName,
					productInterest: data.productInterest,
					actionRequired: data.actionRequired,
					draftReply: data.draftReply,
					draftReplyStatus: "draft",
					confidenceScore: meta.confidence_score,
					modelVersion: meta.model_version,
					auditId,
					approvalStatus: "draft",
					source: "ai",
				})
				.returning({ id: aiEmailClassifications.id });

			// High-risk: create compliance alert for complaints
			if (
				data.category === "complaint" &&
				(data.urgency === "critical" || data.urgency === "high")
			) {
				await auditLog({
					userId: adminUserId,
					agentType: "mail",
					agentAction: "complaint_flagged",
					entityId: record.id,
					entityType: "ai_email_classifications",
					outputSummary: `Complaint flagged: ${data.intent}`,
					confidenceScore: meta.confidence_score,
					approvalStatus: "draft",
					externalApiCalled: true,
					externalService: "zoho_mail",
					externalCallStatus: "success",
				});
			}

			await auditLog({
				userId: adminUserId,
				agentType: "mail",
				agentAction: "email_classified",
				entityId: record.id,
				entityType: "ai_email_classifications",
				inputContext: { subject: msg.subject, from: msg.fromAddress },
				outputSummary: `${data.category} | ${data.urgency} | ${data.intent}`,
				confidenceScore: meta.confidence_score,
				approvalStatus: "draft",
				approvingAdmin: undefined,
				externalApiCalled: true,
				externalService: "zoho_mail",
				externalCallStatus: "success",
				latencyMs: Date.now() - startMs,
			});

			results.push({ id: record.id });
			classified++;
		} catch (err: any) {
			errors++;
			console.error(
				"[MailAgent] Failed to classify email",
				msg.messageId,
				err.message,
			);
		}
	}

	logCopilotEvent(
		"MAIL_AGENT_SYNC",
		adminUserId,
		Date.now() - startMs,
		"success",
		{
			classified,
			errors,
			total: messages.length,
		},
	);

	return { classified, errors, results };
}

/**
 * Draft a reply for a specific email classification record.
 * Returns updated draft — Admin must approve before sending.
 */
export async function redraftReply(
	classificationId: string,
	adminUserId: string,
	extraContext?: string,
): Promise<string> {
	const [record] = await db
		.select()
		.from(aiEmailClassifications)
		.where((t: any) => t.id.eq(classificationId))
		.limit(1);

	if (!record) throw new Error("Classification record not found");

	const userPrompt = `
Original email:
Subject: ${record.subject}
From: ${record.senderEmail}
Category: ${record.category}
Intent: ${record.intent}
Action required: ${record.actionRequired}
${extraContext ? `\nAdmin context: ${extraContext}` : ""}

Please generate a professional, SEBI-compliant draft reply.
`.trim();

	const { data } = await callGemini<{ draftReply: string }>(
		CLASSIFY_SYSTEM,
		userPrompt,
	);

	await db
		.update(aiEmailClassifications)
		.set({
			draftReply: data.draftReply,
			draftReplyStatus: "draft",
			updatedAt: new Date(),
		})
		.where((t: any) => t.id.eq(classificationId));

	await auditLog({
		userId: adminUserId,
		agentType: "mail",
		agentAction: "draft_reply_regenerated",
		entityId: classificationId,
		entityType: "ai_email_classifications",
		approvalStatus: "draft",
	});

	return data.draftReply ?? "";
}
