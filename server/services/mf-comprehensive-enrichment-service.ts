// @ts-nocheck
import axios from 'axios';
import { db } from '../db';
import { getProductionDb, hasProductionDb, requireProductionDb, getEnrichmentReadDb, getEnrichmentWriteDb } from '../db';
import { mutualFunds, mutualFundMetrics, mfEnrichmentAuditLogs, mfAumHistory } from '@shared/schema';
import { eq, desc, sql, isNull, or, and } from 'drizzle-orm';

const MFAPI_BASE_URL = 'https://api.mfapi.in/mf';
const AMFI_NAV_URL = 'https://www.amfiindia.com/spages/NAVAll.txt';

interface MFAPIMetadata {
  fund_house: string;
  scheme_type: string;
  scheme_category: string;
  scheme_code: number;
  scheme_name: string;
  isin_growth?: string;
  isin_div_reinvestment?: string;
}

interface MFAPINavPoint {
  date: string;
  nav: string;
}

interface MFAPIResponse {
  meta: MFAPIMetadata;
  data: MFAPINavPoint[];
  status: string;
}

interface AmfiNavRecord {
  schemeCode: string;
  schemeName: string;
  nav: number;
  navDate: string;
  fundHouse: string;
  schemeType: string;
  schemeCategory: string;
  isinGrowth: string;
  isinDividendReinvest: string;
}

interface EnrichmentProgress {
  status: 'idle' | 'phase1_amfi' | 'phase2_extdata' | 'phase3_mfapi_meta' | 'phase4_mfapi_returns' | 'phase5_defaults' | 'phase6_ratings' | 'completed' | 'error';
  currentStep: string;
  totalFunds: number;
  processedFunds: number;
  phase1Stats: { aumUpdated: number; categoryUpdated: number; isinUpdated: number };
  phase2Stats: { exitLoadUpdated: number; minSipUpdated: number; minLumpsumUpdated: number; launchDateUpdated: number };
  phase3Stats: { subCategoryUpdated: number; launchDateFromNav: number; metaFetched: number };
  phase4Stats: { returnsUpdated: number; ratiosUpdated: number; fundsSynced: number };
  phase5Stats: { exitLoadDefaults: number; minSipDefaults: number; minLumpsumDefaults: number; subCategoryDefaults: number };
  phase6Stats: { ratingsComputed: number; ratingsPersisted: number; ratingsFailed: number };
  errors: string[];
  startedAt: Date | null;
  duration: number;
}

let enrichmentProgress: EnrichmentProgress = createEmptyProgress();

function createEmptyProgress(): EnrichmentProgress {
  return {
    status: 'idle',
    currentStep: '',
    totalFunds: 0,
    processedFunds: 0,
    phase1Stats: { aumUpdated: 0, categoryUpdated: 0, isinUpdated: 0 },
    phase2Stats: { exitLoadUpdated: 0, minSipUpdated: 0, minLumpsumUpdated: 0, launchDateUpdated: 0 },
    phase3Stats: { subCategoryUpdated: 0, launchDateFromNav: 0, metaFetched: 0 },
    phase4Stats: { returnsUpdated: 0, ratiosUpdated: 0, fundsSynced: 0 },
    phase5Stats: { exitLoadDefaults: 0, minSipDefaults: 0, minLumpsumDefaults: 0, subCategoryDefaults: 0 },
    phase6Stats: { ratingsComputed: 0, ratingsPersisted: 0, ratingsFailed: 0 },
    errors: [],
    startedAt: null,
    duration: 0,
  };
}

const CATEGORY_EXIT_LOAD_DEFAULTS: Record<string, { percent: number; days: number }> = {
  'Liquid': { percent: 0, days: 0 },
  'Overnight': { percent: 0, days: 0 },
  'Ultra Short Duration': { percent: 0, days: 0 },
  'Money Market': { percent: 0, days: 0 },
  'Low Duration': { percent: 0, days: 0 },
  'Short Duration': { percent: 0, days: 0 },
  'Medium Duration': { percent: 0.5, days: 365 },
  'Long Duration': { percent: 0.5, days: 365 },
  'Dynamic Bond': { percent: 0.5, days: 365 },
  'Corporate Bond': { percent: 0.25, days: 180 },
  'Credit Risk': { percent: 1, days: 365 },
  'Banking & PSU': { percent: 0, days: 0 },
  'Gilt': { percent: 0, days: 0 },
  'Floater': { percent: 0, days: 0 },
  'Large Cap': { percent: 1, days: 365 },
  'Large & Mid Cap': { percent: 1, days: 365 },
  'Mid Cap': { percent: 1, days: 365 },
  'Small Cap': { percent: 1, days: 365 },
  'Multi Cap': { percent: 1, days: 365 },
  'Flexi Cap': { percent: 1, days: 365 },
  'Focused': { percent: 1, days: 365 },
  'Value/Contra': { percent: 1, days: 365 },
  'ELSS': { percent: 0, days: 0 },
  'Dividend Yield': { percent: 1, days: 365 },
  'Sectoral/Thematic': { percent: 1, days: 365 },
  'Index Funds': { percent: 0.25, days: 15 },
  'ETF': { percent: 0, days: 0 },
  'Aggressive Hybrid': { percent: 1, days: 365 },
  'Conservative Hybrid': { percent: 1, days: 365 },
  'Balanced Advantage': { percent: 1, days: 365 },
  'Equity Savings': { percent: 1, days: 365 },
  'Arbitrage': { percent: 0.25, days: 30 },
  'Multi Asset Allocation': { percent: 1, days: 365 },
  'Solution Oriented': { percent: 1, days: 365 },
  'Fund of Funds': { percent: 1, days: 365 },
  'International': { percent: 1, days: 365 },
  'Equity': { percent: 1, days: 365 },
  'Debt': { percent: 0.5, days: 180 },
  'Hybrid': { percent: 1, days: 365 },
};

const CATEGORY_MIN_AMOUNTS: Record<string, { sip: number; lumpsum: number }> = {
  'Liquid': { sip: 500, lumpsum: 500 },
  'Overnight': { sip: 500, lumpsum: 500 },
  'Ultra Short Duration': { sip: 500, lumpsum: 500 },
  'Money Market': { sip: 500, lumpsum: 500 },
  'Large Cap': { sip: 500, lumpsum: 5000 },
  'Mid Cap': { sip: 500, lumpsum: 5000 },
  'Small Cap': { sip: 500, lumpsum: 5000 },
  'Flexi Cap': { sip: 500, lumpsum: 5000 },
  'Multi Cap': { sip: 500, lumpsum: 5000 },
  'ELSS': { sip: 500, lumpsum: 500 },
  'Index Funds': { sip: 500, lumpsum: 1000 },
  'ETF': { sip: 500, lumpsum: 500 },
};
const DEFAULT_MIN_SIP = 500;
const DEFAULT_MIN_LUMPSUM = 5000;

