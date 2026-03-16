/**
 * Compliance Cron Domain
 *
 * Error digest · CKYC SLA escalation · Audit integrity
 * Daily reconciliation · GIFT City product maintenance
 */

import cron from 'node-cron';
import { ckycSlaEscalationService } from './services/ckyc-sla-escalation-service';
import { auditIntegrityChecker } from './services/audit-integrity-checker';
import { dailyReconciliationService } from './services/daily-reconciliation-service';
import { giftCityMaintenanceService } from './services/gift-city-maintenance-service';
import { errorDigestService } from './services/error-digest-service';
import { isProductionEnvironment } from './utils/enrichment-guard';

export function initializeComplianceCrons(): void {
  if (!isProductionEnvironment()) {
    console.log('⏭️ [ErrorDigest] Skipped (development mode - production only)');
    console.log('⏭️ [CKYC SLA] Skipped (development mode - production only)');
    console.log('⏭️ [AuditIntegrity] Skipped (development mode - production only)');
    console.log('⏭️ [CompanyRefresh/Reconciliation/GIFTCity] Skipped (development mode - production only)');
    return;
  }

  // ── Error digest — daily at 8:10 AM IST (2:40 AM UTC) ─────────────────────
  cron.schedule('40 2 * * *', async () => {
    console.log('[CRON] Starting daily error digest...');
    try {
      await errorDigestService.runDailyDigest();
      console.log('[CRON] Daily error digest completed');
    } catch (error: any) {
      console.error('[CRON] Error digest job failed:', error.message);
    }
  });
  console.log('📊 [ErrorDigest] Daily error digest scheduled (8:00 AM IST)');

  // ── CKYC SLA escalation ─────────────────────────────────────────────────────
  try {
    ckycSlaEscalationService.initialize();
  } catch (error: any) {
    console.error('[CRON] Failed to initialize CKYC SLA Escalation Service:', error.message);
  }

  // ── Audit trail integrity checker ───────────────────────────────────────────
  try {
    const auditCheckIntervalMinutes = parseInt(process.env.AUDIT_INTEGRITY_CHECK_INTERVAL_MINUTES || '60', 10);
    auditIntegrityChecker.initialize(auditCheckIntervalMinutes);
    console.log(`[CRON] Audit Integrity Checker initialized (every ${auditCheckIntervalMinutes} minutes)`);
  } catch (error: any) {
    console.error('[CRON] Failed to initialize Audit Integrity Checker:', error.message);
  }

  // ── Daily reconciliation — 1:00 AM IST (7:30 PM UTC previous day) ─────────
  cron.schedule('30 19 * * *', async () => {
    console.log('[CRON] Starting daily reconciliation...');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const report = await dailyReconciliationService.runDailyReconciliation(yesterday, 'system_cron');
      console.log(`[CRON] Daily reconciliation completed: ${report.id}`);
      console.log(`[CRON] Summary: ${report.summary.totalTransactions} transactions, ${report.summary.discrepancyCount} discrepancies`);
      if (report.summary.discrepancyCount > 0) {
        console.warn(`[CRON] ATTENTION: ${report.summary.discrepancyCount} discrepancies detected`);
      }
    } catch (error: any) {
      console.error('[CRON] Daily reconciliation job failed:', error.message);
    }
  });
  console.log('📊 [DailyReconciliation] Daily reconciliation scheduled (1:00 AM IST)');

  // ── GIFT City product maintenance — 2:20 AM IST (8:50 PM UTC) ─────────────
  // Staggered 20 min after MCA Enrichment Sweep (2:00 AM IST, '30 20 * * *')
  cron.schedule('50 20 * * *', async () => {
    console.log('[CRON] Starting GIFT City product maintenance...');
    try {
      const result = await giftCityMaintenanceService.runMaintenance();
      console.log(`[CRON] GIFT City maintenance: ${result.totalProducts} total, ${result.validatedProducts} validated, ${result.updatedProducts} updated`);
      if (result.issues.length > 0) console.warn(`[CRON] GIFT City issues: ${result.issues.length}`);
    } catch (error: any) {
      console.error('[CRON] GIFT City maintenance job failed:', error.message);
    }
  });
  console.log('🏙️ [GiftCityMaintenance] Daily maintenance scheduled (2:20 AM IST)');
}
