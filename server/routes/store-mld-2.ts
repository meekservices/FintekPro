import { Router } from "express";
import { db } from "../db";
import { mldMaster, mldPriceHistory, mldMonthwisePerformance, clientPortfolioMld, users, investmentInquiries } from "@shared/schema";
import { eq, desc, and, ilike, or, sql, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/roleMiddleware";
import { scrapeBseMldListings, generateSampleMldListings, type BseMldListing } from "../services/bse-mld-scraper";
import { scrapeNseMldListings, generateSampleNseMldListings, type NseMldListing } from "../services/nse-mld-scraper";

const router = Router();

// ============ MLD STORE ENDPOINTS ============

// GET /mld - List all published MLDs for store
router.delete("/admin/mld/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete related records first
    await db.delete(mldPriceHistory).where(eq(mldPriceHistory.mldId, id));
    await db.delete(mldMonthwisePerformance).where(eq(mldMonthwisePerformance.mldId, id));
    
    const [deleted] = await db
      .delete(mldMaster)
      .where(eq(mldMaster.id, id))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ error: "MLD not found" });
    }
    
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error("Error deleting MLD:", error);
    res.status(500).json({ error: "Failed to delete MLD" });
  }
});

// ============ CLIENT PORTFOLIO MLD ENDPOINTS ============

// GET /portfolio/mld - Get user's MLD holdings
router.get("/portfolio/mld", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    
    const holdings = await db
      .select()
      .from(clientPortfolioMld)
      .where(eq(clientPortfolioMld.clientId, userId))
      .orderBy(desc(clientPortfolioMld.createdAt));
    
    // Calculate summary
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    
    holdings.forEach(h => {
      if (h.entryStatus === "approved") {
        totalInvested += parseFloat(h.totalInvested || "0");
        totalCurrentValue += parseFloat(h.currentValue || h.totalInvested || "0");
        approvedCount++;
      } else if (h.entryStatus === "pending") {
        pendingCount++;
      }
    });
    
    res.json({
      holdings,
      summary: {
        totalHoldings: holdings.length,
        approvedCount,
        pendingCount,
        totalInvested,
        totalCurrentValue,
        unrealizedGainLoss: totalCurrentValue - totalInvested,
        unrealizedGainLossPercent: totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0,
      },
    });
  } catch (error: any) {
    console.error("Error fetching MLD holdings:", error);
    res.status(500).json({ error: "Failed to fetch MLD holdings" });
  }
});

// POST /portfolio/mld - Add MLD to portfolio
router.post("/portfolio/mld", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const holdingData = req.body;
    
    // Validate required fields
    if (!holdingData.isin || !holdingData.mldName || !holdingData.purchasePrice || !holdingData.purchaseDate || !holdingData.quantity) {
      return res.status(400).json({ 
        error: "Missing required fields: isin, mldName, purchasePrice, purchaseDate, quantity" 
      });
    }
    
    // Calculate derived fields
    const purchasePrice = parseFloat(holdingData.purchasePrice);
    const quantity = parseFloat(holdingData.quantity);
    const totalInvested = purchasePrice * quantity;
    const currentPrice = holdingData.currentPrice ? parseFloat(holdingData.currentPrice) : purchasePrice;
    const currentValue = currentPrice * quantity;
    const unrealizedGainLoss = currentValue - totalInvested;
    const unrealizedGainLossPercent = totalInvested > 0 ? (unrealizedGainLoss / totalInvested) * 100 : 0;
    
    // Try to link to existing MLD master
    let mldId = holdingData.mldId;
    if (!mldId && holdingData.isin) {
      const [existingMld] = await db.select().from(mldMaster).where(eq(mldMaster.isin, holdingData.isin));
      if (existingMld) {
        mldId = existingMld.id;
      }
    }
    
    const [newHolding] = await db
      .insert(clientPortfolioMld)
      .values({
        clientId: userId,
        addedByUserId: userId,
        mldId,
        isin: holdingData.isin,
        mldName: holdingData.mldName,
        issuer: holdingData.issuer,
        underlying: holdingData.underlying,
        payoffType: holdingData.payoffType,
        purchasePrice: holdingData.purchasePrice,
        purchaseDate: holdingData.purchaseDate,
        quantity: holdingData.quantity,
        faceValue: holdingData.faceValue,
        totalInvested: totalInvested.toFixed(2),
        maturityDate: holdingData.maturityDate,
        expectedPayoffScenario: holdingData.expectedPayoffScenario,
        expectedPayoffAmount: holdingData.expectedPayoffAmount,
        currentPrice: holdingData.currentPrice,
        lastPriceDate: holdingData.lastPriceDate,
        currentValue: currentValue.toFixed(2),
        unrealizedGainLoss: unrealizedGainLoss.toFixed(2),
        unrealizedGainLossPercent: unrealizedGainLossPercent.toFixed(4),
        riskScore: holdingData.riskScore,
        documents: holdingData.documents || [],
        notes: holdingData.notes,
        entryStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    res.status(201).json(newHolding);
  } catch (error: any) {
    console.error("Error adding MLD to portfolio:", error);
    res.status(500).json({ error: "Failed to add MLD to portfolio" });
  }
});

