/**
 * Probe42 Integration Service (v2 API)
 * Handles all interactions with Probe42 API for company financial data
 * 
 * V2 API Endpoints:
 * - POST /search-entities - Company search by name/CIN
 * - GET /entities/{identifier}/base-details - Company details
 * - GET /entities/{identifier}/kyc - Financial statements
 * - GET /entities/{identifier}/credit-ratings - Financial ratios
 * 
 * V2 Response Structure:
 * - Responses wrapped in { data: { ... } }
 * - Uses snake_case fields: legal_name, identifier, date_of_incorporation, etc.
 * - registered_address is nested: { address_line, city, state, pincode }
 * 
 * Probe42 provides:
 * - Company search by name/CIN
 * - Latest financial statements (Balance Sheet, P&L, Cash Flow)
 * - Financial ratios and metrics
 * - Director information
 * - MCA/ROC filings data
 */

import axios, { AxiosInstance } from 'axios';
import { ExternalServiceError, ValidationError } from '../utils/errors';
import { requestDedupeService } from './request-deduplication-service';
import type { 
  InsertCompanyFinancials, 
  InsertCompanyRatios,
  InsertProbe42SyncLog 
} from '@shared/schema';

// Environment configuration
const PROBE42_API_KEY = process.env.PROBE42_API_KEY || '';
const PROBE42_BASE_URL = process.env.PROBE42_BASE_URL || 'https://api.probe42.in/probe_data_api';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export interface Probe42ApiError {
  code: number;
  message: string;
  troubleshooting: string;
  isRetryable: boolean;
}

export interface Probe42SearchResult {
  success: boolean;
  data?: Probe42CompanySearchResult[];
  error?: Probe42ApiError;
  usedMockData?: boolean;
}

export interface Probe42CompanySearchResult {
  company_id: string;
  name: string;
  cin: string;
  pan?: string;
  roc_state?: string;
  status: string;
  incorporation_date?: string;
}

export interface Probe42CompanyDetails {
  company_id: string;
  name: string;
  cin: string;
  pan?: string;
  isin?: string;
  sector?: string;
  industry?: string;
  roc_state?: string;
  incorporation_date?: string;
  paid_up_capital?: number;
  authorized_capital?: number;
  face_value?: number;
  total_shares?: number;
  status: string;
  website?: string;
  description?: string;
  directors?: Array<{
    name: string;
    din?: string;
    designation?: string;
  }>;
}

export interface Probe42FinancialData {
  company_id: string;
  financial_year: string;
  period_start: string;
  period_end: string;
  
  // Income Statement
  revenue?: number;
  ebitda?: number;
  ebit?: number;
  pbt?: number;
  pat?: number;
  net_profit?: number;
  
  // Balance Sheet
  total_assets?: number;
  total_liabilities?: number;
  networth?: number;
  share_capital?: number;
  reserves?: number;
  
  // Debt
  total_debt?: number;
  long_term_debt?: number;
  short_term_debt?: number;
  
  // Cash Flow
  operating_cash_flow?: number;
  investing_cash_flow?: number;
  financing_cash_flow?: number;
  free_cash_flow?: number;
}

export interface Probe42RatiosData {
  company_id: string;
  financial_year: string;
  
  // Valuation
  pe_ratio?: number;
  pb_ratio?: number;
  ev_ebitda?: number;
  price_to_sales?: number;
  
  // Profitability
  roe?: number;
  roce?: number;
  roa?: number;
  margin_ebitda?: number;
  margin_pat?: number;
  margin_operating?: number;
  
  // Leverage
  debt_equity?: number;
  debt_to_assets?: number;
  interest_coverage?: number;
  
  // Liquidity
  current_ratio?: number;
  quick_ratio?: number;
  
  // Efficiency
  asset_turnover?: number;
  inventory_turnover?: number;
  
  // Growth
  revenue_growth?: number;
  profit_growth?: number;
}

export interface SyncResult {
  success: boolean;
  financialsCount: number;
  ratiosCount: number;
  errors: string[];
}

// ===================================================================
// PROBE42 SERVICE CLASS
// ===================================================================

class Probe42Service {
  private client: AxiosInstance;
  private isConfigured: boolean;
  private lastHealthCheck: { status: string; timestamp: Date; error?: string } | null = null;

