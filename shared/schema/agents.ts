import { sql } from "drizzle-orm";
import { boolean, date, decimal, index, integer, jsonb, numeric, pgTable, real, serial, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from './users';
import { agentBaskets } from './kyc';
import { partners } from './partners';

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_REGEX = /^[2-9]{1}[0-9]{11}$/;
const ARN_REGEX = /^ARN-[0-9]+$/;
const ICAI_MEMBERSHIP_REGEX = /^[0-9]{6}$/;
// --- Core Agent Master Tables ---

// Agents table
export const customerCareAgents = pgTable("customer_care_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: varchar("full_name").notNull(),
  email: varchar("email").unique().notNull(),
  phone: varchar("phone"),
  employeeId: varchar("employee_id").unique(),
  euinNumber: varchar("euin_number").unique(),
  arnCode: varchar("arn_code"),
  distributorId: varchar("distributor_id"),
  distributorName: varchar("distributor_name"), 
  password: text("password"),
  specializations: text("specializations").array().default([]),
  languages: text("languages").array().default(["en"]),
  productTypes: text("product_types").array().default([]),
  regulatoryCategory: varchar("regulatory_category").default("loan_dsa"),
  masterAgentId: varchar("master_agent_id"),
  agentLevel: varchar("agent_level").default("master"),
  hierarchyPath: varchar("hierarchy_path"),
  arnVerificationStatus: varchar("arn_verification_status").default("pending"),
  euinVerificationStatus: varchar("euin_verification_status").default("pending"),
  amfiVerifiedAt: timestamp("amfi_verified_at"),
  amfiVerificationResponse: jsonb("amfi_verification_response"),
  arnExpiryDate: timestamp("arn_expiry_date"),
  commissionSplitModel: varchar("commission_split_model").default("standard"),
  defaultCommissionShare: decimal("default_commission_share", { precision: 5, scale: 2 }).default("100.00"),
  masterAgentShare: decimal("master_agent_share", { precision: 5, scale: 2 }).default("0.00"),
  onboardingStatus: varchar("onboarding_status").default("pending"),
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),
  panNumber: varchar("pan_number", { length: 10 }),
  panName: varchar("pan_name"),
  aadharNumber: varchar("aadhar_number", { length: 12 }),
  aadharName: varchar("aadhar_name"),
  bankAccountNumber: varchar("bank_account_number"),
  bankIfscCode: varchar("bank_ifsc_code"),
  bankName: varchar("bank_name"),
  bankBranch: varchar("bank_branch"),
  accountHolderName: varchar("account_holder_name"),
  panVerified: boolean("pan_verified").default(false),
  aadharVerified: boolean("aadhar_verified").default(false),
  bankAccountVerified: boolean("bank_account_verified").default(false),
  amfiCertificateVerified: boolean("amfi_certificate_verified").default(false),
  euinCardVerified: boolean("euin_card_verified").default(false),
  status: varchar("status").default("active"),
  maxTicketsPerDay: integer("max_tickets_per_day").default(50),
  currentTicketCount: integer("current_ticket_count").default(0),
  totalTicketsHandled: integer("total_tickets_handled").default(0),
  averageResolutionTime: decimal("average_resolution_time", { precision: 8, scale: 2 }),
  customerSatisfactionRating: decimal("customer_satisfaction_rating", { precision: 3, scale: 2 }),
  totalClientsAssigned: integer("total_clients_assigned").default(0),
  activeClientsCount: integer("active_clients_count").default(0),
  totalCommissionsEarned: decimal("total_commissions_earned", { precision: 15, scale: 2 }).default("0.00"),
  totalCommissionsPaid: decimal("total_commissions_paid", { precision: 15, scale: 2 }).default("0.00"),
  pendingCommissions: decimal("pending_commissions", { precision: 15, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerCareAgentSchema = createInsertSchema(customerCareAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  panNumber: z.string().regex(PAN_REGEX, "Invalid PAN format").optional().nullable(),
  aadharNumber: z.string().regex(AADHAAR_REGEX, "Invalid Aadhaar format").optional().nullable(),
  arnCode: z.string().regex(ARN_REGEX, "Invalid ARN format (should be ARN-XXXXX)").optional().nullable(),
});

export const certificationQuizzes = pgTable("certification_quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  certificationLevel: varchar("certification_level", { length: 5 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  questions: jsonb("questions").default([]).notNull(),
  passingScore: integer("passing_score").default(70).notNull(),
  timeLimitMinutes: integer("time_limit_minutes").default(30),
  maxAttempts: integer("max_attempts").default(3),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_cq_level").on(table.certificationLevel),
]);

export const quizAttempts = pgTable("quiz_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id").references(() => certificationQuizzes.id).notNull(),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  answers: jsonb("answers").default([]),
  score: integer("score").notNull(),
  passed: boolean("passed").notNull(),
  timeTakenSeconds: integer("time_taken_seconds"),
  attemptNumber: integer("attempt_number").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_qa_quiz").on(table.quizId),
  index("idx_qa_agent").on(table.agentId),
]);

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts).omit({ id: true, createdAt: true });
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export const insertCertificationQuizSchema = createInsertSchema(certificationQuizzes).omit({ id: true, createdAt: true, updatedAt: true });
export type CertificationQuiz = typeof certificationQuizzes.$inferSelect;

