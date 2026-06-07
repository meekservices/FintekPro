import { db } from '../db';
import { reits, invits } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

interface ReitInvitQuote {
  symbol: string;
  name: string;
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  weekHigh52: number;
  weekLow52: number;
  marketCap: number;
  volume: number;
  nav?: number;
  distributionYield?: number;
  lastDividend?: number;
  lastUpdated: Date;
}

interface RefreshResult {
  symbol: string;
  success: boolean;
  error?: string;
  priceUpdated?: boolean;
  oldPrice?: number;
  newPrice?: number;
}


class NseReitInvitProvider {
  private readonly baseUrl = 'https://www.nseindia.com/api';
  private cookies: string = '';
  private cookiesExpiry: number = 0;

  private async refreshCookies(): Promise<void> {
    if (Date.now() < this.cookiesExpiry) {
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch('https://www.nseindia.com', {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-IN,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
        },
      });
      clearTimeout(timeout);

      const setCookieHeaders = response.headers.get('set-cookie');
      if (setCookieHeaders) {
        this.cookies = setCookieHeaders.split(',').map(c => c.split(';')[0]).join('; ');
        this.cookiesExpiry = Date.now() + 5 * 60 * 1000;
      }
    } catch (error) {
      console.warn('⚠️ [NseReitInvitProvider] Failed to refresh cookies:', (error as Error).message);
    }
  }

  async fetchQuote(symbol: string): Promise<ReitInvitQuote | null> {
    try {
      await this.refreshCookies();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${this.baseUrl}/quote-equity?symbol=${encodeURIComponent(symbol)}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-IN,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cookie': this.cookies,
          'Referer': 'https://www.nseindia.com/get-quotes/equity?symbol=' + encodeURIComponent(symbol),
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
          'X-Requested-With': 'XMLHttpRequest',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`⚠️ [NseReitInvitProvider] Rate limited for ${symbol}, will retry next cycle`);
          return null;
        }
        if (response.status === 403) {
          // Session expired — force cookie refresh next time
          this.cookiesExpiry = 0;
          this.cookies = '';
          console.warn(`⚠️ [NseReitInvitProvider] 403 for ${symbol} — session reset, Yahoo fallback will be used`);
          return null;
        }
        console.warn(`⚠️ [NseReitInvitProvider] HTTP ${response.status} for ${symbol}`);
        return null;
      }

      const data = await response.json();
      
      if (!data?.priceInfo) {
        return null;
      }

      return {
        symbol: data.info?.symbol || symbol,
        name: data.info?.companyName || symbol,
        currentPrice: parseFloat(data.priceInfo.lastPrice) || 0,
        previousClose: parseFloat(data.priceInfo.previousClose) || 0,
        change: parseFloat(data.priceInfo.change) || 0,
        changePercent: parseFloat(data.priceInfo.pChange) || 0,
        weekHigh52: parseFloat(data.priceInfo.weekHighLow?.max) || 0,
        weekLow52: parseFloat(data.priceInfo.weekHighLow?.min) || 0,
        marketCap: 0,
        volume: parseInt(data.priceInfo.totalTradedVolume) || 0,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.warn(`⚠️ [NseReitInvitProvider] Error fetching ${symbol}:`, (error as Error).message);
      return null;
    }
  }
}

class YahooFinanceProvider {
  private crumb: string = '';
  private cookies: string = '';
  private crumbExpiry: number = 0;

  private async refreshCrumb(): Promise<boolean> {
    if (Date.now() < this.crumbExpiry && this.crumb) {
      return true;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch('https://finance.yahoo.com/quote/AAPL', {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      });
      clearTimeout(timeout);

      const setCookieHeaders = response.headers.get('set-cookie');
      if (setCookieHeaders) {
        this.cookies = setCookieHeaders.split(',').map(c => c.split(';')[0]).join('; ');
      }

      const crumbController = new AbortController();
      const crumbTimeout = setTimeout(() => crumbController.abort(), 8000);
      const crumbResponse = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
        signal: crumbController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Cookie': this.cookies,
          'Accept': 'text/plain, */*',
          'Referer': 'https://finance.yahoo.com/',
        },
      });
      clearTimeout(crumbTimeout);

      if (crumbResponse.ok) {
        this.crumb = await crumbResponse.text();
        this.crumbExpiry = Date.now() + 60 * 60 * 1000;
        return true;
      }
      return false;
    } catch (error) {
      console.warn('⚠️ [YahooFinanceProvider] Failed to refresh crumb:', (error as Error).message);
      return false;
    }
  }

  async fetchQuote(symbol: string): Promise<ReitInvitQuote | null> {
    try {
      const yahooSymbol = symbol.endsWith('.NS') ? symbol : `${symbol}.NS`;
      
      await this.refreshCrumb();

      const response = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbol)}&crumb=${this.crumb}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': this.cookies,
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const quote = data?.quoteResponse?.result?.[0];

      if (!quote) {
        return null;
      }

      return {
        symbol: symbol,
        name: quote.shortName || quote.longName || symbol,
        currentPrice: quote.regularMarketPrice || 0,
        previousClose: quote.regularMarketPreviousClose || 0,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        weekHigh52: quote.fiftyTwoWeekHigh || 0,
        weekLow52: quote.fiftyTwoWeekLow || 0,
        marketCap: quote.marketCap || 0,
        volume: quote.regularMarketVolume || 0,
        distributionYield: quote.trailingAnnualDividendYield ? quote.trailingAnnualDividendYield * 100 : undefined,
        lastDividend: quote.trailingAnnualDividendRate,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.warn(`⚠️ [YahooFinanceProvider] Error fetching ${symbol}:`, error);
      return null;
    }
  }
}

