/**
 * KYC Level-Based Product Access Gating Middleware
 * 
 * Implements progressive KYC system for product access control aligned with
 * RBI/SEBI/PMLA regulatory requirements:
 * 
 * - Level 0: Basic Profile (browse only, no transactions)
 * - Level 1: Standard KYC (PAN + Address OVD verified + Photograph captured)
 *   - Eligible for: Loans, Insurance marketplace
 *   - Requirements: PAN verification, Address proof (OVD), Customer photograph
 * 
 * - Level 2: Full KYC (Level 1 + CKYC/KRA + IPV/Video KYC + Bank verification)
 *   - Eligible for: Mutual funds, PMS, AIF, Unlisted securities, Trading
 *   - Requirements: All Level 1 + CKYC fetch OR KRA verification, 
 *                   Video KYC (V-CIP) OR In-Person Verification,
 *                   Bank account penny-drop verification
 * 
 * Regulatory References:
 * - RBI Master Direction on KYC (Updated 2023)
 * - SEBI KYC Registration Agency (KRA) Regulations
 * - PMLA Rules 2005 (as amended)
 * - SEBI Circular on Video KYC (V-CIP) for intermediaries
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { userProfiles, userBankAccounts } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { AppError } from '../utils/errors';
import { logger } from '../logger';

export interface KYCLevelRequest extends Request {
  user?: any;
  kycLevel?: '0' | '1' | '2';
  userProfile?: any;
  kycComplianceDetails?: KYCComplianceDetails;
}

/**
 * Detailed compliance tracking for audit purposes
 */
export interface KYCComplianceDetails {
  level: '0' | '1' | '2';
  panVerified: boolean;
  addressOvdVerified: boolean;
  photographCaptured: boolean;
  ckycVerified: boolean;
  kraVerified: boolean;
  videoKycCompleted: boolean;
  videoKycExpired: boolean;
  videoKycExpiryDate: Date | null;
  ipvCompleted: boolean;
  bankPennyDropVerified: boolean;
  missingRequirements: string[];
  complianceDate: Date | null;
}

/**
 * Product categories and their required KYC levels
 * Aligned with SEBI/RBI product categorization
 */
export const PRODUCT_KYC_REQUIREMENTS = {
  // Level 0 - Browse Only (no purchases/transactions)
  BROWSE: '0',
  
  // Level 1 - Standard KYC (PAN + OVD + Photograph)
  // As per RBI guidelines for basic financial services
  LOANS_PERSONAL: '1',
  LOANS_HOME: '1',
  LOANS_VEHICLE: '1',
  LOANS_BUSINESS: '1',
  INSURANCE_LIFE: '1',
  INSURANCE_HEALTH: '1',
  INSURANCE_GENERAL: '1',
  
  // Level 2 - Full KYC (CKYC/KRA + Video KYC + Bank Verification)
  // As per SEBI intermediary registration requirements
  MUTUAL_FUNDS: '2',
  PMS: '2',
  AIF: '2',
  UNLISTED_SECURITIES: '2',
  EQUITY_TRADING: '2',
  DERIVATIVES: '2',
  COMMODITIES: '2',
  BONDS: '2',
  NCDS: '2',
  GLOBAL_TRADING: '2',
  PORTFOLIO_ANALYTICS: '2'
} as const;

/**
 * Regulatory requirement descriptions for user guidance
 */
export const LEVEL_REQUIREMENTS = {
  LEVEL_1: {
    name: 'Standard KYC',
    description: 'PAN verification with address proof and photograph',
    requirements: [
      'PAN card verification (via Sandbox/NSDL)',
      'Address proof (Aadhaar/Passport/Driving License/Voter ID)',
      'Recent photograph capture',
    ],
    products: ['Loans', 'Insurance'],
    regulatoryBasis: 'RBI Master Direction on KYC, Section 16'
  },
  LEVEL_2: {
    name: 'Full KYC',
    description: 'Complete KYC with identity verification and bank account',
    requirements: [
      'All Standard KYC requirements',
      'CKYC registration OR KRA verification',
      'Video KYC (V-CIP) OR In-Person Verification',
      'Bank account verification (penny drop)',
    ],
    products: ['Mutual Funds', 'Stocks', 'Bonds', 'PMS', 'AIF', 'Unlisted Securities'],
    regulatoryBasis: 'SEBI Circular SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2023/37'
  }
} as const;

