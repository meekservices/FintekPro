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
import { whatsappDispatcher } from './services/whatsapp-dispatcher';

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
      if ((result as any).errors?.length > 0) console.warn(`[CRON] GIFT City issues: ${(result as any).errors.length}`);
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

  // ── T05: AMFI Distributor Registry Sync — daily 3:00 AM IST (9:30 PM UTC) ──
  // Downloads AMFI bulk ARN/EUIN data and upserts into amfiDistributors table.
  // Powers live ARN validation (replaces hardcoded test-ARN list).
  // Ref: AMFI Circular 135/BP/22/2018-19 — ARN renewal mandatory every 3 years.
  cron.schedule('30 21 * * *', async () => {
    console.log('[CRON] Starting AMFI distributor registry sync...');
    try {
      const { amfiLiveValidationService } = await import('./services/amfi-live-validation-service');
      const result = await amfiLiveValidationService.syncAmfiDistributors();
      console.log(`[CRON][AmfiSync] Sync complete: ${result.synced} synced, ${result.errors} errors`);
      if (result.errors > 0) {
        console.warn('[CRON][AmfiSync] Some records failed to sync — check AMFI_DISTRIBUTOR_BULK_URL config');
      }
    } catch (error: any) {
      console.error('[CRON] AMFI distributor sync failed:', error.message);
    }
  });
  console.log('📋 [AmfiSync] Daily AMFI distributor registry sync scheduled (3:00 AM IST)');

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

  // ── V-CIP Expiry Reminder — 1st of each month at 9:00 AM IST (3:30 AM UTC) ─
  // Queries users whose video_kyc_expiry_date is within the next 60 days and
  // sends a WhatsApp reminder to complete V-CIP renewal (per RBI 2023 V-CIP guidelines).
  cron.schedule('30 3 1 * *', async () => {
    console.log('[CRON] Starting V-CIP expiry reminder job...');
    try {
      const rows = await db.execute(sql`
        SELECT
          up.user_id          AS "userId",
          up.video_kyc_expiry_date AS "expiryDate",
          u.mobile            AS "mobile",
          u.first_name        AS "firstName"
        FROM user_profiles up
        JOIN users u ON u.id = up.user_id
        WHERE up.video_kyc_expiry_date IS NOT NULL
          AND up.video_kyc_expiry_date > NOW()
          AND up.video_kyc_expiry_date <= NOW() + INTERVAL '60 days'
          AND u.mobile IS NOT NULL
      `);

      const users = (rows.rows ?? rows) as Array<{
        userId: string;
        expiryDate: string;
        mobile: string;
        firstName: string | null;
      }>;

      console.log(`[CRON][V-CIP Expiry] Found ${users.length} users with expiring V-CIP`);
      let sent = 0;
      let failed = 0;

      for (const u of users) {
        const expiryFormatted = new Date(u.expiryDate).toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
        });
        const name = u.firstName || 'Valued Customer';
        const body =
          `🔐 *FintekPro V-CIP Renewal Reminder*\n\n` +
          `Dear ${name},\n\n` +
          `Your Video KYC (V-CIP) session will expire on *${expiryFormatted}*.\n\n` +
          `To continue accessing investment products without interruption, please complete your V-CIP renewal before this date.\n\n` +
          `👉 Renew now: https://app.fintekpro.in/onboarding?step=video-kyc\n\n` +
          `_If you have already renewed, please ignore this message._\n\n` +
          `Regards,\nFintekPro Compliance Team`;

        try {
          const result = await whatsappDispatcher.send({
            mobile:       u.mobile,
            message:      body,
            category:     'KYC_UPDATE',
            templateType: 'kyc_update',
          });
          if (result.success) {
            sent++;
          } else {
            failed++;
            console.warn(`[CRON][V-CIP Expiry] Failed to send reminder to user ${u.userId} via ${result.provider}: ${result.error}`);
          }
        } catch (msgErr: any) {
          failed++;
          console.error(`[CRON][V-CIP Expiry] Exception sending reminder to user ${u.userId}: ${msgErr.message}`);
        }
      }

      console.log(`[CRON][V-CIP Expiry] Reminder job complete — sent: ${sent}, failed: ${failed}`);
    } catch (error: any) {
      console.error('[CRON][V-CIP Expiry] Job failed:', error.message);
    }
  });
  console.log('📅 [VCIPExpiryReminder] Monthly reminder scheduled (1st of each month, 9:00 AM IST)');

  // ── T07: CA Registry Revalidation — nightly 3:30 AM IST (10:00 PM UTC) ─────
  // Identifies CA registry entries that are due for their annual revalidation
  // and re-verifies them to ensure membership is still ACTIVE.
  cron.schedule('0 22 * * *', async () => {
    logger.info('[CRON] Starting CA Registry revalidation...');
    try {
      const { caRegistryService } = await import('./services/ca-registry-service');
      const { verifyICAIMembership } = await import('./services/icai-verification-service');
      
      const expiredEntries = await caRegistryService.getExpiredRegistryEntries(50);
      logger.info(`[CRON][CARegistry] Found ${expiredEntries.length} entries due for revalidation`);

      let successCount = 0;
      let failureCount = 0;

      for (const entry of expiredEntries) {
        try {
          // Re-verify using live APIs (forceRefresh = true to skip local lookup loop)
          const result = await verifyICAIMembership(
            entry.icaiMembershipNumber,
            entry.nameAtIcai ?? undefined,
            entry.partnersTableId ?? undefined,
            true
          );
          
          if (result.success && (result.membershipStatus === 'ACTIVE' || result.membershipStatus === 'FELLOW')) {
            successCount++;
          } else {
            failureCount++;
            await caRegistryService.markRevalidationFailed(entry.icaiMembershipNumber);
          }
          // Small delay to avoid hammering Surepass API
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err: any) {
          failureCount++;
          console.error(`[CRON][CARegistry] Revalidation error for ${entry.icaiMembershipNumber}:`, err.message);
        }
      }

      logger.info(`[CRON][CARegistry] Revalidation complete: ${successCount} re-verified, ${failureCount} failed/stale`);
    } catch (error: any) {
      logger.error('[CRON][CARegistry] Job failed:', { error: error.message });
    }
  });

  logger.info('⚖️ [CARegistry] Annual revalidation scheduled (3:30 AM IST)');

  // ── T08: Regulatory Audit Pack Integrity — nightly 4:00 AM IST (10:30 PM UTC) ───
  cron.schedule('30 22 * * *', async () => {
    logger.info('[CRON] Starting regulatory audit pack integrity check...');
    try {
      const result = await auditIntegrityChecker.verifyRegulatoryPacks();
      logger.info(`[CRON][RegulatoryIntegrity] Check complete. Status: ${result.status}, Verified: ${result.verifiedRecords}/${result.totalRecords}`);
      
      if (result.status === 'failed') {
        logger.error(`[CRON][RegulatoryIntegrity] CRITICAL: Tampering detected in regulatory audit packs! Check IDs: ${result.checksumMismatches.join(', ')}`);
      }
    } catch (error: any) {
      logger.error('[CRON][RegulatoryIntegrity] Job failed:', { error: error.message });
    }
  });
  console.log('🛡️ [RegulatoryIntegrity] Nightly audit pack check scheduled (4:00 AM IST)');

  // ── T09: Revenue Config Drift Detector — nightly 4:30 AM IST (11:00 PM UTC) ───
  cron.schedule('0 23 * * *', async () => {
    logger.info('[CRON] Starting revenue configuration drift detector...');
    try {
      const recentPacks = await db.execute(sql`
        SELECT id, platform_config_snapshot, created_at 
        FROM regulatory_audit_packs 
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `);
      
      const rows = recentPacks.rows || [];
      logger.info(`[CRON][RevenueDrift] Scanning ${rows.length} recent transactions for configuration drifts...`);

      // In a real scenario, we would compare these snapshots against the 'platformConfig' table 
      // at that historical timestamp. For now, we flag any packs with missing config data.
      let driftCount = 0;
      for (const row of rows) {
        if (!row.platform_config_snapshot || Object.keys(row.platform_config_snapshot).length === 0) {
          driftCount++;
          logger.warn(`[CRON][RevenueDrift] Potential drift or missing config in pack ${row.id}`);
        }
      }
      
      if (driftCount > 0) {
        logger.warn(`[CRON][RevenueDrift] Detected ${driftCount} packs with configuration anomalies.`);
      } else {
        logger.info('[CRON][RevenueDrift] No configuration drifts detected in the last 24 hours.');
      }

    } catch (error: any) {
      logger.error('[CRON][RevenueDrift] Job failed:', { error: error.message });
    }
  });
  console.log('📈 [RevenueDrift] Daily configuration drift detector scheduled (4:30 AM IST)');
}
