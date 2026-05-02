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

  /**
   * Evaluates overall credit eligibility for the UI.
   */
  async scoreUser(userId: number) {
    const financialProfile = await financialProfileEngine.buildProfile(userId);
    const score = this.calculateRiskScore(financialProfile);
    
    // In a real system, these would be derived from the product catalog
    const riskTier = score > 750 ? "LOW" : score > 650 ? "MEDIUM" : "HIGH";
    
    return {
      score,
      riskTier,
      approvedAmount: score > 600 ? Math.floor(financialProfile.investmentAllocation.totalValue * 0.5) : 0,
      reasons: score > 700 ? ["Strong Portfolio", "Good Asset-to-Liability Ratio"] : ["Enhance portfolio diversity to increase score"],
      breakdown: {
        assetBackedScore: Math.floor(score * 0.4),
        liabilityScore: Math.floor(score * 0.3),
        kycScore: Math.floor(score * 0.3)
      }
    };
  }
}

export const creditScoringEngine = new CreditScoringEngine();
