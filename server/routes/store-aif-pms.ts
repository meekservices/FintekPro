import { Router } from "express";
import { db } from "../db";
import { aifMaster, pmsMaster, fundManagers, fundPerformanceMonthwise, fundPerformanceRolling, insertAifMasterSchema, insertPmsMasterSchema, mutualFunds, instrumentMaster, clientPortfolioAif, clientPortfolioPms, clientPortfolioMld, mldMaster, insertClientPortfolioAifSchema, insertClientPortfolioPmsSchema, users, investmentInquiries, insertInvestmentInquirySchema } from "@shared/schema";
import { eq, and, desc, asc, ilike, sql, gte, lte, or, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/roleMiddleware";
import { fetchSebiAifListings, SebiAifListing, generateComprehensiveAifSeedData, AifSeedData } from "../services/sebi-aif-scraper";
import { fetchSebiPmsListings, SebiPmsListing, generateComprehensivePmsSeedData, PmsSeedData } from "../services/sebi-pms-scraper";
import { externalRemittanceService, RemittanceUploadRequest, RemittanceDocumentUpload } from "../services/external-remittance-service";

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
          nav: pmsMaster.latestNav,
          returns1y: pmsMaster.return1Y,
          returns3y: pmsMaster.return3Y,
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
          nav: aifMaster.latestNav,
          returns1y: aifMaster.return1Y,
          returns3y: aifMaster.return3Y,
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
          currentPrice: pms.latestNav ? parseFloat(pms.latestNav) : null,
          returns1y: pms.return1Y ? parseFloat(pms.return1Y) : null,
          returns3y: pms.return3Y ? parseFloat(pms.return3Y) : null,
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
          currentPrice: aif.latestNav ? parseFloat(aif.latestNav) : null,
          returns1y: aif.return1Y ? parseFloat(aif.return1Y) : null,
          returns3y: aif.return3Y ? parseFloat(aif.return3Y) : null,
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
    const summaryData = holdings.reduce((acc, h) => {
      const value = parseFloat(h.holding.currentValue || "0");
      const invested = parseFloat(h.holding.capitalCalled || "0");
      acc.totalCurrentValue += value;
      acc.totalInvested += invested;
      acc.totalCommitment += parseFloat(h.holding.commitmentAmount || "0");
      acc.holdings += 1;
      return acc;
    }, { totalCurrentValue: 0, totalInvested: 0, totalCommitment: 0, holdings: 0 });
    
    const totalGainLoss = summaryData.totalCurrentValue - summaryData.totalInvested;
    const summary = {
      ...summaryData,
      totalGainLoss,
      totalGainLossPercent: summaryData.totalInvested > 0 
        ? ((totalGainLoss / summaryData.totalInvested) * 100) 
        : 0,
    };
    
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
    const summaryData = holdings.reduce((acc, h) => {
      const value = parseFloat(h.holding.currentValue || h.holding.corpusValue || "0");
      const invested = parseFloat(h.holding.totalInvested || h.holding.investedAmount || "0");
      acc.totalCurrentValue += value;
      acc.totalInvested += invested;
      acc.holdings += 1;
      return acc;
    }, { totalCurrentValue: 0, totalInvested: 0, holdings: 0 });
    
    const totalGainLoss = summaryData.totalCurrentValue - summaryData.totalInvested;
    const summary = {
      ...summaryData,
      totalGainLoss,
      totalGainLossPercent: summaryData.totalInvested > 0 
        ? ((totalGainLoss / summaryData.totalInvested) * 100) 
        : 0,
    };
    
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
    let aifHoldings: Array<{ holding: typeof clientPortfolioAif.$inferSelect; client: typeof users.$inferSelect | null }> = [];
    if (!type || type === "aif") {
      const aifConditions: any[] = [];
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
    let pmsHoldings: Array<{ holding: typeof clientPortfolioPms.$inferSelect; client: typeof users.$inferSelect | null }> = [];
    if (!type || type === "pms") {
      const pmsConditions: any[] = [];
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

// ============ AIF SEEDING (IMPORT FROM SEBI) ============

// GET /aif/sebi/preview - Preview SEBI AIFs with duplicate detection
router.get("/aif/sebi/preview", requireAdmin, async (req, res) => {
  try {
    console.log("[SEBI AIF Import] Fetching preview...");
    
    const result = await fetchSebiAifListings();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch SEBI AIF listings",
        details: result.errors,
      });
    }
    
    // Get existing AIFs by registration number for duplicate detection
    const existingAifs = await db
      .select({ registrationNo: aifMaster.registrationNo })
      .from(aifMaster)
      .where(isNotNull(aifMaster.registrationNo));
    
    const existingRegNos = new Set(
      existingAifs
        .map(a => a.registrationNo?.trim().toUpperCase())
        .filter(Boolean)
    );
    
    // Mark duplicates
    const listings = result.listings.map(listing => ({
      ...listing,
      isDuplicate: existingRegNos.has(listing.registrationNo.trim().toUpperCase()),
    }));
    
    const newCount = listings.filter(l => !l.isDuplicate).length;
    const duplicateCount = listings.filter(l => l.isDuplicate).length;
    
    console.log(`[SEBI AIF Import] Preview: ${listings.length} total, ${newCount} new, ${duplicateCount} duplicates`);
    
    res.json({
      success: true,
      listings,
      summary: {
        total: listings.length,
        new: newCount,
        duplicates: duplicateCount,
      },
    });
  } catch (error: any) {
    console.error("[SEBI AIF Import] Preview error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to preview SEBI AIFs",
      details: error.message,
    });
  }
});

