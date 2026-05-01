import { sql } from "drizzle-orm";
import { boolean, date, decimal, index, integer, jsonb, numeric, pgTable, real, serial, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { agents, agentPerformanceMetrics } from './agents';
import { partners } from './partners';
import { products, Product } from './products';
import { documents, documentEntityTypeEnum } from './documents';
import { investmentProposals } from './proposals-base';
import { users as User, userProfiles, userDematAccounts } from './users';
import { portfolios as Portfolio, watchlists as Watchlist } from './portfolio';
import { bondHoldings } from './bonds';
import { bondOrders, usOrders } from './orders';
import { advisorySessions } from './advisory';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_REGEX = /^[2-9]{1}[0-9]{11}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export const digilockerApps = pgTable("digilocker_apps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appName: varchar("app_name").notNull(),
  appId: varchar("app_id").notNull().unique(),
  apiKey: varchar("api_key").notNull(),
  orgId: varchar("org_id").notNull(),
  domain: varchar("domain").notNull(),
  environment: varchar("environment").default("development"),
  documentTypesAllowed: text("document_types_allowed").array().default(sql`ARRAY['issued', 'uploaded']`),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

export const digilockerSharedDocuments = pgTable("digilocker_shared_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  appId: varchar("app_id").references(() => digilockerApps.id).notNull(),
  documentUri: varchar("document_uri").notNull(),
  documentType: varchar("document_type").notNull(),
  source: varchar("source"),
  transactionId: varchar("transaction_id").notNull(),
  filename: varchar("filename"),
  contentType: varchar("content_type"),
  sharedTill: date("shared_till"),
  documentContent: text("document_content"),
  sharingStatus: varchar("sharing_status").default("shared"),
  sharedAt: timestamp("shared_at").default(sql`NOW()`),
  fetchedAt: timestamp("fetched_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

export const digilockerUserSessions = pgTable("digilocker_user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  appId: varchar("app_id").references(() => digilockerApps.id).notNull(),
  sessionToken: varchar("session_token").notNull(),
  loginTimestamp: timestamp("login_timestamp").notNull(),
  callbackUrl: varchar("callback_url"),
  widgetId: varchar("widget_id"),
  sessionStatus: varchar("session_status").default("active"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

// DigiLocker Zod schemas
export const insertDigilockerAppSchema = createInsertSchema(digilockerApps).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDigilockerSharedDocumentSchema = createInsertSchema(digilockerSharedDocuments).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDigilockerUserSessionSchema = createInsertSchema(digilockerUserSessions).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// DigiLocker types
export type DigilockerApp = typeof digilockerApps.$inferSelect;
export type InsertDigilockerApp = z.infer<typeof insertDigilockerAppSchema>;
export type DigilockerSharedDocument = typeof digilockerSharedDocuments.$inferSelect;
export type InsertDigilockerSharedDocument = z.infer<typeof insertDigilockerSharedDocumentSchema>;
export type DigilockerUserSession = typeof digilockerUserSessions.$inferSelect;
export type InsertDigilockerUserSession = z.infer<typeof insertDigilockerUserSessionSchema>;

 // Dependency from shared/schema.ts

// KYC Verification Sessions
export const kycVerificationSessions = pgTable("kyc_verification_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  sessionType: varchar("session_type").default("smart_kyc_wizard"),
  initiatedBy: varchar("initiated_by").default("customer"),
  entityTypeSupported: varchar("entity_type_detected"),
  entityLocked: boolean("entity_locked").default(false),
  amlRiskLevel: varchar("aml_risk_level"),
  amlScreeningId: varchar("aml_screening_id"),
  ckycConfidenceScore: decimal("ckyc_confidence_score", { precision: 4, scale: 2 }),
  ckycMissingFields: text("ckyc_missing_fields").array().default(sql`'{}'::text[]`),
  aadhaarRequired: boolean("aadhaar_required").default(true),
  videoKycRequired: boolean("video_kyc_required").default(false),
  currentStep: varchar("current_step").notNull().default("pan_verification"),
  sessionOutcome: varchar("session_outcome"),
  stepStatus: jsonb("step_status").default({}),
  panNumber: varchar("pan_number"),
  panDob: date("pan_dob"),
  panVerified: boolean("pan_verified").default(false),
  panVerificationData: jsonb("pan_verification_data"),
  panVerifiedAt: timestamp("pan_verified_at"),
  aadhaarNumber: varchar("aadhaar_number"),
  aadhaarOtpSent: boolean("aadhaar_otp_sent").default(false),
  aadhaarOtpSentAt: timestamp("aadhaar_otp_sent_at"),
  aadhaarOtpVerified: boolean("aadhaar_otp_verified").default(false),
  aadhaarVerifiedAt: timestamp("aadhaar_verified_at"),
  aadhaarVerificationData: jsonb("aadhaar_verification_data"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Compliance Documents
export const complianceDocuments = pgTable("compliance_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  documentType: varchar("document_type").notNull(),
  documentNumber: varchar("document_number"),
  documentUrl: varchar("document_url"),
  originalFileName: varchar("original_file_name"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  verificationStatus: varchar("verification_status").default("pending"),
  verificationDate: timestamp("verification_date"),
  verifiedBy: varchar("verified_by"),
  expiryDate: timestamp("expiry_date"),
  isActive: boolean("is_active").default(true),
  rejectionReason: text("rejection_reason"),
  metadata: jsonb("metadata"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Compliance Audit Trail
export const complianceAuditTrail = pgTable("compliance_audit_trail", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action").notNull(),
  fieldChanged: varchar("field_changed"),
  entityId: varchar("entity_id"),
  entityType: varchar("entity_type"),
  performedBy: varchar("performed_by"),
  performedByRole: varchar("performed_by_role"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  riskImpact: varchar("risk_impact"),
  complianceImpact: varchar("compliance_impact"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  reason: text("reason"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// CKYC Records
export const ckycRecords = pgTable("ckyc_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  ckycNumber: varchar("ckyc_number").unique(),
  applicationNumber: varchar("application_number"),
  firstName: varchar("first_name").notNull(),
  middleName: varchar("middle_name"),
  lastName: varchar("last_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  gender: varchar("gender", { length: 1 }),
  maritalStatus: varchar("marital_status"),
  nationality: varchar("nationality").default("Indian"),
  panNumber: varchar("pan_number").notNull(),
  aadhaarNumber: varchar("aadhar_number"),
  passportNumber: varchar("passport_number"),
  voterIdNumber: varchar("voter_id_number"),
  drivingLicenseNumber: varchar("driving_license_number"),
  mobileNumber: varchar("mobile_number").notNull(),
  emailAddress: varchar("email_address").notNull(),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: varchar("city").notNull(),
  district: varchar("district"),
  state: varchar("state").notNull(),
  pincode: varchar("pincode", { length: 6 }).notNull(),
  country: varchar("country").default("India"),
  addressType: varchar("address_type").default("permanent"),
  occupation: varchar("occupation"),
  annualIncome: varchar("annual_income"),
  netWorth: varchar("net_worth"),
  sourceOfWealth: varchar("source_of_wealth"),
  status: varchar("status").default("pending"),
  verificationLevel: varchar("verification_level"),
  verificationMethod: varchar("verification_method"),
  digilockerVerified: boolean("digilocker_verified").default(false),
  lastVerifiedAt: timestamp("last_verified_at"),
  expiryDate: date("expiry_date"),
  fatcaStatus: varchar("fatca_status"),
  fatcaDeclarationDate: timestamp("fatca_declaration_date"),
  fatcaTinNumber: varchar("fatca_tin_number"),
  fatcaCountryOfTaxResidence: varchar("fatca_country_of_tax_residence"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Smart KYC Progress
export const smartKycProgress = pgTable("smart_kyc_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  step1PanVerified: boolean("step1_pan_verified").default(false),
  step1PanNumber: varchar("step1_pan_number"),
  step1PanName: varchar("step1_pan_name"),
  step1CompletedAt: timestamp("step1_completed_at"),
  step1Data: jsonb("step1_data"),
  step2AadhaarVerified: boolean("step2_aadhaar_verified").default(false),
  step2DigilockerSessionId: varchar("step2_digilocker_session_id"),
  step2CompletedAt: timestamp("step2_completed_at"),
  step2Data: jsonb("step2_data"),
  step3AccountsDiscovered: boolean("step3_accounts_discovered").default(false),
  step3BankAccountsFound: integer("step3_bank_accounts_found").default(0),
  step3DematAccountsFound: integer("step3_demat_accounts_found").default(0),
  step3CompletedAt: timestamp("step3_completed_at"),
  step3Data: jsonb("step3_data"),
  step4ReviewCompleted: boolean("step4_review_completed").default(false),
  step4CompletedAt: timestamp("step4_completed_at"),
  step4ConfirmedData: jsonb("step4_confirmed_data"),
  currentStep: integer("current_step").default(1),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  nameMatchScore: integer("name_match_score"),
  nameReconciliationStatus: varchar("name_reconciliation_status"),
  startedAt: timestamp("started_at").defaultNow(),
  lastUpdatedStep: integer("last_updated_step"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Corporate KYC Progress
export const corporateKycProgress = pgTable("corporate_kyc_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  step1CorporatePanVerified: boolean("step1_corporate_pan_verified").default(false),
  step1CorporatePan: varchar("step1_corporate_pan"),
  step1CompanyName: varchar("step1_company_name"),
  step1CompanyType: varchar("step1_company_type"),
  step1CompletedAt: timestamp("step1_completed_at"),
  step1Data: jsonb("step1_data"),
  step2DocumentsUploaded: boolean("step2_documents_uploaded").default(false),
  step2CertificateOfIncorporation: varchar("step2_coi_url"),
  step2MemorandumOfAssociation: varchar("step2_moa_url"),
  step2ArticlesOfAssociation: varchar("step2_aoa_url"),
  step2BoardResolution: varchar("step2_board_resolution_url"),
  step2CompletedAt: timestamp("step2_completed_at"),
  step2Data: jsonb("step2_data"),
  step3SignatoryVerified: boolean("step3_signatory_verified").default(false),
  step3SignatoryName: varchar("step3_signatory_name"),
  step3SignatoryAadhaar: varchar("step3_signatory_aadhaar_last_four"),
  step3SignatoryDesignation: varchar("step3_signatory_designation"),
  step3DigilockerSessionId: varchar("step3_digilocker_session_id"),
  step3CompletedAt: timestamp("step3_completed_at"),
  step3Data: jsonb("step3_data"),
  step4AccountsDiscovered: boolean("step4_accounts_discovered").default(false),
  step4BankAccountsFound: integer("step4_bank_accounts_found").default(0),
  step4DematAccountsFound: integer("step4_demat_accounts_found").default(0),
  step4CompletedAt: timestamp("step4_completed_at"),
  step4Data: jsonb("step4_data"),
  step5ReviewCompleted: boolean("step5_review_completed").default(false),
  step5CompletedAt: timestamp("step5_completed_at"),
  step5ConfirmedData: jsonb("step5_confirmed_data"),
  currentStep: integer("current_step").default(1),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  cin: varchar("cin"),
  gstin: varchar("gstin"),
  startedAt: timestamp("started_at").defaultNow(),
  lastUpdatedStep: integer("last_updated_step"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// NRI KYC Progress
export const nriKycProgress = pgTable("nri_kyc_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  step1Verified: boolean("step1_verified").default(false),
  step1PanNumber: varchar("step1_pan_number"),
  step1PassportNumber: varchar("step1_passport_number").notNull(),
  step1PassportName: varchar("step1_passport_name"),
  step1PassportExpiry: date("step1_passport_expiry"),
  step1CountryOfResidence: varchar("step1_country_of_residence"),
  step1CompletedAt: timestamp("step1_completed_at"),
  step1Data: jsonb("step1_data"),
  step2AddressVerified: boolean("step2_address_verified").default(false),
  step2OverseasAddressLine1: text("step2_overseas_address_line1"),
  step2OverseasAddressLine2: text("step2_overseas_address_line2"),
  step2OverseasCity: varchar("step2_overseas_city"),
  step2OverseasState: varchar("step2_overseas_state"),
  step2OverseasCountry: varchar("step2_overseas_country"),
  step2OverseasPostalCode: varchar("step2_overseas_postal_code"),
  step2AddressProofDocUrl: varchar("step2_address_proof_doc_url"),
  step2CompletedAt: timestamp("step2_completed_at"),
  step2Data: jsonb("step2_data"),
  step3PisVerified: boolean("step3_pis_verified").default(false),
  step3PisPermissionLetterUrl: varchar("step3_pis_permission_letter_url"),
  step3PisBankName: varchar("step3_pis_bank_name"),
  step3PisBranchName: varchar("step3_pis_branch_name"),
  step3ForeignBankAccountNumber: varchar("step3_foreign_bank_account_number"),
  step3ForeignBankName: varchar("step3_foreign_bank_name"),
  step3ForeignBankCountry: varchar("step3_foreign_bank_country"),
  step3SwiftCode: varchar("step3_swift_code"),
  step3CompletedAt: timestamp("step3_completed_at"),
  step3Data: jsonb("step3_data"),
  step4FatcaCompleted: boolean("step4_fatca_completed").default(false),
  step4TaxResidencyCountry: varchar("tax_residency_country"),
  step4TaxIdentificationNumber: varchar("step4_tax_identification_number"),
  step4UsCitizen: boolean("step4_us_citizen").default(false),
  step4GreenCardHolder: boolean("step4_green_card_holder").default(false),
  step4FatcaDeclarationUrl: varchar("step4_fatca_declaration_url"),
  step4CrsDeclarationUrl: varchar("step4_crs_declaration_url"),
  step4CompletedAt: timestamp("step4_completed_at"),
  step4Data: jsonb("step4_data"),
  step5ReviewCompleted: boolean("step5_review_completed").default(false),
  step5CompletedAt: timestamp("step5_completed_at"),
  step5ConfirmedData: jsonb("step5_confirmed_data"),
  currentStep: integer("current_step").default(1),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  nriStatus: varchar("nri_status"),
  investmentType: varchar("investment_type"),
  startedAt: timestamp("started_at").defaultNow(),
  lastUpdatedStep: integer("last_updated_step"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CKYC Documents
export const ckycDocuments = pgTable("ckyc_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ckycRecordId: varchar("ckyc_record_id").references(() => ckycRecords.id).notNull(),
  documentType: varchar("document_type").notNull(),
  documentNumber: varchar("document_number"),
  documentUrl: varchar("document_url"),
  verificationStatus: varchar("verification_status").default("pending"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  verifiedAt: timestamp("verified_at"),
});

// CKYC Status History
export const ckycStatusHistory = pgTable("ckyc_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ckycRecordId: varchar("ckyc_record_id").references(() => ckycRecords.id).notNull(),
  previousStatus: varchar("previous_status"),
  newStatus: varchar("new_status").notNull(),
  changedBy: varchar("changed_by"),
  reason: text("reason"),
  metadata: jsonb("metadata"),
  changedAt: timestamp("changed_at").defaultNow(),
});

// KYC Upgrade Reminders
export const kycUpgradeReminders = pgTable("kyc_upgrade_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  reminderType: varchar("reminder_type").notNull(),
  reminderSequence: integer("reminder_sequence").notNull(),
  currentKycTier: varchar("current_kyc_tier").notNull(),
  targetKycTier: varchar("target_kyc_tier").notNull(),
  missingSteps: text("missing_steps").array(),
  emailSent: boolean("email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  inAppCreated: boolean("in_app_created").default(false),
  inAppNotificationId: varchar("in_app_notification_id"),
  smsSent: boolean("sms_sent").default(false),
  smsSentAt: timestamp("sms_sent_at"),
  userAcknowledged: boolean("user_acknowledged").default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  sentAt: timestamp("sent_at"),
  status: varchar("status").default("pending"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// KYC Consent Logs
export const kycConsentLogs = pgTable("kyc_consent_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  partnerId: varchar("partner_id").notNull(),
  purpose: text("purpose").notNull(),
  consentType: varchar("consent_type").notNull(),
  dataShared: jsonb("data_shared").notNull(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  consentTimestamp: timestamp("consent_timestamp").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isRevoked: boolean("is_revoked").default(false),
  revokedAt: timestamp("revoked_at"),
  metadata: jsonb("metadata"),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  consentGiven: boolean("consent_given").default(true),
  consentText: text("consent_text"),
  consentSignature: text("consent_signature"),
}, (table) => [
  index("idx_kyc_consent_user_partner").on(table.userId, table.partnerId),
  index("idx_kyc_consent_prospect").on(table.prospectId),
]);

// KYC Regulatory Audit Logs
export const kycRegulatoryAuditLogs = pgTable("kyc_regulatory_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  serviceProvider: varchar("service_provider").notNull(),
  apiEndpoint: text("api_endpoint").notNull(),
  requestType: varchar("request_type").notNull(),
  requestHash: text("request_hash").notNull(),
  responseHash: text("response_hash").notNull(),
  status: varchar("status").notNull(),
  latencyMs: integer("latency_ms"),
  traceId: varchar("trace_id").notNull(),
  regulatoryReference: varchar("regulatory_reference"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_kyc_audit_user").on(table.userId),
  index("idx_kyc_audit_provider").on(table.serviceProvider),
  index("idx_kyc_audit_created_at").on(table.createdAt),
]);

// KYC Vault
export const kycVault = pgTable("kyc_vault", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  encryptedFullName: text("encrypted_full_name"),
  encryptedDateOfBirth: text("encrypted_date_of_birth"),
  encryptedGender: text("encrypted_gender"),
  encryptedFatherName: text("encrypted_father_name"),
  encryptedAddress: text("encrypted_address"),
  encryptedCity: text("encrypted_city"),
  encryptedState: text("encrypted_state"),
  encryptedPincode: text("encrypted_pincode"),
  encryptedMobile: text("encrypted_mobile"),
  encryptedEmail: text("encrypted_email"),
  tokenizedPan: varchar("tokenized_pan"),
  tokenizedAadhaar: varchar("tokenized_aadhaar"),
  tokenizedCkycKin: varchar("tokenized_ckyc_kin"),
  aadhaarLast4: varchar("aadhaar_last_4", { length: 4 }),
  faceImageHash: varchar("face_image_hash"),
  faceImageHashAlgorithm: varchar("face_image_hash_algorithm").default("SHA-256"),
  kycStatus: varchar("kyc_status").default("pending"),
  ckycStatus: varchar("ckyc_status").default("not_checked"),
  source: varchar("source").notNull(),
  verificationMethod: varchar("verification_method"),
  isReusable: boolean("is_reusable").default(false),
  encryptedCkycKin: text("encrypted_ckyc_kin"),
  ckycRegistrationDate: timestamp("ckyc_registration_date"),
  ckycExpiryDate: timestamp("ckyc_expiry_date"),
  ckycVerificationLevel: varchar("ckyc_verification_level"),
  cashfreeRefId: varchar("cashfree_ref_id"),
  aadhaarVerifiedAt: timestamp("aadhaar_verified_at"),
  panVerifiedAt: timestamp("pan_verified_at"),
  addressVerifiedAt: timestamp("address_verified_at"),
  kycVerifiedAt: timestamp("kyc_verified_at").defaultNow(),
  kycExpiryDate: timestamp("kyc_expiry_date"),
  kycNextRenewalDate: timestamp("kyc_next_renewal_date"),
  isExpired: boolean("is_expired").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kyc_vault_user").on(table.userId),
  index("idx_kyc_vault_status").on(table.kycStatus),
]);

// KYC Audit Logs
export const kycAuditLogs = pgTable("kyc_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  accessedBy: varchar("accessed_by"),
  accessType: varchar("access_type").notNull(),
  dataFieldsAccessed: jsonb("data_fields_accessed"),
  purpose: text("purpose").notNull(),
  apiEndpoint: varchar("api_endpoint"),
  externalParty: varchar("external_party"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  requestId: varchar("request_id"),
  accessStatus: varchar("access_status").default("success"),
  failureReason: text("failure_reason"),
  regulatoryPurpose: varchar("regulatory_purpose"),
  complianceCheckPassed: boolean("compliance_check_passed").default(true),
  accessedAt: timestamp("accessed_at").defaultNow(),
}, (table) => [
  index("idx_kyc_audit_log_user").on(table.userId),
  index("idx_kyc_audit_accessed_by").on(table.accessedBy),
  index("idx_kyc_audit_type").on(table.accessType),
  index("idx_kyc_audit_timestamp").on(table.accessedAt),
]);

// KYC Token Map
export const kycTokenMap = pgTable("kyc_token_map", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token").notNull().unique(),
  encryptedOriginalValue: text("encrypted_original_value").notNull(),
  fieldType: varchar("field_type").notNull(),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("idx_kyc_token_map_token").on(table.token),
  index("idx_kyc_token_map_user").on(table.userId),
]);

// KYC Reuse Tokens
export const kycReuseTokens = pgTable("kyc_reuse_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenId: varchar("token_id").notNull().unique(),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  encryptedJwtPayload: text("encrypted_jwt_payload").notNull(),
  jwtSignature: text("jwt_signature").notNull(),
  tokenPurpose: varchar("token_purpose"),
  issuedTo: varchar("issued_to"),
  scope: jsonb("scope"),
  isActive: boolean("is_active").default(true),
  isRevoked: boolean("is_revoked").default(false),
  revokedAt: timestamp("revoked_at"),
  revokeReason: text("revoke_reason"),
  issuedAt: timestamp("issued_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// CKYC Notification Triggers
export const ckycNotificationTriggers = pgTable("ckyc_notification_triggers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ckycRecordId: varchar("ckyc_record_id").references(() => ckycRecords.id).notNull(),
  triggerType: varchar("trigger_type").notNull(),
  notificationMethod: varchar("notification_method").notNull(),
  recipientEmail: varchar("recipient_email"),
  recipientMobile: varchar("recipient_mobile"),
  subject: varchar("subject").notNull(),
  message: text("message").notNull(),
  status: varchar("status").default("pending"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  failureReason: text("failure_reason"),
  triggerredBy: varchar("triggerred_by"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// CKYC Progress Steps
export const ckycProgressSteps = pgTable("ckyc_progress_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ckycRecordId: varchar("ckyc_record_id").references(() => ckycRecords.id).notNull(),
  stepName: varchar("step_name").notNull(),
  stepStatus: varchar("step_status").notNull(),
  stepDescription: text("step_description"),
  completedAt: timestamp("completed_at"),
  completedBy: varchar("completed_by"),
  estimatedCompletionTime: integer("estimated_completion_time"),
  actualCompletionTime: integer("actual_completion_time"),
  stepOrder: integer("step_order").notNull(),
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// CKYC Action Logs
export const ckycActionLogs = pgTable("ckyc_action_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ckycRecordId: varchar("ckyc_record_id").references(() => ckycRecords.id).notNull(),
  actionType: varchar("action_type").notNull(),
  actionBy: varchar("action_by").notNull(),
  actionByType: varchar("action_by_type").notNull(),
  actionDetails: text("action_details").notNull(),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  actionAt: timestamp("action_at").defaultNow(),
});

// KYC Form Progress
export const kycFormProgress = pgTable("kyc_form_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  ckycRecordId: varchar("ckyc_record_id").references(() => ckycRecords.id),
  currentStep: integer("current_step").default(1),
  completedSteps: jsonb("completed_steps").default([]),
  completionPercentage: integer("completion_percentage").default(0),
  personalDetailsData: jsonb("personal_details_data"),
  addressDetailsData: jsonb("address_details_data"),
  bankDetailsData: jsonb("bank_details_data"),
  documentDetailsData: jsonb("document_details_data"),
  panDataSource: varchar("pan_data_source"),
  aadharDataSource: varchar("aadhar_data_source"),
  addressDataSource: varchar("address_data_source"),
  autoPopulatedFields: jsonb("auto_populated_fields"),
  canResume: boolean("can_resume").default(true),
  lastSavedAt: timestamp("last_saved_at").defaultNow(),
  resumeUrl: varchar("resume_url"),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Manual KYC Submissions
export const manualKycSubmissions = pgTable("manual_kyc_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  applicantType: varchar("applicant_type").notNull(),
  pan: varchar("pan").notNull(),
  email: varchar("email").notNull(),
  mobile: varchar("mobile").notNull(),
  address: text("address").notNull(),
  city: varchar("city").notNull(),
  state: varchar("state").notNull(),
  pincode: varchar("pincode").notNull(),
  firstName: varchar("first_name"),
  middleName: varchar("middle_name"),
  lastName: varchar("last_name"),
  dateOfBirth: varchar("date_of_birth"),
  fatherName: varchar("father_name"),
  motherName: varchar("mother_name"),
  companyName: varchar("company_name"),
  registrationNumber: varchar("registration_number"),
  incorporationDate: varchar("incorporation_date"),
  authorizedSignatoryName: varchar("authorized_signatory_name"),
  countryOfResidence: varchar("country_of_residence"),
  passportNumber: varchar("passport_number"),
  visaType: varchar("visa_type"),
  documents: jsonb("documents").notNull(),
  status: varchar("status").default("pending_review"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),
  amlStatus: varchar("aml_status").default("pending"),
  amlCheckedAt: timestamp("aml_checked_at"),
  verificationScore: integer("verification_score"),
  submittedFrom: varchar("submitted_from"),
  userAgent: text("user_agent"),
  submissionChannel: varchar("submission_channel").default("web"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Manual KYC Documents
export const manualKycDocuments = pgTable("manual_kyc_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").references(() => manualKycSubmissions.id).notNull(),
  documentType: varchar("document_type").notNull(),
  documentUrl: text("document_url").notNull(),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  verificationStatus: varchar("verification_status").default("pending"),
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  verificationNotes: text("verification_notes"),
});

// KYC Step Resets
export const kycStepResets = pgTable("kyc_step_resets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => kycVerificationSessions.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  step: varchar("step").notNull(),
  previousStatus: jsonb("previous_status"),
  resetBy: varchar("reset_by").references(() => users.id).notNull(),
  resetByRole: varchar("reset_by_role"),
  reason: text("reason").notNull(),
  reasonCode: varchar("reason_code").notNull(),
  dependentStepsReset: text("dependent_steps_reset").array().default(sql`'{}'::text[]`),
  resetAt: timestamp("reset_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_kyc_step_reset_session").on(table.sessionId),
  index("idx_kyc_step_reset_user").on(table.userId),
  index("idx_kyc_step_reset_step").on(table.step),
]);

// KYC Product Eligibility Rules
export const kycProductEligibilityRules = pgTable("kyc_product_eligibility_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productCode: varchar("product_code").notNull(),
  productName: varchar("product_name").notNull(),
  requiredTier: varchar("required_tier").notNull(),
  requiredTierStatus: varchar("required_tier_status").default("final"),
  maxAmount: decimal("max_amount", { precision: 15, scale: 2 }),
  conditions: text("conditions").array().default(sql`'{}'::text[]`),
  requireVideoKyc: boolean("require_video_kyc").default(false),
  requireMakerChecker: boolean("require_maker_checker").default(false),
  amlMaxRisk: varchar("aml_max_risk").default("MEDIUM"),
  isActive: boolean("is_active").default(true),
  regulatoryBasis: text("regulatory_basis"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kyc_eligibility_product").on(table.productCode),
  index("idx_kyc_eligibility_tier").on(table.requiredTier),
]);

// KYC Audit Packs
export const kycAuditPacks = pgTable("kyc_audit_packs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sessionId: varchar("session_id").references(() => kycVerificationSessions.id),
  generatedBy: varchar("generated_by").references(() => users.id).notNull(),
  generatedByRole: varchar("generated_by_role"),
  packType: varchar("pack_type").default("full"),
  checksum: varchar("checksum"),
  sections: text("sections").array().default(sql`'{}'::text[]`),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  expiresAt: timestamp("expires_at"),
  downloadCount: integer("download_count").default(0),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_kyc_audit_pack_user").on(table.userId),
  index("idx_kyc_audit_pack_session").on(table.sessionId),
  index("idx_kyc_audit_pack_generated_at").on(table.generatedAt),
]);

// KYC Webhook Events
export const kycWebhookEvents = pgTable("kyc_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: varchar("provider").notNull(),
  eventType: varchar("event_type").notNull(),
  referenceId: varchar("reference_id"),
  sessionId: varchar("session_id"),
  payload: jsonb("payload"),
  status: varchar("status").notNull().default("PENDING"),
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(5),
  nextRetryAt: timestamp("next_retry_at"),
  lastError: text("last_error"),
  processedAt: timestamp("processed_at"),
  dlqAt: timestamp("dlq_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_kyc_webhook_provider").on(table.provider),
  index("idx_kyc_webhook_status").on(table.status),
  index("idx_kyc_webhook_retry").on(table.nextRetryAt),
  index("idx_kyc_webhook_reference").on(table.referenceId),
]);

// KYC Rate Limit Counters
export const kycRateLimitCounters = pgTable("kyc_rate_limit_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  limitKey: varchar("limit_key").notNull(),
  limitType: varchar("limit_type").notNull(),
  identifierType: varchar("identifier_type").notNull(),
  identifier: varchar("identifier").notNull(),
  windowStart: timestamp("window_start").notNull(),
  windowEnd: timestamp("window_end").notNull(),
  count: integer("count").default(0).notNull(),
  maxAllowed: integer("max_allowed").notNull(),
  isLocked: boolean("is_locked").default(false),
  lockedAt: timestamp("locked_at"),
  lockedReason: text("locked_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_kyc_rate_key").on(table.limitKey),
  index("idx_kyc_rate_type").on(table.limitType),
  index("idx_kyc_rate_window").on(table.windowStart, table.windowEnd),
]);

// KYC Providers
export const kycProviders = pgTable("kyc_providers", {
  id: serial("id").primaryKey(),
  providerCode: varchar("provider_code", { length: 50 }).unique().notNull(),
  providerName: varchar("provider_name", { length: 200 }).notNull(),
  providerDescription: text("provider_description"),
  providerType: varchar("provider_type", { length: 50 }).notNull(),
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  pricePerCall: decimal("price_per_call", { precision: 10, scale: 2 }).default("0"),
  isEnabled: boolean("is_enabled").default(true),
  isConfigured: boolean("is_configured").default(false),
  requiredEnvVars: jsonb("required_env_vars"),
  features: jsonb("features"),
  healthStatus: varchar("health_status", { length: 20 }).default("unknown"),
  lastHealthCheck: timestamp("last_health_check"),
  errorRate: real("error_rate").default(0),
  avgLatencyMs: integer("avg_latency_ms").default(0),
  totalCalls: integer("total_calls").default(0),
  successfulCalls: integer("successful_calls").default(0),
  failedCalls: integer("failed_calls").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// KYC Provider Priority
export const kycProviderPriority = pgTable("kyc_provider_priority", {
  id: serial("id").primaryKey(),
  kycStep: varchar("kyc_step", { length: 50 }).notNull(),
  providerId: integer("provider_id").references(() => kycProviders.id).notNull(),
  priority: integer("priority").notNull().default(1),
  isActive: boolean("is_active").default(true),
  productScope: jsonb("product_scope"),
  fallbackErrorCodes: jsonb("fallback_error_codes"),
  maxRetries: integer("max_retries").default(3),
  timeoutMs: integer("timeout_ms").default(30000),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// KYC Flow Versions
export const kycFlowVersions = pgTable("kyc_flow_versions", {
  id: serial("id").primaryKey(),
  version: varchar("version", { length: 20 }).notNull(),
  flowName: varchar("flow_name", { length: 100 }).notNull(),
  description: text("description"),
  steps: jsonb("steps").notNull(),
  productType: varchar("product_type", { length: 50 }).notNull(),
  isActive: boolean("is_active").default(false),
  regulatoryBasis: text("regulatory_basis"),
  createdBy: varchar("created_by").references(() => users.id),
  activatedAt: timestamp("activated_at"),
  deactivatedAt: timestamp("deactivated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// KYC Video Sessions
export const kycVideoSessions = pgTable("kyc_video_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => kycVerificationSessions.id),
  userId: varchar("user_id").references(() => users.id),
  reason: varchar("reason").notNull(),
  status: varchar("status").notNull().default("PENDING"),
  provider: varchar("provider").default("internal"),
  scheduledAt: timestamp("scheduled_at"),
  joinUrl: text("join_url"),
  recordingHash: varchar("recording_hash"),
  officerId: varchar("officer_id").references(() => users.id),
  officerNotes: text("officer_notes"),
  completedAt: timestamp("completed_at"),
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_video_kyc_user").on(table.userId),
  index("idx_video_kyc_session").on(table.sessionId),
  index("idx_video_kyc_status").on(table.status),
]);

// KYC Approvals
export const kycApprovals = pgTable("kyc_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => kycVerificationSessions.id),
  userId: varchar("user_id").references(() => users.id),
  entityType: varchar("entity_type").notNull(),
  makerId: varchar("maker_id").references(() => users.id).notNull(),
  checkerId: varchar("checker_id").references(() => users.id),
  status: varchar("status").notNull().default("PENDING"),
  makerNotes: text("maker_notes"),
  checkerNotes: text("checker_notes"),
  rejectionReason: text("rejection_reason"),
  checkerIpAddress: varchar("checker_ip_address"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_kyc_approval_session").on(table.sessionId),
  index("idx_kyc_approval_status").on(table.status),
  index("idx_kyc_approval_maker").on(table.makerId),
  index("idx_kyc_approval_checker").on(table.checkerId),
]);

// KYC Rejection Events
export const kycRejectionEvents = pgTable("kyc_rejection_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => kycVerificationSessions.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  reasonCode: varchar("reason_code").notNull(),
  reasonDescription: text("reason_description"),
  rejectedBy: varchar("rejected_by").references(() => users.id).notNull(),
  rejectedByRole: varchar("rejected_by_role"),
  rekycRequired: boolean("rekyc_required").default(false),
  newSessionId: varchar("new_session_id"),
  disputeNotes: text("dispute_notes"),
  disputeStatus: varchar("dispute_status"),
  disputeResolvedAt: timestamp("dispute_resolved_at"),
  rejectedAt: timestamp("rejected_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_kyc_rejection_session").on(table.sessionId),
  index("idx_kyc_rejection_user").on(table.userId),
  index("idx_kyc_rejection_code").on(table.reasonCode),
]);

// CKYC Provider Config
export const ckycProviderConfig = pgTable("ckyc_provider_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerCode: varchar("provider_code", { length: 50 }).notNull().unique(),
  providerName: varchar("provider_name", { length: 100 }).notNull(),
  providerDescription: text("provider_description"),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  priority: integer("priority").default(100).notNull(),
  environment: varchar("environment", { length: 20 }).default("all"),
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: varchar("health_status", { length: 20 }).default("unknown"),
  consecutiveFailures: integer("consecutive_failures").default(0),
  autoDisabledAt: timestamp("auto_disabled_at"),
  apiConfig: jsonb("api_config").default({}),
  eligibilityRules: jsonb("eligibility_rules").default({}),
  rateLimitPerMinute: integer("rate_limit_per_minute").default(100),
  rateLimitPerDay: integer("rate_limit_per_day").default(10000),
  currentMinuteCount: integer("current_minute_count").default(0),
  currentDayCount: integer("current_day_count").default(0),
  rateLimitResetAt: timestamp("rate_limit_reset_at"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("idx_ckyc_provider_code").on(table.providerCode),
  index("idx_ckyc_provider_enabled").on(table.isEnabled),
  index("idx_ckyc_provider_priority").on(table.priority),
]);

// CKYC Provider Audit Log
export const ckycProviderAuditLog = pgTable("ckyc_provider_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => ckycProviderConfig.id).notNull(),
  providerCode: varchar("provider_code", { length: 50 }).notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  changeReason: text("change_reason"),
  performedBy: varchar("performed_by").references(() => users.id),
  performedByRole: varchar("performed_by_role", { length: 50 }),
  performedByIp: varchar("performed_by_ip", { length: 45 }),
  isSystemAction: boolean("is_system_action").default(false),
  systemTrigger: varchar("system_trigger", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ckyc_audit_provider").on(table.providerId),
  index("idx_ckyc_audit_action").on(table.action),
  index("idx_ckyc_audit_time").on(table.createdAt),
]);

// CKYC Verification Requests
export const ckycVerificationRequests = pgTable("ckyc_verification_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  panNumber: varchar("pan_number", { length: 10 }).notNull(),
  requestType: varchar("request_type", { length: 50 }).default("verification"),
  selectedProvider: varchar("selected_provider", { length: 50 }).notNull(),
  providerSelectionReason: text("provider_selection_reason"),
  fallbackAttempts: jsonb("fallback_attempts").default([]),
  requestPayload: jsonb("request_payload"),
  responseStatus: varchar("response_status", { length: 50 }),
  responseCode: varchar("response_code", { length: 50 }),
  responseMessage: text("response_message"),
  ckycFound: boolean("ckyc_found"),
  ckycKin: varchar("ckyc_kin", { length: 50 }),
  ckycStatus: varchar("ckyc_status", { length: 50 }),
  responseTimeMs: integer("response_time_ms"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_ckyc_req_user").on(table.userId),
  index("idx_ckyc_req_pan").on(table.panNumber),
  index("idx_ckyc_req_provider").on(table.selectedProvider),
  index("idx_ckyc_req_status").on(table.responseStatus),
  index("idx_ckyc_req_time").on(table.requestedAt),
]);

// CKYC Deferred Cases
export const ckycDeferredCases = pgTable("ckyc_deferred_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  panNumber: varchar("pan_number", { length: 10 }).notNull(),
  status: varchar("status", { length: 50 }).default("ckyc_deferred").notNull(),
  deferralCode: varchar("deferral_code", { length: 50 }).notNull(),
  deferralMessage: text("deferral_message"),
  lastProviderAttempted: varchar("last_provider_attempted", { length: 50 }),
  fallbackAttempts: jsonb("fallback_attempts").default([]),
  slaStartedAt: timestamp("sla_started_at").defaultNow().notNull(),
  slaDeadline: timestamp("sla_deadline").notNull(),
  slaBreach: boolean("sla_breach").default(false),
  slaBreachedAt: timestamp("sla_breached_at"),
  assignedToAdmin: varchar("assigned_to_admin").references(() => users.id),
  adminAction: varchar("admin_action", { length: 50 }),
  adminActionReason: text("admin_action_reason"),
  adminActionAt: timestamp("admin_action_at"),
  resolvedAt: timestamp("resolved_at"),
  resolutionMethod: varchar("resolution_method", { length: 50 }),
  resolutionNotes: text("resolution_notes"),
  escalationLevel: integer("escalation_level").default(0),
  escalatedAt: timestamp("escalated_at"),
  escalatedTo: varchar("escalated_to").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ckyc_deferred_user").on(table.userId),
  index("idx_ckyc_deferred_pan").on(table.panNumber),
  index("idx_ckyc_deferred_status").on(table.status),
  index("idx_ckyc_deferred_sla").on(table.slaDeadline),
  index("idx_ckyc_deferred_breach").on(table.slaBreach),
  index("idx_ckyc_deferred_assigned").on(table.assignedToAdmin),
]);

// DigiLocker KYC Mappings
export const digilockerKycMappings = pgTable("digilocker_kyc_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  documentType: varchar("document_type").notNull(),
  digilockerDocId: varchar("digilocker_doc_id").references(() => digilockerSharedDocuments.id),
  kycFieldName: varchar("kyc_field_name").notNull(),
  verificationStatus: varchar("verification_status").default("pending"),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by"),
  autoPopulated: boolean("auto_populated").default(false),
  createdAt: timestamp("created_at").default(sql`NOW()`),
  updatedAt: timestamp("updated_at").default(sql`NOW()`),
});

// Cons consolidated Zod Schemas
export const insertKycVerificationSessionSchema = createInsertSchema(kycVerificationSessions).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  panNumber: z.string().regex(PAN_REGEX, "Invalid PAN format").optional().nullable(),
  aadhaarNumber: z.string().regex(AADHAAR_REGEX, "Invalid Aadhaar format").optional().nullable(),
});

export const insertComplianceDocumentSchema = createInsertSchema(complianceDocuments).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplianceAuditTrailSchema = createInsertSchema(complianceAuditTrail).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertCkycRecordSchema = createInsertSchema(ckycRecords).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  panNumber: z.string().regex(PAN_REGEX, "Invalid PAN format"),
  aadhaarNumber: z.string().regex(AADHAAR_REGEX, "Invalid Aadhaar format").optional().nullable(),
  pincode: z.string().regex(PINCODE_REGEX, "Invalid Pincode format"),
});

export const insertSmartKycProgressSchema = createInsertSchema(smartKycProgress).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCorporateKycProgressSchema = createInsertSchema(corporateKycProgress).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertNriKycProgressSchema = createInsertSchema(nriKycProgress).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCkycDocumentSchema = createInsertSchema(ckycDocuments).extend({
  id: z.any(),
  uploadedAt: z.any(),
  verifiedAt: z.any(),
}).omit({
  id: true,
  uploadedAt: true,
  verifiedAt: true,
});

export const insertKycUpgradeReminderSchema = createInsertSchema(kycUpgradeReminders).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertKycConsentLogSchema = createInsertSchema(kycConsentLogs).extend({
  id: z.any(),
  consentTimestamp: z.any(),
}).omit({
  id: true,
  consentTimestamp: true,
});

export const insertKycRegulatoryAuditLogSchema = createInsertSchema(kycRegulatoryAuditLogs).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertKycAuditLogSchema = createInsertSchema(kycAuditLogs).extend({
  id: z.any(),
  accessedAt: z.any(),
}).omit({
  id: true,
  accessedAt: true,
});

export const insertKycTokenMapSchema = createInsertSchema(kycTokenMap).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertKycReuseTokenSchema = createInsertSchema(kycReuseTokens).extend({
  id: z.any(),
  issuedAt: z.any(),
}).omit({
  id: true,
  issuedAt: true,
});

export const insertKycVaultSchema = createInsertSchema(kycVault).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCkycNotificationTriggerSchema = createInsertSchema(ckycNotificationTriggers).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true, createdAt: true,
});

export const insertCkycProgressStepSchema = createInsertSchema(ckycProgressSteps).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const insertCkycActionLogSchema = createInsertSchema(ckycActionLogs).extend({
  id: z.any(),
  actionAt: z.any(),
}).omit({
  id: true, actionAt: true,
});

export const insertKycFormProgressSchema = createInsertSchema(kycFormProgress).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const insertManualKycSubmissionSchema = createInsertSchema(manualKycSubmissions).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  pan: z.string().regex(PAN_REGEX, "Invalid PAN format"),
  pincode: z.string().regex(PINCODE_REGEX, "Invalid Pincode format"),
});

export const insertManualKycDocumentSchema = createInsertSchema(manualKycDocuments).extend({
  id: z.any(),
  uploadedAt: z.any(),
}).omit({
  id: true, uploadedAt: true,
});

export const insertKycStepResetSchema = createInsertSchema(kycStepResets).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true, createdAt: true,
});

export const insertKycProductEligibilityRuleSchema = createInsertSchema(kycProductEligibilityRules).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const insertKycAuditPackSchema = createInsertSchema(kycAuditPacks).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true, createdAt: true,
});

export const insertKycWebhookEventSchema = createInsertSchema(kycWebhookEvents).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true, createdAt: true,
});

export const insertKycRateLimitCounterSchema = createInsertSchema(kycRateLimitCounters).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true, createdAt: true,
});

export const insertKycProviderSchema = createInsertSchema(kycProviders).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKycProviderPrioritySchema = createInsertSchema(kycProviderPriority).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKycFlowVersionSchema = createInsertSchema(kycFlowVersions).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertKycVideoSessionSchema = createInsertSchema(kycVideoSessions).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true, createdAt: true, updatedAt: true,
});

export const insertKycApprovalSchema = createInsertSchema(kycApprovals).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true, createdAt: true,
});

export const insertKycRejectionEventSchema = createInsertSchema(kycRejectionEvents).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true, createdAt: true,
});

export const insertCkycProviderConfigSchema = createInsertSchema(ckycProviderConfig).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertCkycProviderAuditLogSchema = createInsertSchema(ckycProviderAuditLog).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export const insertCkycVerificationRequestSchema = createInsertSchema(ckycVerificationRequests).extend({
  id: z.any(),
  requestedAt: z.any(),
}).omit({ id: true, requestedAt: true });

export const insertCkycDeferredCaseSchema = createInsertSchema(ckycDeferredCases).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertDigilockerKycMappingSchema = createInsertSchema(digilockerKycMappings).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// TypeScript Types
export type KycVerificationSession = typeof kycVerificationSessions.$inferSelect;
export type InsertKycVerificationSession = z.infer<typeof insertKycVerificationSessionSchema>;

export type ComplianceDocument = typeof complianceDocuments.$inferSelect;
export type InsertComplianceDocument = z.infer<typeof insertComplianceDocumentSchema>;

export type ComplianceAuditTrail = typeof complianceAuditTrail.$inferSelect;
export type InsertComplianceAuditTrail = z.infer<typeof insertComplianceAuditTrailSchema>;

export type CkycRecord = typeof ckycRecords.$inferSelect;
export type InsertCkycRecord = z.infer<typeof insertCkycRecordSchema>;
export type UpsertCkycRecord = typeof ckycRecords.$inferInsert;

export type SmartKycProgress = typeof smartKycProgress.$inferSelect;
export type InsertSmartKycProgress = z.infer<typeof insertSmartKycProgressSchema>;

export type CorporateKycProgress = typeof corporateKycProgress.$inferSelect;
export type InsertCorporateKycProgress = z.infer<typeof insertCorporateKycProgressSchema>;

export type NriKycProgress = typeof nriKycProgress.$inferSelect;
export type InsertNriKycProgress = z.infer<typeof insertNriKycProgressSchema>;

export type CkycDocument = typeof ckycDocuments.$inferSelect;
export type InsertCkycDocument = z.infer<typeof insertCkycDocumentSchema>;

export type KycUpgradeReminder = typeof kycUpgradeReminders.$inferSelect;
export type InsertKycUpgradeReminder = z.infer<typeof insertKycUpgradeReminderSchema>;

export type KycConsentLog = typeof kycConsentLogs.$inferSelect;
export type InsertKycConsentLog = z.infer<typeof insertKycConsentLogSchema>;

export type KycRegulatoryAuditLog = typeof kycRegulatoryAuditLogs.$inferSelect;
export type InsertKycRegulatoryAuditLog = z.infer<typeof insertKycRegulatoryAuditLogSchema>;

export type KycAuditLog = typeof kycAuditLogs.$inferSelect;
export type InsertKycAuditLog = z.infer<typeof insertKycAuditLogSchema>;

export type KycTokenMap = typeof kycTokenMap.$inferSelect;
export type InsertKycTokenMap = z.infer<typeof insertKycTokenMapSchema>;

export type KycReuseToken = typeof kycReuseTokens.$inferSelect;
export type InsertKycReuseToken = z.infer<typeof insertKycReuseTokenSchema>;

export type KycVault = typeof kycVault.$inferSelect;
export type InsertKycVault = z.infer<typeof insertKycVaultSchema>;

export type CkycNotificationTrigger = typeof ckycNotificationTriggers.$inferSelect;
export type InsertCkycNotificationTrigger = z.infer<typeof insertCkycNotificationTriggerSchema>;

export type CkycProgressStep = typeof ckycProgressSteps.$inferSelect;
export type InsertCkycProgressStep = z.infer<typeof insertCkycProgressStepSchema>;

export type CkycActionLog = typeof ckycActionLogs.$inferSelect;
export type InsertCkycActionLog = z.infer<typeof insertCkycActionLogSchema>;

export type KycFormProgress = typeof kycFormProgress.$inferSelect;
export type InsertKycFormProgress = z.infer<typeof insertKycFormProgressSchema>;

export type ManualKycSubmission = typeof manualKycSubmissions.$inferSelect;
export type InsertManualKycSubmission = z.infer<typeof insertManualKycSubmissionSchema>;

export type ManualKycDocument = typeof manualKycDocuments.$inferSelect;
export type InsertManualKycDocument = z.infer<typeof insertManualKycDocumentSchema>;

export type KycStepReset = typeof kycStepResets.$inferSelect;
export type InsertKycStepReset = z.infer<typeof insertKycStepResetSchema>;

export type KycProductEligibilityRule = typeof kycProductEligibilityRules.$inferSelect;
export type InsertKycProductEligibilityRule = z.infer<typeof insertKycProductEligibilityRuleSchema>;

export type KycAuditPack = typeof kycAuditPacks.$inferSelect;
export type InsertKycAuditPack = z.infer<typeof insertKycAuditPackSchema>;

export type KycWebhookEvent = typeof kycWebhookEvents.$inferSelect;
export type InsertKycWebhookEvent = z.infer<typeof insertKycWebhookEventSchema>;

export type KycRateLimitCounter = typeof kycRateLimitCounters.$inferSelect;
export type InsertKycRateLimitCounter = z.infer<typeof insertKycRateLimitCounterSchema>;

export type KycProvider = typeof kycProviders.$inferSelect;
export type InsertKycProvider = z.infer<typeof insertKycProviderSchema>;

export type KycProviderPriority = typeof kycProviderPriority.$inferSelect;
export type InsertKycProviderPriority = z.infer<typeof insertKycProviderPrioritySchema>;

export type KycFlowVersion = typeof kycFlowVersions.$inferSelect;
export type InsertKycFlowVersion = z.infer<typeof insertKycFlowVersionSchema>;

export type KycVideoSession = typeof kycVideoSessions.$inferSelect;
export type InsertKycVideoSession = z.infer<typeof insertKycVideoSessionSchema>;

export type KycApproval = typeof kycApprovals.$inferSelect;
export type InsertKycApproval = z.infer<typeof insertKycApprovalSchema>;

export type KycRejectionEvent = typeof kycRejectionEvents.$inferSelect;
export type InsertKycRejectionEvent = z.infer<typeof insertKycRejectionEventSchema>;

export type CkycProviderConfig = typeof ckycProviderConfig.$inferSelect;
export type InsertCkycProviderConfig = z.infer<typeof insertCkycProviderConfigSchema>;

export type CkycProviderAuditLog = typeof ckycProviderAuditLog.$inferSelect;
export type InsertCkycProviderAuditLog = z.infer<typeof insertCkycProviderAuditLogSchema>;

export type CkycVerificationRequest = typeof ckycVerificationRequests.$inferSelect;
export type InsertCkycVerificationRequest = z.infer<typeof insertCkycVerificationRequestSchema>;

export type CkycDeferredCase = typeof ckycDeferredCases.$inferSelect;
export type InsertCkycDeferredCase = z.infer<typeof insertCkycDeferredCaseSchema>;

export type DigilockerKycMapping = typeof digilockerKycMappings.$inferSelect;
export type InsertDigilockerKycMapping = z.infer<typeof insertDigilockerKycMappingSchema>;

export type CkycStatusHistory = typeof ckycStatusHistory.$inferSelect;
export type InsertCkycStatusHistory = typeof ckycStatusHistory.$inferInsert;

// --- Auto-Migrated KYC and Compliance Tables ---
export const agentComplianceDocRepository = pgTable("agent_compliance_doc_repository", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Document info
  documentType: varchar("document_type").notNull(), // policy, procedure, guideline, template
  documentName: varchar("document_name").notNull(),
  documentCategory: varchar("document_category").notNull(), // ai_recommendation, suitability, human_in_loop, override, explainability, ab_testing
  
  // Version control
  version: varchar("version").notNull(),
  effectiveDate: date("effective_date").notNull(),
  expiryDate: date("expiry_date"),
  isActive: boolean("is_active").default(true),
  
  // Content
  contentHtml: text("content_html"),
  contentPdf: text("content_pdf"), // Base64 or URL
  summary: text("summary"),
  
  // Approval
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  
  // Audit
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_compliance_doc_type").on(table.documentType),
  index("idx_agent_compliance_doc_category").on(table.documentCategory),
  index("idx_agent_compliance_doc_active").on(table.isActive),
]);

// Inspection Evidence Records
export const inspectionEvidence = pgTable("inspection_evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Reference
  clientId: varchar("client_id").notNull(),
  transactionId: varchar("transaction_id"),
  proposalId: varchar("proposal_id"),
  
  // Evidence components
  clientRiskProfile: jsonb("client_risk_profile").$type<{
    riskScore: number;
    riskCategory: string;
    assessmentDate: string;
    horizonYears: number;
  }>(),
  
  recommendationMode: varchar("recommendation_mode").notNull(), // conservative, balanced, growth
  
  agentOverrides: jsonb("agent_overrides").$type<{
    overrideType: string;
    previousValue: string;
    newValue: string;
    reason: string;
    timestamp: string;
  }[]>(),
  
  aiExplanationShown: text("ai_explanation_shown"),
  
  clientConsent: jsonb("client_consent").$type<{
    consentType: string;
    consentedAt: string;
    method: string; // signature, otp, checkbox
    ipAddress?: string;
  }>(),
  
  executionRecord: jsonb("execution_record").$type<{
    executedAt: string;
    amount: number;
    products: { productId: string; productName: string; allocation: number }[];
  }>(),
  
  // Metadata
  exportedAt: timestamp("exported_at"),
  exportedBy: varchar("exported_by"),
  exportFormat: varchar("export_format"), // pdf, json
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inspection_evidence_client").on(table.clientId),
  index("idx_inspection_evidence_transaction").on(table.transactionId),
]);

// Agent Performance Scores - Computed scores for admin view
export const agentPerformanceScores = pgTable("agent_performance_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull(),
  
  // Score period
  scorePeriod: varchar("score_period").notNull(), // monthly, quarterly, yearly
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  
  // Individual component scores (0-100)
  recommendationAdoptionScore: integer("recommendation_adoption_score").default(0),
  riskAdjustedPerformanceScore: integer("risk_adjusted_performance_score").default(0),
  complianceDisciplineScore: integer("compliance_discipline_score").default(0),
  
  // Weighted final score
  finalScore: integer("final_score").default(0),
  
  // Breakdown details
  scoreBreakdown: jsonb("score_breakdown").$type<{
    adoptionRate: number;
    acceptedCount: number;
    totalCount: number;
    portfolioIrr: number;
    benchmarkReturn: number;
    violationsCount: number;
    overrideComplianceRate: number;
  }>(),
  
  // Rank among agents
  agentRank: integer("agent_rank"),
  totalAgents: integer("total_agents"),
  
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_score_agent").on(table.agentId),
  index("idx_agent_score_period").on(table.scorePeriod, table.periodStart),
]);

// Insert schemas for agent governance tables

export const insertAgentComplianceDocRepositorySchema = createInsertSchema(agentComplianceDocRepository).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type AgentComplianceDocRepository = typeof agentComplianceDocRepository.$inferSelect;

export type InsertAgentComplianceDocRepository = z.infer<typeof insertAgentComplianceDocRepositorySchema>;

export const insertInspectionEvidenceSchema = createInsertSchema(inspectionEvidence).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export type InspectionEvidence = typeof inspectionEvidence.$inferSelect;

export type InsertInspectionEvidence = z.infer<typeof insertInspectionEvidenceSchema>;

export const insertAgentPerformanceScoresSchema = createInsertSchema(agentPerformanceScores).extend({
  id: z.any(),
  calculatedAt: z.any(),
}).omit({ id: true, calculatedAt: true });

export type AgentPerformanceScores = typeof agentPerformanceScores.$inferSelect;

export type InsertAgentPerformanceScores = z.infer<typeof insertAgentPerformanceScoresSchema>;

export const governmentSchemeConsents = pgTable("government_scheme_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  panNumber: varchar("pan_number").notNull(),
  schemeType: varchar("scheme_type").notNull(), // 'epf', 'ppf', 'eps', 'all'
  consentGranted: boolean("consent_granted").default(false),
  consentDate: timestamp("consent_date"),
  consentExpiryDate: timestamp("consent_expiry_date"),
  purpose: text("purpose"), // Purpose for accessing the data
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const epfHoldings = pgTable("epf_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  epfAccountNumber: varchar("epf_account_number").notNull(),
  employerName: text("employer_name").notNull(),
  memberName: text("member_name").notNull(),
  // EPF Balance Information
  employeeContribution: decimal("employee_contribution", { precision: 15, scale: 2 }),
  employerContribution: decimal("employer_contribution", { precision: 15, scale: 2 }),
  pensionContribution: decimal("pension_contribution", { precision: 15, scale: 2 }),
  totalBalance: decimal("total_balance", { precision: 15, scale: 2 }),
  interestEarned: decimal("interest_earned", { precision: 15, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }), // Annual interest rate
  // Account Details
  dateOfJoining: date("date_of_joining"),
  dateOfExit: date("date_of_exit"),
  isActive: boolean("is_active").default(true),
  nomineeName: text("nominee_name"),
  nomineeRelationship: varchar("nominee_relationship"),
  // Tracking
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const panConsents = pgTable("pan_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Encrypted PAN Storage
  encryptedPan: text("encrypted_pan").notNull(), // AES-256 encrypted PAN
  panHash: varchar("pan_hash").notNull(), // SHA-256 hash for verification
  
  // Consent Details
  consentGiven: boolean("consent_given").notNull().default(true),
  consentTimestamp: timestamp("consent_timestamp").notNull().defaultNow(),
  consentVersion: varchar("consent_version").notNull().default("1.0"), // Privacy policy version
  consentIPAddress: varchar("consent_ip_address"),
  consentUserAgent: text("consent_user_agent"),
  
  // Purpose and Scope
  consentPurpose: text("consent_purpose").notNull().default("Tax data aggregation and ITR filing services"),
  dataRetentionPeriod: varchar("data_retention_period").default("7_years"), // As per IT Act
  
  // Audit Information
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").default(0),
  isActive: boolean("is_active").notNull().default(true),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  
  // Compliance Tracking
  kycVerified: boolean("kyc_verified").default(false),
  panVerified: boolean("pan_verified").default(false),
  verificationDate: timestamp("verification_date"),
  verificationSource: varchar("verification_source"), // manual/api/document
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_pan_consents_user_id").on(table.userId),
  index("idx_pan_consents_active").on(table.isActive),
]);

// PAN Consent Audit Log
export const panConsentAuditLog = pgTable("pan_consent_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consentId: varchar("consent_id").references(() => panConsents.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Audit Details
  action: varchar("action").notNull(), // created/accessed/updated/revoked/verified
  actionDetails: jsonb("action_details"), // Additional context
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  
  // API Usage Tracking
  apiEndpoint: varchar("api_endpoint"), // Which API used the PAN
  requestId: varchar("request_id"), // For tracing specific requests
  
  // Compliance and Security
  accessReason: text("access_reason"), // Why PAN was accessed
  dataMinimized: boolean("data_minimized").default(true), // Was data access minimized
  
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => [
  index("idx_pan_audit_consent_id").on(table.consentId),
  index("idx_pan_audit_user_id").on(table.userId),
  index("idx_pan_audit_timestamp").on(table.timestamp),
]);

// PAN Consent Zod schemas
export const insertPanConsentSchema = createInsertSchema(panConsents).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPanConsentAuditLogSchema = createInsertSchema(panConsentAuditLog).extend({
  id: z.any(),
  timestamp: z.any(),
}).omit({
  id: true,
  timestamp: true,
});

export type PanConsentAuditLog = typeof panConsentAuditLog.$inferSelect;

export type InsertPanConsentAuditLog = z.infer<typeof insertPanConsentAuditLogSchema>;

export type NewPanConsentAuditLog = typeof panConsentAuditLog.$inferInsert;

export const dataSourceConsents = pgTable("data_source_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User information
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Data source details
  dataSource: varchar("data_source").notNull(), // mutual_funds/demat/bank/loans/insurance
  provider: varchar("provider"), // e.g., BSE_STAR/NSDL/CDSL/CIBIL/Turtlefin
  
  // Consent status
  consentGiven: boolean("consent_given").notNull(),
  consentPurpose: text("consent_purpose").notNull(), // auto_populate_holdings/portfolio_sync
  consentText: text("consent_text").notNull(), // Full consent text shown to user
  
  // Digital signature
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  // Validity period
  consentedAt: timestamp("consented_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // Default: 90 days from consent
  revokedAt: timestamp("revoked_at"),
  revokeReason: text("revoke_reason"),
  
  // Status tracking
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"), // Last successful data fetch
  nextSyncDue: timestamp("next_sync_due"), // Next scheduled sync
  syncFrequency: varchar("sync_frequency").default("weekly"), // daily/weekly/monthly/manual
  
  // Audit metadata
  consentVersion: varchar("consent_version").default("v1.0"), // Track consent text versions
  regulatoryCompliance: jsonb("regulatory_compliance"), // RBI AA/SEBI compliance flags
}, (table) => [
  index("idx_data_source_consent_user").on(table.userId),
  index("idx_data_source_consent_source").on(table.dataSource),
  index("idx_data_source_consent_active").on(table.isActive),
  index("idx_data_source_consent_expires").on(table.expiresAt),
]);

// Auto-Population Status Tracking - Track progress of auto-population workflows
export const autoPopulationStatus = pgTable("auto_population_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User information
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Workflow details
  workflowId: varchar("workflow_id").notNull().unique(), // Unique ID for this auto-population run
  triggeredBy: varchar("triggered_by").notNull(), // kyc_completion/manual_refresh/scheduled_sync
  
  // Overall status
  status: varchar("status").notNull().default("initiated"), // initiated/in_progress/completed/partial_success/failed
  totalDataSources: integer("total_data_sources").default(0),
  successfulSources: integer("successful_sources").default(0),
  failedSources: integer("failed_sources").default(0),
  
  // Per-source status (JSON tracking)
  sourceStatus: jsonb("source_status"), // { mutual_funds: 'success', demat: 'failed', ... }
  sourceErrors: jsonb("source_errors"), // { demat: 'API timeout', ... }
  
  // Data metrics
  totalRecordsFetched: integer("total_records_fetched").default(0),
  totalHoldingsValue: numeric("total_holdings_value", { precision: 15, scale: 2 }),
  
  // Timestamps
  initiatedAt: timestamp("initiated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  
  // Duration tracking
  durationMs: integer("duration_ms"), // Total time taken in milliseconds
  
  // Error handling
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
}, (table) => [
  index("idx_auto_pop_user").on(table.userId),
  index("idx_auto_pop_workflow").on(table.workflowId),
  index("idx_auto_pop_status").on(table.status),
  index("idx_auto_pop_initiated").on(table.initiatedAt),
]);

// Account Aggregator Consent Sessions - Track AA consent flow with FIUs
export const aaConsentSessions = pgTable("aa_consent_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  panNumber: varchar("pan_number").notNull(),
  
  aaProvider: varchar("aa_provider").notNull().default("finvu"),
  fiuEntityId: varchar("fiu_entity_id"),
  
  consentHandleId: varchar("consent_handle_id").unique(),
  consentId: varchar("consent_id"),
  consentArtefactId: varchar("consent_artefact_id"),
  
  redirectUrl: text("redirect_url"),
  callbackUrl: text("callback_url"),
  
  assetTypes: jsonb("asset_types").default(sql`'["MF", "DEMAT", "PPF", "NPS", "LOANS"]'::jsonb`),
  validityDays: integer("validity_days").default(90),
  syncFrequencyDays: integer("sync_frequency_days").default(30),
  fetchType: varchar("fetch_type").default("PERIODIC"),
  
  status: varchar("status").notNull().default("initiated"),
  
  initiatedAt: timestamp("initiated_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  expiresAt: timestamp("expires_at"),
  lastDataFetchAt: timestamp("last_data_fetch_at"),
  
  errorCode: varchar("error_code"),
  errorMessage: text("error_message"),
  
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_aa_consent_user").on(table.userId),
  index("idx_aa_consent_handle").on(table.consentHandleId),
  index("idx_aa_consent_status").on(table.status),
  index("idx_aa_consent_pan").on(table.panNumber),
]);

// Account Aggregator Raw Payloads - Store fetched AA data (JSONB) with retention
export const aaRawPayloads = pgTable("aa_raw_payloads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  consentSessionId: varchar("consent_session_id").references(() => aaConsentSessions.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  fetchSessionId: varchar("fetch_session_id").notNull(),
  fiuName: varchar("fiu_name"),
  dataType: varchar("data_type").notNull(),
  
  rawPayload: jsonb("raw_payload").notNull(),
  
  isDecrypted: boolean("is_decrypted").default(false),
  decryptedAt: timestamp("decrypted_at"),
  
  isProcessed: boolean("is_processed").default(false),
  processedAt: timestamp("processed_at"),
  recordsExtracted: integer("records_extracted").default(0),
  processingErrors: jsonb("processing_errors"),
  
  dataQualityScore: integer("data_quality_score"),
  missingFields: jsonb("missing_fields"),
  
  retentionDays: integer("retention_days").default(180),
  expiresAt: timestamp("expires_at"),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  
  fetchedAt: timestamp("fetched_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_aa_payload_consent").on(table.consentSessionId),
  index("idx_aa_payload_user").on(table.userId),
  index("idx_aa_payload_type").on(table.dataType),
  index("idx_aa_payload_fetch").on(table.fetchSessionId),
  index("idx_aa_payload_expires").on(table.expiresAt),
]);

// AA Data Fetch Logs - Track individual FIU data fetches with fallback support
export const aaDataFetchLogs = pgTable("aa_data_fetch_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  consentSessionId: varchar("consent_session_id").references(() => aaConsentSessions.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  fiuName: varchar("fiu_name").notNull(),
  dataType: varchar("data_type").notNull(),
  
  status: varchar("status").notNull().default("initiated"),
  
  usedFallback: boolean("used_fallback").default(false),
  fallbackSource: varchar("fallback_source"),
  fallbackReason: text("fallback_reason"),
  
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
  
  recordsFetched: integer("records_fetched").default(0),
  totalValue: numeric("total_value", { precision: 15, scale: 2 }),
  
  errorCode: varchar("error_code"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_aa_fetch_consent").on(table.consentSessionId),
  index("idx_aa_fetch_user").on(table.userId),
  index("idx_aa_fetch_fiu").on(table.fiuName),
  index("idx_aa_fetch_status").on(table.status),
]);

// Insert schemas and types for AA tables
export const insertAAConsentSessionSchema = createInsertSchema(aaConsentSessions).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAutoPopulationStatusSchema = createInsertSchema(autoPopulationStatus).extend({
  id: z.any(),
  initiatedAt: z.any(),
}).omit({
  id: true,
  initiatedAt: true,
});

export type AutoPopulationStatus = typeof autoPopulationStatus.$inferSelect;

export type InsertAutoPopulationStatus = z.infer<typeof insertAutoPopulationStatusSchema>;

export const schemeConsents = pgTable("scheme_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  schemeType: varchar("scheme_type").notNull(),
  purpose: text("purpose").notNull(),
  scope: text("scope").array().notNull(),
  otpChannel: varchar("otp_channel").notNull(),
  challengeId: varchar("challenge_id").notNull().unique(),
  otpHash: varchar("otp_hash"),
  status: varchar("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  retentionPeriodYears: integer("retention_period_years").notNull().default(8),
  consentTimestamp: timestamp("consent_timestamp"),
  verifiedAt: timestamp("verified_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_scheme_consents_user").on(table.userId),
  index("idx_scheme_consents_challenge").on(table.challengeId),
  index("idx_scheme_consents_status").on(table.status),
]);

export type SchemeConsent = typeof schemeConsents.$inferSelect;
export type InsertSchemeConsent = typeof schemeConsents.$inferInsert;

// ============================================
// Government Scheme Audit Log (PMLA/RBI compliant)
// ============================================

export const governmentSchemeAudit = pgTable("government_scheme_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  schemeType: varchar("scheme_type").notNull(),
  eventType: varchar("event_type").notNull(),
  requestId: varchar("request_id").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  providerTraceId: varchar("provider_trace_id"),
  dataChecksum: varchar("data_checksum"),
  details: jsonb("details"),
  retentionExpiresAt: timestamp("retention_expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_gov_scheme_audit_user").on(table.userId),
  index("idx_gov_scheme_audit_scheme").on(table.schemeType),
  index("idx_gov_scheme_audit_event").on(table.eventType),
  index("idx_gov_scheme_audit_timestamp").on(table.timestamp),
  index("idx_gov_scheme_audit_retention").on(table.retentionExpiresAt),
]);

export type GovernmentSchemeAuditLog = typeof governmentSchemeAudit.$inferSelect;
export type InsertGovernmentSchemeAuditLog = typeof governmentSchemeAudit.$inferInsert;

// ============================================
// FIXED INCOME MARKETPLACE COMPREHENSIVE SCHEMA
// ============================================

// NCD Public Issues - New Issue NCDs from lead managers
export const ncdPublicIssues = pgTable("ncd_public_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Issue identification
  issueId: varchar("issue_id").notNull().unique(),
  issuerName: varchar("issuer_name").notNull(),
  issueName: text("issue_name").notNull(),
  isin: varchar("isin"),
  
  // Issue details
  issueType: varchar("issue_type").notNull(), // 'public_issue', 'private_placement'
  ncdCategory: varchar("ncd_category").notNull(), // 'secured', 'unsecured', 'subordinated'
  
  // Dates
  issueOpenDate: date("issue_open_date").notNull(),
  issueCloseDate: date("issue_close_date").notNull(),
  allotmentDate: date("allotment_date"),
  listingDate: date("listing_date"),
  maturityDate: date("maturity_date").notNull(),
  tenorYears: decimal("tenor_years", { precision: 5, scale: 2 }).notNull(),
  
  // Pricing and yield
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).default("1000"),
  issuePrice: decimal("issue_price", { precision: 15, scale: 2 }),
  couponRate: decimal("coupon_rate", { precision: 8, scale: 4 }).notNull(),
  couponFrequency: varchar("coupon_frequency").notNull(), // 'annual', 'semi_annual', 'quarterly', 'monthly', 'cumulative'
  effectiveYield: decimal("effective_yield", { precision: 8, scale: 4 }),
  
  // Issue size
  issueSize: decimal("issue_size", { precision: 15, scale: 2 }), // Total issue size in crores
  baseSizeTarget: decimal("base_size_target", { precision: 15, scale: 2 }),
  greenShoeOption: decimal("green_shoe_option", { precision: 15, scale: 2 }),
  minimumApplication: decimal("minimum_application", { precision: 15, scale: 2 }).default("10000"),
  lotSize: integer("lot_size").default(10),
  
  // Credit ratings
  creditRating: varchar("credit_rating").notNull(), // 'AAA', 'AA+', 'AA', etc.
  ratingAgency: varchar("rating_agency").notNull(), // 'CRISIL', 'ICRA', 'CARE', 'India Ratings'
  outlookStatus: varchar("outlook_status").default("stable"), // 'stable', 'positive', 'negative'
  
  // Lead managers and registrar
  leadManagers: jsonb("lead_managers").default([]), // Array of lead manager names
  registrar: varchar("registrar"),
  debentureTrustee: varchar("debenture_trustee"),
  
  // Security details
  secured: boolean("secured").default(true),
  securityCover: decimal("security_cover", { precision: 5, scale: 2 }), // e.g., 1.25x
  collateralType: text("collateral_type"),
  
  // Tax benefits
  taxStatus: varchar("tax_status").default("taxable"),
  taxBenefitSection: varchar("tax_benefit_section"),
  
  // Investor categories
  categoryAllocation: jsonb("category_allocation").default({}), // { retail: 25, hni: 25, institutional: 50 }
  
  // Status
  issueStatus: varchar("issue_status").default("upcoming"), // 'upcoming', 'open', 'closed', 'allotted', 'listed'
  listingExchange: varchar("listing_exchange").default("bse"), // 'bse', 'nse', 'both'
  
  // Documents
  prospectusUrl: text("prospectus_url"),
  ratingRationaleUrl: text("rating_rationale_url"),
  applicationFormUrl: text("application_form_url"),
  
  // Subscription details (updated during issue period)
  totalSubscription: decimal("total_subscription", { precision: 15, scale: 2 }),
  subscriptionTimes: decimal("subscription_times", { precision: 8, scale: 4 }),
  retailSubscriptionTimes: decimal("retail_subscription_times", { precision: 8, scale: 4 }),
  
  // Metadata
  sebiFilingDate: date("sebi_filing_date"),
  dataSource: varchar("data_source").default("manual"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_ncd_issues_status").on(table.issueStatus),
  index("idx_ncd_issues_open_date").on(table.issueOpenDate),
  index("idx_ncd_issues_issuer").on(table.issuerName),
]);

export type NcdPublicIssue = typeof ncdPublicIssues.$inferSelect;
export type InsertNcdPublicIssue = typeof ncdPublicIssues.$inferInsert;

// Bond Coupon Payments - Track coupon/interest payments for holdings
export const bondCouponPayments = pgTable("bond_coupon_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User and holding
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  holdingId: varchar("holding_id").references(() => bondHoldings.id),
  
  // Bond details
  isin: varchar("isin").notNull(),
  bondName: text("bond_name").notNull(),
  bondType: varchar("bond_type").notNull(), // 'government', 'corporate'
  
  // Payment details
  paymentType: varchar("payment_type").notNull(), // 'coupon', 'interest', 'maturity_principal', 'partial_redemption'
  couponRate: decimal("coupon_rate", { precision: 8, scale: 4 }).notNull(),
  faceValueHeld: decimal("face_value_held", { precision: 15, scale: 2 }).notNull(),
  
  // Amounts
  grossAmount: decimal("gross_amount", { precision: 15, scale: 2 }).notNull(),
  tdsDeducted: decimal("tds_deducted", { precision: 15, scale: 2 }).default("0"),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }).notNull(),
  tdsRate: decimal("tds_rate", { precision: 5, scale: 2 }),
  
  // Dates
  recordDate: date("record_date").notNull(),
  paymentDate: date("payment_date").notNull(),
  actualPaymentDate: date("actual_payment_date"),
  
  // Status
  paymentStatus: varchar("payment_status").default("scheduled"), // 'scheduled', 'paid', 'pending', 'delayed', 'defaulted'
  
  // Payment tracking
  paymentReference: varchar("payment_reference"),
  creditedToAccount: varchar("credited_to_account"),
  
  // Form 26AS tracking
  form26asReflected: boolean("form_26as_reflected").default(false),
  tanNumber: varchar("tan_number"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bond_coupons_user").on(table.userId),
  index("idx_bond_coupons_holding").on(table.holdingId),
  index("idx_bond_coupons_payment_date").on(table.paymentDate),
  index("idx_bond_coupons_status").on(table.paymentStatus),
]);

