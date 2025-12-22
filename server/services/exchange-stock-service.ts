import { NseIndia } from 'stock-nse-india';
import axios from 'axios';
import { db } from '../db';
import { listedStocks } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

const nse = new NseIndia();

export interface ExchangeStockData {
  symbol: string;
  companyName: string;
  isin?: string;
  exchange: 'NSE' | 'BSE';
  sector?: string;
  industry?: string;
  marketCap?: string;
  marketCapValue?: number;
  currentPrice?: number;
  previousClose?: number;
  dayChange?: number;
  dayChangePercent?: number;
  weekHigh52?: number;
  weekLow52?: number;
  peRatio?: number;
  pbRatio?: number;
  dividendYield?: number;
  eps?: number;
  returns1Y?: number;
  returns3Y?: number;
  analystRating?: string;
  bseCode?: string;
  nseCode?: string;
}

export interface SyncProgress {
  exchange: 'NSE' | 'BSE';
  status: 'idle' | 'fetching_symbols' | 'fetching_details' | 'saving' | 'complete' | 'error';
  total: number;
  processed: number;
  added: number;
  updated: number;
  errors: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

class ExchangeStockService {
  private nseProgress: SyncProgress = { exchange: 'NSE', status: 'idle', total: 0, processed: 0, added: 0, updated: 0, errors: 0 };
  private bseProgress: SyncProgress = { exchange: 'BSE', status: 'idle', total: 0, processed: 0, added: 0, updated: 0, errors: 0 };
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

  getSyncProgress(exchange: 'NSE' | 'BSE'): SyncProgress {
    return exchange === 'NSE' ? { ...this.nseProgress } : { ...this.bseProgress };
  }

  async getAllNSESymbols(): Promise<string[]> {
    const cacheKey = 'nse_symbols';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const symbols = await nse.getAllStockSymbols();
      this.cache.set(cacheKey, { data: symbols, timestamp: Date.now() });
      return symbols;
    } catch (error) {
      console.error('[Exchange Service] Failed to fetch NSE symbols:', error);
      throw error;
    }
  }

  async getNSEStockDetails(symbol: string): Promise<ExchangeStockData | null> {
    try {
      const details = await nse.getEquityDetails(symbol) as any;
      if (!details) return null;

      const info = details.info || {};
      const priceInfo = details.priceInfo || {};
      const metadata = details.metadata || {};
      const securityInfo = details.securityInfo || {};

      const issuedSize = parseFloat(String(securityInfo.issuedSize || securityInfo.issuedCap || 0));
      const lastPrice = parseFloat(String(priceInfo.lastPrice || 0));
      const marketCapValue = issuedSize * lastPrice;
      const marketCapStr = this.determineMarketCapCategory(marketCapValue);

      return {
        symbol: info.symbol || symbol,
        companyName: info.companyName || metadata.companyName || info.name || symbol,
        isin: metadata.isin || info.isin,
        exchange: 'NSE',
        sector: metadata.industry || info.industry,
        industry: metadata.industry,
        marketCap: marketCapStr,
        marketCapValue: marketCapValue / 10000000, // in crores
        currentPrice: lastPrice,
        previousClose: parseFloat(String(priceInfo.previousClose || 0)),
        dayChange: parseFloat(String(priceInfo.change || 0)),
        dayChangePercent: parseFloat(String(priceInfo.pChange || 0)),
        weekHigh52: parseFloat(String(priceInfo.weekHighLow?.max || 0)),
        weekLow52: parseFloat(String(priceInfo.weekHighLow?.min || 0)),
        peRatio: undefined, // Will be populated from other sources if available
        pbRatio: undefined,
        dividendYield: undefined,
        nseCode: 'EQ',
      };
    } catch (error) {
      console.warn(`[Exchange Service] Failed to fetch NSE details for ${symbol}:`, error);
      return null;
    }
  }

