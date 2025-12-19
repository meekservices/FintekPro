import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  instrumentMaster,
  proposalHoldings,
  mutualFunds,
  bondCatalog,
  unlistedCompanies 
} from "@shared/schema";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";

const router = Router();

// Search instruments by ISIN or name (autocomplete)
router.get("/api/instruments/search", async (req: Request, res: Response) => {
  try {
    const { q, assetClass, limit = 20 } = req.query;
    
    if (!q || String(q).length < 2) {
      return res.json({ instruments: [] });
    }

    const searchTerm = `%${String(q)}%`;
    
    let whereConditions = or(
      ilike(instrumentMaster.isin, searchTerm),
      ilike(instrumentMaster.name, searchTerm),
      ilike(instrumentMaster.symbol, searchTerm),
      ilike(instrumentMaster.shortName, searchTerm)
    );

    if (assetClass) {
      whereConditions = and(
        whereConditions,
        eq(instrumentMaster.assetClass, String(assetClass))
      );
    }

    const instruments = await db.select({
      id: instrumentMaster.id,
      isin: instrumentMaster.isin,
      symbol: instrumentMaster.symbol,
      name: instrumentMaster.name,
      shortName: instrumentMaster.shortName,
      assetClass: instrumentMaster.assetClass,
      subType: instrumentMaster.subType,
      category: instrumentMaster.category,
      issuer: instrumentMaster.issuer,
      lastPrice: instrumentMaster.lastPrice,
      currency: instrumentMaster.currency,
      riskLevel: instrumentMaster.riskLevel,
      priceUpdatedAt: instrumentMaster.priceUpdatedAt,
    })
      .from(instrumentMaster)
      .where(and(whereConditions, eq(instrumentMaster.isActive, true)))
      .orderBy(instrumentMaster.name)
      .limit(Number(limit));

    res.json({ instruments });
  } catch (error: any) {
    console.error("Instrument search error:", error);
    res.status(500).json({ error: "Failed to search instruments" });
  }
});

// Get instrument by ISIN
router.get("/api/instruments/:isin", async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;
    
    const [instrument] = await db.select()
      .from(instrumentMaster)
      .where(eq(instrumentMaster.isin, isin.toUpperCase()));

    if (!instrument) {
      return res.status(404).json({ error: "Instrument not found", isin });
    }

    res.json({ instrument });
  } catch (error: any) {
    console.error("Get instrument error:", error);
    res.status(500).json({ error: "Failed to get instrument" });
  }
});

