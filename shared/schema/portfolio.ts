import { sql } from "drizzle-orm";
import { boolean, date, decimal, index, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { users } from "./users";

export const familyGroups = pgTable("family_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  groupType: varchar("group_type").default("family"),
  description: text("description"),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const portfolios = pgTable("portfolios", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  name: text("name").notNull(),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }),
  cash: decimal("cash", { precision: 15, scale: 2 }).default("0"),
  baseCurrency: varchar("base_currency").default("INR"),
  isDefault: boolean("is_default").default(false),
  familyId: varchar("family_id").references(() => familyGroups.id),
  isShared: boolean("is_shared").default(false),
  source: varchar("source").default("manual"),
  lastFetchedAt: timestamp("last_fetched_at"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const portfolioHoldings = pgTable("portfolio_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  symbol: text("symbol"),
  name: text("name"),
  isin: text("isin"),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(),
  avgPrice: decimal("avg_price", { precision: 15, scale: 4 }),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  investedValue: decimal("invested_value", { precision: 15, scale: 2 }),
  assetType: text("asset_type").notNull(),
  sector: text("sector"),
  assetClass: text("asset_class"),
  folioNumber: text("folio_number"),
  purchaseDate: timestamp("purchase_date"),
  productType: text("product_type"),
  returnPercentage: decimal("return_percentage", { precision: 10, scale: 2 }),
  source: text("source"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow(),
});


export const externalHoldings = pgTable("external_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  symbol: text("symbol").notNull(),
  name: text("name"),
  isin: text("isin"),
  assetType: text("asset_type").default("Equity"),
  quantity: decimal("quantity", { precision: 15, scale: 4 }).notNull(),
  avgPrice: decimal("avg_price", { precision: 15, scale: 4 }).default("0"),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }).default("0"),
  source: text("source").notNull(), // CDSL, NSDL, UPLOADED
  depository: text("depository"),
  dpId: text("dp_id"),
  clientId: text("client_id"),
  consentId: text("consent_id"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  cobStatus: text("cob_status").default("none"), // none, in_progress, completed, failed
  cobInitiatedAt: timestamp("cob_initiated_at"),
  cobInitiatedBy: varchar("cob_initiated_by").references(() => users.id),
  cobTargetBroker: text("cob_target_broker"),
  cobReason: text("cob_reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_external_holdings_user").on(table.userId),
  index("idx_external_holdings_source").on(table.source),
]);

