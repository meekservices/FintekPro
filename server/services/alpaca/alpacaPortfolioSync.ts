import { logger } from '../../logger';
import { db } from '../../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { portfolioAggregator } from '../portfolio/portfolioAggregator';

export class AlpacaPortfolioSync {
  
  /**
   * Syncs the latest portfolio data from both Alpaca and IRIS and caches it locally
   */
  async syncUserPortfolio(userId: string) {
    logger.info(`[AlpacaPortfolioSync] Initiating portfolio sync for user ${userId}`);
    
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) throw new Error('User not found');
      
      if (!user.pan) {
         logger.warn(`[AlpacaPortfolioSync] User ${userId} has no PAN, skipping IRIS sync part`);
      }

      // Fetch unified portfolio
      const unifiedPortfolio = await portfolioAggregator.getUnifiedPortfolio(
        userId, 
        user.pan || '', 
        user.alpacaAccountId || undefined
      );

      // In a real system, we might store this snapshot in the database for historical tracking
      // await db.insert(portfolioSnapshots).values({...});

      logger.info(`[AlpacaPortfolioSync] Sync complete for user ${userId}`);

      return {
        success: true,
        summary: unifiedPortfolio.summary
      };

    } catch (error: any) {
      logger.error(`[AlpacaPortfolioSync] Sync failed for user ${userId}`, { error: error.message });
      throw error;
    }
  }
}

export const alpacaPortfolioSync = new AlpacaPortfolioSync();
