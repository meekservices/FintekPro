/**
 * BSE STAR MFD Consolidated Account Statement (CAS) Service
 * 
 * Fetches mutual fund holdings from BSE STAR MFD platform using CAS API
 * CAS provides consolidated holdings across all AMCs (CAMS, Karvy, Franklin)
 */

import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);

interface BSECASCredentials {
  userId: string;
  memberId: string;
  password: string;
  passKey: string;
}

export interface MutualFundHolding {
  folioNumber: string;
  schemeCode: string;
  schemeName: string;
  amcName: string;
  rtaCode: string; // RTA: CAMS, KARVY, FRANKLIN
  registrarName: string;
  units: number;
  nav: number;
  currentValue: number;
  investedAmount: number;
  returns: number;
  returnsPercentage: number;
  averageNav: number;
  purchaseDate?: string;
  lastTransactionDate?: string;
  schemePlan: string; // growth/dividend/bonus
  schemeOption: string; // regular/direct
  lockinStatus?: boolean;
  lockinDate?: string;
}

export interface MutualFundTransaction {
  transactionId: string;
  folioNumber: string;
  schemeCode: string;
  schemeName: string;
  amcName: string;
  registrarName: string;
  transactionDate: string;
  transactionType: 'purchase' | 'redemption' | 'switch_in' | 'switch_out' | 'dividend' | 'sip' | 'stp_in' | 'stp_out';
  units: number;
  nav: number;
  amount: number;
  stampDuty: number;
  stt: number;
  tds: number;
  netAmount: number;
  orderNumber?: string;
  description?: string;
}

export interface TransactionStatementResponse {
  success: boolean;
  totalTransactions: number;
  transactions: MutualFundTransaction[];
  fromDate: string;
  toDate: string;
  message?: string;
}

export interface UnifiedCASResponse {
  success: boolean;
  holdings: CASFetchResponse;
  transactions: TransactionStatementResponse;
  message?: string;
}

export interface CASFetchRequest {
  panNumber: string;
  name: string;
  dob: string;
  mobile?: string;
  email?: string;
}

export interface CASFetchResponse {
  success: boolean;
  totalHoldings: number;
  totalValue: number;
  totalInvestedAmount: number;
  totalReturns: number;
  totalReturnsPercentage: number;
  holdings: MutualFundHolding[];
  rtaSummary: {
    camsHoldings: number;
    karvyHoldings: number;
    franklinHoldings: number;
  };
  message?: string;
}

export class BSEStarCASService {
  private baseUrl: string;
  private credentials: BSECASCredentials;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.BSE_ENVIRONMENT === 'production';
    
    this.baseUrl = this.isProduction
      ? 'https://www.bsestarmf.in/StarMFWebService/'
      : 'https://bsestarmfdemo.bseindia.com/StarMFCommonAPI/';

