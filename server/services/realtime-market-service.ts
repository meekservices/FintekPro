import axios from 'axios';
import { WebSocket } from 'ws';
import { logger } from '../logger';
import { FinnhubService } from '../finnhub-service';

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume: number;
  timestamp: number;
  source: 'alphavantage' | 'finnhub' | 'cache';
}

export interface TimeSeriesData {
  symbol: string;
  interval: string;
  data: {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
}

class RealtimeMarketService {
  private alphaVantageKey: string;
  private finnhubService: FinnhubService;
  private cache: Map<string, { data: MarketQuote; timestamp: number }> = new Map();
  private cacheTTL = 30000; // 30 seconds
  private wsConnections: Map<string, WebSocket> = new Map();
  private subscribers: Map<string, Set<(quote: MarketQuote) => void>> = new Map();

  constructor() {
    this.alphaVantageKey = process.env.ALPHA_VANTAGE_API_KEY || '';
    this.finnhubService = new FinnhubService();
    
    if (!this.alphaVantageKey) {
      logger.warn('ALPHA_VANTAGE_API_KEY not configured, using Finnhub only');
    }
  }

  /**
   * Get real-time quote with intelligent fallback
   */
  async getQuote(symbol: string, forceRefresh = false): Promise<MarketQuote | null> {
    // Check cache first
    if (!forceRefresh) {
      const cached = this.cache.get(symbol);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        logger.info('Returning cached quote', { symbol, age: Date.now() - cached.timestamp });
        return { ...cached.data, source: 'cache' };
      }
    }

    // Try Alpha Vantage first (more reliable for global stocks)
    if (this.alphaVantageKey) {
      try {
        const quote = await this.fetchAlphaVantageQuote(symbol);
        this.cache.set(symbol, { data: quote, timestamp: Date.now() });
        return quote;
      } catch (error) {
        logger.warn('Alpha Vantage quote failed, will try Finnhub fallback', { symbol, error: String(error) });
      }
    }

    // Fallback to Finnhub
    try {
      const quote = await this.fetchFinnhubQuote(symbol);
      if (quote) {
        this.cache.set(symbol, { data: quote, timestamp: Date.now() });
        return quote;
      }
    } catch (error) {
      logger.error('Finnhub quote failed', { symbol, error: String(error) });
    }

    // No data sources available - return null instead of throwing
    logger.warn('All quote sources unavailable or failed, returning null', { symbol });
    return null;
  }

  /**
   * Fetch quote from Alpha Vantage
   */
  private async fetchAlphaVantageQuote(symbol: string): Promise<MarketQuote> {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.alphaVantageKey}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data['Global Quote'];

    if (!data || Object.keys(data).length === 0) {
      throw new Error('No data returned from Alpha Vantage');
    }

    return {
      symbol,
      price: parseFloat(data['05. price'] || '0'),
      change: parseFloat(data['09. change'] || '0'),
      changePercent: parseFloat(data['10. change percent']?.replace('%', '') || '0'),
      high: parseFloat(data['03. high'] || '0'),
      low: parseFloat(data['04. low'] || '0'),
      open: parseFloat(data['02. open'] || '0'),
      previousClose: parseFloat(data['08. previous close'] || '0'),
      volume: parseInt(data['06. volume'] || '0'),
      timestamp: Date.now(),
      source: 'alphavantage',
    };
  }

  /**
   * Fetch quote from Finnhub
   */
  private async fetchFinnhubQuote(symbol: string): Promise<MarketQuote | null> {
    const data = await this.finnhubService.getQuote(symbol);

    if (!data) {
      return null;
    }

    return {
      symbol,
      price: data.c,
      change: data.d,
      changePercent: data.dp,
      high: data.h,
      low: data.l,
      open: data.o,
      previousClose: data.pc,
      volume: 0, // Finnhub quote doesn't include volume
      timestamp: data.t * 1000,
      source: 'finnhub',
    };
  }

  /**
   * Get historical time series data
   */
  async getTimeSeries(symbol: string, interval: '1min' | '5min' | '15min' | '30min' | '60min' | 'daily' = 'daily'): Promise<TimeSeriesData> {
    if (!this.alphaVantageKey) {
      throw new Error('Alpha Vantage API key required for time series data');
    }

    const functionMap: Record<string, string> = {
      '1min': 'TIME_SERIES_INTRADAY',
      '5min': 'TIME_SERIES_INTRADAY',
      '15min': 'TIME_SERIES_INTRADAY',
      '30min': 'TIME_SERIES_INTRADAY',
      '60min': 'TIME_SERIES_INTRADAY',
      'daily': 'TIME_SERIES_DAILY',
    };

    const func = functionMap[interval];
    const url = interval === 'daily'
      ? `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&apikey=${this.alphaVantageKey}`
      : `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&interval=${interval}&apikey=${this.alphaVantageKey}`;

    const response = await axios.get(url, { timeout: 15000 });
    const timeSeriesKey = interval === 'daily' ? 'Time Series (Daily)' : `Time Series (${interval})`;
    const rawData = response.data[timeSeriesKey];

    if (!rawData) {
      throw new Error('No time series data returned');
    }

    const data = Object.entries(rawData).map(([timestamp, values]: [string, any]) => ({
      timestamp: new Date(timestamp).getTime(),
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseInt(values['5. volume']),
    })).sort((a, b) => a.timestamp - b.timestamp);

    return {
      symbol,
      interval,
      data,
    };
  }

  /**
   * Get multiple quotes in batch
   */
  async getBatchQuotes(symbols: string[]): Promise<MarketQuote[]> {
    const promises = symbols.map(symbol => 
      this.getQuote(symbol).catch(error => {
        logger.error('Batch quote error', { symbol, error: String(error) });
        return null;
      })
    );

    const results = await Promise.all(promises);
    return results.filter((quote): quote is MarketQuote => quote !== null);
  }

  /**
   * Subscribe to real-time updates for a symbol (WebSocket)
   */
  subscribeToSymbol(symbol: string, callback: (quote: MarketQuote) => void): () => void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
      this.startPolling(symbol);
    }

    this.subscribers.get(symbol)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(symbol);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(symbol);
          this.stopPolling(symbol);
        }
      }
    };
  }

  /**
   * Start polling for real-time updates
   */
  private startPolling(symbol: string): void {
    const poll = async () => {
      try {
        const quote = await this.getQuote(symbol, true);
        if (quote) {
          const callbacks = this.subscribers.get(symbol);
          if (callbacks) {
            callbacks.forEach(cb => cb(quote));
          }
        } else {
          logger.warn('No quote available during polling', { symbol });
        }
      } catch (error) {
        logger.error('Polling error', { symbol, error: String(error) });
      }
    };

    // Poll every 30 seconds
    const intervalId = setInterval(poll, 30000);
    this.wsConnections.set(symbol, intervalId as any);

    // Initial fetch
    poll();
  }

  /**
   * Stop polling for a symbol
   */
  private stopPolling(symbol: string): void {
    const intervalId = this.wsConnections.get(symbol);
    if (intervalId) {
      clearInterval(intervalId as any);
      this.wsConnections.delete(symbol);
    }
  }

  /**
   * Clear cache for a symbol or all symbols
   */
  clearCache(symbol?: string): void {
    if (symbol) {
      this.cache.delete(symbol);
      logger.info('Cache cleared', { symbol });
    } else {
      this.cache.clear();
      logger.info('All cache cleared');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; symbols: string[] } {
    return {
      size: this.cache.size,
      symbols: Array.from(this.cache.keys()),
    };
  }
}

export const realtimeMarketService = new RealtimeMarketService();
