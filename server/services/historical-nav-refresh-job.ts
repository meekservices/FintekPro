import { db } from "../db";
import { historicalNavData, assetMetadataCache } from "@shared/schema";
import { eq, sql, desc, gte } from "drizzle-orm";
import { historicalNavService } from "./historical-nav-service";

interface RefreshStats {
  totalSchemes: number;
  successfulRefreshes: number;
  failedRefreshes: number;
  newRecordsAdded: number;
  lastRunAt: Date;
  nextRunAt: Date;
}

class HistoricalNavRefreshJob {
  private static instance: HistoricalNavRefreshJob;
  private isRunning = false;
  private lastStats: RefreshStats | null = null;
  private refreshIntervalId: NodeJS.Timeout | null = null;
  
  static getInstance(): HistoricalNavRefreshJob {
    if (!this.instance) {
      this.instance = new HistoricalNavRefreshJob();
    }
    return this.instance;
  }

  initialize(): void {
    if (this.refreshIntervalId) return;
    
    console.log("[HistoricalNavRefresh] Initializing daily refresh job...");
    
    // Delay warmup 5 minutes to let the server stabilise after deployment startup
    setTimeout(() => this.runInitialWarmup(), 5 * 60 * 1000);
    
    // Schedule daily refresh at 2 AM IST (8:30 PM UTC previous day)
    this.scheduleDaily();
    
    console.log("[HistoricalNavRefresh] Job scheduled for daily execution");
  }

  private scheduleDaily(): void {
    // Run every 24 hours
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    
    this.refreshIntervalId = setInterval(() => {
      this.runRefresh();
    }, TWENTY_FOUR_HOURS);
  }

  async runInitialWarmup(): Promise<void> {
    console.log("[HistoricalNavRefresh] Running initial warmup...");
    
    // Fetch some popular schemes to pre-populate the cache
    const popularSchemes = [
      "119551", // ABSL Banking & PSU
      "120503", // HDFC Flexi Cap Direct
      "118989", // ICICI Pru Bluechip Direct
      "100033", // Franklin India Prima Plus
      "102885", // HDFC Top 100 Fund
      "101306", // ICICI Pru Value Discovery
      "120465", // SBI Bluechip Direct
      "120716", // Kotak Flexicap Direct
      "125497", // Axis Bluechip Direct
      "145552", // Parag Parikh Flexi Cap Direct
    ];
    
    let successCount = 0;
    let newRecords = 0;
    
    for (const schemeCode of popularSchemes) {
      try {
        const result = await historicalNavService.fetchAndStoreMutualFundHistory(schemeCode);
        if (result.success) {
          successCount++;
          newRecords += result.recordsStored;
        }
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[HistoricalNavRefresh] Failed to warmup ${schemeCode}:`, error);
      }
    }
    
    console.log(`[HistoricalNavRefresh] Initial warmup complete: ${successCount}/${popularSchemes.length} schemes, ${newRecords} records`);
  }

  async runRefresh(): Promise<RefreshStats> {
    if (this.isRunning) {
      console.log("[HistoricalNavRefresh] Refresh already in progress, skipping...");
      return this.lastStats || this.createEmptyStats();
    }
    
    this.isRunning = true;
    console.log("[HistoricalNavRefresh] Starting daily refresh...");
    
    const stats: RefreshStats = {
      totalSchemes: 0,
      successfulRefreshes: 0,
      failedRefreshes: 0,
      newRecordsAdded: 0,
      lastRunAt: new Date(),
      nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
    
    try {
      // Get all unique schemes we have data for
      const existingSchemes = await db.selectDistinct({
        identifier: historicalNavData.identifier
      })
      .from(historicalNavData)
      .where(eq(historicalNavData.identifierType, 'mutual_fund'));
      
      stats.totalSchemes = existingSchemes.length;
      console.log(`[HistoricalNavRefresh] Refreshing ${stats.totalSchemes} schemes...`);
      
      // Refresh each scheme
      for (const scheme of existingSchemes) {
        try {
          const result = await historicalNavService.fetchAndStoreMutualFundHistory(scheme.identifier);
          
          if (result.success) {
            stats.successfulRefreshes++;
            stats.newRecordsAdded += result.recordsStored;
          } else {
            stats.failedRefreshes++;
          }
          
          // Rate limit - wait 500ms between requests
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`[HistoricalNavRefresh] Error refreshing ${scheme.identifier}:`, error);
          stats.failedRefreshes++;
        }
      }
      
      console.log(`[HistoricalNavRefresh] Daily refresh complete:`, {
        total: stats.totalSchemes,
        successful: stats.successfulRefreshes,
        failed: stats.failedRefreshes,
        newRecords: stats.newRecordsAdded
      });
      
    } catch (error) {
      console.error("[HistoricalNavRefresh] Error during refresh:", error);
    } finally {
      this.isRunning = false;
      this.lastStats = stats;
    }
    
    return stats;
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    lastStats: RefreshStats | null;
    cachedSchemesCount: number;
    totalRecordsCount: number;
    oldestData: string | null;
    newestData: string | null;
  }> {
    const [countResult, dateRange] = await Promise.all([
      db.select({
        schemes: sql<number>`COUNT(DISTINCT identifier)`,
        records: sql<number>`COUNT(*)`
      })
      .from(historicalNavData),
      
      db.select({
        oldest: sql<string>`MIN(date)`,
        newest: sql<string>`MAX(date)`
      })
      .from(historicalNavData)
    ]);
    
    return {
      isRunning: this.isRunning,
      lastStats: this.lastStats,
      cachedSchemesCount: countResult[0]?.schemes || 0,
      totalRecordsCount: countResult[0]?.records || 0,
      oldestData: dateRange[0]?.oldest || null,
      newestData: dateRange[0]?.newest || null
    };
  }

  private createEmptyStats(): RefreshStats {
    return {
      totalSchemes: 0,
      successfulRefreshes: 0,
      failedRefreshes: 0,
      newRecordsAdded: 0,
      lastRunAt: new Date(),
      nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  shutdown(): void {
    if (this.refreshIntervalId) {
      clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
    console.log("[HistoricalNavRefresh] Job stopped");
  }
}

export const historicalNavRefreshJob = HistoricalNavRefreshJob.getInstance();
