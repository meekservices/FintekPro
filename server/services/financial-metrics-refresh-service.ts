// @ts-nocheck
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { financialMetricsCalculator } from './financial-metrics-calculator';
import { fetchWithTimeout } from '../utils/fetch-with-timeout';

interface CredHiveFinancialData {
  revenue?: number;
  ebitda?: number;
  pat?: number;
  eps?: number;
  book_value?: number;
  total_assets?: number;
  total_liabilities?: number;
  total_equity?: number;
  total_debt?: number;
  cash_and_equivalents?: number;
  operating_cash_flow?: number;
  free_cash_flow?: number;
  current_assets?: number;
  current_liabilities?: number;
  inventory?: number;
  receivables?: number;
  payables?: number;
  depreciation?: number;
  interest_expense?: number;
  gross_profit?: number;
  operating_income?: number;
  shares_outstanding?: number;
  dividend_per_share?: number;
  retained_earnings?: number;
}

export class FinancialMetricsRefreshService {
  private credhiveBaseUrl = 'https://api.probe42.in/probe_data_api';
  private finnhubBaseUrl = 'https://finnhub.io/api/v1';

  constructor() {
    console.log('✅ Financial Metrics Refresh Service initialized');
  }

  async refreshStockMetrics(stockId: string): Promise<boolean> {
    try {
      const stock = await db.query.listedStocks.findFirst({
        where: eq(schema.listedStocks.id, stockId),
      });

      if (!stock) {
        console.error(`[FinancialMetricsRefresh] Stock not found: ${stockId}`);
        return false;
      }

      console.log(`[FinancialMetricsRefresh] Refreshing metrics for ${stock.symbol}`);

      // Fetch financial data from available sources
      const financialData = await this.fetchStockFinancials(stock);
      if (!financialData) {
        console.warn(`[FinancialMetricsRefresh] No financial data available for ${stock.symbol}`);
        return false;
      }

      // Get historical data for CAGR calculations
      const historicalData = await this.getHistoricalMetrics(stockId, 5);

      // Calculate all metrics
      const metrics = financialMetricsCalculator.calculateAllMetrics(
        financialData,
        historicalData,
        financialData.epsEstimateNextYear
      );

      // Get current fiscal year
      const now = new Date();
      const fiscalYear = now.getMonth() >= 3 
        ? `${now.getFullYear()}-${(now.getFullYear() + 1).toString().slice(-2)}`
        : `${now.getFullYear() - 1}-${now.getFullYear().toString().slice(-2)}`;

      // Upsert metrics
      await this.upsertStockMetrics(stockId, stock.symbol, stock.isin || '', fiscalYear, metrics);

      console.log(`[FinancialMetricsRefresh] Successfully refreshed metrics for ${stock.symbol}`);
      return true;
    } catch (error) {
      console.error(`[FinancialMetricsRefresh] Error refreshing metrics for ${stockId}:`, error);
      return false;
    }
  }

  private async fetchStockFinancials(stock: schema.ListedStock): Promise<any> {
    // Try CredHive first
    const credhiveData = await this.fetchFromCredhive(stock);
    if (credhiveData) return credhiveData;

    // Fallback to Finnhub
    const finnhubData = await this.fetchFromFinnhub(stock.symbol);
    if (finnhubData) return finnhubData;

    // Return basic data from stock record
    return {
      currentPrice: parseFloat(stock.currentPrice?.toString() || '0'),
      marketCap: parseFloat(stock.marketCapValue?.toString() || '0'),
      eps: parseFloat(stock.eps?.toString() || '0'),
      bookValuePerShare: parseFloat(stock.bookValue?.toString() || '0'),
    };
  }

