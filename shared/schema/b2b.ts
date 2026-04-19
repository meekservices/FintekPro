import { pgTable, varchar, timestamp, jsonb, boolean, index, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Fundamental B2B Client Registration Table
export const b2bClients = pgTable("b2b_clients", {
  id: varchar("id", { length: 255 }).primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }).notNull(),
  webhookUrl: varchar("webhook_url", { length: 500 }), // The callback domain for async heavy-compute responses
  webhookSecret: varchar("webhook_secret", { length: 255 }), // HMAC signature validation strictly required for payload verification
  allowedIps: jsonb("allowed_ips"), // Array of whitelisted IPv4/IPv6 strings mapping to their exact servers
  isActive: boolean("is_active").default(true),
  tier: varchar("tier", { length: 50 }).default('standard'), // standard, enterprise
  governanceMode: varchar("governance_mode", { length: 50 }).default('STRICT'), // STRICT | DELEGATED
  createdAt: timestamp("created_at").defaultNow(),
});

export type B2bClient = typeof b2bClients.$inferSelect;
export const insertB2bClientSchema = createInsertSchema(b2bClients);

// API Keys abstraction mapped directly to the active B2B Client 
export const b2bApiKeys = pgTable("b2b_api_keys", {
  id: varchar("id", { length: 255 }).primaryKey(),
  clientId: varchar("client_id", { length: 255 }).notNull().references(() => b2bClients.id),
  keyHash: varchar("key_hash", { length: 500 }).notNull(), // Strictly bcrypted or sha-256 hashed matching exactly to their provided secret
  name: varchar("name", { length: 150 }), // e.g. "Prod Server 1"
  permissions: jsonb("permissions").notNull(), // ['advisory:read', 'advisory:write', 'simulation:run']
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_b2b_key_hash").on(table.keyHash),
  index("idx_b2b_key_client").on(table.clientId),
]);

export type B2bApiKey = typeof b2bApiKeys.$inferSelect;
export const insertB2bApiKeySchema = createInsertSchema(b2bApiKeys);

export const b2bApiUsageLogs = pgTable("b2b_api_usage_logs", {
  id: varchar("id", { length: 255 }).primaryKey(),
  clientId: varchar("client_id", { length: 255 }).notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  status: integer("status").notNull(),
  executionTimeMs: integer("execution_time_ms"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_b2b_usage_client").on(table.clientId),
]);
