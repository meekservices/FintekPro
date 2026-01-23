import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { bondFeeProfiles, bondFeeOverrides, bondCatalog, governmentSecurities, corporateBonds, bondMarketplaceAuditLogs } from "@shared/schema";
import { bondFeeCalibrationService, REGULATORY_FEE_CAPS, type InstrumentType } from "../services/bond-fee-calibration-service";
import { bondCatalogService } from "../bond-catalog-service";
import { eq, and, desc, sql, or, ilike, count } from "drizzle-orm";

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

// Calculate net yield with detailed breakdown
router.post("/calculate-net-yield", async (req: Request, res: Response) => {
  try {
    const { 
      instrumentType, 
      grossYield, 
      transactionAmount, 
      holdingPeriodYears, 
      investorSegment, 
      taxBracket,
      feeProfileId, 
      feeOverrideId 
    } = req.body;
    
    const result = await bondFeeCalibrationService.calculateNetYield({
      instrumentType,
      grossYield: parseFloat(grossYield),
      transactionAmount: parseFloat(transactionAmount || '100000'),
      holdingPeriodYears: parseFloat(holdingPeriodYears || '1'),
      investorSegment: investorSegment || 'retail',
      taxBracket: parseFloat(taxBracket || '30'),
      feeProfileId,
      feeOverrideId
    });
    
    res.json(result);
  } catch (error: any) {
    console.error("Error calculating net yield:", error);
    res.status(400).json({ error: error.message });
  }
});

// Calculate net yield for a specific bond in catalog
router.get("/catalog/:bondId/net-yield", async (req: Request, res: Response) => {
  try {
    const { bondId } = req.params;
    const { investorSegment } = req.query;
    
    const result = await bondFeeCalibrationService.calculateNetYieldForBond(
      bondId, 
      (investorSegment as 'retail' | 'hni' | 'institutional') || 'retail'
    );
    
    if (!result) {
      return res.status(404).json({ error: "Bond not found" });
    }
    
    res.json(result);
  } catch (error: any) {
    console.error("Error calculating net yield for bond:", error);
    res.status(400).json({ error: error.message });
  }
});

