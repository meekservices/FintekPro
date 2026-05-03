import { db } from '../db';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  eventType: string;
  action: string;
  userId?: string;
  userRole?: string;
  entityType?: string;
  entityId?: string;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  metadata: {
    ip?: string;
    userAgent?: string;
    networkState?: string;
    idempotencyKey?: string;
    executionId?: string;
    sessionId?: string;
    requestPath?: string;
    requestMethod?: string;
  };
  checksum: string;
  previousChecksum?: string;
}

export interface TransactionLifecycle {
  id: string;
  events: AuditLogEntry[];
  summary: {
    created: Date;
    lastUpdated: Date;
    currentStatus: string;
    totalEvents: number;
    participants: string[];
  };
}

class AuditLogService {
  private lastChecksum: string = '';
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const result = await db.execute(sql`
        SELECT checksum FROM immutable_audit_logs
        ORDER BY timestamp DESC
        LIMIT 1
      `);
      
      if (result.rows && result.rows.length > 0) {
        this.lastChecksum = (result.rows[0] as any).checksum;
        console.log('[AuditLog] Initialized with last checksum from database');
      }
      
      this.initialized = true;
    } catch (error) {
      console.warn('[AuditLog] Failed to load last checksum, starting fresh:', error);
      this.initialized = true;
    }
  }

  async verifyChainOnStartup(): Promise<boolean> {
    try {
      const { valid, brokenLinks, totalVerified } = await this.verifyChainIntegrity();
      
      if (!valid) {
        console.error('[AuditLog] CHAIN INTEGRITY VIOLATION DETECTED!', {
          brokenLinks,
          totalVerified,
        });
        return false;
      }
      
      console.log(`[AuditLog] Chain integrity verified: ${totalVerified} entries`);
      return true;
    } catch (error) {
      console.error('[AuditLog] Chain verification failed:', error);
      return false;
    }
  }

  private generateChecksum(entry: Omit<AuditLogEntry, 'checksum' | 'previousChecksum'>, previousChecksum: string): string {
    const data = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp.toISOString(),
      previousChecksum,
    });
    
    const secret = process.env.COMPLIANCE_SECRET || 'fintekpro_audit_fallback_key_2024';
    
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('hex');
  }

  async log(
    eventType: string,
    action: string,
    options: {
      userId?: string;
      userRole?: string;
      entityType?: string;
      entityId?: string;
      previousState?: Record<string, any>;
      newState?: Record<string, any>;
      metadata?: AuditLogEntry['metadata'];
    }
  ): Promise<AuditLogEntry> {
    // Ensure initialized before logging
    if (!this.initialized) {
      await this.initialize();
    }

    const entry: Omit<AuditLogEntry, 'checksum' | 'previousChecksum'> = {
      id: uuidv4(),
      timestamp: new Date(),
      eventType,
      action,
      ...options,
      metadata: options.metadata || {},
    };

    const checksum = this.generateChecksum(entry, this.lastChecksum);
    
    const fullEntry: AuditLogEntry = {
      ...entry,
      checksum,
      previousChecksum: this.lastChecksum || undefined,
    };

    this.lastChecksum = checksum;

    try {
      await db.execute(sql`
        INSERT INTO immutable_audit_logs (
          id, timestamp, event_type, action, user_id, user_role,
          entity_type, entity_id, previous_state, new_state,
          metadata, checksum, previous_checksum
        ) VALUES (
          ${fullEntry.id},
          ${fullEntry.timestamp.toISOString()},
          ${fullEntry.eventType},
          ${fullEntry.action},
          ${fullEntry.userId || null},
          ${fullEntry.userRole || null},
          ${fullEntry.entityType || null},
          ${fullEntry.entityId || null},
          ${fullEntry.previousState ? JSON.stringify(fullEntry.previousState) : null},
          ${fullEntry.newState ? JSON.stringify(fullEntry.newState) : null},
          ${JSON.stringify(fullEntry.metadata)},
          ${fullEntry.checksum},
          ${fullEntry.previousChecksum || null}
        )
      `);
    } catch (error) {
      console.error('[AuditLog] Failed to persist audit log:', error);
      console.log('[AuditLog] Entry:', JSON.stringify(fullEntry));
    }

    console.log(`[AUDIT] ${eventType}:${action}`, {
      id: fullEntry.id,
      userId: fullEntry.userId,
      entityType: fullEntry.entityType,
      entityId: fullEntry.entityId,
      checksum: fullEntry.checksum,
    });

    return fullEntry;
  }

  async logExecution(
    action: string,
    entityType: string,
    entityId: string,
    options: {
      userId: string;
      userRole: string;
      previousState?: Record<string, any>;
      newState?: Record<string, any>;
      metadata?: AuditLogEntry['metadata'];
    }
  ): Promise<AuditLogEntry> {
    return this.log('EXECUTION', action, {
      entityType,
      entityId,
      ...options,
    });
  }

  async logDraftCreation(
    draftType: string,
    draftId: string,
    userId: string,
    userRole: string,
    metadata?: AuditLogEntry['metadata']
  ): Promise<AuditLogEntry> {
    return this.log('DRAFT', 'CREATED', {
      userId,
      userRole,
      entityType: draftType,
      entityId: draftId,
      metadata,
    });
  }

  async logSync(
    entityType: string,
    entityId: string,
    userId: string,
    userRole: string,
    syncResult: 'success' | 'failed',
    metadata?: AuditLogEntry['metadata']
  ): Promise<AuditLogEntry> {
    return this.log('SYNC', syncResult.toUpperCase(), {
      userId,
      userRole,
      entityType,
      entityId,
      metadata,
    });
  }

  async logNetworkStateChange(
    userId: string,
    previousState: string,
    newState: string,
    metadata?: AuditLogEntry['metadata']
  ): Promise<AuditLogEntry> {
    return this.log('NETWORK', 'STATE_CHANGE', {
      userId,
      previousState: { networkState: previousState },
      newState: { networkState: newState },
      metadata,
    });
  }

  async getTransactionLifecycle(entityType: string, entityId: string): Promise<TransactionLifecycle | null> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM immutable_audit_logs
        WHERE entity_type = ${entityType} AND entity_id = ${entityId}
        ORDER BY timestamp ASC
      `);

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      const events: AuditLogEntry[] = result.rows.map((row: any) => ({
        id: row.id,
        timestamp: new Date(row.timestamp),
        eventType: row.event_type,
        action: row.action,
        userId: row.user_id,
        userRole: row.user_role,
        entityType: row.entity_type,
        entityId: row.entity_id,
        previousState: row.previous_state ? JSON.parse(row.previous_state) : undefined,
        newState: row.new_state ? JSON.parse(row.new_state) : undefined,
        metadata: JSON.parse(row.metadata || '{}'),
        checksum: row.checksum,
        previousChecksum: row.previous_checksum,
      }));

      const participants = [...new Set(events.map(e => e.userId).filter(Boolean))] as string[];
      const lastEvent = events[events.length - 1];

      return {
        id: `${entityType}:${entityId}`,
        events,
        summary: {
          created: events[0].timestamp,
          lastUpdated: lastEvent.timestamp,
          currentStatus: lastEvent.action,
          totalEvents: events.length,
          participants,
        },
      };
    } catch (error) {
      console.error('[AuditLog] Failed to get transaction lifecycle:', error);
      return null;
    }
  }

  async getUserAuditTrail(
    userId: string,
    options?: { startDate?: Date; endDate?: Date; limit?: number }
  ): Promise<AuditLogEntry[]> {
    const { startDate, endDate, limit = 100 } = options || {};

    try {
      let query = sql`
        SELECT * FROM immutable_audit_logs
        WHERE user_id = ${userId}
      `;

      if (startDate) {
        query = sql`${query} AND timestamp >= ${startDate.toISOString()}`;
      }
      if (endDate) {
        query = sql`${query} AND timestamp <= ${endDate.toISOString()}`;
      }

      query = sql`${query} ORDER BY timestamp DESC LIMIT ${limit}`;

      const result = await db.execute(query);

      return (result.rows || []).map((row: any) => ({
        id: row.id,
        timestamp: new Date(row.timestamp),
        eventType: row.event_type,
        action: row.action,
        userId: row.user_id,
        userRole: row.user_role,
        entityType: row.entity_type,
        entityId: row.entity_id,
        previousState: row.previous_state ? JSON.parse(row.previous_state) : undefined,
        newState: row.new_state ? JSON.parse(row.new_state) : undefined,
        metadata: JSON.parse(row.metadata || '{}'),
        checksum: row.checksum,
        previousChecksum: row.previous_checksum,
      }));
    } catch (error) {
      console.error('[AuditLog] Failed to get user audit trail:', error);
      return [];
    }
  }

  async verifyChainIntegrity(startId?: string, endId?: string): Promise<{
    valid: boolean;
    brokenLinks: string[];
    totalVerified: number;
  }> {
    try {
      // Select all columns to reconstruct the data for hash verification
      const result = await db.execute(sql`
        SELECT *
        FROM immutable_audit_logs
        ORDER BY timestamp ASC
      `);

      const rows = result.rows || [];
      let valid = true;
      const brokenLinks: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] as any;
        
        // Reconstruct the entry for checksum verification
        // Note: Field names in result.rows might be snake_case depending on driver, 
        // but Drizzle usually returns camelCase if using the ORM.
        // Since we are using db.execute(sql`...`), we might get snake_case.
        
        const entry: Omit<AuditLogEntry, 'checksum' | 'previousChecksum'> = {
          id: row.id,
          timestamp: new Date(row.timestamp),
          eventType: row.event_type,
          action: row.action,
          userId: row.user_id,
          userRole: row.user_role,
          entityType: row.entity_type,
          entityId: row.entity_id,
          previousState: row.previous_state,
          newState: row.new_state,
          metadata: row.metadata || {},
        };

        const recalculated = this.generateChecksum(entry, row.previous_checksum || '');
        
        if (recalculated !== row.checksum) {
          valid = false;
          brokenLinks.push(`${row.id} (HASH_MISMATCH: expected ${recalculated.substring(0,8)}, got ${row.checksum.substring(0,8)})`);
          continue;
        }

        // Verify the chain link
        if (i > 0) {
          const previous = rows[i - 1] as any;
          if (row.previous_checksum !== previous.checksum) {
            valid = false;
            brokenLinks.push(`${row.id} (CHAIN_BREAK: previous_checksum mismatch)`);
          }
        }
      }

      return {
        valid,
        brokenLinks,
        totalVerified: rows.length,
      };
    } catch (error) {
      console.error('[AuditLog] Failed to verify chain integrity:', error);
      return { valid: false, brokenLinks: [], totalVerified: 0 };
    }
  }
}

export const auditLogService = new AuditLogService();
