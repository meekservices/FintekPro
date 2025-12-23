import axios from 'axios';

interface NavDataPoint {
  date: string;
  nav: string;
}

interface MFApiResponse {
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
  returns1y: number;
  returns3y: number;
  returns5y: number;
  currentNav: number;
  navDate: string;
  nav1yAgo?: { nav: number; date: string };
  nav3yAgo?: { nav: number; date: string };
  nav5yAgo?: { nav: number; date: string };
}

interface CachedReturns {
  data: CalculatedReturns;
  timestamp: number;
}

class MFApiHistoricalService {
  private readonly MFAPI_BASE_URL = 'https://api.mfapi.in/mf';
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  
  private returnsCache: Map<string, CachedReturns> = new Map();
  private pendingRequests: Map<string, Promise<CalculatedReturns | null>> = new Map();

  private parseDate(dateStr: string): Date {
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }

  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private findClosestNav(navData: NavDataPoint[], targetDate: Date, maxDaysOffset: number = 7): NavDataPoint | null {
    const targetTime = targetDate.getTime();
    
    let closestNav: NavDataPoint | null = null;
    let closestDiff = Infinity;

    for (const point of navData) {
      const pointDate = this.parseDate(point.date);
      const diff = Math.abs(pointDate.getTime() - targetTime);
      
      if (diff < closestDiff && diff <= maxDaysOffset * 24 * 60 * 60 * 1000) {
        closestDiff = diff;
        closestNav = point;
      }
      
      if (pointDate.getTime() < targetTime - maxDaysOffset * 24 * 60 * 60 * 1000) {
        break;
      }
    }

    return closestNav;
  }

  private calculateCAGR(currentNav: number, oldNav: number, years: number): number {
    if (oldNav <= 0 || years <= 0) return 0;
    return (Math.pow(currentNav / oldNav, 1 / years) - 1) * 100;
  }

  async fetchHistoricalNav(schemeCode: string): Promise<MFApiResponse | null> {
    try {
      const response = await axios.get<MFApiResponse>(`${this.MFAPI_BASE_URL}/${schemeCode}`, {
        timeout: this.REQUEST_TIMEOUT,
        headers: {
          'User-Agent': 'FintekPro/1.0',
          'Accept': 'application/json'
        }
      });

      if (response.data?.status === 'SUCCESS' && response.data?.data?.length > 0) {
        return response.data;
      }

      return null;
    } catch (error: any) {
      console.error(`[MFApi] Error fetching historical NAV for ${schemeCode}:`, error.message);
      return null;
    }
  }

  async calculateReturns(schemeCode: string): Promise<CalculatedReturns | null> {
    const cacheKey = schemeCode;
    const now = Date.now();

    const cached = this.returnsCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }

    const pending = this.pendingRequests.get(cacheKey);
    if (pending) {
      return pending;
    }

    const requestPromise = this.doCalculateReturns(schemeCode);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      
      if (result) {
        this.returnsCache.set(cacheKey, {
          data: result,
          timestamp: now
        });
      }
      
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  private async doCalculateReturns(schemeCode: string): Promise<CalculatedReturns | null> {
    const historicalData = await this.fetchHistoricalNav(schemeCode);
    
    if (!historicalData || !historicalData.data || historicalData.data.length === 0) {
      console.warn(`[MFApi] No historical data available for scheme ${schemeCode}`);
      return null;
    }

    const navData = historicalData.data;
    const latestNav = navData[0];
    const currentNav = parseFloat(latestNav.nav);
    const currentDate = this.parseDate(latestNav.date);

    const date1yAgo = new Date(currentDate);
    date1yAgo.setFullYear(date1yAgo.getFullYear() - 1);

    const date3yAgo = new Date(currentDate);
    date3yAgo.setFullYear(date3yAgo.getFullYear() - 3);

    const date5yAgo = new Date(currentDate);
    date5yAgo.setFullYear(date5yAgo.getFullYear() - 5);

    const nav1yAgoPoint = this.findClosestNav(navData, date1yAgo);
    const nav3yAgoPoint = this.findClosestNav(navData, date3yAgo);
    const nav5yAgoPoint = this.findClosestNav(navData, date5yAgo);

    const nav1yAgo = nav1yAgoPoint ? parseFloat(nav1yAgoPoint.nav) : null;
    const nav3yAgo = nav3yAgoPoint ? parseFloat(nav3yAgoPoint.nav) : null;
    const nav5yAgo = nav5yAgoPoint ? parseFloat(nav5yAgoPoint.nav) : null;

    const returns1y = nav1yAgo ? this.calculateCAGR(currentNav, nav1yAgo, 1) : 0;
    const returns3y = nav3yAgo ? this.calculateCAGR(currentNav, nav3yAgo, 3) : 0;
    const returns5y = nav5yAgo ? this.calculateCAGR(currentNav, nav5yAgo, 5) : 0;

    const result: CalculatedReturns = {
      returns1y: Math.round(returns1y * 100) / 100,
      returns3y: Math.round(returns3y * 100) / 100,
      returns5y: Math.round(returns5y * 100) / 100,
      currentNav,
      navDate: latestNav.date,
      ...(nav1yAgoPoint && { nav1yAgo: { nav: nav1yAgo!, date: nav1yAgoPoint.date } }),
      ...(nav3yAgoPoint && { nav3yAgo: { nav: nav3yAgo!, date: nav3yAgoPoint.date } }),
      ...(nav5yAgoPoint && { nav5yAgo: { nav: nav5yAgo!, date: nav5yAgoPoint.date } })
    };

    console.log(`[MFApi] Calculated returns for ${schemeCode}: 1Y=${result.returns1y}%, 3Y=${result.returns3y}%, 5Y=${result.returns5y}%`);

    return result;
  }

  async calculateReturnsBatch(schemeCodes: string[]): Promise<Map<string, CalculatedReturns>> {
    const results = new Map<string, CalculatedReturns>();
    
    const batchSize = 5;
    for (let i = 0; i < schemeCodes.length; i += batchSize) {
      const batch = schemeCodes.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(async (code) => {
          const returns = await this.calculateReturns(code);
          return { code, returns };
        })
      );

      for (const { code, returns } of batchResults) {
        if (returns) {
          results.set(code, returns);
        }
      }

      if (i + batchSize < schemeCodes.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return results;
  }

  getCacheStatus(): { size: number; oldestEntry: number | null } {
    let oldestTimestamp: number | null = null;
    
    for (const [, cached] of this.returnsCache) {
      if (oldestTimestamp === null || cached.timestamp < oldestTimestamp) {
        oldestTimestamp = cached.timestamp;
      }
    }

    return {
      size: this.returnsCache.size,
      oldestEntry: oldestTimestamp ? Date.now() - oldestTimestamp : null
    };
  }

  clearCache(): void {
    this.returnsCache.clear();
    console.log('[MFApi] Cache cleared');
  }

  async warmupCache(schemeCodes: string[]): Promise<number> {
    console.log(`[MFApi] Warming up cache for ${schemeCodes.length} funds...`);
    const results = await this.calculateReturnsBatch(schemeCodes);
    console.log(`[MFApi] Cache warmed with ${results.size} funds`);
    return results.size;
  }
}

export const mfApiHistoricalService = new MFApiHistoricalService();
