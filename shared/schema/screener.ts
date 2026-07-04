import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal, date, serial, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { reits, insertReitSchema } from './reit-invit';


// --- Auto-Migrated Tables ---
export const screenerStocks = pgTable("screener_stocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull().unique(),
  companyName: text("company_name").notNull(),
  exchange: varchar("exchange").default("NSE"),
  isin: varchar("isin"),
  sector: varchar("sector"),
  industry: varchar("industry"),
  marketCapCategory: varchar("market_cap_category"),
  country: varchar("country").default("IN"),
  currency: varchar("currency").default("INR"),
  isActive: boolean("is_active").default(true),
  currentPrice: decimal("current_price", { precision: 15, scale: 2 }),
  marketCapValue: decimal("market_cap_value", { precision: 20, scale: 2 }),
  fmpSymbol: varchar("fmp_symbol"),
  lastFmpSync: timestamp("last_fmp_sync"),
  dataSource: varchar("data_source").default("fmp"),
  // ── Per-table enrichment freshness (Phase 2f) ────────────────────────────
  lastFinancialsSync: timestamp("last_financials_sync"),
  lastTechnicalsSync: timestamp("last_technicals_sync"),
  lastShareholdingSync: timestamp("last_shareholding_sync"),
  lastKeyMetricsSync: timestamp("last_key_metrics_sync"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_screener_stocks_symbol").on(table.symbol),
  index("idx_screener_stocks_sector").on(table.sector),
  index("idx_screener_stocks_market_cap").on(table.marketCapCategory),
  index("idx_screener_stocks_active").on(table.isActive),
]);

export const screenerFinancials = pgTable("screener_financials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  period: varchar("period").notNull().default("annual"),
  fiscalYear: integer("fiscal_year"),
  fiscalDate: varchar("fiscal_date"),
  peRatio: decimal("pe_ratio", { precision: 10, scale: 2 }),
  forwardPe: decimal("forward_pe", { precision: 10, scale: 2 }),    // forward P/E from analyst estimates
  pegRatio: decimal("peg_ratio", { precision: 10, scale: 4 }),      // PEG = PE / EPS growth
  pbRatio: decimal("pb_ratio", { precision: 10, scale: 2 }),
  evToEbitda: decimal("ev_to_ebitda", { precision: 10, scale: 2 }),
  priceToSales: decimal("price_to_sales", { precision: 10, scale: 2 }),
  roe: decimal("roe", { precision: 10, scale: 4 }),
  roce: decimal("roce", { precision: 10, scale: 4 }),
  roa: decimal("roa", { precision: 10, scale: 4 }),
  netProfitMargin: decimal("net_profit_margin", { precision: 10, scale: 4 }),
  operatingMargin: decimal("operating_margin", { precision: 10, scale: 4 }),
  grossMargin: decimal("gross_margin", { precision: 10, scale: 4 }),
  debtToEquity: decimal("debt_to_equity", { precision: 10, scale: 4 }),
  currentRatio: decimal("current_ratio", { precision: 10, scale: 4 }),
  quickRatio: decimal("quick_ratio", { precision: 10, scale: 4 }),
  interestCoverage: decimal("interest_coverage", { precision: 10, scale: 2 }),
  eps: decimal("eps", { precision: 15, scale: 2 }),
  bookValue: decimal("book_value", { precision: 15, scale: 2 }),
  dividendYield: decimal("dividend_yield", { precision: 8, scale: 4 }),
  dividendPayout: decimal("dividend_payout", { precision: 8, scale: 4 }),
  revenueGrowth: decimal("revenue_growth", { precision: 10, scale: 4 }),
  earningsGrowth: decimal("earnings_growth", { precision: 10, scale: 4 }),
  freeCashFlowPerShare: decimal("free_cash_flow_per_share", { precision: 15, scale: 2 }),
  revenue: decimal("revenue", { precision: 20, scale: 2 }),
  netIncome: decimal("net_income", { precision: 20, scale: 2 }),
  totalDebt: decimal("total_debt", { precision: 20, scale: 2 }),
  totalEquity: decimal("total_equity", { precision: 20, scale: 2 }),
  totalAssets: decimal("total_assets", { precision: 20, scale: 2 }),
  operatingCashFlow: decimal("operating_cash_flow", { precision: 20, scale: 2 }),
  freeCashFlow: decimal("free_cash_flow", { precision: 20, scale: 2 }),
  capitalExpenditure: decimal("capital_expenditure", { precision: 20, scale: 2 }),
  // NOTE: return1y–5y removed (Phase 2b) — static values, never reliable.
  // All returns live in screener_derived_metrics, computed from OHLCV nightly.
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_fin_symbol").on(table.symbol),
  uniqueIndex("uq_screener_fin_symbol_period").on(table.symbol, table.period), // Phase 1
  index("idx_screener_fin_pe").on(table.peRatio),
  index("idx_screener_fin_pe_symbol").on(table.symbol, table.peRatio),        // Phase 3a composite
  index("idx_screener_fin_roe").on(table.roe),
  index("idx_screener_fin_roe_symbol").on(table.symbol, table.roe),           // Phase 3a composite
  index("idx_screener_fin_de").on(table.debtToEquity),
]);