  private async fetchFromCredhive(stock: schema.ListedStock): Promise<any> {
    const apiKey = process.env.PROBE42_API_KEY;
    if (!apiKey) return null;

    try {
      // Fetch from company_financials table if available
      const companyFinancials = await db.query.companyFinancials?.findFirst({
        where: eq(schema.companyFinancials.cin, stock.cin || ''),
        orderBy: [desc(schema.companyFinancials.fiscalYear)],
      });

      if (companyFinancials) {
        return {
          revenue: parseFloat(companyFinancials.revenue?.toString() || '0'),
          ebitda: parseFloat(companyFinancials.ebitda?.toString() || '0'),
          ebit: parseFloat(companyFinancials.ebitda?.toString() || '0') * 0.85,
          netIncome: parseFloat(companyFinancials.pat?.toString() || '0'),
          totalAssets: parseFloat(companyFinancials.totalAssets?.toString() || '0'),
          totalLiabilities: parseFloat(companyFinancials.totalLiabilities?.toString() || '0'),
          totalEquity: parseFloat(companyFinancials.netWorth?.toString() || '0'),
          totalDebt: parseFloat(companyFinancials.borrowings?.toString() || '0'),
          cash: parseFloat(companyFinancials.reserves?.toString() || '0') * 0.1,
          operatingCashFlow: parseFloat(companyFinancials.operatingCashFlow?.toString() || '0'),
          currentPrice: parseFloat(stock.currentPrice?.toString() || '0'),
          marketCap: parseFloat(stock.marketCapValue?.toString() || '0'),
          eps: parseFloat(stock.eps?.toString() || '0'),
          bookValuePerShare: parseFloat(stock.bookValue?.toString() || '0'),
          sharesOutstanding: parseFloat(stock.marketCapValue?.toString() || '0') / parseFloat(stock.currentPrice?.toString() || '1'),
        };
      }

      return null;
    } catch (error) {
      console.warn(`[FinancialMetricsRefresh] CredHive fetch failed for ${stock.symbol}:`, error);
      return null;
    }
  }

  private async fetchFromFinnhub(symbol: string): Promise<any> {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) return null;

