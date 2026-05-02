import { ICreditProvider, CreditApplication } from '../interfaces/ICreditProvider';
import { logger } from '../../../../logger';
import { financialProfileEngine } from '../../profile/financialProfileEngine';

export class CreditScoringEngine {
  
  /**
   * Scores the user against multiple providers to find the best match.
   * Leverages both external API mocks and internal Portfolio Brain.
   */
  async scoreProviders(providers: ICreditProvider[], app: CreditApplication) {
    logger.info(`[CreditScoringEngine] Scoring ${providers.length} providers for application ${app.userId}`);
    
    // 1. Fetch user's unified financial profile (Investments + Liabilities)
    const financialProfile = await financialProfileEngine.buildProfile(app.userId);

    // 2. Perform weighted logic scoring
    // Example: (Income * 0.4) + (PortfolioValue * 0.4) - (Liabilities * 0.2)
    // Note: In production, external CIBIL scores would be integrated here.
    const internalRiskScore = this.calculateRiskScore(financialProfile);

    // 3. Filter providers based on eligibility
    const eligibleProviders = [];
    let maxLoanAmount = 0;

    for (const provider of providers) {
      try {
        const eligibility = await provider.checkEligibility({ id: app.userId, riskScore: internalRiskScore });
        if (eligibility.isEligible) {
          eligibleProviders.push({
            providerId: provider.providerId,
            maxAmount: eligibility.maxAmount
          });
          if (eligibility.maxAmount > maxLoanAmount) {
            maxLoanAmount = eligibility.maxAmount;
          }
        }
      } catch (error) {
        logger.warn(`[CreditScoringEngine] Provider ${provider.providerId} failed eligibility check`);
      }
    }

    // Sort eligible providers (e.g. by highest amount or best interest rate if we fetched products)
    eligibleProviders.sort((a, b) => b.maxAmount - a.maxAmount);

    return {
      eligibleProviders,
      maxLoanAmount,
      riskScore: internalRiskScore
    };
  }

  private calculateRiskScore(profile: any): number {
    // Mock risk scoring logic leveraging portfolio assets
    const baseScore = 650;
    const portfolioBonus = Math.min((profile.investmentAllocation.totalValue / 10000) * 10, 100);
    const liabilityPenalty = Math.min((profile.liabilities / 5000) * 15, 150);
    
    return Math.floor(baseScore + portfolioBonus - liabilityPenalty);
  }
}

export const creditScoringEngine = new CreditScoringEngine();
