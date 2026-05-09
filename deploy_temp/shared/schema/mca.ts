import { sql } from "drizzle-orm";
import { boolean, date, decimal, index, integer, jsonb, numeric, pgTable, real, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from './users';
import { mutualFunds } from './mutual-funds';
import { User } from '../schema';

// --- Auto-Migrated Tables ---
export const mcaCompanyMaster = pgTable("mca_company_master", {
  cin: varchar("cin", { length: 21 }).primaryKey(),
  companyName: varchar("company_name", { length: 500 }).notNull(),
  companyStatus: varchar("company_status", { length: 50 }), // Active, Strike Off, etc.
  incorporationDate: date("incorporation_date"),
  registeredState: varchar("registered_state", { length: 100 }),
  registeredCity: varchar("registered_city", { length: 100 }),
  registeredAddress: text("registered_address"),
  companyCategory: varchar("company_category", { length: 100 }),
  companySubCategory: varchar("company_sub_category", { length: 100 }),
  companyClass: varchar("company_class", { length: 50 }),
  authorizedCapital: numeric("authorized_capital"),
  paidUpCapital: numeric("paid_up_capital"),
  lastFilingYear: varchar("last_filing_year", { length: 10 }),
  lastAnnualReturn: date("last_annual_return"),
  lastBalanceSheet: date("last_balance_sheet"),
  email: varchar("email", { length: 255 }),
  industry: varchar("industry", { length: 255 }),
  sourceAttribution: varchar("source_attribution", { length: 100 }).default("MCA V3 Public Filings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mca_company_name").on(table.companyName),
  index("idx_mca_company_status").on(table.companyStatus),
  index("idx_mca_registered_state").on(table.registeredState),
  index("idx_mca_last_filing_year").on(table.lastFilingYear),
]);

export const insertMcaCompanyMasterSchema = createInsertSchema(mcaCompanyMaster).extend({
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ createdAt: true, updatedAt: true });

export type McaCompanyMaster = typeof mcaCompanyMaster.$inferSelect;

export type InsertMcaCompanyMaster = z.infer<typeof insertMcaCompanyMasterSchema>;

export const mcaFinancialSnapshot = pgTable("mca_financial_snapshot", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cin: varchar("cin", { length: 21 }).references(() => mcaCompanyMaster.cin).notNull(),
  financialYear: varchar("financial_year", { length: 10 }).notNull(), // e.g., "2023-24"
  revenue: numeric("revenue"), // Revenue from operations
  profitBeforeTax: numeric("profit_before_tax"),
  profitAfterTax: numeric("profit_after_tax"),
  netWorth: numeric("net_worth"),
  totalAssets: numeric("total_assets"),
  totalLiabilities: numeric("total_liabilities"),
  shareCapital: numeric("share_capital"),
  reserves: numeric("reserves"),
  longTermBorrowing: numeric("long_term_borrowing"),
  shortTermBorrowing: numeric("short_term_borrowing"),
  source: varchar("source", { length: 50 }).default("MCA_AOC4_XBRL").notNull(),
  derivedAt: timestamp("derived_at").defaultNow().notNull(),
  derivedBy: varchar("derived_by", { length: 100 }), // User who triggered ingestion
  isVerified: boolean("is_verified").default(false),
  verifiedBy: varchar("verified_by", { length: 100 }),
  verifiedAt: timestamp("verified_at"),
  dataCompleteness: numeric("data_completeness").default("0"), // 0-100 percentage of fields populated
  notes: text("notes"),
}, (table) => [
  index("idx_mca_fs_cin").on(table.cin),
  index("idx_mca_fs_fy").on(table.financialYear),
  index("idx_mca_fs_pat").on(table.profitAfterTax),
  index("idx_mca_fs_revenue").on(table.revenue),
]);

export const insertMcaFinancialSnapshotSchema = createInsertSchema(mcaFinancialSnapshot).extend({
  id: z.any(),
  derivedAt: z.any(),
}).omit({ id: true, derivedAt: true });

