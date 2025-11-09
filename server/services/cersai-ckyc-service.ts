import axios, { type AxiosInstance } from 'axios';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';

/**
 * CERSAI CKYC Submission Service
 * Handles Central KYC (CKYC) XML generation and submission to CERSAI registry
 * 
 * Flow:
 * 1. generateCkycXml() - Create CKYC XML package v3.0 from user data
 * 2. submitToCArsai() - Submit XML to CERSAI and get acknowledgment
 * 3. checkStatus() - Poll for verification status
 * 4. uploadToObjectStorage() - Store XML securely for compliance
 */

interface CersaiConfig {
  apiKey: string;
  institutionCode: string;
  baseUrl: string;
  environment: 'sandbox' | 'production';
}

interface CkycPersonalData {
  prefix?: string;
  firstName: string;
  middleName?: string;
  lastName?: string;
  maidenPrefix?: string;
  maidenFirstName?: string;
  maidenMiddleName?: string;
  maidenLastName?: string;
  fatherPrefix?: string;
  fatherFirstName?: string;
  fatherMiddleName?: string;
  fatherLastName?: string;
  motherPrefix?: string;
  motherFirstName?: string;
  motherMiddleName?: string;
  motherLastName?: string;
  gender: 'M' | 'F' | 'T';
  dob: string;
  pan: string;
  aadhaar?: string;
  nationality: string;
  email?: string;
  mobile?: string;
}

interface CkycAddressData {
  type: 'permanent' | 'correspondence';
  line1: string;
  line2?: string;
  line3?: string;
  city: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
  proofType?: string;
  proofDocNumber?: string;
}

interface CkycIdentityProof {
  type: 'PAN' | 'AADHAAR' | 'VOTER_ID' | 'PASSPORT' | 'DRIVING_LICENSE';
  number: string;
  expiryDate?: string;
}

interface CkycImageData {
  type: 'photograph' | 'signature' | 'pan' | 'aadhaar';
  base64Data: string;
  format: 'jpg' | 'png' | 'pdf';
}

interface GenerateXmlRequest {
  personalData: CkycPersonalData;
  addresses: CkycAddressData[];
  identityProofs: CkycIdentityProof[];
  images?: CkycImageData[];
  applicationReferenceNumber: string;
}

interface SubmitResponse {
  success: boolean;
  submissionId?: string;
  ckycNumber?: string;
  acknowledgmentData?: any;
  errorCode?: string;
  errorMessage?: string;
}

interface StatusResponse {
  status: 'pending' | 'submitted' | 'acknowledged' | 'verified' | 'rejected';
  ckycNumber?: string;
  verifiedAt?: string;
  rejectionCode?: string;
  rejectionMessage?: string;
  acknowledgedAt?: string;
}

export class CersaiCkycService {
  private client: AxiosInstance;
  private config: CersaiConfig;

