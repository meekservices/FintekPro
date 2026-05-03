import { sql } from "drizzle-orm";
import { boolean, date, decimal, index, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { users, userBankAccounts } from "./users";
import { portfolios } from "./portfolio";

export const mfFolios = pgTable("mf_folios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  folioNumber: varchar("folio_number").notNull(),
  amcCode: varchar("amc_code").notNull(),
  amcName: varchar("amc_name").notNull(),
  holderName: varchar("holder_name").notNull(),
  holderPan: varchar("holder_pan"),
  jointHolder1Name: varchar("joint_holder1_name"),
  jointHolder2Name: varchar("joint_holder2_name"),
  holdingMode: varchar("holding_mode").default("single"),
  bankAccountId: varchar("bank_account_id").references(() => userBankAccounts.id),
  bankAccountNumber: varchar("bank_account_number"),
  bankIfsc: varchar("bank_ifsc"),
  bankName: varchar("bank_name"),
  kycStatus: varchar("kyc_status").default("pending"),
  fatcaStatus: varchar("fatca_status").default("pending"),
  nomineeRegistered: boolean("nominee_registered").default(false),
  dataSource: varchar("data_source").default("manual"),
  sourceReference: varchar("source_reference"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_mf_folios_user").on(table.userId),
  index("idx_mf_folios_number").on(table.folioNumber),
  index("idx_mf_folios_amc").on(table.amcCode),
]);

export const mfHoldings = pgTable("mf_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  folioId: varchar("folio_id").notNull().references(() => mfFolios.id),
  schemeCode: varchar("scheme_code").notNull(),
  schemeName: varchar("scheme_name").notNull(),
  isin: varchar("isin"),
  planType: varchar("plan_type").default("regular"),
  optionType: varchar("option_type"),
  units: decimal("units", { precision: 15, scale: 4 }).notNull(),
  avgNav: decimal("avg_nav", { precision: 12, scale: 4 }),
  currentNav: decimal("current_nav", { precision: 12, scale: 4 }),
  navDate: date("nav_date"),
  investedValue: decimal("invested_value", { precision: 15, scale: 2 }),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  firstPurchaseDate: date("first_purchase_date"),
  lockInEndDate: date("lock_in_end_date"),
  exitLoadApplicable: boolean("exit_load_applicable").default(false),
  exitLoadPercent: decimal("exit_load_percent", { precision: 5, scale: 2 }),
  exitLoadEndDate: date("exit_load_end_date"),
  pledgeStatus: varchar("pledge_status").default("none"),
  pledgedUnits: decimal("pledged_units", { precision: 15, scale: 4 }),
  pledgeReference: varchar("pledge_reference"),
  lastTransactionDate: date("last_transaction_date"),
  lastTransactionType: varchar("last_transaction_type"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_mf_holdings_user").on(table.userId),
  index("idx_mf_holdings_folio").on(table.folioId),
  index("idx_mf_holdings_scheme").on(table.schemeCode),
]);

export const bankMandates = pgTable("bank_mandates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bankAccountId: varchar("bank_account_id").references(() => userBankAccounts.id),
  umrn: varchar("umrn"),
  mandateType: varchar("mandate_type").notNull(),
  bankAccountNumber: varchar("bank_account_number").notNull(),
  bankIfsc: varchar("bank_ifsc").notNull(),
  bankName: varchar("bank_name"),
  accountHolderName: varchar("account_holder_name"),
  maxAmount: decimal("max_amount", { precision: 15, scale: 2 }).notNull(),
  frequency: varchar("frequency").default("monthly"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  status: varchar("status").default("pending"),
  verificationReference: varchar("verification_reference"),
  verifiedAt: timestamp("verified_at"),
  purpose: varchar("purpose").default("mutual_fund_sip"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bank_mandates_user").on(table.userId),
  index("idx_bank_mandates_status").on(table.status),
  index("idx_bank_mandates_umrn").on(table.umrn),
]);

export const mfOrders = pgTable("mf_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderReference: varchar("order_reference").notNull().unique(),
  userId: varchar("user_id").notNull().references(() => users.id),
  advisorId: varchar("advisor_id").references(() => users.id),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  folioId: varchar("folio_id").references(() => mfFolios.id),
  schemeCode: varchar("scheme_code").notNull(),
  schemeName: varchar("scheme_name").notNull(),
  isin: varchar("isin"),
  planType: varchar("plan_type").default("regular"),
  orderType: varchar("order_type").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  units: decimal("units", { precision: 15, scale: 4 }),
  allUnits: boolean("all_units").default(false),
  sipAmount: decimal("sip_amount", { precision: 15, scale: 2 }),
  sipFrequency: varchar("sip_frequency"),
  sipStartDate: date("sip_start_date"),
  sipEndDate: date("sip_end_date"),
  sipInstallments: integer("sip_installments"),
  mandateId: varchar("mandate_id").references(() => bankMandates.id),
  paymentMethod: varchar("payment_method"),
  paymentReference: varchar("payment_reference"),
  paymentStatus: varchar("payment_status").default("pending"),
  paymentCompletedAt: timestamp("payment_completed_at"),
  navDate: date("nav_date"),
  navApplied: decimal("nav_applied", { precision: 12, scale: 4 }),
  unitsAllotted: decimal("units_allotted", { precision: 15, scale: 4 }),
  payoutBankId: varchar("payout_bank_id").references(() => userBankAccounts.id),
  payoutAmount: decimal("payout_amount", { precision: 15, scale: 2 }),
  exitLoadApplied: decimal("exit_load_applied", { precision: 15, scale: 2 }),
  tdsApplied: decimal("tds_applied", { precision: 15, scale: 2 }),
  settlementDate: date("settlement_date"),
  settlementReference: varchar("settlement_reference"),
  status: varchar("status").default("created"),
  statusMessage: text("status_message"),
  rtaReference: varchar("rta_reference"),
  amcReference: varchar("amc_reference"),
  bseOrderId: varchar("bse_order_id"),
  complianceFlags: jsonb("compliance_flags").default({}),
  suitabilityAckRequired: boolean("suitability_ack_required").default(false),
  suitabilityAckProvided: boolean("suitability_ack_provided").default(false),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }),
  transactionCharges: decimal("transaction_charges", { precision: 10, scale: 2 }),
  gst: decimal("gst", { precision: 10, scale: 2 }),
  stampDuty: decimal("stamp_duty", { precision: 10, scale: 2 }),
  initiatedBy: varchar("initiated_by").references(() => users.id),
  initiatedByRole: varchar("initiated_by_role"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  purchaseDate: date("purchase_date"),
  purchaseNav: decimal("purchase_nav", { precision: 12, scale: 4 }),
  purchaseValue: decimal("purchase_value", { precision: 15, scale: 2 }),
  saleValue: decimal("sale_value", { precision: 15, scale: 2 }),
  realizedGain: decimal("realized_gain", { precision: 15, scale: 2 }),
  gainType: varchar("gain_type"),
  holdingPeriodDays: integer("holding_period_days"),
  grandfatheredValue: decimal("grandfathered_value", { precision: 15, scale: 2 }),
  indexedCost: decimal("indexed_cost", { precision: 15, scale: 2 }),
  taxableGain: decimal("taxable_gain", { precision: 15, scale: 2 }),
  estimatedTax: decimal("estimated_tax", { precision: 15, scale: 2 }),
  fiscalYear: varchar("fiscal_year"),
  zohoSyncedAt: timestamp("zoho_synced_at"),
  zohoSyncStatus: varchar("zoho_sync_status", { length: 50 }),
  placedAt: timestamp("placed_at"),
  confirmedAt: timestamp("confirmed_at"),
  settledAt: timestamp("settled_at"),
  reconciledAt: timestamp("reconciled_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_mf_orders_user").on(table.userId),
  index("idx_mf_orders_status").on(table.status),
  index("idx_mf_orders_scheme").on(table.schemeCode),
  index("idx_mf_orders_reference").on(table.orderReference),
  index("idx_mf_orders_created").on(table.createdAt),
  index("idx_mf_orders_fiscal_year").on(table.fiscalYear),
  index("idx_mf_orders_gain_type").on(table.gainType),
]);

