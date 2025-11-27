/**
 * Reports Hub Service
 * 
 * Centralized service for fetching financial reports from various sources:
 * - BSE STAR MF: Mutual Fund Holdings, Transactions, SIP, Capital Gains
 * - NSDL/CDSL: Demat holdings via Account Aggregator
 * - EPFO: EPF Passbook via Aadhaar OTP
 * - NPS CRA: NPS Statements
 * - Income Tax: AIS, Form 26AS
 */

import { BSEStarCASService, MutualFundHolding, CASFetchResponse } from './bse-star-cas-service';

export interface ReportRequest {
  userId: string;
  panNumber: string;
  financialYear?: string;
  fromDate?: string;
  toDate?: string;
}

export interface MFHoldingsReport {
  success: boolean;
  source: string;
  fetchedAt: string;
  holdings: MutualFundHolding[];
  summary: {
    totalHoldings: number;
    totalCurrentValue: number;
    totalInvestedAmount: number;
    totalReturns: number;
    totalReturnsPercentage: number;
  };
  rtaSummary: {
    camsHoldings: number;
    karvyHoldings: number;
    franklinHoldings: number;
  };
}

export interface MFTransactionReport {
  success: boolean;
  source: string;
  fetchedAt: string;
  transactions: MFTransaction[];
  summary: {
    totalTransactions: number;
    totalPurchases: number;
    totalRedemptions: number;
    totalSwitches: number;
    totalDividends: number;
  };
}

export interface MFTransaction {
  id: string;
  folioNumber: string;
  schemeName: string;
  transactionType: 'Purchase' | 'Redemption' | 'Switch-In' | 'Switch-Out' | 'Dividend';
  transactionDate: string;
  units: number;
  nav: number;
  amount: number;
  status: string;
}

export interface SIPSummaryReport {
  success: boolean;
  source: string;
  fetchedAt: string;
  activeSIPs: SIPDetails[];
  summary: {
    totalActiveSIPs: number;
    totalMonthlyAmount: number;
    totalSIPsCompleted: number;
    totalSIPsPaused: number;
  };
}

export interface SIPDetails {
  id: string;
  folioNumber: string;
  schemeName: string;
  amcName: string;
  sipAmount: number;
  frequency: 'Monthly' | 'Quarterly' | 'Weekly';
  startDate: string;
  endDate?: string;
  nextInstallmentDate: string;
  installmentsDone: number;
  totalInstallments: number;
  status: 'Active' | 'Paused' | 'Completed' | 'Cancelled';
}

export interface DematSnapshotReport {
  success: boolean;
  source: string;
  depository: 'NSDL' | 'CDSL';
  fetchedAt: string;
  holdings: DematHolding[];
  summary: {
    totalHoldings: number;
    totalCurrentValue: number;
    totalUnits: number;
  };
}

export interface DematHolding {
  isin: string;
  symbol: string;
  companyName: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercentage: number;
  sector?: string;
}

export interface EPFPassbookReport {
  success: boolean;
  source: string;
  fetchedAt: string;
  accountDetails: {
    uanNumber: string;
    memberName: string;
    establishmentName: string;
    dateOfJoining: string;
  };
  balance: {
    employeeShare: number;
    employerShare: number;
    pensionShare: number;
    totalBalance: number;
  };
  contributions: EPFContribution[];
}

export interface EPFContribution {
  month: string;
  year: number;
  wageMonth: string;
  employeeContribution: number;
  employerContribution: number;
  pensionContribution: number;
  status: 'Credited' | 'Pending';
}

export interface NPSStatementReport {
  success: boolean;
  source: string;
  fetchedAt: string;
  accountDetails: {
    pranNumber: string;
    subscriberName: string;
    accountType: 'Tier I' | 'Tier II' | 'Both';
    pfmName: string;
  };
  balances: {
    tierI: number;
    tierII: number;
    totalBalance: number;
  };
  allocation: {
    equityE: number;
    corporateBondC: number;
    governmentBondG: number;
    alternativeA: number;
  };
  contributions: NPSContribution[];
}

export interface NPSContribution {
  transactionDate: string;
  transactionType: 'Contribution' | 'Withdrawal';
  tier: 'Tier I' | 'Tier II';
  amount: number;
  nav: number;
  units: number;
}

export class ReportsHubService {
  private bseCasService: BSEStarCASService;
  private isProduction: boolean;

