import { db } from "./db";
import { userProfiles } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * KYC Compliance Checker Service
 * Validates user KYC status before financial transactions
 * Implements tiered KYC requirements based on transaction type and amount
 */

export interface KYCCheckResult {
  compliant: boolean;
  level: "none" | "basic" | "full" | "enhanced";
  reason?: string;
  requiredActions: string[];
  blockers: string[];
  warnings: string[];
  profileCompleteness: number; // 0-100
}

export interface TransactionContext {
  type: "mutual_fund" | "stock" | "etf" | "bond" | "ipo" | "sip" | "withdrawal" | "deposit";
  amount: number;
  isRecurring?: boolean;
}

/**
 * KYC Validation Levels
 */
const KYC_LEVELS = {
  BASIC: {
    name: "basic",
    maxAmount: 50000,
    requirements: ["pan", "name", "email", "mobile", "address"],
  },
  FULL: {
    name: "full",
    maxAmount: 200000,
    requirements: ["pan", "name", "email", "mobile", "address", "bank_account", "pan_verified"],
  },
  ENHANCED: {
    name: "enhanced",
    maxAmount: Infinity,
    requirements: [
      "pan",
      "name",
      "email",
      "mobile",
      "address",
      "bank_account",
      "pan_verified",
      "video_kyc",
      "income_proof",
    ],
  },
} as const;

/**
 * Determine required KYC level based on transaction
 */
function getRequiredKYCLevel(context: TransactionContext): "basic" | "full" | "enhanced" {
  const { amount, type } = context;

  // High-risk transaction types always require enhanced KYC
  if (type === "stock" || type === "bond" || type === "ipo") {
    if (amount > KYC_LEVELS.FULL.maxAmount) {
      return "enhanced";
    }
    return "full";
  }

  // Amount-based tiering for mutual funds and SIPs
  if (amount > KYC_LEVELS.FULL.maxAmount) {
    return "enhanced";
  }
  if (amount > KYC_LEVELS.BASIC.maxAmount) {
    return "full";
  }
  return "basic";
}

/**
 * Check if user meets KYC requirements for specific level
 */
async function checkKYCLevel(
  userId: string,
  level: "basic" | "full" | "enhanced"
): Promise<{
  met: boolean;
  missing: string[];
  profile: any;
}> {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    return {
      met: false,
      missing: ["Profile not created"],
      profile: null,
    };
  }

  const missing: string[] = [];
  const requirements = KYC_LEVELS[level.toUpperCase() as keyof typeof KYC_LEVELS].requirements;

  // Check each requirement
  for (const req of requirements) {
    switch (req) {
      case "pan":
        if (!profile.panNumber) missing.push("PAN number");
        break;
      case "name":
        if (!profile.firstName || !profile.lastName) missing.push("Full name");
        break;
      case "email":
        // Email is in users table, not userProfiles - skip or check separately
        break;
      case "mobile":
        // Mobile is in users table, not userProfiles - skip or check separately
        break;
      case "address":
        if (!profile.address) {
          missing.push("Complete address");
        }
        break;
      case "bank_account":
        if (!profile.bankAccountNumber || !profile.ifscCode) {
          missing.push("Bank account details");
        }
        break;
      case "pan_verified":
        // Check if profile is completed (which includes PAN verification)
        if (!profile.isProfileCompleted) missing.push("Complete profile verification");
        break;
      case "video_kyc":
        if (!profile.videoKycCompleted) missing.push("Video KYC");
        break;
      case "income_proof":
        // Income proof field may not exist - treat as optional for now
        break;
    }
  }

  return {
    met: missing.length === 0,
    missing,
    profile,
  };
}

/**
 * Calculate profile completeness percentage
 */
function calculateProfileCompleteness(profile: any): number {
  if (!profile) return 0;

  const fields = [
    profile.firstName,
    profile.lastName,
    profile.panNumber,
    profile.dateOfBirth,
    profile.address,
    profile.bankAccountNumber,
    profile.ifscCode,
    profile.gender,
    profile.nationality,
    profile.occupation,
  ];

  const completed = fields.filter((f) => f !== null && f !== undefined && f !== "").length;
  return Math.round((completed / fields.length) * 100);
}

/**
 * Main KYC compliance check function
 */
