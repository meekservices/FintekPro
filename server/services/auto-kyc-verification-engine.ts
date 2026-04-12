/**
 * Auto-KYC Verification Engine
 *
 * Orchestrates fully automated KYC verification using Sandbox.co.in and Cashfree APIs.
 * No manual admin intervention required. After successful verification, compliance flags
 * are written directly to the database and the KYC compliance cache is invalidated so
 * the user gains access immediately.
 *
 * Policy:
 *  - PAN + Aadhaar + Bank = Level 1 (browse + transact on Iris/Alpaca-backed instruments)
 *  - CKYC found → Level 2 eligible (full investment product access)
 *  - CKYC not found → Level 1 granted; instrument gateway (Iris/Alpaca) handles CKYC at order time
 *  - Re-KYC attempts are rate-limited: 3/year for users, 2/year for partners
 */

import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { kycOrchestrationEngine } from './kyc-orchestration-engine';
import { kycRateLimiterService } from './kyc-rate-limiter-service';
import { adminParallelNotifier, notifyKycAutoRejected, notifyPartnerKycSubmitted } from './admin-parallel-notifier';
import { logger } from '../logger';

export type AutoKycRole = 'user' | 'client' | 'business_client' | 'partner' | 'agent' | 'sub_agent' | 'associate' | 'partner_ops';

export interface AutoKycPayload {
  userId: string;
  role: AutoKycRole;
  /** Individual / COMPANY / LLP / PARTNERSHIP / TRUST / HUF */
  entityType?: string;
  pan: string;
  panName: string;
  /** DOB in DD/MM/YYYY */
  dob?: string;
  aadhaarNumber?: string;
  /** Pre-verified Aadhaar OTP refId  */
  aadhaarRefId?: string;
  /** OTP entered by user */
  aadhaarOtp?: string;
  bankAccountNo: string;
  bankIfsc: string;
  /** For business entities */
  gstin?: string;
  /** CIN / Company Registration Number */
  companyRegistrationNumber?: string;
  partnerName?: string;
  ipAddress?: string;
}

export interface AutoKycResult {
  success: boolean;
  kycLevel: '0' | '1' | '2';
  message: string;
  details: {
    panVerified: boolean;
    aadhaarVerified: boolean;
    bankVerified: boolean;
    ckycFound: boolean;
    gstinVerified?: boolean;
    mcaVerified?: boolean;
  };
  attemptsRemaining?: number;
  errorCode?: string;
}

const PARTNER_ROLES: AutoKycRole[] = ['partner', 'agent', 'sub_agent', 'associate', 'partner_ops'];

function getRateLimitKey(role: AutoKycRole): string {
  return PARTNER_ROLES.includes(role) ? 'rekyc_attempt_partner' : 'rekyc_attempt_user';
}

class AutoKycVerificationEngine {

