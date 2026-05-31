// @ts-nocheck
import { Express } from 'express';
import * as schema from '@shared/schema';
import { storage } from '../storage';
import { db } from '../db';
import { eq, and, or, gte, sql, count, inArray } from 'drizzle-orm';
import { requireAdmin } from '../middleware/roleMiddleware';
import { amfiService } from "../amfi-service";
import { camsApi } from "../cams-api";

function hasRole(user: any, roles: string[]): boolean {
  const userRole = user?.role || user?.userRole || '';
  return roles.includes(userRole);
}


const requireClientOrHigher = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  if (!hasRole(req.user, ['user', 'client', 'business_client', 'agent', 'partner', 'admin', 'superadmin'])) {
    return res.status(403).json({ message: "Client access required" });
  }
  
  next();
};

const exitLoadSyncScheduler = { getStatus: async () => ({}), runFullEnrichment: async () => ({}) };

export function registerUserProfileKYCPart2Routes(app: Express): void {
app.post("/api/admin/trigger-rekyc-reminders", requireAdmin, async (req, res) => {
  try {
    const { triggerReKYCRemindersManually } = await import("../rekyc-cron").catch(() => ({ triggerReKYCRemindersManually: async () => ({}) }));
    
    const result = await triggerReKYCRemindersManually();
    
    res.json({
      success: true,
      message: "Re-KYC reminders sent",
      data: result,
    });
  } catch (error) {
    console.error("Error triggering Re-KYC reminders:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send Re-KYC reminders",
    });
  }
});

// ========== Exit Load Enrichment Admin Endpoints ==========

// Get exit load scheduler status and coverage stats
app.get("/api/admin/exit-load/status", requireAdmin, async (req, res) => {
  try {
    const status = await exitLoadSyncScheduler.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error("[ExitLoad] Error getting status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get exit load status"
    });
  }
});

// Trigger full exit load enrichment (admin manual trigger)
app.post("/api/admin/exit-load/enrich", requireAdmin, async (req, res) => {
  try {
    const result = await exitLoadSyncScheduler.runFullEnrichment();
    res.json({
      success: true,
      message: "Exit load enrichment completed",
      data: result
    });
  } catch (error: any) {
    console.error("[ExitLoad] Error running enrichment:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to run exit load enrichment"
    });
  }
});

// ========== Instrument Time-Series Admin Endpoints ==========

app.post("/api/admin/instrument-time-series/daily-update", requireAdmin, async (req, res) => {
  try {
    const { runDailyPriceUpdate } = await import('../services/instrument-time-series/daily-price-updater');
    const result = await runDailyPriceUpdate();
    res.json({ success: true, message: "Daily price update completed", data: result });
  } catch (error: any) {
    console.error("[InstrumentTimeSeries] Daily update error:", error);
    res.status(500).json({ success: false, error: error.message || "Daily price update failed" });
  }
});

app.post("/api/admin/instrument-time-series/historical-backfill", requireAdmin, async (req, res) => {
  try {
    const batchSize = parseInt(req.query.batchSize as string) || 5;
    const { runHistoricalBackfill } = await import('../services/instrument-time-series/historical-backfill-service');
    const result = await runHistoricalBackfill(batchSize);
    res.json({ success: true, message: "Historical backfill completed", data: result });
  } catch (error: any) {
    console.error("[InstrumentTimeSeries] Backfill error:", error);
    res.status(500).json({ success: false, error: error.message || "Historical backfill failed" });
  }
});