// PUT /portfolio/mld/:id - Update MLD holding
router.put("/portfolio/mld/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const updateData = req.body;
    
    // Verify ownership
    const [existing] = await db.select().from(clientPortfolioMld).where(eq(clientPortfolioMld.id, id));
    if (!existing || existing.clientId !== userId) {
      return res.status(404).json({ error: "MLD holding not found" });
    }
    
    // Recalculate derived fields if needed
    if (updateData.purchasePrice || updateData.quantity || updateData.currentPrice) {
      const purchasePrice = parseFloat(updateData.purchasePrice || existing.purchasePrice || "0");
      const quantity = parseFloat(updateData.quantity || existing.quantity || "0");
      const totalInvested = purchasePrice * quantity;
      const currentPrice = parseFloat(updateData.currentPrice || existing.currentPrice || purchasePrice.toString());
      const currentValue = currentPrice * quantity;
      
      updateData.totalInvested = totalInvested.toFixed(2);
      updateData.currentValue = currentValue.toFixed(2);
      updateData.unrealizedGainLoss = (currentValue - totalInvested).toFixed(2);
      updateData.unrealizedGainLossPercent = totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested * 100).toFixed(4) : "0";
    }
    
    const [updated] = await db
      .update(clientPortfolioMld)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(clientPortfolioMld.id, id))
      .returning();
    
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating MLD holding:", error);
    res.status(500).json({ error: "Failed to update MLD holding" });
  }
});

// DELETE /portfolio/mld/:id - Delete MLD holding
router.delete("/portfolio/mld/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    // Verify ownership
    const [existing] = await db.select().from(clientPortfolioMld).where(eq(clientPortfolioMld.id, id));
    if (!existing || existing.clientId !== userId) {
      return res.status(404).json({ error: "MLD holding not found" });
    }
    
    const [deleted] = await db
      .delete(clientPortfolioMld)
      .where(eq(clientPortfolioMld.id, id))
      .returning();
    
    res.json({ success: true, deleted });
  } catch (error: any) {
    console.error("Error deleting MLD holding:", error);
    res.status(500).json({ error: "Failed to delete MLD holding" });
  }
});

// ============ ADMIN PORTFOLIO APPROVAL ============

