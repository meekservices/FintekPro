import axios, { AxiosInstance } from "axios";

interface IEXQuote {
  symbol: string;
  companyName: string;
  latestPrice: number;
  change: number;
  changePercent: number;
  latestVolume: number;
  marketCap: number;
  peRatio: number;
  week52High: number;
  week52Low: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
}

interface IEXNews {
  datetime: number;
  headline: string;
  source: string;
  url: string;
  summary: string;
  related: string;
  image: string;
}

interface IEXMarketStatus {
  isOpen: boolean;
  currentTime: string;
}

class IEXCloudService {
  private client: AxiosInstance;
  private apiKey: string | null;
  private baseUrl: string;
  private isConfigured: boolean;
  private rateLimitRemaining: number = 100;
  private lastRateLimitCheck: number = 0;

  constructor() {
    this.apiKey = process.env.IEX_CLOUD_API_KEY || null;
    this.baseUrl = this.apiKey 
      ? "https://cloud.iexapis.com/stable"
      : "https://sandbox.iexapis.com/stable";
    
    this.isConfigured = !!this.apiKey;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      params: this.apiKey ? { token: this.apiKey } : { token: "Tpk_test" },
    });

    if (!this.apiKey) {
      console.log("⚠️ [IEX Cloud] No API key configured. Using sandbox mode with limited data.");
    } else {
      console.log("✅ [IEX Cloud] Service initialized with production API key.");
    }
  }

  async getQuote(symbol: string): Promise<IEXQuote | null> {
    if (!this.checkRateLimit()) {
      console.log("⚠️ [IEX Cloud] Rate limited, returning null");
      return null;
    }

    try {
      const response = await this.client.get(`/stock/${symbol}/quote`);
      this.updateRateLimit(response.headers);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 402) {
        console.log("⚠️ [IEX Cloud] Free tier limit reached");
      } else if (error.response?.status === 404) {
        console.log(`⚠️ [IEX Cloud] Symbol not found: ${symbol}`);
      } else {
        console.error(`❌ [IEX Cloud] Error fetching quote for ${symbol}:`, error.message);
      }
      return null;
    }
  }

  async getBatchQuotes(symbols: string[]): Promise<Map<string, IEXQuote>> {
    const result = new Map<string, IEXQuote>();
    
    if (!this.checkRateLimit()) {
      console.log("⚠️ [IEX Cloud] Rate limited, returning empty batch");
      return result;
    }

    if (symbols.length === 0) {
      return result;
    }

    try {
      const symbolList = symbols.slice(0, 10).join(",");
      const response = await this.client.get("/stock/market/batch", {
        params: {
          symbols: symbolList,
          types: "quote",
        },
      });

      this.updateRateLimit(response.headers);

      for (const [symbol, data] of Object.entries(response.data)) {
        if ((data as any).quote) {
          result.set(symbol, (data as any).quote);
        }
      }

      return result;
    } catch (error: any) {
      console.error("❌ [IEX Cloud] Error fetching batch quotes:", error.message);
      return result;
    }
  }

  async getMarketStatus(): Promise<IEXMarketStatus> {
    try {
      const now = new Date();
      const estOffset = -5 * 60;
      const utcOffset = now.getTimezoneOffset();
      const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000);
      
      const hour = estTime.getHours();
      const minute = estTime.getMinutes();
      const day = estTime.getDay();
      
      const isWeekday = day >= 1 && day <= 5;
      const isMarketHours = hour >= 9 && (hour < 16 || (hour === 9 && minute >= 30));
      
      return {
        isOpen: isWeekday && isMarketHours,
        currentTime: now.toISOString(),
      };
    } catch (error) {
      return {
        isOpen: false,
        currentTime: new Date().toISOString(),
      };
    }
  }

  async getNews(symbol: string, limit: number = 5): Promise<IEXNews[]> {
    if (!this.checkRateLimit()) {
      console.log("⚠️ [IEX Cloud] Rate limited, returning empty news");
      return [];
    }

    try {
      const response = await this.client.get(`/stock/${symbol}/news/last/${limit}`);
      this.updateRateLimit(response.headers);
      return response.data;
    } catch (error: any) {
      console.error(`❌ [IEX Cloud] Error fetching news for ${symbol}:`, error.message);
      return [];
    }
  }

  async getMarketMovers(): Promise<{gainers: IEXQuote[], losers: IEXQuote[], mostActive: IEXQuote[]}> {
    if (!this.checkRateLimit()) {
      return { gainers: [], losers: [], mostActive: [] };
    }

    try {
      const [gainersRes, losersRes, activeRes] = await Promise.all([
        this.client.get("/stock/market/list/gainers").catch(() => ({ data: [] })),
        this.client.get("/stock/market/list/losers").catch(() => ({ data: [] })),
        this.client.get("/stock/market/list/mostactive").catch(() => ({ data: [] })),
      ]);

      return {
        gainers: gainersRes.data.slice(0, 5),
        losers: losersRes.data.slice(0, 5),
        mostActive: activeRes.data.slice(0, 5),
      };
    } catch (error: any) {
      console.error("❌ [IEX Cloud] Error fetching market movers:", error.message);
      return { gainers: [], losers: [], mostActive: [] };
    }
  }

  async getIndices(): Promise<{name: string, value: number, change: number, changePercent: number}[]> {
    const indexSymbols = ["SPY", "QQQ", "DIA", "IWM", "VIX"];
    const quotes = await this.getBatchQuotes(indexSymbols);
    
    const indexNames: Record<string, string> = {
      SPY: "S&P 500",
      QQQ: "NASDAQ 100",
      DIA: "Dow Jones",
      IWM: "Russell 2000",
      VIX: "VIX",
    };

    const result = [];
    for (const symbol of indexSymbols) {
      const quote = quotes.get(symbol);
      if (quote) {
        result.push({
          name: indexNames[symbol] || symbol,
          value: quote.latestPrice,
          change: quote.change,
          changePercent: quote.changePercent * 100,
        });
      }
    }

    return result;
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.lastRateLimitCheck > 60000) {
      this.rateLimitRemaining = 100;
      this.lastRateLimitCheck = now;
    }
    
    if (this.rateLimitRemaining <= 0) {
      return false;
    }
    
    this.rateLimitRemaining--;
    return true;
  }

  private updateRateLimit(headers: any): void {
    if (headers["x-ratelimit-remaining"]) {
      this.rateLimitRemaining = parseInt(headers["x-ratelimit-remaining"], 10);
    }
  }

  getStatus(): { isConfigured: boolean; mode: string; rateLimitRemaining: number } {
    return {
      isConfigured: this.isConfigured,
      mode: this.apiKey ? "production" : "sandbox",
      rateLimitRemaining: this.rateLimitRemaining,
    };
  }
}

export const iexCloudService = new IEXCloudService();
