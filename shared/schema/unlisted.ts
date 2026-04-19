import { sql } from "drizzle-orm";
import { bigint, boolean, date, decimal, index, integer, jsonb, numeric, pgTable, real, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { agents } from './agents';
import { users } from './users';
import { Document } from './documents';

// --- Auto-Migrated Tables ---
export const unlistedCompanies = pgTable("unlisted_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  cin: varchar("cin").unique(), // Corporate Identification Number
  isin: varchar("isin"), // International Securities Identification Number
  sector: varchar("sector"),
  industry: varchar("industry"),
  rocState: varchar("roc_state"), // Registrar of Companies state
  incorporationDate: date("incorporation_date"),
  paidUpCapital: decimal("paid_up_capital", { precision: 20, scale: 2 }),
  authorizedCapital: decimal("authorized_capital", { precision: 20, scale: 2 }),
  faceValue: decimal("face_value", { precision: 10, scale: 2 }),
  totalShares: bigint("total_shares", { mode: "number" }),
  
  // Probe42 Integration
  probe42CompanyId: varchar("probe42_company_id"),
  lastSyncedAt: timestamp("last_synced_at"),
  
  // Identity Confidence (Epic 1 - Financial Data Enrichment)
  identityConfidence: decimal("identity_confidence", { precision: 3, scale: 2 }), // 0.00 to 1.00
  identityStatus: varchar("identity_status").default("review"), // active, review, blocked
  probe42RawResponse: jsonb("probe42_raw_response"), // Raw API response for audit
  
  // Company Status
  status: varchar("status").default("active").notNull(), // active, inactive, delisted
  listingStage: varchar("listing_stage"), // unlisted, pre_ipo, growth, mature
  
  // Pricing Workflow
  pricingStatus: varchar("pricing_status").default("draft"), // draft, pending_review, published
  draftBuyPrice: decimal("draft_buy_price", { precision: 20, scale: 2 }),
  draftSellPrice: decimal("draft_sell_price", { precision: 20, scale: 2 }),
  publishedBuyPrice: decimal("published_buy_price", { precision: 20, scale: 2 }),
  publishedSellPrice: decimal("published_sell_price", { precision: 20, scale: 2 }),
  pricePublishedAt: timestamp("price_published_at"),
  pricePublishedBy: varchar("price_published_by").references(() => users.id),
  
  // Compliance Status
  complianceStatus: varchar("compliance_status").default("pending"), // pending, cleared, blocked
  complianceBlockReasons: jsonb("compliance_block_reasons").default([]), // Array of blocking reasons
  complianceRiskScore: integer("compliance_risk_score").default(0), // 0-100
  complianceLastCheckedAt: timestamp("compliance_last_checked_at"),
  
  // Trading Controls
  tradingSuspended: boolean("trading_suspended").default(false),
  tradingSuspendedAt: timestamp("trading_suspended_at"),
  tradingSuspendedBy: varchar("trading_suspended_by").references(() => users.id),
  tradingSuspendedReason: text("trading_suspended_reason"),

  // Institutional Governance (Epic: Unlisted Asset Lifecycle)
  riskCategory: varchar("risk_category").default("very_high"),        // very_high (default for all unlisted)
  rebalanceEligible: boolean("rebalance_eligible").default(false),     // always false for unlisted
  liquidityWeight: decimal("liquidity_weight", { precision: 5, scale: 2 }).default("0"), // 0 = fully illiquid
  valuationStatus: varchar("valuation_status").default("pending"),     // pending | current | stale
  lastValuationDate: date("last_valuation_date"),
  enrichmentFailedAt: timestamp("enrichment_failed_at"),               // null = last attempt succeeded

  // Additional Info
  website: varchar("website"),
  description: text("description"),
  logo: varchar("logo"),
  tags: jsonb("tags").default([]),
  directors: jsonb("directors").default([]), // Array of director details from Probe42
  listedPeers: jsonb("listed_peers").default([]), // Array of listed peer companies for comparison
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_unlisted_companies_cin").on(table.cin),
  index("idx_unlisted_companies_probe42").on(table.probe42CompanyId),
  index("idx_unlisted_companies_status").on(table.status),
  index("idx_unlisted_companies_sector").on(table.sector),
  index("idx_unlisted_companies_pricing_status").on(table.pricingStatus),
  index("idx_unlisted_companies_compliance_status").on(table.complianceStatus),
]);

