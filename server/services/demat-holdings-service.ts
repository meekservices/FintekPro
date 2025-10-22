/**
 * NSDL/CDSL Demat Holdings Service
 * 
 * Fetches demat account holdings (equities, bonds, ETFs) via Account Aggregator framework
 * Supports both NSDL and CDSL depositories
 * 
 * Integration: Account Aggregator (AA) for consent-based data fetch
 */

import axios from 'axios';

export interface DematAccount {
  dematAccountNumber: string; // 16-digit BO ID
  dpId: string; // 8-digit DP ID
  dpName: string; // Depository Participant name
  depository: 'NSDL' | 'CDSL';
  status: 'active' | 'inactive' | 'suspended';
}

export interface DematHolding {
  isin: string; // International Securities Identification Number
  symbol: string; // Stock symbol
  companyName: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currentValue: number;
  investedAmount: number;
  returns: number;
  returnsPercentage: number;
  assetType: 'equity' | 'bond' | 'etf' | 'mutual_fund';
  exchange: 'NSE' | 'BSE' | 'BOTH';
  sector?: string;
  industry?: string;
  marketCap?: number;
  pledgedQuantity?: number;
  freeQuantity?: number;
  lockedQuantity?: number;
  // Depository information
  depository: 'NSDL' | 'CDSL';
  dematAccountNumber: string;
}

export interface DematFetchRequest {
  panNumber: string;
  name: string;
  dob: string;
  mobile?: string;
  email?: string;
  requestId?: string;
}

export interface DematFetchResponse {
  success: boolean;
  accounts: DematAccount[];
  totalHoldings: number;
  totalValue: number;
  totalInvestedAmount: number;
  totalReturns: number;
  totalReturnsPercentage: number;
  holdings: DematHolding[];
  nsdlHoldings: number;
  cdslHoldings: number;
  message?: string;
}

export class DematHoldingsService {
  private isProduction: boolean;
  private aaBaseUrl: string;
  private aaApiKey: string;

  constructor() {
    this.isProduction = process.env.AA_ENVIRONMENT === 'production';
    
    this.aaBaseUrl = this.isProduction
      ? 'https://api.accountaggregator.org.in/v1'
      : 'https://sandbox-api.accountaggregator.org.in/v1';

    this.aaApiKey = process.env.AA_API_KEY || 'sandbox_key';
  }

  /**
   * Fetch demat holdings via Account Aggregator
   */
  async fetchHoldings(request: DematFetchRequest): Promise<DematFetchResponse> {
    try {
      console.log(`📊 Fetching demat holdings via Account Aggregator`);

      if (!this.isProduction) {
        // Return mock data for development
        return this.getMockDematData(request.panNumber);
      }

      // Production: Call Account Aggregator API
      const aaResponse = await this.callAccountAggregatorAPI(request);
      
      // Parse accounts and holdings
      const { accounts, holdings } = await this.parseAAResponse(aaResponse);

      // Fetch current market prices for all holdings
      const enrichedHoldings = await this.enrichWithMarketData(holdings);

      // Calculate totals
      const totalValue = enrichedHoldings.reduce((sum, h) => sum + h.currentValue, 0);
      const totalInvestedAmount = enrichedHoldings.reduce((sum, h) => sum + h.investedAmount, 0);
      const totalReturns = totalValue - totalInvestedAmount;
      const totalReturnsPercentage = totalInvestedAmount > 0 
        ? (totalReturns / totalInvestedAmount) * 100 
        : 0;

      // Count by depository (each holding already has depository info from parseAAResponse)
      const nsdlHoldings = enrichedHoldings.filter(h => h.depository === 'NSDL').length;
      const cdslHoldings = enrichedHoldings.filter(h => h.depository === 'CDSL').length;

      console.log(`✅ Fetched ${enrichedHoldings.length} demat holdings across ${accounts.length} accounts (Total Value: ₹${totalValue.toFixed(2)})`);

      return {
        success: true,
        accounts,
        totalHoldings: enrichedHoldings.length,
        totalValue,
        totalInvestedAmount,
        totalReturns,
        totalReturnsPercentage,
        holdings: enrichedHoldings,
        nsdlHoldings,
        cdslHoldings
      };

    } catch (error: any) {
      console.error('❌ Demat holdings fetch error:', error.message);
      
      return {
        success: false,
        accounts: [],
        totalHoldings: 0,
        totalValue: 0,
        totalInvestedAmount: 0,
        totalReturns: 0,
        totalReturnsPercentage: 0,
        holdings: [],
        nsdlHoldings: 0,
        cdslHoldings: 0,
        message: `Demat fetch failed: ${error.message}`
      };
    }
  }

