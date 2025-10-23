/**
 * APY (Atal Pension Yojana) Service
 * 
 * Connects to Account Aggregator / APY Portal to fetch:
 * - APY account details and PRAN
 * - Pension amount and monthly contribution
 * - Total contributions and government co-contribution
 * - Bank account linkage details
 * 
 * APY is a government-backed pension scheme for unorganized sector workers
 * offering guaranteed pension (₹1000-5000/month) at age 60
 */

import axios from 'axios';

export interface APYAccount {
  pran: string; // PRAN number (12 digits)
  accountHolderName: string;
  pensionAmount: number; // ₹1000, ₹2000, ₹3000, ₹4000, or ₹5000
  monthlyContribution: number;
  totalBalance: number;
  bankName: string;
  status: 'active' | 'matured' | 'discontinued' | 'exited';
}

export interface APYHolding {
  pran: string;
  accountHolderName: string;
  dateOfBirth: string;
  enrollmentDate: string;
  enrollmentAge: number;
  
  // Pension Details
  pensionAmount: number; // Guaranteed monthly pension at 60
  monthlyContribution: number; // Based on age and pension choice
  
  // Contribution Tracking
  totalContribution: number; // User's total contributions
  governmentContribution: number; // Govt co-contribution
  totalBalance: number; // Current accumulated balance
  
  // Account Details
  maturityAge: number; // Fixed at 60 years
  yearsToMaturity: number;
  expectedMaturityDate: string;
  
  // Bank Details
  bankName: string;
  bankAccountNumber: string;
  ifscCode: string;
  branchName: string | null;
  
  // Nominee
  nominee: string | null;
  nomineeRelation: string | null;
  
  // Status
  status: 'active' | 'matured' | 'discontinued' | 'exited';
  lastContributionDate: string | null;
}

export interface APYFetchRequest {
  panNumber: string;
  dateOfBirth: string; // YYYY-MM-DD
  name: string;
  mobile?: string;
}

export interface APYFetchResponse {
  success: boolean;
  accounts: APYAccount[];
  holdings: APYHolding[];
  totalBalance: number;
  totalContribution: number;
  totalGovernmentContribution: number;
  message?: string;
  fetchedAt: string;
}

export class APYService {
  private apiBaseUrl: string;
  private apiKey: string;
  private useMockData: boolean;

  constructor() {
    this.apiBaseUrl = process.env.APY_API_URL || 'https://api.accountaggregator.org.in/v1';
    this.apiKey = process.env.APY_API_KEY || '';
    this.useMockData = !this.apiKey || process.env.NODE_ENV === 'development';
  }

