import { db } from "../db";
import { errorLedger, ErrorLedgerEntry, users } from "../../shared/schema";
import { eq, desc, and, gte, lte, sql, like, or, count } from "drizzle-orm";
import crypto from "crypto";

function maskPan(pan: string | undefined | null): string | null {
  if (!pan) return null;
  const cleaned = pan.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length < 4) return 'XXXX';
  return `${cleaned.slice(0, 2)}XXXXXX${cleaned.slice(-2)}`;
}

function generateStackHash(stack: string | undefined): string | null {
  if (!stack) return null;
  return crypto.createHash('sha256').update(stack).digest('hex').substring(0, 64);
}

interface ErrorIngestionPayload {
  source: string;
  severity: string;
  errorCode: string;
  message: string;
  stack?: string;
  context: {
    module: string;
    clientId?: string;
    agentId?: string;
    transactionId?: string;
    pan?: string;
    requestId?: string;
    url?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  };
  sentryEventId?: string;
  buildVersion?: string;
}

interface ErrorFilters {
  severity?: string;
  status?: string;
  module?: string;
  errorCode?: string;
  dateFrom?: Date;
  dateTo?: Date;
  clientId?: string;
  agentId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface ErrorMetrics {
  totalErrors: number;
  bySeverity: Record<string, number>;
  byModule: Record<string, number>;
  byStatus: Record<string, number>;
  topErrorCodes: Array<{ errorCode: string; count: number }>;
  recentTrend: Array<{ date: string; count: number }>;
  clientImpactScore: number;
}

class ErrorTrackingService {
  async ingestError(payload: ErrorIngestionPayload, ipAddress?: string): Promise<ErrorLedgerEntry> {
    const stackHash = generateStackHash(payload.stack);
    const panMasked = maskPan(payload.context.pan);
    
    if (stackHash) {
      const existingError = await db.query.errorLedger.findFirst({
        where: and(
          eq(errorLedger.stackHash, stackHash),
          eq(errorLedger.status, 'open')
        )
      });
      
      if (existingError) {
        const [updated] = await db.update(errorLedger)
          .set({
            occurrenceCount: sql`${errorLedger.occurrenceCount} + 1`,
            lastOccurrence: new Date(),
            updatedAt: new Date()
          })
          .where(eq(errorLedger.id, existingError.id))
          .returning();
        return updated;
      }
    }
    
    const [newError] = await db.insert(errorLedger).values({
      errorCode: payload.errorCode,
      severity: payload.severity,
      source: payload.source,
      module: payload.context.module,
      message: payload.message,
      stackHash,
      stackTrace: payload.stack,
      clientId: payload.context.clientId || null,
      agentId: payload.context.agentId || null,
      panMasked,
      transactionId: payload.context.transactionId || null,
      requestId: payload.context.requestId || null,
      userAgent: payload.context.userAgent || null,
      ipAddress: ipAddress || null,
      url: payload.context.url || null,
      sentryEventId: payload.sentryEventId || null,
      buildVersion: payload.buildVersion || null,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      metadata: payload.context.metadata || null,
      status: 'open',
      occurrenceCount: 1,
    }).returning();
    
    if (payload.severity === 'critical') {
      this.triggerCriticalAlert(newError);
    }
    
    return newError;
  }

