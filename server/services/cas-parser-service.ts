/**
 * CAS (Consolidated Account Statement) Parser Service
 * 
 * Converts CAS PDF documents to structured JSON data
 * Extracts holdings, transactions, investor details from CAMS/KFin CAS PDFs
 * 
 * Parser Capabilities:
 * - Investor profile (PAN, name, address, email, mobile)
 * - Folio-wise mutual fund holdings
 * - Transaction history
 * - Scheme details (AMC, ISIN, advisor info)
 * - Valuation summary
 */

import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { createLogger } from './logger';

const logger = createLogger({ service: 'cas-parser' });

export type CASProvider = 'CAMS' | 'KFin';

export interface InvestorProfile {
  pan: string;
  name: string;
  email?: string;
  mobile?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
}

export interface SchemeDetails {
  amcName: string;
  schemeName: string;
  isin: string;
  schemeType: string; // Equity/Debt/Hybrid/Other
  schemePlan: string; // Growth/Dividend/Bonus
  schemeOption: string; // Regular/Direct
  advisor?: string;
  arn?: string; // AMFI Registration Number
  euin?: string; // Employee Unique Identification Number
}

export interface FolioHolding {
  folioNumber: string;
  panNumber: string;
  kycStatus: 'Compliant' | 'Non-Compliant';
  scheme: SchemeDetails;
  registrar: string; // CAMS/KFin/Franklin
  units: number;
  nav: number;
  valueAtNav: number;
  costValue?: number;
  dateOfFirstInvestment?: string;
  dateOfLastInvestment?: string;
}

export interface Transaction {
  transactionDate: string;
  description: string;
  transactionType: 'Purchase' | 'Redemption' | 'Switch In' | 'Switch Out' | 'Dividend' | 'SIP' | 'STP' | 'SWP' | 'Other';
  amount: number;
  units: number;
  nav: number;
  balanceUnits: number;
}

export interface FolioTransactions {
  folioNumber: string;
  scheme: SchemeDetails;
  transactions: Transaction[];
}

export interface ParsedCASData {
  provider: CASProvider;
  investor: InvestorProfile;
  statementPeriod: {
    from: string;
    to: string;
  };
  folios: FolioHolding[];
  transactions: FolioTransactions[];
  summary: {
    totalFolios: number;
    totalInvestedValue: number;
    totalCurrentValue: number;
    totalGainLoss: number;
    totalGainLossPercentage: number;
  };
  parseMetadata: {
    parsedAt: Date;
    parserVersion: string;
    pdfPages: number;
    warnings?: string[];
  };
}

export interface CASParseRequest {
  pdfUrl?: string;        // URL to download PDF from
  pdfBuffer?: Buffer;     // Raw PDF buffer
  pdfPassword?: string;   // PDF password (usually PAN last 4 digits)
  provider?: CASProvider; // CAMS or KFin
}

export interface CASParseResponse {
  success: boolean;
  data?: ParsedCASData;
  error?: string;
  warnings?: string[];
}

/**
 * CAS Parser API Client
 * Integrates with third-party CAS parsing service or custom parser
 */
export class CASParserService {
  private client: AxiosInstance;
  private parserEndpoint: string;
  private apiKey: string;
  private useExternalParser: boolean;

  constructor() {
    this.useExternalParser = process.env.CAS_PARSER_EXTERNAL === 'true';
    this.apiKey = process.env.CAS_PARSER_API_KEY || 'demo_parser_key';
    
    // External parser service (e.g., CASparser.io, CASViewer API)
    this.parserEndpoint = process.env.CAS_PARSER_URL || 'https://api.casparser.io/v1';

    this.client = axios.create({
      baseURL: this.parserEndpoint,
      timeout: 60000, // PDF parsing can take time
      headers: {
        'X-API-Key': this.apiKey
      }
    });
  }

  /**
   * Parse CAS PDF to JSON
   */
  async parseCAS(request: CASParseRequest): Promise<CASParseResponse> {
    try {
      logger.info('Parsing CAS PDF', { 
        hasUrl: !!request.pdfUrl,
        hasBuffer: !!request.pdfBuffer,
        provider: request.provider 
      });

      let pdfBuffer: Buffer;

      // Download PDF if URL provided
      if (request.pdfUrl) {
        pdfBuffer = await this.downloadPDF(request.pdfUrl);
      } else if (request.pdfBuffer) {
        pdfBuffer = request.pdfBuffer;
      } else {
        throw new Error('Either pdfUrl or pdfBuffer must be provided');
      }

      // Use external parser if enabled, otherwise use internal mock parser
      if (this.useExternalParser) {
        return await this.parseWithExternalService(pdfBuffer, request.pdfPassword);
      } else {
        return await this.parseWithMockParser(request.provider || 'CAMS');
      }

    } catch (error: any) {
      logger.error('CAS parsing failed', error);
      
      return {
        success: false,
        error: `Parsing failed: ${error.message}`
      };
    }
  }

