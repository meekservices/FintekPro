// @ts-ignore - No types available for finnhub package
import * as finnhub from 'finnhub';

export interface FinnhubQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Percent change
  h: number; // High price of the day
  l: number; // Low price of the day
  o: number; // Open price of the day
  pc: number; // Previous close price
  t: number; // Timestamp
}

export interface FinnhubCandle {
  c: number[]; // Close prices
  h: number[]; // High prices
  l: number[]; // Low prices
  o: number[]; // Open prices
  t: number[]; // Timestamps
  v: number[]; // Volume data
  s: string; // Status
}

export interface FinnhubCompanyProfile {
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

export class FinnhubService {
  private client: any;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.FINNHUB_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ FINNHUB_API_KEY environment variable is required for real-time market data. Finnhub service will be disabled.');
      return;
    }
    console.log('Initializing Finnhub with API key length:', this.apiKey.length);
    this.client = new finnhub.DefaultApi(this.apiKey);
  }

  /**
   * Get real-time quote for a symbol
   */
  async getQuote(symbol: string): Promise<FinnhubQuote> {
    return new Promise((resolve, reject) => {
      this.client.quote(symbol, (error: any, data: FinnhubQuote, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Get historical candlestick data
   */
  async getCandles(symbol: string, resolution: string, from: number, to: number): Promise<FinnhubCandle> {
    return new Promise((resolve, reject) => {
      this.client.stockCandles(symbol, resolution, from, to, (error: any, data: FinnhubCandle, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Get company profile
   */
  async getCompanyProfile(symbol: string): Promise<FinnhubCompanyProfile> {
    return new Promise((resolve, reject) => {
      this.client.companyProfile2({ symbol }, (error: any, data: FinnhubCompanyProfile, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Get company news
   */
  async getCompanyNews(symbol: string, from: string, to: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.client.companyNews(symbol, from, to, (error: any, data: any[], response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  /**
   * Get market news
   */
  async getMarketNews(category: string = 'general'): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve([]), 8000);
      this.client.marketNews(category, {}, (error: any, data: any[], response: any) => {
        clearTimeout(timeout);
        if (error) {
          resolve([]);
        } else {
          resolve(data || []);
        }
      });
    });
  }

  /**
   * Convert Finnhub quote to your MarketData format
   */
  transformQuoteToMarketData(symbol: string, quote: FinnhubQuote) {
    return {
      symbol,
      price: quote.c,
      change: quote.d,
      changePercent: quote.dp,
      volume: null, // Not provided in quote endpoint
      marketCap: null, // Need company profile for this
      high: quote.h,
      low: quote.l,
      open: quote.o,
      previousClose: quote.pc,
      lastUpdated: new Date(quote.t * 1000)
    };
  }

  /**
   * Convert Finnhub candles to your candle format
   */
  transformCandlesToMarketCandles(candles: FinnhubCandle) {
    if (candles.s !== 'ok' || !candles.c || candles.c.length === 0) {
      return {
        c: [],
        h: [],
        l: [],
        o: [],
        t: [],
        v: [],
        s: 'no_data'
      };
    }

    return {
      c: candles.c,
      h: candles.h,
      l: candles.l,
      o: candles.o,
      t: candles.t.map(timestamp => timestamp * 1000), // Convert to milliseconds
      v: candles.v,
      s: candles.s
    };
  }
}

// Export singleton instance
export const finnhubService = new FinnhubService();