export const mfOrderAuditLog = pgTable("mf_order_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => mfOrders.id),
  actorId: varchar("actor_id").references(() => users.id),
  actorRole: varchar("actor_role").notNull(),
  action: varchar("action").notNull(),
  oldStatus: varchar("old_status"),
  newStatus: varchar("new_status"),
  remarks: text("remarks"),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const suitabilityAcknowledgements = pgTable("suitability_acknowledgements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => mfOrders.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  advisorId: varchar("advisor_id").references(() => users.id),
  clientRiskProfile: varchar("client_risk_profile").notNull(),
  schemeRiskLevel: varchar("scheme_risk_level").notNull(),
  riskMismatch: boolean("risk_mismatch").default(true),
  acknowledgementText: text("acknowledgement_text").notNull(),
  signatureType: varchar("signature_type").default("checkbox"),
  signatureReference: varchar("signature_reference"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow(),
}, (table) => [
  index("idx_suitability_ack_order").on(table.orderId),
  index("idx_suitability_ack_user").on(table.userId),
]);

export const mfReconciliationEntries = pgTable("mf_reconciliation_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => mfOrders.id),
  rtaReference: varchar("rta_reference"),
  amcReference: varchar("amc_reference"),
  expectedUnits: decimal("expected_units", { precision: 15, scale: 4 }),
  actualUnits: decimal("actual_units", { precision: 15, scale: 4 }),
  expectedAmount: decimal("expected_amount", { precision: 15, scale: 2 }),
  actualAmount: decimal("actual_amount", { precision: 15, scale: 2 }),
  variance: decimal("variance", { precision: 15, scale: 4 }),
  navDate: date("nav_date"),
  navApplied: decimal("nav_applied", { precision: 12, scale: 4 }),
  reconciliationStatus: varchar("reconciliation_status").default("pending"),
  exceptionReason: text("exception_reason"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  rawRtaResponse: jsonb("raw_rta_response"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_mf_recon_order").on(table.orderId),
  index("idx_mf_recon_status").on(table.reconciliationStatus),
]);

export const mfContractNotes = pgTable("mf_contract_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => mfOrders.id),
  contractNoteNumber: varchar("contract_note_number").notNull().unique(),
  tradeDate: date("trade_date").notNull(),
  settlementDate: date("settlement_date"),
  pdfUrl: text("pdf_url"),
  pdfHash: varchar("pdf_hash"),
  storageReference: varchar("storage_reference"),
  emailSentAt: timestamp("email_sent_at"),
  emailDeliveredAt: timestamp("email_delivered_at"),
  smsSentAt: timestamp("sms_sent_at"),
  generatedAt: timestamp("generated_at").defaultNow(),
}, (table) => [
  index("idx_mf_contract_order").on(table.orderId),
  index("idx_mf_contract_number").on(table.contractNoteNumber),
]);

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { Portfolio, User } from '../schema';


export const insertMfFolioSchema = createInsertSchema(mfFolios).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMfHoldingSchema = createInsertSchema(mfHoldings).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBankMandateSchema = createInsertSchema(bankMandates).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMfOrderSchema = createInsertSchema(mfOrders).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMfOrderAuditLogSchema = createInsertSchema(mfOrderAuditLog).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertSuitabilityAcknowledgementSchema = createInsertSchema(suitabilityAcknowledgements).extend({
  id: z.any(),
  acknowledgedAt: z.any(),
}).omit({
  id: true,
  acknowledgedAt: true,
});

export const insertMfReconciliationEntrySchema = createInsertSchema(mfReconciliationEntries).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMfContractNoteSchema = createInsertSchema(mfContractNotes).extend({
  id: z.any(),
  generatedAt: z.any(),
}).omit({
  id: true,
  generatedAt: true,
});

export type MfFolio = typeof mfFolios.$inferSelect;
export type InsertMfFolio = typeof mfFolios.$inferInsert;

export type MfHolding = typeof mfHoldings.$inferSelect;
export type InsertMfHolding = typeof mfHoldings.$inferInsert;

export type BankMandate = typeof bankMandates.$inferSelect;
export type InsertBankMandate = typeof bankMandates.$inferInsert;

export type MfOrder = typeof mfOrders.$inferSelect;
export type InsertMfOrder = typeof mfOrders.$inferInsert;

export type MfOrderAuditLog = typeof mfOrderAuditLog.$inferSelect;
export type InsertMfOrderAuditLog = typeof mfOrderAuditLog.$inferInsert;

export type SuitabilityAcknowledgement = typeof suitabilityAcknowledgements.$inferSelect;
export type InsertSuitabilityAcknowledgement = typeof suitabilityAcknowledgements.$inferInsert;

export type MfReconciliationEntry = typeof mfReconciliationEntries.$inferSelect;
export type InsertMfReconciliationEntry = typeof mfReconciliationEntries.$inferInsert;

export type MfContractNote = typeof mfContractNotes.$inferSelect;
export type InsertMfContractNote = typeof mfContractNotes.$inferInsert;


// --- Auto-Migrated Tables ---
export const mutualFunds = pgTable("mutual_funds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schemeCode: text("scheme_code").notNull().unique(),
  schemeName: text("scheme_name").notNull(),
  category: text("category"),
  fundHouse: text("fund_house"),
  nav: decimal("nav", { precision: 10, scale: 4 }),
  change: decimal("change", { precision: 10, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 8, scale: 4 }),
  expenseRatio: decimal("expense_ratio", { precision: 5, scale: 2 }),
  aum: decimal("aum", { precision: 15, scale: 2 }),
  riskLevel: text("risk_level"),
  returns1y: decimal("returns_1y", { precision: 8, scale: 4 }),
  returns3y: decimal("returns_3y", { precision: 8, scale: 4 }),
  returns5y: decimal("returns_5y", { precision: 8, scale: 4 }),
  
  // FintekPro Smart Rating (stored in legacy crisil_* columns for backwards compatibility)
  crisilRating: integer("crisil_rating"), // 1-5 scale (1 = very good performance) - Now stores FintekPro Smart Rating
  crisilCategory: varchar("crisil_category"), // equity/debt/hybrid
  crisilPercentile: decimal("crisil_percentile", { precision: 5, scale: 2 }), // 0-100 percentile ranking
  crisilEvaluationDate: timestamp("crisil_evaluation_date"), // Last evaluation date
  crisilRiskAdjustedScore: decimal("crisil_risk_adjusted_score", { precision: 8, scale: 4 }), // Risk-adjusted returns score
  crisilAssetQualityScore: decimal("crisil_asset_quality_score", { precision: 8, scale: 4 }), // Asset quality score
  crisilLiquidityScore: decimal("crisil_liquidity_score", { precision: 8, scale: 4 }), // Liquidity score
  crisilConcentrationScore: decimal("crisil_concentration_score", { precision: 8, scale: 4 }), // Asset concentration score
  crisilOverallScore: decimal("crisil_overall_score", { precision: 8, scale: 4 }), // Overall composite score
  crisilDataSource: varchar("crisil_data_source").default("calculated"), // calculated/api/manual
  crisilLastUpdated: timestamp("crisil_last_updated").defaultNow(),
  
  // Extended fund data (stores currentNav, navDate, returns, returnStrings, rating, minInvestment, exitLoad, etc.)
  extendedData: jsonb("extended_data"),
  
  // Publishing controls for seeding workflow
  planType: varchar("plan_type").default("regular"), // 'direct' or 'regular'
  isPublished: boolean("is_published").default(false), // Whether scheme is published/visible
  publishedAt: timestamp("published_at"), // When scheme was published
  publishedBy: varchar("published_by"), // Admin who published
  
  // Search resilience & AMFI alignment fields
  amfiCode: varchar("amfi_code"), // AMFI unique identifier (indexed)
  isin: varchar("isin"), // ISIN code for the scheme (e.g., INF204K01HN1)
  optionType: varchar("option_type"), // 'growth' or 'idcw' (dividend)
  schemeStatus: varchar("scheme_status").default("active"), // 'active', 'merged', 'wound_up'
  lastVerifiedAt: timestamp("last_verified_at"), // Last API verification timestamp
  dataSource: varchar("data_source"), // 'AMFI', 'MFAPI', 'CACHED'
  
  // Extended AMFI data fields
  isinDividendPayout: varchar("isin_dividend_payout"), // ISIN for dividend payout option
  isinDividendReinvest: varchar("isin_dividend_reinvest"), // ISIN for dividend reinvestment option
  isinGrowth: varchar("isin_growth"), // ISIN for growth option (canonical)
  repurchasePrice: decimal("repurchase_price", { precision: 15, scale: 4 }), // Repurchase/redemption price
  salePrice: decimal("sale_price", { precision: 15, scale: 4 }), // Sale/purchase price
  launchDate: date("launch_date"), // Scheme launch date
  minSipAmount: decimal("min_sip_amount", { precision: 15, scale: 2 }), // Minimum SIP investment amount
  minLumpsumAmount: decimal("min_lumpsum_amount", { precision: 15, scale: 2 }), // Minimum lumpsum investment amount
  amcCode: varchar("amc_code"), // Asset Management Company code
  exitLoadPercent: decimal("exit_load_percent", { precision: 8, scale: 4 }), // Exit load percentage
  exitLoadDays: integer("exit_load_days"), // Exit load applicable days
  schemeSubCategory: varchar("scheme_sub_category"), // AMFI scheme sub-category
  
  // Benchmark mapping reference
  benchmarkIndex: varchar("benchmark_index"), // Raw AMFI benchmark name e.g., 'NIFTY 50 TRI', 'S&P BSE SENSEX TRI'
  benchmarkIndexCode: varchar("benchmark_index_code"), // e.g., NIFTY50, NIFTY_MIDCAP_150
  benchmarkConfidenceScore: decimal("benchmark_confidence_score", { precision: 3, scale: 2 }), // 0.00-1.00

  // === SEBI 2026 CIRCULAR COMPLIANCE FIELDS ===
  taxonomyVersion: varchar("taxonomy_version", { length: 20 }).default("SEBI_2017"),
  // Compliance state machine — values: PENDING, VALIDATED, BLOCKED, OVERLAP_BREACH, GLIDE_PATH_INVALID, REQUIRES_REVIEW, APPROVED
  complianceStatus: varchar("compliance_status", { length: 30 }).default("PENDING"),
  // True-to-Label naming check — values: PENDING, PASSED, FAILED
  namingValidationStatus: varchar("naming_validation_status", { length: 10 }).default("PENDING"),
  // Lifecycle/target-date fund glide path: { maturityYear: number, glidePathSteps: [{year, equityPct, debtPct}] }
  lifecycleMetadata: jsonb("lifecycle_metadata"),
  complianceBlockedReason: text("compliance_blocked_reason"),

  // IRIS / KFintech Specific
  kfintechId: varchar("kfintech_id", { length: 100 }), // Proprietary ID from KFintech IRIS
  folioNature: varchar("folio_nature", { length: 50 }), // e.g., 'E-FOLIO', 'PHYSICAL'

  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const mfNavHistory = pgTable("mf_nav_history", {
  id: serial("id").primaryKey(),
  schemeCode: text("scheme_code").notNull(),
  navDate: date("nav_date").notNull(),
  nav: decimal("nav", { precision: 15, scale: 6 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  schemeCodeIdx: index("mf_nav_history_scheme_code_idx").on(table.schemeCode),
  navDateIdx: index("mf_nav_history_nav_date_idx").on(table.navDate),
  schemeCodeNavDateIdx: index("mf_nav_history_scheme_code_nav_date_idx").on(table.schemeCode, table.navDate),
}));

// Monthly Returns table for tracking month-wise performance
export const mfMonthlyReturns = pgTable("mf_monthly_returns", {
  id: serial("id").primaryKey(),
  schemeCode: text("scheme_code").notNull(),
  monthYear: varchar("month_year", { length: 7 }).notNull(), // Format: YYYY-MM
  returnPercent: decimal("return_percent", { precision: 10, scale: 4 }),
  navStart: decimal("nav_start", { precision: 15, scale: 6 }),
  navEnd: decimal("nav_end", { precision: 15, scale: 6 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schemeCodeIdx: index("mf_monthly_returns_scheme_code_idx").on(table.schemeCode),
  monthYearIdx: index("mf_monthly_returns_month_year_idx").on(table.monthYear),
  schemeCodeMonthYearIdx: index("mf_monthly_returns_scheme_code_month_year_idx").on(table.schemeCode, table.monthYear),
}));

// Scheme Exit Loads table with tiered structure per scheme
export const mfSchemeExitLoads = pgTable("mf_scheme_exit_loads", {
  id: serial("id").primaryKey(),
  schemeCode: text("scheme_code").notNull(),
  isin: varchar("isin", { length: 20 }),
  tier: integer("tier").notNull(), // 1, 2, 3... for multi-tier exit loads
  minDays: integer("min_days").notNull().default(0), // Minimum holding days for this tier
  maxDays: integer("max_days"), // Maximum holding days (NULL means no upper limit)
  exitLoadPercent: decimal("exit_load_percent", { precision: 5, scale: 3 }).notNull(), // e.g., 1.000 for 1%
  description: text("description"), // e.g., "1% if redeemed within 365 days"
  sourceUrl: text("source_url"), // AMC fact sheet URL
  lastVerified: timestamp("last_verified"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  schemeCodeIdx: index("mf_scheme_exit_loads_scheme_code_idx").on(table.schemeCode),
  isinIdx: index("mf_scheme_exit_loads_isin_idx").on(table.isin),
}));

// MF Scheme Stock Holdings - Stock-level holdings for look-through analysis
export const mfSchemeStockHoldings = pgTable("mf_scheme_stock_holdings", {
  id: uuid("id").primaryKey().defaultRandom(),
  mfIsin: varchar("mf_isin", { length: 20 }).notNull(),
  stockSymbol: varchar("stock_symbol", { length: 30 }).notNull(),
  stockName: text("stock_name"),
  stockIsin: varchar("stock_isin", { length: 20 }),
  sector: varchar("sector", { length: 100 }),
  holdingPercentage: decimal("holding_percentage", { precision: 8, scale: 4 }).notNull(),
  holdingDate: date("holding_date").notNull(),
  marketValue: decimal("market_value", { precision: 15, scale: 2 }),
  quantity: decimal("quantity", { precision: 15, scale: 4 }),
  source: varchar("source", { length: 30 }).default("amfi"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  mfIsinIdx: index("mf_scheme_stock_holdings_mf_isin_idx").on(table.mfIsin),
  stockSymbolIdx: index("mf_scheme_stock_holdings_stock_symbol_idx").on(table.stockSymbol),
  holdingDateIdx: index("mf_scheme_stock_holdings_holding_date_idx").on(table.holdingDate),
  uniqueHolding: uniqueIndex("mf_scheme_stock_holdings_unique_idx").on(table.mfIsin, table.stockSymbol, table.holdingDate),
}));

export const insertMfSchemeStockHoldingsSchema = createInsertSchema(mfSchemeStockHoldings).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const mfTaxRules = pgTable("mf_tax_rules", {
  id: serial("id").primaryKey(),
  fundType: varchar("fund_type", { length: 50 }).notNull(), // equity, debt, hybrid, elss, liquid
  holdingPeriodType: varchar("holding_period_type", { length: 20 }).notNull(), // short_term, long_term
  minHoldingDays: integer("min_holding_days").notNull(),
  maxHoldingDays: integer("max_holding_days"), // NULL means no upper limit
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull(), // Tax rate percentage
  exemptionLimit: decimal("exemption_limit", { precision: 15, scale: 2 }), // e.g., 125000 for LTCG
  surchargeApplicable: boolean("surcharge_applicable").default(false),
  cessRate: decimal("cess_rate", { precision: 5, scale: 2 }).default("4"), // Health & Education cess
  indexationBenefit: boolean("indexation_benefit").default(false),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"), // NULL means currently active
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const mutualFundAmcs = pgTable("mutual_fund_amcs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(), // AMC name (fund_house in mutualFunds)
  displayName: varchar("display_name"), // User-friendly name
  logoUrl: varchar("logo_url"),
  
  // Publishing controls
  regularPlansEnabled: boolean("regular_plans_enabled").default(false), // Master toggle for Regular schemes
  directPlansEnabled: boolean("direct_plans_enabled").default(false), // Master toggle for Direct schemes
  
  // Metadata
  totalSchemes: integer("total_schemes").default(0), // Total schemes from this AMC
  publishedRegularSchemes: integer("published_regular_schemes").default(0), // Count of published Regular schemes
  publishedDirectSchemes: integer("published_direct_schemes").default(0), // Count of published Direct schemes
  
  // Audit
  lastToggledAt: timestamp("last_toggled_at"),
  lastToggledBy: varchar("last_toggled_by"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const mfBatchValidationLogs = pgTable("mf_batch_validation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id", { length: 100 }).notNull(),
  agentId: varchar("agent_id").references(() => users.id),
  
  // Credentials validated
  arnCode: varchar("arn_code", { length: 20 }).notNull(),
  euinCode: varchar("euin_code", { length: 20 }),
  productType: varchar("product_type", { length: 20 }).default("mutual_fund"),
  
  // Batch details
  transactionCount: integer("transaction_count").default(0),
  totalAmount: numeric("total_amount").default("0"),
  
  // Validation results
  arnValid: boolean("arn_valid").default(false),
  arnStatus: text("arn_status"), // 'active', 'inactive', 'suspended', 'expired'
  arnExpiryDate: date("arn_expiry_date"),
  euinValid: boolean("euin_valid"),
  euinActive: boolean("euin_active"),
  
  // Decision outcome
  canProceed: boolean("can_proceed").default(false),
  requiresManualReview: boolean("requires_manual_review").default(false),
  blockingReason: text("blocking_reason"),
  
  // Warnings and errors (JSON arrays)
  warnings: jsonb("warnings").default([]),
  errors: jsonb("errors").default([]),
  
  // Raw registry response (for audit)
  registryResponseHash: varchar("registry_response_hash", { length: 64 }),
  registryResponseSnapshot: jsonb("registry_response_snapshot"),
  
  // Validation source
  validationSource: varchar("validation_source", { length: 50 }), // 'amfi_live', 'cached', 'mock'
  
  // Audit metadata
  validatedAt: timestamp("validated_at").defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mbvl_batch").on(table.batchId),
  index("idx_mbvl_agent").on(table.agentId, table.createdAt),
  index("idx_mbvl_arn").on(table.arnCode),
  index("idx_mbvl_outcome").on(table.canProceed, table.createdAt),
]);

export const insertMfBatchValidationLogSchema = createInsertSchema(mfBatchValidationLogs).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export const mfMonthwisePerformance = pgTable("mf_monthwise_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schemeCode: text("scheme_code").notNull().references(() => mutualFunds.schemeCode),
  
  monthYear: date("month_year").notNull(), // First day of the month (e.g., 2025-01-01)
  navStart: decimal("nav_start", { precision: 15, scale: 4 }), // NAV at start of month
  navEnd: decimal("nav_end", { precision: 15, scale: 4 }), // NAV at end of month
  returnPercent: decimal("return_percent", { precision: 8, scale: 4 }), // Monthly return percentage
  benchmarkReturn: decimal("benchmark_return", { precision: 8, scale: 4 }), // Benchmark (Nifty/Sensex) return for comparison
  excessReturn: decimal("excess_return", { precision: 8, scale: 4 }), // Alpha over benchmark
  isPartial: boolean("is_partial").default(false), // True if month is incomplete
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mf_monthwise_performance_scheme").on(table.schemeCode),
  index("idx_mf_monthwise_performance_month").on(table.monthYear),
  index("idx_mf_monthwise_performance_unique").on(table.schemeCode, table.monthYear),
]);

export const insertMfMonthwisePerformanceSchema = createInsertSchema(mfMonthwisePerformance).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MfMonthwisePerformance = typeof mfMonthwisePerformance.$inferSelect;

export type InsertMfMonthwisePerformance = z.infer<typeof insertMfMonthwisePerformanceSchema>;

export const mutualFundMetrics = pgTable("mutual_fund_metrics", {
  id: serial("id").primaryKey(),
  fundId: varchar("fund_id"),
  schemeCode: varchar("scheme_code").notNull(),
  fiscalYear: varchar("fiscal_year", { length: 10 }).notNull(),
  
  // === RISK-ADJUSTED RETURNS ===
  alpha: decimal("alpha", { precision: 10, scale: 4 }),
  beta: decimal("beta", { precision: 8, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 4 }),
  sortinoRatio: decimal("sortino_ratio", { precision: 10, scale: 4 }),
  treynorRatio: decimal("treynor_ratio", { precision: 10, scale: 4 }),
  informationRatio: decimal("information_ratio", { precision: 10, scale: 4 }),
  jensenAlpha: decimal("jensen_alpha", { precision: 10, scale: 4 }),
  
  // === VOLATILITY METRICS ===
  standardDeviation: decimal("standard_deviation", { precision: 10, scale: 4 }),
  semiDeviation: decimal("semi_deviation", { precision: 10, scale: 4 }), // Downside deviation
  maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 4 }),
  var95: decimal("var_95", { precision: 10, scale: 4 }), // Value at Risk 95%
  cvar95: decimal("cvar_95", { precision: 10, scale: 4 }), // Conditional VaR
  
  // === CAPTURE RATIOS ===
  upsideCaptureRatio: decimal("upside_capture_ratio", { precision: 10, scale: 4 }),
  downsideCaptureRatio: decimal("downside_capture_ratio", { precision: 10, scale: 4 }),
  captureRatio: decimal("capture_ratio", { precision: 10, scale: 4 }), // Upside/Downside
  
  // === ROLLING RETURNS ===
  return1m: decimal("return_1m", { precision: 10, scale: 4 }),
  return3m: decimal("return_3m", { precision: 10, scale: 4 }),
  return6m: decimal("return_6m", { precision: 10, scale: 4 }),
  return1y: decimal("return_1y", { precision: 10, scale: 4 }),
  return3y: decimal("return_3y", { precision: 10, scale: 4 }),
  return5y: decimal("return_5y", { precision: 10, scale: 4 }),
  return10y: decimal("return_10y", { precision: 10, scale: 4 }),
  returnSinceInception: decimal("return_since_inception", { precision: 10, scale: 4 }),
  
  // === CAGR ===
  cagr3y: decimal("cagr_3y", { precision: 10, scale: 4 }),
  cagr5y: decimal("cagr_5y", { precision: 10, scale: 4 }),
  cagr10y: decimal("cagr_10y", { precision: 10, scale: 4 }),
  
  // === SIP RETURNS ===
  sipReturn1y: decimal("sip_return_1y", { precision: 10, scale: 4 }),
  sipReturn3y: decimal("sip_return_3y", { precision: 10, scale: 4 }),
  sipReturn5y: decimal("sip_return_5y", { precision: 10, scale: 4 }),
  xirr3y: decimal("xirr_3y", { precision: 10, scale: 4 }),
  xirr5y: decimal("xirr_5y", { precision: 10, scale: 4 }),
  
  // === PORTFOLIO CHARACTERISTICS ===
  aum: decimal("aum", { precision: 20, scale: 2 }),
  expenseRatio: decimal("expense_ratio", { precision: 8, scale: 4 }),
  portfolioTurnover: decimal("portfolio_turnover", { precision: 10, scale: 4 }),
  avgMarketCap: decimal("avg_market_cap", { precision: 20, scale: 2 }),
  portfolioPeRatio: decimal("portfolio_pe_ratio", { precision: 10, scale: 4 }),
  portfolioPbRatio: decimal("portfolio_pb_ratio", { precision: 10, scale: 4 }),
  numberOfHoldings: integer("number_of_holdings"),
  
  // === CONSISTENCY METRICS ===
  consistencyScore: integer("consistency_score"), // 1-5 rating
  percentileRank: decimal("percentile_rank", { precision: 8, scale: 4 }), // vs category
  categoryRank: integer("category_rank"),
  categorySize: integer("category_size"),
  
  // === METADATA ===
  benchmarkIndex: varchar("benchmark_index"),
  dataSource: varchar("data_source", { length: 50 }),
  calculatedAt: timestamp("calculated_at").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_mf_metrics_fund").on(table.fundId),
  index("idx_mf_metrics_scheme").on(table.schemeCode),
  index("idx_mf_metrics_fy").on(table.fiscalYear),
  uniqueIndex("uq_mf_metrics_scheme_fy").on(table.schemeCode, table.fiscalYear),
]);

export const insertMutualFundMetricsSchema = createInsertSchema(mutualFundMetrics).extend({
  id: z.any(),
  calculatedAt: z.any(),
  lastUpdated: z.any(),
  createdAt: z.any(),
}).omit({
  id: true, calculatedAt: true, lastUpdated: true, createdAt: true,
});

export type MutualFundMetrics = typeof mutualFundMetrics.$inferSelect;

export type InsertMutualFundMetrics = z.infer<typeof insertMutualFundMetricsSchema>;

export const mfBenchmarkMap = pgTable("mf_benchmark_map", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mfIsin: varchar("mf_isin", { length: 20 }).notNull().unique(), // Mutual fund ISIN
  mfSchemeCode: varchar("mf_scheme_code", { length: 20 }), // Optional scheme code reference
  indexCode: varchar("index_code", { length: 30 }).notNull(), // Benchmark index code
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }).notNull().default("0.80"), // 0.00-1.00
  source: varchar("source", { length: 30 }).default("auto"), // 'auto', 'amfi', 'manual'
  mappingReason: text("mapping_reason"), // e.g., "Large Cap → NIFTY50"
  isOverridden: boolean("is_overridden").default(false), // Admin override flag
  overriddenBy: varchar("overridden_by"), // Admin who made override
  overriddenAt: timestamp("overridden_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_mf_benchmark_map_index_code").on(table.indexCode),
  index("idx_mf_benchmark_map_scheme_code").on(table.mfSchemeCode),
]);

