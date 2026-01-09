/**
 * Probe42 API Service
 * 
 * Corporate data intelligence platform for India providing:
 * - Company verification and financial data
 * - Director information and authorized signatories
 * - Credit assessment and risk scoring
 * - Lead prospecting with financial filters
 * 
 * API Documentation: https://apiportal.probe42.in/
 * Python Client: https://github.com/loanzen/probe-py
 */

import axios, { AxiosInstance } from 'axios';

interface Probe42Config {
  apiKey: string;
  apiVersion?: string;
  baseUrl?: string;
}

interface CompanySearchFilters {
  nameStartsWith?: string;
  cin?: string;
  city?: string;
  state?: string;
  pincode?: string;
  industrySegment?: string;
  
  // Financial filters
  minRevenue?: number;
  maxRevenue?: number;
  minProfit?: number;
  maxProfit?: number;
  minEbitda?: number;
  probe42Score?: number; // 1-5
  
  // Classification
  companyCategory?: 'msme' | 'mid_market' | 'large_enterprise';
  riskLevel?: 'low' | 'medium' | 'high';
  
  // Pagination
  page?: number;
  limit?: number;
}

interface CompanyBasicInfo {
  cin: string;
  companyName: string;
  registrationNumber: string;
  incorporationDate?: string;
  companyClass?: string;
  companyCategory?: string;
  companySubCategory?: string;
  authorizedCapital?: number;
  paidUpCapital?: number;
  registeredAddress?: string;
  city?: string;
  state?: string;
  pincode?: string;
  email?: string;
  phone?: string;
  website?: string;
}

interface FinancialData {
  year: string;
  revenue: number;
  netProfit: number;
  ebitda?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  shareholderFunds?: number;
  currentAssets?: number;
  currentLiabilities?: number;
  
  // Ratios
  debtToEquityRatio?: number;
  currentRatio?: number;
  roe?: number; // Return on Equity
  roa?: number; // Return on Assets
  netMargin?: number;
}

interface DirectorInfo {
  din: string;
  name: string;
  designation?: string;
  appointmentDate?: string;
  cessationDate?: string;
  pan?: string;
  address?: string;
  otherCompanies?: Array<{
    cin: string;
    companyName: string;
    designation: string;
  }>;
}

interface Probe42Score {
  score: number; // 1-5
  rating: string; // 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical'
  factors: {
    profitability?: number;
    liquidity?: number;
    solvency?: number;
    efficiency?: number;
    growth?: number;
  };
}

interface CompanyDetails extends CompanyBasicInfo {
  financials?: FinancialData[];
  directors?: DirectorInfo[];
  authorizedSignatories?: DirectorInfo[];
  probe42Score?: Probe42Score;
  charges?: Array<{
    chargeId: string;
    chargeHolder: string;
    chargeAmount: number;
    chargeDate: string;
    status: string;
  }>;
  legalCases?: Array<{
    caseNumber: string;
    court: string;
    caseType: string;
    status: string;
    filingDate: string;
  }>;
}

interface LeadScoringCriteria {
  minRevenue?: number;
  minProfit?: number;
  minScore?: number;
  maxRiskLevel?: 'low' | 'medium' | 'high';
  hasInvestableSurplus?: boolean;
}

export class Probe42Service {
  private client: AxiosInstance;
  private apiKey: string;
  private apiVersion: string;

