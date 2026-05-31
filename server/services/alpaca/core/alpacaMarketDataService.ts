// @ts-nocheck
import axios from 'axios';
import { logger } from '../../../logger';
import { alpacaAuthManager } from './alpacaAuthManager';

export class AlpacaMarketDataService {
  private client;

  constructor() {
    this.client = axios.create({
      baseURL: alpacaAuthManager.getMarketDataUrl(),
      timeout: 15000,
      headers: alpacaAuthManager.getAuthHeaders()
    });
  }

  async getLatestQuotes(symbols: string[]) {
    try {
      const response = await this.client.get('/stocks/quotes/latest', {
        params: { symbols: symbols.join(',') }
      });
      return response.data.quotes;
    } catch (error: any) {
      logger.error('[AlpacaMarketData] Failed to fetch quotes', error.message);
      throw error;
    }
  }

  async getHistoricalBars(symbol: string, timeframe: string, start: string, end?: string) {
    try {
      const params: any = { timeframe, start };
      if (end) params.end = end;

      const response = await this.client.get(`/stocks/${symbol}/bars`, { params });
      return response.data.bars;
    } catch (error: any) {
      logger.error(`[AlpacaMarketData] Failed to fetch bars for ${symbol}`, error.message);
      throw error;
    }
  }
}

export const alpacaMarketDataService = new AlpacaMarketDataService();
