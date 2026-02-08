import { type User, type UpsertUser, type Portfolio, type InsertPortfolio, type PortfolioHolding, type InsertPortfolioHolding, type Watchlist, type InsertWatchlist, type MarketData, type AssetAllocation, type InsertAssetAllocation, type MutualFund, type InsertMutualFund, type OtpVerification, type InsertOtpVerification, type UserProfile, type InsertUserProfile, type CapitalGainsReport, type InsertCapitalGainsReport, type TransactionReport, type InsertTransactionReport, type TransactionRecord, type InsertTransactionRecord, type CustomerCareAgent, type InsertCustomerCareAgent, type AgentPartnerMapping, type InsertAgentPartnerMapping, type CkycRecord, type InsertCkycRecord, type CkycDocument, type InsertCkycDocument, type CkycStatusHistory, type InsertCkycStatusHistory, type ClientAgentRelationship, type InsertClientAgentRelationship, type InvestmentProposal, type InsertInvestmentProposal, type InvestmentProposalItem, type InsertInvestmentProposalItem, type ProposalPayment, type InsertProposalPayment, type IBAccount, type InsertIBAccount, type IBOrder, type InsertIBOrder, type IBPosition, type InsertIBPosition, type IBAccountSummary, type InsertIBAccountSummary, type IBMarketDataSubscription, type InsertIBMarketDataSubscription, type IBTradingSession, type InsertIBTradingSession, type Partner, type InsertPartner, type Agent, type InsertAgent, type Supplier, type InsertSupplier, type EpfHolding, type PpfHolding, type EpsHolding, type GovernmentSchemeConsent, type InsertGovernmentSchemeConsent, type InsuranceHolding, type InsertInsuranceHolding, type UserBankAccount, type InsertUserBankAccount, type UserDematAccount, type InsertUserDematAccount, type AchievementCategory, type InsertAchievementCategory, type Achievement, type InsertAchievement, type UserAchievement, type InsertUserAchievement, type LearningProgress, type InsertLearningProgress, type SocialShare, type InsertSocialShare, type FinancialGoal, type InsertFinancialGoal, type TaxDocument, type InsertTaxDocument, type ExternalHolding, type InsertExternalHolding, type StructuredTaxData, type InsertStructuredTaxData, type UserAlert, type InsertUserAlert, type AlertHistory, type InsertAlertHistory, type AlertTemplate, type InsertAlertTemplate, type FamilyGroup, type InsertFamilyGroup, type FamilyMember, type InsertFamilyMember, type FamilyGoal, type InsertFamilyGoal, type FamilyGoalContribution, type InsertFamilyGoalContribution, type FamilyActivityLog, type InsertFamilyActivityLog, type FamilyDiscussion, type InsertFamilyDiscussion, type FamilyBudget, type InsertFamilyBudget, type FamilyPortfolioPermission, type InsertFamilyPortfolioPermission, type TaxCalculation, type InsertTaxCalculation, type TaxDocumentAccessLog, type InsertTaxDocumentAccessLog, type TaxSession, type InsertTaxSession, type TaxDataSource, type InsertTaxDataSource, type ValidationIssue, type InsertValidationIssue, type FilingRecord, type InsertFilingRecord, type AiOptimizationSuggestion, type InsertAiOptimizationSuggestion, type FundExtended, type Provenance, type FundSearchParams, type FundListResponse, type SourceStatus, type MultiSourceStatus, type LoanProduct, type InsertLoanProduct, type LoanProvider, type InsertLoanProvider, type ProviderProduct, type InsertProviderProduct, type CreditProfile, type InsertCreditProfile, type LoanRequest, type InsertLoanRequest, type LoanOffer, type InsertLoanOffer, type LoanApplicationMarketplace, type InsertLoanApplicationMarketplace, type ProviderIntegration, type InsertProviderIntegration, type PartnerApplicationDocument, type InsertPartnerApplicationDocument, type InvestmentIdea, type InsertInvestmentIdea, type InvestmentIdeaTracking, type InsertInvestmentIdeaTracking, type InvestmentIdeaAlert, type InsertInvestmentIdeaAlert, type YieldTracker, type InsertYieldTracker, type PartnerApplication, type InsertPartnerApplication, type TaxRule, type InsertTaxRule, type TaxReminderSubscription, type InsertTaxReminderSubscription, type CapitalGainsTaxReminder, type InsertCapitalGainsTaxReminder, type UserExpense, type InsertUserExpense, type UserBudget, type InsertUserBudget, type ExpenseInsight, type InsertExpenseInsight, type FinancialObligation, type InsertFinancialObligation, type NpsAccount, type ApyAccount, type ClientTask, type InsertClientTask } from "@shared/schema";
import { type CashfreeTransaction, type InsertCashfreeTransaction, type PhonePeTransaction, type InsertPhonePeTransaction, type AgentDocument, type InsertAgentDocument, type AgentCommissionSplit, type InsertAgentCommissionSplit, type AgentCommission, type InsertAgentCommission, type AmfiVerificationLog, type InsertAmfiVerificationLog } from "@shared/schema";
import { type Product, type InsertProduct, type ApplicationDocument, type InsertApplicationDocument, type ProductAccountPreference, type InsertProductAccountPreference, type ICICILoanApplication, type InsertICICILoanApplication, type ICICICreditScore, type InsertICICICreditScore, type PortfolioComparison, type InsertPortfolioComparison, type ChatSession, type InsertChatSession, type ChatMessage, type InsertChatMessage, type ChatAction, type InsertChatAction, type ChatFunction, type InsertChatFunction, type CurrencyRate, type InsertCurrencyRate, type CkycNotificationTrigger, type InsertCkycNotificationTrigger, type KycVerificationSession, type InsertKycVerificationSession, type ManualKycSubmission, type InsertManualKycSubmission, type ManualKycDocument, type InsertManualKycDocument, type UnlistedCompany, type InsertUnlistedCompany, type CompanyFinancials, type InsertCompanyFinancials, type CompanyRatios, type InsertCompanyRatios, type UnlistedPriceHistory, type InsertUnlistedPriceHistory, type SellListing, type InsertSellListing, type BuyRequest, type InsertBuyRequest, type UnlistedDeal, type InsertUnlistedDeal, type Probe42SyncLog, type InsertProbe42SyncLog, type SupportTemplate, type InsertSupportTemplate, type SupportStep, type InsertSupportStep, type SupportStepComment, type InsertSupportStepComment, type UnifiedCartItem, type InsertUnifiedCartItem } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, or, desc, asc, gte, lte, like, ilike, sql, isNotNull, inArray } from "drizzle-orm";
import * as schema from "@shared/schema";
import { generateUniqueUserId } from "./auth";

// We'll import hashPassword later to avoid circular dependency

