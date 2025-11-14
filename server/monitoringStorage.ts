import { db } from "./db";
import { sql } from "drizzle-orm";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import {
  errorEvents,
  errorStackTraces,
  errorGroups,
  apiHealthLogs,
  auditLogs,
  systemMetrics,
  type ErrorEvent,
  type ErrorStackTrace,
  type ErrorGroup,
  type ApiHealthLog,
  type AuditLog,
  type SystemMetric,
  type InsertErrorEvent,
  type InsertErrorStackTrace,
  type InsertErrorGroup,
  type InsertApiHealthLog,
  type InsertAuditLog,
  type InsertSystemMetric,
} from "@shared/schema";
import crypto from "crypto";

/**
 * Monitoring Storage Interface
 * Handles all monitoring, logging, and observability data
 */
export interface IMonitoringStorage {
  // Error Event Methods
  logError(event: Omit<InsertErrorEvent, "stackHash"> & { stackTrace?: string }): Promise<ErrorEvent>;
  getErrors(filters?: {
    source?: string[];
    severity?: string[];
    service?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<ErrorEvent[]>;
  getErrorById(id: string): Promise<ErrorEvent | undefined>;
  
  // Error Group Methods
  getErrorGroups(filters?: {
    status?: string;
    severity?: string[];
    service?: string;
    limit?: number;
  }): Promise<ErrorGroup[]>;
  updateErrorGroup(id: string, updates: Partial<ErrorGroup>): Promise<ErrorGroup | undefined>;
  
  // API Health Methods
  logApiHealth(log: InsertApiHealthLog): Promise<ApiHealthLog>;
  getApiHealthStatus(service?: string, hours?: number): Promise<ApiHealthLog[]>;
  
  // Audit Log Methods
  logAudit(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: {
    userId?: string;
    resource?: string;
    action?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<AuditLog[]>;
  
  // System Metrics Methods
  logMetric(metric: InsertSystemMetric): Promise<SystemMetric>;
  getMetrics(metricName: string, service?: string, hours?: number): Promise<SystemMetric[]>;
}

/**
 * Database-backed implementation of Monitoring Storage
 */
export class MonitoringStorage implements IMonitoringStorage {
  
  /**
   * Log an error event with automatic stack trace deduplication
   */
  async logError(event: Omit<InsertErrorEvent, "stackHash"> & { stackTrace?: string }): Promise<ErrorEvent> {
    const { stackTrace, ...eventData } = event;
    let stackHash: string | undefined;

    // Sanitize payload to remove PII
    const sanitizedPayload = eventData.payload ? this.sanitizePayload(eventData.payload) : undefined;

    // Deduplicate stack trace if provided
    if (stackTrace) {
      stackHash = this.hashStackTrace(stackTrace);
      
      // Check if stack trace already exists
      const [existingStack] = await db
        .select()
        .from(errorStackTraces)
        .where(eq(errorStackTraces.stackHash, stackHash))
        .limit(1);

      // Insert stack trace if new
      if (!existingStack) {
        await db.insert(errorStackTraces).values({
          stackHash,
          stackTrace: this.sanitizeStackTrace(stackTrace),
        });
      }
    }

    // Insert error event
    const [errorEvent] = await db
      .insert(errorEvents)
      .values({
        ...eventData,
        payload: sanitizedPayload,
        stackHash,
        occurredAt: eventData.occurredAt || new Date(),
      })
      .returning();

    // Update or create error group for aggregation
    if (stackHash && eventData.severity) {
      await this.updateErrorGroupAggregation(stackHash, eventData.service, eventData.environment || "production", eventData.severity);
    }

    return errorEvent;
  }

  /**
   * Get errors with flexible filtering
   */
  async getErrors(filters?: {
    source?: string[];
    severity?: string[];
    service?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<ErrorEvent[]> {
    let query = db.select().from(errorEvents);

    const conditions = [];
    
    if (filters?.source && filters.source.length > 0) {
      conditions.push(inArray(errorEvents.source, filters.source as any));
    }
    
    if (filters?.severity && filters.severity.length > 0) {
      conditions.push(inArray(errorEvents.severity, filters.severity as any));
    }
    
    if (filters?.service) {
      conditions.push(eq(errorEvents.service, filters.service));
    }
    
    if (filters?.userId) {
      conditions.push(eq(errorEvents.userId, filters.userId));
    }
    
    if (filters?.startTime) {
      conditions.push(gte(errorEvents.ingestionTs, filters.startTime));
    }
    
    if (filters?.endTime) {
      conditions.push(lte(errorEvents.ingestionTs, filters.endTime));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query
      .orderBy(desc(errorEvents.ingestionTs))
      .limit(filters?.limit || 100);

    return results;
  }

  /**
   * Get a specific error by ID
   */
  async getErrorById(id: string): Promise<ErrorEvent | undefined> {
    const [error] = await db
      .select()
      .from(errorEvents)
      .where(eq(errorEvents.id, id))
      .limit(1);

    return error;
  }

  /**
   * Get error groups with filtering
   */
  async getErrorGroups(filters?: {
    status?: string;
    severity?: string[];
    service?: string;
    limit?: number;
  }): Promise<ErrorGroup[]> {
    let query = db.select().from(errorGroups);

    const conditions = [];
    
    if (filters?.status) {
      conditions.push(eq(errorGroups.status, filters.status));
    }
    
    if (filters?.severity && filters.severity.length > 0) {
      conditions.push(inArray(errorGroups.severity, filters.severity as any));
    }
    
    if (filters?.service) {
      conditions.push(eq(errorGroups.service, filters.service));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query
      .orderBy(desc(errorGroups.lastOccurrence))
      .limit(filters?.limit || 50);

    return results;
  }

  /**
   * Update an error group (for resolution, AI analysis, etc.)
   */
  async updateErrorGroup(id: string, updates: Partial<ErrorGroup>): Promise<ErrorGroup | undefined> {
    const [updated] = await db
      .update(errorGroups)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(errorGroups.id, id))
      .returning();

    return updated;
  }

  /**
   * Log API health check result
   */
  async logApiHealth(log: InsertApiHealthLog): Promise<ApiHealthLog> {
    // Sanitize error messages that might contain sensitive data
    const sanitizedLog = {
      ...log,
      errorMessage: log.errorMessage ? this.sanitizeStackTrace(log.errorMessage) : undefined,
      failureReason: log.failureReason ? this.sanitizeStackTrace(log.failureReason) : undefined,
    };

    const [healthLog] = await db
      .insert(apiHealthLogs)
      .values(sanitizedLog)
      .returning();

    return healthLog;
  }

  /**
   * Get API health status for recent checks
   */
  async getApiHealthStatus(service?: string, hours: number = 24): Promise<ApiHealthLog[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const conditions = [gte(apiHealthLogs.checkedAt, startTime)];
    
    if (service) {
      conditions.push(eq(apiHealthLogs.service, service));
    }

    const results = await db
      .select()
      .from(apiHealthLogs)
      .where(and(...conditions))
      .orderBy(desc(apiHealthLogs.checkedAt));

    return results;
  }

  /**
   * Log audit event for compliance
   */
  async logAudit(log: InsertAuditLog): Promise<AuditLog> {
    // Sanitize metadata to remove PII
    const sanitizedMetadata = log.metadata ? this.sanitizePayload(log.metadata) : undefined;
    const sanitizedDetails = log.details ? this.sanitizeStackTrace(log.details) : undefined;

    const sanitizedLog = {
      ...log,
      metadata: sanitizedMetadata,
      details: sanitizedDetails,
    };

    // Calculate hash chain for tamper evidence
    const previousHash = await this.getLastAuditLogHash();
    const currentHash = this.calculateAuditHash(sanitizedLog, previousHash);

    const [auditLog] = await db
      .insert(auditLogs)
      .values({
        ...sanitizedLog,
        previousLogHash: previousHash || null,
        currentLogHash: currentHash,
      })
      .returning();

    return auditLog;
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters?: {
    userId?: string;
    resource?: string;
    action?: string;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);

    const conditions = [];
    
    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    
    if (filters?.resource) {
      conditions.push(eq(auditLogs.resource, filters.resource));
    }
    
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action as any));
    }
    
    if (filters?.startTime) {
      conditions.push(gte(auditLogs.occurredAt, filters.startTime));
    }
    
    if (filters?.endTime) {
      conditions.push(lte(auditLogs.occurredAt, filters.endTime));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query
      .orderBy(desc(auditLogs.occurredAt))
      .limit(filters?.limit || 100);

    return results;
  }

  /**
   * Log system metric
   */
  async logMetric(metric: InsertSystemMetric): Promise<SystemMetric> {
    const [systemMetric] = await db
      .insert(systemMetrics)
      .values(metric)
      .returning();

    return systemMetric;
  }

  /**
   * Get metrics for a specific metric name
   */
  async getMetrics(metricName: string, service?: string, hours: number = 24): Promise<SystemMetric[]> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const conditions = [
      eq(systemMetrics.metricName, metricName),
      gte(systemMetrics.collectedAt, startTime)
    ];

    if (service) {
      conditions.push(eq(systemMetrics.service, service));
    }

    const results = await db
      .select()
      .from(systemMetrics)
      .where(and(...conditions))
      .orderBy(desc(systemMetrics.collectedAt));

    return results;
  }

  // ===== Private Helper Methods =====

  /**
   * Generate SHA-256 hash of stack trace for deduplication
   */
  private hashStackTrace(stackTrace: string): string {
    return crypto.createHash("sha256").update(stackTrace).digest("hex");
  }

  /**
   * Sanitize stack trace by removing sensitive information
   */
  private sanitizeStackTrace(stackTrace: string): string {
    let sanitized = stackTrace;
    
    // Remove auth tokens and API keys
    sanitized = sanitized.replace(/Bearer\s+[\w.-]+/gi, "Bearer [REDACTED]");
    sanitized = sanitized.replace(/api[_-]?key[:=]\s*["']?[\w.-]+["']?/gi, "api_key=[REDACTED]");
    sanitized = sanitized.replace(/token[:=]\s*["']?[\w.-]+["']?/gi, "token=[REDACTED]");
    sanitized = sanitized.replace(/authorization[:=]\s*["']?[\w\s.-]+["']?/gi, "authorization=[REDACTED]");
    
    // Remove passwords
    sanitized = sanitized.replace(/password[:=]\s*["']?[^\s"']+["']?/gi, "password=[REDACTED]");
    sanitized = sanitized.replace(/passwd[:=]\s*["']?[^\s"']+["']?/gi, "passwd=[REDACTED]");
    sanitized = sanitized.replace(/pwd[:=]\s*["']?[^\s"']+["']?/gi, "pwd=[REDACTED]");
    
    // Remove email addresses
    sanitized = sanitized.replace(/[\w.-]+@[\w.-]+\.\w+/g, "[EMAIL_REDACTED]");
    
    // Remove phone numbers (basic patterns)
    sanitized = sanitized.replace(/\b\d{10,15}\b/g, "[PHONE_REDACTED]");
    sanitized = sanitized.replace(/\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, "[PHONE_REDACTED]");
    
    // Remove credit card numbers (basic Luhn check patterns)
    sanitized = sanitized.replace(/\b\d{13,19}\b/g, (match) => {
      // Basic credit card pattern check
      if (/^[3-6]\d{12,18}$/.test(match.replace(/\s/g, ""))) {
        return "[CC_REDACTED]";
      }
      return match;
    });
    
    // Remove PAN/Aadhaar numbers (India-specific)
    sanitized = sanitized.replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[PAN_REDACTED]"); // PAN
    sanitized = sanitized.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[AADHAAR_REDACTED]"); // Aadhaar
    
    // Remove JWT tokens
    sanitized = sanitized.replace(/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, "[JWT_REDACTED]");
    
    // Remove URLs with auth params
    sanitized = sanitized.replace(/([?&](access_token|api_key|apikey|token|auth|key)=)[^&\s]+/gi, "$1[REDACTED]");
    
    // Remove session IDs
    sanitized = sanitized.replace(/session[_-]?id[:=]\s*["']?[\w.-]+["']?/gi, "session_id=[REDACTED]");
    sanitized = sanitized.replace(/sid[:=]\s*["']?[\w.-]+["']?/gi, "sid=[REDACTED]");
    
    // Remove common secret patterns
    sanitized = sanitized.replace(/secret[:=]\s*["']?[\w.-]+["']?/gi, "secret=[REDACTED]");
    sanitized = sanitized.replace(/client[_-]?secret[:=]\s*["']?[\w.-]+["']?/gi, "client_secret=[REDACTED]");
    
    // Truncate if too large (max 32KB)
    if (sanitized.length > 32768) {
      sanitized = sanitized.substring(0, 32768) + "\n... [TRUNCATED]";
    }
    
    return sanitized;
  }

  /**
   * Sanitize payload data recursively
   */
  private sanitizePayload(payload: any): any {
    // Handle null and undefined
    if (payload === null || payload === undefined) {
      return payload;
    }

    // Handle primitives (strings, numbers, booleans)
    if (typeof payload === "string") {
      return this.sanitizeStackTrace(payload);
    }
    if (typeof payload === "number" || typeof payload === "boolean") {
      return payload;
    }

    // Handle special objects that should be preserved (Date, RegExp, etc.)
    if (payload instanceof Date || payload instanceof RegExp) {
      return payload;
    }

    // Handle arrays
    if (Array.isArray(payload)) {
      return payload.map((item) => this.sanitizePayload(item));
    }

    // Handle plain objects only
    if (typeof payload === "object" && payload.constructor === Object) {
      const sanitized: any = {};
      const sensitiveKeys = [
        "password", "passwd", "pwd", "token", "api_key", "apikey", "secret", 
        "authorization", "auth", "session", "sessionid", "sid", "jwt", 
        "access_token", "refresh_token", "client_secret", "private_key",
        "pan", "aadhaar", "ssn", "credit_card", "cvv", "card_number"
      ];

      for (const [key, value] of Object.entries(payload)) {
        const lowerKey = key.toLowerCase();
        
        // Check if key contains sensitive information
        if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
          sanitized[key] = "[REDACTED]";
        } else {
          // Recursively sanitize the value
          sanitized[key] = this.sanitizePayload(value);
        }
      }

      return sanitized;
    }

    // For any other object types (Map, Set, custom classes), preserve as-is
    // to avoid data corruption
    return payload;
  }

  /**
   * Update or create error group aggregation
   */
  private async updateErrorGroupAggregation(
    stackHash: string,
    service: string,
    environment: string,
    severity: string
  ): Promise<void> {
    const now = new Date();

    // Try to find existing group
    const [existingGroup] = await db
      .select()
      .from(errorGroups)
      .where(and(
        eq(errorGroups.stackHash, stackHash),
        eq(errorGroups.service, service),
        eq(errorGroups.environment, environment)
      ))
      .limit(1);

    if (existingGroup) {
      // Update existing group
      await db
        .update(errorGroups)
        .set({
          totalCount: (existingGroup.totalCount || 0) + 1,
          lastOccurrence: now,
          updatedAt: now,
        })
        .where(eq(errorGroups.id, existingGroup.id));
    } else {
      // Create new group
      await db.insert(errorGroups).values({
        stackHash,
        service,
        environment,
        severity: severity as any,
        totalCount: 1,
        affectedUsers: 1,
        firstOccurrence: now,
        lastOccurrence: now,
      });
    }
  }

  /**
   * Get hash of the last audit log entry for hash chain
   */
  private async getLastAuditLogHash(): Promise<string | undefined> {
    const [lastLog] = await db
      .select({ currentLogHash: auditLogs.currentLogHash })
      .from(auditLogs)
      .orderBy(desc(auditLogs.occurredAt))
      .limit(1);

    return lastLog?.currentLogHash || undefined;
  }

  /**
   * Calculate hash for audit log entry
   */
  private calculateAuditHash(log: InsertAuditLog, previousHash?: string): string {
    const data = JSON.stringify({
      ...log,
      previousHash: previousHash || "genesis",
      timestamp: new Date().toISOString(),
    });
    
    return crypto.createHash("sha256").update(data).digest("hex");
  }
}

// Export singleton instance
export const monitoringStorage = new MonitoringStorage();
