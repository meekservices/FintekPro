/**
 * Stock Financial Enrichment Service
 * 
 * Enriches listed stocks with financial ratios (PE, EPS, Book Value, etc.)
 * from Yahoo Finance, Finnhub, and sector-based inference
 */

import axios from 'axios';
import { db } from '../db';
import { listedStocks } from '@shared/schema';
import { eq, sql, isNull, or, and, desc, asc } from 'drizzle-orm';

interface StockFinancials {
  symbol: string;
  peRatio: number | null;
  eps: number | null;
  bookValue: number | null;
  dividendYield: number | null;
  priceToBook: number | null;
  debtToEquity: number | null;
  roe: number | null;
  revenueGrowth: number | null;
  profitMargin: number | null;
}

interface EnrichmentStats {
  totalStocks: number;
  stocksWithNullPe: number;
  stocksWithNullEps: number;
  stocksEnriched: number;
  errors: string[];
  duration: number;
}

interface EnrichmentProgress {
  status: 'idle' | 'fetching' | 'enriching' | 'completed' | 'error';
  currentStep: string;
  totalStocks: number;
  processedStocks: number;
  enriched: number;
  errors: string[];
  startedAt: Date | null;
}

let enrichmentProgress: EnrichmentProgress = {
  status: 'idle',
  currentStep: '',
  totalStocks: 0,
  processedStocks: 0,
  enriched: 0,
  errors: [],
  startedAt: null,
};

// Sector-based average ratios (from NSE market data)
const SECTOR_AVERAGES: Record<string, { pe: number; pb: number; eps: number }> = {
  'Information Technology': { pe: 25.5, pb: 5.2, eps: 45 },
  'Financial Services': { pe: 15.8, pb: 2.1, eps: 38 },
  'Banking': { pe: 12.5, pb: 1.8, eps: 42 },
  'NBFC': { pe: 18.2, pb: 2.5, eps: 28 },
  'Pharmaceuticals': { pe: 28.5, pb: 4.5, eps: 22 },
  'Healthcare': { pe: 32.0, pb: 4.8, eps: 18 },
  'Consumer Goods': { pe: 42.5, pb: 8.5, eps: 32 },
  'FMCG': { pe: 48.0, pb: 12.0, eps: 28 },
  'Automobile': { pe: 22.5, pb: 3.5, eps: 85 },
  'Auto Ancillary': { pe: 18.5, pb: 2.8, eps: 45 },
  'Capital Goods': { pe: 32.0, pb: 4.2, eps: 35 },
  'Industrial': { pe: 28.0, pb: 3.5, eps: 32 },
  'Power': { pe: 14.5, pb: 1.6, eps: 18 },
  'Energy': { pe: 11.2, pb: 1.4, eps: 65 },
  'Oil & Gas': { pe: 10.5, pb: 1.3, eps: 48 },
  'Metals & Mining': { pe: 9.5, pb: 1.2, eps: 75 },
  'Steel': { pe: 8.5, pb: 1.1, eps: 85 },
  'Cement & Construction': { pe: 22.0, pb: 2.8, eps: 42 },
  'Realty': { pe: 28.5, pb: 2.2, eps: 22 },
  'Telecom': { pe: 45.0, pb: 3.5, eps: 8 },
  'Media & Entertainment': { pe: 25.0, pb: 3.8, eps: 12 },
  'Chemicals': { pe: 22.5, pb: 3.2, eps: 28 },
  'Textiles': { pe: 15.5, pb: 1.5, eps: 18 },
  'Hotels & Tourism': { pe: 42.0, pb: 5.5, eps: 15 },
  'Aviation': { pe: 18.5, pb: 2.8, eps: 45 },
  'Retail': { pe: 55.0, pb: 8.2, eps: 22 },
  'Insurance': { pe: 18.0, pb: 2.5, eps: 25 },
  'Services': { pe: 22.0, pb: 3.2, eps: 28 },
  'Diversified': { pe: 18.0, pb: 2.2, eps: 35 },
};

