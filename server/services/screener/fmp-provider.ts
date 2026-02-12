import { fmpUsageMonitor } from './fmp-usage-monitor';
import type {
  IDataProvider,
  CompanyProfile,
  FinancialRatios,
  FinancialStatement,
  HistoricalPrice,
  StockScreenerResult,
} from './data-provider';

const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

class FMPFreeProvider implements IDataProvider {
  name = 'FMP_FREE';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.FMP_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[FMP] No FMP_API_KEY found in environment');
    }
  }

  private async fetchWithRateLimit<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
    if (!this.apiKey) {
      console.warn('[FMP] API key not configured');
      return null;
    }

    const canCall = await fmpUsageMonitor.canMakeCall();
    if (!canCall) {
      console.warn('[FMP] Daily rate limit reached, skipping API call');
      return null;
    }

    const queryParams = new URLSearchParams({ ...params, apikey: this.apiKey });
    const url = `${FMP_BASE_URL}${endpoint}?${queryParams}`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });

      await fmpUsageMonitor.incrementUsage(endpoint);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('[FMP] Rate limited (429). Stopping calls.');
          return null;
        }
        console.warn(`[FMP] API error ${response.status} for ${endpoint}`);
        return null;
      }

      const data = await response.json();
      return data as T;
    } catch (err: any) {
      console.warn(`[FMP] Request failed for ${endpoint}: ${err.message}`);
      return null;
    }
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
    const data = await this.fetchWithRateLimit<any[]>(`/profile/${symbol}`);
    if (!data || !data[0]) return null;

    const p = data[0];
    return {
      symbol: p.symbol,
      companyName: p.companyName || p.symbol,
      exchange: p.exchangeShortName || p.exchange || 'NSE',
      sector: p.sector || 'Unknown',
      industry: p.industry || 'Unknown',
      marketCap: p.mktCap || 0,
      price: p.price || 0,
      currency: p.currency || 'INR',
      country: p.country || 'IN',
      isin: p.isin,
      description: p.description,
    };
  }

  async getRatios(symbol: string): Promise<FinancialRatios | null> {
    const data = await this.fetchWithRateLimit<any[]>(`/ratios/${symbol}`, { limit: '1' });
    if (!data || !data[0]) return null;

    const r = data[0];
    return {
      symbol,
      period: r.period || 'FY',
      date: r.date,
      peRatio: r.peRatio,
      pbRatio: r.priceToBookRatio,
      evToEbitda: r.enterpriseValueOverEBITDA,
      priceToSales: r.priceToSalesRatio,
      roe: r.returnOnEquity,
      roa: r.returnOnAssets,
      netProfitMargin: r.netProfitMargin,
      operatingMargin: r.operatingProfitMargin,
      grossMargin: r.grossProfitMargin,
      debtToEquity: r.debtEquityRatio,
      currentRatio: r.currentRatio,
      quickRatio: r.quickRatio,
      interestCoverage: r.interestCoverage,
      eps: r.earningsPerShare,
      bookValue: r.bookValuePerShare,
      dividendYield: r.dividendYield,
      dividendPayout: r.payoutRatio,
      freeCashFlowPerShare: r.freeCashFlowPerShare,
    };
  }

  async getIncomeStatement(symbol: string, period = 'annual'): Promise<FinancialStatement[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/income-statement/${symbol}`, { period, limit: '5' });
    if (!data) return [];

    return data.map(s => ({
      symbol,
      date: s.date,
      period: s.period || period,
      revenue: s.revenue,
      netIncome: s.netIncome,
      grossProfit: s.grossProfit,
      operatingIncome: s.operatingIncome,
    }));
  }

  async getBalanceSheet(symbol: string, period = 'annual'): Promise<FinancialStatement[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/balance-sheet-statement/${symbol}`, { period, limit: '5' });
    if (!data) return [];

    return data.map(s => ({
      symbol,
      date: s.date,
      period: s.period || period,
      totalDebt: (s.longTermDebt || 0) + (s.shortTermDebt || 0),
      totalEquity: s.totalStockholdersEquity,
      totalAssets: s.totalAssets,
    }));
  }

  async getCashFlow(symbol: string, period = 'annual'): Promise<FinancialStatement[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/cash-flow-statement/${symbol}`, { period, limit: '5' });
    if (!data) return [];

    return data.map(s => ({
      symbol,
      date: s.date,
      period: s.period || period,
      operatingCashFlow: s.operatingCashFlow,
      freeCashFlow: s.freeCashFlow,
      capitalExpenditure: s.capitalExpenditure,
    }));
  }

  async getHistoricalPrices(symbol: string, from?: string, to?: string): Promise<HistoricalPrice[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;

    const data = await this.fetchWithRateLimit<any>(`/historical-price-full/${symbol}`, params);
    if (!data?.historical) return [];

    return data.historical.map((h: any) => ({
      symbol,
      date: h.date,
      open: h.open,
      high: h.high,
      low: h.low,
      close: h.close,
      adjClose: h.adjClose || h.close,
      volume: h.volume,
      changePercent: h.changePercent || 0,
    }));
  }

  async getStockScreener(marketCapMin = 0, exchange = '', limit = 500): Promise<StockScreenerResult[]> {
    const params: Record<string, string> = { limit: String(limit) };
    if (marketCapMin > 0) params.marketCapMoreThan = String(marketCapMin);
    if (exchange) params.exchange = exchange;

    const data = await this.fetchWithRateLimit<any[]>('/stock-screener', params);
    if (!data) return [];

    return data.map(s => ({
      symbol: s.symbol,
      companyName: s.companyName || s.symbol,
      marketCap: s.marketCap || 0,
      price: s.price || 0,
      sector: s.sector || 'Unknown',
      industry: s.industry || 'Unknown',
      exchange: s.exchangeShortName || s.exchange || '',
      country: s.country || '',
    }));
  }

  async getQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number; volume: number } | null> {
    const data = await this.fetchWithRateLimit<any[]>(`/quote/${symbol}`);
    if (!data || !data[0]) return null;

    return {
      price: data[0].price || 0,
      change: data[0].change || 0,
      changePercent: data[0].changesPercentage || 0,
      volume: data[0].volume || 0,
    };
  }
}

let providerInstance: IDataProvider | null = null;

export function getDataProvider(): IDataProvider {
  if (!providerInstance) {
    providerInstance = new FMPFreeProvider();
  }
  return providerInstance;
}

export function setDataProvider(provider: IDataProvider): void {
  providerInstance = provider;
}
