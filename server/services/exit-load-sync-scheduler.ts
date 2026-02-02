/**
 * Exit Load Sync Scheduler
 * Monthly refresh of exit load data with ISIN enrichment
 * Runs full enrichment pipeline: popular funds + category-based + ISIN mapping
 */

import { exitLoadSeedService } from "./exit-load-seed-service";
import { exitLoadService } from "./exit-load-service";

class ExitLoadSyncScheduler {
  private isRunning = false;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // Monthly (30 days)
  private lastSyncTime: Date | null = null;
  private lastSyncResult: { seeded: number; skipped: number; errors: number } | null = null;
  private lastEnrichmentResult: {
    popularFunds: { seeded: number; skipped: number; errors: number };
    categoryBased: { seeded: number; skipped: number; errors: number };
    isinEnrichment: { enriched: number; alreadyHasIsin: number; noMatchFound: number };
  } | null = null;

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.schedulerInterval) {
      console.log('[ExitLoadSync] Scheduler already running');
      return;
    }

    console.log('📊 [ExitLoadSync] Exit load sync scheduler started (monthly enrichment)');

    // Run initial full enrichment on startup (delayed by 2 minutes to allow other services to start)
    setTimeout(() => {
      this.runFullEnrichment().catch(err => {
        console.error('[ExitLoadSync] Initial enrichment failed:', err);
      });
    }, 2 * 60 * 1000);

    // Schedule monthly enrichment
    this.schedulerInterval = setInterval(() => {
      this.runFullEnrichment().catch(err => {
        console.error('[ExitLoadSync] Scheduled enrichment failed:', err);
      });
    }, this.SYNC_INTERVAL_MS);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
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
      // Seed/update exit load data
      const result = await exitLoadSeedService.seedExitLoadData();
      
      // Clear cache to pick up new data
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
   * Force refresh all exit load data (clears existing and re-seeds)
   */
  async forceRefresh(): Promise<{ seeded: number; skipped: number; errors: number }> {
    console.log('[ExitLoadSync] Force refresh requested...');
    
    // Clear cache first
    exitLoadService.clearCache();
    
    // Run sync (it will seed new data and skip existing)
    return this.runSync();
  }

  /**
   * Get scheduler status
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    lastSyncTime: Date | null;
    lastSyncResult: { seeded: number; skipped: number; errors: number } | null;
    lastEnrichmentResult: {
      popularFunds: { seeded: number; skipped: number; errors: number };
      categoryBased: { seeded: number; skipped: number; errors: number };
      isinEnrichment: { enriched: number; alreadyHasIsin: number; noMatchFound: number };
    } | null;
    nextScheduledSync: Date | null;
    syncIntervalDays: number;
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
      lastSyncTime: this.lastSyncTime,
      lastSyncResult: this.lastSyncResult,
      lastEnrichmentResult: this.lastEnrichmentResult,
      nextScheduledSync: this.lastSyncTime 
        ? new Date(this.lastSyncTime.getTime() + this.SYNC_INTERVAL_MS)
        : null,
      syncIntervalDays: 30,
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
      
      // Clear cache after enrichment
      exitLoadService.clearCache();
      
      console.log('[ExitLoadSync] Full enrichment complete');
      return result;
    } finally {
      this.isRunning = false;
    }
  }
}

export const exitLoadSyncScheduler = new ExitLoadSyncScheduler();
