import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface VerifiedKYCProfile {
  fullName: string | null;
  panNumber: string | null;
  kycTier: string;
  panVerified: boolean;
  aadhaarVerified: boolean;
  verificationDate: Date | null;
  smartKycCompleted: boolean;
  smartKycCompletedAt: Date | null;
}

/**
 * Get verified KYC profile data for a user
 * Combines data from users and userProfiles tables and latest KYC verification session
 */
export async function getVerifiedKYCProfile(userId: string): Promise<VerifiedKYCProfile> {
  // Get user basic data
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get user profile with KYC tier data
  const profile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  // Get latest KYC verification session for verified data
  const latestSession = await db.query.kycVerificationSessions.findFirst({
    where: eq(schema.kycVerificationSessions.userId, userId),
    orderBy: desc(schema.kycVerificationSessions.createdAt),
  });

  // Extract full name from user, profile, or KYC session (in priority order)
  let fullName: string | null = null;
  
  if (user.firstName || user.lastName) {
    fullName = `${user.firstName || ''} ${user.middleName || ''} ${user.lastName || ''}`.trim();
  } else if (profile?.firstName || profile?.lastName) {
    fullName = `${profile.firstName || ''} ${profile.middleName || ''} ${profile.lastName || ''}`.trim();
  } else if (latestSession?.panVerificationData) {
    // Extract name from PAN verification data
    const panData = latestSession.panVerificationData as any;
    fullName = panData.name || null;
  }

  // Mask PAN for security (show only first 5 and last character)
  const maskPAN = (pan: string | null): string | null => {
    if (!pan || pan.length < 10) return pan;
    return `${pan.substring(0, 5)}****${pan.charAt(pan.length - 1)}`;
  };

  const rawPan = user.panNumber || profile?.panNumber || null;
  const maskedPan = maskPAN(rawPan);

  // Determine PAN verified: check DB flags, raw PAN, or session
  const panVerified = !!(
    rawPan ||
    user.panVerifiedViaSmartKyc ||
    profile?.panVerifiedViaSmartKyc ||
    latestSession?.panVerified
  );

  // Determine Aadhaar verified: check DB flags or session
  const aadhaarVerified = !!(
    user.aadharNumber ||
    profile?.aadharNumber ||
    user.aadhaarVerifiedViaSmartKyc ||
    profile?.aadhaarVerifiedViaSmartKyc ||
    latestSession?.aadhaarOtpVerified
  );

  // Determine smartKyc completion using timestamp or flag
  const smartKycDone = !!(
    user.smartKycCompletedAt ||
    user.panVerifiedViaSmartKyc
  );

  // Best available verification date
  const verificationDate =
    user.smartKycCompletedAt ||
    user.panVerificationDate ||
    latestSession?.panVerifiedAt ||
    null;

  // Prepare verified data response
  return {
    fullName,
    panNumber: maskedPan, // Masked PAN for security
    kycTier: profile?.kycTier || 'basic',
    panVerified,
    aadhaarVerified,
    verificationDate,
    smartKycCompleted: smartKycDone,
    smartKycCompletedAt: user.smartKycCompletedAt || null,
  };
}