export const watchlists = pgTable("watchlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  name: text("name").notNull(),
  symbols: text("symbols").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// marketData table has been moved to shared/schema/market-data.ts
// to avoid duplicate exports in the main schema.ts

export const assetAllocation = pgTable("asset_allocation", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  assetType: text("asset_type").notNull(),
  assetClass: text("asset_class"),
  targetPercentage: decimal("target_percentage", { precision: 5, scale: 2 }),
  currentPercentage: decimal("current_percentage", { precision: 5, scale: 2 }),
  targetValue: decimal("target_value", { precision: 15, scale: 2 }),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  rebalanceAmount: decimal("rebalance_amount", { precision: 15, scale: 2 }),
  riskScore: decimal("risk_score", { precision: 3, scale: 1 }),
  expectedReturn: decimal("expected_return", { precision: 5, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Portfolio snapshots for date-specific portfolio views
export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  snapshotDate: date("snapshot_date").notNull(),
  totalValue: decimal("total_value", { precision: 15, scale: 2 }),
  totalEquityValue: decimal("total_equity_value", { precision: 15, scale: 2 }),
  totalDebtValue: decimal("total_debt_value", { precision: 15, scale: 2 }),
  totalMutualFundValue: decimal("total_mutual_fund_value", { precision: 15, scale: 2 }),
  totalGovernmentSchemeValue: decimal("total_government_scheme_value", { precision: 15, scale: 2 }),
  totalAlternativeValue: decimal("total_alternative_value", { precision: 15, scale: 2 }),
  totalCashValue: decimal("total_cash_value", { precision: 15, scale: 2 }),
  epfValue: decimal("epf_value", { precision: 15, scale: 2 }),
  ppfValue: decimal("ppf_value", { precision: 15, scale: 2 }),
  epsValue: decimal("eps_value", { precision: 15, scale: 2 }),
  apyValue: decimal("apy_value", { precision: 15, scale: 2 }),
  npsValue: decimal("nps_value", { precision: 15, scale: 2 }),
  insuranceValue: decimal("insurance_value", { precision: 15, scale: 2 }),
  realEstateValue: decimal("real_estate_value", { precision: 15, scale: 2 }),
  commodityValue: decimal("commodity_value", { precision: 15, scale: 2 }),
  cryptoValue: decimal("crypto_value", { precision: 15, scale: 2 }),
  metadata: jsonb("metadata"), // Additional snapshot data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced portfolio holdings to support date-specific and cross-platform data
export const comprehensiveHoldings = pgTable("comprehensive_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  snapshotId: varchar("snapshot_id").references(() => portfolioSnapshots.id),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  holdingDate: date("holding_date").notNull(),
  
  // Asset Identification
  symbol: text("symbol").notNull(),
  isin: varchar("isin"),
  assetName: text("asset_name").notNull(),
  assetType: text("asset_type").notNull(), // 'equity', 'debt', 'mutual_fund', 'government_scheme', 'alternative', 'commodity', 'real_estate', 'crypto', 'insurance', 'cash'
  assetClass: text("asset_class"), // 'large_cap', 'mid_cap', 'small_cap', 'debt', 'hybrid', 'epf', 'ppf', 'eps', 'apy', 'nps', 'ulip', 'term_plan'
  subAssetClass: text("sub_asset_class"), // More granular classification
  
  // Holding Details
  quantity: decimal("quantity", { precision: 15, scale: 4 }),
  units: decimal("units", { precision: 15, scale: 4 }), // For mutual funds
  avgPrice: decimal("avg_price", { precision: 15, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  marketValue: decimal("market_value", { precision: 15, scale: 2 }),
  investedValue: decimal("invested_value", { precision: 15, scale: 2 }),
  gainLoss: decimal("gain_loss", { precision: 15, scale: 2 }),
  gainLossPercent: decimal("gain_loss_percent", { precision: 8, scale: 4 }),
  
  // Source Integration
  dataSource: varchar("data_source").notNull(), // 'cams', 'kfintech', 'nsdl', 'cdsl', 'epf', 'ppf', 'manual', 'government_portal'
  sourceAccountNumber: varchar("source_account_number"), // Original account number from source
  folio: varchar("folio"), // For mutual funds
  dematAccountNumber: varchar("demat_account_number"), // For equity/bonds
  
  // Additional Details
  sector: text("sector"),
  industry: text("industry"),
  marketCap: decimal("market_cap", { precision: 20, scale: 0 }),
  beta: decimal("beta", { precision: 5, scale: 3 }),
  dividendYield: decimal("dividend_yield", { precision: 5, scale: 2 }),
  peRatio: decimal("pe_ratio", { precision: 8, scale: 2 }),
  maturityDate: date("maturity_date"), // For bonds, FDs, government schemes
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
  
  // Global & Enrichment Enhancements
  currency: varchar("currency", { length: 10 }).default("INR"), // Holding native currency (e.g. USD, EUR)
  isAdr: boolean("is_adr").default(false), // Whether it's an ADR (for US-listed global stocks)
  exchangeMic: varchar("exchange_mic", { length: 20 }), // Market Identifier Code (e.g. XNAS, XNYS)
  lastEnrichedAt: timestamp("last_enriched_at"), // Last AI enrichment timestamp
  enrichmentSource: varchar("enrichment_source", { length: 50 }), // Source of enrichment (e.g. 'alpaca', 'iris')
  
  // Government Scheme Specific
  contributionFrequency: varchar("contribution_frequency"), // monthly, quarterly, yearly
  nomineeName: text("nominee_name"),
  nomineeRelation: varchar("nominee_relation"),
  
  nomineeDetails: jsonb("nominee_details"), // All 3 nominees from CAS
  kycStatus: varchar("kyc_status"), // "OK", "PENDING"
  exitLoadRules: text("exit_load_rules"), // Full exit load text from CAS
  navDate: date("nav_date"), // NAV valuation date
  openingUnitBalance: decimal("opening_unit_balance", { precision: 15, scale: 6 }), // Opening units from CAS
  registrarType: varchar("registrar_type"), // "CAMS" or "KFINTECH"
  advisorArnCode: varchar("advisor_arn_code"), // ARN code of distributor
  // Metadata and Tracking
  metadata: jsonb("metadata"), // Additional holding-specific data
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_comprehensive_holdings_unique").on(table.userId, table.isin, table.folio),
  index("idx_comprehensive_holdings_user_date").on(table.userId, table.holdingDate),
]);

// Pi Chat Asset Summaries
export const piChatSummaries = pgTable("pi_chat_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  assetClass: text("asset_class").notNull(),
  summary: text("summary").notNull(),
  insights: jsonb("insights"), // key metrics, risks, opportunities
  recommendations: text("recommendations").array(),
  lastAnalyzed: timestamp("last_analyzed").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Commodity Tracking
export const commodityPrices = pgTable("commodity_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(), // precious_metals, energy, agricultural, industrial
  price: decimal("price", { precision: 15, scale: 4 }).notNull(),
  priceUnit: text("price_unit").notNull(), // per_ounce, per_barrel, per_ton
  change: decimal("change", { precision: 15, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 8, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Enhanced Rebalancing Suggestions
export const rebalancingSuggestions = pgTable("rebalancing_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  suggestionType: text("suggestion_type").notNull(), // yield_optimization, risk_reduction, diversification
  priority: text("priority").notNull(), // high, medium, low
  title: text("title").notNull(),
  description: text("description").notNull(),
  actions: jsonb("actions"), // array of specific actions to take
  expectedImpact: jsonb("expected_impact"), // yield, risk, diversification improvements
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 1 }),
  implementationSteps: text("implementation_steps").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Symbol Mapping Layer — cross-linking NSE/BSE/Bloomberg/etc ─────────────
export const symbolMapping = pgTable("symbol_mapping", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // NSE, BSE, BLOOMBERG, PROBE42, REUTERS, SCREENER, AMFI, FMP
  providerSymbol: varchar("provider_symbol", { length: 100 }).notNull(),
  providerName: text("provider_name"), // human-readable company/fund name from that provider
  isPrimary: boolean("is_primary").default(false), // true = preferred identifier for this provider
  isActive: boolean("is_active").default(true),
  lastVerifiedAt: timestamp("last_verified_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_symbol_mapping_isin").on(table.isin),
  index("idx_symbol_mapping_provider").on(table.provider),
  index("idx_symbol_mapping_symbol").on(table.providerSymbol),
  uniqueIndex("idx_symbol_mapping_isin_provider").on(table.isin, table.provider),
]);



import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { User } from './users';
import type { Agent } from './agents';
import type { Document } from './documents';
import { investmentProposals } from './proposals-base';

import type { Product } from './products';
import { mfHoldings } from './mutual-funds';

import { advisorySessions, suitabilityChecks, insertAdvisorySessionSchema } from './advisory';
import { agents } from './agents';
import { rebalancingRecommendations } from './clients';

// Types

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = typeof portfolios.$inferInsert;

export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;
export type InsertPortfolioHolding = typeof portfolioHoldings.$inferInsert;


export type ExternalHolding = typeof externalHoldings.$inferSelect;
export type InsertExternalHolding = typeof externalHoldings.$inferInsert;

export type Watchlist = typeof watchlists.$inferSelect;
export type InsertWatchlist = typeof watchlists.$inferInsert;

export type AssetAllocation = typeof assetAllocation.$inferSelect;
export type InsertAssetAllocation = typeof assetAllocation.$inferInsert;


export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;
export type InsertPortfolioSnapshot = typeof portfolioSnapshots.$inferInsert;

export type ComprehensiveHolding = typeof comprehensiveHoldings.$inferSelect;
export type InsertComprehensiveHolding = typeof comprehensiveHoldings.$inferInsert;

// Zod Schemas

export const insertPortfolioSchema = createInsertSchema(portfolios).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldings).extend({
  id: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  updatedAt: true,
});


export const insertWatchlistSchema = createInsertSchema(watchlists).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertAssetAllocationSchema = createInsertSchema(assetAllocation).extend({
  id: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  updatedAt: true,
});


// --- Auto-Migrated Tables ---




export const portfolioComparisons = pgTable("portfolio_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Comparison Request Details
  portfolioIds: jsonb("portfolio_ids").notNull(), // Array of portfolio IDs to compare
  comparisonType: varchar("comparison_type").default("comprehensive"), // basic/comprehensive/risk_analysis
  benchmarkIndex: varchar("benchmark_index").default("NIFTY_50"), // Benchmark for comparison
  timePeriod: varchar("time_period").default("1Y"), // Analysis period
  
  // Portfolio Analysis Results
  performanceMetrics: jsonb("performance_metrics"), // Returns, volatility, Sharpe ratio for each portfolio
  riskAnalysis: jsonb("risk_analysis"), // VaR, max drawdown, risk-adjusted returns
  assetAllocationComparison: jsonb("asset_allocation_comparison"), // Asset allocation breakdown
  correlationMatrix: jsonb("correlation_matrix"), // Correlation between portfolios
  
  // Advanced Analytics
  diversificationAnalysis: jsonb("diversification_analysis"), // Diversification scores and metrics
  sectorExposure: jsonb("sector_exposure"), // Sector-wise breakdown comparison
  topHoldingsComparison: jsonb("top_holdings_comparison"), // Overlap analysis of top holdings
  efficiencyMetrics: jsonb("efficiency_metrics"), // Efficient frontier analysis
  
  // Recommendations and Insights
  bestPortfolio: varchar("best_portfolio"), // Portfolio ID of best performer
  worstPortfolio: varchar("worst_portfolio"), // Portfolio ID of worst performer
  rebalancingSuggestions: jsonb("rebalancing_suggestions"), // AI recommendations for each portfolio
  riskScore: decimal("risk_score", { precision: 3, scale: 1 }), // Overall risk score (1-10)
  
  // Summary
  executiveSummary: text("executive_summary"), // High-level insights
  keyFindings: jsonb("key_findings"), // Array of key findings and insights
  actionableRecommendations: jsonb("actionable_recommendations"), // Specific action items
  
  // Request Metadata
  requestedAt: timestamp("requested_at").defaultNow(),
  status: varchar("status").default("completed"), // pending/completed/failed
  errorMessage: text("error_message"),
  processingTimeMs: integer("processing_time_ms"), // Time taken for analysis
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortfolioComparisonSchema = createInsertSchema(portfolioComparisons).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type PortfolioComparison = typeof portfolioComparisons.$inferSelect;
export type InsertPortfolioComparison = z.infer<typeof insertPortfolioComparisonSchema>;

export const portfolioPredictions = pgTable("portfolio_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Prediction period
  predictionDate: timestamp("prediction_date").notNull(),
  predictionHorizon: varchar("prediction_horizon").notNull(), // '1M', '3M', '6M', '1Y', '3Y', '5Y'
  
  // Performance predictions
  expectedReturn: decimal("expected_return", { precision: 10, scale: 4 }), // Percentage
  expectedValue: decimal("expected_value", { precision: 20, scale: 2 }),
  lowerBound: decimal("lower_bound", { precision: 20, scale: 2 }), // 95% confidence
  upperBound: decimal("upper_bound", { precision: 20, scale: 2 }), // 95% confidence
  
  // Risk metrics
  volatility: decimal("volatility", { precision: 10, scale: 4 }), // Standard deviation
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 4 }),
  beta: decimal("beta", { precision: 10, scale: 4 }), // Market correlation
  varValue: decimal("var_value", { precision: 20, scale: 2 }), // Value at Risk
  maxDrawdown: decimal("max_drawdown", { precision: 10, scale: 4 }), // Maximum expected loss
  
  // Trend analysis
  trendDirection: varchar("trend_direction"), // 'bullish', 'bearish', 'neutral'
  trendStrength: decimal("trend_strength", { precision: 5, scale: 2 }), // 0-100
  momentum: decimal("momentum", { precision: 10, scale: 4 }),
  
  // Statistical indicators
  cagr: decimal("cagr", { precision: 10, scale: 4 }), // Compound Annual Growth Rate
  movingAverage50Day: decimal("moving_average_50day", { precision: 20, scale: 2 }),
  movingAverage200Day: decimal("moving_average_200day", { precision: 20, scale: 2 }),
  rsi: decimal("rsi", { precision: 5, scale: 2 }), // Relative Strength Index (0-100)
  
  // Prediction confidence
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }), // 0-100
  modelVersion: varchar("model_version"),
  dataQualityScore: decimal("data_quality_score", { precision: 5, scale: 2 }),
  
  // Historical comparison
  historicalAccuracy: decimal("historical_accuracy", { precision: 5, scale: 2 }), // % accuracy from past predictions
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_portfolio_predictions_user").on(table.userId),
  index("idx_portfolio_predictions_portfolio").on(table.portfolioId),
  index("idx_portfolio_predictions_date").on(table.predictionDate),
]);

// Asset-level performance forecasts
export const assetForecasts = pgTable("asset_forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  holdingId: varchar("holding_id").references(() => portfolioHoldings.id),
  
  // Asset identification
  symbol: varchar("symbol").notNull(),
  assetType: varchar("asset_type").notNull(), // 'stock', 'mutual_fund', 'bond', 'crypto'
  
  // Forecast period
  forecastDate: timestamp("forecast_date").notNull(),
  horizon: varchar("horizon").notNull(), // '1M', '3M', '6M', '1Y'
  
  // Price predictions
  currentPrice: decimal("current_price", { precision: 20, scale: 2 }),
  predictedPrice: decimal("predicted_price", { precision: 20, scale: 2 }),
  priceChange: decimal("price_change", { precision: 10, scale: 4 }), // Percentage
  
  // Performance metrics
  expectedReturn: decimal("expected_return", { precision: 10, scale: 4 }),
  volatility: decimal("volatility", { precision: 10, scale: 4 }),
  beta: decimal("beta", { precision: 10, scale: 4 }),
  
  // Technical indicators
  supportLevel: decimal("support_level", { precision: 20, scale: 2 }),
  resistanceLevel: decimal("resistance_level", { precision: 20, scale: 2 }),
  trendSignal: varchar("trend_signal"), // 'buy', 'sell', 'hold'
  
  // Risk assessment
  riskRating: varchar("risk_rating"), // 'low', 'medium', 'high', 'very_high'
  probabilityOfLoss: decimal("probability_of_loss", { precision: 5, scale: 2 }), // 0-100
  
  // Recommendations
  recommendation: varchar("recommendation"), // 'strong_buy', 'buy', 'hold', 'sell', 'strong_sell'
  recommendationReason: text("recommendation_reason"),
  
  // Confidence metrics
  confidenceLevel: decimal("confidence_level", { precision: 5, scale: 2 }), // 0-100
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_asset_forecasts_user").on(table.userId),
  index("idx_asset_forecasts_symbol").on(table.symbol),
  index("idx_asset_forecasts_holding").on(table.holdingId),
]);

// Risk analysis and scenarios
export const riskAnalysis = pgTable("risk_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Analysis metadata
  analysisDate: timestamp("analysis_date").notNull(),
  analysisType: varchar("analysis_type").notNull(), // 'portfolio', 'asset', 'market'
  
  // Overall risk metrics
  overallRiskScore: decimal("overall_risk_score", { precision: 5, scale: 2 }), // 0-100
  riskCategory: varchar("risk_category"), // 'conservative', 'moderate', 'aggressive'
  
  // Diversification metrics
  diversificationScore: decimal("diversification_score", { precision: 5, scale: 2 }), // 0-100
  concentrationRisk: decimal("concentration_risk", { precision: 5, scale: 2 }),
  correlationRisk: decimal("correlation_risk", { precision: 5, scale: 2 }),
  
  // Market risk
  marketRisk: decimal("market_risk", { precision: 10, scale: 4 }),
  sectorRisk: decimal("sector_risk", { precision: 10, scale: 4 }),
  geographicRisk: decimal("geographic_risk", { precision: 10, scale: 4 }),
  
  // Stress test scenarios
  marketCrashScenario: jsonb("market_crash_scenario"), // Impact of 20% market drop
  recessionScenario: jsonb("recession_scenario"), // Economic recession impact
  interestRateRise: jsonb("interest_rate_rise"), // Interest rate increase impact
  inflationScenario: jsonb("inflation_scenario"), // High inflation impact
  
  // VaR calculations
  var1Day: decimal("var_1day", { precision: 20, scale: 2 }), // Value at Risk 1 day
  var1Week: decimal("var_1week", { precision: 20, scale: 2 }),
  var1Month: decimal("var_1month", { precision: 20, scale: 2 }),
  
  // Recommendations
  riskMitigationSuggestions: jsonb("risk_mitigation_suggestions"),
  rebalancingRecommendations: jsonb("rebalancing_recommendations"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_risk_analysis_user").on(table.userId),
  index("idx_risk_analysis_portfolio").on(table.portfolioId),
  index("idx_risk_analysis_date").on(table.analysisDate),
]);

// Prediction accuracy tracking
export const predictionAccuracy = pgTable("prediction_accuracy", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  predictionId: varchar("prediction_id").references(() => portfolioPredictions.id),
  assetForecastId: varchar("asset_forecast_id").references(() => assetForecasts.id),
  
  // Prediction details
  predictionDate: timestamp("prediction_date").notNull(),
  targetDate: timestamp("target_date").notNull(),
  actualDate: timestamp("actual_date").notNull(), // When actual result was measured
  
  // Accuracy metrics
  predictedValue: decimal("predicted_value", { precision: 20, scale: 2 }),
  actualValue: decimal("actual_value", { precision: 20, scale: 2 }),
  errorPercentage: decimal("error_percentage", { precision: 10, scale: 4 }),
  absoluteError: decimal("absolute_error", { precision: 20, scale: 2 }),
  
  // Evaluation
  accuracyScore: decimal("accuracy_score", { precision: 5, scale: 2 }), // 0-100
  predictionQuality: varchar("prediction_quality"), // 'excellent', 'good', 'fair', 'poor'
  
  // Model feedback
  modelVersion: varchar("model_version"),
  improvementNotes: text("improvement_notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const portfolioDiagnostics = pgTable("portfolio_diagnostics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Analysis Timestamp
  analysisDate: timestamp("analysis_date").defaultNow(),
  
  // Current Portfolio Snapshot (at time of analysis)
  portfolioSnapshot: jsonb("portfolio_snapshot").$type<{
    totalValue: number;
    assetAllocation: Record<string, { value: number; percentage: number }>;
    holdings: Array<{
      assetType: string;
      isin?: string;
      schemeName: string;
      currentValue: number;
      weightPercent: number;
      riskScore: number;
      lockIn?: boolean;
    }>;
  }>().notNull(),
  
  // Risk Analysis
  portfolioRiskScore: decimal("portfolio_risk_score", { precision: 5, scale: 2 }).notNull(), // 0-10 scale
  clientRiskTolerance: varchar("client_risk_tolerance").notNull(), // conservative/moderate/aggressive
  riskMismatchPercent: decimal("risk_mismatch_percent", { precision: 5, scale: 2 }), // deviation from ideal
  
  // Asset Allocation Analysis
  idealAllocation: jsonb("ideal_allocation").$type<Record<string, { min: number; max: number; target: number }>>(),
  allocationDeviation: jsonb("allocation_deviation").$type<Record<string, { current: number; target: number; deviation: number }>>(),
  
  // Concentration Analysis
  concentrationIssues: jsonb("concentration_issues").$type<Array<{
    type: "single_stock" | "single_amc" | "sector" | "issuer";
    name: string;
    currentPercent: number;
    limitPercent: number;
    severity: "warning" | "critical";
  }>>().default([]),
  
  // MF Overlap Analysis
  mfOverlapPercent: decimal("mf_overlap_percent", { precision: 5, scale: 2 }),
  mfOverlapDetails: jsonb("mf_overlap_details").$type<Array<{
    scheme1: string;
    scheme2: string;
    overlapPercent: number;
    commonStocks: string[];
  }>>().default([]),
  
  // Duration Mismatch (for debt)
  durationMismatch: jsonb("duration_mismatch").$type<{
    clientHorizon: number; // in years
    portfolioDuration: number; // weighted avg duration
    mismatchSeverity: "none" | "minor" | "major";
  }>(),
  
  // Liquidity Analysis
  liquidityIssues: jsonb("liquidity_issues").$type<Array<{
    holding: string;
    lockInEndDate?: string;
    exitLoadApplicable: boolean;
    liquidityRisk: "low" | "medium" | "high";
  }>>().default([]),
  
  // Underperformers
  underperformers: jsonb("underperformers").$type<Array<{
    scheme: string;
    benchmark: string;
    underperformancePercent: number;
    period: string;
  }>>().default([]),
  
  // Tax Inefficiencies
  taxIssues: jsonb("tax_issues").$type<Array<{
    holding: string;
    issue: string;
    potentialTaxSaving?: number;
  }>>().default([]),
  
  // Overall Health Score
  healthScore: integer("health_score").notNull(), // 0-100
  healthSummary: text("health_summary"), // AI-generated summary
  
  // Issues Summary
  issueCount: jsonb("issue_count").$type<{
    critical: number;
    warning: number;
    info: number;
  }>().default({ critical: 0, warning: 0, info: 0 }),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_portfolio_diagnostics_user").on(table.userId),
  index("idx_portfolio_diagnostics_date").on(table.analysisDate),
]);

// AI Proposals - Main proposal entity
export const aiProposals = pgTable("ai_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Client & Agent
  clientId: varchar("client_id").notNull().references(() => users.id),
  agentId: varchar("agent_id").references(() => users.id), // Agent who is managing the proposal
  
  // Associated Diagnostics
  diagnosticsId: varchar("diagnostics_id").references(() => portfolioDiagnostics.id),
  
  // Proposal Details
  proposalNumber: varchar("proposal_number").notNull().unique(), // Human-readable proposal ID
  title: varchar("title").notNull(),
  description: text("description"),
  
  // Status
  status: varchar("status").notNull().default("draft"),
  
  // Validity
  validUntil: timestamp("valid_until"),
  
  // Portfolio Impact Summary
  beforeAllocation: jsonb("before_allocation").$type<Record<string, number>>(),
  afterAllocation: jsonb("after_allocation").$type<Record<string, number>>(),
  riskScoreBefore: decimal("risk_score_before", { precision: 5, scale: 2 }),
  riskScoreAfter: decimal("risk_score_after", { precision: 5, scale: 2 }),
  expectedRiskImpact: varchar("expected_risk_impact"), // e.g., "-12%"
  
  // Investment Summary
  totalInvestmentAmount: decimal("total_investment_amount", { precision: 20, scale: 2 }),
  totalRedemptionAmount: decimal("total_redemption_amount", { precision: 20, scale: 2 }),
  netCashFlow: decimal("net_cash_flow", { precision: 20, scale: 2 }),
  
  // AI Engine Metadata
  aiEngineVersion: varchar("ai_engine_version").default("1.0.0"),
  aiModelUsed: varchar("ai_model_used"), // e.g., "gemini-1.5-pro"
  aiGeneratedAt: timestamp("ai_generated_at"),
  
  // SEBI Compliance
  sebiDisclaimer: text("sebi_disclaimer").notNull().default(
    "This investment proposal is generated using an AI-assisted analytical system based on information provided by the client and available market data. The recommendations are not investment advice, do not assure returns, and are subject to market risks. Final investment decisions shall be taken by the client after independent evaluation."
  ),
  disclaimerAcknowledged: boolean("disclaimer_acknowledged").default(false),
  disclaimerAcknowledgedAt: timestamp("disclaimer_acknowledged_at"),
  
  // Agent Notes & Modifications
  agentNotes: text("agent_notes"),
  agentModifiedAt: timestamp("agent_modified_at"),
  
  // Client Decision
  clientDecision: varchar("client_decision"), // approved/rejected/partial
  clientDecisionAt: timestamp("client_decision_at"),
  clientNotes: text("client_notes"),
  
  // Execution
  executedAt: timestamp("executed_at"),
  cartReferenceIds: jsonb("cart_reference_ids").$type<string[]>().default([]),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ai_proposals_client").on(table.clientId),
  index("idx_ai_proposals_agent").on(table.agentId),
  index("idx_ai_proposals_status").on(table.status),
  index("idx_ai_proposals_number").on(table.proposalNumber),
]);

