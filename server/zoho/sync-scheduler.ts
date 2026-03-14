import cron from 'node-cron';

let incrementalTask: cron.ScheduledTask | null = null;
let webhookTask: cron.ScheduledTask | null = null;
let reconciliationTask: cron.ScheduledTask | null = null;

function isSyncEnabled(): boolean {
  if (process.env.ZOHO_SYNC_ENABLED === 'true') return true;
  if (process.env.ZOHO_SYNC_ENABLED === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

export function startZohoSyncScheduler(): void {
  if (!isSyncEnabled()) {
    console.log('[ZohoSyncScheduler] Skipped - sync not enabled (set ZOHO_SYNC_ENABLED=true or run in production)');
    return;
  }

  console.log('[ZohoSyncScheduler] Starting Zoho sync scheduler...');

  incrementalTask = cron.schedule('*/30 * * * *', async () => {
    console.log('[ZohoSyncScheduler] Running scheduled incremental sync...');
    try {
      const { ZohoSyncOrchestrator } = await import('./services/sync-orchestrator');
      const orchestrator = await ZohoSyncOrchestrator.create();
      if (!orchestrator) return;
      const report = await orchestrator.runIncrementalSync();
      console.log(`[ZohoSyncScheduler] Incremental sync done: ${report.summary.totalProcessed} processed, ${report.summary.totalUpdated} updated, ${report.summary.totalConflicts} conflicts, ${report.summary.totalErrors} errors`);
    } catch (error: any) {
      console.error('[ZohoSyncScheduler] Incremental sync failed:', error.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  webhookTask = cron.schedule('*/2 * * * *', async () => {
    try {
      const { ZohoWebhookProcessor } = await import('./services/webhook-processor');
      const processor = await ZohoWebhookProcessor.create();
      if (!processor) return;
      const result = await processor.processPendingEvents(50);
      if (result.processed > 0) {
        console.log(`[ZohoSyncScheduler] Webhook processing: ${result.succeeded} ok, ${result.failed} failed, ${result.deadLettered} dead-lettered`);
      }
    } catch (error: any) {
      console.error('[ZohoSyncScheduler] Webhook processing failed:', error.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  reconciliationTask = cron.schedule('0 6 * * *', async () => {
    console.log('[ZohoSyncScheduler] Running daily reconciliation...');
    try {
      const { ZohoSyncOrchestrator } = await import('./services/sync-orchestrator');
      const orchestrator = await ZohoSyncOrchestrator.create();
      if (!orchestrator) return;
      const report = await orchestrator.runReconciliation();

      const totalConflicts = report.modules.reduce((s, m) => s + m.conflictCount, 0);
      const totalUnmapped = report.modules.reduce((s, m) => s + m.unmappedCount, 0);

      if (totalConflicts > 0 || report.financialDiscrepancies.length > 0) {
        console.warn(`[ZohoSyncScheduler] RECONCILIATION ALERT: ${totalConflicts} conflicts, ${report.financialDiscrepancies.length} financial discrepancies, ${totalUnmapped} unmapped records`);
      } else {
        console.log(`[ZohoSyncScheduler] Reconciliation clean: ${totalUnmapped} unmapped records, 0 conflicts`);
      }
    } catch (error: any) {
      console.error('[ZohoSyncScheduler] Reconciliation failed:', error.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[ZohoSyncScheduler] Scheduled: incremental sync every 30min, webhook processing every 2min, reconciliation daily at 6:00 AM IST');
}

export function stopZohoSyncScheduler(): void {
  if (incrementalTask) { incrementalTask.stop(); incrementalTask = null; }
  if (webhookTask) { webhookTask.stop(); webhookTask = null; }
  if (reconciliationTask) { reconciliationTask.stop(); reconciliationTask = null; }
  console.log('[ZohoSyncScheduler] Stopped');
}
