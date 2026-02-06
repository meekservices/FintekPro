/**
 * EPFO (Employee Provident Fund Organization) Service
 * 
 * Fetches EPF/VPF account details, balances, and contribution history
 * Integration: EPFO API / UMANG / Account Aggregator
 * 
 * Note: Real EPFO API requires UAN (Universal Account Number) for authentication
 */

import axios from 'axios';

export interface EPFAccount {
  epfAccountNumber: string; // UAN-based account number
  uan: string; // Universal Account Number
  employerName: string;
  memberName: string;
  employeeContribution: number;
  employerContribution: number;
  pensionContribution: number; // EPS (Employee Pension Scheme)
  totalBalance: number;
  interestEarned: number;
  interestRate: number; // Annual interest rate (e.g., 8.25%)
  dateOfJoining: string; // ISO date
  dateOfExit?: string; // ISO date if exited
  isActive: boolean;
  nomineeName?: string;
  nomineeRelationship?: string;
  lastContributionDate?: string;
}

export interface EPFFetchRequest {
  panNumber: string;
  name: string;
  dob: string;
  mobile?: string;
  uan?: string; // If user provides UAN
  requestId?: string;
}

export interface EPFFetchResponse {
  success: boolean;
  totalAccounts: number;
  totalBalance: number;
  totalEmployeeContribution: number;
  totalEmployerContribution: number;
  totalPensionContribution: number;
  totalInterestEarned: number;
  accounts: EPFAccount[];
  message?: string;
}

export class EPFOService {
  private isProduction: boolean;
  private epfoBaseUrl: string;
  private epfoApiKey: string;

  constructor() {
    this.isProduction = process.env.EPFO_ENVIRONMENT === 'production';
    
    this.epfoBaseUrl = this.isProduction
      ? 'https://unifiedportal-mem.epfindia.gov.in/memberinterface/api'
      : 'https://sandbox-epfo.gov.in/api';

    this.epfoApiKey = process.env.EPFO_API_KEY || '';
  }

  private hasValidCredentials(): boolean {
    return !!this.epfoApiKey;
  }

  private getComingSoonResponse(): EPFFetchResponse {
    return {
      success: false,
      totalAccounts: 0,
      totalBalance: 0,
      totalEmployeeContribution: 0,
      totalEmployerContribution: 0,
      totalPensionContribution: 0,
      totalInterestEarned: 0,
      accounts: [],
      message: 'Coming Soon - EPFO integration will be available once API credentials are configured. Please contact support to enable this feature.'
    };
  }

  /**
   * Fetch EPF account details
   * Uses PAN, DOB, Name to lookup UAN and fetch account details
   */
  async fetchEPFAccounts(request: EPFFetchRequest): Promise<EPFFetchResponse> {
    try {
      console.log(`📊 Fetching EPF accounts from EPFO`);

      if (!this.hasValidCredentials()) {
        console.log('⏳ EPFO API credentials not configured - Coming Soon');
        return this.getComingSoonResponse();
      }

      // Production: Call EPFO API
      const epfoResponse = await this.callEPFOAPI(request);
      
      // Parse accounts
      const accounts = await this.parseEPFOResponse(epfoResponse);

      // Calculate totals
      const totalBalance = accounts.reduce((sum, a) => sum + a.totalBalance, 0);
      const totalEmployeeContribution = accounts.reduce((sum, a) => sum + a.employeeContribution, 0);
      const totalEmployerContribution = accounts.reduce((sum, a) => sum + a.employerContribution, 0);
      const totalPensionContribution = accounts.reduce((sum, a) => sum + a.pensionContribution, 0);
      const totalInterestEarned = accounts.reduce((sum, a) => sum + a.interestEarned, 0);

      console.log(`✅ Fetched ${accounts.length} EPF accounts (Total Balance: ₹${totalBalance.toFixed(2)})`);

      return {
        success: true,
        totalAccounts: accounts.length,
        totalBalance,
        totalEmployeeContribution,
        totalEmployerContribution,
        totalPensionContribution,
        totalInterestEarned,
        accounts
      };

    } catch (error: any) {
      console.error('❌ EPFO fetch error:', error.message);
      
      return {
        success: false,
        totalAccounts: 0,
        totalBalance: 0,
        totalEmployeeContribution: 0,
        totalEmployerContribution: 0,
        totalPensionContribution: 0,
        totalInterestEarned: 0,
        accounts: [],
        message: `EPFO fetch failed: ${error.message}`
      };
    }
  }