// AI Proposal Items - Individual recommendations
export const aiProposalItems = pgTable("ai_proposal_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").notNull().references(() => aiProposals.id),
  
  // Recommendation Type
  recommendationType: varchar("recommendation_type").notNull(), // BUY/SELL/SWITCH/HOLD
  
  // Asset Details
  assetClass: varchar("asset_class").notNull(), // equity/mutual_fund/bond/etc.
  productId: varchar("product_id"), // Reference to product in store
  isin: varchar("isin"),
  schemeName: varchar("scheme_name").notNull(),
  amcName: varchar("amc_name"),
  
  // For SWITCH recommendations
  switchFromProductId: varchar("switch_from_product_id"),
  switchFromIsin: varchar("switch_from_isin"),
  switchFromSchemeName: varchar("switch_from_scheme_name"),
  
  // Amount/Units
  amount: decimal("amount", { precision: 20, scale: 2 }),
  units: decimal("units", { precision: 15, scale: 4 }),
  currentValue: decimal("current_value", { precision: 20, scale: 2 }), // For SELL/SWITCH
  
  // Rationale (Explainability - CRITICAL)
  rationale: text("rationale").notNull(), // AI-generated explanation
  problemIdentified: text("problem_identified"), // What issue does this solve
  riskInvolved: text("risk_involved"), // Risks associated
  portfolioImpactSummary: text("portfolio_impact_summary"), // Before vs after impact
  
  // Risk Impact
  riskImpactPercent: varchar("risk_impact_percent"), // e.g., "-12%"
  
  // Product-level disclaimers
  productDisclaimer: text("product_disclaimer"), // MLDs, AIFs, etc. specific disclaimers
  
  // Priority/Order
  priority: integer("priority").default(1), // For ordering recommendations
  
  // Status
  status: varchar("status").notNull().default("pending"),
  
  // Agent Modifications
  agentModified: boolean("agent_modified").default(false),
  originalAmount: decimal("original_amount", { precision: 20, scale: 2 }), // Original AI suggestion
  originalRationale: text("original_rationale"),
  agentModificationReason: text("agent_modification_reason"),
  
  // Client Decision
  clientDecision: varchar("client_decision"), // approved/rejected
  clientDecisionAt: timestamp("client_decision_at"),
  clientRejectionReason: text("client_rejection_reason"),
  
  // Execution
  executedAt: timestamp("executed_at"),
  cartItemId: varchar("cart_item_id"),
  orderId: varchar("order_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ai_proposal_items_proposal").on(table.proposalId),
  index("idx_ai_proposal_items_type").on(table.recommendationType),
  index("idx_ai_proposal_items_status").on(table.status),
  index("idx_ai_proposal_items_asset_class").on(table.assetClass),
]);

