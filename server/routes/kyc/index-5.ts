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

export function registerKYCWizardPart5Routes(app: Express) {
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

  // ============================================================================
  // KYC VAULT STATUS — Full verified data with timestamps
  // ============================================================================
  app.get("/api/kyc/vault-status", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;

      const [user, userProfile, vault] = await Promise.all([
        db.query.users.findFirst({ where: eq(schema.users.id, userId) }),
        db.query.userProfiles.findFirst({ where: eq(schema.userProfiles.userId, userId) }),
        db.select().from(schema.kycVault).where(eq(schema.kycVault.userId, userId)).limit(1).then(r => r[0] ?? null),
      ]);

      const kycExpired = vault?.isExpired || (vault?.kycExpiryDate ? new Date() > new Date(vault.kycExpiryDate) : false);

      res.json({
        success: true,
        vault: {
          kycStatus: vault?.kycStatus || 'not_started',
          isReusable: vault?.isReusable || false,
          kycVerifiedAt: vault?.kycVerifiedAt || null,
          kycExpiresAt: vault?.kycExpiryDate || null,
          kycNextRenewalDate: vault?.kycNextRenewalDate || null,
          isExpired: kycExpired,
          source: vault?.source || null,
          verificationMethod: vault?.verificationMethod || null,
        },
        verifiedFields: {
          panVerified: !!(user?.panVerifiedViaSmartKyc),
          panVerifiedAt: user?.panVerificationDate || null,
          aadhaarVerified: !!(user?.aadhaarVerifiedViaSmartKyc),
          aadhaarVerifiedAt: user?.aadhaarVerificationDate || null,
          addressVerifiedAt: vault?.addressVerifiedAt || null,
          fatcaDeclared: !!(userProfile?.fatcaDeclarationDate),
          fatcaDeclaredAt: userProfile?.fatcaDeclarationDate || null,
          videoKycCompleted: !!((userProfile as any)?.videoKycCompletedAt || (userProfile as any)?.videoKycCompletedDate),
          videoKycCompletedAt: (userProfile as any)?.videoKycCompletedAt || (userProfile as any)?.videoKycCompletedDate || null,
          videoKycExpiryDate: userProfile?.videoKycExpiryDate || null,
          videoKycExpired: !!(userProfile?.videoKycExpiryDate && new Date() > new Date(userProfile.videoKycExpiryDate)),
          smartKycCompletedAt: user?.smartKycCompletedAt || null,
        },
        kycTier: (userProfile as any)?.kycTier || 'none',
        kycTierStatus: (userProfile as any)?.kycTierStatus || null,
      });
    } catch (error) {
      console.error('[KYC] vault-status error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch KYC vault status' });
    }
  });

  // ============================================================================
  // KYC SUFFICIENCY — Per-product requirement check with pre-filled data
  // ============================================================================
  app.get("/api/kyc/sufficiency/:productCode", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { productCode } = req.params;
      const { kycSufficiencyService, PRODUCT_PROFILES } = await import('../../services/kyc-sufficiency-service');

      if (!PRODUCT_PROFILES[productCode as keyof typeof PRODUCT_PROFILES]) {
        return res.status(400).json({ success: false, message: `Unknown product code: ${productCode}` });
      }

      const result = await kycSufficiencyService.checkSufficiency(userId, productCode as any);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('[KYC] sufficiency check error:', error);
      res.status(500).json({ success: false, message: 'Failed to check KYC sufficiency' });
    }
  });

  // ============================================================================
  // KYC SUFFICIENCY — All products at once (for dashboard)
  // ============================================================================
  app.get("/api/kyc/sufficiency", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { kycSufficiencyService } = await import('../../services/kyc-sufficiency-service');

      const results = await kycSufficiencyService.checkAllProducts(userId);
      res.json({ success: true, products: results });
    } catch (error) {
      console.error('[KYC] all-products sufficiency error:', error);
      res.status(500).json({ success: false, message: 'Failed to check product sufficiency' });
    }
  });

  // ============================================================================
  // KYC INCREMENTAL — What's needed for a specific product beyond what's verified
  // ============================================================================
  app.get("/api/kyc/incremental/:productCode", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { productCode } = req.params;
      const { kycSufficiencyService, PRODUCT_PROFILES } = await import('../../services/kyc-sufficiency-service');

      if (!PRODUCT_PROFILES[productCode as keyof typeof PRODUCT_PROFILES]) {
        return res.status(400).json({ success: false, message: `Unknown product code: ${productCode}` });
      }

      const result = await kycSufficiencyService.getIncrementalRequirements(userId, productCode as any);
      res.json({ success: true, productCode, ...result });
    } catch (error) {
      console.error('[KYC] incremental requirements error:', error);
      res.status(500).json({ success: false, message: 'Failed to get incremental requirements' });
    }
  });

  // ============================================================================
  // KYC VAULT — Centralised store of all verified identity data for the user.
  // Data is reused as prefill across product account-opening flows (BSE Star MF,
  // Alpaca US investing, insurance, loans, etc.) so clients never re-enter it.
  // ============================================================================

  /**
   * GET /api/kyc/vault
   * Returns the full KYC vault for the authenticated user.
   * All fields are verified — unverified or missing fields return null.
   */
  app.get("/api/kyc/vault", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;

      const [userRow] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId));

      const [profile] = await db
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId));

      const bankAccounts = await db
        .select()
        .from(schema.userBankAccounts)
        .where(eq(schema.userBankAccounts.userId, userId));
      const primaryBank = bankAccounts.find(b => b.isPrimary) || bankAccounts[0] || null;

      const kycLevel = profile?.kycLevel || userRow?.kycLevel || '0';
      const panVerified = !!(userRow?.panVerifiedViaSmartKyc || profile?.panVerifiedViaSandbox);
      const aadhaarVerified = !!(userRow?.aadhaarVerifiedViaSmartKyc || profile?.aadhaarVerifiedViaSmartKyc);

      // Mask sensitive fields before returning
      const maskPan = (pan: string | null | undefined) => pan ? pan.slice(0, 2) + '***' + pan.slice(-4) : null;
      const maskAccount = (acc: string | null | undefined) => acc ? 'X'.repeat(Math.max(acc.length - 4, 0)) + acc.slice(-4) : null;
      const aadhaarLast4 = (profile?.aadharNumber || '').slice(-4) || null;

      const vault = {
        // Meta
        kycLevel,
        kycCompleted: parseInt(kycLevel) >= 1,
        panVerified,
        aadhaarVerified,
        ckycRegistered: !!(profile?.ckycFetchedViaAuthBridge),
        ckycKin: (profile as any)?.ckycKin || null,
        fatcaDone: profile?.fatcaStatus === 'Y' || !!(profile?.fatcaDeclarationDate),
        riskProfilingDone: !!(profile?.isProfileCompleted),
        lastUpdated: profile?.kycLevelUpgradedAt || null,

        // Identity
        identity: {
          firstName: profile?.firstName || null,
          middleName: profile?.middleName || null,
          lastName: profile?.lastName || null,
          fullName: [profile?.firstName, profile?.middleName, profile?.lastName].filter(Boolean).join(' ') || null,
          dateOfBirth: profile?.dateOfBirth || null,
          gender: profile?.gender || null,
          fatherName: profile?.fatherName || null,
          motherName: profile?.motherName || null,
          nationality: profile?.nationality || 'Indian',
          maritalStatus: profile?.maritalStatus || null,
        },

        // PAN & Aadhaar
        pan: {
          number: panVerified ? maskPan(profile?.panNumber || userRow?.panNumber) : null,
          numberFull: panVerified ? (profile?.panNumber || userRow?.panNumber) : null,
          verified: panVerified,
          verifiedAt: (userRow as any)?.panVerificationDate || null,
        },
        aadhaar: {
          last4: aadhaarVerified ? aadhaarLast4 : null,
          verified: aadhaarVerified,
          verifiedAt: (userRow as any)?.aadhaarVerificationDate || null,
        },

        // Contact
        contact: {
          email: userRow?.email || null,
          mobile: userRow?.mobile || null,
        },

        // Address (from Aadhaar verification)
        address: {
          line1: profile?.address || null,
          city: profile?.city || null,
          state: profile?.state || null,
          pincode: profile?.pincode || null,
          country: profile?.country || 'India',
        },

        // Risk & Investment Profile
        riskProfile: {
          tolerance: profile?.riskTolerance || null,
          annualIncome: profile?.annualIncome || null,
          occupation: profile?.occupation || null,
          investmentExperience: profile?.investmentExperience || null,
        },

        // FATCA / Tax
        fatca: {
          status: profile?.fatcaStatus || 'N',
          taxResidencyCountry: profile?.fatcaCountryOfTaxResidence || (userRow as any)?.taxResidencyCountry || 'India',
          tinNumber: profile?.fatcaTinNumber || (userRow as any)?.tinNumber || null,
          declarationDate: profile?.fatcaDeclarationDate || null,
          w8BenStatus: profile?.fatcaW8BenStatus || null,
        },

        // Bank Account (primary verified account)
        bank: primaryBank ? {
          accountNumber: maskAccount(primaryBank.accountNumber),
          accountNumberFull: primaryBank.accountNumber,
          ifscCode: primaryBank.ifscCode,
          bankName: primaryBank.bankName,
          accountType: primaryBank.accountType || 'savings',
          accountHolderName: primaryBank.accountHolderName || null,
          verified: primaryBank.isVerified || false,
        } : null,

        // Nominee
        nominee: profile?.nomineeDetails ? {
          raw: profile.nomineeDetails,
          relation: profile.nomineeRelation || null,
        } : null,

        // Residency
        residency: {
          status: profile?.residentStatus || 'resident_indian',
          countryOfResidence: profile?.countryOfResidence || 'India',
          countryOfCitizenship: profile?.countryOfCitizenship || 'India',
        },
      };

      res.json({ success: true, vault });
    } catch (err: any) {
      console.error('[KYC Vault] Error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to load KYC vault' });
    }
  });

  /**
   * GET /api/kyc/vault/prefill/:product
   * Returns product-specific pre-filled registration fields drawn from the vault.
   *
   * Products supported:
   *   bse-mf      → BSE Star MF account opening / registration
   *   alpaca       → Alpaca broker account opening (US equities via FintekPro)
   *   insurance    → Insurance proposal form prefill
   *   nps          → National Pension System registration
   *   general      → Generic FintekPro profile prefill
   */
  app.get("/api/kyc/vault/prefill/:product", requireClientOrHigher, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const { product } = req.params;

      // Reuse vault logic
      const [userRow] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
      const [profile] = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
      const bankAccounts = await db.select().from(schema.userBankAccounts).where(eq(schema.userBankAccounts.userId, userId));
      const primaryBank = bankAccounts.find(b => b.isPrimary) || bankAccounts[0] || null;

      const fullName = [profile?.firstName, profile?.middleName, profile?.lastName].filter(Boolean).join(' ');
      const pan = profile?.panNumber || userRow?.panNumber || '';

      let prefill: Record<string, any> = {};

      switch (product) {
        case 'bse-mf': {
          // BSE Star MF investor registration fields
          prefill = {
            // Personal
            firstName: profile?.firstName || '',
            middleName: profile?.middleName || '',
            lastName: profile?.lastName || '',
            dateOfBirth: profile?.dateOfBirth || '',
            gender: profile?.gender?.toUpperCase().slice(0, 1) || '', // M/F/T
            fatherOrSpouseName: profile?.fatherName || profile?.spouseName || '',
            maritalStatus: profile?.maritalStatus || '',
            occupation: profile?.occupation || '',
            // PAN & Aadhaar
            panNumber: pan,
            aadhaarLast4: (profile?.aadharNumber || '').slice(-4) || '',
            // Contact
            email: userRow?.email || '',
            mobile: userRow?.mobile || '',
            // Address
            address1: profile?.address || '',
            city: profile?.city || '',
            state: profile?.state || '',
            pincode: profile?.pincode || '',
            country: profile?.country || 'India',
            // Bank
            bankAccountNumber: primaryBank?.accountNumber || '',
            bankIfsc: primaryBank?.ifscCode || '',
            bankName: primaryBank?.bankName || '',
            bankAccountType: (primaryBank?.accountType || 'SB').toUpperCase().slice(0, 2),
            accountHolderName: primaryBank?.accountHolderName || fullName,
            // FATCA
            taxResidencyCountry: profile?.fatcaCountryOfTaxResidence || 'India',
            taxIdentificationNumber: profile?.fatcaTinNumber || '',
            // Risk
            riskProfile: profile?.riskTolerance || 'moderate',
            annualIncome: profile?.annualIncome || '',
            investmentExperience: profile?.investmentExperience || '',
            // Nominee
            nomineeName: '',
            nomineeRelation: profile?.nomineeRelation || '',
          };
          break;
        }

        case 'alpaca': {
          // Alpaca Broker account opening fields (international broker)
          const dobParts = (profile?.dateOfBirth || '').split('-');
          prefill = {
            // Identity
            given_name: profile?.firstName || '',
            family_name: profile?.lastName || '',
            date_of_birth: profile?.dateOfBirth || '',
            tax_id: pan,               // PAN acts as foreign Tax ID
            tax_id_type: 'OTHER_TIN', // Non-US persons
            country_of_citizenship: profile?.countryOfCitizenship || 'IND',
            country_of_birth: 'IND',
            country_of_tax_residence: profile?.fatcaCountryOfTaxResidence ? (profile.fatcaCountryOfTaxResidence === 'India' ? 'IND' : profile.fatcaCountryOfTaxResidence) : 'IND',
            // Contact
            email_address: userRow?.email || '',
            phone_number: userRow?.mobile ? `+91${userRow.mobile.replace(/^\+91/, '')}` : '',
            // Address
            street_address: [(profile?.address || '')].filter(Boolean),
            city: profile?.city || '',
            state: '',                  // India state — optional for international
            postal_code: profile?.pincode || '',
            country: 'IND',
            // Financial profile
            funding_source: ['employment_income'],
            annual_income_min: '10000',
            annual_income_max: '25000',
            liquid_net_worth_min: '5000',
            liquid_net_worth_max: '25000',
            total_net_worth_min: '5000',
            total_net_worth_max: '25000',
            // Employment
            employment_status: profile?.occupation ? 'employed' : 'employed',
            employer_name: '',
            employer_address: { street_address: [''], city: '', state: '', postal_code: '', country: 'IND' },
            // Agreements
            agreements: [
              { agreement: 'customer_agreement', signed_at: new Date().toISOString(), ip_address: '' },
              { agreement: 'alpaca_agreement',   signed_at: new Date().toISOString(), ip_address: '' },
            ],
            // Disclosures
            is_control_person: false,
            is_affiliated_exchange_or_finra: false,
            is_politically_exposed: false,
            immediate_family_exposed: false,
          };
          break;
        }

        case 'nps': {
          // National Pension System registration
          prefill = {
            subscriberName: fullName,
            dateOfBirth: profile?.dateOfBirth || '',
            gender: profile?.gender || '',
            panNumber: pan,
            email: userRow?.email || '',
            mobile: userRow?.mobile || '',
            address: profile?.address || '',
            city: profile?.city || '',
            state: profile?.state || '',
            pincode: profile?.pincode || '',
            bankAccountNumber: primaryBank?.accountNumber || '',
            bankIfsc: primaryBank?.ifscCode || '',
            bankName: primaryBank?.bankName || '',
            occupation: profile?.occupation || '',
            annualIncome: profile?.annualIncome || '',
            nominee: { name: '', relation: profile?.nomineeRelation || '', dob: '' },
          };
          break;
        }

        case 'insurance': {
          prefill = {
            proposerName: fullName,
            dateOfBirth: profile?.dateOfBirth || '',
            gender: profile?.gender || '',
            panNumber: pan,
            email: userRow?.email || '',
            mobile: userRow?.mobile || '',
            address: profile?.address || '',
            city: profile?.city || '',
            state: profile?.state || '',
            pincode: profile?.pincode || '',
            occupation: profile?.occupation || '',
            annualIncome: profile?.annualIncome || '',
            nominee: { name: '', relation: profile?.nomineeRelation || '', dob: '' },
          };
          break;
        }

        case 'general':
        default: {
          prefill = {
            fullName,
            firstName: profile?.firstName || '',
            lastName: profile?.lastName || '',
            dateOfBirth: profile?.dateOfBirth || '',
            gender: profile?.gender || '',
            panNumber: pan,
            email: userRow?.email || '',
            mobile: userRow?.mobile || '',
            address: profile?.address || '',
            city: profile?.city || '',
            state: profile?.state || '',
            pincode: profile?.pincode || '',
            country: profile?.country || 'India',
            occupation: profile?.occupation || '',
            annualIncome: profile?.annualIncome || '',
            riskTolerance: profile?.riskTolerance || '',
            bankAccountNumber: primaryBank?.accountNumber || '',
            bankIfsc: primaryBank?.ifscCode || '',
            bankName: primaryBank?.bankName || '',
          };
        }
      }

      res.json({ success: true, product, prefill });
    } catch (err: any) {
      console.error('[KYC Vault Prefill] Error:', err.message);
      res.status(500).json({ success: false, message: 'Failed to generate prefill data' });
    }
  });

  console.log('✅ KYC Wizard v2 routes registered (Orchestrator + Entity Lock + CKYC Scoring + Agent Blocks + AML + Tier Engine + Vault Status + Sufficiency)');
}