export interface IStorage {
  // User methods for mobile/email authentication
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  getUserByUserId(userId: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  deleteUser(id: string): Promise<boolean>;
  updateUserStatus(id: string, isActive: boolean): Promise<User | undefined>;
  
  // OTP verification methods
  createOtpVerification(otp: InsertOtpVerification): Promise<OtpVerification>;
  getOtpVerification(identifier: string, type: string): Promise<OtpVerification | undefined>;
  verifyOtp(identifier: string, type: string, otp: string): Promise<boolean>;
  cleanupExpiredOtps(): Promise<void>;
  
  // Password reset token methods
  createPasswordResetToken(userId: string, identifier: string, token: string): Promise<any>;
  getPasswordResetToken(userId: string, token: string): Promise<any | undefined>;
  markPasswordResetTokenAsUsed(id: string): Promise<boolean>;
  cleanupExpiredResetTokens(): Promise<void>;
  
  // Portfolio methods
  getPortfoliosByUserId(userId: string): Promise<Portfolio[]>;
  getPortfoliosByUserPan(panNumber: string): Promise<Portfolio[]>;
  getPortfolio(id: string): Promise<Portfolio | undefined>;
  getUserByPan(panNumber: string): Promise<User | undefined>;

  // Government Scheme Holdings methods
  getEpfHoldings(userId: string): Promise<EpfHolding[]>;
  getPpfHoldings(userId: string): Promise<PpfHolding[]>;
  getEpsHoldings(userId: string): Promise<EpsHolding[]>;
  getNpsAccounts(userId: string): Promise<NpsAccount[]>;
  getApyAccounts(userId: string): Promise<ApyAccount[]>;
  
  
  // Financial Obligations methods
  getFinancialObligations(userId: string): Promise<FinancialObligation[]>;
  getFinancialObligationById(id: string): Promise<FinancialObligation | undefined>;
  createFinancialObligation(data: InsertFinancialObligation): Promise<FinancialObligation>;
  updateFinancialObligation(id: string, updates: Partial<FinancialObligation>): Promise<FinancialObligation | undefined>;
  deleteFinancialObligation(id: string): Promise<void>;
  deleteUserCibilObligations(userId: string): Promise<void>;
  // Insurance Holdings methods
  getInsuranceHoldings(userId: string): Promise<InsuranceHolding[]>;
  createInsuranceHolding(holding: InsertInsuranceHolding): Promise<InsuranceHolding>;
  updateInsuranceHolding(id: string, updates: Partial<InsuranceHolding>): Promise<InsuranceHolding | undefined>;
  
  // Government Scheme Consent methods
  checkGovernmentSchemeConsent(userId: string, panNumber: string, schemeType: string): Promise<boolean>;
  createGovernmentSchemeConsent(consent: InsertGovernmentSchemeConsent): Promise<GovernmentSchemeConsent>;
  getGovernmentSchemeConsents(userId: string, panNumber?: string): Promise<GovernmentSchemeConsent[]>;
  revokeGovernmentSchemeConsent(userId: string, panNumber: string, schemeType: string): Promise<boolean>;

  // PAN Verification Consent methods
  checkPanVerificationConsent(userId: string): Promise<boolean>;
  recordPanVerificationConsent(userId: string, ipAddress: string, userAgent: string): Promise<void>;
  createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio>;
  updatePortfolio(id: string, updates: Partial<Portfolio>): Promise<Portfolio | undefined>;
  
  // Portfolio Holdings methods
  getPortfolioHoldings(portfolioId: string): Promise<PortfolioHolding[]>;
  createPortfolioHolding(holding: InsertPortfolioHolding): Promise<PortfolioHolding>;
  updatePortfolioHolding(id: string, updates: Partial<PortfolioHolding>): Promise<PortfolioHolding | undefined>;
  deletePortfolioHolding(id: string): Promise<boolean>;
  
  // External Holdings methods (for imported portfolios from Wealthy.in, etc.)
  getExternalHoldings(userId: string): Promise<ExternalHolding[]>;
  getExternalHoldingsBySource(userId: string, source: string): Promise<ExternalHolding[]>;
  createExternalHolding(holding: InsertExternalHolding): Promise<ExternalHolding>;
  deleteExternalHoldingsBySource(userId: string, source: string): Promise<number>;
  
  // Watchlist methods
  getWatchlistsByUserId(userId: string): Promise<Watchlist[]>;
  createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  
  // Market Data methods
  getMarketData(symbol: string): Promise<MarketData | undefined>;
  getMultipleMarketData(symbols: string[]): Promise<MarketData[]>;
  upsertMarketData(symbol: string, data: Partial<MarketData>): Promise<MarketData>;
  
  // Asset Allocation methods
  getAssetAllocation(portfolioId: string): Promise<AssetAllocation[]>;
  upsertAssetAllocation(allocation: InsertAssetAllocation): Promise<AssetAllocation>;
  
  // Portfolio Snapshots methods
  createPortfolioSnapshot(snapshot: any): Promise<any>;
  getPortfolioSnapshots(portfolioId: string, fromDate?: string, toDate?: string): Promise<any[]>;
  getPortfolioSnapshotByDate(portfolioId: string, date: string): Promise<any | undefined>;
  
  // Comprehensive Holdings methods
  createComprehensiveHolding(holding: any): Promise<any>;
  getComprehensiveHoldings(portfolioId: string, date?: string): Promise<any[]>;
  updateComprehensiveHolding(id: string, updates: any): Promise<any | undefined>;
  deleteComprehensiveHolding(id: string): Promise<boolean>;
  getComprehensiveHoldingsByUser(userId: string, date?: string): Promise<any[]>;
  
  // Portfolio Population methods
  populatePortfolioFromCams(userId: string, panNumber: string, date: string): Promise<any[]>;
  populatePortfolioFromKfintech(userId: string, panNumber: string, date: string): Promise<any[]>;
  populatePortfolioFromNsdl(userId: string, accountNumber: string, date: string): Promise<any[]>;
  populatePortfolioFromCdsl(userId: string, boId: string, date: string): Promise<any[]>;
  populateGovernmentSchemeHoldings(userId: string, date: string): Promise<any[]>;
  
  // Portfolio Rebalancing methods
  getRebalancingSuggestions(portfolioId: string): Promise<any>;
  
  // Mutual Fund methods
  getAllMutualFunds(): Promise<MutualFund[]>;
  getMutualFund(schemeCode: string): Promise<MutualFund | undefined>;
  upsertMutualFund(fund: InsertMutualFund): Promise<MutualFund>;
  searchMutualFunds(query: string): Promise<MutualFund[]>;
  
  
  // User Profile methods
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  
  // Admin methods
  getAllUsers(): Promise<User[]>;
  updateUserRole(userId: string, role: string): Promise<void>;
  
  // Enhanced portfolio analytics
  getPortfolioPerformance(portfolioId: string): Promise<any>;
  getPiChatSummaries(portfolioId: string): Promise<any[]>;
  getCommodityPrices(): Promise<any[]>;
  
  // Risk profiling methods
  createRiskProfile(profile: any): Promise<any>;
  updateRiskProfile(id: string, profile: any): Promise<any>;
  getRiskProfile(userId: string): Promise<any | undefined>;
  getAllRiskProfiles(): Promise<any[]>;
  deleteRiskProfile(id: string): Promise<void>;
  
  // Risk assessment questions
  createRiskAssessmentQuestion(question: any): Promise<any>;
  updateRiskAssessmentQuestion(id: string, question: any): Promise<any>;
  getRiskAssessmentQuestions(): Promise<any[]>;
  deleteRiskAssessmentQuestion(id: string): Promise<void>;
  
  // Reports methods
  createCapitalGainsReport(report: InsertCapitalGainsReport): Promise<CapitalGainsReport>;
  getCapitalGainsReports(userId?: string, financialYear?: string): Promise<CapitalGainsReport[]>;
  getCapitalGainsReport(id: string): Promise<CapitalGainsReport | undefined>;
  updateCapitalGainsReport(id: string, updates: Partial<CapitalGainsReport>): Promise<CapitalGainsReport | undefined>;
  
  createTransactionReport(report: InsertTransactionReport): Promise<TransactionReport>;
  getTransactionReports(userId?: string, financialYear?: string): Promise<TransactionReport[]>;
  getTransactionReport(id: string): Promise<TransactionReport | undefined>;
  updateTransactionReport(id: string, updates: Partial<TransactionReport>): Promise<TransactionReport | undefined>;
  
  createTransactionRecord(record: InsertTransactionRecord): Promise<TransactionRecord>;
  getTransactionRecords(reportId: string): Promise<TransactionRecord[]>;
  getTransactionRecordsByUser(userId: string, financialYear?: string): Promise<TransactionRecord[]>;
  
  // Customer Care Agent methods
  createCustomerCareAgent(agent: InsertCustomerCareAgent): Promise<CustomerCareAgent>;
  getAllCustomerCareAgents(): Promise<CustomerCareAgent[]>;
  getCustomerCareAgent(id: string): Promise<CustomerCareAgent | undefined>;
  updateCustomerCareAgent(id: string, updates: Partial<CustomerCareAgent>): Promise<CustomerCareAgent | undefined>;
  deleteCustomerCareAgent(id: string): Promise<boolean>;
  
  // Agent-Partner mapping methods
  createAgentPartnerMapping(mapping: InsertAgentPartnerMapping): Promise<AgentPartnerMapping>;
  getAgentPartnerMappings(agentId?: string, partnerId?: string): Promise<AgentPartnerMapping[]>;
  updateAgentPartnerMapping(id: string, updates: Partial<AgentPartnerMapping>): Promise<AgentPartnerMapping | undefined>;
  deleteAgentPartnerMapping(id: string): Promise<boolean>;
  
  // Agent mapping counts
  getAgentMappingCounts(agentId: string): Promise<{partnerCount: number, clientCount: number}>;

  // Achievement System Methods
  // Achievement Categories
  getAllAchievementCategories(): Promise<AchievementCategory[]>;
  createAchievementCategory(category: InsertAchievementCategory): Promise<AchievementCategory>;
  
  // Achievements
  getAllAchievements(): Promise<Achievement[]>;
  getAchievementsByCategory(categoryId: string): Promise<Achievement[]>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  updateAchievement(id: string, updates: Partial<Achievement>): Promise<Achievement | undefined>;
  
  // User Achievements
  getUserAchievements(userId: string): Promise<UserAchievement[]>;
  getUserAchievement(userId: string, achievementId: string): Promise<UserAchievement | undefined>;
  createUserAchievement(userAchievement: InsertUserAchievement): Promise<UserAchievement>;
  updateUserAchievementProgress(id: string, progress: number, metadata?: any): Promise<UserAchievement | undefined>;
  markAchievementCompleted(id: string): Promise<UserAchievement | undefined>;
  
  // Learning Progress Tracking
  recordLearningProgress(progress: InsertLearningProgress): Promise<LearningProgress>;
  getUserLearningProgress(userId: string, category?: string): Promise<LearningProgress[]>;
  
  // Social Sharing
  createSocialShare(share: InsertSocialShare): Promise<SocialShare>;
  getUserSocialShares(userId: string): Promise<SocialShare[]>;
  updateShareEngagement(id: string, engagementData: any): Promise<SocialShare | undefined>;
  
  // Achievement Analytics
  getUserAchievementStats(userId: string): Promise<{ totalPoints: number; completedAchievements: number; categories: Record<string, number> }>;
  getAchievementLeaderboard(limit?: number): Promise<Array<{ userId: string; totalPoints: number; completedAchievements: number; user?: User }>>;

  // CKYC (Central KYC Registry) methods
  getCkycRecord(userId: string): Promise<CkycRecord | undefined>;
  createCkycRecord(ckycRecord: InsertCkycRecord): Promise<CkycRecord>;
  updateCkycRecord(userId: string, updates: Partial<CkycRecord>): Promise<CkycRecord | undefined>;
  getAllCkycRecords(options?: { status?: string; page?: number; limit?: number }): Promise<CkycRecord[]>;

  // CKYC Document methods
  getCkycDocuments(userId: string): Promise<CkycDocument[]>;
  addCkycDocument(document: InsertCkycDocument): Promise<CkycDocument>;
  
  // CKYC Status History methods
  getCkycStatusHistory(userId: string): Promise<CkycStatusHistory[]>;
  addCkycStatusHistory(history: InsertCkycStatusHistory): Promise<CkycStatusHistory>;

  // CKYC Progress Monitoring methods
  createCkycNotificationTrigger(trigger: InsertCkycNotificationTrigger): Promise<CkycNotificationTrigger>;
  getCkycNotificationTriggers(ckycRecordId?: string, status?: string): Promise<any[]>;
  updateCkycNotificationStatus(id: string, status: string, sentAt?: Date, failureReason?: string): Promise<CkycNotificationTrigger | undefined>;

  // CKYC Progress Steps methods - temporarily commented due to schema inconsistencies
  // createCkycProgressStep(step: InsertCkycProgressStep): Promise<CkycProgressStep>;
  // getCkycProgressSteps(ckycRecordId: string): Promise<CkycProgressStep[]>;
  // updateCkycProgressStep(id: string, updates: Partial<CkycProgressStep>): Promise<CkycProgressStep | undefined>;
  
  // CKYC Action Log methods - temporarily commented due to schema inconsistencies
  // createCkycActionLog(log: InsertCkycActionLog): Promise<CkycActionLog>;
  // getCkycActionLogs(ckycRecordId?: string, actionBy?: string): Promise<CkycActionLog[]>;

  // CKYC Notification Service methods - temporarily commented due to schema inconsistencies
  // sendNotification(trigger: CkycNotificationTrigger): Promise<boolean>;
  // processPendingNotifications(): Promise<void>;

  // Client-Agent relationship methods for EUIN/ARN integration
  getClientAgentRelationships(clientId?: string, agentId?: string): Promise<ClientAgentRelationship[]>;
  getClientAgentRelationship(clientId: string, agentId: string): Promise<ClientAgentRelationship | undefined>;
  createClientAgentRelationship(relationship: InsertClientAgentRelationship): Promise<ClientAgentRelationship>;
  updateClientAgentRelationship(id: string, updates: Partial<ClientAgentRelationship>): Promise<ClientAgentRelationship | undefined>;
  deleteClientAgentRelationship(id: string): Promise<boolean>;
  getAgentForClient(clientId: string, relationshipType?: string): Promise<ClientAgentRelationship | undefined>;
  getClientsForAgent(agentId: string): Promise<ClientAgentRelationship[]>;
  autoAssignDefaultAgent(userId: string): Promise<ClientAgentRelationship | null>;

  // Investment proposal methods for portfolio improvement suggestions
  getInvestmentProposals(options?: { clientId?: string; agentId?: string; status?: string }): Promise<InvestmentProposal[]>;
  getInvestmentProposal(id: string): Promise<InvestmentProposal | undefined>;
  createInvestmentProposal(proposal: InsertInvestmentProposal): Promise<InvestmentProposal>;
  updateInvestmentProposal(id: string, updates: Partial<InvestmentProposal>): Promise<InvestmentProposal | undefined>;
  deleteInvestmentProposal(id: string): Promise<boolean>;

  // Investment proposal items methods
  getProposalItems(proposalId: string): Promise<InvestmentProposalItem[]>;
  createProposalItem(item: InsertInvestmentProposalItem): Promise<InvestmentProposalItem>;
  updateProposalItem(id: string, updates: Partial<InvestmentProposalItem>): Promise<InvestmentProposalItem | undefined>;
  deleteProposalItem(id: string): Promise<boolean>;

  // Proposal approval and client actions
  approveProposal(proposalId: string, clientResponse?: string): Promise<InvestmentProposal | undefined>;
  rejectProposal(proposalId: string, clientResponse: string): Promise<InvestmentProposal | undefined>;
  markProposalAsViewed(proposalId: string, userId: string): Promise<InvestmentProposal | undefined>;
  acceptProposal(proposalId: string, userId: string): Promise<InvestmentProposal | undefined>;
  addProposalToCart(proposalId: string, userId: string): Promise<any>;
  
  // Enhanced admin proposal methods
  getAllProposals(): Promise<InvestmentProposal[]>;
  getAllClients(): Promise<Array<{ id: string; name: string; email: string; }>>;
  createProposal(proposalData: any): Promise<InvestmentProposal>;
  updateProposalStatus(proposalId: string, status: string): Promise<InvestmentProposal>;
  deleteProposal(proposalId: string): Promise<boolean>;
  getProposalsByClientId(clientId: string): Promise<InvestmentProposal[]>;
  getInvestmentProposalItems(proposalId: string): Promise<InvestmentProposalItem[]>;

  // Payment integration methods
  createProposalPayment(payment: InsertProposalPayment): Promise<ProposalPayment>;
  getProposalPayments(proposalId?: string, status?: string): Promise<ProposalPayment[]>;
  updateProposalPayment(id: string, updates: Partial<ProposalPayment>): Promise<ProposalPayment | undefined>;

  // Agent-specific report methods
  getAgentTransactionReports(agentId: string, filters?: { clientId?: string; status?: string; reportType?: string }): Promise<TransactionReport[]>;
  getAgentCapitalGainsReports(agentId: string, filters?: { clientId?: string; financialYear?: string; status?: string }): Promise<CapitalGainsReport[]>;
  
  // Report sharing methods
  createReportSharing(sharing: any): Promise<any>;
  getAgentSharedReports(agentId: string, filters?: { reportType?: string; status?: string }): Promise<any[]>;

  // Interactive Brokers integration methods
  // IB Account methods
  getIBAccounts(userId: string): Promise<IBAccount[]>;
  getIBAccount(id: string): Promise<IBAccount | undefined>;
  createIBAccount(account: InsertIBAccount): Promise<IBAccount>;
  updateIBAccount(id: string, updates: Partial<IBAccount>): Promise<IBAccount | undefined>;
  deleteIBAccount(id: string): Promise<boolean>;
  updateIBAccountConnectionStatus(id: string, status: string, lastConnected?: Date): Promise<IBAccount | undefined>;

  // IB Order methods
  getIBOrders(userId: string, ibAccountId?: string): Promise<IBOrder[]>;
  getIBOrder(id: string): Promise<IBOrder | undefined>;
  createIBOrder(order: InsertIBOrder): Promise<IBOrder>;
  updateIBOrder(id: string, updates: Partial<IBOrder>): Promise<IBOrder | undefined>;
  deleteIBOrder(id: string): Promise<boolean>;
  getIBOrderByOrderId(orderId: number, ibAccountId: string): Promise<IBOrder | undefined>;

  // IB Position methods
  getIBPositions(userId: string, ibAccountId?: string): Promise<IBPosition[]>;
  getIBPosition(id: string): Promise<IBPosition | undefined>;
  createIBPosition(position: InsertIBPosition): Promise<IBPosition>;
  updateIBPosition(id: string, updates: Partial<IBPosition>): Promise<IBPosition | undefined>;
  deleteIBPosition(id: string): Promise<boolean>;
  upsertIBPosition(position: InsertIBPosition): Promise<IBPosition>;

  // IB Account Summary methods
  getIBAccountSummary(userId: string, ibAccountId?: string): Promise<IBAccountSummary[]>;
  createIBAccountSummary(summary: InsertIBAccountSummary): Promise<IBAccountSummary>;
  updateIBAccountSummary(id: string, updates: Partial<IBAccountSummary>): Promise<IBAccountSummary | undefined>;
  upsertIBAccountSummary(summary: InsertIBAccountSummary): Promise<IBAccountSummary>;

  // IB Market Data Subscription methods
  getIBMarketDataSubscriptions(userId: string, ibAccountId?: string): Promise<IBMarketDataSubscription[]>;
  createIBMarketDataSubscription(subscription: InsertIBMarketDataSubscription): Promise<IBMarketDataSubscription>;
  updateIBMarketDataSubscription(id: string, updates: Partial<IBMarketDataSubscription>): Promise<IBMarketDataSubscription | undefined>;
  deleteIBMarketDataSubscription(id: string): Promise<boolean>;
  getIBMarketDataSubscriptionBySymbol(symbol: string, ibAccountId: string): Promise<IBMarketDataSubscription | undefined>;

  // IB Trading Session methods
  getIBTradingSessions(userId: string, ibAccountId?: string): Promise<IBTradingSession[]>;
  getIBTradingSession(id: string): Promise<IBTradingSession | undefined>;
  createIBTradingSession(session: InsertIBTradingSession): Promise<IBTradingSession>;
  updateIBTradingSession(id: string, updates: Partial<IBTradingSession>): Promise<IBTradingSession | undefined>;
  getActiveIBTradingSession(ibAccountId: string): Promise<IBTradingSession | undefined>;
  endIBTradingSession(id: string, disconnectReason?: string): Promise<IBTradingSession | undefined>;

  // Partner methods
  getAllPartners(filters?: { search?: string; status?: string; partnerType?: string; page?: number; limit?: number }): Promise<{ data: Partner[]; total: number }>;
  getPartner(id: string): Promise<Partner | undefined>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  updatePartner(id: string, updates: Partial<Partner>): Promise<Partner | undefined>;
  deletePartner(id: string): Promise<boolean>;
  getPartnerStats(): Promise<{ total: number; active: number; inactive: number; byType: Record<string, number> }>;
  
  // Agent methods
  getAllAgents(filters?: { search?: string; status?: string; agentType?: string; page?: number; limit?: number }): Promise<{ data: Agent[]; total: number }>;
  getAgent(id: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, updates: Partial<Agent>): Promise<Agent | undefined>;
  deleteAgent(id: string): Promise<boolean>;
  getAgentStats(): Promise<{ total: number; active: number; inactive: number; byType: Record<string, number> }>;
  
  // Supplier methods
  getAllSuppliers(filters?: { search?: string; status?: string; category?: string; page?: number; limit?: number }): Promise<{ data: Supplier[]; total: number }>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<boolean>;
  getSupplierStats(): Promise<{ total: number; active: number; byCategory: Record<string, number> }>;
  getSupplierPerformance(supplierId: string): Promise<any>;
  
  // Supplier Product methods - commented out until SupplierProduct type is added to schema
  // getSupplierProducts(supplierId?: string): Promise<SupplierProduct[]>;
  // getSupplierProduct(id: string): Promise<SupplierProduct | undefined>;
  // createSupplierProduct(product: InsertSupplierProduct): Promise<SupplierProduct>;
  // updateSupplierProduct(id: string, updates: Partial<SupplierProduct>): Promise<SupplierProduct | undefined>;
  // deleteSupplierProduct(id: string): Promise<boolean>;
  
  // Product Marketplace methods (main products table for mutual funds, bonds, IPOs, etc.)
  getProducts(filters?: {
    category?: string;
    subcategory?: string;
    theme?: string;
    style?: string;
    riskLevel?: string;
    minReturn1y?: number;
    isFeatured?: boolean;
    limit?: number;
  }): Promise<Product[]>;
  getProductById(id: string): Promise<Product | undefined>;
  getProductBySlug(slug: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  getTopPerformers(category?: string, period?: '1m' | '3m' | '6m' | '1y' | '3y' | '5y', limit?: number): Promise<Product[]>;
  getProductsByTheme(theme: string, limit?: number): Promise<Product[]>;
  getProductsByCategory(category: string, subcategory?: string): Promise<Product[]>;
  calculatePerformanceTag(product: Product): Promise<string | null>;
  refreshProductPerformance(productId: string): Promise<Product | undefined>;
  getFeaturedProducts(limit?: number): Promise<Product[]>;
  getNewProducts(limit?: number): Promise<Product[]>;
  searchProducts(query: string): Promise<Product[]>;
  
  // Product Performance methods - commented out until ProductPerformanceMetric type is added to schema
  // getProductPerformanceMetrics(productId?: string): Promise<ProductPerformanceMetric[]>;
  // createProductPerformanceMetric(metric: InsertProductPerformanceMetric): Promise<ProductPerformanceMetric>;
  // updateProductPerformanceMetric(id: string, updates: Partial<ProductPerformanceMetric>): Promise<ProductPerformanceMetric | undefined>;
  // deleteProductPerformanceMetric(id: string): Promise<boolean>;
  
  // Profit Optimization methods
  getOptimalSupplier(productId: string): Promise<any>;
  getProfitAnalysis(productId: string): Promise<any>;
  getSupplierComparison(productId: string): Promise<any[]>;

  // Client Assignment methods
  createClientAssignment(assignment: any): Promise<any>;
  getClientAssignments(): Promise<any[]>;
  updateClientAssignment(id: string, updates: any): Promise<any>;
  getClientAssignmentsByAgent(agentId: string): Promise<any[]>;

  // Loan Against Securities methods
  createLoanApplication(application: any): Promise<any>;
  getLoanApplication(id: string): Promise<any | undefined>;
  getUserLoans(userId: string): Promise<any[]>;
  updateLoanStatus(id: string, updates: any): Promise<any | undefined>;
  getCollateralValuation(loanId: string): Promise<any | undefined>;
  
  // Loan Marketplace methods
  // Credit Profile methods
  getCreditProfile(userId: string): Promise<CreditProfile | undefined>;
  createCreditProfile(profile: InsertCreditProfile): Promise<CreditProfile>;
  updateCreditProfile(userId: string, updates: Partial<CreditProfile>): Promise<CreditProfile | undefined>;
  
  // Loan Product methods
  getLoanProducts(): Promise<LoanProduct[]>;
  getLoanProduct(id: string): Promise<LoanProduct | undefined>;
  getLoanProductByKey(productKey: string): Promise<LoanProduct | undefined>;
  createLoanProduct(product: InsertLoanProduct): Promise<LoanProduct>;
  updateLoanProduct(id: string, updates: Partial<LoanProduct>): Promise<LoanProduct | undefined>;
  
  // Loan Provider methods
  getLoanProviders(): Promise<LoanProvider[]>;
  getLoanProvider(id: string): Promise<LoanProvider | undefined>;
  getLoanProviderByKey(providerKey: string): Promise<LoanProvider | undefined>;
  createLoanProvider(provider: InsertLoanProvider): Promise<LoanProvider>;
  updateLoanProvider(id: string, updates: Partial<LoanProvider>): Promise<LoanProvider | undefined>;
  
  // Provider Product methods
  getProviderProducts(): Promise<ProviderProduct[]>;
  getProviderProductsByProvider(providerId: string, productKey?: string): Promise<ProviderProduct[]>;
  createProviderProduct(product: InsertProviderProduct): Promise<ProviderProduct>;
  updateProviderProduct(id: string, updates: Partial<ProviderProduct>): Promise<ProviderProduct | undefined>;
  
  // Loan Request methods
  getLoanRequests(userId?: string): Promise<LoanRequest[]>;
  getLoanRequest(id: string): Promise<LoanRequest | undefined>;
  createLoanRequest(request: InsertLoanRequest): Promise<LoanRequest>;
  updateLoanRequest(id: string, updates: Partial<LoanRequest>): Promise<LoanRequest | undefined>;
  
  // Loan Offer methods
  getLoanOffers(): Promise<LoanOffer[]>;
  getLoanOffersByRequest(requestId: string): Promise<LoanOffer[]>;
  getLoanOffer(id: string): Promise<LoanOffer | undefined>;
  createLoanOffer(offer: InsertLoanOffer): Promise<LoanOffer>;
  updateLoanOffer(id: string, updates: Partial<LoanOffer>): Promise<LoanOffer | undefined>;
  
  // Loan Application Marketplace methods
  getLoanApplicationsMarketplace(userId?: string): Promise<LoanApplicationMarketplace[]>;
  getLoanApplicationMarketplace(id: string): Promise<LoanApplicationMarketplace | undefined>;
  createLoanApplicationMarketplace(application: InsertLoanApplicationMarketplace): Promise<LoanApplicationMarketplace>;
  updateLoanApplicationMarketplace(id: string, updates: Partial<LoanApplicationMarketplace>): Promise<LoanApplicationMarketplace | undefined>;
  
  // Client Tasks methods
  getClientTasks(userId: string): Promise<ClientTask[]>;
  createClientTask(task: InsertClientTask): Promise<ClientTask>;
  updateClientTask(taskId: string, userId: string, updates: Partial<ClientTask>): Promise<ClientTask | undefined>;
  deleteClientTask(taskId: string, userId: string): Promise<boolean>;
  
  // Loan Applications (wrapper for marketplace)
  getLoanApplications(userId: string): Promise<LoanApplicationMarketplace[]>;
  getLoanApplicationById(id: string, userId: string): Promise<LoanApplicationMarketplace | undefined>;
  createLoanApplication(application: InsertLoanApplicationMarketplace): Promise<LoanApplicationMarketplace>;
  
  // Provider Integration methods
  getProviderIntegrations(): Promise<ProviderIntegration[]>;
  getProviderIntegrationsByProvider(providerId: string): Promise<ProviderIntegration[]>;
  createProviderIntegration(integration: InsertProviderIntegration): Promise<ProviderIntegration>;
  updateProviderIntegration(id: string, updates: Partial<ProviderIntegration>): Promise<ProviderIntegration | undefined>;
  
  // Collateral Valuation methods
  createCollateralValuation(valuation: any): Promise<any>;

  // Financial Goals methods
  getFinancialGoals(userId: string): Promise<FinancialGoal[]>;
  getFinancialGoal(id: string): Promise<FinancialGoal | undefined>;
  createFinancialGoal(goal: InsertFinancialGoal): Promise<FinancialGoal>;
  updateFinancialGoal(id: string, updates: Partial<FinancialGoal>): Promise<FinancialGoal | undefined>;
  deleteFinancialGoal(id: string): Promise<boolean>;
  
  // Investment Recommendations methods
  generateGoalBasedRecommendations(goalId: string): Promise<any[]>;
  generatePortfolioRebalanceRecommendations(portfolioId: string, goals: FinancialGoal[]): Promise<any[]>;

  // Bank Account Methods
  createBankAccount(bankAccount: InsertUserBankAccount): Promise<UserBankAccount>;
  getUserBankAccounts(userId: string): Promise<UserBankAccount[]>;
  getBankAccount(id: string): Promise<UserBankAccount | undefined>;
  updateBankAccount(id: string, updates: Partial<UserBankAccount>): Promise<UserBankAccount | undefined>;
  deleteBankAccount(id: string): Promise<boolean>;
  setDefaultBankAccount(accountId: string, defaultType: 'mutualFunds'): Promise<boolean>;

  // Demat Account Methods
  createDematAccount(dematAccount: InsertUserDematAccount): Promise<UserDematAccount>;
  getUserDematAccounts(userId: string): Promise<UserDematAccount[]>;
  getDematAccount(id: string): Promise<UserDematAccount | undefined>;
  updateDematAccount(id: string, updates: Partial<UserDematAccount>): Promise<UserDematAccount | undefined>;
  deleteDematAccount(id: string): Promise<boolean>;
  setDefaultDematAccount(accountId: string, defaultType: 'equity' | 'mutualFunds'): Promise<boolean>;

  // Product Account Preference Methods
  createProductAccountPreference(preference: InsertProductAccountPreference): Promise<ProductAccountPreference>;
  getUserProductAccountPreferences(userId: string): Promise<ProductAccountPreference[]>;
  getProductAccountPreference(userId: string, productType: string): Promise<ProductAccountPreference | undefined>;
  updateProductAccountPreference(id: string, updates: Partial<ProductAccountPreference>): Promise<ProductAccountPreference | undefined>;
  deleteProductAccountPreference(id: string): Promise<boolean>;

  // ===== MULTI-SOURCE MUTUAL FUND CACHE METHODS =====
  // Enhanced mutual fund storage with provenance tracking
  
  // Fund management with provenance
  listFunds(params?: FundSearchParams): Promise<FundListResponse>;
  getFund(schemeCode: string): Promise<FundExtended | undefined>;
  searchFunds(query: string): Promise<FundExtended[]>;
  upsertFund(fund: FundExtended): Promise<FundExtended>;
  getPopularFunds(): Promise<FundExtended[]>;
  getProvenance(schemeCode: string): Promise<Provenance | undefined>;
  markStale(schemeCodes: string[]): Promise<void>;
  
  // Cache management
  refreshFundCache(): Promise<void>;
  getFundsCacheStats(): Promise<{ totalCount: number; staleCount: number; lastUpdated: Date }>;
  
  // Source monitoring
  getSourcesStatus(): Promise<MultiSourceStatus>;
  updateSourceStatus(status: SourceStatus): Promise<void>;

  // ICICI Bank Loan Application methods
  createICICILoanApplication(application: InsertICICILoanApplication): Promise<ICICILoanApplication>;
  getICICILoanApplicationsByUser(userId: string): Promise<ICICILoanApplication[]>;
  getICICILoanApplication(id: string): Promise<ICICILoanApplication | undefined>;
  getICICILoanApplicationByApplicationId(applicationId: string): Promise<ICICILoanApplication | undefined>;
  updateICICILoanApplicationStatus(applicationId: string, updates: Partial<ICICILoanApplication>): Promise<ICICILoanApplication | undefined>;

  // ICICI Credit Score methods
  createICICICreditScore(creditScore: InsertICICICreditScore): Promise<ICICICreditScore>;
  getICICICreditScoresByUser(userId: string): Promise<ICICICreditScore[]>;
  getLatestICICICreditScore(userId: string): Promise<ICICICreditScore | undefined>;
  
  // Portfolio comparison methods
  createPortfolioComparison(comparison: InsertPortfolioComparison): Promise<string>;
  getPortfolioComparison(id: string): Promise<any>;
  getUserPortfolioComparisons(userId: string): Promise<any[]>;

  // Tax Document methods
  createTaxDocument(document: InsertTaxDocument): Promise<TaxDocument>;
  getTaxDocuments(userId: string, financialYear?: string): Promise<TaxDocument[]>;
  getTaxDocument(id: string): Promise<TaxDocument | undefined>;
  updateTaxDocument(id: string, updates: Partial<TaxDocument>): Promise<TaxDocument | undefined>;
  deleteTaxDocument(id: string): Promise<boolean>;
  
  // Structured Tax Data methods
  createStructuredTaxData(data: InsertStructuredTaxData): Promise<StructuredTaxData>;
  getStructuredTaxData(documentId: string): Promise<StructuredTaxData[]>;
  getStructuredTaxDataByUser(userId: string, financialYear?: string): Promise<StructuredTaxData[]>;
  updateStructuredTaxData(id: string, updates: Partial<StructuredTaxData>): Promise<StructuredTaxData | undefined>;
  deleteStructuredTaxData(id: string): Promise<boolean>;
  
  // Tax Calculation methods
  createTaxCalculation(calculation: InsertTaxCalculation): Promise<TaxCalculation>;
  getTaxCalculations(userId: string, financialYear?: string): Promise<TaxCalculation[]>;
  getTaxCalculation(id: string): Promise<TaxCalculation | undefined>;
  updateTaxCalculation(id: string, updates: Partial<TaxCalculation>): Promise<TaxCalculation | undefined>;
  deleteTaxCalculation(id: string): Promise<boolean>;
  
  // Tax Document Access Log methods
  createTaxDocumentAccessLog(log: InsertTaxDocumentAccessLog): Promise<TaxDocumentAccessLog>;
  getTaxDocumentAccessLogs(documentId: string): Promise<TaxDocumentAccessLog[]>;
  
  // Tax Document Processing methods
  processTaxDocument(documentId: string): Promise<{ success: boolean; extractedDataCount: number; errors?: string[] }>;
  validateTaxData(documentId: string): Promise<{ isValid: boolean; warnings: string[]; errors: string[] }>;
  generateITRJson(userId: string, financialYear: string): Promise<{ itrJson: string; warnings: string[] }>;
  calculateTaxLiability(userId: string, financialYear: string, taxRegime: 'old' | 'new'): Promise<TaxCalculation>;
  
  // Unified Tax Smart Filing Workflow methods
  // Tax Session methods
  createTaxSession(session: InsertTaxSession): Promise<TaxSession>;
  getTaxSessions(userId: string): Promise<TaxSession[]>;
  getTaxSession(id: string): Promise<TaxSession | undefined>;
  getTaxSessionByPanAndYear(userId: string, panNumber: string, assessmentYear: string): Promise<TaxSession | undefined>;
  updateTaxSession(id: string, updates: Partial<TaxSession>): Promise<TaxSession | undefined>;
  deleteTaxSession(id: string): Promise<boolean>;
  updateTaxSessionStatus(id: string, status: string, currentStep?: number): Promise<TaxSession | undefined>;
  
  // Tax Data Source methods
  getTaxDataSources(sessionId: string): Promise<TaxDataSource[]>;
  getTaxDataSource(id: string): Promise<TaxDataSource | undefined>;
  createTaxDataSource(dataSource: InsertTaxDataSource): Promise<TaxDataSource>;

  // Dynamic Tax Rules Management methods
  getTaxRule(ruleType: string, category: string, date?: Date): Promise<TaxRule | undefined>;
  getActiveTaxRules(): Promise<TaxRule[]>;
  getTaxSlabs(category: string, date?: Date): Promise<TaxRule[]>;
  upsertTaxRule(rule: InsertTaxRule): Promise<TaxRule>;
  
  // Tax Reminder Subscription methods
  createTaxReminderSubscription(subscription: InsertTaxReminderSubscription): Promise<TaxReminderSubscription>;
  getUserTaxReminderSubscription(userId: string): Promise<TaxReminderSubscription | undefined>;
  updateTaxReminderSubscription(id: string, updates: Partial<TaxReminderSubscription>): Promise<TaxReminderSubscription | undefined>;
  
  // Capital Gains Tax Reminder methods
  createCapitalGainsReminder(reminder: InsertCapitalGainsTaxReminder): Promise<CapitalGainsTaxReminder>;
  getUpcomingReminders(userId: string): Promise<CapitalGainsTaxReminder[]>;
  updateCapitalGainsReminder(id: string, updates: Partial<CapitalGainsTaxReminder>): Promise<CapitalGainsTaxReminder | undefined>;
  updateTaxDataSource(id: string, updates: Partial<TaxDataSource>): Promise<TaxDataSource | undefined>;
  deleteTaxDataSource(id: string): Promise<boolean>;
  updateDataSourceStatus(id: string, status: string, recordsCount?: number, lastSync?: Date): Promise<TaxDataSource | undefined>;
  
  // Validation Issue methods
  getValidationIssues(sessionId: string, severity?: string): Promise<ValidationIssue[]>;
  getValidationIssue(id: string): Promise<ValidationIssue | undefined>;
  createValidationIssue(issue: InsertValidationIssue): Promise<ValidationIssue>;
  updateValidationIssue(id: string, updates: Partial<ValidationIssue>): Promise<ValidationIssue | undefined>;
  deleteValidationIssue(id: string): Promise<boolean>;
  resolveValidationIssue(id: string, resolvedBy: string): Promise<ValidationIssue | undefined>;
  getValidationIssuesBySection(sessionId: string, section: string): Promise<ValidationIssue[]>;
  
  // Filing Record methods
  getFilingRecords(sessionId: string): Promise<FilingRecord[]>;
  getFilingRecord(id: string): Promise<FilingRecord | undefined>;
  getFilingRecordByAckNumber(acknowledgmentNumber: string): Promise<FilingRecord | undefined>;
  createFilingRecord(record: InsertFilingRecord): Promise<FilingRecord>;
  updateFilingRecord(id: string, updates: Partial<FilingRecord>): Promise<FilingRecord | undefined>;
  updateFilingStatus(id: string, status: string, verificationDate?: Date): Promise<FilingRecord | undefined>;
  
  // AI Optimization Suggestion methods
  getAiOptimizationSuggestions(sessionId: string, category?: string): Promise<AiOptimizationSuggestion[]>;
  getAiOptimizationSuggestion(id: string): Promise<AiOptimizationSuggestion | undefined>;
  createAiOptimizationSuggestion(suggestion: InsertAiOptimizationSuggestion): Promise<AiOptimizationSuggestion>;
  updateAiOptimizationSuggestion(id: string, updates: Partial<AiOptimizationSuggestion>): Promise<AiOptimizationSuggestion | undefined>;
  respondToSuggestion(id: string, status: string, userResponse?: string): Promise<AiOptimizationSuggestion | undefined>;
  getPendingSuggestions(sessionId: string): Promise<AiOptimizationSuggestion[]>;

  // Investment Ideas methods
  createInvestmentIdea(idea: InsertInvestmentIdea): Promise<InvestmentIdea>;
  getInvestmentIdeas(userId: string): Promise<InvestmentIdea[]>;
  getInvestmentIdea(id: string): Promise<InvestmentIdea | undefined>;
  updateInvestmentIdea(id: string, updates: Partial<InvestmentIdea>): Promise<InvestmentIdea | undefined>;
  deleteInvestmentIdea(id: string): Promise<boolean>;
  getActiveInvestmentIdeas(userId: string): Promise<InvestmentIdea[]>;
  
  // Investment Idea Tracking methods
  createInvestmentIdeaTracking(tracking: InsertInvestmentIdeaTracking): Promise<InvestmentIdeaTracking>;
  getInvestmentIdeaTracking(ideaId: string): Promise<InvestmentIdeaTracking[]>;
  getLatestIdeaTracking(ideaId: string): Promise<InvestmentIdeaTracking | undefined>;
  
  // Investment Idea Alerts methods
  createInvestmentIdeaAlert(alert: InsertInvestmentIdeaAlert): Promise<InvestmentIdeaAlert>;
  getInvestmentIdeaAlerts(userId: string): Promise<InvestmentIdeaAlert[]>;
  getUnreadAlerts(userId: string): Promise<InvestmentIdeaAlert[]>;
  markInvestmentIdeaAlertAsRead(id: string): Promise<InvestmentIdeaAlert | undefined>;
  
  // Yield Tracker methods
  createYieldTracker(tracker: InsertYieldTracker): Promise<YieldTracker>;
  getYieldTrackers(userId: string): Promise<YieldTracker[]>;
  getYieldTracker(id: string): Promise<YieldTracker | undefined>;
  updateYieldTracker(id: string, updates: Partial<YieldTracker>): Promise<YieldTracker | undefined>;
  deleteYieldTracker(id: string): Promise<boolean>;
  
  // Partner Application methods
  createPartnerApplication(application: InsertPartnerApplication): Promise<PartnerApplication>;
  getPartnerApplicationsByUserId(userId: string): Promise<PartnerApplication[]>;
  getPartnerApplication(id: string): Promise<PartnerApplication | undefined>;
  updatePartnerApplication(id: string, updates: Partial<PartnerApplication>): Promise<PartnerApplication | undefined>;
  updateApplicationStatus(id: string, status: string, providerApplicationId?: string, statusUpdates?: any[]): Promise<PartnerApplication | undefined>;
  getApplicationsByLender(lender: string, status?: string): Promise<PartnerApplication[]>;
  
  // Application Document methods
  createApplicationDocument(document: InsertPartnerApplicationDocument): Promise<PartnerApplicationDocument>;
  getApplicationDocuments(applicationId: string): Promise<PartnerApplicationDocument[]>;
  getApplicationDocument(id: string): Promise<PartnerApplicationDocument | undefined>;
  getApplicationDocumentsByType(applicationId: string, documentType: string): Promise<PartnerApplicationDocument[]>;
  updateApplicationDocument(id: string, updates: Partial<PartnerApplicationDocument>): Promise<PartnerApplicationDocument | undefined>;
  deleteApplicationDocument(id: string): Promise<boolean>;
  getApplicationPrefillData(userId: string, lender: string, recommendationId?: string): Promise<any>;
  
  // Cashfree Transaction methods
  createCashfreeTransaction(transaction: InsertCashfreeTransaction): Promise<CashfreeTransaction>;
  getCashfreeTransaction(id: string): Promise<CashfreeTransaction | undefined>;
  getCashfreeTransactionByOrderId(orderId: string): Promise<CashfreeTransaction | undefined>;
  updateCashfreeTransaction(id: string, updates: Partial<CashfreeTransaction>): Promise<CashfreeTransaction | undefined>;
  getCashfreeTransactionsByUserId(userId: string): Promise<CashfreeTransaction[]>;
  getCashfreeTransactionsByStatus(status: string): Promise<CashfreeTransaction[]>;

  // PhonePe Transaction methods
  createPhonePeTransaction(transaction: InsertPhonePeTransaction): Promise<PhonePeTransaction>;
  getPhonePeTransaction(id: string): Promise<PhonePeTransaction | undefined>;
  getPhonePeTransactionByOrderId(orderId: string): Promise<PhonePeTransaction | undefined>;
  getPhonePeTransactionByMerchantId(merchantTransactionId: string): Promise<PhonePeTransaction | undefined>;
  updatePhonePeTransaction(id: string, updates: Partial<PhonePeTransaction>): Promise<PhonePeTransaction | undefined>;
  getPhonePeTransactionsByUserId(userId: string): Promise<PhonePeTransaction[]>;
  getPhonePeTransactionsByStatus(status: string): Promise<PhonePeTransaction[]>;

  // Family Collaboration methods
  createFamilyGroup(data: InsertFamilyGroup): Promise<FamilyGroup>;
  getFamilyGroup(id: string): Promise<FamilyGroup | undefined>;
  getUserFamilies(userId: string): Promise<(FamilyGroup & {memberCount: number, role: string})[]>;
  updateFamilyGroup(id: string, data: Partial<InsertFamilyGroup>): Promise<FamilyGroup>;
  
  inviteFamilyMember(data: InsertFamilyMember): Promise<FamilyMember>;
  acceptFamilyInvitation(memberId: string, userId: string): Promise<FamilyMember>;
  getFamilyMembers(familyId: string): Promise<(FamilyMember & {user: {email: string, firstName?: string, lastName?: string}})[]>;
  updateMemberRole(memberId: string, role: string): Promise<FamilyMember>;
  removeFamilyMember(memberId: string): Promise<void>;
  checkFamilyMembership(familyId: string, userId: string): Promise<FamilyMember | undefined>;
  
  createFamilyGoal(data: InsertFamilyGoal): Promise<FamilyGoal>;
  getFamilyGoals(familyId: string): Promise<FamilyGoal[]>;
  addGoalContribution(data: InsertFamilyGoalContribution): Promise<FamilyGoalContribution>;
  getGoalContributions(goalId: string): Promise<(FamilyGoalContribution & {user: {firstName?: string, lastName?: string}})[]>;
  
  logFamilyActivity(data: InsertFamilyActivityLog): Promise<FamilyActivityLog>;
  getFamilyActivities(familyId: string, limit?: number): Promise<FamilyActivityLog[]>;
  
  createDiscussion(data: InsertFamilyDiscussion): Promise<FamilyDiscussion>;
  getFamilyDiscussions(familyId: string): Promise<(FamilyDiscussion & {author: {firstName?: string, lastName?: string}, replyCount: number})[]>;
  
  createFamilyBudget(data: InsertFamilyBudget): Promise<FamilyBudget>;
  getFamilyBudgets(familyId: string): Promise<FamilyBudget[]>;
  updateBudgetSpend(budgetId: string, amount: number): Promise<FamilyBudget>;
  
  grantPortfolioPermission(data: InsertFamilyPortfolioPermission): Promise<FamilyPortfolioPermission>;
  checkPortfolioPermission(portfolioId: string, userId: string): Promise<FamilyPortfolioPermission | undefined>;
  getFamilyDashboardData(familyId: string): Promise<{totalNetWorth: number, memberCount: number, activeGoals: number, monthlyBudget: number}>;
  
  // Alert System methods
  createUserAlert(alert: InsertUserAlert): Promise<UserAlert>;
  getUserAlerts(userId: string, category?: string): Promise<UserAlert[]>;
  getUserAlert(id: string): Promise<UserAlert | undefined>;
  updateUserAlert(id: string, updates: Partial<InsertUserAlert>): Promise<UserAlert | undefined>;
  deleteUserAlert(id: string): Promise<boolean>;
  toggleAlertStatus(id: string, isActive: boolean): Promise<UserAlert | undefined>;
  getActiveAlertsByType(alertType: string): Promise<UserAlert[]>;
  
  createAlertHistory(history: InsertAlertHistory): Promise<AlertHistory>;
  getAlertHistory(alertId: string, limit?: number): Promise<AlertHistory[]>;
  getUserAlertHistory(userId: string, limit?: number): Promise<AlertHistory[]>;
  markAlertAsRead(historyId: string): Promise<AlertHistory | undefined>;
  dismissAlert(historyId: string): Promise<AlertHistory | undefined>;
  
  getAlertTemplates(category?: string): Promise<AlertTemplate[]>;
  getPopularAlertTemplates(): Promise<AlertTemplate[]>;
  createAlertFromTemplate(userId: string, templateId: string, customData?: any): Promise<UserAlert>;
  
  // Chat System methods
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getChatSession(id: string): Promise<ChatSession | undefined>;
  getUserChatSessions(userId: string): Promise<ChatSession[]>;
  updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined>;
  
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(sessionId: string, limit?: number): Promise<ChatMessage[]>;
  updateChatMessage(id: string, updates: Partial<ChatMessage>): Promise<ChatMessage | undefined>;
  
  getChatFunctions(): Promise<ChatFunction[]>;
  getChatFunction(functionName: string): Promise<ChatFunction | undefined>;
  updateChatFunctionUsage(functionName: string, success: boolean): Promise<void>;
  
  createChatAction(action: InsertChatAction): Promise<ChatAction>;
  getChatAction(id: string): Promise<ChatAction | undefined>;
  updateChatAction(id: string, updates: Partial<ChatAction>): Promise<ChatAction | undefined>;
  getPendingChatActions(userId: string): Promise<ChatAction[]>;
  
  // Currency Exchange methods
  getCurrencyRates(baseCurrency?: string): Promise<CurrencyRate[]>;
  updateCurrencyRates(baseCurrency: string, rates: Record<string, number>): Promise<void>;
  convertPortfolioValue(portfolioId: string, targetCurrency: string): Promise<number>;
  
  // Wealth Management Financial Analysis methods
  getUserFinancialAnalysis(userId: string): Promise<{
    monthlyIncome: number;
    annualIncome: number;
    monthlyObligations: number;
    availableForInvestment: number;
    currentInvestments: number;
    additionalCapacity: number;
    obligationRatio: number;
    creditScore: number | null;
    totalPortfolioValue: number;
    totalReturns: number;
    returnPercentage: number;
    panNumber: string | null;
    hasCompletedKyc: boolean;
    hasFinancialProfile: boolean;
  } | null>;
  
  // Expense Management methods
  createExpense(expense: InsertUserExpense): Promise<UserExpense>;
  getExpense(id: string): Promise<UserExpense | undefined>;
  getUserExpenses(userId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    category?: string;
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
    offset?: number;
  }): Promise<UserExpense[]>;
  updateExpense(id: string, updates: Partial<UserExpense>): Promise<UserExpense | undefined>;
  deleteExpense(id: string): Promise<void>;
  getExpensesByCategory(userId: string, startDate?: Date, endDate?: Date): Promise<Array<{ category: string; total: number; count: number }>>;
  
  // Budget Management methods
  createBudget(budget: InsertUserBudget): Promise<UserBudget>;
  getBudget(id: string): Promise<UserBudget | undefined>;
  getUserBudgets(userId: string, isActive?: boolean): Promise<UserBudget[]>;
  updateBudget(id: string, updates: Partial<UserBudget>): Promise<UserBudget | undefined>;
  deleteBudget(id: string): Promise<void>;
  updateBudgetSpend(userId: string, category: string, amount: number): Promise<void>;
  resetBudgets(userId: string): Promise<void>;
  
  // Expense Insights methods
  createInsight(insight: InsertExpenseInsight): Promise<ExpenseInsight>;
  getUserInsights(userId: string, status?: string): Promise<ExpenseInsight[]>;
  updateInsight(id: string, updates: Partial<ExpenseInsight>): Promise<ExpenseInsight | undefined>;
  dismissInsight(id: string): Promise<void>;
  
  // BBPS Helper methods
  getBbpsTransactionByReference(orderId: string): Promise<any | undefined>;
  getBbpsBillById(billId: string): Promise<any | undefined>;
  getBbpsBillerById(billerId: string): Promise<any | undefined>;
  getBbpsCategoryById(categoryId: string): Promise<any | undefined>;
  
  // KYC Verification Session methods
  createKycVerificationSession(session: InsertKycVerificationSession): Promise<KycVerificationSession>;
  getKycVerificationSession(id: string): Promise<KycVerificationSession | undefined>;
  getActiveKycSession(userId: string): Promise<KycVerificationSession | undefined>;
  deactivateAllUserKycSessions(userId: string): Promise<void>;
  updateKycVerificationSession(id: string, updates: Partial<KycVerificationSession>): Promise<KycVerificationSession | undefined>;
  updateKycSessionStepStatus(sessionId: string, stepKey: string, stepData: any): Promise<KycVerificationSession | undefined>;
  completeKycSession(id: string): Promise<void>;
  
  // Manual KYC Submission methods
  createManualKycSubmission(submission: InsertManualKycSubmission): Promise<ManualKycSubmission>;
  getManualKycSubmission(id: string): Promise<ManualKycSubmission | undefined>;
  getUserManualKycSubmissions(userId: string): Promise<ManualKycSubmission[]>;
  getAllManualKycSubmissions(filters?: { status?: string; applicantType?: string; limit?: number; offset?: number }): Promise<ManualKycSubmission[]>;
  updateManualKycSubmission(id: string, updates: Partial<ManualKycSubmission>): Promise<ManualKycSubmission | undefined>;
  reviewManualKycSubmission(id: string, reviewerId: string, status: string, notes?: string, rejectionReason?: string): Promise<ManualKycSubmission | undefined>;
  
  // Manual KYC Document methods
  createManualKycDocument(document: InsertManualKycDocument): Promise<ManualKycDocument>;
  getManualKycDocuments(submissionId: string): Promise<ManualKycDocument[]>;
  updateManualKycDocument(id: string, updates: Partial<ManualKycDocument>): Promise<ManualKycDocument | undefined>;
  
  // KYC Admin Dashboard methods
  getKycDashboardStats(): Promise<{
    totalSubmissions: number;
    pendingReviews: number;
    approvedCount: number;
    rejectedCount: number;
    tierDistribution: Record<string, number>;
    recentActivity: any[];
  }>;
  
  // Unified KYC Submissions methods
  getUnifiedKycSubmissions(filters?: {
    status?: string;
    tier?: string;
    assignedTo?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ submissions: any[]; total: number }>;
  
  getKycSubmissionDetails(submissionId: string): Promise<any | undefined>;
  
  // KYC Document Verification methods
  getAllKycDocuments(filters?: {
    status?: string;
    documentType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ documents: any[]; total: number }>;
  
  verifyKycDocument(documentId: string, verifierId: string, status: string, notes?: string): Promise<any | undefined>;
  
  bulkVerifyKycDocuments(documentIds: string[], verifierId: string, status: string, notes?: string): Promise<{ success: number; failed: number }>;
  
  // Bulk KYC Action methods
  bulkApproveKycSubmissions(submissionIds: string[], approverId: string, notes?: string): Promise<{ success: number; failed: number }>;
  
  bulkRejectKycSubmissions(submissionIds: string[], rejectorId: string, reason: string): Promise<{ success: number; failed: number }>;
  
  bulkAssignKycSubmissions(submissionIds: string[], reviewerId: string, assignedBy: string): Promise<{ success: number; failed: number }>;
  
  // Compliance methods
  getComplianceAlerts(filters?: {
    severity?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: any[]; total: number }>;
  
  getComplianceAuditTrail(filters?: {
    userId?: string;
    action?: string;
    performedBy?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ records: any[]; total: number }>;
  
  resolveComplianceAlert(alertId: string, resolvedBy: string, resolution: string): Promise<any | undefined>;
  
  getComplianceStats(): Promise<{
    totalAlerts: number;
    criticalAlerts: number;
    pendingReviews: number;
    resolvedToday: number;
  }>;
  
  // User KYC Management methods
  getUserKycStatus(userId: string): Promise<any>;
  
  updateUserKycTier(userId: string, tier: string, updatedBy: string, reason?: string): Promise<any | undefined>;
  
  requestUserReKyc(userId: string, requestedBy: string, reason: string): Promise<any>;
  
  // Financial Operations - Admin methods
  // Order Management
  getFinancialOrdersDashboard(): Promise<{
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    totalRevenue: string;
    todayRevenue: string;
    ordersByStatus: { status: string; count: number }[];
    ordersByProductType: { productType: string; count: number; revenue: string }[];
    recentOrders: any[];
  }>;
  
  getUnifiedOrders(filters?: {
    status?: string;
    productType?: string;
    paymentStatus?: string;
    executionStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ orders: any[]; total: number }>;
  
  getUnifiedOrderDetails(orderId: string): Promise<any | undefined>;
  getUnifiedOrdersByUser(userId: string): Promise<any[]>;
  
  // Payment Tracking
  getCashfreeTransactions(filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: CashfreeTransaction[]; total: number }>;
  
  getPhonePeTransactions(filters?: {
    state?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ transactions: PhonePeTransaction[]; total: number }>;
  
  getPaymentReconciliation(dateFrom?: string, dateTo?: string): Promise<{
    cashfreeTotal: string;
    phonePeTotal: string;
    totalCollected: string;
    successfulPayments: number;
    failedPayments: number;
    pendingPayments: number;
  }>;
  
  // Revenue Analytics
  getRevenueAnalytics(dateFrom?: string, dateTo?: string): Promise<{
    totalRevenue: string;
    revenueByProductType: { productType: string; revenue: string; orders: number }[];
    revenueByGateway: { gateway: string; revenue: string; transactions: number }[];
    dailyRevenue: { date: string; revenue: string }[];
  }>;
  
  // Refund Processing
  initiateRefund(orderId: string, amount: string, reason: string, initiatedBy: string): Promise<any>;
  
  getRefunds(filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ refunds: any[]; total: number }>;
  
  updateRefundStatus(refundId: string, status: string, gatewayRefundId?: string): Promise<any | undefined>;
  
  // Agent Onboarding & Hierarchy Methods
  getAgentById(agentId: string): Promise<CustomerCareAgent | undefined>;
  getAgentByEmail(email: string): Promise<CustomerCareAgent | undefined>;
  getAgentByArn(arnCode: string): Promise<CustomerCareAgent | undefined>;
  getAgentByEuin(euinNumber: string): Promise<CustomerCareAgent | undefined>;
  getAllAgentsByStatus(status?: string): Promise<CustomerCareAgent[]>;
  getSubAgents(masterAgentId: string): Promise<CustomerCareAgent[]>;
  updateAgentVerificationStatus(agentId: string, updates: Partial<CustomerCareAgent>): Promise<CustomerCareAgent | undefined>;
  
  // Agent Document Management
  uploadAgentDocument(document: InsertAgentDocument): Promise<AgentDocument>;
  getAgentDocuments(agentId: string): Promise<AgentDocument[]>;
  getAgentDocumentByType(agentId: string, documentType: string): Promise<AgentDocument | undefined>;
  updateAgentDocumentVerification(documentId: string, status: string, verifiedBy: string, rejectionReason?: string): Promise<AgentDocument | undefined>;
  
  // AMFI Verification Logging
  createAmfiVerificationLog(log: InsertAmfiVerificationLog): Promise<AmfiVerificationLog>;
  getAmfiVerificationLogs(agentId?: string, verificationType?: string): Promise<AmfiVerificationLog[]>;
  
  // Agent Commission Splits
  createCommissionSplit(split: InsertAgentCommissionSplit): Promise<AgentCommissionSplit>;
  getCommissionSplits(subAgentId?: string, masterAgentId?: string): Promise<AgentCommissionSplit[]>;
  getActiveCommissionSplit(subAgentId: string, productType?: string): Promise<AgentCommissionSplit | undefined>;
  updateCommissionSplit(splitId: string, updates: Partial<AgentCommissionSplit>): Promise<AgentCommissionSplit | undefined>;
  
  // Agent Commission Tracking
  createAgentCommission(commission: InsertAgentCommission): Promise<AgentCommission>;
  getAgentCommissions(agentId?: string, filters?: { month?: string; productType?: string; settlementStatus?: string }): Promise<AgentCommission[]>;
  getMasterAgentCommissions(masterAgentId: string, filters?: { month?: string; productType?: string }): Promise<AgentCommission[]>;
  updateCommissionSettlementStatus(commissionId: string, agentType: 'agent' | 'master', status: string): Promise<AgentCommission | undefined>;
  getCommissionSummary(agentId: string, month?: string): Promise<{ totalEarned: number; settled: number; pending: number }>;
  
  // Sub-Agent Dashboard Methods
  getAgentReferralStats(agentId: string): Promise<{
    totalReferrals: number;
    newReferralsThisMonth: number;
    activeClients: number;
    conversionRate: number;
    totalEarnings: number;
    earningsThisMonth: number;
    pendingCommission: number;
    nextPayoutDate: string;
  }>;
  getReferredClients(agentId: string): Promise<any[]>;
  getAgentEarnings(agentId: string): Promise<any[]>;
  createClientReferral(data: {
    agentId: string;
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    interestedProducts: string[];
    notes: string;
    status: string;
    referredDate: string;
  }): Promise<any>;
  
  // Pre-Approved Loan Offers Methods
  getPreApprovedLoanOffers(userId: string): Promise<any[]>;
  createPreApprovedLoanOffer(offer: any): Promise<any>;
  updateLoanOfferApplicationStatus(offerId: string, status: string, applicationData?: any): Promise<any | undefined>;
  markLoanOfferAsViewed(offerId: string): Promise<boolean>;
  
  // Store Management Methods (Admin)
  getAllStoreProducts(): Promise<any[]>;
  getAllStoreCategories(): Promise<any[]>;
  updateStoreProductStatus(productId: string, isActive: boolean): Promise<any | undefined>;
  updateStoreCategoryStatus(categoryId: string, isActive: boolean): Promise<any | undefined>;
  
  // Enhanced Store Management Methods
  getStoreCategoryById(categoryId: string): Promise<any | undefined>;
  getStoreCategoryBySlug(slug: string): Promise<any | undefined>;
  getStoreProductBySourceCompanyId(sourceCompanyId: string): Promise<any | undefined>;
  createStoreCategory(data: any): Promise<any>;
  updateStoreCategory(id: string, data: any): Promise<any | undefined>;
  deleteStoreCategory(id: string): Promise<boolean>;
  
  // Subcategory Methods
  getAllStoreSubcategories(): Promise<any[]>;
  getStoreSubcategoriesByCategory(categoryId: string): Promise<any[]>;
  getStoreSubcategoryById(id: string): Promise<any | undefined>;
  getStoreSubcategoryBySlug(slug: string): Promise<any | undefined>;
  createStoreSubcategory(data: any): Promise<any>;
  updateStoreSubcategory(id: string, data: any): Promise<any | undefined>;
  updateStoreSubcategoryStatus(id: string, isActive: boolean): Promise<any | undefined>;
  deleteStoreSubcategory(id: string): Promise<boolean>;
  
  // Enhanced Product Methods
  getStoreProductById(id: string): Promise<any | undefined>;
  getStoreProductsByCategory(categoryId: string): Promise<any[]>;
  getStoreProductsBySubcategory(subcategoryId: string): Promise<any[]>;
  createStoreProduct(data: any): Promise<any>;
  updateStoreProduct(id: string, data: any): Promise<any | undefined>;
  deleteStoreProduct(id: string): Promise<boolean>;
  
  // Store Audit Log Methods
  createStoreAuditLog(data: any): Promise<any>;
  getStoreAuditLogs(filters?: { targetType?: string; targetId?: string; adminId?: string; limit?: number }): Promise<any[]>;
  
  // Store Product Inquiry Methods
  createStoreProductInquiry(data: any): Promise<any>;
  getStoreProductInquiries(filters?: { status?: string; productId?: string; categoryId?: string }): Promise<any[]>;
  updateStoreProductInquiry(id: string, data: any): Promise<any | undefined>;
  
  // Cascading Toggle Methods
  toggleCategoryWithCascade(categoryId: string, isActive: boolean, adminId: string, adminEmail: string): Promise<{ category: any; subcategories: any[]; products: any[] }>;
  toggleSubcategoryWithCascade(subcategoryId: string, isActive: boolean, adminId: string, adminEmail: string): Promise<{ subcategory: any; products: any[] }>;
  
  // Predictive Analytics Methods
  getPortfolioPredictions(userId: string, portfolioId?: string): Promise<any[]>;
  getAssetForecasts(userId: string, holdingId?: string): Promise<any[]>;
  getRiskAnalysis(userId: string, portfolioId?: string): Promise<any[]>;
  getPredictionAccuracy(predictionId?: string): Promise<any[]>;
  createPortfolioPrediction(prediction: any): Promise<any>;
  createAssetForecast(forecast: any): Promise<any>;
  createRiskAnalysis(analysis: any): Promise<any>;
  createPredictionAccuracy(accuracy: any): Promise<any>;

  // ===================================================================
  // UNLISTED MARKETPLACE METHODS
  // ===================================================================
  
  // Unlisted Companies
  createUnlistedCompany(data: InsertUnlistedCompany): Promise<UnlistedCompany>;
  getUnlistedCompanyById(id: string): Promise<UnlistedCompany | null>;
  getUnlistedCompanyByName(name: string): Promise<UnlistedCompany | null>;
  getUnlistedCompanyByCIN(cin: string): Promise<UnlistedCompany | null>;
  getUnlistedCompanyByISIN(isin: string): Promise<UnlistedCompany | null>;
  getAllUnlistedCompanies(filters?: { status?: string; sector?: string }): Promise<UnlistedCompany[]>;
  updateUnlistedCompany(id: string, data: Partial<InsertUnlistedCompany>): Promise<UnlistedCompany>;
  deleteUnlistedCompany(id: string): Promise<boolean>;
  
  // Company Financials
  createCompanyFinancials(data: InsertCompanyFinancials): Promise<CompanyFinancials>;
  getCompanyFinancials(companyId: string): Promise<CompanyFinancials[]>;
  getCompanyFinancialsByYear(companyId: string, financialYear: string): Promise<CompanyFinancials | null>;
  updateCompanyFinancials(id: string, data: Partial<InsertCompanyFinancials>): Promise<CompanyFinancials>;
  
  // Company Ratios
  createCompanyRatios(data: InsertCompanyRatios): Promise<CompanyRatios>;
  getCompanyRatios(companyId: string): Promise<CompanyRatios[]>;
  getCompanyRatiosByYear(companyId: string, financialYear: string): Promise<CompanyRatios | null>;
  updateCompanyRatios(id: string, data: Partial<InsertCompanyRatios>): Promise<CompanyRatios>;
  
  // Price History
  createPriceHistory(data: InsertUnlistedPriceHistory): Promise<UnlistedPriceHistory>;
  getPriceHistoryByDate(companyId: string, date: Date): Promise<UnlistedPriceHistory | null>;
  upsertPriceHistory(data: InsertUnlistedPriceHistory): Promise<UnlistedPriceHistory>;
  getPriceHistory(companyId: string, limit?: number): Promise<UnlistedPriceHistory[]>;
  
  // Sell Listings
  createSellListing(data: InsertSellListing): Promise<SellListing>;
  getSellListingById(id: string): Promise<SellListing | null>;
  getSellListingsByCompany(companyId: string): Promise<SellListing[]>;
  updateSellListing(id: string, data: Partial<InsertSellListing>): Promise<SellListing>;
  
  // Buy Requests
  createBuyRequest(data: InsertBuyRequest): Promise<BuyRequest>;
  getBuyRequestById(id: string): Promise<BuyRequest | null>;
  getBuyRequestsByCompany(companyId: string): Promise<BuyRequest[]>;
  updateBuyRequest(id: string, data: Partial<InsertBuyRequest>): Promise<BuyRequest>;
  
  // Deals
  createUnlistedDeal(data: InsertUnlistedDeal): Promise<UnlistedDeal>;
  getUnlistedDealById(id: string): Promise<UnlistedDeal | null>;
  getUnlistedDealsByCompany(companyId: string): Promise<UnlistedDeal[]>;
  getUnlistedDealsByUser(userId: string): Promise<UnlistedDeal[]>;
  getUnlistedDealsPendingAcceptance(userId: string): Promise<UnlistedDeal[]>;
  updateUnlistedDeal(id: string, data: Partial<InsertUnlistedDeal>): Promise<UnlistedDeal>;
  
  // Probe42 Sync Log
  createProbe42SyncLog(data: InsertProbe42SyncLog): Promise<Probe42SyncLog>;
  getLatestSyncLog(companyId: string): Promise<Probe42SyncLog | null>;
  
  // CA Support System - Templates
  createSupportTemplate(data: InsertSupportTemplate): Promise<SupportTemplate>;
  getSupportTemplates(category?: string): Promise<SupportTemplate[]>;
  getSupportTemplateById(id: string): Promise<SupportTemplate | null>;
  updateSupportTemplate(id: string, data: Partial<InsertSupportTemplate>): Promise<SupportTemplate | null>;
  deleteSupportTemplate(id: string): Promise<boolean>;
  
  // CA Support System - Steps
  createSupportStep(data: InsertSupportStep): Promise<SupportStep>;
  getSupportStepsByTemplateId(templateId: string): Promise<SupportStep[]>;
  getSupportStepsByTicketId(ticketId: string): Promise<SupportStep[]>;
  getSupportStepById(id: string): Promise<SupportStep | null>;
  updateSupportStep(id: string, data: Partial<InsertSupportStep>): Promise<SupportStep | null>;
  deleteSupportStep(id: string): Promise<boolean>;
  
  // CA Support System - Step Comments
  createSupportStepComment(data: InsertSupportStepComment): Promise<SupportStepComment>;
  getSupportStepComments(stepId: string): Promise<SupportStepComment[]>;
  deleteSupportStepComment(id: string): Promise<boolean>;
  
  // Transaction Support
  withTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T>;
  
  // Unified Cart methods
  getUnifiedCartItems(userId: string): Promise<UnifiedCartItem[]>;
  getUnifiedCartItem(id: string): Promise<UnifiedCartItem | undefined>;
  createUnifiedCartItem(item: InsertUnifiedCartItem): Promise<UnifiedCartItem>;
  updateUnifiedCartItem(id: string, updates: Partial<UnifiedCartItem>): Promise<UnifiedCartItem | undefined>;
  deleteUnifiedCartItem(id: string): Promise<boolean>;
  getUnifiedCartByCategory(userId: string, category: string): Promise<UnifiedCartItem[]>;
  clearUnifiedCart(userId: string): Promise<boolean>;
  getUnifiedCartCount(userId: string): Promise<number>;
  approveCartItem(id: string): Promise<UnifiedCartItem | undefined>;
  getAllUnifiedCartItemsForAdmin(filters?: { userId?: string; category?: string; source?: string; status?: string }): Promise<UnifiedCartItem[]>;
  checkoutCartItems(userId: string, cartItemIds: string[]): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user || undefined;
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.mobile, mobile));
    return user || undefined;
  }

  async getUserByUserId(userId: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.userId, userId));
    return user || undefined;
  }

  async createUser(user: UpsertUser): Promise<User> {
    // Guard: Ensure userId is always provided to prevent NULL values
    if (!user.userId) {
      throw new Error("userId is required and must be provided when creating a user");
    }
    
    const [newUser] = await db
      .insert(schema.users)
      .values({
        ...user,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(schema.users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.users.id, id))
      .returning();
    return updatedUser || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(schema.users)
      .values(userData)
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(schema.users).where(eq(schema.users.id, id));
    return (result as any).rowCount > 0;
  }

  async updateUserStatus(id: string, isActive: boolean): Promise<User | undefined> {
    return this.updateUser(id, { isActive });
  }

  // OTP verification methods
  async createOtpVerification(otp: InsertOtpVerification): Promise<OtpVerification> {
    const [newOtp] = await db
      .insert(schema.otpVerifications)
      .values(otp)
      .returning();
    return newOtp;
  }

  async getOtpVerification(identifier: string, type: string): Promise<OtpVerification | undefined> {
    const [otp] = await db
      .select()
      .from(schema.otpVerifications)
      .where(and(
        eq(schema.otpVerifications.identifier, identifier),
        eq(schema.otpVerifications.type, type)
      ))
      .orderBy(desc(schema.otpVerifications.createdAt))
      .limit(1);
    return otp || undefined;
  }

  async verifyOtp(identifier: string, type: string, otp: string): Promise<boolean> {
    const verification = await this.getOtpVerification(identifier, type);
    if (!verification) return false;
    
    const isExpired = new Date() > new Date(verification.expiresAt);
    if (isExpired) return false;
    
    return verification.otp === otp;
  }

  async cleanupExpiredOtps(retries = 2): Promise<void> {
    try {
      await db
        .delete(schema.otpVerifications)
        .where(lte(schema.otpVerifications.expiresAt, new Date()));
    } catch (error: any) {
      if (error?.code === 'XX000' && retries > 0) {
        // Retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, (3 - retries) * 1000));
        return this.cleanupExpiredOtps(retries - 1);
      }
      // Silent fail - non-critical cleanup task
      console.warn('⚠️ OTP cleanup skipped due to database issue');
    }
  }

  // Password reset token methods
  async createPasswordResetToken(userId: string, identifier: string, token: string): Promise<any> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    const [resetToken] = await db
      .insert(schema.passwordResetTokens)
      .values({
        userId,
        identifier,
        token,
        expiresAt,
        isUsed: false,
      })
      .returning();
    return resetToken;
  }

  async getPasswordResetToken(userId: string, token: string): Promise<any | undefined> {
    const [resetToken] = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(and(
        eq(schema.passwordResetTokens.userId, userId),
        eq(schema.passwordResetTokens.token, token),
        eq(schema.passwordResetTokens.isUsed, false)
      ))
      .orderBy(desc(schema.passwordResetTokens.createdAt))
      .limit(1);
    return resetToken || undefined;
  }

  async markPasswordResetTokenAsUsed(id: string): Promise<boolean> {
    const [result] = await db
      .update(schema.passwordResetTokens)
      .set({ isUsed: true, usedAt: new Date() })
      .where(eq(schema.passwordResetTokens.id, id))
      .returning();
    return !!result;
  }

  async cleanupExpiredResetTokens(): Promise<void> {
    await db
      .delete(schema.passwordResetTokens)
      .where(lte(schema.passwordResetTokens.expiresAt, new Date()));
  }

  // Portfolio methods
  async getPortfoliosByUserId(userId: string): Promise<Portfolio[]> {
    return await db.select().from(schema.portfolios).where(eq(schema.portfolios.userId, userId));
  }

  async getPortfoliosByUserPan(panNumber: string): Promise<Portfolio[]> {
    // Query users table directly since PAN is stored there, not in user_profiles
    const users = await db.select().from(schema.users).where(eq(schema.users.panNumber, panNumber));
    if (!users.length) return [];
    
    return await db.select().from(schema.portfolios).where(eq(schema.portfolios.userId, users[0].id));
  }

  async getPortfolio(id: string): Promise<Portfolio | undefined> {
    const [portfolio] = await db.select().from(schema.portfolios).where(eq(schema.portfolios.id, id));
    return portfolio || undefined;
  }

  async getUserByPan(panNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.panNumber, panNumber));
    return user || undefined;
  }

