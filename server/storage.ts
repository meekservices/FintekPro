import { type User, type UpsertUser, type Portfolio, type InsertPortfolio, type PortfolioHolding, type InsertPortfolioHolding, type Watchlist, type InsertWatchlist, type MarketData, type AssetAllocation, type InsertAssetAllocation, type MutualFund, type InsertMutualFund, type OtpVerification, type InsertOtpVerification, type UserProfile, type InsertUserProfile, type CapitalGainsReport, type InsertCapitalGainsReport, type TransactionReport, type InsertTransactionReport, type TransactionRecord, type InsertTransactionRecord, type CustomerCareAgent, type InsertCustomerCareAgent, type AgentPartnerMapping, type InsertAgentPartnerMapping, type CkycRecord, type InsertCkycRecord, type CkycDocument, type InsertCkycDocument, type CkycStatusHistory, type InsertCkycStatusHistory, type ClientAgentRelationship, type InsertClientAgentRelationship, type InvestmentProposal, type InsertInvestmentProposal, type InvestmentProposalItem, type InsertInvestmentProposalItem, type ProposalPayment, type InsertProposalPayment, type IBAccount, type InsertIBAccount, type IBOrder, type InsertIBOrder, type IBPosition, type InsertIBPosition, type IBAccountSummary, type InsertIBAccountSummary, type IBMarketDataSubscription, type InsertIBMarketDataSubscription, type IBTradingSession, type InsertIBTradingSession, type Supplier, type InsertSupplier, type EpfHolding, type PpfHolding, type EpsHolding, type GovernmentSchemeConsent, type InsertGovernmentSchemeConsent, type InsuranceHolding, type InsertInsuranceHolding, type UserBankAccount, type InsertUserBankAccount, type UserDematAccount, type InsertUserDematAccount, type AchievementCategory, type InsertAchievementCategory, type Achievement, type InsertAchievement, type UserAchievement, type InsertUserAchievement, type LearningProgress, type InsertLearningProgress, type SocialShare, type InsertSocialShare, type FinancialGoal, type InsertFinancialGoal, type TaxDocument, type InsertTaxDocument, type StructuredTaxData, type InsertStructuredTaxData, type UserAlert, type InsertUserAlert, type AlertHistory, type InsertAlertHistory, type AlertTemplate, type InsertAlertTemplate, type FamilyGroup, type InsertFamilyGroup, type FamilyMember, type InsertFamilyMember, type FamilyGoal, type InsertFamilyGoal, type FamilyGoalContribution, type InsertFamilyGoalContribution, type FamilyActivityLog, type InsertFamilyActivityLog, type FamilyDiscussion, type InsertFamilyDiscussion, type FamilyBudget, type InsertFamilyBudget, type FamilyPortfolioPermission, type InsertFamilyPortfolioPermission, type TaxCalculation, type InsertTaxCalculation, type TaxDocumentAccessLog, type InsertTaxDocumentAccessLog, type TaxSession, type InsertTaxSession, type TaxDataSource, type InsertTaxDataSource, type ValidationIssue, type InsertValidationIssue, type FilingRecord, type InsertFilingRecord, type AiOptimizationSuggestion, type InsertAiOptimizationSuggestion, type FundExtended, type Provenance, type FundSearchParams, type FundListResponse, type SourceStatus, type MultiSourceStatus, type LoanProduct, type InsertLoanProduct, type LoanProvider, type InsertLoanProvider, type ProviderProduct, type InsertProviderProduct, type CreditProfile, type InsertCreditProfile, type LoanRequest, type InsertLoanRequest, type LoanOffer, type InsertLoanOffer, type LoanApplicationMarketplace, type InsertLoanApplicationMarketplace, type ProviderIntegration, type InsertProviderIntegration, type PartnerApplicationDocument, type InsertPartnerApplicationDocument, type InvestmentIdea, type InsertInvestmentIdea, type InvestmentIdeaTracking, type InsertInvestmentIdeaTracking, type InvestmentIdeaAlert, type InsertInvestmentIdeaAlert, type YieldTracker, type InsertYieldTracker, type PartnerApplication, type InsertPartnerApplication, type TaxRule, type InsertTaxRule, type TaxReminderSubscription, type InsertTaxReminderSubscription, type CapitalGainsTaxReminder, type InsertCapitalGainsTaxReminder } from "@shared/schema";
import { type PhonePeTransaction, type InsertPhonePeTransaction } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, desc, asc, gte, lte, like, sql } from "drizzle-orm";
import * as schema from "@shared/schema";

