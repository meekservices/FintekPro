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
import { eq, desc, and, sql as drizzleSql } from 'drizzle-orm';

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

  // ============================================================
  // USER-INITIATED RE-KYC: Verified Document Change Request
  // Regulatory basis: SEBI KYC Master Circular 2024 —
  // changes to PAN/DOB on a verified KYC require fresh re-verification.
  // ============================================================

  app.post("/api/kyc/request-document-change", requireAuth, async (req: any, res) => {
    try {
      const { field, newValue, reason, notes } = req.body;
      const userId = req.user.id;

      const validFields: Record<string, string> = {
        panNumber:   'PAN Number',
        dateOfBirth: 'Date of Birth',
      };
      const validReasons: Record<string, string> = {
        DATA_ENTRY_ERROR:   'Data entry error during original KYC',
        DOB_CORRECTION:     'Date of birth correction (e.g., wrong year entered)',
        PAN_CORRECTION:     'PAN card correction / replacement by IT Dept',
        MARRIAGE_NAME:      'Name change due to marriage (linked to PAN)',
        LEGAL_NAME_CHANGE:  'Legal name/DOB change (court order)',
        OTHER:              'Other (describe in notes)',
      };

      if (!field || !validFields[field]) {
        return res.status(400).json({ success: false, error: 'Invalid field. Only panNumber and dateOfBirth changes require Re-KYC.' });
      }
      if (!reason || !validReasons[reason]) {
        return res.status(400).json({ success: false, error: 'A valid reason is required.' });
      }
      if (!newValue || !newValue.trim()) {
        return res.status(400).json({ success: false, error: 'New value is required.' });
      }
      if (field === 'panNumber' && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(newValue.toUpperCase())) {
        return res.status(400).json({ success: false, error: 'Invalid PAN format. Must be like ABCDE1234F.' });
      }

      const trackingId = `RKC-${Date.now().toString(36).toUpperCase()}-${userId.slice(-4).toUpperCase()}`;

      await db.insert(kycAuditLogs).values({
        userId,
        accessedBy:        userId,
        accessType:        'document_change_request',
        dataFieldsAccessed: [field],
        purpose: `Re-KYC request — ${validFields[field]} change: ${validReasons[reason]}${notes ? ` | Notes: ${notes.trim().substring(0, 500)}` : ''}`,
        apiEndpoint:       '/api/kyc/request-document-change',
        ipAddress:         (req.ip || req.socket?.remoteAddress || 'unknown').toString(),
        userAgent:         req.headers['user-agent'] || 'unknown',
        requestId:         trackingId,
        regulatoryPurpose: 'KYC',
        accessStatus:      'pending',
        complianceCheckPassed: false,
      } as any);

      return res.json({
        success:          true,
        trackingId,
        message:          `Your request to update ${validFields[field]} has been received and logged.`,
        expectedTimeline: '5–10 business days',
        nextSteps: [
          'Our compliance team will review your request within 2 business days.',
          'You will receive an email/SMS with a link to complete the Re-KYC process.',
          'Your existing KYC status and all services remain active during this process.',
          'If the change is approved, a fresh KYC verification session will be initiated.',
        ],
        regulatoryNote: 'As per SEBI KYC Master Circular 2024 and PMLA Rules 2005, any change to PAN or Date of Birth on a verified KYC record requires a fresh KYC verification (Re-KYC).',
      });
    } catch (error: any) {
      console.error('[KYC Document Change Request]', error);
      res.status(500).json({ success: false, error: 'Failed to submit document change request. Please try again.' });
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
      const targetUserId = req.params.userId;
      const requester = req.user;
      const isPrivileged = requester.role === 'admin' || requester.role === 'agent' || requester.role === 'superadmin';
      if (!isPrivileged && requester.id !== targetUserId) {
        return res.status(403).json({ success: false, error: 'Forbidden: you may only view your own rejection records' });
      }
      const rejections = await kycRejectionService.getRejectionsByUser(targetUserId);
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
        .where(and(
          eq(kycVerificationSessions.userId, userId),
          eq(kycVerificationSessions.isActive, true),
        ))
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

  // ============================================================================
  // FULL KYC RESET — clears ALL verification flags so the user restarts from 0
  // ============================================================================

  /**
   * Shared helper: fully reset a single user's KYC state.
   * Clears all profile verification flags, closes active sessions, and
   * marks bank accounts as un-verified so they can re-do penny-drop.
   * Identity data (name, DOB, PAN number) is preserved for re-use.
   */
  async function fullKycReset(userId: string, resetBy: string): Promise<void> {
    // 1. Reset all verification flags in user_profiles
    await db.execute(drizzleSql`
      UPDATE user_profiles SET
        pan_verified_via_sandbox            = false,
        pan_verified_via_smart_kyc          = false,
        ckyc_fetched_via_authbridge         = false,
        kra_verified_via_protean            = false,
        aadhaar_verified_via_smart_kyc      = false,
        is_profile_completed                = false,
        profile_completed_at                = NULL,
        video_kyc_completed                 = false,
        video_kyc_completed_date            = NULL,
        video_kyc_status                    = 'pending',
        face_to_face_verification_completed = false,
        face_to_face_verification_date      = NULL,
        kyc_level                           = '0',
        kyc_level_upgraded_at               = NULL,
        kyc_tier                            = 'basic',
        kyc_tier_status                     = 'provisional',
        kyc_update_due_date                 = NULL,
        products_unlocked                   = '[]'::jsonb
      WHERE user_id = ${userId}
    `);

    // 2. Clear kyc_status / ckyc_status on the users row
    await db.execute(drizzleSql`
      UPDATE users SET kyc_status = NULL, ckyc_status = NULL
      WHERE id = ${userId}
    `);

    // 3. Close any active KYC sessions
    await db.execute(drizzleSql`
      UPDATE kyc_verification_sessions
      SET session_outcome = 'reset_by_admin', is_active = false
      WHERE user_id = ${userId}
    `);

    // 4. Un-verify bank accounts so they redo penny-drop
    await db.execute(drizzleSql`
      UPDATE user_bank_accounts
      SET is_verified = false, verification_status = 'pending'
      WHERE user_id = ${userId}
    `);

    // 5. Invalidate the in-memory compliance cache for this user
    const { invalidateComplianceCache } = await import('../../middleware/universal-kyc-gate');
    invalidateComplianceCache(userId);

    // 6. Write audit log entry (best-effort — don't fail the reset if this errors)
    try {
      await db.execute(drizzleSql`
        INSERT INTO kyc_audit_logs
          (id, user_id, accessed_by, access_type, purpose, api_endpoint, access_status, created_at)
        VALUES (
          gen_random_uuid(),
          ${userId},
          ${resetBy},
          'write',
          'Admin full KYC reset — all verification flags and sessions cleared',
          '/api/admin/kyc/reset',
          'success',
          NOW()
        )
      `);
    } catch { /* non-fatal */ }
  }

  /**
   * POST /api/admin/kyc/reset
   * Full KYC reset for a specific user (body: { userId }) or all non-admin users (no body).
   * Now correctly resets user_profiles verification flags, not just users.kyc_status.
   */
  app.post("/api/admin/kyc/reset", requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.body;
      const resetBy = req.user?.id || 'admin';

      if (userId) {
        await fullKycReset(userId, resetBy);
        return res.json({ success: true, message: `Full KYC reset completed for user ${userId}. All verification flags cleared. User must restart KYC from step 1.` });
      }

      // Bulk reset — only non-admin users
      const nonAdminUsers = await db.execute(drizzleSql`
        SELECT id FROM users
        WHERE NOT (roles && ARRAY['admin','superadmin']::text[])
          AND role NOT IN ('admin', 'superadmin')
      `);

      let resetCount = 0;
      for (const row of (nonAdminUsers as any).rows ?? []) {
        await fullKycReset(row.id, resetBy);
        resetCount++;
      }

      res.json({ success: true, message: `Full KYC reset completed for ${resetCount} non-admin users.` });
    } catch (error) {
      console.error('[Admin KYC Reset]', error);
      res.status(500).json({ success: false, error: 'Failed to reset KYC' });
    }
  });

  /**
   * POST /api/admin/kyc/reset-self
   * Allows an admin to reset their own KYC so they can re-complete the wizard.
   * Requires admin or superadmin role.
   */
  app.post("/api/admin/kyc/reset-self", requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      await fullKycReset(userId, userId);
      res.json({
        success: true,
        message: 'Your KYC has been fully reset. Please navigate to the KYC wizard to restart verification.',
        redirectTo: '/onboarding',
      });
    } catch (error) {
      console.error('[Admin KYC Self-Reset]', error);
      res.status(500).json({ success: false, error: 'Failed to reset your KYC' });
    }
  });

  /**
   * GET /api/admin/kyc/provider-health
   * Lightweight ping to each KYC provider. Returns live/degraded/down status.
   * Used by the admin KYC management page status strip.
   */
  app.get("/api/admin/kyc/provider-health", requireAdmin, async (_req: any, res) => {
    async function ping(name: string, fn: () => Promise<void>): Promise<{ status: 'live' | 'degraded' | 'down'; latencyMs: number; error?: string }> {
      const start = Date.now();
      try {
        await fn();
        return { status: 'live', latencyMs: Date.now() - start };
      } catch (err: any) {
        const latencyMs = Date.now() - start;
        const msg: string = err?.message || String(err);
        // 4xx from provider = reachable but auth/input issue → degraded
        // network error = down
        const isDegraded = msg.includes('401') || msg.includes('403') || msg.includes('400') || msg.includes('timeout') || latencyMs > 5000;
        return { status: isDegraded ? 'degraded' : 'down', latencyMs, error: msg.slice(0, 120) };
      }
    }

    const SANDBOX_URL = process.env.SANDBOX_BASE_URL || 'https://test-api.sandbox.co.in';
    const TRUTHSCREEN_URL = 'https://www.truthscreen.com';

    const [sandboxPan, truthscreenAadhaar, truthscreenCkyc, ckycRegistry] = await Promise.all([
      ping('sandbox_pan', async () => {
        const apiKey = process.env.SANDBOX_API_KEY;
        if (!apiKey) throw new Error('SANDBOX_API_KEY not configured');
        const r = await fetch(`${SANDBOX_URL}/kyc/v2/pan`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'x-api-version': '1.0' },
          body: JSON.stringify({ '@entity': 'in.co.sandbox.kyc.pan_plus.request', 'pan': 'AAAAA0000A' }),
          signal: AbortSignal.timeout(6000),
        });
        if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
      }),
      ping('truthscreen_aadhaar', async () => {
        const user = process.env.TRUTHSCREEN_USERNAME;
        const pass = process.env.TRUTHSCREEN_PASSWORD;
        if (!user || !pass) throw new Error('TRUTHSCREEN credentials not configured');
        const r = await fetch(`${TRUTHSCREEN_URL}/api/3.0/generate-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docType: 1, docNumber: '999999999999', username: user }),
          signal: AbortSignal.timeout(6000),
        });
        if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
      }),
      ping('truthscreen_ckyc', async () => {
        const user = process.env.TRUTHSCREEN_USERNAME;
        if (!user) throw new Error('TRUTHSCREEN credentials not configured');
        const r = await fetch(`${TRUTHSCREEN_URL}/api/ckyc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docType: 3, docNumber: 'AAAAA0000A', username: user }),
          signal: AbortSignal.timeout(6000),
        });
        if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
      }),
      ping('ckyc_registry', async () => {
        // Lightweight check — CKYC Registry (CERSAI) endpoint availability
        const apiKey = process.env.CKYC_API_KEY;
        if (!apiKey) throw new Error('CKYC_API_KEY not configured — running in mock mode');
        const r = await fetch('https://uatkyc.ckycreg.in/ckyc/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({ pan: 'AAAAA0000A' }),
          signal: AbortSignal.timeout(6000),
        });
        if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
      }),
    ]);

    res.json({
      success: true,
      checkedAt: new Date().toISOString(),
      providers: {
        sandbox_pan: sandboxPan,
        truthscreen_aadhaar: truthscreenAadhaar,
        truthscreen_ckyc: truthscreenCkyc,
        ckyc_registry: ckycRegistry,
      },
    });
  });

  console.log('✅ KYC v2 Extension routes registered (Video KYC, Maker-Checker, Rejection, Eligibility, Audit Pack, Webhooks, Environment, Rate Limits, Agent Step Reset, Active Session Lookup)');
}