// POST /aif/sebi/import - Import selected AIFs from SEBI
router.post("/aif/sebi/import", requireAdmin, async (req, res) => {
  try {
    const { listings } = req.body as { listings: SebiAifListing[] };
    
    if (!listings || !Array.isArray(listings) || listings.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No listings provided for import",
      });
    }
    
    console.log(`[SEBI AIF Import] Starting import of ${listings.length} AIFs...`);
    
    // Get existing registration numbers
    const existingAifs = await db
      .select({ registrationNo: aifMaster.registrationNo })
      .from(aifMaster)
      .where(isNotNull(aifMaster.registrationNo));
    
    const existingRegNoSet = new Set(
      existingAifs
        .map(a => a.registrationNo?.trim().toUpperCase())
        .filter(Boolean)
    );
    
    const imported: any[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];
    
    for (const listing of listings) {
      const normalizedRegNo = listing.registrationNo.trim().toUpperCase();
      
      // Skip if already exists
      if (existingRegNoSet.has(normalizedRegNo)) {
        skipped.push(listing.registrationNo);
        continue;
      }
      
      try {
        // Determine default min investment based on category
        let minInvestment = "10000000"; // ₹1 Cr default
        if (listing.category === "Category III") {
          minInvestment = "10000000"; // ₹1 Cr for Cat III
        } else if (listing.category === "Category II") {
          minInvestment = "10000000"; // ₹1 Cr for Cat II
        } else {
          minInvestment = "10000000"; // ₹1 Cr for Cat I
        }
        
        const [newAif] = await db
          .insert(aifMaster)
          .values({
            name: listing.name,
            registrationNo: listing.registrationNo,
            category: listing.category,
            subcategory: listing.subcategory,
            fundHouseName: listing.fundHouseName,
            sponsor: listing.sponsor,
            inceptionDate: listing.inceptionDate,
            minInvestment,
            fundStatus: "active",
            isPublished: false, // Requires admin review
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        
        imported.push(newAif);
        existingRegNoSet.add(normalizedRegNo);
      } catch (itemError: any) {
        console.error(`[SEBI AIF Import] Error importing ${listing.registrationNo}:`, itemError.message);
        errors.push(`${listing.registrationNo}: ${itemError.message}`);
      }
    }
    
    console.log(`[SEBI AIF Import] Completed: ${imported.length} imported, ${skipped.length} skipped, ${errors.length} errors`);
    
    res.json({
      success: true,
      summary: {
        imported: imported.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      imported,
      skipped,
      errors,
    });
  } catch (error: any) {
    console.error("[SEBI AIF Import] Import error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to import SEBI AIFs",
      details: error.message,
    });
  }
});

// ============ AIF COMPREHENSIVE SEEDING ============

// GET /aif/seed/preview - Preview comprehensive AIF seed data
router.get("/aif/seed/preview", requireAdmin, async (req, res) => {
  try {
    console.log("[AIF Seed] Generating comprehensive preview...");
    
    const seedData = generateComprehensiveAifSeedData();
    
    // Get existing AIFs by registration number for duplicate detection
    const existingAifs = await db
      .select({ registrationNo: aifMaster.registrationNo })
      .from(aifMaster)
      .where(isNotNull(aifMaster.registrationNo));
    
    const existingRegNos = new Set(
      existingAifs
        .map(a => a.registrationNo?.trim().toUpperCase())
        .filter(Boolean)
    );
    
    // Mark duplicates
    const listings = seedData.map(listing => ({
      ...listing,
      isDuplicate: existingRegNos.has(listing.registrationNo.trim().toUpperCase()),
    }));
    
    const newCount = listings.filter(l => !l.isDuplicate).length;
    const duplicateCount = listings.filter(l => l.isDuplicate).length;
    
    // Group by category for summary
    const byCategory = {
      "Category I": listings.filter(l => l.category === "Category I").length,
      "Category II": listings.filter(l => l.category === "Category II").length,
      "Category III": listings.filter(l => l.category === "Category III").length,
    };
    
    console.log(`[AIF Seed] Preview: ${listings.length} total, ${newCount} new, ${duplicateCount} duplicates`);
    
    res.json({
      success: true,
      listings,
      summary: {
        total: listings.length,
        new: newCount,
        duplicates: duplicateCount,
        byCategory,
      },
    });
  } catch (error: any) {
    console.error("[AIF Seed] Preview error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to preview AIF seed data",
      details: error.message,
    });
  }
});

