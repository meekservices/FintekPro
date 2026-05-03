import { logger } from '../../../logger';
import { alpacaClient } from '../core/alpacaClient';

export class AlpacaFixedIncomeService {

  /**
   * Fetches available US Treasuries.
   */
  async getUSTreasuries() {
    try {
      return await alpacaClient.call('/v1/assets/fixed_income/us_treasuries', 'GET');
    } catch (error: any) {
      logger.error(`[AlpacaFixedIncomeService] Failed to fetch US Treasuries`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Fetches available US Corporate Bonds.
   */
  async getUSCorporates() {
    try {
      return await alpacaClient.call('/v1/assets/fixed_income/us_corporates', 'GET');
    } catch (error: any) {
      logger.error(`[AlpacaFixedIncomeService] Failed to fetch US Corporates`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Validates if a bond order meets the $1,000 minimum face value and increment.
   */
  validateBondOrder(qty: number) {
    if (qty < 1000) {
      throw new Error('Fixed Income orders require a minimum face value of $1,000.');
    }
    if (qty % 1000 !== 0) {
      throw new Error('Fixed Income orders must be in increments of $1,000 face value.');
    }
    return true;
  }
}

export const alpacaFixedIncomeService = new AlpacaFixedIncomeService();
