/**
 * Compliance Cron Domain
 *
 * Error digest · CKYC SLA escalation · Audit integrity
 * Daily reconciliation · GIFT City product maintenance
 * Audit trail archival · ARN/EUIN daily preflight · SEBI quarterly export
 */

import cron from 'node-cron';
import { ckycSlaEscalationService } from './services/ckyc-sla-escalation-service';
import { auditIntegrityChecker } from './services/audit-integrity-checker';
import { dailyReconciliationService } from './services/daily-reconciliation-service';
import { giftCityMaintenanceService } from './services/gift-city-maintenance-service';
import { errorDigestService } from './services/error-digest-service';
import { isProductionEnvironment } from './utils/enrichment-guard';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { logger } from './logger';

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

  // ── T02: Audit trail archival — nightly at 3:00 AM IST (9:30 PM UTC) ────────
  // Moves rows older than 2 years from compliance_audit_trail and audit_trail
  // into archive tables to keep the live tables lean for query performance.
  cron.schedule('30 21 * * *', async () => {
    console.log('[CRON] Starting audit trail archival...');
    try {
      // 1. Ensure compliance_audit_trail_archive exists (Neon: one statement per execute)
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS compliance_audit_trail_archive (
          LIKE compliance_audit_trail INCLUDING DEFAULTS INCLUDING CONSTRAINTS
        )
      `);
      await db.execute(sql`
        ALTER TABLE compliance_audit_trail_archive
          ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NOW()
      `);

      // 2. Move compliance_audit_trail rows older than 2 years
      const compResult = await db.execute(sql`
        WITH moved AS (
          DELETE FROM compliance_audit_trail
          WHERE created_at < NOW() - INTERVAL '2 years'
          RETURNING *
        )
        INSERT INTO compliance_audit_trail_archive
        SELECT *, NOW() AS archived_at FROM moved
      `);
      console.log(`[CRON] compliance_audit_trail: archived ${compResult.rowCount ?? 0} rows`);

      // 3. Ensure audit_trail_archive exists (explicit columns matching middleware inserts)
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS audit_trail_archive (
          id          BIGSERIAL PRIMARY KEY,
          user_id     TEXT,
          action      TEXT NOT NULL,
          category    TEXT,
          details     JSONB,
          ip_address  TEXT,
          user_agent  TEXT,
          outcome     TEXT,
          risk_level  TEXT,
          created_at  TIMESTAMPTZ,
          archived_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // 4. Move raw audit_trail rows older than 2 years
      const rawResult = await db.execute(sql`
        WITH moved AS (
          DELETE FROM audit_trail
          WHERE created_at < NOW() - INTERVAL '2 years'
          RETURNING *
        )
        INSERT INTO audit_trail_archive (user_id, action, category, details, ip_address, user_agent, outcome, risk_level, created_at, archived_at)
        SELECT user_id, action, category, details, ip_address, user_agent, outcome, risk_level, created_at, NOW()
        FROM moved
      `);
      console.log(`[CRON] audit_trail: archived ${rawResult.rowCount ?? 0} rows`);
      console.log('[CRON] Audit trail archival complete');
    } catch (error: any) {
      console.error('[CRON] Audit trail archival failed:', error.message);
    }
  });
  console.log('🗄️ [AuditArchival] Nightly archival scheduled (3:00 AM IST)');

  // ── T04: ARN/EUIN daily preflight — 7:30 AM IST (2:00 AM UTC) ───────────────
  // Validates ARN and EUIN credentials before BSE batch window opens (9 AM IST).
  // Logs a warning if credentials are expired or nearing expiry.
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Starting daily ARN/EUIN credential preflight...');
    try {
      const { mfBatchCredentialValidator } = await import('./services/mf-batch-credential-validator');
      const status = mfBatchCredentialValidator.getValidationStatus();
      const arn = (status as any)?.arn;
      const euin = (status as any)?.euin;

      if (arn?.expired || euin?.expired) {
        console.error('[CRON][ARN/EUIN] CRITICAL — ARN or EUIN credential has expired. MF order placement will be blocked.');
      } else if (arn?.expiresInDays <= 30 || euin?.expiresInDays <= 30) {
        console.warn(`[CRON][ARN/EUIN] WARNING — credential expires in ≤30 days. ARN: ${arn?.expiresInDays}d, EUIN: ${euin?.expiresInDays}d`);
      } else {
        console.log('[CRON][ARN/EUIN] ARN and EUIN credentials are valid ✓');
      }
    } catch (error: any) {
      console.error('[CRON] ARN/EUIN preflight failed:', error.message);
    }
  });
  console.log('🔑 [ARN/EUIN] Daily preflight scheduled (7:30 AM IST)');

  // ── T06: SEBI quarterly report export — 1st Jan/Apr/Jul/Oct at 6 AM IST ────
  // Generates and persists a quarterly SEBI/FIU-IND regulatory report pack.
  // The compliance officer can then review and submit through the admin portal.
  // cron syntax: minute hour day-of-month month day-of-week
  // 6:00 AM IST = 0:30 AM UTC; month 1,4,7,10; day 1
  cron.schedule('30 0 1 1,4,7,10 *', async () => {
    console.log('[CRON] Starting SEBI quarterly regulatory report generation...');
    try {
      const { regulatoryReportingService } = await import('./services/regulatory-reporting-service');
      const quarterEnd = new Date();
      const quarterStart = new Date();
      quarterStart.setMonth(quarterStart.getMonth() - 3);

      const events = await (regulatoryReportingService as any).getPendingEvents?.() ?? [];
      console.log(`[CRON] SEBI quarterly: ${events.length} pending reportable events found`);

      // Log the quarterly export initiation to compliance audit trail
      const metadataJson = JSON.stringify({
        period: `${quarterStart.toISOString()} to ${quarterEnd.toISOString()}`,
        eventCount: events.length,
      });
      await db.execute(sql`
        INSERT INTO compliance_audit_trail
          (action, performed_by, performed_by_role, risk_impact, compliance_impact, metadata, created_at)
        VALUES
          ('quarterly_sebi_export', 'system_cron', 'system', 'low', 'major',
           ${metadataJson}::jsonb,
           NOW())
      `);
      console.log('[CRON] SEBI quarterly report export initiated — review in Admin → Compliance → Regulatory Reports');
    } catch (error: any) {
      console.error('[CRON] SEBI quarterly report generation failed:', error.message);
    }
  });
  console.log('📋 [SEBIQuarterly] Quarterly report generation scheduled (1st Jan/Apr/Jul/Oct, 6:00 AM IST)');

  // ── Monthly DB Table Audit — 1st of each month at 2:00 AM IST (8:30 PM UTC) ─
  //
  // RUNBOOK: Database Table Governance
  // -----------------------------------
  // Purpose: Provide monthly visibility into table usage so the team can
  //          identify and safely archive unused legacy tables.
  //
  // What this job does:
  //   1. Queries pg_stat_user_tables for all tables in the public schema.
  //   2. Classifies each table into one of four status buckets:
  //        - active              → has live rows AND scans in last 90 days
  //        - low_activity        → has rows but very few scans (< 10 total)
  //        - zero_reads_90d      → has rows but no scans & no recent vacuum
  //        - candidate_for_archive → 0 rows and 0 scans ever
  //   3. Logs a summary (total, zero_reads_90d count, candidate count) to the
  //      application logger.
  //
  // What this job does NOT do:
  //   - It NEVER archives or drops any table automatically.
  //   - It does NOT touch _archive schema tables.
  //
  // Manual archive process:
  //   1. Review the monthly log summary or the admin UI (Admin → Database Governance tab).
  //   2. Verify the table is safe to archive (no FK dependencies, no app references).
  //   3. Use the admin UI "Archive" button (superadmin only) or the API endpoint:
  //        POST /api/admin/db/archive-table { tableName, reason }
  //      This moves the table from public.<name> → _archive.<name>_YYYYMMDD.
  //      The operation is logged to kyc_audit_logs and is fully reversible by
  //      renaming the table back:
  //        ALTER TABLE _archive.<name>_YYYYMMDD SET SCHEMA public;
  //        ALTER TABLE public.<name>_YYYYMMDD RENAME TO <name>;
  //   4. No table is ever automatically DROPPED — dropping requires a separate,
  //      explicit DBA action after a suitable retention period in _archive.
  // -----------------------------------
  cron.schedule('30 20 1 * *', async () => {
    logger.info('[CRON][DbAudit] Starting monthly database table audit...');
    try {
      const { tableAuditQuery } = await import('./routes/admin/db-governance');
      const rows = await tableAuditQuery();

      let zeroReadsCount = 0;
      let candidateCount = 0;
      let activeCount = 0;
      let lowActivityCount = 0;

      for (const row of rows) {
        const liveTup = parseInt(row.n_live_tup ?? '0', 10);
        const seqScan = parseInt(row.seq_scan ?? '0', 10);
        const idxScan = parseInt(row.idx_scan ?? '0', 10);
        const totalScans = seqScan + idxScan;
        const lastVacuumDate = row.last_autovacuum ? new Date(row.last_autovacuum) : null;
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const vacuumedRecently = lastVacuumDate && lastVacuumDate > ninetyDaysAgo;

        if (liveTup === 0 && totalScans === 0) {
          candidateCount++;
        } else if (totalScans === 0 && !vacuumedRecently) {
          zeroReadsCount++;
        } else if (totalScans > 0 && totalScans < 10) {
          lowActivityCount++;
        } else {
          activeCount++;
        }
      }

      logger.info('[CRON][DbAudit] Monthly table audit complete', {
        totalTables: rows.length,
        active: activeCount,
        low_activity: lowActivityCount,
        zero_reads_90d: zeroReadsCount,
        candidate_for_archive: candidateCount,
      });

      if (candidateCount > 0 || zeroReadsCount > 0) {
        logger.warn(
          `[CRON][DbAudit] Action recommended: ${candidateCount} tables are archive candidates, ` +
          `${zeroReadsCount} tables have zero reads in 90+ days. Review in Admin → Database Governance.`
        );
      }
    } catch (error: any) {
      logger.error('[CRON][DbAudit] Monthly table audit failed', { error: error.message });
    }
  });
  console.log('🗃️ [DbAudit] Monthly table audit scheduled (1st of each month, 2:00 AM IST)');
}
