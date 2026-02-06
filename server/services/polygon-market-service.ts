import axios from "axios";

const POLYGON_BASE_URL = "https://api.polygon.io";
const CACHE_TTL_MS = 60000;

interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

interface StockDetails {
  symbol: string;
  name: string;
  market: string;
  locale: string;
  primaryExchange: string;
  type: string;
  currency: string;
  marketCap?: number;
  description?: string;
  sic_code?: string;
  sic_description?: string;
  homepage_url?: string;
  total_employees?: number;
  list_date?: string;
  logo_url?: string;
}

interface ETFInfo {
  symbol: string;
  name: string;
  expenseRatio?: number;
  aum?: number;
  holdings?: number;
  category?: string;
}

interface PriceCache {
  data: StockQuote;
  cachedAt: number;
}

class PolygonMarketService {
  private apiKey: string;
  private priceCache: Map<string, PriceCache> = new Map();
  private detailsCache: Map<string, StockDetails> = new Map();

  constructor() {
    this.apiKey = process.env.POLYGON_API_KEY || "";
  }

  private isConfigured(): boolean {
    return !!this.apiKey;
  }

  private getCacheKey(symbol: string): string {
    return symbol.toUpperCase();
  }

  private isCacheValid(cachedAt: number): boolean {
    return Date.now() - cachedAt < CACHE_TTL_MS;
  }

