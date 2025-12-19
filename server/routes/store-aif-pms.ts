import { Router } from "express";
import { db } from "../db";
import { aifMaster, pmsMaster, fundManagers, fundPerformanceMonthwise, fundPerformanceRolling, insertAifMasterSchema, insertPmsMasterSchema, mutualFunds, instrumentMaster, clientPortfolioAif, clientPortfolioPms, clientPortfolioMld, mldMaster, insertClientPortfolioAifSchema, insertClientPortfolioPmsSchema, users } from "@shared/schema";
import { eq, and, desc, asc, ilike, sql, gte, lte, or, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/roleMiddleware";

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

// ============ CLIENT PORTFOLIO - AIF HOLDINGS ============

// GET /portfolio/aif - Get client's AIF holdings
router.get("/portfolio/aif", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { clientId } = req.query;
    
    // Agent can view specific client, otherwise user views their own
    const targetClientId = clientId ? String(clientId) : userId;
    
    const holdings = await db
      .select({
        holding: clientPortfolioAif,
        aif: aifMaster,
        addedBy: users,
      })
      .from(clientPortfolioAif)
      .leftJoin(aifMaster, eq(clientPortfolioAif.aifId, aifMaster.id))
      .leftJoin(users, eq(clientPortfolioAif.addedByUserId, users.id))
      .where(eq(clientPortfolioAif.clientId, targetClientId))
      .orderBy(desc(clientPortfolioAif.createdAt));
    
    // Calculate summary
    const summary = holdings.reduce((acc, h) => {
      const value = parseFloat(h.holding.currentValue || "0");
      const invested = parseFloat(h.holding.capitalCalled || "0");
      acc.totalCurrentValue += value;
      acc.totalInvested += invested;
      acc.totalCommitment += parseFloat(h.holding.commitmentAmount || "0");
      acc.holdings += 1;
      return acc;
    }, { totalCurrentValue: 0, totalInvested: 0, totalCommitment: 0, holdings: 0 });
    
    summary.totalGainLoss = summary.totalCurrentValue - summary.totalInvested;
    summary.totalGainLossPercent = summary.totalInvested > 0 
      ? ((summary.totalGainLoss / summary.totalInvested) * 100) 
      : 0;
    
    res.json({
      holdings: holdings.map(h => ({
        ...h.holding,
        aifDetails: h.aif,
        addedByUser: h.addedBy ? { 
          id: h.addedBy.id, 
          name: `${h.addedBy.firstName || ""} ${h.addedBy.lastName || ""}`.trim() 
        } : null,
      })),
      summary,
    });
  } catch (error: any) {
    console.error("Error fetching AIF portfolio:", error);
    res.status(500).json({ error: "Failed to fetch AIF portfolio" });
  }
});

// POST /portfolio/aif - Add AIF holding
router.post("/portfolio/aif", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const data = req.body;
    
    // Validate required fields
    if (!data.aifName || !data.commitmentAmount || !data.capitalCalled || !data.investedDate) {
      return res.status(400).json({ error: "Missing required fields: aifName, commitmentAmount, capitalCalled, investedDate" });
    }
    
    // Set client and added by
    const clientId = data.clientId || userId;
    
    // Calculate uncalled capital
    const capitalUncalled = parseFloat(data.commitmentAmount) - parseFloat(data.capitalCalled);
    
    // If aifId provided, fetch latest NAV
    let latestNav = data.latestNav;
    let lastNavDate = data.lastNavDate;
    if (data.aifId) {
      const [aif] = await db.select().from(aifMaster).where(eq(aifMaster.id, data.aifId)).limit(1);
      if (aif) {
        latestNav = latestNav || aif.latestNav;
        lastNavDate = lastNavDate || aif.lastNavDate;
      }
    }
    
    // Calculate current value if units and NAV available
    let currentValue = data.currentValue;
    if (!currentValue && data.currentUnits && latestNav) {
      currentValue = parseFloat(data.currentUnits) * parseFloat(latestNav);
    }
    
    // Calculate unrealized gain/loss
    const costOfInvestment = data.costOfInvestment || data.capitalCalled;
    let unrealizedGainLoss = null;
    let unrealizedGainLossPercent = null;
    if (currentValue && costOfInvestment) {
      unrealizedGainLoss = parseFloat(currentValue) - parseFloat(costOfInvestment);
      unrealizedGainLossPercent = (unrealizedGainLoss / parseFloat(costOfInvestment)) * 100;
    }
    
    const [holding] = await db.insert(clientPortfolioAif).values({
      clientId,
      addedByUserId: userId,
      aifId: data.aifId || null,
      aifName: data.aifName,
      registrationNo: data.registrationNo,
      category: data.category,
      subcategory: data.subcategory,
      commitmentAmount: data.commitmentAmount,
      capitalCalled: data.capitalCalled,
      capitalUncalled: String(capitalUncalled),
      investedDate: data.investedDate,
      lockinEndDate: data.lockinEndDate,
      currentUnits: data.currentUnits,
      entryNav: data.entryNav,
      latestNav,
      lastNavDate,
      costOfInvestment,
      currentValue: currentValue ? String(currentValue) : null,
      unrealizedGainLoss: unrealizedGainLoss ? String(unrealizedGainLoss) : null,
      unrealizedGainLossPercent: unrealizedGainLossPercent ? String(unrealizedGainLossPercent) : null,
      documents: data.documents || [],
      notes: data.notes,
      entryStatus: "pending",
    }).returning();
    
    res.status(201).json(holding);
  } catch (error: any) {
    console.error("Error adding AIF holding:", error);
    res.status(500).json({ error: "Failed to add AIF holding" });
  }
});