// Batch calculate net yields for multiple bonds
router.post("/catalog/batch-net-yield", async (req: Request, res: Response) => {
  try {
    const { bondIds, investorSegment } = req.body;
    
    if (!Array.isArray(bondIds) || bondIds.length === 0) {
      return res.status(400).json({ error: "bondIds must be a non-empty array" });
    }
    
    const results: Record<string, any> = {};
    
    for (const bondId of bondIds) {
      const result = await bondFeeCalibrationService.calculateNetYieldForBond(
        bondId,
        investorSegment || 'retail'
      );
      if (result) {
        results[bondId] = result;
      }
    }
    
    res.json({ netYields: results });
  } catch (error: any) {
    console.error("Error batch calculating net yields:", error);
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// FEE OVERRIDES API
// ============================================

// Preview net yield with temporary override values (before saving)
router.post("/preview-override-net-yield", async (req: Request, res: Response) => {
  try {
    const { 
      instrumentType, 
      grossYield, 
      transactionAmount, 
      holdingPeriodYears, 
      investorSegment,
      platformFeeOverride,
      brokerageFeeOverride,
      transactionChargesOverride
    } = req.body;
    
    // Get base fee profile
    const profile = await bondFeeCalibrationService.getProfileByInstrumentType(instrumentType);
    const caps = REGULATORY_FEE_CAPS[instrumentType as InstrumentType];
    const violations: string[] = [];
    
    // Use override values if provided, otherwise use profile defaults
    let platformFeeRate = platformFeeOverride !== null && platformFeeOverride !== '' 
      ? parseFloat(platformFeeOverride) 
      : (profile ? parseFloat(profile.platformFeeValue || '0') : caps.maxPlatformFee * 0.5);
      
    let brokerageRate = brokerageFeeOverride !== null && brokerageFeeOverride !== ''
      ? parseFloat(brokerageFeeOverride)
      : (profile ? parseFloat(profile.brokerageFeeValue || '0') : caps.maxBrokerage * 0.5);
      
    let transactionChargesRate = transactionChargesOverride !== null && transactionChargesOverride !== ''
      ? parseFloat(transactionChargesOverride)
      : (profile ? parseFloat(profile.transactionCharges || '0') : 0);
    
    // Apply investor segment multiplier (only to defaults, not overrides)
    let segmentMultiplier = 1.0;
    if (profile && (platformFeeOverride === null || platformFeeOverride === '') && (brokerageFeeOverride === null || brokerageFeeOverride === '')) {
      switch (investorSegment) {
        case 'retail':
          segmentMultiplier = parseFloat(profile.retailMultiplier || '1.00');
          break;
        case 'hni':
          segmentMultiplier = parseFloat(profile.hniMultiplier || '1.00');
          break;
        case 'institutional':
          segmentMultiplier = parseFloat(profile.institutionalMultiplier || '0.50');
          break;
      }
      platformFeeRate *= segmentMultiplier;
      brokerageRate *= segmentMultiplier;
    }
    
    // Validate against regulatory caps
    if (brokerageRate > caps.maxBrokerage) {
      violations.push(`Brokerage ${brokerageRate.toFixed(4)}% exceeds regulatory cap of ${caps.maxBrokerage}%`);
      brokerageRate = caps.maxBrokerage;
    }
    if (platformFeeRate > caps.maxPlatformFee) {
      violations.push(`Platform fee ${platformFeeRate.toFixed(4)}% exceeds regulatory cap of ${caps.maxPlatformFee}%`);
      platformFeeRate = caps.maxPlatformFee;
    }
    
    // Calculate fees
    const gstRate = profile ? parseFloat(profile.gstRate || '18') : 18;
    const gstOnBrokeragePercent = (brokerageRate * gstRate) / 100;
    const gstOnPlatformFeePercent = (platformFeeRate * gstRate) / 100;
    const totalGstPercent = gstOnBrokeragePercent + gstOnPlatformFeePercent;
    
    let stampDutyPercent = 0;
    if (caps.stampDuty) {
      const stampDutyRate = profile ? parseFloat(profile.stampDutyRate || '0') : ((caps as any).stampDutyRate || 0);
      stampDutyPercent = stampDutyRate * 100;
    }
    
    const totalOneTimeFees = platformFeeRate + brokerageRate + transactionChargesRate + totalGstPercent + stampDutyPercent;
    const holdingYears = parseFloat(holdingPeriodYears || '1') || 1;
    const annualizedFeePercentage = holdingYears > 0 ? totalOneTimeFees / holdingYears : totalOneTimeFees;
    
    const grossYieldNum = parseFloat(grossYield || '0');
    const netYield = grossYieldNum - annualizedFeePercentage;
    
    const isTaxFree = instrumentType === 'tax_free_bond' || instrumentType === 'sgb';
    const taxBracket = 30;
    const effectiveTaxRate = isTaxFree ? 0 : taxBracket;
    const taxImpact = (netYield * effectiveTaxRate) / 100;
    const netYieldAfterTax = netYield - taxImpact;
    
    const feeImpactBps = Math.round(annualizedFeePercentage * 100);
    const taxImpactBps = Math.round(taxImpact * 100);
    
    const breakdown = {
      platformFeeAnnualized: Math.round((platformFeeRate / holdingYears) * 10000) / 10000,
      brokerageFeeAnnualized: Math.round((brokerageRate / holdingYears) * 10000) / 10000,
      transactionChargesAnnualized: Math.round((transactionChargesRate / holdingYears) * 10000) / 10000,
      gstAnnualized: Math.round((totalGstPercent / holdingYears) * 10000) / 10000,
      stampDutyAnnualized: Math.round((stampDutyPercent / holdingYears) * 10000) / 10000,
    };
    
    res.json({
      grossYield: Math.round(grossYieldNum * 10000) / 10000,
      netYield: Math.round(netYield * 10000) / 10000,
      netYieldAfterTax: Math.round(netYieldAfterTax * 10000) / 10000,
      feeImpactBps,
      taxImpactBps,
      totalImpactBps: feeImpactBps + taxImpactBps,
      annualizedFeePercentage: Math.round(annualizedFeePercentage * 10000) / 10000,
      breakdown,
      regulatoryCompliant: violations.length === 0,
      violations
    });
  } catch (error: any) {
    console.error("Error previewing override net yield:", error);
    res.status(400).json({ error: error.message });
  }
});

// Create fee override for a specific bond
router.post("/fee-overrides", async (req: Request, res: Response) => {
  try {
    const { isin, catalogId, platformFeeOverride, brokerageFeeOverride, transactionChargesOverride, overrideReason } = req.body;
    const userId = (req as any).user?.id;
    
    if (!overrideReason) {
      return res.status(400).json({ error: "Override reason is required" });
    }
    
    // Create the override
    const override = await bondFeeCalibrationService.createFeeOverride({
      isin,
      platformFeeOverride: platformFeeOverride ? parseFloat(platformFeeOverride) : undefined,
      brokerageFeeOverride: brokerageFeeOverride ? parseFloat(brokerageFeeOverride) : undefined,
      transactionChargesOverride: transactionChargesOverride ? parseFloat(transactionChargesOverride) : undefined,
      overrideReason,
      createdBy: userId,
    });
    
    // Update the bond catalog entry with the override ID
    if (catalogId && override) {
      await db.update(bondCatalog)
        .set({ feeOverrideId: override.id, updatedAt: new Date() })
        .where(eq(bondCatalog.id, catalogId));
    }
    
    // Audit log
    await db.insert(bondMarketplaceAuditLogs).values({
      userId,
      userEmail: (req as any).user?.email,
      userRole: 'admin',
      action: 'create_fee_override',
      entityType: 'fee_override',
      entityId: override?.id,
      afterValue: { isin, catalogId, platformFeeOverride, brokerageFeeOverride, transactionChargesOverride, overrideReason },
      changeDescription: `Created fee override for ${isin}`,
      complianceRelated: true,
      riskLevel: 'high',
      ipAddress: req.ip,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
    });
    
    res.json({ override });
  } catch (error: any) {
    console.error("Error creating fee override:", error);
    res.status(400).json({ error: error.message });
  }
});

// Get fee overrides for a bond
router.get("/fee-overrides/:isin", async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;
    
    const overrides = await db.select()
      .from(bondFeeOverrides)
      .where(eq(bondFeeOverrides.isin, isin))
      .orderBy(desc(bondFeeOverrides.createdAt));
    
    res.json({ overrides });
  } catch (error: any) {
    console.error("Error fetching fee overrides:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete fee override
router.delete("/fee-overrides/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    
    // Get existing override for audit
    const existing = await db.select().from(bondFeeOverrides).where(eq(bondFeeOverrides.id, id)).limit(1);
    
    if (!existing[0]) {
      return res.status(404).json({ error: "Override not found" });
    }
    
    // Delete the override
    await db.delete(bondFeeOverrides).where(eq(bondFeeOverrides.id, id));
    
    // Remove override reference from catalog
    await db.update(bondCatalog)
      .set({ feeOverrideId: null, updatedAt: new Date() })
      .where(eq(bondCatalog.feeOverrideId, id));
    
    // Audit log
    await db.insert(bondMarketplaceAuditLogs).values({
      userId,
      userEmail: (req as any).user?.email,
      userRole: 'admin',
      action: 'delete_fee_override',
      entityType: 'fee_override',
      entityId: id,
      beforeValue: existing[0],
      changeDescription: `Deleted fee override for ${existing[0].isin}`,
      complianceRelated: true,
      riskLevel: 'high',
      ipAddress: req.ip,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting fee override:", error);
    res.status(500).json({ error: error.message });
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

// ============================================
// ISIN LOOKUP AND SEED ROUTES
// ============================================

// Lookup bond details by ISIN from NSDL
router.get("/isin-lookup/:isin", async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;
    
    if (!isin || isin.length < 12) {
      return res.status(400).json({ error: "Valid ISIN required (12 characters)" });
    }
    
    const { nsdlISINService } = await import("../services/nsdl-isin-service");
    const bondData = await nsdlISINService.lookupByISIN(isin);
    
    if (!bondData) {
      return res.status(404).json({ error: "ISIN not found in NSDL database" });
    }
    
    // Check if already exists in catalog
    const existing = await db.select()
      .from(bondCatalog)
      .where(eq(bondCatalog.isin, bondData.isin.toUpperCase()))
      .limit(1);
    
    const instrumentType = nsdlISINService.determineInstrumentType(
      bondData.securityDescription, 
      bondData.issuerName
    );
    
    const maturityDate = nsdlISINService.parseMaturityDate(bondData.maturityDate);
    
    res.json({
      found: true,
      alreadyInCatalog: existing.length > 0,
      existingEntry: existing[0] || null,
      bondData: {
        isin: bondData.isin,
        issuerName: bondData.issuerName,
        securityDescription: bondData.securityDescription,
        currency: bondData.currency,
        interestRate: bondData.interestRate,
        maturityDate: maturityDate ? maturityDate.toISOString().split('T')[0] : null,
        securityType: bondData.securityType,
        instrumentType,
      }
    });
  } catch (error: any) {
    console.error("Error looking up ISIN:", error);
    res.status(500).json({ error: error.message });
  }
});

// Search ISINs by prefix
router.get("/isin-search", async (req: Request, res: Response) => {
  try {
    const { prefix, limit } = req.query;
    
    if (!prefix || (prefix as string).length < 4) {
      return res.status(400).json({ error: "ISIN prefix must be at least 4 characters" });
    }
    
    const { nsdlISINService } = await import("../services/nsdl-isin-service");
    const results = await nsdlISINService.searchByISIN(
      prefix as string, 
      parseInt(limit as string) || 20
    );
    
    res.json({ results, count: results.length });
  } catch (error: any) {
    console.error("Error searching ISINs:", error);
    res.status(500).json({ error: error.message });
  }
});

// Seed bond from ISIN - auto-fetches details from NSDL
router.post("/seed-from-isin", async (req: Request, res: Response) => {
  try {
    const { 
      isin, 
      overrides = {},
      publish = false 
    } = req.body;
    
    if (!isin || isin.length < 12) {
      return res.status(400).json({ error: "Valid ISIN required (12 characters)" });
    }
    
    const userId = (req as any).user?.id;
    const userEmail = (req as any).user?.email;
    
    // Check if already exists
    const existing = await db.select()
      .from(bondCatalog)
      .where(eq(bondCatalog.isin, isin.toUpperCase()))
      .limit(1);
    
    if (existing.length > 0) {
      return res.status(409).json({ 
        error: "Bond with this ISIN already exists in catalog",
        existingEntry: existing[0]
      });
    }
    
    // Lookup from NSDL
    const { nsdlISINService } = await import("../services/nsdl-isin-service");
    const bondData = await nsdlISINService.lookupByISIN(isin);
    
    if (!bondData) {
      return res.status(404).json({ error: "ISIN not found in NSDL database" });
    }
    
    const instrumentType = overrides.instrumentType || 
      nsdlISINService.determineInstrumentType(bondData.securityDescription, bondData.issuerName);
    
    const maturityDate = nsdlISINService.parseMaturityDate(bondData.maturityDate);
    
    // Parse coupon rate from interest rate string
    let couponRate: string | null = null;
    if (bondData.interestRate) {
      const rateMatch = bondData.interestRate.match(/(\d+\.?\d*)/);
      if (rateMatch) {
        couponRate = rateMatch[1];
      }
    }
    
    // Determine if government or corporate
    const isGovernment = ['gsec', 'tbill', 'sdl', 'sgb'].includes(instrumentType);
    
    // Create catalog entry
    const [newEntry] = await db.insert(bondCatalog).values({
      source: 'nsdl_isin',
      sourceId: bondData.isin,
      isin: bondData.isin.toUpperCase(),
      bondName: overrides.bondName || bondData.securityDescription,
      issuerName: overrides.issuerName || bondData.issuerName,
      instrumentType: instrumentType as any,
      isListed: overrides.isListed ?? true,
      exchange: overrides.exchange || null,
      faceValue: overrides.faceValue || '1000',
      couponRate: overrides.couponRate || couponRate,
      couponFrequency: overrides.couponFrequency || (isGovernment ? 'semi_annual' : 'annual'),
      maturityDate: maturityDate ? maturityDate.toISOString().split('T')[0] : overrides.maturityDate,
      cleanPrice: overrides.cleanPrice || null,
      yieldToMaturity: overrides.yieldToMaturity || null,
      creditRating: overrides.creditRating || (isGovernment ? 'Sovereign' : null),
      ratingAgency: overrides.ratingAgency || (isGovernment ? 'Government' : null),
      minInvestment: overrides.minInvestment || (isGovernment ? '10000' : '100000'),
      lotSize: overrides.lotSize || 1,
      taxCategory: isGovernment ? 'government' : 'corporate',
      tdsApplicable: !isGovernment,
      tdsRate: isGovernment ? null : '10',
      status: publish ? 'published' : 'draft',
      kycTierRequired: overrides.kycTierRequired || 'enhanced',
      publishedAt: publish ? new Date() : null,
    }).returning();
    
    // Audit log
    await db.insert(bondMarketplaceAuditLogs).values({
      userId,
      userEmail,
      userRole: 'admin',
      action: 'seed_from_isin',
      entityType: 'bond_catalog',
      entityId: newEntry.id,
      afterValue: { isin, instrumentType, bondName: newEntry.bondName },
      changeDescription: `Seeded bond from ISIN: ${isin} - ${newEntry.bondName}`,
      complianceRelated: true,
      riskLevel: 'low',
      ipAddress: req.ip,
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
    });
    
    res.json({ 
      success: true, 
      bond: newEntry,
      message: `Bond seeded successfully from ISIN: ${isin}`
    });
  } catch (error: any) {
    console.error("Error seeding bond from ISIN:", error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk seed bonds from multiple ISINs
router.post("/bulk-seed-from-isin", async (req: Request, res: Response) => {
  try {
    const { isins, publish = false } = req.body;
    
    if (!Array.isArray(isins) || isins.length === 0) {
      return res.status(400).json({ error: "Array of ISINs required" });
    }
    
    if (isins.length > 50) {
      return res.status(400).json({ error: "Maximum 50 ISINs per request" });
    }
    
    const userId = (req as any).user?.id;
    const userEmail = (req as any).user?.email;
    const { nsdlISINService } = await import("../services/nsdl-isin-service");
    
    const results = {
      success: [] as any[],
      failed: [] as { isin: string; error: string }[],
      skipped: [] as { isin: string; reason: string }[]
    };
    
    for (const isin of isins) {
      try {
        // Check if already exists
        const existing = await db.select()
          .from(bondCatalog)
          .where(eq(bondCatalog.isin, isin.toUpperCase()))
          .limit(1);
        
        if (existing.length > 0) {
          results.skipped.push({ isin, reason: 'Already exists in catalog' });
          continue;
        }
        
        // Lookup from NSDL
        const bondData = await nsdlISINService.lookupByISIN(isin);
        
        if (!bondData) {
          results.failed.push({ isin, error: 'Not found in NSDL database' });
          continue;
        }
        
        const instrumentType = nsdlISINService.determineInstrumentType(
          bondData.securityDescription, 
          bondData.issuerName
        );
        
        const maturityDate = nsdlISINService.parseMaturityDate(bondData.maturityDate);
        
        let couponRate: string | null = null;
        if (bondData.interestRate) {
          const rateMatch = bondData.interestRate.match(/(\d+\.?\d*)/);
          if (rateMatch) {
            couponRate = rateMatch[1];
          }
        }
        
        const isGovernment = ['gsec', 'tbill', 'sdl', 'sgb'].includes(instrumentType);
        
        const [newEntry] = await db.insert(bondCatalog).values({
          source: 'nsdl_isin',
          sourceId: bondData.isin,
          isin: bondData.isin.toUpperCase(),
          bondName: bondData.securityDescription,
          issuerName: bondData.issuerName,
          instrumentType: instrumentType as any,
          isListed: true,
          faceValue: '1000',
          couponRate,
          couponFrequency: isGovernment ? 'semi_annual' : 'annual',
          maturityDate: maturityDate ? maturityDate.toISOString().split('T')[0] : null,
          creditRating: isGovernment ? 'Sovereign' : null,
          ratingAgency: isGovernment ? 'Government' : null,
          minInvestment: isGovernment ? '10000' : '100000',
          lotSize: 1,
          taxCategory: isGovernment ? 'government' : 'corporate',
          tdsApplicable: !isGovernment,
          tdsRate: isGovernment ? null : '10',
          status: publish ? 'published' : 'draft',
          kycTierRequired: 'enhanced',
          publishedAt: publish ? new Date() : null,
        }).returning();
        
        results.success.push(newEntry);
        
      } catch (err: any) {
        results.failed.push({ isin, error: err.message });
      }
    }
    
    // Audit log for bulk operation
    if (results.success.length > 0) {
      await db.insert(bondMarketplaceAuditLogs).values({
        userId,
        userEmail,
        userRole: 'admin',
        action: 'bulk_seed_from_isin',
        entityType: 'bond_catalog',
        entityId: 'bulk',
        afterValue: { 
          totalRequested: isins.length,
          succeeded: results.success.length,
          failed: results.failed.length,
          skipped: results.skipped.length
        },
        changeDescription: `Bulk seeded ${results.success.length} bonds from ISINs`,
        complianceRelated: true,
        riskLevel: 'medium',
        ipAddress: req.ip,
        retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
      });
    }
    
    res.json({
      success: true,
      summary: {
        total: isins.length,
        succeeded: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length
      },
      results
    });
  } catch (error: any) {
    console.error("Error bulk seeding bonds from ISINs:", error);
    res.status(500).json({ error: error.message });
  }
});

// Refresh NSDL ISIN cache
router.post("/refresh-isin-cache", async (req: Request, res: Response) => {
  try {
    const { nsdlISINService } = await import("../services/nsdl-isin-service");
    const result = await nsdlISINService.refreshCache();
    
    res.json({
      success: true,
      recordCount: result.recordCount,
      refreshedAt: result.timestamp
    });
  } catch (error: any) {
    console.error("Error refreshing ISIN cache:", error);
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

// ============================================
// AUDIT LOGS API
// ============================================

router.get("/audit-logs", async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0', action, entityType } = req.query;
    
    const conditions = [];
    if (action) conditions.push(eq(bondMarketplaceAuditLogs.action, action as string));
    if (entityType) conditions.push(eq(bondMarketplaceAuditLogs.entityType, entityType as string));
    
    const logs = conditions.length > 0
      ? await db.select()
          .from(bondMarketplaceAuditLogs)
          .where(and(...conditions))
          .orderBy(desc(bondMarketplaceAuditLogs.createdAt))
          .limit(parseInt(limit as string))
          .offset(parseInt(offset as string))
      : await db.select()
          .from(bondMarketplaceAuditLogs)
          .orderBy(desc(bondMarketplaceAuditLogs.createdAt))
          .limit(parseInt(limit as string))
          .offset(parseInt(offset as string));
    
    const totalResult = conditions.length > 0
      ? await db.select({ count: count() }).from(bondMarketplaceAuditLogs).where(and(...conditions))
      : await db.select({ count: count() }).from(bondMarketplaceAuditLogs);
    
    res.json({ 
      logs,
      total: totalResult[0]?.count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error: any) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
