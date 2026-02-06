/**
 * AuthBridge CKYC API Service
 * 
 * Handles CKYC (Central KYC) data fetch via AuthBridge API
 * Used for KYC Level 2 upgrade
 */

import axios, { AxiosError } from 'axios';
import { AppError } from './utils/errors';

interface AuthBridgeCKYCRequest {
  pan: string;
  full_name: string;
  date_of_birth: string;
  aadhaar?: string;
}

interface AuthBridgeCKYCResponse {
  status: 'success' | 'failure';
  data?: {
    kin: string; // CKYC KIN (KYC Identification Number)
    full_name: string;
    pan: string;
    date_of_birth: string;
    gender: string;
    father_name?: string;
    mother_name?: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
    };
    mobile?: string;
    email?: string;
    kyc_type: 'Simplified' | 'Normal';
    kyc_date: string;
    photo_url?: string;
    signature_url?: string;
    documents?: Array<{
      type: string;
      number: string;
      verified: boolean;
    }>;
  };
  message?: string;
  error?: string;
}

class AuthBridgeCKYCService {
  private baseUrl: string;
  private apiKey: string;
  private clientId: string;
  private environment: 'sandbox' | 'production';

  // AuthBridge CKYC API URLs
  private static readonly SANDBOX_URL = 'https://sandbox.authbridge.com';
  private static readonly PRODUCTION_URL = 'https://api.authbridge.com';
  private static readonly CKYC_ENDPOINT = '/v1/ckyc/fetch';

  constructor() {
    // Environment auto-detection (similar to Cashfree pattern)
    // Priority: AUTHBRIDGE_ENVIRONMENT > NODE_ENV > default to sandbox
    const explicitEnv = process.env.AUTHBRIDGE_ENVIRONMENT;
    if (explicitEnv === 'production' || explicitEnv === 'PRODUCTION') {
      this.environment = 'production';
    } else if (explicitEnv === 'sandbox' || explicitEnv === 'SANDBOX') {
      this.environment = 'sandbox';
    } else {
      // Auto-detect based on NODE_ENV
      this.environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
    }

    // Set base URL based on environment (can be overridden via AUTHBRIDGE_BASE_URL)
    const defaultUrl = this.environment === 'production' 
      ? AuthBridgeCKYCService.PRODUCTION_URL 
      : AuthBridgeCKYCService.SANDBOX_URL;
    this.baseUrl = process.env.AUTHBRIDGE_BASE_URL || defaultUrl;
    
    this.apiKey = process.env.AUTHBRIDGE_API_KEY || '';
    this.clientId = process.env.AUTHBRIDGE_CLIENT_ID || '';

    if (!this.apiKey || !this.clientId) {
      console.log(`[AuthBridge CKYC API] Running in mock mode (no API credentials)`);
      console.log(`ℹ️ [AuthBridge CKYC API] Environment: ${this.environment} (auto-detected)`);
    } else {
      console.log(`✅ [AuthBridge CKYC API] Initialized in ${this.environment.toUpperCase()} mode`);
      console.log(`   Base URL: ${this.baseUrl}`);
    }
  }

  /**
   * Get current environment (sandbox or production)
   */
  getEnvironment(): string {
    return this.environment;
  }

  /**
   * Check if service is in mock mode (no credentials)
   */
  isInMockMode(): boolean {
    return !this.apiKey || !this.clientId;
  }

  /**
   * Fetch CKYC record via AuthBridge API
   */
  async fetchCKYC(request: AuthBridgeCKYCRequest): Promise<AuthBridgeCKYCResponse> {
    try {
      // Validate PAN format
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(request.pan)) {
        throw new AppError('Invalid PAN format', 400, 'INVALID_PAN_FORMAT');
      }

      // If no API credentials, use mock response for development
      if (!this.apiKey || !this.clientId) {
        return this.mockCKYCFetch(request);
      }

      // Real API call using the correct endpoint
      const response = await axios.post<AuthBridgeCKYCResponse>(
        `${this.baseUrl}${AuthBridgeCKYCService.CKYC_ENDPOINT}`,
        {
          pan: request.pan.toUpperCase(),
          full_name: request.full_name,
          date_of_birth: request.date_of_birth,
          aadhaar: request.aadhaar || undefined
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'x-api-version': '2.0',
            'x-client-id': this.clientId
          },
          timeout: 30000
        }
      );

