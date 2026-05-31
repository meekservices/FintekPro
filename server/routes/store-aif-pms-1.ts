// @ts-nocheck
import { Router } from "express";
import { db } from "../db";
import { aifMaster, pmsMaster, fundManagers, fundPerformanceMonthwise, fundPerformanceRolling, insertAifMasterSchema, insertPmsMasterSchema, mutualFunds, instrumentMaster, clientPortfolioAif, clientPortfolioPms, clientPortfolioMld, mldMaster, insertClientPortfolioAifSchema, insertClientPortfolioPmsSchema, users, investmentInquiries, insertInvestmentInquirySchema } from "@shared/schema";
import { eq, and, desc, asc, ilike, sql, gte, lte, or, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/roleMiddleware";
import { fetchSebiAifListings, SebiAifListing, generateComprehensiveAifSeedData, AifSeedData } from "../services/sebi-aif-scraper";
import { fetchSebiPmsListings, SebiPmsListing, generateComprehensivePmsSeedData, PmsSeedData } from "../services/sebi-pms-scraper";
import { externalRemittanceService, RemittanceUploadRequest, RemittanceDocumentUpload } from "../services/external-remittance-service";
import { aiRecommendationSyncService } from "../services/ai-recommendation-sync-service";
import * as schema from "@shared/schema";

const router = Router();

// ============ AIF ROUTES ============

// GET /store/aif - List published AIF schemes with filters
router.get("/aif", async (req, res) => {
  try {
    const { 
      status = "active",
      category,
      style,
      minInvestment,
      maxInvestment,
      riskScore,
      search,
      sortBy = "name",
      sortOrder = "asc",
      page = "1",
      limit = "20"
    } = req.query;

    const conditions: any[] = [eq(aifMaster.isPublished, true)];
    
    if (status && status !== "all") {
      conditions.push(eq(aifMaster.fundStatus, status as string));
    }
    
    if (category) {
      conditions.push(eq(aifMaster.category, category as string));
    }
    
    if (style) {
      conditions.push(eq(aifMaster.style, style as string));
    }
    
    if (search) {
      conditions.push(
        or(
          ilike(aifMaster.name, `%${search}%`),
          ilike(aifMaster.fundHouseName, `%${search}%`)
        )
      );
    }
    
    if (riskScore) {
      const [minRisk, maxRisk] = (riskScore as string).includes("-") 
        ? (riskScore as string).split("-").map(Number)
        : [parseInt(riskScore as string), parseInt(riskScore as string)];
      conditions.push(gte(aifMaster.riskScore, minRisk));
      conditions.push(lte(aifMaster.riskScore, maxRisk));
    }
    
    if (minInvestment) {
      const minVal = parseFloat(minInvestment as string);
      if (!isNaN(minVal)) {
        conditions.push(sql`CAST(${aifMaster.minInvestment} AS NUMERIC) >= ${minVal}`);
      }
    }
    
    if (maxInvestment) {
      const maxVal = parseFloat(maxInvestment as string);
      if (!isNaN(maxVal)) {
        conditions.push(sql`CAST(${aifMaster.minInvestment} AS NUMERIC) <= ${maxVal}`);
      }
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const orderColumn = sortBy === "return1Y" ? aifMaster.return1Y 
      : sortBy === "return3Y" ? aifMaster.return3Y
      : sortBy === "aum" ? aifMaster.aum
      : sortBy === "riskScore" ? aifMaster.riskScore
      : aifMaster.name;
    
    const schemes = await db
      .select()
      .from(aifMaster)
      .leftJoin(fundManagers, eq(aifMaster.managerId, fundManagers.id))
      .where(and(...conditions))
      .orderBy(sortOrder === "desc" ? desc(orderColumn) : asc(orderColumn))
      .limit(parseInt(limit as string))
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(aifMaster)
      .where(and(...conditions));
    
    const total = countResult[0]?.count || 0;

    res.json({
      schemes: schemes.map(s => ({
        ...s.aif_master,
        manager: s.fund_managers
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    console.error("Error fetching AIF schemes:", error);
    res.status(500).json({ error: "Failed to fetch AIF schemes" });
  }
});

// GET /aif/admin - List all AIF schemes for admin (must be before /:id)
router.get("/aif/admin", requireAdmin, async (req, res) => {
  try {
    const schemes = await db
      .select()
      .from(aifMaster)
      .leftJoin(fundManagers, eq(aifMaster.managerId, fundManagers.id))
      .orderBy(desc(aifMaster.updatedAt));

    res.json({
      schemes: schemes.map(s => ({
        ...s.aif_master,
        manager: s.fund_managers
      }))
    });
  } catch (error: any) {
    console.error("Error fetching admin AIF list:", error);
    res.status(500).json({ error: "Failed to fetch AIF schemes for admin" });
  }
});

// PATCH /aif/:id/publish - Toggle AIF publish status (must be before general /:id)
router.patch("/aif/:id/publish", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({ isPublished: z.boolean() });
    const validation = schema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.issues });
    }
    
    await db
      .update(aifMaster)
      .set({ isPublished: validation.data.isPublished, updatedAt: new Date() })
      .where(eq(aifMaster.id, id));
    
    res.json({ success: true, message: `AIF ${validation.data.isPublished ? "published" : "unpublished"} successfully` });
  } catch (error: any) {
    console.error("Error updating AIF publish status:", error);
    res.status(500).json({ error: "Failed to update publish status" });
  }
});

// GET /store/aif/:id - Get AIF scheme details
router.get("/aif/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const scheme = await db
      .select()
      .from(aifMaster)
      .leftJoin(fundManagers, eq(aifMaster.managerId, fundManagers.id))
      .where(eq(aifMaster.id, id))
      .limit(1);
    
    if (!scheme || scheme.length === 0) {
      return res.status(404).json({ error: "AIF scheme not found" });
    }

    res.json({
      ...scheme[0].aif_master,
      manager: scheme[0].fund_managers
    });
  } catch (error: any) {
    console.error("Error fetching AIF scheme:", error);
    res.status(500).json({ error: "Failed to fetch AIF scheme details" });
  }
});

