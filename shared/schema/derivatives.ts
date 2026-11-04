import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  numeric,
  integer,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FintekPro Derivative Contracts & F&O Positions Schema
 * Architecture: GCR v1.0 + FASP-AI v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Derivative Contracts Table (Instrument Master for F&O)
 * Stores exchange-tradable Futures and Options contracts for NSE_FO, BSE_FO, and MCX.
 */
export const derivativeContracts = pgTable(
  "derivative_contracts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    instrumentKey: varchar("instrument_key", { length: 100 }).notNull(), // e.g. "NSE_FO|52433"
    exchange: varchar("exchange", { length: 20 }).notNull().default("NSE_FO"), // "NSE_FO" | "BSE_FO" | "MCX_FO"
    exchangeToken: varchar("exchange_token", { length: 50 }), // e.g. "52433"
    tradingsymbol: varchar("tradingsymbol", { length: 100 }).notNull(), // e.g. "NIFTY26MAR24000CE"
    name: varchar("name", { length: 100 }).notNull(), // e.g. "NIFTY"
    underlyingKey: varchar("underlying_key", { length: 100 }), // e.g. "NSE_INDEX|Nifty 50"
    underlyingSymbol: varchar("underlying_symbol", { length: 50 }).notNull(), // e.g. "NIFTY", "RELIANCE"
    instrumentType: varchar("instrument_type", { length: 30 }).notNull(), // "OPTIDX" | "OPTSTK" | "FUTIDX" | "FUTSTK"
    strikePrice: numeric("strike_price", { precision: 15, scale: 4 }), // null for futures
    optionType: varchar("option_type", { length: 10 }), // "CE" | "PE" | null
    expiryDate: date("expiry_date").notNull(),
    lotSize: integer("lot_size").notNull().default(1),
    tickSize: numeric("tick_size", { precision: 10, scale: 4 }).default("0.05"),
    isActive: boolean("is_active").default(true).notNull(),
    metadata: jsonb("metadata").default({}),
    source: varchar("source", { length: 50 }).default("upstox").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_dc_instrument_key_unique").on(table.instrumentKey),
    index("idx_dc_underlying_expiry").on(table.underlyingSymbol, table.expiryDate),
    index("idx_dc_tradingsymbol").on(table.tradingsymbol),
    index("idx_dc_instrument_type").on(table.instrumentType),
    index("idx_dc_expiry").on(table.expiryDate),
  ]
);

export const insertDerivativeContractSchema = createInsertSchema(derivativeContracts).extend({
  id: z.any().optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export type DerivativeContract = typeof derivativeContracts.$inferSelect;
export type InsertDerivativeContract = z.infer<typeof insertDerivativeContractSchema>;

/**
 * Derivative Positions Table
 * User/Account active and historical derivative positions.
 */
export const derivativePositions = pgTable(
  "derivative_positions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id", { length: 50 }).notNull(),
    instrumentKey: varchar("instrument_key", { length: 100 }).notNull(),
    tradingsymbol: varchar("tradingsymbol", { length: 100 }).notNull(),
    underlyingSymbol: varchar("underlying_symbol", { length: 50 }).notNull(),
    exchange: varchar("exchange", { length: 20 }).default("NSE_FO").notNull(),
    product: varchar("product", { length: 10 }).default("I").notNull(), // 'I' (Intraday/MIS) | 'D' (Normal/NRML)
    side: varchar("side", { length: 10 }).notNull(), // 'BUY' | 'SELL'
    quantity: integer("quantity").notNull(),
    averagePrice: numeric("average_price", { precision: 15, scale: 4 }).notNull(),
    currentPrice: numeric("current_price", { precision: 15, scale: 4 }),
    unrealizedPnl: numeric("unrealized_pnl", { precision: 15, scale: 4 }),
    realizedPnl: numeric("realized_pnl", { precision: 15, scale: 4 }),
    status: varchar("status", { length: 30 }).default("OPEN").notNull(), // 'OPEN' | 'CLOSED' | 'EXPIRED'
    idempotencyKey: varchar("idempotency_key", { length: 100 }),
    source: varchar("source", { length: 50 }).default("upstox").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_dp_user_status").on(table.userId, table.status),
    index("idx_dp_instrument_key").on(table.instrumentKey),
    index("idx_dp_created_at").on(table.createdAt),
  ]
);

export const insertDerivativePositionSchema = createInsertSchema(derivativePositions).extend({
  id: z.any().optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});

export type DerivativePosition = typeof derivativePositions.$inferSelect;
export type InsertDerivativePosition = z.infer<typeof insertDerivativePositionSchema>;