  async createPortfolio(portfolio: InsertPortfolio): Promise<Portfolio> {
    const [newPortfolio] = await db
      .insert(schema.portfolios)
      .values(portfolio)
      .returning();
    return newPortfolio;
  }

  async updatePortfolio(id: string, updates: Partial<Portfolio>): Promise<Portfolio | undefined> {
    const [updatedPortfolio] = await db
      .update(schema.portfolios)
      .set(updates)
      .where(eq(schema.portfolios.id, id))
      .returning();
    return updatedPortfolio || undefined;
  }

  // For simplicity, I'll implement key methods. In a production environment, 
  // you would implement all methods from the IStorage interface.
  // Here are some core implementations:

  async getPortfolioHoldings(portfolioId: string): Promise<PortfolioHolding[]> {
    return await db.select().from(schema.portfolioHoldings).where(eq(schema.portfolioHoldings.portfolioId, portfolioId));
  }

  async createPortfolioHolding(holding: InsertPortfolioHolding): Promise<PortfolioHolding> {
    const [newHolding] = await db
      .insert(schema.portfolioHoldings)
      .values(holding)
      .returning();
    return newHolding;
  }

  async updatePortfolioHolding(id: string, updates: Partial<PortfolioHolding>): Promise<PortfolioHolding | undefined> {
    const [updatedHolding] = await db
      .update(schema.portfolioHoldings)
      .set(updates)
      .where(eq(schema.portfolioHoldings.id, id))
      .returning();
    return updatedHolding || undefined;
  }

  async deletePortfolioHolding(id: string): Promise<boolean> {
    const result = await db.delete(schema.portfolioHoldings).where(eq(schema.portfolioHoldings.id, id));
    return (result as any).rowCount > 0;
  }

  async getExternalHoldings(userId: string): Promise<ExternalHolding[]> {
    return await db.select().from(schema.externalHoldings).where(eq(schema.externalHoldings.userId, userId));
  }

  async getExternalHoldingsBySource(userId: string, source: string): Promise<ExternalHolding[]> {
    return await db.select().from(schema.externalHoldings).where(
      and(
        eq(schema.externalHoldings.userId, userId),
        eq(schema.externalHoldings.source, source)
      )
    );
  }

  async createExternalHolding(holding: InsertExternalHolding): Promise<ExternalHolding> {
    const [newHolding] = await db
      .insert(schema.externalHoldings)
      .values(holding)
      .returning();
    return newHolding;
  }

  async deleteExternalHoldingsBySource(userId: string, source: string): Promise<number> {
    const result = await db.delete(schema.externalHoldings).where(
      and(
        eq(schema.externalHoldings.userId, userId),
        eq(schema.externalHoldings.source, source)
      )
    );
    return (result as any).rowCount || 0;
  }

  async getWatchlistsByUserId(userId: string): Promise<Watchlist[]> {
    return await db.select().from(schema.watchlists).where(eq(schema.watchlists.userId, userId));
  }

  async createWatchlist(watchlist: InsertWatchlist): Promise<Watchlist> {
    const [newWatchlist] = await db
      .insert(schema.watchlists)
      .values(watchlist)
      .returning();
    return newWatchlist;
  }

  async getMarketData(symbol: string): Promise<MarketData | undefined> {
    const [marketData] = await db.select().from(schema.marketData).where(eq(schema.marketData.symbol, symbol));
    return marketData || undefined;
  }

  async getMultipleMarketData(symbols: string[]): Promise<MarketData[]> {
    if (symbols.length === 0) return [];
    return await db.select().from(schema.marketData).where(sql`${schema.marketData.symbol} = ANY(${symbols})`);
  }

