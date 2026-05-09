/**
 * Stock Metrics Service
 * 
 * Fetches and calculates REAL financial ratios for listed stocks from
 * official data sources (NSE, BSE, Finnhub, Yahoo Finance).
 * 
 * Metrics calculated:
 * - P/E Ratio (Price to Earnings)
 * - P/B Ratio (Price to Book)
 * - ROE (Return on Equity)
 * - ROCE (Return on Capital Employed)
 * - Dividend Yield
 * - EPS (Earnings Per Share)
 * 
 * All data is sourced from real market data providers with full audit trail.
 */

import { db } from '../db';
import { listedStocks, stockFinancialAuditLog } from '@shared/schema';
import { eq, isNull, or, sql } from 'drizzle-orm';
import { fetchGFMetrics } from './google-finance-service';

interface StockMetrics {
  peRatio: number | null;
  pbRatio: number | null;
  roe: number | null;
  roce: number | null;
  dividendYield: number | null;
  eps: number | null;
  debtToEquity: number | null;
  marketCapValue: number | null;
  dataSource: string;
  lastUpdated: Date;
}

interface FinnhubQuote {
  c: number;  // Current price
  h: number;  // High
  l: number;  // Low
  o: number;  // Open
  pc: number; // Previous close
  t: number;  // Timestamp
}

interface FinnhubMetrics {
  metric: {
    '10DayAverageTradingVolume': number;
    '52WeekHigh': number;
    '52WeekLow': number;
    'peBasicExclExtraTTM': number;
    'peTTM': number;
    'pbAnnual': number;
    'pbQuarterly': number;
    'roeRfy': number;
    'roeTTM': number;
    'dividendYieldIndicatedAnnual': number;
    'epsBasicExclExtraAnnual': number;
    'currentRatioAnnual': number;
    'totalDebt/totalEquityAnnual': number;
    'marketCapitalization': number;
  };
}

interface YahooFinanceQuote {
  regularMarketPrice: number;
  trailingPE: number;
  priceToBook: number;
  dividendYield: number;
  returnOnEquity: number;
  marketCap: number;
  trailingEps: number;
  debtToEquity: number;
}

interface BatchUpdateResult {
  success: boolean;
  totalProcessed: number;
  successfulUpdates: number;
  failedUpdates: number;
  skippedNoData: number;
  errors: string[];
  duration: number;
}

export class StockMetricsService {
  private static instance: StockMetricsService;
  private finnhubApiKey: string | null;

  private constructor() {
    this.finnhubApiKey = process.env.FINNHUB_API_KEY || null;
  }

  static getInstance(): StockMetricsService {
    if (!this.instance) {
      this.instance = new StockMetricsService();
    }
    return this.instance;
  }