  async verify(payload: AutoKycPayload): Promise<AutoKycResult> {
    const { userId, role, pan, panName, dob, aadhaarOtp, aadhaarRefId, aadhaarNumber, bankAccountNo, bankIfsc, gstin, companyRegistrationNumber } = payload;

    // ── Rate limit check ───────────────────────────────────────────────────────
    const limitKey = getRateLimitKey(role);
    const limit = await kycRateLimiterService.checkLimit(limitKey, userId);
    if (!limit.allowed) {
      const msg = `KYC attempt limit reached. You have used all allowed re-KYC attempts. Contact support for assistance.`;
      adminParallelNotifier.dispatch({
        taskType: 'REKYC_LIMIT_REACHED',
        title: `Re-KYC limit reached for ${role}`,
        body: `User ${userId} (role: ${role}) has exhausted all re-KYC attempts. Admin can unlock via the admin portal if appropriate.`,
        affectedUserId: userId,
        priority: 'medium',
        metadata: { userId, role, limitKey },
      });
      return {
        success: false,
        kycLevel: '0',
        message: msg,
        errorCode: 'REKYC_LIMIT_EXCEEDED',
        details: { panVerified: false, aadhaarVerified: false, bankVerified: false, ckycFound: false },
        attemptsRemaining: 0,
      };
    }

    // Notify admin that a partner has submitted KYC (info only — no action needed yet)
    if (PARTNER_ROLES.includes(role) && payload.partnerName) {
      notifyPartnerKycSubmitted({
        userId,
        partnerName: payload.partnerName,
        entityType: payload.entityType ?? 'INDIVIDUAL',
      });
    }

    // ── Fire verifications in parallel ────────────────────────────────────────
    const productType = PARTNER_ROLES.includes(role) ? 'partner_kyc' : 'client_kyc';

    const tasks: Promise<any>[] = [
      // PAN verification
      kycOrchestrationEngine.executeVerification({
        userId,
        kycStep: 'pan_verification',
        productType,
        payload: { pan: pan.toUpperCase(), name: panName, dob: dob ?? '', reason: 'KYC verification' },
        ipAddress: payload.ipAddress,
      }),

      // Bank penny-drop verification
      kycOrchestrationEngine.executeVerification({
        userId,
        kycStep: 'bank_verification',
        productType,
        payload: { accountNo: bankAccountNo, ifsc: bankIfsc.toUpperCase(), accountHolderName: panName },
        ipAddress: payload.ipAddress,
      }),

      // CKYC lookup (non-blocking — KYC can proceed even if not found)
      kycOrchestrationEngine.executeVerification({
        userId,
        kycStep: 'ckyc_kra_check',
        productType,
        payload: { pan: pan.toUpperCase(), name: panName, dob: dob ?? '' },
        ipAddress: payload.ipAddress,
      }),
    ];

    // Aadhaar OTP verification (if OTP was provided)
    if (aadhaarRefId && aadhaarOtp) {
      tasks.push(kycOrchestrationEngine.executeVerification({
        userId,
        kycStep: 'aadhaar_otp_verify',
        productType,
        payload: { subStep: 'verify_otp', refId: aadhaarRefId, otp: aadhaarOtp },
        ipAddress: payload.ipAddress,
      }));
    }

    // Business entity checks (GSTIN + MCA)
    if (gstin) {
      tasks.push(kycOrchestrationEngine.executeVerification({
        userId,
        kycStep: 'gstin_verify',
        productType,
        payload: { gstin },
        ipAddress: payload.ipAddress,
      }));
    }
    if (companyRegistrationNumber) {
      tasks.push(kycOrchestrationEngine.executeVerification({
        userId,
        kycStep: 'mca_verify',
        productType,
        payload: { cin: companyRegistrationNumber },
        ipAddress: payload.ipAddress,
      }));
    }

    const results = await Promise.allSettled(tasks);

    const [panResult, bankResult, ckycResult, ...extraResults] = results;

    const panVerified = panResult.status === 'fulfilled' && panResult.value?.success === true;
    const bankVerified = bankResult.status === 'fulfilled' && bankResult.value?.success === true;
    const ckycFound = ckycResult.status === 'fulfilled' && ckycResult.value?.success === true;

    let aadhaarVerified = false;
    let gstinVerified = false;
    let mcaVerified = false;

    // Parse extra results based on what was submitted
    let extraIdx = 0;
    if (aadhaarRefId && aadhaarOtp && extraResults[extraIdx]) {
      const r = extraResults[extraIdx];
      aadhaarVerified = r.status === 'fulfilled' && r.value?.success === true;
      extraIdx++;
    }
    if (gstin && extraResults[extraIdx]) {
      const r = extraResults[extraIdx];
      gstinVerified = r.status === 'fulfilled' && r.value?.success === true;
      extraIdx++;
    }
    if (companyRegistrationNumber && extraResults[extraIdx]) {
      const r = extraResults[extraIdx];
      mcaVerified = r.status === 'fulfilled' && r.value?.success === true;
      extraIdx++;
    }

    logger.info('[AutoKycEngine] Verification results', {
      userId,
      panVerified,
      aadhaarVerified,
      bankVerified,
      ckycFound,
      gstinVerified,
      mcaVerified,
    });

    // ── Compute KYC level ─────────────────────────────────────────────────────
    // Level 1: PAN + Bank (mandatory). Aadhaar strengthens but isn't always mandatory
    // if CKYC is found (CKYC contains verified address).
    const hasLevel1 = panVerified && bankVerified;
    // Level 2: Level 1 + CKYC found OR Aadhaar verified
    const hasLevel2 = hasLevel1 && (ckycFound || aadhaarVerified);

    const kycLevel: '0' | '1' | '2' = hasLevel2 ? '2' : hasLevel1 ? '1' : '0';

    // ── Write results to DB ───────────────────────────────────────────────────
    if (hasLevel1) {
      await this.writeVerificationFlags({
        userId,
        panVerified,
        ckycFound,
        aadhaarVerified,
        bankVerified,
        kycLevel,
        panVerificationData: panResult.status === 'fulfilled' ? panResult.value?.data : undefined,
        ckycData: ckycResult.status === 'fulfilled' ? ckycResult.value?.data : undefined,
      });

      // Increment re-KYC counter only on successful attempts
      await kycRateLimiterService.incrementCounter(limitKey, userId);

      const remaining = Math.max(0, limit.remaining - 1);

      return {
        success: true,
        kycLevel,
        message: kycLevel === '2'
          ? 'KYC verification complete. You now have full access to all investment products.'
          : 'KYC verification approved. You can now transact on the platform.',
        details: { panVerified, aadhaarVerified, bankVerified, ckycFound, gstinVerified, mcaVerified },
        attemptsRemaining: remaining,
      };
    }

    // ── Handle failure ────────────────────────────────────────────────────────
    const failureReasons: string[] = [];
    if (!panVerified) failureReasons.push('PAN verification failed');
    if (!bankVerified) failureReasons.push('Bank account verification failed');

    await kycRateLimiterService.incrementCounter(limitKey, userId);

    const remaining = Math.max(0, limit.remaining - 1);

    notifyKycAutoRejected({
      userId,
      role,
      reason: failureReasons.join('; '),
      attemptsRemaining: remaining,
    });

    return {
      success: false,
      kycLevel: '0',
      message: `KYC verification failed. Reason: ${failureReasons.join(', ')}. You have ${remaining} attempt(s) remaining.`,
      errorCode: 'KYC_VERIFICATION_FAILED',
      details: { panVerified, aadhaarVerified, bankVerified, ckycFound, gstinVerified, mcaVerified },
      attemptsRemaining: remaining,
    };
  }

