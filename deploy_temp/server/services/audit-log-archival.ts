/**
 * Immutable Audit Log Archival Service
 * 
 * Provides append-only audit log storage for SEBI/RBI compliance.
 * Logs are stored in object storage with:
 * - Append-only semantics (no modifications allowed)
 * - SHA-256 checksums for integrity verification
 * - 7-year retention policy
 * - Hierarchical organization by date and event type
 */

import { objectStorageClient } from '../objectStorage';
import { createHash } from 'crypto';
import { nanoid } from 'nanoid';

interface AuditLogEntry {
  entryId: string;
  timestamp: Date;
  eventType: string;
  eventCategory: string;
  userId?: string;
  entityId?: string;
  entityType?: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  checksum: string;
  previousChecksum?: string;
}

interface ArchivalResult {
  success: boolean;
  entryId: string;
  objectPath?: string;
  checksum?: string;
  error?: string;
}

const AUDIT_LOG_PREFIX = 'audit-logs';
const RETENTION_YEARS = 7;

class AuditLogArchivalService {
  private bucketName: string;
  private privateDir: string;
  private lastChecksum: string = '';

  constructor() {
    this.privateDir = process.env.PRIVATE_OBJECT_DIR || '';
    if (this.privateDir) {
      const parts = this.privateDir.split('/').filter(Boolean);
      this.bucketName = parts[0] || '';
    } else {
      this.bucketName = '';
    }
  }

  /**
   * Generate SHA-256 checksum for data integrity
   */
  private generateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get the object path for an audit log entry
   */
  private getObjectPath(entry: Omit<AuditLogEntry, 'entryId' | 'checksum' | 'previousChecksum'>): string {
    const date = entry.timestamp;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    
    const entryId = `${Date.now()}-${nanoid(8)}`;
    
    return `${AUDIT_LOG_PREFIX}/${entry.eventCategory}/${year}/${month}/${day}/${hour}/${entryId}.json`;
  }

  /**
   * Archive an audit log entry to immutable object storage
   */
  async archiveAuditEntry(entry: Omit<AuditLogEntry, 'entryId' | 'checksum' | 'previousChecksum'>): Promise<ArchivalResult> {
    if (!this.bucketName || !this.privateDir) {
      console.warn('[Audit Archival] Object storage not configured, skipping archival');
      return {
        success: false,
        entryId: '',
        error: 'Object storage not configured',
      };
    }

    try {
      const entryId = `AUDIT-${Date.now()}-${nanoid(8)}`;
      const objectPath = this.getObjectPath(entry);
      
      const fullEntry: AuditLogEntry = {
        ...entry,
        entryId,
        previousChecksum: this.lastChecksum || undefined,
        checksum: '',
      };
      
      const dataToHash = JSON.stringify({
        ...fullEntry,
        checksum: undefined,
      });
      fullEntry.checksum = this.generateChecksum(dataToHash);
      this.lastChecksum = fullEntry.checksum;

      const expirationDate = new Date();
      expirationDate.setFullYear(expirationDate.getFullYear() + RETENTION_YEARS);

      const bucket = objectStorageClient.bucket(this.bucketName);
      const file = bucket.file(`.private/${objectPath}`);
      
      await file.save(JSON.stringify(fullEntry, null, 2), {
        contentType: 'application/json',
        metadata: {
          entryId,
          eventType: entry.eventType,
          eventCategory: entry.eventCategory,
          userId: entry.userId || '',
          timestamp: entry.timestamp.toISOString(),
          checksum: fullEntry.checksum,
          retentionExpiry: expirationDate.toISOString(),
          immutable: 'true',
        },
      });

      console.log(`[Audit Archival] Archived entry ${entryId} to ${objectPath}`);

      return {
        success: true,
        entryId,
        objectPath,
        checksum: fullEntry.checksum,
      };
    } catch (error: any) {
      console.error('[Audit Archival] Failed to archive entry:', error);
      return {
        success: false,
        entryId: '',
        error: error.message || 'Failed to archive audit entry',
      };
    }
  }