export type McaFinancialSnapshot = typeof mcaFinancialSnapshot.$inferSelect;

export type InsertMcaFinancialSnapshot = z.infer<typeof insertMcaFinancialSnapshotSchema>;

export const mcaFilingTracker = pgTable("mca_filing_tracker", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cin: varchar("cin", { length: 21 }).notNull(),
  companyName: varchar("company_name", { length: 500 }),
  filingType: varchar("filing_type", { length: 50 }).notNull(), // AOC-4, XBRL, MGT-7, etc.
  filingYear: varchar("filing_year", { length: 10 }).notNull(),
  downloadedBy: varchar("downloaded_by", { length: 100 }).notNull(),
  downloadedByRole: varchar("downloaded_by_role", { length: 50 }), // Admin, Compliance, Ops
  downloadDate: timestamp("download_date").defaultNow().notNull(),
  walletCost: numeric("wallet_cost").default("0"),
  status: varchar("status", { length: 20 }).default("SUCCESS").notNull(), // SUCCESS, FAILED, PENDING
  failureReason: text("failure_reason"),
  documentUrl: varchar("document_url", { length: 500 }),
  fileSize: integer("file_size"),
  processingStatus: varchar("processing_status", { length: 30 }).default("PENDING"), // PENDING, PROCESSED, FAILED
  processedAt: timestamp("processed_at"),
}, (table) => [
  index("idx_mca_ft_cin").on(table.cin),
  index("idx_mca_ft_filing_year").on(table.filingYear),
  index("idx_mca_ft_downloaded_by").on(table.downloadedBy),
  index("idx_mca_ft_status").on(table.status),
  index("idx_mca_ft_download_date").on(table.downloadDate),
]);

export const insertMcaFilingTrackerSchema = createInsertSchema(mcaFilingTracker).extend({
  id: z.any(),
  downloadDate: z.any(),
}).omit({ id: true, downloadDate: true });

export type McaFilingTracker = typeof mcaFilingTracker.$inferSelect;

export type InsertMcaFilingTracker = z.infer<typeof insertMcaFilingTrackerSchema>;

export const mcaQueryLog = pgTable("mca_query_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  userName: varchar("user_name", { length: 255 }),
  userRole: varchar("user_role", { length: 50 }), // Admin, Compliance, Advisor, Ops
  queryType: varchar("query_type", { length: 100 }).notNull(), // company_lookup, profitable_filter, filing_check, etc.
  cin: varchar("cin", { length: 21 }),
  companyName: varchar("company_name", { length: 500 }),
  queryParameters: jsonb("query_parameters"), // Store all query params for audit
  actionTaken: varchar("action_taken", { length: 255 }), // Description of action
  responseSummary: text("response_summary"), // Brief summary of response
  resultCount: integer("result_count"), // Number of results returned
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mca_ql_user").on(table.userId),
  index("idx_mca_ql_query_type").on(table.queryType),
  index("idx_mca_ql_cin").on(table.cin),
  index("idx_mca_ql_created").on(table.createdAt),
]);

export const insertMcaQueryLogSchema = createInsertSchema(mcaQueryLog).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export type McaQueryLog = typeof mcaQueryLog.$inferSelect;

export type InsertMcaQueryLog = z.infer<typeof insertMcaQueryLogSchema>;

