/**
 * Cashfree Aadhaar OTP Verification Service
 * 
 * Provides real Aadhaar verification using Cashfree's Offline Aadhaar (OKYC) API.
 * Two-step process: Generate OTP → Verify OTP
 * 
 * Documentation: https://docs.cashfree.com/v3/reference/aadhaar-okyc
 */

import axios from 'axios';

interface CashfreeOTPResponse {
  success: boolean;
  message: string;
  ref_id?: string;
  status?: string;
  maskedAadhaar?: string;
}

interface CashfreeVerificationResponse {
  success: boolean;
  message: string;
  verified: boolean;
  data?: {
    aadhaarNumber: string; // Verified Aadhaar number from UIDAI
    name: string;
    dob: string;
    gender: string;
    fatherName?: string;
    address: {
      house: string;
      street: string;
      landmark: string;
      locality: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
    };
    mobile?: string;
    email?: string;
    photoUrl?: string;
  };
}

export class CashfreeAadhaarService {
  private static readonly SANDBOX_URL = 'https://sandbox.cashfree.com/verification';
  private static readonly PRODUCTION_URL = 'https://api.cashfree.com/verification';
  
  private static isProduction(): boolean {
    if (process.env.CASHFREE_ENVIRONMENT) {
      return process.env.CASHFREE_ENVIRONMENT === 'PRODUCTION';
    }
    return process.env.NODE_ENV === 'production';
  }
  
  private static getBaseUrl(): string {
    return this.isProduction() ? this.PRODUCTION_URL : this.SANDBOX_URL;
  }
  
  static hasVerificationCredentials(): boolean {
    return !!(
      (process.env.CASHFREE_VERIFICATION_APP_ID && process.env.CASHFREE_VERIFICATION_SECRET_KEY) ||
      (process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY)
    );
  }

  private static getHeaders() {
    const appId = process.env.CASHFREE_VERIFICATION_APP_ID || process.env.CASHFREE_APP_ID || '';
    const secretKey = process.env.CASHFREE_VERIFICATION_SECRET_KEY || process.env.CASHFREE_SECRET_KEY || '';
    return {
      'Content-Type': 'application/json',
      'x-client-id': appId,
      'x-client-secret': secretKey
    };
  }
  
  /**
   * Step 1: Generate OTP for Aadhaar verification
   * OTP is sent to the mobile number linked with the Aadhaar
   */
  static async generateOTP(aadhaarNumber: string): Promise<CashfreeOTPResponse> {
    try {
      // Validate Aadhaar number format (12 digits)
      if (!/^\d{12}$/.test(aadhaarNumber)) {
        return {
          success: false,
          message: "Invalid Aadhaar number format. Must be 12 digits."
        };
      }
      
      const response = await axios.post(
        `${this.getBaseUrl()}/offline-aadhaar/otp`,
        { aadhaar_number: aadhaarNumber },
        { headers: this.getHeaders() }
      );
      
      if (response.data && response.data.ref_id) {
        // Mask Aadhaar number (show only last 4 digits)
        const maskedAadhaar = `XXXX XXXX ${aadhaarNumber.slice(-4)}`;
        
        return {
          success: true,
          message: `OTP sent successfully to registered mobile number ending with ${aadhaarNumber.slice(-4)}`,
          ref_id: response.data.ref_id,
          status: response.data.status || 'SUCCESS',
          maskedAadhaar
        };
      }
      
      return {
        success: false,
        message: response.data?.message || "Failed to send OTP"
      };
      
    } catch (error: any) {
      console.error('Cashfree Aadhaar OTP generation error:', error.response?.data || error.message);
      
      // Handle specific Cashfree error responses
      if (error.response?.data?.message) {
        return {
          success: false,
          message: error.response.data.message
        };
      }
      
      return {
        success: false,
        message: "Failed to generate OTP. Please try again."
      };
    }
  }
  
  /**
   * Step 2: Verify OTP and retrieve Aadhaar holder details
   * Returns comprehensive user information from UIDAI
   */
  static async verifyOTP(otp: string, refId: string): Promise<CashfreeVerificationResponse> {
    try {
      if (!otp || !refId) {
        return {
          success: false,
          message: "OTP and reference ID are required",
          verified: false
        };
      }
      
      const response = await axios.post(
        `${this.getBaseUrl()}/offline-aadhaar/verify`,
        { 
          otp: otp,
          ref_id: refId 
        },
        { headers: this.getHeaders() }
      );
      
      if (response.data && response.data.aadhaar_number) {
        // Map Cashfree response to our internal format
        const aadhaarData = response.data;
        
        return {
          success: true,
          message: "Aadhaar verified successfully",
          verified: true,
          data: {
            aadhaarNumber: aadhaarData.aadhaar_number, // CRITICAL: Use verified Aadhaar from UIDAI
            name: aadhaarData.full_name || aadhaarData.name || '',
            dob: aadhaarData.dob || aadhaarData.date_of_birth || '',
            gender: aadhaarData.gender || '',
            fatherName: aadhaarData.care_of || aadhaarData.father_name || '',
            address: {
              house: aadhaarData.house || aadhaarData.house_number || '',
              street: aadhaarData.street || aadhaarData.street_name || '',
              landmark: aadhaarData.landmark || '',
              locality: aadhaarData.locality || aadhaarData.location || '',
              city: aadhaarData.district || aadhaarData.city || '',
              state: aadhaarData.state || '',
              pincode: aadhaarData.pincode || aadhaarData.zip || '',
              country: aadhaarData.country || 'India'
            },
            mobile: aadhaarData.mobile_number || aadhaarData.mobile || '',
            email: aadhaarData.email_id || aadhaarData.email || '',
            photoUrl: aadhaarData.profile_image || aadhaarData.photo_link || ''
          }
        };
      }
      
      return {
        success: false,
        message: response.data?.message || "Invalid OTP or verification failed",
        verified: false
      };
      
    } catch (error: any) {
      console.error('Cashfree Aadhaar OTP verification error:', error.response?.data || error.message);
      
      // Handle specific error cases
      if (error.response?.data?.message) {
        const errorMsg = error.response.data.message;
        
        if (errorMsg.includes('OTP') || errorMsg.includes('otp')) {
          return {
            success: false,
            message: "Invalid OTP. Please check and try again.",
            verified: false
          };
        }
        
        if (errorMsg.includes('expired')) {
          return {
            success: false,
            message: "OTP has expired. Please request a new OTP.",
            verified: false
          };
        }
        
        return {
          success: false,
          message: errorMsg,
          verified: false
        };
      }
      
      return {
        success: false,
        message: "Failed to verify OTP. Please try again.",
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
    return CashfreeAadhaarService.hasVerificationCredentials();
  }
}
