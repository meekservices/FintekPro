import { logger } from '../../logger';
import { irisClient } from '../iris/irisClient';
import { alpacaPortfolioSync } from '../alpaca/portfolio/portfolioSync';
import { valuationEngine } from './valuationEngine';

export class PortfolioAggregator {
  
  /**
   * Aggregates portfolio data from both IRIS and Alpaca
   */
  async getUnifiedPortfolio(userId: string, pan: string, alpacaAccountId?: string) {
    logger.info(`[PortfolioAggregator] Building unified portfolio for user ${userId}`);

    try {
      // 1. Fetch data in parallel
      const fetchPromises = [
        this.fetchIrisPortfolio(pan),
        alpacaPortfolioSync.getNormalizedPositions(userId)
      ];

      const [irisData, alpacaData] = await Promise.allSettled(fetchPromises);

      const holdings = [];
      let totalValueInr = 0;
      let totalValueUsd = 0;

      // 2. Process IRIS Data (INR)
      if (irisData.status === 'fulfilled') {
        const normalizedIris = irisData.value.map((holding: any) => {
          const valueInr = holding.currentValue || 0;
          totalValueInr += valueInr;
          return {
            source: 'IRIS',
            assetClass: holding.assetClass || 'MUTUAL_FUND',
            name: holding.schemeName || holding.name,
            units: holding.units,
            currentValue: valueInr,
            currency: 'INR'
          };
        });
        holdings.push(...normalizedIris);
      } else {
        logger.error(`[PortfolioAggregator] Failed to fetch IRIS portfolio`, { error: irisData.reason });
      }

      // 3. Process Alpaca Data (USD)
      if (alpacaData.status === 'fulfilled' && alpacaData.value.length > 0) {
        const usdToInrRate = await valuationEngine.getExchangeRate('USD', 'INR');
        
        const normalizedAlpaca = alpacaData.value.map((holding: any) => {
          totalValueUsd += holding.market_value_usd;
          return {
            source: 'ALPACA',
            assetClass: 'US_STOCK',
            name: holding.symbol,
            units: holding.qty,
            currentValue: holding.market_value_usd, // Base currency
            currency: 'USD',
            currentValueInr: holding.market_value_usd * usdToInrRate // Converted for total view
          };
        });
        holdings.push(...normalizedAlpaca);
        
        // Add to total INR value
        totalValueInr += (totalValueUsd * usdToInrRate);
      } else if (userId && alpacaData.status === 'rejected') {
         logger.error(`[PortfolioAggregator] Failed to fetch Alpaca portfolio`, { error: alpacaData.reason });
      }

      // 4. Return Unified View
      return {
        success: true,
        summary: {
          totalValueInr,
          totalValueUsd,
          exchangeRate: await valuationEngine.getExchangeRate('USD', 'INR')
        },
        holdings
      };

    } catch (error: any) {
      logger.error(`[PortfolioAggregator] Failed to build unified portfolio`, { error: error.message });
      throw error;
    }
  }

  private async fetchIrisPortfolio(pan: string) {
    if (!pan) return [];
    try {
      const result = await irisClient.fetchPortfolio(pan);
      return result?.holdings || [];
    } catch (error) {
      logger.warn(`[PortfolioAggregator] IRIS fetch warning`, { error });
      return []; // Return empty instead of failing the whole aggregation
    }
  }

  private async fetchAlpacaPortfolio(accountId: string) {
    try {
      // We pass the userId to our sync service. Wait, the parameter here was accountId.
      // I'll adapt to fetch by userId since the sync service expects userId.
      return []; // This method will be deprecated since we call it directly with userId in fetchPromises.
    } catch (error) {
      logger.warn(`[PortfolioAggregator] Alpaca fetch warning`, { error });
      return [];
    }
  }
}

export const portfolioAggregator = new PortfolioAggregator();
