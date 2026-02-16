import { db } from '../../db';
import {
  zohoEntityMappings, zohoSyncLogs, zohoConnections,
  prospectClients, partnerCommissions, partners, users
} from '@shared/schema';
import { eq, and, sql, gte, desc, lt, count } from 'drizzle-orm';
import { ZohoApiClient } from '../api-client';
import { ZohoWebhookProcessor } from './webhook-processor';

const CONNECTION_ID = '1762VW9pAGQpLby6IdcmI';
const DATA_CENTER = 'in';

const SAFETY_WINDOW_MS = 5 * 60 * 1000;
const MAX_PAGES = 50;
const PAGE_SIZE = 200;

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

type SyncDirection = 'to_zoho' | 'from_zoho' | 'bidirectional';
type ConflictStrategy = 'last_write_wins' | 'zoho_wins' | 'fintekpro_wins';

interface SyncModuleConfig {
  zohoService: string;
  zohoModule: string;
  fintekproEntityType: string;
  direction: SyncDirection;
  conflictStrategy: ConflictStrategy;
  enabled: boolean;
}

interface SyncResult {
  module: string;
  direction: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  conflicts: number;
  errors: string[];
  durationMs: number;
}

interface FullSyncReport {
  startedAt: Date;
  completedAt: Date;
  totalDurationMs: number;
  modules: SyncResult[];
  webhookProcessing: { processed: number; succeeded: number; failed: number };
  summary: {
    totalProcessed: number;
    totalCreated: number;
    totalUpdated: number;
    totalConflicts: number;
    totalErrors: number;
  };
}

const SYNC_MODULES: SyncModuleConfig[] = [
  {
    zohoService: 'CRM',
    zohoModule: 'Contacts',
    fintekproEntityType: 'prospect',
    direction: 'bidirectional',
    conflictStrategy: 'last_write_wins',
    enabled: true
  },
  {
    zohoService: 'CRM',
    zohoModule: 'Leads',
    fintekproEntityType: 'prospect',
    direction: 'bidirectional',
    conflictStrategy: 'last_write_wins',
    enabled: true
  },
  {
    zohoService: 'CRM',
    zohoModule: 'Deals',
    fintekproEntityType: 'partner_commission',
    direction: 'bidirectional',
    conflictStrategy: 'last_write_wins',
    enabled: true
  },
  {
    zohoService: 'CRM',
    zohoModule: 'Accounts',
    fintekproEntityType: 'partner',
    direction: 'to_zoho',
    conflictStrategy: 'fintekpro_wins',
    enabled: true
  }
];

export class ZohoSyncOrchestrator {
  private connectionId: string;
  private crmClient: ZohoApiClient;
  private webhookProcessor: ZohoWebhookProcessor;

  constructor(connectionId: string = CONNECTION_ID) {
    this.connectionId = connectionId;
    this.crmClient = new ZohoApiClient(connectionId, 'CRM', DATA_CENTER);
    this.webhookProcessor = new ZohoWebhookProcessor(connectionId);
  }

