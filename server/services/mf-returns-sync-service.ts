import { db } from "../db";
import { mutualFunds, historicalNavData } from "@shared/schema";
import { eq, and, sql, desc, isNull, or, lt } from "drizzle-orm";
import axios from "axios";

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

interface CalculatedReturns {
  returns1y: number | null;
  returns3y: number | null;
  returns5y: number | null;
  currentNav: number;
  dataQuality: 'full' | 'partial' | 'insufficient';
}

interface FinancialRatios {
  standardDeviation: number | null;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  maxDrawdown: number | null;
  alpha: number | null;
  beta: number | null;
  treynorRatio: number | null;
  informationRatio: number | null;
}

interface EnrichedFundData extends CalculatedReturns {
  ratios: FinancialRatios;
}

const MFAPI_BASE_URL = 'https://api.mfapi.in/mf';
const REQUEST_TIMEOUT = 30000;
const BATCH_SIZE = 50;
const BASE_DELAY = 800; // Base delay between requests (ms)
const MAX_RETRY_ATTEMPTS = 3;
const BACKOFF_MULTIPLIER = 2; // Exponential backoff multiplier

class MFReturnsSyncService {
  private static instance: MFReturnsSyncService;
  private isRunning = false;
  private lastSyncTime: Date | null = null;
  private currentDelay = BASE_DELAY; // Adaptive delay that increases on rate limits
  private consecutiveRateLimits = 0;
  
  static getInstance(): MFReturnsSyncService {
    if (!this.instance) {
      this.instance = new MFReturnsSyncService();
    }
    return this.instance;
  }

  /**
   * Parse MFAPI date format (DD-MM-YYYY) to Date object
   */
  private parseDate(dateStr: string): Date {
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }

  /**
   * Calculate CAGR (Compound Annual Growth Rate)
   */
  private calculateCAGR(currentNav: number, oldNav: number, years: number): number {
    if (oldNav <= 0 || years <= 0 || currentNav <= 0) return 0;
    return (Math.pow(currentNav / oldNav, 1 / years) - 1) * 100;
  }

  /**
   * Calculate financial ratios from NAV data
   * Assumes 6% risk-free rate (India 10-year G-Sec benchmark)
   */
  calculateFinancialRatios(navData: NavDataPoint[]): FinancialRatios {
    const RISK_FREE_RATE = 6.0; // Annual risk-free rate as percentage

    if (!navData || navData.length < 30) {
      return {
        standardDeviation: null,
        sharpeRatio: null,
        sortinoRatio: null,
        maxDrawdown: null,
        alpha: null,
        beta: null,
        treynorRatio: null,
        informationRatio: null
      };
    }

    // Sort NAV data by date (oldest first)
    const sortedNav = [...navData].sort((a, b) => 
      this.parseDate(a.date).getTime() - this.parseDate(b.date).getTime()
    );

    // Calculate daily returns
    const dailyReturns: number[] = [];
    for (let i = 1; i < sortedNav.length; i++) {
      const prevNav = parseFloat(sortedNav[i - 1].nav);
      const currNav = parseFloat(sortedNav[i].nav);
      if (prevNav > 0) {
        dailyReturns.push(((currNav - prevNav) / prevNav) * 100);
      }
    }

    if (dailyReturns.length < 20) {
      return {
        standardDeviation: null,
        sharpeRatio: null,
        sortinoRatio: null,
        maxDrawdown: null,
        alpha: null,
        beta: null,
        treynorRatio: null,
        informationRatio: null
      };
    }

    // Calculate mean daily return
    const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;

    // Calculate Standard Deviation (annualized)
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / (dailyReturns.length - 1);
    const dailyStdDev = Math.sqrt(variance);
    const annualizedStdDev = dailyStdDev * Math.sqrt(252); // 252 trading days

    // Calculate Sharpe Ratio (annualized)
    const annualizedReturn = meanReturn * 252;
    const sharpeRatio = annualizedStdDev > 0 ? (annualizedReturn - RISK_FREE_RATE) / annualizedStdDev : null;

    // Calculate Sortino Ratio (uses downside deviation)
    const negativeReturns = dailyReturns.filter(r => r < 0);
    const downsideVariance = negativeReturns.length > 0
      ? negativeReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / negativeReturns.length
      : 0;
    const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);
    const sortinoRatio = downsideDeviation > 0 ? (annualizedReturn - RISK_FREE_RATE) / downsideDeviation : null;

