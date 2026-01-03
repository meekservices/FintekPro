import yahooFinance from 'yahoo-finance2';

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
}

interface MarketMoversData {
  gainers: Stock[];
  losers: Stock[];
}

interface CacheEntry {
  data: MarketMoversData;
  timestamp: number;
  isRefreshing: boolean;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  refreshes: number;
  errors: number;
  rateLimitErrors: number;
  lastRefreshTime: number;
  lastRefreshDuration: number;
  yahooLatency: number;
  backoffUntil: number;
}

// Increased TTLs to reduce API calls and prevent rate limiting
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (was 2 minutes)
const STALE_TTL_MS = 30 * 60 * 1000; // 30 minutes (was 10 minutes)
const CRUMB_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours (was 1 hour)
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes (was 30 seconds)

// Exponential backoff settings for rate limiting
const INITIAL_BACKOFF_MS = 60 * 1000; // Start with 1 minute
const MAX_BACKOFF_MS = 30 * 60 * 1000; // Max 30 minutes
const BACKOFF_MULTIPLIER = 2;

const INDIAN_STOCKS = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank Limited" },
  { symbol: "INFY.NS", name: "Infosys Limited" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank Limited" },
  { symbol: "BAJFINANCE.NS", name: "Bajaj Finance Limited" },
  { symbol: "MARUTI.NS", name: "Maruti Suzuki India" },
  { symbol: "ASIANPAINT.NS", name: "Asian Paints Limited" },
  { symbol: "NESTLEIND.NS", name: "Nestle India Limited" },
  { symbol: "ULTRACEMCO.NS", name: "UltraTech Cement" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever" },
  { symbol: "LT.NS", name: "Larsen & Toubro" },
  { symbol: "WIPRO.NS", name: "Wipro Limited" },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel" },
  { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank" },
];

const FALLBACK_DATA: MarketMoversData = {
  gainers: [
    { symbol: "RELIANCE", name: "Reliance Industries", price: 2847.65, change: 89.45, changePercent: 3.24, previousClose: 2758.20 },
    { symbol: "TCS", name: "Tata Consultancy Services", price: 4156.30, change: 116.20, changePercent: 2.87, previousClose: 4040.10 },
    { symbol: "HDFCBANK", name: "HDFC Bank Limited", price: 1743.85, change: 33.35, changePercent: 1.95, previousClose: 1710.50 },
    { symbol: "INFY", name: "Infosys Limited", price: 1856.40, change: 28.90, changePercent: 1.58, previousClose: 1827.50 },
    { symbol: "ICICIBANK", name: "ICICI Bank Limited", price: 1287.55, change: 18.75, changePercent: 1.48, previousClose: 1268.80 },
  ],
  losers: [
    { symbol: "BAJFINANCE", name: "Bajaj Finance Limited", price: 6789.25, change: -156.30, changePercent: -2.26, previousClose: 6945.55 },
    { symbol: "MARUTI", name: "Maruti Suzuki India", price: 11245.80, change: -198.65, changePercent: -1.74, previousClose: 11444.45 },
    { symbol: "ASIANPAINT", name: "Asian Paints Limited", price: 2943.15, change: -48.90, changePercent: -1.63, previousClose: 2992.05 },
    { symbol: "NESTLEIND", name: "Nestle India Limited", price: 24567.35, change: -389.25, changePercent: -1.56, previousClose: 24956.60 },
    { symbol: "ULTRACEMCO", name: "UltraTech Cement", price: 10876.40, change: -156.85, changePercent: -1.42, previousClose: 11033.25 },
  ],
};

class MarketMoversCache {
  private cache: CacheEntry | null = null;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    refreshes: 0,
    errors: 0,
    rateLimitErrors: 0,
    lastRefreshTime: 0,
    lastRefreshDuration: 0,
    yahooLatency: 0,
    backoffUntil: 0,
  };
  private refreshLock = false;
  private crumbInitialized = false;
  private crumbInitTime = 0;
  private isInitialized = false;
  private currentBackoff = INITIAL_BACKOFF_MS;

  async initialize(): Promise<void> {
    console.log('📈 [MarketMoversCache] Starting background initialization...');
    // Non-blocking initialization - start background tasks without awaiting
    this.initializeInBackground().catch(err => 
      console.error('❌ [MarketMoversCache] Background initialization failed:', err)
    );
    this.startBackgroundRefresh();
    console.log('✅ [MarketMoversCache] Background initialization started (non-blocking)');
  }

  private async initializeInBackground(): Promise<void> {
    await this.initializeYahooCrumb();
    await this.refreshCache();
    this.isInitialized = true;
    console.log('✅ [MarketMoversCache] Background initialization completed');
  }

  private isRateLimited(): boolean {
    return Date.now() < this.metrics.backoffUntil;
  }

  private applyBackoff(): void {
    this.metrics.backoffUntil = Date.now() + this.currentBackoff;
    console.log(`⏸️ [MarketMoversCache] Rate limited, backing off for ${Math.round(this.currentBackoff / 1000)}s`);
    // Increase backoff for next time (exponential)
    this.currentBackoff = Math.min(this.currentBackoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
  }

  private resetBackoff(): void {
    this.currentBackoff = INITIAL_BACKOFF_MS;
    this.metrics.backoffUntil = 0;
  }

  private isRateLimitError(error: any): boolean {
    const errorString = String(error);
    return errorString.includes('Too Many Requests') || 
           errorString.includes('429') ||
           errorString.includes('rate limit');
  }

  private async initializeYahooCrumb(): Promise<void> {
    if (this.crumbInitialized && (Date.now() - this.crumbInitTime) < CRUMB_TTL_MS) {
      return;
    }

    // Skip if rate limited
    if (this.isRateLimited()) {
      console.log('⏸️ [MarketMoversCache] Skipping crumb init - rate limited');
      return;
    }

    try {
      console.log('🔐 [MarketMoversCache] Initializing Yahoo Finance crumb...');
      const startTime = Date.now();
      
      yahooFinance.suppressNotices(['yahooSurvey']);
      
      await yahooFinance.quote('AAPL');
      
      this.crumbInitialized = true;
      this.crumbInitTime = Date.now();
      this.resetBackoff(); // Success - reset backoff
      console.log(`✅ [MarketMoversCache] Yahoo crumb initialized in ${Date.now() - startTime}ms`);
    } catch (error) {
      if (this.isRateLimitError(error)) {
        this.metrics.rateLimitErrors++;
        this.applyBackoff();
      }
      console.warn('⚠️ [MarketMoversCache] Failed to initialize Yahoo crumb:', error);
    }
  }

  private startBackgroundRefresh(): void {
    setInterval(async () => {
      // Skip if rate limited
      if (this.isRateLimited()) {
        const remainingMs = this.metrics.backoffUntil - Date.now();
        console.log(`⏸️ [MarketMoversCache] Skipping refresh - rate limited for ${Math.round(remainingMs / 1000)}s more`);
        return;
      }

      const now = Date.now();
      const cacheAge = this.cache ? now - this.cache.timestamp : Infinity;
      
      if (cacheAge >= CACHE_TTL_MS && !this.refreshLock) {
        console.log('🔄 [MarketMoversCache] Background refresh triggered');
        await this.refreshCache();
      }
      
      if ((now - this.crumbInitTime) >= CRUMB_TTL_MS) {
        await this.initializeYahooCrumb();
      }
    }, REFRESH_INTERVAL_MS);
  }

  private async refreshCache(): Promise<void> {
    if (this.refreshLock) {
      console.log('⏳ [MarketMoversCache] Refresh already in progress, skipping');
      return;
    }

    // Skip if rate limited
    if (this.isRateLimited()) {
      console.log('⏸️ [MarketMoversCache] Skipping refresh - rate limited');
      return;
    }

    this.refreshLock = true;
    const startTime = Date.now();

    try {
      console.log('📊 [MarketMoversCache] Fetching fresh market data...');
      
      // Fetch stocks sequentially with delay to avoid rate limiting
      const stockQuotes: Stock[] = [];
      
      for (const stock of INDIAN_STOCKS) {
        try {
          const yahooStart = Date.now();
          const quote = await yahooFinance.quote(stock.symbol);
          this.metrics.yahooLatency = Date.now() - yahooStart;
          
          stockQuotes.push({
            symbol: stock.symbol.replace('.NS', ''),
            name: stock.name,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            previousClose: quote.regularMarketPreviousClose || 0,
          });
          
          // Small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          if (this.isRateLimitError(error)) {
            this.metrics.rateLimitErrors++;
            this.applyBackoff();
            throw error; // Stop fetching more stocks
          }
          // Continue with other stocks for non-rate-limit errors
        }
      }

      if (stockQuotes.length === 0) {
        throw new Error('No stock data fetched');
      }

      const gainers = stockQuotes
        .filter(stock => stock.changePercent > 0)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 5);

      const losers = stockQuotes
        .filter(stock => stock.changePercent < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, 5);

      this.cache = {
        data: { gainers, losers },
        timestamp: Date.now(),
        isRefreshing: false,
      };

      this.metrics.refreshes++;
      this.metrics.lastRefreshTime = Date.now();
      this.metrics.lastRefreshDuration = Date.now() - startTime;
      this.resetBackoff(); // Success - reset backoff

      console.log(`✅ [MarketMoversCache] Cache refreshed in ${this.metrics.lastRefreshDuration}ms (${stockQuotes.length} stocks)`);
    } catch (error) {
      this.metrics.errors++;
      
      if (this.isRateLimitError(error)) {
        console.warn('⚠️ [MarketMoversCache] Rate limited by Yahoo Finance');
      } else {
        console.error('❌ [MarketMoversCache] Refresh failed:', error);
      }
      
      if (!this.cache) {
        this.cache = {
          data: FALLBACK_DATA,
          timestamp: Date.now(),
          isRefreshing: false,
        };
        console.log('📌 [MarketMoversCache] Using fallback data');
      }
    } finally {
      this.refreshLock = false;
    }
  }

  async getMarketMovers(): Promise<{ data: MarketMoversData; cached: boolean; cacheAge: number }> {
    const now = Date.now();

    if (this.cache) {
      const cacheAge = now - this.cache.timestamp;
      
      if (cacheAge < CACHE_TTL_MS) {
        this.metrics.hits++;
        return { data: this.cache.data, cached: true, cacheAge };
      }

      if (cacheAge < STALE_TTL_MS) {
        this.metrics.hits++;
        console.log(`📦 [MarketMoversCache] Serving stale cache (age: ${Math.round(cacheAge / 1000)}s)`);
        
        // Only trigger background refresh if not rate limited
        if (!this.refreshLock && !this.isRateLimited()) {
          this.refreshCache().catch(console.error);
        }
        
        return { data: this.cache.data, cached: true, cacheAge };
      }
    }

    this.metrics.misses++;
    
    // Non-blocking: Return fallback data immediately if not initialized or rate limited
    if (!this.isInitialized || this.isRateLimited()) {
      console.log('📌 [MarketMoversCache] Returning fallback data (not initialized or rate limited)');
      if (!this.refreshLock && !this.isRateLimited()) {
        this.refreshCache().catch(console.error);
      }
      return { data: this.cache?.data || FALLBACK_DATA, cached: false, cacheAge: 0 };
    }

    console.log('🔍 [MarketMoversCache] Cache MISS, fetching fresh data...');

    if (!this.refreshLock) {
      await this.refreshCache();
    } else {
      while (this.refreshLock) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    if (this.cache) {
      return { data: this.cache.data, cached: false, cacheAge: 0 };
    }

    return { data: FALLBACK_DATA, cached: false, cacheAge: 0 };
  }

  getMetrics(): CacheMetrics & { cacheAge: number | null; hitRate: string; isRateLimited: boolean; backoffRemaining: number } {
    const cacheAge = this.cache ? Date.now() - this.cache.timestamp : null;
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? `${((this.metrics.hits / total) * 100).toFixed(1)}%` : 'N/A';
    const backoffRemaining = Math.max(0, this.metrics.backoffUntil - Date.now());
    
    return {
      ...this.metrics,
      cacheAge,
      hitRate,
      isRateLimited: this.isRateLimited(),
      backoffRemaining,
    };
  }
}

export const marketMoversCache = new MarketMoversCache();
