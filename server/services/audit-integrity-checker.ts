// @ts-nocheck
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { auditLogService } from './audit-log-service';
import { emailService } from '../email-service';
import cron from 'node-cron';
import crypto from 'crypto';

export interface IntegrityCheckResult {
  id: string;
  timestamp: Date;
  status: 'passed' | 'failed' | 'warning';
  totalRecords: number;
  verifiedRecords: number;
  brokenLinks: string[];
  checksumMismatches: string[];
  missingRecords: string[];
  executionTimeMs: number;
  details: string;
}

export interface IntegrityStatus {
  lastCheck: IntegrityCheckResult | null;
  checksHistory: IntegrityCheckResult[];
  isScheduleRunning: boolean;
  scheduleIntervalMinutes: number;
  failureCount: number;
  lastFailureAt: Date | null;
}

class AuditIntegrityChecker {
  private cronJob: cron.ScheduledTask | null = null;
  private lastCheckResult: IntegrityCheckResult | null = null;
  private checksHistory: IntegrityCheckResult[] = [];
  private isRunning: boolean = false;
  private scheduleIntervalMinutes: number = 60;
  private failureCount: number = 0;
  private lastFailureAt: Date | null = null;
  private maxHistorySize: number = 100;

  async initialize(intervalMinutes: number = 60): Promise<void> {
    this.scheduleIntervalMinutes = intervalMinutes;
    console.log(`[AuditIntegrity] Initializing with ${intervalMinutes} minute interval`);
    
    const result = await this.runIntegrityCheck();
    if (result.status === 'failed') {
      console.error('[AuditIntegrity] CRITICAL: Initial integrity check failed!');
    }
    
    this.startScheduledChecks();
  }

  startScheduledChecks(): void {
    if (this.cronJob) {
      this.cronJob.stop();
    }

    const cronExpression = this.getCronExpression(this.scheduleIntervalMinutes);
    
    this.cronJob = cron.schedule(cronExpression, async () => {
      console.log('[AuditIntegrity] Running scheduled integrity check...');
      await this.runIntegrityCheck();
    });

    this.isRunning = true;
    console.log(`[AuditIntegrity] Scheduled checks started (every ${this.scheduleIntervalMinutes} minutes)`);
  }

  stopScheduledChecks(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('[AuditIntegrity] Scheduled checks stopped');
  }

  private getCronExpression(intervalMinutes: number): string {
    if (intervalMinutes === 60) {
      return '0 * * * *';
    } else if (intervalMinutes === 30) {
      return '*/30 * * * *';
    } else if (intervalMinutes === 15) {
      return '*/15 * * * *';
    } else if (intervalMinutes >= 60) {
      const hours = Math.floor(intervalMinutes / 60);
      return `0 */${hours} * * *`;
    } else {
      return `*/${intervalMinutes} * * * *`;
    }
  }

