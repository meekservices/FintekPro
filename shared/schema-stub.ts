import {
  pgTable, pgEnum, serial, uuid, varchar, text, boolean, integer,
  timestamp, date, decimal, numeric, jsonb,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: This file is intentionally self-contained and does NOT import
// from ./schema.  Importing from schema.ts (33k lines) causes drizzle-kit to
// evaluate all table definitions in that file and try to manage thousands of
// tables it doesn't own — generating destructive DROP statements.
//
// Rule: every object declared here must mirror what is already in the DB.
//       drizzle-kit push will only manage the tables and enum types listed
//       below and leave every other DB object untouched.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Enum types ──────────────────────────────────────────────────────────────
// Declared so drizzle-kit recognises them and does not generate DROP TYPE.
// Values are sourced from pg_enum in the production DB.

export const aiVerificationStatus = pgEnum("ai_verification_status", [
  "pending","ca_uploaded","esign_pending","esign_completed","submitted","approved","rejected","expired",
]);
export const aiWorkflowStep = pgEnum("ai_workflow_step", [
  "ca_upload","esign","bse_submission","completed",
]);
export const apiHealthStatus = pgEnum("api_health_status", [
  "healthy","degraded","down","unknown",
]);
export const auditActionType = pgEnum("audit_action_type", [
  "create","read","update","delete","execute","approve","reject",
]);
export const bankConnectorType = pgEnum("bank_connector_type", [
  "api","sftp","portal","email","webhook",
]);
export const bankIntegrationType = pgEnum("bank_integration_type", [
  "api","sftp","portal","email","webhook",
]);
export const bankInteractionEventType = pgEnum("bank_interaction_event_type", [
  "RECEIVED","QUERY","APPROVED","DISBURSED",
]);
export const bankInteractionReporter = pgEnum("bank_interaction_reporter", [
  "AGENT","WEBHOOK","ADMIN",
]);
export const clientMode = pgEnum("client_mode", [
  "new","existing",
]);
export const commissionPlanStatus = pgEnum("commission_plan_status", [
  "draft","active","frozen","archived",
]);
export const devApprovalStatus = pgEnum("dev_approval_status", [
  "OBTAINED","APPLIED","PENDING","NOT_REQUIRED","REJECTED",
]);
export const documentUploader = pgEnum("document_uploader", [
  "agent","client","system",
]);
export const dsaLoanStatus = pgEnum("dsa_loan_status", [
  "draft","submitted","eligibility_check","routed","pending_with_banks","in_review",
  "conditionally_approved","documents_pending","approved","rejected","withdrawn",
  "disbursement_pending","disbursed","cancelled",
]);
export const encumbranceStatus = pgEnum("encumbrance_status", [
  "CLEAR","ENCUMBERED","PARTIALLY_CLEAR","UNDER_VERIFICATION",
]);
export const errorSeverity = pgEnum("error_severity", [
  "critical","high","medium","low","info",
]);
export const errorSource = pgEnum("error_source", [
  "frontend","backend","service","external_api",
]);
export const kycStatus = pgEnum("kyc_status", [
  "pending","in_progress","completed","cancelled",
]);
export const kycTier = pgEnum("kyc_tier", [
  "tier_1","tier_2","tier_3",
]);
export const leadProcessingMode = pgEnum("lead_processing_mode", [
  "PLATFORM","EXTERNAL_FINANCIER",
]);
export const leadStatus = pgEnum("lead_status", [
  "REGISTERED","LOGGED_IN","APPROVED","DISBURSED",
]);
export const lenderCategory = pgEnum("lender_category", [
  "PSU_BANK","PRIVATE_BANK","HFC","NBFC","AIF_PLATFORM",
]);
export const loanSubType = pgEnum("loan_sub_type", [
  "BUILDER_FUNDING","PROJECT_FUNDING","CONSTRUCTION_FINANCE","LRD","LAND_FINANCE",
  "INVENTORY_FINANCE","MEZZANINE","BRIDGE",
]);
export const loanVertical = pgEnum("loan_vertical", [
  "RETAIL","MSME","DEVELOPER",
]);
export const masterDsaClaimStatus = pgEnum("master_dsa_claim_status", [
  "DRAFT","SUBMITTED","ACKNOWLEDGED","PAID","PARTIALLY_PAID","DISPUTED","REJECTED",
]);
export const originationMode = pgEnum("origination_mode", [
  "SELF_SERVICE","AGENT_ASSISTED",
]);
export const passthroughRule = pgEnum("passthrough_rule", [
  "stop","roll_up",
]);
export const payoutClaimStatus = pgEnum("payout_claim_status", [
  "PENDING_VERIFICATION","CONFIRMED_BY_FINANCIER","APPROVED","ON_HOLD_PDD","REJECTED","CLAWED_BACK",
]);
export const payoutMode = pgEnum("payout_mode", [
  "upfront","trail","revenue_share","performance",
]);
export const pddStatus = pgEnum("pdd_status", [
  "NOT_APPLICABLE","PENDING","CLEARED","EXCEPTION_ALLOWED",
]);
export const pickCategory = pgEnum("pick_category", [
  "listed_stocks","mutual_funds","bonds","unlisted","global_stocks","etfs","reits_invits",
  "fixed_deposits","sgb","derivatives",
]);
export const pickStatus = pgEnum("pick_status", [
  "live","target_hit","stoploss_hit","expired",
]);
export const projectStage = pgEnum("project_stage", [
  "LAND_ACQUISITION","APPROVALS","CONSTRUCTION_EARLY","CONSTRUCTION_MID","CONSTRUCTION_ADVANCED",
  "NEAR_COMPLETION","COMPLETED","POSSESSION",
]);
export const proposalVerdictValue = pgEnum("proposal_verdict_value", [
  "BUY","HOLD","SELL",
]);
export const routingIntent = pgEnum("routing_intent", [
  "MARKETPLACE","SPECIFIC_BANKS",
]);
export const routingMode = pgEnum("routing_mode", [
  "auto","manual",
]);
export const routingStrategy = pgEnum("routing_strategy", [
  "parallel","waterfall","priority_first",
]);
export const sipSourceType = pgEnum("sip_source_type", [
  "rebalancing","fresh","hybrid",
]);
export const titleStatus = pgEnum("title_status", [
  "CLEAR","DISPUTED","UNDER_LITIGATION","UNDER_VERIFICATION",
]);
export const tranchStatus = pgEnum("tranch_status", [
  "PENDING","RELEASED","ON_HOLD","CANCELLED",
]);
export const workflowOwner = pgEnum("workflow_owner", [
  "SYSTEM","AGENT",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────
// Inline definitions — identical to the corresponding definitions in schema.ts.
// Do NOT replace these with re-exports from schema.ts (see header comment).

export const agentNotifications = pgTable("agent_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: varchar("agent_id", { length: 100 }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: varchar("type", { length: 30 }).notNull().default("prospect"),
  link: text("link"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_notifications_agent").on(table.agentId),
  index("idx_agent_notifications_created").on(table.createdAt),
]);

export const corporateActions = pgTable("corporate_actions", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 50 }),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  exDate: date("ex_date").notNull(),
  recordDate: date("record_date"),
  payDate: date("pay_date"),
  ratio: varchar("ratio", { length: 30 }),
  adjustmentFactor: decimal("adjustment_factor", { precision: 15, scale: 8 }),
  dividendAmount: decimal("dividend_amount", { precision: 15, scale: 4 }),
  purpose: text("purpose"),
  isAppliedToGoldenPrices: boolean("is_applied_to_golden_prices").default(false),
  appliedAt: timestamp("applied_at"),
  source: varchar("source", { length: 50 }).default("NSE"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_corp_actions_isin").on(table.isin),
  index("idx_corp_actions_ex_date").on(table.exDate),
  index("idx_corp_actions_type").on(table.actionType),
  index("idx_corp_actions_applied").on(table.isAppliedToGoldenPrices),
  uniqueIndex("idx_corp_actions_isin_ex_type").on(table.isin, table.exDate, table.actionType),
]);

export const priceAdjustments = pgTable("price_adjustments", {
  id: serial("id").primaryKey(),
  corporateActionId: integer("corporate_action_id").notNull(),
  isin: varchar("isin", { length: 20 }).notNull(),
  priceDate: date("price_date").notNull(),
  originalPrice: decimal("original_price", { precision: 20, scale: 6 }).notNull(),
  adjustedPrice: decimal("adjusted_price", { precision: 20, scale: 6 }).notNull(),
  adjustmentFactor: decimal("adjustment_factor", { precision: 15, scale: 8 }).notNull(),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
}, (table) => [
  index("idx_price_adj_isin").on(table.isin),
  index("idx_price_adj_corp_action").on(table.corporateActionId),
  index("idx_price_adj_date").on(table.priceDate),
]);

export const symbolMapping = pgTable("symbol_mapping", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerSymbol: varchar("provider_symbol", { length: 100 }).notNull(),
  providerName: text("provider_name"),
  isPrimary: boolean("is_primary").default(false),
  isActive: boolean("is_active").default(true),
  lastVerifiedAt: timestamp("last_verified_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_symbol_mapping_isin").on(table.isin),
  index("idx_symbol_mapping_provider").on(table.provider),
  index("idx_symbol_mapping_symbol").on(table.providerSymbol),
  uniqueIndex("idx_symbol_mapping_isin_provider").on(table.isin, table.provider),
]);

