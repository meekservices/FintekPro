import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { bondFeeProfiles, bondFeeOverrides, bondCatalog, governmentSecurities, corporateBonds, bondMarketplaceAuditLogs } from "@shared/schema";
import { bondFeeCalibrationService, REGULATORY_FEE_CAPS, type InstrumentType } from "../services/bond-fee-calibration-service";
import { eq, and, desc, sql, or, ilike } from "drizzle-orm";

const router = Router();

// Admin authentication middleware
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const roles = user.roles || [];
  if (!roles.includes('admin') && !roles.includes('superadmin')) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

// Apply admin auth to all routes
router.use(requireAdmin);

// ============================================
// FEE PROFILES API
// ============================================

// Get all fee profiles with regulatory caps
router.get("/fee-profiles", async (req: Request, res: Response) => {
  try {
    // Initialize default profiles if not exist
    await bondFeeCalibrationService.initializeDefaultProfiles();
    
    const profiles = await bondFeeCalibrationService.getAllProfiles();
    const regulatoryCaps = bondFeeCalibrationService.getRegulatoryCaps();
    
    res.json({ 
      profiles, 
      regulatoryCaps,
      gstRate: 18 // Standard GST rate
    });
  } catch (error: any) {
    console.error("Error fetching fee profiles:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update fee profile
router.put("/fee-profiles/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = (req as any).user?.id;
    
    const updated = await bondFeeCalibrationService.updateProfile(id, updates, userId);
    
    if (!updated) {
      return res.status(404).json({ error: "Fee profile not found" });
    }
    
    // Audit log
    await db.insert(bondMarketplaceAuditLogs).values({
      userId,
      userEmail: (req as any).user?.email,
      userRole: 'admin',
      action: 'update_fee_profile',
      entityType: 'fee_profile',
      entityId: id,
      afterValue: updates,
      changeDescription: `Updated fee profile for ${updated.instrumentType}`,
      complianceRelated: true,
      riskLevel: 'medium',
      ipAddress: req.ip,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
    });
    
    res.json({ profile: updated });
  } catch (error: any) {
    console.error("Error updating fee profile:", error);
    res.status(400).json({ error: error.message });
  }
});

// Calculate fees for preview
router.post("/calculate-fees", async (req: Request, res: Response) => {
  try {
    const { instrumentType, transactionAmount, grossYield, investorSegment, transactionType, feeProfileId, feeOverrideId } = req.body;
    
    const breakdown = await bondFeeCalibrationService.calculateFees({
      instrumentType,
      transactionAmount: parseFloat(transactionAmount),
      grossYield: parseFloat(grossYield),
      investorSegment: investorSegment || 'retail',
      transactionType: transactionType || 'buy',
      feeProfileId,
      feeOverrideId
    });
    
    res.json(breakdown);
  } catch (error: any) {
    console.error("Error calculating fees:", error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// BOND CATALOG API (Draft/Publish Workflow)
// ============================================

// Get all bonds in catalog (with filters)
router.get("/catalog", async (req: Request, res: Response) => {
  try {
    const { status, instrumentType, source, isListed } = req.query;
    
    let query = db.select().from(bondCatalog);
    
    // Build where conditions
    const conditions = [];
    if (status) conditions.push(eq(bondCatalog.status, status as string));
    if (instrumentType) conditions.push(eq(bondCatalog.instrumentType, instrumentType as string));
    if (source) conditions.push(eq(bondCatalog.source, source as string));
    if (isListed !== undefined) conditions.push(eq(bondCatalog.isListed, isListed === 'true'));
    
    const results = conditions.length > 0 
      ? await query.where(and(...conditions)).orderBy(desc(bondCatalog.createdAt))
      : await query.orderBy(desc(bondCatalog.createdAt));
    
    res.json({ bonds: results });
  } catch (error: any) {
    console.error("Error fetching bond catalog:", error);
    res.status(500).json({ error: error.message });
  }
});

// Sync bonds from NSE
router.post("/sync/nse", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    // Fetch existing government securities from our database
    const gsecs = await db.select().from(governmentSecurities);
    
    let synced = 0;
    let updated = 0;
    
    for (const gsec of gsecs) {
      // Check if already in catalog
      const existing = await db.select()
        .from(bondCatalog)
        .where(eq(bondCatalog.isin, gsec.isin))
        .limit(1);
      
      const instrumentType = determineGSecType(gsec);
      const feeProfile = await bondFeeCalibrationService.getProfileByInstrumentType(instrumentType);
      
      if (existing.length === 0) {
        // Insert new
        await db.insert(bondCatalog).values({
          source: 'nse',
          sourceId: gsec.id,
          isin: gsec.isin,
          bondName: gsec.securityName,
          issuerName: gsec.issuer || 'Government of India',
          instrumentType,
          isListed: true,
          exchange: 'NSE',
          faceValue: gsec.faceValue,
          couponRate: gsec.couponRate,
          couponFrequency: 'semi_annual',
          issueDate: gsec.issueDate,
          maturityDate: gsec.maturityDate,
          cleanPrice: gsec.currentPrice,
          yieldToMaturity: gsec.yieldToMaturity,
          creditRating: 'SOV', // Sovereign rating
          ratingAgency: 'Sovereign',
          minInvestment: gsec.minimumInvestment,
          lotSize: 1,
          taxCategory: 'taxable',
          tdsApplicable: true,
          tdsRate: '10',
          feeProfileId: feeProfile?.id,
          status: 'draft',
          regulatoryTier: 'basic',
          kycTierRequired: 'basic',
          lastSyncAt: new Date(),
          createdBy: userId,
        });
        synced++;
      } else {
        // Update existing
        await db.update(bondCatalog)
          .set({
            cleanPrice: gsec.currentPrice,
            yieldToMaturity: gsec.yieldToMaturity,
            lastSyncAt: new Date(),
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(bondCatalog.id, existing[0].id));
        updated++;
      }
    }
    
    // Audit log
    await db.insert(bondMarketplaceAuditLogs).values({
      userId,
      userEmail: (req as any).user?.email,
      userRole: 'admin',
      action: 'sync_nse_bonds',
      entityType: 'bond_catalog',
      entityId: 'bulk',
      afterValue: { synced, updated, total: gsecs.length },
      changeDescription: `Synced ${synced} new bonds, updated ${updated} existing from NSE`,
      complianceRelated: false,
      riskLevel: 'low',
      ipAddress: req.ip,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
    });
    
    res.json({ 
      message: `NSE sync complete`,
      synced, 
      updated,
      total: gsecs.length
    });
  } catch (error: any) {
    console.error("Error syncing NSE bonds:", error);
    res.status(500).json({ error: error.message });
  }
});

// Sync bonds from BSE
router.post("/sync/bse", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    // Fetch corporate bonds from our database
    const corpBonds = await db.select().from(corporateBonds);
    
    let synced = 0;
    let updated = 0;
    
    for (const bond of corpBonds) {
      // Check if already in catalog
      const existing = await db.select()
        .from(bondCatalog)
        .where(eq(bondCatalog.isin, bond.isin))
        .limit(1);
      
      const instrumentType = determineCorporateBondType(bond);
      const feeProfile = await bondFeeCalibrationService.getProfileByInstrumentType(instrumentType);
      
      // Determine KYC tier based on credit rating
      const kycTier = determineKycTier(bond.creditRating);
      
      // Determine tax status based on bond type
      const isTaxFree = bond.bondType === 'tax_free_bond';
      
      if (existing.length === 0) {
        await db.insert(bondCatalog).values({
          source: 'bse',
          sourceId: bond.id,
          isin: bond.isin,
          bondName: bond.bondName,
          issuerName: bond.issuer,
          instrumentType,
          isListed: true,
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
          feeProfileId: feeProfile?.id,
          status: 'draft',
          regulatoryTier: kycTier === 'accredited' ? 'accredited' : 'enhanced',
          kycTierRequired: kycTier,
          lastSyncAt: new Date(),
          createdBy: userId,
        });
        synced++;
      } else {
        await db.update(bondCatalog)
          .set({
            cleanPrice: bond.currentPrice,
            yieldToMaturity: bond.yieldToMaturity,
            creditRating: bond.creditRating,
            lastSyncAt: new Date(),
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(bondCatalog.id, existing[0].id));
        updated++;
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
router.delete("/catalog/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    const bond = await db.select().from(bondCatalog).where(eq(bondCatalog.id, id)).limit(1);
    
    if (bond.length === 0) {
      return res.status(404).json({ error: "Bond not found" });
    }
    
    // Only allow deleting unlisted/manual bonds in draft status
    if (bond[0].source !== 'manual') {
      return res.status(400).json({ error: "Cannot delete synced bonds. Use unpublish instead." });
    }
    
    if (bond[0].status === 'published') {
      return res.status(400).json({ error: "Cannot delete published bonds. Unpublish first." });
    }
    
    await db.delete(bondCatalog).where(eq(bondCatalog.id, id));
    
    // Audit log
    await db.insert(bondMarketplaceAuditLogs).values({
      userId,
      userEmail: (req as any).user?.email,
      userRole: 'admin',
      action: 'delete_bond',
      entityType: 'bond_catalog',
      entityId: id,
      isin: bond[0].isin,
      bondType: bond[0].instrumentType,
      beforeValue: bond[0],
      changeDescription: `Deleted bond: ${bond[0].bondName}`,
      complianceRelated: true,
      riskLevel: 'high',
      ipAddress: req.ip,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
    });
    
    res.json({ message: "Bond deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting bond:", error);
    res.status(500).json({ error: error.message });
  }
});

// Publish bond (with fee validation)
router.post("/catalog/:id/publish", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { feeOverride } = req.body;
    const userId = (req as any).user?.id;
    
    const bond = await db.select().from(bondCatalog).where(eq(bondCatalog.id, id)).limit(1);
    
    if (bond.length === 0) {
      return res.status(404).json({ error: "Bond not found" });
    }
    
    if (bond[0].status === 'published') {
      return res.status(400).json({ error: "Bond is already published" });
    }
    
    // Validate fees before publishing
    const feeProfile = await bondFeeCalibrationService.getProfileByInstrumentType(bond[0].instrumentType as InstrumentType);
    
    if (!feeProfile) {
      return res.status(400).json({ error: "No fee profile configured for this instrument type" });
    }
    
    // Create fee override if provided
    let feeOverrideId = bond[0].feeOverrideId;
    if (feeOverride && (feeOverride.platformFee || feeOverride.brokerage)) {
      const override = await bondFeeCalibrationService.createFeeOverride({
        isin: bond[0].isin,
        platformFeeOverride: feeOverride.platformFee,
        brokerageFeeOverride: feeOverride.brokerage,
        transactionChargesOverride: feeOverride.transactionCharges,
        overrideReason: feeOverride.reason || 'Admin override at publish',
        createdBy: userId,
      });
      feeOverrideId = override.id;
    }
    
    // Calculate net yield
    const transactionAmount = parseFloat(bond[0].cleanPrice || bond[0].faceValue || '1000');
    const grossYield = parseFloat(bond[0].yieldToMaturity || '0');
    
    const feeBreakdown = await bondFeeCalibrationService.calculateFees({
      instrumentType: bond[0].instrumentType as InstrumentType,
      transactionAmount,
      grossYield,
      investorSegment: 'retail',
      transactionType: 'buy',
      feeProfileId: feeProfile.id,
      feeOverrideId: feeOverrideId || undefined,
    });
    
    // Validate fees are within regulatory caps
    const instType = bond[0].instrumentType as InstrumentType;
    const regulatoryCap = REGULATORY_FEE_CAPS[instType];
    if (regulatoryCap) {
      const brokerageRate = feeBreakdown.brokerageFee / transactionAmount * 100;
      if (brokerageRate > regulatoryCap.maxBrokerage) {
        return res.status(400).json({ 
          error: `Brokerage rate ${brokerageRate.toFixed(4)}% exceeds regulatory cap of ${regulatoryCap.maxBrokerage}% for ${instType}`,
          regulatoryViolation: true 
        });
      }
    }
    
    // Update bond status to published
    const result = await db.update(bondCatalog)
      .set({
        status: 'published',
        publishedAt: new Date(),
        publishedBy: userId,
        feeOverrideId,
        netYieldToMaturity: String(feeBreakdown.netYield),
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(bondCatalog.id, id))
      .returning();
    
    // Audit log
    await db.insert(bondMarketplaceAuditLogs).values({
      userId,
      userEmail: (req as any).user?.email,
      userRole: 'admin',
      action: 'publish_bond',
      entityType: 'bond_catalog',
      entityId: id,
      isin: bond[0].isin,
      bondType: bond[0].instrumentType,
      beforeValue: { status: bond[0].status },
      afterValue: { status: 'published', feeBreakdown },
      changeDescription: `Published bond: ${bond[0].bondName} with net yield ${feeBreakdown.netYield}%`,
      complianceRelated: true,
      riskLevel: 'medium',
      ipAddress: req.ip,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
    });
    
    res.json({ 
      bond: result[0],
      feeBreakdown
    });
  } catch (error: any) {
    console.error("Error publishing bond:", error);
    res.status(500).json({ error: error.message });
  }
});

// Unpublish bond
router.post("/catalog/:id/unpublish", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.id;
    
    const bond = await db.select().from(bondCatalog).where(eq(bondCatalog.id, id)).limit(1);
    
    if (bond.length === 0) {
      return res.status(404).json({ error: "Bond not found" });
    }
    
    if (bond[0].status !== 'published') {
      return res.status(400).json({ error: "Bond is not published" });
    }
    
    const result = await db.update(bondCatalog)
      .set({
        status: 'unpublished',
        unpublishedAt: new Date(),
        unpublishedBy: userId,
        unpublishReason: reason,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(eq(bondCatalog.id, id))
      .returning();
    
    // Audit log
    await db.insert(bondMarketplaceAuditLogs).values({
      userId,
      userEmail: (req as any).user?.email,
      userRole: 'admin',
      action: 'unpublish_bond',
      entityType: 'bond_catalog',
      entityId: id,
      isin: bond[0].isin,
      bondType: bond[0].instrumentType,
      beforeValue: { status: 'published' },
      afterValue: { status: 'unpublished', reason },
      changeDescription: `Unpublished bond: ${bond[0].bondName}. Reason: ${reason || 'Not specified'}`,
      complianceRelated: true,
      riskLevel: 'medium',
      ipAddress: req.ip,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
    });
    
    res.json({ bond: result[0] });
  } catch (error: any) {
    console.error("Error unpublishing bond:", error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk publish
router.post("/catalog/bulk-publish", async (req: Request, res: Response) => {
  try {
    const { bondIds } = req.body;
    const userId = (req as any).user?.id;
    
    if (!bondIds || !Array.isArray(bondIds) || bondIds.length === 0) {
      return res.status(400).json({ error: "Bond IDs array is required" });
    }
    
    let published = 0;
    let failed = 0;
    const errors: string[] = [];
    
    for (const id of bondIds) {
      try {
        const bond = await db.select().from(bondCatalog).where(eq(bondCatalog.id, id)).limit(1);
        
        if (bond.length === 0 || bond[0].status === 'published') {
          continue;
        }
        
        // Validate fees before publishing
        const instType = bond[0].instrumentType as InstrumentType;
        const feeProfile = await bondFeeCalibrationService.getProfileByInstrumentType(instType);
        
        if (!feeProfile) {
          failed++;
          errors.push(`${bond[0].isin}: No fee profile configured`);
          continue;
        }
        
        const transactionAmount = parseFloat(bond[0].cleanPrice || bond[0].faceValue || '1000');
        const grossYield = parseFloat(bond[0].yieldToMaturity || '0');
        
        const feeBreakdown = await bondFeeCalibrationService.calculateFees({
          instrumentType: instType,
          transactionAmount,
          grossYield,
          investorSegment: 'retail',
          transactionType: 'buy',
          feeProfileId: feeProfile.id,
        });
        
        // Validate regulatory caps
        const regulatoryCap = REGULATORY_FEE_CAPS[instType];
        if (regulatoryCap) {
          const brokerageRate = feeBreakdown.brokerageFee / transactionAmount * 100;
          if (brokerageRate > regulatoryCap.maxBrokerage) {
            failed++;
            errors.push(`${bond[0].isin}: Brokerage ${brokerageRate.toFixed(4)}% exceeds cap ${regulatoryCap.maxBrokerage}%`);
            continue;
          }
        }
        
        await db.update(bondCatalog)
          .set({
            status: 'published',
            publishedAt: new Date(),
            publishedBy: userId,
            netYieldToMaturity: String(feeBreakdown.netYield),
            updatedAt: new Date(),
          })
          .where(eq(bondCatalog.id, id));
        
        published++;
      } catch (err: any) {
        failed++;
        errors.push(`${id}: ${err.message}`);
      }
    }
    
    // Audit log
    await db.insert(bondMarketplaceAuditLogs).values({
      userId,
      userEmail: (req as any).user?.email,
      userRole: 'admin',
      action: 'bulk_publish_bonds',
      entityType: 'bond_catalog',
      entityId: 'bulk',
      afterValue: { published, failed, total: bondIds.length },
      changeDescription: `Bulk published ${published} bonds`,
      complianceRelated: true,
      riskLevel: 'medium',
      ipAddress: req.ip,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
    });
    
    res.json({ published, failed, errors });
  } catch (error: any) {
    console.error("Error bulk publishing:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get catalog stats
router.get("/catalog/stats", async (req: Request, res: Response) => {
  try {
    const stats = await db.select({
      status: bondCatalog.status,
      instrumentType: bondCatalog.instrumentType,
      count: sql<number>`count(*)::int`,
    })
    .from(bondCatalog)
    .groupBy(bondCatalog.status, bondCatalog.instrumentType);
    
    // Aggregate stats
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    
    for (const row of stats) {
      byStatus[row.status] = (byStatus[row.status] || 0) + row.count;
      byType[row.instrumentType] = (byType[row.instrumentType] || 0) + row.count;
    }
    
    res.json({ byStatus, byType, detailed: stats });
  } catch (error: any) {
    console.error("Error fetching catalog stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function determineGSecType(gsec: any): InstrumentType {
  const secType = gsec.securityType?.toLowerCase() || '';
  const name = gsec.securityName?.toLowerCase() || '';
  
  if (secType === 't_bill' || secType === 'tbill' || name.includes('t-bill') || name.includes('treasury bill')) {
    return 'tbill';
  }
  if (secType === 'sdl' || name.includes('sdl') || name.includes('state development')) {
    return 'sdl';
  }
  if (secType === 'sgb' || name.includes('gold') || name.includes('sovereign gold')) {
    return 'sgb';
  }
  if (secType === 'tax_free_bond' || name.includes('tax free')) {
    return 'tax_free_bond';
  }
  if (secType === 'infrastructure_bond' || name.includes('infrastructure')) {
    return 'infrastructure_bond';
  }
  return 'gsec';
}

function determineCorporateBondType(bond: any): InstrumentType {
  const bondType = bond.bondType?.toLowerCase() || '';
  const name = bond.bondName?.toLowerCase() || '';
  
  if (bondType === 'ncd' || name.includes('ncd') || name.includes('non-convertible')) {
    return 'ncd';
  }
  if (bondType === 'tax_free_bond' || name.includes('tax free')) {
    return 'tax_free_bond';
  }
  if (bondType === 'infrastructure_bond' || bondType === 'infrastructure' || name.includes('infrastructure')) {
    return 'infrastructure_bond';
  }
  return 'corporate_bond';
}

function determineKycTier(creditRating: string | null): 'basic' | 'enhanced' | 'accredited' {
  if (!creditRating) return 'enhanced';
  
  const rating = creditRating.toUpperCase();
  
  // Investment grade (AAA to BBB-) = Enhanced KYC
  if (['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-'].includes(rating)) {
    return 'enhanced';
  }
  
  // Below investment grade = Accredited investor only
  return 'accredited';
}

export default router;
