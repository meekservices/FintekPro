import { sql } from "drizzle-orm";
import { boolean, date, decimal, index, integer, jsonb, numeric, pgTable, real, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users as User } from './users';
import { 
  products, 
  Product, 
  mldMaster, 
  pmsMaster, 
  marketingCampaigns 
} from './products';
import { users } from './users';
import { mfHoldings } from './mutual-funds';
import { agents, abTestingExperimentState } from './agents';
import { portfolios } from './portfolio';
import { unlistedCompanies } from './unlisted';
import { bondHoldings } from './bonds';
import { aifMaster } from './ai';
import { documents } from './documents';

// --- Auto-Migrated Tables ---
export const clientAgentRelationships = pgTable("client_agent_relationships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  agentId: varchar("agent_id").references(() => users.id).notNull(), // Agent user ID
  // EUIN/ARN details from agent
  euinNumber: varchar("euin_number").notNull(),
  arnCode: varchar("arn_code"),
  amcCode: varchar("amc_code"),
  distributorId: varchar("distributor_id"),
  // Relationship details
  relationshipType: varchar("relationship_type").default("primary"), // primary, secondary
  isActive: boolean("is_active").default(true),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").references(() => users.id), // Admin who made the assignment
  // Commission and fee structure
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }),
  feeStructure: jsonb("fee_structure"), // Detailed fee breakdown
  // Auto-populate settings for APIs
  autoPopulateEuin: boolean("auto_populate_euin").default(true),
  autoPopulateArn: boolean("auto_populate_arn").default(true),
  // Tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clientTasks = pgTable("client_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  // Task details
  title: varchar("title").notNull(),
  description: text("description"),
  type: varchar("type").notNull(), // 'kyc_renewal', 'document_submission', 'payment_due', 'review_scheduled', 'action_required'
  priority: varchar("priority").default("medium"), // 'low', 'medium', 'high'
  status: varchar("status").default("pending"), // 'pending', 'completed', 'overdue'
  // Due date and completion
  dueDate: date("due_date").notNull(),
  completedAt: timestamp("completed_at"),
  // Action configuration
  actionLabel: varchar("action_label"), // Button text like 'Update KYC', 'Pay Now'
  actionRoute: varchar("action_route"), // Route to navigate on action click
  // Metadata
  metadata: jsonb("metadata"), // Additional task-specific data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const clientSegments = pgTable("client_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // Client type (individual vs non-individual)
  clientType: varchar("client_type").notNull().default("individual"), // individual/business/corporate/trust
  
  // Segment classification (system-derived from investable surplus)
  segment: varchar("segment").notNull(), // retail/hni/shni/bhni/corporate
  segmentThreshold: jsonb("segment_threshold").$type<{
    min: number;
    max: number | null;
    currency: string;
  }>(),
  
  // Segment criteria met
  annualInvestableSurplus: decimal("annual_investable_surplus", { precision: 15, scale: 2 }).notNull(),
  netWorth: decimal("net_worth", { precision: 20, scale: 2 }),
  
  // Product eligibility based on segment
  eligibleProducts: jsonb("eligible_products").$type<string[]>(), // ['mutual_funds', 'stocks', 'pms', 'aif', etc.]
  restrictedProducts: jsonb("restricted_products").$type<string[]>(),
  
  // Investment caps per segment
  investmentCaps: jsonb("investment_caps").$type<{
    pms: number | null;
    aif_cat2: number | null;
    aif_cat3: number | null;
    mld: number | null;
    unlisted: number | null;
  }>(),
  
  // Segment history
  previousSegment: varchar("previous_segment"),
  segmentChangedAt: timestamp("segment_changed_at"),
  segmentChangeReason: text("segment_change_reason"),
  
  // Assessment details
  assessedAt: timestamp("assessed_at").defaultNow(),
  assessedBy: varchar("assessed_by").default("system"), // system/manual
  nextReviewDate: date("next_review_date"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_segments_user").on(table.userId),
  index("idx_client_segments_segment").on(table.segment),
]);

// ============================================================
// CORPORATE TREASURY MODULE - PRD Section 13
// ============================================================