export async function checkKYCCompliance(
  userId: string,
  context: TransactionContext
): Promise<KYCCheckResult> {
  try {
    const requiredLevel = getRequiredKYCLevel(context);
    const { met, missing, profile } = await checkKYCLevel(userId, requiredLevel);

    const result: KYCCheckResult = {
      compliant: false,
      level: "none",
      requiredActions: [],
      blockers: [],
      warnings: [],
      profileCompleteness: calculateProfileCompleteness(profile),
    };

    // Profile doesn't exist
    if (!profile) {
      result.blockers.push("Please complete your profile to start investing");
      result.requiredActions.push("Create your investor profile");
      result.reason = "Profile not found";
      return result;
    }

    // Check AML status
    if (profile.amlStatus === "flagged") {
      result.blockers.push("Your account is under compliance review");
      result.reason = "AML compliance review pending";
      return result;
    }

    if (profile.amlStatus === "rejected") {
      result.blockers.push("Account compliance verification failed. Please contact support");
      result.reason = "AML verification failed";
      return result;
    }

    // Check if profile is marked as completed
    if (!profile.isProfileCompleted) {
      result.blockers.push("Please complete your investor profile");
      result.requiredActions.push("Complete mandatory profile fields");
      result.reason = "Profile incomplete";
    }

    // Check required KYC level
    if (!met) {
      result.blockers.push(`${requiredLevel.toUpperCase()} KYC required for this transaction`);
      result.requiredActions.push(...missing.map((m) => `Complete ${m}`));
      result.reason = `Missing ${requiredLevel} KYC requirements`;
      result.level = determineCurrentLevel(profile);
      return result;
    }

    // Check risk category for enhanced monitoring
    if (profile.riskCategory === "high" && context.amount > 100000) {
      result.warnings.push("High-value transaction on high-risk profile may require manual review");
    }

    // Check compliance score
    if (profile.complianceScore !== null && profile.complianceScore < 50) {
      result.warnings.push("Low compliance score - additional verification may be required");
    }

    // All checks passed
    result.compliant = true;
    result.level = requiredLevel;
    result.reason = "KYC verification successful";

    return result;
  } catch (error) {
    console.error("KYC compliance check error:", error);
    return {
      compliant: false,
      level: "none",
      reason: "Error checking KYC compliance",
      requiredActions: ["Please try again or contact support"],
      blockers: ["Technical error during KYC verification"],
      warnings: [],
      profileCompleteness: 0,
    };
  }
}

/**
 * Determine user's current KYC level
 */
function determineCurrentLevel(profile: any): "none" | "basic" | "full" | "enhanced" {
  if (!profile) return "none";

  const hasBasic =
    profile.panNumber && profile.firstName && profile.lastName && profile.address;

  const hasFull = hasBasic && profile.bankAccountNumber && profile.isProfileCompleted;

  const hasEnhanced = hasFull && profile.videoKycCompleted;

  if (hasEnhanced) return "enhanced";
  if (hasFull) return "full";
  if (hasBasic) return "basic";
  return "none";
}

/**
 * Quick KYC validation for specific transaction types
 */
export async function canPerformTransaction(
  userId: string,
  type: TransactionContext["type"],
  amount: number
): Promise<boolean> {
  const result = await checkKYCCompliance(userId, { type, amount });
  return result.compliant;
}

/**
 * Get KYC status summary for user dashboard
 */
export async function getKYCStatus(userId: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (!profile) {
    return {
      currentLevel: "none",
      nextLevel: "basic",
      completeness: 0,
      canTrade: false,
      pendingActions: ["Create investor profile"],
    };
  }

  const currentLevel = determineCurrentLevel(profile);
  const completeness = calculateProfileCompleteness(profile);

  const nextLevel =
    currentLevel === "none" ? "basic" : currentLevel === "basic" ? "full" : currentLevel === "full" ? "enhanced" : null;

  const pendingActions: string[] = [];

  // Determine what's needed for next level
  if (currentLevel === "none" || currentLevel === "basic") {
    if (!profile.bankAccountNumber) pendingActions.push("Add bank account");
    if (!profile.isProfileCompleted) pendingActions.push("Complete profile verification");
  }

  if (currentLevel !== "enhanced") {
    if (!profile.videoKycCompleted) pendingActions.push("Complete Video KYC");
  }

  return {
    currentLevel,
    nextLevel,
    completeness,
    canTrade: currentLevel !== "none",
    maxAmount:
      currentLevel === "enhanced"
        ? Infinity
        : currentLevel === "full"
        ? KYC_LEVELS.FULL.maxAmount
        : currentLevel === "basic"
        ? KYC_LEVELS.BASIC.maxAmount
        : 0,
    pendingActions,
    amlStatus: profile.amlStatus || "pending",
    videoKycCompleted: profile.videoKycCompleted || false,
  };
}