// Unlisted Marketplace Audit Log - tracks compliance overrides, price changes, suspensions
export const unlistedAuditLog = pgTable("unlisted_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  actionType: varchar("action_type").notNull(), // price_saved, price_published, compliance_override, trading_suspended, trading_resumed
  actionBy: varchar("action_by").notNull(), // system identifier or admin/agent id string (no FK - stores system_ prefixed values)
  
  // Price Change Details
  previousBuyPrice: decimal("previous_buy_price", { precision: 20, scale: 2 }),
  previousSellPrice: decimal("previous_sell_price", { precision: 20, scale: 2 }),
  newBuyPrice: decimal("new_buy_price", { precision: 20, scale: 2 }),
  newSellPrice: decimal("new_sell_price", { precision: 20, scale: 2 }),
  priceChangePercent: decimal("price_change_percent", { precision: 10, scale: 2 }),
  
  // Compliance Details
  complianceFlags: jsonb("compliance_flags").default([]), // Flags that were overridden or present
  overrideReason: text("override_reason"),
  
  // Metadata
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_unlisted_audit_company").on(table.companyId),
  index("idx_unlisted_audit_action").on(table.actionType),
  index("idx_unlisted_audit_user").on(table.actionBy),
  index("idx_unlisted_audit_date").on(table.createdAt),
]);

// Company Financials table
export const companyFinancials = pgTable("company_financials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  financialYear: varchar("financial_year").notNull(), // e.g., "FY2023-24"
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  
  // Income Statement
  revenue: decimal("revenue", { precision: 20, scale: 2 }),
  ebitda: decimal("ebitda", { precision: 20, scale: 2 }),
  ebit: decimal("ebit", { precision: 20, scale: 2 }),
  pbt: decimal("pbt", { precision: 20, scale: 2 }), // Profit Before Tax
  pat: decimal("pat", { precision: 20, scale: 2 }), // Profit After Tax
  netProfit: decimal("net_profit", { precision: 20, scale: 2 }),
  
  // Balance Sheet
  totalAssets: decimal("total_assets", { precision: 20, scale: 2 }),
  totalLiabilities: decimal("total_liabilities", { precision: 20, scale: 2 }),
  networth: decimal("networth", { precision: 20, scale: 2 }),
  shareCapital: decimal("share_capital", { precision: 20, scale: 2 }),
  reserves: decimal("reserves", { precision: 20, scale: 2 }),
  
  // Debt Information
  totalDebt: decimal("total_debt", { precision: 20, scale: 2 }),
  longTermDebt: decimal("long_term_debt", { precision: 20, scale: 2 }),
  shortTermDebt: decimal("short_term_debt", { precision: 20, scale: 2 }),
  
  // Cash Flow
  operatingCashFlow: decimal("operating_cash_flow", { precision: 20, scale: 2 }),
  investingCashFlow: decimal("investing_cash_flow", { precision: 20, scale: 2 }),
  financingCashFlow: decimal("financing_cash_flow", { precision: 20, scale: 2 }),
  freeCashFlow: decimal("free_cash_flow", { precision: 20, scale: 2 }),
  
  // Source & Metadata
  dataSource: varchar("data_source").default("probe42"), // probe42, manual, company_filing
  verified: boolean("verified").default(false),
  
  // Data Usage Flags (Epic 8 - AI & Advisory Guardrails)
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }), // 0.00 to 1.00
  aiAllowed: boolean("ai_allowed").default(true), // Can AI use this data?
  lockedForAdvisory: boolean("locked_for_advisory").default(false), // Post-disclosure lock
  executionAllowed: boolean("execution_allowed").default(true), // Can execute trades based on this?
  dataQualityScore: integer("data_quality_score"), // 0-100 composite score
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_company_financials_company").on(table.companyId),
  index("idx_company_financials_fy").on(table.financialYear),
]);

// Company Ratios table
export const companyRatios = pgTable("company_ratios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  financialYear: varchar("financial_year").notNull(),
  
  // Valuation Ratios
  peRatio: decimal("pe_ratio", { precision: 10, scale: 2 }),
  pbRatio: decimal("pb_ratio", { precision: 10, scale: 2 }),
  evEbitda: decimal("ev_ebitda", { precision: 10, scale: 2 }),
  priceToSales: decimal("price_to_sales", { precision: 10, scale: 2 }),
  
  // Profitability Ratios
  roe: decimal("roe", { precision: 10, scale: 4 }), // Return on Equity
  roce: decimal("roce", { precision: 10, scale: 4 }), // Return on Capital Employed
  roa: decimal("roa", { precision: 10, scale: 4 }), // Return on Assets
  marginEbitda: decimal("margin_ebitda", { precision: 10, scale: 4 }),
  marginPat: decimal("margin_pat", { precision: 10, scale: 4 }),
  marginOperating: decimal("margin_operating", { precision: 10, scale: 4 }),
  
  // Leverage Ratios
  debtEquity: decimal("debt_equity", { precision: 10, scale: 4 }),
  debtToAssets: decimal("debt_to_assets", { precision: 10, scale: 4 }),
  interestCoverage: decimal("interest_coverage", { precision: 10, scale: 2 }),
  
  // Liquidity Ratios
  currentRatio: decimal("current_ratio", { precision: 10, scale: 2 }),
  quickRatio: decimal("quick_ratio", { precision: 10, scale: 2 }),
  
  // Efficiency Ratios
  assetTurnover: decimal("asset_turnover", { precision: 10, scale: 4 }),
  inventoryTurnover: decimal("inventory_turnover", { precision: 10, scale: 2 }),
  
  // Growth Metrics
  revenueGrowth: decimal("revenue_growth", { precision: 10, scale: 4 }),
  profitGrowth: decimal("profit_growth", { precision: 10, scale: 4 }),
  
  // Source & Metadata
  dataSource: varchar("data_source").default("probe42"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_company_ratios_company").on(table.companyId),
  index("idx_company_ratios_fy").on(table.financialYear),
]);