  /**
   * Call Account Aggregator API (Production)
   */
  private async callAccountAggregatorAPI(request: DematFetchRequest): Promise<any> {
    const endpoint = `${this.aaBaseUrl}/demat/fetch`;

    const payload = {
      pan: request.panNumber,
      name: request.name,
      dob: request.dob,
      mobile: request.mobile || '',
      email: request.email || '',
      consent_id: request.requestId || '',
      data_range: {
        from: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // Last 1 year
        to: new Date().toISOString()
      }
    };

    try {
      const response = await axios.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.aaApiKey,
          'X-Request-ID': request.requestId || `demat_${Date.now()}`
        },
        timeout: 30000
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Account Aggregator API error:', error.message);
      throw new Error(`AA API failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Parse Account Aggregator response
   */
  private async parseAAResponse(aaResponse: any): Promise<{ 
    accounts: DematAccount[], 
    holdings: DematHolding[] 
  }> {
    const accounts: DematAccount[] = [];
    const holdings: DematHolding[] = [];

    // AA response structure varies by provider, this is a generic parser
    const accountsData = aaResponse.data?.accounts || [];
    
    for (const accountData of accountsData) {
      // Parse account info
      accounts.push({
        dematAccountNumber: accountData.account_number,
        dpId: accountData.dp_id,
        dpName: accountData.dp_name,
        depository: accountData.depository,
        status: accountData.status
      });

      // Parse holdings
      const holdingsData = accountData.holdings || [];
      for (const holding of holdingsData) {
        holdings.push({
          isin: holding.isin,
          symbol: holding.symbol || this.extractSymbolFromISIN(holding.isin),
          companyName: holding.security_name,
          quantity: parseFloat(holding.quantity),
          averagePrice: parseFloat(holding.average_cost || '0'),
          currentPrice: parseFloat(holding.current_price || '0'),
          currentValue: parseFloat(holding.current_value || '0'),
          investedAmount: parseFloat(holding.invested_amount || '0'),
          returns: parseFloat(holding.gain_loss || '0'),
          returnsPercentage: parseFloat(holding.gain_loss_percent || '0'),
          assetType: this.determineAssetType(holding.isin, holding.security_name),
          exchange: holding.exchange || 'NSE',
          pledgedQuantity: parseFloat(holding.pledged_quantity || '0'),
          freeQuantity: parseFloat(holding.free_quantity || holding.quantity),
          lockedQuantity: parseFloat(holding.locked_quantity || '0'),
          // Associate holding with its depository account
          depository: accountData.depository,
          dematAccountNumber: accountData.account_number
        });
      }
    }

    return { accounts, holdings };
  }

  /**
   * Enrich holdings with real-time market data
   */
  private async enrichWithMarketData(holdings: DematHolding[]): Promise<DematHolding[]> {
    // In production, fetch current prices from NSE/BSE APIs
    // For now, return as-is (prices should come from AA response)
    return holdings;
  }

  /**
   * Determine asset type from ISIN and name
   */
  private determineAssetType(isin: string, name: string): 'equity' | 'bond' | 'etf' | 'mutual_fund' {
    if (isin.startsWith('INE') && isin.length === 12) {
      // Indian Equity
      if (name.toLowerCase().includes('etf')) return 'etf';
      return 'equity';
    }
    
    if (isin.startsWith('IN') && isin.length === 12) {
      // Could be bond or mutual fund
      if (name.toLowerCase().includes('bond') || name.toLowerCase().includes('debenture')) {
        return 'bond';
      }
      if (name.toLowerCase().includes('mutual') || name.toLowerCase().includes('fund')) {
        return 'mutual_fund';
      }
    }

    return 'equity'; // Default
  }

  /**
   * Extract stock symbol from ISIN (fallback)
   */
  private extractSymbolFromISIN(isin: string): string {
    // This is a placeholder - in production, use a proper ISIN-to-Symbol mapping service
    return isin.substring(3, 9).toUpperCase();
  }

  /**
   * Generate mock demat data for development
   */
  private getMockDematData(panNumber: string): DematFetchResponse {
    const mockAccounts: DematAccount[] = [
      {
        dematAccountNumber: '1204470000123456',
        dpId: '12044700',
        dpName: 'HDFC Bank Ltd',
        depository: 'NSDL',
        status: 'active'
      },
      {
        dematAccountNumber: 'IN30023910654321',
        dpId: 'IN300239',
        dpName: 'ICICI Securities Ltd',
        depository: 'CDSL',
        status: 'active'
      }
    ];

    const mockHoldings: DematHolding[] = [
      // NSDL Account Holdings
      {
        isin: 'INE002A01018',
        symbol: 'RELIANCE',
        companyName: 'Reliance Industries Ltd',
        quantity: 50,
        averagePrice: 2350.00,
        currentPrice: 2615.50,
        currentValue: 130775.00,
        investedAmount: 117500.00,
        returns: 13275.00,
        returnsPercentage: 11.30,
        assetType: 'equity',
        exchange: 'NSE',
        sector: 'Energy',
        industry: 'Oil & Gas',
        marketCap: 17680000000000,
        freeQuantity: 50,
        pledgedQuantity: 0,
        lockedQuantity: 0,
        depository: 'NSDL',
        dematAccountNumber: mockAccounts[0].dematAccountNumber
      },
      {
        isin: 'INE009A01021',
        symbol: 'INFY',
        companyName: 'Infosys Ltd',
        quantity: 100,
        averagePrice: 1450.00,
        currentPrice: 1589.25,
        currentValue: 158925.00,
        investedAmount: 145000.00,
        returns: 13925.00,
        returnsPercentage: 9.60,
        assetType: 'equity',
        exchange: 'NSE',
        sector: 'Technology',
        industry: 'IT Services',
        marketCap: 6590000000000,
        freeQuantity: 100,
        pledgedQuantity: 0,
        lockedQuantity: 0,
        depository: 'NSDL',
        dematAccountNumber: mockAccounts[0].dematAccountNumber
      },
      {
        isin: 'INF209KB1X25',
        symbol: 'NIFTYBEES',
        companyName: 'Nippon India ETF Nifty BeES',
        quantity: 500,
        averagePrice: 220.50,
        currentPrice: 245.30,
        currentValue: 122650.00,
        investedAmount: 110250.00,
        returns: 12400.00,
        returnsPercentage: 11.25,
        assetType: 'etf',
        exchange: 'NSE',
        sector: 'Index Fund',
        industry: 'ETF',
        freeQuantity: 500,
        pledgedQuantity: 0,
        lockedQuantity: 0,
        depository: 'NSDL',
        dematAccountNumber: mockAccounts[0].dematAccountNumber
      },
      // CDSL Account Holdings
      {
        isin: 'INE040A01034',
        symbol: 'HDFCBANK',
        companyName: 'HDFC Bank Ltd',
        quantity: 75,
        averagePrice: 1520.00,
        currentPrice: 1645.30,
        currentValue: 123397.50,
        investedAmount: 114000.00,
        returns: 9397.50,
        returnsPercentage: 8.24,
        assetType: 'equity',
        exchange: 'NSE',
        sector: 'Financial Services',
        industry: 'Banks',
        marketCap: 12450000000000,
        freeQuantity: 75,
        pledgedQuantity: 0,
        lockedQuantity: 0,
        depository: 'CDSL',
        dematAccountNumber: mockAccounts[1].dematAccountNumber
      },
      {
        isin: 'INE467B01029',
        symbol: 'TATASTEEL',
        companyName: 'Tata Steel Ltd',
        quantity: 200,
        averagePrice: 115.50,
        currentPrice: 128.75,
        currentValue: 25750.00,
        investedAmount: 23100.00,
        returns: 2650.00,
        returnsPercentage: 11.47,
        assetType: 'equity',
        exchange: 'NSE',
        sector: 'Materials',
        industry: 'Steel',
        marketCap: 1580000000000,
        freeQuantity: 200,
        pledgedQuantity: 0,
        lockedQuantity: 0,
        depository: 'CDSL',
        dematAccountNumber: mockAccounts[1].dematAccountNumber
      },
      {
        isin: 'INE155A01022',
        symbol: 'TATAMOTORS',
        companyName: 'Tata Motors Ltd',
        quantity: 150,
        averagePrice: 450.00,
        currentPrice: 525.80,
        currentValue: 78870.00,
        investedAmount: 67500.00,
        returns: 11370.00,
        returnsPercentage: 16.84,
        assetType: 'equity',
        exchange: 'NSE',
        sector: 'Consumer Discretionary',
        industry: 'Automobiles',
        marketCap: 1920000000000,
        freeQuantity: 150,
        pledgedQuantity: 0,
        lockedQuantity: 0,
        depository: 'CDSL',
        dematAccountNumber: mockAccounts[1].dematAccountNumber
      }
    ];

    const totalValue = mockHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalInvestedAmount = mockHoldings.reduce((sum, h) => sum + h.investedAmount, 0);
    const totalReturns = totalValue - totalInvestedAmount;
    const totalReturnsPercentage = (totalReturns / totalInvestedAmount) * 100;

    return {
      success: true,
      accounts: mockAccounts,
      totalHoldings: mockHoldings.length,
      totalValue,
      totalInvestedAmount,
      totalReturns,
      totalReturnsPercentage,
      holdings: mockHoldings,
      nsdlHoldings: 3,
      cdslHoldings: 3
    };
  }
}

// Export singleton instance
export const dematHoldingsService = new DematHoldingsService();
