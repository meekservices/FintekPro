import { logger } from '../../logger';
import { db } from '../../db';
import { KycCentralHubService } from '../kyc-central-hub-service';
import { getAdapter as ckycProviderAdapter } from '../ckyc-provider-adapter';

const kycCentralHubService = new KycCentralHubService();

export class KycEngine {
  
  /**
   * Orchestrates the KYC fetching process
   */
  async processKyc(userId: string, pan: string, dob: string) {
    logger.info(`[KycEngine] Starting KYC orchestration for user ${userId}`);
    
    try {
      // 1. Verify PAN format
      if (!this.isValidPan(pan)) {
        throw new Error('Invalid PAN format');
      }

      // 2. Fetch CKYC status
      logger.debug(`[KycEngine] Fetching CKYC status for ${pan}`);
      const ckycResponse = await ckycProviderAdapter.searchCkycStatus({ pan, dob });
      
      let kycStatus = 'PENDING';
      let kycData = null;

      if (ckycResponse.success && ckycResponse.data) {
        kycStatus = 'VERIFIED';
        kycData = ckycResponse.data;
        logger.info(`[KycEngine] KYC verified via CKYC for user ${userId}`);
      } else {
        // Fallback to Digilocker (Placeholder)
        logger.info(`[KycEngine] CKYC failed, initiating Digilocker fallback for user ${userId}`);
        kycStatus = 'DIGILOCKER_PENDING';
      }

      // 3. Log to central hub
      await kycCentralHubService.recordVerification({
        userId,
        pan,
        status: kycStatus,
        provider: 'CKYC',
        rawResponse: kycData
      });

      return {
        success: true,
        status: kycStatus,
        data: kycData
      };

    } catch (error: any) {
      logger.error(`[KycEngine] KYC orchestration failed for user ${userId}`, { error: error.message });
      throw error;
    }
  }

  private isValidPan(pan: string): boolean {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  }
}

export const kycEngine = new KycEngine();
