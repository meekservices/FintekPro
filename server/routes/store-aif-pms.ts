import { Router } from "express";
import { db } from "../db";
import { aifMaster, pmsMaster, fundManagers, fundPerformanceMonthwise, fundPerformanceRolling, insertAifMasterSchema, insertPmsMasterSchema, mutualFunds, instrumentMaster } from "@shared/schema";
import { eq, and, desc, asc, ilike, sql, gte, lte, or, isNotNull } from "drizzle-orm";
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
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
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
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
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

// ============ UNIFIED PRODUCT SEARCH ============

// GET /store/products/search - Unified product search across all masters for portfolio entry
router.get("/products/search", async (req, res) => {
  try {
    const { 
      query = "", 
      productType = "all",
      limit = "20" 
    } = req.query;
    
    const searchQuery = (query as string).trim();
    if (!searchQuery || searchQuery.length < 2) {
      return res.json({ products: [] });
    }

    const results: any[] = [];
    const limitNum = Math.min(parseInt(limit as string) || 20, 50);

    // Search Mutual Funds
    if (productType === "all" || productType === "mutual_fund") {
      const mfResults = await db
        .select({
          id: mutualFunds.id,
          name: mutualFunds.schemeName,
          category: mutualFunds.category,
          issuer: mutualFunds.fundHouse,
          nav: mutualFunds.nav,
          returns1y: mutualFunds.returns1y,
          returns3y: mutualFunds.returns3y,
          riskLevel: mutualFunds.riskLevel,
          schemeCode: mutualFunds.schemeCode,
        })
        .from(mutualFunds)
        .where(
          and(
            eq(mutualFunds.isPublished, true),
            or(
              ilike(mutualFunds.schemeName, `%${searchQuery}%`),
              ilike(mutualFunds.fundHouse, `%${searchQuery}%`),
              ilike(mutualFunds.schemeCode, `%${searchQuery}%`)
            )
          )
        )
        .limit(limitNum);

      results.push(...mfResults.map(mf => ({
        id: mf.id,
        name: mf.name,
        productType: "mutual_fund",
        category: mf.category,
        issuer: mf.issuer,
        currentPrice: mf.nav ? parseFloat(mf.nav) : null,
        returns1y: mf.returns1y ? parseFloat(mf.returns1y) : null,
        returns3y: mf.returns3y ? parseFloat(mf.returns3y) : null,
        riskLevel: mf.riskLevel,
        identifier: mf.schemeCode,
      })));
    }

    // Search PMS schemes
    if (productType === "all" || productType === "pms") {
      const pmsResults = await db
        .select({
          id: pmsMaster.id,
          name: pmsMaster.name,
          strategy: pmsMaster.strategy,
          issuer: pmsMaster.fundHouseName,
          nav: pmsMaster.nav,
          returns1y: pmsMaster.returns1y,
          returns3y: pmsMaster.returns3y,
          riskScore: pmsMaster.riskScore,
        })
        .from(pmsMaster)
        .where(
          and(
            eq(pmsMaster.isPublished, true),
            or(
              ilike(pmsMaster.name, `%${searchQuery}%`),
              ilike(pmsMaster.fundHouseName, `%${searchQuery}%`)
            )
          )
        )
        .limit(limitNum);

      results.push(...pmsResults.map(pms => ({
        id: pms.id,
        name: pms.name,
        productType: "pms",
        category: pms.strategy,
        issuer: pms.issuer,
        currentPrice: pms.nav ? parseFloat(pms.nav) : null,
        returns1y: pms.returns1y ? parseFloat(pms.returns1y) : null,
        returns3y: pms.returns3y ? parseFloat(pms.returns3y) : null,
        riskLevel: pms.riskScore ? `Score: ${pms.riskScore}` : null,
        identifier: pms.id,
      })));
    }

    // Search AIF schemes
    if (productType === "all" || productType === "aif") {
      const aifResults = await db
        .select({
          id: aifMaster.id,
          name: aifMaster.name,
          category: aifMaster.category,
          issuer: aifMaster.fundHouseName,
          nav: aifMaster.nav,
          returns1y: aifMaster.returns1y,
          returns3y: aifMaster.returns3y,
          riskScore: aifMaster.riskScore,
        })
        .from(aifMaster)
        .where(
          and(
            eq(aifMaster.isPublished, true),
            or(
              ilike(aifMaster.name, `%${searchQuery}%`),
              ilike(aifMaster.fundHouseName, `%${searchQuery}%`)
            )
          )
        )
        .limit(limitNum);

      results.push(...aifResults.map(aif => ({
        id: aif.id,
        name: aif.name,
        productType: "aif",
        category: aif.category,
        issuer: aif.issuer,
        currentPrice: aif.nav ? parseFloat(aif.nav) : null,
        returns1y: aif.returns1y ? parseFloat(aif.returns1y) : null,
        returns3y: aif.returns3y ? parseFloat(aif.returns3y) : null,
        riskLevel: aif.riskScore ? `Score: ${aif.riskScore}` : null,
        identifier: aif.id,
      })));
    }

    // Search Instrument Master for stocks, bonds, etc.
    if (productType === "all" || productType === "equity" || productType === "bond" || productType === "etf") {
      const assetClasses = productType === "all" 
        ? ["equity", "bond", "etf"] 
        : [productType as string];
      
      const instrumentResults = await db
        .select()
        .from(instrumentMaster)
        .where(
          and(
            eq(instrumentMaster.isActive, true),
            or(...assetClasses.map(ac => eq(instrumentMaster.assetClass, ac))),
            or(
              ilike(instrumentMaster.name, `%${searchQuery}%`),
              ilike(instrumentMaster.symbol, `%${searchQuery}%`),
              ilike(instrumentMaster.isin, `%${searchQuery}%`)
            )
          )
        )
        .limit(limitNum);

      results.push(...instrumentResults.map(inst => ({
        id: inst.id,
        name: inst.name,
        productType: inst.assetClass,
        category: inst.category || inst.subType,
        issuer: inst.issuer,
        currentPrice: inst.lastPrice ? parseFloat(inst.lastPrice) : null,
        returns1y: null, // Would need separate returns table
        returns3y: null,
        riskLevel: inst.riskLevel,
        identifier: inst.isin || inst.symbol,
        isin: inst.isin,
        symbol: inst.symbol,
      })));
    }

    res.json({ products: results.slice(0, limitNum) });
  } catch (error: any) {
    console.error("Error searching products:", error);
    res.status(500).json({ error: "Failed to search products" });
  }
});