// PUT /portfolio/aif/:id - Update AIF holding
router.put("/portfolio/aif/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const data = req.body;
    
    // Verify ownership or admin
    const [existing] = await db.select().from(clientPortfolioAif).where(eq(clientPortfolioAif.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: "AIF holding not found" });
    }
    
    // Calculate uncalled capital if commitment or called amounts changed
    let capitalUncalled = existing.capitalUncalled;
    if (data.commitmentAmount || data.capitalCalled) {
      const commitment = parseFloat(data.commitmentAmount || existing.commitmentAmount);
      const called = parseFloat(data.capitalCalled || existing.capitalCalled);
      capitalUncalled = String(commitment - called);
    }
    
    // Calculate current value if units or NAV changed
    let currentValue = data.currentValue;
    const units = data.currentUnits || existing.currentUnits;
    const nav = data.latestNav || existing.latestNav;
    if (!currentValue && units && nav) {
      currentValue = parseFloat(units) * parseFloat(nav);
    }
    
    // Calculate unrealized gain/loss
    const costOfInvestment = data.costOfInvestment || existing.costOfInvestment || existing.capitalCalled;
    let unrealizedGainLoss = null;
    let unrealizedGainLossPercent = null;
    if (currentValue && costOfInvestment) {
      unrealizedGainLoss = parseFloat(currentValue) - parseFloat(costOfInvestment);
      unrealizedGainLossPercent = (unrealizedGainLoss / parseFloat(costOfInvestment)) * 100;
    }
    
    const [updated] = await db.update(clientPortfolioAif)
      .set({
        ...data,
        capitalUncalled,
        currentValue: currentValue ? String(currentValue) : existing.currentValue,
        unrealizedGainLoss: unrealizedGainLoss ? String(unrealizedGainLoss) : existing.unrealizedGainLoss,
        unrealizedGainLossPercent: unrealizedGainLossPercent ? String(unrealizedGainLossPercent) : existing.unrealizedGainLossPercent,
        updatedAt: new Date(),
      })
      .where(eq(clientPortfolioAif.id, id))
      .returning();
    
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating AIF holding:", error);
    res.status(500).json({ error: "Failed to update AIF holding" });
  }
});

// DELETE /portfolio/aif/:id - Delete AIF holding
router.delete("/portfolio/aif/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [deleted] = await db.delete(clientPortfolioAif)
      .where(eq(clientPortfolioAif.id, id))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: "AIF holding not found" });
    }
    
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error("Error deleting AIF holding:", error);
    res.status(500).json({ error: "Failed to delete AIF holding" });
  }
});

// ============ CLIENT PORTFOLIO - PMS HOLDINGS ============

