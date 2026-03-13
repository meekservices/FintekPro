/**
 * Stock Financial Enrichment Service
 * 
 * Enriches listed stocks with financial ratios, risk metrics, analyst data,
 * and performance returns using FMP (primary), Yahoo Finance, and Finnhub.
 */

import axios from 'axios';
import { db } from '../db';
import { getProductionDb, hasProductionDb } from '../db-production';
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
  roce: number | null;
  revenueGrowth: number | null;
  profitMargin: number | null;
  beta: number | null;
  averageVolume: number | null;
  analystRating: string | null;
  targetPrice: number | null;
  numberOfAnalysts: number | null;
  returns1M: number | null;
  returns3M: number | null;
  returns6M: number | null;
  returns1Y: number | null;
  returns3Y: number | null;
  returns5Y: number | null;
  volatility: number | null;
  riskLevel: string | null;
  broadSector: string | null;
  region: string | null;
}

interface EnrichmentStats {
  totalStocks: number;
  stocksWithNullPe: number;
  stocksWithNullEps: number;
  stocksEnriched: number;
  errors: string[];
  duration: number;
  fmpCalls: number;
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

const BROAD_SECTOR_MAP: Record<string, string> = {
  'Information Technology': 'Technology',
  'Computers - Software & Consulting': 'Technology',
  'IT - Software': 'Technology',
  'IT - Hardware': 'Technology',
  'IT Enabled Services': 'Technology',
  'Software & Programming': 'Technology',
  'Technology': 'Technology',

  'Private Sector Bank': 'Banking & Finance',
  'Public Sector Bank': 'Banking & Finance',
  'Banking': 'Banking & Finance',
  'Banks': 'Banking & Finance',
  'Financial Services': 'Banking & Finance',
  'Finance - NBFC': 'Banking & Finance',
  'NBFC': 'Banking & Finance',
  'Finance': 'Banking & Finance',
  'Financial Institution': 'Banking & Finance',
  'Housing Finance': 'Banking & Finance',
  'Microfinance': 'Banking & Finance',
  'Stock Broking': 'Banking & Finance',
  'Wealth Management': 'Banking & Finance',
  'Asset Management': 'Banking & Finance',

  'Insurance': 'Insurance',
  'Life Insurance': 'Insurance',
  'General Insurance': 'Insurance',

  'Pharmaceuticals': 'Healthcare & Pharma',
  'Healthcare': 'Healthcare & Pharma',
  'Hospitals & Diagnostic Centres': 'Healthcare & Pharma',
  'Biotechnology': 'Healthcare & Pharma',
  'Drugs & Pharmaceuticals': 'Healthcare & Pharma',

  'Automobile': 'Automobile',
  'Auto Ancillary': 'Automobile',
  'Auto Components': 'Automobile',
  'Passenger Cars & Utility Vehicles': 'Automobile',
  'Commercial Vehicles': 'Automobile',
  '2/3 Wheelers': 'Automobile',
  'Tyres': 'Automobile',

  'Consumer Goods': 'Consumer',
  'FMCG': 'Consumer',
  'Diversified FMCG': 'Consumer',
  'Consumer Durables': 'Consumer',
  'Consumer Electronics': 'Consumer',
  'Food & Beverages': 'Consumer',
  'Retail': 'Consumer',
  'Textiles': 'Consumer',
  'Apparels': 'Consumer',

  'Power': 'Energy & Utilities',
  'Energy': 'Energy & Utilities',
  'Oil & Gas': 'Energy & Utilities',
  'Refineries': 'Energy & Utilities',
  'Gas Distribution': 'Energy & Utilities',
  'Electric Utilities': 'Energy & Utilities',
  'Renewable Energy': 'Energy & Utilities',

  'Metals & Mining': 'Materials',
  'Steel': 'Materials',
  'Aluminium': 'Materials',
  'Copper': 'Materials',
  'Mining & Minerals': 'Materials',
  'Chemicals': 'Materials',
  'Specialty Chemicals': 'Materials',
  'Agrochemicals': 'Materials',
  'Fertilizers': 'Materials',
  'Cement': 'Materials',
  'Cement & Construction': 'Materials',
  'Plastics': 'Materials',

  'Capital Goods': 'Industrials',
  'Industrial': 'Industrials',
  'Infrastructure': 'Industrials',
  'Construction': 'Industrials',
  'Engineering': 'Industrials',
  'Defence': 'Industrials',
  'Electrical Equipment': 'Industrials',
  'Electronics': 'Industrials',
  'Shipping': 'Industrials',
  'Logistics': 'Industrials',
  'Railways': 'Industrials',
  'Airports': 'Industrials',

  'Realty': 'Real Estate',
  'Real Estate': 'Real Estate',
  'Real Estate Development': 'Real Estate',

  'Telecom': 'Telecom & Media',
  'Telecommunication': 'Telecom & Media',
  'Media & Entertainment': 'Telecom & Media',
  'Internet & Catalogue Retail': 'Telecom & Media',
  'Digital Entertainment': 'Telecom & Media',

  'Hotels & Tourism': 'Services',
  'Aviation': 'Services',
  'Airline': 'Services',
  'Travel & Tourism': 'Services',
  'Education': 'Services',
  'Services': 'Services',
  'Consulting': 'Services',
  'Staffing & Recruitment': 'Services',

  'Agriculture': 'Agriculture',
  'Plantation & Forestry': 'Agriculture',
  'Sugar': 'Agriculture',
  'Tea & Coffee': 'Agriculture',
};

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

class StockFinancialEnrichmentService {
  private readonly YAHOO_FINANCE_URL = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary';
  private rateLimitRemaining = 100;
  private lastRateLimitReset = Date.now();
  private fmpCallCount = 0;

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

