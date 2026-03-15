import {
  pgSchema, serial, uuid, varchar, text, boolean, integer,
  timestamp, date, decimal, numeric, jsonb,
  index, uniqueIndex,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: This file is intentionally self-contained and does NOT import
// from ./schema.  Importing from schema.ts (33k lines) causes drizzle-kit to
// evaluate all table definitions in that file and try to manage thousands of
// tables it doesn't own — generating destructive DROP statements.
//
// All tables here live in the "drizzle_kit_managed" schema (not "public").
// drizzle.config.ts uses schemaFilter: ["drizzle_kit_managed"] so drizzle-kit
// ONLY introspects that isolated schema — it never sees the 755 tables or 85
// sequences in the public schema, eliminating all DROP SEQUENCE / DROP TABLE
// errors and the resulting "SERVER unexpectedly disconnected" in the Replit
// DB diff panel.
//
// Rule: every object declared here must mirror what is already in the DB.
//       drizzle-kit push will only manage tables listed below.
// ─────────────────────────────────────────────────────────────────────────────

export const dkManaged = pgSchema("drizzle_kit_managed");

export const agentNotifications = dkManaged.table("agent_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: varchar("agent_id", { length: 100 }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  type: varchar("type", { length: 30 }).notNull().default("prospect"),
  link: text("link"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_notifications_agent").on(table.agentId),
  index("idx_agent_notifications_created").on(table.createdAt),
]);

export const corporateActions = dkManaged.table("corporate_actions", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 50 }),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  exDate: date("ex_date").notNull(),
  recordDate: date("record_date"),
  payDate: date("pay_date"),
  ratio: varchar("ratio", { length: 30 }),
  adjustmentFactor: decimal("adjustment_factor", { precision: 15, scale: 8 }),
  dividendAmount: decimal("dividend_amount", { precision: 15, scale: 4 }),
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

export const priceAdjustments = dkManaged.table("price_adjustments", {
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

export const symbolMapping = dkManaged.table("symbol_mapping", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerSymbol: varchar("provider_symbol", { length: 100 }).notNull(),
  providerName: text("provider_name"),
  isPrimary: boolean("is_primary").default(false),
  isActive: boolean("is_active").default(true),
  lastVerifiedAt: timestamp("last_verified_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_symbol_mapping_isin").on(table.isin),
  index("idx_symbol_mapping_provider").on(table.provider),
  index("idx_symbol_mapping_symbol").on(table.providerSymbol),
  uniqueIndex("idx_symbol_mapping_isin_provider").on(table.isin, table.provider),
]);

export const creditRatings = dkManaged.table("credit_ratings", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  instrumentName: text("instrument_name"),
  rating: varchar("rating", { length: 20 }).notNull(),
  ratingOutlook: varchar("rating_outlook", { length: 30 }),
  agency: varchar("agency", { length: 30 }).notNull(),
  ratingDate: date("rating_date").notNull(),
  previousRating: varchar("previous_rating", { length: 20 }),
  ratingAction: varchar("rating_action", { length: 40 }),
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

export const instrumentReturns = dkManaged.table("instrument_returns", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 50 }),
  asOfDate: date("as_of_date").notNull(),
  assetClass: varchar("asset_class", { length: 30 }).notNull().default("equity"),
  currentPrice: decimal("current_price", { precision: 20, scale: 6 }),
  return1d: decimal("return_1d", { precision: 10, scale: 8 }),
  return1w: decimal("return_1w", { precision: 10, scale: 8 }),
  return1m: decimal("return_1m", { precision: 10, scale: 8 }),
  return3m: decimal("return_3m", { precision: 10, scale: 8 }),
  return6m: decimal("return_6m", { precision: 10, scale: 8 }),
  returnYtd: decimal("return_ytd", { precision: 10, scale: 8 }),
  return1y: decimal("return_1y", { precision: 10, scale: 8 }),
  return3y: decimal("return_3y", { precision: 10, scale: 8 }),
  return5y: decimal("return_5y", { precision: 10, scale: 8 }),
  price1dAgo: decimal("price_1d_ago", { precision: 20, scale: 6 }),
  price1wAgo: decimal("price_1w_ago", { precision: 20, scale: 6 }),
  price1mAgo: decimal("price_1m_ago", { precision: 20, scale: 6 }),
  price3mAgo: decimal("price_3m_ago", { precision: 20, scale: 6 }),
  price6mAgo: decimal("price_6m_ago", { precision: 20, scale: 6 }),
  price1yAgo: decimal("price_1y_ago", { precision: 20, scale: 6 }),
  absChange1d: decimal("abs_change_1d", { precision: 20, scale: 6 }),
  computedAt: timestamp("computed_at").defaultNow().notNull(),
}, (table) => [
  index("idx_instr_ret_isin").on(table.isin),
  index("idx_instr_ret_date").on(table.asOfDate),
]);