// ============ PMS ROUTES ============

// GET /store/pms - List published PMS schemes with filters
router.get("/pms", async (req, res) => {
  try {
    const { 
      status = "active",
      strategy,
      style,
      minInvestment,
      maxInvestment,
      riskScore,
      search,
      sortBy = "name",
      sortOrder = "asc",
      page = "1",
      limit = "20"
    } = req.query;

    const conditions: any[] = [eq(pmsMaster.isPublished, true)];
    
    if (status && status !== "all") {
      conditions.push(eq(pmsMaster.fundStatus, status as string));
    }
    
    if (strategy) {
      conditions.push(eq(pmsMaster.strategy, strategy as string));
    }
    
    if (style) {
      conditions.push(eq(pmsMaster.style, style as string));
    }
    
    if (search) {
      conditions.push(
        or(
          ilike(pmsMaster.name, `%${search}%`),
          ilike(pmsMaster.fundHouseName, `%${search}%`)
        )
      );
    }
    
    if (riskScore) {
      const [minRisk, maxRisk] = (riskScore as string).includes("-") 
        ? (riskScore as string).split("-").map(Number)
        : [parseInt(riskScore as string), parseInt(riskScore as string)];
      conditions.push(gte(pmsMaster.riskScore, minRisk));
      conditions.push(lte(pmsMaster.riskScore, maxRisk));
    }
    
    if (minInvestment) {
      const minVal = parseFloat(minInvestment as string);
      if (!isNaN(minVal)) {
        conditions.push(sql`CAST(${pmsMaster.minInvestment} AS NUMERIC) >= ${minVal}`);
      }
    }
    
    if (maxInvestment) {
      const maxVal = parseFloat(maxInvestment as string);
      if (!isNaN(maxVal)) {
        conditions.push(sql`CAST(${pmsMaster.minInvestment} AS NUMERIC) <= ${maxVal}`);
      }
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const orderColumn = sortBy === "return1Y" ? pmsMaster.return1Y 
      : sortBy === "return3Y" ? pmsMaster.return3Y
      : sortBy === "aum" ? pmsMaster.aum
      : sortBy === "riskScore" ? pmsMaster.riskScore
      : pmsMaster.name;
    
    const schemes = await db
      .select()
      .from(pmsMaster)
      .leftJoin(fundManagers, eq(pmsMaster.managerId, fundManagers.id))
      .where(and(...conditions))
      .orderBy(sortOrder === "desc" ? desc(orderColumn) : asc(orderColumn))
      .limit(parseInt(limit as string))
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(pmsMaster)
      .where(and(...conditions));
    
    const total = countResult[0]?.count || 0;

    res.json({
      schemes: schemes.map(s => ({
        ...s.pms_master,
        manager: s.fund_managers
      })),
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        totalPages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error: any) {
    console.error("Error fetching PMS schemes:", error);
    res.status(500).json({ error: "Failed to fetch PMS schemes" });
  }
});

// GET /pms/admin - List all PMS schemes for admin (must be before /:id)
router.get("/pms/admin", requireAdmin, async (req, res) => {
  try {
    const schemes = await db
      .select()
      .from(pmsMaster)
      .leftJoin(fundManagers, eq(pmsMaster.managerId, fundManagers.id))
      .orderBy(desc(pmsMaster.updatedAt));

    res.json({
      schemes: schemes.map(s => ({
        ...s.pms_master,
        manager: s.fund_managers
      }))
    });
  } catch (error: any) {
    console.error("Error fetching admin PMS list:", error);
    res.status(500).json({ error: "Failed to fetch PMS schemes for admin" });
  }
});

// PATCH /pms/:id/publish - Toggle PMS publish status (must be before general /:id)
router.patch("/pms/:id/publish", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const schema = z.object({ isPublished: z.boolean() });
    const validation = schema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.issues });
    }
    
    await db
      .update(pmsMaster)
      .set({ isPublished: validation.data.isPublished, updatedAt: new Date() })
      .where(eq(pmsMaster.id, id));
    
    res.json({ success: true, message: `PMS ${validation.data.isPublished ? "published" : "unpublished"} successfully` });
  } catch (error: any) {
    console.error("Error updating PMS publish status:", error);
    res.status(500).json({ error: "Failed to update publish status" });
  }
});

