/**
 * PMLA (Prevention of Money Laundering Act) Audit Service
 * 
 * Comprehensive audit logging for PMLA/FATCA/CRS compliance
 * 
 * Features:
 * - Suspicious Transaction Reporting (STR)
 * - Cash Transaction Reporting (CTR)
 * - Customer Due Diligence (CDD) Logging
 * - Enhanced Due Diligence (EDD) Logging
 * - 7-Year Retention Policy
 * - FIU-IND Reporting Integration
 * - Real-time Transaction Monitoring
 */

import { db } from '../db';
import { complianceAuditTrail, bondOrders, users } from '@shared/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ==================== TYPES ====================

export interface PMLAAuditEvent {
  eventId: string;
  eventType: PMLAEventType;
  eventCategory: PMLAEventCategory;
  userId: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  description: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flagged: boolean;
  reportedToFIU: boolean;
  fiuReportId?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  geoLocation?: GeoLocation;
  metadata: Record<string, any>;
  retentionExpiry: Date;
  checksum: string;
}

export type PMLAEventType = 
  | 'transaction'
  | 'kyc_update'
  | 'account_opening'
  | 'account_closure'
  | 'document_upload'
  | 'suspicious_activity'
  | 'large_cash_transaction'
  | 'cross_border_transfer'
  | 'pep_transaction'
  | 'sanctions_hit'
  | 'velocity_breach'
  | 'structuring_detected'
  | 'unusual_pattern';

export type PMLAEventCategory = 
  | 'aml'           // Anti-Money Laundering
  | 'cft'           // Counter-Financing of Terrorism
  | 'pep'           // Politically Exposed Persons
  | 'sanctions'     // Sanctions Screening
  | 'transaction_monitoring'
  | 'cdd'           // Customer Due Diligence
  | 'edd'           // Enhanced Due Diligence
  | 'str'           // Suspicious Transaction Report
  | 'ctr';          // Cash Transaction Report

export interface GeoLocation {
  country: string;
  countryCode: string;
  region?: string;
  city?: string;
  isHighRisk: boolean;
}

export interface FIUReport {
  reportId: string;
  reportType: 'STR' | 'CTR' | 'SAR';
  userId: string;
  transactionIds: string[];
  totalAmount: number;
  currency: string;
  suspicionIndicators: string[];
  riskScore: number;
  submittedAt?: Date;
  status: 'pending' | 'submitted' | 'acknowledged' | 'rejected';
  fiuReferenceNumber?: string;
}

export interface TransactionPattern {
  patternType: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  affectedTransactions: string[];
  detectedAt: Date;
}

// ==================== CONSTANTS ====================

const PMLA_THRESHOLDS = {
  CTR_THRESHOLD_INR: 1000000,        // 10 Lakhs - Cash Transaction Report
  STR_THRESHOLD_INR: 500000,          // 5 Lakhs - Suspicious Transaction threshold
  HIGH_VALUE_THRESHOLD_INR: 5000000,  // 50 Lakhs - High Value Transaction
  CROSS_BORDER_THRESHOLD_INR: 250000, // 2.5 Lakhs - Cross-border threshold
  VELOCITY_LIMIT_24H: 10,             // Max transactions in 24 hours
  VELOCITY_AMOUNT_24H: 2500000,       // Max amount in 24 hours (25 Lakhs)
  STRUCTURING_AMOUNT: 900000,         // Near CTR threshold (structuring detection)
  RETENTION_YEARS: 7                  // PMLA retention period
};

const HIGH_RISK_COUNTRIES = [
  'AF', 'IR', 'KP', 'SY', 'YE', 'IQ', 'LY', 'SO', 'SD', 'VE',
  'MM', 'PK', 'NI', 'PA', 'HT', 'UG', 'ZW', 'ML', 'SS', 'CF'
];

// ==================== PMLA AUDIT SERVICE ====================

class PMLAAuditService {
  