// --- Auto-Migrated Tables ---
export const agentPartnerMappings = pgTable("agent_partner_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => customerCareAgents.id).notNull(),
  partnerId: varchar("partner_id").references(() => partners.id).notNull(),
  // Mapping details
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(1), // 1 = primary, 2 = secondary, etc.
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").references(() => users.id), // Admin who made the assignment
  createdAt: timestamp("created_at").defaultNow(),
});

export const agentCommissionSplits = pgTable("agent_commission_splits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subAgentId: varchar("sub_agent_id").references(() => customerCareAgents.id).notNull(),
  masterAgentId: varchar("master_agent_id").references(() => customerCareAgents.id).notNull(),
  
  // Split Configuration
  splitModel: varchar("split_model").default("percentage"), // percentage, fixed_amount, tiered
  productType: varchar("product_type"), // mutual_funds, insurance, loans, equity - null means all products
  
  // Percentage Split (most common)
  subAgentShare: decimal("sub_agent_share", { precision: 5, scale: 2 }).notNull(), // % for sub-agent
  masterAgentShare: decimal("master_agent_share", { precision: 5, scale: 2 }).notNull(), // % for master
  
  // Fixed Amount Split (optional)
  fixedSubAgentAmount: decimal("fixed_sub_agent_amount", { precision: 10, scale: 2 }),
  fixedMasterAmount: decimal("fixed_master_amount", { precision: 10, scale: 2 }),
  
  // Tiered Split (based on volume)
  tieredRules: jsonb("tiered_rules"), // [{minVolume: 0, maxVolume: 100000, subShare: 60, masterShare: 40}, ...]
  
  // Validity
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  effectiveTo: timestamp("effective_to"),
  isActive: boolean("is_active").default(true),
  
  // Audit
  createdBy: varchar("created_by").references(() => users.id),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentDocuments = pgTable("agent_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => customerCareAgents.id).notNull(),
  
  // Document Details
  documentType: varchar("document_type").notNull(), // pan_card, aadhar_card, amfi_certificate, euin_card, bank_proof, cancelled_cheque
  documentName: varchar("document_name").notNull(),
  documentUrl: text("document_url").notNull(), // Object storage URL
  documentNumber: varchar("document_number"), // PAN number, Aadhar number, etc.
  
  // Verification Status
  verificationStatus: varchar("verification_status").default("pending"), // pending, verified, rejected
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),
  
  // Metadata
  fileSize: integer("file_size"), // in bytes
  mimeType: varchar("mime_type"),
  uploadedFrom: varchar("uploaded_from"), // web, mobile, admin
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentCommissions = pgTable("agent_commissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => customerCareAgents.id).notNull(),
  masterAgentId: varchar("master_agent_id").references(() => customerCareAgents.id), // Null if this is master agent
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  // Transaction Reference
  orderId: varchar("order_id").notNull(), // Link to unified_orders or product-specific order
  productType: varchar("product_type").notNull(), // mutual_funds, insurance, loans, equity
  transactionType: varchar("transaction_type").notNull(), // purchase, sip, renewal, redemption
  
  // Amount Breakdown
  transactionAmount: decimal("transaction_amount", { precision: 15, scale: 2 }).notNull(),
  totalCommissionAmount: decimal("total_commission_amount", { precision: 15, scale: 2 }).notNull(), // Total commission on transaction
  
  // Agent's Share
  agentCommissionRate: decimal("agent_commission_rate", { precision: 5, scale: 2 }).notNull(),
  agentCommissionAmount: decimal("agent_commission_amount", { precision: 15, scale: 2 }).notNull(),
  agentTdsAmount: decimal("agent_tds_amount", { precision: 15, scale: 2 }).default("0.00"),
  agentNetCommission: decimal("agent_net_commission", { precision: 15, scale: 2 }).notNull(),
  
  // Master Agent's Share (if applicable)
  masterCommissionRate: decimal("master_commission_rate", { precision: 5, scale: 2 }).default("0.00"),
  masterCommissionAmount: decimal("master_commission_amount", { precision: 15, scale: 2 }).default("0.00"),
  masterTdsAmount: decimal("master_tds_amount", { precision: 15, scale: 2 }).default("0.00"),
  masterNetCommission: decimal("master_net_commission", { precision: 15, scale: 2 }).default("0.00"),
  
  // Split Rule Applied
  splitRuleId: varchar("split_rule_id").references(() => agentCommissionSplits.id),
  
  // Settlement Status
  agentSettlementStatus: varchar("agent_settlement_status").default("pending"), // pending, settled, cancelled
  masterSettlementStatus: varchar("master_settlement_status").default("pending"),
  agentSettledAt: timestamp("agent_settled_at"),
  masterSettledAt: timestamp("master_settled_at"),
  
  // Metadata
  transactionDate: timestamp("transaction_date").notNull().defaultNow(),
  month: varchar("month").notNull(), // YYYY-MM
  financialYear: varchar("financial_year"), // FY2024-25
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // Optional link to user account
  
  // Personal Information
  fullName: varchar("full_name").notNull(),
  email: varchar("email").unique().notNull(),
  phone: varchar("phone"),
  address: text("address"),
  
  // Agent Identification
  employeeId: varchar("employee_id").unique(), // Internal employee/agent ID
  arnCode: varchar("arn_code"), // AMFI Registration Number for MF distributors
  euinNumber: varchar("euin_number"), // Employee Unique Identification Number
  pospNumber: varchar("posp_number"), // Point of Sales Person for insurance
  dsaCode: varchar("dsa_code"), // Direct Selling Agent code for loans
  
  // KYC & Bank Details
  panNumber: varchar("pan_number"),
  aadharNumber: varchar("aadhar_number"),
  bankAccountNumber: varchar("bank_account_number"),
  ifscCode: varchar("ifsc_code"),
  upiId: varchar("upi_id"),
  
  // Agent Type and Status
  agentType: varchar("agent_type").default("individual"), // individual, corporate, sub_broker
  status: varchar("status").default("active"), // active, inactive, suspended, terminated
  isActive: boolean("is_active").default(true),
  
  // Performance Metrics
  activeClients: integer("active_clients").default(0),
  totalClients: integer("total_clients").default(0),
  totalRevenue: decimal("total_revenue", { precision: 15, scale: 2 }).default("0.00"),
  monthlyRevenue: decimal("monthly_revenue", { precision: 15, scale: 2 }).default("0.00"),
  totalCommissionsEarned: decimal("total_commissions_earned", { precision: 15, scale: 2 }).default("0.00"),
  
  // Hierarchy and Reporting
  reportingTo: varchar("reporting_to"), // Manager/supervisor agent ID - self-reference
  teamSize: integer("team_size").default(0), // Number of agents reporting to this agent
  hierarchyLevel: integer("hierarchy_level").default(1), // 1 = frontline, 2 = team lead, 3 = manager, etc.
  
  // Joining and Contract Details
  joiningDate: timestamp("joining_date"),
  terminationDate: timestamp("termination_date"),
  contractType: varchar("contract_type").default("full_time"), // full_time, part_time, freelance, commission_only
  
  // Commission Structure
  commissionTier: varchar("commission_tier").default("standard"), // standard, silver, gold, platinum
  baseCommissionRate: decimal("base_commission_rate", { precision: 5, scale: 2 }).default("0.00"), // Base % commission
  
  // Marketing Profile - for festival greetings and marketing materials
  marketingName: varchar("marketing_name"), // Display name for marketing materials
  marketingDesignation: varchar("marketing_designation"), // Display designation
  marketingEmail: varchar("marketing_email"), // Contact email for marketing
  marketingPhone: varchar("marketing_phone"), // Contact phone for marketing
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  panNumber: z.string().regex(PAN_REGEX, "Invalid PAN format").optional().nullable(),
  aadharNumber: z.string().regex(AADHAAR_REGEX, "Invalid Aadhaar format").optional().nullable(),
  arnCode: z.string().regex(ARN_REGEX, "Invalid ARN format (should be ARN-XXXXX)").optional().nullable(),
});