  constructor() {
    this.isConfigured = Boolean(PROBE42_API_KEY);
    
    this.client = axios.create({
      baseURL: PROBE42_BASE_URL,
      headers: {
        'x-api-key': PROBE42_API_KEY,
        'x-api-version': '1.0',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    if (!this.isConfigured) {
      console.warn('⚠️ PROBE42_API_KEY not configured. Probe42 service will use mock data in development.');
    } else {
      console.log('✅ Probe42 service initialized');
    }
  }

  /**
   * Check if Probe42 is properly configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Get current service status and configuration
   */
  getStatus(): {
    configured: boolean;
    baseUrl: string;
    lastHealthCheck: { status: string; timestamp: Date; error?: string } | null;
  } {
    return {
      configured: this.isConfigured,
      baseUrl: PROBE42_BASE_URL,
      lastHealthCheck: this.lastHealthCheck,
    };
  }

  /**
   * Health check - verify API connectivity and authentication
   * Uses v2 API endpoint: GET /entities/{identifier}/base-details
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy' | 'unconfigured';
    message: string;
    responseTime?: number;
  }> {
    if (!this.isConfigured) {
      this.lastHealthCheck = {
        status: 'unconfigured',
        timestamp: new Date(),
        error: 'PROBE42_API_KEY not set',
      };
      return {
        status: 'unconfigured',
        message: 'Probe42 API key not configured. Using mock data in development.',
      };
    }

    const startTime = Date.now();
    try {
      // Use a known CIN to test connectivity - v2 API endpoint
      const response = await this.client.get('/entities/U73100KA2005PTC036337/base-details');
      
      const responseTime = Date.now() - startTime;
      this.lastHealthCheck = {
        status: 'healthy',
        timestamp: new Date(),
      };
      
      return {
        status: 'healthy',
        message: 'Probe42 API v2 is accessible and authenticated',
        responseTime,
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error.response?.status === 401 || error.response?.status === 403
        ? 'Authentication failed - API key may be invalid or expired'
        : `API error: ${error.message}`;
      
      this.lastHealthCheck = {
        status: 'unhealthy',
        timestamp: new Date(),
        error: errorMessage,
      };
      
      return {
        status: 'unhealthy',
        message: errorMessage,
        responseTime,
      };
    }
  }

  /**
   * Search for companies by name or CIN
   * Uses v2 API: POST /search-entities with body { nameStartsWith: query, limit: 100 }
   */
  async searchCompanyByNameOrCIN(query: string): Promise<Probe42CompanySearchResult[]> {
    if (!query || query.trim().length < 3) {
      throw new ValidationError('Search query must be at least 3 characters');
    }

    if (!this.isConfigured) {
      console.log(`[Probe42] Not configured, using mock data for query: "${query}"`);
      return this.getMockSearchResults(query);
    }

    try {
      console.log(`[Probe42] Searching v2 API for: "${query}"`);
      const response = await this.client.post('/search-entities', {
        nameStartsWith: query,
        limit: 100
      });

      // v2 API returns: { data: { companies: [...], llps: [...] } }
      const responseData = response.data?.data || response.data;
      const companiesList = responseData?.companies || [];
      const llpsList = responseData?.llps || [];
      
      console.log(`[Probe42] v2 found ${companiesList.length} companies, ${llpsList.length} LLPs for query: "${query}"`);
      
      // Map v2 response fields to our internal format
      const results: Probe42CompanySearchResult[] = companiesList.map((entity: any) => ({
        company_id: entity.identifier || entity.cin,
        name: entity.legal_name || entity.name,
        cin: entity.identifier || entity.cin,
        pan: entity.pan,
        roc_state: entity.registered_address?.state || entity.roc_state,
        status: entity.status || 'Active',
        incorporation_date: entity.date_of_incorporation || entity.incorporation_date,
      }));
      
      if (results.length > 0) {
        console.log(`[Probe42] First result: ${results[0].name} (CIN: ${results[0].cin})`);
      }
      return results;
    } catch (error: any) {
      // Handle authentication errors gracefully - fall back to mock data in development
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.warn('⚠️ Probe42 API authentication failed (token may be expired). Using mock data.');
        if (process.env.NODE_ENV === 'development') {
          return this.getMockSearchResults(query);
        }
        throw new ExternalServiceError(
          'Probe42',
          'Probe42 API authentication failed. The API key may be expired or invalid.',
          error,
          false
        );
      }
      throw new ExternalServiceError(
        'Probe42',
        `Company search failed: ${error.message}`,
        error,
        true
      );
    }
  }

  /**
   * Search for companies by name or CIN with detailed error information
   * Returns structured result with success/failure details for UI display
   * Uses v2 API: POST /search-entities with body { nameStartsWith: query, limit: 100 }
   */
  async searchCompanyByNameOrCINWithDetails(query: string): Promise<Probe42SearchResult> {
    if (!query || query.trim().length < 3) {
      return {
        success: false,
        error: {
          code: 400,
          message: 'Search query too short',
          troubleshooting: 'Search query must be at least 3 characters long.',
          isRetryable: false
        }
      };
    }

    if (!this.isConfigured) {
      console.log(`[Probe42] Not configured, using mock data for query: "${query}"`);
      return {
        success: true,
        data: this.getMockSearchResults(query),
        usedMockData: true
      };
    }

    try {
      console.log(`[Probe42] Searching v2 API for: "${query}"`);
      const response = await this.client.post('/search-entities', {
        nameStartsWith: query,
        limit: 100
      });

      // v2 API returns: { data: { companies: [...], llps: [...] } }
      const responseData = response.data?.data || response.data;
      const companiesList = responseData?.companies || [];
      const llpsList = responseData?.llps || [];
      
      console.log(`[Probe42] v2 found ${companiesList.length} companies, ${llpsList.length} LLPs for query: "${query}"`);
      
      // Map v2 response fields to our internal format
      const results: Probe42CompanySearchResult[] = companiesList.map((entity: any) => ({
        company_id: entity.identifier || entity.cin,
        name: entity.legal_name || entity.name,
        cin: entity.identifier || entity.cin,
        pan: entity.pan,
        roc_state: entity.registered_address?.state || entity.roc_state,
        status: entity.status || 'Active',
        incorporation_date: entity.date_of_incorporation || entity.incorporation_date,
      }));
      
      return {
        success: true,
        data: results,
        usedMockData: false
      };
    } catch (error: any) {
      const errorCode = error.response?.status || 500;
      const errorMessage = error.response?.data?.message || error.message;

      console.error(`[Probe42] Search error: ${errorCode} - ${errorMessage}`);

      // Map common error codes to user-friendly messages
      let troubleshooting: string;
      let isRetryable: boolean;

      switch (errorCode) {
        case 401:
          troubleshooting = 'Probe42 API authentication failed. API key is missing or invalid. Contact system administrator.';
          isRetryable = false;
          break;
        case 403:
          troubleshooting = 'Probe42 API access denied. API key may be expired, or subscription limit reached. Contact Probe42 support.';
          isRetryable = false;
          break;
        case 404:
          troubleshooting = 'Probe42 search endpoint not found. API configuration may be incorrect.';
          isRetryable = false;
          break;
        case 429:
          troubleshooting = 'Probe42 rate limit exceeded. Too many requests. Please wait a few minutes and try again.';
          isRetryable = true;
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          troubleshooting = 'Probe42 API is temporarily unavailable. Please try again later.';
          isRetryable = true;
          break;
        default:
          troubleshooting = `Unexpected error from Probe42 API. Error details: ${errorMessage}`;
          isRetryable = true;
      }

      // In development, fall back to mock data if authentication fails
      if (process.env.NODE_ENV === 'development' && (errorCode === 401 || errorCode === 403)) {
        console.warn('⚠️ Probe42 API authentication failed. Using mock data in development.');
        return {
          success: true,
          data: this.getMockSearchResults(query),
          usedMockData: true
        };
      }

      return {
        success: false,
        error: {
          code: errorCode,
          message: errorMessage || 'Unknown error',
          troubleshooting,
          isRetryable
        }
      };
    }
  }

  /**
   * Get detailed company information
   * Uses v2 API: GET /entities/{identifier}/base-details
   * Includes request deduplication to prevent duplicate in-flight requests
   */
  async getCompanyDetails(probe42CompanyId: string): Promise<Probe42CompanyDetails | null> {
    if (!probe42CompanyId) {
      throw new ValidationError('Company ID is required');
    }

    if (!this.isConfigured) {
      return this.getMockCompanyDetails(probe42CompanyId);
    }

    const dedupeKey = requestDedupeService.createKey('probe42', 'base-details', probe42CompanyId);
    
    return requestDedupeService.dedupe(dedupeKey, async () => {
      try {
        console.log(`[Probe42] Fetching v2 base-details for: ${probe42CompanyId}`);
        const response = await this.client.get(`/entities/${probe42CompanyId}/base-details`);
        const data = response.data?.data || response.data;
        if (!data) return null;
        
        // Map Probe42 v2 response to our internal format
        // v2 uses snake_case fields: legal_name, identifier, date_of_incorporation, registered_address, authorized_capital, paid_up_capital
        // registered_address is a nested object: { address_line, city, state, pincode }
        const mappedData = {
          company_id: data.identifier || probe42CompanyId,
          name: data.legal_name || data.name || '',
          cin: data.identifier || probe42CompanyId,
          pan: data.pan || data.pan_of_entity,
          sector: data.industry_segment?.industry || data.sector,
          industry: data.industry_segment?.segments?.[0] || data.industry,
          roc_state: data.registered_address?.state || data.roc_state,
          incorporation_date: data.date_of_incorporation || data.incorporation_date,
          paid_up_capital: data.paid_up_capital,
          authorized_capital: data.authorized_capital,
          status: data.status || 'Unknown',
          website: data.website,
          description: data.description,
          directors: data.directors?.map((d: any) => ({
            name: d.name || d.legal_name,
            din: d.din || d.identifier,
            designation: d.designation
          }))
        };
        
        // If API returned no directors/capital, supplement with mock data in development
        if (process.env.NODE_ENV === 'development') {
          const mockData = this.getMockCompanyDetails(probe42CompanyId);
          if (!mappedData.directors || mappedData.directors.length === 0) {
            console.log('[Probe42] API returned no directors, using mock data');
            mappedData.directors = mockData.directors;
          }
          if (!mappedData.paid_up_capital) {
            mappedData.paid_up_capital = mockData.paid_up_capital;
          }
          if (!mappedData.authorized_capital) {
            mappedData.authorized_capital = mockData.authorized_capital;
          }
        }
        
        // Use NIC-based classification as fallback if sector/industry not provided by API
        if ((!mappedData.sector || !mappedData.industry) && mappedData.cin) {
          try {
            const { classifyIndustryFromCIN } = await import('../utils/nic-industry-classifier');
            const nicClassification = classifyIndustryFromCIN(mappedData.cin);
            if (nicClassification) {
              if (!mappedData.sector) {
                mappedData.sector = nicClassification.sector;
                console.log(`[Probe42] Using NIC-derived sector for ${mappedData.cin}: ${nicClassification.sector}`);
              }
              if (!mappedData.industry) {
                mappedData.industry = nicClassification.industry;
                console.log(`[Probe42] Using NIC-derived industry for ${mappedData.cin}: ${nicClassification.industry}`);
              }
            }
          } catch (nicError) {
            // NIC classification is optional, continue without it
          }
        }
        
        return mappedData;
      } catch (error: any) {
        if (error.response?.status === 404) {
          return null;
        }
        // Handle authentication errors gracefully
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.warn(`⚠️ Probe42 API authentication error (${error.response?.status}) for ${probe42CompanyId}.`);
        }
        // Handle 422 (invalid entity) - likely an invalid identifier format
        if (error.response?.status === 422) {
          console.warn(`⚠️ Probe42 API rejected identifier "${probe42CompanyId}" (422). Check if the CIN/identifier is valid.`);
        }
        throw new ExternalServiceError(
          'Probe42',
          `Failed to fetch company details: ${error.message}`,
          error,
          true
        );
      }
    });
  }

  /**
   * Batch fetch company details for multiple CINs
   * Uses request deduplication to prevent duplicate calls
   * Returns a map of CIN -> CompanyDetails
   */
  async batchGetCompanyDetails(
    cins: string[],
    options: { concurrencyLimit?: number } = {}
  ): Promise<Map<string, Probe42CompanyDetails | null>> {
    const { concurrencyLimit = 5 } = options;
    const results = new Map<string, Probe42CompanyDetails | null>();
    
    if (cins.length === 0) {
      return results;
    }
    
    console.log(`[Probe42] Batch fetching details for ${cins.length} companies (concurrency: ${concurrencyLimit})`);
    
    // Process in batches to respect rate limits
    const batches: string[][] = [];
    for (let i = 0; i < cins.length; i += concurrencyLimit) {
      batches.push(cins.slice(i, i + concurrencyLimit));
    }
    
    let processed = 0;
    for (const batch of batches) {
      const batchPromises = batch.map(async (cin) => {
        try {
          const details = await this.getCompanyDetails(cin);
          results.set(cin, details);
        } catch (error: any) {
          console.error(`[Probe42] Batch fetch failed for ${cin}: ${error.message}`);
          results.set(cin, null);
        }
      });
      
      await Promise.all(batchPromises);
      processed += batch.length;
      
      if (processed < cins.length) {
        // Small delay between batches to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    const successful = [...results.values()].filter(v => v !== null).length;
    console.log(`[Probe42] Batch complete: ${successful}/${cins.length} successful`);
    
    return results;
  }

  /**
   * Batch fetch company financials for multiple CINs
   * Returns a map of CIN -> FinancialData[]
   */
  async batchGetCompanyFinancials(
    cins: string[],
    years: number = 3,
    options: { concurrencyLimit?: number } = {}
  ): Promise<Map<string, Probe42FinancialData[]>> {
    const { concurrencyLimit = 3 } = options;
    const results = new Map<string, Probe42FinancialData[]>();
    
    if (cins.length === 0) {
      return results;
    }
    
    console.log(`[Probe42] Batch fetching financials for ${cins.length} companies`);
    
    // Process in batches to respect rate limits
    const batches: string[][] = [];
    for (let i = 0; i < cins.length; i += concurrencyLimit) {
      batches.push(cins.slice(i, i + concurrencyLimit));
    }
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (cin) => {
        try {
          const financials = await this.getCompanyFinancials(cin, years);
          results.set(cin, financials);
        } catch (error: any) {
          console.error(`[Probe42] Batch financials failed for ${cin}: ${error.message}`);
          results.set(cin, []);
        }
      });
      
      await Promise.all(batchPromises);
      
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    const withData = [...results.values()].filter(v => v.length > 0).length;
    console.log(`[Probe42] Batch financials complete: ${withData}/${cins.length} with data`);
    
    return results;
  }

  /**
   * Get company financial statements for multiple years
   * NOTE: /kyc endpoint requires higher API tier - disabled to avoid auth errors
   * Financial data should be fetched from MCA Intelligence Service instead
   */
  async getCompanyFinancials(
    probe42CompanyId: string,
    years: number = 3
  ): Promise<Probe42FinancialData[]> {
    if (!probe42CompanyId) {
      throw new ValidationError('Company ID is required');
    }

    // Skip Probe42 /kyc endpoint - subscription tier does not include access
    // Financial data will be fetched from MCA Intelligence Service instead
    console.log(`[Probe42] Skipping /kyc endpoint for ${probe42CompanyId} - using MCA for financial data`);
    
    // Return empty array - callers should use MCA service for financial data
    return [];
  }

  /**
   * Get company financial ratios
   * Uses v2 API: GET /entities/{identifier}/credit-ratings
   * Includes request deduplication to prevent duplicate in-flight requests
   */
  async getCompanyRatios(
    probe42CompanyId: string,
    years: number = 3
  ): Promise<Probe42RatiosData[]> {
    if (!probe42CompanyId) {
      throw new ValidationError('Company ID is required');
    }

    if (!this.isConfigured) {
      return this.getMockRatios(probe42CompanyId, years);
    }

    const dedupeKey = requestDedupeService.createKey('probe42', 'credit-ratings', probe42CompanyId, years.toString());
    
    return requestDedupeService.dedupe(dedupeKey, async () => {
      try {
        console.log(`[Probe42] Fetching v2 credit-ratings for: ${probe42CompanyId}`);
        const response = await this.client.get(`/entities/${probe42CompanyId}/credit-ratings`);
        
        // v2 response wrapped in { data: { ... } }
        const data = response.data?.data || response.data;
        if (!data) return [];
        
        // v2 ratios are in the data object; map to our format
        const ratios = data.ratios || data.financial_ratios || [];
        
        if (Array.isArray(ratios) && ratios.length > 0) {
          return ratios.slice(0, years).map((ratio: any) => ({
            company_id: probe42CompanyId,
            financial_year: ratio.financial_year || ratio.year,
            pe_ratio: ratio.pe_ratio,
            pb_ratio: ratio.pb_ratio,
            ev_ebitda: ratio.ev_ebitda,
            price_to_sales: ratio.price_to_sales,
            roe: ratio.roe || ratio.return_on_equity,
            roce: ratio.roce || ratio.return_on_capital,
            roa: ratio.roa || ratio.return_on_assets,
            margin_ebitda: ratio.margin_ebitda || ratio.ebitda_margin,
            margin_pat: ratio.margin_pat || ratio.net_profit_margin,
            margin_operating: ratio.margin_operating || ratio.operating_margin,
            debt_equity: ratio.debt_equity || ratio.debt_to_equity,
            debt_to_assets: ratio.debt_to_assets,
            interest_coverage: ratio.interest_coverage,
            current_ratio: ratio.current_ratio,
            quick_ratio: ratio.quick_ratio,
            asset_turnover: ratio.asset_turnover,
            inventory_turnover: ratio.inventory_turnover,
            revenue_growth: ratio.revenue_growth,
            profit_growth: ratio.profit_growth,
          }));
        }
        
        // If API returned empty ratios, fall back to mock data in development
        if (process.env.NODE_ENV === 'development') {
          console.log('[Probe42] API returned no ratios, using mock data');
          return this.getMockRatios(probe42CompanyId, years);
        }
        return [];
      } catch (error: any) {
        // Handle authentication errors gracefully - fall back to mock data in development
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.warn('⚠️ Probe42 API authentication failed (token may be expired). Using mock data.');
          if (process.env.NODE_ENV === 'development') {
            return this.getMockRatios(probe42CompanyId, years);
          }
        }
        throw new ExternalServiceError(
          'Probe42',
          `Failed to fetch company ratios: ${error.message}`,
          error,
          true
        );
      }
    });
  }

  /**
   * Convert Probe42 financial data to database format
   */
  convertFinancialsToDbFormat(
    companyId: string,
    probe42Data: Probe42FinancialData
  ): InsertCompanyFinancials {
    return {
      companyId,
      financialYear: probe42Data.financial_year,
      periodStart: probe42Data.period_start,
      periodEnd: probe42Data.period_end,
      
      // Income Statement
      revenue: probe42Data.revenue?.toString(),
      ebitda: probe42Data.ebitda?.toString(),
      ebit: probe42Data.ebit?.toString(),
      pbt: probe42Data.pbt?.toString(),
      pat: probe42Data.pat?.toString(),
      netProfit: probe42Data.net_profit?.toString(),
      
      // Balance Sheet
      totalAssets: probe42Data.total_assets?.toString(),
      totalLiabilities: probe42Data.total_liabilities?.toString(),
      networth: probe42Data.networth?.toString(),
      shareCapital: probe42Data.share_capital?.toString(),
      reserves: probe42Data.reserves?.toString(),
      
      // Debt
      totalDebt: probe42Data.total_debt?.toString(),
      longTermDebt: probe42Data.long_term_debt?.toString(),
      shortTermDebt: probe42Data.short_term_debt?.toString(),
      
      // Cash Flow
      operatingCashFlow: probe42Data.operating_cash_flow?.toString(),
      investingCashFlow: probe42Data.investing_cash_flow?.toString(),
      financingCashFlow: probe42Data.financing_cash_flow?.toString(),
      freeCashFlow: probe42Data.free_cash_flow?.toString(),
      
      dataSource: 'probe42',
      verified: false,
    };
  }

  /**
   * Convert Probe42 ratios data to database format
   */
  convertRatiosToDbFormat(
    companyId: string,
    probe42Data: Probe42RatiosData
  ): InsertCompanyRatios {
    return {
      companyId,
      financialYear: probe42Data.financial_year,
      
      // Valuation
      peRatio: probe42Data.pe_ratio?.toString(),
      pbRatio: probe42Data.pb_ratio?.toString(),
      evEbitda: probe42Data.ev_ebitda?.toString(),
      priceToSales: probe42Data.price_to_sales?.toString(),
      
      // Profitability
      roe: probe42Data.roe?.toString(),
      roce: probe42Data.roce?.toString(),
      roa: probe42Data.roa?.toString(),
      marginEbitda: probe42Data.margin_ebitda?.toString(),
      marginPat: probe42Data.margin_pat?.toString(),
      marginOperating: probe42Data.margin_operating?.toString(),
      
      // Leverage
      debtEquity: probe42Data.debt_equity?.toString(),
      debtToAssets: probe42Data.debt_to_assets?.toString(),
      interestCoverage: probe42Data.interest_coverage?.toString(),
      
      // Liquidity
      currentRatio: probe42Data.current_ratio?.toString(),
      quickRatio: probe42Data.quick_ratio?.toString(),
      
      // Efficiency
      assetTurnover: probe42Data.asset_turnover?.toString(),
      inventoryTurnover: probe42Data.inventory_turnover?.toString(),
      
      // Growth
      revenueGrowth: probe42Data.revenue_growth?.toString(),
      profitGrowth: probe42Data.profit_growth?.toString(),
      
      dataSource: 'probe42',
    };
  }

  // ===================================================================
  // MOCK DATA FOR DEVELOPMENT
  // ===================================================================

  private getMockSearchResults(query: string): Probe42CompanySearchResult[] {
    const mockCompanies = [
      {
        company_id: 'mock_zomato',
        name: 'Zomato Limited',
        cin: 'U74999DL2010PTC198141',
        roc_state: 'Delhi',
        status: 'Active',
        incorporation_date: '2010-01-18',
        keywords: ['zomato', 'food', 'delivery'],
      },
      {
        company_id: 'mock_oyo',
        name: 'Oravel Stays Private Limited',
        cin: 'U55101DL2012PTC238944',
        roc_state: 'Delhi',
        status: 'Active',
        incorporation_date: '2012-09-18',
        keywords: ['oyo', 'oravel', 'hotel', 'stays'],
      },
      {
        company_id: 'mock_swiggy',
        name: 'Bundl Technologies Private Limited',
        cin: 'U74140KA2013PTC096770',
        roc_state: 'Karnataka',
        status: 'Active',
        incorporation_date: '2013-07-22',
        keywords: ['swiggy', 'bundl', 'food', 'delivery'],
      },
      {
        company_id: 'mock_nse',
        name: 'National Stock Exchange of India Limited',
        cin: 'U67120MH1992PLC069769',
        roc_state: 'Maharashtra',
        status: 'Active',
        incorporation_date: '1992-11-27',
        keywords: ['nse', 'stock', 'exchange', 'national'],
      },
      {
        company_id: 'mock_tata_tech',
        name: 'Tata Technologies Limited',
        cin: 'U72200MH1994PLC083847',
        roc_state: 'Maharashtra',
        status: 'Active',
        incorporation_date: '1994-08-22',
        keywords: ['tata', 'technologies', 'engineering'],
      },
      {
        company_id: 'mock_phonepe',
        name: 'PhonePe Private Limited',
        cin: 'U74999KA2015PTC082263',
        roc_state: 'Karnataka',
        status: 'Active',
        incorporation_date: '2015-12-28',
        keywords: ['phonepe', 'phone', 'payments', 'upi'],
      },
      {
        company_id: 'mock_hdb',
        name: 'HDB Financial Services Limited',
        cin: 'U65990MH2007PLC173708',
        roc_state: 'Maharashtra',
        status: 'Active',
        incorporation_date: '2007-08-31',
        keywords: ['hdb', 'hdfc', 'financial', 'nbfc'],
      },
      {
        company_id: 'mock_byju',
        name: 'Think and Learn Private Limited',
        cin: 'U80301KA2011PTC060419',
        roc_state: 'Karnataka',
        status: 'Active',
        incorporation_date: '2011-04-22',
        keywords: ['byju', 'think', 'learn', 'education', 'edtech'],
      },
      {
        company_id: 'mock_flipkart',
        name: 'Flipkart Internet Private Limited',
        cin: 'U51109KA2011PTC060368',
        roc_state: 'Karnataka',
        status: 'Active',
        incorporation_date: '2011-09-29',
        keywords: ['flipkart', 'ecommerce', 'online', 'shopping'],
      },
      {
        company_id: 'mock_paytm',
        name: 'One97 Communications Limited',
        cin: 'U72200DL2000PLC108985',
        roc_state: 'Delhi',
        status: 'Active',
        incorporation_date: '2000-12-22',
        keywords: ['paytm', 'one97', 'payments', 'fintech'],
      },
      {
        company_id: 'mock_care_health',
        name: 'Care Health Insurance Limited',
        cin: 'U66010DL2007PLC161503',
        roc_state: 'Delhi',
        status: 'Active',
        incorporation_date: '2007-02-02',
        keywords: ['care', 'health', 'insurance', 'religare'],
      },
      {
        company_id: 'mock_ncdex',
        name: 'NCDEX Limited',
        cin: 'U51909MH2003PLC140116',
        roc_state: 'Maharashtra',
        status: 'Active',
        incorporation_date: '2003-04-23',
        keywords: ['ncdex', 'commodity', 'exchange'],
      },
      {
        company_id: 'mock_capgemini',
        name: 'Capgemini Technology Services India Limited',
        cin: 'U72200TG1993PLC015206',
        roc_state: 'Telangana',
        status: 'Active',
        incorporation_date: '1993-01-08',
        keywords: ['capgemini', 'technology', 'consulting', 'it'],
      },
      {
        company_id: 'mock_metropolitan',
        name: 'Metropolitan Stock Exchange of India Limited',
        cin: 'U67120MH2008PLC178925',
        roc_state: 'Maharashtra',
        status: 'Active',
        incorporation_date: '2008-10-01',
        keywords: ['metropolitan', 'stock', 'exchange', 'msei'],
      },
    ];

    const queryLower = query.toLowerCase();
    
    return mockCompanies
      .filter(c => 
        c.name.toLowerCase().includes(queryLower) ||
        c.cin.toLowerCase().includes(queryLower) ||
        c.keywords.some(k => k.includes(queryLower) || queryLower.includes(k))
      )
      .map(({ keywords, ...company }) => company);
  }

  private getMockCompanyDetails(companyId: string): Probe42CompanyDetails {
    return {
      company_id: companyId,
      name: 'Mock Company Limited',
      cin: 'U74999DL2010PTC198141',
      sector: 'Technology',
      industry: 'Food Delivery',
      roc_state: 'Delhi',
      incorporation_date: '2010-01-18',
      paid_up_capital: 1000000000,
      authorized_capital: 2000000000,
      face_value: 1,
      total_shares: 1000000000,
      status: 'Active',
      website: 'https://example.com',
      description: 'Mock company for development purposes',
      directors: [
        {
          name: 'Vikram Kumar Limaye',
          din: '00488534',
          designation: 'Managing Director & CEO',
        },
        {
          name: 'Dinesh Kumar Mehrotra',
          din: '00142711',
          designation: 'Chairman',
        },
        {
          name: 'Neeraj Kulshrestha',
          din: '03531199',
          designation: 'Chief Business Operations Officer',
        },
      ],
    };
  }

  private getMockFinancials(companyId: string, years: number): Probe42FinancialData[] {
    const currentYear = new Date().getFullYear();
    const financials: Probe42FinancialData[] = [];

    for (let i = 0; i < years; i++) {
      const fy = `FY${currentYear - i - 1}-${String(currentYear - i).slice(-2)}`;
      financials.push({
        company_id: companyId,
        financial_year: fy,
        period_start: `${currentYear - i - 1}-04-01`,
        period_end: `${currentYear - i}-03-31`,
        
        revenue: 5000000000 * (1 + i * 0.3),
        ebitda: 500000000 * (1 + i * 0.25),
        pat: 200000000 * (1 + i * 0.2),
        total_assets: 3000000000 * (1 + i * 0.15),
        networth: 1500000000 * (1 + i * 0.18),
        total_debt: 500000000 * (1 + i * 0.1),
      });
    }

    return financials;
  }

  private getMockRatios(companyId: string, years: number): Probe42RatiosData[] {
    const currentYear = new Date().getFullYear();
    const ratios: Probe42RatiosData[] = [];

    for (let i = 0; i < years; i++) {
      const fy = `FY${currentYear - i - 1}-${String(currentYear - i).slice(-2)}`;
      ratios.push({
        company_id: companyId,
        financial_year: fy,
        
        pe_ratio: 25.5 + (i * 2),
        pb_ratio: 4.2 + (i * 0.5),
        ev_ebitda: 12.5 + (i * 1),
        roe: 0.18 - (i * 0.02),
        roce: 0.22 - (i * 0.02),
        margin_ebitda: 0.15 - (i * 0.01),
        margin_pat: 0.08 - (i * 0.01),
        debt_equity: 0.35 + (i * 0.05),
        current_ratio: 2.0 - (i * 0.1),
        revenue_growth: 0.28 - (i * 0.03),
        profit_growth: 0.22 - (i * 0.02),
      });
    }

    return ratios;
  }

  /**
   * Full sync method for a company - syncs details, financials, and ratios from Probe42
   * Used by cron jobs for automated data freshness
   */
  async syncCompanyFromProbe42(companyId: string): Promise<{
    success: boolean;
    detailsUpdated: boolean;
    financialsSynced: number;
    ratiosSynced: number;
    error?: string;
  }> {
    const { storage } = await import('../storage');
    
    const result = {
      success: false,
      detailsUpdated: false,
      financialsSynced: 0,
      ratiosSynced: 0,
    };

    try {
      const company = await storage.getUnlistedCompanyById(companyId);
      if (!company) {
        return { ...result, error: 'Company not found' };
      }

      if (!company.probe42CompanyId) {
        return { ...result, error: 'Company not linked to Probe42' };
      }

      const details = await this.getCompanyDetails(company.probe42CompanyId);
      if (details) {
        await storage.updateUnlistedCompany(companyId, {
          cin: details.cin || company.cin,
          sector: details.sector,
          industry: details.industry,
          incorporationDate: details.incorporation_date || undefined,
          paidUpCapital: details.paid_up_capital?.toString(),
          authorizedCapital: details.authorized_capital?.toString(),
          faceValue: details.face_value?.toString(),
          totalShares: details.total_shares ?? undefined,
          website: details.website,
          description: details.description,
          lastSyncedAt: new Date(),
        });
        result.detailsUpdated = true;
      }

      const financials = await this.getCompanyFinancials(company.probe42CompanyId, 5);
      for (const fin of financials) {
        const dbFormat = this.convertFinancialsToDbFormat(companyId, fin);
        const existing = await storage.getCompanyFinancialsByYear(companyId, fin.financial_year);
        if (existing) {
          await storage.updateCompanyFinancials(existing.id, dbFormat);
        } else {
          await storage.createCompanyFinancials(dbFormat);
        }
        result.financialsSynced++;
      }

      const ratios = await this.getCompanyRatios(company.probe42CompanyId, 5);
      for (const ratio of ratios) {
        const dbFormat = this.convertRatiosToDbFormat(companyId, ratio);
        const existing = await storage.getCompanyRatiosByYear(companyId, ratio.financial_year);
        if (existing) {
          await storage.updateCompanyRatios(existing.id, dbFormat);
        } else {
          await storage.createCompanyRatios(dbFormat);
        }
        result.ratiosSynced++;
      }

      result.success = true;
      return result;
    } catch (error: any) {
      return { ...result, error: error.message };
    }
  }

  // ===================================================================
  // IDENTITY CONFIDENCE ENGINE
  // ===================================================================

  /**
   * Compute identity confidence score for a company based on available identifiers
   * Formula: CIN (+0.3) + ISIN (+0.3) + Legal Name Completeness (+0.2) + PAN (+0.2) = max 1.0
   * Returns score and breakdown for transparency
   */
  computeIdentityConfidence(company: {
    cin?: string | null;
    isin?: string | null;
    companyName?: string | null;
    legalName?: string | null;
    pan?: string | null;
  }): {
    score: number;
    status: 'high' | 'medium' | 'review' | 'blocked';
    breakdown: {
      cin: { present: boolean; score: number };
      isin: { present: boolean; score: number };
      legalName: { present: boolean; quality: 'complete' | 'partial' | 'missing'; score: number };
      pan: { present: boolean; score: number };
    };
    enrichmentAllowed: boolean;
    enrichmentBlockReason?: string;
  } {
    const breakdown = {
      cin: { present: false, score: 0, valid: false },
      isin: { present: false, score: 0, valid: false },
      legalName: { present: false, quality: 'missing' as 'complete' | 'partial' | 'missing', score: 0 },
      pan: { present: false, score: 0, valid: false },
    };

    // CIN validation (21 character alphanumeric for Indian companies)
    // Only award full 0.3 for valid CIN format - no partial credit for malformed
    if (company.cin && /^[A-Z]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(company.cin)) {
      breakdown.cin = { present: true, score: 0.3, valid: true };
    } else if (company.cin && company.cin.length > 0) {
      breakdown.cin = { present: true, score: 0, valid: false };
    }

    // ISIN validation (12 character international format: 2 letters + 9 alphanumeric + 1 check digit)
    // Only award full 0.3 for valid ISIN format - no partial credit for malformed
    if (company.isin && /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(company.isin)) {
      breakdown.isin = { present: true, score: 0.3, valid: true };
    } else if (company.isin && company.isin.length > 0) {
      breakdown.isin = { present: true, score: 0, valid: false };
    }

    // Legal name completeness (prefer legalName over companyName)
    // Award 0.2 for complete legal name with entity suffix, 0 otherwise
    const nameToCheck = company.legalName || company.companyName;
    if (nameToCheck) {
      const wordCount = nameToCheck.trim().split(/\s+/).length;
      const hasLegalSuffix = /\b(pvt|private|ltd|limited|llp|inc|corp|plc)\b/i.test(nameToCheck);
      
      if (wordCount >= 2 && hasLegalSuffix) {
        breakdown.legalName = { present: true, quality: 'complete', score: 0.2 };
      } else {
        breakdown.legalName = { present: true, quality: 'partial', score: 0 };
      }
    }

    // PAN validation (10 character: 5 letters + 4 digits + 1 letter)
    // Only award full 0.2 for valid PAN format - no partial credit for malformed
    if (company.pan && /^[A-Z]{5}\d{4}[A-Z]$/.test(company.pan)) {
      breakdown.pan = { present: true, score: 0.2, valid: true };
    } else if (company.pan && company.pan.length > 0) {
      breakdown.pan = { present: true, score: 0, valid: false };
    }

    // Calculate total score
    const score = Number((
      breakdown.cin.score +
      breakdown.isin.score +
      breakdown.legalName.score +
      breakdown.pan.score
    ).toFixed(2));

    // Determine status based on score thresholds
    let status: 'high' | 'medium' | 'review' | 'blocked';
    if (score >= 0.80) {
      status = 'high';
    } else if (score >= 0.60) {
      status = 'medium';
    } else if (score >= 0.40) {
      status = 'review';
    } else {
      status = 'blocked';
    }

    // Enrichment is blocked if confidence < 0.80
    const enrichmentAllowed = score >= 0.80;
    const missingItems: string[] = [];
    if (breakdown.cin.score === 0) missingItems.push('Valid CIN (+30%)');
    if (breakdown.isin.score === 0) missingItems.push('Valid ISIN (+30%)');
    if (breakdown.legalName.score === 0) missingItems.push('Complete Legal Name (+20%)');
    if (breakdown.pan.score === 0) missingItems.push('Valid PAN (+20%)');
    
    const enrichmentBlockReason = !enrichmentAllowed
      ? `Identity confidence ${(score * 100).toFixed(0)}% is below 80% threshold. Provide: ${missingItems.join(', ')}`
      : undefined;

    console.log(`[IdentityConfidence] Computed score ${score} (${status}) for company. Enrichment: ${enrichmentAllowed ? 'ALLOWED' : 'BLOCKED'}`);

    return {
      score,
      status,
      breakdown,
      enrichmentAllowed,
      enrichmentBlockReason,
    };
  }

  /**
   * Check if a company can be enriched with external data
   * Returns detailed eligibility status with actionable feedback
   */
  async checkEnrichmentEligibility(companyId: string): Promise<{
    eligible: boolean;
    confidenceScore: number;
    status: 'high' | 'medium' | 'review' | 'blocked';
    breakdown: {
      cin: { present: boolean; score: number };
      isin: { present: boolean; score: number };
      legalName: { present: boolean; quality: string; score: number };
      pan: { present: boolean; score: number };
    };
    suggestions: string[];
    canOverride: boolean;
  }> {
    const { storage } = await import('../storage');
    
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      throw new ValidationError('Company not found');
    }

    const confidence = this.computeIdentityConfidence({
      cin: company.cin,
      isin: company.isin,
      companyName: company.companyName,
      legalName: company.legalName,
      pan: company.pan,
    });

    // Generate actionable suggestions for improving confidence
    const suggestions: string[] = [];
    if (!confidence.breakdown.cin.present) {
      suggestions.push('Add CIN (Corporate Identity Number) - adds +30% confidence');
    }
    if (!confidence.breakdown.isin.present) {
      suggestions.push('Add ISIN (International Securities Identification Number) - adds +30% confidence');
    }
    if (confidence.breakdown.legalName.quality !== 'complete') {
      suggestions.push('Ensure legal name includes entity type suffix (Pvt Ltd, Limited, LLP) - adds up to +20% confidence');
    }
    if (!confidence.breakdown.pan.present) {
      suggestions.push('Add PAN (Permanent Account Number) - adds +20% confidence');
    }

    // Admin can override for medium confidence (0.60-0.79) companies
    const canOverride = confidence.status === 'medium';

    return {
      eligible: confidence.enrichmentAllowed,
      confidenceScore: confidence.score,
      status: confidence.status,
      breakdown: confidence.breakdown,
      suggestions,
      canOverride,
    };
  }

