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
  return1y: decimal("return_1y", { precision: 10, scale: 4 }),
  return2y: decimal("return_2y", { precision: 10, scale: 4 }),
  return3y: decimal("return_3y", { precision: 10, scale: 4 }),
  return5y: decimal("return_5y", { precision: 10, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_fin_symbol").on(table.symbol),
  index("idx_screener_fin_period").on(table.symbol, table.period),
  index("idx_screener_fin_pe").on(table.peRatio),
  index("idx_screener_fin_roe").on(table.roe),
  index("idx_screener_fin_de").on(table.debtToEquity),
]);

export const screenerPriceHistory = pgTable("screener_price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: varchar("date").notNull(),
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
  index("idx_screener_price_date").on(table.symbol, table.date),
]);

export const screenerDerivedMetrics = pgTable("screener_derived_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull().unique(),
  growthScore: decimal("growth_score", { precision: 5, scale: 2 }),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }),
  valueScore: decimal("value_score", { precision: 5, scale: 2 }),
  riskScore: decimal("risk_score", { precision: 5, scale: 2 }),
  compositeScore: decimal("composite_score", { precision: 5, scale: 2 }),
  fintekRating: integer("fintek_rating"),
  momentumScore: decimal("momentum_score", { precision: 5, scale: 2 }),
  revenueGrowth3Y: decimal("revenue_growth_3y", { precision: 10, scale: 4 }),
  earningsGrowth3Y: decimal("earnings_growth_3y", { precision: 10, scale: 4 }),
  scoringMetadata: jsonb("scoring_metadata"),
  lastCalculated: timestamp("last_calculated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_derived_symbol").on(table.symbol),
  index("idx_screener_derived_composite").on(table.compositeScore),
  index("idx_screener_derived_rating").on(table.fintekRating),
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
  index("idx_screener_growth_date").on(table.symbol, table.date),
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
  index("idx_screener_km_date").on(table.symbol, table.date),
  index("idx_screener_km_roic").on(table.roic),
]);

// Tier 1: DCF Valuations (from /discounted-cash-flow endpoint)
export const screenerDcfValuations = pgTable("screener_dcf_valuations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: varchar("date"),
  dcf: decimal("dcf", { precision: 15, scale: 4 }),
  stockPrice: decimal("stock_price", { precision: 15, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_dcf_symbol").on(table.symbol),
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
  index("idx_screener_sp_date").on(table.date),
]);

// Tier 3: Technical Indicators (from /technical_indicator endpoint)
export const screenerTechnicalIndicators = pgTable("screener_technical_indicators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol").notNull(),
  date: varchar("date"),
  timeframe: varchar("timeframe").default("daily"),
  open: decimal("open", { precision: 15, scale: 4 }),
  high: decimal("high", { precision: 15, scale: 4 }),
  low: decimal("low", { precision: 15, scale: 4 }),
  close: decimal("close", { precision: 15, scale: 4 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  sma10: decimal("sma_10", { precision: 15, scale: 4 }),
  sma20: decimal("sma_20", { precision: 15, scale: 4 }),
  sma50: decimal("sma_50", { precision: 15, scale: 4 }),
  sma200: decimal("sma_200", { precision: 15, scale: 4 }),
  ema10: decimal("ema_10", { precision: 15, scale: 4 }),
  ema20: decimal("ema_20", { precision: 15, scale: 4 }),
  ema50: decimal("ema_50", { precision: 15, scale: 4 }),
  ema200: decimal("ema_200", { precision: 15, scale: 4 }),
  rsi14: decimal("rsi_14", { precision: 10, scale: 4 }),
  macd: decimal("macd", { precision: 15, scale: 4 }),
  macdSignal: decimal("macd_signal", { precision: 15, scale: 4 }),
  macdHist: decimal("macd_hist", { precision: 15, scale: 4 }),
  adx: decimal("adx", { precision: 10, scale: 4 }),
  williams: decimal("williams", { precision: 10, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_screener_ti_symbol").on(table.symbol),
  index("idx_screener_ti_date").on(table.symbol, table.date),
]);

// REIT types and schemas are now in reit-invit.ts
export { insertReitSchema };
export type { Reit, InsertReit } from './reit-invit';
