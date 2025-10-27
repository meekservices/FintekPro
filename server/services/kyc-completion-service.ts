import type { KycVerificationSession } from "@shared/schema";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Transfer verified KYC data from verification session to user profile
 * Called when Smart KYC wizard is completed (after Aadhaar verification)
 */
export async function transferVerifiedKYCData(
  userId: string,
  session: KycVerificationSession,
  aadhaarVerificationData: any
): Promise<void> {
  const panData = session.panVerificationData as any;
  const currentUser = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  
  if (!currentUser) {
    throw new Error("User not found");
  }

  // Prepare update data for users table
  const userUpdateData: any = {
    panVerifiedViaSmartKyc: true,
    panVerificationDate: session.panVerifiedAt,
    aadhaarVerifiedViaSmartKyc: true,
    aadhaarVerificationDate: new Date(),
    smartKycCompletedAt: new Date(),
  };

  // Transfer verified PAN if not already present
  if (session.panNumber && !currentUser.panNumber) {
    userUpdateData.panNumber = session.panNumber; // Already encrypted in session
  }

  // Transfer name from PAN verification if user doesn't have name
  if (panData?.name && !currentUser.firstName) {
    // Split the full name from PAN (format: "FIRSTNAME MIDDLENAME LASTNAME")
    const nameParts = panData.name.trim().split(/\s+/);
    if (nameParts.length > 0) {
      userUpdateData.firstName = nameParts[0];
      if (nameParts.length > 2) {
        userUpdateData.middleName = nameParts.slice(1, -1).join(' ');
        userUpdateData.lastName = nameParts[nameParts.length - 1];
      } else if (nameParts.length === 2) {
        userUpdateData.lastName = nameParts[1];
      }
    }
  }

  // Transfer date of birth from PAN if available
  if (session.panDob && !currentUser.dateOfBirth) {
    const dobDate = typeof session.panDob === 'string' ? new Date(session.panDob) : session.panDob;
    userUpdateData.dateOfBirth = dobDate.toISOString().split('T')[0];
  }

  // Update the user with verified data
  await db.update(schema.users)
    .set(userUpdateData)
    .where(eq(schema.users.id, userId));

  // Also update userProfiles table with PAN and tier (product access reads from here)
  const userProfile = await db.query.userProfiles.findFirst({
    where: eq(schema.userProfiles.userId, userId),
  });

  if (userProfile) {
    const profileUpdateData: any = {};
    
    // Transfer PAN to profile if not present
    if (session.panNumber && !userProfile.panNumber) {
      profileUpdateData.panNumber = session.panNumber;
    }
    
    // Update tier to basic if not set (initial KYC completion)
    if (!userProfile.kycTier || userProfile.kycTier === "basic") {
      profileUpdateData.kycTier = "basic";
      profileUpdateData.kycTierUpgradedAt = new Date();
    }

    if (Object.keys(profileUpdateData).length > 0) {
      await db.update(schema.userProfiles)
        .set(profileUpdateData)
        .where(eq(schema.userProfiles.userId, userId));
    }
  }

  // Mark the KYC session as completed
  await db.update(schema.kycVerificationSessions)
    .set({
      completedAt: new Date(),
      currentStep: "completed",
    })
    .where(eq(schema.kycVerificationSessions.id, session.id));
}