export const insertMfBenchmarkMapSchema = createInsertSchema(mfBenchmarkMap).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
  overriddenAt: z.any(),
}).omit({
  id: true, createdAt: true, updatedAt: true, overriddenAt: true,
});

export type MfBenchmarkMap = typeof mfBenchmarkMap.$inferSelect;

export type InsertMfBenchmarkMap = z.infer<typeof insertMfBenchmarkMapSchema>;

export const mfBenchmarkHistory = pgTable("mf_benchmark_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mfIsin: varchar("mf_isin", { length: 20 }).notNull(),
  oldIndexCode: varchar("old_index_code", { length: 30 }),
  newIndexCode: varchar("new_index_code", { length: 30 }),
  oldRawBenchmark: text("old_raw_benchmark"),
  newRawBenchmark: text("new_raw_benchmark"),
  changeSource: varchar("change_source", { length: 30 }), // 'amfi_update', 'admin_override', 'auto_remap'
  changedAt: timestamp("changed_at").defaultNow(),
}, (table) => [
  index("idx_mf_benchmark_history_isin").on(table.mfIsin),
  index("idx_mf_benchmark_history_changed").on(table.changedAt),
]);

export const insertMfBenchmarkHistorySchema = createInsertSchema(mfBenchmarkHistory).extend({
  id: z.any(),
  changedAt: z.any(),
}).omit({
  id: true, changedAt: true,
});

