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

export default router;
