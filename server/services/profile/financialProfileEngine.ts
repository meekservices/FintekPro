import { logger } from '../../../logger';
import { portfolioAggregator } from '../portfolio/portfolioAggregator';

export class FinancialProfileEngine {

  /**
   * Combines Investments (Portfolio) and Credit (Loans/Cards) into a Unified Financial Profile.
   * This is the true power feature of FintekPro.
   */
  async buildProfile(userId: number) {
    logger.info(`[FinancialProfileEngine] Building unified profile for user ${userId}`);

    // 1. Fetch unified investments (India + US via MPAL/PortfolioAggregator)
    let totalValue = 0;
    let positions: any[] = [];
    
    try {
      // In a production scenario, we would fetch the PAN from the user's profile database.
      // For this orchestration layer, we attempt to get it from the session/profile.
      const unifiedData = await portfolioAggregator.getUnifiedPortfolio(userId.toString(), ""); 
      
      if (unifiedData && unifiedData.summary) {
        totalValue = unifiedData.summary.totalValueInr;
        positions = unifiedData.holdings;
      }
    } catch (e) {
      logger.warn(`[FinancialProfileEngine] Could not fetch investment data: ${e}`);
    }

    // 2. Fetch existing credit liabilities (Loans/Cards)
    const liabilities = this.fetchMockLiabilities(userId.toString());
    const creditUtilization = this.calculateUtilization(liabilities);

    const netWorth = totalValue - liabilities.totalOutstanding;

    return {
      userId,
      netWorth,
      liabilities: liabilities.totalOutstanding,
      creditUtilization,
      investmentAllocation: {
        totalValue,
        positions
      }
    };
  }

  private fetchMockLiabilities(userId: string) {
    return {
      totalOutstanding: 250000,
      totalLimit: 1000000
    };
  }

  private calculateUtilization(liabilities: any) {
    if (liabilities.totalLimit === 0) return 0;
    return (liabilities.totalOutstanding / liabilities.totalLimit) * 100;
  }
}

export const financialProfileEngine = new FinancialProfileEngine();