// POST /aif/seed/import - Import comprehensive AIF seed data
router.post("/aif/seed/import", requireAdmin, async (req, res) => {
  try {
    const { listings, skipDuplicates = true } = req.body as { 
      listings?: AifSeedData[];
      skipDuplicates?: boolean;
    };
    
    // Use provided listings or generate new ones
    const seedData = listings || generateComprehensiveAifSeedData();
    
    if (seedData.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No AIF seed data available",
      });
    }
    
    console.log(`[AIF Seed] Starting import of ${seedData.length} AIFs...`);
    
    // Get existing registration numbers
    const existingAifs = await db
      .select({ registrationNo: aifMaster.registrationNo })
      .from(aifMaster)
      .where(isNotNull(aifMaster.registrationNo));
    
    const existingRegNoSet = new Set(
      existingAifs
        .map(a => a.registrationNo?.trim().toUpperCase())
        .filter(Boolean)
    );
    
    const imported: any[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];
    
    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < seedData.length; i += batchSize) {
      const batch = seedData.slice(i, i + batchSize);
      const toInsert: any[] = [];
      
      for (const listing of batch) {
        const normalizedRegNo = listing.registrationNo.trim().toUpperCase();
        
        if (skipDuplicates && existingRegNoSet.has(normalizedRegNo)) {
          skipped.push(listing.registrationNo);
          continue;
        }
        
        toInsert.push({
          name: listing.name,
          registrationNo: listing.registrationNo,
          category: listing.category,
          subcategory: listing.subcategory,
          fundHouseName: listing.fundHouseName,
          sponsor: listing.sponsor,
          inceptionDate: listing.inceptionDate,
          minInvestment: listing.minInvestment,
          lockIn: listing.lockIn,
          benchmark: listing.benchmark,
          style: listing.style,
          fundStatus: listing.fundStatus,
          aum: listing.aum,
          latestNav: listing.latestNav,
          return1M: listing.return1M,
          return3M: listing.return3M,
          return6M: listing.return6M,
          return1Y: listing.return1Y,
          return3Y: listing.return3Y,
          return5Y: listing.return5Y,
          returnSinceInception: listing.returnSinceInception,
          riskScore: listing.riskScore,
          volatility: listing.volatility,
          maxDrawdown: listing.maxDrawdown,
          sharpeRatio: listing.sharpeRatio,
          liquidityFrequency: listing.liquidityFrequency,
          navFrequency: listing.navFrequency,
          description: listing.description,
          investmentObjective: listing.investmentObjective,
          isPublished: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        existingRegNoSet.add(normalizedRegNo);
      }
      
      if (toInsert.length > 0) {
        try {
          const insertedBatch = await db
            .insert(aifMaster)
            .values(toInsert)
            .returning();
          imported.push(...insertedBatch);
        } catch (batchError: any) {
          console.error(`[AIF Seed] Batch insert error:`, batchError.message);
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${batchError.message}`);
        }
      }
    }
    
    console.log(`[AIF Seed] Completed: ${imported.length} imported, ${skipped.length} skipped, ${errors.length} errors`);
    
    res.json({
      success: true,
      summary: {
        imported: imported.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      imported: imported.slice(0, 10), // Return first 10 for preview
      skipped: skipped.slice(0, 10),
      errors,
    });
  } catch (error: any) {
    console.error("[AIF Seed] Import error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to import AIF seed data",
      details: error.message,
    });
  }
});

// POST /aif/seed/all - One-click seed all AIFs with comprehensive data
router.post("/aif/seed/all", requireAdmin, async (req, res) => {
  try {
    console.log("[AIF Seed All] Starting comprehensive seeding...");
    
    const seedData = generateComprehensiveAifSeedData();
    
    // Get existing registration numbers
    const existingAifs = await db
      .select({ registrationNo: aifMaster.registrationNo })
      .from(aifMaster)
      .where(isNotNull(aifMaster.registrationNo));
    
    const existingRegNoSet = new Set(
      existingAifs
        .map(a => a.registrationNo?.trim().toUpperCase())
        .filter(Boolean)
    );
    
    // Filter out duplicates
    const newAifs = seedData.filter(
      listing => !existingRegNoSet.has(listing.registrationNo.trim().toUpperCase())
    );
    
    if (newAifs.length === 0) {
      return res.json({
        success: true,
        message: "All AIFs already exist in database",
        summary: {
          imported: 0,
          skipped: seedData.length,
          total: seedData.length,
        },
      });
    }
    
    // Batch insert all new AIFs
    const batchSize = 50;
    const imported: any[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < newAifs.length; i += batchSize) {
      const batch = newAifs.slice(i, i + batchSize);
      
      const toInsert = batch.map(listing => ({
        name: listing.name,
        registrationNo: listing.registrationNo,
        category: listing.category,
        subcategory: listing.subcategory,
        fundHouseName: listing.fundHouseName,
        sponsor: listing.sponsor,
        inceptionDate: listing.inceptionDate,
        minInvestment: listing.minInvestment,
        lockIn: listing.lockIn,
        benchmark: listing.benchmark,
        style: listing.style,
        fundStatus: listing.fundStatus,
        aum: listing.aum,
        latestNav: listing.latestNav,
        return1M: listing.return1M,
        return3M: listing.return3M,
        return6M: listing.return6M,
        return1Y: listing.return1Y,
        return3Y: listing.return3Y,
        return5Y: listing.return5Y,
        returnSinceInception: listing.returnSinceInception,
        riskScore: listing.riskScore,
        volatility: listing.volatility,
        maxDrawdown: listing.maxDrawdown,
        sharpeRatio: listing.sharpeRatio,
        liquidityFrequency: listing.liquidityFrequency,
        navFrequency: listing.navFrequency,
        description: listing.description,
        investmentObjective: listing.investmentObjective,
        isPublished: true, // Auto-publish for seed all
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      
      try {
        const insertedBatch = await db
          .insert(aifMaster)
          .values(toInsert)
          .returning();
        imported.push(...insertedBatch);
      } catch (batchError: any) {
        console.error(`[AIF Seed All] Batch error:`, batchError.message);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${batchError.message}`);
      }
    }
    
    // Group by category for summary
    const byCategory = {
      "Category I": imported.filter((a: any) => a.category === "Category I").length,
      "Category II": imported.filter((a: any) => a.category === "Category II").length,
      "Category III": imported.filter((a: any) => a.category === "Category III").length,
    };
    
    console.log(`[AIF Seed All] Completed: ${imported.length} AIFs seeded and published`);
    
    res.json({
      success: true,
      message: `Successfully seeded ${imported.length} AIFs`,
      summary: {
        imported: imported.length,
        skipped: seedData.length - newAifs.length,
        total: seedData.length,
        byCategory,
        errors: errors.length,
      },
    });
  } catch (error: any) {
    console.error("[AIF Seed All] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to seed AIFs",
      details: error.message,
    });
  }
});

// ============ PMS COMPREHENSIVE SEEDING ============

// GET /pms/seed/preview - Preview comprehensive PMS seed data
router.get("/pms/seed/preview", requireAdmin, async (req, res) => {
  try {
    console.log("[PMS Seed] Generating comprehensive preview...");
    
    const seedData = generateComprehensivePmsSeedData();
    
    // Get existing PMS by registration number for duplicate detection
    const existingPms = await db
      .select({ registrationNo: pmsMaster.registrationNo })
      .from(pmsMaster)
      .where(isNotNull(pmsMaster.registrationNo));
    
    const existingRegNos = new Set(
      existingPms
        .map(p => p.registrationNo?.trim().toUpperCase())
        .filter(Boolean)
    );
    
    // Mark duplicates
    const listings = seedData.map(listing => ({
      ...listing,
      isDuplicate: existingRegNos.has(listing.registrationNo.trim().toUpperCase()),
    }));
    
    const newCount = listings.filter(l => !l.isDuplicate).length;
    const duplicateCount = listings.filter(l => l.isDuplicate).length;
    
    // Group by strategy for summary
    const strategies = ["Large-cap", "Multi-cap", "Mid-cap", "Small-cap", "Flexi-cap", "Focused", "Value", "Thematic"];
    const byStrategy: Record<string, number> = {};
    for (const strat of strategies) {
      byStrategy[strat] = listings.filter(l => l.strategy === strat).length;
    }
    
    console.log(`[PMS Seed] Preview: ${listings.length} total, ${newCount} new, ${duplicateCount} duplicates`);
    
    res.json({
      success: true,
      listings,
      summary: {
        total: listings.length,
        new: newCount,
        duplicates: duplicateCount,
        byStrategy,
      },
    });
  } catch (error: any) {
    console.error("[PMS Seed] Preview error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to preview PMS seed data",
      details: error.message,
    });
  }
});

