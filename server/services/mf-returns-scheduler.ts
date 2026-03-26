import { mfReturnsSyncService } from "./mf-returns-sync-service";
import { benchmarkSyncService } from "./benchmark-sync-service";
import { mfBenchmarkMappingService } from "./mf-benchmark-mapping-service";
import { mfRelativeMetricsEngine } from "./mf-relative-metrics-engine";
import { historicalNavService } from "./historical-nav-service";
import { updateLiveReturnsCache } from "./agent-prospect-wizard-service";
import { db } from "../db";
import { mutualFunds } from "@shared/schema";
import { sql, eq, or, and, isNull, lt } from "drizzle-orm";

const POPULAR_SCHEME_CODES = [
  // Large Cap
  "120503", // Mirae Asset Large Cap
  "119551", // HDFC Top 100
  "100033", // SBI Bluechip
  "118989", // ICICI Pru Bluechip
  // Mid Cap  
  "125497", // Kotak Emerging Equity
  "120716", // Axis Midcap
  // Small Cap
  "145552", // Quant Small Cap
  "120465", // Nippon India Small Cap
  "127042", // SBI Small Cap
  "101306", // Tata Small Cap
  // Flexi/Multi Cap
  "122639", // Parag Parikh Flexi Cap
  "100119", // HDFC Flexi Cap
  "102885", // ICICI Pru Equity & Debt
  // Hybrid
  "101195", // HDFC Balanced Advantage
  "103504", // ICICI Pru Multi Asset
  // Index Funds
  "120837", // UTI Nifty 50 Index
  "135781", // Motilal Oswal Nifty Midcap 150
  // Gold/Silver FOF
  "138423", // SBI Gold Fund
  "147618", // ICICI Pru Silver ETF FOF
  // Debt
  "108466", // ICICI Pru Corporate Bond
  "100497", // SBI Magnum Medium Duration
];

class MFReturnsScheduler {
  private static instance: MFReturnsScheduler;
  private isInitialized = false;
  private syncInterval: NodeJS.Timeout | null = null;
  
  static getInstance(): MFReturnsScheduler {
    if (!this.instance) {
      this.instance = new MFReturnsScheduler();
    }
    return this.instance;
  }

  /**
   * Initialize scheduler - runs on app startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('[MFReturnsScheduler] Initializing...');
    
    // Run initial sync for popular funds
    setTimeout(() => this.runInitialSync(), 30000); // Wait 30s after startup
    
    // Schedule daily sync at 7 AM IST
    this.scheduleDailySync();
    
    this.isInitialized = true;
    console.log('[MFReturnsScheduler] Initialized - daily sync scheduled');
  }

  /**
   * Run initial sync for popular funds on startup
   */
  async runInitialSync(): Promise<void> {
    console.log('[MFReturnsScheduler] Running initial sync for popular funds...');
    
    let synced = 0;
    let failed = 0;
    
    for (const schemeCode of POPULAR_SCHEME_CODES) {
      try {
        const returns = await mfReturnsSyncService.syncSingleFund(schemeCode);
        if (returns && returns.dataQuality !== 'insufficient') {
          synced++;
          console.log(`[MFReturnsScheduler] Synced ${schemeCode}: 1Y=${returns.returns1y?.toFixed(1)}%, 3Y=${returns.returns3y?.toFixed(1)}%`);
          
          // Update live returns cache for proposal paths
          await this.updateCacheFromSchemeCode(schemeCode, returns);
        } else {
          failed++;
        }
        // Use adaptive delay from sync service
        const delay = mfReturnsSyncService.getCurrentDelay();
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error: any) {
        failed++;
        // Errors are handled by sync service with built-in retry/backoff
        console.log(`[MFReturnsScheduler] Sync failed for ${schemeCode}: ${error.message}`);
      }
    }
    
    console.log(`[MFReturnsScheduler] Initial sync complete: ${synced} synced, ${failed} failed`);
    
    // Warm up cache from database for all synced funds
    await this.warmupCacheFromDatabase();
  }

  /**
   * Update live returns cache from a synced scheme
   */
  private async updateCacheFromSchemeCode(schemeCode: string, returns: {
    returns1y: number | null;
    returns3y: number | null;
    returns5y: number | null;
    dataQuality: string;
  }): Promise<void> {
    try {
      // Get scheme name from database
      const fund = await db.select({ schemeName: mutualFunds.schemeName })
        .from(mutualFunds)
        .where(eq(mutualFunds.schemeCode, schemeCode))
        .limit(1);
      
      if (fund[0]?.schemeName) {
        updateLiveReturnsCache(fund[0].schemeName, {
          returns1Y: returns.returns1y,
          returns3Y: returns.returns3y,
          returns5Y: returns.returns5y,
          dataSource: 'mfapi'
        });
      }
    } catch (error) {
      // Silently continue - cache update is non-critical
    }
  }

