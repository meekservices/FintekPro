/**
 * KYC Tier Service
 * 
 * Aggregates user verification status and determines KYC tier eligibility.
 * Handles tier upgrade requests and validation.
 */

import { db } from '../db';
import { users, kycTierUpgradeEvents, productionKycSessions } from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { 
  KycTier, 
  KYC_TIER_METADATA, 
  getNextKycTier, 
  getAccessibleProducts,
  getProductsUnlockedAtTier,
  getLockedProducts,
  isKycTierSufficient
} from '../../shared/kyc-product-eligibility';

export interface TierStatusResponse {
  currentTier: KycTier;
  currentTierName: string;
  currentTierDescription: string;
  eligibleForUpgrade: boolean;
  nextTier: KycTier | null;
  nextTierName: string | null;
  nextTierDescription: string | null;
  completedVerifications: VerificationStatus[];
  missingVerifications: VerificationStatus[];
  unlockedFeatures: string[];
  productsUnlockedAtCurrentTier: string[];
  productsAccessible: number;
  productsLocked: number;
  upgradeRequestedAt: Date | null;
  upgradedAt: Date | null;
}

export interface VerificationStatus {
  code: string;
  name: string;
  completed: boolean;
  completedAt: Date | null;
}

export interface TierUpgradeRequest {
  userId: string;
  targetTier: KycTier;
  requestedBy: string;
  metadata?: Record<string, any>;
}

export interface TierUpgradeResult {
  success: boolean;
  message: string;
  requiresManualApproval: boolean;
  nextSteps?: string[];
  upgradeEventId?: string;
}

/**
 * Get comprehensive tier status for a user
 */
export async function getUserTierStatus(userId: string): Promise<TierStatusResponse> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error('User not found');
  }

  const currentTier: KycTier = (user.kycTier as KycTier) || 'basic';
  const currentTierMeta = KYC_TIER_METADATA[currentTier];
  const nextTier = getNextKycTier(currentTier);
  const nextTierMeta = nextTier ? KYC_TIER_METADATA[nextTier] : null;

  // Check verification status
  const verifications = await checkUserVerifications(userId, user);
  const completedVerifications = verifications.filter(v => v.completed);
  const missingVerifications = verifications.filter(v => !v.completed);

  // Determine eligibility for upgrade
  const eligibleForUpgrade = await isEligibleForUpgrade(userId, currentTier, nextTier, verifications);

  // Get accessible and locked products
  const accessibleProducts = getAccessibleProducts(currentTier);
  const lockedProducts = getLockedProducts(currentTier);
  const currentTierProducts = getProductsUnlockedAtTier(currentTier);

  return {
    currentTier,
    currentTierName: currentTierMeta.label,
    currentTierDescription: currentTierMeta.description,
    eligibleForUpgrade,
    nextTier,
    nextTierName: nextTierMeta?.label || null,
    nextTierDescription: nextTierMeta?.description || null,
    completedVerifications,
    missingVerifications,
    unlockedFeatures: currentTierMeta.productsUnlocked,
    productsUnlockedAtCurrentTier: currentTierProducts.map(p => p.productName),
    productsAccessible: accessibleProducts.length,
    productsLocked: lockedProducts.length,
    upgradeRequestedAt: user.kycTierUpgradeRequestedAt,
    upgradedAt: user.kycTierUpgradedAt
  };
}

/**
 * Check all verifications for a user
 */
async function checkUserVerifications(userId: string, user: any): Promise<VerificationStatus[]> {
  const verifications: VerificationStatus[] = [];

  // Tier 1 (Basic) Requirements
  verifications.push({
    code: 'PAN_VERIFIED',
    name: 'PAN Card Verification',
    completed: user.panVerified || user.panVerifiedViaSmartKyc || false,
    completedAt: user.panVerifiedAt || user.panVerificationDate || null
  });

  verifications.push({
    code: 'AADHAAR_VERIFIED',
    name: 'Aadhaar OKYC',
    completed: user.aadhaarVerified || user.aadhaarVerifiedViaSmartKyc || false,
    completedAt: user.aadhaarVerifiedAt || user.aadhaarVerificationDate || null
  });

  verifications.push({
    code: 'BANK_VERIFIED',
    name: 'Bank Account Verification',
    completed: user.bankAccountVerified || false,
    completedAt: user.bankAccountVerifiedAt || null
  });

  verifications.push({
    code: 'PROFILE_COMPLETE',
    name: 'Basic Profile Completion',
    completed: !!(user.firstName && user.lastName && user.dateOfBirth && user.email),
    completedAt: user.updatedAt || null
  });

  // Tier 2 (Enhanced) Requirements
  verifications.push({
    code: 'VIDEO_KYC',
    name: 'Video KYC Verification',
    completed: user.videoKycCompleted || false,
    completedAt: user.videoKycCompletedDate || null
  });

  verifications.push({
    code: 'INCOME_PROOF',
    name: 'Income Proof Upload',
    completed: user.incomeProofUploaded || false,
    completedAt: user.incomeProofUploadedAt || null
  });

  verifications.push({
    code: 'BANK_STATEMENT',
    name: 'Bank Statement Verification',
    completed: user.bankStatementVerified || false,
    completedAt: user.bankStatementVerifiedAt || null
  });

  // Tier 3 (Accredited Investor) Requirements
  verifications.push({
    code: 'BSE_ACCREDITED',
    name: 'BSE Accredited Investor Certification',
    completed: user.accreditedInvestorStatus === 'verified',
    completedAt: user.accreditedInvestorVerifiedAt || null
  });

  verifications.push({
    code: 'ESIGN_CONSENT',
    name: 'eMudhra eSign Consent',
    completed: user.eSignConsentGiven || false,
    completedAt: user.eSignConsentGivenAt || null
  });

  verifications.push({
    code: 'NET_WORTH_VERIFIED',
    name: 'Net Worth Verification (≥ ₹7.5 Cr)',
    completed: user.netWorthVerified && (user.totalNetWorth >= 75000000 || false),
    completedAt: user.netWorthVerifiedAt || null
  });

  return verifications;
}

