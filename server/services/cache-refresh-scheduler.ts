/**
 * Cache Refresh Scheduler
 * Background service for scheduled cache refresh jobs to keep market data,
 * fundamentals, and portfolio metrics up-to-date, reducing API calls during
 * rebalancing and proposal generation.
 */

import cron from "node-cron";
import { db } from "../db";
import { eq, and, lte, sql, inArray } from "drizzle-orm";
import {
  cacheRefreshJobs,
  marketDataSnapshots,
  productFundamentalsCache,
  portfolioMetricsDaily,
  users,
  portfolios,
  portfolioHoldings,
  aifSchemes,
  pmsSchemes
} from "@shared/schema";
import {
  cacheMarketData,
  cacheFundamentals,
  cachePortfolioMetrics,
  getCacheStats,
  cleanupExpiredCache,
  CACHE_TTL
} from "./investment-cache-service";
import { log, error as logError } from "../utils/logger";

interface RefreshJobResult {
  jobId: string;
  jobType: string;
  itemsProcessed: number;
  itemsFailed: number;
  durationMs: number;
  errors: string[];
}

class CacheRefreshScheduler {
  private isRunning: boolean = false;
  private jobQueue: string[] = [];

  constructor() {
    this.initializeScheduledJobs();
    log("info", "[CacheRefreshScheduler] Scheduler initialized");
  }

  private initializeScheduledJobs(): void {
    // Market data refresh - every hour during market hours (9 AM - 4 PM IST on weekdays)
    cron.schedule("0 9-16 * * 1-5", async () => {
      await this.refreshMarketData("stock");
      await this.refreshMarketData("mf");
    }, { timezone: "Asia/Kolkata" });

    // End-of-day comprehensive market data refresh - 6 PM IST on weekdays
    cron.schedule("0 18 * * 1-5", async () => {
      await this.refreshAllMarketData();
    }, { timezone: "Asia/Kolkata" });

    // Fundamentals refresh - daily at 3 AM IST
    cron.schedule("0 3 * * *", async () => {
      await this.refreshFundamentals("stock");
      await this.refreshFundamentals("mf");
      await this.refreshFundamentals("bond");
    }, { timezone: "Asia/Kolkata" });

    // Portfolio metrics pre-computation - every 4 hours
    cron.schedule("0 */4 * * *", async () => {
      await this.precomputePortfolioMetrics();
    });

    // Cache cleanup - daily at 2:20 AM IST (staggered to avoid collision with other 2AM jobs)
    cron.schedule("20 2 * * *", async () => {
      await this.performCacheCleanup();
    }, { timezone: "Asia/Kolkata" });

    log("info", "[CacheRefreshScheduler] Cron jobs scheduled");
  }