export const agentOverrideAuditLog = pgTable("agent_override_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Agent identification
  agentId: varchar("agent_id").notNull(),
  agentName: varchar("agent_name"),
  
  // Client context
  clientId: varchar("client_id").notNull(),
  basketId: varchar("basket_id"),
  
  // Override details
  overrideType: varchar("override_type").notNull(), // mode_downgrade, asset_class_lock, allocation_cap
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  reason: text("reason").notNull(),
  
  // Mode context
  originalMode: varchar("original_mode").notNull(), // conservative, balanced, growth
  overriddenMode: varchar("overridden_mode"),
  
  // Scoring snapshot (immutable at time of override)
  scoringSnapshot: jsonb("scoring_snapshot").$type<{
    suitabilityScore: number;
    upsideScore: number;
    finalScore: number;
    productId?: string;
    productType?: string;
  }>(),
  
  // Compliance metadata
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  complianceFlag: boolean("compliance_flag").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_override_agent").on(table.agentId),
  index("idx_agent_override_client").on(table.clientId),
  index("idx_agent_override_type").on(table.overrideType),
  index("idx_agent_override_created").on(table.createdAt),
]);

// A/B Testing Experiment State - Persistent kill switch and config
export const abTestingExperimentState = pgTable("ab_testing_experiment_state", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  experimentId: varchar("experiment_id").notNull().unique(),
  experimentName: varchar("experiment_name").notNull(),
  
  // Kill switch state
  isActive: boolean("is_active").default(true).notNull(),
  killSwitchActivated: boolean("kill_switch_activated").default(false).notNull(),
  killSwitchActivatedAt: timestamp("kill_switch_activated_at"),
  killSwitchActivatedBy: varchar("kill_switch_activated_by"),
  killSwitchReason: text("kill_switch_reason"),
  
  // Experiment configuration
  controlGroup: varchar("control_group").default("balanced"),
  treatmentGroup: varchar("treatment_group").default("growth"),
  trafficAllocation: integer("traffic_allocation").default(50), // Percentage to treatment
  
  // Safety thresholds
  safetyThresholds: jsonb("safety_thresholds").$type<{
    maxAcceptanceRateDiff: number;
    maxAllocationDiff: number;
    minSampleSize: number;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ab_experiment_id").on(table.experimentId),
  index("idx_ab_experiment_active").on(table.isActive),
]);