export const screenerPriceHistory = pgTable("screener_price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: date("date").notNull(),       // Migrated from varchar → date (schema-repairs Phase 5)
  open: decimal("open", { precision: 15, scale: 2 }),
  high: decimal("high", { precision: 15, scale: 2 }),
  low: decimal("low", { precision: 15, scale: 2 }),
  close: decimal("close", { precision: 15, scale: 2 }),
  adjClose: decimal("adj_close", { precision: 15, scale: 2 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  changePercent: decimal("change_percent", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_price_symbol").on(table.symbol),
  uniqueIndex("uq_screener_price_hist").on(table.symbol, table.date),          // Phase 1 — prevents duplicate OHLCV rows
]);

export const screenerDerivedMetrics = pgTable("screener_derived_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull().unique(),

  // ── Composite Scores ──────────────────────────────────────────────────────
  growthScore: decimal("growth_score", { precision: 5, scale: 2 }),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }),
  valueScore: decimal("value_score", { precision: 5, scale: 2 }),
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }),
  compositeScore: decimal("composite_score", { precision: 5, scale: 2 }),
  fintekRating: integer("fintek_rating"),
  momentumScore: decimal("momentum_score", { precision: 5, scale: 2 }),
  technicalRating: varchar("technical_rating"),  // Strong Buy | Buy | Neutral | Sell | Strong Sell

  // ── Growth (from financials) ──────────────────────────────────────────────
  revenueGrowth3Y: decimal("revenue_growth_3y", { precision: 10, scale: 4 }),
  earningsGrowth3Y: decimal("earnings_growth_3y", { precision: 10, scale: 4 }),

  // ── Price Returns (computed from screener_price_history OHLCV) ────────────
  // ALL returns are trailing price returns, recalculated nightly — never static
  return1W: decimal("return_1w", { precision: 10, scale: 4 }),   // 5 trading days
  return1M: decimal("return_1m", { precision: 10, scale: 4 }),   // ~21 trading days
  return3M: decimal("return_3m", { precision: 10, scale: 4 }),   // ~63 trading days
  return6M: decimal("return_6m", { precision: 10, scale: 4 }),   // ~126 trading days
  return1Y: decimal("return_1y", { precision: 10, scale: 4 }),   // ~252 trading days
  return2Y: decimal("return_2y", { precision: 10, scale: 4 }),
  return3Y: decimal("return_3y", { precision: 10, scale: 4 }),
  return5Y: decimal("return_5y", { precision: 10, scale: 4 }),
  returnYTD: decimal("return_ytd", { precision: 10, scale: 4 }),  // Jan 1 to today

  // ── Relative Returns (vs benchmark) ──────────────────────────────────────
  returnVsNifty1Y: decimal("return_vs_nifty_1y", { precision: 10, scale: 4 }),   // Alpha vs NIFTY 50
  returnVsSector1Y: decimal("return_vs_sector_1y", { precision: 10, scale: 4 }), // Alpha vs sector index

  // ── Risk Metrics (computed from price history) ────────────────────────────
  beta: decimal("beta", { precision: 8, scale: 4 }),          // vs NIFTY 50, 1Y daily returns
  sharpeRatio1Y: decimal("sharpe_ratio_1y", { precision: 8, scale: 4 }),   // risk-free = 6.5% (RBI repo)
  sortinoRatio1Y: decimal("sortino_ratio_1y", { precision: 8, scale: 4 }),
  maxDrawdown1Y: decimal("max_drawdown_1y", { precision: 8, scale: 4 }),   // peak-to-trough %
  volatility30D: decimal("volatility_30d", { precision: 8, scale: 4 }),    // 30-day annualised σ

  // ── Quality Scores (computed from screener_financials) ────────────────────
  // Piotroski F-Score: 0 (weak) to 9 (strong) — 9 binary signals
  piotroskiScore: integer("piotroski_score"),
  piotroskiDetails: jsonb("piotroski_details"),  // {roa, ocf, roa_change, ...} breakdown

  // Altman Z-Score: < 1.81 distress, 1.81–2.99 grey, > 2.99 safe
  altmanZScore: decimal("altman_z_score", { precision: 8, scale: 4 }),

  // ── Dividends & Price Info ────────────────────────────────────────────────
  dividendPerShare: decimal("dividend_per_share", { precision: 10, scale: 4 }),
  faceValue: decimal("face_value", { precision: 10, scale: 2 }),
  weekHigh52: decimal("week_high_52", { precision: 15, scale: 2 }),
  weekLow52: decimal("week_low_52", { precision: 15, scale: 2 }),

  scoringMetadata: jsonb("scoring_metadata"),
  lastCalculated: timestamp("last_calculated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_derived_symbol").on(table.symbol),
  index("idx_screener_derived_composite").on(table.compositeScore),
  index("idx_screener_derived_rating").on(table.fintekRating),
  index("idx_screener_derived_score_rating").on(table.compositeScore, table.fintekRating), // Phase 3a
  index("idx_screener_derived_return1y").on(table.return1Y),
  index("idx_screener_derived_return1y_score").on(table.return1Y, table.compositeScore),   // Phase 3a
  index("idx_screener_derived_return_beta").on(table.return1Y, table.beta),                // Phase 3a — risk-adjusted: high return + low beta
  index("idx_screener_derived_piotroski").on(table.piotroskiScore),
  index("idx_screener_derived_beta").on(table.beta),
  index("idx_screener_derived_tech_rating").on(table.technicalRating),
]);

