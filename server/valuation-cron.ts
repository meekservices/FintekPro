import cron from 'node-cron';
import { db } from './db';
import { 
  marketData, 
  portfolioHoldings, 
  comprehensiveHoldings,
  bondHoldings 
} from '@shared/schema';
import { eq, sql, inArray, isNull } from 'drizzle-orm';
import { logger } from './services/logger';
import yahooFinance from 'yahoo-finance2';

interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  currency: string;
}

export function initValuationCron() {
  cron.schedule('0 20 * * *', async () => {
    try {
      logger.info('[VALUATION-CRON] Starting daily portfolio valuation update at 8:00 PM IST');
      await runValuationUpdate();
      logger.info('[VALUATION-CRON] Daily valuation update completed successfully');
    } catch (error) {
      logger.error('[VALUATION-CRON] Error during valuation update:', error);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });
  
  logger.info('✅ Valuation cron job initialized (runs daily at 8:00 PM IST)');
}

async function runValuationUpdate() {
  const startTime = Date.now();
  
  const stats = {
    equityUpdates: 0,
    mutualFundUpdates: 0,
    bondUpdates: 0,
    errors: 0,
  };

  try {
    await updateEquityPrices(stats);
    
    await updateMutualFundNAVs(stats);
    
    await updateBondPrices(stats);
    
    await recalculateHoldingValues(stats);
    
    const duration = Date.now() - startTime;
    logger.info(`[VALUATION-CRON] Update complete in ${duration}ms`, stats);
    
  } catch (error) {
    logger.error('[VALUATION-CRON] Fatal error during valuation update:', error);
    throw error;
  }
}

async function updateEquityPrices(stats: { equityUpdates: number; errors: number }) {
  try {
    logger.info('[VALUATION-CRON] Fetching equity holdings for price update');
    
    const holdings = await db
      .select({ symbol: portfolioHoldings.symbol })
      .from(portfolioHoldings)
      .where(eq(portfolioHoldings.assetType, 'equity'))
      .groupBy(portfolioHoldings.symbol);
    
    if (holdings.length === 0) {
      logger.info('[VALUATION-CRON] No equity holdings found');
      return;
    }

    logger.info(`[VALUATION-CRON] Updating prices for ${holdings.length} equity symbols`);

    const batchSize = 10;
    for (let i = 0; i < holdings.length; i += batchSize) {
      const batch = holdings.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (holding) => {
          const maxRetries = 3;
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              const nsSymbol = `${holding.symbol}.NS`;
              
              const quote = await yahooFinance.quote(nsSymbol);
              
              if (quote && quote.regularMarketPrice) {
                const priceUpdate: PriceUpdate = {
                  symbol: holding.symbol,
                  price: quote.regularMarketPrice,
                  change: quote.regularMarketChange || 0,
                  changePercent: quote.regularMarketChangePercent || 0,
                  volume: quote.regularMarketVolume,
                  marketCap: quote.marketCap,
                  currency: quote.currency || 'INR',
                };

                await upsertMarketData(priceUpdate);
                stats.equityUpdates++;
                
                logger.info(`[VALUATION-CRON] Updated ${holding.symbol}: ₹${quote.regularMarketPrice}`);
                break;
              }
            } catch (error: any) {
              if (attempt < maxRetries) {
                logger.warn(`[VALUATION-CRON] Retry ${attempt}/${maxRetries} for ${holding.symbol}`);
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              } else {
                logger.error(`[VALUATION-CRON] Failed to update ${holding.symbol} after ${maxRetries} attempts:`, error.message);
                stats.errors++;
              }
            }
          }
        })
      );
      
      if (i + batchSize < holdings.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    logger.error('[VALUATION-CRON] Error in updateEquityPrices:', error);
    throw error;
  }
}

async function updateMutualFundNAVs(stats: { mutualFundUpdates: number; errors: number }) {
  try {
    logger.info('[VALUATION-CRON] Fetching mutual fund holdings for NAV update');
    
    const holdings = await db
      .select({ 
        symbol: portfolioHoldings.symbol,
        assetType: portfolioHoldings.assetType
      })
      .from(portfolioHoldings)
      .where(eq(portfolioHoldings.assetType, 'mf'))
      .groupBy(portfolioHoldings.symbol, portfolioHoldings.assetType);
    
    if (holdings.length === 0) {
      logger.info('[VALUATION-CRON] No mutual fund holdings found');
      return;
    }

    logger.info(`[VALUATION-CRON] Updating NAVs for ${holdings.length} mutual fund schemes`);

    for (const holding of holdings) {
      try {
        const navData = await fetchMutualFundNAV(holding.symbol);
        
        if (navData) {
          await upsertMarketData(navData);
          stats.mutualFundUpdates++;
          logger.info(`[VALUATION-CRON] Updated MF ${holding.symbol}: NAV ₹${navData.price}`);
        }
      } catch (error: any) {
        logger.error(`[VALUATION-CRON] Error updating MF ${holding.symbol}:`, error.message);
        stats.errors++;
      }
    }
  } catch (error) {
    logger.error('[VALUATION-CRON] Error in updateMutualFundNAVs:', error);
  }
}

