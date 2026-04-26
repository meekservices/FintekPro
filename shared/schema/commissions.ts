import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean, index, integer, date, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { 
  payoutModeEnum, 
  passthroughRuleEnum, 
  commissionPlanStatusEnum, 
  payoutClaimStatusEnum, 
  pddStatusEnum,
  masterDsaClaimStatusEnum
} from './enums';

// Import tables for references
import { users } from './users';
import { loanApplications, loanLeads, loanCommissionLedger } from './loans';
import { partners } from './partners';
import { agents } from './agents';

// Referral Payout Transactions - Track individual payouts
export const referralPayoutTransactions = pgTable("referral_payout_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  commissionLedgerId: varchar("commission_ledger_id").references(() => loanCommissionLedger.id).notNull(),
  payoutConfigId: varchar("payout_config_id").references(() => referralPayoutConfig.id),
  
  // Beneficiary
  beneficiaryType: varchar("beneficiary_type").notNull(), // agent, partner, manager_l1, manager_l2, manager_l3
  beneficiaryId: varchar("beneficiary_id").notNull(),
  beneficiaryName: varchar("beneficiary_name"),
  
  // Payout Details
  payoutAmount: decimal("payout_amount", { precision: 12, scale: 2 }).notNull(),
  payoutRate: decimal("payout_rate", { precision: 5, scale: 2 }),
  
  // Tax Deductions
  tdsRate: decimal("tds_rate", { precision: 5, scale: 2 }).default("5.00"),
  tdsAmount: decimal("tds_amount", { precision: 12, scale: 2 }).default("0"),
  netPayoutAmount: decimal("net_payout_amount", { precision: 12, scale: 2 }).notNull(),
  
  // Status
  status: varchar("status").notNull().default("pending"), // pending, approved, processing, paid, failed, cancelled
  
  // Payment Details
  bankAccountId: varchar("bank_account_id"),
  paymentMode: varchar("payment_mode"), // neft, rtgs, upi, wallet
  paymentReference: varchar("payment_reference"),
  paymentDate: timestamp("payment_date"),
  paymentRemarks: text("payment_remarks"),
  
  // For Failed Payments
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").default(0),
  
  // Zoho Books Integration
  zohoExpenseId: varchar("zoho_expense_id"),
  zohoBillId: varchar("zoho_bill_id"),
  zohoSyncStatus: varchar("zoho_sync_status").default("pending"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Referral payout configuration table
export const referralPayoutConfig = pgTable("referral_payout_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configLevel: varchar("config_level").notNull(), // 'platform' | 'product' | 'user'
  productType: varchar("product_type"),
  payoutRate: decimal("payout_rate", { precision: 5, scale: 4 }),
  payoutType: varchar("payout_type").default("percentage"), // 'percentage' | 'fixed'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Commission Payments - Track payments from Bank/Master DSA for reconciliation
export const commissionPayments = pgTable("commission_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Reference to Commission Ledger
  commissionLedgerId: varchar("commission_ledger_id").references(() => loanCommissionLedger.id),
  applicationId: varchar("application_id"), // Redundant for quick lookup
  
  // Payer Information
  paidBy: varchar("paid_by").notNull(), // 'bank', 'master_dsa'
  payerName: varchar("payer_name"), // Bank name or Master DSA name
  payerReference: varchar("payer_reference"), // Their internal reference
  
  // Payment Details
  expectedAmount: decimal("expected_amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  utrNumber: varchar("utr_number"), // Unique Transaction Reference
  paymentMode: varchar("payment_mode"), // neft, rtgs, cheque, upi
  
  // Matching Status
  matchStatus: varchar("match_status").notNull().default("pending"), // pending, matched, partial, disputed, unmatched
  matchVariance: decimal("match_variance", { precision: 12, scale: 2 }).default("0"), // Difference from expected
  matchedAt: timestamp("matched_at"),
  matchedBy: varchar("matched_by"), // System or user ID
  
  // Tolerance Settings (for this payment)
  toleranceAmount: decimal("tolerance_amount", { precision: 12, scale: 2 }).default("100"), // ±100 default
  
  // Dispute Details
  disputeReason: text("dispute_reason"),
  disputeRaisedAt: timestamp("dispute_raised_at"),
  disputeResolvedAt: timestamp("dispute_resolved_at"),
  disputeResolution: text("dispute_resolution"),
  
  // Revenue Recognition
  revenueStatus: varchar("revenue_status").notNull().default("accrued"), // accrued, realized, suspense
  recognizedDate: timestamp("recognized_date"),
  
  // Source File (for uploaded statements)
  sourceFileName: varchar("source_file_name"),
  sourceFileRowNum: integer("source_file_row_num"),
  uploadBatchId: varchar("upload_batch_id"),
  
  // Audit Trail
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Commission Payment Upload Batches - Track CSV/statement file uploads
export const commissionPaymentBatches = pgTable("commission_payment_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Upload Details
  fileName: varchar("file_name").notNull(),
  fileType: varchar("file_type").notNull(), // bank_statement, dsa_statement
  sourceType: varchar("source_type").notNull(), // ICICI, HDFC, AXIS, KOTAK, MASTER_DSA
  
  // Processing Stats
  totalRows: integer("total_rows").default(0),
  processedRows: integer("processed_rows").default(0),
  matchedRows: integer("matched_rows").default(0),
  unmatchedRows: integer("unmatched_rows").default(0),
  disputedRows: integer("disputed_rows").default(0),
  
  // Amounts
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0"),
  matchedAmount: decimal("matched_amount", { precision: 15, scale: 2 }).default("0"),
  
  // Status
  status: varchar("status").notNull().default("pending"), // pending, processing, completed, failed
  errorMessage: text("error_message"),
  
  // Upload Info
  uploadedBy: varchar("uploaded_by"),
  processedAt: timestamp("processed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Commission Plans - Version-controlled commission configurations by product type
export const commissionPlans = pgTable("commission_plans", {
  id: serial("id").primaryKey(),
  productType: varchar("product_type", { length: 100 }).notNull(), // mutual_fund, stocks, bonds, ipos, loans, insurance, unlisted, tax_services
  version: integer("version").notNull().default(1),
  status: commissionPlanStatusEnum("status").notNull().default("draft"),
  isActive: boolean("is_active").notNull().default(false),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  regulatoryCap: decimal("regulatory_cap", { precision: 5, scale: 2 }), // Maximum allowed commission %
  changeReason: text("change_reason"),
  createdBy: integer("created_by").notNull(),
  updatedBy: integer("updated_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productTypeIdx: index("commission_plans_product_type_idx").on(table.productType),
  isActiveIdx: index("commission_plans_is_active_idx").on(table.isActive),
  statusIdx: index("commission_plans_status_idx").on(table.status),
}));

// Commission Role Maps - Payout percentages by role for each plan
export const commissionRoleMaps = pgTable("commission_role_maps", {
  id: serial("id").primaryKey(),
  commissionPlanId: integer("commission_plan_id").notNull().references(() => commissionPlans.id, { onDelete: "cascade" }),
  roleId: varchar("role_id", { length: 50 }).notNull(), // References role from roles.ts
  payoutPercentage: decimal("payout_percentage", { precision: 5, scale: 2 }).notNull(),
  payoutMode: payoutModeEnum("payout_mode").notNull().default("upfront"),
  minCap: decimal("min_cap", { precision: 15, scale: 2 }), // Minimum commission amount
  maxCap: decimal("max_cap", { precision: 15, scale: 2 }), // Maximum commission amount
  validationStatus: boolean("validation_status").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  planIdIdx: index("commission_role_maps_plan_id_idx").on(table.commissionPlanId),
  roleIdIdx: index("commission_role_maps_role_id_idx").on(table.roleId),
}));

// Commission Hierarchy Splits - Share percentages by hierarchy level
export const commissionHierarchySplits = pgTable("commission_hierarchy_splits", {
  id: serial("id").primaryKey(),
  commissionPlanId: integer("commission_plan_id").notNull().references(() => commissionPlans.id, { onDelete: "cascade" }),
  roleId: varchar("role_id", { length: 50 }).notNull(),
  hierarchyLevel: integer("hierarchy_level").notNull(), // 1 = top, higher = lower in hierarchy
  sharePercentage: decimal("share_percentage", { precision: 5, scale: 2 }).notNull(),
  passthroughRule: passthroughRuleEnum("passthrough_rule").notNull().default("stop"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  planIdIdx: index("commission_hierarchy_splits_plan_id_idx").on(table.commissionPlanId),
}));

// Commission Audit Logs - Complete modification history
export const commissionAuditLogs = pgTable("commission_audit_logs", {
  id: serial("id").primaryKey(),
  commissionPlanId: integer("commission_plan_id").notNull().references(() => commissionPlans.id, { onDelete: "cascade" }),
  fieldChanged: varchar("field_changed", { length: 100 }).notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedBy: integer("changed_by").notNull(),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  remarks: text("remarks"),
}, (table) => ({
  planIdIdx: index("commission_audit_logs_plan_id_idx").on(table.commissionPlanId),
  changedAtIdx: index("commission_audit_logs_changed_at_idx").on(table.changedAt),
}));

// User Referral Program
export const userReferrals = pgTable("user_referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Referrer Info
  referrerId: varchar("referrer_id").references(() => users.id).notNull(),
  referralCode: varchar("referral_code", { length: 20 }).notNull().unique(),
  
  // Referee Info
  refereeId: varchar("referee_id").references(() => users.id),
  refereeEmail: varchar("referee_email", { length: 255 }),
  refereePhone: varchar("referee_phone", { length: 20 }),
  
  // Status
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, registered, kyc_complete, first_investment, rewarded
  
  // Rewards
  referrerRewardAmount: decimal("referrer_reward_amount", { precision: 10, scale: 2 }),
  refereeRewardAmount: decimal("referee_reward_amount", { precision: 10, scale: 2 }),
  referrerRewardPaidAt: timestamp("referrer_reward_paid_at"),
  refereeRewardPaidAt: timestamp("referee_reward_paid_at"),
  
  // Tracking
  inviteSentAt: timestamp("invite_sent_at"),
  registeredAt: timestamp("registered_at"),
  kycCompletedAt: timestamp("kyc_completed_at"),
  firstInvestmentAt: timestamp("first_investment_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ur_referrer").on(table.referrerId),
  index("idx_ur_referee").on(table.refereeId),
  index("idx_ur_code").on(table.referralCode),
]);

export const payoutClaims = pgTable("payout_claims", {
  claimId: varchar("claim_id").primaryKey().default(sql`gen_random_uuid()`),
  // Note: referencing leadRegistry by name since it's in the monolith
  leadId: varchar("lead_id").notNull(), 
  agentId: varchar("agent_id").notNull(),
  partnerId: varchar("partner_id").notNull(),
  disbursementAmount: decimal("disbursement_amount", { precision: 15, scale: 2 }).notNull(),
  disbursementDate: date("disbursement_date").notNull(),
  loanAccountNumber: varchar("loan_account_number", { length: 50 }),
  financierName: varchar("financier_name", { length: 200 }).notNull(),
  pddStatus: pddStatusEnum("pdd_status").notNull().default("PENDING"),
  pddExceptionAllowedByFinancier: boolean("pdd_exception_allowed_by_financier").default(false),
  pddClearedAt: timestamp("pdd_cleared_at"),
  subventionFlag: boolean("subvention_flag").default(false),
  teamCase: boolean("team_case").default(false),
  teamMembers: jsonb("team_members").default([]),
  transactionStatus: varchar("transaction_status", { length: 50 }).default("ACTIVE"),
  status: payoutClaimStatusEnum("status").notNull().default("PENDING_VERIFICATION"),
  bankerConfirmationEmailId: varchar("banker_confirmation_email_id"),
  bankerConfirmedAt: timestamp("banker_confirmed_at"),
  confirmedByAdminId: varchar("confirmed_by_admin_id"),
  approvedAt: timestamp("approved_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  commissionLedgerId: varchar("commission_ledger_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_payout_claims_lead").on(table.leadId),
  index("idx_payout_claims_agent").on(table.agentId),
  index("idx_payout_claims_status").on(table.status),
]);

export const proofUploads = pgTable("proof_uploads", {
  proofId: varchar("proof_id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").references(() => payoutClaims.claimId).notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 20 }).notNull(),
  fileSize: integer("file_size").notNull(),
  fileHash: varchar("file_hash", { length: 64 }).notNull(),
  storagePath: varchar("storage_path", { length: 1000 }).notNull(),
  uploaderRole: varchar("uploader_role", { length: 30 }).notNull(),
  uploaderId: varchar("uploader_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_proof_uploads_claim").on(table.claimId),
]);

export const bankerConfirmationEmails = pgTable("banker_confirmation_emails", {
  emailId: varchar("email_id").primaryKey().default(sql`gen_random_uuid()`),
  claimId: varchar("claim_id").references(() => payoutClaims.claimId).notNull(),
  bankerEmail: varchar("banker_email", { length: 200 }).notNull(),
  seniorEmail: varchar("senior_email", { length: 200 }),
  ccAdminEmail: varchar("cc_admin_email", { length: 200 }),
  emailSubject: text("email_subject").notNull(),
  emailBody: text("email_body").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  replyReceived: boolean("reply_received").default(false),
  replyReceivedAt: timestamp("reply_received_at"),
  replyContent: text("reply_content"),
  taggedByAdminId: varchar("tagged_by_admin_id"),
  taggedAt: timestamp("tagged_at"),
}, (table) => [
  index("idx_banker_emails_claim").on(table.claimId),
]);

export const leadAuditLogs = pgTable("lead_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id"),
  claimId: varchar("claim_id"),
  actorId: varchar("actor_id").notNull(),
  actorRole: varchar("actor_role", { length: 30 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  details: jsonb("details").default({}),
  ipAddress: varchar("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_lead_audit_lead").on(table.leadId),
  index("idx_lead_audit_claim").on(table.claimId),
]);

export const masterDsaClaims = pgTable("master_dsa_claims", {
  dsaClaimId: varchar("dsa_claim_id").primaryKey().default(sql`gen_random_uuid()`),
  payoutClaimId: varchar("payout_claim_id").references(() => payoutClaims.claimId).notNull().unique(),
  leadId: varchar("lead_id").notNull(),
  agentId: varchar("agent_id").notNull(),
  partnerId: varchar("partner_id").notNull(),
  financierName: varchar("financier_name", { length: 200 }).notNull(),
  disbursementAmount: decimal("disbursement_amount", { precision: 15, scale: 2 }).notNull(),
  disbursementDate: date("disbursement_date").notNull(),
  loanAccountNumber: varchar("loan_account_number", { length: 50 }),
  customerName: varchar("customer_name", { length: 200 }),
  customerPan: varchar("customer_pan", { length: 10 }),
  claimedAmount: decimal("claimed_amount", { precision: 15, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }).default("0.00"),
  outstandingAmount: decimal("outstanding_amount", { precision: 15, scale: 2 }).default("0.00"),
  discrepancyFlag: boolean("discrepancy_flag").default(false),
  discrepancyNotes: text("discrepancy_notes"),
  status: masterDsaClaimStatusEnum("status").notNull().default("DRAFT"),
  emailSentAt: timestamp("email_sent_at"),
  emailMessageId: varchar("email_message_id"),
  submittedAt: timestamp("submitted_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  paidAt: timestamp("paid_at"),
  disputedAt: timestamp("disputed_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_master_dsa_claims_payout").on(table.payoutClaimId),
  index("idx_master_dsa_claims_status").on(table.status),
]);

export const masterDsaAttachments = pgTable("master_dsa_attachments", {
  attachmentId: varchar("attachment_id").primaryKey().default(sql`gen_random_uuid()`),
  dsaClaimId: varchar("dsa_claim_id").references(() => masterDsaClaims.dsaClaimId).notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileType: varchar("file_type", { length: 20 }).notNull(),
  fileSize: integer("file_size").notNull(),
  fileHash: varchar("file_hash", { length: 64 }).notNull(),
  storagePath: varchar("storage_path", { length: 1000 }).notNull(),
  attachmentType: varchar("attachment_type", { length: 50 }).notNull().default("CONFIRMATION_EMAIL"),
  uploadedByAdminId: varchar("uploaded_by_admin_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_master_dsa_attachments_claim").on(table.dsaClaimId),
]);

export const masterDsaPayments = pgTable("master_dsa_payments", {
  paymentId: varchar("payment_id").primaryKey().default(sql`gen_random_uuid()`),
  dsaClaimId: varchar("dsa_claim_id").references(() => masterDsaClaims.dsaClaimId).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  referenceNumber: varchar("reference_number", { length: 100 }),
  paymentMode: varchar("payment_mode", { length: 50 }),
  notes: text("notes"),
  recordedByAdminId: varchar("recorded_by_admin_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_master_dsa_payments_claim").on(table.dsaClaimId),
]);

// Schemas
export const insertReferralPayoutConfigSchema = createInsertSchema(referralPayoutConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReferralPayoutTransactionsSchema = createInsertSchema(referralPayoutTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionPaymentsSchema = createInsertSchema(commissionPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionPaymentBatchesSchema = createInsertSchema(commissionPaymentBatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionPlanSchema = createInsertSchema(commissionPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionRoleMapSchema = createInsertSchema(commissionRoleMaps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionHierarchySplitSchema = createInsertSchema(commissionHierarchySplits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommissionAuditLogSchema = createInsertSchema(commissionAuditLogs).omit({
  id: true,
  changedAt: true,
});

export const insertUserReferralSchema = createInsertSchema(userReferrals).omit({ 
  id: true, 
  createdAt: true 
});

export const insertPayoutClaimSchema = createInsertSchema(payoutClaims).omit({
  claimId: true, createdAt: true, updatedAt: true, approvedAt: true,
  rejectedAt: true, bankerConfirmedAt: true, pddClearedAt: true,
  commissionLedgerId: true, confirmedByAdminId: true, bankerConfirmationEmailId: true,
});

export const insertProofUploadSchema = createInsertSchema(proofUploads).omit({
  proofId: true, createdAt: true,
});

export const insertBankerConfirmationEmailSchema = createInsertSchema(bankerConfirmationEmails).omit({
  emailId: true, sentAt: true, replyReceived: true, replyReceivedAt: true,
  replyContent: true, taggedByAdminId: true, taggedAt: true,
});

export const insertLeadAuditLogSchema = createInsertSchema(leadAuditLogs).omit({
  id: true, createdAt: true,
});

export const insertMasterDsaClaimSchema = createInsertSchema(masterDsaClaims).omit({
  dsaClaimId: true, createdAt: true, updatedAt: true, paidAmount: true,
  outstandingAmount: true, discrepancyFlag: true, discrepancyNotes: true,
  emailSentAt: true, emailMessageId: true, submittedAt: true,
  acknowledgedAt: true, paidAt: true, disputedAt: true, rejectedAt: true, rejectionReason: true,
});

export const insertMasterDsaAttachmentSchema = createInsertSchema(masterDsaAttachments).omit({
  attachmentId: true, createdAt: true,
});

export const insertMasterDsaPaymentSchema = createInsertSchema(masterDsaPayments).omit({
  paymentId: true, createdAt: true,
});

// Types
export type ReferralPayoutConfig = typeof referralPayoutConfig.$inferSelect;
export type InsertReferralPayoutConfig = z.infer<typeof insertReferralPayoutConfigSchema>;
export type ReferralPayoutTransactions = typeof referralPayoutTransactions.$inferSelect;
export type InsertReferralPayoutTransactions = z.infer<typeof insertReferralPayoutTransactionsSchema>;
export type CommissionPayments = typeof commissionPayments.$inferSelect;
export type InsertCommissionPayments = z.infer<typeof insertCommissionPaymentsSchema>;
export type CommissionPaymentBatches = typeof commissionPaymentBatches.$inferSelect;
export type InsertCommissionPaymentBatches = z.infer<typeof insertCommissionPaymentBatchesSchema>;
export type CommissionPlan = typeof commissionPlans.$inferSelect;
export type InsertCommissionPlan = z.infer<typeof insertCommissionPlanSchema>;
export type CommissionRoleMap = typeof commissionRoleMaps.$inferSelect;
export type InsertCommissionRoleMap = z.infer<typeof insertCommissionRoleMapSchema>;
export type CommissionHierarchySplit = typeof commissionHierarchySplits.$inferSelect;
export type InsertCommissionHierarchySplit = z.infer<typeof insertCommissionHierarchySplitSchema>;
export type CommissionAuditLog = typeof commissionAuditLogs.$inferSelect;
export type InsertCommissionAuditLog = z.infer<typeof insertCommissionAuditLogSchema>;
export type UserReferral = typeof userReferrals.$inferSelect;
export type InsertUserReferral = z.infer<typeof insertUserReferralSchema>;
export type PayoutClaim = typeof payoutClaims.$inferSelect;
export type InsertPayoutClaim = z.infer<typeof insertPayoutClaimSchema>;
export type ProofUpload = typeof proofUploads.$inferSelect;
export type InsertProofUpload = z.infer<typeof insertProofUploadSchema>;
export type BankerConfirmationEmail = typeof bankerConfirmationEmails.$inferSelect;
export type InsertBankerConfirmationEmail = z.infer<typeof insertBankerConfirmationEmailSchema>;
export type LeadAuditLog = typeof leadAuditLogs.$inferSelect;
export type InsertLeadAuditLog = z.infer<typeof insertLeadAuditLogSchema>;
export type MasterDsaClaim = typeof masterDsaClaims.$inferSelect;
export type InsertMasterDsaClaim = z.infer<typeof insertMasterDsaClaimSchema>;
export type MasterDsaAttachment = typeof masterDsaAttachments.$inferSelect;
export type InsertMasterDsaAttachment = z.infer<typeof insertMasterDsaAttachmentSchema>;
export type MasterDsaPayment = typeof masterDsaPayments.$inferSelect;
export type InsertMasterDsaPayment = z.infer<typeof insertMasterDsaPaymentSchema>;
