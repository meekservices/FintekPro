// @ts-nocheck
/**
 * Investment Data Cache Service
 * Unified caching layer for all investment product data with background pre-computation
 * 
 * Features:
 * - Multi-asset class data caching (stocks, MF, bonds, REITs, IPOs, etc.)
 * - Background refresh with configurable TTLs per product type
 * - Metrics tracking for observability
 * - Graceful degradation with stale-while-revalidate pattern
 */

import { storage } from "../storage";
import type { InvestmentProduct, UnifiedProductType as ProductType, RiskLevel, LiquidityLevel as Liquidity } from "../../shared/unified-investment-product";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isRefreshing: boolean;
  source: string;
}

interface ProductTypeCacheConfig {
  ttlMs: number;
  staleTtlMs: number;
  refreshEnabled: boolean;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  refreshes: number;
  errors: number;
  lastRefreshTime: Record<ProductType, number>;
  lastRefreshDuration: Record<ProductType, number>;
  productCounts: Record<ProductType, number>;
}

const PRODUCT_CACHE_CONFIG: Record<string, ProductTypeCacheConfig> = {
  STOCK: { ttlMs: 5 * 60 * 1000, staleTtlMs: 15 * 60 * 1000, refreshEnabled: true },
  MF: { ttlMs: 6 * 60 * 60 * 1000, staleTtlMs: 12 * 60 * 60 * 1000, refreshEnabled: true },
  BOND: { ttlMs: 30 * 60 * 1000, staleTtlMs: 60 * 60 * 1000, refreshEnabled: true },
  NCD: { ttlMs: 30 * 60 * 1000, staleTtlMs: 60 * 60 * 1000, refreshEnabled: true },
  REIT: { ttlMs: 15 * 60 * 1000, staleTtlMs: 60 * 60 * 1000, refreshEnabled: true },
  INVIT: { ttlMs: 15 * 60 * 1000, staleTtlMs: 60 * 60 * 1000, refreshEnabled: true },
  IPO: { ttlMs: 5 * 60 * 1000, staleTtlMs: 15 * 60 * 1000, refreshEnabled: true },
  UNLISTED: { ttlMs: 60 * 60 * 1000, staleTtlMs: 4 * 60 * 60 * 1000, refreshEnabled: true },
  AIF: { ttlMs: 24 * 60 * 60 * 1000, staleTtlMs: 48 * 60 * 60 * 1000, refreshEnabled: true },
  PMS: { ttlMs: 24 * 60 * 60 * 1000, staleTtlMs: 48 * 60 * 60 * 1000, refreshEnabled: true },
  MLD: { ttlMs: 24 * 60 * 60 * 1000, staleTtlMs: 48 * 60 * 60 * 1000, refreshEnabled: true },
  SGB: { ttlMs: 60 * 60 * 1000, staleTtlMs: 4 * 60 * 60 * 1000, refreshEnabled: true },
  GSEC: { ttlMs: 30 * 60 * 1000, staleTtlMs: 60 * 60 * 1000, refreshEnabled: true },
  FD: { ttlMs: 24 * 60 * 60 * 1000, staleTtlMs: 48 * 60 * 60 * 1000, refreshEnabled: true },
};