// ============================================================
// FINANCIAL DATA ENRICHMENT TABLES (Epics 2, 3, 5, 6)
// Multi-source identity mapping and audit logging for SEBI compliance
// ============================================================

// Company External Mapping - Maps FintekPro companies to external data sources
export const companyExternalMapping = pgTable("company_external_mapping", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  
  // External Source Information
  source: varchar("source").notNull(), // FINNHUB, SIMFIN, YAHOO, PROBE42, MCA
  externalId: varchar("external_id").notNull(), // External system's company ID
  externalSymbol: varchar("external_symbol"), // Trading symbol if applicable
  
  // Match Quality
  matchMethod: varchar("match_method").notNull(), // ISIN, CIN, SYMBOL, NAME, MANUAL
  matchScore: decimal("match_score", { precision: 3, scale: 2 }), // 0.00 to 1.00
  matchVerified: boolean("match_verified").default(false),
  
  // Locking (prevents auto-updates after verification)
  locked: boolean("locked").default(false),
  lockedAt: timestamp("locked_at"),
  lockedBy: varchar("locked_by").references(() => users.id),
  lockReason: text("lock_reason"),
  
  // Verification
  verifiedBy: varchar("verified_by"), // SYSTEM, ADMIN
  verifiedAt: timestamp("verified_at"),
  verifiedByUserId: varchar("verified_by_user_id").references(() => users.id),
  
  // Metadata
  lastFetchedAt: timestamp("last_fetched_at"),
  fetchSuccessCount: integer("fetch_success_count").default(0),
  fetchFailureCount: integer("fetch_failure_count").default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_company_external_mapping_company").on(table.companyId),
  index("idx_company_external_mapping_source").on(table.source),
  index("idx_company_external_mapping_external").on(table.source, table.externalId),
]);

// Financial Audit Log - SEBI-compliant provenance tracking for every financial number
export const financialAuditLog = pgTable("financial_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  
  // What was changed/retrieved
  metric: varchar("metric").notNull(), // revenue, ebitda, pat, total_assets, etc.
  metricValue: decimal("metric_value", { precision: 20, scale: 2 }),
  metricValueText: text("metric_value_text"), // For non-numeric values
  previousValue: decimal("previous_value", { precision: 20, scale: 2 }),
  financialYear: varchar("financial_year").notNull(),
  period: varchar("period"), // Q1, Q2, Q3, Q4, ANNUAL
  currency: varchar("currency").default("INR"),
  
  // Source Information
  source: varchar("source").notNull(), // PROBE42, FINNHUB, SIMFIN, YAHOO, MANUAL, MCA
  sourceResponseId: varchar("source_response_id"), // Reference to raw API response
  probe42Reference: varchar("probe42_reference"), // Probe42 company ID for traceability
  
  // Confidence & Quality
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }), // 0.00 to 1.00
  dataQualityFlags: jsonb("data_quality_flags").default([]), // Array of flags: ESTIMATED, RESTATED, AUDITED
  
  // Usage Tracking (for "Why This Number?" API)
  usedIn: varchar("used_in"), // AI, REPORT, ADVISORY, DISPLAY, TRADE_EXECUTION
  usedAt: timestamp("used_at"),
  usedByUserId: varchar("used_by_user_id").references(() => users.id),
  
  // Action Type
  actionType: varchar("action_type").notNull(), // FETCH, UPDATE, OVERRIDE, DELETE, MERGE
  actionBy: varchar("action_by"), // SYSTEM, ADMIN, USER
  actionByUserId: varchar("action_by_user_id").references(() => users.id),
  actionReason: text("action_reason"), // Mandatory for overrides
  
  // Immutability
  hashPrevious: varchar("hash_previous"), // SHA-256 hash of previous record for chain verification
  hashCurrent: varchar("hash_current"), // SHA-256 hash of this record
  
  // Metadata
  retrievedAt: timestamp("retrieved_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_financial_audit_log_company").on(table.companyId),
  index("idx_financial_audit_log_metric").on(table.metric),
  index("idx_financial_audit_log_source").on(table.source),
  index("idx_financial_audit_log_fy").on(table.financialYear),
  index("idx_financial_audit_log_action").on(table.actionType),
  index("idx_financial_audit_log_timestamp").on(table.createdAt),
]);