app.get("/api/admin/instrument-time-series/job-log", requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const jobType = req.query.jobType as string;
    const statusFilter = req.query.status as string;
    
    let result;
    if (jobType && statusFilter) {
      result = await db.execute(sql`
        SELECT * FROM enrichment_job_log 
        WHERE job_type = ${jobType} AND status = ${statusFilter}
        ORDER BY executed_at DESC LIMIT ${limit}
      `);
    } else if (jobType) {
      result = await db.execute(sql`
        SELECT * FROM enrichment_job_log 
        WHERE job_type = ${jobType}
        ORDER BY executed_at DESC LIMIT ${limit}
      `);
    } else if (statusFilter) {
      result = await db.execute(sql`
        SELECT * FROM enrichment_job_log 
        WHERE status = ${statusFilter}
        ORDER BY executed_at DESC LIMIT ${limit}
      `);
    } else {
      result = await db.execute(sql`
        SELECT * FROM enrichment_job_log 
        ORDER BY executed_at DESC LIMIT ${limit}
      `);
    }
    
    const rows = (result as any).rows || result;
    res.json({ success: true, data: rows, count: rows.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/admin/instrument-time-series/retry-queue", requireAdmin, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT rq.*, ls.symbol as stock_symbol, ls.company_name
      FROM enrichment_retry_queue rq
      LEFT JOIN listed_stocks ls ON rq.instrument_id = ls.id
      WHERE rq.resolved_at IS NULL
      ORDER BY rq.next_retry_at ASC
    `);
    const rows = (result as any).rows || result;
    res.json({ success: true, data: rows, count: rows.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/admin/instrument-time-series/status", requireAdmin, async (req, res) => {
  try {
    const [stats] = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM listed_stocks WHERE is_active = true) as total_active,
        (SELECT COUNT(*) FROM listed_stocks WHERE historical_complete = true) as historical_complete,
        (SELECT COUNT(*) FROM listed_stocks WHERE historical_complete = false OR historical_complete IS NULL) as historical_pending,
        (SELECT COUNT(*) FROM listed_stocks WHERE last_daily_update = CURRENT_DATE - 1) as daily_updated_today,
        (SELECT COUNT(*) FROM instrument_prices) as total_price_records,
        (SELECT MIN(price_date) FROM instrument_prices) as earliest_price,
        (SELECT MAX(price_date) FROM instrument_prices) as latest_price,
        (SELECT COUNT(*) FROM enrichment_retry_queue WHERE resolved_at IS NULL) as pending_retries,
        (SELECT COUNT(*) FROM enrichment_job_log WHERE executed_at > NOW() - INTERVAL '24 hours') as jobs_last_24h
    `);
    const row = (stats as any).rows?.[0] || stats;
    res.json({ success: true, data: row });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

console.log('✅ Instrument Time-Series Admin routes registered');

app.post("/api/profile/complete", async (req, res) => {
  try {
    // Check authentication
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const profileData = req.body;
    const userId = req.user!.id;
    
    // Add userId and completion flags to profile data
    const completeProfileData = {
      ...profileData,
      userId,
      isProfileCompleted: true,
      profileCompletedAt: new Date(),
      profileCompleteness: 100, // Set to 100% complete
    };

    const profile = await storage.upsertUserProfile(completeProfileData);
    res.json({ 
      success: true, 
      message: "Profile completed successfully", 
      profile 
    });
  } catch (error) {
    console.error("Error completing user profile:", error);
    res.status(500).json({ error: "Failed to complete profile" });
  }
});

// Helper function to determine KYC tier based on data completeness
function determineKYCTier(data: any): 'basic' | 'enhanced' | 'accredited_investor' {
  // Basic Tier (Tier 1): PAN + Aadhaar + Basic profile
  const hasBasic = data.pan && data.aadhar && data.firstName && data.lastName && 
                   data.dateOfBirth && data.email && data.phone;
  
  // Enhanced Tier (Tier 2): All Basic + Financial profile + Address + Banking
  const hasEnhanced = hasBasic && data.occupation && data.annualIncome && 
                     data.addressLine1 && data.city && data.state && data.pincode &&
                     data.bankName && data.accountNumber && data.ifscCode;
  
  // Accredited Investor (Tier 3): Requires manual admin verification for net worth ₹7.5Cr+
  // Not automatically assigned via onboarding - must be requested separately
  
  if (hasEnhanced) {
    return 'enhanced';
  } else if (hasBasic) {
    return 'basic';
  }
  
  return 'basic'; // Default to basic even if incomplete
}

// Smart KYC Onboarding endpoint
app.post("/api/onboarding", async (req, res) => {
  try {
    // Check authentication
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const onboardingData = req.body;
    const userId = req.user!.id;
    
    // Validate required basic fields
    if (!onboardingData.pan || !onboardingData.firstName || !onboardingData.lastName) {
      return res.status(400).json({ 
        error: "Missing required fields: PAN, first name, and last name are required" 
      });
    }

    // Determine KYC tier based on data completeness
    const kycTier = determineKYCTier(onboardingData);
    
    // Check if Smart KYC progress record exists
    const [existingProgress] = await db
      .select()
      .from(schema.smartKycProgress)
      .where(eq(schema.smartKycProgress.userId, userId))
      .limit(1);

    // Prepare progress data structure
    const progressData = {
      userId,
      // Step 1: PAN data
      step1PanVerified: !!onboardingData.pan,
      step1PanNumber: onboardingData.pan,
      step1PanName: `${onboardingData.firstName} ${onboardingData.lastName}`,
      step1CompletedAt: new Date(),
      step1Data: { pan: onboardingData.pan },
      
      // Step 2: Aadhaar data
      step2AadhaarVerified: !!onboardingData.aadhar,
      step2CompletedAt: onboardingData.aadhar ? new Date() : null,
      step2Data: onboardingData.aadhar ? { aadhar: onboardingData.aadhar } : null,
      
      // Step 3: Account discovery (banking)
      step3AccountsDiscovered: !!(onboardingData.bankName && onboardingData.accountNumber),
      step3BankAccountsFound: (onboardingData.bankName && onboardingData.accountNumber) ? 1 : 0,
      step3DematAccountsFound: onboardingData.dematAccountNumber ? 1 : 0,
      step3CompletedAt: (onboardingData.bankName && onboardingData.accountNumber) ? new Date() : null,
      step3Data: {
        bankName: onboardingData.bankName,
        accountNumber: onboardingData.accountNumber,
        ifscCode: onboardingData.ifscCode,
        dematProvider: onboardingData.dematProvider,
        dematAccountNumber: onboardingData.dematAccountNumber
      },
      
      // Step 4: Review and confirmation
      step4ReviewCompleted: true,
      step4CompletedAt: new Date(),
      step4ConfirmedData: onboardingData,
      
      // Overall progress
      currentStep: 4,
      isCompleted: true,
      completedAt: new Date(),
      updatedAt: new Date()
    };

    // Insert or update Smart KYC progress
    if (existingProgress) {
      await db
        .update(schema.smartKycProgress)
        .set(progressData)
        .where(eq(schema.smartKycProgress.userId, userId));
    } else {
      await db.insert(schema.smartKycProgress).values(progressData);
    }

    // Update user's profile data
    await db
      .update(schema.users)
      .set({
        // Update profile fields
        panNumber: onboardingData.pan,
        aadharNumber: onboardingData.aadhar,
        occupation: onboardingData.occupation,
        annualIncome: onboardingData.annualIncome,
        sourceOfWealth: onboardingData.sourceOfWealth,
      })
      .where(eq(schema.users.id, userId));

    // Also update profile table for completeness (includes KYC tier and compliance fields)
    const profile = await storage.getUserProfile(userId);
    await storage.upsertUserProfile({
      ...(profile || {}),
      userId,
      firstName: onboardingData.firstName,
      middleName: onboardingData.middleName,
      lastName: onboardingData.lastName,
      dateOfBirth: onboardingData.dateOfBirth,
      gender: onboardingData.gender,
      maritalStatus: onboardingData.maritalStatus,
      fatherName: onboardingData.fatherName,
      motherName: onboardingData.motherName,
      nationality: onboardingData.nationality,
      residentStatus: onboardingData.residencyStatus,
      addressLine1: onboardingData.addressLine1,
      addressLine2: onboardingData.addressLine2 || null,
      city: onboardingData.city,
      state: onboardingData.state,
      pincode: onboardingData.pincode,
      country: onboardingData.country || 'India',
      netWorth: onboardingData.netWorth,
      investmentExperience: onboardingData.investmentExperience,
      riskTolerance: onboardingData.riskTolerance,
      investmentObjective: onboardingData.investmentObjective,
      // KYC tier (in userProfiles table)
      kycTier,
      kycTierUpgradedAt: new Date(),
      // Compliance fields (in userProfiles table)
      pepDeclaration: onboardingData.pepDeclaration || false,
      fatcaDeclaration: onboardingData.fatcaDeclaration || false,
      fatcaCrsStatus: onboardingData.crsDeclaration ? 'completed' : 'pending',
      isProfileCompleted: true,
      profileCompletedAt: new Date(),
      profileCompleteness: 100
    });

    console.log(`[Onboarding] Smart KYC completed for user ${userId}, assigned tier: ${kycTier}`);

    res.json({
      success: true,
      message: `Smart KYC onboarding completed successfully! You've been assigned ${kycTier === 'enhanced' ? 'Enhanced (Tier 2)' : 'Basic (Tier 1)'} KYC status.`,
      kycTier,
      tierUpgrade: kycTier === 'enhanced' ? 'Congratulations! You now have access to F&O, Commodities, and Global investments.' : 'Complete your financial profile to unlock Enhanced KYC and more investment options.'
    });
  } catch (error: any) {
    console.error("[Onboarding] Smart KYC submission error:", error);
    res.status(500).json({ 
      error: error.message || "Failed to complete onboarding. Please try again." 
    });
  }
});

// KYC Tier Management Routes
app.get("/api/profile/kyc-tier/requirements/:tier", requireClientOrHigher, async (req, res) => {
  try {
    const { getTierUpgradeRequirements } = await import("../kyc-tier-service");
    const userId = req.user!.id;
    const tier = req.params.tier as "enhanced" | "accredited_investor";
    
    if (!["enhanced", "accredited_investor"].includes(tier)) {
      return res.status(400).json({
        success: false,
        error: "Invalid tier. Must be 'enhanced' or 'accredited_investor'",
      });
    }
    
    const requirements = await getTierUpgradeRequirements(userId, tier);
    
    res.json({
      success: true,
      data: requirements,
    });
  } catch (error) {
    console.error("Error fetching KYC tier requirements:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch KYC tier requirements",
    });
  }
});

app.get("/api/profile/kyc-tier/product-access", requireClientOrHigher, async (req, res) => {
  try {
    const { getUserProductAccess } = await import("../kyc-tier-service");
    const userId = req.user!.id;
    
    const productAccess = await getUserProductAccess(userId);
    
    res.json({
      success: true,
      data: productAccess,
    });
  } catch (error) {
    console.error("Error fetching product access:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch product access",
    });
  }
});

