import yahooFinance from 'yahoo-finance2';
import type { SymbolSearchResult } from '@shared/schema';
import { logger } from './logger';

export class SymbolLookupService {
  private cache: Map<string, { results: SymbolSearchResult[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async searchSymbols(query: string): Promise<SymbolSearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();
    
    const cached = this.cache.get(normalizedQuery);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.info('[Symbol Lookup] Cache hit', { query: normalizedQuery });
      return cached.results;
    }

    try {
      logger.info('[Symbol Lookup] Searching for symbols', { query });
      
      const searchResults = await yahooFinance.search(query);
      
      const results: SymbolSearchResult[] = (searchResults.quotes || [])
        .filter((quote: any) => quote.symbol && quote.longname)
        .slice(0, 10)
        .map((quote: any) => {
          const symbol = quote.symbol || '';
          const exchange = this.normalizeExchange(quote.exchange || quote.exchDisp || 'Unknown');
          const exchangeSuffix = this.getExchangeSuffix(symbol, exchange);
          
          return {
            symbol,
            name: quote.longname || quote.shortname || symbol,
            exchange,
            type: quote.quoteType || quote.typeDisp || undefined,
            exchangeSuffix,
          };
        });

      this.cache.set(normalizedQuery, { results, timestamp: Date.now() });
      
      logger.info('[Symbol Lookup] Search completed', { 
        query, 
        resultsCount: results.length 
      });
      
      return results;
    } catch (error: any) {
      logger.error('[Symbol Lookup] Search failed', { 
        query, 
        error: error.message 
      });
      throw new Error('Failed to search for symbols');
    }
  }

  private normalizeExchange(exchange: string): string {
    const exchangeMap: Record<string, string> = {
      'NSI': 'NSE (India)',
      'NSE': 'NSE (India)',
      'BOM': 'BSE (India)',
      'BSE': 'BSE (India)',
      'NMS': 'NASDAQ (US)',
      'NAS': 'NASDAQ (US)',
      'NASDAQ': 'NASDAQ (US)',
      'NYQ': 'NYSE (US)',
      'NYSE': 'NYSE (US)',
      'LSE': 'LSE (UK)',
      'LON': 'LSE (UK)',
      'JPX': 'TSE (Japan)',
      'TSE': 'TSE (Japan)',
      'HKG': 'HKEX (Hong Kong)',
      'SSE': 'SSE (China)',
    };

    return exchangeMap[exchange.toUpperCase()] || exchange;
  }

  private getExchangeSuffix(symbol: string, exchange: string): string {
    if (symbol.includes('.')) {
      const parts = symbol.split('.');
      return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
    }

    if (exchange.includes('NSE')) return '.NS';
    if (exchange.includes('BSE')) return '.BO';
    if (exchange.includes('LSE') || exchange.includes('LON')) return '.L';
    if (exchange.includes('TSE') || exchange.includes('JPX')) return '.T';
    if (exchange.includes('HKEX') || exchange.includes('HKG')) return '.HK';
    if (exchange.includes('SSE')) return '.SS';
    
    return '';
  }

  clearCache(): void {
    this.cache.clear();
    logger.info('[Symbol Lookup] Cache cleared');
  }
}

export const symbolLookupService = new SymbolLookupService();