export const mcaWalletStatus = pgTable("mca_wallet_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  currentBalance: numeric("current_balance").default("0").notNull(),
  lastRechargeAmount: numeric("last_recharge_amount"),
  lastRechargeDate: timestamp("last_recharge_date"),
  totalSpentThisMonth: numeric("total_spent_this_month").default("0"),
  totalSpentAllTime: numeric("total_spent_all_time").default("0"),
  monthlyBudget: numeric("monthly_budget"),
  alertThreshold: numeric("alert_threshold").default("1000"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const insertMcaWalletStatusSchema = createInsertSchema(mcaWalletStatus).extend({
  id: z.any(),
  lastUpdated: z.any(),
}).omit({ id: true, lastUpdated: true });

export type McaWalletStatus = typeof mcaWalletStatus.$inferSelect;

export type InsertMcaWalletStatus = z.infer<typeof insertMcaWalletStatusSchema>;

export const mcaWalletPayments = pgTable("mca_wallet_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id", { length: 100 }).notNull().unique(),
  paymentSessionId: varchar("payment_session_id", { length: 255 }),
  amount: numeric("amount").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, success, failed
  initiatedBy: varchar("initiated_by", { length: 255 }).notNull(), // user email
  initiatedByUserId: varchar("initiated_by_user_id", { length: 255 }),
  paymentUrl: text("payment_url"),
  returnUrl: text("return_url"),
  transactionId: varchar("transaction_id", { length: 255 }),
  paymentMethod: varchar("payment_method", { length: 50 }),
  failureReason: text("failure_reason"),
  creditedAt: timestamp("credited_at"),
  zohoExpenseId: varchar("zoho_expense_id", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mca_wp_order").on(table.orderId),
  index("idx_mca_wp_status").on(table.status),
  index("idx_mca_wp_user").on(table.initiatedBy),
]);

export const insertMcaWalletPaymentSchema = createInsertSchema(mcaWalletPayments).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const mcaDirectPayments = pgTable("mca_direct_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cin: varchar("cin", { length: 21 }).notNull(),
  companyName: varchar("company_name", { length: 500 }),
  feeType: varchar("fee_type", { length: 100 }).notNull(),
  filingYear: varchar("filing_year", { length: 10 }),
  amount: numeric("amount").notNull(),
  currency: varchar("currency", { length: 3 }).default("INR").notNull(),
  status: varchar("status", { length: 30 }).default("initiated").notNull(),
  mcaChallanNumber: varchar("mca_challan_number", { length: 100 }),
  mcaTransactionId: varchar("mca_transaction_id", { length: 100 }),
  mcaPaymentDate: date("mca_payment_date"),
  mcaReceiptUrl: text("mca_receipt_url"),
  paymentMode: varchar("payment_mode", { length: 50 }),
  bankName: varchar("bank_name", { length: 100 }),
  initiatedBy: varchar("initiated_by", { length: 255 }).notNull(),
  initiatedByUserId: varchar("initiated_by_user_id", { length: 255 }),
  confirmedBy: varchar("confirmed_by", { length: 255 }),
  confirmedAt: timestamp("confirmed_at"),
  zohoExpenseId: varchar("zoho_expense_id", { length: 100 }),
  zohoSyncStatus: varchar("zoho_sync_status", { length: 30 }).default("pending"),
  zohoSyncError: text("zoho_sync_error"),
  zohoSyncedAt: timestamp("zoho_synced_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mca_dp_cin").on(table.cin),
  index("idx_mca_dp_status").on(table.status),
  index("idx_mca_dp_fee_type").on(table.feeType),
  index("idx_mca_dp_challan").on(table.mcaChallanNumber),
  index("idx_mca_dp_zoho_status").on(table.zohoSyncStatus),
  index("idx_mca_dp_initiated_by").on(table.initiatedBy),
]);