// AI Audit Logs - SEBI compliance audit trail
export const aiAuditLogs = pgTable("ai_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Reference
  proposalId: varchar("proposal_id").references(() => aiProposals.id),
  proposalItemId: varchar("proposal_item_id").references(() => aiProposalItems.id),
  diagnosticsId: varchar("diagnostics_id").references(() => portfolioDiagnostics.id),
  
  // Actor
  actorId: varchar("actor_id").references(() => users.id),
  actorRole: varchar("actor_role").notNull(), // client/agent/admin/system/ai
  
  // Action
  action: varchar("action").notNull(), // created/modified/approved/rejected/executed/viewed/etc.
  actionCategory: varchar("action_category").notNull(), // proposal/item/diagnostics/system
  
  // Details
  previousState: jsonb("previous_state"), // State before action
  newState: jsonb("new_state"), // State after action
  changeDetails: jsonb("change_details").$type<{
    field?: string;
    oldValue?: any;
    newValue?: any;
    reason?: string;
  }>(),
  
  // AI Context (for AI-generated entries)
  aiEngineVersion: varchar("ai_engine_version"),
  aiInputSnapshot: jsonb("ai_input_snapshot"), // What data was fed to AI
  aiOutputSnapshot: jsonb("ai_output_snapshot"), // What AI produced
  aiModelUsed: varchar("ai_model_used"),
  
  // Client Context
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  
  // Compliance Markers
  isRegulatorAuditable: boolean("is_regulator_auditable").default(true),
  complianceNote: text("compliance_note"),
  
  // Timestamps
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_ai_audit_proposal").on(table.proposalId),
  index("idx_ai_audit_actor").on(table.actorId),
  index("idx_ai_audit_action").on(table.action),
  index("idx_ai_audit_timestamp").on(table.timestamp),
  index("idx_ai_audit_category").on(table.actionCategory),
]);

