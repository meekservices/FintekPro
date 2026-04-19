import { db } from "./db";
import { eq } from "drizzle-orm";
import { userProfiles, userBankAccounts } from "@shared/schema";

/**
 * Re-KYC Service
 * Handles KYC renewal reminders and due date calculations
 * Implements risk-based KYC update frequencies per RBI/SEBI guidelines
 */

export interface KYCStatus {
  userId: string;
  currentLevel: "none" | "basic" | "enhanced";
  isActive: boolean;
  dueDate: Date | null;
  daysUntilExpiry: number | null;
  requiresReKYC: boolean;
  remindersSent: number;
  
  // Transaction readiness
  canTradeMutualFunds: boolean;
  canTradeBroking: boolean;
  canTradeInternational: boolean;
  
  // Risk-based details
  riskCategory: string;
  reviewFrequency: string;
  lastUpdated: Date | null;
  
  // Pending actions
  pendingActions: string[];
  
  // Event-driven triggers (regulatory compliance)
  eventTriggers?: {
    riskProfileChanged: boolean;
    addressChanged: boolean;
    beneficialOwnershipChanged: boolean;
    requiresImmediateReview: boolean;
    lastEventCheck: Date | null;
  };
}

/**
 * Calculate KYC due date based on risk category and last update
 */
export function calculateKYCDueDate(
  lastUpdatedDate: Date,
  riskCategory: string = "low"
): Date {
  const dueDate = new Date(lastUpdatedDate);
  
  switch (riskCategory) {
    case "high":
      // High risk: 2 years
      dueDate.setFullYear(dueDate.getFullYear() + 2);
      break;
    case "medium":
      // Medium risk: 8 years
      dueDate.setFullYear(dueDate.getFullYear() + 8);
      break;
    case "low":
    default:
      // Low risk: 10 years
      dueDate.setFullYear(dueDate.getFullYear() + 10);
      break;
  }
  
  return dueDate;
}

/**
 * Get comprehensive KYC status for a user
 */
export async function getKYCStatus(userId: string): Promise<KYCStatus> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    return {
      userId,
      currentLevel: "none",
      isActive: false,
      dueDate: null,
      daysUntilExpiry: null,
      requiresReKYC: true,
      remindersSent: 0,
      canTradeMutualFunds: false,
      canTradeBroking: false,
      canTradeInternational: false,
      riskCategory: "low",
      reviewFrequency: "10_years",
      lastUpdated: null,
      pendingActions: ["Create investor profile"],
    };
  }

  // Determine current KYC level based on verified statuses
  // ALIGNED with kyc-level-gate middleware for consistency
  
  // Check for verified bank account (must be penny-drop verified, not just exists)
  const verifiedBank = await db.query.userBankAccounts.findFirst({
    where: (accounts, { eq, and }) => and(
      eq(accounts.userId, userId),
      eq(accounts.isVerified, true)
    ),
  });
  
  // Individual verification status checks (same as kyc-level-gate)
  const panVerified = profile.panVerifiedViaSandbox || false;
  const ckycVerified = (profile as any).ckycFetchedViaAuthBridge || false;
  const kraVerified = profile.kraVerifiedViaProtean || false;
  const addressOvdVerified = ckycVerified || kraVerified; // CKYC/KRA contains verified address
  const photographCaptured = profile.isProfileCompleted || false;
  const videoKycCompleted = profile.videoKycCompleted || false;
  const ipvCompleted = profile.faceToFaceVerificationCompleted || false;
  const bankPennyDropVerified = verifiedBank?.isVerified || false;
  
  // Level 1 (Basic): PAN + Verified OVD + Photograph
  // Per RBI Master Direction on KYC, Section 16
  const hasLevel1Requirements = panVerified && addressOvdVerified && photographCaptured;
  
  // Level 2 (Enhanced): Level 1 + Central KYC + Identity Verification + Bank Verification
  // Per SEBI Circular - ALL requirements are MANDATORY
  const hasCentralKycVerification = ckycVerified || kraVerified;
  const hasIdentityVerification = videoKycCompleted || ipvCompleted;
  const hasLevel2Requirements = hasLevel1Requirements && 
    hasCentralKycVerification && 
    hasIdentityVerification && 
    bankPennyDropVerified;

  // Determine level based on regulatory compliance
  const currentLevel: "none" | "basic" | "enhanced" = 
    hasLevel2Requirements ? "enhanced" : hasLevel1Requirements ? "basic" : "none";

  // Calculate or get due date
  let dueDate = (profile as any).kycUpdateDueDate;
  const lastUpdated = (profile as any).kycLastUpdatedDate || profile.profileCompletedAt || profile.createdAt;

  if (!dueDate && lastUpdated) {
    dueDate = calculateKYCDueDate(lastUpdated, profile.riskCategory || "low");
  }

  // Calculate days until expiry
  let daysUntilExpiry: number | null = null;
  let requiresReKYC = false;

  if (dueDate) {
    const today = new Date();
    const timeDiff = dueDate.getTime() - today.getTime();
    daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    requiresReKYC = daysUntilExpiry <= 0;
  }

  // Determine transaction readiness
  const canTradeMutualFunds = currentLevel !== "none" && !requiresReKYC;
  const canTradeBroking = currentLevel === "enhanced" && !requiresReKYC;
  
  // International requires enhanced KYC + NRI/OCI/Foreign National status
  const isInternationalEligible = 
    profile.residentStatus !== "resident_indian" || 
    !!profile.isUSPerson || 
    !!profile.isEUResident;
  const canTradeInternational = 
    currentLevel === "enhanced" && 
    isInternationalEligible && 
    !requiresReKYC &&
    profile.fatcaStatus === "Y";

  // Build pending actions list
  const pendingActions: string[] = [];
  
  if (requiresReKYC) {
    pendingActions.push("Complete Re-KYC (Expired)");
  } else if (daysUntilExpiry !== null && daysUntilExpiry <= 60) {
    pendingActions.push(`Re-KYC due in ${daysUntilExpiry} days`);
  }

  if (!profile.videoKycCompleted && currentLevel !== "enhanced") {
    pendingActions.push("Complete Video KYC for enhanced services");
  }

  if (isInternationalEligible && profile.fatcaStatus !== "Y") {
    pendingActions.push("Complete FATCA declaration for international trading");
  }

  return {
    userId,
    currentLevel,
    isActive: !requiresReKYC && currentLevel !== "none",
    dueDate: dueDate || null,
    daysUntilExpiry,
    requiresReKYC,
    remindersSent: (profile as any).kycUpdateRemindersSent || 0,
    canTradeMutualFunds,
    canTradeBroking,
    canTradeInternational,
    riskCategory: profile.riskCategory || "low",
    reviewFrequency: (profile as any).riskReviewFrequency || "10_years",
    lastUpdated: lastUpdated || null,
    pendingActions,
  };
}

