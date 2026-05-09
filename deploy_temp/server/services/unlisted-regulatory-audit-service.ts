/**
 * Unlisted Marketplace Regulatory Audit Service
 * 
 * Comprehensive audit logging for SEBI/RBI compliance in unlisted share trading
 * 
 * Features:
 * - 7-Year Retention Policy (per SEBI regulations)
 * - Complete transaction lifecycle logging
 * - Compliance override tracking
 * - SEBI/RBI reportable event flagging
 * - Automated retention cleanup
 * - Forensic-grade request context capture
 */

import { db } from '../db';
import { unlistedRegulatoryAuditLog, users, unlistedCompanies, unlistedDeals } from '@shared/schema';
import { eq, and, gte, lte, desc, sql, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import crypto from 'crypto';

// ==================== TYPES ====================

export type AuditAction = 
  | 'create_sell_listing'
  | 'update_sell_listing'
  | 'cancel_sell_listing'
  | 'create_buy_request'
  | 'update_buy_request'
  | 'cancel_buy_request'
  | 'match_deal'
  | 'accept_deal'
  | 'reject_deal'
  | 'counter_offer'
  | 'initiate_payment'
  | 'complete_payment'
  | 'payment_failed'
  | 'transfer_shares'
  | 'confirm_transfer'
  | 'release_escrow'
  | 'refund_escrow'
  | 'complete_deal'
  | 'cancel_deal'
  | 'dispute_raised'
  | 'dispute_resolved'
  | 'compliance_override'
  | 'trading_suspended'
  | 'trading_resumed'
  | 'price_published'
  | 'price_updated'
  | 'document_upload'
  | 'document_verify'
  | 'document_reject'
  | 'kyc_eligibility_check'
  | 'cart_checkout'
  | 'bulk_order_created';

export type ActionCategory = 
  | 'listing'
  | 'order'
  | 'deal'
  | 'payment'
  | 'transfer'
  | 'compliance'
  | 'document'
  | 'price';

export type EntityType = 
  | 'sell_listing'
  | 'buy_request'
  | 'deal'
  | 'company'
  | 'document'
  | 'payment'
  | 'cart';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface AuditContext {
  userId?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  userKycTier?: string;
  userPan?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  deviceFingerprint?: string;
  geoLocation?: string;
}

export interface CompanyContext {
  companyId?: string;
  companyCin?: string;
  companyName?: string;
}

export interface DealContext {
  dealId?: string;
  counterpartyUserId?: string;
  counterpartyPan?: string;
}

export interface FinancialDetails {
  quantity?: number;
  pricePerShare?: number;
  totalValue?: number;
  platformFee?: number;
  gstAmount?: number;
  escrowAmount?: number;
}

export interface ComplianceContext {
  complianceRelated?: boolean;
  complianceFlags?: string[];
  riskLevel?: RiskLevel;
  complianceOfficer?: string;
  complianceNotes?: string;
  sebiReportable?: boolean;
  rbiReportable?: boolean;
}

export interface AuditLogEntry {
  action: AuditAction;
  actionCategory: ActionCategory;
  entityType: EntityType;
  entityId: string;
  actorContext: AuditContext;
  companyContext?: CompanyContext;
  dealContext?: DealContext;
  financialDetails?: FinancialDetails;
  complianceContext?: ComplianceContext;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  changeDescription?: string;
  documentIds?: string[];
  metadata?: Record<string, any>;
}

export interface AuditLogFilters {
  userId?: string;
  companyId?: string;
  dealId?: string;
  action?: AuditAction;
  actionCategory?: ActionCategory;
  entityType?: EntityType;
  complianceRelated?: boolean;
  sebiReportable?: boolean;
  riskLevel?: RiskLevel;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface RetentionStats {
  totalRecords: number;
  recordsNearingExpiry: number;
  archivedRecords: number;
  expiredRecords: number;
}

// ==================== CONSTANTS ====================

const RETENTION_YEARS = 7; // SEBI mandated retention period
const SEBI_REPORTING_THRESHOLD_INR = 1000000; // 10 Lakhs
const HIGH_VALUE_THRESHOLD_INR = 5000000; // 50 Lakhs
const BULK_ORDER_THRESHOLD = 5; // Number of orders in single checkout

// Actions that are always SEBI reportable
const SEBI_REPORTABLE_ACTIONS: AuditAction[] = [
  'complete_deal',
  'compliance_override',
  'trading_suspended',
  'dispute_raised',
];

// Actions that are always compliance-related
const COMPLIANCE_RELATED_ACTIONS: AuditAction[] = [
  'compliance_override',
  'trading_suspended',
  'trading_resumed',
  'kyc_eligibility_check',
  'document_verify',
  'document_reject',
];

// ==================== UNLISTED REGULATORY AUDIT SERVICE ====================

class UnlistedRegulatoryAuditService {
  
  /**
   * Log an audit event for the unlisted marketplace
   */
  async logAuditEvent(entry: AuditLogEntry): Promise<string> {
    try {
      const auditId = nanoid();
      const timestamp = new Date();
      const retentionExpiresAt = new Date(timestamp);
      retentionExpiresAt.setFullYear(retentionExpiresAt.getFullYear() + RETENTION_YEARS);
      
      // Determine if SEBI reportable
      const sebiReportable = this.isSebiReportable(entry);
      const rbiReportable = this.isRbiReportable(entry);
      const complianceRelated = this.isComplianceRelated(entry);
      const riskLevel = entry.complianceContext?.riskLevel || this.calculateRiskLevel(entry);
      
      await db.insert(unlistedRegulatoryAuditLog).values({
        id: auditId,
        userId: entry.actorContext.userId,
        userEmail: entry.actorContext.userEmail,
        userName: entry.actorContext.userName,
        userRole: entry.actorContext.userRole,
        userKycTier: entry.actorContext.userKycTier,
        userPan: entry.actorContext.userPan,
        action: entry.action,
        actionCategory: entry.actionCategory,
        entityType: entry.entityType,
        entityId: entry.entityId,
        companyId: entry.companyContext?.companyId,
        companyCin: entry.companyContext?.companyCin,
        companyName: entry.companyContext?.companyName,
        dealId: entry.dealContext?.dealId,
        counterpartyUserId: entry.dealContext?.counterpartyUserId,
        counterpartyPan: entry.dealContext?.counterpartyPan,
        quantity: entry.financialDetails?.quantity,
        pricePerShare: entry.financialDetails?.pricePerShare?.toString(),
        totalValue: entry.financialDetails?.totalValue?.toString(),
        platformFee: entry.financialDetails?.platformFee?.toString(),
        gstAmount: entry.financialDetails?.gstAmount?.toString(),
        escrowAmount: entry.financialDetails?.escrowAmount?.toString(),
        beforeState: entry.beforeState,
        afterState: entry.afterState,
        changeDescription: entry.changeDescription,
        complianceRelated: complianceRelated,
        complianceFlags: entry.complianceContext?.complianceFlags || [],
        riskLevel: riskLevel,
        complianceOfficer: entry.complianceContext?.complianceOfficer,
        complianceNotes: entry.complianceContext?.complianceNotes,
        sebiReportable: sebiReportable,
        rbiReportable: rbiReportable,
        ipAddress: entry.actorContext.ipAddress,
        userAgent: entry.actorContext.userAgent,
        sessionId: entry.actorContext.sessionId,
        deviceFingerprint: entry.actorContext.deviceFingerprint,
        geoLocation: entry.actorContext.geoLocation,
        documentIds: entry.documentIds || [],
        retentionExpiresAt: retentionExpiresAt,
        metadata: entry.metadata || {},
      });
      
      console.log(`[UnlistedAudit] Logged ${entry.action} for ${entry.entityType}:${entry.entityId}`);
      return auditId;
    } catch (error) {
      console.error('[UnlistedAudit] Failed to log audit event:', error);
      throw error;
    }
  }
  
  /**
   * Convenience method for logging deal events
   */
  async logDealEvent(
    action: AuditAction,
    dealId: string,
    actorContext: AuditContext,
    options: {
      companyContext?: CompanyContext;
      financialDetails?: FinancialDetails;
      counterpartyUserId?: string;
      counterpartyPan?: string;
      beforeState?: Record<string, any>;
      afterState?: Record<string, any>;
      changeDescription?: string;
      complianceContext?: ComplianceContext;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    return this.logAuditEvent({
      action,
      actionCategory: 'deal',
      entityType: 'deal',
      entityId: dealId,
      actorContext,
      companyContext: options.companyContext,
      dealContext: {
        dealId,
        counterpartyUserId: options.counterpartyUserId,
        counterpartyPan: options.counterpartyPan,
      },
      financialDetails: options.financialDetails,
      beforeState: options.beforeState,
      afterState: options.afterState,
      changeDescription: options.changeDescription,
      complianceContext: options.complianceContext,
      metadata: options.metadata,
    });
  }
  
  /**
   * Convenience method for logging listing events
   */
  async logListingEvent(
    action: AuditAction,
    listingId: string,
    entityType: 'sell_listing' | 'buy_request',
    actorContext: AuditContext,
    options: {
      companyContext?: CompanyContext;
      financialDetails?: FinancialDetails;
      beforeState?: Record<string, any>;
      afterState?: Record<string, any>;
      changeDescription?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    return this.logAuditEvent({
      action,
      actionCategory: entityType === 'sell_listing' ? 'listing' : 'order',
      entityType,
      entityId: listingId,
      actorContext,
      companyContext: options.companyContext,
      financialDetails: options.financialDetails,
      beforeState: options.beforeState,
      afterState: options.afterState,
      changeDescription: options.changeDescription,
      metadata: options.metadata,
    });
  }
  
  /**
   * Convenience method for logging payment events
   */
  async logPaymentEvent(
    action: AuditAction,
    paymentId: string,
    actorContext: AuditContext,
    options: {
      dealId?: string;
      companyContext?: CompanyContext;
      financialDetails?: FinancialDetails;
      counterpartyUserId?: string;
      beforeState?: Record<string, any>;
      afterState?: Record<string, any>;
      changeDescription?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    return this.logAuditEvent({
      action,
      actionCategory: 'payment',
      entityType: 'payment',
      entityId: paymentId,
      actorContext,
      companyContext: options.companyContext,
      dealContext: options.dealId ? {
        dealId: options.dealId,
        counterpartyUserId: options.counterpartyUserId,
      } : undefined,
      financialDetails: options.financialDetails,
      beforeState: options.beforeState,
      afterState: options.afterState,
      changeDescription: options.changeDescription,
      metadata: options.metadata,
    });
  }
  
  /**
   * Convenience method for logging compliance events
   */
  async logComplianceEvent(
    action: AuditAction,
    entityType: EntityType,
    entityId: string,
    actorContext: AuditContext,
    complianceContext: ComplianceContext,
    options: {
      companyContext?: CompanyContext;
      beforeState?: Record<string, any>;
      afterState?: Record<string, any>;
      changeDescription?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    return this.logAuditEvent({
      action,
      actionCategory: 'compliance',
      entityType,
      entityId,
      actorContext,
      companyContext: options.companyContext,
      complianceContext: {
        ...complianceContext,
        complianceRelated: true,
      },
      beforeState: options.beforeState,
      afterState: options.afterState,
      changeDescription: options.changeDescription,
      metadata: options.metadata,
    });
  }
  
  /**
   * Query audit logs with filters
   */
  async queryAuditLogs(filters: AuditLogFilters = {}) {
    try {
      const conditions = [];
      
      if (filters.userId) {
        conditions.push(eq(unlistedRegulatoryAuditLog.userId, filters.userId));
      }
      if (filters.companyId) {
        conditions.push(eq(unlistedRegulatoryAuditLog.companyId, filters.companyId));
      }
      if (filters.dealId) {
        conditions.push(eq(unlistedRegulatoryAuditLog.dealId, filters.dealId));
      }
      if (filters.action) {
        conditions.push(eq(unlistedRegulatoryAuditLog.action, filters.action));
      }
      if (filters.actionCategory) {
        conditions.push(eq(unlistedRegulatoryAuditLog.actionCategory, filters.actionCategory));
      }
      if (filters.entityType) {
        conditions.push(eq(unlistedRegulatoryAuditLog.entityType, filters.entityType));
      }
      if (filters.complianceRelated !== undefined) {
        conditions.push(eq(unlistedRegulatoryAuditLog.complianceRelated, filters.complianceRelated));
      }
      if (filters.sebiReportable !== undefined) {
        conditions.push(eq(unlistedRegulatoryAuditLog.sebiReportable, filters.sebiReportable));
      }
      if (filters.riskLevel) {
        conditions.push(eq(unlistedRegulatoryAuditLog.riskLevel, filters.riskLevel));
      }
      if (filters.startDate) {
        conditions.push(gte(unlistedRegulatoryAuditLog.timestamp, filters.startDate));
      }
      if (filters.endDate) {
        conditions.push(lte(unlistedRegulatoryAuditLog.timestamp, filters.endDate));
      }
      
      const query = db
        .select()
        .from(unlistedRegulatoryAuditLog)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(unlistedRegulatoryAuditLog.timestamp))
        .limit(filters.limit || 100)
        .offset(filters.offset || 0);
      
      return await query;
    } catch (error) {
      console.error('[UnlistedAudit] Failed to query audit logs:', error);
      throw error;
    }
  }
  
  /**
   * Get complete audit trail for a deal
   */
  async getDealAuditTrail(dealId: string) {
    try {
      return await db
        .select()
        .from(unlistedRegulatoryAuditLog)
        .where(eq(unlistedRegulatoryAuditLog.dealId, dealId))
        .orderBy(unlistedRegulatoryAuditLog.timestamp);
    } catch (error) {
      console.error('[UnlistedAudit] Failed to get deal audit trail:', error);
      throw error;
    }
  }
  
  /**
   * Get audit trail for a user
   */
  async getUserAuditTrail(userId: string, limit: number = 100) {
    try {
      return await db
        .select()
        .from(unlistedRegulatoryAuditLog)
        .where(eq(unlistedRegulatoryAuditLog.userId, userId))
        .orderBy(desc(unlistedRegulatoryAuditLog.timestamp))
        .limit(limit);
    } catch (error) {
      console.error('[UnlistedAudit] Failed to get user audit trail:', error);
      throw error;
    }
  }
  
  /**
   * Get SEBI reportable events
   */
  async getSebiReportableEvents(startDate?: Date, endDate?: Date) {
    try {
      const conditions = [eq(unlistedRegulatoryAuditLog.sebiReportable, true)];
      
      if (startDate) {
        conditions.push(gte(unlistedRegulatoryAuditLog.timestamp, startDate));
      }
      if (endDate) {
        conditions.push(lte(unlistedRegulatoryAuditLog.timestamp, endDate));
      }
      
      return await db
        .select()
        .from(unlistedRegulatoryAuditLog)
        .where(and(...conditions))
        .orderBy(desc(unlistedRegulatoryAuditLog.timestamp));
    } catch (error) {
      console.error('[UnlistedAudit] Failed to get SEBI reportable events:', error);
      throw error;
    }
  }
  
  /**
   * Mark event as reported to SEBI
   */
  async markSebiReported(auditId: string, reportRef: string) {
    try {
      await db
        .update(unlistedRegulatoryAuditLog)
        .set({
          sebiReportedAt: new Date(),
          sebiReportRef: reportRef,
        })
        .where(eq(unlistedRegulatoryAuditLog.id, auditId));
    } catch (error) {
      console.error('[UnlistedAudit] Failed to mark SEBI reported:', error);
      throw error;
    }
  }
  
  /**
   * Get retention statistics
   */
  async getRetentionStats(): Promise<RetentionStats> {
    try {
      const now = new Date();
      const nearExpiryDate = new Date(now);
      nearExpiryDate.setMonth(nearExpiryDate.getMonth() + 6); // 6 months to expiry
      
      const [totalResult, nearingExpiryResult, archivedResult, expiredResult] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(unlistedRegulatoryAuditLog),
        db.select({ count: sql<number>`count(*)` })
          .from(unlistedRegulatoryAuditLog)
          .where(and(
            lte(unlistedRegulatoryAuditLog.retentionExpiresAt, nearExpiryDate),
            gte(unlistedRegulatoryAuditLog.retentionExpiresAt, now)
          )),
        db.select({ count: sql<number>`count(*)` })
          .from(unlistedRegulatoryAuditLog)
          .where(eq(unlistedRegulatoryAuditLog.archived, true)),
        db.select({ count: sql<number>`count(*)` })
          .from(unlistedRegulatoryAuditLog)
          .where(lt(unlistedRegulatoryAuditLog.retentionExpiresAt, now)),
      ]);
      
      return {
        totalRecords: Number(totalResult[0]?.count || 0),
        recordsNearingExpiry: Number(nearingExpiryResult[0]?.count || 0),
        archivedRecords: Number(archivedResult[0]?.count || 0),
        expiredRecords: Number(expiredResult[0]?.count || 0),
      };
    } catch (error) {
      console.error('[UnlistedAudit] Failed to get retention stats:', error);
      throw error;
    }
  }
  
  /**
   * Archive old records (move to cold storage indicator)
   */
  async archiveOldRecords(cutoffDate: Date) {
    try {
      const result = await db
        .update(unlistedRegulatoryAuditLog)
        .set({
          archived: true,
          archivedAt: new Date(),
        })
        .where(and(
          lt(unlistedRegulatoryAuditLog.timestamp, cutoffDate),
          eq(unlistedRegulatoryAuditLog.archived, false)
        ));
      
      console.log(`[UnlistedAudit] Archived records older than ${cutoffDate.toISOString()}`);
      return result;
    } catch (error) {
      console.error('[UnlistedAudit] Failed to archive old records:', error);
      throw error;
    }
  }
  
  /**
   * Cleanup expired records (after retention period)
   * Note: In production, this should export to permanent archive first
   */
  async cleanupExpiredRecords(dryRun: boolean = true) {
    try {
      const now = new Date();
      
      const expiredRecords = await db
        .select({ id: unlistedRegulatoryAuditLog.id })
        .from(unlistedRegulatoryAuditLog)
        .where(lt(unlistedRegulatoryAuditLog.retentionExpiresAt, now));
      
      console.log(`[UnlistedAudit] Found ${expiredRecords.length} expired records`);
      
      if (!dryRun && expiredRecords.length > 0) {
        // In production, export to permanent archive before deletion
        console.warn('[UnlistedAudit] Deletion disabled - records should be exported to permanent archive first');
      }
      
      return {
        expiredCount: expiredRecords.length,
        dryRun,
        deleted: false,
      };
    } catch (error) {
      console.error('[UnlistedAudit] Failed to cleanup expired records:', error);
      throw error;
    }
  }
  
  // ==================== PRIVATE METHODS ====================
  
  private isSebiReportable(entry: AuditLogEntry): boolean {
    // Always reportable actions
    if (SEBI_REPORTABLE_ACTIONS.includes(entry.action)) {
      return true;
    }
    
    // High value transactions
    const totalValue = entry.financialDetails?.totalValue || 0;
    if (totalValue >= SEBI_REPORTING_THRESHOLD_INR) {
      return true;
    }
    
    // Compliance overrides
    if (entry.complianceContext?.complianceRelated && entry.complianceContext?.riskLevel === 'critical') {
      return true;
    }
    
    return entry.complianceContext?.sebiReportable || false;
  }
  
  private isRbiReportable(entry: AuditLogEntry): boolean {
    // High value foreign transactions would require RBI reporting
    const totalValue = entry.financialDetails?.totalValue || 0;
    if (totalValue >= HIGH_VALUE_THRESHOLD_INR) {
      return true;
    }
    
    return entry.complianceContext?.rbiReportable || false;
  }
  
  private isComplianceRelated(entry: AuditLogEntry): boolean {
    if (entry.complianceContext?.complianceRelated) {
      return true;
    }
    
    return COMPLIANCE_RELATED_ACTIONS.includes(entry.action);
  }
  
  private calculateRiskLevel(entry: AuditLogEntry): RiskLevel {
    const totalValue = entry.financialDetails?.totalValue || 0;
    const complianceFlags = entry.complianceContext?.complianceFlags || [];
    
    // Critical risk
    if (totalValue >= HIGH_VALUE_THRESHOLD_INR || complianceFlags.length >= 3) {
      return 'critical';
    }
    
    // High risk
    if (totalValue >= SEBI_REPORTING_THRESHOLD_INR || complianceFlags.length >= 2) {
      return 'high';
    }
    
    // Medium risk
    if (complianceFlags.length >= 1 || ['compliance_override', 'dispute_raised'].includes(entry.action)) {
      return 'medium';
    }
    
    return 'low';
  }
}

// Export singleton instance
export const unlistedRegulatoryAuditService = new UnlistedRegulatoryAuditService();
