/**
 * MCA (Ministry of Corporate Affairs) Service
 * Fallback data source for official company filings
 * 
 * Uses Sandbox.co.in API to access MCA data:
 * - Company Master Data (CIN lookup)
 * - Director Master Data (DIN lookup)
 * - Official filings and compliance status
 * 
 * Data is sourced directly from MCA21 portal via Sandbox API
 */

import axios, { AxiosInstance } from 'axios';
import type { InsertCompanyFinancials } from '@shared/schema';

import { getSandboxBaseUrl, getSandboxApiKey, getSandboxApiSecret } from '../utils/sandbox-config';

const SANDBOX_API_KEY = getSandboxApiKey();
const SANDBOX_API_SECRET = getSandboxApiSecret();
const SANDBOX_BASE_URL = getSandboxBaseUrl();

export interface MCAShareholding {
  financialYear: string;
  promoterHolding?: number;
  publicHolding?: number;
  institutionalHolding?: number;
  foreignHolding?: number;
}

export interface MCACompanyMasterData {
  cin: string;
  companyName: string;
  companyStatus: string;
  companyCategory: string;
  companySubcategory: string;
  classOfCompany: string;
  dateOfIncorporation: string;
  rocCode: string;
  registeredAddress: string;
  emailId?: string;
  authorizedCapital: number;
  paidUpCapital: number;
  whetherListedOrNot: string;
  suspendedAtStockExchange: string;
  dateOfLastAgm?: string;
  dateOfBalanceSheet?: string;
  activeCompliance: string;
  rdRegion?: string;
  directors: MCADirector[];
  charges: MCACharge[];
  balanceSheets: MCABalanceSheet[];
  annualReturns: MCAAnnualReturn[];
  shareholding?: MCAShareholding[];
}

export interface MCADirector {
  din: string;
  name: string;
  designation: string;
  beginDate: string;
  endDate?: string;
}

export interface MCACharge {
  dateOfCreation: string;
  dateOfModification?: string;
  chargeAmount: number;
  status: string;
}

export interface MCABalanceSheet {
  filingDate: string;
  financialYear: string;
  srn?: string;
}

export interface MCAAnnualReturn {
  filingDate: string;
  financialYear: string;
  srn?: string;
}

export interface MCASearchResult {
  cin: string;
  name: string;
  status: string;
  category: string;
  authorizedCapital: number;
  paidUpCapital: number;
  dateOfIncorporation: string;
}

export interface MCAApiError {
  code: number;
  message: string;
  troubleshooting: string;
  isRetryable: boolean;
}

export interface MCAFetchResult {
  success: boolean;
  data?: MCACompanyMasterData;
  error?: MCAApiError;
}

