import axios, { AxiosResponse } from 'axios';
import { parseString } from 'xml2js';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { promisify } from 'util';

const parseXML = promisify(parseString);

// KFintech API Configuration
const KFINTECH_CONFIG = {
  baseUrl: process.env.KFINTECH_API_URL || 'https://api.kfintech.com',
  username: process.env.KFINTECH_USERNAME || '',
  password: process.env.KFINTECH_PASSWORD || '',
  memberId: process.env.KFINTECH_MEMBER_ID || '',
  timeout: 30000,
};

// XML Parser configuration
const xmlParserOptions = {
  ignoreAttributes: false,
  parseAttributeValue: true,
  parseTrueNumberOnly: false,
  trimValues: true,
};

const xmlParser = new XMLParser(xmlParserOptions);
const xmlBuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
  suppressEmptyNode: true,
});

// KFintech API Response interfaces
interface KFintechResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
}

interface InvestorPortfolio {
  investorId: string;
  investorName: string;
  pan: string;
  folios: Array<{
    folioNumber: string;
    schemeCode: string;
    schemeName: string;
    units: number;
    nav: number;
    currentValue: number;
    investmentValue: number;
    gainLoss: number;
    gainLossPercentage: number;
  }>;
}

interface TransactionHistory {
  transactions: Array<{
    transactionId: string;
    folioNumber: string;
    schemeCode: string;
    schemeName: string;
    transactionType: 'PURCHASE' | 'REDEMPTION' | 'SWITCH_IN' | 'SWITCH_OUT' | 'STP' | 'SWP';
    amount: number;
    units: number;
    nav: number;
    transactionDate: string;
    settlementDate: string;
    status: 'SUCCESS' | 'PENDING' | 'FAILED';
  }>;
}

interface SIPDetails {
  sips: Array<{
    sipId: string;
    folioNumber: string;
    schemeCode: string;
    schemeName: string;
    amount: number;
    frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    startDate: string;
    endDate?: string;
    nextInstallmentDate: string;
    status: 'ACTIVE' | 'PAUSED' | 'STOPPED';
    totalInstallments: number;
    executedInstallments: number;
  }>;
}

interface PurchaseRequest {
  pan: string;
  schemeCode: string;
  amount: number;
  folioNumber?: string;
  investorName: string;
  bankAccount: string;
  ifscCode: string;
  nomineeDetails?: {
    name: string;
    relationship: string;
    percentage: number;
  };
}

interface SIPRequest {
  pan: string;
  schemeCode: string;
  amount: number;
  frequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  startDate: string;
  endDate?: string;
  installments?: number;
  bankAccount: string;
  ifscCode: string;
}

