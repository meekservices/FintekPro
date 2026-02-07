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

export const clientModeEnum = pgEnum("client_mode", [
  "new",
  "existing"
]);

export const routingModeEnum = pgEnum("routing_mode", [
  "auto",
  "manual"
]);

export const documentUploaderEnum = pgEnum("document_uploader", [
  "agent",
  "client",
  "system"
]);

export const payoutClaimStatusEnum = pgEnum("payout_claim_status", [
  "pending",
  "under_review",
  "approved",
  "rejected",
  "paid"
]);

// ============== DEVELOPER / PROJECT FINANCE ENUMS ==============

export const loanVerticalEnum = pgEnum("loan_vertical", [
  "RETAIL",
  "MSME",
  "DEVELOPER"
]);

export const loanSubTypeEnum = pgEnum("loan_sub_type", [
  "BUILDER_FUNDING",
  "PROJECT_FUNDING",
  "CONSTRUCTION_FINANCE",
  "LRD",
  "LAND_FINANCE",
  "INVENTORY_FINANCE",
  "MEZZANINE",
  "BRIDGE"
]);

export const projectStageEnum = pgEnum("project_stage", [
  "LAND_ACQUISITION",
  "APPROVALS",
  "CONSTRUCTION_EARLY",
  "CONSTRUCTION_MID",
  "CONSTRUCTION_ADVANCED",
  "NEAR_COMPLETION",
  "COMPLETED",
  "POSSESSION"
]);

export const tranchStatusEnum = pgEnum("tranch_status", [
  "PENDING",
  "RELEASED",
  "ON_HOLD",
  "CANCELLED"
]);

export const approvalStatusEnum = pgEnum("dev_approval_status", [
  "OBTAINED",
  "APPLIED",
  "PENDING",
  "NOT_REQUIRED",
  "REJECTED"
]);

export const encumbranceStatusEnum = pgEnum("encumbrance_status", [
  "CLEAR",
  "ENCUMBERED",
  "PARTIALLY_CLEAR",
  "UNDER_VERIFICATION"
]);

export const titleStatusEnum = pgEnum("title_status", [
  "CLEAR",
  "DISPUTED",
  "UNDER_LITIGATION",
  "UNDER_VERIFICATION"
]);

// ============== SUB-DSA GOVERNANCE ENUMS ==============

export const originationModeEnum = pgEnum("origination_mode", [
  "SELF_SERVICE",
  "AGENT_ASSISTED"
]);

export const routingIntentEnum = pgEnum("routing_intent", [
  "MARKETPLACE",
  "SPECIFIC_BANKS"
]);

export const workflowOwnerEnum = pgEnum("workflow_owner", [
  "SYSTEM",
  "AGENT"
]);

export const bankInteractionEventTypeEnum = pgEnum("bank_interaction_event_type", [
  "RECEIVED",
  "QUERY",
  "APPROVED",
  "DISBURSED"
]);

