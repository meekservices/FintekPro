import { logger } from '../../logger';
import { portfolioAggregator } from '../portfolio/portfolioAggregator';
import { db } from '../../db';
import { creditApplications, creditProducts } from '../../../shared/schema/mpal';
import { eq, and, sql, sum } from 'drizzle-orm';

export class FinancialProfileEngine {

  /**
   * Combines Investments (Portfolio) and Credit (Loans/Cards) into a Unified Financial Profile.
   */
  async buildProfile(userId: string) {
    logger.info(`[FinancialProfileEngine] Building unified profile for user ${userId}`);

    // 1. Fetch unified investments
    let totalValue = 0;
    let positions: any[] = [];
    
    try {
      const unifiedData = await portfolioAggregator.getUnifiedPortfolio(userId, ""); 
      
      if (unifiedData && unifiedData.summary) {
        totalValue = unifiedData.summary.totalValueInr;
        positions = unifiedData.holdings;
      }
    } catch (e) {
      logger.warn(`[FinancialProfileEngine] Could not fetch investment data: ${e}`);
    }

    // 2. Fetch actual credit liabilities from DB
    const liabilities = await this.fetchActualLiabilities(userId);
    const creditUtilization = this.calculateUtilization(liabilities);

    const netWorth = totalValue - liabilities.totalOutstanding;

    // 3. Update the user's financial profile record (optional/background)
    // We could persist this back to the `financial_profiles` table here if needed.

    return {
      userId,
      netWorth,
      totalAssets: totalValue,
      totalLiabilities: liabilities.totalOutstanding,
      creditUtilization,
      investmentAllocation: {
        totalValue,
        positions
      }
    };
  }

  private async fetchActualLiabilities(userId: string) {
    try {
      // Sum requested amounts for applications that are 'APPROVED' or 'DISBURSED'
      const activeLoans = await db
        .select({
          totalAmount: sum(creditApplications.amountRequested)
        })
        .from(creditApplications)
        .where(
          and(
            eq(creditApplications.userId, userId),
            sql`${creditApplications.status} IN ('APPROVED', 'DISBURSED')`
          )
        );

      const totalOutstanding = Number(activeLoans[0]?.totalAmount || 0);

      // In a real system, we'd also fetch credit limits. For now, we'll use a dynamic logic.
      // If no limit exists, we assume a baseline for utilization calculation.
      return {
        totalOutstanding,
        totalLimit: totalOutstanding > 0 ? totalOutstanding * 2 : 500000 // Placeholder logic for limit
      };
    } catch (error) {
      logger.error(`[FinancialProfileEngine] Error fetching live liabilities`, error);
      return { totalOutstanding: 0, totalLimit: 0 };
    }
  }

  private calculateUtilization(liabilities: any) {
    if (!liabilities.totalLimit || liabilities.totalLimit === 0) return 0;
    return (liabilities.totalOutstanding / liabilities.totalLimit) * 100;
  }
}

export const financialProfileEngine = new FinancialProfileEngine();
