import { alpacaClient } from '../core/alpacaClient';
import { logger } from '../../../logger';
import { db } from '../../../db';
import { users } from '../../../../shared/schema';
import { eq } from 'drizzle-orm';

export interface NormalizedPosition {
  symbol: string;
  qty: number;
  avg_price: number;
  current_price: number;
  market_value_usd: number;
  pnl_usd: number;
  pnl_pct: number;
  asset_class: 'US_STOCK';
}

export class AlpacaPortfolioSync {
  
  /**
   * Fetches raw Alpaca positions and normalizes them into a standard struct
   */
  async getNormalizedPositions(userId: string): Promise<NormalizedPosition[]> {
    logger.info(`[AlpacaPortfolioSync] Fetching positions for user ${userId}`);

    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userRecord || !userRecord.alpacaAccountId) {
      logger.info(`[AlpacaPortfolioSync] User ${userId} has no Alpaca account. Returning empty portfolio.`);
      return [];
    }

    try {
      const positions = await alpacaClient.getPositions(userRecord.alpacaAccountId);
      
      return positions.map((pos: any) => ({
        symbol: pos.symbol,
        qty: parseFloat(pos.qty),
        avg_price: parseFloat(pos.avg_entry_price),
        current_price: parseFloat(pos.current_price),
        market_value_usd: parseFloat(pos.market_value),
        pnl_usd: parseFloat(pos.unrealized_pl),
        pnl_pct: parseFloat(pos.unrealized_plpc) * 100, // convert to percentage
        asset_class: 'US_STOCK'
      }));
    } catch (error) {
      logger.error(`[AlpacaPortfolioSync] Failed to sync positions for ${userId}`, error);
      throw new Error('Failed to retrieve US Stock portfolio.');
    }
  }

  /**
   * Gets total account equity and cash available
   */
  async getAccountSummary(userId: string) {
    const userRecord = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userRecord || !userRecord.alpacaAccountId) {
      return { equity_usd: 0, cash_usd: 0, buying_power_usd: 0 };
    }

    try {
      const account = await alpacaClient.getAccount(userRecord.alpacaAccountId);
      return {
        equity_usd: parseFloat(account.equity),
        cash_usd: parseFloat(account.cash),
        buying_power_usd: parseFloat(account.buying_power)
      };
    } catch (error) {
      logger.error(`[AlpacaPortfolioSync] Failed to fetch account summary for ${userId}`, error);
      return { equity_usd: 0, cash_usd: 0, buying_power_usd: 0 };
    }
  }
}

export const alpacaPortfolioSync = new AlpacaPortfolioSync();
