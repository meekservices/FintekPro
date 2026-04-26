import { sql } from "drizzle-orm";
import { boolean, date, decimal, index, integer, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";

export const caVerificationStatus = pgTable("ca_verification_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  
  // CA Details
  caId: varchar("ca_id").references(() => users.id).notNull(), // The CA performing the verification
  verificationType: varchar("verification_type").notNull(), // 'networth_certificate', 'tax_audit', 'income_verification', 'entity_audit'
  
  // Status tracking
  status: varchar("status").notNull().default("pending"), // 'pending', 'in_review', 'verified', 'rejected', 'expired'
  
  // Document information
  documentId: varchar("document_id"), // Reference to a document in document_versions or similar
  certificateNumber: varchar("certificate_number"),
  issueDate: date("issue_date"),
  expiryDate: date("expiry_date"),
  
  // Financial details verified
  verifiedNetworth: decimal("verified_networth", { precision: 20, scale: 2 }),
  verifiedIncome: decimal("verified_income", { precision: 20, scale: 2 }),
  financialYear: varchar("financial_year"),
  
  // UDIN (Unique Document Identification Number) - mandatory for ICAI compliance
  udin: varchar("udin"),
  udinVerified: boolean("udin_verified").default(false),
  udinVerifiedAt: timestamp("udin_verified_at"),
  
  // Admin/Reviewer notes
  notes: text("notes"),
  rejectionReason: text("rejection_reason"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastSyncedAt: timestamp("last_synced_at"),
});

export const insertCaVerificationStatusSchema = createInsertSchema(caVerificationStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CaVerificationStatus = typeof caVerificationStatus.$inferSelect;
export type InsertCaVerificationStatus = z.infer<typeof insertCaVerificationStatusSchema>;

import { agents } from './agents';
import { Product } from './products';

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

export const insertPartnerCommissionLedgerSchema = createInsertSchema(partnerCommissionLedger).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
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

export const insertPartnerClientOwnershipSchema = createInsertSchema(partnerClientOwnership).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
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

// ========================================
// FORM 15CA/15CB & CA PROFESSIONAL VERIFICATION
// ========================================

export const form15Cases = pgTable("form_15_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseNumber: varchar("case_number").notNull().unique(),
  
  // Parties involved
  clientId: varchar("client_id").references(() => users.id).notNull(),
  caId: varchar("ca_id").references(() => users.id), // Assigned CA
  agentId: varchar("agent_id").references(() => users.id), // Subordinate agent who prepared
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdByRole: varchar("created_by_role").notNull(), // client, ca_subordinate_agent, ca
  
  // Case status
  status: varchar("status").default("draft").notNull(), // draft, pending_documents, pending_ca_review, ca_reviewing, approved, 15cb_signed, 15ca_filed, completed
  subStatus: varchar("sub_status"), // detailed sub-status
  
  // Client Information
  clientPan: varchar("client_pan").notNull(),
  clientName: varchar("client_name").notNull(),
  clientResidentialStatus: varchar("client_residential_status").notNull(), // resident, non_resident, not_ordinarily_resident
  clientAddress: text("client_address"),
  clientEmail: varchar("client_email"),
  clientPhone: varchar("client_phone"),
  
  // Remittance Details
  remittanceAmount: decimal("remittance_amount", { precision: 18, scale: 2 }).notNull(),
  remittanceCurrency: varchar("remittance_currency").default("USD").notNull(),
  remittanceAmountInr: decimal("remittance_amount_inr", { precision: 18, scale: 2 }),
  exchangeRate: decimal("exchange_rate", { precision: 12, scale: 6 }),
  
  // Beneficiary Details
  beneficiaryName: varchar("beneficiary_name").notNull(),
  beneficiaryCountry: varchar("beneficiary_country").notNull(),
  beneficiaryAddress: text("beneficiary_address"),
  beneficiaryBankName: varchar("beneficiary_bank_name"),
  beneficiaryAccountNumber: varchar("beneficiary_account_number"),
  beneficiarySwiftCode: varchar("beneficiary_swift_code"),
  
  // RBI Purpose & Nature
  rbiPurposeCode: varchar("rbi_purpose_code").notNull(),
  rbiPurposeDescription: text("rbi_purpose_description"),
  natureOfPayment: varchar("nature_of_payment").notNull(),
  sectionUnderWhichTaxDeducted: varchar("section_under_which_tax_deducted"),
  
  // DTAA Details
  dtaaApplicable: boolean("dtaa_applicable").default(false),
  dtaaCountry: varchar("dtaa_country"),
  dtaaArticle: varchar("dtaa_article"),
  dtaaRate: decimal("dtaa_rate", { precision: 5, scale: 2 }),
  dtaaAnalysis: text("dtaa_analysis"),
  trcAvailable: boolean("trc_available").default(false),
  form10fAvailable: boolean("form_10f_available").default(false),
  noPeDeclaration: boolean("no_pe_declaration").default(false),
  
  // Rule 37BB Determination
  form15caRequired: boolean("form_15ca_required").default(true),
  form15caPart: varchar("form_15ca_part"), // A, B, C, D
  form15cbRequired: boolean("form_15cb_required").default(false),
  rule37bbJustification: text("rule_37bb_justification"),
  caOverrideReason: text("ca_override_reason"), // If CA overrides auto-determination
  
  // Tax Computation
  grossAmount: decimal("gross_amount", { precision: 18, scale: 2 }),
  taxableAmount: decimal("taxable_amount", { precision: 18, scale: 2 }),
  tdsRate: decimal("tds_rate", { precision: 5, scale: 2 }),
  tdsAmount: decimal("tds_amount", { precision: 18, scale: 2 }),
  surcharge: decimal("surcharge", { precision: 18, scale: 2 }),
  cesss: decimal("cess", { precision: 18, scale: 2 }),
  totalTaxDeducted: decimal("total_tax_deducted", { precision: 18, scale: 2 }),
  netRemittance: decimal("net_remittance", { precision: 18, scale: 2 }),
  
  // Agent Preparation
  agentRemarks: text("agent_remarks"),
  agentPreparedAt: timestamp("agent_prepared_at"),
  agentSubmittedForReview: boolean("agent_submitted_for_review").default(false),
  agentSubmittedAt: timestamp("agent_submitted_at"),
  
  // CA Review & Approval
  caReviewStartedAt: timestamp("ca_review_started_at"),
  caReviewCompletedAt: timestamp("ca_review_completed_at"),
  caRemarks: text("ca_remarks"),
  caSentBackToAgent: boolean("ca_sent_back_to_agent").default(false),
  caSentBackReason: text("ca_sent_back_reason"),
  
  // CA Approval Checklist (all must be true for approval)
  caDocumentsReviewed: boolean("ca_documents_reviewed").default(false),
  caDtaaVerified: boolean("ca_dtaa_verified").default(false),
  caTaxComputationConfirmed: boolean("ca_tax_computation_confirmed").default(false),
  caLegalResponsibilityAccepted: boolean("ca_legal_responsibility_accepted").default(false),
  caApprovalTimestamp: timestamp("ca_approval_timestamp"),
  
  // Form 15CB Details (CA Only)
  form15cbNumber: varchar("form_15cb_number"),
  form15cbDate: timestamp("form_15cb_date"),
  form15cbDscSerialNumber: varchar("form_15cb_dsc_serial_number"),
  form15cbSignedAt: timestamp("form_15cb_signed_at"),
  form15cbSignedByIcai: varchar("form_15cb_signed_by_icai"), // ICAI membership number
  form15cbPdfUrl: text("form_15cb_pdf_url"),
  form15cbLocked: boolean("form_15cb_locked").default(false),
  
  // Form 15CA Details
  form15caPartA: jsonb("form_15ca_part_a"),
  form15caPartB: jsonb("form_15ca_part_b"),
  form15caPartC: jsonb("form_15ca_part_c"),
  form15caPartD: jsonb("form_15ca_part_d"),
  form15caAcknowledgementNumber: varchar("form_15ca_acknowledgement_number"),
  form15caFiledAt: timestamp("form_15ca_filed_at"),
  form15caPdfUrl: text("form_15ca_pdf_url"),
  form15caEverified: boolean("form_15ca_everified").default(false),
  form15caEverifiedAt: timestamp("form_15ca_everified_at"),
  form15caEverifiedBy: varchar("form_15ca_everified_by").references(() => users.id),
  
  // Bank Compliance Pack
  compliancePackGenerated: boolean("compliance_pack_generated").default(false),
  compliancePackUrl: text("compliance_pack_url"),
  compliancePackGeneratedAt: timestamp("compliance_pack_generated_at"),
  compliancePackSharedLink: varchar("compliance_pack_shared_link"),
  compliancePackSharedLinkExpiry: timestamp("compliance_pack_shared_link_expiry"),
  
  // Internal Notes
  internalNotes: jsonb("internal_notes").default([]),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_form15_cases_client").on(table.clientId),
  index("idx_form15_cases_ca").on(table.caId),
  index("idx_form15_cases_agent").on(table.agentId),
  index("idx_form15_cases_status").on(table.status),
  index("idx_form15_cases_case_number").on(table.caseNumber),
]);

export const form15Documents = pgTable("form_15_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => form15Cases.id).notNull(),
  
  documentType: varchar("document_type").notNull(), // invoice, agreement, trc, form_10f, no_pe_declaration, bank_advice, other
  documentName: varchar("document_name").notNull(),
  documentUrl: text("document_url"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  version: integer("version").default(1),
  
  isMandatory: boolean("is_mandatory").default(false),
  status: varchar("status").default("uploaded"), // uploaded, verified, rejected
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),
  
  isLockedAfterSigning: boolean("is_locked_after_signing").default(false),
  lockedAt: timestamp("locked_at"),
  
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_form15_docs_case").on(table.caseId),
  index("idx_form15_docs_type").on(table.documentType),
]);

