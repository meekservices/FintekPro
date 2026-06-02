
import { pickCategoryEnum, pickStatusEnum, leadProcessingModeEnum, leadStatusEnum, pddStatusEnum, payoutClaimStatusEnum, masterDsaClaimStatusEnum, commissionPlanStatusEnum, payoutModeEnum, passthroughRuleEnum } from './schema/enums.ts';

export * from "./schema/enums.ts";
export * from "./schema/commissions.ts";
export * from "./schema/banking.ts";
export * from "./schema/crm.ts";
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean, index, uniqueIndex, integer, date, bigint, numeric, pgEnum, serial, uuid, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, userBankAccounts, userProfiles, userDematAccounts, alpacaAccounts, alpacaOrders, alpacaPositions, alpacaTradeLogs, insertAlpacaAccountSchema, insertAlpacaOrderSchema, insertAlpacaPositionSchema, insertAlpacaTradeLogSchema } from './schema/users.ts';
import { bbpsTransactions, lrsTransactions } from './schema/banking.ts';
import {
  digilockerApps, insertDigilockerAppSchema, DigilockerApp, InsertDigilockerApp,
  digilockerSharedDocuments, insertDigilockerSharedDocumentSchema, DigilockerSharedDocument, InsertDigilockerSharedDocument,
  digilockerUserSessions, insertDigilockerUserSessionSchema, DigilockerUserSession, InsertDigilockerUserSession,
  kycVerificationSessions, insertKycVerificationSessionSchema, KycVerificationSession, InsertKycVerificationSession,
  complianceDocuments, insertComplianceDocumentSchema, ComplianceDocument, InsertComplianceDocument,
  complianceAuditTrail, insertComplianceAuditTrailSchema, ComplianceAuditTrail, InsertComplianceAuditTrail,
  ckycRecords, insertCkycRecordSchema, CkycRecord, InsertCkycRecord,
  smartKycProgress, insertSmartKycProgressSchema, SmartKycProgress, InsertSmartKycProgress,
  corporateKycProgress, insertCorporateKycProgressSchema, CorporateKycProgress, InsertCorporateKycProgress,
  nriKycProgress, insertNriKycProgressSchema, NriKycProgress, InsertNriKycProgress,
  ckycDocuments, insertCkycDocumentSchema, CkycDocument, InsertCkycDocument,
  ckycStatusHistory, insertCkycStatusHistorySchema, CkycStatusHistory, InsertCkycStatusHistory,
  kycUpgradeReminders, insertKycUpgradeReminderSchema, KycUpgradeReminder, InsertKycUpgradeReminder,
  kycConsentLogs, insertKycConsentLogSchema, KycConsentLog, InsertKycConsentLog,
  kycRegulatoryAuditLogs, insertKycRegulatoryAuditLogSchema, KycRegulatoryAuditLog, InsertKycRegulatoryAuditLog,
  kycVault, insertKycVaultSchema, KycVault, InsertKycVault,
  kycAuditLogs, insertKycAuditLogSchema, KycAuditLog, InsertKycAuditLog,
  kycTokenMap, insertKycTokenMapSchema, KycTokenMap, InsertKycTokenMap,
  kycReuseTokens, insertKycReuseTokenSchema, KycReuseToken, InsertKycReuseToken,
  ckycNotificationTriggers, insertCkycNotificationTriggerSchema, CkycNotificationTrigger, InsertCkycNotificationTrigger,
  ckycProgressSteps, insertCkycProgressStepSchema, CkycProgressStep, InsertCkycProgressStep,
  ckycActionLogs, insertCkycActionLogSchema, CkycActionLog, InsertCkycActionLog,
  kycFormProgress, insertKycFormProgressSchema, KycFormProgress, InsertKycFormProgress,
  manualKycSubmissions, insertManualKycSubmissionSchema, ManualKycSubmission, InsertManualKycSubmission,
  manualKycDocuments, insertManualKycDocumentSchema, ManualKycDocument, InsertManualKycDocument,
  kycStepResets, insertKycStepResetSchema, KycStepReset, InsertKycStepReset,
  kycProductEligibilityRules, insertKycProductEligibilityRuleSchema, KycProductEligibilityRule, InsertKycProductEligibilityRule,
  kycAuditPacks, insertKycAuditPackSchema, KycAuditPack, InsertKycAuditPack,
  kycWebhookEvents, insertKycWebhookEventSchema, KycWebhookEvent, InsertKycWebhookEvent,
  kycRateLimitCounters, insertKycRateLimitCounterSchema, KycRateLimitCounter, InsertKycRateLimitCounter,
  aadhaarConsentArtifacts, insertAadhaarConsentArtifactSchema, AadhaarConsentArtifact, InsertAadhaarConsentArtifact,
  consentLogs, insertConsentLogSchema, ConsentLog, InsertConsentLog,
  sebiDepositoryParticipants, insertSebiDepositoryParticipantSchema, SebiDepositoryParticipant, InsertSebiDepositoryParticipant,
  otpVerifications, insertOtpVerificationSchema, OtpVerification, InsertOtpVerification,
  passwordResetTokens, insertPasswordResetTokenSchema, PasswordResetToken, InsertPasswordResetToken,
  incomeStreams, insertIncomeStreamSchema, IncomeStream, InsertIncomeStream,
  financialObligations, insertFinancialObligationSchema, FinancialObligation, InsertFinancialObligation,
  emergencyFunds, insertEmergencyFundSchema, EmergencyFund, InsertEmergencyFund,
  investableSurplus, insertInvestableSurplusSchema, InvestableSurplus, InsertInvestableSurplus,
  identityProfiles, insertIdentityProfileSchema, IdentityProfile, InsertIdentityProfile,
  conversionFunnels, insertConversionFunnelSchema, ConversionFunnel,
  verificationCache, insertVerificationCacheSchema, VerificationCache, InsertVerificationCache,
  onboardingInvitations, insertOnboardingInvitationSchema, OnboardingInvitation, InsertOnboardingInvitation,
  onboardingInvitationEvents, insertOnboardingInvitationEventSchema, OnboardingInvitationEvent, InsertOnboardingInvitationEvent,
  insertCkycMockBlockedAttemptSchema, kycProviders, fixedIncomeFeedIngestionLogs, aaDataFetchLogs,
  epfHoldings, fixedIncomeReports, insertEntityComplianceScoreSchema, dataSourceConsents,
  insertUsConsentSchema, insertPanConsentSchema, fixedIncomeSettlements, bondNcdApplications,
  agentComplianceAuditLogs, fixedIncomeAgentCommissions, ckycMockBlockedAttempts, aaConsentSessions,
  insertAAConsentSessionSchema, governmentSchemeConsents, fixedIncomeAuditLog, bondWatchlist,
  userUccStatus, bondSuitabilityChecks, panConsents, fixedIncomeOrderPayments,
  fixedIncomeNotificationPrefs, lrsComplianceTracking, usConsents, rbiRetailDirectAccounts,
  bondCouponPayments, aaRawPayloads, sgbPrimaryIssues, entityComplianceScores,
} from './schema/kyc.ts';
import { 
  insertAgentAppointmentSchema, 
  agentPartnerMappings, 
  abTestingExperimentState, 
  insertAgentLeadSchema, 
  agentCommissionSplits, 
  agentItrDocuments, 
  insertAgentItrCaseSchema, 
  insertAgentClientMappingRequestSchema, 
  agentClientMappingRequests, 
  caProfiles, 
  agents, 
  agentItrCases, 
  agentCommissions, 
  agentLeads, 
  agentAppointments, 
  abTestingMetrics, 
  agentDocuments,
  customerCareAgents,
  quizAttempts,
  certificationQuizzes,
  insertQuizAttemptSchema,
  insertCertificationQuizSchema
} from './schema/agents.ts';
import { 
  insertAiFeatureSnapshotSchema, 
  aiUserProfiles, 
  insertAiUserProfileSchema, 
  aiPredictionLogs, 
  insertAiPredictionLogSchema, 
  insertAiUserInteractionSchema, 
  aiOptimizationSuggestions, 
  insertAiOptimizationSuggestionSchema,
  dailyPicks,
  insertDailyPickSchema,
  DailyPick,
  InsertDailyPick,
  aifFunds, 
  aiUserInteractions, 
  aiTransactionTracking, 
  aiFeatureSnapshots,
  aiTalkingPoints
} from './schema/ai.ts';
import { 
  insertMfEnrichmentAuditLogSchema, 
  mutualFundAmcs, 
  mutualFunds, 
  insertMfBatchValidationLogSchema, 
  insertMfSchemeStockHoldingsSchema, 
  mfBatchValidationLogs, 
  mfSchemeStockHoldings, 
  insertMfCategoryRuleSchema, 
  mfCategoryRules, 
  mfEnrichmentAuditLogs,
  schemeRenameLog,
  insertSchemeRenameLogSchema,
  SchemeRenameLog,
  InsertSchemeRenameLog,
  schemeTransactionRules,
  insertSchemeTransactionRuleSchema,
  SchemeTransactionRule,
  InsertSchemeTransactionRule,
  fundComparisons,
  insertFundComparisonSchema,
  FundComparison,
  InsertFundComparison,
  comparisonHistory,
  insertComparisonHistorySchema,
  ComparisonHistory,
  InsertComparisonHistory,
  fundFinancialRatios,
  insertFundFinancialRatiosSchema,
  FundFinancialRatios,
  InsertFundFinancialRatios,
  stockFinancialRatios,
  insertStockFinancialRatiosSchema,
  StockFinancialRatios,
  InsertStockFinancialRatios,
  recommendationPerformance,
  insertRecommendationPerformanceSchema,
  RecommendationPerformance,
  InsertRecommendationPerformance,
  productFundamentalsCache,
  insertProductFundamentalsCacheSchema,
  ProductFundamentalsCache,
  InsertProductFundamentalsCache,
  amfiSchemeBenchmarks,
  insertAmfiSchemeBenchmarkSchema,
  AmfiSchemeBenchmark,
  InsertAmfiSchemeBenchmark,
  insertMutualFundAmcSchema,
  MutualFundAmc,
  InsertMutualFundAmc,
  insertMutualFundSchema,
  MutualFund,
  InsertMutualFund
} from './schema/mutual-funds.ts';
import { usBrokerAccounts } from './schema/orders.ts';
import { mcaCharges, mcaIngestionLogs, insertMcaDirectorsSchema, mcaDataSources, insertMcaWalletPaymentSchema, insertMcaDataSourcesSchema, mcaDirectors, mcaDirectPayments, insertMcaChargesSchema, insertMcaRiskScoresSchema, mcaWalletPayments, insertMcaDirectPaymentSchema, mcaRiskScores, insertMcaIngestionLogsSchema } from './schema/mca.ts';
import { partnerCommissions, partnerHierarchyAgreements, partners, partnerCommissionRules, partnerApplicationDocuments, partnerWallets, partnerReferrals, partnerApplications, partnerAuditLogs, partnerSettlements } from './schema/partners.ts';
import { 
  portfolioGeneratedReports, 
  predictionAccuracy, 
  portfolioReportAuditLogs, 
  portfolioHoldings, 
  pdfProfiles, 
  proposalNotes, 
  portfolioComparisons, 
  riskAnalysis, 
  portfolioUploads, 
  pdfParsingAuditTrail, 
  portfolioPredictions, 
  proposalShares, 
  insertPortfolioReportTemplateSchema, 
  assetForecasts, 
  holdingLotsV2, 
  portfolioSnapshots, 
  portfolioReportTemplates, 
  portfolios, 
  familyGroups, 
  insertPortfolioPredictionSchema, 
    insertPortfolioDiagnosticsSchema, 
  assetAllocation, 
  externalHoldings, 
  watchlists, 
  comprehensiveHoldings,
  PortfolioComparison,
  InsertPortfolioComparison
} from './schema/portfolio.ts';
import {
  portfolioAlerts,
  insertPortfolioAlertSchema
} from './schema/ai.ts';
import { 
  reits, 
  insertReitSchema, 
  Reit, 
  InsertReit, 
  invits, 
  insertInvitSchema, 
  Invit, 
  InsertInvit,
  reitInvitHoldings,
  insertReitInvitHoldingSchema,
  ReitInvitHolding,
  InsertReitInvitHolding,
  ReitSectorEnum,
  InvitSectorEnum
} from './schema/reit-invit.ts';
import { 
  proposalVerdicts, 
  proposalEsignParticipants, 
  insertProposalVersionSchema, 
  insertProposalSipRecommendationSchema, 
  insertProposalMaterializationSchema, 
  proposalVersions, 
  insertProposalAuditEventSchema, 
  proposalReportSections, 
  insertProposalInteractionSchema, 
  proposalEsignComments, 
  proposalHoldings, 
  insertProposalWhatIfScenarioSchema, 
  proposalInteractions, 
  insertProposalVerdictSchema, 
  proposalMaterializations, 
  proposalEsignWorkflows, 
  insertProposalReportSectionSchema, 
  proposalApprovals, 
  proposalSipRecommendations, 
  proposalBacktestResults, 
  insertProposalHoldingSchema, 
  proposalWhatIfScenarios, 
  proposalPayments, 
  proposalEsignAuditLogs, 
  proposalEsignFieldEdits, 
  insertProposalEsignWorkflowSchema, 
  proposalEsignVersions, 
  proposalAuditEvents, 
  insertProposalApprovalSchema, 
  insertProposalBacktestResultSchema,
  prospectProposals,
  prospectProposalEvents,
  prospectClients,
  esignRequests,
  esignCertificates,
  esignAuditLog,
  userSignatures,
  insertProspectProposalSchema,
  insertProspectProposalEventSchema,
  insertProspectClientSchema,
  insertEsignRequestSchema,
  insertUserSignatureSchema,
  ProspectProposalTypeEnum,
  ProspectProposalStatusEnum,
  ProspectStateEnum,
  ProspectReadinessStatusEnum
} from './schema/proposals.ts';
import { 
  investmentProposals, 
  investmentProposalItems, 
  insertInvestmentProposalSchema, 
  insertInvestmentProposalItemSchema,
  instrumentMaster,
  InstrumentAssetClassEnum,
  insertInstrumentMasterSchema
} from './schema/proposals-base.ts';
import { familyGoals, familyMembers, familyPortfolioPermissions, familyDiscussions, familyBudgets, familyActivityLogs, familyGoalContributions } from './schema/family.ts';
import { 
    investorClassificationRules, 
    bondCalendarEvents, 
    insertInvestorClassificationRuleSchema, 
    insertCorporateBondSchema, 
    bondHoldings, 
    insertBondCalendarEventSchema,
    governmentSecurities,
    corporateBonds,
    fixedIncomeStatusLog,
    insertGovernmentSecuritySchema
} from './schema/bonds.ts';
import { insuranceHoldings } from './schema/insurance.ts';
import { 
  clientAgentRelationships, 
  returnForecasts, 
  treasuryMandates, 
  clientSegments, 
  insertGeneratedReportSchema, 
  recommendationExplanations, 
  rebalancingRecommendations, 
  treasuryAllocations, 
  clientStatements, 
  clientTasks, 
  treasuryProposals,
  generatedReports,
  reportAccessLogs,
  insertReportAccessLogSchema,
  insertClientStatementSchema,
  GeneratedReport,
  InsertGeneratedReport,
  ReportAccessLog,
  InsertReportAccessLog,
  ClientStatement,
  InsertClientStatement
} from './schema/clients.ts';
import { insertUnlistedRiskDisclosureAcknowledgmentSchema, companyFinancials, unlistedRiskDisclosureAcknowledgments, financialAuditLog, companyRatios, insertUnlistedCompanySchema, buyRequests, unlistedEscrowApprovals, unlistedCompanies, probe42SyncLog, sellListings, companyExternalMapping, unlistedDeals, insertUnlistedEscrowApprovalSchema } from './schema/unlisted.ts';
import {
  loanProducts, 
  loanOffers, 
  loanLeads, 
  loanApplications, 
  loanComparisons, 
  loanRepayments, 
  loanProviders, 
  loanApplicationsMarketplace, 
  loanCommissionLedger, 
  loanRequests,
  lenderStaff,
  lenderStaffHistory,
  providerProductCommissions,
  providerProducts,
  creditProfiles,
  providerIntegrations,
  applicationDocuments,
  iciciBankLoanApplications,
  iciciBankCreditScores,
  preApprovedLoanOffers,
  creditRatings,
  insertLoanProductSchema,
  insertLoanProviderSchema,
  insertProviderProductSchema,
  insertCreditProfileSchema,
  insertLoanRequestSchema,
  insertLoanOfferSchema,
  insertLoanApplicationMarketplaceSchema,
  insertProviderIntegrationSchema,
  insertApplicationDocumentSchema,
  insertICICILoanApplicationSchema,
  insertICICICreditScoreSchema,
  insertPreApprovedLoanOfferSchema,
  insertCreditRatingSchema,
  insertLenderStaffSchema,
  insertLenderStaffHistorySchema,
  insertProviderProductCommissionsSchema,
  LoanProduct,
  InsertLoanProduct,
  LoanProvider,
  InsertLoanProvider,
  ProviderProduct,
  InsertProviderProduct,
  CreditProfile,
  InsertCreditProfile,
  LoanRequest,
  InsertLoanRequest,
  LoanOffer,
  InsertLoanOffer,
  LoanApplicationMarketplace,
  InsertLoanApplicationMarketplace,
  ProviderIntegration,
  InsertProviderIntegration,
  ApplicationDocument,
  InsertApplicationDocument,
  ICICILoanApplication,
  InsertICICILoanApplication,
  ICICICreditScore,
  InsertICICICreditScore,
  PreApprovedLoanOffer,
  InsertPreApprovedLoanOffer,
  CreditRating,
  InsertCreditRating,
  LenderStaff,
  LenderStaffHistory,
  ProviderProductCommissions,
  InsertLenderStaff,
  InsertLenderStaffHistory,
  InsertProviderProductCommissions,
  LoanComparison
} from './schema/loans.ts';
import { 
  itrPrefilledForms, 
  taxSessions,
  taxDataSources,
  validationIssues,
  filingRecords,
  insertTaxSessionSchema,
  insertTaxDataSourceSchema,
  insertValidationIssueSchema,
  insertFilingRecordSchema,
  TaxSession,
  TaxDataSource,
  ValidationIssue,
  FilingRecord
} from './schema/itr.ts';
import { leadActivityLog, insertLeadActivityLogSchema } from './schema/crm.ts';
import { mldMaster } from './schema/products.ts';

export { 
  products,
  productAccountPreferences,
  productApplications,
  pmsMaster,
  mldMaster,
  giftCityProducts,
  fundPerformanceMonthwise,
  fundPerformanceRolling,
  fundManagers,
  marketingCampaigns,
  campaignRecipients,
  insertProductSchema,
  insertProductAccountPreferenceSchema,
  insertProductApplicationSchema,
  insertPmsMasterSchema,
  insertMldMasterSchema,
  insertGiftCityProductSchema,
  insertFundPerformanceMonthwiseSchema,
  insertFundPerformanceRollingSchema,
  insertFundManagerSchema,
  insertMarketingCampaignSchema,
  insertCampaignRecipientSchema
} from './schema/products.ts';

import { 
  storeCategories, 
  advisorySubscriptions, 
  storeProducts, 
  storeProductImages, 
  storeProductTags, 
  storeProductTagMappings, 
  userWishlist, 
  insertStoreCategorySchema,
  insertAdvisorySubscriptionSchema,
  insertStoreProductSchema,
  insertStoreProductImageSchema,
  insertStoreProductTagSchema,
  insertStoreProductTagMappingSchema,
  insertUserWishlistSchema
} from './schema/products.ts';

export type {
  Product,
  ProductAccountPreference,
  ProductApplication,
  PmsMaster,
  MldMaster,
  GiftCityProduct,
  FundPerformanceMonthwise,
  FundPerformanceRolling,
  FundManager,
  MarketingCampaign,
  CampaignRecipient,
  InsertProduct,
  InsertProductAccountPreference,
  InsertProductApplication,
  InsertPmsMaster,
  InsertMldMaster,
  InsertGiftCityProduct,
  InsertFundPerformanceMonthwise,
  InsertFundPerformanceRolling,
  InsertFundManager,
  InsertMarketingCampaign,
  InsertCampaignRecipient
} from './schema/products.ts';
import { insertDocumentAuditEventSchema, insertDocumentCommentSchema, documentVersions, insertDocumentAiReviewSchema, insertDocumentOverrideSchema, insertDocumentSchema, documentRenewals, documentWorkflowTransitions, insertDocumentChecklistRunSchema, documents, insertDocumentRenewalSchema, insertDocumentChecklistItemSchema, documentSignatures, documentChecklistRuns, insertDocumentWorkflowTransitionSchema, documentChecklistItems, documentOverrides, insertDocumentSignatureSchema, documentTrackedChanges, documentAiReviews, insertDocumentTrackedChangeSchema, documentAuditEvents, documentClauses, documentComments, insertDocumentVersionSchema, insertDocumentClauseSchema } from './schema/documents.ts';
import { zohoCommerceWebhooks, zohoCustomers, zohoOrders, zohoCategories, zohoCommerceSyncLogs, zohoEntityMappings, zohoSyncLogs, zohoProducts, zohoConnections, zohoWebhookEvents } from './schema/zoho.ts';
import { userCart } from './schema/cart.ts';
import { goalInvestmentLinks, insertSuitabilityCheckSchema, sebiGoalRiskProfiles, goalMilestones, suitabilityChecks, financialGoals, goalProgressSnapshots } from './schema/advisory.ts';
import { marketData } from './schema/market-data.ts';


// Re-export role hierarchy system
export * from "./roles.ts";
export * from "./schema/users.ts";
export * from "./schema/portfolio.ts";
export * from "./schema/kyc.ts";
export * from "./schema/mutual-funds.ts";
export * from "./schema/advisory.ts";
export * from "./schema/ib.ts";
export * from "./schema/orders.ts";
export * from "./schema/market-data.ts";
export * from "./schema/cart.ts";
export * from "./schema/reit-invit.ts";
export * from "./schema/mpal.ts";
export * from "./schema/alpaca-config.ts";

// Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);


// User Demat Accounts table - Separate demat accounts per user (max 3)




// Product-specific account preferences - which bank/demat account to use for each product type

// User storage table with mobile/email authentication


// ── Platform Subscriptions — tracks every subscription payment ───────────────


// KYC Verification Sessions table for tracking step-by-step Smart KYC wizard flow


// Generic HTTP request audit trail — used by server/middleware/audit-trail.ts
// NOTE: separate from compliance_audit_trail which tracks compliance-specific events
export const auditTrail = pgTable("audit_trail", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  action: varchar("action").notNull(),
  category: varchar("category").notNull(),
  details: text("details"),          // JSON-serialised context
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  outcome: varchar("outcome"),       // 'success' | 'failure' | 'pending'
  riskLevel: varchar("risk_level"),  // 'low' | 'medium' | 'high' | 'critical'
  createdAt: timestamp("created_at").defaultNow(),
});



// Smart KYC Progress Tracking - Track step-by-step completion


// ===== FAMILY COLLABORATION TABLES =====

// Family Groups - Core table for family/couple financial planning

// Family Members - Join table with roles and permissions



// EPF Holdings table for tracking Employee Provident Fund data


// Pi Chat Asset Summaries
export const piChatSummaries = pgTable("pi_chat_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  assetClass: text("asset_class").notNull(),
  summary: text("summary").notNull(),
  insights: jsonb("insights"), // key metrics, risks, opportunities
  recommendations: text("recommendations").array(),
  lastAnalyzed: timestamp("last_analyzed").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Commodity Tracking
export const commodityPrices = pgTable("commodity_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(), // precious_metals, energy, agricultural, industrial
  price: decimal("price", { precision: 15, scale: 4 }).notNull(),
  priceUnit: text("price_unit").notNull(), // per_ounce, per_barrel, per_ton
  change: decimal("change", { precision: 15, scale: 4 }),
  changePercent: decimal("change_percent", { precision: 8, scale: 4 }),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Enhanced Rebalancing Suggestions
export const rebalancingSuggestions = pgTable("rebalancing_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id).notNull(),
  suggestionType: text("suggestion_type").notNull(), // yield_optimization, risk_reduction, diversification
  priority: text("priority").notNull(), // high, medium, low
  title: text("title").notNull(),
  description: text("description").notNull(),
  actions: jsonb("actions"), // array of specific actions to take
  expectedImpact: jsonb("expected_impact"), // yield, risk, diversification improvements
  confidenceScore: decimal("confidence_score", { precision: 3, scale: 1 }),
  implementationSteps: text("implementation_steps").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Activity Tracking
export const userActivities = pgTable("user_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: varchar("action").notNull(), // 'login', 'portfolio_view', 'trade', 'api_call', etc.
  resource: varchar("resource"), // what was accessed/modified
  details: jsonb("details"), // additional activity data
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin Panel Settings
export const adminSettings = pgTable("admin_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: jsonb("value"),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin Approval Requests (Maker-Checker Workflow)
export const adminApprovalRequests = pgTable("admin_approval_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestedBy: varchar("requested_by").references(() => users.id).notNull(),
  checkerId: varchar("checker_id").references(() => users.id),
  entityType: varchar("entity_type").notNull(), // 'bond_commission', 'fee_model', etc.
  entityId: varchar("entity_id"),
  action: varchar("action").notNull(), // 'create', 'update', 'delete'
  data: jsonb("data").notNull(), // The new state to be applied
  status: varchar("status").notNull().default("pending"), // 'pending', 'approved', 'rejected'
  reason: text("reason"), // Reason for rejection or approval note
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Notifications/Guidance
export const userNotifications = pgTable("user_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  type: varchar("type").notNull(), // 'info', 'warning', 'guidance', 'alert'
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  actionUrl: varchar("action_url"), // where to navigate when clicked
  isRead: boolean("is_read").default(false),
  priority: varchar("priority").default("medium"), // 'low', 'medium', 'high', 'critical'
  expiresAt: timestamp("expires_at"),
  createdBy: varchar("created_by").references(() => users.id), // admin who created it
  createdAt: timestamp("created_at").defaultNow(),
});

// Interactive Brokers Integration Tables

// IB Account Configurations


// Partner Portal Tables

// customerCareAgents moved to shared/schema/agents.ts

// Agent-Partner mapping table (one agent can support multiple partners)

// Client-Agent relationship table for EUIN/ARN association

// Agent Commission Split Rules - Defines how commissions are split in hierarchy

// Agent Documents - Store onboarding and KYC documents

// Agent Commissions - Track commission transactions in agent hierarchy

// AMFI Verification Log - Track all AMFI API calls for audit

// Partners table for managing partner accounts with revenue sharing

// Partner Referrals - Track which partner referred which client

// Partner Commissions - Track every commission transaction

// Partner Settlements - Monthly payout records

// === Multi-Level Partner Hierarchy Tables ===

// Partner Hierarchy Agreements - Track formal agreements between partners

// Partner Commission Rules - Waterfall commission structure

// Partner Wallets - Track partner balance

// Partner Commission Ledger - Immutable commission records

// Partner Audit Logs - Immutable audit trail for all partner actions

// Partner Client Ownership - Track immutable client ownership by lowest-level partner

// Progressive Commission Config - per-product payout configuration

// Progressive Commission Ledger - role-based entries with level offset

// Commission Execution - idempotency guard


// Dispute Cases - commission dispute tracking

// Reversal Ledger - mirror entries for reversed commissions (never deletions)

// Agents table for managing agent/distributor accounts

// Zoho OAuth Connections - Store OAuth tokens for Zoho integrations

// Zoho Entity Mappings - Map FintekPro entities to Zoho entities

// Zoho Sync Logs - Track all sync operations

// Zoho Webhook Events - Store incoming webhook events

// Products table for partner-managed financial products

// Support tickets for client support
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketNumber: varchar("ticket_number").unique().notNull(),
  // Client information
  userId: varchar("user_id").references(() => users.id),
  clientName: varchar("client_name").notNull(),
  clientEmail: varchar("client_email").notNull(),
  clientPhone: varchar("client_phone"),
  // Ticket details
  subject: varchar("subject").notNull(),
  description: text("description").notNull(),
  category: varchar("category").notNull(), // 'technical', 'billing', 'product_inquiry', 'complaint'
  priority: varchar("priority").default("medium"), // 'low', 'medium', 'high', 'urgent'
  status: varchar("status").default("open"), // 'open', 'in_progress', 'pending', 'resolved', 'closed'
  // Assignment
  assignedTo: varchar("assigned_to").references(() => partners.id),
  assignedBy: varchar("assigned_by").references(() => users.id),
  // Resolution
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  // Metadata
  source: varchar("source").default("web"), // 'web', 'email', 'phone', 'chat'
  attachments: jsonb("attachments").default([]),
  tags: text("tags").array().default([]),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Support ticket messages for conversation history
export const ticketMessages = pgTable("ticket_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => supportTickets.id).notNull(),
  // Message details
  senderId: varchar("sender_id"), // Can be user, partner, or admin
  senderType: varchar("sender_type").notNull(), // 'user', 'partner', 'admin'
  senderName: varchar("sender_name").notNull(),
  message: text("message").notNull(),
  messageType: varchar("message_type").default("text"), // 'text', 'file', 'image', 'system'
  // Attachments
  attachments: jsonb("attachments").default([]),
  // Metadata
  isInternal: boolean("is_internal").default(false), // Internal notes not visible to client
  createdAt: timestamp("created_at").defaultNow(),
});


// Support templates for pre-defined CA service workflows
export const supportTemplates = pgTable("support_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").notNull(), // 'itr_filing', 'kyc_assistance', 'tax_planning', 'investment_advisory', 'gst_filing', 'audit_support'
  serviceType: varchar("service_type").notNull(), // 'ca_service', 'financial_advisory', 'compliance'
  estimatedDuration: integer("estimated_duration"), // In hours
  // Steps definition as JSON array
  steps: jsonb("steps").default([]).notNull(), // [{stepNumber, title, description, requiredDocuments, estimatedTime}]
  // Documents required
  requiredDocuments: jsonb("required_documents").default([]),
  // Checklist items
  checklist: jsonb("checklist").default([]),
  // Pricing
  baseFee: numeric("base_fee", { precision: 10, scale: 2 }),
  // Status
  isActive: boolean("is_active").default(true),
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Support steps for tracking step-by-step progress on tickets
export const supportSteps = pgTable("support_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").references(() => supportTickets.id).notNull(),
  templateId: varchar("template_id").references(() => supportTemplates.id),
  stepNumber: integer("step_number").notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  // Step status
  status: varchar("status").default("pending"), // 'pending', 'in_progress', 'completed', 'skipped'
  // Completion details
  completedBy: varchar("completed_by").references(() => partners.id),
  completedAt: timestamp("completed_at"),
  // Notes and documents
  notes: text("notes"),
  documents: jsonb("documents").default([]), // [{name, url, uploadedAt}]
  // Checklist items for this step
  checklistItems: jsonb("checklist_items").default([]), // [{item, completed, completedAt}]
  // Time tracking
  startedAt: timestamp("started_at"),
  estimatedTime: integer("estimated_time"), // In minutes
  actualTime: integer("actual_time"), // In minutes
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Support step comments for detailed step-level communication
export const supportStepComments = pgTable("support_step_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stepId: varchar("step_id").references(() => supportSteps.id).notNull(),
  senderId: varchar("sender_id").notNull(),
  senderType: varchar("sender_type").notNull(), // 'partner', 'client', 'admin'
  senderName: varchar("sender_name").notNull(),
  comment: text("comment").notNull(),
  attachments: jsonb("attachments").default([]),
  isInternal: boolean("is_internal").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Client tasks for tracking user action items and deadlines

export const insertClientTaskSchema = createInsertSchema(clientTasks).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClientTask = z.infer<typeof insertClientTaskSchema>;
export type ClientTask = typeof clientTasks.$inferSelect;

// Product applications for tracking user applications
export * from "./schema/proposals-base.ts";

// Payment integration tracking for investment proposals
// Financial Goals table for goal-based investment planning


// ============================================================
// INVESTABLE SURPLUS ENGINE - PRD Section 5
// ============================================================



// Client Segmentation - System-derived segment (PRD Section 6)
export const insertABTestingExperimentStateSchema = createInsertSchema(abTestingExperimentState).omit({ id: true, createdAt: true, updatedAt: true });
export type ABTestingExperimentState = typeof abTestingExperimentState.$inferSelect;
export type InsertABTestingExperimentState = z.infer<typeof insertABTestingExperimentStateSchema>;

export const insertABTestingMetricsSchema = createInsertSchema(abTestingMetrics).omit({ id: true, createdAt: true });
export type ABTestingMetrics = typeof abTestingMetrics.$inferSelect;
export type InsertABTestingMetrics = z.infer<typeof insertABTestingMetricsSchema>;

// ============================================================
// AGENT ENABLEMENT & GOVERNANCE - Performance & Certification
// ============================================================

// Agent Performance Metrics - Time-series capable







export const insertClientSegmentSchema = createInsertSchema(clientSegments).omit({ id: true, createdAt: true, updatedAt: true });
export type ClientSegment = typeof clientSegments.$inferSelect;
export type InsertClientSegment = z.infer<typeof insertClientSegmentSchema>;

export const insertTreasuryMandateSchema = createInsertSchema(treasuryMandates).omit({ id: true, createdAt: true, updatedAt: true });
export type TreasuryMandate = typeof treasuryMandates.$inferSelect;
export type InsertTreasuryMandate = z.infer<typeof insertTreasuryMandateSchema>;

export const insertTreasuryAllocationSchema = createInsertSchema(treasuryAllocations).omit({ id: true, createdAt: true, updatedAt: true });
export type TreasuryAllocation = typeof treasuryAllocations.$inferSelect;
export type InsertTreasuryAllocation = z.infer<typeof insertTreasuryAllocationSchema>;

export const insertTreasuryProposalSchema = createInsertSchema(treasuryProposals).omit({ id: true, createdAt: true, updatedAt: true });
export type TreasuryProposal = typeof treasuryProposals.$inferSelect;
export type InsertTreasuryProposal = z.infer<typeof insertTreasuryProposalSchema>;

export const insertRebalancingRecommendationSchema = createInsertSchema(rebalancingRecommendations).omit({ id: true, createdAt: true, updatedAt: true });
export type RebalancingRecommendation = typeof rebalancingRecommendations.$inferSelect;
export type InsertRebalancingRecommendation = z.infer<typeof insertRebalancingRecommendationSchema>;

export const insertReturnForecastSchema = createInsertSchema(returnForecasts).omit({ id: true, createdAt: true, updatedAt: true });
export type ReturnForecast = typeof returnForecasts.$inferSelect;
export type InsertReturnForecast = z.infer<typeof insertReturnForecastSchema>;

export const insertRecommendationExplanationSchema = createInsertSchema(recommendationExplanations).omit({ id: true, createdAt: true });
export type RecommendationExplanation = typeof recommendationExplanations.$inferSelect;
export type InsertRecommendationExplanation = z.infer<typeof insertRecommendationExplanationSchema>;

// Segment classification enums
export const ClientSegmentEnum = z.enum(['retail', 'hni', 'shni', 'bhni', 'corporate']);
export const IncomeTypeEnum = z.enum(['salary', 'business', 'rental', 'interest', 'dividend', 'capital_gains', 'pension', 'other']);
export const ObligationTypeEnum = z.enum(['home_loan', 'car_loan', 'personal_loan', 'credit_card', 'education_loan', 'other_emi', 'insurance_premium', 'rent', 'utility', 'maintenance']);
export const TreasuryBucketEnum = z.enum(['operating_cash', 'liquidity_buffer', 'short_term_parking', 'yield_accrual']);
export const RebalancingTriggerEnum = z.enum(['over_allocation', 'under_allocation', 'goal_deviation', 'risk_breach', 'better_alternative', 'credit_downgrade']);



// Scheme Rename Log - Tracks scheme name changes detected during AMFI sync for audit trail


// Proposal Audit Log - Immutable event log for proposal compliance tracking

// Proposal Versions - Tracks proposal changes when schemes are auto-replaced
export type ProposalVersion = typeof proposalVersions.$inferSelect;
export type InsertProposalVersion = z.infer<typeof insertProposalVersionSchema>;

// Proposal Backtest Results - Stores fair comparison between old and proposed portfolios
export type ProposalBacktestResult = typeof proposalBacktestResults.$inferSelect;
export type InsertProposalBacktestResult = z.infer<typeof insertProposalBacktestResultSchema>;

// NAV History table for storing daily NAV data from MFapi.in

export type MfSchemeStockHolding = typeof mfSchemeStockHoldings.$inferSelect;
export type InsertMfSchemeStockHolding = z.infer<typeof insertMfSchemeStockHoldingsSchema>;

// Stock Intersection Analysis Results - Cached analysis for portfolio overlap
export const stockIntersectionAnalysis = pgTable("stock_intersection_analysis", {
  id: uuid("id").primaryKey().defaultRandom(),
  portfolioId: uuid("portfolio_id"),
  prospectId: uuid("prospect_id"),
  userId: uuid("user_id"),
  analysisDate: timestamp("analysis_date").defaultNow(),
  totalFundsAnalyzed: integer("total_funds_analyzed").default(0),
  totalStocksFound: integer("total_stocks_found").default(0),
  overlappingStocksCount: integer("overlapping_stocks_count").default(0),
  highRiskStocksCount: integer("high_risk_stocks_count").default(0),
  mediumRiskStocksCount: integer("medium_risk_stocks_count").default(0),
  stockOverlaps: jsonb("stock_overlaps"),
  sectorConcentration: jsonb("sector_concentration"),
  diversificationScore: decimal("diversification_score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  portfolioIdIdx: index("stock_intersection_portfolio_id_idx").on(table.portfolioId),
  prospectIdIdx: index("stock_intersection_prospect_id_idx").on(table.prospectId),
  userIdIdx: index("stock_intersection_user_id_idx").on(table.userId),
  analysisDateIdx: index("stock_intersection_analysis_date_idx").on(table.analysisDate),
}));

export const insertStockIntersectionAnalysisSchema = createInsertSchema(stockIntersectionAnalysis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type StockIntersectionAnalysis = typeof stockIntersectionAnalysis.$inferSelect;
export type InsertStockIntersectionAnalysis = z.infer<typeof insertStockIntersectionAnalysisSchema>;


// MF Tax Rules table for current tax rates

// Listed Stocks table for equity recommendations
export const listedStocks = pgTable("listed_stocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Stock identification
  symbol: varchar("symbol").notNull().unique(), // NSE symbol (e.g., 'RELIANCE', 'TCS')
  isin: varchar("isin").unique(), // ISIN code
  bseCode: varchar("bse_code"), // BSE scrip code
  nseCode: varchar("nse_code"), // NSE series (EQ, BE, etc.)
  companyName: text("company_name").notNull(),
  
  // Classification
  
  // Company unique identifiers (for enrichment and deduplication)
  cin: varchar("cin").unique(), // Corporate Identity Number (MCA format)
  companyPan: varchar("company_pan").unique(), // Company PAN (AAACR1234A format)
  sector: varchar("sector"), // 185 granular sectors from NSE/BSE
  broadSector: varchar("broad_sector"), // Consolidated to 12 broad sectors for AI recommendations
  industry: varchar("industry"), // More specific classification
  marketCap: varchar("market_cap"), // Large Cap, Mid Cap, Small Cap
  indexMembership: jsonb("index_membership").default([]), // ['NIFTY50', 'SENSEX', 'NIFTY100', etc.]
  exchangeInfo: jsonb("exchange_info").default({}), // Multi-exchange: {nse: {symbol, listed}, bse: {code, listed}, global: [...]}
  
  // Price data
  currentPrice: decimal("current_price", { precision: 15, scale: 2 }),
  previousClose: decimal("previous_close", { precision: 15, scale: 2 }),
  dayChange: decimal("day_change", { precision: 10, scale: 2 }),
  dayChangePercent: decimal("day_change_percent", { precision: 8, scale: 4 }),
  weekHigh52: decimal("week_high_52", { precision: 15, scale: 2 }),
  weekLow52: decimal("week_low_52", { precision: 15, scale: 2 }),
  
  // Fundamentals
  marketCapValue: decimal("market_cap_value", { precision: 20, scale: 2 }), // Market cap in crores
  peRatio: decimal("pe_ratio", { precision: 10, scale: 2 }),
  pbRatio: decimal("pb_ratio", { precision: 10, scale: 2 }),
  dividendYield: decimal("dividend_yield", { precision: 8, scale: 4 }),
  eps: decimal("eps", { precision: 15, scale: 2 }),
  bookValue: decimal("book_value", { precision: 15, scale: 2 }),
  roe: decimal("roe", { precision: 8, scale: 2 }), // Return on Equity %
  roce: decimal("roce", { precision: 8, scale: 2 }), // Return on Capital Employed %
  
  // Performance
  returns1M: decimal("returns_1m", { precision: 8, scale: 4 }),
  returns3M: decimal("returns_3m", { precision: 8, scale: 4 }),
  returns6M: decimal("returns_6m", { precision: 8, scale: 4 }),
  returns1Y: decimal("returns_1y", { precision: 8, scale: 4 }),
  returns3Y: decimal("returns_3y", { precision: 8, scale: 4 }),
  returns5Y: decimal("returns_5y", { precision: 8, scale: 4 }),
  
  // Risk metrics
  beta: decimal("beta", { precision: 6, scale: 4 }),
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  riskLevel: varchar("risk_level"), // Low, Moderate, High, Very High
  
  // Analyst ratings
  analystRating: varchar("analyst_rating"), // Strong Buy, Buy, Hold, Sell, Strong Sell
  targetPrice: decimal("target_price", { precision: 15, scale: 2 }),
  numberOfAnalysts: integer("number_of_analysts"),
  
  // Trading info
  averageVolume: decimal("average_volume", { precision: 15, scale: 0 }),
  faceValue: decimal("face_value", { precision: 10, scale: 2 }).default("10"),
  lotSize: integer("lot_size").default(1),
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }).default("0"),
  
  // Publishing controls
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by"),
  
  // Stock selection reason (for AI recommendations)
  selectionNotes: text("selection_notes"), // Why this stock is recommended
  investmentThesis: text("investment_thesis"), // Investment thesis/rationale
  
  // Time-series tracking (Instrument Time-Series Architecture)
  historicalStartDate: date("historical_start_date"),
  historicalEndDate: date("historical_end_date"),
  historicalComplete: boolean("historical_complete").default(false),
  lastDailyUpdate: date("last_daily_update"),
  isActive: boolean("is_active").default(true),
  
  // Metadata
  dataSource: varchar("data_source").default("nse"), // 'nse', 'bse', 'manual'
  enrichmentStatus: varchar("enrichment_status").default("pending"), // 'pending', 'partial', 'complete', 'failed'
  lastEnrichedAt: timestamp("last_enriched_at"), // Last successful enrichment
  enrichmentSource: varchar("enrichment_source"), // 'probe42', 'nse', 'bse', 'finnhub'
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertListedStockSchema = createInsertSchema(listedStocks).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export type ListedStock = typeof listedStocks.$inferSelect;
export type InsertListedStock = z.infer<typeof insertListedStockSchema>;

// AMC (Asset Management Company) control table for bulk publishing



// AIF (Alternative Investment Fund) comprehensive schema
/** @deprecated Use aif_master as the canonical AIF table. aif_funds is legacy and unused. */

// Risk Profiling Schema
export const riskProfiles = pgTable("risk_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  riskTolerance: varchar("risk_tolerance").notNull(), // 'conservative', 'moderate', 'aggressive', 'very_aggressive'
  investmentHorizon: varchar("investment_horizon").notNull(), // 'short', 'medium', 'long', 'very_long'
  investmentExperience: varchar("investment_experience").notNull(), // 'beginner', 'intermediate', 'advanced', 'expert'
  incomeStability: varchar("income_stability").notNull(), // 'stable', 'variable', 'irregular'
  liquidityNeeds: varchar("liquidity_needs").notNull(), // 'high', 'medium', 'low'
  age: integer("age"),
  dependents: integer("dependents").default(0),
  monthlyIncome: decimal("monthly_income", { precision: 15, scale: 2 }),
  monthlyExpenses: decimal("monthly_expenses", { precision: 15, scale: 2 }),
  existingAssets: decimal("existing_assets", { precision: 15, scale: 2 }),
  existingLiabilities: decimal("existing_liabilities", { precision: 15, scale: 2 }),
  questionnaire: jsonb("questionnaire"), // Store questionnaire responses
  riskScore: integer("risk_score"), // Calculated risk score (1-100)
  assessedBy: varchar("assessed_by").references(() => users.id), // Admin/support user who assessed
  assessmentDate: timestamp("assessment_date").defaultNow().notNull(),
  reviewDate: timestamp("review_date"), // Next review date
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const riskAssessmentQuestions = pgTable("risk_assessment_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: varchar("category").notNull(), // 'risk_tolerance', 'investment_goals', 'financial_situation'
  question: text("question").notNull(),
  questionType: varchar("question_type").notNull(), // 'multiple_choice', 'scale', 'yes_no'
  options: jsonb("options"), // For multiple choice questions
  weightage: integer("weightage").default(1), // Question importance weight
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});



export const insertPortfolioSchema = createInsertSchema(portfolios).omit({
  id: true,
  createdAt: true,
});

export const insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldings).omit({
  id: true,
  updatedAt: true,
});

export const insertExternalHoldingSchema = createInsertSchema(externalHoldings).omit({
  id: true,
  createdAt: true,
  lastSyncedAt: true,
  cobInitiatedAt: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlists).omit({
  id: true,
  createdAt: true,
});


export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComprehensiveHoldingSchema = createInsertSchema(comprehensiveHoldings).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
  updatedAt: true,
});



export const insertAifFundSchema = createInsertSchema(aifFunds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastNavUpdate: true,
});





// User Bank Accounts schemas and types  
export const insertUserBankAccountSchema = createInsertSchema(userBankAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserBankAccount = z.infer<typeof insertUserBankAccountSchema>;
export type UserBankAccount = typeof userBankAccounts.$inferSelect;

// User Demat Accounts schemas and types  
export const insertUserDematAccountSchema = createInsertSchema(userDematAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserDematAccount = z.infer<typeof insertUserDematAccountSchema>;
export type UserDematAccount = typeof userDematAccounts.$inferSelect;

// Product Account Preferences schemas and types
export const insertRiskProfileSchema = createInsertSchema(riskProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRiskAssessmentQuestionSchema = createInsertSchema(riskAssessmentQuestions).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// User Profile types
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UpsertUserProfile = typeof userProfiles.$inferInsert;


export type RiskProfile = typeof riskProfiles.$inferSelect;
export type InsertRiskProfile = z.infer<typeof insertRiskProfileSchema>;
export type RiskAssessmentQuestion = typeof riskAssessmentQuestions.$inferSelect;
export type InsertRiskAssessmentQuestion = z.infer<typeof insertRiskAssessmentQuestionSchema>;

// User Activity schemas
export const insertUserActivitySchema = createInsertSchema(userActivities).omit({
  id: true,
  createdAt: true,
});
export type InsertUserActivity = z.infer<typeof insertUserActivitySchema>;
export type UserActivity = typeof userActivities.$inferSelect;

// Admin Settings schemas
export const insertAdminSettingSchema = createInsertSchema(adminSettings).omit({
  id: true,
  updatedAt: true,
});
export type InsertAdminSetting = z.infer<typeof insertAdminSettingSchema>;
export type AdminSetting = typeof adminSettings.$inferSelect;

// User Notifications schemas
export const insertUserNotificationSchema = createInsertSchema(userNotifications).omit({
  id: true,
  createdAt: true,
});
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;
export type UserNotification = typeof userNotifications.$inferSelect;

// Partner Portal schemas
export const insertPartnerSchema = createInsertSchema(partners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Partner = typeof partners.$inferSelect;

// Partner Referral schemas
export const insertPartnerReferralSchema = createInsertSchema(partnerReferrals).omit({
  id: true,
  createdAt: true,
});
export type InsertPartnerReferral = z.infer<typeof insertPartnerReferralSchema>;
export type PartnerReferral = typeof partnerReferrals.$inferSelect;

// Partner Commission schemas
export const insertPartnerCommissionSchema = createInsertSchema(partnerCommissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPartnerCommission = z.infer<typeof insertPartnerCommissionSchema>;
export type PartnerCommission = typeof partnerCommissions.$inferSelect;

// Partner Settlement schemas
export const insertPartnerSettlementSchema = createInsertSchema(partnerSettlements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPartnerSettlement = z.infer<typeof insertPartnerSettlementSchema>;
export type PartnerSettlement = typeof partnerSettlements.$inferSelect;

// Partner Hierarchy Agreement schemas
export const insertPartnerHierarchyAgreementSchema = createInsertSchema(partnerHierarchyAgreements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPartnerHierarchyAgreement = z.infer<typeof insertPartnerHierarchyAgreementSchema>;
export type PartnerHierarchyAgreement = typeof partnerHierarchyAgreements.$inferSelect;

// Partner Commission Rule schemas
export const insertPartnerCommissionRuleSchema = createInsertSchema(partnerCommissionRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPartnerCommissionRule = z.infer<typeof insertPartnerCommissionRuleSchema>;
export type PartnerCommissionRule = typeof partnerCommissionRules.$inferSelect;

// Partner Wallet schemas
export const insertPartnerWalletSchema = createInsertSchema(partnerWallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPartnerWallet = z.infer<typeof insertPartnerWalletSchema>;
export type PartnerWallet = typeof partnerWallets.$inferSelect;

// Partner Commission Ledger schemas

// Partner Audit Log schemas
export const insertPartnerAuditLogSchema = createInsertSchema(partnerAuditLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertPartnerAuditLog = z.infer<typeof insertPartnerAuditLogSchema>;
export type PartnerAuditLog = typeof partnerAuditLogs.$inferSelect;

// Partner Client Ownership schemas


// Commission Config schemas

// Progressive Commission Ledger schemas

// Commission Execution schemas

// Dispute Cases schemas

// Reversal Ledger schemas

// Agent schemas
export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// Zoho Connections schemas
export const insertZohoConnectionSchema = createInsertSchema(zohoConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertZohoConnection = z.infer<typeof insertZohoConnectionSchema>;
export type ZohoConnection = typeof zohoConnections.$inferSelect;

// Zoho Entity Mappings schemas
export const insertZohoEntityMappingSchema = createInsertSchema(zohoEntityMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertZohoEntityMapping = z.infer<typeof insertZohoEntityMappingSchema>;
export type ZohoEntityMapping = typeof zohoEntityMappings.$inferSelect;

// Zoho Sync Logs schemas
export const insertZohoSyncLogSchema = createInsertSchema(zohoSyncLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertZohoSyncLog = z.infer<typeof insertZohoSyncLogSchema>;
export type ZohoSyncLog = typeof zohoSyncLogs.$inferSelect;

// Zoho Webhook Events schemas
export const insertZohoWebhookEventSchema = createInsertSchema(zohoWebhookEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertZohoWebhookEvent = z.infer<typeof insertZohoWebhookEventSchema>;
export type ZohoWebhookEvent = typeof zohoWebhookEvents.$inferSelect;

// Agent Portal API response types
export const agentProfileApiSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  employeeId: z.string().nullable(),
  euinNumber: z.string().nullable(),
  arnCode: z.string().nullable(),
  distributorId: z.string().nullable(),
  specializations: z.array(z.string()),
  languages: z.array(z.string()),
  status: z.string()
});

export const agentStatsApiSchema = z.object({
  totalPartners: z.number(),
  activePartners: z.number(), 
  totalClients: z.number(),
  activeClients: z.number(),
  monthlyCommissions: z.string(),
  commissionGrowth: z.number(),
  pendingTasks: z.number(),
  urgentTasks: z.number(),
  recentActivity: z.array(z.object({
    description: z.string(),
    timestamp: z.string()
  }))
});

export const partnerApiSchema = z.object({
  id: z.string(),
  companyName: z.string(),
  contactEmail: z.string(),
  contactPhone: z.string(),
  address: z.string().optional(),
  website: z.string().optional(),
  partnerType: z.enum(["product_provider", "service_provider", "both"]),
  businessLicense: z.string().optional(),
  taxId: z.string().optional(),
  euinNumber: z.string().nullable(),
  arnCode: z.string().nullable(),
  masterAgentEuin: z.string().nullable(),
  hasEuinArn: z.boolean()
});

// API response types for agent portal
export type AgentProfile = z.infer<typeof agentProfileApiSchema>;
export type AgentStats = z.infer<typeof agentStatsApiSchema>;
export type AgentPartner = z.infer<typeof partnerApiSchema>;


export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

export const insertTicketMessageSchema = createInsertSchema(ticketMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertTicketMessage = z.infer<typeof insertTicketMessageSchema>;
export type TicketMessage = typeof ticketMessages.$inferSelect;


// Support Templates Schema
export const insertSupportTemplateSchema = createInsertSchema(supportTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSupportTemplate = z.infer<typeof insertSupportTemplateSchema>;
export type SupportTemplate = typeof supportTemplates.$inferSelect;

// Support Steps Schema
export const insertSupportStepSchema = createInsertSchema(supportSteps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSupportStep = z.infer<typeof insertSupportStepSchema>;
export type SupportStep = typeof supportSteps.$inferSelect;

// Support Step Comments Schema
export const insertSupportStepCommentSchema = createInsertSchema(supportStepComments).omit({
  id: true,
  createdAt: true,
});
export type InsertSupportStepComment = z.infer<typeof insertSupportStepCommentSchema>;
export type SupportStepComment = typeof supportStepComments.$inferSelect;

export const insertCustomerCareAgentSchema = createInsertSchema(customerCareAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCustomerCareAgent = z.infer<typeof insertCustomerCareAgentSchema>;
export type CustomerCareAgent = typeof customerCareAgents.$inferSelect;

// Achievement Categories Table
export const achievementCategories = pgTable("achievement_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Achievements Table
export const achievements = pgTable("achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => achievementCategories.id),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 50 }),
  badgeImage: varchar("badge_image", { length: 255 }),
  points: integer("points").default(0),
  difficulty: varchar("difficulty", { length: 20 }).default('beginner'), // beginner, intermediate, advanced, expert
  requirements: jsonb("requirements"), // JSON object defining achievement criteria
  shareTemplate: text("share_template"), // Template for social sharing
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Achievements Table (comprehensive)
export const userAchievements = pgTable("user_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  achievementId: varchar("achievement_id").references(() => achievements.id),
  earnedAt: timestamp("earned_at").defaultNow(),
  progress: decimal("progress", { precision: 5, scale: 2 }).default('0'), // 0-100%
  isCompleted: boolean("is_completed").default(false),
  sharedCount: integer("shared_count").default(0),
  lastSharedAt: timestamp("last_shared_at"),
  metadata: jsonb("metadata"), // Additional data like specific values achieved
});

// Learning Progress Table
export const learningProgress = pgTable("learning_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  category: varchar("category", { length: 100 }).notNull(), // portfolio, trading, analysis, etc.
  action: varchar("action", { length: 100 }).notNull(), // specific action taken
  value: decimal("value", { precision: 15, scale: 2 }), // numerical value if applicable
  metadata: jsonb("metadata"), // additional context
  createdAt: timestamp("created_at").defaultNow(),
});

// Social Shares Table
export const socialShares = pgTable("social_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  achievementId: varchar("achievement_id").references(() => achievements.id),
  platform: varchar("platform", { length: 50 }).notNull(), // twitter, linkedin, facebook, whatsapp
  shareUrl: text("share_url"),
  shareContent: text("share_content"),
  engagementData: jsonb("engagement_data"), // likes, shares, comments if available
  createdAt: timestamp("created_at").defaultNow(),
});

// Export types for achievements
export type AchievementCategory = typeof achievementCategories.$inferSelect;
export type InsertAchievementCategory = typeof achievementCategories.$inferInsert;

export type Achievement = typeof achievements.$inferSelect;
export type InsertAchievement = typeof achievements.$inferInsert;

export type UserAchievement = typeof userAchievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;

export type LearningProgress = typeof learningProgress.$inferSelect;
export type InsertLearningProgress = typeof learningProgress.$inferInsert;

export type SocialShare = typeof socialShares.$inferSelect;
export type InsertSocialShare = typeof socialShares.$inferInsert;

// Zod schemas for validation
export const insertAchievementCategorySchema = createInsertSchema(achievementCategories).omit({
  id: true,
  createdAt: true,
});
export const insertAchievementSchema = createInsertSchema(achievements).omit({
  id: true,
  createdAt: true,
});
export const insertUserAchievementSchema = createInsertSchema(userAchievements).omit({
  id: true,
  earnedAt: true,
});
export const insertLearningProgressSchema = createInsertSchema(learningProgress).omit({
  id: true,
  createdAt: true,
});
export const insertSocialShareSchema = createInsertSchema(socialShares).omit({
  id: true,
  createdAt: true,
});

export const insertAgentPartnerMappingSchema = createInsertSchema(agentPartnerMappings).omit({
  id: true,
  createdAt: true,
});
export type InsertAgentPartnerMapping = z.infer<typeof insertAgentPartnerMappingSchema>;
export type AgentPartnerMapping = typeof agentPartnerMappings.$inferSelect;

// Agent Commission Split schemas
export const insertAgentCommissionSplitSchema = createInsertSchema(agentCommissionSplits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentCommissionSplit = z.infer<typeof insertAgentCommissionSplitSchema>;
export type AgentCommissionSplit = typeof agentCommissionSplits.$inferSelect;

// Agent Documents schemas
export const insertAgentDocumentSchema = createInsertSchema(agentDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentDocument = z.infer<typeof insertAgentDocumentSchema>;
export type AgentDocument = typeof agentDocuments.$inferSelect;

// Agent Commissions schemas
export const insertAgentCommissionSchema = createInsertSchema(agentCommissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAgentCommission = z.infer<typeof insertAgentCommissionSchema>;
export type AgentCommission = typeof agentCommissions.$inferSelect;

// AMFI Verification Log schemas

export type InsertPortfolio = z.infer<typeof insertPortfolioSchema>;
export type InsertExternalHolding = z.infer<typeof insertExternalHoldingSchema>;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;

export type ComprehensiveHolding = typeof comprehensiveHoldings.$inferSelect;
export type InsertComprehensiveHolding = z.infer<typeof insertComprehensiveHoldingSchema>;
export type PiChatSummary = typeof piChatSummaries.$inferSelect;
export type InsertPiChatSummary = typeof piChatSummaries.$inferInsert;
export type CommodityPrice = typeof commodityPrices.$inferSelect;
export type InsertCommodityPrice = typeof commodityPrices.$inferInsert;
export type RebalancingSuggestion = typeof rebalancingSuggestions.$inferSelect;
export type InsertRebalancingSuggestion = typeof rebalancingSuggestions.$inferInsert;


// Learning Modules and Lessons
export const learningModules = pgTable("learning_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  difficulty: varchar("difficulty").notNull(), // 'beginner', 'intermediate', 'advanced'
  category: varchar("category").notNull(), // 'basics', 'trading', 'risk-management', 'market-analysis'
  orderIndex: integer("order_index").notNull().default(0),
  estimatedMinutes: integer("estimated_minutes").default(30),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const learningLessons = pgTable("learning_lessons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => learningModules.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  contentType: varchar("content_type").notNull(), // 'text', 'video', 'interactive'
  orderIndex: integer("order_index").notNull().default(0),
  estimatedMinutes: integer("estimated_minutes").default(10),
  pointsReward: integer("points_reward").default(50),
  createdAt: timestamp("created_at").defaultNow(),
});

export const learningQuizzes = pgTable("learning_quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  lessonId: varchar("lesson_id").references(() => learningLessons.id).notNull(),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
  explanation: text("explanation"),
  pointsReward: integer("points_reward").default(25),
  createdAt: timestamp("created_at").defaultNow(),
});

// User Progress and Achievements
export const userProgress = pgTable("user_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  moduleId: varchar("module_id").references(() => learningModules.id),
  lessonId: varchar("lesson_id").references(() => learningLessons.id),
  status: varchar("status").notNull(), // 'not_started', 'in_progress', 'completed'
  score: integer("score").default(0),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Removed duplicate userAchievements table - using the comprehensive version above

export const userStats = pgTable("user_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  totalPoints: integer("total_points").default(0),
  currentStreak: integer("current_streak").default(0),
  maxStreak: integer("max_streak").default(0),
  modulesCompleted: integer("modules_completed").default(0),
  lessonsCompleted: integer("lessons_completed").default(0),
  quizzesCompleted: integer("quizzes_completed").default(0),
  averageScore: decimal("average_score", { precision: 5, scale: 2 }).default("0"),
  lastActivityAt: timestamp("last_activity_at"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Learning system schemas and types
export const insertLearningModuleSchema = createInsertSchema(learningModules).omit({
  id: true,
  createdAt: true,
});

export const insertLearningLessonSchema = createInsertSchema(learningLessons).omit({
  id: true,
  createdAt: true,
});

export const insertLearningQuizSchema = createInsertSchema(learningQuizzes).omit({
  id: true,
  createdAt: true,
});

export const insertUserProgressSchema = createInsertSchema(userProgress).omit({
  id: true,
  updatedAt: true,
});

// Removed duplicate insertUserAchievementSchema - using the comprehensive version above

export const insertUserStatsSchema = createInsertSchema(userStats).omit({
  id: true,
  updatedAt: true,
});

// Export types for learning system
export type LearningModule = typeof learningModules.$inferSelect;
export type InsertLearningModule = z.infer<typeof insertLearningModuleSchema>;
export type LearningLesson = typeof learningLessons.$inferSelect;
export type InsertLearningLesson = z.infer<typeof insertLearningLessonSchema>;
export type LearningQuiz = typeof learningQuizzes.$inferSelect;
export type InsertLearningQuiz = z.infer<typeof insertLearningQuizSchema>;
export type UserProgress = typeof userProgress.$inferSelect;
export type InsertUserProgress = z.infer<typeof insertUserProgressSchema>;
// Removed duplicate UserAchievement type - using the comprehensive version above
export type UserStats = typeof userStats.$inferSelect;
export type InsertUserStats = z.infer<typeof insertUserStatsSchema>;


// Market Stories table for AI-generated content
export const marketStories = pgTable("market_stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  summary: text("summary").notNull(),
  sentiment: varchar("sentiment", { length: 20 }).notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).notNull(),
  keyPoints: text("key_points").array().default([]),
  marketData: jsonb("market_data"),
  generatedAt: timestamp("generated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Capital Gains Reports
export const capitalGainsReports = pgTable("capital_gains_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  financialYear: varchar("financial_year").notNull(), // e.g., "2023-24"
  reportType: varchar("report_type").notNull(), // 'capital_gains', 'transaction_summary'
  source: varchar("source").notNull(), // 'iris', 'nsdl', 'cdsl', 'kfintech', 'cams'
  totalShortTermGains: decimal("total_short_term_gains", { precision: 15, scale: 2 }).default("0"),
  totalLongTermGains: decimal("total_long_term_gains", { precision: 15, scale: 2 }).default("0"),
  totalDividend: decimal("total_dividend", { precision: 15, scale: 2 }).default("0"),
  totalTdsDeducted: decimal("total_tds_deducted", { precision: 15, scale: 2 }).default("0"),
  reportData: jsonb("report_data"), // Complete report data from external sources
  generatedAt: timestamp("generated_at").defaultNow(),
  fetchedAt: timestamp("fetched_at"),
  status: varchar("status").default("pending"), // 'pending', 'processing', 'completed', 'failed'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transaction Reports from various registrars
export const transactionReports = pgTable("transaction_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  financialYear: varchar("financial_year").notNull(),
  source: varchar("source").notNull(), // 'iris', 'nsdl', 'cdsl', 'kfintech', 'cams'
  assetType: varchar("asset_type").notNull(), // 'mutual_fund', 'equity', 'bond', 'etf'
  totalPurchases: decimal("total_purchases", { precision: 15, scale: 2 }).default("0"),
  totalRedemptions: decimal("total_redemptions", { precision: 15, scale: 2 }).default("0"),
  totalSwitches: decimal("total_switches", { precision: 15, scale: 2 }).default("0"),
  totalDividendReceived: decimal("total_dividend_received", { precision: 15, scale: 2 }).default("0"),
  totalBrokerage: decimal("total_brokerage", { precision: 15, scale: 2 }).default("0"),
  totalTaxes: decimal("total_taxes", { precision: 15, scale: 2 }).default("0"),
  transactionCount: integer("transaction_count").default(0),
  reportData: jsonb("report_data"), // Detailed transaction data
  generatedAt: timestamp("generated_at").defaultNow(),
  fetchedAt: timestamp("fetched_at"),
  status: varchar("status").default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual Transaction Records
export const transactionRecords = pgTable("transaction_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => transactionReports.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  transactionDate: date("transaction_date").notNull(),
  transactionType: varchar("transaction_type").notNull(), // 'purchase', 'redemption', 'switch_in', 'switch_out', 'dividend'
  fundName: text("fund_name").notNull(),
  fundCode: varchar("fund_code"),
  folio: varchar("folio"),
  units: decimal("units", { precision: 15, scale: 6 }),
  nav: decimal("nav", { precision: 15, scale: 4 }),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  brokerage: decimal("brokerage", { precision: 15, scale: 2 }).default("0"),
  stt: decimal("stt", { precision: 15, scale: 2 }).default("0"),
  stampDuty: decimal("stamp_duty", { precision: 15, scale: 2 }).default("0"),
  gst: decimal("gst", { precision: 15, scale: 2 }).default("0"),
  tds: decimal("tds", { precision: 15, scale: 2 }).default("0"),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }),
  registrar: varchar("registrar"), // 'CAMS', 'KFINTECH', 'NSDL', 'CDSL'
  createdAt: timestamp("created_at").defaultNow(),
});

// TypeScript types for capital gains and transaction reports
export type CapitalGainsReport = typeof capitalGainsReports.$inferSelect;
export type InsertCapitalGainsReport = typeof capitalGainsReports.$inferInsert;
export type TransactionReport = typeof transactionReports.$inferSelect;
export type InsertTransactionReport = typeof transactionReports.$inferInsert;
export type TransactionRecord = typeof transactionRecords.$inferSelect;
export type InsertTransactionRecord = typeof transactionRecords.$inferInsert;

// Client Data Enrichment Tables for AI-powered analytics and external data integration

// External Data Sources table for tracking API integrations used for client enrichment
export const externalDataSources = pgTable("external_data_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceName: varchar("source_name").notNull(), // gstin, pan_verification, credit_score, bank_statement, social_media
  sourceType: varchar("source_type").notNull(), // financial, regulatory, social, business, verification
  provider: varchar("provider").notNull(), // karza, signzy, bureau, bank_api, fintech_api
  apiEndpoint: varchar("api_endpoint"),
  isActive: boolean("is_active").default(true),
  rateLimit: integer("rate_limit_per_hour"),
  costPerCall: decimal("cost_per_call", { precision: 10, scale: 4 }),
  dataRetentionDays: integer("data_retention_days").default(365),
  lastUsed: timestamp("last_used"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Client Data Enrichment records - stores enriched data from various external sources
// NOTE: Schema matches actual database structure. See tech-debt: original expanded schema preserved below as comment.

/* TODO: Future schema expansion for client_enrichment_data
   Original expanded schema included: sourceId, enrichmentType, dataCategory, enrichmentScore,
   confidenceLevel, estimatedIncome, incomeStability, spendingPattern, creditworthiness,
   riskIndicators, businessTurnover, businessType, industryRisk, businessVintage, gstCompliance,
   digitalFootprint, socialConnections, lifestyleIndicators, isVerified, verificationMethod,
   lastUpdated, expiryDate, aiModelUsed, processingTime, apiCallCount
   Requires ALTER TABLE migration before enabling.
*/

// AI Transaction Tracking - comprehensive transaction monitoring both on-site and external

// Transaction Enrichment Analysis - stores AI-generated insights and patterns
// NOTE: Schema matches actual database structure. See tech-debt: original expanded schema preserved below as comment.
export const transactionEnrichmentAnalysis = pgTable("transaction_enrichment_analysis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  transactionId: varchar("transaction_id"), // Reference to transaction
  analysisType: varchar("analysis_type"), // Type of analysis performed
  category: varchar("category"), // Category of the analysis
  
  // Timing
  fromDate: timestamp("from_date"),
  toDate: timestamp("to_date"),
  
  // Metrics
  transactionCount: integer("transaction_count"),
  totalInflow: decimal("total_inflow", { precision: 15, scale: 2 }),
  totalOutflow: decimal("total_outflow", { precision: 15, scale: 2 }),
  netCashFlow: decimal("net_cash_flow", { precision: 15, scale: 2 }),
  averageMonthlyIncome: decimal("average_monthly_income", { precision: 15, scale: 2 }),
  averageMonthlyExpense: decimal("average_monthly_expense", { precision: 15, scale: 2 }),
  
  // Patterns (JSONB)
  spendingPatterns: jsonb("spending_patterns"),
  incomePatterns: jsonb("income_patterns"),
  timingPatterns: jsonb("timing_patterns"),
  frequencyPatterns: jsonb("frequency_patterns"),
  
  // Risk & Scoring
  riskFactors: jsonb("risk_factors"), // Array of risk factors
  riskScore: integer("risk_score"),
  riskCategory: varchar("risk_category"),
  creditworthinessScore: integer("creditworthiness_score"),
  
  // Capacity
  disposableIncome: decimal("disposable_income", { precision: 15, scale: 2 }),
  investmentCapacity: decimal("investment_capacity", { precision: 15, scale: 2 }),
  emergencyFundStatus: varchar("emergency_fund_status"),
  debtToIncomeRatio: decimal("debt_to_income_ratio", { precision: 5, scale: 2 }),
  
  // Metadata
  aiModelVersion: varchar("ai_model_version"),
  analysisConfidence: decimal("analysis_confidence", { precision: 5, scale: 2 }),
  nextAnalysisDate: timestamp("next_analysis_date"),
  
  insights: jsonb("insights"), // AI-generated insights
  patterns: jsonb("patterns"), // Detected patterns
  recommendations: jsonb("recommendations"), // AI recommendations
  confidenceScore: integer("confidence_score"), // 0-100 confidence
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* TODO: Future schema expansion for transaction_enrichment_analysis
   Original expanded schema included: fromDate, toDate, transactionCount, totalInflow,
   totalOutflow, netCashFlow, averageMonthlyIncome, averageMonthlyExpense, spendingPatterns,
   incomePatterns, timingPatterns, frequencyPatterns, riskFactors, riskScore, riskCategory,
   creditworthinessScore, disposableIncome, investmentCapacity, emergencyFundStatus,
   debtToIncomeRatio, aiModelVersion, analysisConfidence, lastUpdated, nextAnalysisDate
   Requires ALTER TABLE migration before enabling.
*/

// Real-time Transaction Alerts for monitoring and compliance
export const transactionAlerts = pgTable("transaction_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  transactionId: varchar("transaction_id").references(() => aiTransactionTracking.id),
  
  // Alert classification
  alertType: varchar("alert_type").notNull(), // suspicious_activity, large_transaction, unusual_pattern, compliance_violation
  severity: varchar("severity").notNull(), // low, medium, high, critical
  alertCategory: varchar("alert_category").notNull(), // aml, fraud, risk, compliance, investment_opportunity
  
  // Alert details
  alertTitle: varchar("alert_title").notNull(),
  alertDescription: text("alert_description").notNull(),
  riskScore: integer("risk_score"), // 0-100
  confidenceLevel: integer("confidence_level"), // 0-100 AI confidence in alert
  
  // Triggering conditions
  triggerConditions: jsonb("trigger_conditions"), // What triggered this alert
  thresholdExceeded: jsonb("threshold_exceeded"), // Which thresholds were exceeded
  historicalComparison: jsonb("historical_comparison"), // How this compares to user's history
  
  // Status and resolution
  status: varchar("status").default("open"), // open, investigating, resolved, false_positive
  assignedTo: varchar("assigned_to").references(() => users.id), // Compliance officer assigned
  resolutionNotes: text("resolution_notes"),
  resolutionAction: varchar("resolution_action"), // no_action, client_contacted, account_flagged, case_escalated
  
  // Notification and communication
  notificationSent: boolean("notification_sent").default(false),
  notificationMethod: varchar("notification_method"), // email, sms, whatsapp, dashboard
  clientNotified: boolean("client_notified").default(false),
  requiresClientResponse: boolean("requires_client_response").default(false),
  
  // Follow-up and tracking
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date"),
  escalationLevel: integer("escalation_level").default(0), // 0=normal, 1=supervisor, 2=compliance_head
  regulatoryReportingRequired: boolean("regulatory_reporting_required").default(false),
  
  // Metadata
  alertSource: varchar("alert_source"), // ai_model, rule_engine, manual_review, external_system
  detectedAt: timestamp("detected_at").defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// External API Integration Logs for tracking data source usage and costs
export const apiIntegrationLogs = pgTable("api_integration_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  sourceId: varchar("source_id").references(() => externalDataSources.id).notNull(),
  
  // API call details
  apiEndpoint: varchar("api_endpoint").notNull(),
  httpMethod: varchar("http_method").default("GET"),
  requestPayload: jsonb("request_payload"),
  responsePayload: jsonb("response_payload"),
  
  // Response metadata
  statusCode: integer("status_code"),
  responseTime: integer("response_time_ms"),
  success: boolean("success").default(false),
  errorMessage: text("error_message"),
  
  // Usage tracking
  dataPoints: integer("data_points"), // Number of data points retrieved
  costIncurred: decimal("cost_incurred", { precision: 10, scale: 4 }),
  rateLimit: jsonb("rate_limit"), // Rate limit information from response
  
  // Data quality
  dataQuality: varchar("data_quality"), // high, medium, low
  dataCompleteness: integer("data_completeness"), // 0-100 percentage
  confidenceScore: integer("confidence_score"), // 0-100
  
  // Processing details
  enrichmentTriggered: boolean("enrichment_triggered").default(false),
  aiProcessingTime: integer("ai_processing_time_ms"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema exports for the new enrichment and tracking tables
export const insertExternalDataSourceSchema = createInsertSchema(externalDataSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});



export const insertTransactionEnrichmentAnalysisSchema = createInsertSchema(transactionEnrichmentAnalysis).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionAlertSchema = createInsertSchema(transactionAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertApiIntegrationLogSchema = createInsertSchema(apiIntegrationLogs).omit({
  id: true,
  createdAt: true,
});

// TypeScript types for the new tables
export type ExternalDataSource = typeof externalDataSources.$inferSelect;
export type InsertExternalDataSource = typeof externalDataSources.$inferInsert;
export type TransactionEnrichmentAnalysis = typeof transactionEnrichmentAnalysis.$inferSelect;
export type InsertTransactionEnrichmentAnalysis = typeof transactionEnrichmentAnalysis.$inferInsert;
export type TransactionAlert = typeof transactionAlerts.$inferSelect;
export type InsertTransactionAlert = typeof transactionAlerts.$inferInsert;
export type ApiIntegrationLog = typeof apiIntegrationLogs.$inferSelect;
export type InsertApiIntegrationLog = typeof apiIntegrationLogs.$inferInsert;

// Insert schemas for validation
export const insertCapitalGainsReportSchema = createInsertSchema(capitalGainsReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  generatedAt: true,
});

export const insertTransactionReportSchema = createInsertSchema(transactionReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  generatedAt: true,
});

export const insertTransactionRecordSchema = createInsertSchema(transactionRecords).omit({
  id: true,
  createdAt: true,
});

export const insertMarketStorySchema = createInsertSchema(marketStories).omit({
  id: true,
  generatedAt: true,
  createdAt: true,
});

export type MarketStory = typeof marketStories.$inferSelect;
export type InsertMarketStory = z.infer<typeof insertMarketStorySchema>;

// Government Scheme Consent Tracking

export type GovernmentSchemeConsent = typeof governmentSchemeConsents.$inferSelect;
export type InsertGovernmentSchemeConsent = typeof governmentSchemeConsents.$inferInsert;

export const insertGovernmentSchemeConsentSchema = createInsertSchema(governmentSchemeConsents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// EPF Holdings types
export type EpfHolding = typeof epfHoldings.$inferSelect;
export type InsertEpfHolding = typeof epfHoldings.$inferInsert;

export const insertEpfHoldingSchema = createInsertSchema(epfHoldings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUpdated: true,
});

// AIF Fund types
export type AifFund = typeof aifFunds.$inferSelect;
export type InsertAifFund = z.infer<typeof insertAifFundSchema>;

// Pre-IPO Companies table - stores information about companies preparing for IPO


// Mainboard & SME IPO Companies table
export const ipoCompanies = pgTable("ipo_companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  sector: varchar("sector").notNull(),
  industry: varchar("industry").notNull(),
  logoUrl: text("logo_url"),
  
  // IPO Details
  ipoType: varchar("ipo_type").notNull(), // 'mainboard', 'sme'
  issueType: varchar("issue_type"), // 'Book Built', 'Fixed Price', 'Offer for Sale'
  priceBandMin: decimal("price_band_min", { precision: 10, scale: 2 }),
  priceBandMax: decimal("price_band_max", { precision: 10, scale: 2 }),
  issueSize: decimal("issue_size", { precision: 15, scale: 2 }), // in crores
  
  // Important Dates
  openDate: date("open_date"),
  closeDate: date("close_date"),
  listingDate: date("listing_date"),
  
  // Status and Performance
  status: varchar("status").notNull().default("upcoming"), // 'upcoming', 'ongoing', 'listed', 'withdrawn'
  subscriptionStatus: decimal("subscription_status", { precision: 8, scale: 2 }), // times subscribed
  
  // Listing Performance (for listed IPOs)
  listingPrice: decimal("listing_price", { precision: 10, scale: 2 }),
  listingGainPercent: decimal("listing_gain_percent", { precision: 8, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }),
  currentReturnPercent: decimal("current_return_percent", { precision: 8, scale: 4 }),
  
  // Regulatory Documents
  rhpUrl: text("rhp_url"), // Red Herring Prospectus
  drhpUrl: text("drhp_url"), // Draft Red Herring Prospectus
  
  // Additional Information
  description: text("description"),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  
  // Metadata
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// IPO Applications table - tracks user applications
export const ipoApplications = pgTable("ipo_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  ipoId: varchar("ipo_id").references(() => ipoCompanies.id).notNull(),
  
  // Application Details
  applicationAmount: decimal("application_amount", { precision: 15, scale: 2 }).notNull(),
  bidPrice: decimal("bid_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  category: varchar("category").notNull(), // 'Retail', 'HNI', 'QIB'
  
  // Status Tracking
  applicationStatus: varchar("application_status").notNull().default("applied"), // 'applied', 'confirmed', 'allotted', 'rejected'
  allotmentQuantity: integer("allotment_quantity"),
  allotmentAmount: decimal("allotment_amount", { precision: 15, scale: 2 }),
  
  // Dates
  applicationDate: timestamp("application_date").defaultNow(),
  allotmentDate: timestamp("allotment_date"),
  
  // Metadata
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// IPO News table
export const ipoNews = pgTable("ipo_news", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  summary: text("summary"),
  content: text("content"),
  category: varchar("category").notNull(), // 'filing', 'approval', 'listing', 'analysis'
  ipoId: varchar("ipo_id").references(() => ipoCompanies.id),
  sourceUrl: text("source_url"),
  publishedAt: timestamp("published_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas for IPO
export const insertIpoCompanySchema = createInsertSchema(ipoCompanies).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export const insertIpoApplicationSchema = createInsertSchema(ipoApplications).omit({
  id: true,
  lastUpdated: true,
  createdAt: true,
});

export const insertIpoNewsSchema = createInsertSchema(ipoNews).omit({
  id: true,
  createdAt: true,
});

// Export types for IPO
export type IpoCompany = typeof ipoCompanies.$inferSelect;
export type InsertIpoCompany = z.infer<typeof insertIpoCompanySchema>;
export type IpoApplication = typeof ipoApplications.$inferSelect;
export type InsertIpoApplication = z.infer<typeof insertIpoApplicationSchema>;
export type IpoNews = typeof ipoNews.$inferSelect;
export type InsertIpoNews = z.infer<typeof insertIpoNewsSchema>;


// Investment proposal types
export type InvestmentProposal = typeof investmentProposals.$inferSelect;
export type InsertInvestmentProposal = typeof investmentProposals.$inferInsert;
export type InvestmentProposalItem = typeof investmentProposalItems.$inferSelect;
export type InsertInvestmentProposalItem = typeof investmentProposalItems.$inferInsert;
export type ProposalPayment = typeof proposalPayments.$inferSelect;
export type InsertProposalPayment = typeof proposalPayments.$inferInsert;

// Client-Agent relationship types
export type ClientAgentRelationship = typeof clientAgentRelationships.$inferSelect;
export type InsertClientAgentRelationship = typeof clientAgentRelationships.$inferInsert;

// Product Store Catalog Tables
export type StoreProductImage = typeof storeProductImages.$inferSelect;
export type InsertStoreProductImage = z.infer<typeof insertStoreProductImageSchema>;
export type StoreProductTag = typeof storeProductTags.$inferSelect;
export type InsertStoreProductTag = z.infer<typeof insertStoreProductTagSchema>;
export type StoreProductTagMapping = typeof storeProductTagMappings.$inferSelect;
export type InsertStoreProductTagMapping = z.infer<typeof insertStoreProductTagMappingSchema>;
export type UserWishlist = typeof userWishlist.$inferSelect;
export type InsertUserWishlist = z.infer<typeof insertUserWishlistSchema>;

// Supplier and Product Performance Tables
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  address: text("address"),
  productCategories: text("product_categories").array(),
  performanceRating: decimal("performance_rating", { precision: 3, scale: 2 }).default("0.00"),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default("0.00"), // Commission percentage
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productPerformance = pgTable("product_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => storeProducts.id).notNull(),
  supplierId: varchar("supplier_id").references(() => suppliers.id).notNull(),
  costPrice: decimal("cost_price", { precision: 15, scale: 2 }).notNull(),
  sellingPrice: decimal("selling_price", { precision: 15, scale: 2 }).notNull(),
  profitMargin: decimal("profit_margin", { precision: 5, scale: 2 }).notNull(), // Calculated profit percentage
  salesVolume: integer("sales_volume").default(0),
  revenue: decimal("revenue", { precision: 15, scale: 2 }).default("0.00"),
  monthlyPerformance: jsonb("monthly_performance"), // Track monthly sales/profit data
  lastSaleDate: timestamp("last_sale_date"),
  isPromoted: boolean("is_promoted").default(false),
  promotionStartDate: timestamp("promotion_start_date"),
  promotionEndDate: timestamp("promotion_end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create schemas for supplier tables
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductPerformanceSchema = createInsertSchema(productPerformance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Loan Against Securities (LAS) table

// Loan Repayments table for tracking payment history

// Collateral Valuation table for tracking security values
export const collateralValuations = pgTable("collateral_valuations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  loanId: varchar("loan_id").references(() => loanApplications.id).notNull(),
  
  // Valuation Details
  valuationDate: timestamp("valuation_date").defaultNow(),
  totalCollateralValue: decimal("total_collateral_value", { precision: 15, scale: 2 }).notNull(),
  eligibleCollateralValue: decimal("eligible_collateral_value", { precision: 15, scale: 2 }).notNull(),
  haircut: decimal("haircut", { precision: 5, scale: 2 }), // Discount percentage applied
  
  // Margin and LTV
  currentLtv: decimal("current_ltv", { precision: 5, scale: 2 }),
  maxAllowedLtv: decimal("max_allowed_ltv", { precision: 5, scale: 2 }),
  marginCall: boolean("margin_call").default(false),
  marginCallDate: timestamp("margin_call_date"),
  
  // Valuation Status
  valuationMethod: varchar("valuation_method"), // market_price/model_based/manual
  valuedBy: varchar("valued_by"), // system/manual/third_party
  
  // Asset Breakdown
  assetBreakdown: jsonb("asset_breakdown"), // Detailed asset-wise valuation
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Create insert schemas for loan tables
export const insertLoanApplicationSchema = createInsertSchema(loanApplications).omit({
  id: true,
  applicationNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLoanRepaymentSchema = createInsertSchema(loanRepayments).omit({
  id: true,
  createdAt: true,
});

export const insertCollateralValuationSchema = createInsertSchema(collateralValuations).omit({
  id: true,
  createdAt: true,
});

// Export types for supplier tables
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type ProductPerformance = typeof productPerformance.$inferSelect;
export type InsertProductPerformance = z.infer<typeof insertProductPerformanceSchema>;

// Export types for loan tables
// Insurance Holdings table for NSDL/CDSL insurance policy data

// Create insert schema for insurance holdings
export const insertInsuranceHoldingSchema = createInsertSchema(insuranceHoldings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LoanApplication = typeof loanApplications.$inferSelect;
export type InsertLoanApplication = z.infer<typeof insertLoanApplicationSchema>;
export type LoanRepayment = typeof loanRepayments.$inferSelect;
export type InsertLoanRepayment = z.infer<typeof insertLoanRepaymentSchema>;
export type CollateralValuation = typeof collateralValuations.$inferSelect;
export type InsertCollateralValuation = z.infer<typeof insertCollateralValuationSchema>;
export type InsuranceHolding = typeof insuranceHoldings.$inferSelect;
export type InsertInsuranceHolding = z.infer<typeof insertInsuranceHoldingSchema>;

// Loan Marketplace Tables
// Loan Products table - Define different loan product types

// Loan Providers table - Banks and NBFCs

// Provider Products table - Product offerings by each provider

// Credit Profiles table - Enhanced client credit information

// Loan Requests table - Client loan requirements

// Loan Offers table - Generated offers from providers

// Loan Applications Marketplace - Application workflow management

// Provider Integrations table - API integration configurations

// Application Documents table - Document management for loan applications

// Create insert schemas for loan marketplace tables

// Loan Comparison Sessions table - Store comparison sessions

// Loan Comparison Analytics table - Track comparison behavior

// Create insert schemas for comparison tables
export const insertLoanComparisonSchema = createInsertSchema(loanComparisons).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});





// Bank Eligibility Rules - Configurable eligibility matrix per bank/product
export const bankEligibilityRules = pgTable("bank_eligibility_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Bank & Product
  bankCode: varchar("bank_code").notNull(), // ICICI, HDFC, AXIS, KOTAK, SBI, BAJAJ, TATA
  productType: varchar("product_type").notNull(), // personal, business, home, lap, car, education, gold, securities
  
  // Employment Eligibility
  allowedEmploymentTypes: text("allowed_employment_types").array().default([]), // ['salaried', 'self_employed', 'professional', 'business_owner']
  
  // Credit Score Requirements
  minCibilScore: integer("min_cibil_score").default(650),
  maxCibilScore: integer("max_cibil_score").default(900),
  
  // Income Requirements
  minMonthlyIncome: decimal("min_monthly_income", { precision: 12, scale: 2 }).default("20000"),
  maxMonthlyIncome: decimal("max_monthly_income", { precision: 12, scale: 2 }),
  
  // Business Loan Specific
  minBusinessVintageMonths: integer("min_business_vintage_months"), // Minimum business age in months
  minAnnualTurnover: decimal("min_annual_turnover", { precision: 15, scale: 2 }),
  
  // Loan Parameters
  minLoanAmount: decimal("min_loan_amount", { precision: 15, scale: 2 }).default("50000"),
  maxLoanAmount: decimal("max_loan_amount", { precision: 15, scale: 2 }),
  minTenureMonths: integer("min_tenure_months").default(12),
  maxTenureMonths: integer("max_tenure_months").default(60),
  
  // LAP/Home Loan Specific
  allowedPropertyTypes: text("allowed_property_types").array().default([]), // ['residential', 'commercial', 'mixed']
  maxLtvRatio: decimal("max_ltv_ratio", { precision: 5, scale: 2 }), // Loan-to-Value ratio
  
  // Age Requirements
  minAge: integer("min_age").default(21),
  maxAge: integer("max_age").default(60),
  
  // Geographic Restrictions
  allowedCities: text("allowed_cities").array().default([]), // Empty = all cities
  excludedCities: text("excluded_cities").array().default([]),
  
  // Routing Priority (lower = higher priority)
  routingPriority: integer("routing_priority").default(100),
  
  // Status & Notes
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});














// Bank Eligibility Rules Schemas
export const insertBankEligibilityRulesSchema = createInsertSchema(bankEligibilityRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});





export type LeadActivityLog = typeof leadActivityLog.$inferSelect;
export type InsertLeadActivityLog = z.infer<typeof insertLeadActivityLogSchema>;

export type InsertLoanComparison = z.infer<typeof insertLoanComparisonSchema>;

// Loan Comparison Request/Response Schemas
export const loanComparisonParamsSchema = z.object({
  amount: z.number().min(50000).max(100000000),
  tenure: z.number().min(12).max(360), // months
  loanType: z.enum(['personal', 'home', 'business', 'vehicle', 'education']),
  monthlyIncome: z.number().min(10000),
  creditScore: z.number().min(300).max(850).optional()
});

export const loanOfferSchema = z.object({
  id: z.string(),
  providerId: z.string(),
  providerName: z.string(),
  providerRating: z.number().min(0).max(5),
  productName: z.string(),
  productType: z.string(),
  
  // Financial Details
  approvedAmount: z.number(),
  interestRate: z.number(),
  tenure: z.number(),
  emi: z.number(),
  
  // Fees
  processingFee: z.number(),
  legalCharges: z.number(),
  otherCharges: z.number(),
  totalCost: z.number(),
  
  // Risk & Eligibility
  eligibilityScore: z.number(),
  approvalProbability: z.number(),
  qualityScore: z.number(),
  
  // Additional Info
  features: z.array(z.string()),
  terms: z.array(z.string()),
  responseTime: z.string(),
  rateType: z.enum(['fixed', 'floating']),
  
  // Calculated Fields
  totalInterest: z.number(),
  totalRepayment: z.number(),
  apr: z.number(), // True Annual Percentage Rate
  comparisonScore: z.number().optional()
});

export const comparisonCriteriaSchema = z.object({
  interestRate: z.number().min(0).max(100),
  processingFee: z.number().min(0).max(100),
  totalCost: z.number().min(0).max(100),
  approvalProbability: z.number().min(0).max(100),
  providerRating: z.number().min(0).max(100)
});

export type LoanComparisonParams = z.infer<typeof loanComparisonParamsSchema>;
export type LoanOfferData = z.infer<typeof loanOfferSchema>;
export type ComparisonCriteria = z.infer<typeof comparisonCriteriaSchema>;

// Financial Goals types and schema
export const insertFinancialGoalSchema = createInsertSchema(financialGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FinancialGoal = typeof financialGoals.$inferSelect;
export type InsertFinancialGoal = z.infer<typeof insertFinancialGoalSchema>;

// Goal Milestones types and schema
export const insertGoalMilestoneSchema = createInsertSchema(goalMilestones).omit({
  id: true,
  createdAt: true,
});
export type GoalMilestone = typeof goalMilestones.$inferSelect;
export type InsertGoalMilestone = z.infer<typeof insertGoalMilestoneSchema>;

// Goal Investment Links types and schema
export const insertGoalInvestmentLinkSchema = createInsertSchema(goalInvestmentLinks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type GoalInvestmentLink = typeof goalInvestmentLinks.$inferSelect;
export type InsertGoalInvestmentLink = z.infer<typeof insertGoalInvestmentLinkSchema>;

// Goal Progress Snapshots types and schema
export const insertGoalProgressSnapshotSchema = createInsertSchema(goalProgressSnapshots).omit({
  id: true,
  createdAt: true,
});

// Goal category definitions with defaults
export const GOAL_CATEGORIES = {
  retirement: { icon: "umbrella-off", color: "#f97316", name: "Retirement", defaultReturn: 10, defaultInflation: 6 },
  education: { icon: "graduation-cap", color: "#8b5cf6", name: "Child Education", defaultReturn: 12, defaultInflation: 8 },
  home_purchase: { icon: "home", color: "#22c55e", name: "Home Purchase", defaultReturn: 12, defaultInflation: 7 },
  car: { icon: "car", color: "#3b82f6", name: "Car Purchase", defaultReturn: 10, defaultInflation: 5 },
  wedding: { icon: "heart", color: "#ec4899", name: "Wedding", defaultReturn: 10, defaultInflation: 8 },
  child_marriage: { icon: "gem", color: "#d946ef", name: "Child Marriage", defaultReturn: 10, defaultInflation: 8 },
  emergency: { icon: "shield", color: "#ef4444", name: "Emergency Fund", defaultReturn: 6, defaultInflation: 6 },
  travel: { icon: "plane", color: "#06b6d4", name: "Dream Vacation", defaultReturn: 8, defaultInflation: 5 },
  wealth_building: { icon: "trending-up", color: "#10b981", name: "Wealth Building", defaultReturn: 12, defaultInflation: 6 },
  custom: { icon: "target", color: "#6b7280", name: "Custom Goal", defaultReturn: 10, defaultInflation: 6 },
} as const;

export type GoalCategory = keyof typeof GOAL_CATEGORIES;

// Zoho Commerce Integration Tables








// Zoho Commerce insert schemas

export const insertZohoCategorySchema = createInsertSchema(zohoCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZohoProductSchema = createInsertSchema(zohoProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZohoOrderSchema = createInsertSchema(zohoOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZohoCustomerSchema = createInsertSchema(zohoCustomers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});


export const insertZohoCommerceWebhookSchema = createInsertSchema(zohoCommerceWebhooks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZohoCommerceSyncLogSchema = createInsertSchema(zohoCommerceSyncLogs).omit({
  id: true,
  startedAt: true,
});

// Zoho Commerce types
export type ZohoCategory = typeof zohoCategories.$inferSelect;
export type InsertZohoCategory = z.infer<typeof insertZohoCategorySchema>;
export type ZohoProduct = typeof zohoProducts.$inferSelect;
export type InsertZohoProduct = z.infer<typeof insertZohoProductSchema>;
export type ZohoOrder = typeof zohoOrders.$inferSelect;
export type InsertZohoOrder = z.infer<typeof insertZohoOrderSchema>;
export type ZohoCustomer = typeof zohoCustomers.$inferSelect;
export type InsertZohoCustomer = z.infer<typeof insertZohoCustomerSchema>;
export type ZohoCommerceWebhook = typeof zohoCommerceWebhooks.$inferSelect;
export type InsertZohoCommerceWebhook = z.infer<typeof insertZohoCommerceWebhookSchema>;
export type ZohoCommerceSyncLog = typeof zohoCommerceSyncLogs.$inferSelect;
export type InsertZohoCommerceSyncLog = z.infer<typeof insertZohoCommerceSyncLogSchema>;


// DigiLocker Integration tables
// ===== MUTUAL FUND API INTEGRATION TYPES =====
// Multi-source API integration types for AMFI, MFAPI.in, CaptNemo, etc.

// Core fund information - normalized across all sources
export interface FundCore {
  schemeCode: string;
  schemeName: string;
  fundHouse?: string;
  category?: string;
  subCategory?: string;
  isin?: string;
  riskLevel?: string;
  expenseRatio?: string;
  aum?: string;
  manager?: string;
  benchmark?: string;
}

// Historical NAV data point
export interface NAVRecord {
  date: string; // ISO date string
  nav: string; // decimal as string for precision
}

// Performance metrics with standardized CAGR calculations
export interface FundPerformance {
  currentNav: string;
  navDate: string; // ISO date string
  change?: string;
  changePercent?: string;
  returns: {
    "1M"?: number; // simple return %
    "6M"?: number; // simple return %
    "1Y"?: number; // CAGR %
    "3Y"?: number; // CAGR %
    "5Y"?: number; // CAGR %
  };
  returnStrings: {
    "1M"?: string; // formatted display string
    "6M"?: string;
    "1Y"?: string;
    "3Y"?: string;
    "5Y"?: string;
  };
  volatility?: number;
  sharpeRatio?: number;
  alpha?: number;
  beta?: number;
}

// Data provenance and source tracking
export interface Provenance {
  primarySource: 'AMFI' | 'MFAPI';
  sourceChain?: string[]; // ordered list of attempted sources
  dataFlow?: Array<{
    source: string;
    timestamp: Date;
    action: string;
    metadata?: any;
  }>;
  lastRefreshed?: string; // ISO timestamp
  timestamp: Date;
  isAuthentic: boolean;
  dataVersion?: string;
  conflicts?: Array<{
    field: string;
    primary: any;
    fallback: any;
  }>;
}

// Complete fund data with provenance
export interface FundExtended extends FundCore, FundPerformance {
  id?: string;
  historicalData?: NAVRecord[];
  lastUpdated?: Date;
  provenance?: Provenance;
  
  // Additional convenience fields for database compatibility
  nav?: number;
  returns1y?: number;
  returns3y?: number;
  returns5y?: number;
  rating?: string;
  minInvestment?: string;
  exitLoad?: string;
  
  // FintekPro Smart Rating (stored with legacy 'crisil' prefix for backwards compatibility)
  crisilRating?: number; // 1-5 scale (1 = very good performance) - FintekPro Smart Rating
  crisilCategory?: 'equity' | 'debt' | 'hybrid';
  crisilPercentile?: number; // 0-100 percentile ranking
  crisilEvaluationDate?: Date; // Last evaluation date
  crisilRiskAdjustedScore?: number; // Risk-adjusted returns score
  crisilAssetQualityScore?: number; // Asset quality score
  crisilLiquidityScore?: number; // Liquidity score
  crisilConcentrationScore?: number; // Asset concentration score
  crisilOverallScore?: number; // Overall composite score
  crisilDataSource?: 'calculated' | 'api' | 'manual';
  crisilLastUpdated?: Date;
  
  // FintekPro Smart Rating Analysis Data
  crisilRationale?: string; // Analysis rationale
  crisilStrengths?: string[]; // Fund strengths
  crisilConcerns?: string[]; // Fund concerns
  crisilRecommendation?: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
}

// Zod schemas for validation
export const fundCoreSchema = z.object({
  schemeCode: z.string().min(1),
  schemeName: z.string().min(1),
  fundHouse: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  isin: z.string().optional(),
  riskLevel: z.string().optional(),
  expenseRatio: z.string().optional(),
  aum: z.string().optional(),
  manager: z.string().optional(),
  benchmark: z.string().optional(),
});

export const navRecordSchema = z.object({
  date: z.string(),
  nav: z.string(),
});

export const fundPerformanceSchema = z.object({
  currentNav: z.string(),
  navDate: z.string(),
  change: z.string().optional(),
  changePercent: z.string().optional(),
  returns: z.object({
    "1M": z.number().optional(),
    "6M": z.number().optional(),
    "1Y": z.number().optional(),
    "3Y": z.number().optional(),
    "5Y": z.number().optional(),
  }),
  returnStrings: z.object({
    "1M": z.string().optional(),
    "6M": z.string().optional(),
    "1Y": z.string().optional(),
    "3Y": z.string().optional(),
    "5Y": z.string().optional(),
  }),
  volatility: z.number().optional(),
  sharpeRatio: z.number().optional(),
  alpha: z.number().optional(),
  beta: z.number().optional(),
});

export const provenanceSchema = z.object({
  primarySource: z.enum(['AMFI', 'MFAPI']),
  sourceChain: z.array(z.string()),
  lastRefreshed: z.string(),
  dataVersion: z.string().optional(),
  conflicts: z.array(z.object({
    field: z.string(),
    primary: z.any(),
    fallback: z.any(),
  })).optional(),
});

export const fundExtendedSchema = fundCoreSchema.merge(fundPerformanceSchema).extend({
  id: z.string().optional(),
  historicalData: z.array(navRecordSchema).optional(),
  lastUpdated: z.date().optional(),
  provenance: provenanceSchema,
});

// Types for API responses
export type FundApiResponse = z.infer<typeof fundExtendedSchema>;
export type NavApiRecord = z.infer<typeof navRecordSchema>;

// Search and filtering types
export interface FundSearchParams {
  query?: string;
  category?: string;
  fundHouse?: string;
  riskLevel?: string;
  sortBy?: 'name' | 'nav' | 'returns1Y' | 'returns3Y' | 'returns5Y' | 'aum';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface FundListResponse {
  funds: FundExtended[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Source status for monitoring
export interface SourceStatus {
  source: string;
  isHealthy: boolean;
  lastSuccess?: string;
  lastError?: string;
  latencyMs?: number;
  errorRate?: number;
}

export interface MultiSourceStatus {
  sources: SourceStatus[];
  lastUpdated: string;
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
}

// ICICI Loan Applications table

// ICICI Credit Score Requests table

// Fund Comparison table for storing fund comparison results


// ===== TAX DOCUMENT PROCESSING TABLES =====

// Tax Documents table for storing uploaded Form 26AS and AIS files
export const taxDocuments = pgTable("tax_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Document Information
  documentType: varchar("document_type").notNull(), // '26AS' | 'AIS'
  financialYear: varchar("financial_year").notNull(), // e.g., "2023-24"
  originalFileName: varchar("original_file_name").notNull(),
  fileFormat: varchar("file_format").notNull(), // 'PDF' | 'JSON' | 'CSV'
  fileSize: integer("file_size"), // in bytes
  
  // File Storage
  fileUrl: text("file_url"), // Secure file storage URL in object storage
  encryptionKey: varchar("encryption_key"), // For end-to-end encryption
  
  // Processing Status
  processingStatus: varchar("processing_status").default("pending"), // pending/processing/completed/failed
  processingStartedAt: timestamp("processing_started_at"),
  processingCompletedAt: timestamp("processing_completed_at"),
  processingError: text("processing_error"),
  
  // Document Metadata
  documentPassword: varchar("document_password"), // For password-protected PDFs (encrypted)
  documentDate: date("document_date"), // Date when the document was generated
  panNumber: varchar("pan_number"), // PAN from the document
  assessmentYear: varchar("assessment_year"), // Assessment year from document
  
  // Validation and Compliance
  isValidated: boolean("is_validated").default(false),
  validationErrors: jsonb("validation_errors").default([]),
  checksumHash: varchar("checksum_hash"), // File integrity verification
  
  // User Consent and Privacy
  userConsent: boolean("user_consent").default(false),
  consentGivenAt: timestamp("consent_given_at"),
  dataRetentionPeriod: integer("data_retention_period").default(7), // years
  autoDeleteAt: timestamp("auto_delete_at"), // Automatic deletion date
  
  // Audit and Tracking
  uploadedFromIp: varchar("uploaded_from_ip"),
  uploadedUserAgent: text("uploaded_user_agent"),
  accessedCount: integer("accessed_count").default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Structured Tax Data table for parsed and categorized tax information
export const structuredTaxData = pgTable("structured_tax_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => taxDocuments.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Data Classification
  dataType: varchar("data_type").notNull(), // 'TDS' | 'TCS' | 'advance_tax' | 'salary' | 'interest' | 'dividend' | 'capital_gains' | 'other_income'
  dataCategory: varchar("data_category"), // 'deduction' | 'income' | 'payment' | 'refund'
  sourceType: varchar("source_type"), // 'employer' | 'bank' | 'broker' | 'mutual_fund' | 'government' | 'other'
  
  // Financial Data
  taxableAmount: decimal("taxable_amount", { precision: 15, scale: 2 }),
  taxDeducted: decimal("tax_deducted", { precision: 15, scale: 2 }),
  netAmount: decimal("net_amount", { precision: 15, scale: 2 }),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }), // percentage
  
  // Transaction Details
  transactionDate: date("transaction_date"),
  deductorPan: varchar("deductor_pan"),
  deductorName: varchar("deductor_name"),
  deductorTan: varchar("deductor_tan"), // Tax Account Number
  certificateNumber: varchar("certificate_number"),
  
  // Income Source Details
  incomeNature: varchar("income_nature"), // 'salary' | 'professional_fees' | 'commission' | 'rent' | etc.
  employerName: varchar("employer_name"),
  employerAddress: text("employer_address"),
  
  // Bank/Investment Details
  bankName: varchar("bank_name"),
  accountNumber: varchar("account_number"), // Last 4 digits only for security
  instrumentType: varchar("instrument_type"), // 'FD' | 'savings' | 'equity' | 'mutual_fund'
  
  // Additional Metadata
  remarks: text("remarks"),
  originalSection: varchar("original_section"), // Section of tax document where this was found
  metadata: jsonb("metadata"), // Additional fields specific to data type
  
  // Verification Status
  isVerified: boolean("is_verified").default(false),
  verificationSource: varchar("verification_source"), // 'manual' | 'external_api' | 'bank_statement'
  discrepancyFlags: jsonb("discrepancy_flags").default([]),
  
  // ITR Integration
  includeInItr: boolean("include_in_itr").default(true),
  itrSection: varchar("itr_section"), // ITR section where this should be reported
  itrLineItem: varchar("itr_line_item"), // Specific line item in ITR
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tax Calculations table for computed tax liabilities and savings
export const taxCalculations = pgTable("tax_calculations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  financialYear: varchar("financial_year").notNull(),
  
  // Calculation Type and Status
  calculationType: varchar("calculation_type").default("comprehensive"), // 'quick' | 'comprehensive' | 'comparison'
  taxRegime: varchar("tax_regime").default("new"), // 'old' | 'new'
  calculationStatus: varchar("calculation_status").default("draft"), // 'draft' | 'final' | 'filed'
  
  // Income Summary
  totalIncome: decimal("total_income", { precision: 15, scale: 2 }),
  exemptIncome: decimal("exempt_income", { precision: 15, scale: 2 }),
  taxableIncome: decimal("taxable_income", { precision: 15, scale: 2 }),
  
  // Deductions
  standardDeduction: decimal("standard_deduction", { precision: 15, scale: 2 }),
  section80cDeductions: decimal("section_80c_deductions", { precision: 15, scale: 2 }),
  otherDeductions: decimal("other_deductions", { precision: 15, scale: 2 }),
  totalDeductions: decimal("total_deductions", { precision: 15, scale: 2 }),
  
  // Tax Computation
  grossTaxLiability: decimal("gross_tax_liability", { precision: 15, scale: 2 }),
  rebateUnder87a: decimal("rebate_under_87a", { precision: 15, scale: 2 }),
  netTaxLiability: decimal("net_tax_liability", { precision: 15, scale: 2 }),
  educationCess: decimal("education_cess", { precision: 15, scale: 2 }),
  totalTaxPayable: decimal("total_tax_payable", { precision: 15, scale: 2 }),
  
  // Tax Payments
  tdsDeducted: decimal("tds_deducted", { precision: 15, scale: 2 }),
  advanceTaxPaid: decimal("advance_tax_paid", { precision: 15, scale: 2 }),
  selfAssessmentTax: decimal("self_assessment_tax", { precision: 15, scale: 2 }),
  totalTaxPaid: decimal("total_tax_paid", { precision: 15, scale: 2 }),
  
  // Refund/Payable
  refundDue: decimal("refund_due", { precision: 15, scale: 2 }),
  taxPayable: decimal("tax_payable", { precision: 15, scale: 2 }),
  
  // Detailed Breakdown (JSON)
  incomeBreakdown: jsonb("income_breakdown"), // Source-wise income details
  deductionBreakdown: jsonb("deduction_breakdown"), // Section-wise deductions
  taxBreakdown: jsonb("tax_breakdown"), // Slab-wise tax calculation
  comparisonOldVsNew: jsonb("comparison_old_vs_new"), // Regime comparison
  
  // ITR Preparation
  itrForm: varchar("itr_form"), // 'ITR-1' | 'ITR-2' | 'ITR-3' | 'ITR-4'
  itrJsonGenerated: boolean("itr_json_generated").default(false),
  itrJsonUrl: text("itr_json_url"), // URL to downloadable ITR JSON
  
  // Advisory and Recommendations
  taxSavingSuggestions: jsonb("tax_saving_suggestions"),
  optimizationOpportunities: jsonb("optimization_opportunities"),
  nextYearProjections: jsonb("next_year_projections"),
  
  // Validation and Compliance
  validationWarnings: jsonb("validation_warnings").default([]),
  complianceChecks: jsonb("compliance_checks"),
  lastValidatedAt: timestamp("last_validated_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tax Document Access Log for audit purposes
export const taxDocumentAccessLog = pgTable("tax_document_access_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => taxDocuments.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Access Details
  actionType: varchar("action_type").notNull(), // 'view' | 'download' | 'process' | 'delete' | 'share'
  accessMethod: varchar("access_method"), // 'web' | 'mobile' | 'api'
  accessSource: varchar("access_source"), // 'dashboard' | 'itr_wizard' | 'reports'
  
  // Technical Details
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  
  // Additional Context
  purpose: varchar("purpose"), // 'itr_filing' | 'tax_planning' | 'verification' | 'analysis'
  dataShared: boolean("data_shared").default(false),
  exportFormat: varchar("export_format"), // if downloaded
  
  // Timestamps
  accessedAt: timestamp("accessed_at").defaultNow(),
});

// Insert schemas for tax document tables
export const insertTaxDocumentSchema = createInsertSchema(taxDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStructuredTaxDataSchema = createInsertSchema(structuredTaxData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaxCalculationSchema = createInsertSchema(taxCalculations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaxDocumentAccessLogSchema = createInsertSchema(taxDocumentAccessLog).omit({
  id: true,
  accessedAt: true,
});

// Export tax document types
export type TaxDocument = typeof taxDocuments.$inferSelect;
export type StructuredTaxData = typeof structuredTaxData.$inferSelect;
export type TaxCalculation = typeof taxCalculations.$inferSelect;
export type TaxDocumentAccessLog = typeof taxDocumentAccessLog.$inferSelect;

// ITR Pre-filled Forms table for intelligent tax return preparation

// ITR Data Sources Sync Log for tracking data integration

// Insert schemas for ITR tables
export const insertItrPrefilledFormSchema = createInsertSchema(itrPrefilledForms).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastDataSync: true,
});


// Export ITR types
export type ItrPrefilledForm = typeof itrPrefilledForms.$inferSelect;
export type InsertItrPrefilledForm = z.infer<typeof insertItrPrefilledFormSchema>;

export type InsertTaxDocument = z.infer<typeof insertTaxDocumentSchema>;
export type InsertStructuredTaxData = z.infer<typeof insertStructuredTaxDataSchema>;
export type InsertTaxCalculation = z.infer<typeof insertTaxCalculationSchema>;
export type InsertTaxDocumentAccessLog = z.infer<typeof insertTaxDocumentAccessLogSchema>;

// Unified Tax Smart Filing Workflow Tables
// Tax Session for workflow orchestration and state management

export type InsertTaxSession = z.infer<typeof insertTaxSessionSchema>;
export type InsertTaxDataSource = z.infer<typeof insertTaxDataSourceSchema>;
export type InsertValidationIssue = z.infer<typeof insertValidationIssueSchema>;
export type InsertFilingRecord = z.infer<typeof insertFilingRecordSchema>;
export type InsertAiOptimizationSuggestion = z.infer<typeof insertAiOptimizationSuggestionSchema>;

// PAN Consent Management Table


export type PanConsent = typeof panConsents.$inferSelect;
export type NewPanConsent = typeof panConsents.$inferInsert;
export type InsertPanConsent = z.infer<typeof insertPanConsentSchema>;

// Smart Market Research & Investment Idea Tracking Tables
export const investmentIdeas = pgTable("investment_ideas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  symbol: varchar("symbol").notNull(),
  companyName: varchar("company_name").notNull(),
  ideaTitle: varchar("idea_title").notNull(),
  ideaDescription: text("idea_description").notNull(),
  
  // Investment Parameters
  entryPrice: decimal("entry_price", { precision: 10, scale: 2 }).notNull(),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }),
  targetPrice: decimal("target_price", { precision: 10, scale: 2 }).notNull(),
  stopLoss: decimal("stop_loss", { precision: 10, scale: 2 }).notNull(),
  
  // Position Details
  recommendedQuantity: integer("recommended_quantity"),
  actualQuantity: integer("actual_quantity").default(0),
  recommendedInvestment: decimal("recommended_investment", { precision: 12, scale: 2 }),
  actualInvestment: decimal("actual_investment", { precision: 12, scale: 2 }).default("0"),
  
  // Risk & Analysis
  riskLevel: varchar("risk_level").notNull(), // low, medium, high
  timeHorizon: varchar("time_horizon").notNull(), // short, medium, long
  sector: varchar("sector"),
  marketCap: varchar("market_cap"), // small, mid, large
  
  // Technical Analysis
  technicalIndicators: jsonb("technical_indicators"), // RSI, MACD, etc.
  supportLevel: decimal("support_level", { precision: 10, scale: 2 }),
  resistanceLevel: decimal("resistance_level", { precision: 10, scale: 2 }),
  
  // AI Analysis
  aiConfidenceScore: decimal("ai_confidence_score", { precision: 3, scale: 2 }),
  aiReasoning: text("ai_reasoning"),
  catalysts: jsonb("catalysts"), // array of expected catalysts
  risks: jsonb("risks"), // array of potential risks
  
  // Status & Tracking
  status: varchar("status").default("suggested"), // suggested, tracking, closed, stopped_out
  isActive: boolean("is_active").default(true),
  suggestedAt: timestamp("suggested_at").default(sql`CURRENT_TIMESTAMP`),
  enteredAt: timestamp("entered_at"),
  exitedAt: timestamp("exited_at"),
  
  // Performance Tracking
  currentReturn: decimal("current_return", { precision: 8, scale: 4 }), // percentage
  realizedReturn: decimal("realized_return", { precision: 8, scale: 4 }), // percentage
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }), // percentage
  daysHeld: integer("days_held").default(0),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const investmentIdeaTracking = pgTable("investment_idea_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id").references(() => investmentIdeas.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Daily Tracking Data
  trackingDate: timestamp("tracking_date").notNull(),
  openPrice: decimal("open_price", { precision: 10, scale: 2 }),
  closePrice: decimal("close_price", { precision: 10, scale: 2 }).notNull(),
  highPrice: decimal("high_price", { precision: 10, scale: 2 }),
  lowPrice: decimal("low_price", { precision: 10, scale: 2 }),
  volume: bigint("volume", { mode: "number" }),
  
  // Performance Metrics
  dailyReturn: decimal("daily_return", { precision: 8, scale: 4 }), // percentage
  cumulativeReturn: decimal("cumulative_return", { precision: 8, scale: 4 }), // percentage
  unrealizedPnL: decimal("unrealized_pnl", { precision: 12, scale: 2 }),
  
  // Technical Indicators (updated daily)
  rsi: decimal("rsi", { precision: 5, scale: 2 }),
  macd: decimal("macd", { precision: 8, scale: 4 }),
  macdSignal: decimal("macd_signal", { precision: 8, scale: 4 }),
  sma20: decimal("sma_20", { precision: 10, scale: 2 }),
  sma50: decimal("sma_50", { precision: 10, scale: 2 }),
  ema12: decimal("ema_12", { precision: 10, scale: 2 }),
  ema26: decimal("ema_26", { precision: 10, scale: 2 }),
  
  // Risk Metrics
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  beta: decimal("beta", { precision: 6, scale: 4 }),
  
  // Events & Notes
  events: jsonb("events"), // corporate actions, news, etc.
  notes: text("notes"),
  
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const investmentIdeaAlerts = pgTable("investment_idea_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ideaId: varchar("idea_id").references(() => investmentIdeas.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  alertType: varchar("alert_type").notNull(), // target_reached, stop_loss_triggered, technical_signal, news_alert
  alertMessage: text("alert_message").notNull(),
  triggerPrice: decimal("trigger_price", { precision: 10, scale: 2 }),
  actualPrice: decimal("actual_price", { precision: 10, scale: 2 }),
  
  severity: varchar("severity").default("medium"), // low, medium, high, critical
  isRead: boolean("is_read").default(false),
  isActionable: boolean("is_actionable").default(false),
  
  triggeredAt: timestamp("triggered_at").default(sql`CURRENT_TIMESTAMP`),
  readAt: timestamp("read_at"),
});

export const yieldTracker = pgTable("yield_tracker", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  portfolioId: varchar("portfolio_id"), // References portfolios.id if applicable
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  ideaId: varchar("idea_id").references(() => investmentIdeas.id),
  investmentId: varchar("investment_id"), // References portfolio_holdings.id if applicable
  
  // Instrument Details
  symbol: varchar("symbol"),
  instrumentType: varchar("instrument_type").default("equity"), // equity, mutual_fund, bond, etc.
  
  // Portfolio/Strategy Details
  strategyName: varchar("strategy_name"),
  strategyType: varchar("strategy_type"), // single_stock, portfolio, sector_rotation, thematic
  
  // Investment Details
  initialInvestment: decimal("initial_investment", { precision: 15, scale: 2 }).notNull(),
  totalInvestment: decimal("total_investment", { precision: 15, scale: 2 }).notNull(),
  currentValue: decimal("current_value", { precision: 15, scale: 2 }),
  unitsHeld: decimal("units_held", { precision: 15, scale: 6 }),
  averagePurchasePrice: decimal("average_purchase_price", { precision: 15, scale: 4 }),
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  
  // Performance Metrics
  totalReturn: decimal("total_return", { precision: 15, scale: 2 }),
  totalReturnPercent: decimal("total_return_percent", { precision: 8, scale: 4 }),
  totalDividends: decimal("total_dividends", { precision: 15, scale: 2 }).default("0"),
  totalInterest: decimal("total_interest", { precision: 15, scale: 2 }).default("0"),
  totalCharges: decimal("total_charges", { precision: 15, scale: 2 }).default("0"),
  
  // Yield Calculations
  dividendYield: decimal("dividend_yield", { precision: 6, scale: 4 }),
  capitalGainsYield: decimal("capital_gains_yield", { precision: 8, scale: 4 }),
  totalYield: decimal("total_yield", { precision: 8, scale: 4 }),
  annualizedReturn: decimal("annualized_return", { precision: 8, scale: 4 }),
  targetYield: decimal("target_yield", { precision: 6, scale: 4 }),
  
  // Risk-Adjusted Returns
  sharpeRatio: decimal("sharpe_ratio", { precision: 6, scale: 4 }),
  sortinoRatio: decimal("sortino_ratio", { precision: 6, scale: 4 }),
  maxDrawdown: decimal("max_drawdown", { precision: 8, scale: 4 }),
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  
  // Benchmarking
  benchmark: varchar("benchmark").default("NIFTY50"),
  benchmarkReturn: decimal("benchmark_return", { precision: 8, scale: 4 }),
  alpha: decimal("alpha", { precision: 8, scale: 4 }),
  beta: decimal("beta", { precision: 6, scale: 4 }),
  riskProfile: varchar("risk_profile").default("moderate"),
  
  // History Data
  priceHistory: jsonb("price_history").$type<any[]>().default([]),
  performanceHistory: jsonb("performance_history").$type<any[]>().default([]),
  
  // Time Tracking
  purchaseDate: timestamp("purchase_date").defaultNow(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  daysActive: integer("days_active"),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  lastUpdated: timestamp("last_updated").default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Partner Application table for loan applications across lenders

// Partner Application Documents table for document metadata

// Investment Ideas Zod schemas
export const insertInvestmentIdeaSchema = createInsertSchema(investmentIdeas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvestmentIdeaTrackingSchema = createInsertSchema(investmentIdeaTracking).omit({
  id: true,
  createdAt: true,
});

export const insertInvestmentIdeaAlertSchema = createInsertSchema(investmentIdeaAlerts).omit({
  id: true,
  triggeredAt: true,
});

export const insertYieldTrackerSchema = createInsertSchema(yieldTracker).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertPartnerApplicationSchema = createInsertSchema(partnerApplications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Investment Ideas types
export type InvestmentIdea = typeof investmentIdeas.$inferSelect;
export type InsertInvestmentIdea = z.infer<typeof insertInvestmentIdeaSchema>;
export type InvestmentIdeaTracking = typeof investmentIdeaTracking.$inferSelect;
export type InsertInvestmentIdeaTracking = z.infer<typeof insertInvestmentIdeaTrackingSchema>;
export type InvestmentIdeaAlert = typeof investmentIdeaAlerts.$inferSelect;
export type InsertInvestmentIdeaAlert = z.infer<typeof insertInvestmentIdeaAlertSchema>;
export type YieldTracker = typeof yieldTracker.$inferSelect;
export type InsertYieldTracker = z.infer<typeof insertYieldTrackerSchema>;
export type PartnerApplication = typeof partnerApplications.$inferSelect;
export type InsertPartnerApplication = z.infer<typeof insertPartnerApplicationSchema>;

export const insertPartnerApplicationDocumentSchema = createInsertSchema(partnerApplicationDocuments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  uploadedAt: true,
});

export type PartnerApplicationDocument = typeof partnerApplicationDocuments.$inferSelect;
export type InsertPartnerApplicationDocument = z.infer<typeof insertPartnerApplicationDocumentSchema>;

// Cashfree Payment Transactions table

// Tax Rules table - Dynamic tax rates and rules management
export const taxRules = pgTable(
  "tax_rules",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ruleType: varchar("rule_type").notNull(), // 'capital_gains', 'income_slab', 'deduction_limit', 'exemption'
    category: varchar("category").notNull(), // 'stcg', 'ltcg', 'old_regime', 'new_regime', etc.
    value: decimal("value", { precision: 10, scale: 2 }).notNull(), // the rate or amount
    minAmount: decimal("min_amount", { precision: 15, scale: 2 }), // minimum threshold (nullable)
    maxAmount: decimal("max_amount", { precision: 15, scale: 2 }), // maximum threshold (nullable)
    effectiveFrom: date("effective_from").notNull(), // when this rate becomes active
    effectiveTo: date("effective_to"), // when this rate expires (nullable)
    isActive: boolean("is_active").default(true).notNull(), // current active status
    metadata: jsonb("metadata").default({}), // additional rule parameters
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_tax_rules_type_category").on(table.ruleType, table.category),
    index("idx_tax_rules_effective_from").on(table.effectiveFrom),
    index("idx_tax_rules_is_active").on(table.isActive),
  ]
);

// Tax Reminder Subscriptions table
export const taxReminderSubscriptions = pgTable(
  "tax_reminder_subscriptions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
    itrFormType: varchar("itr_form_type").notNull(), // 'ITR-1', 'ITR-2', 'ITR-3', etc.
    subscriptionStatus: varchar("subscription_status").default("active").notNull(), // 'active', 'inactive', 'free_expert_tier'
    pricingTier: varchar("pricing_tier").notNull(), // 'basic', 'standard', 'premium'
    annualPrice: decimal("annual_price", { precision: 10, scale: 2 }).notNull(),
    isFree: boolean("is_free").default(false).notNull(), // true if user has expert ITR filing service
    cashfreeSubscriptionId: varchar("cashfree_subscription_id"), // nullable
    validFrom: date("valid_from").notNull(),
    validUntil: date("valid_until").notNull(),
    reminderChannels: jsonb("reminder_channels").default(sql`'["email"]'`).notNull(), // ['email', 'sms', 'whatsapp']
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_tax_reminder_subscriptions_user_id").on(table.userId),
    index("idx_tax_reminder_subscriptions_status").on(table.subscriptionStatus),
  ]
);

// Capital Gains Tax Reminders table
export const capitalGainsTaxReminders = pgTable(
  "capital_gains_tax_reminders",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
    subscriptionId: varchar("subscription_id").references(() => taxReminderSubscriptions.id),
    quarter: varchar("quarter").notNull(), // 'Q1', 'Q2', 'Q3', 'Q4'
    financialYear: varchar("financial_year").notNull(), // '2024-25'
    dueDate: date("due_date").notNull(), // advance tax due date
    estimatedSTCG: decimal("estimated_stcg", { precision: 15, scale: 2 }).default("0"),
    estimatedLTCG: decimal("estimated_ltcg", { precision: 15, scale: 2 }).default("0"),
    totalTaxLiability: decimal("total_tax_liability", { precision: 15, scale: 2 }).default("0"),
    reminderSentAt: timestamp("reminder_sent_at"), // nullable
    status: varchar("status").default("pending").notNull(), // 'pending', 'sent', 'paid', 'skipped'
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_capital_gains_tax_reminders_user_id").on(table.userId),
    index("idx_capital_gains_tax_reminders_due_date").on(table.dueDate),
    index("idx_capital_gains_tax_reminders_status").on(table.status),
  ]
);

// Tax Rules Insert Schema
export const insertTaxRuleSchema = createInsertSchema(taxRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tax Reminder Subscriptions Insert Schema
export const insertTaxReminderSubscriptionSchema = createInsertSchema(taxReminderSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Capital Gains Tax Reminders Insert Schema
export const insertCapitalGainsTaxReminderSchema = createInsertSchema(capitalGainsTaxReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tax-related Types
export type TaxRule = typeof taxRules.$inferSelect;
export type InsertTaxRule = z.infer<typeof insertTaxRuleSchema>;
export type TaxReminderSubscription = typeof taxReminderSubscriptions.$inferSelect;
export type InsertTaxReminderSubscription = z.infer<typeof insertTaxReminderSubscriptionSchema>;
export type CapitalGainsTaxReminder = typeof capitalGainsTaxReminders.$inferSelect;
export type InsertCapitalGainsTaxReminder = z.infer<typeof insertCapitalGainsTaxReminderSchema>;

// Generated Reports table - for client-facing report metadata

// Client Statements table - account statements for specific periods


// Government Securities and Corporate Bonds moved to shared/schema/bonds.ts
  // ... Moved to bonds.ts

// Bond Orders table - Purchase and sale orders

// Commodities Master table - Gold, Silver, Crude Oil, Natural Gas, etc.
export const commodities = pgTable("commodities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Basic identification
  symbol: varchar("symbol", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  commodityType: varchar("commodity_type", { length: 50 }).notNull(), // 'precious_metal', 'energy', 'industrial_metal', 'agricultural'
  subType: varchar("sub_type", { length: 50 }), // 'gold', 'silver', 'platinum', 'crude_oil', 'natural_gas', 'copper', 'aluminum', 'wheat', 'cotton'
  
  // Pricing
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  previousClose: decimal("previous_close", { precision: 15, scale: 4 }),
  dayChange: decimal("day_change", { precision: 10, scale: 4 }),
  dayChangePercent: decimal("day_change_percent", { precision: 8, scale: 4 }),
  weekHigh: decimal("week_high", { precision: 15, scale: 4 }),
  weekLow: decimal("week_low", { precision: 15, scale: 4 }),
  yearHigh: decimal("year_high", { precision: 15, scale: 4 }),
  yearLow: decimal("year_low", { precision: 15, scale: 4 }),
  
  // Units and currency
  unit: varchar("unit", { length: 20 }).default("gram"), // 'gram', 'ounce', 'kg', 'barrel', 'mmbtu', 'ton'
  currency: varchar("currency", { length: 5 }).default("INR"),
  
  // Investment products available
  hasEtf: boolean("has_etf").default(false),
  hasSgb: boolean("has_sgb").default(false), // Sovereign Gold Bond
  hasPhysical: boolean("has_physical").default(false),
  hasFutures: boolean("has_futures").default(false),
  
  // Performance metrics
  returns1w: decimal("returns_1w", { precision: 8, scale: 4 }),
  returns1m: decimal("returns_1m", { precision: 8, scale: 4 }),
  returns3m: decimal("returns_3m", { precision: 8, scale: 4 }),
  returns6m: decimal("returns_6m", { precision: 8, scale: 4 }),
  returns1y: decimal("returns_1y", { precision: 8, scale: 4 }),
  returns3y: decimal("returns_3y", { precision: 8, scale: 4 }),
  returns5y: decimal("returns_5y", { precision: 8, scale: 4 }),
  
  // Risk metrics
  volatility: decimal("volatility", { precision: 8, scale: 4 }),
  beta: decimal("beta", { precision: 8, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 8, scale: 4 }),
  
  // Market context
  globalDemand: varchar("global_demand", { length: 20 }), // 'high', 'medium', 'low'
  supplyOutlook: varchar("supply_outlook", { length: 20 }), // 'bullish', 'neutral', 'bearish'
  inflationHedge: boolean("inflation_hedge").default(false),
  safeHaven: boolean("safe_haven").default(false),
  
  // Store status
  isPublished: boolean("is_published").default(true),
  minInvestment: decimal("min_investment", { precision: 15, scale: 2 }).default("1000"),
  
  // AI recommendation metadata
  aiSentiment: varchar("ai_sentiment", { length: 20 }), // 'bullish', 'neutral', 'bearish'
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }),
  aiRationale: text("ai_rationale"),
  
  // Metadata
  dataSource: varchar("data_source").default("mcx"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_commodities_type").on(table.commodityType),
  index("idx_commodities_published").on(table.isPublished),
]);

export type Commodity = typeof commodities.$inferSelect;
export type InsertCommodity = typeof commodities.$inferInsert;

export const insertCommoditySchema = createInsertSchema(commodities).omit({ id: true, createdAt: true, lastUpdated: true });



// Bond Holdings table - User's bond portfolio



export const insertBondHoldingSchema = createInsertSchema(bondHoldings).omit({
  id: true,
  createdAt: true,
});

// Bond Commission Configuration - Admin-controlled margin settings



// ===== STAMP DUTY CONFIGURATION (Indian Stamp Act, amended July 2020) =====
// Regulatory-compliant stamp duty rates for securities transactions
export const stampDutyConfig = pgTable("stamp_duty_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Product type identification
  productType: varchar("product_type").notNull().unique(), // 'unlisted_shares', 'corporate_bond', 'ncd', 'tax_free_bond', 'g_sec', 'sgb', 'sdl', 't_bill', 'infrastructure_bond'
  productTypeLabel: varchar("product_type_label").notNull(), // Display name
  
  // Stamp duty rate (basis points - 1 bp = 0.01%)
  stampDutyBps: decimal("stamp_duty_bps", { precision: 8, scale: 4 }).notNull(), // e.g., 1.5 = 0.015%
  
  // Exemption handling
  isExempt: boolean("is_exempt").default(false), // G-Sec and SGB are exempt
  exemptionReason: text("exemption_reason"), // Regulatory reason for exemption
  
  // Transaction side (who pays)
  payerSide: varchar("payer_side").notNull().default("buyer"), // 'buyer', 'seller', 'transferor'
  
  // Transaction type applicability
  applicableTransactionTypes: text("applicable_transaction_types").array().default([]), // ['purchase', 'sale', 'transfer', 'issue']
  
  // Regulatory reference
  regulatorReference: varchar("regulator_reference"), // 'Indian Stamp Act 1899 (amended 2019)', 'SEBI Circular', etc.
  statuteSection: varchar("statute_section"), // Section 9A, Schedule IA, etc.
  
  // Effective dates for audit trail
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"), // null = currently active
  
  // Collection mechanism
  collectingAgent: varchar("collecting_agent").default("platform"), // 'depository', 'exchange', 'platform'
  remittanceFrequency: varchar("remittance_frequency").default("monthly"), // 'daily', 'weekly', 'monthly'
  
  // State-wise override (if needed)
  stateCode: varchar("state_code"), // null = national rate
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Audit
  lastUpdatedBy: varchar("last_updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertStampDutyConfigSchema = createInsertSchema(stampDutyConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type StampDutyConfig = typeof stampDutyConfig.$inferSelect;
export type InsertStampDutyConfig = z.infer<typeof insertStampDutyConfigSchema>;

// ===== STAMP DUTY AUDIT LOG (7-year retention for regulatory compliance) =====
export const stampDutyAuditLog = pgTable("stamp_duty_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Transaction reference
  transactionId: varchar("transaction_id").notNull(), // Bond order ID or Deal ID
  transactionType: varchar("transaction_type").notNull(), // 'bond_order', 'unlisted_deal'
  
  // Product details
  productType: varchar("product_type").notNull(),
  isin: varchar("isin"),
  productName: text("product_name"),
  
  // Stamp duty calculation
  transactionAmount: decimal("transaction_amount", { precision: 20, scale: 2 }).notNull(),
  stampDutyRate: decimal("stamp_duty_rate", { precision: 8, scale: 4 }).notNull(), // Rate applied (in bps)
  stampDutyAmount: decimal("stamp_duty_amount", { precision: 15, scale: 2 }).notNull(),
  isExempt: boolean("is_exempt").default(false),
  exemptionReason: text("exemption_reason"),
  
  // Payer details
  payerUserId: varchar("payer_user_id").references(() => users.id),
  payerSide: varchar("payer_side").notNull(), // 'buyer', 'seller'
  payerState: varchar("payer_state"), // State for remittance
  
  // Regulatory reference (snapshot at time of transaction)
  configSnapshotId: varchar("config_snapshot_id").references(() => stampDutyConfig.id),
  regulatorReference: varchar("regulator_reference"),
  statuteSection: varchar("statute_section"),
  effectiveRateDate: date("effective_rate_date"),
  
  // Collection status
  collectionStatus: varchar("collection_status").default("collected"), // 'pending', 'collected', 'remitted', 'failed'
  remittanceDate: date("remittance_date"),
  remittanceBatchId: varchar("remittance_batch_id"),
  
  // Audit metadata
  calculatedAt: timestamp("calculated_at").defaultNow(),
  calculatedBy: varchar("calculated_by").default("system"),
  
  // Retention policy (7 years as per regulations)
  retentionExpiresAt: timestamp("retention_expires_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stamp_duty_audit_transaction").on(table.transactionId),
  index("idx_stamp_duty_audit_product").on(table.productType),
  index("idx_stamp_duty_audit_date").on(table.calculatedAt),
]);

export const insertStampDutyAuditLogSchema = createInsertSchema(stampDutyAuditLog).omit({
  id: true,
  calculatedAt: true,
  createdAt: true,
});

export type StampDutyAuditLog = typeof stampDutyAuditLog.$inferSelect;
export type InsertStampDutyAuditLog = z.infer<typeof insertStampDutyAuditLogSchema>;

// Bond types moved to shared/schema/bonds.ts
export type CorporateBond = typeof corporateBonds.$inferSelect;
export type InsertCorporateBond = z.infer<typeof insertCorporateBondSchema>;
export type GovernmentSecurity = typeof governmentSecurities.$inferSelect;
export type InsertGovernmentSecurity = z.infer<typeof insertGovernmentSecuritySchema>;

export type BondHolding = typeof bondHoldings.$inferSelect;
export type InsertBondHolding = z.infer<typeof insertBondHoldingSchema>;

// ===== FAMILY COLLABORATION INSERT SCHEMAS AND TYPES =====

// Family Groups
export const insertFamilyGroupSchema = createInsertSchema(familyGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FamilyGroup = typeof familyGroups.$inferSelect;
export type InsertFamilyGroup = z.infer<typeof insertFamilyGroupSchema>;

// Family Members
export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  invitedAt: true,
});
export type FamilyMember = typeof familyMembers.$inferSelect;
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;

// Family Portfolio Permissions
export const insertFamilyPortfolioPermissionSchema = createInsertSchema(familyPortfolioPermissions).omit({
  id: true,
  grantedAt: true,
});
export type FamilyPortfolioPermission = typeof familyPortfolioPermissions.$inferSelect;
export type InsertFamilyPortfolioPermission = z.infer<typeof insertFamilyPortfolioPermissionSchema>;

// Family Goals
export const insertFamilyGoalSchema = createInsertSchema(familyGoals).omit({
  id: true,
  createdAt: true,
});
export type FamilyGoal = typeof familyGoals.$inferSelect;
export type InsertFamilyGoal = z.infer<typeof insertFamilyGoalSchema>;

// Family Goal Contributions
export const insertFamilyGoalContributionSchema = createInsertSchema(familyGoalContributions).omit({
  id: true,
  contributionDate: true,
});
export type FamilyGoalContribution = typeof familyGoalContributions.$inferSelect;
export type InsertFamilyGoalContribution = z.infer<typeof insertFamilyGoalContributionSchema>;

// Family Activity Logs
export const insertFamilyActivityLogSchema = createInsertSchema(familyActivityLogs).omit({
  id: true,
  createdAt: true,
});
export type FamilyActivityLog = typeof familyActivityLogs.$inferSelect;
export type InsertFamilyActivityLog = z.infer<typeof insertFamilyActivityLogSchema>;

// Family Discussions
export const insertFamilyDiscussionSchema = createInsertSchema(familyDiscussions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FamilyDiscussion = typeof familyDiscussions.$inferSelect;
export type InsertFamilyDiscussion = z.infer<typeof insertFamilyDiscussionSchema>;

// Family Budgets
export const insertFamilyBudgetSchema = createInsertSchema(familyBudgets).omit({
  id: true,
  createdAt: true,
});
export type FamilyBudget = typeof familyBudgets.$inferSelect;
export type InsertFamilyBudget = z.infer<typeof insertFamilyBudgetSchema>;

// ============================================================================
// CUSTOMIZABLE ALERT SYSTEM
// ============================================================================

// User Alerts - Customizable alerts for market changes and spending habits
export const userAlerts = pgTable("user_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Alert configuration
  alertName: text("alert_name").notNull(),
  alertType: varchar("alert_type").notNull(), // 'market_price', 'market_change', 'market_volume', 'spending_category', 'spending_limit', 'spending_pattern', 'portfolio_value', 'portfolio_change'
  
  // Alert category
  category: varchar("category").notNull(), // 'market', 'spending', 'portfolio'
  
  // Market alert specific fields
  symbol: varchar("symbol"), // Stock/fund symbol for market alerts
  assetType: varchar("asset_type"), // 'stock', 'mutual_fund', 'bond', 'commodity', 'index'
  
  // Trigger conditions (JSON with flexible structure)
  triggerCondition: jsonb("trigger_condition").notNull(), 
  // Examples:
  // Market Price: { type: 'price_above', value: 1500 } or { type: 'price_below', value: 1200 }
  // Market Change: { type: 'percent_gain', value: 5 } or { type: 'percent_loss', value: 3 }
  // Spending: { type: 'category_limit', category: 'food', period: 'monthly', value: 10000 }
  // Portfolio: { type: 'value_below', value: 500000 }
  
  // Spending alert specific fields
  spendingCategory: varchar("spending_category"), // 'food', 'transport', 'entertainment', 'utilities', 'shopping', 'healthcare', etc.
  spendingPeriod: varchar("spending_period"), // 'daily', 'weekly', 'monthly', 'yearly'
  
  // Notification preferences
  notificationChannels: jsonb("notification_channels").default(['email']), // ['email', 'whatsapp', 'sms', 'push', 'in_app']
  
  // Alert status and controls
  isActive: boolean("is_active").default(true),
  priority: varchar("priority").default("medium"), // 'high', 'medium', 'low'
  
  // Frequency controls (prevent spam)
  cooldownPeriod: integer("cooldown_period").default(3600), // Seconds between repeated alerts (default 1 hour)
  lastTriggeredAt: timestamp("last_triggered_at"),
  triggerCount: integer("trigger_count").default(0),
  
  // Metadata
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_alerts_user_id").on(table.userId),
  index("idx_user_alerts_type").on(table.alertType),
  index("idx_user_alerts_category").on(table.category),
  index("idx_user_alerts_active").on(table.isActive),
  index("idx_user_alerts_symbol").on(table.symbol),
]);

// Alert History - Log of triggered alerts
export const alertHistory = pgTable("alert_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertId: varchar("alert_id").references(() => userAlerts.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Trigger details
  triggeredAt: timestamp("triggered_at").defaultNow(),
  triggerValue: jsonb("trigger_value"), // Actual value that triggered the alert
  // Example: { currentPrice: 1550, threshold: 1500 } or { spending: 12000, limit: 10000 }
  
  // Alert snapshot at trigger time
  alertSnapshot: jsonb("alert_snapshot"), // Copy of alert config when triggered
  
  // Notification details
  notificationStatus: varchar("notification_status").default("pending"), // 'pending', 'sent', 'failed'
  notificationChannels: jsonb("notification_channels"),
  notificationSentAt: timestamp("notification_sent_at"),
  notificationError: text("notification_error"),
  
  // User interaction
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  isDismissed: boolean("is_dismissed").default(false),
  dismissedAt: timestamp("dismissed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_alert_history_alert_id").on(table.alertId),
  index("idx_alert_history_user_id").on(table.userId),
  index("idx_alert_history_triggered").on(table.triggeredAt),
  index("idx_alert_history_read").on(table.isRead),
]);

// Alert Templates - Pre-defined alert templates for quick setup
export const alertTemplates = pgTable("alert_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  templateName: text("template_name").notNull(),
  templateType: varchar("template_type").notNull(), // 'market', 'spending', 'portfolio'
  category: varchar("category").notNull(),
  
  // Template configuration
  defaultConfig: jsonb("default_config").notNull(),
  description: text("description"),
  
  // Popularity and usage
  isPopular: boolean("is_popular").default(false),
  usageCount: integer("usage_count").default(0),
  
  // Admin controls
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_alert_templates_type").on(table.templateType),
  index("idx_alert_templates_popular").on(table.isPopular),
  index("idx_alert_templates_active").on(table.isActive),
]);

// Insert schemas and types for alerts
export const insertUserAlertSchema = createInsertSchema(userAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  triggerCount: true,
  lastTriggeredAt: true,
});
export type UserAlert = typeof userAlerts.$inferSelect;
export type InsertUserAlert = z.infer<typeof insertUserAlertSchema>;

export const insertAlertHistorySchema = createInsertSchema(alertHistory).omit({
  id: true,
  createdAt: true,
  triggeredAt: true,
});
export type AlertHistory = typeof alertHistory.$inferSelect;
export type InsertAlertHistory = z.infer<typeof insertAlertHistorySchema>;

export const insertAlertTemplateSchema = createInsertSchema(alertTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});
export type AlertTemplate = typeof alertTemplates.$inferSelect;
export type InsertAlertTemplate = z.infer<typeof insertAlertTemplateSchema>;

// ============================================================================
// FINANCIAL CHATBOT SYSTEM
// ============================================================================

// Chat Sessions - Conversation threads with AI financial advisor
export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Session metadata
  title: text("title"), // Auto-generated or user-set title
  sessionType: varchar("session_type").default("general"), // 'general', 'transaction', 'portfolio_analysis', 'tax_advice'
  
  // Context for AI
  contextData: jsonb("context_data"), // Portfolio snapshot, user preferences, etc.
  
  // Linked entities (for better context tracking)
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  portfolioSnapshotId: varchar("portfolio_snapshot_id"), // Reference to specific snapshot
  
  // Session status
  isActive: boolean("is_active").default(true),
  lastMessageAt: timestamp("last_message_at"),
  messageCount: integer("message_count").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_chat_sessions_user_id").on(table.userId),
  index("idx_chat_sessions_active").on(table.isActive),
  index("idx_chat_sessions_last_message").on(table.lastMessageAt),
  index("idx_chat_sessions_portfolio").on(table.portfolioId),
]);

// Chat Messages - Individual messages in conversations
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => chatSessions.id).notNull(),
  
  // Message details
  role: varchar("role").notNull(), // 'user', 'assistant', 'system', 'function'
  content: text("content").notNull(),
  
  // Function calling support
  functionCall: jsonb("function_call"), // { name: 'buy_stock', arguments: {...} }
  functionResponse: jsonb("function_response"), // Result of function execution
  
  // AI metadata
  model: varchar("model").default("gemini-1.5-flash"), // Which AI model was used
  tokens: integer("tokens"), // Token count for this message
  
  // Message context
  attachments: jsonb("attachments"), // URLs, images, documents
  metadata: jsonb("metadata"), // Additional context like market data at time of message
  
  // User interaction
  isEdited: boolean("is_edited").default(false),
  editedAt: timestamp("edited_at"),
  
  // Feedback
  userRating: integer("user_rating"), // 1-5 stars for AI responses
  feedbackText: text("feedback_text"),
  
  // Compliance & Moderation
  isFlagged: boolean("is_flagged").default(false),
  flaggedReason: text("flagged_reason"),
  flaggedAt: timestamp("flagged_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_chat_messages_session_id").on(table.sessionId),
  index("idx_chat_messages_role").on(table.role),
  index("idx_chat_messages_created").on(table.createdAt),
  index("idx_chat_messages_flagged").on(table.isFlagged),
]);

// Chat Functions - Available functions the AI can call
export const chatFunctions = pgTable("chat_functions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Function details
  functionName: varchar("function_name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  category: varchar("category").notNull(), // 'transaction', 'portfolio', 'market_data', 'analysis', 'admin'
  
  // Function schema for AI
  parameters: jsonb("parameters").notNull(), // JSON Schema for function parameters
  
  // Access control
  requiredRoles: jsonb("required_roles").default([]), // Roles that can use this function
  requiresConfirmation: boolean("requires_confirmation").default(true), // User must confirm before execution
  
  // Usage tracking
  isEnabled: boolean("is_enabled").default(true),
  usageCount: integer("usage_count").default(0),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_chat_functions_category").on(table.category),
  index("idx_chat_functions_enabled").on(table.isEnabled),
]);

// Insert schemas and types for chatbot
export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  messageCount: true,
  lastMessageAt: true,
});
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export const insertChatFunctionSchema = createInsertSchema(chatFunctions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  usageCount: true,
  successRate: true,
});
export type ChatFunction = typeof chatFunctions.$inferSelect;
export type InsertChatFunction = z.infer<typeof insertChatFunctionSchema>;

// Chat Actions - Track transaction confirmations and executed actions
export const chatActions = pgTable("chat_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => chatSessions.id).notNull(),
  messageId: varchar("message_id").references(() => chatMessages.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Action details
  actionType: varchar("action_type").notNull(), // 'transaction', 'rebalance', 'schedule_call', 'update_profile'
  functionName: varchar("function_name").notNull(),
  
  // Confirmation workflow
  status: varchar("status").default("pending_confirmation"), // 'pending_confirmation', 'confirmed', 'rejected', 'executed', 'failed'
  userConfirmedAt: timestamp("user_confirmed_at"),
  executedAt: timestamp("executed_at"),
  
  // Action parameters and results
  actionParams: jsonb("action_params").notNull(), // Function parameters
  actionResult: jsonb("action_result"), // Execution result
  errorMessage: text("error_message"),
  
  // Linked entities
  transactionId: varchar("transaction_id"), // If action created a transaction
  orderId: varchar("order_id"), // If action created an order
  
  // Audit trail
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_chat_actions_session_id").on(table.sessionId),
  index("idx_chat_actions_user_id").on(table.userId),
  index("idx_chat_actions_status").on(table.status),
  index("idx_chat_actions_action_type").on(table.actionType),
]);

export const insertChatActionSchema = createInsertSchema(chatActions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ChatAction = typeof chatActions.$inferSelect;
export type InsertChatAction = z.infer<typeof insertChatActionSchema>;

// Unified Order Management System - Tracks all orders across product types


// Currency Rates table for multi-currency support
export const currencyRates = pgTable("currency_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  baseCurrency: varchar("base_currency").notNull().default("INR"),
  targetCurrency: varchar("target_currency").notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 18, scale: 8 }).notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  dataSource: varchar("data_source").default("exchangerate-api"),
}, (table) => [
  index("idx_currency_rates_base_target").on(table.baseCurrency, table.targetCurrency),
  sql`UNIQUE(base_currency, target_currency)`,
]);

export const insertCurrencyRateSchema = createInsertSchema(currencyRates).omit({
  id: true,
  lastUpdated: true,
});
export type CurrencyRate = typeof currencyRates.$inferSelect;
export type InsertCurrencyRate = z.infer<typeof insertCurrencyRateSchema>;

// ============================================================================
// EXPENSE TRACKING & AI-POWERED BUDGETING SYSTEM
// ============================================================================

// User Expenses - Individual expense transactions with AI categorization
export const userExpenses = pgTable("user_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Transaction details
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: varchar("currency").default("INR").notNull(),
  description: text("description").notNull(),
  transactionDate: timestamp("transaction_date").notNull(),
  
  // Categorization (AI-powered or manual)
  category: varchar("category").notNull(), // housing, food, transportation, utilities, entertainment, healthcare, education, shopping, travel, insurance, investment, other
  subcategory: varchar("subcategory"), // Optional subcategory for detailed tracking
  
  // AI categorization metadata
  aiCategorized: boolean("ai_categorized").default(false),
  aiConfidence: decimal("ai_confidence", { precision: 5, scale: 2 }), // Confidence score 0-100
  suggestedCategories: jsonb("suggested_categories"), // Alternative AI suggestions with confidence scores
  
  // Payment method and tags
  paymentMethod: varchar("payment_method"), // cash, card, upi, bank_transfer, other
  merchantName: varchar("merchant_name"),
  tags: jsonb("tags"), // User-defined tags for filtering
  
  // Receipt and notes
  receiptUrl: varchar("receipt_url"), // Object storage URL
  notes: text("notes"),
  
  // Recurring expense tracking
  isRecurring: boolean("is_recurring").default(false),
  recurringFrequency: varchar("recurring_frequency"), // weekly, monthly, yearly
  recurringGroupId: varchar("recurring_group_id"), // Link recurring transactions
  
  // BBPS Integration - Link to bill payment transactions
  bbpsTransactionId: varchar("bbps_transaction_id").references(() => bbpsTransactions.id),
  isBbpsPayment: boolean("is_bbps_payment").default(false), // Flag for quick filtering
  
  // Status
  isVerified: boolean("is_verified").default(false),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_expenses_user").on(table.userId),
  index("idx_user_expenses_category").on(table.category),
  index("idx_user_expenses_date").on(table.transactionDate),
  index("idx_user_expenses_recurring").on(table.recurringGroupId),
]);

// User Budgets - Category-wise budget limits
export const userBudgets = pgTable("user_budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Budget details
  budgetName: text("budget_name").notNull(),
  category: varchar("category").notNull(), // Must match expense categories
  subcategory: varchar("subcategory"), // Optional for granular budgets
  
  // Budget amount and period
  budgetAmount: decimal("budget_amount", { precision: 15, scale: 2 }).notNull(),
  period: varchar("period").notNull(), // daily, weekly, monthly, quarterly, yearly
  currency: varchar("currency").default("INR").notNull(),
  
  // Tracking
  currentSpend: decimal("current_spend", { precision: 15, scale: 2 }).default("0"),
  lastResetDate: timestamp("last_reset_date").defaultNow(),
  
  // AI suggestions
  aiSuggested: boolean("ai_suggested").default(false),
  aiReasoning: text("ai_reasoning"), // Why AI suggested this budget
  
  // Alerts
  alertThreshold: decimal("alert_threshold", { precision: 5, scale: 2 }).default("80"), // Percentage
  alertEnabled: boolean("alert_enabled").default(true),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Timestamps
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_budgets_user").on(table.userId),
  index("idx_user_budgets_category").on(table.category),
  index("idx_user_budgets_period").on(table.period),
  sql`UNIQUE(user_id, category, subcategory, period)`,
]);

// Expense Insights - AI-generated spending insights and recommendations
export const expenseInsights = pgTable("expense_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Insight details
  insightType: varchar("insight_type").notNull(), // spending_pattern, anomaly, budget_suggestion, saving_opportunity, trend_analysis
  category: varchar("category"), // Related expense category
  
  // AI-generated content
  title: text("title").notNull(),
  description: text("description").notNull(),
  aiAnalysis: jsonb("ai_analysis").notNull(), // Detailed AI reasoning and data
  
  // Actionable recommendations
  recommendations: jsonb("recommendations"), // Array of actionable suggestions
  potentialSavings: decimal("potential_savings", { precision: 15, scale: 2 }), // Estimated savings if recommendation followed
  
  // Priority and status
  priority: varchar("priority").default("medium"), // high, medium, low
  status: varchar("status").default("new"), // new, viewed, acted_upon, dismissed
  
  // Insight validity period
  validFrom: timestamp("valid_from").defaultNow(),
  validUntil: timestamp("valid_until"),
  
  // User interaction
  userFeedback: varchar("user_feedback"), // helpful, not_helpful, already_doing
  feedbackNotes: text("feedback_notes"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  dismissedAt: timestamp("dismissed_at"),
}, (table) => [
  index("idx_expense_insights_user").on(table.userId),
  index("idx_expense_insights_type").on(table.insightType),
  index("idx_expense_insights_status").on(table.status),
  index("idx_expense_insights_priority").on(table.priority),
]);

// Insert schemas and types
export const insertUserExpenseSchema = createInsertSchema(userExpenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type UserExpense = typeof userExpenses.$inferSelect;
export type InsertUserExpense = z.infer<typeof insertUserExpenseSchema>;

export const insertUserBudgetSchema = createInsertSchema(userBudgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type UserBudget = typeof userBudgets.$inferSelect;
export type InsertUserBudget = z.infer<typeof insertUserBudgetSchema>;

export const insertExpenseInsightSchema = createInsertSchema(expenseInsights).omit({
  id: true,
  createdAt: true,
  dismissedAt: true,
});
export type ExpenseInsight = typeof expenseInsights.$inferSelect;
export type InsertExpenseInsight = z.infer<typeof insertExpenseInsightSchema>;

// ============================================================================
// PRE-APPROVED LOAN OFFERS (Portfolio Display)
// ============================================================================

// Pre-Approved Loan Offers - Personalized loan offers shown in client portfolio

// ============================================================================
// API & INTEGRATION CONTROL CENTER
// ============================================================================

// Webhook Logs - Track all incoming webhooks from payment gateways and services

// ============================================================================
// KYC VAULT SYSTEM - Comprehensive KYC Data Storage & Reuse
// ============================================================================

// KYC Vault - Secure storage with segregated encryption levels


// Data Source Consents - Track user consent for auto-population from each data source
export type AAConsentSession = typeof aaConsentSessions.$inferSelect;
export type InsertAAConsentSession = z.infer<typeof insertAAConsentSessionSchema>;

export const insertAARawPayloadSchema = createInsertSchema(aaRawPayloads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AARawPayload = typeof aaRawPayloads.$inferSelect;
export type InsertAARawPayload = z.infer<typeof insertAARawPayloadSchema>;

export const insertAADataFetchLogSchema = createInsertSchema(aaDataFetchLogs).omit({
  id: true,
  createdAt: true,
});
export type AADataFetchLog = typeof aaDataFetchLogs.$inferSelect;
export type InsertAADataFetchLog = z.infer<typeof insertAADataFetchLogSchema>;

// Insert schemas and types for KYC Vault System (handled by domain imports)


export const insertDataSourceConsentSchema = createInsertSchema(dataSourceConsents).omit({
  id: true,
  consentedAt: true,
});
export type DataSourceConsent = typeof dataSourceConsents.$inferSelect;
export type InsertDataSourceConsent = z.infer<typeof insertDataSourceConsentSchema>;


// Marketing Campaigns - definitions in schema/products.ts (re-exported above)

// Campaign Recipients - definitions in schema/products.ts (re-exported above)







// Client Intelligence - CredHive data for existing clients
// MarketingCampaign and CampaignRecipient types re-exported from schema/products.ts



// Agent Leads - Individual lead tracking for agent CRM
export type AgentLead = typeof agentLeads.$inferSelect;
export type InsertAgentLead = z.infer<typeof insertAgentLeadSchema>;


// ============ PREDICTIVE ANALYTICS TABLES ============

// Portfolio performance predictions

// Zod schemas for predictive analytics
// Portfolio Prediction schema from schema/portfolio

export const insertAssetForecastSchema = createInsertSchema(assetForecasts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AssetForecast = typeof assetForecasts.$inferSelect;
export type InsertAssetForecast = z.infer<typeof insertAssetForecastSchema>;



// ===================================================================
// UNLISTED MARKETPLACE - Company Master & Financial Data
// ===================================================================

// Unlisted Companies table
export type UnlistedCompany = typeof unlistedCompanies.$inferSelect;
export type InsertUnlistedCompany = z.infer<typeof insertUnlistedCompanySchema>;

// ==================== REGULATORY COMPLIANCE TABLES ====================

/**
 * Investor Tracking for 200 Investor Limit (Companies Act Section 42)
 * Tracks unique investors per company per financial year
 * Private placement cannot exceed 200 investors in a FY
 */




// ==================== INSTITUTIONAL VALUATION GOVERNANCE ====================

/**
 * Append-only versioned valuation history for unlisted equity instruments.
 * No record may ever be updated or deleted — new valuations are always INSERTs.
 * A valuation is considered STALE when current_date - valuation_date > 90 days.
 */

/**
 * Client disclosure acknowledgment log.
 * Mandatory before any unlisted equity is included in a finalized proposal.
 * Immutable — records the exact disclosure version the client accepted.
 */

// ==================== VENDOR API CALL GOVERNANCE ====================

/**
 * Tracks every outbound call to external corporate data vendors (Probe42, etc.).
 * Used for rate governance, cost tracking, and debugging.
 */
export const vendorApiCallLog = pgTable("vendor_api_call_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vendor: varchar("vendor", { length: 50 }).notNull(),         // 'probe42', 'sandbox', 'mca'
  endpoint: varchar("endpoint", { length: 200 }).notNull(),    // '/entities/{cin}/kyc'
  cin: varchar("cin", { length: 21 }),
  companyId: varchar("company_id"),
  statusCode: integer("status_code"),
  latencyMs: integer("latency_ms"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  costUnit: integer("cost_unit").default(1),                   // API credits consumed per call
  calledAt: timestamp("called_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vendor_call_log_vendor").on(table.vendor),
  index("idx_vendor_call_log_cin").on(table.cin),
  index("idx_vendor_call_log_called_at").on(table.calledAt),
  index("idx_vendor_call_log_success").on(table.success),
]);

export const insertVendorApiCallLogSchema = createInsertSchema(vendorApiCallLog).omit({
  id: true,
  calledAt: true,
});
export type VendorApiCallLog = typeof vendorApiCallLog.$inferSelect;
export type InsertVendorApiCallLog = z.infer<typeof insertVendorApiCallLogSchema>;

// ==================== END REGULATORY COMPLIANCE TABLES ====================





// Insert schemas for Financial Data Enrichment tables



export const insertSellListingSchema = createInsertSchema(sellListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SellListing = typeof sellListings.$inferSelect;
export type InsertSellListing = z.infer<typeof insertSellListingSchema>;

export const insertBuyRequestSchema = createInsertSchema(buyRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type BuyRequest = typeof buyRequests.$inferSelect;
export type InsertBuyRequest = z.infer<typeof insertBuyRequestSchema>;

// Unlisted Cart table - for batching multiple buy requests


// Unlisted Risk Disclosure Acknowledgments - SEBI compliance for unlisted securities trading
export type UnlistedRiskDisclosureAcknowledgment = typeof unlistedRiskDisclosureAcknowledgments.$inferSelect;
export type InsertUnlistedRiskDisclosureAcknowledgment = z.infer<typeof insertUnlistedRiskDisclosureAcknowledgmentSchema>;

// Escrow Release Approval - Maker-Checker workflow for compliance (dual approval required)
export type UnlistedEscrowApproval = typeof unlistedEscrowApprovals.$inferSelect;
export type InsertUnlistedEscrowApproval = z.infer<typeof insertUnlistedEscrowApprovalSchema>;

export const insertUnlistedDealSchema = createInsertSchema(unlistedDeals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type UnlistedDeal = typeof unlistedDeals.$inferSelect;
export type InsertUnlistedDeal = z.infer<typeof insertUnlistedDealSchema>;


// Unlisted Marketplace Regulatory Audit Log - 7-year retention for SEBI compliance


// Financial Obligations - now defined in Investable Surplus Engine section

// ============================================
// Scheme Consents (OTP-based consent for government schemes)
// ============================================

export const insertBondCouponPaymentSchema = createInsertSchema(bondCouponPayments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBondSuitabilityCheckSchema = createInsertSchema(bondSuitabilityChecks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBondWatchlistItemSchema = createInsertSchema(bondWatchlist).omit({ id: true, addedAt: true });
export const insertSgbPrimaryIssueSchema = createInsertSchema(sgbPrimaryIssues).omit({ id: true, createdAt: true, lastUpdated: true });
export const insertRbiRetailDirectAccountSchema = createInsertSchema(rbiRetailDirectAccounts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBondNcdApplicationSchema = createInsertSchema(bondNcdApplications).omit({ id: true, createdAt: true, updatedAt: true });

// Process Flow B additional schemas
export const insertFixedIncomeFeedIngestionLogSchema = createInsertSchema(fixedIncomeFeedIngestionLogs).omit({ id: true, createdAt: true });
export const insertFixedIncomeOrderPaymentSchema = createInsertSchema(fixedIncomeOrderPayments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFixedIncomeSettlementSchema = createInsertSchema(fixedIncomeSettlements).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFixedIncomeNotificationPrefSchema = createInsertSchema(fixedIncomeNotificationPrefs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFixedIncomeReportSchema = createInsertSchema(fixedIncomeReports).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFixedIncomeAgentCommissionSchema = createInsertSchema(fixedIncomeAgentCommissions).omit({ id: true, createdAt: true, updatedAt: true });

// ==========================================
// STORE MANAGEMENT SYSTEM - Enhanced Tables
// Admin control for Categories, Subcategories, Products
// ==========================================

// Store Subcategories Table (new table for hierarchical structure)
export const storeSubcategories = pgTable("store_subcategories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => storeCategories.id, { onDelete: 'cascade' }).notNull(),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull(),
  description: text("description"),
  icon: varchar("icon"),
  displayOrder: integer("display_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type StoreSubcategory = typeof storeSubcategories.$inferSelect;
export type InsertStoreSubcategory = typeof storeSubcategories.$inferInsert;
export const insertStoreSubcategorySchema = createInsertSchema(storeSubcategories).omit({ id: true, createdAt: true, updatedAt: true });

// Store Audit Logs Table (7-year retention for regulatory compliance)
export const storeAuditLogs = pgTable("store_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").references(() => users.id).notNull(),
  adminEmail: varchar("admin_email"), // Store email for audit trail
  action: varchar("action").notNull(), // 'toggle', 'create', 'update', 'delete'
  targetType: varchar("target_type").notNull(), // 'category', 'subcategory', 'product'
  targetId: varchar("target_id").notNull(),
  targetName: varchar("target_name"), // Store name for readability
  beforeValue: jsonb("before_value"), // State before change
  afterValue: jsonb("after_value"), // State after change
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export type StoreAuditLog = typeof storeAuditLogs.$inferSelect;
export type InsertStoreAuditLog = typeof storeAuditLogs.$inferInsert;
export const insertStoreAuditLogSchema = createInsertSchema(storeAuditLogs).omit({ id: true, timestamp: true });

// Product Inquiries Table (for tracking inquiries when products are disabled)
export const storeProductInquiries = pgTable("store_product_inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => storeProducts.id),
  subcategoryId: varchar("subcategory_id").references(() => storeSubcategories.id),
  categoryId: varchar("category_id").references(() => storeCategories.id),
  userId: varchar("user_id").references(() => users.id),
  name: varchar("name"),
  email: varchar("email"),
  phone: varchar("phone"),
  message: text("message"),
  inquiryType: varchar("inquiry_type").default("callback"), // 'callback', 'information', 'availability'
  status: varchar("status").default("pending"), // 'pending', 'contacted', 'resolved', 'closed'
  assignedTo: varchar("assigned_to").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export type StoreProductInquiry = typeof storeProductInquiries.$inferSelect;
export type InsertStoreProductInquiry = typeof storeProductInquiries.$inferInsert;
export const insertStoreProductInquirySchema = createInsertSchema(storeProductInquiries).omit({ id: true, createdAt: true });

// Store Transaction Log - SEBI/RBI Regulatory Compliance
// Immutable audit trail for all store transactions (7-year retention)
export const storeTransactionLogs = pgTable("store_transaction_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Transaction Identity
  transactionId: varchar("transaction_id").notNull().unique(), // Unique transaction reference
  transactionType: varchar("transaction_type").notNull(), // 'purchase', 'cart_add', 'cart_remove', 'inquiry', 'proposal_accept', 'proposal_reject', 'checkout', 'payment'
  
  // User Context
  userId: varchar("user_id").references(() => users.id),
  userEmail: varchar("user_email"),
  userName: varchar("user_name"),
  userPan: varchar("user_pan"), // Masked PAN for compliance
  
  // Product Details
  productCategory: varchar("product_category").notNull(), // 'mutual_fund', 'bond', 'mld', 'unlisted', 'aif', 'pms', 'ipo', 'insurance', 'loan'
  categoryId: varchar("category_id").references(() => storeCategories.id),
  productId: varchar("product_id"),
  productName: varchar("product_name"),
  productIsin: varchar("product_isin"),
  
  // Transaction Values
  amount: decimal("amount", { precision: 15, scale: 2 }),
  quantity: integer("quantity"),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }),
  currency: varchar("currency").default("INR"),
  
  // Source Tracking
  source: varchar("source").notNull(), // 'client_direct', 'ai_recommendation', 'agent_proposal', 'self_requested'
  sourceProposalId: varchar("source_proposal_id"),
  sourceAgentId: varchar("source_agent_id").references(() => users.id),
  sourcePartnerId: varchar("source_partner_id").references(() => users.id),
  
  // Status
  status: varchar("status").notNull().default("pending"), // 'pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed'
  statusReason: text("status_reason"),
  
  // Commission Tracking
  commissionAmount: decimal("commission_amount", { precision: 15, scale: 2 }),
  commissionType: varchar("commission_type"), // 'trail', 'upfront', 'brokerage', 'advisory'
  commissionAgentId: varchar("commission_agent_id").references(() => users.id),
  commissionPartnerId: varchar("commission_partner_id").references(() => users.id),
  
  // Zoho Books Integration
  zohoInvoiceId: varchar("zoho_invoice_id"),
  zohoBillId: varchar("zoho_bill_id"),
  zohoSyncStatus: varchar("zoho_sync_status").default("pending"), // 'pending', 'synced', 'failed', 'not_applicable'
  zohoSyncedAt: timestamp("zoho_synced_at"),
  zohoSyncError: text("zoho_sync_error"),
  
  // Regulatory Compliance
  regulatoryType: varchar("regulatory_type"), // 'SEBI', 'RBI', 'IRDAI', 'PFRDA'
  consentTimestamp: timestamp("consent_timestamp"), // When user consented
  consentIpAddress: varchar("consent_ip_address"),
  consentChecksum: varchar("consent_checksum"), // SHA-256 hash of consent data
  
  // Device/Session Info
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  deviceFingerprint: varchar("device_fingerprint"),
  sessionId: varchar("session_id"),
  
  // Immutability Controls
  checksum: varchar("checksum"), // SHA-256 hash of record for integrity
  previousChecksum: varchar("previous_checksum"), // Chain link to previous record
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  
  // Metadata
  metadata: jsonb("metadata"),
}, (table) => [
  index("idx_store_txn_user").on(table.userId),
  index("idx_store_txn_category").on(table.productCategory),
  index("idx_store_txn_type").on(table.transactionType),
  index("idx_store_txn_status").on(table.status),
  index("idx_store_txn_date").on(table.createdAt),
  index("idx_store_txn_zoho").on(table.zohoSyncStatus),
  index("idx_store_txn_source").on(table.source),
]);

export type StoreTransactionLog = typeof storeTransactionLogs.$inferSelect;
export type InsertStoreTransactionLog = typeof storeTransactionLogs.$inferInsert;
export const insertStoreTransactionLogSchema = createInsertSchema(storeTransactionLogs).omit({ id: true, createdAt: true, updatedAt: true });

// ===================================================================
// MONEYCONTROL RECONCILIATION TYPES
// ===================================================================

export interface MoneyControlExternalCompany {
  name: string;
  isin: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  sector?: string;
  url?: string;
  scrapedAt: Date;
}

export interface MoneyControlReconciliationCache {
  companies: MoneyControlExternalCompany[];
  scrapedAt: Date;
  expiresAt: Date;
  source: string;
}

export interface MoneyControlReconciliationSuggestion {
  externalCompany: MoneyControlExternalCompany;
  matchConfidence: 'none' | 'low' | 'partial';
  possibleMatches: {
    companyId: string;
    companyName: string;
    matchScore: number;
  }[];
  status: 'new' | 'ignored' | 'synced';
}

// ===================================================================
// BOND MARKETPLACE TABLES (Listed & Unlisted Bonds, NCDs, Debentures)
// SEBI NCS & RBI Compliant Two-Sided Marketplace
// ===================================================================

// Bond Sell Listings table - Investors listing bonds for sale

// Bond Buy Requests table - Investors requesting to buy bonds

// Bond Deals table - Matched transactions

// Bond Marketplace Audit Logs table - 7-year retention for regulatory compliance

// SEBI NCS Risk Disclosure Acknowledgments for Bonds

// Bond Fee Overrides - Per-bond fee customization before publish

// Bond Catalog - unified table for admin seed workflow with publish status

// =====================================================
// BOND MARKETPLACE IMPROVEMENTS
// =====================================================

// Bond Alerts - Notifications for watchlist items

// Risk Disclosure Attestations - SEBI compliance log

export type InvestorClassificationRule = typeof investorClassificationRules.$inferSelect;
export type InsertInvestorClassificationRule = z.infer<typeof insertInvestorClassificationRuleSchema>;

// User Investor Classification (recorded in profile)
export const userInvestorClassifications = pgTable("user_investor_classifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Current Classification
  classificationType: varchar("classification_type").notNull(), // retail, sHNI, bHNI, qib, anchor
  classificationRuleId: varchar("classification_rule_id").references(() => investorClassificationRules.id),
  
  // Classification Basis
  classificationBasis: varchar("classification_basis").notNull(), // investment_amount, net_worth, aum, professional, sebi_registration
  
  // Values at Classification Time
  investmentAmountAtClassification: decimal("investment_amount_at_classification", { precision: 18, scale: 2 }),
  netWorthAtClassification: decimal("net_worth_at_classification", { precision: 18, scale: 2 }),
  aumAtClassification: decimal("aum_at_classification", { precision: 18, scale: 2 }),
  
  // Classification Status
  classificationStatus: varchar("classification_status").default("active"), // active, expired, upgraded, downgraded
  classifiedAt: timestamp("classified_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Annual review for QIB/accredited
  
  // Verification
  verifiedBy: varchar("verified_by").references(() => users.id), // Admin/Compliance officer
  verificationMethod: varchar("verification_method"), // auto, manual, document_based
  verificationNotes: text("verification_notes"),
  
  // Supporting Documents
  supportingDocuments: jsonb("supporting_documents").default([]),
  
  // Audit
  previousClassification: varchar("previous_classification"),
  classificationChangeReason: text("classification_change_reason"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_classification").on(table.userId),
  index("idx_classification_status").on(table.classificationStatus),
  index("idx_classification_type_user").on(table.classificationType),
]);

export const insertUserInvestorClassificationSchema = createInsertSchema(userInvestorClassifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserInvestorClassification = typeof userInvestorClassifications.$inferSelect;
export type InsertUserInvestorClassification = z.infer<typeof insertUserInvestorClassificationSchema>;

// Brokerage and Transaction Fee Structures by Investor Type
export const investorBrokerageStructures = pgTable("investor_brokerage_structures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Investor Type
  investorType: varchar("investor_type").notNull(), // retail, sHNI, bHNI, qib, anchor
  
  // Product Category
  productCategory: varchar("product_category").notNull(), // bonds, ncds, gsec, sgb, cp, mld, structured_products
  productSubCategory: varchar("product_sub_category"), // corporate_bond, tax_free_bond, psu_bond, etc.
  
  // Brokerage Fees (percentage of transaction)
  brokerageFeePercent: decimal("brokerage_fee_percent", { precision: 8, scale: 4 }).notNull(),
  minBrokerageFee: decimal("min_brokerage_fee", { precision: 12, scale: 2 }).default("0"),
  maxBrokerageFee: decimal("max_brokerage_fee", { precision: 12, scale: 2 }),
  
  // Platform Fees
  platformFeePercent: decimal("platform_fee_percent", { precision: 8, scale: 4 }).default("0"),
  flatPlatformFee: decimal("flat_platform_fee", { precision: 12, scale: 2 }).default("0"),
  
  // Transaction Charges (exchange, clearing, settlement)
  exchangeChargePercent: decimal("exchange_charge_percent", { precision: 8, scale: 6 }).default("0.0001"),
  clearingChargePercent: decimal("clearing_charge_percent", { precision: 8, scale: 6 }).default("0.00005"),
  sebiFeePercent: decimal("sebi_fee_percent", { precision: 8, scale: 6 }).default("0.00001"),
  stampDutyPercent: decimal("stamp_duty_percent", { precision: 8, scale: 4 }).default("0.0001"),
  gstPercent: decimal("gst_percent", { precision: 5, scale: 2 }).default("18.00"),
  
  // Custody/Demat Charges
  depository: varchar("depository"), // NSDL, CDSL
  dematChargePercent: decimal("demat_charge_percent", { precision: 8, scale: 6 }).default("0"),
  flatDematCharge: decimal("flat_demat_charge", { precision: 10, scale: 2 }).default("0"),
  
  // Net Yield Impact Display
  typicalYieldImpactBps: integer("typical_yield_impact_bps").default(0), // Basis points reduction from gross yield
  
  // Volume Discounts
  volumeDiscountTiers: jsonb("volume_discount_tiers").default([]), // [{minAmount, maxAmount, discountPercent}]
  
  // Status
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"),
  
  // Regulatory Reference
  regulatoryReference: varchar("regulatory_reference"), // SEBI circular reference
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_brokerage_investor").on(table.investorType),
  index("idx_brokerage_product").on(table.productCategory),
  index("idx_brokerage_active").on(table.isActive),
]);

export const insertInvestorBrokerageStructureSchema = createInsertSchema(investorBrokerageStructures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InvestorBrokerageStructure = typeof investorBrokerageStructures.$inferSelect;
export type InsertInvestorBrokerageStructure = z.infer<typeof insertInvestorBrokerageStructureSchema>;

// Product Eligibility Rules (KYC tier + investor type gating)
export const productEligibilityRules = pgTable("product_eligibility_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Product Identification
  productCategory: varchar("product_category").notNull(), // bonds, ncds, gsec, sgb, mld, aif, pms
  productSubCategory: varchar("product_sub_category"),
  isin: varchar("isin"), // Specific ISIN if rule is product-specific
  
  // Investor Type Requirements
  allowedInvestorTypes: text("allowed_investor_types").array().default(sql`'{}'::text[]`), // retail, sHNI, bHNI, qib
  
  // KYC Tier Requirements
  minKycTier: varchar("min_kyc_tier").notNull().default("basic"), // basic, enhanced, accredited_investor
  
  // Risk Profile Requirements
  allowedRiskProfiles: text("allowed_risk_profiles").array().default(sql`'{}'::text[]`), // conservative, moderate, aggressive
  
  // Investment Limits
  minInvestment: decimal("min_investment", { precision: 18, scale: 2 }).notNull(),
  maxInvestment: decimal("max_investment", { precision: 18, scale: 2 }), // null = no limit
  minInvestmentLotSize: decimal("min_investment_lot_size", { precision: 18, scale: 2 }), // Face value lot
  
  // Accredited Investor Requirements (for complex products)
  requiresAccreditedInvestor: boolean("requires_accredited_investor").default(false),
  minNetWorth: decimal("min_net_worth", { precision: 18, scale: 2 }),
  minAnnualIncome: decimal("min_annual_income", { precision: 18, scale: 2 }),
  minPortfolioValue: decimal("min_portfolio_value", { precision: 18, scale: 2 }),
  
  // Age/Experience Requirements
  minAge: integer("min_age"),
  maxAge: integer("max_age"),
  minInvestmentExperienceYears: integer("min_investment_experience_years"),
  
  // Credit Rating Requirements
  minCreditRating: varchar("min_credit_rating"), // AAA, AA+, AA, A+, A, BBB, etc.
  
  // Risk Disclosure Requirements
  requiresRiskDisclosure: boolean("requires_risk_disclosure").default(true),
  riskDisclosureType: varchar("risk_disclosure_type").default("standard"), // standard, enhanced, complex_product
  
  // Suitability Assessment
  requiresSuitabilityAssessment: boolean("requires_suitability_assessment").default(false),
  suitabilityScoreThreshold: integer("suitability_score_threshold"),
  
  // Cooling-off Period (days to cancel)
  coolingOffPeriodDays: integer("cooling_off_period_days").default(0),
  
  // Regulatory Constraints
  regulatoryBody: varchar("regulatory_body"), // SEBI, RBI, IRDAI
  regulatoryCircular: varchar("regulatory_circular"), // Reference to circular
  complianceNotes: text("compliance_notes"),
  
  // Status
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_eligibility_product").on(table.productCategory),
  index("idx_eligibility_kyc").on(table.minKycTier),
  index("idx_eligibility_isin").on(table.isin),
  index("idx_eligibility_active").on(table.isActive),
]);

export const insertProductEligibilityRuleSchema = createInsertSchema(productEligibilityRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProductEligibilityRule = typeof productEligibilityRules.$inferSelect;
export type InsertProductEligibilityRule = z.infer<typeof insertProductEligibilityRuleSchema>;

// Investment Limit Override Proposals (Admin/Partner/Agent can propose)
export const investmentLimitOverrideProposals = pgTable("investment_limit_override_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Target User
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Product/Category
  productCategory: varchar("product_category").notNull(),
  productSubCategory: varchar("product_sub_category"),
  isin: varchar("isin"), // Specific product if applicable
  
  // Override Type
  overrideType: varchar("override_type").notNull(), // investment_limit, investor_type, kyc_tier, risk_profile
  
  // Current vs Proposed Values
  currentInvestorType: varchar("current_investor_type"),
  proposedInvestorType: varchar("proposed_investor_type"),
  
  currentMinInvestment: decimal("current_min_investment", { precision: 18, scale: 2 }),
  proposedMinInvestment: decimal("proposed_min_investment", { precision: 18, scale: 2 }),
  
  currentMaxInvestment: decimal("current_max_investment", { precision: 18, scale: 2 }),
  proposedMaxInvestment: decimal("proposed_max_investment", { precision: 18, scale: 2 }),
  
  currentBrokeragePercent: decimal("current_brokerage_percent", { precision: 8, scale: 4 }),
  proposedBrokeragePercent: decimal("proposed_brokerage_percent", { precision: 8, scale: 4 }),
  
  // Justification
  justification: text("justification").notNull(),
  supportingDocuments: jsonb("supporting_documents").default([]),
  
  // Risk Assessment
  riskAssessmentNotes: text("risk_assessment_notes"),
  complianceReviewNotes: text("compliance_review_notes"),
  
  // Validity Period
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  
  // Proposer Details
  proposedBy: varchar("proposed_by").references(() => users.id).notNull(),
  proposerRole: varchar("proposer_role").notNull(), // admin, partner, agent
  proposedAt: timestamp("proposed_at").defaultNow(),
  
  // Approval Workflow
  status: varchar("status").default("pending"), // pending, under_review, approved, rejected, expired, revoked
  
  // Level 1 Review (Compliance)
  level1ReviewedBy: varchar("level1_reviewed_by").references(() => users.id),
  level1ReviewedAt: timestamp("level1_reviewed_at"),
  level1Status: varchar("level1_status"), // approved, rejected, escalated
  level1Notes: text("level1_notes"),
  
  // Level 2 Review (Senior Management)
  level2ReviewedBy: varchar("level2_reviewed_by").references(() => users.id),
  level2ReviewedAt: timestamp("level2_reviewed_at"),
  level2Status: varchar("level2_status"), // approved, rejected
  level2Notes: text("level2_notes"),
  
  // Final Approval
  finalApprovedBy: varchar("final_approved_by").references(() => users.id),
  finalApprovedAt: timestamp("final_approved_at"),
  finalApprovalNotes: text("final_approval_notes"),
  
  // Rejection/Revocation
  rejectedBy: varchar("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  
  revokedBy: varchar("revoked_by").references(() => users.id),
  revokedAt: timestamp("revoked_at"),
  revocationReason: text("revocation_reason"),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_override_user").on(table.userId),
  index("idx_override_status").on(table.status),
  index("idx_override_proposer").on(table.proposedBy),
  index("idx_override_product").on(table.productCategory),
]);

export const insertInvestmentLimitOverrideProposalSchema = createInsertSchema(investmentLimitOverrideProposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InvestmentLimitOverrideProposal = typeof investmentLimitOverrideProposals.$inferSelect;
export type InsertInvestmentLimitOverrideProposal = z.infer<typeof insertInvestmentLimitOverrideProposalSchema>;

// Active Investment Limit Overrides (approved and currently in effect)
export const activeInvestmentLimitOverrides = pgTable("active_investment_limit_overrides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to Proposal
  proposalId: varchar("proposal_id").references(() => investmentLimitOverrideProposals.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Override Details
  productCategory: varchar("product_category").notNull(),
  productSubCategory: varchar("product_sub_category"),
  isin: varchar("isin"),
  
  overrideType: varchar("override_type").notNull(),
  overrideValue: jsonb("override_value").notNull(), // Flexible JSON for different override types
  
  // Validity
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_active_override_user").on(table.userId),
  index("idx_active_override_product").on(table.productCategory),
  index("idx_active_override_active").on(table.isActive),
]);

export type ActiveInvestmentLimitOverride = typeof activeInvestmentLimitOverrides.$inferSelect;

// Risk Disclosure Templates (by product type)
export const riskDisclosureTemplates = pgTable("risk_disclosure_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Template Identification
  templateCode: varchar("template_code").notNull().unique(),
  templateName: varchar("template_name").notNull(),
  
  // Product Category
  productCategory: varchar("product_category").notNull(),
  productSubCategory: varchar("product_sub_category"),
  
  // Disclosure Type
  disclosureType: varchar("disclosure_type").notNull(), // standard, enhanced, complex_product, mld, aif
  
  // Content (supports i18n)
  disclosureTitle: varchar("disclosure_title").notNull(),
  disclosureContent: text("disclosure_content").notNull(), // HTML/Markdown content
  disclosureContentHindi: text("disclosure_content_hindi"), // Hindi translation
  
  // Risk Factors
  riskFactors: jsonb("risk_factors").default([]), // Array of specific risks
  
  // Regulatory Requirements
  regulatoryBody: varchar("regulatory_body"), // SEBI, RBI
  regulatoryReference: varchar("regulatory_reference"),
  mandatoryForInvestorTypes: text("mandatory_for_investor_types").array().default(sql`'{}'::text[]`),
  
  // Acknowledgment Requirements
  requiresExplicitAcknowledgment: boolean("requires_explicit_acknowledgment").default(true),
  requiresDigitalSignature: boolean("requires_digital_signature").default(false),
  acknowledgmentValidityDays: integer("acknowledgment_validity_days").default(365),
  
  // Status
  version: integer("version").default(1),
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_disclosure_template_code").on(table.templateCode),
  index("idx_disclosure_product").on(table.productCategory),
  index("idx_disclosure_type").on(table.disclosureType),
]);

export const insertRiskDisclosureTemplateSchema = createInsertSchema(riskDisclosureTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type RiskDisclosureTemplate = typeof riskDisclosureTemplates.$inferSelect;
export type InsertRiskDisclosureTemplate = z.infer<typeof insertRiskDisclosureTemplateSchema>;

// Regulatory Constraint Violations Log
export const regulatoryViolationLogs = pgTable("regulatory_violation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // User/Transaction
  userId: varchar("user_id").references(() => users.id),
  transactionId: varchar("transaction_id"),
  orderId: varchar("order_id"),
  
  // Violation Details
  violationType: varchar("violation_type").notNull(), // kyc_insufficient, investment_limit_exceeded, product_ineligible, risk_profile_mismatch
  violationCode: varchar("violation_code").notNull(),
  violationDescription: text("violation_description").notNull(),
  
  // Product Context
  productCategory: varchar("product_category"),
  isin: varchar("isin"),
  
  // Attempted Values
  attemptedAmount: decimal("attempted_amount", { precision: 18, scale: 2 }),
  allowedLimit: decimal("allowed_limit", { precision: 18, scale: 2 }),
  
  // Regulatory Reference
  regulatoryRule: varchar("regulatory_rule"),
  
  // Resolution
  resolutionStatus: varchar("resolution_status").default("blocked"), // blocked, overridden, resolved
  resolutionNotes: text("resolution_notes"),
  overrideProposalId: varchar("override_proposal_id").references(() => investmentLimitOverrideProposals.id),
  
  // Audit
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
}, (table) => [
  index("idx_violation_user").on(table.userId),
  index("idx_violation_type").on(table.violationType),
  index("idx_violation_date").on(table.createdAt),
]);

export type RegulatoryViolationLog = typeof regulatoryViolationLogs.$inferSelect;

// =============================================================================
// BOND FINANCIAL CALENDAR - Issuances, Maturities, and Events
// =============================================================================

// Event types for the bond calendar
export const bondCalendarEventTypes = [
  "issuance",           // New bond being issued/offered
  "maturity",           // Bond maturing
  "coupon_payment",     // Interest payment date
  "call_date",          // Callable bond call date
  "put_date",           // Puttable bond put date
  "record_date",        // Record date for coupon
  "listing_date",       // Bond listing on exchange
  "ipo_open",           // Bond IPO/NCD subscription opens
  "ipo_close",          // Bond IPO/NCD subscription closes
  "allotment_date",     // Allotment announcement
  "refund_initiation",  // Refund process begins
  "auction",            // RBI G-Sec auction
] as const;
export type BondCalendarEventType = typeof bondCalendarEventTypes[number];

// Source types for calendar data
export const bondCalendarSourceTypes = [
  "rbi",                // RBI G-Sec auction calendar
  "sebi",               // SEBI public issue calendar
  "nse",                // NSE bond listings
  "bse",                // BSE bond listings
  "manual",             // Manually added events
  "internal",           // Derived from existing bond data
] as const;
export type BondCalendarSourceType = typeof bondCalendarSourceTypes[number];

// Bond Calendar Events table

export type BondCalendarEvent = typeof bondCalendarEvents.$inferSelect;
export type InsertBondCalendarEvent = z.infer<typeof insertBondCalendarEventSchema>;

// =============================================================================
// MUTUAL FUND ORDER EXECUTION SYSTEM
// Regulatory-compliant buy/sell order management for mutual funds
// =============================================================================

// Order status enum values
export const mfOrderStatusValues = [
  "created",           // Order created, awaiting submission
  "pending_payment",   // Awaiting payment confirmation
  "placed",            // Order placed with AMC/RTA
  "confirmed",         // Order confirmed by AMC/RTA
  "processing",        // Units being allotted
  "settled",           // Units allotted/redeemed, payment settled
  "reconciled",        // Fully reconciled with RTA/AMC
  "rejected",          // Order rejected by AMC/RTA
  "cancelled",         // Order cancelled by user
  "failed",            // Order failed (payment or processing)
  "partial",           // Partial execution (rare for MF)
] as const;
export type MfOrderStatus = typeof mfOrderStatusValues[number];

// Order type values
export const mfOrderTypeValues = [
  "buy",               // Lumpsum purchase
  "sell",              // Redemption
  "sip",               // Systematic Investment Plan
  "stp",               // Systematic Transfer Plan
  "swp",               // Systematic Withdrawal Plan
  "switch",            // Switch between schemes
] as const;
export type MfOrderType = typeof mfOrderTypeValues[number];

// Payment method values
export const mfPaymentMethodValues = [
  "netbanking",        // Net banking
  "upi",               // UPI payment
  "nach",              // NACH mandate
  "neft",              // NEFT transfer
  "rtgs",              // RTGS transfer
  "debit_card",        // Debit card
  "wallet",            // Wallet payment
] as const;
export type MfPaymentMethod = typeof mfPaymentMethodValues[number];

// Bank mandate status values
export const bankMandateStatusValues = [
  "pending",           // Mandate creation initiated
  "active",            // Mandate active and usable
  "paused",            // Mandate temporarily paused
  "cancelled",         // Mandate cancelled
  "expired",           // Mandate expired
  "rejected",          // Mandate rejected by bank
] as const;
export type BankMandateStatus = typeof bankMandateStatusValues[number];

// Mutual Fund Folios - Track client folios with AMCs


// Bank Mandates for SIP/Recurring Payments


// Mutual Fund Orders - Buy/Sell/SIP order records


// Suitability Acknowledgements - Client consent for mismatched risk profiles


// ===================================================================
// UNIFIED CART SYSTEM - Central cart for all product categories
// ===================================================================



// ============================================================================
// AI PROPOSAL ENGINE SCHEMAS
// SEBI-compliant AI-assisted investment proposal system
// ============================================================================

// Recommendation type values
export const aiRecommendationTypeValues = [
  "BUY",      // New purchase recommendation
  "SELL",     // Exit recommendation
  "SWITCH",   // Replace one product with another
  "HOLD",     // Keep current position
] as const;
export type AIRecommendationType = typeof aiRecommendationTypeValues[number];

// Asset class values for recommendations
export const aiAssetClassValues = [
  "equity",           // Stocks
  "mutual_fund",      // Mutual Funds (Regular Plans)
  "bond",             // Bonds / NCDs
  "mld",              // Market Linked Debentures
  "reit",             // REITs
  "invit",            // InvITs
  "pms",              // Portfolio Management Services
  "aif",              // Alternative Investment Funds
  "cash",             // Cash & equivalents
  "fd",               // Fixed Deposits
  "gold",             // Gold/SGBs
] as const;
export type AIAssetClass = typeof aiAssetClassValues[number];

// Proposal status values
export const aiProposalStatusValues = [
  "draft",            // AI generated, not yet reviewed by agent
  "pending_review",   // Agent submitted for client review
  "approved",         // Client approved all/some items
  "partially_approved", // Client approved some items
  "rejected",         // Client rejected entire proposal
  "executed",         // Approved items moved to cart/executed
  "expired",          // Proposal validity expired
  "cancelled",        // Agent cancelled the proposal
] as const;
export type AIProposalStatus = typeof aiProposalStatusValues[number];

// Proposal item status values
export const aiProposalItemStatusValues = [
  "pending",          // Awaiting client decision
  "approved",         // Client approved this item
  "rejected",         // Client rejected this item
  "modified",         // Agent modified the AI suggestion
  "removed",          // Agent removed from proposal
  "executed",         // Added to cart/order placed
] as const;
export type AIProposalItemStatus = typeof aiProposalItemStatusValues[number];

// Risk category values
export const riskCategoryValues = [
  "conservative",     // Low risk tolerance
  "moderate",         // Medium risk tolerance
  "aggressive",       // High risk tolerance
] as const;
export type RiskCategory = typeof riskCategoryValues[number];

// Portfolio Diagnostics - Portfolio health analysis results
export type SuitabilityCheck = typeof suitabilityChecks.$inferSelect;
export type InsertSuitabilityCheck = z.infer<typeof insertSuitabilityCheckSchema>;

export const insertProposalNoteSchema = createInsertSchema(proposalNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ProposalNote = typeof proposalNotes.$inferSelect;
export type InsertProposalNote = z.infer<typeof insertProposalNoteSchema>;

export const insertProposalShareSchema = createInsertSchema(proposalShares).omit({
  id: true,
  createdAt: true,
});
export type ProposalShare = typeof proposalShares.$inferSelect;
export type InsertProposalShare = z.infer<typeof insertProposalShareSchema>;

export const insertPortfolioUploadSchema = createInsertSchema(portfolioUploads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type PortfolioUpload = typeof portfolioUploads.$inferSelect;
export type InsertPortfolioUpload = z.infer<typeof insertPortfolioUploadSchema>;

// PDF Profile types
export const insertPdfProfileSchema = createInsertSchema(pdfProfiles).omit({ id: true, detectedAt: true, updatedAt: true });
export type InsertPdfProfile = z.infer<typeof insertPdfProfileSchema>;
export type PdfProfile = typeof pdfProfiles.$inferSelect;


export const insertHoldingLotV2Schema = createInsertSchema(holdingLotsV2).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHoldingLotV2 = z.infer<typeof insertHoldingLotV2Schema>;
export type HoldingLotV2 = typeof holdingLotsV2.$inferSelect;


export const insertAgentComplianceAuditLogSchema = createInsertSchema(agentComplianceAuditLogs).omit({
  id: true,
  timestamp: true,
});
export type AgentComplianceAuditLog = typeof agentComplianceAuditLogs.$inferSelect;
export type InsertAgentComplianceAuditLog = z.infer<typeof insertAgentComplianceAuditLogSchema>;

// Workflow state enum for type safety
export const AdvisoryWorkflowStateEnum = z.enum([
  'purpose_selection',
  'suitability_check',
  'optimization',
  'draft_review',
  'client_sharing',
  'client_action',
  'execution',
  'completed',
  'cancelled'
]);

// Session purpose enum
export const AdvisorySessionPurposeEnum = z.enum([
  'fresh_investment',
  'rebalancing',
  'goal_review',
  'retirement_review',
  'corporate_treasury'
]);

// Client action enum
export const ClientActionEnum = z.enum([
  'pending',
  'viewed',
  'approved',
  'rejected',
  'clarification_requested'
]);

// =============================================
// Onboarding Invitations (Agent/Partner Referrals)
// =============================================



// Invitation status enum for type safety
export const OnboardingInvitationStatusEnum = z.enum([
  'pending',
  'sent',
  'opened',
  'started',
  'in_progress',
  'completed',
  'expired'
]);

// Invitation event type enum
export const OnboardingInvitationEventTypeEnum = z.enum([
  'created',
  'sent',
  'resent',
  'opened',
  'started',
  'step_completed',
  'completed',
  'expired'
]);

// ========================================
// AI INVESTMENT ADVISORY SYSTEM
// ========================================

// AI Profit Picks - High probability profitable stock recommendations
export type PortfolioAlert = typeof portfolioAlerts.$inferSelect;
export type InsertPortfolioAlert = z.infer<typeof insertPortfolioAlertSchema>;


export const insertAiTalkingPointSchema = createInsertSchema(aiTalkingPoints).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type AiTalkingPoint = typeof aiTalkingPoints.$inferSelect;
export type InsertAiTalkingPoint = z.infer<typeof insertAiTalkingPointSchema>;

// Agent-Assisted ITR Filing Cases


// ============================================================================
// PLATFORM FEE CONFIGURATION
// Centralized fee management for all platform charges
// ============================================================================

export const feeCategories = [
  "regulatory",      // STT, Stamp Duty, SEBI fees, GST
  "platform",        // Brokerage, platform fees, account maintenance
  "advisory",        // Portfolio review, tax planning, consultation
  "document",        // Physical statements, certificates, reports
  "convenience",     // Payment gateway, rush processing, after-hours
  "value_added",     // AI recommendations, API access, premium features
] as const;

export const feeApplicability = [
  "all",             // Applies to all transactions
  "equity",          // Equity trades only
  "mutual_fund",     // MF transactions
  "bond",            // Bond purchases
  "unlisted",        // Unlisted share deals
  "ipo",             // IPO applications
  "derivatives",     // F\&O trades
  "loan",            // Loan processing
  "tax_services",    // ITR, tax planning
  "advisory",        // Advisory services
] as const;

export const feeChargeType = [
  "percentage",      // % of transaction value
  "flat",            // Fixed amount
  "tiered",          // Based on slab
  "per_unit",        // Per share/unit
  "hybrid",          // Base + percentage
] as const;

export const platformFeeConfig = pgTable("platform_fee_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Fee Identification
  feeCode: varchar("fee_code", { length: 50 }).notNull().unique(),
  feeName: varchar("fee_name", { length: 100 }).notNull(),
  feeDescription: text("fee_description"),
  category: varchar("category", { length: 50 }).notNull(), // regulatory, platform, advisory, etc.
  
  // Charge Structure
  chargeType: varchar("charge_type", { length: 20 }).notNull().default("percentage"),
  rateValue: decimal("rate_value", { precision: 12, scale: 6 }).notNull(), // Rate or flat amount
  rateUnit: varchar("rate_unit", { length: 20 }).default("percent"), // percent, bps, inr
  minAmount: decimal("min_amount", { precision: 10, scale: 2 }).default("0"),
  maxAmount: decimal("max_amount", { precision: 10, scale: 2 }), // Cap if applicable
  
  // Tiered Pricing (for tiered charge type)
  tierSlabs: jsonb("tier_slabs"), // [{from: 0, to: 100000, rate: 0.5}, {from: 100001, to: 500000, rate: 0.3}]
  
  // Applicability
  applicableTo: varchar("applicable_to", { length: 50 }).notNull().default("all"),
  applicableProducts: text("applicable_products").array(), // Specific product codes
  excludedProducts: text("excluded_products").array(),
  
  // Investor Tier Pricing
  investorTierRates: jsonb("investor_tier_rates"), // {retail: 0.5, sHNI: 0.35, bHNI: 0.25, qib: 0.1}
  
  // GST Applicability
  isGstApplicable: boolean("is_gst_applicable").default(true),
  gstRate: decimal("gst_rate", { precision: 5, scale: 2 }).default("18"),
  gstIncluded: boolean("gst_included").default(false), // Is GST already included in rate?
  
  // Payer and Collection
  payer: varchar("payer", { length: 20 }).default("client"), // client, platform, seller, both
  collectionPoint: varchar("collection_point", { length: 50 }).default("transaction"), // transaction, monthly, annual
  
  // Regulatory Reference
  isRegulatory: boolean("is_regulatory").default(false),
  regulatoryReference: varchar("regulatory_reference", { length: 200 }),
  statuteSection: varchar("statute_section", { length: 200 }),
  
  // Waivers and Discounts
  isWaivable: boolean("is_waivable").default(false),
  maxWaiverPercent: decimal("max_waiver_percent", { precision: 5, scale: 2 }).default("0"),
  
  // Display
  displayOrder: integer("display_order").default(100),
  showInBreakdown: boolean("show_in_breakdown").default(true),
  displayLabel: varchar("display_label", { length: 100 }), // User-friendly label
  
  // Status and Validity
  isActive: boolean("is_active").default(true),
  effectiveFrom: timestamp("effective_from").defaultNow(),
  effectiveTo: timestamp("effective_to"),
  
  // Audit Trail
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  index("idx_fee_config_code").on(table.feeCode),
  index("idx_fee_config_category").on(table.category),
  index("idx_fee_config_applicable").on(table.applicableTo),
  index("idx_fee_config_active").on(table.isActive),
]);

export const insertPlatformFeeConfigSchema = createInsertSchema(platformFeeConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlatformFeeConfig = z.infer<typeof insertPlatformFeeConfigSchema>;
export type PlatformFeeConfig = typeof platformFeeConfig.$inferSelect;

// ITR Case Documents
export type AgentItrCase = typeof agentItrCases.$inferSelect;
export type InsertAgentItrCase = z.infer<typeof insertAgentItrCaseSchema>;

export const insertAgentItrDocumentSchema = createInsertSchema(agentItrDocuments).omit({
  id: true,
  uploadedAt: true,
  updatedAt: true,
});
export type AgentItrDocument = typeof agentItrDocuments.$inferSelect;
export type InsertAgentItrDocument = z.infer<typeof insertAgentItrDocumentSchema>;

export const insertCaProfileSchema = createInsertSchema(caProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CaProfile = typeof caProfiles.$inferSelect;
export type InsertCaProfile = z.infer<typeof insertCaProfileSchema>;

// ITR Status Enum
export const ItrStatusEnum = z.enum([
  'initiated',
  'documents_pending',
  'documents_received',
  'under_review',
  'ca_assigned',
  'processing',
  'filed',
  'acknowledged',
  'completed'
]);

// ITR Document Type Enum
export const ItrDocumentTypeEnum = z.enum([
  'form_16',
  'form_16a',
  'form_26as',
  'ais',
  'capital_gains_statement',
  'bank_statement',
  'rent_receipt',
  'investment_proof',
  'other'
]);

// Enums for AI Investment Advisory
export const TimeHorizonEnum = z.enum(['ultra_short', 'short', 'medium', 'long']);
export const SignalTypeEnum = z.enum(['buy', 'sell', 'hold']);
export const RiskLevelEnum = z.enum(['low', 'moderate', 'high', 'very_high']);
export const AlertTypeEnum = z.enum([
  'concentration',
  'loss_trigger',
  'profit_trigger',
  'sector_overweight',
  'risk_mismatch',
  'horizon_mismatch',
  'benchmark_breach',
  'valuation_warning',
  'rebalancing_needed'
]);
export const AlertSeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);

// ============================================
// FORM 15CA / 15CB (INTERNATIONAL REMITTANCE)
// Tax & Compliance Module
// ============================================

// Form 15CA/15CB Cases - Main case table
// ============================================================================

// ============================================================================
// Commission Plan Configuration Tables (Admin-Driven Role-Based Commission)
// ============================================================================

// Payout mode enum for commission role maps


// Passthrough rule enum for hierarchy splits


// Commission plan status enum




// Product types for commission configuration
export const CommissionProductTypes = [
  'mutual_fund',
  'mutual_fund_direct', // Always 0% commission
  'stocks',
  'ipos',
  'bonds',
  'loans',
  'insurance',
  'unlisted',
  'tax_services',
  'pms_aif'
] as const;

export type CommissionProductType = typeof CommissionProductTypes[number];

// Regulatory caps by product type (SEBI/AMFI mandated)
export const RegulatoryCommissionCaps: Record<CommissionProductType, number> = {
  mutual_fund: 2.25, // AMFI mandated trail cap
  mutual_fund_direct: 0, // Direct plans have 0 commission
  stocks: 0.5, // Brokerage cap
  ipos: 0.5,
  bonds: 1.0,
  loans: 4.0, // Varies by loan type
  insurance: 15.0, // First year commission cap
  unlisted: 2.0,
  tax_services: 40.0, // CA fee share
  pms_aif: 2.5 // Performance fee structures
};

// ========================================
// PROSPECT PORTFOLIO DEMO PROPOSALS
// ========================================

// Prospect related types from schema/proposals
// Prospect related types from schema/proposals

// ============ PORTFOLIO IMPORT TYPES ============

export const portfolioHoldingSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  isin: z.string().optional(),
  symbol: z.string().optional(),
  assetType: z.enum(['equity', 'mutual_fund', 'etf', 'bond', 'gold', 'fd', 'other']),
  // Preserve original productType for lossless round-trip (PMS, AIF, insurance, etc.)
  productType: z.string().optional(),
  quantity: z.number(),
  averageCost: z.number().optional(),
  currentValue: z.number(),
  currentNav: z.number().optional(),
  investedValue: z.number().optional(),
  unrealizedGain: z.number().optional(),
  unrealizedGainPercent: z.number().optional(),
  folioNumber: z.string().optional(),
  broker: z.string().optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
});


export const portfolioAllocationSchema = z.object({
  equity: z.number().default(0),
  debt: z.number().default(0),
  gold: z.number().default(0),
  cash: z.number().default(0),
  others: z.number().default(0),
});

export type PortfolioAllocation = z.infer<typeof portfolioAllocationSchema>;

export const portfolioSnapshotSchema = z.object({
  holdings: z.array(portfolioHoldingSchema),
  totalInvestedValue: z.number(),
  totalCurrentValue: z.number(),
  totalUnrealizedGain: z.number().optional(),
  allocation: portfolioAllocationSchema.optional(),
  sourceType: z.enum(['pdf_upload', 'url_import', 'manual_entry', 'api_fetch']),
  sourceName: z.string().optional(),
  sourceUrl: z.string().optional(),
  fileName: z.string().optional(),
  capturedAt: z.string(),
  parsingStatus: z.enum(['pending', 'parsing', 'completed', 'failed', 'needs_review']),
  parsingErrors: z.array(z.string()).optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
  brokerDetected: z.string().optional(),
});


export const portfolioImportRequestSchema = z.object({
  sourceType: z.enum(['pdf_upload', 'url_import']),
  url: z.string().url().optional(),
});

export type PortfolioImportRequest = z.infer<typeof portfolioImportRequestSchema>;

// ============ PROPOSAL INTERACTIONS ============
// Client questions, agent responses, and revision tracking

export type ProposalInteraction = typeof proposalInteractions.$inferSelect;
export type InsertProposalInteraction = z.infer<typeof insertProposalInteractionSchema>;

// ============ CLIENT APPROVAL WORKFLOW ============
// Tracks formal client approval for execution

export type ProposalApproval = typeof proposalApprovals.$inferSelect;
export type InsertProposalApproval = z.infer<typeof insertProposalApprovalSchema>;

// Goal types for fresh investment proposals
export const InvestmentGoalTypes = [
  'retirement',
  'child_education',
  'wealth_creation',
  'home_purchase',
  'emergency_fund',
  'tax_saving',
  'regular_income',
  'custom'
] as const;
export type InvestmentGoalType = typeof InvestmentGoalTypes[number];

// ============ INSTRUMENT MASTER ============
// Unified instrument lookup table for ISIN-based portfolio entry

// ============ PROPOSAL HOLDINGS ============
// Structured holdings for prospect proposals with ISIN-based entries

export type ProposalHolding = typeof proposalHoldings.$inferSelect;
export type InsertProposalHolding = z.infer<typeof insertProposalHoldingSchema>;

// ============ FUND MANAGERS ============
// Track fund managers and their performance across AIF/PMS
// Defined before AIF/PMS tables since they reference this


// ============ AIF MASTER (Alternative Investment Funds) ============
// Institutional-grade AIF scheme database with Finalyca-style analytics





// ============ CLIENT PORTFOLIO - AIF HOLDINGS ============
// Tracks client's existing AIF investments for AI analysis and portfolio management




// ============ CLIENT PORTFOLIO - PMS HOLDINGS ============
// Tracks client's existing PMS investments for AI analysis and portfolio management


// ============ MLD MASTER (Market Linked Debentures) ============
// Structured product database for listed and unlisted MLDs




// ============ MLD PRICE HISTORY ============
// Secondary market prices for listed MLDs or OTC quotes

export const mldPriceHistory = pgTable("mld_price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mldId: varchar("mld_id").notNull().references(() => mldMaster.id),
  
  priceDate: date("price_date").notNull(),
  price: decimal("price", { precision: 15, scale: 4 }).notNull(),
  ytm: decimal("ytm", { precision: 8, scale: 4 }),
  volume: decimal("volume", { precision: 15, scale: 2 }),
  source: text("source"), // NSE, BSE, OTC, Dealer
  
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mld_price_history_mld").on(table.mldId),
  index("idx_mld_price_history_date").on(table.priceDate),
]);

export const insertMldPriceHistorySchema = createInsertSchema(mldPriceHistory).omit({
  id: true,
  createdAt: true,
});
export type MldPriceHistory = typeof mldPriceHistory.$inferSelect;
export type InsertMldPriceHistory = z.infer<typeof insertMldPriceHistorySchema>;

// ============ MLD MONTHWISE PERFORMANCE ============
// Monthly performance tracking for MLDs with price history

export const mldMonthwisePerformance = pgTable("mld_monthwise_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mldId: varchar("mld_id").notNull().references(() => mldMaster.id),
  
  monthYear: date("month_year").notNull(), // First day of the month
  priceStart: decimal("price_start", { precision: 15, scale: 4 }),
  priceEnd: decimal("price_end", { precision: 15, scale: 4 }),
  returnMonthly: decimal("return_monthly", { precision: 8, scale: 4 }),
  isPartial: boolean("is_partial").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mld_monthwise_performance_mld").on(table.mldId),
  index("idx_mld_monthwise_performance_month").on(table.monthYear),
]);

export const insertMldMonthwisePerformanceSchema = createInsertSchema(mldMonthwisePerformance).omit({
  id: true,
  createdAt: true,
});
export type MldMonthwisePerformance = typeof mldMonthwisePerformance.$inferSelect;
export type InsertMldMonthwisePerformance = z.infer<typeof insertMldMonthwisePerformanceSchema>;

// ============ CLIENT PORTFOLIO - MLD HOLDINGS ============
// Tracks client's existing MLD investments for AI analysis and portfolio management


// ============ INVESTMENT INQUIRIES ============
// Express Interest / Investment Inquiry tracking for AIF, PMS, MLD




export const investmentInquiries = pgTable("investment_inquiries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Product Reference
  productType: text("product_type").notNull(), // 'aif', 'pms', 'mld'
  productId: varchar("product_id").notNull(),
  productName: text("product_name").notNull(),
  
  // Investor Details
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  panNumber: text("pan_number"),
  
  // Inquiry Details
  investmentAmount: decimal("investment_amount", { precision: 15, scale: 2 }),
  investmentTimeline: text("investment_timeline"), // 'immediate', 'within_1_month', 'within_3_months', 'exploring'
  message: text("message"),
  
  // Lead Management
  status: text("status").default("new"), // 'new', 'contacted', 'qualified', 'negotiating', 'closed_won', 'closed_lost'
  priority: text("priority").default("medium"), // 'low', 'medium', 'high', 'urgent'
  assignedTo: varchar("assigned_to").references(() => users.id),
  
  // Follow-up Tracking
  lastContactedAt: timestamp("last_contacted_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  notes: text("notes"),
  
  // Source Tracking
  source: text("source").default("marketplace"), // 'marketplace', 'advisor_referral', 'website', 'campaign'
  utmSource: text("utm_source"),
  utmCampaign: text("utm_campaign"),
  
  // Metadata
  kycStatus: text("kyc_status"), // User's KYC status at time of inquiry
  metadata: jsonb("metadata"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_investment_inquiries_product").on(table.productType, table.productId),
  index("idx_investment_inquiries_user").on(table.userId),
  index("idx_investment_inquiries_status").on(table.status),
  index("idx_investment_inquiries_assigned").on(table.assignedTo),
  index("idx_investment_inquiries_created").on(table.createdAt),
]);

export const insertInvestmentInquirySchema = createInsertSchema(investmentInquiries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InvestmentInquiry = typeof investmentInquiries.$inferSelect;
export type InsertInvestmentInquiry = z.infer<typeof insertInvestmentInquirySchema>;

// ============ MEETING BOOKINGS ============
// Client-Agent meeting bookings via Zoho Meeting



export const meetingBookings = pgTable("meeting_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Participants
  clientId: varchar("client_id").references(() => users.id).notNull(),
  agentId: varchar("agent_id").references(() => users.id).notNull(),
  
  // Meeting Details
  topic: text("topic").notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").default(30), // Duration in minutes
  timezone: text("timezone").default("Asia/Kolkata"),
  
  // Zoho Meeting Integration
  zohoMeetingId: text("zoho_meeting_id"),
  joinLink: text("join_link"),
  startLink: text("start_link"), // For host/agent
  
  // Status
  status: text("status").default("pending"), // 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'
  
  // Notes & Feedback
  clientNotes: text("client_notes"),
  agentNotes: text("agent_notes"),
  outcome: text("outcome"), // Post-meeting outcome/summary
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
}, (table) => [
  index("idx_meeting_bookings_client").on(table.clientId),
  index("idx_meeting_bookings_agent").on(table.agentId),
  index("idx_meeting_bookings_status").on(table.status),
  index("idx_meeting_bookings_scheduled").on(table.scheduledAt),
]);

export const insertMeetingBookingSchema = createInsertSchema(meetingBookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MeetingBooking = typeof meetingBookings.$inferSelect;
export type InsertMeetingBooking = z.infer<typeof insertMeetingBookingSchema>;

// ============================================
// SEBI-ALIGNED CLIENT RISK PROFILING ENGINE
// ============================================

// Risk Profile Master (5-Tier Taxonomy per SEBI guidelines)


export const insertSebiGoalRiskProfileSchema = createInsertSchema(sebiGoalRiskProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SebiGoalRiskProfile = typeof sebiGoalRiskProfiles.$inferSelect;
export type InsertSebiGoalRiskProfile = z.infer<typeof insertSebiGoalRiskProfileSchema>;

// ============================================================


// Stock Financial Ratios - Real-time metrics for stocks


// Recommendation Performance Tracking - Track how well our recommendations perform


// Insert Schemas and Types for Financial Ratios


// SEBI Risk Profile Enums for type safety
export const SebiRiskProfileCodeEnum = z.enum(['RP1', 'RP2', 'RP3', 'RP4', 'RP5']);
export const SebiRiskBandEnum = z.enum(['very_low', 'low_moderate', 'moderate', 'moderate_high', 'high']);
export const SebiAssessmentTypeEnum = z.enum(['initial', 'periodic', 'event_triggered', 'ai_suggested']);
export const SebiOverrideTypeEnum = z.enum(['age_horizon', 'no_emergency_fund', 'high_liabilities', 'manual_downgrade']);
export const SebiAiTriggerTypeEnum = z.enum(['large_inflow', 'large_outflow', 'liability_added', 'income_change', 'age_band_crossing', 'panic_selling', 'over_trading']);



// ========================================
// AuthBridge Aadhaar eSign (DSC) Tables
// ========================================
// ========================================
// System Configuration Table
// ========================================
export const systemConfigs = pgTable("system_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: text("value").notNull(),
  category: varchar("category").notNull(), // esign, payment, kyc, notification, etc.
  description: text("description"),
  isEncrypted: boolean("is_encrypted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_system_configs_key").on(table.key),
  index("idx_system_configs_category").on(table.category),
]);

export const insertSystemConfigSchema = createInsertSchema(systemConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type SystemConfig = typeof systemConfigs.$inferSelect;
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;

// ========================================
// REIT (Real Estate Investment Trust) Tables
// ========================================




// ===== PORTFOLIO REPORT BUILDER TABLES =====

// Portfolio Report Templates - Saved configurations for reuse
export type PortfolioReportTemplate = typeof portfolioReportTemplates.$inferSelect;
export type InsertPortfolioReportTemplate = z.infer<typeof insertPortfolioReportTemplateSchema>;

// Insert Schemas and Types for Portfolio Generated Reports
export const insertPortfolioGeneratedReportSchema = createInsertSchema(portfolioGeneratedReports).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export type PortfolioGeneratedReport = typeof portfolioGeneratedReports.$inferSelect;
export type InsertPortfolioGeneratedReport = z.infer<typeof insertPortfolioGeneratedReportSchema>;

// Insert Schemas and Types for Portfolio Report Audit Logs
export const insertPortfolioReportAuditLogSchema = createInsertSchema(portfolioReportAuditLogs).omit({
  id: true,
  timestamp: true,
});
export type PortfolioReportAuditLog = typeof portfolioReportAuditLogs.$inferSelect;
export type InsertPortfolioReportAuditLog = z.infer<typeof insertPortfolioReportAuditLogSchema>;

// Report Configuration JSON Schema (for validation)
export const reportConfigSchema = z.object({
  portfolioId: z.string(),
  benchmark: z.object({
    type: z.enum(['index', 'custom', 'none']),
    name: z.string().optional(),
    currency: z.string().default('INR'),
  }).optional(),
  allocationModel: z.object({
    enabled: z.boolean(),
    modelId: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  coverPage: z.object({
    enabled: z.boolean(),
    title: z.string().optional(),
    clientName: z.string().optional(),
    preparedBy: z.string().optional(),
    date: z.string().optional(),
    logo: z.boolean().optional(),
  }).optional(),
  sections: z.object({
    portfolioXray: z.boolean().optional(),
    portfolioSnapshot: z.boolean().optional(),
    riskReward: z.object({ enabled: z.boolean(), years: z.number() }).optional(),
    stockIntersection: z.boolean().optional(),
    scatterPlot: z.object({ enabled: z.boolean(), years: z.number() }).optional(),
    correlationMatrix: z.boolean().optional(),
    rollingReturns: z.object({ enabled: z.boolean(), months: z.number() }).optional(),
    totalAnnualReturn: z.boolean().optional(),
    investmentGrowth: z.boolean().optional(),
    investmentDetails: z.boolean().optional(),
    underlyingHoldings: z.boolean().optional(),
    targetAssetAllocation: z.boolean().optional(),
    historicalAssetAllocation: z.boolean().optional(),
    portfolioRollingReturns: z.object({ enabled: z.boolean(), months: z.number() }).optional(),
    priceDistribution: z.boolean().optional(),
    disclosureMaterials: z.boolean().optional(),
  }),
  settings: z.object({
    includeAdvisorDefined: z.boolean().optional(),
    includeNotes: z.boolean().optional(),
    language: z.string().default('en-IN'),
    releaseDate: z.enum(['month_end', 'quarter_end', 'custom']).optional(),
    customDate: z.string().optional(),
    dateFormat: z.string().default('dd/mm/yyyy'),
    fontSize: z.enum(['standard', 'large']).default('standard'),
    orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  }).optional(),
});

export type ReportConfig = z.infer<typeof reportConfigSchema>;

// Report Status Enum
export const ReportStatusEnum = z.enum(['pending', 'generating', 'generated', 'failed']);
export const ReportFileTypeEnum = z.enum(['pdf', 'xlsx']);
export const ReportAuditActionEnum = z.enum(['created', 'generated', 'downloaded', 'attached', 'shared', 'deleted']);



// ============================================
// Agent Appointments - Client Meeting Scheduling
// ============================================

export type AgentAppointment = typeof agentAppointments.$inferSelect;
export type InsertAgentAppointment = z.infer<typeof insertAgentAppointmentSchema>;

export const AgentAppointmentMeetingTypeEnum = z.enum(['call', 'video_call', 'in_person', 'office_visit']);
export const AgentAppointmentStatusEnum = z.enum(['scheduled', 'completed', 'cancelled', 'no_show']);
export const AgentAppointmentReminderEnum = z.enum(['none', '15min', '30min', '1hr']);




// ============================================
// API Provider Pricing - Admin-configurable cost per API call
// ============================================

export const apiProviderPricing = pgTable("api_provider_pricing", {
  id: serial("id").primaryKey(),
  providerName: varchar("provider_name", { length: 100 }).notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  description: text("description"),
  costPerCall: numeric("cost_per_call", { precision: 10, scale: 4 }).notNull().default("0"),
  currency: varchar("currency", { length: 10 }).default("INR"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_api_provider_pricing_name").on(table.providerName),
]);

export const insertApiProviderPricingSchema = createInsertSchema(apiProviderPricing).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ApiProviderPricing = typeof apiProviderPricing.$inferSelect;
export type InsertApiProviderPricing = z.infer<typeof insertApiProviderPricingSchema>;

// ============================================
// AI Recommendation Tracking - Success Rate Analytics
// ============================================

export const aiRecommendationStatusValues = ['pending', 'hit_target', 'missed_target', 'stopped_out', 'expired'] as const;
export const aiRecommendationTypeValues2 = ['buy', 'sell', 'hold', 'strong_buy', 'strong_sell'] as const;
export const aiRecommendationAssetTypeValues = ['stock', 'mutual_fund', 'bond', 'unlisted', 'reit', 'invit', 'derivative', 'commodity'] as const;


// ============================================
// Error Ledger - Production Error Tracking System
// ============================================

// Standardized Error Code Taxonomy
export const ErrorCodeEnum = z.enum([
  // KYC Errors
  'KYC_PAN_VERIFY_FAILED',
  'KYC_AADHAAR_VERIFY_FAILED',
  'KYC_CKYC_LOOKUP_FAILED',
  'KYC_DOCUMENT_UPLOAD_FAILED',
  'KYC_VIDEO_VERIFICATION_FAILED',
  'KYC_ESIGN_FAILED',
  'KYC_BANK_VERIFY_FAILED',
  
  // Mutual Fund Errors
  'MF_ORDER_PLACEMENT_FAILED',
  'MF_SIP_REGISTRATION_FAILED',
  'MF_REDEMPTION_FAILED',
  'MF_SWITCH_FAILED',
  'MF_NAV_FETCH_FAILED',
  'MF_FOLIO_CREATION_FAILED',
  
  // Payment Errors
  'PAYMENT_GATEWAY_TIMEOUT',
  'PAYMENT_GATEWAY_FAILURE',
  'PAYMENT_VERIFICATION_FAILED',
  'PAYMENT_REFUND_FAILED',
  'PAYMENT_UPI_TIMEOUT',
  'PAYMENT_NETBANKING_FAILED',
  
  // AIF/PMS Errors
  'AIF_SUBSCRIPTION_BLOCKED',
  'AIF_COMMITMENT_FAILED',
  'PMS_ONBOARDING_FAILED',
  'PMS_AGREEMENT_FAILED',
  
  // Bond/NCD Errors
  'BOND_ORDER_FAILED',
  'BOND_ALLOCATION_FAILED',
  'NCD_APPLICATION_FAILED',
  'BOND_SETTLEMENT_FAILED',
  
  // IPO Errors
  'IPO_APPLICATION_FAILED',
  'IPO_UPI_MANDATE_FAILED',
  'IPO_ALLOTMENT_CHECK_FAILED',
  
  // Stock/Trading Errors
  'STOCK_ORDER_FAILED',
  'STOCK_PRICE_FETCH_FAILED',
  'STOCK_MARKET_DATA_UNAVAILABLE',
  
  // Unlisted Marketplace Errors
  'UNLISTED_DEAL_FAILED',
  'UNLISTED_PRICE_SUGGESTION_FAILED',
  'UNLISTED_COMPLIANCE_BLOCKED',
  'UNLISTED_MCA_FETCH_FAILED',
  
  // Tax/ITR Errors
  'TAX_ITR_FILING_FAILED',
  'TAX_COMPUTATION_FAILED',
  'TAX_PAYMENT_FAILED',
  'TAX_VERIFICATION_FAILED',
  
  // Authentication Errors
  'AUTH_SESSION_EXPIRED',
  'AUTH_OTP_EXPIRED',
  'AUTH_OTP_INVALID',
  'AUTH_2FA_FAILED',
  'AUTH_LOGIN_FAILED',
  'AUTH_UNAUTHORIZED',
  
  // Network/System Errors
  'NETWORK_DISCONNECTED',
  'NETWORK_TIMEOUT',
  'NETWORK_DNS_FAILED',
  'SERVER_INTERNAL_ERROR',
  'SERVER_OVERLOADED',
  'SERVER_MAINTENANCE',
  
  // Database Errors
  'DATABASE_CONNECTION_FAILED',
  'DATABASE_QUERY_FAILED',
  'DATABASE_TIMEOUT',
  'DATABASE_CONSTRAINT_VIOLATION',
  
  // API Integration Errors
  'API_RATE_LIMIT_EXCEEDED',
  'API_CREDENTIALS_INVALID',
  'API_SERVICE_UNAVAILABLE',
  'API_RESPONSE_INVALID',
  
  // Document/File Errors
  'DOCUMENT_UPLOAD_FAILED',
  'DOCUMENT_PARSE_FAILED',
  'DOCUMENT_VALIDATION_FAILED',
  'DOCUMENT_SIZE_EXCEEDED',
  
  // Notification Errors
  'NOTIFICATION_EMAIL_FAILED',
  'NOTIFICATION_SMS_FAILED',
  'NOTIFICATION_WHATSAPP_FAILED',
  'NOTIFICATION_PUSH_FAILED',
  
  // Generic/Unknown
  'UNKNOWN_ERROR',
  'VALIDATION_ERROR',
  'PERMISSION_DENIED',
]);

export type ErrorCode = z.infer<typeof ErrorCodeEnum>;

// Error Severity Levels
export const ErrorSeverityEnum = z.enum(['info', 'warning', 'error', 'critical']);
export type ErrorSeverity = z.infer<typeof ErrorSeverityEnum>;

// Error Source
export const ErrorSourceEnum = z.enum(['frontend', 'backend', 'webhook', 'cron', 'integration']);
export type ErrorSource = z.infer<typeof ErrorSourceEnum>;

// Error Status
export const ErrorStatusEnum = z.enum(['open', 'acknowledged', 'in_progress', 'resolved', 'ignored']);
export type ErrorStatus = z.infer<typeof ErrorStatusEnum>;

// Module Categories
export const ErrorModuleEnum = z.enum([
  'kyc', 'mutual_fund', 'aif', 'pms', 'bond', 'ncd', 'ipo', 'stock', 
  'unlisted', 'tax', 'itr', 'payment', 'auth', 'portfolio', 'store',
  'admin', 'agent', 'partner', 'notification', 'document', 'api', 'system'
]);
export type ErrorModule = z.infer<typeof ErrorModuleEnum>;

// Error Ledger Table
export const errorLedger = pgTable("error_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Error Classification
  errorCode: varchar("error_code", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 20 }).notNull().default("error"),
  source: varchar("source", { length: 20 }).notNull(),
  module: varchar("module", { length: 50 }).notNull(),
  
  // Error Details
  message: text("message").notNull(),
  stackHash: varchar("stack_hash", { length: 64 }),
  stackTrace: text("stack_trace"),
  
  // Context (business-aware)
  clientId: varchar("client_id").references(() => users.id),
  agentId: varchar("agent_id").references(() => users.id),
  panMasked: varchar("pan_masked", { length: 20 }),
  transactionId: varchar("transaction_id", { length: 100 }),
  requestId: varchar("request_id", { length: 100 }),
  
  // User Agent & Environment
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  url: text("url"),
  httpMethod: varchar("http_method", { length: 10 }),
  httpStatus: integer("http_status"),
  
  // External Tracking
  sentryEventId: varchar("sentry_event_id", { length: 100 }),
  
  // Status & Resolution
  status: varchar("status", { length: 20 }).default("open"),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNote: text("resolution_note"),
  
  // Occurrence Tracking
  occurrenceCount: integer("occurrence_count").default(1),
  firstOccurrence: timestamp("first_occurrence").defaultNow(),
  lastOccurrence: timestamp("last_occurrence").defaultNow(),
  
  // Environment
  environment: varchar("environment", { length: 20 }).default("production"),
  buildVersion: varchar("build_version", { length: 50 }),
  
  // Metadata
  metadata: jsonb("metadata"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_error_ledger_severity").on(table.severity),
  index("idx_error_ledger_status").on(table.status),
  index("idx_error_ledger_module").on(table.module),
  index("idx_error_ledger_error_code").on(table.errorCode),
  index("idx_error_ledger_client").on(table.clientId),
  index("idx_error_ledger_agent").on(table.agentId),
  index("idx_error_ledger_created").on(table.createdAt),
  index("idx_error_ledger_sentry").on(table.sentryEventId),
  index("idx_error_ledger_stack_hash").on(table.stackHash),
]);

export const insertErrorLedgerSchema = createInsertSchema(errorLedger).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  acknowledgedAt: true,
  resolvedAt: true,
  firstOccurrence: true,
  lastOccurrence: true,
});
export type ErrorLedgerEntry = typeof errorLedger.$inferSelect;
export type InsertErrorLedger = z.infer<typeof insertErrorLedgerSchema>;

// Error Ingestion Request Schema (for API validation)
export const errorIngestionSchema = z.object({
  source: ErrorSourceEnum,
  severity: ErrorSeverityEnum,
  errorCode: ErrorCodeEnum.or(z.string()),
  message: z.string().min(1).max(2000),
  stack: z.string().max(10000).optional(),
  context: z.object({
    module: ErrorModuleEnum.or(z.string()),
    clientId: z.string().uuid().optional(),
    agentId: z.string().uuid().optional(),
    transactionId: z.string().optional(),
    pan: z.string().optional(),
    requestId: z.string().optional(),
    url: z.string().optional(),
    userAgent: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  sentryEventId: z.string().optional(),
  buildVersion: z.string().optional(),
});
export type ErrorIngestionRequest = z.infer<typeof errorIngestionSchema>;

// ===== ERROR ALERTING WEBHOOK CONFIGURATION =====

// Webhook Provider Types
export const WebhookProviderEnum = z.enum(['slack', 'teams', 'discord', 'generic']);
export type WebhookProvider = z.infer<typeof WebhookProviderEnum>;

// Error Webhook Configuration Table
export const errorWebhookConfig = pgTable("error_webhook_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Webhook Details
  name: varchar("name", { length: 100 }).notNull(),
  provider: varchar("provider", { length: 20 }).notNull(), // slack, teams, discord, generic
  webhookUrl: text("webhook_url").notNull(),
  
  // Configuration
  isEnabled: boolean("is_enabled").default(true),
  environment: varchar("environment", { length: 20 }).default("production"), // production, development, all
  
  // Trigger Conditions
  triggerOnCritical: boolean("trigger_on_critical").default(true),
  triggerOnSpike: boolean("trigger_on_spike").default(true),
  triggerModules: text("trigger_modules").array(), // null = all modules
  
  // Rate Limiting
  cooldownMinutes: integer("cooldown_minutes").default(5), // Min time between alerts
  lastTriggeredAt: timestamp("last_triggered_at"),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertErrorWebhookConfigSchema = createInsertSchema(errorWebhookConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastTriggeredAt: true,
});
export type ErrorWebhookConfig = typeof errorWebhookConfig.$inferSelect;
export type InsertErrorWebhookConfig = z.infer<typeof insertErrorWebhookConfigSchema>;

// ===== ERROR SPIKE DETECTION THRESHOLDS =====

// Error Alert Threshold Configuration
export const errorAlertThreshold = pgTable("error_alert_threshold", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Scope (null = global default)
  module: varchar("module", { length: 50 }), // null = applies to all modules
  errorCode: varchar("error_code", { length: 100 }), // null = applies to all error codes
  
  // Threshold Configuration
  windowMinutes: integer("window_minutes").default(5), // Rolling window size
  occurrenceThreshold: integer("occurrence_threshold").default(10), // N occurrences to trigger
  
  // Behavior
  isEnabled: boolean("is_enabled").default(true),
  autoEscalateToCritical: boolean("auto_escalate_to_critical").default(true),
  
  // Metadata
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertErrorAlertThresholdSchema = createInsertSchema(errorAlertThreshold).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type ErrorAlertThreshold = typeof errorAlertThreshold.$inferSelect;
export type InsertErrorAlertThreshold = z.infer<typeof insertErrorAlertThresholdSchema>;

// ===== ERROR ALERT HISTORY (for audit trail) =====

export const errorAlertHistory = pgTable("error_alert_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Alert Details
  alertType: varchar("alert_type", { length: 20 }).notNull(), // critical, spike
  webhookConfigId: varchar("webhook_config_id").references(() => errorWebhookConfig.id),
  
  // Related Errors
  errorIds: text("error_ids").array(), // Array of error ledger IDs that triggered this alert
  errorCode: varchar("error_code", { length: 100 }),
  module: varchar("module", { length: 50 }),
  
  // Spike Context (if applicable)
  occurrenceCount: integer("occurrence_count"),
  windowMinutes: integer("window_minutes"),
  
  // Delivery Status
  deliveryStatus: varchar("delivery_status", { length: 20 }).default("pending"), // pending, sent, failed
  deliveryResponse: text("delivery_response"),
  deliveryAttempts: integer("delivery_attempts").default(0),
  
  // Timestamps
  triggeredAt: timestamp("triggered_at").defaultNow(),
  deliveredAt: timestamp("delivered_at"),
}, (table) => [
  index("idx_error_alert_history_type").on(table.alertType),
  index("idx_error_alert_history_triggered").on(table.triggeredAt),
]);

export const insertErrorAlertHistorySchema = createInsertSchema(errorAlertHistory).omit({
  id: true,
  triggeredAt: true,
  deliveredAt: true,
});
export type ErrorAlertHistory = typeof errorAlertHistory.$inferSelect;
export type InsertErrorAlertHistory = z.infer<typeof insertErrorAlertHistorySchema>;

// ===== USER ERROR FEEDBACK =====

export const errorUserFeedback = pgTable("error_user_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Link to Error
  errorLedgerId: varchar("error_ledger_id").references(() => errorLedger.id),
  errorId: varchar("error_id", { length: 100 }), // Client-side error ID for matching
  
  // User Info
  userId: varchar("user_id").references(() => users.id),
  userEmail: varchar("user_email", { length: 255 }),
  
  // Feedback Content
  feedbackText: text("feedback_text").notNull(),
  expectedBehavior: text("expected_behavior"),
  stepsToReproduce: text("steps_to_reproduce"),
  
  // Context
  url: text("url"),
  userAgent: text("user_agent"),
  
  // Status
  status: varchar("status", { length: 20 }).default("new"), // new, reviewed, addressed
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertErrorUserFeedbackSchema = createInsertSchema(errorUserFeedback).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});
export type ErrorUserFeedback = typeof errorUserFeedback.$inferSelect;
export type InsertErrorUserFeedback = z.infer<typeof insertErrorUserFeedbackSchema>;

// ============= ADMIN-FINAL APPROVAL MODEL FOR APPOINTMENTS =============

// User Appointment Status Enum
export const UserAppointmentStatus = {
  DRAFT: 'draft',
  PENDING_ADMIN_APPROVAL: 'pending_admin_approval',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended'
} as const;

// Appointment Audit Logs - Immutable logs for SEBI compliance
export const appointmentAuditLogs = pgTable("appointment_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Appointment Details
  role: varchar("role").notNull(), // partner, master_agent, agent, sub_agent, support_staff, ca
  previousStatus: varchar("previous_status"),
  newStatus: varchar("new_status").notNull(),
  
  // Creator Information
  createdByUserId: varchar("created_by_user_id"),
  createdByRole: varchar("created_by_role"),
  createdByName: varchar("created_by_name"),
  
  // Admin Action (if applicable)
  adminUserId: varchar("admin_user_id"),
  adminName: varchar("admin_name"),
  adminAction: varchar("admin_action"), // approved, rejected, suspended
  adminReason: text("admin_reason"), // Mandatory for rejection
  
  // Cost Centre Tracking
  costCentreId: varchar("cost_centre_id"),
  costCentreName: varchar("cost_centre_name"),
  
  // Metadata
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  
  // Additional context
  metadata: jsonb("metadata").default({}),
}, (table) => [
  index("idx_appointment_audit_user_id").on(table.userId),
  index("idx_appointment_audit_timestamp").on(table.timestamp),
  index("idx_appointment_audit_status").on(table.newStatus),
  index("idx_appointment_audit_admin").on(table.adminUserId),
]);

// Pending Appointments Queue - For Admin Dashboard
export const pendingAppointments = pgTable("pending_appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Appointment Details
  requestedRole: varchar("requested_role").notNull(),
  currentRoles: varchar("current_roles").array().default(sql`ARRAY[]::varchar[]`),
  
  // Initiator Information
  initiatedByUserId: varchar("initiated_by_user_id").notNull(),
  initiatedByRole: varchar("initiated_by_role").notNull(),
  initiatedByName: varchar("initiated_by_name"),
  
  // Cost Centre Assignment
  costCentreId: varchar("cost_centre_id"),
  costCentreName: varchar("cost_centre_name"),
  
  // Status
  status: varchar("status").default("pending").notNull(), // pending, approved, rejected
  
  // Admin Processing
  processedByAdminId: varchar("processed_by_admin_id"),
  processedByAdminName: varchar("processed_by_admin_name"),
  processedAt: timestamp("processed_at"),
  rejectionReason: text("rejection_reason"),
  
  // Profile Snapshot (for review)
  userProfile: jsonb("user_profile").default({}),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional expiry for stale requests
}, (table) => [
  index("idx_pending_appointments_status").on(table.status),
  index("idx_pending_appointments_role").on(table.requestedRole),
  index("idx_pending_appointments_initiator").on(table.initiatedByUserId),
  index("idx_pending_appointments_created").on(table.createdAt),
]);

// Insert schemas for appointment tables
export const insertAppointmentAuditLogSchema = createInsertSchema(appointmentAuditLogs).omit({ id: true, timestamp: true });
export type AppointmentAuditLog = typeof appointmentAuditLogs.$inferSelect;
export type InsertAppointmentAuditLog = z.infer<typeof insertAppointmentAuditLogSchema>;

export const insertPendingAppointmentSchema = createInsertSchema(pendingAppointments).omit({ id: true, createdAt: true, updatedAt: true });
export type PendingAppointment = typeof pendingAppointments.$inferSelect;
export type InsertPendingAppointment = z.infer<typeof insertPendingAppointmentSchema>;

// Immutable Audit Logs Table (append-only, no updates or deletes allowed)
export const immutableAuditLogs = pgTable("immutable_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  userId: varchar("user_id", { length: 255 }),
  userRole: varchar("user_role", { length: 50 }),
  entityType: varchar("entity_type", { length: 100 }),
  entityId: varchar("entity_id", { length: 255 }),
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  metadata: jsonb("metadata").notNull().default('{}'),
  checksum: varchar("checksum", { length: 64 }).notNull(),
  previousChecksum: varchar("previous_checksum", { length: 64 }),
});

export type ImmutableAuditLog = typeof immutableAuditLogs.$inferSelect;
export type InsertImmutableAuditLog = typeof immutableAuditLogs.$inferInsert;

// ============================================
// US TRADING MODULE (Alpaca + Polygon)
// ============================================

// US Broker Account Status Enum
export const usBrokerAccountStatusValues = ['pending', 'paper', 'live', 'suspended', 'closed'] as const;
export const UsBrokerAccountStatusEnum = z.enum(usBrokerAccountStatusValues);

// US Order Side Enum
export const usOrderSideValues = ['buy', 'sell'] as const;
export const UsOrderSideEnum = z.enum(usOrderSideValues);

// US Order Type Enum
export const usOrderTypeValues = ['market', 'limit', 'stop', 'stop_limit'] as const;
export const UsOrderTypeEnum = z.enum(usOrderTypeValues);

// US Order Status Enum
export const usOrderStatusValues = ['pending', 'submitted', 'accepted', 'filled', 'partially_filled', 'cancelled', 'rejected', 'expired'] as const;
export const UsOrderStatusEnum = z.enum(usOrderStatusValues);

// US Time in Force Enum
export const usTimeInForceValues = ['day', 'gtc', 'ioc', 'fok'] as const;
export const UsTimeInForceEnum = z.enum(usTimeInForceValues);

// US Broker Accounts Table

// US Orders Table


// US Holdings Table
export const usHoldings = pgTable("us_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  brokerAccountId: varchar("broker_account_id").references(() => usBrokerAccounts.id),
  
  // Holding Details
  symbol: varchar("symbol", { length: 10 }).notNull(),
  assetType: varchar("asset_type", { length: 20 }).default("stock"), // stock, etf
  quantity: decimal("quantity", { precision: 15, scale: 6 }).notNull(),
  avgPriceUsd: decimal("avg_price_usd", { precision: 15, scale: 4 }).notNull(),
  
  // Current Valuation (updated via sync)
  currentPriceUsd: decimal("current_price_usd", { precision: 15, scale: 4 }),
  marketValueUsd: decimal("market_value_usd", { precision: 15, scale: 2 }),
  unrealizedPlUsd: decimal("unrealized_pl_usd", { precision: 15, scale: 2 }),
  unrealizedPlPercent: decimal("unrealized_pl_percent", { precision: 8, scale: 4 }),
  
  // FX Tracking
  fxRateAtBuy: decimal("fx_rate_at_buy", { precision: 10, scale: 4 }),
  currentFxRate: decimal("current_fx_rate", { precision: 10, scale: 4 }),
  marketValueInr: decimal("market_value_inr", { precision: 15, scale: 2 }),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  lastSyncAt: timestamp("last_sync_at"),
}, (table) => [
  index("idx_us_holdings_client").on(table.clientId),
  index("idx_us_holdings_symbol").on(table.symbol),
]);

export const insertUsHoldingSchema = createInsertSchema(usHoldings).omit({ id: true, createdAt: true, updatedAt: true });
export type UsHolding = typeof usHoldings.$inferSelect;
export type InsertUsHolding = z.infer<typeof insertUsHoldingSchema>;

// US Trade Consents Table (Immutable Audit Trail)
export type UsConsent = typeof usConsents.$inferSelect;
export type InsertUsConsent = z.infer<typeof insertUsConsentSchema>;

// US LRS Declarations Table
export const usLrsDeclarations = pgTable("us_lrs_declarations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  // LRS Details
  financialYear: varchar("financial_year", { length: 10 }).notNull(), // e.g., "2024-25"
  purposeCode: varchar("purpose_code", { length: 20 }).default("S0001"), // Overseas investment
  amountUsd: decimal("amount_usd", { precision: 15, scale: 2 }).notNull(),
  
  // Declaration
  declarationText: text("declaration_text").notNull(),
  declarationHash: varchar("declaration_hash", { length: 128 }).notNull(),
  
  // Timestamps
  declaredAt: timestamp("declared_at").defaultNow().notNull(),
}, (table) => [
  index("idx_us_lrs_client").on(table.clientId),
  index("idx_us_lrs_fy").on(table.financialYear),
]);

export const insertUsLrsDeclarationSchema = createInsertSchema(usLrsDeclarations).omit({ id: true, declaredAt: true });
export type UsLrsDeclaration = typeof usLrsDeclarations.$inferSelect;
export type InsertUsLrsDeclaration = z.infer<typeof insertUsLrsDeclarationSchema>;

// US Market Watchlist Table
export const usWatchlist = pgTable("us_watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => users.id).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  notes: text("notes"),
}, (table) => [
  index("idx_us_watchlist_client").on(table.clientId),
]);

export const insertUsWatchlistSchema = createInsertSchema(usWatchlist).omit({ id: true, addedAt: true });
export type UsWatchlist = typeof usWatchlist.$inferSelect;
export type InsertUsWatchlist = z.infer<typeof insertUsWatchlistSchema>;

// Feature Flags Table for US Trading
export const usFeatureFlags = pgTable("us_feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  flagName: varchar("flag_name", { length: 100 }).notNull().unique(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  description: text("description"),
  metadata: jsonb("metadata").default({}),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by"),
});

export const insertUsFeatureFlagSchema = createInsertSchema(usFeatureFlags).omit({ id: true, updatedAt: true });
export type UsFeatureFlag = typeof usFeatureFlags.$inferSelect;
export type InsertUsFeatureFlag = z.infer<typeof insertUsFeatureFlagSchema>;

// User Notification Preferences Table
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // Channel preferences (email and whatsapp enabled by default, sms as fallback)
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  whatsappEnabled: boolean("whatsapp_enabled").default(true).notNull(),
  smsEnabled: boolean("sms_enabled").default(false).notNull(),
  pushEnabled: boolean("push_enabled").default(true).notNull(),
  
  // OTP delivery channel priority order (default: email, whatsapp, sms)
  preferredOtpChannels: text("preferred_otp_channels").array().default(sql`ARRAY['email', 'whatsapp', 'sms']`),
  
  // US Trading notifications
  usOrderFilled: boolean("us_order_filled").default(true).notNull(),
  usOrderCancelled: boolean("us_order_cancelled").default(true).notNull(),
  usOrderRejected: boolean("us_order_rejected").default(true).notNull(),
  usMarketAlerts: boolean("us_market_alerts").default(true).notNull(),
  usRebalancingSuggestions: boolean("us_rebalancing_suggestions").default(true).notNull(),
  
  // Other trading notifications
  orderUpdates: boolean("order_updates").default(true).notNull(),
  portfolioAlerts: boolean("portfolio_alerts").default(true).notNull(),
  
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNotificationPreferenceSchema = createInsertSchema(notificationPreferences).omit({ id: true, updatedAt: true });
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = z.infer<typeof insertNotificationPreferenceSchema>;

// ============================================
// WhatsApp Contact Tracking - Track if user has ever messaged
// ============================================
export const whatsappContacts = pgTable("whatsapp_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull().unique(),
  userId: varchar("user_id").references(() => users.id),
  hasInitiatedContact: boolean("has_initiated_contact").default(false).notNull(),
  firstContactAt: timestamp("first_contact_at"),
  lastMessageAt: timestamp("last_message_at"),
  messageCount: integer("message_count").default(0).notNull(),
  optedOut: boolean("opted_out").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_whatsapp_contacts_phone").on(table.phoneNumber),
  index("idx_whatsapp_contacts_user").on(table.userId),
]);

export const insertWhatsappContactSchema = createInsertSchema(whatsappContacts).omit({ id: true, createdAt: true, updatedAt: true });
export type WhatsappContact = typeof whatsappContacts.$inferSelect;
export type InsertWhatsappContact = z.infer<typeof insertWhatsappContactSchema>;

// ============================================
// DOCUMENT LIFECYCLE MANAGEMENT (DLM) SYSTEM
// Epics 1-15: Complete compliance document management
// ============================================

// Document Status Enum


// Document Entity Type Enum


// Agreement Type Enum


// Change Operation Enum for Redlining


// Staff Change Type Enum for Status Changes


// Core Documents Table
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// Document Versions Table (Immutable Version History)
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentVersion = z.infer<typeof insertDocumentVersionSchema>;

// Workflow State Transitions (Audit Trail)
export type DocumentWorkflowTransition = typeof documentWorkflowTransitions.$inferSelect;
export type InsertDocumentWorkflowTransition = z.infer<typeof insertDocumentWorkflowTransitionSchema>;

// Document Clauses Table (For Clause-Level Tracking)
export type DocumentClause = typeof documentClauses.$inferSelect;
export type InsertDocumentClause = z.infer<typeof insertDocumentClauseSchema>;

// Tracked Changes (Redlining)
export type DocumentTrackedChange = typeof documentTrackedChanges.$inferSelect;
export type InsertDocumentTrackedChange = z.infer<typeof insertDocumentTrackedChangeSchema>;

// Document Comments/Threads
export type DocumentComment = typeof documentComments.$inferSelect;
export type InsertDocumentComment = z.infer<typeof insertDocumentCommentSchema>;

// SEBI Clause Checklist Master
export const sebiClauseChecklist = pgTable("sebi_clause_checklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Clause Identity
  clauseCode: varchar("clause_code", { length: 50 }).unique().notNull(),
  clauseCategory: varchar("clause_category", { length: 100 }).notNull(),
  clauseTitle: varchar("clause_title", { length: 500 }).notNull(),
  clauseDescription: text("clause_description"),
  
  // Applicability
  isMandatory: boolean("is_mandatory").default(true),
  isConditional: boolean("is_conditional").default(false),
  conditionDescription: text("condition_description"),
  applicableEntityTypes: text("applicable_entity_types").array(), // vendor, partner, agent, etc.
  applicableAgreementTypes: text("applicable_agreement_types").array(),
  
  // Risk & Compliance
  riskWeight: integer("risk_weight").default(1), // 1-10 importance
  regulatoryReference: varchar("regulatory_reference", { length: 255 }), // SEBI circular/guideline reference
  
  // Template
  suggestedClauseText: text("suggested_clause_text"),
  
  // Status
  isActive: boolean("is_active").default(true),
  effectiveFrom: date("effective_from"),
  effectiveTo: date("effective_to"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sebi_checklist_category").on(table.clauseCategory),
  index("idx_sebi_checklist_mandatory").on(table.isMandatory),
]);

export const insertSebiClauseChecklistSchema = createInsertSchema(sebiClauseChecklist).omit({ id: true, createdAt: true, updatedAt: true });
export type SebiClauseChecklist = typeof sebiClauseChecklist.$inferSelect;
export type InsertSebiClauseChecklist = z.infer<typeof insertSebiClauseChecklistSchema>;

// Document Checklist Runs (Per Document Compliance Check)
export type DocumentChecklistRun = typeof documentChecklistRuns.$inferSelect;
export type InsertDocumentChecklistRun = z.infer<typeof insertDocumentChecklistRunSchema>;

// Document Checklist Items (Individual Item Results)
export type DocumentChecklistItem = typeof documentChecklistItems.$inferSelect;
export type InsertDocumentChecklistItem = z.infer<typeof insertDocumentChecklistItemSchema>;

// AI Review Reports
export type DocumentAiReview = typeof documentAiReviews.$inferSelect;
export type InsertDocumentAiReview = z.infer<typeof insertDocumentAiReviewSchema>;

// Document Audit Events (Immutable Append-Only Log)
export type DocumentAuditEvent = typeof documentAuditEvents.$inferSelect;
export type InsertDocumentAuditEvent = z.infer<typeof insertDocumentAuditEventSchema>;

// Document Signatures
export type DocumentSignature = typeof documentSignatures.$inferSelect;
export type InsertDocumentSignature = z.infer<typeof insertDocumentSignatureSchema>;

// Entity Compliance Scorecard
export type EntityComplianceScore = typeof entityComplianceScores.$inferSelect;
export type InsertEntityComplianceScore = z.infer<typeof insertEntityComplianceScoreSchema>;

// Regulatory Updates/Bulletins
export const regulatoryBulletins = pgTable("regulatory_bulletins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Bulletin Details
  bulletinCode: varchar("bulletin_code", { length: 50 }).unique(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  
  // Source
  regulatoryBody: varchar("regulatory_body", { length: 100 }).notNull(), // SEBI, RBI, etc.
  circularNumber: varchar("circular_number", { length: 100 }),
  circularDate: date("circular_date"),
  effectiveDate: date("effective_date"),
  
  // Impact
  impactLevel: varchar("impact_level", { length: 20 }), // low, medium, high, critical
  affectedEntityTypes: text("affected_entity_types").array(),
  affectedAgreementTypes: text("affected_agreement_types").array(),
  affectedClauseCodes: text("affected_clause_codes").array(),
  
  // Content
  summaryText: text("summary_text"),
  fullTextUrl: varchar("full_text_url", { length: 1000 }),
  
  // Action Required
  actionRequired: text("action_required"),
  complianceDeadline: date("compliance_deadline"),
  
  // Status
  isActive: boolean("is_active").default(true),
  isAcknowledged: boolean("is_acknowledged").default(false),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  acknowledgedAt: timestamp("acknowledged_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_bulletins_body").on(table.regulatoryBody),
  index("idx_bulletins_effective").on(table.effectiveDate),
  index("idx_bulletins_impact").on(table.impactLevel),
]);

export const insertRegulatoryBulletinSchema = createInsertSchema(regulatoryBulletins).omit({ id: true, createdAt: true, updatedAt: true });
export type RegulatoryBulletin = typeof regulatoryBulletins.$inferSelect;
export type InsertRegulatoryBulletin = z.infer<typeof insertRegulatoryBulletinSchema>;

// Document Renewal Tracking
export type DocumentRenewal = typeof documentRenewals.$inferSelect;
export type InsertDocumentRenewal = z.infer<typeof insertDocumentRenewalSchema>;

// Override Tracking (Abuse Detection)
export type DocumentOverride = typeof documentOverrides.$inferSelect;
export type InsertDocumentOverride = z.infer<typeof insertDocumentOverrideSchema>;

// ============================================================================
// CKYC Provider Configuration (Config-Based Provider Switching)


// CKYC Mock Blocked Attempts - Security audit log for production
export type CkycMockBlockedAttempt = typeof ckycMockBlockedAttempts.$inferSelect;
export type InsertCkycMockBlockedAttempt = z.infer<typeof insertCkycMockBlockedAttemptSchema>;

// CKYC Audit Log - Immutable event log for compliance and inspection

// CKYC Escalation History - Track all escalations for a case

// =====================================================
// MARKET DATA & INVESTMENT CACHE TABLES
// Reduces API calls for portfolio rebalancing, proposals, and rationale generation
// =====================================================

// Market Data Snapshots - Daily price cache for all asset types



// Product Fundamentals Cache - Company/fund fundamentals, ratings, and risk metrics


// AI Rationale Cache - Store generated AI explanations with input hash for reuse

// Portfolio Metrics Daily - Pre-computed daily portfolio analytics

// Rebalance Summaries - Pre-computed rebalancing suggestions
export const rebalanceSummaries = pgTable("rebalance_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Portfolio Reference
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  portfolioId: varchar("portfolio_id").references(() => portfolios.id),
  
  // Target Allocation
  targetEquity: numeric("target_equity", { precision: 6, scale: 4 }),
  targetDebt: numeric("target_debt", { precision: 6, scale: 4 }),
  targetGold: numeric("target_gold", { precision: 6, scale: 4 }),
  targetCash: numeric("target_cash", { precision: 6, scale: 4 }),
  targetAlternatives: numeric("target_alternatives", { precision: 6, scale: 4 }),
  
  // Current Allocation
  currentEquity: numeric("current_equity", { precision: 6, scale: 4 }),
  currentDebt: numeric("current_debt", { precision: 6, scale: 4 }),
  currentGold: numeric("current_gold", { precision: 6, scale: 4 }),
  currentCash: numeric("current_cash", { precision: 6, scale: 4 }),
  currentAlternatives: numeric("current_alternatives", { precision: 6, scale: 4 }),
  
  // Drift Analysis
  totalDrift: numeric("total_drift", { precision: 6, scale: 4 }),
  driftThreshold: numeric("drift_threshold", { precision: 6, scale: 4 }).default("5.0"),
  exceedsDriftThreshold: boolean("exceeds_drift_threshold").default(false),
  
  // Suggested Trades (pre-computed)
  suggestedBuys: jsonb("suggested_buys").default([]), // [{productId, productType, amount, reason}]
  suggestedSells: jsonb("suggested_sells").default([]), // [{productId, productType, amount, reason}]
  suggestedSwitches: jsonb("suggested_switches").default([]), // [{fromId, toId, amount, reason}]
  
  // Tax Implications (pre-computed)
  estimatedSTCG: numeric("estimated_stcg", { precision: 18, scale: 2 }),
  estimatedLTCG: numeric("estimated_ltcg", { precision: 18, scale: 2 }),
  taxEfficiencyScore: integer("tax_efficiency_score"), // 1-10
  
  // Transaction Cost Estimate
  estimatedBrokerage: numeric("estimated_brokerage", { precision: 12, scale: 2 }),
  estimatedExitLoads: numeric("estimated_exit_loads", { precision: 12, scale: 2 }),
  
  // Rebalancing Rationale (cached AI explanation)
  rationaleHashKey: varchar("rationale_hash_key", { length: 64 }),
  rationale: text("rationale"),
  
  // Status
  status: varchar("status", { length: 20 }).default("pending"), // pending, approved, executed, expired
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  executedAt: timestamp("executed_at"),
  
  // Computation Metadata
  computedAt: timestamp("computed_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  computationTimeMs: integer("computation_time_ms"),
}, (table) => [
  index("idx_rs_user").on(table.userId),
  index("idx_rs_portfolio").on(table.portfolioId),
  index("idx_rs_status").on(table.status),
  index("idx_rs_expires").on(table.expiresAt),
  index("idx_rs_exceeds_drift").on(table.exceedsDriftThreshold),
]);

export const insertRebalanceSummarySchema = createInsertSchema(rebalanceSummaries).omit({ id: true, computedAt: true });
export type RebalanceSummary = typeof rebalanceSummaries.$inferSelect;
export type InsertRebalanceSummary = z.infer<typeof insertRebalanceSummarySchema>;

// Proposal Materializations - Cached investment proposal baskets
export type ProposalMaterialization = typeof proposalMaterializations.$inferSelect;
export type InsertProposalMaterialization = z.infer<typeof insertProposalMaterializationSchema>;

// Cache Refresh Jobs - Track background cache refresh operations
export const cacheRefreshJobs = pgTable("cache_refresh_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Job Type
  jobType: varchar("job_type", { length: 50 }).notNull(), // market_data, fundamentals, portfolio_metrics, rebalance, proposal
  cacheTable: varchar("cache_table", { length: 100 }).notNull(),
  
  // Job Scope
  assetType: varchar("asset_type", { length: 50 }), // For market_data/fundamentals jobs
  userId: varchar("user_id").references(() => users.id), // For portfolio-specific jobs
  
  // Job Status
  status: varchar("status", { length: 20 }).default("pending"), // pending, running, completed, failed
  priority: integer("priority").default(5), // 1=highest, 10=lowest
  
  // Execution Details
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  itemsProcessed: integer("items_processed").default(0),
  itemsFailed: integer("items_failed").default(0),
  
  // Error Tracking
  lastError: text("last_error"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  
  // Scheduling
  scheduledAt: timestamp("scheduled_at").defaultNow().notNull(),
  nextRunAt: timestamp("next_run_at"),
  cronExpression: varchar("cron_expression", { length: 50 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_crj_status").on(table.status),
  index("idx_crj_job_type").on(table.jobType),
  index("idx_crj_scheduled").on(table.scheduledAt),
  index("idx_crj_next_run").on(table.nextRunAt),
]);

export const insertCacheRefreshJobSchema = createInsertSchema(cacheRefreshJobs).omit({ id: true, createdAt: true });
export type CacheRefreshJob = typeof cacheRefreshJobs.$inferSelect;
export type InsertCacheRefreshJob = z.infer<typeof insertCacheRefreshJobSchema>;

// ============================================================================
// GLOBAL ADVISORY SYSTEM - EPIC 1 & 2
// Multi-country advisory without execution, SEBI-safe positioning
// ============================================================================

// Markets Master - Define supported markets/geographies
export const marketsMaster = pgTable("markets_master", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Market Identification
  marketCode: varchar("market_code", { length: 10 }).notNull().unique(), // IN, UK, EU, SG, JP, HK, ME, EM
  marketName: varchar("market_name", { length: 100 }).notNull(),
  region: varchar("region", { length: 50 }).notNull(), // Asia, Europe, Middle East, Americas
  
  // Advisory Level Configuration
  advisoryLevel: varchar("advisory_level", { length: 20 }).notNull().default("ANALYTICS_ONLY"), // FULL, ANALYTICS_ONLY
  executionAllowed: boolean("execution_allowed").default(false), // Only true for India
  
  // Currency & Timezone
  baseCurrency: varchar("base_currency", { length: 3 }).notNull(), // INR, USD, EUR, GBP, SGD, JPY, HKD, AED
  timezone: varchar("timezone", { length: 50 }).notNull(),
  
  // Regulatory Information
  regulatoryBody: varchar("regulatory_body", { length: 100 }), // SEBI, FCA, MAS, FSA, SFC, etc.
  regulatoryNotes: text("regulatory_notes"),
  
  // Status & Rollout
  isEnabled: boolean("is_enabled").default(false),
  rolloutPhase: integer("rollout_phase").default(1), // 1, 2, 3 for phased rollout
  enabledEnvironments: text("enabled_environments").array().default(sql`ARRAY['development']`), // development, staging, production
  
  // Display Order
  displayOrder: integer("display_order").default(100),
  flagEmoji: varchar("flag_emoji", { length: 10 }),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  index("idx_markets_code").on(table.marketCode),
  index("idx_markets_enabled").on(table.isEnabled),
  index("idx_markets_phase").on(table.rolloutPhase),
]);

export const insertMarketsMasterSchema = createInsertSchema(marketsMaster).omit({ id: true, createdAt: true, updatedAt: true });
export type MarketMaster = typeof marketsMaster.$inferSelect;
export type InsertMarketMaster = z.infer<typeof insertMarketsMasterSchema>;

// Market Product Matrix - Define product availability per market
export const marketProductMatrix = pgTable("market_product_matrix", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Foreign Keys
  marketCode: varchar("market_code", { length: 10 }).notNull().references(() => marketsMaster.marketCode),
  
  // Product Configuration
  productCategory: varchar("product_category", { length: 50 }).notNull(), // equity, etf, mutual_fund, bond, reit, sukuk_etf
  productSubCategory: varchar("product_sub_category", { length: 50 }), // large_cap, mid_cap, government, corporate, etc.
  
  // Availability Rules
  isEnabled: boolean("is_enabled").default(false),
  advisoryLevel: varchar("advisory_level", { length: 20 }).notNull().default("ANALYTICS_ONLY"), // FULL, ANALYTICS_ONLY
  
  // Restrictions
  requiresAccreditedInvestor: boolean("requires_accredited_investor").default(false),
  minimumInvestment: numeric("minimum_investment", { precision: 18, scale: 2 }),
  minimumInvestmentCurrency: varchar("minimum_investment_currency", { length: 3 }),
  
  // Risk & Compliance
  riskCategory: varchar("risk_category", { length: 20 }), // low, moderate, high, very_high
  requiredClientSegments: text("required_client_segments").array(), // resident_indian, nri, hni, uhni, family_office
  excludedClientSegments: text("excluded_client_segments").array(),
  
  // Additional Rules
  etfOnlyRestriction: boolean("etf_only_restriction").default(false), // For EM markets
  complianceNotes: text("compliance_notes"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  index("idx_mpm_market").on(table.marketCode),
  index("idx_mpm_product").on(table.productCategory),
  index("idx_mpm_enabled").on(table.isEnabled),
]);

export const insertMarketProductMatrixSchema = createInsertSchema(marketProductMatrix).omit({ id: true, createdAt: true, updatedAt: true });
export type MarketProductMatrix = typeof marketProductMatrix.$inferSelect;
export type InsertMarketProductMatrix = z.infer<typeof insertMarketProductMatrixSchema>;

// Global Advisory Acknowledgments - Track user acceptance of disclaimers


// Feature Flags - Platform-wide feature configuration
export const platformFeatureFlags = pgTable("platform_feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Flag Identification
  flagKey: varchar("flag_key", { length: 100 }).notNull().unique(), // GLOBAL_ADVISORY_MODE, AI_RECOMMENDATIONS, etc.
  flagName: varchar("flag_name", { length: 200 }).notNull(),
  description: text("description"),
  
  // Flag Value
  isEnabled: boolean("is_enabled").default(false),
  defaultValue: jsonb("default_value"), // Can be boolean, string, number, or object
  
  // Environment Control
  enabledEnvironments: text("enabled_environments").array().default(sql`ARRAY['development']`),
  
  // Targeting Rules (optional)
  targetingRules: jsonb("targeting_rules"), // {userSegments: [], markets: [], percentRollout: 100}
  
  // Kill Switch
  isKillSwitch: boolean("is_kill_switch").default(false), // For emergency disabling
  killSwitchActivatedAt: timestamp("kill_switch_activated_at"),
  killSwitchReason: text("kill_switch_reason"),
  
  // Category
  category: varchar("category", { length: 50 }), // global_advisory, ai, compliance, experimental
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  index("idx_pff_key").on(table.flagKey),
  index("idx_pff_enabled").on(table.isEnabled),
  index("idx_pff_category").on(table.category),
]);

export const insertPlatformFeatureFlagSchema = createInsertSchema(platformFeatureFlags).omit({ id: true, createdAt: true, updatedAt: true });
export type PlatformFeatureFlag = typeof platformFeatureFlags.$inferSelect;
export type InsertPlatformFeatureFlag = z.infer<typeof insertPlatformFeatureFlagSchema>;

// User Market Preferences - Track user's selected market context
export const userMarketPreferences = pgTable("user_market_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  
  // Current Selection
  selectedMarket: varchar("selected_market", { length: 10 }).default("IN").references(() => marketsMaster.marketCode),
  displayCurrency: varchar("display_currency", { length: 3 }).default("INR"),
  
  // Preferences
  showGlobalMarkets: boolean("show_global_markets").default(false),
  preferredMarkets: text("preferred_markets").array(), // Quick access markets
  
  // Last Global Advisory Access
  lastGlobalAdvisoryAccess: timestamp("last_global_advisory_access"),
  globalAdvisorySessionCount: integer("global_advisory_session_count").default(0),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ump_user").on(table.userId),
  index("idx_ump_market").on(table.selectedMarket),
]);

export const insertUserMarketPreferencesSchema = createInsertSchema(userMarketPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type UserMarketPreferences = typeof userMarketPreferences.$inferSelect;
export type InsertUserMarketPreferences = z.infer<typeof insertUserMarketPreferencesSchema>;

// ============================================
// GLOBAL INVESTMENTS FEE MODEL SELECTION
// Client choice: Advisory + Platform OR Platform-Only
// ============================================

// Fee Mode Enum Values
export const globalInvestmentFeeModeValues = ['ADVISORY_PLATFORM', 'PLATFORM_ONLY'] as const;
export const GlobalInvestmentFeeModeEnum = z.enum(globalInvestmentFeeModeValues);
export type GlobalInvestmentFeeMode = z.infer<typeof GlobalInvestmentFeeModeEnum>;

// Client Fee Mode Selection Table
export const globalInvestmentClientFeeMode = pgTable("global_investment_client_fee_mode", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  clientId: varchar("client_id").references(() => users.id).notNull().unique(),
  
  // Fee Mode Selection
  feeMode: varchar("fee_mode", { length: 30 }).notNull(), // ADVISORY_PLATFORM, PLATFORM_ONLY
  
  // Consent Tracking
  feeModeSelectedAt: timestamp("fee_mode_selected_at").notNull(),
  feeModeConsentIp: varchar("fee_mode_consent_ip", { length: 45 }),
  
  // Acknowledgment Tracking
  disclaimerAcknowledged: boolean("disclaimer_acknowledged").default(false).notNull(),
  disclaimerAcknowledgedAt: timestamp("disclaimer_acknowledged_at"),
  
  // Last Update Info
  lastModifiedBy: varchar("last_modified_by", { length: 20 }), // CLIENT, ADMIN
  lastModifiedById: varchar("last_modified_by_id"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gicfm_client").on(table.clientId),
  index("idx_gicfm_mode").on(table.feeMode),
]);

export const insertGlobalInvestmentClientFeeModeSchema = createInsertSchema(globalInvestmentClientFeeMode).omit({ id: true, createdAt: true, updatedAt: true });
export type GlobalInvestmentClientFeeMode = typeof globalInvestmentClientFeeMode.$inferSelect;
export type InsertGlobalInvestmentClientFeeMode = z.infer<typeof insertGlobalInvestmentClientFeeModeSchema>;

// Fee Mode Audit Log Table (Immutable for SEBI compliance)
export const feeModeAuditLog = pgTable("fee_mode_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  clientId: varchar("client_id").references(() => users.id).notNull(),
  
  // Change Details
  oldMode: varchar("old_mode", { length: 30 }), // null for first selection
  newMode: varchar("new_mode", { length: 30 }).notNull(),
  
  // Actor Info
  changedBy: varchar("changed_by", { length: 20 }).notNull(), // CLIENT, ADMIN
  changedById: varchar("changed_by_id"), // User ID of the actor
  
  // Request Context
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Reason (required for admin overrides)
  changeReason: text("change_reason"),
  
  // Compliance
  consentCaptured: boolean("consent_captured").default(false).notNull(),
  disclaimerShown: boolean("disclaimer_shown").default(false).notNull(),
  
  // Immutability
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  checksumHash: varchar("checksum_hash", { length: 64 }), // SHA-256 for verification
}, (table) => [
  index("idx_fmal_client").on(table.clientId),
  index("idx_fmal_timestamp").on(table.timestamp),
  index("idx_fmal_changed_by").on(table.changedBy),
]);

export const insertFeeModeAuditLogSchema = createInsertSchema(feeModeAuditLog).omit({ id: true, timestamp: true });
export type FeeModeAuditLog = typeof feeModeAuditLog.$inferSelect;
export type InsertFeeModeAuditLog = z.infer<typeof insertFeeModeAuditLogSchema>;

// Admin Policy Settings for Global Investments
export const globalInvestmentAdminSettings = pgTable("global_investment_admin_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Policy Controls
  enablePlatformOnlyMode: boolean("enable_platform_only_mode").default(true).notNull(),
  allowClientSelfSelection: boolean("allow_client_self_selection").default(true).notNull(),
  defaultFeeMode: varchar("default_fee_mode", { length: 30 }).default("ADVISORY_PLATFORM"),
  
  // Fee Configuration (in basis points for precision)
  advisoryFeeBps: integer("advisory_fee_bps").default(25), // 0.25% = 25 bps
  platformFeeBps: integer("platform_fee_bps").default(10), // 0.10% = 10 bps
  
  // Fee Caps
  advisoryFeeCapInr: decimal("advisory_fee_cap_inr", { precision: 15, scale: 2 }),
  platformFeeCapInr: decimal("platform_fee_cap_inr", { precision: 15, scale: 2 }),
  
  // Segment Overrides (JSON array of segment rules)
  segmentOverrides: jsonb("segment_overrides").default([]), // [{segment: "HNI", forceMode: "ADVISORY_PLATFORM"}]
  
  // Policy Versioning (for client reconfirmation triggers)
  policyVersion: integer("policy_version").default(1).notNull(),
  policyUpdatedAt: timestamp("policy_updated_at").defaultNow(),
  policyUpdatedBy: varchar("policy_updated_by"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGlobalInvestmentAdminSettingsSchema = createInsertSchema(globalInvestmentAdminSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type GlobalInvestmentAdminSettings = typeof globalInvestmentAdminSettings.$inferSelect;
export type InsertGlobalInvestmentAdminSettings = z.infer<typeof insertGlobalInvestmentAdminSettingsSchema>;

// Order Fee Consent Log (for order-level fee acknowledgment)

// ==================== IMPROVEMENT FEATURES ====================

// Dashboard Widget Preferences
export const dashboardWidgetPreferences = pgTable("dashboard_widget_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Widget Configuration
  widgets: jsonb("widgets").default([
    { id: "portfolio", enabled: true, position: 0, size: "large" },
    { id: "market_movers", enabled: true, position: 1, size: "medium" },
    { id: "quick_actions", enabled: true, position: 2, size: "small" },
    { id: "kyc_progress", enabled: true, position: 3, size: "small" },
    { id: "market_news", enabled: true, position: 4, size: "medium" },
    { id: "trending", enabled: false, position: 5, size: "medium" },
    { id: "goals_progress", enabled: false, position: 6, size: "medium" }
  ]).notNull(),
  
  // Layout Preferences
  layoutMode: varchar("layout_mode", { length: 20 }).default("grid"), // grid, list, compact
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_dwp_user").on(table.userId),
]);

export const insertDashboardWidgetPreferencesSchema = createInsertSchema(dashboardWidgetPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type DashboardWidgetPreferences = typeof dashboardWidgetPreferences.$inferSelect;



// Scheduled Reports
export const scheduledReports = pgTable("scheduled_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Report Configuration
  reportType: varchar("report_type", { length: 50 }).notNull(), // portfolio_summary, tax_summary, transaction_history, goal_progress
  reportName: varchar("report_name", { length: 100 }).notNull(),
  
  // Schedule
  frequency: varchar("frequency", { length: 20 }).notNull(), // daily, weekly, monthly, quarterly
  dayOfWeek: integer("day_of_week"), // 0-6 for weekly
  dayOfMonth: integer("day_of_month"), // 1-31 for monthly
  
  // Delivery
  deliveryEmail: varchar("delivery_email", { length: 255 }).notNull(),
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  lastSentAt: timestamp("last_sent_at"),
  nextScheduledAt: timestamp("next_scheduled_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sr_user").on(table.userId),
  index("idx_sr_next").on(table.nextScheduledAt),
]);

export const insertScheduledReportSchema = createInsertSchema(scheduledReports).omit({ id: true, createdAt: true, updatedAt: true });
export type ScheduledReport = typeof scheduledReports.$inferSelect;

// Compound Alerts (Multi-Condition)
export const compoundAlerts = pgTable("compound_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  
  // Alert Configuration
  name: varchar("name", { length: 100 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  
  // Conditions (AND logic)
  conditions: jsonb("conditions").default([]).notNull(), // [{type: "price_drop", value: 5, unit: "percent"}, {type: "volume_spike", value: 200}]
  
  // Logic
  conditionLogic: varchar("condition_logic", { length: 10 }).default("AND"), // AND, OR
  
  // Notification
  notifyEmail: boolean("notify_email").default(true),
  notifySms: boolean("notify_sms").default(false),
  notifyPush: boolean("notify_push").default(true),
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  triggeredCount: integer("triggered_count").default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ca_user").on(table.userId),
  index("idx_ca_symbol").on(table.symbol),
]);

export const insertCompoundAlertSchema = createInsertSchema(compoundAlerts).omit({ id: true, createdAt: true });
export type CompoundAlert = typeof compoundAlerts.$inferSelect;

// Trending Investments Cache
export const trendingInvestments = pgTable("trending_investments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Investment Info
  assetType: varchar("asset_type", { length: 30 }).notNull(), // stock, mutual_fund, bond, etf
  symbol: varchar("symbol", { length: 30 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  
  // Trending Metrics
  trendScore: decimal("trend_score", { precision: 10, scale: 2 }).notNull(),
  viewCount: integer("view_count").default(0),
  investorCount: integer("investor_count").default(0),
  volumeChange: decimal("volume_change", { precision: 10, scale: 2 }),
  
  // Category
  category: varchar("category", { length: 50 }), // top_gainers, most_traded, newly_popular
  
  // Validity
  validFrom: timestamp("valid_from").defaultNow().notNull(),
  validUntil: timestamp("valid_until").notNull(),
  
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ti_type").on(table.assetType),
  index("idx_ti_category").on(table.category),
  index("idx_ti_valid").on(table.validUntil),
]);

export const insertTrendingInvestmentSchema = createInsertSchema(trendingInvestments).omit({ id: true, updatedAt: true });
export type TrendingInvestment = typeof trendingInvestments.$inferSelect;

// Theme Preferences (for auto dark mode)
export const themePreferences = pgTable("theme_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  
  // Theme Settings
  themeMode: varchar("theme_mode", { length: 20 }).default("system"), // light, dark, system, auto
  autoSwitchEnabled: boolean("auto_switch_enabled").default(false),
  lightModeStart: varchar("light_mode_start", { length: 5 }).default("07:00"), // HH:MM
  darkModeStart: varchar("dark_mode_start", { length: 5 }).default("19:00"),
  
  // Accessibility
  reducedMotion: boolean("reduced_motion").default(false),
  highContrast: boolean("high_contrast").default(false),
  
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tp_user").on(table.userId),
]);

export const insertThemePreferencesSchema = createInsertSchema(themePreferences).omit({ id: true, updatedAt: true });
export type ThemePreferences = typeof themePreferences.$inferSelect;

// ==========================================
// AGENT KNOWLEDGE HUB MODULE
// ==========================================

// Daily AI Market Briefs
export const marketBriefs = pgTable("market_briefs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Brief Content
  date: date("date").notNull(),
  region: varchar("region", { length: 20 }).default("india").notNull(), // india, global
  
  // AI-Generated Sections (SEBI-safe, no predictions)
  marketSnapshot: text("market_snapshot").notNull(),
  whatChanged: text("what_changed").notNull(),
  keyRisks: text("key_risks"),
  opportunityAreas: text("opportunity_areas"),
  portfolioImpact: text("portfolio_impact"),
  complianceNote: text("compliance_note"),
  
  // Raw Data Sources
  dataSourcesUsed: jsonb("data_sources_used").default([]), // [{source: "NSE", timestamp: "..."}]
  
  // Approval Workflow
  status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, pending_review, approved, published, rejected
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  publishedAt: timestamp("published_at"),
  rejectionReason: text("rejection_reason"),
  
  // Versioning
  version: integer("version").default(1).notNull(),
  previousVersionId: varchar("previous_version_id"),
  
  // Disclaimer
  disclaimerVersionId: varchar("disclaimer_version_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mb_date").on(table.date),
  index("idx_mb_region").on(table.region),
  index("idx_mb_status").on(table.status),
]);

export const insertMarketBriefSchema = createInsertSchema(marketBriefs).omit({ id: true, createdAt: true, updatedAt: true });
export type MarketBrief = typeof marketBriefs.$inferSelect;

// Product Knowledge Cards
export const productKnowledge = pgTable("product_knowledge", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Product Identification
  productType: varchar("product_type", { length: 50 }).notNull(), // mutual_fund, stock, bond, etf, aif, pms, ncd, global_etf
  productCategory: varchar("product_category", { length: 50 }), // equity, debt, hybrid, commodity, etc.
  productSubCategory: varchar("product_sub_category", { length: 50 }),
  
  // Content
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  keyFeatures: jsonb("key_features").default([]), // [{feature: "...", explanation: "..."}]
  
  // Risk & Suitability
  riskProfile: varchar("risk_profile", { length: 20 }).notNull(), // low, moderate, high, very_high
  timeHorizon: varchar("time_horizon", { length: 30 }), // short_term, medium_term, long_term
  suitabilityRules: jsonb("suitability_rules").default([]), // [{rule: "...", applicableTo: "..."}]
  
  // When NOT to recommend (critical for compliance)
  contraindications: jsonb("contraindications").default([]), // [{scenario: "...", reason: "..."}]
  
  // Compliance
  complianceTags: jsonb("compliance_tags").default([]), // ["SEBI_REGISTERED", "HIGH_RISK_DISCLOSURE", etc.]
  regulatoryNotes: text("regulatory_notes"),
  
  // Certification Level (optional, informational only)
  suggestedCertLevel: varchar("suggested_cert_level", { length: 5 }), // L0, L1, L2, L3
  
  // Workflow
  status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, pending_review, published, archived
  createdBy: varchar("created_by").references(() => users.id),
  lastEditedBy: varchar("last_edited_by").references(() => users.id),
  publishedBy: varchar("published_by").references(() => users.id),
  publishedAt: timestamp("published_at"),
  
  // Versioning
  version: integer("version").default(1).notNull(),
  editHistory: jsonb("edit_history").default([]), // [{userId, timestamp, changes}]
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pk_type").on(table.productType),
  index("idx_pk_category").on(table.productCategory),
  index("idx_pk_risk").on(table.riskProfile),
  index("idx_pk_status").on(table.status),
]);

export const insertProductKnowledgeSchema = createInsertSchema(productKnowledge).omit({ id: true, createdAt: true, updatedAt: true });
export type ProductKnowledge = typeof productKnowledge.$inferSelect;
// Certification Quizzes (Moved to shared/schema/agents.ts)


// quizAttempts moved to shared/schema/agents.ts

// Client Explanation Templates
export const explanationTemplates = pgTable("explanation_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Template Info
  category: varchar("category", { length: 50 }).notNull(), // market_movement, product_explanation, risk_disclosure, suitability_rationale, alternatives_rejected
  title: varchar("title", { length: 255 }).notNull(),
  
  // Template Structure (SEBI-compliant)
  whatIsHappening: text("what_is_happening").notNull(),
  whyItMatters: text("why_it_matters").notNull(),
  clientImpact: text("client_impact"),
  risks: text("risks"),
  whatIsNotClaimed: text("what_is_not_claimed"), // Critical disclaimer section
  
  // Versions
  technicalVersion: text("technical_version"),
  simpleVersion: text("simple_version"),
  
  // Applicability
  applicableProducts: jsonb("applicable_products").default([]), // ["mutual_fund", "stock"]
  applicableScenarios: jsonb("applicable_scenarios").default([]), // ["market_crash", "bull_run"]
  
  // Status
  status: varchar("status", { length: 20 }).default("active").notNull(),
  
  createdBy: varchar("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_et_category").on(table.category),
  index("idx_et_status").on(table.status),
]);

export const insertExplanationTemplateSchema = createInsertSchema(explanationTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type ExplanationTemplate = typeof explanationTemplates.$inferSelect;

// Knowledge Hub Audit Logs (Immutable, SEBI-Compliant)
export const knowledgeAuditLogs = pgTable("knowledge_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Actor
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  userRole: varchar("user_role", { length: 30 }).notNull(),
  
  // Event Type
  eventType: varchar("event_type", { length: 50 }).notNull(), // brief_viewed, knowledge_accessed, explanation_shared, certification_updated, disclaimer_acknowledged
  
  // Context
  resourceType: varchar("resource_type", { length: 50 }), // market_brief, product_knowledge, explanation_template
  resourceId: varchar("resource_id"),
  
  // Client Context (if applicable)
  clientId: varchar("client_id").references(() => users.id),
  clientName: varchar("client_name", { length: 255 }),
  
  // Content Snapshot (for audit trail)
  contentId: varchar("content_id"),
  contentVersion: integer("content_version"),
  disclaimerVersionHash: varchar("disclaimer_version_hash", { length: 64 }),
  
  // Action Details
  actionDetails: jsonb("action_details").default({}), // Additional context
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  // Immutability
  recordHash: varchar("record_hash", { length: 64 }), // SHA-256 of record for integrity
  previousRecordHash: varchar("previous_record_hash", { length: 64 }), // Chain verification
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_kal_user").on(table.userId),
  index("idx_kal_event").on(table.eventType),
  index("idx_kal_resource").on(table.resourceType, table.resourceId),
  index("idx_kal_client").on(table.clientId),
  index("idx_kal_date").on(table.createdAt),
]);

export const insertKnowledgeAuditLogSchema = createInsertSchema(knowledgeAuditLogs).omit({ id: true, createdAt: true });
export type KnowledgeAuditLog = typeof knowledgeAuditLogs.$inferSelect;

// Knowledge Disclaimers (Versioned)
export const knowledgeDisclaimers = pgTable("knowledge_disclaimers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Disclaimer Info
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(), // general, market_brief, product, recommendation
  
  // Content
  content: text("content").notNull(),
  shortContent: text("short_content"), // For inline display
  
  // Versioning
  version: integer("version").default(1).notNull(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(), // SHA-256 for verification
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  effectiveFrom: timestamp("effective_from").defaultNow().notNull(),
  effectiveUntil: timestamp("effective_until"),
  
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_kd_category").on(table.category),
  index("idx_kd_active").on(table.isActive),
  index("idx_kd_effective").on(table.effectiveFrom),
]);

export const insertKnowledgeDisclaimerSchema = createInsertSchema(knowledgeDisclaimers).omit({ id: true, createdAt: true });
export type KnowledgeDisclaimer = typeof knowledgeDisclaimers.$inferSelect;

// Asset Class Insights (Curated by Admin)
export const assetClassInsights = pgTable("asset_class_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Asset Class
  assetClass: varchar("asset_class", { length: 50 }).notNull(), // mutual_funds, stocks, bonds, ncds, global_etfs, aif_pms
  
  // Content
  title: varchar("title", { length: 255 }).notNull(),
  summary: text("summary").notNull(),
  detailedContent: text("detailed_content"),
  
  // Key Metrics (Real-time or cached)
  keyMetrics: jsonb("key_metrics").default({}), // {avgReturn: 12.5, volatility: "medium", ...}
  
  // Trends
  currentTrends: jsonb("current_trends").default([]), // [{trend: "...", impact: "positive/negative"}]
  
  // Related Products
  featuredProducts: jsonb("featured_products").default([]), // [{productId, productName, reason}]
  
  // Status
  status: varchar("status", { length: 20 }).default("draft").notNull(),
  publishedAt: timestamp("published_at"),
  
  // Ordering
  displayOrder: integer("display_order").default(0),
  
  createdBy: varchar("created_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_aci_class").on(table.assetClass),
  index("idx_aci_status").on(table.status),
  index("idx_aci_order").on(table.displayOrder),
]);

export const insertAssetClassInsightSchema = createInsertSchema(assetClassInsights).omit({ id: true, createdAt: true, updatedAt: true });
export type AssetClassInsight = typeof assetClassInsights.$inferSelect;

// Knowledge Hub Feature Flags
export const knowledgeHubConfig = pgTable("knowledge_hub_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Feature Flags
  isEnabled: boolean("is_enabled").default(true).notNull(),
  enabledForRoles: jsonb("enabled_for_roles").default(["agent", "partner"]),
  
  // Market Brief Settings
  marketBriefEnabled: boolean("market_brief_enabled").default(true),
  marketBriefAutoPublish: boolean("market_brief_auto_publish").default(false),
  marketBriefGenerationTime: varchar("market_brief_generation_time", { length: 5 }).default("06:00"), // IST
  
  // Certification Settings (Non-restrictive)
  certificationEnabled: boolean("certification_enabled").default(true),
  certificationRequired: boolean("certification_required").default(false), // Always false per user request
  
  // Sharing Settings
  sharingEnabled: boolean("sharing_enabled").default(true),
  shareRateLimit: integer("share_rate_limit").default(50), // Per hour
  
  // AI Settings
  aiExplanationEnabled: boolean("ai_explanation_enabled").default(true),
  aiGenerationRateLimit: integer("ai_generation_rate_limit").default(100), // Per day per agent
  
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => []);

export const insertKnowledgeHubConfigSchema = createInsertSchema(knowledgeHubConfig).omit({ id: true, updatedAt: true });
export type KnowledgeHubConfig = typeof knowledgeHubConfig.$inferSelect;

// ===================================================================
// DATA CACHING SYSTEM - Operational Cost Optimization
// ===================================================================

// Company Master Cache - Permanent storage for static company identifiers
// TTL: Indefinite (CIN, PAN, GSTIN rarely change)
export const companyMasterCache = pgTable("company_master_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Primary Identifiers (never expire)
  cin: varchar("cin", { length: 21 }).unique(), // Corporate Identity Number
  pan: varchar("pan", { length: 10 }), // Permanent Account Number
  gstin: varchar("gstin", { length: 15 }), // GST Number
  tan: varchar("tan", { length: 10 }), // Tax Deduction Number
  
  // Company Details
  companyName: varchar("company_name", { length: 500 }).notNull(),
  companyStatus: varchar("company_status", { length: 50 }),
  companyClass: varchar("company_class", { length: 100 }),
  companyCategory: varchar("company_category", { length: 100 }),
  companySubCategory: varchar("company_sub_category", { length: 100 }),
  
  // Registration Info
  dateOfIncorporation: date("date_of_incorporation"),
  registrationNumber: varchar("registration_number", { length: 50 }),
  rocState: varchar("roc_state", { length: 50 }),
  registeredAddress: text("registered_address"),
  
  // Capital Structure
  authorizedCapital: numeric("authorized_capital"),
  paidUpCapital: numeric("paid_up_capital"),
  
  // Directors (stored as JSON, refreshed quarterly)
  directors: jsonb("directors").default([]),
  
  // Source & Audit
  dataSource: varchar("data_source", { length: 50 }).notNull(), // probe42, sandbox, mca
  sourceReferenceId: varchar("source_reference_id", { length: 100 }),
  
  // Timestamps
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  lastVerifiedAt: timestamp("last_verified_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_cmc_cin").on(table.cin),
  index("idx_cmc_pan").on(table.pan),
  index("idx_cmc_gstin").on(table.gstin),
  index("idx_cmc_name").on(table.companyName),
]);

export const insertCompanyMasterCacheSchema = createInsertSchema(companyMasterCache).omit({ id: true, createdAt: true });
export type CompanyMasterCache = typeof companyMasterCache.$inferSelect;
export type InsertCompanyMasterCache = typeof companyMasterCache.$inferInsert;

// Verification Cache - 24-month TTL for KYC verification results
// Covers: PAN, Aadhaar, GSTIN, Bank Account verifications


// Company Financials Cache - 120-day TTL for quarterly financial data
export const companyFinancialsCache = pgTable("company_financials_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Company Reference
  companyId: varchar("company_id").references(() => companyMasterCache.id),
  cin: varchar("cin", { length: 21 }).notNull(),
  
  // Financial Period
  financialYear: varchar("financial_year", { length: 10 }).notNull(), // e.g., 2024-25
  quarter: varchar("quarter", { length: 5 }), // Q1, Q2, Q3, Q4, or null for annual
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  
  // Income Statement (in lakhs)
  revenue: numeric("revenue"),
  ebitda: numeric("ebitda"),
  ebit: numeric("ebit"),
  pbt: numeric("pbt"),
  pat: numeric("pat"),
  netProfit: numeric("net_profit"),
  
  // Balance Sheet
  totalAssets: numeric("total_assets"),
  totalLiabilities: numeric("total_liabilities"),
  networth: numeric("networth"),
  shareCapital: numeric("share_capital"),
  reserves: numeric("reserves"),
  
  // Debt
  totalDebt: numeric("total_debt"),
  longTermDebt: numeric("long_term_debt"),
  shortTermDebt: numeric("short_term_debt"),
  
  // Cash Flow
  operatingCashFlow: numeric("operating_cash_flow"),
  investingCashFlow: numeric("investing_cash_flow"),
  financingCashFlow: numeric("financing_cash_flow"),
  freeCashFlow: numeric("free_cash_flow"),
  
  // Ratios
  ratios: jsonb("ratios").default({}), // PE, PB, ROE, ROCE, etc.
  
  // Source & Audit
  dataSource: varchar("data_source", { length: 50 }).notNull(),
  
  // TTL: 120 days (quarterly refresh cycle)
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_cfc_cin").on(table.cin),
  index("idx_cfc_fy_q").on(table.financialYear, table.quarter),
  index("idx_cfc_expires").on(table.expiresAt),
]);

export const insertCompanyFinancialsCacheSchema = createInsertSchema(companyFinancialsCache).omit({ id: true, createdAt: true });
export type CompanyFinancialsCache = typeof companyFinancialsCache.$inferSelect;
export type InsertCompanyFinancialsCache = typeof companyFinancialsCache.$inferInsert;

// Market Data Cache - Tiered TTLs (15s quotes, 5m indices, 24h NAVs)


// API Usage Tracking - For cost monitoring and optimization
export const apiUsageTracking = pgTable("api_usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // API Details
  provider: varchar("provider", { length: 50 }).notNull(), // probe42, sandbox, cashfree, finnhub
  endpoint: varchar("endpoint", { length: 200 }).notNull(),
  method: varchar("method", { length: 10 }).default("GET"),
  
  // Request Info
  requestParams: jsonb("request_params").default({}),
  
  // Cache Performance
  cacheHit: boolean("cache_hit").default(false),
  cacheKey: varchar("cache_key", { length: 200 }),
  
  // Cost Tracking
  estimatedCostInr: numeric("estimated_cost_inr"), // Estimated cost per call
  
  // Response
  responseStatus: integer("response_status"),
  responseTimeMs: integer("response_time_ms"),
  
  // Context
  requestedBy: varchar("requested_by").references(() => users.id),
  requestContext: varchar("request_context", { length: 100 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_aut_provider").on(table.provider),
  index("idx_aut_date").on(table.createdAt),
  index("idx_aut_cache").on(table.cacheHit),
]);

export const insertApiUsageTrackingSchema = createInsertSchema(apiUsageTracking).omit({ id: true, createdAt: true });
export type ApiUsageTracking = typeof apiUsageTracking.$inferSelect;
export type InsertApiUsageTracking = typeof apiUsageTracking.$inferInsert;

// Cache Refresh Schedule - For managing scheduled data refresh jobs
export const cacheRefreshSchedule = pgTable("cache_refresh_schedule", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Schedule Type
  cacheType: varchar("cache_type", { length: 50 }).notNull(), // company_master, verification, financials, market_data
  refreshFrequency: varchar("refresh_frequency", { length: 30 }).notNull(), // realtime, hourly, daily, weekly, quarterly, annual
  
  // Cron Expression (for scheduled jobs)
  cronExpression: varchar("cron_expression", { length: 50 }),
  
  // Last Run
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: varchar("last_run_status", { length: 20 }), // success, failed, partial
  lastRunRecordsProcessed: integer("last_run_records_processed"),
  lastRunErrors: jsonb("last_run_errors").default([]),
  
  // Next Run
  nextRunAt: timestamp("next_run_at"),
  
  // Configuration
  isEnabled: boolean("is_enabled").default(true),
  priority: integer("priority").default(5), // 1=highest, 10=lowest
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_crs_type").on(table.cacheType),
  index("idx_crs_next").on(table.nextRunAt),
]);

export const insertCacheRefreshScheduleSchema = createInsertSchema(cacheRefreshSchedule).omit({ id: true, createdAt: true, updatedAt: true });
export type CacheRefreshSchedule = typeof cacheRefreshSchedule.$inferSelect;
export type InsertCacheRefreshSchedule = typeof cacheRefreshSchedule.$inferInsert;

// ===================================================================
// NSE/BSE FILINGS INGESTION SYSTEM
// ===================================================================

// Exchange Filing Sources - Registry of NSE/BSE data sources
export const exchangeFilingSources = pgTable("exchange_filing_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull().unique(), // NSE | BSE
  sourceName: varchar("source_name").notNull(),
  baseUrl: varchar("base_url").notNull(),
  apiEndpoint: varchar("api_endpoint"),
  supportedDocumentTypes: jsonb("supported_document_types").default(['PDF', 'XBRL', 'XLS']),
  active: boolean("active").default(true),
  rateLimitPerMinute: integer("rate_limit_per_minute").default(60),
  lastFetchAt: timestamp("last_fetch_at"),
  fetchSuccessCount: integer("fetch_success_count").default(0),
  fetchFailureCount: integer("fetch_failure_count").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertExchangeFilingSourceSchema = createInsertSchema(exchangeFilingSources).omit({ id: true, createdAt: true, updatedAt: true });
export type ExchangeFilingSource = typeof exchangeFilingSources.$inferSelect;
export type InsertExchangeFilingSource = typeof exchangeFilingSources.$inferInsert;

// Exchange Filings - Filing metadata from NSE/BSE
export const exchangeFilings = pgTable("exchange_filings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fintekproCompanyId: varchar("fintekpro_company_id").references(() => unlistedCompanies.id),
  exchange: varchar("exchange").notNull(), // NSE | BSE
  symbol: varchar("symbol"),
  companyName: varchar("company_name").notNull(),
  filingType: varchar("filing_type").notNull(), // QUARTERLY | ANNUAL | HALF_YEARLY
  financialType: varchar("financial_type").default("STANDALONE"), // STANDALONE | CONSOLIDATED
  documentUrl: varchar("document_url").notNull(),
  documentHash: varchar("document_hash"),
  
  // Document source (uploaded vs generated)
  documentSource: varchar("document_source").default("generated"), // generated, uploaded
  originalFileFormat: varchar("original_file_format"), // pdf, docx
  uploadedByUserId: varchar("uploaded_by_user_id"),
  uploadedAt: timestamp("uploaded_at"), // SHA256 for dedup
  filingDate: date("filing_date").notNull(),
  periodStart: date("period_start"),
  periodEnd: date("period_end"),
  financialYear: varchar("financial_year"),
  quarter: varchar("quarter"), // Q1 | Q2 | Q3 | Q4
  documentType: varchar("document_type"), // XBRL | PDF | XLS | SCANNED_PDF
  fileSizeBytes: integer("file_size_bytes"),
  isProcessed: boolean("is_processed").default(false),
  processingStatus: varchar("processing_status").default("pending"), // pending | processing | completed | failed | needs_review
  processingError: text("processing_error"),
  extractionConfidence: numeric("extraction_confidence"),
  ingestedAt: timestamp("ingested_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ef_company").on(table.fintekproCompanyId),
  index("idx_ef_exchange").on(table.exchange),
  index("idx_ef_hash").on(table.documentHash),
  index("idx_ef_date").on(table.filingDate),
  index("idx_ef_status").on(table.processingStatus),
]);

export const insertExchangeFilingSchema = createInsertSchema(exchangeFilings).omit({ id: true, createdAt: true, updatedAt: true, ingestedAt: true });
export type ExchangeFiling = typeof exchangeFilings.$inferSelect;
export type InsertExchangeFiling = typeof exchangeFilings.$inferInsert;

// Exchange Financial Audit Log - SEBI-compliant provenance tracking
export const exchangeFinancialAuditLog = pgTable("exchange_financial_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => unlistedCompanies.id),
  filingId: varchar("filing_id").references(() => exchangeFilings.id),
  exchange: varchar("exchange").notNull(), // NSE | BSE
  metric: varchar("metric").notNull(), // revenue | ebitda | pat | eps | total_assets | etc.
  metricValue: numeric("metric_value"),
  metricValueText: text("metric_value_text"),
  previousValue: numeric("previous_value"),
  financialYear: varchar("financial_year").notNull(),
  period: varchar("period"), // Q1 | Q2 | Q3 | Q4 | ANNUAL
  periodEnd: date("period_end"),
  currency: varchar("currency").default("INR"),
  documentUrl: varchar("document_url"),
  documentHash: varchar("document_hash"),
  
  // Document source (uploaded vs generated)
  documentSource: varchar("document_source").default("generated"), // generated, uploaded
  originalFileFormat: varchar("original_file_format"), // pdf, docx
  uploadedByUserId: varchar("uploaded_by_user_id"),
  uploadedAt: timestamp("uploaded_at"),
  extractionMethod: varchar("extraction_method").notNull(), // XBRL | EXCEL | PDF_TABLE | OCR
  extractionConfidence: numeric("extraction_confidence"),
  extractedBy: varchar("extracted_by").notNull(), // AUTO | ADMIN
  extractionSource: varchar("extraction_source"), // raw cell reference or XBRL tag
  isManualOverride: boolean("is_manual_override").default(false),
  overrideReason: text("override_reason"),
  overrideBy: varchar("override_by"),
  overrideAt: timestamp("override_at"),
  isApproved: boolean("is_approved").default(false),
  approvedBy: varchar("approved_by"),
  approvedAt: timestamp("approved_at"),
  hashPrevious: varchar("hash_previous"),
  hashCurrent: varchar("hash_current"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_efa_company").on(table.companyId),
  index("idx_efa_filing").on(table.filingId),
  index("idx_efa_metric").on(table.metric),
  index("idx_efa_fy").on(table.financialYear),
  index("idx_efa_exchange").on(table.exchange),
  index("idx_efa_created").on(table.createdAt),
]);

export const insertExchangeFinancialAuditLogSchema = createInsertSchema(exchangeFinancialAuditLog).omit({ id: true, createdAt: true });
export type ExchangeFinancialAuditLog = typeof exchangeFinancialAuditLog.$inferSelect;
export type InsertExchangeFinancialAuditLog = typeof exchangeFinancialAuditLog.$inferInsert;

// Agent Client Mapping Requests - Admin approval for agent-client assignments
export type AgentClientMappingRequest = typeof agentClientMappingRequests.$inferSelect;
export type InsertAgentClientMappingRequest = z.infer<typeof insertAgentClientMappingRequestSchema>;

// ============================================
// Global Investment Advisory & Rebalancing Tables
// ============================================

// Global Instruments Master - Stocks, ETFs, Bonds, Mutual Funds
export const globalInstruments = pgTable("global_instruments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  assetClass: varchar("asset_class", { length: 30 }).notNull(), // stock, etf, bond, mutual_fund
  exchange: varchar("exchange", { length: 20 }).notNull(), // NYSE, NASDAQ, LSE, TSE, XETRA, etc.
  market: varchar("market", { length: 10 }).notNull(), // US, UK, EU, JP, HK, SG, IN
  currency: varchar("currency", { length: 3 }).notNull(), // USD, EUR, GBP, JPY, etc.
  isin: varchar("isin", { length: 12 }),
  cusip: varchar("cusip", { length: 9 }),
  sedol: varchar("sedol", { length: 7 }),
  sector: varchar("sector", { length: 100 }),
  industry: varchar("industry", { length: 100 }),
  marketCap: numeric("market_cap"),
  marketCapCategory: varchar("market_cap_category", { length: 20 }), // mega, large, mid, small, micro
  dividendYield: numeric("dividend_yield"),
  expenseRatio: numeric("expense_ratio"), // For ETFs/MFs
  aum: numeric("aum"), // Assets Under Management for ETFs/MFs
  maturityDate: date("maturity_date"), // For bonds
  couponRate: numeric("coupon_rate"), // For bonds
  creditRating: varchar("credit_rating", { length: 10 }), // AAA, AA+, etc.
  yieldToMaturity: numeric("yield_to_maturity"), // For bonds
  domicile: varchar("domicile", { length: 50 }), // Country of domicile
  isActive: boolean("is_active").default(true),
  lrsEligible: boolean("lrs_eligible").default(true), // LRS eligibility for Indian investors
  fatcaCompliant: boolean("fatca_compliant").default(true),
  lastPrice: numeric("last_price"),
  lastPriceInr: numeric("last_price_inr"),
  priceChangePercent: numeric("price_change_percent"),
  week52High: numeric("week_52_high"),
  week52Low: numeric("week_52_low"),
  avgVolume: numeric("avg_volume"),
  beta: numeric("beta"),
  peRatio: numeric("pe_ratio"),
  pbRatio: numeric("pb_ratio"),
  epsGrowth: numeric("eps_growth"),
  returns1M: numeric("returns_1m"),
  returns3M: numeric("returns_3m"),
  returns1Y: numeric("returns_1y"),
  returns3Y: numeric("returns_3y"),
  returns5Y: numeric("returns_5y"),
  dataSource: varchar("data_source", { length: 50 }), // yahoo_finance, alpha_vantage, finnhub
  // Trading API Integration Fields
  apiSymbol: varchar("api_symbol", { length: 30 }), // Symbol used by trading API (may differ from display symbol)
  isTradeable: boolean("is_tradeable").default(false), // Whether live trading is enabled
  lotSize: integer("lot_size").default(1), // Minimum trading quantity
  tradingApiProvider: varchar("trading_api_provider", { length: 30 }), // alpaca, alpha_vantage, ibkr, futu, tiger
  bidPrice: numeric("bid_price"),
  askPrice: numeric("ask_price"),
  tradingHours: varchar("trading_hours", { length: 100 }), // e.g., "09:30-16:00 ET"
  apiConfig: jsonb("api_config").default({}), // Additional API-specific configuration
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gi_symbol").on(table.symbol),
  index("idx_gi_asset_class").on(table.assetClass),
  index("idx_gi_market").on(table.market),
  index("idx_gi_exchange").on(table.exchange),
  index("idx_gi_sector").on(table.sector),
  index("idx_gi_isin").on(table.isin),
]);

export const insertGlobalInstrumentSchema = createInsertSchema(globalInstruments).omit({ id: true, createdAt: true, lastUpdated: true });
export type GlobalInstrument = typeof globalInstruments.$inferSelect;
export type InsertGlobalInstrument = z.infer<typeof insertGlobalInstrumentSchema>;

// Global Portfolio Positions - User holdings in global instruments
export const globalPortfolioPositions = pgTable("global_portfolio_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  instrumentId: varchar("instrument_id").references(() => globalInstruments.id),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  assetClass: varchar("asset_class", { length: 30 }).notNull(),
  quantity: numeric("quantity").notNull(),
  avgCostBasis: numeric("avg_cost_basis").notNull(), // In native currency
  avgCostBasisInr: numeric("avg_cost_basis_inr").notNull(),
  currentValue: numeric("current_value"),
  currentValueInr: numeric("current_value_inr"),
  unrealizedGain: numeric("unrealized_gain"),
  unrealizedGainInr: numeric("unrealized_gain_inr"),
  unrealizedGainPercent: numeric("unrealized_gain_percent"),
  currency: varchar("currency", { length: 3 }).notNull(),
  market: varchar("market", { length: 10 }).notNull(),
  purchaseDate: date("purchase_date"),
  targetAllocation: numeric("target_allocation"), // Target % in portfolio
  actualAllocation: numeric("actual_allocation"), // Current % in portfolio
  driftPercent: numeric("drift_percent"), // Difference from target
  lrsRemittanceId: varchar("lrs_remittance_id"), // Link to LRS transaction
  brokerAccount: varchar("broker_account", { length: 100 }),
  brokerName: varchar("broker_name", { length: 100 }), // Interactive Brokers, Vested, etc.
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  lastRebalancedAt: timestamp("last_rebalanced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gpp_user").on(table.userId),
  index("idx_gpp_instrument").on(table.instrumentId),
  index("idx_gpp_asset_class").on(table.assetClass),
  index("idx_gpp_market").on(table.market),
]);

export const insertGlobalPortfolioPositionSchema = createInsertSchema(globalPortfolioPositions).omit({ id: true, createdAt: true, updatedAt: true });
export type GlobalPortfolioPosition = typeof globalPortfolioPositions.$inferSelect;
export type InsertGlobalPortfolioPosition = z.infer<typeof insertGlobalPortfolioPositionSchema>;

// Rebalancing Snapshots - Point-in-time portfolio analysis
export const rebalancingSnapshots = pgTable("rebalancing_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  snapshotType: varchar("snapshot_type", { length: 30 }).notNull(), // manual, scheduled, drift_triggered
  portfolioScope: varchar("portfolio_scope", { length: 30 }).notNull(), // global_only, india_only, unified
  totalValueInr: numeric("total_value_inr").notNull(),
  totalValueUsd: numeric("total_value_usd"),
  assetAllocation: jsonb("asset_allocation"), // { stocks: 60, bonds: 30, etfs: 10 }
  geographicAllocation: jsonb("geographic_allocation"), // { US: 40, EU: 20, IN: 40 }
  sectorAllocation: jsonb("sector_allocation"), // { tech: 30, finance: 20, ... }
  targetAllocation: jsonb("target_allocation"), // User's target allocation
  driftAnalysis: jsonb("drift_analysis"), // { maxDrift: 5.2, driftByAsset: {...} }
  riskMetrics: jsonb("risk_metrics"), // { portfolioBeta: 1.1, volatility: 12.5, sharpe: 1.2 }
  recommendationSummary: jsonb("recommendation_summary"), // { buyCount: 3, sellCount: 2, holdCount: 5 }
  totalBuyValueInr: numeric("total_buy_value_inr"),
  totalSellValueInr: numeric("total_sell_value_inr"),
  netFlowInr: numeric("net_flow_inr"),
  lrsUtilizedYtd: numeric("lrs_utilized_ytd"), // LRS amount used this FY
  lrsRemainingYtd: numeric("lrs_remaining_ytd"), // Remaining LRS limit
  rebalanceReason: text("rebalance_reason"),
  aiInsights: text("ai_insights"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, executed, partial, expired
  executedAt: timestamp("executed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_global_rebal_user").on(table.userId),
  index("idx_global_rebal_status").on(table.status),
  index("idx_global_rebal_created").on(table.createdAt),
]);

export const insertRebalancingSnapshotSchema = createInsertSchema(rebalancingSnapshots).omit({ id: true, createdAt: true });
export type RebalancingSnapshot = typeof rebalancingSnapshots.$inferSelect;
export type InsertRebalancingSnapshot = z.infer<typeof insertRebalancingSnapshotSchema>;

// Rebalancing Actions - Individual buy/hold/sell recommendations
export const rebalancingActions = pgTable("rebalancing_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").references(() => rebalancingSnapshots.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  instrumentId: varchar("instrument_id").references(() => globalInstruments.id),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  instrumentName: varchar("instrument_name", { length: 255 }),
  assetClass: varchar("asset_class", { length: 30 }).notNull(),
  market: varchar("market", { length: 10 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  action: varchar("action", { length: 10 }).notNull(), // buy, sell, hold
  priority: varchar("priority", { length: 10 }).default("normal"), // high, normal, low
  currentQuantity: numeric("current_quantity"),
  recommendedQuantity: numeric("recommended_quantity"),
  quantityChange: numeric("quantity_change"),
  currentPrice: numeric("current_price"),
  currentPriceInr: numeric("current_price_inr"),
  targetPrice: numeric("target_price"),
  stopLoss: numeric("stop_loss"),
  currentAllocation: numeric("current_allocation"),
  targetAllocation: numeric("target_allocation"),
  driftPercent: numeric("drift_percent"),
  tradeValueNative: numeric("trade_value_native"),
  tradeValueInr: numeric("trade_value_inr"),
  expectedReturn: numeric("expected_return"),
  riskScore: numeric("risk_score"),
  confidenceScore: numeric("confidence_score"),
  rationale: text("rationale"),
  keyFactors: jsonb("key_factors"), // ["Strong earnings", "Undervalued"]
  riskFactors: jsonb("risk_factors"), // ["Currency risk", "Political risk"]
  taxImplications: jsonb("tax_implications"), // { stcg: 15, ltcg: 10, dtaaRate: 15 }
  lrsImpact: numeric("lrs_impact"), // LRS utilization if executed
  complianceFlags: jsonb("compliance_flags"), // { lrsCheck: 'pass', fatcaCheck: 'pass' }
  status: varchar("status", { length: 20 }).default("pending"), // pending, executed, cancelled, expired
  executedAt: timestamp("executed_at"),
  executedPrice: numeric("executed_price"),
  executedQuantity: numeric("executed_quantity"),
  executionNotes: text("execution_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ra_snapshot").on(table.snapshotId),
  index("idx_ra_user").on(table.userId),
  index("idx_ra_action").on(table.action),
  index("idx_ra_status").on(table.status),
  index("idx_ra_symbol").on(table.symbol),
]);

export const insertRebalancingActionSchema = createInsertSchema(rebalancingActions).omit({ id: true, createdAt: true, updatedAt: true });
export type RebalancingAction = typeof rebalancingActions.$inferSelect;
export type InsertRebalancingAction = z.infer<typeof insertRebalancingActionSchema>;

// LRS Compliance Tracking - Track $250k annual limit for Indian investors


// Global Advisory Recommendations - AI-generated recommendations


// ============================================
// MCA INTELLIGENCE SERVICE TABLES
// ============================================

// MCA Company Master - Core company data from MCA

// MCA Financial Snapshot - Derived financial metrics from AOC-4/XBRL filings

// MCA Filing Tracker - Track all MCA filing downloads and wallet usage

// MCA Query Log - Audit trail for all MCA-related queries and actions

// MCA Wallet Status - Track MCA wallet balance and usage


// MCA Wallet Payments - Track Cashfree payment orders for wallet recharge
export type McaWalletPayment = typeof mcaWalletPayments.$inferSelect;
export type InsertMcaWalletPayment = z.infer<typeof insertMcaWalletPaymentSchema>;

// MCA Direct Payments - Track direct payments made to MCA portal (bypass intermediary gateways)
export type McaDirectPayment = typeof mcaDirectPayments.$inferSelect;
export type InsertMcaDirectPayment = z.infer<typeof insertMcaDirectPaymentSchema>;

// ============ MCA ENHANCED TABLES - PHASE 1-4 IMPLEMENTATION ============

// MCA Data Sources - Configurable data sources for ingestion (Epic 1)

export type McaDataSource = typeof mcaDataSources.$inferSelect;
export type InsertMcaDataSource = z.infer<typeof insertMcaDataSourcesSchema>;

// MCA Directors Registry - Director master data (Epic 3)
export type McaDirector = typeof mcaDirectors.$inferSelect;
export type InsertMcaDirector = z.infer<typeof insertMcaDirectorsSchema>;

// MCA Director-Company Mapping - Many-to-many relationship (Epic 3)

// MCA Charges & Borrowings - Leverage tracking (Epic 4)
export type McaCharge = typeof mcaCharges.$inferSelect;
export type InsertMcaCharge = z.infer<typeof insertMcaChargesSchema>;

// MCA Shareholding Pattern - Ownership structure (Epic 4)

// MCA Derived Financial Metrics - Computed ratios and trends (Epic 5)

// MCA Risk Scores - Composite risk assessment (Epic 5)
export type McaRiskScore = typeof mcaRiskScores.$inferSelect;
export type InsertMcaRiskScore = z.infer<typeof insertMcaRiskScoresSchema>;

// MCA Ingestion Logs - ETL pipeline tracking (Epic 9)
export type McaIngestionLog = typeof mcaIngestionLogs.$inferSelect;
export type InsertMcaIngestionLog = z.infer<typeof insertMcaIngestionLogsSchema>;

// MCA Version History - Track all data changes for audit (Epic 8)


// ============ SEBI COMPLIANCE PERSISTENCE TABLES ============

// External Remittance Proofs - AIF/PMS payment proof tracking for SEBI compliance
export const externalRemittanceProofs = pgTable("external_remittance_proofs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id", { length: 100 }).notNull(),
  productType: text("product_type").notNull(), // 'aif', 'pms'
  productId: varchar("product_id", { length: 100 }).notNull(),
  productName: text("product_name").notNull(),
  userId: varchar("user_id").references(() => users.id),
  remittanceType: text("remittance_type").notNull(), // 'aif_subscription', 'pms_subscription', 'capital_call', 'top_up'
  
  expectedAmount: numeric("expected_amount").notNull(),
  currency: varchar("currency", { length: 10 }).default("INR"),
  
  // Document evidence
  documentPath: text("document_path"),
  documentHash: varchar("document_hash", { length: 64 }), // SHA-256
  hashAlgorithm: varchar("hash_algorithm", { length: 20 }).default("sha256"),
  originalFileName: text("original_file_name"),
  fileSize: integer("file_size"),
  mimeType: varchar("mime_type", { length: 100 }),
  
  // Bank transfer details
  beneficiaryName: text("beneficiary_name"),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  ifscCode: varchar("ifsc_code", { length: 11 }),
  utrNumber: varchar("utr_number", { length: 50 }),
  transactionDate: date("transaction_date"),
  
  // Verification workflow
  status: text("status").default("pending_upload"), // 'pending_upload', 'uploaded', 'under_review', 'verified', 'rejected', 'expired'
  verifiedBy: varchar("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
  rejectionReason: text("rejection_reason"),
  reviewerNotes: text("reviewer_notes"),
  
  // Reference links
  capitalCallReference: varchar("capital_call_reference", { length: 100 }),
  subscriptionAgreementId: varchar("subscription_agreement_id", { length: 100 }),
  
  // Audit metadata
  uploadedAt: timestamp("uploaded_at"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  retentionExpiresAt: timestamp("retention_expires_at"), // SEBI 8-year retention
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at"), // Upload deadline
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_erp_order").on(table.orderId),
  index("idx_erp_status").on(table.status, table.submittedAt),
  index("idx_erp_user").on(table.userId),
  index("idx_erp_product").on(table.productType, table.productId),
]);

export const insertExternalRemittanceProofSchema = createInsertSchema(externalRemittanceProofs).omit({ id: true, createdAt: true, updatedAt: true });
export type ExternalRemittanceProof = typeof externalRemittanceProofs.$inferSelect;
export type InsertExternalRemittanceProof = z.infer<typeof insertExternalRemittanceProofSchema>;

// Daily Reconciliation Reports - SEBI IA Regulations compliance
export const dailyReconciliationReports = pgTable("daily_reconciliation_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportDate: date("report_date").notNull(),
  productScope: text("product_scope").default("all"), // 'all', 'mutual_fund', 'unlisted', 'aif_pms', 'bonds'
  
  // Summary metrics
  totalTransactions: integer("total_transactions").default(0),
  totalCredits: numeric("total_credits").default("0"),
  totalDebits: numeric("total_debits").default("0"),
  netMovement: numeric("net_movement").default("0"),
  discrepancyCount: integer("discrepancy_count").default(0),
  
  // Discrepancy details (JSON array)
  discrepancies: jsonb("discrepancies").default([]),
  
  // Report status
  status: text("status").default("generated"), // 'generated', 'reviewed', 'signed_off', 'escalated'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  signedOffBy: varchar("signed_off_by").references(() => users.id),
  signedOffAt: timestamp("signed_off_at"),
  signOffNotes: text("sign_off_notes"),
  
  // Artifact storage
  pdfReportPath: text("pdf_report_path"),
  csvExportPath: text("csv_export_path"),
  reportHash: varchar("report_hash", { length: 64 }), // SHA-256 of report content
  
  // Execution metadata
  executedBy: varchar("executed_by", { length: 100 }), // 'system_cron', user id
  executionDurationMs: integer("execution_duration_ms"),
  
  // Retention
  retentionExpiresAt: timestamp("retention_expires_at"), // 8 years from report date
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_drr_date").on(table.reportDate, table.productScope),
  index("idx_drr_status").on(table.status),
  uniqueIndex("idx_drr_date_scope_unique").on(table.reportDate, table.productScope),
]);

export const insertDailyReconciliationReportSchema = createInsertSchema(dailyReconciliationReports).omit({ id: true, createdAt: true, updatedAt: true });
export type DailyReconciliationReport = typeof dailyReconciliationReports.$inferSelect;
export type InsertDailyReconciliationReport = z.infer<typeof insertDailyReconciliationReportSchema>;

// MF Batch Validation Logs - ARN/EUIN credential verification audit trail
export type MfBatchValidationLog = typeof mfBatchValidationLogs.$inferSelect;
export type InsertMfBatchValidationLog = z.infer<typeof insertMfBatchValidationLogSchema>;

// ==================== ADDITIONAL FEMA COMPLIANCE TABLES ====================

export const a2Forms = pgTable("a2_forms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  formNumber: varchar("form_number", { length: 50 }).unique().notNull(),
  transactionId: varchar("transaction_id").references(() => lrsTransactions.id),
  
  applicantName: varchar("applicant_name", { length: 200 }).notNull(),
  applicantPan: varchar("applicant_pan", { length: 10 }).notNull(),
  applicantAddress: text("applicant_address"),
  applicantEmail: varchar("applicant_email", { length: 255 }),
  applicantPhone: varchar("applicant_phone", { length: 15 }),
  
  purposeCode: varchar("purpose_code", { length: 10 }).notNull(),
  purposeDescription: text("purpose_description"),
  amountInr: numeric("amount_inr").notNull(),
  amountFcy: numeric("amount_fcy").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  exchangeRate: numeric("exchange_rate").notNull(),
  
  beneficiaryName: varchar("beneficiary_name", { length: 200 }).notNull(),
  beneficiaryAddress: text("beneficiary_address"),
  beneficiaryCountry: varchar("beneficiary_country", { length: 3 }).notNull(),
  beneficiaryBankName: varchar("beneficiary_bank_name", { length: 200 }),
  beneficiaryBankAddress: text("beneficiary_bank_address"),
  beneficiaryAccountNumber: varchar("beneficiary_account_number", { length: 50 }),
  swiftCode: varchar("swift_code", { length: 11 }),
  iban: varchar("iban", { length: 34 }),
  
  adBankName: varchar("ad_bank_name", { length: 200 }),
  adBranchName: varchar("ad_branch_name", { length: 200 }),
  adCode: varchar("ad_code", { length: 20 }),
  adBranchAddress: text("ad_branch_address"),
  
  declarations: jsonb("declarations").default({}),
  
  status: varchar("status", { length: 30 }).default("draft").notNull(),
  acknowledgementNumber: varchar("acknowledgement_number", { length: 50 }),
  documentHash: varchar("document_hash", { length: 64 }),
  
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  submittedAt: timestamp("submitted_at"),
  acknowledgedAt: timestamp("acknowledged_at"),
  
  retainUntil: timestamp("retain_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_a2_pan").on(table.applicantPan),
  index("idx_a2_status").on(table.status),
  index("idx_a2_transaction").on(table.transactionId),
]);

export const insertA2FormSchema = createInsertSchema(a2Forms).omit({ id: true, createdAt: true });
export type A2Form = typeof a2Forms.$inferSelect;
export type InsertA2Form = z.infer<typeof insertA2FormSchema>;

export const adCertificates = pgTable("ad_certificates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  certificateNumber: varchar("certificate_number", { length: 50 }).unique().notNull(),
  transactionId: varchar("transaction_id").references(() => lrsTransactions.id),
  
  adBankName: varchar("ad_bank_name", { length: 200 }).notNull(),
  adBankBranch: varchar("ad_bank_branch", { length: 200 }),
  adCode: varchar("ad_code", { length: 20 }).notNull(),
  
  applicantName: varchar("applicant_name", { length: 200 }).notNull(),
  applicantPan: varchar("applicant_pan", { length: 10 }).notNull(),
  
  purposeCode: varchar("purpose_code", { length: 10 }).notNull(),
  remittanceAmountUsd: numeric("remittance_amount_usd").notNull(),
  remittanceAmountInr: numeric("remittance_amount_inr").notNull(),
  exchangeRate: numeric("exchange_rate").notNull(),
  
  beneficiaryDetails: text("beneficiary_details"),
  lrsUtilization: numeric("lrs_utilization"),
  tcsDeducted: numeric("tcs_deducted").default("0"),
  
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  validUntil: timestamp("valid_until").notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  
  documentHash: varchar("document_hash", { length: 64 }),
  
  retainUntil: timestamp("retain_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_adc_pan").on(table.applicantPan),
  index("idx_adc_status").on(table.status, table.validUntil),
  index("idx_adc_transaction").on(table.transactionId),
]);

export const insertAdCertificateSchema = createInsertSchema(adCertificates).omit({ id: true, createdAt: true });
export type AdCertificate = typeof adCertificates.$inferSelect;
export type InsertAdCertificate = z.infer<typeof insertAdCertificateSchema>;

export const lrsLimitAlerts = pgTable("lrs_limit_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  financialYear: varchar("financial_year", { length: 10 }).notNull(),
  
  alertType: varchar("alert_type", { length: 30 }).notNull(),
  message: text("message").notNull(),
  
  utilizationPercentage: numeric("utilization_percentage"),
  totalRemittedUsd: numeric("total_remitted_usd"),
  remainingLimitUsd: numeric("remaining_limit_usd"),
  
  acknowledged: boolean("acknowledged").default(false),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by"),
  
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_lrs_alerts_user").on(table.userId, table.financialYear),
  index("idx_lrs_alerts_type").on(table.alertType, table.acknowledged),
]);

export const insertLrsLimitAlertSchema = createInsertSchema(lrsLimitAlerts).omit({ id: true, createdAt: true });
export type LrsLimitAlert = typeof lrsLimitAlerts.$inferSelect;
export type InsertLrsLimitAlert = z.infer<typeof insertLrsLimitAlertSchema>;

// Historical NAV/Price Data Cache - Ensures API failures never break portfolio metrics
export const historicalNavData = pgTable("historical_nav_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Identifier - scheme code for MF, ticker symbol for stocks
  identifier: varchar("identifier", { length: 50 }).notNull(),
  identifierType: varchar("identifier_type", { length: 20 }).notNull(), // 'mutual_fund' | 'stock' | 'etf' | 'index'
  
  // NAV/Price data
  date: date("date").notNull(),
  nav: numeric("nav").notNull(),
  open: numeric("open"),
  high: numeric("high"),
  low: numeric("low"),
  close: numeric("close"),
  volume: numeric("volume"),
  
  // Data source tracking
  source: varchar("source", { length: 30 }).notNull(), // 'mfapi' | 'yahoo_finance' | 'amfi' | 'manual'
  
  // Metadata
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_historical_nav_identifier").on(table.identifier, table.identifierType),
  index("idx_historical_nav_date").on(table.identifier, table.date),
  uniqueIndex("idx_historical_nav_unique").on(table.identifier, table.identifierType, table.date),
]);

export const insertHistoricalNavDataSchema = createInsertSchema(historicalNavData).omit({ id: true, createdAt: true, fetchedAt: true });
export type HistoricalNavData = typeof historicalNavData.$inferSelect;
export type InsertHistoricalNavData = z.infer<typeof insertHistoricalNavDataSchema>;

// ============ MUTUAL FUND MONTHWISE PERFORMANCE ============
// Pre-calculated monthly returns for mutual funds, derived from historical NAV data

// Scheme/Stock Metadata Cache - Store fund/stock info for quick lookups
export const assetMetadataCache = pgTable("asset_metadata_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  identifier: varchar("identifier", { length: 50 }).notNull(),
  identifierType: varchar("identifier_type", { length: 20 }).notNull(),
  
  // Common metadata
  name: varchar("name", { length: 300 }).notNull(),
  category: varchar("category", { length: 100 }),
  subCategory: varchar("sub_category", { length: 100 }),
  
  // MF specific
  amcName: varchar("amc_name", { length: 200 }),
  schemeType: varchar("scheme_type", { length: 50 }),
  isin: varchar("isin", { length: 20 }),
  
  // Stock specific
  exchange: varchar("exchange", { length: 20 }),
  sector: varchar("sector", { length: 100 }),
  industry: varchar("industry", { length: 100 }),
  
  // Current data
  latestNav: numeric("latest_nav"),
  latestNavDate: date("latest_nav_date"),
  
  // Cache management
  source: varchar("source", { length: 30 }).notNull(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_asset_metadata_identifier").on(table.identifier, table.identifierType),
  index("idx_asset_metadata_name").on(table.name),
]);

export const insertAssetMetadataCacheSchema = createInsertSchema(assetMetadataCache).omit({ id: true, createdAt: true, lastUpdatedAt: true });
export type AssetMetadataCache = typeof assetMetadataCache.$inferSelect;
export type InsertAssetMetadataCache = z.infer<typeof insertAssetMetadataCacheSchema>;

// Pre-calculated Portfolio Metrics Cache - Store computed metrics to avoid recalculation

// Inbound SMS/WhatsApp Message Logs
export const inboundMessages = pgTable("inbound_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Message details
  messageSid: varchar("message_sid", { length: 100 }).notNull(),
  channel: varchar("channel", { length: 20 }).notNull(), // 'sms' | 'whatsapp'
  direction: varchar("direction", { length: 20 }).notNull().default('inbound'), // 'inbound' | 'outbound'
  
  // Contact info
  fromNumber: varchar("from_number", { length: 50 }).notNull(),
  toNumber: varchar("to_number", { length: 50 }).notNull(),
  
  // Message content
  body: text("body").notNull(),
  
  // Media attachments
  numMedia: integer("num_media").default(0),
  mediaUrls: text("media_urls").array(),
  
  // User association
  userId: varchar("user_id").references(() => users.id),
  
  // Command parsing
  parsedCommand: varchar("parsed_command", { length: 50 }),
  commandArgs: text("command_args").array(),
  
  // Response tracking
  autoReplyResponse: text("auto_reply_response"),
  processed: boolean("processed").default(false),
  
  // Admin notes
  adminNotes: text("admin_notes"),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  readBy: varchar("read_by"),
  
  // Timestamps
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inbound_messages_channel").on(table.channel),
  index("idx_inbound_messages_from").on(table.fromNumber),
  index("idx_inbound_messages_user").on(table.userId),
  index("idx_inbound_messages_received").on(table.receivedAt),
  index("idx_inbound_messages_unread").on(table.isRead, table.receivedAt),
]);

export const insertInboundMessageSchema = createInsertSchema(inboundMessages).omit({ id: true, createdAt: true });
export type InboundMessage = typeof inboundMessages.$inferSelect;
export type InsertInboundMessage = z.infer<typeof insertInboundMessageSchema>;

// Call Logs Table - For tracking incoming voice calls
export const callLogs = pgTable("call_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Twilio call details
  callSid: varchar("call_sid", { length: 100 }).notNull().unique(),
  accountSid: varchar("account_sid", { length: 100 }),
  
  // Call direction and status
  direction: varchar("direction", { length: 20 }).notNull().default('inbound'), // 'inbound' | 'outbound'
  status: varchar("status", { length: 30 }).notNull().default('received'), // 'received', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled'
  
  // Contact info
  callerNumber: varchar("caller_number", { length: 50 }).notNull(),
  calledNumber: varchar("called_number", { length: 50 }).notNull(),
  callerCity: varchar("caller_city", { length: 100 }),
  callerState: varchar("caller_state", { length: 100 }),
  callerCountry: varchar("caller_country", { length: 100 }),
  
  // Call duration (in seconds)
  duration: integer("duration").default(0),
  
  // User association (auto-detected from phone number)
  userId: varchar("user_id").references(() => users.id),
  
  // Agent assignment (if user has an assigned agent)
  assignedAgentId: varchar("assigned_agent_id").references(() => users.id),
  
  // Callback tracking
  callbackRequested: boolean("callback_requested").default(true),
  callbackStatus: varchar("callback_status", { length: 30 }).default('pending'), // 'pending', 'scheduled', 'completed', 'cancelled'
  callbackScheduledAt: timestamp("callback_scheduled_at"),
  callbackCompletedAt: timestamp("callback_completed_at"),
  callbackCompletedBy: varchar("callback_completed_by").references(() => users.id),
  
  // Recording (if enabled)
  recordingUrl: text("recording_url"),
  recordingSid: varchar("recording_sid", { length: 100 }),
  
  // Admin notes
  adminNotes: text("admin_notes"),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  readBy: varchar("read_by"),
  
  // Greeting played
  greetingPlayed: text("greeting_played"),
  
  // Timestamps
  callStartedAt: timestamp("call_started_at").defaultNow().notNull(),
  callEndedAt: timestamp("call_ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_call_logs_caller").on(table.callerNumber),
  index("idx_call_logs_user").on(table.userId),
  index("idx_call_logs_agent").on(table.assignedAgentId),
  index("idx_call_logs_callback").on(table.callbackStatus),
  index("idx_call_logs_started").on(table.callStartedAt),
  index("idx_call_logs_unread").on(table.isRead, table.callStartedAt),
]);

export const insertCallLogSchema = createInsertSchema(callLogs).omit({ id: true, createdAt: true });
export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = z.infer<typeof insertCallLogSchema>;

// A/B Tests Table - For running experiments
export const abTests = pgTable("ab_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Test identification
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  testKey: varchar("test_key", { length: 100 }).notNull().unique(),
  
  // Test configuration
  status: varchar("status", { length: 20 }).notNull().default('draft'), // 'draft', 'running', 'paused', 'completed'
  metric: varchar("metric", { length: 100 }).notNull(), // What we're measuring (e.g., 'conversion_rate', 'click_rate')
  
  // Variants stored as JSONB array
  // [{name: string, percentage: number, conversions: number}]
  variants: jsonb("variants").notNull().default(sql`'[]'::jsonb`),
  
  // Sample size and results
  sampleSize: integer("sample_size").default(0),
  winner: varchar("winner", { length: 100 }),
  
  // Targeting
  targetAudience: text("target_audience").array().default(sql`ARRAY[]::text[]`),
  
  // Timestamps
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
}, (table) => [
  index("idx_ab_tests_key").on(table.testKey),
  index("idx_ab_tests_status").on(table.status),
]);

export const insertAbTestSchema = createInsertSchema(abTests).omit({ id: true, createdAt: true, updatedAt: true });
export type AbTest = typeof abTests.$inferSelect;
export type InsertAbTest = z.infer<typeof insertAbTestSchema>;

// Recommendation Products - Database-driven investment product recommendations
// This replaces hardcoded FUND_RECOMMENDATIONS_BY_CATEGORY for stocks, REITs, InvITs
export const recommendationProducts = pgTable("recommendation_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Product identification
  productType: varchar("product_type").notNull(), // 'listed_stock', 'unlisted_stock', 'reit', 'invit', 'mutual_fund', 'bond', 'pms', 'aif'
  productId: varchar("product_id"), // Reference to listedStocks.id, reits.id, preIpoCompanies.id, etc. (optional for manual entries)
  
  // Product details (can be synced from source table or manually entered)
  name: text("name").notNull(),
  symbol: varchar("symbol"), // NSE/BSE symbol for stocks, ticker for others
  amc: varchar("amc"), // AMC/Sponsor/Manager name
  category: varchar("category"), // 'Large Cap', 'Mid Cap', 'Office REIT', etc.
  sector: varchar("sector"), // IT, Banking, Real Estate, Infrastructure, etc.
  region: varchar("region"), // 'US', 'Europe', 'Asia-Pacific', 'Emerging Markets', 'Global' for international products
  country: varchar("country"), // Specific country for international products (USA, Japan, Germany, etc.)
  
  // Risk profile mapping
  riskProfile: varchar("risk_profile").notNull(), // 'conservative', 'moderate', 'aggressive', 'very_aggressive'
  
  // Performance metrics
  returns1Y: varchar("returns_1y"),
  returns3Y: varchar("returns_3y"),
  returns5Y: varchar("returns_5y"),
  dividendYield: varchar("dividend_yield"),
  
  // Valuation/Price data
  currentPrice: decimal("current_price", { precision: 15, scale: 2 }),
  peRatio: decimal("pe_ratio", { precision: 10, scale: 2 }),
  marketCap: varchar("market_cap"), // 'Large Cap', 'Mid Cap', 'Small Cap'
  
  // Risk classification
  riskLevel: varchar("risk_level"), // 'Low', 'Moderate', 'Moderately High', 'High', 'Very High'
  
  // Investment requirements
  minimumInvestment: decimal("minimum_investment", { precision: 15, scale: 2 }).default("0"),
  lotSize: integer("lot_size").default(1),
  
  // Selection criteria
  selectionRationale: text("selection_rationale"), // Why this product is recommended
  investmentThesis: text("investment_thesis"), // Investment thesis for agents
  
  // Priority and controls
  priority: integer("priority").default(50), // Higher = recommended first (1-100)
  isActive: boolean("is_active").default(true),
  
  // Special requirements
  requiresEnhancedKYC: boolean("requires_enhanced_kyc").default(false),
  
  // Metadata
  addedBy: varchar("added_by").references(() => users.id),
  lastUpdatedBy: varchar("last_updated_by").references(() => users.id),
  dataSource: varchar("data_source").default("manual"), // 'manual', 'synced', 'api'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_rec_products_type").on(table.productType),
  index("idx_rec_products_risk").on(table.riskProfile),
  index("idx_rec_products_active").on(table.isActive),
  index("idx_rec_products_type_risk").on(table.productType, table.riskProfile),
  index("idx_rec_products_priority").on(table.priority),
]);

export const insertRecommendationProductSchema = createInsertSchema(recommendationProducts).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type RecommendationProduct = typeof recommendationProducts.$inferSelect;
export type InsertRecommendationProduct = z.infer<typeof insertRecommendationProductSchema>;


// Stock Prices Cache - Database-driven market data to reduce API calls
// Stores real-time stock prices fetched from NSE/BSE with periodic updates
export const stockPricesCache = pgTable("stock_prices_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Stock identification
  symbol: varchar("symbol").notNull().unique(), // NSE/BSE symbol
  name: text("name").notNull(),
  exchange: varchar("exchange").notNull().default("NSE"), // 'NSE', 'BSE'
  
  // Price data
  currentPrice: decimal("current_price", { precision: 15, scale: 2 }).notNull(),
  previousClose: decimal("previous_close", { precision: 15, scale: 2 }),
  change: decimal("change", { precision: 15, scale: 2 }),
  changePercent: decimal("change_percent", { precision: 10, scale: 4 }),
  
  // OHLC data
  dayHigh: decimal("day_high", { precision: 15, scale: 2 }),
  dayLow: decimal("day_low", { precision: 15, scale: 2 }),
  open: decimal("open_price", { precision: 15, scale: 2 }),
  volume: bigint("volume", { mode: "number" }),
  
  // Market cap for sorting
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  
  // Categorization for market movers
  isGainer: boolean("is_gainer").default(false),
  isLoser: boolean("is_loser").default(false),
  gainerRank: integer("gainer_rank"), // Rank among gainers (1 = top gainer)
  loserRank: integer("loser_rank"), // Rank among losers (1 = top loser)
  
  // Data freshness
  dataSource: varchar("data_source").default("nse"), // 'nse', 'bse', 'finnhub'
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_stock_prices_symbol").on(table.symbol),
  index("idx_stock_prices_gainer").on(table.isGainer, table.gainerRank),
  index("idx_stock_prices_loser").on(table.isLoser, table.loserRank),
  index("idx_stock_prices_fetched").on(table.fetchedAt),
]);

export const insertStockPricesCacheSchema = createInsertSchema(stockPricesCache).omit({ 
  id: true, createdAt: true, updatedAt: true 
});
export type StockPricesCache = typeof stockPricesCache.$inferSelect;
export type InsertStockPricesCache = z.infer<typeof insertStockPricesCacheSchema>;

// Financial Instruments Cache - Unified database for all financial data
// Stores global stocks, ETFs, mutual funds, bonds, and other instruments
export const financialInstrumentsCache = pgTable("financial_instruments_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  instrumentType: varchar("instrument_type").notNull(),
  symbol: varchar("symbol").notNull(),
  isin: varchar("isin"),
  name: text("name").notNull(),
  
  exchange: varchar("exchange"),
  currency: varchar("currency").default("INR"),
  country: varchar("country").default("IN"),
  
  currentPrice: decimal("current_price", { precision: 15, scale: 4 }),
  previousClose: decimal("previous_close", { precision: 15, scale: 4 }),
  dayChange: decimal("day_change", { precision: 15, scale: 4 }),
  dayChangePercent: decimal("day_change_percent", { precision: 10, scale: 4 }),
  dayHigh: decimal("day_high", { precision: 15, scale: 4 }),
  dayLow: decimal("day_low", { precision: 15, scale: 4 }),
  openPrice: decimal("open_price", { precision: 15, scale: 4 }),
  volume: bigint("volume", { mode: "number" }),
  
  nav: decimal("nav", { precision: 15, scale: 4 }),
  navDate: date("nav_date"),
  
  return1d: decimal("return_1d", { precision: 10, scale: 4 }),
  return1w: decimal("return_1w", { precision: 10, scale: 4 }),
  return1m: decimal("return_1m", { precision: 10, scale: 4 }),
  return3m: decimal("return_3m", { precision: 10, scale: 4 }),
  return6m: decimal("return_6m", { precision: 10, scale: 4 }),
  return1y: decimal("return_1y", { precision: 10, scale: 4 }),
  return3y: decimal("return_3y", { precision: 10, scale: 4 }),
  return5y: decimal("return_5y", { precision: 10, scale: 4 }),
  
  yieldPercent: decimal("yield_percent", { precision: 10, scale: 4 }),
  couponRate: decimal("coupon_rate", { precision: 10, scale: 4 }),
  maturityDate: date("maturity_date"),
  
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  peRatio: decimal("pe_ratio", { precision: 10, scale: 2 }),
  dividendYield: decimal("dividend_yield", { precision: 10, scale: 4 }),
  
  category: varchar("category"),
  sector: varchar("sector"),
  subSector: varchar("sub_sector"),
  
  amc: varchar("amc"),
  fundManager: varchar("fund_manager"),
  expenseRatio: decimal("expense_ratio", { precision: 6, scale: 4 }),
  aum: decimal("aum", { precision: 20, scale: 2 }),
  
  riskLevel: varchar("risk_level"),
  volatility: decimal("volatility", { precision: 10, scale: 4 }),
  sharpeRatio: decimal("sharpe_ratio", { precision: 10, scale: 4 }),
  beta: decimal("beta", { precision: 10, scale: 4 }),
  
  dataSource: varchar("data_source").notNull(),
  secondarySource: varchar("secondary_source"),
  confidenceScore: integer("confidence_score").default(100),
  isVerified: boolean("is_verified").default(false),
  verificationNotes: text("verification_notes"),
  
  priceUpdatedAt: timestamp("price_updated_at"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_fin_cache_type_symbol_exchange").on(table.instrumentType, table.symbol, table.exchange),
  index("idx_fin_cache_type").on(table.instrumentType),
  index("idx_fin_cache_symbol").on(table.symbol),
  index("idx_fin_cache_type_symbol").on(table.instrumentType, table.symbol),
  index("idx_fin_cache_exchange").on(table.exchange),
]);

export const insertFinancialInstrumentsCacheSchema = createInsertSchema(financialInstrumentsCache).omit({ 
  id: true, createdAt: true, updatedAt: true, fetchedAt: true 
});
export type FinancialInstrumentsCache = typeof financialInstrumentsCache.$inferSelect;
export type InsertFinancialInstrumentsCache = z.infer<typeof insertFinancialInstrumentsCacheSchema>;

// ============================================================================
// PROPOSAL ESIGN WORKFLOW - Multi-party document signing for proposals
// Extends existing eSign infrastructure with proposal-specific workflow
// ============================================================================

// Proposal document signing workflow
export type ProposalEsignWorkflow = typeof proposalEsignWorkflows.$inferSelect;
export type InsertProposalEsignWorkflow = z.infer<typeof insertProposalEsignWorkflowSchema>;

export const insertProposalEsignVersionSchema = createInsertSchema(proposalEsignVersions).omit({
  id: true, createdAt: true,
});
export type ProposalEsignVersion = typeof proposalEsignVersions.$inferSelect;
export type InsertProposalEsignVersion = z.infer<typeof insertProposalEsignVersionSchema>;

export const insertProposalEsignParticipantSchema = createInsertSchema(proposalEsignParticipants).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type ProposalEsignParticipant = typeof proposalEsignParticipants.$inferSelect;
export type InsertProposalEsignParticipant = z.infer<typeof insertProposalEsignParticipantSchema>;

export const insertProposalEsignCommentSchema = createInsertSchema(proposalEsignComments).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type ProposalEsignComment = typeof proposalEsignComments.$inferSelect;
export type InsertProposalEsignComment = z.infer<typeof insertProposalEsignCommentSchema>;

export const insertProposalEsignFieldEditSchema = createInsertSchema(proposalEsignFieldEdits).omit({
  id: true, createdAt: true,
});
export type ProposalEsignFieldEdit = typeof proposalEsignFieldEdits.$inferSelect;
export type InsertProposalEsignFieldEdit = z.infer<typeof insertProposalEsignFieldEditSchema>;

export const insertProposalEsignAuditLogSchema = createInsertSchema(proposalEsignAuditLogs).omit({
  id: true, timestamp: true,
});
export type ProposalEsignAuditLog = typeof proposalEsignAuditLogs.$inferSelect;
export type InsertProposalEsignAuditLog = z.infer<typeof insertProposalEsignAuditLogSchema>;


// ==========================================
// Pick of the Day - Investment Recommendations
// ==========================================





// DSA Multi-Financier Loan Routing System (Re-exports)
export {
  dsaLoanApplications,
  bankConnectors,
  loanEligibilityRules,
  loanRoutingHistory,
  dsaLoanDocuments,
  dsaLoanAuditLogs,
  dsaCommissionTracking,
  loanWebhookEvents,
  dsaLoanStatusEnum,
  routingStrategyEnum,
  bankConnectorTypeEnum,
  insertDsaLoanApplicationSchema,
  insertBankConnectorSchema,
  insertLoanEligibilityRuleSchema,
  insertLoanRoutingHistorySchema,
  insertDsaLoanDocumentSchema,
  insertDsaLoanAuditLogSchema,
  insertDsaCommissionTrackingSchema,
  insertLoanWebhookEventSchema,
  bankCredentialsVault,
  bankOAuthTokens,
  bankApiAuditLogs,
  insertBankCredentialsVaultSchema,
  insertBankOAuthTokensSchema,
  insertBankApiAuditLogSchema,
  loanVerticalEnum,
  loanSubTypeEnum,
  projectStageEnum,
  tranchStatusEnum,
  approvalStatusEnum,
  encumbranceStatusEnum,
  titleStatusEnum,
  developerProjects,
  projectLandDetails,
  projectApprovals,
  projectCashflows,
  developerFinancials,
  loanDisbursementTranches,
  bankProductAppetite,
  insertDeveloperProjectSchema,
  insertProjectLandDetailsSchema,
  insertProjectApprovalsSchema,
  insertProjectCashflowsSchema,
  insertDeveloperFinancialsSchema,
  insertLoanDisbursementTrancheSchema,
  insertBankProductAppetiteSchema,
  agentLoanActions,
  agentPayoutClaims,
  agentLoanStatusHistory,
  insertAgentLoanActionSchema,
  insertAgentPayoutClaimSchema,
  insertAgentLoanStatusHistorySchema,
  bankInteractionEvents,
  insertBankInteractionEventSchema,
} from './dsa-loan-schema.ts';

export type {
  DsaLoanApplication,
  InsertDsaLoanApplication,
  BankConnector,
  InsertBankConnector,
  LoanEligibilityRule,
  InsertLoanEligibilityRule,
  LoanRoutingHistory,
  InsertLoanRoutingHistory,
  DsaLoanDocument,
  InsertDsaLoanDocument,
  DsaLoanAuditLog,
  InsertDsaLoanAuditLog,
  DsaCommissionTracking,
  InsertDsaCommissionTracking,
  LoanWebhookEvent,
  InsertLoanWebhookEvent,
  BankCredentialsVault,
  InsertBankCredentialsVault,
  BankOAuthToken,
  InsertBankOAuthToken,
  BankApiAuditLog,
  InsertBankApiAuditLog,
  DeveloperProject,
  InsertDeveloperProject,
  ProjectLandDetail,
  InsertProjectLandDetail,
  ProjectApproval,
  InsertProjectApproval,
  ProjectCashflow,
  InsertProjectCashflow,
  DeveloperFinancial,
  InsertDeveloperFinancial,
  LoanDisbursementTranche,
  InsertLoanDisbursementTranche,
  BankProductAppetite,
  InsertBankProductAppetite,
  AgentLoanAction,
  InsertAgentLoanAction,
  AgentPayoutClaim,
  InsertAgentPayoutClaim,
  AgentLoanStatusHistory,
  InsertAgentLoanStatusHistory,
  BankInteractionEvent,
  InsertBankInteractionEvent,
} from './dsa-loan-schema.ts';

// Picks Watchlist for agents to track favorite picks
export const pickWatchlist = pgTable("pick_watchlist", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  
  // Prospect support - for goals created by agents before user registration
  prospectId: varchar("prospect_id"),
  createdByAgentId: varchar("created_by_agent_id").references(() => users.id),
  pickId: integer("pick_id").references(() => dailyPicks.id).notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  notes: text("notes"),
  priceAlertEnabled: boolean("price_alert_enabled").default(false),
  alertThreshold: decimal("alert_threshold", { precision: 8, scale: 2 }),
  alertType: varchar("alert_type", { length: 20 }), // 'above', 'below', 'target_hit', 'stoploss_hit'
  lastAlertSentAt: timestamp("last_alert_sent_at"),
}, (table) => [
  index("idx_pick_watchlist_user").on(table.userId),
  index("idx_pick_watchlist_pick").on(table.pickId),
]);

export const insertPickWatchlistSchema = createInsertSchema(pickWatchlist).omit({
  id: true, addedAt: true,
});
export type PickWatchlist = typeof pickWatchlist.$inferSelect;
export type InsertPickWatchlist = z.infer<typeof insertPickWatchlistSchema>;

// Price Alert History for tracking triggered alerts
export const pickPriceAlerts = pgTable("pick_price_alerts", {
  id: serial("id").primaryKey(),
  pickId: integer("pick_id").references(() => dailyPicks.id).notNull(),
  userId: varchar("user_id").references(() => users.id),
  alertType: varchar("alert_type", { length: 20 }).notNull(), // 'target_hit', 'stoploss_hit', 'threshold_crossed'
  triggerPrice: decimal("trigger_price", { precision: 18, scale: 4 }).notNull(),
  previousPrice: decimal("previous_price", { precision: 18, scale: 4 }),
  message: text("message"),
  notificationSent: boolean("notification_sent").default(false),
  notificationChannel: varchar("notification_channel", { length: 50 }), // 'email', 'whatsapp', 'both'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pick_price_alerts_pick").on(table.pickId),
  index("idx_pick_price_alerts_user").on(table.userId),
]);

export const insertPickPriceAlertSchema = createInsertSchema(pickPriceAlerts).omit({
  id: true, createdAt: true,
});
export type PickPriceAlert = typeof pickPriceAlerts.$inferSelect;
export type InsertPickPriceAlert = z.infer<typeof insertPickPriceAlertSchema>;

// ============================================================================
// FINANCIAL METRICS ENGINE - Multi-Year Derived Ratios
// ============================================================================

// Stock Financial Metrics - Yearly Historical Data
export const stockFinancialMetrics = pgTable("stock_financial_metrics", {
  id: serial("id").primaryKey(),
  stockId: varchar("stock_id").references(() => listedStocks.id),
  isin: varchar("isin"),
  symbol: varchar("symbol").notNull(),
  fiscalYear: varchar("fiscal_year", { length: 10 }).notNull(), // "2024-25", "2023-24"
  fiscalYearEnd: date("fiscal_year_end"),
  
  // === VALUATION RATIOS ===
  trailingPe: decimal("trailing_pe", { precision: 12, scale: 4 }),
  forwardPe: decimal("forward_pe", { precision: 12, scale: 4 }),
  pegRatio: decimal("peg_ratio", { precision: 10, scale: 4 }),
  priceToBook: decimal("price_to_book", { precision: 10, scale: 4 }),
  priceToSales: decimal("price_to_sales", { precision: 10, scale: 4 }),
  priceToFreeCashFlow: decimal("price_to_fcf", { precision: 12, scale: 4 }),
  evToEbitda: decimal("ev_to_ebitda", { precision: 12, scale: 4 }),
  evToSales: decimal("ev_to_sales", { precision: 12, scale: 4 }),
  evToEbit: decimal("ev_to_ebit", { precision: 12, scale: 4 }),
  enterpriseValue: decimal("enterprise_value", { precision: 20, scale: 2 }),
  earningsYield: decimal("earnings_yield", { precision: 10, scale: 4 }), // E/P ratio
  
  // === PROFITABILITY RATIOS ===
  grossMargin: decimal("gross_margin", { precision: 10, scale: 4 }),
  operatingMargin: decimal("operating_margin", { precision: 10, scale: 4 }),
  netMargin: decimal("net_margin", { precision: 10, scale: 4 }),
  ebitdaMargin: decimal("ebitda_margin", { precision: 10, scale: 4 }),
  fcfMargin: decimal("fcf_margin", { precision: 10, scale: 4 }),
  roe: decimal("roe", { precision: 10, scale: 4 }),
  roa: decimal("roa", { precision: 10, scale: 4 }),
  roce: decimal("roce", { precision: 10, scale: 4 }),
  roic: decimal("roic", { precision: 10, scale: 4 }), // Return on Invested Capital
  
  // === GROWTH METRICS (YoY) ===
  revenueGrowthYoy: decimal("revenue_growth_yoy", { precision: 10, scale: 4 }),
  epsGrowthYoy: decimal("eps_growth_yoy", { precision: 10, scale: 4 }),
  netIncomeGrowthYoy: decimal("net_income_growth_yoy", { precision: 10, scale: 4 }),
  ebitdaGrowthYoy: decimal("ebitda_growth_yoy", { precision: 10, scale: 4 }),
  bookValueGrowthYoy: decimal("book_value_growth_yoy", { precision: 10, scale: 4 }),
  ocfGrowthYoy: decimal("ocf_growth_yoy", { precision: 10, scale: 4 }), // Operating Cash Flow
  fcfGrowthYoy: decimal("fcf_growth_yoy", { precision: 10, scale: 4 }),
  
  // === CAGR METRICS (Multi-Year) ===
  revenueCagr3y: decimal("revenue_cagr_3y", { precision: 10, scale: 4 }),
  revenueCagr5y: decimal("revenue_cagr_5y", { precision: 10, scale: 4 }),
  epsCagr3y: decimal("eps_cagr_3y", { precision: 10, scale: 4 }),
  epsCagr5y: decimal("eps_cagr_5y", { precision: 10, scale: 4 }),
  patCagr3y: decimal("pat_cagr_3y", { precision: 10, scale: 4 }), // Profit After Tax
  patCagr5y: decimal("pat_cagr_5y", { precision: 10, scale: 4 }),
  
  // === LEVERAGE & SOLVENCY ===
  debtToEquity: decimal("debt_to_equity", { precision: 10, scale: 4 }),
  debtToAssets: decimal("debt_to_assets", { precision: 10, scale: 4 }),
  interestCoverage: decimal("interest_coverage", { precision: 12, scale: 4 }),
  currentRatio: decimal("current_ratio", { precision: 10, scale: 4 }),
  quickRatio: decimal("quick_ratio", { precision: 10, scale: 4 }),
  cashRatio: decimal("cash_ratio", { precision: 10, scale: 4 }),
  netDebt: decimal("net_debt", { precision: 20, scale: 2 }),
  netDebtToEbitda: decimal("net_debt_to_ebitda", { precision: 10, scale: 4 }),
  
  // === EFFICIENCY RATIOS ===
  assetTurnover: decimal("asset_turnover", { precision: 10, scale: 4 }),
  inventoryTurnover: decimal("inventory_turnover", { precision: 10, scale: 4 }),
  receivablesTurnover: decimal("receivables_turnover", { precision: 10, scale: 4 }),
  payablesTurnover: decimal("payables_turnover", { precision: 10, scale: 4 }),
  inventoryDays: decimal("inventory_days", { precision: 10, scale: 2 }),
  receivableDays: decimal("receivable_days", { precision: 10, scale: 2 }),
  payableDays: decimal("payable_days", { precision: 10, scale: 2 }),
  cashConversionCycle: decimal("cash_conversion_cycle", { precision: 10, scale: 2 }),
  workingCapitalTurnover: decimal("working_capital_turnover", { precision: 10, scale: 4 }),
  
  // === QUALITY SCORES ===
  piotroskiFScore: integer("piotroski_f_score"), // 0-9 score
  altmanZScore: decimal("altman_z_score", { precision: 10, scale: 4 }),
  beneishMScore: decimal("beneish_m_score", { precision: 10, scale: 4 }), // Earnings manipulation detection
  accrualRatio: decimal("accrual_ratio", { precision: 10, scale: 4 }),
  earningsQuality: decimal("earnings_quality", { precision: 10, scale: 4 }), // OCF/Net Income
  
  // === DIVIDEND METRICS ===
  dividendYield: decimal("dividend_yield", { precision: 10, scale: 4 }),
  dividendPayoutRatio: decimal("dividend_payout_ratio", { precision: 10, scale: 4 }),
  dividendCoverRatio: decimal("dividend_cover_ratio", { precision: 10, scale: 4 }),
  dividendGrowthRate: decimal("dividend_growth_rate", { precision: 10, scale: 4 }),
  dividendStreak: integer("dividend_streak"), // Years of consecutive dividends
  
  // === RAW FINANCIAL DATA (for calculations) ===
  revenue: decimal("revenue", { precision: 20, scale: 2 }),
  ebitda: decimal("ebitda", { precision: 20, scale: 2 }),
  ebit: decimal("ebit", { precision: 20, scale: 2 }),
  netIncome: decimal("net_income", { precision: 20, scale: 2 }),
  eps: decimal("eps", { precision: 15, scale: 4 }),
  bookValuePerShare: decimal("book_value_per_share", { precision: 15, scale: 4 }),
  freeCashFlow: decimal("free_cash_flow", { precision: 20, scale: 2 }),
  operatingCashFlow: decimal("operating_cash_flow", { precision: 20, scale: 2 }),
  totalAssets: decimal("total_assets", { precision: 20, scale: 2 }),
  totalLiabilities: decimal("total_liabilities", { precision: 20, scale: 2 }),
  totalEquity: decimal("total_equity", { precision: 20, scale: 2 }),
  totalDebt: decimal("total_debt", { precision: 20, scale: 2 }),
  cash: decimal("cash", { precision: 20, scale: 2 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  sharesOutstanding: decimal("shares_outstanding", { precision: 15, scale: 0 }),
  
  // === ANALYST ESTIMATES (for Forward P/E) ===
  epsEstimateNextYear: decimal("eps_estimate_next_year", { precision: 15, scale: 4 }),
  revenueEstimateNextYear: decimal("revenue_estimate_next_year", { precision: 20, scale: 2 }),
  targetPriceConsensus: decimal("target_price_consensus", { precision: 15, scale: 2 }),
  numberOfAnalysts: integer("number_of_analysts"),
  
  // === METADATA ===
  dataSource: varchar("data_source", { length: 50 }), // 'probe42', 'finnhub', 'nse', 'bse', 'manual'
  dataQuality: varchar("data_quality", { length: 20 }), // 'complete', 'partial', 'estimated'
  calculatedAt: timestamp("calculated_at").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stock_metrics_stock").on(table.stockId),
  index("idx_stock_metrics_symbol").on(table.symbol),
  index("idx_stock_metrics_isin").on(table.isin),
  index("idx_stock_metrics_fy").on(table.fiscalYear),
  index("idx_stock_metrics_stock_fy").on(table.stockId, table.fiscalYear),
]);

export const insertStockFinancialMetricsSchema = createInsertSchema(stockFinancialMetrics).omit({
  id: true, calculatedAt: true, lastUpdated: true, createdAt: true,
});
export type StockFinancialMetrics = typeof stockFinancialMetrics.$inferSelect;
export type InsertStockFinancialMetrics = z.infer<typeof insertStockFinancialMetricsSchema>;

// Mutual Fund Advanced Metrics - Yearly Historical Data

// Bond/NCD Advanced Metrics - Per Issue

// REIT/InvIT Advanced Metrics
export const reitInvitMetrics = pgTable("reit_invit_metrics", {
  id: serial("id").primaryKey(),
  entityId: varchar("entity_id"),
  isin: varchar("isin"),
  name: varchar("name").notNull(),
  entityType: varchar("entity_type", { length: 10 }).notNull(), // 'reit', 'invit'
  fiscalYear: varchar("fiscal_year", { length: 10 }).notNull(),
  
  // === FFO & AFFO ===
  ffo: decimal("ffo", { precision: 20, scale: 2 }), // Funds From Operations
  affo: decimal("affo", { precision: 20, scale: 2 }), // Adjusted FFO
  ffoPerUnit: decimal("ffo_per_unit", { precision: 15, scale: 4 }),
  affoPerUnit: decimal("affo_per_unit", { precision: 15, scale: 4 }),
  ffoYield: decimal("ffo_yield", { precision: 10, scale: 4 }),
  priceToFfo: decimal("price_to_ffo", { precision: 10, scale: 4 }),
  priceToAffo: decimal("price_to_affo", { precision: 10, scale: 4 }),
  
  // === NAV METRICS ===
  nav: decimal("nav", { precision: 20, scale: 2 }),
  navPerUnit: decimal("nav_per_unit", { precision: 15, scale: 4 }),
  priceToNav: decimal("price_to_nav", { precision: 10, scale: 4 }),
  navPremiumDiscount: decimal("nav_premium_discount", { precision: 10, scale: 4 }),
  
  // === DISTRIBUTION ===
  distributionYield: decimal("distribution_yield", { precision: 10, scale: 4 }),
  distributionPerUnit: decimal("distribution_per_unit", { precision: 15, scale: 4 }),
  annualDistribution: decimal("annual_distribution", { precision: 20, scale: 2 }),
  distributionGrowth: decimal("distribution_growth", { precision: 10, scale: 4 }),
  payoutRatio: decimal("payout_ratio", { precision: 10, scale: 4 }),
  
  // === PROPERTY METRICS (for REITs) ===
  occupancyRate: decimal("occupancy_rate", { precision: 8, scale: 4 }),
  netOperatingIncome: decimal("net_operating_income", { precision: 20, scale: 2 }),
  capRate: decimal("cap_rate", { precision: 10, scale: 4 }),
  leasableArea: decimal("leasable_area", { precision: 15, scale: 2 }),
  wale: decimal("wale", { precision: 8, scale: 2 }), // Weighted Avg Lease Expiry
  
  // === INFRASTRUCTURE METRICS (for InvITs) ===
  capacityUtilization: decimal("capacity_utilization", { precision: 8, scale: 4 }),
  availabilityFactor: decimal("availability_factor", { precision: 8, scale: 4 }),
  
  // === LEVERAGE ===
  debtToAssets: decimal("debt_to_assets", { precision: 10, scale: 4 }),
  debtToEbitda: decimal("debt_to_ebitda", { precision: 10, scale: 4 }),
  interestCoverage: decimal("interest_coverage", { precision: 12, scale: 4 }),
  
  // === RETURNS ===
  totalReturn1y: decimal("total_return_1y", { precision: 10, scale: 4 }),
  totalReturn3y: decimal("total_return_3y", { precision: 10, scale: 4 }),
  totalReturnSinceIpo: decimal("total_return_since_ipo", { precision: 10, scale: 4 }),
  
  // === METADATA ===
  dataSource: varchar("data_source", { length: 50 }),
  calculatedAt: timestamp("calculated_at").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reit_invit_metrics_entity").on(table.entityId),
  index("idx_reit_invit_metrics_isin").on(table.isin),
  index("idx_reit_invit_metrics_fy").on(table.fiscalYear),
]);

export const insertReitInvitMetricsSchema = createInsertSchema(reitInvitMetrics).omit({
  id: true, calculatedAt: true, lastUpdated: true, createdAt: true,
});
export type ReitInvitMetrics = typeof reitInvitMetrics.$inferSelect;
export type InsertReitInvitMetrics = z.infer<typeof insertReitInvitMetricsSchema>;

// =====================================================
// ESIGN AI DOCUMENT ANALYSIS - Annotation System
// =====================================================

// AI Document Annotations - Stores AI suggestions and user notes as threads
export const esignDocumentAnnotations = pgTable("esign_document_annotations", {
  id: serial("id").primaryKey(),
  documentId: varchar("document_id", { length: 100 }).notNull(),
  workflowId: integer("workflow_id"),
  
  category: varchar("category", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  severity: varchar("severity", { length: 20 }).default("info"),
  
  pageNumber: integer("page_number"),
  xPosition: decimal("x_position", { precision: 10, scale: 4 }),
  yPosition: decimal("y_position", { precision: 10, scale: 4 }),
  textExcerpt: text("text_excerpt"),
  startOffset: integer("start_offset"),
  endOffset: integer("end_offset"),
  
  status: varchar("status", { length: 30 }).notNull().default("open"),
  acceptedBy: varchar("accepted_by", { length: 100 }),
  acceptedAt: timestamp("accepted_at"),
  rejectedBy: varchar("rejected_by", { length: 100 }),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  
  createdByType: varchar("created_by_type", { length: 20 }).notNull().default("ai"),
  createdById: varchar("created_by_id", { length: 100 }),
  createdByName: varchar("created_by_name", { length: 255 }),
  
  suggestedAction: text("suggested_action"),
  suggestedReplacement: text("suggested_replacement"),
  
  aiModel: varchar("ai_model", { length: 50 }),
  confidence: decimal("confidence", { precision: 5, scale: 4 }),
  metadata: jsonb("metadata").default({}),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_esign_annotations_doc").on(table.documentId),
  index("idx_esign_annotations_workflow").on(table.workflowId),
  index("idx_esign_annotations_category").on(table.category),
  index("idx_esign_annotations_status").on(table.status),
]);

export const insertEsignDocumentAnnotationSchema = createInsertSchema(esignDocumentAnnotations).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type EsignDocumentAnnotation = typeof esignDocumentAnnotations.$inferSelect;
export type InsertEsignDocumentAnnotation = z.infer<typeof insertEsignDocumentAnnotationSchema>;

// Annotation Replies - Threaded discussions on annotations
export const esignAnnotationReplies = pgTable("esign_annotation_replies", {
  id: serial("id").primaryKey(),
  annotationId: integer("annotation_id").notNull().references(() => esignDocumentAnnotations.id, { onDelete: 'cascade' }),
  parentReplyId: integer("parent_reply_id"),
  
  content: text("content").notNull(),
  
  authorId: varchar("author_id", { length: 100 }),
  authorName: varchar("author_name", { length: 255 }),
  authorType: varchar("author_type", { length: 20 }).notNull(),
  authorEmail: varchar("author_email", { length: 255 }),
  
  isEdited: boolean("is_edited").default(false),
  editedAt: timestamp("edited_at"),
  metadata: jsonb("metadata").default({}),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_esign_replies_annotation").on(table.annotationId),
  index("idx_esign_replies_author").on(table.authorId),
]);

export const insertEsignAnnotationReplySchema = createInsertSchema(esignAnnotationReplies).omit({
  id: true, createdAt: true,
});
export type EsignAnnotationReply = typeof esignAnnotationReplies.$inferSelect;
export type InsertEsignAnnotationReply = z.infer<typeof insertEsignAnnotationReplySchema>;

// Annotation Audit Log - Track all changes
export const esignAnnotationAuditLog = pgTable("esign_annotation_audit_log", {
  id: serial("id").primaryKey(),
  annotationId: integer("annotation_id").notNull().references(() => esignDocumentAnnotations.id, { onDelete: 'cascade' }),
  
  action: varchar("action", { length: 50 }).notNull(),
  previousStatus: varchar("previous_status", { length: 30 }),
  newStatus: varchar("new_status", { length: 30 }),
  
  actorId: varchar("actor_id", { length: 100 }),
  actorName: varchar("actor_name", { length: 255 }),
  actorType: varchar("actor_type", { length: 20 }),
  
  details: jsonb("details").default({}),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_esign_annot_audit_annotation").on(table.annotationId),
  index("idx_esign_annot_audit_action").on(table.action),
]);

export const insertEsignAnnotationAuditLogSchema = createInsertSchema(esignAnnotationAuditLog).omit({
  id: true, createdAt: true,
});
export type EsignAnnotationAuditLog = typeof esignAnnotationAuditLog.$inferSelect;
export type InsertEsignAnnotationAuditLog = z.infer<typeof insertEsignAnnotationAuditLogSchema>;

// AI Analysis Sessions - Track AI analysis runs
export const esignAiAnalysisSessions = pgTable("esign_ai_analysis_sessions", {
  id: serial("id").primaryKey(),
  documentId: varchar("document_id", { length: 100 }).notNull(),
  workflowId: integer("workflow_id"),
  
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  
  documentName: varchar("document_name", { length: 255 }),
  documentType: varchar("document_type", { length: 50 }),
  documentHash: varchar("document_hash", { length: 128 }),
  
  analysisTypes: jsonb("analysis_types").default(['summary', 'corrections', 'missing_clauses', 'compliance']),
  aiModel: varchar("ai_model", { length: 50 }).default("gemini-1.5-flash"),
  
  totalAnnotations: integer("total_annotations").default(0),
  summaryCount: integer("summary_count").default(0),
  correctionCount: integer("correction_count").default(0),
  missingClauseCount: integer("missing_clause_count").default(0),
  complianceCount: integer("compliance_count").default(0),
  
  rawAiResponse: text("raw_ai_response"),
  processingTimeMs: integer("processing_time_ms"),
  tokenCount: integer("token_count"),
  
  requestedById: varchar("requested_by_id", { length: 100 }),
  requestedByName: varchar("requested_by_name", { length: 255 }),
  
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_esign_ai_session_doc").on(table.documentId),
  index("idx_esign_ai_session_status").on(table.status),
]);

export const insertEsignAiAnalysisSessionSchema = createInsertSchema(esignAiAnalysisSessions).omit({
  id: true, createdAt: true,
});
export type EsignAiAnalysisSession = typeof esignAiAnalysisSessions.$inferSelect;
export type InsertEsignAiAnalysisSession = z.infer<typeof insertEsignAiAnalysisSessionSchema>;

// Regulatory Gaps Tracker - Track compliance gaps across regulators
export const regulatoryGaps = pgTable("regulatory_gaps", {
  id: serial("id").primaryKey(),
  
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  
  regulator: varchar("regulator", { length: 20 }).notNull(), // SEBI, RBI, IRDAI, MCA, ITD
  regulatoryReference: varchar("regulatory_reference", { length: 255 }), // e.g., "SEBI Circular 2023"
  referenceUrl: varchar("reference_url", { length: 500 }),
  
  riskLevel: varchar("risk_level", { length: 20 }).notNull().default("medium"), // high, medium, low
  category: varchar("category", { length: 100 }), // grievance, disclosure, investor_protection, etc.
  
  status: varchar("status", { length: 30 }).notNull().default("not_started"), // not_started, in_progress, completed, deferred
  statusUpdatedAt: timestamp("status_updated_at"),
  statusUpdatedBy: varchar("status_updated_by", { length: 100 }),
  
  estimatedEffort: varchar("estimated_effort", { length: 20 }), // low, medium, high
  targetCompletionDate: timestamp("target_completion_date"),
  actualCompletionDate: timestamp("actual_completion_date"),
  
  assignedTo: varchar("assigned_to", { length: 100 }),
  notes: text("notes"),
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_regulatory_gaps_regulator").on(table.regulator),
  index("idx_regulatory_gaps_status").on(table.status),
  index("idx_regulatory_gaps_risk").on(table.riskLevel),
]);

export const insertRegulatoryGapSchema = createInsertSchema(regulatoryGaps).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type RegulatoryGap = typeof regulatoryGaps.$inferSelect;
export type InsertRegulatoryGap = z.infer<typeof insertRegulatoryGapSchema>;

// Consent Audit Log - Immutable record of user consent actions (DPDPA 2023 compliance)

// =====================================================
// ADVISOR RESEARCH WORKSPACE - Morningstar-like Research Lists
// =====================================================

// Research Lists - Curated instrument lists created by advisors
export const researchLists = pgTable("research_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  universeType: varchar("universe_type").notNull(), // MF, ETF, STOCK, BOND, FD, MIXED
  
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id).notNull(),
  organizationId: varchar("organization_id"), // For org-level lists
  
  visibility: varchar("visibility").default("private"), // private, team, org
  isEditable: boolean("is_editable").default(true),
  isArchived: boolean("is_archived").default(false),
  
  // Screener origin (if created from screener)
  screenerConfig: jsonb("screener_config"), // { filters: {...}, universe: "MF" }
  
  // Cached metrics (updated periodically)
  cachedMetrics: jsonb("cached_metrics"), // { avgReturn3y, avgExpenseRatio, avgSharpe, etc. }
  metricsLastUpdated: timestamp("metrics_last_updated"),
  
  // Tags for organization
  tags: text("tags").array().default([]),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_research_lists_agent").on(table.createdByAgentId),
  index("idx_research_lists_visibility").on(table.visibility),
  index("idx_research_lists_universe").on(table.universeType),
  index("idx_research_lists_org").on(table.organizationId),
]);

export const insertResearchListSchema = createInsertSchema(researchLists).omit({
  id: true, createdAt: true, updatedAt: true, metricsLastUpdated: true,
});
export type ResearchList = typeof researchLists.$inferSelect;
export type InsertResearchList = z.infer<typeof insertResearchListSchema>;

// Research List Items - Individual instruments in a research list
export const researchListItems = pgTable("research_list_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  researchListId: varchar("research_list_id").references(() => researchLists.id, { onDelete: "cascade" }).notNull(),
  
  // Polymorphic instrument reference
  instrumentId: varchar("instrument_id").notNull(), // ID from source table
  instrumentType: varchar("instrument_type").notNull(), // mutual_fund, stock, bond, etf, fd
  
  // Denormalized for display (avoids JOINs)
  instrumentName: text("instrument_name"),
  instrumentSymbol: varchar("instrument_symbol"),
  instrumentIsin: varchar("instrument_isin"),
  
  // How the item was added
  addedSource: varchar("added_source").default("manual"), // manual, screener, import, ai_suggestion
  addedByAgentId: varchar("added_by_agent_id").references(() => agents.id),
  
  // Advisor notes
  notes: text("notes"),
  rating: integer("rating"), // 1-5 advisor rating
  
  // Snapshot of key metrics at time of addition (for comparison)
  snapshotMetrics: jsonb("snapshot_metrics"), // { nav, returns3y, expenseRatio, etc. }
  
  addedAt: timestamp("added_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_research_list_items_list").on(table.researchListId),
  index("idx_research_list_items_instrument").on(table.instrumentId, table.instrumentType),
  index("idx_research_list_items_added").on(table.addedAt),
]);

export const insertResearchListItemSchema = createInsertSchema(researchListItems).omit({
  id: true, addedAt: true, updatedAt: true,
});
export type ResearchListItem = typeof researchListItems.$inferSelect;
export type InsertResearchListItem = z.infer<typeof insertResearchListItemSchema>;

// Saved Screeners - Reusable screener configurations
export const savedScreeners = pgTable("saved_screeners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  
  universeType: varchar("universe_type").notNull(), // MF, STOCK, BOND, ETF
  filters: jsonb("filters").notNull(), // { returns_3y: { ">=": 12 }, expense_ratio: { "<=": 1.2 } }
  
  createdByAgentId: varchar("created_by_agent_id").references(() => agents.id).notNull(),
  visibility: varchar("visibility").default("private"), // private, team, org
  
  lastRunAt: timestamp("last_run_at"),
  lastRunResults: integer("last_run_results"), // Count of matching instruments
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_saved_screeners_agent").on(table.createdByAgentId),
  index("idx_saved_screeners_universe").on(table.universeType),
]);

export const insertSavedScreenerSchema = createInsertSchema(savedScreeners).omit({
  id: true, createdAt: true, updatedAt: true, lastRunAt: true, lastRunResults: true,
});
export type SavedScreener = typeof savedScreeners.$inferSelect;
export type InsertSavedScreener = z.infer<typeof insertSavedScreenerSchema>;

// Research List Proposal Attachments - Immutable snapshots when attached to proposals
export const researchListProposalAttachments = pgTable("research_list_proposal_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").notNull(), // References proposals table
  researchListId: varchar("research_list_id").references(() => researchLists.id).notNull(),
  
  // Immutable snapshot at attach time (compliance requirement)
  snapshotData: jsonb("snapshot_data").notNull(), // Full list with all items and metrics
  rationale: text("rationale"), // Advisor's reasoning for including this list
  
  attachedByAgentId: varchar("attached_by_agent_id").references(() => agents.id).notNull(),
  attachedAt: timestamp("attached_at").defaultNow(),
}, (table) => [
  index("idx_research_list_proposal_proposal").on(table.proposalId),
  index("idx_research_list_proposal_list").on(table.researchListId),
]);

export const insertResearchListProposalAttachmentSchema = createInsertSchema(researchListProposalAttachments).omit({
  id: true, attachedAt: true,
});
export type ResearchListProposalAttachment = typeof researchListProposalAttachments.$inferSelect;
export type InsertResearchListProposalAttachment = z.infer<typeof insertResearchListProposalAttachmentSchema>;

// Research Audit Log - Compliance tracking for research list operations
export const researchAuditLog = pgTable("research_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  entityType: varchar("entity_type").notNull(), // research_list, research_list_item, screener
  entityId: varchar("entity_id").notNull(),
  action: varchar("action").notNull(), // create, update, delete, attach_proposal, add_item, remove_item
  
  agentId: varchar("agent_id").references(() => agents.id).notNull(),
  agentName: varchar("agent_name"),
  
  previousData: jsonb("previous_data"), // State before change
  newData: jsonb("new_data"), // State after change
  
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_research_audit_entity").on(table.entityType, table.entityId),
  index("idx_research_audit_agent").on(table.agentId),
  index("idx_research_audit_created").on(table.createdAt),
]);

export const insertResearchAuditLogSchema = createInsertSchema(researchAuditLog).omit({
  id: true, createdAt: true,
});
export type ResearchAuditLog = typeof researchAuditLog.$inferSelect;
export type InsertResearchAuditLog = z.infer<typeof insertResearchAuditLogSchema>;

// ============================================================================
// BENCHMARK DATA TABLES - For Mutual Fund Relative Metrics (Alpha, Beta, etc.)
// ============================================================================

// Market Indices Master Table - stores benchmark indices like NIFTY 50, Sensex
export const marketIndices = pgTable("market_indices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  indexCode: varchar("index_code", { length: 30 }).notNull().unique(), // e.g., NIFTY50, NIFTY_MIDCAP_150, SENSEX
  indexName: varchar("index_name", { length: 100 }).notNull(), // e.g., NIFTY 50, NIFTY Midcap 150
  provider: varchar("provider", { length: 30 }), // e.g., NSE, BSE
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMarketIndexSchema = createInsertSchema(marketIndices).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type MarketIndex = typeof marketIndices.$inferSelect;
export type InsertMarketIndex = z.infer<typeof insertMarketIndexSchema>;

// Market Index NAV History - daily closing values and returns for benchmark indices
export const marketIndexNav = pgTable("market_index_nav", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  indexId: varchar("index_id").references(() => marketIndices.id).notNull(),
  navDate: date("nav_date").notNull(),
  closeValue: decimal("close_value", { precision: 12, scale: 4 }).notNull(),
  dailyReturn: decimal("daily_return", { precision: 10, scale: 6 }), // (today - yesterday) / yesterday
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_market_index_nav_index_id").on(table.indexId),
  index("idx_market_index_nav_date").on(table.navDate),
  // Unique constraint on index_id + nav_date
]);

export const insertMarketIndexNavSchema = createInsertSchema(marketIndexNav).omit({
  id: true, createdAt: true,
});
export type MarketIndexNav = typeof marketIndexNav.$inferSelect;
export type InsertMarketIndexNav = z.infer<typeof insertMarketIndexNavSchema>;

// MF Benchmark Mapping - maps mutual funds to their benchmark indices

// AMFI Scheme Benchmarks - Raw benchmark data from AMFI scheme master


// MF Benchmark History - Tracks changes when AMFI updates scheme benchmarks


// ==================== PROPOSAL BUILDER GAP FIXES ====================

// Proposal Flow State - Tracks phase completion for validation gates

// Goal-Aware Benchmark Mapping - Maps goals/risk/horizon to benchmarks


// Proposal Verdicts - Single verdict per instrument
export type ProposalVerdict = typeof proposalVerdicts.$inferSelect;
export type InsertProposalVerdict = z.infer<typeof insertProposalVerdictSchema>;

// Proposal SIP Recommendations - With source attribution
export type ProposalSipRecommendation = typeof proposalSipRecommendations.$inferSelect;
export type InsertProposalSipRecommendation = z.infer<typeof insertProposalSipRecommendationSchema>;

// What-If Scenarios - Supports both static (PDF) and interactive modes
export type ProposalWhatIfScenario = typeof proposalWhatIfScenarios.$inferSelect;
export type InsertProposalWhatIfScenario = z.infer<typeof insertProposalWhatIfScenarioSchema>;

// Report Section Dependencies - Tracks which sections can be enabled based on data
export type ProposalReportSection = typeof proposalReportSections.$inferSelect;
export type InsertProposalReportSection = z.infer<typeof insertProposalReportSectionSchema>;

// Proposal PDF Metadata - Version tracking and tamper protection

// Proposal Audit Events - Regulator-grade logging
export type ProposalAuditEvent = typeof proposalAuditEvents.$inferSelect;
export type InsertProposalAuditEvent = z.infer<typeof insertProposalAuditEventSchema>;

// Proposal Audit Event Types (constants for type safety)
export const PROPOSAL_AUDIT_EVENT_TYPES = {
  PROSPECT_SELECTED: 'PROSPECT_SELECTED',
  RISK_PROFILE_SET: 'RISK_PROFILE_SET',
  HOLDINGS_IMPORTED: 'HOLDINGS_IMPORTED',
  ANALYSIS_RUN: 'ANALYSIS_RUN',
  VERDICT_FINALIZED: 'VERDICT_FINALIZED',
  SIP_GENERATED: 'SIP_GENERATED',
  REPORT_SECTION_TOGGLED: 'REPORT_SECTION_TOGGLED',
  BENCHMARK_OVERRIDDEN: 'BENCHMARK_OVERRIDDEN',
  PDF_GENERATED: 'PDF_GENERATED',
  PDF_DOWNLOADED: 'PDF_DOWNLOADED',
  PROPOSAL_APPROVED: 'PROPOSAL_APPROVED',
  PROPOSAL_REJECTED: 'PROPOSAL_REJECTED',
  CLIENT_ACKNOWLEDGED: 'CLIENT_ACKNOWLEDGED',
  ALLOCATION_MODE_SELECTED: 'ALLOCATION_MODE_SELECTED',
  AI_ALLOCATION_PROPOSED: 'AI_ALLOCATION_PROPOSED',
  MANUAL_ALLOCATION_LOCKED: 'MANUAL_ALLOCATION_LOCKED',
  STRATEGY_SNAPSHOT_CREATED: 'STRATEGY_SNAPSHOT_CREATED',
  BACKTEST_COMPARISON_COMPLETED: 'BACKTEST_COMPARISON_COMPLETED',
  PORTFOLIO_DIFFERENCE_SUMMARY_GENERATED: 'PORTFOLIO_DIFFERENCE_SUMMARY_GENERATED',
  ALLOCATION_CHANGE_FORCED_NEW_VERSION: 'ALLOCATION_CHANGE_FORCED_NEW_VERSION',
  AI_ALLOCATION_OVERRIDE_BLOCKED: 'AI_ALLOCATION_OVERRIDE_BLOCKED',
  STRATEGY_INTEGRITY_VALIDATED: 'STRATEGY_INTEGRITY_VALIDATED',
  STRATEGY_INTEGRITY_FAILED: 'STRATEGY_INTEGRITY_FAILED',
} as const;

// MF Benchmark Lineage - Tracks source transitions for compliance audit trail (AMFI ↔ BSE ↔ Manual)

// SEBI Audit Logs - Immutable records for regulatory compliance
export const sebiAuditLogs = pgTable("sebi_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id"),
  advisorId: varchar("advisor_id").references(() => users.id),
  clientId: varchar("client_id"),
  prospectId: varchar("prospect_id"),
  actionType: varchar("action_type", { length: 50 }).notNull(), // SIP_ROUTING, FUND_REPLACEMENT, DIVERSIFICATION_SCORE, RECOMMENDATION, PROPOSAL_GENERATED
  actionSummary: text("action_summary").notNull(),
  inputData: jsonb("input_data"), // Original input for reproducibility
  outputData: jsonb("output_data"), // Result data
  rationale: text("rationale"), // SEBI-compliant explanation
  templateId: varchar("template_id", { length: 30 }), // SEBI template used
  riskDisclosure: text("risk_disclosure"), // Mandatory risk disclosure
  complianceFlags: jsonb("compliance_flags"), // Any compliance issues flagged
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sebi_audit_proposal").on(table.proposalId),
  index("idx_sebi_audit_advisor").on(table.advisorId),
  index("idx_sebi_audit_action_type").on(table.actionType),
  index("idx_sebi_audit_created").on(table.createdAt),
]);

export const insertSebiAuditLogSchema = createInsertSchema(sebiAuditLogs).omit({
  id: true, createdAt: true,
});
export type SebiAuditLog = typeof sebiAuditLogs.$inferSelect;
export type InsertSebiAuditLog = z.infer<typeof insertSebiAuditLogSchema>;

// SEBI Audit Action Types
export const SEBI_AUDIT_ACTION_TYPES = {
  SIP_ROUTING: "SIP_ROUTING",
  SIP_SIMULATION: "SIP_SIMULATION",
  FUND_REPLACEMENT: "FUND_REPLACEMENT",
  DIVERSIFICATION_SCORE: "DIVERSIFICATION_SCORE",
  GOAL_BASED_SCORE: "GOAL_BASED_SCORE",
  RECOMMENDATION: "RECOMMENDATION",
  PROPOSAL_GENERATED: "PROPOSAL_GENERATED",
  OVERLAP_ANALYSIS: "OVERLAP_ANALYSIS",
} as const;


// ============================================================
// KYC WIZARD v2 EXTENSION TABLES
// ============================================================

// Video KYC Sessions (BE-KYC-011)




// KYC Product Eligibility Rules (BE-KYC-014)


// MF Enrichment Audit Logs - SEBI audit readiness for all MF data enrichment changes
export type MfEnrichmentAuditLog = typeof mfEnrichmentAuditLogs.$inferSelect;
export type InsertMfEnrichmentAuditLog = z.infer<typeof insertMfEnrichmentAuditLogSchema>;

// MF AUM History - Daily AUM snapshots

// MF Category Rules - SEBI category rules
export type MfCategoryRule = typeof mfCategoryRules.$inferSelect;
export type InsertMfCategoryRule = z.infer<typeof insertMfCategoryRuleSchema>;

// KYC Rejection Reason Codes
export const KYC_REJECTION_REASON_CODES = {
  DOCUMENT_MISMATCH: "DOCUMENT_MISMATCH",
  AML_HIGH_RISK: "AML_HIGH_RISK",
  SIGNATURE_INVALID: "SIGNATURE_INVALID",
  CKYC_INCOMPLETE: "CKYC_INCOMPLETE",
  PAN_NAME_MISMATCH: "PAN_NAME_MISMATCH",
  AADHAAR_FAILED: "AADHAAR_FAILED",
  VIDEO_KYC_FAILED: "VIDEO_KYC_FAILED",
  MAKER_CHECKER_REJECTED: "MAKER_CHECKER_REJECTED",
  REGULATOR_FLAG: "REGULATOR_FLAG",
} as const;

// Video KYC Trigger Reasons
export const VIDEO_KYC_REASONS = {
  HIGH_AML: "HIGH_AML",
  ADMIN_REQUEST: "ADMIN_REQUEST",
  REKYC_ESCALATION: "REKYC_ESCALATION",
  REGULATOR_MANDATE: "REGULATOR_MANDATE",
  CRITICAL_AML: "CRITICAL_AML",
} as const;

// Maker-Checker Required Entity Types
export const MAKER_CHECKER_ENTITY_TYPES = [
  "COMPANY", "HUF", "TRUST", "AOP", "BOI", "HIGH_VALUE_INDIVIDUAL",
] as const;

// ==================== LEAD LEAKAGE PREVENTION SYSTEM ====================





















// ============================================================
// KYC Provider Management & Platform Infrastructure Tables
// ============================================================

// 1. kyc_providers - Master table for all KYC verification providers


// 4. identity_profiles - Unified identity profile


// 5. consent_logs - DPDP compliant consent tracking



// 6. platform_audit_logs - Immutable audit trail (append-only)
export const platformAuditLogs = pgTable("platform_audit_logs", {
  id: serial("id").primaryKey(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id", { length: 100 }).notNull(),
  actorId: varchar("actor_id").references(() => users.id),
  actorRole: varchar("actor_role", { length: 50 }),
  action: varchar("action", { length: 100 }).notNull(),
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  changeDetails: jsonb("change_details"),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id", { length: 100 }),
  regulatoryTag: varchar("regulatory_tag", { length: 50 }),
  severity: varchar("severity", { length: 20 }).default("INFO"),
  isImmutable: boolean("is_immutable").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlatformAuditLogSchema = createInsertSchema(platformAuditLogs).omit({ id: true, createdAt: true });
export type PlatformAuditLog = typeof platformAuditLogs.$inferSelect;
export type InsertPlatformAuditLog = z.infer<typeof insertPlatformAuditLogSchema>;

// 7. conversion_funnels - Analytics funnel tracking

export type InsertConversionFunnel = z.infer<typeof insertConversionFunnelSchema>;

// 8. provider_metrics - Provider performance tracking
export const providerMetrics = pgTable("provider_metrics", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").references(() => kycProviders.id).notNull(),
  metricDate: date("metric_date").notNull(),
  totalCalls: integer("total_calls").default(0),
  successfulCalls: integer("successful_calls").default(0),
  failedCalls: integer("failed_calls").default(0),
  avgLatencyMs: integer("avg_latency_ms").default(0),
  p95LatencyMs: integer("p95_latency_ms").default(0),
  errorCodes: jsonb("error_codes"),
  totalCostInr: decimal("total_cost_inr", { precision: 10, scale: 2 }).default("0"),
  fallbacksTriggered: integer("fallbacks_triggered").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProviderMetricSchema = createInsertSchema(providerMetrics).omit({ id: true, createdAt: true });
export type ProviderMetric = typeof providerMetrics.$inferSelect;
export type InsertProviderMetric = z.infer<typeof insertProviderMetricSchema>;

// 9. product_configurations - Admin product toggle/config
export const productConfigurations = pgTable("product_configurations", {
  id: serial("id").primaryKey(),
  productCode: varchar("product_code", { length: 50 }).unique().notNull(),
  productName: varchar("product_name", { length: 100 }).notNull(),
  isEnabled: boolean("is_enabled").default(true),
  requiredKycLevel: varchar("required_kyc_level", { length: 20 }).default("BASIC"),
  requiredKycSteps: jsonb("required_kyc_steps"),
  regulatoryRequirements: jsonb("regulatory_requirements"),
  defaultBrokerId: varchar("default_broker_id", { length: 50 }),
  configuration: jsonb("configuration"),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductConfigurationSchema = createInsertSchema(productConfigurations).omit({ id: true, createdAt: true, updatedAt: true });
export type ProductConfiguration = typeof productConfigurations.$inferSelect;
export type InsertProductConfiguration = z.infer<typeof insertProductConfigurationSchema>;

// 10. broker_configurations - Broker/NBFC configs
export const brokerConfigurations = pgTable("broker_configurations", {
  id: serial("id").primaryKey(),
  brokerCode: varchar("broker_code", { length: 50 }).unique().notNull(),
  brokerName: varchar("broker_name", { length: 200 }).notNull(),
  brokerType: varchar("broker_type", { length: 50 }).notNull(),
  isEnabled: boolean("is_enabled").default(true),
  apiEndpoint: varchar("api_endpoint", { length: 500 }),
  apiVersion: varchar("api_version", { length: 20 }),
  requiredEnvVars: jsonb("required_env_vars"),
  supportedProducts: jsonb("supported_products"),
  features: jsonb("features"),
  healthStatus: varchar("health_status", { length: 20 }).default("unknown"),
  lastHealthCheck: timestamp("last_health_check"),
  configuration: jsonb("configuration"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBrokerConfigurationSchema = createInsertSchema(brokerConfigurations).omit({ id: true, createdAt: true, updatedAt: true });
export type BrokerConfiguration = typeof brokerConfigurations.$inferSelect;
export type InsertBrokerConfiguration = z.infer<typeof insertBrokerConfigurationSchema>;

// ============================================================================
// AI Alpha Engine - Batch 1: Backtesting, Regime Detection, Portfolio Optimization
// ============================================================================

// 1. ai_feature_snapshots - Daily frozen feature vectors for backtesting reproducibility
export type AiFeatureSnapshot = typeof aiFeatureSnapshots.$inferSelect;
export type InsertAiFeatureSnapshot = z.infer<typeof insertAiFeatureSnapshotSchema>;

// 2. ai_price_history - OHLCV data across all asset classes (not just screener stocks)

// 3. ai_regime_history - Daily market regime classifications

// 4. ai_model_registry - Versioning scoring models and tracking performance

export type AiUserInteraction = typeof aiUserInteractions.$inferSelect;
export type InsertAiUserInteraction = z.infer<typeof insertAiUserInteractionSchema>;

export type AiUserProfile = typeof aiUserProfiles.$inferSelect;
export type InsertAiUserProfile = z.infer<typeof insertAiUserProfileSchema>;

export type AiPredictionLog = typeof aiPredictionLogs.$inferSelect;
export type InsertAiPredictionLog = z.infer<typeof insertAiPredictionLogSchema>;


// Portal Access Audit Log for SEBI/RBI compliance
export const portalAccessLog = pgTable("portal_access_log", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  portalType: varchar("portal_type", { length: 20 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  accessedAt: timestamp("accessed_at").defaultNow(),
}, (table) => [
  index("idx_portal_access_log_user").on(table.userId),
  index("idx_portal_access_log_portal").on(table.portalType),
  index("idx_portal_access_log_date").on(table.accessedAt),
]);

export const insertPortalAccessLogSchema = createInsertSchema(portalAccessLog).omit({ id: true, accessedAt: true });
export type PortalAccessLog = typeof portalAccessLog.$inferSelect;
export type InsertPortalAccessLog = z.infer<typeof insertPortalAccessLogSchema>;

export const signalResolutionLog = pgTable("signal_resolution_log", {
  id: serial("id").primaryKey(),
  prospectId: text("prospect_id"),
  instrumentName: text("instrument_name").notNull(),
  isin: text("isin"),
  potdSignal: text("potd_signal"),
  rebalanceSignal: text("rebalance_signal"),
  resolvedAction: text("resolved_action").notNull(),
  reasoningCode: text("reasoning_code").notNull(),
  governanceRuleId: text("governance_rule_id"),
  confidenceScore: real("confidence_score"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSignalResolutionLogSchema = createInsertSchema(signalResolutionLog).omit({ id: true, createdAt: true });
export type InsertSignalResolutionLog = z.infer<typeof insertSignalResolutionLogSchema>;
export type SignalResolutionLog = typeof signalResolutionLog.$inferSelect;

export const governancePolicy = pgTable("governance_policy", {
  id: serial("id").primaryKey(),
  ruleId: text("rule_id").notNull().unique(),
  potdSignal: text("potd_signal").notNull(),
  rebalanceSignal: text("rebalance_signal").notNull(),
  resolvedAction: text("resolved_action").notNull(),
  priority: text("priority").notNull().default('medium'),
  description: text("description").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertGovernancePolicySchema = createInsertSchema(governancePolicy).omit({ id: true, updatedAt: true });
export type InsertGovernancePolicy = z.infer<typeof insertGovernancePolicySchema>;
export type GovernancePolicy = typeof governancePolicy.$inferSelect;

export const rebalanceGovernanceConfig = pgTable("rebalance_governance_config", {
  id: serial("id").primaryKey(),
  riskProfile: text("risk_profile").notNull().unique(),
  toleranceBandPct: real("tolerance_band_pct").notNull().default(5),
  minTradeValueInr: real("min_trade_value_inr").notNull().default(5000),
  brokerageRatePct: real("brokerage_rate_pct").notNull().default(0.03),
  maxTacticalWeightPct: real("max_tactical_weight_pct").notNull().default(10),
  targetVolatilityPct: real("target_volatility_pct").notNull().default(15),
  riskToleranceBandPct: real("risk_tolerance_band_pct").notNull().default(3),
  maxCategoriesInBuy: integer("max_categories_in_buy").notNull().default(3),
  reviewFrequencyDays: integer("review_frequency_days").notNull().default(90),
  adaptiveToleranceEnabled: boolean("adaptive_tolerance_enabled").notNull().default(false),
  highVolToleranceBandPct: real("high_vol_tolerance_band_pct").default(3),
  vixThreshold: real("vix_threshold").default(25),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRebalanceGovernanceConfigSchema = createInsertSchema(rebalanceGovernanceConfig).omit({ id: true, updatedAt: true });
export type InsertRebalanceGovernanceConfig = z.infer<typeof insertRebalanceGovernanceConfigSchema>;
export type RebalanceGovernanceConfig = typeof rebalanceGovernanceConfig.$inferSelect;

export const rebalanceDecisionLog = pgTable("rebalance_decision_log", {
  id: serial("id").primaryKey(),
  proposalId: text("proposal_id"),
  portfolioValue: real("portfolio_value"),
  instrumentName: text("instrument_name").notNull(),
  assetCategory: text("asset_category").notNull(),
  currentWeightPct: real("current_weight_pct"),
  targetWeightPct: real("target_weight_pct"),
  driftPct: real("drift_pct"),
  driftStatus: text("drift_status"),
  riskFlag: text("risk_flag"),
  costEstimate: real("cost_estimate"),
  costFlag: text("cost_flag"),
  tacticalFlag: text("tactical_flag"),
  rawAction: text("raw_action").notNull(),
  finalAction: text("final_action").notNull(),
  changeAmount: real("change_amount"),
  rationaleCode: text("rationale_code").notNull(),
  rationaleDetail: text("rationale_detail"),
  governanceConfigId: integer("governance_config_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_rebalance_log_proposal").on(table.proposalId),
  index("idx_rebalance_log_created").on(table.createdAt),
]);

export const insertRebalanceDecisionLogSchema = createInsertSchema(rebalanceDecisionLog).omit({ id: true, createdAt: true });
export type InsertRebalanceDecisionLog = z.infer<typeof insertRebalanceDecisionLogSchema>;
export type RebalanceDecisionLog = typeof rebalanceDecisionLog.$inferSelect;

// ── Quant Infrastructure Tables ──

export const quantGovernancePolicy = pgTable("quant_governance_policy", {
  id: serial("id").primaryKey(),
  riskProfile: text("risk_profile").notNull().unique(),
  useMvo: boolean("use_mvo").notNull().default(false),
  useBlackLitterman: boolean("use_black_litterman").notNull().default(false),
  useAiDriftPrediction: boolean("use_ai_drift_prediction").notNull().default(false),
  riskAversion: real("risk_aversion").notNull().default(2.5),
  tau: real("tau").notNull().default(0.05),
  tacticalBudget: real("tactical_budget").notNull().default(0.10),
  driftProbabilityTrigger: real("drift_probability_trigger").notNull().default(0.7),
  maxAssetWeight: real("max_asset_weight").notNull().default(0.40),
  minAssetWeight: real("min_asset_weight").notNull().default(0.0),
  covarianceLookbackDays: integer("covariance_lookback_days").notNull().default(250),
  ewmaSpan: integer("ewma_span").notNull().default(60),
  shrinkageIntensity: real("shrinkage_intensity").notNull().default(0.5),
  solverMaxIterations: integer("solver_max_iterations").notNull().default(1000),
  solverTolerance: real("solver_tolerance").notNull().default(1e-8),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertQuantGovernancePolicySchema = createInsertSchema(quantGovernancePolicy).omit({ id: true, updatedAt: true });
export type InsertQuantGovernancePolicy = z.infer<typeof insertQuantGovernancePolicySchema>;
export type QuantGovernancePolicy = typeof quantGovernancePolicy.$inferSelect;

export const quantRunLog = pgTable("quant_run_log", {
  id: serial("id").primaryKey(),
  portfolioId: text("portfolio_id"),
  modelType: text("model_type").notNull(),
  runTimeMs: integer("run_time_ms"),
  status: text("status").notNull(),
  inputHash: text("input_hash"),
  outputSummary: jsonb("output_summary"),
  errorMessage: text("error_message"),
  fallbackUsed: boolean("fallback_used").default(false),
  governancePolicyId: integer("governance_policy_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quant_run_log_model").on(table.modelType),
  index("idx_quant_run_log_created").on(table.createdAt),
  index("idx_quant_run_log_portfolio").on(table.portfolioId),
]);

export const insertQuantRunLogSchema = createInsertSchema(quantRunLog).omit({ id: true, createdAt: true });
export type InsertQuantRunLog = z.infer<typeof insertQuantRunLogSchema>;
export type QuantRunLog = typeof quantRunLog.$inferSelect;

export const strategicTargetWeights = pgTable("strategic_target_weights", {
  id: serial("id").primaryKey(),
  portfolioId: text("portfolio_id").notNull(),
  category: text("category").notNull(),
  weight: real("weight").notNull(),
  modelVersion: text("model_version").notNull(),
  expectedReturn: real("expected_return"),
  volatility: real("volatility"),
  sharpeContribution: real("sharpe_contribution"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_strategic_weights_portfolio").on(table.portfolioId),
  index("idx_strategic_weights_generated").on(table.generatedAt),
]);

export const insertStrategicTargetWeightsSchema = createInsertSchema(strategicTargetWeights).omit({ id: true, generatedAt: true });
export type InsertStrategicTargetWeights = z.infer<typeof insertStrategicTargetWeightsSchema>;
export type StrategicTargetWeights = typeof strategicTargetWeights.$inferSelect;

// ── Quant Model Registry (Retraining Pipeline) ──

export const quantModelRegistry = pgTable("quant_model_registry", {
  id: serial("id").primaryKey(),
  modelName: text("model_name").notNull(),
  version: text("version").notNull(),
  modelType: text("model_type").notNull(),
  trainingDate: timestamp("training_date").defaultNow().notNull(),
  validationScore: real("validation_score"),
  backtestSharpe: real("backtest_sharpe"),
  status: text("status").notNull().default("candidate"),
  artifactData: jsonb("artifact_data"),
  trainingConfig: jsonb("training_config"),
  performanceMetrics: jsonb("performance_metrics"),
  promotedAt: timestamp("promoted_at"),
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quant_model_registry_name_version").on(table.modelName, table.version),
  index("idx_quant_model_registry_status").on(table.status),
  index("idx_quant_model_registry_type").on(table.modelType),
]);

export const insertQuantModelRegistrySchema = createInsertSchema(quantModelRegistry).omit({ id: true, createdAt: true });
export type InsertQuantModelRegistry = z.infer<typeof insertQuantModelRegistrySchema>;
export type QuantModelRegistry = typeof quantModelRegistry.$inferSelect;

// ── Quant Retraining Log (Audit Trail) ──

export const quantRetrainingLog = pgTable("quant_retraining_log", {
  id: serial("id").primaryKey(),
  modelName: text("model_name").notNull(),
  oldVersion: text("old_version"),
  newVersion: text("new_version"),
  status: text("status").notNull(),
  validationScore: real("validation_score"),
  backtestSharpe: real("backtest_sharpe"),
  promotionStatus: text("promotion_status"),
  trainingDurationMs: integer("training_duration_ms"),
  errorMessage: text("error_message"),
  metrics: jsonb("metrics"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quant_retraining_log_model").on(table.modelName),
  index("idx_quant_retraining_log_status").on(table.status),
  index("idx_quant_retraining_log_created").on(table.createdAt),
]);

export const insertQuantRetrainingLogSchema = createInsertSchema(quantRetrainingLog).omit({ id: true, createdAt: true });
export type InsertQuantRetrainingLog = z.infer<typeof insertQuantRetrainingLogSchema>;
export type QuantRetrainingLog = typeof quantRetrainingLog.$inferSelect;

// ── Quant Scheduler Distributed Locks ──

export const quantSchedulerLocks = pgTable("quant_scheduler_locks", {
  lockKey: text("lock_key").primaryKey(),
  lockedBy: text("locked_by").notNull(),
  acquiredAt: timestamp("acquired_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  heartbeatAt: timestamp("heartbeat_at").defaultNow().notNull(),
});

// ── Quant Scheduler State (Daily Cap, Backoff, Observability) ──

export const quantSchedulerState = pgTable("quant_scheduler_state", {
  id: serial("id").primaryKey(),
  lockKey: text("lock_key").notNull().unique(),
  dailyCount: integer("daily_count").default(0).notNull(),
  dailyCountDate: text("daily_count_date").notNull(),
  consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
  lastAttemptAt: timestamp("last_attempt_at"),
  lastSuccessAt: timestamp("last_success_at"),
  backoffUntil: timestamp("backoff_until"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quant_scheduler_state_key").on(table.lockKey),
]);

// ── Quant Transition Log (Transition Optimizer Audit Trail) ──

export const quantTransitionLog = pgTable("quant_transition_log", {
  id: serial("id").primaryKey(),
  portfolioId: text("portfolio_id"),
  turnover: real("turnover").notNull(),
  maxWeight: real("max_weight").notNull(),
  sectorExposure: jsonb("sector_exposure").$type<Record<string, number>>(),
  categoryExposure: jsonb("category_exposure").$type<Record<string, number>>(),
  gammaUsed: real("gamma_used").notNull(),
  lambdaUsed: real("lambda_used"),
  filteredCount: integer("filtered_count").default(0),
  constraintsApplied: text("constraints_applied").array(),
  weightsSnapshot: jsonb("weights_snapshot").$type<Record<string, number>>(),
  previousWeights: jsonb("previous_weights").$type<Record<string, number>>(),
  sharpeRatio: real("sharpe_ratio"),
  portfolioReturn: real("portfolio_return"),
  portfolioVolatility: real("portfolio_volatility"),
  escalationRounds: integer("escalation_rounds").default(0),
  modelVersion: text("model_version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quant_transition_log_portfolio").on(table.portfolioId),
  index("idx_quant_transition_log_created").on(table.createdAt),
]);

// ── Instrument Prices (Time-Series Architecture - Daily + Historical) ──

export const instrumentPrices = pgTable("instrument_prices", {
  id: serial("id").primaryKey(),
  instrumentId: varchar("instrument_id").notNull().references(() => listedStocks.id),
  priceDate: date("price_date").notNull(),
  openPrice: decimal("open_price", { precision: 15, scale: 2 }),
  highPrice: decimal("high_price", { precision: 15, scale: 2 }),
  lowPrice: decimal("low_price", { precision: 15, scale: 2 }),
  closePrice: decimal("close_price", { precision: 15, scale: 2 }).notNull(),
  adjClose: decimal("adj_close", { precision: 15, scale: 2 }),
  volume: decimal("volume", { precision: 20, scale: 0 }),
  changePercent: decimal("change_percent", { precision: 10, scale: 4 }),
  source: varchar("source").default("fmp"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_unique_instrument_price").on(table.instrumentId, table.priceDate),
  index("idx_instrument_prices_date").on(table.priceDate),
  index("idx_instrument_prices_instrument").on(table.instrumentId),
]);

export type InstrumentPrice = typeof instrumentPrices.$inferSelect;
export type InsertInstrumentPrice = typeof instrumentPrices.$inferInsert;

// ── Enrichment Job Log (Audit trail for daily + historical pipelines) ──

export const enrichmentJobLog = pgTable("enrichment_job_log", {
  id: serial("id").primaryKey(),
  jobType: varchar("job_type", { length: 50 }).notNull(),
  instrumentId: varchar("instrument_id"),
  symbol: varchar("symbol"),
  status: varchar("status", { length: 20 }).notNull(),
  message: text("message"),
  recordsProcessed: integer("records_processed").default(0),
  executedAt: timestamp("executed_at").defaultNow(),
}, (table) => [
  index("idx_enrichment_job_log_type").on(table.jobType),
  index("idx_enrichment_job_log_status").on(table.status),
  index("idx_enrichment_job_log_executed").on(table.executedAt),
]);

export type EnrichmentJobLog = typeof enrichmentJobLog.$inferSelect;

// ── Enrichment Retry Queue (Failed instruments for retry with cap) ──

export const enrichmentRetryQueue = pgTable("enrichment_retry_queue", {
  id: serial("id").primaryKey(),
  instrumentId: varchar("instrument_id").notNull().references(() => listedStocks.id),
  symbol: varchar("symbol"),
  jobType: varchar("job_type", { length: 50 }).notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  maxRetries: integer("max_retries").default(5).notNull(),
  lastError: text("last_error"),
  nextRetryAt: timestamp("next_retry_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("idx_retry_queue_instrument").on(table.instrumentId),
  index("idx_retry_queue_job_type").on(table.jobType),
  index("idx_retry_queue_next_retry").on(table.nextRetryAt),
]);

export type EnrichmentRetryQueueEntry = typeof enrichmentRetryQueue.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// SEBI 2026 CIRCULAR COMPLIANCE — MF TAXONOMY & COMPLIANCE TABLES
// Implements: SEBI circular on Fund Categorisation (Feb 26, 2026)
// ═══════════════════════════════════════════════════════════════════════════

// ── SEBI Taxonomy Versions — version-controlled circular references ──

// ── Price Audit Log — immutable record of every change / override ──
export const priceAuditLog = pgTable("price_audit_log", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  priceDate: date("price_date").notNull(),
  oldPrice: decimal("old_price", { precision: 20, scale: 6 }),
  newPrice: decimal("new_price", { precision: 20, scale: 6 }).notNull(),
  oldSource: varchar("old_source", { length: 50 }),
  newSource: varchar("new_source", { length: 50 }).notNull(),
  changeReason: text("change_reason").notNull(),
  changedBy: varchar("changed_by", { length: 100 }).notNull().default("system"),
  confidenceScore: integer("confidence_score"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_price_audit_isin").on(table.isin),
  index("idx_price_audit_date").on(table.priceDate),
  index("idx_price_audit_created").on(table.createdAt),
]);

export type PriceAuditEntry = typeof priceAuditLog.$inferSelect;
export type InsertPriceAuditEntry = typeof priceAuditLog.$inferInsert;

// ── Corporate Actions Engine ──────────────────────────────────────────────────
// Tracks splits, bonus issues, dividends, rights, mergers.
// Drives split-adjusted price corrections in golden_prices time-series.
export const corporateActions = pgTable("corporate_actions", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 50 }),
  actionType: varchar("action_type", { length: 50 }).notNull(), // SPLIT, BONUS, DIVIDEND, RIGHTS, MERGER, DEMERGER, BUYBACK
  exDate: date("ex_date").notNull(),
  recordDate: date("record_date"),
  payDate: date("pay_date"),
  ratio: varchar("ratio", { length: 30 }), // e.g. "2:1" for 2-for-1 split
  adjustmentFactor: decimal("adjustment_factor", { precision: 15, scale: 8 }), // e.g. 0.5 for 2:1 split; multiply historical prices by this
  dividendAmount: decimal("dividend_amount", { precision: 15, scale: 4 }), // per share amount for cash dividends
  purpose: text("purpose"), // raw text from NSE (e.g. "SPLIT RS 10/- TO RS 5/-")
  isAppliedToGoldenPrices: boolean("is_applied_to_golden_prices").default(false),
  appliedAt: timestamp("applied_at"),
  source: varchar("source", { length: 50 }).default("NSE"),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_corp_actions_isin").on(table.isin),
  index("idx_corp_actions_ex_date").on(table.exDate),
  index("idx_corp_actions_type").on(table.actionType),
  index("idx_corp_actions_applied").on(table.isAppliedToGoldenPrices),
  uniqueIndex("idx_corp_actions_isin_ex_type").on(table.isin, table.exDate, table.actionType),
]);

export type CorporateAction = typeof corporateActions.$inferSelect;
export type InsertCorporateAction = typeof corporateActions.$inferInsert;
export const insertCorporateActionSchema = createInsertSchema(corporateActions).omit({ id: true, createdAt: true, updatedAt: true });

// ── Price Adjustments Log — immutable audit of every split/bonus adjustment ──
// Records the original vs adjusted price for each golden_prices row touched.
export const priceAdjustments = pgTable("price_adjustments", {
  id: serial("id").primaryKey(),
  corporateActionId: integer("corporate_action_id").notNull(),
  isin: varchar("isin", { length: 20 }).notNull(),
  priceDate: date("price_date").notNull(),
  originalPrice: decimal("original_price", { precision: 20, scale: 6 }).notNull(),
  adjustedPrice: decimal("adjusted_price", { precision: 20, scale: 6 }).notNull(),
  adjustmentFactor: decimal("adjustment_factor", { precision: 15, scale: 8 }).notNull(),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
}, (table) => [
  index("idx_price_adj_isin").on(table.isin),
  index("idx_price_adj_corp_action").on(table.corporateActionId),
  index("idx_price_adj_date").on(table.priceDate),
]);

export type PriceAdjustment = typeof priceAdjustments.$inferSelect;
export type InsertPriceAdjustment = typeof priceAdjustments.$inferInsert;
export const insertPriceAdjustmentSchema = createInsertSchema(priceAdjustments).omit({ id: true, appliedAt: true });

// ── Symbol Mapping Engine — multi-provider identifier translation ─────────────
// Maps ISIN to provider-specific symbols: NSE symbol, BSE scrip code,
// Bloomberg ticker, Probe42 ID, Reuters RIC, AMFI scheme code, etc.
// Single source of truth for cross-provider symbol resolution.
export const symbolMapping = pgTable("symbol_mapping", {
  id: serial("id").primaryKey(),
  isin: varchar("isin", { length: 20 }).notNull(),
  provider: varchar("provider", { length: 50 }).notNull(), // NSE, BSE, BLOOMBERG, PROBE42, REUTERS, SCREENER, AMFI, FMP
  providerSymbol: varchar("provider_symbol", { length: 100 }).notNull(),
  providerName: text("provider_name"), // human-readable company/fund name from that provider
  isPrimary: boolean("is_primary").default(false), // true = preferred identifier for this provider
  isActive: boolean("is_active").default(true),
  lastVerifiedAt: timestamp("last_verified_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_symbol_mapping_isin").on(table.isin),
  index("idx_symbol_mapping_provider").on(table.provider),
  index("idx_symbol_mapping_symbol").on(table.providerSymbol),
  uniqueIndex("idx_symbol_mapping_isin_provider").on(table.isin, table.provider),
]);


// ── Credit Ratings Layer — full history of rating changes per ISIN ───────────
// Stores each rating event (Assigned / Affirmed / Upgraded / Downgraded).
// is_current=true marks the latest active rating. Seeded from corporate_bonds.
// Required by SEBI PMS/AIF for recording rating at time of investment.

// ── AI Prompt Version Audit Table ────────────────────────────────────────────
// Immutable log of which prompt version was used for each AI interaction.
// Supports SEBI/RBI compliance audits and prompt governance.


// ── IRIS Session Store ────────────────────────────────────────────────────────
// Persists the KFintech IRIS JWT across server restarts (Railway container recycles).
// Single-row table: only the latest token is kept.
export const irisSessions = pgTable("iris_sessions", {
  id: serial("id").primaryKey(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  refreshedAt: timestamp("refreshed_at").defaultNow().notNull(),
});
export type IrisSession = typeof irisSessions.$inferSelect;
export const insertIrisSessionSchema = createInsertSchema(irisSessions).omit({ id: true });

// ── LRS Remittance Log ────────────────────────────────────────────────────────
// Per-user annual LRS utilisation log. Populated on every Alpaca ACH transfer approval.
export const lrsRemittanceLogs = pgTable("lrs_remittance_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  alpacaAccountId: varchar("alpaca_account_id"),
  transferId: varchar("transfer_id").unique(), // Alpaca transfer UUID — prevents double-counting
  amountUsd: decimal("amount_usd", { precision: 15, scale: 2 }).notNull(),
  amountInr: decimal("amount_inr", { precision: 15, scale: 2 }),
  usdInrRate: decimal("usd_inr_rate", { precision: 10, scale: 4 }),
  financialYear: varchar("financial_year", { length: 7 }).notNull(), // e.g. "2024-25"
  purpose: varchar("purpose", { length: 100 }).default("S0001"), // RBI purpose code
  transferDate: timestamp("transfer_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_lrs_logs_user_fy").on(table.userId, table.financialYear),
  index("idx_lrs_logs_transfer").on(table.transferId),
]);
export type LrsRemittanceLog = typeof lrsRemittanceLogs.$inferSelect;
export const insertLrsRemittanceLogSchema = createInsertSchema(lrsRemittanceLogs).omit({ id: true, createdAt: true });

// ── AMFI Distributor Registry (GAP-1: Live ARN/EUIN validation) ───────────────
// Synced daily from AMFI bulk download / KFintech Iris distributor API.
// Replaces hardcoded test-ARN list in amfi-validation-service.ts.
// AMFI Regulatory Ref: Circular 135/BP/22/2018-19 — ARN renewal mandatory every 3 years.
export const amfiDistributors = pgTable("amfi_distributors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  arnCode: varchar("arn_code", { length: 20 }).notNull().unique(),    // e.g. ARN-123456
  euinNumber: varchar("euin_number", { length: 20 }).unique(),        // e.g. E123456
  distributorName: varchar("distributor_name", { length: 255 }),
  distributorType: varchar("distributor_type", { length: 50 }),       // 'individual' | 'corporate'
  status: varchar("status", { length: 20 }).notNull().default('active'), // 'active' | 'lapsed' | 'suspended'
  arnExpiryDate: timestamp("arn_expiry_date"),
  registrationDate: timestamp("registration_date"),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  email: varchar("email", { length: 255 }),
  mobile: varchar("mobile", { length: 15 }),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_amfi_distributors_arn").on(table.arnCode),
  index("idx_amfi_distributors_euin").on(table.euinNumber),
  index("idx_amfi_distributors_status").on(table.status),
]);
export type AmfiDistributor = typeof amfiDistributors.$inferSelect;
export const insertAmfiDistributorSchema = createInsertSchema(amfiDistributors).omit({ id: true, createdAt: true, updatedAt: true });

// ── Aadhaar Consent Artifacts (H-7: UIDAI per-verification consent log) ────────
// UIDAI mandates explicit, purpose-specific, timestamped consent stored per
// every Aadhaar OTP authentication. This table is auditable by UIDAI.
// Ref: UIDAI Guidelines for Authentication User Agencies (AUA), §5.3

// ─── FintekPro CA Registry ─────────────────────────────────────────────────────
//
// Local cache of verified ICAI membership records. Built organically through:
//  1. CA self-registration on FintekPro partner portal
//  2. Upsert on every successful Surepass/Karza/scraper verification
//  3. Admin manual seeding
//
// Benefits:
//  - Layer 1 lookup before any paid API call (85%+ cache hit once 500+ CAs registered)
//  - Enables CA discovery marketplace (find CA by city/specialization/availability)
//  - Powers CA tier system (Bronze → Elite) based on verified track record
//  - Annual revalidation via cron (nextRevalidationDue field)
//
// Design: one record per unique ICAI number.
// isFintekProPartner = true → CA has completed full partner onboarding.
// isFintekProPartner = false → ICAI record cached for lookup only (not yet a partner).

export const fintekproCaRegistry = pgTable("fintekpro_ca_registry", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // ── ICAI Identity ──────────────────────────────────────────────────────────
  icaiMembershipNumber: varchar("icai_membership_number", { length: 20 }).notNull().unique(),
  nameAtIcai: varchar("name_at_icai", { length: 255 }),
  membershipType: varchar("membership_type", { length: 10 }),   // ACA | FCA
  membershipStatus: varchar("membership_status", { length: 20 }), // ACTIVE | INACTIVE
  copStatus: varchar("cop_status", { length: 20 }),             // ACTIVE | INACTIVE | NOT_APPLICABLE

  // ── FintekPro Partner Link ─────────────────────────────────────────────────
  isFintekProPartner: boolean("is_fintekpro_partner").default(false),
  partnersTableId: varchar("partners_table_id"),                // FK → partners.id (set when CA completes onboarding)
  userId: varchar("user_id"),                                   // FK → users.id (set when CA creates platform account)

  // ── CA Partner Profile (populated on full partner onboarding) ─────────────
  firmName: varchar("firm_name", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  specializations: jsonb("specializations"),                    // ["ITR", "GST", "Audit", "Form15CB", "FEMA"]
  experienceYears: integer("experience_years"),
  availability: varchar("availability", { length: 20 }).default("unknown"), // available | busy | on_leave | unknown
  maxCasesPerMonth: integer("max_cases_per_month"),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
  totalCasesCompleted: integer("total_cases_completed").default(0),
  responseTimeHours: integer("response_time_hours"),            // SLA in hours (4 | 12 | 24 | 48)

  // ── Tier System ───────────────────────────────────────────────────────────
  // Bronze: ICAI verified, <2yr   Silver: 2yr+ + 20 cases   Gold: FCA, 5yr+, 4.5★   Elite: 10yr+ firm
  tier: varchar("tier", { length: 20 }).default("bronze"),     // bronze | silver | gold | elite
  tierUpgradedAt: timestamp("tier_upgraded_at"),

  // ── Referral System ───────────────────────────────────────────────────────
  referralCode: varchar("referral_code", { length: 20 }).unique(), // Unique code for CA to invite clients / other CAs
  referredByCode: varchar("referred_by_code", { length: 20 }),     // Code used when this CA joined
  referralCount: integer("referral_count").default(0),             // Number of successful referrals made

  // ── Verification Audit ────────────────────────────────────────────────────
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by", { length: 50 }),           // surepass | karza | icai_scraper | admin | self
  confidenceScore: decimal("confidence_score", { precision: 4, scale: 2 }), // 0.00–1.00
  verificationSource: varchar("verification_source", { length: 50 }), // duplicates verifiedBy for clarity
  rawVerificationResponse: jsonb("raw_verification_response"),   // Sanitised API response stored for audit

  // ── Annual Revalidation ───────────────────────────────────────────────────
  lastRevalidatedAt: timestamp("last_revalidated_at"),
  nextRevalidationDue: timestamp("next_revalidation_due"),       // Cron checks this; 12 months after lastRevalidatedAt
  revalidationFailureCount: integer("revalidation_failure_count").default(0),
  revalidationStatus: varchar("revalidation_status", { length: 20 }).default("ok"), // ok | due | failed | suspended

  // ── Source Tracking ───────────────────────────────────────────────────────
  source: varchar("source", { length: 30 }).default("self_registered"), // self_registered | admin_seeded | auto_cache
  isPubliclyListed: boolean("is_publicly_listed").default(false), // Show in CA discovery marketplace
  listedAt: timestamp("listed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ca_registry_icai").on(table.icaiMembershipNumber),
  index("idx_ca_registry_partner").on(table.partnersTableId),
  index("idx_ca_registry_user").on(table.userId),
  index("idx_ca_registry_city_state").on(table.city, table.state),
  index("idx_ca_registry_tier").on(table.tier),
  index("idx_ca_registry_revalidation").on(table.nextRevalidationDue),
  index("idx_ca_registry_referral").on(table.referralCode),
]);

export type FintekproCaRegistry = typeof fintekproCaRegistry.$inferSelect;
export const insertFintekproCaRegistrySchema = createInsertSchema(fintekproCaRegistry).omit({
  id: true, createdAt: true, updatedAt: true,
});

// ─── Platform Global Configuration ───────────────────────────────────────────
//
// Dynamic configuration for revenue, commissions, and regulatory thresholds.
// Adjusted by super-admins via the Admin Panel. Changes take effect immediately.

export const platformConfig = pgTable("platform_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // ── CA Marketplace Revenue Model ──────────────────────────────────────────
  caPlatformFeePct: decimal("ca_platform_fee_pct", { precision: 5, scale: 2 }).default("10.00"),
  caReferralBonusPct: decimal("ca_referral_bonus_pct", { precision: 5, scale: 2 }).default("5.00"),
  
  // ── Commissions & Payouts ──────────────────────────────────────────────────
  defaultCommissionStrategy: varchar("default_commission_strategy", { length: 50 }).default("standard_waterfall"),
  autoApproveCommissionsBelow: decimal("auto_approve_commissions_below", { precision: 12, scale: 2 }).default("500.00"),
  
  // ── Global Operational Flags ────────────────────────────────────────────────
  isCaMarketplaceActive: boolean("is_ca_marketplace_active").default(true),
  enableAiAlphaRecommendations: boolean("enable_ai_alpha_recommendations").default(true),
  enforceStrictSuitability: boolean("enforce_strict_suitability").default(false), // Soft-gate by default
  
  // ── Gateway Rooting (Iris/Alpaca) ──────────────────────────────────────────
  irisPartnerCode: varchar("iris_partner_code", { length: 50 }).default("FINTEKPRO"),
  alpacaReferrerCode: varchar("alpaca_referrer_code", { length: 50 }).default("fintekpro_app"),

  updatedBy: varchar("updated_by"), // admin user_id
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PlatformConfig = typeof platformConfig.$inferSelect;
export const insertPlatformConfigSchema = createInsertSchema(platformConfig).omit({
  id: true, createdAt: true, updatedAt: true,
});

// ─── Regulatory Audit Packs ──────────────────────────────────────────────────
// Consolidated snapshots of KYC, Suitability, and Order data for regulatory reviews.
export const regulatoryAuditPacks = pgTable("regulatory_audit_packs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  packType: varchar("pack_type").notNull(), // account_opening, order_placement, risk_update
  transactionId: varchar("transaction_id"), // Order ID or Application ID
  kycSnapshot: jsonb("kyc_snapshot").notNull(),
  suitabilitySnapshot: jsonb("suitability_snapshot").notNull(),
  orderSnapshot: jsonb("order_snapshot"),
  platformConfigSnapshot: jsonb("platform_config_snapshot"), // Record fees at time of transaction
  auditHash: text("audit_hash").notNull(), // Integrity check
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audit_pack_user").on(table.userId),
  index("idx_audit_pack_type").on(table.packType),
  index("idx_audit_pack_tx").on(table.transactionId),
]);

export const insertRegulatoryAuditPackSchema = createInsertSchema(regulatoryAuditPacks).omit({
  id: true, createdAt: true,
});
export type RegulatoryAuditPack = typeof regulatoryAuditPacks.$inferSelect;
export type InsertRegulatoryAuditPack = z.infer<typeof insertRegulatoryAuditPackSchema>;

// ─── Algo Trading Signal Engine ─────────────────────────────────────────────
// FASP-AI v1.0 compliant — Decision Support System only.
// Signals are suggestions; execution always requires explicit user approval.
export const algoSignals = pgTable("algo_signals", {
  id:                serial("id").primaryKey(),
  userId:            integer("user_id").references(() => users.id),
  symbol:            varchar("symbol", { length: 20 }).notNull(),
  companyName:       varchar("company_name", { length: 200 }),
  // "composite" | "sma_crossover" | "rsi" | "momentum"
  strategy:          varchar("strategy", { length: 50 }).notNull().default("composite"),
  // "buy" | "sell" | "watch" | "hold"
  signal:            varchar("signal", { length: 10 }).notNull(),
  confidenceScore:   integer("confidence_score").notNull(),          // 0–100
  suggestedQty:      decimal("suggested_qty",      { precision: 18, scale: 6 }),
  suggestedNotional: decimal("suggested_notional", { precision: 18, scale: 2 }), // USD
  entryPrice:        decimal("entry_price",         { precision: 18, scale: 4 }),
  targetPrice:       decimal("target_price",        { precision: 18, scale: 4 }),
  stopLossPrice:     decimal("stop_loss_price",     { precision: 18, scale: 4 }),
  // JSON: { sma20, sma50, rsi14, volumeRatio, momentum20d, currentPrice, ... }
  factors:           jsonb("factors"),
  modelVersion:      varchar("model_version", { length: 30 }).notNull().default("algo-v1.0"),
  riskProfile:       varchar("risk_profile", { length: 30 }),        // conservative | moderate | aggressive
  investmentHorizon: varchar("investment_horizon", { length: 20 }),  // short | medium | long
  // "pending" | "approved" | "rejected" | "expired"
  status:            varchar("status", { length: 20 }).notNull().default("pending"),
  approvedAt:        timestamp("approved_at"),
  rejectedAt:        timestamp("rejected_at"),
  orderId:           varchar("order_id", { length: 100 }),           // Alpaca order ID after execution
  disclaimer:        text("disclaimer"),
  expiresAt:         timestamp("expires_at"),                        // signals expire at NYSE close
  createdAt:         timestamp("created_at").defaultNow().notNull(),
  updatedAt:         timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_algo_signals_user").on(table.userId),
  index("idx_algo_signals_symbol").on(table.symbol),
  index("idx_algo_signals_status").on(table.status),
  index("idx_algo_signals_created").on(table.createdAt),
]);

export const insertAlgoSignalSchema = createInsertSchema(algoSignals).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type AlgoSignal = typeof algoSignals.$inferSelect;
export type InsertAlgoSignal = typeof algoSignals.$inferInsert;

// Auto-added domain exports
export * from "./schema/agents.ts";
export * from "./schema/clients.ts";
export * from "./schema/partners.ts";
export * from "./schema/zoho.ts";
export * from "./schema/proposals.ts";
export * from "./schema/ai.ts";
export * from "./schema/loans.ts";
export * from "./schema/insurance.ts";
export * from "./schema/itr.ts";
export * from "./schema/bonds.ts";
export * from "./schema/unlisted.ts";
export * from "./schema/screener.ts";
export * from "./schema/documents.ts";
export * from "./schema/mca.ts";
export * from "./schema/family.ts";
export * from "./schema/portfolio.ts";
export * from "./schema/users.ts";
export * from "./schema/products.ts";
export * from "./schema/commissions.ts";
export * from "./schema/orders.ts";
export * from "./schema/kyc.ts";
export * from "./schema/advisory.ts";
export * from "./schema/banking.ts";
export * from "./schema/treasury.ts";
export * from "./schema/market-data.ts";
export * from "./schema/mutual-funds.ts";
export * from "./schema/reit-invit.ts";
export * from "./schema/cart.ts";
export * from "./schema/crm.ts";
export * from "./schema/enums.ts";
export * from "./schema/ib.ts";
export * from "./schema/mpal.ts";
export * from "./schema/b2b.ts";
export * from "./schema/alpaca-config.ts";

// Zod schemas for Admin items
export const insertAdminSettingsSchema = createInsertSchema(adminSettings).omit({ id: true, updatedAt: true });

export const insertAdminApprovalRequestSchema = createInsertSchema(adminApprovalRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type AdminApprovalRequest = typeof adminApprovalRequests.$inferSelect;
export type InsertAdminApprovalRequest = z.infer<typeof insertAdminApprovalRequestSchema>;

// ─── IRIS Loan Against Securities / Mutual Funds (LAS/LAMF) ─────────────────

/**
 * Tracks MF folio and demat securities pledges initiated via IRIS KFintech API.
 * Created on pledge initiation, updated through its lifecycle.
 */
export const irisLasPledges = pgTable("iris_las_pledges", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 }).notNull(),
  pan: varchar("pan", { length: 10 }).notNull(),
  pledgeType: varchar("pledge_type", { length: 20 }).notNull(), // 'mutual_fund' | 'securities'
  irisPledgeId: varchar("iris_pledge_id", { length: 100 }), // IRIS-assigned pledge reference
  pledgeStatus: varchar("pledge_status", { length: 30 }).notNull().default("pending"),
  // 'pending' | 'initiated' | 'active' | 'released' | 'failed'
  folioDetails: jsonb("folio_details"), // Array of { folioNo, schemeCode, units, currentNav, pledgedValue }
  securitiesDetails: jsonb("securities_details"), // Array of { isin, symbol, quantity, currentPrice, pledgedValue }
  totalPledgedValue: decimal("total_pledged_value", { precision: 18, scale: 2 }),
  maxLoanEligible: decimal("max_loan_eligible", { precision: 18, scale: 2 }),
  loanToValueRatio: decimal("loan_to_value_ratio", { precision: 5, scale: 2 }), // e.g. 0.60 = 60%
  irisResponse: jsonb("iris_response"), // Raw IRIS API response (for audit)
  agentId: varchar("agent_id", { length: 36 }),
  source: varchar("source", { length: 20 }).notNull().default("api"), // 'api' | 'agent' | 'system'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIrisLasPledgeSchema = createInsertSchema(irisLasPledges).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type IrisLasPledge = typeof irisLasPledges.$inferSelect;
export type InsertIrisLasPledge = typeof irisLasPledges.$inferInsert;

/**
 * Tracks LAS/LAMF loan applications and disbursements via IRIS KFintech API.
 * Each loan is linked to a pledge in irisLasPledges.
 */
export const irisLasLoans = pgTable("iris_las_loans", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id", { length: 36 }).notNull(),
  pan: varchar("pan", { length: 10 }).notNull(),
  pledgeId: varchar("pledge_id", { length: 36 }), // FK → irisLasPledges.id (local)
  irisPledgeId: varchar("iris_pledge_id", { length: 100 }), // IRIS pledge reference
  irisLoanId: varchar("iris_loan_id", { length: 100 }), // IRIS-assigned loan ID
  loanType: varchar("loan_type", { length: 30 }).notNull(), // 'against_mutual_funds' | 'against_securities'
  loanStatus: varchar("loan_status", { length: 30 }).notNull().default("applied"),
  // 'applied' | 'under_review' | 'sanctioned' | 'disbursed' | 'active' | 'closed' | 'rejected'
  requestedAmount: decimal("requested_amount", { precision: 18, scale: 2 }).notNull(),
  sanctionedAmount: decimal("sanctioned_amount", { precision: 18, scale: 2 }),
  disbursedAmount: decimal("disbursed_amount", { precision: 18, scale: 2 }),
  outstandingAmount: decimal("outstanding_amount", { precision: 18, scale: 2 }),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }), // Annual % e.g. 10.50
  tenure: integer("tenure"), // In months
  processingFee: decimal("processing_fee", { precision: 10, scale: 2 }),
  disbursementDate: timestamp("disbursement_date"),
  maturityDate: timestamp("maturity_date"),
  irisResponse: jsonb("iris_response"), // Raw IRIS API responses (audit trail)
  agentId: varchar("agent_id", { length: 36 }),
  engineVersion: varchar("engine_version", { length: 20 }).notNull().default("iris-las-v1"),
  calculationTimestamp: timestamp("calculation_timestamp").defaultNow(),
  source: varchar("source", { length: 20 }).notNull().default("api"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIrisLasLoanSchema = createInsertSchema(irisLasLoans).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type IrisLasLoan = typeof irisLasLoans.$inferSelect;
export type InsertIrisLasLoan = typeof irisLasLoans.$inferInsert;

// ── Goal Benchmark Mapping ─────────────────────────────────────────────────
// Used by GoalBenchmarkMapper service (proposal-builder) to select the right
// benchmark index for each goal type + risk profile + investment horizon combo.
// Table is also seeded via schema-repairs.ts ON CONFLICT DO NOTHING.
export const goalBenchmarkMapping = pgTable('goal_benchmark_mapping', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  goalType:           varchar('goal_type',           { length: 50 }).notNull(),
  riskProfile:        varchar('risk_profile',         { length: 30 }).notNull(),
  benchmarkIndex:     varchar('benchmark_index',      { length: 100 }),
  benchmarkCode:      varchar('benchmark_code',       { length: 50 }).notNull(),
  benchmarkName:      varchar('benchmark_name',       { length: 200 }).notNull(),
  benchmarkRationale: text('benchmark_rationale'),
  horizonYearsMin:    integer('horizon_years_min'),
  horizonYearsMax:    integer('horizon_years_max'),
  isDefault:          boolean('is_default').default(true),
  isActive:           boolean('is_active').default(true),
  overriddenBy:       varchar('overridden_by'),
  overriddenAt:       timestamp('overridden_at'),
  description:        text('description'),
  createdAt:          timestamp('created_at').defaultNow(),
  updatedAt:          timestamp('updated_at').defaultNow(),
});

export const insertGoalBenchmarkMappingSchema = createInsertSchema(goalBenchmarkMapping).omit({
  id: true, createdAt: true, updatedAt: true,
});
export type GoalBenchmarkMappingRow = typeof goalBenchmarkMapping.$inferSelect;
export type InsertGoalBenchmarkMapping = typeof goalBenchmarkMapping.$inferInsert;

