import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  numeric,
  bigint,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FintekPro Multi-Vendor Instrument & Historical Performance Schema
 * Architecture: GCR v1.0 + FASP-AI v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Multi-Vendor Mapping Table
 * Maps a single canonical instrument (identified by ISIN) to multiple vendor
 * keys, symbols, feed tokens, and routing priorities (Upstox, IRIS, NSE, BSE, AMFI, etc.)
 */
export const instrumentVendorMappings = pgTable(
  "instrument_vendor_mappings",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    instrumentId: varchar("instrument_id"),
    isin: varchar("isin", { length: 50 }).notNull(),
    vendor: varchar("vendor", { length: 50 }).notNull(), // "upstox" | "iris" | "nse" | "bse" | "amfi" | "fmp" | "indianapi" | "alpaca"
    vendorSymbol: varchar("vendor_symbol", { length: 100 }), // e.g. "RELIANCE", "INF209K01157", "001849"
    vendorInstrumentToken: varchar("vendor_instrument_token", { length: 100 }).notNull(), // e.g. "NSE_EQ|INE002A01018", "2885"
    feedRole: varchar("feed_role", { length: 50 }).notNull().default("PRIMARY_QUOTE"), // "PRIMARY_QUOTE" | "FALLBACK" | "EXECUTION" | "REGISTRY"
    isActive: boolean("is_active").default(true).notNull(),
    syncStatus: varchar("sync_status", { length: 50 }).default("synced").notNull(),
    lastVerifiedAt: timestamp("last_verified_at"),
    vendorMetadata: jsonb("vendor_metadata").default({}),
    source: varchar("source", { length: 50 }).default("system").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_ivm_vendor_token_unique").on(table.vendor, table.vendorInstrumentToken),
    index("idx_ivm_isin_vendor").on(table.isin, table.vendor),
    index("idx_ivm_instrument_id").on(table.instrumentId),
    index("idx_ivm_vendor_role").on(table.vendor, table.feedRole),
  ]
);

export const insertInstrumentVendorMappingSchema = createInsertSchema(instrumentVendorMappings).extend({
  id: z.any().optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export type InstrumentVendorMapping = typeof instrumentVendorMappings.$inferSelect;
export type InsertInstrumentVendorMapping = z.infer<typeof insertInstrumentVendorMappingSchema>;

/**
 * Historical Market Prices (OHLCV & Daily NAV Time-Series)
 * Unified time-series store for backtesting, charting, and comparative performance analysis.
 * Stores equities, mutual funds, bonds, ETFs, and market benchmarks (e.g. ^NSEI, ^BSESN).
 */
export const historicalMarketPrices = pgTable(
  "historical_market_prices",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    instrumentId: varchar("instrument_id"),
    isin: varchar("isin", { length: 50 }).notNull(),
    symbol: varchar("symbol", { length: 50 }),
    assetClass: varchar("asset_class", { length: 50 }).notNull(), // "equity" | "mutual_fund" | "bond" | "etf" | "index" | "commodity"
    priceDate: date("price_date").notNull(),
    open: numeric("open", { precision: 18, scale: 4 }),
    high: numeric("high", { precision: 18, scale: 4 }),
    low: numeric("low", { precision: 18, scale: 4 }),
    close: numeric("close", { precision: 18, scale: 4 }).notNull(),
    adjClose: numeric("adj_close", { precision: 18, scale: 4 }),
    volume: bigint("volume", { mode: "number" }),
    change: numeric("change", { precision: 18, scale: 4 }),
    changePercent: numeric("change_percent", { precision: 10, scale: 4 }),
    isCorporateActionAdjusted: boolean("is_corporate_action_adjusted").default(true).notNull(),
    dataSource: varchar("data_source", { length: 50 }).notNull(), // "upstox" | "bhavcopy" | "iris" | "mfapi" | "yahoo"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_hmp_isin_date_unique").on(table.isin, table.priceDate),
    index("idx_hmp_price_date_close").on(table.priceDate, table.close),
    index("idx_hmp_symbol_date").on(table.symbol, table.priceDate),
    index("idx_hmp_asset_class_date").on(table.assetClass, table.priceDate),
  ]
);

export const insertHistoricalMarketPriceSchema = createInsertSchema(historicalMarketPrices).extend({
  id: z.any().optional(),
  createdAt: z.any().optional(),
});

export type HistoricalMarketPrice = typeof historicalMarketPrices.$inferSelect;
export type InsertHistoricalMarketPrice = z.infer<typeof insertHistoricalMarketPriceSchema>;

/**
 * Pre-Computed Financial & Risk Analytics Engine Outputs
 * Adheres strictly to GCR Financial Logic Integrity:
 * Every output includes engine_version, calculation_timestamp, and explainability layer.
 */
export const instrumentPerformanceMetrics = pgTable(
  "instrument_performance_metrics",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    isin: varchar("isin", { length: 50 }).notNull(),
    benchmarkIsin: varchar("benchmark_isin", { length: 50 }).default("^NSEI").notNull(),
    return1D: numeric("return_1d", { precision: 10, scale: 4 }),
    return1W: numeric("return_1w", { precision: 10, scale: 4 }),
    return1M: numeric("return_1m", { precision: 10, scale: 4 }),
    return3M: numeric("return_3m", { precision: 10, scale: 4 }),
    return6M: numeric("return_6m", { precision: 10, scale: 4 }),
    return1Y: numeric("return_1y", { precision: 10, scale: 4 }),
    return3Y: numeric("return_3y", { precision: 10, scale: 4 }),
    return5Y: numeric("return_5y", { precision: 10, scale: 4 }),
    cagr: numeric("cagr", { precision: 10, scale: 4 }),
    volatility: numeric("volatility", { precision: 10, scale: 4 }),
    sharpeRatio: numeric("sharpe_ratio", { precision: 10, scale: 4 }),
    sortinoRatio: numeric("sortino_ratio", { precision: 10, scale: 4 }),
    maxDrawdown: numeric("max_drawdown", { precision: 10, scale: 4 }),
    beta: numeric("beta", { precision: 10, scale: 4 }),
    alpha: numeric("alpha", { precision: 10, scale: 4 }),
    engineVersion: varchar("engine_version", { length: 50 }).notNull().default("GCR-1.0"),
    calculationTimestamp: timestamp("calculation_timestamp").defaultNow().notNull(),
    explainability: jsonb("explainability").default({}).notNull(), // { formula, inputs_used, intermediate_steps }
    source: varchar("source", { length: 50 }).default("system").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_ipm_isin_timestamp").on(table.isin, table.calculationTimestamp),
    index("idx_ipm_isin_benchmark").on(table.isin, table.benchmarkIsin),
  ]
);