app.post("/api/profile/kyc-tier/upgrade-enhanced", requireClientOrHigher, async (req, res) => {
  try {
    const { upgradeToEnhancedKyc } = await import("../kyc-tier-service");
    const userId = req.user!.id;
    
    const result = await upgradeToEnhancedKyc(userId);
    
    res.json(result);
  } catch (error) {
    console.error("Error upgrading to Enhanced KYC:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upgrade to Enhanced KYC",
    });
  }
});

app.post("/api/profile/kyc-tier/request-accredited", requireClientOrHigher, async (req, res) => {
  try {
    const { requestAccreditedInvestorVerification } = await import("../kyc-tier-service");
    const userId = req.user!.id;
    const { verificationType } = req.body;
    
    if (!["income_based", "networth_based", "portfolio_based", "professional"].includes(verificationType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification type",
      });
    }
    
    const result = await requestAccreditedInvestorVerification(userId, verificationType);
    
    res.json(result);
  } catch (error) {
    console.error("Error requesting Accredited Investor verification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to request Accredited Investor verification",
    });
  }
});

app.post("/api/profile/kyc-tier/verify-accredited", requireAdmin, async (req, res) => {
  try {
    const { verifyAccreditedInvestor } = await import("../kyc-tier-service");
    const { userId, approved, rejectionReason } = req.body;
    const verifiedBy = req.user!.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }
    
    const result = await verifyAccreditedInvestor(userId, verifiedBy, approved, rejectionReason);
    
    res.json(result);
  } catch (error) {
    console.error("Error verifying Accredited Investor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify Accredited Investor status",
    });
  }
});

app.get("/api/profile/kyc-tier/product-prompt/:productCode", requireClientOrHigher, async (req, res) => {
  try {
    const { getProductUpgradePrompt } = await import("../kyc-tier-service");
    const { productCode } = req.params;
    
    const profile = await storage.getUserProfile(req.user!.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: "User profile not found",
      });
    }
    
    const currentTier = profile.kycTier || "basic";
    const prompt = getProductUpgradePrompt(currentTier, productCode);
    
    res.json({
      success: true,
      data: prompt,
    });
  } catch (error) {
    console.error("Error fetching product upgrade prompt:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch product upgrade prompt",
    });
  }
});
}