  async refreshMarketData(assetType: string): Promise<RefreshJobResult> {
    const startTime = Date.now();
    const jobId = `market_data_${assetType}_${Date.now()}`;
    let itemsProcessed = 0;
    let itemsFailed = 0;
    const errors: string[] = [];

    try {
      // Create job record
      await db.insert(cacheRefreshJobs).values({
        jobType: "market_data",
        cacheTable: "market_data_snapshots",
        assetType,
        status: "running",
        startedAt: new Date()
      });

      // Get assets to refresh based on type
      let assets: Array<{ assetId: string; assetName: string }> = [];

      if (assetType === "stock") {
        // Get stocks from portfolio holdings
        const holdings = await db
          .select({ symbol: portfolioHoldings.symbol, name: portfolioHoldings.name })
          .from(portfolioHoldings)
          .where(eq(portfolioHoldings.assetType, "stock"))
          .limit(500);
        assets = holdings.map(h => ({ assetId: h.symbol || "", assetName: h.name || "" }));
      } else if (assetType === "mf") {
        // Get MF scheme codes from holdings
        const holdings = await db
          .select({ symbol: portfolioHoldings.symbol, name: portfolioHoldings.name })
          .from(portfolioHoldings)
          .where(eq(portfolioHoldings.assetType, "mutual_fund"))
          .limit(500);
        assets = holdings.map(h => ({ assetId: h.symbol || "", assetName: h.name || "" }));
      } else if (assetType === "aif") {
        const schemes = await db.select({ id: aifSchemes.id, name: aifSchemes.name }).from(aifSchemes).limit(200);
        assets = schemes.map(s => ({ assetId: s.id, assetName: s.name }));
      } else if (assetType === "pms") {
        const schemes = await db.select({ id: pmsSchemes.id, name: pmsSchemes.name }).from(pmsSchemes).limit(200);
        assets = schemes.map(s => ({ assetId: s.id, assetName: s.name }));
      }

      // Process in batches of 50
      const batchSize = 50;
      for (let i = 0; i < assets.length; i += batchSize) {
        const batch = assets.slice(i, i + batchSize);
        
        const promises = batch.map(async (asset) => {
          try {
            // Fetch market data from appropriate source based on asset type
            const marketData = await this.fetchMarketDataForAsset(assetType, asset.assetId);
            
            if (marketData) {
              await cacheMarketData({
                assetType,
                assetId: asset.assetId,
                assetName: asset.assetName,
                ...marketData,
                snapshotDate: new Date().toISOString().split("T")[0],
                dataSource: this.getDataSource(assetType)
              }, assetType === "stock" ? CACHE_TTL.MARKET_DATA : CACHE_TTL.MARKET_DATA_EOD);
              itemsProcessed++;
            }
          } catch (err: any) {
            itemsFailed++;
            errors.push(`${asset.assetId}: ${err.message}`);
          }
        });

        await Promise.allSettled(promises);
        
        // Rate limiting delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Update job status
      await db
        .update(cacheRefreshJobs)
        .set({
          status: itemsFailed > 0 ? "completed" : "completed",
          completedAt: new Date(),
          itemsProcessed,
          itemsFailed,
          lastError: errors.length > 0 ? errors.slice(-5).join("; ") : null
        })
        .where(eq(cacheRefreshJobs.jobType, "market_data"));

      log("info", `[CacheRefreshScheduler] Market data refresh completed for ${assetType}: ${itemsProcessed} processed, ${itemsFailed} failed`);

    } catch (err: any) {
      logError(`[CacheRefreshScheduler] Market data refresh failed for ${assetType}: ${err.message}`);
      errors.push(err.message);
    }

    return {
      jobId,
      jobType: `market_data_${assetType}`,
      itemsProcessed,
      itemsFailed,
      durationMs: Date.now() - startTime,
      errors
    };
  }

  private async fetchMarketDataForAsset(assetType: string, assetId: string): Promise<any> {
    // This would integrate with actual data sources
    // For now, return mock structure - actual implementation would call Yahoo Finance, NSE, BSE APIs
    
    // In production, this would call:
    // - Yahoo Finance for stocks
    // - AMFI/BSE Star MFD for mutual funds
    // - NSE/BSE for bonds
    // - Internal DB for AIF/PMS
    
    return {
      currentPrice: null,
      previousClose: null,
      return1D: null,
      return1W: null,
      return1M: null,
      return3M: null,
      return6M: null,
      return1Y: null,
      return3Y: null,
      return5Y: null,
      volume: null,
      aum: null
    };
  }

  private getDataSource(assetType: string): string {
    const sources: Record<string, string> = {
      stock: "yahoo_finance",
      mf: "amfi",
      bond: "nse_bse",
      aif: "internal_db",
      pms: "internal_db",
      unlisted: "internal_db",
      ncd: "nse"
    };
    return sources[assetType] || "unknown";
  }

  async refreshAllMarketData(): Promise<void> {
    log("info", "[CacheRefreshScheduler] Starting comprehensive market data refresh");
    
    const assetTypes = ["stock", "mf", "bond", "aif", "pms"];
    
    for (const assetType of assetTypes) {
      await this.refreshMarketData(assetType);
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay between types
    }
    
    log("info", "[CacheRefreshScheduler] Comprehensive market data refresh completed");
  }

  async refreshFundamentals(productType: string): Promise<RefreshJobResult> {
    const startTime = Date.now();
    const jobId = `fundamentals_${productType}_${Date.now()}`;
    let itemsProcessed = 0;
    let itemsFailed = 0;
    const errors: string[] = [];

    try {
      await db.insert(cacheRefreshJobs).values({
        jobType: "fundamentals",
        cacheTable: "product_fundamentals_cache",
        assetType: productType,
        status: "running",
        startedAt: new Date()
      });

      // Get products to refresh - prioritize those with stale/expired cache
      const staleProducts = await db
        .select()
        .from(productFundamentalsCache)
        .where(
          and(
            eq(productFundamentalsCache.productType, productType),
            lte(productFundamentalsCache.expiresAt, new Date())
          )
        )
        .limit(100);

      for (const product of staleProducts) {
        try {
          // Fetch fresh fundamentals from appropriate source
          const fundamentals = await this.fetchFundamentalsForProduct(productType, product.productId);
          
          if (fundamentals) {
            await cacheFundamentals({
              productType,
              productId: product.productId,
              productName: product.productName,
              ...fundamentals,
              dataSource: this.getDataSource(productType)
            }, CACHE_TTL.FUNDAMENTALS);
            itemsProcessed++;
          }
        } catch (err: any) {
          itemsFailed++;
          errors.push(`${product.productId}: ${err.message}`);
        }
      }

      await db
        .update(cacheRefreshJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          itemsProcessed,
          itemsFailed,
          lastError: errors.length > 0 ? errors.slice(-5).join("; ") : null
        })
        .where(eq(cacheRefreshJobs.jobType, "fundamentals"));

      log("info", `[CacheRefreshScheduler] Fundamentals refresh completed for ${productType}: ${itemsProcessed} processed, ${itemsFailed} failed`);

    } catch (err: any) {
      logError(`[CacheRefreshScheduler] Fundamentals refresh failed for ${productType}: ${err.message}`);
      errors.push(err.message);
    }

    return {
      jobId,
      jobType: `fundamentals_${productType}`,
      itemsProcessed,
      itemsFailed,
      durationMs: Date.now() - startTime,
      errors
    };
  }

