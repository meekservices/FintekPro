import { db } from "../db";
import { historicalNavData, assetMetadataCache, portfolioMetricsCache } from "@shared/schema";
import { eq, and, gte, lte, desc, asc, sql } from "drizzle-orm";

interface NavDataPoint {
  date: string;
  nav: string;
}

interface MFAPIResponse {
  meta: {
    fund_house: string;
    scheme_type: string;
    scheme_category: string;
    scheme_code: number;
    scheme_name: string;
  };
  data: NavDataPoint[];
  status: string;
}

interface HistoricalDataResult {
  success: boolean;
  identifier: string;
  identifierType: string;
  recordsStored: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  source: string;
  error?: string;
}

interface CachedMetrics {
  cagr: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  beta: number | null;
  alpha: number | null;
  dataPoints: number;
  dateRange: { start: string; end: string };
  calculatedFromRealData: boolean;
}

const RISK_FREE_RATE = 0.065; // 6.5% - RBI repo rate as proxy
const MARKET_RETURN = 0.12; // 12% - Long-term Nifty return

export class HistoricalNavService {
  private static instance: HistoricalNavService;
  
  static getInstance(): HistoricalNavService {
    if (!this.instance) {
      this.instance = new HistoricalNavService();
    }
    return this.instance;
  }