export type MfBenchmarkHistory = typeof mfBenchmarkHistory.$inferSelect;

export type InsertMfBenchmarkHistory = z.infer<typeof insertMfBenchmarkHistorySchema>;

export const mfBenchmarkLineage = pgTable("mf_benchmark_lineage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mfIsin: varchar("mf_isin", { length: 20 }).notNull(),
  previousSource: varchar("previous_source", { length: 20 }), // 'amfi', 'bse', 'category', 'manual'
  newSource: varchar("new_source", { length: 20 }).notNull(),
  previousIndex: varchar("previous_index", { length: 30 }),
  newIndex: varchar("new_index", { length: 30 }).notNull(),
  reason: text("reason"), // mandatory reason for admin overrides
  changedBy: varchar("changed_by"), // user ID for admin changes
  changedAt: timestamp("changed_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mf_benchmark_lineage_isin").on(table.mfIsin),
  index("idx_mf_benchmark_lineage_changed_at").on(table.changedAt),
]);

export const insertMfBenchmarkLineageSchema = createInsertSchema(mfBenchmarkLineage).extend({
  id: z.any(),
  changedAt: z.any(),
}).omit({
  id: true, changedAt: true,
});

export type MfBenchmarkLineage = typeof mfBenchmarkLineage.$inferSelect;