// We'll import hashPassword later to avoid circular dependency

export interface IStorage {
  // User methods for mobile/email authentication
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
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
  updateUserStatus(userId: string, isActive: boolean): Promise<void>;
  
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

  // Supplier methods
  getAllSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | undefined>;
  deleteSupplier(id: string): Promise<boolean>;
  
  // Supplier Product methods
  getSupplierProducts(supplierId?: string): Promise<SupplierProduct[]>;
  getSupplierProduct(id: string): Promise<SupplierProduct | undefined>;
  createSupplierProduct(product: InsertSupplierProduct): Promise<SupplierProduct>;
  updateSupplierProduct(id: string, updates: Partial<SupplierProduct>): Promise<SupplierProduct | undefined>;
  deleteSupplierProduct(id: string): Promise<boolean>;
  
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
  
  // Product Performance methods
  getProductPerformanceMetrics(productId?: string): Promise<ProductPerformanceMetric[]>;
  createProductPerformanceMetric(metric: InsertProductPerformanceMetric): Promise<ProductPerformanceMetric>;
  updateProductPerformanceMetric(id: string, updates: Partial<ProductPerformanceMetric>): Promise<ProductPerformanceMetric | undefined>;
  deleteProductPerformanceMetric(id: string): Promise<boolean>;
  
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
  
  // Provider Integration methods
  getProviderIntegrations(): Promise<ProviderIntegration[]>;
  getProviderIntegrationsByProvider(providerId: string): Promise<ProviderIntegration[]>;
  createProviderIntegration(integration: InsertProviderIntegration): Promise<ProviderIntegration>;
  updateProviderIntegration(id: string, updates: Partial<ProviderIntegration>): Promise<ProviderIntegration | undefined>;
  
  // Application Document methods
  getApplicationDocuments(applicationId: string): Promise<ApplicationDocument[]>;
  createApplicationDocument(document: InsertApplicationDocument): Promise<ApplicationDocument>;
  updateApplicationDocument(id: string, updates: Partial<ApplicationDocument>): Promise<ApplicationDocument | undefined>;
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
  markAlertAsRead(id: string): Promise<InvestmentIdeaAlert | undefined>;
  
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
  
  // PhonePe Transaction methods
  createPhonePeTransaction(transaction: InsertPhonePeTransaction): Promise<PhonePeTransaction>;
  getPhonePeTransaction(id: string): Promise<PhonePeTransaction | undefined>;
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
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select({
      id: schema.users.id,
      email: schema.users.email,
      mobile: schema.users.mobile,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      roles: schema.users.roles,
      isActive: schema.users.isActive,
      loginCount: schema.users.loginCount,
      createdAt: schema.users.createdAt,
      lastLoginAt: schema.users.lastLoginAt
    }).from(schema.users).where(eq(schema.users.id, id));
    
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

  async createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
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

