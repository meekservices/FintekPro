import { db } from "./db";
import * as schema from "@shared/schema";
import { desc, asc, eq, and, gte, lte, sql, or } from "drizzle-orm";
import { createHash } from "crypto";

/**
 * Audit Storage Module - Dedicated layer for audit log queries
 * Provides cursor-based pagination, hash chain verification, and compliance-grade data access
 */

export interface CursorPaginationParams {
  limit?: number;
  cursor?: string; // ISO timestamp
  direction?: 'forward' | 'backward';
}

export interface AuditQueryFilters {
  userId?: string;
  action?: string;
  resource?: string;
  regulatoryCategory?: string;
  startDate?: Date;
  endDate?: Date;
}

export class AuditStorage {
  /**
   * Get compliance audit trail logs (complianceAuditTrail table)
   */
  async getDataAccessLogs(filters: AuditQueryFilters = {}, pagination: CursorPaginationParams = {}) {
    const { limit = 100, cursor, direction = 'forward' } = pagination;
    const { userId, action, startDate, endDate } = filters;

    // Build conditions array
    const conditions = [];
    if (userId) conditions.push(eq(schema.complianceAuditTrail.userId, userId));
    if (action) conditions.push(eq(schema.complianceAuditTrail.action, action));
    if (startDate) conditions.push(gte(schema.complianceAuditTrail.createdAt, startDate));
    if (endDate) conditions.push(lte(schema.complianceAuditTrail.createdAt, endDate));
    if (cursor) {
      conditions.push(
        direction === 'forward'
          ? lte(schema.complianceAuditTrail.createdAt, new Date(cursor))
          : gte(schema.complianceAuditTrail.createdAt, new Date(cursor))
      );
    }

    // Build query with or without where clause
    const baseQuery = db
      .select()
      .from(schema.complianceAuditTrail)
      .orderBy(desc(schema.complianceAuditTrail.createdAt), desc(schema.complianceAuditTrail.id))
      .limit(limit + 1);

    const results = conditions.length > 0
      ? await baseQuery.where(and(...conditions))
      : await baseQuery;
    const hasMore = results.length > limit;
    const logs = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && logs.length > 0 ? logs[logs.length - 1].createdAt?.toISOString() : null;

    return {
      logs,
      pagination: {
        hasMore,
        nextCursor,
        count: logs.length,
      },
    };
  }

  /**
   * Get KYC verification attempt logs (kycStateTransitions table)
   */
  async getKycVerificationLogs(filters: AuditQueryFilters = {}, pagination: CursorPaginationParams = {}) {
    const { limit = 100, cursor, direction = 'forward' } = pagination;
    const { userId, startDate, endDate } = filters;

    const conditions = [];
    if (userId) conditions.push(eq(schema.kycStateTransitions.userId, userId));
    if (startDate) conditions.push(gte(schema.kycStateTransitions.occurredAt, startDate));
    if (endDate) conditions.push(lte(schema.kycStateTransitions.occurredAt, endDate));
    if (cursor) {
      conditions.push(
        direction === 'forward'
          ? lte(schema.kycStateTransitions.occurredAt, new Date(cursor))
          : gte(schema.kycStateTransitions.occurredAt, new Date(cursor))
      );
    }

    const baseQuery = db
      .select({
        id: schema.kycStateTransitions.id,
        sessionId: schema.kycStateTransitions.sessionId,
        userId: schema.kycStateTransitions.userId,
        fromState: schema.kycStateTransitions.fromState,
        toState: schema.kycStateTransitions.toState,
        trigger: schema.kycStateTransitions.trigger,
        performedBy: schema.kycStateTransitions.performedBy,
        performedByRole: schema.kycStateTransitions.performedByRole,
        metadata: schema.kycStateTransitions.metadata,
        ipAddress: schema.kycStateTransitions.ipAddress,
        userAgent: schema.kycStateTransitions.userAgent,
        occurredAt: schema.kycStateTransitions.occurredAt,
      })
      .from(schema.kycStateTransitions)
      .orderBy(desc(schema.kycStateTransitions.occurredAt), desc(schema.kycStateTransitions.id))
      .limit(limit + 1);

    const results = conditions.length > 0
      ? await baseQuery.where(and(...conditions))
      : await baseQuery;
    const hasMore = results.length > limit;
    const attempts = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && attempts.length > 0 ? attempts[attempts.length - 1].occurredAt?.toISOString() : null;

    // Transform for frontend compatibility
    const transformedAttempts = attempts.map(attempt => ({
      id: attempt.id,
      userId: attempt.userId,
      sessionId: attempt.sessionId,
      verificationMethod: attempt.fromState + '_to_' + attempt.toState,
      provider: attempt.trigger,
      outcome: attempt.toState.includes('approved') || attempt.toState.includes('verified') ? 'success' : 'failure',
      attemptedAt: attempt.occurredAt,
      latencyMs: null,
    }));

    return {
      attempts: transformedAttempts,
      pagination: {
        hasMore,
        nextCursor,
        count: transformedAttempts.length,
      },
    };
  }