      if (response.data.status === 'success' && response.data.data) {
        console.log('✅ [AuthBridge CKYC API] CKYC record found:', {
          pan: request.pan,
          kin: response.data.data.kin
        });
        return response.data;
      } else {
        console.log('ℹ️ [AuthBridge CKYC API] CKYC record not found for PAN:', request.pan);
        return {
          status: 'failure',
          message: 'CKYC record not found',
          error: 'CKYC_NOT_FOUND'
        };
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        const errorMessage = axiosError.response?.data?.message || axiosError.message;
        
        console.error('❌ [AuthBridge CKYC API] API Error:', {
          status: axiosError.response?.status,
          message: errorMessage,
          pan: request.pan
        });

        // Check if it's a "not found" error (treat as success with no data)
        if (axiosError.response?.status === 404 || errorMessage?.toLowerCase().includes('not found')) {
          return {
            status: 'failure',
            message: 'CKYC record not found',
            error: 'CKYC_NOT_FOUND'
          };
        }

        throw new AppError(
          `CKYC fetch API error: ${errorMessage}`,
          axiosError.response?.status || 500,
          'AUTHBRIDGE_API_ERROR'
        );
      }

      console.error('❌ [AuthBridge CKYC API] Unexpected error:', error);
      throw new AppError('Failed to fetch CKYC record', 500, 'CKYC_FETCH_ERROR');
    }
  }

  /**
   * Mock CKYC fetch for development/testing
   */
  private mockCKYCFetch(request: AuthBridgeCKYCRequest): AuthBridgeCKYCResponse {
    console.log('🔧 [AuthBridge CKYC API] Using mock CKYC fetch for:', request.pan);

    // Simulate different scenarios based on PAN pattern
    if (request.pan.startsWith('AAAAA') || request.pan.startsWith('ZZZZZ')) {
      // CKYC not found
      return {
        status: 'failure',
        message: 'CKYC record not found in database',
        error: 'CKYC_NOT_FOUND'
      };
    }

    // CKYC found (default)
    return {
      status: 'success',
      data: {
        kin: `KIN${Date.now()}`, // Generate mock KIN
        full_name: request.full_name,
        pan: request.pan,
        date_of_birth: request.date_of_birth,
        gender: 'M',
        father_name: 'Mock Father Name',
        mother_name: 'Mock Mother Name',
        address: {
          line1: '123 Mock Street',
          line2: 'Mock Area',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India'
        },
        mobile: '9876543210',
        email: request.full_name.toLowerCase().replace(/\s+/g, '.') + '@example.com',
        kyc_type: 'Normal',
        kyc_date: new Date().toISOString().split('T')[0],
        photo_url: undefined,
        signature_url: undefined,
        documents: [
          {
            type: 'PAN',
            number: request.pan,
            verified: true
          },
          {
            type: 'Aadhaar',
            number: request.aadhaar || 'XXXX-XXXX-1234',
            verified: !!request.aadhaar
          }
        ]
      }
    };
  }

  /**
   * Verify if CKYC record exists for given PAN
   */
  async ckycExists(pan: string): Promise<boolean> {
    try {
      const response = await this.fetchCKYC({
        pan,
        full_name: 'Check',
        date_of_birth: '01/01/1990'
      });
      
      return response.status === 'success' && !!response.data;
    } catch (error) {
      console.error('❌ [AuthBridge CKYC API] CKYC existence check failed:', error);
      return false;
    }
  }

  /**
   * Extract CKYC data for profile update
   */
  extractProfileData(ckycData: AuthBridgeCKYCResponse['data']) {
    if (!ckycData) return null;

    return {
      fullName: ckycData.full_name,
      pan: ckycData.pan,
      dateOfBirth: ckycData.date_of_birth,
      gender: ckycData.gender,
      fatherName: ckycData.father_name,
      motherName: ckycData.mother_name,
      address: ckycData.address.line1 + (ckycData.address.line2 ? ', ' + ckycData.address.line2 : ''),
      city: ckycData.address.city,
      state: ckycData.address.state,
      pincode: ckycData.address.pincode,
      country: ckycData.address.country,
      mobile: ckycData.mobile,
      email: ckycData.email,
      ckycKin: ckycData.kin,
      ckycType: ckycData.kyc_type,
      ckycDate: ckycData.kyc_date
    };
  }
}

// Export singleton instance
export const authBridgeCKYCService = new AuthBridgeCKYCService();
export type { AuthBridgeCKYCResponse, AuthBridgeCKYCRequest };
