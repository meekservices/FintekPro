import { sql } from "drizzle-orm";
import { boolean, date, decimal, index, integer, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { caVerificationStatus, Product } from '../schema';
import { users } from './users';
import { agents } from './agents';

// --- Auto-Migrated Tables ---
export const partners = pgTable("partners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: varchar("company_name").notNull(),
  contactEmail: varchar("contact_email").unique().notNull(),
  contactPhone: varchar("contact_phone"),
  address: text("address"),
  website: varchar("website"),
  // Authentication
  password: text("password").notNull(),
  isActive: boolean("is_active").default(true),
  isVerified: boolean("is_verified").default(false),
  // Partner type and permissions
  partnerType: varchar("partner_type").notNull(), // 'product_provider', 'service_provider', 'both', 'distributor', 'agent'
  permissions: jsonb("permissions").default({}), // Custom permissions object
  // Business details
  businessLicense: varchar("business_license"),
  taxId: varchar("tax_id"),
  gstin: varchar("gstin"), // GST number for corporates
  cin: varchar("cin"), // Corporate Identity Number
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("0.00"),
  
  // Product-Specific Certifications
  productTypes: text("product_types").array().default(sql`ARRAY[]::text[]`), // ['mutual_funds', 'insurance', 'loans', 'equity', 'bonds']
  arnCode: varchar("arn_code"), // AMFI Registration Number for MF distributors
  euinNumber: varchar("euin_number"), // Employee Unique Identification Number
  pospNumber: varchar("posp_number"), // Point of Sales Person for insurance
  riaNumber: varchar("ria_number"), // Registered Investment Advisor
  dsaCode: varchar("dsa_code"), // Direct Selling Agent code for loans
  
  // KYC & Bank Details for Payouts
  panNumber: varchar("pan_number"),
  aadharNumber: varchar("aadhar_number"),
  bankAccountNumber: varchar("bank_account_number"),
  ifscCode: varchar("ifsc_code"),
  bankAccountHolderName: varchar("bank_account_holder_name"),
  upiId: varchar("upi_id"),
  
  // Cashfree Vendor Integration
  cashfreeVendorId: varchar("cashfree_vendor_id"), // Cashfree vendor ID for payouts
  cashfreeVendorStatus: varchar("cashfree_vendor_status").default("not_registered"), // not_registered, pending, active, suspended
  cashfreeBankVerified: boolean("cashfree_bank_verified").default(false),
  cashfreeRegisteredAt: timestamp("cashfree_registered_at"),
  
  // Commission Structure
  commissionTier: varchar("commission_tier").default("standard"), // standard, silver, gold, platinum
  volumeBonusEnabled: boolean("volume_bonus_enabled").default(false),
  volumeBonusRate: decimal("volume_bonus_rate", { precision: 5, scale: 2 }), // Additional % for high volume
  volumeThreshold: decimal("volume_threshold", { precision: 15, scale: 2 }), // Monthly volume needed for bonus
  
  // Settlement Configuration
  settlementFrequency: varchar("settlement_frequency").default("monthly"), // instant, daily, weekly, monthly
  settlementDay: integer("settlement_day").default(1), // Day of month for monthly settlements (1-31)
  minSettlementAmount: decimal("min_settlement_amount", { precision: 10, scale: 2 }).default("1000.00"),
  
  // Performance Tracking
  totalClientsReferred: integer("total_clients_referred").default(0),
  activeClientsCount: integer("active_clients_count").default(0),
  totalCommissionsEarned: decimal("total_commissions_earned", { precision: 15, scale: 2 }).default("0.00"),
  totalCommissionsPaid: decimal("total_commissions_paid", { precision: 15, scale: 2 }).default("0.00"),
  pendingCommissions: decimal("pending_commissions", { precision: 15, scale: 2 }).default("0.00"),
  lastSettlementDate: timestamp("last_settlement_date"),
  
  // CA (Chartered Accountant) Specific Fields
  icaiMembershipNumber: varchar("icai_membership_number"), // ICAI membership number (e.g., "123456")
  icaiMembershipType: varchar("icai_membership_type"), // ACA (Associate), FCA (Fellow)
  caFirmName: varchar("ca_firm_name"), // Name of CA firm if applicable
  caFirmRegistrationNumber: varchar("ca_firm_registration_number"), // FRN number
  caSpecializations: text("ca_specializations").array().default(sql`ARRAY[]::text[]`), // ITR, GST, Audit, Form15, TaxNotices, CompanyLaw
  caExperienceYears: integer("ca_experience_years"), // Years of experience
  caQualificationYear: integer("ca_qualification_year"), // Year of CA qualification
  caCity: varchar("ca_city"), // Primary service city
  caState: varchar("ca_state"), // Primary service state
  caAvailability: varchar("ca_availability").default("available"), // available, busy, on_leave, unavailable
  caMaxCasesPerMonth: integer("ca_max_cases_per_month").default(50), // Maximum cases CA can handle per month
  caCurrentActiveCases: integer("ca_current_active_cases").default(0), // Current active cases count
  caCompletedCases: integer("ca_completed_cases").default(0), // Total completed cases
  caAverageRating: decimal("ca_average_rating", { precision: 3, scale: 2 }), // Average rating (0-5)
  caTotalRatings: integer("ca_total_ratings").default(0), // Total number of ratings received
  caResponseTime: varchar("ca_response_time").default("24h"), // Typical response time: 4h, 12h, 24h, 48h
  caVerificationStatus: varchar("ca_verification_status").default("pending"), // pending, verified, rejected
  caVerifiedAt: timestamp("ca_verified_at"),
  caVerifiedBy: varchar("ca_verified_by"), // Admin who verified
  caProfilePhoto: varchar("ca_profile_photo"), // Profile photo URL
  caBio: text("ca_bio"), // Short bio/about
  
  // === Multi-Level Partner Hierarchy Fields ===
  parentPartnerId: varchar("parent_partner_id"),
  partnerLevel: varchar("partner_level").default("L1"),
  hierarchyPartnerType: varchar("hierarchy_partner_type").default("MASTER"),
  hierarchyStatus: varchar("hierarchy_status").default("ACTIVE"),
  kycStatus: varchar("kyc_status").default("PENDING"),
  approvalStatus: varchar("approval_status").default("PENDING"),
  agreementId: varchar("agreement_id"),
  maxDepth: integer("max_depth").default(7),
  createdBy: varchar("created_by"),
  referredById: varchar("referred_by_id"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const partnerReferrals = pgTable("partner_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  // Referral Details
  referralCode: varchar("referral_code"), // Partner's unique referral code
  referralSource: varchar("referral_source"), // website, app, email, whatsapp
  referralDate: timestamp("referral_date").defaultNow(),
  
  // Client Status
  clientStatus: varchar("client_status").default("registered"), // registered, kyc_completed, first_transaction, active, inactive
  firstTransactionDate: timestamp("first_transaction_date"),
  lastTransactionDate: timestamp("last_transaction_date"),
  
  // Tracking
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const partnerCommissions = pgTable("partner_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  // Transaction Reference
  orderId: varchar("order_id"), // Reference to unified_orders or specific product order
  productType: varchar("product_type").notNull(), // mutual_funds, insurance, loans, equity, bonds
  transactionType: varchar("transaction_type").notNull(), // purchase, sip, renewal, interest, payout
  
  // Amount Details
  transactionAmount: decimal("transaction_amount", { precision: 15, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(), // % rate applied
  commissionAmount: decimal("commission_amount", { precision: 15, scale: 2 }).notNull(),
  volumeBonus: decimal("volume_bonus", { precision: 15, scale: 2 }).default("0.00"), // Additional bonus if applicable
  totalCommission: decimal("total_commission", { precision: 15, scale: 2 }).notNull(), // commission + bonus
  
  // Tax Deduction (TDS)
  tdsRate: decimal("tds_rate", { precision: 5, scale: 2 }).default("0.00"),
  tdsAmount: decimal("tds_amount", { precision: 15, scale: 2 }).default("0.00"),
  netCommission: decimal("net_commission", { precision: 15, scale: 2 }).notNull(), // After TDS
  
  // Settlement Status
  status: varchar("status").default("pending"), // pending, settled, cancelled, reversed
  settlementId: varchar("settlement_id"), // Foreign key will be added after partnerSettlements table is defined
  settledAt: timestamp("settled_at"),
  
  // Cashfree Split Details
  cashfreeOrderId: varchar("cashfree_order_id"), // Cashfree payment order ID
  cashfreeSplitId: varchar("cashfree_split_id"), // Cashfree split transaction ID
  cashfreeSplitStatus: varchar("cashfree_split_status"), // pending, success, failed
  
  // Metadata
  transactionDate: timestamp("transaction_date").defaultNow(),
  month: varchar("month").notNull(), // YYYY-MM for grouping
  financialYear: varchar("financial_year"), // FY2024-25
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const partnerSettlements = pgTable("partner_settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  
  // Settlement Period
  settlementPeriod: varchar("settlement_period").notNull(), // YYYY-MM
  settlementMonth: varchar("settlement_month").notNull(), // January 2025
  settlementDate: timestamp("settlement_date").notNull(),
  
  // Commission Summary
  totalTransactions: integer("total_transactions").default(0),
  totalCommissionEarned: decimal("total_commission_earned", { precision: 15, scale: 2 }).notNull(),
  totalVolumeBonus: decimal("total_volume_bonus", { precision: 15, scale: 2 }).default("0.00"),
  totalTds: decimal("total_tds", { precision: 15, scale: 2 }).default("0.00"),
  netPayable: decimal("net_payable", { precision: 15, scale: 2 }).notNull(),
  
  // Adjustment & Deductions
  adjustments: decimal("adjustments", { precision: 15, scale: 2 }).default("0.00"), // Manual adjustments
  adjustmentReason: text("adjustment_reason"),
  previousBalance: decimal("previous_balance", { precision: 15, scale: 2 }).default("0.00"), // Carried forward
  finalPayoutAmount: decimal("final_payout_amount", { precision: 15, scale: 2 }).notNull(),
  
  // Payment Status
  status: varchar("status").default("pending"), // pending, processing, completed, failed, cancelled
  paymentMethod: varchar("payment_method").default("bank_transfer"), // bank_transfer, upi
  
  // Cashfree Payout Details
  cashfreePayoutId: varchar("cashfree_payout_id"), // Cashfree payout/transfer ID
  cashfreePayoutStatus: varchar("cashfree_payout_status"), // pending, success, failed, reversed
  cashfreeUtr: varchar("cashfree_utr"), // Unique Transaction Reference from bank
  cashfreePayoutInitiatedAt: timestamp("cashfree_payout_initiated_at"),
  cashfreePayoutCompletedAt: timestamp("cashfree_payout_completed_at"),
  cashfreeFailureReason: text("cashfree_failure_reason"),
  
  // Bank Details (snapshot at time of settlement)
  bankAccountNumber: varchar("bank_account_number"),
  ifscCode: varchar("ifsc_code"),
  accountHolderName: varchar("account_holder_name"),
  
  // Reconciliation
  reconciledAt: timestamp("reconciled_at"),
  reconciledBy: varchar("reconciled_by").references(() => users.id),
  reconciliationNotes: text("reconciliation_notes"),
  
  // Documents
  invoiceNumber: varchar("invoice_number"),
  invoiceUrl: text("invoice_url"), // PDF invoice stored in object storage
  statementUrl: text("statement_url"), // Detailed statement
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const partnerHierarchyAgreements = pgTable("partner_hierarchy_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  agreementType: varchar("agreement_type").notNull().default("PARTNER"),
  agreementDocument: text("agreement_document"),
  agreementStatus: varchar("agreement_status").default("DRAFT"),
  effectiveFrom: timestamp("effective_from"),
  effectiveTo: timestamp("effective_to"),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const partnerCommissionRules = pgTable("partner_commission_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productType: varchar("product_type").notNull(),
  agentPct: decimal("agent_pct", { precision: 5, scale: 2 }).notNull().default("0.00"),
  subPartnerPct: decimal("sub_partner_pct", { precision: 5, scale: 2 }).notNull().default("0.00"),
  masterPartnerPct: decimal("master_partner_pct", { precision: 5, scale: 2 }).notNull().default("0.00"),
  platformPct: decimal("platform_pct", { precision: 5, scale: 2 }).notNull().default("0.00"),
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const partnerWallets = pgTable("partner_wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").references(() => partners.id).notNull().unique(),
  balance: decimal("balance", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalCredited: decimal("total_credited", { precision: 15, scale: 2 }).notNull().default("0.00"),
  totalDebited: decimal("total_debited", { precision: 15, scale: 2 }).notNull().default("0.00"),
  lastTransactionAt: timestamp("last_transaction_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const partnerCommissionLedger = pgTable("partner_commission_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  transactionId: varchar("transaction_id").notNull(),
  orderId: varchar("order_id"),
  productType: varchar("product_type").notNull(),
  transactionAmount: decimal("transaction_amount", { precision: 15, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 15, scale: 2 }).notNull(),
  commissionRuleId: varchar("commission_rule_id").references(() => partnerCommissionRules.id),
  waterfallLevel: varchar("waterfall_level").notNull(),
  status: varchar("status").notNull().default("PENDING"),
  kycGated: boolean("kyc_gated").default(false),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPartnerCommissionLedgerSchema = createInsertSchema(partnerCommissionLedger).omit({
  id: true,
  createdAt: true,
});

export type PartnerCommissionLedger = typeof partnerCommissionLedger.$inferSelect;

export type InsertPartnerCommissionLedger = z.infer<typeof insertPartnerCommissionLedgerSchema>;

export const partnerAuditLogs = pgTable("partner_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  metadata: jsonb("metadata").default({}),
  ipAddress: varchar("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const partnerClientOwnership = pgTable("partner_client_ownership", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  ownerPartnerId: varchar("owner_partner_id").references(() => partners.id).notNull(),
  firstTransactionAt: timestamp("first_transaction_at"),
  isLocked: boolean("is_locked").default(false),
  overrideBy: varchar("override_by"),
  overrideReason: text("override_reason"),
  overrideAt: timestamp("override_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPartnerClientOwnershipSchema = createInsertSchema(partnerClientOwnership).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PartnerClientOwnership = typeof partnerClientOwnership.$inferSelect;

export type InsertPartnerClientOwnership = z.infer<typeof insertPartnerClientOwnershipSchema>;

export const partnerApplications = pgTable("partner_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Lender and Loan Details
  lender: varchar("lender").notNull(), // bajaj_finance, tata_capital, hdfc_bank, icici_bank
  loanType: varchar("loan_type").notNull().default("personal"), // personal, home, business, car, etc.
  recommendationId: varchar("recommendation_id"), // Reference to original recommendation
  
  // Application Details
  loanAmount: decimal("loan_amount", { precision: 12, scale: 2 }).notNull(),
  tenure: integer("tenure").notNull(), // in months
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
  emi: decimal("emi", { precision: 10, scale: 2 }),
  processingFee: decimal("processing_fee", { precision: 10, scale: 2 }),
  
  // User Financial Information (snapshot at time of application)
  monthlyIncome: decimal("monthly_income", { precision: 10, scale: 2 }).notNull(),
  existingEMIs: decimal("existing_emis", { precision: 10, scale: 2 }),
  employmentType: varchar("employment_type").notNull(), // salaried, self_employed, business, professional
  workExperience: integer("work_experience"), // in years
  cibilScore: integer("cibil_score"),
  
  // Personal Information (pre-filled from profile)
  panNumber: varchar("pan_number"),
  aadharNumber: varchar("aadhar_number"),
  currentAddress: text("current_address"),
  employerName: varchar("employer_name"),
  companyCategory: varchar("company_category"), // for HDFC specific
  residenceType: varchar("residence_type"), // owned, rented, company_provided
  
  // Banking Information
  bankName: varchar("bank_name"),
  accountNumber: varchar("account_number"),
  ifscCode: varchar("ifsc_code"),
  netSalaryCreditBank: varchar("net_salary_credit_bank"), // for HDFC specific
  
  // Document References (JSON array of object storage URLs)
  documentRefs: jsonb("document_refs").default([]),
  requiredDocuments: jsonb("required_documents").default([]), // list of required docs per lender
  
  // Lender-Specific Metadata
  providerMeta: jsonb("provider_meta").default({}), // store lender-specific fields
  
  // Consent and Compliance
  bureauConsent: boolean("bureau_consent").default(false),
  ckycConsent: boolean("ckyc_consent").default(false),
  termsAccepted: boolean("terms_accepted").default(false),
  
  // Application Status and Tracking
  status: varchar("status").default("draft"), // draft, submitted, pending, approved, rejected, cancelled
  providerApplicationId: varchar("provider_application_id"), // lender's internal ID
  submittedAt: timestamp("submitted_at"),
  
  // Status Updates from Provider
  statusUpdates: jsonb("status_updates").default([]), // array of status change events
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const partnerApplicationDocuments = pgTable("partner_application_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => partnerApplications.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Document Details
  documentType: varchar("document_type").notNull(), // panCard, aadharCard, salarySlips, bankStatements, employmentLetter
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"), // in bytes
  mimeType: varchar("mime_type"),
  
  // Object Storage Details
  filePath: text("file_path").notNull(), // normalized object storage path like /objects/uuid
  originalUrl: text("original_url"), // original upload URL for reference
  
  // Metadata
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  isVerified: boolean("is_verified").default(false),
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  
  // Timestamps
  uploadedAt: timestamp("uploaded_at").default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
