// @ts-nocheck
import { Express, Request, Response } from 'express';
import { randomInt } from 'crypto';
import { requireClientOrHigher } from '../../middleware/auth';
import { requireAuth } from '../../middleware/roleMiddleware';
import { getAccessibleProducts, getUserKYCLevel } from '../../middleware/kyc-level-gate';
import { getComplianceStatus, ROLE_KYC_MINIMUM } from '../../middleware/universal-kyc-gate';
import { storage } from '../../storage';
import { sandboxPANService } from '../../sandbox-pan-api';
import { authBridgeCKYCService } from '../../authbridge-ckyc-api';
import { getAdapter as getCkycAdapter } from '../../services/ckyc-provider-adapter';
import { PANConsentService } from '../../services/pan-consent-service';
import { kycOrchestratorService } from '../../services/kyc-orchestrator-service';
import { sandboxKYCService } from '../../services/sandbox-kyc-service';
import { kycEnvironmentService } from '../../services/kyc-environment-service';
import { getSandboxEnvironment } from '../../utils/sandbox-config';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { smsService } from '../../services/sms-service';
import { emailService } from '../../email-service';

export function registerKYCWizardPart4Routes(app: Express) {
  /**
   * GET /api/kyc/my-compliance-status
   * Returns the current KYC compliance status for ANY authenticated role.
   * Used by the Universal KYC Wall on the frontend.
   *
   * Regulatory basis: PMLA 2002 §12, RBI Master Direction on KYC 2016,
   * SEBI KRA Regulations, AMFI Circular on ARN holders.
   *
   * This endpoint is on the universal KYC gate exempt list (/api/kyc/*)
   * so it always responds even when the user has not yet completed KYC.
   */
  app.post("/api/kyc/pan/verify", requireClientOrHigher, async (req: any, res) => {
    try {
      const { panNumber } = req.body;
      if (!panNumber) {
        return res.status(400).json({ success: false, message: "PAN number is required" });
      }

      const entityDetected = kycOrchestratorService.detectEntityFromPAN(panNumber);
      const overrideCheck = kycOrchestratorService.canOverrideEntity(req.user?.role || 'user');

      res.json({
        success: true,
        data: {
          pan_valid: true,
          entity_detected: entityDetected,
          override_allowed: overrideCheck.allowed,
          source: 'sandbox',
        }
      });
    } catch (error) {
      console.error('Error verifying PAN entity:', error);
      res.status(500).json({ success: false, message: 'Failed to verify PAN' });
    }
  });

  // ============================================================================
  // KYC v2: CKYC Check standalone (BE-KYC-003)
  // ============================================================================
  app.post("/api/kyc/ckyc/check", requireClientOrHigher, async (req: any, res) => {
    try {
      const { panNumber, fullName, dateOfBirth, sessionId } = req.body;
      if (!panNumber) {
        return res.status(400).json({ success: false, message: "PAN number is required" });
      }

      let ckycResult: any = null;
      try {
        const truthScreenAdapter = await getCkycAdapter('truthscreen');
        if (truthScreenAdapter.isConfigured()) {
          ckycResult = await truthScreenAdapter.verify({
            panNumber: panNumber.toUpperCase(),
            fullName: fullName || '',
            dateOfBirth: dateOfBirth || '',
            userId: req.user!.id
          });
          console.log(`[CKYC] TruthScreen check: found=${ckycResult.found}, kin=${ckycResult.kin || 'N/A'}`);
        } else {
          ckycResult = await authBridgeCKYCService.fetchCKYC({
            pan: panNumber.toUpperCase(),
            full_name: fullName || '',
            date_of_birth: dateOfBirth || ''
          });
        }
      } catch (e) {
        console.warn('[CKYC] Provider call failed:', (e as Error).message);
      }

      const isTsResult = ckycResult?.provider === 'truthscreen';
      const decision = kycOrchestratorService.computeCkycConfidence(
        isTsResult
          ? { found: ckycResult.found, data: ckycResult.data, kin: ckycResult.kin, provider: 'truthscreen' }
          : (ckycResult?.status === 'success' && ckycResult?.data)
            ? { found: true, data: ckycResult.data, kin: ckycResult.data?.kin, provider: 'truthscreen-ckyc' }
            : { found: false, provider: 'truthscreen-ckyc' }
      );

      res.json({
        success: true,
        data: {
          ckyc_found: decision.ckyc_found,
          confidence_score: decision.confidence_score,
          missing_fields: decision.missing_fields,
          aadhaar_required: decision.aadhaar_required,
          source: decision.source,
        }
      });
    } catch (error) {
      console.error('Error checking CKYC:', error);
      res.status(500).json({ success: false, message: 'Failed to check CKYC' });
    }
  });

  // ============================================================================
  // KYC v2: Aadhaar OTP APIs (BE-KYC-004 standalone)
  // ============================================================================
  app.post("/api/kyc/aadhaar/otp/send", requireClientOrHigher, async (req: any, res) => {
    try {
      const { aadhaarNumber, sessionId } = req.body;
      if (!aadhaarNumber) {
        return res.status(400).json({ success: false, message: "Aadhaar number is required" });
      }

      if (!/^\d{12}$/.test(aadhaarNumber)) {
        return res.status(400).json({ success: false, message: "Invalid Aadhaar number format. Must be 12 digits." });
      }

      const userRole = req.user?.role || 'user';
      if (['agent', 'partner', 'sub_partner'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: "Aadhaar OTP can only be initiated by the customer directly.",
          blocked_by: 'agent_restriction',
        });
      }

      const isDemoMode = kycEnvironmentService.isSandbox();
      const last4Digits = aadhaarNumber.slice(-4);
      
      if (isDemoMode) {
        res.json({
          success: true,
          message: "Demo mode: Use fixed OTP 123456",
          data: {
            referenceId: `demo_ref_${Date.now()}`,
            maskedMobile: `XXXXXX${last4Digits}`,
            otpValidFor: 300,
            provider: 'demo',
            environment: 'sandbox',
            testOtp: '123456',
          }
        });
      } else {
        const result = await sandboxKYCService.generateAadhaarOTP(
          aadhaarNumber,
          'KYC verification for account opening'
        );
        console.log(`[KYC] Aadhaar OTP sent via Sandbox API for user ${req.user!.id}, ref: ${result.referenceId}`);
        
        if (sessionId) {
          const session = await storage.getKycVerificationSession(sessionId);
          if (session) {
            await storage.updateKycVerificationSession(sessionId, {
              stepStatus: {
                ...session.stepStatus as any,
                aadhaar_otp_sent: true,
                aadhaar_reference_id: result.referenceId,
              }
            });
          }
        }
        
        await kycOrchestratorService.logAuditEvent({
          userId: req.user!.id,
          action: 'AADHAAR_OTP_SENT',
          step: 'aadhaar_otp',
          details: { 
            maskedAadhaar: `XXXX-XXXX-${last4Digits}`, 
            provider: 'sandbox-aadhaar-okyc',
            referenceId: result.referenceId,
            endpoint: 'standalone',
          },
          performedBy: req.user!.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        });
        
        res.json({
          success: true,
          message: "OTP sent to Aadhaar-linked mobile number",
          data: {
            referenceId: result.referenceId,
            maskedMobile: `XXXXXX${last4Digits}`,
            otpValidFor: result.validFor,
            provider: 'sandbox-aadhaar-okyc',
            environment: 'production',
          }
        });
      }
    } catch (error: any) {
      console.error('Error sending Aadhaar OTP:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to send OTP' });
    }
  });

  app.post("/api/kyc/aadhaar/otp/verify", requireClientOrHigher, async (req: any, res) => {
    try {
      const { otp, sessionId, referenceId } = req.body;
      if (!otp) {
        return res.status(400).json({ success: false, message: "OTP is required" });
      }

      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({ success: false, message: "Invalid OTP format. Must be 6 digits." });
      }

      const isDemoMode = kycEnvironmentService.isSandbox();
      const userId = req.user!.id;

      if (isDemoMode) {
        if (otp !== '123456') {
          return res.status(400).json({ success: false, message: "Invalid OTP. In demo mode, use OTP: 123456" });
        }
        // Demo mode: persist verification so the status system reflects Aadhaar as done
        await db.update(schema.userProfiles)
          .set({ aadhaarVerifiedViaSmartKyc: true })
          .where(eq(schema.userProfiles.userId, userId));
        try {
          const existingVaultDemo = await db.select({ id: schema.kycVault.id })
            .from(schema.kycVault).where(eq(schema.kycVault.userId, userId)).limit(1);
          if (existingVaultDemo.length > 0) {
            await db.update(schema.kycVault)
              .set({ aadhaarVerifiedAt: new Date(), updatedAt: new Date() })
              .where(eq(schema.kycVault.userId, userId));
          } else {
            await db.insert(schema.kycVault)
              .values({ userId, aadhaarVerifiedAt: new Date(), source: 'demo', kycStatus: 'pending' });
          }
        } catch (demoVaultErr) {
          console.warn('[KYC] Failed to update kycVault for Aadhaar (demo):', demoVaultErr);
        }
        return res.json({
          success: true,
          message: "Aadhaar verified successfully",
          data: { verified: true, provider: 'demo', environment: 'sandbox' }
        });
      }
      
      let refId = referenceId;
      if (!refId && sessionId) {
        const session = await storage.getKycVerificationSession(sessionId);
        refId = (session?.stepStatus as any)?.aadhaar_reference_id;
      }
      
      if (!refId) {
        return res.status(400).json({ success: false, message: "No pending Aadhaar OTP request found. Please request a new OTP." });
      }
      
      const result = await sandboxKYCService.verifyAadhaarOTP(refId, otp);
      console.log(`[KYC] Aadhaar verified via Sandbox API for user ${userId}`);

      const standaloneProfileUpdate: any = {
        aadhaarVerifiedViaSmartKyc: true,
      };
      
      if (result.address) {
        const addr = result.address;
        const addressParts = [addr.house, addr.street, addr.landmark, addr.locality].filter(Boolean);
        standaloneProfileUpdate.address = addressParts.join(', ') || '';
        standaloneProfileUpdate.city = addr.district || addr.city || '';
        standaloneProfileUpdate.state = addr.state || '';
        standaloneProfileUpdate.pincode = addr.pincode || addr.zip || '';
        console.log(`[KYC] Address saved from Aadhaar eKYC for user ${userId}: ${standaloneProfileUpdate.city}, ${standaloneProfileUpdate.state} ${standaloneProfileUpdate.pincode}`);
      }
      
      await db.update(schema.userProfiles)
        .set(standaloneProfileUpdate)
        .where(eq(schema.userProfiles.userId, userId));

      // Persist to kycVault so upgrade notification service can detect Aadhaar completion
      try {
        const existingVaultStandalone = await db.select({ id: schema.kycVault.id })
          .from(schema.kycVault).where(eq(schema.kycVault.userId, userId)).limit(1);
        if (existingVaultStandalone.length > 0) {
          await db.update(schema.kycVault)
            .set({ aadhaarVerifiedAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.kycVault.userId, userId));
        } else {
          await db.insert(schema.kycVault)
            .values({ userId, aadhaarVerifiedAt: new Date(), source: 'sandbox', kycStatus: 'pending' });
        }
      } catch (vaultErrStandalone) {
        console.warn('[KYC] Failed to update kycVault for Aadhaar (standalone):', vaultErrStandalone);
      }

      await kycOrchestratorService.logAuditEvent({
        userId,
        action: 'AADHAAR_VERIFIED',
        step: 'aadhaar_otp',
        details: { 
          provider: 'sandbox-aadhaar-okyc',
          name: result.fullName,
          endpoint: 'standalone',
        },
        performedBy: userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: "Aadhaar verified successfully",
        data: { 
          verified: true, 
          provider: 'sandbox-aadhaar-okyc',
          environment: 'production',
          name: result.fullName,
          dob: result.dateOfBirth,
          gender: result.gender,
          address: result.address,
        }
      });
    } catch (error: any) {
      console.error('Error verifying Aadhaar OTP:', error);
      const message = error.message?.includes('Invalid OTP') 
        ? 'Invalid OTP. Please check and try again.'
        : error.message?.includes('expired')
        ? 'OTP has expired. Please request a new OTP.'
        : error.message || 'Failed to verify OTP';
      res.status(400).json({ success: false, message });
    }
  });

  // ============================================================================
  // KYC v2: Agent Prospect Shell (BE-KYC-007)
  // ============================================================================
  app.post("/api/agent/prospect", requireClientOrHigher, async (req: any, res) => {
    try {
      const agentId = req.user!.id;
      const userRole = req.user?.role || 'user';

      if (!['agent', 'partner', 'sub_partner', 'admin', 'superadmin'].includes(userRole)) {
        return res.status(403).json({ success: false, message: "Agent access required" });
      }

      const { firstName, lastName, email, mobile, panNumber, entityType } = req.body;

      if (!firstName || !lastName) {
        return res.status(400).json({ success: false, message: "First name and last name are required" });
      }

      const prospectId = `prospect_${nanoid(16)}`;

      let detectedEntity: string = entityType || 'individual';
      if (panNumber) {
        detectedEntity = kycOrchestratorService.detectEntityFromPAN(panNumber).toLowerCase();
      }

      const sessionExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const session = await storage.createKycVerificationSession({
        userId: prospectId,
        entityType: detectedEntity,
        targetLevel: '2',
        currentStep: panNumber ? 'ckyc_kra_check' : 'pan_verification',
        stepStatus: {
          pan_verified: !!panNumber,
          entity_locked: !!panNumber,
          ckyc_fetched: false,
          kra_verified: false,
          aadhaar_required: true,
          aadhaar_otp_sent: false,
          aadhaar_verified: false,
          risk_profiling: false,
          fatca_signed: false,
          compliance_signed: false,
          aml_screened: false,
          video_kyc_required: false,
        },
        expiresAt: sessionExpiresAt,
        panNumber: panNumber || undefined,
      });

      const customerKycLink = kycOrchestratorService.generateCustomerKycLink(session.id, prospectId);
      const agentAllowedSteps = kycOrchestratorService.getAgentAllowedSteps();

      await kycOrchestratorService.logAuditEvent({
        userId: prospectId,
        action: 'PROSPECT_CREATED',
        step: 'prospect_creation',
        details: { agentId, entityType: detectedEntity, consentMode: 'non_consent_shell' },
        performedBy: agentId,
      });

      res.json({
        success: true,
        data: {
          prospectId,
          sessionId: session.id,
          entityType: detectedEntity,
          currentStep: session.currentStep,
          customerKycLink,
          agentAllowedSteps,
          agentBlockedSteps: ['aadhaar_otp', 'aadhaar_otp_verify', 'fatca_signature', 'compliance_signoff'],
          message: "Prospect created. Customer must complete Aadhaar, FATCA, and sign-off steps.",
        }
      });
    } catch (error) {
      console.error('Error creating prospect:', error);
      res.status(500).json({ success: false, message: 'Failed to create prospect' });
    }
  });

  // ============================================================================
  // KYC v2: Session State Endpoint (enhanced)
  // ============================================================================
  app.get("/api/kyc/session/:id", requireClientOrHigher, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const session = await storage.getKycVerificationSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found" });
      }

      const initiatedBy = (session as any).initiatedBy || 'customer';
      const stepStatus = session.stepStatus as any || {};

      res.json({
        success: true,
        data: {
          kyc_session_id: session.id,
          user_id: session.userId,
          initiated_by: initiatedBy,
          entity_type: (session as any).entityType || 'INDIVIDUAL',
          current_step: session.currentStep,
          status: session.isActive ? 'IN_PROGRESS' : (session.completedAt ? 'COMPLETED' : 'EXPIRED'),
          step_status: stepStatus,
          expires_at: session.expiresAt,
          ckyc_confidence_score: (session as any).ckycConfidenceScore || null,
          ckyc_missing_fields: (session as any).ckycMissingFields || [],
          aadhaar_required: (session as any).aadhaarRequired ?? true,
          aml_risk_level: (session as any).amlRiskLevel || null,
          video_kyc_required: (session as any).videoKycRequired || false,
          agent_blocked_steps: initiatedBy === 'agent' ? ['aadhaar_otp', 'aadhaar_otp_verify', 'fatca_signature', 'compliance_signoff'] : [],
        }
      });
    } catch (error) {
      console.error('Error fetching KYC session:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch session' });
    }
  });

  // ============================================================================
  // KYC v2: Step Transition (PATCH) (BE-KYC-001)
  // ============================================================================
  app.patch("/api/kyc/session/:id/step", requireClientOrHigher, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const { step, data: stepData } = req.body;

      const session = await storage.getKycVerificationSession(sessionId);
      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found" });
      }

      const initiatedBy = (session as any).initiatedBy || 'customer';
      
      if (kycOrchestratorService.isAgentBlocked(step, initiatedBy)) {
        return res.status(403).json({
          success: false,
          message: `Step '${step}' is blocked for agents. Customer must complete this step.`,
          blocked_by: 'agent_restriction',
        });
      }

      if (!kycOrchestratorService.canResumeStep(session.currentStep as any, step)) {
        return res.status(400).json({
          success: false,
          message: `Cannot skip to step '${step}'. Current step is '${session.currentStep}'.`,
          current_step: session.currentStep,
        });
      }

      await storage.updateKycVerificationSession(sessionId, {
        currentStep: step,
        ...(stepData || {}),
      });

      await kycOrchestratorService.logAuditEvent({
        userId: session.userId || '',
        action: 'STEP_TRANSITION',
        step,
        details: { from: session.currentStep, to: step },
        performedBy: req.user!.id,
      });

      res.json({
        success: true,
        data: { previousStep: session.currentStep, currentStep: step }
      });
    } catch (error) {
      console.error('Error transitioning step:', error);
      res.status(500).json({ success: false, message: 'Failed to transition step' });
    }
  });

  // ============================================================================
  // KYC v2: Session Completion (BE-KYC-001)
  // ============================================================================
}
