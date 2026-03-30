import axios from 'axios';
import { FundExtended, FundCore, FundPerformance, Provenance, NAVRecord, FundSearchParams, FundListResponse, SourceStatus, MultiSourceStatus } from '@shared/schema';
import FintekProRatingService, { FintekProAnalysis } from './fintekpro-rating-service';
import { CircuitBreaker, CircuitState } from '../utils/circuitBreaker';
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
  private amfiCircuitBreaker: CircuitBreaker;
  private mfapiCircuitBreaker: CircuitBreaker;
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
      ['FINTEKPRO_RATING', { isHealthy: true, errorRate: 0, consecutiveFailures: 0 }],
    ]);

    // Initialize circuit breakers for API resilience
    this.amfiCircuitBreaker = new CircuitBreaker('AMFI', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000, // 1 minute cooldown
      onStateChange: (state, name) => {
        console.log(`[CircuitBreaker] ${name} state changed to: ${state}`);
      },
      onFailure: (error, name) => {
        console.warn(`[CircuitBreaker] ${name} failure recorded:`, error.message);
      }
    });

    this.mfapiCircuitBreaker = new CircuitBreaker('MFAPI', {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 60000,
      onStateChange: (state, name) => {
        console.log(`[CircuitBreaker] ${name} state changed to: ${state}`);
      },
      onFailure: (error, name) => {
        console.warn(`[CircuitBreaker] ${name} failure recorded:`, error.message);
      }
    });
  }

  getCircuitBreakerStatus(): { amfi: string; mfapi: string } {
    return {
      amfi: this.amfiCircuitBreaker.getState(),
      mfapi: this.mfapiCircuitBreaker.getState()
    };
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

          // Enrich with FintekPro Smart Rating
          try {
            fundWithProvenance = await this.enrichWithFintekProRating(fundWithProvenance);
          } catch (error) {
            console.warn(`Failed to enrich fund ${fundWithProvenance.schemeCode} with FintekPro rating:`, error);
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
   * Search funds with parallel API calls and DB fallback
   * Uses Promise.allSettled for resilient parallel execution
   */
  async searchFunds(query: string): Promise<FundExtended[]> {
    const SEARCH_TIMEOUT = 3000; // 3 second timeout for search APIs
    const startTime = Date.now();

    // Helper to add timeout to a promise
    const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, source: string): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
          setTimeout(() => reject(new Error(`${source} search timeout after ${timeoutMs}ms`)), timeoutMs)
        )
      ]);
    };

    // Execute AMFI and MFAPI searches in parallel with circuit breakers
    const [amfiResult, mfapiResult] = await Promise.allSettled([
      this.amfiCircuitBreaker.execute(() => 
        withTimeout(this.fetchFromSource('AMFI', 'search', query), SEARCH_TIMEOUT, 'AMFI')
      ),
      this.mfapiCircuitBreaker.execute(() =>
        withTimeout(this.fetchFromSource('MFAPI', 'search', query), SEARCH_TIMEOUT, 'MFAPI')
      )
    ]);

    // Collect results and track sources
    const allFunds: FundExtended[] = [];
    const usedSources: string[] = [];

    // Process AMFI results
    if (amfiResult.status === 'fulfilled' && amfiResult.value?.length > 0) {
      this.updateSourceHealth('AMFI', true, Date.now() - startTime);
      usedSources.push('AMFI');
      const amfiFunds = amfiResult.value.map((fund: any) => ({
        ...fund,
        provenance: {
          primarySource: 'AMFI' as any,
          sourceChain: ['AMFI'],
          lastRefreshed: new Date().toISOString(),
          dataVersion: this.generateDataVersion(fund),
          dataSource: 'LIVE_API' as const,
          freshnessScore: 'fresh' as const
        }
      }));
      allFunds.push(...amfiFunds);
    } else if (amfiResult.status === 'rejected') {
      this.updateSourceHealth('AMFI', false);
      console.warn(`⚠️ AMFI search failed:`, amfiResult.reason);
    }

    // Process MFAPI results
    if (mfapiResult.status === 'fulfilled' && mfapiResult.value?.length > 0) {
      this.updateSourceHealth('MFAPI', true, Date.now() - startTime);
      usedSources.push('MFAPI');
      const mfapiFunds = mfapiResult.value.map((fund: any) => ({
        ...fund,
        provenance: {
          primarySource: 'MFAPI' as any,
          sourceChain: ['MFAPI'],
          lastRefreshed: new Date().toISOString(),
          dataVersion: this.generateDataVersion(fund),
          dataSource: 'LIVE_API' as const,
          freshnessScore: 'fresh' as const
        }
      }));
      allFunds.push(...mfapiFunds);
    } else if (mfapiResult.status === 'rejected') {
      this.updateSourceHealth('MFAPI', false);
      console.warn(`⚠️ MFAPI search failed:`, mfapiResult.reason);
    }

    // Deduplicate by schemeCode (prefer AMFI data)
    const dedupedFunds = this.deduplicateFunds(allFunds);

    // If we got results from APIs, cache them and return
    if (dedupedFunds.length > 0) {
      console.log(`✅ Search found ${dedupedFunds.length} funds from ${usedSources.join(', ')} in ${Date.now() - startTime}ms`);
      
      // Save to database asynchronously for future fallback
      this.cacheSearchResultsToDb(dedupedFunds).catch(err => 
        console.warn('Failed to cache search results:', err)
      );
      
      return dedupedFunds;
    }

    // FALLBACK: Query local database
    console.log(`⚠️ All APIs failed/empty for query "${query}", falling back to database...`);
    try {
      const dbFunds = await this.storage.searchMutualFunds(query);
      if (dbFunds.length > 0) {
        console.log(`✅ Database fallback found ${dbFunds.length} cached funds`);
        return dbFunds.map(dbFund => {
          const freshness = this.calculateFreshness(dbFund.lastUpdated);
          return {
            ...this.convertDbToExtended(dbFund),
            provenance: {
              primarySource: 'DATABASE' as any,
              sourceChain: ['DATABASE'],
              lastRefreshed: dbFund.lastUpdated?.toISOString() || new Date().toISOString(),
              dataVersion: this.generateDataVersion(dbFund),
              dataSource: 'CACHED_DB' as const,
              freshnessScore: freshness
            }
          };
        });
      }
    } catch (dbError) {
      console.error('Database fallback failed:', dbError);
    }

    console.log(`❌ No results found for query "${query}" from any source`);
    return [];
  }

  /**
   * Deduplicate funds by schemeCode, preferring AMFI data
   */
  private deduplicateFunds(funds: FundExtended[]): FundExtended[] {
    const seen = new Map<string, FundExtended>();
    for (const fund of funds) {
      if (!fund.schemeCode) continue;
      const existing = seen.get(fund.schemeCode);
      // Prefer AMFI over MFAPI
      if (!existing || fund.provenance?.primarySource === 'AMFI') {
        seen.set(fund.schemeCode, fund);
      }
    }
    return Array.from(seen.values());
  }

  /**
   * Calculate freshness tier based on last update time
   */
  private calculateFreshness(lastUpdated: Date | null | undefined): 'fresh' | 'stale' | 'old' {
    if (!lastUpdated) return 'old';
    const ageMs = Date.now() - new Date(lastUpdated).getTime();
    const hours = ageMs / (1000 * 60 * 60);
    if (hours < 24) return 'fresh';
    if (hours < 168) return 'stale'; // 7 days
    return 'old';
  }

  /**
   * Cache search results to database for future fallback
   */
  private async cacheSearchResultsToDb(funds: FundExtended[]): Promise<void> {
    const now = new Date();
    for (const fund of funds.slice(0, 50)) { // Limit to avoid overload
      try {
        await this.saveFundToDatabase({
          ...fund,
          lastVerifiedAt: now,
          dataSource: fund.provenance?.primarySource || 'LIVE_API'
        } as any);
      } catch (error) {
        // Silent fail - caching is best effort
      }
    }
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

          // Enrich with FintekPro Smart Ratings
          let ratedFunds: FundExtended[];
          try {
            ratedFunds = await this.enrichFundsWithFintekProRating(enrichedFunds);
          } catch (error) {
            console.warn('Failed to enrich funds with FintekPro ratings:', error);
            ratedFunds = enrichedFunds; // Fallback to original enriched funds
          }

          // Sort by FintekPro rating first (1 star = best, 5 star = worst), then by returns
          const sortedFunds = ratedFunds.sort((a, b) => {
            // Priority 1: FintekPro Smart Rating (lower is better: 1 = exceptional)
            // Rating is stored in legacy crisilRating column (FintekPro Smart Rating system)
            const aRating = a.crisilRating || 5;
            const bRating = b.crisilRating || 5;
            
            if (aRating !== bRating) {
              return aRating - bRating; // Ascending order (1 star = best)
            }
            
            // Priority 2: 1Y returns (higher is better)
            const aReturns1Y = a.returns?.['1Y'] || 0;
            const bReturns1Y = b.returns?.['1Y'] || 0;
            
            if (aReturns1Y !== bReturns1Y) {
              return bReturns1Y - aReturns1Y; // Descending order
            }
            
            // Priority 3: 3Y returns as tiebreaker
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
    const allSources = ['AMFI', 'MFAPI'];
    
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
      MFAPI: 'https://api.mfapi.in/mf'
    };

    console.log(`🔍 Attempting to fetch ${type} from source: ${source}${param ? ` (param: ${param})` : ''}`);

    switch (source) {
      case 'AMFI':
        return this.fetchFromAMFI(type, param);
      case 'MFAPI':
        return this.fetchFromMFAPI(type, param);
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
          // Search by scheme code, name, or ISIN
          const paramLower = param.toLowerCase();
          if (fundData.schemeCode === param || 
              fundData.schemeName.toLowerCase().includes(paramLower) ||
              fundData.isinDiv?.toLowerCase() === paramLower ||
              fundData.isinGrowth?.toLowerCase() === paramLower) {
            return this.normalizeAMFIFund(fundData);
          }
        } else if (type === 'search' && param) {
          // Return all matching funds by name, scheme code, or ISIN
          const paramLower = param.toLowerCase();
          if (fundData.schemeName.toLowerCase().includes(paramLower) ||
              fundData.schemeCode === param ||
              fundData.isinDiv?.toLowerCase().includes(paramLower) ||
              fundData.isinGrowth?.toLowerCase().includes(paramLower)) {
            funds.push(this.normalizeAMFIFund(fundData));
          }
        } else if (type === 'popular') {
          // Collect all funds for popular selection
          funds.push(this.normalizeAMFIFund(fundData));
        }
      }

      // For popular funds, return diverse selection (80-100 funds) across categories
      if (type === 'popular') {
        // Categorize funds by keywords in their names
        const categorizedFunds = {
          equity: [] as any[],
          debt: [] as any[],
          hybrid: [] as any[],
          liquid: [] as any[],
          elss: [] as any[],
          other: [] as any[]
        };

        for (const fund of funds) {
          const nameLower = fund.schemeName.toLowerCase();
          
          // Categorize based on fund name keywords
          if (nameLower.includes('equity') || nameLower.includes('stock') || 
              nameLower.includes('bluechip') || nameLower.includes('midcap') || 
              nameLower.includes('smallcap') || nameLower.includes('multicap') || 
              nameLower.includes('largecap') || nameLower.includes('focused')) {
            categorizedFunds.equity.push(fund);
          } else if (nameLower.includes('debt') || nameLower.includes('bond') || 
                     nameLower.includes('income') || nameLower.includes('gilt') || 
                     nameLower.includes('credit') || nameLower.includes('corporate') || 
                     nameLower.includes('banking') || nameLower.includes('psu')) {
            categorizedFunds.debt.push(fund);
          } else if (nameLower.includes('hybrid') || nameLower.includes('balanced') || 
                     nameLower.includes('aggressive') || nameLower.includes('conservative')) {
            categorizedFunds.hybrid.push(fund);
          } else if (nameLower.includes('liquid') || nameLower.includes('overnight') || 
                     nameLower.includes('ultra short')) {
            categorizedFunds.liquid.push(fund);
          } else if (nameLower.includes('elss') || nameLower.includes('tax saver') || 
                     nameLower.includes('tax saving')) {
            categorizedFunds.elss.push(fund);
          } else {
            categorizedFunds.other.push(fund);
          }
        }

        // Select diverse funds: aim for 80-100 total
        // Distribution: 30 equity, 25 debt, 15 hybrid, 10 liquid, 10 elss, 10 other
        const selectedFunds: any[] = [];
        const fundHouseCount = new Map<string, number>();
        
        const selectFromCategory = (category: any[], targetCount: number) => {
          const selected: any[] = [];
          for (const fund of category) {
            // Limit funds per house to ensure diversity (max 3 per house per category)
            const count = fundHouseCount.get(fund.fundHouse) || 0;
            if (count < 3) {
              selected.push(fund);
              fundHouseCount.set(fund.fundHouse, count + 1);
              if (selected.length >= targetCount) break;
            }
          }
          return selected;
        };

        selectedFunds.push(...selectFromCategory(categorizedFunds.equity, 30));
        selectedFunds.push(...selectFromCategory(categorizedFunds.debt, 25));
        selectedFunds.push(...selectFromCategory(categorizedFunds.hybrid, 15));
        selectedFunds.push(...selectFromCategory(categorizedFunds.liquid, 10));
        selectedFunds.push(...selectFromCategory(categorizedFunds.elss, 10));
        selectedFunds.push(...selectFromCategory(categorizedFunds.other, 10));

        console.log(`✅ Selected ${selectedFunds.length} diverse funds from AMFI (Equity: ${categorizedFunds.equity.length > 30 ? 30 : categorizedFunds.equity.length}, Debt: ${categorizedFunds.debt.length > 25 ? 25 : categorizedFunds.debt.length}, Hybrid: ${categorizedFunds.hybrid.length > 15 ? 15 : categorizedFunds.hybrid.length})`);
        
        return selectedFunds;
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
    // Select primary ISIN: prefer growth ISIN, fall back to div ISIN
    const isin = data.isinGrowth || data.isinDiv || '';
    
    return {
      schemeCode: data.schemeCode || '',
      schemeName: data.schemeName || '',
      fundHouse: data.fundHouse || '',
      category: '', // AMFI doesn't provide category in NAV file
      currentNav: data.currentNav || '0',
      navDate: data.navDate || new Date().toISOString(),
      isin: isin, // ISIN code from AMFI data
      isinDiv: data.isinDiv || '',
      isinGrowth: data.isinGrowth || '',
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
          // MFAPI doesn't have a popular endpoint, so we can't fetch a diverse set here
          // Return empty array to force fallback to AMFI which has comprehensive data
          console.warn('MFAPI does not support popular funds endpoint - falling back to AMFI');
          return [];
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
   * Enrich fund data with FintekPro Smart Ratings
   */
  private async enrichWithFintekProRating(fund: FundExtended): Promise<FundExtended> {
    try {
      const fintekProAnalysis = await FintekProRatingService.getRating(fund.schemeCode);
      
      if (fintekProAnalysis) {
        // Add FintekPro Smart Rating data to fund
        fund.crisilRating = fintekProAnalysis.rating.rating;
        fund.crisilCategory = fintekProAnalysis.rating.category;
        fund.crisilPercentile = fintekProAnalysis.rating.percentile;
        fund.crisilEvaluationDate = fintekProAnalysis.rating.evaluationDate;
        fund.crisilRiskAdjustedScore = fintekProAnalysis.rating.riskAdjustedScore;
        fund.crisilAssetQualityScore = fintekProAnalysis.rating.assetQualityScore;
        fund.crisilLiquidityScore = fintekProAnalysis.rating.liquidityScore;
        fund.crisilConcentrationScore = fintekProAnalysis.rating.concentrationScore;
        fund.crisilOverallScore = fintekProAnalysis.rating.overallScore;
        fund.crisilDataSource = fintekProAnalysis.rating.dataSource;
        fund.crisilLastUpdated = new Date();
        
        // Add additional analysis data
        fund.crisilRationale = fintekProAnalysis.rationale;
        fund.crisilStrengths = fintekProAnalysis.strengths;
        fund.crisilConcerns = fintekProAnalysis.concerns;
        fund.crisilRecommendation = fintekProAnalysis.recommendation;

        // Update provenance to include FintekPro rating
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
          source: 'FINTEKPRO_RATING',
          timestamp: new Date(),
          action: 'rating_enrichment',
          metadata: { 
            rating: fintekProAnalysis.rating.rating,
            category: fintekProAnalysis.rating.category,
            dataSource: fintekProAnalysis.rating.dataSource
          }
        });

        console.log(`✅ Enhanced ${fund.schemeName} with FintekPro ${fintekProAnalysis.rating.rating}-star rating`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to enrich ${fund.schemeCode} with FintekPro rating:`, error);
      
      // Mark source as unhealthy if this fails consistently  
      this.updateSourceHealth('FINTEKPRO_RATING', false);
    }
    
    return fund;
  }

  /**
   * Enrich multiple funds with FintekPro Smart Ratings
   */
  private async enrichFundsWithFintekProRating(funds: FundExtended[]): Promise<FundExtended[]> {
    const enrichedFunds: FundExtended[] = [];
    
    // Process in small batches with a pause between each to avoid overwhelming
    // the Python ML service when this runs concurrently with other background jobs.
    const batchSize = 3;
    for (let i = 0; i < funds.length; i += batchSize) {
      const batch = funds.slice(i, i + batchSize);
      const batchPromises = batch.map(fund => this.enrichWithFintekProRating(fund));
      
      try {
        const enrichedBatch = await Promise.all(batchPromises);
        enrichedFunds.push(...enrichedBatch);
      } catch (error) {
        console.warn('⚠️ Batch FintekPro rating enrichment failed:', error);
        // Add original funds without rating data if enrichment fails
        enrichedFunds.push(...batch);
      }

      // Throttle: give the Python service a brief breathing room between batches
      if (i + batchSize < funds.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
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
      
      // Restore FintekPro Smart Rating data
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
      // Strict validation: reject funds with missing critical data
      if (!fund.schemeCode || !fund.schemeName || 
          fund.schemeCode.trim() === '' || fund.schemeName.trim() === '') {
        console.warn(`⚠️  Rejecting fund with missing data: schemeCode="${fund.schemeCode}", schemeName="${fund.schemeName}"`);
        throw new Error('Invalid fund data: schemeCode and schemeName are required');
      }

      // Validate scheme code is numeric
      if (!/^\d+$/.test(fund.schemeCode)) {
        console.warn(`⚠️  Rejecting fund with invalid scheme code: ${fund.schemeCode}`);
        throw new Error('Invalid fund data: schemeCode must be numeric');
      }

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
        crisilLastUpdated: fund.crisilLastUpdated || new Date(),
        // Search resilience fields
        amfiCode: (fund as any).amfiCode || fund.schemeCode || null,
        isin: (fund as any).isin || (fund as any).isinGrowth || (fund as any).isinDiv || null, // ISIN code for search
        optionType: this.detectOptionType(fund.schemeName),
        schemeStatus: (fund as any).schemeStatus || 'active',
        lastVerifiedAt: new Date(),
        dataSource: fund.provenance?.primarySource || 'LIVE_API',
        // Extended AMFI data fields
        isinDividendPayout: (fund as any).isinDiv || null,
        isinDividendReinvest: (fund as any).isinDiv || null, // Same as payout in AMFI data
        isinGrowth: (fund as any).isinGrowth || null,
        minSipAmount: (fund as any).minSipAmount?.toString() || fund.minInvestment?.sip?.toString() || null,
        minLumpsumAmount: (fund as any).minLumpsumAmount?.toString() || fund.minInvestment?.lumpsum?.toString() || null,
        amcCode: (fund as any).amcCode || null,
        exitLoadPercent: (fund as any).exitLoadPercent?.toString() || null,
        exitLoadDays: (fund as any).exitLoadDays || null,
        schemeSubCategory: (fund as any).schemeSubCategory || null
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
        // Include FintekPro Smart Rating extended fields if present
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
   * Detect option type from scheme name (Growth vs IDCW/Dividend)
   */
  private detectOptionType(schemeName: string): string | null {
    if (!schemeName) return null;
    const name = schemeName.toUpperCase();
    if (name.includes('IDCW') || name.includes('DIVIDEND')) return 'idcw';
    if (name.includes('GROWTH')) return 'growth';
    return null;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.schemes.data.clear();
    this.cache.nav.data.clear();
    this.cache.historical.data.clear();
    this.cache.popular.data = null;
    // Note: FintekProRatingService cache clearing would be handled internally
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