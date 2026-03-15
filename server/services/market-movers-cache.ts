import yahooFinance from 'yahoo-finance2';
import { pool } from '../db';
import { callPython } from '../clients/python-client';

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
}

interface MarketMoversData {
  gainers: Stock[];
  losers: Stock[];
}

interface CacheEntry {
  data: MarketMoversData;
  timestamp: number;
  isRefreshing: boolean;
}

interface ProviderMetrics {
  successCount: number;
  failureCount: number;
  lastSuccess: number;
  lastFailure: number;
  lastLatency: number;
  rateLimitErrors: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  refreshes: number;
  errors: number;
  rateLimitErrors: number;
  lastRefreshTime: number;
  lastRefreshDuration: number;
  yahooLatency: number;
  backoffUntil: number;
  providers: {
    yahoo: ProviderMetrics;
    finnhub: ProviderMetrics;
    nse: ProviderMetrics;
    bse: ProviderMetrics;
    python: ProviderMetrics;
  };
  lastSuccessfulProvider: string | null;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_TTL_MS = 60 * 60 * 1000;
const CRUMB_TTL_MS = 4 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const INITIAL_BACKOFF_MS = 5 * 60 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const BACKOFF_MULTIPLIER = 2;

const INDIAN_STOCKS = [
  { symbol: "RELIANCE.NS", name: "Reliance Industries" },
  { symbol: "TCS.NS", name: "Tata Consultancy Services" },
  { symbol: "HDFCBANK.NS", name: "HDFC Bank Limited" },
  { symbol: "INFY.NS", name: "Infosys Limited" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank Limited" },
  { symbol: "BAJFINANCE.NS", name: "Bajaj Finance Limited" },
  { symbol: "MARUTI.NS", name: "Maruti Suzuki India" },
  { symbol: "ASIANPAINT.NS", name: "Asian Paints Limited" },
  { symbol: "NESTLEIND.NS", name: "Nestle India Limited" },
  { symbol: "ULTRACEMCO.NS", name: "UltraTech Cement" },
  { symbol: "HINDUNILVR.NS", name: "Hindustan Unilever" },
  { symbol: "LT.NS", name: "Larsen & Toubro" },
  { symbol: "WIPRO.NS", name: "Wipro Limited" },
  { symbol: "BHARTIARTL.NS", name: "Bharti Airtel" },
  { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank" },
];

const FALLBACK_DATA: MarketMoversData = {
  gainers: [
    { symbol: "RELIANCE", name: "Reliance Industries", price: 2847.65, change: 89.45, changePercent: 3.24, previousClose: 2758.20 },
    { symbol: "TCS", name: "Tata Consultancy Services", price: 4156.30, change: 116.20, changePercent: 2.87, previousClose: 4040.10 },
    { symbol: "HDFCBANK", name: "HDFC Bank Limited", price: 1743.85, change: 33.35, changePercent: 1.95, previousClose: 1710.50 },
    { symbol: "INFY", name: "Infosys Limited", price: 1856.40, change: 28.90, changePercent: 1.58, previousClose: 1827.50 },
    { symbol: "ICICIBANK", name: "ICICI Bank Limited", price: 1287.55, change: 18.75, changePercent: 1.48, previousClose: 1268.80 },
  ],
  losers: [
    { symbol: "BAJFINANCE", name: "Bajaj Finance Limited", price: 6789.25, change: -156.30, changePercent: -2.26, previousClose: 6945.55 },
    { symbol: "MARUTI", name: "Maruti Suzuki India", price: 11245.80, change: -198.65, changePercent: -1.74, previousClose: 11444.45 },
    { symbol: "ASIANPAINT", name: "Asian Paints Limited", price: 2943.15, change: -48.90, changePercent: -1.63, previousClose: 2992.05 },
    { symbol: "NESTLEIND", name: "Nestle India Limited", price: 24567.35, change: -389.25, changePercent: -1.56, previousClose: 24956.60 },
    { symbol: "ULTRACEMCO", name: "UltraTech Cement", price: 10876.40, change: -156.85, changePercent: -1.42, previousClose: 11033.25 },
  ],
};

class FinnhubProvider {
  private apiKey: string | null = null;
  private isAvailable: boolean = false;
  private readonly baseUrl = 'https://finnhub.io/api/v1';

  constructor() {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (apiKey && apiKey.length > 0) {
      this.apiKey = apiKey;
      this.isAvailable = true;
      console.log('✅ [FinnhubProvider] Initialized successfully (API key length:', apiKey.length + ')');
    } else {
      console.log('ℹ️ [FinnhubProvider] FINNHUB_API_KEY not set - Finnhub fallback disabled');
      this.isAvailable = false;
    }
  }

  isEnabled(): boolean {
    return this.isAvailable;
  }

  async getQuote(symbol: string): Promise<{ price: number; change: number; changePercent: number; previousClose: number } | null> {
    if (!this.isAvailable || !this.apiKey) {
      return null;
    }

    try {
      const url = `${this.baseUrl}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Finnhub rate limit exceeded');
        }
        return null;
      }

      const data = await response.json();
      
      if (!data || data.c === 0 || data.c === undefined) {
        return null;
      }

      return {
        price: data.c || 0,
        change: data.d || 0,
        changePercent: data.dp || 0,
        previousClose: data.pc || 0,
      };
    } catch (error) {
      console.warn(`⚠️ [FinnhubProvider] Quote fetch error for ${symbol}:`, error);
      throw error;
    }
  }

  async fetchAllStocks(stocks: typeof INDIAN_STOCKS): Promise<Stock[]> {
    if (!this.isAvailable) {
      throw new Error('Finnhub provider not available');
    }

    const stockQuotes: Stock[] = [];

    for (const stock of stocks) {
      try {
        const nseSymbol = stock.symbol.replace('.NS', '');
        const quote = await this.getQuote(nseSymbol);
        if (quote && quote.price > 0) {
          stockQuotes.push({
            symbol: nseSymbol,
            name: stock.name,
            price: quote.price,
            change: quote.change,
            changePercent: quote.changePercent,
            previousClose: quote.previousClose,
          });
        }
        await new Promise(resolve => setTimeout(resolve, 150));
      } catch (error) {
        const errorStr = String(error);
        if (errorStr.includes('rate limit') || errorStr.includes('429')) {
          throw error;
        }
        console.warn(`⚠️ [FinnhubProvider] Failed to fetch ${stock.symbol}:`, error);
      }
    }

    if (stockQuotes.length === 0) {
      throw new Error('No stock data fetched from Finnhub');
    }

    return stockQuotes;
  }
}

class NseIndiaProvider {
  private readonly baseUrl = 'https://www.nseindia.com/api';
  private cookies: string = '';
  private cookiesExpiry: number = 0;
  private isAvailable: boolean = true;

  constructor() {
    console.log('✅ [NseIndiaProvider] Initialized (NSE India API fallback)');
  }

  isEnabled(): boolean {
    return this.isAvailable;
  }

  private async refreshCookies(): Promise<void> {
    if (Date.now() < this.cookiesExpiry) {
      return;
    }

    try {
      const response = await fetch('https://www.nseindia.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      const setCookieHeaders = response.headers.get('set-cookie');
      if (setCookieHeaders) {
        this.cookies = setCookieHeaders.split(',').map(c => c.split(';')[0]).join('; ');
        this.cookiesExpiry = Date.now() + 5 * 60 * 1000;
      }
    } catch (error) {
      console.warn('⚠️ [NseIndiaProvider] Failed to refresh cookies:', error);
    }
  }

  async fetchMarketMovers(): Promise<Stock[]> {
    try {
      await this.refreshCookies();

      const response = await fetch(`${this.baseUrl}/live-analysis-variations?index=gainers`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cookie': this.cookies,
          'Referer': 'https://www.nseindia.com/market-data/live-market-indices',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('NSE rate limit exceeded');
        }
        throw new Error(`NSE API error: ${response.status}`);
      }

      const data = await response.json();
      const stockQuotes: Stock[] = [];

      if (data?.NIFTY?.data) {
        const parseNum = (v: any): number => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;
        for (const item of data.NIFTY.data.slice(0, 15)) {
          const price = parseNum(item.ltp);
          const changePct = parseNum(item.perChange) || parseNum(item.pChange);
          let change = parseNum(item.netPrice) || parseNum(item.change);
          let prevClose = parseNum(item.previousClose);
          if (prevClose === 0 && price > 0 && change !== 0) {
            prevClose = price - change;
          }
          if (change === 0 && price > 0 && changePct !== 0) {
            change = price * changePct / (100 + changePct);
          }
          if (prevClose === 0 && price > 0 && change !== 0) {
            prevClose = price - change;
          }
          if (change === 0 || prevClose === 0) {
            console.warn(`⚠️ [NseIndiaProvider] ${item.symbol}: change=${change} prevClose=${prevClose} (raw: netPrice=${item.netPrice} change=${item.change} previousClose=${item.previousClose} ltp=${item.ltp} perChange=${item.perChange})`);
          }
          stockQuotes.push({
            symbol: item.symbol || '',
            name: item.symbol || '',
            price,
            change: Math.round(change * 100) / 100,
            changePercent: Math.round(changePct * 100) / 100,
            previousClose: Math.round(prevClose * 100) / 100,
          });
        }
      }

      if (stockQuotes.length === 0) {
        throw new Error('No stock data from NSE API');
      }

      return stockQuotes;
    } catch (error) {
      console.warn('⚠️ [NseIndiaProvider] Fetch error:', error);
      throw error;
    }
  }

  async fetchCorporateReports(symbol: string): Promise<{
    quarterlyResults: any[];
    announcements: any[];
    boardMeetings: any[];
    corporateActions: any[];
    source: 'nse';
    success: boolean;
    error?: string;
  }> {
    const result = {
      quarterlyResults: [] as any[],
      announcements: [] as any[],
      boardMeetings: [] as any[],
      corporateActions: [] as any[],
      source: 'nse' as const,
      success: false,
      error: undefined as string | undefined,
    };

    try {
      await this.refreshCookies();
      const normalizedSymbol = symbol.toUpperCase().trim();
      
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cookie': this.cookies,
        'Referer': `https://www.nseindia.com/get-quotes/equity?symbol=${normalizedSymbol}`,
      };

      const [resultsRes, announcementsRes, boardMeetingsRes, actionsRes] = await Promise.allSettled([
        fetch(`${this.baseUrl}/corporates/financial-results?index=equities&symbol=${normalizedSymbol}`, { headers }),
        fetch(`${this.baseUrl}/corporates/announcements?index=equities&symbol=${normalizedSymbol}`, { headers }),
        fetch(`${this.baseUrl}/corporates/boardMeetings?index=equities&symbol=${normalizedSymbol}`, { headers }),
        fetch(`${this.baseUrl}/corporates/actions?index=equities&symbol=${normalizedSymbol}`, { headers }),
      ]);

      if (resultsRes.status === 'fulfilled' && resultsRes.value.ok) {
        const data = await resultsRes.value.json();
        const items = data?.results || data || [];
        result.quarterlyResults = (Array.isArray(items) ? items : []).slice(0, 20).map((r: any) => ({
          period: r.xbrl_per || r.period,
          periodEnd: r.to_date || r.toDate,
          revenue: this.parseNumber(r.income || r.totalIncome),
          netProfit: this.parseNumber(r.netProfit || r.re_netProfit),
          eps: this.parseNumber(r.eps || r.re_eps),
          broadcastDate: r.broadcastDt || r.broadcast_dt,
          consolidated: r.consolidated === 'true' || r.consolidated === true,
        }));
      }

      if (announcementsRes.status === 'fulfilled' && announcementsRes.value.ok) {
        const data = await announcementsRes.value.json();
        const items = data?.announcements || data || [];
        result.announcements = (Array.isArray(items) ? items : []).slice(0, 50).map((a: any) => ({
          subject: a.desc || a.subject || a.sm_headline,
          broadcastDate: a.an_dt || a.announceDate || a.broadcastDt,
          category: a.attchmntFile ? 'attachment' : 'text',
          attachmentLink: a.attchmntFile || null,
        }));
      }

      if (boardMeetingsRes.status === 'fulfilled' && boardMeetingsRes.value.ok) {
        const data = await boardMeetingsRes.value.json();
        const items = data?.boardMeetings || data || [];
        result.boardMeetings = (Array.isArray(items) ? items : []).slice(0, 20).map((m: any) => ({
          meetingDate: m.bm_dt || m.meetingDate,
          purpose: m.bm_purpose || m.purpose,
          broadcastDate: m.an_dt || m.broadcastDt,
        }));
      }

      if (actionsRes.status === 'fulfilled' && actionsRes.value.ok) {
        const data = await actionsRes.value.json();
        const items = data?.corporateActions || data || [];
        result.corporateActions = (Array.isArray(items) ? items : []).slice(0, 20).map((c: any) => ({
          actionType: c.series || c.subject || c.purpose,
          exDate: c.exDate || c.ex_date,
          recordDate: c.recordDate || c.record_dt,
          bcStartDate: c.bcStartDate,
          bcEndDate: c.bcEndDate,
          purpose: c.subject || c.purpose,
        }));
      }

      const totalItems = result.quarterlyResults.length + result.announcements.length + 
                        result.boardMeetings.length + result.corporateActions.length;
      result.success = totalItems > 0;
      
      console.log(`[NseIndiaProvider] Corporate reports for ${normalizedSymbol}: ${totalItems} total items`);
      return result;
    } catch (error: any) {
      result.error = error.message;
      console.warn(`⚠️ [NseIndiaProvider] Corporate reports error: ${error.message}`);
      return result;
    }
  }

  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '' || value === '-') return null;
    if (typeof value === 'number') return value;
    const cleaned = String(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
}

class BseIndiaProvider {
  private readonly baseUrl = 'https://api.bseindia.com/BseIndiaAPI/api';
  private isAvailable: boolean = true;

  constructor() {
    console.log('✅ [BseIndiaProvider] Initialized (BSE India API fallback)');
  }

  isEnabled(): boolean {
    return this.isAvailable;
  }

  async fetchMarketMovers(): Promise<Stock[]> {
    try {
      const response = await fetch(`${this.baseUrl}/MktRGainerLoser/w?GLession=G&scripcode=`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.bseindia.com/',
          'Origin': 'https://www.bseindia.com',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('BSE rate limit exceeded');
        }
        throw new Error(`BSE API error: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        throw new Error(`BSE returned non-JSON response (${contentType.split(';')[0] || 'unknown'})`);
      }

      const data = await response.json();
      const stockQuotes: Stock[] = [];

      if (data?.Table && Array.isArray(data.Table)) {
        for (const item of data.Table.slice(0, 15)) {
          const price = parseFloat(item.LTP) || parseFloat(item.ltp) || 0;
          const change = parseFloat(item.Change) || parseFloat(item.change) || 0;
          const changePercent = parseFloat(item.Chg) || parseFloat(item.chg) || parseFloat(item.PerChg) || 0;
          const previousClose = parseFloat(item.PrevClose) || (price - change) || 0;
          
          if (price > 0) {
            stockQuotes.push({
              symbol: item.scripcode || item.Scripcode || item.SCRIP_CD || '',
              name: item.scrip_nm || item.ScripName || item.SCRIP_NAME || item.scripcode || '',
              price,
              change,
              changePercent,
              previousClose,
            });
          }
        }
      }

      if (stockQuotes.length === 0) {
        const sensexResponse = await fetch(`${this.baseUrl}/GetSensex30Stocks/w`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Referer': 'https://www.bseindia.com/',
            'Origin': 'https://www.bseindia.com',
          },
        });

        const sensexCT = sensexResponse.headers.get('content-type') || '';
        if (sensexResponse.ok && sensexCT.includes('json')) {
          const sensexData = await sensexResponse.json();
          if (sensexData?.Table && Array.isArray(sensexData.Table)) {
            for (const item of sensexData.Table.slice(0, 15)) {
              const price = parseFloat(item.CurrPrice) || parseFloat(item.LTP) || 0;
              const change = parseFloat(item.Chg) || parseFloat(item.Change) || 0;
              const changePercent = parseFloat(item.ChgPer) || parseFloat(item.PerChg) || 0;
              
              if (price > 0) {
                stockQuotes.push({
                  symbol: item.Scripcode || item.scripcode || '',
                  name: item.ScripName || item.scrip_nm || '',
                  price,
                  change,
                  changePercent,
                  previousClose: price - change,
                });
              }
            }
          }
        }
      }

      if (stockQuotes.length === 0) {
        throw new Error('No stock data from BSE API');
      }

      console.log(`✅ [BseIndiaProvider] Fetched ${stockQuotes.length} stocks`);
      return stockQuotes;
    } catch (error) {
      console.warn('⚠️ [BseIndiaProvider] Fetch error:', error);
      throw error;
    }
  }

  async getQuote(scripcode: string): Promise<{ price: number; change: number; changePercent: number; previousClose: number } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/StockReachGraph/w?scripcode=${scripcode}&flag=0&fromdate=&todate=&seression=`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://www.bseindia.com/',
          'Origin': 'https://www.bseindia.com',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      if (data?.CurrVal) {
        return {
          price: parseFloat(data.CurrVal) || 0,
          change: parseFloat(data.Chng) || 0,
          changePercent: parseFloat(data.ChngPer) || 0,
          previousClose: parseFloat(data.PrvClose) || 0,
        };
      }

      return null;
    } catch (error) {
      console.warn(`⚠️ [BseIndiaProvider] Quote fetch error for ${scripcode}:`, error);
      return null;
    }
  }

  async fetchCorporateReports(symbol?: string, scripcode?: string): Promise<{
    financialResults: any[];
    announcements: any[];
    corporateActions: any[];
    shareholdingPattern: any[];
    source: 'bse';
    success: boolean;
    error?: string;
  }> {
    const result = {
      financialResults: [] as any[],
      announcements: [] as any[],
      corporateActions: [] as any[],
      shareholdingPattern: [] as any[],
      source: 'bse' as const,
      success: false,
      error: undefined as string | undefined,
    };

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.bseindia.com/',
      'Origin': 'https://www.bseindia.com',
    };

    let resolvedScripcode = scripcode;

    if (!resolvedScripcode && symbol) {
      const normalizedSymbol = symbol.toUpperCase().trim();
      try {
        const searchResponse = await fetch(`${this.baseUrl}/Suggest/w?flag=1&query=${encodeURIComponent(normalizedSymbol)}`, { headers });
        if (searchResponse.ok) {
          const searchResults = await searchResponse.json();
          if (Array.isArray(searchResults) && searchResults.length > 0) {
            let match = searchResults.find((r: any) => (r.trdSym || '').toUpperCase().trim() === normalizedSymbol);
            if (!match) {
              match = searchResults.find((r: any) => {
                const scripName = (r.scrip_nm || '').toUpperCase().trim();
                return scripName.startsWith(normalizedSymbol) || scripName.includes(normalizedSymbol);
              });
            }
            if (!match && searchResults.length === 1) match = searchResults[0];
            if (match) {
              resolvedScripcode = match.scrip_cd || match.scripcode;
              console.log(`[BseIndiaProvider] Symbol ${normalizedSymbol} resolved to scripcode ${resolvedScripcode}`);
            }
          }
        }
      } catch (e) {
        console.warn(`[BseIndiaProvider] Symbol lookup failed`);
      }
    }

    if (!resolvedScripcode) {
      result.error = 'Could not resolve scripcode';
      return result;
    }

    try {
      const today = new Date();
      const fromDate = new Date(today.getFullYear() - 2, 0, 1);
      const fromDateStr = `${String(fromDate.getDate()).padStart(2, '0')}/${String(fromDate.getMonth() + 1).padStart(2, '0')}/${fromDate.getFullYear()}`;
      const toDateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

      const [financialsRes, actionsRes] = await Promise.allSettled([
        fetch(`${this.baseUrl}/FinancialResults/w?scripcode=${resolvedScripcode}`, { headers }),
        fetch(`${this.baseUrl}/CorporateActions/w?scripcode=${resolvedScripcode}&fromdt=${fromDateStr}&todt=${toDateStr}`, { headers }),
      ]);

      if (financialsRes.status === 'fulfilled' && financialsRes.value.ok) {
        const data = await financialsRes.value.json();
        const items = data?.Table || [];
        result.financialResults = (Array.isArray(items) ? items : []).slice(0, 20).map((r: any) => ({
          quarterEnded: r.QuarterEnd || r.qtr_end,
          revenue: this.parseNumber(r.Revenue || r.Income),
          netProfit: this.parseNumber(r.NetProfit || r.PAT),
          eps: this.parseNumber(r.EPS),
          ebitda: this.parseNumber(r.EBITDA),
          broadcastDate: r.BroadcastDate || r.broadcast_dt,
          consolidated: r.Consolidated === 'Y' || r.consolidated === true,
        }));
      }

      if (actionsRes.status === 'fulfilled' && actionsRes.value.ok) {
        const data = await actionsRes.value.json();
        const items = data?.Table || [];
        result.corporateActions = (Array.isArray(items) ? items : []).slice(0, 20).map((c: any) => ({
          purpose: c.Purpose || c.purpose,
          exDate: c.ExDate || c.ex_date,
          recordDate: c.RecordDate || c.record_date,
          bcStartDate: c.BCStartDate,
          bcEndDate: c.BCEndDate,
        }));
      }

      const totalItems = result.financialResults.length + result.announcements.length + result.corporateActions.length;
      result.success = totalItems > 0;
      
      console.log(`[BseIndiaProvider] Corporate reports for scripcode ${resolvedScripcode}: ${totalItems} total items`);
      return result;
    } catch (error: any) {
      result.error = error.message;
      console.warn(`⚠️ [BseIndiaProvider] Corporate reports error: ${error.message}`);
      return result;
    }
  }

  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '' || value === '-') return null;
    if (typeof value === 'number') return value;
    const cleaned = String(value).replace(/,/g, '').replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
}

const nseIndiaProviderInstance = new NseIndiaProvider();
const bseIndiaProviderInstance = new BseIndiaProvider();

export { nseIndiaProviderInstance, bseIndiaProviderInstance };

class MarketMoversCache {
  private cache: CacheEntry | null = null;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    refreshes: 0,
    errors: 0,
    rateLimitErrors: 0,
    lastRefreshTime: 0,
    lastRefreshDuration: 0,
    yahooLatency: 0,
    backoffUntil: 0,
    providers: {
      yahoo: {
        successCount: 0,
        failureCount: 0,
        lastSuccess: 0,
        lastFailure: 0,
        lastLatency: 0,
        rateLimitErrors: 0,
      },
      finnhub: {
        successCount: 0,
        failureCount: 0,
        lastSuccess: 0,
        lastFailure: 0,
        lastLatency: 0,
        rateLimitErrors: 0,
      },
      nse: {
        successCount: 0,
        failureCount: 0,
        lastSuccess: 0,
        lastFailure: 0,
        lastLatency: 0,
        rateLimitErrors: 0,
      },
      bse: {
        successCount: 0,
        failureCount: 0,
        lastSuccess: 0,
        lastFailure: 0,
        lastLatency: 0,
        rateLimitErrors: 0,
      },
      python: {
        successCount: 0,
        failureCount: 0,
        lastSuccess: 0,
        lastFailure: 0,
        lastLatency: 0,
        rateLimitErrors: 0,
      },
    },
    lastSuccessfulProvider: null,
  };
  private refreshLock = false;
  private crumbInitialized = false;
  private crumbInitTime = 0;
  private isInitialized = false;
  private currentBackoff = INITIAL_BACKOFF_MS;
  private finnhubProvider: FinnhubProvider;
  private nseProvider: NseIndiaProvider;
  private bseProvider: BseIndiaProvider;
  private yahooRateLimited = false;

