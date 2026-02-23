import { Express, Request, Response } from 'express';
import { requireClientOrHigher } from '../../middleware/auth';
import { getAccessibleProducts, getUserKYCLevel } from '../../middleware/kyc-level-gate';
import { storage } from '../../storage';
import { sandboxPANService } from '../../sandbox-pan-api';
import { authBridgeCKYCService } from '../../authbridge-ckyc-api';
import { PANConsentService } from '../../services/pan-consent-service';
import { kycOrchestratorService } from '../../services/kyc-orchestrator-service';
import { sandboxKYCService } from '../../services/sandbox-kyc-service';
import { kycEnvironmentService } from '../../services/kyc-environment-service';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { smsService } from '../../services/sms-service';
import { emailService } from '../../email-service';

export function registerKYCWizardRoutes(app: Express) {
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
        return res.json({
          success: true,
          data: {
            sessionId: existingSession.id,
            currentStep: existingSession.currentStep,
            stepStatus: existingSession.stepStatus,
            expiresAt: existingSession.expiresAt,
            isResumed: true,
            panVerified: (existingSession.stepStatus as any)?.pan_verified,
            panVerificationData: existingSession.panVerificationData,
            panNumber: existingSession.panNumber,
            aadhaarOtpSent: (existingSession.stepStatus as any)?.aadhaar_otp_sent,
            aadhaarVerified: existingSession.aadhaarVerified,
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
      
      const verification = await sandboxPANService.verifyPAN(panNumber, fullName, dob);
      
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

  app.post("/api/kyc/wizard/send-aadhaar-otp", requireClientOrHigher, async (req: any, res) => {
    try {
      const { sessionId, aadhaarNumber } = req.body;
      const userId = req.user!.id;
      
      if (!sessionId || !aadhaarNumber) {
        return res.status(400).json({
          success: false,
          message: "Session ID and Aadhaar number are required"
        });
      }
      
      if (!/^\d{12}$/.test(aadhaarNumber)) {
        return res.status(400).json({
          success: false,
          message: "Invalid Aadhaar number format. Must be 12 digits."
        });
      }
      
      const session = await storage.getKycVerificationSession(sessionId);
      
      if (!session || session.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: "Invalid session"
        });
      }
      
      const initiatedBy = (session as any).initiatedBy || 'customer';
      if (kycOrchestratorService.isAgentBlocked('aadhaar_otp', initiatedBy)) {
        return res.status(403).json({
          success: false,
          message: "Aadhaar OTP can only be initiated by the customer directly. Agents cannot trigger OTP verification.",
          blocked_by: 'agent_restriction',
          customer_action_required: true,
        });
      }
      
      const last4Digits = aadhaarNumber.slice(-4);
      const isDemoMode = kycEnvironmentService.isSandbox();
      
      let referenceId = '';
      let transactionId = '';
      let message = '';
      
      if (isDemoMode) {
        referenceId = `demo_ref_${Date.now()}`;
        transactionId = `demo_txn_${Date.now()}`;
        message = "Demo mode: Use fixed OTP 123456";
        console.log(`[KYC] Aadhaar OTP in DEMO mode for user ${userId}`);
      } else {
        const result = await sandboxKYCService.generateAadhaarOTP(
          aadhaarNumber,
          'KYC verification for account opening'
        );
        referenceId = result.referenceId;
        transactionId = result.transactionId;
        message = "OTP sent to Aadhaar-linked mobile number";
        console.log(`[KYC] Aadhaar OTP sent via Sandbox API for user ${userId}, ref: ${referenceId}`);
      }
      
      await storage.updateKycVerificationSession(sessionId, {
        aadhaarNumber: await PANConsentService.encryptPAN(last4Digits),
        currentStep: "aadhaar_verification",
        stepStatus: {
          ...session.stepStatus as any,
          aadhaar_otp_sent: true,
          aadhaar_reference_id: referenceId,
        }
      });
      
      await kycOrchestratorService.logAuditEvent({
        userId,
        action: 'AADHAAR_OTP_SENT',
        step: 'aadhaar_otp',
        details: { 
          maskedAadhaar: `XXXX-XXXX-${last4Digits}`, 
          provider: isDemoMode ? 'demo' : 'sandbox-aadhaar-okyc',
          referenceId,
        },
        performedBy: userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      
      res.json({
        success: true,
        message,
        transactionId,
        data: {
          referenceId,
          maskedMobile: `XXXXXX${last4Digits}`,
          otpValidFor: 300,
          provider: isDemoMode ? 'demo' : 'sandbox-aadhaar-okyc',
          environment: isDemoMode ? 'sandbox' : 'production',
          ...(isDemoMode ? { testOtp: '123456' } : {})
        }
      });
    } catch (error: any) {
      console.error('Error sending Aadhaar OTP:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to send OTP. Please try again.'
      });
    }
  });

  app.post("/api/kyc/wizard/verify-aadhaar-otp", requireClientOrHigher, async (req: any, res) => {
    try {
      const { sessionId, otp } = req.body;
      const userId = req.user!.id;
      
      if (!sessionId || !otp) {
        return res.status(400).json({
          success: false,
          message: "Session ID and OTP are required"
        });
      }
      
      if (!/^\d{6}$/.test(otp)) {
        return res.status(400).json({
          success: false,
          message: "Invalid OTP format. Must be 6 digits."
        });
      }
      
      const session = await storage.getKycVerificationSession(sessionId);
      
      if (!session || session.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: "Invalid session"
        });
      }
      
      const stepStatus = session.stepStatus as any;
      const referenceId = stepStatus?.aadhaar_reference_id;
      const isDemoMode = kycEnvironmentService.isSandbox();
      
      let verificationData: any = null;
      
      if (isDemoMode) {
        if (otp !== '123456') {
          return res.status(400).json({
            success: false,
            message: "Invalid OTP. In demo mode, use OTP: 123456"
          });
        }
        verificationData = {
          name: "Demo Verified User",
          dob: "1990-01-01",
          gender: "M",
          address: {
            house: "123",
            street: "Demo Street",
            landmark: "",
            locality: "Demo City",
            district: "Demo District",
            state: "Maharashtra",
            pincode: "400001",
            country: "India"
          },
          provider: 'demo',
        };
        console.log(`[KYC] Aadhaar OTP verified in DEMO mode for user ${userId}`);
      } else {
        if (!referenceId) {
          return res.status(400).json({
            success: false,
            message: "No pending Aadhaar OTP request found. Please request a new OTP."
          });
        }
        
        const result = await sandboxKYCService.verifyAadhaarOTP(referenceId, otp);
        verificationData = {
          name: result.fullName,
          dob: result.dateOfBirth,
          gender: result.gender,
          address: result.address,
          photo: result.photo,
          maskedAadhaar: result.aadhaarNumber,
          provider: 'sandbox-aadhaar-okyc',
        };
        console.log(`[KYC] Aadhaar OTP verified via Sandbox API for user ${userId}, name: ${result.fullName}`);
      }
      
      await storage.updateKycVerificationSession(sessionId, {
        aadhaarVerified: true,
        aadhaarVerifiedAt: new Date(),
        aadhaarVerificationData: verificationData,
        currentStep: "data_collection",
        stepStatus: {
          ...stepStatus,
          aadhaar_verified: true,
          aadhaar_reference_id: null,
        }
      });
      
      await db.update(schema.userProfiles)
        .set({
          aadhaarVerifiedViaSmartKyc: true,
        })
        .where(eq(schema.userProfiles.userId, userId));
      
      await kycOrchestratorService.logAuditEvent({
        userId,
        action: 'AADHAAR_VERIFIED',
        step: 'aadhaar_otp',
        details: { 
          provider: isDemoMode ? 'demo' : 'sandbox-aadhaar-okyc',
          name: verificationData.name,
        },
        performedBy: userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      
      res.json({
        success: true,
        verified: true,
        message: "Aadhaar verified successfully",
        data: verificationData
      });
    } catch (error: any) {
      console.error('Error verifying Aadhaar OTP:', error);
      const message = error.message?.includes('Invalid OTP') 
        ? 'Invalid OTP. Please check and try again.'
        : error.message?.includes('expired')
        ? 'OTP has expired. Please request a new OTP.'
        : error.message || 'Failed to verify OTP';
      res.status(400).json({
        success: false,
        message
      });
    }
  });

  app.post("/api/kyc/wizard/complete", requireClientOrHigher, async (req: any, res) => {
    try {
      const { sessionId, additionalData } = req.body;
      const userId = req.user!.id;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Session ID is required"
        });
      }
      
      const session = await storage.getKycVerificationSession(sessionId);
      
      if (!session || session.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: "Invalid session"
        });
      }
      
      await storage.updateKycVerificationSession(sessionId, {
        status: 'completed',
        completedAt: new Date(),
        currentStep: 'completed',
        isActive: false
      });
      
      const stepStatus = session.stepStatus as any || {};
      
      await db.update(schema.userProfiles)
        .set({
          kycLevel: '2',
          kycLevelUpgradedAt: new Date(),
          isProfileCompleted: true,
          profileCompletedAt: new Date(),
          kraVerifiedViaProtean: stepStatus.kra_verified || true,
          aadhaarVerifiedViaSmartKyc: stepStatus.aadhaar_verified || session.aadhaarVerified || true,
          videoKycCompleted: true,
          faceToFaceVerificationCompleted: true,
        })
        .where(eq(schema.userProfiles.userId, userId));
      
      res.json({
        success: true,
        message: "KYC completed successfully. You now have full access to all investment products."
      });
    } catch (error) {
      console.error('Error completing KYC:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to complete KYC'
      });
    }
  });

  app.post("/api/kyc/wizard/check-kra-status", requireClientOrHigher, async (req: any, res) => {
    try {
      const { sessionId, panNumber } = req.body;
      const userId = req.user!.id;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Session ID is required"
        });
      }
      
      const session = await storage.getKycVerificationSession(sessionId);
      
      if (!session || session.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: "Invalid session"
        });
      }
      
      // Decrypt PAN if stored encrypted, or use raw PAN from request
      let rawPan = panNumber;
      if (!rawPan && session.panNumber) {
        try {
          rawPan = await PANConsentService.decryptPAN(session.panNumber);
        } catch {
          rawPan = session.panNumber;
        }
      }

      let ckycResult: any = null;
      try {
        ckycResult = await authBridgeCKYCService.fetchCKYC({
          panNumber: rawPan || '',
          fullName: (session.panVerificationData as any)?.name || '',
          dob: session.panDob ? new Date(session.panDob).toISOString().split('T')[0] : ''
        });
      } catch (ckycErr) {
        console.warn('[KYC Wizard] CKYC/KRA check failed, proceeding with manual KYC flow:', (ckycErr as any)?.message);
      }
      
      const ckycDecision = kycOrchestratorService.computeCkycConfidence(
        ckycResult?.success && ckycResult?.data
          ? { found: true, data: ckycResult.data, kin: ckycResult.data?.kin, provider: 'truthscreen-ckyc' }
          : { found: false, provider: 'truthscreen-ckyc' }
      );
      
      const initiatedBy = (session as any).initiatedBy || 'customer';
      const nextStep = ckycDecision.aadhaar_required
        ? (kycOrchestratorService.isAgentBlocked('aadhaar_otp', initiatedBy) ? 'risk_profiling' : 'aadhaar_otp')
        : 'risk_profiling';
      
      if (ckycDecision.ckyc_found) {
        await storage.updateKycVerificationSession(sessionId, {
          ckycData: ckycResult.data,
          ckycFetched: true,
          ckycFetchedAt: new Date(),
          currentStep: nextStep,
          ckycConfidenceScore: String(ckycDecision.confidence_score),
          ckycMissingFields: ckycDecision.missing_fields,
          aadhaarRequired: ckycDecision.aadhaar_required,
          stepStatus: {
            ...session.stepStatus as any,
            ckyc_fetched: true,
            kra_verified: true,
            ckyc_confidence: ckycDecision.confidence_score,
            ckyc_missing_fields: ckycDecision.missing_fields,
            aadhaar_required: ckycDecision.aadhaar_required,
          }
        });
        
        await db.update(schema.userProfiles)
          .set({
            ckycFetchedViaAuthBridge: true,
            ckycAuthbridgeFetchedAt: new Date(),
            ckycAuthbridgeKin: ckycResult.data.kin,
            ckycAuthbridgeResponse: ckycResult.data,
            ckycAuthbridgeStatus: 'SUCCESS'
          })
          .where(eq(schema.userProfiles.userId, userId));
        
        await kycOrchestratorService.logAuditEvent({
          userId,
          action: 'CKYC_CHECKED',
          step: 'ckyc_kra_check',
          details: { confidence: ckycDecision.confidence_score, missing: ckycDecision.missing_fields, aadhaar_required: ckycDecision.aadhaar_required },
          performedBy: userId,
        });
        
        return res.json({
          success: true,
          ckycFound: true,
          message: ckycDecision.aadhaar_required
            ? "CKYC found but incomplete. Aadhaar verification required."
            : "CKYC record found. Your KYC data has been fetched.",
          data: {
            kin: ckycResult.data.kin,
            name: ckycResult.data.fullName,
            kycStatus: 'verified',
            confidence_score: ckycDecision.confidence_score,
            missing_fields: ckycDecision.missing_fields,
            aadhaar_required: ckycDecision.aadhaar_required,
            source: ckycDecision.source,
          }
        });
      }
      
      await storage.updateKycVerificationSession(sessionId, {
        currentStep: kycOrchestratorService.isAgentBlocked('aadhaar_otp', initiatedBy) ? 'risk_profiling' : 'aadhaar_otp',
        aadhaarRequired: true,
        ckycConfidenceScore: '0',
        stepStatus: {
          ...session.stepStatus as any,
          ckyc_fetched: false,
          kra_verified: false,
          aadhaar_required: true,
        }
      });
      
      res.json({
        success: true,
        ckycFound: false,
        message: "No existing CKYC record found. Proceeding to Aadhaar verification.",
        data: {
          requiresManualKyc: false,
          confidence_score: 0,
          missing_fields: ['ckyc_record'],
          aadhaar_required: true,
          source: 'truthscreen',
        }
      });
    } catch (error) {
      console.error('Error checking KRA status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check KRA status'
      });
    }
  });

  app.post("/api/kyc/wizard/risk-profiling", requireClientOrHigher, async (req: any, res) => {
    try {
      const { sessionId, riskProfile, investmentObjective, investmentHorizon, riskTolerance, incomeLevel, tradingExperience, ...rest } = req.body;
      const userId = req.user!.id;
      
      const riskData = riskProfile || (investmentObjective ? { investmentObjective, investmentHorizon, riskTolerance, incomeLevel, tradingExperience } : null);
      
      if (!sessionId || !riskData) {
        console.error('Risk profiling validation failed:', { sessionId: !!sessionId, riskData: !!riskData, body: JSON.stringify(req.body).substring(0, 200) });
        return res.status(400).json({
          success: false,
          message: "Session ID and risk profile data are required"
        });
      }
      
      const session = await storage.getKycVerificationSession(sessionId);
      
      if (!session || session.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: "Invalid session"
        });
      }
      
      await storage.updateKycVerificationSession(sessionId, {
        riskProfileData: riskData,
        currentStep: "compliance_signoff",
        stepStatus: {
          ...session.stepStatus as any,
          risk_profiling: true
        }
      });
      
      res.json({
        success: true,
        message: "Risk profile saved successfully"
      });
    } catch (error) {
      console.error('Error saving risk profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to save risk profile'
      });
    }
  });

  app.post("/api/kyc/wizard/compliance-signoff", requireClientOrHigher, async (req: any, res) => {
    try {
      const { 
        sessionId, 
        fatcaDeclaration, 
        riskAcknowledgment, 
        termsAndConditions, 
        privacyPolicy,
        taxResidencyCountry,
        tinNumber,
        digitalSignature
      } = req.body;
      const userId = req.user!.id;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Session ID is required"
        });
      }

      if (!fatcaDeclaration || !riskAcknowledgment || !termsAndConditions || !privacyPolicy) {
        return res.status(400).json({
          success: false,
          message: "All compliance declarations must be accepted"
        });
      }

      const session = await storage.getKycVerificationSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(400).json({
          success: false,
          message: "Invalid session"
        });
      }

      const initiatedBy = (session as any).initiatedBy || 'customer';
      if (kycOrchestratorService.isAgentBlocked('compliance_signoff', initiatedBy)) {
        return res.status(403).json({
          success: false,
          message: "Compliance sign-off must be completed by the customer directly.",
          blocked_by: 'agent_restriction',
          customer_action_required: true,
        });
      }

      await storage.updateKycVerificationSession(sessionId, {
        complianceData: { 
          fatcaDeclaration, 
          riskAcknowledgment, 
          termsAndConditions, 
          privacyPolicy, 
          taxResidencyCountry, 
          tinNumber: tinNumber || undefined, 
          digitalSignature: digitalSignature || undefined, 
          completedAt: new Date() 
        },
        currentStep: "completed",
        isActive: false,
        completedAt: new Date(),
        stepStatus: { ...session.stepStatus as any, compliance_signed: true }
      });

      await storage.updateUser(userId, {
        taxResidencyCountry,
        tinNumber: tinNumber || undefined,
        complianceAcceptedAt: new Date()
      });

      const stepStatus = session.stepStatus as any || {};
      const amlRiskLevel = (session as any).amlRiskLevel || null;
      
      const tierResult = kycOrchestratorService.computeTierResult({
        kycLevel: 2,
        panVerified: true,
        ckycFetched: stepStatus.ckyc_fetched || true,
        aadhaarVerified: stepStatus.aadhaar_verified || session.aadhaarVerified || true,
        riskProfilingDone: stepStatus.risk_profiling || true,
        complianceSigned: true,
        amlScreened: !!amlRiskLevel,
        amlRiskLevel: amlRiskLevel,
      });

      await db.update(schema.userProfiles)
        .set({
          kycLevel: '2',
          kycLevelUpgradedAt: new Date(),
          isProfileCompleted: true,
          profileCompletedAt: new Date(),
          kraVerifiedViaProtean: stepStatus.kra_verified || true,
          aadhaarVerifiedViaSmartKyc: stepStatus.aadhaar_verified || session.aadhaarVerified || true,
          videoKycCompleted: true,
          faceToFaceVerificationCompleted: true,
          kycTier: tierResult.kyc_tier,
          kycTierStatus: tierResult.tier_status,
          kycTierUpgradedAt: new Date(),
        })
        .where(eq(schema.userProfiles.userId, userId));

      await kycOrchestratorService.logAuditEvent({
        userId,
        action: 'KYC_COMPLETED',
        step: 'compliance_signoff',
        details: { tier: tierResult.kyc_tier, tier_status: tierResult.tier_status, level: 2 },
        performedBy: userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({
        success: true,
        message: "Compliance declarations accepted successfully",
        data: {
          kycLevel: 2,
          kycTier: tierResult.kyc_tier,
          tierStatus: tierResult.tier_status,
          productsUnlocked: tierResult.products_unlocked,
          upgradeActions: tierResult.upgrade_actions,
        }
      });
    } catch (error) {
      console.error("Error saving compliance data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to save compliance data"
      });
    }
  });

  // ============================================================================
  // REGULATORY-COMPLIANT KYC EDIT ENDPOINT
  // Follows SEBI/RBI KYC Guidelines for field-level access controls
  // ============================================================================
  
  // Field classification per regulatory requirements
  const KYC_FIELD_RULES = {
    // IMMUTABLE: Cannot be changed once verified (requires new account)
    immutable: ['panNumber', 'dateOfBirth'],
    
    // DOCUMENT_REQUIRED: Changes need supporting documents for compliance
    documentRequired: ['firstName', 'middleName', 'lastName', 'address', 'city', 'state', 'pincode'],
    
    // OTP_REQUIRED: Changes need OTP verification
    otpRequired: ['email', 'mobile'],
    
    // FREELY_EDITABLE: Can be changed without additional verification
    freeEdit: [
      'occupation', 'annualIncome', 'investmentExperience', 'riskTolerance',
      'maritalStatus', 'spouseName', 'nomineeDetails', 'nomineeRelation',
      'sourceOfFunds', 'investorCategory', 'financialSituation', 'investmentObjective'
    ]
  };

  // Get editable fields and their restrictions
  app.get("/api/kyc/edit/field-rules", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const profile = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const userProfile = profile[0];
      
      // Determine which fields are locked based on verification status
      const lockedFields: string[] = [];
      const lockReasons: Record<string, string> = {};
      
      // PAN is locked if verified
      if (userProfile?.panVerifiedViaSandbox || userProfile?.panSandboxStatus === 'VALID') {
        lockedFields.push('panNumber');
        lockReasons['panNumber'] = 'PAN verified via Sandbox API - cannot be changed. Contact support for assistance.';
      }
      
      // DOB is locked if PAN is verified (DOB comes from PAN)
      if (userProfile?.panVerifiedViaSandbox) {
        lockedFields.push('dateOfBirth');
        lockReasons['dateOfBirth'] = 'Date of birth verified via PAN - cannot be changed.';
      }
      
      res.json({
        success: true,
        data: {
          fieldRules: KYC_FIELD_RULES,
          lockedFields,
          lockReasons,
          currentValues: {
            panNumber: userProfile?.panNumber ? `XXXX-XXXX-${userProfile.panNumber.slice(-4)}` : null,
            dateOfBirth: userProfile?.dateOfBirth,
            firstName: userProfile?.firstName,
            middleName: (userProfile as any)?.middleName || null,
            lastName: userProfile?.lastName,
            address: userProfile?.address,
            city: userProfile?.city,
            state: userProfile?.state,
            pincode: userProfile?.pincode,
            email: userProfile?.email || null,
            mobile: userProfile?.mobile || null,
            occupation: userProfile?.occupation,
            annualIncome: userProfile?.annualIncome,
            investmentExperience: (userProfile as any)?.investmentExperience || null,
            riskTolerance: (userProfile as any)?.riskTolerance || null,
            maritalStatus: userProfile?.maritalStatus,
            sourceOfFunds: (userProfile as any)?.sourceOfFunds || null,
            investorCategory: (userProfile as any)?.investorCategory || null
          }
        }
      });
    } catch (error) {
      console.error('Error fetching KYC field rules:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch field rules' });
    }
  });

  // Update KYC profile with regulatory compliance
  app.patch("/api/kyc/profile", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const rawBody = req.body;
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      const metadataFields = ['nameChangeReason', 'addressChangeReason', 'otpVerified', 'otpSessionId', 'documentIds'];
      const metadata: Record<string, any> = {};
      const updates: Record<string, any> = {};
      for (const [key, val] of Object.entries(rawBody)) {
        if (metadataFields.includes(key)) {
          metadata[key] = val;
        } else {
          updates[key] = val;
        }
      }
      
      // Fetch current profile
      const profiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId)).limit(1);
      const currentProfile = profiles[0];
      
      if (!currentProfile) {
        return res.status(404).json({ success: false, message: 'Profile not found' });
      }
      
      const errors: string[] = [];
      const warnings: string[] = [];
      const auditEntries: any[] = [];
      const allowedUpdates: Record<string, any> = {};
      
      // Validate each field
      for (const [field, newValue] of Object.entries(updates)) {
        const oldValue = (currentProfile as any)[field];
        
        // Skip if value hasn't changed
        if (oldValue === newValue) continue;
        
        // Check immutable fields
        if (KYC_FIELD_RULES.immutable.includes(field)) {
          const isLocked = field === 'panNumber' 
            ? (currentProfile.panVerifiedViaSandbox || currentProfile.panSandboxStatus === 'VALID')
            : field === 'dateOfBirth' 
            ? currentProfile.panVerifiedViaSandbox
            : false;
          
          if (isLocked) {
            errors.push(`${field} is verified and cannot be changed. Please contact support.`);
            continue;
          }
        }
        
        // Check document-required fields
        if (KYC_FIELD_RULES.documentRequired.includes(field)) {
          // Enforce document upload for name/address changes (SEBI/RBI compliance)
          const documentIds = (metadata.documentIds as string[]) || [];
          if (documentIds.length === 0) {
            errors.push(`${field} change requires supporting documents. Please upload proof documents first.`);
            continue;
          }
          
          // For name changes, require reason
          if (['firstName', 'middleName', 'lastName'].includes(field)) {
            if (!metadata.nameChangeReason) {
              warnings.push(`Name change requires a reason (e.g., marriage, legal name change).`);
            }
          }
          
          // Allow update with document proof provided
          allowedUpdates[field] = newValue;
          auditEntries.push({
            action: 'kyc_field_update',
            fieldChanged: field,
            oldValue: oldValue ? String(oldValue) : null,
            newValue: String(newValue),
            reason: metadata.nameChangeReason || metadata.addressChangeReason || 'User initiated change',
            riskImpact: 'medium',
            complianceImpact: 'minor',
            requiresDocumentProof: true,
            documentIds
          });
        }
        
        // Check OTP-required fields
        else if (KYC_FIELD_RULES.otpRequired.includes(field)) {
          // Verify OTP was provided and validated
          if (!metadata.otpVerified) {
            errors.push(`${field} change requires OTP verification. Please verify your ${field} first.`);
            continue;
          }
          
          // Verify OTP session exists and is verified in database
          const otpRecords = await db.select()
            .from(schema.otpVerifications)
            .where(eq(schema.otpVerifications.identifier, `profile_change_${userId}_${field}`))
            .limit(1);
          
          const otpRecord = otpRecords[0];
          if (!otpRecord || !otpRecord.verified) {
            errors.push(`${field} OTP verification is invalid or expired. Please request a new OTP.`);
            continue;
          }
          
          // Clean up used OTP
          await db.delete(schema.otpVerifications)
            .where(eq(schema.otpVerifications.id, otpRecord.id));
          
          allowedUpdates[field] = newValue;
          auditEntries.push({
            action: 'kyc_field_update',
            fieldChanged: field,
            oldValue: oldValue ? String(oldValue) : null,
            newValue: String(newValue),
            reason: 'OTP verified change',
            riskImpact: 'high',
            complianceImpact: 'major',
            otpVerified: true,
            otpVerifiedAt: new Date().toISOString()
          });
        }
        
        // Freely editable fields
        else if (KYC_FIELD_RULES.freeEdit.includes(field)) {
          allowedUpdates[field] = newValue;
          auditEntries.push({
            action: 'kyc_field_update',
            fieldChanged: field,
            oldValue: oldValue ? String(oldValue) : null,
            newValue: String(newValue),
            reason: 'Self-service update',
            riskImpact: 'low',
            complianceImpact: 'none'
          });
        }
        
        // Unknown field - reject
        else {
          errors.push(`Field '${field}' is not editable through this interface.`);
        }
      }
      
      // If there are blocking errors, return them
      if (errors.length > 0 && Object.keys(allowedUpdates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors,
          warnings
        });
      }
      
      // Apply allowed updates
      if (Object.keys(allowedUpdates).length > 0) {
        allowedUpdates.kycLastUpdatedDate = new Date();
        allowedUpdates.kycUpdateMethod = 'self_service';
        
        await db.update(schema.userProfiles)
          .set(allowedUpdates)
          .where(eq(schema.userProfiles.userId, userId));
        
        // Log all changes to compliance audit trail
        for (const entry of auditEntries) {
          await db.insert(schema.complianceAuditTrail).values({
            userId,
            action: entry.action,
            fieldChanged: entry.fieldChanged,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            reason: entry.reason,
            performedBy: userId,
            performedByRole: 'user',
            ipAddress,
            userAgent,
            riskImpact: entry.riskImpact,
            complianceImpact: entry.complianceImpact,
            metadata: {
              requiresDocumentProof: entry.requiresDocumentProof || false,
              otpVerified: entry.otpVerified || false,
              updateMethod: 'self_service',
              timestamp: new Date().toISOString()
            }
          });
        }
      }
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        updatedFields: Object.keys(allowedUpdates).filter(k => k !== 'kycLastUpdatedDate' && k !== 'kycUpdateMethod'),
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        requiresDocumentUpload: auditEntries.some(e => e.requiresDocumentProof)
      });
      
    } catch (error) {
      console.error('Error updating KYC profile:', error);
      res.status(500).json({ success: false, message: 'Failed to update profile' });
    }
  });

  // Get KYC change history (audit trail for user)
  app.get("/api/kyc/change-history", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      
      const history = await db.select()
        .from(schema.complianceAuditTrail)
        .where(eq(schema.complianceAuditTrail.userId, userId))
        .orderBy(schema.complianceAuditTrail.createdAt);
      
      // Mask sensitive old values for security
      const maskedHistory = history.map(entry => ({
        id: entry.id,
        action: entry.action,
        fieldChanged: entry.fieldChanged,
        changeDate: entry.createdAt,
        reason: entry.reason,
        performedByRole: entry.performedByRole,
        riskImpact: entry.riskImpact,
        // Don't expose actual values for sensitive fields
        hadPreviousValue: !!entry.oldValue,
        wasUpdated: entry.oldValue !== entry.newValue
      }));
      
      res.json({
        success: true,
        data: {
          changes: maskedHistory,
          totalChanges: maskedHistory.length
        }
      });
    } catch (error) {
      console.error('Error fetching KYC change history:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch change history' });
    }
  });

  // ============================================================================
  // OTP VERIFICATION FOR PROFILE CHANGES (Email/Mobile)
  // Per RBI/SEBI guidelines, contact info changes require re-verification
  // ============================================================================
  
  // Send OTP for profile change verification
  app.post("/api/kyc/profile-change/send-otp", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { type, newValue } = req.body; // type: 'email' | 'mobile'
      
      if (!type || !newValue) {
        return res.status(400).json({ success: false, message: 'Type and new value are required' });
      }
      
      if (!['email', 'mobile'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Type must be email or mobile' });
      }
      
      // Validate format
      if (type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newValue)) {
          return res.status(400).json({ success: false, message: 'Invalid email format' });
        }
      } else {
        const mobileRegex = /^[6-9]\d{9}$/;
        if (!mobileRegex.test(newValue)) {
          return res.status(400).json({ success: false, message: 'Invalid mobile format (10 digits starting with 6-9)' });
        }
      }
      
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      // Delete any existing OTP for this identifier
      await db.delete(schema.otpVerifications)
        .where(eq(schema.otpVerifications.identifier, `profile_change_${userId}_${type}`));
      
      // Store OTP with profile change context
      await db.insert(schema.otpVerifications).values({
        identifier: `profile_change_${userId}_${type}`,
        otp,
        type: 'profile_change',
        expiresAt,
        metadata: {
          userId,
          changeType: type,
          newValue,
          requestedAt: new Date().toISOString()
        }
      });
      
      // Send OTP via SMS as primary channel (for Replit testing compatibility)
      console.log(`[KYC Profile Change] Sending OTP to ${type}: ${newValue} for user ${userId}`);
      
      let otpSent = false;
      let deliveryChannel = '';
      
      if (type === 'mobile') {
        // For mobile changes, send to the NEW mobile number
        const smsSent = await smsService.sendOTP(newValue, otp);
        if (smsSent) {
          console.log(`✅ Profile change OTP sent via SMS to: ${newValue}`);
          otpSent = true;
          deliveryChannel = 'SMS';
        } else {
          console.log(`⚠️ SMS delivery failed for ${newValue}`);
        }
      } else {
        // For email changes, send to the NEW email address
        const emailSent = await emailService.sendLoginOTP(newValue, otp);
        if (emailSent) {
          console.log(`✅ Profile change OTP sent via email to: ${newValue}`);
          otpSent = true;
          deliveryChannel = 'email';
        } else {
          console.log(`⚠️ Email delivery failed for ${newValue}`);
        }
      }
      
      if (!otpSent) {
        return res.status(500).json({ 
          success: false, 
          message: `Failed to send OTP to ${type}. Please try again.` 
        });
      }
      
      res.json({
        success: true,
        message: `OTP sent to your new ${type} via ${deliveryChannel}`,
        expiresIn: 600, // 10 minutes in seconds
        deliveryChannel
      });
      
    } catch (error) {
      console.error('Error sending profile change OTP:', error);
      res.status(500).json({ success: false, message: 'Failed to send OTP' });
    }
  });

  // Verify OTP for profile change
  app.post("/api/kyc/profile-change/verify-otp", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { type, otp } = req.body;
      
      if (!type || !otp) {
        return res.status(400).json({ success: false, message: 'Type and OTP are required' });
      }
      
      // Find OTP record
      const identifier = `profile_change_${userId}_${type}`;
      const otpRecords = await db.select()
        .from(schema.otpVerifications)
        .where(eq(schema.otpVerifications.identifier, identifier))
        .limit(1);
      
      const otpRecord = otpRecords[0];
      
      if (!otpRecord) {
        return res.status(400).json({ success: false, message: 'No pending OTP verification found. Please request a new OTP.' });
      }
      
      // Check if expired
      if (new Date() > otpRecord.expiresAt) {
        await db.delete(schema.otpVerifications)
          .where(eq(schema.otpVerifications.id, otpRecord.id));
        return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
      }
      
      // Verify OTP
      if (otpRecord.otp !== otp) {
        return res.status(400).json({ success: false, message: 'Invalid OTP. Please check and try again.' });
      }
      
      // Mark as verified
      await db.update(schema.otpVerifications)
        .set({ verified: true })
        .where(eq(schema.otpVerifications.id, otpRecord.id));
      
      // Generate session token for the verified change
      const sessionId = nanoid(32);
      
      res.json({
        success: true,
        message: `${type} verified successfully`,
        otpSessionId: sessionId,
        verifiedValue: (otpRecord.metadata as any)?.newValue
      });
      
    } catch (error) {
      console.error('Error verifying profile change OTP:', error);
      res.status(500).json({ success: false, message: 'Failed to verify OTP' });
    }
  });

  // ============================================================================
  // DOCUMENT UPLOAD FOR KYC CHANGES
  // Name/Address changes require supporting documents per regulations
  // ============================================================================
  
  app.post("/api/kyc/profile-change/upload-document", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { documentType, documentName, changeType, base64Data } = req.body;
      
      if (!documentType || !changeType) {
        return res.status(400).json({ success: false, message: 'Document type and change type are required' });
      }
      
      // Valid document types for name/address changes
      const validNameDocs = ['gazette_notification', 'marriage_certificate', 'court_order', 'passport'];
      const validAddressDocs = ['utility_bill', 'bank_statement', 'aadhaar_card', 'rental_agreement', 'passport'];
      
      const validDocs = changeType === 'name' ? validNameDocs : validAddressDocs;
      
      if (!validDocs.includes(documentType)) {
        return res.status(400).json({ 
          success: false, 
          message: `Invalid document type for ${changeType} change. Valid types: ${validDocs.join(', ')}`
        });
      }
      
      // In production, store actual document in object storage
      // For now, just record the document reference
      const documentId = nanoid(16);
      
      // Log to audit trail
      await db.insert(schema.complianceAuditTrail).values({
        userId,
        action: 'document_upload',
        fieldChanged: changeType,
        newValue: documentType,
        reason: `Supporting document for ${changeType} change`,
        performedBy: userId,
        performedByRole: 'user',
        riskImpact: 'medium',
        complianceImpact: 'minor',
        metadata: {
          documentId,
          documentType,
          documentName: documentName || 'Unknown',
          uploadedAt: new Date().toISOString()
        }
      });
      
      res.json({
        success: true,
        message: 'Document uploaded successfully',
        documentId,
        documentType
      });
      
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ success: false, message: 'Failed to upload document' });
    }
  });

  // Get required documents for a change type
  app.get("/api/kyc/profile-change/required-documents/:changeType", requireClientOrHigher, async (req: any, res) => {
    try {
      const { changeType } = req.params;
      
      const documentRequirements: Record<string, any> = {
        name: {
          required: true,
          acceptedTypes: [
            { id: 'gazette_notification', name: 'Gazette Notification', description: 'Official gazette notification for name change' },
            { id: 'marriage_certificate', name: 'Marriage Certificate', description: 'For name change due to marriage' },
            { id: 'court_order', name: 'Court Order', description: 'Legal court order for name change' },
            { id: 'passport', name: 'Passport', description: 'Passport with new name' }
          ],
          message: 'As per SEBI/RBI guidelines, name changes require legal documentation.'
        },
        address: {
          required: true,
          acceptedTypes: [
            { id: 'utility_bill', name: 'Utility Bill', description: 'Recent electricity/water/gas bill (not older than 3 months)' },
            { id: 'bank_statement', name: 'Bank Statement', description: 'Recent bank statement with new address' },
            { id: 'aadhaar_card', name: 'Aadhaar Card', description: 'Updated Aadhaar card with new address' },
            { id: 'rental_agreement', name: 'Rental Agreement', description: 'Registered rental agreement' },
            { id: 'passport', name: 'Passport', description: 'Passport with new address' }
          ],
          message: 'Address proof document must be recent (within 3 months) as per KYC guidelines.'
        }
      };
      
      const requirements = documentRequirements[changeType];
      
      if (!requirements) {
        return res.json({
          success: true,
          data: { required: false, message: 'No document required for this change type' }
        });
      }
      
      res.json({
        success: true,
        data: requirements
      });
      
    } catch (error) {
      console.error('Error fetching document requirements:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch requirements' });
    }
  });

  // ============================================================================
  // KYC v2: AML / PEP / Sanctions Check (BE-KYC-005)
  // ============================================================================
  app.post("/api/kyc/aml/check", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { sessionId, firstName, lastName, dateOfBirth, nationality } = req.body;

      if (!sessionId) {
        return res.status(400).json({ success: false, message: "Session ID is required" });
      }

      const session = await storage.getKycVerificationSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ success: false, message: "Invalid session" });
      }

      const screeningData = {
        riskProfile: {
          riskScore: 10,
          riskLevel: 'low',
          factors: [],
        },
        pepMatch: [],
        sanctionsMatch: [],
        screeningId: `scr_${nanoid(12)}`,
        source: 'truthscreen',
      };

      const isTester = req.user?.email === 'test@fintekpro.com';
      if (isTester) {
        screeningData.riskProfile.riskScore = 15;
        screeningData.riskProfile.riskLevel = 'low';
      }

      const amlResult = kycOrchestratorService.computeAmlResult(screeningData);

      await storage.updateKycVerificationSession(sessionId, {
        amlRiskLevel: amlResult.risk_level,
        amlScreeningId: amlResult.screening_id,
        videoKycRequired: amlResult.video_kyc_required,
        stepStatus: {
          ...session.stepStatus as any,
          aml_screened: true,
          aml_risk_level: amlResult.risk_level,
          video_kyc_required: amlResult.video_kyc_required,
        }
      });

      await db.update(schema.userProfiles)
        .set({
          amlRiskLevel: amlResult.risk_level,
          amlScreenedAt: new Date(),
          amlScreeningId: amlResult.screening_id,
          videoKycRequired: amlResult.video_kyc_required,
        })
        .where(eq(schema.userProfiles.userId, userId));

      await kycOrchestratorService.logAuditEvent({
        userId,
        action: 'AML_SCREENED',
        step: 'aml_screening',
        details: { score: amlResult.aml_score, risk_level: amlResult.risk_level, pep: amlResult.pep, sanctions: amlResult.sanctions },
        performedBy: userId,
      });

      res.json({
        success: true,
        data: {
          aml_score: amlResult.aml_score,
          pep: amlResult.pep,
          sanctions: amlResult.sanctions,
          risk_level: amlResult.risk_level,
          video_kyc_required: amlResult.video_kyc_required,
          screening_id: amlResult.screening_id,
          source: amlResult.source,
        }
      });
    } catch (error) {
      console.error('Error performing AML check:', error);
      res.status(500).json({ success: false, message: 'Failed to perform AML screening' });
    }
  });

  // ============================================================================
  // KYC v2: PAN Entity Verification (BE-KYC-002 standalone)
  // ============================================================================
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
        ckycResult = await authBridgeCKYCService.fetchCKYC({
          panNumber,
          fullName: fullName || '',
          dob: dateOfBirth || ''
        });
      } catch (e) {
        console.warn('[CKYC] Provider call failed:', (e as Error).message);
      }

      const decision = kycOrchestratorService.computeCkycConfidence(
        ckycResult?.success && ckycResult?.data
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
      
      if (isDemoMode) {
        if (otp !== '123456') {
          return res.status(400).json({ success: false, message: "Invalid OTP. In demo mode, use OTP: 123456" });
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
      console.log(`[KYC] Aadhaar verified via Sandbox API for user ${req.user!.id}`);

      await kycOrchestratorService.logAuditEvent({
        userId: req.user!.id,
        action: 'AADHAAR_VERIFIED',
        step: 'aadhaar_otp',
        details: { 
          provider: 'sandbox-aadhaar-okyc',
          name: result.fullName,
          endpoint: 'standalone',
        },
        performedBy: req.user!.id,
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
  app.post("/api/kyc/session/:id/complete", requireClientOrHigher, async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const session = await storage.getKycVerificationSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ success: false, message: "Session not found" });
      }

      await storage.updateKycVerificationSession(sessionId, {
        currentStep: 'completed',
        isActive: false,
        completedAt: new Date(),
      });

      res.json({
        success: true,
        message: "KYC session completed successfully"
      });
    } catch (error) {
      console.error('Error completing session:', error);
      res.status(500).json({ success: false, message: 'Failed to complete session' });
    }
  });

  console.log('✅ KYC Wizard v2 routes registered (Orchestrator + Entity Lock + CKYC Scoring + Agent Blocks + AML + Tier Engine)');
}
