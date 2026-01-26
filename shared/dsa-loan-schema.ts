import { pgTable, varchar, integer, boolean, timestamp, decimal, text, jsonb, date, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema";

export const dsaLoanStatusEnum = pgEnum("dsa_loan_status", [
  "draft",
  "submitted",
  "eligibility_check",
  "routed",
  "pending_with_banks",
  "in_review",
  "approved",
  "rejected",
  "disbursed",
  "withdrawn",
  "expired"
]);

export const routingStrategyEnum = pgEnum("routing_strategy", [
  "parallel",
  "waterfall",
  "priority_first"
]);

export const bankConnectorTypeEnum = pgEnum("bank_connector_type", [
  "api",
  "sftp",
  "portal",
  "email",
  "webhook"
]);

export const dsaLoanApplications = pgTable("dsa_loan_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationNumber: varchar("application_number").unique(),
  
  applicantType: varchar("applicant_type").notNull(),
  applicantName: varchar("applicant_name").notNull(),
  applicantEmail: varchar("applicant_email"),
  applicantPhone: varchar("applicant_phone").notNull(),
  applicantPan: varchar("applicant_pan"),
  applicantAadhaar: varchar("applicant_aadhaar"),
  dateOfBirth: date("date_of_birth"),
  gender: varchar("gender"),
  
  addressLine1: varchar("address_line_1"),
  addressLine2: varchar("address_line_2"),
  city: varchar("city"),
  state: varchar("state"),
  pincode: varchar("pincode"),
  
  employmentType: varchar("employment_type").notNull(),
  companyName: varchar("company_name"),
  designation: varchar("designation"),
  workExperience: integer("work_experience"),
  monthlyIncome: decimal("monthly_income", { precision: 15, scale: 2 }).notNull(),
  annualIncome: decimal("annual_income", { precision: 15, scale: 2 }),
  otherIncome: decimal("other_income", { precision: 15, scale: 2 }).default("0"),
  
  loanType: varchar("loan_type").notNull(),
  requestedAmount: decimal("requested_amount", { precision: 15, scale: 2 }).notNull(),
  requestedTenure: integer("requested_tenure").notNull(),
  loanPurpose: varchar("loan_purpose"),
  
  existingLoans: integer("existing_loans").default(0),
  existingEmiAmount: decimal("existing_emi_amount", { precision: 15, scale: 2 }).default("0"),
  
  creditScore: integer("credit_score"),
  creditBureauProvider: varchar("credit_bureau_provider"),
  creditReportDate: timestamp("credit_report_date"),
  
  status: dsaLoanStatusEnum("status").default("draft").notNull(),
  currentStage: varchar("current_stage").default("application"),
  
  routingStrategy: routingStrategyEnum("routing_strategy").default("parallel"),
  eligibleBanks: text("eligible_banks").array().default(sql`ARRAY[]::text[]`),
  routedBanks: text("routed_banks").array().default(sql`ARRAY[]::text[]`),
  routedAt: timestamp("routed_at"),
  
  consentTimestamp: timestamp("consent_timestamp"),
  consentIpAddress: varchar("consent_ip_address"),
  consentVersion: varchar("consent_version"),
  disclosureAccepted: boolean("disclosure_accepted").default(false),
  
  dsaCode: varchar("dsa_code"),
  agentId: varchar("agent_id").references(() => users.id),
  subDsaCode: varchar("sub_dsa_code"),
  
  userId: varchar("user_id").references(() => users.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  submittedAt: timestamp("submitted_at"),
  expiresAt: timestamp("expires_at"),
});

export const bankConnectors = pgTable("bank_connectors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankCode: varchar("bank_code").notNull().unique(),
  bankName: varchar("bank_name").notNull(),
  
  connectorType: bankConnectorTypeEnum("connector_type").notNull(),
  apiEndpoint: varchar("api_endpoint"),
  sftpHost: varchar("sftp_host"),
  sftpPort: integer("sftp_port"),
  sftpPath: varchar("sftp_path"),
  portalUrl: varchar("portal_url"),
  
  authType: varchar("auth_type"),
  credentialsRef: varchar("credentials_ref"),
  
  priority: integer("priority").default(50),
  isActive: boolean("is_active").default(true),
  
  supportedLoanTypes: text("supported_loan_types").array().default(sql`ARRAY[]::text[]`),
  minAmount: decimal("min_amount", { precision: 15, scale: 2 }),
  maxAmount: decimal("max_amount", { precision: 15, scale: 2 }),
  minTenure: integer("min_tenure"),
  maxTenure: integer("max_tenure"),
  
  expectedResponseTime: integer("expected_response_time"),
  autoEscalateAfter: integer("auto_escalate_after"),
  
  interestRateMin: decimal("interest_rate_min", { precision: 5, scale: 2 }),
  interestRateMax: decimal("interest_rate_max", { precision: 5, scale: 2 }),
  processingFeePercent: decimal("processing_fee_percent", { precision: 5, scale: 2 }),
  
  lastSyncAt: timestamp("last_sync_at"),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  avgResponseTime: integer("avg_response_time"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanEligibilityRules = pgTable("loan_eligibility_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankCode: varchar("bank_code").references(() => bankConnectors.bankCode).notNull(),
  loanType: varchar("loan_type").notNull(),
  ruleName: varchar("rule_name").notNull(),
  
  minCreditScore: integer("min_credit_score"),
  maxCreditScore: integer("max_credit_score"),
  minMonthlyIncome: decimal("min_monthly_income", { precision: 15, scale: 2 }),
  minAnnualIncome: decimal("min_annual_income", { precision: 15, scale: 2 }),
  minAge: integer("min_age"),
  maxAge: integer("max_age"),
  minWorkExperience: integer("min_work_experience"),
  
  allowedEmploymentTypes: text("allowed_employment_types").array().default(sql`ARRAY[]::text[]`),
  excludedEmploymentTypes: text("excluded_employment_types").array().default(sql`ARRAY[]::text[]`),
  
  allowedStates: text("allowed_states").array().default(sql`ARRAY[]::text[]`),
  excludedPincodes: text("excluded_pincodes").array().default(sql`ARRAY[]::text[]`),
  
  maxFoir: decimal("max_foir", { precision: 5, scale: 2 }),
  
  priority: integer("priority").default(50),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanRoutingHistory = pgTable("loan_routing_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => dsaLoanApplications.id).notNull(),
  bankCode: varchar("bank_code").references(() => bankConnectors.bankCode).notNull(),
  
  routingStrategy: varchar("routing_strategy"),
  routingPriority: integer("routing_priority"),
  
  submittedAt: timestamp("submitted_at").defaultNow(),
  submissionMethod: varchar("submission_method"),
  submissionReference: varchar("submission_reference"),
  payloadHash: varchar("payload_hash"),
  
  bankStatus: varchar("bank_status").default("pending"),
  bankReference: varchar("bank_reference"),
  responseReceivedAt: timestamp("response_received_at"),
  
  approvedAmount: decimal("approved_amount", { precision: 15, scale: 2 }),
  approvedTenure: integer("approved_tenure"),
  offeredInterestRate: decimal("offered_interest_rate", { precision: 5, scale: 2 }),
  processingFee: decimal("processing_fee", { precision: 15, scale: 2 }),
  
  rejectionReason: varchar("rejection_reason"),
  queryDetails: text("query_details"),
  queryResponseDeadline: timestamp("query_response_deadline"),
  
  sanctionLetterUrl: varchar("sanction_letter_url"),
  disbursedAmount: decimal("disbursed_amount", { precision: 15, scale: 2 }),
  disbursedAt: timestamp("disbursed_at"),
  disbursementReference: varchar("disbursement_reference"),
  
  slaBreached: boolean("sla_breached").default(false),
  escalatedAt: timestamp("escalated_at"),
  
  retryCount: integer("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at"),
  lastError: text("last_error"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dsaLoanDocuments = pgTable("dsa_loan_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => dsaLoanApplications.id).notNull(),
  
  documentType: varchar("document_type").notNull(),
  documentName: varchar("document_name").notNull(),
  fileName: varchar("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  
  storageUrl: varchar("storage_url").notNull(),
  encryptionKey: varchar("encryption_key"),
  
  isVerified: boolean("is_verified").default(false),
  verifiedBy: varchar("verified_by"),
  verifiedAt: timestamp("verified_at"),
  verificationMethod: varchar("verification_method"),
  
  extractedData: jsonb("extracted_data"),
  
  status: varchar("status").default("pending"),
  rejectionReason: varchar("rejection_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dsaLoanAuditLogs = pgTable("dsa_loan_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => dsaLoanApplications.id),
  
  action: varchar("action").notNull(),
  actionCategory: varchar("action_category").notNull(),
  
  actorId: varchar("actor_id"),
  actorType: varchar("actor_type"),
  actorName: varchar("actor_name"),
  actorEmail: varchar("actor_email"),
  
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  changedFields: text("changed_fields").array().default(sql`ARRAY[]::text[]`),
  
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  sessionId: varchar("session_id"),
  requestId: varchar("request_id"),
  
  bankCode: varchar("bank_code"),
  notes: text("notes"),
  
  retentionDate: timestamp("retention_date"),
  isArchived: boolean("is_archived").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const dsaCommissionTracking = pgTable("dsa_commission_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => dsaLoanApplications.id).notNull(),
  bankCode: varchar("bank_code").references(() => bankConnectors.bankCode).notNull(),
  
  dsaCode: varchar("dsa_code").notNull(),
  subDsaCode: varchar("sub_dsa_code"),
  agentId: varchar("agent_id").references(() => users.id),
  
  disbursedAmount: decimal("disbursed_amount", { precision: 15, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }),
  commissionAmount: decimal("commission_amount", { precision: 15, scale: 2 }).notNull(),
  
  platformShare: decimal("platform_share", { precision: 15, scale: 2 }),
  dsaShare: decimal("dsa_share", { precision: 15, scale: 2 }),
  subDsaShare: decimal("sub_dsa_share", { precision: 15, scale: 2 }),
  
  paymentStatus: varchar("payment_status").default("pending"),
  paymentReference: varchar("payment_reference"),
  paidAt: timestamp("paid_at"),
  
  gstAmount: decimal("gst_amount", { precision: 15, scale: 2 }),
  invoiceNumber: varchar("invoice_number"),
  invoiceUrl: varchar("invoice_url"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanWebhookEvents = pgTable("loan_webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankCode: varchar("bank_code").references(() => bankConnectors.bankCode).notNull(),
  
  eventType: varchar("event_type").notNull(),
  externalReference: varchar("external_reference"),
  
  rawPayload: jsonb("raw_payload"),
  signature: varchar("signature"),
  isSignatureValid: boolean("is_signature_valid"),
  
  processedAt: timestamp("processed_at"),
  processingStatus: varchar("processing_status").default("pending"),
  processingError: text("processing_error"),
  
  applicationId: varchar("application_id").references(() => dsaLoanApplications.id),
  routingHistoryId: varchar("routing_history_id").references(() => loanRoutingHistory.id),
  
  receivedAt: timestamp("received_at").defaultNow(),
});

export const insertDsaLoanApplicationSchema = createInsertSchema(dsaLoanApplications).omit({
  id: true,
  applicationNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBankConnectorSchema = createInsertSchema(bankConnectors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanEligibilityRuleSchema = createInsertSchema(loanEligibilityRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanRoutingHistorySchema = createInsertSchema(loanRoutingHistory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDsaLoanDocumentSchema = createInsertSchema(dsaLoanDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDsaLoanAuditLogSchema = createInsertSchema(dsaLoanAuditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertDsaCommissionTrackingSchema = createInsertSchema(dsaCommissionTracking).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanWebhookEventSchema = createInsertSchema(loanWebhookEvents).omit({
  id: true,
  receivedAt: true,
});

export type DsaLoanApplication = typeof dsaLoanApplications.$inferSelect;
export type InsertDsaLoanApplication = z.infer<typeof insertDsaLoanApplicationSchema>;
export type BankConnector = typeof bankConnectors.$inferSelect;
export type InsertBankConnector = z.infer<typeof insertBankConnectorSchema>;
export type LoanEligibilityRule = typeof loanEligibilityRules.$inferSelect;
export type InsertLoanEligibilityRule = z.infer<typeof insertLoanEligibilityRuleSchema>;
export type LoanRoutingHistory = typeof loanRoutingHistory.$inferSelect;
export type InsertLoanRoutingHistory = z.infer<typeof insertLoanRoutingHistorySchema>;
export type DsaLoanDocument = typeof dsaLoanDocuments.$inferSelect;
export type InsertDsaLoanDocument = z.infer<typeof insertDsaLoanDocumentSchema>;
export type DsaLoanAuditLog = typeof dsaLoanAuditLogs.$inferSelect;
export type InsertDsaLoanAuditLog = z.infer<typeof insertDsaLoanAuditLogSchema>;
export type DsaCommissionTracking = typeof dsaCommissionTracking.$inferSelect;
export type InsertDsaCommissionTracking = z.infer<typeof insertDsaCommissionTrackingSchema>;
export type LoanWebhookEvent = typeof loanWebhookEvents.$inferSelect;
export type InsertLoanWebhookEvent = z.infer<typeof insertLoanWebhookEventSchema>;

// Bank Credentials Vault - encrypted storage for bank API credentials
export const bankCredentialsVault = pgTable("bank_credentials_vault", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankCode: varchar("bank_code").notNull().references(() => bankConnectors.bankCode),
  credentialType: varchar("credential_type").notNull(), // api_key, client_secret, certificate, etc.
  encryptedValue: text("encrypted_value").notNull(), // AES-256-GCM encrypted
  environment: varchar("environment").notNull().default("sandbox"), // sandbox, uat, production
  keyVersion: integer("key_version").notNull().default(1), // For key rotation
  metadata: jsonb("metadata").$type<{
    description?: string;
    expiresAt?: string;
    rotationDue?: string;
    lastRotated?: string;
  }>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
});

// Bank OAuth Tokens - for banks using OAuth 2.0 authentication
export const bankOAuthTokens = pgTable("bank_oauth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankCode: varchar("bank_code").notNull().references(() => bankConnectors.bankCode),
  environment: varchar("environment").notNull().default("sandbox"),
  accessToken: text("access_token").notNull(), // Encrypted
  refreshToken: text("refresh_token"), // Encrypted
  tokenType: varchar("token_type").default("Bearer"),
  scope: text("scope"),
  expiresAt: timestamp("expires_at").notNull(),
  refreshExpiresAt: timestamp("refresh_expires_at"),
  issuedAt: timestamp("issued_at").notNull(),
  lastUsed: timestamp("last_used"),
  refreshCount: integer("refresh_count").default(0),
  status: varchar("status").default("active"), // active, expired, revoked
  metadata: jsonb("metadata").$type<{
    clientId?: string;
    grantType?: string;
    lastRefreshError?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Bank API Audit Log - for tracking all bank API interactions
export const bankApiAuditLogs = pgTable("bank_api_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankCode: varchar("bank_code").notNull(),
  environment: varchar("environment").notNull(),
  operation: varchar("operation").notNull(), // submit_application, check_status, refresh_token, etc.
  requestId: varchar("request_id").notNull(),
  endpoint: varchar("endpoint"),
  httpMethod: varchar("http_method"),
  requestPayloadHash: varchar("request_payload_hash"), // SHA-256 hash for audit
  responseStatus: integer("response_status"),
  responseTime: integer("response_time"), // milliseconds
  success: boolean("success").notNull(),
  errorCode: varchar("error_code"),
  errorMessage: text("error_message"),
  userId: varchar("user_id"),
  applicationId: varchar("application_id"),
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBankCredentialsVaultSchema = createInsertSchema(bankCredentialsVault).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBankOAuthTokensSchema = createInsertSchema(bankOAuthTokens).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBankApiAuditLogSchema = createInsertSchema(bankApiAuditLogs).omit({ id: true, createdAt: true });

export type BankCredentialsVault = typeof bankCredentialsVault.$inferSelect;
export type InsertBankCredentialsVault = z.infer<typeof insertBankCredentialsVaultSchema>;
export type BankOAuthToken = typeof bankOAuthTokens.$inferSelect;
export type InsertBankOAuthToken = z.infer<typeof insertBankOAuthTokensSchema>;
export type BankApiAuditLog = typeof bankApiAuditLogs.$inferSelect;
export type InsertBankApiAuditLog = z.infer<typeof insertBankApiAuditLogSchema>;