// GET /portfolio/pms - Get client's PMS holdings
router.get("/portfolio/pms", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { clientId } = req.query;
    
    const targetClientId = clientId ? String(clientId) : userId;
    
    const holdings = await db
      .select({
        holding: clientPortfolioPms,
        pms: pmsMaster,
        addedBy: users,
      })
      .from(clientPortfolioPms)
      .leftJoin(pmsMaster, eq(clientPortfolioPms.pmsId, pmsMaster.id))
      .leftJoin(users, eq(clientPortfolioPms.addedByUserId, users.id))
      .where(eq(clientPortfolioPms.clientId, targetClientId))
      .orderBy(desc(clientPortfolioPms.createdAt));
    
    // Calculate summary
    const summary = holdings.reduce((acc, h) => {
      const value = parseFloat(h.holding.currentValue || h.holding.corpusValue || "0");
      const invested = parseFloat(h.holding.totalInvested || h.holding.investedAmount || "0");
      acc.totalCurrentValue += value;
      acc.totalInvested += invested;
      acc.holdings += 1;
      return acc;
    }, { totalCurrentValue: 0, totalInvested: 0, holdings: 0 });
    
    summary.totalGainLoss = summary.totalCurrentValue - summary.totalInvested;
    summary.totalGainLossPercent = summary.totalInvested > 0 
      ? ((summary.totalGainLoss / summary.totalInvested) * 100) 
      : 0;
    
    res.json({
      holdings: holdings.map(h => ({
        ...h.holding,
        pmsDetails: h.pms,
        addedByUser: h.addedBy ? { 
          id: h.addedBy.id, 
          name: `${h.addedBy.firstName || ""} ${h.addedBy.lastName || ""}`.trim() 
        } : null,
      })),
      summary,
    });
  } catch (error: any) {
    console.error("Error fetching PMS portfolio:", error);
    res.status(500).json({ error: "Failed to fetch PMS portfolio" });
  }
});

// POST /portfolio/pms - Add PMS holding
router.post("/portfolio/pms", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const data = req.body;
    
    // Validate required fields
    if (!data.pmsName || !data.investedAmount || !data.startDate) {
      return res.status(400).json({ error: "Missing required fields: pmsName, investedAmount, startDate" });
    }
    
    const clientId = data.clientId || userId;
    
    // Calculate total invested
    const totalInvested = parseFloat(data.investedAmount) + parseFloat(data.additionalInfusions || "0");
    
    // If pmsId provided, fetch latest NAV
    let latestNav = data.latestNav;
    let lastNavDate = data.lastNavDate;
    if (data.pmsId) {
      const [pms] = await db.select().from(pmsMaster).where(eq(pmsMaster.id, data.pmsId)).limit(1);
      if (pms) {
        latestNav = latestNav || pms.latestNav;
        lastNavDate = lastNavDate || pms.lastNavDate;
      }
    }
    
    // Calculate unrealized gain/loss
    const currentValue = data.currentValue || data.corpusValue;
    let unrealizedGainLoss = null;
    let unrealizedGainLossPercent = null;
    if (currentValue && totalInvested) {
      unrealizedGainLoss = parseFloat(currentValue) - totalInvested;
      unrealizedGainLossPercent = (unrealizedGainLoss / totalInvested) * 100;
    }
    
    // Calculate CAGR
    let cagr = null;
    if (currentValue && data.investedAmount && data.startDate) {
      const startDate = new Date(data.startDate);
      const now = new Date();
      const years = (now.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (years > 0) {
        cagr = (Math.pow(parseFloat(currentValue) / parseFloat(data.investedAmount), 1 / years) - 1) * 100;
      }
    }
    
    const [holding] = await db.insert(clientPortfolioPms).values({
      clientId,
      addedByUserId: userId,
      pmsId: data.pmsId || null,
      pmsName: data.pmsName,
      registrationNo: data.registrationNo,
      strategy: data.strategy,
      investedAmount: data.investedAmount,
      additionalInfusions: data.additionalInfusions || "0",
      totalInvested: String(totalInvested),
      startDate: data.startDate,
      lastInfusionDate: data.lastInfusionDate,
      corpusValue: data.corpusValue,
      latestNav,
      lastNavDate,
      currentValue,
      unrealizedGainLoss: unrealizedGainLoss ? String(unrealizedGainLoss) : null,
      unrealizedGainLossPercent: unrealizedGainLossPercent ? String(unrealizedGainLossPercent) : null,
      cagr: cagr ? String(cagr) : null,
      documents: data.documents || [],
      notes: data.notes,
      entryStatus: "pending",
    }).returning();
    
    res.status(201).json(holding);
  } catch (error: any) {
    console.error("Error adding PMS holding:", error);
    res.status(500).json({ error: "Failed to add PMS holding" });
  }
});

