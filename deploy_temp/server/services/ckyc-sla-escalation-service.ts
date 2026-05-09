/**
 * CKYC SLA Escalation Service
 * 
 * Handles automatic SLA breach detection and escalation to Compliance Head.
 * Runs as a scheduled cron job and sends email notifications.
 * 
 * SEBI Compliance: All SLA breaches must be documented and escalated.
 */

import cron from 'node-cron';
import { db } from '../db';
import { 
  ckycDeferredCases, 
  ckycEscalationHistory, 
  ckycAuditLog,
  users,
  type CkycDeferredCase,
  type InsertCkycEscalationHistory,
  type InsertCkycAuditLog 
} from '@shared/schema';
import { eq, and, lt, isNull, or, not, sql } from 'drizzle-orm';
import { emailService } from '../email-service';
import crypto from 'crypto';

interface EscalationConfig {
  level: number;
  hoursOverdue: number;
  recipientRole: string;
  recipientEmail: string;
  escalationTitle: string;
}

const ESCALATION_CHAIN: EscalationConfig[] = [
  {
    level: 1,
    hoursOverdue: 0,  // At SLA breach (72 hours)
    recipientRole: 'compliance_head',
    recipientEmail: process.env.COMPLIANCE_HEAD_EMAIL || 'compliance@fintekpro.com',
    escalationTitle: 'CKYC SLA Breach - Immediate Attention Required'
  },
  {
    level: 2,
    hoursOverdue: 24,  // 24 hours after initial breach
    recipientRole: 'compliance_manager',
    recipientEmail: process.env.COMPLIANCE_MANAGER_EMAIL || 'compliance-manager@fintekpro.com',
    escalationTitle: 'CKYC SLA Breach - Second Escalation'
  },
  {
    level: 3,
    hoursOverdue: 48,  // 48 hours after initial breach
    recipientRole: 'management',
    recipientEmail: process.env.MANAGEMENT_EMAIL || 'management@fintekpro.com',
    escalationTitle: 'CKYC SLA Breach - Critical Escalation to Management'
  }
];

class CkycSlaEscalationService {
  private static instance: CkycSlaEscalationService;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning: boolean = false;

  private constructor() {}

  static getInstance(): CkycSlaEscalationService {
    if (!CkycSlaEscalationService.instance) {
      CkycSlaEscalationService.instance = new CkycSlaEscalationService();
    }
    return CkycSlaEscalationService.instance;
  }

