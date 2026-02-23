/**
 * Sandbox.co.in CKYC Provider Adapter
 * Uses Sandbox.co.in PAN verification API for KYC status checks
 * Authentication: API Key + JWT token via OAuth
 */

import type { ICkycProviderAdapter, CkycVerificationRequest, CkycVerificationResult, CkycProviderHealth } from '../ckyc-provider-adapter';
import { getSandboxBaseUrl, getSandboxApiKey, getSandboxApiSecret } from '../../utils/sandbox-config';

export class SandboxCkycAdapter implements ICkycProviderAdapter {
  readonly providerCode = 'sandbox';
  readonly providerName = 'Sandbox.co.in KYC API';
  
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;
  
  constructor() {
    this.baseUrl = getSandboxBaseUrl();
    this.apiKey = getSandboxApiKey();
    this.apiSecret = getSandboxApiSecret();
  }
  
  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }
  
  isInMockMode(): boolean {
    return !this.isConfigured();
  }
  
  private async authenticate(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiry) {
      return this.cachedToken;
    }
    
    const axios = (await import('axios')).default;
    
    const response = await axios.post(
      `${this.baseUrl}/authenticate`,
      {},
      {
        headers: {
          'x-api-key': this.apiKey,
          'x-api-secret': this.apiSecret,
          'x-api-version': '1.0',
        },
      }
    );
    
    this.cachedToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in || 3600) * 1000 - 60000;
    
    return this.cachedToken!;
  }
  
  async verify(request: CkycVerificationRequest): Promise<CkycVerificationResult> {
    const startTime = Date.now();
    
    try {
      if (this.isInMockMode()) {
        return this.mockVerification(request, startTime);
      }
      
      const axios = (await import('axios')).default;
      const token = await this.authenticate();
      
      const dobParts = request.dateOfBirth.split('-');
      const formattedDob = dobParts.length === 3 
        ? `${dobParts[2]}/${dobParts[1]}/${dobParts[0]}` 
        : request.dateOfBirth;
      
      const response = await axios.post(
        `${this.baseUrl}/kyc/pan/verify`,
        {
          '@entity': 'in.co.sandbox.kyc.pan_verification.request',
          pan: request.panNumber.toUpperCase(),
          name_as_per_pan: request.fullName,
          date_of_birth: formattedDob,
          consent: 'Y',
          reason: 'CKYC verification',
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'authorization': token,
            'x-api-version': '1.0',
            'Content-Type': 'application/json',
            'X-Accept-Cache': 'true',
          },
          timeout: 30000,
        }
      );
      
      const responseTimeMs = Date.now() - startTime;
      const data = response.data?.data;
      
      if (response.data?.code === 200 && data) {
        const isValid = data.status === 'valid' || data.status === 'VALID';
        const nameMatch = data.name_as_per_pan_match === true || data.name_match === true;
        const dobMatch = data.date_of_birth_match === true || data.dob_match === true;
        
        return {
          success: true,
          found: isValid,
          provider: this.providerCode,
          kin: data.aadhaar_seeding_status === 'y' ? `PAN-${request.panNumber.toUpperCase()}` : undefined,
          status: isValid ? 'active' : 'not_found',
          verificationLevel: 'normal',
          data: {
            fullName: data.name_as_per_pan || data.name || request.fullName,
            dateOfBirth: request.dateOfBirth,
            gender: 'Unknown',
            address: {
              line1: '',
              city: '',
              state: '',
              pincode: '',
              country: 'India'
            },
          },
          responseTimeMs,
          message: isValid 
            ? `PAN verified via Sandbox (Name match: ${nameMatch ? 'Yes' : 'No'}, DOB match: ${dobMatch ? 'Yes' : 'No'}, Aadhaar seeded: ${data.aadhaar_seeding_status || 'unknown'})`
            : `PAN not valid: ${data.remarks || 'Unknown reason'}`
        };
      }
      
      return {
        success: true,
        found: false,
        provider: this.providerCode,
        status: 'not_found',
        responseTimeMs,
        message: response.data?.message || 'PAN verification returned no match'
      };
      
    } catch (error: any) {
      const responseTimeMs = Date.now() - startTime;
      
      console.error('[Sandbox CKYC] Verification error:', error.message);
      if (error.response?.data) {
        console.error('[Sandbox CKYC] Response:', JSON.stringify(error.response.data).substring(0, 500));
      }
      
      return {
        success: false,
        found: false,
        provider: this.providerCode,
        responseTimeMs,
        message: error.response?.data?.message || error.message || 'Sandbox API error',
        errorCode: error.response?.status?.toString() || 'UNKNOWN_ERROR'
      };
    }
  }
  
  async checkHealth(): Promise<CkycProviderHealth> {
    const startTime = Date.now();
    
    if (this.isInMockMode()) {
      return {
        provider: this.providerCode,
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        errorMessage: 'Mock mode - no API credentials configured'
      };
    }
    
    try {
      await this.authenticate();
      
      return {
        provider: this.providerCode,
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date()
      };
    } catch (error: any) {
      return {
        provider: this.providerCode,
        healthy: false,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        errorMessage: error.message
      };
    }
  }
  
  private mockVerification(request: CkycVerificationRequest, startTime: number): CkycVerificationResult {
    return {
      success: true,
      found: true,
      provider: this.providerCode,
      kin: `PAN-${request.panNumber.toUpperCase()}`,
      status: 'active',
      verificationLevel: 'normal',
      data: {
        fullName: request.fullName,
        dateOfBirth: request.dateOfBirth,
        gender: 'Unknown',
        address: {
          line1: 'Mock Address',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India'
        },
        mobile: request.mobileNumber,
        email: request.emailAddress
      },
      responseTimeMs: Date.now() - startTime,
      message: '[MOCK] PAN verified via Sandbox'
    };
  }
}
