import { pgTable, varchar, decimal, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

export const alpacaCommissionConfigs = pgTable("alpaca_commission_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountType: varchar("account_type").notNull(), // 'individual', 'omnibus', 'custodial'
  assetClass: varchar("asset_class").notNull(), // 'us_equity', 'crypto', 'options'
  commissionRate: decimal("commission_rate", { precision: 10, scale: 4 }).notNull(), // percentage or fixed
  commissionType: varchar("commission_type").default("percentage"), // 'percentage', 'fixed'
  minCommission: decimal("min_commission", { precision: 10, scale: 2 }).default("0.00"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const alpacaRebalancingSettings = pgTable("alpaca_rebalancing_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").notNull(),
  driftThreshold: decimal("drift_threshold", { precision: 5, scale: 2 }).default("5.00"), // 5% drift triggers rebalance
  autoRebalance: boolean("auto_rebalance").default(false),
  lastRebalancedAt: timestamp("last_rebalanced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAlpacaCommissionConfigSchema = createInsertSchema(alpacaCommissionConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAlpacaRebalancingSettingsSchema = createInsertSchema(alpacaRebalancingSettings).omit({ id: true, createdAt: true, updatedAt: true });
