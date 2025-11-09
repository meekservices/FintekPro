import axios, { type AxiosInstance } from 'axios';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';

/**
 * BSE STAR UCC Creation Service
 * Handles Unique Client Code (UCC) creation for BSE STAR mutual fund platform
 * 
 * Prerequisites:
 * - KRA verification must be completed (verified status from Protean)
 * - CKYC number obtained from CERSAI
 * 
 * Flow:
 * 1. validateKraStatus() - Verify KRA is in verified state
 * 2. createUcc() - Submit UCC request to BSE STAR
 * 3. checkUccStatus() - Poll for UCC creation status
 * 4. getUccDetails() - Retrieve complete UCC information
 */

interface BseStarConfig {
  memberId: string;
  userId: string;
  password: string;
  baseUrl: string;
  environment: 'sandbox' | 'production';
}

interface PersonalDetails {
  firstName: string;
  middleName?: string;
  lastName: string;
  panNumber: string;
  dob: string;
  gender: 'M' | 'F' | 'T';
  mobile: string;
  email: string;
  occupation?: string;
  annualIncome?: string;
  taxStatus: 'Individual' | 'HUF' | 'Company' | 'Trust' | 'Others';
}

interface AddressDetails {
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

interface BankDetails {
  accountNumber: string;
  accountType: 'Savings' | 'Current' | 'NRE' | 'NRO';
  ifscCode: string;
  bankName: string;
  branchName: string;
  micr?: string;
}

interface KycDetails {
  kraNumber: string;
  ckycNumber?: string;
  pepFlag: 'Y' | 'N';
}

interface CreateUccRequest {
  personalDetails: PersonalDetails;
  addressDetails: AddressDetails;
  bankDetails: BankDetails;
  kycDetails: KycDetails;
  clientCode?: string;
  sourceCode?: string;
}

interface CreateUccResponse {
  success: boolean;
  uccNumber?: string;
  clientCode?: string;
  requestId?: string;
  responseData?: any;
  errorCode?: string;
  errorMessage?: string;
}

interface UccStatusResponse {
  status: 'pending' | 'submitted' | 'created' | 'failed';
  uccNumber?: string;
  clientCode?: string;
  createdAt?: string;
  rejectionReason?: string;
}

export class BseUccService {
  private client: AxiosInstance;
  private config: BseStarConfig;

  constructor(config?: Partial<BseStarConfig>) {
    this.config = {
      memberId: config?.memberId || process.env.BSE_MEMBER_ID || '',
      userId: config?.userId || process.env.BSE_USER_ID || '',
      password: config?.password || process.env.BSE_PASSWORD || '',
      baseUrl: config?.baseUrl || 'https://bsestarmf.in',
      environment: (config?.environment || process.env.BSE_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production'
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml'
      }
    });
  }