// A/B Testing Metrics Collection
export const abTestingMetrics = pgTable("ab_testing_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  experimentId: varchar("experiment_id").notNull(),
  userId: varchar("user_id").notNull(),
  
  // Assignment info
  assignedGroup: varchar("assigned_group").notNull(), // control or treatment
  assignedMode: varchar("assigned_mode").notNull(), // balanced or growth
  
  // Engagement metrics
  recommendationsViewed: integer("recommendations_viewed").default(0),
  recommendationsAccepted: integer("recommendations_accepted").default(0),
  totalAllocationAmount: decimal("total_allocation_amount", { precision: 18, scale: 2 }).default("0"),
  timeToDecisionMs: integer("time_to_decision_ms"),
  
  // Outcome tracking
  sessionStartedAt: timestamp("session_started_at").defaultNow(),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ab_metrics_experiment").on(table.experimentId),
  index("idx_ab_metrics_user").on(table.userId),
  index("idx_ab_metrics_group").on(table.assignedGroup),
]);

// Insert schemas for profit-optimized tables
export const insertAgentOverrideAuditLogSchema = createInsertSchema(agentOverrideAuditLog).omit({ id: true, createdAt: true });

export type AgentOverrideAuditLog = typeof agentOverrideAuditLog.$inferSelect;

export type InsertAgentOverrideAuditLog = z.infer<typeof insertAgentOverrideAuditLogSchema>;

export const agentPerformanceMetrics = pgTable("agent_performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull(),
  agentName: varchar("agent_name"),
  
  // Time period
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  periodType: varchar("period_type").notNull(), // daily, weekly, monthly, quarterly
  
  // Recommendation metrics
  totalRecommendations: integer("total_recommendations").default(0),
  acceptedRecommendations: integer("accepted_recommendations").default(0),
  rejectedRecommendations: integer("rejected_recommendations").default(0),
  pendingRecommendations: integer("pending_recommendations").default(0),
  
  // Mode usage
  conservativeModeCount: integer("conservative_mode_count").default(0),
  balancedModeCount: integer("balanced_mode_count").default(0),
  growthModeCount: integer("growth_mode_count").default(0),
  
  // Override metrics
  totalOverrides: integer("total_overrides").default(0),
  modeDowngradeOverrides: integer("mode_downgrade_overrides").default(0),
  assetClassLockOverrides: integer("asset_class_lock_overrides").default(0),
  allocationCapOverrides: integer("allocation_cap_overrides").default(0),
  
  // Compliance metrics
  complianceViolations: integer("compliance_violations").default(0),
  clientComplaints: integer("client_complaints").default(0),
  
  // AUM and revenue
  totalAumManaged: decimal("total_aum_managed", { precision: 18, scale: 2 }).default("0"),
  newAumBrought: decimal("new_aum_brought", { precision: 18, scale: 2 }).default("0"),
  totalCommissionEarned: decimal("total_commission_earned", { precision: 18, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_perf_agent").on(table.agentId),
  index("idx_agent_perf_period").on(table.periodStart, table.periodEnd),
  index("idx_agent_perf_type").on(table.periodType),
]);

// Agent Portfolio Outcomes - Ex-post performance attribution
export const agentPortfolioOutcomes = pgTable("agent_portfolio_outcomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull(),
  clientId: varchar("client_id").notNull(),
  proposalId: varchar("proposal_id"),
  
  // Performance metrics
  portfolioIrr: decimal("portfolio_irr", { precision: 8, scale: 4 }),
  benchmarkReturn: decimal("benchmark_return", { precision: 8, scale: 4 }),
  excessReturn: decimal("excess_return", { precision: 8, scale: 4 }),
  
  // Risk metrics
  upsideCaptureRatio: decimal("upside_capture_ratio", { precision: 8, scale: 4 }),
  downsideCaptureRatio: decimal("downside_capture_ratio", { precision: 8, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }),
  portfolioVolatility: decimal("portfolio_volatility", { precision: 8, scale: 4 }),
  
  // Client risk band comparison
  clientRiskProfile: varchar("client_risk_profile"), // conservative, moderate, aggressive
  actualRiskLevel: varchar("actual_risk_level"),
  withinRiskBand: boolean("within_risk_band").default(true),
  
  // Benchmark info
  benchmarkUsed: varchar("benchmark_used"), // NIFTY_50, CRISIL_COMPOSITE_BOND, etc.
  evaluationPeriodMonths: integer("evaluation_period_months"),
  
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  dataAsOfDate: date("data_as_of_date"),
}, (table) => [
  index("idx_portfolio_outcome_agent").on(table.agentId),
  index("idx_portfolio_outcome_client").on(table.clientId),
]);