export const insertMcaDirectPaymentSchema = createInsertSchema(mcaDirectPayments).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const mcaDataSources = pgTable("mca_data_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceName: varchar("source_name", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 200 }).notNull(),
  formTypes: jsonb("form_types").default([]),
  refreshCycle: varchar("refresh_cycle", { length: 50 }).default("daily"),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  priority: integer("priority").default(1).notNull(),
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  authType: varchar("auth_type", { length: 50 }),
  rateLimitPerMinute: integer("rate_limit_per_minute").default(60),
  costPerQuery: numeric("cost_per_query").default("0"),
  lastSyncAt: timestamp("last_sync_at"),
  status: varchar("status", { length: 30 }).default("active"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMcaDataSourcesSchema = createInsertSchema(mcaDataSources).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const mcaDirectors = pgTable("mca_directors", {
  din: varchar("din", { length: 20 }).primaryKey(),
  name: varchar("name", { length: 500 }).notNull(),
  designation: varchar("designation", { length: 100 }),
  nationality: varchar("nationality", { length: 100 }),
  dateOfBirth: date("date_of_birth"),
  fatherName: varchar("father_name", { length: 500 }),
  address: text("address"),
  email: varchar("email", { length: 255 }),
  pan: varchar("pan", { length: 15 }),
  totalAppointments: integer("total_appointments").default(0),
  activeAppointments: integer("active_appointments").default(0),
  dinStatus: varchar("din_status", { length: 50 }).default("active"),
  disqualificationDate: date("disqualification_date"),
  disqualificationReason: text("disqualification_reason"),
  sourceAttribution: varchar("source_attribution", { length: 100 }).default("MCA Public Data"),
  dataLastRefreshed: timestamp("data_last_refreshed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mca_directors_name").on(table.name),
  index("idx_mca_directors_status").on(table.dinStatus),
]);

export const insertMcaDirectorsSchema = createInsertSchema(mcaDirectors).extend({
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ createdAt: true, updatedAt: true });

export const mcaDirectorCompanyMap = pgTable("mca_director_company_map", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  din: varchar("din", { length: 20 }).references(() => mcaDirectors.din).notNull(),
  cin: varchar("cin", { length: 21 }).references(() => mcaCompanyMaster.cin).notNull(),
  designation: varchar("designation", { length: 100 }).notNull(),
  appointmentDate: date("appointment_date"),
  cessationDate: date("cessation_date"),
  isCurrentlyActive: boolean("is_currently_active").default(true),
  shareholding: numeric("shareholding"),
  remuneration: numeric("remuneration"),
  isIndependent: boolean("is_independent").default(false),
  isExecutive: boolean("is_executive").default(false),
  sourceDocument: varchar("source_document", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mca_dcm_din").on(table.din),
  index("idx_mca_dcm_cin").on(table.cin),
  index("idx_mca_dcm_active").on(table.isCurrentlyActive),
]);

export const insertMcaDirectorCompanyMapSchema = createInsertSchema(mcaDirectorCompanyMap).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type McaDirectorCompanyMap = typeof mcaDirectorCompanyMap.$inferSelect;

export type InsertMcaDirectorCompanyMap = z.infer<typeof insertMcaDirectorCompanyMapSchema>;

export const mcaCharges = pgTable("mca_charges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cin: varchar("cin", { length: 21 }).references(() => mcaCompanyMaster.cin).notNull(),
  chargeId: varchar("charge_id", { length: 50 }).notNull(),
  chargeHolder: varchar("charge_holder", { length: 500 }).notNull(),
  chargeHolderType: varchar("charge_holder_type", { length: 100 }),
  chargeAmount: numeric("charge_amount"),
  chargeType: varchar("charge_type", { length: 100 }),
  creationDate: date("creation_date").notNull(),
  modificationDate: date("modification_date"),
  satisfactionDate: date("satisfaction_date"),
  status: varchar("status", { length: 50 }).default("active"),
  assetDescription: text("asset_description"),
  documentNumber: varchar("document_number", { length: 100 }),
  filingDate: date("filing_date"),
  daysOverdue: integer("days_overdue").default(0),
  sourceDocument: varchar("source_document", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mca_charges_cin").on(table.cin),
  index("idx_mca_charges_status").on(table.status),
  index("idx_mca_charges_holder").on(table.chargeHolder),
  index("idx_mca_charges_creation").on(table.creationDate),
]);

export const insertMcaChargesSchema = createInsertSchema(mcaCharges).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const mcaShareholdingPattern = pgTable("mca_shareholding_pattern", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cin: varchar("cin", { length: 21 }).references(() => mcaCompanyMaster.cin).notNull(),
  reportingDate: date("reporting_date").notNull(),
  financialYear: varchar("financial_year", { length: 10 }).notNull(),
  quarter: varchar("quarter", { length: 5 }),
  promoterIndividual: numeric("promoter_individual").default("0"),
  promoterBodies: numeric("promoter_bodies").default("0"),
  promoterTotal: numeric("promoter_total").default("0"),
  publicInstitutional: numeric("public_institutional").default("0"),
  publicNonInstitutional: numeric("public_non_institutional").default("0"),
  publicTotal: numeric("public_total").default("0"),
  mutualFunds: numeric("mutual_funds").default("0"),
  fiisFpis: numeric("fiis_fpis").default("0"),
  insuranceCompanies: numeric("insurance_companies").default("0"),
  banks: numeric("banks").default("0"),
  aifsPms: numeric("aifs_pms").default("0"),
  nbfcs: numeric("nbfcs").default("0"),
  employees: numeric("employees").default("0"),
  retailIndividuals: numeric("retail_individuals").default("0"),
  hni: numeric("hni").default("0"),
  trusts: numeric("trusts").default("0"),
  totalShareCapital: numeric("total_share_capital"),
  totalShares: numeric("total_shares"),
  pledgedShares: numeric("pledged_shares").default("0"),
  pledgedPercentage: numeric("pledged_percentage").default("0"),
  sourceDocument: varchar("source_document", { length: 100 }),
  isLatest: boolean("is_latest").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mca_shp_cin").on(table.cin),
  index("idx_mca_shp_date").on(table.reportingDate),
  index("idx_mca_shp_fy").on(table.financialYear),
  index("idx_mca_shp_latest").on(table.isLatest),
]);

export const insertMcaShareholdingPatternSchema = createInsertSchema(mcaShareholdingPattern).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type McaShareholdingPattern = typeof mcaShareholdingPattern.$inferSelect;

export type InsertMcaShareholdingPattern = z.infer<typeof insertMcaShareholdingPatternSchema>;

export const mcaDerivedMetrics = pgTable("mca_derived_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cin: varchar("cin", { length: 21 }).references(() => mcaCompanyMaster.cin).notNull(),
  financialYear: varchar("financial_year", { length: 10 }).notNull(),
  revenueGrowthYoy: numeric("revenue_growth_yoy"),
  patGrowthYoy: numeric("pat_growth_yoy"),
  netWorthGrowthYoy: numeric("net_worth_growth_yoy"),
  assetGrowthYoy: numeric("asset_growth_yoy"),
  patMargin: numeric("pat_margin"),
  ebitdaMargin: numeric("ebitda_margin"),
  grossMargin: numeric("gross_margin"),
  operatingMargin: numeric("operating_margin"),
  returnOnEquity: numeric("return_on_equity"),
  returnOnAssets: numeric("return_on_assets"),
  returnOnCapitalEmployed: numeric("return_on_capital_employed"),
  debtToEquity: numeric("debt_to_equity"),
  debtToAssets: numeric("debt_to_assets"),
  interestCoverageRatio: numeric("interest_coverage_ratio"),
  currentRatio: numeric("current_ratio"),
  quickRatio: numeric("quick_ratio"),
  cashRatio: numeric("cash_ratio"),
  assetTurnover: numeric("asset_turnover"),
  inventoryTurnover: numeric("inventory_turnover"),
  receivablesTurnover: numeric("receivables_turnover"),
  revenueTrend: varchar("revenue_trend", { length: 20 }),
  profitTrend: varchar("profit_trend", { length: 20 }),
  debtTrend: varchar("debt_trend", { length: 20 }),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  dataCompleteness: numeric("data_completeness").default("0"),
  notes: text("notes"),
}, (table) => [
  index("idx_mca_dm_cin").on(table.cin),
  index("idx_mca_dm_fy").on(table.financialYear),
  index("idx_mca_dm_roe").on(table.returnOnEquity),
]);

