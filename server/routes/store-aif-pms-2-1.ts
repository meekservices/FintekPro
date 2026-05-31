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

const router = Router();

// ============ AIF ROUTES ============

// GET /store/aif - List published AIF schemes with filters
router.post("/admin/store/aif", requireAdmin, async (req, res) => {
  try {
    const { id, ...rawData } = req.body;
    
    if (id) {
      const updateSchema = insertAifMasterSchema.partial();
      const validation = updateSchema.safeParse(rawData);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error.issues });
      }
      await db
        .update(aifMaster)
        .set({ ...validation.data, updatedAt: new Date() })
        .where(eq(aifMaster.id, id));
      res.json({ success: true, message: "AIF scheme updated" });
    } else {
      const validation = insertAifMasterSchema.safeParse(rawData);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error.issues });
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
        return res.status(400).json({ error: "Invalid data", details: validation.error.issues });
      }
      await db
        .update(pmsMaster)
        .set({ ...validation.data, updatedAt: new Date() })
        .where(eq(pmsMaster.id, id));
      res.json({ success: true, message: "PMS scheme updated" });
    } else {
      const validation = insertPmsMasterSchema.safeParse(rawData);
      if (!validation.success) {
        return res.status(400).json({ error: "Invalid data", details: validation.error.issues });
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

export default router;
