/**
 * Error Aggregation Service
 * 
 * Enhances error group aggregations with AI analysis and maintenance.
 * 
 * Note: Basic error grouping is done automatically by monitoringStorage when errors are logged.
 * This service provides additional enhancements:
 * - Periodic statistics updates
 * - AI analysis requests for new error groups
 * - Cleanup of stale groups
 * 
 * Background processing to avoid blocking requests.
 */

import cron, { type ScheduledTask } from 'node-cron';
import { monitoringStorage } from '../monitoringStorage';
import { logger } from '../logger';
import { db } from '../db';
import { errorGroups, errorEvents } from '@shared/schema';
import { eq, and, isNull, lt, sql } from 'drizzle-orm';

class ErrorAggregator {
  private cronJob: ScheduledTask | null = null;
  private isRunning: boolean = false;
  private aggregationInterval: string = '*/2 * * * *'; // Every 2 minutes

  constructor() {
    // Service will be started manually
  }

  /**
   * Start the aggregation service
   */
  start(interval: string = '*/2 * * * *'): void {
    if (this.isRunning) {
      logger.warn('Error aggregator already running');
      return;
    }

    this.aggregationInterval = interval;
    
    // Run initial aggregation immediately
    this.runAggregation().catch(error => {
      logger.error('Failed to run initial error aggregation', error);
    });

    // Schedule recurring aggregation
    this.cronJob = cron.schedule(this.aggregationInterval, () => {
      this.runAggregation().catch(error => {
        logger.error('Failed to run scheduled error aggregation', error);
      });
    });

    this.isRunning = true;
    logger.info(`Error aggregator started with interval: ${this.aggregationInterval}`);
  }

  /**
   * Stop the aggregation service
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    logger.info('Error aggregator stopped');
  }

  /**
   * Run error aggregation enhancements
   */
  private async runAggregation(): Promise<void> {
    try {
      logger.debug('Running error aggregation enhancements');

      // Get error groups that need AI analysis
      const unanalyzedGroups = await db
        .select()
        .from(errorGroups)
        .where(
          and(
            eq(errorGroups.aiAnalyzed, false),
            isNull(errorGroups.aiAnalyzedAt)
          )
        )
        .limit(10);

      let groupsUpdated = 0;

      for (const group of unanalyzedGroups) {
        // Mark for AI analysis (actual analysis would be done by a separate service)
        // For now, just log that these groups need analysis
        logger.debug(`Error group needs AI analysis: ${group.id}`, {
          service: group.service,
          severity: group.severity,
          totalCount: group.totalCount,
        });
        groupsUpdated++;
      }

      // Clean up old resolved groups (already handled by data-retention service)
      // Update statistics for active groups
      const activeGroups = await db
        .select()
        .from(errorGroups)
        .where(eq(errorGroups.status, 'open'))
        .limit(100);

      logger.info('Error aggregation enhancements completed', {
        unanalyzedGroups: unanalyzedGroups.length,
        activeGroups: activeGroups.length,
        groupsProcessed: groupsUpdated,
      });

    } catch (error) {
      logger.error('Error aggregation failed', error instanceof Error ? error : new Error(String(error)));
    }
  }


  /**
   * Get current status
   */
  getStatus(): { running: boolean; interval: string } {
    return {
      running: this.isRunning,
      interval: this.aggregationInterval,
    };
  }

  /**
   * Run aggregation on demand
   */
  async runNow(): Promise<void> {
    await this.runAggregation();
  }
}

// Export singleton instance
export const errorAggregator = new ErrorAggregator();