// Treasury Mandates - Corporate treasury policy configuration
export const treasuryMandates = pgTable("treasury_mandates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id), // Corporate user
  entityName: varchar("entity_name").notNull(),
  
  // Treasury objectives (checkbox-based as per wireframe)
  capitalProtection: boolean("capital_protection").default(true), // Mandatory
  liquidityManagement: boolean("liquidity_management").default(false),
  yieldEnhancement: boolean("yield_enhancement").default(false),
  liabilityMatching: boolean("liability_matching").default(false),
  
  // Cash position
  totalCashAvailable: decimal("total_cash_available", { precision: 20, scale: 2 }).notNull(),
  cashDeployed: decimal("cash_deployed", { precision: 20, scale: 2 }).default("0"),
  liquidityAvailableT0: decimal("liquidity_available_t0", { precision: 20, scale: 2 }).default("0"), // Same day
  liquidityAvailableT1: decimal("liquidity_available_t1", { precision: 20, scale: 2 }).default("0"), // Next day
  
  // Risk parameters
  maxCreditRisk: varchar("max_credit_risk").default("AAA"), // AAA/AA+/AA
  maxDurationDays: integer("max_duration_days").default(365),
  maxSingleCounterparty: decimal("max_single_counterparty", { precision: 5, scale: 2 }).default("10"), // Percentage
  
  // Approval configuration
  makerCheckerEnabled: boolean("maker_checker_enabled").default(true),
  authorizedSignatories: jsonb("authorized_signatories").$type<{
    name: string;
    designation: string;
    email: string;
    canApprove: boolean;
    limit: number;
  }[]>(),
  boardResolutionUploaded: boolean("board_resolution_uploaded").default(false),
  boardResolutionUrl: text("board_resolution_url"),
  
  // Status
  status: varchar("status").default("active"), // active/suspended/closed
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_treasury_mandates_user").on(table.userId),
  index("idx_treasury_mandates_status").on(table.status),
]);

// Treasury Allocations - Bucket-wise allocation for corporates
export const treasuryAllocations = pgTable("treasury_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mandateId: varchar("mandate_id").references(() => treasuryMandates.id).notNull(),
  
  // Bucket classification
  bucketType: varchar("bucket_type").notNull(), // operating_cash/liquidity_buffer/short_term_parking/yield_accrual
  bucketName: varchar("bucket_name").notNull(),
  
  // Allocation
  allocatedAmount: decimal("allocated_amount", { precision: 20, scale: 2 }).notNull(),
  currentValue: decimal("current_value", { precision: 20, scale: 2 }).notNull(),
  
  // Target parameters
  targetYield: decimal("target_yield", { precision: 5, scale: 2 }), // Percentage
  maxDuration: integer("max_duration"), // Days
  liquidityDays: integer("liquidity_days"), // T+0, T+1, etc.
  
  // Allowed instruments for this bucket
  allowedInstruments: jsonb("allowed_instruments").$type<string[]>(), // ['overnight_mf', 'liquid_mf', 'tbill', 'cp', 'cd']
  
  // Current holdings summary
  holdingsSummary: jsonb("holdings_summary").$type<{
    instrumentType: string;
    amount: number;
    yield: number;
    maturityDate?: string;
  }[]>(),
  
  // Yield tracking
  expectedAnnualisedYield: decimal("expected_annualised_yield", { precision: 5, scale: 2 }),
  actualYieldMtd: decimal("actual_yield_mtd", { precision: 5, scale: 2 }),
  actualYieldYtd: decimal("actual_yield_ytd", { precision: 5, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_treasury_allocations_mandate").on(table.mandateId),
  index("idx_treasury_allocations_bucket").on(table.bucketType),
]);

// Treasury Proposals - Generated recommendations for corporates
export const treasuryProposals = pgTable("treasury_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mandateId: varchar("mandate_id").references(() => treasuryMandates.id).notNull(),
  
  // Proposal details
  proposalNumber: varchar("proposal_number").notNull(),
  proposalType: varchar("proposal_type").notNull(), // initial_deployment/rebalancing/maturity_reinvestment
  
  // Current state analysis
  currentIdleCash: decimal("current_idle_cash", { precision: 20, scale: 2 }).notNull(),
  currentYield: decimal("current_yield", { precision: 5, scale: 2 }),
  
  // Recommended allocation
  recommendedAllocation: jsonb("recommended_allocation").$type<{
    bucket: string;
    instrument: string;
    instrumentName: string;
    amount: number;
    expectedYield: number;
    maturityDays: number;
    creditRating: string;
  }[]>(),
  
  // Expected outcomes
  expectedTotalYield: decimal("expected_total_yield", { precision: 5, scale: 2 }),
  liquidityTimeline: jsonb("liquidity_timeline").$type<{
    t0: number;
    t1: number;
    t7: number;
    t30: number;
  }>(),
  
  // Risk assessment
  riskNotes: text("risk_notes"),
  creditProfileSummary: text("credit_profile_summary"),
  worstCaseNavImpactBps: integer("worst_case_nav_impact_bps"),
  
  // Approval workflow
  status: varchar("status").default("draft"), // draft/pending_approval/approved/rejected/executed/expired
  makerUserId: varchar("maker_user_id").references(() => users.id),
  checkerUserId: varchar("checker_user_id").references(() => users.id),
  makerApprovedAt: timestamp("maker_approved_at"),
  checkerApprovedAt: timestamp("checker_approved_at"),
  rejectionReason: text("rejection_reason"),
  
  // Execution
  executedAt: timestamp("executed_at"),
  executionDetails: jsonb("execution_details"),
  
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_treasury_proposals_mandate").on(table.mandateId),
  index("idx_treasury_proposals_status").on(table.status),
]);

