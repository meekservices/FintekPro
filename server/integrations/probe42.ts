import axios from 'axios';

// Probe42 API Integration for Company Data Intelligence
export class Probe42API {
  private baseUrl: string;
  private apiKey: string;
  private authToken?: string;

  constructor(config: {
    apiKey: string;
    baseUrl?: string;
  }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.probe42.in';
  }

  // Authenticate with Probe42 API
  private async authenticate(): Promise<string> {
    try {
      const endpoint = `${this.baseUrl}/auth/login`;
      
      const response = await axios.post(endpoint, {
        apiKey: this.apiKey
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        this.authToken = response.data.token;
        return this.authToken!;
      } else {
        throw new Error(`Authentication failed: ${response.data.message}`);
      }
    } catch (error) {
      throw new Error(`Probe42 authentication error: ${error}`);
    }
  }

  // Search companies by various filters
  async searchCompanies(filters: {
    nameStartsWith?: string;
    nameContains?: string;
    cin?: string;
    pan?: string;
    gst?: string;
    state?: string;
    city?: string;
    registrationNumber?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      const endpoint = `${this.baseUrl}/v1/companies/search`;
      
      const response = await axios.post(endpoint, {
        filters: filters,
        limit: filters.limit || 50,
        offset: filters.offset || 0
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to search companies: ${error}`);
    }
  }

  // Get detailed company information by CIN
  async getCompanyByCIN(cin: string): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      const endpoint = `${this.baseUrl}/v1/companies/${cin}`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch company details: ${error}`);
    }
  }

  // Get company directors and authorized signatories
  async getCompanyDirectors(cin: string): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      const endpoint = `${this.baseUrl}/v1/companies/${cin}/directors`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch company directors: ${error}`);
    }
  }

  // Get company charges and assets
  async getCompanyCharges(cin: string): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      const endpoint = `${this.baseUrl}/v1/companies/${cin}/charges`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch company charges: ${error}`);
    }
  }

  // Get company financial filings
  async getCompanyFilings(cin: string, filingType?: string): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      const endpoint = `${this.baseUrl}/v1/companies/${cin}/filings`;
      
      const params: any = {};
      if (filingType) {
        params.type = filingType;
      }

      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        },
        params
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch company filings: ${error}`);
    }
  }

  // Get GST information for a company
  async getGSTInformation(gstNumber: string): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      const endpoint = `${this.baseUrl}/v1/gst/${gstNumber}`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch GST information: ${error}`);
    }
  }

  // Search authorized signatories by PAN
  async searchSignatoriesByPAN(pan: string): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      const endpoint = `${this.baseUrl}/v1/signatories/search`;
      
      const response = await axios.post(endpoint, {
        filters: {
          pan: pan
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to search signatories: ${error}`);
    }
  }

  // Get compliance and litigation data
  async getComplianceData(cin: string): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      const endpoint = `${this.baseUrl}/v1/companies/${cin}/compliance`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch compliance data: ${error}`);
    }
  }

  // Get credit risk assessment
  async getCreditRiskAssessment(cin: string): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      const endpoint = `${this.baseUrl}/v1/companies/${cin}/credit-risk`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch credit risk assessment: ${error}`);
    }
  }

  // Bulk company verification
  async bulkVerifyCompanies(companies: Array<{
    cin?: string;
    pan?: string;
    gst?: string;
    name?: string;
  }>): Promise<any> {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      const endpoint = `${this.baseUrl}/v1/companies/bulk-verify`;
      
      const response = await axios.post(endpoint, {
        companies: companies
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to bulk verify companies: ${error}`);
    }
  }

  // Logout and invalidate token
  async logout(): Promise<void> {
    try {
      if (this.authToken) {
        const endpoint = `${this.baseUrl}/auth/logout`;
        await axios.post(endpoint, {}, {
          headers: {
            'Authorization': `Bearer ${this.authToken}`
          }
        });
        this.authToken = undefined;
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}

// Factory function to create Probe42 API instance
export function createProbe42API(config: {
  apiKey: string;
}): Probe42API {
  return new Probe42API(config);
}

// Types for Probe42 API responses
export interface Probe42Company {
  cin: string;
  name: string;
  registrationNumber: string;
  dateOfIncorporation: string;
  category: string;
  subCategory: string;
  companyClass: string;
  companyStatus: string;
  authorizedCapital: number;
  paidUpCapital: number;
  registeredAddress: {
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  email?: string;
  website?: string;
  roc: string;
  lastFilingDate?: string;
  lastAGMDate?: string;
}

export interface Probe42Director {
  name: string;
  pan?: string;
  din?: string;
  designation: string;
  appointmentDate: string;
  cessationDate?: string;
  shareholding?: number;
}

export interface Probe42Charge {
  chargeId: string;
  amount: number;
  chargeHolder: string;
  creationDate: string;
  modificationDate?: string;
  satisfactionDate?: string;
  status: string;
  description: string;
}

export interface Probe42Filing {
  filingDate: string;
  formType: string;
  description: string;
  attachments?: string[];
}

export interface Probe42GST {
  gstNumber: string;
  businessName: string;
  registrationDate: string;
  status: string;
  businessType: string;
  taxpayerType: string;
  address: {
    address: string;
    state: string;
    pincode: string;
  };
  filingFrequency: string;
  lastReturn?: string;
}

export interface Probe42CreditRisk {
  riskScore: number;
  riskGrade: string;
  riskFactors: string[];
  recommendations: string[];
  lastUpdated: string;
}

export interface Probe42Compliance {
  complianceScore: number;
  filingCompliance: boolean;
  gstCompliance: boolean;
  litigationCount: number;
  penaltyAmount: number;
  lastAssessment: string;
}

// Integration wrapper for the Probe42API
export class Probe42Integration {
  private api: Probe42API;

  constructor() {
    this.api = new Probe42API({
      apiKey: process.env.PROBE42_API_KEY || ''
    });
  }

  async searchCompany(filters: {
    pan?: string;
    cin?: string;
    name?: string;
    gst?: string;
  }): Promise<{ success: boolean; data: any }> {
    try {
      const searchFilters: any = {};
      
      if (filters.pan) {
        searchFilters.pan = filters.pan;
      }
      if (filters.cin) {
        searchFilters.cin = filters.cin;
      }
      if (filters.name) {
        searchFilters.nameContains = filters.name;
      }
      if (filters.gst) {
        searchFilters.gst = filters.gst;
      }

      const result = await this.api.searchCompanies(searchFilters);
      return {
        success: true,
        data: { results: result.companies || [] }
      };
    } catch (error) {
      console.error('Probe42 search error:', error);
      return {
        success: false,
        data: { results: [] }
      };
    }
  }

  async getCompanyDetails(cin: string): Promise<{ success: boolean; data: any }> {
    try {
      const result = await this.api.getCompanyByCIN(cin);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Probe42 company details error:', error);
      return {
        success: false,
        data: null
      };
    }
  }
}