// Sync instrument master from existing data sources
router.post("/api/instruments/sync", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user || !['admin', 'superadmin'].some(r => user.roles?.includes(r))) {
      return res.status(403).json({ error: "Admin access required" });
    }

    let synced = { mutualFunds: 0, bonds: 0, unlisted: 0 };

    // Sync Mutual Funds - use schemeCode as pseudo-ISIN since MF table doesn't have ISIN
    const funds = await db.select().from(mutualFunds).limit(1000);
    for (const fund of funds) {
      if (!fund.schemeCode) continue;
      
      // Generate MF pseudo-ISIN from scheme code
      const pseudoIsin = `MF${fund.schemeCode.substring(0, 10).toUpperCase()}`;
      
      try {
        await db.insert(instrumentMaster).values({
          isin: pseudoIsin,
          symbol: fund.schemeCode,
          name: fund.schemeName,
          shortName: fund.schemeName?.substring(0, 50),
          assetClass: "mutual_fund",
          subType: null,
          category: fund.category || null,
          issuer: fund.fundHouse || null,
          lastPrice: fund.nav?.toString() || null,
          priceSource: "amfi",
          priceUpdatedAt: fund.lastUpdated || null,
          riskLevel: fund.riskLevel?.toLowerCase() || null,
          sourceTable: "mutual_funds",
          sourceId: fund.id,
          metadata: {
            schemeCode: fund.schemeCode,
            planType: fund.planType,
            crisilRating: fund.crisilRating,
          },
        }).onConflictDoUpdate({
          target: instrumentMaster.isin,
          set: {
            name: fund.schemeName,
            lastPrice: fund.nav?.toString() || null,
            priceUpdatedAt: fund.lastUpdated || null,
            updatedAt: new Date(),
          }
        });
        synced.mutualFunds++;
      } catch (e) {
        // Skip duplicates
      }
    }

    // Sync Bonds
    const bonds = await db.select().from(bondCatalog).limit(500);
    for (const bond of bonds) {
      if (!bond.isin) continue;
      
      try {
        await db.insert(instrumentMaster).values({
          isin: bond.isin,
          symbol: null,
          name: bond.bondName,
          shortName: bond.bondName?.substring(0, 50),
          assetClass: "bond",
          subType: bond.instrumentType || null,
          category: null,
          issuer: bond.issuerName || null,
          lastPrice: bond.cleanPrice?.toString() || bond.faceValue?.toString() || null,
          priceSource: bond.exchange?.toLowerCase() || null,
          faceValue: bond.faceValue?.toString() || null,
          maturityDate: bond.maturityDate ? new Date(bond.maturityDate) : null,
          creditRating: bond.creditRating || null,
          riskLevel: null,
          sourceTable: "bond_catalog",
          sourceId: bond.id,
          metadata: {
            couponRate: bond.couponRate,
            couponFrequency: bond.couponFrequency,
            exchange: bond.exchange,
          },
        }).onConflictDoUpdate({
          target: instrumentMaster.isin,
          set: {
            lastPrice: bond.cleanPrice?.toString() || bond.faceValue?.toString() || null,
            creditRating: bond.creditRating || null,
            updatedAt: new Date(),
          }
        });
        synced.bonds++;
      } catch (e) {
        // Skip duplicates
      }
    }

    // Sync Unlisted Companies (use ISIN if available, otherwise generate pseudo-ISIN)
    const unlisted = await db.select().from(unlistedCompanies).limit(200);
    for (const company of unlisted) {
      const isinToUse = company.isin || `UL${company.id.substring(0, 10).toUpperCase()}`;
      
      try {
        await db.insert(instrumentMaster).values({
          isin: isinToUse,
          symbol: null,
          name: company.name,
          shortName: company.name?.substring(0, 50),
          assetClass: "unlisted",
          subType: company.industry || null,
          sector: company.sector || null,
          issuer: company.name,
          lastPrice: company.publishedBuyPrice?.toString() || null,
          priceSource: "manual",
          riskLevel: "high",
          sourceTable: "unlisted_companies",
          sourceId: company.id,
          metadata: {
            cin: company.cin,
            listingStage: company.listingStage,
          },
        }).onConflictDoUpdate({
          target: instrumentMaster.isin,
          set: {
            lastPrice: company.publishedBuyPrice?.toString() || null,
            updatedAt: new Date(),
          }
        });
        synced.unlisted++;
      } catch (e) {
        // Skip duplicates
      }
    }

    res.json({ 
      success: true, 
      synced,
      message: `Synced ${synced.mutualFunds} MFs, ${synced.bonds} bonds, ${synced.unlisted} unlisted`
    });
  } catch (error: any) {
    console.error("Instrument sync error:", error);
    res.status(500).json({ error: error.message || "Failed to sync instruments" });
  }
});