// GET /portfolio/admin/mld - Get all MLD portfolio entries for admin
router.get("/portfolio/admin/mld", requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    const conditions = [];
    if (status) conditions.push(eq(clientPortfolioMld.entryStatus, status as string));
    
    const holdings = await db
      .select({
        holding: clientPortfolioMld,
        client: users,
      })
      .from(clientPortfolioMld)
      .leftJoin(users, eq(clientPortfolioMld.clientId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(clientPortfolioMld.createdAt));
    
    res.json({
      holdings: holdings.map(h => ({
        ...h.holding,
        client: h.client ? {
          id: h.client.id,
          name: `${h.client.firstName || ""} ${h.client.lastName || ""}`.trim(),
          email: h.client.email,
        } : null,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching admin MLD portfolio:", error);
    res.status(500).json({ error: "Failed to fetch portfolio data" });
  }
});

// PUT /portfolio/admin/mld/:id/approve - Approve/reject MLD holding
router.put("/portfolio/admin/mld/:id/approve", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;
    const adminId = (req as any).user?.id;
    
    if (!["approve", "reject", "needs_review"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }
    
    const entryStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "needs_review";
    
    const [updated] = await db
      .update(clientPortfolioMld)
      .set({
        entryStatus,
        approvedByUserId: action === "approve" ? adminId : null,
        approvedAt: action === "approve" ? new Date() : null,
        rejectionReason: action === "reject" ? rejectionReason : null,
        updatedAt: new Date(),
      })
      .where(eq(clientPortfolioMld.id, id))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ error: "MLD holding not found" });
    }
    
    res.json(updated);
  } catch (error: any) {
    console.error("Error approving MLD holding:", error);
    res.status(500).json({ error: "Failed to process approval" });
  }
});

// ============ ANALYTICS HELPER FUNCTIONS ============

function calculateScenarioPayoffs(mld: any) {
  const faceValue = parseFloat(mld.faceValue || "1000000");
  const barrier = parseFloat(mld.barrierLevel || "0.9");
  const participation = parseFloat(mld.participationRate || "1");
  const cap = parseFloat(mld.cap || "1.5");
  const floor = parseFloat(mld.floor || "1");
  
  const scenarios = {
    bull: { underlyingReturn: 0.20, payoff: 0, irr: 0 },
    base: { underlyingReturn: 0.05, payoff: 0, irr: 0 },
    bear: { underlyingReturn: -0.15, payoff: 0, irr: 0 },
  };
  
  Object.keys(scenarios).forEach(key => {
    const scenario = scenarios[key as keyof typeof scenarios];
    let payoffMultiple = 1;
    
    switch (mld.payoffType) {
      case "digital":
        payoffMultiple = scenario.underlyingReturn >= 0 ? Math.min(1 + scenario.underlyingReturn * participation, cap) : floor;
        break;
      case "barrier":
        payoffMultiple = scenario.underlyingReturn >= -(1 - barrier) ? Math.min(1 + scenario.underlyingReturn * participation, cap) : floor;
        break;
      case "sharkfin":
        if (scenario.underlyingReturn > 0 && scenario.underlyingReturn <= (cap - 1)) {
          payoffMultiple = 1 + scenario.underlyingReturn * participation;
        } else if (scenario.underlyingReturn > (cap - 1)) {
          payoffMultiple = cap;
        } else {
          payoffMultiple = floor;
        }
        break;
      case "participation":
        payoffMultiple = floor + Math.max(0, scenario.underlyingReturn * participation);
        break;
      default:
        payoffMultiple = 1 + scenario.underlyingReturn;
    }
    
    scenario.payoff = faceValue * payoffMultiple;
    
    // Calculate IRR (simplified)
    const maturityYears = mld.maturityDate ? (new Date(mld.maturityDate).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000) : 1;
    scenario.irr = ((payoffMultiple - 1) / Math.max(maturityYears, 0.1)) * 100;
  });
  
  return scenarios;
}