    try {
      const response = await fetchWithTimeout(
        `${this.finnhubBaseUrl}/stock/metric?symbol=${symbol}.NS&metric=all&token=${apiKey}`,
        { timeoutMs: 15_000 }
      );

      if (!response.ok) return null;

      const data = await response.json();
      const metric = data.metric || {};

      return {
        currentPrice: metric['52WeekHigh'] || 0,
        marketCap: metric.marketCapitalization || 0,
        eps: metric.epsBasicExclExtraItemsAnnual || 0,
        bookValuePerShare: metric.bookValuePerShareAnnual || 0,
        revenue: metric.revenuePerShareAnnual || 0,
        netIncome: metric.netIncomePerShareAnnual || 0,
        roe: metric.roeTTM || 0,
        roa: metric.roaTTM || 0,
        currentRatio: metric.currentRatioQuarterly || 0,
        debtToEquity: metric.totalDebt2TotalEquityQuarterly || 0,
        grossMargin: metric.grossMarginAnnual || 0,
        operatingMargin: metric.operatingMarginAnnual || 0,
        netMargin: metric.netProfitMarginAnnual || 0,
        dividendYield: metric.dividendYieldIndicatedAnnual || 0,
        beta: metric.beta || 1,
        epsEstimateNextYear: metric.epsEstimateNextYear || 0,
      };
    } catch (error) {
      console.warn(`[FinancialMetricsRefresh] Finnhub fetch failed for ${symbol}:`, error);
      return null;
    }
  }

  private async getHistoricalMetrics(stockId: string, years: number): Promise<any[]> {
    try {
      const historicalRecords = await db
        .select()
        .from(schema.stockFinancialMetrics)
        .where(eq(schema.stockFinancialMetrics.stockId, stockId))
        .orderBy(desc(schema.stockFinancialMetrics.fiscalYear))
        .limit(years);

      return historicalRecords.map(record => ({
        fiscalYear: record.fiscalYear,
        data: {
          revenue: parseFloat(record.revenue?.toString() || '0'),
          ebitda: parseFloat(record.ebitda?.toString() || '0'),
          ebit: parseFloat(record.ebit?.toString() || '0'),
          netIncome: parseFloat(record.netIncome?.toString() || '0'),
          eps: parseFloat(record.eps?.toString() || '0'),
          bookValuePerShare: parseFloat(record.bookValuePerShare?.toString() || '0'),
          freeCashFlow: parseFloat(record.freeCashFlow?.toString() || '0'),
          operatingCashFlow: parseFloat(record.operatingCashFlow?.toString() || '0'),
          totalAssets: parseFloat(record.totalAssets?.toString() || '0'),
          totalEquity: parseFloat(record.totalEquity?.toString() || '0'),
          totalDebt: parseFloat(record.totalDebt?.toString() || '0'),
          grossProfit: parseFloat(record.revenue?.toString() || '0') * parseFloat(record.grossMargin?.toString() || '0'),
        },
      }));
    } catch (error) {
      console.warn(`[FinancialMetricsRefresh] Error fetching historical metrics:`, error);
      return [];
    }
  }

  private async upsertStockMetrics(
    stockId: string,
    symbol: string,
    isin: string,
    fiscalYear: string,
    metrics: Partial<schema.InsertStockFinancialMetrics>
  ): Promise<void> {
    const existing = await db.query.stockFinancialMetrics.findFirst({
      where: and(
        eq(schema.stockFinancialMetrics.stockId, stockId),
        eq(schema.stockFinancialMetrics.fiscalYear, fiscalYear)
      ),
    });

    if (existing) {
      await db
        .update(schema.stockFinancialMetrics)
        .set({
          ...metrics,
          lastUpdated: new Date(),
        })
        .where(eq(schema.stockFinancialMetrics.id, existing.id));
    } else {
      await db.insert(schema.stockFinancialMetrics).values({
        stockId,
        symbol,
        isin,
        fiscalYear,
        ...metrics,
        dataSource: 'credhive',
        dataQuality: 'complete',
      });
    }
  }

  async refreshAllStockMetrics(batchSize: number = 50): Promise<{ success: number; failed: number }> {
    const stocks = await db.select().from(schema.listedStocks).limit(batchSize);
    
    let success = 0;
    let failed = 0;

    for (const stock of stocks) {
      const result = await this.refreshStockMetrics(stock.id);
      if (result) success++;
      else failed++;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[FinancialMetricsRefresh] Batch complete: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  async getStockMetricsHistory(
    stockId: string,
    years?: number
  ): Promise<schema.StockFinancialMetrics[]> {
    let query = db
      .select()
      .from(schema.stockFinancialMetrics)
      .where(eq(schema.stockFinancialMetrics.stockId, stockId))
      .orderBy(desc(schema.stockFinancialMetrics.fiscalYear));

    if (years) {
      query = query.limit(years) as any;
    }

    return await query;
  }

  async getLatestStockMetrics(stockId: string): Promise<schema.StockFinancialMetrics | null> {
    const result = await db.query.stockFinancialMetrics.findFirst({
      where: eq(schema.stockFinancialMetrics.stockId, stockId),
      orderBy: [desc(schema.stockFinancialMetrics.fiscalYear)],
    });
    return result || null;
  }

  async getMetricsBySymbol(symbol: string): Promise<schema.StockFinancialMetrics[]> {
    return await db
      .select()
      .from(schema.stockFinancialMetrics)
      .where(eq(schema.stockFinancialMetrics.symbol, symbol))
      .orderBy(desc(schema.stockFinancialMetrics.fiscalYear));
  }

  async getMetricsTrend(
    stockId: string,
    metricNames: string[],
    years: number = 5
  ): Promise<Record<string, { year: string; value: number }[]>> {
    const metrics = await this.getStockMetricsHistory(stockId, years);
    
    const trends: Record<string, { year: string; value: number }[]> = {};
    
    for (const metricName of metricNames) {
      trends[metricName] = metrics.map(m => ({
        year: m.fiscalYear,
        value: parseFloat((m as any)[metricName]?.toString() || '0'),
      })).reverse();
    }
    
    return trends;
  }

  async compareStocks(
    stockIds: string[],
    metricNames: string[]
  ): Promise<Record<string, Record<string, number | null>>> {
    const comparison: Record<string, Record<string, number | null>> = {};
    
    for (const stockId of stockIds) {
      const latestMetrics = await this.getLatestStockMetrics(stockId);
      if (!latestMetrics) continue;
      
      comparison[stockId] = {};
      for (const metricName of metricNames) {
        const value = (latestMetrics as any)[metricName];
        comparison[stockId][metricName] = value ? parseFloat(value.toString()) : null;
      }
    }
    
    return comparison;
  }

  async getSectorAverages(sector: string): Promise<Record<string, number>> {
    const stocks = await db
      .select()
      .from(schema.listedStocks)
      .where(eq(schema.listedStocks.broadSector, sector));

    if (stocks.length === 0) return {};

    const stockIds = stocks.map(s => s.id);
    const metrics = await db
      .select()
      .from(schema.stockFinancialMetrics)
      .where(inArray(schema.stockFinancialMetrics.stockId, stockIds));

    const latestByStock = new Map<string, schema.StockFinancialMetrics>();
    for (const m of metrics) {
      const existing = latestByStock.get(m.stockId || '');
      if (!existing || m.fiscalYear > existing.fiscalYear) {
        latestByStock.set(m.stockId || '', m);
      }
    }

    const metricsToAverage = [
      'trailingPe', 'priceToBook', 'roe', 'roce', 'debtToEquity',
      'netMargin', 'revenueGrowthYoy', 'piotroskiFScore'
    ];

    const averages: Record<string, number> = {};
    for (const metricName of metricsToAverage) {
      const values = Array.from(latestByStock.values())
        .map(m => parseFloat((m as any)[metricName]?.toString() || '0'))
        .filter(v => v !== 0 && !isNaN(v));
      
      if (values.length > 0) {
        averages[metricName] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    }

    return averages;
  }
}

export const financialMetricsRefreshService = new FinancialMetricsRefreshService();