// Agent Certification & Training
export const agentCertifications = pgTable("agent_certifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  agentId: varchar("agent_id").notNull(),
  
  // Certification type
  certificationType: varchar("certification_type").notNull(), // growth_optimized, advanced_advisory, compliance_expert
  certificationName: varchar("certification_name").notNull(),
  
  // Training completion
  trainingCompletedAt: timestamp("training_completed_at"),
  trainingModulesCompleted: integer("training_modules_completed").default(0),
  totalTrainingModules: integer("total_training_modules").default(0),
  
  // Quiz results
  quizAttempts: integer("quiz_attempts").default(0),
  quizPassedAt: timestamp("quiz_passed_at"),
  quizScore: integer("quiz_score"), // Percentage
  passingScore: integer("passing_score").default(80),
  
  // Certification status
  isCertified: boolean("is_certified").default(false),
  certifiedAt: timestamp("certified_at"),
  expiresAt: timestamp("expires_at"),
  
  // Revocation
  isRevoked: boolean("is_revoked").default(false),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_cert_agent").on(table.agentId),
  index("idx_agent_cert_type").on(table.certificationType),
  index("idx_agent_cert_status").on(table.isCertified),
]);

// Agent Compliance Document Repository (for SEBI inspection-ready docs)
export const insertAgentPerformanceMetricsSchema = createInsertSchema(agentPerformanceMetrics).omit({ id: true, createdAt: true, updatedAt: true });
export type AgentPerformanceMetrics = typeof agentPerformanceMetrics.$inferSelect;
export type InsertAgentPerformanceMetrics = z.infer<typeof insertAgentPerformanceMetricsSchema>;

export const insertAgentPortfolioOutcomesSchema = createInsertSchema(agentPortfolioOutcomes).omit({ id: true, calculatedAt: true });

export type AgentPortfolioOutcomes = typeof agentPortfolioOutcomes.$inferSelect;

export type InsertAgentPortfolioOutcomes = z.infer<typeof insertAgentPortfolioOutcomesSchema>;

export const insertAgentCertificationsSchema = createInsertSchema(agentCertifications).omit({ id: true, createdAt: true, updatedAt: true });

export type AgentCertifications = typeof agentCertifications.$inferSelect;

export type InsertAgentCertifications = z.infer<typeof insertAgentCertificationsSchema>;

export const agentLeads = pgTable("agent_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Agent assignment
  agentId: varchar("agent_id").references(() => users.id),
  
  // Lead details
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  
  // Pipeline stage
  stage: varchar("stage").notNull().default("new"), // new, contacted, proposal_sent, negotiating, converted, lost
  
  // Lead source and scoring
  source: varchar("source").default("manual"), // website, referral, linkedin, event, cold_call, manual
  potentialValue: numeric("potential_value").default("0"),
  score: integer("score").default(50), // 0-100 lead score
  
  // Notes and follow-ups
  notes: text("notes"),
  lastContactAt: timestamp("last_contact_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  
  // Tags for categorization
  tags: text("tags").array(),
  
  // Conversion tracking
  convertedToUserId: varchar("converted_to_user_id").references(() => users.id),
  convertedAt: timestamp("converted_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_agent_leads_agent").on(table.agentId),
  index("idx_agent_leads_stage").on(table.stage),
  index("idx_agent_leads_created").on(table.createdAt),
]);