// Unlisted Price History table
export const unlistedPriceHistory = pgTable("unlisted_price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  date: timestamp("date").notNull(),
  
  // Price Information
  price: decimal("price", { precision: 20, scale: 2 }).notNull(),
  volume: bigint("volume", { mode: "number" }),
  
  // Price Source
  sourceType: varchar("source_type").notNull(), // DEAL, SELLER_FEED, ADMIN_INPUT, PROBE42_COMPARABLE
  sourceDealId: varchar("source_deal_id"), // Reference to deal if sourceType is DEAL
  
  // Additional Context
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_price_history_company").on(table.companyId),
  index("idx_price_history_date").on(table.date),
]);

// Sell Listings table
export const sellListings = pgTable("sell_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerUserId: varchar("seller_user_id").references(() => users.id).notNull(),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  
  // Listing Details
  quantity: bigint("quantity", { mode: "number" }).notNull(),
  askPrice: decimal("ask_price", { precision: 20, scale: 2 }).notNull(), // Initial asking price
  landingPrice: decimal("landing_price", { precision: 20, scale: 2 }).notNull(), // Target/acceptable price
  floorPrice: decimal("floor_price", { precision: 20, scale: 2 }).notNull(), // Minimum acceptable price
  
  // Listing Status
  status: varchar("status").default("pending").notNull(), // pending, active, matched, partial, cancelled, expired
  quantityRemaining: bigint("quantity_remaining", { mode: "number" }),
  
  // Validity
  validUntil: timestamp("valid_until"),
  autoRenew: boolean("auto_renew").default(false),
  
  // Additional Terms
  lockInPeriod: integer("lock_in_period"), // in days
  minimumLotSize: bigint("minimum_lot_size", { mode: "number" }),
  notes: text("notes"),
  
  // KYC Compliance
  kycVerified: boolean("kyc_verified").default(false),
  dematVerified: boolean("demat_verified").default(false),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sell_listings_seller").on(table.sellerUserId),
  index("idx_sell_listings_company").on(table.companyId),
  index("idx_sell_listings_status").on(table.status),
]);

// Buy Requests table
export const buyRequests = pgTable("buy_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buyerUserId: varchar("buyer_user_id").references(() => users.id).notNull(),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  
  // Request Details
  quantity: bigint("quantity", { mode: "number" }).notNull(),
  maxPrice: decimal("max_price", { precision: 20, scale: 2 }).notNull(), // Maximum price willing to pay
  targetPrice: decimal("target_price", { precision: 20, scale: 2 }), // Preferred price
  
  // Request Status
  status: varchar("status").default("pending").notNull(), // pending, active, matched, partial, cancelled, expired
  quantityFilled: bigint("quantity_filled", { mode: "number" }).default(0),
  
  // Validity
  validUntil: timestamp("valid_until"),
  
  // Additional Preferences
  preferredLotSize: bigint("preferred_lot_size", { mode: "number" }),
  notes: text("notes"),
  
  // KYC Compliance
  kycVerified: boolean("kyc_verified").default(false),
  fundsVerified: boolean("funds_verified").default(false),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_buy_requests_buyer").on(table.buyerUserId),
  index("idx_buy_requests_company").on(table.companyId),
  index("idx_buy_requests_status").on(table.status),
]);

