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

// ── Zod Schemas ─────────────────────────────────────────────────────────────
export const insertGlobalMarketIndexSchema = createInsertSchema(globalMarketIndices);
export const insertGlobalCapitalFlowSchema = createInsertSchema(globalCapitalFlows);
export const insertMarketCorrelationSchema = createInsertSchema(marketCorrelationMatrix);
export const insertGlobalIntelligenceSignalSchema = createInsertSchema(globalIntelligenceSignals);

// ── Types ───────────────────────────────────────────────────────────────────
export type GlobalMarketIndex = typeof globalMarketIndices.$inferSelect;
export type InsertGlobalMarketIndex = typeof globalMarketIndices.$inferInsert;

export type GlobalCapitalFlow = typeof globalCapitalFlows.$inferSelect;
export type InsertGlobalCapitalFlow = typeof globalCapitalFlows.$inferInsert;

export type MarketCorrelationRecord = typeof marketCorrelationMatrix.$inferSelect;
export type InsertMarketCorrelationRecord = typeof marketCorrelationMatrix.$inferInsert;

export type GlobalIntelligenceSignal = typeof globalIntelligenceSignals.$inferSelect;
export type InsertGlobalIntelligenceSignal = typeof globalIntelligenceSignals.$inferInsert;