export const insertMcaDerivedMetricsSchema = createInsertSchema(mcaDerivedMetrics).extend({
  id: z.any(),
  computedAt: z.any(),
}).omit({ id: true, computedAt: true });

export type McaDerivedMetrics = typeof mcaDerivedMetrics.$inferSelect;

export type InsertMcaDerivedMetrics = z.infer<typeof insertMcaDerivedMetricsSchema>;

export const mcaRiskScores = pgTable("mca_risk_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cin: varchar("cin", { length: 21 }).references(() => mcaCompanyMaster.cin).notNull(),
  assessmentDate: date("assessment_date").notNull(),
  profitConsistencyScore: integer("profit_consistency_score"),
  leverageRiskScore: integer("leverage_risk_score"),
  complianceFreshnessScore: integer("compliance_freshness_score"),
  chargesRiskScore: integer("charges_risk_score"),
  ownershipRiskScore: integer("ownership_risk_score"),
  governanceRiskScore: integer("governance_risk_score"),
  overallRiskScore: integer("overall_risk_score").notNull(),
  riskGrade: varchar("risk_grade", { length: 20 }).notNull(),
  scoreBreakdown: jsonb("score_breakdown").default({}),
  riskFactors: jsonb("risk_factors").default([]),
  recommendations: text("recommendations"),
  watchlistFlags: jsonb("watchlist_flags").default([]),
  computedBy: varchar("computed_by", { length: 100 }),
  methodology: varchar("methodology", { length: 50 }).default("v1"),
  isLatest: boolean("is_latest").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mca_rs_cin").on(table.cin),
  index("idx_mca_rs_date").on(table.assessmentDate),
  index("idx_mca_rs_grade").on(table.riskGrade),
  index("idx_mca_rs_overall").on(table.overallRiskScore),
  index("idx_mca_rs_latest").on(table.isLatest),
]);

