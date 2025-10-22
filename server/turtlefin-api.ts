/**
 * Turtlefin Insurance API Integration
 * 
 * Turtlefin is an insurance aggregator platform that provides APIs for:
 * - Fetching user's existing insurance policies
 * - Premium calculations
 * - Policy comparison
 * - New policy issuance
 * 
 * This service integrates with Turtlefin to auto-populate insurance holdings
 * after KYC verification using PAN, Name, and DOB from KYC Vault.
 */

import axios, { AxiosInstance } from 'axios';

interface TurtlefinConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  environment: 'sandbox' | 'production';
}

interface TurtlefinPolicy {
  policyNumber: string;
  policyType: 'life' | 'health' | 'term' | 'ulip' | 'motor' | 'general';
  insurerName: string;
  insurerCode: string;
  policyHolderName: string;
  sumAssured: number;
  premiumAmount: number;
  premiumFrequency: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
  policyStartDate: string;
  policyEndDate: string;
  maturityDate?: string;
  status: 'active' | 'lapsed' | 'matured' | 'surrendered';
  nominees: Array<{
    name: string;
    relation: string;
    share: number;
  }>;
  coverageDetails?: {
    baseCover?: number;
    riderCovers?: Array<{
      name: string;
      sumAssured: number;
    }>;
  };
}

interface PolicySearchParams {
  pan: string;
  name: string;
  dob: string;
  mobile?: string;
  email?: string;
}

interface PolicySearchResult {
  success: boolean;
  totalPolicies: number;
  policies: TurtlefinPolicy[];
  searchedAt: string;
}

interface PremiumCalculationParams {
  policyType: string;
  sumAssured: number;
  age: number;
  gender: 'M' | 'F';
  tenure: number;
  smoker?: boolean;
}

interface PremiumQuote {
  insurerName: string;
  planName: string;
  premium: number;
  frequency: string;
  coverAmount: number;
  features: string[];
}

export class TurtlefinAPI {
  private client: AxiosInstance;
  private config: TurtlefinConfig;

