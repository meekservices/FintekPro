import { sql } from "drizzle-orm";
import { boolean, date, decimal, index, integer, jsonb, numeric, pgTable, real, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users as User } from './users';
import { users } from './users';
import { portfolioAlerts, aiPortfolioAnalysis, portfolios as Portfolio, assetAllocation } from './portfolio';
import { agents } from './agents';
import { taxSessions } from './itr';
import { investmentProposals } from './proposals-base';
import { pickCategoryEnum, pickStatusEnum } from './enums';

export const dailyPicks = pgTable("daily_picks", {
  id: serial("id").primaryKey(),
  
  category: pickCategoryEnum("category").notNull(),
  instrumentId: varchar("instrument_id", { length: 100 }),
  instrumentName: varchar("instrument_name", { length: 255 }).notNull(),
  isin: varchar("isin", { length: 12 }),
  symbol: varchar("symbol", { length: 50 }),
  
  // Market region for global stocks
  market: varchar("market", { length: 20 }),
  
  // Exchange for stocks (NSE/BSE/MCX/NASDAQ etc.)
  exchange: varchar("exchange", { length: 20 }),
  
  recoDate: date("reco_date").notNull(),
  recoPrice: decimal("reco_price", { precision: 18, scale: 4 }).notNull(),
  targetPrice: decimal("target_price", { precision: 18, scale: 4 }).notNull(),
  stoplossPrice: decimal("stoploss_price", { precision: 18, scale: 4 }).notNull(),
  currentPrice: decimal("current_price", { precision: 18, scale: 4 }),
  
  status: pickStatusEnum("status").default("live").notNull(),
  expiryDate: date("expiry_date").notNull(),
  statusUpdatedAt: timestamp("status_updated_at"),
  
  returnPct: decimal("return_pct", { precision: 8, scale: 2 }),
  daysHeld: integer("days_held"),
  
  rationale: text("rationale").notNull(),
  riskLevel: varchar("risk_level", { length: 20 }).default("medium"),
  suitableFor: text("suitable_for").array(),
  
  // Enhanced pick fields
  timeHorizon: varchar("time_horizon", { length: 20 }).default("medium_term"), // short_term, medium_term, long_term
  confidenceScore: integer("confidence_score").default(70), // 0-100 AI confidence
  sectorCategory: varchar("sector_category", { length: 100 }), // For sector diversification tracking
  keyMetrics: jsonb("key_metrics"),
  
  generatedBy: varchar("generated_by", { length: 50 }).default("ai"),

  // Scoring audit trail (SEBI-aligned reproducibility)
  scoringVersion: varchar("scoring_version", { length: 20 }),
  scoringBreakdown: jsonb("scoring_breakdown"),
  riskScore: integer("risk_score"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_daily_picks_category").on(table.category),
  index("idx_daily_picks_status").on(table.status),
  index("idx_daily_picks_reco_date").on(table.recoDate),
  index("idx_daily_picks_isin").on(table.isin),
  uniqueIndex("idx_daily_picks_unique_reco").on(table.category, table.recoDate, table.instrumentId, table.symbol),
]);

export const insertDailyPickSchema = createInsertSchema(dailyPicks).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type DailyPick = typeof dailyPicks.$inferSelect;
export type InsertDailyPick = z.infer<typeof insertDailyPickSchema>;

// --- Auto-Migrated Tables ---
export const aifFunds = pgTable("aif_funds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Basic fund information
  fundName: text("fund_name").notNull(),
  isinNumber: varchar("isin_number", { length: 12 }).unique(),
  schemeCode: text("scheme_code").unique(),
  // AIF Classification
  category: varchar("category").notNull(), // Category I, II, or III
  subCategory: text("sub_category").notNull(), // Private Equity, Venture Capital, Hedge Fund, etc.
  fundType: varchar("fund_type").notNull(), // Open-ended, Close-ended
  // AMC and Management Information
  amcName: text("amc_name").notNull(),
  fundManager: text("fund_manager").notNull(),
  fundManagerExperience: integer("fund_manager_experience"), // years
  fundManagerQualification: text("fund_manager_qualification"),
  investmentTeam: jsonb("investment_team"), // Array of team member details
  // Financial Details
  nav: decimal("nav", { precision: 15, scale: 4 }),
  faceValue: decimal("face_value", { precision: 10, scale: 2 }),
  aum: decimal("aum", { precision: 20, scale: 2 }),
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }),
  additionalInvestment: decimal("additional_investment", { precision: 15, scale: 2 }),
  // Fee Structure
  managementFee: decimal("management_fee", { precision: 5, scale: 2 }),
  performanceFee: decimal("performance_fee", { precision: 5, scale: 2 }),
  entryLoad: decimal("entry_load", { precision: 5, scale: 2 }),
  exitLoad: decimal("exit_load", { precision: 5, scale: 2 }),
  hurdle_rate: decimal("hurdle_rate", { precision: 5, scale: 2 }),
  // Investment Strategy and Process
  investmentObjective: text("investment_objective").notNull(),
  investmentStrategy: text("investment_strategy").notNull(),
  stockSelectionProcess: text("stock_selection_process").notNull(),
  riskManagementProcess: text("risk_management_process"),
  benchmarkIndex: text("benchmark_index"),
  // Performance Metrics
  returns1y: decimal("returns_1y", { precision: 8, scale: 4 }),
  returns3y: decimal("returns_3y", { precision: 8, scale: 4 }),
  returns5y: decimal("returns_5y", { precision: 8, scale: 4 }),
  returnsSinceInception: decimal("returns_since_inception", { precision: 8, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 6, scale: 4 }),
  alpha: decimal("alpha", { precision: 6, scale: 4 }),
  beta: decimal("beta", { precision: 6, scale: 4 }),
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }),
  // Portfolio Composition
  assetAllocation: jsonb("asset_allocation"), // Equity, Debt, Others breakdown
  sectorAllocation: jsonb("sector_allocation"), // Sector-wise allocation
  marketCapAllocation: jsonb("market_cap_allocation"), // Large, Mid, Small cap
  geographicAllocation: jsonb("geographic_allocation"), // Domestic vs International
  topHoldings: jsonb("top_holdings"), // Top 10 holdings with percentages
  portfolioTurnover: decimal("portfolio_turnover", { precision: 5, scale: 2 }),
  // Risk Assessment
  riskRating: varchar("risk_rating").notNull(), // Very High, High, Medium, Low
  volatilityCategory: varchar("volatility_category"), // High, Medium, Low
  suitabilityProfile: text("suitability_profile"), // Suitable investor profile
  // Regulatory and Compliance
  sebiRegistrationNumber: varchar("sebi_registration_number").notNull(),
  trustee: text("trustee").notNull(),
  custodian: text("custodian").notNull(),
  auditor: text("auditor"),
  registrar: text("registrar"),
  riskDisclosures: text("risk_disclosures"),
  // Dates and Periods
  launchDate: date("launch_date").notNull(),
  maturityDate: date("maturity_date"), // For close-ended funds
  lockInPeriod: varchar("lock_in_period"), // Lock-in period details
  subscriptionPeriod: varchar("subscription_period"),
  redemptionFrequency: varchar("redemption_frequency"),
  // Status and Availability
  status: varchar("status").default("active"), // active, suspended, closed, matured
  isOpenForSubscription: boolean("is_open_for_subscription").default(true),
  isOpenForRedemption: boolean("is_open_for_redemption").default(true),
  // Exchange and Trading
  exchange: varchar("exchange"), // NSE, BSE, MCX, NCDEX, MSEI
  tradingSymbol: varchar("trading_symbol"),
  lotSize: integer("lot_size"),
  // Additional Information
  factsheetUrl: text("factsheet_url"),
  prospectusUrl: text("prospectus_url"),
  websiteUrl: text("website_url"),
  keyPersonnel: jsonb("key_personnel"), // Management team details
  // ESG and Sustainability
  esgRating: varchar("esg_rating"),
  sustainabilityScore: decimal("sustainability_score", { precision: 5, scale: 2 }),
  greenBondAllocation: decimal("green_bond_allocation", { precision: 5, scale: 2 }),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastNavUpdate: timestamp("last_nav_update"),
});

