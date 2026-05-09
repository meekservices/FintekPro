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

// Expanded asset types for all demat securities
export type DematAssetType = 
  | 'equity' 
  | 'bond' 
  | 'ncd' 
  | 'etf' 
  | 'mutual_fund' 
  | 'aif' 
  | 'pms' 
  | 'reit' 
  | 'invit' 
  | 'sgb' 
  | 'mld' 
  | 'gsec' 
  | 'preference_share'
  | 'convertible';

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
  assetType: DematAssetType;
  exchange: 'NSE' | 'BSE' | 'BOTH' | 'OTC';
  sector?: string;
  industry?: string;
  marketCap?: number;
  pledgedQuantity?: number;
  freeQuantity?: number;
  lockedQuantity?: number;
  // Bond/NCD specific
  faceValue?: number;
  couponRate?: number;
  maturityDate?: string;
  creditRating?: string;
  // AIF/PMS specific
  schemeType?: string;
  fundManager?: string;
  // REIT/InvIT specific
  distributionYield?: number;
  // SGB specific
  issueDate?: string;
  redemptionDate?: string;
  // Depository information
  depository: 'NSDL' | 'CDSL';
  dematAccountNumber: string;
}

// Demat transaction types
export type DematTransactionType = 
  | 'buy' 
  | 'sell' 
  | 'bonus' 
  | 'split' 
  | 'rights' 
  | 'dividend' 
  | 'interest' 
  | 'maturity' 
  | 'redemption' 
  | 'corporate_action'
  | 'ipo_allotment'
  | 'transfer_in'
  | 'transfer_out'
  | 'pledge'
  | 'unpledge';

export interface DematTransaction {
  transactionId: string;
  isin: string;
  symbol: string;
  securityName: string;
  transactionDate: string;
  transactionType: DematTransactionType;
  quantity: number;
  price: number;
  amount: number;
  brokerage: number;
  stt: number;
  stampDuty: number;
  gst: number;
  otherCharges: number;
  netAmount: number;
  exchange: 'NSE' | 'BSE' | 'OTC';
  orderNumber?: string;
  tradeNumber?: string;
  settlementDate?: string;
  remarks?: string;
  depository: 'NSDL' | 'CDSL';
  dematAccountNumber: string;
}

export interface DematTransactionResponse {
  success: boolean;
  totalTransactions: number;
  transactions: DematTransaction[];
  fromDate: string;
  toDate: string;
  message?: string;
}

export interface UnifiedDematResponse {
  success: boolean;
  holdings: DematFetchResponse;
  transactions: DematTransactionResponse;
  message?: string;
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