// ============================================================
// REBALANCING ENGINE - PRD Section 11
// ============================================================

// Rebalancing Recommendations with Reason Codes
export const rebalancingRecommendations = pgTable("rebalancing_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Recommendation type
  recommendationType: varchar("recommendation_type").notNull(), // buy/sell/hold/switch
  priority: varchar("priority").notNull().default("medium"), // high/medium/low
  
  // Trigger reason (PRD Section 11)
  triggerReason: varchar("trigger_reason").notNull(), // over_allocation/under_allocation/goal_deviation/risk_breach/better_alternative/credit_downgrade
  reasonCode: varchar("reason_code").notNull(), // REQ_REBAL_001, etc.
  reasonDescription: text("reason_description").notNull(),
  
  // Asset details
  assetClass: varchar("asset_class").notNull(),
  currentHoldingId: varchar("current_holding_id"),
  productId: varchar("product_id"),
  productName: varchar("product_name"),
  isin: varchar("isin"),
  
  // Current vs Target
  currentAllocation: decimal("current_allocation", { precision: 5, scale: 2 }), // Percentage
  targetAllocation: decimal("target_allocation", { precision: 5, scale: 2 }), // Percentage
  deviationPercent: decimal("deviation_percent", { precision: 5, scale: 2 }),
  
  // Recommendation amounts
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  recommendedAmount: decimal("recommended_amount", { precision: 15, scale: 2 }),
  expectedImpact: jsonb("expected_impact").$type<{
    returnImpact: number;
    riskImpact: number;
    goalImpact: string;
  }>(),
  
  // For SWITCH recommendations
  switchToProductId: varchar("switch_to_product_id"),
  switchToProductName: varchar("switch_to_product_name"),
  switchRationale: text("switch_rationale"),
  
  // Urgency for credit downgrades
  isUrgent: boolean("is_urgent").default(false),
  expiresAt: timestamp("expires_at"),
  
  // Status
  status: varchar("status").default("pending"), // pending/approved/rejected/executed/expired
  actionTakenAt: timestamp("action_taken_at"),
  actionTakenBy: varchar("action_taken_by"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_rebalancing_recs_user").on(table.userId),
  index("idx_rebalancing_recs_status").on(table.status),
  index("idx_rebalancing_recs_trigger").on(table.triggerReason),
]);

// ============================================================
// RETURN FORECASTING ENGINE - PRD Section 9
// ============================================================

