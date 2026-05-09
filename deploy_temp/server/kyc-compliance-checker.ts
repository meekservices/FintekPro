import { db } from "./db";
import { userProfiles, ckycRecords } from "@shared/schema";
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
 * NOTE: Basic KYC no longer used - Full KYC is mandatory minimum for all transactions
 */
const KYC_LEVELS = {
  BASIC: {
    name: "basic",
    maxAmount: 0, // Deprecated - not used in transaction validation
    requirements: ["pan", "name", "email", "mobile", "address"],
  },
  FULL: {
    name: "full",
    maxAmount: 1000000, // Full KYC allows up to ₹10L transactions
    requirements: ["pan", "name", "email", "mobile", "address", "bank_account", "pan_verified"],
  },
  ENHANCED: {
    name: "enhanced",
    maxAmount: Infinity, // Enhanced KYC for transactions >₹10L
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
 * POLICY: Full KYC mandatory for ALL financial transactions regardless of amount or asset type
 * Enhanced KYC only for very high-value transactions (>₹10L) or special regulatory requirements
 */
function getRequiredKYCLevel(context: TransactionContext): "basic" | "full" | "enhanced" {
  const { amount } = context;

  // CRITICAL: Enhanced KYC required for very high-value transactions (>₹10L)
  // This ensures additional scrutiny for large trades
  if (amount > 1000000) {
    return "enhanced";
  }

  // MANDATORY: Full KYC required for ALL financial transactions
  // Independent of asset type (stocks, bonds, mutual funds, IPOs, SIPs)
  // Independent of transaction amount
  // Ensures maximum regulatory compliance with SEBI, RBI, and PMLA standards
  return "full";
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

  // Non-individual entities have different validation rules
  if (profile.clientType === 'non_individual') {
    return checkCorporateKYCLevel(profile, level);
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
        // Check actual PAN verification flags — not just profile completeness
        if (!(profile as any).panVerifiedViaSandbox && !(profile as any).panVerifiedViaSmartKyc) {
          missing.push("PAN verification (complete PAN verification via the KYC wizard)");
        }
        break;
      case "video_kyc":
        if (!(profile as any).videoKycCompleted && !(profile as any).videoKycCompletedAt) missing.push("Video KYC (In-Person Verification)");
        break;
      case "income_proof":
        // Income proof is verified via annualIncomeAmount being present
        if (!profile.annualIncomeAmount) missing.push("Income proof");
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
 * Check corporate/non-individual KYC requirements
 * Different validation for companies, partnerships, trusts, etc.
 */
function checkCorporateKYCLevel(
  profile: any,
  level: "basic" | "full" | "enhanced"
): {
  met: boolean;
  missing: string[];
  profile: any;
} {
  const missing: string[] = [];

  // Basic requirements for all non-individual entities
  if (!profile.companyName && !profile.firstName) {
    missing.push("Entity/Company name");
  }

  if (!profile.companyPanNumber && !profile.panNumber) {
    missing.push("Entity PAN number");
  }

  if (!profile.entityRegistrationNumber) {
    missing.push("Entity registration number (CIN/Registration ID)");
  }

  if (!profile.entityType) {
    missing.push("Entity type");
  }

  if (!profile.address) {
    missing.push("Registered address");
  }

  // Full KYC requirements for non-individual entities
  if (level === "full" || level === "enhanced") {
    if (!profile.bankAccountNumber || !profile.ifscCode) {
      missing.push("Corporate bank account details");
    }

    if (!profile.authorizedPersons) {
      missing.push("Authorized signatories/directors information");
    }

    if (!profile.businessNature) {
      missing.push("Nature of business");
    }

    // Board resolution or authorization documents check
    if (!(profile as any).isProfileCompleted) {
      missing.push("Entity verification documents (Board resolution, MOA/AOA)");
    }
  }

  // Enhanced KYC for corporate entities (high-value transactions)
  if (level === "enhanced") {
    if (!profile.beneficialOwners) {
      missing.push("Ultimate beneficial ownership (UBO) disclosure");
    }

    if (!profile.incorporationDate) {
      missing.push("Date of incorporation");
    }

    // FATCA/CRS compliance for corporate entities
    if (!profile.taxResidency) {
      missing.push("Tax residency information");
    }

    // Additional regulatory requirements
    if (profile.annualTurnover && profile.annualTurnover > 10000000) {
      if (!profile.auditedFinancials) {
        missing.push("Audited financial statements");
      }
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
    if (!(profile as any).isProfileCompleted) {
      result.blockers.push("Please complete your investor profile");
      result.requiredActions.push("Complete mandatory profile fields");
      result.reason = "Profile incomplete";
    }

    // Check required KYC level
    if (!met) {
      result.blockers.push(`${requiredLevel.toUpperCase()} KYC required for this transaction`);
      result.requiredActions.push(...missing.map((m) => `Complete ${m}`));
      result.reason = `Missing ${requiredLevel} KYC requirements`;
      result.level = await determineCurrentLevel(userId, profile);
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
 * DigiLocker verification provides enhanced trust and faster verification
 */
async function determineCurrentLevel(userId: string, profile: any): Promise<"none" | "basic" | "full" | "enhanced"> {
  if (!profile) return "none";

  // Check if user has DigiLocker-verified CKYC
  const ckycRecord = await db.query.ckycRecords.findFirst({
    where: eq(ckycRecords.userId, userId),
  });

  const hasDigiLockerVerification = ckycRecord?.digilockerVerified === true;

  const hasBasic =
    profile.panNumber && profile.firstName && profile.lastName && profile.address;

  // DigiLocker verification expedites Full KYC status
  const hasFull = hasBasic && (profile.bankAccountNumber || hasDigiLockerVerification) && (profile as any).isProfileCompleted;

  // Enhanced KYC requires video verification OR DigiLocker + high compliance score
  const hasEnhanced = hasFull && ((profile as any).videoKycCompleted || (hasDigiLockerVerification && profile.complianceScore >= 90));

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

  const currentLevel = await determineCurrentLevel(userId, profile);
  const completeness = calculateProfileCompleteness(profile);

  const nextLevel =
    currentLevel === "none" ? "basic" : currentLevel === "basic" ? "full" : currentLevel === "full" ? "enhanced" : null;

  const pendingActions: string[] = [];

  // Determine what's needed for next level
  if (currentLevel === "none" || currentLevel === "basic") {
    if (!profile.bankAccountNumber) pendingActions.push("Add bank account");
    if (!(profile as any).isProfileCompleted) pendingActions.push("Complete profile verification");
  }

  if (currentLevel !== "enhanced") {
    if (!(profile as any).videoKycCompleted) pendingActions.push("Complete Video KYC");
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
    videoKycCompleted: (profile as any).videoKycCompleted || false,
  };
}