  constructor() {
    this.finnhubProvider = new FinnhubProvider();
    // Use singleton instances instead of creating new ones
    this.nseProvider = nseIndiaProviderInstance;
    this.bseProvider = bseIndiaProviderInstance;
  }

  private async loadFromDatabase(): Promise<MarketMoversData | null> {
    try {
      const client = await pool.connect();
      try {
        const gainersResult = await client.query(`
          SELECT symbol, name, current_price as price, change, change_percent as "changePercent", previous_close as "previousClose"
          FROM stock_prices_cache 
          WHERE is_gainer = true AND fetched_at > NOW() - INTERVAL '30 minutes'
          ORDER BY gainer_rank ASC NULLS LAST, change_percent DESC
          LIMIT 5
        `);
        
        const losersResult = await client.query(`
          SELECT symbol, name, current_price as price, change, change_percent as "changePercent", previous_close as "previousClose"
          FROM stock_prices_cache 
          WHERE is_loser = true AND fetched_at > NOW() - INTERVAL '30 minutes'
          ORDER BY loser_rank ASC NULLS LAST, change_percent ASC
          LIMIT 5
        `);

        if (gainersResult.rows.length > 0 || losersResult.rows.length > 0) {
          const gainers = gainersResult.rows.map(row => ({
            symbol: row.symbol,
            name: row.name,
            price: parseFloat(row.price),
            change: parseFloat(row.change || 0),
            changePercent: parseFloat(row.changePercent || 0),
            previousClose: parseFloat(row.previousClose || 0),
          }));
          
          const losers = losersResult.rows.map(row => ({
            symbol: row.symbol,
            name: row.name,
            price: parseFloat(row.price),
            change: parseFloat(row.change || 0),
            changePercent: parseFloat(row.changePercent || 0),
            previousClose: parseFloat(row.previousClose || 0),
          }));

          console.log(`💾 [MarketMoversCache] Loaded from database: ${gainers.length} gainers, ${losers.length} losers`);
          return { gainers, losers };
        }
        return null;
      } finally {
        client.release();
      }
    } catch (error) {
      console.warn('⚠️ [MarketMoversCache] Database load failed:', error);
      return null;
    }
  }

