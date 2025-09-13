import axios from 'axios';
import { FundExtended, FundCore, FundPerformance, Provenance, NAVRecord, FundSearchParams, FundListResponse, SourceStatus, MultiSourceStatus } from '@shared/schema';

// Cache configuration
interface CacheConfig {
  schemes: { ttl: number; data: Map<string, { fund: FundExtended; timestamp: number }> };
  nav: { ttl: number; data: Map<string, { nav: string; timestamp: number }> };
  historical: { ttl: number; data: Map<string, { records: NAVRecord[]; timestamp: number }> };
  popular: { ttl: number; data: { funds: FundExtended[]; timestamp: number } | null };
}

// Source health monitoring
interface SourceHealth {
  isHealthy: boolean;
  lastSuccess?: string;
  lastError?: string;
  latencyMs?: number;
  errorRate: number;
  consecutiveFailures: number;
}

export class MultiSourceMFService {
  private cache: CacheConfig;
  private sourceHealth: Map<string, SourceHealth>;
  private readonly CACHE_TTL = {
    SCHEMES: 24 * 60 * 60 * 1000, // 24 hours
    NAV: 5 * 60 * 1000, // 5 minutes
    HISTORICAL: 24 * 60 * 60 * 1000, // 24 hours
    POPULAR: 30 * 60 * 1000, // 30 minutes
  };
  
  private readonly TIMEOUT = 15000; // 15 seconds
  private readonly MAX_RETRIES = 2;

  constructor() {
    this.cache = {
      schemes: { ttl: this.CACHE_TTL.SCHEMES, data: new Map() },
      nav: { ttl: this.CACHE_TTL.NAV, data: new Map() },
      historical: { ttl: this.CACHE_TTL.HISTORICAL, data: new Map() },
      popular: { ttl: this.CACHE_TTL.POPULAR, data: null },
    };
    
    this.sourceHealth = new Map([
      ['AMFI', { isHealthy: true, errorRate: 0, consecutiveFailures: 0 }],
      ['MFAPI', { isHealthy: true, errorRate: 0, consecutiveFailures: 0 }],
      ['CaptNemo', { isHealthy: true, errorRate: 0, consecutiveFailures: 0 }],
      ['RapidAPI', { isHealthy: true, errorRate: 0, consecutiveFailures: 0 }],
    ]);
  }

  // ===== PUBLIC METHODS =====

  /**
   * Get fund details with fallback chain
   */
  async getFund(schemeCode: string): Promise<FundExtended | null> {
    const cacheKey = schemeCode;
    const cached = this.cache.schemes.data.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cache.schemes.ttl) {
      return cached.fund;
    }

    const sources = this.getOrderedSources();
    let lastError: Error | null = null;
    const sourceChain: string[] = [];

    for (const source of sources) {
      try {
        sourceChain.push(source);
        const startTime = Date.now();
        
        const fund = await this.fetchFromSource(source, 'fund', schemeCode);
        if (fund) {
          const latency = Date.now() - startTime;
          this.updateSourceHealth(source, true, latency);
          
          const fundWithProvenance: FundExtended = {
            ...fund,
            provenance: {
              primarySource: source as any,
              sourceChain,
              lastRefreshed: new Date().toISOString(),
              dataVersion: this.generateDataVersion(fund)
            }
          };

          // Cache successful result
          this.cache.schemes.data.set(cacheKey, {
            fund: fundWithProvenance,
            timestamp: Date.now()
          });

          return fundWithProvenance;
        }
      } catch (error) {
        lastError = error as Error;
        this.updateSourceHealth(source, false);
        console.warn(`Source ${source} failed for fund ${schemeCode}:`, error);
      }
    }

