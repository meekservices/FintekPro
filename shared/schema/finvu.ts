import { sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, jsonb, integer, numeric, text, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";

/**
 * Account Aggregator (AA) Consent Artefacts
 * Tracks ReBIT AA consent requests, state transitions, and signed consent artefacts
 */
export const aaConsents = pgTable("aa_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  consentHandle: varchar("consent_handle").notNull().unique(),
  consentId: varchar("consent_id"), // ReBIT consentId assigned by Finvu after customer approves
  provider: varchar("provider", { length: 32 }).notNull().default("finvu"), // "finvu" | "setu" | "onemoney"
  status: varchar("status", { length: 32 }).notNull().default("PENDING"), // PENDING, ACTIVE, REJECTED, REVOKED, EXPIRED, PAUSED
  consentMode: varchar("consent_mode", { length: 16 }).notNull().default("STORE"), // STORE | VIEW
  fetchType: varchar("fetch_type", { length: 16 }).notNull().default("PERIODIC"), // ONETIME | PERIODIC
  fiTypes: jsonb("fi_types").notNull().$type<string[]>(), // ["DEPOSIT", "TERM_DEPOSIT", "MUTUAL_FUNDS", "EQUITIES"]
  dateRangeFrom: timestamp("date_range_from").notNull(),
  dateRangeTo: timestamp("date_range_to").notNull(),
  consentExpiry: timestamp("consent_expiry").notNull(),
  redirectUrl: text("redirect_url"),
  consentArtefact: jsonb("consent_artefact"), // Signed ReBIT Consent JSON
  errorDetails: jsonb("error_details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_aa_consents_user_id").on(table.userId),
  index("idx_aa_consents_handle").on(table.consentHandle),
  index("idx_aa_consents_status").on(table.status),
]);

export const insertAaConsentSchema = createInsertSchema(aaConsents);
export type AaConsent = typeof aaConsents.$inferSelect;
export type InsertAaConsent = z.infer<typeof insertAaConsentSchema>;

/**
 * AA Financial Information (FI) Data Sessions
 * Manages Curve25519 ephemeral keypair exchange and encrypted data sessions with Finvu
 */
export const aaFiSessions = pgTable("aa_fi_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consentId: varchar("consent_id").notNull().references(() => aaConsents.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  sessionId: varchar("session_id"), // Finvu FI Data Session ID
  status: varchar("status", { length: 32 }).notNull().default("REQUESTED"), // REQUESTED, PROCESSING, COMPLETED, FAILED
  fiuPublicKey: text("fiu_public_key").notNull(), // Curve25519 public key sent to Finvu
  fiuPrivateKeyEncrypted: text("fiu_private_key_encrypted").notNull(), // Ephemeral private key encrypted at rest
  fiuNonce: text("fiu_nonce").notNull(), // Cryptographically random nonce
  fipPublicKey: text("fip_public_key"), // FIP Public key returned by Finvu
  fipNonce: text("fip_nonce"), // FIP Nonce returned by Finvu
  recordsFetched: integer("records_fetched").default(0),
  error: text("error"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_aa_fi_sessions_user_id").on(table.userId),
  index("idx_aa_fi_sessions_consent_id").on(table.consentId),
  index("idx_aa_fi_sessions_session_id").on(table.sessionId),
]);

export const insertAaFiSessionSchema = createInsertSchema(aaFiSessions);
export type AaFiSession = typeof aaFiSessions.$inferSelect;
export type InsertAaFiSession = z.infer<typeof insertAaFiSessionSchema>;

/**
 * AA Financial Profiles (Aggregated Bank Accounts, Deposits & Mutual Funds)
 * Stores normalized accounts obtained via Account Aggregator
 */
export const aaFinancialProfiles = pgTable("aa_financial_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  consentId: varchar("consent_id").notNull().references(() => aaConsents.id),
  fipId: varchar("fip_id", { length: 64 }).notNull(), // e.g., "HDFC-FIP", "SBIN-FIP", "CAMS-FIP"
  fipName: varchar("fip_name", { length: 128 }),
  accountType: varchar("account_type", { length: 32 }).notNull(), // SAVINGS, CURRENT, TERM_DEPOSIT, MUTUAL_FUNDS, EQUITIES
  maskedAccountNumber: varchar("masked_account_number", { length: 64 }).notNull(),
  linkRefNumber: varchar("link_ref_number", { length: 128 }).notNull(),
  currentBalance: numeric("current_balance", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 8 }).notNull().default("INR"),
  holdingSummary: jsonb("holding_summary"), // Normalized holdings or account details
  lastSyncedAt: timestamp("last_synced_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_aa_fin_profiles_user_id").on(table.userId),
  index("idx_aa_fin_profiles_fip_id").on(table.fipId),
]);

export const insertAaFinancialProfileSchema = createInsertSchema(aaFinancialProfiles);
export type AaFinancialProfile = typeof aaFinancialProfiles.$inferSelect;
export type InsertAaFinancialProfile = z.infer<typeof insertAaFinancialProfileSchema>;

/**
 * AA Bank Transactions
 * Normalized transactions for bank statements ingested via Finvu
 */
export const aaTransactions = pgTable("aa_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: varchar("profile_id").notNull().references(() => aaFinancialProfiles.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  txnId: varchar("txn_id", { length: 128 }),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  type: varchar("type", { length: 16 }).notNull(), // DEBIT | CREDIT
  mode: varchar("mode", { length: 32 }), // UPI, NEFT, RTGS, IMPS, POS, ATM, OTHERS
  narration: text("narration"),
  balanceAfterTxn: numeric("balance_after_txn", { precision: 15, scale: 2 }),
  txnDate: timestamp("txn_date").notNull(),
  category: varchar("category", { length: 64 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_aa_txns_profile_id").on(table.profileId),
  index("idx_aa_txns_user_id").on(table.userId),
  index("idx_aa_txns_date").on(table.txnDate),
]);

export const insertAaTransactionSchema = createInsertSchema(aaTransactions);
export type AaTransaction = typeof aaTransactions.$inferSelect;
export type InsertAaTransaction = z.infer<typeof insertAaTransactionSchema>;