// Client Risk Profiles - Enhanced risk profile for AI recommendations


// Proposal Notes - Agent editable commentary (ALLOWED modifications)
export const proposalNotes = pgTable("proposal_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Relationships
  proposalId: varchar("proposal_id").references(() => investmentProposals.id).notNull(),
  sessionId: varchar("session_id").references(() => advisorySessions.id),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  
  // Note Content
  noteType: varchar("note_type").notNull(), // introduction, explanation, goal_context, market_outlook, disclaimer_addition
  notePosition: varchar("note_position").default("general"), // header, goal_section, product_section, footer
  content: text("content").notNull(),
  
  // Goal Association (if applicable)
  goalId: varchar("goal_id"),
  goalPriority: integer("goal_priority"), // Agent can reorder goal priorities
  
  // Version Control
  version: integer("version").default(1),
  previousVersionId: varchar("previous_version_id"),
  
  // Moderation
  isApproved: boolean("is_approved").default(true), // For compliance review if needed
  approvedBy: varchar("approved_by"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_proposal_notes_proposal").on(table.proposalId),
  index("idx_proposal_notes_agent").on(table.agentId),
]);

// Proposal Shares - Track proposal sharing and client interactions
export const proposalShares = pgTable("proposal_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Relationships
  proposalId: varchar("proposal_id").references(() => investmentProposals.id).notNull(),
  sessionId: varchar("session_id").references(() => advisorySessions.id),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  // Share Details
  shareMethod: varchar("share_method").notNull(), // secure_link, pdf, email, whatsapp
  shareToken: varchar("share_token").unique(), // Secure view-only token
  shareTokenExpiresAt: timestamp("share_token_expires_at"),
  shareUrl: text("share_url"),
  
  // PDF/Document Details
  documentPath: text("document_path"),
  documentHash: varchar("document_hash"),
  
  // Document source (uploaded vs generated)
  documentSource: varchar("document_source").default("generated"), // generated, uploaded
  originalFileFormat: varchar("original_file_format"), // pdf, docx
  uploadedByUserId: varchar("uploaded_by_user_id"),
  uploadedAt: timestamp("uploaded_at"), // For integrity verification
  
  // Client Interaction Tracking
  viewCount: integer("view_count").default(0),
  firstViewedAt: timestamp("first_viewed_at"),
  lastViewedAt: timestamp("last_viewed_at"),
  
  // Client Response
  clientAction: varchar("client_action"), // viewed, approved, rejected, clarification_requested
  clientActionTimestamp: timestamp("client_action_timestamp"),
  clientComment: text("client_comment"),
  clientSignature: text("client_signature"), // Digital signature or acknowledgment
  
  // Email/Communication Tracking
  emailSentAt: timestamp("email_sent_at"),
  emailDeliveredAt: timestamp("email_delivered_at"),
  emailOpenedAt: timestamp("email_opened_at"),
  
  // Compliance
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_proposal_shares_proposal").on(table.proposalId),
  index("idx_proposal_shares_client").on(table.clientId),
  index("idx_proposal_shares_token").on(table.shareToken),
]);

// Portfolio Uploads - Track portfolio ingestion with client confirmation
export const portfolioUploads = pgTable("portfolio_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Relationships
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id), // Target portfolio after confirmation
  
  // Upload Details
  uploadType: varchar("upload_type").notNull(), // pdf, excel, csv, api_sync
  fileName: varchar("file_name"),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  fileHash: varchar("file_hash"),
  
  // Parsing Status
  parsingStatus: varchar("parsing_status").default("pending"), // pending, processing, parsed, failed
  parsingError: text("parsing_error"),
  parsedAt: timestamp("parsed_at"),
  
  // Parsed Data (temporary storage before confirmation)
  parsedHoldings: jsonb("parsed_holdings"), // Array of parsed holdings
  parsedSummary: jsonb("parsed_summary"), // { totalValue, holdingsCount, assetBreakdown }
  parsingConfidence: integer("parsing_confidence"), // 0-100 confidence score
  
  // Client Confirmation (MANDATORY before analysis)
  confirmationRequired: boolean("confirmation_required").default(true),
  confirmationStatus: varchar("confirmation_status").default("pending"), // pending, confirmed, rejected, expired
  confirmationMethod: varchar("confirmation_method"), // otp, email, in_app
  confirmationOtp: varchar("confirmation_otp"),
  confirmationOtpExpiresAt: timestamp("confirmation_otp_expires_at"),
  confirmedAt: timestamp("confirmed_at"),
  confirmedByClientId: varchar("confirmed_by_client_id"),
  
  // Post-Confirmation Processing
  mergedToPortfolioAt: timestamp("merged_to_portfolio_at"),
  analysisTriggeredAt: timestamp("analysis_triggered_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Auto-expire unconfirmed uploads
}, (table) => [
  index("idx_portfolio_uploads_agent").on(table.agentId),
  index("idx_portfolio_uploads_client").on(table.clientId),
  index("idx_portfolio_uploads_status").on(table.confirmationStatus),
]);

// PDF Profiles - Store document fingerprints and format patterns for learning
export const pdfProfiles = pgTable("pdf_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Document Identification
  fingerprint: varchar("fingerprint", { length: 64 }).notNull().unique(), // SHA-256 hash of normalized text
  fileHash: varchar("file_hash", { length: 64 }), // SHA-256 hash of original file
  
  // Document Type Classification
  pdfType: varchar("pdf_type").notNull(), // cas_cams, cas_kfintech, broker_zerodha, etc.
  layoutType: varchar("layout_type").notNull(), // tabular, semi_structured, narrative, mixed
  
  // Document Metrics
  pageCount: integer("page_count").default(1),
  textDensity: integer("text_density"), // Characters per page
  hasTableStructure: boolean("has_table_structure").default(false),
  
  // Format Detection Results
  registrars: jsonb("registrars").$type<string[]>().default([]), // ['CAMS', 'KFINTECH']
  headerPatterns: jsonb("header_patterns").$type<string[]>().default([]), // Detected header rows
  columnOrder: jsonb("column_order").$type<string[]>().default([]), // ['cost', 'units', 'nav', 'market']
  
  // Parsing Strategy
  parsingStrategy: varchar("parsing_strategy"), // header_detection, combination_search, ai_fallback
  successfulPatterns: jsonb("successful_patterns"), // Patterns that worked for this format
  
  // Confidence and Quality
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 4 }), // 0.0000 to 1.0000
  parsingSuccessRate: decimal("parsing_success_rate", { precision: 5, scale: 4 }), // Historical success rate
  timesUsed: integer("times_used").default(0),
  timesSucceeded: integer("times_succeeded").default(0),
  timesFailed: integer("times_failed").default(0),
  
  // Version and Metadata
  parserVersion: varchar("parser_version").default("v2"),
  detectedAt: timestamp("detected_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_pdf_profiles_fingerprint").on(table.fingerprint),
  index("idx_pdf_profiles_type").on(table.pdfType),
  index("idx_pdf_profiles_layout").on(table.layoutType),
]);