  /**
   * Create UCC (Unique Client Code) on BSE STAR platform
   */
  async createUcc(request: CreateUccRequest): Promise<CreateUccResponse> {
    try {
      console.log('[BSE-UCC] Creating UCC for PAN:', request.personalDetails.panNumber);
      
      const xmlPayload = this.generateUccXml(request);
      
      const response = await this.client.post('/MFOrderEntry/MFUCCService.svc/SecureUCCCreation', xmlPayload, {
        headers: {
          'Content-Type': 'application/xml'
        }
      });

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsedResponse = parser.parse(response.data);
      
      const responseData = parsedResponse.UCCResponse || parsedResponse.Response || parsedResponse;

      const status = (responseData.Status || responseData.status || '').toLowerCase();
      if (status === 'success' || status === 'created') {
        return {
          success: true,
          uccNumber: responseData.UCCCode || responseData.ucc_number,
          clientCode: responseData.ClientCode || responseData.client_code,
          requestId: responseData.RequestId || responseData.request_id,
          responseData
        };
      }

      return {
        success: false,
        errorCode: responseData.ErrorCode || 'UCC_CREATION_FAILED',
        errorMessage: responseData.ErrorMessage || 'UCC creation failed'
      };
    } catch (error: any) {
      console.error('[BSE-UCC] Creation failed:', error.response?.data || error.message);
      
      let errorCode = 'NETWORK_ERROR';
      let errorMessage = error.message;
      
      if (error.response?.data) {
        try {
          const parser = new XMLParser({ ignoreAttributes: false });
          const parsedError = parser.parse(error.response.data);
          const errorData = parsedError.Error || parsedError.Response || parsedError;
          errorCode = errorData.ErrorCode || errorCode;
          errorMessage = errorData.ErrorMessage || errorMessage;
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
   * Check UCC creation status
   */
  async checkUccStatus(requestId: string): Promise<UccStatusResponse> {
    try {
      const xmlPayload = `
        <UCCStatusRequest>
          <MemberId>${this.config.memberId}</MemberId>
          <UserId>${this.config.userId}</UserId>
          <Password>${this.config.password}</Password>
          <RequestId>${requestId}</RequestId>
        </UCCStatusRequest>
      `;
      
      const response = await this.client.post('/MFOrderEntry/MFUCCService.svc/UCCStatus', xmlPayload);

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsedResponse = parser.parse(response.data);
      
      const statusData = parsedResponse.UCCStatusResponse || parsedResponse.Response || parsedResponse;

      return {
        status: this.normalizeStatus(statusData.Status || statusData.status),
        uccNumber: statusData.UCCCode || statusData.ucc_number,
        clientCode: statusData.ClientCode || statusData.client_code,
        createdAt: statusData.CreatedAt || statusData.created_at,
        rejectionReason: statusData.RejectionReason || statusData.rejection_reason
      };
    } catch (error: any) {
      console.error('[BSE-UCC] Status check failed:', error.message);
      
      return {
        status: 'pending',
        rejectionReason: error.message
      };
    }
  }

  /**
   * Get UCC details by UCC number
   */
  async getUccDetails(uccNumber: string): Promise<any> {
    try {
      const xmlPayload = `
        <UCCDetailsRequest>
          <MemberId>${this.config.memberId}</MemberId>
          <UserId>${this.config.userId}</UserId>
          <Password>${this.config.password}</Password>
          <UCCCode>${uccNumber}</UCCCode>
        </UCCDetailsRequest>
      `;
      
      const response = await this.client.post('/MFOrderEntry/MFUCCService.svc/GetUCCDetails', xmlPayload);

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsedResponse = parser.parse(response.data);
      
      return parsedResponse.UCCDetails || parsedResponse.Response || parsedResponse;
    } catch (error: any) {
      console.error('[BSE-UCC] Get details failed:', error.message);
      return null;
    }
  }

  /**
   * Validate KRA status before UCC creation
   */
  validateKraStatus(kraStatus: string, kraNumber?: string): { valid: boolean; reason?: string } {
    const normalizedStatus = kraStatus?.toLowerCase();
    
    if (normalizedStatus !== 'verified') {
      return {
        valid: false,
        reason: `KRA status must be 'verified', current status: ${kraStatus}`
      };
    }

    if (!kraNumber) {
      return {
        valid: false,
        reason: 'KRA number is required for UCC creation'
      };
    }

    return { valid: true };
  }

  /**
   * Generate BSE STAR UCC XML payload
   */
  private generateUccXml(request: CreateUccRequest): string {
    const { personalDetails, addressDetails, bankDetails, kycDetails } = request;
    
    const uccRequest = {
      UCCRequest: {
        '@_xmlns': 'http://www.bsestarmf.in/2010/UCC',
        MemberDetails: {
          MemberId: this.config.memberId,
          UserId: this.config.userId,
          Password: this.config.password
        },
        ClientDetails: {
          ClientCode: request.clientCode || '',
          PAN: personalDetails.panNumber,
          FirstName: personalDetails.firstName,
          MiddleName: personalDetails.middleName || '',
          LastName: personalDetails.lastName,
          DOB: personalDetails.dob,
          Gender: personalDetails.gender,
          Mobile: personalDetails.mobile,
          Email: personalDetails.email,
          Occupation: personalDetails.occupation || '',
          AnnualIncome: personalDetails.annualIncome || '',
          TaxStatus: personalDetails.taxStatus
        },
        AddressDetails: {
          AddressLine1: addressDetails.addressLine1,
          AddressLine2: addressDetails.addressLine2 || '',
          AddressLine3: addressDetails.addressLine3 || '',
          City: addressDetails.city,
          State: addressDetails.state,
          Pincode: addressDetails.pincode,
          Country: addressDetails.country
        },
        BankDetails: {
          AccountNumber: bankDetails.accountNumber,
          AccountType: bankDetails.accountType,
          IFSCCode: bankDetails.ifscCode,
          BankName: bankDetails.bankName,
          BranchName: bankDetails.branchName,
          MICR: bankDetails.micr || ''
        },
        KYCDetails: {
          KRANumber: kycDetails.kraNumber,
          CKYCNumber: kycDetails.ckycNumber || '',
          PEPFlag: kycDetails.pepFlag
        },
        SourceCode: request.sourceCode || 'WEB'
      }
    };

    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      suppressEmptyNode: true
    });

    return builder.build(uccRequest);
  }

  /**
   * Normalize BSE STAR status to internal enum
   */
  private normalizeStatus(status: string): 'pending' | 'submitted' | 'created' | 'failed' {
    const normalized = status?.toLowerCase();
    
    if (['success', 'created', 'active'].includes(normalized)) return 'created';
    if (['submitted', 'in_process', 'processing'].includes(normalized)) return 'submitted';
    if (['failed', 'rejected', 'error'].includes(normalized)) return 'failed';
    
    return 'pending';
  }

  /**
   * Validate PAN format
   */
  static validatePanFormat(pan: string): boolean {
    return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan);
  }

  /**
   * Validate IFSC code format
   */
  static validateIfscFormat(ifsc: string): boolean {
    return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc);
  }

  /**
   * Validate mobile number (10 digits)
   */
  static validateMobileFormat(mobile: string): boolean {
    return /^[6-9]\d{9}$/.test(mobile);
  }

  /**
   * Validate email format
   */
  static validateEmailFormat(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Validate pincode (6 digits)
   */
  static validatePincodeFormat(pincode: string): boolean {
    return /^\d{6}$/.test(pincode);
  }
}

export const bseUccService = new BseUccService();