// Get instrument master stats
router.get("/api/instruments/stats", async (req: Request, res: Response) => {
  try {
    const stats = await db.select({
      assetClass: instrumentMaster.assetClass,
      count: sql<number>`count(*)::int`,
    })
      .from(instrumentMaster)
      .where(eq(instrumentMaster.isActive, true))
      .groupBy(instrumentMaster.assetClass);

    const total = stats.reduce((sum, s) => sum + s.count, 0);

    res.json({ stats, total });
  } catch (error: any) {
    console.error("Get instrument stats error:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// ============ PROPOSAL HOLDINGS ============

// Get holdings for a proposal
router.get("/api/proposals/:proposalId/holdings", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const holdings = await db.select()
      .from(proposalHoldings)
      .where(eq(proposalHoldings.proposalId, req.params.proposalId))
      .orderBy(proposalHoldings.sortOrder, proposalHoldings.createdAt);

    res.json({ holdings });
  } catch (error: any) {
    console.error("Get holdings error:", error);
    res.status(500).json({ error: "Failed to get holdings" });
  }
});

// Batch save/update holdings for a proposal
router.post("/api/proposals/:proposalId/holdings", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { holdings } = req.body;
    const proposalId = req.params.proposalId;

    if (!Array.isArray(holdings)) {
      return res.status(400).json({ error: "Holdings must be an array" });
    }

    // Validate each holding
    const errors: string[] = [];
    const validHoldings: Array<{
      proposalId: string;
      isin: string;
      instrumentId: string | null;
      securityName: string;
      assetClass: string;
      category: string | null;
      issuer: string | null;
      quantity: string;
      buyPrice: string;
      buyDate: Date | null;
      currentPrice: string | null;
      currentValue: string | null;
      unrealizedGainLoss: string | null;
      unrealizedGainLossPercent: string | null;
      importedFrom: string;
      notes: string | null;
      sortOrder: number;
    }> = [];

    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i];
      
      if (!h.isin) {
        errors.push(`Row ${i + 1}: ISIN is required`);
        continue;
      }
      if (!h.securityName) {
        errors.push(`Row ${i + 1}: Security name is required`);
        continue;
      }
      if (!h.quantity || Number(h.quantity) <= 0) {
        errors.push(`Row ${i + 1}: Quantity must be greater than 0`);
        continue;
      }
      if (!h.buyPrice || Number(h.buyPrice) <= 0) {
        errors.push(`Row ${i + 1}: Buy price must be greater than 0`);
        continue;
      }
      if (h.buyDate && new Date(h.buyDate) > new Date()) {
        errors.push(`Row ${i + 1}: Buy date cannot be in the future`);
        continue;
      }

      // Check for duplicate ISINs
      const duplicateIndex = validHoldings.findIndex(vh => vh.isin === h.isin);
      if (duplicateIndex >= 0) {
        errors.push(`Row ${i + 1}: Duplicate ISIN ${h.isin} (already in row ${duplicateIndex + 1})`);
        continue;
      }

      validHoldings.push({
        proposalId,
        isin: h.isin.toUpperCase(),
        instrumentId: h.instrumentId || null,
        securityName: h.securityName,
        assetClass: h.assetClass || "other",
        category: h.category || null,
        issuer: h.issuer || null,
        quantity: h.quantity.toString(),
        buyPrice: h.buyPrice.toString(),
        buyDate: h.buyDate ? new Date(h.buyDate) : null,
        currentPrice: h.currentPrice?.toString() || null,
        currentValue: h.currentValue?.toString() || null,
        unrealizedGainLoss: h.unrealizedGainLoss?.toString() || null,
        unrealizedGainLossPercent: h.unrealizedGainLossPercent?.toString() || null,
        importedFrom: h.importedFrom || "manual",
        notes: h.notes || null,
        sortOrder: i,
      });
    }

    if (errors.length > 0 && validHoldings.length === 0) {
      return res.status(400).json({ error: "Validation failed", errors });
    }

    // Delete existing holdings and insert new ones (atomic replace)
    await db.transaction(async (tx) => {
      await tx.delete(proposalHoldings)
        .where(eq(proposalHoldings.proposalId, proposalId));
      
      if (validHoldings.length > 0) {
        await tx.insert(proposalHoldings).values(validHoldings);
      }
    });

    // Calculate totals
    const totalInvestment = validHoldings.reduce((sum, h) => 
      sum + (Number(h.quantity) * Number(h.buyPrice)), 0);
    const totalCurrentValue = validHoldings.reduce((sum, h) => 
      sum + (Number(h.currentValue) || (Number(h.quantity) * Number(h.buyPrice))), 0);

    res.json({ 
      success: true, 
      holdingsCount: validHoldings.length,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        totalInvestment,
        totalCurrentValue,
        gainLoss: totalCurrentValue - totalInvestment,
        gainLossPercent: totalInvestment > 0 
          ? ((totalCurrentValue - totalInvestment) / totalInvestment * 100) 
          : 0,
      }
    });
  } catch (error: any) {
    console.error("Save holdings error:", error);
    res.status(500).json({ error: error.message || "Failed to save holdings" });
  }
});