  /**
   * Download PDF from URL
   */
  private async downloadPDF(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      throw new Error(`PDF download failed: ${error.message}`);
    }
  }

  /**
   * Parse PDF using external API service
   */
  private async parseWithExternalService(
    pdfBuffer: Buffer,
    password?: string
  ): Promise<CASParseResponse> {
    try {
      const formData = new FormData();
      formData.append('file', pdfBuffer, 'statement.pdf');
      
      if (password) {
        formData.append('password', password);
      }

      const response = await this.client.post('/parse', formData, {
        headers: formData.getHeaders()
      });

      const parsedData = this.normalizeExternalParserResponse(response.data);

      logger.info('CAS parsed successfully', { 
        folios: parsedData.folios.length,
        transactions: parsedData.transactions.length 
      });

      return {
        success: true,
        data: parsedData
      };

    } catch (error: any) {
      throw new Error(`External parser error: ${error.message}`);
    }
  }

  /**
   * Normalize external parser response to our standard format
   */
  private normalizeExternalParserResponse(externalData: any): ParsedCASData {
    // Transform external parser format to our standard ParsedCASData format
    // This will vary based on the external parser being used
    
    const folios: FolioHolding[] = (externalData.folios || []).map((f: any) => ({
      folioNumber: f.folio,
      panNumber: f.PAN || externalData.investor?.pan,
      kycStatus: f.KYC === 'OK' ? 'Compliant' : 'Non-Compliant',
      scheme: {
        amcName: f.amc,
        schemeName: f.scheme,
        isin: f.isin,
        schemeType: f.type || 'Equity',
        schemePlan: f.plan || 'Growth',
        schemeOption: f.option || 'Direct',
        advisor: f.advisor,
        arn: f.arn,
        euin: f.euin
      },
      registrar: f.registrar || 'CAMS',
      units: parseFloat(f.units || 0),
      nav: parseFloat(f.nav || 0),
      valueAtNav: parseFloat(f.value || 0),
      costValue: f.cost ? parseFloat(f.cost) : undefined,
      dateOfFirstInvestment: f.open_date,
      dateOfLastInvestment: f.close_date
    }));

    const transactions: FolioTransactions[] = (externalData.folios || []).map((f: any) => ({
      folioNumber: f.folio,
      scheme: {
        amcName: f.amc,
        schemeName: f.scheme,
        isin: f.isin,
        schemeType: f.type || 'Equity',
        schemePlan: f.plan || 'Growth',
        schemeOption: f.option || 'Direct'
      },
      transactions: (f.transactions || []).map((t: any) => ({
        transactionDate: t.date,
        description: t.description,
        transactionType: this.mapTransactionType(t.type || t.description),
        amount: parseFloat(t.amount || 0),
        units: parseFloat(t.units || 0),
        nav: parseFloat(t.nav || 0),
        balanceUnits: parseFloat(t.balance || 0)
      }))
    }));

    const totalCurrentValue = folios.reduce((sum, f) => sum + f.valueAtNav, 0);
    const totalInvestedValue = folios.reduce((sum, f) => sum + (f.costValue || 0), 0);
    const totalGainLoss = totalCurrentValue - totalInvestedValue;

    return {
      provider: externalData.cas_type === 'KARVY' ? 'KFin' : 'CAMS',
      investor: {
        pan: externalData.investor?.pan || '',
        name: externalData.investor?.name || '',
        email: externalData.investor?.email,
        mobile: externalData.investor?.mobile,
        address: externalData.investor?.address ? {
          line1: externalData.investor.address.address1,
          line2: externalData.investor.address.address2,
          city: externalData.investor.address.city,
          state: externalData.investor.address.state,
          pincode: externalData.investor.address.pin
        } : undefined
      },
      statementPeriod: {
        from: externalData.statement_period?.from || '',
        to: externalData.statement_period?.to || ''
      },
      folios,
      transactions,
      summary: {
        totalFolios: folios.length,
        totalInvestedValue,
        totalCurrentValue,
        totalGainLoss,
        totalGainLossPercentage: totalInvestedValue > 0 
          ? (totalGainLoss / totalInvestedValue) * 100 
          : 0
      },
      parseMetadata: {
        parsedAt: new Date(),
        parserVersion: '1.0.0',
        pdfPages: externalData.file_type?.pages || 0,
        warnings: externalData.warnings
      }
    };
  }

  /**
   * Map transaction description to type
   */
  private mapTransactionType(description: string): Transaction['transactionType'] {
    const desc = description.toUpperCase();
    
    if (desc.includes('PURCHASE') || desc.includes('BUY')) return 'Purchase';
    if (desc.includes('REDEMPTION') || desc.includes('SELL')) return 'Redemption';
    if (desc.includes('SWITCH IN')) return 'Switch In';
    if (desc.includes('SWITCH OUT')) return 'Switch Out';
    if (desc.includes('DIVIDEND')) return 'Dividend';
    if (desc.includes('SIP')) return 'SIP';
    if (desc.includes('STP')) return 'STP';
    if (desc.includes('SWP')) return 'SWP';
    
    return 'Other';
  }

  /**
   * Generate mock parsed CAS data for development
   */
  private async parseWithMockParser(provider: CASProvider): Promise<CASParseResponse> {
    logger.info('Using mock CAS parser', { provider });

    const mockData: ParsedCASData = {
      provider,
      investor: {
        pan: 'ABCDE1234F',
        name: 'Rajesh Kumar',
        email: 'rajesh.kumar@example.com',
        mobile: '+919876543210',
        address: {
          line1: '123 MG Road',
          line2: 'Koramangala',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560034'
        }
      },
      statementPeriod: {
        from: '2023-04-01',
        to: '2024-03-31'
      },
      folios: [
        {
          folioNumber: `${provider === 'CAMS' ? 'CAM' : 'KAR'}123456/34`,
          panNumber: 'ABCDE1234F',
          kycStatus: 'Compliant',
          scheme: {
            amcName: 'HDFC Asset Management Company Ltd',
            schemeName: 'HDFC Flexi Cap Fund - Direct Plan - Growth',
            isin: 'INF179KA1249',
            schemeType: 'Equity',
            schemePlan: 'Growth',
            schemeOption: 'Direct'
          },
          registrar: provider,
          units: 1250.5034,
          nav: 845.30,
          valueAtNav: 1056797.65,
          costValue: 950000,
          dateOfFirstInvestment: '2020-04-15',
          dateOfLastInvestment: '2024-12-10'
        },
        {
          folioNumber: `${provider === 'CAMS' ? 'CAM' : 'KAR'}789012/34`,
          panNumber: 'ABCDE1234F',
          kycStatus: 'Compliant',
          scheme: {
            amcName: 'Axis Asset Management Company Ltd',
            schemeName: 'Axis Bluechip Fund - Direct Growth',
            isin: 'INF846KA1086',
            schemeType: 'Equity',
            schemePlan: 'Growth',
            schemeOption: 'Direct'
          },
          registrar: provider,
          units: 2100.0000,
          nav: 425.80,
          valueAtNav: 894180.00,
          costValue: 800000,
          dateOfFirstInvestment: '2021-01-20',
          dateOfLastInvestment: '2024-11-28'
        }
      ],
      transactions: [
        {
          folioNumber: `${provider === 'CAMS' ? 'CAM' : 'KAR'}123456/34`,
          scheme: {
            amcName: 'HDFC Asset Management Company Ltd',
            schemeName: 'HDFC Flexi Cap Fund - Direct Plan - Growth',
            isin: 'INF179KA1249',
            schemeType: 'Equity',
            schemePlan: 'Growth',
            schemeOption: 'Direct'
          },
          transactions: [
            {
              transactionDate: '2020-04-15',
              description: 'Purchase',
              transactionType: 'Purchase',
              amount: 500000,
              units: 650.0000,
              nav: 769.23,
              balanceUnits: 650.0000
            },
            {
              transactionDate: '2021-06-10',
              description: 'SIP Purchase',
              transactionType: 'SIP',
              amount: 50000,
              units: 55.8934,
              nav: 894.50,
              balanceUnits: 705.8934
            },
            {
              transactionDate: '2024-12-10',
              description: 'Additional Purchase',
              transactionType: 'Purchase',
              amount: 400000,
              units: 544.6100,
              nav: 734.58,
              balanceUnits: 1250.5034
            }
          ]
        }
      ],
      summary: {
        totalFolios: 2,
        totalInvestedValue: 1750000,
        totalCurrentValue: 1950977.65,
        totalGainLoss: 200977.65,
        totalGainLossPercentage: 11.48
      },
      parseMetadata: {
        parsedAt: new Date(),
        parserVersion: '1.0.0-mock',
        pdfPages: 8,
        warnings: ['Mock data used for development']
      }
    };

    return {
      success: true,
      data: mockData,
      warnings: ['Using mock parser - external parser not configured']
    };
  }

  /**
   * Validate parsed CAS data for completeness
   */
  validateParsedData(data: ParsedCASData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.investor.pan) {
      errors.push('Investor PAN is required');
    }

    if (!data.investor.name) {
      errors.push('Investor name is required');
    }

    if (data.folios.length === 0) {
      errors.push('No folios found in CAS');
    }

    for (const folio of data.folios) {
      if (!folio.folioNumber) {
        errors.push(`Folio missing folio number`);
      }
      if (folio.units <= 0) {
        errors.push(`Folio ${folio.folioNumber} has invalid units: ${folio.units}`);
      }
      if (folio.nav <= 0) {
        errors.push(`Folio ${folio.folioNumber} has invalid NAV: ${folio.nav}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const casParserService = new CASParserService();