export const fmpUsageLog = pgTable("fmp_usage_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: varchar("date").notNull(),
  provider: varchar("provider").notNull().default("fmp"),
  callCount: integer("call_count").notNull().default(0),
  dailyLimit: integer("daily_limit").notNull().default(250),
  lastAlertLevel: varchar("last_alert_level"),
  lastCallAt: timestamp("last_call_at"),
  callDetails: jsonb("call_details"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_fmp_usage_date").on(table.date),
  index("idx_fmp_usage_provider").on(table.provider, table.date),
]);

// ========== FMP EXTENDED DATA TABLES ==========

// Tier 1: Financial Growth Metrics (from /financial-growth endpoint)
export const screenerGrowthMetrics = pgTable("screener_growth_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: varchar("date"),
  period: varchar("period").default("annual"),
  revenueGrowth: decimal("revenue_growth", { precision: 10, scale: 4 }),
  netIncomeGrowth: decimal("net_income_growth", { precision: 10, scale: 4 }),
  epsGrowth: decimal("eps_growth", { precision: 10, scale: 4 }),
  epsDilutedGrowth: decimal("eps_diluted_growth", { precision: 10, scale: 4 }),
  grossProfitGrowth: decimal("gross_profit_growth", { precision: 10, scale: 4 }),
  operatingIncomeGrowth: decimal("operating_income_growth", { precision: 10, scale: 4 }),
  freeCashFlowGrowth: decimal("free_cash_flow_growth", { precision: 10, scale: 4 }),
  assetGrowth: decimal("asset_growth", { precision: 10, scale: 4 }),
  debtGrowth: decimal("debt_growth", { precision: 10, scale: 4 }),
  dividendGrowth: decimal("dividend_growth", { precision: 10, scale: 4 }),
  bookValueGrowth: decimal("book_value_growth", { precision: 10, scale: 4 }),
  rdExpenseGrowth: decimal("rd_expense_growth", { precision: 10, scale: 4 }),
  sgaExpenseGrowth: decimal("sga_expense_growth", { precision: 10, scale: 4 }),
  weightedAvgSharesGrowth: decimal("weighted_avg_shares_growth", { precision: 10, scale: 4 }),
  operatingCashFlowGrowth: decimal("operating_cash_flow_growth", { precision: 10, scale: 4 }),
  receivablesGrowth: decimal("receivables_growth", { precision: 10, scale: 4 }),
  inventoryGrowth: decimal("inventory_growth", { precision: 10, scale: 4 }),
  tenYRevenueGrowthPerShare: decimal("ten_y_revenue_growth_per_share", { precision: 10, scale: 4 }),
  fiveYRevenueGrowthPerShare: decimal("five_y_revenue_growth_per_share", { precision: 10, scale: 4 }),
  threeYRevenueGrowthPerShare: decimal("three_y_revenue_growth_per_share", { precision: 10, scale: 4 }),
  tenYNetIncomeGrowthPerShare: decimal("ten_y_net_income_growth_per_share", { precision: 10, scale: 4 }),
  fiveYNetIncomeGrowthPerShare: decimal("five_y_net_income_growth_per_share", { precision: 10, scale: 4 }),
  threeYNetIncomeGrowthPerShare: decimal("three_y_net_income_growth_per_share", { precision: 10, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_growth_symbol").on(table.symbol),
  uniqueIndex("uq_screener_growth").on(table.symbol, table.date, table.period), // Phase 1
]);

// Tier 1: Key Metrics (from /key-metrics endpoint)
export const screenerKeyMetrics = pgTable("screener_key_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: varchar("date"),
  period: varchar("period").default("annual"),
  revenuePerShare: decimal("revenue_per_share", { precision: 15, scale: 4 }),
  netIncomePerShare: decimal("net_income_per_share", { precision: 15, scale: 4 }),
  operatingCashFlowPerShare: decimal("operating_cash_flow_per_share", { precision: 15, scale: 4 }),
  freeCashFlowPerShare: decimal("free_cash_flow_per_share", { precision: 15, scale: 4 }),
  cashPerShare: decimal("cash_per_share", { precision: 15, scale: 4 }),
  bookValuePerShare: decimal("book_value_per_share", { precision: 15, scale: 4 }),
  tangibleBookValuePerShare: decimal("tangible_book_value_per_share", { precision: 15, scale: 4 }),
  shareholdersEquityPerShare: decimal("shareholders_equity_per_share", { precision: 15, scale: 4 }),
  interestDebtPerShare: decimal("interest_debt_per_share", { precision: 15, scale: 4 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  enterpriseValue: decimal("enterprise_value", { precision: 20, scale: 2 }),
  peRatio: decimal("pe_ratio", { precision: 10, scale: 4 }),
  priceToSalesRatio: decimal("price_to_sales_ratio", { precision: 10, scale: 4 }),
  pocfratio: decimal("pocf_ratio", { precision: 10, scale: 4 }),
  pfcfRatio: decimal("pfcf_ratio", { precision: 10, scale: 4 }),
  pbRatio: decimal("pb_ratio", { precision: 10, scale: 4 }),
  ptbRatio: decimal("ptb_ratio", { precision: 10, scale: 4 }),
  evToSales: decimal("ev_to_sales", { precision: 10, scale: 4 }),
  enterpriseValueOverEbitda: decimal("enterprise_value_over_ebitda", { precision: 10, scale: 4 }),
  evToOperatingCashFlow: decimal("ev_to_operating_cash_flow", { precision: 10, scale: 4 }),
  evToFreeCashFlow: decimal("ev_to_free_cash_flow", { precision: 10, scale: 4 }),
  earningsYield: decimal("earnings_yield", { precision: 10, scale: 4 }),
  freeCashFlowYield: decimal("free_cash_flow_yield", { precision: 10, scale: 4 }),
  debtToEquity: decimal("debt_to_equity", { precision: 10, scale: 4 }),
  debtToAssets: decimal("debt_to_assets", { precision: 10, scale: 4 }),
  netDebtToEbitda: decimal("net_debt_to_ebitda", { precision: 10, scale: 4 }),
  currentRatio: decimal("current_ratio", { precision: 10, scale: 4 }),
  interestCoverage: decimal("interest_coverage", { precision: 10, scale: 4 }),
  incomeQuality: decimal("income_quality", { precision: 10, scale: 4 }),
  dividendYield: decimal("dividend_yield", { precision: 10, scale: 4 }),
  payoutRatio: decimal("payout_ratio", { precision: 10, scale: 4 }),
  salesGeneralAndAdministrativeToRevenue: decimal("sga_to_revenue", { precision: 10, scale: 4 }),
  researchAndDevelopmentToRevenue: decimal("rd_to_revenue", { precision: 10, scale: 4 }),
  intangibleToTotalAssets: decimal("intangible_to_total_assets", { precision: 10, scale: 4 }),
  capexToOperatingCashFlow: decimal("capex_to_operating_cash_flow", { precision: 10, scale: 4 }),
  capexToRevenue: decimal("capex_to_revenue", { precision: 10, scale: 4 }),
  capexToDepreciation: decimal("capex_to_depreciation", { precision: 10, scale: 4 }),
  stockBasedCompensationToRevenue: decimal("sbc_to_revenue", { precision: 10, scale: 4 }),
  grahamNumber: decimal("graham_number", { precision: 15, scale: 4 }),
  roic: decimal("roic", { precision: 10, scale: 4 }),
  returnOnTangibleAssets: decimal("return_on_tangible_assets", { precision: 10, scale: 4 }),
  grahamNetNet: decimal("graham_net_net", { precision: 15, scale: 4 }),
  workingCapital: decimal("working_capital", { precision: 20, scale: 2 }),
  tangibleAssetValue: decimal("tangible_asset_value", { precision: 20, scale: 2 }),
  netCurrentAssetValue: decimal("net_current_asset_value", { precision: 20, scale: 2 }),
  investedCapital: decimal("invested_capital", { precision: 20, scale: 2 }),
  averageReceivables: decimal("average_receivables", { precision: 20, scale: 2 }),
  averagePayables: decimal("average_payables", { precision: 20, scale: 2 }),
  averageInventory: decimal("average_inventory", { precision: 20, scale: 2 }),
  daysSalesOutstanding: decimal("days_sales_outstanding", { precision: 10, scale: 2 }),
  daysPayablesOutstanding: decimal("days_payables_outstanding", { precision: 10, scale: 2 }),
  daysOfInventoryOnHand: decimal("days_of_inventory_on_hand", { precision: 10, scale: 2 }),
  roe: decimal("roe", { precision: 10, scale: 4 }),
  capexPerShare: decimal("capex_per_share", { precision: 15, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_km_symbol").on(table.symbol),
  uniqueIndex("uq_screener_km").on(table.symbol, table.date, table.period),    // Phase 1
  index("idx_screener_km_roic").on(table.roic),
]);

// Tier 1: DCF Valuations (from /discounted-cash-flow endpoint)
export const screenerDcfValuations = pgTable("screener_dcf_valuations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: varchar("date"),
  dcf: decimal("dcf", { precision: 15, scale: 4 }),
  stockPrice: decimal("stock_price", { precision: 15, scale: 4 }),
  upsidePercent: decimal("upside_percent", { precision: 8, scale: 2 }),  // Phase 2c: (dcf-price)/price*100
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_dcf_symbol").on(table.symbol),
  uniqueIndex("uq_screener_dcf").on(table.symbol, table.date),                // Phase 1
  index("idx_screener_dcf_upside").on(table.upsidePercent),                  // Phase 3a
]);

// Tier 1: Company Ratings (from /rating endpoint)
export const screenerCompanyRatings = pgTable("screener_company_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: varchar("date"),
  rating: varchar("rating"),
  ratingScore: integer("rating_score"),
  ratingRecommendation: varchar("rating_recommendation"),
  ratingDetailsDCFScore: integer("rating_details_dcf_score"),
  ratingDetailsDCFRecommendation: varchar("rating_details_dcf_recommendation"),
  ratingDetailsROEScore: integer("rating_details_roe_score"),
  ratingDetailsROERecommendation: varchar("rating_details_roe_recommendation"),
  ratingDetailsROAScore: integer("rating_details_roa_score"),
  ratingDetailsROARecommendation: varchar("rating_details_roa_recommendation"),
  ratingDetailsDEScore: integer("rating_details_de_score"),
  ratingDetailsDERecommendation: varchar("rating_details_de_recommendation"),
  ratingDetailsPEScore: integer("rating_details_pe_score"),
  ratingDetailsPERecommendation: varchar("rating_details_pe_recommendation"),
  ratingDetailsPBScore: integer("rating_details_pb_score"),
  ratingDetailsPBRecommendation: varchar("rating_details_pb_recommendation"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_rating_symbol").on(table.symbol),
  index("idx_screener_rating_score").on(table.ratingScore),
]);

// Tier 2: Analyst Price Targets (from /price-target endpoint)
export const screenerAnalystTargets = pgTable("screener_analyst_targets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  publishedDate: varchar("published_date"),
  analystName: varchar("analyst_name"),
  analystCompany: varchar("analyst_company"),
  priceTarget: decimal("price_target", { precision: 15, scale: 2 }),
  adjPriceTarget: decimal("adj_price_target", { precision: 15, scale: 2 }),
  priceWhenPosted: decimal("price_when_posted", { precision: 15, scale: 2 }),
  newsUrl: text("news_url"),
  newsTitle: text("news_title"),
  newsPublisher: varchar("news_publisher"),
  newsBaseUrl: varchar("news_base_url"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_at_symbol").on(table.symbol),
  index("idx_screener_at_date").on(table.symbol, table.publishedDate),
]);

// Tier 2: Analyst Grades / Upgrades-Downgrades (from /upgrades-downgrades endpoint)
export const screenerAnalystGrades = pgTable("screener_analyst_grades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  publishedDate: varchar("published_date"),
  gradingCompany: varchar("grading_company"),
  previousGrade: varchar("previous_grade"),
  newGrade: varchar("new_grade"),
  action: varchar("action"),
  priceWhenPosted: decimal("price_when_posted", { precision: 15, scale: 2 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_ag_symbol").on(table.symbol),
  index("idx_screener_ag_date").on(table.symbol, table.publishedDate),
]);

// Tier 2: Earnings Calendar (from /earnings-calendar endpoint)
export const screenerEarningsCalendar = pgTable("screener_earnings_calendar", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: varchar("date"),
  epsEstimated: decimal("eps_estimated", { precision: 15, scale: 4 }),
  epsActual: decimal("eps_actual", { precision: 15, scale: 4 }),
  revenueEstimated: decimal("revenue_estimated", { precision: 20, scale: 2 }),
  revenueActual: decimal("revenue_actual", { precision: 20, scale: 2 }),
  fiscalDateEnding: varchar("fiscal_date_ending"),
  updatedFromDate: varchar("updated_from_date"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_ec_symbol").on(table.symbol),
  index("idx_screener_ec_date").on(table.date),
]);

// Tier 2: Dividend Calendar (from /stock_dividend_calendar endpoint)
export const screenerDividendCalendar = pgTable("screener_dividend_calendar", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: varchar("date"),
  label: varchar("label"),
  adjDividend: decimal("adj_dividend", { precision: 15, scale: 6 }),
  dividend: decimal("dividend", { precision: 15, scale: 6 }),
  recordDate: varchar("record_date"),
  paymentDate: varchar("payment_date"),
  declarationDate: varchar("declaration_date"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_dc_symbol").on(table.symbol),
  index("idx_screener_dc_date").on(table.date),
]);

// Tier 2: Stock Split Calendar (from /stock_split_calendar endpoint)
export const screenerSplitCalendar = pgTable("screener_split_calendar", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: varchar("date"),
  label: varchar("label"),
  numerator: decimal("numerator", { precision: 10, scale: 4 }),
  denominator: decimal("denominator", { precision: 10, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_sc_symbol").on(table.symbol),
  index("idx_screener_sc_date").on(table.date),
]);

// Tier 2: IPO Calendar (from /ipo_calendar endpoint)
export const screenerIpoCalendar = pgTable("screener_ipo_calendar", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol"),
  company: text("company"),
  exchange: varchar("exchange"),
  date: varchar("date"),
  priceRange: varchar("price_range"),
  shares: decimal("shares", { precision: 20, scale: 0 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  actions: varchar("actions"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_ipo_date").on(table.date),
  index("idx_screener_ipo_symbol").on(table.symbol),
]);

// Tier 2: Economic Calendar (from /economic_calendar endpoint)
export const screenerEconomicCalendar = pgTable("screener_economic_calendar", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  event: text("event").notNull(),
  date: varchar("date"),
  country: varchar("country"),
  actual: decimal("actual", { precision: 15, scale: 4 }),
  previous: decimal("previous", { precision: 15, scale: 4 }),
  change: decimal("change", { precision: 15, scale: 4 }),
  changePercentage: decimal("change_percentage", { precision: 10, scale: 4 }),
  estimate: decimal("estimate", { precision: 15, scale: 4 }),
  impact: varchar("impact"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_econ_date").on(table.date),
  index("idx_screener_econ_country").on(table.country),
]);

// Tier 3: Institutional Holders (from /institutional-holder endpoint)
export const screenerInstitutionalHolders = pgTable("screener_institutional_holders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  holder: text("holder"),
  shares: decimal("shares", { precision: 20, scale: 0 }),
  dateReported: varchar("date_reported"),
  change: decimal("change", { precision: 20, scale: 0 }),
  weightPercent: decimal("weight_percent", { precision: 10, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_ih_symbol").on(table.symbol),
]);

// Tier 3: Insider Trades (from /insider-trading endpoint)
export const screenerInsiderTrades = pgTable("screener_insider_trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  filingDate: varchar("filing_date"),
  transactionDate: varchar("transaction_date"),
  reportingName: text("reporting_name"),
  transactionType: varchar("transaction_type"),
  securitiesOwned: decimal("securities_owned", { precision: 20, scale: 0 }),
  securitiesTransacted: decimal("securities_transacted", { precision: 20, scale: 0 }),
  price: decimal("price", { precision: 15, scale: 4 }),
  formType: varchar("form_type"),
  link: text("link"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_it_symbol").on(table.symbol),
  index("idx_screener_it_date").on(table.transactionDate),
]);

// Tier 3: Stock News (from /stock_news endpoint)
export const screenerStockNews = pgTable("screener_stock_news", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  publishedDate: varchar("published_date"),
  title: text("title"),
  image: text("image"),
  site: varchar("site"),
  text: text("text"),
  url: text("url"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_news_symbol").on(table.symbol),
  index("idx_screener_news_date").on(table.publishedDate),
]);

// Tier 3: Sector Performance (from /sector-performance endpoint)
export const screenerSectorPerformance = pgTable("screener_sector_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sector: varchar("sector").notNull(),
  changesPercentage: decimal("changes_percentage", { precision: 10, scale: 4 }),
  date: varchar("date"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_sp_sector").on(table.sector),
  uniqueIndex("uq_sector_perf").on(table.sector, table.date),                 // Phase 1
]);

// Tier 3: Technical Indicators — extended with full MoneyControl Technical tab coverage
export const screenerTechnicalIndicators = pgTable("screener_technical_indicators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: varchar("date"),
  timeframe: varchar("timeframe").default("daily"),

  // ── OHLCV ─────────────────────────────────────────────────────────────────
  open: decimal("open", { precision: 15, scale: 4 }),
  high: decimal("high", { precision: 15, scale: 4 }),
  low: decimal("low", { precision: 15, scale: 4 }),
  close: decimal("close", { precision: 15, scale: 4 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),

  // ── Moving Averages ───────────────────────────────────────────────────────
  sma10: decimal("sma_10", { precision: 15, scale: 4 }),
  sma20: decimal("sma_20", { precision: 15, scale: 4 }),
  sma50: decimal("sma_50", { precision: 15, scale: 4 }),
  sma200: decimal("sma_200", { precision: 15, scale: 4 }),
  ema10: decimal("ema_10", { precision: 15, scale: 4 }),
  ema20: decimal("ema_20", { precision: 15, scale: 4 }),
  ema50: decimal("ema_50", { precision: 15, scale: 4 }),
  ema200: decimal("ema_200", { precision: 15, scale: 4 }),

  // ── Momentum Oscillators ──────────────────────────────────────────────────
  rsi14: decimal("rsi_14", { precision: 10, scale: 4 }),          // 0–100; >70 overbought, <30 oversold
  macd: decimal("macd", { precision: 15, scale: 4 }),             // EMA12 - EMA26
  macdSignal: decimal("macd_signal", { precision: 15, scale: 4 }), // EMA9 of MACD
  macdHist: decimal("macd_hist", { precision: 15, scale: 4 }),    // MACD - Signal
  cci20: decimal("cci_20", { precision: 10, scale: 4 }),          // Commodity Channel Index (20)
  stochasticK: decimal("stochastic_k", { precision: 10, scale: 4 }), // %K (14,3,3)
  stochasticD: decimal("stochastic_d", { precision: 10, scale: 4 }), // %D (3-period SMA of %K)
  williamsR: decimal("williams_r", { precision: 10, scale: 4 }),  // Williams %R (14)
  mfi14: decimal("mfi_14", { precision: 10, scale: 4 }),          // Money Flow Index (14)

  // ── Trend / Volatility ────────────────────────────────────────────────────
  adx: decimal("adx", { precision: 10, scale: 4 }),               // Average Directional Index (14)
  atr14: decimal("atr_14", { precision: 15, scale: 4 }),           // Average True Range (14)
  bollingerUpper: decimal("bollinger_upper", { precision: 15, scale: 4 }), // SMA20 + 2σ
  bollingerMiddle: decimal("bollinger_middle", { precision: 15, scale: 4 }), // SMA20
  bollingerLower: decimal("bollinger_lower", { precision: 15, scale: 4 }), // SMA20 - 2σ
  bollingerBandwidth: decimal("bollinger_bandwidth", { precision: 10, scale: 4 }), // (Upper-Lower)/Middle
  bollingerPercentB: decimal("bollinger_pct_b", { precision: 10, scale: 4 }), // (Close-Lower)/(Upper-Lower)
  supertrend: decimal("supertrend", { precision: 15, scale: 4 }),  // Supertrend value
  supertrendSignal: varchar("supertrend_signal"),                   // 'buy' | 'sell'

  // ── Volume Indicators ─────────────────────────────────────────────────────
  obv: decimal("obv", { precision: 20, scale: 0 }),               // On-Balance Volume
  vwap: decimal("vwap", { precision: 15, scale: 4 }),             // Volume-Weighted Average Price

  // ── 52-Week Range ─────────────────────────────────────────────────────────
  weekHigh52: decimal("week_high_52", { precision: 15, scale: 4 }),
  weekLow52: decimal("week_low_52", { precision: 15, scale: 4 }),
  pctFrom52WHigh: decimal("pct_from_52w_high", { precision: 8, scale: 4 }), // % below 52W high
  pctFrom52WLow: decimal("pct_from_52w_low", { precision: 8, scale: 4 }),   // % above 52W low

  // ── Technical Rating (aggregated signal) ──────────────────────────────────
  // Computed from RSI, MACD, SMA crossovers, Bollinger, Stochastic, ADX
  technicalRating: varchar("technical_rating"), // Strong Buy | Buy | Neutral | Sell | Strong Sell
  bullishSignals: integer("bullish_signals"),   // count of bullish indicators
  bearishSignals: integer("bearish_signals"),   // count of bearish indicators
  neutralSignals: integer("neutral_signals"),   // count of neutral indicators

  // ── Pivot Levels (yesterday's OHLCV → today's pivots) ─────────────────────
  // Classic method: P = (H+L+C)/3
  pivotClassic: decimal("pivot_classic", { precision: 15, scale: 4 }),
  pivotClassicR1: decimal("pivot_classic_r1", { precision: 15, scale: 4 }),
  pivotClassicR2: decimal("pivot_classic_r2", { precision: 15, scale: 4 }),
  pivotClassicR3: decimal("pivot_classic_r3", { precision: 15, scale: 4 }),
  pivotClassicS1: decimal("pivot_classic_s1", { precision: 15, scale: 4 }),
  pivotClassicS2: decimal("pivot_classic_s2", { precision: 15, scale: 4 }),
  pivotClassicS3: decimal("pivot_classic_s3", { precision: 15, scale: 4 }),
  // Fibonacci method
  pivotFibR1: decimal("pivot_fib_r1", { precision: 15, scale: 4 }),
  pivotFibR2: decimal("pivot_fib_r2", { precision: 15, scale: 4 }),
  pivotFibR3: decimal("pivot_fib_r3", { precision: 15, scale: 4 }),
  pivotFibS1: decimal("pivot_fib_s1", { precision: 15, scale: 4 }),
  pivotFibS2: decimal("pivot_fib_s2", { precision: 15, scale: 4 }),
  pivotFibS3: decimal("pivot_fib_s3", { precision: 15, scale: 4 }),
  // Camarilla method
  pivotCamR1: decimal("pivot_cam_r1", { precision: 15, scale: 4 }),
  pivotCamR2: decimal("pivot_cam_r2", { precision: 15, scale: 4 }),
  pivotCamR3: decimal("pivot_cam_r3", { precision: 15, scale: 4 }),
  pivotCamR4: decimal("pivot_cam_r4", { precision: 15, scale: 4 }),
  pivotCamS1: decimal("pivot_cam_s1", { precision: 15, scale: 4 }),
  pivotCamS2: decimal("pivot_cam_s2", { precision: 15, scale: 4 }),
  pivotCamS3: decimal("pivot_cam_s3", { precision: 15, scale: 4 }),
  pivotCamS4: decimal("pivot_cam_s4", { precision: 15, scale: 4 }),
  // Woodie method
  pivotWoodieP: decimal("pivot_woodie_p", { precision: 15, scale: 4 }),
  pivotWoodieR1: decimal("pivot_woodie_r1", { precision: 15, scale: 4 }),
  pivotWoodieR2: decimal("pivot_woodie_r2", { precision: 15, scale: 4 }),
  pivotWoodieS1: decimal("pivot_woodie_s1", { precision: 15, scale: 4 }),
  pivotWoodieS2: decimal("pivot_woodie_s2", { precision: 15, scale: 4 }),

  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_ti_symbol").on(table.symbol),
  index("idx_screener_ti_date").on(table.symbol, table.date),
  index("idx_screener_ti_rsi").on(table.rsi14),
  index("idx_screener_ti_rating").on(table.technicalRating),
]);


// ── Technical Indicators LATEST (hot table) ─────────────────────────────────
// One row per symbol — always the most recent technical snapshot.
// Query engine JOINs this instead of the full historical archive to avoid
// per-query date-sort + dedup on a potentially millions-row table.
// Written by an UPSERT (ON CONFLICT symbol DO UPDATE) after each Tier 3 batch.
export const screenerTechnicalIndicatorsLatest = pgTable("screener_technical_indicators_latest", {
  symbol: varchar("symbol").primaryKey(),   // unique — symbol IS the PK; no UUID needed
  date: varchar("date"),
  timeframe: varchar("timeframe").default("daily"),
  // OHLCV (for pivot/ATR computation and stock detail view)
  open: decimal("open", { precision: 15, scale: 4 }),
  high: decimal("high", { precision: 15, scale: 4 }),
  low: decimal("low", { precision: 15, scale: 4 }),
  close: decimal("close", { precision: 15, scale: 4 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  // Momentum — query-engine filter + screener display columns
  rsi14: decimal("rsi_14", { precision: 10, scale: 4 }),
  macd: decimal("macd", { precision: 15, scale: 4 }),
  macdSignal: decimal("macd_signal", { precision: 15, scale: 4 }),
  macdHist: decimal("macd_hist", { precision: 15, scale: 4 }),
  // Trend
  sma50: decimal("sma_50", { precision: 15, scale: 4 }),
  sma200: decimal("sma_200", { precision: 15, scale: 4 }),
  adx: decimal("adx", { precision: 10, scale: 4 }),
  atr14: decimal("atr_14", { precision: 15, scale: 4 }),
  bollingerUpper: decimal("bollinger_upper", { precision: 15, scale: 4 }),
  bollingerLower: decimal("bollinger_lower", { precision: 15, scale: 4 }),
  bollingerPercentB: decimal("bollinger_pct_b", { precision: 10, scale: 4 }),
  // 52-Week Range
  weekHigh52: decimal("week_high_52", { precision: 15, scale: 4 }),
  weekLow52: decimal("week_low_52", { precision: 15, scale: 4 }),
  pctFrom52WHigh: decimal("pct_from_52w_high", { precision: 8, scale: 4 }),
  // Aggregated signal
  technicalRating: varchar("technical_rating"),
  bullishSignals: integer("bullish_signals"),
  bearishSignals: integer("bearish_signals"),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  index("idx_ti_latest_rsi").on(table.rsi14),
  index("idx_ti_latest_rating").on(table.technicalRating),
  index("idx_ti_latest_adx").on(table.adx),
]);
export type ScreenerTechnicalIndicatorsLatest = typeof screenerTechnicalIndicatorsLatest.$inferSelect;

// ── Analyst Consensus (Phase 2d) — Materialized summary from analyst_targets ──
// Rebuilt after each analyst_targets enrichment batch to eliminate live GROUP BY
export const screenerAnalystConsensus = pgTable("screener_analyst_consensus", {
  symbol: varchar("symbol").primaryKey(),
  avgTarget: decimal("avg_target", { precision: 15, scale: 2 }),
  highTarget: decimal("high_target", { precision: 15, scale: 2 }),
  lowTarget: decimal("low_target", { precision: 15, scale: 2 }),
  analystCount: integer("analyst_count").default(0),
  buyCount: integer("buy_count").default(0),
  holdCount: integer("hold_count").default(0),
  sellCount: integer("sell_count").default(0),
  /** Strong Buy | Buy | Hold | Sell | Strong Sell */
  consensusRating: varchar("consensus_rating"),
  /** Upside % = (avgTarget - currentPrice) / currentPrice * 100 */
  upsidePct: decimal("upside_pct", { precision: 8, scale: 2 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  index("idx_analyst_consensus_upside").on(table.upsidePct),
  index("idx_analyst_consensus_rating").on(table.consensusRating),
]);

export const insertScreenerAnalystConsensusSchema = createInsertSchema(screenerAnalystConsensus);
export type ScreenerAnalystConsensus = typeof screenerAnalystConsensus.$inferSelect;

// ── Shareholding Pattern (quarterly, from BSE/NSE filings) ──────────────────
// Source: BSE shareholding pattern CSV / NSE shareholding API (free, quarterly)
// Updated after SEBI LODR deadlines: Q1→Aug 21, Q2→Nov 21, Q3→Feb 21, Q4→May 30
export const screenerShareholding = pgTable("screener_shareholding", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  quarterDate: varchar("quarter_date").notNull(),         // e.g. '2025-03-31' (quarter end date)
  quarterLabel: varchar("quarter_label"),                  // e.g. 'Mar 2025'

  // ── Category-wise Holding % ───────────────────────────────────────────────
  promoterHolding: decimal("promoter_holding", { precision: 6, scale: 2 }),       // % held by promoters
  promoterGroupHolding: decimal("promoter_group_holding", { precision: 6, scale: 2 }),
  fiiHolding: decimal("fii_holding", { precision: 6, scale: 2 }),                 // Foreign Institutional Investors
  diiHolding: decimal("dii_holding", { precision: 6, scale: 2 }),                 // Domestic Institutional Investors
  mutualFundHolding: decimal("mutual_fund_holding", { precision: 6, scale: 2 }),   // MF subset of DII
  publicHolding: decimal("public_holding", { precision: 6, scale: 2 }),           // Retail / public
  otherHolding: decimal("other_holding", { precision: 6, scale: 2 }),

  // ── Quarter-on-Quarter Changes ────────────────────────────────────────────
  promoterHoldingChange: decimal("promoter_holding_change", { precision: 6, scale: 2 }), // vs prev quarter
  fiiHoldingChange: decimal("fii_holding_change", { precision: 6, scale: 2 }),
  diiHoldingChange: decimal("dii_holding_change", { precision: 6, scale: 2 }),

  // ── Pledge Details ────────────────────────────────────────────────────────
  pledgedShares: decimal("pledged_shares", { precision: 6, scale: 2 }),           // % of promoter shares pledged
  pledgedSharesChange: decimal("pledged_shares_change", { precision: 6, scale: 2 }), // QoQ change

  // ── Raw Numbers ──────────────────────────────────────────────────────────
  totalShares: decimal("total_shares", { precision: 20, scale: 0 }),
  promoterShares: decimal("promoter_shares", { precision: 20, scale: 0 }),
  fiiShares: decimal("fii_shares", { precision: 20, scale: 0 }),
  diiShares: decimal("dii_shares", { precision: 20, scale: 0 }),

  dataSource: varchar("data_source").default("bse"),      // 'bse' | 'nse' | 'manual'
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_sh_symbol").on(table.symbol),
  index("idx_screener_sh_quarter").on(table.symbol, table.quarterDate),
  index("idx_screener_sh_promoter").on(table.promoterHolding),
  index("idx_screener_sh_fii").on(table.fiiHolding),
  uniqueIndex("idx_screener_sh_unique").on(table.symbol, table.quarterDate),
]);

export const insertScreenerShareholdingSchema = createInsertSchema(screenerShareholding).omit({
  id: true, createdAt: true,
});
export type ScreenerShareholding = typeof screenerShareholding.$inferSelect;
export type InsertScreenerShareholding = z.infer<typeof insertScreenerShareholdingSchema>;

// REIT types and schemas are now in reit-invit.ts
export { insertReitSchema };
export type { Reit, InsertReit } from './reit-invit';
