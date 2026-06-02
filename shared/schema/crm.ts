import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean, index, uniqueIndex, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { loanLeads } from "./loans";
import { leadProcessingModeEnum, leadStatusEnum } from "./enums";

// --- Types & Interfaces ---

export type PartnerHierarchy = {
  partnerId: string;
  name: string;
  level: string; // L1, L2, L3, L4, L5, L6, L7
  role: string;  // MASTER, DISTRIBUTOR, AGENT, etc.
  parentId: string | null;
  commissionRate?: number;
  children?: PartnerHierarchy[];
};

export const partnerHierarchySchema: z.ZodType<PartnerHierarchy> = z.lazy(() =>
  z.object({
    partnerId: z.string(),
    name: z.string(),
    level: z.string(),
    role: z.string(),
    parentId: z.string().nullable(),
    commissionRate: z.number().optional(),
    children: z.array(z.lazy(() => partnerHierarchySchema)).optional(),
  })
) as z.ZodType<PartnerHierarchy>;

// --- Tables ---

// 1. Core Registry
export const leadRegistry = pgTable("lead_registry", {
  leadId: varchar("lead_id").primaryKey().default(sql`gen_random_uuid()`),
  pan: varchar("pan", { length: 10 }).notNull(),
  mobile: varchar("mobile", { length: 15 }).notNull(),
  customerName: varchar("customer_name", { length: 200 }).notNull(),
  loanType: varchar("loan_type", { length: 50 }).notNull(),
  approxAmount: decimal("approx_amount", { precision: 15, scale: 2 }),
  firstAgentId: varchar("first_agent_id").notNull(),
  firstPartnerId: varchar("first_partner_id").notNull(),
  partnerHierarchySnapshot: jsonb("partner_hierarchy_snapshot").default({} as any),
  processingMode: leadProcessingModeEnum("processing_mode"),
  financierName: varchar("financier_name", { length: 200 }),
  bankerName: varchar("banker_name", { length: 200 }),
  bankerMobile: varchar("banker_mobile", { length: 15 }),
  bankerEmail: varchar("banker_email", { length: 200 }),
  financierSetAt: timestamp("financier_set_at"),
  processingModeSetAt: timestamp("processing_mode_set_at"),
  status: leadStatusEnum("status").notNull().default("REGISTERED"),
  statusHistory: jsonb("status_history").default([]),
  firstTouchTimestamp: timestamp("first_touch_timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_lead_registry_pan_mobile").on(table.pan, table.mobile),
  index("idx_lead_registry_agent").on(table.firstAgentId),
  index("idx_lead_registry_partner").on(table.firstPartnerId),
  index("idx_lead_registry_status").on(table.status),
]);

export const insertLeadRegistrySchema = createInsertSchema(leadRegistry as any, {
  partnerHierarchySnapshot: partnerHierarchySchema,
}).omit({
  leadId: true, 
  firstTouchTimestamp: true, 
  createdAt: true, 
  statusHistory: true,
  processingModeSetAt: true, 
  financierSetAt: true,
});


export type LeadRegistry = typeof leadRegistry.$inferSelect;
export type InsertLeadRegistry = z.infer<typeof insertLeadRegistrySchema>;

// 2. Activity & Tracking (Core CRM)

export const crmInteractions = pgTable("crm_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  type: varchar("type").notNull(), // call, email, meeting, note, whatsapp, sms
  direction: varchar("direction"), // inbound, outbound (for calls/emails)
  subject: varchar("subject"),
  description: text("description"),
  
  // Interaction details
  duration: integer("duration"), // duration in minutes (for calls/meetings)
  outcome: varchar("outcome"), // successful, no_answer, voicemail, follow_up_needed, completed
  sentiment: varchar("sentiment"), // positive, neutral, negative
  
  // Scheduling
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  
  // Linking to other entities
  opportunityId: varchar("opportunity_id"),
  proposalId: varchar("proposal_id"),
  taskId: varchar("task_id"),
  
  // Metadata
  attachments: jsonb("attachments"), // file URLs, documents
  metadata: jsonb("metadata"), // additional data like call recording URL, email thread ID
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_interactions_agent").on(table.agentId),
  index("idx_crm_interactions_client").on(table.clientId),
  index("idx_crm_interactions_type").on(table.type),
  index("idx_crm_interactions_created").on(table.createdAt),
]);

