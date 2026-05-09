import { pgTable, serial, text, timestamp, boolean, decimal, integer, jsonb, date } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const treasuryAccounts = pgTable("treasury_accounts", {
  id: serial("id").primaryKey(),
  entityId: text("entity_id").notNull(),
  bankName: text("bank_name").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull().unique(),
  ifscCode: text("ifsc_code").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const treasuryPositions = pgTable("treasury_positions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => treasuryAccounts.id).unique(),
  ledgerBalance: decimal("ledger_balance", { precision: 18, scale: 2 }).notNull().default("0.00"),
  availableBalance: decimal("available_balance", { precision: 18, scale: 2 }).notNull().default("0.00"),
  currency: text("currency").notNull().default("INR"),
  lastSyncedAt: timestamp("last_synced_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const liquiditySnapshots = pgTable("liquidity_snapshots", {
  id: serial("id").primaryKey(),
  entityId: text("entity_id").notNull(),
  totalLiquidity: decimal("total_liquidity", { precision: 18, scale: 2 }).notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  breakdown: jsonb("breakdown"),
  createdAt: timestamp("created_at").defaultNow(),
});