  /**
   * Archive a compliance event for SEBI/RBI reporting
   */
  async archiveComplianceEvent(params: {
    eventType: 'kyc_verification' | 'trade_execution' | 'escrow_operation' | 'pmla_alert' | 'risk_disclosure' | 'maker_checker_approval' | 'fiu_report';
    userId?: string;
    entityId?: string;
    entityType?: string;
    action: string;
    details: Record<string, any>;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ArchivalResult> {
    return this.archiveAuditEntry({
      timestamp: new Date(),
      eventType: params.eventType,
      eventCategory: 'compliance',
      userId: params.userId,
      entityId: params.entityId,
      entityType: params.entityType,
      action: params.action,
      details: params.details,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      riskLevel: params.riskLevel,
    });
  }

  /**
   * Archive a transaction event for audit trail
   */
  async archiveTransactionEvent(params: {
    transactionId: string;
    transactionType: string;
    userId: string;
    amount: number;
    currency: string;
    status: string;
    details: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ArchivalResult> {
    return this.archiveAuditEntry({
      timestamp: new Date(),
      eventType: 'transaction',
      eventCategory: 'financial',
      userId: params.userId,
      entityId: params.transactionId,
      entityType: params.transactionType,
      action: `Transaction ${params.status}`,
      details: {
        ...params.details,
        amount: params.amount,
        currency: params.currency,
        status: params.status,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  /**
   * Archive a security event
   */
  async archiveSecurityEvent(params: {
    eventType: 'login' | 'logout' | 'password_change' | 'mfa_change' | 'session_invalidation' | 'access_denied' | 'suspicious_activity';
    userId?: string;
    action: string;
    details: Record<string, any>;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ArchivalResult> {
    return this.archiveAuditEntry({
      timestamp: new Date(),
      eventType: params.eventType,
      eventCategory: 'security',
      userId: params.userId,
      action: params.action,
      details: params.details,
      riskLevel: params.riskLevel,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  /**
   * Archive unlisted marketplace event
   */
  async archiveUnlistedMarketplaceEvent(params: {
    eventType: 'deal_created' | 'deal_accepted' | 'deal_rejected' | 'payment_initiated' | 'escrow_held' | 'escrow_released' | 'escrow_refunded' | 'transfer_pending' | 'transfer_completed';
    userId: string;
    dealId: string;
    companyId: string;
    action: string;
    details: Record<string, any>;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    ipAddress?: string;
    userAgent?: string;
  }): Promise<ArchivalResult> {
    return this.archiveAuditEntry({
      timestamp: new Date(),
      eventType: params.eventType,
      eventCategory: 'unlisted_marketplace',
      userId: params.userId,
      entityId: params.dealId,
      entityType: 'unlisted_deal',
      action: params.action,
      details: {
        ...params.details,
        companyId: params.companyId,
      },
      riskLevel: params.riskLevel,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  }

  /**
   * Verify integrity of an audit log entry by checksum
   */
  async verifyEntryIntegrity(objectPath: string): Promise<{ valid: boolean; entry?: AuditLogEntry; error?: string }> {
    if (!this.bucketName) {
      return { valid: false, error: 'Object storage not configured' };
    }

    try {
      const bucket = objectStorageClient.bucket(this.bucketName);
      const file = bucket.file(`.private/${objectPath}`);
      
      const [exists] = await file.exists();
      if (!exists) {
        return { valid: false, error: 'Audit log entry not found' };
      }

      const [content] = await file.download();
      const entry: AuditLogEntry = JSON.parse(content.toString());

      const storedChecksum = entry.checksum;
      const dataToHash = JSON.stringify({
        ...entry,
        checksum: undefined,
      });
      const calculatedChecksum = this.generateChecksum(dataToHash);

      if (storedChecksum !== calculatedChecksum) {
        console.error(`[Audit Archival] Integrity violation detected for ${objectPath}`);
        return {
          valid: false,
          entry,
          error: 'Checksum mismatch - entry may have been tampered with',
        };
      }

      return { valid: true, entry };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * List audit logs for a specific date range and category
   */
  async listAuditLogs(params: {
    category: string;
    startDate: Date;
    endDate: Date;
    limit?: number;
  }): Promise<string[]> {
    if (!this.bucketName) {
      return [];
    }

    try {
      const bucket = objectStorageClient.bucket(this.bucketName);
      const prefix = `.private/${AUDIT_LOG_PREFIX}/${params.category}/`;
      
      const [files] = await bucket.getFiles({ prefix });
      
      const filteredPaths = files
        .filter(file => {
          const metadata = file.metadata;
          if (metadata?.timestamp && typeof metadata.timestamp === 'string') {
            const timestamp = new Date(metadata.timestamp);
            return timestamp >= params.startDate && timestamp <= params.endDate;
          }
          return true;
        })
        .map(file => file.name)
        .slice(0, params.limit || 1000);

      return filteredPaths;
    } catch (error: any) {
      console.error('[Audit Archival] Failed to list audit logs:', error);
      return [];
    }
  }
}

export const auditLogArchivalService = new AuditLogArchivalService();