  /**
   * Warm up cache from database for all funds with synced returns
   */
  private async warmupCacheFromDatabase(): Promise<void> {
    try {
      console.log('[MFReturnsScheduler] Warming up live returns cache from database...');
      
      const fundsWithReturns = await db.select({
        schemeName: mutualFunds.schemeName,
        returns1y: mutualFunds.returns1y,
        returns3y: mutualFunds.returns3y,
        returns5y: mutualFunds.returns5y
      })
      .from(mutualFunds)
      .where(sql`${mutualFunds.returns1y} IS NOT NULL OR ${mutualFunds.returns3y} IS NOT NULL`)
      .limit(500);
      
      for (const fund of fundsWithReturns) {
        if (fund.schemeName) {
          updateLiveReturnsCache(fund.schemeName, {
            returns1Y: fund.returns1y ? parseFloat(fund.returns1y as string) : null,
            returns3Y: fund.returns3y ? parseFloat(fund.returns3y as string) : null,
            returns5Y: fund.returns5y ? parseFloat(fund.returns5y as string) : null,
            dataSource: 'live'
          });
        }
      }
      
      console.log(`[MFReturnsScheduler] Cache warmed up with ${fundsWithReturns.length} funds`);
    } catch (error: any) {
      console.log(`[MFReturnsScheduler] Cache warmup failed: ${error.message}`);
    }
  }

  /**
   * Schedule hourly sync for faster data enrichment
   * Runs every hour to continuously enrich MF data from AMFI
   */
  scheduleDailySync(): void {
    const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
    const BATCH_SIZE = 200; // Increased batch size per run
    
    console.log(`[MFReturnsScheduler] Hourly sync scheduled (every 60 min, batch size: ${BATCH_SIZE})`);
    console.log(`[MFReturnsScheduler] Primary data source: AMFI via MFAPI`);
    
    // Start first batch after 2 minutes (allow startup to complete)
    setTimeout(() => {
      this.runHourlySync(BATCH_SIZE);
      // Then schedule to run every hour
      this.syncInterval = setInterval(() => this.runHourlySync(BATCH_SIZE), SYNC_INTERVAL_MS);
    }, 2 * 60 * 1000);
  }