export type BondCouponPayment = typeof bondCouponPayments.$inferSelect;
export type InsertBondCouponPayment = typeof bondCouponPayments.$inferInsert;

// Bond Suitability Checks - Risk assessment before bond purchase
export const bondSuitabilityChecks = pgTable("bond_suitability_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Check details
  checkType: varchar("check_type").notNull(), // 'pre_purchase', 'periodic_review', 'kyc_update'
  
  // KYC verification
  kycLevel: varchar("kyc_level").notNull(), // 'basic', 'full', 'enhanced', 'accredited_investor'
  kycVerified: boolean("kyc_verified").default(false),
  ckycNumber: varchar("ckyc_number"),
  kraStatus: varchar("kra_status"),
  
  // Demat verification
  dematVerified: boolean("demat_verified").default(false),
  dpId: varchar("dp_id"),
  clientId: varchar("client_id"),
  dematAccountNumber: varchar("demat_account_number"),
  depositoryParticipant: varchar("depository_participant"),
  
  // Risk profile
  investorRiskProfile: varchar("investor_risk_profile"), // 'conservative', 'moderate', 'aggressive'
  maxCreditRatingAllowed: varchar("max_credit_rating_allowed"), // e.g., 'AA-' means AA- and above
  
  // Suitability declarations (SEBI requirements)
  highRiskDebtAcknowledged: boolean("high_risk_debt_acknowledged").default(false),
  defaultRiskAcknowledged: boolean("default_risk_acknowledged").default(false),
  reinvestmentRiskAcknowledged: boolean("reinvestment_risk_acknowledged").default(false),
  liquidityRiskAcknowledged: boolean("liquidity_risk_acknowledged").default(false),
  
  // Accredited investor (for private placement)
  isAccreditedInvestor: boolean("is_accredited_investor").default(false),
  accreditedInvestorCertificateId: varchar("accredited_investor_certificate_id"),
  accreditedInvestorValidUntil: date("accredited_investor_valid_until"),
  
  // Investment limits
  maxSingleBondExposure: decimal("max_single_bond_exposure", { precision: 15, scale: 2 }),
  maxIssuerExposure: decimal("max_issuer_exposure", { precision: 15, scale: 2 }),
  maxFixedIncomeAllocation: decimal("max_fixed_income_allocation", { precision: 5, scale: 2 }), // % of portfolio
  
  // Result
  suitabilityResult: varchar("suitability_result").notNull(), // 'approved', 'conditional', 'rejected'
  restrictionLevel: varchar("restriction_level"), // 'none', 'rating_restricted', 'amount_restricted', 'blocked'
  restrictionDetails: text("restriction_details"),
  
  // IP and device tracking (PMLA compliance)
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  deviceFingerprint: varchar("device_fingerprint"),
  
  // Validity
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bond_suitability_user").on(table.userId),
  index("idx_bond_suitability_result").on(table.suitabilityResult),
  index("idx_bond_suitability_valid").on(table.validUntil),
]);

