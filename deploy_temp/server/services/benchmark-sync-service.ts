import yahooFinance from 'yahoo-finance2';
import { db } from '../db';
import { marketIndices, marketIndexNav } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';

interface IndexSymbolMapping {
  indexCode: string;
  yahooSymbol: string;
}

const INDEX_SYMBOL_MAPPINGS: IndexSymbolMapping[] = [
  { indexCode: 'NIFTY50', yahooSymbol: '^NSEI' },
  { indexCode: 'NIFTY100', yahooSymbol: '^CNX100' },
  { indexCode: 'NIFTY_NEXT50', yahooSymbol: '^NSMIDCP' },
  { indexCode: 'NIFTY_BANK', yahooSymbol: '^NSEBANK' },
  { indexCode: 'NIFTY_IT', yahooSymbol: '^CNXIT' },
  { indexCode: 'NIFTY_PHARMA', yahooSymbol: '^CNXPHARMA' },
  { indexCode: 'NIFTY_AUTO', yahooSymbol: '^CNXAUTO' },
  { indexCode: 'NIFTY_FMCG', yahooSymbol: '^CNXFMCG' },
  { indexCode: 'NIFTY_MIDCAP_150', yahooSymbol: 'NIFTY_MIDCAP_150.NS' },
  { indexCode: 'NIFTY_SMALLCAP_250', yahooSymbol: 'NIFTY_SMLCAP_250.NS' },
  { indexCode: 'NIFTY500', yahooSymbol: '^CRSLDX' },
  { indexCode: 'SENSEX', yahooSymbol: '^BSESN' },
];

const YEARS_OF_HISTORY = 5;
const RISK_FREE_RATE = 0.06;

class BenchmarkSyncService {
  private static instance: BenchmarkSyncService;

  static getInstance(): BenchmarkSyncService {
    if (!BenchmarkSyncService.instance) {
      BenchmarkSyncService.instance = new BenchmarkSyncService();
    }
    return BenchmarkSyncService.instance;
  }

  async syncAllBenchmarks(): Promise<{ synced: number; failed: string[] }> {
    console.log('[BenchmarkSync] Starting benchmark index data sync...');
    const results = { synced: 0, failed: [] as string[] };

    for (const mapping of INDEX_SYMBOL_MAPPINGS) {
      let synced = false;
      for (let attempt = 0; attempt < 3 && !synced; attempt++) {
        try {
          if (attempt > 0) {
            const backoff = 15000 * Math.pow(2, attempt - 1);
            console.log(`[BenchmarkSync] Retry ${attempt}/2 for ${mapping.indexCode} after ${backoff / 1000}s`);
            await this.delay(backoff);
          }
          await this.syncBenchmarkIndex(mapping.indexCode, mapping.yahooSymbol);
          results.synced++;
          synced = true;
          console.log(`[BenchmarkSync] Synced ${mapping.indexCode}`);
        } catch (error: any) {
          if (attempt === 2) {
            results.failed.push(mapping.indexCode);
            console.warn(`[BenchmarkSync] Failed ${mapping.indexCode} after 3 attempts: ${error.message?.substring(0, 80)}`);
          }
        }
      }
      await this.delay(10000);
    }

    console.log(`[BenchmarkSync] Completed: ${results.synced} synced, ${results.failed.length} failed`);
    return results;
  }

  async syncBenchmarkIndex(indexCode: string, yahooSymbol: string): Promise<void> {
    const [marketIndex] = await db.select()
      .from(marketIndices)
      .where(eq(marketIndices.indexCode, indexCode))
      .limit(1);

    if (!marketIndex) {
      console.warn(`[BenchmarkSync] Index ${indexCode} not found in market_indices table`);
      return;
    }

    const lastNav = await db.select()
      .from(marketIndexNav)
      .where(eq(marketIndexNav.indexId, marketIndex.id))
      .orderBy(desc(marketIndexNav.navDate))
      .limit(1);

    let startDate: Date;
    if (lastNav.length > 0 && lastNav[0].navDate) {
      startDate = new Date(lastNav[0].navDate);
      startDate.setDate(startDate.getDate() + 1);
    } else {
      startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - YEARS_OF_HISTORY);
    }

    const endDate = new Date();

    if (startDate >= endDate) {
      console.log(`[BenchmarkSync] ${indexCode} is up to date`);
      return;
    }

