/**
 * Retention Policy Cleanup Service
 * PMLA/RBI Compliant 8-Year Retention Policy
 * 
 * This service manages:
 * - Cleanup of expired consents past retention period
 * - Archival and deletion of audit logs
 * - Scheduled cron jobs for automated cleanup
 */

import cron from 'node-cron';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, lt, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const RETENTION_PERIOD_YEARS = 8;
const CLEANUP_BATCH_SIZE = 100;

interface CleanupResult {
  consentsArchived: number;
  consentsDeleted: number;
  auditLogsArchived: number;
  auditLogsDeleted: number;
  errors: string[];
  executedAt: Date;
}

class RetentionCleanupService {
  private isRunning = false;
  private lastCleanupResult: CleanupResult | null = null;

  /**
   * Calculate the cutoff date for retention (8 years ago)
   */
  private getRetentionCutoffDate(): Date {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - RETENTION_PERIOD_YEARS);
    return cutoff;
  }

  /**
   * Calculate retention expiry date (8 years from now)
   */
  private getRetentionExpiryDate(): Date {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + RETENTION_PERIOD_YEARS);
    return expiry;
  }

  /**
   * Archive expired consents before deletion
   */
  private async archiveExpiredConsents(cutoffDate: Date): Promise<{ archived: number; errors: string[] }> {
    const errors: string[] = [];
    let archived = 0;

    try {
      // Find consents that have exceeded retention period
      const expiredConsents = await db.select()
        .from(schema.schemeConsents)
        .where(
          and(
            lt(schema.schemeConsents.createdAt, cutoffDate),
            eq(schema.schemeConsents.status, 'verified')
          )
        )
        .limit(CLEANUP_BATCH_SIZE);

      for (const consent of expiredConsents) {
        try {
          // Create archive record in audit log before deletion
          await db.insert(schema.governmentSchemeAudit).values({
            userId: consent.userId,
            schemeType: consent.schemeType,
            eventType: 'consent_archived',
            requestId: `archive-${nanoid()}`,
            timestamp: new Date(),
            ipAddress: 'system',
            userAgent: 'RetentionCleanupService/1.0',
            details: {
              originalConsentId: consent.id,
              archiveReason: 'retention_policy_cleanup',
              retentionPeriodYears: RETENTION_PERIOD_YEARS,
              originalCreatedAt: consent.createdAt,
              originalVerifiedAt: consent.verifiedAt,
              archivedAt: new Date().toISOString()
            },
            retentionExpiresAt: this.getRetentionExpiryDate()
          });
          archived++;
        } catch (error: any) {
          errors.push(`Failed to archive consent ${consent.id}: ${error.message}`);
        }
      }
    } catch (error: any) {
      errors.push(`Failed to query expired consents: ${error.message}`);
    }

    return { archived, errors };
  }

  /**
   * Delete consents that have been archived
   */
  private async deleteArchivedConsents(cutoffDate: Date): Promise<{ deleted: number; errors: string[] }> {
    const errors: string[] = [];
    let deleted = 0;

    try {
      // Delete consents older than retention period
      const result = await db.delete(schema.schemeConsents)
        .where(
          and(
            lt(schema.schemeConsents.createdAt, cutoffDate),
            eq(schema.schemeConsents.status, 'verified')
          )
        );

      // Drizzle returns affected rows differently based on driver
      deleted = (result as any).rowCount || 0;
    } catch (error: any) {
      errors.push(`Failed to delete archived consents: ${error.message}`);
    }

    return { deleted, errors };
  }

  /**
   * Archive old audit logs (create summary before deletion)
   */
  private async archiveOldAuditLogs(cutoffDate: Date): Promise<{ archived: number; errors: string[] }> {
    const errors: string[] = [];
    let archived = 0;

    try {
      // Count audit logs to be deleted for archival summary using retentionExpiresAt
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(schema.governmentSchemeAudit)
        .where(lt(schema.governmentSchemeAudit.retentionExpiresAt, new Date()));

      archived = Number(countResult[0]?.count || 0);

      if (archived > 0) {
        // Create summary archive record
        await db.insert(schema.governmentSchemeAudit).values({
          userId: 'system',
          schemeType: 'all',
          eventType: 'audit_logs_archived',
          requestId: `bulk-archive-${nanoid()}`,
          timestamp: new Date(),
          ipAddress: 'system',
          userAgent: 'RetentionCleanupService/1.0',
          details: {
            archiveType: 'bulk_retention_cleanup',
            recordsArchived: archived,
            cutoffDate: cutoffDate.toISOString(),
            retentionPeriodYears: RETENTION_PERIOD_YEARS,
            archivedAt: new Date().toISOString()
          },
          retentionExpiresAt: this.getRetentionExpiryDate()
        });
      }
    } catch (error: any) {
      errors.push(`Failed to archive audit logs: ${error.message}`);
    }

    return { archived, errors };
  }

  /**
   * Delete audit logs past retention period
   */
  private async deleteOldAuditLogs(): Promise<{ deleted: number; errors: string[] }> {
    const errors: string[] = [];
    let deleted = 0;

    try {
      // Delete audit logs that have passed their retention expiry date
      const result = await db.delete(schema.governmentSchemeAudit)
        .where(
          and(
            lt(schema.governmentSchemeAudit.retentionExpiresAt, new Date()),
            // Don't delete system archive records (they have fresh retention dates)
            sql`${schema.governmentSchemeAudit.eventType} != 'audit_logs_archived'`
          )
        );

      deleted = (result as any).rowCount || 0;
    } catch (error: any) {
      errors.push(`Failed to delete old audit logs: ${error.message}`);
    }

    return { deleted, errors };
  }

  /**
   * Run the complete cleanup process
   */
  async runCleanup(): Promise<CleanupResult> {
    if (this.isRunning) {
      console.log('[RETENTION_CLEANUP] Cleanup already in progress, skipping...');
      return {
        consentsArchived: 0,
        consentsDeleted: 0,
        auditLogsArchived: 0,
        auditLogsDeleted: 0,
        errors: ['Cleanup already in progress'],
        executedAt: new Date()
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const cutoffDate = this.getRetentionCutoffDate();
    const allErrors: string[] = [];

    console.log('\n🗂️ [RETENTION_CLEANUP] Starting cleanup process');
    console.log(`   Cutoff date: ${cutoffDate.toISOString()} (${RETENTION_PERIOD_YEARS} years ago)`);

    try {
      // Step 1: Archive consents
      console.log('   📦 Archiving expired consents...');
      const archiveConsents = await this.archiveExpiredConsents(cutoffDate);
      allErrors.push(...archiveConsents.errors);

      // Step 2: Delete archived consents
      console.log('   🗑️ Deleting archived consents...');
      const deleteConsents = await this.deleteArchivedConsents(cutoffDate);
      allErrors.push(...deleteConsents.errors);

      // Step 3: Archive audit logs
      console.log('   📦 Archiving old audit logs...');
      const archiveAudit = await this.archiveOldAuditLogs(cutoffDate);
      allErrors.push(...archiveAudit.errors);

      // Step 4: Delete old audit logs
      console.log('   🗑️ Deleting old audit logs...');
      const deleteAudit = await this.deleteOldAuditLogs();
      allErrors.push(...deleteAudit.errors);

      const result: CleanupResult = {
        consentsArchived: archiveConsents.archived,
        consentsDeleted: deleteConsents.deleted,
        auditLogsArchived: archiveAudit.archived,
        auditLogsDeleted: deleteAudit.deleted,
        errors: allErrors,
        executedAt: new Date()
      };

      this.lastCleanupResult = result;

      const duration = Date.now() - startTime;
      console.log(`\n✅ [RETENTION_CLEANUP] Completed in ${duration}ms`);
      console.log(`   Consents: ${result.consentsArchived} archived, ${result.consentsDeleted} deleted`);
      console.log(`   Audit logs: ${result.auditLogsArchived} archived, ${result.auditLogsDeleted} deleted`);
      if (allErrors.length > 0) {
        console.log(`   ⚠️ Errors: ${allErrors.length}`);
        allErrors.forEach(e => console.log(`      - ${e}`));
      }

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get the last cleanup result
   */
  getLastCleanupResult(): CleanupResult | null {
    return this.lastCleanupResult;
  }

  /**
   * Check if cleanup is currently running
   */
  isCleanupRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Schedule the cleanup cron job
   * Runs daily at 2:00 AM to minimize impact on users
   */
  scheduleCleanup(): void {
    // Run daily at 2:40 AM (staggered to avoid collision with other 2AM jobs)
    cron.schedule('40 2 * * *', async () => {
      console.log('\n⏰ [CRON] Running scheduled retention cleanup...');
      try {
        await this.runCleanup();
      } catch (error) {
        console.error('[CRON] Retention cleanup failed:', error);
      }
    }, {
      timezone: 'Asia/Kolkata' // IST for Indian regulatory compliance
    });

    console.log('📅 [RETENTION_CLEANUP] Scheduled daily cleanup at 2:00 AM IST');
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats(): Promise<{
    pendingConsentsForCleanup: number;
    pendingAuditLogsForCleanup: number;
    lastCleanupResult: CleanupResult | null;
    nextScheduledRun: string;
  }> {
    const cutoffDate = this.getRetentionCutoffDate();

    const [consentCount, auditCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(schema.schemeConsents)
        .where(lt(schema.schemeConsents.createdAt, cutoffDate)),
      db.select({ count: sql<number>`count(*)` })
        .from(schema.governmentSchemeAudit)
        .where(lt(schema.governmentSchemeAudit.retentionExpiresAt, new Date()))
    ]);

    // Calculate next 2:00 AM IST
    const now = new Date();
    const next2AM = new Date(now);
    next2AM.setHours(2, 0, 0, 0);
    if (next2AM <= now) {
      next2AM.setDate(next2AM.getDate() + 1);
    }

    return {
      pendingConsentsForCleanup: Number(consentCount[0]?.count || 0),
      pendingAuditLogsForCleanup: Number(auditCount[0]?.count || 0),
      lastCleanupResult: this.lastCleanupResult,
      nextScheduledRun: next2AM.toISOString()
    };
  }
}

export const retentionCleanupService = new RetentionCleanupService();
