import axios from 'axios';
import { db } from '../db';
import { commodities } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

interface CommodityPriceData {
  symbol: string;
  price: number;
  previousClose?: number;
  change?: number;
  changePercent?: number;
  high?: number;
  low?: number;
}

/**
 * Commodity Price Sync Scheduler
 * Updates commodity prices daily from Finnhub and Yahoo Finance.
 * Covers: Gold, Silver, Crude Oil, Natural Gas, Copper, etc.
 */
class CommodityPriceSyncScheduler {
  private syncIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
  private isRunning = false;
  private syncTimer: NodeJS.Timeout | null = null;
  
  // Commodity symbol mappings for different data sources
  private readonly FINNHUB_SYMBOLS: Record<string, string> = {
    'GOLD': 'OANDA:XAU_USD',
    'SILVER': 'OANDA:XAG_USD',
    'CRUDE_OIL': 'OANDA:WTICO_USD',
    'NATURAL_GAS': 'OANDA:NATGAS_USD',
    'COPPER': 'OANDA:XCU_USD',
    'PLATINUM': 'OANDA:XPT_USD',
    'PALLADIUM': 'OANDA:XPD_USD'
  };
  
  private readonly YAHOO_SYMBOLS: Record<string, string> = {
    'GOLD': 'GC=F',
    'SILVER': 'SI=F',
    'CRUDE_OIL': 'CL=F',
    'NATURAL_GAS': 'NG=F',
    'COPPER': 'HG=F',
    'PLATINUM': 'PL=F',
    'WHEAT': 'ZW=F',
    'CORN': 'ZC=F',
    'COTTON': 'CT=F',
    'COFFEE': 'KC=F'
  };

  constructor() {
    console.log('✅ Commodity Price Sync Scheduler initialized');
  }

  start(): void {
    if (this.isRunning) {
      console.log('[Commodity Sync] Scheduler already running');
      return;
    }

    this.isRunning = true;
    console.log('[Commodity Sync] Starting commodity price sync scheduler...');
    
    // Schedule daily price refresh at 8 AM IST (after PMS sync)
    this.scheduleNextSync();
    
    // Run startup catch-up in background
    setTimeout(async () => {
      try {
        await this.runStartupCatchUp();
      } catch (error) {
        console.error('[Commodity Sync] Startup catch-up failed:', error);
      }
    }, 25000); // Wait 25 seconds after server starts
    
    console.log('[Commodity Sync] Scheduler started');
  }

  stop(): void {
    this.isRunning = false;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    console.log('[Commodity Sync] Scheduler stopped');
  }

  private scheduleNextSync(): void {
    // Calculate time until 8 AM IST tomorrow
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffset);
    
    const next8AM = new Date(nowIST);
    next8AM.setHours(8, 0, 0, 0);
    if (nowIST.getHours() >= 8) {
      next8AM.setDate(next8AM.getDate() + 1);
    }
    
    const msUntilNext = next8AM.getTime() - nowIST.getTime();
    
    console.log(`[Commodity Sync] Next price sync scheduled in ${Math.round(msUntilNext / 1000 / 60)} minutes`);
    