// Deals table (matched transactions)
export const unlistedDeals = pgTable("unlisted_deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellListingId: varchar("sell_listing_id").references(() => sellListings.id).notNull(),
  buyRequestId: varchar("buy_request_id").references(() => buyRequests.id).notNull(),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  sellerUserId: varchar("seller_user_id").references(() => users.id).notNull(),
  buyerUserId: varchar("buyer_user_id").references(() => users.id).notNull(),
  
  // Deal Terms
  quantity: bigint("quantity", { mode: "number" }).notNull(),
  agreedPrice: decimal("agreed_price", { precision: 20, scale: 2 }).notNull(),
  totalValue: decimal("total_value", { precision: 20, scale: 2 }).notNull(),
  
  // Deal Status
  status: varchar("status").default("pending").notNull(), // pending, awaiting_acceptance, confirmed, escrowed, transfer_pending, completed, cancelled, failed
  
  // Buyer/Seller Acceptance
  buyerAccepted: boolean("buyer_accepted").default(false),
  buyerAcceptedAt: timestamp("buyer_accepted_at"),
  sellerAccepted: boolean("seller_accepted").default(false),
  sellerAcceptedAt: timestamp("seller_accepted_at"),
  acceptanceDeadline: timestamp("acceptance_deadline"),
  
  // Payment & Transfer
  escrowId: varchar("escrow_id"),
  escrowedAt: timestamp("escrowed_at"),
  paymentCompletedAt: timestamp("payment_completed_at"),
  sharesTransferredAt: timestamp("shares_transferred_at"),
  
  // Platform Fees
  platformFee: decimal("platform_fee", { precision: 20, scale: 2 }),
  sellerFee: decimal("seller_fee", { precision: 20, scale: 2 }),
  buyerFee: decimal("buyer_fee", { precision: 20, scale: 2 }),
  
  // Settlement
  sellerPayout: decimal("seller_payout", { precision: 20, scale: 2 }),
  buyerCharge: decimal("buyer_charge", { precision: 20, scale: 2 }),
  settlementDate: timestamp("settlement_date"),
  
  // Compliance
  complianceChecked: boolean("compliance_checked").default(false),
  complianceNotes: text("compliance_notes"),
  
  // Market Type & Inventory (for dealer/principal model)
  marketType: varchar("market_type"), // 'primary' (pre-IPO from company) or 'secondary' (P2P between investors)
  inventorySale: boolean("inventory_sale").default(false), // true = FintekPro selling from own inventory (primary market)
  purchaseCost: decimal("purchase_cost", { precision: 20, scale: 2 }), // Original cost basis per share
  totalPurchaseCost: decimal("total_purchase_cost", { precision: 20, scale: 2 }), // Total COGS
  inventoryItemId: varchar("inventory_item_id"), // Zoho Inventory item reference
  profitMargin: decimal("profit_margin", { precision: 20, scale: 2 }), // Sale price - cost
  escrowManaged: boolean("escrow_managed").default(false), // Whether FintekPro manages escrow
  dealType: varchar("deal_type"), // 'buy' or 'sell' perspective
  buyerName: varchar("buyer_name"),
  sellerName: varchar("seller_name"),
  companyName: varchar("company_name"),
  pricePerShare: decimal("price_per_share", { precision: 20, scale: 2 }),
  brokerageFee: decimal("brokerage_fee", { precision: 20, scale: 2 }),
  brokerageRate: decimal("brokerage_rate", { precision: 8, scale: 4 }),
  
  // Zoho Books Sync
  zohoInvoiceId: varchar("zoho_invoice_id"),
  zohoBillId: varchar("zoho_bill_id"),
  zohoExpenseId: varchar("zoho_expense_id"),
  zohoSyncedAt: timestamp("zoho_synced_at"),
  zohoSyncStatus: varchar("zoho_sync_status", { length: 50 }),
  
  // Metadata
  matchedAt: timestamp("matched_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_unlisted_deals_seller").on(table.sellerUserId),
  index("idx_unlisted_deals_buyer").on(table.buyerUserId),
  index("idx_unlisted_deals_company").on(table.companyId),
  index("idx_unlisted_deals_status").on(table.status),
  index("idx_unlisted_deals_matched").on(table.matchedAt),
  index("idx_unlisted_deals_market_type").on(table.marketType),
  index("idx_unlisted_deals_inventory").on(table.inventorySale),
]);

// Probe42 Sync Log table
export const probe42SyncLog = pgTable("probe42_sync_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  probe42CompanyId: varchar("probe42_company_id").notNull(),
  
  // Sync Details
  syncType: varchar("sync_type").notNull(), // full, financials_only, ratios_only, incremental
  lastSyncAt: timestamp("last_sync_at").notNull(),
  status: varchar("status").notNull(), // success, failed, partial
  
  // Sync Results
  recordsSynced: integer("records_synced"),
  recordsFailed: integer("records_failed"),
  errorMessage: text("error_message"),
  errorDetails: jsonb("error_details"),
  
  // Next Sync
  nextSyncScheduled: timestamp("next_sync_scheduled"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_probe42_sync_company").on(table.companyId),
  index("idx_probe42_sync_status").on(table.status),
  index("idx_probe42_sync_date").on(table.lastSyncAt),
]);

// Zod schemas for unlisted marketplace
export const insertUnlistedCompanySchema = createInsertSchema(unlistedCompanies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUnlistedAuditLogSchema = createInsertSchema(unlistedAuditLog).omit({
  id: true,
  createdAt: true,
});

export type UnlistedAuditLog = typeof unlistedAuditLog.$inferSelect;

export type InsertUnlistedAuditLog = z.infer<typeof insertUnlistedAuditLogSchema>;

export const insertUnlistedPriceHistorySchema = createInsertSchema(unlistedPriceHistory).omit({
  id: true,
  createdAt: true,
});

export type UnlistedPriceHistory = typeof unlistedPriceHistory.$inferSelect;

export type InsertUnlistedPriceHistory = z.infer<typeof insertUnlistedPriceHistorySchema>;

export const unlistedInvestorTracking = pgTable("unlisted_investor_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  financialYear: varchar("financial_year", { length: 10 }).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  userPan: varchar("user_pan", { length: 10 }),
  firstTransactionDate: timestamp("first_transaction_date").notNull(),
  lastTransactionDate: timestamp("last_transaction_date"),
  totalInvestmentValue: decimal("total_investment_value", { precision: 20, scale: 2 }).default("0"),
  totalSharesAcquired: integer("total_shares_acquired").default(0),
  isPrivatePlacement: boolean("is_private_placement").default(false),
  sourceOfFundsVerified: boolean("source_of_funds_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_investor_tracking_company_fy").on(table.companyId, table.financialYear),
  index("idx_investor_tracking_user").on(table.userId),
]);

/**
 * Share Lock-In Tracking (6-month rule for private placements)
 * Securities from private placement cannot be sold within 6 months
 */
