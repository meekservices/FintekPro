import { type User, type UpsertUser, type Portfolio, type InsertPortfolio, type PortfolioHolding, type InsertPortfolioHolding, type Watchlist, type InsertWatchlist, type MarketData, type AssetAllocation, type InsertAssetAllocation, type MutualFund, type InsertMutualFund, type OtpVerification, type InsertOtpVerification, type UserProfile, type InsertUserProfile } from "@shared/schema";
import { randomUUID } from "crypto";

// We'll import hashPassword later to avoid circular dependency

export interface IStorage {
  // User methods for mobile/email authentication
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByMobile(mobile: string): Promise<User | undefined>;
  createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // OTP verification methods
  createOtpVerification(otp: InsertOtpVerification): Promise<OtpVerification>;
  getOtpVerification(identifier: string, type: string): Promise<OtpVerification | undefined>;
  verifyOtp(identifier: string, type: string, otp: string): Promise<boolean>;
  cleanupExpiredOtps(): Promise<void>;
  
  // Portfolio methods
  getPortfoliosByUserId(userId: string): Promise<Portfolio[]>;
  getPortfolio(id: string): Promise<Portfolio | undefined>;
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
    
    // Initialize with sample data
    this.initializeSampleData();
    this.initializeRiskAssessmentQuestions();
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
      panNumber: null,
      aadharNumber: null,
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

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...userData,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updated = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
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
}

export const storage = new MemStorage();