/**
 * Get user's KYC level from database - dynamically computed based on verification statuses
 * Aligned with RBI/SEBI regulatory requirements
 */
export async function getUserKYCLevel(userId: string): Promise<{
  level: '0' | '1' | '2';
  profile: any;
  complianceDetails: KYCComplianceDetails;
}> {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  // Check for verified bank account
  const [verifiedBank] = profile ? await db
    .select()
    .from(userBankAccounts)
    .where(and(
      eq(userBankAccounts.userId, userId),
      eq(userBankAccounts.isVerified, true)
    ))
    .limit(1) : [null];

  const missingRequirements: string[] = [];

  if (!profile) {
    return { 
      level: '0', 
      profile: null,
      complianceDetails: {
        level: '0',
        panVerified: false,
        addressOvdVerified: false,
        photographCaptured: false,
        ckycVerified: false,
        kraVerified: false,
        videoKycCompleted: false,
        ipvCompleted: false,
        bankPennyDropVerified: false,
        missingRequirements: ['Create investor profile'],
        complianceDate: null,
        videoKycExpired: false,
        videoKycExpiryDate: null
      }
    };
  }

  // Individual verification status checks
  const panVerified = profile.panVerifiedViaSandbox || false;
  
  // Address OVD Verification: Must be from authenticated provider (CKYC/Aadhaar)
  // Per RBI Master Direction, OVD must be verified through authorized channel
  // Complete address fields alone are NOT sufficient - need verified source
  const ckycVerified = (profile as any).ckycFetchedViaAuthBridge || false;
  const kraVerified = profile.kraVerifiedViaProtean || false;
  // CKYC contains verified address from KRA, or KRA verification implies address verified
  const addressOvdVerified = ckycVerified || kraVerified;
  
  const photographCaptured = profile.isProfileCompleted || false; // Photograph is part of profile completion

  // V-CIP expiry enforcement (RBI 2023 V-CIP guidelines)
  // 90-day grace period for users who completed V-CIP before this feature was deployed
  const VCIP_GRACE_PERIOD_END = new Date('2024-06-01T00:00:00Z');
  const now = new Date();
  const vcipRawCompleted = profile.videoKycCompleted || false;
  let videoKycCompleted = vcipRawCompleted;
  if (vcipRawCompleted && profile.videoKycExpiryDate) {
    const expiryDate = new Date(profile.videoKycExpiryDate);
    const gracePeriodPassed = now > VCIP_GRACE_PERIOD_END;
    const vcipExpired = expiryDate < now;
    if (vcipExpired && gracePeriodPassed) {
      videoKycCompleted = false;
    }
  }

  const ipvCompleted = profile.faceToFaceVerificationCompleted || false;
  const bankPennyDropVerified = verifiedBank?.isVerified || false;

  // Level 1 Requirements (Standard KYC for Loans/Insurance):
  // Per RBI Master Direction on KYC, Section 16:
  // - PAN verification (mandatory - primary identity)
  // - Address proof via OVD (CKYC/KRA verified - not just address fields)
  // - Photograph captured (as part of profile completion)
  // Note: For development, we allow CKYC/KRA as OVD source since it contains verified address
  const hasLevel1Requirements = panVerified && addressOvdVerified && photographCaptured;

  // Level 2 Requirements (Full KYC for Investment Products):
  // Per SEBI Circular SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2023/37:
  // ALL of the following are MANDATORY:
  // - All Level 1 requirements (PAN + verified OVD + photograph)
  // - CKYC registration OR KRA verification (central KYC compliance)
  // - Video KYC (V-CIP) OR In-Person Verification (identity confirmation)
  // - Bank account penny-drop verification (financial identity linkage)
  const hasCentralKycVerification = ckycVerified || kraVerified;
  const hasIdentityVerification = videoKycCompleted || ipvCompleted;
  // Level 2 requires ALL: Central KYC + Identity Verification + Bank Verification
  const hasLevel2Requirements = hasLevel1Requirements && 
    hasCentralKycVerification && 
    hasIdentityVerification && 
    bankPennyDropVerified;

  // Compute V-CIP expiry state for compliance details
  const videoKycExpired = vcipRawCompleted && !!profile.videoKycExpiryDate && !videoKycCompleted;
  const videoKycExpiryDate = profile.videoKycExpiryDate ? new Date(profile.videoKycExpiryDate) : null;

  // Build missing requirements list for user guidance
  if (!panVerified) missingRequirements.push('PAN verification');
  if (!addressOvdVerified) missingRequirements.push('Address proof (Aadhaar/OVD)');
  if (!photographCaptured) missingRequirements.push('Complete profile with photograph');
  
  if (hasLevel1Requirements) {
    if (!hasCentralKycVerification) missingRequirements.push('CKYC/KRA registration');
    if (videoKycExpired) {
      missingRequirements.push('Video KYC (V-CIP) has expired — renewal required');
    } else if (!videoKycCompleted && !ipvCompleted) {
      missingRequirements.push('Video KYC or In-Person Verification');
    }
    if (!bankPennyDropVerified) missingRequirements.push('Bank account verification');
  }

  // Determine level based on regulatory compliance
  let computedLevel: '0' | '1' | '2' = '0';
  if (hasLevel2Requirements) {
    computedLevel = '2';
  } else if (hasLevel1Requirements) {
    computedLevel = '1';
  }

  const complianceDetails: KYCComplianceDetails = {
    level: computedLevel,
    panVerified,
    addressOvdVerified,
    photographCaptured,
    ckycVerified,
    kraVerified,
    videoKycCompleted,
    videoKycExpired,
    videoKycExpiryDate,
    ipvCompleted,
    bankPennyDropVerified,
    missingRequirements,
    complianceDate: profile.profileCompletedAt || null
  };

  return { level: computedLevel, profile, complianceDetails };
}

