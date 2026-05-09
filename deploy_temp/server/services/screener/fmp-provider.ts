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
      if (data && typeof data === 'object' && !Array.isArray(data) && data['Error Message']?.includes('Legacy Endpoint')) {
        return null;
      }
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

  async getBatchQuotes(symbols: string[]): Promise<Array<{ symbol: string; price: number; change: number; changePercent: number; volume: number }>> {
    const joined = symbols.join(',');
    const data = await this.fetchWithRateLimit<any[]>(`/quote/${joined}`);
    if (!data) return [];
    return data.map((q: any) => ({
      symbol: q.symbol,
      price: q.price || 0,
      change: q.change || 0,
      changePercent: q.changesPercentage || 0,
      volume: q.volume || 0,
    }));
  }

  async getFinancialGrowth(symbol: string, limit = 5): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/financial-growth/${symbol}`, { limit: String(limit) });
    return data || [];
  }

  async getKeyMetrics(symbol: string, limit = 1): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/key-metrics/${symbol}`, { limit: String(limit) });
    return data || [];
  }

  async getEnterpriseValues(symbol: string, limit = 1): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/enterprise-values/${symbol}`, { limit: String(limit) });
    return data || [];
  }

  async getDCF(symbol: string): Promise<{ symbol: string; dcf: number; stockPrice: number; date: string } | null> {
    const data = await this.fetchWithRateLimit<any[]>(`/discounted-cash-flow/${symbol}`);
    if (!data || !data[0]) return null;
    return {
      symbol: data[0].symbol || symbol,
      dcf: data[0].dcf || 0,
      stockPrice: data[0].stockPrice || data[0]['Stock Price'] || 0,
      date: data[0].date || new Date().toISOString().split('T')[0],
    };
  }

  async getHistoricalDCF(symbol: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/historical-discounted-cash-flow-statement/${symbol}`);
    return data || [];
  }

  async getRating(symbol: string): Promise<any | null> {
    const data = await this.fetchWithRateLimit<any[]>(`/rating/${symbol}`);
    if (!data || !data[0]) return null;
    return data[0];
  }

  async getHistoricalRating(symbol: string, limit = 10): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/historical-rating/${symbol}`, { limit: String(limit) });
    return data || [];
  }

  async getPriceTarget(symbol: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/price-target/${symbol}`);
    return data || [];
  }

  async getUpgradesDowngrades(symbol: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/upgrades-downgrades/${symbol}`);
    return data || [];
  }

  async getAnalystEstimates(symbol: string, limit = 5): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/analyst-estimates/${symbol}`, { limit: String(limit) });
    return data || [];
  }

  async getStockGrade(symbol: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/grade/${symbol}`);
    return data || [];
  }

  async getEarningsCalendar(from?: string, to?: string): Promise<any[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const data = await this.fetchWithRateLimit<any[]>('/earning_calendar', params);
    return data || [];
  }

  async getHistoricalEarnings(symbol: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/historical/earning_calendar/${symbol}`);
    return data || [];
  }

  async getDividendCalendar(from?: string, to?: string): Promise<any[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const data = await this.fetchWithRateLimit<any[]>('/stock_dividend_calendar', params);
    return data || [];
  }

  async getHistoricalDividends(symbol: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any>(`/historical-price-full/stock_dividend/${symbol}`);
    return data?.historical || [];
  }

  async getSplitCalendar(from?: string, to?: string): Promise<any[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const data = await this.fetchWithRateLimit<any[]>('/stock_split_calendar', params);
    return data || [];
  }

  async getIPOCalendar(from?: string, to?: string): Promise<any[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const data = await this.fetchWithRateLimit<any[]>('/ipo_calendar', params);
    return data || [];
  }

  async getEconomicCalendar(from?: string, to?: string): Promise<any[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const data = await this.fetchWithRateLimit<any[]>('/economic_calendar', params);
    return data || [];
  }

  async getInstitutionalHolders(symbol: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/institutional-holder/${symbol}`);
    return data || [];
  }

  async getInsiderTrading(symbol: string, limit = 50): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>('/insider-trading', { symbol, limit: String(limit) });
    return data || [];
  }

  async getMutualFundHolders(symbol: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/mutual-fund-holder/${symbol}`);
    return data || [];
  }

  async getStockNews(symbol: string, limit = 20): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>('/stock_news', { tickers: symbol, limit: String(limit) });
    return data || [];
  }

  async getGeneralNews(limit = 20): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>('/general_news', { limit: String(limit) });
    return data || [];
  }

  async getPressReleases(symbol: string, limit = 10): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/press-releases/${symbol}`, { limit: String(limit) });
    return data || [];
  }

  async getSectorPerformance(): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>('/sector-performance');
    return data || [];
  }

  async getTechnicalIndicator(symbol: string, timeframe = 'daily', type = 'sma', period = 50): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(
      `/technical_indicator/${timeframe}/${symbol}`,
      { period: String(period), type }
    );
    return data || [];
  }

  async getETFHolders(symbol: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/etf-holder/${symbol}`);
    return data || [];
  }

  async getETFSectorWeightings(symbol: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/etf-sector-weightings/${symbol}`);
    return data || [];
  }

  async getETFInfo(symbol: string): Promise<any | null> {
    const data = await this.fetchWithRateLimit<any[]>(`/etf-info`, { symbol });
    if (!data || !data[0]) return null;
    return data[0];
  }

  async searchSymbol(query: string, limit = 10): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>('/search', { query, limit: String(limit) });
    return data || [];
  }

  async searchByISIN(isin: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/search`, { query: isin });
    return data || [];
  }

  async getStockList(): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>('/stock/list');
    return data || [];
  }

  async getMarketRiskPremium(): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>('/market-risk-premium');
    return data || [];
  }

  async getTreasuryRates(): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>('/treasury');
    return data || [];
  }

  async getSP500Constituents(): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>('/sp500_constituent');
    return data || [];
  }

  async getCompanyOutlook(symbol: string): Promise<any | null> {
    const data = await this.fetchWithRateLimit<any>(`/company-outlook`, { symbol });
    return data || null;
  }

  async getKeyExecutives(symbol: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/key-executives/${symbol}`);
    return data || [];
  }

  async getSharesFloat(symbol: string): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/shares_float`, { symbol });
    return data || [];
  }

  async getIncomeStatementGrowth(symbol: string, limit = 5): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/income-statement-growth/${symbol}`, { limit: String(limit) });
    return data || [];
  }

  async getBalanceSheetGrowth(symbol: string, limit = 5): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/balance-sheet-statement-growth/${symbol}`, { limit: String(limit) });
    return data || [];
  }

  async getCashFlowGrowth(symbol: string, limit = 5): Promise<any[]> {
    const data = await this.fetchWithRateLimit<any[]>(`/cash-flow-statement-growth/${symbol}`, { limit: String(limit) });
    return data || [];
  }
}

let providerInstance: FMPFreeProvider | null = null;

export function getDataProvider(): IDataProvider {
  if (!providerInstance) {
    providerInstance = new FMPFreeProvider();
  }
  return providerInstance;
}

export function getExtendedProvider(): FMPFreeProvider {
  if (!providerInstance) {
    providerInstance = new FMPFreeProvider();
  }
  return providerInstance;
}

export function setDataProvider(provider: IDataProvider): void {
  providerInstance = provider as FMPFreeProvider;
}

export type { FMPFreeProvider };