  async runFullSync(): Promise<FullSyncReport> {
    if (!isProduction()) {
      console.log('[SyncOrchestrator] Full sync skipped - bidirectional sync only runs in production');
      const now = new Date();
      return {
        startedAt: now, completedAt: now, totalDurationMs: 0,
        modules: [], webhookProcessing: { processed: 0, succeeded: 0, failed: 0 },
        summary: { totalProcessed: 0, totalCreated: 0, totalUpdated: 0, totalConflicts: 0, totalErrors: 0 }
      };
    }

    const startedAt = new Date();
    console.log(`[SyncOrchestrator] Starting full sync at ${startedAt.toISOString()}`);

    const webhookResult = await this.webhookProcessor.processPendingEvents(100);
    console.log(`[SyncOrchestrator] Webhook processing: ${webhookResult.succeeded} succeeded, ${webhookResult.failed} failed`);

    const moduleResults: SyncResult[] = [];

    for (const config of SYNC_MODULES) {
      if (!config.enabled) continue;

      try {
        const result = await this.syncModule(config);
        moduleResults.push(result);
        console.log(`[SyncOrchestrator] ${config.zohoModule}: ${result.recordsProcessed} processed, ${result.recordsUpdated} updated, ${result.errors.length} errors`);
      } catch (error: any) {
        console.error(`[SyncOrchestrator] ${config.zohoModule} sync failed:`, error.message);
        moduleResults.push({
          module: config.zohoModule,
          direction: config.direction,
          recordsProcessed: 0,
          recordsCreated: 0,
          recordsUpdated: 0,
          recordsSkipped: 0,
          conflicts: 0,
          errors: [error.message],
          durationMs: 0
        });
      }
    }

    const completedAt = new Date();
    const report: FullSyncReport = {
      startedAt,
      completedAt,
      totalDurationMs: completedAt.getTime() - startedAt.getTime(),
      modules: moduleResults,
      webhookProcessing: {
        processed: webhookResult.processed,
        succeeded: webhookResult.succeeded,
        failed: webhookResult.failed
      },
      summary: {
        totalProcessed: moduleResults.reduce((s, r) => s + r.recordsProcessed, 0),
        totalCreated: moduleResults.reduce((s, r) => s + r.recordsCreated, 0),
        totalUpdated: moduleResults.reduce((s, r) => s + r.recordsUpdated, 0),
        totalConflicts: moduleResults.reduce((s, r) => s + r.conflicts, 0),
        totalErrors: moduleResults.reduce((s, r) => s + r.errors.length, 0)
      }
    };

    await this.logFullSync(report);
    console.log(`[SyncOrchestrator] Full sync completed in ${report.totalDurationMs}ms`);
    return report;
  }

  async runIncrementalSync(): Promise<FullSyncReport> {
    if (!isProduction()) {
      console.log('[SyncOrchestrator] Incremental sync skipped - bidirectional sync only runs in production');
      const now = new Date();
      return {
        startedAt: now, completedAt: now, totalDurationMs: 0,
        modules: [], webhookProcessing: { processed: 0, succeeded: 0, failed: 0 },
        summary: { totalProcessed: 0, totalCreated: 0, totalUpdated: 0, totalConflicts: 0, totalErrors: 0 }
      };
    }

    const startedAt = new Date();
    console.log(`[SyncOrchestrator] Starting incremental sync at ${startedAt.toISOString()}`);

    const webhookResult = await this.webhookProcessor.processPendingEvents(50);

    const moduleResults: SyncResult[] = [];

    for (const config of SYNC_MODULES) {
      if (!config.enabled) continue;
      if (config.direction === 'to_zoho') continue;

      try {
        const result = await this.syncModuleIncremental(config);
        moduleResults.push(result);
      } catch (error: any) {
        console.error(`[SyncOrchestrator] Incremental ${config.zohoModule} failed:`, error.message);
        moduleResults.push({
          module: config.zohoModule,
          direction: config.direction,
          recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0,
          recordsSkipped: 0, conflicts: 0,
          errors: [error.message], durationMs: 0
        });
      }
    }

    const completedAt = new Date();
    return {
      startedAt,
      completedAt,
      totalDurationMs: completedAt.getTime() - startedAt.getTime(),
      modules: moduleResults,
      webhookProcessing: { processed: webhookResult.processed, succeeded: webhookResult.succeeded, failed: webhookResult.failed },
      summary: {
        totalProcessed: moduleResults.reduce((s, r) => s + r.recordsProcessed, 0),
        totalCreated: moduleResults.reduce((s, r) => s + r.recordsCreated, 0),
        totalUpdated: moduleResults.reduce((s, r) => s + r.recordsUpdated, 0),
        totalConflicts: moduleResults.reduce((s, r) => s + r.conflicts, 0),
        totalErrors: moduleResults.reduce((s, r) => s + r.errors.length, 0)
      }
    };
  }