  /**
   * Run hourly sync batch - Database-first approach
   * 1. First calculate returns from stored historical NAV data
   * 2. For funds without stored data, fetch from AMFI and store
   */
  async runHourlySync(batchSize: number): Promise<void> {
    console.log(`[MFReturnsScheduler] Running hourly sync (batch: ${batchSize})...`);
    console.log(`[MFReturnsScheduler] Step 1: Calculate returns from stored historical NAV data`);
    
    try {
      // Step 1: Get funds that need returns calculated
      // Exclude funds updated within the last 20 hours — this prevents new NFOs
      // (with only 2 NAV data points, insufficient for return calculation) from
      // being re-fetched every hourly run when they'll remain insufficient anyway.
      const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);
      const fundsNeedingReturns = await db.select({
        schemeCode: mutualFunds.schemeCode,
        schemeName: mutualFunds.schemeName
      })
      .from(mutualFunds)
      .where(
        and(
          or(isNull(mutualFunds.returns1y), isNull(mutualFunds.returns3y)),
          or(isNull(mutualFunds.lastUpdated), lt(mutualFunds.lastUpdated, twentyHoursAgo))
        )
      )
      .limit(batchSize);
      
      let dbCalculated = 0;
      let apiSynced = 0;
      
      for (const fund of fundsNeedingReturns) {
        if (!fund.schemeCode) continue;
        
        // Try to calculate from stored historical data first
        const storedReturns = await historicalNavService.calculateReturnsFromStoredData(fund.schemeCode);
        
        if (storedReturns.dataQuality !== 'insufficient' && storedReturns.returns1y !== null) {
          // Update fund with calculated returns from database
          await db.update(mutualFunds)
            .set({
              returns1y: storedReturns.returns1y?.toString(),
              returns3y: storedReturns.returns3y?.toString(),
              returns5y: storedReturns.returns5y?.toString(),
              nav: storedReturns.currentNav?.toString(),
              lastUpdated: new Date()
            })
            .where(eq(mutualFunds.schemeCode, fund.schemeCode));
          
          dbCalculated++;
          
          // Update cache
          if (fund.schemeName) {
            updateLiveReturnsCache(fund.schemeName, {
              returns1Y: storedReturns.returns1y,
              returns3Y: storedReturns.returns3y,
              returns5Y: storedReturns.returns5y,
              dataSource: 'database'
            });
          }
        } else {
          // No stored data - fetch from AMFI API and store
          try {
            await historicalNavService.fetchAndStoreMutualFundHistory(fund.schemeCode);
            const freshReturns = await historicalNavService.calculateReturnsFromStoredData(fund.schemeCode);
            
            if (freshReturns.returns1y !== null) {
              await db.update(mutualFunds)
                .set({
                  returns1y: freshReturns.returns1y?.toString(),
                  returns3y: freshReturns.returns3y?.toString(),
                  returns5y: freshReturns.returns5y?.toString(),
                  nav: freshReturns.currentNav?.toString(),
                  lastUpdated: new Date()
                })
                .where(eq(mutualFunds.schemeCode, fund.schemeCode));
              
              apiSynced++;
            } else {
              // Insufficient NAV history (e.g. new NFO with only 2 data points).
              // Stamp lastUpdated so this fund is excluded from the next 20 hours
              // of hourly runs — preventing redundant MFAPI calls every hour.
              await db.update(mutualFunds)
                .set({ lastUpdated: new Date() })
                .where(eq(mutualFunds.schemeCode, fund.schemeCode));
            }
          } catch (err: any) {
            // API fetch failed — still stamp lastUpdated so we don't hammer MFAPI
            // on every hourly cycle. The fund will be retried after the cooldown.
            try {
              await db.update(mutualFunds)
                .set({ lastUpdated: new Date() })
                .where(eq(mutualFunds.schemeCode, fund.schemeCode));
            } catch (tsErr: any) {
              console.warn('[MFReturnsScheduler] Failed to update timestamp:', tsErr?.message);
            }
          }
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      console.log(`[MFReturnsScheduler] Hourly sync complete: ${dbCalculated} from DB, ${apiSynced} from AMFI API`);
      
      // Warm up cache
      await this.warmupCacheFromDatabase();
    } catch (error: any) {
      console.error(`[MFReturnsScheduler] Hourly sync error: ${error.message}`);
    }
  }

  /**
   * Run daily sync for funds needing updates
   */
  async runDailySync(): Promise<void> {
    console.log('[MFReturnsScheduler] Running daily sync...');
    
    try {
      // First sync popular funds
      await this.runInitialSync();
      
      // Then sync additional funds that need updates
      const result = await mfReturnsSyncService.runBatchSync(100);
      
      console.log(`[MFReturnsScheduler] Daily sync complete: ${result.successful}/${result.processed} successful`);
      
      // Sync benchmark index data
      await this.syncBenchmarkData();
      
      // Compute relative metrics for funds with benchmark mappings
      await this.computeRelativeMetrics();
    } catch (error: any) {
      console.error('[MFReturnsScheduler] Daily sync error:', error.message);
    }
  }
  
  async syncBenchmarkData(): Promise<void> {
    console.log('[MFReturnsScheduler] Syncing benchmark index data...');
    try {
      const result = await benchmarkSyncService.syncAllBenchmarks();
      console.log(`[MFReturnsScheduler] Benchmark sync: ${result.synced} indices synced`);
    } catch (error: any) {
      console.error('[MFReturnsScheduler] Benchmark sync error:', error.message);
    }
  }
  
  async computeRelativeMetrics(): Promise<void> {
    console.log('[MFReturnsScheduler] Computing relative metrics...');
    try {
      // First sync AMFI benchmark data and auto-map from AMFI
      await this.syncAmfiBenchmarks();
      
      // Then auto-map any remaining unmapped funds using category rules
      await mfBenchmarkMappingService.autoMapUnmappedFunds(500);
      
      // Then compute relative metrics for mapped funds
      const result = await mfRelativeMetricsEngine.recomputeAllMetrics(100);
      console.log(`[MFReturnsScheduler] Relative metrics: ${result.success}/${result.processed} computed`);
    } catch (error: any) {
      console.error('[MFReturnsScheduler] Relative metrics error:', error.message);
    }
  }

  async syncAmfiBenchmarks(): Promise<void> {
    console.log('[MFReturnsScheduler] Syncing AMFI benchmark data...');
    try {
      const { amfiBenchmarkIngestionService } = await import('./amfi-benchmark-ingestion-service');
      
      // Parse AMFI benchmark strings from mutual_funds table
      const syncResult = await amfiBenchmarkIngestionService.syncAmfiSchemeBenchmarks();
      console.log(`[MFReturnsScheduler] AMFI sync: ${syncResult.normalized}/${syncResult.total} normalized`);
      
      // Auto-map funds using AMFI data (higher confidence than category-based)
      const mapResult = await amfiBenchmarkIngestionService.autoMapFromAmfi();
      console.log(`[MFReturnsScheduler] AMFI mapping: ${mapResult.mapped} new, ${mapResult.updated} updated`);
    } catch (error: any) {
      console.error('[MFReturnsScheduler] AMFI sync error:', error.message);
    }
  }

  /**
   * Get list of funds with synced returns
   */
  async getSyncedFundsCount(): Promise<{ total: number; withReturns: number }> {
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(mutualFunds);
    
    const withReturnsResult = await db.select({ count: sql<number>`count(*)` })
      .from(mutualFunds)
      .where(sql`returns_1y IS NOT NULL`);
    
    return {
      total: Number(totalResult[0]?.count || 0),
      withReturns: Number(withReturnsResult[0]?.count || 0)
    };
  }

  /**
   * Get status
   */
  getStatus(): { isInitialized: boolean; syncServiceStatus: any } {
    return {
      isInitialized: this.isInitialized,
      syncServiceStatus: mfReturnsSyncService.getStatus()
    };
  }
}

export const mfReturnsScheduler = MFReturnsScheduler.getInstance();
