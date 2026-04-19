import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, index, integer, jsonb, decimal, date } from "drizzle-orm/pg-core";
import { users } from "./users";
 // For cross-module references if needed, or better define it in its own module

export const financialGoals = pgTable("financial_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  name: varchar("name").notNull(),
  description: text("description"),
  goalType: varchar("goal_type").notNull(),
  category: varchar("category").notNull(),
  icon: varchar("icon").default("target"),
  color: varchar("color").default("#3b82f6"),
  targetAmount: decimal("target_amount", { precision: 15, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }).default("0"),
  monthlyContribution: decimal("monthly_contribution", { precision: 10, scale: 2 }).default("0"),
  targetDate: timestamp("target_date").notNull(),
  startDate: timestamp("start_date").defaultNow(),
  inflationRate: decimal("inflation_rate", { precision: 5, scale: 2 }).default("6"),
  inflationAdjustedTarget: decimal("inflation_adjusted_target", { precision: 15, scale: 2 }),
  suggestedSipAmount: decimal("suggested_sip_amount", { precision: 10, scale: 2 }),
  suggestedLumpsum: decimal("suggested_lumpsum", { precision: 15, scale: 2 }),
  expectedReturnRate: decimal("expected_return_rate", { precision: 5, scale: 2 }).default("12"),
  suggestedAllocation: jsonb("suggested_allocation").$type<{
    equity: number;
    debt: number;
    gold: number;
    cash: number;
  }>(),
  riskProfile: varchar("risk_profile").notNull(),
  priority: varchar("priority").default("medium"),
  recommendedInvestments: text("recommended_investments").array(),
  currentProgress: decimal("current_progress", { precision: 5, scale: 2 }).default("0"),
  projectedValue: decimal("projected_value", { precision: 15, scale: 2 }),
  onTrackStatus: varchar("on_track_status").default("on_track"),
  isActive: boolean("is_active").default(true),
  isCompleted: boolean("is_completed").default(false),
  completedAt: timestamp("completed_at"),
  tags: text("tags").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_financial_goals_user").on(table.userId),
  index("idx_financial_goals_category").on(table.category),
  index("idx_financial_goals_status").on(table.onTrackStatus),
]);

export const goalMilestones = pgTable("goal_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => financialGoals.id, { onDelete: "cascade" }).notNull(),
  name: varchar("name").notNull(),
  description: text("description"),
  targetPercentage: decimal("target_percentage", { precision: 5, scale: 2 }).notNull(),
  targetAmount: decimal("target_amount", { precision: 15, scale: 2 }).notNull(),
  targetDate: timestamp("target_date"),
  isAchieved: boolean("is_achieved").default(false),
  achievedAt: timestamp("achieved_at"),
  achievedAmount: decimal("achieved_amount", { precision: 15, scale: 2 }),
  notifyOnAchieve: boolean("notify_on_achieve").default(true),
  celebrationType: varchar("celebration_type").default("confetti"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_goal_milestones_goal").on(table.goalId),
]);

export const goalInvestmentLinks = pgTable("goal_investment_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => financialGoals.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  investmentType: varchar("investment_type").notNull(),
  investmentId: varchar("investment_id"),
  isin: varchar("isin"),
  schemeName: varchar("scheme_name"),
  folioNumber: varchar("folio_number"),
  allocationPercentage: decimal("allocation_percentage", { precision: 5, scale: 2 }).default("100"),
  allocatedAmount: decimal("allocated_amount", { precision: 15, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_goal_invest_goal").on(table.goalId),
  index("idx_goal_invest_user").on(table.userId),
]);

export const goalProgressSnapshots = pgTable("goal_progress_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").references(() => financialGoals.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id),
  snapshotDate: date("snapshot_date").notNull(),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }).notNull(),
  targetAmount: decimal("target_amount", { precision: 15, scale: 2 }),
  progressPercent: decimal("progress_percent", { precision: 5, scale: 2 }),
  onTrackStatus: varchar("on_track_status"),
  projectedValue: decimal("projected_value", { precision: 15, scale: 2 }),
  monthlyContribution: decimal("monthly_contribution", { precision: 15, scale: 2 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_goal_progress_goal").on(table.goalId),
  index("idx_goal_progress_date").on(table.snapshotDate),
]);

