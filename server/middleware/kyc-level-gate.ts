/**
 * KYC Level-Based Product Access Gating Middleware
 * 
 * Implements progressive KYC system for product access control:
 * - Level 0: Basic Profile (browse only, no transactions)
 * - Level 1: PAN Verified (loans, insurance marketplace)
 * - Level 2: Full KYC (mutual funds, PMS, AIF, unlisted securities)
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { userProfiles } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../utils/errors';

export interface KYCLevelRequest extends Request {
  user?: any;
  kycLevel?: '0' | '1' | '2';
  userProfile?: any;
}

/**
 * Product categories and their required KYC levels
 */
export const PRODUCT_KYC_REQUIREMENTS = {
  // Level 0 - Browse Only (no purchases)
  BROWSE: '0',
  
  // Level 1 - PAN Verified (Loans & Insurance)
  LOANS_PERSONAL: '1',
  LOANS_HOME: '1',
  LOANS_VEHICLE: '1',
  LOANS_BUSINESS: '1',
  INSURANCE_LIFE: '1',
  INSURANCE_HEALTH: '1',
  INSURANCE_GENERAL: '1',
  
  // Level 2 - Full KYC (Investments)
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
 * Get user's KYC level from database
 */
export async function getUserKYCLevel(userId: string): Promise<{
  level: '0' | '1' | '2';
  profile: any;
}> {
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  if (!profile) {
    // No profile = Level 0
    return { level: '0', profile: null };
  }

  const kycLevel = (profile.kycLevel || '0') as '0' | '1' | '2';
  return { level: kycLevel, profile };
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
 * Middleware: Require KYC Level 1 (PAN Verified)
 * Use for loans and insurance marketplace endpoints
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

    const { level, profile } = await getUserKYCLevel(req.user.id);
    req.kycLevel = level;
    req.userProfile = profile;

    if (!hasRequiredKYCLevel(level, '1')) {
      return res.status(403).json({
        success: false,
        error: 'KYC Level 1 required',
        message: 'Please complete PAN verification to access loans and insurance products',
        kycLevel: level,
        requiredLevel: '1',
        nextStep: {
          action: 'complete_pan_verification',
          url: '/onboarding',
          description: 'Complete PAN verification to unlock loans and insurance marketplace'
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

    const { level, profile } = await getUserKYCLevel(req.user.id);
    req.kycLevel = level;
    req.userProfile = profile;

    if (!hasRequiredKYCLevel(level, '2')) {
      return res.status(403).json({
        success: false,
        error: 'KYC Level 2 required',
        message: 'Please complete full KYC verification to access investment products',
        kycLevel: level,
        requiredLevel: '2',
        nextStep: {
          action: 'complete_full_kyc',
          url: '/onboarding',
          description: level === '0' 
            ? 'Complete PAN and full KYC verification to unlock all investment products'
            : 'Complete CKYC and KRA verification to unlock all investment products'
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
      const { level, profile } = await getUserKYCLevel(req.user.id);
      req.kycLevel = level;
      req.userProfile = profile;
    }
    next();
  } catch (error) {
    // Don't block request if KYC level fetch fails
    console.error('Error fetching KYC level:', error);
    next();
  }
};

/**
 * Check product access and return user-friendly message
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
}> {
  const { level } = await getUserKYCLevel(userId);
  const requiredLevel = PRODUCT_KYC_REQUIREMENTS[productCategory];
  const hasAccess = hasRequiredKYCLevel(level, requiredLevel as '0' | '1' | '2');

  if (hasAccess) {
    return {
      hasAccess: true,
      userLevel: level,
      requiredLevel
    };
  }

  // Generate helpful message based on gap
  let message = '';
  let nextStepUrl = '/onboarding';

  if (level === '0' && requiredLevel === '1') {
    message = 'Please complete PAN verification to access this product';
  } else if (level === '0' && requiredLevel === '2') {
    message = 'Please complete PAN and full KYC verification to access this product';
  } else if (level === '1' && requiredLevel === '2') {
    message = 'Please complete CKYC and KRA verification to access investment products';
  }

  return {
    hasAccess: false,
    userLevel: level,
    requiredLevel,
    message,
    nextStepUrl
  };
}

/**
 * Get list of accessible products for a user
 */
export async function getAccessibleProducts(userId: string): Promise<{
  level: '0' | '1' | '2';
  accessibleProducts: string[];
  blockedProducts: string[];
}> {
  const { level } = await getUserKYCLevel(userId);
  
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
    blockedProducts: blocked
  };
}