  private async saveToDatabase(stocks: Stock[], source: string): Promise<void> {
    if (stocks.length === 0) return;
    const isProduction = process.env.NODE_ENV === 'production' || process.env.REPL_DEPLOYMENT === '1';
    if (!isProduction) return;
    
    try {
      const client = await pool.connect();
      try {
        const gainers = stocks
          .filter(s => s.changePercent > 0)
          .sort((a, b) => b.changePercent - a.changePercent);
        
        const losers = stocks
          .filter(s => s.changePercent < 0)
          .sort((a, b) => a.changePercent - b.changePercent);

        for (let i = 0; i < stocks.length; i++) {
          const stock = stocks[i];
          const isGainer = stock.changePercent > 0;
          const isLoser = stock.changePercent < 0;
          const gainerRank = isGainer ? gainers.findIndex(g => g.symbol === stock.symbol) + 1 : null;
          const loserRank = isLoser ? losers.findIndex(l => l.symbol === stock.symbol) + 1 : null;

          const exchange = source === 'bse' ? 'BSE' : source === 'finnhub' ? 'FINNHUB' : 'NSE';
          await client.query(`
            INSERT INTO stock_prices_cache 
              (symbol, name, exchange, current_price, previous_close, change, change_percent, 
               is_gainer, is_loser, gainer_rank, loser_rank, data_source, fetched_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
            ON CONFLICT (symbol) DO UPDATE SET
              name = EXCLUDED.name,
              exchange = EXCLUDED.exchange,
              current_price = EXCLUDED.current_price,
              previous_close = EXCLUDED.previous_close,
              change = EXCLUDED.change,
              change_percent = EXCLUDED.change_percent,
              is_gainer = EXCLUDED.is_gainer,
              is_loser = EXCLUDED.is_loser,
              gainer_rank = EXCLUDED.gainer_rank,
              loser_rank = EXCLUDED.loser_rank,
              data_source = EXCLUDED.data_source,
              fetched_at = NOW(),
              updated_at = NOW()
          `, [
            stock.symbol,
            stock.name,
            exchange,
            stock.price,
            stock.previousClose,
            stock.change,
            stock.changePercent,
            isGainer,
            isLoser,
            gainerRank,
            loserRank,
            source
          ]);
        }
        
        console.log(`💾 [MarketMoversCache] Saved ${stocks.length} stocks to database`);
      } finally {
        client.release();
      }
    } catch (error) {
      console.warn('⚠️ [MarketMoversCache] Database save failed:', error);
    }
  }

