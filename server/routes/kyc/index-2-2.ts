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

export function registerKYCWizardPart2Sub2Routes(app: Express) {
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

      // Optimization: Check if AutoKYC engine has already fetched CKYC data
      const [profile] = await db.select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId))
        .limit(1);

      if (profile?.ckycFetchedViaAuthBridge && profile?.ckycAuthBridgeResponse) {
        console.log(`[KYC Wizard] Using cached CKYC data for user ${userId}`);
        const ckycDecision = kycOrchestratorService.computeCkycConfidence({
          found: true,
          data: (profile as any).ckycAuthBridgeResponse,
          kin: (profile as any).ckycAuthBridgeKin,
          provider: 'truthscreen'
        });

        const initiatedBy = (session as any).initiatedBy || 'customer';
        const nextStep = ckycDecision.aadhaar_required
          ? (kycOrchestratorService.isAgentBlocked('aadhaar_otp', initiatedBy) ? 'risk_profiling' : 'aadhaar_otp')
          : 'risk_profiling';

        await storage.updateKycVerificationSession(sessionId, {
          ckycData: (profile as any).ckycAuthBridgeResponse,
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
            aadhaar_verified: !ckycDecision.aadhaar_required,
          }
        });

        return res.json({
          success: true,
          ckycFound: true,
          message: "CKYC record verified via Smart Mode.",
          data: {
            kin: (profile as any).ckycAuthBridgeKin,
            name: `${profile.firstName} ${profile.lastName || ''}`.trim(),
            kycStatus: 'verified',
            confidence_score: ckycDecision.confidence_score,
            missing_fields: ckycDecision.missing_fields,
            aadhaar_required: ckycDecision.aadhaar_required,
            source: ckycDecision.source,
          }
        });
      }

      let ckycResult: any = null;
      try {
        const truthScreenAdapter = await getCkycAdapter('truthscreen');
        if (truthScreenAdapter.isConfigured()) {
          const tsResult = await truthScreenAdapter.verify({
            panNumber: (rawPan || '').toUpperCase(),
            fullName: (session.panVerificationData as any)?.name || '',
            dateOfBirth: session.panDob ? new Date(session.panDob).toISOString().split('T')[0] : '',
            userId
          });
          ckycResult = tsResult;
          console.log(`[KYC Wizard] TruthScreen CKYC check: found=${tsResult.found}, kin=${tsResult.kin || 'N/A'}`);
        } else {
          ckycResult = await authBridgeCKYCService.fetchCKYC({
            pan: (rawPan || '').toUpperCase(),
            full_name: (session.panVerificationData as any)?.name || '',
            date_of_birth: session.panDob ? new Date(session.panDob).toISOString().split('T')[0] : ''
          });
        }
      } catch (ckycErr) {
        console.warn('[KYC Wizard] CKYC/KRA check failed, proceeding with manual KYC flow:', (ckycErr as any)?.message);
      }
      
      const isTruthScreenResult = ckycResult?.provider === 'truthscreen';
      const ckycDecision = kycOrchestratorService.computeCkycConfidence(
        isTruthScreenResult
          ? { found: ckycResult.found, data: ckycResult.data, kin: ckycResult.kin, provider: 'truthscreen' }
          : (ckycResult?.status === 'success' && ckycResult?.data)
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
            // Bug 5 fix (part 1): when CKYC is complete and Aadhaar OTP is skipped,
            // mark aadhaar_verified true in stepStatus so compliance signoff
            // doesn't accidentally reset aadhaarVerifiedViaSmartKyc to false.
            aadhaar_verified: !ckycDecision.aadhaar_required,
          }
        });
        
        // Base CKYC profile update
        const ckycProfileUpdate: Record<string, any> = {
          ckycFetchedViaAuthBridge: true,
          ckycAuthBridgeFetchedAt: new Date(),
          ckycAuthBridgeKin: ckycResult.data.kin,
          ckycAuthBridgeResponse: ckycResult.data,
          ckycAuthBridgeStatus: 'found',   // Bug 3 fix: reconciliation checks for 'found', not 'SUCCESS'
        };

        // ── T004: CKYC auto-populate when Aadhaar OTP is skipped ─────────────
        // When CKYC registry has complete data, treat it as Aadhaar-equivalent.
        // Populate profile fields from CKYC data and flag user as Aadhaar-verified.
        if (!ckycDecision.aadhaar_required && ckycResult.data) {
          const cd = ckycResult.data as any;
          // Populate address & personal fields from CKYC registry if not already set
          if (cd.address)  ckycProfileUpdate.address  = cd.address;
          if (cd.city)     ckycProfileUpdate.city      = cd.city;
          if (cd.state)    ckycProfileUpdate.state     = cd.state;
          if (cd.pincode)  ckycProfileUpdate.pincode   = cd.pincode;
          if (cd.gender)   ckycProfileUpdate.gender    = cd.gender;
          if (cd.fatherName) ckycProfileUpdate.fatherName = cd.fatherName;
          ckycProfileUpdate.aadhaarVerifiedViaSmartKyc = true;

          // Bug 5 fix: also mark aadhaar_verified in the session so compliance signoff
          // can read it correctly from stepStatus — without this, signoff would reset
          // aadhaarVerifiedViaSmartKyc back to false for the CKYC-only path.
          await storage.updateKycVerificationSession(sessionId, {
            aadhaarVerified: true,
            aadhaarVerifiedAt: new Date(),
          });

          // Mark user as Aadhaar-verified via CKYC registry
          await db.update(schema.users)
            .set({
              aadhaarVerifiedViaSmartKyc: true,
              aadhaarVerificationDate: new Date(),
            } as any)
            .where(eq(schema.users.id, userId));

          // Update kycVault with Aadhaar/address timestamps (CKYC is address-equivalent)
          try {
            const existingVaultCkyc = await db.select({ id: schema.kycVault.id })
              .from(schema.kycVault).where(eq(schema.kycVault.userId, userId)).limit(1);
            const now = new Date();
            if (existingVaultCkyc.length > 0) {
              await db.update(schema.kycVault)
                .set({ aadhaarVerifiedAt: now, addressVerifiedAt: now, updatedAt: now } as any)
                .where(eq(schema.kycVault.userId, userId));
            } else {
              await db.insert(schema.kycVault)
                .values({ userId, aadhaarVerifiedAt: now, addressVerifiedAt: now, source: 'ckyc_registry', kycStatus: 'pending' } as any);
            }
          } catch (vaultCkycErr) {
            console.warn('[KYC] Non-fatal: vault update after CKYC auto-populate failed:', (vaultCkycErr as any)?.message);
          }
          console.log(`[KYC Wizard] CKYC-complete: aadhaarVerifiedViaSmartKyc set for user ${userId} (skipped OTP via CKYC registry)`);
        }
        // ──────────────────────────────────────────────────────────────────────

        await db.update(schema.userProfiles)
          .set(ckycProfileUpdate)
          .where(eq(schema.userProfiles.userId, userId));
        
        await kycOrchestratorService.logAuditEvent({
          userId,
          action: 'CKYC_CHECKED',
          step: 'ckyc_kra_check',
          details: { confidence: ckycDecision.confidence_score, missing: ckycDecision.missing_fields, aadhaar_required: ckycDecision.aadhaar_required, auto_populated: !ckycDecision.aadhaar_required },
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

      if (!session.isActive || (session.expiresAt && new Date() > new Date(session.expiresAt))) {
        return res.status(410).json({
          success: false,
          code: 'SESSION_EXPIRED',
          message: "Your KYC session has expired. Please start a new session."
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

      if (!session.isActive || (session.expiresAt && new Date() > new Date(session.expiresAt))) {
        return res.status(410).json({
          success: false,
          code: 'SESSION_EXPIRED',
          message: "Your KYC session has expired. Please start a new session."
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
        ckycFetched: !!(stepStatus.ckyc_fetched || (session as any).ckycFetched),
        aadhaarVerified: !!(stepStatus.aadhaar_verified || session.aadhaarVerified),
        riskProfilingDone: !!stepStatus.risk_profiling,
        complianceSigned: true,
        amlScreened: !!amlRiskLevel,
        amlRiskLevel: amlRiskLevel,
      });

      const aadhaarVerifiedFlag = !!(stepStatus.aadhaar_verified || session.aadhaarVerified);

      const riskProfile = (session as any).riskProfileData || {};

      await db.update(schema.userProfiles)
        .set({
          kycLevel: '2',
          kycLevelUpgradedAt: new Date(),
          isProfileCompleted: true,
          profileCompletedAt: new Date(),
          kraVerifiedViaProtean: !!stepStatus.kra_verified,
          panVerifiedViaSmartKyc: true,
          aadhaarVerifiedViaSmartKyc: aadhaarVerifiedFlag,
          kycTier: tierResult.kyc_tier,
          kycTierStatus: tierResult.tier_status,
          kycTierUpgradedAt: new Date(),
          fatcaDeclarationDate: new Date(),
          
          // Sync Risk Profile fields
          investmentObjective: riskProfile.investmentObjective,
          investmentTimeHorizon: riskProfile.investmentHorizon,
          investmentRiskTolerance: riskProfile.riskTolerance,
          riskTolerance: riskProfile.riskTolerance, // Duplicate for legacy support
          annualIncome: riskProfile.incomeLevel,
          annualIncomeAmount: riskProfile.incomeLevel,
          investmentExperience: riskProfile.tradingExperience,
          
          // Advanced fields for Alpaca / Options
          netWorth: riskProfile.netWorth,
          liquidNetWorth: riskProfile.liquidNetWorth,
          liquidityNeeds: riskProfile.liquidityNeeds,
          numberOfDependents: riskProfile.numberOfDependents ? parseInt(riskProfile.numberOfDependents) : 0,
        } as any)
        .where(eq(schema.userProfiles.userId, userId));

      // Save PAN number, verified flags, and smartKycCompletedAt to users table
      try {
        let decryptedPan: string | null = null;
        if (session.panNumber) {
          try {
            decryptedPan = await PANConsentService.decryptPAN(session.panNumber);
          } catch {
            decryptedPan = session.panNumber;
          }
        }

        const panVerificationData = session.panVerificationData as any;
        const aadhaarVerificationData = session.aadhaarVerificationData as any;

        const usersUpdate: Record<string, any> = {
          smartKycCompletedAt: new Date(),
          panVerifiedViaSmartKyc: true,
          aadhaarVerifiedViaSmartKyc: aadhaarVerifiedFlag,
          panVerificationDate: session.panVerifiedAt || new Date(),
          aadhaarVerificationDate: aadhaarVerifiedFlag ? (session.aadhaarVerifiedAt || new Date()) : null,
        };
        if (decryptedPan) {
          usersUpdate.panNumber = decryptedPan;
        }
        // NOTE: Do NOT store full Aadhaar number — UIDAI guidelines prohibit it.
        // aadhaarVerifiedViaSmartKyc flag already marks Aadhaar as verified.
        await db.update(schema.users)
          .set(usersUpdate)
          .where(eq(schema.users.id, userId));

        // Save name / DOB from PAN verification data to userProfiles if missing
        const existingProfile = await db.query.userProfiles.findFirst({
          where: eq(schema.userProfiles.userId, userId),
        });
        const profileUpdate: Record<string, any> = {};
        if (decryptedPan && !existingProfile?.panNumber) {
          profileUpdate.panNumber = decryptedPan;
        }
        if (!existingProfile?.firstName && panVerificationData?.name) {
          const nameParts = (panVerificationData.name as string).trim().split(/\s+/);
          if (nameParts.length >= 2) {
            profileUpdate.firstName = nameParts[0];
            profileUpdate.lastName = nameParts.slice(1).join(' ');
          } else {
            profileUpdate.firstName = nameParts[0] || '';
          }
        }
        if (!existingProfile?.dateOfBirth && (panVerificationData?.dob || session.panDob)) {
          profileUpdate.dateOfBirth = panVerificationData?.dob || session.panDob;
        }
        if (Object.keys(profileUpdate).length > 0) {
          await db.update(schema.userProfiles)
            .set(profileUpdate)
            .where(eq(schema.userProfiles.userId, userId));
        }
      } catch (saveErr) {
        console.error('[KYC] Non-fatal: failed to save PAN/name to users table after KYC completion:', saveErr);
      }

      await kycOrchestratorService.logAuditEvent({
        userId,
        action: 'KYC_COMPLETED',
        step: 'compliance_signoff',
        details: { tier: tierResult.kyc_tier, tier_status: tierResult.tier_status, level: 2 },
        performedBy: userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Populate kycVault with full verified status and timestamps
      // This is the single source of truth for KYC reuse across all products
      try {
        const kycExpiryDate = new Date();
        kycExpiryDate.setFullYear(kycExpiryDate.getFullYear() + 2); // SEBI: 2-year KYC validity
        const kycNextRenewalDate = new Date();
        kycNextRenewalDate.setFullYear(kycNextRenewalDate.getFullYear() + 1); // Annual review

        const vaultPayload = {
          userId,
          kycStatus: 'verified' as const,
          source: 'smart_kyc_wizard',
          verificationMethod: 'aadhaar_otp',
          isReusable: true,
          panVerifiedAt: session.panVerifiedAt || new Date(),
          aadhaarVerifiedAt: session.aadhaarVerifiedAt || new Date(),
          addressVerifiedAt: session.aadhaarVerifiedAt || new Date(),
          kycVerifiedAt: new Date(),
          kycExpiryDate,
          kycNextRenewalDate,
          isExpired: false,
          updatedAt: new Date(),
        };

        const existingVaultFinal = await db.select({ id: schema.kycVault.id })
          .from(schema.kycVault).where(eq(schema.kycVault.userId, userId)).limit(1);

        if (existingVaultFinal.length > 0) {
          await db.update(schema.kycVault).set(vaultPayload).where(eq(schema.kycVault.userId, userId));
        } else {
          await db.insert(schema.kycVault).values({ ...vaultPayload, createdAt: new Date() });
        }
        console.log('[KYC] kycVault populated with verified status for user:', userId);
        // Invalidate caches so next sufficiency and compliance checks reflect new vault state
        try {
          const { invalidateSufficiencyCache } = await import('../../services/kyc-sufficiency-service');
          invalidateSufficiencyCache(userId);
        } catch { /* non-fatal */ }
        try {
          const { invalidateComplianceCache } = await import('../../middleware/universal-kyc-gate');
          invalidateComplianceCache(userId);
        } catch { /* non-fatal */ }
      } catch (vaultErr) {
        console.warn('[KYC] Non-fatal: failed to populate kycVault after compliance signoff:', vaultErr);
      }

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
      
      // PAN is locked if verified via any method (Sandbox API, Smart KYC wizard, or manual KYC)
      const panIsVerified = !!(
        userProfile?.panVerifiedViaSandbox ||
        userProfile?.panSandboxStatus === 'VALID' ||
        userProfile?.panVerifiedViaSmartKyc
      );
      if (panIsVerified) {
        lockedFields.push('panNumber');
        lockReasons['panNumber'] = 'PAN verified — locked per SEBI guidelines. Use the Re-KYC request form to request a correction.';
      }
      
      // DOB is locked only if PAN is verified AND DOB already has a value
      if (panIsVerified && userProfile?.dateOfBirth) {
        lockedFields.push('dateOfBirth');
        lockReasons['dateOfBirth'] = 'Date of birth verified via PAN — locked per SEBI guidelines. Use the Re-KYC request form to request a correction.';
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
}
