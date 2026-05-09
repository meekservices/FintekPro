import { db } from '../db';
import { kycRejectionEvents, kycAuditLogs, kycVerificationSessions, KYC_REJECTION_REASON_CODES } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

interface RejectKycParams {
  sessionId: string;
  userId: string;
  reasonCode: string;
  reasonDescription?: string;
  rejectedBy: string;
  rejectedByRole: string;
  rekycRequired?: boolean;
}

interface ResubmitKycParams {
  oldSessionId: string;
  userId: string;
  initiatedBy: string;
  initiatedByRole: string;
}

interface FileDisputeParams {
  rejectionId: string;
  disputeNotes: string;
  filedBy: string;
}

class KycRejectionService {
  constructor() {
    console.log('✅ KYC Rejection & Re-KYC Service initialized');
    console.log(`   Reason codes: ${Object.keys(KYC_REJECTION_REASON_CODES).join(', ')}`);
  }

  async reject(params: RejectKycParams): Promise<{
    success: boolean;
    rejectionId?: string;
    error?: string;
  }> {
    try {
      const validReasons = Object.values(KYC_REJECTION_REASON_CODES);
      if (!validReasons.includes(params.reasonCode as any)) {
        return { success: false, error: `Invalid reason code. Must be one of: ${validReasons.join(', ')}` };
      }

      const [rejection] = await db.insert(kycRejectionEvents).values({
        sessionId: params.sessionId,
        userId: params.userId,
        reasonCode: params.reasonCode,
        reasonDescription: params.reasonDescription || null,
        rejectedBy: params.rejectedBy,
        rejectedByRole: params.rejectedByRole,
        rekycRequired: params.rekycRequired ?? false,
        rejectedAt: new Date(),
      }).returning();

      await db.update(kycVerificationSessions)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(kycVerificationSessions.id, params.sessionId));

      await db.insert(kycAuditLogs).values({
        sessionId: params.sessionId,
        userId: params.userId,
        action: 'KYC_REJECTED',
        step: 'rejection',
        performedBy: params.rejectedBy,
        performedByRole: params.rejectedByRole,
        newValue: {
          rejectionId: rejection.id,
          reasonCode: params.reasonCode,
          reasonDescription: params.reasonDescription,
          rekycRequired: params.rekycRequired,
        },
      });

      return { success: true, rejectionId: rejection.id };
    } catch (error) {
      console.error('[KycRejection] Error rejecting:', error);
      return { success: false, error: 'Failed to reject KYC' };
    }
  }

  async resubmit(params: ResubmitKycParams): Promise<{
    success: boolean;
    newSessionId?: string;
    error?: string;
  }> {
    try {
      const [oldSession] = await db.select()
        .from(kycVerificationSessions)
        .where(eq(kycVerificationSessions.id, params.oldSessionId))
        .limit(1);

      if (!oldSession) {
        return { success: false, error: 'Original session not found' };
      }

      const [newSession] = await db.insert(kycVerificationSessions).values({
        userId: params.userId,
        sessionType: oldSession.sessionType,
        initiatedBy: params.initiatedByRole === 'agent' ? 'agent' : 'customer',
        currentStep: 'pan_verification',
        isActive: true,
        createdByAgentId: oldSession.createdByAgentId,
      }).returning();

      const rejections = await db.select()
        .from(kycRejectionEvents)
        .where(
          and(
            eq(kycRejectionEvents.sessionId, params.oldSessionId),
            eq(kycRejectionEvents.userId, params.userId)
          )
        )
        .orderBy(desc(kycRejectionEvents.rejectedAt))
        .limit(1);

      if (rejections.length > 0) {
        await db.update(kycRejectionEvents)
          .set({ newSessionId: newSession.id })
          .where(eq(kycRejectionEvents.id, rejections[0].id));
      }

      await db.insert(kycAuditLogs).values({
        sessionId: newSession.id,
        userId: params.userId,
        action: 'KYC_RESUBMITTED',
        step: 'resubmission',
        performedBy: params.initiatedBy,
        performedByRole: params.initiatedByRole,
        previousValue: { oldSessionId: params.oldSessionId },
        newValue: { newSessionId: newSession.id },
      });

      return { success: true, newSessionId: newSession.id };
    } catch (error) {
      console.error('[KycRejection] Error resubmitting:', error);
      return { success: false, error: 'Failed to resubmit KYC' };
    }
  }

  async fileDispute(params: FileDisputeParams): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const [rejection] = await db.select()
        .from(kycRejectionEvents)
        .where(eq(kycRejectionEvents.id, params.rejectionId))
        .limit(1);

      if (!rejection) {
        return { success: false, error: 'Rejection event not found' };
      }

      if (rejection.disputeStatus) {
        return { success: false, error: `Dispute already ${rejection.disputeStatus}` };
      }

      await db.update(kycRejectionEvents)
        .set({
          disputeNotes: params.disputeNotes,
          disputeStatus: 'FILED',
        })
        .where(eq(kycRejectionEvents.id, params.rejectionId));

      await db.insert(kycAuditLogs).values({
        sessionId: rejection.sessionId,
        userId: rejection.userId,
        action: 'KYC_DISPUTE_FILED',
        step: 'dispute',
        performedBy: params.filedBy,
        newValue: { rejectionId: params.rejectionId, disputeNotes: params.disputeNotes },
      });

      return { success: true };
    } catch (error) {
      console.error('[KycRejection] Error filing dispute:', error);
      return { success: false, error: 'Failed to file dispute' };
    }
  }

  async getDisputes(status?: string): Promise<any[]> {
    try {
      let query = db.select().from(kycRejectionEvents);
      if (status) {
        query = query.where(eq(kycRejectionEvents.disputeStatus, status)) as any;
      }
      return await (query as any).orderBy(desc(kycRejectionEvents.rejectedAt));
    } catch {
      return [];
    }
  }

  async getRejectionsByUser(userId: string): Promise<any[]> {
    try {
      return await db.select()
        .from(kycRejectionEvents)
        .where(eq(kycRejectionEvents.userId, userId))
        .orderBy(desc(kycRejectionEvents.rejectedAt));
    } catch {
      return [];
    }
  }

  async getRejectionsBySession(sessionId: string): Promise<any[]> {
    try {
      return await db.select()
        .from(kycRejectionEvents)
        .where(eq(kycRejectionEvents.sessionId, sessionId))
        .orderBy(desc(kycRejectionEvents.rejectedAt));
    } catch {
      return [];
    }
  }

  getReasonCodes(): Record<string, string> {
    return {
      DOCUMENT_MISMATCH: 'Document details do not match provided information',
      AML_HIGH_RISK: 'High AML risk detected during screening',
      SIGNATURE_INVALID: 'Signature verification failed',
      CKYC_INCOMPLETE: 'CKYC record is incomplete or missing required fields',
      PAN_NAME_MISMATCH: 'PAN name does not match application name',
      AADHAAR_FAILED: 'Aadhaar verification failed',
      VIDEO_KYC_FAILED: 'Video KYC session failed or was not completed',
      MAKER_CHECKER_REJECTED: 'Rejected during maker-checker review',
      REGULATOR_FLAG: 'Flagged by regulator for additional scrutiny',
    };
  }
}

export const kycRejectionService = new KycRejectionService();