class MCAService {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: SANDBOX_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get or refresh access token for Sandbox API
   * Uses x-api-key and x-api-secret headers for authentication
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
      throw new Error('Sandbox API credentials not configured');
    }

    try {
      console.log('[MCA] Fetching new access token from Sandbox...');
      
      // Sandbox.co.in uses x-api-key and x-api-secret headers for authentication
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/authenticate`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': SANDBOX_API_KEY,
            'x-api-secret': SANDBOX_API_SECRET,
          },
        }
      );

      if (response.data?.access_token) {
        const token: string = response.data.access_token;
        this.accessToken = token;
        // Token typically expires in 24 hours, but we refresh at 23 hours to be safe
        this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
        console.log('[MCA] Access token obtained successfully');
        return token;
      }

      throw new Error('Failed to obtain access token');
    } catch (error: any) {
      console.error('[MCA] Authentication error:', error.response?.data || error.message);
      throw new Error(`MCA authentication failed: ${error.message}`);
    }
  }

  /**
   * Get company master data by CIN
   */
  async getCompanyByCIN(cin: string): Promise<MCACompanyMasterData | null> {
    if (!cin || cin.length !== 21) {
      console.log('[MCA] Invalid CIN format:', cin);
      return null;
    }

    try {
      const token = await this.getAccessToken();
      
      console.log(`[MCA] Fetching company data for CIN: ${cin}`);
      
      const response = await this.client.post(
        '/mca/company/master-data/search',
        {
          '@entity': 'in.co.sandbox.kyc.mca.master_data.request',
          id: cin,
          consent: 'y',
          reason: 'for KYC and financial analysis',
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-api-key': SANDBOX_API_KEY,
            'x-api-version': '1.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data?.code === 200 && response.data?.data?.company_master_data) {
        const data = response.data.data;
        const masterData = data.company_master_data;
        
        return this.transformMCAResponse(masterData, data);
      }

      console.log('[MCA] No data found for CIN:', cin);
      return null;
    } catch (error: any) {
      console.error('[MCA] Error fetching company:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Get company master data by CIN with detailed error information
   * Returns structured result with success/failure details for UI display
   */
  async getCompanyByCINWithDetails(cin: string): Promise<MCAFetchResult> {
    if (!cin || cin.length !== 21) {
      return {
        success: false,
        error: {
          code: 400,
          message: 'Invalid CIN format',
          troubleshooting: 'CIN must be exactly 21 characters in the format: U12345AB1234ABC123456',
          isRetryable: false
        }
      };
    }

    if (!SANDBOX_API_KEY || !SANDBOX_API_SECRET) {
      return {
        success: false,
        error: {
          code: 401,
          message: 'API credentials not configured',
          troubleshooting: 'Sandbox.co.in API credentials (SANDBOX_API_KEY, SANDBOX_API_SECRET) are not set. Contact system administrator.',
          isRetryable: false
        }
      };
    }

    try {
      const token = await this.getAccessToken();
      
      console.log(`[MCA] Fetching company data for CIN: ${cin}`);
      
      const response = await this.client.post(
        '/mca/company/master-data/search',
        {
          '@entity': 'in.co.sandbox.kyc.mca.master_data.request',
          id: cin,
          consent: 'y',
          reason: 'for KYC and financial analysis',
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'x-api-key': SANDBOX_API_KEY,
            'x-api-version': '1.0',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data?.code === 200 && response.data?.data?.company_master_data) {
        const data = response.data.data;
        const masterData = data.company_master_data;
        
        return {
          success: true,
          data: this.transformMCAResponse(masterData, data)
        };
      }

      return {
        success: false,
        error: {
          code: response.data?.code || 404,
          message: 'Company not found in MCA database',
          troubleshooting: 'The CIN may not exist in MCA records, or the company data is not yet available. Try verifying the CIN on the MCA portal.',
          isRetryable: false
        }
      };
    } catch (error: any) {
      const errorCode = error.response?.data?.code || error.response?.status || 500;
      const errorMessage = error.response?.data?.message || error.message;
      
      console.error('[MCA] Error fetching company:', error.response?.data || error.message);

      // Map common error codes to user-friendly messages
      let troubleshooting: string;
      let isRetryable: boolean;

      switch (errorCode) {
        case 401:
          troubleshooting = 'Authentication failed. API credentials may be expired or invalid. Contact system administrator.';
          isRetryable = false;
          break;
        case 403:
          troubleshooting = 'Access denied by Sandbox.co.in API. Possible causes: (1) API subscription does not include this CIN, (2) API quota exhausted, (3) CIN not indexed in test environment. Try in production or contact Sandbox support.';
          isRetryable = false;
          break;
        case 404:
          troubleshooting = 'Company not found. The CIN may be incorrect or the company is not registered with MCA.';
          isRetryable = false;
          break;
        case 429:
          troubleshooting = 'Rate limit exceeded. Too many requests to Sandbox.co.in API. Please wait a few minutes and try again.';
          isRetryable = true;
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          troubleshooting = 'Sandbox.co.in API is temporarily unavailable. Please try again later.';
          isRetryable = true;
          break;
        default:
          troubleshooting = `Unexpected error from MCA API. Error details: ${errorMessage}`;
          isRetryable = true;
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
   * Transform MCA API response to our format
   */
  private transformMCAResponse(masterData: any, fullData: any): MCACompanyMasterData {
    const parseNumber = (value: string | number | undefined): number => {
      if (typeof value === 'number') return value;
      if (!value) return 0;
      return parseFloat(value.toString().replace(/[,\s]/g, '')) || 0;
    };

    const parseDate = (dateStr: string | undefined): string => {
      if (!dateStr || dateStr === '-') return '';
      // MCA dates are typically in DD/MM/YYYY format
      try {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      } catch { }
      return dateStr;
    };

    // Parse directors
    const directors: MCADirector[] = (fullData['directors/signatory_details'] || []).map((d: any) => ({
      din: d['din/pan'] || '',
      name: d.name || '',
      designation: d.designation || '',
      beginDate: parseDate(d.begin_date),
      endDate: d.end_date !== '-' ? parseDate(d.end_date) : undefined,
    }));

    // Parse charges
    const charges: MCACharge[] = (fullData.charges || []).map((c: any) => ({
      dateOfCreation: parseDate(c.date_of_creation),
      dateOfModification: c.date_of_modification !== '-' ? parseDate(c.date_of_modification) : undefined,
      chargeAmount: parseNumber(c.charge_amount),
      status: c.status || '',
    }));

    // Parse shareholding patterns (from Sandbox API or balance sheet data)
    const shareholding: MCAShareholding[] = [];
    const shareholdingData = fullData.shareholding_pattern || fullData.shareholding || [];
    for (const sh of shareholdingData) {
      shareholding.push({
        financialYear: sh.financial_year || sh.financialYear || '',
        promoterHolding: parseNumber(sh.promoter_holding || sh.promoterHolding),
        publicHolding: parseNumber(sh.public_holding || sh.publicHolding),
        institutionalHolding: parseNumber(sh.institutional_holding || sh.institutionalHolding),
        foreignHolding: parseNumber(sh.foreign_holding || sh.foreignHolding),
      });
    }
    
    // If no shareholding data from API, derive from balance sheet years (placeholder)
    if (shareholding.length === 0 && masterData.whether_listed_or_not?.toLowerCase() === 'unlisted') {
      const latestFY = masterData.date_of_balance_sheet ? 
        masterData.date_of_balance_sheet.split('/').pop() : 
        new Date().getFullYear().toString();
      // For unlisted companies, typically 100% promoter holding
      shareholding.push({
        financialYear: latestFY ? `${parseInt(latestFY)-1}-${latestFY.slice(-2)}` : '',
        promoterHolding: 100,
        publicHolding: 0,
        institutionalHolding: 0,
        foreignHolding: 0,
      });
    }

    return {
      cin: masterData.cin || '',
      companyName: masterData.company_name || '',
      companyStatus: masterData['company_status(for_efiling)'] || masterData.company_status || '',
      companyCategory: masterData.company_category || '',
      companySubcategory: masterData.company_subcategory || '',
      classOfCompany: masterData.class_of_company || '',
      dateOfIncorporation: parseDate(masterData.date_of_incorporation),
      rocCode: masterData.roc_code || '',
      registeredAddress: masterData.registered_address || '',
      emailId: masterData.email_id,
      authorizedCapital: parseNumber(masterData['authorised_capital(rs)']),
      paidUpCapital: parseNumber(masterData['paid_up_capital(rs)']),
      whetherListedOrNot: masterData.whether_listed_or_not || 'Unlisted',
      suspendedAtStockExchange: masterData.suspended_at_stock_exchange || '-',
      dateOfLastAgm: parseDate(masterData.date_of_last_agm),
      dateOfBalanceSheet: parseDate(masterData.date_of_balance_sheet),
      activeCompliance: masterData.active_compliance || '',
      rdRegion: masterData.rd_region,
      directors,
      charges,
      balanceSheets: masterData.balance_sheets || [],
      annualReturns: masterData.annual_returns || [],
      shareholding,
    };
  }

  /**
   * Get director master data by DIN
   */
  async getDirectorByDIN(din: string): Promise<MCADirector | null> {
    if (!din || din.length < 7) {
      console.log('[MCA] Invalid DIN format:', din);
      return null;
    }

    try {
      const token = await this.getAccessToken();
      
      console.log(`[MCA] Fetching director data for DIN: ${din}`);
      
      const response = await this.client.post(
        '/mca/director/master-data/search',
        {
          '@entity': 'in.co.sandbox.kyc.mca.master_data.request',
          id: din,
          consent: 'y',
          reason: 'for KYC verification',
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data?.code === 200 && response.data?.data) {
        const data = response.data.data;
        return {
          din: data.din || din,
          name: data.name || '',
          designation: data.designation || '',
          beginDate: '',
        };
      }

      return null;
    } catch (error: any) {
      console.error('[MCA] Error fetching director:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return !!(SANDBOX_API_KEY && SANDBOX_API_SECRET);
  }

  /**
   * Search for company CIN by company name
   * Used when we have ISIN but not CIN - searches MCA database by name
   */
  async searchCompanyByName(companyName: string): Promise<MCASearchResult[]> {
    if (!companyName || companyName.length < 3) {
      console.log('[MCA] Company name too short for search:', companyName);
      return [];
    }

    try {
      const token = await this.getAccessToken();
      
      // Clean up company name for search
      const searchName = companyName
        .replace(/\s+(Ltd|Limited|Pvt|Private)\.?$/i, '')
        .replace(/[^\w\s]/g, '')
        .trim();
      
      console.log(`[MCA] Searching companies by name: "${searchName}"`);
      
      const response = await this.client.post(
        '/mca/company/search',
        {
          '@entity': 'in.co.sandbox.kyc.mca.search.request',
          company_name: searchName,
          consent: 'y',
          reason: 'for company identification and KYC',
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data?.code === 200 && response.data?.data?.companies) {
        const companies = response.data.data.companies;
        console.log(`[MCA] Found ${companies.length} companies matching "${searchName}"`);
        
        return companies.map((c: any) => ({
          cin: c.cin || c.CIN || '',
          name: c.company_name || c.name || '',
          status: c.company_status || c.status || '',
          category: c.company_category || '',
          authorizedCapital: parseFloat(c.authorized_capital) || 0,
          paidUpCapital: parseFloat(c.paid_up_capital) || 0,
          dateOfIncorporation: c.date_of_incorporation || '',
        }));
      }

      console.log('[MCA] No companies found for:', searchName);
      return [];
    } catch (error: any) {
      console.error('[MCA] Error searching companies:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get CIN by searching for company name (used when ISIN exists but CIN doesn't)
   * Returns the best matching CIN based on name similarity
   */
  async getCINByCompanyName(companyName: string): Promise<{ cin: string; officialName: string } | null> {
    if (!companyName) return null;

    const results = await this.searchCompanyByName(companyName);
    
    if (results.length === 0) return null;

    // Find best match by comparing names
    const normalizedInput = companyName.toLowerCase().replace(/[^\w\s]/g, '').trim();
    
    let bestMatch: MCASearchResult | null = null;
    let bestScore = 0;

    for (const result of results) {
      const normalizedResult = result.name.toLowerCase().replace(/[^\w\s]/g, '').trim();
      
      // Calculate similarity score
      let score = 0;
      
      // Exact match
      if (normalizedInput === normalizedResult) {
        score = 100;
      }
      // Contains the input name
      else if (normalizedResult.includes(normalizedInput) || normalizedInput.includes(normalizedResult)) {
        score = 80;
      }
      // Word overlap
      else {
        const inputWords = normalizedInput.split(/\s+/);
        const resultWords = new Set(normalizedResult.split(/\s+/));
        let matchingWords = 0;
        for (const word of inputWords) {
          if (word.length > 2 && resultWords.has(word)) {
            matchingWords++;
          }
        }
        score = (matchingWords / Math.max(inputWords.length, resultWords.size)) * 70;
      }

      // Prefer active companies
      if (result.status.toLowerCase().includes('active')) {
        score += 10;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = result;
      }
    }

    // Only return if we have a reasonable match (>40% confidence)
    if (bestMatch && bestScore >= 40) {
      console.log(`[MCA] Best match for "${companyName}": "${bestMatch.name}" (CIN: ${bestMatch.cin}, score: ${bestScore})`);
      return {
        cin: bestMatch.cin,
        officialName: bestMatch.name,
      };
    }

    console.log(`[MCA] No confident match found for "${companyName}" (best score: ${bestScore})`);
    return null;
  }

  /**
   * Convert MCA data to FintekPro company format
   */
  toFintekProCompanyData(mcaData: MCACompanyMasterData): {
    name: string;
    cin: string;
    status: string;
    industry?: string;
    sector?: string;
    description?: string;
    faceValue?: string;
    totalShares?: string;
    paidUpCapital?: string;
    authorizedCapital?: string;
    incorporationDate?: string;
    registeredAddress?: string;
  } {
    // Calculate total shares from paid-up capital (assuming face value of 10)
    const assumedFaceValue = 10;
    const totalShares = mcaData.paidUpCapital > 0 
      ? Math.floor(mcaData.paidUpCapital / assumedFaceValue) 
      : undefined;

    return {
      name: mcaData.companyName,
      cin: mcaData.cin,
      status: mcaData.companyStatus.toLowerCase().includes('active') ? 'active' : 'inactive',
      industry: mcaData.companySubcategory || undefined,
      sector: mcaData.companyCategory || undefined,
      faceValue: assumedFaceValue.toString(),
      totalShares: totalShares?.toString(),
      paidUpCapital: mcaData.paidUpCapital.toString(),
      authorizedCapital: mcaData.authorizedCapital.toString(),
      incorporationDate: mcaData.dateOfIncorporation || undefined,
      registeredAddress: mcaData.registeredAddress || undefined,
    };
  }

  /**
   * Calculate basic financial ratios from MCA capital data
   * Note: MCA provides limited financial data, primarily capital structure
   */
  estimateBasicMetrics(mcaData: MCACompanyMasterData): {
    debtEquity?: number;
    totalCharges?: number;
    hasActiveCharges: boolean;
  } {
    // Calculate total active charges
    const activeCharges = mcaData.charges.filter(c => c.status.toLowerCase() !== 'closed');
    const totalActiveChargeAmount = activeCharges.reduce((sum, c) => sum + c.chargeAmount, 0);
    
    // Debt to Equity ratio (using charges as proxy for debt)
    const debtEquity = mcaData.paidUpCapital > 0 
      ? totalActiveChargeAmount / mcaData.paidUpCapital 
      : undefined;

    return {
      debtEquity,
      totalCharges: totalActiveChargeAmount,
      hasActiveCharges: activeCharges.length > 0,
    };
  }
}

export const mcaService = new MCAService();