  /**
   * Get mutual fund order execution audit (unifiedOrders + orderLifecycleEvents)
   */
  async getMfOrderExecutionLogs(filters: AuditQueryFilters = {}, pagination: CursorPaginationParams = {}) {
    const { limit = 100, cursor, direction = 'forward' } = pagination;
    const { userId, startDate, endDate } = filters;

    const conditions = [eq(schema.unifiedOrders.productType, 'mutual_fund')];
    if (userId) conditions.push(eq(schema.unifiedOrders.userId, userId));
    if (startDate) conditions.push(gte(schema.unifiedOrders.createdAt, startDate));
    if (endDate) conditions.push(lte(schema.unifiedOrders.createdAt, endDate));
    if (cursor) {
      conditions.push(
        direction === 'forward'
          ? lte(schema.unifiedOrders.createdAt, new Date(cursor))
          : gte(schema.unifiedOrders.createdAt, new Date(cursor))
      );
    }

    const results = await db
      .select({
        id: schema.unifiedOrders.id,
        orderNumber: schema.unifiedOrders.orderNumber,
        userId: schema.unifiedOrders.userId,
        productType: schema.unifiedOrders.productType,
        productName: schema.unifiedOrders.productName,
        orderType: schema.unifiedOrders.orderType,
        amount: schema.unifiedOrders.amount,
        status: schema.unifiedOrders.status,
        arnCode: schema.unifiedOrders.arnCode,
        euinNumber: schema.unifiedOrders.euinNumber,
        agentId: schema.unifiedOrders.agentId,
        executedAt: schema.unifiedOrders.executedAt,
        createdAt: schema.unifiedOrders.createdAt,
      })
      .from(schema.unifiedOrders)
      .where(and(...conditions))
      .orderBy(desc(schema.unifiedOrders.createdAt), desc(schema.unifiedOrders.id))
      .limit(limit + 1);
    const hasMore = results.length > limit;
    const orders = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && orders.length > 0 ? orders[orders.length - 1].createdAt?.toISOString() : null;

    // Transform for frontend compatibility
    const transformedOrders = orders.map(order => ({
      id: order.id,
      orderId: order.orderNumber,
      userId: order.userId,
      symbol: order.productName,
      action: order.orderType,
      status: order.status,
      totalQuantity: order.amount,
      createdAt: order.createdAt,
      arnCode: order.arnCode,
      euinNumber: order.euinNumber,
      agentId: order.agentId,
    }));

    return {
      orders: transformedOrders,
      pagination: {
        hasMore,
        nextCursor,
        count: transformedOrders.length,
      },
    };
  }

  /**
   * Get Account Aggregator consent ledger (panConsentAuditLog table)
   */
  async getConsentLedgerLogs(filters: AuditQueryFilters = {}, pagination: CursorPaginationParams = {}) {
    const { limit = 100, cursor, direction = 'forward' } = pagination;
    const { userId, startDate, endDate } = filters;

    const conditions = [];
    if (userId) conditions.push(eq(schema.panConsentAuditLog.userId, userId));
    if (startDate) conditions.push(gte(schema.panConsentAuditLog.timestamp, startDate));
    if (endDate) conditions.push(lte(schema.panConsentAuditLog.timestamp, endDate));
    if (cursor) {
      conditions.push(
        direction === 'forward'
          ? lte(schema.panConsentAuditLog.timestamp, new Date(cursor))
          : gte(schema.panConsentAuditLog.timestamp, new Date(cursor))
      );
    }

    const baseQuery = db
      .select()
      .from(schema.panConsentAuditLog)
      .orderBy(desc(schema.panConsentAuditLog.timestamp), desc(schema.panConsentAuditLog.id))
      .limit(limit + 1);

    const results = conditions.length > 0
      ? await baseQuery.where(and(...conditions))
      : await baseQuery;
    const hasMore = results.length > limit;
    const consents = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && consents.length > 0 ? consents[consents.length - 1].timestamp?.toISOString() : null;

    // Transform for frontend compatibility
    const transformedConsents = consents.map(consent => ({
      id: consent.id,
      consentId: consent.consentId,
      userId: consent.userId,
      purpose: consent.action,
      consentStatus: consent.action === 'revoked' ? 'revoked' : 'active',
      aaName: consent.apiEndpoint || 'PAN Consent',
      createdAt: consent.timestamp,
    }));

    return {
      consents: transformedConsents,
      pagination: {
        hasMore,
        nextCursor,
        count: transformedConsents.length,
      },
    };
  }

