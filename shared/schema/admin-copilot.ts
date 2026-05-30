/**
 * Admin Copilot — Drizzle Schema
 * FintekPro FASP-AI v1.0 compliant
 *
 * All AI outputs are DRAFT-only until Admin/Superadmin explicitly approves.
 * Every table carries: confidence_score, model_version, generated_at, audit_id
 * Audit log is append-only (INSERT only — never UPDATE existing rows).
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  decimal,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED ENUMS (stored as varchar for portability)
// ─────────────────────────────────────────────────────────────────────────────
// approvalStatus: draft | approved | rejected | assigned | pending_review
// agentSource:    mail | crm | desk | proposal | task | bi | books | meeting | admin
// urgency:        critical | high | medium | low

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1 — Zoho Mail: Email Classifications
// ─────────────────────────────────────────────────────────────────────────────
export const aiEmailClassifications = pgTable("ai_email_classifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Zoho Mail reference
  zohoMailId:      varchar("zoho_mail_id"),
  zohoFolderId:    varchar("zoho_folder_id"),
  connectionId:    varchar("connection_id"),       // zoho_connections.id

  // Email metadata (masked in logs — no full body stored)
  senderEmail:     varchar("sender_email").notNull(),
  senderName:      varchar("sender_name"),
  subject:         text("subject"),
  receivedAt:      timestamp("received_at"),

  // AI classification
  category: varchar("category").notNull(),
  // investor_enquiry | kyc_issue | complaint | partner_enquiry |
  // loan_enquiry | mf_enquiry | pms_aif_enquiry | reit_invit | compliance | support
  urgency:         varchar("urgency").default("medium"),   // critical|high|medium|low
  intent:          text("intent"),                         // 1-liner AI summary
  clientName:      varchar("client_name"),
  productInterest: varchar("product_interest"),
  actionRequired:  text("action_required"),

  // Draft reply (DRAFT — never sent without Admin approval)
  draftReply:         text("draft_reply"),
  draftReplyStatus:   varchar("draft_reply_status").default("draft"), // draft|approved|sent|rejected

  // FASP-AI v1.0 fields
  confidenceScore:  real("confidence_score"),
  modelVersion:     varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:      timestamp("generated_at").defaultNow(),
  auditId:          varchar("audit_id"),

  // Approval workflow
  approvalStatus:   varchar("approval_status").default("draft"),
  approvedBy:       varchar("approved_by").references(() => users.id),
  approvedAt:       timestamp("approved_at"),
  sentAt:           timestamp("sent_at"),
  rejectionReason:  text("rejection_reason"),

  // Links
  linkedTaskId:     varchar("linked_task_id"),
  linkedProposalId: varchar("linked_proposal_id"),

  // Metadata
  source: varchar("source").default("ai"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2 — Task Agent
// ─────────────────────────────────────────────────────────────────────────────
export const aiAdminTasks = pgTable("ai_admin_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  title:           text("title").notNull(),
  description:     text("description"),

  // Source of task creation
  source: varchar("source").notNull(),
  // email | crm | desk | proposal | meeting | books | admin_prompt | manual

  // Priority and status
  priority: varchar("priority").default("medium"),   // critical|high|medium|low
  status:   varchar("status").default("draft"),
  // draft | approved | assigned | in_progress | completed | escalated | closed

  // Assignment
  assignedToRole:   varchar("assigned_to_role"),     // admin|agent|ca|compliance
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  dueDate:          timestamp("due_date"),

  // Cross-module links
  linkedEmailId:    varchar("linked_email_id"),
  linkedCrmLeadId:  varchar("linked_crm_lead_id"),
  linkedTicketId:   varchar("linked_ticket_id"),
  linkedProposalId: varchar("linked_proposal_id"),
  linkedMeetingId:  varchar("linked_meeting_id"),
  linkedInvoiceId:  varchar("linked_invoice_id"),

  // FASP-AI v1.0 fields
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  // Approval
  createdByAi:   boolean("created_by_ai").default(true),
  approvalStatus: varchar("approval_status").default("draft"),
  approvedBy:    varchar("approved_by").references(() => users.id),
  approvedAt:    timestamp("approved_at"),

  // Completion
  completedBy: varchar("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at"),
  notes:       text("notes"),

  source_meta: jsonb("source_meta"),   // raw context from triggering event

  createdBy: varchar("created_by").references(() => users.id),
  source_label: varchar("source_label").default("api"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3 — Zoho CRM Agent
// ─────────────────────────────────────────────────────────────────────────────
export const aiCrmLeadActions = pgTable("ai_crm_lead_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Zoho CRM reference
  zohoLeadId:   varchar("zoho_lead_id"),
  zohoContactId: varchar("zoho_contact_id"),
  connectionId:  varchar("connection_id"),

  // Lead info (synced from Zoho CRM)
  leadName:     varchar("lead_name"),
  leadEmail:    varchar("lead_email"),
  leadPhone:    varchar("lead_phone"),
  company:      varchar("company"),
  productInterest: varchar("product_interest"),
  territory:    varchar("territory"),
  dealValue:    decimal("deal_value", { precision: 15, scale: 2 }),

  // AI intelligence
  currentStage:        varchar("current_stage"),
  // new_lead|contacted|risk_profile_pending|proposal_drafted|admin_approved|
  // sent_to_client|follow_up|converted|rejected|dormant
  recommendedStage:    varchar("recommended_stage"),
  intentScore:         real("intent_score"),           // 0-100
  nextBestAction:      text("next_best_action"),
  intelligenceSummary: text("intelligence_summary"),
  routingRecommendation: jsonb("routing_recommendation"), // {agentId, reason, workload}

  // FASP-AI v1.0
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  // Approval (stage update requires Admin approval)
  approvalStatus: varchar("approval_status").default("draft"),
  approvedBy:    varchar("approved_by").references(() => users.id),
  approvedAt:    timestamp("approved_at"),

  syncedAt:  timestamp("synced_at").defaultNow(),
  source:    varchar("source").default("ai"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4 — Zoho Desk Agent
// ─────────────────────────────────────────────────────────────────────────────
export const aiDeskTicketActions = pgTable("ai_desk_ticket_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Zoho Desk reference
  zohoTicketId:   varchar("zoho_ticket_id"),
  zohoDepartment: varchar("zoho_department"),
  connectionId:   varchar("connection_id"),

  // Ticket info
  subject:       text("subject"),
  contactName:   varchar("contact_name"),
  contactEmail:  varchar("contact_email"),
  ticketStatus:  varchar("ticket_status"),
  priority:      varchar("priority"),
  createdInZoho: timestamp("created_in_zoho"),
  dueDate:       timestamp("due_date"),

  // AI classification
  category: varchar("category"),
  // complaint | billing | technical | product_enquiry | kyc | general
  isComplaint:      boolean("is_complaint").default(false),
  isHighRisk:       boolean("is_high_risk").default(false),
  slaBreach:        boolean("sla_breach").default(false),
  slaBreachRiskPct: real("sla_breach_risk_pct"),          // 0-100
  escalationReason: text("escalation_reason"),

  // Draft response (DRAFT — never sent without Admin approval)
  draftResponse:       text("draft_response"),
  draftResponseStatus: varchar("draft_response_status").default("draft"),

  // FASP-AI v1.0
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  approvalStatus: varchar("approval_status").default("draft"),
  approvedBy:    varchar("approved_by").references(() => users.id),
  approvedAt:    timestamp("approved_at"),

  syncedAt:  timestamp("synced_at").defaultNow(),
  source:    varchar("source").default("ai"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5 — Investor Proposal Agent
// ─────────────────────────────────────────────────────────────────────────────
export const aiProposalDrafts = pgTable("ai_proposal_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Investor inputs (these drive the AI generation)
  investorName:     varchar("investor_name").notNull(),
  investorEmail:    varchar("investor_email"),
  investorUserId:   varchar("investor_user_id").references(() => users.id),
  amount:           decimal("amount", { precision: 15, scale: 2 }),
  riskProfile:      varchar("risk_profile"),          // conservative|moderate|aggressive
  investmentHorizon: varchar("investment_horizon"),   // 1y|3y|5y|10y+
  taxStatus:        varchar("tax_status"),            // resident|nri|huf|corporate
  liquidityNeed:    varchar("liquidity_need"),        // high|medium|low
  existingHoldings: jsonb("existing_holdings"),       // array of {asset, value}
  productUniverse:  jsonb("product_universe"),        // array of product types requested

  // Product type
  productType: varchar("product_type").notNull(),
  // mutual_fund | bonds_ncd | pms | aif | reit_invit | unlisted | us_stocks | loans | corporate_treasury

  // AI-generated proposal sections
  executiveSummary:       text("executive_summary"),
  assetAllocation:        jsonb("asset_allocation"),       // {equity:%, debt:%, alt:%}
  productRecommendation:  jsonb("product_recommendation"), // array of recommended products
  expectedReturnRange:    varchar("expected_return_range"), // "8-11% p.a." (range, not promise)
  riskAssessment:         text("risk_assessment"),
  liquidityAnalysis:      text("liquidity_analysis"),
  taxationNote:           text("taxation_note"),
  suitabilityNote:        text("suitability_note"),
  disclaimer:             text("disclaimer"),              // SEBI/CFP-style mandatory disclaimer

  // PDF
  pdfUrl:    varchar("pdf_url"),
  pdfBucket: varchar("pdf_bucket"),

  // FASP-AI v1.0
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  // Approval — DRAFT until Admin explicitly approves
  approvalStatus: varchar("approval_status").default("draft"),
  approvedBy:    varchar("approved_by").references(() => users.id),
  approvedAt:    timestamp("approved_at"),
  sentToClient:  boolean("sent_to_client").default(false),
  sentAt:        timestamp("sent_at"),
  rejectionReason: text("rejection_reason"),

  // Zoho CRM link
  linkedCrmLeadId: varchar("linked_crm_lead_id"),

  requestedBy: varchar("requested_by").references(() => users.id),
  source:      varchar("source").default("ai"),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 6 — Analytics BI Agent
// ─────────────────────────────────────────────────────────────────────────────
export const aiBiReports = pgTable("ai_bi_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  reportDate:  timestamp("report_date").notNull(),
  reportType:  varchar("report_type").default("daily"),   // daily|weekly|monthly|adhoc

  // BI data snapshot
  summary: jsonb("summary").notNull(),
  // { leads, conversions, proposals, revenue, aum, productSales,
  //   agentPerformance, complaintRatio, kycPending, campaignResults }

  // NL Q&A responses stored per report
  nlAnswers: jsonb("nl_answers"),   // array of {question, answer, timestamp}

  // FASP-AI v1.0
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  dataSource:  varchar("data_source").default("cloud_sql"),   // cloud_sql | zoho_analytics
  generatedBy: varchar("generated_by").references(() => users.id),
  source:      varchar("source").default("ai"),
  createdAt:   timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL — Admin Approval Workflow
// ─────────────────────────────────────────────────────────────────────────────
export const aiAdminApprovals = pgTable("ai_admin_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // What is being approved
  agentType: varchar("agent_type").notNull(),
  // mail | crm | desk | proposal | task | bi | books | meeting | compliance
  entityId:   varchar("entity_id").notNull(),   // ID of the ai_* record being reviewed
  entityType: varchar("entity_type").notNull(), // ai_email_classifications | ai_proposal_drafts | etc.

  // Action taken
  action: varchar("action").notNull(),
  // approve | edit | reject | assign | convert_to_task | convert_to_proposal |
  // send_email_after_confirm | issue_invoice_after_confirm | send_meeting_invite_after_confirm | export_pdf

  // Admin who acted
  adminId:   varchar("admin_id").notNull().references(() => users.id),
  adminRole: varchar("admin_role"),   // admin | superadmin

  // Edit content (if action=edit, store the modified content)
  editedContent: jsonb("edited_content"),

  // Result
  resultEntityId:   varchar("result_entity_id"),   // e.g. new task_id from convert_to_task
  resultEntityType: varchar("result_entity_type"),
  notes:            text("notes"),

  // 2-step confirmation for destructive sends
  confirmationToken: varchar("confirmation_token"),
  confirmedAt:       timestamp("confirmed_at"),

  source:    varchar("source").default("admin"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL — Compliance Alerts
// ─────────────────────────────────────────────────────────────────────────────
export const aiComplianceAlerts = pgTable("ai_compliance_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  alertType: varchar("alert_type").notNull(),
  // sla_breach | complaint_high_risk | overdue_invoice | revenue_mismatch |
  // kyc_pending_critical | complaint_regulatory | payout_anomaly

  severity: varchar("severity").default("high"),   // critical | high | medium | low
  title:    text("title").notNull(),
  detail:   text("detail"),

  // Source entity
  agentType:  varchar("agent_type"),
  entityId:   varchar("entity_id"),
  entityType: varchar("entity_type"),

  // Status
  status: varchar("status").default("open"),   // open | acknowledged | resolved | dismissed

  // FASP-AI v1.0
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolution: text("resolution"),

  source:    varchar("source").default("ai"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL — Immutable Audit Log (INSERT ONLY — NEVER UPDATE)
// ─────────────────────────────────────────────────────────────────────────────
export const aiAuditLogs = pgTable("ai_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Who
  userId:    varchar("user_id").references(() => users.id),
  userRole:  varchar("user_role"),

  // What AI agent
  agentType:   varchar("agent_type").notNull(),
  agentAction: varchar("agent_action").notNull(),

  // Entity affected
  entityId:   varchar("entity_id"),
  entityType: varchar("entity_type"),

  // Context (truncated — no PAN/Aadhaar in logs)
  inputContext:  jsonb("input_context"),
  outputSummary: text("output_summary"),

  // FASP-AI v1.0 fields
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),

  // Approval state at time of log
  approvalStatus: varchar("approval_status"),
  approvingAdmin: varchar("approving_admin"),

  // External API call tracking
  externalApiCalled: boolean("external_api_called").default(false),
  externalService:   varchar("external_service"),   // zoho_mail | zoho_crm | zoho_books | zoho_meeting
  externalCallStatus: varchar("external_call_status"), // success | failure | skipped
  externalCallMs:    integer("external_call_ms"),

  // Latency
  latencyMs: integer("latency_ms"),
  status:    varchar("status").default("success"),   // success | failure | partial

  // Error (if any)
  errorCode:    varchar("error_code"),
  errorMessage: text("error_message"),
  retryable:    boolean("retryable").default(false),

  source:    varchar("source").default("api"),
  timestamp: timestamp("timestamp").defaultNow(),
  // NOTE: This table is INSERT-ONLY — no updatedAt
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 8 — Zoho Books Finance Agent
// ─────────────────────────────────────────────────────────────────────────────

export const aiBooksFinanceActions = pgTable("ai_books_finance_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Zoho Books reference
  connectionId:    varchar("connection_id"),
  zohoBooksOrgId:  varchar("zoho_books_org_id"),

  // Action performed
  actionType: varchar("action_type").notNull(),
  // sync_invoices | sync_payments | sync_expenses | draft_invoice |
  // flag_overdue | payout_calc | revenue_reconcile | gst_summary

  // Summary of action
  summary:   text("summary"),
  dataScope: jsonb("data_scope"),   // {dateRange, entityType, count}
  result:    jsonb("result"),       // action-specific result payload

  // FASP-AI v1.0
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  approvalStatus: varchar("approval_status").default("draft"),
  approvedBy:    varchar("approved_by").references(() => users.id),
  approvedAt:    timestamp("approved_at"),

  triggeredBy: varchar("triggered_by").references(() => users.id),
  source:      varchar("source").default("ai"),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

export const aiInvoiceDrafts = pgTable("ai_invoice_drafts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Zoho Books references
  connectionId:    varchar("connection_id"),
  zohoBooksOrgId:  varchar("zoho_books_org_id"),
  zohoCrmDealId:   varchar("zoho_crm_deal_id"),      // linked CRM deal
  zohoCustomerId:  varchar("zoho_customer_id"),       // Zoho Books customer

  // Invoice details (AI pre-filled, Admin must confirm before issue)
  customerName:    varchar("customer_name").notNull(),
  customerEmail:   varchar("customer_email"),
  customerGstin:   varchar("customer_gstin"),        // masked in logs
  invoiceDate:     timestamp("invoice_date"),
  dueDate:         timestamp("due_date"),
  currency:        varchar("currency").default("INR"),
  lineItems:       jsonb("line_items").notNull(),
  // [{description, hsnSac, quantity, rate, taxPct, amount}]
  subtotal:        decimal("subtotal", { precision: 15, scale: 2 }),
  taxAmount:       decimal("tax_amount", { precision: 15, scale: 2 }),
  totalAmount:     decimal("total_amount", { precision: 15, scale: 2 }),
  gstBreakdown:    jsonb("gst_breakdown"),   // {cgst, sgst, igst}
  notes:           text("notes"),
  terms:           text("terms"),

  // Issue status — NEVER issued without Admin approval
  issuedToZohoBooks: boolean("issued_to_zoho_books").default(false),
  zohoBooksInvoiceId: varchar("zoho_books_invoice_id"),   // set after issue

  // FASP-AI v1.0
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  approvalStatus: varchar("approval_status").default("draft"),
  approvedBy:    varchar("approved_by").references(() => users.id),
  approvedAt:    timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),

  requestedBy: varchar("requested_by").references(() => users.id),
  source:      varchar("source").default("ai"),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

export const aiPayoutSuggestions = pgTable("ai_payout_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  connectionId:   varchar("connection_id"),
  zohoBooksOrgId: varchar("zoho_books_org_id"),

  // Recipient
  recipientType:   varchar("recipient_type").notNull(), // agent | partner | ca
  recipientId:     varchar("recipient_id").references(() => users.id),
  recipientName:   varchar("recipient_name"),

  // Payout period
  periodStart: timestamp("period_start").notNull(),
  periodEnd:   timestamp("period_end").notNull(),

  // Payout breakdown
  brokerageAmount: decimal("brokerage_amount", { precision: 15, scale: 2 }),
  trailAmount:     decimal("trail_amount",     { precision: 15, scale: 2 }),
  incentiveAmount: decimal("incentive_amount", { precision: 15, scale: 2 }),
  tdsDeducted:     decimal("tds_deducted",     { precision: 15, scale: 2 }),
  netPayable:      decimal("net_payable",      { precision: 15, scale: 2 }),
  breakdown:       jsonb("breakdown"),   // line-level details

  // FASP-AI v1.0 — payout release NEVER happens without Admin approval
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  approvalStatus: varchar("approval_status").default("draft"),
  approvedBy:    varchar("approved_by").references(() => users.id),
  approvedAt:    timestamp("approved_at"),

  source:    varchar("source").default("ai"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiRevenueReconciliation = pgTable("ai_revenue_reconciliation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  connectionId:   varchar("connection_id"),
  zohoBooksOrgId: varchar("zoho_books_org_id"),

  // Period
  periodStart: timestamp("period_start").notNull(),
  periodEnd:   timestamp("period_end").notNull(),
  reportType:  varchar("report_type").default("monthly"),

  // Revenue figures
  expectedRevenueCrm:    decimal("expected_revenue_crm",    { precision: 15, scale: 2 }),
  receivedRevenueBooks:  decimal("received_revenue_books",  { precision: 15, scale: 2 }),
  outstandingReceivable: decimal("outstanding_receivable",  { precision: 15, scale: 2 }),
  delta:                 decimal("delta",                   { precision: 15, scale: 2 }),
  deltaPercent:          real("delta_percent"),

  // Mismatch details
  hasMismatch:      boolean("has_mismatch").default(false),
  mismatchDetails:  jsonb("mismatch_details"),   // array of {dealId, expected, received, diff}
  flaggedItems:     jsonb("flagged_items"),

  // FASP-AI v1.0
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  approvalStatus: varchar("approval_status").default("draft"),
  reviewedBy:    varchar("reviewed_by").references(() => users.id),
  reviewedAt:    timestamp("reviewed_at"),

  source:    varchar("source").default("ai"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 9 — Zoho Meeting Agent
// ─────────────────────────────────────────────────────────────────────────────

export const aiMeetingActions = pgTable("ai_meeting_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Zoho Meeting reference
  connectionId:    varchar("connection_id"),
  zohoMeetingId:   varchar("zoho_meeting_id"),   // set after invite sent

  // Meeting details
  meetingType: varchar("meeting_type").notNull(),
  // investor | partner | internal | kyc | support | proposal_review | webinar | training | complaint_resolution

  title:       text("title").notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at"),
  durationMin: integer("duration_min").default(60),
  timezone:    varchar("timezone").default("Asia/Kolkata"),
  hostEmail:   varchar("host_email"),
  attendees:   jsonb("attendees"),   // [{name, email, role}]

  // Cross-module links
  linkedCrmLeadId:  varchar("linked_crm_lead_id"),
  linkedTicketId:   varchar("linked_ticket_id"),
  linkedProposalId: varchar("linked_proposal_id"),

  // Status
  meetingStatus: varchar("meeting_status").default("draft"),
  // draft | invite_pending_approval | invite_sent | completed | cancelled | no_show

  joiningLink: varchar("joining_link"),   // set after meeting created in Zoho

  // FASP-AI v1.0
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  // Invite requires Admin approval before sending to client
  approvalStatus: varchar("approval_status").default("draft"),
  approvedBy:    varchar("approved_by").references(() => users.id),
  approvedAt:    timestamp("approved_at"),
  inviteSentAt:  timestamp("invite_sent_at"),

  requestedBy: varchar("requested_by").references(() => users.id),
  source:      varchar("source").default("ai"),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
});

export const aiMeetingNotes = pgTable("ai_meeting_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  meetingActionId: varchar("meeting_action_id"),   // links to ai_meeting_actions.id
  zohoMeetingId:   varchar("zoho_meeting_id"),

  // Meeting attendance
  attendeesPresent: jsonb("attendees_present"),
  attendeesAbsent:  jsonb("attendees_absent"),
  noShowCount:      integer("no_show_count").default(0),
  actualDurationMin: integer("actual_duration_min"),

  // AI-generated summary (DRAFT until Admin approves)
  summary:       text("summary"),
  keyDecisions:  jsonb("key_decisions"),    // array of strings
  actionItems:   jsonb("action_items"),     // array of {task, owner, dueDate}
  nextSteps:     text("next_steps"),
  complianceNote: text("compliance_note"), // for regulatory meetings

  // FASP-AI v1.0
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  // Compliance-sensitive notes need explicit Admin approval
  isComplianceSensitive: boolean("is_compliance_sensitive").default(false),
  approvalStatus:        varchar("approval_status").default("draft"),
  approvedBy:           varchar("approved_by").references(() => users.id),
  approvedAt:           timestamp("approved_at"),

  source:    varchar("source").default("ai"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiMeetingFollowups = pgTable("ai_meeting_followups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  meetingNotesId:  varchar("meeting_notes_id"),    // links to ai_meeting_notes.id
  meetingActionId: varchar("meeting_action_id"),

  // Generated follow-up task (auto-converted to ai_admin_tasks after Admin approval)
  taskTitle:        text("task_title").notNull(),
  taskDescription:  text("task_description"),
  assignedToRole:   varchar("assigned_to_role"),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  dueDate:          timestamp("due_date"),
  priority:         varchar("priority").default("medium"),

  // Conversion tracking
  convertedToTaskId: varchar("converted_to_task_id"),   // ai_admin_tasks.id
  convertedAt:       timestamp("converted_at"),

  // FASP-AI v1.0
  confidenceScore: real("confidence_score"),
  modelVersion:    varchar("model_version").default("gemini-2.0-flash"),
  generatedAt:     timestamp("generated_at").defaultNow(),
  auditId:         varchar("audit_id"),

  approvalStatus: varchar("approval_status").default("draft"),
  approvedBy:    varchar("approved_by").references(() => users.id),
  approvedAt:    timestamp("approved_at"),

  source:    varchar("source").default("ai"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Zod insert schemas (for API validation)
// ─────────────────────────────────────────────────────────────────────────────

export const insertAiEmailClassificationSchema = createInsertSchema(aiEmailClassifications).omit({
  id: true, generatedAt: true, createdAt: true, updatedAt: true,
});
export const insertAiAdminTaskSchema = createInsertSchema(aiAdminTasks).omit({
  id: true, generatedAt: true, createdAt: true, updatedAt: true,
});
export const insertAiProposalDraftSchema = createInsertSchema(aiProposalDrafts).omit({
  id: true, generatedAt: true, createdAt: true, updatedAt: true,
});
export const insertAiAdminApprovalSchema = createInsertSchema(aiAdminApprovals).omit({
  id: true, createdAt: true,
});
export const insertAiAuditLogSchema = createInsertSchema(aiAuditLogs).omit({
  id: true, timestamp: true,
});
export const insertAiInvoiceDraftSchema = createInsertSchema(aiInvoiceDrafts).omit({
  id: true, generatedAt: true, createdAt: true, updatedAt: true,
});
export const insertAiMeetingActionSchema = createInsertSchema(aiMeetingActions).omit({
  id: true, generatedAt: true, createdAt: true, updatedAt: true,
});
export const insertAiMeetingNotesSchema = createInsertSchema(aiMeetingNotes).omit({
  id: true, generatedAt: true, createdAt: true, updatedAt: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript types
// ─────────────────────────────────────────────────────────────────────────────

export type AiEmailClassification   = typeof aiEmailClassifications.$inferSelect;
export type AiAdminTask             = typeof aiAdminTasks.$inferSelect;
export type AiCrmLeadAction         = typeof aiCrmLeadActions.$inferSelect;
export type AiDeskTicketAction      = typeof aiDeskTicketActions.$inferSelect;
export type AiProposalDraft         = typeof aiProposalDrafts.$inferSelect;
export type AiBiReport              = typeof aiBiReports.$inferSelect;
export type AiAdminApproval         = typeof aiAdminApprovals.$inferSelect;
export type AiComplianceAlert       = typeof aiComplianceAlerts.$inferSelect;
export type AiAuditLog              = typeof aiAuditLogs.$inferSelect;
export type AiBooksFinanceAction    = typeof aiBooksFinanceActions.$inferSelect;
export type AiInvoiceDraft          = typeof aiInvoiceDrafts.$inferSelect;
export type AiPayoutSuggestion      = typeof aiPayoutSuggestions.$inferSelect;
export type AiRevenueReconciliation = typeof aiRevenueReconciliation.$inferSelect;
export type AiMeetingAction         = typeof aiMeetingActions.$inferSelect;
export type AiMeetingNotes          = typeof aiMeetingNotes.$inferSelect;
export type AiMeetingFollowup       = typeof aiMeetingFollowups.$inferSelect;

export type InsertAiEmailClassification = z.infer<typeof insertAiEmailClassificationSchema>;
export type InsertAiAdminTask           = z.infer<typeof insertAiAdminTaskSchema>;
export type InsertAiProposalDraft       = z.infer<typeof insertAiProposalDraftSchema>;
export type InsertAiAdminApproval       = z.infer<typeof insertAiAdminApprovalSchema>;
export type InsertAiAuditLog            = z.infer<typeof insertAiAuditLogSchema>;
export type InsertAiInvoiceDraft        = z.infer<typeof insertAiInvoiceDraftSchema>;
export type InsertAiMeetingAction       = z.infer<typeof insertAiMeetingActionSchema>;
export type InsertAiMeetingNotes        = z.infer<typeof insertAiMeetingNotesSchema>;