  async getErrors(filters: ErrorFilters): Promise<{ errors: ErrorLedgerEntry[]; total: number }> {
    const conditions = [];
    
    if (filters.severity) {
      conditions.push(eq(errorLedger.severity, filters.severity));
    }
    if (filters.status) {
      conditions.push(eq(errorLedger.status, filters.status));
    }
    if (filters.module) {
      conditions.push(eq(errorLedger.module, filters.module));
    }
    if (filters.errorCode) {
      conditions.push(eq(errorLedger.errorCode, filters.errorCode));
    }
    if (filters.clientId) {
      conditions.push(eq(errorLedger.clientId, filters.clientId));
    }
    if (filters.agentId) {
      conditions.push(eq(errorLedger.agentId, filters.agentId));
    }
    if (filters.dateFrom) {
      conditions.push(gte(errorLedger.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(errorLedger.createdAt, filters.dateTo));
    }
    if (filters.search) {
      conditions.push(or(
        like(errorLedger.message, `%${filters.search}%`),
        like(errorLedger.errorCode, `%${filters.search}%`)
      ));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = await db.select({ count: count() })
      .from(errorLedger)
      .where(whereClause);
    
    const errors = await db.select()
      .from(errorLedger)
      .where(whereClause)
      .orderBy(desc(errorLedger.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
    
    return {
      errors,
      total: totalResult?.count || 0
    };
  }

  async getErrorById(id: string): Promise<ErrorLedgerEntry | null> {
    const error = await db.query.errorLedger.findFirst({
      where: eq(errorLedger.id, id)
    });
    return error || null;
  }

  async updateErrorStatus(
    id: string,
    status: string,
    userId: string,
    resolutionNote?: string
  ): Promise<ErrorLedgerEntry | null> {
    const updates: Partial<ErrorLedgerEntry> = {
      status,
      updatedAt: new Date()
    };
    
    if (status === 'acknowledged') {
      updates.acknowledgedBy = userId;
      updates.acknowledgedAt = new Date();
    } else if (status === 'resolved') {
      updates.resolvedBy = userId;
      updates.resolvedAt = new Date();
      if (resolutionNote) {
        updates.resolutionNote = resolutionNote;
      }
    }
    
    const [updated] = await db.update(errorLedger)
      .set(updates)
      .where(eq(errorLedger.id, id))
      .returning();
    
    return updated || null;
  }

  async getMetrics(dateFrom?: Date, dateTo?: Date): Promise<ErrorMetrics> {
    const conditions = [];
    if (dateFrom) conditions.push(gte(errorLedger.createdAt, dateFrom));
    if (dateTo) conditions.push(lte(errorLedger.createdAt, dateTo));
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = await db.select({ count: count() })
      .from(errorLedger)
      .where(whereClause);
    
    const bySeverityResult = await db.select({
      severity: errorLedger.severity,
      count: count()
    })
      .from(errorLedger)
      .where(whereClause)
      .groupBy(errorLedger.severity);
    
    const byModuleResult = await db.select({
      module: errorLedger.module,
      count: count()
    })
      .from(errorLedger)
      .where(whereClause)
      .groupBy(errorLedger.module);
    
    const byStatusResult = await db.select({
      status: errorLedger.status,
      count: count()
    })
      .from(errorLedger)
      .where(whereClause)
      .groupBy(errorLedger.status);
    
    const topErrorCodesResult = await db.select({
      errorCode: errorLedger.errorCode,
      count: count()
    })
      .from(errorLedger)
      .where(whereClause)
      .groupBy(errorLedger.errorCode)
      .orderBy(desc(count()))
      .limit(10);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const trendResult = await db.select({
      date: sql<string>`DATE(${errorLedger.createdAt})`,
      count: count()
    })
      .from(errorLedger)
      .where(gte(errorLedger.createdAt, sevenDaysAgo))
      .groupBy(sql`DATE(${errorLedger.createdAt})`)
      .orderBy(sql`DATE(${errorLedger.createdAt})`);
    
    const [impactResult] = await db.select({
      uniqueClients: sql<number>`COUNT(DISTINCT ${errorLedger.clientId})`
    })
      .from(errorLedger)
      .where(and(
        whereClause,
        eq(errorLedger.severity, 'critical')
      ));
    
    const bySeverity: Record<string, number> = {};
    bySeverityResult.forEach(r => { bySeverity[r.severity] = Number(r.count); });
    
    const byModule: Record<string, number> = {};
    byModuleResult.forEach(r => { byModule[r.module] = Number(r.count); });
    
    const byStatus: Record<string, number> = {};
    byStatusResult.forEach(r => { byStatus[r.status || 'unknown'] = Number(r.count); });
    
    return {
      totalErrors: Number(totalResult?.count || 0),
      bySeverity,
      byModule,
      byStatus,
      topErrorCodes: topErrorCodesResult.map(r => ({
        errorCode: r.errorCode,
        count: Number(r.count)
      })),
      recentTrend: trendResult.map(r => ({
        date: r.date,
        count: Number(r.count)
      })),
      clientImpactScore: Number(impactResult?.uniqueClients || 0)
    };
  }

  async getRecentCriticalErrors(limit: number = 10): Promise<ErrorLedgerEntry[]> {
    return db.select()
      .from(errorLedger)
      .where(and(
        eq(errorLedger.severity, 'critical'),
        eq(errorLedger.status, 'open')
      ))
      .orderBy(desc(errorLedger.createdAt))
      .limit(limit);
  }

  private async triggerCriticalAlert(error: ErrorLedgerEntry) {
    console.log(`[CRITICAL ALERT] Error ${error.id}: ${error.message}`);
  }
}

export const errorTrackingService = new ErrorTrackingService();
