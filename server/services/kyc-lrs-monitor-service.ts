// @ts-nocheck
import cron from 'node-cron';
import { db } from '../db';
import { lrsComplianceTracking, lrsTransactions } from '@shared/schema';
import { eq, and, sql, sum } from 'drizzle-orm';
import { auditLogService } from './audit-log-service';

/**
 * KYC LRS/TCS Monitor Service
 * 
 * Scheduled task to monitor Liberalized Remittance Scheme (LRS) limits
 * and Tax Collected at Source (TCS) thresholds for all users.
 */
class KycLrsMonitorService {
  private isRunning = false;

  /**
   * Start the LRS monitoring scheduler
   * Defaults to daily at midnight (0 0 * * *)
   */
  start(cronExpression: string = '0 0 * * *') {
    console.log(`[LRS Monitor] Starting scheduler with expression: ${cronExpression}`);
    
    cron.schedule(cronExpression, async () => {
      if (this.isRunning) {
        console.warn('[LRS Monitor] Previous run still in progress, skipping...');
        return;
      }

      this.isRunning = true;
      try {
        await this.runMonitoringCycle();
      } catch (error) {
        console.error('[LRS Monitor] Monitoring cycle failed:', error);
      } finally {
        this.isRunning = false;
      }
    });
  }

  /**
   * Run a single monitoring cycle for all active LRS tracking records
   */
  async runMonitoringCycle() {
    const currentFY = this.getCurrentFinancialYear();
    console.log(`[LRS Monitor] Running monitoring cycle for FY ${currentFY}...`);

    // 1. Get all active LRS tracking records for the current FY
    const activeTracking = await db.select()
      .from(lrsComplianceTracking)
      .where(eq(lrsComplianceTracking.financialYear, currentFY));

    console.log(`[LRS Monitor] Found ${activeTracking.length} active LRS records to check`);

    for (const record of activeTracking) {
      try {
        await this.processUserLrsLimits(record);
      } catch (err) {
        console.error(`[LRS Monitor] Failed to process user ${record.userId}:`, err);
      }
    }

    console.log('[LRS Monitor] Monitoring cycle complete');
  }

  /**
   * Recalculate and update LRS limits for a specific user
   */
  async processUserLrsLimits(record: any) {
    const userId = record.userId;
    const currentFY = record.financialYear;

    // 1. Aggregate total remittances for the user in this FY
    const result = await db.select({
      totalUsd: sum(lrsTransactions.amountUsd),
      totalInr: sum(lrsTransactions.amountInr),
      count: sql`count(*)`
    })
    .from(lrsTransactions)
    .where(
      and(
        eq(lrsTransactions.userId, userId),
        eq(lrsTransactions.trackingId, record.id),
        eq(lrsTransactions.status, 'completed')
      )
    );

    const stats = result[0];
    const totalUsd = parseFloat(stats.totalUsd || '0');
    const totalInr = parseFloat(stats.totalInr || '0');
    const txCount = parseInt(stats.count as any || '0');

    // 2. Check for limit violations ($250,000 USD)
    const LRS_LIMIT_USD = 250000;
    const TCS_THRESHOLD_INR = 700000;
    
    let isBlocked = record.isBlocked;
    let blockReason = record.blockReason;

    if (totalUsd >= LRS_LIMIT_USD && !isBlocked) {
      isBlocked = true;
      blockReason = `LRS Limit Exceeded: Total remitted $${totalUsd.toLocaleString()} exceeds statutory limit of $${LRS_LIMIT_USD.toLocaleString()} for FY ${currentFY}`;
      
      await auditLogService.log('COMPLIANCE', 'AUTO_BLOCK', {
        userId,
        entityType: 'lrs_tracking',
        entityId: record.id,
        newState: { isBlocked, blockReason },
        metadata: { totalUsd, currentFY }
      });
    }

    // 3. Update the tracking record
    await db.update(lrsComplianceTracking)
      .set({
        totalRemittedUsd: totalUsd.toString(),
        totalRemittedInr: totalInr.toString(),
        remainingLimitUsd: Math.max(0, LRS_LIMIT_USD - totalUsd).toString(),
        transactionCount: txCount,
        isBlocked,
        blockReason,
        updatedAt: new Date()
      })
      .where(eq(lrsComplianceTracking.id, record.id));

    // 4. Trigger Alerts via FEMA service logic
    if (totalUsd >= LRS_LIMIT_USD * 0.9) {
      console.log(`[LRS Monitor] ALERT: User ${userId} has utilized >90% of LRS limit ($${totalUsd})`);
    }

    if (totalInr >= TCS_THRESHOLD_INR) {
      console.log(`[LRS Monitor] INFO: User ${userId} has crossed ₹7 Lakh TCS threshold (Total: ₹${totalInr})`);
    }
  }

  private getCurrentFinancialYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }
}

export const kycLrsMonitorService = new KycLrsMonitorService();