export const clientRiskProfiles = pgTable("client_risk_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  riskCategory: varchar("risk_category").notNull().default("moderate"),
  riskScore: integer("risk_score"),
  timeHorizonYears: integer("time_horizon_years").default(5),
  liquidityNeed: varchar("liquidity_need").default("medium"),
  taxBracket: varchar("tax_bracket"),
  investmentObjectives: jsonb("investment_objectives").$type<string[]>().default([]),
  productRestrictions: jsonb("product_restrictions").$type<string[]>().default([]),
  maxEquityExposure: integer("max_equity_exposure"),
  maxSingleStockExposure: integer("max_single_stock_exposure").default(15),
  maxSingleAmcExposure: integer("max_single_amc_exposure").default(25),
  isAccreditedInvestor: boolean("is_accredited_investor").default(false),
  isPmsEligible: boolean("is_pms_eligible").default(false),
  isAifEligible: boolean("is_aif_eligible").default(false),
  lastAssessedAt: timestamp("last_assessed_at").defaultNow(),
  assessmentMethod: varchar("assessment_method").default("questionnaire"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_client_risk_profiles_user").on(table.userId),
  index("idx_client_risk_profiles_category").on(table.riskCategory),
]);

export const advisorySessions = pgTable("advisory_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  proposalId: varchar("proposal_id"), // Ideally references investmentProposals.id
  sessionPurpose: varchar("session_purpose").notNull(),
  sessionType: varchar("session_type").default("advisory"),
  workflowState: varchar("workflow_state").notNull().default("purpose_selection"),
  workflowStateUpdatedAt: timestamp("workflow_state_updated_at").defaultNow(),
  suitabilityCheckPassed: boolean("suitability_check_passed").default(false),
  suitabilityCheckId: varchar("suitability_check_id"),
  optimizationCompleted: boolean("optimization_completed").default(false),
  optimizationVersion: varchar("optimization_version"),
  agentArnCode: varchar("agent_arn_code"),
  agentEuinNumber: varchar("agent_euin_number"),
  agentDeclarationAcknowledged: boolean("agent_declaration_acknowledged").default(false),
  agentDeclarationTimestamp: timestamp("agent_declaration_timestamp"),
  clientViewedAt: timestamp("client_viewed_at"),
  clientActionStatus: varchar("client_action_status"),
  clientActionTimestamp: timestamp("client_action_timestamp"),
  clientActionNote: text("client_action_note"),
  investmentAmount: decimal("investment_amount", { precision: 15, scale: 2 }),
  investableSuprlusAmount: decimal("investable_surplus_amount", { precision: 15, scale: 2 }),
  isActive: boolean("is_active").default(true),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_advisory_sessions_agent").on(table.agentId),
  index("idx_advisory_sessions_client").on(table.clientId),
  index("idx_advisory_sessions_state").on(table.workflowState),
]);

export const suitabilityChecks = pgTable("suitability_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => advisorySessions.id),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  checkType: varchar("check_type").notNull(),
  clientCategory: varchar("client_category"),
  riskProfile: varchar("risk_profile"),
  timeHorizon: integer("time_horizon_years"),
  investableAmount: decimal("investable_amount", { precision: 15, scale: 2 }),
  existingPortfolioValue: decimal("existing_portfolio_value", { precision: 15, scale: 2 }),
  overallSuitabilityScore: integer("overall_suitability_score"),
  suitabilityPassed: boolean("suitability_passed").notNull(),
  suitabilityReason: text("suitability_reason"),
  riskToleranceCheck: jsonb("risk_tolerance_check"),
  timeHorizonCheck: jsonb("time_horizon_check"),
  liquidityNeedCheck: jsonb("liquidity_need_check"),
  concentrationCheck: jsonb("concentration_check"),
  productEligibilityCheck: jsonb("product_eligibility_check"),
  lastAssessedAt: timestamp("last_assessed_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_suitability_checks_session").on(table.sessionId),
  index("idx_suitability_checks_client").on(table.clientId),
]);