  private async fetchFundamentalsForProduct(productType: string, productId: string): Promise<any> {
    // Placeholder - would integrate with actual data sources
    // Yahoo Finance, Screener, MoneyControl for stocks
    // AMFI, VR, Morningstar for MFs
    // Credit rating agencies for bonds
    return null;
  }

  async precomputePortfolioMetrics(): Promise<RefreshJobResult> {
    const startTime = Date.now();
    const jobId = `portfolio_metrics_${Date.now()}`;
    let itemsProcessed = 0;
    let itemsFailed = 0;
    const errors: string[] = [];

    try {
      await db.insert(cacheRefreshJobs).values({
        jobType: "portfolio_metrics",
        cacheTable: "portfolio_metrics_daily",
        status: "running",
        startedAt: new Date()
      });

      // Get all active users with portfolios
      const activeUsers = await db
        .select({ userId: portfolios.userId })
        .from(portfolios)
        .groupBy(portfolios.userId)
        .limit(1000);

      for (const { userId } of activeUsers) {
        if (!userId) continue;
        
        try {
          // Get user's portfolios
          const userPortfolios = await db
            .select()
            .from(portfolios)
            .where(eq(portfolios.userId, userId));

          for (const portfolio of userPortfolios) {
            try {
              // Compute metrics for each portfolio
              const metrics = await this.computePortfolioMetrics(userId, portfolio.id);
              
              if (metrics) {
                await cachePortfolioMetrics({
                  userId,
                  portfolioId: portfolio.id,
                  metricsDate: new Date().toISOString().split("T")[0],
                  ...metrics,
                  computationTimeMs: Date.now() - startTime
                });
                itemsProcessed++;
              }
            } catch (err: any) {
              itemsFailed++;
              errors.push(`Portfolio ${portfolio.id}: ${err.message}`);
            }
          }
        } catch (err: any) {
          itemsFailed++;
          errors.push(`User ${userId}: ${err.message}`);
        }
      }

      await db
        .update(cacheRefreshJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          itemsProcessed,
          itemsFailed,
          lastError: errors.length > 0 ? errors.slice(-5).join("; ") : null
        })
        .where(eq(cacheRefreshJobs.jobType, "portfolio_metrics"));

      log("info", `[CacheRefreshScheduler] Portfolio metrics precomputation completed: ${itemsProcessed} processed, ${itemsFailed} failed`);

    } catch (err: any) {
      logError(`[CacheRefreshScheduler] Portfolio metrics precomputation failed: ${err.message}`);
      errors.push(err.message);
    }

