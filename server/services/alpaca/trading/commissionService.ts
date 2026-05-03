import { db } from '../../../db';
import { alpacaCommissionConfigs } from '../../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import BigNumber from 'bignumber.js';

export class AlpacaCommissionService {

  /**
   * Calculates the commission for a given order.
   * Logic: Omnibus accounts usually have higher platform fees vs BD accounts.
   */
  async calculateCommission(accountType: string, assetClass: string, amount: number) {
    const config = await db.query.alpacaCommissionConfigs.findFirst({
      where: and(
        eq(alpacaCommissionConfigs.accountType, accountType),
        eq(alpacaCommissionConfigs.assetClass, assetClass),
        eq(alpacaCommissionConfigs.isActive, true)
      )
    });

    if (!config) {
      // Default fallback if no config exists
      return 0;
    }

    let commission = new BigNumber(0);

    if (config.commissionType === 'percentage') {
      commission = new BigNumber(amount).times(config.commissionRate).dividedBy(100);
    } else {
      commission = new BigNumber(config.commissionRate);
    }

    // Apply minimum commission constraint
    const minComm = new BigNumber(config.minCommission || 0);
    if (commission.lt(minComm)) {
      commission = minComm;
    }

    return commission.toNumber();
  }
}

export const alpacaCommissionService = new AlpacaCommissionService();