export const sebiRiskProfilesMaster = pgTable("sebi_risk_profiles_master", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  profileCode: varchar("profile_code").notNull().unique(),
  profileName: varchar("profile_name").notNull(),
  riskBand: varchar("risk_band").notNull(),
  description: text("description"),
  scoreRangeMin: integer("score_range_min").notNull(),
  scoreRangeMax: integer("score_range_max").notNull(),
  colorCode: varchar("color_code"),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sebiQuestionnaireVersions = pgTable("sebi_questionnaire_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  versionNumber: varchar("version_number").notNull().unique(),
  versionName: varchar("version_name"),
  effectiveFrom: timestamp("effective_from").notNull(),
  effectiveTo: timestamp("effective_to"),
  isActive: boolean("is_active").default(true),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvalDate: timestamp("approval_date"),
  changeLog: text("change_log"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sebi_questionnaire_versions_active").on(table.isActive),
]);

export const sebiQuestionnaireCategories = pgTable("sebi_questionnaire_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  versionId: varchar("version_id").references(() => sebiQuestionnaireVersions.id).notNull(),
  categoryCode: varchar("category_code").notNull(),
  categoryName: varchar("category_name").notNull(),
  weightPercentage: decimal("weight_percentage", { precision: 5, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sebi_questionnaire_categories_version").on(table.versionId),
]);

export const sebiQuestionnaireQuestions = pgTable("sebi_questionnaire_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => sebiQuestionnaireCategories.id).notNull(),
  versionId: varchar("version_id").references(() => sebiQuestionnaireVersions.id).notNull(),
  questionCode: varchar("question_code").notNull(),
  questionText: text("question_text").notNull(),
  questionType: varchar("question_type").notNull(),
  helpText: text("help_text"),
  isMandatory: boolean("is_mandatory").default(true),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sebi_questionnaire_questions_category").on(table.categoryId),
  index("idx_sebi_questionnaire_questions_version").on(table.versionId),
]);

export const sebiQuestionnaireOptions = pgTable("sebi_questionnaire_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: varchar("question_id").references(() => sebiQuestionnaireQuestions.id).notNull(),
  optionCode: varchar("option_code").notNull(),
  optionText: text("option_text").notNull(),
  score: integer("score").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sebi_questionnaire_options_question").on(table.questionId),
]);

export const sebiClientRiskAssessments = pgTable("sebi_client_risk_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  pan: varchar("pan").notNull(),
  questionnaireVersionId: varchar("questionnaire_version_id").references(() => sebiQuestionnaireVersions.id).notNull(),
  rawScore: decimal("raw_score", { precision: 5, scale: 2 }).notNull(),
  adjustedScore: decimal("adjusted_score", { precision: 5, scale: 2 }),
  profileId: varchar("profile_id").references(() => sebiRiskProfilesMaster.id).notNull(),
  profileCode: varchar("profile_code").notNull(),
  hasOverride: boolean("has_override").default(false),
  overrideReason: text("override_reason"),
  overrideType: varchar("override_type"),
  originalProfileCode: varchar("original_profile_code"),
  categoryScores: jsonb("category_scores").$type<{
    categoryCode: string;
    categoryName: string;
    weight: number;
    rawScore: number;
    weightedScore: number;
  }[]>(),
  answers: jsonb("answers").$type<{
    questionId: string;
    questionCode: string;
    optionId: string;
    optionCode: string;
    score: number;
  }[]>(),
  assessmentType: varchar("assessment_type").default("initial"),
  triggerEvent: varchar("trigger_event"),
  status: varchar("status").default("active"),
  expiresAt: timestamp("expires_at"),
  nextReviewDate: timestamp("next_review_date"),
  clientConsentAt: timestamp("client_consent_at"),
  clientConsentIp: varchar("client_consent_ip"),
  assessedBy: varchar("assessed_by").references(() => users.id),
  assessorRole: varchar("assessor_role"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sebi_client_risk_assessments_user").on(table.userId),
  index("idx_sebi_client_risk_assessments_pan").on(table.pan),
  index("idx_sebi_client_risk_assessments_profile").on(table.profileCode),
  index("idx_sebi_client_risk_assessments_status").on(table.status),
  index("idx_sebi_client_risk_assessments_created").on(table.createdAt),
]);

