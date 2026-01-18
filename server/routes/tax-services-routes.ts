import { Router } from "express";
import { db } from "../db";
import { itrPricingConfig } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

const router = Router();

// Get all ITR pricing configurations
router.get("/pricing", async (req, res) => {
  try {
    const configs = await db
      .select()
      .from(itrPricingConfig)
      .orderBy(itrPricingConfig.itrFormType);
    
    res.json({ success: true, data: configs });
  } catch (error: any) {
    console.error("[TaxServices] Error fetching pricing configs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single ITR pricing configuration
router.get("/pricing/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [config] = await db
      .select()
      .from(itrPricingConfig)
      .where(eq(itrPricingConfig.id, id));
    
    if (!config) {
      return res.status(404).json({ success: false, error: "Pricing config not found" });
    }
    
    res.json({ success: true, data: config });
  } catch (error: any) {
    console.error("[TaxServices] Error fetching pricing config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new ITR pricing configuration
router.post("/pricing", async (req, res) => {
  try {
    const {
      itrFormType,
      displayName,
      description,
      selfFileFee,
      selfFileGst,
      caAssistedFee,
      caAssistedGst,
      caRevenueSharePercent,
      expertConsultationFee,
      rushFilingFee,
      lateFeeMultiplier,
      complexityLevel,
      estimatedProcessingDays,
      eligibleForSelfFile,
      requiresCa,
      isActive,
    } = req.body;

    // Check for duplicate ITR form type
    const existing = await db
      .select()
      .from(itrPricingConfig)
      .where(eq(itrPricingConfig.itrFormType, itrFormType));
    
    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Pricing for ${itrFormType} already exists` 
      });
    }

    const [created] = await db
      .insert(itrPricingConfig)
      .values({
        itrFormType,
        displayName,
        description,
        selfFileFee: selfFileFee?.toString() || "0",
        selfFileGst: selfFileGst?.toString() || "0",
        caAssistedFee: caAssistedFee?.toString() || "0",
        caAssistedGst: caAssistedGst?.toString() || "0",
        caRevenueSharePercent: caRevenueSharePercent?.toString() || "50",
        expertConsultationFee: expertConsultationFee?.toString() || "0",
        rushFilingFee: rushFilingFee?.toString() || "0",
        lateFeeMultiplier: lateFeeMultiplier?.toString() || "1.0",
        complexityLevel: complexityLevel || "standard",
        estimatedProcessingDays: estimatedProcessingDays || 3,
        eligibleForSelfFile: eligibleForSelfFile ?? true,
        requiresCa: requiresCa ?? false,
        isActive: isActive ?? true,
      })
      .returning();

    res.json({ success: true, data: created });
  } catch (error: any) {
    console.error("[TaxServices] Error creating pricing config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update ITR pricing configuration
router.patch("/pricing/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Convert numeric fields to strings for decimal columns
    const processedUpdates: any = { ...updates, updatedAt: new Date() };
    const numericFields = [
      'selfFileFee', 'selfFileGst', 'caAssistedFee', 'caAssistedGst',
      'caRevenueSharePercent', 'expertConsultationFee', 'rushFilingFee', 'lateFeeMultiplier'
    ];
    
    for (const field of numericFields) {
      if (processedUpdates[field] !== undefined) {
        processedUpdates[field] = processedUpdates[field].toString();
      }
    }

    const [updated] = await db
      .update(itrPricingConfig)
      .set(processedUpdates)
      .where(eq(itrPricingConfig.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: "Pricing config not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[TaxServices] Error updating pricing config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete ITR pricing configuration
router.delete("/pricing/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const [deleted] = await db
      .delete(itrPricingConfig)
      .where(eq(itrPricingConfig.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Pricing config not found" });
    }

    res.json({ success: true, message: "Pricing config deleted" });
  } catch (error: any) {
    console.error("[TaxServices] Error deleting pricing config:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Seed default ITR pricing configurations
router.post("/pricing/seed", async (req, res) => {
  try {
    const defaultConfigs = [
      {
        itrFormType: "ITR-1",
        displayName: "ITR-1 (Sahaj)",
        description: "Salary, One House Property, Other Sources (up to ₹50L income)",
        selfFileFee: "499",
        selfFileGst: "90",
        caAssistedFee: "1499",
        caAssistedGst: "270",
        caRevenueSharePercent: "60",
        expertConsultationFee: "500",
        rushFilingFee: "299",
        lateFeeMultiplier: "1.5",
        complexityLevel: "simple",
        estimatedProcessingDays: 2,
        eligibleForSelfFile: true,
        requiresCa: false,
        isActive: true,
      },
      {
        itrFormType: "ITR-2",
        displayName: "ITR-2",
        description: "Salary, Capital Gains, Multiple Properties, Foreign Assets",
        selfFileFee: "999",
        selfFileGst: "180",
        caAssistedFee: "2999",
        caAssistedGst: "540",
        caRevenueSharePercent: "55",
        expertConsultationFee: "1000",
        rushFilingFee: "499",
        lateFeeMultiplier: "1.5",
        complexityLevel: "standard",
        estimatedProcessingDays: 3,
        eligibleForSelfFile: true,
        requiresCa: false,
        isActive: true,
      },
      {
        itrFormType: "ITR-3",
        displayName: "ITR-3",
        description: "Business/Profession Income (Non-Presumptive)",
        selfFileFee: "0",
        selfFileGst: "0",
        caAssistedFee: "4999",
        caAssistedGst: "900",
        caRevenueSharePercent: "50",
        expertConsultationFee: "1500",
        rushFilingFee: "999",
        lateFeeMultiplier: "1.5",
        complexityLevel: "complex",
        estimatedProcessingDays: 5,
        eligibleForSelfFile: false,
        requiresCa: true,
        isActive: true,
      },
      {
        itrFormType: "ITR-4",
        displayName: "ITR-4 (Sugam)",
        description: "Presumptive Business Income (44AD/44ADA/44AE)",
        selfFileFee: "799",
        selfFileGst: "144",
        caAssistedFee: "1999",
        caAssistedGst: "360",
        caRevenueSharePercent: "55",
        expertConsultationFee: "750",
        rushFilingFee: "399",
        lateFeeMultiplier: "1.5",
        complexityLevel: "standard",
        estimatedProcessingDays: 3,
        eligibleForSelfFile: true,
        requiresCa: false,
        isActive: true,
      },
      {
        itrFormType: "ITR-5",
        displayName: "ITR-5",
        description: "LLPs, AOPs, BOIs, Cooperative Societies",
        selfFileFee: "0",
        selfFileGst: "0",
        caAssistedFee: "7999",
        caAssistedGst: "1440",
        caRevenueSharePercent: "45",
        expertConsultationFee: "2000",
        rushFilingFee: "1499",
        lateFeeMultiplier: "1.5",
        complexityLevel: "complex",
        estimatedProcessingDays: 7,
        eligibleForSelfFile: false,
        requiresCa: true,
        isActive: true,
      },
      {
        itrFormType: "ITR-6",
        displayName: "ITR-6",
        description: "Companies (except Section 11 exemption)",
        selfFileFee: "0",
        selfFileGst: "0",
        caAssistedFee: "14999",
        caAssistedGst: "2700",
        caRevenueSharePercent: "40",
        expertConsultationFee: "3000",
        rushFilingFee: "2999",
        lateFeeMultiplier: "2.0",
        complexityLevel: "complex",
        estimatedProcessingDays: 10,
        eligibleForSelfFile: false,
        requiresCa: true,
        isActive: true,
      },
      {
        itrFormType: "ITR-7",
        displayName: "ITR-7",
        description: "Trusts, Political Parties, Scientific Research Institutions",
        selfFileFee: "0",
        selfFileGst: "0",
        caAssistedFee: "9999",
        caAssistedGst: "1800",
        caRevenueSharePercent: "45",
        expertConsultationFee: "2500",
        rushFilingFee: "1999",
        lateFeeMultiplier: "1.5",
        complexityLevel: "complex",
        estimatedProcessingDays: 7,
        eligibleForSelfFile: false,
        requiresCa: true,
        isActive: true,
      },
    ];

    let seeded = 0;
    let skipped = 0;

    for (const config of defaultConfigs) {
      const existing = await db
        .select()
        .from(itrPricingConfig)
        .where(eq(itrPricingConfig.itrFormType, config.itrFormType));

      if (existing.length === 0) {
        await db.insert(itrPricingConfig).values(config);
        seeded++;
      } else {
        skipped++;
      }
    }

    res.json({ 
      success: true, 
      message: `Seeded ${seeded} pricing configs, skipped ${skipped} existing` 
    });
  } catch (error: any) {
    console.error("[TaxServices] Error seeding pricing configs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