export const aiTransactionTracking = pgTable("ai_transaction_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Transaction identification
  transactionId: varchar("transaction_id").notNull(), // Unique transaction identifier
  externalTransactionId: varchar("external_transaction_id"), // Bank/payment gateway transaction ID
  transactionHash: varchar("transaction_hash"), // Hash for duplicate detection
  
  // Transaction details
  transactionType: varchar("transaction_type").notNull(), // deposit, withdrawal, transfer, investment, loan_payment, bill_payment
  transactionCategory: varchar("transaction_category"), // salary, business_income, investment_redemption, loan_disbursement
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").default("INR"),
  
  // Source and destination
  sourceType: varchar("source_type").notNull(), // internal_platform, bank_account, payment_gateway, investment_account
  sourceAccount: varchar("source_account"), // Account identifier
  destinationType: varchar("destination_type"), 
  destinationAccount: varchar("destination_account"),
  
  // Transaction source tracking
  isOnSiteTransaction: boolean("is_on_site_transaction").default(false), // Happened on our platform
  platformSource: varchar("platform_source"), // wealth_management, loan_portal, payment_gateway
  
  // External transaction tracking (bank/payment APIs)
  bankTransactionId: varchar("bank_transaction_id"),
  bankName: varchar("bank_name"),
  paymentMethod: varchar("payment_method"), // upi, netbanking, card, wallet, cash
  merchantCategory: varchar("merchant_category"), // MCC code or category
  merchantName: varchar("merchant_name"),
  
  // AI-generated insights
  transactionPattern: varchar("transaction_pattern"), // regular, irregular, suspicious, unusual
  riskScore: integer("risk_score"), // 0-100 AI-calculated risk score
  anomalyScore: integer("anomaly_score"), // 0-100 anomaly detection score
  behaviorAnalysis: jsonb("behavior_analysis"), // AI insights on transaction behavior
  
  // Income/expense classification
  incomeCategory: varchar("income_category"), // salary, business, investment, loan, other
  expenseCategory: varchar("expense_category"), // necessity, lifestyle, investment, loan_payment, bills
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: varchar("recurring_frequency"), // monthly, weekly, quarterly
  
  // Compliance and monitoring
  amlFlag: boolean("aml_flag").default(false), // Anti-Money Laundering flag
  complianceStatus: varchar("compliance_status").default("cleared"), // cleared, flagged, under_review
  complianceNotes: text("compliance_notes"),
  requiresManualReview: boolean("requires_manual_review").default(false),
  
  // Geographic and timing insights
  transactionLocation: varchar("transaction_location"), // City/region if available
  timeOfDay: varchar("time_of_day"), // morning, afternoon, evening, night
  dayOfWeek: varchar("day_of_week"),
  isWeekend: boolean("is_weekend").default(false),
  
  // API source metadata (for external transactions)
  apiSource: varchar("api_source"), // icici_api, hdfc_api, upi_api, card_api
  apiCallId: varchar("api_call_id"), // Reference to API call that fetched this
  dataFreshness: varchar("data_freshness"), // real_time, near_real_time, batch_update
  
  // Transaction date and processing
  transactionDate: timestamp("transaction_date").notNull(),
  processedAt: timestamp("processed_at").defaultNow(),
  lastAnalyzedAt: timestamp("last_analyzed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAiTransactionTrackingSchema = createInsertSchema(aiTransactionTracking).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AiTransactionTracking = typeof aiTransactionTracking.$inferSelect;

export type InsertAiTransactionTracking = typeof aiTransactionTracking.$inferInsert;

export const aiOptimizationSuggestions = pgTable("ai_optimization_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => taxSessions.id).notNull(),
  
  // Suggestion Type
  category: varchar("category").notNull(), // tax_regime | deductions | investments | structure
  suggestionType: varchar("suggestion_type").notNull(), // regime_switch | add_deduction | investment_reallocation
  
  // Suggestion Details
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  potentialSaving: decimal("potential_saving", { precision: 10, scale: 2 }),
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // 0.00 to 1.00
  
  // Implementation
  actionRequired: text("action_required"), // What user needs to do
  automatable: boolean("automatable").default(false),
  implementationSteps: jsonb("implementation_steps").default([]),
  
  // User Response
  status: varchar("status").default("pending").notNull(), // pending | accepted | rejected | implemented
  userResponse: text("user_response"),
  respondedAt: timestamp("responded_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const aiProfitPicks = pgTable("ai_profit_picks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  agentId: varchar("agent_id").references(() => users.id),
  
  // Stock identification
  stockName: varchar("stock_name").notNull(),
  symbol: varchar("symbol").notNull(),
  isin: varchar("isin"),
  exchange: varchar("exchange").default("NSE"), // NSE, BSE
  
  // Price analysis
  currentPrice: decimal("current_price", { precision: 15, scale: 2 }).notNull(),
  targetPrice: decimal("target_price", { precision: 15, scale: 2 }).notNull(),
  stopLossPrice: decimal("stop_loss_price", { precision: 15, scale: 2 }),
  upsidePercent: decimal("upside_percent", { precision: 8, scale: 2 }).notNull(),
  downsidePercent: decimal("downside_percent", { precision: 8, scale: 2 }),
  
  // AI scoring
  profitScore: integer("profit_score").notNull(), // 0-100 conviction score
  confidenceLevel: varchar("confidence_level").default("medium"), // low, medium, high, very_high
  signalType: varchar("signal_type").notNull().default("buy"), // buy, sell, hold
  signalStrength: varchar("signal_strength").default("moderate"), // weak, moderate, strong
  
  // Time horizon
  timeHorizon: varchar("time_horizon").notNull(), // ultra_short, short, medium, long
  timeHorizonDays: integer("time_horizon_days"), // Specific days estimate
  
  // Risk assessment
  riskLevel: varchar("risk_level").notNull(), // low, moderate, high, very_high
  riskScore: integer("risk_score"), // 0-100
  volatilityRating: varchar("volatility_rating"), // low, medium, high
  
  // Sector analysis
  sector: varchar("sector"),
  industry: varchar("industry"),
  sectorTrend: varchar("sector_trend"), // bullish, neutral, bearish
  sectorRank: integer("sector_rank"), // Rank within sector
  
  // Fundamentals
  peRatio: decimal("pe_ratio", { precision: 10, scale: 2 }),
  pbRatio: decimal("pb_ratio", { precision: 10, scale: 2 }),
  eps: decimal("eps", { precision: 15, scale: 2 }),
  roe: decimal("roe", { precision: 8, scale: 2 }),
  debtToEquity: decimal("debt_to_equity", { precision: 10, scale: 2 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 0 }),
  dividendYield: decimal("dividend_yield", { precision: 8, scale: 2 }),
  
  // Technicals
  rsiValue: decimal("rsi_value", { precision: 8, scale: 2 }),
  macdSignal: varchar("macd_signal"), // bullish, bearish, neutral
  movingAverage50: decimal("moving_average_50", { precision: 15, scale: 2 }),
  movingAverage200: decimal("moving_average_200", { precision: 15, scale: 2 }),
  supportLevel: decimal("support_level", { precision: 15, scale: 2 }),
  resistanceLevel: decimal("resistance_level", { precision: 15, scale: 2 }),
  
  // AI reasoning
  aiReason: text("ai_reason").notNull(), // Primary reason for recommendation
  aiAnalysis: text("ai_analysis"), // Detailed analysis
  keyFactors: jsonb("key_factors").$type<string[]>(), // Array of key factors
  riskFactors: jsonb("risk_factors").$type<string[]>(), // Array of risk factors
  
  // Agent interaction
  agentApproved: boolean("agent_approved").default(false),
  agentModified: boolean("agent_modified").default(false),
  agentNotes: text("agent_notes"),
  agentOverrideReason: text("agent_override_reason"),
  modifiedTargetPrice: decimal("modified_target_price", { precision: 15, scale: 2 }),
  modifiedQuantity: integer("modified_quantity"),
  
  // Proposal tracking
  addedToProposal: boolean("added_to_proposal").default(false),
  proposalId: varchar("proposal_id").references(() => investmentProposals.id),
  proposedQuantity: integer("proposed_quantity"),
  proposedAmount: decimal("proposed_amount", { precision: 15, scale: 2 }),
  
  // Status
  status: varchar("status").default("active"), // active, expired, executed, cancelled
  expiresAt: timestamp("expires_at"),
  executedAt: timestamp("executed_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ai_profit_picks_client").on(table.clientId),
  index("idx_ai_profit_picks_agent").on(table.agentId),
  index("idx_ai_profit_picks_status").on(table.status),
  index("idx_ai_profit_picks_signal").on(table.signalType),
  index("idx_ai_profit_picks_horizon").on(table.timeHorizon),
]);

// Portfolio Alerts - Benchmark and risk trigger alerts
export type AiProfitPick = typeof aiProfitPicks.$inferSelect;
export type InsertAiProfitPick = z.infer<typeof insertAiProfitPickSchema>;




export type InsertAiPortfolioAnalysis = z.infer<typeof insertAiPortfolioAnalysisSchema>;

export const aifMaster = pgTable("aif_master", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic Information
  name: text("name").notNull(),
  registrationNo: text("registration_no").unique(),
  category: text("category"), // Category I, II, III
  subcategory: text("subcategory"), // VC, PIPE, Credit, Long-Short, etc.
  
  // Manager and Sponsor
  managerId: varchar("manager_id").references(() => fundManagers.id),
  fundHouseName: text("fund_house_name"),
  sponsor: text("sponsor"),
  
  // Investment Details
  style: text("style"), // Growth, Value, Blend, Thematic
  minInvestment: decimal("min_investment", { precision: 15, scale: 2 }).default("10000000"), // ₹1Cr default
  lockIn: text("lock_in"), // Lock-in period description
  liquidityFrequency: text("liquidity_frequency"), // Monthly, Quarterly, Annual
  benchmark: text("benchmark"),
  
  // Status and Publishing
  fundStatus: text("fund_status").default("active"), // active, soft_close, hard_close, existing_only, suspended
  isPublished: boolean("is_published").default(false),
  
  // NAV Information
  navFrequency: text("nav_frequency").default("MONTHLY"), // DAILY, WEEKLY, MONTHLY
  latestNav: decimal("latest_nav", { precision: 15, scale: 4 }),
  lastNavDate: date("last_nav_date"),
  aum: decimal("aum", { precision: 20, scale: 2 }), // Assets Under Management
  
  // Performance Metrics
  return1M: decimal("return_1m", { precision: 8, scale: 4 }),
  return3M: decimal("return_3m", { precision: 8, scale: 4 }),
  return6M: decimal("return_6m", { precision: 8, scale: 4 }),
  return1Y: decimal("return_1y", { precision: 8, scale: 4 }),
  return3Y: decimal("return_3y", { precision: 8, scale: 4 }),
  return5Y: decimal("return_5y", { precision: 8, scale: 4 }),
  returnSinceInception: decimal("return_since_inception", { precision: 8, scale: 4 }),
  
  // Risk Metrics
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 8, scale: 4 }),
  sortinoRatio: decimal("sortino_ratio", { precision: 8, scale: 4 }),
  riskScore: integer("risk_score"), // 1-10 scale
  
  // Identifiers
  isin: text("isin"),
  sebiId: text("sebi_id"),
  
  // Metadata
  inceptionDate: date("inception_date"),
  description: text("description"),
  investmentObjective: text("investment_objective"),
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_aif_master_registration").on(table.registrationNo),
  index("idx_aif_master_category").on(table.category),
  index("idx_aif_master_published").on(table.isPublished),
  index("idx_aif_master_status").on(table.fundStatus),
]);