export type InsertMfBenchmarkLineage = z.infer<typeof insertMfBenchmarkLineageSchema>;

export const mfEnrichmentAuditLogs = pgTable("mf_enrichment_audit_logs", {
  id: serial("id").primaryKey(),
  schemeCode: text("scheme_code").notNull(),
  fieldName: varchar("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changeType: varchar("change_type"),
  source: varchar("source"),
  enrichmentRunId: varchar("enrichment_run_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_mf_enrichment_audit_scheme").on(table.schemeCode),
  index("idx_mf_enrichment_audit_created").on(table.createdAt),
  index("idx_mf_enrichment_audit_run").on(table.enrichmentRunId),
]);

export const insertMfEnrichmentAuditLogSchema = createInsertSchema(mfEnrichmentAuditLogs).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true, createdAt: true,
});

export const mfAumHistory = pgTable("mf_aum_history", {
  id: serial("id").primaryKey(),
  schemeCode: text("scheme_code").notNull(),
  asOfDate: date("as_of_date").notNull(),
  aum: decimal("aum", { precision: 15, scale: 2 }),
  source: varchar("source"),
  dayOverDayChangePercent: decimal("day_over_day_change_percent", { precision: 8, scale: 4 }),
  anomalyFlag: boolean("anomaly_flag").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_mf_aum_history_unique").on(table.schemeCode, table.asOfDate),
  index("idx_mf_aum_history_scheme").on(table.schemeCode),
  index("idx_mf_aum_history_date").on(table.asOfDate),
]);

export const insertMfAumHistorySchema = createInsertSchema(mfAumHistory).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true, createdAt: true,
});

export type MfAumHistory = typeof mfAumHistory.$inferSelect;

export type InsertMfAumHistory = z.infer<typeof insertMfAumHistorySchema>;

export const mfCategoryRules = pgTable("mf_category_rules", {
  id: serial("id").primaryKey(),
  category: varchar("category").notNull(),
  subCategory: varchar("sub_category").notNull(),
  sebiCircularRef: varchar("sebi_circular_ref"),
  effectiveDate: date("effective_date"),
  rules: jsonb("rules"),
  isActive: boolean("is_active").default(true),
  version: integer("version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_mf_category_rules_unique").on(table.category, table.subCategory, table.version),
]);

export const insertMfCategoryRuleSchema = createInsertSchema(mfCategoryRules).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const mfTaxonomyVersions = pgTable("mf_taxonomy_versions", {
  id: serial("id").primaryKey(),
  version: varchar("version", { length: 20 }).notNull().unique(), // e.g., SEBI_2017, SEBI_2026
  sebiCircularRef: varchar("sebi_circular_ref", { length: 100 }).notNull(),
  effectiveDate: date("effective_date").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_mf_taxonomy_versions_active").on(table.isActive),
]);