// PUT /portfolio/pms/:id - Update PMS holding
router.put("/portfolio/pms/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const [existing] = await db.select().from(clientPortfolioPms).where(eq(clientPortfolioPms.id, id)).limit(1);
    if (!existing) {
      return res.status(404).json({ error: "PMS holding not found" });
    }
    
    // Calculate total invested
    const investedAmount = data.investedAmount || existing.investedAmount;
    const additionalInfusions = data.additionalInfusions || existing.additionalInfusions || "0";
    const totalInvested = parseFloat(investedAmount) + parseFloat(additionalInfusions);
    
    // Calculate unrealized gain/loss
    const currentValue = data.currentValue || data.corpusValue || existing.currentValue || existing.corpusValue;
    let unrealizedGainLoss = null;
    let unrealizedGainLossPercent = null;
    if (currentValue && totalInvested) {
      unrealizedGainLoss = parseFloat(currentValue) - totalInvested;
      unrealizedGainLossPercent = (unrealizedGainLoss / totalInvested) * 100;
    }
    
    // Calculate CAGR
    let cagr = null;
    const startDate = data.startDate || existing.startDate;
    if (currentValue && investedAmount && startDate) {
      const start = new Date(startDate);
      const now = new Date();
      const years = (now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (years > 0) {
        cagr = (Math.pow(parseFloat(currentValue) / parseFloat(investedAmount), 1 / years) - 1) * 100;
      }
    }
    
    const [updated] = await db.update(clientPortfolioPms)
      .set({
        ...data,
        totalInvested: String(totalInvested),
        unrealizedGainLoss: unrealizedGainLoss ? String(unrealizedGainLoss) : existing.unrealizedGainLoss,
        unrealizedGainLossPercent: unrealizedGainLossPercent ? String(unrealizedGainLossPercent) : existing.unrealizedGainLossPercent,
        cagr: cagr ? String(cagr) : existing.cagr,
        updatedAt: new Date(),
      })
      .where(eq(clientPortfolioPms.id, id))
      .returning();
    
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating PMS holding:", error);
    res.status(500).json({ error: "Failed to update PMS holding" });
  }
});

// DELETE /portfolio/pms/:id - Delete PMS holding
router.delete("/portfolio/pms/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [deleted] = await db.delete(clientPortfolioPms)
      .where(eq(clientPortfolioPms.id, id))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: "PMS holding not found" });
    }
    
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error("Error deleting PMS holding:", error);
    res.status(500).json({ error: "Failed to delete PMS holding" });
  }
});

// ============ ADMIN PORTFOLIO MANAGEMENT ============