  /**
   * Log a PMLA audit event
   */
  async logAuditEvent(event: Omit<PMLAAuditEvent, 'eventId' | 'checksum' | 'retentionExpiry'>): Promise<string> {
    const eventId = `PMLA-${Date.now()}-${nanoid(8)}`;
    const retentionExpiry = new Date();
    retentionExpiry.setFullYear(retentionExpiry.getFullYear() + PMLA_THRESHOLDS.RETENTION_YEARS);

    // Generate checksum for data integrity
    const eventData = {
      ...event,
      eventId,
      retentionExpiry: retentionExpiry.toISOString()
    };
    const checksum = await this.generateChecksum(JSON.stringify(eventData));

    try {
      await db.insert(complianceAuditTrail).values({
        userId: event.userId,
        action: event.eventType,
        fieldChanged: event.eventCategory,
        newValue: JSON.stringify({
          ...eventData,
          checksum
        }),
        reason: event.description,
        performedBy: 'pmla_system',
        performedByRole: 'compliance_system',
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        riskImpact: event.riskLevel,
        complianceImpact: event.flagged ? 'major' : 'none',
        metadata: {
          ...event.metadata,
          eventId,
          transactionId: event.transactionId,
          amount: event.amount,
          currency: event.currency,
          riskScore: event.riskScore,
          reportedToFIU: event.reportedToFIU,
          fiuReportId: event.fiuReportId,
          geoLocation: event.geoLocation,
          retentionExpiry: retentionExpiry.toISOString(),
          checksum
        }
      });

      console.log(`[PMLA Audit] Event ${eventId} logged for user ${event.userId}`);
      return eventId;
    } catch (error: any) {
      console.error('[PMLA Audit] Failed to log event:', error);
      throw new Error(`PMLA audit logging failed: ${error.message}`);
    }
  }

  /**
   * Monitor a transaction for PMLA compliance
   */
  async monitorTransaction(params: {
    userId: string;
    transactionId: string;
    amount: number;
    currency: string;
    transactionType: string;
    sourceCountry?: string;
    destinationCountry?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    allowed: boolean;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flags: string[];
    requiresFIUReport: boolean;
    reportType?: 'STR' | 'CTR';
    eventId: string;
  }> {
    let riskScore = 0;
    const flags: string[] = [];
    let reportType: 'STR' | 'CTR' | undefined;

    // 1. Check Cash Transaction Report threshold
    if (params.currency === 'INR' && params.amount >= PMLA_THRESHOLDS.CTR_THRESHOLD_INR) {
      riskScore += 30;
      flags.push('CTR threshold exceeded');
      reportType = 'CTR';
    }

    // 2. Check for structuring (transactions just below threshold)
    if (params.currency === 'INR' && 
        params.amount >= PMLA_THRESHOLDS.STRUCTURING_AMOUNT && 
        params.amount < PMLA_THRESHOLDS.CTR_THRESHOLD_INR) {
      const recentSimilar = await this.checkStructuringPattern(params.userId, params.amount);
      if (recentSimilar) {
        riskScore += 40;
        flags.push('Potential structuring detected');
        reportType = 'STR';
      }
    }

    // 3. Check velocity limits
    const velocityCheck = await this.checkVelocity(params.userId);
    if (velocityCheck.exceeded) {
      riskScore += 25;
      flags.push(`Velocity breach: ${velocityCheck.details}`);
    }

    // 4. Check high-risk country
    const countries = [params.sourceCountry, params.destinationCountry].filter(Boolean) as string[];
    for (const country of countries) {
      if (HIGH_RISK_COUNTRIES.includes(country)) {
        riskScore += 35;
        flags.push(`High-risk country: ${country}`);
        reportType = 'STR';
      }
    }

    // 5. Check cross-border threshold
    if (params.sourceCountry !== 'IN' || params.destinationCountry !== 'IN') {
      if (params.amount >= PMLA_THRESHOLDS.CROSS_BORDER_THRESHOLD_INR) {
        riskScore += 15;
        flags.push('Cross-border transaction above threshold');
      }
    }

    // 6. Check for high value transaction
    if (params.amount >= PMLA_THRESHOLDS.HIGH_VALUE_THRESHOLD_INR) {
      riskScore += 20;
      flags.push('High value transaction');
    }

    // 7. Get user PEP status
    const [user] = await db.select().from(users).where(eq(users.id, params.userId));
    if (user?.pepStatus === 'yes' || user?.pepStatus === 'related') {
      riskScore += 30;
      flags.push(`PEP status: ${user.pepStatus}`);
    }

    // Determine risk level
    const riskLevel = this.calculateRiskLevel(riskScore);
    const requiresFIUReport = riskScore >= 50 || !!reportType;
    const flagged = riskScore >= 40;

    // Determine if transaction should be blocked
    const allowed = riskScore < 80;

    // Log the audit event
    const eventId = await this.logAuditEvent({
      eventType: 'transaction',
      eventCategory: 'transaction_monitoring',
      userId: params.userId,
      transactionId: params.transactionId,
      amount: params.amount,
      currency: params.currency,
      description: `${params.transactionType} transaction of ${params.currency} ${params.amount.toLocaleString()}`,
      riskScore,
      riskLevel,
      flagged,
      reportedToFIU: requiresFIUReport,
      timestamp: new Date(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geoLocation: params.sourceCountry ? {
        country: params.sourceCountry,
        countryCode: params.sourceCountry,
        isHighRisk: HIGH_RISK_COUNTRIES.includes(params.sourceCountry)
      } : undefined,
      metadata: {
        ...params.metadata,
        flags,
        reportType
      }
    });

    return {
      allowed,
      riskScore,
      riskLevel,
      flags,
      requiresFIUReport,
      reportType,
      eventId
    };
  }

  /**
   * Check for structuring pattern
   */
  private async checkStructuringPattern(userId: string, currentAmount: number): Promise<boolean> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7); // Check last 7 days

    const recentOrders = await db.select()
      .from(bondOrders)
      .where(
        and(
          eq(bondOrders.userId, userId),
          gte(bondOrders.orderDate, cutoff)
        )
      );

    // Check for multiple transactions near threshold
    const nearThresholdTxns = recentOrders.filter(o => {
      const amount = parseFloat(o.netAmount || '0');
      return amount >= PMLA_THRESHOLDS.STRUCTURING_AMOUNT && 
             amount < PMLA_THRESHOLDS.CTR_THRESHOLD_INR;
    });

    // Total of near-threshold transactions
    const totalNearThreshold = nearThresholdTxns.reduce((sum, o) => 
      sum + parseFloat(o.netAmount || '0'), 0
    ) + currentAmount;

    // If combined amount exceeds threshold and there are multiple transactions
    return nearThresholdTxns.length >= 2 && totalNearThreshold >= PMLA_THRESHOLDS.CTR_THRESHOLD_INR;
  }

