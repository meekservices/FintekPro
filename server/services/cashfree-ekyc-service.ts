import axios, { type AxiosInstance } from 'axios';

/**
 * Cashfree Aadhaar eKYC Service
 * Handles Aadhaar OTP-based verification, XML retrieval, and consent tracking
 * 
 * Flow:
 * 1. initSession() - Create eKYC session and send OTP to Aadhaar-linked mobile
 * 2. verifyOtp() - Verify OTP and retrieve signed XML
 * 3. getXmlDocument() - Download and decrypt XML from Cashfree
 * 4. parseXmlData() - Extract name, DOB, address, photo from XML
 */

interface CashfreeConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  environment: 'sandbox' | 'production';
}

interface InitSessionRequest {
  aadhaarNumber: string;
  consent: boolean;
  consentIpAddress: string;
  consentUserAgent: string;
}

interface InitSessionResponse {
  sessionId: string;
  status: 'otp_sent' | 'failed';
  message?: string;
  errorCode?: string;
  refId?: string;
}

interface VerifyOtpRequest {
  sessionId: string;
  otp: string;
}

interface VerifyOtpResponse {
  status: 'verified' | 'failed';
  xmlUrl?: string;
  xmlHash?: string;
  errorCode?: string;
  errorMessage?: string;
}

interface ParsedAadhaarData {
  name: string;
  dob: string;
  gender: string;
  address: {
    careOf?: string;
    house?: string;
    street?: string;
    landmark?: string;
    locality?: string;
    vtc?: string;
    district?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };
  photoBase64?: string;
  aadhaarNumber?: string;
  vid?: string;
}

export class CashfreeEkycService {
  private client: AxiosInstance;
  private config: CashfreeConfig;

