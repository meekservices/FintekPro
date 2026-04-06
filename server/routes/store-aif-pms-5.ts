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

// ============ AI RECOMMENDATION SYNC ============

// GET /recommendation-sync/preview - Preview AI-enhanced sync of top AIF/PMS to recommendations
router.get("/recommendation-sync/preview", requireAdmin, async (req, res) => {
  try {
    const aifLimit = parseInt(req.query.aifLimit as string) || 15;
    const pmsLimit = parseInt(req.query.pmsLimit as string) || 15;
    
    console.log(`[Recommendation Sync] Preview requested: ${aifLimit} AIFs, ${pmsLimit} PMS`);
    
    const preview = await aiRecommendationSyncService.previewSync(aifLimit, pmsLimit);
    
    res.json({
      success: true,
      ...preview,
    });
  } catch (error: any) {
    console.error("[Recommendation Sync] Preview error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to preview recommendation sync",
      details: error.message,
    });
  }
});

// POST /recommendation-sync/execute - Execute AI-enhanced sync of top AIF/PMS to recommendations
router.post("/recommendation-sync/execute", requireAdmin, async (req, res) => {
  try {
    const { aifLimit = 15, pmsLimit = 15 } = req.body;
    
    console.log(`[Recommendation Sync] Execute requested: ${aifLimit} AIFs, ${pmsLimit} PMS`);
    
    const result = await aiRecommendationSyncService.executeSync(aifLimit, pmsLimit);
    
    res.json({
      success: true,
      message: `Synced ${result.imported} products to recommendations`,
      ...result,
    });
  } catch (error: any) {
    console.error("[Recommendation Sync] Execute error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to execute recommendation sync",
      details: error.message,
    });
  }
});


export default router;