export const unlistedShareLockIn = pgTable("unlisted_share_lockin", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  acquisitionDate: timestamp("acquisition_date").notNull(),
  lockInEndDate: timestamp("lockin_end_date").notNull(),
  sharesLocked: integer("shares_locked").notNull(),
  sharesRemaining: integer("shares_remaining").notNull(),
  acquisitionType: varchar("acquisition_type", { length: 50 }).notNull(),
  acquisitionPrice: decimal("acquisition_price", { precision: 20, scale: 2 }),
  transactionId: varchar("transaction_id"),
  isActive: boolean("is_active").default(true),
  releaseNotes: text("release_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_lockin_company_user").on(table.companyId, table.userId),
  index("idx_lockin_enddate").on(table.lockInEndDate),
  index("idx_lockin_active").on(table.isActive),
]);

/**
 * Company Status Monitoring Log (MCA status changes)
 * Tracks when companies transition from unlisted to listed
 */
export const unlistedCompanyStatusLog = pgTable("unlisted_company_status_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  previousStatus: varchar("previous_status", { length: 50 }),
  newStatus: varchar("new_status", { length: 50 }).notNull(),
  statusSource: varchar("status_source", { length: 50 }).notNull(),
  listingDate: timestamp("listing_date"),
  exchangeSymbol: varchar("exchange_symbol", { length: 20 }),
  exchangeName: varchar("exchange_name", { length: 10 }),
  tradingSuspendedAt: timestamp("trading_suspended_at"),
  suspensionReason: text("suspension_reason"),
  adminUserId: varchar("admin_user_id").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_status_log_company").on(table.companyId),
  index("idx_status_log_date").on(table.createdAt),
]);

/**
 * STR (Suspicious Transaction Report) Flags
 * For FIU-IND reporting compliance
 */
export const unlistedSTRFlags = pgTable("unlisted_str_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id"),
  userId: varchar("user_id").references(() => users.id),
  companyId: varchar("company_id").references(() => unlistedCompanies.id),
  flagType: varchar("flag_type", { length: 50 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull(),
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 2 }),
  flagReason: text("flag_reason").notNull(),
  detectionMethod: varchar("detection_method", { length: 50 }),
  relatedTransactions: jsonb("related_transactions"),
  strReportId: varchar("str_report_id"),
  strFiledAt: timestamp("str_filed_at"),
  strDueDate: timestamp("str_due_date"),
  status: varchar("status", { length: 30 }).default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_str_status").on(table.status),
  index("idx_str_severity").on(table.severity),
  index("idx_str_user").on(table.userId),
  index("idx_str_due_date").on(table.strDueDate),
]);

export const insertUnlistedInvestorTrackingSchema = createInsertSchema(unlistedInvestorTracking).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UnlistedInvestorTracking = typeof unlistedInvestorTracking.$inferSelect;

export type InsertUnlistedInvestorTracking = z.infer<typeof insertUnlistedInvestorTrackingSchema>;

export const insertUnlistedShareLockInSchema = createInsertSchema(unlistedShareLockIn).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UnlistedShareLockIn = typeof unlistedShareLockIn.$inferSelect;

export type InsertUnlistedShareLockIn = z.infer<typeof insertUnlistedShareLockInSchema>;

export const insertUnlistedCompanyStatusLogSchema = createInsertSchema(unlistedCompanyStatusLog).omit({
  id: true,
  createdAt: true,
});

export type UnlistedCompanyStatusLog = typeof unlistedCompanyStatusLog.$inferSelect;

export type InsertUnlistedCompanyStatusLog = z.infer<typeof insertUnlistedCompanyStatusLogSchema>;

export const insertUnlistedSTRFlagsSchema = createInsertSchema(unlistedSTRFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UnlistedSTRFlags = typeof unlistedSTRFlags.$inferSelect;

export type InsertUnlistedSTRFlags = z.infer<typeof insertUnlistedSTRFlagsSchema>;

export const unlistedEquityValuationHistory = pgTable("unlisted_equity_valuation_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => unlistedCompanies.id).notNull(),
  valuationMethod: varchar("valuation_method", { length: 50 }).notNull(), // dcf, nav, comparable, book_value, market_implied, ca_certified
  price: decimal("price", { precision: 20, scale: 2 }).notNull(),
  valuationDate: date("valuation_date").notNull(),
  supportingDocumentUrl: text("supporting_document_url"),
  notes: text("notes"),
  addedBy: varchar("added_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_unlisted_val_history_company").on(table.companyId),
  index("idx_unlisted_val_history_date").on(table.valuationDate),
  index("idx_unlisted_val_history_method").on(table.valuationMethod),
]);

export const insertUnlistedEquityValuationHistorySchema = createInsertSchema(unlistedEquityValuationHistory).omit({
  id: true,
  createdAt: true,
});

export type UnlistedEquityValuationHistory = typeof unlistedEquityValuationHistory.$inferSelect;