async function updateBondPrices(stats: { bondUpdates: number; errors: number }) {
  try {
    logger.info('[VALUATION-CRON] Updating bond holdings');
    
    const bonds = await db
      .select()
      .from(bondHoldings)
      .where(eq(bondHoldings.holdingStatus, 'active'));
    
    if (bonds.length === 0) {
      logger.info('[VALUATION-CRON] No active bond holdings found');
      return;
    }

    logger.info(`[VALUATION-CRON] Updating ${bonds.length} bond holdings`);

    for (const bond of bonds) {
      try {
        const priceUpdate = await fetchBondPrice(bond.isin, bond.bondType);
        
        if (priceUpdate) {
          const currentValue = Number(bond.quantity) * priceUpdate.price;
          const unrealizedGainLoss = currentValue - Number(bond.totalInvestedAmount);
          
          await db
            .update(bondHoldings)
            .set({
              currentPrice: priceUpdate.price.toString(),
              currentValue: currentValue.toString(),
              unrealizedGainLoss: unrealizedGainLoss.toString(),
              lastUpdated: new Date(),
            })
            .where(eq(bondHoldings.id, bond.id));
          
          stats.bondUpdates++;
          logger.info(`[VALUATION-CRON] Updated bond ${bond.isin}: ₹${priceUpdate.price}`);
        } else {
          logger.warn(`[VALUATION-CRON] No price data available for bond ${bond.isin}`);
        }
      } catch (error: any) {
        logger.error(`[VALUATION-CRON] Error updating bond ${bond.isin}:`, error.message);
        stats.errors++;
      }
    }
  } catch (error) {
    logger.error('[VALUATION-CRON] Error in updateBondPrices:', error);
  }
}

async function recalculateHoldingValues(stats: any) {
  try {
    logger.info('[VALUATION-CRON] Recalculating comprehensive holding values');
    
    const holdings = await db
      .select()
      .from(comprehensiveHoldings)
      .where(isNull(comprehensiveHoldings.deletedAt));
    
    let updated = 0;
    
    for (const holding of holdings) {
      try {
        const marketDataRecord = await db.query.marketData.findFirst({
          where: eq(marketData.symbol, holding.symbol),
        });
        
        if (marketDataRecord && marketDataRecord.price) {
          const currentPrice = Number(marketDataRecord.price);
          const quantity = Number(holding.quantity || holding.units || 0);
          const marketValue = quantity * currentPrice;
          const investedValue = Number(holding.investedValue || 0);
          const gainLoss = marketValue - investedValue;
          const gainLossPercent = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;
          
          await db
            .update(comprehensiveHoldings)
            .set({
              currentPrice: currentPrice.toString(),
              marketValue: marketValue.toString(),
              gainLoss: gainLoss.toString(),
              gainLossPercent: gainLossPercent.toString(),
              lastUpdated: new Date(),
            })
            .where(eq(comprehensiveHoldings.id, holding.id));
          
          updated++;
        }
      } catch (error: any) {
        logger.error(`[VALUATION-CRON] Error updating comprehensive holding ${holding.id}:`, error.message);
        stats.errors++;
      }
    }
    
    logger.info(`[VALUATION-CRON] Updated ${updated} comprehensive holdings`);
  } catch (error) {
    logger.error('[VALUATION-CRON] Error in recalculateHoldingValues:', error);
  }
}

async function upsertMarketData(update: PriceUpdate) {
  const existing = await db.query.marketData.findFirst({
    where: eq(marketData.symbol, update.symbol),
  });
  
  if (existing) {
    await db
      .update(marketData)
      .set({
        price: update.price.toString(),
        change: update.change.toString(),
        changePercent: update.changePercent.toString(),
        volume: update.volume?.toString(),
        marketCap: update.marketCap?.toString(),
        currency: update.currency,
        lastUpdated: new Date(),
      })
      .where(eq(marketData.symbol, update.symbol));
  } else {
    await db.insert(marketData).values({
      symbol: update.symbol,
      price: update.price.toString(),
      change: update.change.toString(),
      changePercent: update.changePercent.toString(),
      volume: update.volume?.toString(),
      marketCap: update.marketCap?.toString(),
      currency: update.currency,
      lastUpdated: new Date(),
    });
  }
}

async function fetchMutualFundNAV(schemeCode: string, retries = 3): Promise<PriceUpdate | null> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
      
      if (!response.ok) {
        throw new Error(`MF API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.data && data.data.length > 0) {
        const latestNav = data.data[0];
        const price = parseFloat(latestNav.nav);
        
        let change = 0;
        let changePercent = 0;
        
        if (data.data.length > 1) {
          const previousNav = parseFloat(data.data[1].nav);
          change = price - previousNav;
          changePercent = (change / previousNav) * 100;
        }
        
        return {
          symbol: schemeCode,
          price,
          change,
          changePercent,
          currency: 'INR',
        };
      }
      
      return null;
    } catch (error) {
      if (attempt < retries) {
        logger.warn(`[VALUATION-CRON] Retry ${attempt}/${retries} for MF ${schemeCode}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      } else {
        logger.error(`[VALUATION-CRON] Failed to fetch MF NAV for ${schemeCode} after ${retries} attempts:`, error);
        return null;
      }
    }
  }
  return null;
}

async function fetchBondPrice(isin: string, bondType: string): Promise<{ price: number } | null> {
  try {
    /**
     * TODO: Integrate real bond pricing APIs
     * - NSE NCB API for government securities (G-Secs, T-Bills)
     * - BSE Bond API for corporate bonds
     * - FIMMDA for reference yields and pricing curves
     * 
     * Current Limitation: Placeholder returns face value (100)
     * This maintains bond holdings in portfolio but doesn't reflect market valuation
     * Impact: unrealizedGainLoss remains zero, yield calculations unavailable
     * 
     * Priority: HIGH - Required for accurate portfolio valuations
     */
    
    logger.warn(`[VALUATION-CRON] Using placeholder pricing for bond ${isin} (type: ${bondType})`);
    
    if (bondType === 'government') {
      return { price: 100 };
    }
    
    if (bondType === 'corporate') {
      return { price: 100 };
    }
    
    return null;
  } catch (error) {
    logger.error(`[VALUATION-CRON] Error fetching bond price for ${isin}:`, error);
    return null;
  }
}
