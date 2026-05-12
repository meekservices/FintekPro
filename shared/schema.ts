import { pgTable, text, serial, integer, timestamp, boolean, decimal, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { users } from "./schema/users";

// --- Admin Tables ---

export const adminSettings = pgTable("admin_settings", {
  id: varchar("id").primaryKey().default(sql gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const adminApprovalRequests = pgTable("admin_approval_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type").notNull(), // 'agent_application', 'commission_payout', 'limit_increase'
  entityId: varchar("entity_id").notNull(),
  requesterId: varchar("requester_id").references(() => users.id),
  status: varchar("status").default("pending"), // 'pending', 'approved', 'rejected'
  data: jsonb("data"),
  adminNotes: text("admin_notes"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- CA Registry & Platform Config ---

export const fintekproCaRegistry = pgTable("fintekpro_ca_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // ── Core Identity ──────────────────────────────────────────────────────────
  icaiMembershipNumber: varchar("icai_membership_number", { length: 20 }).notNull().unique(),
  firmName: varchar("firm_name", { length: 200 }),
  partnersTableId: varchar("partners_table_id"), // Reference if linked to partners table
  
  // ── Contact & Location ─────────────────────────────────────────────────────
  email: varchar("email", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  
  // ── Professional Details ───────────────────────────────────────────────────
  tier: varchar("tier", { length: 20 }).default("bronze"), // bronze | silver | gold | platinum
  specializations: jsonb("specializations"), // Array of strings: ["taxation", "audit", "wealth_mgmt"]
  yearsOfPractice: integer("years_of_practice"),
  referralCode: varchar("referral_code", { length: 50 }).unique(),
  
  // ── Verification Audit ────────────────────────────────────────────────────
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by", { length: 50 }),           // surepass | karza | icai_scraper | admin | self
  confidenceScore: decimal("confidence_score", { precision: 4, scale: 2 }), // 0.00–1.00
  verificationSource: varchar("verification_source", { length: 50 }), // duplicates verifiedBy for clarity
  rawVerificationResponse: jsonb("raw_verification_response"),   // Sanitised API response stored for audit

  // ── Annual Revalidation ───────────────────────────────────────────────────
  lastRevalidatedAt: timestamp("last_revalidated_at"),
  nextRevalidationDue: timestamp("next_revalidation_due"),       // Cron checks this; 12 months after lastRevalidatedAt
  revalidationFailureCount: integer("revalidation_failure_count").default(0),
  revalidationStatus: varchar("revalidation_status", { length: 20 }).default("ok"), // ok | due | failed | suspended

  // ── Source Tracking ───────────────────────────────────────────────────────
  source: varchar("source", { length: 30 }).default("self_registered"), // self_registered | admin_seeded | auto_cache
  isPubliclyListed: boolean("is_publicly_listed").default(false), // Show in CA discovery marketplace
  listedAt: timestamp("listed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ca_registry_icai").on(table.icaiMembershipNumber),
  index("idx_ca_registry_partner").on(table.partnersTableId),
  index("idx_ca_registry_user").on(table.userId),
  index("idx_ca_registry_city_state").on(table.city, table.state),
  index("idx_ca_registry_tier").on(table.tier),
  index("idx_ca_registry_revalidation").on(table.nextRevalidationDue),
  index("idx_ca_registry_referral").on(table.referralCode),
]);

export type FintekproCaRegistry = typeof fintekproCaRegistry.$inferSelect;
export const insertFintekproCaRegistrySchema = createInsertSchema(fintekproCaRegistry).omit({
  id: true, createdAt: true, updatedAt: true,
});

// ─── Platform Global Configuration ───────────────────────────────────────────
export const platformConfig = pgTable("platform_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caPlatformFeePct: decimal("ca_platform_fee_pct", { precision: 5, scale: 2 }).default("10.00"),
  caReferralBonusPct: decimal("ca_referral_bonus_pct", { precision: 5, scale: 2 }).default("5.00"),
  defaultCommissionStrategy: varchar("default_commission_strategy", { length: 50 }).default("standard_waterfall"),
  autoApproveCommissionsBelow: decimal("auto_approve_commissions_below", { precision: 12, scale: 2 }).default("500.00"),
  isCaMarketplaceActive: boolean("is_ca_marketplace_active").default(true),
  enableAiAlphaRecommendations: boolean("enable_ai_alpha_recommendations").default(true),
  enforceStrictSuitability: boolean("enforce_strict_suitability").default(false),
  irisPartnerCode: varchar("iris_partner_code", { length: 50 }).default("FINTEKPRO"),
  alpacaReferrerCode: varchar("alpaca_referrer_code", { length: 50 }).default("fintekpro_app"),
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PlatformConfig = typeof platformConfig.$inferSelect;
export const insertPlatformConfigSchema = createInsertSchema(platformConfig).omit({
  id: true, createdAt: true, updatedAt: true,
});

// ─── Regulatory Audit Packs ──────────────────────────────────────────────────
export const regulatoryAuditPacks = pgTable("regulatory_audit_packs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  packType: varchar("pack_type").notNull(),
  transactionId: varchar("transaction_id"),
  kycSnapshot: jsonb("kyc_snapshot").notNull(),
  suitabilitySnapshot: jsonb("suitability_snapshot").notNull(),
  orderSnapshot: jsonb("order_snapshot"),
  platformConfigSnapshot: jsonb("platform_config_snapshot"),
  auditHash: text("audit_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audit_pack_user").on(table.userId),
  index("idx_audit_pack_type").on(table.packType),
  index("idx_audit_pack_tx").on(table.transactionId),
]);

export const insertRegulatoryAuditPackSchema = createInsertSchema(regulatoryAuditPacks).omit({
  id: true, createdAt: true,
});
export type RegulatoryAuditPack = typeof regulatoryAuditPacks.$inferSelect;
export type InsertRegulatoryAuditPack = z.infer<typeof insertRegulatoryAuditPackSchema>;

// Auto-added domain exports
export * from "./schema/agents";
export * from "./schema/clients";
export * from "./schema/partners";
export * from "./schema/zoho";
export * from "./schema/proposals";
export * from "./schema/ai";
export * from "./schema/loans";
export * from "./schema/insurance";
export * from "./schema/itr";
export * from "./schema/bonds";
export * from "./schema/unlisted";
export * from "./schema/screener";
export * from "./schema/documents";
export * from "./schema/mca";
export * from "./schema/family";
export * from "./schema/portfolio";
export * from "./schema/users";
export * from "./schema/products";
export * from "./schema/commissions";
export * from "./schema/orders";
export * from "./schema/kyc";
export * from "./schema/advisory";
export * from "./schema/banking";
export * from "./schema/treasury";
export * from "./schema/market-data";
export * from "./schema/mutual-funds";
export * from "./schema/reit-invit";
export * from "./schema/cart";
export * from "./schema/crm";
export * from "./schema/enums";
export * from "./schema/ib";
export * from "./schema/mpal";
export * from "./schema/b2b";
export * from "./schema/alpaca-config";

// Zod schemas for Admin items
export const insertAdminSettingsSchema = createInsertSchema(adminSettings).omit({ id: true, updatedAt: true });
export const insertAdminApprovalRequestSchema = createInsertSchema(adminApprovalRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type AdminApprovalRequest = typeof adminApprovalRequests.$inferSelect;
export type InsertAdminApprovalRequest = z.infer<typeof insertAdminApprovalRequestSchema>;


// --- US Trading Tables ---
import { usOrders, usBrokerAccounts } from "./schema/orders";

export const usHoldings = pgTable("us_holdings", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clientId: varchar("client_id").references(() => users.id).notNull(),
    brokerAccountId: varchar("broker_account_id").references(() => usBrokerAccounts.id),
    symbol: varchar("symbol", { length: 10 }).notNull(),
    assetType: varchar("asset_type", { length: 20 }).default("stock"),
    quantity: decimal("quantity", { precision: 15, scale: 6 }).notNull(),
    avgPriceUsd: decimal("avg_price_usd", { precision: 15, scale: 4 }).notNull(),
    currentPriceUsd: decimal("current_price_usd", { precision: 15, scale: 4 }),
    marketValueUsd: decimal("market_value_usd", { precision: 15, scale: 2 }),
    unrealizedPlUsd: decimal("unrealized_pl_usd", { precision: 15, scale: 2 }),
    unrealizedPlPercent: decimal("unrealized_pl_percent", { precision: 8, scale: 4 }),
    fxRateAtBuy: decimal("fx_rate_at_buy", { precision: 10, scale: 4 }),
    currentFxRate: decimal("current_fx_rate", { precision: 10, scale: 4 }),
    marketValueInr: decimal("market_value_inr", { precision: 15, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
    lastSyncAt: timestamp("last_sync_at"),
}, (table) => [
    index("idx_us_holdings_client").on(table.clientId),
    index("idx_us_holdings_symbol").on(table.symbol),
  ]);

export const usConsents = pgTable("us_consents", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clientId: varchar("client_id").references(() => users.id).notNull(),
    orderId: varchar("order_id").references(() => usOrders.id),
    consentType: varchar("consent_type", { length: 50 }).notNull(),
    consentHash: varchar("consent_hash", { length: 128 }).notNull(),
    consentData: jsonb("consent_data").notNull(),
    verificationMethod: varchar("verification_method", { length: 50 }),
    verificationRef: varchar("verification_ref"),
    ipAddress: varchar("ip_address", { length: 50 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
    index("idx_us_consents_client").on(table.clientId),
    index("idx_us_consents_order").on(table.orderId),
    index("idx_us_consents_hash").on(table.consentHash),
  ]);

export const usLrsDeclarations = pgTable("us_lrs_declarations", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clientId: varchar("client_id").references(() => users.id).notNull(),
    financialYear: varchar("financial_year", { length: 10 }).notNull(),
    purposeCode: varchar("purpose_code", { length: 20 }).default("S0001"),
    amountUsd: decimal("amount_usd", { precision: 15, scale: 2 }).notNull(),
    declarationText: text("declaration_text").notNull(),
    declarationHash: varchar("declaration_hash", { length: 128 }).notNull(),
    declaredAt: timestamp("declared_at").defaultNow().notNull(),
}, (table) => [
    index("idx_us_lrs_client").on(table.clientId),
    index("idx_us_lrs_fy").on(table.financialYear),
  ]);

export const usWatchlist = pgTable("us_watchlist", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clientId: varchar("client_id").references(() => users.id).notNull(),
    symbol: varchar("symbol", { length: 10 }).notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    notes: text("notes"),
}, (table) => [
    index("idx_us_watchlist_client").on(table.clientId),
  ]);

export const usFeatureFlags = pgTable("us_feature_flags", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    flagName: varchar("flag_name", { length: 100 }).notNull().unique(),
    isEnabled: boolean("is_enabled").default(false).notNull(),
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    updatedAt: timestamp("updated_at").defaultNow(),
    updatedBy: varchar("updated_by"),
});

// Zod schemas and types for US Trading
export const insertUsHoldingSchema = createInsertSchema(usHoldings).omit({ id: true, createdAt: true, updatedAt: true });
export type UsHolding = typeof usHoldings.$inferSelect;
export type InsertUsHolding = z.infer<typeof insertUsHoldingSchema>;

export const insertUsConsentSchema = createInsertSchema(usConsents).omit({ id: true, createdAt: true });
export type UsConsent = typeof usConsents.$inferSelect;
export type InsertUsConsent = z.infer<typeof insertUsConsentSchema>;

export const insertUsLrsDeclarationSchema = createInsertSchema(usLrsDeclarations).omit({ id: true, declaredAt: true });
export type UsLrsDeclaration = typeof usLrsDeclarations.$inferSelect;
export type InsertUsLrsDeclaration = z.infer<typeof insertUsLrsDeclarationSchema>;

export const insertUsWatchlistSchema = createInsertSchema(usWatchlist).omit({ id: true, addedAt: true });
export type UsWatchlist = typeof usWatchlist.$inferSelect;
export type InsertUsWatchlist = z.infer<typeof insertUsWatchlistSchema>;

export const insertUsFeatureFlagSchema = createInsertSchema(usFeatureFlags).omit({ id: true, updatedAt: true });
export type UsFeatureFlag = typeof usFeatureFlags.$inferSelect;
export type InsertUsFeatureFlag = z.infer<typeof insertUsFeatureFlagSchema>;

  export const usWatchlist = pgTable("us_watchlist", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clientId: varchar("client_id").references(() => users.id).notNull(),
    symbol: varchar("symbol", { length: 10 }).notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    notes: text("notes"),
}, (table) => [
    index("idx_us_watchlist_client").on(table.clientId),
  ]);

export const usFeatureFlags = pgTable("us_feature_flags", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    flagName: varchar("flag_name", { length: 100 }).notNull().unique(),
    isEnabled: boolean("is_enabled").default(false).notNull(),
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    updatedAt: timestamp("updated_at").defaultNow(),
    updatedBy: varchar("updated_by"),
});

// Zod schemas and types for US Trading
export const insertUsHoldingSchema = createInsertSchema(usHoldings).omit({ id: true, createdAt: true, updatedAt: true });
export type UsHolding = typeof usHoldings.$inferSelect;
export type InsertUsHolding = z.infer<typeof insertUsHoldingSchema>;

export const insertUsConsentSchema = createInsertSchema(usConsents).omit({ id: true, createdAt: true });
export type UsConsent = typeof usConsents.$inferSelect;
export type InsertUsConsent = z.infer<typeof insertUsConsentSchema>;

export const insertUsLrsDeclarationSchema = createInsertSchema(usLrsDeclarations).omit({ id: true, declaredAt: true });
export type UsLrsDeclaration = typeof usLrsDeclarations.$inferSelect;
export type InsertUsLrsDeclaration = z.infer<typeof insertUsLrsDeclarationSchema>;

export const insertUsWatchlistSchema = createInsertSchema(usWatchlist).omit({ id: true, addedAt: true });
export type UsWatchlist = typeof usWatchlist.$inferSelect;
export type InsertUsWatchlist = z.infer<typeof insertUsWatchlistSchema>;

export const insertUsFeatureFlagSchema = createInsertSchema(usFeatureFlags).omit({ id: true, updatedAt: true });
export type UsFeatureFlag = typeof usFeatureFlags.$inferSelect;
export type InsertUsFeatureFlag = z.infer<typeof insertUsFeatureFlagSchema>;

  amountUsd: decimal("amount_usd", { precision: 15, scale: 2 }).notNull(),
      declarationText: text("declaration_text").notNull(),
      declarationHash: varchar("declaration_hash", { length: 128 }).notNull(),
      declaredAt: timestamp("declared_at").defaultNow().notNull(),
    }, (table) => [
        index("idx_us_lrs_client").on(table.clientId),
        index("idx_us_lrs_fy").on(table.financialYear),
      ]);

export const usWatchlist = pgTable("us_watchlist", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    clientId: varchar("client_id").references(() => users.id).notNull(),
    symbol: varchar("symbol", { length: 10 }).notNull(),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    notes: text("notes"),
}, (table) => [
    index("idx_us_watchlist_client").on(table.clientId),
  ]);

