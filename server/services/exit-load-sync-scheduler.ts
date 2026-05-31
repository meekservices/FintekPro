// @ts-nocheck
/**
 * Exit Load Sync Scheduler
 * Monthly refresh of exit load data with ISIN enrichment
 * Runs on 1st of every month at 3:00 AM IST (non-working hours)
 * Pipeline: popular funds + category-based + ISIN mapping
 */

import cron from 'node-cron';
import { exitLoadSeedService } from "./exit-load-seed-service";
import { exitLoadService } from "./exit-load-service";

class ExitLoadSyncScheduler {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;
  private lastSyncTime: Date | null = null;
  private lastSyncResult: { seeded: number; skipped: number; errors: number } | null = null;
  private lastEnrichmentResult: {
    popularFunds: { seeded: number; skipped: number; errors: number };
    categoryBased: { seeded: number; skipped: number; errors: number };
    isinEnrichment: { enriched: number; alreadyHasIsin: number; noMatchFound: number };
  } | null = null;

  /**
   * Start the scheduler
   * Runs on 1st of every month at 3:00 AM IST
   */
  start(): void {
    if (this.cronJob) {
      console.log('[ExitLoadSync] Scheduler already running');
      return;
    }

    // Cron: "0 3 1 * *" = At 03:00 on day 1 of every month
    // Using UTC equivalent: 3:00 AM IST = 21:30 UTC (previous day)
    // For 1st of month IST, we need to run at 21:30 UTC on last day of previous month
    // Simpler: Use 3:00 AM IST as 21:30 UTC on day 1 (will be a few hours into IST day 1)
    // Actually 3 AM IST on 1st = 9:30 PM UTC on 31st (previous month)
    // To keep it simple and reliable: run at 3 AM UTC on 1st (which is 8:30 AM IST on 1st)
    // OR use the timezone option if available
    
    // Using node-cron with timezone support
    // 3:00 AM IST = run at minute 0, hour 3, on day 1 of month, timezone Asia/Kolkata
    this.cronJob = cron.schedule('0 3 1 * *', async () => {
      console.log('[ExitLoadSync] Monthly cron triggered at', new Date().toISOString());
      try {
        await this.runFullEnrichment();
      } catch (err) {
        console.error('[ExitLoadSync] Scheduled enrichment failed:', err);
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    console.log('📊 [ExitLoadSync] Exit load sync scheduler started');
    console.log('   Schedule: 1st of every month at 3:00 AM IST');
    console.log('   Next run:', this.getNextScheduledRun().toISOString());

    // Run initial enrichment on startup if no recent run (delayed by 2 minutes)
    setTimeout(async () => {
      const shouldRunInitial = await this.shouldRunInitialEnrichment();
      if (shouldRunInitial) {
        console.log('[ExitLoadSync] Running initial enrichment (no recent run detected)...');
        try {
          await this.runFullEnrichment();
        } catch (err) {
          console.error('[ExitLoadSync] Initial enrichment failed:', err);
        }
      } else {
        console.log('[ExitLoadSync] Skipping initial enrichment (recent run exists)');
      }
    }, 2 * 60 * 1000);
  }

  /**
   * Check if initial enrichment should run
   * Returns true if no data exists or last run was > 25 days ago
   */
  private async shouldRunInitialEnrichment(): Promise<boolean> {
    try {
      const stats = await exitLoadSeedService.getStats();
      
      // If no exit load data exists, definitely run
      if (stats.seededFunds === 0) {
        console.log('[ExitLoadSync] No exit load data found, initial run needed');
        return true;
      }

      // Check if we have recent data (within last 25 days)
      // This prevents duplicate runs if server restarts multiple times
      if (this.lastSyncTime) {
        const daysSinceLastRun = (Date.now() - this.lastSyncTime.getTime()) / (24 * 60 * 60 * 1000);
        if (daysSinceLastRun < 25) {
          return false;
        }
      }

      // If we have data but haven't tracked last run, skip initial
      // The monthly cron will handle it
      console.log('[ExitLoadSync] Exit load data exists (' + stats.seededFunds + ' funds), skipping initial run');
      return false;
    } catch (error) {
      console.error('[ExitLoadSync] Error checking initial enrichment status:', error);
      return false;
    }
  }

  /**
   * Calculate next scheduled run date
   */
  private getNextScheduledRun(): Date {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Create date for 1st of current month at 3 AM IST
    let nextRun = new Date(currentYear, currentMonth, 1, 3, 0, 0, 0);
    
    // Adjust for IST (UTC+5:30) - create in local time then convert
    // If already past 1st of this month at 3 AM IST, use next month
    const istOffset = 5.5 * 60 * 60 * 1000;
    const nowIst = new Date(now.getTime() + istOffset);
    
    if (nowIst.getDate() > 1 || (nowIst.getDate() === 1 && nowIst.getHours() >= 3)) {
      // Move to next month
      if (currentMonth === 11) {
        nextRun = new Date(currentYear + 1, 0, 1, 3, 0, 0, 0);
      } else {
        nextRun = new Date(currentYear, currentMonth + 1, 1, 3, 0, 0, 0);
      }
    }
    
    // Convert IST to UTC for display
    const utcTime = nextRun.getTime() - istOffset;
    return new Date(utcTime);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[ExitLoadSync] Scheduler stopped');
    }
  }

  /**
   * Run sync manually (admin trigger)
   */
  async runSync(): Promise<{ seeded: number; skipped: number; errors: number }> {
    if (this.isRunning) {
      console.log('[ExitLoadSync] Sync already in progress, skipping...');
      return { seeded: 0, skipped: 0, errors: 0 };
    }

    this.isRunning = true;
    console.log('[ExitLoadSync] Starting exit load sync...');

    try {
      const result = await exitLoadSeedService.seedExitLoadData();
      exitLoadService.clearCache();

      this.lastSyncTime = new Date();
      this.lastSyncResult = result;

      console.log(`[ExitLoadSync] Sync complete: ${result.seeded} seeded, ${result.skipped} skipped, ${result.errors} errors`);
      return result;
    } catch (error) {
      console.error('[ExitLoadSync] Sync error:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Force refresh all exit load data
   */
  async forceRefresh(): Promise<{ seeded: number; skipped: number; errors: number }> {
    console.log('[ExitLoadSync] Force refresh requested...');
    exitLoadService.clearCache();
    return this.runSync();
  }

  /**
   * Get scheduler status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    schedulerActive: boolean;
    schedule: string;
    lastSyncTime: Date | null;
    lastSyncResult: { seeded: number; skipped: number; errors: number } | null;
    lastEnrichmentResult: {
      popularFunds: { seeded: number; skipped: number; errors: number };
      categoryBased: { seeded: number; skipped: number; errors: number };
      isinEnrichment: { enriched: number; alreadyHasIsin: number; noMatchFound: number };
    } | null;
    nextScheduledSync: Date;
    stats: {
      seededFunds: number;
      totalTiers: number;
      popularFundsCount: number;
      withIsin: number;
      withoutIsin: number;
    };
  }> {
    const stats = await exitLoadSeedService.getStats();

    return {
      isRunning: this.isRunning,
      schedulerActive: this.cronJob !== null,
      schedule: '1st of every month at 3:00 AM IST',
      lastSyncTime: this.lastSyncTime,
      lastSyncResult: this.lastSyncResult,
      lastEnrichmentResult: this.lastEnrichmentResult,
      nextScheduledSync: this.getNextScheduledRun(),
      stats
    };
  }

  /**
   * Run full enrichment pipeline (popular funds + category-based + ISIN enrichment)
   */
  async runFullEnrichment(): Promise<{
    popularFunds: { seeded: number; skipped: number; errors: number };
    categoryBased: { seeded: number; skipped: number; errors: number };
    isinEnrichment: { enriched: number; alreadyHasIsin: number; noMatchFound: number };
    finalStats: { seededFunds: number; totalTiers: number; withIsin: number; withoutIsin: number };
  }> {
    if (this.isRunning) {
      console.log('[ExitLoadSync] Enrichment already in progress, skipping...');
      throw new Error('Enrichment already in progress');
    }

    this.isRunning = true;
    console.log('[ExitLoadSync] Starting full enrichment pipeline...');

    try {
      const result = await exitLoadSeedService.runFullEnrichment();
      this.lastSyncTime = new Date();
      this.lastEnrichmentResult = {
        popularFunds: result.popularFunds,
        categoryBased: result.categoryBased,
        isinEnrichment: result.isinEnrichment
      };
      
      exitLoadService.clearCache();
      
      console.log('[ExitLoadSync] Full enrichment complete');
      console.log(`   Popular funds: ${result.popularFunds.seeded} seeded`);
      console.log(`   Category-based: ${result.categoryBased.seeded} seeded`);
      console.log(`   ISIN enrichment: ${result.isinEnrichment.enriched} enriched`);
      console.log(`   Total coverage: ${result.finalStats.withIsin}/${result.finalStats.seededFunds} with ISIN`);
      
      return result;
    } finally {
      this.isRunning = false;
    }
  }
}

export const exitLoadSyncScheduler = new ExitLoadSyncScheduler();