  async upsertMarketData(symbol: string, data: Partial<MarketData>): Promise<MarketData> {
    const [result] = await db
      .insert(schema.marketData)
      .values({ symbol, ...data })
      .onConflictDoUpdate({
        target: schema.marketData.symbol,
        set: { ...data, lastUpdated: new Date() }
      })
      .returning();
    return result;
  }

  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
    return profile || undefined;
  }

  async upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [result] = await db
      .insert(schema.userProfiles)
      .values(profile)
      .onConflictDoUpdate({
        target: schema.userProfiles.userId,
        set: { ...profile, updatedAt: new Date() }
      })
      .returning();
    return result;
  }

  async getAllUsers(): Promise<User[]> {
    try {
      // Use raw SQL to bypass Drizzle schema issues with missing columns
      const result = await db.execute(sql`
        SELECT 
          id,
          email,
          mobile,
          first_name as "firstName",
          last_name as "lastName", 
          role,
          roles,
          is_active as "isActive",
          login_count as "loginCount",
          created_at as "createdAt",
          last_login_at as "lastLoginAt"
        FROM users
      `);
      
      // Map results and ensure roles compatibility
      return result.rows.map((user: any) => ({
        ...user,
        roles: user.roles || (user.role ? [user.role] : [])
      })) as User[];
    } catch (error) {
      console.error("Error in getAllUsers:", error);
      return [];
    }
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    await db
      .update(schema.users)
      .set({ roles: [role], updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  async getEpfHoldings(userId: string): Promise<EpfHolding[]> {
    return db.select().from(schema.epfHoldings).where(eq(schema.epfHoldings.userId, userId));
  }

  async getPpfHoldings(userId: string): Promise<PpfHolding[]> {
    return db.select().from(schema.ppfHoldings).where(eq(schema.ppfHoldings.userId, userId));
  }

  async getEpsHoldings(userId: string): Promise<EpsHolding[]> {
    return db.select().from(schema.epsHoldings).where(eq(schema.epsHoldings.userId, userId));
  }

  async getNpsAccounts(userId: string): Promise<NpsAccount[]> {
    return db.select().from(schema.npsAccounts).where(eq(schema.npsAccounts.userId, userId));
  }

  async getApyAccounts(userId: string): Promise<ApyAccount[]> {
    return db.select().from(schema.apyAccounts).where(eq(schema.apyAccounts.userId, userId));
  }

  // Financial Obligations methods
  async getFinancialObligations(userId: string): Promise<FinancialObligation[]> {
    return db.select().from(schema.financialObligations).where(eq(schema.financialObligations.userId, userId)).orderBy(schema.financialObligations.dueDate);
  }

  async getFinancialObligationById(id: string): Promise<FinancialObligation | undefined> {
    const results = await db.select().from(schema.financialObligations).where(eq(schema.financialObligations.id, id));
    return results[0];
  }

  async createFinancialObligation(data: InsertFinancialObligation): Promise<FinancialObligation> {
    const results = await db.insert(schema.financialObligations).values(data).returning();
    return results[0];
  }

  async updateFinancialObligation(id: string, updates: Partial<FinancialObligation>): Promise<FinancialObligation | undefined> {
    const results = await db.update(schema.financialObligations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.financialObligations.id, id))
      .returning();
    return results[0];
  }

  async deleteFinancialObligation(id: string): Promise<void> {
    await db.delete(schema.financialObligations).where(eq(schema.financialObligations.id, id));
  }

  async deleteUserCibilObligations(userId: string): Promise<void> {
    await db.delete(schema.financialObligations)
      .where(and(eq(schema.financialObligations.userId, userId), eq(schema.financialObligations.fromCibil, true)));
  }

  async getInsuranceHoldings(userId: string): Promise<InsuranceHolding[]> {
    return [];
  }

  async createInsuranceHolding(holding: InsertInsuranceHolding): Promise<InsuranceHolding> {
    throw new Error("Method not implemented");
  }

  async updateInsuranceHolding(id: string, updates: Partial<InsuranceHolding>): Promise<InsuranceHolding | undefined> {
    throw new Error("Method not implemented");
  }

  async checkGovernmentSchemeConsent(userId: string, panNumber: string, schemeType: string): Promise<boolean> {
    try {
      const result = await db.select()
        .from(schema.dataSourceConsents)
        .where(
          and(
            eq(schema.dataSourceConsents.userId, userId),
            eq(schema.dataSourceConsents.dataSource, schemeType.toLowerCase()),
            eq(schema.dataSourceConsents.consentGiven, true),
            eq(schema.dataSourceConsents.isActive, true)
          )
        )
        .limit(1);
      
      return result.length > 0;
    } catch (error) {
      console.error("Error checking government scheme consent:", error);
      return false;
    }
  }

  async createGovernmentSchemeConsent(consent: InsertGovernmentSchemeConsent): Promise<GovernmentSchemeConsent> {
    try {
      const consentId = `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();
      const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      
      const [result] = await db.insert(schema.dataSourceConsents).values({
        id: consentId,
        userId: consent.userId,
        dataSource: consent.schemeType.toLowerCase(),
        provider: 'government',
        consentGiven: true,
        consentPurpose: consent.purpose || 'Access government scheme holdings data for portfolio management',
        consentText: `User consented to access ${consent.schemeType} data for PAN ${consent.panNumber}`,
        ipAddress: consent.ipAddress || null,
        userAgent: consent.userAgent || null,
        consentedAt: now,
        expiresAt: expiryDate,
        isActive: true,
        consentVersion: '1.0',
        regulatoryCompliance: { pmla: true, sebi: true }
      }).returning();
      
      return {
        id: result.id,
        userId: result.userId,
        panNumber: consent.panNumber,
        schemeType: consent.schemeType,
        consentGranted: true,
        purpose: result.consentPurpose || '',
        consentDate: result.consentedAt || now,
        consentExpiryDate: result.expiresAt || expiryDate,
        ipAddress: result.ipAddress || null,
        userAgent: result.userAgent || null,
        isActive: result.isActive ?? true
      };
    } catch (error) {
      console.error("Error creating government scheme consent:", error);
      throw error;
    }
  }

  async getGovernmentSchemeConsents(userId: string, panNumber?: string): Promise<GovernmentSchemeConsent[]> {
    try {
      // Query for government scheme consents
      const schemeTypes = ['epf', 'ppf', 'eps', 'nps', 'apy'];
      const results = await db.select()
        .from(schema.dataSourceConsents)
        .where(
          and(
            eq(schema.dataSourceConsents.userId, userId),
            eq(schema.dataSourceConsents.isActive, true)
          )
        );
      
      // Filter by scheme types
      const filteredResults = results.filter(r => schemeTypes.includes(r.dataSource || ''));
      
      return filteredResults.map(r => ({
        id: r.id,
        userId: r.userId,
        panNumber: panNumber || '',
        schemeType: r.dataSource || '',
        consentGranted: r.consentGiven ?? false,
        purpose: r.consentPurpose || '',
        consentDate: r.consentedAt || new Date(),
        consentExpiryDate: r.expiresAt || new Date(),
        ipAddress: r.ipAddress || null,
        userAgent: r.userAgent || null,
        isActive: r.isActive ?? true
      }));
    } catch (error) {
      console.error("Error getting government scheme consents:", error);
      return [];
    }
  }

  async revokeGovernmentSchemeConsent(userId: string, panNumber: string, schemeType: string): Promise<boolean> {
    try {
      const result = await db.update(schema.dataSourceConsents)
        .set({ 
          isActive: false, 
          revokedAt: new Date(),
          revokeReason: 'User revoked consent'
        })
        .where(
          and(
            eq(schema.dataSourceConsents.userId, userId),
            eq(schema.dataSourceConsents.dataSource, schemeType.toLowerCase()),
            eq(schema.dataSourceConsents.isActive, true)
          )
        )
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error("Error revoking government scheme consent:", error);
      return false;
    }
  }
  async checkPanVerificationConsent(userId: string): Promise<boolean> {
    return false;
  }

  async recordPanVerificationConsent(userId: string, ipAddress: string, userAgent: string): Promise<void> {
    // Implementation would go here
  }

  // Additional placeholder implementations for the remaining methods...
  // For brevity, I'm showing the pattern. Each method would need proper implementation.

  async getAssetAllocation(portfolioId: string): Promise<AssetAllocation[]> {
    return [];
  }

  async upsertAssetAllocation(allocation: InsertAssetAllocation): Promise<AssetAllocation> {
    throw new Error("Method not implemented");
  }

  async getRebalancingSuggestions(portfolioId: string): Promise<any> {
    return null;
  }

  async getAllMutualFunds(): Promise<MutualFund[]> {
    try {
      return await db.select().from(schema.mutualFunds).orderBy(desc(schema.mutualFunds.lastUpdated));
    } catch (error) {
      console.error('Error fetching all mutual funds:', error);
      return [];
    }
  }

  async getMutualFund(schemeCode: string): Promise<MutualFund | undefined> {
    try {
      const results = await db.select()
        .from(schema.mutualFunds)
        .where(eq(schema.mutualFunds.schemeCode, schemeCode))
        .limit(1);
      return results[0];
    } catch (error) {
      console.error(`Error fetching mutual fund ${schemeCode}:`, error);
      return undefined;
    }
  }

  async upsertMutualFund(fund: InsertMutualFund): Promise<MutualFund> {
    try {
      const existing = await this.getMutualFund(fund.schemeCode);
      
      if (existing) {
        const [updated] = await db.update(schema.mutualFunds)
          .set({ ...fund, lastUpdated: new Date() })
          .where(eq(schema.mutualFunds.schemeCode, fund.schemeCode))
          .returning();
        return updated;
      } else {
        const [created] = await db.insert(schema.mutualFunds)
          .values(fund)
          .returning();
        return created;
      }
    } catch (error) {
      console.error('Error upserting mutual fund:', error);
      throw error;
    }
  }

  async searchMutualFunds(query: string): Promise<MutualFund[]> {
    try {
      const searchTerm = `%${query.toLowerCase()}%`;
      return await db.select()
        .from(schema.mutualFunds)
        .where(
          sql`LOWER(${schema.mutualFunds.schemeName}) LIKE ${searchTerm} 
              OR LOWER(${schema.mutualFunds.fundHouse}) LIKE ${searchTerm}
              OR LOWER(${schema.mutualFunds.category}) LIKE ${searchTerm}
              OR ${schema.mutualFunds.schemeCode} = ${query}
              OR LOWER(${schema.mutualFunds.isin}) LIKE ${searchTerm}`
        )
        .orderBy(desc(schema.mutualFunds.lastUpdated))
        .limit(50);
    } catch (error) {
      console.error('Error searching mutual funds:', error);
      return [];
    }
  }

  async getPortfolioPerformance(portfolioId: string): Promise<any> {
    return null;
  }

  async getPiChatSummaries(portfolioId: string): Promise<any[]> {
    return [];
  }

  async getCommodityPrices(): Promise<any[]> {
    return [];
  }

  async createRiskProfile(profile: any): Promise<any> {
    return profile;
  }

  async updateRiskProfile(id: string, profile: any): Promise<any> {
    return profile;
  }

  async getRiskProfile(userId: string): Promise<any | undefined> {
    return undefined;
  }

  async getAllRiskProfiles(): Promise<any[]> {
    return [];
  }

  async deleteRiskProfile(id: string): Promise<void> {
    // Implementation
  }

  async createRiskAssessmentQuestion(question: any): Promise<any> {
    return question;
  }

  async updateRiskAssessmentQuestion(id: string, question: any): Promise<any> {
    return question;
  }

  async getRiskAssessmentQuestions(): Promise<any[]> {
    return [];
  }

  async deleteRiskAssessmentQuestion(id: string): Promise<void> {
    // Implementation
  }

  async createCapitalGainsReport(report: InsertCapitalGainsReport): Promise<CapitalGainsReport> {
    throw new Error("Method not implemented");
  }

  async getCapitalGainsReports(userId?: string, financialYear?: string): Promise<CapitalGainsReport[]> {
    return [];
  }

  async getCapitalGainsReport(id: string): Promise<CapitalGainsReport | undefined> {
    return undefined;
  }

  async updateCapitalGainsReport(id: string, updates: Partial<CapitalGainsReport>): Promise<CapitalGainsReport | undefined> {
    return undefined;
  }

  async createTransactionReport(report: InsertTransactionReport): Promise<TransactionReport> {
    throw new Error("Method not implemented");
  }

  async getTransactionReports(userId?: string, financialYear?: string): Promise<TransactionReport[]> {
    return [];
  }

  async getTransactionReport(id: string): Promise<TransactionReport | undefined> {
    return undefined;
  }

  async updateTransactionReport(id: string, updates: Partial<TransactionReport>): Promise<TransactionReport | undefined> {
    return undefined;
  }

  async createTransactionRecord(record: InsertTransactionRecord): Promise<TransactionRecord> {
    throw new Error("Method not implemented");
  }

  async getTransactionRecords(reportId: string): Promise<TransactionRecord[]> {
    return [];
  }

  async getTransactionRecordsByUser(userId: string, financialYear?: string): Promise<TransactionRecord[]> {
    return [];
  }

  async createCustomerCareAgent(agent: InsertCustomerCareAgent): Promise<CustomerCareAgent> {
    const [newAgent] = await db
      .insert(schema.customerCareAgents)
      .values({
        ...agent,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newAgent;
  }

  async getAllCustomerCareAgents(): Promise<CustomerCareAgent[]> {
    const agents = await db.select().from(schema.customerCareAgents);
    return agents;
  }

  async getCustomerCareAgent(id: string): Promise<CustomerCareAgent | undefined> {
    const [agent] = await db
      .select()
      .from(schema.customerCareAgents)
      .where(eq(schema.customerCareAgents.id, id));
    return agent;
  }

  async updateCustomerCareAgent(id: string, updates: Partial<CustomerCareAgent>): Promise<CustomerCareAgent | undefined> {
    const [updatedAgent] = await db
      .update(schema.customerCareAgents)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(schema.customerCareAgents.id, id))
      .returning();
    return updatedAgent;
  }

  async deleteCustomerCareAgent(id: string): Promise<boolean> {
    const result = await db
      .delete(schema.customerCareAgents)
      .where(eq(schema.customerCareAgents.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async createAgentPartnerMapping(mapping: InsertAgentPartnerMapping): Promise<AgentPartnerMapping> {
    throw new Error("Method not implemented");
  }

  async getAgentPartnerMappings(agentId?: string, partnerId?: string): Promise<AgentPartnerMapping[]> {
    try {
      let query = db.select({
        id: schema.agentPartnerMappings.id,
        agentId: schema.agentPartnerMappings.agentId,
        partnerId: schema.agentPartnerMappings.partnerId,
        isActive: schema.agentPartnerMappings.isActive,
        priority: schema.agentPartnerMappings.priority,
        assignedAt: schema.agentPartnerMappings.assignedAt,
        assignedBy: schema.agentPartnerMappings.assignedBy,
        createdAt: schema.agentPartnerMappings.createdAt,
        // Include partner details
        partnerName: schema.partners.companyName,
        partnerEmail: schema.partners.contactEmail,
        partnerType: schema.partners.partnerType
      })
      .from(schema.agentPartnerMappings)
      .leftJoin(schema.partners, eq(schema.agentPartnerMappings.partnerId, schema.partners.id));

      const conditions = [];
      if (agentId) {
        conditions.push(eq(schema.agentPartnerMappings.agentId, agentId));
      }
      if (partnerId) {
        conditions.push(eq(schema.agentPartnerMappings.partnerId, partnerId));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      const mappings = await query;
      return mappings as AgentPartnerMapping[];
    } catch (error) {
      console.error("Error fetching agent partner mappings:", error);
      return [];
    }
  }

  async updateAgentPartnerMapping(id: string, updates: Partial<AgentPartnerMapping>): Promise<AgentPartnerMapping | undefined> {
    return undefined;
  }

  async deleteAgentPartnerMapping(id: string): Promise<boolean> {
    return false;
  }

  async getAgentMappingCounts(agentId: string): Promise<{partnerCount: number, clientCount: number}> {
    try {
      // Count active partner mappings
      const partnerCountResult = await db.select({
        count: sql<number>`count(*)`.as('count')
      })
      .from(schema.agentPartnerMappings)
      .where(and(
        eq(schema.agentPartnerMappings.agentId, agentId),
        eq(schema.agentPartnerMappings.isActive, true)
      ));

      // Count active client relationships
      const clientCountResult = await db.select({
        count: sql<number>`count(*)`.as('count')
      })
      .from(schema.clientAgentRelationships)
      .where(and(
        eq(schema.clientAgentRelationships.agentId, agentId),
        eq(schema.clientAgentRelationships.isActive, true)
      ));

      return {
        partnerCount: partnerCountResult[0]?.count || 0,
        clientCount: clientCountResult[0]?.count || 0
      };
    } catch (error) {
      console.error("Error getting agent mapping counts:", error);
      return { partnerCount: 0, clientCount: 0 };
    }
  }

  async getAllAchievementCategories(): Promise<AchievementCategory[]> {
    return [];
  }

  async createAchievementCategory(category: InsertAchievementCategory): Promise<AchievementCategory> {
    throw new Error("Method not implemented");
  }

  async getAllAchievements(): Promise<Achievement[]> {
    return [];
  }

  async getAchievementsByCategory(categoryId: string): Promise<Achievement[]> {
    return [];
  }

  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    throw new Error("Method not implemented");
  }

  async updateAchievement(id: string, updates: Partial<Achievement>): Promise<Achievement | undefined> {
    return undefined;
  }

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    return [];
  }

  async getUserAchievement(userId: string, achievementId: string): Promise<UserAchievement | undefined> {
    return undefined;
  }

  async createUserAchievement(userAchievement: InsertUserAchievement): Promise<UserAchievement> {
    throw new Error("Method not implemented");
  }

  async updateUserAchievementProgress(id: string, progress: number, metadata?: any): Promise<UserAchievement | undefined> {
    return undefined;
  }

  async markAchievementCompleted(id: string): Promise<UserAchievement | undefined> {
    return undefined;
  }

  async recordLearningProgress(progress: InsertLearningProgress): Promise<LearningProgress> {
    throw new Error("Method not implemented");
  }

  async getUserLearningProgress(userId: string, category?: string): Promise<LearningProgress[]> {
    return [];
  }

  async createSocialShare(share: InsertSocialShare): Promise<SocialShare> {
    throw new Error("Method not implemented");
  }

  async getUserSocialShares(userId: string): Promise<SocialShare[]> {
    return [];
  }

  async updateShareEngagement(id: string, engagementData: any): Promise<SocialShare | undefined> {
    return undefined;
  }

  async getUserAchievementStats(userId: string): Promise<{ totalPoints: number; completedAchievements: number; categories: Record<string, number> }> {
    return { totalPoints: 0, completedAchievements: 0, categories: {} };
  }

  async getAchievementLeaderboard(limit?: number): Promise<Array<{ userId: string; totalPoints: number; completedAchievements: number; user?: User }>> {
    return [];
  }

  async getCkycRecord(userId: string): Promise<CkycRecord | undefined> {
    return undefined;
  }

  async createCkycRecord(ckycRecord: InsertCkycRecord): Promise<CkycRecord> {
    throw new Error("Method not implemented");
  }

  async updateCkycRecord(userId: string, updates: Partial<CkycRecord>): Promise<CkycRecord | undefined> {
    return undefined;
  }

  async getAllCkycRecords(options?: { status?: string; page?: number; limit?: number }): Promise<CkycRecord[]> {
    return [];
  }

  async getCkycDocuments(userId: string): Promise<CkycDocument[]> {
    return [];
  }

  async addCkycDocument(document: InsertCkycDocument): Promise<CkycDocument> {
    throw new Error("Method not implemented");
  }

  async getCkycStatusHistory(userId: string): Promise<CkycStatusHistory[]> {
    return [];
  }

  async addCkycStatusHistory(history: InsertCkycStatusHistory): Promise<CkycStatusHistory> {
    throw new Error("Method not implemented");
  }

  // CKYC Notification Triggers method implementation
  async getCkycNotificationTriggers(ckycRecordId?: string, status?: string): Promise<any[]> {
    // Return empty array for now - this method is called by notification service
    // In a full implementation, this would query a notification_triggers table
    return [];
  }

  // General Notification Triggers method implementation
  async getNotificationTriggers(agentId?: string, status?: string): Promise<any[]> {
    // Return empty array for now - this method is called by agent notifications API
    // In a full implementation, this would query a notification_triggers table
    return [];
  }

  async getClientAgentRelationships(clientId?: string, agentId?: string): Promise<ClientAgentRelationship[]> {
    try {
      console.log('getClientAgentRelationships called with:', { clientId, agentId });
      
      // Start with a simple select to test
      const basicResults = await db.select().from(schema.clientAgentRelationships);
      console.log('Basic relationships query returned:', basicResults.length, 'records');
      
      if (basicResults.length === 0) {
        console.log('No records found in client_agent_relationships table');
        return [];
      }

      // Get user data for clients and agents
      const clientIds = Array.from(new Set(basicResults.map(r => r.clientId)));
      const agentIds = Array.from(new Set(basicResults.map(r => r.agentId)));
      const allUserIds = Array.from(new Set([...clientIds, ...agentIds]));
      
      const users = allUserIds.length > 0 ? await db.select({
        id: schema.users.id,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        email: schema.users.email
      }).from(schema.users).where(sql`${schema.users.id} = ANY(ARRAY[${sql.raw(allUserIds.map(id => `'${id}'`).join(','))}])`) : [];
      
      const userMap = new Map(users.map(u => [u.id, u]));
      
      const enrichedResults = basicResults.map(record => {
        const client = userMap.get(record.clientId);
        const agent = userMap.get(record.agentId);
        
        return {
          ...record,
          clientFirstName: client?.firstName || 'Unknown',
          clientLastName: client?.lastName || 'Client',
          clientEmail: client?.email || 'client@example.com',
          agentFirstName: agent?.firstName || 'Unknown',
          agentLastName: agent?.lastName || 'Agent', 
          agentEmail: agent?.email || 'agent@example.com'
        };
      });

      console.log('Returning enriched results:', enrichedResults.length, 'records');
      return enrichedResults as ClientAgentRelationship[];
    } catch (error) {
      console.error('Error fetching client-agent relationships:', error);
      throw error;
    }
  }

  async getClientAgentRelationship(clientId: string, agentId: string): Promise<ClientAgentRelationship | undefined> {
    try {
      const result = await db.select()
        .from(schema.clientAgentRelationships)
        .where(and(
          eq(schema.clientAgentRelationships.clientId, clientId),
          eq(schema.clientAgentRelationships.agentId, agentId)
        ))
        .limit(1);
      
      return result[0] || undefined;
    } catch (error) {
      console.error('Error fetching client-agent relationship:', error);
      throw error;
    }
  }

  async createClientAgentRelationship(relationship: InsertClientAgentRelationship): Promise<ClientAgentRelationship> {
    try {
      const result = await db.insert(schema.clientAgentRelationships)
        .values(relationship)
        .returning();
      
      return result[0] as ClientAgentRelationship;
    } catch (error) {
      console.error('Error creating client-agent relationship:', error);
      throw error;
    }
  }

  async updateClientAgentRelationship(id: string, updates: Partial<ClientAgentRelationship>): Promise<ClientAgentRelationship | undefined> {
    try {
      const result = await db.update(schema.clientAgentRelationships)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.clientAgentRelationships.id, id))
        .returning();
      
      return result[0] || undefined;
    } catch (error) {
      console.error('Error updating client-agent relationship:', error);
      throw error;
    }
  }

  async deleteClientAgentRelationship(id: string): Promise<boolean> {
    try {
      const result = await db.delete(schema.clientAgentRelationships)
        .where(eq(schema.clientAgentRelationships.id, id))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting client-agent relationship:', error);
      throw error;
    }
  }

  async getAgentForClient(clientId: string, relationshipType?: string): Promise<any | undefined> {
    const conditions = [eq(schema.clientAgentRelationships.clientId, clientId)];
    
    if (relationshipType) {
      conditions.push(eq(schema.clientAgentRelationships.relationshipType, relationshipType));
    }

    const [result] = await db
      .select({
        id: schema.clientAgentRelationships.id,
        clientId: schema.clientAgentRelationships.clientId,
        agentId: schema.clientAgentRelationships.agentId,
        euinNumber: schema.clientAgentRelationships.euinNumber,
        arnCode: schema.clientAgentRelationships.arnCode,
        amcCode: schema.clientAgentRelationships.amcCode,
        distributorId: schema.clientAgentRelationships.distributorId,
        relationshipType: schema.clientAgentRelationships.relationshipType,
        isActive: schema.clientAgentRelationships.isActive,
        assignedAt: schema.clientAgentRelationships.assignedAt,
        assignedBy: schema.clientAgentRelationships.assignedBy,
        commissionRate: schema.clientAgentRelationships.commissionRate,
        feeStructure: schema.clientAgentRelationships.feeStructure,
        autoPopulateEuin: schema.clientAgentRelationships.autoPopulateEuin,
        autoPopulateArn: schema.clientAgentRelationships.autoPopulateArn,
        createdAt: schema.clientAgentRelationships.createdAt,
        updatedAt: schema.clientAgentRelationships.updatedAt,
        agent: {
          id: schema.users.id,
          email: schema.users.email,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
          euinNumber: schema.users.euinNumber,
          arnCode: schema.users.arnCode,
          distributorId: schema.users.distributorId,
        }
      })
      .from(schema.clientAgentRelationships)
      .innerJoin(schema.users, eq(schema.clientAgentRelationships.agentId, schema.users.id))
      .where(and(...conditions))
      .limit(1);

    return result || undefined;
  }

  async getClientsForAgent(agentId: string): Promise<ClientAgentRelationship[]> {
    try {
      const relationships = await db
        .select()
        .from(schema.clientAgentRelationships)
        .where(eq(schema.clientAgentRelationships.agentId, agentId));
      return relationships;
    } catch (error) {
      console.error('Error in getClientsForAgent:', error);
      return [];
    }
  }

  async autoAssignDefaultAgent(userId: string): Promise<ClientAgentRelationship | null> {
    try {
      // Check if user already has an agent assigned
      const existingRelationship = await db
        .select()
        .from(schema.clientAgentRelationships)
        .where(eq(schema.clientAgentRelationships.clientId, userId))
        .limit(1);
      
      if (existingRelationship.length > 0) {
        console.log(`User ${userId} already has an agent assigned`);
        return null;
      }

      // Get all active agents
      const agents = await db
        .select()
        .from(schema.customerCareAgents)
        .where(eq(schema.customerCareAgents.status, 'active'));
      
      // Only auto-assign if there's exactly one agent
      if (agents.length !== 1) {
        console.log(`Auto-assignment skipped: ${agents.length} agents exist`);
        return null;
      }

      const defaultAgent = agents[0];
      
      // Find the agent's user account by email, or create one if it doesn't exist
      let [agentUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, defaultAgent.email))
        .limit(1);
      
      if (!agentUser) {
        // Generate unique userId for agent with email-based prefix
        const agentUserId = await generateUniqueUserId(defaultAgent.email);
        
        // Create a user account for the agent
        [agentUser] = await db
          .insert(schema.users)
          .values({
            userId: agentUserId,
            email: defaultAgent.email,
            mobile: defaultAgent.phone || '',
            password: '', // Agents use separate authentication
            isEmailVerified: true,
            roles: ['agent'],
            isActive: true,
          })
          .returning();
        console.log(`Created user account for agent: ${defaultAgent.email}`);
      }
      
      // Create the client-agent relationship
      const [relationship] = await db
        .insert(schema.clientAgentRelationships)
        .values({
          clientId: userId,
          agentId: agentUser.id,
          euinNumber: defaultAgent.euinNumber || '',
          arnCode: defaultAgent.arnCode || null,
          distributorId: defaultAgent.distributorId || null,
          relationshipType: 'primary',
          isActive: true,
          autoPopulateEuin: true,
          autoPopulateArn: true,
        })
        .returning();
      
      console.log(`✅ Auto-assigned user ${userId} to default agent ${defaultAgent.fullName}`);
      return relationship;
    } catch (error) {
      console.error('Error auto-assigning default agent:', error);
      return null;
    }
  }

  async getInvestmentProposals(options?: { clientId?: string; agentId?: string; status?: string }): Promise<InvestmentProposal[]> {
    try {
      const conditions = [];
      if (options?.clientId) {
        conditions.push(eq(schema.investmentProposals.clientId, options.clientId));
      }
      if (options?.agentId) {
        conditions.push(eq(schema.investmentProposals.agentId, options.agentId));
      }
      if (options?.status) {
        conditions.push(eq(schema.investmentProposals.status, options.status));
      }

      const query = db.select().from(schema.investmentProposals);

      if (conditions.length > 0) {
        return await query
          .where(and(...conditions))
          .orderBy(desc(schema.investmentProposals.createdAt));
      }

      return await query.orderBy(desc(schema.investmentProposals.createdAt));
    } catch (error) {
      console.error('Error fetching investment proposals:', error);
      throw error;
    }
  }

  async getInvestmentProposal(id: string): Promise<InvestmentProposal | undefined> {
    try {
      const [proposal] = await db
        .select()
        .from(schema.investmentProposals)
        .where(eq(schema.investmentProposals.id, id))
        .limit(1);
      return proposal;
    } catch (error) {
      console.error('Error fetching investment proposal:', error);
      throw error;
    }
  }

  async createInvestmentProposal(proposal: InsertInvestmentProposal): Promise<InvestmentProposal> {
    try {
      const [created] = await db
        .insert(schema.investmentProposals)
        .values(proposal)
        .returning();
      return created;
    } catch (error) {
      console.error('Error creating investment proposal:', error);
      throw error;
    }
  }

  async updateInvestmentProposal(id: string, updates: Partial<InvestmentProposal>): Promise<InvestmentProposal | undefined> {
    try {
      const [updated] = await db
        .update(schema.investmentProposals)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.investmentProposals.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error('Error updating investment proposal:', error);
      throw error;
    }
  }

  async deleteInvestmentProposal(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(schema.investmentProposals)
        .where(eq(schema.investmentProposals.id, id));
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.error('Error deleting investment proposal:', error);
      throw error;
    }
  }

  async getProposalItems(proposalId: string): Promise<InvestmentProposalItem[]> {
    return [];
  }

  async createProposalItem(item: InsertInvestmentProposalItem): Promise<InvestmentProposalItem> {
    throw new Error("Method not implemented");
  }

  async updateProposalItem(id: string, updates: Partial<InvestmentProposalItem>): Promise<InvestmentProposalItem | undefined> {
    return undefined;
  }

  async deleteProposalItem(id: string): Promise<boolean> {
    return false;
  }

  async approveProposal(proposalId: string, clientResponse?: string): Promise<InvestmentProposal | undefined> {
    return undefined;
  }

  async rejectProposal(proposalId: string, clientResponse: string): Promise<InvestmentProposal | undefined> {
    return undefined;
  }

  // Enhanced proposal methods for the new API endpoints
  async getAllProposals(): Promise<InvestmentProposal[]> {
    return [];
  }

  async getAllClients(): Promise<Array<{ id: string; name: string; email: string; }>> {
    return [];
  }

  async createProposal(proposalData: any): Promise<InvestmentProposal> {
    throw new Error("Method not implemented");
  }

  async updateProposalStatus(proposalId: string, status: string): Promise<InvestmentProposal> {
    throw new Error("Method not implemented");
  }

  async deleteProposal(proposalId: string): Promise<boolean> {
    return false;
  }

  async getProposalsByClientId(clientId: string): Promise<InvestmentProposal[]> {
    try {
      return await db
        .select()
        .from(schema.investmentProposals)
        .where(eq(schema.investmentProposals.clientId, clientId))
        .orderBy(desc(schema.investmentProposals.createdAt));
    } catch (error) {
      console.error('Error fetching proposals by client ID:', error);
      throw error;
    }
  }

  async getInvestmentProposalItems(proposalId: string): Promise<InvestmentProposalItem[]> {
    return [];
  }

  async markProposalAsViewed(proposalId: string, userId: string): Promise<InvestmentProposal | undefined> {
    return undefined;
  }

  async acceptProposal(proposalId: string, userId: string): Promise<InvestmentProposal | undefined> {
    return undefined;
  }

  async addProposalToCart(proposalId: string, userId: string): Promise<any> {
    try {
      const proposal = await this.getInvestmentProposal(proposalId);
      if (!proposal) {
        return { success: false, message: "Proposal not found" };
      }

      let userCartRecord = await db
        .select()
        .from(schema.userCart)
        .where(eq(schema.userCart.userId, userId))
        .limit(1);

      if (!userCartRecord || userCartRecord.length === 0) {
        const [newCart] = await db
          .insert(schema.userCart)
          .values({ userId })
          .returning();
        userCartRecord = [newCart];
      }

      const cartId = userCartRecord[0].id;

      const [cartItem] = await db
        .insert(schema.userCartItems)
        .values({
          cartId,
          proposalId,
          itemType: 'proposal',
          quantity: 1,
          investmentAmount: proposal.totalInvestmentAmount,
          metadata: {
            proposalTitle: proposal.title,
            proposalDescription: proposal.description
          }
        })
        .returning();

      await this.updateInvestmentProposal(proposalId, {
        status: 'in_cart',
        addedToCartAt: new Date(),
        cartItemId: cartItem.id
      });

      return { 
        success: true, 
        message: "Proposal added to cart successfully",
        cartItemId: cartItem.id,
        cartId
      };
    } catch (error) {
      console.error('Error adding proposal to cart:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to add proposal to cart" 
      };
    }
  }

  async createProposalPayment(payment: InsertProposalPayment): Promise<ProposalPayment> {
    throw new Error("Method not implemented");
  }

  async getProposalPayments(proposalId?: string, status?: string): Promise<ProposalPayment[]> {
    return [];
  }

  async updateProposalPayment(id: string, updates: Partial<ProposalPayment>): Promise<ProposalPayment | undefined> {
    return undefined;
  }

  async getAgentTransactionReports(agentId: string, filters?: { clientId?: string; status?: string; reportType?: string }): Promise<TransactionReport[]> {
    return [];
  }

  async getAgentCapitalGainsReports(agentId: string, filters?: { clientId?: string; financialYear?: string; status?: string }): Promise<CapitalGainsReport[]> {
    return [];
  }

  async createReportSharing(sharing: any): Promise<any> {
    return sharing;
  }

  async getAgentSharedReports(agentId: string, filters?: { reportType?: string; status?: string }): Promise<any[]> {
    return [];
  }

  async getIBAccounts(userId: string): Promise<IBAccount[]> {
    return [];
  }

  async getIBAccount(id: string): Promise<IBAccount | undefined> {
    return undefined;
  }

  async createIBAccount(account: InsertIBAccount): Promise<IBAccount> {
    throw new Error("Method not implemented");
  }

  async updateIBAccount(id: string, updates: Partial<IBAccount>): Promise<IBAccount | undefined> {
    return undefined;
  }

  async deleteIBAccount(id: string): Promise<boolean> {
    return false;
  }

  async updateIBAccountConnectionStatus(id: string, status: string, lastConnected?: Date): Promise<IBAccount | undefined> {
    return undefined;
  }

  async getIBOrders(userId: string, ibAccountId?: string): Promise<IBOrder[]> {
    return [];
  }

  async getIBOrder(id: string): Promise<IBOrder | undefined> {
    return undefined;
  }

  async createIBOrder(order: InsertIBOrder): Promise<IBOrder> {
    throw new Error("Method not implemented");
  }

  async updateIBOrder(id: string, updates: Partial<IBOrder>): Promise<IBOrder | undefined> {
    return undefined;
  }

  async deleteIBOrder(id: string): Promise<boolean> {
    return false;
  }

  async getIBOrderByOrderId(orderId: number, ibAccountId: string): Promise<IBOrder | undefined> {
    return undefined;
  }

  async getIBPositions(userId: string, ibAccountId?: string): Promise<IBPosition[]> {
    return [];
  }

  async getIBPosition(id: string): Promise<IBPosition | undefined> {
    return undefined;
  }

  async createIBPosition(position: InsertIBPosition): Promise<IBPosition> {
    throw new Error("Method not implemented");
  }

  async updateIBPosition(id: string, updates: Partial<IBPosition>): Promise<IBPosition | undefined> {
    return undefined;
  }

  async deleteIBPosition(id: string): Promise<boolean> {
    return false;
  }

  async upsertIBPosition(position: InsertIBPosition): Promise<IBPosition> {
    throw new Error("Method not implemented");
  }

  async getIBAccountSummary(userId: string, ibAccountId?: string): Promise<IBAccountSummary[]> {
    return [];
  }

  async createIBAccountSummary(summary: InsertIBAccountSummary): Promise<IBAccountSummary> {
    throw new Error("Method not implemented");
  }

  async updateIBAccountSummary(id: string, updates: Partial<IBAccountSummary>): Promise<IBAccountSummary | undefined> {
    return undefined;
  }

  async upsertIBAccountSummary(summary: InsertIBAccountSummary): Promise<IBAccountSummary> {
    throw new Error("Method not implemented");
  }

  async getIBMarketDataSubscriptions(userId: string, ibAccountId?: string): Promise<IBMarketDataSubscription[]> {
    return [];
  }

  async createIBMarketDataSubscription(subscription: InsertIBMarketDataSubscription): Promise<IBMarketDataSubscription> {
    throw new Error("Method not implemented");
  }

  async updateIBMarketDataSubscription(id: string, updates: Partial<IBMarketDataSubscription>): Promise<IBMarketDataSubscription | undefined> {
    return undefined;
  }

  async deleteIBMarketDataSubscription(id: string): Promise<boolean> {
    return false;
  }

  async getIBMarketDataSubscriptionBySymbol(symbol: string, ibAccountId: string): Promise<IBMarketDataSubscription | undefined> {
    return undefined;
  }

  async getIBTradingSessions(userId: string, ibAccountId?: string): Promise<IBTradingSession[]> {
    return [];
  }

  async getIBTradingSession(id: string): Promise<IBTradingSession | undefined> {
    return undefined;
  }

  async createIBTradingSession(session: InsertIBTradingSession): Promise<IBTradingSession> {
    throw new Error("Method not implemented");
  }

  async updateIBTradingSession(id: string, updates: Partial<IBTradingSession>): Promise<IBTradingSession | undefined> {
    return undefined;
  }

  async getActiveIBTradingSession(ibAccountId: string): Promise<IBTradingSession | undefined> {
    return undefined;
  }

  async endIBTradingSession(id: string, disconnectReason?: string): Promise<IBTradingSession | undefined> {
    return undefined;
  }

  // Partner methods implementation
  async getAllPartners(filters?: { search?: string; status?: string; partnerType?: string; page?: number; limit?: number }): Promise<{ data: Partner[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;

    let query = db.select().from(schema.partners);
    const conditions = [];

    if (filters?.search) {
      conditions.push(
        or(
          ilike(schema.partners.companyName, `%${filters.search}%`),
          ilike(schema.partners.contactEmail, `%${filters.search}%`),
          ilike(schema.partners.contactPhone, `%${filters.search}%`)
        )
      );
    }

    if (filters?.status) {
      // Map status to isActive boolean
      const isActive = filters.status === 'active';
      conditions.push(eq(schema.partners.isActive, isActive));
    }

    if (filters?.partnerType) {
      conditions.push(eq(schema.partners.partnerType, filters.partnerType));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const data = await query
      .orderBy(desc(schema.partners.createdAt))
      .limit(limit)
      .offset(offset);

    const countQuery = conditions.length > 0
      ? db.select({ count: sql`count(*)` }).from(schema.partners).where(and(...conditions))
      : db.select({ count: sql`count(*)` }).from(schema.partners);

    const [{ count }] = await countQuery as any;
    
    return {
      data,
      total: parseInt(count)
    };
  }

  async getPartner(id: string): Promise<any | undefined> {
    const [result] = await db.select().from(schema.partners).where(eq(schema.partners.id, id));
    return result;
  }

  async createPartner(partner: any): Promise<any> {
    const [result] = await db.insert(schema.partners).values(partner).returning();
    return result;
  }

  async updatePartner(id: string, updates: Partial<any>): Promise<any | undefined> {
    const [result] = await db
      .update(schema.partners)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.partners.id, id))
      .returning();
    return result;
  }

  async deletePartner(id: string): Promise<boolean> {
    const result = await db.delete(schema.partners).where(eq(schema.partners.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getPartnerStats(): Promise<{ total: number; active: number; inactive: number; byType: Record<string, number> }> {
    // Get all partners
    const allPartners = await db.select().from(schema.partners);
    
    const total = allPartners.length;
    const active = allPartners.filter(p => p.isActive).length;
    const inactive = total - active;
    
    const byType: Record<string, number> = {};
    allPartners.forEach(p => {
      const type = p.partnerType || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });
    
    return { total, active, inactive, byType };
  }

  // Supplier methods implementation
  async getAllSuppliers(filters?: { search?: string; status?: string; category?: string; page?: number; limit?: number }): Promise<{ data: Supplier[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;

    let query = db.select().from(schema.suppliers);
    const conditions = [];

    if (filters?.search) {
      conditions.push(
        or(
          ilike(schema.suppliers.name, `%${filters.search}%`),
          ilike(schema.suppliers.contactEmail, `%${filters.search}%`),
          ilike(schema.suppliers.contactPhone, `%${filters.search}%`)
        )
      );
    }

    if (filters?.status) {
      // Map status to isActive boolean
      const isActive = filters.status === 'active';
      conditions.push(eq(schema.suppliers.isActive, isActive));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const data = await query
      .orderBy(desc(schema.suppliers.createdAt))
      .limit(limit)
      .offset(offset);

    const countQuery = conditions.length > 0
      ? db.select({ count: sql`count(*)` }).from(schema.suppliers).where(and(...conditions))
      : db.select({ count: sql`count(*)` }).from(schema.suppliers);

    const [{ count }] = await countQuery as any;
    
    return {
      data,
      total: parseInt(count)
    };
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const [result] = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id));
    return result;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [result] = await db.insert(schema.suppliers).values(supplier).returning();
    return result;
  }

  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | undefined> {
    const [result] = await db
      .update(schema.suppliers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.suppliers.id, id))
      .returning();
    return result;
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const result = await db.delete(schema.suppliers).where(eq(schema.suppliers.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getSupplierPerformance(supplierId: string): Promise<any> {
    // Get product performance for this supplier
    const performance = await db
      .select()
      .from(schema.productPerformance)
      .where(eq(schema.productPerformance.supplierId, supplierId));
    
    const totalRevenue = performance.reduce((sum, p) => sum + parseFloat(p.revenue || "0"), 0);
    const totalSales = performance.reduce((sum, p) => sum + (p.salesVolume || 0), 0);
    const avgProfitMargin = performance.length > 0
      ? performance.reduce((sum, p) => sum + parseFloat(p.profitMargin || "0"), 0) / performance.length
      : 0;
    
    return {
      totalProducts: performance.length,
      totalRevenue,
      totalSales,
      avgProfitMargin,
      performanceData: performance,
    };
  }

  // Supplier Product methods - commented out until SupplierProduct type is added to schema
  // async getSupplierProducts(supplierId?: string): Promise<SupplierProduct[]> {
  //   return [];
  // }

  // async getSupplierProduct(id: string): Promise<SupplierProduct | undefined> {
  //   return undefined;
  // }

  // async createSupplierProduct(product: InsertSupplierProduct): Promise<SupplierProduct> {
  //   throw new Error("Method not implemented");
  // }

  // async updateSupplierProduct(id: string, updates: Partial<SupplierProduct>): Promise<SupplierProduct | undefined> {
  //   return undefined;
  // }

  // async deleteSupplierProduct(id: string): Promise<boolean> {
  //   return false;
  // }

  // Product Marketplace implementations
  async getProducts(filters?: {
    category?: string;
    subcategory?: string;
    theme?: string;
    style?: string;
    riskLevel?: string;
    minReturn1y?: number;
    isFeatured?: boolean;
    limit?: number;
  }): Promise<Product[]> {
    let query = db.select().from(schema.products).where(eq(schema.products.isPublic, true));
    
    const conditions = [eq(schema.products.isPublic, true)];
    
    if (filters?.category) {
      conditions.push(eq(schema.products.category, filters.category));
    }
    if (filters?.subcategory) {
      conditions.push(eq(schema.products.subCategory, filters.subcategory));
    }
    if (filters?.theme) {
      conditions.push(eq(schema.products.investmentTheme, filters.theme));
    }
    if (filters?.style) {
      conditions.push(eq(schema.products.investmentStyle, filters.style));
    }
    if (filters?.riskLevel) {
      conditions.push(eq(schema.products.riskLevel, filters.riskLevel));
    }
    if (filters?.isFeatured !== undefined) {
      conditions.push(eq(schema.products.isFeatured, filters.isFeatured));
    }
    if (filters?.minReturn1y !== undefined) {
      conditions.push(gte(schema.products.returns1y, filters.minReturn1y.toString()));
    }
    
    const results = await db.select()
      .from(schema.products)
      .where(and(...conditions))
      .orderBy(desc(schema.products.priority), desc(schema.products.updatedAt))
      .limit(filters?.limit || 100);
    
    return results;
  }

  async getProductById(id: string): Promise<Product | undefined> {
    const results = await db.select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);
    return results[0];
  }

  async getProductBySlug(slug: string): Promise<Product | undefined> {
    const results = await db.select()
      .from(schema.products)
      .where(eq(schema.products.slug, slug))
      .limit(1);
    return results[0];
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const results = await db.insert(schema.products)
      .values({
        ...product,
        id: randomUUID(),
      })
      .returning();
    return results[0];
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const results = await db.update(schema.products)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.products.id, id))
      .returning();
    return results[0];
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(schema.products)
      .where(eq(schema.products.id, id));
    return true;
  }

  async getTopPerformers(category?: string, period?: '1m' | '3m' | '6m' | '1y' | '3y' | '5y', limit?: number): Promise<Product[]> {
    const conditions = [eq(schema.products.isPublic, true)];
    
    if (category) {
      conditions.push(eq(schema.products.category, category));
    }
    
    let orderColumn;
    switch (period) {
      case '1m':
        orderColumn = schema.products.returns1m;
        break;
      case '3m':
        orderColumn = schema.products.returns3m;
        break;
      case '6m':
        orderColumn = schema.products.returns6m;
        break;
      case '3y':
        orderColumn = schema.products.returns3y;
        break;
      case '5y':
        orderColumn = schema.products.returns5y;
        break;
      case '1y':
      default:
        orderColumn = schema.products.returns1y;
        break;
    }
    
    const results = await db.select()
      .from(schema.products)
      .where(and(...conditions))
      .orderBy(desc(orderColumn))
      .limit(limit || 10);
    
    return results;
  }

  async getProductsByTheme(theme: string, limit?: number): Promise<Product[]> {
    const results = await db.select()
      .from(schema.products)
      .where(and(
        eq(schema.products.isPublic, true),
        eq(schema.products.investmentTheme, theme)
      ))
      .orderBy(desc(schema.products.returns1y))
      .limit(limit || 20);
    
    return results;
  }

  async getProductsByCategory(category: string, subcategory?: string): Promise<Product[]> {
    const conditions = [
      eq(schema.products.isPublic, true),
      eq(schema.products.category, category)
    ];
    
    if (subcategory) {
      conditions.push(eq(schema.products.subCategory, subcategory));
    }
    
    const results = await db.select()
      .from(schema.products)
      .where(and(...conditions))
      .orderBy(desc(schema.products.priority), desc(schema.products.returns1y))
      .limit(100);
    
    return results;
  }

  async calculatePerformanceTag(product: Product): Promise<string | null> {
    const returns1y = parseFloat(product.returns1y || '0');
    const returns3y = parseFloat(product.returns3y || '0');
    const returns6m = parseFloat(product.returns6m || '0');
    const returns3m = parseFloat(product.returns3m || '0');
    
    if (returns1y > 20) {
      return 'high_growth';
    }
    
    if (returns1y > 15 && returns3y > 12) {
      return 'top_performer';
    }
    
    if (returns6m > 10 && returns3m > 5) {
      return 'rising_star';
    }
    
    if (product.riskLevel === 'low' && returns1y > 8) {
      return 'stable';
    }
    
    return null;
  }

  async refreshProductPerformance(productId: string): Promise<Product | undefined> {
    const product = await this.getProductById(productId);
    if (!product) return undefined;
    
    const performanceTag = await this.calculatePerformanceTag(product);
    
    return await this.updateProduct(productId, {
      performanceTag,
    });
  }

  async getFeaturedProducts(limit?: number): Promise<Product[]> {
    const results = await db.select()
      .from(schema.products)
      .where(and(
        eq(schema.products.isPublic, true),
        eq(schema.products.isFeatured, true)
      ))
      .orderBy(desc(schema.products.priority), desc(schema.products.returns1y))
      .limit(limit || 10);
    
    return results;
  }

  async getNewProducts(limit?: number): Promise<Product[]> {
    const results = await db.select()
      .from(schema.products)
      .where(and(
        eq(schema.products.isPublic, true),
        eq(schema.products.isNew, true)
      ))
      .orderBy(desc(schema.products.createdAt))
      .limit(limit || 10);
    
    return results;
  }

  async searchProducts(query: string): Promise<Product[]> {
    const searchPattern = `%${query}%`;
    const results = await db.select()
      .from(schema.products)
      .where(and(
        eq(schema.products.isPublic, true),
        sql`(${schema.products.name} ILIKE ${searchPattern} OR ${schema.products.description} ILIKE ${searchPattern})`
      ))
      .orderBy(desc(schema.products.priority), desc(schema.products.returns1y))
      .limit(50);
    
    return results;
  }

  // Product Performance methods - commented out until ProductPerformanceMetric type is added to schema
  // async getProductPerformanceMetrics(productId?: string): Promise<ProductPerformanceMetric[]> {
  //   return [];
  // }

  // async createProductPerformanceMetric(metric: InsertProductPerformanceMetric): Promise<ProductPerformanceMetric> {
  //   throw new Error("Method not implemented");
  // }

  // async updateProductPerformanceMetric(id: string, updates: Partial<ProductPerformanceMetric>): Promise<ProductPerformanceMetric | undefined> {
  //   return undefined;
  // }

  // async deleteProductPerformanceMetric(id: string): Promise<boolean> {
  //   return false;
  // }

  async getOptimalSupplier(productId: string): Promise<any> {
    return null;
  }

  async getProfitAnalysis(productId: string): Promise<any> {
    return null;
  }

  async getSupplierComparison(productId: string): Promise<any[]> {
    return [];
  }

  async createClientAssignment(assignment: any): Promise<any> {
    return assignment;
  }

  async getClientAssignments(): Promise<any[]> {
    return [];
  }

  async updateClientAssignment(id: string, updates: any): Promise<any> {
    return updates;
  }

  async getClientAssignmentsByAgent(agentId: string): Promise<any[]> {
    return [];
  }

  // Loan Marketplace Storage Implementation

  // Credit Profile methods
  async getCreditProfile(userId: string): Promise<CreditProfile | undefined> {
    const [profile] = await db
      .select()
      .from(schema.creditProfiles)
      .where(eq(schema.creditProfiles.userId, userId))
      .limit(1);
    return profile;
  }

  async createCreditProfile(profile: InsertCreditProfile): Promise<CreditProfile> {
    const profileWithId = { ...profile, id: randomUUID() };
    const [created] = await db
      .insert(schema.creditProfiles)
      .values(profileWithId)
      .returning();
    return created;
  }

  async updateCreditProfile(userId: string, updates: Partial<CreditProfile>): Promise<CreditProfile | undefined> {
    const [updated] = await db
      .update(schema.creditProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.creditProfiles.userId, userId))
      .returning();
    return updated;
  }

  // Loan Product methods
  async getLoanProducts(): Promise<LoanProduct[]> {
    return db.select().from(schema.loanProducts).orderBy(schema.loanProducts.productName);
  }

  async getLoanProduct(id: string): Promise<LoanProduct | undefined> {
    const [product] = await db
      .select()
      .from(schema.loanProducts)
      .where(eq(schema.loanProducts.id, id))
      .limit(1);
    return product;
  }

  async getLoanProductByKey(productKey: string): Promise<LoanProduct | undefined> {
    const [product] = await db
      .select()
      .from(schema.loanProducts)
      .where(eq(schema.loanProducts.productKey, productKey))
      .limit(1);
    return product;
  }

  async createLoanProduct(product: InsertLoanProduct): Promise<LoanProduct> {
    const productWithId = { ...product, id: randomUUID() };
    const [created] = await db
      .insert(schema.loanProducts)
      .values(productWithId)
      .returning();
    return created;
  }

  async updateLoanProduct(id: string, updates: Partial<LoanProduct>): Promise<LoanProduct | undefined> {
    const [updated] = await db
      .update(schema.loanProducts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.loanProducts.id, id))
      .returning();
    return updated;
  }

  // Loan Provider methods
  async getLoanProviders(): Promise<LoanProvider[]> {
    return db.select().from(schema.loanProviders).orderBy(schema.loanProviders.providerName);
  }

  async getLoanProvider(id: string): Promise<LoanProvider | undefined> {
    const [provider] = await db
      .select()
      .from(schema.loanProviders)
      .where(eq(schema.loanProviders.id, id))
      .limit(1);
    return provider;
  }

  async getLoanProviderByKey(providerKey: string): Promise<LoanProvider | undefined> {
    const [provider] = await db
      .select()
      .from(schema.loanProviders)
      .where(eq(schema.loanProviders.providerKey, providerKey))
      .limit(1);
    return provider;
  }

  async createLoanProvider(provider: InsertLoanProvider): Promise<LoanProvider> {
    const providerWithId = { ...provider, id: randomUUID() };
    const [created] = await db
      .insert(schema.loanProviders)
      .values(providerWithId)
      .returning();
    return created;
  }

  async updateLoanProvider(id: string, updates: Partial<LoanProvider>): Promise<LoanProvider | undefined> {
    const [updated] = await db
      .update(schema.loanProviders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.loanProviders.id, id))
      .returning();
    return updated;
  }

  // Provider Product methods
  async getProviderProducts(): Promise<ProviderProduct[]> {
    return db.select().from(schema.providerProducts).orderBy(schema.providerProducts.createdAt);
  }

  async getProviderProductsByProvider(providerId: string, productKey?: string): Promise<ProviderProduct[]> {
    const conditions = [eq(schema.providerProducts.providerId, providerId)];
    
    if (productKey) {
      conditions.push(eq(schema.providerProducts.productId, productKey));
    }

    return db
      .select()
      .from(schema.providerProducts)
      .where(and(...conditions))
      .orderBy(schema.providerProducts.createdAt);
  }

  async createProviderProduct(product: InsertProviderProduct): Promise<ProviderProduct> {
    const productWithId = { ...product, id: randomUUID() };
    const [created] = await db
      .insert(schema.providerProducts)
      .values(productWithId)
      .returning();
    return created;
  }

  async updateProviderProduct(id: string, updates: Partial<ProviderProduct>): Promise<ProviderProduct | undefined> {
    const [updated] = await db
      .update(schema.providerProducts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.providerProducts.id, id))
      .returning();
    return updated;
  }

  // Loan Request methods
  async getLoanRequests(userId?: string): Promise<LoanRequest[]> {
    if (userId) {
      return db.select().from(schema.loanRequests)
        .where(eq(schema.loanRequests.userId, userId))
        .orderBy(desc(schema.loanRequests.createdAt));
    }
    
    return db.select().from(schema.loanRequests)
      .orderBy(desc(schema.loanRequests.createdAt));
  }

  async getLoanRequest(id: string): Promise<LoanRequest | undefined> {
    const [request] = await db
      .select()
      .from(schema.loanRequests)
      .where(eq(schema.loanRequests.id, id))
      .limit(1);
    return request;
  }

  async createLoanRequest(request: InsertLoanRequest): Promise<LoanRequest> {
    const requestWithId = { ...request, id: randomUUID() };
    const [created] = await db
      .insert(schema.loanRequests)
      .values(requestWithId)
      .returning();
    return created;
  }

  async updateLoanRequest(id: string, updates: Partial<LoanRequest>): Promise<LoanRequest | undefined> {
    const [updated] = await db
      .update(schema.loanRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.loanRequests.id, id))
      .returning();
    return updated;
  }

  // Loan Offer methods
  async getLoanOffers(): Promise<LoanOffer[]> {
    return db.select().from(schema.loanOffers).orderBy(desc(schema.loanOffers.createdAt));
  }

  async getLoanOffersByRequest(requestId: string): Promise<LoanOffer[]> {
    return db
      .select()
      .from(schema.loanOffers)
      .where(eq(schema.loanOffers.requestId, requestId))
      .orderBy(asc(schema.loanOffers.interestRate));
  }

  async getLoanOffer(id: string): Promise<LoanOffer | undefined> {
    const [offer] = await db
      .select()
      .from(schema.loanOffers)
      .where(eq(schema.loanOffers.id, id))
      .limit(1);
    return offer;
  }

  async createLoanOffer(offer: InsertLoanOffer): Promise<LoanOffer> {
    const offerWithId = { ...offer, id: randomUUID() };
    const [created] = await db
      .insert(schema.loanOffers)
      .values(offerWithId)
      .returning();
    return created;
  }

  async updateLoanOffer(id: string, updates: Partial<LoanOffer>): Promise<LoanOffer | undefined> {
    const [updated] = await db
      .update(schema.loanOffers)
      .set(updates)
      .where(eq(schema.loanOffers.id, id))
      .returning();
    return updated;
  }

  // Loan Application Marketplace methods
  async getLoanApplicationsMarketplace(userId?: string): Promise<LoanApplicationMarketplace[]> {
    if (userId) {
      return db.select().from(schema.loanApplicationsMarketplace)
        .where(eq(schema.loanApplicationsMarketplace.userId, userId))
        .orderBy(desc(schema.loanApplicationsMarketplace.createdAt));
    }
    
    return db.select().from(schema.loanApplicationsMarketplace)
      .orderBy(desc(schema.loanApplicationsMarketplace.createdAt));
  }

  async getLoanApplicationMarketplace(id: string): Promise<LoanApplicationMarketplace | undefined> {
    const [application] = await db
      .select()
      .from(schema.loanApplicationsMarketplace)
      .where(eq(schema.loanApplicationsMarketplace.id, id))
      .limit(1);
    return application;
  }

  async createLoanApplicationMarketplace(application: InsertLoanApplicationMarketplace): Promise<LoanApplicationMarketplace> {
    const applicationWithId = { ...application, id: randomUUID() };
    const [created] = await db
      .insert(schema.loanApplicationsMarketplace)
      .values(applicationWithId)
      .returning();
    return created;
  }

  async updateLoanApplicationMarketplace(id: string, updates: Partial<LoanApplicationMarketplace>): Promise<LoanApplicationMarketplace | undefined> {
    const [updated] = await db
      .update(schema.loanApplicationsMarketplace)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.loanApplicationsMarketplace.id, id))
      .returning();
    return updated;
  }

  // Client Tasks methods
  async getClientTasks(userId: string): Promise<ClientTask[]> {
    return db
      .select()
      .from(schema.clientTasks)
      .where(eq(schema.clientTasks.userId, userId))
      .orderBy(schema.clientTasks.dueDate);
  }

  async createClientTask(task: InsertClientTask): Promise<ClientTask> {
    const taskWithId = { ...task, id: randomUUID() };
    const [created] = await db
      .insert(schema.clientTasks)
      .values(taskWithId)
      .returning();
    return created;
  }

  async updateClientTask(taskId: string, userId: string, updates: Partial<ClientTask>): Promise<ClientTask | undefined> {
    const [updated] = await db
      .update(schema.clientTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(
        and(
          eq(schema.clientTasks.id, taskId),
          eq(schema.clientTasks.userId, userId)
        )
      )
      .returning();
    return updated;
  }

  async deleteClientTask(taskId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(schema.clientTasks)
      .where(
        and(
          eq(schema.clientTasks.id, taskId),
          eq(schema.clientTasks.userId, userId)
        )
      )
      .returning();
    return result.length > 0;
  }

  // Loan Applications wrapper methods (using loanApplicationsMarketplace)
  async getLoanApplications(userId: string): Promise<LoanApplicationMarketplace[]> {
    return db
      .select()
      .from(schema.loanApplicationsMarketplace)
      .where(eq(schema.loanApplicationsMarketplace.userId, userId))
      .orderBy(schema.loanApplicationsMarketplace.createdAt);
  }

  async getLoanApplicationById(id: string, userId: string): Promise<LoanApplicationMarketplace | undefined> {
    const [application] = await db
      .select()
      .from(schema.loanApplicationsMarketplace)
      .where(
        and(
          eq(schema.loanApplicationsMarketplace.id, id),
          eq(schema.loanApplicationsMarketplace.userId, userId)
        )
      );
    return application;
  }

  async createLoanApplication(application: InsertLoanApplicationMarketplace): Promise<LoanApplicationMarketplace> {
    return this.createLoanApplicationMarketplace(application);
  }

  // Provider Integration methods
  async getProviderIntegrations(): Promise<ProviderIntegration[]> {
    return db.select().from(schema.providerIntegrations).orderBy(schema.providerIntegrations.createdAt);
  }

  async getProviderIntegrationsByProvider(providerId: string): Promise<ProviderIntegration[]> {
    return db
      .select()
      .from(schema.providerIntegrations)
      .where(eq(schema.providerIntegrations.providerId, providerId))
      .orderBy(schema.providerIntegrations.createdAt);
  }

  async createProviderIntegration(integration: InsertProviderIntegration): Promise<ProviderIntegration> {
    const integrationWithId = { ...integration, id: randomUUID() };
    const [created] = await db
      .insert(schema.providerIntegrations)
      .values(integrationWithId)
      .returning();
    return created;
  }

  async updateProviderIntegration(id: string, updates: Partial<ProviderIntegration>): Promise<ProviderIntegration | undefined> {
    const [updated] = await db
      .update(schema.providerIntegrations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.providerIntegrations.id, id))
      .returning();
    return updated;
  }

  async createCollateralValuation(valuation: any): Promise<any> {
    return valuation;
  }

  async getFinancialGoals(userId: string): Promise<FinancialGoal[]> {
    return [];
  }

  async getFinancialGoal(id: string): Promise<FinancialGoal | undefined> {
    return undefined;
  }

  async createFinancialGoal(goal: InsertFinancialGoal): Promise<FinancialGoal> {
    throw new Error("Method not implemented");
  }

  async updateFinancialGoal(id: string, updates: Partial<FinancialGoal>): Promise<FinancialGoal | undefined> {
    return undefined;
  }

  async deleteFinancialGoal(id: string): Promise<boolean> {
    return false;
  }

  async generateGoalBasedRecommendations(goalId: string): Promise<any[]> {
    return [];
  }

  async generatePortfolioRebalanceRecommendations(portfolioId: string, goals: FinancialGoal[]): Promise<any[]> {
    return [];
  }

  async createBankAccount(bankAccount: InsertUserBankAccount): Promise<UserBankAccount> {
    throw new Error("Method not implemented");
  }

  async getUserBankAccounts(userId: string): Promise<UserBankAccount[]> {
    return [];
  }

  async getBankAccount(id: string): Promise<UserBankAccount | undefined> {
    return undefined;
  }

  async updateBankAccount(id: string, updates: Partial<UserBankAccount>): Promise<UserBankAccount | undefined> {
    return undefined;
  }

  async deleteBankAccount(id: string): Promise<boolean> {
    return false;
  }

  async setDefaultBankAccount(accountId: string, defaultType: 'mutualFunds'): Promise<boolean> {
    return false;
  }

  async createDematAccount(dematAccount: InsertUserDematAccount): Promise<UserDematAccount> {
    throw new Error("Method not implemented");
  }

  async getUserDematAccounts(userId: string): Promise<UserDematAccount[]> {
    return [];
  }

  async getDematAccount(id: string): Promise<UserDematAccount | undefined> {
    return undefined;
  }

  async updateDematAccount(id: string, updates: Partial<UserDematAccount>): Promise<UserDematAccount | undefined> {
    return undefined;
  }

  async deleteDematAccount(id: string): Promise<boolean> {
    return false;
  }

  async setDefaultDematAccount(accountId: string, defaultType: 'equity' | 'mutualFunds'): Promise<boolean> {
    return false;
  }

  // Product Account Preference Methods
  async createProductAccountPreference(preference: InsertProductAccountPreference): Promise<ProductAccountPreference> {
    const [newPreference] = await db
      .insert(schema.productAccountPreferences)
      .values(preference)
      .returning();
    return newPreference;
  }

  async getUserProductAccountPreferences(userId: string): Promise<ProductAccountPreference[]> {
    return await db
      .select()
      .from(schema.productAccountPreferences)
      .where(eq(schema.productAccountPreferences.userId, userId))
      .orderBy(desc(schema.productAccountPreferences.createdAt));
  }

  async getProductAccountPreference(userId: string, productType: string): Promise<ProductAccountPreference | undefined> {
    const [preference] = await db
      .select()
      .from(schema.productAccountPreferences)
      .where(
        and(
          eq(schema.productAccountPreferences.userId, userId),
          eq(schema.productAccountPreferences.productType, productType),
          eq(schema.productAccountPreferences.isActive, true)
        )
      );
    return preference || undefined;
  }

  async updateProductAccountPreference(id: string, updates: Partial<ProductAccountPreference>): Promise<ProductAccountPreference | undefined> {
    const [updated] = await db
      .update(schema.productAccountPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.productAccountPreferences.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProductAccountPreference(id: string): Promise<boolean> {
    const result = await db
      .delete(schema.productAccountPreferences)
      .where(eq(schema.productAccountPreferences.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Additional missing methods from MemStorage that are called in routes.ts
  async initializeUserPasswords(): Promise<void> {
    // This method would handle password hashing initialization
    // For database storage, this is typically handled in the create/update user methods
    console.log('DatabaseStorage: Password initialization handled in user creation/update methods');
  }

  // ICICI Bank Loan Application methods
  async createICICILoanApplication(application: InsertICICILoanApplication): Promise<ICICILoanApplication> {
    const [newApplication] = await db
      .insert(schema.iciciBankLoanApplications)
      .values(application)
      .returning();
    return newApplication;
  }

  async getICICILoanApplicationsByUser(userId: string): Promise<ICICILoanApplication[]> {
    return await db
      .select()
      .from(schema.iciciBankLoanApplications)
      .where(eq(schema.iciciBankLoanApplications.userId, userId))
      .orderBy(desc(schema.iciciBankLoanApplications.createdAt));
  }

  async getICICILoanApplication(id: string): Promise<ICICILoanApplication | undefined> {
    const [application] = await db
      .select()
      .from(schema.iciciBankLoanApplications)
      .where(eq(schema.iciciBankLoanApplications.id, id));
    return application || undefined;
  }

  async getICICILoanApplicationByApplicationId(applicationId: string): Promise<ICICILoanApplication | undefined> {
    const [application] = await db
      .select()
      .from(schema.iciciBankLoanApplications)
      .where(eq(schema.iciciBankLoanApplications.applicationId, applicationId));
    return application || undefined;
  }

  async updateICICILoanApplicationStatus(applicationId: string, updates: Partial<ICICILoanApplication>): Promise<ICICILoanApplication | undefined> {
    const [updatedApplication] = await db
      .update(schema.iciciBankLoanApplications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.iciciBankLoanApplications.applicationId, applicationId))
      .returning();
    return updatedApplication || undefined;
  }

  // ICICI Credit Score methods
  async createICICICreditScore(creditScore: InsertICICICreditScore): Promise<ICICICreditScore> {
    const [newCreditScore] = await db
      .insert(schema.iciciBankCreditScores)
      .values(creditScore)
      .returning();
    return newCreditScore;
  }

  async getICICICreditScoresByUser(userId: string): Promise<ICICICreditScore[]> {
    return await db
      .select()
      .from(schema.iciciBankCreditScores)
      .where(eq(schema.iciciBankCreditScores.userId, userId))
      .orderBy(desc(schema.iciciBankCreditScores.createdAt));
  }

  async getLatestICICICreditScore(userId: string): Promise<ICICICreditScore | undefined> {
    const [creditScore] = await db
      .select()
      .from(schema.iciciBankCreditScores)
      .where(eq(schema.iciciBankCreditScores.userId, userId))
      .orderBy(desc(schema.iciciBankCreditScores.createdAt))
      .limit(1);
    return creditScore || undefined;
  }

  // Portfolio comparison methods
  async createPortfolioComparison(comparison: InsertPortfolioComparison): Promise<string> {
    try {
      const [result] = await db.insert(schema.portfolioComparisons).values(comparison).returning({ id: schema.portfolioComparisons.id });
      return result.id;
    } catch (error) {
      console.error("Error creating portfolio comparison:", error);
      throw new Error("Failed to create portfolio comparison");
    }
  }

  async getPortfolioComparison(id: string): Promise<any> {
    try {
      const [comparison] = await db.select().from(schema.portfolioComparisons).where(eq(schema.portfolioComparisons.id, id));
      return comparison;
    } catch (error) {
      console.error("Error fetching portfolio comparison:", error);
      return undefined;
    }
  }

  async getUserPortfolioComparisons(userId: string): Promise<any[]> {
    try {
      const comparisons = await db.select().from(schema.portfolioComparisons)
        .where(eq(schema.portfolioComparisons.userId, userId))
        .orderBy(desc(schema.portfolioComparisons.createdAt));
      return comparisons;
    } catch (error) {
      console.error("Error fetching user portfolio comparisons:", error);
      return [];
    }
  }

  // Property access for backward compatibility
  get db() {
    return db;
  }

  // ===== TAX DOCUMENT METHODS =====

  // Tax Document methods
  async createTaxDocument(document: InsertTaxDocument): Promise<TaxDocument> {
    const [result] = await this.db
      .insert(schema.taxDocuments)
      .values(document)
      .returning();
    return result;
  }

  async getTaxDocuments(userId: string, financialYear?: string): Promise<TaxDocument[]> {
    try {
      const conditions = [eq(schema.taxDocuments.userId, userId)];
      
      if (financialYear) {
        conditions.push(eq(schema.taxDocuments.financialYear, financialYear));
      }

      return await this.db
        .select()
        .from(schema.taxDocuments)
        .where(and(...conditions))
        .orderBy(desc(schema.taxDocuments.createdAt));
    } catch (error) {
      console.error("Error fetching tax documents:", error);
      return [];
    }
  }

  async getTaxDocument(id: string): Promise<TaxDocument | undefined> {
    const [result] = await this.db
      .select()
      .from(schema.taxDocuments)
      .where(eq(schema.taxDocuments.id, id));
    return result;
  }

  async updateTaxDocument(id: string, updates: Partial<TaxDocument>): Promise<TaxDocument | undefined> {
    const [result] = await this.db
      .update(schema.taxDocuments)
      .set(updates)
      .where(eq(schema.taxDocuments.id, id))
      .returning();
    return result;
  }

  async deleteTaxDocument(id: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.taxDocuments)
      .where(eq(schema.taxDocuments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Structured Tax Data methods
  async createStructuredTaxData(data: InsertStructuredTaxData): Promise<StructuredTaxData> {
    const [result] = await this.db
      .insert(schema.structuredTaxData)
      .values(data)
      .returning();
    return result;
  }

  async getStructuredTaxData(documentId: string): Promise<StructuredTaxData[]> {
    return await this.db
      .select()
      .from(schema.structuredTaxData)
      .where(eq(schema.structuredTaxData.documentId, documentId))
      .orderBy(desc(schema.structuredTaxData.createdAt));
  }

  async getStructuredTaxDataByUser(userId: string, financialYear?: string): Promise<StructuredTaxData[]> {
    try {
      const conditions = [eq(schema.structuredTaxData.userId, userId)];
      
      if (financialYear) {
        conditions.push(eq(schema.taxDocuments.financialYear, financialYear));
      }

      const results = await this.db
        .select()
        .from(schema.structuredTaxData)
        .innerJoin(schema.taxDocuments, eq(schema.structuredTaxData.documentId, schema.taxDocuments.id))
        .where(and(...conditions))
        .orderBy(desc(schema.structuredTaxData.createdAt));
        
      return results.map(r => r.structured_tax_data) as StructuredTaxData[];
    } catch (error) {
      console.error("Error fetching user tax data:", error);
      return [];
    }
  }

  async updateStructuredTaxData(id: string, updates: Partial<StructuredTaxData>): Promise<StructuredTaxData | undefined> {
    const [result] = await this.db
      .update(schema.structuredTaxData)
      .set(updates)
      .where(eq(schema.structuredTaxData.id, id))
      .returning();
    return result;
  }

  async deleteStructuredTaxData(id: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.structuredTaxData)
      .where(eq(schema.structuredTaxData.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Tax Calculation methods
  async createTaxCalculation(calculation: InsertTaxCalculation): Promise<TaxCalculation> {
    const [result] = await this.db
      .insert(schema.taxCalculations)
      .values(calculation)
      .returning();
    return result;
  }

  async getTaxCalculations(userId: string, financialYear?: string): Promise<TaxCalculation[]> {
    try {
      const conditions = [eq(schema.taxCalculations.userId, userId)];
      
      if (financialYear) {
        conditions.push(eq(schema.taxCalculations.financialYear, financialYear));
      }

      const query = this.db
        .select()
        .from(schema.taxCalculations)
        .where(and(...conditions));

      return await query.orderBy(desc(schema.taxCalculations.createdAt));
    } catch (error) {
      console.error("Error fetching tax calculations:", error);
      return [];
    }
  }

  async getTaxCalculation(id: string): Promise<TaxCalculation | undefined> {
    const [result] = await this.db
      .select()
      .from(schema.taxCalculations)
      .where(eq(schema.taxCalculations.id, id));
    return result;
  }

  async updateTaxCalculation(id: string, updates: Partial<TaxCalculation>): Promise<TaxCalculation | undefined> {
    const [result] = await this.db
      .update(schema.taxCalculations)
      .set(updates)
      .where(eq(schema.taxCalculations.id, id))
      .returning();
    return result;
  }

  async deleteTaxCalculation(id: string): Promise<boolean> {
    const result = await this.db
      .delete(schema.taxCalculations)
      .where(eq(schema.taxCalculations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Tax Document Access Log methods
  async createTaxDocumentAccessLog(log: InsertTaxDocumentAccessLog): Promise<TaxDocumentAccessLog> {
    const [result] = await this.db
      .insert(schema.taxDocumentAccessLog)
      .values(log)
      .returning();
    return result;
  }

  async getTaxDocumentAccessLogs(documentId: string): Promise<TaxDocumentAccessLog[]> {
    return await this.db
      .select()
      .from(schema.taxDocumentAccessLog)
      .where(eq(schema.taxDocumentAccessLog.documentId, documentId))
      .orderBy(desc(schema.taxDocumentAccessLog.accessedAt));
  }

  // Tax Document Processing methods
  async processTaxDocument(documentId: string): Promise<{ success: boolean; extractedDataCount: number; errors?: string[] }> {
    // This is a placeholder implementation - actual processing would involve
    // PDF parsing, OCR, or JSON parsing depending on document type
    try {
      const document = await this.getTaxDocument(documentId);
      if (!document) {
        return { success: false, extractedDataCount: 0, errors: ['Document not found'] };
      }

      // Mark document as processing
      await this.updateTaxDocument(documentId, {
        processingStatus: 'processing',
        processingStartedAt: new Date()
      });

      throw new Error('Tax document processing service not configured. Document parsing API integration required.');

    } catch (error) {
      // Mark document as failed
      await this.updateTaxDocument(documentId, {
        processingStatus: 'failed',
        processingError: error instanceof Error ? error.message : 'Unknown error'
      });

      return { 
        success: false, 
        extractedDataCount: 0, 
        errors: [error instanceof Error ? error.message : 'Unknown error'] 
      };
    }
  }

  async validateTaxData(documentId: string): Promise<{ isValid: boolean; warnings: string[]; errors: string[] }> {
    const structuredData = await this.getStructuredTaxData(documentId);
    const warnings: string[] = [];
    const errors: string[] = [];

    // Validate each tax data entry
    for (const data of structuredData) {
      // Check for required fields
      if (!data.taxableAmount && !data.taxDeducted) {
        errors.push(`Missing amount data for entry ${data.id}`);
      }

      // Check for reasonable values
      if (data.taxableAmount && parseFloat(data.taxableAmount) < 0) {
        errors.push(`Negative taxable amount for entry ${data.id}`);
      }

      if (data.taxDeducted && parseFloat(data.taxDeducted) < 0) {
        errors.push(`Negative tax deducted for entry ${data.id}`);
      }

      // Check for missing PAN numbers
      if (!data.deductorPan && data.dataType === 'TDS') {
        warnings.push(`Missing deductor PAN for TDS entry ${data.id}`);
      }
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors
    };
  }

  async generateITRJson(userId: string, financialYear: string): Promise<{ itrJson: string; warnings: string[] }> {
    // Get all structured tax data for the user and financial year
    const taxData = await this.getStructuredTaxDataByUser(userId, financialYear);
    const warnings: string[] = [];

    // Group data by type
    const groupedData = this.groupTaxDataByType(taxData);

    // Generate ITR JSON structure (simplified)
    const itrJson = {
      itrType: this.determineITRType(groupedData),
      financialYear,
      assessmentYear: this.getAssessmentYear(financialYear),
      personalInfo: await this.getUserProfile(userId),
      income: {
        salary: this.calculateSalaryIncome(groupedData.salary || []),
        houseProperty: 0,
        businessProfession: 0,
        capitalGains: this.calculateCapitalGains(groupedData.capital_gains || []),
        otherSources: this.calculateOtherIncome(groupedData.interest || [], groupedData.dividend || [])
      },
      deductions: {
        chapter6A: this.calculateDeductions(groupedData),
        totalDeductions: 0
      },
      taxComputation: {
        totalIncome: 0,
        taxPayable: 0,
        taxPaid: this.calculateTaxPaid(groupedData.TDS || [], groupedData.advance_tax || [])
      }
    };

    // Calculate totals
    const totalIncome = Object.values(itrJson.income).reduce((sum: number, val: number) => sum + val, 0);
    itrJson.taxComputation.totalIncome = totalIncome - itrJson.deductions.totalDeductions;

    return {
      itrJson: JSON.stringify(itrJson, null, 2),
      warnings
    };
  }

  async calculateTaxLiability(userId: string, financialYear: string, taxRegime: 'old' | 'new'): Promise<TaxCalculation> {
    // Get structured tax data
    const taxData = await this.getStructuredTaxDataByUser(userId, financialYear);
    const groupedData = this.groupTaxDataByType(taxData);

    // Calculate total income
    const salaryIncome = this.calculateSalaryIncome(groupedData.salary || []);
    const capitalGains = this.calculateCapitalGains(groupedData.capital_gains || []);
    const otherIncome = this.calculateOtherIncome(groupedData.interest || [], groupedData.dividend || []);
    const totalIncome = salaryIncome + capitalGains + otherIncome;

    // Calculate deductions (simplified)
    const standardDeduction = taxRegime === 'new' ? 50000 : 50000;
    const section80cDeductions = taxRegime === 'new' ? 0 : 150000; // Simplified
    const totalDeductions = standardDeduction + section80cDeductions;

    // Calculate taxable income
    const taxableIncome = Math.max(0, totalIncome - totalDeductions);

    // Calculate tax liability based on regime
    const grossTaxLiability = this.calculateTaxBySlabs(taxableIncome, taxRegime);
    const educationCess = grossTaxLiability * 0.04; // 4% education cess
    const totalTaxPayable = grossTaxLiability + educationCess;

    // Calculate tax paid
    const tdsDeducted = this.calculateTaxPaid(groupedData.TDS || [], []);
    const advanceTaxPaid = this.calculateTaxPaid([], groupedData.advance_tax || []);
    const totalTaxPaid = tdsDeducted + advanceTaxPaid;

    // Calculate refund or payable
    const refundDue = Math.max(0, totalTaxPaid - totalTaxPayable);
    const taxPayable = Math.max(0, totalTaxPayable - totalTaxPaid);

    const calculation = await this.createTaxCalculation({
      userId,
      financialYear,
      taxRegime,
      totalIncome: totalIncome.toString(),
      taxableIncome: taxableIncome.toString(),
      standardDeduction: standardDeduction.toString(),
      section80cDeductions: section80cDeductions.toString(),
      totalDeductions: totalDeductions.toString(),
      grossTaxLiability: grossTaxLiability.toString(),
      educationCess: educationCess.toString(),
      totalTaxPayable: totalTaxPayable.toString(),
      tdsDeducted: tdsDeducted.toString(),
      advanceTaxPaid: advanceTaxPaid.toString(),
      totalTaxPaid: totalTaxPaid.toString(),
      refundDue: refundDue.toString(),
      taxPayable: taxPayable.toString(),
      incomeBreakdown: {
        salary: salaryIncome,
        capitalGains,
        otherIncome
      },
      deductionBreakdown: {
        standardDeduction,
        section80c: section80cDeductions
      },
      taxBreakdown: this.getTaxSlabBreakdown(taxableIncome, taxRegime)
    });

    return calculation;
  }

  private groupTaxDataByType(taxData: any[]): Record<string, any[]> {
    return taxData.reduce((groups, item) => {
      const type = item.dataType;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(item);
      return groups;
    }, {});
  }

  private determineITRType(groupedData: Record<string, any[]>): string {
    // Simplified ITR type determination
    if (groupedData.business || groupedData.profession) {
      return 'ITR-3';
    }
    if (groupedData.capital_gains || groupedData.house_property) {
      return 'ITR-2';
    }
    return 'ITR-1';
  }

  private getAssessmentYear(financialYear: string): string {
    const [startYear] = financialYear.split('-');
    const assessmentYear = parseInt(startYear) + 1;
    return `${assessmentYear}-${(assessmentYear + 1).toString().slice(-2)}`;
  }

  private calculateSalaryIncome(salaryData: any[]): number {
    return salaryData.reduce((total, item) => total + (parseFloat(item.taxableAmount) || 0), 0);
  }

  private calculateCapitalGains(capitalGainsData: any[]): number {
    return capitalGainsData.reduce((total, item) => total + (parseFloat(item.taxableAmount) || 0), 0);
  }

  private calculateOtherIncome(interestData: any[], dividendData: any[]): number {
    const interest = interestData.reduce((total, item) => total + (parseFloat(item.taxableAmount) || 0), 0);
    const dividend = dividendData.reduce((total, item) => total + (parseFloat(item.taxableAmount) || 0), 0);
    return interest + dividend;
  }

  private calculateDeductions(groupedData: Record<string, any[]>): any {
    // Simplified deduction calculation
    return {
      section80C: 150000, // Mock value
      section80D: 25000,  // Mock value
      total: 175000
    };
  }

  private calculateTaxPaid(tdsData: any[], advanceTaxData: any[]): number {
    const tds = tdsData.reduce((total, item) => total + (item.taxDeducted || 0), 0);
    const advanceTax = advanceTaxData.reduce((total, item) => total + (item.taxDeducted || 0), 0);
    return tds + advanceTax;
  }

  private calculateTaxBySlabs(taxableIncome: number, regime: 'old' | 'new'): number {
    if (regime === 'new') {
      // New tax regime slabs (2024-25)
      if (taxableIncome <= 300000) return 0;
      if (taxableIncome <= 700000) return (taxableIncome - 300000) * 0.05;
      if (taxableIncome <= 1000000) return 20000 + (taxableIncome - 700000) * 0.10;
      if (taxableIncome <= 1200000) return 50000 + (taxableIncome - 1000000) * 0.15;
      if (taxableIncome <= 1500000) return 80000 + (taxableIncome - 1200000) * 0.20;
      return 140000 + (taxableIncome - 1500000) * 0.30;
    } else {
      // Old tax regime slabs
      if (taxableIncome <= 250000) return 0;
      if (taxableIncome <= 500000) return (taxableIncome - 250000) * 0.05;
      if (taxableIncome <= 1000000) return 12500 + (taxableIncome - 500000) * 0.20;
      return 112500 + (taxableIncome - 1000000) * 0.30;
    }
  }

  private getTaxSlabBreakdown(taxableIncome: number, regime: 'old' | 'new'): any {
    // Return detailed breakdown of tax calculation by slabs
    return {
      regime,
      slabs: [
        { min: 0, max: regime === 'new' ? 300000 : 250000, rate: 0, tax: 0 },
        // Add more slabs as needed
      ]
    };
  }

  // Investment Ideas methods
  async createInvestmentIdea(idea: InsertInvestmentIdea): Promise<InvestmentIdea> {
    const [result] = await db.insert(schema.investmentIdeas).values(idea).returning();
    return result;
  }

  async getInvestmentIdeas(userId: string): Promise<InvestmentIdea[]> {
    return await db
      .select()
      .from(schema.investmentIdeas)
      .where(eq(schema.investmentIdeas.userId, userId))
      .orderBy(desc(schema.investmentIdeas.suggestedAt));
  }

  async getInvestmentIdea(id: string): Promise<InvestmentIdea | undefined> {
    const [result] = await db
      .select()
      .from(schema.investmentIdeas)
      .where(eq(schema.investmentIdeas.id, id))
      .limit(1);
    return result;
  }

  async updateInvestmentIdea(id: string, updates: Partial<InvestmentIdea>): Promise<InvestmentIdea | undefined> {
    const [result] = await db
      .update(schema.investmentIdeas)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.investmentIdeas.id, id))
      .returning();
    return result;
  }

  async deleteInvestmentIdea(id: string): Promise<boolean> {
    const result = await db
      .delete(schema.investmentIdeas)
      .where(eq(schema.investmentIdeas.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getActiveInvestmentIdeas(userId: string): Promise<InvestmentIdea[]> {
    return await db
      .select()
      .from(schema.investmentIdeas)
      .where(and(
        eq(schema.investmentIdeas.userId, userId),
        eq(schema.investmentIdeas.isActive, true)
      ))
      .orderBy(desc(schema.investmentIdeas.suggestedAt));
  }

  // Investment Idea Tracking methods
  async createInvestmentIdeaTracking(tracking: InsertInvestmentIdeaTracking): Promise<InvestmentIdeaTracking> {
    const [result] = await db.insert(schema.investmentIdeaTracking).values(tracking).returning();
    return result;
  }

  async getInvestmentIdeaTracking(ideaId: string): Promise<InvestmentIdeaTracking[]> {
    return await db
      .select()
      .from(schema.investmentIdeaTracking)
      .where(eq(schema.investmentIdeaTracking.ideaId, ideaId))
      .orderBy(desc(schema.investmentIdeaTracking.trackingDate));
  }

  async getLatestIdeaTracking(ideaId: string): Promise<InvestmentIdeaTracking | undefined> {
    const [result] = await db
      .select()
      .from(schema.investmentIdeaTracking)
      .where(eq(schema.investmentIdeaTracking.ideaId, ideaId))
      .orderBy(desc(schema.investmentIdeaTracking.trackingDate))
      .limit(1);
    return result;
  }

  // Investment Idea Alerts methods
  async createInvestmentIdeaAlert(alert: InsertInvestmentIdeaAlert): Promise<InvestmentIdeaAlert> {
    const [result] = await db.insert(schema.investmentIdeaAlerts).values(alert).returning();
    return result;
  }

  async getInvestmentIdeaAlerts(userId: string): Promise<InvestmentIdeaAlert[]> {
    return await db
      .select()
      .from(schema.investmentIdeaAlerts)
      .where(eq(schema.investmentIdeaAlerts.userId, userId))
      .orderBy(desc(schema.investmentIdeaAlerts.triggeredAt));
  }

  async getUnreadAlerts(userId: string): Promise<InvestmentIdeaAlert[]> {
    return await db
      .select()
      .from(schema.investmentIdeaAlerts)
      .where(and(
        eq(schema.investmentIdeaAlerts.userId, userId),
        eq(schema.investmentIdeaAlerts.isRead, false)
      ))
      .orderBy(desc(schema.investmentIdeaAlerts.triggeredAt));
  }

  async markInvestmentIdeaAlertAsRead(id: string): Promise<InvestmentIdeaAlert | undefined> {
    const [result] = await db
      .update(schema.investmentIdeaAlerts)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(schema.investmentIdeaAlerts.id, id))
      .returning();
    return result;
  }

  // Yield Tracker methods
  async createYieldTracker(tracker: InsertYieldTracker): Promise<YieldTracker> {
    const [result] = await db.insert(schema.yieldTracker).values(tracker).returning();
    return result;
  }

  async getYieldTrackers(userId: string): Promise<YieldTracker[]> {
    return await db
      .select()
      .from(schema.yieldTracker)
      .where(eq(schema.yieldTracker.userId, userId))
      .orderBy(desc(schema.yieldTracker.lastUpdated));
  }

  async getYieldTracker(id: string): Promise<YieldTracker | undefined> {
    const [result] = await db
      .select()
      .from(schema.yieldTracker)
      .where(eq(schema.yieldTracker.id, id))
      .limit(1);
    return result;
  }

  async updateYieldTracker(id: string, updates: Partial<YieldTracker>): Promise<YieldTracker | undefined> {
    const [result] = await db
      .update(schema.yieldTracker)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(schema.yieldTracker.id, id))
      .returning();
    return result;
  }

  async deleteYieldTracker(id: string): Promise<boolean> {
    const result = await db
      .delete(schema.yieldTracker)
      .where(eq(schema.yieldTracker.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Partner Application methods
  async createPartnerApplication(application: InsertPartnerApplication): Promise<PartnerApplication> {
    const [result] = await db.insert(schema.partnerApplications).values(application).returning();
    return result;
  }

  async getPartnerApplicationsByUserId(userId: string): Promise<PartnerApplication[]> {
    return await db
      .select()
      .from(schema.partnerApplications)
      .where(eq(schema.partnerApplications.userId, userId))
      .orderBy(desc(schema.partnerApplications.createdAt));
  }

  async getPartnerApplication(id: string): Promise<PartnerApplication | undefined> {
    const [result] = await db
      .select()
      .from(schema.partnerApplications)
      .where(eq(schema.partnerApplications.id, id))
      .limit(1);
    return result;
  }

  async updatePartnerApplication(id: string, updates: Partial<PartnerApplication>): Promise<PartnerApplication | undefined> {
    const [result] = await db
      .update(schema.partnerApplications)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.partnerApplications.id, id))
      .returning();
    return result;
  }

  async updateApplicationStatus(id: string, status: string, providerApplicationId?: string, statusUpdates?: any[]): Promise<PartnerApplication | undefined> {
    const updateData: any = { 
      status, 
      updatedAt: new Date()
    };
    
    if (providerApplicationId) {
      updateData.providerApplicationId = providerApplicationId;
    }
    
    if (status === 'submitted' && !updateData.submittedAt) {
      updateData.submittedAt = new Date();
    }
    
    if (statusUpdates) {
      updateData.statusUpdates = statusUpdates;
    }

    const [result] = await db
      .update(schema.partnerApplications)
      .set(updateData)
      .where(eq(schema.partnerApplications.id, id))
      .returning();
    return result;
  }

  async getApplicationsByLender(lender: string, status?: string): Promise<PartnerApplication[]> {
    if (status) {
      return db
        .select()
        .from(schema.partnerApplications)
        .where(and(
          eq(schema.partnerApplications.lender, lender),
          eq(schema.partnerApplications.status, status)
        ))
        .orderBy(desc(schema.partnerApplications.createdAt));
    }
    
    return db
      .select()
      .from(schema.partnerApplications)
      .where(eq(schema.partnerApplications.lender, lender))
      .orderBy(desc(schema.partnerApplications.createdAt));
  }

  async getApplicationPrefillData(userId: string, lender: string, recommendationId?: string): Promise<any> {
    // Get user profile for pre-filling
    const userProfile = await this.getUserProfile(userId);
    const user = await this.getUser(userId);
    
    if (!userProfile || !user) {
      throw new Error('User profile not found for prefill data');
    }

    // Base prefill data from user profile
    const prefillData: any = {
      // Personal Information
      panNumber: userProfile.panNumber,
      aadharNumber: userProfile.aadharNumber,
      currentAddress: userProfile.address || `${userProfile.city}, ${userProfile.state}, ${userProfile.country}`,
      employmentType: userProfile.occupation || 'salaried',
      monthlyIncome: userProfile.annualIncome ? Math.round(parseFloat(userProfile.annualIncome) / 12) : 0,
      workExperience: 5, // Default value since workExperience doesn't exist in schema
      
      // Banking Information
      bankName: '', // primaryBankName doesn't exist in schema
      
      // Contact Information
      email: user.email,
      mobile: user.mobile,
      
      // Employer Details
      employerName: userProfile.companyName || '',
      
      // Default loan parameters (can be overridden by recommendation)
      loanAmount: 500000, // Default 5L
      tenure: 36, // Default 3 years
      
      // Lender-specific defaults
      lender: lender,
      loanType: 'personal'
    };

    // If there's a recommendation, use its parameters
    if (recommendationId) {
      // You could fetch the recommendation details here to prefill loan amount, tenure, etc.
    }

    return prefillData;
  }

  // Application Document methods
  async createApplicationDocument(document: InsertPartnerApplicationDocument): Promise<PartnerApplicationDocument> {
    const [result] = await db.insert(schema.partnerApplicationDocuments).values(document).returning();
    return result;
  }

  async getApplicationDocuments(applicationId: string): Promise<PartnerApplicationDocument[]> {
    return await db
      .select()
      .from(schema.partnerApplicationDocuments)
      .where(eq(schema.partnerApplicationDocuments.applicationId, applicationId))
      .orderBy(desc(schema.partnerApplicationDocuments.uploadedAt));
  }

  async getApplicationDocument(id: string): Promise<PartnerApplicationDocument | undefined> {
    const [result] = await db
      .select()
      .from(schema.partnerApplicationDocuments)
      .where(eq(schema.partnerApplicationDocuments.id, id))
      .limit(1);
    return result;
  }

  async getApplicationDocumentsByType(applicationId: string, documentType: string): Promise<PartnerApplicationDocument[]> {
    return await db
      .select()
      .from(schema.partnerApplicationDocuments)
      .where(and(
        eq(schema.partnerApplicationDocuments.applicationId, applicationId),
        eq(schema.partnerApplicationDocuments.documentType, documentType)
      ))
      .orderBy(desc(schema.partnerApplicationDocuments.uploadedAt));
  }

  async updateApplicationDocument(id: string, updates: Partial<PartnerApplicationDocument>): Promise<PartnerApplicationDocument | undefined> {
    const [result] = await db
      .update(schema.partnerApplicationDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.partnerApplicationDocuments.id, id))
      .returning();
    return result;
  }

  async deleteApplicationDocument(id: string): Promise<boolean> {
    const result = await db
      .delete(schema.partnerApplicationDocuments)
      .where(eq(schema.partnerApplicationDocuments.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Cashfree Transaction methods
  async createCashfreeTransaction(transaction: InsertCashfreeTransaction): Promise<CashfreeTransaction> {
    const [result] = await db.insert(schema.cashfreeTransactions).values(transaction).returning();
    return result;
  }

  async getCashfreeTransaction(id: string): Promise<CashfreeTransaction | undefined> {
    const [result] = await db
      .select()
      .from(schema.cashfreeTransactions)
      .where(eq(schema.cashfreeTransactions.id, id))
      .limit(1);
    return result;
  }

  async getCashfreeTransactionByOrderId(orderId: string): Promise<CashfreeTransaction | undefined> {
    const [result] = await db
      .select()
      .from(schema.cashfreeTransactions)
      .where(eq(schema.cashfreeTransactions.orderId, orderId))
      .limit(1);
    return result;
  }

  async updateCashfreeTransaction(id: string, updates: Partial<CashfreeTransaction>): Promise<CashfreeTransaction | undefined> {
    const [result] = await db
      .update(schema.cashfreeTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.cashfreeTransactions.id, id))
      .returning();
    return result;
  }

  async getCashfreeTransactionsByUserId(userId: string): Promise<CashfreeTransaction[]> {
    return await db
      .select()
      .from(schema.cashfreeTransactions)
      .where(eq(schema.cashfreeTransactions.userId, userId))
      .orderBy(desc(schema.cashfreeTransactions.createdAt));
  }

  async getCashfreeTransactionsByStatus(status: string): Promise<CashfreeTransaction[]> {
    return await db
      .select()
      .from(schema.cashfreeTransactions)
      .where(eq(schema.cashfreeTransactions.status, status))
      .orderBy(desc(schema.cashfreeTransactions.createdAt));
  }

  // PhonePe Transaction methods
  async createPhonePeTransaction(transaction: InsertPhonePeTransaction): Promise<PhonePeTransaction> {
    const [result] = await db.insert(schema.phonePeTransactions).values(transaction).returning();
    return result;
  }

  async getPhonePeTransaction(id: string): Promise<PhonePeTransaction | undefined> {
    const [result] = await db
      .select()
      .from(schema.phonePeTransactions)
      .where(eq(schema.phonePeTransactions.id, id))
      .limit(1);
    return result;
  }

  async getPhonePeTransactionByOrderId(orderId: string): Promise<PhonePeTransaction | undefined> {
    const [result] = await db
      .select()
      .from(schema.phonePeTransactions)
      .where(eq(schema.phonePeTransactions.orderId, orderId))
      .limit(1);
    return result;
  }

  async getPhonePeTransactionByMerchantId(merchantTransactionId: string): Promise<PhonePeTransaction | undefined> {
    const [result] = await db
      .select()
      .from(schema.phonePeTransactions)
      .where(eq(schema.phonePeTransactions.merchantTransactionId, merchantTransactionId))
      .limit(1);
    return result;
  }

  async updatePhonePeTransaction(id: string, updates: Partial<PhonePeTransaction>): Promise<PhonePeTransaction | undefined> {
    const [result] = await db
      .update(schema.phonePeTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.phonePeTransactions.id, id))
      .returning();
    return result;
  }

  async getPhonePeTransactionsByUserId(userId: string): Promise<PhonePeTransaction[]> {
    return await db
      .select()
      .from(schema.phonePeTransactions)
      .where(eq(schema.phonePeTransactions.userId, userId))
      .orderBy(desc(schema.phonePeTransactions.createdAt));
  }

  async getPhonePeTransactionsByStatus(status: string): Promise<PhonePeTransaction[]> {
    return await db
      .select()
      .from(schema.phonePeTransactions)
      .where(eq(schema.phonePeTransactions.status, status))
      .orderBy(desc(schema.phonePeTransactions.createdAt));
  }

  // Dynamic Tax Rules Management methods
  async getTaxRule(ruleType: string, category: string, date?: Date): Promise<TaxRule | undefined> {
    const queryDate = date || new Date();
    
    const [result] = await db
      .select()
      .from(schema.taxRules)
      .where(
        and(
          eq(schema.taxRules.ruleType, ruleType),
          eq(schema.taxRules.category, category),
          eq(schema.taxRules.isActive, true),
          lte(schema.taxRules.effectiveFrom, queryDate.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(schema.taxRules.effectiveFrom))
      .limit(1);
    
    return result;
  }

  async getActiveTaxRules(): Promise<TaxRule[]> {
    return await db
      .select()
      .from(schema.taxRules)
      .where(eq(schema.taxRules.isActive, true))
      .orderBy(asc(schema.taxRules.ruleType), asc(schema.taxRules.category));
  }

  async getTaxSlabs(category: string, date?: Date): Promise<TaxRule[]> {
    const effectiveDate = date || new Date();
    
    return await db
      .select()
      .from(schema.taxRules)
      .where(
        and(
          eq(schema.taxRules.ruleType, 'income_slab'),
          eq(schema.taxRules.category, category),
          eq(schema.taxRules.isActive, true),
          lte(schema.taxRules.effectiveFrom, effectiveDate.toISOString().split('T')[0]),
          sql`(${schema.taxRules.effectiveTo} IS NULL OR ${schema.taxRules.effectiveTo} >= ${effectiveDate.toISOString().split('T')[0]})`
        )
      )
      .orderBy(asc(schema.taxRules.minAmount));
  }

  async upsertTaxRule(rule: InsertTaxRule): Promise<TaxRule> {
    const existingRule = await this.getTaxRule(rule.ruleType, rule.category, new Date(rule.effectiveFrom));
    
    if (existingRule) {
      const [updated] = await db
        .update(schema.taxRules)
        .set({ ...rule, updatedAt: new Date() })
        .where(eq(schema.taxRules.id, existingRule.id))
        .returning();
      return updated;
    } else {
      const [inserted] = await db
        .insert(schema.taxRules)
        .values(rule)
        .returning();
      return inserted;
    }
  }

  // Tax Reminder Subscription methods
  async createTaxReminderSubscription(subscription: InsertTaxReminderSubscription): Promise<TaxReminderSubscription> {
    const [result] = await db
      .insert(schema.taxReminderSubscriptions)
      .values(subscription)
      .returning();
    return result;
  }

  async getUserTaxReminderSubscription(userId: string): Promise<TaxReminderSubscription | undefined> {
    const [result] = await db
      .select()
      .from(schema.taxReminderSubscriptions)
      .where(
        and(
          eq(schema.taxReminderSubscriptions.userId, userId),
          eq(schema.taxReminderSubscriptions.subscriptionStatus, 'active')
        )
      )
      .orderBy(desc(schema.taxReminderSubscriptions.createdAt))
      .limit(1);
    
    return result;
  }

  async updateTaxReminderSubscription(id: string, updates: Partial<TaxReminderSubscription>): Promise<TaxReminderSubscription | undefined> {
    const [result] = await db
      .update(schema.taxReminderSubscriptions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.taxReminderSubscriptions.id, id))
      .returning();
    
    return result;
  }

  // Capital Gains Tax Reminder methods
  async createCapitalGainsReminder(reminder: InsertCapitalGainsTaxReminder): Promise<CapitalGainsTaxReminder> {
    const [result] = await db
      .insert(schema.capitalGainsTaxReminders)
      .values(reminder)
      .returning();
    return result;
  }

  async getUpcomingReminders(userId: string): Promise<CapitalGainsTaxReminder[]> {
    const today = new Date().toISOString().split('T')[0];
    
    return await db
      .select()
      .from(schema.capitalGainsTaxReminders)
      .where(
        and(
          eq(schema.capitalGainsTaxReminders.userId, userId),
          gte(schema.capitalGainsTaxReminders.dueDate, today),
          eq(schema.capitalGainsTaxReminders.status, 'pending')
        )
      )
      .orderBy(asc(schema.capitalGainsTaxReminders.dueDate));
  }

  async updateCapitalGainsReminder(id: string, updates: Partial<CapitalGainsTaxReminder>): Promise<CapitalGainsTaxReminder | undefined> {
    const [result] = await db
      .update(schema.capitalGainsTaxReminders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.capitalGainsTaxReminders.id, id))
      .returning();
    
    return result;
  }

  async createFamilyGroup(data: InsertFamilyGroup): Promise<FamilyGroup> {
    const [result] = await db
      .insert(schema.familyGroups)
      .values(data)
      .returning();
    return result;
  }

  async getFamilyGroup(id: string): Promise<FamilyGroup | undefined> {
    const [result] = await db
      .select()
      .from(schema.familyGroups)
      .where(eq(schema.familyGroups.id, id))
      .limit(1);
    return result;
  }

  async getUserFamilies(userId: string): Promise<(FamilyGroup & {memberCount: number, role: string})[]> {
    const results = await db
      .select({
        id: schema.familyGroups.id,
        name: schema.familyGroups.name,
        createdBy: schema.familyGroups.createdBy,
        groupType: schema.familyGroups.groupType,
        description: schema.familyGroups.description,
        settings: schema.familyGroups.settings,
        createdAt: schema.familyGroups.createdAt,
        updatedAt: schema.familyGroups.updatedAt,
        memberCount: sql<number>`cast(count(distinct ${schema.familyMembers.id}) as integer)`,
        role: schema.familyMembers.role,
      })
      .from(schema.familyGroups)
      .innerJoin(
        schema.familyMembers,
        and(
          eq(schema.familyMembers.familyId, schema.familyGroups.id),
          eq(schema.familyMembers.userId, userId),
          eq(schema.familyMembers.invitationStatus, 'accepted')
        )
      )
      .groupBy(
        schema.familyGroups.id,
        schema.familyMembers.role
      );
    
    return results as (FamilyGroup & {memberCount: number, role: string})[];
  }

  async updateFamilyGroup(id: string, data: Partial<InsertFamilyGroup>): Promise<FamilyGroup> {
    const [result] = await db
      .update(schema.familyGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.familyGroups.id, id))
      .returning();
    return result;
  }

  async inviteFamilyMember(data: InsertFamilyMember): Promise<FamilyMember> {
    const [result] = await db
      .insert(schema.familyMembers)
      .values(data)
      .returning();
    return result;
  }

  async acceptFamilyInvitation(memberId: string, userId: string): Promise<FamilyMember> {
    const [result] = await db
      .update(schema.familyMembers)
      .set({
        invitationStatus: 'accepted',
        joinedAt: new Date(),
      })
      .where(
        and(
          eq(schema.familyMembers.id, memberId),
          eq(schema.familyMembers.userId, userId)
        )
      )
      .returning();
    return result;
  }

  async getFamilyMembers(familyId: string): Promise<(FamilyMember & {user: {email: string, firstName?: string, lastName?: string}})[]> {
    const results = await db
      .select({
        id: schema.familyMembers.id,
        familyId: schema.familyMembers.familyId,
        userId: schema.familyMembers.userId,
        role: schema.familyMembers.role,
        displayName: schema.familyMembers.displayName,
        invitationStatus: schema.familyMembers.invitationStatus,
        invitedBy: schema.familyMembers.invitedBy,
        invitedAt: schema.familyMembers.invitedAt,
        joinedAt: schema.familyMembers.joinedAt,
        leftAt: schema.familyMembers.leftAt,
        userEmail: schema.users.email,
        userFirstName: schema.userProfiles.firstName,
        userLastName: schema.userProfiles.lastName,
      })
      .from(schema.familyMembers)
      .innerJoin(schema.users, eq(schema.familyMembers.userId, schema.users.id))
      .leftJoin(schema.userProfiles, eq(schema.users.id, schema.userProfiles.userId))
      .where(eq(schema.familyMembers.familyId, familyId));
    
    return results.map(r => ({
      id: r.id,
      familyId: r.familyId,
      userId: r.userId,
      role: r.role,
      displayName: r.displayName,
      invitationStatus: r.invitationStatus,
      invitedBy: r.invitedBy,
      invitedAt: r.invitedAt,
      joinedAt: r.joinedAt,
      leftAt: r.leftAt,
      user: {
        email: r.userEmail || '',
        firstName: r.userFirstName || undefined,
        lastName: r.userLastName || undefined,
      },
    }));
  }

  async updateMemberRole(memberId: string, role: string): Promise<FamilyMember> {
    const [result] = await db
      .update(schema.familyMembers)
      .set({ role })
      .where(eq(schema.familyMembers.id, memberId))
      .returning();
    return result;
  }

  async removeFamilyMember(memberId: string): Promise<void> {
    await db
      .update(schema.familyMembers)
      .set({ leftAt: new Date() })
      .where(eq(schema.familyMembers.id, memberId));
  }

  async checkFamilyMembership(familyId: string, userId: string): Promise<FamilyMember | undefined> {
    const [result] = await db
      .select()
      .from(schema.familyMembers)
      .where(
        and(
          eq(schema.familyMembers.familyId, familyId),
          eq(schema.familyMembers.userId, userId),
          eq(schema.familyMembers.invitationStatus, 'accepted')
        )
      )
      .limit(1);
    return result;
  }

  async createFamilyGoal(data: InsertFamilyGoal): Promise<FamilyGoal> {
    const [result] = await db
      .insert(schema.familyGoals)
      .values(data)
      .returning();
    return result;
  }

  async getFamilyGoals(familyId: string): Promise<FamilyGoal[]> {
    return await db
      .select()
      .from(schema.familyGoals)
      .where(eq(schema.familyGoals.familyId, familyId))
      .orderBy(desc(schema.familyGoals.createdAt));
  }

  async addGoalContribution(data: InsertFamilyGoalContribution): Promise<FamilyGoalContribution> {
    const [contribution] = await db
      .insert(schema.familyGoalContributions)
      .values(data)
      .returning();
    
    await db
      .update(schema.familyGoals)
      .set({
        currentAmount: sql`${schema.familyGoals.currentAmount} + ${data.amount}`,
      })
      .where(eq(schema.familyGoals.id, data.goalId));
    
    return contribution;
  }

  async getGoalContributions(goalId: string): Promise<(FamilyGoalContribution & {user: {firstName?: string, lastName?: string}})[]> {
    const results = await db
      .select({
        id: schema.familyGoalContributions.id,
        goalId: schema.familyGoalContributions.goalId,
        userId: schema.familyGoalContributions.userId,
        amount: schema.familyGoalContributions.amount,
        contributionDate: schema.familyGoalContributions.contributionDate,
        note: schema.familyGoalContributions.note,
        contributionType: schema.familyGoalContributions.contributionType,
        userFirstName: schema.userProfiles.firstName,
        userLastName: schema.userProfiles.lastName,
      })
      .from(schema.familyGoalContributions)
      .leftJoin(schema.userProfiles, eq(schema.familyGoalContributions.userId, schema.userProfiles.userId))
      .where(eq(schema.familyGoalContributions.goalId, goalId))
      .orderBy(desc(schema.familyGoalContributions.contributionDate));
    
    return results.map(r => ({
      id: r.id,
      goalId: r.goalId,
      userId: r.userId,
      amount: r.amount,
      contributionDate: r.contributionDate,
      note: r.note,
      contributionType: r.contributionType,
      user: {
        firstName: r.userFirstName || undefined,
        lastName: r.userLastName || undefined,
      },
    }));
  }

  async logFamilyActivity(data: InsertFamilyActivityLog): Promise<FamilyActivityLog> {
    const [result] = await db
      .insert(schema.familyActivityLogs)
      .values(data)
      .returning();
    return result;
  }

  async getFamilyActivities(familyId: string, limit: number = 50): Promise<FamilyActivityLog[]> {
    return await db
      .select()
      .from(schema.familyActivityLogs)
      .where(eq(schema.familyActivityLogs.familyId, familyId))
      .orderBy(desc(schema.familyActivityLogs.createdAt))
      .limit(limit);
  }

  async createDiscussion(data: InsertFamilyDiscussion): Promise<FamilyDiscussion> {
    const [result] = await db
      .insert(schema.familyDiscussions)
      .values(data)
      .returning();
    return result;
  }

  async getFamilyDiscussions(familyId: string): Promise<(FamilyDiscussion & {author: {firstName?: string, lastName?: string}, replyCount: number})[]> {
    const results = await db
      .select({
        id: schema.familyDiscussions.id,
        familyId: schema.familyDiscussions.familyId,
        topicType: schema.familyDiscussions.topicType,
        topicId: schema.familyDiscussions.topicId,
        subject: schema.familyDiscussions.subject,
        authorId: schema.familyDiscussions.authorId,
        content: schema.familyDiscussions.content,
        parentMessageId: schema.familyDiscussions.parentMessageId,
        attachments: schema.familyDiscussions.attachments,
        isResolved: schema.familyDiscussions.isResolved,
        isPinned: schema.familyDiscussions.isPinned,
        createdAt: schema.familyDiscussions.createdAt,
        updatedAt: schema.familyDiscussions.updatedAt,
        authorFirstName: schema.userProfiles.firstName,
        authorLastName: schema.userProfiles.lastName,
        replyCount: sql<number>`cast(count(replies.id) as integer)`,
      })
      .from(schema.familyDiscussions)
      .leftJoin(schema.userProfiles, eq(schema.familyDiscussions.authorId, schema.userProfiles.userId))
      .leftJoin(
        sql`${schema.familyDiscussions} as replies`,
        sql`replies.parent_message_id = ${schema.familyDiscussions.id}`
      )
      .where(
        and(
          eq(schema.familyDiscussions.familyId, familyId),
          sql`${schema.familyDiscussions.parentMessageId} IS NULL`
        )
      )
      .groupBy(
        schema.familyDiscussions.id,
        schema.userProfiles.firstName,
        schema.userProfiles.lastName
      )
      .orderBy(desc(schema.familyDiscussions.createdAt));
    
    return results.map(r => ({
      id: r.id,
      familyId: r.familyId,
      topicType: r.topicType,
      topicId: r.topicId,
      subject: r.subject,
      authorId: r.authorId,
      content: r.content,
      parentMessageId: r.parentMessageId,
      attachments: r.attachments,
      isResolved: r.isResolved,
      isPinned: r.isPinned,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      author: {
        firstName: r.authorFirstName || undefined,
        lastName: r.authorLastName || undefined,
      },
      replyCount: r.replyCount || 0,
    }));
  }

  async createFamilyBudget(data: InsertFamilyBudget): Promise<FamilyBudget> {
    const [result] = await db
      .insert(schema.familyBudgets)
      .values(data)
      .returning();
    return result;
  }

  async getFamilyBudgets(familyId: string): Promise<FamilyBudget[]> {
    return await db
      .select()
      .from(schema.familyBudgets)
      .where(eq(schema.familyBudgets.familyId, familyId))
      .orderBy(desc(schema.familyBudgets.createdAt));
  }

  async updateFamilyBudgetSpend(budgetId: string, amount: number): Promise<FamilyBudget> {
    const [result] = await db
      .update(schema.familyBudgets)
      .set({
        currentSpend: sql`${schema.familyBudgets.currentSpend} + ${amount}`,
      })
      .where(eq(schema.familyBudgets.id, budgetId))
      .returning();
    return result;
  }

  async grantPortfolioPermission(data: InsertFamilyPortfolioPermission): Promise<FamilyPortfolioPermission> {
    const [result] = await db
      .insert(schema.familyPortfolioPermissions)
      .values(data)
      .returning();
    return result;
  }

  async checkPortfolioPermission(portfolioId: string, userId: string): Promise<FamilyPortfolioPermission | undefined> {
    const [result] = await db
      .select()
      .from(schema.familyPortfolioPermissions)
      .where(
        and(
          eq(schema.familyPortfolioPermissions.portfolioId, portfolioId),
          eq(schema.familyPortfolioPermissions.userId, userId)
        )
      )
      .limit(1);
    return result;
  }

  async getFamilyDashboardData(familyId: string): Promise<{totalNetWorth: number, memberCount: number, activeGoals: number, monthlyBudget: number}> {
    const memberCountResult = await db
      .select({
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(schema.familyMembers)
      .where(
        and(
          eq(schema.familyMembers.familyId, familyId),
          eq(schema.familyMembers.invitationStatus, 'accepted')
        )
      );
    
    const activeGoalsResult = await db
      .select({
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(schema.familyGoals)
      .where(
        and(
          eq(schema.familyGoals.familyId, familyId),
          eq(schema.familyGoals.status, 'active')
        )
      );
    
    const budgetResult = await db
      .select({
        total: sql<number>`cast(sum(${schema.familyBudgets.monthlyLimit}) as integer)`,
      })
      .from(schema.familyBudgets)
      .where(eq(schema.familyBudgets.familyId, familyId));
    
    const portfoliosResult = await db
      .select({
        userId: schema.familyMembers.userId,
        totalValue: schema.portfolios.totalValue,
      })
      .from(schema.familyMembers)
      .innerJoin(schema.portfolios, eq(schema.familyMembers.userId, schema.portfolios.userId))
      .where(
        and(
          eq(schema.familyMembers.familyId, familyId),
          eq(schema.familyMembers.invitationStatus, 'accepted')
        )
      );
    
    const totalNetWorth = portfoliosResult.reduce((sum, p) => {
      const value = parseFloat(p.totalValue || '0');
      return sum + value;
    }, 0);
    
    return {
      totalNetWorth,
      memberCount: memberCountResult[0]?.count || 0,
      activeGoals: activeGoalsResult[0]?.count || 0,
      monthlyBudget: budgetResult[0]?.total || 0,
    };
  }
  
  // Alert System methods
  async createUserAlert(alert: InsertUserAlert): Promise<UserAlert> {
    const [result] = await db
      .insert(schema.userAlerts)
      .values(alert)
      .returning();
    return result;
  }

  async getUserAlerts(userId: string, category?: string): Promise<UserAlert[]> {
    const conditions = [eq(schema.userAlerts.userId, userId)];
    if (category) {
      conditions.push(eq(schema.userAlerts.category, category));
    }
    
    return await db
      .select()
      .from(schema.userAlerts)
      .where(and(...conditions))
      .orderBy(desc(schema.userAlerts.createdAt));
  }

  async getUserAlert(id: string): Promise<UserAlert | undefined> {
    const [result] = await db
      .select()
      .from(schema.userAlerts)
      .where(eq(schema.userAlerts.id, id))
      .limit(1);
    return result;
  }

  async updateUserAlert(id: string, updates: Partial<InsertUserAlert>): Promise<UserAlert | undefined> {
    const [result] = await db
      .update(schema.userAlerts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userAlerts.id, id))
      .returning();
    return result;
  }

  async deleteUserAlert(id: string): Promise<boolean> {
    const result = await db
      .delete(schema.userAlerts)
      .where(eq(schema.userAlerts.id, id));
    return (result.rowCount || 0) > 0;
  }

  async toggleAlertStatus(id: string, isActive: boolean): Promise<UserAlert | undefined> {
    const [result] = await db
      .update(schema.userAlerts)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(schema.userAlerts.id, id))
      .returning();
    return result;
  }

  async getActiveAlertsByType(alertType: string): Promise<UserAlert[]> {
    return await db
      .select()
      .from(schema.userAlerts)
      .where(
        and(
          eq(schema.userAlerts.alertType, alertType),
          eq(schema.userAlerts.isActive, true)
        )
      );
  }

  async createAlertHistory(history: InsertAlertHistory): Promise<AlertHistory> {
    const [result] = await db
      .insert(schema.alertHistory)
      .values(history)
      .returning();
    
    // Update trigger count and last triggered date for the alert
    await db
      .update(schema.userAlerts)
      .set({
        triggerCount: sql`${schema.userAlerts.triggerCount} + 1`,
        lastTriggeredAt: new Date(),
      })
      .where(eq(schema.userAlerts.id, history.alertId));
    
    return result;
  }

  async getAlertHistory(alertId: string, limit: number = 50): Promise<AlertHistory[]> {
    return await db
      .select()
      .from(schema.alertHistory)
      .where(eq(schema.alertHistory.alertId, alertId))
      .orderBy(desc(schema.alertHistory.triggeredAt))
      .limit(limit);
  }

  async getUserAlertHistory(userId: string, limit: number = 50): Promise<AlertHistory[]> {
    return await db
      .select()
      .from(schema.alertHistory)
      .where(eq(schema.alertHistory.userId, userId))
      .orderBy(desc(schema.alertHistory.triggeredAt))
      .limit(limit);
  }

  async markAlertHistoryAsRead(historyId: string): Promise<AlertHistory | undefined> {
    const [result] = await db
      .update(schema.alertHistory)
      .set({ isRead: true })
      .where(eq(schema.alertHistory.id, historyId))
      .returning();
    return result;
  }

  async dismissAlert(historyId: string): Promise<AlertHistory | undefined> {
    const [result] = await db
      .update(schema.alertHistory)
      .set({ isDismissed: true })
      .where(eq(schema.alertHistory.id, historyId))
      .returning();
    return result;
  }

  async getAlertTemplates(category?: string): Promise<AlertTemplate[]> {
    const conditions = [eq(schema.alertTemplates.isActive, true)];
    if (category) {
      conditions.push(eq(schema.alertTemplates.category, category));
    }
    
    return await db
      .select()
      .from(schema.alertTemplates)
      .where(and(...conditions))
      .orderBy(desc(schema.alertTemplates.isPopular), asc(schema.alertTemplates.templateName));
  }

  async getPopularAlertTemplates(): Promise<AlertTemplate[]> {
    return await db
      .select()
      .from(schema.alertTemplates)
      .where(
        and(
          eq(schema.alertTemplates.isActive, true),
          eq(schema.alertTemplates.isPopular, true)
        )
      )
      .orderBy(desc(schema.alertTemplates.usageCount))
      .limit(10);
  }

  async createAlertFromTemplate(userId: string, templateId: string, customData?: any): Promise<UserAlert> {
    const [template] = await db
      .select()
      .from(schema.alertTemplates)
      .where(eq(schema.alertTemplates.id, templateId))
      .limit(1);
    
    if (!template) {
      throw new Error('Template not found');
    }
    
    // Merge template default config with custom data
    const config = { ...(template.defaultConfig || {}), ...(customData || {}) };
    
    // Build trigger condition from config
    const triggerCondition = {
      type: config.type || 'price_above',
      value: config.targetValue || config.threshold,
      operator: config.operator,
      timeframe: config.timeframe
    };
    
    const [result] = await db
      .insert(schema.userAlerts)
      .values({
        userId,
        alertName: config.alertName || template.templateName,
        alertType: template.templateType as any,
        category: template.category as any,
        symbol: config.symbol,
        triggerCondition,
        notificationChannels: config.notificationChannels || ['in_app'],
        isActive: true,
      })
      .returning();
    
    // Increment usage count for template
    await db
      .update(schema.alertTemplates)
      .set({
        usageCount: sql`${schema.alertTemplates.usageCount} + 1`,
      })
      .where(eq(schema.alertTemplates.id, templateId));
    
    return result;
  }
  
  // Chat System methods
  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    const [result] = await db
      .insert(schema.chatSessions)
      .values(session)
      .returning();
    return result;
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    const [result] = await db
      .select()
      .from(schema.chatSessions)
      .where(eq(schema.chatSessions.id, id))
      .limit(1);
    return result;
  }

  async getUserChatSessions(userId: string): Promise<ChatSession[]> {
    return db
      .select()
      .from(schema.chatSessions)
      .where(eq(schema.chatSessions.userId, userId))
      .orderBy(desc(schema.chatSessions.lastMessageAt));
  }

  async updateChatSession(id: string, updates: Partial<ChatSession>): Promise<ChatSession | undefined> {
    const [result] = await db
      .update(schema.chatSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.chatSessions.id, id))
      .returning();
    return result;
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [result] = await db
      .insert(schema.chatMessages)
      .values(message)
      .returning();
    
    await db
      .update(schema.chatSessions)
      .set({
        lastMessageAt: new Date(),
        messageCount: sql`${schema.chatSessions.messageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.chatSessions.id, message.sessionId));
    
    return result;
  }

  async getChatMessages(sessionId: string, limit: number = 50): Promise<ChatMessage[]> {
    return db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.sessionId, sessionId))
      .orderBy(asc(schema.chatMessages.createdAt))
      .limit(limit);
  }

  async updateChatMessage(id: string, updates: Partial<ChatMessage>): Promise<ChatMessage | undefined> {
    const [result] = await db
      .update(schema.chatMessages)
      .set(updates)
      .where(eq(schema.chatMessages.id, id))
      .returning();
    return result;
  }

  async getChatFunctions(): Promise<ChatFunction[]> {
    return db
      .select()
      .from(schema.chatFunctions)
      .where(eq(schema.chatFunctions.isEnabled, true))
      .orderBy(asc(schema.chatFunctions.category));
  }

  async getChatFunction(functionName: string): Promise<ChatFunction | undefined> {
    const [result] = await db
      .select()
      .from(schema.chatFunctions)
      .where(eq(schema.chatFunctions.functionName, functionName))
      .limit(1);
    return result;
  }

  async updateChatFunctionUsage(functionName: string, success: boolean): Promise<void> {
    const func = await this.getChatFunction(functionName);
    if (func) {
      const usageCount = Number(func.usageCount) || 0;
      const successRate = Number(func.successRate) || 0;
      
      const totalCalls = usageCount + 1;
      const successCalls = success 
        ? Math.round((successRate / 100) * usageCount) + 1
        : Math.round((successRate / 100) * usageCount);
      const newSuccessRate = (successCalls / totalCalls) * 100;

      await db
        .update(schema.chatFunctions)
        .set({
          usageCount: totalCalls,
          successRate: String(newSuccessRate),
          updatedAt: new Date(),
        })
        .where(eq(schema.chatFunctions.functionName, functionName));
    }
  }

  async createChatAction(action: InsertChatAction): Promise<ChatAction> {
    const [result] = await db
      .insert(schema.chatActions)
      .values(action)
      .returning();
    return result;
  }

  async getChatAction(id: string): Promise<ChatAction | undefined> {
    const [result] = await db
      .select()
      .from(schema.chatActions)
      .where(eq(schema.chatActions.id, id))
      .limit(1);
    return result;
  }

  async updateChatAction(id: string, updates: Partial<ChatAction>): Promise<ChatAction | undefined> {
    const [result] = await db
      .update(schema.chatActions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.chatActions.id, id))
      .returning();
    return result;
  }

  async getPendingChatActions(userId: string): Promise<ChatAction[]> {
    return db
      .select()
      .from(schema.chatActions)
      .where(
        and(
          eq(schema.chatActions.userId, userId),
          eq(schema.chatActions.status, 'pending_confirmation')
        )
      )
      .orderBy(desc(schema.chatActions.createdAt));
  }
  
  // Currency Exchange methods
  async getCurrencyRates(baseCurrency?: string): Promise<CurrencyRate[]> {
    if (baseCurrency) {
      return db
        .select()
        .from(schema.currencyRates)
        .where(eq(schema.currencyRates.baseCurrency, baseCurrency));
    }
    return db.select().from(schema.currencyRates);
  }

  async updateCurrencyRates(baseCurrency: string, rates: Record<string, number>): Promise<void> {
    for (const [targetCurrency, rate] of Object.entries(rates)) {
      await db
        .insert(schema.currencyRates)
        .values({
          baseCurrency,
          targetCurrency,
          exchangeRate: rate.toString(),
          dataSource: 'exchangerate-api',
        })
        .onConflictDoUpdate({
          target: [schema.currencyRates.baseCurrency, schema.currencyRates.targetCurrency],
          set: {
            exchangeRate: rate.toString(),
            lastUpdated: new Date(),
          },
        });
    }
  }

  async convertPortfolioValue(portfolioId: string, targetCurrency: string): Promise<number> {
    const portfolio = await this.getPortfolio(portfolioId);
    if (!portfolio) {
      throw new Error('Portfolio not found');
    }

    const baseCurrency = portfolio.baseCurrency || 'INR';
    if (baseCurrency === targetCurrency) {
      return parseFloat(portfolio.totalValue || '0');
    }

    // Get exchange rate
    const rate = await db.query.currencyRates.findFirst({
      where: and(
        eq(schema.currencyRates.baseCurrency, baseCurrency),
        eq(schema.currencyRates.targetCurrency, targetCurrency)
      ),
    });

    if (!rate) {
      throw new Error(`Exchange rate not found for ${baseCurrency} to ${targetCurrency}`);
    }

    return parseFloat(portfolio.totalValue || '0') * parseFloat(rate.exchangeRate);
  }

  async getUserFinancialAnalysis(userId: string): Promise<{
    monthlyIncome: number;
    annualIncome: number;
    monthlyObligations: number;
    availableForInvestment: number;
    currentInvestments: number;
    additionalCapacity: number;
    obligationRatio: number;
    creditScore: number | null;
    totalPortfolioValue: number;
    totalReturns: number;
    returnPercentage: number;
    panNumber: string | null;
    hasCompletedKyc: boolean;
    hasFinancialProfile: boolean;
  } | null> {
    try {
      // Get user profile for PAN and basic info
      const userProfile = await this.getUserProfile(userId);
      const panNumber = userProfile?.panNumber || null;
      
      // Get CKYC record for KYC status
      const ckycRecord = await this.getCkycRecord(userId);
      const hasCompletedKyc = ckycRecord?.status === 'CKYC_VERIFIED' || ckycRecord?.status === 'VERIFIED';
      
      // Get client financial profile
      const [financialProfile] = await db
        .select()
        .from(schema.creditProfiles)
        .where(eq(schema.creditProfiles.userId, userId))
        .limit(1);
      
      const hasFinancialProfile = !!financialProfile;
      
      // Calculate income (monthly and annual)
      let monthlyIncome = 0;
      let annualIncome = 0;
      
      if (financialProfile?.monthlyIncome) {
        monthlyIncome = parseFloat(financialProfile.monthlyIncome);
        annualIncome = monthlyIncome * 12;
      } else if (financialProfile?.annualIncome) {
        annualIncome = parseFloat(financialProfile.annualIncome);
        monthlyIncome = annualIncome / 12;
      } else if (userProfile?.annualIncome) {
        // Fallback to user profile annual income
        annualIncome = parseFloat(userProfile.annualIncome);
        monthlyIncome = annualIncome / 12;
      } else if (ckycRecord?.annualIncome) {
        // Last fallback to CKYC record
        annualIncome = parseFloat(ckycRecord.annualIncome);
        monthlyIncome = annualIncome / 12;
      }
      
      // Get monthly obligations (EMIs + credit card utilization)
      const monthlyObligations = financialProfile?.existingEMIs 
        ? parseFloat(financialProfile.existingEMIs) 
        : 0;
      
      // Get credit score
      const creditScore = financialProfile?.cibilScore || null;
      
      // Get all portfolios for the user
      const portfolios = await this.getPortfoliosByUserId(userId);
      
      // Calculate total portfolio value and current investments
      let totalPortfolioValue = 0;
      let totalInvestedAmount = 0;
      
      for (const portfolio of portfolios) {
        const portfolioValue = parseFloat(portfolio.totalValue || '0');
        totalPortfolioValue += portfolioValue;
        
        // Get holdings to calculate invested amount
        const holdings = await this.getPortfolioHoldings(portfolio.id);
        for (const holding of holdings) {
          const investedAmount = parseFloat(holding.quantity) * parseFloat(holding.avgPrice);
          totalInvestedAmount += investedAmount;
        }
      }
      
      // Calculate returns
      const totalReturns = totalPortfolioValue - totalInvestedAmount;
      const returnPercentage = totalInvestedAmount > 0 
        ? (totalReturns / totalInvestedAmount) * 100 
        : 0;
      
      // Calculate investment metrics
      const currentInvestments = totalInvestedAmount > 0 ? totalInvestedAmount / 12 : 0; // Monthly average
      const availableForInvestment = monthlyIncome - monthlyObligations;
      const additionalCapacity = availableForInvestment - currentInvestments;
      const obligationRatio = monthlyIncome > 0 
        ? (monthlyObligations / monthlyIncome) * 100 
        : 0;
      
      return {
        monthlyIncome: Math.round(monthlyIncome),
        annualIncome: Math.round(annualIncome),
        monthlyObligations: Math.round(monthlyObligations),
        availableForInvestment: Math.round(availableForInvestment),
        currentInvestments: Math.round(currentInvestments),
        additionalCapacity: Math.round(additionalCapacity),
        obligationRatio: Math.round(obligationRatio * 10) / 10, // Round to 1 decimal
        creditScore,
        totalPortfolioValue: Math.round(totalPortfolioValue),
        totalReturns: Math.round(totalReturns),
        returnPercentage: Math.round(returnPercentage * 10) / 10, // Round to 1 decimal
        panNumber,
        hasCompletedKyc,
        hasFinancialProfile,
      };
    } catch (error) {
      console.error('Error fetching user financial analysis:', error);
      return null;
    }
  }
  
  // Expense Management implementation
  async createExpense(expense: InsertUserExpense): Promise<UserExpense> {
    const [created] = await db.insert(schema.userExpenses).values(expense).returning();
    
    // Update budget spend if expense has category
    if (expense.category && expense.amount) {
      await this.updateUserBudgetSpend(expense.userId, expense.category, parseFloat(expense.amount.toString()));
    }
    
    return created;
  }
  
  async getExpense(id: string): Promise<UserExpense | undefined> {
    const [expense] = await db.select().from(schema.userExpenses).where(eq(schema.userExpenses.id, id));
    return expense || undefined;
  }
  
  async getUserExpenses(userId: string, filters: {
    startDate?: Date;
    endDate?: Date;
    category?: string;
    minAmount?: number;
    maxAmount?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<UserExpense[]> {
    let query = db.select().from(schema.userExpenses).where(eq(schema.userExpenses.userId, userId));
    
    const conditions: any[] = [eq(schema.userExpenses.userId, userId)];
    
    if (filters.startDate) {
      conditions.push(gte(schema.userExpenses.transactionDate, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(schema.userExpenses.transactionDate, filters.endDate));
    }
    if (filters.category) {
      conditions.push(eq(schema.userExpenses.category, filters.category));
    }
    if (filters.minAmount !== undefined) {
      conditions.push(gte(schema.userExpenses.amount, filters.minAmount.toString()));
    }
    if (filters.maxAmount !== undefined) {
      conditions.push(lte(schema.userExpenses.amount, filters.maxAmount.toString()));
    }
    
    const expenses = await db.select()
      .from(schema.userExpenses)
      .where(and(...conditions))
      .orderBy(desc(schema.userExpenses.transactionDate))
      .limit(filters.limit || 100)
      .offset(filters.offset || 0);
    
    return expenses;
  }
  
  async updateExpense(id: string, updates: Partial<UserExpense>): Promise<UserExpense | undefined> {
    // Get original expense to calculate delta
    const original = await this.getExpense(id);
    if (!original) return undefined;
    
    const [updated] = await db.update(schema.userExpenses)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userExpenses.id, id))
      .returning();
    
    if (!updated) return undefined;
    
    // Adjust budget if amount or category changed
    if (original.category && original.amount) {
      const originalAmount = parseFloat(original.amount.toString());
      const newCategory = updates.category || original.category;
      const newAmount = updates.amount ? parseFloat(updates.amount.toString()) : originalAmount;
      
      // If category changed, subtract from old category and add to new
      if (updates.category && updates.category !== original.category) {
        await this.updateUserBudgetSpend(updated.userId, original.category, -originalAmount);
        await this.updateUserBudgetSpend(updated.userId, newCategory, newAmount);
      } 
      // If only amount changed, adjust the delta
      else if (updates.amount) {
        const delta = newAmount - originalAmount;
        await this.updateUserBudgetSpend(updated.userId, original.category, delta);
      }
    }
    
    return updated;
  }
  
  async deleteExpense(id: string): Promise<void> {
    // Get expense to adjust budget before deletion
    const expense = await this.getExpense(id);
    
    await db.delete(schema.userExpenses).where(eq(schema.userExpenses.id, id));
    
    // Subtract deleted amount from budget
    if (expense && expense.category && expense.amount) {
      const amount = parseFloat(expense.amount.toString());
      await this.updateUserBudgetSpend(expense.userId, expense.category, -amount);
    }
  }
  
  async getExpensesByCategory(userId: string, startDate?: Date, endDate?: Date): Promise<Array<{ category: string; total: number; count: number }>> {
    const conditions: any[] = [eq(schema.userExpenses.userId, userId)];
    
    if (startDate) {
      conditions.push(gte(schema.userExpenses.transactionDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.userExpenses.transactionDate, endDate));
    }
    
    const results = await db.select({
      category: schema.userExpenses.category,
      total: sql<number>`SUM(CAST(${schema.userExpenses.amount} AS DECIMAL))`,
      count: sql<number>`COUNT(*)`
    })
      .from(schema.userExpenses)
      .where(and(...conditions))
      .groupBy(schema.userExpenses.category);
    
    return results.map(r => ({
      category: r.category,
      total: Number(r.total) || 0,
      count: Number(r.count) || 0
    }));
  }
  
  // Budget Management implementation
  async createBudget(budget: InsertUserBudget): Promise<UserBudget> {
    const [created] = await db.insert(schema.userBudgets).values(budget).returning();
    return created;
  }
  
  async getBudget(id: string): Promise<UserBudget | undefined> {
    const [budget] = await db.select().from(schema.userBudgets).where(eq(schema.userBudgets.id, id));
    return budget || undefined;
  }
  
  async getUserBudgets(userId: string, isActive?: boolean): Promise<UserBudget[]> {
    const conditions: any[] = [eq(schema.userBudgets.userId, userId)];
    
    if (isActive !== undefined) {
      conditions.push(eq(schema.userBudgets.isActive, isActive));
    }
    
    const budgets = await db.select()
      .from(schema.userBudgets)
      .where(and(...conditions))
      .orderBy(schema.userBudgets.category);
    
    return budgets;
  }
  
  async updateBudget(id: string, updates: Partial<UserBudget>): Promise<UserBudget | undefined> {
    const [updated] = await db.update(schema.userBudgets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.userBudgets.id, id))
      .returning();
    return updated || undefined;
  }
  
  async deleteBudget(id: string): Promise<void> {
    await db.delete(schema.userBudgets).where(eq(schema.userBudgets.id, id));
  }
  
  async updateUserBudgetSpend(userId: string, category: string, amount: number): Promise<void> {
    // Find active budgets for this category
    const budgets = await db.select()
      .from(schema.userBudgets)
      .where(and(
        eq(schema.userBudgets.userId, userId),
        eq(schema.userBudgets.category, category),
        eq(schema.userBudgets.isActive, true)
      ));
    
    for (const budget of budgets) {
      const currentSpend = parseFloat(budget.currentSpend?.toString() || '0');
      await db.update(schema.userBudgets)
        .set({ 
          currentSpend: (currentSpend + amount).toString(),
          updatedAt: new Date()
        })
        .where(eq(schema.userBudgets.id, budget.id));
    }
  }
  
  async resetBudgets(userId: string): Promise<void> {
    const now = new Date();
    
    // Only reset budgets where the period has rolled over
    // Get all active budgets for the user
    const budgets = await this.getUserBudgets(userId, true);
    
    for (const budget of budgets) {
      const lastReset = budget.lastResetDate ? new Date(budget.lastResetDate) : new Date(budget.startDate);
      let shouldReset = false;
      
      // Check if period has rolled over based on budget period
      switch (budget.period) {
        case 'daily':
          shouldReset = now.getDate() !== lastReset.getDate();
          break;
        case 'weekly':
          const weekDiff = Math.floor((now.getTime() - lastReset.getTime()) / (7 * 24 * 60 * 60 * 1000));
          shouldReset = weekDiff >= 1;
          break;
        case 'monthly':
          shouldReset = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
          break;
        case 'quarterly':
          const quarterDiff = Math.floor((now.getMonth() - lastReset.getMonth()) / 3);
          shouldReset = quarterDiff >= 1;
          break;
        case 'yearly':
          shouldReset = now.getFullYear() !== lastReset.getFullYear();
          break;
      }
      
      if (shouldReset) {
        await db.update(schema.userBudgets)
          .set({ 
            currentSpend: '0',
            lastResetDate: now,
            updatedAt: now
          })
          .where(eq(schema.userBudgets.id, budget.id));
      }
    }
  }
  
  // Expense Insights implementation
  async createInsight(insight: InsertExpenseInsight): Promise<ExpenseInsight> {
    const [created] = await db.insert(schema.expenseInsights).values(insight).returning();
    return created;
  }
  
  async getUserInsights(userId: string, status?: string): Promise<ExpenseInsight[]> {
    const conditions: any[] = [eq(schema.expenseInsights.userId, userId)];
    
    if (status) {
      conditions.push(eq(schema.expenseInsights.status, status));
    }
    
    const insights = await db.select()
      .from(schema.expenseInsights)
      .where(and(...conditions))
      .orderBy(desc(schema.expenseInsights.createdAt));
    
    return insights;
  }
  
  async updateInsight(id: string, updates: Partial<ExpenseInsight>): Promise<ExpenseInsight | undefined> {
    const [updated] = await db.update(schema.expenseInsights)
      .set(updates)
      .where(eq(schema.expenseInsights.id, id))
      .returning();
    return updated || undefined;
  }
  
  async dismissInsight(id: string): Promise<void> {
    await db.update(schema.expenseInsights)
      .set({ 
        status: 'dismissed',
        dismissedAt: new Date()
      })
      .where(eq(schema.expenseInsights.id, id));
  }
  
  // BBPS Helper methods implementation
  async getBbpsTransactionByReference(orderId: string): Promise<any | undefined> {
    const [transaction] = await db.select()
      .from(schema.bbpsTransactions)
      .where(eq(schema.bbpsTransactions.cashfreeOrderId, orderId));
    return transaction || undefined;
  }
  
  async getBbpsBillById(billId: string): Promise<any | undefined> {
    const [bill] = await db.select()
      .from(schema.bbpsCustomerBills)
      .where(eq(schema.bbpsCustomerBills.id, billId));
    return bill || undefined;
  }
  
  async getBbpsBillerById(billerId: string): Promise<any | undefined> {
    const [biller] = await db.select()
      .from(schema.bbpsBillers)
      .where(eq(schema.bbpsBillers.id, billerId));
    return biller || undefined;
  }
  
  async getBbpsCategoryById(categoryId: string): Promise<any | undefined> {
    const [category] = await db.select()
      .from(schema.bbpsCategories)
      .where(eq(schema.bbpsCategories.id, categoryId));
    return category || undefined;
  }
  
  // KYC Verification Session implementation
  async createKycVerificationSession(session: InsertKycVerificationSession): Promise<KycVerificationSession> {
    const [created] = await db.insert(schema.kycVerificationSessions).values(session).returning();
    return created;
  }
  
  async getKycVerificationSession(id: string): Promise<KycVerificationSession | undefined> {
    const [session] = await db.select()
      .from(schema.kycVerificationSessions)
      .where(eq(schema.kycVerificationSessions.id, id));
    return session || undefined;
  }
  
  async getActiveKycSession(userId: string): Promise<KycVerificationSession | undefined> {
    const [session] = await db.select()
      .from(schema.kycVerificationSessions)
      .where(
        and(
          eq(schema.kycVerificationSessions.userId, userId),
          eq(schema.kycVerificationSessions.isActive, true),
          sql`(${schema.kycVerificationSessions.expiresAt} IS NULL OR ${schema.kycVerificationSessions.expiresAt} >= NOW())`
        )
      )
      .orderBy(desc(schema.kycVerificationSessions.startedAt));
    return session || undefined;
  }
  
  async updateKycVerificationSession(id: string, updates: Partial<KycVerificationSession>): Promise<KycVerificationSession | undefined> {
    const [updated] = await db.update(schema.kycVerificationSessions)
      .set(updates)
      .where(eq(schema.kycVerificationSessions.id, id))
      .returning();
    return updated || undefined;
  }

  async updateKycSessionStepStatus(
    sessionId: string, 
    stepKey: string, 
    stepData: any
  ): Promise<KycVerificationSession | undefined> {
    // Get current session
    const session = await this.getKycVerificationSession(sessionId);
    if (!session) {
      return undefined;
    }
    
    // Get current stepStatus (or empty object)
    const currentStepStatus = (session.stepStatus as any) || {};
    
    // Get existing step data (or empty object) for deep merge
    const existingStepData = currentStepStatus[stepKey] || {};
    
    // Merge existing and new step data (preserves existing fields)
    const mergedStepData = {
      ...existingStepData,
      ...stepData
    };
    
    // Update the specific step with merged data
    const updatedStepStatus = {
      ...currentStepStatus,
      [stepKey]: mergedStepData
    };
    
    // Update the session with new stepStatus
    return await this.updateKycVerificationSession(sessionId, {
      stepStatus: updatedStepStatus
    });
  }
  
  async completeKycSession(id: string): Promise<void> {
    await db.update(schema.kycVerificationSessions)
      .set({ 
        currentStep: 'completed',
        completedAt: new Date(),
        isActive: false
      })
      .where(eq(schema.kycVerificationSessions.id, id));
  }

  async deactivateAllUserKycSessions(userId: string): Promise<void> {
    await db.update(schema.kycVerificationSessions)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.kycVerificationSessions.userId, userId),
          eq(schema.kycVerificationSessions.isActive, true)
        )
      );
  }
  
  // Manual KYC Submission implementation
  async createManualKycSubmission(submission: InsertManualKycSubmission): Promise<ManualKycSubmission> {
    const [created] = await db.insert(schema.manualKycSubmissions).values(submission).returning();
    return created;
  }
  
  async getManualKycSubmission(id: string): Promise<ManualKycSubmission | undefined> {
    const [submission] = await db.select()
      .from(schema.manualKycSubmissions)
      .where(eq(schema.manualKycSubmissions.id, id));
    return submission || undefined;
  }
  
  async getUserManualKycSubmissions(userId: string): Promise<ManualKycSubmission[]> {
    return await db.select()
      .from(schema.manualKycSubmissions)
      .where(eq(schema.manualKycSubmissions.userId, userId))
      .orderBy(desc(schema.manualKycSubmissions.createdAt));
  }
  
  async getAllManualKycSubmissions(filters?: { status?: string; applicantType?: string; limit?: number; offset?: number }): Promise<ManualKycSubmission[]> {
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(schema.manualKycSubmissions.status, filters.status));
    }
    if (filters?.applicantType) {
      conditions.push(eq(schema.manualKycSubmissions.applicantType, filters.applicantType));
    }
    
    let query = db.select().from(schema.manualKycSubmissions);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    query = query.orderBy(desc(schema.manualKycSubmissions.createdAt)) as any;
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }
    
    return await query;
  }
  
  async updateManualKycSubmission(id: string, updates: Partial<ManualKycSubmission>): Promise<ManualKycSubmission | undefined> {
    const [updated] = await db.update(schema.manualKycSubmissions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.manualKycSubmissions.id, id))
      .returning();
    return updated || undefined;
  }
  
  async reviewManualKycSubmission(id: string, reviewerId: string, status: string, notes?: string, rejectionReason?: string): Promise<ManualKycSubmission | undefined> {
    const [updated] = await db.update(schema.manualKycSubmissions)
      .set({
        status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: notes,
        rejectionReason,
        updatedAt: new Date()
      })
      .where(eq(schema.manualKycSubmissions.id, id))
      .returning();
    return updated || undefined;
  }
  
  // Manual KYC Document implementation
  async createManualKycDocument(document: InsertManualKycDocument): Promise<ManualKycDocument> {
    const [created] = await db.insert(schema.manualKycDocuments).values(document).returning();
    return created;
  }
  
  async getManualKycDocuments(submissionId: string): Promise<ManualKycDocument[]> {
    return await db.select()
      .from(schema.manualKycDocuments)
      .where(eq(schema.manualKycDocuments.submissionId, submissionId))
      .orderBy(desc(schema.manualKycDocuments.uploadedAt));
  }
  
  async updateManualKycDocument(id: string, updates: Partial<ManualKycDocument>): Promise<ManualKycDocument | undefined> {
    const [updated] = await db.update(schema.manualKycDocuments)
      .set(updates)
      .where(eq(schema.manualKycDocuments.id, id))
      .returning();
    return updated || undefined;
  }
  
  async getKycDashboardStats(): Promise<{
    totalSubmissions: number;
    pendingReviews: number;
    approvedCount: number;
    rejectedCount: number;
    tierDistribution: Record<string, number>;
    recentActivity: any[];
  }> {
    const manualSubmissions = await db.select().from(schema.manualKycSubmissions);
    const ckycRecords = await db.select().from(schema.ckycRecords);
    
    const allSubmissions = [...manualSubmissions, ...ckycRecords];
    
    const pendingReviews = manualSubmissions.filter(s => s.status === 'pending' || s.status === 'under_review').length;
    const approvedCount = allSubmissions.filter((s: any) => s.status === 'approved' || s.status === 'verified').length;
    const rejectedCount = allSubmissions.filter((s: any) => s.status === 'rejected').length;
    
    const tierDistribution: Record<string, number> = {};
    // Note: kycTier field doesn't exist in ckycRecords schema
    // Using default tier for now
    ckycRecords.forEach(record => {
      const tier = 'tier_1'; // Default tier as kycTier doesn't exist in schema
      tierDistribution[tier] = (tierDistribution[tier] || 0) + 1;
    });
    
    const recentActivity = await db.select()
      .from(schema.ckycStatusHistory)
      .orderBy(desc(schema.ckycStatusHistory.changedAt))
      .limit(10);
    
    return {
      totalSubmissions: allSubmissions.length,
      pendingReviews,
      approvedCount,
      rejectedCount,
      tierDistribution,
      recentActivity
    };
  }
  
  async getUnifiedKycSubmissions(filters?: {
    status?: string;
    tier?: string;
    assignedTo?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ submissions: any[]; total: number }> {
    const conditions = [];
    
    let manualQuery = db.select({
      id: schema.manualKycSubmissions.id,
      userId: schema.manualKycSubmissions.userId,
      type: sql<string>`'manual'`.as('type'),
      status: schema.manualKycSubmissions.status,
      tier: sql<string>`NULL`.as('tier'),
      createdAt: schema.manualKycSubmissions.createdAt,
      fullName: sql<string>`CONCAT(${schema.manualKycSubmissions.firstName}, ' ', ${schema.manualKycSubmissions.lastName})`.as('fullName'),
      email: schema.manualKycSubmissions.email,
      assignedTo: sql<string>`NULL`.as('assignedTo')
    }).from(schema.manualKycSubmissions);
    
    let ckycQuery = db.select({
      id: schema.ckycRecords.id,
      userId: schema.ckycRecords.userId,
      type: sql<string>`'ckyc'`.as('type'),
      status: schema.ckycRecords.status,
      tier: sql<string>`'tier_1'`.as('tier'), // kycTier doesn't exist in schema
      createdAt: schema.ckycRecords.createdAt,
      fullName: sql<string>`CONCAT(${schema.ckycRecords.firstName}, ' ', ${schema.ckycRecords.lastName})`.as('fullName'),
      email: schema.ckycRecords.emailAddress,
      assignedTo: sql<string>`NULL`.as('assignedTo')
    }).from(schema.ckycRecords);
    
    if (filters?.status) {
      manualQuery = manualQuery.where(eq(schema.manualKycSubmissions.status, filters.status)) as any;
      ckycQuery = ckycQuery.where(eq(schema.ckycRecords.status, filters.status)) as any;
    }
    
    if (filters?.tier) {
      // kycTier doesn't exist in schema, skip this filter for CKYC records
      // ckycQuery filter would go here if field existed
    }
    
    if (filters?.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      manualQuery = manualQuery.where(gte(schema.manualKycSubmissions.createdAt, fromDate)) as any;
      ckycQuery = ckycQuery.where(gte(schema.ckycRecords.createdAt, fromDate)) as any;
    }
    
    if (filters?.dateTo) {
      const toDate = new Date(filters.dateTo);
      manualQuery = manualQuery.where(lte(schema.manualKycSubmissions.createdAt, toDate)) as any;
      ckycQuery = ckycQuery.where(lte(schema.ckycRecords.createdAt, toDate)) as any;
    }
    
    const manualSubmissions = await manualQuery;
    const ckycSubmissions = await ckycQuery;
    
    let allSubmissions = [...manualSubmissions, ...ckycSubmissions];
    allSubmissions.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    
    const total = allSubmissions.length;
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    allSubmissions = allSubmissions.slice(offset, offset + limit);
    
    return { submissions: allSubmissions, total };
  }
  
  async getKycSubmissionDetails(submissionId: string): Promise<any | undefined> {
    const manualSubmission = await db.select()
      .from(schema.manualKycSubmissions)
      .where(eq(schema.manualKycSubmissions.id, submissionId))
      .limit(1);
    
    if (manualSubmission.length > 0) {
      const documents = await this.getManualKycDocuments(submissionId);
      return {
        type: 'manual',
        submission: manualSubmission[0],
        documents,
        history: []
      };
    }
    
    const ckycRecord = await db.select()
      .from(schema.ckycRecords)
      .where(eq(schema.ckycRecords.id, submissionId))
      .limit(1);
    
    if (ckycRecord.length > 0) {
      const documents = await db.select()
        .from(schema.ckycDocuments)
        .where(eq(schema.ckycDocuments.ckycRecordId, submissionId));
      
      const history = await db.select()
        .from(schema.ckycStatusHistory)
        .where(eq(schema.ckycStatusHistory.ckycRecordId, submissionId))
        .orderBy(desc(schema.ckycStatusHistory.changedAt));
      
      return {
        type: 'ckyc',
        submission: ckycRecord[0],
        documents,
        history
      };
    }
    
    return undefined;
  }
  
  async getAllKycDocuments(filters?: {
    status?: string;
    documentType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ documents: any[]; total: number }> {
    let manualDocsQuery = db.select({
      id: schema.manualKycDocuments.id,
      submissionId: schema.manualKycDocuments.submissionId,
      type: sql<string>`'manual'`.as('type'),
      documentType: schema.manualKycDocuments.documentType,
      documentUrl: schema.manualKycDocuments.documentUrl,
      fileName: schema.manualKycDocuments.fileName,
      verificationStatus: schema.manualKycDocuments.verificationStatus,
      uploadedAt: schema.manualKycDocuments.uploadedAt,
      verifiedAt: schema.manualKycDocuments.verifiedAt,
      verifiedBy: schema.manualKycDocuments.verifiedBy
    }).from(schema.manualKycDocuments);
    
    let ckycDocsQuery = db.select({
      id: schema.ckycDocuments.id,
      submissionId: schema.ckycDocuments.ckycRecordId,
      type: sql<string>`'ckyc'`.as('type'),
      documentType: schema.ckycDocuments.documentType,
      documentUrl: schema.ckycDocuments.documentUrl,
      fileName: sql<string>`NULL`.as('fileName'),
      verificationStatus: schema.ckycDocuments.verificationStatus,
      uploadedAt: schema.ckycDocuments.uploadedAt,
      verifiedAt: schema.ckycDocuments.verifiedAt,
      verifiedBy: sql<string>`NULL`.as('verifiedBy')
    }).from(schema.ckycDocuments);
    
    if (filters?.status) {
      manualDocsQuery = manualDocsQuery.where(eq(schema.manualKycDocuments.verificationStatus, filters.status)) as any;
      ckycDocsQuery = ckycDocsQuery.where(eq(schema.ckycDocuments.verificationStatus, filters.status)) as any;
    }
    
    if (filters?.documentType) {
      manualDocsQuery = manualDocsQuery.where(eq(schema.manualKycDocuments.documentType, filters.documentType)) as any;
      ckycDocsQuery = ckycDocsQuery.where(eq(schema.ckycDocuments.documentType, filters.documentType)) as any;
    }
    
    const manualDocs = await manualDocsQuery;
    const ckycDocs = await ckycDocsQuery;
    
    let allDocuments = [...manualDocs, ...ckycDocs];
    allDocuments.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    
    const total = allDocuments.length;
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    allDocuments = allDocuments.slice(offset, offset + limit);
    
    return { documents: allDocuments, total };
  }
  
  async verifyKycDocument(documentId: string, verifierId: string, status: string, notes?: string): Promise<any | undefined> {
    const manualDoc = await db.update(schema.manualKycDocuments)
      .set({
        verificationStatus: status,
        verifiedBy: verifierId,
        verifiedAt: new Date(),
        verificationNotes: notes
      })
      .where(eq(schema.manualKycDocuments.id, documentId))
      .returning();
    
    if (manualDoc.length > 0) {
      return manualDoc[0];
    }
    
    const ckycDoc = await db.update(schema.ckycDocuments)
      .set({
        verificationStatus: status,
        verifiedAt: new Date()
      })
      .where(eq(schema.ckycDocuments.id, documentId))
      .returning();
    
    return ckycDoc[0] || undefined;
  }
  
  async bulkVerifyKycDocuments(documentIds: string[], verifierId: string, status: string, notes?: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    for (const docId of documentIds) {
      try {
        await this.verifyKycDocument(docId, verifierId, status, notes);
        success++;
      } catch (error) {
        failed++;
      }
    }
    
    return { success, failed };
  }
  
  async bulkApproveKycSubmissions(submissionIds: string[], approverId: string, notes?: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    for (const subId of submissionIds) {
      try {
        const manualResult = await this.reviewManualKycSubmission(subId, approverId, 'approved', notes);
        if (manualResult) {
          success++;
          continue;
        }
        
        const ckycResult = await db.update(schema.ckycRecords)
          .set({
            status: 'verified',
            updatedAt: new Date()
          })
          .where(eq(schema.ckycRecords.id, subId))
          .returning();
        
        if (ckycResult.length > 0) {
          await db.insert(schema.ckycStatusHistory).values({
            ckycRecordId: subId,
            previousStatus: ckycResult[0].status,
            newStatus: 'verified',
            changedBy: approverId,
            reason: notes || 'Bulk approval',
            changedAt: new Date()
          });
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
    }
    
    return { success, failed };
  }
  
  async bulkRejectKycSubmissions(submissionIds: string[], rejectorId: string, reason: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    for (const subId of submissionIds) {
      try {
        const manualResult = await this.reviewManualKycSubmission(subId, rejectorId, 'rejected', undefined, reason);
        if (manualResult) {
          success++;
          continue;
        }
        
        const ckycResult = await db.update(schema.ckycRecords)
          .set({
            status: 'rejected',
            updatedAt: new Date()
          })
          .where(eq(schema.ckycRecords.id, subId))
          .returning();
        
        if (ckycResult.length > 0) {
          await db.insert(schema.ckycStatusHistory).values({
            ckycRecordId: subId,
            previousStatus: ckycResult[0].status,
            newStatus: 'rejected',
            changedBy: rejectorId,
            reason,
            changedAt: new Date()
          });
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
    }
    
    return { success, failed };
  }
  
  async bulkAssignKycSubmissions(submissionIds: string[], reviewerId: string, assignedBy: string): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    
    for (const subId of submissionIds) {
      try {
        const result = await db.update(schema.manualKycSubmissions)
          .set({
            reviewedBy: reviewerId,
            updatedAt: new Date()
          })
          .where(eq(schema.manualKycSubmissions.id, subId))
          .returning();
        
        if (result.length > 0) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        failed++;
      }
    }
    
    return { success, failed };
  }
  
  async getComplianceAlerts(filters?: {
    severity?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ alerts: any[]; total: number }> {
    let query = db.select().from(schema.complianceAuditTrail);
    const conditions = [];
    
    if (filters?.dateFrom) {
      conditions.push(gte(schema.complianceAuditTrail.createdAt, new Date(filters.dateFrom)));
    }
    
    if (filters?.dateTo) {
      conditions.push(lte(schema.complianceAuditTrail.createdAt, new Date(filters.dateTo)));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    query = query.orderBy(desc(schema.complianceAuditTrail.createdAt)) as any;
    
    const allRecords = await query;
    
    const alerts = allRecords.filter(r => 
      r.riskImpact === 'high' || r.complianceImpact === 'major' || r.complianceImpact === 'critical'
    ).map(record => ({
      ...record,
      severity: record.complianceImpact === 'critical' ? 'critical' : 
                record.riskImpact === 'high' ? 'high' : 'medium',
      status: 'pending'
    }));
    
    const total = alerts.length;
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    
    return { 
      alerts: alerts.slice(offset, offset + limit), 
      total 
    };
  }
  
  async getComplianceAuditTrail(filters?: {
    userId?: string;
    action?: string;
    performedBy?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ records: any[]; total: number }> {
    let query = db.select().from(schema.complianceAuditTrail);
    const conditions = [];
    
    if (filters?.userId) {
      conditions.push(eq(schema.complianceAuditTrail.userId, filters.userId));
    }
    
    if (filters?.action) {
      conditions.push(eq(schema.complianceAuditTrail.action, filters.action));
    }
    
    if (filters?.performedBy) {
      conditions.push(eq(schema.complianceAuditTrail.performedBy, filters.performedBy));
    }
    
    if (filters?.dateFrom) {
      conditions.push(gte(schema.complianceAuditTrail.createdAt, new Date(filters.dateFrom)));
    }
    
    if (filters?.dateTo) {
      conditions.push(lte(schema.complianceAuditTrail.createdAt, new Date(filters.dateTo)));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    query = query.orderBy(desc(schema.complianceAuditTrail.createdAt)) as any;
    
    const allRecords = await query;
    const total = allRecords.length;
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;
    
    return { 
      records: allRecords.slice(offset, offset + limit), 
      total 
    };
  }
  
  async resolveComplianceAlert(alertId: string, resolvedBy: string, resolution: string): Promise<any | undefined> {
    const [updated] = await db.update(schema.complianceAuditTrail)
      .set({
        metadata: sql`jsonb_set(COALESCE(metadata, '{}'::jsonb), '{resolved}', 'true'::jsonb)`,
      })
      .where(eq(schema.complianceAuditTrail.id, alertId))
      .returning();
    
    return updated || undefined;
  }
  
  async getComplianceStats(): Promise<{
    totalAlerts: number;
    criticalAlerts: number;
    pendingReviews: number;
    resolvedToday: number;
  }> {
    const allRecords = await db.select().from(schema.complianceAuditTrail);
    
    const alerts = allRecords.filter(r => 
      r.riskImpact === 'high' || r.complianceImpact === 'major' || r.complianceImpact === 'critical'
    );
    
    const criticalAlerts = alerts.filter(a => a.complianceImpact === 'critical').length;
    
    const manualSubmissions = await db.select()
      .from(schema.manualKycSubmissions)
      .where(or(
        eq(schema.manualKycSubmissions.status, 'pending'),
        eq(schema.manualKycSubmissions.status, 'under_review')
      ));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const resolvedToday = allRecords.filter(r => {
      const metadata = r.metadata as any;
      const createdAt = r.createdAt ? new Date(r.createdAt) : new Date(0);
      return metadata?.resolved && createdAt >= today;
    }).length;
    
    return {
      totalAlerts: alerts.length,
      criticalAlerts,
      pendingReviews: manualSubmissions.length,
      resolvedToday
    };
  }
  
  async getUserKycStatus(userId: string): Promise<any> {
    const user = await this.getUser(userId);
    const userProfile = await this.getUserProfile(userId);
    const ckycRecords = await db.select()
      .from(schema.ckycRecords)
      .where(eq(schema.ckycRecords.userId, userId));
    
    const manualSubmissions = await db.select()
      .from(schema.manualKycSubmissions)
      .where(eq(schema.manualKycSubmissions.userId, userId));
    
    return {
      userId,
      user,
      userProfile,
      kycTier: userProfile?.kycTier || 'basic', // kycTier is in userProfiles, not users
      kycStatus: ckycRecords[0]?.status || manualSubmissions[0]?.status || 'not_started',
      ckycRecords,
      manualSubmissions,
      totalDocuments: ckycRecords.length + manualSubmissions.length
    };
  }
  
  async updateUserKycTier(userId: string, tier: string, updatedBy: string, reason?: string): Promise<any | undefined> {
    // Get existing profile first
    const existingProfile = await this.getUserProfile(userId);
    const oldTier = existingProfile?.kycTier || 'basic';
    
    // Update userProfile, not users table (kycTier is in userProfiles)
    await this.upsertUserProfile({
      userId,
      kycTier: tier,
      kycTierUpgradedAt: new Date(),
      updatedAt: new Date()
    } as any);
    
    const updatedProfile = await this.getUserProfile(userId);
    
    if (updatedProfile) {
      await db.insert(schema.complianceAuditTrail).values({
        userId,
        action: 'kyc_tier_update',
        fieldChanged: 'kycTier',
        oldValue: oldTier,
        newValue: tier,
        reason: reason || 'Manual tier update',
        performedBy: updatedBy,
        performedByRole: 'admin',
        riskImpact: 'medium',
        complianceImpact: 'major',
        createdAt: new Date()
      });
    }
    
    return updatedProfile || undefined;
  }
  
  async requestUserReKyc(userId: string, requestedBy: string, reason: string): Promise<any> {
    // Update CKYC record status if exists, otherwise create notification
    const ckycRecords = await db.select()
      .from(schema.ckycRecords)
      .where(eq(schema.ckycRecords.userId, userId))
      .limit(1);
    
    if (ckycRecords.length > 0) {
      await db.update(schema.ckycRecords)
        .set({
          status: 'rekyc_required',
          updatedAt: new Date()
        })
        .where(eq(schema.ckycRecords.id, ckycRecords[0].id));
    }
    
    await db.insert(schema.complianceAuditTrail).values({
      userId,
      action: 'rekyc_requested',
      fieldChanged: 'kycStatus',
      newValue: 'rekyc_required',
      reason,
      performedBy: requestedBy,
      performedByRole: 'admin',
      riskImpact: 'high',
      complianceImpact: 'major',
      createdAt: new Date()
    });
    
    return {
      success: true,
      message: 'Re-KYC requested successfully'
    };
  }
  
  // Financial Operations - Admin implementations
  async getFinancialOrdersDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [totalOrders] = await db.select({ count: sql<number>`count(*)` }).from(schema.unifiedOrders);
    const [pendingOrders] = await db.select({ count: sql<number>`count(*)` }).from(schema.unifiedOrders).where(eq(schema.unifiedOrders.status, 'pending'));
    const [completedOrders] = await db.select({ count: sql<number>`count(*)` }).from(schema.unifiedOrders).where(eq(schema.unifiedOrders.status, 'completed'));
    
    const [totalRevenueResult] = await db.select({ 
      total: sql<string>`COALESCE(SUM(CAST(${schema.unifiedOrders.totalAmount} AS DECIMAL)), 0)::text` 
    }).from(schema.unifiedOrders).where(eq(schema.unifiedOrders.paymentStatus, 'completed'));
    
    const [todayRevenueResult] = await db.select({ 
      total: sql<string>`COALESCE(SUM(CAST(${schema.unifiedOrders.totalAmount} AS DECIMAL)), 0)::text` 
    }).from(schema.unifiedOrders)
      .where(and(
        eq(schema.unifiedOrders.paymentStatus, 'completed'),
        gte(schema.unifiedOrders.createdAt, today)
      ));
    
    const ordersByStatus = await db.select({
      status: schema.unifiedOrders.status,
      count: sql<number>`count(*)::int`
    }).from(schema.unifiedOrders).groupBy(schema.unifiedOrders.status);
    
    const ordersByProductType = await db.select({
      productType: schema.unifiedOrders.productType,
      count: sql<number>`count(*)::int`,
      revenue: sql<string>`COALESCE(SUM(CAST(${schema.unifiedOrders.totalAmount} AS DECIMAL)), 0)::text`
    }).from(schema.unifiedOrders)
      .where(eq(schema.unifiedOrders.paymentStatus, 'completed'))
      .groupBy(schema.unifiedOrders.productType);
    
    const recentOrders = await db.select()
      .from(schema.unifiedOrders)
      .orderBy(desc(schema.unifiedOrders.createdAt))
      .limit(10);
    
    return {
      totalOrders: totalOrders?.count || 0,
      pendingOrders: pendingOrders?.count || 0,
      completedOrders: completedOrders?.count || 0,
      totalRevenue: totalRevenueResult?.total || '0',
      todayRevenue: todayRevenueResult?.total || '0',
      ordersByStatus,
      ordersByProductType,
      recentOrders
    };
  }
  
  async getUnifiedOrders(filters?: {
    status?: string;
    productType?: string;
    paymentStatus?: string;
    executionStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(schema.unifiedOrders.status, filters.status));
    }
    if (filters?.productType) {
      conditions.push(eq(schema.unifiedOrders.productType, filters.productType));
    }
    if (filters?.paymentStatus) {
      conditions.push(eq(schema.unifiedOrders.paymentStatus, filters.paymentStatus));
    }
    if (filters?.executionStatus) {
      conditions.push(eq(schema.unifiedOrders.executionStatus, filters.executionStatus));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(schema.unifiedOrders.createdAt, new Date(filters.dateFrom)));
    }
    if (filters?.dateTo) {
      conditions.push(lte(schema.unifiedOrders.createdAt, new Date(filters.dateTo)));
    }
    if (filters?.search) {
      conditions.push(sql`(
        ${schema.unifiedOrders.orderNumber} ILIKE ${`%${filters.search}%`} OR
        ${schema.unifiedOrders.userId} ILIKE ${`%${filters.search}%`}
      )`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.unifiedOrders)
      .where(whereClause);
    
    const orders = await db.select()
      .from(schema.unifiedOrders)
      .where(whereClause)
      .orderBy(desc(schema.unifiedOrders.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);
    
    return { orders, total: count || 0 };
  }
  
  async getUnifiedOrderDetails(orderId: string) {
    const [order] = await db.select().from(schema.unifiedOrders).where(eq(schema.unifiedOrders.id, orderId));
    if (!order) return undefined;
    
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, order.userId));
    
    return {
      ...order,
      user: user ? {
        id: user.id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        mobile: user.mobile
      } : null
    };
  }

  async getUnifiedOrdersByUser(userId: string) {
    const orders = await db.select()
      .from(schema.unifiedOrders)
      .where(eq(schema.unifiedOrders.userId, userId))
      .orderBy(desc(schema.unifiedOrders.createdAt));
    
    return orders;
  }
  
  async getCashfreeTransactions(filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(schema.cashfreeTransactions.status, filters.status));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(schema.cashfreeTransactions.createdAt, new Date(filters.dateFrom)));
    }
    if (filters?.dateTo) {
      conditions.push(lte(schema.cashfreeTransactions.createdAt, new Date(filters.dateTo)));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.cashfreeTransactions)
      .where(whereClause);
    
    const transactions = await db.select()
      .from(schema.cashfreeTransactions)
      .where(whereClause)
      .orderBy(desc(schema.cashfreeTransactions.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);
    
    return { transactions, total: count || 0 };
  }
  
  async getPhonePeTransactions(filters?: {
    state?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    
    if (filters?.state) {
      conditions.push(eq(schema.phonePeTransactions.state, filters.state));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(schema.phonePeTransactions.createdAt, new Date(filters.dateFrom)));
    }
    if (filters?.dateTo) {
      conditions.push(lte(schema.phonePeTransactions.createdAt, new Date(filters.dateTo)));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.phonePeTransactions)
      .where(whereClause);
    
    const transactions = await db.select()
      .from(schema.phonePeTransactions)
      .where(whereClause)
      .orderBy(desc(schema.phonePeTransactions.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);
    
    return { transactions, total: count || 0 };
  }
  
  async getPaymentReconciliation(dateFrom?: string, dateTo?: string) {
    const cashfreeConditions = [];
    const phonePeConditions = [];
    
    if (dateFrom) {
      cashfreeConditions.push(gte(schema.cashfreeTransactions.createdAt, new Date(dateFrom)));
      phonePeConditions.push(gte(schema.phonePeTransactions.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      cashfreeConditions.push(lte(schema.cashfreeTransactions.createdAt, new Date(dateTo)));
      phonePeConditions.push(lte(schema.phonePeTransactions.createdAt, new Date(dateTo)));
    }
    
    const [cashfreeStats] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${schema.cashfreeTransactions.amount} AS DECIMAL)), 0)::text`,
      successCount: sql<number>`COUNT(CASE WHEN ${schema.cashfreeTransactions.status} = 'SUCCESS' THEN 1 END)::int`,
      failedCount: sql<number>`COUNT(CASE WHEN ${schema.cashfreeTransactions.status} = 'FAILED' THEN 1 END)::int`,
      pendingCount: sql<number>`COUNT(CASE WHEN ${schema.cashfreeTransactions.status} = 'PENDING' THEN 1 END)::int`
    }).from(schema.cashfreeTransactions)
      .where(cashfreeConditions.length > 0 ? and(...cashfreeConditions) : undefined);
    
    const [phonePeStats] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${schema.phonePeTransactions.amount} AS DECIMAL)), 0)::text`,
      successCount: sql<number>`COUNT(CASE WHEN ${schema.phonePeTransactions.state} = 'COMPLETED' THEN 1 END)::int`,
      failedCount: sql<number>`COUNT(CASE WHEN ${schema.phonePeTransactions.state} = 'FAILED' THEN 1 END)::int`,
      pendingCount: sql<number>`COUNT(CASE WHEN ${schema.phonePeTransactions.state} = 'PENDING' THEN 1 END)::int`
    }).from(schema.phonePeTransactions)
      .where(phonePeConditions.length > 0 ? and(...phonePeConditions) : undefined);
    
    const cashfreeTotal = parseFloat(cashfreeStats?.total || '0');
    const phonePeTotal = parseFloat(phonePeStats?.total || '0');
    
    return {
      cashfreeTotal: cashfreeStats?.total || '0',
      phonePeTotal: phonePeStats?.total || '0',
      totalCollected: (cashfreeTotal + phonePeTotal).toString(),
      successfulPayments: (cashfreeStats?.successCount || 0) + (phonePeStats?.successCount || 0),
      failedPayments: (cashfreeStats?.failedCount || 0) + (phonePeStats?.failedCount || 0),
      pendingPayments: (cashfreeStats?.pendingCount || 0) + (phonePeStats?.pendingCount || 0)
    };
  }
  
  async getRevenueAnalytics(dateFrom?: string, dateTo?: string) {
    const conditions = [eq(schema.unifiedOrders.paymentStatus, 'completed')];
    
    if (dateFrom) {
      conditions.push(gte(schema.unifiedOrders.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(schema.unifiedOrders.createdAt, new Date(dateTo)));
    }
    
    const whereClause = and(...conditions);
    
    const [totalRevenueResult] = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${schema.unifiedOrders.totalAmount} AS DECIMAL)), 0)::text`
    }).from(schema.unifiedOrders).where(whereClause);
    
    const revenueByProductType = await db.select({
      productType: schema.unifiedOrders.productType,
      revenue: sql<string>`COALESCE(SUM(CAST(${schema.unifiedOrders.totalAmount} AS DECIMAL)), 0)::text`,
      orders: sql<number>`count(*)::int`
    }).from(schema.unifiedOrders)
      .where(whereClause)
      .groupBy(schema.unifiedOrders.productType);
    
    const revenueByGateway = await db.select({
      gateway: schema.unifiedOrders.paymentGateway,
      revenue: sql<string>`COALESCE(SUM(CAST(${schema.unifiedOrders.totalAmount} AS DECIMAL)), 0)::text`,
      transactions: sql<number>`count(*)::int`
    }).from(schema.unifiedOrders)
      .where(whereClause)
      .groupBy(schema.unifiedOrders.paymentGateway);
    
    const dailyRevenue = await db.select({
      date: sql<string>`DATE(${schema.unifiedOrders.createdAt})::text`,
      revenue: sql<string>`COALESCE(SUM(CAST(${schema.unifiedOrders.totalAmount} AS DECIMAL)), 0)::text`
    }).from(schema.unifiedOrders)
      .where(whereClause)
      .groupBy(sql`DATE(${schema.unifiedOrders.createdAt})`)
      .orderBy(sql`DATE(${schema.unifiedOrders.createdAt})`);
    
    return {
      totalRevenue: totalRevenueResult?.total || '0',
      revenueByProductType,
      revenueByGateway,
      dailyRevenue
    };
  }
  
  async initiateRefund(orderId: string, amount: string, reason: string, initiatedBy: string) {
    const [order] = await db.select().from(schema.unifiedOrders).where(eq(schema.unifiedOrders.id, orderId));
    if (!order) throw new Error('Order not found');
    
    const [refund] = await db.insert(schema.orderRefunds).values({
      id: randomUUID(),
      orderId,
      amount,
      reason,
      status: 'pending',
      initiatedBy,
      createdAt: new Date()
    }).returning();
    
    return refund;
  }
  
  async getRefunds(filters?: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(schema.orderRefunds.status, filters.status));
    }
    if (filters?.dateFrom) {
      conditions.push(gte(schema.orderRefunds.createdAt, new Date(filters.dateFrom)));
    }
    if (filters?.dateTo) {
      conditions.push(lte(schema.orderRefunds.createdAt, new Date(filters.dateTo)));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(schema.orderRefunds)
      .where(whereClause);
    
    const refunds = await db.select()
      .from(schema.orderRefunds)
      .where(whereClause)
      .orderBy(desc(schema.orderRefunds.createdAt))
      .limit(filters?.limit || 50)
      .offset(filters?.offset || 0);
    
    return { refunds, total: count || 0 };
  }
  
  async updateRefundStatus(refundId: string, status: string, gatewayRefundId?: string) {
    const updateData: any = { status };
    if (gatewayRefundId) {
      updateData.gatewayRefundId = gatewayRefundId;
    }
    if (status === 'completed') {
      updateData.processedAt = new Date();
    }
    
    const [updated] = await db.update(schema.orderRefunds)
      .set(updateData)
      .where(eq(schema.orderRefunds.id, refundId))
      .returning();
    
    return updated;
  }

  // Agent Onboarding & Hierarchy Methods
  async getAgentById(agentId: string) {
    const [agent] = await db.select().from(schema.customerCareAgents).where(eq(schema.customerCareAgents.id, agentId));
    return agent;
  }

  async getAgentByEmail(email: string) {
    const [agent] = await db.select().from(schema.customerCareAgents).where(eq(schema.customerCareAgents.email, email));
    return agent;
  }

  async getAgentByArn(arnCode: string) {
    const [agent] = await db.select().from(schema.customerCareAgents).where(eq(schema.customerCareAgents.arnCode, arnCode));
    return agent;
  }

  async getAgentByEuin(euinNumber: string) {
    const [agent] = await db.select().from(schema.customerCareAgents).where(eq(schema.customerCareAgents.euinNumber, euinNumber));
    return agent;
  }

  async getAllAgentsByStatus(status?: string) {
    if (status) {
      return await db.select().from(schema.customerCareAgents).where(eq(schema.customerCareAgents.onboardingStatus, status));
    }
    return await db.select().from(schema.customerCareAgents);
  }

  async getSubAgents(masterAgentId: string) {
    return await db.select().from(schema.customerCareAgents).where(eq(schema.customerCareAgents.masterAgentId, masterAgentId));
  }

  async updateAgentVerificationStatus(agentId: string, updates: Partial<CustomerCareAgent>) {
    const [updated] = await db.update(schema.customerCareAgents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.customerCareAgents.id, agentId))
      .returning();
    return updated;
  }

  // Agent Document Management
  async uploadAgentDocument(document: InsertAgentDocument) {
    const [uploaded] = await db.insert(schema.agentDocuments).values(document).returning();
    return uploaded;
  }

  async getAgentDocuments(agentId: string) {
    return await db.select().from(schema.agentDocuments).where(eq(schema.agentDocuments.agentId, agentId));
  }

  async getAgentDocumentByType(agentId: string, documentType: string) {
    const [doc] = await db.select().from(schema.agentDocuments)
      .where(and(
        eq(schema.agentDocuments.agentId, agentId),
        eq(schema.agentDocuments.documentType, documentType)
      ));
    return doc;
  }

  async updateAgentDocumentVerification(documentId: string, status: string, verifiedBy: string, rejectionReason?: string) {
    const updateData: any = {
      verificationStatus: status,
      verifiedBy,
      verifiedAt: new Date(),
      updatedAt: new Date()
    };
    if (rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }
    const [updated] = await db.update(schema.agentDocuments)
      .set(updateData)
      .where(eq(schema.agentDocuments.id, documentId))
      .returning();
    return updated;
  }

  // AMFI Verification Logging
  async createAmfiVerificationLog(log: InsertAmfiVerificationLog) {
    const [created] = await db.insert(schema.amfiVerificationLog).values(log).returning();
    return created;
  }

  async getAmfiVerificationLogs(agentId?: string, verificationType?: string) {
    const conditions = [];
    if (agentId) {
      conditions.push(eq(schema.amfiVerificationLog.agentId, agentId));
    }
    if (verificationType) {
      conditions.push(eq(schema.amfiVerificationLog.verificationType, verificationType));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return await db.select().from(schema.amfiVerificationLog).where(whereClause).orderBy(desc(schema.amfiVerificationLog.createdAt));
  }

  // Agent Commission Splits
  async createCommissionSplit(split: InsertAgentCommissionSplit) {
    const [created] = await db.insert(schema.agentCommissionSplits).values(split).returning();
    return created;
  }

  async getCommissionSplits(subAgentId?: string, masterAgentId?: string) {
    const conditions = [];
    if (subAgentId) {
      conditions.push(eq(schema.agentCommissionSplits.subAgentId, subAgentId));
    }
    if (masterAgentId) {
      conditions.push(eq(schema.agentCommissionSplits.masterAgentId, masterAgentId));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return await db.select().from(schema.agentCommissionSplits).where(whereClause);
  }

  async getActiveCommissionSplit(subAgentId: string, productType?: string) {
    const conditions = [
      eq(schema.agentCommissionSplits.subAgentId, subAgentId),
      eq(schema.agentCommissionSplits.isActive, true)
    ];
    if (productType) {
      conditions.push(eq(schema.agentCommissionSplits.productType, productType));
    }
    const [split] = await db.select().from(schema.agentCommissionSplits).where(and(...conditions));
    return split;
  }

  async updateCommissionSplit(splitId: string, updates: Partial<AgentCommissionSplit>) {
    const [updated] = await db.update(schema.agentCommissionSplits)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.agentCommissionSplits.id, splitId))
      .returning();
    return updated;
  }

  // Agent Commission Tracking
  async createAgentCommission(commission: InsertAgentCommission) {
    const [created] = await db.insert(schema.agentCommissions).values(commission).returning();
    return created;
  }

  async getAgentCommissions(agentId?: string, filters?: { month?: string; productType?: string; settlementStatus?: string }) {
    const conditions = [];
    if (agentId) {
      conditions.push(eq(schema.agentCommissions.agentId, agentId));
    }
    if (filters?.month) {
      conditions.push(eq(schema.agentCommissions.month, filters.month));
    }
    if (filters?.productType) {
      conditions.push(eq(schema.agentCommissions.productType, filters.productType));
    }
    if (filters?.settlementStatus) {
      conditions.push(eq(schema.agentCommissions.agentSettlementStatus, filters.settlementStatus));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return await db.select().from(schema.agentCommissions).where(whereClause).orderBy(desc(schema.agentCommissions.transactionDate));
  }

  async getMasterAgentCommissions(masterAgentId: string, filters?: { month?: string; productType?: string }) {
    const conditions = [eq(schema.agentCommissions.masterAgentId, masterAgentId)];
    if (filters?.month) {
      conditions.push(eq(schema.agentCommissions.month, filters.month));
    }
    if (filters?.productType) {
      conditions.push(eq(schema.agentCommissions.productType, filters.productType));
    }
    return await db.select().from(schema.agentCommissions).where(and(...conditions)).orderBy(desc(schema.agentCommissions.transactionDate));
  }

  async updateCommissionSettlementStatus(commissionId: string, agentType: 'agent' | 'master', status: string) {
    const updateData: any = {};
    if (agentType === 'agent') {
      updateData.agentSettlementStatus = status;
      if (status === 'settled') {
        updateData.agentSettledAt = new Date();
      }
    } else {
      updateData.masterSettlementStatus = status;
      if (status === 'settled') {
        updateData.masterSettledAt = new Date();
      }
    }
    updateData.updatedAt = new Date();
    
    const [updated] = await db.update(schema.agentCommissions)
      .set(updateData)
      .where(eq(schema.agentCommissions.id, commissionId))
      .returning();
    return updated;
  }

  async getCommissionSummary(agentId: string, month?: string) {
    const conditions = [eq(schema.agentCommissions.agentId, agentId)];
    if (month) {
      conditions.push(eq(schema.agentCommissions.month, month));
    }
    
    const commissions = await db.select().from(schema.agentCommissions).where(and(...conditions));
    
    const totalEarned = commissions.reduce((sum, c) => sum + parseFloat(c.agentNetCommission.toString()), 0);
    const settled = commissions.filter(c => c.agentSettlementStatus === 'settled')
      .reduce((sum, c) => sum + parseFloat(c.agentNetCommission.toString()), 0);
    const pending = commissions.filter(c => c.agentSettlementStatus === 'pending')
      .reduce((sum, c) => sum + parseFloat(c.agentNetCommission.toString()), 0);
    
    return {
      totalEarned,
      settled,
      pending
    };
  }

  // Sub-Agent Dashboard Methods
  async getAgentReferralStats(agentId: string) {
    const relationships = await db.select()
      .from(schema.clientAgentRelationships)
      .where(eq(schema.clientAgentRelationships.agentId, agentId));

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthTimestamp = startOfMonth.getTime();

    const newReferralsThisMonth = relationships.filter(r => {
      if (!r.createdAt) return false;
      const createdAtTimestamp = r.createdAt instanceof Date ? r.createdAt.getTime() : new Date(r.createdAt).getTime();
      return createdAtTimestamp >= startOfMonthTimestamp;
    }).length;

    const activeClients = relationships.filter(r => r.status === 'active').length;
    const totalReferrals = relationships.length;
    const conversionRate = totalReferrals > 0 ? (activeClients / totalReferrals) * 100 : 0;

    const commissions = await db.select()
      .from(schema.agentCommissions)
      .where(eq(schema.agentCommissions.agentId, agentId));

    const totalEarnings = commissions.reduce((sum, c) => sum + parseFloat(c.agentNetCommission.toString()), 0);
    
    const currentMonthString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const earningsThisMonth = commissions
      .filter(c => c.month && c.month === currentMonthString)
      .reduce((sum, c) => sum + parseFloat(c.agentNetCommission.toString()), 0);

    const pendingCommission = commissions
      .filter(c => c.agentSettlementStatus === 'pending')
      .reduce((sum, c) => sum + parseFloat(c.agentNetCommission.toString()), 0);

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 10);
    const nextPayoutDate = nextMonth.toISOString().split('T')[0];

    return {
      totalReferrals,
      newReferralsThisMonth,
      activeClients,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      earningsThisMonth: Math.round(earningsThisMonth * 100) / 100,
      pendingCommission: Math.round(pendingCommission * 100) / 100,
      nextPayoutDate,
    };
  }

  async getReferredClients(agentId: string) {
    const relationships = await db.select()
      .from(schema.clientAgentRelationships)
      .where(eq(schema.clientAgentRelationships.agentId, agentId))
      .orderBy(desc(schema.clientAgentRelationships.createdAt));

    const clientsWithDetails = await Promise.all(relationships.map(async (rel) => {
      const [user] = await db.select()
        .from(schema.users)
        .where(eq(schema.users.id, rel.clientId));

      const clientCommissions = await db.select()
        .from(schema.agentCommissions)
        .where(and(
          eq(schema.agentCommissions.agentId, agentId),
          eq(schema.agentCommissions.clientId, rel.clientId)
        ));

      const totalEarnings = clientCommissions.reduce((sum, c) => 
        sum + parseFloat(c.agentNetCommission.toString()), 0
      );

      return {
        id: rel.id,
        firstName: user?.firstName || 'N/A',
        lastName: user?.lastName || '',
        email: user?.email || 'N/A',
        mobile: user?.mobile || 'N/A',
        status: rel.status || 'pending',
        interestedProducts: rel.assignedProducts || [],
        referredDate: rel.createdAt || new Date().toISOString(),
        totalEarnings: Math.round(totalEarnings * 100) / 100,
      };
    }));

    return clientsWithDetails;
  }

  async getAgentEarnings(agentId: string) {
    const commissions = await db.select()
      .from(schema.agentCommissions)
      .where(eq(schema.agentCommissions.agentId, agentId))
      .orderBy(desc(schema.agentCommissions.transactionDate));

    const earningsWithDetails = await Promise.all(commissions.map(async (comm) => {
      const [client] = comm.clientId ? await db.select()
        .from(schema.users)
        .where(eq(schema.users.id, comm.clientId)) : [null];

      const grossCommission = parseFloat(comm.grossCommission.toString());
      const agentNetCommission = parseFloat(comm.agentNetCommission.toString());
      const tdsAmount = parseFloat(comm.tdsAmount.toString());

      return {
        id: comm.id,
        transactionDate: comm.transactionDate || new Date().toISOString(),
        clientName: client ? `${client.firstName || ''} ${client.lastName || ''}`.trim() : 'N/A',
        productType: comm.productType || 'N/A',
        transactionType: comm.transactionType || 'N/A',
        transactionAmount: parseFloat(comm.transactionAmount.toString()),
        commissionRate: parseFloat(comm.commissionRate.toString()),
        marketingFee: agentNetCommission,
        tdsAmount: tdsAmount,
        netEarnings: agentNetCommission,
        paymentStatus: comm.agentSettlementStatus || 'pending',
      };
    }));

    return earningsWithDetails;
  }

  async createClientReferral(data: {
    agentId: string;
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    interestedProducts: string[];
    notes: string;
    status: string;
    referredDate: string;
  }) {
    const existingUser = await db.select()
      .from(schema.users)
      .where(eq(schema.users.email, data.email))
      .limit(1);

    let clientId: string;

    if (existingUser.length > 0) {
      clientId = existingUser[0].id;
    } else {
      const newUser = await this.createUser({
        userId: await generateUniqueUserId(data.email),
        email: data.email,
        mobile: data.mobile,
        firstName: data.firstName,
        lastName: data.lastName,
        password: '',
        role: 'user',
        isActive: false,
        twoFactorEnabled: false,
      });
      clientId = newUser.id;
    }

    const existingRelationship = await db.select()
      .from(schema.clientAgentRelationships)
      .where(and(
        eq(schema.clientAgentRelationships.clientId, clientId),
        eq(schema.clientAgentRelationships.agentId, data.agentId)
      ))
      .limit(1);

    if (existingRelationship.length > 0) {
      const [updated] = await db.update(schema.clientAgentRelationships)
        .set({
          status: data.status,
          assignedProducts: data.interestedProducts,
          notes: data.notes,
          updatedAt: new Date(),
        })
        .where(eq(schema.clientAgentRelationships.id, existingRelationship[0].id))
        .returning();
      return updated;
    }

    const [relationship] = await db.insert(schema.clientAgentRelationships)
      .values({
        id: randomUUID(),
        clientId,
        agentId: data.agentId,
        relationshipType: 'referral',
        status: data.status,
        assignedProducts: data.interestedProducts,
        notes: data.notes,
        createdAt: new Date(data.referredDate),
        updatedAt: new Date(),
      })
      .returning();

    return relationship;
  }

  // Pre-Approved Loan Offers Methods
  async getPreApprovedLoanOffers(userId: string): Promise<any[]> {
    const offers = await db.select()
      .from(schema.preApprovedLoanOffers)
      .where(eq(schema.preApprovedLoanOffers.userId, userId))
      .orderBy(desc(schema.preApprovedLoanOffers.displayPriority), desc(schema.preApprovedLoanOffers.createdAt));
    
    // Filter out expired offers
    const now = new Date();
    return offers.filter(offer => new Date(offer.offerValidUntil) > now);
  }

  async createPreApprovedLoanOffer(offer: any): Promise<any> {
    const [newOffer] = await db.insert(schema.preApprovedLoanOffers)
      .values({
        ...offer,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return newOffer;
  }

  async updateLoanOfferApplicationStatus(offerId: string, status: string, applicationData?: any): Promise<any | undefined> {
    const updateData: any = {
      applicationStatus: status,
      updatedAt: new Date(),
    };

    if (applicationData) {
      if (applicationData.applicationId) updateData.applicationId = applicationData.applicationId;
      if (status === 'in_progress' && !applicationData.appliedAt) updateData.appliedAt = new Date();
      if (status === 'approved') updateData.approvedAt = new Date();
      if (status === 'disbursed') {
        updateData.disbursedAt = new Date();
        if (applicationData.disbursedAmount) updateData.disbursedAmount = applicationData.disbursedAmount;
      }
    }

    const [updated] = await db.update(schema.preApprovedLoanOffers)
      .set(updateData)
      .where(eq(schema.preApprovedLoanOffers.id, offerId))
      .returning();
    
    return updated || undefined;
  }

  async markLoanOfferAsViewed(offerId: string): Promise<boolean> {
    const [updated] = await db.update(schema.preApprovedLoanOffers)
      .set({ viewedAt: new Date() })
      .where(eq(schema.preApprovedLoanOffers.id, offerId))
      .returning();
    
    return !!updated;
  }
  
  // Store Management Methods Implementation
  async getAllStoreProducts(): Promise<any[]> {
    const products = await db.select()
      .from(schema.storeProducts)
      .orderBy(asc(schema.storeProducts.name));
    return products;
  }

  async getAllStoreCategories(): Promise<any[]> {
    const categories = await db.select()
      .from(schema.storeCategories)
      .orderBy(asc(schema.storeCategories.displayOrder), asc(schema.storeCategories.name));
    return categories;
  }

  async updateStoreProductStatus(productId: string, isActive: boolean): Promise<any | undefined> {
    const [updated] = await db.update(schema.storeProducts)
      .set({ 
        isActive, 
        updatedAt: new Date() 
      })
      .where(eq(schema.storeProducts.id, productId))
      .returning();
    
    return updated || undefined;
  }

  async updateStoreCategoryStatus(categoryId: string, isActive: boolean): Promise<any | undefined> {
    const [updated] = await db.update(schema.storeCategories)
      .set({ 
        isActive, 
        updatedAt: new Date() 
      })
      .where(eq(schema.storeCategories.id, categoryId))
      .returning();
    
    return updated || undefined;
  }

  // Enhanced Store Category Methods
  async getStoreCategoryById(categoryId: string): Promise<any | undefined> {
    const [category] = await db.select()
      .from(schema.storeCategories)
      .where(eq(schema.storeCategories.id, categoryId));
    return category || undefined;
  }

  async getStoreCategoryBySlug(slug: string): Promise<any | undefined> {
    const [category] = await db.select()
      .from(schema.storeCategories)
      .where(eq(schema.storeCategories.slug, slug));
    return category || undefined;
  }

  async getStoreProductBySourceCompanyId(sourceCompanyId: string): Promise<any | undefined> {
    const [product] = await db.select()
      .from(schema.storeProducts)
      .where(eq(schema.storeProducts.sourceCompanyId, sourceCompanyId));
    return product || undefined;
  }

  async createStoreCategory(data: any): Promise<any> {
    const [category] = await db.insert(schema.storeCategories)
      .values({
        ...data,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return category;
  }

  async updateStoreCategory(id: string, data: any): Promise<any | undefined> {
    const [updated] = await db.update(schema.storeCategories)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.storeCategories.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteStoreCategory(id: string): Promise<boolean> {
    const result = await db.delete(schema.storeCategories)
      .where(eq(schema.storeCategories.id, id));
    return true;
  }

  async seedDefaultStoreCategories(): Promise<void> {
    const existingCategories = await this.getAllStoreCategories();
    if (existingCategories.length > 0) {
      console.log(`✅ Store categories already seeded (${existingCategories.length} categories exist)`);
      return;
    }

    console.log('🌱 Seeding default store categories...');
    
    const defaultCategories = [
      { id: 'cat-mutual-funds', name: 'Mutual Funds - Regular Schemes', slug: 'mf-regular', icon: 'TrendingUp', displayOrder: 1, isActive: true },
      { id: 'cat-mf-direct', name: 'Mutual Funds - Direct Schemes', slug: 'mf-direct', icon: 'TrendingUp', displayOrder: 2, isActive: false },
      { id: 'cat-fixed-income', name: 'Fixed Income', slug: 'fixed-income', icon: 'Landmark', displayOrder: 3, isActive: true },
      { id: 'cat-stocks', name: 'Stocks & Equities', slug: 'stocks', icon: 'BarChart3', displayOrder: 4, isActive: true },
      { id: 'cat-ipo-preipo', name: 'IPO & Pre-IPO', slug: 'ipo-preipo', icon: 'Rocket', displayOrder: 5, isActive: true },
      { id: 'cat-unlisted', name: 'Unlisted Shares', slug: 'unlisted', icon: 'Building2', displayOrder: 6, isActive: true },
      { id: 'cat-aif', name: 'AIF', slug: 'aif', icon: 'Briefcase', displayOrder: 7, isActive: true },
      { id: 'cat-pms', name: 'PMS', slug: 'pms', icon: 'Wallet', displayOrder: 8, isActive: true },
      { id: 'cat-mlds', name: 'MLDs', slug: 'mlds', icon: 'Layers', displayOrder: 9, isActive: true },
      { id: 'cat-insurance', name: 'Insurance', slug: 'insurance', icon: 'Shield', displayOrder: 10, isActive: true },
      { id: 'cat-loans', name: 'Loans & Credit', slug: 'loans', icon: 'CreditCard', displayOrder: 11, isActive: false },
      { id: 'cat-tax', name: 'Tax Services', slug: 'tax', icon: 'Calculator', displayOrder: 12, isActive: true },
      { id: 'cat-gold', name: 'Gold & Commodities', slug: 'gold', icon: 'Coins', displayOrder: 13, isActive: true },
      { id: 'cat-global', name: 'Global Products', slug: 'global-products', icon: 'Globe', displayOrder: 14, isActive: true },
      { id: 'cat-subscriptions', name: 'Subscriptions', slug: 'subscriptions', icon: 'Star', displayOrder: 15, isActive: true },
    ];

    for (const category of defaultCategories) {
      try {
        await db.insert(schema.storeCategories)
          .values({
            ...category,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoNothing();
      } catch (error) {
        console.error(`Failed to seed category ${category.name}:`, error);
      }
    }

    console.log(`✅ Seeded ${defaultCategories.length} default store categories`);
  }

  // Subcategory Methods
  async getAllStoreSubcategories(): Promise<any[]> {
    const subcategories = await db.select()
      .from(schema.storeSubcategories)
      .orderBy(asc(schema.storeSubcategories.displayOrder), asc(schema.storeSubcategories.name));
    return subcategories;
  }

  async getStoreSubcategoriesByCategory(categoryId: string): Promise<any[]> {
    const subcategories = await db.select()
      .from(schema.storeSubcategories)
      .where(eq(schema.storeSubcategories.categoryId, categoryId))
      .orderBy(asc(schema.storeSubcategories.displayOrder), asc(schema.storeSubcategories.name));
    return subcategories;
  }

  async getStoreSubcategoryById(id: string): Promise<any | undefined> {
    const [subcategory] = await db.select()
      .from(schema.storeSubcategories)
      .where(eq(schema.storeSubcategories.id, id));
    return subcategory || undefined;
  }

  async getStoreSubcategoryBySlug(slug: string): Promise<any | undefined> {
    const [subcategory] = await db.select()
      .from(schema.storeSubcategories)
      .where(eq(schema.storeSubcategories.slug, slug));
    return subcategory || undefined;
  }

  async createStoreSubcategory(data: any): Promise<any> {
    const [subcategory] = await db.insert(schema.storeSubcategories)
      .values({
        ...data,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return subcategory;
  }

  async updateStoreSubcategory(id: string, data: any): Promise<any | undefined> {
    const [updated] = await db.update(schema.storeSubcategories)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.storeSubcategories.id, id))
      .returning();
    return updated || undefined;
  }

  async updateStoreSubcategoryStatus(id: string, isActive: boolean): Promise<any | undefined> {
    const [updated] = await db.update(schema.storeSubcategories)
      .set({ 
        isActive, 
        updatedAt: new Date() 
      })
      .where(eq(schema.storeSubcategories.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteStoreSubcategory(id: string): Promise<boolean> {
    await db.delete(schema.storeSubcategories)
      .where(eq(schema.storeSubcategories.id, id));
    return true;
  }

  // Enhanced Product Methods
  async getStoreProductById(id: string): Promise<any | undefined> {
    const [product] = await db.select()
      .from(schema.storeProducts)
      .where(eq(schema.storeProducts.id, id));
    return product || undefined;
  }

  async getStoreProductsByCategory(categoryId: string): Promise<any[]> {
    const products = await db.select()
      .from(schema.storeProducts)
      .where(eq(schema.storeProducts.categoryId, categoryId))
      .orderBy(asc(schema.storeProducts.displayOrder), asc(schema.storeProducts.name));
    return products;
  }

  async getStoreProductsBySubcategory(subcategoryId: string): Promise<any[]> {
    const products = await db.select()
      .from(schema.storeProducts)
      .where(eq(schema.storeProducts.subcategoryId, subcategoryId))
      .orderBy(asc(schema.storeProducts.displayOrder), asc(schema.storeProducts.name));
    return products;
  }

  async createStoreProduct(data: any): Promise<any> {
    const [product] = await db.insert(schema.storeProducts)
      .values({
        ...data,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return product;
  }

  async updateStoreProduct(id: string, data: any): Promise<any | undefined> {
    const [updated] = await db.update(schema.storeProducts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.storeProducts.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteStoreProduct(id: string): Promise<boolean> {
    await db.delete(schema.storeProducts)
      .where(eq(schema.storeProducts.id, id));
    return true;
  }

  // Store Audit Log Methods
  async createStoreAuditLog(data: any): Promise<any> {
    const [log] = await db.insert(schema.storeAuditLogs)
      .values({
        ...data,
        id: randomUUID(),
        timestamp: new Date(),
      })
      .returning();
    return log;
  }

  async getStoreAuditLogs(filters?: { targetType?: string; targetId?: string; adminId?: string; limit?: number }): Promise<any[]> {
    let query = db.select().from(schema.storeAuditLogs);
    
    const conditions: any[] = [];
    if (filters?.targetType) {
      conditions.push(eq(schema.storeAuditLogs.targetType, filters.targetType));
    }
    if (filters?.targetId) {
      conditions.push(eq(schema.storeAuditLogs.targetId, filters.targetId));
    }
    if (filters?.adminId) {
      conditions.push(eq(schema.storeAuditLogs.adminId, filters.adminId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const logs = await query.orderBy(desc(schema.storeAuditLogs.timestamp)).limit(filters?.limit || 100);
    return logs;
  }

  // Store Product Inquiry Methods
  async createStoreProductInquiry(data: any): Promise<any> {
    const [inquiry] = await db.insert(schema.storeProductInquiries)
      .values({
        ...data,
        id: randomUUID(),
        createdAt: new Date(),
      })
      .returning();
    return inquiry;
  }

  async getStoreProductInquiries(filters?: { status?: string; productId?: string; categoryId?: string }): Promise<any[]> {
    let query = db.select().from(schema.storeProductInquiries);
    
    const conditions: any[] = [];
    if (filters?.status) {
      conditions.push(eq(schema.storeProductInquiries.status, filters.status));
    }
    if (filters?.productId) {
      conditions.push(eq(schema.storeProductInquiries.productId, filters.productId));
    }
    if (filters?.categoryId) {
      conditions.push(eq(schema.storeProductInquiries.categoryId, filters.categoryId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const inquiries = await query.orderBy(desc(schema.storeProductInquiries.createdAt));
    return inquiries;
  }

  async updateStoreProductInquiry(id: string, data: any): Promise<any | undefined> {
    const [updated] = await db.update(schema.storeProductInquiries)
      .set(data)
      .where(eq(schema.storeProductInquiries.id, id))
      .returning();
    return updated || undefined;
  }

  // Cascading Toggle Methods
  async toggleCategoryWithCascade(categoryId: string, isActive: boolean, adminId: string, adminEmail: string): Promise<{ category: any; subcategories: any[]; products: any[] }> {
    // Get the category first
    const category = await this.getStoreCategoryById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // Log the category toggle
    await this.createStoreAuditLog({
      adminId,
      adminEmail,
      action: 'toggle',
      targetType: 'category',
      targetId: categoryId,
      targetName: category.name,
      beforeValue: { isActive: category.isActive },
      afterValue: { isActive },
    });

    // Update category
    const updatedCategory = await this.updateStoreCategoryStatus(categoryId, isActive);

    // Get and update all subcategories
    const subcategories = await this.getStoreSubcategoriesByCategory(categoryId);
    const updatedSubcategories: any[] = [];
    for (const subcat of subcategories) {
      await this.createStoreAuditLog({
        adminId,
        adminEmail,
        action: 'cascade_toggle',
        targetType: 'subcategory',
        targetId: subcat.id,
        targetName: subcat.name,
        beforeValue: { isActive: subcat.isActive },
        afterValue: { isActive },
      });
      const updated = await this.updateStoreSubcategoryStatus(subcat.id, isActive);
      if (updated) updatedSubcategories.push(updated);
    }

    // Get and update all products in this category
    const products = await this.getStoreProductsByCategory(categoryId);
    const updatedProducts: any[] = [];
    for (const product of products) {
      await this.createStoreAuditLog({
        adminId,
        adminEmail,
        action: 'cascade_toggle',
        targetType: 'product',
        targetId: product.id,
        targetName: product.name,
        beforeValue: { isActive: product.isActive },
        afterValue: { isActive },
      });
      const updated = await this.updateStoreProductStatus(product.id, isActive);
      if (updated) updatedProducts.push(updated);
    }

    return {
      category: updatedCategory,
      subcategories: updatedSubcategories,
      products: updatedProducts,
    };
  }

  async toggleSubcategoryWithCascade(subcategoryId: string, isActive: boolean, adminId: string, adminEmail: string): Promise<{ subcategory: any; products: any[] }> {
    // Get the subcategory first
    const subcategory = await this.getStoreSubcategoryById(subcategoryId);
    if (!subcategory) {
      throw new Error('Subcategory not found');
    }

    // Log the subcategory toggle
    await this.createStoreAuditLog({
      adminId,
      adminEmail,
      action: 'toggle',
      targetType: 'subcategory',
      targetId: subcategoryId,
      targetName: subcategory.name,
      beforeValue: { isActive: subcategory.isActive },
      afterValue: { isActive },
    });

    // Update subcategory
    const updatedSubcategory = await this.updateStoreSubcategoryStatus(subcategoryId, isActive);

    // Get and update all products in this subcategory
    const products = await this.getStoreProductsBySubcategory(subcategoryId);
    const updatedProducts: any[] = [];
    for (const product of products) {
      await this.createStoreAuditLog({
        adminId,
        adminEmail,
        action: 'cascade_toggle',
        targetType: 'product',
        targetId: product.id,
        targetName: product.name,
        beforeValue: { isActive: product.isActive },
        afterValue: { isActive },
      });
      const updated = await this.updateStoreProductStatus(product.id, isActive);
      if (updated) updatedProducts.push(updated);
    }

    return {
      subcategory: updatedSubcategory,
      products: updatedProducts,
    };
  }
  
  // Predictive Analytics Methods Implementation
  async getPortfolioPredictions(userId: string, portfolioId?: string): Promise<any[]> {
    let query = db.select()
      .from(schema.portfolioPredictions)
      .where(eq(schema.portfolioPredictions.userId, userId));
    
    if (portfolioId) {
      const predictions = await db.select()
        .from(schema.portfolioPredictions)
        .where(and(
          eq(schema.portfolioPredictions.userId, userId),
          eq(schema.portfolioPredictions.portfolioId, portfolioId)
        ))
        .orderBy(desc(schema.portfolioPredictions.predictionDate));
      return predictions;
    }
    
    const predictions = await query.orderBy(desc(schema.portfolioPredictions.predictionDate));
    return predictions;
  }
  
  async getAssetForecasts(userId: string, holdingId?: string): Promise<any[]> {
    let query = db.select()
      .from(schema.assetForecasts)
      .where(eq(schema.assetForecasts.userId, userId));
    
    if (holdingId) {
      const forecasts = await db.select()
        .from(schema.assetForecasts)
        .where(and(
          eq(schema.assetForecasts.userId, userId),
          eq(schema.assetForecasts.holdingId, holdingId)
        ))
        .orderBy(desc(schema.assetForecasts.forecastDate));
      return forecasts;
    }
    
    const forecasts = await query.orderBy(desc(schema.assetForecasts.forecastDate));
    return forecasts;
  }
  
  async getRiskAnalysis(userId: string, portfolioId?: string): Promise<any[]> {
    let query = db.select()
      .from(schema.riskAnalysis)
      .where(eq(schema.riskAnalysis.userId, userId));
    
    if (portfolioId) {
      const analysis = await db.select()
        .from(schema.riskAnalysis)
        .where(and(
          eq(schema.riskAnalysis.userId, userId),
          eq(schema.riskAnalysis.portfolioId, portfolioId)
        ))
        .orderBy(desc(schema.riskAnalysis.analysisDate));
      return analysis;
    }
    
    const analysis = await query.orderBy(desc(schema.riskAnalysis.analysisDate));
    return analysis;
  }
  
  async getPredictionAccuracy(predictionId?: string): Promise<any[]> {
    if (predictionId) {
      const accuracy = await db.select()
        .from(schema.predictionAccuracy)
        .where(eq(schema.predictionAccuracy.predictionId, predictionId))
        .orderBy(desc(schema.predictionAccuracy.actualDate));
      return accuracy;
    }
    
    const accuracy = await db.select()
      .from(schema.predictionAccuracy)
      .orderBy(desc(schema.predictionAccuracy.actualDate));
    return accuracy;
  }
  
  async createPortfolioPrediction(prediction: any): Promise<any> {
    const [newPrediction] = await db.insert(schema.portfolioPredictions)
      .values(prediction)
      .returning();
    return newPrediction;
  }
  
  async createAssetForecast(forecast: any): Promise<any> {
    const [newForecast] = await db.insert(schema.assetForecasts)
      .values(forecast)
      .returning();
    return newForecast;
  }
  
  async createRiskAnalysis(analysis: any): Promise<any> {
    const [newAnalysis] = await db.insert(schema.riskAnalysis)
      .values(analysis)
      .returning();
    return newAnalysis;
  }
  
  async createPredictionAccuracy(accuracy: any): Promise<any> {
    const [newAccuracy] = await db.insert(schema.predictionAccuracy)
      .values(accuracy)
      .returning();
    return newAccuracy;
  }

  // ===================================================================
  // UNLISTED MARKETPLACE METHODS IMPLEMENTATION
  // ===================================================================

  // Unlisted Companies
  async createUnlistedCompany(data: InsertUnlistedCompany): Promise<UnlistedCompany> {
    const [company] = await db.insert(schema.unlistedCompanies)
      .values(data)
      .returning();
    return company;
  }

  async getUnlistedCompanyById(id: string): Promise<UnlistedCompany | null> {
    const [company] = await db.select()
      .from(schema.unlistedCompanies)
      .where(eq(schema.unlistedCompanies.id, id));
    return company || null;
  }

  async getUnlistedCompanyByName(name: string): Promise<UnlistedCompany | null> {
    const [company] = await db.select()
      .from(schema.unlistedCompanies)
      .where(eq(schema.unlistedCompanies.name, name));
    return company || null;
  }

  async getUnlistedCompanyByCIN(cin: string): Promise<UnlistedCompany | null> {
    const [company] = await db.select()
      .from(schema.unlistedCompanies)
      .where(eq(schema.unlistedCompanies.cin, cin));
    return company || null;
  }

  async getUnlistedCompanyByISIN(isin: string): Promise<UnlistedCompany | null> {
    const [company] = await db.select()
      .from(schema.unlistedCompanies)
      .where(eq(schema.unlistedCompanies.isin, isin));
    return company || null;
  }

  async getAllUnlistedCompanies(filters?: { status?: string; sector?: string; storePublishedOnly?: boolean }): Promise<UnlistedCompany[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(schema.unlistedCompanies.status, filters.status));
    }
    if (filters?.sector) {
      conditions.push(eq(schema.unlistedCompanies.sector, filters.sector));
    }
    
    // If storePublishedOnly is true, only return companies linked to a store product
    if (filters?.storePublishedOnly) {
      // Get companies that have a store product with matching sourceCompanyId
      const storeLinkedCompanyIds = await db.select({ sourceCompanyId: schema.storeProducts.sourceCompanyId })
        .from(schema.storeProducts)
        .where(and(
          isNotNull(schema.storeProducts.sourceCompanyId),
          eq(schema.storeProducts.isActive, true)
        ));
      
      const linkedIds = storeLinkedCompanyIds.map(p => p.sourceCompanyId).filter(Boolean) as string[];
      
      if (linkedIds.length === 0) {
        return [];
      }
      
      conditions.push(inArray(schema.unlistedCompanies.id, linkedIds));
    }
    
    let query = db.select().from(schema.unlistedCompanies);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const companies = await query.orderBy(desc(schema.unlistedCompanies.createdAt));
    return companies;
  }

  async updateUnlistedCompany(id: string, data: Partial<InsertUnlistedCompany>): Promise<UnlistedCompany> {
    const [updated] = await db.update(schema.unlistedCompanies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.unlistedCompanies.id, id))
      .returning();
    return updated;
  }

  async deleteUnlistedCompany(id: string): Promise<boolean> {
    await db.delete(schema.companyFinancials).where(eq(schema.companyFinancials.companyId, id));
    await db.delete(schema.companyRatios).where(eq(schema.companyRatios.companyId, id));
    await db.delete(schema.unlistedPriceHistory).where(eq(schema.unlistedPriceHistory.companyId, id));
    await db.delete(schema.sellListings).where(eq(schema.sellListings.companyId, id));
    await db.delete(schema.buyRequests).where(eq(schema.buyRequests.companyId, id));
    await db.delete(schema.probe42SyncLog).where(eq(schema.probe42SyncLog.companyId, id));
    const result = await db.delete(schema.unlistedCompanies).where(eq(schema.unlistedCompanies.id, id));
    return true;
  }

  // Company Financials
  async createCompanyFinancials(data: InsertCompanyFinancials): Promise<CompanyFinancials> {
    const [financials] = await db.insert(schema.companyFinancials)
      .values(data)
      .returning();
    return financials;
  }

  async getCompanyFinancials(companyId: string): Promise<CompanyFinancials[]> {
    const financials = await db.select()
      .from(schema.companyFinancials)
      .where(eq(schema.companyFinancials.companyId, companyId))
      .orderBy(desc(schema.companyFinancials.financialYear));
    return financials;
  }

  async getCompanyFinancialsByYear(companyId: string, financialYear: string): Promise<CompanyFinancials | null> {
    const [financials] = await db.select()
      .from(schema.companyFinancials)
      .where(and(
        eq(schema.companyFinancials.companyId, companyId),
        eq(schema.companyFinancials.financialYear, financialYear)
      ));
    return financials || null;
  }

  async updateCompanyFinancials(id: string, data: Partial<InsertCompanyFinancials>): Promise<CompanyFinancials> {
    const { companyId, financialYear, ...mutableData } = data;
    const [updated] = await db.update(schema.companyFinancials)
      .set({ ...mutableData, updatedAt: new Date() })
      .where(eq(schema.companyFinancials.id, id))
      .returning();
    return updated;
  }

  // Company Ratios
  async createCompanyRatios(data: InsertCompanyRatios): Promise<CompanyRatios> {
    const [ratios] = await db.insert(schema.companyRatios)
      .values(data)
      .returning();
    return ratios;
  }

  async getCompanyRatios(companyId: string): Promise<CompanyRatios[]> {
    const ratios = await db.select()
      .from(schema.companyRatios)
      .where(eq(schema.companyRatios.companyId, companyId))
      .orderBy(desc(schema.companyRatios.financialYear));
    return ratios;
  }

  async getCompanyRatiosByYear(companyId: string, financialYear: string): Promise<CompanyRatios | null> {
    const [ratios] = await db.select()
      .from(schema.companyRatios)
      .where(and(
        eq(schema.companyRatios.companyId, companyId),
        eq(schema.companyRatios.financialYear, financialYear)
      ));
    return ratios || null;
  }

  async updateCompanyRatios(id: string, data: Partial<InsertCompanyRatios>): Promise<CompanyRatios> {
    const { companyId, financialYear, ...mutableData } = data;
    const [updated] = await db.update(schema.companyRatios)
      .set({ ...mutableData, updatedAt: new Date() })
      .where(eq(schema.companyRatios.id, id))
      .returning();
    return updated;
  }

  // Price History
  async createPriceHistory(data: InsertUnlistedPriceHistory): Promise<UnlistedPriceHistory> {
    const [priceHistory] = await db.insert(schema.unlistedPriceHistory)
      .values(data)
      .returning();
    return priceHistory;
  }

  async getPriceHistoryByDate(companyId: string, date: Date): Promise<UnlistedPriceHistory | null> {
    const [priceHistory] = await db.select()
      .from(schema.unlistedPriceHistory)
      .where(and(
        eq(schema.unlistedPriceHistory.companyId, companyId),
        eq(schema.unlistedPriceHistory.date, date)
      ));
    return priceHistory || null;
  }

  async upsertPriceHistory(data: InsertUnlistedPriceHistory): Promise<UnlistedPriceHistory> {
    const existing = await this.getPriceHistoryByDate(data.companyId, data.date);
    if (existing) {
      const [updated] = await db.update(schema.unlistedPriceHistory)
        .set({
          price: data.price,
          volume: data.volume,
          sourceType: data.sourceType,
          sourceDealId: data.sourceDealId,
          notes: data.notes,
        })
        .where(eq(schema.unlistedPriceHistory.id, existing.id))
        .returning();
      return updated;
    }
    return this.createPriceHistory(data);
  }

  async getPriceHistory(companyId: string, limit?: number): Promise<UnlistedPriceHistory[]> {
    let query = db.select()
      .from(schema.unlistedPriceHistory)
      .where(eq(schema.unlistedPriceHistory.companyId, companyId))
      .orderBy(desc(schema.unlistedPriceHistory.date));
    
    if (limit) {
      query = query.limit(limit) as any;
    }
    
    return await query;
  }

  // Sell Listings
  async createSellListing(data: InsertSellListing): Promise<SellListing> {
    const [listing] = await db.insert(schema.sellListings)
      .values(data)
      .returning();
    return listing;
  }

  async getSellListingById(id: string): Promise<SellListing | null> {
    const [listing] = await db.select()
      .from(schema.sellListings)
      .where(eq(schema.sellListings.id, id));
    return listing || null;
  }

  async getSellListingsByCompany(companyId: string): Promise<SellListing[]> {
    const listings = await db.select()
      .from(schema.sellListings)
      .where(eq(schema.sellListings.companyId, companyId))
      .orderBy(desc(schema.sellListings.createdAt));
    return listings;
  }

  async updateSellListing(id: string, data: Partial<InsertSellListing>): Promise<SellListing> {
    const [updated] = await db.update(schema.sellListings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.sellListings.id, id))
      .returning();
    return updated;
  }

  // Buy Requests
  async createBuyRequest(data: InsertBuyRequest): Promise<BuyRequest> {
    const [request] = await db.insert(schema.buyRequests)
      .values(data)
      .returning();
    return request;
  }

  async getBuyRequestById(id: string): Promise<BuyRequest | null> {
    const [request] = await db.select()
      .from(schema.buyRequests)
      .where(eq(schema.buyRequests.id, id));
    return request || null;
  }

  async getBuyRequestsByCompany(companyId: string): Promise<BuyRequest[]> {
    const requests = await db.select()
      .from(schema.buyRequests)
      .where(eq(schema.buyRequests.companyId, companyId))
      .orderBy(desc(schema.buyRequests.createdAt));
    return requests;
  }

  async updateBuyRequest(id: string, data: Partial<InsertBuyRequest>): Promise<BuyRequest> {
    const [updated] = await db.update(schema.buyRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.buyRequests.id, id))
      .returning();
    return updated;
  }

  // Deals
  async createUnlistedDeal(data: InsertUnlistedDeal): Promise<UnlistedDeal> {
    const [deal] = await db.insert(schema.unlistedDeals)
      .values(data)
      .returning();
    return deal;
  }

  async getUnlistedDealById(id: string): Promise<UnlistedDeal | null> {
    const [deal] = await db.select()
      .from(schema.unlistedDeals)
      .where(eq(schema.unlistedDeals.id, id));
    return deal || null;
  }

  async getUnlistedDealsByCompany(companyId: string): Promise<UnlistedDeal[]> {
    const deals = await db.select()
      .from(schema.unlistedDeals)
      .where(eq(schema.unlistedDeals.companyId, companyId))
      .orderBy(desc(schema.unlistedDeals.matchedAt));
    return deals;
  }

  async updateUnlistedDeal(id: string, data: Partial<InsertUnlistedDeal>): Promise<UnlistedDeal> {
    const [updated] = await db.update(schema.unlistedDeals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.unlistedDeals.id, id))
      .returning();
    return updated;
  }

  async getUnlistedDealsByUser(userId: string): Promise<UnlistedDeal[]> {
    const deals = await db.select()
      .from(schema.unlistedDeals)
      .where(or(
        eq(schema.unlistedDeals.buyerUserId, userId),
        eq(schema.unlistedDeals.sellerUserId, userId)
      ))
      .orderBy(desc(schema.unlistedDeals.matchedAt));
    return deals;
  }

  async getUnlistedDealsPendingAcceptance(userId: string): Promise<UnlistedDeal[]> {
    const deals = await db.select()
      .from(schema.unlistedDeals)
      .where(and(
        or(
          eq(schema.unlistedDeals.buyerUserId, userId),
          eq(schema.unlistedDeals.sellerUserId, userId)
        ),
        or(
          eq(schema.unlistedDeals.status, 'pending'),
          eq(schema.unlistedDeals.status, 'awaiting_acceptance')
        )
      ))
      .orderBy(desc(schema.unlistedDeals.matchedAt));
    return deals;
  }

  // Probe42 Sync Log
  async createProbe42SyncLog(data: InsertProbe42SyncLog): Promise<Probe42SyncLog> {
    const [log] = await db.insert(schema.probe42SyncLog)
      .values(data)
      .returning();
    return log;
  }

  async getLatestSyncLog(companyId: string): Promise<Probe42SyncLog | null> {
    const [log] = await db.select()
      .from(schema.probe42SyncLog)
      .where(eq(schema.probe42SyncLog.companyId, companyId))
      .orderBy(desc(schema.probe42SyncLog.lastSyncAt))
      .limit(1);
    return log || null;
  }

  // CA Support System - Templates
  async createSupportTemplate(data: InsertSupportTemplate): Promise<SupportTemplate> {
    const id = randomUUID();
    const [template] = await db.insert(schema.supportTemplates)
      .values({ ...data, id, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return template;
  }

  async getSupportTemplates(category?: string): Promise<SupportTemplate[]> {
    if (category) {
      return await db.select()
        .from(schema.supportTemplates)
        .where(and(
          eq(schema.supportTemplates.category, category),
          eq(schema.supportTemplates.isActive, true)
        ))
        .orderBy(asc(schema.supportTemplates.name));
    }
    return await db.select()
      .from(schema.supportTemplates)
      .where(eq(schema.supportTemplates.isActive, true))
      .orderBy(asc(schema.supportTemplates.name));
  }

  async getSupportTemplateById(id: string): Promise<SupportTemplate | null> {
    const [template] = await db.select()
      .from(schema.supportTemplates)
      .where(eq(schema.supportTemplates.id, id));
    return template || null;
  }

  async updateSupportTemplate(id: string, data: Partial<InsertSupportTemplate>): Promise<SupportTemplate | null> {
    const [updated] = await db.update(schema.supportTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.supportTemplates.id, id))
      .returning();
    return updated || null;
  }

  async deleteSupportTemplate(id: string): Promise<boolean> {
    const [deleted] = await db.delete(schema.supportTemplates)
      .where(eq(schema.supportTemplates.id, id))
      .returning();
    return !!deleted;
  }

  // CA Support System - Steps
  async createSupportStep(data: InsertSupportStep): Promise<SupportStep> {
    const id = randomUUID();
    const [step] = await db.insert(schema.supportSteps)
      .values({ ...data, id, createdAt: new Date(), updatedAt: new Date() })
      .returning();
    return step;
  }

  async getSupportStepsByTemplateId(templateId: string): Promise<SupportStep[]> {
    return await db.select()
      .from(schema.supportSteps)
      .where(eq(schema.supportSteps.templateId, templateId))
      .orderBy(asc(schema.supportSteps.order));
  }

  async getSupportStepsByTicketId(ticketId: string): Promise<SupportStep[]> {
    return await db.select()
      .from(schema.supportSteps)
      .where(eq(schema.supportSteps.ticketId, ticketId))
      .orderBy(asc(schema.supportSteps.order));
  }

  async getSupportStepById(id: string): Promise<SupportStep | null> {
    const [step] = await db.select()
      .from(schema.supportSteps)
      .where(eq(schema.supportSteps.id, id));
    return step || null;
  }

  async updateSupportStep(id: string, data: Partial<InsertSupportStep>): Promise<SupportStep | null> {
    const [updated] = await db.update(schema.supportSteps)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.supportSteps.id, id))
      .returning();
    return updated || null;
  }

  async deleteSupportStep(id: string): Promise<boolean> {
    const [deleted] = await db.delete(schema.supportSteps)
      .where(eq(schema.supportSteps.id, id))
      .returning();
    return !!deleted;
  }

  // CA Support System - Step Comments
  async createSupportStepComment(data: InsertSupportStepComment): Promise<SupportStepComment> {
    const id = randomUUID();
    const [comment] = await db.insert(schema.supportStepComments)
      .values({ ...data, id, createdAt: new Date() })
      .returning();
    return comment;
  }

  async getSupportStepComments(stepId: string): Promise<SupportStepComment[]> {
    return await db.select()
      .from(schema.supportStepComments)
      .where(eq(schema.supportStepComments.stepId, stepId))
      .orderBy(asc(schema.supportStepComments.createdAt));
  }

  async deleteSupportStepComment(id: string): Promise<boolean> {
    const [deleted] = await db.delete(schema.supportStepComments)
      .where(eq(schema.supportStepComments.id, id))
      .returning();
    return !!deleted;
  }

  // Transaction Support
  async withTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return await db.transaction(callback);
  }

  // Unified Cart methods
  async getUnifiedCartItems(userId: string): Promise<UnifiedCartItem[]> {
    return await db.select()
      .from(schema.unifiedCartItems)
      .where(and(
        eq(schema.unifiedCartItems.userId, userId),
        eq(schema.unifiedCartItems.status, 'active')
      ))
      .orderBy(desc(schema.unifiedCartItems.createdAt));
  }

  async getUnifiedCartItem(id: string): Promise<UnifiedCartItem | undefined> {
    const [item] = await db.select()
      .from(schema.unifiedCartItems)
      .where(eq(schema.unifiedCartItems.id, id));
    return item || undefined;
  }

  async createUnifiedCartItem(item: InsertUnifiedCartItem): Promise<UnifiedCartItem> {
    const [newItem] = await db.insert(schema.unifiedCartItems)
      .values({
        ...item,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return newItem;
  }

  async updateUnifiedCartItem(id: string, updates: Partial<UnifiedCartItem>): Promise<UnifiedCartItem | undefined> {
    const [updated] = await db.update(schema.unifiedCartItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.unifiedCartItems.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUnifiedCartItem(id: string): Promise<boolean> {
    const [deleted] = await db.delete(schema.unifiedCartItems)
      .where(eq(schema.unifiedCartItems.id, id))
      .returning();
    return !!deleted;
  }

  async getUnifiedCartByCategory(userId: string, category: string): Promise<UnifiedCartItem[]> {
    return await db.select()
      .from(schema.unifiedCartItems)
      .where(and(
        eq(schema.unifiedCartItems.userId, userId),
        eq(schema.unifiedCartItems.productCategory, category),
        eq(schema.unifiedCartItems.status, 'active')
      ))
      .orderBy(desc(schema.unifiedCartItems.createdAt));
  }

  async clearUnifiedCart(userId: string): Promise<boolean> {
    await db.delete(schema.unifiedCartItems)
      .where(eq(schema.unifiedCartItems.userId, userId));
    return true;
  }

  async getUnifiedCartCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(schema.unifiedCartItems)
      .where(and(
        eq(schema.unifiedCartItems.userId, userId),
        eq(schema.unifiedCartItems.status, 'active')
      ));
    return Number(result[0]?.count || 0);
  }

  async approveCartItem(id: string): Promise<UnifiedCartItem | undefined> {
    const [updated] = await db.update(schema.unifiedCartItems)
      .set({ 
        clientApproved: true, 
        approvedAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(schema.unifiedCartItems.id, id))
      .returning();
    return updated || undefined;
  }

  async getAllUnifiedCartItemsForAdmin(filters?: { userId?: string; category?: string; source?: string; status?: string }): Promise<UnifiedCartItem[]> {
    const conditions: any[] = [];
    
    if (filters?.userId) {
      conditions.push(eq(schema.unifiedCartItems.userId, filters.userId));
    }
    if (filters?.category) {
      conditions.push(eq(schema.unifiedCartItems.productCategory, filters.category));
    }
    if (filters?.source) {
      conditions.push(eq(schema.unifiedCartItems.source, filters.source));
    }
    if (filters?.status) {
      conditions.push(eq(schema.unifiedCartItems.status, filters.status));
    }
    
    if (conditions.length === 0) {
      return await db.select()
        .from(schema.unifiedCartItems)
        .orderBy(desc(schema.unifiedCartItems.createdAt));
    }
    
    return await db.select()
      .from(schema.unifiedCartItems)
      .where(and(...conditions))
      .orderBy(desc(schema.unifiedCartItems.createdAt));
  }

  async checkoutCartItems(userId: string, cartItemIds: string[]): Promise<any[]> {
    const createdOrders: any[] = [];
    
    for (const cartItemId of cartItemIds) {
      const cartItem = await this.getUnifiedCartItem(cartItemId);
      
      if (!cartItem || cartItem.userId !== userId || cartItem.status !== 'active') {
        continue;
      }
      
      const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      
      const productTypeMap: Record<string, string> = {
        'store': 'store',
        'unlisted': 'unlisted',
        'mutual_fund': 'mutual_fund',
        'bond': 'bond',
        'ncd': 'ncd',
        'ipo': 'ipo'
      };
      
      const [order] = await db.insert(schema.unifiedOrders)
        .values({
          orderNumber,
          userId: cartItem.userId,
          productType: productTypeMap[cartItem.productCategory] || cartItem.productCategory,
          productId: cartItem.storeProductId || cartItem.unlistedCompanyId || cartItem.mutualFundSchemeCode || cartItem.bondIsin || cartItem.ncdIsin || cartItem.ipoId || undefined,
          productName: cartItem.displayName || `${cartItem.productCategory} Item`,
          orderType: 'buy',
          quantity: cartItem.quantity?.toString() || '1',
          amount: cartItem.amount || '0',
          currency: 'INR',
          cartId: cartItem.id,
          status: 'initiated',
          paymentStatus: 'pending',
          executionStatus: 'pending',
          metadata: {
            source: cartItem.source,
            sourceUserId: cartItem.sourceUserId,
            sourceProposalId: cartItem.sourceProposalId,
            originalCartItem: cartItem.metadata
          },
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      await db.update(schema.unifiedCartItems)
        .set({ 
          status: 'ordered',
          updatedAt: new Date()
        })
        .where(eq(schema.unifiedCartItems.id, cartItemId));
      
      createdOrders.push(order);
    }
    
    return createdOrders;
  }
}

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();