  private async writeVerificationFlags(params: {
    userId: string;
    panVerified: boolean;
    ckycFound: boolean;
    aadhaarVerified: boolean;
    bankVerified: boolean;
    kycLevel: '0' | '1' | '2';
    panVerificationData?: any;
    ckycData?: any;
  }): Promise<void> {
    const { userId, panVerified, ckycFound, aadhaarVerified, bankVerified, kycLevel } = params;

    try {
      const profileUpdate: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (panVerified) {
        profileUpdate.panVerifiedViaSandbox = true;
        profileUpdate.panVerificationDate = new Date();
        profileUpdate.kycLevel = kycLevel;
      }

      // If CKYC was found, set the flag that the kyc-level-gate reads
      // This is the key fix: admin was previously setting this manually
      if (ckycFound) {
        profileUpdate.ckycFetchedViaAuthBridge = true;
        profileUpdate.ckycAuthBridgeStatus = 'found';
      }

      if (aadhaarVerified) {
        profileUpdate.aadhaarVerifiedViaSmartKyc = true;
        profileUpdate.aadhaarVerificationDate = new Date();
      }

      // isProfileCompleted = true when Level 1 is reached — no admin step needed
      if (panVerified && bankVerified) {
        profileUpdate.isProfileCompleted = true;
        profileUpdate.profileCompletedAt = new Date();
        profileUpdate.kycTier = kycLevel === '2' ? 'enhanced' : 'basic';
        profileUpdate.kycTierUpgradedAt = new Date();
      }

      // Upsert the profile
      const [existing] = await db.select({ userId: schema.userProfiles.userId })
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId))
        .limit(1);

      if (existing) {
        await db.update(schema.userProfiles)
          .set(profileUpdate)
          .where(eq(schema.userProfiles.userId, userId));
      } else {
        await db.insert(schema.userProfiles).values({
          userId,
          ...profileUpdate,
        });
      }

      // Verify bank account record
      if (bankVerified) {
        const [existingBank] = await db.select({ id: schema.userBankAccounts.id })
          .from(schema.userBankAccounts)
          .where(and(
            eq(schema.userBankAccounts.userId, userId),
            eq(schema.userBankAccounts.isVerified, false),
          ))
          .limit(1);

        if (existingBank) {
          await db.update(schema.userBankAccounts)
            .set({ isVerified: true, verifiedAt: new Date() })
            .where(eq(schema.userBankAccounts.id, existingBank.id));
        }
      }

      // Invalidate compliance cache so kyc-level-gate picks up new flags instantly
      try {
        const { invalidateComplianceCache } = await import('../middleware/universal-kyc-gate');
        await invalidateComplianceCache(userId);
      } catch (cacheErr) {
        // Non-fatal — gate will re-compute on next request
        logger.warn('[AutoKycEngine] Failed to invalidate compliance cache', { userId });
      }

      logger.info('[AutoKycEngine] Verification flags written to DB', { userId, kycLevel });
    } catch (err) {
      logger.error('[AutoKycEngine] Failed to write verification flags', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}

export const autoKycVerificationEngine = new AutoKycVerificationEngine();