export type InsertUnlistedEquityValuationHistory = z.infer<typeof insertUnlistedEquityValuationHistorySchema>;

export const unlistedRiskDisclosureAcknowledgments = pgTable("unlisted_risk_disclosure_acknowledgments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  companyId: varchar("company_id").references(() => unlistedCompanies.id),
  
  // Trade context
  tradeType: varchar("trade_type").notNull(), // buy, sell
  tradeEntityId: varchar("trade_entity_id"), // buy_request_id, sell_listing_id, or deal_id
  tradeEntityType: varchar("trade_entity_type"), // buy_request, sell_listing, deal
  
  // Disclosure acknowledgment
  disclosureVersion: varchar("disclosure_version").notNull(),
  acknowledgedDisclosureIds: jsonb("acknowledged_disclosure_ids").notNull().default([]),
  allMandatoryAcknowledged: boolean("all_mandatory_acknowledged").notNull().default(false),
  
  // Company-specific risks acknowledged
  companySpecificRisksAcknowledged: jsonb("company_specific_risks_acknowledged").default([]),
  
  // Acknowledgment statement
  acknowledgmentStatement: text("acknowledgment_statement"),
  acknowledgedFullText: boolean("acknowledged_full_text").notNull().default(false),
  
  // Request context for audit
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  // Timestamps
  acknowledgedAt: timestamp("acknowledged_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // Some acknowledgments may need renewal
}, (table) => [
  index("idx_unlisted_risk_disclosure_user").on(table.userId),
  index("idx_unlisted_risk_disclosure_company").on(table.companyId),
  index("idx_unlisted_risk_disclosure_trade").on(table.tradeEntityId),
  index("idx_unlisted_risk_disclosure_version").on(table.disclosureVersion),
]);

export const insertUnlistedRiskDisclosureAcknowledgmentSchema = createInsertSchema(unlistedRiskDisclosureAcknowledgments).omit({
  id: true,
  acknowledgedAt: true,
});

export const unlistedEscrowApprovals = pgTable("unlisted_escrow_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").references(() => unlistedDeals.id).notNull(),
  
  // Request details
  requestType: varchar("request_type").notNull(), // release, refund
  requestedAmount: decimal("requested_amount", { precision: 20, scale: 2 }).notNull(),
  sellerPayout: decimal("seller_payout", { precision: 20, scale: 2 }),
  platformFee: decimal("platform_fee", { precision: 20, scale: 2 }),
  
  // Maker (first approver)
  makerUserId: varchar("maker_user_id").references(() => users.id).notNull(),
  makerName: varchar("maker_name"),
  makerApprovedAt: timestamp("maker_approved_at").defaultNow().notNull(),
  makerNotes: text("maker_notes"),
  makerVerificationDocuments: jsonb("maker_verification_documents").default([]), // Document IDs verified
  
  // Checker (second approver)
  checkerUserId: varchar("checker_user_id").references(() => users.id),
  checkerName: varchar("checker_name"),
  checkerApprovedAt: timestamp("checker_approved_at"),
  checkerNotes: text("checker_notes"),
  checkerAction: varchar("checker_action"), // approved, rejected, requested_info
  
  // Workflow status
  status: varchar("status").notNull().default("pending_checker"), // pending_checker, approved, rejected, expired
  expiresAt: timestamp("expires_at"), // Approval requests expire after 24 hours
  
  // Compliance context
  transferConfirmationId: varchar("transfer_confirmation_id"),
  disSlipVerified: boolean("dis_slip_verified").default(false),
  shareTransferVerified: boolean("share_transfer_verified").default(false),
  complianceChecks: jsonb("compliance_checks").default([]), // List of checks performed
  
  // Rejection details
  rejectionReason: text("rejection_reason"),
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  
  // Final execution
  executedAt: timestamp("executed_at"),
  executionResult: jsonb("execution_result"),
  
  // Audit trail
  ipAddressMaker: varchar("ip_address_maker"),
  ipAddressChecker: varchar("ip_address_checker"),
  userAgentMaker: text("user_agent_maker"),
  userAgentChecker: text("user_agent_checker"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_escrow_approval_deal").on(table.dealId),
  index("idx_escrow_approval_maker").on(table.makerUserId),
  index("idx_escrow_approval_checker").on(table.checkerUserId),
  index("idx_escrow_approval_status").on(table.status),
]);

export const insertUnlistedEscrowApprovalSchema = createInsertSchema(unlistedEscrowApprovals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  checkerUserId: true,
  checkerName: true,
  checkerApprovedAt: true,
  checkerNotes: true,
  checkerAction: true,
  rejectionReason: true,
  rejectedBy: true,
  rejectedAt: true,
  executedAt: true,
  executionResult: true,
  ipAddressChecker: true,
  userAgentChecker: true,
});

