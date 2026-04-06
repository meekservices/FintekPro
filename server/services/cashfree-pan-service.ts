/**
 * Cashfree PAN Verification Service
 * 
 * Provides real PAN verification using Cashfree's Verification Suite API.
 * Supports both Individual and Corporate PAN verification.
 * 
 * Documentation: https://docs.cashfree.com/reference/pan-verification
 */

import axios from 'axios';

interface CashfreePANResponse {
  success: boolean;
  message: string;
  verified: boolean;
  data?: {
    pan: string;
    type: 'Individual' | 'Business';
    registeredName: string;
    nameProvided: string;
    nameMatchScore: number;
    nameMatchResult: string;
    aadhaarSeedingStatus?: 'Y' | 'N';
    aadhaarSeedingStatusDesc?: string;
    panStatus: 'VALID' | 'INVALID';
    lastUpdatedAt: string;
    referenceId: number;
  };
}

export class CashfreePANService {
  private static readonly SANDBOX_URL = 'https://sandbox.cashfree.com/verification';
  private static readonly PRODUCTION_URL = 'https://api.cashfree.com/verification';
  
  private static getBaseUrl(): string {
    const env = process.env.CASHFREE_SECUREID_ENVIRONMENT || process.env.CASHFREE_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX');
    return env.toUpperCase() === 'PRODUCTION' ? this.PRODUCTION_URL : this.SANDBOX_URL;
  }

  static hasVerificationCredentials(): boolean {
    return !!(
      (process.env.CASHFREE_SECUREID_APP_ID || process.env.CASHFREE_VERIFICATION_APP_ID || process.env.CASHFREE_PG_APP_ID || process.env.CASHFREE_APP_ID) &&
      (process.env.CASHFREE_SECUREID_SECRET_KEY || process.env.CASHFREE_VERIFICATION_SECRET_KEY || process.env.CASHFREE_PG_SECRET_KEY || process.env.CASHFREE_SECRET_KEY)
    );
  }

  private static getHeaders() {
    const appId =
      process.env.CASHFREE_SECUREID_APP_ID ||
      process.env.CASHFREE_VERIFICATION_APP_ID ||
      process.env.CASHFREE_PG_APP_ID ||
      process.env.CASHFREE_APP_ID || '';
    const secretKey =
      process.env.CASHFREE_SECUREID_SECRET_KEY ||
      process.env.CASHFREE_VERIFICATION_SECRET_KEY ||
      process.env.CASHFREE_PG_SECRET_KEY ||
      process.env.CASHFREE_SECRET_KEY || '';
    return {
      'Content-Type': 'application/json',
      'x-client-id': appId,
      'x-client-secret': secretKey,
      'x-api-version': '2022-09-12'
    };
  }
  
  /**
   * Verify PAN card details
   * Works for both Individual and Corporate PAN
   * 
   * @param pan - 10-character PAN number (5 letters + 4 digits + 1 letter)
   * @param name - Name of the individual or company
   * @returns Verification result with registered details
   */
  static async verifyPAN(pan: string, name: string): Promise<CashfreePANResponse> {
    try {
      // Validate PAN format
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase())) {
        return {
          success: false,
          message: "Invalid PAN format. Must be 10 characters (e.g., ABCDE1234F)",
          verified: false
        };
      }
      
      if (!name || name.trim().length < 2) {
        return {
          success: false,
          message: "Name is required and must be at least 2 characters",
          verified: false
        };
      }
      
