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

  private getComingSoonResponse(): CASFetchResponse {
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
      message: 'Coming Soon - BSE STAR MF integration will be available once API credentials are configured. Please contact support to enable this feature.'
    };
  }

  /**
   * Fetch Consolidated Account Statement for a PAN
   * This retrieves all mutual fund holdings across CAMS, Karvy, Franklin RTAs
   */
  async fetchCAS(request: CASFetchRequest): Promise<CASFetchResponse> {
    try {
      console.log(`📊 Fetching BSE STAR CAS`);

      if (!this.hasValidCredentials()) {
        console.log('⏳ BSE STAR MF API credentials not configured - Coming Soon');
        return this.getComingSoonResponse();
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
   * Get mock CAS data for development/testing
   */
  private getMockCASData(panNumber: string): CASFetchResponse {
    const mockHoldings: MutualFundHolding[] = [
      {
        folioNumber: `CAM123456/${panNumber.slice(-4)}`,
        schemeCode: 'HDFC123',
        schemeName: 'HDFC Flexi Cap Fund - Direct Plan - Growth',
        amcName: 'HDFC Asset Management Company Ltd',
        rtaCode: 'CAMS',
        registrarName: 'Computer Age Management Services Ltd (CAMS)',
        units: 1250.5034,
        nav: 845.30,
        currentValue: 1056797.65,
        investedAmount: 950000,
        returns: 106797.65,
        returnsPercentage: 11.24,
        averageNav: 759.62,
        purchaseDate: '2020-04-15',
        lastTransactionDate: '2024-12-10',
        schemePlan: 'growth',
        schemeOption: 'direct'
      },
      {
        folioNumber: `KAR789012/${panNumber.slice(-4)}`,
        schemeCode: 'AXIS456',
        schemeName: 'Axis Bluechip Fund - Direct Growth',
        amcName: 'Axis Asset Management Company Ltd',
        rtaCode: 'KARVY',
        registrarName: 'Kfin Technologies Limited (Karvy)',
        units: 2100.0000,
        nav: 425.80,
        currentValue: 894180.00,
        investedAmount: 800000,
        returns: 94180.00,
        returnsPercentage: 11.77,
        averageNav: 380.95,
        purchaseDate: '2021-01-20',
        lastTransactionDate: '2024-11-28',
        schemePlan: 'growth',
        schemeOption: 'direct'
      },
      {
        folioNumber: `CAM345678/${panNumber.slice(-4)}`,
        schemeCode: 'ICICI789',
        schemeName: 'ICICI Prudential Equity & Debt Fund - Growth',
        amcName: 'ICICI Prudential Asset Management Company Ltd',
        rtaCode: 'CAMS',
        registrarName: 'Computer Age Management Services Ltd (CAMS)',
        units: 850.2500,
        nav: 295.45,
        currentValue: 251198.39,
        investedAmount: 220000,
        returns: 31198.39,
        returnsPercentage: 14.18,
        averageNav: 258.80,
        purchaseDate: '2021-06-10',
        lastTransactionDate: '2024-10-15',
        schemePlan: 'growth',
        schemeOption: 'regular'
      },
      {
        folioNumber: `KAR456789/${panNumber.slice(-4)}`,
        schemeCode: 'SBI234',
        schemeName: 'SBI Small Cap Fund - Direct Plan - Growth',
        amcName: 'SBI Funds Management Limited',
        rtaCode: 'KARVY',
        registrarName: 'Kfin Technologies Limited (Karvy)',
        units: 425.7800,
        nav: 185.90,
        currentValue: 79169.22,
        investedAmount: 65000,
        returns: 14169.22,
        returnsPercentage: 21.80,
        averageNav: 152.67,
        purchaseDate: '2022-03-05',
        lastTransactionDate: '2024-12-01',
        schemePlan: 'growth',
        schemeOption: 'direct'
      }
    ];

    const totalValue = mockHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalInvestedAmount = mockHoldings.reduce((sum, h) => sum + h.investedAmount, 0);
    const totalReturns = totalValue - totalInvestedAmount;

    return {
      success: true,
      totalHoldings: mockHoldings.length,
      totalValue,
      totalInvestedAmount,
      totalReturns,
      totalReturnsPercentage: (totalReturns / totalInvestedAmount) * 100,
      holdings: mockHoldings,
      rtaSummary: {
        camsHoldings: 2,
        karvyHoldings: 2,
        franklinHoldings: 0
      },
      message: 'Mock data for development'
    };
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
}

// Export singleton instance
export const bseStarCASService = new BSEStarCASService();