export const bankInteractionReporterEnum = pgEnum("bank_interaction_reporter", [
  "AGENT",
  "WEBHOOK",
  "ADMIN"
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
  loanVertical: loanVerticalEnum("loan_vertical").default("RETAIL"),
  loanSubType: loanSubTypeEnum("loan_sub_type"),
  developerProjectId: varchar("developer_project_id"),
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
  
  // Agent-Assisted Loan Origination fields
  assistedByAgent: boolean("assisted_by_agent").default(false),
  clientMode: clientModeEnum("client_mode").default("new"),
  clientId: varchar("client_id").references(() => users.id),
  
  // Manual bank routing support
  targetBanks: text("target_banks").array().default(sql`ARRAY[]::text[]`),
  routingMode: routingModeEnum("routing_mode").default("auto"),
  
  // Status update remarks (for agent status updates)
  statusRemarks: text("status_remarks"),
  lastStatusUpdateBy: varchar("last_status_update_by").references(() => users.id),
  lastStatusUpdateAt: timestamp("last_status_update_at"),
  
  // Disbursement details (for payout claims)
  actualDisbursedAmount: decimal("actual_disbursed_amount", { precision: 15, scale: 2 }),
  actualDisbursementDate: date("actual_disbursement_date"),
  disbursementProofUrl: varchar("disbursement_proof_url"),
  bankConfirmationNumber: varchar("bank_confirmation_number"),
  
  // ============== SUB-DSA GOVERNANCE FIELDS ==============
  // Origination mode determines how the loan was initiated
  originationMode: originationModeEnum("origination_mode").default("SELF_SERVICE").notNull(),
  // Routing intent determines auto vs manual bank routing
  routingIntent: routingIntentEnum("routing_intent").default("MARKETPLACE").notNull(),
  // Workflow owner determines SLA accountability
  workflowOwner: workflowOwnerEnum("workflow_owner").default("SYSTEM").notNull(),
  // Lender disclaimer acceptance timestamp (required before first bank submission)
  lenderDisclaimerAt: timestamp("lender_disclaimer_at"),
  // Commission policy version for audit trail
  commissionPolicyVersion: varchar("commission_policy_version").default("v1"),
  
  // ============== SLA TRACKING FIELDS ==============
  slaStartAt: timestamp("sla_start_at"),
  slaExpectedBy: timestamp("sla_expected_by"),
  slaBreachedAt: timestamp("sla_breached_at"),
  
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
  routingMode: routingModeEnum("routing_mode").default("auto"),
  
  submittedAt: timestamp("submitted_at").defaultNow(),
  submissionMethod: varchar("submission_method"),
  submittedByAgentId: varchar("submitted_by_agent_id").references(() => users.id),
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
  
  // Agent-Assisted fields
  uploadedBy: documentUploaderEnum("uploaded_by").default("client"),
  uploadedById: varchar("uploaded_by_id").references(() => users.id),
  visibleToBank: boolean("visible_to_bank").default(true),
  bankVisibilityChangedBy: varchar("bank_visibility_changed_by").references(() => users.id),
  bankVisibilityChangedAt: timestamp("bank_visibility_changed_at"),
  
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

// ============== SUB-DSA BANK INTERACTION EVENTS ==============
// Mandatory for Sub-DSA audit readiness - tracks all bank interactions
export const bankInteractionEvents = pgTable("bank_interaction_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Loan reference
  loanId: varchar("loan_id").references(() => dsaLoanApplications.id).notNull(),
  
  // Bank and event details
  bankCode: varchar("bank_code").notNull(),
  eventType: bankInteractionEventTypeEnum("event_type").notNull(),
  
  // Who reported this event
  reportedBy: bankInteractionReporterEnum("reported_by").notNull(),
  reportedById: varchar("reported_by_id").references(() => users.id),
  
  // Reference and remarks
  referenceId: varchar("reference_id"),
  remarks: text("remarks"),
  
  // Additional metadata
  metadata: jsonb("metadata").$type<{
    approvedAmount?: string;
    disbursedAmount?: string;
    interestRate?: string;
    queryDetails?: string;
    responseDeadline?: string;
  }>(),
  
  // Immutable timestamp
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBankInteractionEventSchema = createInsertSchema(bankInteractionEvents).omit({
  id: true,
  createdAt: true,
});

export type BankInteractionEvent = typeof bankInteractionEvents.$inferSelect;
export type InsertBankInteractionEvent = z.infer<typeof insertBankInteractionEventSchema>;

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

// ============== AGENT-ASSISTED LOAN ORIGINATION TABLES ==============

// Agent Loan Actions - Dedicated audit log for all agent actions on loans
export const agentLoanActions = pgTable("agent_loan_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => dsaLoanApplications.id).notNull(),
  
  // Agent performing the action
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  agentName: varchar("agent_name"),
  agentEmail: varchar("agent_email"),
  
  // Action details
  actionType: varchar("action_type").notNull(), // create, update, submit, route, status_update, document_upload, disbursement_record, payout_claim
  actionDescription: text("action_description"),
  
  // State changes
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  affectedFields: text("affected_fields").array().default(sql`ARRAY[]::text[]`),
  
  // Context
  bankCode: varchar("bank_code"),
  documentId: varchar("document_id"),
  remarks: text("remarks"),
  
  // Audit metadata
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  sessionId: varchar("session_id"),
  
  // Immutable timestamp
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Agent Payout Claims - Track agent commission claims after disbursement
export const agentPayoutClaims = pgTable("agent_payout_claims", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  claimNumber: varchar("claim_number").unique(),
  
  // Loan reference
  applicationId: varchar("application_id").references(() => dsaLoanApplications.id).notNull(),
  routingHistoryId: varchar("routing_history_id").references(() => loanRoutingHistory.id),
  commissionTrackingId: varchar("commission_tracking_id").references(() => dsaCommissionTracking.id),
  
  // Agent making the claim
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  
  // Claim amounts
  claimedAmount: decimal("claimed_amount", { precision: 15, scale: 2 }).notNull(),
  approvedAmount: decimal("approved_amount", { precision: 15, scale: 2 }),
  
  // Disbursement proof (required for claim)
  disbursedAmount: decimal("disbursed_amount", { precision: 15, scale: 2 }).notNull(),
  disbursementDate: date("disbursement_date").notNull(),
  bankConfirmationNumber: varchar("bank_confirmation_number"),
  disbursementProofUrl: varchar("disbursement_proof_url"),
  
  // Claim status
  status: payoutClaimStatusEnum("status").default("pending").notNull(),
  
  // Admin review
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewRemarks: text("review_remarks"),
  rejectionReason: text("rejection_reason"),
  
  // Payment details (after approval)
  paymentReference: varchar("payment_reference"),
  paymentDate: date("payment_date"),
  paymentMode: varchar("payment_mode"), // bank_transfer, upi, cheque
  
  // Zoho Books integration
  zohoInvoiceId: varchar("zoho_invoice_id"),
  zohoPaymentId: varchar("zoho_payment_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agent Loan Status History - Track all status changes with remarks
export const agentLoanStatusHistory = pgTable("agent_loan_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => dsaLoanApplications.id).notNull(),
  
  // Status transition
  previousStatus: varchar("previous_status"),
  newStatus: varchar("new_status").notNull(),
  
  // Who made the change
  changedBy: varchar("changed_by").references(() => users.id).notNull(),
  changedByType: varchar("changed_by_type").notNull(), // agent, admin, system, bank_webhook
  
  // Required remarks
  remarks: text("remarks").notNull(),
  
  // Bank feedback (for bank-initiated status changes)
  bankCode: varchar("bank_code"),
  bankReference: varchar("bank_reference"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertAgentLoanActionSchema = createInsertSchema(agentLoanActions).omit({ id: true, createdAt: true });
export const insertAgentPayoutClaimSchema = createInsertSchema(agentPayoutClaims).omit({ id: true, claimNumber: true, createdAt: true, updatedAt: true });
export const insertAgentLoanStatusHistorySchema = createInsertSchema(agentLoanStatusHistory).omit({ id: true, createdAt: true });

// Types
export type AgentLoanAction = typeof agentLoanActions.$inferSelect;
export type InsertAgentLoanAction = z.infer<typeof insertAgentLoanActionSchema>;
export type AgentPayoutClaim = typeof agentPayoutClaims.$inferSelect;
export type InsertAgentPayoutClaim = z.infer<typeof insertAgentPayoutClaimSchema>;
export type AgentLoanStatusHistory = typeof agentLoanStatusHistory.$inferSelect;
export type InsertAgentLoanStatusHistory = z.infer<typeof insertAgentLoanStatusHistorySchema>;

// ============== DEVELOPER / PROJECT FINANCE TABLES ==============

export const developerProjects = pgTable("developer_projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => users.id),
  developerName: varchar("developer_name").notNull(),
  developerCin: varchar("developer_cin"),
  developerPan: varchar("developer_pan"),
  promoterName: varchar("promoter_name"),
  promoterDin: varchar("promoter_din"),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  projectName: varchar("project_name").notNull(),
  reraNumber: varchar("rera_number"),
  reraState: varchar("rera_state"),
  projectCity: varchar("project_city"),
  projectState: varchar("project_state"),
  projectAddress: text("project_address"),
  projectStage: projectStageEnum("project_stage").default("LAND_ACQUISITION"),
  projectType: varchar("project_type"),
  totalUnits: integer("total_units"),
  unitsSold: integer("units_sold").default(0),
  totalSalableArea: decimal("total_salable_area", { precision: 15, scale: 2 }),
  totalProjectCost: decimal("total_project_cost", { precision: 18, scale: 2 }),
  totalProjectRevenue: decimal("total_project_revenue", { precision: 18, scale: 2 }),
  expectedCompletionDate: date("expected_completion_date"),
  projectTenureMonths: integer("project_tenure_months"),
  landCost: decimal("land_cost", { precision: 18, scale: 2 }),
  constructionCost: decimal("construction_cost", { precision: 18, scale: 2 }),
  approvalCost: decimal("approval_cost", { precision: 15, scale: 2 }),
  marketingCost: decimal("marketing_cost", { precision: 15, scale: 2 }),
  financeCost: decimal("finance_cost", { precision: 15, scale: 2 }),
  contingencyCost: decimal("contingency_cost", { precision: 15, scale: 2 }),
  status: varchar("status").default("active"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectLandDetails = pgTable("project_land_details", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => developerProjects.id).notNull(),
  surveyNumber: varchar("survey_number"),
  plotNumber: varchar("plot_number"),
  totalLandArea: decimal("total_land_area", { precision: 15, scale: 2 }),
  landAreaUnit: varchar("land_area_unit").default("sqft"),
  landUseZone: varchar("land_use_zone"),
  encumbranceStatus: encumbranceStatusEnum("encumbrance_status").default("UNDER_VERIFICATION"),
  encumbranceCertificateUrl: varchar("encumbrance_certificate_url"),
  titleStatus: titleStatusEnum("title_status").default("UNDER_VERIFICATION"),
  titleReportUrl: varchar("title_report_url"),
  titleReportDate: date("title_report_date"),
  landOwnership: varchar("land_ownership"),
  registrationNumber: varchar("registration_number"),
  registrationDate: date("registration_date"),
  marketValue: decimal("market_value", { precision: 18, scale: 2 }),
  guidanceValue: decimal("guidance_value", { precision: 18, scale: 2 }),
  purchaseValue: decimal("purchase_value", { precision: 18, scale: 2 }),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectApprovals = pgTable("project_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => developerProjects.id).notNull(),
  approvalType: varchar("approval_type").notNull(),
  approvalAuthority: varchar("approval_authority"),
  approvalNumber: varchar("approval_number"),
  approvalDate: date("approval_date"),
  expiryDate: date("expiry_date"),
  status: approvalStatusEnum("status").default("PENDING"),
  documentUrl: varchar("document_url"),
  isMandatory: boolean("is_mandatory").default(false),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectCashflows = pgTable("project_cashflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => developerProjects.id).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  label: varchar("label"),
  inflowSales: decimal("inflow_sales", { precision: 18, scale: 2 }).default("0"),
  inflowDisbursement: decimal("inflow_disbursement", { precision: 18, scale: 2 }).default("0"),
  inflowOther: decimal("inflow_other", { precision: 18, scale: 2 }).default("0"),
  outflowConstruction: decimal("outflow_construction", { precision: 18, scale: 2 }).default("0"),
  outflowLand: decimal("outflow_land", { precision: 18, scale: 2 }).default("0"),
  outflowInterest: decimal("outflow_interest", { precision: 18, scale: 2 }).default("0"),
  outflowAdmin: decimal("outflow_admin", { precision: 18, scale: 2 }).default("0"),
  outflowOther: decimal("outflow_other", { precision: 18, scale: 2 }).default("0"),
  netCashflow: decimal("net_cashflow", { precision: 18, scale: 2 }).default("0"),
  cumulativeCashflow: decimal("cumulative_cashflow", { precision: 18, scale: 2 }).default("0"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const developerFinancials = pgTable("developer_financials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => developerProjects.id).notNull(),
  financialYear: varchar("financial_year").notNull(),
  revenue: decimal("revenue", { precision: 18, scale: 2 }),
  patProfit: decimal("pat_profit", { precision: 18, scale: 2 }),
  netWorth: decimal("net_worth", { precision: 18, scale: 2 }),
  totalDebt: decimal("total_debt", { precision: 18, scale: 2 }),
  totalAssets: decimal("total_assets", { precision: 18, scale: 2 }),
  currentRatio: decimal("current_ratio", { precision: 8, scale: 2 }),
  debtEquityRatio: decimal("debt_equity_ratio", { precision: 8, scale: 2 }),
  dscr: decimal("dscr", { precision: 8, scale: 2 }),
  interestCoverage: decimal("interest_coverage", { precision: 8, scale: 2 }),
  promoterContribution: decimal("promoter_contribution", { precision: 18, scale: 2 }),
  promoterContributionPercent: decimal("promoter_contribution_percent", { precision: 5, scale: 2 }),
  escrowBalance: decimal("escrow_balance", { precision: 18, scale: 2 }),
  cashAndEquivalents: decimal("cash_and_equivalents", { precision: 18, scale: 2 }),
  operatingCashflow: decimal("operating_cashflow", { precision: 18, scale: 2 }),
  auditedBy: varchar("audited_by"),
  auditReportUrl: varchar("audit_report_url"),
  itrFilingDate: date("itr_filing_date"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanDisbursementTranches = pgTable("loan_disbursement_tranches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => dsaLoanApplications.id).notNull(),
  projectId: varchar("project_id").references(() => developerProjects.id),
  trancheNumber: integer("tranche_number").notNull(),
  milestoneName: varchar("milestone_name").notNull(),
  milestoneDescription: text("milestone_description"),
  expectedCompletionPercent: decimal("expected_completion_percent", { precision: 5, scale: 2 }),
  trancheAmount: decimal("tranche_amount", { precision: 18, scale: 2 }).notNull(),
  tranchePercent: decimal("tranche_percent", { precision: 5, scale: 2 }),
  status: tranchStatusEnum("status").default("PENDING"),
  releaseDate: date("release_date"),
  releasedAmount: decimal("released_amount", { precision: 18, scale: 2 }),
  releasedBy: varchar("released_by"),
  holdReason: text("hold_reason"),
  engineerCertificateUrl: varchar("engineer_certificate_url"),
  caCertificateUrl: varchar("ca_certificate_url"),
  photographUrl: varchar("photograph_url"),
  bankReference: varchar("bank_reference"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const bankProductAppetite = pgTable("bank_product_appetite", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankCode: varchar("bank_code").references(() => bankConnectors.bankCode).notNull(),
  loanSubType: loanSubTypeEnum("loan_sub_type").notNull(),
  isActive: boolean("is_active").default(true),
  minTicketSize: decimal("min_ticket_size", { precision: 18, scale: 2 }),
  maxTicketSize: decimal("max_ticket_size", { precision: 18, scale: 2 }),
  minDscr: decimal("min_dscr", { precision: 8, scale: 2 }),
  maxLtv: decimal("max_ltv", { precision: 5, scale: 2 }),
  maxLtc: decimal("max_ltc", { precision: 5, scale: 2 }),
  minPromoterContribution: decimal("min_promoter_contribution", { precision: 5, scale: 2 }),
  requiredEscrow: boolean("required_escrow").default(true),
  allowedProjectStages: text("allowed_project_stages").array().default(sql`ARRAY[]::text[]`),
  allowedCities: text("allowed_cities").array().default(sql`ARRAY[]::text[]`),
  allowedStates: text("allowed_states").array().default(sql`ARRAY[]::text[]`),
  interestRateMin: decimal("interest_rate_min", { precision: 5, scale: 2 }),
  interestRateMax: decimal("interest_rate_max", { precision: 5, scale: 2 }),
  maxTenureMonths: integer("max_tenure_months"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============== DEVELOPER FINANCE INSERT SCHEMAS ==============

export const insertDeveloperProjectSchema = createInsertSchema(developerProjects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectLandDetailsSchema = createInsertSchema(projectLandDetails).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectApprovalsSchema = createInsertSchema(projectApprovals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectCashflowsSchema = createInsertSchema(projectCashflows).omit({ id: true, createdAt: true });
export const insertDeveloperFinancialsSchema = createInsertSchema(developerFinancials).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLoanDisbursementTrancheSchema = createInsertSchema(loanDisbursementTranches).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBankProductAppetiteSchema = createInsertSchema(bankProductAppetite).omit({ id: true, createdAt: true, updatedAt: true });

// ============== DEVELOPER FINANCE TYPES ==============

export type DeveloperProject = typeof developerProjects.$inferSelect;
export type InsertDeveloperProject = z.infer<typeof insertDeveloperProjectSchema>;
export type ProjectLandDetail = typeof projectLandDetails.$inferSelect;
export type InsertProjectLandDetail = z.infer<typeof insertProjectLandDetailsSchema>;
export type ProjectApproval = typeof projectApprovals.$inferSelect;
export type InsertProjectApproval = z.infer<typeof insertProjectApprovalsSchema>;
export type ProjectCashflow = typeof projectCashflows.$inferSelect;
export type InsertProjectCashflow = z.infer<typeof insertProjectCashflowsSchema>;
export type DeveloperFinancial = typeof developerFinancials.$inferSelect;
export type InsertDeveloperFinancial = z.infer<typeof insertDeveloperFinancialsSchema>;
export type LoanDisbursementTranche = typeof loanDisbursementTranches.$inferSelect;
export type InsertLoanDisbursementTranche = z.infer<typeof insertLoanDisbursementTrancheSchema>;
export type BankProductAppetite = typeof bankProductAppetite.$inferSelect;
export type InsertBankProductAppetite = z.infer<typeof insertBankProductAppetiteSchema>;