  constructor(config?: Partial<CashfreeConfig>) {
    this.config = {
      clientId: config?.clientId || process.env.CASHFREE_CLIENT_ID || '',
      clientSecret: config?.clientSecret || process.env.CASHFREE_CLIENT_SECRET || '',
      baseUrl: config?.baseUrl || 'https://api.cashfree.com',
      environment: (config?.environment || process.env.CASHFREE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': this.config.clientId,
        'x-client-secret': this.config.clientSecret
      }
    });
  }

  /**
   * Initiate Aadhaar eKYC session and send OTP
   */
  async initSession(request: InitSessionRequest): Promise<InitSessionResponse> {
    try {
      console.log('[CashfreeEkyc] Initiating session for Aadhaar:', this.maskAadhaar(request.aadhaarNumber));
      
      const response = await this.client.post('/verification/aadhaar-okyc/init', {
        aadhaar_number: request.aadhaarNumber,
        consent: request.consent,
        consent_metadata: {
          ip_address: request.consentIpAddress,
          user_agent: request.consentUserAgent,
          timestamp: new Date().toISOString()
        }
      });

      return {
        sessionId: response.data.session_id || response.data.ref_id,
        status: response.data.status === 'SUCCESS' ? 'otp_sent' : 'failed',
        message: response.data.message,
        errorCode: response.data.error_code,
        refId: response.data.ref_id
      };
    } catch (error: any) {
      console.error('[CashfreeEkyc] Init session failed:', error.response?.data || error.message);
      
      return {
        sessionId: '',
        status: 'failed',
        errorCode: error.response?.data?.error_code || 'INIT_FAILED',
        message: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Verify OTP and retrieve XML document URL
   */
  async verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    try {
      const response = await this.client.post('/verification/aadhaar-okyc/verify', {
        session_id: request.sessionId,
        otp: request.otp
      });

      if (response.data.status === 'SUCCESS' && response.data.xml_url) {
        return {
          status: 'verified',
          xmlUrl: response.data.xml_url,
          xmlHash: response.data.xml_hash
        };
      }

      return {
        status: 'failed',
        errorCode: response.data.error_code || 'VERIFICATION_FAILED',
        errorMessage: response.data.message || 'OTP verification failed'
      };
    } catch (error: any) {
      console.error('[CashfreeEkyc] OTP verification failed:', error.response?.data || error.message);
      
      return {
        status: 'failed',
        errorCode: error.response?.data?.error_code || 'OTP_VERIFY_FAILED',
        errorMessage: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Download XML document from Cashfree signed URL
   */
  async getXmlDocument(xmlUrl: string): Promise<string | null> {
    try {
      const response = await axios.get(xmlUrl, {
        timeout: 30000,
        headers: {
          'Accept': 'application/xml, text/xml'
        }
      });

      return response.data;
    } catch (error: any) {
      console.error('[CashfreeEkyc] XML download failed:', error.message);
      return null;
    }
  }

  /**
   * Parse Aadhaar XML and extract demographic data
   * Supports UIDAI Offline eKYC XML format
   */
  async parseXmlData(xmlContent: string): Promise<ParsedAadhaarData | null> {
    try {
      const xml2js = await import('xml2js');
      const parser = new xml2js.Parser({ explicitArray: false });
      const parsed = await parser.parseStringPromise(xmlContent);

      const poi = parsed?.OfflinePaperlessKyc?.UidData?.Poi?.$ || {};
      const poa = parsed?.OfflinePaperlessKyc?.UidData?.Poa?.$ || {};
      const photo = parsed?.OfflinePaperlessKyc?.UidData?.Pht;

      return {
        name: poi.name || '',
        dob: poi.dob || '',
        gender: poi.gender || '',
        address: {
          careOf: poa.co,
          house: poa.house,
          street: poa.street,
          landmark: poa.lm,
          locality: poa.loc,
          vtc: poa.vtc,
          district: poa.dist,
          state: poa.state,
          country: poa.country || 'India',
          pincode: poa.pc
        },
        photoBase64: photo,
        aadhaarNumber: parsed?.OfflinePaperlessKyc?.UidData?.$?.uid,
        vid: parsed?.OfflinePaperlessKyc?.UidData?.$?.vid
      };
    } catch (error: any) {
      console.error('[CashfreeEkyc] XML parsing failed:', error.message);
      return null;
    }
  }

  /**
   * Complete eKYC flow: init session → verify OTP → download XML → parse data
   */
  async completeEkyc(
    aadhaarNumber: string,
    otp: string,
    consentMetadata: { ipAddress: string; userAgent: string }
  ): Promise<{
    success: boolean;
    sessionId?: string;
    data?: ParsedAadhaarData;
    xmlUrl?: string;
    xmlHash?: string;
    errorCode?: string;
    errorMessage?: string;
  }> {
    const initResponse = await this.initSession({
      aadhaarNumber,
      consent: true,
      consentIpAddress: consentMetadata.ipAddress,
      consentUserAgent: consentMetadata.userAgent
    });

    if (initResponse.status === 'failed') {
      return {
        success: false,
        errorCode: initResponse.errorCode,
        errorMessage: initResponse.message
      };
    }

    const verifyResponse = await this.verifyOtp({
      sessionId: initResponse.sessionId,
      otp
    });

    if (verifyResponse.status === 'failed' || !verifyResponse.xmlUrl) {
      return {
        success: false,
        sessionId: initResponse.sessionId,
        errorCode: verifyResponse.errorCode,
        errorMessage: verifyResponse.errorMessage
      };
    }

    const xmlContent = await this.getXmlDocument(verifyResponse.xmlUrl);
    if (!xmlContent) {
      return {
        success: false,
        sessionId: initResponse.sessionId,
        xmlUrl: verifyResponse.xmlUrl,
        errorCode: 'XML_DOWNLOAD_FAILED',
        errorMessage: 'Failed to download XML document'
      };
    }

    const xmlHash = verifyResponse.xmlHash || this.generateHash(xmlContent);

    const parsedData = await this.parseXmlData(xmlContent);
    if (!parsedData) {
      return {
        success: false,
        sessionId: initResponse.sessionId,
        xmlUrl: verifyResponse.xmlUrl,
        xmlHash,
        errorCode: 'XML_PARSE_FAILED',
        errorMessage: 'Failed to parse XML document'
      };
    }

    return {
      success: true,
      sessionId: initResponse.sessionId,
      data: parsedData,
      xmlUrl: verifyResponse.xmlUrl,
      xmlHash
    };
  }

  /**
   * Mask Aadhaar number for security (show only last 4 digits)
   */
  private maskAadhaar(aadhaar: string): string {
    if (aadhaar.length !== 12) return aadhaar;
    return `XXXX-XXXX-${aadhaar.slice(-4)}`;
  }

  /**
   * Generate SHA-256 hash for XML integrity verification
   */
  private generateHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Validate Aadhaar number format (12 digits, passes Verhoeff checksum)
   */
  static validateAadhaarFormat(aadhaar: string): boolean {
    const cleaned = aadhaar.replace(/\s|-/g, '');
    return /^\d{12}$/.test(cleaned) && this.verhoeffCheck(cleaned);
  }

  /**
   * Verhoeff algorithm checksum validation for Aadhaar numbers
   */
  private static verhoeffCheck(aadhaar: string): boolean {
    const d = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
    const p = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
    let c = 0;
    const digits = aadhaar.split('').map(Number).reverse();
    
    for (let i = 0; i < digits.length; i++) {
      c = d[c][p[(i % 8)][digits[i]]];
    }
    
    return c === 0;
  }
}

export const cashfreeEkycService = new CashfreeEkycService();
