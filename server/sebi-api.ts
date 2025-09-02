import fetch from 'node-fetch';

export interface SEBICompanyDetails {
  companyId: string;
  companyName: string;
  registrationNumber: string;
  cin: string;
  category: string;
  subCategory: string;
  listingStatus: string;
  registrationDate: string;
  sebiRegistrationNumber: string;
  address: {
    registered: string;
    corporate: string;
  };
  contactDetails: {
    email: string;
    phone: string;
    website: string;
  };
  complianceStatus: string;
  lastInspectionDate: string;
  penalties: Array<{
    date: string;
    amount: number;
    reason: string;
    status: string;
  }>;
  boardOfDirectors: Array<{
    name: string;
    designation: string;
    din: string;
    appointmentDate: string;
  }>;
  auditorsDetails: {
    name: string;
    firmRegistrationNumber: string;
    appointmentDate: string;
  };
  financialDetails: {
    paidUpCapital: number;
    authorizedCapital: number;
    reservesAndSurplus: number;
    netWorth: number;
    lastFilingDate: string;
  };
}

export interface SEBIMutualFundDetails {
  amcId: string;
  amcName: string;
  sebiRegistrationNumber: string;
  schemes: Array<{
    schemeCode: string;
    schemeName: string;
    schemeType: string;
    category: string;
    subCategory: string;
    benchmarkIndex: string;
    nav: number;
    aum: number;
    expenseRatio: number;
    exitLoad: number;
    minimumInvestment: number;
    launchDate: string;
    maturityDate?: string;
    riskometer: number;
    returns: {
      '1Y': number;
      '3Y': number;
      '5Y': number;
      sinceInception: number;
    };
    fundManager: string;
    trustee: string;
    custodian: string;
    registrar: string;
  }>;
  totalAUM: number;
  totalSchemes: number;
  complianceRating: string;
  lastInspectionDate: string;
}

export interface SEBIAIFDetails {
  aifId: string;
  aifName: string;
  sebiRegistrationNumber: string;
  category: 'Category I' | 'Category II' | 'Category III';
  subCategory: string;
  sponsor: string;
  manager: string;
  trustee: string;
  custodian: string;
  targetCorpus: number;
  commitmentRaised: number;
  investmentPeriod: string;
  fundTenure: string;
  managementFee: number;
  performanceFee: number;
  hurdle_rate: number;
  registrationDate: string;
  closeDate?: string;
  investmentObjective: string;
  investmentStrategy: string;
  targetInvestors: string[];
  minimumInvestment: number;
  investors: Array<{
    name: string;
    type: string;
    commitment: number;
    drawdown: number;
  }>;
  portfolio: Array<{
    investeeCompany: string;
    sector: string;
    investmentAmount: number;
    investmentDate: string;
    currentValuation: number;
    status: string;
  }>;
  performance: {
    irr: number;
    moic: number;
    tvpi: number;
    dpi: number;
    rvpi: number;
  };
  complianceStatus: string;
  filings: Array<{
    type: string;
    dueDate: string;
    submissionDate?: string;
    status: string;
  }>;
}

export interface SEBIPortfolioManagerDetails {
  pmId: string;
  pmName: string;
  sebiRegistrationNumber: string;
  registrationDate: string;
  validity: string;
  address: {
    registered: string;
    corporate: string;
  };
  keyPersonnel: Array<{
    name: string;
    designation: string;
    qualification: string;
    experience: number;
  }>;
  clientAssets: number;
  numberOfClients: number;
  averageAssetSize: number;
  investmentApproach: string;
  trackRecord: {
    totalExperience: number;
    pastReturns: Array<{
      year: number;
      return: number;
      benchmark: number;
      outperformance: number;
    }>;
  };
  fees: {
    managementFee: number;
    performanceFee: number;
    other: string;
  };
  complianceRecord: {
    rating: string;
    lastInspection: string;
    penalties: Array<{
      date: string;
      amount: number;
      reason: string;
    }>;
  };
}

