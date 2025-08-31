import { type User, type UpsertUser, type Portfolio, type InsertPortfolio, type PortfolioHolding, type InsertPortfolioHolding, type Watchlist, type InsertWatchlist, type MarketData, type AssetAllocation, type InsertAssetAllocation, type MutualFund, type InsertMutualFund, type OtpVerification, type InsertOtpVerification, type UserProfile, type InsertUserProfile, type CapitalGainsReport, type InsertCapitalGainsReport, type TransactionReport, type InsertTransactionReport, type TransactionRecord, type InsertTransactionRecord, type CustomerCareAgent, type InsertCustomerCareAgent, type AgentPartnerMapping, type InsertAgentPartnerMapping, type CkycRecord, type InsertCkycRecord, type CkycDocument, type InsertCkycDocument, type CkycStatusHistory, type InsertCkycStatusHistory, type CkycNotificationTrigger, type CkycProgressStep, type CkycActionLog, type ClientAgentRelationship, type InsertClientAgentRelationship, type InvestmentProposal, type InsertInvestmentProposal, type InvestmentProposalItem, type InsertInvestmentProposalItem, type ProposalPayment, type InsertProposalPayment, type IBAccount, type InsertIBAccount, type IBOrder, type InsertIBOrder, type IBPosition, type InsertIBPosition, type IBAccountSummary, type InsertIBAccountSummary, type IBMarketDataSubscription, type InsertIBMarketDataSubscription, type IBTradingSession, type InsertIBTradingSession, type Supplier, type InsertSupplier, type SupplierProduct, type InsertSupplierProduct, type ProductPerformanceMetric, type InsertProductPerformanceMetric, type EpfHolding, type PpfHolding, type EpsHolding, type GovernmentSchemeConsent, type InsertGovernmentSchemeConsent, type InsuranceHolding, type InsertInsuranceHolding } from "@shared/schema";
import { randomUUID } from "crypto";

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

  // CKYC Progress Monitoring methods
  createCkycNotificationTrigger(trigger: InsertCkycNotificationTrigger): Promise<CkycNotificationTrigger>;
  getCkycNotificationTriggers(ckycRecordId?: string, status?: string): Promise<CkycNotificationTrigger[]>;
  updateCkycNotificationStatus(id: string, status: string, sentAt?: Date, failureReason?: string): Promise<CkycNotificationTrigger | undefined>;

  // CKYC Progress Steps methods
  createCkycProgressStep(step: InsertCkycProgressStep): Promise<CkycProgressStep>;
  getCkycProgressSteps(ckycRecordId: string): Promise<CkycProgressStep[]>;
  updateCkycProgressStep(id: string, updates: Partial<CkycProgressStep>): Promise<CkycProgressStep | undefined>;
  
  // CKYC Action Log methods
  createCkycActionLog(log: InsertCkycActionLog): Promise<CkycActionLog>;
  getCkycActionLogs(ckycRecordId?: string, actionBy?: string): Promise<CkycActionLog[]>;

  // CKYC Notification Service methods
  sendNotification(trigger: CkycNotificationTrigger): Promise<boolean>;
  processPendingNotifications(): Promise<void>;

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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private usersByEmail: Map<string, User>;
  private usersByMobile: Map<string, User>;
  private otpVerifications: Map<string, OtpVerification>;
  private portfolios: Map<string, Portfolio>;
  private portfolioHoldings: Map<string, PortfolioHolding>;
  private watchlists: Map<string, Watchlist>;
  private marketData: Map<string, MarketData>;
  private assetAllocations: Map<string, AssetAllocation>;
  private mutualFunds: Map<string, MutualFund>;
  private userProfiles: Map<string, UserProfile>;
  private riskProfiles: Map<string, any>;
  private riskProfilesByUserId: Map<string, any>;
  private riskAssessmentQuestions: Map<string, any>;
  private capitalGainsReports: Map<string, CapitalGainsReport>;
  private transactionReports: Map<string, TransactionReport>;
  private transactionRecords: Map<string, TransactionRecord>;
  private customerCareAgents: Map<string, CustomerCareAgent>;
  private agentPartnerMappings: Map<string, AgentPartnerMapping>;
  private ckycRecords: Map<string, CkycRecord>;
  private ckycDocuments: Map<string, CkycDocument[]>;
  private ckycStatusHistory: Map<string, CkycStatusHistory[]>;
  private ckycNotificationTriggers: Map<string, CkycNotificationTrigger>;
  private ckycProgressSteps: Map<string, CkycProgressStep[]>;
  private ckycActionLogs: Map<string, CkycActionLog[]>;
  private clientAgentRelationships: Map<string, ClientAgentRelationship>;
  private investmentProposals: Map<string, InvestmentProposal>;
  private investmentProposalItems: Map<string, InvestmentProposalItem[]>;
  private proposalPayments: Map<string, ProposalPayment>;
  private ibAccounts: Map<string, IBAccount>;
  private ibOrders: Map<string, IBOrder>;
  private ibPositions: Map<string, IBPosition>;
  private ibAccountSummaries: Map<string, IBAccountSummary>;
  private ibMarketDataSubscriptions: Map<string, IBMarketDataSubscription>;
  private ibTradingSessions: Map<string, IBTradingSession>;
  private suppliers: Map<string, Supplier>;
  private supplierProducts: Map<string, SupplierProduct>;
  private productPerformanceMetrics: Map<string, ProductPerformanceMetric>;
  private clientAssignments: Map<string, any>;
  private epfHoldings: Map<string, EpfHolding[]>;
  private ppfHoldings: Map<string, PpfHolding[]>;
  private epsHoldings: Map<string, EpsHolding[]>;
  private governmentSchemeConsents: Map<string, GovernmentSchemeConsent[]>;
  private insuranceHoldings: Map<string, InsuranceHolding[]>;
  private loanApplications: Map<string, any>;
  private collateralValuations: Map<string, any>;

  constructor() {
    this.users = new Map();
    this.usersByEmail = new Map();
    this.usersByMobile = new Map();
    this.otpVerifications = new Map();
    this.portfolios = new Map();
    this.portfolioHoldings = new Map();
    this.watchlists = new Map();
    this.marketData = new Map();
    this.assetAllocations = new Map();
    this.mutualFunds = new Map();
    this.userProfiles = new Map();
    this.riskProfiles = new Map();
    this.riskProfilesByUserId = new Map();
    this.riskAssessmentQuestions = new Map();
    this.capitalGainsReports = new Map();
    this.transactionReports = new Map();
    this.transactionRecords = new Map();
    this.customerCareAgents = new Map();
    this.agentPartnerMappings = new Map();
    this.ckycRecords = new Map();
    this.ckycDocuments = new Map();
    this.ckycStatusHistory = new Map();
    this.ckycNotificationTriggers = new Map();
    this.ckycProgressSteps = new Map();
    this.ckycActionLogs = new Map();
    this.clientAgentRelationships = new Map();
    this.investmentProposals = new Map();
    this.investmentProposalItems = new Map();
    this.proposalPayments = new Map();
    this.ibAccounts = new Map();
    this.ibOrders = new Map();
    this.ibPositions = new Map();
    this.ibAccountSummaries = new Map();
    this.ibMarketDataSubscriptions = new Map();
    this.ibTradingSessions = new Map();
    this.suppliers = new Map();
    this.supplierProducts = new Map();
    this.productPerformanceMetrics = new Map();
    this.clientAssignments = new Map();
    this.epfHoldings = new Map();
    this.ppfHoldings = new Map();
    this.epsHoldings = new Map();
    this.governmentSchemeConsents = new Map();
    this.insuranceHoldings = new Map();
    this.loanApplications = new Map();
    this.collateralValuations = new Map();
    
    // Initialize with sample data
    this.initializeSampleData();
    this.initializeRiskAssessmentQuestions();
    this.initializeSampleReports();
    this.initializeSampleSuppliers();
    this.initializeGovernmentSchemeHoldings();
  }

  private initializeSampleData() {
    // Create sample users
    this.createSampleUsers();
    
    // Create sample portfolio
    const samplePortfolio: Portfolio = {
      id: "demo-portfolio-1",
      userId: "demo-user-1",
      name: "My Investment Portfolio",
      totalValue: "1250000",
      cash: "50000",
      isDefault: true,
      createdAt: new Date()
    };
    this.portfolios.set(samplePortfolio.id, samplePortfolio);

    // Create sample holdings across different exchanges and asset types
    const sampleHoldings: PortfolioHolding[] = [
      // NSE Equity holdings
      {
        id: "holding-1",
        portfolioId: "demo-portfolio-1",
        symbol: "TCS.NS",
        quantity: "50",
        avgPrice: "3650.00",
        assetType: "equity",
        updatedAt: new Date()
      },
      {
        id: "holding-2",
        portfolioId: "demo-portfolio-1",
        symbol: "INFY.NS",
        quantity: "75",
        avgPrice: "1545.00",
        assetType: "equity",
        updatedAt: new Date()
      },
      {
        id: "holding-3",
        portfolioId: "demo-portfolio-1",
        symbol: "RELIANCE.NS",
        quantity: "25",
        avgPrice: "2850.00",
        assetType: "equity",
        updatedAt: new Date()
      },
      // BSE Equity holdings
      {
        id: "holding-4",
        portfolioId: "demo-portfolio-1",
        symbol: "HDFC.BO",
        quantity: "40",
        avgPrice: "1680.00",
        assetType: "equity",
        updatedAt: new Date()
      },
      {
        id: "holding-5",
        portfolioId: "demo-portfolio-1",
        symbol: "ICICIBANK.BO",
        quantity: "60",
        avgPrice: "1150.00",
        assetType: "equity",
        updatedAt: new Date()
      },
      // MCX Commodity holdings
      {
        id: "holding-6",
        portfolioId: "demo-portfolio-1",
        symbol: "GOLD",
        quantity: "2",
        avgPrice: "65000.00",
        assetType: "commodity",
        updatedAt: new Date()
      },
      {
        id: "holding-7",
        portfolioId: "demo-portfolio-1",
        symbol: "CRUDE",
        quantity: "5",
        avgPrice: "6800.00",
        assetType: "commodity",
        updatedAt: new Date()
      },
      // NCDEX Agricultural commodity
      {
        id: "holding-8",
        portfolioId: "demo-portfolio-1",
        symbol: "WHEAT",
        quantity: "10",
        avgPrice: "2450.00",
        assetType: "commodity",
        updatedAt: new Date()
      },
      // MSEI Currency holding
      {
        id: "holding-9",
        portfolioId: "demo-portfolio-1",
        symbol: "USD_INR",
        quantity: "1000",
        avgPrice: "82.50",
        assetType: "currency",
        updatedAt: new Date()
      },
      // ETF and Mutual Fund holdings
      {
        id: "holding-10",
        portfolioId: "demo-portfolio-1",
        symbol: "NIFTYBEES.NS",
        quantity: "100",
        avgPrice: "245.00",
        assetType: "etf",
        updatedAt: new Date()
      }
    ];

    sampleHoldings.forEach(holding => {
      this.portfolioHoldings.set(holding.id, holding);
    });

    // Sample asset allocations
    const sampleAllocations: AssetAllocation[] = [
      {
        id: "allocation-1",
        portfolioId: "demo-portfolio-1",
        assetType: "equity",
        targetPercent: "60",
        currentPercent: "65",
        updatedAt: new Date()
      },
      {
        id: "allocation-2",
        portfolioId: "demo-portfolio-1",
        assetType: "bonds",
        targetPercent: "25",
        currentPercent: "20",
        updatedAt: new Date()
      },
      {
        id: "allocation-3", 
        portfolioId: "demo-portfolio-1",
        assetType: "gold",
        targetPercent: "10",
        currentPercent: "10",
        updatedAt: new Date()
      },
      {
        id: "allocation-4",
        portfolioId: "demo-portfolio-1", 
        assetType: "cash",
        targetPercent: "5",
        currentPercent: "5",
        updatedAt: new Date()
      }
    ];

    sampleAllocations.forEach(allocation => {
      this.assetAllocations.set(allocation.id, allocation);
    });

    // Create sample users with plain passwords (will be hashed later)
    this.createSampleUsers();
  }

  private createSampleUsers() {
    // Create a test user for login testing
    // Password: "password123" (will be properly hashed)
    const testUser: User = {
      id: "demo-user-1",
      email: "test@example.com",
      mobile: "+919876543210",
      password: "7a8c8c5c8df5f8e9d0e5f8c8d0c8e9f8c8e9d0c8e9f8.4f5d6c7a8b9e",  // Placeholder - will be properly hashed
      firstName: "John",
      middleName: null,
      lastName: "Doe",
      profileImageUrl: null,
      isEmailVerified: true,
      isMobileVerified: true,
      panNumber: "ABCDE1234F",
      aadharNumber: "123456789012",
      dateOfBirth: null,
      address: null,
      city: null,
      state: null,
      pincode: null,
      occupation: null,
      annualIncome: null,
      investmentExperience: null,
      riskTolerance: null,
      role: "user",
      isActive: true,
      lastLoginAt: null,
      loginCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(testUser.id, testUser);
    this.usersByEmail.set(testUser.email!, testUser);
    this.usersByMobile.set(testUser.mobile!, testUser);
  }

  // Method to be called after auth is set up to properly hash user passwords
  async initializeUserPasswords() {
    try {
      const { hashPassword } = await import("./auth");
      const testUser = this.users.get("demo-user-1");
      if (testUser && testUser.password === "7a8c8c5c8df5f8e9d0e5f8c8d0c8e9f8c8e9d0c8e9f8.4f5d6c7a8b9e") {
        const hashedPassword = await hashPassword("password123");
        testUser.password = hashedPassword;
        this.users.set(testUser.id, testUser);
        this.usersByEmail.set(testUser.email!, testUser);
        this.usersByMobile.set(testUser.mobile!, testUser);
        console.log("✅ Test user password initialized successfully");
      }
    } catch (error) {
      console.error("❌ Error initializing user passwords:", error);
    }
    
    // Create admin user
    this.createAdminUser();
  }
  
  private async createAdminUser() {
    try {
      const { hashPassword } = await import("./auth");
      const hashedPassword = await hashPassword("admin123");
      
      const adminUser: User = {
        id: "admin-user-1",
        email: "admin@financehub.com",
        mobile: "+919999999999",
        password: hashedPassword,
        firstName: "Admin",
        middleName: null,
        lastName: "User",
        profileImageUrl: null,
        isEmailVerified: true,
        isMobileVerified: true,
        panNumber: null,
        aadharNumber: null,
        dateOfBirth: null,
        address: null,
        city: null,
        state: null,
        pincode: null,
        occupation: "System Administrator",
        annualIncome: null,
        investmentExperience: null,
        riskTolerance: null,
        role: "super_admin",
        isActive: true,
        lastLoginAt: null,
        loginCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.users.set(adminUser.id, adminUser);
      this.usersByEmail.set(adminUser.email!, adminUser);
      this.usersByMobile.set(adminUser.mobile!, adminUser);
      console.log("✅ Admin user created successfully");
    } catch (error) {
      console.error("❌ Error creating admin user:", error);
    }
  }

  private cleanupExpiredOtp() {
    const now = new Date();
    const expiredKeys: string[] = [];
    
    this.otpVerifications.forEach((otp, key) => {
      if (otp.expiresAt < now) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => {
      this.otpVerifications.delete(key);
    });
  }

  async getPortfoliosByUserId(userId: string): Promise<Portfolio[]> {
    return Array.from(this.portfolios.values()).filter(portfolio => portfolio.userId === userId);
  }

  async getPortfoliosByUserPan(panNumber: string): Promise<Portfolio[]> {
    // First find the user by PAN number
    const user = await this.getUserByPan(panNumber);
    if (!user) {
      return [];
    }
    // Return portfolios for that user
    return this.getPortfoliosByUserId(user.id);
  }

  async getPortfolio(id: string): Promise<Portfolio | undefined> {
    return this.portfolios.get(id);
  }

  async createPortfolio(insertPortfolio: InsertPortfolio): Promise<Portfolio> {
    const id = randomUUID();
    const portfolio: Portfolio = {
      ...insertPortfolio,
      id,
      createdAt: new Date(),
      totalValue: insertPortfolio.totalValue ?? null,
      cash: insertPortfolio.cash ?? null,
      isDefault: insertPortfolio.isDefault ?? null
    };
    this.portfolios.set(id, portfolio);
    return portfolio;
  }

  async updatePortfolio(id: string, updates: Partial<Portfolio>): Promise<Portfolio | undefined> {
    const portfolio = this.portfolios.get(id);
    if (!portfolio) return undefined;
    
    const updated = { ...portfolio, ...updates };
    this.portfolios.set(id, updated);
    return updated;
  }

  async getPortfolioHoldings(portfolioId: string): Promise<PortfolioHolding[]> {
    return Array.from(this.portfolioHoldings.values()).filter(holding => holding.portfolioId === portfolioId);
  }

  async createPortfolioHolding(insertHolding: InsertPortfolioHolding): Promise<PortfolioHolding> {
    const id = randomUUID();
    const holding: PortfolioHolding = {
      ...insertHolding,
      id,
      updatedAt: new Date()
    };
    this.portfolioHoldings.set(id, holding);
    return holding;
  }

  async updatePortfolioHolding(id: string, updates: Partial<PortfolioHolding>): Promise<PortfolioHolding | undefined> {
    const holding = this.portfolioHoldings.get(id);
    if (!holding) return undefined;
    
    const updated = { ...holding, ...updates, updatedAt: new Date() };
    this.portfolioHoldings.set(id, updated);
    return updated;
  }

  async deletePortfolioHolding(id: string): Promise<boolean> {
    return this.portfolioHoldings.delete(id);
  }

  async getWatchlistsByUserId(userId: string): Promise<Watchlist[]> {
    return Array.from(this.watchlists.values()).filter(watchlist => watchlist.userId === userId);
  }

  async createWatchlist(insertWatchlist: InsertWatchlist): Promise<Watchlist> {
    const id = randomUUID();
    const watchlist: Watchlist = {
      ...insertWatchlist,
      id,
      createdAt: new Date(),
      symbols: insertWatchlist.symbols ?? null
    };
    this.watchlists.set(id, watchlist);
    return watchlist;
  }

  async getMarketData(symbol: string): Promise<MarketData | undefined> {
    return this.marketData.get(symbol);
  }

  async getMultipleMarketData(symbols: string[]): Promise<MarketData[]> {
    return symbols.map(symbol => this.marketData.get(symbol)).filter(Boolean) as MarketData[];
  }

  async upsertMarketData(symbol: string, data: Partial<MarketData>): Promise<MarketData> {
    const existing = this.marketData.get(symbol);
    const id = existing?.id || randomUUID();
    
    const marketData: MarketData = {
      id,
      symbol,
      price: null,
      change: null,
      changePercent: null,
      volume: null,
      marketCap: null,
      data: null,
      lastUpdated: new Date(),
      ...data
    };
    
    this.marketData.set(symbol, marketData);
    return marketData;
  }

  async getAssetAllocation(portfolioId: string): Promise<AssetAllocation[]> {
    return Array.from(this.assetAllocations.values()).filter(allocation => allocation.portfolioId === portfolioId);
  }

  async upsertAssetAllocation(insertAllocation: InsertAssetAllocation): Promise<AssetAllocation> {
    const existing = Array.from(this.assetAllocations.values()).find(
      allocation => allocation.portfolioId === insertAllocation.portfolioId && allocation.assetType === insertAllocation.assetType
    );
    
    const id = existing?.id || randomUUID();
    const allocation: AssetAllocation = {
      ...insertAllocation,
      id,
      updatedAt: new Date(),
      targetPercentage: insertAllocation.targetPercentage ?? null,
      currentPercentage: insertAllocation.currentPercentage ?? null,
      targetValue: insertAllocation.targetValue ?? null,
      currentValue: insertAllocation.currentValue ?? null,
      rebalanceAmount: insertAllocation.rebalanceAmount ?? null
    };
    
    this.assetAllocations.set(id, allocation);
    return allocation;
  }

  async getAllMutualFunds(): Promise<MutualFund[]> {
    return Array.from(this.mutualFunds.values());
  }

  async getMutualFund(schemeCode: string): Promise<MutualFund | undefined> {
    return this.mutualFunds.get(schemeCode);
  }

  async upsertMutualFund(insertFund: InsertMutualFund): Promise<MutualFund> {
    const existing = this.mutualFunds.get(insertFund.schemeCode);
    const id = existing?.id || randomUUID();
    
    const fund: MutualFund = {
      ...insertFund,
      id,
      lastUpdated: new Date(),
      category: insertFund.category ?? null,
      fundHouse: insertFund.fundHouse ?? null,
      nav: insertFund.nav ?? null,
      change: insertFund.change ?? null,
      changePercent: insertFund.changePercent ?? null,
      expenseRatio: insertFund.expenseRatio ?? null,
      aum: insertFund.aum ?? null,
      riskLevel: insertFund.riskLevel ?? null,
      returns1y: insertFund.returns1y ?? null,
      returns3y: insertFund.returns3y ?? null,
      returns5y: insertFund.returns5y ?? null
    };
    
    this.mutualFunds.set(insertFund.schemeCode, fund);
    return fund;
  }

  async searchMutualFunds(query: string): Promise<MutualFund[]> {
    const searchTerm = query.toLowerCase();
    return Array.from(this.mutualFunds.values()).filter(fund => 
      fund.schemeName.toLowerCase().includes(searchTerm) ||
      fund.fundHouse?.toLowerCase().includes(searchTerm) ||
      fund.category?.toLowerCase().includes(searchTerm)
    );
  }

  async getRebalancingSuggestions(portfolioId: string): Promise<any> {
    // Get portfolio holdings and calculate current allocation
    const holdings = await this.getPortfolioHoldings(portfolioId);
    const portfolio = await this.getPortfolio(portfolioId);
    
    if (!portfolio || holdings.length === 0) {
      return {
        suggestions: [],
        summary: {
          totalValue: 0,
          rebalanceNeeded: false
        }
      };
    }

    // Define target allocations (can be customized per user)
    const targetAllocations = {
      equity: 60,      // 60% equities
      commodity: 15,   // 15% commodities
      currency: 10,    // 10% currencies
      etf: 10,         // 10% ETFs
      debt: 5          // 5% debt instruments
    };

    // Calculate current allocations
    const totalInvested = holdings.reduce((sum, h) => sum + (parseFloat(h.quantity) * parseFloat(h.avgPrice)), 0);
    
    const currentAllocations = holdings.reduce((acc, holding) => {
      const value = parseFloat(holding.quantity) * parseFloat(holding.avgPrice);
      const assetType = holding.assetType;
      if (!acc[assetType]) acc[assetType] = 0;
      acc[assetType] += value;
      return acc;
    }, {} as Record<string, number>);

    // Convert to percentages
    const currentPercentages = Object.entries(currentAllocations).reduce((acc, [type, value]) => {
      acc[type] = (value / totalInvested) * 100;
      return acc;
    }, {} as Record<string, number>);

    // Generate rebalancing suggestions
    const suggestions = Object.entries(targetAllocations).map(([assetType, targetPercent]) => {
      const currentPercent = currentPercentages[assetType] || 0;
      const currentValue = currentAllocations[assetType] || 0;
      const targetValue = (targetPercent / 100) * totalInvested;
      const difference = targetValue - currentValue;
      const differencePercent = targetPercent - currentPercent;

      let action: string;
      let priority: 'high' | 'medium' | 'low';
      
      if (Math.abs(differencePercent) < 2) {
        action = 'maintain';
        priority = 'low';
      } else if (difference > 0) {
        action = 'buy';
        priority = Math.abs(differencePercent) > 10 ? 'high' : 'medium';
      } else {
        action = 'sell';
        priority = Math.abs(differencePercent) > 10 ? 'high' : 'medium';
      }

      return {
        assetType,
        assetName: assetType.charAt(0).toUpperCase() + assetType.slice(1).replace('_', ' '),
        currentPercent: Math.round(currentPercent * 100) / 100,
        targetPercent,
        currentValue: Math.round(currentValue),
        targetValue: Math.round(targetValue),
        difference: Math.round(difference),
        differencePercent: Math.round(differencePercent * 100) / 100,
        action,
        priority,
        recommendation: this.generateRecommendation(assetType, action, Math.abs(difference))
      };
    });

    // Sort by priority and difference amount
    suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return Math.abs(b.difference) - Math.abs(a.difference);
    });

    const totalRebalanceAmount = suggestions.reduce((sum, s) => sum + Math.abs(s.difference), 0);
    const rebalanceNeeded = suggestions.some(s => s.priority === 'high');

    return {
      suggestions: suggestions.filter(s => s.action !== 'maintain' || s.priority === 'high'),
      summary: {
        totalValue: Math.round(totalInvested),
        totalRebalanceAmount: Math.round(totalRebalanceAmount),
        rebalanceNeeded,
        highPrioritySuggestions: suggestions.filter(s => s.priority === 'high').length,
        lastUpdated: new Date()
      }
    };
  }

  private generateRecommendation(assetType: string, action: string, amount: number): string {
    const assetName = assetType.charAt(0).toUpperCase() + assetType.slice(1).replace('_', ' ');
    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);

    if (action === 'buy') {
      return `Consider adding ${formattedAmount} more in ${assetName} to reach your target allocation.`;
    } else if (action === 'sell') {
      return `Consider reducing ${formattedAmount} from ${assetName} to rebalance your portfolio.`;
    }
    return `Your ${assetName} allocation is on target.`;
  }

  // User Authentication Methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    for (const [key, user] of this.users.entries()) {
      if (user.email === email) {
        return user;
      }
    }
    return undefined;
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    for (const [key, user] of this.users.entries()) {
      if (user.mobile === mobile) {
        return user;
      }
    }
    return undefined;
  }

  async getUserByPan(panNumber: string): Promise<User | undefined> {
    for (const [key, user] of this.users.entries()) {
      if (user.panNumber === panNumber) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...userData,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, user);
    
    // Update email and mobile indices
    if (user.email) {
      this.usersByEmail.set(user.email, user);
    }
    if (user.mobile) {
      this.usersByMobile.set(user.mobile, user);
    }
    
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    
    // Update email/mobile indices if they were updated
    if (updates.email && updates.email !== user.email) {
      if (user.email) this.usersByEmail.delete(user.email);
      this.usersByEmail.set(updates.email, updatedUser);
    }
    
    if (updates.mobile && updates.mobile !== user.mobile) {
      if (user.mobile) this.usersByMobile.delete(user.mobile);
      this.usersByMobile.set(updates.mobile, updatedUser);
    }
    
    return updatedUser;
  }

  // OTP Verification Methods
  async createOtpVerification(otp: InsertOtpVerification): Promise<OtpVerification> {
    const id = randomUUID();
    const verification: OtpVerification = {
      ...otp,
      id,
      verified: false,
      createdAt: new Date()
    };
    this.otpVerifications.set(`${otp.identifier}_${otp.type}`, verification);
    return verification;
  }

  async getOtpVerification(identifier: string, type: string): Promise<OtpVerification | undefined> {
    return this.otpVerifications.get(`${identifier}_${type}`);
  }

  async verifyOtp(identifier: string, type: string, otp: string): Promise<boolean> {
    const verification = this.otpVerifications.get(`${identifier}_${type}`);
    if (!verification || verification.expiresAt < new Date()) {
      return false;
    }
    
    const isValid = verification.otp === otp;
    if (isValid) {
      this.otpVerifications.delete(`${identifier}_${type}`);
    }
    return isValid;
  }

  async cleanupExpiredOtps(): Promise<void> {
    this.cleanupExpiredOtp();
  }

  // User Profile Methods
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    return this.userProfiles.get(userId);
  }

  async upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const existing = this.userProfiles.get(profile.userId);
    const userProfile: UserProfile = {
      ...profile,
      id: existing?.id || randomUUID(),
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date()
    };
    this.userProfiles.set(profile.userId, userProfile);
    return userProfile;
  }

  // Admin methods implementation
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUserRole(userId: string, role: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.role = role;
      user.updatedAt = new Date();
      this.users.set(userId, user);
      // Update in lookup maps
      if (user.email) this.usersByEmail.set(user.email, user);
      if (user.mobile) this.usersByMobile.set(user.mobile, user);
    }
  }

  async updateUserStatus(userId: string, isActive: boolean): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.isActive = isActive;
      user.updatedAt = new Date();
      this.users.set(userId, user);
      // Update in lookup maps
      if (user.email) this.usersByEmail.set(user.email, user);
      if (user.mobile) this.usersByMobile.set(user.mobile, user);
    }
  }

  // Enhanced portfolio analytics with commodity focus
  async getPortfolioPerformance(portfolioId: string) {
    const mockPerformance = {
      portfolioId,
      totalCurrentValue: "1,347,850.00",
      totalInvestment: "1,200,000.00", 
      totalGainLoss: "147,850.00",
      totalGainLossPercentage: "12.32",
      dayChange: "-5,420.00",
      dayChangePercentage: "-0.40",
      assetBreakdown: [
        {
          assetType: "equity",
          name: "Equity",
          value: 808820,
          percentage: "60.0",
          change: 8850,
          changePercentage: "1.11",
          color: "#3B82F6"
        },
        {
          assetType: "debt", 
          name: "Debt/Bonds",
          value: 269570,
          percentage: "20.0", 
          change: 1420,
          changePercentage: "0.53",
          color: "#10B981"
        },
        {
          assetType: "commodity",
          name: "Commodities", 
          value: 134785,
          percentage: "10.0",
          change: 2320,
          changePercentage: "1.75",
          color: "#F59E0B"
        },
        {
          assetType: "alternative",
          name: "Alternative Investments",
          value: 134675,
          percentage: "10.0",
          change: -1170, 
          changePercentage: "-0.86",
          color: "#8B5CF6"
        }
      ],
      lastUpdated: new Date().toISOString()
    };
    
    return mockPerformance;
  }

  // Pi Chat Asset Class Summaries
  async getPiChatSummaries(portfolioId: string) {
    return [
      {
        id: "pi-chat-equity",
        portfolioId,
        assetClass: "equity",
        summary: "Your equity portfolio is performing well with strong technology and healthcare positions. Large-cap stocks are providing stability while mid-cap holdings offer growth potential. Consider rebalancing toward value stocks given current market conditions.",
        insights: {
          totalValue: 808820,
          allocation: "60%",
          topSectors: ["Technology", "Healthcare", "Finance"],
          riskLevel: "Moderate-High", 
          expectedReturn: "12-15%"
        },
        recommendations: [
          "Consider adding more defensive sectors like consumer staples",
          "Rebalance from growth to value stocks for better yield",
          "Take profits on technology positions above 25% allocation"
        ],
        lastAnalyzed: new Date().toISOString(),
        createdAt: new Date().toISOString()
      },
      {
        id: "pi-chat-commodity",
        portfolioId,
        assetClass: "commodity", 
        summary: "Your commodity exposure provides excellent inflation hedge. Gold holdings are performing well amid market uncertainty. Consider diversifying into agricultural commodities and energy futures for better portfolio balance.",
        insights: {
          totalValue: 134785,
          allocation: "10%",
          topCommodities: ["Gold", "Silver", "Crude Oil"],
          riskLevel: "High",
          expectedReturn: "8-12%"
        },
        recommendations: [
          "Add agricultural commodities for diversification",
          "Consider precious metals ETFs for easier management", 
          "Monitor energy sector correlation with oil prices"
        ],
        lastAnalyzed: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }
    ];
  }

  // Commodity prices
  async getCommodityPrices() {
    return [
      {
        id: "gold-spot",
        symbol: "XAUUSD", 
        name: "Gold",
        category: "precious_metals",
        price: 2034.50,
        priceUnit: "per_ounce",
        change: 12.30,
        changePercent: 0.61,
        lastUpdated: new Date().toISOString()
      },
      {
        id: "silver-spot", 
        symbol: "XAGUSD",
        name: "Silver",
        category: "precious_metals",
        price: 24.85,
        priceUnit: "per_ounce",
        change: 0.45,
        changePercent: 1.84,
        lastUpdated: new Date().toISOString()
      },
      {
        id: "crude-oil-wti",
        symbol: "WTIUSD", 
        name: "Crude Oil (WTI)",
        category: "energy", 
        price: 82.45,
        priceUnit: "per_barrel",
        change: -1.25,
        changePercent: -1.49,
        lastUpdated: new Date().toISOString()
      }
    ];
  }

  // Initialize risk assessment questions
  private initializeRiskAssessmentQuestions() {
    const questions = [
      {
        id: "risk-q1",
        category: "risk_tolerance",
        question: "How would you react if your investment lost 20% of its value in a month?",
        questionType: "multiple_choice",
        options: [
          { value: "sell_immediately", label: "Sell immediately to prevent further losses", score: 10 },
          { value: "worry_but_hold", label: "Be very concerned but hold on", score: 30 },
          { value: "monitor_closely", label: "Monitor closely but stay invested", score: 60 },
          { value: "buy_more", label: "See it as a buying opportunity", score: 90 }
        ],
        weightage: 3,
        isActive: true,
        createdAt: new Date()
      },
      {
        id: "risk-q2",
        category: "investment_goals",
        question: "What is your primary investment goal?",
        questionType: "multiple_choice",
        options: [
          { value: "capital_preservation", label: "Preserve capital with minimal risk", score: 20 },
          { value: "steady_income", label: "Generate steady income", score: 40 },
          { value: "balanced_growth", label: "Balanced growth and income", score: 60 },
          { value: "aggressive_growth", label: "Aggressive growth", score: 90 }
        ],
        weightage: 3,
        isActive: true,
        createdAt: new Date()
      },
      {
        id: "risk-q3",
        category: "financial_situation",
        question: "What is your investment time horizon?",
        questionType: "multiple_choice",
        options: [
          { value: "less_1_year", label: "Less than 1 year", score: 20 },
          { value: "1_3_years", label: "1-3 years", score: 40 },
          { value: "3_7_years", label: "3-7 years", score: 60 },
          { value: "more_7_years", label: "More than 7 years", score: 90 }
        ],
        weightage: 2,
        isActive: true,
        createdAt: new Date()
      },
      {
        id: "risk-q4",
        category: "risk_tolerance",
        question: "How much investment experience do you have?",
        questionType: "multiple_choice",
        options: [
          { value: "none", label: "No investment experience", score: 20 },
          { value: "limited", label: "Limited experience (1-2 years)", score: 40 },
          { value: "moderate", label: "Moderate experience (3-5 years)", score: 60 },
          { value: "extensive", label: "Extensive experience (5+ years)", score: 80 }
        ],
        weightage: 2,
        isActive: true,
        createdAt: new Date()
      },
      {
        id: "risk-q5",
        category: "financial_situation",
        question: "What percentage of your total savings are you planning to invest?",
        questionType: "multiple_choice",
        options: [
          { value: "less_10", label: "Less than 10%", score: 30 },
          { value: "10_25", label: "10-25%", score: 50 },
          { value: "25_50", label: "25-50%", score: 70 },
          { value: "more_50", label: "More than 50%", score: 90 }
        ],
        weightage: 2,
        isActive: true,
        createdAt: new Date()
      }
    ];

    questions.forEach(q => this.riskAssessmentQuestions.set(q.id, q));
    
    // Create sample risk profile
    const sampleRiskProfile = {
      id: "risk-profile-1",
      userId: "demo-user-1",
      riskTolerance: "moderate",
      investmentHorizon: "long",
      investmentExperience: "intermediate", 
      incomeStability: "stable",
      liquidityNeeds: "medium",
      age: 35,
      dependents: 2,
      monthlyIncome: "85000.00",
      monthlyExpenses: "55000.00",
      existingAssets: "1200000.00",
      existingLiabilities: "450000.00",
      questionnaire: {
        "risk-q1": "monitor_closely",
        "risk-q2": "balanced_growth",
        "risk-q3": "3_7_years",
        "risk-q4": "moderate",
        "risk-q5": "25_50"
      },
      riskScore: 65,
      assessedBy: "admin-user",
      assessmentDate: new Date(),
      reviewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.riskProfiles.set(sampleRiskProfile.id, sampleRiskProfile);
    this.riskProfilesByUserId.set(sampleRiskProfile.userId, sampleRiskProfile);
  }

  private initializeSampleReports() {
    // Sample Capital Gains Report
    const sampleCapitalGainsReport: CapitalGainsReport = {
      id: "capital-gains-1",
      userId: "demo-user-1",
      financialYear: "2023-24",
      reportType: "capital_gains",
      source: "mf_central",
      totalShortTermGains: "15000.00",
      totalLongTermGains: "45000.00", 
      totalDividend: "8500.00",
      totalTdsDeducted: "1500.00",
      reportData: {
        summary: {
          totalGains: 60000,
          taxableShortTerm: 15000,
          exemptLongTerm: 45000,
        },
        holdings: [
          {
            fundName: "HDFC Equity Fund",
            investedAmount: 100000,
            currentValue: 135000,
            gains: 35000,
            gainsType: "long_term"
          },
          {
            fundName: "ICICI Bluechip Fund", 
            investedAmount: 50000,
            currentValue: 75000,
            gains: 25000,
            gainsType: "short_term"
          }
        ]
      },
      generatedAt: new Date(),
      fetchedAt: new Date(),
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Sample Transaction Report  
    const sampleTransactionReport: TransactionReport = {
      id: "transaction-report-1",
      userId: "demo-user-1",
      financialYear: "2023-24",
      source: "cams",
      assetType: "mutual_fund",
      totalPurchases: "200000.00",
      totalRedemptions: "50000.00",
      totalSwitches: "25000.00",
      totalDividendReceived: "8500.00",
      totalBrokerage: "150.00",
      totalTaxes: "1500.00",
      transactionCount: 24,
      reportData: {
        summary: {
          totalTransactions: 24,
          netInvestment: 150000,
          currentPortfolioValue: 185000
        }
      },
      generatedAt: new Date(),
      fetchedAt: new Date(),
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Sample Transaction Records
    const sampleTransactionRecord: TransactionRecord = {
      id: "transaction-record-1",
      reportId: "transaction-report-1",
      userId: "demo-user-1",
      transactionDate: "2024-01-15",
      transactionType: "purchase",
      fundName: "HDFC Equity Fund - Direct Growth",
      fundCode: "120503",
      folio: "12345678",
      units: "156.7890",
      nav: "850.25",
      amount: "100000.00",
      brokerage: "0.00",
      stt: "100.00",
      stampDuty: "50.00", 
      gst: "0.00",
      tds: "0.00",
      netAmount: "99850.00",
      registrar: "CAMS",
      createdAt: new Date(),
    };

    this.capitalGainsReports.set(sampleCapitalGainsReport.id, sampleCapitalGainsReport);
    this.transactionReports.set(sampleTransactionReport.id, sampleTransactionReport);
    this.transactionRecords.set(sampleTransactionRecord.id, sampleTransactionRecord);
  }

  // Risk profiling methods implementation
  async createRiskProfile(profile: any) {
    const id = `risk-profile-${Date.now()}`;
    const newProfile = {
      ...profile,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.riskProfiles.set(id, newProfile);
    this.riskProfilesByUserId.set(profile.userId, newProfile);
    return newProfile;
  }

  async updateRiskProfile(id: string, profile: any) {
    const existing = this.riskProfiles.get(id);
    if (existing) {
      const updated = {
        ...existing,
        ...profile,
        updatedAt: new Date()
      };
      this.riskProfiles.set(id, updated);
      this.riskProfilesByUserId.set(existing.userId, updated);
      return updated;
    }
    return undefined;
  }

  async getRiskProfile(userId: string) {
    return this.riskProfilesByUserId.get(userId);
  }

  async getAllRiskProfiles() {
    return Array.from(this.riskProfiles.values());
  }

  async deleteRiskProfile(id: string) {
    const profile = this.riskProfiles.get(id);
    if (profile) {
      this.riskProfiles.delete(id);
      this.riskProfilesByUserId.delete(profile.userId);
    }
  }

  // Risk assessment questions methods
  async createRiskAssessmentQuestion(question: any) {
    const id = `risk-question-${Date.now()}`;
    const newQuestion = {
      ...question,
      id,
      createdAt: new Date()
    };
    
    this.riskAssessmentQuestions.set(id, newQuestion);
    return newQuestion;
  }

  async updateRiskAssessmentQuestion(id: string, question: any) {
    const existing = this.riskAssessmentQuestions.get(id);
    if (existing) {
      const updated = {
        ...existing,
        ...question
      };
      this.riskAssessmentQuestions.set(id, updated);
      return updated;
    }
    return undefined;
  }

  async getRiskAssessmentQuestions() {
    return Array.from(this.riskAssessmentQuestions.values()).filter(q => q.isActive);
  }

  async deleteRiskAssessmentQuestion(id: string) {
    this.riskAssessmentQuestions.delete(id);
  }

  // Capital Gains Reports methods
  async createCapitalGainsReport(report: InsertCapitalGainsReport): Promise<CapitalGainsReport> {
    const id = `capital-gains-${Date.now()}`;
    const newReport: CapitalGainsReport = {
      ...report,
      id,
      generatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.capitalGainsReports.set(id, newReport);
    return newReport;
  }

  async getCapitalGainsReports(userId?: string, financialYear?: string): Promise<CapitalGainsReport[]> {
    let reports = Array.from(this.capitalGainsReports.values());
    
    if (userId) {
      reports = reports.filter(r => r.userId === userId);
    }
    
    if (financialYear) {
      reports = reports.filter(r => r.financialYear === financialYear);
    }
    
    return reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getCapitalGainsReport(id: string): Promise<CapitalGainsReport | undefined> {
    return this.capitalGainsReports.get(id);
  }

  async updateCapitalGainsReport(id: string, updates: Partial<CapitalGainsReport>): Promise<CapitalGainsReport | undefined> {
    const existing = this.capitalGainsReports.get(id);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };
      this.capitalGainsReports.set(id, updated);
      return updated;
    }
    return undefined;
  }

  // Transaction Reports methods
  async createTransactionReport(report: InsertTransactionReport): Promise<TransactionReport> {
    const id = `transaction-report-${Date.now()}`;
    const newReport: TransactionReport = {
      ...report,
      id,
      generatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.transactionReports.set(id, newReport);
    return newReport;
  }

  async getTransactionReports(userId?: string, financialYear?: string): Promise<TransactionReport[]> {
    let reports = Array.from(this.transactionReports.values());
    
    if (userId) {
      reports = reports.filter(r => r.userId === userId);
    }
    
    if (financialYear) {
      reports = reports.filter(r => r.financialYear === financialYear);
    }
    
    return reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getTransactionReport(id: string): Promise<TransactionReport | undefined> {
    return this.transactionReports.get(id);
  }

  async updateTransactionReport(id: string, updates: Partial<TransactionReport>): Promise<TransactionReport | undefined> {
    const existing = this.transactionReports.get(id);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };
      this.transactionReports.set(id, updated);
      return updated;
    }
    return undefined;
  }

  // Transaction Records methods
  async createTransactionRecord(record: InsertTransactionRecord): Promise<TransactionRecord> {
    const id = `transaction-record-${Date.now()}`;
    const newRecord: TransactionRecord = {
      ...record,
      id,
      createdAt: new Date(),
    };
    
    this.transactionRecords.set(id, newRecord);
    return newRecord;
  }

  async getTransactionRecords(reportId: string): Promise<TransactionRecord[]> {
    return Array.from(this.transactionRecords.values())
      .filter(r => r.reportId === reportId)
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }

  async getTransactionRecordsByUser(userId: string, financialYear?: string): Promise<TransactionRecord[]> {
    let records = Array.from(this.transactionRecords.values()).filter(r => r.userId === userId);
    
    if (financialYear) {
      const startYear = parseInt(financialYear.split('-')[0]);
      const endYear = startYear + 1;
      
      records = records.filter(r => {
        const year = new Date(r.transactionDate).getFullYear();
        return year >= startYear && year < endYear;
      });
    }
    
    return records.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }

  // Additional User Management methods

  async deleteUser(id: string): Promise<boolean> {
    const user = this.users.get(id);
    if (user) {
      this.users.delete(id);
      if (user.email) this.usersByEmail.delete(user.email);
      if (user.mobile) this.usersByMobile.delete(user.mobile);
      return true;
    }
    return false;
  }

  async updateUserActiveStatus(id: string, isActive: boolean): Promise<User | undefined> {
    return this.updateUser(id, { isActive });
  }

  // Customer Care Agent methods
  async createCustomerCareAgent(agent: InsertCustomerCareAgent): Promise<CustomerCareAgent> {
    const id = randomUUID();
    const newAgent: CustomerCareAgent = {
      ...agent,
      id,
      status: agent.status || 'active',
      maxTicketsPerDay: agent.maxTicketsPerDay || 50,
      currentTicketCount: agent.currentTicketCount || 0,
      totalTicketsHandled: agent.totalTicketsHandled || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.customerCareAgents.set(id, newAgent);
    return newAgent;
  }

  async getAllCustomerCareAgents(): Promise<CustomerCareAgent[]> {
    return Array.from(this.customerCareAgents.values())
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async getCustomerCareAgent(id: string): Promise<CustomerCareAgent | undefined> {
    return this.customerCareAgents.get(id);
  }

  async updateCustomerCareAgent(id: string, updates: Partial<CustomerCareAgent>): Promise<CustomerCareAgent | undefined> {
    const existing = this.customerCareAgents.get(id);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };
      this.customerCareAgents.set(id, updated);
      return updated;
    }
    return undefined;
  }

  async deleteCustomerCareAgent(id: string): Promise<boolean> {
    return this.customerCareAgents.delete(id);
  }

  // Agent-Partner mapping methods
  async createAgentPartnerMapping(mapping: InsertAgentPartnerMapping): Promise<AgentPartnerMapping> {
    const id = randomUUID();
    const newMapping: AgentPartnerMapping = {
      ...mapping,
      id,
      isActive: mapping.isActive ?? true,
      priority: mapping.priority || 1,
      assignedAt: mapping.assignedAt || new Date(),
      createdAt: new Date(),
    };
    
    this.agentPartnerMappings.set(id, newMapping);
    return newMapping;
  }

  async getAgentPartnerMappings(agentId?: string, partnerId?: string): Promise<AgentPartnerMapping[]> {
    let mappings = Array.from(this.agentPartnerMappings.values());
    
    if (agentId) {
      mappings = mappings.filter(m => m.agentId === agentId);
    }
    
    if (partnerId) {
      mappings = mappings.filter(m => m.partnerId === partnerId);
    }
    
    return mappings.sort((a, b) => a.priority - b.priority);
  }

  async updateAgentPartnerMapping(id: string, updates: Partial<AgentPartnerMapping>): Promise<AgentPartnerMapping | undefined> {
    const existing = this.agentPartnerMappings.get(id);
    if (existing) {
      const updated = {
        ...existing,
        ...updates,
      };
      this.agentPartnerMappings.set(id, updated);
      return updated;
    }
    return undefined;
  }

  async deleteAgentPartnerMapping(id: string): Promise<boolean> {
    return this.agentPartnerMappings.delete(id);
  }

  // CKYC (Central KYC Registry) methods
  async getCkycRecord(userId: string): Promise<CkycRecord | undefined> {
    return this.ckycRecords.get(userId);
  }

  async createCkycRecord(ckycRecord: InsertCkycRecord): Promise<CkycRecord> {
    const newRecord: CkycRecord = {
      ...ckycRecord,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.ckycRecords.set(ckycRecord.userId, newRecord);
    return newRecord;
  }

  async updateCkycRecord(userId: string, updates: Partial<CkycRecord>): Promise<CkycRecord | undefined> {
    const existing = this.ckycRecords.get(userId);
    if (existing) {
      const updated: CkycRecord = {
        ...existing,
        ...updates,
        updatedAt: new Date()
      };
      this.ckycRecords.set(userId, updated);
      return updated;
    }
    return undefined;
  }

  async getAllCkycRecords(options?: { status?: string; page?: number; limit?: number }): Promise<CkycRecord[]> {
    let records = Array.from(this.ckycRecords.values());
    
    if (options?.status) {
      records = records.filter(record => record.verificationStatus === options.status);
    }
    
    // Simple pagination
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const start = (page - 1) * limit;
    const end = start + limit;
    
    return records
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(start, end);
  }

  // CKYC Document methods
  async getCkycDocuments(userId: string): Promise<CkycDocument[]> {
    return this.ckycDocuments.get(userId) || [];
  }

  async addCkycDocument(document: InsertCkycDocument): Promise<CkycDocument> {
    const newDocument: CkycDocument = {
      ...document,
      id: randomUUID(),
      uploadedAt: new Date()
    };
    
    const existingDocuments = this.ckycDocuments.get(document.userId) || [];
    existingDocuments.push(newDocument);
    this.ckycDocuments.set(document.userId, existingDocuments);
    
    return newDocument;
  }

  // CKYC Status History methods
  async getCkycStatusHistory(userId: string): Promise<CkycStatusHistory[]> {
    return this.ckycStatusHistory.get(userId) || [];
  }

  async addCkycStatusHistory(history: InsertCkycStatusHistory): Promise<CkycStatusHistory> {
    const newHistory: CkycStatusHistory = {
      ...history,
      id: randomUUID(),
      changedAt: new Date()
    };
    
    const existingHistory = this.ckycStatusHistory.get(history.userId) || [];
    existingHistory.push(newHistory);
    this.ckycStatusHistory.set(history.userId, existingHistory);
    
    return newHistory;
  }

  // CKYC Progress Monitoring methods
  async createCkycNotificationTrigger(trigger: InsertCkycNotificationTrigger): Promise<CkycNotificationTrigger> {
    const newTrigger: CkycNotificationTrigger = {
      ...trigger,
      id: randomUUID(),
      status: "pending",
      createdAt: new Date()
    };
    
    this.ckycNotificationTriggers.set(newTrigger.id, newTrigger);
    return newTrigger;
  }

  async getCkycNotificationTriggers(ckycRecordId?: string, status?: string): Promise<CkycNotificationTrigger[]> {
    let triggers = Array.from(this.ckycNotificationTriggers.values());
    
    if (ckycRecordId) {
      triggers = triggers.filter(t => t.ckycRecordId === ckycRecordId);
    }
    
    if (status) {
      triggers = triggers.filter(t => t.status === status);
    }
    
    return triggers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateCkycNotificationStatus(id: string, status: string, sentAt?: Date, failureReason?: string): Promise<CkycNotificationTrigger | undefined> {
    const existing = this.ckycNotificationTriggers.get(id);
    if (existing) {
      const updated = {
        ...existing,
        status,
        sentAt: sentAt || undefined,
        failureReason: failureReason || undefined
      };
      this.ckycNotificationTriggers.set(id, updated);
      return updated;
    }
    return undefined;
  }

  // CKYC Progress Steps methods
  async createCkycProgressStep(step: InsertCkycProgressStep): Promise<CkycProgressStep> {
    const newStep: CkycProgressStep = {
      ...step,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const existingSteps = this.ckycProgressSteps.get(step.ckycRecordId) || [];
    existingSteps.push(newStep);
    this.ckycProgressSteps.set(step.ckycRecordId, existingSteps);
    
    return newStep;
  }

  async getCkycProgressSteps(ckycRecordId: string): Promise<CkycProgressStep[]> {
    return (this.ckycProgressSteps.get(ckycRecordId) || [])
      .sort((a, b) => a.stepOrder - b.stepOrder);
  }

  async updateCkycProgressStep(id: string, updates: Partial<CkycProgressStep>): Promise<CkycProgressStep | undefined> {
    // Find and update step across all CKYC records
    for (const [ckycRecordId, steps] of this.ckycProgressSteps.entries()) {
      const stepIndex = steps.findIndex(step => step.id === id);
      if (stepIndex !== -1) {
        const updated = {
          ...steps[stepIndex],
          ...updates,
          updatedAt: new Date()
        };
        steps[stepIndex] = updated;
        this.ckycProgressSteps.set(ckycRecordId, steps);
        return updated;
      }
    }
    return undefined;
  }

  // CKYC Action Log methods
  async createCkycActionLog(log: InsertCkycActionLog): Promise<CkycActionLog> {
    const newLog: CkycActionLog = {
      ...log,
      id: randomUUID(),
      actionAt: new Date()
    };
    
    const existingLogs = this.ckycActionLogs.get(log.ckycRecordId) || [];
    existingLogs.push(newLog);
    this.ckycActionLogs.set(log.ckycRecordId, existingLogs);
    
    return newLog;
  }

  async getCkycActionLogs(ckycRecordId?: string, actionBy?: string): Promise<CkycActionLog[]> {
    let allLogs: CkycActionLog[] = [];
    
    if (ckycRecordId) {
      allLogs = this.ckycActionLogs.get(ckycRecordId) || [];
    } else {
      // Get all logs from all CKYC records
      for (const logs of this.ckycActionLogs.values()) {
        allLogs.push(...logs);
      }
    }
    
    if (actionBy) {
      allLogs = allLogs.filter(log => log.actionBy === actionBy);
    }
    
    return allLogs.sort((a, b) => b.actionAt.getTime() - a.actionAt.getTime());
  }

  // CKYC Notification Service methods
  async sendNotification(trigger: CkycNotificationTrigger): Promise<boolean> {
    try {
      // Simulate notification sending (in real implementation, integrate with SMS/Email providers)
      console.log(`📧 Sending ${trigger.notificationMethod} notification:`, {
        to: trigger.recipientEmail || trigger.recipientMobile,
        subject: trigger.subject,
        message: trigger.message
      });
      
      // Mark as sent
      await this.updateCkycNotificationStatus(trigger.id, "sent", new Date());
      return true;
    } catch (error) {
      console.error("❌ Failed to send notification:", error);
      await this.updateCkycNotificationStatus(trigger.id, "failed", undefined, error.message);
      return false;
    }
  }

  async processPendingNotifications(): Promise<void> {
    const pendingTriggers = await this.getCkycNotificationTriggers(undefined, "pending");
    
    for (const trigger of pendingTriggers) {
      // Check if scheduled time has arrived
      if (trigger.scheduledAt && new Date() < trigger.scheduledAt) {
        continue; // Not yet time to send
      }
      
      await this.sendNotification(trigger);
    }
  }

  // Client-Agent relationship methods for EUIN/ARN integration
  async getClientAgentRelationships(clientId?: string, agentId?: string): Promise<ClientAgentRelationship[]> {
    let relationships = Array.from(this.clientAgentRelationships.values());
    
    if (clientId) {
      relationships = relationships.filter(rel => rel.clientId === clientId);
    }
    
    if (agentId) {
      relationships = relationships.filter(rel => rel.agentId === agentId);
    }
    
    return relationships;
  }

  async getClientAgentRelationship(clientId: string, agentId: string): Promise<ClientAgentRelationship | undefined> {
    return Array.from(this.clientAgentRelationships.values())
      .find(rel => rel.clientId === clientId && rel.agentId === agentId && rel.isActive);
  }

  async createClientAgentRelationship(insertRelationship: InsertClientAgentRelationship): Promise<ClientAgentRelationship> {
    const id = randomUUID();
    const now = new Date();
    const relationship: ClientAgentRelationship = {
      ...insertRelationship,
      id,
      createdAt: now,
      updatedAt: now,
      assignedAt: insertRelationship.assignedAt || now,
      relationshipType: insertRelationship.relationshipType || "primary",
      isActive: insertRelationship.isActive !== false,
      autoPopulateEuin: insertRelationship.autoPopulateEuin !== false,
      autoPopulateArn: insertRelationship.autoPopulateArn !== false
    };
    
    this.clientAgentRelationships.set(id, relationship);
    return relationship;
  }

  async updateClientAgentRelationship(id: string, updates: Partial<ClientAgentRelationship>): Promise<ClientAgentRelationship | undefined> {
    const relationship = this.clientAgentRelationships.get(id);
    if (!relationship) return undefined;
    
    const updated = { 
      ...relationship, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.clientAgentRelationships.set(id, updated);
    return updated;
  }

  async deleteClientAgentRelationship(id: string): Promise<boolean> {
    return this.clientAgentRelationships.delete(id);
  }

  async getAgentForClient(clientId: string, relationshipType?: string): Promise<ClientAgentRelationship | undefined> {
    const relationships = Array.from(this.clientAgentRelationships.values())
      .filter(rel => rel.clientId === clientId && rel.isActive);
    
    if (relationshipType) {
      return relationships.find(rel => rel.relationshipType === relationshipType);
    }
    
    // Return primary relationship first, then any active relationship
    return relationships.find(rel => rel.relationshipType === "primary") || relationships[0];
  }

  async getClientsForAgent(agentId: string): Promise<ClientAgentRelationship[]> {
    return Array.from(this.clientAgentRelationships.values())
      .filter(rel => rel.agentId === agentId && rel.isActive);
  }

  // Investment proposal methods
  async getInvestmentProposals(options?: { clientId?: string; agentId?: string; status?: string }): Promise<InvestmentProposal[]> {
    let proposals = Array.from(this.investmentProposals.values());
    
    if (options?.clientId) {
      proposals = proposals.filter(p => p.clientId === options.clientId);
    }
    if (options?.agentId) {
      proposals = proposals.filter(p => p.agentId === options.agentId);
    }
    if (options?.status) {
      proposals = proposals.filter(p => p.status === options.status);
    }
    
    return proposals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getInvestmentProposal(id: string): Promise<InvestmentProposal | undefined> {
    return this.investmentProposals.get(id);
  }

  async createInvestmentProposal(proposal: InsertInvestmentProposal): Promise<InvestmentProposal> {
    const id = randomUUID();
    const newProposal: InvestmentProposal = {
      id,
      ...proposal,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.investmentProposals.set(id, newProposal);
    return newProposal;
  }

  async updateInvestmentProposal(id: string, updates: Partial<InvestmentProposal>): Promise<InvestmentProposal | undefined> {
    const proposal = this.investmentProposals.get(id);
    if (!proposal) return undefined;
    
    const updated = { 
      ...proposal, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.investmentProposals.set(id, updated);
    return updated;
  }

  async deleteInvestmentProposal(id: string): Promise<boolean> {
    // Also delete related proposal items
    this.investmentProposalItems.delete(id);
    return this.investmentProposals.delete(id);
  }

  // Investment proposal items methods
  async getProposalItems(proposalId: string): Promise<InvestmentProposalItem[]> {
    return this.investmentProposalItems.get(proposalId) || [];
  }

  async createProposalItem(item: InsertInvestmentProposalItem): Promise<InvestmentProposalItem> {
    const id = randomUUID();
    const newItem: InvestmentProposalItem = {
      id,
      ...item,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const items = this.investmentProposalItems.get(item.proposalId) || [];
    items.push(newItem);
    this.investmentProposalItems.set(item.proposalId, items);
    return newItem;
  }

  async updateProposalItem(id: string, updates: Partial<InvestmentProposalItem>): Promise<InvestmentProposalItem | undefined> {
    for (const [proposalId, items] of this.investmentProposalItems.entries()) {
      const itemIndex = items.findIndex(item => item.id === id);
      if (itemIndex >= 0) {
        const updated = { 
          ...items[itemIndex], 
          ...updates, 
          updatedAt: new Date() 
        };
        items[itemIndex] = updated;
        this.investmentProposalItems.set(proposalId, items);
        return updated;
      }
    }
    return undefined;
  }

  async deleteProposalItem(id: string): Promise<boolean> {
    for (const [proposalId, items] of this.investmentProposalItems.entries()) {
      const itemIndex = items.findIndex(item => item.id === id);
      if (itemIndex >= 0) {
        items.splice(itemIndex, 1);
        this.investmentProposalItems.set(proposalId, items);
        return true;
      }
    }
    return false;
  }

  // Proposal approval and client actions
  async approveProposal(proposalId: string, clientResponse?: string): Promise<InvestmentProposal | undefined> {
    const proposal = this.investmentProposals.get(proposalId);
    if (!proposal) return undefined;
    
    const updated = {
      ...proposal,
      status: "approved" as const,
      clientResponse: clientResponse || "Approved by client",
      approvedAt: new Date(),
      updatedAt: new Date()
    };
    this.investmentProposals.set(proposalId, updated);
    return updated;
  }

  async rejectProposal(proposalId: string, clientResponse: string): Promise<InvestmentProposal | undefined> {
    const proposal = this.investmentProposals.get(proposalId);
    if (!proposal) return undefined;
    
    const updated = {
      ...proposal,
      status: "rejected" as const,
      clientResponse,
      rejectedAt: new Date(),
      updatedAt: new Date()
    };
    this.investmentProposals.set(proposalId, updated);
    return updated;
  }

  // Payment integration methods
  async createProposalPayment(payment: InsertProposalPayment): Promise<ProposalPayment> {
    const id = randomUUID();
    const newPayment: ProposalPayment = {
      id,
      ...payment,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.proposalPayments.set(id, newPayment);
    return newPayment;
  }

  async getProposalPayments(proposalId?: string, status?: string): Promise<ProposalPayment[]> {
    let payments = Array.from(this.proposalPayments.values());
    
    if (proposalId) {
      payments = payments.filter(p => p.proposalId === proposalId);
    }
    if (status) {
      payments = payments.filter(p => p.status === status);
    }
    
    return payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateProposalPayment(id: string, updates: Partial<ProposalPayment>): Promise<ProposalPayment | undefined> {
    const payment = this.proposalPayments.get(id);
    if (!payment) return undefined;
    
    const updated = { 
      ...payment, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.proposalPayments.set(id, updated);
    return updated;
  }

  // Agent-specific report methods
  async getAgentTransactionReports(agentId: string, filters?: { clientId?: string; status?: string; reportType?: string }): Promise<TransactionReport[]> {
    let reports = Array.from(this.transactionReports.values()).filter(r => r.agentId === agentId);
    
    if (filters?.clientId) {
      reports = reports.filter(r => r.clientId === filters.clientId);
    }
    if (filters?.status) {
      reports = reports.filter(r => r.status === filters.status);
    }
    if (filters?.reportType) {
      reports = reports.filter(r => r.reportType === filters.reportType);
    }
    
    return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAgentCapitalGainsReports(agentId: string, filters?: { clientId?: string; financialYear?: string; status?: string }): Promise<CapitalGainsReport[]> {
    let reports = Array.from(this.capitalGainsReports.values()).filter(r => r.agentId === agentId);
    
    if (filters?.clientId) {
      reports = reports.filter(r => r.clientId === filters.clientId);
    }
    if (filters?.financialYear) {
      reports = reports.filter(r => r.financialYear === filters.financialYear);
    }
    if (filters?.status) {
      reports = reports.filter(r => r.status === filters.status);
    }
    
    return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Report sharing methods - simple in-memory implementation
  private reportSharings: Map<string, any> = new Map();

  async createReportSharing(sharing: any): Promise<any> {
    const id = `sharing-${Date.now()}`;
    const newSharing = {
      ...sharing,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.reportSharings.set(id, newSharing);
    return newSharing;
  }

  async getAgentSharedReports(agentId: string, filters?: { reportType?: string; status?: string }): Promise<any[]> {
    let sharings = Array.from(this.reportSharings.values()).filter(s => s.sharedBy === agentId);
    
    if (filters?.reportType) {
      sharings = sharings.filter(s => s.reportType === filters.reportType);
    }
    if (filters?.status) {
      sharings = sharings.filter(s => s.status === filters.status);
    }
    
    return sharings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Interactive Brokers storage methods
  async getIBAccounts(userId: string): Promise<IBAccount[]> {
    return Array.from(this.ibAccounts.values()).filter(acc => acc.userId === userId);
  }

  async getIBAccount(id: string): Promise<IBAccount | undefined> {
    return this.ibAccounts.get(id);
  }

  async createIBAccount(account: InsertIBAccount): Promise<IBAccount> {
    const id = `ib-account-${Date.now()}`;
    const newAccount: IBAccount = {
      ...account,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.ibAccounts.set(id, newAccount);
    return newAccount;
  }

  async updateIBAccount(id: string, updates: Partial<IBAccount>): Promise<IBAccount | undefined> {
    const account = this.ibAccounts.get(id);
    if (!account) return undefined;
    
    const updated = { ...account, ...updates, updatedAt: new Date() };
    this.ibAccounts.set(id, updated);
    return updated;
  }

  async deleteIBAccount(id: string): Promise<boolean> {
    return this.ibAccounts.delete(id);
  }

  async updateIBAccountConnectionStatus(id: string, status: string, lastConnected?: Date): Promise<IBAccount | undefined> {
    return this.updateIBAccount(id, { status, lastConnected });
  }

  async getIBOrders(userId: string, ibAccountId?: string): Promise<IBOrder[]> {
    let orders = Array.from(this.ibOrders.values()).filter(order => order.userId === userId);
    if (ibAccountId) {
      orders = orders.filter(order => order.ibAccountId === ibAccountId);
    }
    return orders;
  }

  async getIBOrder(id: string): Promise<IBOrder | undefined> {
    return this.ibOrders.get(id);
  }

  async createIBOrder(order: InsertIBOrder): Promise<IBOrder> {
    const id = `ib-order-${Date.now()}`;
    const newOrder: IBOrder = {
      ...order,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.ibOrders.set(id, newOrder);
    return newOrder;
  }

  async updateIBOrder(id: string, updates: Partial<IBOrder>): Promise<IBOrder | undefined> {
    const order = this.ibOrders.get(id);
    if (!order) return undefined;
    
    const updated = { ...order, ...updates, updatedAt: new Date() };
    this.ibOrders.set(id, updated);
    return updated;
  }

  async deleteIBOrder(id: string): Promise<boolean> {
    return this.ibOrders.delete(id);
  }

  async getIBOrderByOrderId(orderId: number, ibAccountId: string): Promise<IBOrder | undefined> {
    return Array.from(this.ibOrders.values()).find(order => 
      order.orderId === orderId && order.ibAccountId === ibAccountId
    );
  }

  async getIBPositions(userId: string, ibAccountId?: string): Promise<IBPosition[]> {
    let positions = Array.from(this.ibPositions.values()).filter(pos => pos.userId === userId);
    if (ibAccountId) {
      positions = positions.filter(pos => pos.ibAccountId === ibAccountId);
    }
    return positions;
  }

  async getIBPosition(id: string): Promise<IBPosition | undefined> {
    return this.ibPositions.get(id);
  }

  async createIBPosition(position: InsertIBPosition): Promise<IBPosition> {
    const id = `ib-position-${Date.now()}`;
    const newPosition: IBPosition = {
      ...position,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.ibPositions.set(id, newPosition);
    return newPosition;
  }

  async updateIBPosition(id: string, updates: Partial<IBPosition>): Promise<IBPosition | undefined> {
    const position = this.ibPositions.get(id);
    if (!position) return undefined;
    
    const updated = { ...position, ...updates, updatedAt: new Date() };
    this.ibPositions.set(id, updated);
    return updated;
  }

  async deleteIBPosition(id: string): Promise<boolean> {
    return this.ibPositions.delete(id);
  }

  async upsertIBPosition(position: InsertIBPosition): Promise<IBPosition> {
    const existing = Array.from(this.ibPositions.values()).find(pos => 
      pos.symbol === position.symbol && pos.ibAccountId === position.ibAccountId
    );
    
    if (existing) {
      return this.updateIBPosition(existing.id, position) as Promise<IBPosition>;
    } else {
      return this.createIBPosition(position);
    }
  }

  async getIBAccountSummary(userId: string, ibAccountId?: string): Promise<IBAccountSummary[]> {
    let summaries = Array.from(this.ibAccountSummaries.values()).filter(sum => sum.userId === userId);
    if (ibAccountId) {
      summaries = summaries.filter(sum => sum.ibAccountId === ibAccountId);
    }
    return summaries;
  }

  async createIBAccountSummary(summary: InsertIBAccountSummary): Promise<IBAccountSummary> {
    const id = `ib-summary-${Date.now()}`;
    const newSummary: IBAccountSummary = {
      ...summary,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.ibAccountSummaries.set(id, newSummary);
    return newSummary;
  }

  async updateIBAccountSummary(id: string, updates: Partial<IBAccountSummary>): Promise<IBAccountSummary | undefined> {
    const summary = this.ibAccountSummaries.get(id);
    if (!summary) return undefined;
    
    const updated = { ...summary, ...updates, updatedAt: new Date() };
    this.ibAccountSummaries.set(id, updated);
    return updated;
  }

  async upsertIBAccountSummary(summary: InsertIBAccountSummary): Promise<IBAccountSummary> {
    const existing = Array.from(this.ibAccountSummaries.values()).find(sum => 
      sum.ibAccountId === summary.ibAccountId && sum.currency === summary.currency
    );
    
    if (existing) {
      return this.updateIBAccountSummary(existing.id, summary) as Promise<IBAccountSummary>;
    } else {
      return this.createIBAccountSummary(summary);
    }
  }

  async getIBMarketDataSubscriptions(userId: string, ibAccountId?: string): Promise<IBMarketDataSubscription[]> {
    let subscriptions = Array.from(this.ibMarketDataSubscriptions.values()).filter(sub => sub.userId === userId);
    if (ibAccountId) {
      subscriptions = subscriptions.filter(sub => sub.ibAccountId === ibAccountId);
    }
    return subscriptions;
  }

  async createIBMarketDataSubscription(subscription: InsertIBMarketDataSubscription): Promise<IBMarketDataSubscription> {
    const id = `ib-subscription-${Date.now()}`;
    const newSubscription: IBMarketDataSubscription = {
      ...subscription,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.ibMarketDataSubscriptions.set(id, newSubscription);
    return newSubscription;
  }

  async updateIBMarketDataSubscription(id: string, updates: Partial<IBMarketDataSubscription>): Promise<IBMarketDataSubscription | undefined> {
    const subscription = this.ibMarketDataSubscriptions.get(id);
    if (!subscription) return undefined;
    
    const updated = { ...subscription, ...updates, updatedAt: new Date() };
    this.ibMarketDataSubscriptions.set(id, updated);
    return updated;
  }

  async deleteIBMarketDataSubscription(id: string): Promise<boolean> {
    return this.ibMarketDataSubscriptions.delete(id);
  }

  async getIBMarketDataSubscriptionBySymbol(symbol: string, ibAccountId: string): Promise<IBMarketDataSubscription | undefined> {
    return Array.from(this.ibMarketDataSubscriptions.values()).find(sub => 
      sub.symbol === symbol && sub.ibAccountId === ibAccountId
    );
  }

  async getIBTradingSessions(userId: string, ibAccountId?: string): Promise<IBTradingSession[]> {
    let sessions = Array.from(this.ibTradingSessions.values()).filter(sess => sess.userId === userId);
    if (ibAccountId) {
      sessions = sessions.filter(sess => sess.ibAccountId === ibAccountId);
    }
    return sessions;
  }

  async getIBTradingSession(id: string): Promise<IBTradingSession | undefined> {
    return this.ibTradingSessions.get(id);
  }

  async createIBTradingSession(session: InsertIBTradingSession): Promise<IBTradingSession> {
    const id = `ib-session-${Date.now()}`;
    const newSession: IBTradingSession = {
      ...session,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.ibTradingSessions.set(id, newSession);
    return newSession;
  }

  async updateIBTradingSession(id: string, updates: Partial<IBTradingSession>): Promise<IBTradingSession | undefined> {
    const session = this.ibTradingSessions.get(id);
    if (!session) return undefined;
    
    const updated = { ...session, ...updates, updatedAt: new Date() };
    this.ibTradingSessions.set(id, updated);
    return updated;
  }

  async getActiveIBTradingSession(ibAccountId: string): Promise<IBTradingSession | undefined> {
    return Array.from(this.ibTradingSessions.values()).find(sess => 
      sess.ibAccountId === ibAccountId && !sess.disconnectedAt
    );
  }

  async endIBTradingSession(id: string, disconnectReason?: string): Promise<IBTradingSession | undefined> {
    return this.updateIBTradingSession(id, { 
      disconnectedAt: new Date(),
      disconnectReason 
    });
  }

  // Supplier methods
  async getAllSuppliers(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values());
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    return this.suppliers.get(id);
  }

  async createSupplier(supplierData: InsertSupplier): Promise<Supplier> {
    const id = randomUUID();
    const supplier: Supplier = {
      ...supplierData,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.suppliers.set(id, supplier);
    return supplier;
  }

  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier | undefined> {
    const supplier = this.suppliers.get(id);
    if (!supplier) return undefined;
    
    const updated = { ...supplier, ...updates, updatedAt: new Date() };
    this.suppliers.set(id, updated);
    return updated;
  }

  async deleteSupplier(id: string): Promise<boolean> {
    return this.suppliers.delete(id);
  }

  // Supplier Product methods
  async getSupplierProducts(supplierId?: string): Promise<SupplierProduct[]> {
    const products = Array.from(this.supplierProducts.values());
    return supplierId ? products.filter(p => p.supplierId === supplierId) : products;
  }

  async getSupplierProduct(id: string): Promise<SupplierProduct | undefined> {
    return this.supplierProducts.get(id);
  }

  async createSupplierProduct(productData: InsertSupplierProduct): Promise<SupplierProduct> {
    const id = randomUUID();
    const product: SupplierProduct = {
      ...productData,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.supplierProducts.set(id, product);
    return product;
  }

  async updateSupplierProduct(id: string, updates: Partial<SupplierProduct>): Promise<SupplierProduct | undefined> {
    const product = this.supplierProducts.get(id);
    if (!product) return undefined;
    
    const updated = { ...product, ...updates, updatedAt: new Date() };
    this.supplierProducts.set(id, updated);
    return updated;
  }

  async deleteSupplierProduct(id: string): Promise<boolean> {
    return this.supplierProducts.delete(id);
  }

  // Product Performance methods
  async getProductPerformanceMetrics(productId?: string): Promise<ProductPerformanceMetric[]> {
    const metrics = Array.from(this.productPerformanceMetrics.values());
    return productId ? metrics.filter(m => m.productId === productId) : metrics;
  }

  async createProductPerformanceMetric(metricData: InsertProductPerformanceMetric): Promise<ProductPerformanceMetric> {
    const id = randomUUID();
    const metric: ProductPerformanceMetric = {
      ...metricData,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.productPerformanceMetrics.set(id, metric);
    return metric;
  }

  async updateProductPerformanceMetric(id: string, updates: Partial<ProductPerformanceMetric>): Promise<ProductPerformanceMetric | undefined> {
    const metric = this.productPerformanceMetrics.get(id);
    if (!metric) return undefined;
    
    const updated = { ...metric, ...updates, updatedAt: new Date() };
    this.productPerformanceMetrics.set(id, updated);
    return updated;
  }

  async deleteProductPerformanceMetric(id: string): Promise<boolean> {
    return this.productPerformanceMetrics.delete(id);
  }

  private initializeSampleSuppliers() {
    // Create sample suppliers
    const suppliers: Supplier[] = [
      {
        id: "supplier-1",
        name: "Alpha Financial Products Ltd",
        contactEmail: "contact@alphafinancial.com",
        contactPhone: "+91-9876543210",
        address: "Mumbai, Maharashtra",
        description: "Leading provider of investment products and financial instruments",
        rating: 4.8,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "supplier-2", 
        name: "Beta Asset Management",
        contactEmail: "info@betaassets.com",
        contactPhone: "+91-8765432109",
        address: "Delhi, NCR",
        description: "Specialized in mutual funds and portfolio management solutions",
        rating: 4.6,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "supplier-3",
        name: "Gamma Investment Corp",
        contactEmail: "support@gammainvest.com", 
        contactPhone: "+91-7654321098",
        address: "Bangalore, Karnataka",
        description: "High-yield investment products and alternative assets",
        rating: 4.9,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    suppliers.forEach(supplier => {
      this.suppliers.set(supplier.id, supplier);
    });

    // Create sample supplier products
    const products: SupplierProduct[] = [
      {
        id: "product-1",
        supplierId: "supplier-1",
        productName: "High Yield Bond Fund",
        description: "Corporate bond fund with 8.5% annual returns",
        price: 10000.00,
        profitMargin: 15.5,
        category: "Bonds",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "product-2",
        supplierId: "supplier-1", 
        productName: "Equity Growth Fund",
        description: "Large cap equity fund targeting 12% returns",
        price: 5000.00,
        profitMargin: 12.0,
        category: "Equity",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "product-3",
        supplierId: "supplier-2",
        productName: "Balanced Advantage Fund",
        description: "Dynamic asset allocation between equity and debt",
        price: 2500.00,
        profitMargin: 18.5,
        category: "Hybrid",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "product-4",
        supplierId: "supplier-3",
        productName: "Alternative Investment Platform",
        description: "Access to REITs, InvITs and structured products",
        price: 25000.00,
        profitMargin: 22.0,
        category: "Alternative",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    products.forEach(product => {
      this.supplierProducts.set(product.id, product);
    });

    // Create sample performance metrics
    const metrics: ProductPerformanceMetric[] = [
      {
        id: "metric-1",
        productId: "product-1",
        salesVolume: 150,
        revenue: 1500000.00,
        customerSatisfaction: 4.7,
        returnRate: 2.1,
        profitMargin: 15.5,
        trendDirection: "up",
        recordedAt: new Date("2025-01-15"),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "metric-2",
        productId: "product-2",
        salesVolume: 280,
        revenue: 1400000.00,
        customerSatisfaction: 4.5,
        returnRate: 3.2,
        profitMargin: 12.0,
        trendDirection: "stable",
        recordedAt: new Date("2025-01-15"),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "metric-3",
        productId: "product-3",
        salesVolume: 320,
        revenue: 800000.00,
        customerSatisfaction: 4.8,
        returnRate: 1.5,
        profitMargin: 18.5,
        trendDirection: "up",
        recordedAt: new Date("2025-01-15"),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "metric-4",
        productId: "product-4",
        salesVolume: 45,
        revenue: 1125000.00,
        customerSatisfaction: 4.9,
        returnRate: 0.8,
        profitMargin: 22.0,
        trendDirection: "up",
        recordedAt: new Date("2025-01-15"),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    metrics.forEach(metric => {
      this.productPerformanceMetrics.set(metric.id, metric);
    });
  }

  // Client Assignment methods implementation
  async createClientAssignment(assignment: any): Promise<any> {
    this.clientAssignments.set(assignment.id, assignment);
    return assignment;
  }

  async getClientAssignments(): Promise<any[]> {
    return Array.from(this.clientAssignments.values());
  }

  async updateClientAssignment(id: string, updates: any): Promise<any> {
    const assignment = this.clientAssignments.get(id);
    if (!assignment) return undefined;
    
    const updatedAssignment = { ...assignment, ...updates, updatedAt: new Date() };
    this.clientAssignments.set(id, updatedAssignment);
    return updatedAssignment;
  }

  async getClientAssignmentsByAgent(agentId: string): Promise<any[]> {
    return Array.from(this.clientAssignments.values())
      .filter(assignment => assignment.assignedAgentIds.includes(agentId));
  }

  // Government Scheme Holdings methods
  async getEpfHoldings(userId: string): Promise<EpfHolding[]> {
    return this.epfHoldings.get(userId) || [];
  }

  async getPpfHoldings(userId: string): Promise<PpfHolding[]> {
    return this.ppfHoldings.get(userId) || [];
  }

  async getEpsHoldings(userId: string): Promise<EpsHolding[]> {
    return this.epsHoldings.get(userId) || [];
  }

  // Insurance Holdings methods
  async getInsuranceHoldings(userId: string): Promise<InsuranceHolding[]> {
    return this.insuranceHoldings.get(userId) || [];
  }

  async createInsuranceHolding(holding: InsertInsuranceHolding): Promise<InsuranceHolding> {
    const id = randomUUID();
    const newHolding: InsuranceHolding = {
      ...holding,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const userHoldings = this.insuranceHoldings.get(holding.userId) || [];
    userHoldings.push(newHolding);
    this.insuranceHoldings.set(holding.userId, userHoldings);
    
    return newHolding;
  }

  async updateInsuranceHolding(id: string, updates: Partial<InsuranceHolding>): Promise<InsuranceHolding | undefined> {
    for (const [userId, holdings] of this.insuranceHoldings.entries()) {
      const index = holdings.findIndex(h => h.id === id);
      if (index !== -1) {
        const updatedHolding = { 
          ...holdings[index], 
          ...updates, 
          updatedAt: new Date() 
        };
        holdings[index] = updatedHolding;
        this.insuranceHoldings.set(userId, holdings);
        return updatedHolding;
      }
    }
    return undefined;
  }

  // Government Scheme Consent methods
  async checkGovernmentSchemeConsent(userId: string, panNumber: string, schemeType: string): Promise<boolean> {
    const consents = this.governmentSchemeConsents.get(userId) || [];
    const activeConsent = consents.find(consent => 
      consent.panNumber === panNumber && 
      (consent.schemeType === schemeType || consent.schemeType === 'all') &&
      consent.consentGranted &&
      consent.isActive &&
      (!consent.consentExpiryDate || consent.consentExpiryDate > new Date())
    );
    return !!activeConsent;
  }

  async createGovernmentSchemeConsent(consentData: InsertGovernmentSchemeConsent): Promise<GovernmentSchemeConsent> {
    const id = randomUUID();
    const consent: GovernmentSchemeConsent = {
      ...consentData,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const userConsents = this.governmentSchemeConsents.get(consent.userId) || [];
    userConsents.push(consent);
    this.governmentSchemeConsents.set(consent.userId, userConsents);
    
    return consent;
  }

  async getGovernmentSchemeConsents(userId: string, panNumber?: string): Promise<GovernmentSchemeConsent[]> {
    const consents = this.governmentSchemeConsents.get(userId) || [];
    if (panNumber) {
      return consents.filter(consent => consent.panNumber === panNumber);
    }
    return consents;
  }

  async revokeGovernmentSchemeConsent(userId: string, panNumber: string, schemeType: string): Promise<boolean> {
    const consents = this.governmentSchemeConsents.get(userId) || [];
    const consentIndex = consents.findIndex(consent => 
      consent.panNumber === panNumber && 
      (consent.schemeType === schemeType || consent.schemeType === 'all') &&
      consent.isActive
    );
    
    if (consentIndex >= 0) {
      consents[consentIndex].isActive = false;
      consents[consentIndex].revokedAt = new Date();
      consents[consentIndex].updatedAt = new Date();
      this.governmentSchemeConsents.set(userId, consents);
      return true;
    }
    return false;
  }

  private initializeGovernmentSchemeHoldings() {
    // Sample EPF Holdings for demo user
    const sampleEpfHoldings: EpfHolding[] = [
      {
        id: "epf-holding-1",
        userId: "demo-user-1",
        epfAccountNumber: "AP/HYD/12345/001/1234567",
        employerName: "Tech Solutions Pvt Ltd",
        memberName: "Demo User",
        employeeContribution: "125000.00",
        employerContribution: "125000.00",
        pensionContribution: "15000.00",
        totalBalance: "265000.00",
        interestEarned: "35000.00",
        interestRate: "8.15",
        dateOfJoining: new Date("2020-01-15"),
        dateOfExit: null,
        isActive: true,
        nomineeName: "John Doe",
        nomineeRelationship: "Spouse",
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Sample PPF Holdings for demo user
    const samplePpfHoldings: PpfHolding[] = [
      {
        id: "ppf-holding-1",
        userId: "demo-user-1",
        ppfAccountNumber: "PPF12345678901234",
        bankName: "State Bank of India",
        branchName: "Hyderabad Main Branch",
        accountHolderName: "Demo User",
        totalBalance: "180000.00",
        currentFinancialYearContribution: "15000.00",
        totalContribution: "120000.00",
        totalInterestEarned: "60000.00",
        currentInterestRate: "7.10",
        maturityAmount: "450000.00",
        accountOpenDate: new Date("2017-04-01"),
        maturityDate: new Date("2032-04-01"),
        lastContributionDate: new Date("2025-02-15"),
        nextContributionDueDate: new Date("2025-03-31"),
        yearsCompleted: 8,
        minContributionMet: true,
        maxContributionAllowed: "150000.00",
        contributionRemaining: "135000.00",
        loanAvailable: true,
        maxLoanAmount: "90000.00",
        partialWithdrawalAvailable: true,
        maxWithdrawalAmount: "54000.00",
        nomineeName: "John Doe",
        nomineeRelationship: "Spouse",
        nomineeAge: 35,
        isActive: true,
        canExtend: false,
        hasExtended: false,
        extensionPeriod: null,
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Sample EPS Holdings for demo user
    const sampleEpsHoldings: EpsHolding[] = [
      {
        id: "eps-holding-1",
        userId: "demo-user-1",
        epfAccountNumber: "AP/HYD/12345/001/1234567",
        pensionAccountNumber: "PEN12345678901234",
        employerCode: "TECH001",
        currentEmployer: "Tech Solutions Pvt Ltd",
        serviceStartDate: new Date("2020-01-15"),
        totalServiceYears: 5,
        totalServiceMonths: 2,
        currentSalary: "75000.00",
        pensionableWage: "15000.00",
        contributionRate: "8.33",
        monthlyPensionContribution: "1249.50",
        totalContribution: "78000.00",
        accumulatedPension: "95000.00",
        estimatedMonthlyPension: "3500.00",
        minVestingPeriod: 10,
        isVested: false,
        eligibleForPension: false,
        expectedRetirementDate: new Date("2038-01-15"),
        schemeType: "eps95",
        certificateNumber: null,
        nomineeName: "John Doe",
        nomineeRelationship: "Spouse",
        nomineeShare: "100.00",
        status: "active",
        lastPensionCalculationDate: new Date("2025-01-31"),
        remarks: "Active employee with good contribution record",
        apyEnrolled: true,
        apyAccountNumber: "APY12345678901234",
        apyPensionAmount: "5000.00",
        apyMonthlyContribution: "2100.00",
        apyStartDate: new Date("2020-04-01"),
        apyMaturityAge: 60,
        apyCurrentAge: 30,
        apyTotalContribution: "126000.00",
        apyGovernmentContribution: "25000.00",
        apyStatus: "active",
        apyBankName: "State Bank of India",
        apyBranchCode: "SBIN0001234",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUpdated: new Date()
      }
    ];

    // Sample Insurance Holdings for demo user
    const sampleInsuranceHoldings: InsuranceHolding[] = [
      {
        id: "insurance-holding-1",
        userId: "demo-user-1",
        policyNumber: "LIC/500/1234567890",
        policyName: "Jeevan Anand",
        insuranceCompany: "Life Insurance Corporation of India",
        policyType: "life",
        category: "traditional",
        sumAssured: "1000000.00",
        premiumAmount: "25000.00",
        premiumFrequency: "yearly",
        fundValue: null,
        policyStartDate: new Date("2020-04-01"),
        policyMaturityDate: new Date("2040-03-31"),
        premiumDueDate: new Date("2025-04-01"),
        lastPremiumPaidDate: new Date("2024-04-01"),
        depositoryName: "NSDL",
        depositoryAccountNumber: "IN300214-12345678",
        isinNumber: "INE123A01012",
        policyStatus: "active",
        paidUpValue: "85000.00",
        surrenderValue: "75000.00",
        nomineeDetails: "John Doe - Spouse",
        nomineeRelation: "Spouse",
        agentCode: "LIC001234",
        branchCode: "HYD001",
        servicing_branch: "Hyderabad Secunderabad",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "insurance-holding-2",
        userId: "demo-user-1",
        policyNumber: "HDFC/LIFE/2024/987654321",
        policyName: "HDFC Life Click 2 Protect Plus",
        insuranceCompany: "HDFC Life Insurance",
        policyType: "life",
        category: "term",
        sumAssured: "5000000.00",
        premiumAmount: "12000.00",
        premiumFrequency: "yearly",
        fundValue: null,
        policyStartDate: new Date("2024-01-15"),
        policyMaturityDate: new Date("2054-01-14"),
        premiumDueDate: new Date("2025-01-15"),
        lastPremiumPaidDate: new Date("2024-01-15"),
        depositoryName: "CDSL",
        depositoryAccountNumber: "12345678-12345678",
        isinNumber: "INE040A01034",
        policyStatus: "active",
        paidUpValue: null,
        surrenderValue: null,
        nomineeDetails: "Jane Doe - Daughter",
        nomineeRelation: "Daughter",
        agentCode: "HDFC5678",
        branchCode: "HYD002",
        servicing_branch: "HDFC Life Banjara Hills",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Store the sample data
    this.epfHoldings.set("demo-user-1", sampleEpfHoldings);
    this.ppfHoldings.set("demo-user-1", samplePpfHoldings);
    this.epsHoldings.set("demo-user-1", sampleEpsHoldings);
    this.insuranceHoldings.set("demo-user-1", sampleInsuranceHoldings);
  }

  // Loan Against Securities methods implementation
  async createLoanApplication(application: any): Promise<any> {
    const id = application.id || `loan-${Date.now()}`;
    const loanApp = {
      id,
      ...application,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.loanApplications.set(id, loanApp);
    return loanApp;
  }

  async getLoanApplication(id: string): Promise<any | undefined> {
    return this.loanApplications.get(id);
  }

  async getUserLoans(userId: string): Promise<any[]> {
    return Array.from(this.loanApplications.values()).filter(loan => loan.userId === userId);
  }

  async updateLoanStatus(id: string, updates: any): Promise<any | undefined> {
    const loan = this.loanApplications.get(id);
    if (!loan) return undefined;
    
    const updatedLoan = {
      ...loan,
      ...updates,
      updatedAt: new Date()
    };
    this.loanApplications.set(id, updatedLoan);
    return updatedLoan;
  }

  async getCollateralValuation(loanId: string): Promise<any | undefined> {
    return this.collateralValuations.get(loanId);
  }

  async createCollateralValuation(valuation: any): Promise<any> {
    const id = valuation.id || `valuation-${Date.now()}`;
    const valuationData = {
      id,
      ...valuation,
      createdAt: new Date()
    };
    this.collateralValuations.set(valuation.loanId, valuationData);
    return valuationData;
  }
}

export const storage = new MemStorage();
