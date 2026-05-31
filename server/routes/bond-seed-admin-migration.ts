// @ts-nocheck
import { Router, Request, Response } from "express";
import { db } from "../db";
import { bondCatalog } from "@shared/schema";

export const migrationRouter = Router();

// One-time migration endpoint with secret key
migrationRouter.post("/sync-bonds", async (req: Request, res: Response) => {
  const { secret, bonds } = req.body;
  
  // Verify migration secret
  const migrationSecret = process.env.MIGRATION_SECRET || 'fintekpro-bond-sync-2026';
  if (secret !== migrationSecret) {
    return res.status(403).json({ error: "Invalid migration secret" });
  }
  
  if (!bonds || !Array.isArray(bonds)) {
    return res.status(400).json({ error: "bonds array is required" });
  }
  
  console.log(`[Migration] Starting bond sync: ${bonds.length} bonds`);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const bond of bonds) {
    try {
      await db.insert(bondCatalog).values({
        id: bond.id,
        source: bond.source,
        sourceId: bond.sourceId || bond.source_id,
        isin: bond.isin,
        bondName: bond.bondName || bond.bond_name,
        issuerName: bond.issuerName || bond.issuer_name,
        instrumentType: bond.instrumentType || bond.instrument_type,
        isListed: bond.isListed ?? bond.is_listed ?? true,
        exchange: bond.exchange,
        faceValue: bond.faceValue || bond.face_value,
        couponRate: bond.couponRate || bond.coupon_rate,
        couponFrequency: bond.couponFrequency || bond.coupon_frequency,
        issueDate: bond.issueDate || bond.issue_date,
        maturityDate: bond.maturityDate || bond.maturity_date,
        cleanPrice: bond.cleanPrice || bond.clean_price,
        dirtyPrice: bond.dirtyPrice || bond.dirty_price,
        accruedInterest: bond.accruedInterest || bond.accrued_interest,
        yieldToMaturity: bond.yieldToMaturity || bond.yield_to_maturity,
        creditRating: bond.creditRating || bond.credit_rating,
        ratingAgency: bond.ratingAgency || bond.rating_agency,
        minInvestment: bond.minInvestment || bond.min_investment,
        lotSize: bond.lotSize || bond.lot_size,
        taxCategory: bond.taxCategory || bond.tax_category,
        tdsApplicable: bond.tdsApplicable ?? bond.tds_applicable ?? true,
        tdsRate: bond.tdsRate || bond.tds_rate,
        netYieldToMaturity: bond.netYieldToMaturity || bond.net_yield_to_maturity,
        status: bond.status || 'published',
        region: bond.region || 'APAC',
        country: bond.country || 'IN',
        currency: bond.currency || 'INR',
      }).onConflictDoNothing();
      inserted++;
    } catch (err: any) {
      if (err.code === '23505') {
        skipped++;
      }
    }
    
    if ((inserted + skipped) % 500 === 0) {
      console.log(`[Migration] Progress: ${inserted + skipped}/${bonds.length}`);
    }
  }
  
  console.log(`[Migration] Complete: ${inserted} inserted, ${skipped} skipped`);
  
  res.json({
    success: true,
    inserted,
    skipped,
    total: bonds.length
  });
});
