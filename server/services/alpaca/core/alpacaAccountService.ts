import { alpacaClient } from './alpacaClient';
import { logger } from '../../../logger';

export class AlpacaAccountService {
  
  async getAccountDetails(alpacaAccountId: string) {
    try {
      const account = await alpacaClient.getAccount(alpacaAccountId);
      return account;
    } catch (error) {
      logger.error(`[AlpacaAccountService] Failed to fetch account ${alpacaAccountId}`, error);
      throw error;
    }
  }

  async checkAccountStatus(alpacaAccountId: string) {
    const account = await this.getAccountDetails(alpacaAccountId);
    return {
      status: account.status,
      kycStatus: account.kyc_status, // Only exists on specific models, often embedded in status
      cryptoStatus: account.crypto_status,
      buyingPower: parseFloat(account.buying_power),
      cash: parseFloat(account.cash),
      portfolioValue: parseFloat(account.portfolio_value)
    };
  }
}

export const alpacaAccountService = new AlpacaAccountService();
