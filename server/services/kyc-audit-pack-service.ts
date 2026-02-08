import { db } from '../db';
import { kycAuditPacks, kycAuditLogs, kycVerificationSessions, userProfiles, kycRejectionEvents, kycVideoSessions, kycApprovals } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { kycEncryptionService } from './kyc-encryption-service';

interface AuditPackSection {
  title: string;
  content: Record<string, any>;
  hash: string;
}

class KycAuditPackService {
  constructor() {
    console.log('✅ KYC Audit Pack Generator initialized (SEBI/RBI compliant)');
  }

  async generatePack(userId: string, generatedBy: string, generatedByRole: string, sessionId?: string): Promise<{
    success: boolean;
    packId?: string;
    sections?: string[];
    checksum?: string;
    error?: string;
  }> {
    try {
      const [profile] = await db.select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

      if (!profile) {
        return { success: false, error: 'User profile not found' };
      }

      const sessions = sessionId
        ? await db.select().from(kycVerificationSessions).where(eq(kycVerificationSessions.id, sessionId)).limit(1)
        : await db.select().from(kycVerificationSessions).where(eq(kycVerificationSessions.userId, userId)).orderBy(desc(kycVerificationSessions.createdAt)).limit(1);

      const auditLogs = await db.select()
        .from(kycAuditLogs)
        .where(eq(kycAuditLogs.userId, userId))
        .orderBy(desc(kycAuditLogs.createdAt))
        .limit(100);

      const rejections = await db.select()
        .from(kycRejectionEvents)
        .where(eq(kycRejectionEvents.userId, userId));

      const videoSessions = await db.select()
        .from(kycVideoSessions)
        .where(eq(kycVideoSessions.userId, userId));

      const approvals = await db.select()
        .from(kycApprovals)
        .where(eq(kycApprovals.userId, userId));

      const sections: AuditPackSection[] = [];
      const sectionNames: string[] = [];

      const panSection = {
        title: 'PAN Verification Proof',
        content: {
          panStatus: (profile as any).panVerified ? 'VERIFIED' : 'NOT_VERIFIED',
          panVerifiedAt: (profile as any).panVerifiedAt,
          entityType: (profile as any).entityType,
          entityTypeLocked: (profile as any).entityTypeLocked,
          panToken: (profile as any).panNumber ? kycEncryptionService.tokenizePAN((profile as any).panNumber) : null,
        },
        hash: kycEncryptionService.hashForAudit(JSON.stringify({ pan: (profile as any).panVerified, entity: (profile as any).entityType })),
      };
      sections.push(panSection);
      sectionNames.push('PAN_PROOF');

      if (sessions.length > 0) {
        const session = sessions[0];
        const ckycSection = {
          title: 'CKYC/KRA Payload Hash',
          content: {
            ckycConfidenceScore: session.ckycConfidenceScore,
            ckycMissingFields: session.ckycMissingFields,
            aadhaarRequired: session.aadhaarRequired,
            sessionCreated: session.createdAt,
          },
          hash: kycEncryptionService.hashForAudit(JSON.stringify({ ckyc: session.ckycConfidenceScore, missing: session.ckycMissingFields })),
        };
        sections.push(ckycSection);
        sectionNames.push('CKYC_HASH');

        const aadhaarSection = {
          title: 'Aadhaar Consent Log',
          content: {
            aadhaarOtpSent: session.aadhaarOtpSent,
            aadhaarOtpVerified: session.aadhaarOtpVerified,
            aadhaarVerifiedAt: session.aadhaarVerifiedAt,
            aadhaarMasked: session.aadhaarNumber ? `XXXX-XXXX-${session.aadhaarNumber.slice(-4)}` : null,
          },
          hash: kycEncryptionService.hashForAudit(JSON.stringify({ aadhaar: session.aadhaarOtpVerified })),
        };
        sections.push(aadhaarSection);
        sectionNames.push('AADHAAR_CONSENT');

        const amlSection = {
          title: 'AML Score Snapshot',
          content: {
            amlRiskLevel: session.amlRiskLevel,
            amlScreeningId: session.amlScreeningId,
            videoKycRequired: session.videoKycRequired,
            entityType: session.entityType,
          },
          hash: kycEncryptionService.hashForAudit(JSON.stringify({ aml: session.amlRiskLevel, screening: session.amlScreeningId })),
        };
        sections.push(amlSection);
        sectionNames.push('AML_SNAPSHOT');
      }

      const signatureSection = {
        title: 'Signature Evidence',
        content: {
          fatcaStatus: (profile as any).fatcaStatus,
          kycLevel: (profile as any).kycLevel,
          kycTier: (profile as any).kycTier,
          kycTierStatus: (profile as any).kycTierStatus,
        },
        hash: kycEncryptionService.hashForAudit(JSON.stringify({ fatca: (profile as any).fatcaStatus, tier: (profile as any).kycTier })),
      };
      sections.push(signatureSection);
      sectionNames.push('SIGNATURE');

      const changeSection = {
        title: 'Change History',
        content: {
          totalAuditEntries: auditLogs.length,
          recentChanges: auditLogs.slice(0, 20).map(log => ({
            action: log.action,
            step: log.step,
            performedBy: log.performedBy,
            performedByRole: log.performedByRole,
            createdAt: log.createdAt,
          })),
          rejections: rejections.map(r => ({
            reasonCode: r.reasonCode,
            rejectedAt: r.rejectedAt,
            disputeStatus: r.disputeStatus,
          })),
          videoKycSessions: videoSessions.map(v => ({
            reason: v.reason,
            status: v.status,
            completedAt: v.completedAt,
            hasRecording: !!v.recordingHash,
          })),
          makerCheckerApprovals: approvals.map(a => ({
            entityType: a.entityType,
            status: a.status,
            decidedAt: a.decidedAt,
          })),
        },
        hash: kycEncryptionService.hashForAudit(JSON.stringify({
          logs: auditLogs.length,
          rejections: rejections.length,
          videos: videoSessions.length,
        })),
      };
      sections.push(changeSection);
      sectionNames.push('CHANGE_HISTORY');

      const fullContent = JSON.stringify(sections);
      const checksum = kycEncryptionService.generateChecksum(fullContent);

      const [pack] = await db.insert(kycAuditPacks).values({
        userId,
        sessionId: sessions.length > 0 ? sessions[0].id : null,
        generatedBy,
        generatedByRole,
        packType: 'full',
        checksum,
        sections: sectionNames,
        fileSize: Buffer.byteLength(fullContent),
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).returning();

      await db.insert(kycAuditLogs).values({
        userId,
        action: 'AUDIT_PACK_GENERATED',
        performedBy: generatedBy,
        performedByRole: generatedByRole,
        newValue: { packId: pack.id, sections: sectionNames, checksum },
      });

      return {
        success: true,
        packId: pack.id,
        sections: sectionNames,
        checksum,
      };
    } catch (error) {
      console.error('[AuditPack] Error generating:', error);
      return { success: false, error: 'Failed to generate audit pack' };
    }
  }

  async getPackById(packId: string): Promise<any> {
    try {
      const [pack] = await db.select()
        .from(kycAuditPacks)
        .where(eq(kycAuditPacks.id, packId))
        .limit(1);
      return pack || null;
    } catch {
      return null;
    }
  }

  async getPacksByUser(userId: string): Promise<any[]> {
    try {
      return await db.select()
        .from(kycAuditPacks)
        .where(eq(kycAuditPacks.userId, userId))
        .orderBy(desc(kycAuditPacks.generatedAt));
    } catch {
      return [];
    }
  }

  async incrementDownloadCount(packId: string): Promise<void> {
    try {
      const pack = await this.getPackById(packId);
      if (pack) {
        await db.update(kycAuditPacks)
          .set({ downloadCount: (pack.downloadCount || 0) + 1 })
          .where(eq(kycAuditPacks.id, packId));
      }
    } catch (error) {
      console.error('[AuditPack] Error incrementing download count:', error);
    }
  }
}

export const kycAuditPackService = new KycAuditPackService();