    // Calculate Maximum Drawdown
    let maxDrawdown = 0;
    let peak = parseFloat(sortedNav[0].nav);
    for (const point of sortedNav) {
      const nav = parseFloat(point.nav);
      if (nav > peak) peak = nav;
      const drawdown = (peak - nav) / peak * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Note: Alpha, Beta, Treynor, Information Ratio require benchmark data (e.g., NIFTY 50 index)
    // To implement these metrics, you would need to:
    // 1. Fetch NIFTY 50 historical NAV data as the benchmark
    // 2. Calculate correlation and covariance between fund returns and market returns
    // 3. Beta = Covariance(Fund, Market) / Variance(Market)
    // 4. Alpha = Fund Return - (Risk-free Rate + Beta * (Market Return - Risk-free Rate))
    // 5. Treynor = (Fund Return - Risk-free Rate) / Beta
    // 6. Information Ratio = (Fund Return - Benchmark Return) / Tracking Error
    // For now, we return null until benchmark data integration is added
    
    return {
      standardDeviation: parseFloat(annualizedStdDev.toFixed(4)),
      sharpeRatio: sharpeRatio !== null ? parseFloat(sharpeRatio.toFixed(4)) : null,
      sortinoRatio: sortinoRatio !== null ? parseFloat(sortinoRatio.toFixed(4)) : null,
      maxDrawdown: parseFloat(maxDrawdown.toFixed(4)),
      alpha: null, // Requires benchmark data
      beta: null, // Requires benchmark data
      treynorRatio: null, // Requires benchmark data
      informationRatio: null // Requires benchmark data
    };
  }

  /**
   * Find closest NAV to target date within tolerance
   */
  private findClosestNav(
    navData: NavDataPoint[], 
    targetDate: Date, 
    maxDaysOffset: number = 10
  ): { nav: number; date: Date } | null {
    const targetTime = targetDate.getTime();
    let closestNav: { nav: number; date: Date } | null = null;
    let closestDiff = Infinity;

    for (const point of navData) {
      const pointDate = this.parseDate(point.date);
      const diff = Math.abs(pointDate.getTime() - targetTime);
      
      if (diff < closestDiff && diff <= maxDaysOffset * 24 * 60 * 60 * 1000) {
        closestDiff = diff;
        closestNav = { nav: parseFloat(point.nav), date: pointDate };
      }
    }

    return closestNav;
  }

