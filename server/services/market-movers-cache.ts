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

interface ProviderMetrics {
  successCount: number;
  failureCount: number;
  lastSuccess: number;
  lastFailure: number;
  lastLatency: number;
  rateLimitErrors: number;
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
  providers: {
    yahoo: ProviderMetrics;
    finnhub: ProviderMetrics;
    nse: ProviderMetrics;
  };
  lastSuccessfulProvider: string | null;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_TTL_MS = 60 * 60 * 1000;
const CRUMB_TTL_MS = 4 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const INITIAL_BACKOFF_MS = 5 * 60 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
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

class FinnhubProvider {
  private apiKey: string | null = null;
  private isAvailable: boolean = false;
  private readonly baseUrl = 'https://finnhub.io/api/v1';

  constructor() {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (apiKey && apiKey.length > 0) {
      this.apiKey = apiKey;
      this.isAvailable = true;
      console.log('✅ [FinnhubProvider] Initialized successfully (API key length:', apiKey.length + ')');
    } else {
      console.log('ℹ️ [FinnhubProvider] FINNHUB_API_KEY not set - Finnhub fallback disabled');
      this.isAvailable = false;
    }
  }

  isEnabled(): boolean {
    return this.isAvailable;
  }

  async getQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number; previousClose: number } | null> {
    if (!this.isAvailable || !this.apiKey) {
      return null;
    }

    try {
      const url = `${this.baseUrl}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Finnhub rate limit exceeded');
        }
        return null;
      }

      const data = await response.json();
      
      if (!data || data.c === 0 || data.c === undefined) {
        return null;
      }

      return {
        price: data.c || 0,
        change: data.d || 0,
        changePercent: data.dp || 0,
        previousClose: data.pc || 0,
      };
    } catch (error) {
      console.warn(`⚠️ [FinnhubProvider] Quote fetch error for ${symbol}:`, error);
      throw error;
    }
  }

  async fetchAllStocks(stocks: typeof INDIAN_STOCKS): Promise<Stock[]> {
    if (!this.isAvailable) {
      throw new Error('Finnhub provider not available');
    }

    const stockQuotes: Stock[] = [];

    for (const stock of stocks) {
      try {
        const nseSymbol = stock.symbol.replace('.NS', '');
        const quote = await this.getQuote(nseSymbol);
        if (quote && quote.price > 0) {
          stockQuotes.push({
            symbol: nseSymbol,
            name: stock.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            previousClose: quote.previousClose,
          });
        }
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        const errorStr = String(error);
        if (errorStr.includes('rate limit') || errorStr.includes('429')) {
          throw error;
        }
        console.warn(`⚠️ [FinnhubProvider] Failed to fetch ${stock.symbol}:`, error);
      }
    }

    if (stockQuotes.length === 0) {
      throw new Error('No stock data fetched from Finnhub');
    }

    return stockQuotes;
  }
}

class NseIndiaProvider {
  private readonly baseUrl = 'https://www.nseindia.com/api';
  private cookies: string = '';
  private cookiesExpiry: number = 0;
  private isAvailable: boolean = true;

  constructor() {
    console.log('✅ [NseIndiaProvider] Initialized (NSE India API fallback)');
  }

  isEnabled(): boolean {
    return this.isAvailable;
  }

  private async refreshCookies(): Promise<void> {
    if (Date.now() < this.cookiesExpiry) {
      return;
    }

    try {
      const response = await fetch('https://www.nseindia.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      const setCookieHeaders = response.headers.get('set-cookie');
      if (setCookieHeaders) {
        this.cookies = setCookieHeaders.split(',').map(c => c.split(';')[0]).join('; ');
        this.cookiesExpiry = Date.now() + 5 * 60 * 1000;
      }
    } catch (error) {
      console.warn('⚠️ [NseIndiaProvider] Failed to refresh cookies:', error);
    }
  }

  async fetchMarketMovers(): Promise<Stock[]> {
    try {
      await this.refreshCookies();

      const response = await fetch(`${this.baseUrl}/live-analysis-variations?index=gainers`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cookie': this.cookies,
          'Referer': 'https://www.nseindia.com/market-data/live-market-indices',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('NSE rate limit exceeded');
        }
        throw new Error(`NSE API error: ${response.status}`);
      }

      const data = await response.json();
      const stockQuotes: Stock[] = [];

      if (data?.NIFTY?.data) {
        for (const item of data.NIFTY.data.slice(0, 15)) {
          stockQuotes.push({
            symbol: item.symbol || '',
            name: item.symbol || '',
            price: parseFloat(item.ltp) || 0,
            change: parseFloat(item.netPrice) || 0,
            changePercent: parseFloat(item.perChange) || 0,
            previousClose: parseFloat(item.previousClose) || (parseFloat(item.ltp) - parseFloat(item.netPrice)) || 0,
          });
        }
      }

      if (stockQuotes.length === 0) {
        throw new Error('No stock data from NSE API');
      }

      return stockQuotes;
    } catch (error) {
      console.warn('⚠️ [NseIndiaProvider] Fetch error:', error);
      throw error;
    }
  }
}

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
    providers: {
      yahoo: {
        successCount: 0,
        failureCount: 0,
        lastSuccess: 0,
        lastFailure: 0,
        lastLatency: 0,
        rateLimitErrors: 0,
      },
      finnhub: {
        successCount: 0,
        failureCount: 0,
        lastSuccess: 0,
        lastFailure: 0,
        lastLatency: 0,
        rateLimitErrors: 0,
      },
      nse: {
        successCount: 0,
        failureCount: 0,
        lastSuccess: 0,
        lastFailure: 0,
        lastLatency: 0,
        rateLimitErrors: 0,
      },
    },
    lastSuccessfulProvider: null,
  };
  private refreshLock = false;
  private crumbInitialized = false;
  private crumbInitTime = 0;
  private isInitialized = false;
  private currentBackoff = INITIAL_BACKOFF_MS;
  private finnhubProvider: FinnhubProvider;
  private nseProvider: NseIndiaProvider;
  private yahooRateLimited = false;

  constructor() {
    this.finnhubProvider = new FinnhubProvider();
    this.nseProvider = new NseIndiaProvider();
  }

  async initialize(): Promise<void> {
    console.log('📈 [MarketMoversCache] Starting background initialization...');
    this.initializeInBackground().catch(err => 
      console.error('❌ [MarketMoversCache] Background initialization failed:', err)
    );
    this.startBackgroundRefresh();
    console.log('✅ [MarketMoversCache] Background initialization started (non-blocking)');
  }

  private async initializeInBackground(): Promise<void> {
    // Try to refresh cache immediately with NSE (primary) - don't wait for Yahoo crumb
    await this.refreshCache();
    this.isInitialized = true;
    console.log('✅ [MarketMoversCache] Background initialization completed');
    
    // Initialize Yahoo crumb in background for fallback use
    this.initializeYahooCrumb().catch(err => 
      console.warn('⚠️ [MarketMoversCache] Yahoo crumb init failed (will use NSE):', err)
    );
  }

  private isRateLimited(): boolean {
    return Date.now() < this.metrics.backoffUntil;
  }

  private applyBackoff(): void {
    this.metrics.backoffUntil = Date.now() + this.currentBackoff;
    console.log(`⏸️ [MarketMoversCache] Rate limited, backing off for ${Math.round(this.currentBackoff / 1000)}s`);
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
      this.yahooRateLimited = false;
      this.resetBackoff();
      console.log(`✅ [MarketMoversCache] Yahoo crumb initialized in ${Date.now() - startTime}ms`);
    } catch (error) {
      if (this.isRateLimitError(error)) {
        this.metrics.rateLimitErrors++;
        this.metrics.providers.yahoo.rateLimitErrors++;
        this.yahooRateLimited = true;
        this.applyBackoff();
      }
      console.warn('⚠️ [MarketMoversCache] Failed to initialize Yahoo crumb:', error);
    }
  }

  private startBackgroundRefresh(): void {
    setInterval(async () => {
      const hasFallback = this.finnhubProvider.isEnabled() || this.nseProvider.isEnabled();
      if (this.isRateLimited() && !hasFallback) {
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

  private async fetchFromYahoo(): Promise<Stock[]> {
    const startTime = Date.now();
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
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        if (this.isRateLimitError(error)) {
          this.metrics.providers.yahoo.rateLimitErrors++;
          this.yahooRateLimited = true;
          throw error;
        }
      }
    }

    if (stockQuotes.length === 0) {
      throw new Error('No stock data fetched from Yahoo');
    }

    this.metrics.providers.yahoo.lastLatency = Date.now() - startTime;
    this.metrics.providers.yahoo.successCount++;
    this.metrics.providers.yahoo.lastSuccess = Date.now();
    this.yahooRateLimited = false;
    
    return stockQuotes;
  }

  private async fetchFromFinnhub(): Promise<Stock[]> {
    if (!this.finnhubProvider.isEnabled()) {
      throw new Error('Finnhub provider not available');
    }

    const startTime = Date.now();
    const stockQuotes = await this.finnhubProvider.fetchAllStocks(INDIAN_STOCKS);
    
    this.metrics.providers.finnhub.lastLatency = Date.now() - startTime;
    this.metrics.providers.finnhub.successCount++;
    this.metrics.providers.finnhub.lastSuccess = Date.now();
    
    return stockQuotes;
  }

  private async fetchFromNse(): Promise<Stock[]> {
    if (!this.nseProvider.isEnabled()) {
      throw new Error('NSE provider not available');
    }

    const startTime = Date.now();
    const stockQuotes = await this.nseProvider.fetchMarketMovers();
    
    this.metrics.providers.nse.lastLatency = Date.now() - startTime;
    this.metrics.providers.nse.successCount++;
    this.metrics.providers.nse.lastSuccess = Date.now();
    
    return stockQuotes;
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
      
      let stockQuotes: Stock[] = [];
      let successProvider: string | null = null;

      // Priority 1: NSE India (primary for Indian stocks - free and reliable)
      if (this.nseProvider.isEnabled()) {
        try {
          console.log('🔄 [MarketMoversCache] Trying NSE India (primary)...');
          stockQuotes = await this.fetchFromNse();
          successProvider = 'nse';
          console.log(`✅ [MarketMoversCache] NSE India succeeded with ${stockQuotes.length} stocks`);
        } catch (nseError) {
          console.warn('⚠️ [MarketMoversCache] NSE India failed:', nseError);
          this.metrics.providers.nse.failureCount++;
          this.metrics.providers.nse.lastFailure = Date.now();
        }
      }

      // Priority 2: Yahoo Finance (secondary - may be rate limited)
      if (stockQuotes.length === 0 && !this.yahooRateLimited && !this.isRateLimited()) {
        try {
          console.log('🔄 [MarketMoversCache] Trying Yahoo Finance fallback...');
          stockQuotes = await this.fetchFromYahoo();
          successProvider = 'yahoo';
          console.log(`✅ [MarketMoversCache] Yahoo Finance succeeded with ${stockQuotes.length} stocks`);
        } catch (yahooError) {
          console.warn('⚠️ [MarketMoversCache] Yahoo Finance failed:', yahooError);
          this.metrics.providers.yahoo.failureCount++;
          this.metrics.providers.yahoo.lastFailure = Date.now();
          
          if (this.isRateLimitError(yahooError)) {
            this.metrics.rateLimitErrors++;
            this.yahooRateLimited = true;
            this.applyBackoff();
          }
        }
      } else if (stockQuotes.length === 0) {
        console.log('⏸️ [MarketMoversCache] Skipping Yahoo Finance (rate limited)');
      }

      // Priority 3: Finnhub (tertiary - limited Indian stock coverage on free tier)
      if (stockQuotes.length === 0 && this.finnhubProvider.isEnabled()) {
        try {
          console.log('🔄 [MarketMoversCache] Trying Finnhub fallback...');
          stockQuotes = await this.fetchFromFinnhub();
          successProvider = 'finnhub';
          console.log(`✅ [MarketMoversCache] Finnhub succeeded with ${stockQuotes.length} stocks`);
        } catch (finnhubError) {
          console.warn('⚠️ [MarketMoversCache] Finnhub fallback failed:', finnhubError);
          this.metrics.providers.finnhub.failureCount++;
          this.metrics.providers.finnhub.lastFailure = Date.now();
        }
      }

      if (stockQuotes.length === 0) {
        throw new Error('All providers failed to fetch stock data');
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
      this.metrics.lastSuccessfulProvider = successProvider;

      if (successProvider === 'yahoo') {
        this.resetBackoff();
      }

      console.log(`✅ [MarketMoversCache] Cache refreshed in ${this.metrics.lastRefreshDuration}ms via ${successProvider} (${stockQuotes.length} stocks)`);
    } catch (error) {
      this.metrics.errors++;
      
      if (this.isRateLimitError(error)) {
        console.warn('⚠️ [MarketMoversCache] Rate limited by all providers');
      } else {
        console.error('❌ [MarketMoversCache] Refresh failed:', error);
      }
      
      if (!this.cache) {
        this.cache = {
          data: FALLBACK_DATA,
          timestamp: Date.now(),
          isRefreshing: false,
        };
        this.metrics.lastSuccessfulProvider = 'static_fallback';
        console.log('📌 [MarketMoversCache] Using fallback data');
      }
    } finally {
      this.refreshLock = false;
    }
  }

  async getMarketMovers(): Promise<{ data: MarketMoversData; cached: boolean; cacheAge: number; provider: string | null }> {
    const now = Date.now();

    if (this.cache) {
      const cacheAge = now - this.cache.timestamp;
      
      if (cacheAge < CACHE_TTL_MS) {
        this.metrics.hits++;
        return { 
          data: this.cache.data, 
          cached: true, 
          cacheAge,
          provider: this.metrics.lastSuccessfulProvider
        };
      }

      if (cacheAge < STALE_TTL_MS) {
        this.metrics.hits++;
        console.log(`📦 [MarketMoversCache] Serving stale cache (age: ${Math.round(cacheAge / 1000)}s)`);
        
        const canRefreshYahoo = !this.refreshLock && !this.isRateLimited();
        const canRefreshFinnhub = !this.refreshLock && this.finnhubProvider.isEnabled();
        const canRefreshNse = !this.refreshLock && this.nseProvider.isEnabled();
        
        if (canRefreshYahoo || canRefreshFinnhub || canRefreshNse) {
          this.refreshCache().catch(console.error);
        }
        
        return { 
          data: this.cache.data, 
          cached: true, 
          cacheAge,
          provider: this.metrics.lastSuccessfulProvider
        };
      }
    }

    this.metrics.misses++;
    
    const hasFallback = this.finnhubProvider.isEnabled() || this.nseProvider.isEnabled();
    const cannotFetch = (!this.isInitialized || this.isRateLimited()) && !hasFallback;
    if (cannotFetch) {
      console.log('📌 [MarketMoversCache] Returning fallback data (not initialized or all providers unavailable)');
      if (!this.refreshLock) {
        this.refreshCache().catch(console.error);
      }
      return { 
        data: this.cache?.data || FALLBACK_DATA, 
        cached: false, 
        cacheAge: 0,
        provider: this.cache ? this.metrics.lastSuccessfulProvider : 'static_fallback'
      };
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
      return { 
        data: this.cache.data, 
        cached: false, 
        cacheAge: 0,
        provider: this.metrics.lastSuccessfulProvider
      };
    }

    return { 
      data: FALLBACK_DATA, 
      cached: false, 
      cacheAge: 0,
      provider: 'static_fallback'
    };
  }

  getMetrics(): CacheMetrics & { 
    cacheAge: number | null; 
    hitRate: string; 
    isRateLimited: boolean; 
    backoffRemaining: number;
    finnhubEnabled: boolean;
    nseEnabled: boolean;
    yahooRateLimited: boolean;
  } {
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
      finnhubEnabled: this.finnhubProvider.isEnabled(),
      nseEnabled: this.nseProvider.isEnabled(),
      yahooRateLimited: this.yahooRateLimited,
    };
  }
}

export const marketMoversCache = new MarketMoversCache();