export const unlistedRegulatoryAuditLog = pgTable("unlisted_regulatory_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Actor Information
  userId: varchar("user_id").references(() => users.id),
  userEmail: varchar("user_email"),
  userName: varchar("user_name"),
  userRole: varchar("user_role"), // admin, investor, seller, compliance_officer
  userKycTier: varchar("user_kyc_tier"), // basic, enhanced, accredited
  userPan: varchar("user_pan"), // For regulatory tracing
  
  // Action Details
  action: varchar("action").notNull(), // create_sell_listing, create_buy_request, match_deal, accept_deal, reject_deal, initiate_payment, complete_payment, transfer_shares, release_escrow, refund_escrow, cancel_deal, compliance_override, trading_suspended, trading_resumed, document_upload, document_verify, price_change, etc.
  actionCategory: varchar("action_category").notNull(), // listing, order, deal, payment, transfer, compliance, document, price
  entityType: varchar("entity_type").notNull(), // sell_listing, buy_request, deal, company, document, payment
  entityId: varchar("entity_id").notNull(),
  
  // Company Context
  companyId: varchar("company_id").references(() => unlistedCompanies.id),
  companyCin: varchar("company_cin"),
  companyName: varchar("company_name"),
  
  // Deal Context (for transaction-related events)
  dealId: varchar("deal_id"),
  counterpartyUserId: varchar("counterparty_user_id"),
  counterpartyPan: varchar("counterparty_pan"),
  
  // Financial Details
  quantity: bigint("quantity", { mode: "number" }),
  pricePerShare: decimal("price_per_share", { precision: 20, scale: 2 }),
  totalValue: decimal("total_value", { precision: 20, scale: 2 }),
  platformFee: decimal("platform_fee", { precision: 20, scale: 2 }),
  gstAmount: decimal("gst_amount", { precision: 20, scale: 2 }),
  escrowAmount: decimal("escrow_amount", { precision: 20, scale: 2 }),
  
  // Change Tracking
  beforeState: jsonb("before_state"),
  afterState: jsonb("after_state"),
  changeDescription: text("change_description"),
  
  // Compliance Context
  complianceRelated: boolean("compliance_related").default(false),
  complianceFlags: jsonb("compliance_flags").default([]), // Any red flags present
  riskLevel: varchar("risk_level"), // low, medium, high, critical
  complianceOfficer: varchar("compliance_officer"), // Officer who approved/reviewed
  complianceNotes: text("compliance_notes"),
  
  // Regulatory Reporting
  sebiReportable: boolean("sebi_reportable").default(false),
  sebiReportedAt: timestamp("sebi_reported_at"),
  sebiReportRef: varchar("sebi_report_ref"),
  rbiReportable: boolean("rbi_reportable").default(false),
  rbiReportedAt: timestamp("rbi_reported_at"),
  rbiReportRef: varchar("rbi_report_ref"),
  
  // Request Context (for forensic analysis)
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  deviceFingerprint: varchar("device_fingerprint"),
  geoLocation: varchar("geo_location"),
  
  // Document References
  documentIds: jsonb("document_ids").default([]), // Related document IDs
  
  // Timestamps
  timestamp: timestamp("timestamp").defaultNow(),
  
  // Retention Policy (7 years per SEBI regulations)
  retentionExpiresAt: timestamp("retention_expires_at"),
  archived: boolean("archived").default(false),
  archivedAt: timestamp("archived_at"),
  
  // Metadata
  metadata: jsonb("metadata").default({}),
}, (table) => [
  index("idx_unlisted_reg_audit_user").on(table.userId),
  index("idx_unlisted_reg_audit_action").on(table.action),
  index("idx_unlisted_reg_audit_category").on(table.actionCategory),
  index("idx_unlisted_reg_audit_entity").on(table.entityType, table.entityId),
  index("idx_unlisted_reg_audit_company").on(table.companyId),
  index("idx_unlisted_reg_audit_deal").on(table.dealId),
  index("idx_unlisted_reg_audit_timestamp").on(table.timestamp),
  index("idx_unlisted_reg_audit_retention").on(table.retentionExpiresAt),
  index("idx_unlisted_reg_audit_compliance").on(table.complianceRelated),
  index("idx_unlisted_reg_audit_sebi").on(table.sebiReportable),
]);

export const insertUnlistedRegulatoryAuditLogSchema = createInsertSchema(unlistedRegulatoryAuditLog).omit({
  id: true,
  timestamp: true,
});

export type UnlistedRegulatoryAuditLog = typeof unlistedRegulatoryAuditLog.$inferSelect;

export type InsertUnlistedRegulatoryAuditLog = z.infer<typeof insertUnlistedRegulatoryAuditLogSchema>;

export type CompanyFinancials = typeof companyFinancials.$inferSelect;

export type InsertCompanyFinancials = typeof companyFinancials.$inferInsert;

export type CompanyRatios = typeof companyRatios.$inferSelect;

export type InsertCompanyRatios = typeof companyRatios.$inferInsert;

export type Probe42SyncLog = typeof probe42SyncLog.$inferSelect;

export type InsertProbe42SyncLog = typeof probe42SyncLog.$inferInsert;
