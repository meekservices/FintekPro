/**
 * Probe42 Integration Service
 * Handles all interactions with Probe42 API for company financial data
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
import type { 
  InsertCompanyFinancials, 
  InsertCompanyRatios,
  InsertProbe42SyncLog 
} from '@shared/schema';

// Environment configuration
const PROBE42_API_KEY = process.env.PROBE42_API_KEY || '';
const PROBE42_BASE_URL = process.env.PROBE42_BASE_URL || 'https://api.probe42.in/api/v1';

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

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
      // Use a simple search query to test connectivity
      const response = await this.client.get('/companies/search', {
        params: { q: 'test', limit: 1 }
      });
      
      const responseTime = Date.now() - startTime;
      this.lastHealthCheck = {
        status: 'healthy',
        timestamp: new Date(),
      };
      
      return {
        status: 'healthy',
        message: 'Probe42 API is accessible and authenticated',
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
      console.log(`[Probe42] Searching real API for: "${query}"`);
      const response = await this.client.get('/companies/search', {
        params: { q: query }
      });

      const results = response.data.companies || [];
      console.log(`[Probe42] Found ${results.length} companies for query: "${query}"`);
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
   * Get detailed company information
   */
  async getCompanyDetails(probe42CompanyId: string): Promise<Probe42CompanyDetails | null> {
    if (!probe42CompanyId) {
      throw new ValidationError('Company ID is required');
    }

    if (!this.isConfigured) {
      return this.getMockCompanyDetails(probe42CompanyId);
    }

    try {
      const response = await this.client.get(`/companies/${probe42CompanyId}`);
      return response.data.company || null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      // Handle authentication errors gracefully - fall back to mock data in development
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.warn('⚠️ Probe42 API authentication failed (token may be expired). Using mock data.');
        if (process.env.NODE_ENV === 'development') {
          return this.getMockCompanyDetails(probe42CompanyId);
        }
      }
      throw new ExternalServiceError(
        'Probe42',
        `Failed to fetch company details: ${error.message}`,
        error,
        true
      );
    }
  }

  /**
   * Get company financial statements for multiple years
   */
  async getCompanyFinancials(
    probe42CompanyId: string,
    years: number = 3
  ): Promise<Probe42FinancialData[]> {
    if (!probe42CompanyId) {
      throw new ValidationError('Company ID is required');
    }

    if (!this.isConfigured) {
      return this.getMockFinancials(probe42CompanyId, years);
    }

    try {
      const response = await this.client.get(`/companies/${probe42CompanyId}/financials`, {
        params: { years }
      });

      return response.data.financials || [];
    } catch (error: any) {
      // Handle authentication errors gracefully - fall back to mock data in development
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.warn('⚠️ Probe42 API authentication failed (token may be expired). Using mock data.');
        if (process.env.NODE_ENV === 'development') {
          return this.getMockFinancials(probe42CompanyId, years);
        }
      }
      throw new ExternalServiceError(
        'Probe42',
        `Failed to fetch company financials: ${error.message}`,
        error,
        true
      );
    }
  }

  /**
   * Get company financial ratios
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

    try {
      const response = await this.client.get(`/companies/${probe42CompanyId}/ratios`, {
        params: { years }
      });

      return response.data.ratios || [];
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
        
        pe_ratio: 45.5,
        pb_ratio: 8.2,
        roe: 0.12,
        roce: 0.15,
        margin_ebitda: 0.10,
        margin_pat: 0.04,
        debt_equity: 0.33,
        current_ratio: 1.8,
        revenue_growth: 0.30,
        profit_growth: 0.20,
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
          incorporationDate: details.incorporation_date ? new Date(details.incorporation_date) : undefined,
          paidUpCapital: details.paid_up_capital?.toString(),
          authorizedCapital: details.authorized_capital?.toString(),
          faceValue: details.face_value?.toString(),
          totalShares: details.total_shares?.toString(),
          website: details.website,
          description: details.description,
          lastSynced: new Date(),
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
}

// Export singleton instance
export const probe42Service = new Probe42Service();
