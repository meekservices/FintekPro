/**
 * booksAgent.ts — Zoho Books Finance Agent (Phase 2 — LIVE)
 *
 * @purpose  Sync Zoho Books data, draft invoices, calculate payouts, reconcile revenue.
 * @inputs   connectionId (zoho_connections.id), adminUserId (users.id)
 * @outputs  ai_books_finance_actions, ai_invoice_drafts, ai_payout_suggestions,
 *           ai_revenue_reconciliation, ai_compliance_alerts
 *
 * FASP-AI v1.0 GUARDRAILS:
 *  - AI NEVER issues invoices, marks payments received, or releases payouts.
 *  - Every output is DRAFT (approvalStatus = 'draft').
 *  - External writes to Zoho Books only after 2-step Admin confirmation.
 *  - All outputs logged to ai_audit_logs (append-only).
 *
 * Env: ZOHO_BOOKS_ORG_ID | ZOHO_BOOKS_ORGANIZATION_ID | ZOHO_ZSOID
 */

import { db } from "../../db";
import {
	aiBooksFinanceActions,
	aiInvoiceDrafts,
	aiPayoutSuggestions,
	aiRevenueReconciliation,
	aiComplianceAlerts,
} from "@shared/schema/admin-copilot";
import { eq } from "drizzle-orm";
import { ZohoBooksService } from "../../zoho/services/books";
import { callGemini } from "../../gemini-service";
import { auditLog } from "../../logger";

// ── Resolve org ID from any of the 3 known env var names ──────────────────────
function getBooksOrgId(): string {
	const id =
		process.env.ZOHO_BOOKS_ORG_ID ||
		process.env.ZOHO_BOOKS_ORGANIZATION_ID ||
		process.env.ZOHO_ZSOID;
	if (!id)
		throw new Error(
			"ZOHO_BOOKS_ORG_ID is not set. Please add it to GCP Secrets.",
		);
	return id;
}

