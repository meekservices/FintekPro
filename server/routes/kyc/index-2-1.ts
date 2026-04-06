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

export function registerKYCWizardPart2Sub1Routes(app: Express) {
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
        currentStep: "aadhaar_otp_verify",
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

        if (referenceId.startsWith('mock_ref_')) {
          if (otp !== '123456') {
            return res.status(400).json({
              success: false,
              message: "Invalid OTP. In test mode, use OTP: 123456"
            });
          }
          verificationData = {
            name: "Test Verified User",
            dob: "1990-01-01",
            gender: "M",
            address: {
              house: "123",
              street: "Test Street",
              landmark: "Near Test Park",
              locality: "Test Colony",
              district: "Test District",
              state: "Maharashtra",
              pincode: "400001",
              country: "India"
            },
            maskedAadhaar: "XXXX-XXXX-9012",
            provider: 'sandbox-mock',
          };
          console.log(`[KYC] Aadhaar OTP verified via MOCK for user ${userId} (test environment)`);
        } else {
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
      }
      
      await storage.updateKycVerificationSession(sessionId, {
        aadhaarVerified: true,
        aadhaarVerifiedAt: new Date(),
        aadhaarVerificationData: verificationData,
        currentStep: "risk_profiling",
        stepStatus: {
          ...stepStatus,
          aadhaar_verified: true,
          aadhaar_otp_sent: true,
          aadhaar_reference_id: null,
        }
      });
      
      const profileUpdate: any = {
        aadhaarVerifiedViaSmartKyc: true,
      };
      
      if (verificationData.address) {
        const addr = verificationData.address;
        const addressParts = [addr.house, addr.street, addr.landmark, addr.locality].filter(Boolean);
        profileUpdate.address = addressParts.join(', ') || addr.addressLine || '';
        profileUpdate.city = addr.district || addr.city || '';
        profileUpdate.state = addr.state || '';
        profileUpdate.pincode = addr.pincode || addr.zip || '';
        console.log(`[KYC] Address saved from Aadhaar eKYC for user ${userId}: ${profileUpdate.city}, ${profileUpdate.state} ${profileUpdate.pincode}`);
      }
      
      await db.update(schema.userProfiles)
        .set(profileUpdate)
        .where(eq(schema.userProfiles.userId, userId));

      // Persist Aadhaar verification to kycVault so upgrade notification service can detect it
      try {
        const existingVaultAadhaar = await db.select({ id: schema.kycVault.id })
          .from(schema.kycVault)
          .where(eq(schema.kycVault.userId, userId))
          .limit(1);
        if (existingVaultAadhaar.length > 0) {
          await db.update(schema.kycVault)
            .set({ aadhaarVerifiedAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.kycVault.userId, userId));
        } else {
          await db.insert(schema.kycVault)
            .values({ userId, aadhaarVerifiedAt: new Date(), source: 'sandbox', kycStatus: 'pending' });
        }
      } catch (vaultErr) {
        console.warn('[KYC] Failed to update kycVault for Aadhaar:', vaultErr);
      }
      
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
          kraVerifiedViaProtean: !!stepStatus.kra_verified,
          aadhaarVerifiedViaSmartKyc: !!(stepStatus.aadhaar_verified || session.aadhaarVerified),
          // NOTE: videoKycCompleted is NOT set here — V-CIP must be completed via actual video session
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

}