  async getBSEStockDetails(bseCode: string, symbol?: string): Promise<ExchangeStockData | null> {
    try {
      // Use Yahoo Finance with .BO suffix for BSE stocks
      const tickerSymbol = symbol ? `${symbol}.BO` : bseCode;
      const response = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${tickerSymbol}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const result = response.data?.chart?.result?.[0];
      if (!result) return null;

      const meta = result.meta || {};
      const quote = result.indicators?.quote?.[0] || {};

      return {
        symbol: symbol || meta.symbol?.replace('.BO', ''),
        companyName: meta.shortName || meta.longName || symbol || '',
        exchange: 'BSE',
        bseCode: bseCode,
        currentPrice: meta.regularMarketPrice,
        previousClose: meta.previousClose || meta.chartPreviousClose,
        dayChange: meta.regularMarketPrice - (meta.previousClose || 0),
        dayChangePercent: ((meta.regularMarketPrice - (meta.previousClose || 0)) / (meta.previousClose || 1)) * 100,
        weekHigh52: meta.fiftyTwoWeekHigh,
        weekLow52: meta.fiftyTwoWeekLow,
        marketCap: this.determineMarketCapCategory(meta.marketCap),
        marketCapValue: meta.marketCap ? meta.marketCap / 10000000 : undefined, // in crores
      };
    } catch (error) {
      console.warn(`[Exchange Service] Failed to fetch BSE details for ${bseCode}:`, error);
      return null;
    }
  }

  private determineMarketCapCategory(marketCapInCr?: number): string {
    if (!marketCapInCr) return 'Unknown';
    const mcapCr = marketCapInCr / 10000000; // Convert to crores if in raw value
    if (mcapCr >= 20000) return 'Large Cap';
    if (mcapCr >= 5000) return 'Mid Cap';
    return 'Small Cap';
  }