    this.credentials = {
      userId: process.env.BSE_USER_ID || '',
      memberId: process.env.BSE_MEMBER_ID || '',
      password: process.env.BSE_PASSWORD || '',
      passKey: process.env.BSE_PASS_KEY || ''
    };
  }

  private hasValidCredentials(): boolean {
    return !!(this.credentials.userId && this.credentials.memberId && 
              this.credentials.password && this.credentials.passKey);
  }


  /**
   * Fetch Consolidated Account Statement for a PAN
   * This retrieves all mutual fund holdings across CAMS, Karvy, Franklin RTAs
   */
  async fetchCAS(request: CASFetchRequest): Promise<CASFetchResponse> {
    try {
      console.log(`📊 Fetching BSE STAR CAS`);

      if (!this.hasValidCredentials()) {
        throw new Error('BSE STAR CAS service not configured. Set BSE_USER_ID, BSE_MEMBER_ID, BSE_PASSWORD, and BSE_PASS_KEY for mutual fund data.');
      }

      // Production: Call BSE STAR CAS API
      const casResponse = await this.callBSECASAPI(request);
      
      // Parse and normalize the response
      const holdings = await this.parseCASResponse(casResponse);

      // Calculate totals
      const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
      const totalInvestedAmount = holdings.reduce((sum, h) => sum + h.investedAmount, 0);
      const totalReturns = totalValue - totalInvestedAmount;
      const totalReturnsPercentage = totalInvestedAmount > 0 
        ? (totalReturns / totalInvestedAmount) * 100 
        : 0;

      // Group by RTA
      const rtaSummary = {
        camsHoldings: holdings.filter(h => h.rtaCode === 'CAMS').length,
        karvyHoldings: holdings.filter(h => h.rtaCode === 'KARVY').length,
        franklinHoldings: holdings.filter(h => h.rtaCode === 'FRANKLIN').length
      };

      console.log(`✅ Fetched ${holdings.length} mutual fund holdings (Total Value: ₹${totalValue.toFixed(2)})`);

      return {
        success: true,
        totalHoldings: holdings.length,
        totalValue,
        totalInvestedAmount,
        totalReturns,
        totalReturnsPercentage,
        holdings,
        rtaSummary
      };

    } catch (error: any) {
      console.error('❌ BSE STAR CAS fetch error:', error.message);
      
      return {
        success: false,
        totalHoldings: 0,
        totalValue: 0,
        totalInvestedAmount: 0,
        totalReturns: 0,
        totalReturnsPercentage: 0,
        holdings: [],
        rtaSummary: {
          camsHoldings: 0,
          karvyHoldings: 0,
          franklinHoldings: 0
        },
        message: `CAS fetch failed: ${error.message}`
      };
    }
  }

  /**
   * Call BSE STAR CAS API (Production)
   * BSE STAR uses SOAP/XML for certain endpoints
   */
  private async callBSECASAPI(request: CASFetchRequest): Promise<any> {
    const endpoint = `${this.baseUrl}/GetCASSummary`;

    // Try JSON first (newer API version)
    try {
      const jsonPayload = {
        UserId: this.credentials.userId,
        MemberId: this.credentials.memberId,
        Password: this.credentials.password,
        PassKey: this.credentials.passKey,
        PAN: request.panNumber,
        Name: request.name,
        DOB: request.dob,
        Mobile: request.mobile || '',
        Email: request.email || ''
      };

      const response = await axios.post(endpoint, jsonPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });

      // Check if response is JSON
      if (typeof response.data === 'object' && response.data.Status === 'Success') {
        return response.data;
      }
      
      // If response is XML string, parse it
      if (typeof response.data === 'string' && response.data.includes('<?xml')) {
        const parsed = await this.parseXMLResponse(response.data);
        return parsed;
      }

      throw new Error(response.data?.Message || 'CAS fetch failed');
    } catch (error: any) {
      // If JSON fails, try XML/SOAP endpoint
      if (error.response?.status === 415 || error.message?.includes('Unsupported Media Type')) {
        return await this.callBSECASXMLAPI(request);
      }
      throw new Error(`BSE API error: ${error.message}`);
    }
  }

  /**
   * Call BSE STAR CAS API using XML/SOAP (legacy endpoint)
   */
  private async callBSECASXMLAPI(request: CASFetchRequest): Promise<any> {
    const endpoint = `${this.baseUrl}/GetCASSummary`;

    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetCASSummary xmlns="http://bsestarmf.in/">
      <UserId>${this.credentials.userId}</UserId>
      <MemberId>${this.credentials.memberId}</MemberId>
      <Password>${this.credentials.password}</Password>
      <PassKey>${this.credentials.passKey}</PassKey>
      <PAN>${request.panNumber}</PAN>
      <Name>${request.name}</Name>
      <DOB>${request.dob}</DOB>
      <Mobile>${request.mobile || ''}</Mobile>
      <Email>${request.email || ''}</Email>
    </GetCASSummary>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await axios.post(endpoint, xmlPayload, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://bsestarmf.in/GetCASSummary'
        },
        timeout: 30000
      });

      return await this.parseXMLResponse(response.data);
    } catch (error: any) {
      throw new Error(`BSE XML API error: ${error.message}`);
    }
  }

  /**
   * Parse XML response from BSE STAR API
   */
  private async parseXMLResponse(xmlData: string): Promise<any> {
    try {
      const parsed: any = await parseXML(xmlData, {
        explicitArray: false,
        ignoreAttrs: true,
        tagNameProcessors: [(name: string) => name.replace(/^.*:/, '')]
      });

      // Navigate SOAP envelope to get body content
      const body = parsed?.Envelope?.Body || parsed?.Body || parsed;
      const casResult = body?.GetCASSummaryResponse?.GetCASSummaryResult || body;

      if (!casResult) {
        throw new Error('Invalid XML response structure');
      }

      // Normalize XML to expected JSON format
      const status = casResult.Status || casResult.status || 'Unknown';
      if (status !== 'Success' && status !== '100') {
        throw new Error(casResult.Message || casResult.message || 'CAS fetch failed');
      }

      // Extract folios from XML structure
      const foliosData = casResult.Folios?.Folio || casResult.Data?.Folio || [];
      const folios = Array.isArray(foliosData) ? foliosData : [foliosData].filter(Boolean);

      return {
        Status: 'Success',
        Folios: folios.map((f: any) => ({
          FolioNumber: f.FolioNumber || f.folioNumber || f.Folio,
          SchemeCode: f.SchemeCode || f.schemeCode || f.ISIN,
          SchemeName: f.SchemeName || f.schemeName,
          AMCName: f.AMCName || f.amcName || f.FundHouse,
          RegistrarName: f.RegistrarName || f.registrarName,
          Units: f.Units || f.units || '0',
          NAV: f.NAV || f.nav || f.CurrentNAV || '0',
          MarketValue: f.MarketValue || f.marketValue || f.CurrentValue || '0',
          InvestedAmount: f.InvestedAmount || f.investedAmount || f.InvestedValue || '0',
          AverageNAV: f.AverageNAV || f.averageNAV || f.AvgCost || '0',
          PurchaseDate: f.PurchaseDate || f.purchaseDate,
          LastTransactionDate: f.LastTransactionDate || f.lastTransactionDate,
          SchemePlan: f.SchemePlan || f.schemePlan || 'growth',
          SchemeOption: f.SchemeOption || f.schemeOption || 'regular',
          LockinStatus: f.LockinStatus || f.lockinStatus,
          LockinDate: f.LockinDate || f.lockinDate
        }))
      };
    } catch (error: any) {
      console.error('XML parsing error:', error.message);
      throw new Error(`Failed to parse XML response: ${error.message}`);
    }
  }

  /**
   * Parse BSE CAS response and normalize to standard format
   */
  private async parseCASResponse(apiResponse: any): Promise<MutualFundHolding[]> {
    const holdings: MutualFundHolding[] = [];

    try {
      // BSE STAR returns CAS data in XML or JSON format
      // Parse each folio and extract holdings
      const folios = apiResponse.Folios || apiResponse.Data || [];

      for (const folio of folios) {
        const holding: MutualFundHolding = {
          folioNumber: folio.FolioNumber,
          schemeCode: folio.SchemeCode || folio.ISIN,
          schemeName: folio.SchemeName,
          amcName: folio.AMCName || folio.FundHouse,
          rtaCode: this.identifyRTA(folio.RegistrarName || folio.AMCName),
          registrarName: folio.RegistrarName,
          units: parseFloat(folio.Units || 0),
          nav: parseFloat(folio.NAV || folio.CurrentNAV || 0),
          currentValue: parseFloat(folio.MarketValue || folio.CurrentValue || 0),
          investedAmount: parseFloat(folio.InvestedAmount || folio.InvestedValue || 0),
          returns: 0, // Calculated below
          returnsPercentage: 0, // Calculated below
          averageNav: parseFloat(folio.AverageNAV || folio.AvgCost || 0),
          purchaseDate: folio.PurchaseDate,
          lastTransactionDate: folio.LastTransactionDate,
          schemePlan: folio.SchemePlan || 'growth',
          schemeOption: folio.SchemeOption || 'regular',
          lockinStatus: folio.LockinStatus === 'Y' || folio.Locked === true,
          lockinDate: folio.LockinDate
        };

        // Calculate returns
        holding.returns = holding.currentValue - holding.investedAmount;
        holding.returnsPercentage = holding.investedAmount > 0
          ? (holding.returns / holding.investedAmount) * 100
          : 0;

        holdings.push(holding);
      }

      return holdings;
    } catch (error: any) {
      console.error('CAS parsing error:', error.message);
      throw new Error(`Failed to parse CAS response: ${error.message}`);
    }
  }

  /**
   * Identify RTA (Registrar and Transfer Agent) from AMC/Registrar name
   */
  private identifyRTA(registrarName: string): string {
    if (!registrarName) return 'UNKNOWN';

    const name = registrarName.toUpperCase();
    
    if (name.includes('CAMS') || name.includes('COMPUTER AGE')) {
      return 'CAMS';
    } else if (name.includes('KARVY') || name.includes('KFINTECH')) {
      return 'KARVY';
    } else if (name.includes('FRANKLIN')) {
      return 'FRANKLIN';
    } else {
      return 'OTHER';
    }
  }


  /**
   * Fetch holdings for a specific AMC/fund house
   */
  async fetchHoldingsByAMC(panNumber: string, amcCode: string): Promise<MutualFundHolding[]> {
    const casResponse = await this.fetchCAS({ panNumber, name: '', dob: '' });
    
    if (!casResponse.success) {
      return [];
    }

    return casResponse.holdings.filter(h => 
      h.amcName.toUpperCase().includes(amcCode.toUpperCase())
    );
  }

  /**
   * Fetch holdings for a specific RTA
   */
  async fetchHoldingsByRTA(panNumber: string, rtaCode: 'CAMS' | 'KARVY' | 'FRANKLIN'): Promise<MutualFundHolding[]> {
    const casResponse = await this.fetchCAS({ panNumber, name: '', dob: '' });
    
    if (!casResponse.success) {
      return [];
    }

    return casResponse.holdings.filter(h => h.rtaCode === rtaCode);
  }

  /**
   * Health check for BSE STAR CAS API
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.hasValidCredentials()) {
        return false; // Not configured
      }

      const response = await axios.get(`${this.baseUrl}/HealthCheck`, {
        timeout: 5000
      });
      
      return response.status === 200;
    } catch (error) {
      console.error('BSE STAR CAS health check failed:', error);
      return false;
    }
  }

  /**
   * Check if service is configured and ready
   */
  isConfigured(): boolean {
    return this.hasValidCredentials();
  }

  /**
   * Fetch Transaction Statement for a PAN
   * Returns all MF transactions within the specified date range
   */
  async fetchTransactionStatement(
    request: CASFetchRequest,
    fromDate?: string,
    toDate?: string
  ): Promise<TransactionStatementResponse> {
    try {
      console.log(`📊 Fetching BSE STAR Transaction Statement`);

      // Default to last 3 years if no date range specified
      const endDate = toDate || new Date().toISOString().split('T')[0];
      const startDate = fromDate || new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      if (!this.hasValidCredentials()) {
        throw new Error('BSE STAR CAS service not configured. Set BSE_USER_ID, BSE_MEMBER_ID, BSE_PASSWORD, and BSE_PASS_KEY for mutual fund transactions.');
      }

      // Production: Call BSE STAR Transaction Statement API
      const transactionResponse = await this.callBSETransactionAPI(request, startDate, endDate);
      
      // Parse and normalize the response
      const transactions = await this.parseTransactionResponse(transactionResponse);

      console.log(`✅ Fetched ${transactions.length} transactions`);

      return {
        success: true,
        totalTransactions: transactions.length,
        transactions,
        fromDate: startDate,
        toDate: endDate
      };

    } catch (error: any) {
      console.error('❌ BSE STAR Transaction fetch error:', error.message);
      
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
   * Call BSE STAR Transaction Statement API
   */
  private async callBSETransactionAPI(
    request: CASFetchRequest,
    fromDate: string,
    toDate: string
  ): Promise<any> {
    const endpoint = `${this.baseUrl}/GetTransactionStatement`;

    try {
      const jsonPayload = {
        UserId: this.credentials.userId,
        MemberId: this.credentials.memberId,
        Password: this.credentials.password,
        PassKey: this.credentials.passKey,
        PAN: request.panNumber,
        Name: request.name,
        DOB: request.dob,
        FromDate: fromDate,
        ToDate: toDate,
        Mobile: request.mobile || '',
        Email: request.email || ''
      };

      const response = await axios.post(endpoint, jsonPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 60000 // Longer timeout for transaction history
      });

      if (typeof response.data === 'object' && response.data.Status === 'Success') {
        return response.data;
      }
      
      if (typeof response.data === 'string' && response.data.includes('<?xml')) {
        const parsed = await this.parseTransactionXMLResponse(response.data);
        return parsed;
      }

      throw new Error(response.data?.Message || 'Transaction fetch failed');
    } catch (error: any) {
      if (error.response?.status === 415 || error.message?.includes('Unsupported Media Type')) {
        return await this.callBSETransactionXMLAPI(request, fromDate, toDate);
      }
      throw new Error(`BSE Transaction API error: ${error.message}`);
    }
  }

  /**
   * Call BSE STAR Transaction API using XML/SOAP
   */
  private async callBSETransactionXMLAPI(
    request: CASFetchRequest,
    fromDate: string,
    toDate: string
  ): Promise<any> {
    const endpoint = `${this.baseUrl}/GetTransactionStatement`;

    const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTransactionStatement xmlns="http://bsestarmf.in/">
      <UserId>${this.credentials.userId}</UserId>
      <MemberId>${this.credentials.memberId}</MemberId>
      <Password>${this.credentials.password}</Password>
      <PassKey>${this.credentials.passKey}</PassKey>
      <PAN>${request.panNumber}</PAN>
      <Name>${request.name}</Name>
      <DOB>${request.dob}</DOB>
      <FromDate>${fromDate}</FromDate>
      <ToDate>${toDate}</ToDate>
      <Mobile>${request.mobile || ''}</Mobile>
      <Email>${request.email || ''}</Email>
    </GetTransactionStatement>
  </soap:Body>
</soap:Envelope>`;

    try {
      const response = await axios.post(endpoint, xmlPayload, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'http://bsestarmf.in/GetTransactionStatement'
        },
        timeout: 60000
      });

      return await this.parseTransactionXMLResponse(response.data);
    } catch (error: any) {
      throw new Error(`BSE Transaction XML API error: ${error.message}`);
    }
  }

  /**
   * Parse XML response for transactions
   */
  private async parseTransactionXMLResponse(xmlData: string): Promise<any> {
    try {
      const parsed: any = await parseXML(xmlData, {
        explicitArray: false,
        ignoreAttrs: true,
        tagNameProcessors: [(name: string) => name.replace(/^.*:/, '')]
      });

      const body = parsed?.Envelope?.Body || parsed?.Body || parsed;
      const txResult = body?.GetTransactionStatementResponse?.GetTransactionStatementResult || body;

      if (!txResult) {
        throw new Error('Invalid XML response structure');
      }

      const status = txResult.Status || txResult.status || 'Unknown';
      if (status !== 'Success' && status !== '100') {
        throw new Error(txResult.Message || txResult.message || 'Transaction fetch failed');
      }

      const txData = txResult.Transactions?.Transaction || txResult.Data?.Transaction || [];
      const transactions = Array.isArray(txData) ? txData : [txData].filter(Boolean);

      return {
        Status: 'Success',
        Transactions: transactions.map((t: any) => ({
          TransactionId: t.TransactionId || t.transactionId || t.OrderNo,
          FolioNumber: t.FolioNumber || t.folioNumber || t.Folio,
          SchemeCode: t.SchemeCode || t.schemeCode || t.ISIN,
          SchemeName: t.SchemeName || t.schemeName,
          AMCName: t.AMCName || t.amcName || t.FundHouse,
          RegistrarName: t.RegistrarName || t.registrarName,
          TransactionDate: t.TransactionDate || t.transactionDate || t.TrxnDate,
          TransactionType: t.TransactionType || t.transactionType || t.TrxnType,
          Units: t.Units || t.units || '0',
          NAV: t.NAV || t.nav || '0',
          Amount: t.Amount || t.amount || t.GrossAmount || '0',
          StampDuty: t.StampDuty || t.stampDuty || '0',
          STT: t.STT || t.stt || '0',
          TDS: t.TDS || t.tds || '0',
          NetAmount: t.NetAmount || t.netAmount || t.Amount || '0',
          OrderNumber: t.OrderNumber || t.orderNumber || t.OrderNo,
          Description: t.Description || t.description || t.Remarks
        }))
      };
    } catch (error: any) {
      console.error('Transaction XML parsing error:', error.message);
      throw new Error(`Failed to parse transaction XML: ${error.message}`);
    }
  }

  /**
   * Parse transaction response and normalize
   */
  private async parseTransactionResponse(apiResponse: any): Promise<MutualFundTransaction[]> {
    const transactions: MutualFundTransaction[] = [];

    try {
      const txData = apiResponse.Transactions || apiResponse.Data || [];

      for (const tx of txData) {
        const transaction: MutualFundTransaction = {
          transactionId: tx.TransactionId || tx.OrderNo || `TX${Date.now()}`,
          folioNumber: tx.FolioNumber,
          schemeCode: tx.SchemeCode || tx.ISIN,
          schemeName: tx.SchemeName,
          amcName: tx.AMCName || tx.FundHouse,
          registrarName: tx.RegistrarName,
          transactionDate: tx.TransactionDate,
          transactionType: this.normalizeTransactionType(tx.TransactionType),
          units: parseFloat(tx.Units || 0),
          nav: parseFloat(tx.NAV || 0),
          amount: parseFloat(tx.Amount || tx.GrossAmount || 0),
          stampDuty: parseFloat(tx.StampDuty || 0),
          stt: parseFloat(tx.STT || 0),
          tds: parseFloat(tx.TDS || 0),
          netAmount: parseFloat(tx.NetAmount || tx.Amount || 0),
          orderNumber: tx.OrderNumber || tx.OrderNo,
          description: tx.Description || tx.Remarks
        };

        transactions.push(transaction);
      }

      // Sort by date descending (most recent first)
      transactions.sort((a, b) => 
        new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
      );

      return transactions;
    } catch (error: any) {
      console.error('Transaction parsing error:', error.message);
      throw new Error(`Failed to parse transaction response: ${error.message}`);
    }
  }

  /**
   * Normalize transaction type to standard enum values
   */
  private normalizeTransactionType(type: string): MutualFundTransaction['transactionType'] {
    if (!type) return 'purchase';
    
    const t = type.toUpperCase();
    
    if (t.includes('PURCHASE') || t === 'P' || t === 'BUY') return 'purchase';
    if (t.includes('REDEEM') || t.includes('REDEMP') || t === 'R' || t === 'SELL') return 'redemption';
    if (t.includes('SWITCH') && (t.includes('IN') || t.includes('TO'))) return 'switch_in';
    if (t.includes('SWITCH') && (t.includes('OUT') || t.includes('FROM'))) return 'switch_out';
    if (t.includes('DIV') || t.includes('IDCW')) return 'dividend';
    if (t.includes('SIP')) return 'sip';
    if (t.includes('STP') && t.includes('IN')) return 'stp_in';
    if (t.includes('STP') && t.includes('OUT')) return 'stp_out';
    
    return 'purchase'; // Default
  }

  /**
   * Fetch both holdings and transactions with single authorization
   * This is the unified method that syncs everything together
   */
  async fetchCASWithTransactions(
    request: CASFetchRequest,
    fromDate?: string,
    toDate?: string
  ): Promise<UnifiedCASResponse> {
    console.log(`📊 Fetching unified CAS (Holdings + Transactions) for PAN: ${request.panNumber.slice(0, 4)}****`);

    // Fetch holdings and transactions in parallel for efficiency
    const [holdingsResult, transactionsResult] = await Promise.all([
      this.fetchCAS(request),
      this.fetchTransactionStatement(request, fromDate, toDate)
    ]);

    const success = holdingsResult.success || transactionsResult.success;
    
    console.log(`✅ Unified CAS fetch complete: ${holdingsResult.holdings.length} holdings, ${transactionsResult.transactions.length} transactions`);

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
export const bseStarCASService = new BSEStarCASService();