// PDF Parsing Audit Trail - Track every parsing attempt for compliance and debugging
export const pdfParsingAuditTrail = pgTable("pdf_parsing_audit_trail", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Document Reference
  profileId: varchar("profile_id").references(() => pdfProfiles.id),
  uploadId: varchar("upload_id").references(() => portfolioUploads.id),
  
  // User Context
  userId: varchar("user_id").references(() => users.id),
  agentId: varchar("agent_id").references(() => users.id),
  
  // Input Details
  fileName: varchar("file_name"),
  fileSize: integer("file_size"),
  fingerprint: varchar("fingerprint", { length: 64 }),
  
  // Parsing Execution
  parserVersion: varchar("parser_version").notNull(), // v1, v2
  parsingStrategy: varchar("parsing_strategy"), // header_detection, combination_search, etc.
  parseTimeMs: integer("parse_time_ms"),
  
  // Results
  success: boolean("success").default(false),
  holdingsExtracted: integer("holdings_extracted").default(0),
  transactionsExtracted: integer("transactions_extracted").default(0),
  totalValueExtracted: decimal("total_value_extracted", { precision: 15, scale: 2 }),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 4 }),
  
  // Validation Results
  validationsPassed: integer("validations_passed").default(0),
  validationsFailed: integer("validations_failed").default(0),
  validationErrors: jsonb("validation_errors").$type<string[]>(),
  
  // Dual-Run Comparison (when enabled)
  dualRunEnabled: boolean("dual_run_enabled").default(false),
  v1HoldingsCount: integer("v1_holdings_count"),
  v2HoldingsCount: integer("v2_holdings_count"),
  matchPercentage: decimal("match_percentage", { precision: 5, scale: 2 }),
  preferredVersion: varchar("preferred_version"),
  comparisonDiscrepancies: jsonb("comparison_discrepancies"),
  
  // Errors and Warnings
  errors: jsonb("errors").$type<string[]>(),
  warnings: jsonb("warnings").$type<string[]>(),
  
  // Enrichment Flags
  requiresEnrichment: boolean("requires_enrichment").default(false),
  unresolvedItems: jsonb("unresolved_items"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_pdf_parsing_audit_profile").on(table.profileId),
  index("idx_pdf_parsing_audit_user").on(table.userId),
  index("idx_pdf_parsing_audit_success").on(table.success),
  index("idx_pdf_parsing_audit_version").on(table.parserVersion),
]);

// Holding Lots v2 - Individual purchase lots for capital gains calculation
export const holdingLotsV2 = pgTable("holding_lots_v2", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Relationships
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  holdingId: varchar("holding_id").references(() => portfolioHoldings.id),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Security Identification
  isin: varchar("isin", { length: 12 }).notNull(),
  folioNumber: varchar("folio_number"),
  schemeName: text("scheme_name"),
  amcCode: varchar("amc_code"),
  
  // Lot Details
  purchaseDate: date("purchase_date").notNull(),
  purchaseDateSource: varchar("purchase_date_source"), // cas_explicit, derived_from_sip, manual, unknown
  purchaseDateConfidence: decimal("purchase_date_confidence", { precision: 5, scale: 4 }),
  
  // Transaction Reference
  transactionType: varchar("transaction_type").notNull(), // purchase, sip, switch_in, bonus, dividend_reinvest
  transactionId: varchar("transaction_id"), // Reference to original transaction
  
  // Quantity and Cost
  units: decimal("units", { precision: 15, scale: 6 }).notNull(),
  costPerUnit: decimal("cost_per_unit", { precision: 15, scale: 4 }).notNull(),
  totalCost: decimal("total_cost", { precision: 15, scale: 2 }).notNull(),
  stampDuty: decimal("stamp_duty", { precision: 10, scale: 2 }).default("0"),
  purchaseNav: decimal("purchase_nav", { precision: 15, scale: 4 }), // NAV at time of purchase
  balanceAfterTransaction: decimal("balance_after_transaction", { precision: 15, scale: 6 }), // Running balance after this lot
  transactionDescription: text("transaction_description"), // Full description e.g., "SIP Instalment No - 1"
  exitLoadText: text("exit_load_text"), // Exit load rules from CAS
  advisorArn: varchar("advisor_arn"), // ARN code of distributor
  
  // Current Valuation (updated periodically)
  currentNav: decimal("current_nav", { precision: 15, scale: 4 }),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  unrealizedGain: decimal("unrealized_gain", { precision: 15, scale: 2 }),
  unrealizedGainPercent: decimal("unrealized_gain_percent", { precision: 8, scale: 4 }),
  
  // Capital Gains Classification
  holdingPeriod: integer("holding_period"), // Days since purchase
  capitalGainsType: varchar("capital_gains_type"), // stcg, ltcg (based on holding period)
  taxRateApplicable: decimal("tax_rate_applicable", { precision: 5, scale: 2 }),
  
  // Source Tracking
  sourcePdfId: varchar("source_pdf_id").references(() => pdfProfiles.id),
  sourcePageNumber: integer("source_page_number"),
  parsingConfidence: decimal("parsing_confidence", { precision: 5, scale: 4 }),
  
  // Lot Status
  status: varchar("status").default("active"), // active, partially_sold, fully_sold, blocked
  remainingUnits: decimal("remaining_units", { precision: 15, scale: 6 }),
  
  // Immutability
  isLocked: boolean("is_locked").default(false), // Lock after tax filing
  lockedAt: timestamp("locked_at"),
  lockedReason: varchar("locked_reason"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_holding_lots_v2_portfolio").on(table.portfolioId),
  index("idx_holding_lots_v2_user").on(table.userId),
  index("idx_holding_lots_v2_isin").on(table.isin),
  index("idx_holding_lots_v2_purchase_date").on(table.purchaseDate),
  index("idx_holding_lots_v2_status").on(table.status),
]);


// Agent Compliance Audit Logs - Comprehensive immutable audit trail (8-year retention)
// InsertAdvisorySession is already exported from shared/schema/advisory.ts




// Insert schemas and types for AI Investment Advisory

export const portfolioReportTemplates = pgTable("portfolio_report_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  createdByUserId: varchar("created_by_user_id").references(() => users.id).notNull(),
  configJson: jsonb("config_json").notNull(),
  isDefault: boolean("is_default").default(false),
  isPublic: boolean("is_public").default(false),
  category: varchar("category").default("general"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_portfolio_report_templates_user").on(table.createdByUserId),
  index("idx_portfolio_report_templates_default").on(table.isDefault),
]);

// Portfolio Generated Reports - Actual reports produced
export const portfolioGeneratedReports = pgTable("portfolio_generated_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  templateId: varchar("template_id").references(() => portfolioReportTemplates.id),
  reportName: text("report_name").notNull(),
  configSnapshot: jsonb("config_snapshot").notNull(),
  validationResults: jsonb("validation_results"),
  fileUrl: text("file_url"),
  fileType: varchar("file_type").default("pdf"),
  fileSize: integer("file_size"),
  status: varchar("status").default("pending"),
  hashChecksum: varchar("hash_checksum"),
  errorMessage: text("error_message"),
  generatedByUserId: varchar("generated_by_user_id").references(() => users.id).notNull(),
  proposalId: varchar("proposal_id"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_portfolio_gen_reports_client").on(table.clientId),
  index("idx_portfolio_gen_reports_portfolio").on(table.portfolioId),
  index("idx_portfolio_gen_reports_user").on(table.generatedByUserId),
  index("idx_portfolio_gen_reports_status").on(table.status),
]);

// Portfolio Report Audit Logs - Compliance tracking
export const portfolioReportAuditLogs = pgTable("portfolio_report_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => portfolioGeneratedReports.id).notNull(),
  action: varchar("action").notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_portfolio_report_audit_report").on(table.reportId),
  index("idx_portfolio_report_audit_user").on(table.userId),
  index("idx_portfolio_report_audit_action").on(table.action),
]);

// Insert Schemas and Types for Portfolio Report Templates
export const insertPortfolioReportTemplateSchema = createInsertSchema(portfolioReportTemplates).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPortfolioDiagnostics = z.infer<typeof insertPortfolioDiagnosticsSchema>;


// Note: watchlists, comprehensiveHoldings, insertWatchlistSchema, and their associated
// types (Watchlist, InsertWatchlist, ComprehensiveHolding, InsertComprehensiveHolding)
// are declared at the top of this file (lines ~81 and ~143). The duplicate declarations
// below were removed to fix "Cannot redeclare block-scoped variable" errors.

export const insertComprehensiveHoldingSchema = createInsertSchema(comprehensiveHoldings).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});


