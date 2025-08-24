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
