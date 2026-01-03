import { Router, Request, Response } from "express";
import { db } from "../db";
import { itrPricingConfig } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const itrPricingSchema = z.object({
  itrFormType: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  selfFileFee: z.string().or(z.number()).transform(v => String(v)),
  selfFileGst: z.string().or(z.number()).transform(v => String(v)).optional(),
  caAssistedFee: z.string().or(z.number()).transform(v => String(v)),
  caAssistedGst: z.string().or(z.number()).transform(v => String(v)).optional(),
  caRevenueSharePercent: z.string().or(z.number()).transform(v => String(v)).optional(),
  expertConsultationFee: z.string().or(z.number()).transform(v => String(v)).optional(),
  rushFilingFee: z.string().or(z.number()).transform(v => String(v)).optional(),
  lateFeeMultiplier: z.string().or(z.number()).transform(v => String(v)).optional(),
  complexityLevel: z.enum(["simple", "standard", "complex"]).optional(),
  estimatedProcessingDays: z.number().int().positive().optional(),
  eligibleForSelfFile: z.boolean().optional(),
  requiresCa: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

router.get("/", async (_req: Request, res: Response) => {
  try {
    const pricing = await db
      .select()
      .from(itrPricingConfig)
      .orderBy(itrPricingConfig.itrFormType);

    res.json({ success: true, data: pricing });
  } catch (error: any) {
    console.error("Error fetching ITR pricing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/:formType", async (req: Request, res: Response) => {
  try {
    const { formType } = req.params;
    
    const [pricing] = await db
      .select()
      .from(itrPricingConfig)
      .where(eq(itrPricingConfig.itrFormType, formType))
      .limit(1);

    if (!pricing) {
      return res.status(404).json({ success: false, error: "Pricing not found" });
    }

    res.json({ success: true, data: pricing });
  } catch (error: any) {
    console.error("Error fetching ITR pricing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const data = itrPricingSchema.parse(req.body);
    const userId = (req as any).user?.id;

    const [existing] = await db
      .select()
      .from(itrPricingConfig)
      .where(eq(itrPricingConfig.itrFormType, data.itrFormType))
      .limit(1);

    if (existing) {
      return res.status(400).json({ 
        success: false, 
        error: `Pricing for ${data.itrFormType} already exists. Use PUT to update.` 
      });
    }

    const [created] = await db
      .insert(itrPricingConfig)
      .values({
        ...data,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    }
    console.error("Error creating ITR pricing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = itrPricingSchema.partial().parse(req.body);
    const userId = (req as any).user?.id;

    const [updated] = await db
      .update(itrPricingConfig)
      .set({
        ...data,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(itrPricingConfig.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ success: false, error: "Pricing not found" });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    }
    console.error("Error updating ITR pricing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [deleted] = await db
      .delete(itrPricingConfig)
      .where(eq(itrPricingConfig.id, id))
      .returning();

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Pricing not found" });
    }

    res.json({ success: true, message: "Pricing deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting ITR pricing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/seed-defaults", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    const defaultPricing = [
      {
        itrFormType: "ITR-1",
        displayName: "ITR-1 (Sahaj)",
        description: "For salaried individuals with income up to ₹50 lakh",
        selfFileFee: "499",
        caAssistedFee: "999",
        caRevenueSharePercent: "50",
        complexityLevel: "simple" as const,
        estimatedProcessingDays: 1,
        eligibleForSelfFile: true,
        requiresCa: false,
      },
      {
        itrFormType: "ITR-2",
        displayName: "ITR-2",
        description: "For individuals with capital gains or multiple house properties",
        selfFileFee: "999",
        caAssistedFee: "2499",
        caRevenueSharePercent: "55",
        complexityLevel: "standard" as const,
        estimatedProcessingDays: 2,
        eligibleForSelfFile: true,
        requiresCa: false,
      },
      {
        itrFormType: "ITR-3",
        displayName: "ITR-3",
        description: "For individuals with business or professional income",
        selfFileFee: "1999",
        caAssistedFee: "4999",
        caRevenueSharePercent: "60",
        complexityLevel: "complex" as const,
        estimatedProcessingDays: 3,
        eligibleForSelfFile: false,
        requiresCa: true,
      },
      {
        itrFormType: "ITR-4",
        displayName: "ITR-4 (Sugam)",
        description: "For presumptive income from business/profession",
        selfFileFee: "799",
        caAssistedFee: "1999",
        caRevenueSharePercent: "50",
        complexityLevel: "simple" as const,
        estimatedProcessingDays: 2,
        eligibleForSelfFile: true,
        requiresCa: false,
      },
      {
        itrFormType: "ITR-5",
        displayName: "ITR-5",
        description: "For partnerships, LLPs, AOPs, BOIs",
        selfFileFee: "0",
        caAssistedFee: "7999",
        caRevenueSharePercent: "65",
        complexityLevel: "complex" as const,
        estimatedProcessingDays: 5,
        eligibleForSelfFile: false,
        requiresCa: true,
      },
      {
        itrFormType: "ITR-6",
        displayName: "ITR-6",
        description: "For companies (other than Section 11 exemption)",
        selfFileFee: "0",
        caAssistedFee: "14999",
        caRevenueSharePercent: "70",
        complexityLevel: "complex" as const,
        estimatedProcessingDays: 7,
        eligibleForSelfFile: false,
        requiresCa: true,
      },
      {
        itrFormType: "ITR-7",
        displayName: "ITR-7",
        description: "For trusts, political parties, institutions",
        selfFileFee: "0",
        caAssistedFee: "9999",
        caRevenueSharePercent: "65",
        complexityLevel: "complex" as const,
        estimatedProcessingDays: 5,
        eligibleForSelfFile: false,
        requiresCa: true,
      },
    ];

    const results = [];
    for (const pricing of defaultPricing) {
      const [existing] = await db
        .select()
        .from(itrPricingConfig)
        .where(eq(itrPricingConfig.itrFormType, pricing.itrFormType))
        .limit(1);

      if (!existing) {
        const [created] = await db
          .insert(itrPricingConfig)
          .values({
            ...pricing,
            createdBy: userId,
            updatedBy: userId,
          })
          .returning();
        results.push({ formType: pricing.itrFormType, action: "created", data: created });
      } else {
        results.push({ formType: pricing.itrFormType, action: "skipped", reason: "already exists" });
      }
    }

    res.json({ success: true, message: "Default pricing seeded", results });
  } catch (error: any) {
    console.error("Error seeding ITR pricing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
