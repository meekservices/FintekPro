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
      return this.getMockQuote(symbol);
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
      return this.getMockQuote(symbol);
    }
  }

  async getMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const results = new Map<string, StockQuote>();
    
    await Promise.all(
      symbols.map(async (symbol) => {
        const quote = await this.getQuote(symbol);
        if (quote) {
          results.set(symbol.toUpperCase(), quote);
        }
      })
    );

    return results;
  }

  async getStockDetails(symbol: string): Promise<StockDetails | null> {
    const cacheKey = this.getCacheKey(symbol);
    const cached = this.detailsCache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    if (!this.isConfigured()) {
      return this.getMockDetails(symbol);
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
      return this.getMockDetails(symbol);
    }
  }

  async searchSymbols(query: string, limit = 10): Promise<StockDetails[]> {
    if (!this.isConfigured()) {
      return this.getMockSearchResults(query);
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
      return this.getMockSearchResults(query);
    }
  }

  async getSP500Constituents(): Promise<string[]> {
    return [
      "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "META", "TSLA", "BRK.B", "UNH", "JNJ",
      "XOM", "JPM", "V", "PG", "MA", "HD", "CVX", "MRK", "ABBV", "LLY",
      "PEP", "KO", "AVGO", "COST", "MCD", "WMT", "TMO", "ACN", "CSCO", "DHR",
    ];
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

    for (const etf of etfs) {
      const quote = await this.getQuote(etf.symbol);
      if (quote) {
        (etf as any).price = quote.price;
        (etf as any).change = quote.change;
        (etf as any).changePercent = quote.changePercent;
      }
    }

    return etfs;
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

  private getMockQuote(symbol: string): StockQuote {
    const basePrice = this.getBasePriceForSymbol(symbol);
    const change = (Math.random() - 0.5) * 5;
    return {
      symbol: symbol.toUpperCase(),
      price: basePrice,
      change,
      changePercent: (change / basePrice) * 100,
      open: basePrice - 1,
      high: basePrice + 2,
      low: basePrice - 2,
      close: basePrice,
      volume: Math.floor(Math.random() * 10000000),
      timestamp: Date.now(),
    };
  }

  private getBasePriceForSymbol(symbol: string): number {
    const prices: Record<string, number> = {
      SPY: 595.50,
      QQQ: 520.25,
      VOO: 548.75,
      DIA: 425.80,
      AAPL: 195.50,
      MSFT: 425.30,
      AMZN: 185.75,
      GOOGL: 175.20,
      META: 565.40,
      TSLA: 265.80,
      NVDA: 875.50,
    };
    return prices[symbol.toUpperCase()] || 100 + Math.random() * 200;
  }

  private getMockDetails(symbol: string): StockDetails {
    const details: Record<string, Partial<StockDetails>> = {
      SPY: { name: "SPDR S&P 500 ETF Trust", type: "ETF", primaryExchange: "ARCA" },
      QQQ: { name: "Invesco QQQ Trust", type: "ETF", primaryExchange: "NASDAQ" },
      VOO: { name: "Vanguard S&P 500 ETF", type: "ETF", primaryExchange: "ARCA" },
      AAPL: { name: "Apple Inc.", type: "CS", primaryExchange: "NASDAQ", marketCap: 3000000000000 },
      MSFT: { name: "Microsoft Corporation", type: "CS", primaryExchange: "NASDAQ", marketCap: 2800000000000 },
      GOOGL: { name: "Alphabet Inc.", type: "CS", primaryExchange: "NASDAQ", marketCap: 2000000000000 },
    };

    const info = details[symbol.toUpperCase()] || {};
    return {
      symbol: symbol.toUpperCase(),
      name: info.name || `${symbol} Inc.`,
      market: "stocks",
      locale: "us",
      primaryExchange: info.primaryExchange || "NASDAQ",
      type: info.type || "CS",
      currency: "USD",
      marketCap: info.marketCap,
    };
  }

  private getMockSearchResults(query: string): StockDetails[] {
    const allStocks = [
      { symbol: "AAPL", name: "Apple Inc." },
      { symbol: "MSFT", name: "Microsoft Corporation" },
      { symbol: "GOOGL", name: "Alphabet Inc." },
      { symbol: "AMZN", name: "Amazon.com Inc." },
      { symbol: "META", name: "Meta Platforms Inc." },
      { symbol: "TSLA", name: "Tesla Inc." },
      { symbol: "NVDA", name: "NVIDIA Corporation" },
      { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
      { symbol: "QQQ", name: "Invesco QQQ Trust" },
      { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
    ];

    const q = query.toLowerCase();
    return allStocks
      .filter(s => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map(s => ({
        symbol: s.symbol,
        name: s.name,
        market: "stocks",
        locale: "us",
        primaryExchange: "NASDAQ",
        type: s.symbol.length === 3 ? "ETF" : "CS",
        currency: "USD",
      }));
  }

  clearCache(): void {
    this.priceCache.clear();
    this.detailsCache.clear();
  }

  testConnection(): { configured: boolean; message: string } {
    if (!this.isConfigured()) {
      return { configured: false, message: "Polygon API key not configured - using mock data" };
    }
    return { configured: true, message: "Polygon API configured" };
  }
}

export const polygonMarketService = new PolygonMarketService();