// Validate holdings (without saving)
router.post("/api/proposals/:proposalId/holdings/validate", async (req: Request, res: Response) => {
  try {
    const { holdings } = req.body;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(holdings)) {
      return res.status(400).json({ error: "Holdings must be an array" });
    }

    const isinSet = new Set<string>();

    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i];
      const rowNum = i + 1;

      // Required field validation
      if (!h.isin) errors.push(`Row ${rowNum}: ISIN is required`);
      if (!h.securityName) errors.push(`Row ${rowNum}: Security name is required`);
      if (!h.quantity || Number(h.quantity) <= 0) errors.push(`Row ${rowNum}: Quantity must be > 0`);
      if (!h.buyPrice || Number(h.buyPrice) <= 0) errors.push(`Row ${rowNum}: Buy price must be > 0`);

      // Date validation
      if (h.buyDate && new Date(h.buyDate) > new Date()) {
        errors.push(`Row ${rowNum}: Buy date cannot be in the future`);
      }

      // Duplicate check
      if (h.isin) {
        const normalizedIsin = h.isin.toUpperCase();
        if (isinSet.has(normalizedIsin)) {
          errors.push(`Row ${rowNum}: Duplicate ISIN ${normalizedIsin}`);
        }
        isinSet.add(normalizedIsin);

        // Verify ISIN exists in instrument master
        const [instrument] = await db.select({ id: instrumentMaster.id })
          .from(instrumentMaster)
          .where(eq(instrumentMaster.isin, normalizedIsin));
        
        if (!instrument) {
          warnings.push(`Row ${rowNum}: ISIN ${normalizedIsin} not found in instrument database`);
        }
      }
    }

    res.json({
      valid: errors.length === 0,
      errors,
      warnings,
      holdingsCount: holdings.length,
    });
  } catch (error: any) {
    console.error("Validate holdings error:", error);
    res.status(500).json({ error: "Failed to validate holdings" });
  }
});

// Compute valuation for holdings
router.post("/api/valuation/compute", async (req: Request, res: Response) => {
  try {
    const { holdings } = req.body;

    if (!Array.isArray(holdings)) {
      return res.status(400).json({ error: "Holdings must be an array" });
    }

    const valuedHoldings = [];

    for (const h of holdings) {
      if (!h.isin || !h.quantity) continue;

      // Look up current price
      const [instrument] = await db.select({
        lastPrice: instrumentMaster.lastPrice,
        priceUpdatedAt: instrumentMaster.priceUpdatedAt,
      })
        .from(instrumentMaster)
        .where(eq(instrumentMaster.isin, h.isin.toUpperCase()));

      const quantity = Number(h.quantity);
      const buyPrice = Number(h.buyPrice) || 0;
      const currentPrice = instrument?.lastPrice ? Number(instrument.lastPrice) : buyPrice;
      const investmentValue = quantity * buyPrice;
      const currentValue = quantity * currentPrice;
      const unrealizedGainLoss = currentValue - investmentValue;
      const unrealizedGainLossPercent = investmentValue > 0 
        ? (unrealizedGainLoss / investmentValue * 100) 
        : 0;

      valuedHoldings.push({
        ...h,
        currentPrice,
        currentValue,
        unrealizedGainLoss,
        unrealizedGainLossPercent,
        priceUpdatedAt: instrument?.priceUpdatedAt,
      });
    }

    const totalInvestment = valuedHoldings.reduce((sum, h) => 
      sum + (Number(h.quantity) * Number(h.buyPrice)), 0);
    const totalCurrentValue = valuedHoldings.reduce((sum, h) => 
      sum + Number(h.currentValue), 0);

    res.json({
      holdings: valuedHoldings,
      summary: {
        totalInvestment,
        totalCurrentValue,
        totalGainLoss: totalCurrentValue - totalInvestment,
        totalGainLossPercent: totalInvestment > 0 
          ? ((totalCurrentValue - totalInvestment) / totalInvestment * 100) 
          : 0,
        holdingsCount: valuedHoldings.length,
      }
    });
  } catch (error: any) {
    console.error("Compute valuation error:", error);
    res.status(500).json({ error: "Failed to compute valuation" });
  }
});

export default router;
