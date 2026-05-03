import { logger } from '../../../logger';
import { alpacaClient } from '../core/alpacaClient';

export class AlpacaRebalancingService {

  /**
   * Creates a new portfolio for rebalancing.
   */
  async createPortfolio(name: string, assets: { symbol: string, percent: number }[]) {
    const payload = {
      name,
      assets: assets.map(a => ({
        symbol: a.symbol,
        percent: a.percent.toString()
      }))
    };

    try {
      const response = await alpacaClient.call('/rebalancing/portfolios', 'POST', payload);
      logger.info(`[AlpacaRebalancingService] Portfolio created: ${name}`);
      return response;
    } catch (error: any) {
      logger.error(`[AlpacaRebalancingService] Failed to create portfolio`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Subscribes an account to a portfolio.
   */
  async subscribeAccount(alpacaAccountId: string, portfolioId: string) {
    const payload = { portfolio_id: portfolioId };
    try {
      const response = await alpacaClient.call(`/rebalancing/accounts/${alpacaAccountId}/subscriptions`, 'POST', payload);
      logger.info(`[AlpacaRebalancingService] Account ${alpacaAccountId} subscribed to portfolio ${portfolioId}`);
      return response;
    } catch (error: any) {
      logger.error(`[AlpacaRebalancingService] Subscription failed`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Triggers a rebalance run for a specific account.
   */
  async triggerRebalance(alpacaAccountId: string) {
    try {
      const response = await alpacaClient.call(`/rebalancing/accounts/${alpacaAccountId}/runs`, 'POST', { type: 'full_rebalance' });
      logger.info(`[AlpacaRebalancingService] Rebalance triggered for ${alpacaAccountId}`);
      return response;
    } catch (error: any) {
      logger.error(`[AlpacaRebalancingService] Rebalance trigger failed`, error.response?.data || error.message);
      throw error;
    }
  }
}

export const alpacaRebalancingService = new AlpacaRebalancingService();