    throw new Error(`All sources failed for fund ${schemeCode}. Last error: ${lastError?.message}`);
  }

  /**
   * Search funds across sources
   */
  async searchFunds(query: string): Promise<FundExtended[]> {
    const sources = this.getOrderedSources();
    
    for (const source of sources) {
      try {
        const funds = await this.fetchFromSource(source, 'search', query);
        if (funds && funds.length > 0) {
          return funds.map((fund: any) => ({
            ...fund,
            provenance: {
              primarySource: source as any,
              sourceChain: [source],
              lastRefreshed: new Date().toISOString(),
              dataVersion: this.generateDataVersion(fund)
            }
          }));
        }
      } catch (error) {
        this.updateSourceHealth(source, false);
        console.warn(`Search failed for source ${source}:`, error);
      }
    }

    return [];
  }

  /**
   * Get popular funds with enhanced performance data
   */
  async getPopularFunds(): Promise<FundExtended[]> {
    const cached = this.cache.popular.data;
    
    if (cached && Date.now() - cached.timestamp < this.cache.popular.ttl) {
      return cached.funds;
    }

    const sources = this.getOrderedSources();
    
    for (const source of sources) {
      try {
        const funds = await this.fetchFromSource(source, 'popular');
        if (funds && funds.length > 0) {
          const enrichedFunds = await Promise.all(
            funds.map(async (fund: any) => {
              try {
                const performance = await this.enrichWithPerformance(fund, source);
                return {
                  ...fund,
                  ...performance,
                  provenance: {
                    primarySource: source as any,
                    sourceChain: [source],
                    lastRefreshed: new Date().toISOString(),
                    dataVersion: this.generateDataVersion(fund)
                  }
                } as FundExtended;
              } catch (error) {
                console.warn(`Failed to enrich fund ${fund.schemeCode}:`, error);
                return {
                  ...fund,
                  currentNav: fund.currentNav || '0',
                  navDate: new Date().toISOString(),
                  returns: {},
                  returnStrings: {},
                  provenance: {
                    primarySource: source as any,
                    sourceChain: [source],
                    lastRefreshed: new Date().toISOString(),
                    dataVersion: this.generateDataVersion(fund)
                  }
                } as FundExtended;
              }
            })
          );

          // Cache successful result
          this.cache.popular.data = {
            funds: enrichedFunds,
            timestamp: Date.now()
          };

          return enrichedFunds;
        }
      } catch (error) {
        this.updateSourceHealth(source, false);
        console.warn(`Popular funds failed for source ${source}:`, error);
      }
    }

    return [];
  }

  /**
   * Get paginated fund list
   */
  async listFunds(params: FundSearchParams = {}): Promise<FundListResponse> {
    const { page = 1, limit = 50, query, category, fundHouse, sortBy = 'name', sortOrder = 'asc' } = params;
    
    try {
      let funds: FundExtended[];
      
      if (query) {
        funds = await this.searchFunds(query);
      } else {
        funds = await this.getPopularFunds();
      }

      // Apply filters
      if (category) {
        funds = funds.filter(f => f.category?.toLowerCase().includes(category.toLowerCase()));
      }
      if (fundHouse) {
        funds = funds.filter(f => f.fundHouse?.toLowerCase().includes(fundHouse.toLowerCase()));
      }

      // Apply sorting
      funds.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'nav':
            comparison = parseFloat(a.currentNav || '0') - parseFloat(b.currentNav || '0');
            break;
          case 'returns1Y':
            comparison = (a.returns?.['1Y'] || 0) - (b.returns?.['1Y'] || 0);
            break;
          case 'returns3Y':
            comparison = (a.returns?.['3Y'] || 0) - (b.returns?.['3Y'] || 0);
            break;
          case 'returns5Y':
            comparison = (a.returns?.['5Y'] || 0) - (b.returns?.['5Y'] || 0);
            break;
          default:
            comparison = (a.schemeName || '').localeCompare(b.schemeName || '');
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });

      // Apply pagination
      const total = funds.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedFunds = funds.slice(startIndex, endIndex);

      return {
        funds: paginatedFunds,
        total,
        page,
        limit,
        hasMore: endIndex < total
      };
    } catch (error) {
      console.error('Error listing funds:', error);
      return {
        funds: [],
        total: 0,
        page,
        limit,
        hasMore: false
      };
    }
  }

  /**
   * Get source health status
   */
  getSourcesStatus(): MultiSourceStatus {
    const sources: SourceStatus[] = Array.from(this.sourceHealth.entries()).map(([source, health]) => ({
      source,
      isHealthy: health.isHealthy,
      lastSuccess: health.lastSuccess,
      lastError: health.lastError,
      latencyMs: health.latencyMs,
      errorRate: health.errorRate
    }));

    const healthySources = sources.filter(s => s.isHealthy).length;
    const totalSources = sources.length;
    
    let overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    if (healthySources === totalSources) {
      overallHealth = 'healthy';
    } else if (healthySources > totalSources / 2) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'unhealthy';
    }

    return {
      sources,
      lastUpdated: new Date().toISOString(),
      overallHealth
    };
  }

  // ===== PRIVATE METHODS =====

  /**
   * Get sources ordered by health and priority
   */
  private getOrderedSources(): string[] {
    const allSources = ['AMFI', 'MFAPI', 'CaptNemo', 'RapidAPI'];
    
    return allSources.filter(source => {
      const health = this.sourceHealth.get(source);
      return health ? health.consecutiveFailures < 3 : true;
    });
  }

  /**
   * Fetch data from specific source
   */
  private async fetchFromSource(source: string, type: 'fund' | 'search' | 'popular', param?: string): Promise<any> {
    const baseUrls = {
      AMFI: 'https://www.amfiindia.com/spages/NAVAll.txt',
      MFAPI: 'https://api.mfapi.in/mf',
      CaptNemo: 'https://api.kuvera.in/api/v4/fund_schemes.json',
      RapidAPI: 'https://latest-mutual-fund-nav.p.rapidapi.com'
    };

    switch (source) {
      case 'AMFI':
        return this.fetchFromAMFI(type, param);
      case 'MFAPI':
        return this.fetchFromMFAPI(type, param);
      case 'CaptNemo':
        return this.fetchFromCaptNemo(type, param);
      case 'RapidAPI':
        return this.fetchFromRapidAPI(type, param);
      default:
        throw new Error(`Unknown source: ${source}`);
    }
  }

  /**
   * Fetch from AMFI
   */
  private async fetchFromAMFI(type: string, param?: string): Promise<any> {
    // AMFI provides NAV data in text format
    // This is a simplified implementation - would need proper AMFI parsing
    throw new Error('AMFI source not implemented yet');
  }

  /**
   * Fetch from MFAPI.in
   */
  private async fetchFromMFAPI(type: string, param?: string): Promise<any> {
    const baseUrl = 'https://api.mfapi.in/mf';
    
    try {
      let url: string;
      switch (type) {
        case 'fund':
          url = `${baseUrl}/${param}`;
          break;
        case 'search':
          // Use search endpoint with query parameter
          url = `${baseUrl}/search?q=${encodeURIComponent(param || '')}`;
          break;
        case 'popular':
          // Use top 10 popular fund codes as fallback since /popular doesn't exist
          const popularCodes = ['118825', '119533', '120503', '118777', '120505', '119551', '120487', '119554', '100314', '119548'];
          const fundPromises = popularCodes.map(code => this.fetchFromMFAPI('fund', code).catch(() => null));
          const funds = await Promise.all(fundPromises);
          return funds.filter(fund => fund !== null);
        default:
          throw new Error(`Unsupported type: ${type}`);
      }

      const response = await axios.get(url, {
        timeout: this.TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (type === 'fund') {
        return this.normalizeMFAPIFund(response.data);
      } else if (type === 'search') {
        return Array.isArray(response.data) ? response.data.map((fund: any) => this.normalizeMFAPIFund(fund)) : [];
      } else {
        return response.data.map((fund: any) => this.normalizeMFAPIFund(fund));
      }
    } catch (error) {
      throw new Error(`MFAPI request failed: ${error}`);
    }
  }

  /**
   * Fetch from CaptNemo/Kuvera
   */
  private async fetchFromCaptNemo(type: string, param?: string): Promise<any> {
    // CaptNemo/Kuvera API implementation
    throw new Error('CaptNemo source not implemented yet');
  }

  /**
   * Fetch from RapidAPI
   */
  private async fetchFromRapidAPI(type: string, param?: string): Promise<any> {
    // RapidAPI implementation
    throw new Error('RapidAPI source not implemented yet');
  }

  /**
   * Normalize MFAPI fund data to our schema
   */
  private normalizeMFAPIFund(data: any): FundExtended {
    return {
      schemeCode: data.schemeCode || data.id?.toString() || '',
      schemeName: data.schemeName || data.name || '',
      fundHouse: data.fundHouse || '',
      category: data.category || '',
      currentNav: data.nav || data.currentNav || '0',
      navDate: data.date || new Date().toISOString(),
      returns: {},
      returnStrings: {},
      provenance: {
        primarySource: 'MFAPI',
        sourceChain: ['MFAPI'],
        lastRefreshed: new Date().toISOString()
      }
    };
  }

  /**
   * Enrich fund with performance data and CAGR calculations
   */
  private async enrichWithPerformance(fund: any, source: string): Promise<FundPerformance> {
    try {
      // Get historical NAV data for CAGR calculations
      const historicalData = await this.getHistoricalNAV(fund.schemeCode, source);
      const currentNav = parseFloat(fund.currentNav || fund.nav || '0');
      
      if (historicalData.length === 0 || currentNav === 0) {
        return {
          currentNav: fund.currentNav || fund.nav || '0',
          navDate: fund.navDate || fund.date || new Date().toISOString(),
          returns: {},
          returnStrings: {}
        };
      }

      const returns = this.calculateCAGRReturns(historicalData, currentNav);
      const returnStrings = this.formatReturns(returns);

      return {
        currentNav: fund.currentNav || fund.nav || '0',
        navDate: fund.navDate || fund.date || new Date().toISOString(),
        returns,
        returnStrings
      };
    } catch (error) {
      console.warn(`Failed to enrich performance for ${fund.schemeCode}:`, error);
      return {
        currentNav: fund.currentNav || fund.nav || '0',
        navDate: fund.navDate || fund.date || new Date().toISOString(),
        returns: {},
        returnStrings: {}
      };
    }
  }

  /**
   * Get historical NAV data
   */
  private async getHistoricalNAV(schemeCode: string, source: string): Promise<NAVRecord[]> {
    const cacheKey = `${source}-${schemeCode}`;
    const cached = this.cache.historical.data.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cache.historical.ttl) {
      return cached.records;
    }

    try {
      let records: NAVRecord[] = [];
      
      if (source === 'MFAPI') {
        // Fetch complete historical data from MFAPI
        const response = await axios.get(`https://api.mfapi.in/mf/${schemeCode}`, {
          timeout: this.TIMEOUT,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.data && response.data.data && Array.isArray(response.data.data)) {
          records = response.data.data.map((item: any) => ({
            date: item.date,
            nav: item.nav
          })).filter((record: NAVRecord) => record.date && record.nav);
          
          // Sort by date descending (most recent first)
          records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
      }
      
      // Cache the results
      this.cache.historical.data.set(cacheKey, {
        records,
        timestamp: Date.now()
      });
      
      return records;
    } catch (error) {
      console.warn(`Failed to fetch historical NAV for ${schemeCode} from ${source}:`, error);
      return [];
    }
  }

  /**
   * Calculate CAGR returns for different periods
   */
  private calculateCAGRReturns(historicalData: NAVRecord[], currentNav: number): Record<string, number> {
    const returns: Record<string, number> = {};
    const periods = { '1M': 30, '6M': 180, '1Y': 365, '3Y': 1095, '5Y': 1825 };
    
    const currentDate = new Date();
    
    for (const [period, days] of Object.entries(periods)) {
      const targetDate = new Date(currentDate.getTime() - days * 24 * 60 * 60 * 1000);
      
      // Find closest historical NAV
      const historicalNAV = this.findClosestNAV(historicalData, targetDate);
      
      if (historicalNAV) {
        const pastNav = parseFloat(historicalNAV.nav);
        if (pastNav > 0) {
          if (period === '1M' || period === '6M') {
            // Simple return for shorter periods
            returns[period] = ((currentNav - pastNav) / pastNav) * 100;
          } else {
            // CAGR for longer periods
            const years = days / 365;
            returns[period] = (Math.pow(currentNav / pastNav, 1 / years) - 1) * 100;
          }
        }
      }
    }
    
    return returns;
  }

  /**
   * Find closest historical NAV to target date
   */
  private findClosestNAV(historicalData: NAVRecord[], targetDate: Date): NAVRecord | null {
    if (historicalData.length === 0) return null;
    
    let closest = historicalData[0];
    let closestDiff = Math.abs(new Date(closest.date).getTime() - targetDate.getTime());
    
    for (const record of historicalData) {
      const diff = Math.abs(new Date(record.date).getTime() - targetDate.getTime());
      if (diff < closestDiff) {
        closest = record;
        closestDiff = diff;
      }
    }
    
    return closest;
  }

  /**
   * Format returns for display
   */
  private formatReturns(returns: Record<string, number>): Record<string, string> {
    const formatted: Record<string, string> = {};
    
    for (const [period, value] of Object.entries(returns)) {
      if (value !== undefined && !isNaN(value)) {
        formatted[period] = `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
      }
    }
    
    return formatted;
  }

  /**
   * Update source health status
   */
  private updateSourceHealth(source: string, success: boolean, latency?: number): void {
    const health = this.sourceHealth.get(source);
    if (!health) return;

    if (success) {
      health.isHealthy = true;
      health.lastSuccess = new Date().toISOString();
      health.consecutiveFailures = 0;
      if (latency) health.latencyMs = latency;
    } else {
      health.consecutiveFailures++;
      health.lastError = new Date().toISOString();
      if (health.consecutiveFailures >= 3) {
        health.isHealthy = false;
      }
    }

    this.sourceHealth.set(source, health);
  }

  /**
   * Generate data version for provenance
   */
  private generateDataVersion(fund: any): string {
    const hash = JSON.stringify(fund).length.toString(36);
    return `v${Date.now().toString(36)}-${hash}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.schemes.data.clear();
    this.cache.nav.data.clear();
    this.cache.historical.data.clear();
    this.cache.popular.data = null;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalCount: number; staleCount: number; lastUpdated: Date } {
    const now = Date.now();
    const schemesCount = this.cache.schemes.data.size;
    const staleSchemes = Array.from(this.cache.schemes.data.values())
      .filter(entry => now - entry.timestamp > this.cache.schemes.ttl).length;
    
    return {
      totalCount: schemesCount,
      staleCount: staleSchemes,
      lastUpdated: new Date()
    };
  }
}

// Singleton instance
export const multiSourceMFService = new MultiSourceMFService();