  private async syncModule(config: SyncModuleConfig): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      module: config.zohoModule,
      direction: config.direction,
      recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0,
      recordsSkipped: 0, conflicts: 0, errors: [], durationMs: 0
    };

    try {
      if (config.direction === 'from_zoho' || config.direction === 'bidirectional') {
        await this.pullFromZoho(config, result, null);
      }
    } catch (error: any) {
      result.errors.push(`Pull error: ${error.message}`);
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  private async syncModuleIncremental(config: SyncModuleConfig): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      module: config.zohoModule,
      direction: config.direction,
      recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0,
      recordsSkipped: 0, conflicts: 0, errors: [], durationMs: 0
    };

    const lastSync = await this.getLastSyncTime(config.zohoService, config.zohoModule);

    try {
      if (config.direction === 'from_zoho' || config.direction === 'bidirectional') {
        await this.pullFromZoho(config, result, lastSync);
      }
    } catch (error: any) {
      result.errors.push(`Incremental pull error: ${error.message}`);
    }

    result.durationMs = Date.now() - startTime;
    return result;
  }

  private async pullFromZoho(
    config: SyncModuleConfig, result: SyncResult, sinceDate: Date | null
  ): Promise<void> {
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= MAX_PAGES) {
      try {
        const params: any = {
          per_page: PAGE_SIZE,
          page,
          sort_by: 'Modified_Time',
          sort_order: 'desc'
        };

        if (sinceDate) {
          const sinceStr = sinceDate.toISOString().replace('T', ' ').substring(0, 19);
          params.criteria = `(Modified_Time:greater_than:${sinceStr})`;
        }

        const response = await this.crmClient.get(`/${config.zohoModule}`, params);
        const records = response.data?.data || [];
        const info = response.data?.info || {};
        hasMore = info.more_records === true;

        if (records.length === 0) break;

        for (const record of records) {
          try {
            await this.processIncomingRecord(config, record, result);
          } catch (error: any) {
            result.errors.push(`Record ${record.id}: ${error.message}`);
          }
        }

        page++;
      } catch (error: any) {
        if (error.response?.status === 204) {
          hasMore = false;
        } else {
          result.errors.push(`Page ${page} fetch error: ${error.message}`);
          break;
        }
      }
    }
  }

  private async processIncomingRecord(
    config: SyncModuleConfig, zohoRecord: any, result: SyncResult
  ): Promise<void> {
    result.recordsProcessed++;
    const recordId = zohoRecord.id;

    if (!recordId) {
      result.recordsSkipped++;
      return;
    }

    const [existingMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.zohoService, config.zohoService),
          eq(zohoEntityMappings.zohoModule, config.zohoModule),
          eq(zohoEntityMappings.zohoRecordId, recordId)
        )
      )
      .limit(1);

    if (existingMapping) {
      const hasConflict = this.detectConflict(existingMapping, zohoRecord, config.conflictStrategy);

      if (hasConflict) {
        result.conflicts++;
        const winner = this.resolveConflict(existingMapping, zohoRecord, config.conflictStrategy);

        if (winner === 'zoho') {
          await this.applyZohoUpdate(config, existingMapping, zohoRecord);
          result.recordsUpdated++;
        } else {
          result.recordsSkipped++;
        }

        await db
          .update(zohoEntityMappings)
          .set({
            conflictData: {
              detectedAt: new Date().toISOString(),
              resolution: winner,
              strategy: config.conflictStrategy,
              zohoModifiedTime: zohoRecord.Modified_Time
            },
            updatedAt: new Date()
          })
          .where(eq(zohoEntityMappings.id, existingMapping.id));
      } else {
        await this.applyZohoUpdate(config, existingMapping, zohoRecord);
        result.recordsUpdated++;
      }
    } else {
      const created = await this.createFromZoho(config, zohoRecord);
      if (created) {
        result.recordsCreated++;
      } else {
        result.recordsSkipped++;
      }
    }
  }

  private detectConflict(mapping: any, zohoRecord: any, strategy: ConflictStrategy): boolean {
    if (!mapping.lastSyncedAt) return false;

    const zohoModified = zohoRecord.Modified_Time ? new Date(zohoRecord.Modified_Time) : null;
    if (!zohoModified) return false;

    const lastSync = new Date(mapping.lastSyncedAt);
    const fintekproModified = mapping.updatedAt ? new Date(mapping.updatedAt) : lastSync;

    const zohoChangedSinceSync = zohoModified.getTime() > lastSync.getTime();
    const fintekproChangedSinceSync = fintekproModified.getTime() > lastSync.getTime() + SAFETY_WINDOW_MS;

    return zohoChangedSinceSync && fintekproChangedSinceSync;
  }

  private resolveConflict(mapping: any, zohoRecord: any, strategy: ConflictStrategy): 'zoho' | 'fintekpro' {
    if (strategy === 'zoho_wins') return 'zoho';
    if (strategy === 'fintekpro_wins') return 'fintekpro';

    const zohoModified = zohoRecord.Modified_Time ? new Date(zohoRecord.Modified_Time) : new Date(0);
    const fintekproModified = mapping.updatedAt ? new Date(mapping.updatedAt) : new Date(0);

    return zohoModified.getTime() >= fintekproModified.getTime() ? 'zoho' : 'fintekpro';
  }

  private async applyZohoUpdate(
    config: SyncModuleConfig, mapping: any, zohoRecord: any
  ): Promise<void> {
    const fintekproType = mapping.fintekproEntityType;
    const fintekproId = mapping.fintekproEntityId;

    if (fintekproType === 'prospect') {
      const updateData: any = { updatedAt: new Date() };
      if (zohoRecord.Email) updateData.email = zohoRecord.Email.toLowerCase().trim();
      if (zohoRecord.Mobile || zohoRecord.Phone) updateData.mobile = zohoRecord.Mobile || zohoRecord.Phone;
      const name = [zohoRecord.First_Name, zohoRecord.Last_Name].filter(Boolean).join(' ').trim();
      if (name) updateData.name = name;

      await db.update(prospectClients).set(updateData).where(eq(prospectClients.id, fintekproId));
    } else if (fintekproType === 'user') {
      const updateData: any = {};
      if (zohoRecord.Email) updateData.email = zohoRecord.Email.toLowerCase().trim();
      if (zohoRecord.Mobile || zohoRecord.Phone) updateData.phone = zohoRecord.Mobile || zohoRecord.Phone;
      const fullName = [zohoRecord.First_Name, zohoRecord.Last_Name].filter(Boolean).join(' ').trim();
      if (fullName) updateData.fullName = fullName;

      if (Object.keys(updateData).length > 0) {
        await db.update(users).set(updateData).where(eq(users.id, fintekproId));
      }
    } else if (fintekproType === 'partner_commission') {
      if (zohoRecord.Stage) {
        const statusMap: Record<string, string> = {
          'Qualification': 'pending',
          'Needs Analysis': 'approved',
          'Value Proposition': 'processing',
          'Closed Won': 'completed',
          'Closed Lost': 'cancelled',
          'Negotiation/Review': 'on_hold'
        };
        const newStatus = statusMap[zohoRecord.Stage];
        if (newStatus) {
          await db.update(partnerCommissions)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(partnerCommissions.id, fintekproId));
        }
      }
    } else if (fintekproType === 'partner') {
      if (zohoRecord.Account_Name) {
        await db.update(partners)
          .set({ companyName: zohoRecord.Account_Name })
          .where(eq(partners.id, fintekproId));
      }
    }

    await db
      .update(zohoEntityMappings)
      .set({
        zohoRecordData: zohoRecord,
        lastSyncedAt: new Date(),
        syncStatus: 'synced',
        updatedAt: new Date()
      })
      .where(eq(zohoEntityMappings.id, mapping.id));
  }

  private async createFromZoho(config: SyncModuleConfig, zohoRecord: any): Promise<boolean> {
    if (config.zohoModule === 'Contacts' || config.zohoModule === 'Leads') {
      const email = zohoRecord.Email?.toLowerCase().trim();
      const mobile = zohoRecord.Mobile || zohoRecord.Phone;
      const name = [zohoRecord.First_Name, zohoRecord.Last_Name].filter(Boolean).join(' ').trim() || 'Unknown';

      if (!email && !mobile) return false;

      if (email) {
        const [existing] = await db.select({ id: prospectClients.id })
          .from(prospectClients)
          .where(eq(prospectClients.email, email))
          .limit(1);

        if (existing) {
          await db.insert(zohoEntityMappings).values({
            connectionId: this.connectionId,
            fintekproEntityType: 'prospect',
            fintekproEntityId: existing.id,
            zohoService: config.zohoService,
            zohoModule: config.zohoModule,
            zohoRecordId: zohoRecord.id,
            zohoRecordData: zohoRecord,
            syncDirection: 'from_zoho',
            lastSyncedAt: new Date(),
            syncStatus: 'synced'
          });
          return true;
        }
      }

      return false;
    }

    return false;
  }

  private async getLastSyncTime(zohoService: string, zohoModule: string): Promise<Date | null> {
    const [lastLog] = await db
      .select({ lastSyncedAt: zohoEntityMappings.lastSyncedAt })
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.zohoService, zohoService),
          eq(zohoEntityMappings.zohoModule, zohoModule)
        )
      )
      .orderBy(desc(zohoEntityMappings.lastSyncedAt))
      .limit(1);

    return lastLog?.lastSyncedAt || null;
  }

  private async logFullSync(report: FullSyncReport): Promise<void> {
    try {
      await db.insert(zohoSyncLogs).values({
        connectionId: this.connectionId,
        operation: 'full_sync',
        entityType: 'all',
        direction: 'bidirectional',
        zohoService: 'ALL',
        zohoModule: 'ALL',
        status: report.summary.totalErrors > 0 ? 'partial' : 'success',
        recordsProcessed: report.summary.totalProcessed,
        recordsSucceeded: report.summary.totalCreated + report.summary.totalUpdated,
        recordsFailed: report.summary.totalErrors,
        durationMs: report.totalDurationMs,
        zohoResponseData: report as any
      });
    } catch (e) {
      console.error('[SyncOrchestrator] Failed to log full sync:', e);
    }
  }

  async getSyncHealth(): Promise<{
    lastFullSync: Date | null;
    lastIncrementalSync: Date | null;
    pendingWebhooks: number;
    totalMappings: number;
    conflictCount: number;
    errorCount: number;
    moduleStatus: Array<{ module: string; lastSync: Date | null; mappingCount: number }>;
  }> {
    const [lastFullSyncLog] = await db
      .select({ createdAt: zohoSyncLogs.createdAt })
      .from(zohoSyncLogs)
      .where(
        and(
          eq(zohoSyncLogs.connectionId, this.connectionId),
          eq(zohoSyncLogs.operation, 'full_sync')
        )
      )
      .orderBy(desc(zohoSyncLogs.createdAt))
      .limit(1);

    const [lastIncrementalLog] = await db
      .select({ createdAt: zohoSyncLogs.createdAt })
      .from(zohoSyncLogs)
      .where(
        and(
          eq(zohoSyncLogs.connectionId, this.connectionId),
          sql`${zohoSyncLogs.operation} != 'full_sync'`
        )
      )
      .orderBy(desc(zohoSyncLogs.createdAt))
      .limit(1);

    const webhookStats = await this.webhookProcessor.getProcessingStats();

    const [totalMappingsResult] = await db
      .select({ count: count() })
      .from(zohoEntityMappings)
      .where(eq(zohoEntityMappings.connectionId, this.connectionId));

    const [conflictCountResult] = await db
      .select({ count: count() })
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.syncStatus, 'conflict')
        )
      );

    const [errorCountResult] = await db
      .select({ count: count() })
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, this.connectionId),
          eq(zohoEntityMappings.syncStatus, 'error')
        )
      );

    const moduleStatuses = await db
      .select({
        module: zohoEntityMappings.zohoModule,
        count: count(),
        lastSync: sql<Date>`max(${zohoEntityMappings.lastSyncedAt})`
      })
      .from(zohoEntityMappings)
      .where(eq(zohoEntityMappings.connectionId, this.connectionId))
      .groupBy(zohoEntityMappings.zohoModule);

    return {
      lastFullSync: lastFullSyncLog?.createdAt || null,
      lastIncrementalSync: lastIncrementalLog?.createdAt || null,
      pendingWebhooks: webhookStats.pending,
      totalMappings: totalMappingsResult?.count || 0,
      conflictCount: conflictCountResult?.count || 0,
      errorCount: errorCountResult?.count || 0,
      moduleStatus: moduleStatuses.map(ms => ({
        module: ms.module,
        lastSync: ms.lastSync,
        mappingCount: Number(ms.count)
      }))
    };
  }
}