class ReitInvitDataService {
  private nseProvider: NseReitInvitProvider;
  private yahooProvider: YahooFinanceProvider;
  private lastRefreshTime: Date | null = null;
  private isRefreshing: boolean = false;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.nseProvider = new NseReitInvitProvider();
    this.yahooProvider = new YahooFinanceProvider();
    console.log('✅ REIT/InvIT Data Service initialized');
  }

  async fetchQuote(symbol: string): Promise<ReitInvitQuote | null> {
    let quote = await this.nseProvider.fetchQuote(symbol);
    
    if (!quote || quote.currentPrice === 0) {
      console.log(`🔄 [ReitInvitDataService] NSE failed for ${symbol}, trying Yahoo Finance...`);
      quote = await this.yahooProvider.fetchQuote(symbol);
    }

    return quote;
  }

  async refreshReit(symbol: string): Promise<RefreshResult> {
    try {
      const [existingReit] = await db.select().from(reits).where(eq(reits.symbol, symbol));
      
      if (!existingReit) {
        return { symbol, success: false, error: 'REIT not found in database' };
      }

      const quote = await this.fetchQuote(symbol);
      
      if (!quote || quote.currentPrice === 0) {
        return { symbol, success: false, error: 'Failed to fetch price data' };
      }

      const oldPrice = parseFloat(existingReit.currentPrice?.toString() || '0');
      
      await db.update(reits)
        .set({
          currentPrice: quote.currentPrice.toString(),
          weekHigh52: quote.weekHigh52 > 0 ? quote.weekHigh52.toString() : existingReit.weekHigh52,
          weekLow52: quote.weekLow52 > 0 ? quote.weekLow52.toString() : existingReit.weekLow52,
          marketCap: quote.marketCap > 0 ? quote.marketCap.toString() : existingReit.marketCap,
          distributionYield: quote.distributionYield ? quote.distributionYield.toString() : existingReit.distributionYield,
          lastDividend: quote.lastDividend ? quote.lastDividend.toString() : existingReit.lastDividend,
          lastUpdated: new Date(),
        })
        .where(eq(reits.id, existingReit.id));

      return {
        symbol,
        success: true,
        priceUpdated: oldPrice !== quote.currentPrice,
        oldPrice,
        newPrice: quote.currentPrice,
      };
    } catch (error) {
      console.error(`❌ [ReitInvitDataService] Error refreshing REIT ${symbol}:`, error);
      return { symbol, success: false, error: String(error) };
    }
  }

  async refreshInvit(symbol: string): Promise<RefreshResult> {
    try {
      const [existingInvit] = await db.select().from(invits).where(eq(invits.symbol, symbol));
      
      if (!existingInvit) {
        return { symbol, success: false, error: 'InvIT not found in database' };
      }

      const quote = await this.fetchQuote(symbol);
      
      if (!quote || quote.currentPrice === 0) {
        return { symbol, success: false, error: 'Failed to fetch price data' };
      }

      const oldPrice = parseFloat(existingInvit.currentPrice?.toString() || '0');
      
      await db.update(invits)
        .set({
          currentPrice: quote.currentPrice.toString(),
          weekHigh52: quote.weekHigh52 > 0 ? quote.weekHigh52.toString() : existingInvit.weekHigh52,
          weekLow52: quote.weekLow52 > 0 ? quote.weekLow52.toString() : existingInvit.weekLow52,
          marketCap: quote.marketCap > 0 ? quote.marketCap.toString() : existingInvit.marketCap,
          distributionYield: quote.distributionYield ? quote.distributionYield.toString() : existingInvit.distributionYield,
          lastDividend: quote.lastDividend ? quote.lastDividend.toString() : existingInvit.lastDividend,
          lastUpdated: new Date(),
        })
        .where(eq(invits.id, existingInvit.id));

      return {
        symbol,
        success: true,
        priceUpdated: oldPrice !== quote.currentPrice,
        oldPrice,
        newPrice: quote.currentPrice,
      };
    } catch (error) {
      console.error(`❌ [ReitInvitDataService] Error refreshing InvIT ${symbol}:`, error);
      return { symbol, success: false, error: String(error) };
    }
  }

  async refreshAllReits(): Promise<{ total: number; success: number; failed: number; results: RefreshResult[] }> {
    const allReits = await db.select({ symbol: reits.symbol }).from(reits);
    const results: RefreshResult[] = [];

    for (const reit of allReits) {
      const result = await this.refreshReit(reit.symbol);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const success = results.filter(r => r.success).length;
    return {
      total: allReits.length,
      success,
      failed: allReits.length - success,
      results,
    };
  }

  async refreshAllInvits(): Promise<{ total: number; success: number; failed: number; results: RefreshResult[] }> {
    const allInvits = await db.select({ symbol: invits.symbol }).from(invits);
    const results: RefreshResult[] = [];

    for (const invit of allInvits) {
      const result = await this.refreshInvit(invit.symbol);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const success = results.filter(r => r.success).length;
    return {
      total: allInvits.length,
      success,
      failed: allInvits.length - success,
      results,
    };
  }

  async refreshAll(): Promise<{
    reits: { total: number; success: number; failed: number };
    invits: { total: number; success: number; failed: number };
    duration: number;
    lastRefreshTime: Date;
  }> {
    if (this.isRefreshing) {
      throw new Error('Refresh already in progress');
    }

    this.isRefreshing = true;
    const startTime = Date.now();

    try {
      console.log('🔄 [ReitInvitDataService] Starting full refresh...');
      
      const reitResults = await this.refreshAllReits();
      const invitResults = await this.refreshAllInvits();

      this.lastRefreshTime = new Date();
      const duration = Date.now() - startTime;

      console.log(`✅ [ReitInvitDataService] Refresh complete in ${duration}ms`);
      console.log(`   REITs: ${reitResults.success}/${reitResults.total} updated`);
      console.log(`   InvITs: ${invitResults.success}/${invitResults.total} updated`);

      return {
        reits: {
          total: reitResults.total,
          success: reitResults.success,
          failed: reitResults.failed,
        },
        invits: {
          total: invitResults.total,
          success: invitResults.success,
          failed: invitResults.failed,
        },
        duration,
        lastRefreshTime: this.lastRefreshTime,
      };
    } finally {
      this.isRefreshing = false;
    }
  }

  startScheduledRefresh(intervalHours: number = 6): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    console.log(`📅 [ReitInvitDataService] Scheduled refresh every ${intervalHours} hours`);

    const isMarketHoursIST = (): boolean => {
      const now = new Date();
      // IST = UTC+5:30
      const istOffset = 5.5 * 60; // minutes
      const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
      const istMinutes = (utcMinutes + istOffset) % (24 * 60);
      const istHour = Math.floor(istMinutes / 60);
      const istMin = istMinutes % 60;
      const istTimeMinutes = istHour * 60 + istMin;
      const dayOfWeek = new Date(now.getTime() + istOffset * 60000).getUTCDay(); // 0=Sun, 6=Sat
      // Market hours: Mon-Fri, 9:15 AM to 4:00 PM IST (extended slightly for post-market data)
      const marketOpen = 9 * 60 + 15;   // 9:15 IST
      const marketClose = 16 * 60;       // 16:00 IST
      return dayOfWeek >= 1 && dayOfWeek <= 5 && istTimeMinutes >= marketOpen && istTimeMinutes <= marketClose;
    };
    
    this.refreshInterval = setInterval(async () => {
      if (!isMarketHoursIST()) {
        console.log('⏭️ [ReitInvitDataService] Skipping refresh — outside NSE market hours');
        return;
      }
      try {
        await this.refreshAll();
      } catch (error) {
        console.error('❌ [ReitInvitDataService] Scheduled refresh failed:', error);
      }
    }, intervalMs);

    // Only do initial refresh if within market hours
    setTimeout(async () => {
      if (!isMarketHoursIST()) {
        console.log('⏭️ [ReitInvitDataService] Skipping initial refresh — outside NSE market hours');
        return;
      }
      try {
        await this.refreshAll();
      } catch (error) {
        console.error('❌ [ReitInvitDataService] Initial refresh failed:', error);
      }
    }, 30000);
  }

  stopScheduledRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      console.log('⏹️ [ReitInvitDataService] Scheduled refresh stopped');
    }
  }

  getStatus(): {
    isRefreshing: boolean;
    lastRefreshTime: Date | null;
    scheduledRefreshActive: boolean;
  } {
    return {
      isRefreshing: this.isRefreshing,
      lastRefreshTime: this.lastRefreshTime,
      scheduledRefreshActive: this.refreshInterval !== null,
    };
  }

  async getKnownReits(): Promise<Array<{ symbol: string; name: string; isin: string | null }>> {
    const allReits = await db.select({
      symbol: reits.symbol,
      name: reits.name,
      isin: reits.isinCode,
    }).from(reits);
    return allReits;
  }

  async getKnownInvits(): Promise<Array<{ symbol: string; name: string; isin: string | null }>> {
    const allInvits = await db.select({
      symbol: invits.symbol,
      name: invits.name,
      isin: invits.isinCode,
    }).from(invits);
    return allInvits;
  }
}

export const reitInvitDataService = new ReitInvitDataService();
export type { ReitInvitQuote, RefreshResult };