class MFComprehensiveEnrichmentService {
  private static instance: MFComprehensiveEnrichmentService;
  private isRunning = false;
  private currentDelay = 800;
  private consecutiveRateLimits = 0;
  private amfiCache: Map<string, AmfiNavRecord> = new Map();
  private lastAmfiFetchTime = 0;

  static getInstance(): MFComprehensiveEnrichmentService {
    if (!this.instance) {
      this.instance = new MFComprehensiveEnrichmentService();
    }
    return this.instance;
  }

  getProgress(): EnrichmentProgress {
    return { ...enrichmentProgress };
  }

  private async logAuditChange(
    schemeCode: string,
    fieldName: string,
    oldValue: string | null,
    newValue: string | null,
    changeType: string,
    source: string,
    enrichmentRunId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await getEnrichmentWriteDb().insert(mfEnrichmentAuditLogs).values({
        schemeCode,
        fieldName,
        oldValue,
        newValue,
        changeType,
        source,
        enrichmentRunId,
        metadata: metadata || null,
      });
    } catch (error: any) {
      console.warn(`[AuditLog] Failed to log change for ${schemeCode}.${fieldName}: ${error.message}`);
    }
  }

  private async recordAumHistory(
    schemeCode: string,
    aum: number,
    source: string
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const previousRecords = await getEnrichmentReadDb(db).select({
        aum: mfAumHistory.aum,
      }).from(mfAumHistory)
        .where(eq(mfAumHistory.schemeCode, schemeCode))
        .orderBy(desc(mfAumHistory.asOfDate))
        .limit(1);

      let dayOverDayChangePercent: string | null = null;
      let anomalyFlag = false;

      if (previousRecords.length > 0 && previousRecords[0].aum) {
        const prevAum = parseFloat(previousRecords[0].aum);
        if (prevAum > 0) {
          const changePercent = ((aum - prevAum) / prevAum) * 100;
          dayOverDayChangePercent = changePercent.toFixed(4);
          anomalyFlag = Math.abs(changePercent) > 20;
        }
      }

      await getEnrichmentWriteDb().insert(mfAumHistory).values({
        schemeCode,
        asOfDate: today,
        aum: aum.toFixed(2),
        source,
        dayOverDayChangePercent,
        anomalyFlag,
      }).onConflictDoNothing();
    } catch (error: any) {
      console.warn(`[AumHistory] Failed to record AUM for ${schemeCode}: ${error.message}`);
    }
  }

  async getAuditLogs(schemeCode?: string, limit?: number, changeType?: string) {
    const conditions = [];
    if (schemeCode) {
      conditions.push(eq(mfEnrichmentAuditLogs.schemeCode, schemeCode));
    }
    if (changeType) {
      conditions.push(eq(mfEnrichmentAuditLogs.changeType, changeType));
    }

    const query = db.select().from(mfEnrichmentAuditLogs);

    if (conditions.length > 0) {
      return await query
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(mfEnrichmentAuditLogs.createdAt))
        .limit(limit || 100);
    }

    return await query
      .orderBy(desc(mfEnrichmentAuditLogs.createdAt))
      .limit(limit || 100);
  }

  private parseAUM(aumStr: string): number | null {
    if (!aumStr || aumStr === '-' || aumStr === 'N/A') return null;
    const cleaned = aumStr.replace(/[₹,\s]/g, '').trim();
    const croreMatch = cleaned.match(/^([\d.]+)\s*(Cr|Crore|cr)?$/i);
    if (croreMatch) return parseFloat(croreMatch[1]);
    const lakhMatch = cleaned.match(/^([\d.]+)\s*(L|Lakh|lakh)?$/i);
    if (lakhMatch) return parseFloat(lakhMatch[1]) / 100;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  private parseAmfiDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    return isNaN(date.getTime()) ? null : date;
  }

  private mapSchemeCategory(category: string): string | null {
    if (!category) return null;
    const lower = category.toLowerCase();
    if (lower.includes('banking and psu')) return 'Banking & PSU';
    if (lower.includes('corporate bond')) return 'Corporate Bond';
    if (lower.includes('credit risk')) return 'Credit Risk';
    if (lower.includes('dynamic bond')) return 'Dynamic Bond';
    if (lower.includes('floater')) return 'Floater';
    if (lower.includes('gilt')) return 'Gilt';
    if (lower.includes('liquid')) return 'Liquid';
    if (lower.includes('low duration')) return 'Low Duration';
    if (lower.includes('medium duration') || lower.includes('medium to long')) return 'Medium Duration';
    if (lower.includes('long duration')) return 'Long Duration';
    if (lower.includes('money market')) return 'Money Market';
    if (lower.includes('overnight')) return 'Overnight';
    if (lower.includes('short duration')) return 'Short Duration';
    if (lower.includes('ultra short')) return 'Ultra Short Duration';
    if (lower.includes('large cap') && lower.includes('mid cap')) return 'Large & Mid Cap';
    if (lower.includes('large cap')) return 'Large Cap';
    if (lower.includes('mid cap')) return 'Mid Cap';
    if (lower.includes('small cap')) return 'Small Cap';
    if (lower.includes('multi cap')) return 'Multi Cap';
    if (lower.includes('flexi cap')) return 'Flexi Cap';
    if (lower.includes('focused')) return 'Focused';
    if (lower.includes('value') || lower.includes('contra')) return 'Value/Contra';
    if (lower.includes('elss') || lower.includes('tax sav')) return 'ELSS';
    if (lower.includes('dividend yield')) return 'Dividend Yield';
    if (lower.includes('sectoral') || lower.includes('thematic')) return 'Sectoral/Thematic';
    if (lower.includes('balanced advantage') || lower.includes('dynamic asset')) return 'Balanced Advantage';
    if (lower.includes('aggressive hybrid')) return 'Aggressive Hybrid';
    if (lower.includes('conservative hybrid')) return 'Conservative Hybrid';
    if (lower.includes('equity savings')) return 'Equity Savings';
    if (lower.includes('arbitrage')) return 'Arbitrage';
    if (lower.includes('multi asset')) return 'Multi Asset Allocation';
    if (lower.includes('index') || lower.includes('nifty') || lower.includes('sensex')) return 'Index Funds';
    if (lower.includes('fof') || lower.includes('fund of fund')) return 'Fund of Funds';
    if (lower.includes('solution') || lower.includes('retirement') || lower.includes('children')) return 'Solution Oriented';
    if (lower.includes('international') || lower.includes('global') || lower.includes('overseas')) return 'International';
    return category;
  }

  private async fetchAmfiData(): Promise<Map<string, AmfiNavRecord>> {
    const TTL = 6 * 60 * 60 * 1000;
    if (this.amfiCache.size > 0 && Date.now() - this.lastAmfiFetchTime < TTL) {
      return this.amfiCache;
    }

    try {
      console.log('[ComprehensiveEnrichment] Fetching official AMFI NAV data from amfiindia.com...');
      const response = await axios.get(AMFI_NAV_URL, {
        timeout: 120000,
        responseType: 'text',
      });

      const rawData = response.data as string;
      const lines = rawData.split('\n');
      const data = new Map<string, AmfiNavRecord>();

      let currentFundHouse = '';
      let currentSchemeType = '';
      let currentSchemeCategory = '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (!trimmedLine.includes(';') && trimmedLine.includes('Mutual Fund')) {
          currentFundHouse = trimmedLine;
          continue;
        }

        if (trimmedLine.startsWith('Open Ended Schemes') ||
            trimmedLine.startsWith('Close Ended Schemes') ||
            trimmedLine.startsWith('Interval Fund Schemes')) {
          currentSchemeType = trimmedLine.split('(')[0].trim();
          const categoryMatch = trimmedLine.match(/\(([^)]+)\)/);
          currentSchemeCategory = categoryMatch ? categoryMatch[1] : '';
          continue;
        }

        if (!trimmedLine.includes(';') &&
            (trimmedLine === trimmedLine.toUpperCase() ||
             trimmedLine.includes('Scheme') ||
             trimmedLine.includes('Fund'))) {
          if (!trimmedLine.includes('Mutual Fund')) {
            currentSchemeCategory = trimmedLine;
          }
          continue;
        }

        const parts = trimmedLine.split(';');
        if (parts.length >= 5) {
          const schemeCode = parts[0]?.trim();
          const isinGrowth = parts[1]?.trim() || '';
          const isinDividendReinvest = parts[2]?.trim() || '';
          const schemeName = parts[3]?.trim() || '';
          const navStr = parts[4]?.trim() || '';
          const navDate = parts[5]?.trim() || '';

          if (!schemeCode || !/^\d+$/.test(schemeCode)) continue;
          const nav = parseFloat(navStr);
          if (isNaN(nav) || nav <= 0) continue;

          data.set(schemeCode, {
            schemeCode,
            schemeName,
            nav,
            navDate,
            fundHouse: currentFundHouse,
            schemeType: currentSchemeType,
            schemeCategory: currentSchemeCategory,
            isinGrowth,
            isinDividendReinvest,
          });
        }
      }

      this.amfiCache = data;
      this.lastAmfiFetchTime = Date.now();
      console.log(`[ComprehensiveEnrichment] Loaded ${data.size} schemes from official AMFI feed`);
      return data;
    } catch (error: any) {
      console.warn('[ComprehensiveEnrichment] AMFI fetch failed:', error.message);
      return this.amfiCache;
    }
  }

  private async fetchMFAPIWithRetry(schemeCode: string, retryAttempt = 0): Promise<MFAPIResponse | null> {
    try {
      const response = await axios.get<MFAPIResponse>(`${MFAPI_BASE_URL}/${schemeCode}`, {
        timeout: 30000,
        headers: { 'User-Agent': 'FintekPro/2.5', 'Accept': 'application/json' }
      });
      if (response.data?.status === 'SUCCESS') {
        this.consecutiveRateLimits = 0;
        this.currentDelay = Math.max(800, this.currentDelay * 0.9);
        return response.data;
      }
      return null;
    } catch (error: any) {
      const isRateLimit = error.response?.status === 429;
      if (isRateLimit && retryAttempt < 3) {
        this.consecutiveRateLimits++;
        this.currentDelay = Math.min(800 * Math.pow(2, this.consecutiveRateLimits), 60000);
        const backoff = this.currentDelay * (retryAttempt + 1);
        await new Promise(resolve => setTimeout(resolve, backoff));
        return this.fetchMFAPIWithRetry(schemeCode, retryAttempt + 1);
      }
      return null;
    }
  }

  private calculateCAGR(currentNav: number, oldNav: number, years: number): number {
    if (oldNav <= 0 || years <= 0 || currentNav <= 0) return 0;
    return (Math.pow(currentNav / oldNav, 1 / years) - 1) * 100;
  }

  private findClosestNav(navData: MFAPINavPoint[], targetDate: Date, maxDaysOffset = 10): { nav: number; date: Date } | null {
    const targetTime = targetDate.getTime();
    let closest: { nav: number; date: Date } | null = null;
    let closestDiff = Infinity;
    for (const point of navData) {
      const pointDate = this.parseAmfiDate(point.date);
      if (!pointDate) continue;
      const diff = Math.abs(pointDate.getTime() - targetTime);
      if (diff < closestDiff && diff <= maxDaysOffset * 24 * 60 * 60 * 1000) {
        closestDiff = diff;
        closest = { nav: parseFloat(point.nav), date: pointDate };
      }
    }
    return closest;
  }

  private calculateReturns(navData: MFAPINavPoint[]): { returns1y: number | null; returns3y: number | null; returns5y: number | null } {
    if (!navData || navData.length === 0) return { returns1y: null, returns3y: null, returns5y: null };

    const sorted = [...navData].sort((a, b) => {
      const da = this.parseAmfiDate(a.date);
      const db2 = this.parseAmfiDate(b.date);
      if (!da || !db2) return 0;
      return db2.getTime() - da.getTime();
    });

    const currentNav = parseFloat(sorted[0].nav);
    const currentDate = this.parseAmfiDate(sorted[0].date);
    if (!currentDate || isNaN(currentNav)) return { returns1y: null, returns3y: null, returns5y: null };

    const oneYearAgo = new Date(currentDate); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const threeYearsAgo = new Date(currentDate); threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const fiveYearsAgo = new Date(currentDate); fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const nav1y = this.findClosestNav(sorted, oneYearAgo);
    const nav3y = this.findClosestNav(sorted, threeYearsAgo);
    const nav5y = this.findClosestNav(sorted, fiveYearsAgo);

    return {
      returns1y: nav1y ? this.calculateCAGR(currentNav, nav1y.nav, 1) : null,
      returns3y: nav3y ? this.calculateCAGR(currentNav, nav3y.nav, 3) : null,
      returns5y: nav5y ? this.calculateCAGR(currentNav, nav5y.nav, 5) : null,
    };
  }

  private calculateFinancialRatios(navData: MFAPINavPoint[]): {
    standardDeviation: number | null;
    sharpeRatio: number | null;
    sortinoRatio: number | null;
    maxDrawdown: number | null;
  } {
    const RISK_FREE_RATE = 6.0;
    if (!navData || navData.length < 30) {
      return { standardDeviation: null, sharpeRatio: null, sortinoRatio: null, maxDrawdown: null };
    }

    const sorted = [...navData].sort((a, b) => {
      const da = this.parseAmfiDate(a.date);
      const db2 = this.parseAmfiDate(b.date);
      if (!da || !db2) return 0;
      return da.getTime() - db2.getTime();
    });

    const dailyReturns: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = parseFloat(sorted[i - 1].nav);
      const curr = parseFloat(sorted[i].nav);
      if (prev > 0) dailyReturns.push(((curr - prev) / prev) * 100);
    }

    if (dailyReturns.length < 20) {
      return { standardDeviation: null, sharpeRatio: null, sortinoRatio: null, maxDrawdown: null };
    }

    const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / (dailyReturns.length - 1);
    const dailyStdDev = Math.sqrt(variance);
    const annualizedStdDev = dailyStdDev * Math.sqrt(252);
    const annualizedReturn = meanReturn * 252;
    const sharpeRatio = annualizedStdDev > 0 ? (annualizedReturn - RISK_FREE_RATE) / annualizedStdDev : null;

    const negativeReturns = dailyReturns.filter(r => r < 0);
    const downsideVariance = negativeReturns.length > 0
      ? negativeReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / negativeReturns.length : 0;
    const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);
    const sortinoRatio = downsideDeviation > 0 ? (annualizedReturn - RISK_FREE_RATE) / downsideDeviation : null;

    let maxDrawdown = 0;
    let peak = parseFloat(sorted[0].nav);
    for (const point of sorted) {
      const nav = parseFloat(point.nav);
      if (nav > peak) peak = nav;
      const drawdown = (peak - nav) / peak * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return {
      standardDeviation: parseFloat(annualizedStdDev.toFixed(4)),
      sharpeRatio: sharpeRatio !== null ? parseFloat(sharpeRatio.toFixed(4)) : null,
      sortinoRatio: sortinoRatio !== null ? parseFloat(sortinoRatio.toFixed(4)) : null,
      maxDrawdown: parseFloat(maxDrawdown.toFixed(4)),
    };
  }

  async runComprehensiveEnrichment(options: {
    maxMfapiFunds?: number;
    skipMfapi?: boolean;
    batchSize?: number;
  } = {}): Promise<EnrichmentProgress> {
    if (this.isRunning) {
      console.log('[ComprehensiveEnrichment] Already running, skipping');
      return enrichmentProgress;
    }

    if (!requireProductionDb('MFComprehensiveEnrichment')) {
      return createEmptyProgress();
    }

    this.isRunning = true;
    enrichmentProgress = createEmptyProgress();
    enrichmentProgress.startedAt = new Date();

    const { maxMfapiFunds = 500, skipMfapi = false, batchSize = 500 } = options;
    const enrichmentRunId = `enrichment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const [countResult] = await getEnrichmentReadDb(db).select({ total: sql<number>`COUNT(*)` }).from(mutualFunds);
      enrichmentProgress.totalFunds = Number(countResult?.total || 0);

      await this.phase1_AmfiEnrichment(batchSize, enrichmentRunId);

      await this.phase2_ExtendedDataExtraction(batchSize, enrichmentRunId);

      await this.phase3_MFAPIMetadata(maxMfapiFunds, enrichmentRunId);

      if (!skipMfapi) {
        await this.phase4_MFAPIReturns(maxMfapiFunds, enrichmentRunId);
      }

      await this.phase5_CategoryDefaults(batchSize, enrichmentRunId);

      await this.phase6_FintekProRatings(enrichmentRunId);

      enrichmentProgress.status = 'completed';
      enrichmentProgress.currentStep = 'All enrichment phases completed (including FintekPro Smart Ratings)';
      enrichmentProgress.duration = Date.now() - enrichmentProgress.startedAt!.getTime();
      console.log(`[ComprehensiveEnrichment] All phases completed in ${enrichmentProgress.duration}ms`);

    } catch (error: any) {
      enrichmentProgress.status = 'error';
      enrichmentProgress.currentStep = `Fatal error: ${error.message}`;
      enrichmentProgress.errors.push(error.message);
      console.error('[ComprehensiveEnrichment] Fatal error:', error);
    } finally {
      this.isRunning = false;
      enrichmentProgress.duration = Date.now() - (enrichmentProgress.startedAt?.getTime() || Date.now());
    }

    return enrichmentProgress;
  }

  private async phase1_AmfiEnrichment(batchSize: number, enrichmentRunId: string): Promise<void> {
    enrichmentProgress.status = 'phase1_amfi';
    enrichmentProgress.currentStep = 'Phase 1: Fetching official AMFI NAV feed (amfiindia.com)...';
    console.log('[ComprehensiveEnrichment] Phase 1: Official AMFI feed enrichment');

    const amfiData = await this.fetchAmfiData();
    if (amfiData.size === 0) {
      enrichmentProgress.errors.push('AMFI official feed returned empty');
      return;
    }

    const funds = await getEnrichmentReadDb(db).select({
      id: mutualFunds.id,
      schemeCode: mutualFunds.schemeCode,
      category: mutualFunds.category,
      fundHouse: mutualFunds.fundHouse,
      nav: mutualFunds.nav,
      isin: mutualFunds.isin,
      isinGrowth: mutualFunds.isinGrowth,
      isinDividendReinvest: mutualFunds.isinDividendReinvest,
      dataSource: mutualFunds.dataSource,
    }).from(mutualFunds).where(
      or(isNull(mutualFunds.category), isNull(mutualFunds.isin), isNull(mutualFunds.fundHouse), isNull(mutualFunds.nav))
    );

    for (let i = 0; i < funds.length; i += batchSize) {
      const batch = funds.slice(i, i + batchSize);
      enrichmentProgress.currentStep = `Phase 1: AMFI batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(funds.length / batchSize)}`;

      const updatePromises = batch.map(async (fund) => {
        try {
          const amfiRow = amfiData.get(fund.schemeCode);
          if (!amfiRow) return;
          const updates: Record<string, any> = {};

          if (fund.category === null && amfiRow.schemeCategory) {
            const fullCategory = amfiRow.schemeType
              ? `${amfiRow.schemeType} - ${amfiRow.schemeCategory}`
              : amfiRow.schemeCategory;
            updates.category = fullCategory;
            enrichmentProgress.phase1Stats.categoryUpdated++;
            await this.logAuditChange(fund.schemeCode, 'category', null, fullCategory, 'enrichment', 'AMFI', enrichmentRunId);
          }

          if (fund.nav === null && amfiRow.nav > 0) {
            updates.nav = amfiRow.nav.toString();
          }

          if (!fund.fundHouse && amfiRow.fundHouse) {
            updates.fundHouse = amfiRow.fundHouse;
          }

          if (!fund.isin && amfiRow.isinGrowth && amfiRow.isinGrowth !== '-' && amfiRow.isinGrowth.length > 3) {
            updates.isin = amfiRow.isinGrowth;
            updates.isinGrowth = amfiRow.isinGrowth;
            enrichmentProgress.phase1Stats.isinUpdated++;
            await this.logAuditChange(fund.schemeCode, 'isin', null, amfiRow.isinGrowth, 'enrichment', 'AMFI', enrichmentRunId);
          }

          if (!fund.isinDividendReinvest && amfiRow.isinDividendReinvest && amfiRow.isinDividendReinvest !== '-' && amfiRow.isinDividendReinvest.length > 3) {
            updates.isinDividendReinvest = amfiRow.isinDividendReinvest;
          }

          if (Object.keys(updates).length > 0) {
            updates.lastVerifiedAt = new Date();
            updates.dataSource = 'AMFI';
            await getEnrichmentWriteDb().update(mutualFunds).set(updates).where(eq(mutualFunds.id, fund.id));
          }
        } catch (error: any) {
          enrichmentProgress.errors.push(`P1 ${fund.schemeCode}: ${error.message}`);
        }
      });

      await Promise.all(updatePromises);
    }

    console.log(`[ComprehensiveEnrichment] Phase 1 done: Category=${enrichmentProgress.phase1Stats.categoryUpdated}, ISIN=${enrichmentProgress.phase1Stats.isinUpdated} (source: AMFI official feed)`);
  }

  private async phase2_ExtendedDataExtraction(batchSize: number, enrichmentRunId: string): Promise<void> {
    enrichmentProgress.status = 'phase2_extdata';
    enrichmentProgress.currentStep = 'Phase 2: Extracting from extendedData JSONB...';
    console.log('[ComprehensiveEnrichment] Phase 2: ExtendedData extraction');

    const funds = await getEnrichmentReadDb(db).select({
      id: mutualFunds.id,
      schemeCode: mutualFunds.schemeCode,
      extendedData: mutualFunds.extendedData,
      exitLoadPercent: mutualFunds.exitLoadPercent,
      exitLoadDays: mutualFunds.exitLoadDays,
      minSipAmount: mutualFunds.minSipAmount,
      minLumpsumAmount: mutualFunds.minLumpsumAmount,
      launchDate: mutualFunds.launchDate,
    }).from(mutualFunds).where(
      and(
        sql`${mutualFunds.extendedData} IS NOT NULL`,
        or(
          isNull(mutualFunds.exitLoadPercent),
          isNull(mutualFunds.minSipAmount),
          isNull(mutualFunds.minLumpsumAmount),
          isNull(mutualFunds.launchDate)
        )
      )
    );

    for (let i = 0; i < funds.length; i += batchSize) {
      const batch = funds.slice(i, i + batchSize);
      enrichmentProgress.currentStep = `Phase 2: Extracting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(funds.length / batchSize)}`;

      for (const fund of batch) {
        try {
          const ext = fund.extendedData as any;
          if (!ext) continue;
          const updates: Record<string, any> = {};

          if (fund.exitLoadPercent === null && ext.exitLoad) {
            const parsed = this.parseExitLoadText(ext.exitLoad);
            if (parsed.percent !== null) {
              updates.exitLoadPercent = parsed.percent.toString();
              if (parsed.days !== null) updates.exitLoadDays = parsed.days;
              enrichmentProgress.phase2Stats.exitLoadUpdated++;
            }
          }

          if (fund.minSipAmount === null && ext.minSipAmount) {
            const val = this.parseAmount(ext.minSipAmount);
            if (val) { updates.minSipAmount = val.toString(); enrichmentProgress.phase2Stats.minSipUpdated++; }
          }

          if (fund.minLumpsumAmount === null && ext.minInvestment) {
            const val = this.parseAmount(ext.minInvestment);
            if (val) { updates.minLumpsumAmount = val.toString(); enrichmentProgress.phase2Stats.minLumpsumUpdated++; }
          }

          if (fund.launchDate === null && ext.launchDate) {
            const parsed = this.parseDateString(ext.launchDate);
            if (parsed) { updates.launchDate = parsed; enrichmentProgress.phase2Stats.launchDateUpdated++; }
          }

          if (Object.keys(updates).length > 0) {
            updates.lastUpdated = new Date();
            await getEnrichmentWriteDb().update(mutualFunds).set(updates).where(eq(mutualFunds.id, fund.id));
            for (const [field, value] of Object.entries(updates)) {
              if (field !== 'lastUpdated') {
                await this.logAuditChange(fund.schemeCode, field, null, String(value), 'enrichment', 'extended_data', enrichmentRunId);
              }
            }
          }
        } catch (error: any) {
          enrichmentProgress.errors.push(`P2 ${fund.schemeCode}: ${error.message}`);
        }
      }
    }

    console.log(`[ComprehensiveEnrichment] Phase 2 done: ExitLoad=${enrichmentProgress.phase2Stats.exitLoadUpdated}, MinSIP=${enrichmentProgress.phase2Stats.minSipUpdated}, MinLumpsum=${enrichmentProgress.phase2Stats.minLumpsumUpdated}, LaunchDate=${enrichmentProgress.phase2Stats.launchDateUpdated}`);
  }

  private async phase3_MFAPIMetadata(maxFunds: number, enrichmentRunId: string): Promise<void> {
    enrichmentProgress.status = 'phase3_mfapi_meta';
    enrichmentProgress.currentStep = 'Phase 3: Fetching MFapi.in metadata (sub-category, launch date)...';
    console.log('[ComprehensiveEnrichment] Phase 3: MFapi.in metadata enrichment');

    const funds = await getEnrichmentReadDb(db).select({
      id: mutualFunds.id,
      schemeCode: mutualFunds.schemeCode,
      schemeSubCategory: mutualFunds.schemeSubCategory,
      launchDate: mutualFunds.launchDate,
    }).from(mutualFunds).where(
      or(isNull(mutualFunds.schemeSubCategory), isNull(mutualFunds.launchDate))
    ).limit(maxFunds);

    for (let i = 0; i < funds.length; i++) {
      const fund = funds[i];
      enrichmentProgress.currentStep = `Phase 3: Fetching metadata ${i + 1}/${funds.length} (scheme ${fund.schemeCode})`;

      try {
        const apiData = await this.fetchMFAPIWithRetry(fund.schemeCode);
        if (!apiData) continue;

        enrichmentProgress.phase3Stats.metaFetched++;
        const updates: Record<string, any> = {};

        if (fund.schemeSubCategory === null && apiData.meta?.scheme_category) {
          const mapped = this.mapSchemeCategory(apiData.meta.scheme_category);
          if (mapped) {
            updates.schemeSubCategory = apiData.meta.scheme_category;
            enrichmentProgress.phase3Stats.subCategoryUpdated++;
          }
        }

        if (fund.launchDate === null && apiData.data?.length > 0) {
          const sortedData = [...apiData.data].sort((a, b) => {
            const da = this.parseAmfiDate(a.date);
            const db2 = this.parseAmfiDate(b.date);
            if (!da || !db2) return 0;
            return da.getTime() - db2.getTime();
          });
          const oldestDate = this.parseAmfiDate(sortedData[0]?.date);
          if (oldestDate) {
            updates.launchDate = oldestDate;
            enrichmentProgress.phase3Stats.launchDateFromNav++;
          }
        }

        if (Object.keys(updates).length > 0) {
          updates.lastUpdated = new Date();
          await getEnrichmentWriteDb().update(mutualFunds).set(updates).where(eq(mutualFunds.id, fund.id));
          for (const [field, value] of Object.entries(updates)) {
            if (field !== 'lastUpdated') {
              await this.logAuditChange(fund.schemeCode, field, null, String(value), 'enrichment', 'MFAPI', enrichmentRunId);
            }
          }
        }

        await new Promise(resolve => setTimeout(resolve, this.currentDelay));
      } catch (error: any) {
        enrichmentProgress.errors.push(`P3 ${fund.schemeCode}: ${error.message}`);
      }
    }

    console.log(`[ComprehensiveEnrichment] Phase 3 done: SubCategory=${enrichmentProgress.phase3Stats.subCategoryUpdated}, LaunchDate=${enrichmentProgress.phase3Stats.launchDateFromNav}, MetaFetched=${enrichmentProgress.phase3Stats.metaFetched}`);
  }

  private async phase4_MFAPIReturns(maxFunds: number, enrichmentRunId: string): Promise<void> {
    enrichmentProgress.status = 'phase4_mfapi_returns';
    enrichmentProgress.currentStep = 'Phase 4: Calculating returns & ratios from MFapi.in historical NAV...';
    console.log('[ComprehensiveEnrichment] Phase 4: MFapi.in returns & ratios');

    const funds = await getEnrichmentReadDb(db).select({
      id: mutualFunds.id,
      schemeCode: mutualFunds.schemeCode,
    }).from(mutualFunds).where(
      isNull(mutualFunds.returns1y)
    ).limit(maxFunds);

    for (let i = 0; i < funds.length; i++) {
      const fund = funds[i];
      enrichmentProgress.currentStep = `Phase 4: Syncing returns ${i + 1}/${funds.length} (scheme ${fund.schemeCode})`;

      try {
        const apiData = await this.fetchMFAPIWithRetry(fund.schemeCode);
        if (!apiData || !apiData.data || apiData.data.length === 0) continue;

        const returns = this.calculateReturns(apiData.data);
        const ratios = this.calculateFinancialRatios(apiData.data);

        const updates: Record<string, any> = { lastUpdated: new Date() };

        if (returns.returns1y !== null) updates.returns1y = returns.returns1y.toFixed(4);
        if (returns.returns3y !== null) updates.returns3y = returns.returns3y.toFixed(4);
        if (returns.returns5y !== null) updates.returns5y = returns.returns5y.toFixed(4);

        // Calculated metrics (sharpe, sortino, stddev, maxDrawdown) are written exclusively
        // to mutual_fund_metrics below — not to mutual_funds

        if (Object.keys(updates).length > 1) {
          await getEnrichmentWriteDb().update(mutualFunds).set(updates).where(eq(mutualFunds.id, fund.id));
          enrichmentProgress.phase4Stats.fundsSynced++;
          if (returns.returns1y !== null) enrichmentProgress.phase4Stats.returnsUpdated++;
          if (ratios.sharpeRatio !== null) enrichmentProgress.phase4Stats.ratiosUpdated++;

          const now = new Date();
          const month = now.getMonth() + 1;
          const year = now.getFullYear();
          const startYear = month >= 4 ? year : year - 1;
          const fiscalYear = `FY${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;

          try {
            await getEnrichmentWriteDb().execute(sql`
              INSERT INTO mutual_fund_metrics (scheme_code, fund_id, fiscal_year,
                return_1y, return_3y, return_5y,
                standard_deviation, sharpe_ratio, sortino_ratio, max_drawdown,
                data_source, last_updated)
              VALUES (
                ${fund.schemeCode}, ${fund.id}, ${fiscalYear},
                ${returns.returns1y?.toFixed(4) || null},
                ${returns.returns3y?.toFixed(4) || null},
                ${returns.returns5y?.toFixed(4) || null},
                ${ratios.standardDeviation?.toString() || null},
                ${ratios.sharpeRatio?.toString() || null},
                ${ratios.sortinoRatio?.toString() || null},
                ${ratios.maxDrawdown?.toString() || null},
                'MFAPI_ENRICHMENT', NOW()
              )
              ON CONFLICT (scheme_code, fiscal_year)
              DO UPDATE SET
                return_1y = COALESCE(EXCLUDED.return_1y, mutual_fund_metrics.return_1y),
                return_3y = COALESCE(EXCLUDED.return_3y, mutual_fund_metrics.return_3y),
                return_5y = COALESCE(EXCLUDED.return_5y, mutual_fund_metrics.return_5y),
                standard_deviation = COALESCE(EXCLUDED.standard_deviation, mutual_fund_metrics.standard_deviation),
                sharpe_ratio = COALESCE(EXCLUDED.sharpe_ratio, mutual_fund_metrics.sharpe_ratio),
                sortino_ratio = COALESCE(EXCLUDED.sortino_ratio, mutual_fund_metrics.sortino_ratio),
                max_drawdown = COALESCE(EXCLUDED.max_drawdown, mutual_fund_metrics.max_drawdown),
                fund_id = COALESCE(EXCLUDED.fund_id, mutual_fund_metrics.fund_id),
                last_updated = NOW()
            `);
          } catch (metricsErr) {
            console.error(`[ComprehensiveEnrichment] P4 metrics upsert failed for ${fund.schemeCode}:`, metricsErr);
          }

          for (const [field, value] of Object.entries(updates)) {
            if (field !== 'lastUpdated') {
              await this.logAuditChange(fund.schemeCode, field, null, String(value), 'enrichment', 'MFAPI_RETURNS', enrichmentRunId);
            }
          }
        }

        if (i % 20 === 0) {
          console.log(`[ComprehensiveEnrichment] Phase 4 progress: ${i + 1}/${funds.length} (returns=${enrichmentProgress.phase4Stats.returnsUpdated}, ratios=${enrichmentProgress.phase4Stats.ratiosUpdated})`);
        }

        await new Promise(resolve => setTimeout(resolve, this.currentDelay));
      } catch (error: any) {
        enrichmentProgress.errors.push(`P4 ${fund.schemeCode}: ${error.message}`);
      }
    }

    console.log(`[ComprehensiveEnrichment] Phase 4 done: Returns=${enrichmentProgress.phase4Stats.returnsUpdated}, Ratios=${enrichmentProgress.phase4Stats.ratiosUpdated}, Synced=${enrichmentProgress.phase4Stats.fundsSynced}`);
  }

  private async phase5_CategoryDefaults(batchSize: number, enrichmentRunId: string): Promise<void> {
    enrichmentProgress.status = 'phase5_defaults';
    enrichmentProgress.currentStep = 'Phase 5: Applying category-based defaults for remaining nulls...';
    console.log('[ComprehensiveEnrichment] Phase 5: Category-based defaults');

    const funds = await getEnrichmentReadDb(db).select({
      id: mutualFunds.id,
      schemeCode: mutualFunds.schemeCode,
      schemeName: mutualFunds.schemeName,
      category: mutualFunds.category,
      planType: mutualFunds.planType,
      exitLoadPercent: mutualFunds.exitLoadPercent,
      exitLoadDays: mutualFunds.exitLoadDays,
      minSipAmount: mutualFunds.minSipAmount,
      minLumpsumAmount: mutualFunds.minLumpsumAmount,
      schemeSubCategory: mutualFunds.schemeSubCategory,
    }).from(mutualFunds).where(
      or(
        isNull(mutualFunds.exitLoadPercent),
        isNull(mutualFunds.minSipAmount),
        isNull(mutualFunds.minLumpsumAmount),
        isNull(mutualFunds.schemeSubCategory)
      )
    );

    for (let i = 0; i < funds.length; i += batchSize) {
      const batch = funds.slice(i, i + batchSize);
      enrichmentProgress.currentStep = `Phase 5: Applying defaults batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(funds.length / batchSize)}`;

      for (const fund of batch) {
        try {
          const updates: Record<string, any> = {};
          const cat = fund.category || this.inferCategoryFromName(fund.schemeName || '');

          if (fund.exitLoadPercent === null) {
            const exitLoadDefault = cat ? CATEGORY_EXIT_LOAD_DEFAULTS[cat] : null;
            if (exitLoadDefault) {
              updates.exitLoadPercent = exitLoadDefault.percent.toString();
              updates.exitLoadDays = exitLoadDefault.days;
            } else {
              updates.exitLoadPercent = '1';
              updates.exitLoadDays = 365;
            }
            enrichmentProgress.phase5Stats.exitLoadDefaults++;
            await this.logAuditChange(fund.schemeCode, 'exitLoadPercent', null, updates.exitLoadPercent, 'category_default', `category:${cat || 'unknown'}`, enrichmentRunId);
          }

          if (fund.minSipAmount === null) {
            const amounts = cat ? CATEGORY_MIN_AMOUNTS[cat] : null;
            updates.minSipAmount = (amounts?.sip || DEFAULT_MIN_SIP).toString();
            enrichmentProgress.phase5Stats.minSipDefaults++;
            await this.logAuditChange(fund.schemeCode, 'minSipAmount', null, updates.minSipAmount, 'category_default', `category:${cat || 'unknown'}`, enrichmentRunId);
          }

          if (fund.minLumpsumAmount === null) {
            const amounts = cat ? CATEGORY_MIN_AMOUNTS[cat] : null;
            updates.minLumpsumAmount = (amounts?.lumpsum || DEFAULT_MIN_LUMPSUM).toString();
            enrichmentProgress.phase5Stats.minLumpsumDefaults++;
            await this.logAuditChange(fund.schemeCode, 'minLumpsumAmount', null, updates.minLumpsumAmount, 'category_default', `category:${cat || 'unknown'}`, enrichmentRunId);
          }

          if (fund.schemeSubCategory === null && cat) {
            updates.schemeSubCategory = cat;
            enrichmentProgress.phase5Stats.subCategoryDefaults++;
          }

          if (Object.keys(updates).length > 0) {
            updates.lastUpdated = new Date();
            await getEnrichmentWriteDb().update(mutualFunds).set(updates).where(eq(mutualFunds.id, fund.id));
          }
        } catch (error: any) {
          enrichmentProgress.errors.push(`P5 ${fund.schemeCode}: ${error.message}`);
        }
      }
    }

    console.log(`[ComprehensiveEnrichment] Phase 5 done: ExitLoad=${enrichmentProgress.phase5Stats.exitLoadDefaults}, MinSIP=${enrichmentProgress.phase5Stats.minSipDefaults}, MinLumpsum=${enrichmentProgress.phase5Stats.minLumpsumDefaults}, SubCategory=${enrichmentProgress.phase5Stats.subCategoryDefaults}`);
  }

  private inferCategoryFromName(name: string): string | null {
    const lower = name.toLowerCase();
    if (lower.includes('liquid') || lower.includes('overnight') || lower.includes('money market')) return 'Liquid';
    if (lower.includes('index') && !lower.includes('debt')) return 'Index Funds';
    if (lower.includes('etf')) return 'ETF';
    if (lower.includes('elss') || lower.includes('tax sav')) return 'ELSS';
    if (lower.includes('small cap') || lower.includes('smallcap')) return 'Small Cap';
    if (lower.includes('mid cap') || lower.includes('midcap')) return 'Mid Cap';
    if (lower.includes('large & mid') || lower.includes('large and mid')) return 'Large & Mid Cap';
    if (lower.includes('large cap') || lower.includes('largecap')) return 'Large Cap';
    if (lower.includes('flexi cap') || lower.includes('flexicap')) return 'Flexi Cap';
    if (lower.includes('multi cap') || lower.includes('multicap')) return 'Multi Cap';
    if (lower.includes('focused')) return 'Focused';
    if (lower.includes('value') || lower.includes('contra')) return 'Value/Contra';
    if (lower.includes('arbitrage')) return 'Arbitrage';
    if (lower.includes('balanced advantage') || lower.includes('dynamic asset')) return 'Balanced Advantage';
    if (lower.includes('gilt')) return 'Gilt';
    if (lower.includes('corporate bond')) return 'Corporate Bond';
    if (lower.includes('banking') && lower.includes('psu')) return 'Banking & PSU';
    if (lower.includes('credit risk')) return 'Credit Risk';
    if (lower.includes('dynamic bond')) return 'Dynamic Bond';
    if (lower.includes('floater') || lower.includes('floating')) return 'Floater';
    if (lower.includes('ultra short')) return 'Ultra Short Duration';
    if (lower.includes('short duration') || lower.includes('short term')) return 'Short Duration';
    if (lower.includes('long duration') || lower.includes('long term')) return 'Long Duration';
    if (lower.includes('medium duration') || lower.includes('medium term')) return 'Medium Duration';
    if (lower.includes('equity') || lower.includes('growth')) return 'Equity';
    if (lower.includes('debt') || lower.includes('bond') || lower.includes('income')) return 'Debt';
    if (lower.includes('hybrid') || lower.includes('balanced')) return 'Hybrid';
    return null;
  }

  private parseExitLoadText(text: string | null | undefined): { percent: number | null; days: number | null } {
    if (!text) return { percent: null, days: null };
    const normalized = text.toLowerCase().trim();
    if (normalized === 'nil' || normalized === 'none' || normalized === '0' || normalized === '0%' ||
        normalized.includes('no exit load') || normalized.includes('nil exit')) {
      return { percent: 0, days: 0 };
    }
    const withinPattern = /(\d+\.?\d*)\s*%\s*(?:if\s+(?:redeemed|exit|withdrawn)\s+)?(?:within|before|up\s*to|for|upto)\s+(\d+)\s*(year|month|day|week)s?/i;
    const match = normalized.match(withinPattern);
    if (match) {
      const percent = parseFloat(match[1]);
      const timeValue = parseInt(match[2]);
      const unit = match[3].toLowerCase();
      const days = unit === 'year' ? timeValue * 365 : unit === 'month' ? timeValue * 30 : unit === 'week' ? timeValue * 7 : timeValue;
      return { percent, days };
    }
    const simpleDays = normalized.match(/(\d+\.?\d*)\s*%.*?(\d+)\s*days?/i);
    if (simpleDays) return { percent: parseFloat(simpleDays[1]), days: parseInt(simpleDays[2]) };
    const percentOnly = normalized.match(/(\d+\.?\d*)\s*%/);
    if (percentOnly) {
      const percent = parseFloat(percentOnly[1]);
      let days = 365;
      if (/1\s*year|12\s*month|365\s*day/i.test(normalized)) days = 365;
      else if (/6\s*month|180\s*day/i.test(normalized)) days = 180;
      else if (/3\s*month|90\s*day/i.test(normalized)) days = 90;
      else if (/1\s*month|30\s*day/i.test(normalized)) days = 30;
      return { percent, days };
    }
    return { percent: null, days: null };
  }

  private parseAmount(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value > 0 ? value : null;
    const cleaned = value.toString().replace(/[₹$Rs.INR,\s\/-]/gi, '').replace(/[^\d.]/g, '').trim();
    const parsed = parseFloat(cleaned);
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
  }

  private parseDateString(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    const trimmed = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const d = new Date(trimmed); if (!isNaN(d.getTime())) return d;
    }
    const dash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dash) {
      const d = new Date(`${dash[3]}-${dash[2].padStart(2, '0')}-${dash[1].padStart(2, '0')}`);
      if (!isNaN(d.getTime())) return d;
    }
    const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
      const d = new Date(`${slash[3]}-${slash[2].padStart(2, '0')}-${slash[1].padStart(2, '0')}`);
      if (!isNaN(d.getTime())) return d;
    }
    try { const d = new Date(trimmed); if (!isNaN(d.getTime()) && d.getFullYear() > 1990) return d; } catch {}
    return null;
  }

  private async phase6_FintekProRatings(enrichmentRunId: string): Promise<void> {
    enrichmentProgress.status = 'phase6_ratings';
    enrichmentProgress.currentStep = 'Phase 6: Computing FintekPro Smart Ratings for unrated funds...';
    console.log('[ComprehensiveEnrichment] Phase 6: FintekPro Smart Rating computation');

    try {
      const { default: fintekProRatingService } = await import('./fintekpro-rating-service');
      const result = await fintekProRatingService.batchComputeAndPersist({
        onlyNullRatings: true,
        batchSize: 200,
        onProgress: (processed, total, schemeCode) => {
          enrichmentProgress.processedFunds = processed;
          enrichmentProgress.phase6Stats.ratingsComputed = processed;
          if (processed % 500 === 0) {
            console.log(`[Phase6] Rated ${processed}/${total} funds (latest: ${schemeCode})`);
          }
        },
      });

      enrichmentProgress.phase6Stats = {
        ratingsComputed: result.processed,
        ratingsPersisted: result.persisted,
        ratingsFailed: result.failed,
      };

      await this.logAuditChange(
        'BATCH_RATING',
        'fintekpro_smart_rating',
        null,
        JSON.stringify({ persisted: result.persisted, failed: result.failed }),
        'batch_rating_run',
        'FINTEKPRO_RATING_ENGINE',
        enrichmentRunId,
        {
          version: '2.0',
          methodology: 'FintekPro Smart Rating v2.0',
          scoringWeights: {
            riskAdjusted: 0.35,
            quality: 0.25,
            liquidity: 0.15,
            momentum: 0.15,
            valuation: 0.10,
          },
          dataInputs: ['returns_1y', 'returns_3y', 'returns_5y', 'expense_ratio', 'aum', 'fund_house', 'category'],
          totalProcessed: result.processed,
          totalPersisted: result.persisted,
          totalFailed: result.failed,
          errors: result.errors.slice(0, 10),
        }
      );

      console.log(`[Phase6] Complete: ${result.persisted} ratings persisted, ${result.failed} failed`);
    } catch (error: any) {
      enrichmentProgress.errors.push(`Phase 6 rating error: ${error.message}`);
      console.error('[Phase6] Error:', error.message);
    }
  }

  async getNullColumnStats(): Promise<Record<string, { nullCount: number; filledCount: number; total: number }>> {
    const [stats] = await getEnrichmentReadDb(db).select({
      total: sql<number>`COUNT(*)`,
      navNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.nav} IS NULL)`,
      categoryNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.category} IS NULL)`,
      aumNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.aum} IS NULL)`,
      returns1yNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.returns1y} IS NULL)`,
      returns3yNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.returns3y} IS NULL)`,
      returns5yNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.returns5y} IS NULL)`,
      exitLoadNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.exitLoadPercent} IS NULL)`,
      exitLoadDaysNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.exitLoadDays} IS NULL)`,
      minSipNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.minSipAmount} IS NULL)`,
      minLumpsumNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.minLumpsumAmount} IS NULL)`,
      launchDateNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.launchDate} IS NULL)`,
      subCategoryNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.schemeSubCategory} IS NULL)`,
      metricsRowsCount: sql<number>`(SELECT COUNT(DISTINCT scheme_code) FROM mutual_fund_metrics)`,
      benchmarkNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.benchmarkIndex} IS NULL)`,
      isinNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.isin} IS NULL)`,
      smartRatingNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.crisilRating} IS NULL)`,
      smartRatingOverallNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.crisilOverallScore} IS NULL)`,
      smartRatingPercentileNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.crisilPercentile} IS NULL)`,
    }).from(mutualFunds);

    const total = Number(stats?.total || 0);
    const columns = {
      nav: Number(stats?.navNull || 0),
      category: Number(stats?.categoryNull || 0),
      aum: Number(stats?.aumNull || 0),
      returns_1y: Number(stats?.returns1yNull || 0),
      returns_3y: Number(stats?.returns3yNull || 0),
      returns_5y: Number(stats?.returns5yNull || 0),
      exit_load_percent: Number(stats?.exitLoadNull || 0),
      exit_load_days: Number(stats?.exitLoadDaysNull || 0),
      min_sip_amount: Number(stats?.minSipNull || 0),
      min_lumpsum_amount: Number(stats?.minLumpsumNull || 0),
      launch_date: Number(stats?.launchDateNull || 0),
      scheme_sub_category: Number(stats?.subCategoryNull || 0),
      benchmark_index: Number(stats?.benchmarkNull || 0),
      isin: Number(stats?.isinNull || 0),
      fintekpro_smart_rating: Number(stats?.smartRatingNull || 0),
      fintekpro_overall_score: Number(stats?.smartRatingOverallNull || 0),
      fintekpro_percentile: Number(stats?.smartRatingPercentileNull || 0),
    };

    const result: Record<string, { nullCount: number; filledCount: number; total: number }> = {};
    for (const [col, nullCount] of Object.entries(columns)) {
      result[col] = { nullCount, filledCount: total - nullCount, total };
    }
    const metricsWithData = Number(stats?.metricsRowsCount || 0);
    result['risk_metrics_in_metrics_table'] = {
      nullCount: total - metricsWithData,
      filledCount: metricsWithData,
      total,
    };
    return result;
  }
}

export const mfComprehensiveEnrichmentService = MFComprehensiveEnrichmentService.getInstance();
export default mfComprehensiveEnrichmentService;
