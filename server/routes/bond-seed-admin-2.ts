import { Router, Request, Response, NextFunction } from "express";
import { requireAdmin } from "../middleware/roleMiddleware";
import { db } from "../db";
import { bondFeeProfiles, bondFeeOverrides, bondCatalog, governmentSecurities, corporateBonds, bondMarketplaceAuditLogs } from "@shared/schema";
import { bondFeeCalibrationService, REGULATORY_FEE_CAPS, type InstrumentType } from "../services/bond-fee-calibration-service";
import { bondCatalogService } from "../bond-catalog-service";
import { eq, and, desc, sql, or, ilike, count } from "drizzle-orm";

const router = Router();

// Admin authentication middleware


// Apply admin auth to all routes
router.use(requireAdmin);

// ============================================
// FEE PROFILES API
// ============================================

// Get all fee profiles with regulatory caps
router.post("/sync/bse", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    // Get existing ISINs in catalog for quick lookup
    const existingIsins = await db.select({ isin: bondCatalog.isin }).from(bondCatalog);
    const existingIsinSet = new Set(existingIsins.map(e => e.isin));
    
    // Fetch ALL corporate bonds from our database (no limit - syncs everything)
    const corpBonds = await db.select().from(corporateBonds);
    
    // Pre-fetch fee profiles for each instrument type
    const feeProfiles: Record<string, any> = {};
    for (const type of ['corporate_bond', 'ncd', 'tax_free_bond', 'infrastructure_bond', 'debenture']) {
      feeProfiles[type] = await bondFeeCalibrationService.getProfileByInstrumentType(type);
    }
    
    // Separate new and existing bonds
    const newBonds: any[] = [];
    const bondsToUpdate: any[] = [];
    
    for (const bond of corpBonds) {
      if (existingIsinSet.has(bond.isin)) {
        bondsToUpdate.push(bond);
      } else {
        newBonds.push(bond);
      }
    }
    
    let synced = 0;
    let updated = 0;
    
    // Batch insert new bonds (100 at a time)
    const batchSize = 100;
    for (let i = 0; i < newBonds.length; i += batchSize) {
      const batch = newBonds.slice(i, i + batchSize);
      const values = batch.map(bond => {
        const instrumentType = determineCorporateBondType(bond);
        const kycTier = determineKycTier(bond.creditRating);
        const isTaxFree = bond.bondType === 'tax_free_bond';
        
        return {
          source: 'bse',
          sourceId: bond.id,
          isin: bond.isin,
          bondName: bond.bondName,
          issuerName: bond.issuer,
          instrumentType,
          isListed: bond.isListed ?? true,
          exchange: 'BSE',
          faceValue: bond.faceValue,
          couponRate: bond.couponRate,
          couponFrequency: bond.couponFrequency || 'annual',
          issueDate: bond.issueDate,
          maturityDate: bond.maturityDate,
          cleanPrice: bond.currentPrice,
          yieldToMaturity: bond.yieldToMaturity,
          creditRating: bond.creditRating,
          ratingAgency: bond.ratingAgency,
          minInvestment: bond.minimumInvestment,
          lotSize: bond.minimumLotSize || 1,
          taxCategory: isTaxFree ? 'tax_free' : 'taxable',
          tdsApplicable: !isTaxFree,
          tdsRate: isTaxFree ? '0' : '10',
          feeProfileId: feeProfiles[instrumentType]?.id,
          status: 'draft' as const,
          regulatoryTier: kycTier === 'accredited' ? 'accredited' : 'enhanced',
          kycTierRequired: kycTier,
          lastSyncAt: new Date(),
          createdBy: userId,
        };
      });
      
      try {
        await db.insert(bondCatalog).values(values).onConflictDoNothing();
        synced += batch.length;
        console.log(`[BSE Sync] Batch ${Math.floor(i/batchSize) + 1}: Inserted ${batch.length} bonds`);
      } catch (err) {
        console.error(`[BSE Sync] Batch insert error:`, err);
      }
    }
    
    // Bulk update existing bonds
    for (const bond of bondsToUpdate) {
      try {
        await db.update(bondCatalog)
          .set({
            cleanPrice: bond.currentPrice,
            yieldToMaturity: bond.yieldToMaturity,
            creditRating: bond.creditRating,
            lastSyncAt: new Date(),
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(bondCatalog.isin, bond.isin));
        updated++;
      } catch (err) {
        // Ignore update errors
      }
    }
    
    // Audit log
    await db.insert(bondMarketplaceAuditLogs).values({
      userId,
      userEmail: (req as any).user?.email,
      userRole: 'admin',
      action: 'sync_bse_bonds',
      entityType: 'bond_catalog',
      entityId: 'bulk',
      afterValue: { synced, updated, total: corpBonds.length },
      changeDescription: `Synced ${synced} new bonds, updated ${updated} existing from BSE`,
      complianceRelated: false,
      riskLevel: 'low',
      ipAddress: req.ip,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
    });
    
    res.json({ 
      message: `BSE sync complete`,
      synced, 
      updated,
      total: corpBonds.length
    });
  } catch (error: any) {
    console.error("Error syncing BSE bonds:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DATA REFRESH API (Auto-refresh controls)
// ============================================

// Get data refresh status
router.get("/refresh/status", async (req: Request, res: Response) => {
  try {
    const status = bondCatalogService.getStatus();
    
    // Get bond counts by category
    const [gsecCount] = await db.select({ count: count() }).from(governmentSecurities);
    const [corpCount] = await db.select({ count: count() }).from(corporateBonds);
    const [catalogCount] = await db.select({ count: count() }).from(bondCatalog);
    const [publishedCount] = await db.select({ count: count() }).from(bondCatalog).where(eq(bondCatalog.status, 'published'));
    
    res.json({
      success: true,
      status,
      stats: {
        governmentSecurities: gsecCount?.count || 0,
        corporateBonds: corpCount?.count || 0,
        catalogTotal: catalogCount?.count || 0,
        publishedBonds: publishedCount?.count || 0
      }
    });
  } catch (error: any) {
    console.error("Error getting refresh status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh all bonds manually
router.post("/refresh/all", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    const results = await bondCatalogService.refreshAllBonds();
    
    // Audit log
    await db.insert(bondMarketplaceAuditLogs).values({
      userId,
      userEmail: (req as any).user?.email,
      userRole: 'admin',
      action: 'refresh_all_bonds',
      entityType: 'bond_catalog',
      entityId: 'bulk',
      afterValue: results,
      changeDescription: `Manual refresh: G-Sec ${results.gsec.count}, Corporate ${results.corporate.count}, SGB ${results.sgb.count}, Tax-Free ${results.taxFree.count}, Infra ${results.infrastructure.count}`,
      complianceRelated: false,
      riskLevel: 'low',
      ipAddress: req.ip,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
    });
    
    res.json({ success: true, results });
  } catch (error: any) {
    console.error("Error refreshing all bonds:", error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh G-Secs only
router.post("/refresh/gsec", async (req: Request, res: Response) => {
  try {
    const count = await bondCatalogService.refreshGovernmentSecurities();
    res.json({ success: true, count, type: 'gsec' });
  } catch (error: any) {
    console.error("Error refreshing G-Secs:", error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh SGBs only
router.post("/refresh/sgb", async (req: Request, res: Response) => {
  try {
    const count = await bondCatalogService.refreshSovereignGoldBonds();
    res.json({ success: true, count, type: 'sgb' });
  } catch (error: any) {
    console.error("Error refreshing SGBs:", error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh corporate bonds only
router.post("/refresh/corporate", async (req: Request, res: Response) => {
  try {
    const count = await bondCatalogService.refreshCorporateBonds();
    res.json({ success: true, count, type: 'corporate' });
  } catch (error: any) {
    console.error("Error refreshing corporate bonds:", error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh tax-free bonds only
router.post("/refresh/tax-free", async (req: Request, res: Response) => {
  try {
    const count = await bondCatalogService.refreshTaxFreeBonds();
    res.json({ success: true, count, type: 'tax-free' });
  } catch (error: any) {
    console.error("Error refreshing tax-free bonds:", error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh infrastructure bonds only
router.post("/refresh/infrastructure", async (req: Request, res: Response) => {
  try {
    const count = await bondCatalogService.refreshInfrastructureBonds();
    res.json({ success: true, count, type: 'infrastructure' });
  } catch (error: any) {
    console.error("Error refreshing infrastructure bonds:", error);
    res.status(500).json({ error: error.message });
  }
});

// Start scheduler
router.post("/scheduler/start", async (req: Request, res: Response) => {
  try {
    bondCatalogService.startAutoRefresh();
    res.json({ success: true, message: "Scheduler started" });
  } catch (error: any) {
    console.error("Error starting scheduler:", error);
    res.status(500).json({ error: error.message });
  }
});

// Stop scheduler
router.post("/scheduler/stop", async (req: Request, res: Response) => {
  try {
    bondCatalogService.stopAutoRefresh();
    res.json({ success: true, message: "Scheduler stopped" });
  } catch (error: any) {
    console.error("Error stopping scheduler:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add unlisted bond manually
router.post("/unlisted", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const bondData = req.body;
    
    // Validate required fields
    if (!bondData.isin || !bondData.bondName || !bondData.issuerName) {
      return res.status(400).json({ error: "ISIN, bond name, and issuer name are required" });
    }
    
    // Check for duplicate ISIN
    const existing = await db.select()
      .from(bondCatalog)
      .where(eq(bondCatalog.isin, bondData.isin))
      .limit(1);
    
    if (existing.length > 0) {
      return res.status(400).json({ error: "Bond with this ISIN already exists" });
    }
    
    // Get fee profile for unlisted bonds
    const feeProfile = await bondFeeCalibrationService.getProfileByInstrumentType('unlisted_bond');
    
    const result = await db.insert(bondCatalog).values({
      source: 'manual',
      isin: bondData.isin,
      bondName: bondData.bondName,
      issuerName: bondData.issuerName,
      instrumentType: 'unlisted_bond',
      isListed: false,
      faceValue: bondData.faceValue || '1000',
      couponRate: bondData.couponRate,
      couponFrequency: bondData.couponFrequency || 'annual',
      issueDate: bondData.issueDate,
      maturityDate: bondData.maturityDate,
      cleanPrice: bondData.cleanPrice,
      yieldToMaturity: bondData.yieldToMaturity,
      creditRating: bondData.creditRating,
      ratingAgency: bondData.ratingAgency,
      minInvestment: bondData.minInvestment,
      lotSize: bondData.lotSize || 1,
      taxCategory: bondData.taxCategory || 'taxable',
      tdsApplicable: true,
      tdsRate: '10',
      feeProfileId: feeProfile?.id,
      status: 'draft',
      regulatoryTier: 'accredited',
      kycTierRequired: 'accredited',
      createdBy: userId,
    }).returning();
    
    // Audit log
    await db.insert(bondMarketplaceAuditLogs).values({
      userId,
      userEmail: (req as any).user?.email,
      userRole: 'admin',
      action: 'create_unlisted_bond',
      entityType: 'bond_catalog',
      entityId: result[0].id,
      isin: bondData.isin,
      bondType: 'unlisted_bond',
      afterValue: bondData,
      changeDescription: `Created unlisted bond: ${bondData.bondName}`,
      complianceRelated: true,
      riskLevel: 'high',
      ipAddress: req.ip,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
    });
    
    res.status(201).json({ bond: result[0] });
  } catch (error: any) {
    console.error("Error creating unlisted bond:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update bond in catalog
router.put("/catalog/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = (req as any).user?.id;
    
    const result = await db.update(bondCatalog)
      .set({
        ...updates,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(bondCatalog.id, id))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Bond not found" });
    }
    
    res.json({ bond: result[0] });
  } catch (error: any) {
    console.error("Error updating bond:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete bond from catalog

export default router;