export const sebiProductSuitabilityMatrix = pgTable("sebi_product_suitability_matrix", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productType: varchar("product_type").notNull(),
  productTypeLabel: varchar("product_type_label").notNull(),
  allowedRP1: boolean("allowed_rp1").default(false),
  allowedRP2: boolean("allowed_rp2").default(false),
  allowedRP3: boolean("allowed_rp3").default(false),
  allowedRP4: boolean("allowed_rp4").default(false),
  allowedRP5: boolean("allowed_rp5").default(false),
  minInvestmentAmount: decimal("min_investment_amount", { precision: 15, scale: 2 }),
  requiresAccreditedInvestor: boolean("requires_accredited_investor").default(false),
  requiresEnhancedKyc: boolean("requires_enhanced_kyc").default(false),
  minNetWorth: decimal("min_net_worth", { precision: 15, scale: 2 }),
  sebiCircularRef: varchar("sebi_circular_ref"),
  regulatoryNote: text("regulatory_note"),
  sortOrder: integer("sort_order").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sebi_product_suitability_product_type").on(table.productType),
]);

export const sebiAiRiskRecommendations = pgTable("sebi_ai_risk_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  currentAssessmentId: varchar("current_assessment_id").references(() => sebiClientRiskAssessments.id),
  triggerType: varchar("trigger_type").notNull(),
  triggerDetails: jsonb("trigger_details"),
  currentProfileCode: varchar("current_profile_code").notNull(),
  suggestedProfileCode: varchar("suggested_profile_code").notNull(),
  recommendationType: varchar("recommendation_type").notNull(),
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }).notNull(),
  aiExplanation: text("ai_explanation").notNull(),
  supportingData: jsonb("supporting_data").$type<{
    portfolioVolatility?: number;
    drawdownHistory?: number[];
    transactionBehavior?: string;
    concentrationRisk?: number;
  }>(),
  aiModelUsed: varchar("ai_model_used"),
  aiEngineVersion: varchar("ai_engine_version"),
  status: varchar("status").default("pending"),
  resolutionType: varchar("resolution_type"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  newAssessmentId: varchar("new_assessment_id").references(() => sebiClientRiskAssessments.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("idx_sebi_ai_risk_recommendations_user").on(table.userId),
  index("idx_sebi_ai_risk_recommendations_status").on(table.status),
  index("idx_sebi_ai_risk_recommendations_created").on(table.createdAt),
]);

export const sebiRiskAuditLogs = pgTable("sebi_risk_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  assessmentId: varchar("assessment_id").references(() => sebiClientRiskAssessments.id),
  recommendationId: varchar("recommendation_id").references(() => sebiAiRiskRecommendations.id),
  action: varchar("action").notNull(),
  actionCategory: varchar("action_category").notNull(),
  actorId: varchar("actor_id").references(() => users.id),
  actorRole: varchar("actor_role"),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  reason: text("reason"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  questionnaireVersion: varchar("questionnaire_version"),
  isRegulatorAuditable: boolean("is_regulator_auditable").default(true),
  complianceNote: text("compliance_note"),
  retentionExpiresAt: timestamp("retention_expires_at"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_sebi_risk_audit_user").on(table.userId),
  index("idx_sebi_risk_audit_assessment").on(table.assessmentId),
  index("idx_sebi_risk_audit_action").on(table.action),
  index("idx_sebi_risk_audit_category").on(table.actionCategory),
  index("idx_sebi_risk_audit_timestamp").on(table.timestamp),
]);

export const sebiGoalRiskProfiles = pgTable("sebi_goal_risk_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  goalId: varchar("goal_id").notNull(),
  goalName: varchar("goal_name").notNull(),
  profileCode: varchar("profile_code").notNull(),
  profileId: varchar("profile_id").references(() => sebiRiskProfilesMaster.id).notNull(),
  overrideReason: text("override_reason"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sebi_goal_risk_profiles_user").on(table.userId),
  index("idx_sebi_goal_risk_profiles_goal").on(table.goalId),
]);

export const globalAdvisoryAcknowledgments = pgTable("global_advisory_acknowledgments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  sessionId: varchar("session_id").references(() => advisorySessions.id),
  acknowledgmentType: varchar("acknowledgment_type").notNull(),
  acknowledgmentText: text("acknowledgment_text").notNull(),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow(),
}, (table) => [
  index("idx_global_advisory_ack_user").on(table.userId),
]);

export const globalAdvisoryAuditLog = pgTable("global_advisory_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action").notNull(),
  actorId: varchar("actor_id").references(() => users.id),
  actorRole: varchar("actor_role").notNull(),
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
}, (table) => [
  index("idx_global_advisory_audit_user").on(table.userId),
  index("idx_global_advisory_audit_action").on(table.action),
]);