export type BondSuitabilityCheck = typeof bondSuitabilityChecks.$inferSelect;
export type InsertBondSuitabilityCheck = typeof bondSuitabilityChecks.$inferInsert;

// Fixed Income Compliance Audit Log - 7-year retention (PMLA compliant)
export const fixedIncomeAuditLog = pgTable("fixed_income_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User and session
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  sessionId: varchar("session_id"),
  
  // Event details
  eventType: varchar("event_type").notNull(), 
  // Events: 'order_placed', 'order_executed', 'order_cancelled', 'payment_initiated', 'payment_completed',
  // 'demat_credit', 'coupon_received', 'suitability_check', 'kyc_verification', 'risk_acknowledgement',
  // 'document_download', 'price_enquiry', 'watchlist_add', 'complaint_filed'
  
  eventCategory: varchar("event_category").notNull(), // 'trading', 'payment', 'compliance', 'account', 'support'
  
  // Entity details
  entityType: varchar("entity_type"), // 'order', 'bond', 'payment', 'complaint'
  entityId: varchar("entity_id"),
  isin: varchar("isin"),
  bondName: text("bond_name"),
  
  // Event data
  eventData: jsonb("event_data").default({}),
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  
  // Financial details (if applicable)
  amount: decimal("amount", { precision: 15, scale: 2 }),
  currency: varchar("currency").default("INR"),
  
  // Result
  eventResult: varchar("event_result").notNull(), // 'success', 'failure', 'pending'
  errorCode: varchar("error_code"),
  errorMessage: text("error_message"),
  
  // Source tracking
  eventSource: varchar("event_source").notNull(), // 'web', 'mobile_app', 'api', 'admin', 'system'
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  deviceId: varchar("device_id"),
  
  // Exchange/external references
  exchangeOrderId: varchar("exchange_order_id"),
  exchangeTransactionId: varchar("exchange_transaction_id"),
  paymentGatewayRef: varchar("payment_gateway_ref"),
  
  // Regulatory compliance
  regulatoryReportingRequired: boolean("regulatory_reporting_required").default(false),
  regulatoryReportId: varchar("regulatory_report_id"),
  
  // Retention
  retentionExpiresAt: timestamp("retention_expires_at").notNull(),
  
  // Timestamps
  eventTimestamp: timestamp("event_timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_fi_audit_user").on(table.userId),
  index("idx_fi_audit_event_type").on(table.eventType),
  index("idx_fi_audit_category").on(table.eventCategory),
  index("idx_fi_audit_timestamp").on(table.eventTimestamp),
  index("idx_fi_audit_isin").on(table.isin),
  index("idx_fi_audit_retention").on(table.retentionExpiresAt),
]);