// POST /pms/seed/import - Import comprehensive PMS seed data
router.post("/pms/seed/import", requireAdmin, async (req, res) => {
  try {
    const { listings, skipDuplicates = true } = req.body as { 
      listings?: PmsSeedData[];
      skipDuplicates?: boolean;
    };
    
    // Use provided listings or generate new ones
    const seedData = listings || generateComprehensivePmsSeedData();
    
    if (seedData.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No PMS seed data available",
      });
    }
    
    console.log(`[PMS Seed] Starting import of ${seedData.length} PMS...`);
    
    // Get existing registration numbers
    const existingPms = await db
      .select({ registrationNo: pmsMaster.registrationNo })
      .from(pmsMaster)
      .where(isNotNull(pmsMaster.registrationNo));
    
    const existingRegNoSet = new Set(
      existingPms
        .map(p => p.registrationNo?.trim().toUpperCase())
        .filter(Boolean)
    );
    
    const imported: any[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];
    
    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < seedData.length; i += batchSize) {
      const batch = seedData.slice(i, i + batchSize);
      const toInsert: any[] = [];
      
      for (const listing of batch) {
        const normalizedRegNo = listing.registrationNo.trim().toUpperCase();
        
        if (skipDuplicates && existingRegNoSet.has(normalizedRegNo)) {
          skipped.push(listing.registrationNo);
          continue;
        }
        
        toInsert.push({
          name: listing.name,
          registrationNo: listing.registrationNo,
          strategy: listing.strategy,
          style: listing.style,
          fundHouseName: listing.fundHouseName,
          sponsor: listing.sponsor,
          inceptionDate: listing.inceptionDate,
          minInvestment: listing.minInvestment,
          lockIn: listing.lockIn,
          benchmark: listing.benchmark,
          feeStructure: listing.feeStructure,
          managementFee: listing.managementFee,
          performanceFee: listing.performanceFee,
          fundStatus: listing.fundStatus,
          aum: listing.aum,
          latestNav: listing.latestNav,
          lastNavDate: listing.lastNavDate,
          return1Y: listing.return1Y,
          return3Y: listing.return3Y,
          returnSinceInception: listing.returnSinceInception,
          riskScore: listing.riskScore,
          description: listing.description,
          isPublished: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        existingRegNoSet.add(normalizedRegNo);
      }
      
      if (toInsert.length > 0) {
        try {
          const insertedBatch = await db
            .insert(pmsMaster)
            .values(toInsert)
            .returning();
          imported.push(...insertedBatch);
        } catch (batchError: any) {
          console.error(`[PMS Seed] Batch insert error:`, batchError.message);
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${batchError.message}`);
        }
      }
    }
    
    console.log(`[PMS Seed] Completed: ${imported.length} imported, ${skipped.length} skipped, ${errors.length} errors`);
    
    res.json({
      success: true,
      summary: {
        imported: imported.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      imported: imported.slice(0, 10),
      skipped: skipped.slice(0, 10),
      errors,
    });
  } catch (error: any) {
    console.error("[PMS Seed] Import error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to import PMS seed data",
      details: error.message,
    });
  }
});

// POST /pms/seed/all - One-click seed all PMS with comprehensive data
router.post("/pms/seed/all", requireAdmin, async (req, res) => {
  try {
    console.log("[PMS Seed All] Starting comprehensive seeding...");
    
    const seedData = generateComprehensivePmsSeedData();
    
    // Get existing registration numbers
    const existingPms = await db
      .select({ registrationNo: pmsMaster.registrationNo })
      .from(pmsMaster)
      .where(isNotNull(pmsMaster.registrationNo));
    
    const existingRegNoSet = new Set(
      existingPms
        .map(p => p.registrationNo?.trim().toUpperCase())
        .filter(Boolean)
    );
    
    // Filter out duplicates
    const newPms = seedData.filter(
      listing => !existingRegNoSet.has(listing.registrationNo.trim().toUpperCase())
    );
    
    if (newPms.length === 0) {
      return res.json({
        success: true,
        message: "All PMS already exist in database",
        summary: {
          imported: 0,
          skipped: seedData.length,
          total: seedData.length,
        },
      });
    }
    
    // Batch insert all new PMS
    const batchSize = 50;
    const imported: any[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < newPms.length; i += batchSize) {
      const batch = newPms.slice(i, i + batchSize);
      
      const toInsert = batch.map(listing => ({
        name: listing.name,
        registrationNo: listing.registrationNo,
        strategy: listing.strategy,
        style: listing.style,
        fundHouseName: listing.fundHouseName,
        sponsor: listing.sponsor,
        inceptionDate: listing.inceptionDate,
        minInvestment: listing.minInvestment,
        lockIn: listing.lockIn,
        benchmark: listing.benchmark,
        feeStructure: listing.feeStructure,
        managementFee: listing.managementFee,
        performanceFee: listing.performanceFee,
        fundStatus: listing.fundStatus,
        aum: listing.aum,
        latestNav: listing.latestNav,
        lastNavDate: listing.lastNavDate,
        return1Y: listing.return1Y,
        return3Y: listing.return3Y,
        returnSinceInception: listing.returnSinceInception,
        riskScore: listing.riskScore,
        description: listing.description,
        isPublished: true, // Auto-publish for seed all
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      
      try {
        const insertedBatch = await db
          .insert(pmsMaster)
          .values(toInsert)
          .returning();
        imported.push(...insertedBatch);
      } catch (batchError: any) {
        console.error(`[PMS Seed All] Batch error:`, batchError.message);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${batchError.message}`);
      }
    }
    
    // Group by strategy for summary
    const strategies = ["Large-cap", "Multi-cap", "Mid-cap", "Small-cap", "Flexi-cap", "Focused", "Value", "Thematic"];
    const byStrategy: Record<string, number> = {};
    for (const strat of strategies) {
      byStrategy[strat] = imported.filter((p: any) => p.strategy === strat).length;
    }
    
    console.log(`[PMS Seed All] Completed: ${imported.length} PMS seeded and published`);
    
    res.json({
      success: true,
      message: `Successfully seeded ${imported.length} PMS`,
      summary: {
        imported: imported.length,
        skipped: seedData.length - newPms.length,
        total: seedData.length,
        byStrategy,
        errors: errors.length,
      },
    });
  } catch (error: any) {
    console.error("[PMS Seed All] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to seed PMS",
      details: error.message,
    });
  }
});

// ============ PMS SEEDING (IMPORT FROM SEBI) ============