export const form15AuditLog = pgTable("form_15_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => form15Cases.id).notNull(),
  
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  userRole: varchar("user_role").notNull(), // client, ca_subordinate_agent, ca, admin
  userEmail: varchar("user_email"),
  
  actionType: varchar("action_type").notNull(), // created, updated, status_change, document_upload, document_delete, ca_review_started, ca_approved, ca_sent_back, 15cb_signed, 15ca_filed, everified
  actionDescription: text("action_description").notNull(),
  
  fieldChanged: varchar("field_changed"),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  dscSerialNumber: varchar("dsc_serial_number"), // For signing actions
  icaiMembershipNumber: varchar("icai_membership_number"), // For CA actions
  
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_form15_audit_case").on(table.caseId),
  index("idx_form15_audit_user").on(table.userId),
  index("idx_form15_audit_action").on(table.actionType),
  index("idx_form15_audit_created").on(table.createdAt),
]);

export const caProfessionalVerification = pgTable("ca_professional_verification", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // ICAI Verification
  icaiMembershipNumber: varchar("icai_membership_number").notNull(),
  icaiVerified: boolean("icai_verified").default(false),
  icaiVerifiedAt: timestamp("icai_verified_at"),
  icaiVerifiedBy: varchar("icai_verified_by").references(() => users.id),
  
  // COP (Certificate of Practice) Validity
  copNumber: varchar("cop_number"),
  copValidFrom: date("cop_valid_from"),
  copValidTo: date("cop_valid_to"),
  copVerified: boolean("cop_verified").default(false),
  copVerifiedAt: timestamp("cop_verified_at"),
  
  // PAN Verification
  panNumber: varchar("pan_number").notNull(),
  panVerified: boolean("pan_verified").default(false),
  panVerifiedAt: timestamp("pan_verified_at"),
  
  // DSC (Digital Signature Certificate) Availability
  dscAvailable: boolean("dsc_available").default(false),
  dscSerialNumber: varchar("dsc_serial_number"),
  dscValidFrom: date("dsc_valid_from"),
  dscValidTo: date("dsc_valid_to"),
  dscVerifiedAt: timestamp("dsc_verified_at"),
  
  // Overall Status
  overallStatus: varchar("overall_status").default("pending"), // pending, approved, rejected, suspended
  canSignForm15cb: boolean("can_sign_form_15cb").default(false),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ca_prof_verification_user").on(table.userId),
  index("idx_ca_prof_verification_icai").on(table.icaiMembershipNumber),
  index("idx_ca_prof_verification_status").on(table.overallStatus),
]);