export type FixedIncomeAuditLog = typeof fixedIncomeAuditLog.$inferSelect;
export type InsertFixedIncomeAuditLog = typeof fixedIncomeAuditLog.$inferInsert;

// Bond Watchlist - User's bond tracking list
export const bondWatchlist = pgTable("bond_watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Bond details
  bondId: varchar("bond_id"),
  bondType: varchar("bond_type").notNull(), // 'government', 'corporate', 'ncd_issue'
  isin: varchar("isin"),
  issueId: varchar("issue_id"), // For NCD public issues
  bondName: text("bond_name").notNull(),
  issuer: varchar("issuer").notNull(),
  
  // Tracking preferences
  alertOnPriceChange: boolean("alert_on_price_change").default(true),
  priceAlertThreshold: decimal("price_alert_threshold", { precision: 5, scale: 2 }), // % change
  alertOnYieldChange: boolean("alert_on_yield_change").default(false),
  yieldAlertThreshold: decimal("yield_alert_threshold", { precision: 5, scale: 2 }),
  alertOnRatingChange: boolean("alert_on_rating_change").default(true),
  alertOnIssueOpen: boolean("alert_on_issue_open").default(true), // For upcoming NCDs
  
  // Target price for buy
  targetBuyPrice: decimal("target_buy_price", { precision: 15, scale: 4 }),
  targetBuyYield: decimal("target_buy_yield", { precision: 8, scale: 4 }),
  
  // Notes
  notes: text("notes"),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Metadata
  addedAt: timestamp("added_at").defaultNow(),
  lastAlertSent: timestamp("last_alert_sent"),
}, (table) => [
  index("idx_bond_watchlist_user").on(table.userId),
  index("idx_bond_watchlist_isin").on(table.isin),
  index("idx_bond_watchlist_active").on(table.isActive),
]);

