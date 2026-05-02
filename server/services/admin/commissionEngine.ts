import { logger } from '../../logger';

interface TradeData {
  agentId: string;
  amount: number;
  productClass: 'MUTUAL_FUND' | 'FIXED_DEPOSIT' | 'PMS' | 'AIF' | 'US_STOCK';
  tradeType: 'BUY' | 'SELL';
}

export class CommissionEngine {
  
  // Example commission structure (bps - basis points, 100 bps = 1%)
  private commissionRates = {
    MUTUAL_FUND: 50,    // 0.5%
    FIXED_DEPOSIT: 100, // 1%
    PMS: 200,           // 2%
    AIF: 250,           // 2.5%
    US_STOCK: 0         // Typically 0 for US Stocks in this model
  };

  /**
   * Calculates the commission for a given trade
   */
  calculateCommission(trade: TradeData): number {
    try {
      if (trade.tradeType === 'SELL') {
        return 0; // Usually no commission on redemptions, though this varies
      }

      const bps = this.commissionRates[trade.productClass] || 0;
      const commissionAmount = (trade.amount * bps) / 10000;
      
      logger.debug(`[CommissionEngine] Calculated commission`, { 
        agentId: trade.agentId, 
        product: trade.productClass, 
        amount: trade.amount,
        commission: commissionAmount 
      });

      return commissionAmount;

    } catch (error: any) {
      logger.error(`[CommissionEngine] Calculation failed`, { error: error.message });
      return 0;
    }
  }

  /**
   * Records a commission payout entry
   */
  async recordCommission(tradeId: string, trade: TradeData) {
    const commission = this.calculateCommission(trade);
    if (commission <= 0) return;

    logger.info(`[CommissionEngine] Recording commission payout for trade ${tradeId}`, { commission });
    // Database insert into a `commissions` ledger table goes here.
  }
}

export const commissionEngine = new CommissionEngine();