// Zod schemas and types for Form 15 & CA Prof Verification
export const insertForm15CaseSchema = createInsertSchema(form15Cases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type Form15Case = typeof form15Cases.$inferSelect;
export type InsertForm15Case = z.infer<typeof insertForm15CaseSchema>;

export const insertForm15DocumentSchema = createInsertSchema(form15Documents).omit({
  id: true,
  uploadedAt: true,
  updatedAt: true,
});
export type Form15Document = typeof form15Documents.$inferSelect;
export type InsertForm15Document = z.infer<typeof insertForm15DocumentSchema>;

export const insertForm15AuditLogSchema = createInsertSchema(form15AuditLog).omit({
  id: true,
  createdAt: true,
});
export type Form15AuditLog = typeof form15AuditLog.$inferSelect;
export type InsertForm15AuditLog = z.infer<typeof insertForm15AuditLogSchema>;

export const insertCaProfessionalVerificationSchema = createInsertSchema(caProfessionalVerification).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CaProfessionalVerification = typeof caProfessionalVerification.$inferSelect;
export type InsertCaProfessionalVerification = z.infer<typeof insertCaProfessionalVerificationSchema>;

// Form 15 Enums
export const Form15StatusEnum = z.enum([
  'draft',
  'pending_documents',
  'pending_ca_review',
  'ca_reviewing',
  'sent_back_to_agent',
  'approved',
  '15cb_signed',
  '15ca_filed',
  'everified',
  'completed'
]);

export const Form15CaPartEnum = z.enum(['A', 'B', 'C', 'D']);

export const Form15DocumentTypeEnum = z.enum([
  'invoice',
  'agreement',
  'trc',
  'form_10f',
  'no_pe_declaration',
  'bank_advice',
  'pan_card',
  'passport',
  'other'
]);

// RBI Purpose Code Categories
export const RbiPurposeCodeCategories = {
  capital_account: [
    { code: 'S0001', description: 'Inward remittance from overseas offices of authorized dealers' },
    { code: 'S0002', description: 'Loans extended to Non-Residents' },
    { code: 'S0003', description: 'Investment in JV/WOS abroad' },
  ],
  current_account: [
    { code: 'S0101', description: 'Trade credits for goods (suppliers credit)' },
    { code: 'S0102', description: 'Advance payment for import of goods' },
    { code: 'S0103', description: 'Import payments' },
    { code: 'S0201', description: 'Export proceeds' },
    { code: 'S0301', description: 'Royalty and technical fees' },
    { code: 'S0302', description: 'Dividend income' },
    { code: 'S0303', description: 'Interest income' },
    { code: 'S0304', description: 'Commission and brokerage' },
    { code: 'S0305', description: 'Legal services' },
    { code: 'S0306', description: 'Accounting, auditing, bookkeeping' },
    { code: 'S0307', description: 'Business and management consultancy' },
  ],
  personal_remittances: [
    { code: 'S1301', description: 'Maintenance of close relatives abroad' },
    { code: 'S1302', description: 'Education expenses' },
    { code: 'S1303', description: 'Medical treatment abroad' },
    { code: 'S1304', description: 'Gift remittances' },
    { code: 'S1305', description: 'Donations' },
  ],
};