// Product Return Forecasts - Metrics per product
export const returnForecasts = pgTable("return_forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Product identification
  productType: varchar("product_type").notNull(), // mutual_fund/stock/bond/mld/pms/aif/treasury
  productId: varchar("product_id").notNull(),
  isin: varchar("isin"),
  productName: varchar("product_name"),
  
  // Return metrics (PRD Section 9)
  expectedReturnCagr: decimal("expected_return_cagr", { precision: 8, scale: 4 }),
  expectedReturnIrr: decimal("expected_return_irr", { precision: 8, scale: 4 }),
  expectedYield: decimal("expected_yield", { precision: 8, scale: 4 }),
  
  // Stress metrics
  stressReturn: decimal("stress_return", { precision: 8, scale: 4 }), // 1-in-20 year scenario
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }),
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  
  // Asset-specific metrics
  assetSpecificMetrics: jsonb("asset_specific_metrics").$type<{
    // Equity
    earningsGrowth?: number;
    valuationMultiple?: number;
    // MF
    rollingAlpha?: number;
    // Debt
    adjustedYtm?: number;
    creditSpread?: number;
    // MLD
    probabilityWeightedPayoff?: number;
    // PMS/AIF
    rollingIrr?: number;
    drawdownPenalty?: number;
    // Treasury
    postTaxYield?: number;
  }>(),
  
  // Horizon-specific forecasts
  forecastHorizons: jsonb("forecast_horizons").$type<{
    horizon: string; // 1y/3y/5y/10y
    expectedReturn: number;
    probability: number;
    rangeMin: number;
    rangeMax: number;
  }[]>(),
  
  // Calculation metadata
  calculationDate: timestamp("calculation_date").defaultNow(),
  dataAsOfDate: date("data_as_of_date"),
  calculationMethod: varchar("calculation_method"),
  confidenceLevel: integer("confidence_level").default(80), // Percentage
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_return_forecasts_product").on(table.productId),
  index("idx_return_forecasts_type").on(table.productType),
]);

// ============================================================
// EXPLAINABILITY & AUDIT - PRD Sections 15 & 17
// ============================================================

// Recommendation Explainability Log
export const recommendationExplanations = pgTable("recommendation_explanations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Reference to recommendation
  recommendationType: varchar("recommendation_type").notNull(), // proposal/rebalancing/treasury
  recommendationId: varchar("recommendation_id").notNull(),
  
  // Explainability (PRD Section 15 - Mandatory)
  whyThisProduct: text("why_this_product").notNull(),
  whichGoalServed: varchar("which_goal_served"),
  goalId: varchar("goal_id"),
  
  // Impact analysis
  returnImpact: text("return_impact").notNull(),
  riskImpact: text("risk_impact").notNull(),
  portfolioImpactBefore: jsonb("portfolio_impact_before").$type<{
    allocation: Record<string, number>;
    expectedReturn: number;
    riskScore: number;
  }>(),
  portfolioImpactAfter: jsonb("portfolio_impact_after").$type<{
    allocation: Record<string, number>;
    expectedReturn: number;
    riskScore: number;
  }>(),
  
  // Suitability justification
  suitabilityCheck: jsonb("suitability_check").$type<{
    riskProfileMatch: boolean;
    horizonMatch: boolean;
    liquidityMatch: boolean;
    regulatoryCompliant: boolean;
  }>(),
  
  // Alternative products considered
  alternativesConsidered: jsonb("alternatives_considered").$type<{
    productId: string;
    productName: string;
    reason: string;
  }[]>(),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_recommendation_explanations_rec").on(table.recommendationId),
  index("idx_recommendation_explanations_goal").on(table.goalId),
]);

// ============================================================
// PROFIT-OPTIMIZED RECOMMENDATION ENGINE - Audit & Compliance
// ============================================================

// Agent Override Audit Log - Immutable compliance trail