/**
 * Check if user needs Re-KYC reminder
 * Returns true if reminder should be sent (at 60, 30, or 15 days)
 */
export function shouldSendReKYCReminder(
  daysUntilExpiry: number,
  remindersSent: number
): { shouldSend: boolean; reminderType: "60_day" | "30_day" | "15_day" | null } {
  // 60-day reminder (first reminder)
  if (daysUntilExpiry <= 60 && daysUntilExpiry > 30 && remindersSent === 0) {
    return { shouldSend: true, reminderType: "60_day" };
  }

  // 30-day reminder (second reminder)
  if (daysUntilExpiry <= 30 && daysUntilExpiry > 15 && remindersSent <= 1) {
    return { shouldSend: true, reminderType: "30_day" };
  }

  // 15-day reminder (final reminder)
  if (daysUntilExpiry <= 15 && daysUntilExpiry > 0 && remindersSent <= 2) {
    return { shouldSend: true, reminderType: "15_day" };
  }

  return { shouldSend: false, reminderType: null };
}

/**
 * Update KYC due date for a user
 */
export async function updateKYCDueDate(userId: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    throw new Error("Profile not found");
  }

  const lastUpdated = (profile as any).kycLastUpdatedDate || profile.createdAt || new Date();
  const dueDate = calculateKYCDueDate(lastUpdated, profile.riskCategory || "low");

  await db
    .update(userProfiles)
    .set({
      kycUpdateDueDate: dueDate,
      kycLastUpdatedDate: lastUpdated,
      updatedAt: new Date(),
    } as any)
    .where(eq(userProfiles.userId, userId));

  return dueDate;
}

/**
 * Mark Re-KYC reminder as sent
 */
export async function incrementReminderCount(userId: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    throw new Error("Profile not found");
  }

  const newCount = ((profile as any).kycUpdateRemindersSent || 0) + 1;

  await db
    .update(userProfiles)
    .set({
      kycUpdateRemindersSent: newCount,
      updatedAt: new Date(),
    } as any)
    .where(eq(userProfiles.userId, userId));

  return newCount;
}

/**
 * Reset reminder count after Re-KYC completion
 */
export async function resetReKYCProcess(userId: string) {
  const now = new Date();
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    throw new Error("Profile not found");
  }

  const newDueDate = calculateKYCDueDate(now, profile.riskCategory || "low");

  await db
    .update(userProfiles)
    .set({
      kycLastUpdatedDate: now,
      kycUpdateDueDate: newDueDate,
      kycUpdateRemindersSent: 0,
      profileCompletedAt: now,
      updatedAt: now,
    } as any)
    .where(eq(userProfiles.userId, userId));

  return { newDueDate, lastUpdated: now };
}

/**
 * Get all users requiring Re-KYC reminders
 * Used by cron job to send batch reminders
 */
export async function getUsersRequiringReminders() {
  const allProfiles = await db.select().from(userProfiles);

  const usersNeedingReminders: Array<{
    userId: string;
    daysUntilExpiry: number;
    reminderType: "60_day" | "30_day" | "15_day";
    email: string | null;
    mobile: string | null;
    name: string | null;
  }> = [];

  for (const profile of allProfiles) {
    const kycStatus = await getKYCStatus(profile.userId);

    if (kycStatus.daysUntilExpiry !== null) {
      const reminderCheck = shouldSendReKYCReminder(
        kycStatus.daysUntilExpiry,
        kycStatus.remindersSent
      );

      if (reminderCheck.shouldSend && reminderCheck.reminderType) {
        usersNeedingReminders.push({
          userId: profile.userId,
          daysUntilExpiry: kycStatus.daysUntilExpiry,
          reminderType: reminderCheck.reminderType,
          email: null, // Would need to join with users table
          mobile: null, // Would need to join with users table
          name: `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || null,
        });
      }
    }
  }

  return usersNeedingReminders;
}
