import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, jsonb, varchar, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Operating Mode Enum
 */
export const OPERATING_MODES = ["TEST_SANDBOX", "RESTRICTED_PILOT", "PRODUCTION_LIVE"] as const;
export type OperatingMode = typeof OPERATING_MODES[number];

/**
 * Capability Tier Enum
 */
export const CAPABILITY_TIERS = [
  "SANDBOX_TEST",
  "PARTIAL_DISTRIBUTION",
  "FULL_DISTRIBUTION",
  "ADVISORY_UPGRADED"
] as const;
export type CapabilityTier = typeof CAPABILITY_TIERS[number];

/**
 * Desk Type Enum
 */
export const DESK_TYPES = [
  "MFD_AMFI",
  "UPSTOX_BROKER",
  "IRIS_KFINTECH",
  "ALPACA_GLOBAL",
  "SEBI_RIA_ADVISORY",
  "BONDS_NCDS_DESK",
  "CORPORATE_FD_DESK",
  "LAMF_CREDIT_DESK",
  "SDI_ALTERNATIVE_DEBT_DESK"
] as const;
export type DeskType = typeof DESK_TYPES[number];

/**
 * License Status Enum
 */
export const LICENSE_STATUSES = [
  "PENDING_UPLOAD",
  "UNDER_REVIEW",
  "VERIFIED_ACTIVE",
  "EXPIRED",
  "REJECTED"
] as const;
export type LicenseStatus = typeof LICENSE_STATUSES[number];

/**
 * Document Verification Status Enum
 */
export const DOC_VERIFICATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type DocVerificationStatus = typeof DOC_VERIFICATION_STATUSES[number];

/**
 * Permissible Document Types
 */
export const LICENSE_DOC_TYPES = [
  "AMFI_CORPORATE_ARN_CARD",
  "NISM_V_A_CERTIFICATE",
  "EUIN_ALLOTMENT_LETTER",
  "UPSTOX_AP_AGREEMENT",
  "UPSTOX_DEBT_SEGMENT_APPROVAL",
  "KFINTECH_IRIS_SERVICE_AGREEMENT",
  "ALPACA_BROKER_PARTNER_AGREEMENT",
  "GST_EXPORT_LUT_CERTIFICATE",
  "SEBI_RIA_REGISTRATION_CERTIFICATE",
  "CA_NET_WORTH_CERTIFICATE",
  "BSE_STAR_DEBT_OR_ISSUER_SYNDICATION_AGMT",
  "CRISIL_ICRA_BOND_RATING_DATA_AGMT",
  "BAJAJ_SHRIRAM_FD_AGENCY_AGMT",
  "VOLT_MONEY_OR_NBFC_LAMF_PARTNER_AGMT",
  "SEBI_OBPP_SDI_TRUSTEE_OR_ISSUER_AGMT"
] as const;
export type LicenseDocType = typeof LICENSE_DOC_TYPES[number];

/**
 * 1. Master Operational Status of FintekPro Desks (FintekPro Financial Services LLP)
 */
