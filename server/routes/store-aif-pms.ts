import { Router } from "express";
import { db } from "../db";
import { aifMaster, pmsMaster, fundManagers, fundPerformanceMonthwise, fundPerformanceRolling, insertAifMasterSchema, insertPmsMasterSchema } from "@shared/schema";
import { eq, and, desc, asc, ilike, sql, gte, lte, or } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../middleware/roleMiddleware";

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
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
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
router.post("/admin/store/aif", requireAdmin, async (req, res) => {
  try {
    const { id, ...rawData } = req.body;
    
    if (id) {
      const updateSchema = insertAifMasterSchema.partial();
      const validation = updateSchema.safeParse(rawData);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error.errors });
      }
      await db
        .update(aifMaster)
        .set({ ...validation.data, updatedAt: new Date() })
        .where(eq(aifMaster.id, id));
      res.json({ success: true, message: "AIF scheme updated" });
    } else {
      const validation = insertAifMasterSchema.safeParse(rawData);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error.errors });
      }
      const result = await db.insert(aifMaster).values(validation.data).returning();
      res.json({ success: true, scheme: result[0] });
    }
  } catch (error: any) {
    console.error("Error saving AIF scheme:", error);
    res.status(500).json({ error: "Failed to save AIF scheme" });
  }
});

// POST /admin/store/pms - Create or update PMS scheme
router.post("/admin/store/pms", requireAdmin, async (req, res) => {
  try {
    const { id, ...rawData } = req.body;
    
    if (id) {
      const updateSchema = insertPmsMasterSchema.partial();
      const validation = updateSchema.safeParse(rawData);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error.errors });
      }
      await db
        .update(pmsMaster)
        .set({ ...validation.data, updatedAt: new Date() })
        .where(eq(pmsMaster.id, id));
      res.json({ success: true, message: "PMS scheme updated" });
    } else {
      const validation = insertPmsMasterSchema.safeParse(rawData);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error.errors });
      }
      const result = await db.insert(pmsMaster).values(validation.data).returning();
      res.json({ success: true, scheme: result[0] });
    }
  } catch (error: any) {
    console.error("Error saving PMS scheme:", error);
    res.status(500).json({ error: "Failed to save PMS scheme" });
  }
});

// ============ COMPARISON ROUTES ============

// POST /store/aif/compare - Compare multiple AIF schemes
router.post("/aif/compare", async (req, res) => {
  try {
    const { schemeIds } = req.body;
    
    if (!schemeIds || !Array.isArray(schemeIds) || schemeIds.length < 2 || schemeIds.length > 3) {
      return res.status(400).json({ error: "Please provide 2-3 scheme IDs to compare" });
    }
    
    const schemes = await db
      .select()
      .from(aifMaster)
      .leftJoin(fundManagers, eq(aifMaster.managerId, fundManagers.id))
      .where(
        or(...schemeIds.map((id: string) => eq(aifMaster.id, id)))
      );

    res.json({
      schemes: schemes.map(s => ({
        ...s.aif_master,
        manager: s.fund_managers
      }))
    });
  } catch (error: any) {
    console.error("Error comparing AIF schemes:", error);
    res.status(500).json({ error: "Failed to compare AIF schemes" });
  }
});

// POST /store/pms/compare - Compare multiple PMS schemes
router.post("/pms/compare", async (req, res) => {
  try {
    const { schemeIds } = req.body;
    
    if (!schemeIds || !Array.isArray(schemeIds) || schemeIds.length < 2 || schemeIds.length > 3) {
      return res.status(400).json({ error: "Please provide 2-3 scheme IDs to compare" });
    }
    
    const schemes = await db
      .select()
      .from(pmsMaster)
      .leftJoin(fundManagers, eq(pmsMaster.managerId, fundManagers.id))
      .where(
        or(...schemeIds.map((id: string) => eq(pmsMaster.id, id)))
      );

    res.json({
      schemes: schemes.map(s => ({
        ...s.pms_master,
        manager: s.fund_managers
      }))
    });
  } catch (error: any) {
    console.error("Error comparing PMS schemes:", error);
    res.status(500).json({ error: "Failed to compare PMS schemes" });
  }
});

export default router;
