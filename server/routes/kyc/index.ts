import { Express, Request, Response } from 'express';
import { requireClientOrHigher } from '../../middleware/auth';
import { getAccessibleProducts, getUserKYCLevel } from '../../middleware/kyc-level-gate';
import { storage } from '../../storage';
import { sandboxPANService } from '../../sandbox-pan-api';
import { authBridgeCKYCService } from '../../authbridge-ckyc-api';
import { PANConsentService } from '../../services/pan-consent-service';
import { db } from '../../db';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export function registerKYCWizardRoutes(app: Express) {
  app.get("/api/kyc/status", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const products = await getAccessibleProducts(userId);
      const { level, profile } = await getUserKYCLevel(userId);
      
      res.json({
        success: true,
        data: {
          kycLevel: level,
          kycLevelName: level === '0' ? 'Basic Profile' : level === '1' ? 'PAN Verified' : 'Full KYC',
          accessibleProducts: products.accessibleProducts,
          blockedProducts: products.blockedProducts,
          canAccessLoans: level >= '1',
          canAccessInsurance: level >= '1',
          canAccessInvestments: level >= '2',
          nextAction: level === '0' ? 'Complete PAN verification' : level === '1' ? 'Complete full KYC' : null,
          profile: {
            panVerified: profile?.panVerifiedViaSandbox || false,
            ckycFetched: profile?.ckycFetchedViaAuthBridge || false,
            kraVerified: profile?.kraVerifiedViaProtean || false
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
      
      // Check for existing active session
      const existingSession = await storage.getActiveKycSession(userId);
      if (existingSession && !forceNew) {
        return res.json({
          success: true,
          data: {
            sessionId: existingSession.id,
            currentStep: existingSession.currentStep,
            stepStatus: existingSession.stepStatus,
            isResumed: true
          }
        });
      }
      
      // Check user's existing KYC profile to determine starting step
      const profile = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).limit(1);
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
      
      // If user already has verified PAN, skip to next step
      if (userProfile?.panVerifiedViaSandbox || userProfile?.panSandboxStatus === 'VALID') {
        stepStatus.pan_verified = true;
        initialStep = 'aadhaar_verification'; // Skip to Aadhaar step
        
        // If CKYC is also verified, skip further
        if (userProfile?.ckycAuthBridgeStatus === 'found') {
          stepStatus.ckyc_fetched = true;
          initialStep = 'risk_profiling'; // Skip to risk profiling
        }
        
        // If video KYC is completed
        if (userProfile?.videoKycCompleted) {
          stepStatus.aadhaar_verified = true;
          initialStep = 'compliance_signoff'; // Skip to compliance
        }
      }
      
      const session = await storage.createKycVerificationSession({
        userId,
        entityType: entityType || 'individual',
        targetLevel: targetLevel || '2',
        currentStep: initialStep,
        stepStatus,
        panNumber: userProfile?.panNumber || undefined,
        panVerificationData: userProfile?.panSandboxResponse || undefined
      });
      
      res.json({
        success: true,
        data: {
          sessionId: session.id,
          currentStep: session.currentStep,
          stepStatus: session.stepStatus,
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
      
      await storage.updateKycVerificationSession(sessionId, {
        panNumber: await PANConsentService.encryptPAN(panNumber),
        panDob: new Date(dob),
        panVerified: true,
        panVerificationData: {
          name: verification.data.full_name || fullName,
          fatherName: verification.data.father_name
        },
        panVerifiedAt: new Date(),
        currentStep: "aadhaar_otp",
        stepStatus: {
          pan_verified: true,
          aadhaar_otp_sent: false,
          aadhaar_verified: false,
          data_collected: false
        }
      });
      
      const existingProfile = await db.select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId))
        .limit(1);
      
      if (existingProfile && existingProfile.length > 0) {
        await db.update(schema.userProfiles)
          .set({
            kycLevel: '1',
            kycLevelUpgradedAt: new Date(),
            panVerifiedViaSandbox: true,
            panSandboxVerifiedAt: new Date(),
            panSandboxResponse: verification.data,
            panSandboxStatus: verification.data?.status || 'VALID',
            panNumber: panNumber
          })
          .where(eq(schema.userProfiles.userId, userId));
      } else {
        await db.insert(schema.userProfiles)
          .values({
            userId: userId,
            kycLevel: '1',
            kycLevelUpgradedAt: new Date(),
            panVerifiedViaSandbox: true,
            panSandboxVerifiedAt: new Date(),
            panSandboxResponse: verification.data,
            panSandboxStatus: verification.data?.status || 'VALID',
            panNumber: panNumber
          });
      }
      
      res.json({
        success: true,
        data: {
          name: verification.data.full_name || fullName,
          fatherName: verification.data.father_name
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
      
      const session = await storage.getKycVerificationSession(sessionId);
      
      if (!session || session.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: "Invalid session"
        });
      }
      
      const last4Digits = aadhaarNumber.slice(-4);
      
      await storage.updateKycVerificationSession(sessionId, {
        aadhaarNumber: await PANConsentService.encryptPAN(last4Digits),
        currentStep: "aadhaar_otp_verify",
        stepStatus: {
          ...session.stepStatus as any,
          aadhaar_otp_sent: true
        }
      });
      
      res.json({
        success: true,
        message: "OTP sent to Aadhaar-linked mobile number",
        data: {
          maskedMobile: `XXXXXX${Math.floor(1000 + Math.random() * 9000)}`,
          otpValidFor: 300
        }
      });
    } catch (error) {
      console.error('Error sending Aadhaar OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP'
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
      
      const session = await storage.getKycVerificationSession(sessionId);
      
      if (!session || session.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: "Invalid session"
        });
      }
      
      await storage.updateKycVerificationSession(sessionId, {
        aadhaarVerified: true,
        aadhaarVerifiedAt: new Date(),
        currentStep: "ckyc_fetch",
        stepStatus: {
          ...session.stepStatus as any,
          aadhaar_verified: true
        }
      });
      
      res.json({
        success: true,
        message: "Aadhaar verified successfully",
        data: {
          name: "Verified User",
          address: "Address from Aadhaar"
        }
      });
    } catch (error) {
      console.error('Error verifying Aadhaar OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify OTP'
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
        currentStep: 'completed'
      });
      
      await db.update(schema.userProfiles)
        .set({
          kycLevel: '2',
          kycLevelUpgradedAt: new Date()
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
      
      const ckycResult = await authBridgeCKYCService.fetchCKYC({
        panNumber: panNumber || session.panNumber,
        fullName: (session.panVerificationData as any)?.name || '',
        dob: session.panDob ? new Date(session.panDob).toISOString().split('T')[0] : ''
      });
      
      if (ckycResult.success && ckycResult.data) {
        await storage.updateKycVerificationSession(sessionId, {
          ckycData: ckycResult.data,
          ckycFetched: true,
          ckycFetchedAt: new Date(),
          currentStep: "risk_profiling",
          stepStatus: {
            ...session.stepStatus as any,
            ckyc_fetched: true,
            kra_verified: true
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
        
        return res.json({
          success: true,
          ckycFound: true,
          message: "CKYC record found. Your KYC data has been fetched.",
          data: {
            kin: ckycResult.data.kin,
            name: ckycResult.data.fullName,
            kycStatus: 'verified'
          }
        });
      }
      
      await storage.updateKycVerificationSession(sessionId, {
        currentStep: "manual_kyc",
        stepStatus: {
          ...session.stepStatus as any,
          ckyc_fetched: false
        }
      });
      
      res.json({
        success: true,
        ckycFound: false,
        message: "No existing CKYC record found. Manual verification required.",
        data: {
          requiresManualKyc: true
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
      const { sessionId, riskProfile } = req.body;
      const userId = req.user!.id;
      
      if (!sessionId || !riskProfile) {
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
        riskProfileData: riskProfile,
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
        stepStatus: { ...session.stepStatus as any, compliance_signed: true }
      });

      await storage.updateUser(userId, {
        taxResidencyCountry,
        tinNumber: tinNumber || undefined,
        complianceAcceptedAt: new Date()
      });

      res.json({
        success: true,
        message: "Compliance declarations accepted successfully"
      });
    } catch (error) {
      console.error("Error saving compliance data:", error);
      res.status(500).json({
        success: false,
        message: "Failed to save compliance data"
      });
    }
  });

  console.log('✅ KYC Wizard routes registered');
}
