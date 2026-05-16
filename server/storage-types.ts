import { type User, type UpsertUser, type Portfolio, type InsertPortfolio, type PortfolioHolding, type InsertPortfolioHolding, type Watchlist, type InsertWatchlist, type MarketData, type AssetAllocation, type InsertAssetAllocation, type MutualFund, type InsertMutualFund, type OtpVerification, type InsertOtpVerification, type UserProfile, type InsertUserProfile, type CapitalGainsReport, type InsertCapitalGainsReport, type TransactionReport, type InsertTransactionReport, type TransactionRecord, type InsertTransactionRecord, type CustomerCareAgent, type InsertCustomerCareAgent, type AgentPartnerMapping, type InsertAgentPartnerMapping, type CkycRecord, type InsertCkycRecord, type CkycDocument, type InsertCkycDocument, type CkycStatusHistory, type InsertCkycStatusHistory, type ClientAgentRelationship, type InsertClientAgentRelationship, type InvestmentProposal, type InsertInvestmentProposal, type InvestmentProposalItem, type InsertInvestmentProposalItem, type ProposalPayment, type InsertProposalPayment, type IBAccount, type InsertIBAccount, type IBOrder, type InsertIBOrder, type IBPosition, type InsertIBPosition, type IBAccountSummary, type InsertIBAccountSummary, type IBMarketDataSubscription, type InsertIBMarketDataSubscription, type IBTradingSession, type InsertIBTradingSession, type Partner, type InsertPartner, type Agent, type InsertAgent, type Supplier, type InsertSupplier, type EpfHolding, type PpfHolding, type EpsHolding, type GovernmentSchemeConsent, type InsertGovernmentSchemeConsent, type InsuranceHolding, type InsertInsuranceHolding, type UserBankAccount, type InsertUserBankAccount, type UserDematAccount, type InsertUserDematAccount, type AchievementCategory, type InsertAchievementCategory, type Achievement, type InsertAchievement, type UserAchievement, type InsertUserAchievement, type LearningProgress, type InsertLearningProgress, type SocialShare, type InsertSocialShare, type FinancialGoal, type InsertFinancialGoal, type TaxDocument, type InsertTaxDocument, type ExternalHolding, type InsertExternalHolding, type StructuredTaxData, type InsertStructuredTaxData, type UserAlert, type InsertUserAlert, type AlertHistory, type InsertAlertHistory, type AlertTemplate, type InsertAlertTemplate, type FamilyGroup, type InsertFamilyGroup, type FamilyMember, type InsertFamilyMember, type FamilyGoal, type InsertFamilyGoal, type FamilyGoalContribution, type InsertFamilyGoalContribution, type FamilyActivityLog, type InsertFamilyActivityLog, type FamilyDiscussion, type InsertFamilyDiscussion, type FamilyBudget, type InsertFamilyBudget, type FamilyPortfolioPermission, type InsertFamilyPortfolioPermission, type TaxCalculation, type InsertTaxCalculation, type TaxDocumentAccessLog, type InsertTaxDocumentAccessLog, type TaxSession, type InsertTaxSession, type TaxDataSource, type InsertTaxDataSource, type ValidationIssue, type InsertValidationIssue, type FilingRecord, type InsertFilingRecord, type AiOptimizationSuggestion, type InsertAiOptimizationSuggestion, type FundExtended, type Provenance, type FundSearchParams, type FundListResponse, type SourceStatus, type MultiSourceStatus, type LoanProduct, type InsertLoanProduct, type LoanProvider, type InsertLoanProvider, type ProviderProduct, type InsertProviderProduct, type CreditProfile, type InsertCreditProfile, type LoanRequest, type InsertLoanRequest, type LoanOffer, type InsertLoanOffer, type LoanApplicationMarketplace, type InsertLoanApplicationMarketplace, type ProviderIntegration, type InsertProviderIntegration, type PartnerApplicationDocument, type InsertPartnerApplicationDocument, type InvestmentIdea, type InsertInvestmentIdea, type InvestmentIdeaTracking, type InsertInvestmentIdeaTracking, type InvestmentIdeaAlert, type InsertInvestmentIdeaAlert, type YieldTracker, type InsertYieldTracker, type PartnerApplication, type InsertPartnerApplication, type TaxRule, type InsertTaxRule, type TaxReminderSubscription, type InsertTaxReminderSubscription, type CapitalGainsTaxReminder, type InsertCapitalGainsTaxReminder, type UserExpense, type InsertUserExpense, type UserBudget, type InsertUserBudget, type ExpenseInsight, type InsertExpenseInsight, type FinancialObligation, type InsertFinancialObligation, type NpsAccount, type ApyAccount, type ClientTask, type InsertClientTask } from "@shared/schema";
import { type CashfreeTransaction, type InsertCashfreeTransaction, type PhonePeTransaction, type InsertPhonePeTransaction, type AgentDocument, type InsertAgentDocument, type AgentCommissionSplit, type InsertAgentCommissionSplit, type AgentCommission, type InsertAgentCommission, type AmfiVerificationLog, type InsertAmfiVerificationLog } from "@shared/schema";
import { type Product, type InsertProduct, type ApplicationDocument, type InsertApplicationDocument, type ProductAccountPreference, type InsertProductAccountPreference, type ICICILoanApplication, type InsertICICILoanApplication, type ICICICreditScore, type InsertICICICreditScore, type PortfolioComparison, type InsertPortfolioComparison, type ChatSession, type InsertChatSession, type ChatMessage, type InsertChatMessage, type ChatAction, type InsertChatAction, type ChatFunction, type InsertChatFunction, type CurrencyRate, type InsertCurrencyRate, type CkycNotificationTrigger, type InsertCkycNotificationTrigger, type KycVerificationSession, type InsertKycVerificationSession, type ManualKycSubmission, type InsertManualKycSubmission, type ManualKycDocument, type InsertManualKycDocument, type UnlistedCompany, type InsertUnlistedCompany, type CompanyFinancials, type InsertCompanyFinancials, type CompanyRatios, type InsertCompanyRatios, type UnlistedPriceHistory, type InsertUnlistedPriceHistory, type SellListing, type InsertSellListing, type BuyRequest, type InsertBuyRequest, type UnlistedDeal, type InsertUnlistedDeal, type Probe42SyncLog, type InsertProbe42SyncLog, type SupportTemplate, type InsertSupportTemplate, type SupportStep, type InsertSupportStep, type SupportStepComment, type InsertSupportStepComment, type UnifiedCartItem, type InsertUnifiedCartItem } from "@shared/schema";
import session from "express-session";
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
  getUserByUsername(username: string): Promise<User | undefined>;
  
  sessionStore: session.Store;
  
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
  
  // Admin settings methods
  getAdminSettings(): Promise<any>;

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
  setDefaultBankAccount(accountId: string, defaultType: 'mutualFunds' | 'primary'): Promise<boolean>;

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
  updateBudgetSpendById(budgetId: string, amount: number): Promise<FamilyBudget>;
  
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
  updateBudgetSpendByUser(userId: string, category: string, amount: number): Promise<void>;
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

  // Agent Notification methods
  createAgentNotification(data: { agentId: string; title: string; body: string; type?: string; link?: string }): Promise<void>;
  getAgentNotifications(agentId: string): Promise<any[]>;
  markAgentNotificationRead(id: string): Promise<void>;
}
