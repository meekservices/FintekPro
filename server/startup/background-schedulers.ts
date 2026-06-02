const SCHEDULER_START_DELAY_MS = 5000;
const AUDIT_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function startKycExpiryMonitor() {
  if (process.env.NODE_ENV !== "production") return;

  const { kycExpiryMonitor } = await import("../services/kyc-expiry-monitor");
  kycExpiryMonitor.start();
}

async function startPickOfTheDayScheduler() {
  console.log("📈 Starting Pick of the Day Scheduler...");
  const { pickOfTheDayService } = await import("../services/pick-of-the-day-service");
  pickOfTheDayService.startDailyScheduler();
}

/**
 * Auto-publishes listed_stocks rows that already have a valid price but are
 * still marked is_published=false. This is the primary root cause of the
 * pick engine finding zero candidates and silently skipping listed_stocks.
 *
 * Safe: only sets is_published=true — never deletes or overrides manual unpublish.
 * Runs on startup AND every 24 hours.
 */
async function autoPublishListedStocks() {
  console.log("🔓 [AutoPublish] Checking for unpublished stocks with valid prices...");
  const { db } = await import("../db");
  const { sql } = await import("drizzle-orm");

  const result = await db.execute(sql`
    UPDATE listed_stocks
    SET is_published = true,
        published_at  = NOW(),
        published_by  = 'system_auto_publish'
    WHERE is_published = false
      AND is_active = true
      AND current_price IS NOT NULL
      AND CAST(current_price AS DECIMAL) > 50
  `);

  const count = (result as any).rowCount ?? (result as any).count ?? '?';
  console.log(`✅ [AutoPublish] Auto-published ${count} listed_stocks rows with valid prices.`);

  // Re-run every 24 h so newly synced stocks are picked up automatically
  setInterval(async () => {
    try {
      await db.execute(sql`
        UPDATE listed_stocks
        SET is_published = true,
            published_at  = NOW(),
            published_by  = 'system_auto_publish'
        WHERE is_published = false
          AND is_active = true
          AND current_price IS NOT NULL
          AND CAST(current_price AS DECIMAL) > 50
      `);
    } catch (err) {
      console.error('❌ [AutoPublish] Periodic auto-publish failed:', err);
    }
  }, 24 * 60 * 60 * 1000);
}

async function startActivityInsightsMonitoring() {
  const { activityInsightsService } = await import("../services/activity-insights-service");
  activityInsightsService.startAutomatedMonitoring();
}

async function startUnlistedRegulatoryAuditCleanup() {
  console.log("🛡️ Starting Unlisted Regulatory Audit Cleanup Scheduler...");
  const { unlistedRegulatoryAuditService } = await import("../services/unlisted-regulatory-audit-service");

  await unlistedRegulatoryAuditService.cleanupExpiredRecords(false);

  setInterval(async () => {
    try {
      await unlistedRegulatoryAuditService.cleanupExpiredRecords(false);
    } catch (error) {
      console.error("❌ Failed to run periodic audit cleanup:", error);
    }
  }, AUDIT_CLEANUP_INTERVAL_MS);
}

async function startKycLrsMonitor() {
  console.log("📊 Starting KYC LRS/TCS Monitor Service...");
  const { kycLrsMonitorService } = await import("../services/kyc-lrs-monitor-service");
  kycLrsMonitorService.start();
}

async function verifyForensicAuditIntegrity() {
  console.log("🔍 Running Forensic Audit Integrity Verification...");
  const { auditLogService } = await import("../services/audit-log-service");
  const integrityResult = await auditLogService.verifyChainIntegrity();

  if (integrityResult.valid) {
    console.log("✅ Forensic Audit Chain Integrity: VERIFIED (HMAC-SHA256 Chain Intact)");
  } else {
    console.error("❌ [CRITICAL] Forensic Audit Chain BREACHED! Tampering detected.");
    console.error("Broken Links:", JSON.stringify(integrityResult.brokenLinks, null, 2));
  }

  if (!process.env.COMPLIANCE_SECRET) {
    console.warn("⚠️ [WARNING] COMPLIANCE_SECRET is not set. Forensic integrity is compromised.");
  }
}

async function runStartupTask(name: string, task: () => Promise<void>) {
  try {
    await task();
  } catch (error) {
    console.error(`❌ Failed to start ${name}:`, error);
  }
}

export function startBackgroundSchedulers(delayMs = SCHEDULER_START_DELAY_MS) {
  if (process.env.RUN_BACKGROUND_SCHEDULERS === "false") {
    console.log("[Schedulers] Background schedulers disabled by RUN_BACKGROUND_SCHEDULERS=false");
    return undefined;
  }

  return setTimeout(async () => {
    await runStartupTask("KYC Expiry Monitor", startKycExpiryMonitor);
    // Auto-publish listed stocks BEFORE starting the pick scheduler so the stock
    // strategy has valid candidates on the very first boot.
    await runStartupTask("Auto-Publish Listed Stocks", autoPublishListedStocks);
    await runStartupTask("Pick of the Day Scheduler", startPickOfTheDayScheduler);
    await runStartupTask("AI Regulatory Monitoring", startActivityInsightsMonitoring);
    await runStartupTask("Unlisted Regulatory Audit Cleanup", startUnlistedRegulatoryAuditCleanup);
    await runStartupTask("KYC LRS/TCS Monitor Service", startKycLrsMonitor);
    await runStartupTask("Forensic Audit Integrity Verification", verifyForensicAuditIntegrity);
  }, delayMs);
}