export const crmOpportunities = pgTable("crm_opportunities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  name: varchar("name").notNull(),
  description: text("description"),
  
  // Pipeline stage
  stage: varchar("stage").notNull().default("lead"), // lead, qualified, proposal, negotiation, won, lost
  probability: integer("probability").default(0), // 0-100%
  
  // Financial
  expectedAmount: decimal("expected_amount", { precision: 15, scale: 2 }),
  actualAmount: decimal("actual_amount", { precision: 15, scale: 2 }),
  currency: varchar("currency").default("INR"),
  
  // Product/Service
  productType: varchar("product_type"), // mutual_fund, stocks, bonds, insurance, etc.
  products: jsonb("products"), // array of product details
  
  // Timeline
  expectedCloseDate: timestamp("expected_close_date"),
  actualCloseDate: timestamp("actual_close_date"),
  
  // Source tracking
  source: varchar("source"), // referral, website, cold_call, marketing, etc.
  campaign: varchar("campaign"),
  
  // Status and reason
  status: varchar("status").default("open"), // open, won, lost, on_hold
  lostReason: varchar("lost_reason"),
  
  // Linked entities
  proposalId: varchar("proposal_id"),
  
  // Priority and scoring
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  score: integer("score"), // lead score 0-100
  
  notes: text("notes"),
  tags: text("tags").array(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_opportunities_agent").on(table.agentId),
  index("idx_crm_opportunities_client").on(table.clientId),
  index("idx_crm_opportunities_stage").on(table.stage),
  index("idx_crm_opportunities_status").on(table.status),
]);

export const crmTasks = pgTable("crm_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  clientId: varchar("client_id").references(() => users.id),
  
  title: varchar("title").notNull(),
  description: text("description"),
  
  type: varchar("type").notNull().default("task"), // task, follow_up, call, meeting, reminder
  priority: varchar("priority").default("medium"), // low, medium, high, urgent
  status: varchar("status").default("pending"), // pending, in_progress, completed, cancelled
  
  // Scheduling
  dueDate: timestamp("due_date"),
  dueTime: varchar("due_time"), // HH:MM format
  reminderAt: timestamp("reminder_at"),
  completedAt: timestamp("completed_at"),
  
  // Recurrence
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: varchar("recurrence_pattern"), // daily, weekly, monthly, yearly
  recurrenceEndDate: timestamp("recurrence_end_date"),
  
  // Linking
  opportunityId: varchar("opportunity_id"),
  interactionId: varchar("interaction_id"),
  
  // Notification
  notificationSent: boolean("notification_sent").default(false),
  
  tags: text("tags").array(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_crm_tasks_agent").on(table.agentId),
  index("idx_crm_tasks_client").on(table.clientId),
  index("idx_crm_tasks_status").on(table.status),
  index("idx_crm_tasks_due_date").on(table.dueDate),
]);

export const crmClientTags = pgTable("crm_client_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  tag: varchar("tag").notNull(), // vip, high_value, new_client, dormant, etc.
  color: varchar("color"), // hex color for UI
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_crm_client_tags_agent").on(table.agentId),
  index("idx_crm_client_tags_client").on(table.clientId),
]);

export const crmActivityLog = pgTable("crm_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  clientId: varchar("client_id").references(() => users.id),
  
  activityType: varchar("activity_type").notNull(), // interaction, task, opportunity, proposal, note
  action: varchar("action").notNull(), // created, updated, completed, stage_changed, etc.
  entityId: varchar("entity_id"),
  entityType: varchar("entity_type"),
  
  summary: text("summary"),
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_crm_activity_agent").on(table.agentId),
  index("idx_crm_activity_client").on(table.clientId),
  index("idx_crm_activity_created").on(table.createdAt),
]);

// 3. Lead Activity (Marketplace)

