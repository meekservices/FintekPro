import { Express, Request, Response } from 'express';
import { kycVideoService } from '../../services/kyc-video-service';
import { kycMakerCheckerService } from '../../services/kyc-maker-checker-service';
import { kycRejectionService } from '../../services/kyc-rejection-service';
import { kycProductEligibilityService } from '../../services/kyc-product-eligibility-service';
import { kycAuditPackService } from '../../services/kyc-audit-pack-service';
import { kycWebhookService } from '../../services/kyc-webhook-service';
import { kycEnvironmentService } from '../../services/kyc-environment-service';
import { kycRateLimiterService } from '../../services/kyc-rate-limiter-service';
import { kycEncryptionService } from '../../services/kyc-encryption-service';
import { db } from '../../db';
import { kycVerificationSessions, kycStepResets, kycAuditLogs, users } from '@shared/schema';
import { eq, desc, sql as drizzleSql } from 'drizzle-orm';

function hasRole(user: any, requiredRoles: string[]): boolean {
  if (!user) return false;
  const userRoles = user.roles || (user.role ? [user.role] : []);
  return requiredRoles.some((role: string) => userRoles.includes(role));
}

function requireAuth(req: any, res: Response, next: Function) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
}

function requireAdmin(req: any, res: Response, next: Function) {
  if (!req.user || !hasRole(req.user, ['superadmin', 'admin'])) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

function requireAdminOrAgent(req: any, res: Response, next: Function) {
  if (!req.user || !hasRole(req.user, ['superadmin', 'admin', 'agent', 'partner'])) {
    return res.status(403).json({ success: false, error: 'Admin or agent access required' });
  }
  next();
}

export function registerKycV2ExtensionRoutes(app: Express) {

  // ============================================================
  // VIDEO KYC ROUTES (BE-KYC-011)
  // ============================================================

  app.post("/api/kyc/video/initiate", requireAuth, async (req: any, res) => {
    try {
      const { sessionId, reason, scheduledAt } = req.body;
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'Session ID is required' });
      }

      const result = await kycVideoService.initiate({
        sessionId,
        userId: req.user.id,
        reason: reason || 'ADMIN_REQUEST',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        initiatedBy: req.user.id,
        initiatedByRole: req.user.role,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to initiate Video KYC' });
    }
  });

  app.post("/api/kyc/video/complete", requireAdminOrAgent, async (req: any, res) => {
    try {
      const { videoKycId, status, recordingHash, officerNotes, failureReason } = req.body;
      if (!videoKycId || !recordingHash) {
        return res.status(400).json({ success: false, error: 'Video KYC ID and recording hash are required' });
      }

      const result = await kycVideoService.complete({
        videoKycId,
        officerId: req.user.id,
        status: status || 'COMPLETED',
        recordingHash,
        officerNotes,
        failureReason,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to complete Video KYC' });
    }
  });

  app.get("/api/kyc/video/:sessionId", requireAuth, async (req: any, res) => {
    try {
      const result = await kycVideoService.getSession(req.params.sessionId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get Video KYC session' });
    }
  });

  app.get("/api/kyc/video/user/sessions", requireAuth, async (req: any, res) => {
    try {
      const sessions = await kycVideoService.getSessionsByUser(req.user.id);
      res.json({ success: true, sessions });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get Video KYC sessions' });
    }
  });

  app.get("/api/kyc/video/admin/pending", requireAdminOrAgent, async (req: any, res) => {
    try {
      const sessions = await kycVideoService.getPendingSessions();
      res.json({ success: true, sessions });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get pending sessions' });
    }
  });

  // ============================================================
  // MAKER-CHECKER ROUTES (BE-KYC-012)
  // ============================================================

  app.post("/api/kyc/approval/submit", requireAdminOrAgent, async (req: any, res) => {
    try {
      const { sessionId, userId, entityType, makerNotes } = req.body;
      if (!sessionId || !userId || !entityType) {
        return res.status(400).json({ success: false, error: 'Session ID, user ID, and entity type are required' });
      }

      const result = await kycMakerCheckerService.submit({
        sessionId,
        userId,
        entityType,
        makerId: req.user.id,
        makerNotes,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to submit for approval' });
    }
  });

  app.post("/api/kyc/approval/approve", requireAdmin, async (req: any, res) => {
    try {
      const { approvalId, notes } = req.body;
      if (!approvalId) {
        return res.status(400).json({ success: false, error: 'Approval ID is required' });
      }

      const result = await kycMakerCheckerService.approve({
        approvalId,
        checkerId: req.user.id,
        checkerIpAddress: req.ip,
        notes,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to approve' });
    }
  });

  app.post("/api/kyc/approval/reject", requireAdmin, async (req: any, res) => {
    try {
      const { approvalId, notes, rejectionReason } = req.body;
      if (!approvalId) {
        return res.status(400).json({ success: false, error: 'Approval ID is required' });
      }

      const result = await kycMakerCheckerService.reject({
        approvalId,
        checkerId: req.user.id,
        checkerIpAddress: req.ip,
        notes,
        rejectionReason,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to reject' });
    }
  });

  app.get("/api/kyc/approval/pending", requireAdmin, async (req: any, res) => {
    try {
      const approvals = await kycMakerCheckerService.getPendingApprovals();
      res.json({ success: true, approvals });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get pending approvals' });
    }
  });

  app.get("/api/kyc/approval/history", requireAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const approvals = await kycMakerCheckerService.getApprovalHistory(limit);
      res.json({ success: true, approvals });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get approval history' });
    }
  });

  // ============================================================
  // REJECTION & RE-KYC ROUTES (BE-KYC-013)
  // ============================================================

  app.post("/api/kyc/reject", requireAdminOrAgent, async (req: any, res) => {
    try {
      const { sessionId, userId, reasonCode, reasonDescription, rekycRequired } = req.body;
      if (!sessionId || !userId || !reasonCode) {
        return res.status(400).json({ success: false, error: 'Session ID, user ID, and reason code are required' });
      }

      const result = await kycRejectionService.reject({
        sessionId,
        userId,
        reasonCode,
        reasonDescription,
        rejectedBy: req.user.id,
        rejectedByRole: req.user.role,
        rekycRequired,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to reject KYC' });
    }
  });

  app.post("/api/kyc/resubmit", requireAuth, async (req: any, res) => {
    try {
      const { oldSessionId } = req.body;
      if (!oldSessionId) {
        return res.status(400).json({ success: false, error: 'Old session ID is required' });
      }

      const result = await kycRejectionService.resubmit({
        oldSessionId,
        userId: req.user.id,
        initiatedBy: req.user.id,
        initiatedByRole: req.user.role,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to resubmit KYC' });
    }
  });

  app.post("/api/kyc/dispute", requireAuth, async (req: any, res) => {
    try {
      const { rejectionId, disputeNotes } = req.body;
      if (!rejectionId || !disputeNotes) {
        return res.status(400).json({ success: false, error: 'Rejection ID and dispute notes are required' });
      }

      const result = await kycRejectionService.fileDispute({
        rejectionId,
        disputeNotes,
        filedBy: req.user.id,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to file dispute' });
    }
  });

  app.get("/api/kyc/disputes", requireAdmin, async (req: any, res) => {
    try {
      const status = req.query.status as string | undefined;
      const disputes = await kycRejectionService.getDisputes(status);
      res.json({ success: true, disputes });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get disputes' });
    }
  });

  app.get("/api/kyc/rejections/user/:userId", requireAuth, async (req: any, res) => {
    try {
      const rejections = await kycRejectionService.getRejectionsByUser(req.params.userId);
      res.json({ success: true, rejections });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get rejections' });
    }
  });

  app.get("/api/kyc/rejection-reasons", requireAuth, async (req: any, res) => {
    try {
      const reasons = kycRejectionService.getReasonCodes();
      res.json({ success: true, reasons });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get rejection reasons' });
    }
  });

  // ============================================================
  // PRODUCT ELIGIBILITY ROUTES (BE-KYC-014)
  // ============================================================

  app.get("/api/kyc/product-eligibility", requireAuth, async (req: any, res) => {
    try {
      const profile = req.user;
      const userState = {
        kycTier: profile.kycTier || 'basic',
        kycTierStatus: profile.kycTierStatus || 'provisional',
        amlRiskLevel: profile.amlRiskLevel || null,
        fatcaSigned: profile.fatcaStatus === 'Y',
        videoKycDone: false,
        makerCheckerApproved: false,
        femaCompliant: false,
      };

      const eligibility = await kycProductEligibilityService.checkEligibility(userState);
      res.json({ success: true, eligibility });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to check product eligibility' });
    }
  });

  app.get("/api/kyc/product-eligibility/rules", requireAdmin, async (req: any, res) => {
    try {
      const rules = await kycProductEligibilityService.getRules();
      res.json({ success: true, rules });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get eligibility rules' });
    }
  });

  // ============================================================
  // AUDIT PACK ROUTES (BE-KYC-015)
  // ============================================================

  app.get("/api/kyc/audit-pack/:userId", requireAdmin, async (req: any, res) => {
    try {
      const result = await kycAuditPackService.generatePack(
        req.params.userId,
        req.user.id,
        req.user.role
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to generate audit pack' });
    }
  });

  app.get("/api/kyc/audit-packs/:userId", requireAdmin, async (req: any, res) => {
    try {
      const packs = await kycAuditPackService.getPacksByUser(req.params.userId);
      res.json({ success: true, packs });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get audit packs' });
    }
  });

  // ============================================================
  // WEBHOOK ROUTES (BE-KYC-016)
  // ============================================================

  app.post("/api/kyc/webhook/receive", async (req: any, res) => {
    try {
      const { provider, eventType, referenceId, sessionId, payload } = req.body;
      if (!provider || !eventType) {
        return res.status(400).json({ success: false, error: 'Provider and event type are required' });
      }

      const result = await kycWebhookService.receiveEvent({
        provider, eventType, referenceId, sessionId, payload,
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to receive webhook' });
    }
  });

  app.post("/api/kyc/webhook/replay/:eventId", requireAdmin, async (req: any, res) => {
    try {
      const result = await kycWebhookService.replayFromDLQ(req.params.eventId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to replay event' });
    }
  });

  app.get("/api/kyc/webhook/dlq", requireAdmin, async (req: any, res) => {
    try {
      const events = await kycWebhookService.getDLQEvents();
      res.json({ success: true, events });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get DLQ events' });
    }
  });

  app.get("/api/kyc/webhook/stats", requireAdmin, async (req: any, res) => {
    try {
      const stats = await kycWebhookService.getStats();
      res.json({ success: true, stats });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get webhook stats' });
    }
  });

  // ============================================================
  // ENVIRONMENT & PROVIDER STATUS (BE-KYC-017)
  // ============================================================

  app.get("/api/kyc/environment/status", requireAuth, async (req: any, res) => {
    try {
      const flags = kycEnvironmentService.getFlags();
      const providerStatus = kycEnvironmentService.getProviderStatus();

      res.json({
        success: true,
        environment: flags.environment,
        fixedOtpEnabled: flags.fixedOtpEnabled,
        providerFallback: flags.providerFallback,
        providers: providerStatus,
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get environment status' });
    }
  });

  // ============================================================
  // RATE LIMITING STATUS (BE-KYC-019)
  // ============================================================

  app.get("/api/kyc/rate-limit/status", requireAuth, async (req: any, res) => {
    try {
      const aadhaarStatus = await kycRateLimiterService.getCounterStatus('aadhaar_otp', req.user.id);
      const panStatus = await kycRateLimiterService.getCounterStatus('pan_verify', req.user.id);

      res.json({
        success: true,
        limits: {
          aadhaar_otp: aadhaarStatus,
          pan_verify: panStatus,
        },
      });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to get rate limit status' });
    }
  });

  app.post("/api/kyc/rate-limit/unlock", requireAdmin, async (req: any, res) => {
    try {
      const { action, identifier } = req.body;
      if (!action || !identifier) {
        return res.status(400).json({ success: false, error: 'Action and identifier are required' });
      }

      const result = await kycRateLimiterService.adminUnlock(action, identifier, req.user.id);
      res.json({ success: result });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to unlock rate limit' });
    }
  });

  // ============================================================
  // AGENT KYC STEP RESET (BE-KYC-STEP-RESET)
  // ============================================================

  const KYC_STEP_DEPENDENCIES: Record<string, string[]> = {
    pan_verification: [],
    kra_status_check: ['pan_verification'],
    aadhaar_otp: ['pan_verification'],
    aadhaar_verification: ['pan_verification', 'aadhaar_otp'],
    ckyc_upload: ['pan_verification', 'aadhaar_verification'],
    ckyc_status: ['ckyc_upload'],
    ucc_creation: ['pan_verification', 'aadhaar_verification'],
    bank_verification: ['pan_verification'],
    emandate_registration: ['bank_verification'],
    risk_profiling: ['pan_verification'],
  };

  const STEP_RESET_REASON_CODES: Record<string, string> = {
    DOCUMENT_MISMATCH: 'Document details do not match',
    INCORRECT_DATA: 'Incorrect data entered by user',
    EXPIRED_DOCUMENT: 'Document has expired',
    VERIFICATION_FAILED: 'Third-party verification failed',
    USER_REQUESTED: 'User requested to redo step',
    COMPLIANCE_REVIEW: 'Step flagged during compliance review',
    AGENT_OVERRIDE: 'Agent override for correction',
  };

  function findDownstreamSteps(step: string): string[] {
    const downstream: string[] = [];
    for (const [s, deps] of Object.entries(KYC_STEP_DEPENDENCIES)) {
      if (s !== step && deps.includes(step)) {
        downstream.push(s);
        downstream.push(...findDownstreamSteps(s));
      }
    }
    return [...new Set(downstream)];
  }

  app.get("/api/kyc/agent/step-reset/reasons", requireAdminOrAgent, async (_req: any, res) => {
    res.json({ success: true, reasons: STEP_RESET_REASON_CODES });
  });

  app.get("/api/kyc/agent/step-reset/history/:sessionId", requireAdminOrAgent, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const resets = await db.select().from(kycStepResets)
        .where(eq(kycStepResets.sessionId, sessionId))
        .orderBy(kycStepResets.resetAt);
      res.json({ success: true, resets });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch reset history' });
    }
  });

  app.get("/api/kyc/agent/step-reset/available/:sessionId", requireAdminOrAgent, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const [session] = await db.select().from(kycVerificationSessions)
        .where(eq(kycVerificationSessions.id, sessionId));

      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }

      const stepStatus = (session.stepStatus || {}) as Record<string, any>;
      const resettableSteps: Array<{step: string; currentStatus: any; downstreamSteps: string[]}> = [];

      for (const step of Object.keys(KYC_STEP_DEPENDENCIES)) {
        const isCompleted = stepStatus[step] === true || 
          stepStatus[`${step}_verified`] === true ||
          stepStatus[`${step}_completed`] === true;

        if (isCompleted) {
          resettableSteps.push({
            step,
            currentStatus: stepStatus[step] ?? stepStatus[`${step}_verified`] ?? stepStatus[`${step}_completed`],
            downstreamSteps: findDownstreamSteps(step).filter(ds => {
              return stepStatus[ds] === true || stepStatus[`${ds}_verified`] === true || stepStatus[`${ds}_completed`] === true;
            }),
          });
        }
      }

      res.json({ success: true, resettableSteps, sessionId });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to fetch resettable steps' });
    }
  });

  app.post("/api/kyc/agent/step-reset", requireAdminOrAgent, async (req: any, res) => {
    try {
      const { sessionId, step, reason, reasonCode } = req.body;

      if (!sessionId || !step || !reason || !reasonCode) {
        return res.status(400).json({ success: false, error: 'sessionId, step, reason, and reasonCode are required' });
      }

      if (!KYC_STEP_DEPENDENCIES[step]) {
        return res.status(400).json({ success: false, error: `Invalid KYC step: ${step}. Valid steps: ${Object.keys(KYC_STEP_DEPENDENCIES).join(', ')}` });
      }

      if (!STEP_RESET_REASON_CODES[reasonCode]) {
        return res.status(400).json({ success: false, error: `Invalid reason code: ${reasonCode}. Valid codes: ${Object.keys(STEP_RESET_REASON_CODES).join(', ')}` });
      }

      const [session] = await db.select().from(kycVerificationSessions)
        .where(eq(kycVerificationSessions.id, sessionId));

      if (!session) {
        return res.status(404).json({ success: false, error: 'KYC session not found' });
      }

      const stepStatus = (session.stepStatus || {}) as Record<string, any>;
      const previousStatus: Record<string, any> = {};

      const isCompleted = stepStatus[step] === true || 
        stepStatus[`${step}_verified`] === true ||
        stepStatus[`${step}_completed`] === true;

      if (!isCompleted) {
        return res.status(400).json({ success: false, error: `Step "${step}" is not completed and cannot be reset` });
      }

      const downstreamSteps = findDownstreamSteps(step);
      const completedDownstream = downstreamSteps.filter(ds => {
        return stepStatus[ds] === true || stepStatus[`${ds}_verified`] === true || stepStatus[`${ds}_completed`] === true;
      });

      const stepsToReset = [step, ...completedDownstream];
      const updatedStepStatus = { ...stepStatus };

      for (const s of stepsToReset) {
        previousStatus[s] = {
          [s]: updatedStepStatus[s],
          [`${s}_verified`]: updatedStepStatus[`${s}_verified`],
          [`${s}_completed`]: updatedStepStatus[`${s}_completed`],
        };
        delete updatedStepStatus[s];
        delete updatedStepStatus[`${s}_verified`];
        delete updatedStepStatus[`${s}_completed`];
        updatedStepStatus[`${s}_reset`] = true;
        updatedStepStatus[`${s}_reset_at`] = new Date().toISOString();
        updatedStepStatus[`${s}_reset_by`] = req.user.id;
      }

      let resetFields: Record<string, any> = {};
      if (stepsToReset.includes('pan_verification')) {
        resetFields = { ...resetFields, panVerified: false, panVerifiedAt: null };
      }
      if (stepsToReset.includes('aadhaar_otp')) {
        resetFields = { ...resetFields, aadhaarOtpSent: false, aadhaarOtpSentAt: null };
      }
      if (stepsToReset.includes('aadhaar_verification')) {
        resetFields = { ...resetFields, aadhaarOtpVerified: false, aadhaarVerifiedAt: null };
      }

      await db.update(kycVerificationSessions)
        .set({
          stepStatus: updatedStepStatus,
          currentStep: step,
          ...resetFields,
          updatedAt: new Date(),
        })
        .where(eq(kycVerificationSessions.id, sessionId));

      const [resetRecord] = await db.insert(kycStepResets).values({
        sessionId,
        userId: session.userId || '',
        step,
        previousStatus,
        resetBy: req.user.id,
        resetByRole: req.user.role || req.user.roles?.[0] || 'agent',
        reason,
        reasonCode,
        dependentStepsReset: completedDownstream,
      }).returning();

      await db.insert(kycAuditLogs).values({
        userId: session.userId,
        prospectId: session.prospectId,
        createdByAgentId: req.user.id,
        accessedBy: req.user.id,
        accessType: 'write',
        dataFieldsAccessed: { step, stepsReset: stepsToReset, reasonCode },
        purpose: `Agent reset KYC step: ${step}. Reason: ${reason}`,
        apiEndpoint: '/api/kyc/agent/step-reset',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        accessStatus: 'success',
        retentionDays: 2555,
        regulatoryTag: 'SEBI',
      });

      res.json({
        success: true,
        resetId: resetRecord.id,
        stepsReset: stepsToReset,
        message: `Step "${step}" has been reset${completedDownstream.length > 0 ? ` along with ${completedDownstream.length} dependent step(s): ${completedDownstream.join(', ')}` : ''}. User can now redo this step.`,
      });
    } catch (error) {
      console.error('[KYC Step Reset] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to reset KYC step' });
    }
  });

  // ============================================================
  // ACTIVE SESSION LOOKUP (BE-KYC-014) — admin + agent
  // ============================================================

  app.get("/api/kyc/active-session/:userId", requireAdminOrAgent, async (req: any, res) => {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }

      const [sessionRow] = await db
        .select({
          sessionId: kycVerificationSessions.id,
          currentStep: kycVerificationSessions.currentStep,
          entityType: kycVerificationSessions.entityType,
          createdAt: kycVerificationSessions.createdAt,
          initiatedBy: kycVerificationSessions.initiatedBy,
          panNumber: kycVerificationSessions.panNumber,
          userId: kycVerificationSessions.userId,
        })
        .from(kycVerificationSessions)
        .where(eq(kycVerificationSessions.userId, userId))
        .orderBy(desc(kycVerificationSessions.createdAt))
        .limit(1);

      if (!sessionRow) {
        return res.json({ success: true, session: null });
      }

      const [userRow] = await db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const pan = sessionRow.panNumber || '';
      const panMasked = pan.length > 4 ? `****${pan.slice(-4)}` : (pan ? '****' : null);

      return res.json({
        success: true,
        session: {
          sessionId: sessionRow.sessionId,
          currentStep: sessionRow.currentStep,
          entityType: sessionRow.entityType,
          createdAt: sessionRow.createdAt,
          initiatedBy: sessionRow.initiatedBy,
          panMasked,
          userName: userRow ? `${userRow.firstName || ''} ${userRow.lastName || ''}`.trim() || null : null,
          userEmail: userRow?.email || null,
        },
      });
    } catch (error) {
      console.error('[KYC Active Session] Error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch active session' });
    }
  });

  // ============================================================
  // ALL KYC SESSIONS VIEW (Admin oversight — all users)
  // ============================================================

  app.get("/api/admin/kyc/sessions", requireAdmin, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || '100'), 200);
      const outcome = (req.query.outcome as string) || null;

      const outcomeCondition = outcome
        ? drizzleSql`WHERE kvs.session_outcome = ${outcome}`
        : drizzleSql``;

      const rows = await db.execute(drizzleSql`
        SELECT
          kvs.id AS "sessionId",
          kvs.user_id AS "userId",
          kvs.current_step AS "currentStep",
          kvs.session_outcome AS "sessionOutcome",
          kvs.is_active AS "isActive",
          kvs.started_at AS "startedAt",
          kvs.completed_at AS "completedAt",
          kvs.aml_risk_level AS "amlRiskLevel",
          kvs.pan_verified AS "panVerified",
          kvs.aadhaar_otp_verified AS "aadhaarOtpVerified",
          kvs.entity_type_detected AS "entityType",
          u.email,
          u.first_name AS "firstName",
          u.last_name AS "lastName",
          u.kyc_status AS "kycStatus"
        FROM kyc_verification_sessions kvs
        LEFT JOIN users u ON u.id = kvs.user_id
        ${outcomeCondition}
        ORDER BY kvs.started_at DESC
        LIMIT ${limit}
      `);

      const sessions = rows.rows ?? rows;
      res.json({ success: true, sessions, total: (sessions as any[]).length });
    } catch (error) {
      console.error('[Admin KYC Sessions]', error);
      res.status(500).json({ success: false, error: 'Failed to fetch KYC sessions' });
    }
  });

  app.post("/api/admin/kyc/reset", requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.body;

      if (userId) {
        await db.execute(drizzleSql`
          UPDATE kyc_verification_sessions
          SET session_outcome = 'reset_by_admin', is_active = false
          WHERE user_id = ${userId}
        `);
        await db.execute(drizzleSql`
          UPDATE users SET kyc_status = NULL, ckyc_status = NULL
          WHERE id = ${userId}
        `);
        return res.json({ success: true, message: `KYC reset for user ${userId}` });
      }

      await db.execute(drizzleSql.raw(`
        UPDATE kyc_verification_sessions
        SET session_outcome = 'reset_by_admin', is_active = false
      `));
      await db.execute(drizzleSql.raw(`
        UPDATE users SET kyc_status = NULL, ckyc_status = NULL
        WHERE role NOT IN ('admin', 'superadmin')
      `));

      res.json({ success: true, message: 'KYC reset for all non-admin users' });
    } catch (error) {
      console.error('[Admin KYC Reset]', error);
      res.status(500).json({ success: false, error: 'Failed to reset KYC' });
    }
  });

  console.log('✅ KYC v2 Extension routes registered (Video KYC, Maker-Checker, Rejection, Eligibility, Audit Pack, Webhooks, Environment, Rate Limits, Agent Step Reset, Active Session Lookup)');
}