class KFintechAPI {
  private async makeRequest<T>(
    endpoint: string,
    xmlData: string,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<KFintechResponse<T>> {
    try {
      const config = {
        method,
        url: `${KFINTECH_CONFIG.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/xml',
          'User-Agent': 'FintekPro-KFintech-Client/1.0',
          'X-Member-ID': KFINTECH_CONFIG.memberId,
        },
        timeout: KFINTECH_CONFIG.timeout,
        auth: {
          username: KFINTECH_CONFIG.username,
          password: KFINTECH_CONFIG.password,
        },
        ...(method === 'POST' && { data: xmlData }),
      };

      const response: AxiosResponse = await axios(config);
      
      // Parse XML response
      const parsedResponse = xmlParser.parse(response.data);
      
      // Check for API errors
      if (parsedResponse.Response?.Status === 'FAILED') {
        return {
          success: false,
          message: parsedResponse.Response?.Message || 'KFintech API error',
          errorCode: parsedResponse.Response?.ErrorCode,
        };
      }

      return {
        success: true,
        data: parsedResponse as T,
      };
    } catch (error: any) {
      console.error('KFintech API Error:', error);
      return {
        success: false,
        message: error.message || 'Failed to connect to KFintech API',
        errorCode: 'CONNECTION_ERROR',
      };
    }
  }

  private buildXMLRequest(action: string, data: Record<string, any>): string {
    const requestData = {
      Request: {
        '@_xmlns': 'http://kfintech.com/api/v1',
        Header: {
          MemberId: KFINTECH_CONFIG.memberId,
          RequestId: `REQ_${Date.now()}`,
          Timestamp: new Date().toISOString(),
          Action: action,
        },
        Body: data,
      },
    };

    return xmlBuilder.build(requestData);
  }

  // Validate investor by PAN
  async validateInvestor(pan: string): Promise<KFintechResponse<{ isValid: boolean; investorName?: string; details?: any }>> {
    const xmlRequest = this.buildXMLRequest('VALIDATE_INVESTOR', {
      PAN: pan,
    });

    const response = await this.makeRequest<any>('/api/investor/validate', xmlRequest);
    
    if (response.success && response.data?.Response?.Status === 'SUCCESS') {
      return {
        success: true,
        data: {
          isValid: true,
          investorName: response.data.Response.InvestorName,
          details: response.data.Response.InvestorDetails,
        },
      };
    }

    return {
      success: false,
      message: 'Invalid PAN or investor not found',
    };
  }

  // Get investor portfolio
  async getInvestorPortfolio(pan: string): Promise<KFintechResponse<InvestorPortfolio>> {
    const xmlRequest = this.buildXMLRequest('GET_PORTFOLIO', {
      PAN: pan,
      AsOfDate: new Date().toISOString().split('T')[0],
    });

    const response = await this.makeRequest<any>('/api/portfolio/details', xmlRequest);
    
    if (response.success && response.data?.Response?.Portfolio) {
      const portfolioData = response.data.Response.Portfolio;
      
      const portfolio: InvestorPortfolio = {
        investorId: portfolioData.InvestorId,
        investorName: portfolioData.InvestorName,
        pan: portfolioData.PAN,
        folios: Array.isArray(portfolioData.Folios?.Folio) 
          ? portfolioData.Folios.Folio.map((folio: any) => ({
              folioNumber: folio.FolioNumber,
              schemeCode: folio.SchemeCode,
              schemeName: folio.SchemeName,
              units: parseFloat(folio.Units || '0'),
              nav: parseFloat(folio.NAV || '0'),
              currentValue: parseFloat(folio.CurrentValue || '0'),
              investmentValue: parseFloat(folio.InvestmentValue || '0'),
              gainLoss: parseFloat(folio.GainLoss || '0'),
              gainLossPercentage: parseFloat(folio.GainLossPercentage || '0'),
            }))
          : [],
      };

      return { success: true, data: portfolio };
    }

    return {
      success: false,
      message: response.message || 'Failed to fetch portfolio',
    };
  }

  // Get transaction history
  async getTransactionHistory(
    pan: string,
    fromDate: string,
    toDate: string,
    folioNumber?: string
  ): Promise<KFintechResponse<TransactionHistory>> {
    const xmlRequest = this.buildXMLRequest('GET_TRANSACTIONS', {
      PAN: pan,
      FromDate: fromDate,
      ToDate: toDate,
      ...(folioNumber && { FolioNumber: folioNumber }),
    });

    const response = await this.makeRequest<any>('/api/transactions/history', xmlRequest);
    
    if (response.success && response.data?.Response?.Transactions) {
      const transactionsData = response.data.Response.Transactions;
      
      const history: TransactionHistory = {
        transactions: Array.isArray(transactionsData.Transaction)
          ? transactionsData.Transaction.map((txn: any) => ({
              transactionId: txn.TransactionId,
              folioNumber: txn.FolioNumber,
              schemeCode: txn.SchemeCode,
              schemeName: txn.SchemeName,
              transactionType: txn.TransactionType,
              amount: parseFloat(txn.Amount || '0'),
              units: parseFloat(txn.Units || '0'),
              nav: parseFloat(txn.NAV || '0'),
              transactionDate: txn.TransactionDate,
              settlementDate: txn.SettlementDate,
              status: txn.Status,
            }))
          : [],
      };

      return { success: true, data: history };
    }

    return {
      success: false,
      message: response.message || 'Failed to fetch transaction history',
    };
  }

  // Get SIP details
  async getSIPDetails(pan: string, folioNumber?: string): Promise<KFintechResponse<SIPDetails>> {
    const xmlRequest = this.buildXMLRequest('GET_SIP_DETAILS', {
      PAN: pan,
      ...(folioNumber && { FolioNumber: folioNumber }),
    });

    const response = await this.makeRequest<any>('/api/sip/details', xmlRequest);
    
    if (response.success && response.data?.Response?.SIPs) {
      const sipData = response.data.Response.SIPs;
      
      const sipDetails: SIPDetails = {
        sips: Array.isArray(sipData.SIP)
          ? sipData.SIP.map((sip: any) => ({
              sipId: sip.SIPId,
              folioNumber: sip.FolioNumber,
              schemeCode: sip.SchemeCode,
              schemeName: sip.SchemeName,
              amount: parseFloat(sip.Amount || '0'),
              frequency: sip.Frequency,
              startDate: sip.StartDate,
              endDate: sip.EndDate,
              nextInstallmentDate: sip.NextInstallmentDate,
              status: sip.Status,
              totalInstallments: parseInt(sip.TotalInstallments || '0'),
              executedInstallments: parseInt(sip.ExecutedInstallments || '0'),
            }))
          : [],
      };

      return { success: true, data: sipDetails };
    }

    return {
      success: false,
      message: response.message || 'Failed to fetch SIP details',
    };
  }

  // Create purchase transaction
  async createPurchaseTransaction(request: PurchaseRequest): Promise<KFintechResponse<{ transactionId: string; status: string }>> {
    const xmlRequest = this.buildXMLRequest('CREATE_PURCHASE', {
      InvestorDetails: {
        PAN: request.pan,
        InvestorName: request.investorName,
      },
      TransactionDetails: {
        SchemeCode: request.schemeCode,
        Amount: request.amount.toString(),
        FolioNumber: request.folioNumber || 'NEW',
      },
      BankDetails: {
        AccountNumber: request.bankAccount,
        IFSCCode: request.ifscCode,
      },
      ...(request.nomineeDetails && {
        NomineeDetails: request.nomineeDetails,
      }),
    });

    const response = await this.makeRequest<any>('/api/transactions/purchase', xmlRequest);
    
    if (response.success && response.data?.Response?.Transaction) {
      const transaction = response.data.Response.Transaction;
      
      return {
        success: true,
        data: {
          transactionId: transaction.TransactionId,
          status: transaction.Status,
        },
      };
    }

    return {
      success: false,
      message: response.message || 'Failed to create purchase transaction',
    };
  }

  // Setup SIP
  async setupSIP(request: SIPRequest): Promise<KFintechResponse<{ sipId: string; status: string }>> {
    const xmlRequest = this.buildXMLRequest('SETUP_SIP', {
      InvestorDetails: {
        PAN: request.pan,
      },
      SIPDetails: {
        SchemeCode: request.schemeCode,
        Amount: request.amount.toString(),
        Frequency: request.frequency,
        StartDate: request.startDate,
        ...(request.endDate && { EndDate: request.endDate }),
        ...(request.installments && { TotalInstallments: request.installments.toString() }),
      },
      BankDetails: {
        AccountNumber: request.bankAccount,
        IFSCCode: request.ifscCode,
      },
    });

    const response = await this.makeRequest<any>('/api/sip/setup', xmlRequest);
    
    if (response.success && response.data?.Response?.SIP) {
      const sip = response.data.Response.SIP;
      
      return {
        success: true,
        data: {
          sipId: sip.SIPId,
          status: sip.Status,
        },
      };
    }

    return {
      success: false,
      message: response.message || 'Failed to setup SIP',
    };
  }

  // Get scheme details
  async getSchemeDetails(schemeCode: string): Promise<KFintechResponse<any>> {
    const xmlRequest = this.buildXMLRequest('GET_SCHEME_DETAILS', {
      SchemeCode: schemeCode,
    });

    const response = await this.makeRequest<any>('/api/schemes/details', xmlRequest);
    
    if (response.success && response.data?.Response?.Scheme) {
      return {
        success: true,
        data: response.data.Response.Scheme,
      };
    }

    return {
      success: false,
      message: response.message || 'Failed to fetch scheme details',
    };
  }

  // Cancel SIP
  async cancelSIP(pan: string, sipId: string): Promise<KFintechResponse<{ status: string }>> {
    const xmlRequest = this.buildXMLRequest('CANCEL_SIP', {
      PAN: pan,
      SIPId: sipId,
    });

    const response = await this.makeRequest<any>('/api/sip/cancel', xmlRequest);
    
    if (response.success && response.data?.Response?.Status === 'SUCCESS') {
      return {
        success: true,
        data: {
          status: 'CANCELLED',
        },
      };
    }

    return {
      success: false,
      message: response.message || 'Failed to cancel SIP',
    };
  }
}

// Export singleton instance
export const kfintechApi = new KFintechAPI();

// Export types for use in routes
export type {
  KFintechResponse,
  InvestorPortfolio,
  TransactionHistory,
  SIPDetails,
  PurchaseRequest,
  SIPRequest,
};