function calculateMldAnalytics(mld: any) {
  const faceValue = parseFloat(mld.faceValue || "1000000");
  const latestPrice = parseFloat(mld.latestPrice || mld.faceValue || "1000000");
  
  const maturityDate = mld.maturityDate ? new Date(mld.maturityDate) : new Date();
  const yearsToMaturity = Math.max((maturityDate.getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000), 0.01);
  
  // Calculate YTM (simplified)
  const ytm = ((faceValue / latestPrice) ** (1 / yearsToMaturity) - 1) * 100;
  
  // Risk assessment
  const riskFactors = [];
  if (mld.rating && ["BBB", "BBB-", "BB+", "BB", "B"].some(r => mld.rating.includes(r))) {
    riskFactors.push("Credit risk: Sub-investment grade rating");
  }
  if (yearsToMaturity > 5) {
    riskFactors.push("Duration risk: Long maturity period");
  }
  if (mld.liquidityProfile === "Low") {
    riskFactors.push("Liquidity risk: Limited secondary market");
  }
  
  return {
    currentPrice: latestPrice,
    faceValue,
    yearsToMaturity: yearsToMaturity.toFixed(2),
    ytm: ytm.toFixed(2),
    impliedYield: mld.impliedYield || ytm.toFixed(2),
    irr: mld.irr || ytm.toFixed(2),
    riskScore: mld.riskScore || 5,
    riskFactors,
    suitabilityScore: mld.suitabilityScore || 5,
    aiRecommendation: mld.aiRecommendation || "Suitable for moderate risk investors seeking structured returns",
  };
}

function generateScenarioAnalysis(mld: any) {
  const scenarioPayoffs = calculateScenarioPayoffs(mld);
  const faceValue = parseFloat(mld.faceValue || "1000000");
  
  return {
    underlying: mld.underlying,
    payoffType: mld.payoffType,
    structure: {
      barrier: mld.barrierLevel,
      participation: mld.participationRate,
      cap: mld.cap,
      floor: mld.floor,
    },
    scenarios: Object.entries(scenarioPayoffs).map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      underlyingReturn: `${((data as any).underlyingReturn * 100).toFixed(1)}%`,
      payoff: (data as any).payoff,
      absoluteReturn: (data as any).payoff - faceValue,
      percentReturn: (((data as any).payoff / faceValue - 1) * 100).toFixed(2),
      irr: `${(data as any).irr.toFixed(2)}%`,
    })),
    payoffGraph: generatePayoffGraphData(mld),
  };
}

function generatePayoffGraphData(mld: any) {
  const barrier = parseFloat(mld.barrierLevel || "0.9");
  const participation = parseFloat(mld.participationRate || "1");
  const cap = parseFloat(mld.cap || "1.5");
  const floor = parseFloat(mld.floor || "1");
  
  const dataPoints = [];
  for (let x = -30; x <= 40; x += 5) {
    const underlyingReturn = x / 100;
    let payoffMultiple = 1;
    
    switch (mld.payoffType) {
      case "digital":
        payoffMultiple = underlyingReturn >= 0 ? Math.min(1 + underlyingReturn * participation, cap) : floor;
        break;
      case "barrier":
        payoffMultiple = underlyingReturn >= -(1 - barrier) ? Math.min(1 + underlyingReturn * participation, cap) : floor;
        break;
      case "sharkfin":
        if (underlyingReturn > 0 && underlyingReturn <= (cap - 1)) {
          payoffMultiple = 1 + underlyingReturn * participation;
        } else if (underlyingReturn > (cap - 1)) {
          payoffMultiple = cap;
        } else {
          payoffMultiple = floor;
        }
        break;
      case "participation":
        payoffMultiple = floor + Math.max(0, underlyingReturn * participation);
        break;
      default:
        payoffMultiple = 1 + underlyingReturn;
    }
    
    dataPoints.push({
      underlyingReturn: x,
      payoffMultiple: ((payoffMultiple - 1) * 100).toFixed(2),
    });
  }
  
  return dataPoints;
}

// ============ BSE MLD IMPORT ENDPOINTS ============