// GET /portfolio/admin/all - Admin view all client portfolios
router.get("/portfolio/admin/all", requireAdmin, async (req, res) => {
  try {
    const { status, type } = req.query;
    
    // Fetch AIF holdings
    let aifHoldings = [];
    if (!type || type === "aif") {
      const aifConditions = [];
      if (status) aifConditions.push(eq(clientPortfolioAif.entryStatus, status as string));
      
      aifHoldings = await db
        .select({
          holding: clientPortfolioAif,
          client: users,
        })
        .from(clientPortfolioAif)
        .leftJoin(users, eq(clientPortfolioAif.clientId, users.id))
        .where(aifConditions.length > 0 ? and(...aifConditions) : undefined)
        .orderBy(desc(clientPortfolioAif.createdAt));
    }
    
    // Fetch PMS holdings
    let pmsHoldings = [];
    if (!type || type === "pms") {
      const pmsConditions = [];
      if (status) pmsConditions.push(eq(clientPortfolioPms.entryStatus, status as string));
      
      pmsHoldings = await db
        .select({
          holding: clientPortfolioPms,
          client: users,
        })
        .from(clientPortfolioPms)
        .leftJoin(users, eq(clientPortfolioPms.clientId, users.id))
        .where(pmsConditions.length > 0 ? and(...pmsConditions) : undefined)
        .orderBy(desc(clientPortfolioPms.createdAt));
    }
    
    // Fetch MLD holdings
    let mldHoldings: any[] = [];
    if (!type || type === "mld") {
      const mldConditions = [];
      if (status) mldConditions.push(eq(clientPortfolioMld.entryStatus, status as string));
      
      mldHoldings = await db
        .select({
          holding: clientPortfolioMld,
          client: users,
          mld: mldMaster,
        })
        .from(clientPortfolioMld)
        .leftJoin(users, eq(clientPortfolioMld.clientId, users.id))
        .leftJoin(mldMaster, eq(clientPortfolioMld.isin, mldMaster.isin))
        .where(mldConditions.length > 0 ? and(...mldConditions) : undefined)
        .orderBy(desc(clientPortfolioMld.createdAt));
    }
    
    res.json({
      aif: aifHoldings.map(h => ({
        ...h.holding,
        type: "aif",
        client: h.client ? {
          id: h.client.id,
          name: `${h.client.firstName || ""} ${h.client.lastName || ""}`.trim(),
          email: h.client.email,
        } : null,
      })),
      pms: pmsHoldings.map(h => ({
        ...h.holding,
        type: "pms",
        client: h.client ? {
          id: h.client.id,
          name: `${h.client.firstName || ""} ${h.client.lastName || ""}`.trim(),
          email: h.client.email,
        } : null,
      })),
      mld: mldHoldings.map(h => ({
        ...h.holding,
        type: "mld",
        mldName: h.mld?.name || h.holding.mldName || "Unknown MLD",
        issuer: h.mld?.issuer || null,
        payoffType: h.mld?.payoffType || "digital",
        totalInvested: h.holding.quantity && h.holding.purchasePrice 
          ? String(Number(h.holding.quantity) * Number(h.holding.purchasePrice))
          : null,
        client: h.client ? {
          id: h.client.id,
          name: `${h.client.firstName || ""} ${h.client.lastName || ""}`.trim(),
          email: h.client.email,
        } : null,
      })),
      summary: {
        totalAifHoldings: aifHoldings.length,
        totalPmsHoldings: pmsHoldings.length,
        totalMldHoldings: mldHoldings.length,
        pendingApproval: aifHoldings.filter(h => h.holding.entryStatus === "pending").length +
                        pmsHoldings.filter(h => h.holding.entryStatus === "pending").length +
                        mldHoldings.filter(h => h.holding.entryStatus === "pending").length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching admin portfolio view:", error);
    res.status(500).json({ error: "Failed to fetch portfolio data" });
  }
});

// PUT /portfolio/admin/approve/:type/:id - Admin approve/reject holding
router.put("/portfolio/admin/approve/:type/:id", requireAdmin, async (req, res) => {
  try {
    const { type, id } = req.params;
    const { action, rejectionReason } = req.body;
    const adminId = (req as any).user?.id;
    
    if (!["approve", "reject", "needs_review"].includes(action)) {
      return res.status(400).json({ error: "Invalid action. Must be approve, reject, or needs_review" });
    }
    
    const entryStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "needs_review";
    
    if (type === "aif") {
      const [updated] = await db.update(clientPortfolioAif)
        .set({
          entryStatus,
          approvedByUserId: action === "approve" ? adminId : null,
          approvedAt: action === "approve" ? new Date() : null,
          rejectionReason: action === "reject" ? rejectionReason : null,
          updatedAt: new Date(),
        })
        .where(eq(clientPortfolioAif.id, id))
        .returning();
      
      res.json(updated);
    } else if (type === "pms") {
      const [updated] = await db.update(clientPortfolioPms)
        .set({
          entryStatus,
          approvedByUserId: action === "approve" ? adminId : null,
          approvedAt: action === "approve" ? new Date() : null,
          rejectionReason: action === "reject" ? rejectionReason : null,
          updatedAt: new Date(),
        })
        .where(eq(clientPortfolioPms.id, id))
        .returning();
      
      res.json(updated);
    } else if (type === "mld") {
      const [updated] = await db.update(clientPortfolioMld)
        .set({
          entryStatus,
          approvedByUserId: action === "approve" ? adminId : null,
          approvedAt: action === "approve" ? new Date() : null,
          rejectionReason: action === "reject" ? rejectionReason : null,
          updatedAt: new Date(),
        })
        .where(eq(clientPortfolioMld.id, id))
        .returning();
      
      res.json(updated);
    } else {
      res.status(400).json({ error: "Invalid type. Must be aif, pms, or mld" });
    }
  } catch (error: any) {
    console.error("Error approving/rejecting holding:", error);
    res.status(500).json({ error: "Failed to process approval" });
  }
});

export default router;
