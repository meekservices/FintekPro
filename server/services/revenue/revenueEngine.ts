import { logger } from '../../../logger';

export class RevenueEngine {
  
  /**
   * Tracks and records revenue events generated from MPAL routing.
   * Hardcoding initial logic based on provider and product type.
   */
  async recordRevenueEvent(event: {
    userId: string;
    providerId: string;
    domain: 'INVESTMENT' | 'CREDIT';
    productType?: string;
    transactionValue: number;
  }) {
    logger.info(`[RevenueEngine] Processing revenue event for provider ${event.providerId}`);

    let estimatedRevenue = 0;

    if (event.domain === 'INVESTMENT') {
      estimatedRevenue = this.calculateInvestmentRevenue(event.providerId, event.transactionValue);
    } else if (event.domain === 'CREDIT') {
      estimatedRevenue = this.calculateCreditRevenue(event.providerId, event.productType, event.transactionValue);
    }

    logger.info(`[RevenueEngine] Estimated Revenue: $${estimatedRevenue}`);
    // Future: Insert into a `revenue_logs` table
  }

  private calculateInvestmentRevenue(providerId: string, value: number): number {
    switch(providerId) {
      case 'IRIS': 
        return value * 0.005; // 0.5% assumed trail commission
      case 'IIFL':
        return value * 0.001; // Brokerage share
      case 'ALPACA':
        return value * 0.002; // Order flow rebates / spreads
      default:
        return 0;
    }
  }

  private calculateCreditRevenue(providerId: string, productType: string | undefined, loanAmount: number): number {
    if (productType === 'CREDIT_CARD') {
      return 1500; // Flat INR 1500 per card acquisition
    } else if (productType === 'PERSONAL_LOAN') {
      return loanAmount * 0.015; // 1.5% sourcing commission
    } else if (productType === 'HOME_LOAN') {
      return loanAmount * 0.004; // 0.4% sourcing commission
    }
    return 0;
  }
}

export const revenueEngine = new RevenueEngine();