  /**
   * Calculate returns from historical NAV data
   */
  calculateReturnsFromHistory(navData: NavDataPoint[]): CalculatedReturns {
    if (!navData || navData.length === 0) {
      return { returns1y: null, returns3y: null, returns5y: null, currentNav: 0, dataQuality: 'insufficient' };
    }

    // CRITICAL: Explicitly sort by date descending to ensure newest first
    // MFAPI typically returns newest-first, but we must not assume ordering
    const sortedNavData = [...navData].sort((a, b) => {
      const dateA = this.parseDate(a.date);
      const dateB = this.parseDate(b.date);
      return dateB.getTime() - dateA.getTime(); // newest first
    });

    // Validate current NAV data point
    if (!sortedNavData[0]?.nav || isNaN(parseFloat(sortedNavData[0].nav))) {
      console.warn('[MFReturnsSyncService] Invalid current NAV data point');
      return { returns1y: null, returns3y: null, returns5y: null, currentNav: 0, dataQuality: 'insufficient' };
    }

    const currentNav = parseFloat(sortedNavData[0].nav);
    const currentDate = this.parseDate(sortedNavData[0].date);
    
    // Calculate target dates
    const oneYearAgo = new Date(currentDate);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const threeYearsAgo = new Date(currentDate);
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    
    const fiveYearsAgo = new Date(currentDate);
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    // Find closest NAVs for each period (using sorted data)
    const nav1y = this.findClosestNav(sortedNavData, oneYearAgo);
    const nav3y = this.findClosestNav(sortedNavData, threeYearsAgo);
    const nav5y = this.findClosestNav(sortedNavData, fiveYearsAgo);

    // Calculate returns
    const returns1y = nav1y ? this.calculateCAGR(currentNav, nav1y.nav, 1) : null;
    const returns3y = nav3y ? this.calculateCAGR(currentNav, nav3y.nav, 3) : null;
    const returns5y = nav5y ? this.calculateCAGR(currentNav, nav5y.nav, 5) : null;

    // Determine data quality
    let dataQuality: 'full' | 'partial' | 'insufficient' = 'full';
    if (!returns1y && !returns3y && !returns5y) {
      dataQuality = 'insufficient';
    } else if (!returns3y || !returns5y) {
      dataQuality = 'partial';
    }

    return { returns1y, returns3y, returns5y, currentNav, dataQuality };
  }

  /**
   * Get current adaptive delay
   */
  getCurrentDelay(): number {
    return this.currentDelay;
  }

  /**
   * Reset rate limit tracking on successful requests
   */
  private onSuccessfulRequest(): void {
    this.consecutiveRateLimits = 0;
    // Gradually reduce delay back to base on success
    this.currentDelay = Math.max(BASE_DELAY, this.currentDelay * 0.9);
  }

  /**
   * Handle rate limit - increase delay exponentially
   */
  private onRateLimit(): void {
    this.consecutiveRateLimits++;
    this.currentDelay = Math.min(
      BASE_DELAY * Math.pow(BACKOFF_MULTIPLIER, this.consecutiveRateLimits),
      60000 // Max 60 second delay
    );
    console.log(`[MFReturnsSync] Rate limit detected, increasing delay to ${this.currentDelay}ms`);
  }

