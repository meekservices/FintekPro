/**
 * TruthScreen CKYC Provider Adapter
 * Wraps existing TruthScreen integration for CKYC verification
 */

import type { ICkycProviderAdapter, CkycVerificationRequest, CkycVerificationResult, CkycProviderHealth } from '../ckyc-provider-adapter';

export class TruthScreenCkycAdapter implements ICkycProviderAdapter {
  readonly providerCode = 'truthscreen';
  readonly providerName = 'TruthScreen CKYC API';
  
  private username: string;
  private password: string;
  private baseUrl: string;
  
  constructor() {
    this.username = process.env.TRUTHSCREEN_USERNAME || '';
    this.password = process.env.TRUTHSCREEN_PASSWORD || '';
    this.baseUrl = process.env.TRUTHSCREEN_BASE_URL || 'https://www.truthscreen.com';
  }
  
  isConfigured(): boolean {
    return !!(this.username && this.password);
  }
  
  isInMockMode(): boolean {
    return !this.isConfigured();
  }
  
  async verify(request: CkycVerificationRequest): Promise<CkycVerificationResult> {
    const startTime = Date.now();
    
    try {
      if (this.isInMockMode()) {
        return this.mockVerification(request, startTime);
      }
      
      const axios = (await import('axios')).default;
      
      const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      
      const response = await axios.post(
        `${this.baseUrl}/Ckyc/api/ckyc-status`,
        {
          pan: request.panNumber.toUpperCase(),
          name: request.fullName,
          dob: request.dateOfBirth
        },
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      const responseTimeMs = Date.now() - startTime;
      
      if (response.data?.status === 'success' && response.data?.data?.kin) {
        const data = response.data.data;
        return {
          success: true,
          found: true,
          provider: this.providerCode,
          kin: data.kin,
          status: 'active',
          verificationLevel: data.kyc_type?.toLowerCase() === 'simplified' ? 'simplified' : 'normal',
          data: {
            fullName: data.full_name || data.name || request.fullName,
            fatherName: data.father_name,
            motherName: data.mother_name,
            dateOfBirth: data.dob || request.dateOfBirth,
            gender: data.gender || 'Unknown',
            address: {
              line1: data.address?.line1 || data.address || '',
              line2: data.address?.line2,
              city: data.address?.city || data.city || '',
              state: data.address?.state || data.state || '',
              pincode: data.address?.pincode || data.pincode || '',
              country: data.address?.country || 'India'
            },
            mobile: data.mobile,
            email: data.email,
            kycDate: data.kyc_date
          },
          responseTimeMs,
          message: 'CKYC record found via TruthScreen'
        };
      }
      
      return {
        success: true,
        found: false,
        provider: this.providerCode,
        status: 'not_found',
        responseTimeMs,
        message: response.data?.message || 'CKYC record not found'
      };
      
    } catch (error: any) {
      const responseTimeMs = Date.now() - startTime;
      
      if (error.response?.status === 404 || error.response?.data?.status === 'not_found') {
        return {
          success: true,
          found: false,
          provider: this.providerCode,
          status: 'not_found',
          responseTimeMs,
          message: 'CKYC record not found'
        };
      }
      
      return {
        success: false,
        found: false,
        provider: this.providerCode,
        responseTimeMs,
        message: error.message || 'TruthScreen API error',
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
        errorMessage: 'Mock mode - no credentials configured'
      };
    }
    
    try {
      const axios = (await import('axios')).default;
      const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      
      await axios.get(`${this.baseUrl}/health`, {
        headers: { 'Authorization': `Basic ${credentials}` },
        timeout: 5000
      });
      
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
    const mockKin = `KIN${request.panNumber.substring(0, 5)}${Date.now().toString().slice(-6)}`;
    
    return {
      success: true,
      found: true,
      provider: this.providerCode,
      kin: mockKin,
      status: 'active',
      verificationLevel: 'normal',
      data: {
        fullName: request.fullName,
        dateOfBirth: request.dateOfBirth,
        gender: 'Unknown',
        address: {
          line1: 'Mock Address Line 1',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          country: 'India'
        },
        mobile: request.mobileNumber,
        email: request.emailAddress
      },
      responseTimeMs: Date.now() - startTime,
      message: '[MOCK] CKYC record found via TruthScreen'
    };
  }
}
