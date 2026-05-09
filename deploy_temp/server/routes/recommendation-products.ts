import { Router } from "express";
import { db } from "../db";
import { recommendationProducts, listedStocks, reits, preIpoCompanies } from "@shared/schema";
import { eq, and, desc, asc, sql, ilike, or } from "drizzle-orm";
import { requireAdmin } from "../middleware/roleMiddleware";
import { generateRecommendationRationale, RecommendationProductData } from "../services/recommendation-products-service";

const router = Router();

// Cache for recommendation products (invalidated on updates)
let recommendationCache: Map<string, any[]> = new Map();
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function invalidateCache() {
  recommendationCache.clear();
  cacheTimestamp = 0;
}

// Get all recommendation products (admin view)
router.get("/", requireAdmin, async (req, res) => {
  try {
    const { productType, riskProfile, isActive, search } = req.query;
    
    let query = db.select().from(recommendationProducts);
    const conditions = [];
    
    if (productType && productType !== "all") {
      conditions.push(eq(recommendationProducts.productType, productType as string));
    }
    if (riskProfile && riskProfile !== "all") {
      conditions.push(eq(recommendationProducts.riskProfile, riskProfile as string));
    }
    if (isActive !== undefined && isActive !== "all") {
      conditions.push(eq(recommendationProducts.isActive, isActive === "true"));
    }
    if (search) {
      conditions.push(
        or(
          ilike(recommendationProducts.name, `%${search}%`),
          ilike(recommendationProducts.symbol, `%${search}%`),
          ilike(recommendationProducts.sector, `%${search}%`)
        )
      );
    }
    
    const products = await db
      .select()
      .from(recommendationProducts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(recommendationProducts.priority), asc(recommendationProducts.name));
    
    res.json(products);
  } catch (error: any) {
    console.error("[RecommendationProducts] Error fetching products:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get recommendations by type and risk profile (for recommendation engine)
router.get("/by-category", async (req, res) => {
  try {
    const { productType, riskProfile } = req.query;
    
    if (!productType || !riskProfile) {
      return res.status(400).json({ error: "productType and riskProfile are required" });
    }
    
    // Check cache
    const cacheKey = `${productType}_${riskProfile}`;
    if (Date.now() - cacheTimestamp < CACHE_TTL && recommendationCache.has(cacheKey)) {
      return res.json(recommendationCache.get(cacheKey));
    }
    
    const products = await db
      .select()
      .from(recommendationProducts)
      .where(
        and(
          eq(recommendationProducts.productType, productType as string),
          eq(recommendationProducts.riskProfile, riskProfile as string),
          eq(recommendationProducts.isActive, true)
        )
      )
      .orderBy(desc(recommendationProducts.priority), asc(recommendationProducts.name));
    
    // Update cache
    recommendationCache.set(cacheKey, products);
    cacheTimestamp = Date.now();
    
    res.json(products);
  } catch (error: any) {
    console.error("[RecommendationProducts] Error fetching by category:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get all active recommendations grouped by type and risk (for recommendation engine bulk fetch)
router.get("/all-active", async (req, res) => {
  try {
    // Check cache
    const cacheKey = "all_active";
    if (Date.now() - cacheTimestamp < CACHE_TTL && recommendationCache.has(cacheKey)) {
      return res.json(recommendationCache.get(cacheKey));
    }
    
    const products = await db
      .select()
      .from(recommendationProducts)
      .where(eq(recommendationProducts.isActive, true))
      .orderBy(desc(recommendationProducts.priority), asc(recommendationProducts.name));
    
    // Group by productType and riskProfile
    const grouped: Record<string, Record<string, any[]>> = {};
    products.forEach(p => {
      if (!grouped[p.productType]) {
        grouped[p.productType] = {};
      }
      if (!grouped[p.productType][p.riskProfile]) {
        grouped[p.productType][p.riskProfile] = [];
      }
      grouped[p.productType][p.riskProfile].push(p);
    });
    
    // Update cache
    recommendationCache.set(cacheKey, grouped as any);
    cacheTimestamp = Date.now();
    
    res.json(grouped);
  } catch (error: any) {
    console.error("[RecommendationProducts] Error fetching all active:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create new recommendation product
router.post("/", requireAdmin, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const data = req.body;
    
    const [product] = await db.insert(recommendationProducts).values({
      ...data,
      addedBy: userId,
      lastUpdatedBy: userId,
    }).returning();
    
    invalidateCache();
    res.status(201).json(product);
  } catch (error: any) {
    console.error("[RecommendationProducts] Error creating product:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update recommendation product
router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const data = req.body;
    
    const [product] = await db
      .update(recommendationProducts)
      .set({
        ...data,
        lastUpdatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(recommendationProducts.id, id))
      .returning();
    
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    invalidateCache();
    res.json(product);
  } catch (error: any) {
    console.error("[RecommendationProducts] Error updating product:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete recommendation product
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [deleted] = await db
      .delete(recommendationProducts)
      .where(eq(recommendationProducts.id, id))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: "Product not found" });
    }
    
    invalidateCache();
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error("[RecommendationProducts] Error deleting product:", error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk update active status
router.post("/bulk-status", requireAdmin, async (req, res) => {
  try {
    const { ids, isActive } = req.body;
    const userId = (req as any).user?.id;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required" });
    }
    
    const updated = await Promise.all(
      ids.map(id =>
        db.update(recommendationProducts)
          .set({ isActive, lastUpdatedBy: userId, updatedAt: new Date() })
          .where(eq(recommendationProducts.id, id))
          .returning()
      )
    );
    
    invalidateCache();
    res.json({ success: true, updated: updated.flat().length });
  } catch (error: any) {
    console.error("[RecommendationProducts] Error bulk updating:", error);
    res.status(500).json({ error: error.message });
  }
});

// Sync from source tables (listed_stocks, reits, pre_ipo_companies)
router.post("/sync/:productType", requireAdmin, async (req, res) => {
  try {
    const { productType } = req.params;
    const { riskProfile } = req.body;
    const userId = (req as any).user?.id;
    
    let sourceData: any[] = [];
    
    if (productType === "listed_stock") {
      sourceData = await db.select().from(listedStocks).where(eq(listedStocks.isPublished, true));
    } else if (productType === "reit" || productType === "invit") {
      sourceData = await db.select().from(reits);
    } else if (productType === "unlisted_stock") {
      sourceData = await db.select().from(preIpoCompanies).where(eq(preIpoCompanies.isAvailableForInvestment, true));
    } else {
      return res.status(400).json({ error: "Invalid productType" });
    }
    
    let synced = 0;
    
    for (const item of sourceData) {
      // Check if already exists
      const existing = await db.select().from(recommendationProducts)
        .where(
          and(
            eq(recommendationProducts.productType, productType),
            eq(recommendationProducts.productId, item.id)
          )
        );
      
      if (existing.length === 0) {
        // Map source data to recommendation product format
        let productData: any = {
          productType,
          productId: item.id,
          name: item.companyName || item.name,
          symbol: item.symbol,
          riskProfile: riskProfile || "moderate",
          isActive: false, // Start inactive, admin must activate
          addedBy: userId,
          lastUpdatedBy: userId,
          dataSource: "synced",
        };
        
        if (productType === "listed_stock") {
          productData = {
            ...productData,
            sector: item.broadSector || item.sector, // Use broad_sector for AI recommendations
            category: `Stock - ${item.marketCap || "Large Cap"}`,
            marketCap: item.marketCap,
            currentPrice: item.currentPrice,
            peRatio: item.peRatio,
            dividendYield: item.dividendYield?.toString(),
            returns1Y: item.returns1Y?.toString(),
            returns3Y: item.returns3Y?.toString(),
            returns5Y: item.returns5Y?.toString(),
            riskLevel: item.riskLevel || "Moderate",
            selectionRationale: item.selectionNotes,
            investmentThesis: item.investmentThesis,
          };
        } else if (productType === "reit" || productType === "invit") {
          productData = {
            ...productData,
            amc: item.sponsor || item.manager,
            sector: item.broadSector || item.sector,
            category: `${productType.toUpperCase()} - ${item.sector}`,
            currentPrice: item.currentPrice,
            dividendYield: item.distributionYield?.toString(),
            returns1Y: item.returns1Y?.toString(),
            returns3Y: item.returns3Y?.toString(),
            riskLevel: item.riskLevel || "Moderate",
            minimumInvestment: item.minimumInvestment,
            lotSize: item.lotSize,
          };
        } else if (productType === "unlisted_stock") {
          productData = {
            ...productData,
            sector: item.broadSector || item.sector,
            category: `Unlisted - ${item.broadSector || item.sector}`,
            riskLevel: "High",
            minimumInvestment: item.minInvestmentAmount,
            requiresEnhancedKYC: true,
          };
        }
        
        await db.insert(recommendationProducts).values(productData);
        synced++;
      }
    }
    
    invalidateCache();
    res.json({ success: true, synced, total: sourceData.length });
  } catch (error: any) {
    console.error("[RecommendationProducts] Error syncing:", error);
    res.status(500).json({ error: error.message });
  }
});

// Seed initial data from hardcoded recommendations
router.post("/seed-initial", requireAdmin, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    
    // Check if already seeded
    const existing = await db.select({ count: sql<number>`count(*)` }).from(recommendationProducts);
    if (existing[0].count > 0) {
      return res.json({ success: true, message: "Already seeded", count: existing[0].count });
    }
    
    // Initial seed data for stocks
    const stockSeeds = [
      // Conservative
      { name: "Reliance Industries Ltd", symbol: "RELIANCE", sector: "Energy", category: "Stock - Large Cap", riskProfile: "conservative", riskLevel: "Moderate", returns1Y: "12.5", returns3Y: "18.2", returns5Y: "16.8", priority: 90 },
      { name: "HDFC Bank Ltd", symbol: "HDFCBANK", sector: "Banking", category: "Stock - Large Cap", riskProfile: "conservative", riskLevel: "Moderate", returns1Y: "8.2", returns3Y: "12.5", returns5Y: "11.8", priority: 88 },
      { name: "TCS Ltd", symbol: "TCS", sector: "IT", category: "Stock - Large Cap", riskProfile: "conservative", riskLevel: "Moderate", returns1Y: "15.5", returns3Y: "14.8", returns5Y: "18.2", priority: 85 },
      // Moderate
      { name: "Infosys Ltd", symbol: "INFY", sector: "IT", category: "Stock - Large Cap", riskProfile: "moderate", riskLevel: "Moderate", returns1Y: "14.2", returns3Y: "16.5", returns5Y: "17.8", priority: 88 },
      { name: "ICICI Bank Ltd", symbol: "ICICIBANK", sector: "Banking", category: "Stock - Large Cap", riskProfile: "moderate", riskLevel: "Moderate", returns1Y: "18.5", returns3Y: "22.8", returns5Y: "20.5", priority: 87 },
      { name: "Bharti Airtel Ltd", symbol: "BHARTIARTL", sector: "Telecom", category: "Stock - Large Cap", riskProfile: "moderate", riskLevel: "Moderately High", returns1Y: "35.2", returns3Y: "28.5", returns5Y: "22.0", priority: 85 },
      { name: "Larsen & Toubro Ltd", symbol: "LT", sector: "Infrastructure", category: "Stock - Large Cap", riskProfile: "moderate", riskLevel: "Moderately High", returns1Y: "25.8", returns3Y: "32.5", returns5Y: "28.0", priority: 84 },
      // Aggressive
      { name: "Bajaj Finance Ltd", symbol: "BAJFINANCE", sector: "NBFC", category: "Stock - Large Cap", riskProfile: "aggressive", riskLevel: "High", returns1Y: "22.5", returns3Y: "28.2", returns5Y: "32.5", priority: 90 },
      { name: "Tata Motors Ltd", symbol: "TATAMOTORS", sector: "Auto", category: "Stock - Large Cap", riskProfile: "aggressive", riskLevel: "High", returns1Y: "45.2", returns3Y: "52.8", returns5Y: "35.0", priority: 88 },
      { name: "SBI Cards Ltd", symbol: "SBICARD", sector: "Financial", category: "Stock - Mid Cap", riskProfile: "aggressive", riskLevel: "High", returns1Y: "18.5", returns3Y: "22.0", returns5Y: "24.5", priority: 82 },
      { name: "Persistent Systems Ltd", symbol: "PERSISTENT", sector: "IT", category: "Stock - Mid Cap", riskProfile: "aggressive", riskLevel: "High", returns1Y: "38.5", returns3Y: "45.2", returns5Y: "42.0", priority: 80 },
      // Very Aggressive
      { name: "Eternal Ltd", symbol: "ETERNAL", sector: "Tech", category: "Stock - New Age", riskProfile: "very_aggressive", riskLevel: "Very High", returns1Y: "85.2", returns3Y: "45.0", priority: 85 },
      { name: "Tata Elxsi Ltd", symbol: "TATAELXSI", sector: "IT", category: "Stock - Mid Cap", riskProfile: "very_aggressive", riskLevel: "Very High", returns1Y: "28.5", returns3Y: "48.2", returns5Y: "55.0", priority: 82 },
      { name: "Dixon Technologies Ltd", symbol: "DIXON", sector: "Electronics", category: "Stock - Mid Cap", riskProfile: "very_aggressive", riskLevel: "Very High", returns1Y: "65.2", returns3Y: "72.5", returns5Y: "85.0", priority: 80 },
    ];
    
    // Initial seed data for unlisted stocks
    const unlistedSeeds = [
      { name: "NSE India Ltd", sector: "Exchange", category: "Unlisted - Exchange", riskProfile: "conservative", riskLevel: "Moderate", returns1Y: "18.5", returns3Y: "22.0", returns5Y: "25.5", priority: 90, requiresEnhancedKYC: true },
      { name: "HDB Financial Services Ltd", sector: "NBFC", category: "Unlisted - NBFC", riskProfile: "moderate", riskLevel: "Moderate", returns1Y: "15.2", returns3Y: "18.5", returns5Y: "20.0", priority: 88, requiresEnhancedKYC: true },
      { name: "Swiggy (Bundl Technologies)", sector: "Food Tech", category: "Unlisted - Food Tech", riskProfile: "aggressive", riskLevel: "High", returns1Y: "35.2", returns3Y: "42.0", priority: 85, requiresEnhancedKYC: true },
      { name: "PhonePe (PhonePe Pvt Ltd)", sector: "Fintech", category: "Unlisted - Fintech", riskProfile: "aggressive", riskLevel: "High", returns1Y: "28.5", returns3Y: "35.0", priority: 84, requiresEnhancedKYC: true },
      { name: "OfBusiness (OFB Tech Pvt Ltd)", sector: "B2B Commerce", category: "Unlisted - B2B Commerce", riskProfile: "very_aggressive", riskLevel: "Very High", returns1Y: "42.5", returns3Y: "55.0", priority: 82, requiresEnhancedKYC: true },
    ];
    
    // Initial seed data for REITs
    const reitSeeds = [
      { name: "Embassy Office Parks REIT", symbol: "EMBASSY", amc: "Embassy Group", sector: "Office", category: "REIT - Office", riskProfile: "conservative", riskLevel: "Moderate", dividendYield: "6.5", returns1Y: "8.5", returns3Y: "12.0", priority: 90 },
      { name: "Mindspace Business Parks REIT", symbol: "MINDSPACE", amc: "K Raheja Corp", sector: "Office", category: "REIT - Office", riskProfile: "moderate", riskLevel: "Moderate", dividendYield: "6.2", returns1Y: "10.2", returns3Y: "14.5", priority: 88 },
      { name: "Brookfield India Real Estate Trust", symbol: "BIRET", amc: "Brookfield", sector: "Office", category: "REIT - Office", riskProfile: "moderate", riskLevel: "Moderately High", dividendYield: "5.8", returns1Y: "12.5", returns3Y: "15.0", priority: 85 },
    ];
    
    // Initial seed data for InvITs
    const invitSeeds = [
      { name: "IndiGrid InvIT", symbol: "INDIGRID", amc: "Sterlite Power", sector: "Power Transmission", category: "InvIT - Power", riskProfile: "conservative", riskLevel: "Moderate", dividendYield: "12.5", returns1Y: "10.5", returns3Y: "14.0", priority: 90 },
      { name: "IRB InvIT Fund", symbol: "IRB", amc: "IRB Infrastructure", sector: "Roads", category: "InvIT - Roads", riskProfile: "moderate", riskLevel: "Moderately High", dividendYield: "8.5", returns1Y: "15.2", returns3Y: "18.5", priority: 85 },
      { name: "PowerGrid InvIT", symbol: "PGINVIT", amc: "Power Grid Corp", sector: "Power Transmission", category: "InvIT - Power", riskProfile: "conservative", riskLevel: "Low", dividendYield: "11.0", returns1Y: "8.0", returns3Y: "12.0", priority: 88 },
    ];
    
    // Insert all seeds
    let inserted = 0;
    
    for (const stock of stockSeeds) {
      await db.insert(recommendationProducts).values({
        productType: "listed_stock",
        ...stock,
        amc: "NSE/BSE",
        isActive: true,
        addedBy: userId,
        lastUpdatedBy: userId,
        dataSource: "seed",
      });
      inserted++;
    }
    
    for (const stock of unlistedSeeds) {
      await db.insert(recommendationProducts).values({
        productType: "unlisted_stock",
        ...stock,
        amc: "Unlisted",
        isActive: true,
        addedBy: userId,
        lastUpdatedBy: userId,
        dataSource: "seed",
      });
      inserted++;
    }
    
    for (const reit of reitSeeds) {
      await db.insert(recommendationProducts).values({
        productType: "reit",
        ...reit,
        isActive: true,
        addedBy: userId,
        lastUpdatedBy: userId,
        dataSource: "seed",
      });
      inserted++;
    }
    
    for (const invit of invitSeeds) {
      await db.insert(recommendationProducts).values({
        productType: "invit",
        ...invit,
        isActive: true,
        addedBy: userId,
        lastUpdatedBy: userId,
        dataSource: "seed",
      });
      inserted++;
    }
    
    invalidateCache();
    res.json({ success: true, inserted });
  } catch (error: any) {
    console.error("[RecommendationProducts] Error seeding:", error);
    res.status(500).json({ error: error.message });
  }
});

// Invalidate cache manually
router.post("/invalidate-cache", requireAdmin, async (req, res) => {
  invalidateCache();
  res.json({ success: true, message: "Cache invalidated" });
});

// Get stats
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const stats = await db.select({
      productType: recommendationProducts.productType,
      riskProfile: recommendationProducts.riskProfile,
      count: sql<number>`count(*)`,
      activeCount: sql<number>`count(*) filter (where ${recommendationProducts.isActive} = true)`,
    })
    .from(recommendationProducts)
    .groupBy(recommendationProducts.productType, recommendationProducts.riskProfile);
    
    res.json(stats);
  } catch (error: any) {
    console.error("[RecommendationProducts] Error getting stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// Public router for recommendation engine (no auth required)
const publicRouter = Router();

// Public: Get recommendations by type and risk profile
publicRouter.get("/by-category", async (req, res) => {
  try {
    const { productType, riskProfile } = req.query;
    
    if (!productType || !riskProfile) {
      return res.status(400).json({ error: "productType and riskProfile are required" });
    }
    
    const cacheKey = `${productType}_${riskProfile}`;
    if (Date.now() - cacheTimestamp < CACHE_TTL && recommendationCache.has(cacheKey)) {
      return res.json(recommendationCache.get(cacheKey));
    }
    
    const products = await db
      .select()
      .from(recommendationProducts)
      .where(
        and(
          eq(recommendationProducts.productType, productType as string),
          eq(recommendationProducts.riskProfile, riskProfile as string),
          eq(recommendationProducts.isActive, true)
        )
      )
      .orderBy(desc(recommendationProducts.priority), asc(recommendationProducts.name));
    
    recommendationCache.set(cacheKey, products);
    cacheTimestamp = Date.now();
    
    res.json(products);
  } catch (error: any) {
    console.error("[RecommendationProducts] Error fetching by category:", error);
    res.status(500).json({ error: error.message });
  }
});

// Public: Get all active recommendations grouped
publicRouter.get("/all-active", async (req, res) => {
  try {
    const cacheKey = "all_active";
    if (Date.now() - cacheTimestamp < CACHE_TTL && recommendationCache.has(cacheKey)) {
      return res.json(recommendationCache.get(cacheKey));
    }
    
    const products = await db
      .select()
      .from(recommendationProducts)
      .where(eq(recommendationProducts.isActive, true))
      .orderBy(desc(recommendationProducts.priority), asc(recommendationProducts.name));
    
    const grouped: Record<string, Record<string, any[]>> = {};
    products.forEach(p => {
      if (!grouped[p.productType]) {
        grouped[p.productType] = {};
      }
      if (!grouped[p.productType][p.riskProfile]) {
        grouped[p.productType][p.riskProfile] = [];
      }
      grouped[p.productType][p.riskProfile].push(p);
    });
    
    recommendationCache.set(cacheKey, grouped as any);
    cacheTimestamp = Date.now();
    
    res.json(grouped);
  } catch (error: any) {
    console.error("[RecommendationProducts] Error fetching all active:", error);
    res.status(500).json({ error: error.message });
  }
});

// Public: Get recommendations with full rationale
publicRouter.get("/with-rationale", async (req, res) => {
  try {
    const { productType, riskProfile } = req.query;
    
    if (!productType || !riskProfile) {
      return res.status(400).json({ error: "productType and riskProfile are required" });
    }
    
    const products = await db
      .select()
      .from(recommendationProducts)
      .where(
        and(
          eq(recommendationProducts.productType, productType as string),
          eq(recommendationProducts.riskProfile, riskProfile as string),
          eq(recommendationProducts.isActive, true)
        )
      )
      .orderBy(desc(recommendationProducts.priority), asc(recommendationProducts.name));
    
    // Transform products with rationale
    const withRationale = products.map(p => {
      const productData: RecommendationProductData = {
        name: p.name,
        amc: p.amc || "NSE/BSE",
        category: p.category || `${p.productType} - General`,
        sector: p.sector || undefined,
        returns1Y: p.returns1Y || "0",
        returns3Y: p.returns3Y || "0",
        returns5Y: p.returns5Y || undefined,
        risk: p.riskLevel || "Moderate",
        productType: p.productType,
        ticker: p.symbol || undefined,
        symbol: p.symbol || undefined,
        selectionRationale: p.selectionRationale || undefined,
        investmentThesis: p.investmentThesis || undefined,
        requiresEnhancedKYC: p.requiresEnhancedKYC || false,
      };
      
      const rationale = generateRecommendationRationale(productData, riskProfile as string);
      
      return {
        ...p,
        rationale: {
          summary: rationale.summary,
          whyRecommended: rationale.whyRecommended,
          riskConsideration: rationale.riskConsideration,
          suitabilityNote: rationale.suitabilityNote,
        }
      };
    });
    
    res.json(withRationale);
  } catch (error: any) {
    console.error("[RecommendationProducts] Error fetching with rationale:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
export { publicRouter };
