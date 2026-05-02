import { logger } from '../../../logger';
import { portfolioAggregator } from '../portfolio/portfolioAggregator';

export class FinancialProfileEngine {

  /**
   * Combines Investments (Portfolio) and Credit (Loans/Cards) into a Unified Financial Profile.
   * This is the true power feature of FintekPro.
   */
  async buildProfile(userId: string) {
    logger.info(`[FinancialProfileEngine] Building unified profile for user ${userId}`);

    // 1. Fetch unified investments (India + US via MPAL/PortfolioAggregator)
    let investmentData = { totalValue: 0, positions: [] };
    try {
      investmentData = await portfolioAggregator.getUnifiedPortfolio(userId);
    } catch (e) {
      logger.warn(`[FinancialProfileEngine] Could not fetch investment data: ${e}`);
    }

    // 2. Fetch existing credit liabilities (Loans/Cards)
    // This would typically query the `credit_applications` / `credit_products` tables.
    const liabilities = this.fetchMockLiabilities(userId);
    const creditUtilization = this.calculateUtilization(liabilities);

    const netWorth = investmentData.totalValue - liabilities.totalOutstanding;

    return {
      userId,
      netWorth,
      liabilities: liabilities.totalOutstanding,
      creditUtilization,
      investmentAllocation: {
        totalValue: investmentData.totalValue,
        positions: investmentData.positions
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