export const insertAifMasterSchema = createInsertSchema(aifMaster).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});




export type AifMaster = typeof aifMaster.$inferSelect;

export type InsertAifMaster = z.infer<typeof insertAifMasterSchema>;

export const aiRecommendationTracking = pgTable("ai_recommendation_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Asset Information
  symbol: varchar("symbol", { length: 50 }).notNull(),
  assetName: varchar("asset_name", { length: 255 }).notNull(),
  assetType: varchar("asset_type", { length: 50 }).notNull(), // stock, mutual_fund, bond, unlisted, reit, invit, derivative
  sector: varchar("sector", { length: 100 }),
  
  // Recommendation Details
  recommendationType: varchar("recommendation_type", { length: 20 }).notNull(), // buy, sell, hold, strong_buy, strong_sell
  entryPrice: numeric("entry_price", { precision: 12, scale: 2 }).notNull(),
  targetPrice: numeric("target_price", { precision: 12, scale: 2 }).notNull(),
  stopLoss: numeric("stop_loss", { precision: 12, scale: 2 }),
  confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }).notNull(), // 0-100%
  
  // Timeframe
  timeframeInDays: integer("timeframe_in_days").notNull(), // 7, 30, 90, 180, 365
  expiryDate: timestamp("expiry_date").notNull(),
  
  // AI Model Info
  aiModel: varchar("ai_model", { length: 100 }).default("gemini-1.5-flash"),
  reasoning: text("reasoning"), // AI's justification for the recommendation
  
  // Outcome Tracking
  status: varchar("status", { length: 20 }).default("pending"), // pending, hit_target, missed_target, stopped_out, expired
  currentPrice: numeric("current_price", { precision: 12, scale: 2 }),
  highestPrice: numeric("highest_price", { precision: 12, scale: 2 }),
  lowestPrice: numeric("lowest_price", { precision: 12, scale: 2 }),
  actualReturn: numeric("actual_return", { precision: 8, scale: 2 }), // % return achieved
  
  // Resolution
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),
  
  // Context
  userId: varchar("user_id").references(() => users.id),
  agentId: varchar("agent_id"),
  source: varchar("source", { length: 50 }).default("stock_ai"), // stock_ai, bond_ai, mf_ai, unlisted_ai
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ai_rec_tracking_symbol").on(table.symbol),
  index("idx_ai_rec_tracking_status").on(table.status),
  index("idx_ai_rec_tracking_type").on(table.recommendationType),
  index("idx_ai_rec_tracking_asset").on(table.assetType),
  index("idx_ai_rec_tracking_created").on(table.createdAt),
  index("idx_ai_rec_tracking_expiry").on(table.expiryDate),
]);