export const insertMcaRiskScoresSchema = createInsertSchema(mcaRiskScores).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export const mcaIngestionLogs = pgTable("mca_ingestion_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id", { length: 100 }).notNull(),
  sourceId: varchar("source_id"),
  sourceName: varchar("source_name", { length: 100 }).notNull(),
  operationType: varchar("operation_type", { length: 50 }).notNull(),
  targetCins: jsonb("target_cins").default([]),
  formTypes: jsonb("form_types").default([]),
  status: varchar("status", { length: 30 }).default("running"),
  totalRecords: integer("total_records").default(0),
  processedRecords: integer("processed_records").default(0),
  failedRecords: integer("failed_records").default(0),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  errorMessages: jsonb("error_messages").default([]),
  retryCount: integer("retry_count").default(0),
  apiCallsMade: integer("api_calls_made").default(0),
  walletCost: numeric("wallet_cost").default("0"),
  triggeredBy: varchar("triggered_by", { length: 100 }),
  metadata: jsonb("metadata").default({}),
}, (table) => [
  index("idx_mca_il_run").on(table.runId),
  index("idx_mca_il_source").on(table.sourceName),
  index("idx_mca_il_status").on(table.status),
  index("idx_mca_il_started").on(table.startedAt),
]);

export const insertMcaIngestionLogsSchema = createInsertSchema(mcaIngestionLogs).extend({
  id: z.any(),
  startedAt: z.any(),
}).omit({ id: true, startedAt: true });

export const mcaVersionHistory = pgTable("mca_version_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }).notNull(),
  changeType: varchar("change_type", { length: 30 }).notNull(),
  previousData: jsonb("previous_data"),
  newData: jsonb("new_data"),
  changedFields: jsonb("changed_fields").default([]),
  sourceDocument: varchar("source_document", { length: 100 }),
  sourceFilingDate: date("source_filing_date"),
  ingestionRunId: varchar("ingestion_run_id", { length: 100 }),
  changedBy: varchar("changed_by", { length: 100 }),
  changeReason: text("change_reason"),
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mca_vh_entity").on(table.entityType, table.entityId),
  index("idx_mca_vh_change").on(table.changeType),
  index("idx_mca_vh_created").on(table.createdAt),
]);

export const insertMcaVersionHistorySchema = createInsertSchema(mcaVersionHistory).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export type McaVersionHistory = typeof mcaVersionHistory.$inferSelect;

export type InsertMcaVersionHistory = z.infer<typeof insertMcaVersionHistorySchema>;