  async cleanupExpiredOtps(): Promise<void> {
    await db
      .delete(schema.otpVerifications)
      .where(lte(schema.otpVerifications.expiresAt, new Date()));
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
      .set({ role, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  // Placeholder implementations for other methods
  // In a complete implementation, you would implement all methods from IStorage
  async getEpfHoldings(userId: string): Promise<EpfHolding[]> {
    // This would need to be implemented based on your schema
    return [];
  }

  async getPpfHoldings(userId: string): Promise<PpfHolding[]> {
    return [];
  }

  async getEpsHoldings(userId: string): Promise<EpsHolding[]> {
    return [];
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
    return false;
  }

  async createGovernmentSchemeConsent(consent: InsertGovernmentSchemeConsent): Promise<GovernmentSchemeConsent> {
    throw new Error("Method not implemented");
  }

  async getGovernmentSchemeConsents(userId: string, panNumber?: string): Promise<GovernmentSchemeConsent[]> {
    return [];
  }

  async revokeGovernmentSchemeConsent(userId: string, panNumber: string, schemeType: string): Promise<boolean> {
    return false;
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
              OR LOWER(${schema.mutualFunds.category}) LIKE ${searchTerm}`
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
    return result.rowCount > 0;
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

      if (agentId) {
        query = query.where(eq(schema.agentPartnerMappings.agentId, agentId));
      }
      if (partnerId) {
        query = query.where(eq(schema.agentPartnerMappings.partnerId, partnerId));
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
      const clientIds = [...new Set(basicResults.map(r => r.clientId))];
      const agentIds = [...new Set(basicResults.map(r => r.agentId))];
      const allUserIds = [...new Set([...clientIds, ...agentIds])];
      
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
    return [];
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
        // Create a user account for the agent
        [agentUser] = await db
          .insert(schema.users)
          .values({
            email: defaultAgent.email,
            firstName: defaultAgent.fullName.split(' ')[0] || defaultAgent.fullName,
            lastName: defaultAgent.fullName.split(' ').slice(1).join(' ') || '',
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

  async getAllSuppliers(): Promise<Supplier[]> {
    return [];
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    return undefined;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    throw new Error("Method not implemented");
  }

  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | undefined> {
    return undefined;
  }

  async deleteSupplier(id: string): Promise<boolean> {
    return false;
  }

  async getSupplierProducts(supplierId?: string): Promise<SupplierProduct[]> {
    return [];
  }

  async getSupplierProduct(id: string): Promise<SupplierProduct | undefined> {
    return undefined;
  }

  async createSupplierProduct(product: InsertSupplierProduct): Promise<SupplierProduct> {
    throw new Error("Method not implemented");
  }

  async updateSupplierProduct(id: string, updates: Partial<SupplierProduct>): Promise<SupplierProduct | undefined> {
    return undefined;
  }

  async deleteSupplierProduct(id: string): Promise<boolean> {
    return false;
  }

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
      conditions.push(eq(schema.products.subcategory, filters.subcategory));
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
      conditions.push(eq(schema.products.subcategory, subcategory));
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
      dataFreshnessDate: new Date(),
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

  async getProductPerformanceMetrics(productId?: string): Promise<ProductPerformanceMetric[]> {
    return [];
  }

  async createProductPerformanceMetric(metric: InsertProductPerformanceMetric): Promise<ProductPerformanceMetric> {
    throw new Error("Method not implemented");
  }

  async updateProductPerformanceMetric(id: string, updates: Partial<ProductPerformanceMetric>): Promise<ProductPerformanceMetric | undefined> {
    return undefined;
  }

  async deleteProductPerformanceMetric(id: string): Promise<boolean> {
    return false;
  }

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

  async createLoanApplication(application: any): Promise<any> {
    return application;
  }

  async getLoanApplication(id: string): Promise<any | undefined> {
    return undefined;
  }

  async getUserLoans(userId: string): Promise<any[]> {
    return [];
  }

  async updateLoanStatus(id: string, updates: any): Promise<any | undefined> {
    return undefined;
  }

  async getCollateralValuation(loanId: string): Promise<any | undefined> {
    return undefined;
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
    return db.select().from(schema.loanProducts).orderBy(schema.loanProducts.name);
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
    return db.select().from(schema.loanProviders).orderBy(schema.loanProviders.name);
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
    let query = db
      .select()
      .from(schema.providerProducts)
      .where(eq(schema.providerProducts.providerId, providerId));

    if (productKey) {
      query = query.where(eq(schema.providerProducts.productKey, productKey));
    }

    return query.orderBy(schema.providerProducts.createdAt);
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
    let query = db.select().from(schema.loanRequests);
    
    if (userId) {
      query = query.where(eq(schema.loanRequests.userId, userId));
    }
    
    return query.orderBy(desc(schema.loanRequests.createdAt));
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
      .where(eq(schema.loanOffers.loanRequestId, requestId))
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
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.loanOffers.id, id))
      .returning();
    return updated;
  }

  // Loan Application Marketplace methods
  async getLoanApplicationsMarketplace(userId?: string): Promise<LoanApplicationMarketplace[]> {
    let query = db.select().from(schema.loanApplicationsMarketplace);
    
    if (userId) {
      query = query.where(eq(schema.loanApplicationsMarketplace.userId, userId));
    }
    
    return query.orderBy(desc(schema.loanApplicationsMarketplace.createdAt));
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

  // Application Document methods
  async getApplicationDocuments(applicationId: string): Promise<ApplicationDocument[]> {
    return db
      .select()
      .from(schema.applicationDocuments)
      .where(eq(schema.applicationDocuments.applicationId, applicationId))
      .orderBy(schema.applicationDocuments.createdAt);
  }

  async createApplicationDocument(document: InsertApplicationDocument): Promise<ApplicationDocument> {
    const documentWithId = { ...document, id: randomUUID() };
    const [created] = await db
      .insert(schema.applicationDocuments)
      .values(documentWithId)
      .returning();
    return created;
  }

  async updateApplicationDocument(id: string, updates: Partial<ApplicationDocument>): Promise<ApplicationDocument | undefined> {
    const [updated] = await db
      .update(schema.applicationDocuments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.applicationDocuments.id, id))
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
    let query = this.db
      .select()
      .from(schema.taxDocuments)
      .where(eq(schema.taxDocuments.userId, userId));

    if (financialYear) {
      query = query.where(eq(schema.taxDocuments.financialYear, financialYear));
    }

    return await query.orderBy(desc(schema.taxDocuments.createdAt));
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
    let query = this.db
      .select({
        ...schema.structuredTaxData,
        document: schema.taxDocuments
      })
      .from(schema.structuredTaxData)
      .innerJoin(schema.taxDocuments, eq(schema.structuredTaxData.documentId, schema.taxDocuments.id))
      .where(eq(schema.structuredTaxData.userId, userId));

    if (financialYear) {
      query = query.where(eq(schema.taxDocuments.financialYear, financialYear));
    }

    return await query.orderBy(desc(schema.structuredTaxData.createdAt));
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
    let query = this.db
      .select()
      .from(schema.taxCalculations)
      .where(eq(schema.taxCalculations.userId, userId));

    if (financialYear) {
      query = query.where(eq(schema.taxCalculations.financialYear, financialYear));
    }

    return await query.orderBy(desc(schema.taxCalculations.createdAt));
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

      // Simulate processing based on document type and file format
      const mockExtractedData = this.generateMockTaxData(document);
      
      // Create structured tax data entries
      let extractedCount = 0;
      for (const data of mockExtractedData) {
        await this.createStructuredTaxData({
          ...data,
          documentId,
          userId: document.userId
        });
        extractedCount++;
      }

      // Mark document as completed
      await this.updateTaxDocument(documentId, {
        processingStatus: 'completed',
        processingCompletedAt: new Date()
      });

      return { success: true, extractedDataCount: extractedCount };

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
      if (data.taxableAmount && data.taxableAmount < 0) {
        errors.push(`Negative taxable amount for entry ${data.id}`);
      }

      if (data.taxDeducted && data.taxDeducted < 0) {
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
    itrJson.income.totalIncome = Object.values(itrJson.income).reduce((sum: number, val: number) => sum + val, 0);
    itrJson.taxComputation.totalIncome = itrJson.income.totalIncome - itrJson.deductions.totalDeductions;

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
      totalIncome,
      taxableIncome,
      standardDeduction,
      section80cDeductions,
      totalDeductions,
      grossTaxLiability,
      educationCess,
      totalTaxPayable,
      tdsDeducted,
      advanceTaxPaid,
      totalTaxPaid,
      refundDue,
      taxPayable,
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

  // Helper methods for tax calculations
  private generateMockTaxData(document: TaxDocument): Partial<InsertStructuredTaxData>[] {
    // This would be replaced with actual document parsing logic
    const mockData: Partial<InsertStructuredTaxData>[] = [];

    if (document.documentType === '26AS') {
      // Mock TDS entries
      mockData.push({
        dataType: 'TDS',
        dataCategory: 'deduction',
        sourceType: 'employer',
        taxableAmount: 500000,
        taxDeducted: 50000,
        transactionDate: new Date('2024-03-31'),
        deductorPan: 'ABCDE1234F',
        deductorName: 'Sample Employer',
        incomeNature: 'salary'
      });
    }

    if (document.documentType === 'AIS') {
      // Mock interest income
      mockData.push({
        dataType: 'interest',
        dataCategory: 'income',
        sourceType: 'bank',
        taxableAmount: 25000,
        taxDeducted: 2500,
        transactionDate: new Date('2024-03-31'),
        bankName: 'Sample Bank',
        incomeNature: 'interest'
      });
    }

    return mockData;
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
    return salaryData.reduce((total, item) => total + (item.taxableAmount || 0), 0);
  }

  private calculateCapitalGains(capitalGainsData: any[]): number {
    return capitalGainsData.reduce((total, item) => total + (item.taxableAmount || 0), 0);
  }

  private calculateOtherIncome(interestData: any[], dividendData: any[]): number {
    const interest = interestData.reduce((total, item) => total + (item.taxableAmount || 0), 0);
    const dividend = dividendData.reduce((total, item) => total + (item.taxableAmount || 0), 0);
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
    return result.rowCount > 0;
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

  async markAlertAsRead(id: string): Promise<InvestmentIdeaAlert | undefined> {
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
    return result.rowCount > 0;
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
    let query = db
      .select()
      .from(schema.partnerApplications)
      .where(eq(schema.partnerApplications.lender, lender));
    
    if (status) {
      query = query.where(and(
        eq(schema.partnerApplications.lender, lender),
        eq(schema.partnerApplications.status, status)
      ));
    }

    return await query.orderBy(desc(schema.partnerApplications.createdAt));
  }

  async getApplicationPrefillData(userId: string, lender: string, recommendationId?: string): Promise<any> {
    // Get user profile for pre-filling
    const userProfile = await this.getUserProfile(userId);
    const user = await this.getUser(userId);
    
    if (!userProfile || !user) {
      throw new Error('User profile not found for prefill data');
    }

    // Base prefill data from user profile
    const prefillData = {
      // Personal Information
      panNumber: userProfile.panNumber,
      aadharNumber: userProfile.aadharNumber,
      currentAddress: userProfile.address || `${userProfile.city}, ${userProfile.state}, ${userProfile.country}`,
      employmentType: userProfile.occupationType || 'salaried',
      monthlyIncome: userProfile.annualIncome ? Math.round(userProfile.annualIncome / 12) : 0,
      workExperience: userProfile.workExperience || 5,
      
      // Banking Information
      bankName: userProfile.primaryBankName || '',
      
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
      prefillData.recommendationId = recommendationId;
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
    return result.rowCount > 0;
  }

  // PhonePe Transaction methods
  async createPhonePeTransaction(transaction: InsertPhonePeTransaction): Promise<PhonePeTransaction> {
    const [result] = await db.insert(schema.phonepeTransactions).values(transaction).returning();
    return result;
  }

  async getPhonePeTransaction(id: string): Promise<PhonePeTransaction | undefined> {
    const [result] = await db
      .select()
      .from(schema.phonepeTransactions)
      .where(eq(schema.phonepeTransactions.id, id))
      .limit(1);
    return result;
  }

  async getPhonePeTransactionByMerchantId(merchantTransactionId: string): Promise<PhonePeTransaction | undefined> {
    const [result] = await db
      .select()
      .from(schema.phonepeTransactions)
      .where(eq(schema.phonepeTransactions.merchantTransactionId, merchantTransactionId))
      .limit(1);
    return result;
  }

  async updatePhonePeTransaction(id: string, updates: Partial<PhonePeTransaction>): Promise<PhonePeTransaction | undefined> {
    const [result] = await db
      .update(schema.phonepeTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.phonepeTransactions.id, id))
      .returning();
    return result;
  }

  async getPhonePeTransactionsByUserId(userId: string): Promise<PhonePeTransaction[]> {
    return await db
      .select()
      .from(schema.phonepeTransactions)
      .where(eq(schema.phonepeTransactions.userId, userId))
      .orderBy(desc(schema.phonepeTransactions.createdAt));
  }

  async getPhonePeTransactionsByStatus(status: string): Promise<PhonePeTransaction[]> {
    return await db
      .select()
      .from(schema.phonepeTransactions)
      .where(eq(schema.phonepeTransactions.status, status))
      .orderBy(desc(schema.phonepeTransactions.createdAt));
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
        email: r.userEmail,
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

  async updateBudgetSpend(budgetId: string, amount: number): Promise<FamilyBudget> {
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

  async markAlertAsRead(historyId: string): Promise<AlertHistory | undefined> {
    const [result] = await db
      .update(schema.alertHistory)
      .set({ isRead: true, isViewed: true })
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
    const config = { ...template.defaultConfig, ...customData };
    
    const [result] = await db
      .insert(schema.userAlerts)
      .values({
        userId,
        alertName: config.alertName || template.templateName,
        alertType: template.templateType as any,
        category: template.category as any,
        symbol: config.symbol,
        targetValue: config.targetValue,
        threshold: config.threshold,
        operator: config.operator,
        timeframe: config.timeframe,
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
      const totalCalls = (func.usageCount || 0) + 1;
      const successCalls = success 
        ? Math.round(((func.successRate || 0) / 100) * (func.usageCount || 0)) + 1
        : Math.round(((func.successRate || 0) / 100) * (func.usageCount || 0));
      const newSuccessRate = (successCalls / totalCalls) * 100;

      await db
        .update(schema.chatFunctions)
        .set({
          usageCount: totalCalls,
          successRate: newSuccessRate,
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
}

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();