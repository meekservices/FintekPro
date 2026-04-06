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

export function registerKYCWizardPart1Routes(app: Express) {
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
  app.get("/api/kyc/my-compliance-status", requireAuth, async (req: any, res) => {
    try {
      const user = req.user;
      const userRoles: string[] = user.roles || (user.role ? [user.role] : ['user']);

      const status = await getComplianceStatus(user);

      // Build role-specific guidance message
      let guidanceMessage = 'Complete your KYC verification to access FintekPro.';
      if (userRoles.some(r => ['master_agent', 'partner'].includes(r))) {
        guidanceMessage =
          'As a distribution partner, you must complete Full KYC (Level 2) including ' +
          'CKYC registration and Video KYC before managing client investments. ' +
          'Regulatory basis: SEBI KRA Regulations + AMFI Circular on ARN holders.';
      } else if (userRoles.some(r => ['agent', 'sub_agent', 'associate'].includes(r))) {
        guidanceMessage =
          'As a registered agent, AMFI/IRDAI requires Standard KYC (PAN + Address OVD) ' +
          'before you can solicit or distribute any financial products.';
      } else if (userRoles.some(r => ['compliance_officer', 'regulatory_auditor'].includes(r))) {
        guidanceMessage =
          'Compliance and audit personnel must complete Full KYC under SEBI regulations ' +
          'to maintain audit trail integrity and regulatory standing.';
      } else if (userRoles.some(r => ['admin', 'superadmin', 'bd_head', 'finance_head', 'ops_head', 'hr_head', 'tech_head'].includes(r))) {
        guidanceMessage =
          'All FintekPro personnel must complete Standard KYC under PMLA 2002, ' +
          'Section 12, which requires reporting entities to maintain verified ' +
          'identity records for all associated persons.';
      } else if (userRoles.some(r => ['client', 'user', 'business_client'].includes(r))) {
        guidanceMessage =
          'Standard KYC (PAN verification + Address proof) is required under the ' +
          'RBI Master Direction on KYC 2016 before accessing any financial products.';
      }

      res.json({
        compliant: status.compliant,
        currentLevel: status.currentLevel,
        requiredLevel: status.requiredLevel,
        missingRequirements: status.missingRequirements,
        regulatoryBasis: status.regulatoryBasis,
        guidanceMessage,
        roles: userRoles,
        redirectTo: '/profile?tab=kyc-dashboard',
        roleLevelMap: ROLE_KYC_MINIMUM,
      });
    } catch (err: any) {
      console.error('[KYC compliance-status] Error:', err.message);
      res.status(500).json({ error: 'Failed to check KYC compliance status' });
    }
  });

  app.get("/api/kyc/sandbox-info", requireClientOrHigher, async (_req: any, res) => {
    const env = getSandboxEnvironment();
    const envInfo = sandboxPANService.getEnvironmentInfo();
    res.json({
      isTestEnvironment: env === 'TEST',
      hasCredentials: envInfo.hasCredentials,
      testPANs: env === 'TEST' ? [
        { pan: 'XXXPX1234A', description: 'Individual, Valid, Name & DOB match' },
        { pan: 'XXXPX1234H', description: 'Individual, Valid, Deceased' },
        { pan: 'XXXPX1234O', description: 'Individual, Valid, Name match, DOB mismatch' },
        { pan: 'XXXPX1234L', description: 'Individual, Valid, Name & DOB unmatched' },
        { pan: 'XXXTX1234P', description: 'Trust, Valid, Liquidated' },
        { pan: 'XXXCX1234B', description: 'Company, Valid, Merged' },
        { pan: 'XXXAX2345A', description: 'AOP, Valid' },
        { pan: 'XXXBX3456B', description: 'BOI, Valid' },
        { pan: 'XXXFX1234J', description: 'Firm, Invalid, Deleted' },
      ] : []
    });
  });

  app.get("/api/kyc/status", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const products = await getAccessibleProducts(userId);
      const { level, profile } = await getUserKYCLevel(userId);
      
      const tierResult = kycOrchestratorService.computeTierResult({
        kycLevel: parseInt(level, 10),
        panVerified: profile?.panVerifiedViaSandbox || false,
        ckycFetched: profile?.ckycFetchedViaAuthBridge || false,
        aadhaarVerified: profile?.aadhaarVerifiedViaSmartKyc || false,
        riskProfilingDone: profile?.isProfileCompleted || false,
        complianceSigned: profile?.isProfileCompleted || false,
        amlScreened: !!(profile as any)?.amlScreenedAt,
        amlRiskLevel: (profile as any)?.amlRiskLevel,
        videoKycDone: !!(profile as any)?.videoKycCompletedAt,
      });

      res.json({
        success: true,
        data: {
          kycLevel: level,
          kycLevelName: level === '0' ? 'Basic Profile' : level === '1' ? 'PAN Verified' : 'Full KYC',
          kycTier: tierResult.kyc_tier,
          tierStatus: tierResult.tier_status,
          accessibleProducts: products.accessibleProducts,
          blockedProducts: products.blockedProducts,
          productsUnlocked: tierResult.products_unlocked,
          productsLocked: tierResult.products_locked,
          upgradeActions: tierResult.upgrade_actions,
          canAccessLoans: level >= '1',
          canAccessInsurance: level >= '1',
          canAccessInvestments: level >= '2' && tierResult.tier_status === 'final',
          nextAction: level === '0' ? 'Complete PAN verification' : level === '1' ? 'Complete full KYC' : null,
          profile: {
            panVerified: profile?.panVerifiedViaSandbox || false,
            ckycFetched: profile?.ckycFetchedViaAuthBridge || false,
            kraVerified: profile?.kraVerifiedViaProtean || false,
            amlRiskLevel: (profile as any)?.amlRiskLevel || null,
            videoKycRequired: (profile as any)?.videoKycRequired || false,
            entityTypeLocked: (profile as any)?.entityTypeLocked || false,
          }
        }
      });
    } catch (error) {
      console.error('KYC status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch KYC status'
      });
    }
  });

  app.get("/api/kyc/my-profile", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { level, profile } = await getUserKYCLevel(userId);
      const user = req.user;
      
      if (!profile) {
        return res.json({
          success: true,
          data: {
            userId: user.userId || user.id,
            email: user.email,
            mobile: user.mobile,
            fullName: `${user.firstName || ''} ${user.middleName || ''} ${user.lastName || ''}`.trim(),
            kycLevel: level,
            kycTier: level === '0' ? 'basic' : level === '1' ? 'enhanced' : 'accredited_investor',
            kycStatus: 'pending',
            panNumber: null,
            panVerified: false,
            aadhaarVerified: false,
            bankVerified: false,
            videoKycCompleted: false,
            ckycVerified: false,
            riskCategory: 'low',
            pepStatus: 'N',
            fatcaStatus: 'N',
            amlStatus: 'clear',
            kycTierMetadata: {
              description: 'Basic profile - browse products only',
              productsUnlocked: [],
              maxAnnualInvestment: 0
            }
          }
        });
      }
      
      res.json({
        success: true,
        data: {
          userId: user.userId || user.id,
          email: user.email,
          mobile: user.mobile,
          fullName: `${user.firstName || ''} ${user.middleName || ''} ${user.lastName || ''}`.trim(),
          kycLevel: level,
          kycTier: level === '0' ? 'basic' : level === '1' ? 'enhanced' : 'accredited_investor',
          kycStatus: profile.kycStatus || 'pending',
          panNumber: profile.panNumber || null,
          panVerified: profile.panVerifiedViaSandbox || false,
          aadhaarVerified: profile.aadhaarVerifiedViaCashfree || false,
          bankVerified: profile.bankVerified || false,
          videoKycCompleted: profile.videoKycCompleted || false,
          ckycVerified: profile.ckycFetchedViaAuthBridge || false,
          riskCategory: profile.riskCategory || 'low',
          pepStatus: profile.pepStatus || 'N',
          fatcaStatus: profile.fatcaStatus || 'N',
          amlStatus: profile.amlStatus || 'clear',
          entityType: (profile as any).entityType || null,
          entityTypeLocked: (profile as any).entityTypeLocked || false,
          amlRiskLevel: (profile as any).amlRiskLevel || null,
          kycTierStatus: (profile as any).kycTierStatus || null,
          kycTierMetadata: {
            description: level === '0' 
              ? 'Basic profile - browse products only' 
              : level === '1' 
                ? 'PAN Verified - access loans and insurance' 
                : 'Full KYC - access all investment products',
            productsUnlocked: level === '0' 
              ? [] 
              : level === '1' 
                ? ['loans', 'insurance'] 
                : ['mutual_funds', 'stocks', 'bonds', 'ipos', 'aif_pms', 'loans', 'insurance'],
            maxAnnualInvestment: level === '0' ? 0 : level === '1' ? 50000 : 10000000
          }
        }
      });
    } catch (error) {
      console.error('KYC profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch KYC profile'
      });
    }
  });

  app.post("/api/kyc/wizard/start", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { entityType, targetLevel, forceNew } = req.body;
      
      // Check if KYC is already fully completed (kycLevel='2')
      const existingProfile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const existingUserProfile = existingProfile[0];
      
      if (existingUserProfile?.kycLevel === '2' && existingUserProfile?.isProfileCompleted) {
        return res.json({
          success: true,
          alreadyCompleted: true,
          data: {
            sessionId: null,
            currentStep: 'completed',
            stepStatus: {
              pan_verified: true,
              aadhaar_verified: true,
              ckyc_fetched: true,
              kra_verified: true,
              risk_profiling: true,
              compliance_signed: true
            },
            isResumed: false
          }
        });
      }

      // Check for existing active session (includes expiry check)
      let existingSession: any = null;
      try {
        existingSession = await storage.getActiveKycSession(userId);
      } catch (sessionErr) {
        console.warn('[KYC Wizard] Error fetching active session, will attempt cleanup:', sessionErr);
      }

      if (existingSession && !forceNew) {
        // Reconcile session's currentStep with the user's actual verified profile state.
        // A session can be stuck at an earlier step if the user completed a verification
        // outside the wizard (e.g. DigiLocker callback, previous session, agent-assisted).
        let reconciledStep: string = existingSession.currentStep;
        let reconciledStatus: any = { ...(existingSession.stepStatus as any) };

        const profile = existingUserProfile;
        if (profile) {
          if ((profile.panVerifiedViaSandbox || profile.panSandboxStatus === 'VALID') && !reconciledStatus.pan_verified) {
            reconciledStatus.pan_verified = true;
            if (reconciledStep === 'pan_verification') reconciledStep = 'ckyc_kra_check';
          }
          if ((profile.ckycFetchedViaAuthBridge || profile.ckycAuthBridgeStatus === 'found') && !reconciledStatus.ckyc_fetched) {
            reconciledStatus.ckyc_fetched = true;
            reconciledStatus.kra_verified = true;
            if (['pan_verification', 'ckyc_kra_check', 'aadhaar_otp', 'aadhaar_otp_verify'].includes(reconciledStep)) {
              reconciledStep = 'risk_profiling';
            }
          } else if (profile.aadhaarVerifiedViaSmartKyc && !reconciledStatus.aadhaar_verified) {
            reconciledStatus.aadhaar_verified = true;
            reconciledStatus.aadhaar_otp_sent = true;
            if (['pan_verification', 'ckyc_kra_check', 'aadhaar_otp', 'aadhaar_otp_verify'].includes(reconciledStep)) {
              reconciledStep = 'risk_profiling';
            }
          }
        }

        // Persist the reconciled step back to DB so next reload is also correct
        if (reconciledStep !== existingSession.currentStep) {
          console.log(`[KYC Wizard] Reconciled session ${existingSession.id}: ${existingSession.currentStep} → ${reconciledStep}`);
          try {
            await storage.updateKycVerificationSession(existingSession.id, {
              currentStep: reconciledStep,
              stepStatus: reconciledStatus,
            });
          } catch (reconcileErr) {
            console.warn('[KYC Wizard] Failed to persist reconciled step:', reconcileErr);
          }
        }

        return res.json({
          success: true,
          data: {
            sessionId: existingSession.id,
            currentStep: reconciledStep,
            stepStatus: reconciledStatus,
            expiresAt: existingSession.expiresAt,
            isResumed: true,
            panVerified: reconciledStatus.pan_verified,
            panVerificationData: existingSession.panVerificationData,
            panNumber: existingSession.panNumber,
            aadhaarOtpSent: reconciledStatus.aadhaar_otp_sent,
            aadhaarVerified: existingSession.aadhaarVerified || reconciledStatus.aadhaar_verified,
            aadhaarVerificationData: existingSession.aadhaarVerificationData
          }
        });
      }
      
      // Always deactivate any stale/expired sessions before creating a new one
      // This handles cases where is_active=true but expiresAt has passed
      try {
        await db.update(schema.kycVerificationSessions)
          .set({ isActive: false, completedAt: new Date() })
          .where(
            and(
              eq(schema.kycVerificationSessions.userId, userId),
              eq(schema.kycVerificationSessions.isActive, true)
            )
          );
      } catch (expireErr) {
        console.warn('[KYC Wizard] Error deactivating old sessions:', expireErr);
      }
      
      // Check user's existing KYC profile to determine starting step
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const userProfile = profile[0];
      
      // Determine initial step and status based on existing verified data
      let initialStep = 'pan_verification';
      let stepStatus = {
        pan_verified: false,
        aadhaar_otp_sent: false,
        aadhaar_verified: false,
        ckyc_fetched: false,
        kra_verified: false,
        risk_profiling: false,
        compliance_signed: false
      };
      
      // Regulatory flow: PAN → CKYC/KRA Check → Aadhaar (if needed) → Risk Profiling → Compliance
      // Per RBI Master Direction on KYC (2016, amended 2024) & SEBI KRA Regulations
      if (userProfile?.panVerifiedViaSandbox || userProfile?.panSandboxStatus === 'VALID') {
        stepStatus.pan_verified = true;
        initialStep = 'ckyc_kra_check'; // Check CKYC/KRA first per data minimization
        
        if (userProfile?.ckycFetchedViaAuthBridge || userProfile?.ckycAuthBridgeStatus === 'found') {
          stepStatus.ckyc_fetched = true;
          stepStatus.kra_verified = true;
          initialStep = 'risk_profiling'; // CKYC found, skip Aadhaar
        } else if (userProfile?.aadhaarVerifiedViaSmartKyc) {
          stepStatus.aadhaar_verified = true;
          initialStep = 'risk_profiling';
        }
        
        if (userProfile?.isProfileCompleted && stepStatus.ckyc_fetched) {
          initialStep = 'compliance_signoff';
        }
      }
      
      const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      let session: any;
      try {
        session = await storage.createKycVerificationSession({
          userId,
          entityType: entityType || 'individual',
          targetLevel: targetLevel || '2',
          currentStep: initialStep,
          stepStatus,
          expiresAt: sessionExpiresAt,
          panNumber: userProfile?.panNumber || undefined,
          panVerificationData: userProfile?.panSandboxResponse || undefined
        });
      } catch (createErr: any) {
        if (createErr?.code === '23505') {
          // Duplicate key - deactivate all active sessions and retry once
          await db.update(schema.kycVerificationSessions)
            .set({ isActive: false, completedAt: new Date() })
            .where(
              and(
                eq(schema.kycVerificationSessions.userId, userId),
                eq(schema.kycVerificationSessions.isActive, true)
              )
            );
          session = await storage.createKycVerificationSession({
            userId,
            entityType: entityType || 'individual',
            targetLevel: targetLevel || '2',
            currentStep: initialStep,
            stepStatus,
            expiresAt: sessionExpiresAt,
            panNumber: userProfile?.panNumber || undefined,
            panVerificationData: userProfile?.panSandboxResponse || undefined
          });
        } else {
          throw createErr;
        }
      }
      
      res.json({
        success: true,
        data: {
          sessionId: session.id,
          currentStep: session.currentStep,
          stepStatus: session.stepStatus,
          expiresAt: session.expiresAt || sessionExpiresAt,
          isResumed: false,
          existingKycData: {
            panVerified: stepStatus.pan_verified,
            ckycVerified: stepStatus.ckyc_fetched,
            panNumber: userProfile?.panNumber,
            fullName: userProfile?.firstName ? `${userProfile.firstName} ${userProfile.lastName || ''}`.trim() : null
          }
        }
      });
    } catch (error) {
      console.error('Error starting KYC wizard:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start KYC wizard'
      });
    }
  });

  app.get("/api/kyc/wizard/session", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { sessionId } = req.query;
      
      const session = sessionId 
        ? await storage.getKycVerificationSession(sessionId as string)
        : await storage.getActiveKycSession(userId);
      
      if (!session || session.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: 'No active KYC session found'
        });
      }
      
      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('Error fetching KYC session:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch KYC session'
      });
    }
  });

  app.post("/api/kyc/wizard/verify-pan", requireClientOrHigher, async (req: any, res) => {
    try {
      const { sessionId, panNumber, dob, fullName } = req.body;
      const userId = req.user!.id;
      
      if (!sessionId || !panNumber || !dob) {
        return res.status(400).json({
          success: false,
          message: "Session ID, PAN number, and date of birth are required"
        });
      }
      
      const session = await storage.getKycVerificationSession(sessionId);
      
      if (!session || session.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: "Invalid session"
        });
      }
      
      let verification;
      try {
        verification = await sandboxPANService.verifyPAN(panNumber, fullName, dob);
      } catch (verifyError: any) {
        const isTest = getSandboxEnvironment() === 'TEST';
        const errMsg = verifyError?.message || 'PAN verification failed';
        const testHint = isTest ? ' In TEST environment, use test PANs like XXXPX1234A.' : '';
        return res.json({
          success: false,
          message: errMsg + testHint,
          isTestEnvironment: isTest
        });
      }
      
      if (!verification || verification.status !== 'success' || !verification.data) {
        return res.json({
          success: false,
          message: verification?.message || "PAN verification failed"
        });
      }
      
      const panResult = await kycOrchestratorService.buildPanVerificationResult(
        panNumber,
        verification.data,
        req.user?.role || 'user'
      );

      // ── T001: Duplicate PAN guard ──────────────────────────────────────────
      // SEBI requires one PAN = one investor identity. Reject if another
      // verified account already holds this PAN.
      try {
        const duplicatePAN = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(
            and(
              eq(schema.users.panNumber, panNumber.toUpperCase()),
              eq(schema.users.panVerifiedViaSmartKyc, true),
              ne(schema.users.id, userId)
            )
          )
          .limit(1);
        if (duplicatePAN.length > 0) {
          return res.status(409).json({
            success: false,
            code: 'DUPLICATE_PAN',
            message:
              'This PAN is already verified under another account. SEBI requires one PAN per investor. If this is an error, please contact support.',
          });
        }
      } catch (dupErr) {
        console.warn('[KYC] Duplicate PAN check failed (non-fatal):', (dupErr as any)?.message);
      }
      // ──────────────────────────────────────────────────────────────────────

      await storage.updateKycVerificationSession(sessionId, {
        panNumber: await PANConsentService.encryptPAN(panNumber),
        panDob: new Date(dob),
        panVerified: true,
        panVerificationData: {
          name: verification.data.full_name || fullName,
          fatherName: verification.data.father_name
        },
        panVerifiedAt: new Date(),
        currentStep: "ckyc_kra_check",
        entityType: panResult.entity_detected,
        entityLocked: true,
        stepStatus: {
          pan_verified: true,
          entity_locked: true,
          ckyc_fetched: false,
          kra_verified: false,
          aadhaar_otp_sent: false,
          aadhaar_verified: false,
          risk_profiling: false,
          compliance_signed: false,
          aml_screened: false,
        }
      });
      
      const existingProfile = await db.select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId))
        .limit(1);
      
      const profileUpdate: any = {
        kycLevel: '1',
        kycLevelUpgradedAt: new Date(),
        panVerifiedViaSandbox: true,
        panSandboxVerifiedAt: new Date(),
        panSandboxResponse: verification.data,
        panSandboxStatus: verification.data?.status || 'VALID',
        panNumber: panNumber,
        entityType: panResult.entity_detected.toLowerCase(),
        entityTypeLocked: true,
        entityTypeLockedAt: new Date(),
      };
      
      if (existingProfile && existingProfile.length > 0) {
        await db.update(schema.userProfiles)
          .set(profileUpdate)
          .where(eq(schema.userProfiles.userId, userId));
      } else {
        await db.insert(schema.userProfiles)
          .values({ userId, ...profileUpdate });
      }
      
      try {
        const existingVault = await db.select({ id: schema.kycVault.id })
          .from(schema.kycVault)
          .where(eq(schema.kycVault.userId, userId))
          .limit(1);
        if (existingVault.length > 0) {
          await db.update(schema.kycVault)
            .set({ panVerifiedAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.kycVault.userId, userId));
        } else {
          await db.insert(schema.kycVault)
            .values({ userId, panVerifiedAt: new Date(), source: 'sandbox', kycStatus: 'pending' });
        }
      } catch (vaultErr) {
        console.warn('[KYC] Failed to update kycVault for PAN:', vaultErr);
      }

      // Invalidate universal KYC compliance cache — PAN verification changes KYC level
      try {
        const { invalidateComplianceCache } = await import('../../middleware/universal-kyc-gate');
        invalidateComplianceCache(userId);
      } catch { /* non-fatal */ }

      await kycOrchestratorService.logAuditEvent({
        userId,
        action: 'PAN_VERIFIED',
        step: 'pan_verification',
        details: { entity_detected: panResult.entity_detected, source: 'sandbox' },
        performedBy: userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      
      res.json({
        success: true,
        data: {
          name: verification.data.full_name || fullName,
          fatherName: verification.data.father_name,
          pan_valid: panResult.pan_valid,
          entity_detected: panResult.entity_detected,
          entity_locked: panResult.entity_locked,
          override_allowed: panResult.override_allowed,
          source: 'sandbox',
        },
        message: "PAN verified. You can now access loans and insurance marketplace."
      });
    } catch (error) {
      console.error('Error verifying PAN:', error);
      
      if (error instanceof Error) {
        const errorMessage = error.message;
        
        if (errorMessage.includes('Authentication failed') || errorMessage.includes('credentials')) {
          return res.status(500).json({
            success: false,
            message: 'PAN verification service is not configured. Please contact support.'
          });
        }
        
        if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
          return res.status(429).json({
            success: false,
            message: 'Too many verification attempts. Please try again later.'
          });
        }
      }
      
      res.status(500).json({
        success: false,
        message: 'PAN verification failed. Please try again.'
      });
    }
  });

}
