/**
 * Unified Stock Price Service
 * 
 * Consolidates all stock price fetching into one place with:
 * - Multi-source support (NSE, BSE)
 * - In-memory caching with configurable TTLs
 * - Batch fetching for multiple symbols
 * - Automatic fallback between sources
 * - Rate limit handling
 * - Reusable provider instances
 */

import { requestDedupeService } from './request-deduplication-service';
import { NseIndia } from 'stock-nse-india';
import yahooFinance from 'yahoo-finance2';
import axios from 'axios';

yahooFinance.suppressNotices(['yahooSurvey']);

interface StockPrice {
  symbol: string;
  price: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  high?: number;
  low?: number;
  open?: number;
  volume?: number;
  timestamp: number;
  source: 'NSE' | 'BSE' | 'YAHOO' | 'FMP' | 'CACHE';
}

interface ProviderHealth {
  consecutiveFailures: number;
  lastFailure: number;
  cooldownUntil: number;
}

interface CacheEntry {
  data: StockPrice;
  expiresAt: number;
}

interface BatchResult {
  prices: Map<string, StockPrice>;
  errors: Map<string, string>;
  fromCache: number;
  fromApi: number;
}

const CACHE_TTL = {
  REALTIME: 15 * 1000,      // 15 seconds for real-time quotes
  INTRADAY: 60 * 1000,      // 1 minute for intraday
  EOD: 6 * 60 * 60 * 1000,  // 6 hours for end-of-day
};