  constructor(config?: Partial<CersaiConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.CERSAI_API_KEY || '',
      institutionCode: config?.institutionCode || process.env.CERSAI_INSTITUTION_CODE || 'FP001',
      baseUrl: config?.baseUrl || 'https://cersai.org.in/ckyc',
      environment: (config?.environment || process.env.CERSAI_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/xml',
        'X-API-Key': this.config.apiKey,
        'X-Institution-Code': this.config.institutionCode
      }
    });
  }

  /**
   * Generate CKYC XML Package (Version 3.0)
   * Compliant with CERSAI CKYC XML schema
   */
  generateCkycXml(request: GenerateXmlRequest): string {
    const timestamp = new Date().toISOString();
    const { personalData, addresses, identityProofs, images = [] } = request;

    const ckycPackage = {
      CKYC_PACKAGE: {
        '@_version': '3.0',
        '@_xmlns': 'http://www.cersai.org.in/CKYC',
        HEADER: {
          INSTITUTION_CODE: this.config.institutionCode,
          BATCH_ID: `BATCH_${Date.now()}`,
          RECORD_COUNT: '1',
          SUBMISSION_DATE: timestamp.split('T')[0],
          SUBMISSION_TIME: timestamp.split('T')[1].split('.')[0]
        },
        RECORDS: {
          RECORD: {
            '@_seq': '1',
            APPLICATION_REFERENCE_NUMBER: request.applicationReferenceNumber,
            PERSONAL_DETAILS: {
              PREFIX: personalData.prefix || 'Mr',
              FIRST_NAME: personalData.firstName,
              MIDDLE_NAME: personalData.middleName || '',
              LAST_NAME: personalData.lastName,
              MAIDEN_PREFIX: personalData.maidenPrefix || '',
              MAIDEN_FIRST_NAME: personalData.maidenFirstName || '',
              MAIDEN_MIDDLE_NAME: personalData.maidenMiddleName || '',
              MAIDEN_LAST_NAME: personalData.maidenLastName || '',
              FATHERS_PREFIX: personalData.fatherPrefix || '',
              FATHERS_FIRST_NAME: personalData.fatherFirstName || '',
              FATHERS_MIDDLE_NAME: personalData.fatherMiddleName || '',
              FATHERS_LAST_NAME: personalData.fatherLastName || '',
              MOTHERS_PREFIX: personalData.motherPrefix || '',
              MOTHERS_FIRST_NAME: personalData.motherFirstName || '',
              MOTHERS_MIDDLE_NAME: personalData.motherMiddleName || '',
              MOTHERS_LAST_NAME: personalData.motherLastName || '',
              GENDER: personalData.gender,
              DATE_OF_BIRTH: personalData.dob,
              PAN: personalData.pan,
              AADHAAR: personalData.aadhaar || '',
              NATIONALITY: personalData.nationality,
              EMAIL: personalData.email || '',
              MOBILE: personalData.mobile || ''
            },
            ADDRESS_DETAILS: addresses.map((addr, idx) => ({
              '@_seq': String(idx + 1),
              ADDRESS_TYPE: addr.type === 'permanent' ? '01' : '02',
              ADDRESS_LINE_1: addr.line1,
              ADDRESS_LINE_2: addr.line2 || '',
              ADDRESS_LINE_3: addr.line3 || '',
              CITY: addr.city,
              DISTRICT: addr.district,
              STATE: addr.state,
              COUNTRY: addr.country,
              PINCODE: addr.pincode,
              PROOF_OF_ADDRESS_TYPE: addr.proofType || '01',
              PROOF_OF_ADDRESS_DOC_NUMBER: addr.proofDocNumber || ''
            })),
            IDENTITY_DETAILS: identityProofs.map((proof, idx) => ({
              '@_seq': String(idx + 1),
              IDENTITY_TYPE: this.getIdentityTypeCode(proof.type),
              IDENTITY_NUMBER: proof.number,
              EXPIRY_DATE: proof.expiryDate || ''
            })),
            IMAGE_DETAILS: images.map((img, idx) => ({
              '@_seq': String(idx + 1),
              IMAGE_TYPE: this.getImageTypeCode(img.type),
              IMAGE_FORMAT: img.format.toUpperCase(),
              IMAGE_DATA: img.base64Data
            }))
          }
        }
      }
    };

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      suppressEmptyNode: true
    });

    return builder.build(ckycPackage);
  }

  /**
   * Submit CKYC XML to CERSAI
   */
  async submitToCersai(xmlContent: string): Promise<SubmitResponse> {
    try {
      console.log('[CERSAI] Submitting CKYC XML to CERSAI...');
      
      const response = await this.client.post('/submit', xmlContent, {
        headers: {
          'Content-Type': 'application/xml'
        }
      });

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsedResponse = parser.parse(response.data);
      
      const responseData = parsedResponse.RESPONSE || parsedResponse.CKYC_RESPONSE || parsedResponse;

      if (responseData.STATUS === 'SUCCESS' || responseData.status === 'acknowledged') {
        return {
          success: true,
          submissionId: responseData.SUBMISSION_ID || responseData.submission_id,
          ckycNumber: responseData.CKYC_NUMBER || responseData.ckyc_number,
          acknowledgmentData: responseData
        };
      }

      return {
        success: false,
        errorCode: responseData.ERROR_CODE || 'SUBMISSION_FAILED',
        errorMessage: responseData.ERROR_MESSAGE || 'CKYC submission failed'
      };
    } catch (error: any) {
      console.error('[CERSAI] Submission failed:', error.response?.data || error.message);
      
      let errorCode = 'NETWORK_ERROR';
      let errorMessage = error.message;
      
      if (error.response?.data) {
        try {
          const parser = new XMLParser({ ignoreAttributes: false });
          const parsedError = parser.parse(error.response.data);
          const errorData = parsedError.ERROR || parsedError.RESPONSE || parsedError;
          errorCode = errorData.ERROR_CODE || errorCode;
          errorMessage = errorData.ERROR_MESSAGE || errorMessage;
        } catch {
          // If parsing fails, use raw error message
        }
      }
      
      return {
        success: false,
        errorCode,
        errorMessage
      };
    }
  }

  /**
   * Check CKYC verification status
   */
  async checkStatus(submissionId: string): Promise<StatusResponse> {
    try {
      const response = await this.client.get(`/status/${submissionId}`);

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsedResponse = parser.parse(response.data);
      
      const statusData = parsedResponse.STATUS_RESPONSE || parsedResponse.RESPONSE || parsedResponse;

      return {
        status: this.normalizeStatus(statusData.STATUS || statusData.status),
        ckycNumber: statusData.CKYC_NUMBER || statusData.ckyc_number,
        verifiedAt: statusData.VERIFIED_AT || statusData.verified_at,
        rejectionCode: statusData.REJECTION_CODE || statusData.rejection_code,
        rejectionMessage: statusData.REJECTION_MESSAGE || statusData.rejection_message,
        acknowledgedAt: statusData.ACKNOWLEDGED_AT || statusData.acknowledged_at
      };
    } catch (error: any) {
      console.error('[CERSAI] Status check failed:', error.message);
      
      return {
        status: 'pending',
        rejectionCode: 'STATUS_CHECK_FAILED',
        rejectionMessage: error.message
      };
    }
  }

  /**
   * Complete CKYC flow: Generate XML → Submit → Return submission details
   */
  async completeCkycSubmission(request: GenerateXmlRequest): Promise<{
    success: boolean;
    xmlContent?: string;
    submissionId?: string;
    ckycNumber?: string;
    acknowledgmentData?: any;
    errorCode?: string;
    errorMessage?: string;
  }> {
    try {
      const xmlContent = this.generateCkycXml(request);
      
      const submitResponse = await this.submitToCersai(xmlContent);
      
      if (!submitResponse.success) {
        return {
          success: false,
          xmlContent,
          errorCode: submitResponse.errorCode,
          errorMessage: submitResponse.errorMessage
        };
      }

      return {
        success: true,
        xmlContent,
        submissionId: submitResponse.submissionId,
        ckycNumber: submitResponse.ckycNumber,
        acknowledgmentData: submitResponse.acknowledgmentData
      };
    } catch (error: any) {
      console.error('[CERSAI] Complete CKYC submission failed:', error.message);
      
      return {
        success: false,
        errorCode: 'CKYC_SUBMISSION_FAILED',
        errorMessage: error.message
      };
    }
  }

  /**
   * Map identity proof type to CERSAI code
   */
  private getIdentityTypeCode(type: string): string {
    const mapping: Record<string, string> = {
      'PAN': '01',
      'AADHAAR': '02',
      'VOTER_ID': '03',
      'PASSPORT': '04',
      'DRIVING_LICENSE': '05'
    };
    return mapping[type] || '99';
  }

  /**
   * Map image type to CERSAI code
   */
  private getImageTypeCode(type: string): string {
    const mapping: Record<string, string> = {
      'photograph': '01',
      'signature': '02',
      'pan': '03',
      'aadhaar': '04'
    };
    return mapping[type] || '99';
  }

  /**
   * Normalize CERSAI status to internal enum
   */
  private normalizeStatus(status: string): 'pending' | 'submitted' | 'acknowledged' | 'verified' | 'rejected' {
    const normalized = status?.toLowerCase();
    
    if (['success', 'verified', 'completed'].includes(normalized)) return 'verified';
    if (['acknowledged', 'ack', 'accepted'].includes(normalized)) return 'acknowledged';
    if (['submitted', 'in_progress', 'processing'].includes(normalized)) return 'submitted';
    if (['rejected', 'failed', 'error'].includes(normalized)) return 'rejected';
    
    return 'pending';
  }

  /**
   * Validate PAN format (AAAAA9999A)
   */
  static validatePanFormat(pan: string): boolean {
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  }

  /**
   * Validate email format
   */
  static validateEmailFormat(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Validate mobile number (10 digits)
   */
  static validateMobileFormat(mobile: string): boolean {
    return /^[6-9]\d{9}$/.test(mobile);
  }
}

export const cersaiCkycService = new CersaiCkycService();