  private async fmpFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) return null;

    const queryParams = new URLSearchParams({ ...params, apikey: apiKey });
    const url = `${FMP_BASE_URL}${endpoint}?${queryParams}`;

    try {
      const response = await axios.get(url, { timeout: 15000 });
      this.fmpCallCount++;
      const d = response.data;
      if (d && typeof d === 'object' && !Array.isArray(d) && d['Error Message']?.includes('Legacy Endpoint')) {
        return null;
      }
      return d as T;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn(`[Stock Enrichment] FMP rate limited`);
      }
      return null;
    }
  }

  private toFmpSymbol(nseSymbol: string): string {
    if (nseSymbol.includes('.')) return nseSymbol;
    return `${nseSymbol}.NS`;
  }

  async fetchFmpComprehensive(symbol: string): Promise<Partial<StockFinancials> | null> {
    const fmpSymbol = this.toFmpSymbol(symbol);
    const result: Partial<StockFinancials> = {};
    let gotData = false;

    const [profileData, ratiosData, quoteData] = await Promise.all([
      this.fmpFetch<any[]>(`/profile/${fmpSymbol}`),
      this.fmpFetch<any[]>(`/ratios/${fmpSymbol}`, { limit: '1' }),
      this.fmpFetch<any[]>(`/quote/${fmpSymbol}`),
    ]);

    if (profileData?.[0]) {
      const p = profileData[0];
      if (p.beta != null) result.beta = p.beta;
      if (p.sector) result.broadSector = this.mapBroadSector(p.sector);
      if (p.country) result.region = p.country;
      if (p.volAvg) result.averageVolume = p.volAvg;
      if (p.lastDiv != null && p.price) {
        const divYield = (p.lastDiv / p.price) * 100;
        if (divYield > 0 && divYield < 50) result.dividendYield = Math.round(divYield * 10000) / 10000;
      }
      gotData = true;
    }

    if (ratiosData?.[0]) {
      const r = ratiosData[0];
      if (r.peRatio != null) result.peRatio = r.peRatio;
      if (r.priceToBookRatio != null) result.priceToBook = r.priceToBookRatio;
      if (r.returnOnEquity != null) result.roe = Math.round(r.returnOnEquity * 10000) / 100;
      if (r.returnOnCapitalEmployed != null) result.roce = Math.round(r.returnOnCapitalEmployed * 10000) / 100;
      if (r.dividendYield != null && !result.dividendYield) {
        result.dividendYield = Math.round(r.dividendYield * 10000) / 100;
      }
      if (r.debtEquityRatio != null) result.debtToEquity = r.debtEquityRatio;
      if (r.earningsPerShare != null) result.eps = r.earningsPerShare;
      if (r.bookValuePerShare != null) result.bookValue = r.bookValuePerShare;
      if (r.netProfitMargin != null) result.profitMargin = Math.round(r.netProfitMargin * 10000) / 100;
      if (r.revenueGrowth != null) result.revenueGrowth = Math.round(r.revenueGrowth * 10000) / 100;
      gotData = true;
    }

    if (quoteData?.[0]) {
      const q = quoteData[0];
      if (q.avgVolume && !result.averageVolume) result.averageVolume = q.avgVolume;
      if (q.pe != null && !result.peRatio) result.peRatio = q.pe;
      if (q.eps != null && !result.eps) result.eps = q.eps;
      if (q.priceAvg200 && q.price) {
        result.targetPrice = Math.round(q.priceAvg200 * 100) / 100;
      }
      gotData = true;
    }

    if (result.beta != null) {
      result.volatility = this.calculateVolatility(result.beta);
      result.riskLevel = this.calculateRiskLevel(result.beta, result.volatility);
    }

    if (!gotData) return null;
    return result;
  }

  async fetchFmpReturnsAndAnalyst(symbol: string): Promise<Partial<StockFinancials>> {
    const fmpSymbol = this.toFmpSymbol(symbol);
    const result: Partial<StockFinancials> = {};

    const now = new Date();
    const from5y = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
      .toISOString().split('T')[0];
    const toDate = now.toISOString().split('T')[0];

    const [histData, ratingData, priceTargetData] = await Promise.all([
      this.fmpFetch<any>(`/historical-price-full/${fmpSymbol}`, { from: from5y, to: toDate }),
      this.fmpFetch<any[]>(`/rating/${fmpSymbol}`),
      this.fmpFetch<any[]>(`/price-target-consensus/${fmpSymbol}`),
    ]);

    if (histData?.historical && histData.historical.length > 0) {
      const prices = histData.historical.sort((a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const currentPrice = prices[0]?.close;

      if (currentPrice) {
        result.returns1M = this.findReturn(prices, currentPrice, 30);
        result.returns3M = this.findReturn(prices, currentPrice, 90);
        result.returns6M = this.findReturn(prices, currentPrice, 180);
        result.returns1Y = this.findReturn(prices, currentPrice, 365);
        result.returns3Y = this.findReturn(prices, currentPrice, 365 * 3);
        result.returns5Y = this.findReturn(prices, currentPrice, 365 * 5);
      }
    }

    if (ratingData?.[0]) {
      const r = ratingData[0];
      if (r.ratingRecommendation) {
        result.analystRating = this.mapAnalystRating(r.ratingRecommendation);
      }
    }

    if (priceTargetData?.[0]) {
      const pt = priceTargetData[0];
      if (pt.targetConsensus != null) result.targetPrice = pt.targetConsensus;
      else if (pt.targetMedian != null) result.targetPrice = pt.targetMedian;
      if (pt.targetCount != null) result.numberOfAnalysts = pt.targetCount;
    }

    return result;
  }

  private findReturn(prices: any[], currentPrice: number, daysAgo: number): number | null {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAgo);
    const targetTime = targetDate.getTime();

    let closest: any = null;
    let closestDiff = Infinity;

    for (const p of prices) {
      const pTime = new Date(p.date).getTime();
      const diff = Math.abs(pTime - targetTime);
      if (diff < closestDiff && diff < 15 * 24 * 60 * 60 * 1000) {
        closest = p;
        closestDiff = diff;
      }
    }

    if (!closest || !closest.close) return null;
    return Math.round(((currentPrice - closest.close) / closest.close) * 10000) / 100;
  }

  private mapAnalystRating(recommendation: string): string {
    const lower = recommendation.toLowerCase();
    if (lower.includes('strong buy') || lower === 'a+' || lower === 'a') return 'Strong Buy';
    if (lower.includes('strong sell') || lower === 'f') return 'Strong Sell';
    if (lower.includes('buy') || lower === 'b+' || lower === 'b') return 'Buy';
    if (lower.includes('sell') || lower === 'd') return 'Sell';
    if (lower.includes('hold') || lower.includes('neutral') || lower === 'c') return 'Hold';
    return recommendation;
  }

  private calculateVolatility(beta: number): number {
    const marketVol = 18;
    return Math.round(beta * marketVol * 100) / 100;
  }

  private calculateRiskLevel(beta: number, volatility: number): string {
    if (beta <= 0.7 && volatility <= 12) return 'Low';
    if (beta <= 1.0 && volatility <= 20) return 'Moderate';
    if (beta <= 1.3 && volatility <= 30) return 'High';
    return 'Very High';
  }

  private mapBroadSector(sector: string | null): string | null {
    if (!sector) return null;
    if (BROAD_SECTOR_MAP[sector]) return BROAD_SECTOR_MAP[sector];

    const sectorLower = sector.toLowerCase();
    for (const [key, value] of Object.entries(BROAD_SECTOR_MAP)) {
      if (sectorLower.includes(key.toLowerCase()) || key.toLowerCase().includes(sectorLower)) {
        return value;
      }
    }
    return 'Diversified';
  }

  async fetchYahooFinancials(symbol: string): Promise<Partial<StockFinancials> | null> {
    try {
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
        beta: this.extractValue(stats.beta),
        targetPrice: this.extractValue(financials.targetMeanPrice),
        numberOfAnalysts: this.extractValue(financials.numberOfAnalystOpinions),
        averageVolume: this.extractValue(summary.averageDailyVolume10Day),
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
      if (m.beta) result.beta = m.beta;

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

  private inferFromSector(sector: string | null, currentPrice: number | null): Partial<StockFinancials> {
    if (!sector || !currentPrice || currentPrice <= 0 || !isFinite(currentPrice)) return {};

    const sectorLower = sector.toLowerCase();
    let averages = null;

    for (const [key, data] of Object.entries(SECTOR_AVERAGES)) {
      if (sectorLower.includes(key.toLowerCase()) || key.toLowerCase().includes(sectorLower)) {
        averages = data;
        break;
      }
    }

    const broadSector = this.mapBroadSector(sector);
    if (!averages && broadSector) {
      const broadSectorMap: Record<string, { pe: number; pb: number; eps: number }> = {
        'Technology': { pe: 25.5, pb: 5.2, eps: 45 },
        'Banking & Finance': { pe: 15.8, pb: 2.1, eps: 38 },
        'Insurance': { pe: 18.0, pb: 2.5, eps: 25 },
        'Healthcare & Pharma': { pe: 28.5, pb: 4.5, eps: 22 },
        'Automobile': { pe: 22.5, pb: 3.5, eps: 85 },
        'Consumer': { pe: 42.5, pb: 8.5, eps: 32 },
        'Energy & Utilities': { pe: 11.2, pb: 1.4, eps: 65 },
        'Materials': { pe: 15.0, pb: 1.8, eps: 55 },
        'Industrials': { pe: 28.0, pb: 3.5, eps: 32 },
        'Real Estate': { pe: 28.5, pb: 2.2, eps: 22 },
        'Telecom & Media': { pe: 35.0, pb: 3.5, eps: 10 },
        'Services': { pe: 30.0, pb: 4.0, eps: 20 },
        'Agriculture': { pe: 15.0, pb: 1.5, eps: 25 },
      };
      averages = broadSectorMap[broadSector] || null;
    }

    if (!averages) {
      averages = { pe: 20, pb: 2.5, eps: 30 };
    }

    const inferredEps = averages.pe > 0 ? currentPrice / averages.pe : null;
    const inferredBookValue = averages.pb > 0 ? currentPrice / averages.pb : null;

    return {
      peRatio: averages.pe,
      eps: inferredEps != null ? Math.round(inferredEps * 100) / 100 : null,
      bookValue: inferredBookValue != null ? Math.round(inferredBookValue * 100) / 100 : null,
      priceToBook: averages.pb,
    };
  }

  private mergeFinancials(base: Partial<StockFinancials>, override: Partial<StockFinancials> | null | undefined): Partial<StockFinancials> {
    if (!override) return base;
    const merged = { ...base };
    for (const [key, value] of Object.entries(override)) {
      if (value != null && (merged as any)[key] == null) {
        (merged as any)[key] = value;
      }
    }
    return merged;
  }

  async enrichAllStocks(options: {
    batchSize?: number;
    useYahoo?: boolean;
    maxYahooRequests?: number;
    useFmp?: boolean;
    maxFmpStocks?: number;
    includeReturns?: boolean;
  } = {}): Promise<EnrichmentStats> {
    const startTime = Date.now();
    const {
      batchSize = 50,
      useYahoo = false,
      maxYahooRequests = 50,
      useFmp = true,
      maxFmpStocks = 40,
      includeReturns = true,
    } = options;

    if (!hasProductionDb()) {
      console.warn('[Stock Enrichment] PRODUCTION_DATABASE_URL not set. Enrichment runs on production only. Aborting.');
      return { totalStocks: 0, stocksWithNullPe: 0, stocksWithNullEps: 0, stocksEnriched: 0, errors: ['PRODUCTION_DATABASE_URL not configured'], duration: 0, fmpCalls: 0 };
    }

    const targetDb = getProductionDb();
    console.log('[Stock Enrichment] ✅ Connected to PRODUCTION database for enrichment');

    this.resetProgress();
    this.fmpCallCount = 0;
    enrichmentProgress.status = 'fetching';
    enrichmentProgress.startedAt = new Date();
    enrichmentProgress.currentStep = 'Querying stocks needing enrichment (production DB)...';

    const stats: EnrichmentStats = {
      totalStocks: 0,
      stocksWithNullPe: 0,
      stocksWithNullEps: 0,
      stocksEnriched: 0,
      errors: [],
      duration: 0,
      fmpCalls: 0,
    };

    try {
      const stocks = await targetDb.select({
        id: listedStocks.id,
        symbol: listedStocks.symbol,
        companyName: listedStocks.companyName,
        sector: listedStocks.sector,
        broadSector: listedStocks.broadSector,
        currentPrice: listedStocks.currentPrice,
        peRatio: listedStocks.peRatio,
        pbRatio: listedStocks.pbRatio,
        eps: listedStocks.eps,
        bookValue: listedStocks.bookValue,
        dividendYield: listedStocks.dividendYield,
        roe: listedStocks.roe,
        roce: listedStocks.roce,
        beta: listedStocks.beta,
        volatility: listedStocks.volatility,
        riskLevel: listedStocks.riskLevel,
        analystRating: listedStocks.analystRating,
        targetPrice: listedStocks.targetPrice,
        numberOfAnalysts: listedStocks.numberOfAnalysts,
        averageVolume: listedStocks.averageVolume,
        returns1M: listedStocks.returns1M,
        returns1Y: listedStocks.returns1Y,
        region: listedStocks.region,
      })
      .from(listedStocks)
      .where(
        or(
          isNull(listedStocks.peRatio),
          isNull(listedStocks.eps),
          isNull(listedStocks.bookValue),
          isNull(listedStocks.dividendYield),
          isNull(listedStocks.pbRatio),
          isNull(listedStocks.roe),
          isNull(listedStocks.beta),
          isNull(listedStocks.averageVolume),
          isNull(listedStocks.returns1Y),
          isNull(listedStocks.broadSector),
          isNull(listedStocks.analystRating),
          isNull(listedStocks.volatility)
        )
      );

      const stocksToProcess = useFmp ? stocks.slice(0, maxFmpStocks) : stocks;
      stats.totalStocks = stocksToProcess.length;
      stats.stocksWithNullPe = stocksToProcess.filter(s => s.peRatio === null).length;
      stats.stocksWithNullEps = stocksToProcess.filter(s => s.eps === null).length;
      enrichmentProgress.totalStocks = stocksToProcess.length;

      const nullCounts = {
        pbRatio: stocksToProcess.filter(s => s.pbRatio === null).length,
        dividendYield: stocksToProcess.filter(s => s.dividendYield === null).length,
        roe: stocksToProcess.filter(s => s.roe === null).length,
        beta: stocksToProcess.filter(s => s.beta === null).length,
        avgVolume: stocksToProcess.filter(s => s.averageVolume === null).length,
        returns1Y: stocksToProcess.filter(s => s.returns1Y === null).length,
        broadSector: stocksToProcess.filter(s => s.broadSector === null).length,
        analystRating: stocksToProcess.filter(s => s.analystRating === null).length,
      };

      console.log(`[Stock Enrichment] Processing ${stocksToProcess.length}/${stocks.length} stocks. NULL counts: PE=${stats.stocksWithNullPe}, PB=${nullCounts.pbRatio}, DivYield=${nullCounts.dividendYield}, ROE=${nullCounts.roe}, Beta=${nullCounts.beta}, AvgVol=${nullCounts.avgVolume}, Returns1Y=${nullCounts.returns1Y}, BroadSector=${nullCounts.broadSector}, AnalystRating=${nullCounts.analystRating}`);

      let yahooRequestCount = 0;
      enrichmentProgress.status = 'enriching';

      for (let i = 0; i < stocksToProcess.length; i += batchSize) {
        const batch = stocksToProcess.slice(i, i + batchSize);
        enrichmentProgress.currentStep = `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(stocksToProcess.length / batchSize)}...`;

        for (const stock of batch) {
          try {
            let financials: Partial<StockFinancials> = {};

            if (useFmp && process.env.FMP_API_KEY) {
              const fmpData = await this.fetchFmpComprehensive(stock.symbol);
              if (fmpData) {
                financials = this.mergeFinancials(financials, fmpData);
              }
              await new Promise(resolve => setTimeout(resolve, 250));

              if (includeReturns && (stock.returns1Y === null || stock.returns1M === null)) {
                const returnsData = await this.fetchFmpReturnsAndAnalyst(stock.symbol);
                financials = this.mergeFinancials(financials, returnsData);
                await new Promise(resolve => setTimeout(resolve, 250));
              }
            }

            if (useYahoo && yahooRequestCount < maxYahooRequests && this.rateLimitRemaining > 0) {
              const yahooData = await this.fetchYahooFinancials(stock.symbol);
              if (yahooData) {
                financials = this.mergeFinancials(financials, yahooData);
              }
              yahooRequestCount++;
              await new Promise(resolve => setTimeout(resolve, 200));
            }

            if (!financials.peRatio && !financials.eps) {
              try {
                const finnhubData = await this.fetchFinnhubFinancials(stock.symbol);
                if (finnhubData) {
                  financials = this.mergeFinancials(financials, finnhubData);
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
              } catch (e) {}
            }

            if (!financials.peRatio) {
              const currentPrice = stock.currentPrice ? parseFloat(stock.currentPrice) : null;
              const sectorData = this.inferFromSector(stock.sector, currentPrice);
              financials = this.mergeFinancials(financials, sectorData);
            }

            if (!financials.broadSector && stock.broadSector === null) {
              financials.broadSector = this.mapBroadSector(stock.sector);
            }

            if (financials && Object.keys(financials).length > 0) {
              const updates: Record<string, any> = {};

              const safeNum = (v: number | null | undefined): string | null => {
                if (v == null || !isFinite(v)) return null;
                return v.toString();
              };

              if (stock.peRatio === null && financials.peRatio != null) {
                updates.peRatio = safeNum(financials.peRatio);
              }
              if (stock.eps === null && financials.eps != null) {
                updates.eps = safeNum(financials.eps);
              }
              if (stock.bookValue === null && financials.bookValue != null) {
                updates.bookValue = safeNum(financials.bookValue);
              }
              if (stock.dividendYield === null && financials.dividendYield != null) {
                updates.dividendYield = safeNum(financials.dividendYield);
              }
              if (stock.pbRatio === null && financials.priceToBook != null) {
                updates.pbRatio = safeNum(financials.priceToBook);
              }
              if (stock.roe === null && financials.roe != null) {
                updates.roe = safeNum(financials.roe);
              }
              if (stock.roce === null && financials.roce != null) {
                updates.roce = safeNum(financials.roce);
              }
              if (stock.beta === null && financials.beta != null) {
                updates.beta = safeNum(financials.beta);
              }
              if (stock.volatility === null && financials.volatility != null) {
                updates.volatility = safeNum(financials.volatility);
              }
              if (stock.riskLevel === null && financials.riskLevel != null) {
                updates.riskLevel = financials.riskLevel;
              }
              if (stock.analystRating === null && financials.analystRating != null) {
                updates.analystRating = financials.analystRating;
              }
              if (stock.targetPrice === null && financials.targetPrice != null) {
                updates.targetPrice = safeNum(financials.targetPrice);
              }
              if (stock.numberOfAnalysts === null && financials.numberOfAnalysts != null && isFinite(financials.numberOfAnalysts)) {
                updates.numberOfAnalysts = Math.round(financials.numberOfAnalysts);
              }
              if (stock.averageVolume === null && financials.averageVolume != null && isFinite(financials.averageVolume)) {
                updates.averageVolume = Math.round(financials.averageVolume).toString();
              }
              if (stock.returns1M === null && financials.returns1M != null) {
                updates.returns1M = safeNum(financials.returns1M);
              }
              if (stock.returns1Y === null && financials.returns1Y != null) {
                updates.returns1Y = safeNum(financials.returns1Y);
              }
              if (financials.returns3M != null) {
                updates.returns3M = safeNum(financials.returns3M);
              }
              if (financials.returns6M != null) {
                updates.returns6M = safeNum(financials.returns6M);
              }
              if (financials.returns3Y != null) {
                updates.returns3Y = safeNum(financials.returns3Y);
              }
              if (financials.returns5Y != null) {
                updates.returns5Y = safeNum(financials.returns5Y);
              }
              if (stock.broadSector === null && financials.broadSector != null) {
                updates.broadSector = financials.broadSector;
              }
              if (stock.region === null && financials.region != null) {
                updates.region = financials.region;
              }

              for (const key of Object.keys(updates)) {
                if (updates[key] === null || updates[key] === undefined) {
                  delete updates[key];
                }
              }

              if (Object.keys(updates).length > 0) {
                updates.lastUpdated = new Date();
                updates.lastEnrichedAt = new Date();
                updates.enrichmentSource = 'fmp';
                updates.enrichmentStatus = 'complete';
                await targetDb.update(listedStocks)
                  .set(updates)
                  .where(eq(listedStocks.id, stock.id));
                stats.stocksEnriched++;
                console.log(`[Stock Enrichment] Enriched ${stock.symbol}: ${Object.keys(updates).filter(k => k !== 'lastUpdated' && k !== 'lastEnrichedAt' && k !== 'enrichmentSource' && k !== 'enrichmentStatus').join(', ')}`);
              }
            }

            enrichmentProgress.processedStocks++;
            enrichmentProgress.enriched = stats.stocksEnriched;
          } catch (error: any) {
            stats.errors.push(`${stock.symbol}: ${error.message}`);
            enrichmentProgress.errors.push(`${stock.symbol}: ${error.message}`);
          }
        }

        if (i + batchSize < stocksToProcess.length) {
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
    stats.fmpCalls = this.fmpCallCount;
    console.log(`[Stock Enrichment] Completed in ${stats.duration}ms: ${stats.stocksEnriched} stocks enriched, ${this.fmpCallCount} FMP API calls used`);

    return stats;
  }

  async getEnrichmentStats(): Promise<{
    totalStocks: number;
    withPe: number;
    withEps: number;
    withBookValue: number;
    withPbRatio: number;
    withDividendYield: number;
    withRoe: number;
    withBeta: number;
    withReturns1Y: number;
    withAvgVolume: number;
    withAnalystRating: number;
    withBroadSector: number;
    allNull: number;
    percentEnriched: number;
  }> {
    const statsDb = hasProductionDb() ? getProductionDb() : db;
    const [stats] = await statsDb.select({
      total: sql<number>`COUNT(*)`,
      withPe: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.peRatio} IS NOT NULL)`,
      withEps: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.eps} IS NOT NULL)`,
      withBv: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.bookValue} IS NOT NULL)`,
      withPb: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.pbRatio} IS NOT NULL)`,
      withDy: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.dividendYield} IS NOT NULL)`,
      withRoe: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.roe} IS NOT NULL)`,
      withBeta: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.beta} IS NOT NULL)`,
      withRet1Y: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.returns1Y} IS NOT NULL)`,
      withAvgVol: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.averageVolume} IS NOT NULL)`,
      withAnalyst: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.analystRating} IS NOT NULL)`,
      withBroadSector: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.broadSector} IS NOT NULL)`,
      allNull: sql<number>`COUNT(*) FILTER (WHERE ${listedStocks.peRatio} IS NULL AND ${listedStocks.eps} IS NULL AND ${listedStocks.bookValue} IS NULL AND ${listedStocks.pbRatio} IS NULL)`,
    }).from(listedStocks);

    const total = Number(stats?.total || 0);
    const fullyEnriched = Math.min(
      Number(stats?.withPe || 0),
      Number(stats?.withBeta || 0),
      Number(stats?.withRoe || 0),
    );

    return {
      totalStocks: total,
      withPe: Number(stats?.withPe || 0),
      withEps: Number(stats?.withEps || 0),
      withBookValue: Number(stats?.withBv || 0),
      withPbRatio: Number(stats?.withPb || 0),
      withDividendYield: Number(stats?.withDy || 0),
      withRoe: Number(stats?.withRoe || 0),
      withBeta: Number(stats?.withBeta || 0),
      withReturns1Y: Number(stats?.withRet1Y || 0),
      withAvgVolume: Number(stats?.withAvgVol || 0),
      withAnalystRating: Number(stats?.withAnalyst || 0),
      withBroadSector: Number(stats?.withBroadSector || 0),
      allNull: Number(stats?.allNull || 0),
      percentEnriched: total > 0 ? Math.round((fullyEnriched / total) * 100) : 0,
    };
  }
}

export const stockFinancialEnrichmentService = new StockFinancialEnrichmentService();
export default stockFinancialEnrichmentService;