export const deskOperationalConfigs = pgTable("desk_operational_configs", {
  id: varchar("id", { length: 64 }).primaryKey().default("FINTEKPRO_LLP_MASTER"),
  entityName: text("entity_name").default("FintekPro Financial Services LLP").notNull(),
  llpin: text("llpin").default("AAM-1234"), // LLP Identification Number
  
  // Global Mode Toggle
  operatingMode: text("operating_mode", { enum: OPERATING_MODES }).default("TEST_SANDBOX").notNull(),

  // Module Capability Gates
  isMfDistributionActive: boolean("is_mf_distribution_active").default(false).notNull(),
  isUpstoxEquityActive: boolean("is_upstox_equity_active").default(false).notNull(),
  isAlpacaUsEquityActive: boolean("is_alpaca_us_equity_active").default(false).notNull(),
  isCorporateFdActive: boolean("is_corporate_fd_active").default(false).notNull(),
  isBondDistributionActive: boolean("is_bond_distribution_active").default(false).notNull(),
  isLamfActive: boolean("is_lamf_active").default(false).notNull(),
  isSdiActive: boolean("is_sdi_active").default(false).notNull(),
  isAiAdvisoryActive: boolean("is_ai_advisory_active").default(false).notNull(),

  // Current Capability Tier
  capabilityTier: text("capability_tier", { enum: CAPABILITY_TIERS }).default("SANDBOX_TEST").notNull(),

  updatedBy: text("updated_by"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 2. Statutory Licenses & Partner Credentials for each Desk
 */
export const statutoryLicenses = pgTable("statutory_licenses", {
  id: varchar("id", { length: 64 }).primaryKey(), // e.g. "LIC_MFD_AMFI", "LIC_UPSTOX_BROKER"
  deskConfigId: varchar("desk_config_id", { length: 64 })
    .references(() => deskOperationalConfigs.id)
    .notNull(),
  deskType: text("desk_type", { enum: DESK_TYPES }).notNull(),
  
  licenseNumber: text("license_number"), // e.g., "ARN-182394", "AP-UPSTOX-001", "INA000012345"
  holderName: text("holder_name"),
  issueDate: timestamp("issue_date"),
  validUntil: timestamp("valid_until"),
  status: text("status", { enum: LICENSE_STATUSES }).default("PENDING_UPLOAD").notNull(),

  // Sandboxed test execution flag (true = runs against test sandbox/simulator)
  isSandboxed: boolean("is_sandboxed").default(true).notNull(),

  // Partner API Credentials & Configuration (Encrypted references or metadata)
  partnerCredentials: jsonb("partner_credentials").$type<{
    clientId?: string;
    apiKeyRef?: string;
    tenantCode?: string;
    webhookUrl?: string;
    redirectUri?: string;
    ad1BankName?: string;
    gstLutNumber?: string;
  }>().default({}),

  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

/**
 * 3. Uploaded Verification Documents & Partnership Contracts
 */
export const licenseVerificationDocuments = pgTable("license_verification_documents", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  licenseId: varchar("license_id", { length: 64 })
    .references(() => statutoryLicenses.id)
    .notNull(),
  documentType: text("document_type", { enum: LICENSE_DOC_TYPES }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileHashSha256: text("file_hash_sha256").notNull(),
  uploadedByAdminId: text("uploaded_by_admin_id").notNull(),
  verifiedAt: timestamp("verified_at"),
  verifiedByAdminId: text("verified_by_admin_id"),
  verificationNotes: text("verification_notes"),
  status: text("status", { enum: DOC_VERIFICATION_STATUSES }).default("PENDING").notNull(),
  uploadedAt: timestamp("uploaded_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Zod Schemas
export const insertDeskOperationalConfigSchema = createInsertSchema(deskOperationalConfigs);
export const selectDeskOperationalConfigSchema = createSelectSchema(deskOperationalConfigs);
export type DeskOperationalConfig = z.infer<typeof selectDeskOperationalConfigSchema>;
export type InsertDeskOperationalConfig = z.infer<typeof insertDeskOperationalConfigSchema>;

export const insertStatutoryLicenseSchema = createInsertSchema(statutoryLicenses);
export const selectStatutoryLicenseSchema = createSelectSchema(statutoryLicenses);
export type StatutoryLicense = z.infer<typeof selectStatutoryLicenseSchema>;
export type InsertStatutoryLicense = z.infer<typeof insertStatutoryLicenseSchema>;

export const insertLicenseVerificationDocumentSchema = createInsertSchema(licenseVerificationDocuments);
export const selectLicenseVerificationDocumentSchema = createSelectSchema(licenseVerificationDocuments);
export type LicenseVerificationDocument = z.infer<typeof selectLicenseVerificationDocumentSchema>;
export type InsertLicenseVerificationDocument = z.infer<typeof insertLicenseVerificationDocumentSchema>;

/**
 * 4. Multi-Partner per Product Mapping & Dynamic Routing Matrix
 */
export const PRODUCT_TYPES = [
  "EQUITY_BROKERAGE",
  "MUTUAL_FUNDS_DISTRIBUTION",
  "CORPORATE_FIXED_DEPOSITS",
  "LOAN_AGAINST_SECURITIES_LAMF",
  "BONDS_NCDS_DEBT",
  "US_GLOBAL_EQUITIES",
  "SECURITIZED_DEBT_SDI",
  "ACCOUNT_AGGREGATOR_AA"
] as const;
export type ProductType = typeof PRODUCT_TYPES[number];

export const PARTNER_PROVIDER_STATUSES = [
  "ACTIVE_PRIMARY",
  "ACTIVE_SECONDARY",
  "STANDBY_FALLBACK",
  "MAINTENANCE",
  "DISABLED"
] as const;
export type PartnerProviderStatus = typeof PARTNER_PROVIDER_STATUSES[number];

export const productPartnerProviders = pgTable("product_partner_providers", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  productType: text("product_type", { enum: PRODUCT_TYPES }).notNull(),
  providerKey: text("provider_key").notNull(),
  providerDisplayName: text("provider_display_name").notNull(),
  status: text("status", { enum: PARTNER_PROVIDER_STATUSES }).default("ACTIVE_SECONDARY").notNull(),
  priorityOrder: integer("priority_order").default(1).notNull(),
  distributorCommissionBps: integer("distributor_commission_bps").default(100).notNull(),
  partnerRevenueSharePercent: numeric("partner_revenue_share_percent", { precision: 5, scale: 2 }).default("80.00").notNull(),
  apiEndpointRef: text("api_endpoint_ref"),
  circuitBreakerKey: text("circuit_breaker_key").notNull(),
  isSandboxMock: boolean("is_sandbox_mock").default(true).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertProductPartnerProviderSchema = createInsertSchema(productPartnerProviders);
export const selectProductPartnerProviderSchema = createSelectSchema(productPartnerProviders);
export type ProductPartnerProvider = z.infer<typeof selectProductPartnerProviderSchema>;
export type InsertProductPartnerProvider = z.infer<typeof insertProductPartnerProviderSchema>;