  /**
   * Fetch and store full NAV history for a mutual fund scheme
   * Uses append-only strategy - new data added, old data retained
   */
  async fetchAndStoreMutualFundHistory(schemeCode: string): Promise<HistoricalDataResult> {
    const identifier = schemeCode.toString();
    const identifierType = 'mutual_fund';
    
    try {
      console.log(`[HistoricalNav] Fetching full history for scheme ${schemeCode}...`);
      
      // Check what data we already have
      const existingRange = await this.getExistingDateRange(identifier, identifierType);
      
      // Fetch from MFAPI.in (provides full history, 13+ years)
      const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) {
        throw new Error(`MFAPI returned ${response.status}`);
      }
      
      const data: MFAPIResponse = await response.json();
      
      if (!data.data || data.data.length === 0) {
        return {
          success: false,
          identifier,
          identifierType,
          recordsStored: 0,
          dateRange: { start: null, end: null },
          source: 'mfapi',
          error: 'No NAV data returned from API'
        };
      }
      
      // Store metadata (guard against missing meta)
      const meta = data.meta || {} as any;
      await this.upsertAssetMetadata({
        identifier,
        identifierType,
        name: (meta.scheme_name || `Scheme ${schemeCode}`).substring(0, 300),
        category: (meta.scheme_category || '').substring(0, 100),
        amcName: (meta.fund_house || '').substring(0, 200),
        schemeType: (meta.scheme_type || '').substring(0, 50),
        latestNav: data.data[0]?.nav,
        latestNavDate: this.parseDate(data.data[0]?.date),
        source: 'mfapi'
      });
      
      // Filter to only new data points we don't have
      const navRecords = data.data
        .filter(d => d.date && d.nav)
        .map(d => ({
          identifier,
          identifierType,
          date: this.parseDate(d.date),
          nav: d.nav,
          source: 'mfapi' as const
        }))
        .filter(r => r.date); // Remove invalid dates
      
      if (navRecords.length === 0) {
        return {
          success: true,
          identifier,
          identifierType,
          recordsStored: 0,
          dateRange: existingRange,
          source: 'mfapi'
        };
      }
      
      // Batch upsert with conflict handling (append-only, no overwrites)
      const insertedCount = await this.batchUpsertNavData(navRecords);
      
      // Get updated date range
      const newRange = await this.getExistingDateRange(identifier, identifierType);
      
      console.log(`[HistoricalNav] Stored ${insertedCount} records for ${schemeCode} (${newRange.start} to ${newRange.end})`);
      
      return {
        success: true,
        identifier,
        identifierType,
        recordsStored: insertedCount,
        dateRange: newRange,
        source: 'mfapi'
      };
      
    } catch (error: any) {
      console.error(`[HistoricalNav] Error fetching ${schemeCode}:`, error.message);
      return {
        success: false,
        identifier,
        identifierType,
        recordsStored: 0,
        dateRange: { start: null, end: null },
        source: 'mfapi',
        error: error.message
      };
    }
  }

  /**
   * Batch upsert NAV data - inserts new records, skips existing ones
   */
  private async batchUpsertNavData(records: Array<{
    identifier: string;
    identifierType: string;
    date: string;
    nav: string;
    source: string;
  }>): Promise<number> {
    if (records.length === 0) return 0;
    
    const BATCH_SIZE = 500;
    let totalInserted = 0;
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      try {
        // Use ON CONFLICT DO NOTHING to skip existing records
        const result = await db.execute(sql`
          INSERT INTO historical_nav_data (identifier, identifier_type, date, nav, source, fetched_at, created_at)
          SELECT * FROM (
            VALUES ${sql.join(
              batch.map(r => sql`(
                ${r.identifier}::varchar,
                ${r.identifierType}::varchar,
                ${r.date}::date,
                ${r.nav}::numeric,
                ${r.source}::varchar,
                NOW(),
                NOW()
              )`),
              sql`, `
            )}
          ) AS t(identifier, identifier_type, date, nav, source, fetched_at, created_at)
          ON CONFLICT (identifier, identifier_type, date) DO NOTHING
        `);
        
        totalInserted += batch.length;
      } catch (error: any) {
        // If conflict constraint doesn't exist, try individual inserts
        if (error.message?.includes('constraint')) {
          for (const record of batch) {
            try {
              const existing = await db.select().from(historicalNavData)
                .where(and(
                  eq(historicalNavData.identifier, record.identifier),
                  eq(historicalNavData.identifierType, record.identifierType),
                  eq(historicalNavData.date, record.date)
                ))
                .limit(1);
              
              if (existing.length === 0) {
                await db.insert(historicalNavData).values({
                  identifier: record.identifier,
                  identifierType: record.identifierType,
                  date: record.date,
                  nav: record.nav,
                  source: record.source,
                });
                totalInserted++;
              }
            } catch (e) {
              // Skip duplicates silently
            }
          }
        }
      }
    }
    
    return totalInserted;
  }

  /**
   * Get cached NAV data for a scheme
   */
  async getNavHistory(
    identifier: string,
    identifierType: string = 'mutual_fund',
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ date: string; nav: number }>> {
    let query = db.select({
      date: historicalNavData.date,
      nav: historicalNavData.nav
    })
    .from(historicalNavData)
    .where(and(
      eq(historicalNavData.identifier, identifier),
      eq(historicalNavData.identifierType, identifierType),
      ...(startDate ? [gte(historicalNavData.date, startDate)] : []),
      ...(endDate ? [lte(historicalNavData.date, endDate)] : [])
    ))
    .orderBy(asc(historicalNavData.date));
    
    const results = await query;
    
    return results.map(r => ({
      date: r.date as string,
      nav: parseFloat(r.nav as string)
    }));
  }

  /**
   * Get NAV for a specific date (or nearest available date)
   * Used for grandfathering calculations (Jan 31, 2018)
   */
  async getNavForDate(
    schemeCode: string,
    targetDate: string,
    toleranceDays: number = 5
  ): Promise<{ nav: number; date: string; isExact: boolean } | null> {
    const identifier = schemeCode.toString();
    const identifierType = 'mutual_fund';
    
    // First try exact date
    const exactResult = await db.select({
      date: historicalNavData.date,
      nav: historicalNavData.nav
    })
    .from(historicalNavData)
    .where(and(
      eq(historicalNavData.identifier, identifier),
      eq(historicalNavData.identifierType, identifierType),
      eq(historicalNavData.date, targetDate)
    ))
    .limit(1);
    
    if (exactResult.length > 0) {
      return {
        nav: parseFloat(exactResult[0].nav as string),
        date: exactResult[0].date as string,
        isExact: true
      };
    }
    
    // Find nearest date within tolerance (prefer earlier date)
    const targetDateObj = new Date(targetDate);
    const minDate = new Date(targetDateObj);
    minDate.setDate(minDate.getDate() - toleranceDays);
    const maxDate = new Date(targetDateObj);
    maxDate.setDate(maxDate.getDate() + toleranceDays);
    
    const nearbyResults = await db.select({
      date: historicalNavData.date,
      nav: historicalNavData.nav
    })
    .from(historicalNavData)
    .where(and(
      eq(historicalNavData.identifier, identifier),
      eq(historicalNavData.identifierType, identifierType),
      gte(historicalNavData.date, minDate.toISOString().split('T')[0]),
      lte(historicalNavData.date, maxDate.toISOString().split('T')[0])
    ))
    .orderBy(desc(historicalNavData.date))
    .limit(1);
    
    if (nearbyResults.length > 0) {
      return {
        nav: parseFloat(nearbyResults[0].nav as string),
        date: nearbyResults[0].date as string,
        isExact: false
      };
    }
    
    return null;
  }

  /**
   * Get Jan 31, 2018 NAV for grandfathering calculation
   * This is the Fair Market Value (FMV) date for LTCG grandfathering
   */
  async getGrandfatheringNav(schemeCode: string): Promise<{ nav: number; date: string; isExact: boolean } | null> {
    return this.getNavForDate(schemeCode, '2018-01-31', 5);
  }

  /**
   * Batch lookup of Jan 31, 2018 NAVs for multiple schemes
   */
  async batchGetGrandfatheringNavs(schemeCodes: string[]): Promise<Map<string, { nav: number; date: string; isExact: boolean }>> {
    const results = new Map<string, { nav: number; date: string; isExact: boolean }>();
    
    if (schemeCodes.length === 0) return results;
    
    // Query all scheme codes at once for the grandfathering date range
    const targetDate = '2018-01-31';
    const minDate = '2018-01-26';
    const maxDate = '2018-02-05';
    
    const navResults = await db.select({
      identifier: historicalNavData.identifier,
      date: historicalNavData.date,
      nav: historicalNavData.nav
    })
    .from(historicalNavData)
    .where(and(
      sql`${historicalNavData.identifier} = ANY(${schemeCodes})`,
      eq(historicalNavData.identifierType, 'mutual_fund'),
      gte(historicalNavData.date, minDate),
      lte(historicalNavData.date, maxDate)
    ))
    .orderBy(desc(historicalNavData.date));
    
    // Group by scheme and pick best date (prefer exact, then closest to target date)
    const schemeData = new Map<string, Array<{ date: string; nav: string }>>();
    for (const row of navResults) {
      const code = row.identifier as string;
      if (!schemeData.has(code)) {
        schemeData.set(code, []);
      }
      schemeData.get(code)!.push({
        date: row.date as string,
        nav: row.nav as string
      });
    }
    
    const targetDateMs = new Date(targetDate).getTime();
    
    for (const [code, dataPoints] of schemeData) {
      // Prefer exact date
      const exact = dataPoints.find(d => d.date === targetDate);
      if (exact) {
        results.set(code, {
          nav: parseFloat(exact.nav),
          date: exact.date,
          isExact: true
        });
      } else if (dataPoints.length > 0) {
        // Find closest date by minimizing absolute delta from target
        const closest = dataPoints.reduce((prev, curr) => {
          const prevDelta = Math.abs(new Date(prev.date).getTime() - targetDateMs);
          const currDelta = Math.abs(new Date(curr.date).getTime() - targetDateMs);
          return currDelta < prevDelta ? curr : prev;
        });
        results.set(code, {
          nav: parseFloat(closest.nav),
          date: closest.date,
          isExact: false
        });
      }
    }
    
    return results;
  }

  /**
   * Get existing date range for a scheme
   */
  async getExistingDateRange(identifier: string, identifierType: string): Promise<{ start: string | null; end: string | null }> {
    const result = await db.select({
      minDate: sql<string>`MIN(date)`,
      maxDate: sql<string>`MAX(date)`
    })
    .from(historicalNavData)
    .where(and(
      eq(historicalNavData.identifier, identifier),
      eq(historicalNavData.identifierType, identifierType)
    ));
    
    return {
      start: result[0]?.minDate || null,
      end: result[0]?.maxDate || null
    };
  }

  /**
   * Calculate portfolio metrics from real historical data
   */
  async calculateMetrics(
    identifier: string,
    identifierType: string = 'mutual_fund',
    periodYears: number = 5
  ): Promise<CachedMetrics> {
    // Check cache first
    const cached = await this.getCachedMetrics(identifier, identifierType, periodYears);
    if (cached) {
      return cached;
    }
    
    // Get historical data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - periodYears);
    
    const navData = await this.getNavHistory(
      identifier,
      identifierType,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    if (navData.length < 30) {
      // Not enough data - return estimation-based metrics
      return {
        cagr: null,
        volatility: null,
        maxDrawdown: null,
        sharpeRatio: null,
        sortinoRatio: null,
        beta: null,
        alpha: null,
        dataPoints: navData.length,
        dateRange: { 
          start: navData[0]?.date || '', 
          end: navData[navData.length - 1]?.date || '' 
        },
        calculatedFromRealData: false
      };
    }
    
    // Calculate metrics from real data
    const returns = this.calculateReturns(navData);
    const metrics = this.computeMetrics(navData, returns);
    
    // Cache the results (expires in 24 hours)
    await this.cacheMetrics(identifier, identifierType, periodYears, metrics);
    
    return {
      ...metrics,
      dataPoints: navData.length,
      dateRange: {
        start: navData[0].date,
        end: navData[navData.length - 1].date
      },
      calculatedFromRealData: true
    };
  }

  /**
   * Calculate daily returns from NAV data
   */
  private calculateReturns(navData: Array<{ date: string; nav: number }>): number[] {
    const returns: number[] = [];
    for (let i = 1; i < navData.length; i++) {
      const dailyReturn = (navData[i].nav - navData[i - 1].nav) / navData[i - 1].nav;
      returns.push(dailyReturn);
    }
    return returns;
  }

  /**
   * Compute all portfolio metrics from NAV and returns data
   */
  private computeMetrics(
    navData: Array<{ date: string; nav: number }>,
    returns: number[]
  ): Omit<CachedMetrics, 'dataPoints' | 'dateRange' | 'calculatedFromRealData'> {
    // CAGR
    const startNav = navData[0].nav;
    const endNav = navData[navData.length - 1].nav;
    const startDate = new Date(navData[0].date);
    const endDate = new Date(navData[navData.length - 1].date);
    const years = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const cagr = years > 0 ? Math.pow(endNav / startNav, 1 / years) - 1 : null;
    
    // Volatility (annualized standard deviation)
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const dailyVol = Math.sqrt(variance);
    const volatility = dailyVol * Math.sqrt(252); // Annualize
    
    // Max Drawdown
    let peak = navData[0].nav;
    let maxDrawdown = 0;
    for (const point of navData) {
      if (point.nav > peak) {
        peak = point.nav;
      }
      const drawdown = (peak - point.nav) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    // Sharpe Ratio
    const excessReturn = (cagr || 0) - RISK_FREE_RATE;
    const sharpeRatio = volatility > 0 ? excessReturn / volatility : null;
    
    // Sortino Ratio (uses downside deviation)
    const negativeReturns = returns.filter(r => r < 0);
    const downsideVariance = negativeReturns.length > 0
      ? negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
      : 0;
    const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);
    const sortinoRatio = downsideDeviation > 0 ? excessReturn / downsideDeviation : null;
    
    // Beta (assuming market correlation of ~0.8 for equity funds)
    // For accurate beta, we'd need market index data comparison
    const beta = volatility > 0 ? (volatility / 0.15) * 0.85 : null; // Approximate using vol ratio
    
    // Alpha (Jensen's Alpha)
    const alpha = cagr !== null && beta !== null
      ? cagr - (RISK_FREE_RATE + beta * (MARKET_RETURN - RISK_FREE_RATE))
      : null;
    
    return {
      cagr: cagr !== null ? Math.round(cagr * 10000) / 10000 : null,
      volatility: Math.round(volatility * 10000) / 10000,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 10000,
      sharpeRatio: sharpeRatio !== null ? Math.round(sharpeRatio * 100) / 100 : null,
      sortinoRatio: sortinoRatio !== null ? Math.round(sortinoRatio * 100) / 100 : null,
      beta: beta !== null ? Math.round(beta * 100) / 100 : null,
      alpha: alpha !== null ? Math.round(alpha * 10000) / 10000 : null
    };
  }

  /**
   * Get cached metrics if available and not expired
   */
  private async getCachedMetrics(
    identifier: string,
    identifierType: string,
    periodYears: number
  ): Promise<CachedMetrics | null> {
    const cached = await db.select()
      .from(portfolioMetricsCache)
      .where(and(
        eq(portfolioMetricsCache.identifier, identifier),
        eq(portfolioMetricsCache.identifierType, identifierType),
        eq(portfolioMetricsCache.periodYears, periodYears),
        gte(portfolioMetricsCache.expiresAt, new Date())
      ))
      .limit(1);
    
    if (cached.length === 0) return null;
    
    const c = cached[0];
    return {
      cagr: c.cagr ? parseFloat(c.cagr) : null,
      volatility: c.volatility ? parseFloat(c.volatility) : null,
      maxDrawdown: c.maxDrawdown ? parseFloat(c.maxDrawdown) : null,
      sharpeRatio: c.sharpeRatio ? parseFloat(c.sharpeRatio) : null,
      sortinoRatio: c.sortinoRatio ? parseFloat(c.sortinoRatio) : null,
      beta: c.beta ? parseFloat(c.beta) : null,
      alpha: c.alpha ? parseFloat(c.alpha) : null,
      dataPoints: c.totalDataPoints || 0,
      dateRange: {
        start: c.dataStartDate || '',
        end: c.dataEndDate || ''
      },
      calculatedFromRealData: true
    };
  }

  /**
   * Cache calculated metrics
   */
  private async cacheMetrics(
    identifier: string,
    identifierType: string,
    periodYears: number,
    metrics: Omit<CachedMetrics, 'dataPoints' | 'dateRange' | 'calculatedFromRealData'>
  ): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    await db.insert(portfolioMetricsCache).values({
      identifier,
      identifierType,
      periodYears,
      periodEndDate: new Date().toISOString().split('T')[0],
      cagr: metrics.cagr?.toString() || null,
      volatility: metrics.volatility?.toString() || null,
      maxDrawdown: metrics.maxDrawdown?.toString() || null,
      sharpeRatio: metrics.sharpeRatio?.toString() || null,
      sortinoRatio: metrics.sortinoRatio?.toString() || null,
      beta: metrics.beta?.toString() || null,
      alpha: metrics.alpha?.toString() || null,
      expiresAt
    });
  }

  /**
   * Upsert asset metadata
   */
  private async upsertAssetMetadata(metadata: {
    identifier: string;
    identifierType: string;
    name: string;
    category?: string;
    amcName?: string;
    schemeType?: string;
    latestNav?: string;
    latestNavDate?: string;
    source: string;
  }): Promise<void> {
    const existing = await db.select()
      .from(assetMetadataCache)
      .where(and(
        eq(assetMetadataCache.identifier, metadata.identifier),
        eq(assetMetadataCache.identifierType, metadata.identifierType)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      await db.update(assetMetadataCache)
        .set({
          name: metadata.name,
          category: metadata.category,
          amcName: metadata.amcName,
          schemeType: metadata.schemeType,
          latestNav: metadata.latestNav,
          latestNavDate: metadata.latestNavDate,
          source: metadata.source,
          lastUpdatedAt: new Date()
        })
        .where(eq(assetMetadataCache.id, existing[0].id));
    } else {
      await db.insert(assetMetadataCache).values({
        identifier: metadata.identifier,
        identifierType: metadata.identifierType,
        name: metadata.name,
        category: metadata.category,
        amcName: metadata.amcName,
        schemeType: metadata.schemeType,
        latestNav: metadata.latestNav,
        latestNavDate: metadata.latestNavDate,
        source: metadata.source
      });
    }
  }

  /**
   * Parse DD-MM-YYYY date format to YYYY-MM-DD
   */
  private parseDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      // DD-MM-YYYY -> YYYY-MM-DD
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateStr;
  }

  /**
   * Get data availability summary for a scheme
   */
  async getDataSummary(identifier: string, identifierType: string = 'mutual_fund'): Promise<{
    hasData: boolean;
    recordCount: number;
    dateRange: { start: string | null; end: string | null };
    yearsOfData: number;
    metadata: any;
  }> {
    const [countResult, rangeResult, metadata] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)` })
        .from(historicalNavData)
        .where(and(
          eq(historicalNavData.identifier, identifier),
          eq(historicalNavData.identifierType, identifierType)
        )),
      this.getExistingDateRange(identifier, identifierType),
      db.select()
        .from(assetMetadataCache)
        .where(and(
          eq(assetMetadataCache.identifier, identifier),
          eq(assetMetadataCache.identifierType, identifierType)
        ))
        .limit(1)
    ]);
    
    const recordCount = countResult[0]?.count || 0;
    let yearsOfData = 0;
    
    if (rangeResult.start && rangeResult.end) {
      const start = new Date(rangeResult.start);
      const end = new Date(rangeResult.end);
      yearsOfData = (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    }
    
    return {
      hasData: recordCount > 0,
      recordCount,
      dateRange: rangeResult,
      yearsOfData: Math.round(yearsOfData * 10) / 10,
      metadata: metadata[0] || null
    };
  }

  /**
   * Ensure we have data for a scheme, fetching if needed
   */
  async ensureData(schemeCode: string): Promise<{
    ready: boolean;
    summary: Awaited<ReturnType<typeof this.getDataSummary>>;
  }> {
    const summary = await this.getDataSummary(schemeCode, 'mutual_fund');
    
    // If no data or data is old (last update > 7 days ago), fetch fresh
    if (!summary.hasData) {
      console.log(`[HistoricalNav] No data for ${schemeCode}, fetching...`);
      await this.fetchAndStoreMutualFundHistory(schemeCode);
      const newSummary = await this.getDataSummary(schemeCode, 'mutual_fund');
      return { ready: newSummary.hasData, summary: newSummary };
    }
    
    return { ready: true, summary };
  }

  /**
   * Calculate 1Y, 3Y, 5Y CAGR returns from stored historical NAV data
   * Primary data source: database (historicalNavData table)
   */
  async calculateReturnsFromStoredData(schemeCode: string): Promise<{
    returns1y: number | null;
    returns3y: number | null;
    returns5y: number | null;
    currentNav: number | null;
    dataQuality: 'full' | 'partial' | 'insufficient';
    source: 'database';
  }> {
    try {
      const identifier = schemeCode?.toString();
      if (!identifier) {
        return { 
          returns1y: null, returns3y: null, returns5y: null, 
          currentNav: null, dataQuality: 'insufficient', source: 'database' 
        };
      }
      
      const navData = await db.select({
        date: historicalNavData.date,
        nav: historicalNavData.nav
      })
      .from(historicalNavData)
      .where(eq(historicalNavData.identifier, identifier))
      .orderBy(desc(historicalNavData.date))
      .limit(2000); // ~5-6 years of daily data
      
      if (!navData || !Array.isArray(navData) || navData.length === 0) {
        return { 
          returns1y: null, returns3y: null, returns5y: null, 
          currentNav: null, dataQuality: 'insufficient', source: 'database' 
        };
      }
      
      const firstRecord = navData[0];
      if (!firstRecord || !firstRecord.nav || !firstRecord.date) {
        return { 
          returns1y: null, returns3y: null, returns5y: null, 
          currentNav: null, dataQuality: 'insufficient', source: 'database' 
        };
      }
      
      const currentNav = parseFloat(String(firstRecord.nav));
      const currentDate = new Date(String(firstRecord.date));
      
      if (isNaN(currentNav) || isNaN(currentDate.getTime())) {
        return { 
          returns1y: null, returns3y: null, returns5y: null, 
          currentNav: null, dataQuality: 'insufficient', source: 'database' 
        };
      }
      
      // Calculate target dates
      const oneYearAgo = new Date(currentDate);
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const threeYearsAgo = new Date(currentDate);
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      
      const fiveYearsAgo = new Date(currentDate);
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      
      // Find closest NAVs for each period
      const findClosestNav = (targetDate: Date): number | null => {
        let closest: number | null = null;
        let minDiff = Infinity;
        
        for (const point of navData) {
          if (!point || !point.date || !point.nav) continue;
          
          const pointDate = new Date(String(point.date));
          if (isNaN(pointDate.getTime())) continue;
          
          const diff = Math.abs(pointDate.getTime() - targetDate.getTime());
          // Within 7 days tolerance
          if (diff < minDiff && diff <= 7 * 24 * 60 * 60 * 1000) {
            minDiff = diff;
            const navValue = parseFloat(String(point.nav));
            if (!isNaN(navValue)) {
              closest = navValue;
            }
          }
        }
        return closest;
      };
      
      const nav1y = findClosestNav(oneYearAgo);
      const nav3y = findClosestNav(threeYearsAgo);
      const nav5y = findClosestNav(fiveYearsAgo);
      
      // Calculate CAGR returns
      const calculateCAGR = (current: number, old: number, years: number): number => {
        if (old <= 0 || years <= 0 || current <= 0) return 0;
        return (Math.pow(current / old, 1 / years) - 1) * 100;
      };
      
      const returns1y = nav1y ? calculateCAGR(currentNav, nav1y, 1) : null;
      const returns3y = nav3y ? calculateCAGR(currentNav, nav3y, 3) : null;
      const returns5y = nav5y ? calculateCAGR(currentNav, nav5y, 5) : null;
      
      // Determine data quality
      let dataQuality: 'full' | 'partial' | 'insufficient' = 'full';
      if (!returns1y && !returns3y && !returns5y) {
        dataQuality = 'insufficient';
      } else if (!returns3y || !returns5y) {
        dataQuality = 'partial';
      }
      
      return { returns1y, returns3y, returns5y, currentNav, dataQuality, source: 'database' };
    } catch (error: any) {
      if (error.message?.includes('Cannot convert undefined or null to object')) {
        // Silently handle - scheme has no valid NAV data
      } else {
        console.error(`[HistoricalNav] Error calculating returns for ${schemeCode}:`, error.message);
      }
      return { 
        returns1y: null, returns3y: null, returns5y: null, 
        currentNav: null, dataQuality: 'insufficient', source: 'database' 
      };
    }
  }

  /**
   * Bulk calculate returns for multiple schemes from stored data
   * Efficient batch processing for data enrichment
   */
  async bulkCalculateReturnsFromStored(schemeCodes: string[]): Promise<Map<string, {
    returns1y: number | null;
    returns3y: number | null;
    returns5y: number | null;
  }>> {
    const results = new Map();
    
    for (const code of schemeCodes) {
      const returns = await this.calculateReturnsFromStoredData(code);
      if (returns.dataQuality !== 'insufficient') {
        results.set(code, {
          returns1y: returns.returns1y,
          returns3y: returns.returns3y,
          returns5y: returns.returns5y
        });
      }
    }
    
    return results;
  }
}

export const historicalNavService = HistoricalNavService.getInstance();