export const portfolioMetricsDaily = pgTable("portfolio_metrics_daily", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Portfolio Reference
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Snapshot Date
  metricsDate: date("metrics_date").notNull(),
  
  // Portfolio Value
  totalValue: numeric("total_value", { precision: 18, scale: 2 }),
  totalCost: numeric("total_cost", { precision: 18, scale: 2 }),
  unrealizedGainLoss: numeric("unrealized_gain_loss", { precision: 18, scale: 2 }),
  dayChange: numeric("day_change", { precision: 18, scale: 2 }),
  dayChangePercent: numeric("day_change_percent", { precision: 8, scale: 4 }),
  
  // Returns (XIRR/CAGR pre-calculated)
  return1D: numeric("return_1d", { precision: 8, scale: 4 }),
  return1W: numeric("return_1w", { precision: 8, scale: 4 }),
  return1M: numeric("return_1m", { precision: 8, scale: 4 }),
  return3M: numeric("return_3m", { precision: 8, scale: 4 }),
  return6M: numeric("return_6m", { precision: 8, scale: 4 }),
  return1Y: numeric("return_1y", { precision: 8, scale: 4 }),
  returnSI: numeric("return_si", { precision: 8, scale: 4 }),
  xirr: numeric("xirr", { precision: 8, scale: 4 }),
  cagr: numeric("cagr", { precision: 8, scale: 4 }),
  
  // Asset Allocation (pre-computed)
  allocationEquity: numeric("allocation_equity", { precision: 6, scale: 4 }),
  allocationDebt: numeric("allocation_debt", { precision: 6, scale: 4 }),
  allocationGold: numeric("allocation_gold", { precision: 6, scale: 4 }),
  allocationCash: numeric("allocation_cash", { precision: 6, scale: 4 }),
  allocationAlternatives: numeric("allocation_alternatives", { precision: 6, scale: 4 }),
  allocationInternational: numeric("allocation_international", { precision: 6, scale: 4 }),
  
  // Risk Metrics (pre-computed)
  portfolioVolatility: numeric("portfolio_volatility", { precision: 8, scale: 4 }),
  portfolioBeta: numeric("portfolio_beta", { precision: 8, scale: 4 }),
  portfolioSharpe: numeric("portfolio_sharpe", { precision: 8, scale: 4 }),
  maxDrawdown: numeric("max_drawdown", { precision: 8, scale: 4 }),
  riskScore: integer("risk_score"), // 1-10
  
  // Concentration Metrics
  top5Concentration: numeric("top_5_concentration", { precision: 6, scale: 4 }),
  sectorConcentration: jsonb("sector_concentration"), // { sector: percentage }
  
  // Drift from Target
  driftFromTarget: numeric("drift_from_target", { precision: 6, scale: 4 }),
  needsRebalancing: boolean("needs_rebalancing").default(false),
  
  // Holdings Count
  totalHoldings: integer("total_holdings"),
  equityHoldings: integer("equity_holdings"),
  debtHoldings: integer("debt_holdings"),
  mfHoldings: integer("mf_holdings"),
  
  // Computation Metadata
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  computationTimeMs: integer("computation_time_ms"),
}, (table) => [
  index("idx_pmd_user").on(table.userId),
  index("idx_pmd_portfolio").on(table.portfolioId),
  index("idx_pmd_date").on(table.metricsDate),
  uniqueIndex("idx_pmd_user_portfolio_date_unique").on(table.userId, table.portfolioId, table.metricsDate),
  index("idx_pmd_needs_rebal").on(table.needsRebalancing),
]);

export const insertPortfolioMetricsDailySchema = createInsertSchema(portfolioMetricsDaily).extend({
  id: z.any(),
  computedAt: z.any(),
}).omit({ id: true, computedAt: true });

export type PortfolioMetricsDaily = typeof portfolioMetricsDaily.$inferSelect;

export type InsertPortfolioMetricsDaily = z.infer<typeof insertPortfolioMetricsDailySchema>;

export const portfolioMetricsCache = pgTable("portfolio_metrics_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  identifier: varchar("identifier", { length: 50 }).notNull(),
  identifierType: varchar("identifier_type", { length: 20 }).notNull(),
  
  // Time period for metrics
  periodYears: integer("period_years").notNull(), // 1, 3, 5, 10
  periodEndDate: date("period_end_date").notNull(),
  
  // Calculated metrics
  cagr: numeric("cagr"),
  volatility: numeric("volatility"),
  maxDrawdown: numeric("max_drawdown"),
  sharpeRatio: numeric("sharpe_ratio"),
  sortinoRatio: numeric("sortino_ratio"),
  beta: numeric("beta"),
  alpha: numeric("alpha"),
  
  // Supporting data
  totalDataPoints: integer("total_data_points"),
  dataStartDate: date("data_start_date"),
  dataEndDate: date("data_end_date"),
  
  // Cache validity
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_portfolio_metrics_lookup").on(table.identifier, table.identifierType, table.periodYears),
  index("idx_portfolio_metrics_expiry").on(table.expiresAt),
]);

export const insertPortfolioMetricsCacheSchema = createInsertSchema(portfolioMetricsCache).extend({
  id: z.any(),
  createdAt: z.any(),
  calculatedAt: z.any(),
}).omit({ id: true, createdAt: true, calculatedAt: true });

export type PortfolioMetricsCache = typeof portfolioMetricsCache.$inferSelect;

export type InsertPortfolioMetricsCache = z.infer<typeof insertPortfolioMetricsCacheSchema>;


export const insertPortfolioPredictionSchema = createInsertSchema(portfolioPredictions).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshots).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPortfolioDiagnosticsSchema = createInsertSchema(portfolioDiagnostics).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