  /**
   * Fetch historical NAV data from MFAPI with retry and backoff
   */
  async fetchHistoricalNAV(schemeCode: string, retryAttempt = 0): Promise<NavDataPoint[] | null> {
    try {
      const response = await axios.get<MFAPIResponse>(`${MFAPI_BASE_URL}/${schemeCode}`, {
        timeout: REQUEST_TIMEOUT,
        headers: {
          'User-Agent': 'FintekPro/1.0',
          'Accept': 'application/json'
        }
      });

      if (response.data?.status === 'SUCCESS' && response.data?.data?.length > 0) {
        this.onSuccessfulRequest();
        return response.data.data;
      }
      return null;
    } catch (error: any) {
      const isRateLimit = error.message?.includes('Too Many Requests') || error.response?.status === 429;
      
      if (isRateLimit) {
        this.onRateLimit();
        
        // Retry with backoff if we haven't exceeded max attempts
        if (retryAttempt < MAX_RETRY_ATTEMPTS) {
          const backoffDelay = this.currentDelay * (retryAttempt + 1);
          console.log(`[MFReturnsSync] Rate limited for ${schemeCode}, retrying in ${backoffDelay}ms (attempt ${retryAttempt + 1}/${MAX_RETRY_ATTEMPTS})`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          return this.fetchHistoricalNAV(schemeCode, retryAttempt + 1);
        }
        console.log(`[MFReturnsSync] Max retries exceeded for scheme ${schemeCode}`);
      }
      return null;
    }
  }

  /**
   * Store historical NAV data in database for future use
   */
  async storeHistoricalData(schemeCode: string, navData: NavDataPoint[]): Promise<number> {
    if (!navData || navData.length === 0) return 0;
    
    const identifier = schemeCode.toString();
    const identifierType = 'mutual_fund';
    let stored = 0;

    // Process in batches
    const records = navData.filter(d => d.date && d.nav).map(d => ({
      identifier,
      identifierType,
      date: this.parseDate(d.date),
      nav: d.nav,
      source: 'mfapi' as const
    }));

    for (let i = 0; i < records.length; i += 200) {
      const batch = records.slice(i, i + 200);
      try {
        await db.execute(sql`
          INSERT INTO historical_nav_data (id, identifier, identifier_type, date, nav, source, fetched_at, created_at)
          SELECT * FROM (
            VALUES ${sql.join(
              batch.map(r => sql`(
                ${`${identifier}-${r.date.toISOString().split('T')[0]}`}::varchar,
                ${r.identifier}::varchar,
                ${r.identifierType}::varchar,
                ${r.date.toISOString().split('T')[0]}::date,
                ${r.nav}::numeric,
                ${r.source}::varchar,
                NOW(),
                NOW()
              )`),
              sql`,`
            )}
          ) AS t(id, identifier, identifier_type, date, nav, source, fetched_at, created_at)
          ON CONFLICT (identifier, identifier_type, date) DO NOTHING
        `);
        stored += batch.length;
      } catch (error: any) {
        // Silently continue on constraint errors
        if (!error.message?.includes('constraint')) {
          console.error(`[MFReturnsSync] Error storing batch:`, error.message);
        }
      }
    }
    
    return stored;
  }

  /**
   * Update mutual_funds table with calculated returns and financial ratios
   */
  async updateFundReturns(
    schemeCode: string, 
    returns: CalculatedReturns,
    ratios?: FinancialRatios
  ): Promise<boolean> {
    try {
      const updateData: Record<string, any> = {
        returns1y: returns.returns1y?.toFixed(4) || null,
        returns3y: returns.returns3y?.toFixed(4) || null,
        returns5y: returns.returns5y?.toFixed(4) || null,
        lastUpdated: new Date()
      };

      // Add financial ratios if provided
      if (ratios) {
        updateData.standardDeviation = ratios.standardDeviation?.toString() || null;
        updateData.sharpeRatio = ratios.sharpeRatio?.toString() || null;
        updateData.sortinoRatio = ratios.sortinoRatio?.toString() || null;
        updateData.maxDrawdown = ratios.maxDrawdown?.toString() || null;
        updateData.alpha = ratios.alpha?.toString() || null;
        updateData.beta = ratios.beta?.toString() || null;
        updateData.treynorRatio = ratios.treynorRatio?.toString() || null;
        updateData.informationRatio = ratios.informationRatio?.toString() || null;
      }

      await db.update(mutualFunds)
        .set(updateData)
        .where(eq(mutualFunds.schemeCode, schemeCode));
      
      return true;
    } catch (error: any) {
      console.error(`[MFReturnsSync] Error updating returns for ${schemeCode}:`, error.message);
      return false;
    }
  }

  /**
   * Sync returns and financial ratios for a single fund
   */
  async syncSingleFund(schemeCode: string): Promise<EnrichedFundData | null> {
    const navData = await this.fetchHistoricalNAV(schemeCode);
    if (!navData) return null;

    const returns = this.calculateReturnsFromHistory(navData);
    const ratios = this.calculateFinancialRatios(navData);
    
    if (returns.dataQuality !== 'insufficient') {
      await this.updateFundReturns(schemeCode, returns, ratios);
      // Store historical data for future use
      await this.storeHistoricalData(schemeCode, navData);
    }
    
    return { ...returns, ratios };
  }

  /**
   * Get priority funds that need returns calculation
   * Priority: popular funds, funds with null returns, funds not updated in 24h
   */
  async getFundsNeedingSync(limit: number = 200): Promise<string[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get funds without returns OR stale returns
    const fundsNeedingSync = await db.select({
      schemeCode: mutualFunds.schemeCode
    })
    .from(mutualFunds)
    .where(
      or(
        isNull(mutualFunds.returns1y),
        lt(mutualFunds.lastUpdated, oneDayAgo)
      )
    )
    .orderBy(desc(mutualFunds.nav)) // Prioritize funds with higher NAV (more popular)
    .limit(limit);
    
    return fundsNeedingSync.map(f => f.schemeCode);
  }

  /**
   * Run batch sync for funds needing returns
   */
  async runBatchSync(maxFunds: number = 100): Promise<{
    processed: number;
    successful: number;
    failed: number;
  }> {
    if (this.isRunning) {
      console.log('[MFReturnsSync] Sync already in progress, skipping');
      return { processed: 0, successful: 0, failed: 0 };
    }

    this.isRunning = true;
    console.log(`[MFReturnsSync] Starting batch sync for up to ${maxFunds} funds...`);
    
    let processed = 0;
    let successful = 0;
    let failed = 0;

    try {
      const fundsToSync = await this.getFundsNeedingSync(maxFunds);
      console.log(`[MFReturnsSync] Found ${fundsToSync.length} funds needing sync`);

      for (const schemeCode of fundsToSync) {
        try {
          const returns = await this.syncSingleFund(schemeCode);
          processed++;
          
          if (returns && returns.dataQuality !== 'insufficient') {
            successful++;
            if (successful % 10 === 0) {
              console.log(`[MFReturnsSync] Progress: ${successful}/${processed} successful`);
            }
          } else {
            failed++;
          }
          
          // Use centralized adaptive delay
          await new Promise(resolve => setTimeout(resolve, this.currentDelay));
          
        } catch (error: any) {
          failed++;
          // Errors including rate limits are handled by syncSingleFund with built-in retry/backoff
          console.log(`[MFReturnsSync] Batch sync error for ${schemeCode}: ${error.message}`);
        }
      }

      this.lastSyncTime = new Date();
      console.log(`[MFReturnsSync] Batch sync complete: ${successful}/${processed} successful, ${failed} failed`);
      
    } finally {
      this.isRunning = false;
    }

    return { processed, successful, failed };
  }

  /**
   * Get returns for a specific fund (with live fetch fallback)
   */
  async getReturnsForFund(schemeCode: string): Promise<CalculatedReturns | null> {
    // First check database
    const fund = await db.select({
      returns1y: mutualFunds.returns1y,
      returns3y: mutualFunds.returns3y,
      returns5y: mutualFunds.returns5y,
      nav: mutualFunds.nav,
      lastUpdated: mutualFunds.lastUpdated
    })
    .from(mutualFunds)
    .where(eq(mutualFunds.schemeCode, schemeCode))
    .limit(1);

    if (fund.length > 0 && fund[0].returns1y) {
      // Check if data is fresh (less than 24 hours old)
      const lastUpdated = fund[0].lastUpdated ? new Date(fund[0].lastUpdated) : new Date(0);
      const hoursSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceUpdate < 24) {
        return {
          returns1y: parseFloat(fund[0].returns1y as string) || null,
          returns3y: parseFloat(fund[0].returns3y as string) || null,
          returns5y: parseFloat(fund[0].returns5y as string) || null,
          currentNav: parseFloat(fund[0].nav as string) || 0,
          dataQuality: 'full'
        };
      }
    }

    // Fallback: fetch live data
    return this.syncSingleFund(schemeCode);
  }

  /**
   * Get sync status
   */
  getStatus(): { isRunning: boolean; lastSyncTime: Date | null } {
    return { isRunning: this.isRunning, lastSyncTime: this.lastSyncTime };
  }
}

export const mfReturnsSyncService = MFReturnsSyncService.getInstance();
