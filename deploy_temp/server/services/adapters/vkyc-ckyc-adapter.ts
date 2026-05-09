/**
 * Video KYC (V-KYC) Provider Adapter
 * For CKYC verification via video-based KYC process
 */

import type { ICkycProviderAdapter, CkycVerificationRequest, CkycVerificationResult, CkycProviderHealth } from '../ckyc-provider-adapter';

export class VkycCkycAdapter implements ICkycProviderAdapter {
  readonly providerCode = 'vkyc';
  readonly providerName = 'Video KYC (V-KYC)';
  
  private apiKey: string;
  private baseUrl: string;
  
  constructor() {
    this.apiKey = process.env.VKYC_API_KEY || '';
    this.baseUrl = process.env.VKYC_BASE_URL || '';
  }
  
  isConfigured(): boolean {
    return !!(this.apiKey && this.baseUrl);
  }
  
  isInMockMode(): boolean {
    return !this.isConfigured();
  }
  
  async verify(request: CkycVerificationRequest): Promise<CkycVerificationResult> {
    const startTime = Date.now();
    
    return {
      success: true,
      found: false,
      provider: this.providerCode,
      status: 'pending',
      responseTimeMs: Date.now() - startTime,
      message: 'V-KYC requires video call scheduling - redirect to V-KYC flow'
    };
  }
  
  async checkHealth(): Promise<CkycProviderHealth> {
    return {
      provider: this.providerCode,
      healthy: true,
      latencyMs: 0,
      lastChecked: new Date(),
      errorMessage: this.isInMockMode() ? 'V-KYC not configured' : undefined
    };
  }
}
