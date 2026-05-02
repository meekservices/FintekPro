import { alpacaMarketDataService } from '../core/alpacaMarketDataService';
import { logger } from '../../../logger';

export class QuoteService {
  
  /**
   * Fetch real-time quotes for a list of US stock symbols
   */
  async getQuotes(symbols: string[]) {
    logger.info(`[QuoteService] Fetching quotes for symbols: ${symbols.join(', ')}`);
    
    // Ensure symbols are uppercase and unique
    const cleanSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];
    
    if (cleanSymbols.length === 0) return {};

    try {
      const quotes = await alpacaMarketDataService.getLatestQuotes(cleanSymbols);
      
      // Map to a cleaner format for frontend
      const mappedQuotes: Record<string, any> = {};
      for (const [symbol, quote] of Object.entries(quotes)) {
        mappedQuotes[symbol] = {
          symbol,
          askPrice: (quote as any).ap,
          askSize: (quote as any).as,
          bidPrice: (quote as any).bp,
          bidSize: (quote as any).bs,
          timestamp: (quote as any).t,
        };
      }
      return mappedQuotes;
    } catch (error) {
      logger.error('[QuoteService] Failed to fetch quotes', error);
      throw new Error('Could not fetch market data at this time.');
    }
  }
}

export const quoteService = new QuoteService();