  /**
   * Check velocity limits
   */
  private async checkVelocity(userId: string): Promise<{ exceeded: boolean; details: string }> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    const recentOrders = await db.select()
      .from(bondOrders)
      .where(
        and(
          eq(bondOrders.userId, userId),
          gte(bondOrders.orderDate, cutoff)
        )
      );

    const txnCount = recentOrders.length;
    const totalAmount = recentOrders.reduce((sum, o) => 
      sum + parseFloat(o.netAmount || '0'), 0
    );

    if (txnCount >= PMLA_THRESHOLDS.VELOCITY_LIMIT_24H) {
      return { exceeded: true, details: `${txnCount} transactions in 24h (limit: ${PMLA_THRESHOLDS.VELOCITY_LIMIT_24H})` };
    }

    if (totalAmount >= PMLA_THRESHOLDS.VELOCITY_AMOUNT_24H) {
      return { exceeded: true, details: `INR ${totalAmount.toLocaleString()} in 24h (limit: ${PMLA_THRESHOLDS.VELOCITY_AMOUNT_24H.toLocaleString()})` };
    }

    return { exceeded: false, details: 'Within limits' };
  }

  /**
   * Log Customer Due Diligence (CDD) event
   */
  async logCDDEvent(params: {
    userId: string;
    cddType: 'initial' | 'periodic' | 'event_triggered';
    outcome: 'passed' | 'failed' | 'pending_review';
    riskCategory: 'low' | 'medium' | 'high';
    findings: string[];
    nextReviewDate: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    return this.logAuditEvent({
      eventType: 'kyc_update',
      eventCategory: 'cdd',
      userId: params.userId,
      description: `${params.cddType} CDD: ${params.outcome}`,
      riskScore: params.riskCategory === 'high' ? 70 : params.riskCategory === 'medium' ? 40 : 10,
      riskLevel: params.riskCategory,
      flagged: params.outcome === 'failed' || params.riskCategory === 'high',
      reportedToFIU: false,
      timestamp: new Date(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        cddType: params.cddType,
        outcome: params.outcome,
        findings: params.findings,
        nextReviewDate: params.nextReviewDate.toISOString()
      }
    });
  }

  /**
   * Log Enhanced Due Diligence (EDD) event
   */
  async logEDDEvent(params: {
    userId: string;
    eddReason: 'pep' | 'high_risk_country' | 'suspicious_activity' | 'high_value' | 'regulatory';
    measures: string[];
    outcome: 'approved' | 'rejected' | 'ongoing';
    reviewedBy: string;
    findings: string[];
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    return this.logAuditEvent({
      eventType: 'suspicious_activity',
      eventCategory: 'edd',
      userId: params.userId,
      description: `EDD for ${params.eddReason}: ${params.outcome}`,
      riskScore: params.outcome === 'rejected' ? 90 : params.outcome === 'ongoing' ? 60 : 30,
      riskLevel: params.outcome === 'rejected' ? 'critical' : params.outcome === 'ongoing' ? 'high' : 'medium',
      flagged: params.outcome !== 'approved',
      reportedToFIU: params.outcome === 'rejected',
      timestamp: new Date(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        eddReason: params.eddReason,
        measures: params.measures,
        outcome: params.outcome,
        reviewedBy: params.reviewedBy,
        findings: params.findings
      }
    });
  }

  /**
   * Generate FIU-IND report
   */
  async generateFIUReport(params: {
    userId: string;
    reportType: 'STR' | 'CTR' | 'SAR';
    transactionIds: string[];
    suspicionIndicators: string[];
  }): Promise<FIUReport> {
    const reportId = `FIU-${params.reportType}-${Date.now()}-${nanoid(6)}`;

    // Get transactions
    const transactions = await db.select()
      .from(bondOrders)
      .where(sql`${bondOrders.orderNumber} IN ${params.transactionIds}`);

    const totalAmount = transactions.reduce((sum, t) => 
      sum + parseFloat(t.netAmount || '0'), 0
    );

    const riskScore = params.suspicionIndicators.length * 15 + 
      (params.reportType === 'STR' ? 30 : 0);

    const report: FIUReport = {
      reportId,
      reportType: params.reportType,
      userId: params.userId,
      transactionIds: params.transactionIds,
      totalAmount,
      currency: 'INR',
      suspicionIndicators: params.suspicionIndicators,
      riskScore: Math.min(riskScore, 100),
      status: 'pending'
    };

    // Log the report generation
    await this.logAuditEvent({
      eventType: params.reportType === 'STR' ? 'suspicious_activity' : 'large_cash_transaction',
      eventCategory: params.reportType === 'STR' ? 'str' : 'ctr',
      userId: params.userId,
      description: `${params.reportType} report generated: ${reportId}`,
      riskScore: report.riskScore,
      riskLevel: this.calculateRiskLevel(report.riskScore),
      flagged: true,
      reportedToFIU: true,
      fiuReportId: reportId,
      timestamp: new Date(),
      metadata: report
    });

    console.log(`[PMLA Audit] FIU Report ${reportId} generated for user ${params.userId}`);
    return report;
  }

  /**
   * Get audit history for a user
   */
  async getAuditHistory(userId: string, options?: {
    startDate?: Date;
    endDate?: Date;
    eventType?: PMLAEventType;
    limit?: number;
  }): Promise<PMLAAuditEvent[]> {
    let query = db.select()
      .from(complianceAuditTrail)
      .where(eq(complianceAuditTrail.userId, userId))
      .orderBy(desc(complianceAuditTrail.createdAt));

    const results = await query;

    return results.map(r => {
      const parsed = r.newValue ? JSON.parse(r.newValue) : {};
      const metadata = r.metadata as Record<string, any> || {};
      return {
        eventId: metadata.eventId || r.id,
        eventType: r.action as PMLAEventType,
        eventCategory: r.fieldChanged as PMLAEventCategory,
        userId: r.userId,
        transactionId: metadata.transactionId,
        amount: metadata.amount,
        currency: metadata.currency,
        description: r.reason || parsed.description || '',
        riskScore: metadata.riskScore || 0,
        riskLevel: (r.riskImpact || 'low') as 'low' | 'medium' | 'high' | 'critical',
        flagged: r.complianceImpact === 'major' || r.complianceImpact === 'critical',
        reportedToFIU: metadata.reportedToFIU || false,
        fiuReportId: metadata.fiuReportId,
        timestamp: r.createdAt || new Date(),
        ipAddress: r.ipAddress || undefined,
        userAgent: r.userAgent || undefined,
        geoLocation: metadata.geoLocation,
        metadata: metadata,
        retentionExpiry: new Date(metadata.retentionExpiry || Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
        checksum: metadata.checksum || ''
      };
    });
  }

  /**
   * Calculate risk level from score
   */
  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
  }

  /**
   * Generate SHA-256 checksum for data integrity
   */
  private async generateChecksum(data: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get PMLA thresholds
   */
  getThresholds(): typeof PMLA_THRESHOLDS {
    return PMLA_THRESHOLDS;
  }

  /**
   * Get high-risk countries list
   */
  getHighRiskCountries(): string[] {
    return HIGH_RISK_COUNTRIES;
  }
}

export const pmlaAuditService = new PMLAAuditService();