  async getQuote(symbol: string): Promise<StockQuote | null> {
    const cacheKey = this.getCacheKey(symbol);
    const cached = this.priceCache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.cachedAt)) {
      return cached.data;
    }

    if (!this.isConfigured()) {
      throw new Error('Polygon API key not configured. Set POLYGON_API_KEY for US market data.');
    }

    try {
      const response = await axios.get(
        `${POLYGON_BASE_URL}/v2/aggs/ticker/${symbol}/prev`,
        {
          params: { apiKey: this.apiKey },
          timeout: 5000,
        }
      );

      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        const quote: StockQuote = {
          symbol: symbol.toUpperCase(),
          price: result.c,
          change: result.c - result.o,
          changePercent: ((result.c - result.o) / result.o) * 100,
          open: result.o,
          high: result.h,
          low: result.l,
          close: result.c,
          volume: result.v,
          timestamp: result.t,
        };

        this.priceCache.set(cacheKey, { data: quote, cachedAt: Date.now() });
        return quote;
      }
      return null;
    } catch (error: any) {
      console.error(`Polygon quote error for ${symbol}:`, error.message);
      throw new Error(`Polygon API call failed for ${symbol}: ${error.message}`);
    }
  }

  async getMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const results = new Map<string, StockQuote>();
    const uncachedSymbols: string[] = [];
    
    for (const symbol of symbols) {
      const cacheKey = this.getCacheKey(symbol);
      const cached = this.priceCache.get(cacheKey);
      if (cached && this.isCacheValid(cached.cachedAt)) {
        results.set(symbol.toUpperCase(), cached.data);
      } else {
        uncachedSymbols.push(symbol.toUpperCase());
      }
    }

    if (uncachedSymbols.length === 0) {
      return results;
    }

    if (!this.isConfigured()) {
      throw new Error('Polygon API key not configured. Set POLYGON_API_KEY for US market data.');
    }

    try {
      const tickerList = uncachedSymbols.join(",");
      const response = await axios.get(
        `${POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers`,
        {
          params: { 
            apiKey: this.apiKey,
            tickers: tickerList,
          },
          timeout: 10000,
        }
      );

      if (response.data.tickers) {
        for (const ticker of response.data.tickers) {
          const quote: StockQuote = {
            symbol: ticker.ticker,
            price: ticker.day?.c || ticker.prevDay?.c || 0,
            change: ticker.todaysChange || 0,
            changePercent: ticker.todaysChangePerc || 0,
            open: ticker.day?.o || ticker.prevDay?.o || 0,
            high: ticker.day?.h || ticker.prevDay?.h || 0,
            low: ticker.day?.l || ticker.prevDay?.l || 0,
            close: ticker.day?.c || ticker.prevDay?.c || 0,
            volume: ticker.day?.v || ticker.prevDay?.v || 0,
            timestamp: ticker.updated || Date.now(),
          };
          
          this.priceCache.set(ticker.ticker, { data: quote, cachedAt: Date.now() });
          results.set(ticker.ticker, quote);
        }
      }
      
      return results;
    } catch (error: any) {
      console.error(`Polygon batch quote error:`, error.message);
      throw new Error(`Polygon API batch quote call failed: ${error.message}`);
    }
  }

  async getStockDetails(symbol: string): Promise<StockDetails | null> {
    const cacheKey = this.getCacheKey(symbol);
    const cached = this.detailsCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConfigured()) {
      throw new Error('Polygon API key not configured. Set POLYGON_API_KEY for US market data.');
    }

    try {
      const response = await axios.get(
        `${POLYGON_BASE_URL}/v3/reference/tickers/${symbol}`,
        {
          params: { apiKey: this.apiKey },
          timeout: 5000,
        }
      );

      if (response.data.results) {
        const result = response.data.results;
        const details: StockDetails = {
          symbol: result.ticker,
          name: result.name,
          market: result.market,
          locale: result.locale,
          primaryExchange: result.primary_exchange,
          type: result.type,
          currency: result.currency_name,
          marketCap: result.market_cap,
          description: result.description,
          sic_code: result.sic_code,
          sic_description: result.sic_description,
          homepage_url: result.homepage_url,
          total_employees: result.total_employees,
          list_date: result.list_date,
          logo_url: result.branding?.logo_url,
        };

        this.detailsCache.set(cacheKey, details);
        return details;
      }
      return null;
    } catch (error: any) {
      console.error(`Polygon details error for ${symbol}:`, error.message);
      throw new Error(`Polygon API call failed for ${symbol} details: ${error.message}`);
    }
  }

  async searchSymbols(query: string, limit = 10): Promise<StockDetails[]> {
    if (!this.isConfigured()) {
      throw new Error('Polygon API key not configured. Set POLYGON_API_KEY for US market data.');
    }

    try {
      const response = await axios.get(
        `${POLYGON_BASE_URL}/v3/reference/tickers`,
        {
          params: {
            apiKey: this.apiKey,
            search: query,
            active: true,
            market: "stocks",
            limit,
          },
          timeout: 5000,
        }
      );

      return response.data.results?.map((r: any) => ({
        symbol: r.ticker,
        name: r.name,
        market: r.market,
        locale: r.locale,
        primaryExchange: r.primary_exchange,
        type: r.type,
        currency: r.currency_name,
      })) || [];
    } catch (error: any) {
      console.error(`Polygon search error:`, error.message);
      throw new Error(`Polygon API search call failed: ${error.message}`);
    }
  }

  async getSP500Constituents(): Promise<string[]> {
    return [
      "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "META", "TSLA", "BRK.B", "UNH", "JNJ",
      "XOM", "JPM", "V", "PG", "MA", "HD", "CVX", "MRK", "ABBV", "LLY",
      "PEP", "KO", "AVGO", "COST", "MCD", "WMT", "TMO", "ACN", "CSCO", "DHR",
    ];
  }

  async getPopularStocks(): Promise<(StockDetails & { price?: number; change?: number; changePercent?: number })[]> {
    const popularSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "JNJ"];
    
    const [quotes, ...detailsPromises] = await Promise.all([
      this.getMultipleQuotes(popularSymbols),
      ...popularSymbols.map(s => this.getStockDetails(s))
    ]);

    return popularSymbols.map((symbol, idx) => {
      const details = detailsPromises[idx] || { symbol, name: symbol, market: 'stocks', locale: 'us', primaryExchange: 'UNKNOWN', type: 'CS', currency: 'USD' };
      const quote = quotes.get(symbol);
      return {
        ...details,
        price: quote?.price,
        change: quote?.change,
        changePercent: quote?.changePercent,
      };
    });
  }

  async getPopularETFs(): Promise<ETFInfo[]> {
    const etfs: ETFInfo[] = [
      { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", category: "Large Cap Blend", expenseRatio: 0.0945 },
      { symbol: "QQQ", name: "Invesco QQQ Trust", category: "Large Cap Growth", expenseRatio: 0.20 },
      { symbol: "VOO", name: "Vanguard S&P 500 ETF", category: "Large Cap Blend", expenseRatio: 0.03 },
      { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF", category: "Large Cap Value", expenseRatio: 0.16 },
      { symbol: "IVV", name: "iShares Core S&P 500 ETF", category: "Large Cap Blend", expenseRatio: 0.03 },
      { symbol: "VTI", name: "Vanguard Total Stock Market ETF", category: "Large Cap Blend", expenseRatio: 0.03 },
      { symbol: "VGT", name: "Vanguard Information Technology ETF", category: "Technology", expenseRatio: 0.10 },
      { symbol: "ARKK", name: "ARK Innovation ETF", category: "Mid-Cap Growth", expenseRatio: 0.75 },
    ];

    const symbols = etfs.map(e => e.symbol);
    const quotes = await this.getMultipleQuotes(symbols);

    return etfs.map(etf => {
      const quote = quotes.get(etf.symbol);
      return {
        ...etf,
        price: quote?.price,
        change: quote?.change,
        changePercent: quote?.changePercent,
      } as ETFInfo & { price?: number; change?: number; changePercent?: number };
    });
  }

  async getUsdInrRate(): Promise<number> {
    try {
      const response = await axios.get(
        "https://api.exchangerate-api.com/v4/latest/USD",
        { timeout: 5000 }
      );
      return response.data.rates?.INR || 83.5;
    } catch (error) {
      console.error("Error fetching USD/INR rate:", error);
      return 83.5;
    }
  }

  clearCache(): void {
    this.priceCache.clear();
    this.detailsCache.clear();
  }

  testConnection(): { configured: boolean; message: string } {
    if (!this.isConfigured()) {
      return { configured: false, message: "Polygon API key not configured. Set POLYGON_API_KEY for US market data." };
    }
    return { configured: true, message: "Polygon API configured" };
  }
}

export const polygonMarketService = new PolygonMarketService();
