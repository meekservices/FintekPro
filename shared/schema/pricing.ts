import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  decimal,
  timestamp,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  integer,
  date,
  bigserial,
  serial,
  bigint,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FintekPro Golden Source Pricing Engine — Data Architecture Schema
 * Single Source of Truth (SSOT) for all asset classes & benchmarks
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── 1. golden_prices ────────────────────────────────────────────────────────
// Single Source of Truth for all instruments (equity, mutual fund, bond, commodity, ETF, US stock, macro)
export const goldenPrices = pgTable("golden_prices", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 50 }),
  priceDate: date("price_date").notNull(),
  assetClass: varchar("asset_class", { length: 30 }).default("equity").notNull(),
  price: decimal("price", { precision: 20, scale: 6 }).notNull(),
  openPrice: decimal("open_price", { precision: 20, scale: 6 }),
  highPrice: decimal("high_price", { precision: 20, scale: 6 }),
  lowPrice: decimal("low_price", { precision: 20, scale: 6 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  changePercent: decimal("change_percent", { precision: 10, scale: 4 }),
  source: varchar("source", { length: 50 }).notNull(),
  confidenceScore: integer("confidence_score").default(50).notNull(),
  isValidated: boolean("is_validated").default(false).notNull(),
  isStale: boolean("is_stale").default(false).notNull(),
  isFlagged: boolean("is_flagged").default(false).notNull(),
  flagReason: text("flag_reason"),
  previousPrice: decimal("previous_price", { precision: 20, scale: 6 }),
  deviationPct: decimal("deviation_pct", { precision: 10, scale: 4 }),
  currency: varchar("currency", { length: 10 }).default("INR"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_golden_prices_isin_date").on(table.isin, table.priceDate),
  index("idx_golden_prices_date").on(table.priceDate),
  index("idx_golden_prices_symbol").on(table.symbol),
  index("idx_golden_prices_asset_class").on(table.assetClass),
  index("idx_golden_prices_flagged").on(table.isFlagged),
  // Composite index for time-series lookups (RSI, DMA, returns, quant engines)
  index("idx_golden_prices_symbol_date_price").on(table.symbol, table.priceDate, table.price),
  // Composite index for ISIN time-series lookups & latest price queries
  index("idx_golden_prices_isin_date_desc_price").on(table.isin, table.priceDate, table.price),
  // Composite index for asset class + date range scans (MVO covariance matrix)
  index("idx_golden_prices_asset_date_desc").on(table.assetClass, table.priceDate),
]);

export type GoldenPrice = typeof goldenPrices.$inferSelect;
export type InsertGoldenPrice = typeof goldenPrices.$inferInsert;
export const insertGoldenPriceSchema = createInsertSchema(goldenPrices).extend({
  id: z.any().optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

// ── 2. golden_prices_intraday ────────────────────────────────────────────────
// Tick-level intraday price cache written by GPE during NSE market hours (09:15–15:30 IST).
// Used by Daily Brief formatBriefForClient() to serve live India marketSnapshot prices
// during market hours, falling back to golden_prices EOD after hours.
// Rows older than 5 days are purged nightly to keep the table lean.
export const goldenPricesIntraday = pgTable("golden_prices_intraday", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 50 }),
  tickTs: timestamp("tick_ts", { withTimezone: true }).notNull(),
  price: decimal("price", { precision: 20, scale: 6 }).notNull(),
  changePercent: decimal("change_percent", { precision: 10, scale: 4 }),
  volume: bigint("volume", { mode: "number" }),
  source: varchar("source", { length: 50 }).notNull(),
  assetClass: varchar("asset_class", { length: 30 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_golden_intraday_isin_ts").on(table.isin, table.tickTs),
  index("idx_golden_intraday_symbol_ts").on(table.symbol, table.tickTs),
  index("idx_golden_intraday_tick_ts").on(table.tickTs),
]);

export type GoldenPriceIntraday = typeof goldenPricesIntraday.$inferSelect;
export type InsertGoldenPriceIntraday = typeof goldenPricesIntraday.$inferInsert;
export const insertGoldenPriceIntradaySchema = createInsertSchema(goldenPricesIntraday).omit({ id: true, createdAt: true });

// ── 3. price_audit_log ───────────────────────────────────────────────────────
// SEBI Compliance: Append-only audit trail of every golden price determination & manual override
export const priceAuditLog = pgTable("price_audit_log", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  priceDate: date("price_date").notNull(),
  oldPrice: decimal("old_price", { precision: 20, scale: 6 }),
  newPrice: decimal("new_price", { precision: 20, scale: 6 }).notNull(),
  oldSource: varchar("old_source", { length: 50 }),
  newSource: varchar("new_source", { length: 50 }).notNull(),
  changeReason: text("change_reason").notNull(),
  changedBy: varchar("changed_by", { length: 100 }).notNull().default("system"),
  confidenceScore: integer("confidence_score"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_price_audit_isin").on(table.isin),
  index("idx_price_audit_date").on(table.priceDate),
  index("idx_price_audit_created").on(table.createdAt),
]);

export type PriceAuditEntry = typeof priceAuditLog.$inferSelect;
export type InsertPriceAuditEntry = typeof priceAuditLog.$inferInsert;
export const insertPriceAuditLogSchema = createInsertSchema(priceAuditLog).omit({ id: true, createdAt: true });

// ── 4. corporate_actions ─────────────────────────────────────────────────────
// Tracks splits, bonus issues, dividends, rights, mergers.
// Drives split-adjusted price corrections in golden_prices time-series.
export const corporateActions = pgTable("corporate_actions", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 50 }),
  actionType: varchar("action_type", { length: 50 }).notNull(), // SPLIT, BONUS, DIVIDEND, RIGHTS, MERGER, DEMERGER, BUYBACK
  exDate: date("ex_date").notNull(),
  recordDate: date("record_date"),
  payDate: date("pay_date"),
  ratio: varchar("ratio", { length: 30 }), // e.g. "2:1" for 2-for-1 split
  adjustmentFactor: decimal("adjustment_factor", { precision: 15, scale: 8 }), // e.g. 0.5 for 2:1 split
  dividendAmount: decimal("dividend_amount", { precision: 15, scale: 4 }), // per share amount
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

export type CorporateAction = typeof corporateActions.$inferSelect;
export type InsertCorporateAction = typeof corporateActions.$inferInsert;
export const insertCorporateActionSchema = createInsertSchema(corporateActions).omit({ id: true, createdAt: true, updatedAt: true });

// ── 5. price_adjustments ─────────────────────────────────────────────────────
// Log of every price series adjustment applied due to a corporate action
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

export type PriceAdjustment = typeof priceAdjustments.$inferSelect;
export type InsertPriceAdjustment = typeof priceAdjustments.$inferInsert;
export const insertPriceAdjustmentSchema = createInsertSchema(priceAdjustments).omit({ id: true, appliedAt: true });

// ── 6. macro_regime_snapshots ────────────────────────────────────────────────
// Nightly macro regime classification derived from GPE live data.
// Consumed by: POTD (daily_picks.macro_regime_id FK), AI Recommendation Engine,
// and risk engine for regime-aware asset allocation.
// Populated by GoldenPricingEngine.syncMacroAndMarketBriefPrices() after each sync.
export const macroRegimeSnapshots = pgTable("macro_regime_snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: date("snapshot_date").notNull(),

  // US macro indicators
  dxyIndex: decimal("dxy_index", { precision: 10, scale: 4 }),
  dxyBand: varchar("dxy_band", { length: 20 }), // 'weak'|'neutral'|'strong'
  us10YTreasury: decimal("us_10y_treasury", { precision: 8, scale: 4 }),
  yieldCurveSlope: varchar("yield_curve_slope", { length: 20 }), // 'normal'|'inverted'|'flat'
  tenMinusTwoBps: integer("ten_minus_two_bps"),

  // India macro indicators
  gsec10YYield: decimal("gsec_10y_yield", { precision: 8, scale: 4 }),
  indiaCpiInflation: decimal("india_cpi_inflation", { precision: 6, scale: 2 }),
  usdInr: decimal("usd_inr", { precision: 10, scale: 4 }),

  // Commodity
  brentCrudeUsd: decimal("brent_crude_usd", { precision: 10, scale: 4 }),
  crudeRegime: varchar("crude_regime", { length: 20 }), // 'comfort'|'elevated'|'crisis'

  // Composite regime label
  regimeLabel: varchar("regime_label", { length: 50 }), // 'risk_on'|'risk_off'|'stagflation'|'goldilocks'

  // GCR compliance
  source: varchar("source", { length: 20 }).default("gpe"), // gpe|manual|cron
  engineVersion: varchar("engine_version", { length: 20 }).default("GPE-v1.0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_macro_regime_date").on(table.snapshotDate),
  index("idx_macro_regime_label").on(table.regimeLabel),
  index("idx_macro_regime_created").on(table.createdAt),
]);

