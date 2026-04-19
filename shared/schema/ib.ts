import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal } from "drizzle-orm/pg-core";
import { users } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ibAccounts = pgTable("ib_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  accountName: varchar("account_name").notNull(),
  accountNumber: varchar("account_number").notNull(),
  isPaperTrading: boolean("is_paper_trading").default(true),
  host: varchar("host").default("127.0.0.1"),
  port: integer("port").default(7497),
  clientId: integer("client_id").default(1),
  isActive: boolean("is_active").default(true),
  connectionStatus: varchar("connection_status").default("disconnected"),
  lastConnected: timestamp("last_connected"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ibOrders = pgTable("ib_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  ibAccountId: varchar("ib_account_id").references(() => ibAccounts.id).notNull(),
  orderId: integer("order_id").notNull(),
  clientId: integer("client_id").notNull(),
  symbol: varchar("symbol").notNull(),
  action: varchar("action").notNull(),
  orderType: varchar("order_type").notNull(),
  totalQuantity: decimal("total_quantity", { precision: 15, scale: 4 }).notNull(),
  limitPrice: decimal("limit_price", { precision: 15, scale: 4 }),
  stopPrice: decimal("stop_price", { precision: 15, scale: 4 }),
  status: varchar("status").notNull(),
  filled: decimal("filled", { precision: 15, scale: 4 }).default("0"),
  remaining: decimal("remaining", { precision: 15, scale: 4 }),
  avgFillPrice: decimal("avg_fill_price", { precision: 15, scale: 4 }).default("0"),
  commission: decimal("commission", { precision: 15, scale: 4 }),
  whyHeld: varchar("why_held"),
  orderData: jsonb("order_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ibPositions = pgTable("ib_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  ibAccountId: varchar("ib_account_id").references(() => ibAccounts.id).notNull(),
  account: varchar("account").notNull(),
  symbol: varchar("symbol").notNull(),
  position: decimal("position", { precision: 15, scale: 4 }).notNull(),
  marketPrice: decimal("market_price", { precision: 15, scale: 4 }),
  marketValue: decimal("market_value", { precision: 15, scale: 2 }),
  averageCost: decimal("average_cost", { precision: 15, scale: 4 }),
  unrealizedPNL: decimal("unrealized_pnl", { precision: 15, scale: 2 }),
  realizedPNL: decimal("realized_pnl", { precision: 15, scale: 2 }),
  positionData: jsonb("position_data"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ibAccountSummary = pgTable("ib_account_summary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  ibAccountId: varchar("ib_account_id").references(() => ibAccounts.id).notNull(),
  account: varchar("account").notNull(),
  tag: varchar("tag").notNull(),
  value: varchar("value").notNull(),
  currency: varchar("currency").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ibMarketDataSubscriptions = pgTable("ib_market_data_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  ibAccountId: varchar("ib_account_id").references(() => ibAccounts.id).notNull(),
  symbol: varchar("symbol").notNull(),
  tickerId: integer("ticker_id").notNull(),
  isActive: boolean("is_active").default(true),
  lastPrice: decimal("last_price", { precision: 15, scale: 4 }),
  bid: decimal("bid", { precision: 15, scale: 4 }),
  ask: decimal("ask", { precision: 15, scale: 4 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  marketDataSnapshot: jsonb("market_data_snapshot"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ibTradingSessions = pgTable("ib_trading_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  ibAccountId: varchar("ib_account_id").references(() => ibAccounts.id).notNull(),
  sessionStart: timestamp("session_start").notNull(),
  sessionEnd: timestamp("session_end"),
  connectionDuration: integer("connection_duration"),
  ordersPlaced: integer("orders_placed").default(0),
  ordersFilled: integer("orders_filled").default(0),
  ordersCancelled: integer("orders_cancelled").default(0),
  totalPNL: decimal("total_pnl", { precision: 15, scale: 2 }),
  status: varchar("status").default("active"),
  disconnectReason: varchar("disconnect_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod Schemas
export const insertIBAccountSchema = createInsertSchema(ibAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertIBOrderSchema = createInsertSchema(ibOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertIBPositionSchema = createInsertSchema(ibPositions).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});
export const insertIBAccountSummarySchema = createInsertSchema(ibAccountSummary).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});
export const insertIBMarketDataSubscriptionSchema = createInsertSchema(ibMarketDataSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertIBTradingSessionSchema = createInsertSchema(ibTradingSessions).omit({
  id: true,
  createdAt: true,
});

// Types
export type IBAccount = typeof ibAccounts.$inferSelect;
export type InsertIBAccount = z.infer<typeof insertIBAccountSchema>;
export type IBOrder = typeof ibOrders.$inferSelect;
export type InsertIBOrder = z.infer<typeof insertIBOrderSchema>;
export type IBPosition = typeof ibPositions.$inferSelect;
export type InsertIBPosition = z.infer<typeof insertIBPositionSchema>;
export type IBAccountSummary = typeof ibAccountSummary.$inferSelect;
export type InsertIBAccountSummary = z.infer<typeof insertIBAccountSummarySchema>;
export type IBMarketDataSubscription = typeof ibMarketDataSubscriptions.$inferSelect;
export type InsertIBMarketDataSubscription = z.infer<typeof insertIBMarketDataSubscriptionSchema>;
export type IBTradingSession = typeof ibTradingSessions.$inferSelect;
export type InsertIBTradingSession = z.infer<typeof insertIBTradingSessionSchema>;