export const insertAgentLeadSchema = createInsertSchema(agentLeads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const agentItrCases = pgTable("agent_itr_cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  caId: varchar("ca_id").references(() => users.id), // Assigned Chartered Accountant
  
  // Assessment Year
  assessmentYear: varchar("assessment_year").notNull(), // e.g., "2024-25"
  financialYear: varchar("financial_year").notNull(), // e.g., "2023-24"
  
  // ITR Details
  itrFormType: varchar("itr_form_type"), // ITR-1, ITR-2, ITR-3, ITR-4
  filingType: varchar("filing_type").default("original"), // original, revised, belated
  
  // Status Workflow
  status: varchar("status").default("initiated").notNull(), // initiated, documents_pending, documents_received, under_review, ca_assigned, processing, filed, acknowledged, completed
  subStatus: varchar("sub_status"), // more granular status
  
  // Income Details (Pre-filled from portfolio)
  salaryIncome: decimal("salary_income", { precision: 15, scale: 2 }).default("0"),
  interestIncome: decimal("interest_income", { precision: 15, scale: 2 }).default("0"),
  dividendIncome: decimal("dividend_income", { precision: 15, scale: 2 }).default("0"),
  capitalGainsStcg: decimal("capital_gains_stcg", { precision: 15, scale: 2 }).default("0"),
  capitalGainsLtcg: decimal("capital_gains_ltcg", { precision: 15, scale: 2 }).default("0"),
  businessIncome: decimal("business_income", { precision: 15, scale: 2 }).default("0"),
  otherIncome: decimal("other_income", { precision: 15, scale: 2 }).default("0"),
  totalGrossIncome: decimal("total_gross_income", { precision: 15, scale: 2 }).default("0"),
  
  // Deductions
  section80c: decimal("section_80c", { precision: 15, scale: 2 }).default("0"),
  section80d: decimal("section_80d", { precision: 15, scale: 2 }).default("0"),
  otherDeductions: decimal("other_deductions", { precision: 15, scale: 2 }).default("0"),
  totalDeductions: decimal("total_deductions", { precision: 15, scale: 2 }).default("0"),
  
  // Tax Computation
  taxableIncome: decimal("taxable_income", { precision: 15, scale: 2 }).default("0"),
  taxRegime: varchar("tax_regime").default("new"), // old, new
  taxPayable: decimal("tax_payable", { precision: 15, scale: 2 }).default("0"),
  tdsPaid: decimal("tds_paid", { precision: 15, scale: 2 }).default("0"),
  advanceTaxPaid: decimal("advance_tax_paid", { precision: 15, scale: 2 }).default("0"),
  selfAssessmentTax: decimal("self_assessment_tax", { precision: 15, scale: 2 }).default("0"),
  refundOrDue: decimal("refund_or_due", { precision: 15, scale: 2 }).default("0"),
  
  // Documents Tracking
  documentsRequired: jsonb("documents_required").$type<string[]>().default([]),
  documentsReceived: jsonb("documents_received").$type<string[]>().default([]),
  documentsMissing: jsonb("documents_missing").$type<string[]>().default([]),
  
  // Filing Details
  itrAcknowledgementNo: varchar("itr_acknowledgement_no"),
  itrFiledDate: timestamp("itr_filed_date"),
  itrVerificationStatus: varchar("itr_verification_status"), // pending, verified
  itrVerificationMethod: varchar("itr_verification_method"), // aadhaar_otp, net_banking, dsc, manual
  itrVerifiedDate: timestamp("itr_verified_date"),
  
  // Fee Structure
  serviceFee: decimal("service_fee", { precision: 10, scale: 2 }).default("0"),
  caFee: decimal("ca_fee", { precision: 10, scale: 2 }).default("0"),
  totalFee: decimal("total_fee", { precision: 10, scale: 2 }).default("0"),
  feeStatus: varchar("fee_status").default("pending"), // pending, paid, waived
  
  // Communication
  clientQueries: jsonb("client_queries").$type<{query: string; response?: string; askedAt: string; respondedAt?: string}[]>().default([]),
  internalNotes: jsonb("internal_notes").$type<{note: string; by: string; at: string}[]>().default([]),
  
  // Priority & SLA
  priority: varchar("priority").default("normal"), // low, normal, high, urgent
  dueDate: timestamp("due_date"),
  slaBreached: boolean("sla_breached").default(false),
  
  // Source tracking
  sourceProduct: varchar("source_product"), // stocks, mutual_funds, bonds, unlisted, etc.
  referralCode: varchar("referral_code"),
  
  // Zoho Books Sync
  zohoSyncedAt: timestamp("zoho_synced_at"),
  zohoInvoiceId: varchar("zoho_invoice_id"),
  zohoBillId: varchar("zoho_bill_id"), // For CA payout
  zohoSyncStatus: varchar("zoho_sync_status"), // pending, synced, failed, pass_through
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_agent_itr_cases_client").on(table.clientId),
  index("idx_agent_itr_cases_agent").on(table.agentId),
  index("idx_agent_itr_cases_ca").on(table.caId),
  index("idx_agent_itr_cases_status").on(table.status),
  index("idx_agent_itr_cases_ay").on(table.assessmentYear),
]);


