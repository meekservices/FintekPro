import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean, index, integer, date, decimal, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./auth";

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

export const marketData = pgTable("market_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  price: decimal("price", { precision: 15, scale: 4 }),
  change: decimal("change", { precision: 15, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 8, scale: 4 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 0 }),
  currency: varchar("currency").default("INR"), // Multi-currency support
  data: jsonb("data"), // Additional market data from external sources
  lastUpdated: timestamp("last_updated").defaultNow(),
});

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

// ── Credit Ratings Layer — full history of rating changes per ISIN ───────────
export const creditRatings = pgTable("credit_ratings", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  instrumentName: text("instrument_name"),
  rating: varchar("rating", { length: 20 }).notNull(), // AAA, AA+, AA, AA-, A+, A, A-, BBB+, ...
  ratingOutlook: varchar("rating_outlook", { length: 30 }), // Stable, Positive, Negative, Watch Positive, Watch Negative
  agency: varchar("agency", { length: 30 }).notNull(), // CRISIL, ICRA, CARE, INDIA_RATINGS, BRICKWORK, ACUITE
  ratingDate: date("rating_date").notNull(),
  previousRating: varchar("previous_rating", { length: 20 }),
  ratingAction: varchar("rating_action", { length: 40 }), // Assigned, Affirmed, Upgraded, Downgraded, Watch, Withdrawn
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