class InvestmentDataCache {
  private productCache: Map<ProductType, CacheEntry<InvestmentProduct[]>> = new Map();
  private refreshLocks: Map<ProductType, boolean> = new Map();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    refreshes: 0,
    errors: 0,
    lastRefreshTime: {} as Record<ProductType, number>,
    lastRefreshDuration: {} as Record<ProductType, number>,
    productCounts: {} as Record<ProductType, number>,
  };
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('📦 [InvestmentDataCache] Initializing unified cache...');
    
    const priorityTypes: ProductType[] = ['STOCK', 'MF', 'BOND'];
    await Promise.allSettled(priorityTypes.map(type => this.refreshProductType(type)));
    
    this.startBackgroundRefresh();
    this.initialized = true;
    
    console.log('✅ [InvestmentDataCache] Cache initialized');
  }

  private startBackgroundRefresh(): void {
    setInterval(async () => {
      const now = Date.now();
      
      for (const [type, config] of Object.entries(PRODUCT_CACHE_CONFIG)) {
        const productType = type as ProductType;
        if (!config.refreshEnabled) continue;
        
        const entry = this.productCache.get(productType);
        const cacheAge = entry ? now - entry.timestamp : Infinity;
        
        if (cacheAge >= config.ttlMs && !this.refreshLocks.get(productType)) {
          this.refreshProductType(productType).catch(err => {
            console.warn(`[InvestmentDataCache] Background refresh failed for ${productType}: ${err?.message || err}`);
          });
        }
      }
    }, 60000);
  }

  private async refreshProductType(type: ProductType): Promise<void> {
    if (this.refreshLocks.get(type)) return;
    
    this.refreshLocks.set(type, true);
    const startTime = Date.now();
    const existingEntry = this.productCache.get(type);
    
    try {
      const products = await this.fetchProductsFromSource(type);
      
      if (products.length > 0) {
        this.productCache.set(type, {
          data: products,
          timestamp: Date.now(),
          isRefreshing: false,
          source: 'database',
        });
        
        this.metrics.refreshes++;
        this.metrics.lastRefreshTime[type] = Date.now();
        this.metrics.lastRefreshDuration[type] = Date.now() - startTime;
        this.metrics.productCounts[type] = products.length;
      } else if (existingEntry) {
        existingEntry.isRefreshing = false;
      }
    } catch (error) {
      this.metrics.errors++;
      console.warn(`[InvestmentDataCache] Refresh failed for ${type}: ${(error as any)?.message || error}`);
      if (existingEntry) {
        existingEntry.isRefreshing = false;
      }
    } finally {
      this.refreshLocks.set(type, false);
    }
  }

  private async fetchProductsFromSource(type: ProductType): Promise<InvestmentProduct[]> {
    switch (type) {
      case 'STOCK':
        return this.fetchStocks();
      case 'MF':
        return this.fetchMutualFunds();
      case 'BOND':
      case 'NCD':
      case 'SGB':
      case 'GSEC':
        return this.fetchBonds(type);
      case 'REIT':
        return this.fetchREITs();
      case 'INVIT':
        return this.fetchInvITs();
      case 'IPO':
        return this.fetchIPOs();
      case 'UNLISTED':
        return this.fetchUnlistedEquities();
      case 'AIF':
        return this.fetchAIFs();
      case 'PMS':
        return this.fetchPMS();
      case 'MLD':
        return this.fetchMLDs();
      case 'FD':
        return this.fetchFDs();
      default:
        return [];
    }
  }

  private async fetchREITs(): Promise<InvestmentProduct[]> {
    try {
      const { db } = await import("../db");
      const { reits } = await import("@shared/schema");
      const reitList = await db.select().from(reits).limit(50);
      return reitList.map((reit: any) => ({
        product_id: reit.id,
        product_type: 'REIT' as ProductType,
        name: reit.name,
        issuer: reit.sponsor || reit.name,
        risk_level: 'moderate' as RiskLevel,
        liquidity: 'medium' as Liquidity,
        investment_horizon: 'long',
        expected_return_band: { min: 6, max: 12 },
        volatility_proxy: 15,
        tax_treatment: 'reit',
        lock_in_period: null,
        min_investment: parseFloat(((reit as any).currentPrice)?.toString() || '0') || 300,
        regulatory_tags: ['SEBI_REGULATED', 'EXCHANGE_TRADED'],
        source: 'exchange',
        current_price: parseFloat(((reit as any).currentPrice)?.toString() || '0'),
        yield_or_return: parseFloat(((reit as any).dividendYield)?.toString() || '0'),
        sector: ((reit as any).assetType) || 'Real Estate',
        raw_data: reit,
        last_updated: reit.lastUpdated?.toISOString() || new Date().toISOString(),
      })) as any[];
    } catch (error) {
      console.warn(`[InvestmentDataCache] Failed to fetch REITs: ${(error as any)?.message || error}`);
      return [];
    }
  }

  private async fetchInvITs(): Promise<InvestmentProduct[]> {
    try {
      const { db } = await import("../db");
      const { invits } = await import("@shared/schema");
      const invitList = await db.select().from(invits).limit(50);
      return invitList.map((invit: any) => ({
        product_id: invit.id,
        product_type: 'INVIT' as ProductType,
        name: invit.name,
        issuer: invit.sponsor || invit.name,
        risk_level: 'moderate' as RiskLevel,
        liquidity: 'medium' as Liquidity,
        investment_horizon: 'long',
        expected_return_band: { min: 8, max: 14 },
        volatility_proxy: 18,
        tax_treatment: 'invit',
        lock_in_period: null,
        min_investment: parseFloat(((invit as any).currentPrice)?.toString() || '0') || 200,
        regulatory_tags: ['SEBI_REGULATED', 'EXCHANGE_TRADED'],
        source: 'exchange',
        current_price: parseFloat(((invit as any).currentPrice)?.toString() || '0'),
        yield_or_return: parseFloat(((invit as any).distributionYield)?.toString() || '0'),
        sector: ((invit as any).assetType) || 'Infrastructure',
        raw_data: invit,
        last_updated: invit.lastUpdated?.toISOString() || new Date().toISOString(),
      })) as any[];
    } catch (error) {
      console.warn(`[InvestmentDataCache] Failed to fetch InvITs: ${(error as any)?.message || error}`);
      return [];
    }
  }

  private async fetchIPOs(): Promise<InvestmentProduct[]> {
    try {
      const { db } = await import("../db");
      const { ipoCompanies } = await import("@shared/schema");
      const ipoList = await db.select().from(ipoCompanies).limit(50);
      return ipoList.map((ipo: any) => ({
        product_id: ipo.id,
        product_type: 'IPO' as ProductType,
        name: ipo.companyName,
        issuer: ipo.companyName,
        risk_level: 'aggressive' as RiskLevel,
        liquidity: 'low' as Liquidity,
        investment_horizon: 'medium',
        expected_return_band: { min: -20, max: 100 },
        volatility_proxy: 40,
        tax_treatment: 'equity',
        lock_in_period: null,
        min_investment: parseFloat(((ipo as any).minLotPrice)?.toString() || '0') || 15000,
        regulatory_tags: ['SEBI_REGULATED'],
        source: 'exchange',
        current_price: parseFloat(((ipo as any).priceRangeHigh)?.toString() || ((ipo as any).issuePrice)?.toString() || '0'),
        yield_or_return: 0,
        sector: ipo.sector || 'Various',
        raw_data: ipo,
        last_updated: ((ipo as any).updatedAt)?.toISOString() || new Date().toISOString(),
      })) as any[];
    } catch (error) {
      console.warn(`[InvestmentDataCache] Failed to fetch IPOs: ${(error as any)?.message || error}`);
      return [];
    }
  }

  private async fetchUnlistedEquities(): Promise<InvestmentProduct[]> {
    try {
      const { db } = await import("../db");
      const { preIpoCompanies } = await import("@shared/schema");
      const unlistedList = await db.select().from(preIpoCompanies).limit(50);
      return unlistedList.map((company: any) => ({
        product_id: company.id,
        product_type: 'UNLISTED' as ProductType,
        name: company.companyName,
        issuer: company.companyName,
        risk_level: 'very_aggressive' as RiskLevel,
        liquidity: 'very_low' as Liquidity,
        investment_horizon: 'very_long',
        expected_return_band: { min: -50, max: 200 },
        volatility_proxy: 60,
        tax_treatment: 'equity',
        lock_in_period: null,
        min_investment: parseFloat(((company as any).minimumInvestment)?.toString() || '0') || 100000,
        regulatory_tags: ['SEBI_ACCREDITED_INVESTOR'],
        source: 'unlisted_marketplace',
        current_price: parseFloat(((company as any).currentPrice)?.toString() || '0'),
        yield_or_return: 0,
        sector: company.sector || 'Various',
        raw_data: company,
        last_updated: ((company as any).lastPriceUpdate)?.toISOString() || new Date().toISOString(),
      })) as any[];
    } catch (error) {
      console.warn(`[InvestmentDataCache] Failed to fetch Unlisted Equities: ${(error as any)?.message || error}`);
      return [];
    }
  }

  private async fetchAIFs(): Promise<InvestmentProduct[]> {
    try {
      const { db } = await import("../db");
      const { aifMaster } = await import("@shared/schema");
      const { eq, and } = await import("drizzle-orm");
      const aifList = await db.select().from(aifMaster)
        .where(and(eq(aifMaster.fundStatus, 'active'), eq(aifMaster.isPublished, true)))
        .limit(50);
      return aifList.map((aif: any) => ({
        product_id: aif.id,
        product_type: 'AIF' as ProductType,
        name: aif.name,
        issuer: aif.fundHouseName || aif.sponsor || 'Unknown',
        risk_level: (aif.riskScore && aif.riskScore >= 7 ? 'aggressive' : aif.riskScore && aif.riskScore >= 4 ? 'moderate' : 'conservative') as RiskLevel,
        liquidity: 'very_low' as Liquidity,
        investment_horizon: 'very_long',
        expected_return_band: { min: 12, max: 25 },
        volatility_proxy: 35,
        tax_treatment: 'aif',
        lock_in_period: aif.lockIn ? parseInt(aif.lockIn.toString()) * 365 : 1095,
        min_investment: parseFloat(aif.minInvestment?.toString() || '0') || 10000000,
        regulatory_tags: ['SEBI_REGULATED', 'ACCREDITED_INVESTOR_ONLY'],
        source: 'sebi_aif',
        current_price: parseFloat(aif.latestNav?.toString() || '0'),
        yield_or_return: parseFloat(aif.return1Y?.toString() || '0'),
        sector: aif.category || 'Alternative',
        raw_data: aif,
        last_updated: aif.updatedAt?.toISOString() || new Date().toISOString(),
      })) as any[];
    } catch (error) {
      console.warn(`[InvestmentDataCache] Failed to fetch AIFs: ${(error as any)?.message || error}`);
      return [];
    }
  }

  private async fetchPMS(): Promise<InvestmentProduct[]> {
    return [];
  }

  private async fetchMLDs(): Promise<InvestmentProduct[]> {
    return [];
  }

  private async fetchFDs(): Promise<InvestmentProduct[]> {
    return [];
  }

  private async fetchStocks(): Promise<InvestmentProduct[]> {
    const stocks = await (storage as any).getAllStocks?.()() || [];
    return stocks.slice(0, 100).map((stock: any) => this.normalizeStock(stock));
  }

  private normalizeStock(stock: any): InvestmentProduct {
    const price = parseFloat(stock.currentPrice) || 0;
    const marketCap = stock.marketCap?.toLowerCase() || '';
    
    let riskLevel: RiskLevel = 'moderate';
    if (marketCap.includes('small')) riskLevel = 'aggressive';
    else if (marketCap.includes('mid')) riskLevel = 'moderate';
    else if (marketCap.includes('large')) riskLevel = 'conservative';
    
    return {
      product_id: stock.id,
      product_type: 'STOCK',
      name: stock.companyName,
      issuer: stock.companyName,
      risk_level: riskLevel,
      liquidity: 'high' as Liquidity,
      investment_horizon: 'medium',
      expected_return_band: { min: -3, max: 37 },
      volatility_proxy: 20,
      tax_treatment: 'equity',
      lock_in_period: null,
      min_investment: price,
      regulatory_tags: ['SEBI_REGULATED', 'EXCHANGE_TRADED'],
      source: 'exchange',
      current_price: price,
      yield_or_return: 0,
      sector: stock.sector || null,
      raw_data: stock,
      last_updated: stock.lastUpdated,
    };
  }

  private async fetchMutualFunds(): Promise<InvestmentProduct[]> {
    const funds = await (storage as any).searchMutualFunds?.('') || [];
    return funds.slice(0, 100).map(fund => this.normalizeMutualFund(fund));
  }

  private normalizeMutualFund(fund: any): InvestmentProduct {
    const nav = parseFloat(fund.nav) || 0;
    const category = fund.category?.toLowerCase() || '';
    
    let riskLevel: RiskLevel = 'moderate';
    if (category.includes('equity') || category.includes('aggressive')) riskLevel = 'aggressive';
    else if (category.includes('debt') || category.includes('liquid') || category.includes('money')) riskLevel = 'conservative';
    
    let horizon: 'short' | 'medium' | 'long' = 'medium';
    if (category.includes('liquid') || category.includes('overnight')) horizon = 'short';
    else if (category.includes('elss') || category.includes('equity')) horizon = 'long';
    
    return {
      product_id: fund.schemeCode?.toString() || fund.id?.toString(),
      product_type: 'MF',
      name: fund.schemeName || fund.name,
      issuer: fund.amc || fund.fundHouse || 'Unknown AMC',
      risk_level: riskLevel,
      liquidity: category.includes('close') ? 'low' : 'high',
      investment_horizon: horizon,
      expected_return_band: { min: 5, max: 15 },
      volatility_proxy: riskLevel === 'aggressive' ? 25 : riskLevel === 'moderate' ? 15 : 8,
      tax_treatment: category.includes('elss') ? 'elss' : 'equity',
      lock_in_period: category.includes('elss') ? 1095 : null,
      min_investment: 500,
      regulatory_tags: ['SEBI_REGULATED', 'AMFI_REGISTERED'],
      source: 'amfi',
      current_price: nav,
      yield_or_return: parseFloat(fund.returns1Y) || 0,
      sector: category,
      raw_data: fund,
      last_updated: fund.lastUpdated || new Date().toISOString(),
    };
  }

  private async fetchBonds(type: ProductType): Promise<InvestmentProduct[]> {
    const bonds = await (storage as any).getAllBonds?.()() || [];
    return bonds.slice(0, 50).map((bond: any) => this.normalizeBond(bond, type));
  }

  private normalizeBond(bond: any, type: ProductType): InvestmentProduct {
    const price = parseFloat(bond.faceValue) || 1000;
    const yieldValue = parseFloat(bond.couponRate) || 7;
    
    return {
      product_id: bond.id || bond.isin,
      product_type: type,
      name: bond.bondName || bond.name,
      issuer: bond.issuerName || bond.issuer,
      risk_level: bond.rating?.includes('AAA') ? 'conservative' : 'moderate',
      liquidity: 'low' as Liquidity,
      investment_horizon: 'long',
      expected_return_band: { min: yieldValue - 1, max: yieldValue + 2 },
      volatility_proxy: 5,
      tax_treatment: 'debt',
      lock_in_period: null,
      min_investment: price,
      regulatory_tags: ['SEBI_REGULATED'],
      source: 'nse',
      current_price: price,
      yield_or_return: yieldValue,
      sector: bond.category || 'Fixed Income',
      raw_data: bond,
      last_updated: bond.lastUpdated || new Date().toISOString(),
    };
  }

  async getProducts(type: ProductType): Promise<{ data: InvestmentProduct[]; cached: boolean; cacheAge: number }> {
    const now = Date.now();
    const config = PRODUCT_CACHE_CONFIG[type] || PRODUCT_CACHE_CONFIG.STOCK;
    const entry = this.productCache.get(type);
    
    if (entry) {
      const cacheAge = now - entry.timestamp;
      
      if (cacheAge < config.ttlMs) {
        this.metrics.hits++;
        return { data: entry.data, cached: true, cacheAge };
      }
      
      if (cacheAge < config.staleTtlMs) {
        this.metrics.hits++;
        if (!this.refreshLocks.get(type)) {
          this.refreshProductType(type).catch(err => console.warn(`[InvestmentDataCache] Stale refresh failed for ${type}: ${err?.message || err}`));
        }
        return { data: entry.data, cached: true, cacheAge };
      }
    }
    
    this.metrics.misses++;
    await this.refreshProductType(type);
    
    const refreshedEntry = this.productCache.get(type);
    if (refreshedEntry) {
      return { data: refreshedEntry.data, cached: false, cacheAge: 0 };
    }
    
    return { data: [], cached: false, cacheAge: 0 };
  }

  async getAllProducts(types?: ProductType[]): Promise<{ products: InvestmentProduct[]; stats: Record<ProductType, number> }> {
    const targetTypes = types || (['STOCK', 'MF', 'BOND'] as ProductType[]);
    const results = await Promise.allSettled(targetTypes.map(type => this.getProducts(type)));
    
    const products: InvestmentProduct[] = [];
    const stats: Record<ProductType, number> = {} as Record<ProductType, number>;
    
    results.forEach((result, index) => {
      const type = targetTypes[index];
      if (result.status === 'fulfilled') {
        products.push(...result.value.data);
        stats[type] = result.value.data.length;
      } else {
        stats[type] = 0;
      }
    });
    
    return { products, stats };
  }

  getMetrics(): CacheMetrics & { hitRate: string; totalProducts: number } {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? `${((this.metrics.hits / total) * 100).toFixed(1)}%` : 'N/A';
    const totalProducts = Object.values(this.metrics.productCounts).reduce((sum, count) => sum + count, 0);
    
    return {
      ...this.metrics,
      hitRate,
      totalProducts,
    };
  }

  invalidate(type?: ProductType): void {
    if (type) {
      this.productCache.delete(type);
    } else {
      this.productCache.clear();
    }
  }
}

export const investmentDataCache = new InvestmentDataCache();