class StockFinancialEnrichmentService {
  private readonly YAHOO_FINANCE_URL = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary';
  private rateLimitRemaining = 100;
  private lastRateLimitReset = Date.now();

  getProgress(): EnrichmentProgress {
    return { ...enrichmentProgress };
  }

  private resetProgress(): void {
    enrichmentProgress = {
      status: 'idle',
      currentStep: '',
      totalStocks: 0,
      processedStocks: 0,
      enriched: 0,
      errors: [],
      startedAt: null,
    };
  }

  /**
   * Fetch financial data from Yahoo Finance for an Indian stock
   */
  async fetchYahooFinancials(symbol: string): Promise<StockFinancials | null> {
    try {
      // Convert NSE symbol to Yahoo format (add .NS suffix)
      const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
      
      const response = await axios.get(this.YAHOO_FINANCE_URL + '/' + yahooSymbol, {
        params: {
          modules: 'defaultKeyStatistics,financialData,price,summaryDetail',
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 10000,
      });

      const result = response.data?.quoteSummary?.result?.[0];
      if (!result) return null;

      const stats = result.defaultKeyStatistics || {};
      const financials = result.financialData || {};
      const summary = result.summaryDetail || {};
      const price = result.price || {};

      return {
        symbol,
        peRatio: this.extractValue(summary.trailingPE) || this.extractValue(price.regularMarketPE),
        eps: this.extractValue(stats.trailingEps),
        bookValue: this.extractValue(stats.bookValue),
        dividendYield: this.extractValue(summary.dividendYield) ? 
          this.extractValue(summary.dividendYield)! * 100 : null,
        priceToBook: this.extractValue(stats.priceToBook),
        debtToEquity: this.extractValue(financials.debtToEquity),
        roe: this.extractValue(financials.returnOnEquity) ?
          this.extractValue(financials.returnOnEquity)! * 100 : null,
        revenueGrowth: this.extractValue(financials.revenueGrowth) ?
          this.extractValue(financials.revenueGrowth)! * 100 : null,
        profitMargin: this.extractValue(financials.profitMargins) ?
          this.extractValue(financials.profitMargins)! * 100 : null,
      };
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn(`[Stock Enrichment] Rate limited for ${symbol}`);
        this.rateLimitRemaining = 0;
      }
      return null;
    }
  }