export const insertInstrumentPerformanceMetricsSchema = createInsertSchema(instrumentPerformanceMetrics).extend({
  id: z.any().optional(),
  createdAt: z.any().optional(),
  calculationTimestamp: z.any().optional(),
});

export type InstrumentPerformanceMetrics = typeof instrumentPerformanceMetrics.$inferSelect;
export type InsertInstrumentPerformanceMetrics = z.infer<typeof insertInstrumentPerformanceMetricsSchema>;

/**
 * Unified Instrument Consensus Records
 * Single source of truth for cross-engine investment consensus.
 * Aggregates signals from Research Desk, Quant Picks, Thematic Screener, and FASP-AI.
 * Architecture: GCR v1.0 + FASP-AI v1.0 (Zero Redis cost — backed by Cloud SQL Postgres)
 */
export const instrumentConsensusRecords = pgTable(
  "instrument_consensus_records",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    isin: varchar("isin", { length: 50 }),
    instrumentName: varchar("instrument_name", { length: 255 }),
    consensusStatus: varchar("consensus_status", { length: 50 }).notNull().default("approved"), // "approved" | "quarantined" | "under_review"
    primaryRating: varchar("primary_rating", { length: 50 }).notNull().default("HOLD"), // "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL"
    compositeScore: numeric("composite_score", { precision: 6, scale: 2 }),
    engineRatings: jsonb("engine_ratings").default({}).notNull(),
    quarantineReason: varchar("quarantine_reason", { length: 500 }),
    quarantinedUntil: timestamp("quarantined_until"),
    quarantinedByEngine: varchar("quarantined_by_engine", { length: 50 }),
    driftDetected: boolean("drift_detected").default(false).notNull(),
    driftSpread: numeric("drift_spread", { precision: 6, scale: 2 }),
    manualOverride: boolean("manual_override").default(false).notNull(),
    overrideByUserId: varchar("override_by_user_id", { length: 50 }),
    overrideReason: varchar("override_reason", { length: 500 }),
    overrideExpiresAt: timestamp("override_expires_at"),
    engineVersion: varchar("engine_version", { length: 50 }).notNull().default("UICS-v1.0"),
    calculationTimestamp: timestamp("calculation_timestamp").defaultNow().notNull(),
    source: varchar("source", { length: 50 }).default("system").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_icr_symbol_unique").on(table.symbol),
    index("idx_icr_status").on(table.consensusStatus),
    index("idx_icr_isin").on(table.isin),
    index("idx_icr_rating").on(table.primaryRating),
  ]
);

export const insertInstrumentConsensusRecordSchema = createInsertSchema(instrumentConsensusRecords).extend({
  id: z.any().optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export type InstrumentConsensusRecord = typeof instrumentConsensusRecords.$inferSelect;
export type InsertInstrumentConsensusRecord = z.infer<typeof insertInstrumentConsensusRecordSchema>;

/**
 * Adverse Signal Quarantine Audit Logs
 * Immutable audit trail of every quarantine and override event.
 */
export const instrumentQuarantineLogs = pgTable(
  "instrument_quarantine_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    symbol: varchar("symbol", { length: 50 }).notNull(),
    isin: varchar("isin", { length: 50 }),
    event: varchar("event", { length: 50 }).notNull(), // "QUARANTINE_ENTERED" | "QUARANTINE_LIFTED" | "OVERRIDE_APPLIED" | "OVERRIDE_EXPIRED"
    triggerEngine: varchar("trigger_engine", { length: 50 }).notNull(),
    triggerRating: varchar("trigger_rating", { length: 50 }).notNull(),
    triggerScore: numeric("trigger_score", { precision: 6, scale: 2 }),
    reason: varchar("reason", { length: 500 }),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_iql_symbol").on(table.symbol),
    index("idx_iql_created_at").on(table.createdAt),
    index("idx_iql_event").on(table.event),
  ]
);

export const insertInstrumentQuarantineLogSchema = createInsertSchema(instrumentQuarantineLogs).extend({
  id: z.any().optional(),
  createdAt: z.any().optional(),
});

export type InstrumentQuarantineLog = typeof instrumentQuarantineLogs.$inferSelect;
export type InsertInstrumentQuarantineLog = z.infer<typeof insertInstrumentQuarantineLogSchema>;