// GET /store/products/:productType/:id - Get single product details by ID
router.get("/products/:productType/:id", async (req, res) => {
  try {
    const { productType, id } = req.params;
    
    let product: any = null;

    if (productType === "mutual_fund") {
      const [mf] = await db
        .select()
        .from(mutualFunds)
        .where(eq(mutualFunds.id, id))
        .limit(1);
      
      if (mf) {
        product = {
          id: mf.id,
          name: mf.schemeName,
          productType: "mutual_fund",
          category: mf.category,
          issuer: mf.fundHouse,
          currentPrice: mf.nav ? parseFloat(mf.nav) : null,
          returns1y: mf.returns1y ? parseFloat(mf.returns1y) : null,
          returns3y: mf.returns3y ? parseFloat(mf.returns3y) : null,
          returns5y: mf.returns5y ? parseFloat(mf.returns5y) : null,
          riskLevel: mf.riskLevel,
          identifier: mf.schemeCode,
          aum: mf.aum,
          expenseRatio: mf.expenseRatio,
        };
      }
    } else if (productType === "pms") {
      const [pms] = await db
        .select()
        .from(pmsMaster)
        .where(eq(pmsMaster.id, id))
        .limit(1);
      
      if (pms) {
        product = {
          id: pms.id,
          name: pms.name,
          productType: "pms",
          category: pms.strategy,
          issuer: pms.fundHouseName,
          currentPrice: pms.nav ? parseFloat(pms.nav) : null,
          returns1y: pms.returns1y ? parseFloat(pms.returns1y) : null,
          returns3y: pms.returns3y ? parseFloat(pms.returns3y) : null,
          riskLevel: pms.riskScore ? `Score: ${pms.riskScore}` : null,
          identifier: pms.id,
          minInvestment: pms.minInvestment,
        };
      }
    } else if (productType === "aif") {
      const [aif] = await db
        .select()
        .from(aifMaster)
        .where(eq(aifMaster.id, id))
        .limit(1);
      
      if (aif) {
        product = {
          id: aif.id,
          name: aif.name,
          productType: "aif",
          category: aif.category,
          issuer: aif.fundHouseName,
          currentPrice: aif.nav ? parseFloat(aif.nav) : null,
          returns1y: aif.returns1y ? parseFloat(aif.returns1y) : null,
          returns3y: aif.returns3y ? parseFloat(aif.returns3y) : null,
          riskLevel: aif.riskScore ? `Score: ${aif.riskScore}` : null,
          identifier: aif.id,
          minInvestment: aif.minInvestment,
        };
      }
    } else {
      // Search instrument master for other types
      const [inst] = await db
        .select()
        .from(instrumentMaster)
        .where(eq(instrumentMaster.id, id))
        .limit(1);
      
      if (inst) {
        product = {
          id: inst.id,
          name: inst.name,
          productType: inst.assetClass,
          category: inst.category || inst.subType,
          issuer: inst.issuer,
          currentPrice: inst.lastPrice ? parseFloat(inst.lastPrice) : null,
          returns1y: null,
          returns3y: null,
          riskLevel: inst.riskLevel,
          identifier: inst.isin || inst.symbol,
          isin: inst.isin,
          symbol: inst.symbol,
        };
      }
    }

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error: any) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product details" });
  }
});

export default router;