// GET /admin/mld/import/preview - Preview MLDs from BSE before importing
router.get("/admin/mld/import/preview", requireAdmin, async (req, res) => {
  try {
    const { useSample } = req.query;
    
    let listings: BseMldListing[];
    let errors: string[] = [];
    
    if (useSample === "true") {
      console.log("[BSE Import] Using sample MLD data for preview");
      listings = generateSampleMldListings();
    } else {
      console.log("[BSE Import] Scraping BSE for MLD listings...");
      const result = await scrapeBseMldListings();
      listings = result.listings;
      errors = result.errors;
      
      if (listings.length === 0) {
        console.log("[BSE Import] No live MLDs found, falling back to sample data");
        listings = generateSampleMldListings();
      }
    }
    
    // Normalize ISINs - trim whitespace and uppercase for consistent comparison
    const normalizeIsin = (isin: string) => isin.trim().toUpperCase();
    
    // Check for existing ISINs to mark duplicates
    const existingIsins = await db
      .select({ isin: mldMaster.isin })
      .from(mldMaster);
    
    const existingIsinSet = new Set(existingIsins.map(e => normalizeIsin(e.isin)));
    
    const previewListings = listings.map(listing => ({
      ...listing,
      isin: normalizeIsin(listing.isin), // Normalize the scraped ISIN
      isDuplicate: existingIsinSet.has(normalizeIsin(listing.isin)),
    }));
    
    const newCount = previewListings.filter(l => !l.isDuplicate).length;
    const duplicateCount = previewListings.filter(l => l.isDuplicate).length;
    
    res.json({
      success: true,
      listings: previewListings,
      summary: {
        total: listings.length,
        newMLDs: newCount,
        duplicates: duplicateCount,
      },
      errors,
    });
  } catch (error: any) {
    console.error("[BSE Import] Preview error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to preview BSE MLDs",
      details: error.message,
    });
  }
});

// GET /admin/mld/import/nse/preview - Preview MLDs from NSE before importing
router.get("/admin/mld/import/nse/preview", requireAdmin, async (req, res) => {
  try {
    const { useSample } = req.query;
    
    let listings: NseMldListing[];
    let errors: string[] = [];
    
    if (useSample === "true") {
      console.log("[NSE Import] Using sample MLD data for preview");
      listings = generateSampleNseMldListings();
    } else {
      console.log("[NSE Import] Scraping NSE for MLD listings...");
      const result = await scrapeNseMldListings();
      listings = result.listings;
      errors = result.errors;
      
      if (listings.length === 0) {
        console.log("[NSE Import] No live MLDs found, falling back to sample data");
        listings = generateSampleNseMldListings();
      }
    }
    
    // Normalize ISINs - trim whitespace and uppercase for consistent comparison
    const normalizeIsin = (isin: string) => isin.trim().toUpperCase();
    
    // Check for existing ISINs to mark duplicates
    const existingIsins = await db
      .select({ isin: mldMaster.isin })
      .from(mldMaster);
    
    const existingIsinSet = new Set(existingIsins.map(e => normalizeIsin(e.isin)));
    
    const previewListings = listings.map(listing => ({
      ...listing,
      isin: normalizeIsin(listing.isin),
      isDuplicate: existingIsinSet.has(normalizeIsin(listing.isin)),
    }));
    
    const newCount = previewListings.filter(l => !l.isDuplicate).length;
    const duplicateCount = previewListings.filter(l => l.isDuplicate).length;
    
    res.json({
      success: true,
      listings: previewListings,
      summary: {
        total: listings.length,
        newMLDs: newCount,
        duplicates: duplicateCount,
      },
      errors,
    });
  } catch (error: any) {
    console.error("[NSE Import] Preview error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to preview NSE MLDs",
      details: error.message,
    });
  }
});