// ITR Filing Pricing Configuration
export const itrPricingConfig = pgTable("itr_pricing_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // ITR Form Type
  itrFormType: varchar("itr_form_type").notNull().unique(), // ITR-1, ITR-2, ITR-3, ITR-4, ITR-5, ITR-6, ITR-7
  displayName: varchar("display_name").notNull(),
  description: text("description"),
  
  // Self-File Pricing
  selfFileFee: decimal("self_file_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  selfFileGst: decimal("self_file_gst", { precision: 10, scale: 2 }).default("0"),
  
  // CA-Assisted Pricing
  caAssistedFee: decimal("ca_assisted_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  caAssistedGst: decimal("ca_assisted_gst", { precision: 10, scale: 2 }).default("0"),
  caRevenueSharePercent: decimal("ca_revenue_share_percent", { precision: 5, scale: 2 }).default("50"), // 50-80%
  
  // Expert Consultation
  expertConsultationFee: decimal("expert_consultation_fee", { precision: 10, scale: 2 }).default("0"),
  
  // Rush/Priority Charges
  rushFilingFee: decimal("rush_filing_fee", { precision: 10, scale: 2 }).default("0"),
  lateFeeMultiplier: decimal("late_fee_multiplier", { precision: 4, scale: 2 }).default("1.0"), // Multiplier for late filing
  
  // Complexity Factors
  complexityLevel: varchar("complexity_level").default("standard"), // simple, standard, complex
  estimatedProcessingDays: integer("estimated_processing_days").default(3),
  
  // Eligibility
  eligibleForSelfFile: boolean("eligible_for_self_file").default(true),
  requiresCa: boolean("requires_ca").default(false),
  
  // Status
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  index("idx_itr_pricing_form_type").on(table.itrFormType),
  index("idx_itr_pricing_active").on(table.isActive),
]);

export const insertItrPricingConfigSchema = createInsertSchema(itrPricingConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const agentItrDocuments = pgTable("agent_itr_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => agentItrCases.id).notNull(),
  
  // Document Details
  documentType: varchar("document_type").notNull(), // form_16, form_16a, form_26as, ais, capital_gains_statement, bank_statement, rent_receipt, investment_proof, other
  documentName: varchar("document_name").notNull(),
  documentUrl: text("document_url"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type"),
  
  // Status
  status: varchar("status").default("uploaded"), // uploaded, under_review, accepted, rejected
  reviewNotes: text("review_notes"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  
  // Auto-parsed data (if applicable)
  parsedData: jsonb("parsed_data"),
  parsingStatus: varchar("parsing_status"), // pending, completed, failed
  
  // Timestamps
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_itr_docs_case").on(table.caseId),
  index("idx_agent_itr_docs_type").on(table.documentType),
]);

// ITR Case Activity Log
export const agentItrActivityLog = pgTable("agent_itr_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseId: varchar("case_id").references(() => agentItrCases.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Activity Details
  activityType: varchar("activity_type").notNull(), // status_change, document_upload, ca_assigned, query_added, note_added, fee_updated, filed, verified
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  description: text("description"),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  // Timestamp
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_itr_activity_case").on(table.caseId),
  index("idx_agent_itr_activity_type").on(table.activityType),
]);

// CA (Chartered Accountant) Profiles for ITR Services
export const caProfiles = pgTable("ca_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // Professional Details
  membershipNumber: varchar("membership_number").notNull(), // ICAI membership number
  membershipType: varchar("membership_type").notNull(), // ACA (Associate) or FCA (Fellow)
  certificateOfPracticeNumber: varchar("cop_number"),
  
  // Personal Details
  fullName: varchar("full_name").notNull(),
  email: varchar("email").notNull(),
  mobile: varchar("mobile"),
  
  // Specializations
  specializations: jsonb("specializations").$type<string[]>().default([]), // income_tax, gst, audit, company_law
  
  // Capacity & Workload
  maxCasesPerMonth: integer("max_cases_per_month").default(50),
  currentCaseCount: integer("current_case_count").default(0),
  isAvailable: boolean("is_available").default(true),
  
  // Rating
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("5.00"),
  totalReviews: integer("total_reviews").default(0),
  
  // Fee Structure
  baseFeeItr1: decimal("base_fee_itr1", { precision: 10, scale: 2 }).default("500"),
  baseFeeItr2: decimal("base_fee_itr2", { precision: 10, scale: 2 }).default("1500"),
  baseFeeItr3: decimal("base_fee_itr3", { precision: 10, scale: 2 }).default("3000"),
  baseFeeItr4: decimal("base_fee_itr4", { precision: 10, scale: 2 }).default("2000"),
  
  // Status
  status: varchar("status").default("active"), // active, inactive, suspended
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ca_profiles_user").on(table.userId),
  index("idx_ca_profiles_membership").on(table.membershipNumber),
  index("idx_ca_profiles_available").on(table.isAvailable),
]);

export const insertCaProfileSchema = createInsertSchema(caProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  membershipNumber: z.string().regex(ICAI_MEMBERSHIP_REGEX, "Invalid ICAI Membership Number (6 digits required)"),
});