export type BondWatchlistItem = typeof bondWatchlist.$inferSelect;
export type InsertBondWatchlistItem = typeof bondWatchlist.$inferInsert;

// SGB Primary Issues - Sovereign Gold Bond issue windows
export const sgbPrimaryIssues = pgTable("sgb_primary_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Issue identification
  seriesName: varchar("series_name").notNull().unique(), // e.g., "SGB 2024-25 Series I"
  trancheNumber: varchar("tranche_number").notNull(),
  fiscalYear: varchar("fiscal_year").notNull(), // e.g., "2024-25"
  
  // Dates
  issueOpenDate: date("issue_open_date").notNull(),
  issueCloseDate: date("issue_close_date").notNull(),
  settlementDate: date("settlement_date").notNull(),
  dateOfIssuance: date("date_of_issuance").notNull(),
  maturityDate: date("maturity_date").notNull(),
  
  // Pricing
  issuePrice: decimal("issue_price", { precision: 15, scale: 2 }).notNull(), // Per gram of gold
  discountOnlinePayment: decimal("discount_online_payment", { precision: 15, scale: 2 }).default("50"), // Rs 50 per gram
  effectivePrice: decimal("effective_price", { precision: 15, scale: 2 }), // After online discount
  
  // Gold reference
  goldReferencePrice: decimal("gold_reference_price", { precision: 15, scale: 2 }), // Simple average of gold price
  goldReferencePeriodStart: date("gold_reference_period_start"),
  goldReferencePeriodEnd: date("gold_reference_period_end"),
  
  // Interest details
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).default("2.50"), // Fixed 2.5% per annum
  interestPaymentFrequency: varchar("interest_payment_frequency").default("semi_annual"),
  
  // Investment limits
  minimumInvestment: integer("minimum_investment").default(1), // In grams
  maximumIndividualLimit: integer("maximum_individual_limit").default(4000), // 4 kg per fiscal year
  maximumHufLimit: integer("maximum_huf_limit").default(4000),
  maximumTrustLimit: integer("maximum_trust_limit").default(20000), // 20 kg
  
  // Early redemption
  earlyRedemptionAllowed: boolean("early_redemption_allowed").default(true),
  earlyRedemptionFromYear: integer("early_redemption_from_year").default(5), // After 5th year
  
  // Tax benefits
  capitalGainsTaxExempt: boolean("capital_gains_tax_exempt").default(true), // On redemption at maturity
  interestTaxable: boolean("interest_taxable").default(true),
  
  // Application channels
  applicationChannels: jsonb("application_channels").default(["banks", "post_offices", "stock_exchanges", "agents"]),
  
  // Status
  issueStatus: varchar("issue_status").default("upcoming"), // 'upcoming', 'open', 'closed', 'allotted'
  
  // RBI notification
  rbiNotificationNumber: varchar("rbi_notification_number"),
  rbiNotificationDate: date("rbi_notification_date"),
  
  // Metadata
  dataSource: varchar("data_source").default("rbi"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sgb_issues_status").on(table.issueStatus),
  index("idx_sgb_issues_open_date").on(table.issueOpenDate),
  index("idx_sgb_issues_fiscal_year").on(table.fiscalYear),
]);

export type SgbPrimaryIssue = typeof sgbPrimaryIssues.$inferSelect;
export type InsertSgbPrimaryIssue = typeof sgbPrimaryIssues.$inferInsert;

// RBI Retail Direct Integration - User's RDG account linking
export const rbiRetailDirectAccounts = pgTable("rbi_retail_direct_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // RDG Account details
  rdgAccountNumber: varchar("rdg_account_number").unique(),
  rdgAccountStatus: varchar("rdg_account_status").default("pending"), // 'pending', 'active', 'suspended', 'closed'
  
  // Linking details
  linkingStatus: varchar("linking_status").default("not_linked"), // 'not_linked', 'pending_verification', 'linked', 'failed'
  linkingRequestId: varchar("linking_request_id"),
  linkedAt: timestamp("linked_at"),
  
  // Bank account for settlement
  settlementBankName: varchar("settlement_bank_name"),
  settlementAccountNumber: varchar("settlement_account_number"),
  settlementIfscCode: varchar("settlement_ifsc_code"),
  
  // Holdings sync
  lastHoldingsSync: timestamp("last_holdings_sync"),
  holdingsSyncStatus: varchar("holdings_sync_status"), // 'success', 'failed', 'pending'
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_rbi_rdg_user").on(table.userId),
  index("idx_rbi_rdg_status").on(table.rdgAccountStatus),
]);

export type RbiRetailDirectAccount = typeof rbiRetailDirectAccounts.$inferSelect;
export type InsertRbiRetailDirectAccount = typeof rbiRetailDirectAccounts.$inferInsert;

// Bond NCD Applications - User applications for NCD public issues
export const bondNcdApplications = pgTable("bond_ncd_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Issue details
  issueId: varchar("issue_id").references(() => ncdPublicIssues.id).notNull(),
  
  // Application details
  applicationNumber: varchar("application_number").notNull().unique(),
  applicationDate: timestamp("application_date").defaultNow(),
  
  // Category
  investorCategory: varchar("investor_category").notNull(), // 'retail', 'hni', 'institutional'
  
  // Series selection (NCDs often have multiple series with different tenors)
  seriesOptions: jsonb("series_options").default([]), // Array of { seriesId, tenor, couponRate, quantity, amount }
  
  // Quantity and amount
  totalQuantity: integer("total_quantity").notNull(),
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  
  // Payment details
  paymentStatus: varchar("payment_status").default("pending"), // 'pending', 'paid', 'failed', 'refunded'
  paymentMethod: varchar("payment_method"), // 'netbanking', 'upi', 'asba'
  paymentReference: varchar("payment_reference"),
  paymentDate: timestamp("payment_date"),
  
  // ASBA details (if using ASBA)
  asbaAccountNumber: varchar("asba_account_number"),
  asbaBankName: varchar("asba_bank_name"),
  asbaBlockedAmount: decimal("asba_blocked_amount", { precision: 15, scale: 2 }),
  
  // Demat details
  dematAccountNumber: varchar("demat_account_number").notNull(),
  dpId: varchar("dp_id").notNull(),
  clientId: varchar("client_id").notNull(),
  
  // Allotment details
  applicationStatus: varchar("application_status").default("submitted"), 
  // 'submitted', 'under_processing', 'allotted', 'partially_allotted', 'rejected', 'refunded'
  allottedQuantity: integer("allotted_quantity"),
  allottedAmount: decimal("allotted_amount", { precision: 15, scale: 2 }),
  allotmentDate: date("allotment_date"),
  refundAmount: decimal("refund_amount", { precision: 15, scale: 2 }),
  refundDate: date("refund_date"),
  
  // Registrar reference
  registrarApplicationId: varchar("registrar_application_id"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ncd_applications_user").on(table.userId),
  index("idx_ncd_applications_issue").on(table.issueId),
  index("idx_ncd_applications_status").on(table.applicationStatus),
]);

export type BondNcdApplication = typeof bondNcdApplications.$inferSelect;
export type InsertBondNcdApplication = typeof bondNcdApplications.$inferInsert;

// ============================================
// PROCESS FLOW B - ADDITIONAL MARKETPLACE TABLES
// ============================================

// Catalog Source Tracking - Track data feed ingestion from NSE/BSE/RBI
export const fixedIncomeFeedIngestionLogs = pgTable("fixed_income_feed_ingestion_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Feed source details
  feedSource: varchar("feed_source").notNull(), // 'nse_ncb', 'bse_bond', 'rbi_retail_direct', 'bse_star_sgb', 'cams_rta', 'kfin_rta', 'goldenpi', 'indiabonds', 'manual'
  feedType: varchar("feed_type").notNull(), // 'full_refresh', 'incremental', 'price_update', 'new_issue', 'status_update'
  instrumentType: varchar("instrument_type").notNull(), // 'ncd', 'sgb', 'g_sec', 'corporate_bond', 't_bill', 'sdl', 'tax_free_bond'
  
  // Ingestion details
  ingestionStartTime: timestamp("ingestion_start_time").notNull(),
  ingestionEndTime: timestamp("ingestion_end_time"),
  recordsReceived: integer("records_received").default(0),
  recordsInserted: integer("records_inserted").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsSkipped: integer("records_skipped").default(0),
  recordsFailed: integer("records_failed").default(0),
  
  // Status
  ingestionStatus: varchar("ingestion_status").default("in_progress"), // 'in_progress', 'completed', 'failed', 'partial'
  
  // Error tracking
  errorDetails: jsonb("error_details").default([]),
  failedRecords: jsonb("failed_records").default([]),
  
  // Data quality metrics
  dataQualityScore: decimal("data_quality_score", { precision: 5, scale: 2 }), // 0-100
  duplicatesFound: integer("duplicates_found").default(0),
  validationErrors: integer("validation_errors").default(0),
  
  // Raw response storage (encrypted for sensitive data)
  rawResponsePath: text("raw_response_path"), // GCS path for raw response
  responseChecksum: varchar("response_checksum"),
  
  // Metadata
  triggeredBy: varchar("triggered_by").default("system"), // 'system', 'manual', 'webhook'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_feed_ingestion_source").on(table.feedSource),
  index("idx_feed_ingestion_type").on(table.feedType),
  index("idx_feed_ingestion_status").on(table.ingestionStatus),
  index("idx_feed_ingestion_time").on(table.ingestionStartTime),
]);

export type FixedIncomeFeedIngestionLog = typeof fixedIncomeFeedIngestionLogs.$inferSelect;
export type InsertFixedIncomeFeedIngestionLog = typeof fixedIncomeFeedIngestionLogs.$inferInsert;

// UCC Status - Unique Client Code tracking for bond trading eligibility
export const userUccStatus = pgTable("user_ucc_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // UCC details
  uccNumber: varchar("ucc_number").unique(), // Unique Client Code
  uccStatus: varchar("ucc_status").default("not_created"), // 'not_created', 'pending', 'active', 'suspended', 'deactivated'
  uccCreatedDate: date("ucc_created_date"),
  uccLastVerified: timestamp("ucc_last_verified"),
  
  // Exchange registration
  nseRegistered: boolean("nse_registered").default(false),
  bseRegistered: boolean("bse_registered").default(false),
  mcdxRegistered: boolean("mcdx_registered").default(false),
  ncdexRegistered: boolean("ncdex_registered").default(false),
  
  // Trading member details
  tradingMemberId: varchar("trading_member_id"),
  tradingMemberName: varchar("trading_member_name"),
  clearingMemberId: varchar("clearing_member_id"),
  
  // KRA status
  kraStatus: varchar("kra_status").default("not_verified"), // 'not_verified', 'verified', 'failed', 'pending'
  kraNumber: varchar("kra_number"),
  kraVerifiedDate: date("kra_verified_date"),
  kraAgency: varchar("kra_agency"), // 'cams', 'kfin', 'cvl', 'dotex', 'nsdl'
  
  // Demat linkage
  primaryDematId: varchar("primary_demat_id").references(() => userDematAccounts.id),
  dematVerified: boolean("demat_verified").default(false),
  
  // FATCA/CRS compliance
  fatcaCompliant: boolean("fatca_compliant").default(false),
  fatcaDeclarationDate: date("fatca_declaration_date"),
  
  // Trading eligibility
  bondTradingEnabled: boolean("bond_trading_enabled").default(false),
  ncdApplicationEnabled: boolean("ncd_application_enabled").default(false),
  sgbApplicationEnabled: boolean("sgb_application_enabled").default(false),
  gsecTradingEnabled: boolean("gsec_trading_enabled").default(false),
  
  // Eligibility restrictions
  eligibilityRestrictions: jsonb("eligibility_restrictions").default([]),
  restrictionReasons: text("restriction_reasons"),
  
  // Verification audit trail
  lastModifiedBy: varchar("last_modified_by"),
  verificationHistory: jsonb("verification_history").default([]),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ucc_status_user").on(table.userId),
  index("idx_ucc_status_ucc").on(table.uccNumber),
  index("idx_ucc_status_status").on(table.uccStatus),
  index("idx_ucc_status_kra").on(table.kraStatus),
]);