export const globalAdvisoryRecommendations = pgTable("global_advisory_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  recommendationType: varchar("recommendation_type").notNull(),
  productCategory: varchar("product_category").notNull(),
  productId: varchar("product_id"),
  reasoning: text("reasoning"),
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 2 }),
  status: varchar("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_global_advisory_rec_user").on(table.userId),
]);

export const goalBenchmarkMapping = pgTable("goal_benchmark_mapping", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalType: varchar("goal_type").notNull(),
  riskProfile: varchar("risk_profile").notNull(),
  benchmarkIndex: varchar("benchmark_index"),
  benchmarkCode: varchar("benchmark_code"),
  benchmarkName: varchar("benchmark_name"),
  benchmarkRationale: text("benchmark_rationale"),
  horizonYearsMin: integer("horizon_years_min").default(0),
  horizonYearsMax: integer("horizon_years_max").default(99),
  isDefault: boolean("is_default").default(true),
  isActive: boolean("is_active").default(true),
  overriddenBy: varchar("overridden_by"),
  overriddenAt: timestamp("overridden_at"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_goal_benchmark_goal").on(table.goalType),
  index("idx_goal_benchmark_risk").on(table.riskProfile),
]);

import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { investmentProposals } from './proposals-base';

export const insertFinancialGoalSchema = createInsertSchema(financialGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FinancialGoal = typeof financialGoals.$inferSelect;
export type InsertFinancialGoal = typeof financialGoals.$inferInsert;

export const insertGoalMilestoneSchema = createInsertSchema(goalMilestones).omit({
  id: true,
  createdAt: true,
});
export type GoalMilestone = typeof goalMilestones.$inferSelect;
export type InsertGoalMilestone = typeof goalMilestones.$inferInsert;

export const insertGoalInvestmentLinkSchema = createInsertSchema(goalInvestmentLinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type GoalInvestmentLink = typeof goalInvestmentLinks.$inferSelect;
export type InsertGoalInvestmentLink = typeof goalInvestmentLinks.$inferInsert;

export const insertClientRiskProfileSchema = createInsertSchema(clientRiskProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ClientRiskProfile = typeof clientRiskProfiles.$inferSelect;
export type InsertClientRiskProfile = typeof clientRiskProfiles.$inferInsert;

export const insertAdvisorySessionSchema = createInsertSchema(advisorySessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AdvisorySession = typeof advisorySessions.$inferSelect;
export type InsertAdvisorySession = typeof advisorySessions.$inferInsert;

export const insertSuitabilityCheckSchema = createInsertSchema(suitabilityChecks).omit({
  id: true,
  createdAt: true,
});
export type SuitabilityCheck = typeof suitabilityChecks.$inferSelect;
export type InsertSuitabilityCheck = typeof suitabilityChecks.$inferInsert;

export const insertSebiRiskProfilesMasterSchema = createInsertSchema(sebiRiskProfilesMaster).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SebiRiskProfileMaster = typeof sebiRiskProfilesMaster.$inferSelect;
export type InsertSebiRiskProfileMaster = typeof sebiRiskProfilesMaster.$inferInsert;

export const insertSebiQuestionnaireVersionSchema = createInsertSchema(sebiQuestionnaireVersions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SebiQuestionnaireVersion = typeof sebiQuestionnaireVersions.$inferSelect;
export type InsertSebiQuestionnaireVersion = typeof sebiQuestionnaireVersions.$inferInsert;

export const insertSebiClientRiskAssessmentSchema = createInsertSchema(sebiClientRiskAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SebiClientRiskAssessment = typeof sebiClientRiskAssessments.$inferSelect;
export type InsertSebiClientRiskAssessment = typeof sebiClientRiskAssessments.$inferInsert;

export const insertGoalBenchmarkMappingSchema = createInsertSchema(goalBenchmarkMapping).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type GoalBenchmarkMapping = typeof goalBenchmarkMapping.$inferSelect;
export type InsertGoalBenchmarkMapping = typeof goalBenchmarkMapping.$inferInsert;

export const insertGoalProgressSnapshotSchema = createInsertSchema(goalProgressSnapshots).omit({
  id: true,
  createdAt: true,
});
export type GoalProgressSnapshot = typeof goalProgressSnapshots.$inferSelect;
export type InsertGoalProgressSnapshot = typeof goalProgressSnapshots.$inferInsert;