  constructor(config?: Partial<TurtlefinConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.TURTLEFIN_API_KEY || '',
      apiSecret: config?.apiSecret || process.env.TURTLEFIN_API_SECRET || '',
      baseUrl: config?.baseUrl || (config?.environment === 'production' 
        ? 'https://api.turtlefin.com/v1'
        : 'https://sandbox-api.turtlefin.com/v1'),
      environment: config?.environment || 'sandbox'
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey,
        'X-API-Secret': this.config.apiSecret
      },
      timeout: 30000
    });

    console.log(`✅ Turtlefin API initialized in ${this.config.environment} mode`);
  }

  /**
   * Search for existing insurance policies by PAN/Name/DOB
   * Used for auto-population after KYC verification
   */
  async searchPoliciesByKYC(params: PolicySearchParams): Promise<PolicySearchResult> {
    try {
      console.log('🔍 Searching Turtlefin for policies');

      // In sandbox mode, return mock data
      if (this.config.environment === 'sandbox') {
        return this.generateMockPolicies(params);
      }

      // Production API call
      const response = await this.client.post('/policies/search', {
        pan: params.pan,
        name: params.name,
        dob: params.dob,
        mobile: params.mobile,
        email: params.email
      });

      return {
        success: true,
        totalPolicies: response.data.policies?.length || 0,
        policies: response.data.policies || [],
        searchedAt: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('❌ Turtlefin policy search error:', error.message);
      
      // Return empty result on error instead of throwing
      return {
        success: false,
        totalPolicies: 0,
        policies: [],
        searchedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Get detailed policy information by policy number
   */
  async getPolicyDetails(policyNumber: string): Promise<TurtlefinPolicy | null> {
    try {
      if (this.config.environment === 'sandbox') {
        return this.generateMockPolicyDetails(policyNumber);
      }

      const response = await this.client.get(`/policies/${policyNumber}`);
      return response.data.policy;
    } catch (error: any) {
      console.error('❌ Turtlefin policy details error:', error.message);
      return null;
    }
  }

  /**
   * Calculate premium quotes for a new policy
   */
  async calculatePremium(params: PremiumCalculationParams): Promise<PremiumQuote[]> {
    try {
      if (this.config.environment === 'sandbox') {
        return this.generateMockPremiumQuotes(params);
      }

      const response = await this.client.post('/premium/calculate', params);
      return response.data.quotes || [];
    } catch (error: any) {
      console.error('❌ Turtlefin premium calculation error:', error.message);
      return [];
    }
  }

  /**
   * Get policy document download link
   */
  async getPolicyDocument(policyNumber: string): Promise<{ url: string } | null> {
    try {
      if (this.config.environment === 'sandbox') {
        return {
          url: `https://sandbox-docs.turtlefin.com/policies/${policyNumber}.pdf`
        };
      }

      const response = await this.client.get(`/policies/${policyNumber}/document`);
      return { url: response.data.documentUrl };
    } catch (error: any) {
      console.error('❌ Turtlefin document fetch error:', error.message);
      return null;
    }
  }

  /**
   * Generate mock policies for sandbox/testing
   */
  private generateMockPolicies(params: PolicySearchParams): PolicySearchResult {
    const mockPolicies: TurtlefinPolicy[] = [
      {
        policyNumber: 'LIC789456123',
        policyType: 'life',
        insurerName: 'Life Insurance Corporation of India',
        insurerCode: 'LIC',
        policyHolderName: params.name,
        sumAssured: 2500000,
        premiumAmount: 45000,
        premiumFrequency: 'yearly',
        policyStartDate: '2020-04-15',
        policyEndDate: '2040-04-15',
        maturityDate: '2040-04-15',
        status: 'active',
        nominees: [
          { name: 'Spouse Name', relation: 'Spouse', share: 100 }
        ],
        coverageDetails: {
          baseCover: 2500000,
          riderCovers: [
            { name: 'Accidental Death Benefit', sumAssured: 500000 },
            { name: 'Critical Illness', sumAssured: 300000 }
          ]
        }
      },
      {
        policyNumber: 'HDFC456789012',
        policyType: 'health',
        insurerName: 'HDFC ERGO Health Insurance',
        insurerCode: 'HDFC_ERGO',
        policyHolderName: params.name,
        sumAssured: 500000,
        premiumAmount: 18500,
        premiumFrequency: 'yearly',
        policyStartDate: '2023-01-10',
        policyEndDate: '2024-01-10',
        status: 'active',
        nominees: [
          { name: 'Spouse Name', relation: 'Spouse', share: 50 },
          { name: 'Child Name', relation: 'Child', share: 50 }
        ],
        coverageDetails: {
          baseCover: 500000
        }
      },
      {
        policyNumber: 'ICICI123789456',
        policyType: 'term',
        insurerName: 'ICICI Prudential Life Insurance',
        insurerCode: 'ICICI_PRU',
        policyHolderName: params.name,
        sumAssured: 10000000,
        premiumAmount: 12000,
        premiumFrequency: 'yearly',
        policyStartDate: '2022-06-01',
        policyEndDate: '2042-06-01',
        status: 'active',
        nominees: [
          { name: 'Spouse Name', relation: 'Spouse', share: 100 }
        ],
        coverageDetails: {
          baseCover: 10000000
        }
      }
    ];

    return {
      success: true,
      totalPolicies: mockPolicies.length,
      policies: mockPolicies,
      searchedAt: new Date().toISOString()
    };
  }

  /**
   * Generate mock policy details
   */
  private generateMockPolicyDetails(policyNumber: string): TurtlefinPolicy {
    return {
      policyNumber,
      policyType: 'life',
      insurerName: 'Life Insurance Corporation of India',
      insurerCode: 'LIC',
      policyHolderName: 'Demo User',
      sumAssured: 2500000,
      premiumAmount: 45000,
      premiumFrequency: 'yearly',
      policyStartDate: '2020-04-15',
      policyEndDate: '2040-04-15',
      maturityDate: '2040-04-15',
      status: 'active',
      nominees: [
        { name: 'Spouse Name', relation: 'Spouse', share: 100 }
      ],
      coverageDetails: {
        baseCover: 2500000,
        riderCovers: [
          { name: 'Accidental Death Benefit', sumAssured: 500000 }
        ]
      }
    };
  }

  /**
   * Generate mock premium quotes
   */
  private generateMockPremiumQuotes(params: PremiumCalculationParams): PremiumQuote[] {
    const baseRate = params.sumAssured * 0.015;
    const ageMultiplier = 1 + (params.age - 25) * 0.02;
    const smokerMultiplier = params.smoker ? 1.5 : 1;

    return [
      {
        insurerName: 'HDFC Life',
        planName: 'Click 2 Protect Super',
        premium: Math.round(baseRate * ageMultiplier * smokerMultiplier),
        frequency: 'yearly',
        coverAmount: params.sumAssured,
        features: ['Life cover', 'Accidental death benefit', 'Tax benefits']
      },
      {
        insurerName: 'ICICI Prudential',
        planName: 'iProtect Smart',
        premium: Math.round(baseRate * ageMultiplier * smokerMultiplier * 1.1),
        frequency: 'yearly',
        coverAmount: params.sumAssured,
        features: ['Life cover', 'Critical illness rider', 'Return of premium']
      },
      {
        insurerName: 'Max Life',
        planName: 'Smart Secure Plus',
        premium: Math.round(baseRate * ageMultiplier * smokerMultiplier * 0.95),
        frequency: 'yearly',
        coverAmount: params.sumAssured,
        features: ['Life cover', 'Income benefit', 'Terminal illness cover']
      }
    ];
  }

  /**
   * Check API health and authentication
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; message: string }> {
    try {
      if (this.config.environment === 'sandbox') {
        return { status: 'ok', message: 'Turtlefin API (Sandbox) is operational' };
      }

      const response = await this.client.get('/health');
      return {
        status: response.data.status === 'ok' ? 'ok' : 'error',
        message: response.data.message || 'API is operational'
      };
    } catch (error: any) {
      return {
        status: 'error',
        message: error.message || 'API health check failed'
      };
    }
  }
}

// Export singleton instance
export const turtlefinAPI = new TurtlefinAPI();