// PPF Holdings table for tracking Public Provident Fund data
export const ppfHoldings = pgTable("ppf_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  ppfAccountNumber: varchar("ppf_account_number").notNull(),
  bankName: text("bank_name").notNull(),
  branchName: text("branch_name"),
  accountHolderName: text("account_holder_name").notNull(),
  // PPF Balance Information
  totalBalance: decimal("total_balance", { precision: 15, scale: 2 }),
  currentFinancialYearContribution: decimal("current_fy_contribution", { precision: 15, scale: 2 }),
  totalContribution: decimal("total_contribution", { precision: 15, scale: 2 }),
  totalInterestEarned: decimal("total_interest_earned", { precision: 15, scale: 2 }),
  currentInterestRate: decimal("current_interest_rate", { precision: 5, scale: 2 }), // Annual interest rate
  maturityAmount: decimal("maturity_amount", { precision: 15, scale: 2 }),
  // Account Timeline
  accountOpenDate: date("account_open_date").notNull(),
  maturityDate: date("maturity_date").notNull(),
  lastContributionDate: date("last_contribution_date"),
  nextContributionDueDate: date("next_contribution_due_date"),
  // PPF Rules and Status
  yearsCompleted: integer("years_completed").default(0),
  minContributionMet: boolean("min_contribution_met").default(false), // ₹500 minimum
  maxContributionAllowed: decimal("max_contribution_allowed", { precision: 15, scale: 2 }).default("150000"), // ₹1.5L limit
  contributionRemaining: decimal("contribution_remaining", { precision: 15, scale: 2 }),
  // Loan and Withdrawal Information
  loanAvailable: boolean("loan_available").default(false), // Available from 3rd year
  maxLoanAmount: decimal("max_loan_amount", { precision: 15, scale: 2 }),
  partialWithdrawalAvailable: boolean("partial_withdrawal_available").default(false), // From 7th year
  maxWithdrawalAmount: decimal("max_withdrawal_amount", { precision: 15, scale: 2 }),
  // Nominee Information
  nomineeName: text("nominee_name"),
  nomineeRelationship: varchar("nominee_relationship"),
  nomineeAge: integer("nominee_age"),
  // Account Status
  isActive: boolean("is_active").default(true),
  canExtend: boolean("can_extend").default(false), // After 15 years
  hasExtended: boolean("has_extended").default(false),
  extensionPeriod: integer("extension_period"), // 5-year blocks
  // Tracking
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// EPS (Employee Pension Scheme) Holdings Schema
export const epsHoldings = pgTable("eps_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  epfAccountNumber: varchar("epf_account_number").notNull(), // Linked to EPF account
  pensionAccountNumber: varchar("pension_account_number").notNull(),
  employerCode: varchar("employer_code").notNull(),
  currentEmployer: text("current_employer").notNull(),
  serviceStartDate: date("service_start_date").notNull(),
  totalServiceYears: integer("total_service_years").notNull().default(0),
  totalServiceMonths: integer("total_service_months").notNull().default(0),
  currentSalary: decimal("current_salary", { precision: 15, scale: 2 }).notNull().default("0"),
  pensionableWage: decimal("pensionable_wage", { precision: 15, scale: 2 }).notNull().default("0"), // Max 15,000 per month
  contributionRate: decimal("contribution_rate", { precision: 5, scale: 2 }).notNull().default("8.33"), // 8.33% of pensionable wage
  monthlyPensionContribution: decimal("monthly_pension_contribution", { precision: 15, scale: 2 }).notNull().default("0"),
  totalContribution: decimal("total_contribution", { precision: 15, scale: 2 }).notNull().default("0"),
  accumulatedPension: decimal("accumulated_pension", { precision: 15, scale: 2 }).notNull().default("0"),
  estimatedMonthlyPension: decimal("estimated_monthly_pension", { precision: 15, scale: 2 }).notNull().default("0"), // At 58 years
  minVestingPeriod: integer("min_vesting_period").notNull().default(10), // 10 years minimum
  isVested: boolean("is_vested").notNull().default(false),
  eligibleForPension: boolean("eligible_for_pension").notNull().default(false), // Age 58 minimum
  expectedRetirementDate: date("expected_retirement_date"), // Age 58-60
  schemeType: varchar("scheme_type").notNull().default("eps95"), // EPS-95 scheme
  certificateNumber: varchar("certificate_number"), // Pension Payment Order (PPO)
  nomineeName: text("nominee_name"),
  nomineeRelationship: varchar("nominee_relationship"),
  nomineeShare: decimal("nominee_share", { precision: 5, scale: 2 }).notNull().default("100"), // Percentage
  status: varchar("status").notNull().default("active"), // active, suspended, pension_started, withdrawn
  lastPensionCalculationDate: date("last_pension_calculation_date"),
  remarks: text("remarks"),
  // APY (Atal Pension Yojana) Integration
  apyEnrolled: boolean("apy_enrolled").notNull().default(false),
  apyAccountNumber: varchar("apy_account_number"),
  apyPensionAmount: decimal("apy_pension_amount", { precision: 15, scale: 2 }), // 1000, 2000, 3000, 4000, 5000
  apyMonthlyContribution: decimal("apy_monthly_contribution", { precision: 15, scale: 2 }),
  apyStartDate: date("apy_start_date"),
  apyMaturityAge: integer("apy_maturity_age").default(60), // 60 years
  apyCurrentAge: integer("apy_current_age"),
  apyTotalContribution: decimal("apy_total_contribution", { precision: 15, scale: 2 }).default("0"),
  apyGovernmentContribution: decimal("apy_government_contribution", { precision: 15, scale: 2 }).default("0"), // Co-contribution for eligible income groups
  apyStatus: varchar("apy_status").default("active"), // active, matured, discontinued
  apyBankName: text("apy_bank_name"),
  apyBranchCode: varchar("apy_branch_code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// NPS (National Pension System) Holdings table
export const npsAccounts = pgTable("nps_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  pran: varchar("pran").notNull().unique(), // Permanent Retirement Account Number (12 digits)
  accountHolderName: text("account_holder_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  registrationDate: date("registration_date").notNull(),
  
  // Tier I Details (Mandatory retirement account - Cannot withdraw before 60)
  tierIBalance: decimal("tier_i_balance", { precision: 15, scale: 2 }).default("0"),
  tierIContributions: decimal("tier_i_contributions", { precision: 15, scale: 2 }).default("0"),
  tierIReturns: decimal("tier_i_returns", { precision: 15, scale: 2 }).default("0"),
  tierIAssetAllocation: jsonb("tier_i_asset_allocation"), // {equityPercent, corporateBondPercent, governmentBondPercent, alternativePercent}
  
  // Tier II Details (Voluntary savings - Can withdraw anytime)
  tierIIBalance: decimal("tier_ii_balance", { precision: 15, scale: 2 }).default("0"),
  tierIIContributions: decimal("tier_ii_contributions", { precision: 15, scale: 2 }).default("0"),
  tierIIReturns: decimal("tier_ii_returns", { precision: 15, scale: 2 }).default("0"),
  tierIIAssetAllocation: jsonb("tier_ii_asset_allocation"), // Same structure, null if Tier II not active
  
  // Total across both tiers
  totalBalance: decimal("total_balance", { precision: 15, scale: 2 }).default("0"),
  totalContributions: decimal("total_contributions", { precision: 15, scale: 2 }).default("0"),
  totalReturns: decimal("total_returns", { precision: 15, scale: 2 }).default("0"),
  returnsPercentage: decimal("returns_percentage", { precision: 8, scale: 2 }).default("0"),
  
  // Account Details
  fundManager: text("fund_manager"), // HDFC, SBI, ICICI, LIC, UTI, Kotak, Birla, etc.
  scheme: text("scheme"), // Active Choice (E%, C%, G%) or Auto Choice (LC, LC-50, LC-75)
  tier: varchar("tier").notNull(), // 'Tier I', 'Tier II', 'Both'
  
  // Nominee Information
  nominee: text("nominee"),
  nomineeRelation: varchar("nominee_relation"),
  
  // Status
  status: varchar("status").notNull().default("active"), // active, frozen, closed
  lastContributionDate: date("last_contribution_date"),
  
  // Tracking
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// APY (Atal Pension Yojana) Accounts table
export const apyAccounts = pgTable("apy_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  pran: varchar("pran").notNull().unique(), // PRAN number (12 digits) - same format as NPS
  accountHolderName: text("account_holder_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  enrollmentDate: date("enrollment_date").notNull(),
  
  // Pension Details
  pensionAmount: decimal("pension_amount", { precision: 15, scale: 2 }).notNull(), // Guaranteed monthly pension: ₹1000, ₹2000, ₹3000, ₹4000, or ₹5000
  monthlyContribution: decimal("monthly_contribution", { precision: 15, scale: 2 }).notNull(), // Calculated based on age and pension choice
  
  // Contribution Tracking
  totalContribution: decimal("total_contribution", { precision: 15, scale: 2 }).default("0"), // User's total contributions
  governmentContribution: decimal("government_contribution", { precision: 15, scale: 2 }).default("0"), // Govt co-contribution for eligible users (50% of contribution or ₹1000/year, whichever is lower)
  totalBalance: decimal("total_balance", { precision: 15, scale: 2 }).default("0"), // Current accumulated balance
  
  // Account Details
  enrollmentAge: integer("enrollment_age").notNull(), // Age at enrollment (18-40 years)
  maturityAge: integer("maturity_age").notNull().default(60), // Fixed at 60 years
  yearsToMaturity: integer("years_to_maturity"), // Calculated: 60 - current age
  expectedMaturityDate: date("expected_maturity_date"),
  
  // Bank Account Details (APY is bank-account linked)
  bankName: text("bank_name").notNull(),
  bankAccountNumber: varchar("bank_account_number").notNull(),
  ifscCode: varchar("ifsc_code").notNull(),
  branchName: text("branch_name"),
  
  // Nominee Information
  nominee: text("nominee"),
  nomineeRelation: varchar("nominee_relation"),
  nomineeAge: integer("nominee_age"),
  
  // Status & Tracking
  status: varchar("status").notNull().default("active"), // active, matured, discontinued, exited
  lastContributionDate: date("last_contribution_date"),
  exitDate: date("exit_date"), // If user exits before maturity
  exitReason: text("exit_reason"), // Reason for discontinuation
  
  // Tracking
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// PPF Holdings types
export type PpfHolding = typeof ppfHoldings.$inferSelect;
export type InsertPpfHolding = typeof ppfHoldings.$inferInsert;

export const insertPpfHoldingSchema = createInsertSchema(ppfHoldings).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
  lastUpdated: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUpdated: true,
});

// EPS Holdings types
export type EpsHolding = typeof epsHoldings.$inferSelect;
export type InsertEpsHolding = typeof epsHoldings.$inferInsert;

export const insertEpsHoldingSchema = createInsertSchema(epsHoldings).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
  lastUpdated: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUpdated: true,
});

// NPS Accounts types
export type NpsAccount = typeof npsAccounts.$inferSelect;
export type InsertNpsAccount = typeof npsAccounts.$inferInsert;

export const insertNpsAccountSchema = createInsertSchema(npsAccounts).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
  lastUpdated: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUpdated: true,
});

// APY Accounts types
export type ApyAccount = typeof apyAccounts.$inferSelect;
export type InsertApyAccount = typeof apyAccounts.$inferInsert;

export const insertApyAccountSchema = createInsertSchema(apyAccounts).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
  lastUpdated: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUpdated: true,
});
