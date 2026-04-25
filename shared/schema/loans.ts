import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal, date, serial, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { Product } from '../schema';
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
