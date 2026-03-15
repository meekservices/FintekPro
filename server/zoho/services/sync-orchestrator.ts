import { db } from '../../db';
import {
  zohoEntityMappings, zohoSyncLogs, zohoConnections,
  prospectClients, partnerCommissions, partners, users
} from '@shared/schema';
import { eq, and, sql, gte, desc, lt, count } from 'drizzle-orm';
import { ZohoApiClient } from '../api-client';
import { ZohoWebhookProcessor } from './webhook-processor';

const DATA_CENTER = 'in';

const SAFETY_WINDOW_MS = 5 * 60 * 1000;
const MAX_PAGES = 50;
const PAGE_SIZE = 200;

function isSyncEnabled(): boolean {
  if (process.env.ZOHO_SYNC_ENABLED === 'true') return true;
  if (process.env.ZOHO_SYNC_ENABLED === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

type SyncDirection = 'to_zoho' | 'from_zoho' | 'bidirectional';
type ConflictStrategy = 'last_write_wins' | 'zoho_wins' | 'fintekpro_wins' | 'per_field';

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
  conflictsAutoResolved: number;
  conflictsPendingReview: number;
  errors: string[];
  durationMs: number;
}

interface FullSyncReport {
  startedAt: Date;
  completedAt: Date;
  totalDurationMs: number;
  modules: SyncResult[];
  webhookProcessing: { processed: number; succeeded: number; failed: number; deadLettered: number };
  summary: {
    totalProcessed: number;
    totalCreated: number;
    totalUpdated: number;
    totalConflicts: number;
    totalErrors: number;
  };
}

const FIELD_AUTHORITY: Record<string, { zoho: string[]; fintekpro: string[] }> = {
  prospect: {
    zoho: ['email', 'mobile', 'name'],
    fintekpro: ['agentId', 'clientType', 'state', 'indicativeRiskProfile', 'pan']
  },
  user: {
    zoho: ['email', 'phone', 'fullName'],
    fintekpro: ['role', 'kycStatus', 'riskProfile', 'isActive']
  },
  partner_commission: {
    zoho: ['status'],
    fintekpro: ['commissionAmount', 'commissionRate', 'baseAmount', 'totalCommission', 'volumeBonus', 'transactionAmount']
  },
  partner: {
    zoho: [],
    fintekpro: ['companyName', 'contactEmail', 'partnerType', 'permissions', 'isActive']
  }
};

const SYNC_MODULES: SyncModuleConfig[] = [
  {
    zohoService: 'CRM',
    zohoModule: 'Contacts',
    fintekproEntityType: 'prospect',
    direction: 'bidirectional',
    conflictStrategy: 'per_field',
    enabled: true
  },
  {
    zohoService: 'CRM',
    zohoModule: 'Leads',
    fintekproEntityType: 'prospect',
    direction: 'bidirectional',
    conflictStrategy: 'per_field',
    enabled: true
  },
  {
    zohoService: 'CRM',
    zohoModule: 'Deals',
    fintekproEntityType: 'partner_commission',
    direction: 'bidirectional',
    conflictStrategy: 'per_field',
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

let _syncLock = false;
let _syncLockHolder: string | null = null;

export class ZohoSyncOrchestrator {
  private connectionId: string;
  private crmClient: ZohoApiClient;
  private webhookProcessor: ZohoWebhookProcessor;

  constructor(connectionId: string) {
    this.connectionId = connectionId;
    this.crmClient = new ZohoApiClient(connectionId, 'CRM', DATA_CENTER);
    this.webhookProcessor = new ZohoWebhookProcessor(connectionId);
  }

  static async create(): Promise<ZohoSyncOrchestrator | null> {
    const [connection] = await db
      .select({ id: zohoConnections.id })
      .from(zohoConnections)
      .where(and(eq(zohoConnections.status, 'active')))
      .limit(1);

    if (!connection) {
      console.warn('[ZohoSyncOrchestrator] No active Zoho connection found in DB — skipping sync');
      return null;
    }

    return new ZohoSyncOrchestrator(connection.id);
  }

  private acquireLock(holder: string): boolean {
    if (_syncLock) {
      console.log(`[SyncOrchestrator] Lock held by "${_syncLockHolder}", skipping "${holder}"`);
      return false;
    }
    _syncLock = true;
    _syncLockHolder = holder;
    return true;
  }

  private releaseLock(): void {
    _syncLock = false;
    _syncLockHolder = null;
  }

  private emptyReport(): FullSyncReport {
    const now = new Date();
    return {
      startedAt: now, completedAt: now, totalDurationMs: 0,
      modules: [], webhookProcessing: { processed: 0, succeeded: 0, failed: 0, deadLettered: 0 },
      summary: { totalProcessed: 0, totalCreated: 0, totalUpdated: 0, totalConflicts: 0, totalErrors: 0 }
    };
  }

  async runFullSync(): Promise<FullSyncReport> {
    if (!isSyncEnabled()) {
      console.log('[SyncOrchestrator] Full sync skipped - sync not enabled (set ZOHO_SYNC_ENABLED=true or run in production)');
      return this.emptyReport();
    }

    if (!this.acquireLock('full_sync')) {
      return this.emptyReport();
    }

    try {
      const startedAt = new Date();
      console.log(`[SyncOrchestrator] Starting full sync at ${startedAt.toISOString()}`);

      const webhookResult = await this.webhookProcessor.processPendingEvents(100);
      console.log(`[SyncOrchestrator] Webhook processing: ${webhookResult.succeeded} succeeded, ${webhookResult.failed} failed, ${webhookResult.deadLettered} dead-lettered`);

      const moduleResults: SyncResult[] = [];

      for (const config of SYNC_MODULES) {
        if (!config.enabled) continue;

        try {
          const result = await this.syncModule(config);
          moduleResults.push(result);
          console.log(`[SyncOrchestrator] ${config.zohoModule}: ${result.recordsProcessed} processed, ${result.recordsUpdated} updated, ${result.conflicts} conflicts, ${result.errors.length} errors`);
        } catch (error: any) {
          console.error(`[SyncOrchestrator] ${config.zohoModule} sync failed:`, error.message);
          moduleResults.push(this.errorResult(config, error.message));
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
          failed: webhookResult.failed,
          deadLettered: webhookResult.deadLettered
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
    } finally {
      this.releaseLock();
    }
  }

  async runIncrementalSync(): Promise<FullSyncReport> {
    if (!isSyncEnabled()) {
      console.log('[SyncOrchestrator] Incremental sync skipped - sync not enabled');
      return this.emptyReport();
    }

    if (!this.acquireLock('incremental_sync')) {
      return this.emptyReport();
    }

    try {
      const startedAt = new Date();
      console.log(`[SyncOrchestrator] Starting incremental sync at ${startedAt.toISOString()}`);

      const webhookResult = await this.webhookProcessor.processPendingEvents(50);

      const moduleResults: SyncResult[] = [];
      let connectionInvalidated = false;

      for (const config of SYNC_MODULES) {
        if (!config.enabled) continue;
        if (config.direction === 'to_zoho') continue;
        if (connectionInvalidated) {
          moduleResults.push(this.errorResult(config, 'Connection invalidated'));
          continue;
        }

        try {
          const result = await this.syncModuleIncremental(config);
          moduleResults.push(result);
        } catch (error: any) {
          const isConnectionGone = error.message === 'Connection not found' || error.message?.includes('Connection not found');
          if (isConnectionGone) {
            connectionInvalidated = true;
            console.warn(`[SyncOrchestrator] Connection ${this.connectionId} OAuth token invalid — marking inactive to stop retry loops`);
            try {
              await db.update(zohoConnections)
                .set({ status: 'inactive', updatedAt: new Date() })
                .where(eq(zohoConnections.id, this.connectionId));
            } catch (dbErr: any) {
              console.warn('[SyncOrchestrator] Could not mark connection inactive:', dbErr.message);
            }
            moduleResults.push(this.errorResult(config, error.message));
          } else {
            console.error(`[SyncOrchestrator] Incremental ${config.zohoModule} failed:`, error.message);
            moduleResults.push(this.errorResult(config, error.message));
          }
        }
      }

      const completedAt = new Date();
      return {
        startedAt,
        completedAt,
        totalDurationMs: completedAt.getTime() - startedAt.getTime(),
        modules: moduleResults,
        webhookProcessing: { processed: webhookResult.processed, succeeded: webhookResult.succeeded, failed: webhookResult.failed, deadLettered: webhookResult.deadLettered },
        summary: {
          totalProcessed: moduleResults.reduce((s, r) => s + r.recordsProcessed, 0),
          totalCreated: moduleResults.reduce((s, r) => s + r.recordsCreated, 0),
          totalUpdated: moduleResults.reduce((s, r) => s + r.recordsUpdated, 0),
          totalConflicts: moduleResults.reduce((s, r) => s + r.conflicts, 0),
          totalErrors: moduleResults.reduce((s, r) => s + r.errors.length, 0)
        }
      };
    } finally {
      this.releaseLock();
    }
  }

  private errorResult(config: SyncModuleConfig, errorMsg: string): SyncResult {
    return {
      module: config.zohoModule, direction: config.direction,
      recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0,
      recordsSkipped: 0, conflicts: 0, conflictsAutoResolved: 0, conflictsPendingReview: 0,
      errors: [errorMsg], durationMs: 0
    };
  }

  private async syncModule(config: SyncModuleConfig): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      module: config.zohoModule, direction: config.direction,
      recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0,
      recordsSkipped: 0, conflicts: 0, conflictsAutoResolved: 0, conflictsPendingReview: 0,
      errors: [], durationMs: 0
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
      module: config.zohoModule, direction: config.direction,
      recordsProcessed: 0, recordsCreated: 0, recordsUpdated: 0,
      recordsSkipped: 0, conflicts: 0, conflictsAutoResolved: 0, conflictsPendingReview: 0,
      errors: [], durationMs: 0
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
      const hasConflict = this.detectConflict(existingMapping, zohoRecord);

      if (hasConflict) {
        result.conflicts++;

        if (config.conflictStrategy === 'per_field') {
          await this.applyPerFieldUpdate(config, existingMapping, zohoRecord);
          result.conflictsAutoResolved++;
          result.recordsUpdated++;
        } else {
          const winner = this.resolveConflict(existingMapping, zohoRecord, config.conflictStrategy);

          if (winner === 'zoho') {
            await this.applyZohoUpdate(config, existingMapping, zohoRecord);
            result.conflictsAutoResolved++;
            result.recordsUpdated++;
          } else {
            result.recordsSkipped++;
          }
        }

        await db
          .update(zohoEntityMappings)
          .set({
            conflictData: {
              detectedAt: new Date().toISOString(),
              strategy: config.conflictStrategy,
              zohoModifiedTime: zohoRecord.Modified_Time,
              resolution: config.conflictStrategy === 'per_field' ? 'per_field_authority' : config.conflictStrategy
            },
            updatedAt: new Date()
          })
          .where(eq(zohoEntityMappings.id, existingMapping.id));
      } else {
        if (config.conflictStrategy === 'per_field') {
          await this.applyPerFieldUpdate(config, existingMapping, zohoRecord);
        } else {
          await this.applyZohoUpdate(config, existingMapping, zohoRecord);
        }
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

  private detectConflict(mapping: any, zohoRecord: any): boolean {
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

  private async applyPerFieldUpdate(
    config: SyncModuleConfig, mapping: any, zohoRecord: any
  ): Promise<void> {
    const fintekproType = mapping.fintekproEntityType;
    const fintekproId = mapping.fintekproEntityId;
    const authority = FIELD_AUTHORITY[fintekproType];

    if (!authority) {
      await this.applyZohoUpdate(config, mapping, zohoRecord);
      return;
    }

    const zohoAllowed = new Set(authority.zoho);
    const fintekproProtected = new Set(authority.fintekpro);

    if (fintekproType === 'prospect') {
      const updateData: any = { updatedAt: new Date() };
      if (zohoAllowed.has('email') && zohoRecord.Email) updateData.email = zohoRecord.Email.toLowerCase().trim();
      if (zohoAllowed.has('mobile') && (zohoRecord.Mobile || zohoRecord.Phone)) updateData.mobile = zohoRecord.Mobile || zohoRecord.Phone;
      if (zohoAllowed.has('name')) {
        const name = [zohoRecord.First_Name, zohoRecord.Last_Name].filter(Boolean).join(' ').trim();
        if (name) updateData.name = name;
      }
      if (Object.keys(updateData).length > 1) {
        await db.update(prospectClients).set(updateData).where(eq(prospectClients.id, fintekproId));
      }
    } else if (fintekproType === 'user') {
      const updateData: any = {};
      if (zohoAllowed.has('email') && zohoRecord.Email) updateData.email = zohoRecord.Email.toLowerCase().trim();
      if (zohoAllowed.has('phone') && (zohoRecord.Mobile || zohoRecord.Phone)) updateData.phone = zohoRecord.Mobile || zohoRecord.Phone;
      if (zohoAllowed.has('fullName')) {
        const fullName = [zohoRecord.First_Name, zohoRecord.Last_Name].filter(Boolean).join(' ').trim();
        if (fullName) updateData.fullName = fullName;
      }
      if (Object.keys(updateData).length > 0) {
        await db.update(users).set(updateData).where(eq(users.id, fintekproId));
      }
    } else if (fintekproType === 'partner_commission') {
      if (zohoAllowed.has('status') && zohoRecord.Stage) {
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

      let hasFinancialConflict = false;

      if (zohoRecord.Amount && fintekproProtected.has('commissionAmount')) {
        const [current] = await db.select({ commissionAmount: partnerCommissions.commissionAmount })
          .from(partnerCommissions).where(eq(partnerCommissions.id, fintekproId)).limit(1);

        const currentAmt = parseFloat(current?.commissionAmount?.toString() || '0');
        const zohoAmt = parseFloat(zohoRecord.Amount.toString());

        if (currentAmt !== zohoAmt) {
          hasFinancialConflict = true;
          await this.logFieldConflict(mapping, 'commissionAmount', currentAmt, zohoAmt);
        }
      }

      await db
        .update(zohoEntityMappings)
        .set({
          zohoRecordData: zohoRecord,
          lastSyncedAt: new Date(),
          syncStatus: hasFinancialConflict ? 'conflict' : 'synced',
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, mapping.id));
      return;
    } else if (fintekproType === 'partner') {
      // Partner data is FintekPro-authoritative; no Zoho updates applied
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
          'Qualification': 'pending', 'Needs Analysis': 'approved',
          'Value Proposition': 'processing', 'Closed Won': 'completed',
          'Closed Lost': 'cancelled', 'Negotiation/Review': 'on_hold'
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
      .set({ zohoRecordData: zohoRecord, lastSyncedAt: new Date(), syncStatus: 'synced', updatedAt: new Date() })
      .where(eq(zohoEntityMappings.id, mapping.id));
  }

  private async logFieldConflict(
    mapping: any, field: string, fintekproValue: any, zohoValue: any
  ): Promise<void> {
    try {
      await db.update(zohoEntityMappings)
        .set({
          syncStatus: 'conflict',
          conflictData: {
            field, fintekproValue, zohoValue,
            resolution: 'fintekpro_wins',
            reason: 'Financial field protected by per-field authority',
            detectedAt: new Date().toISOString(),
            entityType: mapping.fintekproEntityType,
            entityId: mapping.fintekproEntityId
          },
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, mapping.id));

      await db.insert(zohoSyncLogs).values({
        connectionId: this.connectionId,
        operation: 'field_conflict',
        entityType: mapping.fintekproEntityType,
        direction: 'from_zoho',
        zohoService: mapping.zohoService,
        zohoModule: mapping.zohoModule,
        status: 'partial',
        recordsProcessed: 1,
        recordsSucceeded: 0,
        recordsFailed: 0,
        zohoResponseData: { field, fintekproValue, zohoValue, resolution: 'fintekpro_wins' } as any
      });

      console.warn(`[SyncOrchestrator] FIELD CONFLICT on ${mapping.fintekproEntityType}/${mapping.fintekproEntityId} "${field}": FintekPro=${fintekproValue}, Zoho=${zohoValue} => FintekPro wins (financial field protected)`);
    } catch (e) {
      console.error('[SyncOrchestrator] Failed to log field conflict:', e);
    }
  }

  private async createFromZoho(config: SyncModuleConfig, zohoRecord: any): Promise<boolean> {
    if (config.zohoModule === 'Contacts' || config.zohoModule === 'Leads') {
      const email = zohoRecord.Email?.toLowerCase().trim();
      if (!email && !(zohoRecord.Mobile || zohoRecord.Phone)) return false;

      if (email) {
        const [existing] = await db.select({ id: prospectClients.id })
          .from(prospectClients).where(eq(prospectClients.email, email)).limit(1);

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

  async runReconciliation(): Promise<{
    modules: Array<{
      module: string;
      fintekproCount: number;
      zohoMappedCount: number;
      unmappedCount: number;
      conflictCount: number;
      lastSync: Date | null;
    }>;
    financialDiscrepancies: Array<{
      entityId: string;
      field: string;
      fintekproValue: any;
      zohoValue: any;
    }>;
    generatedAt: Date;
  }> {
    const modules = [];

    const [prospectCount] = await db.select({ count: count() }).from(prospectClients);
    const [prospectMapped] = await db.select({ count: count() }).from(zohoEntityMappings)
      .where(and(
        eq(zohoEntityMappings.connectionId, this.connectionId),
        eq(zohoEntityMappings.fintekproEntityType, 'prospect')
      ));
    const [prospectConflicts] = await db.select({ count: count() }).from(zohoEntityMappings)
      .where(and(
        eq(zohoEntityMappings.connectionId, this.connectionId),
        eq(zohoEntityMappings.fintekproEntityType, 'prospect'),
        eq(zohoEntityMappings.syncStatus, 'conflict')
      ));
    const [prospectLastSync] = await db.select({ lastSync: sql<Date>`max(${zohoEntityMappings.lastSyncedAt})` })
      .from(zohoEntityMappings)
      .where(and(eq(zohoEntityMappings.connectionId, this.connectionId), eq(zohoEntityMappings.fintekproEntityType, 'prospect')));

    modules.push({
      module: 'Contacts/Leads → Prospects',
      fintekproCount: prospectCount?.count || 0,
      zohoMappedCount: prospectMapped?.count || 0,
      unmappedCount: (prospectCount?.count || 0) - (prospectMapped?.count || 0),
      conflictCount: prospectConflicts?.count || 0,
      lastSync: prospectLastSync?.lastSync || null
    });

    const [commissionCount] = await db.select({ count: count() }).from(partnerCommissions);
    const [commissionMapped] = await db.select({ count: count() }).from(zohoEntityMappings)
      .where(and(
        eq(zohoEntityMappings.connectionId, this.connectionId),
        eq(zohoEntityMappings.fintekproEntityType, 'partner_commission')
      ));
    const [commissionConflicts] = await db.select({ count: count() }).from(zohoEntityMappings)
      .where(and(
        eq(zohoEntityMappings.connectionId, this.connectionId),
        eq(zohoEntityMappings.fintekproEntityType, 'partner_commission'),
        eq(zohoEntityMappings.syncStatus, 'conflict')
      ));
    const [commissionLastSync] = await db.select({ lastSync: sql<Date>`max(${zohoEntityMappings.lastSyncedAt})` })
      .from(zohoEntityMappings)
      .where(and(eq(zohoEntityMappings.connectionId, this.connectionId), eq(zohoEntityMappings.fintekproEntityType, 'partner_commission')));

    modules.push({
      module: 'Deals → Commissions',
      fintekproCount: commissionCount?.count || 0,
      zohoMappedCount: commissionMapped?.count || 0,
      unmappedCount: (commissionCount?.count || 0) - (commissionMapped?.count || 0),
      conflictCount: commissionConflicts?.count || 0,
      lastSync: commissionLastSync?.lastSync || null
    });

    const financialDiscrepancies: Array<{ entityId: string; field: string; fintekproValue: any; zohoValue: any }> = [];

    const conflictMappings = await db.select()
      .from(zohoEntityMappings)
      .where(and(
        eq(zohoEntityMappings.connectionId, this.connectionId),
        eq(zohoEntityMappings.syncStatus, 'conflict')
      ))
      .limit(50);

    for (const mapping of conflictMappings) {
      const conflict = mapping.conflictData as any;
      if (conflict?.field && conflict?.fintekproValue !== undefined) {
        financialDiscrepancies.push({
          entityId: mapping.fintekproEntityId,
          field: conflict.field,
          fintekproValue: conflict.fintekproValue,
          zohoValue: conflict.zohoValue
        });
      }
    }

    return { modules, financialDiscrepancies, generatedAt: new Date() };
  }

  async getSyncHealth(): Promise<{
    lastFullSync: Date | null;
    lastIncrementalSync: Date | null;
    pendingWebhooks: number;
    deadLetteredWebhooks: number;
    totalMappings: number;
    conflictCount: number;
    errorCount: number;
    syncLocked: boolean;
    syncLockHolder: string | null;
    syncEnabled: boolean;
    moduleStatus: Array<{ module: string; lastSync: Date | null; mappingCount: number }>;
  }> {
    const [lastFullSyncLog] = await db
      .select({ createdAt: zohoSyncLogs.createdAt })
      .from(zohoSyncLogs)
      .where(and(eq(zohoSyncLogs.connectionId, this.connectionId), eq(zohoSyncLogs.operation, 'full_sync')))
      .orderBy(desc(zohoSyncLogs.createdAt))
      .limit(1);

    const [lastIncrementalLog] = await db
      .select({ createdAt: zohoSyncLogs.createdAt })
      .from(zohoSyncLogs)
      .where(and(eq(zohoSyncLogs.connectionId, this.connectionId), sql`${zohoSyncLogs.operation} != 'full_sync'`))
      .orderBy(desc(zohoSyncLogs.createdAt))
      .limit(1);

    const webhookStats = await this.webhookProcessor.getProcessingStats();

    const [totalMappingsResult] = await db.select({ count: count() }).from(zohoEntityMappings)
      .where(eq(zohoEntityMappings.connectionId, this.connectionId));

    const [conflictCountResult] = await db.select({ count: count() }).from(zohoEntityMappings)
      .where(and(eq(zohoEntityMappings.connectionId, this.connectionId), eq(zohoEntityMappings.syncStatus, 'conflict')));

    const [errorCountResult] = await db.select({ count: count() }).from(zohoEntityMappings)
      .where(and(eq(zohoEntityMappings.connectionId, this.connectionId), eq(zohoEntityMappings.syncStatus, 'error')));

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
      deadLetteredWebhooks: webhookStats.deadLettered,
      totalMappings: totalMappingsResult?.count || 0,
      conflictCount: conflictCountResult?.count || 0,
      errorCount: errorCountResult?.count || 0,
      syncLocked: _syncLock,
      syncLockHolder: _syncLockHolder,
      syncEnabled: isSyncEnabled(),
      moduleStatus: moduleStatuses.map(ms => ({
        module: ms.module,
        lastSync: ms.lastSync,
        mappingCount: Number(ms.count)
      }))
    };
  }
}
