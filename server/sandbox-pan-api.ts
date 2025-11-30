/**
 * Sandbox.co.in PAN Verification API Service
 * 
 * Handles PAN card verification via Sandbox.co.in API
 * Used for KYC Level 1 upgrade
 */

import axios, { AxiosError } from 'axios';
import { AppError } from './utils/errors';

interface SandboxPANRequest {
  pan: string;
  consent: 'Y' | 'N';
  reason: string;
}

interface SandboxPANResponse {
  status: 'success' | 'failure';
  data?: {
    pan_number: string;
    full_name: string;
    category: string;
    status: 'VALID' | 'INVALID' | 'NOT_FOUND';
    last_updated: string;
    name_on_card?: string;
    father_name?: string;
    date_of_birth?: string;
    masked_aadhaar?: string;
  };
  message?: string;
  error?: string;
}

class SandboxPANService {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.baseUrl = process.env.SANDBOX_BASE_URL || 'https://api.sandbox.co.in';
    this.apiKey = process.env.SANDBOX_API_KEY || '';
    this.apiSecret = process.env.SANDBOX_API_SECRET || '';

    if (!this.apiKey || !this.apiSecret) {
      console.warn('⚠️ [Sandbox PAN API] API credentials not configured. Using mock mode.');
    }
  }

  /**
   * Verify PAN card via Sandbox.co.in API
   */
  async verifyPAN(panNumber: string, fullName?: string, dateOfBirth?: string): Promise<SandboxPANResponse> {
    try {
      // Validate PAN format
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(panNumber)) {
        throw new AppError('Invalid PAN format. PAN must be in format: ABCDE1234F', 400, 'INVALID_PAN_FORMAT');
      }

      // If no API credentials, use mock response for development
      if (!this.apiKey || !this.apiSecret) {
        return this.mockPANVerification(panNumber, fullName);
      }

      // Real API call
      const requestPayload: SandboxPANRequest = {
        pan: panNumber.toUpperCase(),
        consent: 'Y',
        reason: 'KYC verification for financial services'
      };

      const response = await axios.post<SandboxPANResponse>(
        `${this.baseUrl}/pans/${panNumber}/verify`,
        requestPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'x-api-secret': this.apiSecret,
            'x-api-version': '1.0'
          },
          timeout: 30000
        }
      );

      if (response.data.status === 'success') {
        console.log('✅ [Sandbox PAN API] PAN verified successfully:', panNumber);
        return response.data;
      } else {
        console.error('❌ [Sandbox PAN API] PAN verification failed:', response.data.message);
        throw new AppError(
          response.data.message || 'PAN verification failed',
          400,
          'PAN_VERIFICATION_FAILED'
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        const errorMessage = axiosError.response?.data?.message || axiosError.message;
        
        console.error('❌ [Sandbox PAN API] API Error:', {
          status: axiosError.response?.status,
          message: errorMessage,
          pan: panNumber
        });

        throw new AppError(
          `PAN verification API error: ${errorMessage}`,
          axiosError.response?.status || 500,
          'SANDBOX_API_ERROR'
        );
      }

      console.error('❌ [Sandbox PAN API] Unexpected error:', error);
      throw new AppError('Failed to verify PAN', 500, 'PAN_VERIFICATION_ERROR');
    }
  }

  /**
   * Mock PAN verification for development/testing
   */
  private mockPANVerification(panNumber: string, fullName?: string): SandboxPANResponse {
    console.log('🔧 [Sandbox PAN API] Using mock PAN verification for:', panNumber);

    // Simulate different scenarios based on PAN pattern
    if (panNumber.startsWith('AAAAA')) {
      // Invalid PAN
      return {
        status: 'success',
        data: {
          pan_number: panNumber,
          full_name: fullName || 'Not Available',
          category: 'Individual',
          status: 'INVALID',
          last_updated: new Date().toISOString()
        }
      };
    }

    if (panNumber.startsWith('ZZZZZ')) {
      // Not found PAN
      return {
        status: 'failure',
        message: 'PAN not found in database',
        error: 'PAN_NOT_FOUND'
      };
    }

    // Valid PAN (default)
    return {
      status: 'success',
      data: {
        pan_number: panNumber,
        full_name: fullName || 'Mock User Name',
        category: 'Individual',
        status: 'VALID',
        last_updated: new Date().toISOString(),
        name_on_card: fullName || 'MOCK USER NAME',
        father_name: 'MOCK FATHER NAME',
        date_of_birth: undefined, // DOB not returned from PAN verification - CKYC is authoritative source
        masked_aadhaar: 'XXXX-XXXX-1234'
      }
    };
  }

  /**
   * Validate PAN and DOB match
   */
  async validatePANWithDOB(panNumber: string, dateOfBirth: string): Promise<boolean> {
    try {
      const response = await this.verifyPAN(panNumber);
      
      if (response.status === 'success' && response.data) {
        // Check if DOB matches (if available in response)
        if (response.data.date_of_birth) {
          // Normalize date formats for comparison
          const responseDOB = response.data.date_of_birth.replace(/\//g, '-');
          const providedDOB = dateOfBirth.replace(/\//g, '-');
          return responseDOB === providedDOB;
        }
        // If DOB not available in response, consider PAN valid
        return response.data.status === 'VALID';
      }
      
      return false;
    } catch (error) {
      console.error('❌ [Sandbox PAN API] DOB validation failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const sandboxPANService = new SandboxPANService();
export type { SandboxPANResponse, SandboxPANRequest };