  constructor(config: Probe42Config) {
    this.apiKey = config.apiKey;
    this.apiVersion = config.apiVersion || 'v1';
    
    this.client = axios.create({
      baseURL: config.baseUrl || 'https://apiportal.probe42.in',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Search companies with financial filters
   */
  async searchCompanies(filters: CompanySearchFilters): Promise<{ companies: CompanyBasicInfo[]; error?: string; available: boolean }> {
    try {
      const response = await this.client.get(`/${this.apiVersion}/companies`, {
        params: {
          filters: JSON.stringify(filters),
          page: filters.page || 1,
          limit: filters.limit || 50
        }
      });

      return { companies: response.data.companies || [], available: true };
    } catch (error: any) {
      const status = error?.response?.status;
      const message = error?.response?.data?.message || error?.message || 'Unknown error';
      
      console.error('❌ Probe42 search error:', { status, message });
      
      if (status === 404) {
        return { 
          companies: [], 
          available: false, 
          error: 'Probe42 company search endpoint not available. Please verify your API subscription includes company search access.' 
        };
      } else if (status === 401 || status === 403) {
        return { 
          companies: [], 
          available: false, 
          error: 'Probe42 API authentication failed. Please verify your API key is valid and active.' 
        };
      } else if (status === 429) {
        return { 
          companies: [], 
          available: false, 
          error: 'Probe42 API rate limit exceeded. Please try again later.' 
        };
      }
      
      return { 
        companies: [], 
        available: false, 
        error: `Probe42 API error: ${message}` 
      };
    }
  }

  /**
   * Get detailed company information by CIN
   */
  async getCompanyDetails(cin: string): Promise<CompanyDetails | null> {
    try {
      const response = await this.client.get(`/${this.apiVersion}/companies/${cin}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Probe42 company details error for CIN ${cin}:`, error);
      return null;
    }
  }

  /**
   * Get company financials
   */
  async getCompanyFinancials(cin: string): Promise<FinancialData[]> {
    try {
      const response = await this.client.get(`/${this.apiVersion}/companies/${cin}/financials`);
      return response.data.financials || [];
    } catch (error) {
      console.error(`❌ Probe42 financials error for CIN ${cin}:`, error);
      return [];
    }
  }

  /**
   * Get company directors
   */
  async getCompanyDirectors(cin: string): Promise<DirectorInfo[]> {
    try {
      const response = await this.client.get(`/${this.apiVersion}/companies/${cin}/directors`);
      return response.data.directors || [];
    } catch (error) {
      console.error(`❌ Probe42 directors error for CIN ${cin}:`, error);
      return [];
    }
  }

  /**
   * Get Probe42 Score (financial health rating)
   */
  async getProbe42Score(cin: string): Promise<Probe42Score | null> {
    try {
      const response = await this.client.get(`/${this.apiVersion}/companies/${cin}/score`);
      return response.data;
    } catch (error) {
      console.error(`❌ Probe42 score error for CIN ${cin}:`, error);
      return null;
    }
  }

  /**
   * Search director by PAN or name
   */
  async searchDirector(criteria: { pan?: string; name?: string }): Promise<DirectorInfo[]> {
    try {
      const response = await this.client.get(`/${this.apiVersion}/directors`, {
        params: {
          filters: JSON.stringify(criteria)
        }
      });
      return response.data.directors || [];
    } catch (error) {
      console.error('❌ Probe42 director search error:', error);
      return [];
    }
  }

  /**
   * Find high-value leads based on financial criteria
   */
  async findHighValueLeads(criteria: LeadScoringCriteria): Promise<{ companies: CompanyBasicInfo[]; error?: string; available: boolean }> {
    const filters: CompanySearchFilters = {
      minRevenue: criteria.minRevenue || 10000000, // ₹1 Cr minimum
      minProfit: criteria.minProfit || 1000000, // ₹10 Lakh minimum
      probe42Score: criteria.minScore || 3, // Minimum score of 3
      limit: 100
    };

    // Map risk level to Probe42 filters
    if (criteria.maxRiskLevel === 'low') {
      filters.probe42Score = 5;
    } else if (criteria.maxRiskLevel === 'medium') {
      filters.probe42Score = 4;
    }

    return await this.searchCompanies(filters);
  }

  /**
   * Calculate estimated investable surplus
   * Simplified calculation: Current Assets - Current Liabilities - Working Capital Buffer
   */
  calculateInvestableSurplus(financial: FinancialData): number {
    if (!financial.currentAssets || !financial.currentLiabilities) {
      return 0;
    }

    const workingCapital = financial.currentAssets - financial.currentLiabilities;
    const workingCapitalBuffer = financial.currentAssets * 0.3; // Keep 30% as buffer
    
    const surplus = Math.max(0, workingCapital - workingCapitalBuffer);
    return Math.round(surplus);
  }

  /**
   * Calculate custom lead score (0-100)
   * Based on: Probe42 score, profitability, growth, risk level
   */
  calculateLeadScore(company: CompanyDetails): number {
    let score = 0;

    // Probe42 Score (0-25 points)
    if (company.probe42Score) {
      score += (company.probe42Score.score / 5) * 25;
    }

    // Latest financials (0-50 points)
    if (company.financials && company.financials.length > 0) {
      const latest = company.financials[0];
      
      // Profitability (0-20 points)
      if (latest.netMargin) {
        if (latest.netMargin > 0.15) score += 20; // >15% margin
        else if (latest.netMargin > 0.10) score += 15;
        else if (latest.netMargin > 0.05) score += 10;
        else if (latest.netMargin > 0) score += 5;
      }

      // Revenue scale (0-15 points)
      if (latest.revenue > 500000000) score += 15; // >₹50 Cr
      else if (latest.revenue > 100000000) score += 12; // >₹10 Cr
      else if (latest.revenue > 10000000) score += 8; // >₹1 Cr
      else if (latest.revenue > 0) score += 3;

      // Liquidity (0-15 points)
      if (latest.currentRatio) {
        if (latest.currentRatio > 2) score += 15;
        else if (latest.currentRatio > 1.5) score += 10;
        else if (latest.currentRatio > 1) score += 5;
      }
    }

    // No legal cases bonus (0-10 points)
    if (!company.legalCases || company.legalCases.length === 0) {
      score += 10;
    }

    // Director diversity bonus (0-15 points)
    if (company.directors && company.directors.length >= 3) {
      score += 15;
    } else if (company.directors && company.directors.length >= 2) {
      score += 10;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Determine lead quality based on score
   */
  getLeadQuality(leadScore: number): 'hot' | 'warm' | 'cold' {
    if (leadScore >= 75) return 'hot';
    if (leadScore >= 50) return 'warm';
    return 'cold';
  }

  /**
   * Extract contact information from director details
   */
  extractContactInfo(directors: DirectorInfo[]): {
    emails: string[];
    phones: string[];
  } {
    const emails: string[] = [];
    const phones: string[] = [];

    // This is placeholder - real implementation would need additional data enrichment
    // Probe42 may not directly provide email/phone in director data
    // Typically requires separate contact discovery services

    return { emails, phones };
  }

  /**
   * Verify an existing client's company data
   */
  async verifyClient(cin: string): Promise<{
    verified: boolean;
    companyDetails: CompanyDetails | null;
    riskFlags: string[];
  }> {
    const companyDetails = await this.getCompanyDetails(cin);
    const riskFlags: string[] = [];

    if (!companyDetails) {
      return {
        verified: false,
        companyDetails: null,
        riskFlags: ['Company not found in Probe42 database']
      };
    }

    // Check for risk indicators
    if (companyDetails.legalCases && companyDetails.legalCases.length > 0) {
      riskFlags.push(`${companyDetails.legalCases.length} active legal cases`);
    }

    if (companyDetails.probe42Score && companyDetails.probe42Score.score <= 2) {
      riskFlags.push('Low financial health score');
    }

    if (companyDetails.financials && companyDetails.financials.length > 0) {
      const latest = companyDetails.financials[0];
      if (latest.netProfit && latest.netProfit < 0) {
        riskFlags.push('Negative profitability');
      }
      if (latest.debtToEquityRatio && latest.debtToEquityRatio > 2) {
        riskFlags.push('High debt-to-equity ratio');
      }
    }

    return {
      verified: true,
      companyDetails,
      riskFlags
    };
  }
}

// Singleton instance
let probe42Service: Probe42Service | null = null;

export function getProbe42Service(): Probe42Service {
  if (!probe42Service) {
    const apiKey = process.env.PROBE42_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ PROBE42_API_KEY not configured. Probe42 service will not be available.');
      throw new Error('Probe42 API key not configured');
    }

    probe42Service = new Probe42Service({ apiKey });
    console.log('✅ Probe42 service initialized');
  }

  return probe42Service;
}