export const leadActivityLog = pgTable("lead_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => loanLeads.id).notNull(),
  
  // Activity Details
  activityType: varchar("activity_type").notNull(), // call, email, sms, whatsapp, meeting, document_request, document_received, stage_change, note, escalation
  activitySubType: varchar("activity_sub_type"), // outbound_call, inbound_call, follow_up, etc.
  
  // Content
  subject: varchar("subject"),
  description: text("description"),
  callDuration: integer("call_duration"), // seconds
  callRecordingUrl: varchar("call_recording_url"),
  
  // Stage Transition (for stage_change type)
  fromStage: varchar("from_stage"),
  toStage: varchar("to_stage"),
  
  // Performed By
  performedBy: varchar("performed_by").notNull(),
  performedByType: varchar("performed_by_type"), // staff, agent, system
  
  // Outcome
  outcome: varchar("outcome"), // connected, not_answered, call_back, interested, not_interested, wrong_number
  nextAction: text("next_action"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// 4. Prospecting

export const prospectLeads = pgTable("prospect_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Company identification
  cin: varchar("cin"), // Company Identification Number
  companyName: varchar("company_name").notNull(),
  registrationNumber: varchar("registration_number"),
  
  // Contact details
  primaryEmail: varchar("primary_email"),
  primaryMobile: varchar("primary_mobile"),
  website: varchar("website"),
  
  // Address
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  pincode: varchar("pincode"),
  
  // Financial information from CredHive
  paidUpCapital: numeric("paid_up_capital", { precision: 15, scale: 2 }),
  authorizedCapital: numeric("authorized_capital", { precision: 15, scale: 2 }),
  annualRevenue: numeric("annual_revenue", { precision: 15, scale: 2 }),
  netProfit: numeric("net_profit", { precision: 15, scale: 2 }),
  ebitda: numeric("ebitda", { precision: 15, scale: 2 }),
  totalAssets: numeric("total_assets", { precision: 15, scale: 2 }),
  
  // Financial metrics
  debtToEquityRatio: numeric("debt_to_equity_ratio", { precision: 10, scale: 2 }),
  currentRatio: numeric("current_ratio", { precision: 10, scale: 2 }),
  roe: numeric("roe", { precision: 10, scale: 2 }), // Return on Equity
  probe42Score: integer("probe42_score"), // 1-5 financial strength score
  
  // Classification
  industrySegment: varchar("industry_segment"),
  companyCategory: varchar("company_category"), // msme/large_enterprise/mid_market
  riskLevel: varchar("risk_level"), // low/medium/high
  
  // Directors information
  directors: jsonb("directors"), // Array of director details from CredHive
  authorizedSignatories: jsonb("authorized_signatories"),
  
  // Lead scoring
  leadScore: integer("lead_score").default(0), // 0-100 custom scoring
  leadQuality: varchar("lead_quality"), // hot/warm/cold
  investableSurplus: numeric("investable_surplus", { precision: 15, scale: 2 }), // Estimated investable cash
  
  // Status
  status: varchar("status").notNull().default("new"), // new/contacted/qualified/converted/rejected/on_hold
  assignedTo: varchar("assigned_to").references(() => users.id), // Agent/partner assigned
  
  // Source tracking
  source: varchar("source").notNull().default("credhive"), // credhive/manual/referral/import
  importBatchId: varchar("import_batch_id"), // Batch import tracking
  
  // Engagement
  lastContactedAt: timestamp("last_contacted_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  notes: text("notes"),
  
  // CredHive Enrichment Data
  employeeCount: integer("employee_count"), // From EPFO endpoint
  gstStatus: varchar("gst_status"), // Active/Cancelled/Suspended
  gstNumber: varchar("gst_number"), // GSTIN
  creditRating: varchar("credit_rating"), // e.g., AAA, AA+, BBB-
  creditRatingAgency: varchar("credit_rating_agency"), // CRISIL, ICRA, CARE, etc.
  creditRatingOutlook: varchar("credit_rating_outlook"), // Positive/Stable/Negative
  openChargesCount: integer("open_charges_count"), // Number of open charges/loans
  totalChargesAmount: numeric("total_charges_amount", { precision: 15, scale: 2 }), // Total loan amount
  chargeHolders: jsonb("charge_holders"), // Array of bank/institution names
  suitFiledCasesCount: integer("suit_filed_cases_count"), // Legal cases count
  activeLegalCases: integer("active_legal_cases"), // Active legal cases
  riskIndicators: jsonb("risk_indicators"), // Array of risk flags
  enrichmentScore: integer("enrichment_score"), // 0-100 data completeness
  enrichmentSources: jsonb("enrichment_sources"), // Array of API endpoints that returned data
  enrichmentData: jsonb("enrichment_data"), // Full raw enrichment data
  enrichedAt: timestamp("enriched_at"), // When enrichment was performed
  incorporationDate: varchar("incorporation_date"), // Date of incorporation
  companyType: varchar("company_type"), // Private/Public/LLP/OPC etc.
  companyClass: varchar("company_class"), // Company class from MCA
  
  // CredHive KYC Extended Fields
  sumOfCharges: numeric("sum_of_charges", { precision: 18, scale: 2 }), // Total charges/debt from KYC
  activeCompliance: varchar("active_compliance"), // ACTIVE compliant / Non-compliant
  listingStatus: varchar("listing_status"), // Listed / Unlisted
  entityType: varchar("entity_type"), // Public Limited Indian Non-Government Company etc.
  companyStatus: varchar("company_status"), // Active / Strike Off / Under Liquidation
  rocCode: varchar("roc_code"), // Registrar of Companies code
  numberOfMembers: integer("number_of_members"), // Number of company members
  lastAgmDate: varchar("last_agm_date"), // Last Annual General Meeting date
  lastBalanceSheetDate: varchar("last_balance_sheet_date"), // Last filed balance sheet date
  
  // Conversion
  convertedToUserId: varchar("converted_to_user_id").references(() => users.id),
  convertedAt: timestamp("converted_at"),

  // FintekPro Prospect Scoring Engine
  estimatedNetworth: numeric("estimated_networth", { precision: 18, scale: 2 }), // computed from directorship revenue multiples
  wealthScore: numeric("wealth_score", { precision: 6, scale: 2 }),             // 0-100 wealth component
  activityScore: numeric("activity_score", { precision: 6, scale: 2 }),         // 0-100 directorship activity component
  relationshipScore: numeric("relationship_score", { precision: 6, scale: 2 }), // 0-100 relationship strength (agent-set or default 50)
  compositeScore: numeric("composite_score", { precision: 6, scale: 2 }),       // 0-100 final blended score
  scoringVersion: varchar("scoring_version"),                                    // engine version label for auditability
  scoredAt: timestamp("scored_at"),                                              // when score was last computed

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_prospect_cin").on(table.cin),
  index("idx_prospect_company_name").on(table.companyName),
  index("idx_prospect_status").on(table.status),
  index("idx_prospect_score").on(table.leadScore),
  index("idx_prospect_composite_score").on(table.compositeScore),
  index("idx_prospect_assigned").on(table.assignedTo),
  index("idx_prospect_created").on(table.createdAt),
]);

export const leadActivities = pgTable("lead_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  leadId: varchar("lead_id").references(() => prospectLeads.id).notNull(),
  
  // Activity details
  activityType: varchar("activity_type").notNull(), // call/email/whatsapp/meeting/note/status_change
  subject: varchar("subject"),
  description: text("description"),
  
  // Outcome
  outcome: varchar("outcome"), // successful/no_response/callback_requested/not_interested
  nextAction: varchar("next_action"),
  nextActionDate: timestamp("next_action_date"),
  
  // Performed by
  performedBy: varchar("performed_by").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_lead_activity_lead").on(table.leadId),
  index("idx_lead_activity_type").on(table.activityType),
  index("idx_lead_activity_created").on(table.createdAt),
]);


export const prospectScoreHistory = pgTable("prospect_score_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  prospectId: varchar("prospect_id").references(() => prospectLeads.id, { onDelete: "cascade" }).notNull(),
  compositeScore: numeric("composite_score", { precision: 6, scale: 2 }),
  wealthScore: numeric("wealth_score", { precision: 6, scale: 2 }),
  activityScore: numeric("activity_score", { precision: 6, scale: 2 }),
  relationshipScore: numeric("relationship_score", { precision: 6, scale: 2 }),
  financialHealthScore: numeric("financial_health_score", { precision: 6, scale: 2 }),
  estimatedNetworth: numeric("estimated_networth", { precision: 18, scale: 2 }),
  investableSurplus: numeric("investable_surplus", { precision: 18, scale: 2 }),
  leadQualityBefore: varchar("lead_quality_before", { length: 20 }),
  leadQualityAfter: varchar("lead_quality_after", { length: 20 }),
  scoringVersion: varchar("scoring_version", { length: 20 }),
  triggeredBy: varchar("triggered_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_psh_prospect_id").on(table.prospectId),
  index("idx_psh_created_at").on(table.createdAt),
]);

