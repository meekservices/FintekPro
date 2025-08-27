import { type User, type InsertUser, type Portfolio, type InsertPortfolio, type PortfolioHolding, type InsertPortfolioHolding, type Watchlist, type InsertWatchlist, type MarketData, type AssetAllocation, type InsertAssetAllocation, type MutualFund, type InsertMutualFund } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  
  // Mutual Fund methods
  getAllMutualFunds(): Promise<MutualFund[]>;
  getMutualFund(schemeCode: string): Promise<MutualFund | undefined>;
  upsertMutualFund(fund: InsertMutualFund): Promise<MutualFund>;
  searchMutualFunds(query: string): Promise<MutualFund[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private portfolios: Map<string, Portfolio>;
  private portfolioHoldings: Map<string, PortfolioHolding>;
  private watchlists: Map<string, Watchlist>;
  private marketData: Map<string, MarketData>;
  private assetAllocations: Map<string, AssetAllocation>;
  private mutualFunds: Map<string, MutualFund>;

  constructor() {
    this.users = new Map();
    this.portfolios = new Map();
    this.portfolioHoldings = new Map();
    this.watchlists = new Map();
    this.marketData = new Map();
    this.assetAllocations = new Map();
    this.mutualFunds = new Map();
    
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
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      createdAt: new Date(),
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null
    };
    this.users.set(id, user);
    return user;
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
}

export const storage = new MemStorage();