      // Use /pan-lite (current documented endpoint — returns name_match, dob_match, pan_status)
      const verificationId = `pan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const response = await axios.post(
        `${this.getBaseUrl()}/pan-lite`,
        {
          verification_id: verificationId,
          pan: pan.toUpperCase(),
          name: name.trim()
        },
        { headers: this.getHeaders() }
      );

      const d = response.data;
      // pan-lite: status = "VALID" | "INVALID", pan_status = "E" (existing) | "N" (not found)
      // Legacy /pan: valid = true/false
      const isValid = d.status === 'VALID' || d.valid === true;

      if (isValid) {
        const nameMatchRaw = d.name_match;
        const nameMatchResult = nameMatchRaw === 'Y' ? 'MATCH'
          : nameMatchRaw === 'N' ? 'NO_MATCH'
          : (d.name_match_result || 'UNKNOWN');
        const nameMatchScore = nameMatchRaw === 'Y' ? 100
          : nameMatchRaw === 'N' ? 0
          : (d.name_match_score || 0);

        const rawType = d.type || (d.pan ? (d.pan[3] === 'P' ? 'INDIVIDUAL' : 'BUSINESS') : 'INDIVIDUAL');
        const normalizedType = rawType === 'INDIVIDUAL' ? 'Individual'
          : rawType === 'BUSINESS' ? 'Business'
          : rawType;

        return {
          success: true,
          message: 'PAN verified successfully',
          verified: true,
          data: {
            pan: d.pan || pan.toUpperCase(),
            type: normalizedType as 'Individual' | 'Business',
            registeredName: d.registered_name || d.name_pan_card || d.name || '',
            nameProvided: d.name_provided || name.trim(),
            nameMatchScore,
            nameMatchResult,
            aadhaarSeedingStatus: d.aadhaar_seeding_status,
            aadhaarSeedingStatusDesc: d.aadhaar_seeding_status_desc,
            panStatus: d.pan_status,
            dobMatch: d.dob_match,
            lastUpdatedAt: d.last_updated_at,
            referenceId: d.reference_id,
            verificationId: d.verification_id || verificationId,
          }
        };
      }

      // PAN is invalid or doesn't match
      return {
        success: false,
        message: d?.message || 'PAN verification failed. Please check the PAN and name.',
        verified: false
      };
      
    } catch (error: any) {
      console.error('Cashfree PAN verification error:', error.response?.data || error.message);
      
      // Handle specific Cashfree error responses
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // Handle validation errors
        if (errorData.message) {
          return {
            success: false,
            message: errorData.message,
            verified: false
          };
        }
        
        // Handle invalid PAN
        if (errorData.valid === false) {
          return {
            success: false,
            message: "PAN is invalid or does not exist in government records",
            verified: false
          };
        }
      }
      
      return {
        success: false,
        message: "Failed to verify PAN. Please try again.",
        verified: false
      };
    }
  }
  
  /**
   * Verify Individual PAN with additional validation for DOB
   * 
   * @param pan - PAN number
   * @param name - Full name as per PAN card
   * @param dob - Date of birth (YYYY-MM-DD format) - optional for additional validation
   */
  static async verifyIndividualPAN(
    pan: string, 
    name: string, 
    dob?: string
  ): Promise<CashfreePANResponse> {
    const result = await this.verifyPAN(pan, name);
    
    // Additional check: ensure it's an Individual PAN
    if (result.verified && result.data?.type !== 'Individual') {
      return {
        success: false,
        message: `This PAN belongs to a ${result.data?.type}, not an Individual`,
        verified: false
      };
    }
    
    // Check if Aadhaar is linked (important for KYC compliance)
    if (result.verified && result.data?.aadhaarSeedingStatus === 'N') {
      return {
        ...result,
        message: `PAN verified but Aadhaar is not linked. ${result.data?.aadhaarSeedingStatusDesc || 'Please link Aadhaar with PAN.'}`
      };
    }
    
    return result;
  }
  
  /**
   * Verify Corporate/Company PAN
   * 
   * @param pan - Corporate PAN number
   * @param companyName - Registered company name
   */
  static async verifyCompanyPAN(
    pan: string, 
    companyName: string
  ): Promise<CashfreePANResponse> {
    const result = await this.verifyPAN(pan, companyName);
    
    // Additional check: ensure it's a Business/Company PAN
    if (result.verified && result.data?.type !== 'Business') {
      return {
        success: false,
        message: `This PAN belongs to an ${result.data?.type}, not a Business entity`,
        verified: false
      };
    }
    
    return result;
  }
  
  /**
   * Get PAN verification status by reference ID
   * Useful for async verification or checking historical verifications
   * 
   * @param referenceId - Reference ID returned from initial verification
   */
  static async getVerificationStatus(referenceId: number): Promise<CashfreePANResponse> {
    try {
      const response = await axios.get(
        `${this.getBaseUrl()}/pan/${referenceId}`,
        { headers: this.getHeaders() }
      );
      
      if (response.data && response.data.valid === true) {
        // Normalize type to TitleCase for consistency (Cashfree returns "INDIVIDUAL"/"BUSINESS")
        const normalizedType = response.data.type === 'INDIVIDUAL' ? 'Individual' : 
                               response.data.type === 'BUSINESS' ? 'Business' : 
                               response.data.type;
        
        return {
          success: true,
          message: "PAN verification status retrieved successfully",
          verified: true,
          data: {
            pan: response.data.pan,
            type: normalizedType as 'Individual' | 'Business',
            registeredName: response.data.registered_name,
            nameProvided: response.data.name_provided,
            nameMatchScore: response.data.name_match_score || 0,
            nameMatchResult: response.data.name_match_result || 'NO_MATCH',
            aadhaarSeedingStatus: response.data.aadhaar_seeding_status,
            aadhaarSeedingStatusDesc: response.data.aadhaar_seeding_status_desc,
            panStatus: response.data.pan_status,
            lastUpdatedAt: response.data.last_updated_at,
            referenceId: response.data.reference_id
          }
        };
      }
      
      return {
        success: false,
        message: "Verification record not found or invalid",
        verified: false
      };
      
    } catch (error: any) {
      console.error('Cashfree PAN status retrieval error:', error.response?.data || error.message);
      
      return {
        success: false,
        message: "Failed to retrieve verification status",
        verified: false
      };
    }
  }
  
  /**
   * Check if any Cashfree verification credentials are configured.
   * Prefers CASHFREE_VERIFICATION_APP_ID/SECRET (Secure ID product),
   * falls back to CASHFREE_APP_ID/SECRET_KEY (Payment Gateway product).
   */
  static isConfigured(): boolean {
    return CashfreePANService.hasVerificationCredentials();
  }
}
