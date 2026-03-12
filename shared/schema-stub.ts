import { pgTable, serial, varchar, timestamp, date, decimal, index } from "drizzle-orm/pg-core";

// These tables exist in the production DB but were added to schema.ts after the
// last drizzle migration file was generated. Re-exporting them here tells
// drizzle-kit NOT to drop them during deployment schema-sync.
export {
  agentNotifications,
  corporateActions,
  priceAdjustments,
  symbolMapping,
  creditRatings,
} from "./schema";

// instrument_returns is created at runtime by the Golden Pricing Engine via raw SQL
// (server/db-migrations/golden-pricing-migration.ts). This stub definition mirrors
// that raw SQL exactly so drizzle-kit treats the table as known and does not drop it.
export const instrumentReturns = pgTable("instrument_returns", {
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