// GET /pms/sebi/preview - Preview SEBI PMS with duplicate detection
router.get("/pms/sebi/preview", requireAdmin, async (req, res) => {
  try {
    console.log("[SEBI PMS Import] Fetching preview...");
    
    const result = await fetchSebiPmsListings();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: "Failed to fetch SEBI PMS listings",
        details: result.errors,
      });
    }
    
    // Get existing PMS by registration number for duplicate detection
    const existingPms = await db
      .select({ registrationNo: pmsMaster.registrationNo })
      .from(pmsMaster)
      .where(isNotNull(pmsMaster.registrationNo));
    
    const existingRegNos = new Set(
      existingPms
        .map(p => p.registrationNo?.trim().toUpperCase())
        .filter(Boolean)
    );
    
    // Mark duplicates
    const listings = result.listings.map(listing => ({
      ...listing,
      isDuplicate: existingRegNos.has(listing.registrationNo.trim().toUpperCase()),
    }));
    
    const newCount = listings.filter(l => !l.isDuplicate).length;
    const duplicateCount = listings.filter(l => l.isDuplicate).length;
    
    console.log(`[SEBI PMS Import] Preview: ${listings.length} total, ${newCount} new, ${duplicateCount} duplicates`);
    
    res.json({
      success: true,
      listings,
      summary: {
        total: listings.length,
        new: newCount,
        duplicates: duplicateCount,
      },
    });
  } catch (error: any) {
    console.error("[SEBI PMS Import] Preview error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to preview SEBI PMS",
      details: error.message,
    });
  }
});

// POST /pms/sebi/import - Import selected PMS from SEBI
router.post("/pms/sebi/import", requireAdmin, async (req, res) => {
  try {
    const { listings } = req.body as { listings: SebiPmsListing[] };
    
    if (!listings || !Array.isArray(listings) || listings.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No listings provided for import",
      });
    }
    
    console.log(`[SEBI PMS Import] Starting import of ${listings.length} PMS...`);
    
    // Get existing registration numbers
    const existingPms = await db
      .select({ registrationNo: pmsMaster.registrationNo })
      .from(pmsMaster)
      .where(isNotNull(pmsMaster.registrationNo));
    
    const existingRegNoSet = new Set(
      existingPms
        .map(p => p.registrationNo?.trim().toUpperCase())
        .filter(Boolean)
    );
    
    const imported: any[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];
    
    for (const listing of listings) {
      const normalizedRegNo = listing.registrationNo.trim().toUpperCase();
      
      // Skip if already exists
      if (existingRegNoSet.has(normalizedRegNo)) {
        skipped.push(listing.registrationNo);
        continue;
      }
      
      try {
        const [newPms] = await db
          .insert(pmsMaster)
          .values({
            name: listing.name,
            registrationNo: listing.registrationNo,
            strategy: listing.strategy,
            style: listing.style,
            fundHouseName: listing.fundHouseName,
            sponsor: listing.sponsor,
            inceptionDate: listing.inceptionDate,
            minInvestment: "5000000", // ₹50L default for PMS
            fundStatus: "active",
            isPublished: false, // Requires admin review
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        
        imported.push(newPms);
        existingRegNoSet.add(normalizedRegNo);
      } catch (itemError: any) {
        console.error(`[SEBI PMS Import] Error importing ${listing.registrationNo}:`, itemError.message);
        errors.push(`${listing.registrationNo}: ${itemError.message}`);
      }
    }
    
    console.log(`[SEBI PMS Import] Completed: ${imported.length} imported, ${skipped.length} skipped, ${errors.length} errors`);
    
    res.json({
      success: true,
      summary: {
        imported: imported.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      imported,
      skipped,
      errors,
    });
  } catch (error: any) {
    console.error("[SEBI PMS Import] Import error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to import SEBI PMS",
      details: error.message,
    });
  }
});

// ============ INVESTMENT INQUIRIES ============

const expressInterestSchema = z.object({
  productType: z.enum(["aif", "pms"]),
  productId: z.string().min(1),
  productName: z.string().min(1),
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  panNumber: z.string().optional(),
  investmentAmount: z.string().optional(),
  investmentTimeline: z.enum(["immediate", "within_1_month", "within_3_months", "exploring"]).optional(),
  message: z.string().optional(),
});

// POST /aif/:id/express-interest - Express interest in an AIF
router.post("/aif/:id/express-interest", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the AIF details
    const [aif] = await db.select().from(aifMaster).where(eq(aifMaster.id, id));
    if (!aif) {
      return res.status(404).json({ error: "AIF not found" });
    }
    
    const data = expressInterestSchema.parse({
      ...req.body,
      productType: "aif",
      productId: id,
      productName: aif.name,
    });
    
    // Get user info if authenticated
    const userId = (req as any).user?.id || null;
    const kycStatus = (req as any).user?.kycStatus || null;
    
    const [inquiry] = await db
      .insert(investmentInquiries)
      .values({
        productType: data.productType,
        productId: data.productId,
        productName: data.productName,
        userId,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        panNumber: data.panNumber || null,
        investmentAmount: data.investmentAmount || null,
        investmentTimeline: data.investmentTimeline || null,
        message: data.message || null,
        kycStatus,
        source: "marketplace",
        status: "new",
        priority: data.investmentTimeline === "immediate" ? "high" : "medium",
      })
      .returning();
    
    res.json({
      success: true,
      message: "Thank you for your interest. Our team will contact you soon.",
      inquiryId: inquiry.id,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Error creating AIF inquiry:", error);
    res.status(500).json({ error: "Failed to submit inquiry" });
  }
});

// POST /pms/:id/express-interest - Express interest in a PMS
router.post("/pms/:id/express-interest", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the PMS details
    const [pms] = await db.select().from(pmsMaster).where(eq(pmsMaster.id, id));
    if (!pms) {
      return res.status(404).json({ error: "PMS not found" });
    }
    
    const data = expressInterestSchema.parse({
      ...req.body,
      productType: "pms",
      productId: id,
      productName: pms.name,
    });
    
    // Get user info if authenticated
    const userId = (req as any).user?.id || null;
    const kycStatus = (req as any).user?.kycStatus || null;
    
    const [inquiry] = await db
      .insert(investmentInquiries)
      .values({
        productType: data.productType,
        productId: data.productId,
        productName: data.productName,
        userId,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        panNumber: data.panNumber || null,
        investmentAmount: data.investmentAmount || null,
        investmentTimeline: data.investmentTimeline || null,
        message: data.message || null,
        kycStatus,
        source: "marketplace",
        status: "new",
        priority: data.investmentTimeline === "immediate" ? "high" : "medium",
      })
      .returning();
    
    res.json({
      success: true,
      message: "Thank you for your interest. Our team will contact you soon.",
      inquiryId: inquiry.id,
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }
    console.error("Error creating PMS inquiry:", error);
    res.status(500).json({ error: "Failed to submit inquiry" });
  }
});

