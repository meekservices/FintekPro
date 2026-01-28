/**
 * Cache Cleanup Scheduler
 * 
 * Runs periodic cleanup jobs for expired cache entries and
 * schedules quarterly data refresh jobs aligned with filing dates.
 * 
 * Schedule:
 * - Daily at 3 AM IST: Clean up expired cache entries
 * - Quarterly (May 15, Aug 15, Nov 15, Feb 15): Trigger financials refresh
 */

import cron from 'node-cron';
import { sql } from 'drizzle-orm';
import { dataCacheService } from './unified-data-cache-service';
import { db } from '../db';

class CacheCleanupScheduler {
  private isRunning = false;
  
  /**
   * Initialize all scheduled jobs
   */
  initialize() {
    if (this.isRunning) {
      console.log('[CacheScheduler] Already running, skipping initialization');
      return;
    }
    
    console.log('[CacheScheduler] Initializing cache cleanup schedules...');
    
    // Daily cleanup at 3 AM IST (21:30 UTC previous day)
    cron.schedule('30 21 * * *', async () => {
      console.log('[CacheScheduler] Running daily cache cleanup...');
      await this.runDailyCleanup();
    });
    
    // Quarterly financials refresh reminder
    // May 15 (Q4 results), Aug 15 (Q1 results), Nov 15 (Q2 results), Feb 15 (Q3 results)
    cron.schedule('0 6 15 2,5,8,11 *', async () => {
      console.log('[CacheScheduler] Quarterly refresh trigger...');
      await this.logQuarterlyRefreshReminder();
    });
    
    // Every hour: Update cache statistics
    cron.schedule('0 * * * *', async () => {
      await this.updateCacheStatistics();
    });
    
    this.isRunning = true;
    console.log('[CacheScheduler] Cache cleanup schedules initialized');
  }
  
  /**
   * Run daily cleanup of expired cache entries
   */
  async runDailyCleanup(): Promise<{ deleted: number }> {
    try {
      const result = await dataCacheService.cleanupExpiredCache();
      console.log(`[CacheScheduler] Daily cleanup complete. Deleted ${result.deleted} expired entries.`);
      
      // Log to cache_refresh_schedule
      await db.execute(sql`
        UPDATE cache_refresh_schedule 
        SET last_run_at = NOW(), 
            last_run_status = 'success',
            last_run_records_processed = ${result.deleted},
            next_run_at = NOW() + INTERVAL '1 day'
        WHERE cache_type = 'cleanup'
      `);
      
      return result;
    } catch (error: any) {
      console.error('[CacheScheduler] Daily cleanup failed:', error.message);
      
      await db.execute(sql`
        UPDATE cache_refresh_schedule 
        SET last_run_at = NOW(), 
            last_run_status = 'failed',
            last_run_errors = ${JSON.stringify([{ error: error.message, timestamp: new Date().toISOString() }])}::jsonb
        WHERE cache_type = 'cleanup'
      `);
      
      throw error;
    }
  }
  
  /**
   * Log quarterly refresh reminder (actual refresh happens on-demand)
   */
  async logQuarterlyRefreshReminder() {
    console.log('[CacheScheduler] Quarterly filing period detected.');
    console.log('[CacheScheduler] Company financials will be refreshed on next access (120-day TTL expired).');
    
    // Mark in database for admin visibility
    await db.execute(sql`
      UPDATE cache_refresh_schedule 
      SET last_run_at = NOW(), 
          last_run_status = 'reminder_sent',
          next_run_at = NOW() + INTERVAL '3 months'
      WHERE cache_type = 'quarterly_financials'
    `);
  }
  
  /**
   * Update cache statistics for monitoring
   */
  async updateCacheStatistics() {
    try {
      const stats = await dataCacheService.getCacheStats();
      console.log(`[CacheScheduler] Cache stats - Companies: ${stats.companyMaster.count}, Verifications: ${stats.verifications.count}, Hit rate: ${stats.apiUsage.hitRate.toFixed(1)}%`);
    } catch (error) {
      console.error('[CacheScheduler] Failed to update cache statistics:', error);
    }
  }
  
  /**
   * Initialize default refresh schedules in database
   */
  async initializeScheduleRecords() {
    try {
      // Insert default schedules if they don't exist
      const schedules = [
        { type: 'cleanup', frequency: 'daily', cron: '30 21 * * *' },
        { type: 'quarterly_financials', frequency: 'quarterly', cron: '0 6 15 2,5,8,11 *' },
        { type: 'verification_cache', frequency: 'none', cron: null },
        { type: 'company_master', frequency: 'none', cron: null },
        { type: 'market_data_quotes', frequency: 'realtime', cron: null },
        { type: 'market_data_nav', frequency: 'daily', cron: '0 20 * * *' },
      ];
      
      for (const schedule of schedules) {
        await db.execute(sql`
          INSERT INTO cache_refresh_schedule (cache_type, refresh_frequency, cron_expression, next_run_at)
          VALUES (${schedule.type}, ${schedule.frequency}, ${schedule.cron}, NOW() + INTERVAL '1 day')
          ON CONFLICT DO NOTHING
        `);
      }
      
      console.log('[CacheScheduler] Default schedule records initialized');
    } catch (error) {
      console.error('[CacheScheduler] Failed to initialize schedule records:', error);
    }
  }
  
  /**
   * Manual trigger for cleanup (for admin use)
   */
  async triggerManualCleanup(): Promise<{ deleted: number }> {
    console.log('[CacheScheduler] Manual cleanup triggered');
    return this.runDailyCleanup();
  }
}

// Singleton instance
export const cacheCleanupScheduler = new CacheCleanupScheduler();