export type UserUccStatus = typeof userUccStatus.$inferSelect;
export type InsertUserUccStatus = typeof userUccStatus.$inferInsert;

// Order Payments - Detailed payment tracking for fixed income orders with gateway callbacks
export const fixedIncomeOrderPayments = pgTable("fixed_income_order_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Order reference
  orderId: varchar("order_id").references(() => bondOrders.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Payment details
  paymentType: varchar("payment_type").notNull(), // 'full_payment', 'margin', 'asba_block', 'refund'
  paymentMethod: varchar("payment_method").notNull(), // 'upi', 'netbanking', 'neft', 'rtgs', 'imps', 'asba'
  
  // Amounts
  orderAmount: decimal("order_amount", { precision: 15, scale: 2 }).notNull(),
  paymentAmount: decimal("payment_amount", { precision: 15, scale: 2 }).notNull(),
  convenienceFee: decimal("convenience_fee", { precision: 10, scale: 2 }).default("0"),
  gstOnFee: decimal("gst_on_fee", { precision: 10, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  
  // Payment gateway details
  paymentGateway: varchar("payment_gateway").notNull(), // 'cashfree', 'phonepe', 'razorpay', 'bse_star'
  gatewayOrderId: varchar("gateway_order_id").unique(),
  gatewayPaymentId: varchar("gateway_payment_id"),
  gatewayTransactionId: varchar("gateway_transaction_id"),
  
  // Payment link
  paymentLinkUrl: text("payment_link_url"),
  paymentLinkExpiresAt: timestamp("payment_link_expires_at"),
  
  // Status tracking
  paymentStatus: varchar("payment_status").default("pending"), 
  // 'pending', 'initiated', 'processing', 'completed', 'failed', 'refunded', 'cancelled', 'blocked_asba'
  paymentInitiatedAt: timestamp("payment_initiated_at"),
  paymentCompletedAt: timestamp("payment_completed_at"),
  
  // Bank details (for verification)
  payerBankName: varchar("payer_bank_name"),
  payerAccountNumber: varchar("payer_account_number"), // Last 4 digits only
  payerVpa: varchar("payer_vpa"), // For UPI payments
  
  // Gateway callback data
  gatewayResponse: jsonb("gateway_response").default({}),
  gatewaySignature: varchar("gateway_signature"),
  callbackReceivedAt: timestamp("callback_received_at"),
  
  // ASBA specific (for IPO/NCD applications)
  asbaBankName: varchar("asba_bank_name"),
  asbaAccountNumber: varchar("asba_account_number"),
  asbaBlockedAmount: decimal("asba_blocked_amount", { precision: 15, scale: 2 }),
  asbaReleaseDate: date("asba_release_date"),
  
  // Refund details
  refundStatus: varchar("refund_status"), // 'not_applicable', 'pending', 'initiated', 'completed', 'failed'
  refundAmount: decimal("refund_amount", { precision: 15, scale: 2 }),
  refundReason: text("refund_reason"),
  refundReference: varchar("refund_reference"),
  refundCompletedAt: timestamp("refund_completed_at"),
  
  // Reconciliation
  reconciliationStatus: varchar("reconciliation_status").default("pending"), // 'pending', 'matched', 'mismatched', 'manual_review'
  bankReconciliationRef: varchar("bank_reconciliation_ref"),
  
  // Retry tracking
  retryCount: integer("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at"),
  
  // Error tracking
  errorCode: varchar("error_code"),
  errorMessage: text("error_message"),
  
  // IP tracking for compliance
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_fi_payments_order").on(table.orderId),
  index("idx_fi_payments_user").on(table.userId),
  index("idx_fi_payments_status").on(table.paymentStatus),
  index("idx_fi_payments_gateway").on(table.paymentGateway),
  index("idx_fi_payments_gateway_order").on(table.gatewayOrderId),
]);

export type FixedIncomeOrderPayment = typeof fixedIncomeOrderPayments.$inferSelect;
export type InsertFixedIncomeOrderPayment = typeof fixedIncomeOrderPayments.$inferInsert;

// Settlement Records - Track demat settlement with NSDL/CDSL
export const fixedIncomeSettlements = pgTable("fixed_income_settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Order reference
  orderId: varchar("order_id").references(() => bondOrders.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Settlement type
  settlementType: varchar("settlement_type").notNull(), // 'regular', 'trade_date', 'spot', 'auction'
  settlementCycle: varchar("settlement_cycle").notNull(), // 'T+0', 'T+1', 'T+2'
  
  // Security details
  isin: varchar("isin").notNull(),
  securityName: text("security_name").notNull(),
  quantity: integer("quantity").notNull(),
  settlementValue: decimal("settlement_value", { precision: 15, scale: 2 }).notNull(),
  
  // Settlement dates
  tradeDate: date("trade_date").notNull(),
  expectedSettlementDate: date("expected_settlement_date").notNull(),
  actualSettlementDate: date("actual_settlement_date"),
  
  // Depository details
  depository: varchar("depository").notNull(), // 'nsdl', 'cdsl'
  dpId: varchar("dp_id").notNull(),
  clientId: varchar("client_id").notNull(),
  dematAccountNumber: varchar("demat_account_number").notNull(),
  
  // Settlement status
  settlementStatus: varchar("settlement_status").default("pending"),
  // 'pending', 'in_transit', 'credited', 'debited', 'failed', 'reversed', 'short_delivery'
  
  // Depository references
  depositoryTransactionId: varchar("depository_transaction_id"),
  depositoryInstructionId: varchar("depository_instruction_id"),
  depositoryRefNumber: varchar("depository_ref_number"),
  
  // Clearing corporation details
  clearingCorporation: varchar("clearing_corporation"), // 'iccl', 'nsccl'
  clearingNumber: varchar("clearing_number"),
  clearingReference: varchar("clearing_reference"),
  
  // Pay-in/Pay-out details
  payinStatus: varchar("payin_status"), // 'pending', 'completed', 'failed'
  payoutStatus: varchar("payout_status"), // 'pending', 'completed', 'failed'
  
  // Obligation details
  obligationId: varchar("obligation_id"),
  obligationType: varchar("obligation_type"), // 'delivery', 'receipt'
  
  // Counterparty details (for secondary market trades)
  counterpartyDpId: varchar("counterparty_dp_id"),
  counterpartyClientId: varchar("counterparty_client_id"),
  
  // Corporate actions (if any pending)
  corporateActionsPending: boolean("corporate_actions_pending").default(false),
  corporateActionsDetails: jsonb("corporate_actions_details").default([]),
  
  // Error handling
  settlementFailureReason: text("settlement_failure_reason"),
  retryAttempts: integer("retry_attempts").default(0),
  lastRetryAt: timestamp("last_retry_at"),
  
  // Audit trail
  statusHistory: jsonb("status_history").default([]),
  
  // PAN encryption for compliance (field-level encryption)
  encryptedPan: varchar("encrypted_pan"), // AES-256 encrypted PAN
  panEncryptionKeyId: varchar("pan_encryption_key_id"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_fi_settlements_order").on(table.orderId),
  index("idx_fi_settlements_user").on(table.userId),
  index("idx_fi_settlements_status").on(table.settlementStatus),
  index("idx_fi_settlements_isin").on(table.isin),
  index("idx_fi_settlements_date").on(table.expectedSettlementDate),
  index("idx_fi_settlements_depository").on(table.depository),
]);

export type FixedIncomeSettlement = typeof fixedIncomeSettlements.$inferSelect;
export type InsertFixedIncomeSettlement = typeof fixedIncomeSettlements.$inferInsert;

// Notification Subscriptions - User preferences for bond marketplace alerts
export const fixedIncomeNotificationPrefs = pgTable("fixed_income_notification_prefs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // Channel preferences
  emailEnabled: boolean("email_enabled").default(true),
  smsEnabled: boolean("sms_enabled").default(true),
  pushEnabled: boolean("push_enabled").default(true),
  whatsappEnabled: boolean("whatsapp_enabled").default(false),
  
  // Order and trading alerts
  orderConfirmationAlert: boolean("order_confirmation_alert").default(true),
  orderExecutionAlert: boolean("order_execution_alert").default(true),
  paymentReminderAlert: boolean("payment_reminder_alert").default(true),
  settlementAlert: boolean("settlement_alert").default(true),
  
  // Coupon and income alerts
  couponCreditAlert: boolean("coupon_credit_alert").default(true),
  couponDueReminderDays: integer("coupon_due_reminder_days").default(3),
  
  // Maturity alerts
  maturityAlertEnabled: boolean("maturity_alert_enabled").default(true),
  maturityReminderDays: jsonb("maturity_reminder_days").default([90, 60, 30, 7]),
  
  // Put/Call option alerts
  putCallOptionAlert: boolean("put_call_option_alert").default(true),
  putCallReminderDays: integer("put_call_reminder_days").default(30),
  
  // Rating change alerts
  ratingChangeAlert: boolean("rating_change_alert").default(true),
  ratingDowngradeAlert: boolean("rating_downgrade_alert").default(true),
  
  // New issue alerts
  newNcdIssueAlert: boolean("new_ncd_issue_alert").default(true),
  newSgbIssueAlert: boolean("new_sgb_issue_alert").default(true),
  newGsecAuctionAlert: boolean("new_gsec_auction_alert").default(false),
  
  // Price alerts
  priceAlertEnabled: boolean("price_alert_enabled").default(false),
  defaultPriceThresholdPercent: decimal("default_price_threshold_percent", { precision: 5, scale: 2 }).default("5"),
  
  // Yield alerts
  yieldAlertEnabled: boolean("yield_alert_enabled").default(false),
  defaultYieldThresholdBps: integer("default_yield_threshold_bps").default(25), // Basis points
  
  // Portfolio alerts
  portfolioValueAlert: boolean("portfolio_value_alert").default(false),
  portfolioValueThresholdPercent: decimal("portfolio_value_threshold_percent", { precision: 5, scale: 2 }),
  
  // Market insights
  weeklyMarketDigest: boolean("weekly_market_digest").default(true),
  researchReportsAlert: boolean("research_reports_alert").default(false),
  
  // Regulatory alerts
  regulatoryUpdateAlert: boolean("regulatory_update_alert").default(true),
  taxDeadlineAlert: boolean("tax_deadline_alert").default(true),
  
  // Quiet hours
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false),
  quietHoursStart: varchar("quiet_hours_start"), // HH:MM format
  quietHoursEnd: varchar("quiet_hours_end"),
  quietHoursTimezone: varchar("quiet_hours_timezone").default("Asia/Kolkata"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_fi_notif_prefs_user").on(table.userId),
]);

export type FixedIncomeNotificationPref = typeof fixedIncomeNotificationPrefs.$inferSelect;
export type InsertFixedIncomeNotificationPref = typeof fixedIncomeNotificationPrefs.$inferInsert;

// Report Snapshots - Generated reports storage for download
export const fixedIncomeReports = pgTable("fixed_income_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Report type
  reportType: varchar("report_type").notNull(),
  // 'bond_holding', 'coupon_schedule', 'maturity_calendar', 'transaction_ledger', 
  // 'tax_statement', 'capital_gains', 'portfolio_summary', 'custom'
  
  reportName: text("report_name").notNull(),
  reportDescription: text("report_description"),
  
  // Report parameters
  reportPeriodStart: date("report_period_start"),
  reportPeriodEnd: date("report_period_end"),
  instrumentTypes: jsonb("instrument_types").default([]), // Filter by instrument types
  reportFilters: jsonb("report_filters").default({}), // Additional filters
  
  // Report format
  reportFormat: varchar("report_format").notNull(), // 'pdf', 'xlsx', 'csv', 'json'
  
  // File storage (encrypted in GCS)
  fileUrl: text("file_url"),
  filePath: text("file_path"), // GCS path
  fileSize: integer("file_size"), // Bytes
  fileChecksum: varchar("file_checksum"),
  encryptionKeyId: varchar("encryption_key_id"),
  
  // Generation status
  generationStatus: varchar("generation_status").default("pending"),
  // 'pending', 'generating', 'completed', 'failed', 'expired'
  generationStartedAt: timestamp("generation_started_at"),
  generationCompletedAt: timestamp("generation_completed_at"),
  generationError: text("generation_error"),
  
  // Download tracking
  downloadCount: integer("download_count").default(0),
  lastDownloadedAt: timestamp("last_downloaded_at"),
  
  // Expiration
  expiresAt: timestamp("expires_at"),
  
  // Audit
  requestedBy: varchar("requested_by"), // 'user', 'system', 'admin'
  requestIpAddress: varchar("request_ip_address"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_fi_reports_user").on(table.userId),
  index("idx_fi_reports_type").on(table.reportType),
  index("idx_fi_reports_status").on(table.generationStatus),
  index("idx_fi_reports_expires").on(table.expiresAt),
]);

export type FixedIncomeReport = typeof fixedIncomeReports.$inferSelect;
export type InsertFixedIncomeReport = typeof fixedIncomeReports.$inferInsert;

// Partner/Agent Commission for Fixed Income - Commission tracking for bond orders
export const fixedIncomeAgentCommissions = pgTable("fixed_income_agent_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Order and agent reference
  orderId: varchar("order_id").references(() => bondOrders.id).notNull(),
  agentId: varchar("agent_id").references(() => agents.id),
  partnerId: varchar("partner_id").references(() => partners.id),
  
  // Client
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  // Product details
  productType: varchar("product_type").notNull(), // 'ncd', 'sgb', 'corporate_bond', 'g_sec', 'tax_free_bond'
  isin: varchar("isin"),
  productName: text("product_name").notNull(),
  
  // Transaction details
  transactionType: varchar("transaction_type").notNull(), // 'primary_subscription', 'secondary_purchase', 'secondary_sale'
  transactionAmount: decimal("transaction_amount", { precision: 15, scale: 2 }).notNull(),
  transactionDate: date("transaction_date").notNull(),
  
  // Commission calculation
  commissionType: varchar("commission_type").notNull(), // 'percentage', 'fixed', 'tiered'
  commissionRate: decimal("commission_rate", { precision: 8, scale: 4 }),
  grossCommission: decimal("gross_commission", { precision: 15, scale: 2 }).notNull(),
  
  // Deductions
  tdsDeducted: decimal("tds_deducted", { precision: 15, scale: 2 }).default("0"),
  tdsRate: decimal("tds_rate", { precision: 5, scale: 2 }).default("5"),
  gstOnCommission: decimal("gst_on_commission", { precision: 15, scale: 2 }).default("0"),
  gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).default("18"),
  otherDeductions: decimal("other_deductions", { precision: 15, scale: 2 }).default("0"),
  
  // Net commission
  netCommission: decimal("net_commission", { precision: 15, scale: 2 }).notNull(),
  
  // Split between agent and master
  agentShare: decimal("agent_share", { precision: 15, scale: 2 }),
  masterAgentShare: decimal("master_agent_share", { precision: 15, scale: 2 }),
  platformShare: decimal("platform_share", { precision: 15, scale: 2 }),
  
  // Settlement
  settlementStatus: varchar("settlement_status").default("pending"), // 'pending', 'approved', 'settled', 'rejected', 'on_hold'
  settlementDate: date("settlement_date"),
  settlementReference: varchar("settlement_reference"),
  settlementBatchId: varchar("settlement_batch_id"),
  
  // Clawback tracking
  clawbackEligible: boolean("clawback_eligible").default(true),
  clawbackPeriodDays: integer("clawback_period_days").default(365),
  clawbackExpiresAt: date("clawback_expires_at"),
  clawbackTriggered: boolean("clawback_triggered").default(false),
  clawbackAmount: decimal("clawback_amount", { precision: 15, scale: 2 }),
  clawbackReason: text("clawback_reason"),
  
  // Approval workflow
  approvalStatus: varchar("approval_status").default("pending"), // 'pending', 'approved', 'rejected'
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  
  // Audit
  calculationDetails: jsonb("calculation_details").default({}),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_fi_agent_comm_order").on(table.orderId),
  index("idx_fi_agent_comm_agent").on(table.agentId),
  index("idx_fi_agent_comm_partner").on(table.partnerId),
  index("idx_fi_agent_comm_client").on(table.clientId),
  index("idx_fi_agent_comm_settlement").on(table.settlementStatus),
  index("idx_fi_agent_comm_date").on(table.transactionDate),
]);

export type FixedIncomeAgentCommission = typeof fixedIncomeAgentCommissions.$inferSelect;
export type InsertFixedIncomeAgentCommission = typeof fixedIncomeAgentCommissions.$inferInsert;

// Drizzle Zod schemas for Fixed Income
export const insertNcdPublicIssueSchema = createInsertSchema(ncdPublicIssues).extend({
  id: z.any(),
  createdAt: z.any(),
  lastUpdated: z.any(),
}).omit({ id: true, createdAt: true, lastUpdated: true });

export const agentComplianceAuditLogs = pgTable("agent_compliance_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Core Relationships
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  clientId: varchar("client_id").references(() => users.id),
  sessionId: varchar("session_id").references(() => advisorySessions.id),
  proposalId: varchar("proposal_id").references(() => investmentProposals.id),
  
  // Agent Identification (immutable snapshot)
  agentArnCode: varchar("agent_arn_code"),
  agentEuinNumber: varchar("agent_euin_number"),
  agentName: varchar("agent_name"),
  
  // Action Details
  actionCategory: varchar("action_category").notNull(), // session, proposal, portfolio, execution, compliance
  actionType: varchar("action_type").notNull(), // create, update, approve, reject, share, execute, note_added, etc.
  actionDescription: text("action_description").notNull(),
  
  // Before/After State (for change tracking)
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  changedFields: jsonb("changed_fields").$type<string[]>(),
  
  // Suitability Evidence
  suitabilityCheckId: varchar("suitability_check_id"),
  suitabilityPassed: boolean("suitability_passed"),
  
  // System Metadata
  optimizerVersion: varchar("optimizer_version"),
  rebalancerVersion: varchar("rebalancer_version"),
  explainabilityVersion: varchar("explainability_version"),
  
  // Client Consent/Approval
  clientConsentObtained: boolean("client_consent_obtained"),
  clientConsentTimestamp: timestamp("client_consent_timestamp"),
  clientConsentMethod: varchar("client_consent_method"), // otp, signature, email
  
  // Request Context
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  deviceFingerprint: varchar("device_fingerprint"),
  
  // Regulatory Flags
  isSebiReportable: boolean("is_sebi_reportable").default(false),
  regulatoryReportId: varchar("regulatory_report_id"),
  
  // Retention (8 years per SEBI requirement)
  retentionEndDate: timestamp("retention_end_date"), // createdAt + 8 years
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archiveLocation: varchar("archive_location"), // Object storage path for archived logs
  
  // Immutable timestamp
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_compliance_audit_agent").on(table.agentId),
  index("idx_agent_compliance_audit_client").on(table.clientId),
  index("idx_agent_compliance_audit_session").on(table.sessionId),
  index("idx_agent_compliance_audit_proposal").on(table.proposalId),
  index("idx_agent_compliance_audit_action").on(table.actionType),
  index("idx_agent_compliance_audit_timestamp").on(table.timestamp),
  index("idx_agent_compliance_audit_category").on(table.actionCategory),
]);