/**
 * Check if user is eligible for tier upgrade
 */
async function isEligibleForUpgrade(
  userId: string, 
  currentTier: KycTier, 
  nextTier: KycTier | null,
  verifications: VerificationStatus[]
): Promise<boolean> {
  if (!nextTier) {
    return false; // Already at highest tier
  }

  // Tier 1 → Tier 2: All basic verifications + Enhanced verifications (Video KYC, Income Proof, Bank Statement)
  if (currentTier === 'basic' && nextTier === 'enhanced') {
    const requiredCodes = [
      'PAN_VERIFIED', 'AADHAAR_VERIFIED', 'BANK_VERIFIED', 'PROFILE_COMPLETE',
      'VIDEO_KYC', 'INCOME_PROOF', 'BANK_STATEMENT'
    ];
    return requiredCodes.every(code => verifications.find(v => v.code === code)?.completed);
  }

  // Tier 2 → Tier 3: All enhanced verifications + BSE Accreditation + eSign
  if (currentTier === 'enhanced' && nextTier === 'accredited_investor') {
    const requiredCodes = [
      'PAN_VERIFIED', 'AADHAAR_VERIFIED', 'BANK_VERIFIED', 'PROFILE_COMPLETE',
      'VIDEO_KYC', 'INCOME_PROOF', 'BANK_STATEMENT',
      'BSE_ACCREDITED', 'ESIGN_CONSENT', 'NET_WORTH_VERIFIED'
    ];
    return requiredCodes.every(code => verifications.find(v => v.code === code)?.completed);
  }

  return false;
}

/**
 * Request a tier upgrade
 */