  /**
   * Call EPFO API (Production)
   * Step 1: Lookup UAN using PAN/DOB/Name
   * Step 2: Fetch passbook using UAN
   */
  private async callEPFOAPI(request: EPFFetchRequest): Promise<any> {
    try {
      // Step 1: Get UAN if not provided
      let uan = request.uan;
      
      if (!uan) {
        const uanLookupEndpoint = `${this.epfoBaseUrl}/uan/lookup`;
        const uanResponse = await axios.post(uanLookupEndpoint, {
          pan: request.panNumber,
          dob: request.dob,
          name: request.name,
          mobile: request.mobile
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.epfoApiKey
          },
          timeout: 30000
        });

        uan = uanResponse.data.uan;
      }

      if (!uan) {
        throw new Error('UAN not found for provided KYC details');
      }

      // Step 2: Fetch EPF passbook
      const passbookEndpoint = `${this.epfoBaseUrl}/passbook`;
      const passbookResponse = await axios.post(passbookEndpoint, {
        uan,
        pan: request.panNumber,
        dob: request.dob
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.epfoApiKey,
          'X-Request-ID': request.requestId || `epf_${Date.now()}`
        },
        timeout: 30000
      });

      return passbookResponse.data;

    } catch (error: any) {
      console.error('❌ EPFO API error:', error.message);
      throw new Error(`EPFO API failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Parse EPFO API response
   */
  private async parseEPFOResponse(epfoResponse: any): Promise<EPFAccount[]> {
    const accounts: EPFAccount[] = [];

    // EPFO response typically contains multiple establishments/accounts
    const accountsData = epfoResponse.data?.establishments || [];
    
    for (const establishment of accountsData) {
      accounts.push({
        epfAccountNumber: establishment.account_number || establishment.establishment_id,
        uan: establishment.uan,
        employerName: establishment.establishment_name,
        memberName: establishment.member_name,
        employeeContribution: parseFloat(establishment.employee_share || '0'),
        employerContribution: parseFloat(establishment.employer_share || '0'),
        pensionContribution: parseFloat(establishment.eps_share || '0'),
        totalBalance: parseFloat(establishment.total_balance || '0'),
        interestEarned: parseFloat(establishment.interest_earned || '0'),
        interestRate: parseFloat(establishment.interest_rate || '8.25'), // Current EPF interest rate
        dateOfJoining: establishment.date_of_joining,
        dateOfExit: establishment.date_of_exit || undefined,
        isActive: establishment.status === 'Active',
        nomineeName: establishment.nominee_name,
        nomineeRelationship: establishment.nominee_relation,
        lastContributionDate: establishment.last_contribution_date
      });
    }

    return accounts;
  }

  /**
   * Get EPF contribution history (detailed month-by-month)
   * This is useful for showing contribution trends
   */
  async getContributionHistory(uan: string, fromDate: string, toDate: string): Promise<any> {
    // In production, this would call EPFO's contribution history API
    // For now, return empty array
    return [];
  }

  /**
   * Get EPF claim status
   * Check if user has any pending EPF claims
   */
  async getClaimStatus(uan: string): Promise<any> {
    // In production, this would call EPFO's claim status API
    return {
      hasPendingClaim: false,
      claims: []
    };
  }
}

// Export singleton instance
export const epfoService = new EPFOService();