export type MacroRegimeSnapshot = typeof macroRegimeSnapshots.$inferSelect;
export type InsertMacroRegimeSnapshot = typeof macroRegimeSnapshots.$inferInsert;
export const insertMacroRegimeSnapshotSchema = createInsertSchema(macroRegimeSnapshots).omit({ id: true, createdAt: true });

// ── 7. asset_returns_history ─────────────────────────────────────────────────
// CRITICAL for MVO engine: stores pre-computed daily log-returns per ISIN.
// Populated nightly by asset-returns-backfill-service.ts (22:30 IST).
// Replaces the 14-day golden_prices scan in mvo-engine.enrichEmpiricalReturns()
// with a proper 3-year time series (252+ trading days) for covariance estimation.
// Includes MF NAVs mapped from mf_nav_history / historical_nav_data.
export const assetReturnsHistory = pgTable("asset_returns_history", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 50 }),
  assetClass: varchar("asset_class", { length: 30 }).notNull(), // equity|debt|gold|commodity|reit|international
  returnDate: date("return_date").notNull(),
  dailyReturn: decimal("daily_return", { precision: 12, scale: 8 }).notNull(), // ln(P_t/P_{t-1}) for log-return
  price: decimal("price", { precision: 20, scale: 6 }),
  previousPrice: decimal("previous_price", { precision: 20, scale: 6 }),
  source: varchar("source", { length: 50 }), // golden_prices|mf_nav_history|historical_nav_data
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("idx_asset_returns_isin_date").on(table.isin, table.returnDate),
  index("idx_asset_returns_date_desc").on(table.isin, table.returnDate),
  index("idx_asset_returns_asset_class").on(table.assetClass, table.returnDate),
]);