export const insertAiRecommendationTrackingSchema = createInsertSchema(aiRecommendationTracking).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  currentPrice: true,
  highestPrice: true,
  lowestPrice: true,
  actualReturn: true,
});

export type AiRecommendationTracking = typeof aiRecommendationTracking.$inferSelect;

export type InsertAiRecommendationTracking = z.infer<typeof insertAiRecommendationTrackingSchema>;

export const aiRationaleCache = pgTable("ai_rationale_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Cache Key (hash of inputs)
  inputHash: varchar("input_hash", { length: 64 }).notNull(), // SHA-256 of input parameters
  rationaleType: varchar("rationale_type", { length: 50 }).notNull(), // recommendation, rebalancing, proposal, risk_analysis
  
  // Input Context (for debugging and cache validation)
  productType: varchar("product_type", { length: 50 }),
  productId: varchar("product_id", { length: 100 }),
  userId: varchar("user_id").references(() => users.id),
  riskProfile: varchar("risk_profile", { length: 50 }),
  investmentHorizon: varchar("investment_horizon", { length: 50 }),
  
  // Input Snapshot (key parameters used in generation)
  inputSnapshot: jsonb("input_snapshot").notNull(), // Full input parameters
  
  // Generated Content
  rationale: text("rationale").notNull(), // Main AI-generated explanation
  summary: text("summary"), // Short summary
  keyPoints: jsonb("key_points"), // Array of key points
  riskWarnings: jsonb("risk_warnings"), // Array of risk warnings
  confidenceScore: numeric("confidence_score", { precision: 5, scale: 4 }), // 0-1
  
  // Generation Metadata
  modelUsed: varchar("model_used", { length: 50 }), // gemini-pro, gpt-4, etc.
  tokensUsed: integer("tokens_used"),
  generationTimeMs: integer("generation_time_ms"),
  
  // Cache Metadata
  hitCount: integer("hit_count").default(0),
  lastHitAt: timestamp("last_hit_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isInvalidated: boolean("is_invalidated").default(false),
}, (table) => [
  index("idx_arc_input_hash").on(table.inputHash),
  index("idx_arc_rationale_type").on(table.rationaleType),
  index("idx_arc_product").on(table.productType, table.productId),
  index("idx_arc_expires").on(table.expiresAt),
  uniqueIndex("idx_arc_hash_type_unique").on(table.inputHash, table.rationaleType),
]);