  /**
   * Fetch APY accounts and holdings for a user
   */
  async fetchAPYAccounts(request: APYFetchRequest): Promise<APYFetchResponse> {
    try {
      console.log(`🔍 Fetching APY accounts for user...`);

      if (this.useMockData) {
        console.log('📋 Using mock APY data (production API not configured)');
        return this.getMockAPYData(request.panNumber);
      }

      // Production Account Aggregator API call
      return await this.fetchFromAccountAggregator(request);
    } catch (error) {
      console.error('❌ Error fetching APY accounts:', error);
      return {
        success: false,
        accounts: [],
        holdings: [],
        totalBalance: 0,
        totalContribution: 0,
        totalGovernmentContribution: 0,
        message: error instanceof Error ? error.message : 'Failed to fetch APY data',
        fetchedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Production API call to Account Aggregator
   */
  private async fetchFromAccountAggregator(request: APYFetchRequest): Promise<APYFetchResponse> {
    try {
      // Authenticate with Account Aggregator
      const authResponse = await axios.post(`${this.apiBaseUrl}/auth/token`, {
        client_id: this.apiKey,
        grant_type: 'client_credentials'
      });

      const accessToken = authResponse.data.access_token;

      // Fetch APY account using PAN and DOB
      const apyResponse = await axios.post(
        `${this.apiBaseUrl}/government-schemes/apy`,
        {
          pan: request.panNumber,
          dob: request.dateOfBirth,
          name: request.name
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!apyResponse.data.accounts || apyResponse.data.accounts.length === 0) {
        return {
          success: true,
          accounts: [],
          holdings: [],
          totalBalance: 0,
          totalContribution: 0,
          totalGovernmentContribution: 0,
          message: 'No APY account found',
          fetchedAt: new Date().toISOString()
        };
      }

      // Parse and normalize response
      return this.parseAPYResponse(apyResponse.data);
    } catch (error) {
      throw new Error(`Account Aggregator API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse Account Aggregator API response
   */
  private parseAPYResponse(data: any): APYFetchResponse {
    const accounts: APYAccount[] = [];
    const holdings: APYHolding[] = [];

    let totalBalance = 0;
    let totalContribution = 0;
    let totalGovernmentContribution = 0;

    data.accounts.forEach((account: any) => {
      const balance = parseFloat(account.total_balance || '0');
      const userContribution = parseFloat(account.total_contribution || '0');
      const govtContribution = parseFloat(account.government_contribution || '0');

      totalBalance += balance;
      totalContribution += userContribution;
      totalGovernmentContribution += govtContribution;

      accounts.push({
        pran: account.pran,
        accountHolderName: account.account_holder_name,
        pensionAmount: parseFloat(account.pension_amount),
        monthlyContribution: parseFloat(account.monthly_contribution),
        totalBalance: balance,
        bankName: account.bank_name,
        status: account.status
      });

      // Calculate years to maturity
      const currentDate = new Date();
      const dobDate = new Date(account.date_of_birth);
      const currentAge = currentDate.getFullYear() - dobDate.getFullYear();
      const yearsToMaturity = 60 - currentAge;

      holdings.push({
        pran: account.pran,
        accountHolderName: account.account_holder_name,
        dateOfBirth: account.date_of_birth,
        enrollmentDate: account.enrollment_date,
        enrollmentAge: parseInt(account.enrollment_age),
        pensionAmount: parseFloat(account.pension_amount),
        monthlyContribution: parseFloat(account.monthly_contribution),
        totalContribution: userContribution,
        governmentContribution: govtContribution,
        totalBalance: balance,
        maturityAge: 60,
        yearsToMaturity,
        expectedMaturityDate: account.expected_maturity_date,
        bankName: account.bank_name,
        bankAccountNumber: account.bank_account_number,
        ifscCode: account.ifsc_code,
        branchName: account.branch_name || null,
        nominee: account.nominee || null,
        nomineeRelation: account.nominee_relation || null,
        status: account.status,
        lastContributionDate: account.last_contribution_date || null
      });
    });

    return {
      success: true,
      accounts,
      holdings,
      totalBalance,
      totalContribution,
      totalGovernmentContribution,
      fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Generate mock APY data for development
   */
  private getMockAPYData(panNumber: string): APYFetchResponse {
    const mockAccounts: APYAccount[] = [
      {
        pran: '987654321098', // 12-digit PRAN
        accountHolderName: 'Test User',
        pensionAmount: 5000.00, // ₹5000/month pension at 60
        monthlyContribution: 1454.00, // For age 30, ₹5000 pension
        totalBalance: 87240.00, // 5 years * 12 months * ₹1454
        bankName: 'State Bank of India',
        status: 'active'
      }
    ];

    const mockHoldings: APYHolding[] = [
      {
        pran: '987654321098',
        accountHolderName: 'Test User',
        dateOfBirth: '1995-03-20',
        enrollmentDate: '2020-04-01',
        enrollmentAge: 25,
        
        // Pension Details
        pensionAmount: 5000.00, // Guaranteed ₹5000/month at age 60
        monthlyContribution: 1454.00, // Monthly contribution for age 25, ₹5000 pension
        
        // Contribution Tracking
        totalContribution: 87240.00, // 5 years * 12 months * ₹1454
        governmentContribution: 5000.00, // ₹1000/year for 5 years (govt co-contribution)
        totalBalance: 102580.00, // User contribution + Govt contribution + interest
        
        // Account Details
        maturityAge: 60,
        yearsToMaturity: 30, // Current age 30, maturity at 60
        expectedMaturityDate: '2055-04-01',
        
        // Bank Details
        bankName: 'State Bank of India',
        bankAccountNumber: 'XXXXXXXXXXXX5678',
        ifscCode: 'SBIN0001234',
        branchName: 'Mumbai Main Branch',
        
        // Nominee
        nominee: 'Spouse Name',
        nomineeRelation: 'Spouse',
        
        // Status
        status: 'active',
        lastContributionDate: '2025-10-01'
      }
    ];

    return {
      success: true,
      accounts: mockAccounts,
      holdings: mockHoldings,
      totalBalance: 102580.00,
      totalContribution: 87240.00,
      totalGovernmentContribution: 5000.00,
      fetchedAt: new Date().toISOString()
    };
  }
}
