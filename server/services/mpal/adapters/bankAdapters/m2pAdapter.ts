import { ICreditProvider, CreditProduct, CreditApplication } from '../../interfaces/ICreditProvider';
import { logger } from '../../../../logger';

export class M2PAdapter implements ICreditProvider {
  public readonly providerId = 'M2P_AGGREGATOR';

  async fetchProducts(): Promise<CreditProduct[]> {
    logger.info(`[M2PAdapter] Fetching credit products`);
    return [];
  }

  async checkEligibility(user: any): Promise<any> {
    logger.info(`[M2PAdapter] Checking eligibility for user ${user.id}`);
    return { isEligible: true, maxAmount: 100000 };
  }

  async createApplication(app: CreditApplication): Promise<any> {
    logger.info(`[M2PAdapter] Submitting credit application to M2P`, app);
    return { ...app, status: 'SUBMITTED', providerRef: 'M2P_APP_789' };
  }

  async getApplicationStatus(appId: string): Promise<any> {
    logger.info(`[M2PAdapter] Fetching status for application ${appId}`);
    return { status: 'APPROVED' };
  }
}

export const m2pAdapter = new M2PAdapter();
