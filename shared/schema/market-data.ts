import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal, date, numeric, bigint, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const marketData = pgTable("market_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  price: decimal("price", { precision: 15, scale: 4 }),
  change: decimal("change", { precision: 15, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 8, scale: 4 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 0 }),
  currency: varchar("currency").default("INR"),
  data: jsonb("data"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const marketDataSnapshots = pgTable("market_data_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assetType: varchar("asset_type", { length: 50 }).notNull(),
  assetId: varchar("asset_id", { length: 100 }).notNull(),
  assetName: varchar("asset_name", { length: 255 }),
  exchange: varchar("exchange", { length: 20 }),
  currentPrice: numeric("current_price", { precision: 18, scale: 4 }),
  previousClose: numeric("previous_close", { precision: 18, scale: 4 }),
  dayHigh: numeric("day_high", { precision: 18, scale: 4 }),
  dayLow: numeric("day_low", { precision: 18, scale: 4 }),
  weekHigh52: numeric("week_high_52", { precision: 18, scale: 4 }),
  weekLow52: numeric("week_low_52", { precision: 18, scale: 4 }),
  nav: numeric("nav", { precision: 18, scale: 4 }),
  return1D: numeric("return_1d", { precision: 8, scale: 4 }),
  return1W: numeric("return_1w", { precision: 8, scale: 4 }),
  return1M: numeric("return_1m", { precision: 8, scale: 4 }),
  return3M: numeric("return_3m", { precision: 8, scale: 4 }),
  return6M: numeric("return_6m", { precision: 8, scale: 4 }),
  return1Y: numeric("return_1y", { precision: 8, scale: 4 }),
  return3Y: numeric("return_3y", { precision: 8, scale: 4 }),
  return5Y: numeric("return_5y", { precision: 8, scale: 4 }),
  returnSI: numeric("return_si", { precision: 8, scale: 4 }),
  volume: bigint("volume", { mode: "number" }),
  aum: numeric("aum", { precision: 18, scale: 2 }),
  yieldToMaturity: numeric("yield_to_maturity", { precision: 8, scale: 4 }),
  couponRate: numeric("coupon_rate", { precision: 8, scale: 4 }),
  dataSource: varchar("data_source", { length: 50 }),
  snapshotDate: date("snapshot_date").notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isStale: boolean("is_stale").default(false),
  rawData: jsonb("raw_data"),
}, (table) => [
  index("idx_mds_asset_type").on(table.assetType),
  index("idx_mds_asset_id").on(table.assetId),
  index("idx_mds_snapshot_date").on(table.snapshotDate),
  index("idx_mds_expires").on(table.expiresAt),
  uniqueIndex("idx_mds_asset_unique").on(table.assetType, table.assetId, table.snapshotDate),
]);

export const marketDataCache = pgTable("market_data_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol", { length: 50 }).notNull(),
  exchange: varchar("exchange", { length: 20 }),
  dataType: varchar("data_type", { length: 30 }).notNull(),
  lastPrice: numeric("last_price"),
  previousClose: numeric("previous_close"),
  open: numeric("open"),
  high: numeric("high"),
  low: numeric("low"),
  volume: bigint("volume", { mode: "number" }),
  change: numeric("change"),
  changePercent: numeric("change_percent"),
  
  // Enrichment Data Caching
  marketCap: numeric("market_cap"),
  beta: numeric("beta"),
  dividendYield: numeric("dividend_yield"),
  peRatio: numeric("pe_ratio"),
  
  additionalData: jsonb("additional_data").default({}),
  provider: varchar("provider", { length: 50 }).notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mdc_symbol_type").on(table.symbol, table.dataType),
  index("idx_mdc_expires").on(table.expiresAt),
  index("idx_mdc_provider").on(table.provider),
]);

// Zod Schemas
export const insertMarketDataSchema = createInsertSchema(marketData).extend({
  id: z.any(),
  lastUpdated: z.any(),
}).omit({
  id: true,
  lastUpdated: true,
});

export const insertMarketDataSnapshotSchema = createInsertSchema(marketDataSnapshots).extend({
  id: z.any(),
  fetchedAt: z.any(),
}).omit({
  id: true,
  fetchedAt: true,
});

export const insertMarketDataCacheSchema = createInsertSchema(marketDataCache).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

// Types
export type MarketData = typeof marketData.$inferSelect;
export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;
export type MarketDataSnapshot = typeof marketDataSnapshots.$inferSelect;
export type InsertMarketDataSnapshot = z.infer<typeof insertMarketDataSnapshotSchema>;
export type MarketDataCache = typeof marketDataCache.$inferSelect;
export type InsertMarketDataCache = z.infer<typeof insertMarketDataCacheSchema>;
