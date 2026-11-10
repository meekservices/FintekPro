/**
 * @file macro-intelligence.ts
 * @description Drizzle schema definitions for the Global Market Intelligence Engine (GMIE).
 *
 * Captures:
 *   1. global_market_indices: Multi-asset global tickers, closes, 1D moves, and regions
 *   2. global_capital_flows: FII, DII, FDI, and Global Central Bank liquidity flows
 *   3. market_correlation_matrix: Multi-horizon (30d/90d/365d) rolling correlations & betas vs Indian benchmarks
 *   4. global_intelligence_signals: Regime, decoupling scores, asset tilt recommendations, and explainability
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  timestamp,
  decimal,
  date,
  numeric,
  boolean,
  index,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── 1. Global Market Benchmarks & Multi-Asset Tickers ────────────────────────
export const globalMarketIndices = pgTable(
  "global_market_indices",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    symbol: varchar("symbol", { length: 50 }).notNull().unique(), // e.g. "^SPX", "^IXIC", "BRENT_CRUDE", "DXY", "US10Y", "GIFT_NIFTY"
    name: varchar("name", { length: 150 }).notNull(),
    assetClass: varchar("asset_class", { length: 50 }).notNull(), // 'EQUITY_INDEX', 'COMMODITY', 'SOVEREIGN_YIELD', 'CURRENCY'
    region: varchar("region", { length: 50 }).notNull(), // 'US', 'EUROPE', 'ASIA_PACIFIC', 'COMMODITIES', 'INDIA'
    lastPrice: numeric("last_price", { precision: 18, scale: 4 }).notNull(),
    change1D: numeric("change_1d", { precision: 10, scale: 4 }),
    changePct1D: numeric("change_pct_1d", { precision: 8, scale: 4 }),
    currency: varchar("currency", { length: 10 }).default("USD"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_gmi_asset_class").on(table.assetClass),
    index("idx_gmi_region").on(table.region),
  ]
);

// ── 2. Comprehensive Capital Flows (FII, DII, FDI, Global Liquidity) ──────────
export const globalCapitalFlows = pgTable(
  "global_capital_flows",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    flowDate: date("flow_date").notNull(),
    flowType: varchar("flow_type", { length: 50 }).notNull(), // 'FII_CASH', 'DII_CASH', 'FII_INDEX_FUTURES', 'FDI_INFLOW', 'FED_NET_LIQUIDITY'
    grossInflowCr: numeric("gross_inflow_cr", { precision: 16, scale: 2 }),
    grossOutflowCr: numeric("gross_outflow_cr", { precision: 16, scale: 2 }),
    netFlowCr: numeric("net_flow_cr", { precision: 16, scale: 2 }).notNull(),
    fpiLongShortRatio: numeric("fpi_long_short_ratio", { precision: 6, scale: 4 }),
    diiAbsorptionRatio: numeric("dii_absorption_ratio", { precision: 6, scale: 4 }),
    sectoralBreakdown: jsonb("sectoral_breakdown"), // { "IT": +1200, "BFSI": -2400, "Auto": +450 }
    source: varchar("source", { length: 50 }).notNull(), // 'NSDL', 'NSE', 'RBI', 'FRED'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_gcf_date_type").on(table.flowDate, table.flowType),
    index("idx_gcf_flow_date").on(table.flowDate),
  ]
);

// ── 3. Multi-Asset Rolling Correlation Matrix ────────────────────────────────
export const marketCorrelationMatrix = pgTable(
  "market_correlation_matrix",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    calculationDate: date("calculation_date").notNull(),
    domesticSymbol: varchar("domestic_symbol", { length: 50 }).notNull(), // e.g. "NIFTY_50", "NIFTY_IT", "NIFTY_BANK"
    globalSymbol: varchar("global_symbol", { length: 50 }).notNull(), // e.g. "^IXIC", "BRENT_CRUDE", "DXY", "^SPX"
    correlation30D: numeric("correlation_30d", { precision: 6, scale: 4 }).notNull(),
    correlation90D: numeric("correlation_90d", { precision: 6, scale: 4 }).notNull(),
    correlation365D: numeric("correlation_365d", { precision: 6, scale: 4 }).notNull(),
    rollingBeta90D: numeric("rolling_beta_90d", { precision: 6, scale: 4 }),
    leadLagRelationship: varchar("lead_lag_relationship", { length: 50 }), // 'GLOBAL_LEADS_DOMESTIC', 'CO_INTEGRATED', 'INDEPENDENT'
    calculationTimestamp: timestamp("calculation_timestamp").defaultNow().notNull(),
    engineVersion: varchar("engine_version", { length: 20 }).default("GMIE-v1.0.0").notNull(),
  },
  (table) => [
    uniqueIndex("idx_mcm_pair_date").on(
      table.calculationDate,
      table.domesticSymbol,
      table.globalSymbol
    ),
    index("idx_mcm_domestic").on(table.domesticSymbol),
  ]
);

// ── 4. Macro Intelligence Derived Signals & Inter-Engine Feeds ───────────────
export const globalIntelligenceSignals = pgTable(
  "global_intelligence_signals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    signalDate: date("signal_date").notNull(),
    macroRegime: varchar("macro_regime", { length: 50 }).notNull(), // 'GLOBAL_RISK_ON', 'GLOBAL_RISK_OFF', 'DOMESTIC_DECOUPLING', 'LIQUIDITY_CONTRACTION'
    indiaDecouplingScore: numeric("india_decoupling_score", { precision: 6, scale: 3 }).notNull(),
    institutionalSentiment: varchar("institutional_sentiment", { length: 30 }).notNull(), // 'STRONG_ACCUMULATION', 'DISTRIBUTION', 'NEUTRAL'
    overnightTransmissionBias: varchar("overnight_bias", { length: 30 }), // 'GAP_UP', 'GAP_DOWN', 'FLAT'
    recommendedAssetTilts: jsonb("recommended_asset_tilts").notNull(), // { "Domestic_Equity": +5, "US_Tech": -2, "Gold": +3, "Fixed_Income": 0 }
    explainability: jsonb("explainability").notNull(), // { factors_considered, formula_applied, intermediate_steps }
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_gis_date").on(table.signalDate),
    index("idx_gis_regime").on(table.macroRegime),
  ]
);

// ── 5. MSCI Index Factors & Emerging Market Valuation Spreads ────────────────
export const msciIndexFactors = pgTable(
  "msci_index_factors",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    indexCode: varchar("index_code", { length: 50 }).notNull().unique(), // e.g. 'MSCI_EM', 'MSCI_INDIA', 'MSCI_CHINA', 'MSCI_INDIA_MOMENTUM', etc.
    indexName: varchar("index_name", { length: 150 }).notNull(),
    category: varchar("category", { length: 50 }).notNull(), // 'BENCHMARK', 'COUNTRY', 'FACTOR'
    weightInEmPct: numeric("weight_in_em_pct", { precision: 6, scale: 3 }), // e.g. 20.450 for India in MSCI EM
    peRatio: numeric("pe_ratio", { precision: 8, scale: 2 }),
    forwardPe: numeric("forward_pe", { precision: 8, scale: 2 }),
    pbRatio: numeric("pb_ratio", { precision: 8, scale: 2 }),
    dividendYield: numeric("dividend_yield", { precision: 6, scale: 3 }),
    return1M: numeric("return_1m", { precision: 8, scale: 4 }),
    return3M: numeric("return_3m", { precision: 8, scale: 4 }),
    return1Y: numeric("return_1y", { precision: 8, scale: 4 }),
    returnYtd: numeric("return_ytd", { precision: 8, scale: 4 }),
    indiaPremiumPct: numeric("india_premium_pct", { precision: 8, scale: 2 }), // Valuation premium vs MSCI EM (+78.5%)
    factorLeadershipRank: numeric("factor_leadership_rank", { precision: 4, scale: 0 }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_msci_category").on(table.category),
    index("idx_msci_code").on(table.indexCode),
  ]
);

// ── 6. Global Country Market Profiles & Macro Drivers ────────────────────────
export const countryMarketProfiles = pgTable(
  "country_market_profiles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    countryCode: varchar("country_code", { length: 10 }).notNull().unique(), // 'US', 'IN', 'CN', 'JP', 'DE', 'GB', 'TW', 'KR', 'BR'
    countryName: varchar("country_name", { length: 100 }).notNull(),
    region: varchar("region", { length: 50 }).notNull(), // 'NORTH_AMERICA', 'EUROPE', 'ASIA_PACIFIC', 'EMERGING_MARKETS'
    benchmarkIndex: varchar("benchmark_index", { length: 100 }).notNull(),
    localCurrency: varchar("local_currency", { length: 10 }).default("USD"),
    lastClose: numeric("last_close", { precision: 18, scale: 4 }).notNull(),
    changePct1D: numeric("change_pct_1d", { precision: 8, scale: 4 }),
    changePct1M: numeric("change_pct_1m", { precision: 8, scale: 4 }),
    changePctYtd: numeric("change_pct_ytd", { precision: 8, scale: 4 }),
    peRatio: numeric("pe_ratio", { precision: 8, scale: 2 }),
    sovereignYield10Y: numeric("sovereign_yield_10y", { precision: 6, scale: 3 }),
    centralBankPolicyRate: numeric("central_bank_policy_rate", { precision: 6, scale: 3 }),
    correlationWithNifty90D: numeric("correlation_with_nifty_90d", { precision: 6, scale: 4 }),
    rollingBetaVsNifty: numeric("rolling_beta_vs_nifty", { precision: 6, scale: 4 }),
    macroStatus: varchar("macro_status", { length: 50 }).notNull(), // 'EXPANSION', 'DECELERATION', 'STIMULUS_PIVOT', 'DEFENSIVE'
    capitalFlowSentiment: varchar("capital_flow_sentiment", { length: 50 }).notNull(), // 'OVERWEIGHT_INFLOW', 'NEUTRAL', 'UNDERWEIGHT_OUTFLOW'
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_cmp_region").on(table.region),
    index("idx_cmp_country_code").on(table.countryCode),
  ]
);

// ── 7. Indian ADR Performance & Arbitrage Tracker ────────────────────────────
export const indianAdrTracking = pgTable(
  "indian_adr_tracking",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    symbol: varchar("symbol", { length: 20 }).notNull().unique(), // 'HDB', 'IBN', 'INFY', 'WIT', 'RDY', 'MMYT', 'SIFY'
    companyName: varchar("company_name", { length: 150 }).notNull(),
    exchange: varchar("exchange", { length: 20 }).notNull(), // 'NYSE', 'NASDAQ'
    underlyingNseSymbol: varchar("underlying_nse_symbol", { length: 50 }).notNull(), // 'HDFCBANK', 'ICICIBANK', 'INFY', etc.
    sector: varchar("sector", { length: 50 }).notNull(), // 'Banking', 'IT Services', 'Pharma', 'Consumer Tech'
    adrRatio: numeric("adr_ratio", { precision: 6, scale: 2 }).notNull(), // Underlying shares per ADR (e.g. 1.0 or 2.0)
    adrPriceUsd: numeric("adr_price_usd", { precision: 12, scale: 4 }).notNull(),
    changePct1D: numeric("change_pct_1d", { precision: 8, scale: 4 }),
    changePct1M: numeric("change_pct_1m", { precision: 8, scale: 4 }),
    nseClosePriceInr: numeric("nse_close_price_inr", { precision: 14, scale: 2 }).notNull(),
    impliedInrPrice: numeric("implied_inr_price", { precision: 14, scale: 2 }).notNull(),
    premiumDiscountPct: numeric("premium_discount_pct", { precision: 8, scale: 4 }).notNull(), // (Implied - NSE) / NSE * 100
    overnightSectorSignal: varchar("overnight_sector_signal", { length: 30 }).notNull(), // 'BULLISH_LEAD', 'BEARISH_LEAD', 'NEUTRAL'
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_adr_symbol").on(table.symbol),
    index("idx_adr_sector").on(table.sector),
  ]
);

// ── 8. Global FII Country Scorecards (Institutional Allocation Pillars) ─────
export const globalFiiCountryScorecards = pgTable(
  "global_fii_country_scorecards",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    countryCode: varchar("country_code", { length: 10 }).notNull().unique(), // 'IN', 'US', 'CN', 'JP', 'DE', 'TW', 'KR', 'BR', 'VN'
    countryName: varchar("country_name", { length: 100 }).notNull(),
    region: varchar("region", { length: 50 }).notNull(),
    macroGrowthScore: numeric("macro_growth_score", { precision: 6, scale: 2 }).notNull(), // 0-100
    fxRiskScore: numeric("fx_risk_score", { precision: 6, scale: 2 }).notNull(), // 0-100
    valuationAttractivenessScore: numeric("valuation_score", { precision: 6, scale: 2 }).notNull(), // 0-100
    liquidityPolicyScore: numeric("liquidity_policy_score", { precision: 6, scale: 2 }).notNull(), // 0-100
    marketAccessibilityScore: numeric("market_accessibility_score", { precision: 6, scale: 2 }).notNull(), // 0-100
    geopoliticalStabilityScore: numeric("geopolitical_score", { precision: 6, scale: 2 }).notNull(), // 0-100
    compositeFiiScore: numeric("composite_fii_score", { precision: 6, scale: 2 }).notNull(), // 0-100 weighted
    fiiAllocationStance: varchar("fii_allocation_stance", { length: 50 }).notNull(), // 'STRONG_OVERWEIGHT', 'MODERATE_OVERWEIGHT', 'NEUTRAL', 'UNDERWEIGHT', 'TACTICAL_AVOID'
    projectedFiiFlowTrend: varchar("projected_flow_trend", { length: 50 }).notNull(), // 'NET_ACCELERATING_INFLOW', 'STEADY_ACCUMULATION', 'CHOPPY_NEUTRAL', 'ROTATIONAL_OUTFLOW', 'AGGRESSIVE_SELLING'
    keyDrivers: jsonb("key_drivers").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_fii_sc_country").on(table.countryCode),
    index("idx_fii_sc_stance").on(table.fiiAllocationStance),
  ]
);

// ── 9. Global FII Cross-Border Realized Flows Time-Series ────────────────────
export const globalFiiCrossBorderFlows = pgTable(
  "global_fii_cross_border_flows",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    flowDate: date("flow_date").notNull(),
    countryCode: varchar("country_code", { length: 10 }).notNull(),
    equityNetFlowUsdMn: numeric("equity_net_flow_usd_mn", { precision: 14, scale: 2 }).notNull(),
    debtNetFlowUsdMn: numeric("debt_net_flow_usd_mn", { precision: 14, scale: 2 }).notNull(),
    totalNetFlowUsdMn: numeric("total_net_flow_usd_mn", { precision: 14, scale: 2 }).notNull(),
    trailing30dCumulativeUsdMn: numeric("trailing_30d_cumulative_usd_mn", { precision: 16, scale: 2 }).notNull(),
    foreignOwnershipPctOfMcap: numeric("foreign_ownership_pct_of_mcap", { precision: 6, scale: 2 }),
    source: varchar("source", { length: 50 }).notNull(), // 'NSDL_SEBI', 'EPFR_PROXY', 'IIF_FLOWS', 'EXCHANGE_OFFICIAL'
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_gfcf_date_country").on(table.flowDate, table.countryCode),
    index("idx_gfcf_country").on(table.countryCode),
    index("idx_gfcf_date").on(table.flowDate),
  ]
);

// ── 10. Global FII Allocation Signals & Inter-Engine Handoffs ────────────────
export const globalFiiAllocationSignals = pgTable(
  "global_fii_allocation_signals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    signalDate: date("signal_date").notNull(),
    leadingInflowDestinations: jsonb("leading_inflow_destinations").notNull(), // ['IN', 'US', 'TW']
    leadingOutflowDestinations: jsonb("leading_outflow_destinations").notNull(), // ['DE', 'KR']
    tacticalRotationNarrative: text("tactical_rotation_narrative").notNull(),
    indiaFiiStatus: jsonb("india_fii_status").notNull(),
    crossCountryPairTrades: jsonb("cross_country_pair_trades").notNull(),
    explainability: jsonb("explainability").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_gfas_date").on(table.signalDate),
  ]
);

// ── 11. Global Credit Cycle & Systemic Lending Indicators ────────────────────
export const globalCreditCycleMetrics = pgTable(
  "global_credit_cycle_metrics",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    asOfDate: date("as_of_date").notNull().unique(),
    // Core Credit Cycle Pillars
    usHyOasBps: numeric("us_hy_oas_bps", { precision: 8, scale: 2 }).notNull(), // ICE BofA US High Yield Index OAS (bps)
    usHyOasBand: varchar("us_hy_oas_band", { length: 30 }).notNull(), // 'EXPANSION', 'NEUTRAL', 'LATE_CYCLE', 'CONTRACTION', 'CRISIS'
    sloosNetTighteningPct: numeric("sloos_net_tightening_pct", { precision: 6, scale: 2 }).notNull(), // Net % banks tightening C&I loans
    embiGlobalSpreadBps: numeric("embi_global_spread_bps", { precision: 8, scale: 2 }).notNull(), // JPMorgan EMBI Global spread
    chinaCreditImpulsePct: numeric("china_credit_impulse_pct", { precision: 6, scale: 2 }).notNull(), // China TSF Credit Impulse as % of GDP
    indiaBankCreditGrowthYoY: numeric("india_bank_credit_growth_yoy", { precision: 6, scale: 2 }).notNull(), // RBI Commercial Bank Credit YoY %
    indiaCommercialPaperSpreadBps: numeric("india_commercial_paper_spread_bps", { precision: 8, scale: 2 }).notNull(), // 3M CP vs 91D T-Bill spread
    // Global Multi-Asset Credit & Liquidity Modifiers
    g4CentralBankLiquidityUsdTrillion: numeric("g4_central_bank_liquidity_usd_trillion", { precision: 8, scale: 3 }), // Fed + ECB + BOJ + PBOC
    copperGoldRatio: numeric("copper_gold_ratio", { precision: 8, scale: 6 }), // Spot Copper / Spot Gold
    copperGoldSignal: varchar("copper_gold_signal", { length: 30 }), // 'EXPANSIONARY', 'NEUTRAL', 'STAGFLATION_WARNING'
    rbiReer40Index: numeric("rbi_reer_40_index", { precision: 6, scale: 2 }), // RBI 40-Currency REER
    // Derived Credit Cycle Regime
    creditCycleCompositeScore: numeric("credit_cycle_composite_score", { precision: 6, scale: 2 }).notNull(), // 0 - 100
    creditCycleRegime: varchar("credit_cycle_regime", { length: 50 }).notNull(), // 'EXPANSIONARY_CREDIT', 'NEUTRAL_LATE_CYCLE', 'CREDIT_CONTRACTION', 'SEVERE_CREDIT_CRUNCH'
    creditStressTripwire: boolean("credit_stress_tripwire").default(false).notNull(),
    meta: jsonb("meta").notNull(), // { engine_version, calculation_timestamp, factors_considered, formula_applied }
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_gccm_date").on(table.asOfDate),
    index("idx_gccm_regime").on(table.creditCycleRegime),
  ]
);

// ── Zod Schemas ─────────────────────────────────────────────────────────────
export const insertGlobalMarketIndexSchema = createInsertSchema(globalMarketIndices);
export const insertGlobalCapitalFlowSchema = createInsertSchema(globalCapitalFlows);
export const insertMarketCorrelationSchema = createInsertSchema(marketCorrelationMatrix);
export const insertGlobalIntelligenceSignalSchema = createInsertSchema(globalIntelligenceSignals);
export const insertMsciIndexFactorSchema = createInsertSchema(msciIndexFactors);
export const insertCountryMarketProfileSchema = createInsertSchema(countryMarketProfiles);
export const insertIndianAdrTrackingSchema = createInsertSchema(indianAdrTracking);
export const insertGlobalFiiCountryScorecardSchema = createInsertSchema(globalFiiCountryScorecards);
export const insertGlobalFiiCrossBorderFlowSchema = createInsertSchema(globalFiiCrossBorderFlows);
export const insertGlobalFiiAllocationSignalSchema = createInsertSchema(globalFiiAllocationSignals);
export const insertGlobalCreditCycleMetricSchema = createInsertSchema(globalCreditCycleMetrics);

// ── Types ───────────────────────────────────────────────────────────────────
export type GlobalMarketIndex = typeof globalMarketIndices.$inferSelect;
export type InsertGlobalMarketIndex = typeof globalMarketIndices.$inferInsert;

export type GlobalCapitalFlow = typeof globalCapitalFlows.$inferSelect;
export type InsertGlobalCapitalFlow = typeof globalCapitalFlows.$inferInsert;

export type MarketCorrelationRecord = typeof marketCorrelationMatrix.$inferSelect;
export type InsertMarketCorrelationRecord = typeof marketCorrelationMatrix.$inferInsert;

export type GlobalIntelligenceSignal = typeof globalIntelligenceSignals.$inferSelect;
export type InsertGlobalIntelligenceSignal = typeof globalIntelligenceSignals.$inferInsert;

export type MsciIndexFactor = typeof msciIndexFactors.$inferSelect;
export type InsertMsciIndexFactor = typeof msciIndexFactors.$inferInsert;

export type CountryMarketProfile = typeof countryMarketProfiles.$inferSelect;
export type InsertCountryMarketProfile = typeof countryMarketProfiles.$inferInsert;

export type IndianAdrRecord = typeof indianAdrTracking.$inferSelect;
export type InsertIndianAdrRecord = typeof indianAdrTracking.$inferInsert;

export type GlobalFiiCountryScorecard = typeof globalFiiCountryScorecards.$inferSelect;
export type InsertGlobalFiiCountryScorecard = typeof globalFiiCountryScorecards.$inferInsert;

export type GlobalFiiCrossBorderFlow = typeof globalFiiCrossBorderFlows.$inferSelect;
export type InsertGlobalFiiCrossBorderFlow = typeof globalFiiCrossBorderFlows.$inferInsert;

export type GlobalFiiAllocationSignal = typeof globalFiiAllocationSignals.$inferSelect;
export type InsertGlobalFiiAllocationSignal = typeof globalFiiAllocationSignals.$inferInsert;

export type GlobalCreditCycleMetric = typeof globalCreditCycleMetrics.$inferSelect;
export type InsertGlobalCreditCycleMetric = typeof globalCreditCycleMetrics.$inferInsert;