    this.syncTimer = setTimeout(async () => {
      try {
        await this.runPriceRefresh();
      } catch (error) {
        console.error('[Commodity Sync] Price refresh failed:', error);
      }
      // Schedule next sync
      if (this.isRunning) {
        this.scheduleNextSync();
      }
    }, msUntilNext);
  }

  private async fetchYahooPrice(symbol: string): Promise<CommodityPriceData | null> {
    try {
      const yahooSymbol = this.YAHOO_SYMBOLS[symbol.toUpperCase()];
      if (!yahooSymbol) return null;
      
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`,
        {
          params: { interval: '1d', range: '5d' },
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );
      
      const result = response.data?.chart?.result?.[0];
      if (!result) return null;
      
      const quote = result.meta;
      const indicators = result.indicators?.quote?.[0];
      
      return {
        symbol,
        price: quote.regularMarketPrice || 0,
        previousClose: quote.previousClose,
        change: quote.regularMarketPrice - (quote.previousClose || 0),
        changePercent: ((quote.regularMarketPrice - (quote.previousClose || 0)) / (quote.previousClose || 1)) * 100,
        high: indicators?.high?.[indicators.high.length - 1],
        low: indicators?.low?.[indicators.low.length - 1]
      };
    } catch (error) {
      console.error(`[Commodity Sync] Failed to fetch Yahoo price for ${symbol}:`, error);
      return null;
    }
  }

  async runPriceRefresh(): Promise<{ updated: number; errors: number }> {
    console.log('[Commodity Sync] Running daily price refresh...');
    
    let updated = 0;
    let errors = 0;
    
    try {
      // Get all commodities that need price update
      const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const staleCommodities = await db.select({
        id: commodities.id,
        symbol: commodities.symbol,
        name: commodities.name,
        currentPrice: commodities.currentPrice
      })
        .from(commodities)
        .where(sql`${commodities.lastUpdated} IS NULL OR ${commodities.lastUpdated} < ${staleThreshold}`)
        .orderBy(sql`${commodities.lastUpdated} ASC NULLS FIRST`)
        .limit(50);
      
      console.log(`[Commodity Sync] Found ${staleCommodities.length} stale commodities to refresh`);
      
      for (const commodity of staleCommodities) {
        try {
          // Try to fetch price from Yahoo Finance
          const priceData = await this.fetchYahooPrice(commodity.symbol);
          
          const now = new Date();
          const updateData: any = { lastUpdated: now };
          
          if (priceData && priceData.price > 0) {
            updateData.previousClose = commodity.currentPrice;
            updateData.currentPrice = priceData.price.toString();
            updateData.dayChange = priceData.change?.toString();
            updateData.dayChangePercent = priceData.changePercent?.toString();
            if (priceData.high) updateData.weekHigh = priceData.high.toString();
            if (priceData.low) updateData.weekLow = priceData.low.toString();
            updateData.dataSource = 'yahoo_finance';
          }
          
          await db.update(commodities)
            .set(updateData)
            .where(eq(commodities.id, commodity.id));
          updated++;
          
          // Rate limit - wait between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          errors++;
          console.error(`[Commodity Sync] Failed to update ${commodity.symbol}:`, err);
        }
      }
      
      console.log(`[Commodity Sync] Price refresh complete: ${updated} updated, ${errors} errors`);
    } catch (error) {
      console.error('[Commodity Sync] Price refresh failed:', error);
    }
    
    return { updated, errors };
  }

  async runStartupCatchUp(): Promise<{ updated: number; errors: number }> {
    console.log('[Commodity Sync] Running startup catch-up for stale prices...');
    
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(commodities)
      .where(sql`${commodities.lastUpdated} IS NULL OR ${commodities.lastUpdated} < ${staleThreshold}`);
    
    const staleCommodityCount = Number(countResult?.count || 0);
    console.log(`[Commodity Sync] Found ${staleCommodityCount} commodities needing price refresh`);
    
    if (staleCommodityCount === 0) {
      return { updated: 0, errors: 0 };
    }
    
    // Process all stale commodities
    const result = await this.runPriceRefresh();
    
    console.log(`[Commodity Sync] Startup catch-up complete: ${result.updated} updated, ${result.errors} errors`);
    return result;
  }

  async getStatus(): Promise<{
    totalCommodities: number;
    staleCommodities: number;
    recentlyUpdated: number;
    isRunning: boolean;
  }> {
    const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentThreshold = new Date(Date.now() - 60 * 60 * 1000); // Last hour
    
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(commodities);
    const [stale] = await db.select({ count: sql<number>`count(*)` })
      .from(commodities)
      .where(sql`${commodities.lastUpdated} IS NULL OR ${commodities.lastUpdated} < ${staleThreshold}`);
    const [recent] = await db.select({ count: sql<number>`count(*)` })
      .from(commodities)
      .where(sql`${commodities.lastUpdated} > ${recentThreshold}`);
    
    return {
      totalCommodities: Number(total?.count || 0),
      staleCommodities: Number(stale?.count || 0),
      recentlyUpdated: Number(recent?.count || 0),
      isRunning: this.isRunning
    };
  }
}

export const commodityPriceSyncScheduler = new CommodityPriceSyncScheduler();