export const insertAiRationaleCacheSchema = createInsertSchema(aiRationaleCache).omit({ id: true, createdAt: true, hitCount: true });

export type AiRationaleCache = typeof aiRationaleCache.$inferSelect;

export type InsertAiRationaleCache = z.infer<typeof insertAiRationaleCacheSchema>;

export const aiFeatureSnapshots = pgTable("ai_feature_snapshots", {
  id: serial("id").primaryKey(),
  assetId: varchar("asset_id", { length: 100 }).notNull(),
  assetClass: varchar("asset_class", { length: 50 }).notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  featureJson: jsonb("feature_json").notNull(),
  regimeLabel: varchar("regime_label", { length: 20 }),
  scoringWeights: jsonb("scoring_weights"),
  compositeScore: decimal("composite_score", { precision: 8, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_feature_snapshots_asset_date").on(table.assetId, table.snapshotDate),
  index("idx_ai_feature_snapshots_date").on(table.snapshotDate),
  index("idx_ai_feature_snapshots_class").on(table.assetClass),
]);

export const insertAiFeatureSnapshotSchema = createInsertSchema(aiFeatureSnapshots).omit({ id: true, createdAt: true });

export const aiPriceHistory = pgTable("ai_price_history", {
  id: serial("id").primaryKey(),
  assetId: varchar("asset_id", { length: 100 }).notNull(),
  assetClass: varchar("asset_class", { length: 50 }).notNull(),
  priceDate: date("price_date").notNull(),
  open: decimal("open", { precision: 18, scale: 4 }),
  high: decimal("high", { precision: 18, scale: 4 }),
  low: decimal("low", { precision: 18, scale: 4 }),
  close: decimal("close", { precision: 18, scale: 4 }).notNull(),
  adjClose: decimal("adj_close", { precision: 18, scale: 4 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  changePercent: decimal("change_percent", { precision: 10, scale: 4 }),
  source: varchar("source", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_ai_price_history_asset_date_unique").on(table.assetId, table.priceDate),
  index("idx_ai_price_history_date").on(table.priceDate),
  index("idx_ai_price_history_class").on(table.assetClass),
]);

export const insertAiPriceHistorySchema = createInsertSchema(aiPriceHistory).omit({ id: true, createdAt: true });

export type AiPriceHistory = typeof aiPriceHistory.$inferSelect;

export type InsertAiPriceHistory = z.infer<typeof insertAiPriceHistorySchema>;

export const aiRegimeHistory = pgTable("ai_regime_history", {
  id: serial("id").primaryKey(),
  regimeDate: date("regime_date").notNull().unique(),
  regimeLabel: varchar("regime_label", { length: 20 }).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
  volatilityScore: decimal("volatility_score", { precision: 8, scale: 4 }),
  breadthScore: decimal("breadth_score", { precision: 8, scale: 4 }),
  trendScore: decimal("trend_score", { precision: 8, scale: 4 }),
  momentumScore: decimal("momentum_score", { precision: 8, scale: 4 }),
  signalDetails: jsonb("signal_details"),
  niftyClose: decimal("nifty_close", { precision: 18, scale: 4 }),
  niftyChange: decimal("nifty_change", { precision: 10, scale: 4 }),
  indiaVix: decimal("india_vix", { precision: 8, scale: 4 }),
  advanceDeclineRatio: decimal("advance_decline_ratio", { precision: 8, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_regime_history_date").on(table.regimeDate),
  index("idx_ai_regime_history_label").on(table.regimeLabel),
]);

export const insertAiRegimeHistorySchema = createInsertSchema(aiRegimeHistory).omit({ id: true, createdAt: true });

export type AiRegimeHistory = typeof aiRegimeHistory.$inferSelect;

export type InsertAiRegimeHistory = z.infer<typeof insertAiRegimeHistorySchema>;

export const aiModelRegistry = pgTable("ai_model_registry", {
  id: serial("id").primaryKey(),
  modelName: varchar("model_name", { length: 100 }).notNull(),
  modelVersion: varchar("model_version", { length: 20 }).notNull(),
  assetClass: varchar("asset_class", { length: 50 }),
  modelType: varchar("model_type", { length: 50 }).notNull(),
  parameters: jsonb("parameters").notNull(),
  performanceMetrics: jsonb("performance_metrics"),
  isActive: boolean("is_active").default(false),
  activatedAt: timestamp("activated_at"),
  deactivatedAt: timestamp("deactivated_at"),
  trainedOnWindow: varchar("trained_on_window", { length: 50 }),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 50 }).default("system"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ai_model_registry_name_version").on(table.modelName, table.modelVersion),
  index("idx_ai_model_registry_active").on(table.isActive),
  index("idx_ai_model_registry_class").on(table.assetClass),
]);

export const insertAiModelRegistrySchema = createInsertSchema(aiModelRegistry).omit({ id: true, createdAt: true, updatedAt: true });

export type AiModelRegistry = typeof aiModelRegistry.$inferSelect;

export type InsertAiModelRegistry = z.infer<typeof insertAiModelRegistrySchema>;

export const aiUserInteractions = pgTable("ai_user_interactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  pickId: integer("pick_id").references(() => dailyPicks.id).notNull(),
  interactionType: varchar("interaction_type", { length: 30 }).notNull(),
  metadata: jsonb("metadata"),
  sessionId: varchar("session_id", { length: 100 }),
  deviceType: varchar("device_type", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ai_user_interactions_user_pick").on(table.userId, table.pickId),
  index("idx_ai_user_interactions_user_created").on(table.userId, table.createdAt),
  index("idx_ai_user_interactions_type").on(table.interactionType),
]);

export const insertAiUserInteractionSchema = createInsertSchema(aiUserInteractions).omit({ id: true, createdAt: true });

export const aiUserProfiles = pgTable("ai_user_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  riskToleranceScore: decimal("risk_tolerance_score", { precision: 5, scale: 2 }),
  engagementScore: decimal("engagement_score", { precision: 5, scale: 2 }),
  preferredCategories: jsonb("preferred_categories"),
  avgHoldingDays: decimal("avg_holding_days", { precision: 8, scale: 2 }),
  avgInvestmentAmount: decimal("avg_investment_amount", { precision: 18, scale: 2 }),
  totalInteractions: integer("total_interactions").default(0),
  investmentCount: integer("investment_count").default(0),
  profitableTradesRatio: decimal("profitable_trades_ratio", { precision: 5, scale: 2 }),
  preferredRiskLevel: varchar("preferred_risk_level", { length: 20 }),
  lastActiveAt: timestamp("last_active_at"),
  profileVersion: integer("profile_version").default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ai_user_profiles_user").on(table.userId),
  index("idx_ai_user_profiles_risk").on(table.riskToleranceScore),
]);

export const insertAiUserProfileSchema = createInsertSchema(aiUserProfiles).omit({ id: true, createdAt: true, updatedAt: true });

export const aiPredictionLogs = pgTable("ai_prediction_logs", {
  id: serial("id").primaryKey(),
  pickId: integer("pick_id").references(() => dailyPicks.id),
  modelName: varchar("model_name", { length: 100 }).notNull(),
  modelVersion: varchar("model_version", { length: 20 }).notNull(),
  assetClass: varchar("asset_class", { length: 50 }).notNull(),
  predictedReturn: decimal("predicted_return", { precision: 10, scale: 4 }),
  predictedConfidence: decimal("predicted_confidence", { precision: 5, scale: 2 }),
  actualReturn: decimal("actual_return", { precision: 10, scale: 4 }),
  featureVector: jsonb("feature_vector").notNull(),
  predictionDate: date("prediction_date").notNull(),
  outcomeDate: date("outcome_date"),
  isCorrectDirection: boolean("is_correct_direction"),
  driftScore: decimal("drift_score", { precision: 8, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ai_prediction_logs_model_date").on(table.modelName, table.predictionDate),
  index("idx_ai_prediction_logs_pick").on(table.pickId),
  index("idx_ai_prediction_logs_class").on(table.assetClass),
  index("idx_ai_prediction_logs_date").on(table.predictionDate),
]);

export const insertAiPredictionLogSchema = createInsertSchema(aiPredictionLogs).omit({ id: true, createdAt: true });

export const aiPromptVersions = pgTable("ai_prompt_versions", {
  id: serial("id").primaryKey(),
  promptName: varchar("prompt_name", { length: 255 }).notNull(),
  version: varchar("version", { length: 50 }).notNull(),
  usedAt: timestamp("used_at").defaultNow().notNull(),
  userId: varchar("user_id"),
  feature: varchar("feature", { length: 255 }),
  responsePreviewHash: varchar("response_preview_hash", { length: 64 }),
}, (table) => [
  index("idx_ai_prompt_versions_name").on(table.promptName),
  index("idx_ai_prompt_versions_used_at").on(table.usedAt),
  index("idx_ai_prompt_versions_user_id").on(table.userId),
]);

export type AiPromptVersion = typeof aiPromptVersions.$inferSelect;
export type InsertAiPromptVersion = typeof aiPromptVersions.$inferInsert;
export const insertAiPromptVersionSchema = createInsertSchema(aiPromptVersions).omit({ id: true, usedAt: true });

export const aiGovernanceAuditLogs = pgTable("ai_governance_audit_logs", {
  auditId: varchar("audit_id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  inputQuery: text("input_query").notNull(),
  aiRawOutput: jsonb("ai_raw_output").notNull(),
  finalOutput: jsonb("final_output").notNull(),
  decision: varchar("decision", { length: 50 }).notNull(),
  violations: jsonb("violations").default([]),
  riskFlags: jsonb("risk_flags").default([]),
  modelVersion: varchar("model_version", { length: 100 }).notNull(),
  traceId: varchar("trace_id", { length: 255 }),
  partnerRiaId: varchar("partner_ria_id", { length: 255 }), // Hardening: Tracker for B2B Delegated overrides
  timestamp: timestamp("timestamp").defaultNow(),
});

export type AiGovernanceAuditLog = typeof aiGovernanceAuditLogs.$inferSelect;
export type InsertAiGovernanceAuditLog = typeof aiGovernanceAuditLogs.$inferInsert;
export const insertAiGovernanceAuditLogSchema = createInsertSchema(aiGovernanceAuditLogs).omit({ timestamp: true });

// ARSE: Recommendations tracked for scoring
export const arRecommendations = pgTable("ar_recommendations", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  asset: varchar("asset", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // equity | bond | tax | allocation
  expectedOutcome: jsonb("expected_outcome").notNull(),
  modelVersion: varchar("model_version", { length: 100 }),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_ar_recommendations_user").on(table.userId),
  index("idx_ar_recommendations_asset").on(table.asset),
]);

export type ArRecommendation = typeof arRecommendations.$inferSelect;
export const insertArRecommendationSchema = createInsertSchema(arRecommendations);

// ARSE: Outcomes tracking real-world results
export const arOutcomes = pgTable("ar_outcomes", {
  id: varchar("id", { length: 255 }).primaryKey(),
  recommendationId: varchar("recommendation_id", { length: 255 }).references(() => arRecommendations.id).notNull(),
  entryPrice: numeric("entry_price"),
  currentPrice: numeric("current_price"),
  holdingPeriodDays: integer("holding_period_days"),
  volatility: numeric("volatility"),
  actualOutcomeData: jsonb("actual_outcome_data").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow(),
}, (table) => [
  index("idx_ar_outcomes_rec").on(table.recommendationId),
]);

export type ArOutcome = typeof arOutcomes.$inferSelect;
export const insertArOutcomeSchema = createInsertSchema(arOutcomes);

// ARSE: Scores calculated by the feedback loop
export const arScores = pgTable("ar_scores", {
  id: varchar("id", { length: 255 }).primaryKey(),
  recommendationId: varchar("recommendation_id", { length: 255 }).references(() => arRecommendations.id).notNull(),
  accuracyScore: numeric("accuracy_score"),
  riskAlignmentScore: numeric("risk_alignment_score"),
  outcomeQualityScore: numeric("outcome_quality_score"),
  timeHorizonScore: numeric("time_horizon_score"),
  complianceScore: numeric("compliance_score"),
  totalScore: numeric("total_score").notNull(), // 0-100
  evaluatedAt: timestamp("evaluated_at").defaultNow(),
}, (table) => [
  index("idx_ar_scores_rec").on(table.recommendationId),
  index("idx_ar_scores_total").on(table.totalScore),
]);

export type ArScore = typeof arScores.$inferSelect;
export const insertArScoreSchema = createInsertSchema(arScores);

// ARSE: Aggregated model metrics 
export const arModelMetrics = pgTable("ar_model_metrics", {
  modelVersion: varchar("model_version", { length: 100 }).primaryKey(),
  averageScore: numeric("average_score").notNull(),
  consistencyScore: numeric("consistency_score").notNull(),
  totalEvaluations: integer("total_evaluations").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export type ArModelMetric = typeof arModelMetrics.$inferSelect;
export const insertArModelMetricSchema = createInsertSchema(arModelMetrics);

// AMSE: AI Model Selection Registry
export const amseModelRegistry = pgTable("amse_model_registry", {
  modelId: varchar("model_id", { length: 255 }).primaryKey(),
  type: varchar("type", { length: 50 }).notNull(), // LLM, Quant, RuleEngine
  capabilities: jsonb("capabilities").notNull().default([]),
  avgScore: numeric("avg_score").default('0'), // Pushed from ARSE
  latencyMs: integer("latency_ms").default(0), // Measured runtime latency
  costPerCall: numeric("cost_per_call").default('0'),
  complianceScore: numeric("compliance_score").default('100'), // Starts at 100, decays on AAGE flags
  specializationWeights: jsonb("specialization_weights").default({}), 
  status: varchar("status", { length: 50 }).notNull().default('active'), // active, degraded, inactive
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  index("idx_amse_model_type").on(table.type),
  index("idx_amse_model_status").on(table.status),
]);

export type AmseModelRegistryEntry = typeof amseModelRegistry.$inferSelect;
export const insertAmseModelRegistrySchema = createInsertSchema(amseModelRegistry);

// AMSE: Traceable Selection Logs for Audit
export const amseSelectionLogs = pgTable("amse_selection_logs", {
  id: varchar("id", { length: 255 }).primaryKey(),
  queryId: varchar("query_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }),
  selectedModel: varchar("selected_model", { length: 255 }).notNull().references(() => amseModelRegistry.modelId),
  alternativeModels: jsonb("alternative_models").default([]),
  selectionScore: numeric("selection_score").notNull(),
  selectionReason: text("selection_reason").notNull(),
  fallbackTriggered: boolean("fallback_triggered").default(false),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_amse_selection_query").on(table.queryId),
  index("idx_amse_selection_model").on(table.selectedModel),
]);

export type AmseSelectionLog = typeof amseSelectionLogs.$inferSelect;
export const insertAmseSelectionLogSchema = createInsertSchema(amseSelectionLogs);

// FAIL: Universal System State configuration for the Kill Switch mechanism
export const failSystemState = pgTable("fail_system_state", {
  configKey: varchar("config_key", { length: 255 }).primaryKey(),
  isGloballyDisabled: boolean("is_globally_disabled").default(false).notNull(),
  lastTriggerReason: text("last_trigger_reason"),
  triggeredAt: timestamp("triggered_at"),
  statusOverride: varchar("status_override", { length: 255 }), 
});

export type FailSystemStateEntry = typeof failSystemState.$inferSelect;
export const insertFailSystemStateSchema = createInsertSchema(failSystemState);

// APSE: Tracing logs for Quantitative Simulation Arrays and Input Sets
export const apseSimulationLogs = pgTable("apse_simulation_logs", {
  id: varchar("id", { length: 255 }).primaryKey(),
  recommendationId: varchar("recommendation_id", { length: 255 }).notNull(),
  executionTimeMs: integer("execution_time_ms").notNull(),
  inputPortfolioMap: jsonb("input_portfolio_map").notNull(),
  assumptionsVectors: jsonb("assumptions_vectors").notNull(),
  outputDistributions: jsonb("output_distributions").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_apse_sim_rec_id").on(table.recommendationId),
]);

export type ApseSimulationLog = typeof apseSimulationLogs.$inferSelect;
export const insertApseSimulationLogSchema = createInsertSchema(apseSimulationLogs);

// APRE: Tracker for Autonomous Portfolio Rebalancing Audits
export const apreAuditLogs = pgTable("apre_audit_logs", {
  id: varchar("id", { length: 255 }).primaryKey(),
  portfolioId: varchar("portfolio_id", { length: 255 }).notNull(),
  triggerType: varchar("trigger_type", { length: 50 }).notNull(), // drift_threshold, risk_based, calendar
  generatedPlan: jsonb("generated_plan").notNull(),
  simulationSummary: jsonb("simulation_summary").notNull(),
  governanceDecision: varchar("governance_decision", { length: 50 }).notNull(), // APPROVE | MODIFY | BLOCK
  approvalStatus: varchar("approval_status", { length: 50 }).default('pending'), // Human-in-loop wrapper string
  executionStatus: varchar("execution_status", { length: 50 }).default('not_started'),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_apre_portfolio").on(table.portfolioId),
]);

export type ApreAuditLog = typeof apreAuditLogs.$inferSelect;
export const insertApreAuditLogSchema = createInsertSchema(apreAuditLogs);

// URCAE: Audit layer tracking the explicit math models forcing initial Allocations
export const urcaeAllocationLogs = pgTable("urcae_allocation_logs", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  modelUsed: varchar("model_used", { length: 150 }).notNull(), // Mean-Variance, Risk Parity
  inputsDetected: jsonb("inputs_detected").notNull(),
  activeConstraints: jsonb("active_constraints").notNull(),
  finalWeightsVector: jsonb("final_weights_vector").notNull(),
  optimisticFallbackTriggered: boolean("optimistic_fallback_triggered").default(false),
  partnerRiaId: varchar("partner_ria_id", { length: 255 }), // Hardening: Traceability for B2B allocation overrides
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_urcae_user").on(table.userId),
]);

export type UrcaeAllocationLog = typeof urcaeAllocationLogs.$inferSelect;
export const insertUrcaeAllocationLogSchema = createInsertSchema(urcaeAllocationLogs);