export type AssetReturnsHistory = typeof assetReturnsHistory.$inferSelect;
export type InsertAssetReturnsHistory = typeof assetReturnsHistory.$inferInsert;
export const insertAssetReturnsHistorySchema = createInsertSchema(assetReturnsHistory).omit({ id: true, createdAt: true });

// ── 8. benchmark_correlation_matrix ──────────────────────────────────────────
// Cached covariance/correlation matrix for MVO engine — recomputed weekly from
// asset_returns_history (252-day lookback). Prevents O(n²) recomputation on
// every MVO run; instead mvo-engine reads the latest valid row if < 7 days old.
export const benchmarkCorrelationMatrix = pgTable("benchmark_correlation_matrix", {
  id: serial("id").primaryKey(),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  lookbackDays: integer("lookback_days").notNull().default(252),
  matrixJson: jsonb("matrix_json").notNull(), // { "ISIN_A": { "ISIN_B": 0.72, ... }, ... }
  assetIsins: text("asset_isins").array(),    // ordered list of ISINs in the matrix
  validUntil: timestamp("valid_until"),       // computedAt + 7 days; mvo-engine checks this
  engineVersion: varchar("engine_version", { length: 30 }).default("MVO-v1.0"),
  source: varchar("source", { length: 20 }).default("cron"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_corr_matrix_computed").on(table.computedAt),
  index("idx_corr_matrix_valid_until").on(table.validUntil),
]);

export type BenchmarkCorrelationMatrix = typeof benchmarkCorrelationMatrix.$inferSelect;
export type InsertBenchmarkCorrelationMatrix = typeof benchmarkCorrelationMatrix.$inferInsert;
export const insertBenchmarkCorrelationMatrixSchema = createInsertSchema(benchmarkCorrelationMatrix).omit({ id: true, createdAt: true });

// ── 9. mcx_commodity_quotes ──────────────────────────────────────────────────
// Real-time & Historical MCX (Multi Commodity Exchange of India) futures quotes
export const mcxCommodityQuotes = pgTable("mcx_commodity_quotes", {
  id: serial("id").primaryKey(),
  commoditySymbol: varchar("commodity_symbol", { length: 50 }).notNull(), // 'GOLD', 'SILVER', 'CRUDE_OIL', 'NATURAL_GAS', 'COPPER'
  instrumentKey: varchar("instrument_key", { length: 50 }).notNull(), // e.g. 'MCX_FO|573422'
  tradingSymbol: varchar("trading_symbol", { length: 100 }).notNull(), // e.g. 'CRUDEOIL FUT 19 NOV 26'
  exchange: varchar("exchange", { length: 20 }).default("MCX").notNull(),
  expiryDate: varchar("expiry_date", { length: 30 }),
  price: decimal("price", { precision: 20, scale: 4 }).notNull(),
  openPrice: decimal("open_price", { precision: 20, scale: 4 }),
  highPrice: decimal("high_price", { precision: 20, scale: 4 }),
  lowPrice: decimal("low_price", { precision: 20, scale: 4 }),
  previousClose: decimal("previous_close", { precision: 20, scale: 4 }),
  change: decimal("change", { precision: 20, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 10, scale: 4 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  openInterest: decimal("open_interest", { precision: 20, scale: 0 }),
  unit: varchar("unit", { length: 30 }).default("INR"),
  lotSize: integer("lot_size"),
  source: varchar("source", { length: 50 }).default("UPSTOX").notNull(),
  cfdPriceUsd: decimal("cfd_price_usd", { precision: 15, scale: 4 }),
  cfdSource: varchar("cfd_source", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  metadata: jsonb("metadata"),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_mcx_commodity_symbol_instrument").on(table.commoditySymbol, table.instrumentKey),
  index("idx_mcx_quotes_symbol").on(table.commoditySymbol),
  index("idx_mcx_quotes_instrument_key").on(table.instrumentKey),
  index("idx_mcx_quotes_synced_at").on(table.syncedAt),
]);

export type McxCommodityQuote = typeof mcxCommodityQuotes.$inferSelect;
export type InsertMcxCommodityQuote = typeof mcxCommodityQuotes.$inferInsert;
export const insertMcxCommodityQuoteSchema = createInsertSchema(mcxCommodityQuotes).omit({ id: true, createdAt: true, updatedAt: true });
