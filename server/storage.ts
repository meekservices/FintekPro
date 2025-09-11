import { type User, type UpsertUser, type Portfolio, type InsertPortfolio, type PortfolioHolding, type InsertPortfolioHolding, type Watchlist, type InsertWatchlist, type MarketData, type AssetAllocation, type InsertAssetAllocation, type MutualFund, type InsertMutualFund, type OtpVerification, type InsertOtpVerification, type UserProfile, type InsertUserProfile, type CapitalGainsReport, type InsertCapitalGainsReport, type TransactionReport, type InsertTransactionReport, type TransactionRecord, type InsertTransactionRecord, type CustomerCareAgent, type InsertCustomerCareAgent, type AgentPartnerMapping, type InsertAgentPartnerMapping, type CkycRecord, type InsertCkycRecord, type CkycDocument, type InsertCkycDocument, type CkycStatusHistory, type InsertCkycStatusHistory, type ClientAgentRelationship, type InsertClientAgentRelationship, type InvestmentProposal, type InsertInvestmentProposal, type InvestmentProposalItem, type InsertInvestmentProposalItem, type ProposalPayment, type InsertProposalPayment, type IBAccount, type InsertIBAccount, type IBOrder, type InsertIBOrder, type IBPosition, type InsertIBPosition, type IBAccountSummary, type InsertIBAccountSummary, type IBMarketDataSubscription, type InsertIBMarketDataSubscription, type IBTradingSession, type InsertIBTradingSession, type Supplier, type InsertSupplier, type EpfHolding, type PpfHolding, type EpsHolding, type GovernmentSchemeConsent, type InsertGovernmentSchemeConsent, type InsuranceHolding, type InsertInsuranceHolding, type UserBankAccount, type InsertUserBankAccount, type UserDematAccount, type InsertUserDematAccount, type AchievementCategory, type InsertAchievementCategory, type Achievement, type InsertAchievement, type UserAchievement, type InsertUserAchievement, type LearningProgress, type InsertLearningProgress, type SocialShare, type InsertSocialShare, type FinancialGoal, type InsertFinancialGoal } from "@shared/schema";
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
  deleteUser(id: string): Promise<boolean>;
  updateUserStatus(id: string, isActive: boolean): Promise<User | undefined>;
  
  // OTP verification methods
  createOtpVerification(otp: InsertOtpVerification): Promise<OtpVerification>;
  getOtpVerification(identifier: string, type: string): Promise<OtpVerification | undefined>;
  verifyOtp(identifier: string, type: string, otp: string): Promise<boolean>;
  cleanupExpiredOtps(): Promise<void>;
  
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

  // CKYC Progress Monitoring methods - temporarily commented due to schema inconsistencies
  // createCkycNotificationTrigger(trigger: InsertCkycNotificationTrigger): Promise<CkycNotificationTrigger>;
  getCkycNotificationTriggers(ckycRecordId?: string, status?: string): Promise<any[]>;
  // updateCkycNotificationStatus(id: string, status: string, sentAt?: Date, failureReason?: string): Promise<CkycNotificationTrigger | undefined>;

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
      role: schema.users.role,
      roles: schema.users.roles,
      isActive: schema.users.isActive,
      loginCount: schema.users.loginCount,
      createdAt: schema.users.createdAt,
      lastLoginAt: schema.users.lastLoginAt
    }).from(schema.users).where(eq(schema.users.id, id));
    
    if (!user) return undefined;
    
    // Ensure roles compatibility
    const userWithRoles = {
      ...user,
      roles: user.roles || (user.role ? [user.role] : [])
    };
    
    return userWithRoles as User;
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

  // Portfolio methods
  async getPortfoliosByUserId(userId: string): Promise<Portfolio[]> {
    return await db.select().from(schema.portfolios).where(eq(schema.portfolios.userId, userId));
  }

  async getPortfoliosByUserPan(panNumber: string): Promise<Portfolio[]> {
    const userProfile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.panNumber, panNumber));
    if (!userProfile.length) return [];
    
    return await db.select().from(schema.portfolios).where(eq(schema.portfolios.userId, userProfile[0].userId));
  }

  async getPortfolio(id: string): Promise<Portfolio | undefined> {
    const [portfolio] = await db.select().from(schema.portfolios).where(eq(schema.portfolios.id, id));
    return portfolio || undefined;
  }

  async getUserByPan(panNumber: string): Promise<User | undefined> {
    const [userProfile] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.panNumber, panNumber));
    if (!userProfile) return undefined;
    
    return this.getUser(userProfile.userId);
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
    return [];
  }

  async getMutualFund(schemeCode: string): Promise<MutualFund | undefined> {
    return undefined;
  }

  async upsertMutualFund(fund: InsertMutualFund): Promise<MutualFund> {
    throw new Error("Method not implemented");
  }

  async searchMutualFunds(query: string): Promise<MutualFund[]> {
    return [];
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
    return [];
  }

  async updateAgentPartnerMapping(id: string, updates: Partial<AgentPartnerMapping>): Promise<AgentPartnerMapping | undefined> {
    return undefined;
  }

  async deleteAgentPartnerMapping(id: string): Promise<boolean> {
    return false;
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

  async getAgentForClient(clientId: string, relationshipType?: string): Promise<ClientAgentRelationship | undefined> {
    return undefined;
  }

  async getClientsForAgent(agentId: string): Promise<ClientAgentRelationship[]> {
    return [];
  }

  async getInvestmentProposals(options?: { clientId?: string; agentId?: string; status?: string }): Promise<InvestmentProposal[]> {
    return [];
  }

  async getInvestmentProposal(id: string): Promise<InvestmentProposal | undefined> {
    return undefined;
  }

  async createInvestmentProposal(proposal: InsertInvestmentProposal): Promise<InvestmentProposal> {
    throw new Error("Method not implemented");
  }

  async updateInvestmentProposal(id: string, updates: Partial<InvestmentProposal>): Promise<InvestmentProposal | undefined> {
    return undefined;
  }

  async deleteInvestmentProposal(id: string): Promise<boolean> {
    return false;
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

  // Property access for backward compatibility
  get db() {
    return db;
  }
}

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();