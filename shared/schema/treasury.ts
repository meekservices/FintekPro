import { pgTable, varchar, decimal, timestamp, jsonb, boolean, index, uniqueIndex, integer, date, bigint, numeric, pgEnum, serial, uuid, text, sql } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";

// Treasury Account Types
export const treasuryAccountTypeEnum = pgEnum("treasury_account_type", [
  "current",
  "savings",
  "escrow",
  "virtual",
  "investment",
  "debt",
  "collection",
  "disbursement"
]);

// Treasury Entity Types
export const treasuryEntityTypeEnum = pgEnum("treasury_entity_type", [
  "parent",
  "subsidiary",
  "joint_venture",
  "branch",
  "associate"
]);

// Treasury Entities (Corporate Structure)
export const treasuryEntities = pgTable("treasury_entities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  type: treasuryEntityTypeEnum("type").notNull().default("subsidiary"),
  parentId: varchar("parent_id").references((): any => treasuryEntities.id),
  registrationNumber: varchar("registration_number"), // CIN, etc.
  taxId: varchar("tax_id"), // PAN/GSTIN
  country: varchar("country").default("IN"),
  currency: varchar("currency").default("INR"),
  metadata: jsonb("metadata").default({}),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Treasury Accounts (Multi-bank Accounts)
export const treasuryAccounts = pgTable("treasury_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").references(() => treasuryEntities.id).notNull(),
  accountName: varchar("account_name").notNull(),
  accountNumber: varchar("account_number").notNull(),
  ifscCode: varchar("ifsc_code").notNull(),
  bankName: varchar("bank_name").notNull(),
  branchName: varchar("branch_name"),
  accountType: treasuryAccountTypeEnum("account_type").notNull().default("current"),
  currency: varchar("currency").default("INR"),
  provider: varchar("provider"), // RazorpayX, Cashfree, Decentro, etc.
  providerAccountId: varchar("provider_account_id"),
  isVirtual: boolean("is_virtual").default(false),
  status: varchar("status").default("active"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  accNumIdx: uniqueIndex("idx_treasury_acc_num").on(table.accountNumber),
  entityIdx: index("idx_treasury_acc_entity").on(table.entityId),
}));

// Treasury Positions (Real-time balances)
export const treasuryPositions = pgTable("treasury_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").references(() => treasuryAccounts.id).notNull(),
  ledgerBalance: numeric("ledger_balance", { precision: 20, scale: 2 }).notNull().default("0"),
  availableBalance: numeric("available_balance", { precision: 20, scale: 2 }).notNull().default("0"),
  blockedBalance: numeric("blocked_balance", { precision: 20, scale: 2 }).notNull().default("0"),
  currency: varchar("currency").default("INR"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  accIdx: uniqueIndex("idx_treasury_pos_acc").on(table.accountId),
}));

// Liquidity Snapshots (Historical positioning)
export const liquiditySnapshots = pgTable("liquidity_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").references(() => treasuryEntities.id).notNull(),
  totalLiquidity: numeric("total_liquidity", { precision: 20, scale: 2 }).notNull(),
  currency: varchar("currency").default("INR"),
  snapshotDate: date("snapshot_date").notNull(),
  breakdown: jsonb("breakdown").notNull(), // { bankBalances: [], investments: [], debt: [] }
  createdAt: timestamp("created_at").defaultNow(),
});

// Treasury Cash Flows (Actual and Forecasted)
export const cashFlows = pgTable("cash_flows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entityId: varchar("entity_id").references(() => treasuryEntities.id).notNull(),
  accountId: varchar("account_id").references(() => treasuryAccounts.id),
  type: varchar("type").notNull(), // inflow, outflow
  category: varchar("category").notNull(), // operations, investment, financing, payroll, tax, etc.
  amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
  currency: varchar("currency").default("INR"),
  description: text("description"),
  transactionDate: date("transaction_date").notNull(),
  isForecast: boolean("is_forecast").default(false),
  confidenceScore: numeric("confidence_score", { precision: 3, scale: 2 }),
  sourceSystem: varchar("source_system"), // ERP, Manual, Bank, AI
  status: varchar("status").default("pending"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  entityDateIdx: index("idx_cash_flow_entity_date").on(table.entityId, table.transactionDate),
}));


export const insertTreasuryEntitySchema = createInsertSchema(treasuryEntities);
export const insertTreasuryAccountSchema = createInsertSchema(treasuryAccounts);
export const insertTreasuryPositionSchema = createInsertSchema(treasuryPositions);
export const insertLiquiditySnapshotSchema = createInsertSchema(liquiditySnapshots);
export const insertCashFlowSchema = createInsertSchema(cashFlows);

export type TreasuryEntity = typeof treasuryEntities.$inferSelect;
export type TreasuryAccount = typeof treasuryAccounts.$inferSelect;
export type TreasuryPosition = typeof treasuryPositions.$inferSelect;
export type LiquiditySnapshot = typeof liquiditySnapshots.$inferSelect;
export type CashFlow = typeof cashFlows.$inferSelect;