// GET /inquiries - Admin list all investment inquiries
router.get("/inquiries", requireAdmin, async (req, res) => {
  try {
    const { productType, status, page = "1", limit = "20" } = req.query;
    
    const conditions: any[] = [];
    if (productType && productType !== "all") {
      conditions.push(eq(investmentInquiries.productType, productType as string));
    }
    if (status && status !== "all") {
      conditions.push(eq(investmentInquiries.status, status as string));
    }
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const inquiries = await db
      .select()
      .from(investmentInquiries)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(investmentInquiries.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);
    
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(investmentInquiries)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    res.json({
      inquiries,
      total: countResult?.count || 0,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (error: any) {
    console.error("Error fetching inquiries:", error);
    res.status(500).json({ error: "Failed to fetch inquiries" });
  }
});

// PATCH /inquiries/:id - Update inquiry status
router.patch("/inquiries/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, assignedTo, nextFollowUpAt } = req.body;
    
    const updates: any = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (nextFollowUpAt) updates.nextFollowUpAt = new Date(nextFollowUpAt);
    if (status === "contacted") updates.lastContactedAt = new Date();
    
    const [updated] = await db
      .update(investmentInquiries)
      .set(updates)
      .where(eq(investmentInquiries.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "Inquiry not found" });
    }
    
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating inquiry:", error);
    res.status(500).json({ error: "Failed to update inquiry" });
  }
});

// ============ AIF ORDERS ============

// GET /store/aif/orders - Get user's AIF orders
router.get("/aif/orders", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const orders = await db
      .select()
      .from(clientPortfolioAif)
      .where(eq(clientPortfolioAif.userId, userId))
      .orderBy(desc(clientPortfolioAif.createdAt));

    res.json(orders);
  } catch (error: any) {
    console.error("Error fetching AIF orders:", error);
    res.status(500).json({ error: "Failed to fetch AIF orders" });
  }
});

// POST /store/aif/orders - Create AIF order with audit logging
router.post("/aif/orders", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { schemeId, amount, orderType = "LUMPSUM", auditLog } = req.body;
    
    const [order] = await db
      .insert(clientPortfolioAif)
      .values({
        userId,
        schemeId,
        investedAmount: amount?.toString(),
        status: "pending",
        orderType,
        auditLog: JSON.stringify({
          action: "order_placed",
          timestamp: new Date().toISOString(),
          amount,
          source: auditLog?.source || "aif_page",
          ...auditLog
        }),
      })
      .returning();

    res.json({ success: true, order });
  } catch (error: any) {
    console.error("Error creating AIF order:", error);
    res.status(500).json({ error: "Failed to create AIF order" });
  }
});

// ============ PMS ORDERS ============

// GET /store/pms/orders - Get user's PMS orders
router.get("/pms/orders", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const orders = await db
      .select()
      .from(clientPortfolioPms)
      .where(eq(clientPortfolioPms.userId, userId))
      .orderBy(desc(clientPortfolioPms.createdAt));

    res.json(orders);
  } catch (error: any) {
    console.error("Error fetching PMS orders:", error);
    res.status(500).json({ error: "Failed to fetch PMS orders" });
  }
});

// POST /store/pms/orders - Create PMS order with audit logging
router.post("/pms/orders", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { schemeId, amount, orderType = "LUMPSUM", auditLog } = req.body;
    
    const [order] = await db
      .insert(clientPortfolioPms)
      .values({
        userId,
        schemeId,
        investedAmount: amount?.toString(),
        status: "pending",
        orderType,
        auditLog: JSON.stringify({
          action: "order_placed",
          timestamp: new Date().toISOString(),
          amount,
          source: auditLog?.source || "pms_page",
          ...auditLog
        }),
      })
      .returning();

    res.json({ success: true, order });
  } catch (error: any) {
    console.error("Error creating PMS order:", error);
    res.status(500).json({ error: "Failed to create PMS order" });
  }
});

// ============ MLD ORDERS ============

// GET /store/mld/orders - Get user's MLD orders
router.get("/mld/orders", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const orders = await db
      .select()
      .from(clientPortfolioMld)
      .where(eq(clientPortfolioMld.userId, userId))
      .orderBy(desc(clientPortfolioMld.createdAt));

    res.json(orders);
  } catch (error: any) {
    console.error("Error fetching MLD orders:", error);
    res.status(500).json({ error: "Failed to fetch MLD orders" });
  }
});

// POST /store/mld/orders - Create MLD order with audit logging
router.post("/mld/orders", requireAuth, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const { productId, amount, tenure, auditLog } = req.body;
    
    const [order] = await db
      .insert(clientPortfolioMld)
      .values({
        userId,
        productId,
        investedAmount: amount?.toString(),
        tenure,
        status: "pending",
        auditLog: JSON.stringify({
          action: "order_placed",
          timestamp: new Date().toISOString(),
          amount,
          source: auditLog?.source || "mld_page",
          ...auditLog
        }),
      })
      .returning();

    res.json({ success: true, order });
  } catch (error: any) {
    console.error("Error creating MLD order:", error);
    res.status(500).json({ error: "Failed to create MLD order" });
  }
});

// ============ FUND MANAGER ROUTES ============

// GET /fund-managers - List all fund managers (admin)
router.get("/fund-managers", requireAdmin, async (req, res) => {
  try {
    const { search, sortBy = "name", page = "1", limit = "50" } = req.query;
    
    const conditions: any[] = [];
    if (search) {
      conditions.push(
        or(
          ilike(fundManagers.name, `%${search}%`),
          ilike(fundManagers.designation, `%${search}%`)
        )
      );
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const managers = await db
      .select()
      .from(fundManagers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sortBy === "experience" ? desc(fundManagers.experienceYears) : asc(fundManagers.name))
      .limit(parseInt(limit as string))
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(fundManagers);
    
    res.json({
      managers,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: countResult[0]?.count || 0
      }
    });
  } catch (error: any) {
    console.error("Error fetching fund managers:", error);
    res.status(500).json({ error: "Failed to fetch fund managers" });
  }
});

