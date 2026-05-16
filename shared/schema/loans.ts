import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal, date, serial, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { users } from './users';
import { portfolios } from './portfolio';
import { agents } from './agents';
import { partners } from './partners';

// --- Auto-Migrated Tables ---
export const loanApplications = pgTable("loan_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  
  // Loan Details
  requestedAmount: decimal("requested_amount", { precision: 15, scale: 2 }).notNull(),
  approvedAmount: decimal("approved_amount", { precision: 15, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }), // Annual percentage
  tenure: integer("tenure"), // Loan duration in months
  loanToValue: decimal("loan_to_value", { precision: 5, scale: 2 }), // LTV ratio as percentage
  
  // Collateral Information
  collateralValue: decimal("collateral_value", { precision: 15, scale: 2 }).notNull(),
  collateralAssets: jsonb("collateral_assets").notNull(), // Array of pledged securities
  marginRequirement: decimal("margin_requirement", { precision: 5, scale: 2 }), // Margin percentage
  
  // Application Status and Processing
  status: varchar("status").default("pending"), // pending/approved/rejected/disbursed/closed
  applicationNumber: varchar("application_number").unique(),
  applicationDate: timestamp("application_date").defaultNow(),
  approvalDate: timestamp("approval_date"),
  disbursalDate: timestamp("disbursal_date"),
  closureDate: timestamp("closure_date"),
  
  // Risk Assessment
  riskScore: integer("risk_score"), // 0-100 risk assessment
  eligibilityScore: decimal("eligibility_score", { precision: 5, scale: 2 }),
  creditScore: integer("credit_score"), // CIBIL/Experian score
  
  // Loan Terms
  processingFee: decimal("processing_fee", { precision: 15, scale: 2 }),
  legalCharges: decimal("legal_charges", { precision: 15, scale: 2 }),
  isOverdraftFacility: boolean("is_overdraft_facility").default(false),
  preClosurePenalty: decimal("pre_closure_penalty", { precision: 5, scale: 2 }).default("0"),
  
  // Approval Information
  approvedBy: varchar("approved_by"), // User ID of approver
  rejectionReason: text("rejection_reason"),
  
  // Tracking and Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanRepayments = pgTable("loan_repayments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  
  // Payment Details
  paymentAmount: decimal("payment_amount", { precision: 15, scale: 2 }).notNull(),
  principalAmount: decimal("principal_amount", { precision: 15, scale: 2 }),
  interestAmount: decimal("interest_amount", { precision: 15, scale: 2 }),
  penaltyAmount: decimal("penalty_amount", { precision: 15, scale: 2 }).default("0"),
  
  // Payment Information
  paymentDate: timestamp("payment_date").defaultNow(),
  dueDate: timestamp("due_date"),
  paymentMethod: varchar("payment_method"), // bank_transfer/upi/net_banking/auto_debit
  transactionId: varchar("transaction_id"),
  paymentStatus: varchar("payment_status").default("completed"), // pending/completed/failed
  
  // Balance Information
  outstandingPrincipal: decimal("outstanding_principal", { precision: 15, scale: 2 }),
  outstandingInterest: decimal("outstanding_interest", { precision: 15, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const loanProducts = pgTable("loan_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productKey: varchar("product_key").notNull().unique(), // personal, home, lap, las, business, education, vehicle
  productName: varchar("product_name").notNull(),
  category: varchar("category").notNull(), // secured, unsecured
  collateralType: varchar("collateral_type"), // property, securities, vehicle, none
  description: text("description"),
  
  // Product Limits
  minAmount: decimal("min_amount", { precision: 15, scale: 2 }).notNull(),
  maxAmount: decimal("max_amount", { precision: 15, scale: 2 }).notNull(),
  minTenure: integer("min_tenure").notNull(), // months
  maxTenure: integer("max_tenure").notNull(), // months
  
  // Eligibility Criteria
  minAge: integer("min_age").default(18),
  maxAge: integer("max_age").default(65),
  minIncome: decimal("min_income", { precision: 15, scale: 2 }),
  minCibilScore: integer("min_cibil_score").default(600),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanProviders = pgTable("loan_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerKey: varchar("provider_key").notNull().unique(), // icici, hdfc, bajaj_finance, tata_capital, axis, piramal
  providerName: varchar("provider_name").notNull(),
  providerType: varchar("provider_type").notNull(), // bank, nbfc
  logoUrl: varchar("logo_url"),
  description: text("description"),
  
  // Provider Capabilities
  hasApi: boolean("has_api").default(false),
  supportsPrequalification: boolean("supports_prequalification").default(false),
  supportsInstantOffers: boolean("supports_instant_offers").default(false),
  supportsWebhooks: boolean("supports_webhooks").default(false),
  
  // Contact Information
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  website: varchar("website"),
  
  // Processing Information
  avgProcessingTime: varchar("avg_processing_time"), // "2-3 days", "instant", etc.
  processingCutoffTime: varchar("processing_cutoff_time"), // "5 PM"
  
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(100), // Lower number = higher priority
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanRequests = pgTable("loan_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  loanType: varchar("loan_type"),
  requestedAmount: decimal("requested_amount", { precision: 15, scale: 2 }),
  tenureMonths: integer("tenure_months"),
  purpose: varchar("purpose"),
  employmentType: varchar("employment_type"),
  monthlyIncome: decimal("monthly_income", { precision: 15, scale: 2 }),
  status: varchar("status").default("active"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanOffers = pgTable("loan_offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").references(() => loanRequests.id).notNull(),
  providerId: varchar("provider_id").references(() => loanProviders.id).notNull(),
  productId: varchar("product_id").references(() => loanProducts.id).notNull(),
  
  // Offer Details
  approvedAmount: decimal("approved_amount", { precision: 15, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  tenure: integer("tenure").notNull(), // months
  emi: decimal("emi", { precision: 15, scale: 2 }).notNull(),
  
  // Fee Structure
  processingFee: decimal("processing_fee", { precision: 15, scale: 2 }).notNull(),
  legalCharges: decimal("legal_charges", { precision: 15, scale: 2 }).default("0"),
  otherCharges: decimal("other_charges", { precision: 15, scale: 2 }).default("0"),
  totalCost: decimal("total_cost", { precision: 15, scale: 2 }).notNull(),
  
  // Risk Assessment
  eligibilityScore: decimal("eligibility_score", { precision: 5, scale: 2 }).notNull(),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }).notNull(), // Overall offer quality
  approvalProbability: decimal("approval_probability", { precision: 5, scale: 2 }).default("95"),
  
  // Offer Metadata
  offerSource: varchar("offer_source").notNull(), // api, rules_engine
  rateType: varchar("rate_type").default("floating"),
  ltvRatio: decimal("ltv_ratio", { precision: 5, scale: 2 }),
  
  // Terms and Conditions
  terms: jsonb("terms").default([]),
  specialOffers: jsonb("special_offers").default([]),
  
  // Offer Validity
  validUntil: timestamp("valid_until").notNull(),
  isActive: boolean("is_active").default(true),
  
  // Tracking
  viewedAt: timestamp("viewed_at"),
  selectedAt: timestamp("selected_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const loanApplicationsMarketplace = pgTable("loan_applications_marketplace", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  loanRequestId: varchar("loan_request_id").references(() => loanRequests.id),
  productKey: varchar("product_key"),
  providerKey: varchar("provider_key"),
  
  // Application Amount and Terms
  requestedAmount: decimal("requested_amount", { precision: 15, scale: 2 }),
  approvedAmount: decimal("approved_amount", { precision: 15, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
  tenureMonths: integer("tenure_months"),
  
  // Application Status
  status: varchar("status"), // draft, submitted, under_review, approved, rejected, disbursed, cancelled
  
  // Processing Information
  applicationDate: timestamp("application_date"),
  decisionDate: timestamp("decision_date"),
  disbursementDate: timestamp("disbursement_date"),
  rejectionReason: text("rejection_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanComparisons = pgTable("loan_comparisons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Comparison Details
  comparisonName: varchar("comparison_name").notNull(),
  description: text("description"),
  
  // Loan Parameters for Comparison
  comparisonAmount: decimal("comparison_amount", { precision: 15, scale: 2 }).notNull(),
  comparisonTenure: integer("comparison_tenure").notNull(), // months
  loanType: varchar("loan_type").notNull(), // personal, home, business, etc.
  
  // Selected Offers for Comparison
  selectedOffers: jsonb("selected_offers").notNull(), // Array of offer IDs
  
  // Comparison Criteria & Weights
  comparisonCriteria: jsonb("comparison_criteria").default({
    "interest_rate": 30,
    "processing_fee": 20, 
    "total_cost": 25,
    "approval_probability": 15,
    "provider_rating": 10
  }),
  
  // Comparison Results
  winnerOfferId: varchar("winner_offer_id"),
  comparisonScore: jsonb("comparison_score"), // Scores for each offer
  
  // Metadata
  isPublic: boolean("is_public").default(false),
  sharedWith: jsonb("shared_with").default([]), // Array of user IDs
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const loanComparisonAnalytics = pgTable("loan_comparison_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  comparisonId: varchar("comparison_id").references(() => loanComparisons.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // User Interaction
  action: varchar("action").notNull(), // view, filter, sort, share, export
  actionDetails: jsonb("action_details"),
  
  // Session Info
  sessionId: varchar("session_id"),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLoanComparisonAnalyticsSchema = createInsertSchema(loanComparisonAnalytics).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});

export type LoanComparisonAnalytics = typeof loanComparisonAnalytics.$inferSelect;

export type InsertLoanComparisonAnalytics = z.infer<typeof insertLoanComparisonAnalyticsSchema>;

export const loanCommissionLedger = pgTable("loan_commission_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplicationsMarketplace.id).notNull(),
  commissionConfigId: varchar("commission_config_id").references(() => providerProductCommissions.id),
  
  // Loan Details for Reference
  providerId: varchar("provider_id").references(() => loanProviders.id).notNull(),
  productId: varchar("product_id").references(() => loanProducts.id).notNull(),
  loanAmount: decimal("loan_amount", { precision: 15, scale: 2 }).notNull(),
  disbursementDate: timestamp("disbursement_date"),
  
  // Commission Calculation
  commissionableBase: decimal("commissionable_base", { precision: 15, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 6, scale: 4 }).notNull(),
  grossCommission: decimal("gross_commission", { precision: 12, scale: 2 }).notNull(),
  
  // TDS and Net
  tdsRate: decimal("tds_rate", { precision: 5, scale: 2 }).default("5.00"),
  tdsAmount: decimal("tds_amount", { precision: 12, scale: 2 }).default("0"),
  gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).default("18.00"),
  gstAmount: decimal("gst_amount", { precision: 12, scale: 2 }).default("0"),
  netCommission: decimal("net_commission", { precision: 12, scale: 2 }).notNull(),
  
  // Payout Distribution
  fintekProAmount: decimal("fintekpro_amount", { precision: 12, scale: 2 }).notNull(),
  partnerAmount: decimal("partner_amount", { precision: 12, scale: 2 }).default("0"),
  agentAmount: decimal("agent_amount", { precision: 12, scale: 2 }).default("0"),
  managementOverrideAmount: decimal("management_override_amount", { precision: 12, scale: 2 }).default("0"),
  
  // Beneficiaries
  partnerId: varchar("partner_id"),
  agentId: varchar("agent_id"),
  managerId: varchar("manager_id"), // For management override
  
  // Status
  status: varchar("status").notNull().default("pending"), // pending, approved, invoiced, paid, clawed_back, disputed
  
  // Payment Tracking
  invoiceNumber: varchar("invoice_number"),
  invoiceDate: timestamp("invoice_date"),
  paymentDueDate: timestamp("payment_due_date"),
  paymentDate: timestamp("payment_date"),
  paymentReference: varchar("payment_reference"),
  paymentMode: varchar("payment_mode"), // neft, rtgs, upi, cheque
  
  // Clawback
  isClawedBack: boolean("is_clawed_back").default(false),
  clawbackReason: text("clawback_reason"),
  clawbackAmount: decimal("clawback_amount", { precision: 12, scale: 2 }),
  clawbackDate: timestamp("clawback_date"),
  
  // Zoho Books Integration
  zohoInvoiceId: varchar("zoho_invoice_id"),
  zohoPaymentId: varchar("zoho_payment_id"),
  zohoSyncStatus: varchar("zoho_sync_status").default("pending"), // pending, synced, failed
  zohoSyncError: text("zoho_sync_error"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLoanCommissionLedgerSchema = createInsertSchema(loanCommissionLedger).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LoanCommissionLedger = typeof loanCommissionLedger.$inferSelect;

export type InsertLoanCommissionLedger = z.infer<typeof insertLoanCommissionLedgerSchema>;

export const loanLeads = pgTable("loan_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Lead Source
  source: varchar("source").notNull(), // website, referral, partner, agent, call_center, social_media
  sourceId: varchar("source_id"), // Partner/Agent ID if applicable
  campaignId: varchar("campaign_id"),
  utmSource: varchar("utm_source"),
  utmMedium: varchar("utm_medium"),
  utmCampaign: varchar("utm_campaign"),
  
  // Customer Details
  userId: varchar("user_id").references(() => users.id),
  customerName: varchar("customer_name").notNull(),
  email: varchar("email"),
  phone: varchar("phone").notNull(),
  alternatePhone: varchar("alternate_phone"),
  city: varchar("city"),
  state: varchar("state"),
  pincode: varchar("pincode"),
  
  // Loan Requirements
  productId: varchar("product_id").references(() => loanProducts.id),
  requestedAmount: decimal("requested_amount", { precision: 15, scale: 2 }),
  requestedTenure: integer("requested_tenure"),
  purpose: text("purpose"),
  
  // Lead Qualification
  employmentType: varchar("employment_type"), // salaried, self_employed, business, professional
  monthlyIncome: decimal("monthly_income", { precision: 15, scale: 2 }),
  existingEMIs: decimal("existing_emis", { precision: 15, scale: 2 }),
  creditScore: integer("credit_score"),
  
  // Lead Scoring
  leadScore: integer("lead_score").default(0), // 0-100
  scoringFactors: jsonb("scoring_factors").default({}),
  qualificationStatus: varchar("qualification_status").default("new"), // new, qualified, not_qualified, needs_review
  
  // Assignment
  assignedToStaffId: varchar("assigned_to_staff_id").references(() => lenderStaff.id),
  assignedToAgentId: varchar("assigned_to_agent_id"),
  assignedAt: timestamp("assigned_at"),
  reassignmentCount: integer("reassignment_count").default(0),
  
  // Funnel Status
  funnelStage: varchar("funnel_stage").notNull().default("inquiry"), // inquiry, contacted, interested, documents_pending, documents_submitted, processing, sanctioned, disbursed, rejected, dropped
  subStage: varchar("sub_stage"),
  
  // Interaction Tracking
  lastContactedAt: timestamp("last_contacted_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  contactAttempts: integer("contact_attempts").default(0),
  
  // Preferred Providers (if any)
  preferredProviders: jsonb("preferred_providers").default([]),
  
  // Application Reference (once converted)
  applicationId: varchar("application_id").references(() => loanApplicationsMarketplace.id),
  
  // Outcome
  isConverted: boolean("is_converted").default(false),
  conversionDate: timestamp("conversion_date"),
  rejectionReason: text("rejection_reason"),
  dropReason: text("drop_reason"),
  
  // Priority
  priority: varchar("priority").default("normal"), // low, normal, high, urgent
  isHotLead: boolean("is_hot_lead").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLoanLeadsSchema = createInsertSchema(loanLeads).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LoanLeads = typeof loanLeads.$inferSelect;

export type InsertLoanLeads = z.infer<typeof insertLoanLeadsSchema>;

// --- Auto-Migrated Tables (Lender Staff & Commissions) ---

// Partner Lender Staff Management
export const lenderStaff = pgTable("lender_staff", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => loanProviders.id).notNull(),
  
  // Staff Details
  staffCode: varchar("staff_code").notNull().unique(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone"),
  
  // Designation Hierarchy
  designation: varchar("designation").notNull(), // rm, senior_rm, branch_manager, area_manager, credit_officer, zonal_head, regional_head, national_head
  department: varchar("department").default("sales"), // sales, credit, operations, collections
  branchCode: varchar("branch_code"),
  branchName: varchar("branch_name"),
  regionCode: varchar("region_code"),
  zoneCode: varchar("zone_code"),
  
  // Reporting Structure
  reportsToId: varchar("reports_to_id").references((): any => lenderStaff.id),
  
  // Employment Details
  employeeId: varchar("employee_id"), // Lender's internal employee ID
  joiningDate: timestamp("joining_date"),
  confirmationDate: timestamp("confirmation_date"),
  
  // Status Management
  status: varchar("status").notNull().default("active"), // active, on_leave, resigned, terminated, transferred
  statusReason: text("status_reason"),
  statusChangedAt: timestamp("status_changed_at"),
  statusChangedBy: varchar("status_changed_by"),
  
  // Contact for Escalation
  isEscalationContact: boolean("is_escalation_contact").default(false),
  escalationLevel: integer("escalation_level"), // 1, 2, 3 for escalation hierarchy
  
  // Performance Metrics
  totalLeadsAssigned: integer("total_leads_assigned").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const lenderStaffHistory = pgTable("lender_staff_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: varchar("staff_id").references(() => lenderStaff.id).notNull(),
  
  // Change Type
  changeType: varchar("change_type").notNull(), // resignation, termination, transfer, promotion, demotion, leave_start, leave_end, rejoined, status_change
  
  // Previous State
  previousProviderId: varchar("previous_provider_id").references(() => loanProviders.id),
  previousDesignation: varchar("previous_designation"),
  previousStatus: varchar("previous_status"),
  previousBranchCode: varchar("previous_branch_code"),
  previousReportsToId: varchar("previous_reports_to_id"),
  
  // New State
  newProviderId: varchar("new_provider_id").references(() => loanProviders.id),
  newDesignation: varchar("new_designation"),
  newStatus: varchar("new_status"),
  newBranchCode: varchar("new_branch_code"),
  newReportsToId: varchar("new_reports_to_id"),
  
  // Change Details
  effectiveDate: timestamp("effective_date").notNull(),
  reason: text("reason"),
  remarks: text("remarks"),
  
  // For Resignation/Termination
  relievingDate: timestamp("relieving_date"),
  lastWorkingDay: timestamp("last_working_day"),
  exitInterviewNotes: text("exit_interview_notes"),
  isEligibleForRehire: boolean("is_eligible_for_rehire"),
  
  // For Leave
  leaveType: varchar("leave_type"), // sick, vacation, maternity, sabbatical
  leaveStartDate: timestamp("leave_start_date"),
  leaveEndDate: timestamp("leave_end_date"),
  
  // Lead Reassignment
  leadsReassignedTo: varchar("leads_reassigned_to").references(() => lenderStaff.id),
  leadsReassignedCount: integer("leads_reassigned_count").default(0),
  
  // Audit Trail
  changedBy: varchar("changed_by").notNull(),
  changedByRole: varchar("changed_by_role"),
  ipAddress: varchar("ip_address"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Provider Product Commissions - Commission structure per product-provider combination
export const providerProductCommissions = pgTable("provider_product_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => loanProviders.id).notNull(),
  productId: varchar("product_id").references(() => loanProducts.id).notNull(),
  
  // Commission Structure (% of loan amount or processing fee)
  commissionType: varchar("commission_type").notNull().default("percentage"), // percentage, flat, hybrid
  commissionBase: varchar("commission_base").notNull().default("loan_amount"), // loan_amount, processing_fee, first_emi
  
  // Commission Rates
  baseCommissionRate: decimal("base_commission_rate", { precision: 6, scale: 4 }).notNull(), // e.g., 0.75%
  minCommission: decimal("min_commission", { precision: 12, scale: 2 }), // Minimum commission amount
  maxCommission: decimal("max_commission", { precision: 12, scale: 2 }), // Maximum cap
  
  // Slab-based Commissions (JSON for flexibility)
  slabCommissions: jsonb("slab_commissions").default([]), // [{minAmount: 100000, maxAmount: 500000, rate: 0.80}, ...]
  
  // Volume-based Incentives
  volumeIncentives: jsonb("volume_incentives").default([]), // Additional % for hitting volume targets
  
  // Payout Split Configuration
  fintekProShare: decimal("fintekpro_share", { precision: 5, scale: 2 }).notNull().default("40.00"), // FintekPro's share %
  partnerShare: decimal("partner_share", { precision: 5, scale: 2 }).default("30.00"), // Partner's share %
  agentShare: decimal("agent_share", { precision: 5, scale: 2 }).default("30.00"), // Agent's share %
  
  // Management Override (additional % from subordinate performance)
  managementOverrideRate: decimal("management_override_rate", { precision: 5, scale: 2 }).default("0.00"),
  
  // Payment Terms
  paymentTermsDays: integer("payment_terms_days").default(30), // Days after disbursement
  paymentFrequency: varchar("payment_frequency").default("monthly"), // monthly, quarterly
  
  // Clawback Rules
  clawbackPeriodMonths: integer("clawback_period_months").default(3), // Clawback if loan defaults within this period
  clawbackRate: decimal("clawback_rate", { precision: 5, scale: 2 }).default("100.00"), // % of commission to claw back
  
  // Validity
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  effectiveTo: timestamp("effective_to"),
  isActive: boolean("is_active").default(true),
  
  // Approval
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertLenderStaffSchema = createInsertSchema(lenderStaff).extend({
  id: z.any(),
  createdAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
});
export type LenderStaff = typeof lenderStaff.$inferSelect;
export type InsertLenderStaff = z.infer<typeof insertLenderStaffSchema>;

export const insertProviderProductCommissionsSchema = createInsertSchema(providerProductCommissions).extend({
  id: z.any(),
  createdAt: z.any(),
  updatedAt: z.any(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ProviderProductCommissions = typeof providerProductCommissions.$inferSelect;
export type InsertProviderProductCommissions = z.infer<typeof insertProviderProductCommissionsSchema>;

// Provider-specific products and pricing
export const providerProducts = pgTable("provider_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => loanProviders.id).notNull(),
  productId: varchar("product_id").references(() => loanProducts.id).notNull(),
  providerProductName: varchar("provider_product_name"),
  baseInterestRate: decimal("base_interest_rate", { precision: 5, scale: 2 }).notNull(),
  minInterestRate: decimal("min_interest_rate", { precision: 5, scale: 2 }).notNull(),
  maxInterestRate: decimal("max_interest_rate", { precision: 5, scale: 2 }).notNull(),
  rateType: varchar("rate_type").default("floating"), // fixed, floating, hybrid
  processingFeeType: varchar("processing_fee_type").default("percentage"), // percentage, fixed
  processingFeeValue: decimal("processing_fee_value", { precision: 8, scale: 2 }).notNull(),
  maxProcessingFee: decimal("max_processing_fee", { precision: 15, scale: 2 }),
  prepaymentCharges: decimal("prepayment_charges", { precision: 5, scale: 2 }).default("0"),
  latePaymentFee: decimal("late_payment_fee", { precision: 15, scale: 2 }),
  minAmount: decimal("min_amount", { precision: 15, scale: 2 }),
  maxAmount: decimal("max_amount", { precision: 15, scale: 2 }),
  minTenure: integer("min_tenure"),
  maxTenure: integer("max_tenure"),
  eligibilityRules: jsonb("eligibility_rules").default({}),
  pricingModel: jsonb("pricing_model").default({}),
  documentsRequired: jsonb("documents_required").default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced client credit information
export const creditProfiles = pgTable("credit_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  cibilScore: integer("cibil_score"),
  experianScore: integer("experian_score"),
  equifaxScore: integer("equifax_score"),
  highMarkScore: integer("high_mark_score"),
  lastCreditPullDate: timestamp("last_credit_pull_date"),
  monthlyIncome: decimal("monthly_income", { precision: 15, scale: 2 }),
  annualIncome: decimal("annual_income", { precision: 15, scale: 2 }),
  employmentType: varchar("employment_type"), // salaried, self_employed, business, professional
  workExperience: integer("work_experience"), // years
  companyType: varchar("company_type"), // government, private, psu, mnc, sme
  existingEMIs: decimal("existing_emis", { precision: 15, scale: 2 }).default("0"),
  existingCreditCards: integer("existing_credit_cards").default(0),
  totalCreditLimit: decimal("total_credit_limit", { precision: 15, scale: 2 }).default("0"),
  creditUtilization: decimal("credit_utilization", { precision: 5, scale: 2 }).default("0"),
  netWorth: decimal("net_worth", { precision: 15, scale: 2 }),
  currentAssets: decimal("current_assets", { precision: 15, scale: 2 }),
  totalLiabilities: decimal("total_liabilities", { precision: 15, scale: 2 }),
  propertyOwnership: boolean("property_ownership").default(false),
  propertyValue: decimal("property_value", { precision: 15, scale: 2 }),
  securitiesPortfolio: decimal("securities_portfolio", { precision: 15, scale: 2 }),
  bankingHistory: integer("banking_history").default(0), // years with current bank
  primaryBankName: varchar("primary_bank_name"),
  averageMonthlyBalance: decimal("average_monthly_balance", { precision: 15, scale: 2 }),
  totalLoansAvailed: integer("total_loans_availed").default(0),
  loansClosedSuccessfully: integer("loans_closed_successfully").default(0),
  anyDefaultHistory: boolean("any_default_history").default(false),
  lastLoanDate: timestamp("last_loan_date"),
  riskProfile: varchar("risk_profile").default("medium"), // low, medium, high
  debtToIncomeRatio: decimal("debt_to_income_ratio", { precision: 5, scale: 2 }),
  bureauRawData: jsonb("bureau_raw_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// API integration configurations for loan providers
export const providerIntegrations = pgTable("provider_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => loanProviders.id).notNull(),
  adapterKey: varchar("adapter_key").notNull(), // icici_api, hdfc_api, bajaj_rules, etc.
  integrationName: varchar("integration_name").notNull(),
  integrationType: varchar("integration_type").notNull(), // api, rules_engine, webhook
  baseUrl: varchar("base_url"),
  authenticationMethod: varchar("authentication_method"), // api_key, oauth2, certificate
  authConfig: jsonb("auth_config"), // Store auth credentials securely
  webhookUrl: varchar("webhook_url"),
  webhookSecret: varchar("webhook_secret"),
  webhookEvents: jsonb("webhook_events").default([]),
  isEnabled: boolean("is_enabled").default(true),
  lastHealthCheck: timestamp("last_health_check"),
  healthStatus: varchar("health_status").default("unknown"), // healthy, warning, error, unknown
  rateLimitPerMinute: integer("rate_limit_per_minute").default(60),
  rateLimitPerDay: integer("rate_limit_per_day").default(1000),
  configVersion: varchar("config_version").default("1.0"),
  supportedFeatures: jsonb("supported_features").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document management for loan applications
export const applicationDocuments = pgTable("application_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").references(() => loanApplicationsMarketplace.id).notNull(),
  documentType: varchar("document_type").notNull(), // pan_card, aadhar, salary_slip, bank_statement, etc.
  documentName: varchar("document_name").notNull(),
  documentCategory: varchar("document_category").notNull(), // identity, income, address, collateral
  fileName: varchar("file_name").notNull(),
  fileFormat: varchar("file_format").notNull(), // pdf, jpg, png
  fileSize: integer("file_size"), // in bytes
  objectStorageKey: varchar("object_storage_key"), // Reference to object storage
  status: varchar("status").default("uploaded"), // uploaded, processing, verified, rejected
  verificationStatus: varchar("verification_status").default("pending"), // pending, verified, rejected
  verificationNotes: text("verification_notes"),
  verifiedBy: varchar("verified_by"),
  verifiedAt: timestamp("verified_at"),
  providerDocumentId: varchar("provider_document_id"), // Provider's document reference
  sentToProvider: boolean("sent_to_provider").default(false),
  sentToProviderAt: timestamp("sent_to_provider_at"),
  isRequired: boolean("is_required").default(true),
  uploadedVia: varchar("uploaded_via").default("web"), // web, mobile, email, whatsapp
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ICICI Bank Specific Tables
export const iciciBankLoanApplications = pgTable("icici_bank_loan_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  applicationId: varchar("application_id").unique(), // ICICI application ID
  loanType: varchar("loan_type").notNull(), // personal/home/business/education/vehicle
  status: varchar("status").default("submitted"), // submitted/under_review/approved/rejected/pending_documents
  requestedAmount: decimal("requested_amount", { precision: 15, scale: 2 }).notNull(),
  sanctionedAmount: decimal("sanctioned_amount", { precision: 15, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
  tenure: integer("tenure"), // in months
  emi: decimal("emi", { precision: 15, scale: 2 }),
  processingFee: decimal("processing_fee", { precision: 15, scale: 2 }),
  applicantDetails: jsonb("applicant_details").notNull(),
  addressDetails: jsonb("address_details").notNull(),
  employmentDetails: jsonb("employment_details").notNull(),
  bankingDetails: jsonb("banking_details").notNull(),
  loanDetails: jsonb("loan_details").notNull(),
  documents: jsonb("documents").default([]),
  cibilConsent: boolean("cibil_consent").default(false),
  termsAccepted: boolean("terms_accepted").default(false),
  statusHistory: jsonb("status_history").default([]),
  applicationDate: timestamp("application_date").defaultNow(),
  expectedDecisionDate: timestamp("expected_decision_date"),
  decisionDate: timestamp("decision_date"),
  disbursementDate: timestamp("disbursement_date"),
  nextSteps: jsonb("next_steps").default([]),
  documentsRequired: jsonb("documents_required").default([]),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const iciciBankCreditScores = pgTable("icici_bank_credit_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  cibilScore: integer("cibil_score"),
  scoreDate: timestamp("score_date"),
  factors: jsonb("factors").default([]),
  recommendations: jsonb("recommendations").default([]),
  requestedAt: timestamp("requested_at").defaultNow(),
  panNumber: varchar("pan_number"),
  mobileNumber: varchar("mobile_number"),
  status: varchar("status").default("pending"), // pending/completed/failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Pre-Approved Loan Offers
export const preApprovedLoanOffers = pgTable("pre_approved_loan_offers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  lenderName: varchar("lender_name").notNull(),
  lenderLogo: varchar("lender_logo"),
  lenderType: varchar("lender_type").default("nbfc"),
  productType: varchar("product_type").notNull(),
  productName: varchar("product_name").notNull(),
  offerAmount: decimal("offer_amount", { precision: 15, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  processingFee: decimal("processing_fee", { precision: 15, scale: 2 }).default("0"),
  processingFeePercentage: decimal("processing_fee_percentage", { precision: 5, scale: 2 }),
  minTenureMonths: integer("min_tenure_months").notNull(),
  maxTenureMonths: integer("max_tenure_months").notNull(),
  defaultTenureMonths: integer("default_tenure_months").notNull(),
  monthlyEmi: decimal("monthly_emi", { precision: 15, scale: 2 }).notNull(),
  totalInterest: decimal("total_interest", { precision: 15, scale: 2 }),
  totalRepayment: decimal("total_repayment", { precision: 15, scale: 2 }),
  eligibilityStatus: varchar("eligibility_status").default("pre_approved"),
  eligibilityCriteria: jsonb("eligibility_criteria"),
  offerValidUntil: timestamp("offer_valid_until").notNull(),
  offerCode: varchar("offer_code"),
  features: jsonb("features"),
  benefits: text("benefits"),
  documentsRequired: jsonb("documents_required"),
  applicationStatus: varchar("application_status").default("not_started"),
  applicationId: varchar("application_id"),
  appliedAt: timestamp("applied_at"),
  approvedAt: timestamp("approved_at"),
  disbursedAt: timestamp("disbursed_at"),
  disbursedAmount: decimal("disbursed_amount", { precision: 15, scale: 2 }),
  displayPriority: integer("display_priority").default(0),
  isFeatured: boolean("is_featured").default(false),
  isRecommended: boolean("is_recommended").default(false),
  recommendationReason: text("recommendation_reason"),
  partnerOfferId: varchar("partner_offer_id"),
  partnerApiEndpoint: varchar("partner_api_endpoint"),
  partnerApplicationUrl: varchar("partner_application_url"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  viewedAt: timestamp("viewed_at"),
}, (table) => [
  index("idx_pre_approved_loan_offers_user").on(table.userId),
  index("idx_pre_approved_loan_offers_lender").on(table.lenderName),
  index("idx_pre_approved_loan_offers_product_type").on(table.productType),
  index("idx_pre_approved_loan_offers_eligibility").on(table.eligibilityStatus),
  index("idx_pre_approved_loan_offers_application").on(table.applicationStatus),
  index("idx_pre_approved_loan_offers_validity").on(table.offerValidUntil),
]);

// Credit Ratings history per ISIN
export const creditRatings = pgTable("credit_ratings", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  instrumentName: text("instrument_name"),
  rating: varchar("rating", { length: 20 }).notNull(),
  ratingOutlook: varchar("rating_outlook", { length: 30 }),
  agency: varchar("agency", { length: 30 }).notNull(),
  ratingDate: date("rating_date").notNull(),
  previousRating: varchar("previous_rating", { length: 20 }),
  ratingAction: varchar("rating_action", { length: 40 }),
  isCurrent: boolean("is_current").default(true),
  source: varchar("source", { length: 50 }).default("bonds_table"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_credit_ratings_isin").on(table.isin),
  index("idx_credit_ratings_agency").on(table.agency),
  index("idx_credit_ratings_date").on(table.ratingDate),
  index("idx_credit_ratings_current").on(table.isCurrent),
]);

// Insert schemas
export const insertLoanProductSchema = createInsertSchema(loanProducts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLoanProviderSchema = createInsertSchema(loanProviders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProviderProductSchema = createInsertSchema(providerProducts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCreditProfileSchema = createInsertSchema(creditProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLoanRequestSchema = createInsertSchema(loanRequests).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLoanOfferSchema = createInsertSchema(loanOffers).omit({ id: true, createdAt: true });
export const insertLoanApplicationMarketplaceSchema = createInsertSchema(loanApplicationsMarketplace).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProviderIntegrationSchema = createInsertSchema(providerIntegrations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplicationDocumentSchema = createInsertSchema(applicationDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertICICILoanApplicationSchema = createInsertSchema(iciciBankLoanApplications).omit({ id: true, createdAt: true, updatedAt: true });
export const insertICICICreditScoreSchema = createInsertSchema(iciciBankCreditScores).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPreApprovedLoanOfferSchema = createInsertSchema(preApprovedLoanOffers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCreditRatingSchema = createInsertSchema(creditRatings).omit({ id: true, createdAt: true });
export const insertLenderStaffHistorySchema = createInsertSchema(lenderStaffHistory as any);

// Export types
export type LoanProduct = typeof loanProducts.$inferSelect;
export type InsertLoanProduct = z.infer<typeof insertLoanProductSchema>;
export type LoanProvider = typeof loanProviders.$inferSelect;
export type InsertLoanProvider = z.infer<typeof insertLoanProviderSchema>;
export type ProviderProduct = typeof providerProducts.$inferSelect;
export type InsertProviderProduct = z.infer<typeof insertProviderProductSchema>;
export type CreditProfile = typeof creditProfiles.$inferSelect;
export type InsertCreditProfile = z.infer<typeof insertCreditProfileSchema>;
export type LoanRequest = typeof loanRequests.$inferSelect;
export type InsertLoanRequest = z.infer<typeof insertLoanRequestSchema>;
export type LoanOffer = typeof loanOffers.$inferSelect;
export type InsertLoanOffer = z.infer<typeof insertLoanOfferSchema>;
export type LoanApplicationMarketplace = typeof loanApplicationsMarketplace.$inferSelect;
export type InsertLoanApplicationMarketplace = z.infer<typeof insertLoanApplicationMarketplaceSchema>;
export type ProviderIntegration = typeof providerIntegrations.$inferSelect;
export type InsertProviderIntegration = z.infer<typeof insertProviderIntegrationSchema>;
export type ApplicationDocument = typeof applicationDocuments.$inferSelect;
export type InsertApplicationDocument = z.infer<typeof insertApplicationDocumentSchema>;
export type ICICILoanApplication = typeof iciciBankLoanApplications.$inferSelect;
export type InsertICICILoanApplication = z.infer<typeof insertICICILoanApplicationSchema>;
export type ICICICreditScore = typeof iciciBankCreditScores.$inferSelect;
export type InsertICICICreditScore = z.infer<typeof insertICICICreditScoreSchema>;
export type PreApprovedLoanOffer = typeof preApprovedLoanOffers.$inferSelect;
export type InsertPreApprovedLoanOffer = z.infer<typeof insertPreApprovedLoanOfferSchema>;
export type CreditRating = typeof creditRatings.$inferSelect;
export type InsertCreditRating = typeof creditRatings.$inferInsert;
export type LoanComparison = typeof loanComparisons.$inferSelect;
export type LenderStaffHistory = typeof lenderStaffHistory.$inferSelect;
export type InsertLenderStaffHistory = z.infer<typeof insertLenderStaffHistorySchema>;