  /**
   * Initialize the SLA breach detection cron job
   * Runs every hour to check for breached cases
   */
  initialize(): void {
    // Run every hour at minute 0
    this.cronJob = cron.schedule('0 * * * *', async () => {
      await this.checkAndEscalateBreaches();
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    console.log('✅ CKYC SLA Escalation Service initialized (runs hourly)');
    
    // Also run immediately on startup to catch any breaches
    this.checkAndEscalateBreaches().catch(console.error);
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('🛑 CKYC SLA Escalation Service stopped');
    }
  }

  /**
   * Main breach detection and escalation logic
   */
  async checkAndEscalateBreaches(): Promise<void> {
    if (this.isRunning) {
      console.log('[CKYC SLA] Escalation check already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    const now = new Date();
    
    console.log(`[CKYC SLA] Checking for SLA breaches at ${now.toISOString()}...`);

    try {
      // Find all active deferred cases
      const activeCases = await db.select()
        .from(ckycDeferredCases)
        .where(
          and(
            or(
              eq(ckycDeferredCases.status, 'ckyc_deferred'),
              eq(ckycDeferredCases.status, 'manual_review_in_progress')
            ),
            // Not already fully escalated
            not(eq(ckycDeferredCases.escalationLevel, 3))
          )
        );

      let breachedCount = 0;
      let escalatedCount = 0;

      for (const caseRecord of activeCases) {
        const isBreached = now > new Date(caseRecord.slaDeadline);
        
        if (isBreached) {
          breachedCount++;
          
          // Mark as breached if not already
          if (!caseRecord.slaBreach) {
            await this.markCaseAsBreached(caseRecord);
          }
          
          // Calculate hours overdue
          const hoursOverdue = Math.floor(
            (now.getTime() - new Date(caseRecord.slaDeadline).getTime()) / (1000 * 60 * 60)
          );
          
          // Determine appropriate escalation level
          const targetLevel = this.determineEscalationLevel(hoursOverdue);
          
          // Escalate if needed
          if (targetLevel > (caseRecord.escalationLevel || 0)) {
            await this.escalateCase(caseRecord, targetLevel, hoursOverdue);
            escalatedCount++;
          }
        }
      }

      console.log(`[CKYC SLA] Check complete: ${breachedCount} breached, ${escalatedCount} escalated`);
    } catch (error) {
      console.error('[CKYC SLA] Error during breach check:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Determine the appropriate escalation level based on hours overdue
   */
  private determineEscalationLevel(hoursOverdue: number): number {
    for (let i = ESCALATION_CHAIN.length - 1; i >= 0; i--) {
      if (hoursOverdue >= ESCALATION_CHAIN[i].hoursOverdue) {
        return ESCALATION_CHAIN[i].level;
      }
    }
    return 1; // Default to level 1
  }

  /**
   * Mark a case as SLA breached
   */
  private async markCaseAsBreached(caseRecord: CkycDeferredCase): Promise<void> {
    await db.update(ckycDeferredCases)
      .set({
        slaBreach: true,
        slaBreachedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(ckycDeferredCases.id, caseRecord.id));

    // Log to audit
    await this.logAuditEvent({
      caseId: caseRecord.id,
      userId: caseRecord.userId,
      panNumber: caseRecord.panNumber,
      eventType: 'sla_breach',
      eventSubtype: 'deadline_exceeded',
      previousState: caseRecord.status,
      newState: caseRecord.status,
      eventData: {
        slaDeadline: caseRecord.slaDeadline,
        slaStartedAt: caseRecord.slaStartedAt,
        hoursOverdue: Math.floor(
          (Date.now() - new Date(caseRecord.slaDeadline).getTime()) / (1000 * 60 * 60)
        )
      },
      actorRole: 'system',
      actorName: 'CKYC SLA Monitor',
      isComplianceEvent: true,
      isSLARelated: true
    });

    console.log(`[CKYC SLA] Case ${caseRecord.id} marked as SLA breached`);
  }

  /**
   * Escalate a case to the next level
   */
  private async escalateCase(
    caseRecord: CkycDeferredCase, 
    targetLevel: number,
    hoursOverdue: number
  ): Promise<void> {
    const escalationConfig = ESCALATION_CHAIN.find(e => e.level === targetLevel);
    if (!escalationConfig) return;

    const previousLevel = caseRecord.escalationLevel || 0;

    // Update case escalation status
    await db.update(ckycDeferredCases)
      .set({
        escalationLevel: targetLevel,
        escalatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(ckycDeferredCases.id, caseRecord.id));

    // Create escalation history record
    const [escalationRecord] = await db.insert(ckycEscalationHistory).values({
      caseId: caseRecord.id,
      escalationLevel: targetLevel,
      escalatedFrom: previousLevel,
      escalatedToEmail: escalationConfig.recipientEmail,
      escalatedToRole: escalationConfig.recipientRole,
      escalationTrigger: 'sla_breach',
      hoursOverdue,
      emailSent: false
    }).returning();

    // Send escalation email
    const emailSent = await this.sendEscalationEmail(caseRecord, escalationConfig, hoursOverdue);
    
    if (emailSent) {
      await db.update(ckycEscalationHistory)
        .set({
          emailSent: true,
          emailSentAt: new Date()
        })
        .where(eq(ckycEscalationHistory.id, escalationRecord.id));
    }

    // Log to audit
    await this.logAuditEvent({
      caseId: caseRecord.id,
      userId: caseRecord.userId,
      panNumber: caseRecord.panNumber,
      eventType: 'escalation',
      eventSubtype: `level_${targetLevel}`,
      previousState: `escalation_level_${previousLevel}`,
      newState: `escalation_level_${targetLevel}`,
      eventData: {
        escalationLevel: targetLevel,
        escalatedFrom: previousLevel,
        escalatedTo: escalationConfig.recipientEmail,
        escalatedToRole: escalationConfig.recipientRole,
        hoursOverdue,
        emailSent
      },
      actorRole: 'system',
      actorName: 'CKYC SLA Escalation Service',
      isComplianceEvent: true,
      isEscalation: true,
      isSLARelated: true
    });

    console.log(`[CKYC SLA] Case ${caseRecord.id} escalated to level ${targetLevel} (${escalationConfig.recipientRole})`);
  }

  /**
   * Send escalation notification email
   */
  private async sendEscalationEmail(
    caseRecord: CkycDeferredCase,
    escalationConfig: EscalationConfig,
    hoursOverdue: number
  ): Promise<boolean> {
    try {
      const maskedPan = caseRecord.panNumber.slice(0, 4) + '******';
      const slaDeadline = new Date(caseRecord.slaDeadline).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata'
      });

      const emailContent = `
        <h2>${escalationConfig.escalationTitle}</h2>
        
        <p>A CKYC verification case has exceeded its SLA deadline and requires immediate attention.</p>
        
        <h3>Case Details</h3>
        <table style="border-collapse: collapse; width: 100%;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Case ID</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${caseRecord.id}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>PAN</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${maskedPan}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Deferral Code</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${caseRecord.deferralCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>SLA Deadline</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${slaDeadline}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Hours Overdue</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd; color: red;">${hoursOverdue} hours</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Escalation Level</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escalationConfig.level}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;"><strong>Last Provider Attempted</strong></td>
            <td style="padding: 8px; border: 1px solid #ddd;">${caseRecord.lastProviderAttempted || 'N/A'}</td>
          </tr>
        </table>
        
        <h3>Required Action</h3>
        <p>Please log in to the Admin Portal and review this case immediately. Available actions:</p>
        <ul>
          <li>Initiate Manual CKYC</li>
          <li>Schedule Video KYC</li>
          <li>Assign to Compliance Team</li>
          <li>Reject Onboarding (with documented reason)</li>
        </ul>
        
        <p><a href="${process.env.ADMIN_PORTAL_URL || 'https://admin.fintekpro.com'}/ckyc-deferred/${caseRecord.id}" 
           style="display: inline-block; padding: 10px 20px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 5px;">
           Review Case Now
        </a></p>
        
        <hr>
        <p style="font-size: 12px; color: #666;">
          This is an automated compliance notification from FintekPro CKYC Monitoring System.
          SEBI requires all SLA breaches to be addressed within 24 hours of escalation.
        </p>
      `;

      await emailService.sendEmail({
        to: escalationConfig.recipientEmail,
        subject: `[URGENT] ${escalationConfig.escalationTitle} - Case ${caseRecord.id.slice(0, 8)}`,
        html: emailContent
      });

      console.log(`[CKYC SLA] Escalation email sent to ${escalationConfig.recipientEmail}`);
      return true;
    } catch (error) {
      console.error('[CKYC SLA] Failed to send escalation email:', error);
      return false;
    }
  }

  /**
   * Log event to audit trail with checksum
   */
  private async logAuditEvent(data: Omit<InsertCkycAuditLog, 'checksum' | 'eventTimestamp'>): Promise<void> {
    // Generate checksum for immutability verification
    const eventPayload = JSON.stringify({
      ...data,
      timestamp: new Date().toISOString()
    });
    const checksum = crypto.createHash('sha256').update(eventPayload).digest('hex');

    // Get previous log entry for chain reference
    let previousLogId: string | null = null;
    if (data.caseId) {
      const [lastLog] = await db.select({ id: ckycAuditLog.id })
        .from(ckycAuditLog)
        .where(eq(ckycAuditLog.caseId, data.caseId))
        .orderBy(sql`${ckycAuditLog.eventTimestamp} DESC`)
        .limit(1);
      previousLogId = lastLog?.id || null;
    }

    await db.insert(ckycAuditLog).values({
      ...data,
      checksum,
      previousLogId,
      eventTimestamp: new Date()
    });
  }

  /**
   * Manual trigger for testing/admin use
   */
  async triggerManualCheck(): Promise<{ breachedCount: number; escalatedCount: number }> {
    console.log('[CKYC SLA] Manual breach check triggered');
    
    const activeCases = await db.select()
      .from(ckycDeferredCases)
      .where(
        and(
          or(
            eq(ckycDeferredCases.status, 'ckyc_deferred'),
            eq(ckycDeferredCases.status, 'manual_review_in_progress')
          )
        )
      );

    let breachedCount = 0;
    let escalatedCount = 0;
    const now = new Date();

    for (const caseRecord of activeCases) {
      const isBreached = now > new Date(caseRecord.slaDeadline);
      
      if (isBreached) {
        breachedCount++;
        
        if (!caseRecord.slaBreach) {
          await this.markCaseAsBreached(caseRecord);
        }
        
        const hoursOverdue = Math.floor(
          (now.getTime() - new Date(caseRecord.slaDeadline).getTime()) / (1000 * 60 * 60)
        );
        
        const targetLevel = this.determineEscalationLevel(hoursOverdue);
        
        if (targetLevel > (caseRecord.escalationLevel || 0)) {
          await this.escalateCase(caseRecord, targetLevel, hoursOverdue);
          escalatedCount++;
        }
      }
    }

    return { breachedCount, escalatedCount };
  }
}

export const ckycSlaEscalationService = CkycSlaEscalationService.getInstance();