export class SEBIAPIClient {
  private baseURL: string;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.baseURL = process.env.SEBI_API_BASE_URL || 'https://www.sebi.gov.in/api';
    this.apiKey = apiKey || process.env.SEBI_API_KEY || '';
  }

  private async makeRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
    try {
      const url = new URL(`${this.baseURL}${endpoint}`);
      
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'FintekPro/1.0'
      };

      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`SEBI API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('SEBI API request failed:', error);
      throw error;
    }
  }

  // Company and Intermediary Details
  async getCompanyDetails(companyId: string): Promise<SEBICompanyDetails> {
    return this.makeRequest(`/companies/${companyId}`);
  }

  async searchCompanies(query: string): Promise<SEBICompanyDetails[]> {
    return this.makeRequest('/companies/search', { q: query });
  }

  async getListedCompanies(exchange?: string): Promise<SEBICompanyDetails[]> {
    const params: Record<string, string> = {};
    if (exchange) params.exchange = exchange;
    return this.makeRequest('/companies/listed', params);
  }

  // Mutual Fund Details
  async getMutualFundDetails(amcId: string): Promise<SEBIMutualFundDetails> {
    return this.makeRequest(`/mutual-funds/${amcId}`);
  }

  async getAllMutualFunds(): Promise<SEBIMutualFundDetails[]> {
    return this.makeRequest('/mutual-funds');
  }

  async getMutualFundSchemes(amcId: string): Promise<any[]> {
    return this.makeRequest(`/mutual-funds/${amcId}/schemes`);
  }

  async searchMutualFunds(query: string): Promise<SEBIMutualFundDetails[]> {
    return this.makeRequest('/mutual-funds/search', { q: query });
  }

  // AIF Details
  async getAIFDetails(aifId: string): Promise<SEBIAIFDetails> {
    return this.makeRequest(`/aif/${aifId}`);
  }

  async getAllAIFs(): Promise<SEBIAIFDetails[]> {
    return this.makeRequest('/aif');
  }

  async getAIFsByCategory(category: string): Promise<SEBIAIFDetails[]> {
    return this.makeRequest('/aif', { category });
  }

  async searchAIFs(query: string): Promise<SEBIAIFDetails[]> {
    return this.makeRequest('/aif/search', { q: query });
  }

  // Portfolio Manager Details
  async getPortfolioManagerDetails(pmId: string): Promise<SEBIPortfolioManagerDetails> {
    return this.makeRequest(`/portfolio-managers/${pmId}`);
  }

  async getAllPortfolioManagers(): Promise<SEBIPortfolioManagerDetails[]> {
    return this.makeRequest('/portfolio-managers');
  }

  async searchPortfolioManagers(query: string): Promise<SEBIPortfolioManagerDetails[]> {
    return this.makeRequest('/portfolio-managers/search', { q: query });
  }

  // Market Infrastructure Institutions
  async getStockExchanges(): Promise<any[]> {
    return this.makeRequest('/exchanges');
  }

  async getDepositories(): Promise<any[]> {
    return this.makeRequest('/depositories');
  }

  async getClearingCorporations(): Promise<any[]> {
    return this.makeRequest('/clearing-corporations');
  }

  // Regulatory Filings and Compliance
  async getCompanyFilings(companyId: string, type?: string): Promise<any[]> {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    return this.makeRequest(`/companies/${companyId}/filings`, params);
  }

  async getPenalties(entityId: string, entityType: string): Promise<any[]> {
    return this.makeRequest('/penalties', { entityId, entityType });
  }

  async getEnforcementActions(fromDate?: string, toDate?: string): Promise<any[]> {
    const params: Record<string, string> = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return this.makeRequest('/enforcement-actions', params);
  }

  // Investor Grievances and Complaints
  async getInvestorComplaints(entityId: string): Promise<any[]> {
    return this.makeRequest(`/complaints/${entityId}`);
  }

  async getScoreCard(entityId: string, entityType: string): Promise<any> {
    return this.makeRequest('/scorecard', { entityId, entityType });
  }

  // Research Analysts and Investment Advisers
  async getResearchAnalysts(): Promise<any[]> {
    return this.makeRequest('/research-analysts');
  }

  async getInvestmentAdvisers(): Promise<any[]> {
    return this.makeRequest('/investment-advisers');
  }

  // Insider Trading Database
  async getInsiderTradingData(companyId: string, fromDate?: string, toDate?: string): Promise<any[]> {
    const params: Record<string, string> = { companyId };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    return this.makeRequest('/insider-trading', params);
  }

  // Corporate Governance Reports
  async getCorporateGovernanceReport(companyId: string, year?: string): Promise<any> {
    const params: Record<string, string> = {};
    if (year) params.year = year;
    return this.makeRequest(`/companies/${companyId}/corporate-governance`, params);
  }

  // Board Meeting Outcomes
  async getBoardMeetingOutcomes(companyId: string): Promise<any[]> {
    return this.makeRequest(`/companies/${companyId}/board-meetings`);
  }

  // Shareholding Patterns
  async getShareholdingPattern(companyId: string, quarter?: string, year?: string): Promise<any> {
    const params: Record<string, string> = {};
    if (quarter) params.quarter = quarter;
    if (year) params.year = year;
    return this.makeRequest(`/companies/${companyId}/shareholding`, params);
  }
}

// Export singleton instance
export const sebiAPI = new SEBIAPIClient();
export default sebiAPI;