export const clientEnrichmentData = pgTable("client_enrichment_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  dataType: varchar("data_type"), // Type of enrichment data
  enrichmentSource: varchar("enrichment_source"), // Source of the enrichment
  rawData: jsonb("raw_data"), // Original API response
  processedData: jsonb("processed_data"), // AI-processed insights
  isProcessed: boolean("is_processed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientEnrichmentDataSchema = createInsertSchema(clientEnrichmentData).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ClientEnrichmentData = typeof clientEnrichmentData.$inferSelect;

export type InsertClientEnrichmentData = typeof clientEnrichmentData.$inferInsert;

export const clientStatements = pgTable(
  "client_statements",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
    statementType: varchar("statement_type").notNull(), // 'monthly', 'quarterly', 'annual', 'custom'
    statementPeriod: varchar("statement_period").notNull(), // 'Jan 2025', 'Q4 2024', '2024-25'
    
    // Period details
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    financialYear: varchar("financial_year"), // '2024-25'
    
    // Statement summary
    openingBalance: decimal("opening_balance", { precision: 15, scale: 2 }).default("0"),
    closingBalance: decimal("closing_balance", { precision: 15, scale: 2 }).default("0"),
    totalInflows: decimal("total_inflows", { precision: 15, scale: 2 }).default("0"),
    totalOutflows: decimal("total_outflows", { precision: 15, scale: 2 }).default("0"),
    totalGains: decimal("total_gains", { precision: 15, scale: 2 }).default("0"),
    totalLosses: decimal("total_losses", { precision: 15, scale: 2 }).default("0"),
    
    // Holdings snapshot
    equityHoldings: jsonb("equity_holdings").default([]),
    mfHoldings: jsonb("mf_holdings").default([]),
    bondHoldings: jsonb("bond_holdings").default([]),
    otherHoldings: jsonb("other_holdings").default([]),
    
    // Transactions included
    transactionIds: jsonb("transaction_ids").default([]), // array of transaction IDs
    transactionCount: integer("transaction_count").default(0),
    
    // File storage
    pdfUrl: text("pdf_url"),
    excelUrl: text("excel_url"),
    
    // Statement metadata
    statementNumber: varchar("statement_number").unique(), // e.g., "STMT-2025-001"
    isConsolidated: boolean("is_consolidated").default(false), // includes all portfolios
    portfolioId: varchar("portfolio_id"), // specific portfolio or null for consolidated
    
    // Generation tracking
    generatedAt: timestamp("generated_at"),
    sentToClient: boolean("sent_to_client").default(false),
    sentAt: timestamp("sent_at"),
    
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_client_statements_user_id").on(table.userId),
    index("idx_client_statements_period").on(table.statementPeriod),
    index("idx_client_statements_type").on(table.statementType),
  ]
);

// ========================================
// Client Reporting & Access Logs
// ========================================

export const generatedReports = pgTable(
  "generated_reports",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
    reportType: varchar("report_type").notNull(), // 'transaction_history', 'account_statement', 'tax_report', 'capital_gains', 'dividend_income'
    reportFormat: varchar("report_format").notNull(), // 'pdf', 'excel', 'csv'
    reportStatus: varchar("report_status").default("pending").notNull(), // 'pending', 'generating', 'completed', 'failed'
    
    // Report parameters
    dateFrom: date("date_from"),
    dateTo: date("date_to"),
    transactionTypes: jsonb("transaction_types"), // array of transaction types to include
    filters: jsonb("filters"), // additional filters applied
    
    // Report metadata
    reportTitle: varchar("report_title"),
    totalTransactions: integer("total_transactions").default(0),
    totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0"),
    
    // File storage
    fileUrl: text("file_url"), // cloud storage URL or local path
    fileSize: integer("file_size"), // in bytes
    fileName: varchar("file_name"),
    
    // Generation tracking
    generatedAt: timestamp("generated_at"),
    expiresAt: timestamp("expires_at"), // for temporary reports
    errorMessage: text("error_message"), // if generation failed
    
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_generated_reports_user_id").on(table.userId),
    index("idx_generated_reports_status").on(table.reportStatus),
    index("idx_generated_reports_type").on(table.reportType),
  ]
);

// Report Access Logs table - audit trail for report access
export const reportAccessLogs = pgTable(
  "report_access_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    reportId: varchar("report_id").references(() => generatedReports.id),
    userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
    accessType: varchar("access_type").notNull(), // 'view', 'download', 'generate', 'share'
    
    // Access details
    ipAddress: varchar("ip_address"),
    userAgent: text("user_agent"),
    accessLocation: varchar("access_location"), // city/country if available
    
    // Compliance tracking
    purpose: text("purpose"), // reason for access (optional for audit)
    complianceNote: text("compliance_note"), // for regulatory audit
    isAuthorized: boolean("is_authorized").default(true),
    
    accessedAt: timestamp("accessed_at").defaultNow(),
  },
  (table) => [
    index("idx_report_access_logs_report_id").on(table.reportId),
    index("idx_report_access_logs_user").on(table.userId),
    index("idx_report_access_logs_type").on(table.accessType),
  ]
);

