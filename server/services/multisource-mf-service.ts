import axios from 'axios';
import { FundExtended, FundCore, FundPerformance, Provenance, NAVRecord, FundSearchParams, FundListResponse, SourceStatus, MultiSourceStatus } from '@shared/schema';
import CrisilService, { CrisilAnalysis } from './crisil-service';
import type { IStorage } from '../storage';

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
  private storage: IStorage;
  private readonly CACHE_TTL = {
    SCHEMES: 24 * 60 * 60 * 1000, // 24 hours
    NAV: 5 * 60 * 1000, // 5 minutes
    HISTORICAL: 24 * 60 * 60 * 1000, // 24 hours
    POPULAR: 30 * 60 * 1000, // 30 minutes
  };
  
  private readonly TIMEOUT = 15000; // 15 seconds
  private readonly MAX_RETRIES = 2;
  private readonly DB_FIRST = true; // Use database as primary source

  constructor(storage: IStorage) {
    this.storage = storage;
    this.cache = {
      schemes: { ttl: this.CACHE_TTL.SCHEMES, data: new Map() },
      nav: { ttl: this.CACHE_TTL.NAV, data: new Map() },
      historical: { ttl: this.CACHE_TTL.HISTORICAL, data: new Map() },
      popular: { ttl: this.CACHE_TTL.POPULAR, data: null },
    };
    
    this.sourceHealth = new Map([
      ['AMFI', { isHealthy: true, errorRate: 0, consecutiveFailures: 0 }],
      ['MFAPI', { isHealthy: true, errorRate: 0, consecutiveFailures: 0 }],
      ['CRISIL', { isHealthy: true, errorRate: 0, consecutiveFailures: 0 }],
    ]);
  }

  // ===== PUBLIC METHODS =====

  /**
   * Get fund details with database-first approach
   */
  async getFund(schemeCode: string): Promise<FundExtended | null> {
    // Check memory cache first
    const cacheKey = schemeCode;
    const cached = this.cache.schemes.data.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cache.schemes.ttl) {
      return cached.fund;
    }

    // Check database if DB_FIRST is enabled
    if (this.DB_FIRST) {
      try {
        const dbFund = await this.storage.getMutualFund(schemeCode);
        if (dbFund && dbFund.lastUpdated) {
          const age = Date.now() - new Date(dbFund.lastUpdated).getTime();
          // Use DB data if less than 6 hours old
          if (age < 6 * 60 * 60 * 1000) {
            const fundExtended = this.convertDbToExtended(dbFund);
            // Cache it
            this.cache.schemes.data.set(cacheKey, {
              fund: fundExtended,
              timestamp: Date.now()
            });
            return fundExtended;
          }
        }
      } catch (error) {
        console.warn(`Database lookup failed for ${schemeCode}:`, error);
      }
    }

    // Fallback to external sources
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
          
          let fundWithProvenance: FundExtended = {
            ...fund,
            provenance: {
              primarySource: source as any,
              sourceChain,
              lastRefreshed: new Date().toISOString(),
              dataVersion: this.generateDataVersion(fund)
            }
          };

          // Enrich with CRISIL rating
          try {
            fundWithProvenance = await this.enrichWithCrisilRating(fundWithProvenance);
          } catch (error) {
            console.warn(`Failed to enrich fund ${fundWithProvenance.schemeCode} with CRISIL rating:`, error);
          }

          // Save to database
          try {
            await this.saveFundToDatabase(fundWithProvenance);
          } catch (error) {
            console.warn(`Failed to save fund ${schemeCode} to database:`, error);
          }

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
   * Get best performing funds based on returns
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
          console.log(`✅ Successfully fetched ${funds.length} popular funds from ${source}`);
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

          // Enrich with CRISIL ratings
          let crisilEnrichedFunds: FundExtended[];
          try {
            crisilEnrichedFunds = await this.enrichFundsWithCrisil(enrichedFunds);
          } catch (error) {
            console.warn('Failed to enrich funds with CRISIL ratings:', error);
            crisilEnrichedFunds = enrichedFunds; // Fallback to original enriched funds
          }

          // Sort by best performance (1Y returns descending, then 3Y returns)
          const sortedFunds = crisilEnrichedFunds.sort((a, b) => {
            const aReturns1Y = a.returns?.['1Y'] || 0;
            const bReturns1Y = b.returns?.['1Y'] || 0;
            
            // First sort by 1Y returns
            if (aReturns1Y !== bReturns1Y) {
              return bReturns1Y - aReturns1Y; // Descending order
            }
            
            // If 1Y returns are equal, sort by 3Y returns
            const aReturns3Y = a.returns?.['3Y'] || 0;
            const bReturns3Y = b.returns?.['3Y'] || 0;
            return bReturns3Y - aReturns3Y; // Descending order
          });

          // Cache successful result
          this.cache.popular.data = {
            funds: sortedFunds,
            timestamp: Date.now()
          };

          return sortedFunds;
        }
      } catch (error) {
        this.updateSourceHealth(source, false);
        console.warn(`Best performing funds failed for source ${source}:`, error);
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

    console.log(`🔍 Attempting to fetch ${type} from source: ${source}${param ? ` (param: ${param})` : ''}`);

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
   * AMFI provides NAV data in semicolon-delimited text format
   * Format: Scheme Code;ISIN Div;ISIN Growth;Scheme Name;Net Asset Value;Date
   */
  private async fetchFromAMFI(type: string, param?: string): Promise<any> {
    const amfiUrl = 'https://www.amfiindia.com/spages/NAVAll.txt';
    
    try {
      const response = await axios.get(amfiUrl, {
        timeout: this.TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const lines = response.data.split('\n');
      const funds: any[] = [];
      let currentFundHouse = '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines
        if (!trimmedLine) continue;
        
        // Check if this is a fund house header (all caps, no semicolons)
        if (!trimmedLine.includes(';')) {
          currentFundHouse = trimmedLine;
          continue;
        }

        // Parse fund data: Scheme Code;ISIN Div;ISIN Growth;Scheme Name;Net Asset Value;Date
        const parts = trimmedLine.split(';');
        if (parts.length < 6) continue;

        const [schemeCode, isinDiv, isinGrowth, schemeName, nav, date] = parts;
        
        // Skip header rows and invalid data
        const trimmedNav = nav?.trim();
        const trimmedSchemeCode = schemeCode?.trim();
        
        // Validate: scheme code should be numeric, NAV should be a valid number
        if (!trimmedSchemeCode || !trimmedNav || !schemeName) continue;
        if (!/^\d+$/.test(trimmedSchemeCode)) continue; // Skip if scheme code is not numeric
        if (trimmedNav === 'N.A.' || trimmedNav === 'Net Asset Value') continue; // Skip N.A. and header
        if (isNaN(parseFloat(trimmedNav))) continue; // Skip if NAV is not a valid number

        const fundData = {
          schemeCode: trimmedSchemeCode,
          schemeName: schemeName.trim(),
          fundHouse: currentFundHouse,
          isinDiv: isinDiv?.trim(),
          isinGrowth: isinGrowth?.trim(),
          currentNav: trimmedNav,
          navDate: date?.trim() || new Date().toISOString(),
        };

        // Handle different query types
        if (type === 'fund' && param) {
          // Search by scheme code or name
          if (fundData.schemeCode === param || 
              fundData.schemeName.toLowerCase().includes(param.toLowerCase())) {
            return this.normalizeAMFIFund(fundData);
          }
        } else if (type === 'search' && param) {
          // Return all matching funds
          if (fundData.schemeName.toLowerCase().includes(param.toLowerCase())) {
            funds.push(this.normalizeAMFIFund(fundData));
          }
        } else if (type === 'popular') {
          // Collect all funds for popular selection
          funds.push(this.normalizeAMFIFund(fundData));
        }
      }

      // For popular funds, return top 10 by fund house diversity
      if (type === 'popular') {
        const uniqueFundHouses = new Map<string, any>();
        for (const fund of funds) {
          if (!uniqueFundHouses.has(fund.fundHouse)) {
            uniqueFundHouses.set(fund.fundHouse, fund);
            if (uniqueFundHouses.size >= 10) break;
          }
        }
        return Array.from(uniqueFundHouses.values());
      }

      return type === 'fund' ? null : funds;
    } catch (error) {
      throw new Error(`AMFI request failed: ${error}`);
    }
  }

  /**
   * Normalize AMFI fund data to our schema
   */
  private normalizeAMFIFund(data: any): FundExtended {
    return {
      schemeCode: data.schemeCode || '',
      schemeName: data.schemeName || '',
      fundHouse: data.fundHouse || '',
      category: '', // AMFI doesn't provide category in NAV file
      currentNav: data.currentNav || '0',
      navDate: data.navDate || new Date().toISOString(),
      returns: {},
      returnStrings: {},
      provenance: {
        primarySource: 'AMFI',
        sourceChain: ['AMFI'],
        lastRefreshed: new Date().toISOString(),
        timestamp: new Date(),
        isAuthentic: true
      }
    };
  }

  /**
   * Fetch from MFAPI.in
   */
  private async fetchFromMFAPI(type: string, param?: string): Promise<any> {
    const baseUrl = 'https://api.mfapi.in/mf';
    
    try {
      // Validate param for fund type
      if (type === 'fund' && (!param || param.trim() === '')) {
        throw new Error('Invalid scheme code: empty or undefined');
      }
      
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

      // Check if response has valid data
      if (!response.data || (type === 'fund' && !response.data.meta)) {
        throw new Error('Invalid response format from MFAPI');
      }

      if (type === 'fund') {
        return this.normalizeMFAPIFund(response.data);
      } else if (type === 'search') {
        return Array.isArray(response.data) ? response.data.map((fund: any) => this.normalizeMFAPIFund(fund)) : [];
      } else {
        return response.data.map((fund: any) => this.normalizeMFAPIFund(fund));
      }
    } catch (error: any) {
      // Provide more context for 404 errors
      if (error.response?.status === 404) {
        throw new Error(`Fund not found in MFAPI: ${param}`);
      }
      throw new Error(`MFAPI request failed: ${error.message || error}`);
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
    // MFAPI returns data in format: { meta: { scheme_code, scheme_name, fund_house }, data: [{nav, date}] }
    const schemeCode = data.meta?.scheme_code || data.schemeCode || data.id?.toString() || '';
    const schemeName = data.meta?.scheme_name || data.schemeName || data.name || '';
    const fundHouse = data.meta?.fund_house || data.fundHouse || '';
    
    // Get latest NAV from data array
    const latestNavData = Array.isArray(data.data) && data.data.length > 0 
      ? data.data[0] 
      : { nav: data.nav || '0', date: data.date || new Date().toISOString() };
    
    return {
      schemeCode: schemeCode.toString(),
      schemeName,
      fundHouse,
      category: data.category || data.meta?.scheme_category || '',
      currentNav: latestNavData.nav || data.currentNav || '0',
      navDate: latestNavData.date || new Date().toISOString(),
      returns: {},
      returnStrings: {},
      provenance: {
        primarySource: 'MFAPI',
        sourceChain: ['MFAPI'],
        lastRefreshed: new Date().toISOString(),
        timestamp: new Date(),
        isAuthentic: true
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
    // Return empty array if schemeCode is empty or invalid
    if (!schemeCode || schemeCode.trim() === '') {
      return [];
    }

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
   * Enrich fund data with CRISIL ratings
   */
  private async enrichWithCrisilRating(fund: FundExtended): Promise<FundExtended> {
    try {
      const crisilAnalysis = await CrisilService.getRating(fund.schemeCode);
      
      if (crisilAnalysis) {
        // Add CRISIL data to fund
        fund.crisilRating = crisilAnalysis.rating.rating;
        fund.crisilCategory = crisilAnalysis.rating.category;
        fund.crisilPercentile = crisilAnalysis.rating.percentile;
        fund.crisilEvaluationDate = crisilAnalysis.rating.evaluationDate;
        fund.crisilRiskAdjustedScore = crisilAnalysis.rating.riskAdjustedScore;
        fund.crisilAssetQualityScore = crisilAnalysis.rating.assetQualityScore;
        fund.crisilLiquidityScore = crisilAnalysis.rating.liquidityScore;
        fund.crisilConcentrationScore = crisilAnalysis.rating.concentrationScore;
        fund.crisilOverallScore = crisilAnalysis.rating.overallScore;
        fund.crisilDataSource = crisilAnalysis.rating.dataSource;
        fund.crisilLastUpdated = new Date();
        
        // Add additional analysis data
        fund.crisilRationale = crisilAnalysis.rationale;
        fund.crisilStrengths = crisilAnalysis.strengths;
        fund.crisilConcerns = crisilAnalysis.concerns;
        fund.crisilRecommendation = crisilAnalysis.recommendation;

        // Update provenance to include CRISIL
        if (!fund.provenance) {
          fund.provenance = {
            primarySource: 'AMFI',
            dataFlow: [],
            timestamp: new Date(),
            isAuthentic: true
          };
        }
        
        // Ensure dataFlow array exists
        if (!fund.provenance.dataFlow) {
          fund.provenance.dataFlow = [];
        }
        
        fund.provenance.dataFlow.push({
          source: 'CRISIL',
          timestamp: new Date(),
          action: 'rating_enrichment',
          metadata: { 
            rating: crisilAnalysis.rating.rating,
            category: crisilAnalysis.rating.category,
            dataSource: crisilAnalysis.rating.dataSource
          }
        });

        console.log(`✅ Enhanced ${fund.schemeName} with CRISIL ${crisilAnalysis.rating.rating}-star rating`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to enrich ${fund.schemeCode} with CRISIL rating:`, error);
      
      // Mark source as unhealthy if this fails consistently  
      this.updateSourceHealth('CRISIL', false);
    }
    
    return fund;
  }

  /**
   * Enrich multiple funds with CRISIL ratings
   */
  private async enrichFundsWithCrisil(funds: FundExtended[]): Promise<FundExtended[]> {
    const enrichedFunds: FundExtended[] = [];
    
    // Process in batches to avoid overwhelming the CRISIL service
    const batchSize = 5;
    for (let i = 0; i < funds.length; i += batchSize) {
      const batch = funds.slice(i, i + batchSize);
      const batchPromises = batch.map(fund => this.enrichWithCrisilRating(fund));
      
      try {
        const enrichedBatch = await Promise.all(batchPromises);
        enrichedFunds.push(...enrichedBatch);
      } catch (error) {
        console.warn('⚠️ Batch CRISIL enrichment failed:', error);
        // Add original funds without CRISIL data if enrichment fails
        enrichedFunds.push(...batch);
      }
    }
    
    return enrichedFunds;
  }

  /**
   * Convert database MutualFund to FundExtended with full extended data
   */
  private convertDbToExtended(dbFund: any): FundExtended {
    // Parse extendedData from database
    const extData = dbFund.extendedData || {};
    
    return {
      schemeCode: dbFund.schemeCode,
      schemeName: dbFund.schemeName,
      category: dbFund.category || undefined,
      fundHouse: dbFund.fundHouse || undefined,
      nav: dbFund.nav ? parseFloat(dbFund.nav) : undefined,
      expenseRatio: dbFund.expenseRatio || undefined,
      aum: dbFund.aum || undefined,
      riskLevel: dbFund.riskLevel || undefined,
      returns1y: dbFund.returns1y ? parseFloat(dbFund.returns1y) : undefined,
      returns3y: dbFund.returns3y ? parseFloat(dbFund.returns3y) : undefined,
      returns5y: dbFund.returns5y ? parseFloat(dbFund.returns5y) : undefined,
      
      // Restore extended data from jsonb column
      currentNav: extData.currentNav || (dbFund.nav ? parseFloat(dbFund.nav).toString() : undefined),
      navDate: extData.navDate,
      returns: extData.returns || {},
      returnStrings: extData.returnStrings || {},
      rating: extData.rating,
      minInvestment: extData.minInvestment,
      exitLoad: extData.exitLoad,
      
      // Restore CRISIL data
      crisilRating: dbFund.crisilRating,
      crisilCategory: dbFund.crisilCategory,
      crisilPercentile: dbFund.crisilPercentile ? parseFloat(dbFund.crisilPercentile) : undefined,
      crisilEvaluationDate: dbFund.crisilEvaluationDate,
      crisilRiskAdjustedScore: dbFund.crisilRiskAdjustedScore ? parseFloat(dbFund.crisilRiskAdjustedScore) : undefined,
      crisilAssetQualityScore: dbFund.crisilAssetQualityScore ? parseFloat(dbFund.crisilAssetQualityScore) : undefined,
      crisilLiquidityScore: dbFund.crisilLiquidityScore ? parseFloat(dbFund.crisilLiquidityScore) : undefined,
      crisilConcentrationScore: dbFund.crisilConcentrationScore ? parseFloat(dbFund.crisilConcentrationScore) : undefined,
      crisilOverallScore: dbFund.crisilOverallScore ? parseFloat(dbFund.crisilOverallScore) : undefined,
      crisilDataSource: dbFund.crisilDataSource,
      crisilLastUpdated: dbFund.crisilLastUpdated,
      crisilRationale: extData.crisilRationale,
      crisilStrengths: extData.crisilStrengths,
      crisilConcerns: extData.crisilConcerns,
      crisilRecommendation: extData.crisilRecommendation,
      
      // Restore or create provenance
      provenance: extData.provenance || {
        primarySource: 'Database' as any,
        sourceChain: ['Database'],
        lastRefreshed: dbFund.lastUpdated?.toISOString() || new Date().toISOString(),
        dataVersion: '1.0'
      }
    };
  }

  /**
   * Save fund to database with full extended data
   */
  private async saveFundToDatabase(fund: FundExtended): Promise<void> {
    try {
      // Extract commonly used fields
      const basicData = {
        schemeCode: fund.schemeCode,
        schemeName: fund.schemeName,
        category: fund.category || null,
        fundHouse: fund.fundHouse || null,
        nav: fund.nav?.toString() || null,
        change: null,
        changePercent: null,
        expenseRatio: fund.expenseRatio?.toString() || null,
        aum: fund.aum?.toString() || null,
        riskLevel: fund.riskLevel || null,
        returns1y: fund.returns1y?.toString() || null,
        returns3y: fund.returns3y?.toString() || null,
        returns5y: fund.returns5y?.toString() || null,
        crisilRating: fund.crisilRating || null,
        crisilCategory: fund.crisilCategory || null,
        crisilPercentile: fund.crisilPercentile?.toString() || null,
        crisilEvaluationDate: fund.crisilEvaluationDate || null,
        crisilRiskAdjustedScore: fund.crisilRiskAdjustedScore?.toString() || null,
        crisilAssetQualityScore: fund.crisilAssetQualityScore?.toString() || null,
        crisilLiquidityScore: fund.crisilLiquidityScore?.toString() || null,
        crisilConcentrationScore: fund.crisilConcentrationScore?.toString() || null,
        crisilOverallScore: fund.crisilOverallScore?.toString() || null,
        crisilDataSource: fund.crisilDataSource || 'calculated',
        crisilLastUpdated: fund.crisilLastUpdated || new Date()
      };
      
      // Store full FundExtended in extendedData for complete round-trip fidelity
      const extendedData = {
        currentNav: fund.currentNav,
        navDate: fund.navDate,
        returns: fund.returns,
        returnStrings: fund.returnStrings,
        rating: fund.rating,
        minInvestment: fund.minInvestment,
        exitLoad: fund.exitLoad,
        provenance: fund.provenance,
        // Include CRISIL extended fields if present
        crisilRationale: fund.crisilRationale,
        crisilStrengths: fund.crisilStrengths,
        crisilConcerns: fund.crisilConcerns,
        crisilRecommendation: fund.crisilRecommendation
      };
      
      await this.storage.upsertMutualFund({
        ...basicData,
        extendedData
      });
    } catch (error) {
      console.error('Error saving fund to database:', error);
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.schemes.data.clear();
    this.cache.nav.data.clear();
    this.cache.historical.data.clear();
    this.cache.popular.data = null;
    // Note: CrisilService cache clearing would be handled internally
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

// Note: This service requires storage to be injected via constructor
// It's instantiated in routes.ts where storage is available