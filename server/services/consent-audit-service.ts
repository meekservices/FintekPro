// @ts-nocheck
import { db } from "../db";
import { consentAuditLog, InsertConsentAuditLog, ConsentAuditLog } from "@shared/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

export type ConsentType = 
  | 'essential_cookies'
  | 'analytics_cookies'
  | 'marketing_cookies'
  | 'terms_of_service'
  | 'privacy_policy'
  | 'data_processing'
  | 'third_party_sharing'
  | 'marketing_communications'
  | 'kyc_data_processing'
  | 'investment_profiling'
  | 'credit_check'
  | 'all_cookies';

export type ConsentAction = 'granted' | 'withdrawn' | 'updated';

interface RecordConsentParams {
  userId?: number;
  sessionId?: string;
  consentType: ConsentType;
  action: ConsentAction;
  version?: string;
  sourceScreen?: string;
  sourceComponent?: string;
  ipAddress?: string;
  userAgent?: string;
  consentText?: string;
  additionalData?: Record<string, any>;
}

interface ConsentSummary {
  consentType: ConsentType;
  currentStatus: ConsentAction;
  lastUpdated: Date;
  version: string;
}

class ConsentAuditService {
  async recordConsent(params: RecordConsentParams): Promise<ConsentAuditLog> {
    const record = await db.insert(consentAuditLog).values({
      userId: params.userId,
      sessionId: params.sessionId,
      consentType: params.consentType,
      action: params.action,
      version: params.version || '1.0',
      sourceScreen: params.sourceScreen,
      sourceComponent: params.sourceComponent,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      consentText: params.consentText,
      additionalData: params.additionalData || {},
    }).returning();

    console.log(`[ConsentAudit] Recorded ${params.action} for ${params.consentType} - User: ${params.userId || 'anonymous'}`);
    return record[0];
  }

  async recordBulkConsent(
    consents: Array<{ consentType: ConsentType; action: ConsentAction }>,
    commonParams: Omit<RecordConsentParams, 'consentType' | 'action'>
  ): Promise<ConsentAuditLog[]> {
    const records = await db.insert(consentAuditLog).values(
      consents.map(c => ({
        userId: commonParams.userId,
        sessionId: commonParams.sessionId,
        consentType: c.consentType,
        action: c.action,
        version: commonParams.version || '1.0',
        sourceScreen: commonParams.sourceScreen,
        sourceComponent: commonParams.sourceComponent,
        ipAddress: commonParams.ipAddress,
        userAgent: commonParams.userAgent,
        consentText: commonParams.consentText,
        additionalData: commonParams.additionalData || {},
      }))
    ).returning();

    console.log(`[ConsentAudit] Recorded ${records.length} consent actions - User: ${commonParams.userId || 'anonymous'}`);
    return records;
  }

  async getUserConsentHistory(userId: number, limit: number = 100): Promise<ConsentAuditLog[]> {
    return db.select()
      .from(consentAuditLog)
      .where(eq(consentAuditLog.userId, userId))
      .orderBy(desc(consentAuditLog.createdAt))
      .limit(limit);
  }

  async getUserCurrentConsents(userId: number): Promise<ConsentSummary[]> {
    const latestConsents = await db.execute(sql`
      SELECT DISTINCT ON (consent_type) 
        consent_type as "consentType",
        action as "currentStatus",
        created_at as "lastUpdated",
        version
      FROM consent_audit_log
      WHERE user_id = ${userId}
      ORDER BY consent_type, created_at DESC
    `);

    return latestConsents.rows as ConsentSummary[];
  }

  async getSessionConsentHistory(sessionId: string): Promise<ConsentAuditLog[]> {
    return db.select()
      .from(consentAuditLog)
      .where(eq(consentAuditLog.sessionId, sessionId))
      .orderBy(desc(consentAuditLog.createdAt));
  }

  async getConsentsByDateRange(
    startDate: Date,
    endDate: Date,
    consentType?: ConsentType
  ): Promise<ConsentAuditLog[]> {
    const conditions = [
      gte(consentAuditLog.createdAt, startDate),
      lte(consentAuditLog.createdAt, endDate),
    ];

    if (consentType) {
      conditions.push(eq(consentAuditLog.consentType, consentType));
    }

    return db.select()
      .from(consentAuditLog)
      .where(and(...conditions))
      .orderBy(desc(consentAuditLog.createdAt));
  }

  async getConsentStats(): Promise<{
    totalRecords: number;
    byType: Record<string, { granted: number; withdrawn: number }>;
    last24Hours: number;
    last7Days: number;
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalResult, byTypeResult, last24hResult, last7dResult] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as count FROM consent_audit_log`),
      db.execute(sql`
        SELECT consent_type, action, COUNT(*) as count 
        FROM consent_audit_log 
        GROUP BY consent_type, action
      `),
      db.execute(sql`
        SELECT COUNT(*) as count 
        FROM consent_audit_log 
        WHERE created_at >= ${oneDayAgo}
      `),
      db.execute(sql`
        SELECT COUNT(*) as count 
        FROM consent_audit_log 
        WHERE created_at >= ${sevenDaysAgo}
      `),
    ]);

    const byType: Record<string, { granted: number; withdrawn: number }> = {};
    for (const row of byTypeResult.rows as any[]) {
      if (!byType[row.consent_type]) {
        byType[row.consent_type] = { granted: 0, withdrawn: 0 };
      }
      byType[row.consent_type][row.action as 'granted' | 'withdrawn'] = parseInt(row.count);
    }

    return {
      totalRecords: parseInt((totalResult.rows[0] as any)?.count || '0'),
      byType,
      last24Hours: parseInt((last24hResult.rows[0] as any)?.count || '0'),
      last7Days: parseInt((last7dResult.rows[0] as any)?.count || '0'),
    };
  }

  async exportForCompliance(
    startDate: Date,
    endDate: Date,
    userId?: number
  ): Promise<ConsentAuditLog[]> {
    const conditions = [
      gte(consentAuditLog.createdAt, startDate),
      lte(consentAuditLog.createdAt, endDate),
    ];

    if (userId) {
      conditions.push(eq(consentAuditLog.userId, userId));
    }

    return db.select()
      .from(consentAuditLog)
      .where(and(...conditions))
      .orderBy(consentAuditLog.createdAt);
  }
}

export const consentAuditService = new ConsentAuditService();
console.log("✅ Consent Audit Service initialized (DPDPA 2023 compliance)");