  async runIntegrityCheck(): Promise<IntegrityCheckResult> {
    const startTime = Date.now();
    const checkId = `check-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const result: IntegrityCheckResult = {
      id: checkId,
      timestamp: new Date(),
      status: 'passed',
      totalRecords: 0,
      verifiedRecords: 0,
      brokenLinks: [],
      checksumMismatches: [],
      missingRecords: [],
      executionTimeMs: 0,
      details: ''
    };

    try {
      console.log('[AuditIntegrity] Starting forensic chain verification...');
      const verification = await auditLogService.verifyChainIntegrity();
      
      result.totalRecords = verification.totalVerified;
      result.verifiedRecords = verification.totalVerified;
      
      if (!verification.valid) {
        result.status = 'failed';
        // Categorize errors into brokenLinks and checksumMismatches based on the message
        verification.brokenLinks.forEach(link => {
          if (link.includes('HASH_MISMATCH')) {
            result.checksumMismatches.push(link);
          } else {
            result.brokenLinks.push(link);
          }
        });
        
        result.details = `Forensic integrity violations detected: ${result.brokenLinks.length} chain breaks, ${result.checksumMismatches.length} content hash mismatches`;
        await this.handleIntegrityFailure(result);
      } else {
        result.details = `All ${result.verifiedRecords} audit records verified against HMAC-SHA256 chain.`;
        this.failureCount = 0;
      }

    } catch (error: any) {
      result.status = 'failed';
      result.details = `Error during forensic integrity check: ${error.message}`;
      console.error('[AuditIntegrity] Check failed with error:', error);
    }

    result.executionTimeMs = Date.now() - startTime;
    this.storeResult(result);

    await auditLogService.log('INTEGRITY_CHECK', result.status.toUpperCase(), {
      entityType: 'audit_log',
      entityId: checkId,
      metadata: {
        totalRecords: result.totalRecords.toString(),
        verifiedRecords: result.verifiedRecords.toString(),
        brokenLinks: result.brokenLinks.length.toString(),
        checksumMismatches: result.checksumMismatches.length.toString(),
        forensicType: 'HMAC-SHA256'
      }
    });

    return result;
  }

  /**
   * Specifically verifies the integrity of Regulatory Audit Packs.
   * Compares stored hash with recalculated hash of the snapshot payload.
   */
  async verifyRegulatoryPacks(): Promise<IntegrityCheckResult> {
    const startTime = Date.now();
    const checkId = `reg-check-${Date.now()}`;
    const result: IntegrityCheckResult = {
      id: checkId,
      timestamp: new Date(),
      status: 'passed',
      totalRecords: 0,
      verifiedRecords: 0,
      brokenLinks: [],
      checksumMismatches: [],
      missingRecords: [],
      executionTimeMs: 0,
      details: ''
    };

    try {
      const packs = await db.execute(sql`
        SELECT id, user_id, pack_type, transaction_id, kyc_snapshot, 
               suitability_snapshot, order_snapshot, platform_config_snapshot, audit_hash
        FROM regulatory_audit_packs
        ORDER BY created_at DESC
      `);
      
      const rows = packs.rows || [];
      result.totalRecords = rows.length;

      for (const row of rows) {
        // Recalculate hash (Must match the logic in ComplianceAuditPackService)
        const payloadString = JSON.stringify({
          userId: row.user_id,
          packType: row.pack_type,
          kycSnapshot: row.kyc_snapshot,
          suitabilitySnapshot: row.suitability_snapshot,
          orderSnapshot: row.order_snapshot,
          configSnapshot: row.platform_config_snapshot
        });
        
        const expectedHash = crypto
          .createHash("sha256")
          .update(payloadString)
          .digest("hex");

        if (expectedHash !== row.audit_hash) {
          result.checksumMismatches.push(row.id.toString());
          result.status = 'failed';
        } else {
          result.verifiedRecords++;
        }
      }

      if (result.status === 'failed') {
        result.details = `Tamper detection in regulatory packs: ${result.checksumMismatches.length} mismatches found.`;
        await this.handleIntegrityFailure(result);
      } else {
        result.details = `All ${result.verifiedRecords} regulatory audit packs verified successfully.`;
      }

    } catch (error: any) {
      result.status = 'failed';
      result.details = `Regulatory integrity check error: ${error.message}`;
    }

    result.executionTimeMs = Date.now() - startTime;
    this.storeResult(result);
    return result;
  }


  private storeResult(result: IntegrityCheckResult): void {
    this.lastCheckResult = result;
    this.checksHistory.unshift(result);
    
    if (this.checksHistory.length > this.maxHistorySize) {
      this.checksHistory = this.checksHistory.slice(0, this.maxHistorySize);
    }
  }

  private async handleIntegrityFailure(result: IntegrityCheckResult): Promise<void> {
    this.failureCount++;
    this.lastFailureAt = new Date();

    console.error('[CRITICAL] [AuditIntegrity] AUDIT TRAIL INTEGRITY FAILURE DETECTED!');
    console.error('[CRITICAL] [AuditIntegrity] Broken links:', result.brokenLinks);
    console.error('[CRITICAL] [AuditIntegrity] Checksum mismatches:', result.checksumMismatches);
    console.error('[CRITICAL] [AuditIntegrity] This may indicate tampering or data corruption!');

    await this.storeFailedVerification(result);

    await this.sendAdminAlert(result);
  }

  private async storeFailedVerification(result: IntegrityCheckResult): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO audit_integrity_failures (
          id, 
          timestamp, 
          broken_links, 
          checksum_mismatches,
          total_records,
          details,
          status
        ) VALUES (
          ${result.id},
          ${result.timestamp.toISOString()},
          ${JSON.stringify(result.brokenLinks)},
          ${JSON.stringify(result.checksumMismatches)},
          ${result.totalRecords},
          ${result.details},
          ${result.status}
        )
      `);
      console.log('[AuditIntegrity] Failed verification result stored for admin review');
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        console.warn('[AuditIntegrity] audit_integrity_failures table does not exist - creating...');
        await this.createFailuresTable();
        await this.storeFailedVerification(result);
      } else {
        console.error('[AuditIntegrity] Failed to store verification result:', error);
      }
    }
  }

  private async createFailuresTable(): Promise<void> {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS audit_integrity_failures (
          id VARCHAR(100) PRIMARY KEY,
          timestamp TIMESTAMPTZ NOT NULL,
          broken_links JSONB,
          checksum_mismatches JSONB,
          total_records INTEGER,
          details TEXT,
          status VARCHAR(20),
          reviewed BOOLEAN DEFAULT FALSE,
          reviewed_at TIMESTAMPTZ,
          reviewed_by VARCHAR(100),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      console.log('[AuditIntegrity] Created audit_integrity_failures table');
    } catch (error: any) {
      console.error('[AuditIntegrity] Failed to create failures table:', error);
    }
  }

  private async sendAdminAlert(result: IntegrityCheckResult): Promise<void> {
    try {
      const admins = await db.execute(sql`
        SELECT email, name FROM users 
        WHERE 'admin' = ANY(roles) OR 'superadmin' = ANY(roles)
        LIMIT 10
      `);

      const adminEmails = (admins.rows || []).map((a: any) => a.email).filter(Boolean);
      
      if (adminEmails.length === 0) {
        console.warn('[AuditIntegrity] No admin emails found for alert notification');
        return;
      }

      const subject = '🚨 CRITICAL: Audit Trail Integrity Failure Detected';
      const html = `
        <h1 style="color: #dc2626;">Audit Trail Integrity Failure</h1>
        <p><strong>This is a critical security alert.</strong></p>
        
        <h2>Summary</h2>
        <ul>
          <li><strong>Check ID:</strong> ${result.id}</li>
          <li><strong>Timestamp:</strong> ${result.timestamp.toISOString()}</li>
          <li><strong>Total Records:</strong> ${result.totalRecords}</li>
          <li><strong>Verified Records:</strong> ${result.verifiedRecords}</li>
          <li><strong>Broken Links:</strong> ${result.brokenLinks.length}</li>
          <li><strong>Checksum Mismatches:</strong> ${result.checksumMismatches.length}</li>
        </ul>
        
        <h2>Affected Records</h2>
        <h3>Broken Links (Chain Violations)</h3>
        <pre>${result.brokenLinks.length > 0 ? result.brokenLinks.join('\n') : 'None'}</pre>
        
        <h3>Checksum Mismatches (Data Tampering)</h3>
        <pre>${result.checksumMismatches.length > 0 ? result.checksumMismatches.join('\n') : 'None'}</pre>
        
        <h2>Recommended Actions</h2>
        <ol>
          <li>Immediately investigate the affected records</li>
          <li>Check for unauthorized database access</li>
          <li>Review system access logs</li>
          <li>Consider notifying relevant stakeholders (SEBI/RBI compliance)</li>
        </ol>
        
        <p style="color: #666; font-size: 12px;">
          This alert was generated automatically by the FintekPro Audit Integrity Checker.
        </p>
      `;

      for (const email of adminEmails) {
        try {
          await emailService.sendEmail({
            to: email,
            subject,
            html,
            text: `CRITICAL: Audit Trail Integrity Failure\n\nCheck ID: ${result.id}\nBroken Links: ${result.brokenLinks.length}\nChecksum Mismatches: ${result.checksumMismatches.length}\n\nImmediate investigation required.`
          });
          console.log(`[AuditIntegrity] Alert sent to ${email}`);
        } catch (emailError: any) {
          console.error(`[AuditIntegrity] Failed to send alert to ${email}:`, emailError.message);
        }
      }
    } catch (error: any) {
      console.error('[AuditIntegrity] Failed to send admin alerts:', error);
    }
  }

  getStatus(): IntegrityStatus {
    return {
      lastCheck: this.lastCheckResult,
      checksHistory: this.checksHistory.slice(0, 20),
      isScheduleRunning: this.isRunning,
      scheduleIntervalMinutes: this.scheduleIntervalMinutes,
      failureCount: this.failureCount,
      lastFailureAt: this.lastFailureAt
    };
  }

  async getFailedVerifications(limit: number = 50): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM audit_integrity_failures
        ORDER BY timestamp DESC
        LIMIT ${limit}
      `);
      return result.rows || [];
    } catch (error: any) {
      if (error.message?.includes('does not exist')) {
        return [];
      }
      console.error('[AuditIntegrity] Failed to get failed verifications:', error);
      return [];
    }
  }

  async markVerificationReviewed(failureId: string, reviewedBy: string): Promise<boolean> {
    try {
      await db.execute(sql`
        UPDATE audit_integrity_failures
        SET reviewed = true, reviewed_at = NOW(), reviewed_by = ${reviewedBy}
        WHERE id = ${failureId}
      `);
      return true;
    } catch (error: any) {
      console.error('[AuditIntegrity] Failed to mark verification as reviewed:', error);
      return false;
    }
  }

  setScheduleInterval(minutes: number): void {
    this.scheduleIntervalMinutes = minutes;
    if (this.isRunning) {
      this.stopScheduledChecks();
      this.startScheduledChecks();
    }
  }
}

export const auditIntegrityChecker = new AuditIntegrityChecker();