    this.aaApiKey = process.env.AA_API_KEY || '';
  }

  private hasValidCredentials(): boolean {
    return !!this.aaApiKey;
  }

  /**
   * Fetch demat holdings via Account Aggregator
   */
  async fetchHoldings(request: DematFetchRequest): Promise<DematFetchResponse> {
    try {
      console.log(`📊 Fetching demat holdings via Account Aggregator`);

      if (!this.hasValidCredentials()) {
        throw new Error('Demat data service not configured. Set AA_API_KEY for Account Aggregator demat holdings.');
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
        // Safe number parsing helper to prevent NaN corruption
        const safeParseFloat = (val: any, defaultVal: number = 0): number => {
          if (val === null || val === undefined || val === '') return defaultVal;
          const parsed = parseFloat(String(val));
          return isNaN(parsed) ? defaultVal : parsed;
        };

        const quantity = safeParseFloat(holding.quantity, 0);
        const averagePrice = safeParseFloat(holding.average_cost, 0);
        const currentPrice = safeParseFloat(holding.current_price, 0);
        
        // Skip invalid holdings with zero or missing quantity
        if (quantity <= 0 || !holding.isin) {
          console.warn(`Skipping invalid holding: ${holding.isin || 'unknown'} - quantity: ${quantity}`);
          continue;
        }

        // Calculate values if not provided
        const investedAmount = safeParseFloat(holding.invested_amount, quantity * averagePrice);
        const currentValue = safeParseFloat(holding.current_value, quantity * currentPrice);
        const returns = safeParseFloat(holding.gain_loss, currentValue - investedAmount);
        const returnsPercentage = investedAmount > 0 
          ? safeParseFloat(holding.gain_loss_percent, (returns / investedAmount) * 100)
          : 0;

        holdings.push({
          isin: holding.isin,
          symbol: holding.symbol || this.extractSymbolFromISIN(holding.isin),
          companyName: holding.security_name || 'Unknown Security',
          quantity,
          averagePrice,
          currentPrice,
          currentValue,
          investedAmount,
          returns,
          returnsPercentage,
          assetType: this.determineAssetType(holding.isin, holding.security_name || ''),
          exchange: holding.exchange || 'NSE',
          pledgedQuantity: safeParseFloat(holding.pledged_quantity, 0),
          freeQuantity: safeParseFloat(holding.free_quantity, quantity),
          lockedQuantity: safeParseFloat(holding.locked_quantity, 0),
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
   * Determine asset type from ISIN and name - expanded for all demat securities
   */
  private determineAssetType(isin: string, name: string): DematAssetType {
    const upperIsin = isin.toUpperCase();
    const lowerName = name.toLowerCase();
    
    // INF prefix - Mutual Funds
    if (upperIsin.startsWith('INF')) {
      if (lowerName.includes('etf')) return 'etf';
      return 'mutual_fund';
    }
    
    // INV prefix - Alternative Investment Funds
    if (upperIsin.startsWith('INV')) {
      return 'aif';
    }
    
    // INS prefix - Government Securities
    if (upperIsin.startsWith('INS')) {
      return 'gsec';
    }
    
    // INE prefix - Equity or Debt instruments
    if (upperIsin.startsWith('INE')) {
      // Check for specific instrument types by name
      if (lowerName.includes('reit') || lowerName.includes('real estate investment trust')) return 'reit';
      if (lowerName.includes('invit') || lowerName.includes('infrastructure investment trust')) return 'invit';
      if (lowerName.includes('etf') || lowerName.includes('exchange traded')) return 'etf';
      if (lowerName.includes('sovereign gold bond') || lowerName.includes('sgb')) return 'sgb';
      if (lowerName.includes('market linked debenture') || lowerName.includes('mld')) return 'mld';
      if (lowerName.includes('ncd') || lowerName.includes('non convertible debenture')) return 'ncd';
      if (lowerName.includes('bond') || lowerName.includes('debenture')) return 'bond';
      if (lowerName.includes('preference share') || lowerName.includes('pref')) return 'preference_share';
      if (lowerName.includes('convertible')) return 'convertible';
      if (lowerName.includes('pms') || lowerName.includes('portfolio management')) return 'pms';
      
      // Check ISIN 6th character for debt vs equity (Indian convention)
      // If 6th char is typically numeric, could indicate debt instrument
      const sixthChar = upperIsin.charAt(5);
      if (/[A-Z]/.test(sixthChar)) {
        return 'equity'; // Standard equity
      }
    }
    
    // G-Sec patterns
    if (lowerName.includes('treasury bill') || lowerName.includes('t-bill') || lowerName.includes('gov')) {
      return 'gsec';
    }
    
    // Fallback checks by name
    if (lowerName.includes('aif') || lowerName.includes('alternative investment')) return 'aif';
    if (lowerName.includes('pms')) return 'pms';
    if (lowerName.includes('reit')) return 'reit';
    if (lowerName.includes('invit')) return 'invit';
    if (lowerName.includes('sgb')) return 'sgb';

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
   * Fetch demat transaction history via Account Aggregator
   */
  async fetchTransactions(
    request: DematFetchRequest,
    fromDate?: string,
    toDate?: string
  ): Promise<DematTransactionResponse> {
    try {
      console.log(`📊 Fetching demat transactions via Account Aggregator`);

      // Default to last 3 years if no date range specified
      const endDate = toDate || new Date().toISOString().split('T')[0];
      const startDate = fromDate || new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (!this.hasValidCredentials()) {
        throw new Error('Demat data service not configured. Set AA_API_KEY for Account Aggregator demat transactions.');
      }

      // Production: Call Account Aggregator Transaction API
      const txResponse = await this.callAATransactionAPI(request, startDate, endDate);
      
      // Parse and normalize the response
      const transactions = this.parseTransactionResponse(txResponse);

      console.log(`✅ Fetched ${transactions.length} demat transactions`);

      return {
        success: true,
        totalTransactions: transactions.length,
        transactions,
        fromDate: startDate,
        toDate: endDate
      };

    } catch (error: any) {
      console.error('❌ Demat transaction fetch error:', error.message);
      
      return {
        success: false,
        totalTransactions: 0,
        transactions: [],
        fromDate: fromDate || '',
        toDate: toDate || '',
        message: `Transaction fetch failed: ${error.message}`
      };
    }
  }

  /**
   * Call Account Aggregator Transaction API
   */
  private async callAATransactionAPI(
    request: DematFetchRequest,
    fromDate: string,
    toDate: string
  ): Promise<any> {
    const endpoint = `${this.aaBaseUrl}/demat/transactions`;

    const payload = {
      pan: request.panNumber,
      name: request.name,
      dob: request.dob,
      mobile: request.mobile || '',
      email: request.email || '',
      consent_id: request.requestId || '',
      data_range: {
        from: fromDate,
        to: toDate
      }
    };

    try {
      const response = await axios.post(endpoint, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.aaApiKey,
          'X-Request-ID': request.requestId || `demat_tx_${Date.now()}`
        },
        timeout: 60000 // Longer timeout for transaction history
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ AA Transaction API error:', error.message);
      throw new Error(`AA Transaction API failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Parse AA transaction response
   */
  private parseTransactionResponse(aaResponse: any): DematTransaction[] {
    const transactions: DematTransaction[] = [];

    const txData = aaResponse.data?.transactions || [];
    
    for (const tx of txData) {
      const quantity = parseFloat(tx.quantity || 0);
      const price = parseFloat(tx.price || 0);
      const amount = parseFloat(tx.amount || quantity * price);
      
      transactions.push({
        transactionId: tx.transaction_id || tx.order_id || `TX${Date.now()}`,
        isin: tx.isin,
        symbol: tx.symbol || '',
        securityName: tx.security_name || 'Unknown Security',
        transactionDate: tx.transaction_date || tx.trade_date,
        transactionType: this.normalizeTransactionType(tx.transaction_type),
        quantity,
        price,
        amount,
        brokerage: parseFloat(tx.brokerage || 0),
        stt: parseFloat(tx.stt || 0),
        stampDuty: parseFloat(tx.stamp_duty || 0),
        gst: parseFloat(tx.gst || 0),
        otherCharges: parseFloat(tx.other_charges || 0),
        netAmount: parseFloat(tx.net_amount || amount),
        exchange: tx.exchange || 'NSE',
        orderNumber: tx.order_number,
        tradeNumber: tx.trade_number,
        settlementDate: tx.settlement_date,
        remarks: tx.remarks,
        depository: tx.depository || 'NSDL',
        dematAccountNumber: tx.demat_account || ''
      });
    }

    // Sort by date descending
    transactions.sort((a, b) => 
      new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    );

    return transactions;
  }

  /**
   * Normalize transaction type
   */
  private normalizeTransactionType(type: string): DematTransactionType {
    if (!type) return 'buy';
    
    const t = type.toUpperCase();
    
    if (t.includes('BUY') || t === 'B' || t === 'PURCHASE') return 'buy';
    if (t.includes('SELL') || t === 'S' || t === 'SALE') return 'sell';
    if (t.includes('BONUS')) return 'bonus';
    if (t.includes('SPLIT')) return 'split';
    if (t.includes('RIGHT')) return 'rights';
    if (t.includes('DIV') || t.includes('DIVIDEND')) return 'dividend';
    if (t.includes('INT') || t.includes('INTEREST')) return 'interest';
    if (t.includes('MATUR')) return 'maturity';
    if (t.includes('REDEEM') || t.includes('REDEMPTION')) return 'redemption';
    if (t.includes('CORP') || t.includes('CORPORATE')) return 'corporate_action';
    if (t.includes('IPO') || t.includes('ALLOT')) return 'ipo_allotment';
    if (t.includes('TRANSFER') && t.includes('IN')) return 'transfer_in';
    if (t.includes('TRANSFER') && t.includes('OUT')) return 'transfer_out';
    if (t.includes('PLEDGE') && !t.includes('UN')) return 'pledge';
    if (t.includes('UNPLEDGE') || t.includes('RELEASE')) return 'unpledge';
    
    return 'buy'; // Default
  }

  /**
   * Fetch both holdings and transactions with single authorization
   * Unified method that syncs everything together
   */
  async fetchDematWithTransactions(
    request: DematFetchRequest,
    fromDate?: string,
    toDate?: string
  ): Promise<UnifiedDematResponse> {
    console.log(`📊 Fetching unified Demat (Holdings + Transactions) for PAN: ${request.panNumber.slice(0, 4)}****`);

    // Fetch holdings and transactions in parallel for efficiency
    const [holdingsResult, transactionsResult] = await Promise.all([
      this.fetchHoldings(request),
      this.fetchTransactions(request, fromDate, toDate)
    ]);

    const success = holdingsResult.success || transactionsResult.success;
    
    console.log(`✅ Unified Demat fetch complete: ${holdingsResult.holdings.length} holdings, ${transactionsResult.transactions.length} transactions`);

    return {
      success,
      holdings: holdingsResult,
      transactions: transactionsResult,
      message: success 
        ? `Fetched ${holdingsResult.holdings.length} holdings and ${transactionsResult.transactions.length} transactions`
        : holdingsResult.message || transactionsResult.message
    };
  }
}

// Export singleton instance
export const dematHoldingsService = new DematHoldingsService();