// ── Factory: build BooksService from DB connection ────────────────────────────
function buildBooksService(connectionId: string): ZohoBooksService {
	const orgId = getBooksOrgId();
	const dataCenter = process.env.ZOHO_DATA_CENTER || "in";
	return new ZohoBooksService(connectionId, orgId, dataCenter);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Sync Books Data (invoices + payments + expenses snapshot)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Fetches invoices, payments, and expenses from Zoho Books and stores
 * a consolidated action record in ai_books_finance_actions.
 *
 * @param connectionId - zoho_connections.id
 * @param adminUserId  - Triggering admin's user ID
 */
export async function syncBooksData(
	connectionId: string,
	adminUserId: string,
): Promise<{ actionId: string; invoiceCount: number; paymentCount: number }> {
	const start = Date.now();
	const books = buildBooksService(connectionId);
	const orgId = getBooksOrgId();

	const [invoices, payments, overdue] = await Promise.all([
		books.getInvoices({
			per_page: 200,
			sort_column: "created_time",
			sort_order: "descending",
		}),
		books.getPaymentsReceived({ per_page: 200 }),
		books.getInvoices({ status: "overdue", per_page: 200 }),
	]);

	const totalReceivable = invoices.items
		.filter((i) => i.status !== "paid")
		.reduce((s, i) => s + (i.balance || 0), 0);

	const summary = {
		invoiceCount: invoices.totalRecords,
		paymentCount: payments.totalRecords,
		overdueCount: overdue.totalRecords,
		totalReceivable,
		overdueAmount: overdue.items.reduce((s, i) => s + (i.balance || 0), 0),
		syncedAt: new Date().toISOString(),
	};

	const [action] = await db
		.insert(aiBooksFinanceActions)
		.values({
			connectionId,
			zohoBooksOrgId: orgId,
			actionType: "sync_invoices",
			summary: `Synced ${invoices.totalRecords} invoices, ${payments.totalRecords} payments. Overdue: ${overdue.totalRecords}.`,
			dataScope: {
				dateRange: "all",
				entityType: "invoices+payments",
				count: invoices.totalRecords,
			},
			result: summary,
			confidenceScore: 1.0,
			modelVersion: "system",
			approvalStatus: "approved", // sync is a read — no approval needed
			triggeredBy: adminUserId,
			source: "ai",
		})
		.returning();

	await auditLog({
		userId: adminUserId,
		userRole: "admin",
		agentType: "books",
		agentAction: "sync_books_data",
		entityId: action.id,
		entityType: "ai_books_finance_actions",
		outputSummary: `Zoho Books sync: ${invoices.totalRecords} invoices, ${overdue.totalRecords} overdue`,
		latencyMs: Date.now() - start,
		status: "success",
		externalApiCalled: true,
		externalService: "zoho_books",
		externalCallStatus: "success",
		externalCallMs: Date.now() - start,
	});

	// Auto-flag overdue invoices as compliance alerts
	if (overdue.totalRecords > 0) {
		await flagOverdueInvoices(connectionId, adminUserId, overdue.items);
	}

	return {
		actionId: action.id,
		invoiceCount: invoices.totalRecords,
		paymentCount: payments.totalRecords,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Draft Invoice from CRM Deal
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Uses AI to pre-fill an invoice draft from a Zoho CRM deal.
 * GUARDRAIL: Invoice is stored in ai_invoice_drafts (DRAFT) — NEVER issued to Zoho Books.
 */
export async function draftInvoiceFromCrmDeal(
	params: {
		dealName: string;
		customerName: string;
		customerEmail?: string;
		amount: number;
		description: string;
		zohoCrmDealId?: string;
		currency?: string;
	},
	connectionId: string,
	adminUserId: string,
): Promise<{ invoiceDraftId: string; confidenceScore: number }> {
	const start = Date.now();
	const orgId = getBooksOrgId();

	interface InvoiceDraftAI {
		lineItems: {
			description: string;
			hsnSac: string;
			quantity: number;
			rate: number;
			taxPct: number;
			amount: number;
		}[];
		subtotal: number;
		gstBreakdown: { cgst: number; sgst: number; igst: number };
		taxAmount: number;
		totalAmount: number;
		notes: string;
		terms: string;
	}

	const systemPrompt = `You are a GST-compliant invoice assistant for an Indian financial services firm (RIA/IFA).
Generate professional, legally-compliant invoice details from CRM deal data.
Return valid JSON only. No explanation. No markdown.`;

	const userPrompt = `Generate invoice for:
Deal: ${params.dealName}
Customer: ${params.customerName}
Amount: ₹${params.amount.toLocaleString("en-IN")}
Service: ${params.description}

Return JSON:
{
  "lineItems": [{"description": "string", "hsnSac": "997153", "quantity": 1, "rate": number, "taxPct": 18, "amount": number}],
  "subtotal": number,
  "gstBreakdown": {"cgst": number, "sgst": number, "igst": 0},
  "taxAmount": number,
  "totalAmount": ${params.amount},
  "notes": "string",
  "terms": "Payment due within 30 days."
}`;

	const { data: parsed, meta } = await callGemini<InvoiceDraftAI>(
		systemPrompt,
		userPrompt,
		{ parseJson: true },
	);

	const [draft] = await db
		.insert(aiInvoiceDrafts)
		.values({
			connectionId,
			zohoBooksOrgId: orgId,
			zohoCrmDealId: params.zohoCrmDealId,
			customerName: params.customerName,
			customerEmail: params.customerEmail,
			invoiceDate: new Date(),
			dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
			currency: params.currency || "INR",
			lineItems: parsed.lineItems,
			subtotal: String(parsed.subtotal),
			taxAmount: String(parsed.taxAmount),
			totalAmount: String(parsed.totalAmount),
			gstBreakdown: parsed.gstBreakdown,
			notes: parsed.notes,
			terms: parsed.terms,
			issuedToZohoBooks: false,
			confidenceScore: meta.confidence_score,
			modelVersion: meta.model_version,
			approvalStatus: "draft",
			requestedBy: adminUserId,
			source: "ai",
		})
		.returning();

	await auditLog({
		userId: adminUserId,
		userRole: "admin",
		agentType: "books",
		agentAction: "draft_invoice",
		entityId: draft.id,
		entityType: "ai_invoice_drafts",
		outputSummary: `Draft invoice for ${params.customerName} — ₹${params.amount.toLocaleString("en-IN")}`,
		confidenceScore: meta.confidence_score,
		modelVersion: meta.model_version,
		latencyMs: Date.now() - start,
		status: "success",
		approvalStatus: "draft",
	});

	return { invoiceDraftId: draft.id, confidenceScore: meta.confidence_score };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Payout Calculation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Calculates agent/partner payout suggestion for a given period.
 * GUARDRAIL: Payout is NEVER released without superadmin approval.
 */
export async function calculatePayoutSuggestion(
	params: {
		recipientId: string;
		recipientName: string;
		recipientType: "agent" | "partner" | "ca";
		periodStart: Date;
		periodEnd: Date;
		brokerageAmount: number;
		trailAmount: number;
		incentiveAmount: number;
		tdsRate?: number;
		breakdown?: unknown;
	},
	connectionId: string,
	adminUserId: string,
): Promise<{ payoutId: string }> {
	const start = Date.now();
	const orgId = getBooksOrgId();
	const tdsRate = params.tdsRate ?? 0.1;

	const gross =
		params.brokerageAmount + params.trailAmount + params.incentiveAmount;
	const tds = Number((gross * tdsRate).toFixed(2));
	const net = Number((gross - tds).toFixed(2));

	const [payout] = await db
		.insert(aiPayoutSuggestions)
		.values({
			connectionId,
			zohoBooksOrgId: orgId,
			recipientType: params.recipientType,
			recipientId: params.recipientId,
			recipientName: params.recipientName,
			periodStart: params.periodStart,
			periodEnd: params.periodEnd,
			brokerageAmount: String(params.brokerageAmount),
			trailAmount: String(params.trailAmount),
			incentiveAmount: String(params.incentiveAmount),
			tdsDeducted: String(tds),
			netPayable: String(net),
			breakdown: params.breakdown || {
				brokerage: params.brokerageAmount,
				trail: params.trailAmount,
				incentive: params.incentiveAmount,
				tdsRate: `${tdsRate * 100}%`,
				tdsAmount: tds,
				netPayable: net,
			},
			confidenceScore: 0.95,
			modelVersion: "system-v1",
			approvalStatus: "draft",
			source: "ai",
		})
		.returning();

	await auditLog({
		userId: adminUserId,
		userRole: "admin",
		agentType: "books",
		agentAction: "calculate_payout",
		entityId: payout.id,
		entityType: "ai_payout_suggestions",
		outputSummary: `Payout draft for ${params.recipientName} — Net ₹${net.toLocaleString("en-IN")}`,
		latencyMs: Date.now() - start,
		status: "success",
		approvalStatus: "draft",
	});

	return { payoutId: payout.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Revenue Reconciliation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Compares expected revenue from Zoho CRM deals vs received revenue in Zoho Books.
 */
export async function runRevenueReconciliation(
	connectionId: string,
	adminUserId: string,
	period: { start: Date; end: Date },
): Promise<{ reconciliationId: string; hasMismatch: boolean }> {
	const start = Date.now();
	const orgId = getBooksOrgId();
	const books = buildBooksService(connectionId);

	const startStr = period.start.toISOString().split("T")[0];
	const endStr = period.end.toISOString().split("T")[0];

	const [invoices, payments] = await Promise.all([
		books.getInvoices({
			per_page: 200,
			date_start: startStr,
			date_end: endStr,
		}),
		books.getPaymentsReceived({
			per_page: 200,
			date_start: startStr,
			date_end: endStr,
		}),
	]);

	const expectedRev = invoices.items.reduce((s, i) => s + (i.total || 0), 0);
	const receivedRev = payments.items.reduce((s, p) => s + (p.amount || 0), 0);
	const outstanding = expectedRev - receivedRev;
	const deltaPercent = expectedRev > 0 ? (outstanding / expectedRev) * 100 : 0;
	const hasMismatch = Math.abs(deltaPercent) > 5;

	const [reconciliation] = await db
		.insert(aiRevenueReconciliation)
		.values({
			connectionId,
			zohoBooksOrgId: orgId,
			periodStart: period.start,
			periodEnd: period.end,
			reportType: "monthly",
			expectedRevenueCrm: String(expectedRev),
			receivedRevenueBooks: String(receivedRev),
			outstandingReceivable: String(outstanding),
			delta: String(outstanding),
			deltaPercent,
			hasMismatch,
			mismatchDetails: hasMismatch
				? { expectedRev, receivedRev, delta: outstanding, deltaPercent }
				: null,
			flaggedItems: [],
			confidenceScore: 0.92,
			modelVersion: "system-v1",
			approvalStatus: "draft",
			source: "ai",
		})
		.returning();

	if (hasMismatch) {
		await db.insert(aiComplianceAlerts).values({
			alertType: "revenue_mismatch",
			severity: deltaPercent > 20 ? "critical" : "high",
			title: `Revenue mismatch: ${deltaPercent.toFixed(1)}% gap (${startStr} – ${endStr})`,
			detail: `Expected ₹${expectedRev.toLocaleString("en-IN")} | Received ₹${receivedRev.toLocaleString("en-IN")} | Outstanding ₹${outstanding.toLocaleString("en-IN")}`,
			agentType: "books",
			entityId: reconciliation.id,
			entityType: "ai_revenue_reconciliation",
			status: "open",
			confidenceScore: 0.92,
			modelVersion: "system-v1",
			source: "ai",
		});
	}

	await auditLog({
		userId: adminUserId,
		userRole: "admin",
		agentType: "books",
		agentAction: "revenue_reconciliation",
		entityId: reconciliation.id,
		entityType: "ai_revenue_reconciliation",
		outputSummary: `Reconciliation ${startStr}–${endStr}: ${hasMismatch ? `⚠️ Mismatch ${deltaPercent.toFixed(1)}%` : "✓ Match"}`,
		latencyMs: Date.now() - start,
		status: "success",
		approvalStatus: "draft",
	});

	return { reconciliationId: reconciliation.id, hasMismatch };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. GST Summary (AI-generated from Books data)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Fetches invoice data from Zoho Books and generates a GST-ready summary via Gemini.
 */
export async function getGstSummary(
	connectionId: string,
	adminUserId: string,
	period: { start: Date; end: Date },
): Promise<{ summary: string; gstData: unknown; auditId: string }> {
	const start = Date.now();
	const books = buildBooksService(connectionId);
	const startStr = period.start.toISOString().split("T")[0];
	const endStr = period.end.toISOString().split("T")[0];

	const invoices = await books.getInvoices({
		per_page: 200,
		date_start: startStr,
		date_end: endStr,
	});

	const gstData = {
		period: { from: startStr, to: endStr },
		invoiceCount: invoices.totalRecords,
		totalTaxable: invoices.items.reduce((s, i) => s + (i.total || 0), 0),
		paidAmount: invoices.items
			.filter((i) => i.status === "paid")
			.reduce((s, i) => s + (i.total || 0), 0),
	};

	const systemPrompt = `You are a GST expert for an Indian financial services firm. Generate a concise, accurate GST summary. Include disclaimer: "AI-generated estimate. Consult your CA for final GST filing."`;
	const userPrompt = `Period: ${startStr} to ${endStr}\nData: ${JSON.stringify(gstData)}\n\nWrite a 3-5 sentence GST summary with ₹ figures, CGST/SGST/IGST estimates, and filing reminder.`;

	const { data: summaryText, meta } = await callGemini<string>(
		systemPrompt,
		userPrompt,
		{ parseJson: false },
	);

	const summary =
		typeof summaryText === "string" ? summaryText : JSON.stringify(summaryText);
	const auditId = meta.calculation_timestamp;

	const [action] = await db
		.insert(aiBooksFinanceActions)
		.values({
			connectionId,
			zohoBooksOrgId: getBooksOrgId(),
			actionType: "gst_summary",
			summary: summary.substring(0, 500),
			dataScope: gstData,
			result: gstData,
			confidenceScore: meta.confidence_score,
			modelVersion: meta.model_version,
			approvalStatus: "draft",
			triggeredBy: adminUserId,
			source: "ai",
		})
		.returning();

	await auditLog({
		userId: adminUserId,
		userRole: "admin",
		agentType: "books",
		agentAction: "gst_summary",
		entityId: action.id,
		entityType: "ai_books_finance_actions",
		outputSummary: summary.substring(0, 200),
		confidenceScore: meta.confidence_score,
		modelVersion: meta.model_version,
		latencyMs: Date.now() - start,
		status: "success",
		approvalStatus: "draft",
	});

	return { summary, gstData, auditId };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Flag Overdue Invoices
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Creates compliance alerts for overdue invoices.
 */
export async function flagOverdueInvoices(
	connectionId: string,
	adminUserId: string,
	overdueInvoices?: {
		invoice_number: string;
		customer_name: string;
		balance: number;
		due_date: string;
	}[],
): Promise<number> {
	const books = buildBooksService(connectionId);
	const items =
		overdueInvoices ||
		(await books.getInvoices({ status: "overdue", per_page: 50 })).items;

	if (!items.length) return 0;

	const total = items.reduce((s, i) => s + (i.balance || 0), 0);

	await db.insert(aiComplianceAlerts).values({
		alertType: "overdue_invoice",
		severity: total > 500000 ? "critical" : total > 100000 ? "high" : "medium",
		title: `${items.length} overdue invoice(s) — Total outstanding: ₹${total.toLocaleString("en-IN")}`,
		detail: `Oldest: ${items[0]?.customer_name} (${items[0]?.invoice_number}) due ${items[0]?.due_date}`,
		agentType: "books",
		entityId: connectionId,
		entityType: "zoho_books_invoices",
		status: "open",
		confidenceScore: 1.0,
		modelVersion: "system-v1",
		source: "ai",
	});

	return items.length;
}

/**
 * Issue an approved draft invoice to Zoho Books.
 * GUARDRAIL: ONLY called after processApproval() confirms 2-step token.
 */
export async function issueInvoiceToZohoBooks(
	invoiceDraftId: string,
	connectionId: string,
	adminUserId: string,
): Promise<{ zohoBooksInvoiceId: string }> {
	const start = Date.now();
	const books = buildBooksService(connectionId);

	const [draft] = await db
		.select()
		.from(aiInvoiceDrafts)
		.where(eq(aiInvoiceDrafts.id, invoiceDraftId))
		.limit(1);

	if (!draft) throw new Error("Invoice draft not found");
	if (draft.issuedToZohoBooks)
		throw new Error("Invoice already issued to Zoho Books");
	if (draft.approvalStatus !== "approved")
		throw new Error("Invoice draft not yet approved");

	const lineItems = draft.lineItems as Array<{
		description: string;
		rate: number;
		quantity: number;
	}>;

	const zohoInvoice = await books.createInvoice({
		customer_name: draft.customerName,
		date:
			draft.invoiceDate?.toISOString().split("T")[0] ||
			new Date().toISOString().split("T")[0],
		due_date: draft.dueDate?.toISOString().split("T")[0],
		line_items: lineItems.map((li) => ({
			name: li.description,
			rate: li.rate,
			quantity: li.quantity,
		})),
		notes: draft.notes || undefined,
		terms: draft.terms || undefined,
	});

	await db
		.update(aiInvoiceDrafts)
		.set({
			issuedToZohoBooks: true,
			zohoBooksInvoiceId: zohoInvoice.invoice_id,
			updatedAt: new Date(),
		})
		.where(eq(aiInvoiceDrafts.id, invoiceDraftId));

	await auditLog({
		userId: adminUserId,
		userRole: "admin",
		agentType: "books",
		agentAction: "issue_invoice",
		entityId: invoiceDraftId,
		entityType: "ai_invoice_drafts",
		outputSummary: `Invoice issued to Zoho Books: ${zohoInvoice.invoice_id}`,
		latencyMs: Date.now() - start,
		status: "success",
		approvalStatus: "approved",
		externalApiCalled: true,
		externalService: "zoho_books",
		externalCallStatus: "success",
		externalCallMs: Date.now() - start,
	});

	return { zohoBooksInvoiceId: zohoInvoice.invoice_id };
}
