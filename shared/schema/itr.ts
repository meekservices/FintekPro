import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal, date, serial, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { agents, itrPricingConfig, insertItrPricingConfigSchema } from './agents';
import { users } from './users';

// --- Auto-Migrated Tables ---
export const itrPrefilledForms = pgTable("itr_prefilled_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  assessmentYear: varchar("assessment_year").notNull(), // '2025-26'
  financialYear: varchar("financial_year").notNull(), // '2024-25'
  
  // ITR Form Information
  itrForm: varchar("itr_form").notNull(), // 'ITR-1' | 'ITR-2' | 'ITR-3' | 'ITR-4'
  autoSelectedForm: boolean("auto_selected_form").default(true),
  formSelectionReason: text("form_selection_reason"),
  taxRegime: varchar("tax_regime").default("new"), // 'old' | 'new'
  
  // Data Sources Integration Status
  form26AsIntegrated: boolean("form_26as_integrated").default(false),
  aisIntegrated: boolean("ais_integrated").default(false),
  camsIntegrated: boolean("cams_integrated").default(false),
  kfintechIntegrated: boolean("kfintech_integrated").default(false),
  nsdlIntegrated: boolean("nsdl_integrated").default(false),
  cdslIntegrated: boolean("cdsl_integrated").default(false),
  form16Integrated: boolean("form_16_integrated").default(false),
  
  // Pre-filled Data Sections
  personalInfo: jsonb("personal_info"), // Name, PAN, address, etc.
  incomeFromSalary: jsonb("income_from_salary"), // Salary income details
  incomeFromHouseProperty: jsonb("income_from_house_property"),
  incomeFromCapitalGains: jsonb("income_from_capital_gains"), // STCG, LTCG breakdown
  incomeFromOtherSources: jsonb("income_from_other_sources"), // Interest, dividend, etc.
  incomeFromBusinessProfession: jsonb("income_from_business_profession"),
  
  // Deductions (80C, 80D, etc.)
  deductionsChapter6A: jsonb("deductions_chapter_6a"),
  
  // Tax Computation
  taxComputation: jsonb("tax_computation"), // Detailed tax calculation
  tdsDetails: jsonb("tds_details"), // TDS from Form 26AS
  advanceTaxDetails: jsonb("advance_tax_details"),
  
  // Schedule-wise Data
  scheduleCG: jsonb("schedule_cg"), // Capital Gains schedule
  scheduleOS: jsonb("schedule_os"), // Other Sources schedule
  scheduleVDA: jsonb("schedule_vda"), // Virtual Digital Assets
  scheduleFSI: jsonb("schedule_fsi"), // Foreign Source Income
  
  // Validation and Completion Status
  completionPercentage: integer("completion_percentage").default(0),
  validationStatus: varchar("validation_status").default("pending"), // 'pending' | 'validated' | 'errors'
  validationErrors: jsonb("validation_errors").default([]),
  dataConflicts: jsonb("data_conflicts").default([]), // Conflicts between sources
  
  // Smart Suggestions
  taxOptimizationSuggestions: jsonb("tax_optimization_suggestions"),
  misssingDataAlerts: jsonb("missing_data_alerts"),
  complianceWarnings: jsonb("compliance_warnings"),
  
  // Filing Status
  readyForFiling: boolean("ready_for_filing").default(false),
  filingStatus: varchar("filing_status").default("draft"), // 'draft' | 'reviewed' | 'filed'
  filedAt: timestamp("filed_at"),
  acknowledgmentNumber: varchar("acknowledgment_number"),
  
  // Export and Integration
  itrJsonGenerated: boolean("itr_json_generated").default(false),
  itrJsonData: jsonb("itr_json_data"), // Complete ITR JSON for filing
  itrPdfUrl: text("itr_pdf_url"),
  xmlUploadReady: boolean("xml_upload_ready").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastDataSync: timestamp("last_data_sync"),
});