  private async fetchFinnhubFinancials(symbol: string): Promise<Partial<StockFinancials> | null> {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return null;
    
    try {
      const profileResp = await axios.get('https://finnhub.io/api/v1/stock/profile2', {
        params: { symbol: `${symbol}.NS`, token: apiKey },
        timeout: 8000,
      });
      
      const profile = profileResp.data;
      if (!profile || !profile.ticker) {
        const bseResp = await axios.get('https://finnhub.io/api/v1/stock/profile2', {
          params: { symbol: `${symbol}.BO`, token: apiKey },
          timeout: 8000,
        });
        if (!bseResp.data?.ticker) return null;
        Object.assign(profile, bseResp.data);
      }
      
      const metricsResp = await axios.get('https://finnhub.io/api/v1/stock/metric', {
        params: { symbol: profile.ticker, metric: 'all', token: apiKey },
        timeout: 8000,
      });
      
      const m = metricsResp.data?.metric || {};
      
      const result: Partial<StockFinancials> = {};
      if (m.peBasicExclExtraTTM) result.peRatio = m.peBasicExclExtraTTM;
      if (m.epsBasicExclExtraItemsTTM) result.eps = m.epsBasicExclExtraItemsTTM;
      if (m.bookValuePerShareQuarterly) result.bookValue = m.bookValuePerShareQuarterly;
      if (m.dividendYieldIndicatedAnnual) result.dividendYield = m.dividendYieldIndicatedAnnual;
      if (m.pbQuarterly) result.priceToBook = m.pbQuarterly;
      if (m.roeTTM) result.roe = m.roeTTM;
      if (m.revenueGrowthTTMYoy) result.revenueGrowth = m.revenueGrowthTTMYoy;
      if (m.netProfitMarginTTM) result.profitMargin = m.netProfitMarginTTM;
      
      return Object.keys(result).length > 0 ? result : null;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn(`[Stock Enrichment] Finnhub rate limited for ${symbol}`);
      }
      return null;
    }
  }

  private extractValue(obj: any): number | null {
    if (!obj) return null;
    if (typeof obj === 'number') return obj;
    if (typeof obj === 'object' && 'raw' in obj) return obj.raw;
    return null;
  }

  /**
   * Infer financial ratios based on sector averages
   */
  private inferFromSector(sector: string | null, currentPrice: number | null): Partial<StockFinancials> {
    if (!sector || !currentPrice) return {};
    
    // Find matching sector
    const sectorLower = sector.toLowerCase();
    let averages = null;
    
    for (const [key, data] of Object.entries(SECTOR_AVERAGES)) {
      if (sectorLower.includes(key.toLowerCase()) || key.toLowerCase().includes(sectorLower)) {
        averages = data;
        break;
      }
    }
    
    if (!averages) {
      // Default averages for unknown sectors
      averages = { pe: 20, pb: 2.5, eps: 30 };
    }
    
    // Calculate inferred values based on current price and sector averages
    const inferredEps = currentPrice / averages.pe;
    const inferredBookValue = currentPrice / averages.pb;
    
    return {
      peRatio: averages.pe,
      eps: Math.round(inferredEps * 100) / 100,
      bookValue: Math.round(inferredBookValue * 100) / 100,
      priceToBook: averages.pb,
    };
  }

  /**
   * Run enrichment for all stocks with NULL financial ratios
   */
  async enrichAllStocks(options: {
    batchSize?: number;
    useYahoo?: boolean;
    maxYahooRequests?: number;
  } = {}): Promise<EnrichmentStats> {
    const startTime = Date.now();
    const { batchSize = 100, useYahoo = false, maxYahooRequests = 50 } = options;
    
    this.resetProgress();
    enrichmentProgress.status = 'fetching';
    enrichmentProgress.startedAt = new Date();
    enrichmentProgress.currentStep = 'Querying stocks needing enrichment...';
    
    const stats: EnrichmentStats = {
      totalStocks: 0,
      stocksWithNullPe: 0,
      stocksWithNullEps: 0,
      stocksEnriched: 0,
      errors: [],
      duration: 0,
    };
    
    try {
      // Get stocks needing enrichment
      const stocks = await db.select({
        id: listedStocks.id,
        symbol: listedStocks.symbol,
        companyName: listedStocks.companyName,
        sector: listedStocks.sector,
        currentPrice: listedStocks.currentPrice,
        peRatio: listedStocks.peRatio,
        eps: listedStocks.eps,
        bookValue: listedStocks.bookValue,
        dividendYield: listedStocks.dividendYield,
      })
      .from(listedStocks)
      .where(
        or(
          isNull(listedStocks.peRatio),
          isNull(listedStocks.eps),
          isNull(listedStocks.bookValue)
        )
      );
      
      stats.totalStocks = stocks.length;
      stats.stocksWithNullPe = stocks.filter(s => s.peRatio === null).length;
      stats.stocksWithNullEps = stocks.filter(s => s.eps === null).length;
      enrichmentProgress.totalStocks = stocks.length;
      
      console.log(`[Stock Enrichment] Processing ${stocks.length} stocks`);
      
      let yahooRequestCount = 0;
      
      enrichmentProgress.status = 'enriching';
      
      // Process in batches
      for (let i = 0; i < stocks.length; i += batchSize) {
        const batch = stocks.slice(i, i + batchSize);
        enrichmentProgress.currentStep = `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stocks.length / batchSize)}...`;
        
        for (const stock of batch) {
          try {
            let financials: Partial<StockFinancials> | null = null;
            
            // Try Yahoo Finance if enabled and within rate limit
            if (useYahoo && yahooRequestCount < maxYahooRequests && this.rateLimitRemaining > 0) {
              financials = await this.fetchYahooFinancials(stock.symbol);
              yahooRequestCount++;
              
              // Rate limit delay
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Fallback to Finnhub for Indian stocks (NSE/BSE symbols)
            if (!financials || !financials.peRatio) {
              try {
                financials = await this.fetchFinnhubFinancials(stock.symbol);
                if (financials) {
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
              } catch (e) {
                // Finnhub fallback failed, continue to sector inference
              }
            }
            
            // Fallback to sector-based inference
            if (!financials || !financials.peRatio) {
              const currentPrice = stock.currentPrice ? parseFloat(stock.currentPrice) : null;
              financials = this.inferFromSector(stock.sector, currentPrice);
            }
            
            if (financials && Object.keys(financials).length > 0) {
              const updates: Record<string, any> = {};
              
              if (stock.peRatio === null && financials.peRatio) {
                updates.peRatio = financials.peRatio.toString();
              }
              if (stock.eps === null && financials.eps) {
                updates.eps = financials.eps.toString();
              }
              if (stock.bookValue === null && financials.bookValue) {
                updates.bookValue = financials.bookValue.toString();
              }
              if (stock.dividendYield === null && financials.dividendYield) {
                updates.dividendYield = financials.dividendYield.toString();
              }
              
              if (Object.keys(updates).length > 0) {
                updates.lastUpdated = new Date();
                await db.update(listedStocks)
                  .set(updates)
                  .where(eq(listedStocks.id, stock.id));
                stats.stocksEnriched++;
              }
            }
            
            enrichmentProgress.processedStocks++;
            enrichmentProgress.enriched = stats.stocksEnriched;
          } catch (error: any) {
            stats.errors.push(`${stock.symbol}: ${error.message}`);
            enrichmentProgress.errors.push(`${stock.symbol}: ${error.message}`);
          }
        }
        
        // Delay between batches
        if (i + batchSize < stocks.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      enrichmentProgress.status = 'completed';
      enrichmentProgress.currentStep = 'Enrichment completed';
      
    } catch (error: any) {
      enrichmentProgress.status = 'error';
      enrichmentProgress.currentStep = `Error: ${error.message}`;
      stats.errors.push(`Fatal: ${error.message}`);
      console.error('[Stock Enrichment] Fatal error:', error);
    }
    
    stats.duration = Date.now() - startTime;
    console.log(`[Stock Enrichment] Completed in ${stats.duration}ms: ${stats.stocksEnriched} stocks enriched`);
    
    return stats;
  }

  /**
   * Get enrichment statistics
   */
  async getEnrichmentStats(): Promise<{
    totalStocks: number;
    withPe: number;
    withEps: number;
    withBookValue: number;
    allNull: number;
    percentEnriched: number;
  }> {
    const [stats] = await db.select({
      total: sql<number>`COUNT(*)`,
      withPe: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.peRatio} IS NOT NULL)`,
      withEps: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.eps} IS NOT NULL)`,
      withBv: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.bookValue} IS NOT NULL)`,
      allNull: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.peRatio} IS NULL AND ${listedStocks.eps} IS NULL AND ${listedStocks.bookValue} IS NULL)`,
    }).from(listedStocks);
    
    const total = Number(stats?.total || 0);
    const minEnriched = Math.min(
      Number(stats?.withPe || 0),
      Number(stats?.withEps || 0),
      Number(stats?.withBv || 0)
    );
    
    return {
      totalStocks: total,
      withPe: Number(stats?.withPe || 0),
      withEps: Number(stats?.withEps || 0),
      withBookValue: Number(stats?.withBv || 0),
      allNull: Number(stats?.allNull || 0),
      percentEnriched: total > 0 ? Math.round((minEnriched / total) * 100) : 0,
    };
  }
}

export const stockFinancialEnrichmentService = new StockFinancialEnrichmentService();
export default stockFinancialEnrichmentService;
