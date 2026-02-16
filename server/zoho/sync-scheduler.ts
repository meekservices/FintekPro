import cron from 'node-cron';

let incrementalTask: cron.ScheduledTask | null = null;
let webhookTask: cron.ScheduledTask | null = null;

export function startZohoSyncScheduler(): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[ZohoSyncScheduler] Skipped - bidirectional sync cron only runs in production');
    return;
  }

  console.log('[ZohoSyncScheduler] Starting production-only Zoho sync scheduler...');

  incrementalTask = cron.schedule('0 */4 * * *', async () => {
    console.log('[ZohoSyncScheduler] Running scheduled incremental sync...');
    try {
      const { ZohoSyncOrchestrator } = await import('./services/sync-orchestrator');
      const orchestrator = new ZohoSyncOrchestrator();
      const report = await orchestrator.runIncrementalSync();
      console.log(`[ZohoSyncScheduler] Incremental sync done: ${report.summary.totalProcessed} processed, ${report.summary.totalUpdated} updated, ${report.summary.totalErrors} errors`);
    } catch (error: any) {
      console.error('[ZohoSyncScheduler] Incremental sync failed:', error.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  webhookTask = cron.schedule('*/15 * * * *', async () => {
    try {
      const { ZohoWebhookProcessor } = await import('./services/webhook-processor');
      const processor = new ZohoWebhookProcessor();
      const result = await processor.processPendingEvents(50);
      if (result.processed > 0) {
        console.log(`[ZohoSyncScheduler] Webhook processing: ${result.succeeded} succeeded, ${result.failed} failed`);
      }
    } catch (error: any) {
      console.error('[ZohoSyncScheduler] Webhook processing failed:', error.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[ZohoSyncScheduler] Scheduled: incremental sync every 4h, webhook processing every 15min');
}

export function stopZohoSyncScheduler(): void {
  if (incrementalTask) { incrementalTask.stop(); incrementalTask = null; }
  if (webhookTask) { webhookTask.stop(); webhookTask = null; }
  console.log('[ZohoSyncScheduler] Stopped');
}
