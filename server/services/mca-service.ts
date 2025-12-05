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

// Environment configuration - uses existing Sandbox credentials
const SANDBOX_API_KEY = process.env.SANDBOX_API_KEY || '';
const SANDBOX_API_SECRET = process.env.SANDBOX_API_SECRET || '';
const SANDBOX_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://api.sandbox.co.in' 
  : 'https://test-api.sandbox.co.in';

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
      
      // Sandbox uses Basic auth with API key and secret for token generation
      const authString = Buffer.from(`${SANDBOX_API_KEY}:${SANDBOX_API_SECRET}`).toString('base64');
      
      const response = await axios.post(
        `${SANDBOX_BASE_URL}/authenticate`,
        {},
        {
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json',
            'x-api-key': SANDBOX_API_KEY,
          },
        }
      );

      if (response.data?.access_token) {
        const token: string = response.data.access_token;
        this.accessToken = token;
        // Token typically expires in 1 hour
        this.tokenExpiry = new Date(Date.now() + 50 * 60 * 1000); // 50 minutes to be safe
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
            'Authorization': token,
            'x-api-key': SANDBOX_API_KEY,
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
            'Authorization': token,
            'x-api-key': SANDBOX_API_KEY,
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