// --- Insert Schemas & Types ---

// CRM Interactions
export const insertCrmInteractionSchema = createInsertSchema(crmInteractions as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CrmInteraction = typeof crmInteractions.$inferSelect;
export type InsertCrmInteraction = z.infer<typeof insertCrmInteractionSchema>;

// CRM Opportunities
export const insertCrmOpportunitySchema = createInsertSchema(crmOpportunities as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CrmOpportunity = typeof crmOpportunities.$inferSelect;
export type InsertCrmOpportunity = z.infer<typeof insertCrmOpportunitySchema>;

// CRM Tasks
export const insertCrmTaskSchema = createInsertSchema(crmTasks as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CrmTask = typeof crmTasks.$inferSelect;
export type InsertCrmTask = z.infer<typeof insertCrmTaskSchema>;

// CRM Client Tags
export const insertCrmClientTagSchema = createInsertSchema(crmClientTags as any).omit({
  id: true,
  createdAt: true,
});
export type CrmClientTag = typeof crmClientTags.$inferSelect;
export type InsertCrmClientTag = z.infer<typeof insertCrmClientTagSchema>;

// CRM Activity Log
export const insertCrmActivityLogSchema = createInsertSchema(crmActivityLog as any).omit({
  id: true,
  createdAt: true,
});
export type CrmActivityLog = typeof crmActivityLog.$inferSelect;
export type InsertCrmActivityLog = z.infer<typeof insertCrmActivityLogSchema>;

// Lead Activity Log
export const insertLeadActivityLogSchema = createInsertSchema(leadActivityLog as any).omit({
  id: true,
  createdAt: true,
});
export type LeadActivityLog = typeof leadActivityLog.$inferSelect;
export type InsertLeadActivityLog = z.infer<typeof insertLeadActivityLogSchema>;

// Lead Activities
export const insertLeadActivitySchema = createInsertSchema(leadActivities as any).omit({
  id: true,
  createdAt: true,
});
export type LeadActivity = typeof leadActivities.$inferSelect;
export type InsertLeadActivity = z.infer<typeof insertLeadActivitySchema>;

// Prospect Leads
export const insertProspectLeadSchema = createInsertSchema(prospectLeads as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ProspectLead = typeof prospectLeads.$inferSelect;
export type InsertProspectLead = z.infer<typeof insertProspectLeadSchema>;

// Prospect Score History
export const insertProspectScoreHistorySchema = createInsertSchema(prospectScoreHistory as any).omit({
  id: true,
  createdAt: true,
});
export type ProspectScoreHistory = typeof prospectScoreHistory.$inferSelect;
export type InsertProspectScoreHistory = z.infer<typeof insertProspectScoreHistorySchema>;

// --- Enums & Validation ---

export const CrmInteractionTypeEnum = z.enum(['call', 'email', 'meeting', 'note', 'whatsapp', 'sms']);
export const CrmOpportunityStageEnum = z.enum(['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']);
export const CrmTaskStatusEnum = z.enum(['pending', 'in_progress', 'completed', 'cancelled']);
export const CrmPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