// Insert schemas and types for Agent Portal

export const usConsents = pgTable("us_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  orderId: varchar("order_id").references(() => usOrders.id),
  
  // Consent Details
  consentType: varchar("consent_type", { length: 50 }).notNull(), // trade_approval, lrs_declaration, risk_acknowledgment
  consentHash: varchar("consent_hash", { length: 128 }).notNull(), // SHA-256 hash of consent data
  consentData: jsonb("consent_data").notNull(), // Original consent payload
  
  // Verification
  verificationMethod: varchar("verification_method", { length: 50 }), // otp, biometric, signature
  verificationRef: varchar("verification_ref"), // OTP reference or signature ID
  
  // IP & Device Tracking
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_us_consents_client").on(table.clientId),
  index("idx_us_consents_order").on(table.orderId),
  index("idx_us_consents_hash").on(table.consentHash),
]);

export const insertUsConsentSchema = createInsertSchema(usConsents).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export const entityComplianceScores = pgTable("entity_compliance_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Entity Details
  entityType: documentEntityTypeEnum("entity_type").notNull(),
  entityId: varchar("entity_id").notNull(),
  entityName: varchar("entity_name", { length: 255 }),
  entityPan: varchar("entity_pan", { length: 20 }),
  
  // Scores
  overallScore: integer("overall_score").default(0), // 0-100
  agreementQualityScore: integer("agreement_quality_score").default(0),
  renewalHygieneScore: integer("renewal_hygiene_score").default(0),
  overrideFrequencyScore: integer("override_frequency_score").default(0),
  riskExposureScore: integer("risk_exposure_score").default(0),
  
  // Metrics
  totalDocuments: integer("total_documents").default(0),
  activeDocuments: integer("active_documents").default(0),
  expiredDocuments: integer("expired_documents").default(0),
  pendingRenewals: integer("pending_renewals").default(0),
  totalOverrides: integer("total_overrides").default(0),
  recentOverrides: integer("recent_overrides").default(0), // Last 90 days
  
  // Flags
  hasHighRiskDocuments: boolean("has_high_risk_documents").default(false),
  hasOverdueRenewals: boolean("has_overdue_renewals").default(false),
  hasComplianceIssues: boolean("has_compliance_issues").default(false),
  
  // Last Calculated
  lastCalculatedAt: timestamp("last_calculated_at").defaultNow(),
  calculationDetails: jsonb("calculation_details").default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_entity_scores_entity").on(table.entityType, table.entityId),
  index("idx_entity_scores_overall").on(table.overallScore),
  index("idx_entity_scores_pan").on(table.entityPan),
]);

export const insertEntityComplianceScoreSchema = createInsertSchema(entityComplianceScores).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const ckycMockBlockedAttempts = pgTable("ckyc_mock_blocked_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Attempt Context
  attemptedProvider: varchar("attempted_provider", { length: 50 }).default("mock").notNull(),
  userId: varchar("user_id").references(() => users.id),
  panNumber: varchar("pan_number", { length: 10 }),
  
  // Block Details
  blockedReason: text("blocked_reason").notNull(),
  isSecurityEvent: boolean("is_security_event").default(true).notNull(),
  environmentMode: varchar("environment_mode", { length: 20 }).notNull(), // PROD, UAT, DEV, DEMO
  
  // Request Context
  requestPath: varchar("request_path", { length: 255 }),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  
  // Timestamp
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mock_blocked_time").on(table.attemptedAt),
  index("idx_mock_blocked_user").on(table.userId),
  index("idx_mock_blocked_env").on(table.environmentMode),
]);

export const insertCkycMockBlockedAttemptSchema = createInsertSchema(ckycMockBlockedAttempts).extend({
  id: z.any(),
  attemptedAt: z.any(),
}).omit({ id: true, attemptedAt: true });

export const ckycAuditLog = pgTable("ckyc_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Event Context
  caseId: varchar("case_id").references(() => ckycDeferredCases.id),
  userId: varchar("user_id").references(() => users.id),
  panNumber: varchar("pan_number", { length: 10 }),
  
  // Event Details
  eventType: varchar("event_type", { length: 50 }).notNull(), // case_created, status_change, admin_action, sla_breach, escalation, resolution
  eventSubtype: varchar("event_subtype", { length: 50 }), // provider_failed, manual_kyc_initiated, vkyc_scheduled, rejected, etc.
  
  // State Transition
  previousState: varchar("previous_state", { length: 50 }),
  newState: varchar("new_state", { length: 50 }),
  
  // Event Data (JSON for flexibility)
  eventData: jsonb("event_data").default({}), // Provider details, failure reasons, admin notes, etc.
  
  // Actor Information
  actorId: varchar("actor_id").references(() => users.id), // Who performed the action
  actorRole: varchar("actor_role", { length: 50 }), // system, admin, compliance_head, user
  actorName: varchar("actor_name", { length: 255 }),
  
  // Immutability Protection
  checksum: varchar("checksum", { length: 64 }), // SHA-256 hash of event data for tamper detection
  previousLogId: varchar("previous_log_id").references((): any => ckycAuditLog.id), // Chain reference
  
  // Compliance Metadata
  isComplianceEvent: boolean("is_compliance_event").default(false),
  isEscalation: boolean("is_escalation").default(false),
  isSLARelated: boolean("is_sla_related").default(false),
  
  // Timestamps
  eventTimestamp: timestamp("event_timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ckyc_case_audit_case").on(table.caseId),
  index("idx_ckyc_case_audit_user").on(table.userId),
  index("idx_ckyc_case_audit_type").on(table.eventType),
  index("idx_ckyc_case_audit_time").on(table.eventTimestamp),
  index("idx_ckyc_case_audit_compliance").on(table.isComplianceEvent),
  index("idx_ckyc_case_audit_pan").on(table.panNumber),
]);

export const insertCkycAuditLogSchema = createInsertSchema(ckycAuditLog).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export type CkycAuditLog = typeof ckycAuditLog.$inferSelect;

export type InsertCkycAuditLog = z.infer<typeof insertCkycAuditLogSchema>;

export const ckycEscalationHistory = pgTable("ckyc_escalation_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Case Reference
  caseId: varchar("case_id").references(() => ckycDeferredCases.id).notNull(),
  
  // Escalation Details
  escalationLevel: integer("escalation_level").notNull(), // 1=compliance_head, 2=management, 3=ceo
  escalatedFrom: integer("escalated_from").default(0).notNull(), // Previous level
  
  // Escalation Recipients
  escalatedToUserId: varchar("escalated_to_user_id").references(() => users.id),
  escalatedToEmail: varchar("escalated_to_email", { length: 255 }),
  escalatedToRole: varchar("escalated_to_role", { length: 50 }), // compliance_head, compliance_manager, management
  
  // Escalation Trigger
  escalationTrigger: varchar("escalation_trigger", { length: 50 }).notNull(), // sla_breach, manual, auto_aging
  hoursOverdue: integer("hours_overdue").default(0),
  
  // Notification Status
  emailSent: boolean("email_sent").default(false),
  emailSentAt: timestamp("email_sent_at"),
  emailMessageId: varchar("email_message_id", { length: 255 }),
  
  // Acknowledgement
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  
  // Timestamps
  escalatedAt: timestamp("escalated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_escalation_case").on(table.caseId),
  index("idx_escalation_level").on(table.escalationLevel),
  index("idx_escalation_time").on(table.escalatedAt),
]);

export const insertCkycEscalationHistorySchema = createInsertSchema(ckycEscalationHistory).extend({
  id: z.any(),
  escalatedAt: z.any(),
}).omit({ id: true, escalatedAt: true });

export type CkycEscalationHistory = typeof ckycEscalationHistory.$inferSelect;

export type InsertCkycEscalationHistory = z.infer<typeof insertCkycEscalationHistorySchema>;

export const orderFeeConsentLog = pgTable("order_fee_consent_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  orderId: varchar("order_id").notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  // Fee Details at Order Time
  feeMode: varchar("fee_mode", { length: 30 }).notNull(),
  advisoryFeeApplied: decimal("advisory_fee_applied", { precision: 15, scale: 2 }),
  platformFeeApplied: decimal("platform_fee_applied", { precision: 15, scale: 2 }),
  totalFeeApplied: decimal("total_fee_applied", { precision: 15, scale: 2 }).notNull(),
  
  // Order Context
  orderValueInr: decimal("order_value_inr", { precision: 15, scale: 2 }).notNull(),
  orderSymbol: varchar("order_symbol", { length: 20 }),
  orderSide: varchar("order_side", { length: 10 }), // buy, sell
  
  // Consent Capture
  feeBreakdownShown: boolean("fee_breakdown_shown").default(true).notNull(),
  consentAcknowledged: boolean("consent_acknowledged").default(false).notNull(),
  consentTimestamp: timestamp("consent_timestamp"),
  ipAddress: varchar("ip_address", { length: 45 }),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ofcl_client").on(table.clientId),
  index("idx_ofcl_order").on(table.orderId),
  index("idx_ofcl_mode").on(table.feeMode),
]);

export const insertOrderFeeConsentLogSchema = createInsertSchema(orderFeeConsentLog).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

export type OrderFeeConsentLog = typeof orderFeeConsentLog.$inferSelect;

export type InsertOrderFeeConsentLog = z.infer<typeof insertOrderFeeConsentLogSchema>;

export const lrsComplianceTracking = pgTable("lrs_compliance_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  financialYear: varchar("financial_year", { length: 7 }).notNull(), // 2024-25
  totalRemittedUsd: numeric("total_remitted_usd").default("0"),
  totalRemittedInr: numeric("total_remitted_inr").default("0"),
  remainingLimitUsd: numeric("remaining_limit_usd").default("250000"),
  lrsLimitUsd: numeric("lrs_limit_usd").default("250000"),
  lastTransactionDate: date("last_transaction_date"),
  transactionCount: integer("transaction_count").default(0),
  purposes: jsonb("purposes"), // ["investment", "education", "travel"]
  bankAccounts: jsonb("bank_accounts"), // Authorized dealer banks used
  fatcaStatus: varchar("fatca_status", { length: 20 }).default("pending"), // pending, compliant, non_compliant
  fatcaDeclarationDate: date("fatca_declaration_date"),
  crsStatus: varchar("crs_status", { length: 20 }).default("pending"),
  form15caFiled: boolean("form15ca_filed").default(false),
  form15cbObtained: boolean("form15cb_obtained").default(false),
  taxResidencyCertificate: boolean("tax_residency_certificate").default(false),
  w8benFiled: boolean("w8ben_filed").default(false),
  w8benExpiryDate: date("w8ben_expiry_date"),
  notes: text("notes"),
  isBlocked: boolean("is_blocked").default(false),
  blockReason: text("block_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_lrs_user").on(table.userId),
  index("idx_lrs_fy").on(table.financialYear),
  index("idx_lrs_user_fy").on(table.userId, table.financialYear),
]);

export const insertLrsComplianceTrackingSchema = createInsertSchema(lrsComplianceTracking).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export type LrsComplianceTracking = typeof lrsComplianceTracking.$inferSelect;

export type InsertLrsComplianceTracking = z.infer<typeof insertLrsComplianceTrackingSchema>;

export const consentAuditLog = pgTable("consent_audit_log", {
  id: serial("id").primaryKey(),
  
  userId: integer("user_id"),
  sessionId: varchar("session_id", { length: 100 }),
  
  consentType: varchar("consent_type", { length: 50 }).notNull(),
  action: varchar("action", { length: 20 }).notNull(),
  version: varchar("version", { length: 20 }).default("1.0"),
  
  sourceScreen: varchar("source_screen", { length: 100 }),
  sourceComponent: varchar("source_component", { length: 100 }),
  
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  consentText: text("consent_text"),
  additionalData: jsonb("additional_data").default({}),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_consent_audit_user").on(table.userId),
  index("idx_consent_audit_type").on(table.consentType),
  index("idx_consent_audit_created").on(table.createdAt),
]);

export const insertConsentAuditLogSchema = createInsertSchema(consentAuditLog).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true, createdAt: true,
});

export type ConsentAuditLog = typeof consentAuditLog.$inferSelect;

export type InsertConsentAuditLog = z.infer<typeof insertConsentAuditLogSchema>;

export const consentLogs = pgTable("consent_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  consentType: varchar("consent_type", { length: 50 }).notNull(),
  purposeCode: varchar("purpose_code", { length: 50 }).notNull(),
  purposeDescription: text("purpose_description").notNull(),
  consentGiven: boolean("consent_given").notNull(),
  consentTimestamp: timestamp("consent_timestamp").defaultNow().notNull(),
  withdrawnAt: timestamp("withdrawn_at"),
  withdrawalReason: text("withdrawal_reason"),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  dataRetentionDays: integer("data_retention_days").default(365),
  retentionExpiresAt: timestamp("retention_expires_at"),
  regulatoryBasis: varchar("regulatory_basis", { length: 100 }),
  version: varchar("version", { length: 20 }).default("1.0"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mfComplianceStateLog = pgTable("mf_compliance_state_log", {
  id: serial("id").primaryKey(),
  schemeCode: varchar("scheme_code").notNull(),
  fromStatus: varchar("from_status", { length: 30 }),
  toStatus: varchar("to_status", { length: 30 }).notNull(),
  reason: text("reason"),
  triggeredBy: varchar("triggered_by", { length: 100 }).notNull(), // system, admin userId, or engine name
  triggeredAt: timestamp("triggered_at").defaultNow(),
}, (table) => [
  index("idx_mf_compliance_state_log_scheme").on(table.schemeCode),
  index("idx_mf_compliance_state_log_at").on(table.triggeredAt),
]);

export type MfComplianceStateLog = typeof mfComplianceStateLog.$inferSelect;
export type InsertMfComplianceStateLog = typeof mfComplianceStateLog.$inferInsert;

// ── MF Categorization Audit Log — tracks every category re-assignment ──
export const mfCategorizationAuditLog = pgTable("mf_categorization_audit_log", {
  id: serial("id").primaryKey(),
  schemeCode: varchar("scheme_code").notNull(),
  oldCategory: varchar("old_category", { length: 100 }),
  newCategory: varchar("new_category", { length: 100 }),
  oldSubcategory: varchar("old_subcategory", { length: 100 }),
  newSubcategory: varchar("new_subcategory", { length: 100 }),
  triggeredBy: varchar("triggered_by", { length: 100 }).notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
  taxonomyVersion: varchar("taxonomy_version", { length: 20 }).notNull(),
}, (table) => [
  index("idx_mf_categorization_audit_scheme").on(table.schemeCode),
  index("idx_mf_categorization_audit_at").on(table.changedAt),
  index("idx_mf_categorization_audit_version").on(table.taxonomyVersion),
]);

export type MfCategorizationAuditLog = typeof mfCategorizationAuditLog.$inferSelect;
export type InsertMfCategorizationAuditLog = typeof mfCategorizationAuditLog.$inferInsert;

// ── WebAuthn Biometric Authentication ──────────────────────────────────────

export const userWebauthnCredentials = pgTable("user_webauthn_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  signCount: integer("sign_count").notNull().default(0),
  deviceType: varchar("device_type", { length: 50 }),
  deviceName: varchar("device_name", { length: 100 }),
  aaguid: varchar("aaguid", { length: 100 }),
  backedUp: boolean("backed_up").default(false),
  transports: text("transports").array(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_webauthn_creds_user").on(table.userId),
  index("idx_webauthn_creds_credential_id").on(table.credentialId),
]);

export type UserWebauthnCredential = typeof userWebauthnCredentials.$inferSelect;
export type InsertUserWebauthnCredential = typeof userWebauthnCredentials.$inferInsert;

export const webauthnChallenges = pgTable("webauthn_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  challenge: text("challenge").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // 'registration' | 'authentication'
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_webauthn_challenges_user").on(table.userId),
  index("idx_webauthn_challenges_expires").on(table.expiresAt),
]);

export type WebauthnChallenge = typeof webauthnChallenges.$inferSelect;
export type InsertWebauthnChallenge = typeof webauthnChallenges.$inferInsert;

export const webauthnAuditLog = pgTable("webauthn_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  event: varchar("event", { length: 50 }).notNull(), // 'registration_success' | 'auth_success' | 'auth_failure' | 'replay_blocked' | 'credential_deleted'
  credentialId: text("credential_id"),
  ipAddress: varchar("ip_address", { length: 100 }),
  userAgent: text("user_agent"),
  deviceType: varchar("device_type", { length: 50 }),
  riskScore: integer("risk_score"),
  riskFactors: jsonb("risk_factors"),
  stepUpRequired: varchar("step_up_required", { length: 30 }),
  success: boolean("success").notNull(),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_webauthn_audit_user").on(table.userId),
  index("idx_webauthn_audit_event").on(table.event),
  index("idx_webauthn_audit_created").on(table.createdAt),
]);

export type WebauthnAuditLog = typeof webauthnAuditLog.$inferSelect;
export type InsertWebauthnAuditLog = typeof webauthnAuditLog.$inferInsert;

// ══════════════════════════════════════════════════════════════════════════════
// FIRM INVENTORY SYSTEM — MS FintekPro Advisors LLP DP Holdings & Transactions
// ══════════════════════════════════════════════════════════════════════════════

export const firmDpHoldings = pgTable("firm_dp_holdings", {
  id: serial("id").primaryKey(),
  partnerId: varchar("partner_id", { length: 100 }).notNull().default('platform-partner-001'),
  companyId: varchar("company_id", { length: 100 }),
  isin: varchar("isin", { length: 20 }),
  securityName: varchar("security_name", { length: 500 }).notNull(),
  securityType: varchar("security_type", { length: 50 }).notNull().default('unlisted_equity'),
  quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull().default('0'),
  avgCostPrice: numeric("avg_cost_price", { precision: 18, scale: 4 }),
  currentPrice: numeric("current_price", { precision: 18, scale: 4 }),
  totalCostValue: numeric("total_cost_value", { precision: 18, scale: 4 }),
  currentMarketValue: numeric("current_market_value", { precision: 18, scale: 4 }),
  zohoItemId: varchar("zoho_item_id", { length: 100 }),
  zohoItemSku: varchar("zoho_item_sku", { length: 100 }),
  lastZohoSyncAt: timestamp("last_zoho_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_firm_dp_holdings_partner").on(table.partnerId),
  index("idx_firm_dp_holdings_isin").on(table.isin),
]);