// GET /fund-managers/:id - Get fund manager details with managed funds
router.get("/fund-managers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const [manager] = await db
      .select()
      .from(fundManagers)
      .where(eq(fundManagers.id, id))
      .limit(1);
    
    if (!manager) {
      return res.status(404).json({ error: "Fund manager not found" });
    }

    // Get PMS funds managed by this manager
    const pmsFunds = await db
      .select({
        id: pmsMaster.id,
        name: pmsMaster.name,
        strategy: pmsMaster.strategy,
        fundHouse: pmsMaster.fundHouseName,
        aum: pmsMaster.aum,
        return1Y: pmsMaster.return1Y,
        return3Y: pmsMaster.return3Y,
        fundType: sql<string>`'pms'`
      })
      .from(pmsMaster)
      .where(and(
        eq(pmsMaster.managerId, id),
        eq(pmsMaster.isPublished, true)
      ));

    // Get AIF funds managed by this manager
    const aifFunds = await db
      .select({
        id: aifMaster.id,
        name: aifMaster.name,
        category: aifMaster.category,
        fundHouse: aifMaster.fundHouseName,
        aum: aifMaster.aum,
        return1Y: aifMaster.return1Y,
        return3Y: aifMaster.return3Y,
        fundType: sql<string>`'aif'`
      })
      .from(aifMaster)
      .where(and(
        eq(aifMaster.managerId, id),
        eq(aifMaster.isPublished, true)
      ));

    res.json({
      manager,
      managedFunds: {
        pms: pmsFunds,
        aif: aifFunds,
        total: pmsFunds.length + aifFunds.length
      }
    });
  } catch (error: any) {
    console.error("Error fetching fund manager:", error);
    res.status(500).json({ error: "Failed to fetch fund manager details" });
  }
});

// GET /fund-managers/:id/other-funds - Get other funds by the same manager (excludes current fund)
router.get("/fund-managers/:id/other-funds", async (req, res) => {
  try {
    const { id } = req.params;
    const { excludeFundId, fundType } = req.query;
    
    const otherFunds: any[] = [];

    // Get PMS funds
    const pmsFunds = await db
      .select({
        id: pmsMaster.id,
        name: pmsMaster.name,
        strategy: pmsMaster.strategy,
        fundHouse: pmsMaster.fundHouseName,
        aum: pmsMaster.aum,
        return1Y: pmsMaster.return1Y,
        return3Y: pmsMaster.return3Y,
        riskScore: pmsMaster.riskScore
      })
      .from(pmsMaster)
      .where(and(
        eq(pmsMaster.managerId, id),
        eq(pmsMaster.isPublished, true)
      ));

    pmsFunds.forEach(fund => {
      if (excludeFundId && fundType === 'pms' && fund.id === excludeFundId) return;
      otherFunds.push({ ...fund, fundType: 'pms' });
    });

    // Get AIF funds
    const aifFunds = await db
      .select({
        id: aifMaster.id,
        name: aifMaster.name,
        category: aifMaster.category,
        fundHouse: aifMaster.fundHouseName,
        aum: aifMaster.aum,
        return1Y: aifMaster.return1Y,
        return3Y: aifMaster.return3Y,
        riskScore: aifMaster.riskScore
      })
      .from(aifMaster)
      .where(and(
        eq(aifMaster.managerId, id),
        eq(aifMaster.isPublished, true)
      ));

    aifFunds.forEach(fund => {
      if (excludeFundId && fundType === 'aif' && fund.id === excludeFundId) return;
      otherFunds.push({ ...fund, fundType: 'aif' });
    });

    res.json({ otherFunds });
  } catch (error: any) {
    console.error("Error fetching other funds:", error);
    res.status(500).json({ error: "Failed to fetch other funds" });
  }
});

// POST /fund-managers - Create a new fund manager (admin)
router.post("/fund-managers", requireAdmin, async (req, res) => {
  try {
    const { 
      name, designation, bio, experienceYears, qualifications, 
      photoUrl, linkedinUrl, totalAumManaged, fundsManaged, avgAlpha, consistencyScore 
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: "Fund manager name is required" });
    }

    const [manager] = await db
      .insert(fundManagers)
      .values({
        name,
        designation,
        bio,
        experienceYears: experienceYears ? parseInt(experienceYears) : null,
        qualifications,
        photoUrl,
        linkedinUrl,
        totalAumManaged: totalAumManaged?.toString(),
        fundsManaged: fundsManaged ? parseInt(fundsManaged) : null,
        avgAlpha: avgAlpha?.toString(),
        consistencyScore: consistencyScore?.toString()
      })
      .returning();

    res.json({ success: true, manager });
  } catch (error: any) {
    console.error("Error creating fund manager:", error);
    res.status(500).json({ error: "Failed to create fund manager" });
  }
});

// PATCH /fund-managers/:id - Update fund manager (admin)
router.patch("/fund-managers/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Convert numeric fields
    if (updates.experienceYears) {
      updates.experienceYears = parseInt(updates.experienceYears);
    }
    if (updates.fundsManaged) {
      updates.fundsManaged = parseInt(updates.fundsManaged);
    }
    if (updates.totalAumManaged) {
      updates.totalAumManaged = updates.totalAumManaged.toString();
    }
    if (updates.avgAlpha) {
      updates.avgAlpha = updates.avgAlpha.toString();
    }
    if (updates.consistencyScore) {
      updates.consistencyScore = updates.consistencyScore.toString();
    }

    const [manager] = await db
      .update(fundManagers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(fundManagers.id, id))
      .returning();

    if (!manager) {
      return res.status(404).json({ error: "Fund manager not found" });
    }

    res.json({ success: true, manager });
  } catch (error: any) {
    console.error("Error updating fund manager:", error);
    res.status(500).json({ error: "Failed to update fund manager" });
  }
});