export type MfTaxonomyVersion = typeof mfTaxonomyVersions.$inferSelect;
export type InsertMfTaxonomyVersion = typeof mfTaxonomyVersions.$inferInsert;

// ── SEBI Category Master — top-level category groups per taxonomy version ──
export const mfCategoryMaster = pgTable("mf_category_master", {
  id: serial("id").primaryKey(),
  taxonomyVersion: varchar("taxonomy_version", { length: 20 }).notNull(), // SEBI_2017, SEBI_2026
  groupCode: varchar("group_code", { length: 20 }).notNull(), // EQUITY, DEBT, HYBRID, LIFECYCLE, OTHER
  groupName: varchar("group_name", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
}, (table) => [
  uniqueIndex("idx_mf_category_master_version_code").on(table.taxonomyVersion, table.groupCode),
]);

export type MfCategoryMaster = typeof mfCategoryMaster.$inferSelect;
export type InsertMfCategoryMaster = typeof mfCategoryMaster.$inferInsert;

// ── SEBI Subcategory Master — subcategories with SEBI allocation bands ──
export const mfSubcategoryMaster = pgTable("mf_subcategory_master", {
  id: serial("id").primaryKey(),
  taxonomyVersion: varchar("taxonomy_version", { length: 20 }).notNull(),
  groupCode: varchar("group_code", { length: 20 }).notNull(), // FK to mf_category_master.group_code
  subcategoryCode: varchar("subcategory_code", { length: 60 }).notNull().unique(), // e.g., EQUITY_LARGE_CAP
  subcategoryName: varchar("subcategory_name", { length: 100 }).notNull(), // e.g., Large Cap Fund
  minEquityPct: decimal("min_equity_pct", { precision: 5, scale: 2 }), // SEBI minimum equity allocation
  maxEquityPct: decimal("max_equity_pct", { precision: 5, scale: 2 }), // SEBI maximum equity allocation
  minDebtPct: decimal("min_debt_pct", { precision: 5, scale: 2 }),
  maxDebtPct: decimal("max_debt_pct", { precision: 5, scale: 2 }),
  maxStocks: integer("max_stocks"), // e.g. Focused fund: max 30 stocks
  lockInDays: integer("lock_in_days"), // e.g. ELSS: 1095 days
  overlapThresholdPct: decimal("overlap_threshold_pct", { precision: 5, scale: 2 }).default("60"),
  // Thematic/Sectoral use 50%, all others 60%
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
}, (table) => [
  index("idx_mf_subcategory_master_version").on(table.taxonomyVersion),
  index("idx_mf_subcategory_master_group").on(table.groupCode),
]);

export type MfSubcategoryMaster = typeof mfSubcategoryMaster.$inferSelect;
export type InsertMfSubcategoryMaster = typeof mfSubcategoryMaster.$inferInsert;

// ── MF Portfolio Holdings — scheme-level ISIN holdings for SEBI overlap computation ──
// Distinct from user-level mf_holdings. Populated from mf_scheme_stock_holdings.
export const mfPortfolioHoldings = pgTable("mf_portfolio_holdings", {
  id: serial("id").primaryKey(),
  schemeCode: varchar("scheme_code").notNull(),
  isin: varchar("isin", { length: 20 }).notNull(),
  stockName: varchar("stock_name", { length: 200 }),
  weightPercent: decimal("weight_percent", { precision: 8, scale: 4 }).notNull(),
  asOfDate: date("as_of_date").notNull(),
  source: varchar("source").default("mf_scheme_stock_holdings"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_mf_portfolio_holdings_unique").on(table.schemeCode, table.isin, table.asOfDate),
  index("idx_mf_portfolio_holdings_scheme").on(table.schemeCode),
  index("idx_mf_portfolio_holdings_isin").on(table.isin),
]);

export type MfPortfolioHolding = typeof mfPortfolioHoldings.$inferSelect;
export type InsertMfPortfolioHolding = typeof mfPortfolioHoldings.$inferInsert;

// ── MF Overlap Matrix — pairwise SEBI regulatory overlap between AMC schemes ──
export const mfOverlapMatrix = pgTable("mf_overlap_matrix", {
  id: serial("id").primaryKey(),
  schemeCodeA: varchar("scheme_code_a").notNull(),
  schemeCodeB: varchar("scheme_code_b").notNull(),
  overlapPercent: decimal("overlap_percent", { precision: 7, scale: 4 }).notNull(),
  breachFlag: boolean("breach_flag").default(false),
  // Breach threshold: thematic/sectoral > 50%, others > 60%
  computedAt: timestamp("computed_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_mf_overlap_matrix_pair").on(table.schemeCodeA, table.schemeCodeB),
  index("idx_mf_overlap_matrix_a").on(table.schemeCodeA),
  index("idx_mf_overlap_matrix_b").on(table.schemeCodeB),
  index("idx_mf_overlap_matrix_breach").on(table.breachFlag),
]);

export type MfOverlapMatrix = typeof mfOverlapMatrix.$inferSelect;
export type InsertMfOverlapMatrix = typeof mfOverlapMatrix.$inferInsert;

// ── MF Compliance State Log — audit trail for all compliance state transitions ──


// ═══════════════════════════════════════════════════════════════════════════
// BLOOMBERG-STYLE GOLDEN SOURCE PRICING ENGINE
// Multi-source price discovery → single authoritative "golden price"
// SEBI-compliant for PMS/AIF portfolios
// ═══════════════════════════════════════════════════════════════════════════

// ── Source hierarchy constants (stored as varchar for readability) ──
// Priority: NSE_BHAVCOPY > BSE_CLOSE > AMFI_NAV > FMP > ALPHAVANTAGE >
//           LAST_TRADE > PROBE42 > YIELD_CURVE > MODEL_PRICE > BROKER_QUOTE

export const goldenPrices = pgTable("golden_prices", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 50 }),
  priceDate: date("price_date").notNull(),
  assetClass: varchar("asset_class", { length: 30 }).notNull().default("equity"),
  price: decimal("price", { precision: 20, scale: 6 }).notNull(),
  openPrice: decimal("open_price", { precision: 20, scale: 6 }),
  highPrice: decimal("high_price", { precision: 20, scale: 6 }),
  lowPrice: decimal("low_price", { precision: 20, scale: 6 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  changePercent: decimal("change_percent", { precision: 10, scale: 4 }),
  source: varchar("source", { length: 50 }).notNull(),
  confidenceScore: integer("confidence_score").notNull().default(50),
  isValidated: boolean("is_validated").notNull().default(false),
  isStale: boolean("is_stale").notNull().default(false),
  isFlagged: boolean("is_flagged").notNull().default(false),
  flagReason: text("flag_reason"),
  previousPrice: decimal("previous_price", { precision: 20, scale: 6 }),
  deviationPct: decimal("deviation_pct", { precision: 10, scale: 4 }),
  currency: varchar("currency", { length: 10 }).default("INR"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_golden_prices_isin_date").on(table.isin, table.priceDate),
  index("idx_golden_prices_date").on(table.priceDate),
  index("idx_golden_prices_symbol").on(table.symbol),
  index("idx_golden_prices_asset_class").on(table.assetClass),
  index("idx_golden_prices_flagged").on(table.isFlagged),
]);

export type GoldenPrice = typeof goldenPrices.$inferSelect;
export type InsertGoldenPrice = typeof goldenPrices.$inferInsert;
export const insertGoldenPriceSchema = createInsertSchema(goldenPrices).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// --- Mutual Fund Analytics and Comparisons ---

export const schemeRenameLog = pgTable("scheme_rename_log", {
  id: serial("id").primaryKey(),
  isin: varchar("isin"),
  schemeCode: text("scheme_code").notNull(),
  oldName: text("old_name").notNull(),
  newName: text("new_name").notNull(),
  detectedAt: timestamp("detected_at").defaultNow(),
  syncSource: varchar("sync_source").default("AMFI"),
}, (table) => ({
  isinIdx: index("idx_scheme_rename_log_isin").on(table.isin),
  schemeCodeIdx: index("idx_scheme_rename_log_scheme_code").on(table.schemeCode),
  detectedAtIdx: index("idx_scheme_rename_log_detected_at").on(table.detectedAt),
}));

export const insertSchemeRenameLogSchema = createInsertSchema(schemeRenameLog).omit({ id: true, detectedAt: true });
export type SchemeRenameLog = typeof schemeRenameLog.$inferSelect;
export type InsertSchemeRenameLog = z.infer<typeof insertSchemeRenameLogSchema>;

export const schemeTransactionRules = pgTable("scheme_transaction_rules", {
  id: serial("id").primaryKey(),
  isin: varchar("isin"),
  schemeCode: text("scheme_code").notNull(),
  schemeName: text("scheme_name"),
  lumpsumAllowed: boolean("lumpsum_allowed").default(true),
  sipAllowed: boolean("sip_allowed").default(true),
  minLumpsumAmount: decimal("min_lumpsum_amount", { precision: 15, scale: 2 }),
  maxLumpsumAmount: decimal("max_lumpsum_amount", { precision: 15, scale: 2 }),
  minSipAmount: decimal("min_sip_amount", { precision: 15, scale: 2 }),
  subscriptionStatus: varchar("subscription_status").default("OPEN"),
  restrictionReason: text("restriction_reason"),
  alternativeIsin: varchar("alternative_isin"),
  alternativeSchemeName: text("alternative_scheme_name"),
  effectiveFrom: date("effective_from"),
  lastCheckedAt: timestamp("last_checked_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  isinIdx: index("idx_scheme_txn_rules_isin").on(table.isin),
  schemeCodeIdx: index("idx_scheme_txn_rules_scheme_code").on(table.schemeCode),
  subscriptionStatusIdx: index("idx_scheme_txn_rules_status").on(table.subscriptionStatus),
}));

export const insertSchemeTransactionRuleSchema = createInsertSchema(schemeTransactionRules).omit({ id: true, lastCheckedAt: true, updatedAt: true });
export type SchemeTransactionRule = typeof schemeTransactionRules.$inferSelect;
export type InsertSchemeTransactionRule = z.infer<typeof insertSchemeTransactionRuleSchema>;

export const fundComparisons = pgTable("fund_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  fundCodes: jsonb("fund_codes").notNull(),
  comparisonType: varchar("comparison_type").default("detailed"),
  timePeriod: varchar("time_period").default("1Y"),
  results: jsonb("results"),
  returns: jsonb("returns"),
  riskMetrics: jsonb("risk_metrics"),
  expenseAnalysis: jsonb("expense_analysis"),
  performanceRanking: jsonb("performance_ranking"),
  bestPerformer: varchar("best_performer"),
  recommendation: text("recommendation"),
  riskLevel: varchar("risk_level"),
  requestedAt: timestamp("requested_at").defaultNow(),
  status: varchar("status").default("completed"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const comparisonHistory = pgTable("comparison_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  comparisonType: varchar("comparison_type").notNull(),
  comparisonId: varchar("comparison_id"),
  itemsCompared: jsonb("items_compared"),
  viewDuration: integer("view_duration"),
  actionsPerformed: jsonb("actions_performed"),
  savedComparison: boolean("saved_comparison").default(false),
  sharedComparison: boolean("shared_comparison").default(false),
  accessedAt: timestamp("accessed_at").defaultNow(),
  lastViewedAt: timestamp("last_viewed_at"),
  userAgent: varchar("user_agent"),
  ipAddress: varchar("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fundFinancialRatios = pgTable("fund_financial_ratios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  schemeCode: varchar("scheme_code").notNull().unique(),
  peRatio: decimal("pe_ratio", { precision: 10, scale: 2 }),
  pbRatio: decimal("pb_ratio", { precision: 10, scale: 2 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 2 }),
  alpha: decimal("alpha", { precision: 10, scale: 2 }),
  beta: decimal("beta", { precision: 10, scale: 2 }),
  standardDeviation: decimal("standard_deviation", { precision: 10, scale: 2 }),
  sortinoRatio: decimal("sortino_ratio", { precision: 10, scale: 2 }),
  portfolioTurnover: decimal("portfolio_turnover", { precision: 10, scale: 2 }),
  avgMarketCap: decimal("avg_market_cap", { precision: 20, scale: 2 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_fund_ratios_scheme").on(table.schemeCode),
]);

export const stockFinancialRatios = pgTable("stock_financial_ratios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull().unique(),
  companyName: text("company_name"),
  sector: varchar("sector"),
  industry: varchar("industry"),
  marketCap: varchar("market_cap_category"),
  peRatio: decimal("pe_ratio", { precision: 10, scale: 2 }),
  pbRatio: decimal("pb_ratio", { precision: 10, scale: 2 }),
  evToEbitda: decimal("ev_to_ebitda", { precision: 10, scale: 2 }),
  priceToSales: decimal("price_to_sales", { precision: 10, scale: 2 }),
  sectorAvgPE: decimal("sector_avg_pe", { precision: 10, scale: 2 }),
  peVsSector: decimal("pe_vs_sector", { precision: 8, scale: 2 }),
  roe: decimal("roe", { precision: 8, scale: 2 }),
  roce: decimal("roce", { precision: 8, scale: 2 }),
  netProfitMargin: decimal("net_profit_margin", { precision: 8, scale: 2 }),
  operatingMargin: decimal("operating_margin", { precision: 8, scale: 2 }),
  debtToEquity: decimal("debt_to_equity", { precision: 10, scale: 2 }),
  currentRatio: decimal("current_ratio", { precision: 8, scale: 2 }),
  quickRatio: decimal("quick_ratio", { precision: 8, scale: 2 }),
  interestCoverage: decimal("interest_coverage", { precision: 10, scale: 2 }),
  eps: decimal("eps", { precision: 15, scale: 2 }),
  bookValue: decimal("book_value", { precision: 15, scale: 2 }),
  dividendYield: decimal("dividend_yield", { precision: 8, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 15, scale: 2 }),
  weekHigh52: decimal("week_high_52", { precision: 15, scale: 2 }),
  weekLow52: decimal("week_low_52", { precision: 15, scale: 2 }),
  returns1M: decimal("returns_1m", { precision: 8, scale: 4 }),
  returns3M: decimal("returns_3m", { precision: 8, scale: 4 }),
  returns1Y: decimal("returns_1y", { precision: 8, scale: 4 }),
  returns3Y: decimal("returns_3y", { precision: 8, scale: 4 }),
  beta: decimal("beta", { precision: 6, scale: 4 }),
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  aiSignal: varchar("ai_signal").default("hold"),
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }),
  aiRationale: text("ai_rationale"),
  targetPrice: decimal("target_price", { precision: 15, scale: 2 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stock_ratios_symbol").on(table.symbol),
  index("idx_stock_ratios_sector").on(table.sector),
  index("idx_stock_ratios_ai_signal").on(table.aiSignal),
]);

export const recommendationPerformance = pgTable("recommendation_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetType: varchar("asset_type").notNull(),
  assetCode: varchar("asset_code").notNull(),
  assetName: text("asset_name"),
  recommendationType: varchar("recommendation_type").notNull(),
  recommendationDate: timestamp("recommendation_date").notNull(),
  recommendedPrice: decimal("recommended_price", { precision: 15, scale: 4 }),
  targetPrice: decimal("target_price", { precision: 15, scale: 4 }),
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }),
  aiRationale: text("ai_rationale"),
  priceAfter1Week: decimal("price_after_1_week", { precision: 15, scale: 4 }),
  priceAfter1Month: decimal("price_after_1_month", { precision: 15, scale: 4 }),
  priceAfter3Months: decimal("price_after_3_months", { precision: 15, scale: 4 }),
  priceAfter6Months: decimal("price_after_6_months", { precision: 15, scale: 4 }),
  priceAfter1Year: decimal("price_after_1_year", { precision: 15, scale: 4 }),
  return1Week: decimal("return_1_week", { precision: 8, scale: 4 }),
  return1Month: decimal("return_1_month", { precision: 8, scale: 4 }),
  return3Months: decimal("return_3_months", { precision: 8, scale: 4 }),
  return6Months: decimal("return_6_months", { precision: 8, scale: 4 }),
  return1Year: decimal("return_1_year", { precision: 8, scale: 4 }),
  benchmarkReturn1Month: decimal("benchmark_return_1_month", { precision: 8, scale: 4 }),
  benchmarkReturn3Months: decimal("benchmark_return_3_months", { precision: 8, scale: 4 }),
  alphaGenerated: decimal("alpha_generated", { precision: 8, scale: 4 }),
  hitTarget: boolean("hit_target"),
  isSuccess: boolean("is_success"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_rec_perf_asset_type").on(table.assetType),
  index("idx_rec_perf_date").on(table.recommendationDate),
]);

export const productFundamentalsCache = pgTable("product_fundamentals_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productType: varchar("product_type", { length: 50 }).notNull(),
  productId: varchar("product_id", { length: 100 }).notNull(),
  productName: varchar("product_name", { length: 255 }),
  marketCap: numeric("market_cap", { precision: 18, scale: 2 }),
  peRatio: numeric("pe_ratio", { precision: 10, scale: 2 }),
  pbRatio: numeric("pb_ratio", { precision: 10, scale: 2 }),
  eps: numeric("eps", { precision: 12, scale: 4 }),
  dividendYield: numeric("dividend_yield", { precision: 8, scale: 4 }),
  roe: numeric("roe", { precision: 8, scale: 4 }),
  roce: numeric("roce", { precision: 8, scale: 4 }),
  debtToEquity: numeric("debt_to_equity", { precision: 10, scale: 4 }),
  revenueGrowth3Y: numeric("revenue_growth_3y", { precision: 8, scale: 4 }),
  profitGrowth3Y: numeric("profit_growth_3y", { precision: 8, scale: 4 }),
  expenseRatio: numeric("expense_ratio", { precision: 6, scale: 4 }),
  exitLoad: numeric("exit_load", { precision: 6, scale: 4 }),
  alpha: numeric("alpha", { precision: 8, scale: 4 }),
  beta: numeric("beta", { precision: 8, scale: 4 }),
  sharpeRatio: numeric("sharpe_ratio", { precision: 8, scale: 4 }),
  sortinoRatio: numeric("sortino_ratio", { precision: 8, scale: 4 }),
  standardDeviation: numeric("standard_deviation", { precision: 8, scale: 4 }),
  maxDrawdown: numeric("max_drawdown", { precision: 8, scale: 4 }),
  creditRating: varchar("credit_rating", { length: 20 }),
  creditRatingAgency: varchar("credit_rating_agency", { length: 50 }),
  maturityDate: date("maturity_date"),
  faceValue: numeric("face_value", { precision: 12, scale: 2 }),
  riskScore: integer("risk_score"),
  volatilityScore: integer("volatility_score"),
  liquidityScore: integer("liquidity_score"),
  fintekproRating: numeric("fintekpro_rating", { precision: 4, scale: 2 }),
  morningstarRating: integer("morningstar_rating"),
  valueResearchRating: integer("value_research_rating"),
  sector: varchar("sector", { length: 100 }),
  industry: varchar("industry", { length: 100 }),
  category: varchar("category", { length: 100 }),
  subcategory: varchar("subcategory", { length: 100 }),
  flowDirection: varchar("flow_direction", { length: 20 }).default("inbound").notNull(),
  regulatoryFramework: varchar("regulatory_framework", { length: 100 }),
  investorType: varchar("investor_type", { length: 100 }),
  lrsApplicable: boolean("lrs_applicable").default(false).notNull(),
  lrsCategory: varchar("lrs_category", { length: 100 }),
  fundManagerId: varchar("fund_manager_id"),
  fundManagerName: varchar("fund_manager_name", { length: 255 }),
  dataSource: varchar("data_source", { length: 50 }),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ttlHours: integer("ttl_hours").default(24),
  rawData: jsonb("raw_data"),
}, (table) => [
  index("idx_pfc_product_type").on(table.productType),
  index("idx_pfc_product_id").on(table.productId),
  index("idx_pfc_expires").on(table.expiresAt),
  uniqueIndex("idx_pfc_product_unique").on(table.productType, table.productId),
  index("idx_pfc_sector").on(table.sector),
]);

export const amfiSchemeBenchmarks = pgTable("amfi_scheme_benchmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mfIsin: varchar("mf_isin", { length: 20 }).unique(),
  schemeCode: varchar("scheme_code", { length: 20 }),
  schemeName: text("scheme_name"),
  schemeCategory: varchar("scheme_category", { length: 100 }),
  rawBenchmark: text("raw_benchmark"),
  normalizedBenchmark: varchar("normalized_benchmark", { length: 30 }),
  normalizationStatus: varchar("normalization_status", { length: 20 }).default("pending"),
  parsedAt: timestamp("parsed_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_amfi_scheme_benchmarks_isin").on(table.mfIsin),
  index("idx_amfi_scheme_benchmarks_code").on(table.schemeCode),
  index("idx_amfi_scheme_benchmarks_normalized").on(table.normalizedBenchmark),
]);

// Insert schemas and types
export const insertFundComparisonSchema = createInsertSchema(fundComparisons).omit({ id: true, createdAt: true, updatedAt: true });
export const insertComparisonHistorySchema = createInsertSchema(comparisonHistory).omit({ id: true, createdAt: true });
export const insertFundFinancialRatiosSchema = createInsertSchema(fundFinancialRatios).omit({ id: true, createdAt: true, lastUpdated: true });
export const insertStockFinancialRatiosSchema = createInsertSchema(stockFinancialRatios).omit({ id: true, createdAt: true, lastUpdated: true });
export const insertRecommendationPerformanceSchema = createInsertSchema(recommendationPerformance).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProductFundamentalsCacheSchema = createInsertSchema(productFundamentalsCache).omit({ id: true, cachedAt: true });
export const insertAmfiSchemeBenchmarkSchema = createInsertSchema(amfiSchemeBenchmarks).omit({ id: true, parsedAt: true, updatedAt: true });

export type FundComparison = typeof fundComparisons.$inferSelect;
export type ComparisonHistory = typeof comparisonHistory.$inferSelect;
export type FundFinancialRatios = typeof fundFinancialRatios.$inferSelect;
export type StockFinancialRatios = typeof stockFinancialRatios.$inferSelect;
export type RecommendationPerformance = typeof recommendationPerformance.$inferSelect;
export type ProductFundamentalsCache = typeof productFundamentalsCache.$inferSelect;
export type AmfiSchemeBenchmark = typeof amfiSchemeBenchmarks.$inferSelect;

export type InsertFundComparison = z.infer<typeof insertFundComparisonSchema>;
export type InsertComparisonHistory = z.infer<typeof insertComparisonHistorySchema>;
export type InsertFundFinancialRatios = z.infer<typeof insertFundFinancialRatiosSchema>;
export type InsertStockFinancialRatios = z.infer<typeof insertStockFinancialRatiosSchema>;
export type InsertRecommendationPerformance = z.infer<typeof insertRecommendationPerformanceSchema>;
export type InsertProductFundamentalsCache = z.infer<typeof insertProductFundamentalsCacheSchema>;
export type InsertAmfiSchemeBenchmark = z.infer<typeof insertAmfiSchemeBenchmarkSchema>;

export const insertMutualFundAmcSchema = createInsertSchema(mutualFundAmcs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MutualFundAmc = typeof mutualFundAmcs.$inferSelect;
export type InsertMutualFundAmc = z.infer<typeof insertMutualFundAmcSchema>;

export const insertMutualFundSchema = createInsertSchema(mutualFunds).omit({
  id: true,
  lastUpdated: true,
});
export type MutualFund = typeof mutualFunds.$inferSelect;
export type InsertMutualFund = z.infer<typeof insertMutualFundSchema>;