export type FirmDpHolding = typeof firmDpHoldings.$inferSelect;
export type InsertFirmDpHolding = typeof firmDpHoldings.$inferInsert;

export const firmTransactions = pgTable("firm_transactions", {
  id: serial("id").primaryKey(),
  partnerId: varchar("partner_id", { length: 100 }).notNull().default('platform-partner-001'),
  holdingId: integer("holding_id").references(() => firmDpHoldings.id),
  transactionType: varchar("transaction_type", { length: 50 }).notNull(),
  securityName: varchar("security_name", { length: 500 }).notNull(),
  isin: varchar("isin", { length: 20 }),
  companyId: varchar("company_id", { length: 100 }),
  quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull(),
  pricePerShare: numeric("price_per_share", { precision: 18, scale: 4 }),
  totalValue: numeric("total_value", { precision: 18, scale: 4 }).notNull(),
  charges: numeric("charges", { precision: 18, scale: 4 }).default('0'),
  netValue: numeric("net_value", { precision: 18, scale: 4 }).notNull(),
  transactionDate: varchar("transaction_date", { length: 20 }).notNull(),
  counterpartyName: varchar("counterparty_name", { length: 500 }),
  counterpartyId: varchar("counterparty_id", { length: 100 }),
  reference: varchar("reference", { length: 200 }),
  notes: text("notes"),
  zohoStatus: varchar("zoho_status", { length: 30 }).default('pending'),
  zohoInvoiceId: varchar("zoho_invoice_id", { length: 100 }),
  zohoBillId: varchar("zoho_bill_id", { length: 100 }),
  zohoSyncedAt: timestamp("zoho_synced_at"),
  zohoSyncError: text("zoho_sync_error"),
  zohoSourceEventId: varchar("zoho_source_event_id", { length: 200 }),
  createdBy: varchar("created_by", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_firm_txn_partner").on(table.partnerId),
  index("idx_firm_txn_date").on(table.transactionDate),
  index("idx_firm_txn_zoho_status").on(table.zohoStatus),
  index("idx_firm_txn_holding").on(table.holdingId),
]);

export type FirmTransaction = typeof firmTransactions.$inferSelect;
export type InsertFirmTransaction = typeof firmTransactions.$inferInsert;

// ========================================
// Agent Notifications Table
// ========================================
export const agentNotifications = pgTable("agent_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: varchar("agent_id", { length: 100 }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  message: text("message"), // Added to fix "column does not exist" errors in logs
  type: varchar("type", { length: 30 }).notNull().default('prospect'),
  link: text("link"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_notifications_agent").on(table.agentId),
  index("idx_agent_notifications_created").on(table.createdAt),
]);

export type AgentNotification = typeof agentNotifications.$inferSelect;
export type InsertAgentNotification = typeof agentNotifications.$inferInsert;

// ========================================
// Agent Investment Baskets (Wealthy Ideas)
// ========================================
export const agentBaskets = pgTable("agent_baskets", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: varchar("agent_id", { length: 100 }).notNull().references(() => users.id),
  name: text("name").notNull(),
  theme: varchar("theme", { length: 100 }).notNull().default("Custom"),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_baskets_agent").on(table.agentId),
  index("idx_agent_baskets_created").on(table.createdAt),
]);

export type AgentBasket = typeof agentBaskets.$inferSelect;
export type InsertAgentBasket = typeof agentBaskets.$inferInsert;
export const insertAgentBasketSchema = createInsertSchema(agentBaskets).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const aadhaarConsentArtifacts = pgTable("aadhaar_consent_artifacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  aadhaarLast4: varchar("aadhaar_last4", { length: 4 }),              // Last 4 digits only — never full Aadhaar
  purpose: varchar("purpose", { length: 255 }).notNull(),             // e.g. "KYC verification for investing"
  consentText: text("consent_text").notNull(),                        // Full consent text shown to user
  consentGivenAt: timestamp("consent_given_at").defaultNow().notNull(),
  otpReference: varchar("otp_reference", { length: 100 }),            // Reference from Aadhaar OTP session
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id", { length: 100 }),
  verificationOutcome: varchar("verification_outcome", { length: 20 }), // 'success' | 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_aadhaar_consent_user").on(table.userId),
  index("idx_aadhaar_consent_date").on(table.consentGivenAt),
]);
export type AadhaarConsentArtifact = typeof aadhaarConsentArtifacts.$inferSelect;
export const insertAadhaarConsentArtifactSchema = createInsertSchema(aadhaarConsentArtifacts).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({ id: true, createdAt: true });

// --- Tables extracted from shared/schema.ts ---

// SEBI Registered Depository Participants Registry
export const sebiDepositoryParticipants = pgTable("sebi_depository_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dpId: varchar("dp_id").unique().notNull(),
  dpName: varchar("dp_name").notNull(),
  sebiRegistrationNumber: varchar("sebi_registration_number").notNull(),
  depository: varchar("depository").notNull(),
  nsdlDpId: varchar("nsdl_dp_id").unique(),
  cdslDpId: varchar("cdsl_dp_id").unique(),
  isPrimaryNsdl: boolean("is_primary_nsdl").default(false),
  isPrimaryCdsl: boolean("is_primary_cdsl").default(false),
  registrationDate: timestamp("registration_date", { withTimezone: true }),
  registrationValidUntil: timestamp("registration_valid_until", { withTimezone: true }),
  registeredAddress: text("registered_address"),
  city: varchar("city"),
  state: varchar("state"),
  pincode: varchar("pincode"),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  website: varchar("website"),
  status: varchar("status").notNull().default("active"),
  statusReason: text("status_reason"),
  statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }),
  lastSebiVerification: timestamp("last_sebi_verification", { withTimezone: true }),
  complianceScore: integer("compliance_score"),
  dataSource: varchar("data_source").notNull(),
  externalId: varchar("external_id"),
  syncHash: varchar("sync_hash"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const insertSebiDepositoryParticipantSchema = createInsertSchema(sebiDepositoryParticipants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSebiDepositoryParticipant = z.infer<typeof insertSebiDepositoryParticipantSchema>;
export type SebiDepositoryParticipant = typeof sebiDepositoryParticipants.$inferSelect;

export const otpVerifications = pgTable("otp_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identifier: varchar("identifier").notNull(),
  otp: varchar("otp", { length: 6 }).notNull(),
  type: varchar("type").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  verified: boolean("verified").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOtpVerificationSchema = createInsertSchema(otpVerifications).omit({
  id: true,
  createdAt: true,
});
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  identifier: varchar("identifier").notNull(),
  token: varchar("token", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

export const incomeStreams = pgTable("income_streams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  incomeType: varchar("income_type").notNull(),
  sourceName: varchar("source_name").notNull(),
  grossAmount: decimal("gross_amount", { precision: 15, scale: 2 }).notNull(),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }).notNull(),
  frequency: varchar("frequency").notNull().default("monthly"),
  currency: varchar("currency").default("INR"),
  isGuaranteed: boolean("is_guaranteed").default(true),
  stabilityScore: integer("stability_score").default(100),
  variabilityPercent: decimal("variability_percent", { precision: 5, scale: 2 }).default("0"),
  isVerified: boolean("is_verified").default(false),
  verificationMethod: varchar("verification_method"),
  verificationDate: timestamp("verification_date"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_income_streams_user").on(table.userId),
  index("idx_income_streams_type").on(table.incomeType),
]);

export const insertIncomeStreamSchema = createInsertSchema(incomeStreams).omit({ id: true, createdAt: true, updatedAt: true });
export type IncomeStream = typeof incomeStreams.$inferSelect;
export type InsertIncomeStream = z.infer<typeof insertIncomeStreamSchema>;

export const financialObligations = pgTable("financial_obligations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  obligationType: varchar("obligation_type").notNull(),
  institutionName: varchar("institution_name"),
  accountNumber: varchar("account_number"),
  monthlyAmount: decimal("monthly_amount", { precision: 15, scale: 2 }).notNull(),
  totalOutstanding: decimal("total_outstanding", { precision: 15, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  remainingTenure: integer("remaining_tenure"),
  priority: varchar("priority").notNull().default("essential"),
  isFixed: boolean("is_fixed").default(true),
  cibilReported: boolean("cibil_reported").default(false),
  cibilAccountType: varchar("cibil_account_type"),
  paymentHistory: varchar("payment_history"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_financial_obligations_user").on(table.userId),
  index("idx_financial_obligations_type").on(table.obligationType),
]);

export const insertFinancialObligationSchema = createInsertSchema(financialObligations).omit({ id: true, createdAt: true, updatedAt: true });
export type FinancialObligation = typeof financialObligations.$inferSelect;
export type InsertFinancialObligation = z.infer<typeof insertFinancialObligationSchema>;

export const emergencyFunds = pgTable("emergency_funds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  monthlyExpenses: decimal("monthly_expenses", { precision: 15, scale: 2 }).notNull(),
  requiredEmergencyFund: decimal("required_emergency_fund", { precision: 15, scale: 2 }).notNull(),
  currentEmergencyFund: decimal("current_emergency_fund", { precision: 15, scale: 2 }).default("0"),
  emergencyFundCoverage: decimal("emergency_fund_coverage", { precision: 5, scale: 2 }).default("0"),
  fundAllocation: jsonb("fund_allocation").$type<{
    savings: number;
    fd: number;
    liquid_mf: number;
    other: number;
  }>(),
  isAdequate: boolean("is_adequate").default(false),
  shortfall: decimal("shortfall", { precision: 15, scale: 2 }).default("0"),
  lastAssessedAt: timestamp("last_assessed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_emergency_funds_user").on(table.userId),
]);

export const insertEmergencyFundSchema = createInsertSchema(emergencyFunds).omit({ id: true, createdAt: true, updatedAt: true });
export type EmergencyFund = typeof emergencyFunds.$inferSelect;
export type InsertEmergencyFund = z.infer<typeof insertEmergencyFundSchema>;

export const investableSurplus = pgTable("investable_surplus", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  calculationDate: timestamp("calculation_date").defaultNow(),
  periodType: varchar("period_type").notNull().default("annual"), // monthly/quarterly/annual
  totalGrossIncome: decimal("total_gross_income", { precision: 15, scale: 2 }).notNull(),
  totalNetIncome: decimal("total_net_income", { precision: 15, scale: 2 }).notNull(),
  incomeBreakdown: jsonb("income_breakdown").$type<{
    salary: number;
    business: number;
    rental: number;
    interest: number;
    dividend: number;
    other: number;
  }>(),
  totalObligations: decimal("total_obligations", { precision: 15, scale: 2 }).notNull(),
  obligationsBreakdown: jsonb("obligations_breakdown").$type<{
    loans: number;
    insurance: number;
    rent: number;
    utilities: number;
    other: number;
  }>(),
  emergencyBufferAmount: decimal("emergency_buffer_amount", { precision: 15, scale: 2 }).notNull(),
  emergencyBufferStatus: varchar("emergency_buffer_status").notNull(), // adequate/partial/inadequate
  annualInvestableSurplus: decimal("annual_investable_surplus", { precision: 15, scale: 2 }).notNull(),
  monthlyInvestableSurplus: decimal("monthly_investable_surplus", { precision: 15, scale: 2 }).notNull(),
  surplusStability: varchar("surplus_stability").default("stable"), // stable/moderate/volatile
  confidenceScore: integer("confidence_score").default(80), // 0-100
  surplusRecommendations: jsonb("surplus_recommendations").$type<{
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_investable_surplus_user").on(table.userId),
  index("idx_investable_surplus_date").on(table.calculationDate),
]);

export const insertInvestableSurplusSchema = createInsertSchema(investableSurplus).omit({ id: true, createdAt: true });
export type InvestableSurplus = typeof investableSurplus.$inferSelect;
export type InsertInvestableSurplus = z.infer<typeof insertInvestableSurplusSchema>;

export const identityProfiles = pgTable("identity_profiles", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  identityTokenId: varchar("identity_token_id", { length: 100 }).unique().notNull(),
  panNumber: varchar("pan_number", { length: 10 }),
  panVerified: boolean("pan_verified").default(false),
  panVerifiedAt: timestamp("pan_verified_at"),
  panProvider: varchar("pan_provider", { length: 50 }),
  aadhaarLastFour: varchar("aadhaar_last_four", { length: 4 }),
  aadhaarVerified: boolean("aadhaar_verified").default(false),
  aadhaarVerifiedAt: timestamp("aadhaar_verified_at"),
  aadhaarProvider: varchar("aadhaar_provider", { length: 50 }),
  ckycNumber: varchar("ckyc_number", { length: 20 }),
  ckycVerified: boolean("ckyc_verified").default(false),
  ckycVerifiedAt: timestamp("ckyc_verified_at"),
  ckycProvider: varchar("ckyc_provider", { length: 50 }),
  bankVerified: boolean("bank_verified").default(false),
  bankVerifiedAt: timestamp("bank_verified_at"),
  bankProvider: varchar("bank_provider", { length: 50 }),
  addressVerified: boolean("address_verified").default(false),
  addressVerifiedAt: timestamp("address_verified_at"),
  addressProvider: varchar("address_provider", { length: 50 }),
  fatcaDeclared: boolean("fatca_declared").default(false),
  fatcaDeclaredAt: timestamp("fatca_declared_at"),
  riskCategory: varchar("risk_category", { length: 20 }),
  riskScore: integer("risk_score"),
  riskAssessedAt: timestamp("risk_assessed_at"),
  kycLevel: varchar("kyc_level", { length: 20 }).default("NONE"),
  kycVersion: integer("kyc_version").default(1),
  overallStatus: varchar("overall_status", { length: 20 }).default("PENDING"),
  lastVerifiedAt: timestamp("last_verified_at"),
  expiresAt: timestamp("expires_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIdentityProfileSchema = createInsertSchema(identityProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type IdentityProfile = typeof identityProfiles.$inferSelect;
export type InsertIdentityProfile = z.infer<typeof insertIdentityProfileSchema>;

export const conversionFunnels = pgTable("conversion_funnels", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  sessionId: varchar("session_id", { length: 100 }),
  funnelType: varchar("funnel_type", { length: 50 }).notNull(),
  productType: varchar("product_type", { length: 50 }),
  currentStep: varchar("current_step", { length: 50 }).notNull(),
  stepSequence: integer("step_sequence").notNull(),
  enteredAt: timestamp("entered_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  droppedAt: timestamp("dropped_at"),
  dropReason: varchar("drop_reason", { length: 200 }),
  durationMs: integer("duration_ms"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConversionFunnelSchema = createInsertSchema(conversionFunnels).omit({ id: true, createdAt: true });
export type ConversionFunnel = typeof conversionFunnels.$inferSelect;
export type InsertConversionFunnel = z.infer<typeof insertConversionFunnelSchema>;

export const verificationCache = pgTable("verification_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verificationType: varchar("verification_type", { length: 50 }).notNull(),
  identifierHash: varchar("identifier_hash", { length: 64 }).notNull(),
  identifierMasked: varchar("identifier_masked", { length: 50 }),
  verified: boolean("verified").notNull(),
  verificationStatus: varchar("verification_status", { length: 50 }),
  registeredName: varchar("registered_name", { length: 500 }),
  nameMatchScore: integer("name_match_score"),
  additionalData: jsonb("additional_data").default({}),
  provider: varchar("provider", { length: 50 }).notNull(),
  providerReferenceId: varchar("provider_reference_id", { length: 100 }),
  verifiedAt: timestamp("verified_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  requestedBy: varchar("requested_by").references(() => users.id),
  requestContext: varchar("request_context", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vc_type_hash").on(table.verificationType, table.identifierHash),
  index("idx_vc_expires").on(table.expiresAt),
  index("idx_vc_provider").on(table.provider),
]);

export const insertVerificationCacheSchema = createInsertSchema(verificationCache).omit({ id: true, createdAt: true });
export type VerificationCache = typeof verificationCache.$inferSelect;
export type InsertVerificationCache = typeof verificationCache.$inferInsert;

export const insertConsentLogSchema = createInsertSchema(consentLogs).omit({ id: true, createdAt: true });
export type ConsentLog = typeof consentLogs.$inferSelect;
export type InsertConsentLog = z.infer<typeof insertConsentLogSchema>;


export const onboardingInvitations = pgTable("onboarding_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referralCode: varchar("referral_code").notNull().unique(),
  inviterId: varchar("inviter_id").notNull(),
  inviterType: varchar("inviter_type").notNull(), // 'agent' or 'partner'
  inviterName: varchar("inviter_name"),
  clientEmail: varchar("client_email"),
  clientMobile: varchar("client_mobile"),
  clientName: varchar("client_name"),
  suggestedEntityType: varchar("suggested_entity_type"), // individual, company, huf, etc.
  suggestedMode: varchar("suggested_mode"), // 'smart' or 'manual'
  status: varchar("status").notNull().default("pending"), // pending, sent, opened, started, in_progress, completed, expired
  currentStep: varchar("current_step"),
  completedSteps: jsonb("completed_steps").$type<string[]>().default([]),
  progressPercentage: integer("progress_percentage").default(0),
  onboardingSessionId: varchar("onboarding_session_id"),
  linkedUserId: varchar("linked_user_id").references(() => users.id),
  inviteSentAt: timestamp("invite_sent_at"),
  inviteOpenedAt: timestamp("invite_opened_at"),
  onboardingStartedAt: timestamp("onboarding_started_at"),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  lastActivityAt: timestamp("last_activity_at"),
  expiresAt: timestamp("expires_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_onboarding_invitations_referral_code").on(table.referralCode),
  index("idx_onboarding_invitations_inviter").on(table.inviterId, table.inviterType),
  index("idx_onboarding_invitations_status").on(table.status),
  index("idx_onboarding_invitations_client_email").on(table.clientEmail),
]);

export const onboardingInvitationEvents = pgTable("onboarding_invitation_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invitationId: varchar("invitation_id").references(() => onboardingInvitations.id).notNull(),
  eventType: varchar("event_type").notNull(), // created, sent, resent, opened, started, step_completed, completed, expired
  eventData: jsonb("event_data"),
  actorId: varchar("actor_id"),
  actorType: varchar("actor_type"), // system, agent, partner, client
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_invitation_events_invitation").on(table.invitationId),
  index("idx_invitation_events_type").on(table.eventType),
]);

export const insertOnboardingInvitationSchema = createInsertSchema(onboardingInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type OnboardingInvitation = typeof onboardingInvitations.$inferSelect;
export type InsertOnboardingInvitation = z.infer<typeof insertOnboardingInvitationSchema>;

export const insertOnboardingInvitationEventSchema = createInsertSchema(onboardingInvitationEvents).omit({
  id: true,
  timestamp: true,
});
export type OnboardingInvitationEvent = typeof onboardingInvitationEvents.$inferSelect;
export type InsertOnboardingInvitationEvent = z.infer<typeof insertOnboardingInvitationEventSchema>;