// DELETE /fund-managers/:id - Delete fund manager (admin)
router.delete("/fund-managers/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if manager has associated funds
    const pmsCount = await db.select({ count: sql<number>`count(*)` }).from(pmsMaster).where(eq(pmsMaster.managerId, id));
    const aifCount = await db.select({ count: sql<number>`count(*)` }).from(aifMaster).where(eq(aifMaster.managerId, id));
    
    if ((pmsCount[0]?.count || 0) > 0 || (aifCount[0]?.count || 0) > 0) {
      return res.status(400).json({ 
        error: "Cannot delete fund manager with associated funds. Please reassign or remove funds first." 
      });
    }

    await db.delete(fundManagers).where(eq(fundManagers.id, id));
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting fund manager:", error);
    res.status(500).json({ error: "Failed to delete fund manager" });
  }
});

// ============ EXTERNAL REMITTANCE TRACKING (AIF/PMS) ============
// SEBI Compliance: AIF/PMS payments are made directly by investor to fund/portfolio manager.
// These routes track proof-of-payment documentation for regulatory compliance.

const remittanceRequestSchema = z.object({
  orderId: z.string(),
  productType: z.enum(['aif', 'pms']),
  productId: z.string(),
  productName: z.string(),
  remittanceType: z.enum(['aif_subscription', 'pms_subscription', 'capital_call', 'top_up']),
  expectedAmount: z.number().positive(),
  currency: z.string().default('INR'),
  capitalCallReference: z.string().optional(),
  subscriptionAgreementId: z.string().optional(),
  bankDetails: z.object({
    beneficiaryName: z.string().optional(),
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    ifscCode: z.string().optional()
  }).optional()
});

const remittanceUploadSchema = z.object({
  filePath: z.string(),
  fileName: z.string(),
  fileSize: z.number().positive(),
  mimeType: z.string(),
  bankDetails: z.object({
    utrNumber: z.string().min(1, "UTR number is required"),
    transactionDate: z.string(),
    beneficiaryName: z.string().optional(),
    bankName: z.string().optional()
  })
});

const remittanceVerifySchema = z.object({
  action: z.enum(['verify', 'reject']),
  notes: z.string().optional(),
  rejectionReason: z.string().optional()
});

// POST /remittance/request - Create a remittance request for an AIF/PMS order
router.post("/remittance/request", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const data = remittanceRequestSchema.parse(req.body);
    
    const remittance = await externalRemittanceService.createRemittanceRequest({
      ...data,
      userId: user.id
    });
    
    res.json({ 
      success: true, 
      remittance,
      message: "Remittance request created. Please upload proof of payment."
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error creating remittance request:", error);
    res.status(500).json({ error: "Failed to create remittance request" });
  }
});

// POST /remittance/:id/upload - Upload proof of payment
router.post("/remittance/:id/upload", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as any;
    const data = remittanceUploadSchema.parse(req.body);
    
    const result = await externalRemittanceService.uploadRemittanceProof({
      remittanceId: id,
      userId: user.id,
      filePath: data.filePath,
      fileName: data.fileName,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      bankDetails: data.bankDetails
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    res.json({ success: true, message: result.message });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid upload data", details: error.errors });
    }
    console.error("Error uploading remittance proof:", error);
    res.status(500).json({ error: "Failed to upload remittance proof" });
  }
});

// GET /remittance/my - Get user's remittance requests
router.get("/remittance/my", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const remittances = await externalRemittanceService.getRemittancesByUser(user.id);
    
    res.json({ remittances });
  } catch (error: any) {
    console.error("Error fetching remittances:", error);
    res.status(500).json({ error: "Failed to fetch remittances" });
  }
});

// GET /remittance/order/:orderId - Get remittances for a specific order
router.get("/remittance/order/:orderId", requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const remittances = await externalRemittanceService.getRemittancesByOrder(orderId);
    
    res.json({ remittances });
  } catch (error: any) {
    console.error("Error fetching order remittances:", error);
    res.status(500).json({ error: "Failed to fetch order remittances" });
  }
});

// GET /remittance/:id - Get specific remittance details
router.get("/remittance/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const remittance = await externalRemittanceService.getRemittance(id);
    
    if (!remittance) {
      return res.status(404).json({ error: "Remittance not found" });
    }
    
    res.json({ remittance });
  } catch (error: any) {
    console.error("Error fetching remittance:", error);
    res.status(500).json({ error: "Failed to fetch remittance" });
  }
});

// GET /remittance/check/:productType/:orderId - Check if remittance proof is required/uploaded
router.get("/remittance/check/:productType/:orderId", requireAuth, async (req, res) => {
  try {
    const { productType, orderId } = req.params;
    
    if (productType !== 'aif' && productType !== 'pms') {
      return res.status(400).json({ error: "Invalid product type. Must be 'aif' or 'pms'" });
    }
    
    const status = await externalRemittanceService.checkRemittanceProofRequired(
      productType as 'aif' | 'pms',
      orderId
    );
    
    res.json(status);
  } catch (error: any) {
    console.error("Error checking remittance status:", error);
    res.status(500).json({ error: "Failed to check remittance status" });
  }
});

// ============ ADMIN REMITTANCE ROUTES ============

// GET /admin/remittance/pending - Get all pending verification remittances
router.get("/admin/remittance/pending", requireAdmin, async (req, res) => {
  try {
    const pendingRemittances = await externalRemittanceService.getPendingVerifications();
    
    res.json({ remittances: pendingRemittances, count: pendingRemittances.length });
  } catch (error: any) {
    console.error("Error fetching pending remittances:", error);
    res.status(500).json({ error: "Failed to fetch pending remittances" });
  }
});

// POST /admin/remittance/:id/verify - Verify or reject a remittance
router.post("/admin/remittance/:id/verify", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user as any;
    const data = remittanceVerifySchema.parse(req.body);
    
    const result = await externalRemittanceService.verifyRemittance({
      remittanceId: id,
      verifierId: user.id,
      action: data.action,
      notes: data.notes,
      rejectionReason: data.rejectionReason
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    res.json({ success: true, message: result.message });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: "Invalid verification data", details: error.errors });
    }
    console.error("Error verifying remittance:", error);
    res.status(500).json({ error: "Failed to verify remittance" });
  }
});

// GET /admin/remittance/report - Get compliance report
router.get("/admin/remittance/report", requireAdmin, async (req, res) => {
  try {
    const report = await externalRemittanceService.getComplianceReport();
    
    res.json(report);
  } catch (error: any) {
    console.error("Error generating remittance report:", error);
    res.status(500).json({ error: "Failed to generate remittance report" });
  }
});

export default router;