// Insert schemas for transaction reporting
export const insertGeneratedReportSchema = createInsertSchema(generatedReports).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const clientIntelligence = pgTable("client_intelligence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // CredHive company verification (for corporate clients)
  cin: varchar("cin"),
  companyVerified: boolean("company_verified").default(false),
  
  // Financial health metrics
  probe42Score: integer("probe42_score"), // 1-5 score
  financialHealthStatus: varchar("financial_health_status"), // excellent/good/fair/poor/critical
  
  // Business metrics
  annualRevenue: numeric("annual_revenue", { precision: 15, scale: 2 }),
  netProfit: numeric("net_profit", { precision: 15, scale: 2 }),
  totalAssets: numeric("total_assets", { precision: 15, scale: 2 }),
  
  // Risk indicators
  riskLevel: varchar("risk_level"), // low/medium/high/critical
  riskFactors: jsonb("risk_factors"), // Array of identified risk factors
  legalCases: jsonb("legal_cases"), // Ongoing litigation
  complianceIssues: jsonb("compliance_issues"),
  
  // Opportunity scoring
  crossSellScore: integer("cross_sell_score").default(0), // 0-100
  upsellPotential: varchar("upsell_potential"), // high/medium/low
  recommendedProducts: jsonb("recommended_products"), // AI recommended products
  
  // Group company tracking
  groupCompanies: jsonb("group_companies"), // Related entities
  totalGroupRevenue: numeric("total_group_revenue", { precision: 15, scale: 2 }),
  
  // Refresh tracking
  lastRefreshedAt: timestamp("last_refreshed_at"),
  nextRefreshDue: timestamp("next_refresh_due"),
  refreshFrequency: varchar("refresh_frequency").default("monthly"), // weekly/monthly/quarterly
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_intel_user").on(table.userId),
  index("idx_client_intel_score").on(table.probe42Score),
  index("idx_client_intel_risk").on(table.riskLevel),
]);

// Insert schemas and types for marketing tables
export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientIntelligenceSchema = createInsertSchema(clientIntelligence).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ClientIntelligence = typeof clientIntelligence.$inferSelect;

export type InsertClientIntelligence = z.infer<typeof insertClientIntelligenceSchema>;

export const clientUnlistedDisclosureLog = pgTable("client_unlisted_disclosure_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  companyId: varchar("company_id").references(() => unlistedCompanies.id),
  proposalId: varchar("proposal_id"),
  disclosureVersion: varchar("disclosure_version", { length: 20 }).notNull(), // semver e.g. "1.2.0"
  disclosureHash: varchar("disclosure_hash", { length: 64 }).notNull(),       // SHA-256 of disclosure text
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow().notNull(),
}, (table) => [
  index("idx_disclosure_log_client").on(table.clientId),
  index("idx_disclosure_log_company").on(table.companyId),
  index("idx_disclosure_log_proposal").on(table.proposalId),
  index("idx_disclosure_log_acknowledged").on(table.acknowledgedAt),
]);

export const insertClientUnlistedDisclosureLogSchema = createInsertSchema(clientUnlistedDisclosureLog).extend({
  id: z.any(),
  acknowledgedAt: z.any(),
}).omit({
  id: true,
  acknowledgedAt: true,
});

export type ClientUnlistedDisclosureLog = typeof clientUnlistedDisclosureLog.$inferSelect;

export type InsertClientUnlistedDisclosureLog = z.infer<typeof insertClientUnlistedDisclosureLogSchema>;