export const itrDataSourcesSync = pgTable("itr_data_sources_sync", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itrFormId: varchar("itr_form_id").references(() => itrPrefilledForms.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Source Information
  dataSource: varchar("data_source").notNull(), // 'cams' | 'kfintech' | 'nsdl' | 'cdsl' | 'form26as' | 'ais' | 'form16'
  syncStatus: varchar("sync_status").default("pending"), // 'pending' | 'syncing' | 'completed' | 'failed' | 'partial'
  
  // Sync Statistics
  recordsProcessed: integer("records_processed").default(0),
  recordsSuccessful: integer("records_successful").default(0),
  recordsFailed: integer("records_failed").default(0),
  
  // Data Details
  dataCategories: jsonb("data_categories"), // Array of data types synced
  syncedData: jsonb("synced_data"), // Summary of synced data
  errorDetails: jsonb("error_details"), // Sync errors if any
  
  // Timing
  syncStartedAt: timestamp("sync_started_at"),
  syncCompletedAt: timestamp("sync_completed_at"),
  nextSyncScheduled: timestamp("next_sync_scheduled"),
  
  // Metadata
  apiResponse: jsonb("api_response"), // Raw API response for debugging
  syncTrigger: varchar("sync_trigger").default("manual"), // 'manual' | 'auto' | 'scheduled'
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertItrDataSourcesSyncSchema = createInsertSchema(itrDataSourcesSync).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

export type ItrDataSourcesSync = typeof itrDataSourcesSync.$inferSelect;

export type InsertItrPricingConfig = z.infer<typeof insertItrPricingConfigSchema>;

// Tax Sessions for tracking the wizard progress
export const taxSessions = pgTable("tax_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // Assessment info
  assessmentYear: varchar("assessment_year").notNull(),
  financialYear: varchar("financial_year").notNull(),
  
  // Workflow State
  status: varchar("status").default("created").notNull(), // created | aggregating | prefilled | validated | optimized | generated | filed
  currentStep: integer("current_step").default(1), // 1-6 for wizard steps
  
  // AI Suggestions
  suggestedItrForm: varchar("suggested_itr_form"), // ITR-1, ITR-2, etc.
  suggestedTaxRegime: varchar("suggested_tax_regime").default("new"), // old | new
  autoSelectionReason: text("auto_selection_reason"), // AI explanation for suggestions
  
  // Progress Metrics
  completionPercentage: integer("completion_percentage").default(0),
  dataSourcesConnected: integer("data_sources_connected").default(0),
  validationIssuesCount: integer("validation_issues_count").default(0),
  
  // Timing
  aggregationStartedAt: timestamp("aggregation_started_at"),
  aggregationCompletedAt: timestamp("aggregation_completed_at"),
  validationCompletedAt: timestamp("validation_completed_at"),
  filingCompletedAt: timestamp("filing_completed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tax Data Sources for tracking connection and sync status
export const taxDataSources = pgTable("tax_data_sources", {
  id: varchar("id").primaryKey(),
  sessionId: varchar("session_id").references(() => taxSessions.id).notNull(),
  name: varchar("name").notNull(), // Form 26AS, AIS, CAMS, NSDL, etc.
  status: varchar("status").default("disconnected").notNull(), // connected | disconnected | syncing | error
  
  // Data Metrics
  lastSync: timestamp("last_sync"),
  recordsCount: integer("records_count").default(0),
  dataTypes: jsonb("data_types").default([]), // ['TDS', 'salary', 'capital_gains']
  
  // Sync Information
  syncDuration: integer("sync_duration"), // milliseconds
  errorMessage: text("error_message"),
  apiEndpoint: varchar("api_endpoint"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Validation Issues for structured error reporting
export const validationIssues = pgTable("validation_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => taxSessions.id).notNull(),
  
  // Issue Classification
  section: varchar("section").notNull(), // income, deductions, personal_info, etc.
  field: varchar("field"), // specific field name
  severity: varchar("severity").notNull(), // error | warning | suggestion
  
  // content
  message: text("message").notNull(),
  details: text("details"),
  suggestedAction: text("suggested_action"),
  
  // Resolution tracking
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTaxSessionSchema = createInsertSchema(taxSessions).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type TaxSession = typeof taxSessions.$inferSelect;
export type InsertTaxSession = z.infer<typeof insertTaxSessionSchema>;

export const insertTaxDataSourceSchema = createInsertSchema(taxDataSources).extend({
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  createdAt: true,
  updatedAt: true,
});
export type TaxDataSource = typeof taxDataSources.$inferSelect;
export type InsertTaxDataSource = z.infer<typeof insertTaxDataSourceSchema>;

export const insertValidationIssueSchema = createInsertSchema(validationIssues).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});
export type ValidationIssue = typeof validationIssues.$inferSelect;
export type InsertValidationIssue = z.infer<typeof insertValidationIssueSchema>;

// Filing Records for tracking ITR submission status
export const filingRecords = pgTable("filing_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => taxSessions.id).notNull(),
  
  // Filing Information
  acknowledgmentNumber: varchar("acknowledgment_number").unique(),
  receiptNumber: varchar("receipt_number"),
  filingDate: timestamp("filing_date").notNull(),
  
  // Tax Details
  itrForm: varchar("itr_form").notNull(),
  taxRegime: varchar("tax_regime").notNull(),
  totalIncome: decimal("total_income", { precision: 15, scale: 2 }),
  taxLiability: decimal("tax_liability", { precision: 15, scale: 2 }),
  refundAmount: decimal("refund_amount", { precision: 15, scale: 2 }),
  taxPayable: decimal("tax_payable", { precision: 15, scale: 2 }),
  
  // Filing Status
  status: varchar("status").default("filed").notNull(), // filed | processing | verified | failed | defective
  verificationDate: timestamp("verification_date"),
  
  // Documents
  itrJsonUrl: text("itr_json_url"),
  itrPdfUrl: text("itr_pdf_url"),
  itrVUrl: text("itr_v_url"), // ITR-V acknowledgment
  
  // Processing
  processingErrors: jsonb("processing_errors").default([]),
  apiResponse: jsonb("api_response"), // Raw response from filing API
  
  // Zoho Books Sync
  zohoSyncedAt: timestamp("zoho_synced_at"),
  zohoInvoiceId: varchar("zoho_invoice_id"),
  zohoSyncStatus: varchar("zoho_sync_status"), // pending, synced, failed
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFilingRecordSchema = createInsertSchema(filingRecords).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FilingRecord = typeof filingRecords.$inferSelect;
export type InsertFilingRecord = z.infer<typeof insertFilingRecordSchema>;
