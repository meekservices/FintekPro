import { type User, type UpsertUser, type Portfolio, type InsertPortfolio, type PortfolioHolding, type InsertPortfolioHolding, type Watchlist, type InsertWatchlist, type MarketData, type AssetAllocation, type InsertAssetAllocation, type MutualFund, type InsertMutualFund, type OtpVerification, type InsertOtpVerification, type LearningModule, type InsertLearningModule, type LearningLesson, type InsertLearningLesson, type LearningQuiz, type InsertLearningQuiz, type UserProgress, type InsertUserProgress, type UserAchievement, type InsertUserAchievement, type UserStats, type InsertUserStats, type UserProfile, type InsertUserProfile } from "@shared/schema";
import { randomUUID } from "crypto";

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
  
  // Learning System methods
  getAllLearningModules(): Promise<LearningModule[]>;
  getLearningModule(moduleId: string): Promise<LearningModule | undefined>;
  getLearningLessons(moduleId: string): Promise<LearningLesson[]>;
  getLearningLesson(lessonId: string): Promise<LearningLesson | undefined>;
  getLearningQuiz(lessonId: string): Promise<LearningQuiz | undefined>;
  getUserProgress(userId: string): Promise<UserProgress[]>;
  getUserProgressForModule(userId: string, moduleId: string): Promise<UserProgress[]>;
  getUserStats(userId: string): Promise<UserStats | undefined>;
  upsertUserProgress(progress: InsertUserProgress): Promise<UserProgress>;
  upsertUserStats(stats: InsertUserStats): Promise<UserStats>;
  addUserAchievement(achievement: InsertUserAchievement): Promise<UserAchievement>;
  getUserAchievements(userId: string): Promise<UserAchievement[]>;
  
  // User Profile methods
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private otpVerifications: Map<string, OtpVerification>;
  private portfolios: Map<string, Portfolio>;
  private portfolioHoldings: Map<string, PortfolioHolding>;
  private watchlists: Map<string, Watchlist>;
  private marketData: Map<string, MarketData>;
  private assetAllocations: Map<string, AssetAllocation>;
  private mutualFunds: Map<string, MutualFund>;
  private learningModules: Map<string, LearningModule>;
  private learningLessons: Map<string, LearningLesson>;
  private learningQuizzes: Map<string, LearningQuiz>;
  private userProgress: Map<string, UserProgress>;
  private userAchievements: Map<string, UserAchievement>;
  private userStats: Map<string, UserStats>;
  private userProfiles: Map<string, UserProfile>;

  constructor() {
    this.users = new Map();
    this.otpVerifications = new Map();
    this.portfolios = new Map();
    this.portfolioHoldings = new Map();
    this.watchlists = new Map();
    this.marketData = new Map();
    this.assetAllocations = new Map();
    this.mutualFunds = new Map();
    this.learningModules = new Map();
    this.learningLessons = new Map();
    this.learningQuizzes = new Map();
    this.userProgress = new Map();
    this.userAchievements = new Map();
    this.userStats = new Map();
    this.userProfiles = new Map();
    
    // Initialize with sample data
    this.initializeSampleData();
  }

  private initializeSampleData() {
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

    // Initialize learning system sample data
    this.initializeLearningData();
  }

  private initializeLearningData() {
    // Sample Learning Modules
    const modules: LearningModule[] = [
      {
        id: "module-1",
        title: "Introduction to Agricultural Commodity Trading",
        description: "Learn the fundamentals of agricultural commodities, market dynamics, and basic trading concepts.",
        difficulty: "beginner",
        category: "basics",
        orderIndex: 1,
        estimatedMinutes: 45,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "module-2", 
        title: "Understanding Market Cycles and Seasonality",
        description: "Discover how seasonal patterns, weather, and crop cycles affect agricultural commodity prices.",
        difficulty: "beginner",
        category: "basics",
        orderIndex: 2,
        estimatedMinutes: 60,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "module-3",
        title: "Risk Management Strategies",
        description: "Master hedging techniques, position sizing, and risk assessment in agricultural markets.",
        difficulty: "intermediate",
        category: "risk-management",
        orderIndex: 3,
        estimatedMinutes: 75,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "module-4",
        title: "Technical Analysis for Commodities",
        description: "Learn chart patterns, technical indicators, and price action strategies for commodity trading.",
        difficulty: "intermediate",
        category: "trading",
        orderIndex: 4,
        estimatedMinutes: 90,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "module-5",
        title: "Advanced Trading Strategies",
        description: "Explore complex trading strategies, spread trading, and arbitrage opportunities.",
        difficulty: "advanced",
        category: "trading",
        orderIndex: 5,
        estimatedMinutes: 120,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Sample Learning Lessons
    const lessons: LearningLesson[] = [
      // Module 1 Lessons
      {
        id: "lesson-1-1",
        moduleId: "module-1",
        title: "What are Agricultural Commodities?",
        content: "<h3>Agricultural Commodities Overview</h3><p>Agricultural commodities are raw agricultural products that can be bought, sold, and traded on various exchanges. These include grains (wheat, corn, rice), oilseeds (soybeans, canola), livestock (cattle, pork), and soft commodities (coffee, sugar, cotton).</p><h4>Key Characteristics:</h4><ul><li>Standardized quality and quantity</li><li>Interchangeable with other units</li><li>Traded on regulated exchanges</li><li>Subject to seasonal patterns</li></ul><p>Understanding these basics is crucial for successful commodity trading.</p>",
        contentType: "text",
        orderIndex: 1,
        estimatedMinutes: 15,
        pointsReward: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "lesson-1-2",
        moduleId: "module-1",
        title: "Major Agricultural Exchanges",
        content: "<h3>Global Commodity Exchanges</h3><p>Agricultural commodities are traded on various exchanges worldwide:</p><h4>Major Exchanges:</h4><ul><li><strong>Chicago Board of Trade (CBOT)</strong> - Corn, soybeans, wheat</li><li><strong>Chicago Mercantile Exchange (CME)</strong> - Livestock, dairy</li><li><strong>Intercontinental Exchange (ICE)</strong> - Sugar, coffee, cotton</li><li><strong>Multi Commodity Exchange (MCX)</strong> - Indian agricultural commodities</li></ul><p>Each exchange has its own trading hours, contract specifications, and margin requirements.</p>",
        contentType: "text",
        orderIndex: 2,
        estimatedMinutes: 15,
        pointsReward: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "lesson-1-3",
        moduleId: "module-1",
        title: "Supply and Demand Factors",
        content: "<h3>Market Fundamentals</h3><p>Agricultural commodity prices are primarily driven by supply and demand dynamics:</p><h4>Supply Factors:</h4><ul><li>Weather conditions and climate</li><li>Planted acreage and yield estimates</li><li>Government policies and subsidies</li><li>Production costs and technology</li></ul><h4>Demand Factors:</h4><ul><li>Population growth and demographics</li><li>Economic development in emerging markets</li><li>Dietary changes and consumer preferences</li><li>Biofuel production and alternative uses</li></ul><p>Successful traders must monitor these factors continuously.</p>",
        contentType: "text",
        orderIndex: 3,
        estimatedMinutes: 15,
        pointsReward: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Sample Quizzes
    const quizzes: LearningQuiz[] = [
      {
        id: "quiz-1-1",
        lessonId: "lesson-1-1",
        question: "Which of the following is NOT a characteristic of agricultural commodities?",
        options: [
          "Standardized quality and quantity",
          "Unique and customized for each buyer",
          "Interchangeable with other units",
          "Traded on regulated exchanges"
        ],
        correctAnswer: 1,
        explanation: "Agricultural commodities are standardized and interchangeable, not unique or customized for individual buyers.",
        pointsReward: 50,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: "quiz-1-2",
        lessonId: "lesson-1-2",
        question: "Which exchange is known for trading corn, soybeans, and wheat?",
        options: [
          "Chicago Mercantile Exchange (CME)",
          "Chicago Board of Trade (CBOT)",
          "Intercontinental Exchange (ICE)",
          "New York Stock Exchange (NYSE)"
        ],
        correctAnswer: 1,
        explanation: "The Chicago Board of Trade (CBOT) is the primary exchange for grains including corn, soybeans, and wheat.",
        pointsReward: 50,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Store sample data
    modules.forEach(module => this.learningModules.set(module.id, module));
    lessons.forEach(lesson => this.learningLessons.set(lesson.id, lesson));
    quizzes.forEach(quiz => this.learningQuizzes.set(quiz.id, quiz));

    // Sample user stats (for demo purposes)
    const demoUserStats: UserStats = {
      id: "stats-demo-user-1",
      userId: "demo-user-1",
      totalPoints: 850,
      currentStreak: 5,
      maxStreak: 12,
      modulesCompleted: 1,
      lessonsCompleted: 8,
      averageScore: "87.5",
      lastActivityDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.userStats.set("demo-user-1", demoUserStats);
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async getUserByMobile(mobile: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.mobile === mobile);
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
    
    const updated: User = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };
    this.users.set(id, updated);
    return updated;
  }

  async createOtpVerification(otpData: InsertOtpVerification): Promise<OtpVerification> {
    const id = randomUUID();
    const otp: OtpVerification = {
      ...otpData,
      id,
      verified: otpData.verified ?? false,
      createdAt: new Date()
    };
    this.otpVerifications.set(`${otpData.identifier}_${otpData.type}`, otp);
    return otp;
  }

  async getOtpVerification(identifier: string, type: string): Promise<OtpVerification | undefined> {
    return this.otpVerifications.get(`${identifier}_${type}`);
  }

  async verifyOtp(identifier: string, type: string, otp: string): Promise<boolean> {
    const verification = await this.getOtpVerification(identifier, type);
    if (!verification) return false;
    if (verification.verified) return false;
    if (verification.expiresAt < new Date()) return false;
    if (verification.otp !== otp) return false;

    verification.verified = true;
    this.otpVerifications.set(`${identifier}_${type}`, verification);
    return true;
  }

  async cleanupExpiredOtps(): Promise<void> {
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

  // Learning System Methods
  async getAllLearningModules(): Promise<LearningModule[]> {
    return Array.from(this.learningModules.values()).sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async getLearningModule(moduleId: string): Promise<LearningModule | undefined> {
    return this.learningModules.get(moduleId);
  }

  async getLearningLessons(moduleId: string): Promise<LearningLesson[]> {
    return Array.from(this.learningLessons.values())
      .filter(lesson => lesson.moduleId === moduleId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async getLearningLesson(lessonId: string): Promise<LearningLesson | undefined> {
    return this.learningLessons.get(lessonId);
  }

  async getLearningQuiz(lessonId: string): Promise<LearningQuiz | undefined> {
    return Array.from(this.learningQuizzes.values()).find(quiz => quiz.lessonId === lessonId);
  }

  async getUserProgress(userId: string): Promise<UserProgress[]> {
    return Array.from(this.userProgress.values()).filter(progress => progress.userId === userId);
  }

  async getUserProgressForModule(userId: string, moduleId: string): Promise<UserProgress[]> {
    return Array.from(this.userProgress.values()).filter(
      progress => progress.userId === userId && progress.moduleId === moduleId
    );
  }

  async getUserStats(userId: string): Promise<UserStats | undefined> {
    return this.userStats.get(userId);
  }

  async upsertUserProgress(insertProgress: InsertUserProgress): Promise<UserProgress> {
    const existing = Array.from(this.userProgress.values()).find(
      progress => progress.userId === insertProgress.userId && 
                 progress.moduleId === insertProgress.moduleId &&
                 progress.lessonId === insertProgress.lessonId
    );
    
    const id = existing?.id || randomUUID();
    const progress: UserProgress = {
      ...insertProgress,
      id,
      completedAt: insertProgress.completedAt ?? null,
      score: insertProgress.score ?? null,
      timeSpent: insertProgress.timeSpent ?? null,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date()
    };
    
    // Store with a composite key for easier lookup
    const key = `${progress.userId}_${progress.moduleId}_${progress.lessonId}`;
    this.userProgress.set(key, progress);
    return progress;
  }

  async upsertUserStats(insertStats: InsertUserStats): Promise<UserStats> {
    const existing = this.userStats.get(insertStats.userId);
    const id = existing?.id || randomUUID();
    
    const stats: UserStats = {
      ...insertStats,
      id,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date()
    };
    
    this.userStats.set(insertStats.userId, stats);
    return stats;
  }

  async addUserAchievement(insertAchievement: InsertUserAchievement): Promise<UserAchievement> {
    const id = randomUUID();
    const achievement: UserAchievement = {
      ...insertAchievement,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.userAchievements.set(id, achievement);
    return achievement;
  }

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    return Array.from(this.userAchievements.values())
      .filter(achievement => achievement.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // User Profile methods
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    return this.userProfiles.get(userId);
  }

  async upsertUserProfile(insertProfile: InsertUserProfile): Promise<UserProfile> {
    const existing = this.userProfiles.get(insertProfile.userId);
    const id = existing?.id || randomUUID();
    
    const profile: UserProfile = {
      ...insertProfile,
      id,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date()
    };
    
    this.userProfiles.set(insertProfile.userId, profile);
    return profile;
  }
}

export const storage = new MemStorage();
