/**
 * Exit Load Sync Scheduler
 * Periodically refreshes exit load data and provides admin trigger capability
 */

import { exitLoadSeedService } from "./exit-load-seed-service";
import { exitLoadService } from "./exit-load-service";

class ExitLoadSyncScheduler {
  private isRunning = false;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly (7 days)
  private lastSyncTime: Date | null = null;
  private lastSyncResult: { seeded: number; skipped: number; errors: number } | null = null;

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.schedulerInterval) {
      console.log('[ExitLoadSync] Scheduler already running');
      return;
    }

    console.log('📊 [ExitLoadSync] Exit load sync scheduler started (weekly refresh)');

    // Run initial sync on startup
    this.runSync().catch(err => {
      console.error('[ExitLoadSync] Initial sync failed:', err);
    });

    // Schedule weekly sync
    this.schedulerInterval = setInterval(() => {
      this.runSync().catch(err => {
        console.error('[ExitLoadSync] Scheduled sync failed:', err);
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
    nextScheduledSync: Date | null;
    stats: {
      totalFunds: number;
      fundsWithExitLoad: number;
      coveragePercent: number;
      totalTiers: number;
    };
  }> {
    const stats = await exitLoadSeedService.getStats();

    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      lastSyncResult: this.lastSyncResult,
      nextScheduledSync: this.lastSyncTime 
        ? new Date(this.lastSyncTime.getTime() + this.SYNC_INTERVAL_MS)
        : null,
      stats
    };
  }

  /**
   * Get funds that need exit load data
   */
  async getFundsMissingData(limit: number = 50): Promise<string[]> {
    return exitLoadSeedService.getFundsWithoutExitLoadData(limit);
  }
}

export const exitLoadSyncScheduler = new ExitLoadSyncScheduler();