// GET /store/pms/:id - Get PMS scheme details
router.get("/pms/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const scheme = await db
      .select()
      .from(pmsMaster)
      .leftJoin(fundManagers, eq(pmsMaster.managerId, fundManagers.id))
      .where(eq(pmsMaster.id, id))
      .limit(1);
    
    if (!scheme || scheme.length === 0) {
      return res.status(404).json({ error: "PMS scheme not found" });
    }

    res.json({
      ...scheme[0].pms_master,
      manager: scheme[0].fund_managers
    });
  } catch (error: any) {
    console.error("Error fetching PMS scheme:", error);
    res.status(500).json({ error: "Failed to fetch PMS scheme details" });
  }
});

// ============ PERFORMANCE ROUTES ============

// GET /performance/fund/:id/monthwise - Get monthwise performance
router.get("/performance/fund/:id/monthwise", async (req, res) => {
  try {
    const { id } = req.params;
    const { fundType = "aif", years = "3" } = req.query;
    
    const yearsAgo = new Date();
    yearsAgo.setFullYear(yearsAgo.getFullYear() - parseInt(years as string));
    
    const performance = await db
      .select()
      .from(fundPerformanceMonthwise)
      .where(
        and(
          eq(fundPerformanceMonthwise.fundId, id),
          eq(fundPerformanceMonthwise.fundType, fundType as string),
          gte(fundPerformanceMonthwise.year, yearsAgo.getFullYear())
        )
      )
      .orderBy(desc(fundPerformanceMonthwise.year), desc(fundPerformanceMonthwise.month));

    res.json({ performance });
  } catch (error: any) {
    console.error("Error fetching monthwise performance:", error);
    res.status(500).json({ error: "Failed to fetch monthwise performance" });
  }
});

// GET /performance/fund/:id/rolling - Get rolling returns
router.get("/performance/fund/:id/rolling", async (req, res) => {
  try {
    const { id } = req.params;
    const { fundType = "aif" } = req.query;
    
    const rolling = await db
      .select()
      .from(fundPerformanceRolling)
      .where(
        and(
          eq(fundPerformanceRolling.fundId, id),
          eq(fundPerformanceRolling.fundType, fundType as string)
        )
      )
      .orderBy(desc(fundPerformanceRolling.asOfDate))
      .limit(1);

    res.json({ rolling: rolling[0] || null });
  } catch (error: any) {
    console.error("Error fetching rolling performance:", error);
    res.status(500).json({ error: "Failed to fetch rolling performance" });
  }
});

// ============ ADMIN ROUTES ============

// POST /admin/store/publish - Toggle publish status for AIF/PMS
router.post("/admin/store/publish", requireAdmin, async (req, res) => {
  try {
    const schema = z.object({
      fundType: z.enum(["aif", "pms"]),
      fundId: z.string().uuid(),
      publish: z.boolean()
    });
    
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.issues });
    }
    
    const { fundType, fundId, publish } = validation.data;
    
    if (fundType === "aif") {
      await db
        .update(aifMaster)
        .set({ isPublished: publish, updatedAt: new Date() })
        .where(eq(aifMaster.id, fundId));
    } else {
      await db
        .update(pmsMaster)
        .set({ isPublished: publish, updatedAt: new Date() })
        .where(eq(pmsMaster.id, fundId));
    }
    
    res.json({ success: true, message: `${fundType.toUpperCase()} ${publish ? "published" : "unpublished"} successfully` });
  } catch (error: any) {
    console.error("Error updating publish status:", error);
    res.status(500).json({ error: "Failed to update publish status" });
  }
});

// GET /admin/store/aif - List all AIF schemes for admin (including unpublished)
router.get("/admin/store/aif", requireAdmin, async (req, res) => {
  try {
    const schemes = await db
      .select()
      .from(aifMaster)
      .leftJoin(fundManagers, eq(aifMaster.managerId, fundManagers.id))
      .orderBy(desc(aifMaster.updatedAt));

    res.json({
      schemes: schemes.map(s => ({
        ...s.aif_master,
        manager: s.fund_managers
      }))
    });
  } catch (error: any) {
    console.error("Error fetching admin AIF list:", error);
    res.status(500).json({ error: "Failed to fetch AIF schemes for admin" });
  }
});

// GET /admin/store/pms - List all PMS schemes for admin (including unpublished)
router.get("/admin/store/pms", requireAdmin, async (req, res) => {
  try {
    const schemes = await db
      .select()
      .from(pmsMaster)
      .leftJoin(fundManagers, eq(pmsMaster.managerId, fundManagers.id))
      .orderBy(desc(pmsMaster.updatedAt));

    res.json({
      schemes: schemes.map(s => ({
        ...s.pms_master,
        manager: s.fund_managers
      }))
    });
  } catch (error: any) {
    console.error("Error fetching admin PMS list:", error);
    res.status(500).json({ error: "Failed to fetch PMS schemes for admin" });
  }
});

// POST /admin/store/aif - Create or update AIF scheme

export default router;
