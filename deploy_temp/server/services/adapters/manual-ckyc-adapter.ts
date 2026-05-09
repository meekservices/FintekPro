/**
 * Manual CKYC Provider Adapter
 * Fallback provider for manual KYC document collection and processing
 * Always available as final fallback for compliance
 */

import type { ICkycProviderAdapter, CkycVerificationRequest, CkycVerificationResult, CkycProviderHealth } from '../ckyc-provider-adapter';

export class ManualCkycAdapter implements ICkycProviderAdapter {
  readonly providerCode = 'manual';
  readonly providerName = 'Manual CKYC';
  
  isConfigured(): boolean {
    return true;
  }
  
  isInMockMode(): boolean {
    return false;
  }
  
  async verify(request: CkycVerificationRequest): Promise<CkycVerificationResult> {
    const startTime = Date.now();
    
    return {
      success: true,
      found: false,
      provider: this.providerCode,
      status: 'pending',
      responseTimeMs: Date.now() - startTime,
      message: 'Manual KYC verification required - collect documents from user'
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