    return {
      jobId,
      jobType: "portfolio_metrics",
      itemsProcessed,
      itemsFailed,
      durationMs: Date.now() - startTime,
      errors
    };
  }

  private async computePortfolioMetrics(userId: string, portfolioId: string): Promise<any> {
    // Get holdings with cached market data
    const holdings = await db
      .select()
      .from(portfolioHoldings)
      .where(eq(portfolioHoldings.portfolioId, portfolioId));

    if (holdings.length === 0) return null;

    // Calculate aggregate metrics
    let totalValue = 0;
    let totalCost = 0;
    let equityValue = 0;
    let debtValue = 0;
    let goldValue = 0;
    let cashValue = 0;
    let alternativesValue = 0;

    for (const holding of holdings) {
      const quantity = parseFloat(holding.quantity || "0");
      const avgCost = parseFloat(holding.avgCost || "0");
      const currentPrice = parseFloat(holding.currentPrice || holding.avgCost || "0");
      
      const holdingValue = quantity * currentPrice;
      const holdingCost = quantity * avgCost;
      
      totalValue += holdingValue;
      totalCost += holdingCost;

      // Categorize by asset type
      const assetType = holding.assetType || "";
      if (["stock", "equity_mf"].includes(assetType)) {
        equityValue += holdingValue;
      } else if (["bond", "debt_mf", "ncd"].includes(assetType)) {
        debtValue += holdingValue;
      } else if (["gold", "sgb"].includes(assetType)) {
        goldValue += holdingValue;
      } else if (["cash", "liquid_mf"].includes(assetType)) {
        cashValue += holdingValue;
      } else {
        alternativesValue += holdingValue;
      }
    }

    const unrealizedGainLoss = totalValue - totalCost;
    
    return {
      totalValue: totalValue.toString(),
      totalCost: totalCost.toString(),
      unrealizedGainLoss: unrealizedGainLoss.toString(),
      allocationEquity: totalValue > 0 ? (equityValue / totalValue).toString() : "0",
      allocationDebt: totalValue > 0 ? (debtValue / totalValue).toString() : "0",
      allocationGold: totalValue > 0 ? (goldValue / totalValue).toString() : "0",
      allocationCash: totalValue > 0 ? (cashValue / totalValue).toString() : "0",
      allocationAlternatives: totalValue > 0 ? (alternativesValue / totalValue).toString() : "0",
      totalHoldings: holdings.length,
      equityHoldings: holdings.filter(h => ["stock", "equity_mf"].includes(h.assetType || "")).length,
      debtHoldings: holdings.filter(h => ["bond", "debt_mf", "ncd"].includes(h.assetType || "")).length,
      mfHoldings: holdings.filter(h => (h.assetType || "").includes("_mf")).length
    };
  }

  async performCacheCleanup(): Promise<void> {
    log("info", "[CacheRefreshScheduler] Starting cache cleanup");
    
    try {
      const stats = await cleanupExpiredCache();
      
      log("info", `[CacheRefreshScheduler] Cache cleanup completed: 
        Market Data: ${stats.marketDataDeleted} deleted
        Fundamentals: ${stats.fundamentalsDeleted} deleted
        Rationales: ${stats.rationalesDeleted} deleted
        Portfolio Metrics: ${stats.metricsDeleted} deleted
        Proposals: ${stats.proposalsDeleted} deleted`);
        
    } catch (err: any) {
      logError(`[CacheRefreshScheduler] Cache cleanup failed: ${err.message}`);
    }
  }

  async getCacheStatus(): Promise<any> {
    const stats = await getCacheStats();
    
    return {
      ...stats,
      isSchedulerRunning: true,
      lastRefreshTime: new Date().toISOString()
    };
  }

  // Manual trigger methods for admin use
  async triggerMarketDataRefresh(assetType?: string): Promise<RefreshJobResult[]> {
    if (assetType) {
      return [await this.refreshMarketData(assetType)];
    }
    
    const results: RefreshJobResult[] = [];
    for (const type of ["stock", "mf", "bond", "aif", "pms"]) {
      results.push(await this.refreshMarketData(type));
    }
    return results;
  }

  async triggerFundamentalsRefresh(productType?: string): Promise<RefreshJobResult[]> {
    if (productType) {
      return [await this.refreshFundamentals(productType)];
    }
    
    const results: RefreshJobResult[] = [];
    for (const type of ["stock", "mf", "bond"]) {
      results.push(await this.refreshFundamentals(type));
    }
    return results;
  }

  async triggerPortfolioMetricsRefresh(): Promise<RefreshJobResult> {
    return await this.precomputePortfolioMetrics();
  }
}

// Singleton instance
let schedulerInstance: CacheRefreshScheduler | null = null;

export function initializeCacheRefreshScheduler(): CacheRefreshScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new CacheRefreshScheduler();
  }
  return schedulerInstance;
}

export function getCacheRefreshScheduler(): CacheRefreshScheduler | null {
  return schedulerInstance;
}

export { CacheRefreshScheduler };
