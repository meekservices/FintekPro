/**
 * Offline Aadhaar CKYC Provider Adapter
 * Uses Aadhaar XML verification for CKYC compliance
 */

import type { ICkycProviderAdapter, CkycVerificationRequest, CkycVerificationResult, CkycProviderHealth } from '../ckyc-provider-adapter';

export class OfflineAadhaarCkycAdapter implements ICkycProviderAdapter {
  readonly providerCode = 'offline_aadhaar';
  readonly providerName = 'Aadhaar Offline XML';
  
  isConfigured(): boolean {
    return true;
  }
  
  isInMockMode(): boolean {
    return false;
  }
  
  async verify(request: CkycVerificationRequest): Promise<CkycVerificationResult> {
    const startTime = Date.now();
    
    if (!request.aadhaarNumber) {
      return {
        success: false,
        found: false,
        provider: this.providerCode,
        responseTimeMs: Date.now() - startTime,
        message: 'Aadhaar number required for offline verification',
        errorCode: 'AADHAAR_REQUIRED'
      };
    }
    
    return {
      success: true,
      found: false,
      provider: this.providerCode,
      status: 'pending',
      responseTimeMs: Date.now() - startTime,
      message: 'Offline Aadhaar verification requires XML upload - redirect to upload flow'
    };
  }
  
  async checkHealth(): Promise<CkycProviderHealth> {
    return {
      provider: this.providerCode,
      healthy: true,
      latencyMs: 0,
      lastChecked: new Date()
    };
  }
}