export const creditRatings = pgTable("credit_ratings", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  instrumentName: text("instrument_name"),
  rating: varchar("rating", { length: 20 }).notNull(),
  ratingOutlook: varchar("rating_outlook", { length: 30 }),
  agency: varchar("agency", { length: 30 }).notNull(),
  ratingDate: date("rating_date").notNull(),
  previousRating: varchar("previous_rating", { length: 20 }),
  ratingAction: varchar("rating_action", { length: 40 }),
  isCurrent: boolean("is_current").default(true),
  source: varchar("source", { length: 50 }).default("bonds_table"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_credit_ratings_isin").on(table.isin),
  index("idx_credit_ratings_agency").on(table.agency),
  index("idx_credit_ratings_date").on(table.ratingDate),
  index("idx_credit_ratings_current").on(table.isCurrent),
]);

// instrument_returns is created at runtime by the Golden Pricing Engine via raw SQL
// (server/db-migrations/golden-pricing-migration.ts). This stub definition mirrors
// that raw SQL exactly so drizzle-kit treats the table as known and does not drop it.
export const instrumentReturns = pgTable("instrument_returns", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 50 }),
  asOfDate: date("as_of_date").notNull(),
  assetClass: varchar("asset_class", { length: 30 }).notNull().default("equity"),
  currentPrice: decimal("current_price", { precision: 20, scale: 6 }),
  return1d: decimal("return_1d", { precision: 10, scale: 8 }),
  return1w: decimal("return_1w", { precision: 10, scale: 8 }),
  return1m: decimal("return_1m", { precision: 10, scale: 8 }),
  return3m: decimal("return_3m", { precision: 10, scale: 8 }),
  return6m: decimal("return_6m", { precision: 10, scale: 8 }),
  returnYtd: decimal("return_ytd", { precision: 10, scale: 8 }),
  return1y: decimal("return_1y", { precision: 10, scale: 8 }),
  return3y: decimal("return_3y", { precision: 10, scale: 8 }),
  return5y: decimal("return_5y", { precision: 10, scale: 8 }),
  price1dAgo: decimal("price_1d_ago", { precision: 20, scale: 6 }),
  price1wAgo: decimal("price_1w_ago", { precision: 20, scale: 6 }),
  price1mAgo: decimal("price_1m_ago", { precision: 20, scale: 6 }),
  price3mAgo: decimal("price_3m_ago", { precision: 20, scale: 6 }),
  price6mAgo: decimal("price_6m_ago", { precision: 20, scale: 6 }),
  price1yAgo: decimal("price_1y_ago", { precision: 20, scale: 6 }),
  absChange1d: decimal("abs_change_1d", { precision: 20, scale: 6 }),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
}, (table) => [
  index("idx_instr_ret_isin").on(table.isin),
  index("idx_instr_ret_date").on(table.asOfDate),
]);