export const usFeatureFlags = pgTable("us_feature_flags", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    flagName: varchar("flag_name", { length: 100 }).notNull().unique(),
    isEnabled: boolean("is_enabled").default(false).notNull(),
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    updatedAt: timestamp("updated_at").defaultNow(),
    updatedBy: varchar("updated_by"),
});

// Zod schemas and types for US Trading
export const insertUsHoldingSchema = createInsertSchema(usHoldings).omit({ id: true, createdAt: true, updatedAt: true });
export type UsHolding = typeof usHoldings.$inferSelect;
export type InsertUsHolding = z.infer<typeof insertUsHoldingSchema>;

export const insertUsConsentSchema = createInsertSchema(usConsents).omit({ id: true, createdAt: true });
export type UsConsent = typeof usConsents.$inferSelect;
export type InsertUsConsent = z.infer<typeof insertUsConsentSchema>;

export const insertUsLrsDeclarationSchema = createInsertSchema(usLrsDeclarations).omit({ id: true, declaredAt: true });
export type UsLrsDeclaration = typeof usLrsDeclarations.$inferSelect;
export type InsertUsLrsDeclaration = z.infer<typeof insertUsLrsDeclarationSchema>;

export const insertUsWatchlistSchema = createInsertSchema(usWatchlist).omit({ id: true, addedAt: true });
export type UsWatchlist = typeof usWatchlist.$inferSelect;
export type InsertUsWatchlist = z.infer<typeof insertUsWatchlistSchema>;

export const insertUsFeatureFlagSchema = createInsertSchema(usFeatureFlags).omit({ id: true, updatedAt: true });
export type UsFeatureFlag = typeof usFeatureFlags.$inferSelect;
export type InsertUsFeatureFlag = z.infer<typeof insertUsFeatureFlagSchema>;