  /**
   * Get third-party API access logs (using auditLogs table with resource='third_party_api')
   */
  async getThirdPartyApiLogs(filters: AuditQueryFilters = {}, pagination: CursorPaginationParams = {}) {
    const { limit = 100, cursor, direction = 'forward' } = pagination;
    const { userId, startDate, endDate } = filters;

    const conditions = [eq(schema.auditLogs.resource, 'third_party_api')];
    if (userId) conditions.push(eq(schema.auditLogs.userId, userId));
    if (startDate) conditions.push(gte(schema.auditLogs.occurredAt, startDate));
    if (endDate) conditions.push(lte(schema.auditLogs.occurredAt, endDate));
    if (cursor) {
      conditions.push(
        direction === 'forward'
          ? lte(schema.auditLogs.occurredAt, new Date(cursor))
          : gte(schema.auditLogs.occurredAt, new Date(cursor))
      );
    }

    const results = await db
      .select()
      .from(schema.auditLogs)
      .where(and(...conditions))
      .orderBy(desc(schema.auditLogs.occurredAt), desc(schema.auditLogs.id))
      .limit(limit + 1);
    const hasMore = results.length > limit;
    const logs = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && logs.length > 0 ? logs[logs.length - 1].occurredAt?.toISOString() : null;

    // Transform for frontend compatibility
    const transformedLogs = logs.map(log => ({
      id: log.id,
      sessionId: log.resourceId,
      fetchType: log.operation,
      fetchStatus: log.status,
      accountsRequested: (log.metadata as any)?.accountsRequested || 0,
      accountsFetched: (log.metadata as any)?.accountsFetched || 0,
      createdAt: log.occurredAt,
    }));

    return {
      logs: transformedLogs,
      pagination: {
        hasMore,
        nextCursor,
        count: transformedLogs.length,
      },
    };
  }

  /**
   * Verify hash chain integrity of audit logs
   * Implements SHA-256 hash chain: currentLogHash = sha256(previousLogHash + payloadJson)
   */
  async verifyHashChainIntegrity(options: { windowSize?: number } = {}) {
    const { windowSize = 1000 } = options; // Default to last 1000 entries

    // Get audit logs ordered chronologically (oldest first)
    const logs = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(asc(schema.auditLogs.occurredAt), asc(schema.auditLogs.id))
      .limit(windowSize);

    if (logs.length === 0) {
      return {
        isValid: true,
        totalEntries: 0,
        invalidEntries: [],
        message: 'No audit logs to verify',
      };
    }

    const invalidEntries: any[] = [];

    for (let i = 0; i < logs.length; i++) {
      const currentLog = logs[i];

      // Build payload for hash computation
      const payload = JSON.stringify({
        userId: currentLog.userId,
        action: currentLog.action,
        resource: currentLog.resource,
        resourceId: currentLog.resourceId,
        operation: currentLog.operation,
        status: currentLog.status,
        occurredAt: currentLog.occurredAt,
      });

      // For the first log, previousLogHash should be empty or null
      // For subsequent logs, previousLogHash should match the previous log's currentLogHash
      let expectedPreviousHash = '';
      if (i > 0) {
        expectedPreviousHash = logs[i - 1].currentLogHash || '';
      }

      // Normalize previousLogHash (treat null/undefined as empty string)
      const normalizedPreviousHash = currentLog.previousLogHash || '';

      // Verify the previousLogHash is correct
      if (normalizedPreviousHash !== expectedPreviousHash) {
        invalidEntries.push({
          sequenceNumber: i,
          logId: currentLog.id,
          reason: 'Previous hash mismatch',
          expectedPreviousHash,
          actualPreviousHash: currentLog.previousLogHash,
        });
      }

      // Recompute the current log's hash: SHA-256(previousLogHash + payload)
      const expectedCurrentHash = createHash('sha256')
        .update((currentLog.previousLogHash || '') + payload)
        .digest('hex');

      // Verify the currentLogHash matches the recomputed hash
      if (currentLog.currentLogHash !== expectedCurrentHash) {
        invalidEntries.push({
          sequenceNumber: i,
          logId: currentLog.id,
          reason: 'Current hash mismatch (tampering detected)',
          expectedCurrentHash,
          actualCurrentHash: currentLog.currentLogHash,
        });
      }
    }

    return {
      isValid: invalidEntries.length === 0,
      totalEntries: logs.length,
      invalidEntries,
      message: invalidEntries.length === 0
        ? `Hash chain verified: ${logs.length} entries are valid`
        : `Hash chain broken: ${invalidEntries.length} invalid entries found`,
    };
  }
}

export const auditStorage = new AuditStorage();
