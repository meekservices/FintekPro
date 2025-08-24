const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY || "demo";
const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

export interface StockQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High price of the day
  l: number; // Low price of the day
  o: number; // Open price of the day
  pc: number; // Previous close price
  t: number; // Timestamp
}

export interface CandleData {
  c: number[]; // Close prices
  h: number[]; // High prices
  l: number[]; // Low prices
  o: number[]; // Open prices
  t: number[]; // Timestamps
  v: number[]; // Volumes
  s: string; // Status
}

export interface NewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export interface CompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  name: string;
  phone: string;
  shareOutstanding: number;
  ticker: string;
  weburl: string;
  logo: string;
  finnhubIndustry: string;
}

class FinnhubAPI {
  private baseUrl = FINNHUB_BASE_URL;
  private apiKey = FINNHUB_API_KEY;

  private async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${this.apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  async getQuote(symbol: string): Promise<StockQuote> {
    return this.makeRequest<StockQuote>(`/quote?symbol=${symbol.toUpperCase()}`);
  }

  async getCandles(
    symbol: string, 
    resolution: string = "D", 
    from: number, 
    to: number
  ): Promise<CandleData> {
    return this.makeRequest<CandleData>(
      `/stock/candle?symbol=${symbol.toUpperCase()}&resolution=${resolution}&from=${from}&to=${to}`
    );
  }

  async getNews(category: string = "general"): Promise<NewsItem[]> {
    return this.makeRequest<NewsItem[]>(`/news?category=${category}`);
  }

  async getCompanyNews(symbol: string, from: string, to: string): Promise<NewsItem[]> {
    return this.makeRequest<NewsItem[]>(
      `/company-news?symbol=${symbol.toUpperCase()}&from=${from}&to=${to}`
    );
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    return this.makeRequest<CompanyProfile>(`/stock/profile2?symbol=${symbol.toUpperCase()}`);
  }

  async getMarketStatus(exchange: string = "US"): Promise<any> {
    return this.makeRequest(`/stock/market-status?exchange=${exchange}`);
  }

  // Search for symbols
  async searchSymbols(query: string): Promise<any> {
    return this.makeRequest(`/search?q=${encodeURIComponent(query)}`);
  }

  // Get multiple quotes at once
  async getMultipleQuotes(symbols: string[]): Promise<{ [symbol: string]: StockQuote }> {
    const promises = symbols.map(symbol => 
      this.getQuote(symbol).catch(error => {
        console.error(`Error fetching quote for ${symbol}:`, error);
        return null;
      })
    );
    
    const results = await Promise.all(promises);
    const quotesMap: { [symbol: string]: StockQuote } = {};
    
    symbols.forEach((symbol, index) => {
      if (results[index]) {
        quotesMap[symbol] = results[index]!;
      }
    });
    
    return quotesMap;
  }
}

export const finnhubAPI = new FinnhubAPI();
