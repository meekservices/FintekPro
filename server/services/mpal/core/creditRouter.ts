import { providerRegistry } from './providerRegistry';
import { CreditApplication } from '../interfaces/ICreditProvider';
import { creditScoringEngine } from './creditScoringEngine';
import { logger } from '../../../../logger';

export class CreditRouter {
  
  /**
   * Evaluates the application against all credit providers and routes to the best one.
   */
  async routeCreditApplication(app: CreditApplication): Promise<any> {
    const providers = providerRegistry.getAllCreditProviders();
    
    // Pass user ID to scoring engine to pull profile, income, liabilities, and portfolio
    const scoredOptions = await creditScoringEngine.scoreProviders(providers, app);

    if (scoredOptions.eligibleProviders.length === 0) {
      throw new Error(`Credit Routing Failed: User is not eligible for this product with any provider.`);
    }

    // Select the best provider (typically the first one if sorted by best rate/approval odds)
    const bestProviderId = scoredOptions.eligibleProviders[0].providerId;
    const bestProvider = providerRegistry.getCreditProvider(bestProviderId);

    logger.info(`[CreditRouter] Routing application for user ${app.userId} to ${bestProviderId}`);
    return bestProvider.createApplication(app);
  }
}

export const creditRouter = new CreditRouter();