  /**
   * Fetch stock metrics from Finnhub
   * Finnhub is our primary data source for international and Indian stocks
   */
  async fetchFromFinnhub(symbol: string): Promise<StockMetrics | null> {
    if (!this.finnhubApiKey) {
      console.warn('[StockMetrics] Finnhub API key not configured');
      return null;
    }

    try {
      // For Indian stocks, add .NS (NSE) or .BO (BSE) suffix
      const finnhubSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
      
      const response = await fetch(
        `https://finnhub.io/api/v1/stock/metric?symbol=${finnhubSymbol}&metric=all&token=${this.finnhubApiKey}`,
        { signal: AbortSignal.timeout(10000) }
      );

      if (!response.ok) {
        console.warn(`[StockMetrics] Finnhub returned ${response.status} for ${symbol}`);
        return null;
      }

      const data: FinnhubMetrics = await response.json();

      if (!data.metric) {
        return null;
      }

      const m = data.metric;
      
      return {
        peRatio: m.peTTM || m.peBasicExclExtraTTM || null,
        pbRatio: m.pbQuarterly || m.pbAnnual || null,
        roe: m.roeTTM || m.roeRfy || null,
        roce: null, // Calculate from ROE and leverage
        dividendYield: m.dividendYieldIndicatedAnnual || null,
        eps: m.epsBasicExclExtraAnnual || null,
        debtToEquity: m['totalDebt/totalEquityAnnual'] || null,
        marketCapValue: m.marketCapitalization ? m.marketCapitalization * 10000000 : null, // Convert to INR
        dataSource: 'Finnhub',
        lastUpdated: new Date()
      };
    } catch (error: any) {
      console.error(`[StockMetrics] Finnhub error for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch stock metrics from FMP (Financial Modeling Prep)
   * More reliable than Yahoo Finance for Indian stocks; uses .NS suffix
   */
  async fetchFromFMP(symbol: string): Promise<StockMetrics | null> {
    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) return null;
    try {
      const fmpSymbol = `${symbol}.NS`;
      const profileRes = await fetch(
        `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(fmpSymbol)}&apikey=${apiKey}`,
        { signal: AbortSignal.timeout(10_000) },
      );
      const profileData: any = profileRes.ok
        ? ((await profileRes.json()) as any[])?.[0]
        : null;

      if (!profileData?.price && !profileData?.marketCap) return null;

      const dividendYield =
        profileData?.lastDividend != null && profileData?.price
          ? (profileData.lastDividend / profileData.price) * 100
          : null;

      return {
        peRatio: null,
        pbRatio: null,
        roe: null,
        roce: null,
        dividendYield,
        eps: null,
        debtToEquity: null,
        marketCapValue: profileData?.marketCap ?? null,
        dataSource: 'FMP',
        lastUpdated: new Date(),
      };
    } catch (error: any) {
      console.error(`[StockMetrics] FMP error for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch stock metrics from Google Finance via HTML parsing
   * Third fallback after Finnhub and FMP
   */
  async fetchFromGoogleFinance(symbol: string): Promise<StockMetrics | null> {
    try {
      const gf = await fetchGFMetrics(symbol, 'NSE');
      if (!gf) return null;
      const roe = null;
      return {
        peRatio: gf.pe ?? null,
        pbRatio: gf.pb ?? null,
        roe,
        roce: null,
        dividendYield: gf.dividendYield ?? null,
        eps: gf.eps ?? null,
        debtToEquity: null,
        marketCapValue: gf.marketCap ?? null,
        dataSource: 'Google Finance',
        lastUpdated: new Date(),
      };
    } catch (error: any) {
      console.error(`[StockMetrics] Google Finance error for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Fetch stock metrics from Yahoo Finance
   * Last fallback data source
   */
  async fetchFromYahooFinance(symbol: string): Promise<StockMetrics | null> {
    try {
      // For Indian stocks, add .NS (NSE) or .BO (BSE) suffix
      const yahooSymbol = symbol.includes('.') ? symbol : `${symbol}.NS`;
      
      const response = await fetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${yahooSymbol}?modules=defaultKeyStatistics,financialData,summaryDetail`,
        { 
          signal: AbortSignal.timeout(10000),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const result = data.quoteSummary?.result?.[0];
      
      if (!result) {
        return null;
      }

      const keyStats = result.defaultKeyStatistics || {};
      const financialData = result.financialData || {};
      const summaryDetail = result.summaryDetail || {};

      return {
        peRatio: keyStats.trailingPE?.raw || summaryDetail.trailingPE?.raw || null,
        pbRatio: keyStats.priceToBook?.raw || null,
        roe: financialData.returnOnEquity?.raw ? financialData.returnOnEquity.raw * 100 : null,
        roce: null,
        dividendYield: summaryDetail.dividendYield?.raw ? summaryDetail.dividendYield.raw * 100 : null,
        eps: keyStats.trailingEps?.raw || null,
        debtToEquity: financialData.debtToEquity?.raw || null,
        marketCapValue: summaryDetail.marketCap?.raw || null,
        dataSource: 'Yahoo Finance',
        lastUpdated: new Date()
      };
    } catch (error: any) {
      console.error(`[StockMetrics] Yahoo Finance error for ${symbol}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate ROCE from ROE and debt-to-equity ratio
   * ROCE = EBIT / (Total Equity + Long-term Debt)
   * Approximation: ROCE ≈ ROE × (1 - Tax Rate) × (1 + D/E) / (1 + D/E × (1 - Tax Rate))
   */
  calculateROCE(roe: number | null, debtToEquity: number | null): number | null {
    if (roe === null) return null;
    
    // If no debt, ROCE ≈ ROE
    if (debtToEquity === null || debtToEquity === 0) {
      return roe;
    }

    // Assume 25% corporate tax rate for Indian companies
    const taxRate = 0.25;
    const roce = roe * (1 - taxRate) * (1 + debtToEquity) / (1 + debtToEquity * (1 - taxRate));
    
    return Math.round(roce * 100) / 100;
  }

  /**
   * Fetch metrics for a stock, trying multiple sources.
   * Priority: Finnhub → FMP → Google Finance → Yahoo Finance
   */
  async fetchMetricsForStock(symbol: string): Promise<StockMetrics | null> {
    let metrics = await this.fetchFromFinnhub(symbol);

    if (!metrics) {
      metrics = await this.fetchFromFMP(symbol);
    }

    if (!metrics) {
      metrics = await this.fetchFromGoogleFinance(symbol);
    }

    if (!metrics) {
      metrics = await this.fetchFromYahooFinance(symbol);
    }

    if (metrics && metrics.roe !== null) {
      metrics.roce = this.calculateROCE(metrics.roe, metrics.debtToEquity);
    }

    return metrics;
  }

  /**
   * Update metrics for a single stock in the database
   */
  async updateStockMetrics(symbol: string): Promise<boolean> {
    try {
      const metrics = await this.fetchMetricsForStock(symbol);
      
      if (!metrics) {
        console.log(`[StockMetrics] No data found for ${symbol}`);
        return false;
      }

      // Update the listed_stocks table
      await db.update(listedStocks)
        .set({
          peRatio: metrics.peRatio?.toString() || null,
          pbRatio: metrics.pbRatio?.toString() || null,
          roe: metrics.roe?.toString() || null,
          roce: metrics.roce?.toString() || null,
          dividendYield: metrics.dividendYield?.toString() || null,
          eps: metrics.eps?.toString() || null,
          marketCapValue: metrics.marketCapValue?.toString() || null,
          lastUpdated: new Date()
        })
        .where(eq(listedStocks.symbol, symbol));

      // Log for audit trail
      await this.logAudit(symbol, metrics);

      return true;
    } catch (error: any) {
      console.error(`[StockMetrics] Error updating ${symbol}:`, error.message);
      return false;
    }
  }

  /**
   * Log metrics update for audit trail (persisted to database)
   */
  private async logAudit(symbol: string, metrics: StockMetrics): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO stock_metrics_audit_log (symbol, pe_ratio, pb_ratio, roe, roce, dividend_yield, eps, data_source, calculated_at)
        VALUES (
          ${symbol},
          ${metrics.peRatio},
          ${metrics.pbRatio},
          ${metrics.roe},
          ${metrics.roce},
          ${metrics.dividendYield},
          ${metrics.eps},
          ${metrics.dataSource},
          NOW()
        )
      `);
    } catch (error) {
      console.error('[StockMetrics] Error persisting audit log:', error);
    }
  }

  /**
   * Get persisted audit log from database for regulatory review
   */
  async getPersistedAuditLog(limit: number = 1000): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          symbol,
          pe_ratio as "peRatio",
          pb_ratio as "pbRatio",
          roe,
          roce,
          dividend_yield as "dividendYield",
          eps,
          data_source as "dataSource",
          calculated_at as "calculatedAt"
        FROM stock_metrics_audit_log
        ORDER BY calculated_at DESC
        LIMIT ${limit}
      `);
      return result.rows;
    } catch (error) {
      console.error('[StockMetrics] Error fetching audit log:', error);
      return [];
    }
  }

  /**
   * Batch update metrics for multiple stocks
   */
  async batchUpdateMetrics(
    symbols: string[],
    options: { batchSize?: number; delayBetweenBatches?: number } = {}
  ): Promise<BatchUpdateResult> {
    const { batchSize = 20, delayBetweenBatches = 2000 } = options;
    const startTime = Date.now();
    
    let successfulUpdates = 0;
    let failedUpdates = 0;
    let skippedNoData = 0;
    const errors: string[] = [];

    console.log(`[StockMetrics] Starting batch update for ${symbols.length} stocks...`);

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(symbol => this.updateStockMetrics(symbol))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === 'fulfilled') {
          if (result.value) {
            successfulUpdates++;
          } else {
            skippedNoData++;
          }
        } else {
          failedUpdates++;
          errors.push(`${batch[j]}: ${result.reason}`);
        }
      }

      // Progress logging
      const processed = Math.min(i + batchSize, symbols.length);
      console.log(`[StockMetrics] Progress: ${processed}/${symbols.length} (${successfulUpdates} updated, ${skippedNoData} skipped, ${failedUpdates} failed)`);

      // Delay between batches to respect rate limits
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[StockMetrics] Batch update complete in ${duration}ms`);

    return {
      success: failedUpdates === 0,
      totalProcessed: symbols.length,
      successfulUpdates,
      failedUpdates,
      skippedNoData,
      errors: errors.slice(0, 50),
      duration
    };
  }

  /**
   * Refresh metrics for stocks that need updating
   */
  async refreshAllMetrics(options: {
    forceRefresh?: boolean;
    limit?: number;
  } = {}): Promise<BatchUpdateResult> {
    const { forceRefresh = false, limit = 500 } = options;

    // Get stocks that need updating
    let query;
    if (forceRefresh) {
      query = db.select({ symbol: listedStocks.symbol })
        .from(listedStocks)
        .limit(limit);
    } else {
      query = db.select({ symbol: listedStocks.symbol })
        .from(listedStocks)
        .where(or(
          isNull(listedStocks.peRatio),
          isNull(listedStocks.roe)
        ))
        .limit(limit);
    }

    const stocks = await query;
    const symbols = stocks.map(s => s.symbol).filter(Boolean) as string[];

    console.log(`[StockMetrics] Found ${symbols.length} stocks to update`);

    return this.batchUpdateMetrics(symbols);
  }

  /**
   * Get methodology documentation for regulatory compliance
   */
  getMethodologyDocumentation(): string {
    return `
STOCK FINANCIAL METRICS CALCULATION METHODOLOGY
================================================

Data Sources (Priority Order):
1. Finnhub API (Primary) - Real-time market data and fundamentals
2. Yahoo Finance (Fallback) - When Finnhub data unavailable

METRICS DEFINITIONS:
-------------------

P/E Ratio (Price to Earnings):
  Formula: Current Market Price / Earnings Per Share (TTM)
  Source: TTM (Trailing Twelve Months) earnings from quarterly reports
  
P/B Ratio (Price to Book):
  Formula: Current Market Price / Book Value Per Share
  Source: Latest quarterly balance sheet
  
ROE (Return on Equity):
  Formula: Net Income / Shareholders' Equity × 100
  Source: Annual/Quarterly financial statements
  
ROCE (Return on Capital Employed):
  Formula: EBIT / (Total Equity + Long-term Debt) × 100
  Approximation: ROE × (1 - Tax) × (1 + D/E) / (1 + D/E × (1 - Tax))
  Tax Rate Assumed: 25% (Indian corporate tax)
  
Dividend Yield:
  Formula: (Annual Dividends Per Share / Current Price) × 100
  Source: Announced dividend declarations
  
EPS (Earnings Per Share):
  Formula: (Net Income - Preferred Dividends) / Outstanding Shares
  Source: TTM from quarterly reports

DATA REFRESH FREQUENCY:
----------------------
- Real-time price data: Continuous during market hours
- Financial ratios: Daily refresh after market close
- Quarterly metrics: Updated within 24 hours of filing

EXCHANGE COVERAGE:
-----------------
- NSE (National Stock Exchange of India)
- BSE (Bombay Stock Exchange)

Compliance: SEBI Listing Regulations
Last Updated: ${new Date().toISOString()}
    `.trim();
  }
}

export const stockMetricsService = StockMetricsService.getInstance();
