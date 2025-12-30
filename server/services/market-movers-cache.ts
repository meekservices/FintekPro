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
  lastRefreshTime: number;
  lastRefreshDuration: number;
  yahooLatency: number;
}

const CACHE_TTL_MS = 2 * 60 * 1000;
const STALE_TTL_MS = 10 * 60 * 1000;
const CRUMB_TTL_MS = 60 * 60 * 1000;

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
    lastRefreshTime: 0,
    lastRefreshDuration: 0,
    yahooLatency: 0,
  };
  private refreshLock = false;
  private crumbInitialized = false;
  private crumbInitTime = 0;
  private isInitialized = false;

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

  private async initializeYahooCrumb(): Promise<void> {
    if (this.crumbInitialized && (Date.now() - this.crumbInitTime) < CRUMB_TTL_MS) {
      return;
    }

    try {
      console.log('🔐 [MarketMoversCache] Initializing Yahoo Finance crumb...');
      const startTime = Date.now();
      
      yahooFinance.suppressNotices(['yahooSurvey']);
      
      await yahooFinance.quote('AAPL');
      
      this.crumbInitialized = true;
      this.crumbInitTime = Date.now();
      console.log(`✅ [MarketMoversCache] Yahoo crumb initialized in ${Date.now() - startTime}ms`);
    } catch (error) {
      console.warn('⚠️ [MarketMoversCache] Failed to initialize Yahoo crumb:', error);
    }
  }

  private startBackgroundRefresh(): void {
    setInterval(async () => {
      const now = Date.now();
      const cacheAge = this.cache ? now - this.cache.timestamp : Infinity;
      
      if (cacheAge >= CACHE_TTL_MS && !this.refreshLock) {
        console.log('🔄 [MarketMoversCache] Background refresh triggered');
        await this.refreshCache();
      }
      
      if ((now - this.crumbInitTime) >= CRUMB_TTL_MS) {
        await this.initializeYahooCrumb();
      }
    }, 30000);
  }

  private async refreshCache(): Promise<void> {
    if (this.refreshLock) {
      console.log('⏳ [MarketMoversCache] Refresh already in progress, skipping');
      return;
    }

    this.refreshLock = true;
    const startTime = Date.now();

    try {
      console.log('📊 [MarketMoversCache] Fetching fresh market data...');
      
      const stockPromises = INDIAN_STOCKS.map(async (stock) => {
        try {
          const yahooStart = Date.now();
          const quote = await yahooFinance.quote(stock.symbol);
          this.metrics.yahooLatency = Date.now() - yahooStart;
          
          return {
            symbol: stock.symbol.replace('.NS', ''),
            name: stock.name,
            price: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            previousClose: quote.regularMarketPreviousClose || 0,
          };
        } catch (error) {
          return null;
        }
      });

      const stockQuotes = (await Promise.all(stockPromises)).filter((s): s is Stock => s !== null);

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

      console.log(`✅ [MarketMoversCache] Cache refreshed in ${this.metrics.lastRefreshDuration}ms`);
    } catch (error) {
      this.metrics.errors++;
      console.error('❌ [MarketMoversCache] Refresh failed:', error);
      
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
        console.log(`📦 [MarketMoversCache] Cache HIT (age: ${Math.round(cacheAge / 1000)}s)`);
        return { data: this.cache.data, cached: true, cacheAge };
      }

      if (cacheAge < STALE_TTL_MS) {
        this.metrics.hits++;
        console.log(`📦 [MarketMoversCache] Serving stale cache (age: ${Math.round(cacheAge / 1000)}s), triggering background refresh`);
        
        if (!this.refreshLock) {
          this.refreshCache().catch(console.error);
        }
        
        return { data: this.cache.data, cached: true, cacheAge };
      }
    }

    this.metrics.misses++;
    
    // Non-blocking: Return fallback data immediately if not initialized
    // This prevents blocking the first request while Yahoo Finance initializes
    if (!this.isInitialized) {
      console.log('📌 [MarketMoversCache] Not initialized yet, returning fallback data immediately');
      // Trigger background refresh if not already in progress
      if (!this.refreshLock) {
        this.refreshCache().catch(console.error);
      }
      return { data: FALLBACK_DATA, cached: false, cacheAge: 0 };
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

  getMetrics(): CacheMetrics & { cacheAge: number | null; hitRate: string } {
    const cacheAge = this.cache ? Date.now() - this.cache.timestamp : null;
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? `${((this.metrics.hits / total) * 100).toFixed(1)}%` : 'N/A';
    
    return {
      ...this.metrics,
      cacheAge,
      hitRate,
    };
  }
}

export const marketMoversCache = new MarketMoversCache();