export const clientPortfolioAif = pgTable("client_portfolio_aif", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Client/User Reference
  clientId: varchar("client_id").notNull().references(() => users.id),
  addedByUserId: varchar("added_by_user_id").references(() => users.id), // Agent or client
  
  // AIF Reference
  aifId: varchar("aif_id").references(() => aifMaster.id),
  aifName: text("aif_name").notNull(), // Denormalized for quick display
  registrationNo: text("registration_no"),
  category: text("category"), // Category I, II, III
  subcategory: text("subcategory"), // Strategy type
  
  // Investment Details - Commitment Model
  commitmentAmount: decimal("commitment_amount", { precision: 15, scale: 2 }).notNull(), // Total commitment
  capitalCalled: decimal("capital_called", { precision: 15, scale: 2 }).notNull(), // Capital called to date
  capitalUncalled: decimal("capital_uncalled", { precision: 15, scale: 2 }), // Remaining commitment
  
  // Investment Dates
  investedDate: date("invested_date").notNull(),
  lockinEndDate: date("lockin_end_date"),
  
  // Units and NAV
  currentUnits: decimal("current_units", { precision: 15, scale: 4 }),
  entryNav: decimal("entry_nav", { precision: 15, scale: 4 }),
  latestNav: decimal("latest_nav", { precision: 15, scale: 4 }),
  lastNavDate: date("last_nav_date"),
  
  // Valuation
  costOfInvestment: decimal("cost_of_investment", { precision: 15, scale: 2 }),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }), // Auto-calculated or manual
  unrealizedGainLoss: decimal("unrealized_gain_loss", { precision: 15, scale: 2 }),
  unrealizedGainLossPercent: decimal("unrealized_gain_loss_percent", { precision: 8, scale: 4 }),
  
  // Distributions
  distributionsReceived: decimal("distributions_received", { precision: 15, scale: 2 }).default("0"),
  lastDistributionDate: date("last_distribution_date"),
  
  // Documents
  documents: jsonb("documents").default([]), // Array of { type, name, url, uploadedAt }
  
  // Approval Status
  entryStatus: text("entry_status").default("pending"), // pending, approved, rejected, needs_review
  approvedByUserId: varchar("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  // Notes
  notes: text("notes"),
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_client_portfolio_aif_client").on(table.clientId),
  index("idx_client_portfolio_aif_aif").on(table.aifId),
  index("idx_client_portfolio_aif_status").on(table.entryStatus),
]);

export const insertClientPortfolioAifSchema = createInsertSchema(clientPortfolioAif).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ClientPortfolioAif = typeof clientPortfolioAif.$inferSelect;

export type InsertClientPortfolioAif = z.infer<typeof insertClientPortfolioAifSchema>;

export const clientPortfolioPms = pgTable("client_portfolio_pms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Client/User Reference
  clientId: varchar("client_id").notNull().references(() => users.id),
  addedByUserId: varchar("added_by_user_id").references(() => users.id), // Agent or client
  
  // PMS Reference
  pmsId: varchar("pms_id").references(() => pmsMaster.id),
  pmsName: text("pms_name").notNull(), // Denormalized for quick display
  registrationNo: text("registration_no"),
  strategy: text("strategy"), // Strategy type
  
  // Investment Details
  investedAmount: decimal("invested_amount", { precision: 15, scale: 2 }).notNull(), // Initial investment
  additionalInfusions: decimal("additional_infusions", { precision: 15, scale: 2 }).default("0"),
  totalInvested: decimal("total_invested", { precision: 15, scale: 2 }), // Sum of all investments
  
  // Dates
  startDate: date("start_date").notNull(),
  lastInfusionDate: date("last_infusion_date"),
  
  // Current Valuation
  corpusValue: decimal("corpus_value", { precision: 15, scale: 2 }), // Current portfolio value
  latestNav: decimal("latest_nav", { precision: 15, scale: 4 }),
  lastNavDate: date("last_nav_date"),
  
  // Performance
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  unrealizedGainLoss: decimal("unrealized_gain_loss", { precision: 15, scale: 2 }),
  unrealizedGainLossPercent: decimal("unrealized_gain_loss_percent", { precision: 8, scale: 4 }),
  absoluteReturn: decimal("absolute_return", { precision: 8, scale: 4 }),
  cagr: decimal("cagr", { precision: 8, scale: 4 }), // Annualized return
  
  // Withdrawals
  withdrawalsReceived: decimal("withdrawals_received", { precision: 15, scale: 2 }).default("0"),
  lastWithdrawalDate: date("last_withdrawal_date"),
  
  // Documents
  documents: jsonb("documents").default([]), // Array of { type, name, url, uploadedAt }
  
  // Approval Status
  entryStatus: text("entry_status").default("pending"), // pending, approved, rejected, needs_review
  approvedByUserId: varchar("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  // Notes
  notes: text("notes"),
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_client_portfolio_pms_client").on(table.clientId),
  index("idx_client_portfolio_pms_pms").on(table.pmsId),
  index("idx_client_portfolio_pms_status").on(table.entryStatus),
]);