// POST /admin/mld/import - Import selected MLDs from BSE or NSE
router.post("/admin/mld/import", requireAdmin, async (req, res) => {
  try {
    const { listings, skipDuplicates = true } = req.body;
    
    if (!Array.isArray(listings) || listings.length === 0) {
      return res.status(400).json({ error: "No listings provided for import" });
    }
    
    const source = listings[0]?.exchange || "BSE";
    console.log(`[${source} Import] Starting import of ${listings.length} MLDs...`);
    
    // Normalize ISIN for consistent comparison
    const normalizeIsin = (isin: string) => isin.trim().toUpperCase();
    
    // Get existing ISINs
    const existingIsins = await db
      .select({ isin: mldMaster.isin })
      .from(mldMaster);
    const existingIsinSet = new Set(existingIsins.map(e => normalizeIsin(e.isin)));
    
    const imported: any[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];
    
    for (const listing of listings as (BseMldListing | NseMldListing)[]) {
      try {
        const normalizedIsin = normalizeIsin(listing.isin);
        if (existingIsinSet.has(normalizedIsin)) {
          if (skipDuplicates) {
            skipped.push(listing.isin);
            continue;
          }
        }
        
        // Determine payoff type from name (default to barrier if unclear)
        let payoffType = "barrier";
        const lowerName = listing.name.toLowerCase();
        if (lowerName.includes("principal protected")) payoffType = "digital";
        else if (lowerName.includes("autocall")) payoffType = "autocall";
        else if (lowerName.includes("snowball")) payoffType = "snowball";
        else if (lowerName.includes("participation")) payoffType = "participation";
        else if (lowerName.includes("range")) payoffType = "range";
        else if (lowerName.includes("shark")) payoffType = "sharkfin";
        
        const [newMld] = await db
          .insert(mldMaster)
          .values({
            isin: listing.isin,
            name: listing.name,
            issuer: listing.issuer,
            issueDate: listing.issueDate || new Date().toISOString().split("T")[0],
            maturityDate: listing.maturityDate || new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            faceValue: listing.faceValue,
            couponRate: listing.couponRate || undefined,
            underlying: "NIFTY 50",
            payoffType,
            creditRating: listing.creditRating,
            listingType: listing.listingType,
            exchange: listing.exchange,
            minInvestment: listing.faceValue,
            lotSize: 1,
            status: "active",
            riskScore: 5,
            isPublished: false,
            createdAt: new Date(),
          })
          .returning();
        
        imported.push(newMld);
        existingIsinSet.add(normalizedIsin);
      } catch (itemError: any) {
        console.error(`[BSE Import] Error importing ${listing.isin}:`, itemError.message);
        errors.push(`${listing.isin}: ${itemError.message}`);
      }
    }
    
    console.log(`[BSE Import] Completed: ${imported.length} imported, ${skipped.length} skipped, ${errors.length} errors`);
    
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
    console.error("[BSE Import] Import error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to import BSE MLDs",
      details: error.message,
    });
  }
});

// ============ MLD INVESTMENT INQUIRIES ============

const mldExpressInterestSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  panNumber: z.string().optional(),
  investmentAmount: z.string().optional(),
  investmentTimeline: z.enum(["immediate", "within_1_month", "within_3_months", "exploring"]).optional(),
  message: z.string().optional(),
});

// POST /mld/:id/express-interest - Express interest in an MLD
router.post("/mld/:id/express-interest", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the MLD details
    const [mld] = await db.select().from(mldMaster).where(eq(mldMaster.id, id));
    if (!mld) {
      return res.status(404).json({ error: "MLD not found" });
    }
    
    const data = mldExpressInterestSchema.parse(req.body);
    
    // Get user info if authenticated
    const userId = (req as any).user?.id || null;
    const kycStatus = (req as any).user?.kycStatus || null;
    
    const [inquiry] = await db
      .insert(investmentInquiries)
      .values({
        productType: "mld",
        productId: id,
        productName: mld.name,
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
    console.error("Error creating MLD inquiry:", error);
    res.status(500).json({ error: "Failed to submit inquiry" });
  }
});


export default router;