    console.log(`[BenchmarkSync] Fetching ${indexCode} from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    try {
      const historicalData = await yahooFinance.chart(yahooSymbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      });

      if (!historicalData?.quotes || historicalData.quotes.length === 0) {
        console.warn(`[BenchmarkSync] No data returned for ${yahooSymbol}`);
        return;
      }

      const quotes = historicalData.quotes.filter(q => q.close !== null && q.close !== undefined);

      let previousClose: number | null = null;
      if (lastNav.length > 0 && lastNav[0].closeValue) {
        previousClose = parseFloat(lastNav[0].closeValue);
      }

      let insertCount = 0;
      for (const quote of quotes) {
        if (!quote.date || quote.close === null || quote.close === undefined) continue;

        const closeValue = quote.close;
        let dailyReturn: number | null = null;

        if (previousClose !== null && previousClose > 0) {
          dailyReturn = (closeValue - previousClose) / previousClose;
        }

        const navDateStr = quote.date.toISOString().split('T')[0];

        try {
          await db.insert(marketIndexNav).values({
            indexId: marketIndex.id,
            navDate: navDateStr,
            closeValue: closeValue.toString(),
            dailyReturn: dailyReturn?.toString() ?? null,
          }).onConflictDoNothing();
          insertCount++;
        } catch (err) {
          console.error(`[BenchmarkSync] Insert error for ${indexCode} on ${navDateStr}:`, err);
        }

        previousClose = closeValue;
      }

      console.log(`[BenchmarkSync] Inserted ${insertCount} records for ${indexCode}`);
    } catch (error: any) {
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        console.warn(`[BenchmarkSync] Rate limited for ${yahooSymbol}, will retry later`);
        throw error;
      }
      throw error;
    }
  }

  async getIndexReturns(indexCode: string, startDate: Date, endDate: Date): Promise<{ date: Date; dailyReturn: number }[]> {
    const [marketIndex] = await db.select()
      .from(marketIndices)
      .where(eq(marketIndices.indexCode, indexCode))
      .limit(1);

    if (!marketIndex) {
      return [];
    }

    const navData = await db.select()
      .from(marketIndexNav)
      .where(eq(marketIndexNav.indexId, marketIndex.id))
      .orderBy(marketIndexNav.navDate);

    return navData
      .filter(n => {
        if (!n.navDate || !n.dailyReturn) return false;
        const navDate = new Date(n.navDate);
        return navDate >= startDate && navDate <= endDate;
      })
      .map(n => ({
        date: new Date(n.navDate!),
        dailyReturn: parseFloat(n.dailyReturn!),
      }));
  }

  async getIndexCloseValues(indexCode: string, startDate?: Date, endDate?: Date): Promise<{ date: Date; closeValue: number }[]> {
    const [marketIndex] = await db.select()
      .from(marketIndices)
      .where(eq(marketIndices.indexCode, indexCode))
      .limit(1);

    if (!marketIndex) {
      return [];
    }

    const navData = await db.select()
      .from(marketIndexNav)
      .where(eq(marketIndexNav.indexId, marketIndex.id))
      .orderBy(marketIndexNav.navDate);

    return navData
      .filter(n => {
        if (!n.navDate || !n.closeValue) return false;
        const navDate = new Date(n.navDate);
        if (startDate && navDate < startDate) return false;
        if (endDate && navDate > endDate) return false;
        return true;
      })
      .map(n => ({
        date: new Date(n.navDate!),
        closeValue: parseFloat(n.closeValue),
      }));
  }

  async getBenchmarkDataCoverage(): Promise<{
    indexCode: string;
    indexName: string;
    dataPoints: number;
    earliestDate: string | null;
    latestDate: string | null;
  }[]> {
    const indices = await db.select().from(marketIndices).where(eq(marketIndices.isActive, true));

    const coverage = [];
    for (const index of indices) {
      const navData = await db.select()
        .from(marketIndexNav)
        .where(eq(marketIndexNav.indexId, index.id))
        .orderBy(marketIndexNav.navDate);

      coverage.push({
        indexCode: index.indexCode,
        indexName: index.indexName,
        dataPoints: navData.length,
        earliestDate: navData.length > 0 ? String(navData[0].navDate) : null,
        latestDate: navData.length > 0 ? String(navData[navData.length - 1].navDate) : null,
      });
    }

    return coverage;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const benchmarkSyncService = BenchmarkSyncService.getInstance();