class UnifiedStockPriceService {
  private cache: Map<string, CacheEntry> = new Map();
  private nseClient: NseIndia;
  private providerHealth: Map<string, ProviderHealth> = new Map();
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    apiCalls: 0,
    errors: 0,
    batchRequests: 0,
  };

  constructor() {
    this.nseClient = new NseIndia();
    this.startCleanupInterval();
    console.log('✅ Unified Stock Price Service initialized');
  }

  private startCleanupInterval(): void {
    if (this.cleanupIntervalId) return;
    
    this.cleanupIntervalId = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt < now) {
          this.cache.delete(key);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        console.log(`[StockPriceCache] Cleaned ${cleaned} expired entries`);
      }
    }, 60 * 1000);
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  stop(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  private getCacheKey(symbol: string, exchange?: string): string {
    return `${symbol.toUpperCase()}:${exchange || 'ANY'}`;
  }

  private getFromCache(symbol: string, exchange?: string): StockPrice | null {
    const key = this.getCacheKey(symbol, exchange);
    const entry = this.cache.get(key);
    
    if (entry && entry.expiresAt > Date.now()) {
      this.metrics.cacheHits++;
      return { ...entry.data, source: 'CACHE' };
    }
    
    if (entry) {
      this.cache.delete(key);
    }
    
    this.metrics.cacheMisses++;
    return null;
  }

  private setCache(symbol: string, price: StockPrice, ttl: number = CACHE_TTL.REALTIME, exchange?: string): void {
    const key = this.getCacheKey(symbol, exchange);
    this.cache.set(key, {
      data: price,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Get stock price for a single symbol
   */
  async getPrice(symbol: string, exchange?: 'NSE' | 'BSE'): Promise<StockPrice | null> {
    const cached = this.getFromCache(symbol, exchange);
    if (cached) {
      return cached;
    }

    const dedupeKey = `stock_price:${symbol}:${exchange || 'ANY'}`;
    
    return requestDedupeService.dedupe(dedupeKey, async () => {
      this.metrics.apiCalls++;
      
      try {
        const price = await this.fetchFromSource(symbol, exchange);
        if (price) {
          this.setCache(symbol, price, CACHE_TTL.REALTIME, exchange);
        }
        return price;
      } catch (error: any) {
        this.metrics.errors++;
        console.error(`[StockPrice] Failed to fetch ${symbol}: ${error.message}`);
        return null;
      }
    });
  }

  /**
   * Batch fetch prices for multiple symbols
   */
  async getBatchPrices(symbols: string[], exchange?: 'NSE' | 'BSE'): Promise<BatchResult> {
    this.metrics.batchRequests++;
    
    const result: BatchResult = {
      prices: new Map(),
      errors: new Map(),
      fromCache: 0,
      fromApi: 0,
    };

    const toFetch: string[] = [];

    for (const symbol of symbols) {
      const cached = this.getFromCache(symbol, exchange);
      if (cached) {
        result.prices.set(symbol, cached);
        result.fromCache++;
      } else {
        toFetch.push(symbol);
      }
    }

    if (toFetch.length === 0) {
      return result;
    }

    console.log(`[StockPrice] Batch fetching ${toFetch.length} symbols (${result.fromCache} from cache)`);

    const batchSize = 5;
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const batch = toFetch.slice(i, i + batchSize);
      
      const promises = batch.map(async (symbol) => {
        try {
          const price = await this.getPrice(symbol, exchange);
          if (price) {
            result.prices.set(symbol, price);
            result.fromApi++;
          } else {
            result.errors.set(symbol, 'No data available');
          }
        } catch (error: any) {
          result.errors.set(symbol, error.message);
        }
      });

      await Promise.all(promises);

      if (i + batchSize < toFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return result;
  }

  private isProviderCoolingDown(provider: string): boolean {
    const health = this.providerHealth.get(provider);
    if (!health) return false;
    return Date.now() < health.cooldownUntil;
  }

  private recordSuccess(provider: string): void {
    this.providerHealth.set(provider, {
      consecutiveFailures: 0,
      lastFailure: 0,
      cooldownUntil: 0,
    });
  }

  private recordFailure(provider: string, isRateLimit: boolean = false): void {
    const health = this.providerHealth.get(provider) || { consecutiveFailures: 0, lastFailure: 0, cooldownUntil: 0 };
    health.consecutiveFailures++;
    health.lastFailure = Date.now();
    const threshold = isRateLimit ? 1 : 3;
    if (health.consecutiveFailures >= threshold) {
      const cooldownMs = isRateLimit ? 15 * 60 * 1000 : 10 * 60 * 1000;
      health.cooldownUntil = Date.now() + cooldownMs;
      console.warn(`[StockPrice] Provider ${provider} put on ${cooldownMs / 60000}-minute cooldown after ${health.consecutiveFailures} consecutive failures${isRateLimit ? ' (rate limited)' : ''}`);
    }
    this.providerHealth.set(provider, health);
  }

  private isRateLimitError(error: any): boolean {
    const msg = String(error?.message || '').toLowerCase();
    return msg.includes('too many requests') || msg.includes('429') || msg.includes('rate limit');
  }

  private async fetchFromYahoo(symbol: string): Promise<StockPrice | null> {
    try {
      const yahooSymbol = `${symbol}.NS`;
      const quote = await yahooFinance.quote(yahooSymbol);
      if (quote?.regularMarketPrice) {
        return {
          symbol,
          price: quote.regularMarketPrice,
          previousClose: quote.regularMarketPreviousClose,
          change: quote.regularMarketChange,
          changePercent: quote.regularMarketChangePercent,
          high: quote.regularMarketDayHigh,
          low: quote.regularMarketDayLow,
          open: quote.regularMarketOpen,
          volume: quote.regularMarketVolume,
          timestamp: Date.now(),
          source: 'YAHOO' as const,
        };
      }
    } catch (error: any) {
      if (this.isRateLimitError(error)) {
        this.recordFailure('yahoo', true);
        throw new Error('RATE_LIMITED:yahoo');
      }
      console.warn(`[StockPrice] Yahoo fetch failed for ${symbol}: ${error.message}`);
    }
    return null;
  }

  private async fetchFromFMP(symbol: string): Promise<StockPrice | null> {
    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) return null;
    try {
      const fmpSymbol = `${symbol}.NS`;
      const response = await axios.get(`https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(fmpSymbol)}`, {
        params: { apikey: apiKey },
        timeout: 10000,
      });
      const data = response.data?.[0];
      if (data?.price) {
        return {
          symbol,
          price: data.price,
          previousClose: data.previousClose,
          change: data.change,
          changePercent: data.changesPercentage,
          high: data.dayHigh,
          low: data.dayLow,
          open: data.open,
          volume: data.volume,
          timestamp: Date.now(),
          source: 'FMP' as const,
        };
      }
    } catch (error: any) {
      console.warn(`[StockPrice] FMP fetch failed for ${symbol}: ${error.message}`);
    }
    return null;
  }

  /**
   * Fetch from available sources with fallback
   * Priority: NSE (direct exchange) → FMP (reliable API) → BSE → Yahoo (most rate-limited, last resort)
   */
  private async fetchFromSource(symbol: string, exchange?: 'NSE' | 'BSE'): Promise<StockPrice | null> {
    if ((exchange === 'NSE' || !exchange) && !this.isProviderCoolingDown('nse')) {
      const nsePrice = await this.fetchFromNSE(symbol);
      if (nsePrice) { this.recordSuccess('nse'); return nsePrice; }
      this.recordFailure('nse');
    }

    if (!this.isProviderCoolingDown('fmp')) {
      const fmpPrice = await this.fetchFromFMP(symbol);
      if (fmpPrice) { this.recordSuccess('fmp'); return fmpPrice; }
      this.recordFailure('fmp');
    }

    if ((exchange === 'BSE' || !exchange) && !this.isProviderCoolingDown('bse')) {
      const bsePrice = await this.fetchFromBSE(symbol);
      if (bsePrice) { this.recordSuccess('bse'); return bsePrice; }
      this.recordFailure('bse');
    }

    if (!this.isProviderCoolingDown('yahoo')) {
      try {
        const yahooPrice = await this.fetchFromYahoo(symbol);
        if (yahooPrice) { this.recordSuccess('yahoo'); return yahooPrice; }
        this.recordFailure('yahoo');
      } catch (err: any) {
        if (!String(err?.message).startsWith('RATE_LIMITED:')) {
          this.recordFailure('yahoo');
        }
      }
    }

    return null;
  }

  private async fetchFromNSE(symbol: string): Promise<StockPrice | null> {
    try {
      const quote = await this.nseClient.getEquityDetails(symbol);
      
      if (quote?.priceInfo) {
        return {
          symbol,
          price: quote.priceInfo.lastPrice || 0,
          previousClose: quote.priceInfo.previousClose,
          change: quote.priceInfo.change,
          changePercent: quote.priceInfo.pChange,
          high: quote.priceInfo.intraDayHighLow?.max,
          low: quote.priceInfo.intraDayHighLow?.min,
          open: quote.priceInfo.open,
          timestamp: Date.now(),
          source: 'NSE',
        };
      }
    } catch (error: any) {
      console.warn(`[StockPrice] NSE fetch failed for ${symbol}: ${error.message}`);
    }
    return null;
  }

  private async fetchFromBSE(symbol: string): Promise<StockPrice | null> {
    try {
      const response = await axios.get(`https://api.bseindia.com/BseIndiaAPI/api/StockReachGraph/w`, {
        params: { scripcode: symbol, flag: 'P', fromdate: '', todate: '', seression: '' },
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
          'Referer': 'https://www.bseindia.com/',
        },
        timeout: 15000,
      });

      if (response.data && response.data.CurrValue) {
        return {
          symbol,
          price: parseFloat(response.data.CurrValue) || 0,
          previousClose: parseFloat(response.data.PrevClose) || undefined,
          change: parseFloat(response.data.Chg) || undefined,
          changePercent: parseFloat(response.data.ChgPer) || undefined,
          high: parseFloat(response.data.High) || undefined,
          low: parseFloat(response.data.Low) || undefined,
          open: parseFloat(response.data.Open) || undefined,
          timestamp: Date.now(),
          source: 'BSE',
        };
      }
    } catch (error: any) {
      console.warn(`[StockPrice] BSE fetch failed for ${symbol}: ${error.message}`);
    }
    return null;
  }

  /**
   * Prefetch prices for a watchlist (background operation)
   */
  async prefetchWatchlist(symbols: string[]): Promise<void> {
    console.log(`[StockPrice] Prefetching ${symbols.length} symbols...`);
    await this.getBatchPrices(symbols);
  }

  /**
   * Warm the cache with popular stocks
   */
  async warmCache(popularSymbols: string[] = ['RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICIBANK']): Promise<void> {
    console.log(`[StockPrice] Warming cache with ${popularSymbols.length} popular symbols...`);
    await this.getBatchPrices(popularSymbols);
  }

  /**
   * Get cache statistics
   */
  getMetrics() {
    const hitRate = (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
      ? ((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100).toFixed(2)
      : '0.00';

    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      hitRate: `${hitRate}%`,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      apiCalls: 0,
      errors: 0,
      batchRequests: 0,
    };
  }
}

export const unifiedStockPriceService = new UnifiedStockPriceService();
