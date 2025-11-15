/**
 * Data Retention Service
 * 
 * Automatically cleans up old data based on retention policies.
 * 
 * Retention Policies:
 * - Error Events: 90 days
 * - API Health Logs: 30 days
 * - System Metrics: 30 days
 * - Audit Logs (compliance): 7 years
 * - KYC Audit Logs: 7 years
 * - Resolved Error Groups: 90 days
 */

import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../logger';
import { db } from '../db';
import { errorEvents, errorGroups, apiHealthLogs, systemMetrics } from '@shared/schema';
import { and, lt, eq, sql } from 'drizzle-orm';

interface RetentionPolicy {
  tableName: string;
  days: number;
  conditions?: any;
}

class DataRetentionService {
  private cronJob: ScheduledTask | null = null;
  private isRunning: boolean = false;
  private cleanupInterval: string = '0 2 * * *'; // Daily at 2 AM

  private retentionPolicies: RetentionPolicy[] = [
    // Error monitoring data - 90 days
    { tableName: 'error_events', days: 90 },
    // API health logs - 30 days
    { tableName: 'api_health_logs', days: 30 },
    // System metrics - 30 days
    { tableName: 'system_metrics', days: 30 },
    // Resolved error groups - 90 days
    { tableName: 'error_groups', days: 90 },
    // Note: Audit logs and KYC logs are kept for 7 years (handled separately)
  ];

  constructor() {
    // Service will be started manually
  }

  /**
   * Start the retention service
   */
  start(interval: string = '0 2 * * *'): void {
    if (this.isRunning) {
      logger.warn('Data retention service already running');
      return;
    }

    this.cleanupInterval = interval;
    
    // Run initial cleanup immediately (async, non-blocking)
    setTimeout(() => {
      this.runCleanup().catch(error => {
        logger.error('Failed to run initial data cleanup', error);
      });
    }, 60000); // Wait 1 minute after startup

    // Schedule daily cleanup
    this.cronJob = cron.schedule(this.cleanupInterval, () => {
      this.runCleanup().catch(error => {
        logger.error('Failed to run scheduled data cleanup', error);
      });
    });

    this.isRunning = true;
    logger.info(`Data retention service started with interval: ${this.cleanupInterval}`);
  }

  /**
   * Stop the retention service
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    logger.info('Data retention service stopped');
  }

  /**
   * Run data cleanup
   */
  private async runCleanup(): Promise<void> {
    logger.info('Starting data retention cleanup');
    const startTime = Date.now();
    let totalDeleted = 0;

    try {
      // Clean error events (90 days)
      const errorCutoff = this.getCutoffDate(90);
      const deletedErrors = await db
        .delete(errorEvents)
        .where(lt(errorEvents.occurredAt, errorCutoff))
        .returning({ id: errorEvents.id });
      
      logger.info(`Deleted ${deletedErrors.length} error events older than 90 days`);
      totalDeleted += deletedErrors.length;

      // Clean API health logs (30 days)
      const healthCutoff = this.getCutoffDate(30);
      const deletedHealth = await db
        .delete(apiHealthLogs)
        .where(lt(apiHealthLogs.checkedAt, healthCutoff))
        .returning({ id: apiHealthLogs.id });
      
      logger.info(`Deleted ${deletedHealth.length} API health logs older than 30 days`);
      totalDeleted += deletedHealth.length;

      // Clean system metrics (30 days)
      const metricsCutoff = this.getCutoffDate(30);
      const deletedMetrics = await db
        .delete(systemMetrics)
        .where(lt(systemMetrics.collectedAt, metricsCutoff))
        .returning({ id: systemMetrics.id });
      
      logger.info(`Deleted ${deletedMetrics.length} system metrics older than 30 days`);
      totalDeleted += deletedMetrics.length;

      // Clean resolved error groups (90 days)
      const groupsCutoff = this.getCutoffDate(90);
      const deletedGroups = await db
        .delete(errorGroups)
        .where(
          and(
            eq(errorGroups.status, 'resolved'),
            lt(errorGroups.resolvedAt, groupsCutoff)
          )
        )
        .returning({ id: errorGroups.id });
      
      logger.info(`Deleted ${deletedGroups.length} resolved error groups older than 90 days`);
      totalDeleted += deletedGroups.length;

      // Vacuum database to reclaim space
      await this.vacuumDatabase();

      const duration = Date.now() - startTime;
      logger.info('Data retention cleanup completed', {
        totalDeleted,
        durationMs: duration,
      });

    } catch (error) {
      logger.error('Data retention cleanup failed', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get cutoff date for retention
   */
  private getCutoffDate(days: number): Date {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return cutoff;
  }

  /**
   * Vacuum database to reclaim space
   */
  private async vacuumDatabase(): Promise<void> {
    try {
      logger.debug('Running database vacuum');
      await db.execute(sql`VACUUM ANALYZE`);
      logger.debug('Database vacuum completed');
    } catch (error) {
      logger.warn('Database vacuum failed (this is normal on some cloud providers)', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get current status
   */
  getStatus(): {
    running: boolean;
    interval: string;
    policies: RetentionPolicy[];
  } {
    return {
      running: this.isRunning,
      interval: this.cleanupInterval,
      policies: this.retentionPolicies,
    };
  }

  /**
   * Run cleanup on demand
   */
  async runNow(): Promise<void> {
    await this.runCleanup();
  }

  /**
   * Preview what would be deleted (dry run)
   */
  async previewCleanup(): Promise<{
    errorEvents: number;
    apiHealthLogs: number;
    systemMetrics: number;
    errorGroups: number;
  }> {
    const errorCutoff = this.getCutoffDate(90);
    const healthCutoff = this.getCutoffDate(30);
    const metricsCutoff = this.getCutoffDate(30);
    const groupsCutoff = this.getCutoffDate(90);

    const [errorCount, healthCount, metricsCount, groupsCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(errorEvents)
        .where(lt(errorEvents.occurredAt, errorCutoff))
        .then(r => Number(r[0]?.count || 0)),
      
      db
        .select({ count: sql<number>`count(*)` })
        .from(apiHealthLogs)
        .where(lt(apiHealthLogs.checkedAt, healthCutoff))
        .then(r => Number(r[0]?.count || 0)),
      
      db
        .select({ count: sql<number>`count(*)` })
        .from(systemMetrics)
        .where(lt(systemMetrics.collectedAt, metricsCutoff))
        .then(r => Number(r[0]?.count || 0)),
      
      db
        .select({ count: sql<number>`count(*)` })
        .from(errorGroups)
        .where(
          and(
            eq(errorGroups.status, 'resolved'),
            lt(errorGroups.resolvedAt, groupsCutoff)
          )
        )
        .then(r => Number(r[0]?.count || 0)),
    ]);

    return {
      errorEvents: errorCount,
      apiHealthLogs: healthCount,
      systemMetrics: metricsCount,
      errorGroups: groupsCount,
    };
  }
}

// Export singleton instance
export const dataRetentionService = new DataRetentionService();