  constructor() {
    this.bseCasService = new BSEStarCASService();
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Fetch Mutual Fund Holdings from BSE STAR MF
   */
  async fetchMFHoldings(request: ReportRequest): Promise<MFHoldingsReport> {
    try {
      console.log(`📊 [Reports Hub] Fetching MF Holdings for user ${request.userId}`);
      
      const casResponse = await this.bseCasService.fetchCAS({
        panNumber: request.panNumber,
        name: '',
        dob: ''
      });

      if (!casResponse.success) {
        return {
          success: false,
          source: 'BSE STAR MF - GetHoldingReport',
          fetchedAt: new Date().toISOString(),
          holdings: [],
          summary: {
            totalHoldings: 0,
            totalCurrentValue: 0,
            totalInvestedAmount: 0,
            totalReturns: 0,
            totalReturnsPercentage: 0
          },
          rtaSummary: { camsHoldings: 0, karvyHoldings: 0, franklinHoldings: 0 }
        };
      }

      return {
        success: true,
        source: 'BSE STAR MF - GetHoldingReport',
        fetchedAt: new Date().toISOString(),
        holdings: casResponse.holdings,
        summary: {
          totalHoldings: casResponse.totalHoldings,
          totalCurrentValue: casResponse.totalValue,
          totalInvestedAmount: casResponse.totalInvestedAmount,
          totalReturns: casResponse.totalReturns,
          totalReturnsPercentage: casResponse.totalReturnsPercentage
        },
        rtaSummary: casResponse.rtaSummary
      };
    } catch (error) {
      console.error('Error fetching MF holdings:', error);
      throw error;
    }
  }

  /**
   * Fetch Mutual Fund Transactions from BSE STAR MF
   */
  async fetchMFTransactions(request: ReportRequest): Promise<MFTransactionReport> {
    console.log(`📊 [Reports Hub] Fetching MF Transactions for user ${request.userId}`);
    
    // Mock transaction data - in production this would call BSE STAR MF API
    const mockTransactions: MFTransaction[] = [
      {
        id: 'TXN001',
        folioNumber: '1234567890/12',
        schemeName: 'HDFC Equity Fund - Growth',
        transactionType: 'Purchase',
        transactionDate: '2024-01-15',
        units: 150.25,
        nav: 485.50,
        amount: 72946.38,
        status: 'Completed'
      },
      {
        id: 'TXN002',
        folioNumber: '1234567890/12',
        schemeName: 'ICICI Prudential Bluechip Fund',
        transactionType: 'Purchase',
        transactionDate: '2024-02-10',
        units: 200.00,
        nav: 750.25,
        amount: 150050.00,
        status: 'Completed'
      },
      {
        id: 'TXN003',
        folioNumber: '9876543210/45',
        schemeName: 'SBI Liquid Fund - Growth',
        transactionType: 'Redemption',
        transactionDate: '2024-03-01',
        units: -50.00,
        nav: 3250.00,
        amount: 162500.00,
        status: 'Completed'
      }
    ];

    const totalPurchases = mockTransactions
      .filter(t => t.transactionType === 'Purchase')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalRedemptions = mockTransactions
      .filter(t => t.transactionType === 'Redemption')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      success: true,
      source: 'BSE STAR MF - GetTransactionReport',
      fetchedAt: new Date().toISOString(),
      transactions: mockTransactions,
      summary: {
        totalTransactions: mockTransactions.length,
        totalPurchases,
        totalRedemptions,
        totalSwitches: 0,
        totalDividends: 0
      }
    };
  }

  /**
   * Fetch SIP Summary from BSE STAR MF
   */
  async fetchSIPSummary(request: ReportRequest): Promise<SIPSummaryReport> {
    console.log(`📊 [Reports Hub] Fetching SIP Summary for user ${request.userId}`);
    
    // Mock SIP data - in production this would call BSE STAR MF API
    const mockSIPs: SIPDetails[] = [
      {
        id: 'SIP001',
        folioNumber: '1234567890/12',
        schemeName: 'HDFC Equity Fund - Growth',
        amcName: 'HDFC Asset Management',
        sipAmount: 10000,
        frequency: 'Monthly',
        startDate: '2023-01-05',
        nextInstallmentDate: '2024-04-05',
        installmentsDone: 15,
        totalInstallments: 60,
        status: 'Active'
      },
      {
        id: 'SIP002',
        folioNumber: '9876543210/45',
        schemeName: 'Axis Small Cap Fund - Direct Growth',
        amcName: 'Axis Asset Management',
        sipAmount: 5000,
        frequency: 'Monthly',
        startDate: '2023-06-10',
        nextInstallmentDate: '2024-04-10',
        installmentsDone: 10,
        totalInstallments: 36,
        status: 'Active'
      }
    ];

    const totalMonthlyAmount = mockSIPs
      .filter(s => s.status === 'Active')
      .reduce((sum, s) => sum + s.sipAmount, 0);

    return {
      success: true,
      source: 'BSE STAR MF - SIPReport',
      fetchedAt: new Date().toISOString(),
      activeSIPs: mockSIPs,
      summary: {
        totalActiveSIPs: mockSIPs.filter(s => s.status === 'Active').length,
        totalMonthlyAmount,
        totalSIPsCompleted: 0,
        totalSIPsPaused: 0
      }
    };
  }

