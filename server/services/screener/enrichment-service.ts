import { db } from '../../db';
import { screenerStocks, screenerFinancials, screenerPriceHistory, screenerDerivedMetrics } from '@shared/schema';
import { eq, and, sql, lt, isNull, asc } from 'drizzle-orm';
import { getDataProvider } from './fmp-provider';
import { fmpUsageMonitor } from './fmp-usage-monitor';
import { calculateDerivedMetrics } from './derived-metrics-engine';

export interface EnrichmentResult {
  task: string;
  processed: number;
  errors: number;
  skipped: number;
  apiCallsUsed: number;
  remaining: number;
}

export async function enrichStockProfiles(batchSize = 10): Promise<EnrichmentResult> {
  const provider = getDataProvider();
  let processed = 0, errors = 0, skipped = 0, apiCalls = 0;

  const staleCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const stocks = await db
    .select()
    .from(screenerStocks)
    .where(
      sql`${screenerStocks.lastFmpSync} IS NULL OR ${screenerStocks.lastFmpSync} < ${staleCutoff}::timestamp`
    )
    .orderBy(asc(screenerStocks.lastFmpSync))
    .limit(batchSize);

  for (const stock of stocks) {
    if (!(await fmpUsageMonitor.canMakeCall())) {
      skipped += stocks.length - processed - errors;
      break;
    }

    try {
      const fmpSymbol = stock.fmpSymbol || `${stock.symbol}.NS`;
      const profile = await provider.getCompanyProfile(fmpSymbol);
      apiCalls++;

      if (profile) {
        await db.update(screenerStocks).set({
          companyName: profile.companyName || stock.companyName,
          sector: profile.sector || stock.sector,
          industry: profile.industry || stock.industry,
          currentPrice: profile.price?.toString(),
          marketCapValue: profile.marketCap?.toString(),
          marketCapCategory: categorizeMarketCap(profile.marketCap),
          lastFmpSync: new Date(),
          updatedAt: new Date(),
        }).where(eq(screenerStocks.id, stock.id));
        processed++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      errors++;
    }
  }

  const stats = await fmpUsageMonitor.getDailyStats();
  return { task: 'stock_profiles', processed, errors, skipped, apiCallsUsed: apiCalls, remaining: stats.remaining };
}

export async function enrichFinancialRatios(batchSize = 5): Promise<EnrichmentResult> {
  const provider = getDataProvider();
  let processed = 0, errors = 0, skipped = 0, apiCalls = 0;

  const stocks = await db
    .select()
    .from(screenerStocks)
    .where(eq(screenerStocks.isActive, true))
    .orderBy(sql`RANDOM()`)
    .limit(batchSize);

  for (const stock of stocks) {
    if (!(await fmpUsageMonitor.canMakeCall())) {
      skipped += stocks.length - processed - errors;
      break;
    }

    try {
      const fmpSymbol = stock.fmpSymbol || `${stock.symbol}.NS`;
      const ratios = await provider.getRatios(fmpSymbol);
      apiCalls++;

      if (ratios) {
        const values = {
          symbol: stock.symbol,
          period: ratios.period || 'annual',
          fiscalYear: ratios.date ? parseInt(ratios.date.split('-')[0]) : new Date().getFullYear(),
          fiscalDate: ratios.date,
          peRatio: ratios.peRatio?.toString(),
          pbRatio: ratios.pbRatio?.toString(),
          evToEbitda: ratios.evToEbitda?.toString(),
          priceToSales: ratios.priceToSales?.toString(),
          roe: ratios.roe?.toString(),
          roa: ratios.roa?.toString(),
          netProfitMargin: ratios.netProfitMargin?.toString(),
          operatingMargin: ratios.operatingMargin?.toString(),
          grossMargin: ratios.grossMargin?.toString(),
          debtToEquity: ratios.debtToEquity?.toString(),
          currentRatio: ratios.currentRatio?.toString(),
          quickRatio: ratios.quickRatio?.toString(),
          interestCoverage: ratios.interestCoverage?.toString(),
          eps: ratios.eps?.toString(),
          bookValue: ratios.bookValue?.toString(),
          dividendYield: ratios.dividendYield?.toString(),
          dividendPayout: ratios.dividendPayout?.toString(),
          freeCashFlowPerShare: ratios.freeCashFlowPerShare?.toString(),
          lastUpdated: new Date(),
        };

        const [existing] = await db
          .select({ id: screenerFinancials.id })
          .from(screenerFinancials)
          .where(and(
            eq(screenerFinancials.symbol, stock.symbol),
            eq(screenerFinancials.period, ratios.period || 'annual')
          ))
          .limit(1);

        if (existing) {
          await db.update(screenerFinancials).set(values).where(eq(screenerFinancials.id, existing.id));
        } else {
          await db.insert(screenerFinancials).values(values);
        }

        await calculateDerivedMetrics(stock.symbol);
        processed++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      errors++;
    }
  }

  const stats = await fmpUsageMonitor.getDailyStats();
  return { task: 'financial_ratios', processed, errors, skipped, apiCallsUsed: apiCalls, remaining: stats.remaining };
}

export async function enrichPriceHistory(batchSize = 3): Promise<EnrichmentResult> {
  const provider = getDataProvider();
  let processed = 0, errors = 0, skipped = 0, apiCalls = 0;

  const stocks = await db
    .select()
    .from(screenerStocks)
    .where(eq(screenerStocks.isActive, true))
    .orderBy(sql`RANDOM()`)
    .limit(batchSize);

  const today = new Date().toISOString().split('T')[0];
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  for (const stock of stocks) {
    if (!(await fmpUsageMonitor.canMakeCall())) {
      skipped += stocks.length - processed - errors;
      break;
    }

    try {
      const fmpSymbol = stock.fmpSymbol || `${stock.symbol}.NS`;
      const prices = await provider.getHistoricalPrices(fmpSymbol, oneYearAgo, today);
      apiCalls++;

      if (prices.length > 0) {
        await db.delete(screenerPriceHistory).where(eq(screenerPriceHistory.symbol, stock.symbol));

        const batchInserts = prices.map(p => ({
          symbol: stock.symbol,
          date: p.date,
          open: p.open?.toString(),
          high: p.high?.toString(),
          low: p.low?.toString(),
          close: p.close?.toString(),
          adjClose: p.adjClose?.toString(),
          volume: p.volume?.toString(),
          changePercent: p.changePercent?.toString(),
        }));

        for (let i = 0; i < batchInserts.length; i += 50) {
          await db.insert(screenerPriceHistory).values(batchInserts.slice(i, i + 50));
        }

        processed++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      errors++;
    }
  }

  const stats = await fmpUsageMonitor.getDailyStats();
  return { task: 'price_history', processed, errors, skipped, apiCallsUsed: apiCalls, remaining: stats.remaining };
}

export async function seedScreenerFromFmp(exchange = 'NSE', limit = 50): Promise<EnrichmentResult> {
  const provider = getDataProvider();
  let processed = 0, errors = 0, skipped = 0, apiCalls = 1;

  if (!(await fmpUsageMonitor.canMakeCall())) {
    return { task: 'seed_screener', processed: 0, errors: 0, skipped: 0, apiCallsUsed: 0, remaining: 0 };
  }

  const results = await provider.getStockScreener(0, exchange, limit);

  for (const stock of results) {
    try {
      const [existing] = await db
        .select({ id: screenerStocks.id })
        .from(screenerStocks)
        .where(eq(screenerStocks.symbol, stock.symbol.replace('.NS', '').replace('.BO', '')))
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(screenerStocks).values({
        symbol: stock.symbol.replace('.NS', '').replace('.BO', ''),
        companyName: stock.companyName,
        exchange: stock.exchange || exchange,
        sector: stock.sector,
        industry: stock.industry,
        marketCapValue: stock.marketCap?.toString(),
        marketCapCategory: categorizeMarketCap(stock.marketCap),
        currentPrice: stock.price?.toString(),
        country: stock.country || 'IN',
        currency: 'INR',
        fmpSymbol: stock.symbol,
        dataSource: 'fmp',
        isActive: true,
      });
      processed++;
    } catch (err: any) {
      errors++;
    }
  }

  const stats = await fmpUsageMonitor.getDailyStats();
  return { task: 'seed_screener', processed, errors, skipped, apiCallsUsed: apiCalls, remaining: stats.remaining };
}

function categorizeMarketCap(cap: number): string {
  if (!cap || cap <= 0) return 'unknown';
  const crores = cap / 10000000;
  if (crores >= 100000) return 'mega';
  if (crores >= 20000) return 'large';
  if (crores >= 5000) return 'mid';
  if (crores >= 500) return 'small';
  return 'micro';
}