export const insertClientPortfolioPmsSchema = createInsertSchema(clientPortfolioPms).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ClientPortfolioPms = typeof clientPortfolioPms.$inferSelect;

export type InsertClientPortfolioPms = z.infer<typeof insertClientPortfolioPmsSchema>;

export const clientPortfolioMld = pgTable("client_portfolio_mld", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Client/User Reference
  clientId: varchar("client_id").notNull().references(() => users.id),
  addedByUserId: varchar("added_by_user_id").references(() => users.id), // Agent or client
  
  // MLD Reference
  mldId: varchar("mld_id").references(() => mldMaster.id),
  isin: text("isin").notNull(),
  mldName: text("mld_name").notNull(), // Denormalized for quick display
  issuer: text("issuer"),
  underlying: text("underlying"),
  payoffType: text("payoff_type"),
  
  // Investment Details
  purchasePrice: decimal("purchase_price", { precision: 15, scale: 4 }).notNull(),
  purchaseDate: date("purchase_date").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 2 }).notNull(), // Number of units/face value
  faceValue: decimal("face_value", { precision: 15, scale: 2 }),
  totalInvested: decimal("total_invested", { precision: 15, scale: 2 }), // purchase_price * quantity
  
  // Maturity
  maturityDate: date("maturity_date"),
  expectedPayoffScenario: text("expected_payoff_scenario"), // bull, base, bear
  expectedPayoffAmount: decimal("expected_payoff_amount", { precision: 15, scale: 2 }),
  
  // Current Valuation
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  lastPriceDate: date("last_price_date"),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  unrealizedGainLoss: decimal("unrealized_gain_loss", { precision: 15, scale: 2 }),
  unrealizedGainLossPercent: decimal("unrealized_gain_loss_percent", { precision: 8, scale: 4 }),
  
  // Risk Metrics
  riskScore: integer("risk_score"),
  creditRiskExposure: decimal("credit_risk_exposure", { precision: 15, scale: 2 }),
  
  // Documents
  documents: jsonb("documents").default([]), // Array of { type, name, url, uploadedAt }
  
  // Approval Status
  entryStatus: text("entry_status").default("pending"), // pending, approved, rejected, needs_review
  approvedByUserId: varchar("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  // Notes
  notes: text("notes"),
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_client_portfolio_mld_client").on(table.clientId),
  index("idx_client_portfolio_mld_mld").on(table.mldId),
  index("idx_client_portfolio_mld_isin").on(table.isin),
  index("idx_client_portfolio_mld_status").on(table.entryStatus),
]);

export const insertClientPortfolioMldSchema = createInsertSchema(clientPortfolioMld).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ClientPortfolioMld = typeof clientPortfolioMld.$inferSelect;

export type InsertClientPortfolioMld = z.infer<typeof insertClientPortfolioMldSchema>;
export const insertReportAccessLogSchema = createInsertSchema(reportAccessLogs).extend({
  id: z.any(),
  accessedAt: z.any(),
}).omit({
  id: true,
  accessedAt: true,
});

export const insertClientStatementSchema = createInsertSchema(clientStatements).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for transaction reporting
export type GeneratedReport = typeof generatedReports.$inferSelect;
export type InsertGeneratedReport = z.infer<typeof insertGeneratedReportSchema>;
export type ReportAccessLog = typeof reportAccessLogs.$inferSelect;
export type InsertReportAccessLog = z.infer<typeof insertReportAccessLogSchema>;
export type ClientStatement = typeof clientStatements.$inferSelect;
export type InsertClientStatement = z.infer<typeof insertClientStatementSchema>;