// Insert schemas and types for Agent ITR Filing
export const insertAgentItrCaseSchema = createInsertSchema(agentItrCases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const agentAppointments = pgTable("agent_appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  clientId: varchar("client_id").references(() => users.id),
  
  title: varchar("title").notNull(),
  description: text("description"),
  
  meetingType: varchar("meeting_type").notNull(), // call, video_call, in_person, office_visit
  
  date: date("date").notNull(),
  startTime: varchar("start_time").notNull(), // HH:MM format
  endTime: varchar("end_time").notNull(), // HH:MM format
  duration: integer("duration").notNull(), // in minutes: 15, 30, 45, 60
  
  location: varchar("location"), // virtual, office, client_site
  locationDetails: text("location_details"), // meeting link or address
  
  reminder: varchar("reminder").default("30min"), // none, 15min, 30min, 1hr
  reminderSent: boolean("reminder_sent").default(false),
  
  status: varchar("status").default("scheduled"), // scheduled, completed, cancelled, no_show
  
  notes: text("notes"),
  agenda: text("agenda"),
  
  clientName: varchar("client_name"),
  clientEmail: varchar("client_email"),
  clientPhone: varchar("client_phone"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_agent_appointments_agent").on(table.agentId),
  index("idx_agent_appointments_client").on(table.clientId),
  index("idx_agent_appointments_date").on(table.date),
  index("idx_agent_appointments_status").on(table.status),
]);

export const insertAgentAppointmentSchema = createInsertSchema(agentAppointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
});

export const agentClientMappingRequests = pgTable("agent_client_mapping_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Agent making the request
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  agentName: varchar("agent_name"),
  
  // Client/User being requested for mapping
  clientId: varchar("client_id").references(() => users.id),
  
  // Identification details used for matching
  clientPan: varchar("client_pan"),
  clientEmail: varchar("client_email"),
  clientMobile: varchar("client_mobile"),
  clientName: varchar("client_name"),
  
  // Current assignment (if any)
  currentAgentId: varchar("current_agent_id").references(() => users.id),
  currentAgentName: varchar("current_agent_name"),
  
  // Request status
  status: varchar("status").notNull().default("pending"), // pending, approved, rejected
  
  // Request metadata
  requestReason: text("request_reason"),
  
  // Admin action
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  
  // Notification tracking
  agentNotifiedAt: timestamp("agent_notified_at"),
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mapping_requests_agent").on(table.agentId),
  index("idx_mapping_requests_client").on(table.clientId),
  index("idx_mapping_requests_status").on(table.status),
  index("idx_mapping_requests_pan").on(table.clientPan),
]);

export const insertAgentClientMappingRequestSchema = createInsertSchema(agentClientMappingRequests).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  clientPan: z.string().regex(PAN_REGEX, "Invalid PAN format").optional().nullable(),
});

export const agentBasketItems = pgTable("agent_basket_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  basketId: uuid("basket_id").notNull().references(() => agentBaskets.id, { onDelete: "cascade" }),
  instrumentType: varchar("instrument_type", { length: 50 }).notNull().default("stock"),
  symbol: varchar("symbol", { length: 50 }),
  isin: varchar("isin", { length: 20 }),
  name: text("name").notNull(),
  allocationPercent: numeric("allocation_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_basket_items_basket").on(table.basketId),
]);

export type AgentBasketItem = typeof agentBasketItems.$inferSelect;
export type InsertAgentBasketItem = typeof agentBasketItems.$inferInsert;
export const insertAgentBasketItemSchema = createInsertSchema(agentBasketItems).omit({ id: true, addedAt: true });