export async function requestTierUpgrade(request: TierUpgradeRequest): Promise<TierUpgradeResult> {
  const { userId, targetTier, requestedBy, metadata } = request;

  // Get current status
  const status = await getUserTierStatus(userId);
  
  // Validate upgrade path
  if (!status.nextTier) {
    return {
      success: false,
      message: 'Already at highest tier',
      requiresManualApproval: false
    };
  }

  if (targetTier !== status.nextTier) {
    return {
      success: false,
      message: `Invalid upgrade path. Next tier should be ${status.nextTier}`,
      requiresManualApproval: false
    };
  }

  if (!status.eligibleForUpgrade) {
    return {
      success: false,
      message: 'Missing required verifications for upgrade',
      requiresManualApproval: false,
      nextSteps: status.missingVerifications.map(v => v.name)
    };
  }

  // Tier 1 → Tier 2: Auto-approve if all verifications complete
  if (status.currentTier === 'basic' && targetTier === 'enhanced') {
    const upgradeEventId = await executeTierUpgrade(userId, 'basic', 'enhanced', 'auto_approved', metadata);
    
    return {
      success: true,
      message: 'Upgrade to Enhanced KYC approved automatically',
      requiresManualApproval: false,
      upgradeEventId
    };
  }

  // Tier 2 → Tier 3: Requires manual approval (compliance review)
  if (status.currentTier === 'enhanced' && targetTier === 'accredited_investor') {
    // Mark upgrade as requested (pending approval)
    await db.update(users)
      .set({
        kycTierUpgradeRequestedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Log upgrade event as pending
    const [upgradeEvent] = await db.insert(kycTierUpgradeEvents).values({
      userId,
      fromTier: 'tier_2',
      toTier: 'tier_3',
      triggerType: 'user_request',
      status: 'pending_compliance_review',
      requestedBy,
      metadata: metadata || {}
    }).returning();

    return {
      success: true,
      message: 'Upgrade request submitted for compliance review',
      requiresManualApproval: true,
      nextSteps: [
        'Compliance team will review your BSE accreditation',
        'eSign consent verification',
        'Net worth documentation review',
        'You will be notified within 2-3 business days'
      ],
      upgradeEventId: upgradeEvent.id
    };
  }

  return {
    success: false,
    message: 'Invalid tier upgrade request',
    requiresManualApproval: false
  };
}

/**
 * Execute tier upgrade (update user tier and log event)
 */
async function executeTierUpgrade(
  userId: string,
  fromTier: string,
  toTier: string,
  approvalType: string,
  metadata?: Record<string, any>
): Promise<string> {
  // Map tier values to schema enums
  const tierMap: Record<string, 'tier_1' | 'tier_2' | 'tier_3'> = {
    'basic': 'tier_1',
    'enhanced': 'tier_2',
    'accredited_investor': 'tier_3'
  };

  // Update user tier
  await db.update(users)
    .set({
      kycTier: toTier,
      kycTierUpgradedAt: new Date(),
      kycTierUpgradeRequestedAt: null // Clear pending request
    })
    .where(eq(users.id, userId));

  // Log upgrade event
  const [upgradeEvent] = await db.insert(kycTierUpgradeEvents).values({
    userId,
    fromTier: tierMap[fromTier],
    toTier: tierMap[toTier],
    triggerType: 'user_request',
    status: approvalType === 'auto_approved' ? 'approved' : 'completed',
    approvedBy: approvalType === 'auto_approved' ? 'system' : null,
    approvedAt: new Date(),
    metadata: metadata || {}
  }).returning();

  return upgradeEvent.id;
}

/**
 * Admin: Approve pending tier upgrade request
 */
export async function approveTierUpgrade(
  eventId: string,
  approvedBy: string,
  notes?: string
): Promise<TierUpgradeResult> {
  // Get upgrade event
  const event = await db.query.kycTierUpgradeEvents.findFirst({
    where: eq(kycTierUpgradeEvents.id, eventId)
  });

  if (!event) {
    return {
      success: false,
      message: 'Upgrade event not found',
      requiresManualApproval: false
    };
  }

  if (event.status !== 'pending_compliance_review') {
    return {
      success: false,
      message: `Cannot approve event with status: ${event.status}`,
      requiresManualApproval: false
    };
  }

  // Map enum to tier string
  const tierEnumMap: Record<string, string> = {
    'tier_1': 'basic',
    'tier_2': 'enhanced',
    'tier_3': 'accredited_investor'
  };

  const fromTier = event.fromTier ? tierEnumMap[event.fromTier] : 'basic';
  const toTier = tierEnumMap[event.toTier];

  // Execute upgrade
  await executeTierUpgrade(event.userId, fromTier, toTier, 'manual_approved', event.metadata);

  // Update event status
  await db.update(kycTierUpgradeEvents)
    .set({
      status: 'approved',
      approvedBy,
      approvedAt: new Date(),
      processingNotes: notes || null
    })
    .where(eq(kycTierUpgradeEvents.id, eventId));

  return {
    success: true,
    message: 'Tier upgrade approved successfully',
    requiresManualApproval: false,
    upgradeEventId: eventId
  };
}

/**
 * Admin: Reject pending tier upgrade request
 */
export async function rejectTierUpgrade(
  eventId: string,
  rejectedBy: string,
  reason: string
): Promise<TierUpgradeResult> {
  // Get upgrade event
  const event = await db.query.kycTierUpgradeEvents.findFirst({
    where: eq(kycTierUpgradeEvents.id, eventId)
  });

  if (!event) {
    return {
      success: false,
      message: 'Upgrade event not found',
      requiresManualApproval: false
    };
  }

  if (event.status !== 'pending_compliance_review') {
    return {
      success: false,
      message: `Cannot reject event with status: ${event.status}`,
      requiresManualApproval: false
    };
  }

  // Update event status
  await db.update(kycTierUpgradeEvents)
    .set({
      status: 'rejected',
      rejectedBy,
      rejectedAt: new Date(),
      rejectionReason: reason,
      processingNotes: reason
    })
    .where(eq(kycTierUpgradeEvents.id, eventId));

  // Clear pending request from user
  await db.update(users)
    .set({
      kycTierUpgradeRequestedAt: null
    })
    .where(eq(users.id, event.userId));

  return {
    success: true,
    message: 'Tier upgrade request rejected',
    requiresManualApproval: false,
    upgradeEventId: eventId
  };
}

/**
 * Get all pending tier upgrade requests (admin function)
 * Returns list of pending upgrade requests with user details
 */
export async function getPendingTierUpgradeRequests() {
  const pendingRequests = await db
    .select({
      eventId: kycTierUpgradeEvents.id,
      userId: kycTierUpgradeEvents.userId,
      fromTier: kycTierUpgradeEvents.fromTier,
      toTier: kycTierUpgradeEvents.toTier,
      status: kycTierUpgradeEvents.status,
      reason: kycTierUpgradeEvents.reason,
      createdAt: kycTierUpgradeEvents.createdAt,
      userName: users.fullName,
      userEmail: users.email,
      userMobile: users.mobile,
      currentKycTier: users.kycTier,
      panVerified: users.panVerified,
      aadhaarVerified: users.aadhaarVerified,
      bankVerified: users.bankVerified,
    })
    .from(kycTierUpgradeEvents)
    .innerJoin(users, eq(users.id, kycTierUpgradeEvents.userId))
    .where(eq(kycTierUpgradeEvents.status, 'pending_compliance_review'))
    .orderBy(desc(kycTierUpgradeEvents.createdAt));

  return pendingRequests;
}
