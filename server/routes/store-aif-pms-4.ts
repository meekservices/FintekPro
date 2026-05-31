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
      return res.status(400).json({ error: "Invalid data", details: error.issues });
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
      return res.status(400).json({ error: "Invalid data", details: error.issues });
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

export default router;