  /**
   * Fetch Demat Snapshot from NSDL/CDSL via Account Aggregator
   */
  async fetchDematSnapshot(request: ReportRequest, depository: 'NSDL' | 'CDSL' = 'NSDL'): Promise<DematSnapshotReport> {
    console.log(`📊 [Reports Hub] Fetching ${depository} Demat Snapshot for user ${request.userId}`);
    
    // Mock demat holdings - in production this would call AA API
    const mockHoldings: DematHolding[] = [
      {
        isin: 'INE002A01018',
        symbol: 'RELIANCE',
        companyName: 'Reliance Industries Ltd',
        quantity: 50,
        averagePrice: 2350.00,
        currentPrice: 2890.50,
        currentValue: 144525.00,
        gainLoss: 27025.00,
        gainLossPercentage: 23.00,
        sector: 'Energy'
      },
      {
        isin: 'INE009A01021',
        symbol: 'INFY',
        companyName: 'Infosys Ltd',
        quantity: 100,
        averagePrice: 1450.00,
        currentPrice: 1520.75,
        currentValue: 152075.00,
        gainLoss: 7075.00,
        gainLossPercentage: 4.88,
        sector: 'IT'
      },
      {
        isin: 'INE040A01034',
        symbol: 'HDFCBANK',
        companyName: 'HDFC Bank Ltd',
        quantity: 75,
        averagePrice: 1580.00,
        currentPrice: 1650.25,
        currentValue: 123768.75,
        gainLoss: 5268.75,
        gainLossPercentage: 4.45,
        sector: 'Banking'
      }
    ];

    const totalCurrentValue = mockHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalUnits = mockHoldings.reduce((sum, h) => sum + h.quantity, 0);

    return {
      success: true,
      source: `Account Aggregator - ${depository} Statement API`,
      depository,
      fetchedAt: new Date().toISOString(),
      holdings: mockHoldings,
      summary: {
        totalHoldings: mockHoldings.length,
        totalCurrentValue,
        totalUnits
      }
    };
  }

  /**
   * Fetch EPF Passbook from EPFO
   */
  async fetchEPFPassbook(request: ReportRequest): Promise<EPFPassbookReport> {
    console.log(`📊 [Reports Hub] Fetching EPF Passbook for user ${request.userId}`);
    
    // Mock EPF data - in production this would call EPFO API with Aadhaar OTP
    const mockContributions: EPFContribution[] = [];
    const currentYear = new Date().getFullYear();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentYear, new Date().getMonth() - i, 1);
      mockContributions.push({
        month: date.toLocaleString('en-IN', { month: 'short' }),
        year: date.getFullYear(),
        wageMonth: `${date.toLocaleString('en-IN', { month: 'short' })} ${date.getFullYear()}`,
        employeeContribution: 7500,
        employerContribution: 7500,
        pensionContribution: 3300,
        status: i === 0 ? 'Pending' : 'Credited'
      });
    }

    const totalEmployee = mockContributions.reduce((sum, c) => sum + c.employeeContribution, 0);
    const totalEmployer = mockContributions.reduce((sum, c) => sum + c.employerContribution, 0);
    const totalPension = mockContributions.reduce((sum, c) => sum + c.pensionContribution, 0);

    return {
      success: true,
      source: 'EPFO Passbook API + Aadhaar OTP',
      fetchedAt: new Date().toISOString(),
      accountDetails: {
        uanNumber: '101234567890',
        memberName: 'Sample User',
        establishmentName: 'ABC Technologies Pvt Ltd',
        dateOfJoining: '2020-04-01'
      },
      balance: {
        employeeShare: totalEmployee + 250000,
        employerShare: totalEmployer + 150000,
        pensionShare: totalPension + 100000,
        totalBalance: totalEmployee + totalEmployer + totalPension + 500000
      },
      contributions: mockContributions
    };
  }

  /**
   * Fetch NPS Statement from CRA
   */
  async fetchNPSStatement(request: ReportRequest): Promise<NPSStatementReport> {
    console.log(`📊 [Reports Hub] Fetching NPS Statement for user ${request.userId}`);
    
    // Mock NPS data - in production this would call Protean CRA API
    const mockContributions: NPSContribution[] = [];
    const currentYear = new Date().getFullYear();
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentYear, new Date().getMonth() - i, 15);
      mockContributions.push({
        transactionDate: date.toISOString().split('T')[0],
        transactionType: 'Contribution',
        tier: 'Tier I',
        amount: 5000,
        nav: 45.50 + (Math.random() * 2),
        units: 109.89
      });
    }

    return {
      success: true,
      source: 'Protean CRA API / KFin NPS CRA',
      fetchedAt: new Date().toISOString(),
      accountDetails: {
        pranNumber: 'PRAN123456789012',
        subscriberName: 'Sample User',
        accountType: 'Both',
        pfmName: 'HDFC Pension Management Company'
      },
      balances: {
        tierI: 185000,
        tierII: 45000,
        totalBalance: 230000
      },
      allocation: {
        equityE: 50,
        corporateBondC: 30,
        governmentBondG: 15,
        alternativeA: 5
      },
      contributions: mockContributions
    };
  }

  /**
   * Sync MF holdings to user's portfolio in database
   */
  async syncMFHoldingsToPortfolio(userId: string, portfolioId: string, holdings: MutualFundHolding[]): Promise<number> {
    console.log(`🔄 [Reports Hub] Syncing ${holdings.length} MF holdings to portfolio ${portfolioId}`);
    
    // In production, this would:
    // 1. Clear existing MF holdings for this portfolio
    // 2. Insert new holdings from BSE STAR
    // 3. Return the number of synced holdings
    
    return holdings.length;
  }
}

export const reportsHubService = new ReportsHubService();