/**
 * Check if user has required KYC level for a product
 */
export function hasRequiredKYCLevel(
  userLevel: '0' | '1' | '2',
  requiredLevel: '0' | '1' | '2'
): boolean {
  const levelHierarchy = { '0': 0, '1': 1, '2': 2 };
  return levelHierarchy[userLevel] >= levelHierarchy[requiredLevel];
}

/**
 * Middleware: Require KYC Level 1 (Standard KYC)
 * Use for loans and insurance marketplace endpoints
 * Regulatory: RBI Master Direction on KYC, Section 16
 */
export const requireLevel1 = async (
  req: KYCLevelRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { level, profile, complianceDetails } = await getUserKYCLevel(req.user.id);
    req.kycLevel = level;
    req.userProfile = profile;
    req.kycComplianceDetails = complianceDetails;

    if (!hasRequiredKYCLevel(level, '1')) {
      return res.status(403).json({
        success: false,
        error: 'KYC Level 1 required',
        message: 'Please complete Standard KYC to access loans and insurance products',
        kycLevel: level,
        requiredLevel: '1',
        complianceDetails,
        missingRequirements: complianceDetails.missingRequirements,
        regulatoryReference: LEVEL_REQUIREMENTS.LEVEL_1.regulatoryBasis,
        nextStep: {
          action: 'complete_standard_kyc',
          url: '/onboarding',
          description: 'Complete PAN verification, address proof, and photograph to unlock loans and insurance',
          requirements: LEVEL_REQUIREMENTS.LEVEL_1.requirements
        }
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Require KYC Level 2 (Full KYC)
 * Use for investment products (MF, PMS, AIF, Unlisted)
 * Regulatory: SEBI Circular SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2023/37
 */
export const requireLevel2 = async (
  req: KYCLevelRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user?.id) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const { level, profile, complianceDetails } = await getUserKYCLevel(req.user.id);
    req.kycLevel = level;
    req.userProfile = profile;
    req.kycComplianceDetails = complianceDetails;

    if (!hasRequiredKYCLevel(level, '2')) {
      return res.status(403).json({
        success: false,
        error: 'KYC Level 2 required',
        message: 'Please complete Full KYC verification to access investment products',
        kycLevel: level,
        requiredLevel: '2',
        complianceDetails,
        missingRequirements: complianceDetails.missingRequirements,
        regulatoryReference: LEVEL_REQUIREMENTS.LEVEL_2.regulatoryBasis,
        nextStep: {
          action: 'complete_full_kyc',
          url: '/onboarding',
          description: level === '0' 
            ? 'Complete Standard KYC first, then CKYC/KRA, Video KYC, and bank verification'
            : 'Complete CKYC/KRA registration, Video KYC, and bank account verification',
          requirements: LEVEL_REQUIREMENTS.LEVEL_2.requirements
        }
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Inject KYC level into request (non-blocking)
 * Use for endpoints that need to know KYC level but don't require specific level
 */
export const injectKYCLevel = async (
  req: KYCLevelRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.id) {
      const { level, profile, complianceDetails } = await getUserKYCLevel(req.user.id);
      req.kycLevel = level;
      req.userProfile = profile;
      req.kycComplianceDetails = complianceDetails;
    }
    next();
  } catch (error) {
    // Don't block request if KYC level fetch fails
    logger.error('[KycLevelGate] Error fetching KYC level', { error: error instanceof Error ? error.message : String(error) });
    next();
  }
};

/**
 * Check product access and return user-friendly message with regulatory context
 */
export async function checkProductAccess(
  userId: string,
  productCategory: keyof typeof PRODUCT_KYC_REQUIREMENTS
): Promise<{
  hasAccess: boolean;
  userLevel: '0' | '1' | '2';
  requiredLevel: string;
  message?: string;
  nextStepUrl?: string;
  complianceDetails?: KYCComplianceDetails;
  missingRequirements?: string[];
}> {
  const { level, complianceDetails } = await getUserKYCLevel(userId);
  const requiredLevel = PRODUCT_KYC_REQUIREMENTS[productCategory];
  const hasAccess = hasRequiredKYCLevel(level, requiredLevel as '0' | '1' | '2');

  if (hasAccess) {
    return {
      hasAccess: true,
      userLevel: level,
      requiredLevel,
      complianceDetails
    };
  }

  // Generate helpful message based on gap with regulatory context
  let message = '';
  let nextStepUrl = '/onboarding';

  if (level === '0' && requiredLevel === '1') {
    message = 'Please complete Standard KYC (PAN + Address Proof + Photograph) to access this product';
  } else if (level === '0' && requiredLevel === '2') {
    message = 'Please complete Full KYC verification to access this product. Start with PAN verification.';
  } else if (level === '1' && requiredLevel === '2') {
    message = 'Please complete CKYC/KRA registration, Video KYC, and bank verification to access investment products';
  }

  return {
    hasAccess: false,
    userLevel: level,
    requiredLevel,
    message,
    nextStepUrl,
    complianceDetails,
    missingRequirements: complianceDetails.missingRequirements
  };
}

/**
 * Get list of accessible products for a user with compliance details
 */
export async function getAccessibleProducts(userId: string): Promise<{
  level: '0' | '1' | '2';
  accessibleProducts: string[];
  blockedProducts: string[];
  complianceDetails: KYCComplianceDetails;
}> {
  const { level, complianceDetails } = await getUserKYCLevel(userId);
  
  const accessible: string[] = [];
  const blocked: string[] = [];

  for (const [product, requiredLevel] of Object.entries(PRODUCT_KYC_REQUIREMENTS)) {
    if (hasRequiredKYCLevel(level, requiredLevel as '0' | '1' | '2')) {
      accessible.push(product);
    } else {
      blocked.push(product);
    }
  }

  return {
    level,
    accessibleProducts: accessible,
    blockedProducts: blocked,
    complianceDetails
  };
}