  async syncNSEStocks(options: { limit?: number; topOnly?: boolean } = {}): Promise<SyncProgress> {
    if (this.nseProgress.status !== 'idle' && this.nseProgress.status !== 'complete' && this.nseProgress.status !== 'error') {
      return this.nseProgress;
    }

    this.nseProgress = {
      exchange: 'NSE',
      status: 'fetching_symbols',
      total: 0,
      processed: 0,
      added: 0,
      updated: 0,
      errors: 0,
      startedAt: new Date()
    };

    try {
      console.log('[Exchange Service] Starting NSE stock sync...');
      
      let targetSymbols: string[];

      // If topOnly, use curated list directly without fetching all symbols
      if (options.topOnly) {
        targetSymbols = this.getTopNSESymbols();
      } else {
        // Fetch all NSE symbols only when not using top-only mode
        targetSymbols = await this.getAllNSESymbols();
      }

      // Apply limit if specified
      if (options.limit && options.limit > 0) {
        targetSymbols = targetSymbols.slice(0, options.limit);
      }

      this.nseProgress.total = targetSymbols.length;
      this.nseProgress.status = 'fetching_details';

      console.log(`[Exchange Service] Syncing ${targetSymbols.length} NSE stocks...`);

      // Process in batches to avoid rate limiting
      const batchSize = 5;
      for (let i = 0; i < targetSymbols.length; i += batchSize) {
        const batch = targetSymbols.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (symbol) => {
          try {
            const stockData = await this.getNSEStockDetails(symbol);
            if (stockData) {
              const result = await this.upsertStock(stockData);
              if (result === 'added') {
                this.nseProgress.added++;
              } else {
                this.nseProgress.updated++;
              }
            }
          } catch (error) {
            console.warn(`[Exchange Service] Error processing ${symbol}:`, error);
            this.nseProgress.errors++;
          }
          this.nseProgress.processed++;
        }));

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < targetSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      this.nseProgress.status = 'complete';
      this.nseProgress.completedAt = new Date();
      console.log(`[Exchange Service] NSE sync complete. Added/Updated: ${this.nseProgress.added}, Errors: ${this.nseProgress.errors}`);
      
      return this.nseProgress;
    } catch (error) {
      this.nseProgress.status = 'error';
      this.nseProgress.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Exchange Service] NSE sync failed:', error);
      return this.nseProgress;
    }
  }

  async syncBSEStocks(options: { limit?: number; topOnly?: boolean } = {}): Promise<SyncProgress> {
    if (this.bseProgress.status !== 'idle' && this.bseProgress.status !== 'complete' && this.bseProgress.status !== 'error') {
      return this.bseProgress;
    }

    this.bseProgress = {
      exchange: 'BSE',
      status: 'fetching_symbols',
      total: 0,
      processed: 0,
      added: 0,
      updated: 0,
      errors: 0,
      startedAt: new Date()
    };

    try {
      console.log('[Exchange Service] Starting BSE stock sync...');
      
      // Get top BSE stocks (using predefined list since BSE doesn't have a free symbol API)
      let targetSymbols = this.getTopBSEStocks();

      if (options.limit && options.limit > 0) {
        targetSymbols = targetSymbols.slice(0, options.limit);
      }

      this.bseProgress.total = targetSymbols.length;
      this.bseProgress.status = 'fetching_details';

      console.log(`[Exchange Service] Syncing ${targetSymbols.length} BSE stocks...`);

      // Process in batches
      const batchSize = 3;
      for (let i = 0; i < targetSymbols.length; i += batchSize) {
        const batch = targetSymbols.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async ({ symbol, bseCode }) => {
          try {
            const stockData = await this.getBSEStockDetails(bseCode, symbol);
            if (stockData) {
              const result = await this.upsertStock(stockData);
              if (result === 'added') {
                this.bseProgress.added++;
              } else {
                this.bseProgress.updated++;
              }
            }
          } catch (error) {
            console.warn(`[Exchange Service] Error processing BSE ${symbol}:`, error);
            this.bseProgress.errors++;
          }
          this.bseProgress.processed++;
        }));

        // Delay between batches
        if (i + batchSize < targetSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.bseProgress.status = 'complete';
      this.bseProgress.completedAt = new Date();
      console.log(`[Exchange Service] BSE sync complete. Added/Updated: ${this.bseProgress.added}, Errors: ${this.bseProgress.errors}`);
      
      return this.bseProgress;
    } catch (error) {
      this.bseProgress.status = 'error';
      this.bseProgress.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Exchange Service] BSE sync failed:', error);
      return this.bseProgress;
    }
  }

  private async upsertStock(data: ExchangeStockData): Promise<'added' | 'updated'> {
    const existing = await db.select().from(listedStocks).where(eq(listedStocks.symbol, data.symbol)).limit(1);

    const stockRecord = {
      symbol: data.symbol,
      companyName: data.companyName,
      isin: data.isin,
      bseCode: data.bseCode,
      nseCode: data.nseCode,
      sector: data.sector,
      industry: data.industry,
      marketCap: data.marketCap,
      marketCapValue: data.marketCapValue?.toString(),
      currentPrice: data.currentPrice?.toString(),
      previousClose: data.previousClose?.toString(),
      dayChange: data.dayChange?.toString(),
      dayChangePercent: data.dayChangePercent?.toString(),
      weekHigh52: data.weekHigh52?.toString(),
      weekLow52: data.weekLow52?.toString(),
      peRatio: data.peRatio?.toString(),
      pbRatio: data.pbRatio?.toString(),
      dividendYield: data.dividendYield?.toString(),
      eps: data.eps?.toString(),
      returns1Y: data.returns1Y?.toString(),
      returns3Y: data.returns3Y?.toString(),
      analystRating: data.analystRating,
      lastUpdated: new Date(),
    };

    if (existing.length > 0) {
      await db.update(listedStocks)
        .set(stockRecord)
        .where(eq(listedStocks.symbol, data.symbol));
      return 'updated';
    } else {
      await db.insert(listedStocks).values({
        ...stockRecord,
        isPublished: false, // New stocks start unpublished
      });
      return 'added';
    }
  }

  getTopNSESymbols(): string[] {
    // NIFTY 50 + NIFTY Next 50 stocks
    return [
      'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
      'LT', 'AXISBANK', 'BAJFINANCE', 'ASIANPAINT', 'MARUTI', 'HCLTECH', 'WIPRO', 'SUNPHARMA', 'ULTRACEMCO', 'TITAN',
      'NTPC', 'ONGC', 'POWERGRID', 'TECHM', 'M&M', 'NESTLEIND', 'TATAMOTORS', 'JSWSTEEL', 'TATASTEEL', 'ADANIENT',
      'COALINDIA', 'BAJAJFINSV', 'GRASIM', 'DIVISLAB', 'CIPLA', 'DRREDDY', 'BRITANNIA', 'EICHERMOT', 'BPCL', 'INDUSINDBK',
      'HEROMOTOCO', 'APOLLOHOSP', 'TATACONSUM', 'SBILIFE', 'HINDALCO', 'ADANIPORTS', 'HDFCLIFE', 'BAJAJ-AUTO', 'SHREECEM', 'UPL',
      // NIFTY Next 50
      'AMBUJACEM', 'BANKBARODA', 'BERGEPAINT', 'BIOCON', 'BOSCHLTD', 'CHOLAFIN', 'COLPAL', 'CONCOR', 'DABUR', 'DLF',
      'GAIL', 'GODREJCP', 'HAVELLS', 'ICICIGI', 'ICICIPRULI', 'INDHOTEL', 'INDUSTOWER', 'IOC', 'IRCTC', 'JINDALSTEL',
      'LICI', 'LUPIN', 'MARICO', 'MCDOWELL-N', 'MUTHOOTFIN', 'NAUKRI', 'NMDC', 'PAGEIND', 'PEL', 'PETRONET',
      'PFC', 'PIDILITIND', 'PIIND', 'PNB', 'RECLTD', 'SRF', 'TATAPOWER', 'TORNTPHARM', 'TRENT', 'VEDL',
      'ZOMATO', 'DMART', 'ADANIGREEN', 'ADANITRANS', 'ATGL', 'LODHA', 'HAL', 'BEL', 'NHPC', 'IRFC'
    ];
  }

  getTopBSEStocks(): { symbol: string; bseCode: string }[] {
    // SENSEX 30 + additional top BSE stocks with their BSE codes
    return [
      { symbol: 'RELIANCE', bseCode: '500325' },
      { symbol: 'TCS', bseCode: '532540' },
      { symbol: 'HDFCBANK', bseCode: '500180' },
      { symbol: 'INFY', bseCode: '500209' },
      { symbol: 'ICICIBANK', bseCode: '532174' },
      { symbol: 'HINDUNILVR', bseCode: '500696' },
      { symbol: 'ITC', bseCode: '500875' },
      { symbol: 'SBIN', bseCode: '500112' },
      { symbol: 'BHARTIARTL', bseCode: '532454' },
      { symbol: 'KOTAKBANK', bseCode: '500247' },
      { symbol: 'LT', bseCode: '500510' },
      { symbol: 'AXISBANK', bseCode: '532215' },
      { symbol: 'BAJFINANCE', bseCode: '500034' },
      { symbol: 'ASIANPAINT', bseCode: '500820' },
      { symbol: 'MARUTI', bseCode: '532500' },
      { symbol: 'HCLTECH', bseCode: '532281' },
      { symbol: 'WIPRO', bseCode: '507685' },
      { symbol: 'SUNPHARMA', bseCode: '524715' },
      { symbol: 'ULTRACEMCO', bseCode: '532538' },
      { symbol: 'TITAN', bseCode: '500114' },
      { symbol: 'NTPC', bseCode: '532555' },
      { symbol: 'ONGC', bseCode: '500312' },
      { symbol: 'POWERGRID', bseCode: '532898' },
      { symbol: 'TECHM', bseCode: '532755' },
      { symbol: 'M&M', bseCode: '500520' },
      { symbol: 'NESTLEIND', bseCode: '500790' },
      { symbol: 'TATAMOTORS', bseCode: '500570' },
      { symbol: 'JSWSTEEL', bseCode: '500228' },
      { symbol: 'TATASTEEL', bseCode: '500470' },
      { symbol: 'INDUSINDBK', bseCode: '532187' },
    ];
  }

  resetProgress(exchange: 'NSE' | 'BSE'): void {
    if (exchange === 'NSE') {
      this.nseProgress = { exchange: 'NSE', status: 'idle', total: 0, processed: 0, added: 0, updated: 0, errors: 0 };
    } else {
      this.bseProgress = { exchange: 'BSE', status: 'idle', total: 0, processed: 0, added: 0, updated: 0, errors: 0 };
    }
  }
}

export const exchangeStockService = new ExchangeStockService();
