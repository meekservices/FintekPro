import { logger } from '../../logger';
// We import the existing robust Alpaca broker service
import { alpacaBrokerService } from '../alpaca-broker-service';

export class AlpacaClient {
  
  /**
   * Fetches open positions for a given Alpaca account
   */
  async getPositions(accountId: string) {
    try {
      logger.info(`[AlpacaClient] Fetching positions for account ${accountId}`);
      // The existing service requires an account ID for broker API
      // If the user's token is used, it might be different, but we assume Broker API for now.
      const positions = await alpacaBrokerService.getPositions(accountId);
      return positions;
    } catch (error: any) {
      logger.error(`[AlpacaClient] Failed to fetch positions`, { error: error.message });
      throw error;
    }
  }

  /**
   * Fetch account details
   */
  async getAccount(accountId: string) {
    try {
      return await alpacaBrokerService.getAccount(accountId);
    } catch (error: any) {
      logger.error(`[AlpacaClient] Failed to fetch account`, { error: error.message });
      throw error;
    }
  }
}

export const alpacaClient = new AlpacaClient();