  async initialize(): Promise<void> {
    console.log('📈 [MarketMoversCache] Starting background initialization...');
    this.initializeInBackground().catch(err => 
      console.error('❌ [MarketMoversCache] Background initialization failed:', err)
    );
    this.startBackgroundRefresh();
    console.log('✅ [MarketMoversCache] Background initialization started (non-blocking)');
  }

  private async initializeInBackground(): Promise<void> {
    // Try to load from database first (much faster, no API calls)
    const dbData = await this.loadFromDatabase();
    if (dbData && dbData.gainers.length > 0) {
      this.cache = {
        data: dbData,
        timestamp: Date.now(),
        isRefreshing: false,
      };
      this.metrics.lastSuccessfulProvider = 'database';
      this.isInitialized = true;
      console.log('✅ [MarketMoversCache] Initialized from database (fast path)');
      
      // Schedule a background refresh to update the data
      setTimeout(() => this.refreshCache().catch(console.error), 5000);
      return;
    }
    
    // Fall back to API refresh if database is empty
    await this.refreshCache();
    this.isInitialized = true;
    console.log('✅ [MarketMoversCache] Background initialization completed (API refresh)');
  }

  private isRateLimited(): boolean {
    return Date.now() < this.metrics.backoffUntil;
  }

  private applyBackoff(): void {
    this.metrics.backoffUntil = Date.now() + this.currentBackoff;
    console.log(`⏸️ [MarketMoversCache] Rate limited, backing off for ${Math.round(this.currentBackoff / 1000)}s`);
    this.currentBackoff = Math.min(this.currentBackoff * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
  }

  private resetBackoff(): void {
    this.currentBackoff = INITIAL_BACKOFF_MS;
    this.metrics.backoffUntil = 0;
  }

  private isRateLimitError(error: any): boolean {
    const errorString = String(error);
    return errorString.includes('Too Many Requests') || 
           errorString.includes('429') ||
           errorString.includes('rate limit');
  }

  private async initializeYahooCrumb(): Promise<void> {
    if (this.crumbInitialized && (Date.now() - this.crumbInitTime) < CRUMB_TTL_MS) {
      return;
    }

    if (this.isRateLimited()) {
      console.log('⏸️ [MarketMoversCache] Skipping crumb init - rate limited');
      return;
    }

    try {
      console.log('🔐 [MarketMoversCache] Initializing Yahoo Finance crumb...');
      const startTime = Date.now();
      
      yahooFinance.suppressNotices(['yahooSurvey']);
      
      await yahooFinance.quote('AAPL');
      
      this.crumbInitialized = true;
      this.crumbInitTime = Date.now();
      this.yahooRateLimited = false;
      this.resetBackoff();
      console.log(`✅ [MarketMoversCache] Yahoo crumb initialized in ${Date.now() - startTime}ms`);
    } catch (error) {
      if (this.isRateLimitError(error)) {
        this.metrics.rateLimitErrors++;
        this.metrics.providers.yahoo.rateLimitErrors++;
        this.yahooRateLimited = true;
        this.applyBackoff();
      }
      console.warn('⚠️ [MarketMoversCache] Failed to initialize Yahoo crumb:', error);
    }
  }

  private startBackgroundRefresh(): void {
    setInterval(async () => {
      const hasFallback = this.finnhubProvider.isEnabled() || this.nseProvider.isEnabled() || this.bseProvider.isEnabled();
      if (this.isRateLimited() && !hasFallback) {
        const remainingMs = this.metrics.backoffUntil - Date.now();
        console.log(`⏸️ [MarketMoversCache] Skipping refresh - rate limited for ${Math.round(remainingMs / 1000)}s more`);
        return;
      }

      const now = Date.now();
      const cacheAge = this.cache ? now - this.cache.timestamp : Infinity;
      
      if (cacheAge >= CACHE_TTL_MS && !this.refreshLock) {
        console.log('🔄 [MarketMoversCache] Background refresh triggered');
        await this.refreshCache();
      }
    }, REFRESH_INTERVAL_MS);
  }

  private async fetchFromYahoo(): Promise<Stock[]> {
    const startTime = Date.now();
    const stockQuotes: Stock[] = [];
    
    for (const stock of INDIAN_STOCKS) {
      try {
        const yahooStart = Date.now();
        const quote = await yahooFinance.quote(stock.symbol);
        this.metrics.yahooLatency = Date.now() - yahooStart;
        
        stockQuotes.push({
          symbol: stock.symbol.replace('.NS', ''),
          name: stock.name,
          price: quote.regularMarketPrice || 0,
          change: quote.regularMarketChange || 0,
          changePercent: quote.regularMarketChangePercent || 0,
          previousClose: quote.regularMarketPreviousClose || 0,
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        if (this.isRateLimitError(error)) {
          this.metrics.providers.yahoo.rateLimitErrors++;
          this.yahooRateLimited = true;
          throw error;
        }
      }
    }

    if (stockQuotes.length === 0) {
      throw new Error('No stock data fetched from Yahoo');
    }

    this.metrics.providers.yahoo.lastLatency = Date.now() - startTime;
    this.metrics.providers.yahoo.successCount++;
    this.metrics.providers.yahoo.lastSuccess = Date.now();
    this.yahooRateLimited = false;
    
    return stockQuotes;
  }

  private async fetchFromFinnhub(): Promise<Stock[]> {
    if (!this.finnhubProvider.isEnabled()) {
      throw new Error('Finnhub provider not available');
    }

    const startTime = Date.now();
    const stockQuotes = await this.finnhubProvider.fetchAllStocks(INDIAN_STOCKS);
    
    this.metrics.providers.finnhub.lastLatency = Date.now() - startTime;
    this.metrics.providers.finnhub.successCount++;
    this.metrics.providers.finnhub.lastSuccess = Date.now();
    
    return stockQuotes;
  }

  private async fetchFromNse(): Promise<Stock[]> {
    if (!this.nseProvider.isEnabled()) {
      throw new Error('NSE provider not available');
    }

    const startTime = Date.now();
    const stockQuotes = await this.nseProvider.fetchMarketMovers();
    
    this.metrics.providers.nse.lastLatency = Date.now() - startTime;
    this.metrics.providers.nse.successCount++;
    this.metrics.providers.nse.lastSuccess = Date.now();
    
    return stockQuotes;
  }

  private async fetchFromBse(): Promise<Stock[]> {
    if (!this.bseProvider.isEnabled()) {
      throw new Error('BSE provider not available');
    }

    const startTime = Date.now();
    const stockQuotes = await this.bseProvider.fetchMarketMovers();
    
    this.metrics.providers.bse.lastLatency = Date.now() - startTime;
    this.metrics.providers.bse.successCount++;
    this.metrics.providers.bse.lastSuccess = Date.now();
    
    return stockQuotes;
  }

  private async fetchFromPython(): Promise<Stock[]> {
    const startTime = Date.now();

    const resp = await callPython<{
      gainers: Stock[];
      losers: Stock[];
      total: number;
      source: string;
    }>('/market/movers/indian', 'GET');

    if (!resp || (!resp.gainers?.length && !resp.losers?.length)) {
      throw new Error('Python sidecar returned empty market movers');
    }

    const all = [...(resp.gainers || []), ...(resp.losers || [])];
    if (all.length === 0) throw new Error('No stocks from Python provider');

    this.metrics.providers.python.lastLatency = Date.now() - startTime;
    this.metrics.providers.python.successCount++;
    this.metrics.providers.python.lastSuccess = Date.now();

    return all;
  }

  private async refreshCache(): Promise<void> {
    if (this.refreshLock) {
      console.log('⏳ [MarketMoversCache] Refresh already in progress, skipping');
      return;
    }

    this.refreshLock = true;
    const startTime = Date.now();

    try {
      console.log('📊 [MarketMoversCache] Fetching fresh market data...');
      
      let stockQuotes: Stock[] = [];
      let successProvider: string | null = null;

      // Priority 1: NSE India (direct exchange, proven working in production)
      if (stockQuotes.length === 0 && this.nseProvider.isEnabled()) {
        try {
          console.log('🔄 [MarketMoversCache] Trying NSE India (primary)...');
          stockQuotes = await this.fetchFromNse();
          successProvider = 'nse';
          console.log(`✅ [MarketMoversCache] NSE India succeeded with ${stockQuotes.length} stocks`);
        } catch (nseError) {
          console.warn('⚠️ [MarketMoversCache] NSE India failed:', nseError);
          this.metrics.providers.nse.failureCount++;
          this.metrics.providers.nse.lastFailure = Date.now();
        }
      }

      // Priority 2: BSE India (secondary exchange)
      if (stockQuotes.length === 0 && this.bseProvider.isEnabled()) {
        try {
          console.log('🔄 [MarketMoversCache] Trying BSE India fallback...');
          stockQuotes = await this.fetchFromBse();
          successProvider = 'bse';
          console.log(`✅ [MarketMoversCache] BSE India succeeded with ${stockQuotes.length} stocks`);
        } catch (bseError) {
          console.warn('⚠️ [MarketMoversCache] BSE India failed:', bseError);
          this.metrics.providers.bse.failureCount++;
          this.metrics.providers.bse.lastFailure = Date.now();
        }
      }

      // Priority 3: Python sidecar/yfinance (datacenter-friendly, NIFTY50 coverage)
      if (stockQuotes.length === 0) {
        try {
          console.log('🔄 [MarketMoversCache] Trying Python/yfinance fallback...');
          stockQuotes = await this.fetchFromPython();
          successProvider = 'python';
          console.log(`✅ [MarketMoversCache] Python/yfinance succeeded with ${stockQuotes.length} stocks`);
        } catch (pyError: any) {
          console.warn('⚠️ [MarketMoversCache] Python/yfinance failed:', pyError?.message || pyError);
          this.metrics.providers.python.failureCount++;
          this.metrics.providers.python.lastFailure = Date.now();
        }
      }

      // Priority 4: Yahoo Finance (last resort, most rate-limited)
      if (stockQuotes.length === 0 && !this.yahooRateLimited) {
        try {
          console.log('🔄 [MarketMoversCache] Trying Yahoo Finance fallback...');
          stockQuotes = await this.fetchFromYahoo();
          successProvider = 'yahoo';
          console.log(`✅ [MarketMoversCache] Yahoo Finance succeeded with ${stockQuotes.length} stocks`);
        } catch (yahooError) {
          console.warn('⚠️ [MarketMoversCache] Yahoo Finance failed:', yahooError);
          this.metrics.providers.yahoo.failureCount++;
          this.metrics.providers.yahoo.lastFailure = Date.now();
        }
      }

      // Priority 5: Finnhub (limited Indian stock coverage)
      if (stockQuotes.length === 0 && this.finnhubProvider.isEnabled()) {
        try {
          console.log('🔄 [MarketMoversCache] Trying Finnhub fallback...');
          stockQuotes = await this.fetchFromFinnhub();
          successProvider = 'finnhub';
          console.log(`✅ [MarketMoversCache] Finnhub succeeded with ${stockQuotes.length} stocks`);
        } catch (finnhubError) {
          console.warn('⚠️ [MarketMoversCache] Finnhub fallback failed:', finnhubError);
          this.metrics.providers.finnhub.failureCount++;
          this.metrics.providers.finnhub.lastFailure = Date.now();
        }
      }

      if (stockQuotes.length === 0) {
        throw new Error('All providers failed to fetch stock data');
      }

      const gainers = stockQuotes
        .filter(stock => stock.changePercent > 0)
        .sort((a, b) => b.changePercent - a.changePercent)
        .slice(0, 5);

      const losers = stockQuotes
        .filter(stock => stock.changePercent < 0)
        .sort((a, b) => a.changePercent - b.changePercent)
        .slice(0, 5);

      this.cache = {
        data: { gainers, losers },
        timestamp: Date.now(),
        isRefreshing: false,
      };

      this.metrics.refreshes++;
      this.metrics.lastRefreshTime = Date.now();
      this.metrics.lastRefreshDuration = Date.now() - startTime;
      this.metrics.lastSuccessfulProvider = successProvider;

      // Save to database for persistence (non-blocking)
      this.saveToDatabase(stockQuotes, successProvider || 'unknown').catch(err => 
        console.warn('⚠️ [MarketMoversCache] Background DB save failed:', err)
      );

      console.log(`✅ [MarketMoversCache] Cache refreshed in ${this.metrics.lastRefreshDuration}ms via ${successProvider} (${stockQuotes.length} stocks)`);
    } catch (error) {
      this.metrics.errors++;
      
      if (this.isRateLimitError(error)) {
        console.warn('⚠️ [MarketMoversCache] Rate limited by all providers');
      } else {
        console.error('❌ [MarketMoversCache] Refresh failed:', error);
      }
      
      if (!this.cache) {
        this.cache = {
          data: FALLBACK_DATA,
          timestamp: Date.now(),
          isRefreshing: false,
        };
        this.metrics.lastSuccessfulProvider = 'static_fallback';
        console.log('📌 [MarketMoversCache] Using fallback data');
      }
    } finally {
      this.refreshLock = false;
    }
  }

  async getMarketMovers(): Promise<{ data: MarketMoversData; cached: boolean; cacheAge: number; provider: string | null }> {
    const now = Date.now();

    if (this.cache) {
      const cacheAge = now - this.cache.timestamp;
      
      if (cacheAge < CACHE_TTL_MS) {
        this.metrics.hits++;
        return { 
          data: this.cache.data, 
          cached: true, 
          cacheAge,
          provider: this.metrics.lastSuccessfulProvider
        };
      }

      if (cacheAge < STALE_TTL_MS) {
        this.metrics.hits++;
        console.log(`📦 [MarketMoversCache] Serving stale cache (age: ${Math.round(cacheAge / 1000)}s)`);
        
        if (!this.refreshLock) {
          this.refreshCache().catch(console.error);
        }
        
        return { 
          data: this.cache.data, 
          cached: true, 
          cacheAge,
          provider: this.metrics.lastSuccessfulProvider
        };
      }
    }

    this.metrics.misses++;
    
    const hasFallback = this.finnhubProvider.isEnabled() || this.nseProvider.isEnabled();
    const cannotFetch = (!this.isInitialized || this.isRateLimited()) && !hasFallback;
    if (cannotFetch) {
      console.log('📌 [MarketMoversCache] Returning fallback data (not initialized or all providers unavailable)');
      if (!this.refreshLock) {
        this.refreshCache().catch(console.error);
      }
      return { 
        data: this.cache?.data || FALLBACK_DATA, 
        cached: false, 
        cacheAge: 0,
        provider: this.cache ? this.metrics.lastSuccessfulProvider : 'static_fallback'
      };
    }

    console.log('🔍 [MarketMoversCache] Cache MISS, fetching fresh data...');

    if (!this.refreshLock) {
      await this.refreshCache();
    } else {
      while (this.refreshLock) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    if (this.cache) {
      return { 
        data: this.cache.data, 
        cached: false, 
        cacheAge: 0,
        provider: this.metrics.lastSuccessfulProvider
      };
    }

    return { 
      data: FALLBACK_DATA, 
      cached: false, 
      cacheAge: 0,
      provider: 'static_fallback'
    };
  }

  getMetrics(): CacheMetrics & { 
    cacheAge: number | null; 
    hitRate: string; 
    isRateLimited: boolean; 
    backoffRemaining: number;
    finnhubEnabled: boolean;
    nseEnabled: boolean;
    yahooRateLimited: boolean;
  } {
    const cacheAge = this.cache ? Date.now() - this.cache.timestamp : null;
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? `${((this.metrics.hits / total) * 100).toFixed(1)}%` : 'N/A';
    const backoffRemaining = Math.max(0, this.metrics.backoffUntil - Date.now());
    
    return {
      ...this.metrics,
      cacheAge,
      hitRate,
      isRateLimited: this.isRateLimited(),
      backoffRemaining,
      finnhubEnabled: this.finnhubProvider.isEnabled(),
      nseEnabled: this.nseProvider.isEnabled(),
      yahooRateLimited: this.yahooRateLimited,
    };
  }
}

export const marketMoversCache = new MarketMoversCache();