  /**
   * Update company identity confidence in database after computing
   * Returns updated company with new confidence values
   */
  async updateCompanyIdentityConfidence(companyId: string): Promise<{
    success: boolean;
    score: number;
    status: string;
    error?: string;
  }> {
    const { storage } = await import('../storage');
    
    try {
      const company = await storage.getUnlistedCompanyById(companyId);
      if (!company) {
        return { success: false, score: 0, status: 'blocked', error: 'Company not found' };
      }

      const confidence = this.computeIdentityConfidence({
        cin: company.cin,
        isin: company.isin,
        companyName: company.companyName,
        legalName: company.legalName,
        pan: company.pan,
      });

      // Update company with computed confidence
      await storage.updateUnlistedCompany(companyId, {
        identityConfidence: confidence.score.toString(),
        identityStatus: confidence.status,
      });

      console.log(`[IdentityConfidence] Updated company ${companyId}: score=${confidence.score}, status=${confidence.status}`);

      return {
        success: true,
        score: confidence.score,
        status: confidence.status,
      };
    } catch (error: any) {
      console.error(`[IdentityConfidence] Failed to update company ${companyId}: ${error.message}`);
      return {
        success: false,
        score: 0,
        status: 'blocked',
        error: error.message,
      };
    }
  }

  /**
   * Batch update identity confidence for all companies
   * Used by cron jobs for periodic confidence recalculation
   */
  async batchUpdateIdentityConfidence(limit: number = 100): Promise<{
    processed: number;
    updated: number;
    errors: number;
    details: Array<{ companyId: string; score: number; status: string; error?: string }>;
  }> {
    const { storage } = await import('../storage');
    
    const result = {
      processed: 0,
      updated: 0,
      errors: 0,
      details: [] as Array<{ companyId: string; score: number; status: string; error?: string }>,
    };

    try {
      const companies = await storage.getAllUnlistedCompanies();
      const toProcess = companies.slice(0, limit);

      for (const company of toProcess) {
        result.processed++;
        const updateResult = await this.updateCompanyIdentityConfidence(company.id);
        
        if (updateResult.success) {
          result.updated++;
        } else {
          result.errors++;
        }
        
        result.details.push({
          companyId: company.id,
          score: updateResult.score,
          status: updateResult.status,
          error: updateResult.error,
        });
      }

      console.log(`[IdentityConfidence] Batch update complete: ${result.updated}/${result.processed} updated, ${result.errors} errors`);
      return result;
    } catch (error: any) {
      console.error(`[IdentityConfidence] Batch update failed: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
export const probe42Service = new Probe42Service();

/**
 * Enrich an unlisted company with MCA financial data from Probe42
 * Fetches financials, charges, credit ratings and stores in companyFinancials table
 */
export async function enrichUnlistedCompanyWithMCAData(
  companyId: string,
  cin: string
): Promise<{
  success: boolean;
  enrichedData?: {
    financials: any[];
    charges: any;
    creditRatings: any;
    legalCases: any;
    directors: any[];
  };
  financialsStored?: number;
  message: string;
}> {
  try {
    console.log(`🔄 Enriching unlisted company ${companyId} (CIN: ${cin}) with MCA data...`);
    
    // Fetch comprehensive data from Probe42
    // Note: getCompanyDetails returns Probe42CompanyDetails | null directly
    // Note: getCompanyFinancials returns Probe42FinancialData[] directly
    const [details, financialData] = await Promise.all([
      probe42Service.getCompanyDetails(cin),
      probe42Service.getCompanyFinancials(cin)
    ]);
    
    if (!details) {
      return {
        success: false,
        message: 'Failed to fetch company details from Probe42'
      };
    }
    
    // details is directly the Probe42CompanyDetails object
    const directors = details.directors || [];
    console.log(`📋 Got ${directors.length} directors from Probe42`);
    
    // Store financials in database
    const { db } = await import('../db');
    const { companyFinancials, unlistedCompanies } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    
    let financialsStored = 0;
    
    for (const financial of financialData) {
      const financialYear = financial.financial_year || 'Unknown';
      
      // Check if record exists for this company and financial year
      const [existing] = await db.select()
        .from(companyFinancials)
        .where(and(
          eq(companyFinancials.companyId, companyId),
          eq(companyFinancials.financialYear, financialYear)
        ))
        .limit(1);
      
      const dataToStore = {
        companyId,
        financialYear,
        revenue: financial.revenue?.toString() || null,
        ebitda: financial.ebitda?.toString() || null,
        pat: financial.pat?.toString() || financial.net_profit?.toString() || null,
        netProfit: financial.net_profit?.toString() || null,
        pbt: financial.pbt?.toString() || null,
        totalAssets: financial.total_assets?.toString() || null,
        totalLiabilities: financial.total_liabilities?.toString() || null,
        networth: financial.networth?.toString() || null,
        totalDebt: financial.total_debt?.toString() || null,
        longTermDebt: financial.long_term_debt?.toString() || null,
        shortTermDebt: financial.short_term_debt?.toString() || null,
        shareCapital: financial.share_capital?.toString() || null,
        reserves: financial.reserves?.toString() || null,
        operatingCashFlow: financial.operating_cash_flow?.toString() || null,
        investingCashFlow: financial.investing_cash_flow?.toString() || null,
        financingCashFlow: financial.financing_cash_flow?.toString() || null,
        freeCashFlow: financial.free_cash_flow?.toString() || null,
        dataSource: 'probe42',
        verified: true,
        confidenceScore: '0.95',
        aiAllowed: true,
        executionAllowed: true,
      };
      
      if (existing) {
        await db.update(companyFinancials)
          .set({ ...dataToStore, updatedAt: new Date() })
          .where(eq(companyFinancials.id, existing.id));
      } else {
        await db.insert(companyFinancials).values(dataToStore);
      }
      financialsStored++;
    }
    
    // Update unlisted company with enriched data including capital structure
    const companyUpdateData: any = {
      lastSyncedAt: new Date(),
      directors: directors.map((d: any) => ({
        name: d.name,
        din: d.din,
        designation: d.designation
      })),
      identityConfidence: '0.95',
      identityStatus: 'active',
      updatedAt: new Date(),
    };
    
    // Add capital data if available from Probe42
    if (details.paid_up_capital) {
      companyUpdateData.paidUpCapital = details.paid_up_capital.toString();
      console.log(`💰 Setting paid up capital: ${details.paid_up_capital}`);
    }
    if (details.authorized_capital) {
      companyUpdateData.authorizedCapital = details.authorized_capital.toString();
      console.log(`💰 Setting authorized capital: ${details.authorized_capital}`);
    }
    if (details.face_value) {
      companyUpdateData.faceValue = details.face_value.toString();
    }
    
    await db.update(unlistedCompanies)
      .set(companyUpdateData)
      .where(eq(unlistedCompanies.id, companyId));
    
    // Calculate and store comprehensive financial ratios from MCA data
    // Uses real formulas for regulatory compliance
    const { companyRatios } = await import('@shared/schema');
    
    if (financialData.length > 0) {
      const latestFinancial = financialData[0];
      const netProfit = parseFloat(latestFinancial.net_profit || latestFinancial.pat || '0');
      const networth = parseFloat(latestFinancial.networth || '0');
      const totalDebt = parseFloat(latestFinancial.total_debt || '0');
      const totalAssets = parseFloat(latestFinancial.total_assets || '0');
      const revenue = parseFloat(latestFinancial.revenue || '0');
      const ebitda = parseFloat(latestFinancial.ebitda || '0');
      const pbt = parseFloat(latestFinancial.pbt || '0');
      const longTermDebt = parseFloat(latestFinancial.long_term_debt || '0');
      const shareCapital = parseFloat(latestFinancial.share_capital || details.paid_up_capital || '0');
      const financialYear = latestFinancial.financial_year || 'FY2024';
      
      // Get current trading price and face value for P/E and P/B calculations
      const [companyData] = await db.select()
        .from(unlistedCompanies)
        .where(eq(unlistedCompanies.id, companyId))
        .limit(1);
      
      const currentPrice = parseFloat(companyData?.currentPrice || '0');
      const faceValue = parseFloat(companyData?.faceValue || details.face_value || '10'); // Default ₹10 face value
      
      // Calculate shares outstanding from paid-up capital and face value
      // Formula: Shares Outstanding = Paid-up Capital / Face Value
      const sharesOutstanding = faceValue > 0 ? shareCapital / faceValue : 0;
      
      // ===============================
      // PROFITABILITY RATIOS (from MCA)
      // ===============================
      
      // ROE = (Net Profit / Networth) × 100
      const roe = networth > 0 ? (netProfit / networth) * 100 : null;
      
      // ROA = (Net Profit / Total Assets) × 100
      const roa = totalAssets > 0 ? (netProfit / totalAssets) * 100 : null;
      
      // ROCE = EBIT / Capital Employed × 100
      // Capital Employed = Networth + Long-term Debt (or Total Assets - Current Liabilities)
      // EBIT ≈ PBT + Interest Expense, or use EBITDA as approximation
      const capitalEmployed = networth + longTermDebt;
      // Use EBITDA as proxy for operating profit if EBIT not available
      const ebit = ebitda || pbt; // Approximation
      const roce = capitalEmployed > 0 && ebit > 0 ? (ebit / capitalEmployed) * 100 : null;
      
      // Net Profit Margin = (Net Profit / Revenue) × 100
      const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : null;
      
      // EBITDA Margin = (EBITDA / Revenue) × 100
      const ebitdaMargin = revenue > 0 && ebitda > 0 ? (ebitda / revenue) * 100 : null;
      
      // ===============================
      // VALUATION RATIOS (require price)
      // ===============================
      
      // EPS = Net Profit / Shares Outstanding
      const eps = sharesOutstanding > 0 ? netProfit / sharesOutstanding : null;
      
      // P/E Ratio = Current Price / EPS
      // Only calculate if we have current price and positive EPS
      const peRatio = eps && eps > 0 && currentPrice > 0 ? currentPrice / eps : null;
      
      // Book Value Per Share = Networth / Shares Outstanding
      const bookValuePerShare = sharesOutstanding > 0 ? networth / sharesOutstanding : null;
      
      // P/B Ratio = Current Price / Book Value Per Share
      const pbRatio = bookValuePerShare && bookValuePerShare > 0 && currentPrice > 0 
        ? currentPrice / bookValuePerShare : null;
      
      // ===============================
      // LEVERAGE RATIOS
      // ===============================
      
      // Debt to Equity = Total Debt / Networth
      const debtEquity = networth > 0 ? totalDebt / networth : null;
      
      // Check if ratios exist for this company/year
      const [existingRatios] = await db.select()
        .from(companyRatios)
        .where(and(
          eq(companyRatios.companyId, companyId),
          eq(companyRatios.financialYear, financialYear)
        ))
        .limit(1);
      
      const ratiosData: any = {
        companyId,
        financialYear,
        // Profitability ratios
        roe: roe !== null ? roe.toFixed(2) : null,
        roa: roa !== null ? roa.toFixed(2) : null,
        roce: roce !== null ? roce.toFixed(2) : null,
        marginPat: netProfitMargin !== null ? netProfitMargin.toFixed(2) : null,
        marginEbitda: ebitdaMargin !== null ? ebitdaMargin.toFixed(2) : null,
        // Valuation ratios (only if current price available)
        peRatio: peRatio !== null ? peRatio.toFixed(2) : null,
        pbRatio: pbRatio !== null ? pbRatio.toFixed(2) : null,
        // Leverage ratios
        debtEquity: debtEquity !== null ? debtEquity.toFixed(2) : null,
        // Data source attribution for audit trail
        dataSource: 'probe42_mca',
      };
      
      if (existingRatios) {
        await db.update(companyRatios)
          .set({ ...ratiosData, updatedAt: new Date() })
          .where(eq(companyRatios.id, existingRatios.id));
      } else {
        await db.insert(companyRatios).values(ratiosData);
      }
      
      console.log(`📊 Stored ratios from MCA data:`);
      console.log(`   ROE=${roe?.toFixed(2)}%, ROCE=${roce?.toFixed(2)}%, D/E=${debtEquity?.toFixed(2)}`);
      if (peRatio) console.log(`   P/E=${peRatio.toFixed(2)}, P/B=${pbRatio?.toFixed(2)} (using price ₹${currentPrice})`);
    }
    
    console.log(`✅ Enriched ${companyId} with ${financialsStored} financial records, capital & ratios`);
    
    return {
      success: true,
      enrichedData: {
        financials: financialData,
        charges: null,
        creditRatings: null,
        legalCases: null,
        directors,
      },
      financialsStored,
      message: `Successfully enriched with ${financialsStored} financial records`
    };
  } catch (error: any) {
    console.error(`❌ Failed to enrich unlisted company ${companyId}:`, error);
    return {
      success: false,
      message: error.message || 'Failed to enrich company data'
    };
  }
}
