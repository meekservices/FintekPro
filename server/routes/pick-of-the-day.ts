import { Router, Request, Response, NextFunction } from "express";
import { pickOfTheDayService, PickCategory } from "../services/pick-of-the-day-service";
import { db } from "../db";
import { dailyPicks, listedStocks, mutualFunds, bondCatalog, unlistedCompanies, globalInstruments, instrumentMaster, sgbPrimaryIssues } from "@shared/schema";
import { eq, like, or, sql, desc, and } from "drizzle-orm";

const router = Router();

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as any).user) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  next();
};

router.get("/today", async (req, res) => {
  try {
    let picks = await pickOfTheDayService.getTodaysPicks();
    
    if (picks.length === 0) {
      picks = await pickOfTheDayService.generateDailyPicks();
    }
    
    res.json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      picks,
    });
  } catch (error) {
    console.error("[API] Error fetching today's picks:", error);
    res.status(500).json({ success: false, error: "Failed to fetch picks" });
  }
});

router.get("/live", async (req, res) => {
  try {
    const picks = await pickOfTheDayService.getLivePicks();
    res.json({
      success: true,
      count: picks.length,
      picks,
    });
  } catch (error) {
    console.error("[API] Error fetching live picks:", error);
    res.status(500).json({ success: false, error: "Failed to fetch live picks" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const category = req.query.category as PickCategory | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const picks = await pickOfTheDayService.getPickHistory(category, limit);
    res.json({
      success: true,
      count: picks.length,
      picks,
    });
  } catch (error) {
    console.error("[API] Error fetching pick history:", error);
    res.status(500).json({ success: false, error: "Failed to fetch history" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const stats = await pickOfTheDayService.getPerformanceStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[API] Error fetching pick stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const picks = await pickOfTheDayService.generateDailyPicks();
    res.json({
      success: true,
      message: `Generated ${picks.length} picks`,
      picks,
    });
  } catch (error) {
    console.error("[API] Error generating picks:", error);
    res.status(500).json({ success: false, error: "Failed to generate picks" });
  }
});

router.post("/update-statuses", async (req, res) => {
  try {
    const result = await pickOfTheDayService.updatePickStatuses();
    res.json({
      success: true,
      message: `Updated ${result.updated} picks`,
      details: result.details,
    });
  } catch (error) {
    console.error("[API] Error updating pick statuses:", error);
    res.status(500).json({ success: false, error: "Failed to update statuses" });
  }
});

router.get("/admin/list", requireAuth, async (req, res) => {
  try {
    const { category, status, limit = "50" } = req.query;
    
    let query = db.select().from(dailyPicks).orderBy(desc(dailyPicks.recoDate), desc(dailyPicks.id));
    
    const conditions = [];
    if (category && category !== "all") {
      conditions.push(eq(dailyPicks.category, category as any));
    }
    if (status && status !== "all") {
      conditions.push(eq(dailyPicks.status, status as any));
    }
    
    const picks = await db.select()
      .from(dailyPicks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dailyPicks.recoDate), desc(dailyPicks.id))
      .limit(parseInt(limit as string));
    
    res.json({ success: true, picks });
  } catch (error) {
    console.error("[API] Error listing picks:", error);
    res.status(500).json({ success: false, error: "Failed to list picks" });
  }
});

router.get("/admin/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [pick] = await db.select().from(dailyPicks).where(eq(dailyPicks.id, parseInt(id)));
    
    if (!pick) {
      return res.status(404).json({ success: false, error: "Pick not found" });
    }
    
    res.json({ success: true, pick });
  } catch (error) {
    console.error("[API] Error fetching pick:", error);
    res.status(500).json({ success: false, error: "Failed to fetch pick" });
  }
});

router.post("/admin/create", requireAuth, async (req, res) => {
  try {
    const { 
      category, instrumentId, instrumentName, isin, symbol, market,
      recoPrice, targetPrice, stoplossPrice, expiryDate,
      rationale, riskLevel, suitableFor, keyMetrics 
    } = req.body;
    
    const recoDate = new Date().toISOString().split('T')[0];
    
    const [newPick] = await db.insert(dailyPicks).values({
      category,
      instrumentId,
      instrumentName,
      isin,
      symbol,
      market,
      recoDate,
      recoPrice: recoPrice.toString(),
      targetPrice: targetPrice.toString(),
      stoplossPrice: stoplossPrice.toString(),
      currentPrice: recoPrice.toString(),
      expiryDate,
      rationale,
      riskLevel: riskLevel || 'medium',
      suitableFor: suitableFor || ['Balanced'],
      keyMetrics: keyMetrics || {},
      generatedBy: 'manual',
    }).returning();
    
    res.json({ success: true, pick: newPick });
  } catch (error) {
    console.error("[API] Error creating pick:", error);
    res.status(500).json({ success: false, error: "Failed to create pick" });
  }
});

router.patch("/admin/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    if (updates.recoPrice) updates.recoPrice = updates.recoPrice.toString();
    if (updates.targetPrice) updates.targetPrice = updates.targetPrice.toString();
    if (updates.stoplossPrice) updates.stoplossPrice = updates.stoplossPrice.toString();
    if (updates.currentPrice) updates.currentPrice = updates.currentPrice.toString();
    
    const [updated] = await db.update(dailyPicks)
      .set(updates)
      .where(eq(dailyPicks.id, parseInt(id)))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ success: false, error: "Pick not found" });
    }
    
    res.json({ success: true, pick: updated });
  } catch (error) {
    console.error("[API] Error updating pick:", error);
    res.status(500).json({ success: false, error: "Failed to update pick" });
  }
});

router.delete("/admin/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const [deleted] = await db.delete(dailyPicks)
      .where(eq(dailyPicks.id, parseInt(id)))
      .returning();
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: "Pick not found" });
    }
    
    res.json({ success: true, message: "Pick deleted" });
  } catch (error) {
    console.error("[API] Error deleting pick:", error);
    res.status(500).json({ success: false, error: "Failed to delete pick" });
  }
});

router.get("/search/products", requireAuth, async (req, res) => {
  try {
    const { q, category } = req.query;
    const searchTerm = `%${q}%`;
    const results: any[] = [];
    
    switch (category) {
      case 'listed_stocks':
        const stockResults = await db.select({
          id: listedStocks.id,
          name: listedStocks.companyName,
          symbol: listedStocks.symbol,
          isin: listedStocks.isin,
          price: listedStocks.currentPrice,
          sector: listedStocks.sector,
        })
        .from(listedStocks)
        .where(or(
          sql`${listedStocks.companyName} ILIKE ${searchTerm}`,
          sql`${listedStocks.symbol} ILIKE ${searchTerm}`,
          sql`${listedStocks.isin} ILIKE ${searchTerm}`
        ))
        .limit(20);
        results.push(...stockResults.map(s => ({ ...s, type: 'listed_stocks' })));
        break;
        
      case 'mutual_funds':
        const mfResults = await db.select({
          id: mutualFunds.schemeCode,
          name: mutualFunds.schemeName,
          symbol: mutualFunds.schemeCode,
          price: mutualFunds.nav,
          fundHouse: mutualFunds.fundHouse,
        })
        .from(mutualFunds)
        .where(sql`${mutualFunds.schemeName} ILIKE ${searchTerm}`)
        .limit(20);
        results.push(...mfResults.map(m => ({ ...m, type: 'mutual_funds' })));
        break;
        
      case 'bonds':
        const bondResults = await db.select({
          id: bondCatalog.id,
          name: bondCatalog.name,
          isin: bondCatalog.isin,
          price: bondCatalog.cleanPrice,
          issuer: bondCatalog.issuerName,
          couponRate: bondCatalog.couponRate,
        })
        .from(bondCatalog)
        .where(or(
          sql`${bondCatalog.name} ILIKE ${searchTerm}`,
          sql`${bondCatalog.isin} ILIKE ${searchTerm}`,
          sql`${bondCatalog.issuerName} ILIKE ${searchTerm}`
        ))
        .limit(20);
        results.push(...bondResults.map(b => ({ ...b, type: 'bonds' })));
        break;
        
      case 'global_stocks':
        const globalResults = await db.select({
          id: globalInstruments.id,
          name: globalInstruments.name,
          symbol: globalInstruments.symbol,
          price: globalInstruments.lastPrice,
          exchange: globalInstruments.exchange,
          market: globalInstruments.market,
        })
        .from(globalInstruments)
        .where(or(
          sql`${globalInstruments.name} ILIKE ${searchTerm}`,
          sql`${globalInstruments.symbol} ILIKE ${searchTerm}`
        ))
        .limit(20);
        results.push(...globalResults.map(g => ({ ...g, type: 'global_stocks' })));
        break;
        
      case 'etfs':
        const etfResults = await db.select({
          id: instrumentMaster.id,
          name: instrumentMaster.name,
          symbol: instrumentMaster.symbol,
          isin: instrumentMaster.isin,
          price: instrumentMaster.lastPrice,
          issuer: instrumentMaster.issuer,
        })
        .from(instrumentMaster)
        .where(and(
          eq(instrumentMaster.category, 'ETF'),
          or(
            sql`${instrumentMaster.name} ILIKE ${searchTerm}`,
            sql`${instrumentMaster.symbol} ILIKE ${searchTerm}`
          )
        ))
        .limit(20);
        results.push(...etfResults.map(e => ({ ...e, type: 'etfs' })));
        break;
        
      case 'sgb':
        const sgbResults = await db.select({
          id: sgbPrimaryIssues.id,
          name: sgbPrimaryIssues.seriesName,
          maturityDate: sgbPrimaryIssues.maturityDate,
        })
        .from(sgbPrimaryIssues)
        .where(sql`${sgbPrimaryIssues.seriesName} ILIKE ${searchTerm}`)
        .limit(20);
        results.push(...sgbResults.map(s => ({ ...s, type: 'sgb' })));
        break;
        
      case 'unlisted':
        const unlistedResults = await db.select({
          id: unlistedCompanies.id,
          name: unlistedCompanies.companyName,
          isin: unlistedCompanies.isin,
          price: unlistedCompanies.publishedBuyPrice,
          sector: unlistedCompanies.sectorCategory,
        })
        .from(unlistedCompanies)
        .where(or(
          sql`${unlistedCompanies.companyName} ILIKE ${searchTerm}`,
          sql`${unlistedCompanies.isin} ILIKE ${searchTerm}`
        ))
        .limit(20);
        results.push(...unlistedResults.map(u => ({ ...u, type: 'unlisted' })));
        break;
        
      case 'reits_invits':
        const reitResults = await db.select({
          id: instrumentMaster.id,
          name: instrumentMaster.name,
          symbol: instrumentMaster.symbol,
          isin: instrumentMaster.isin,
          price: instrumentMaster.lastPrice,
          issuer: instrumentMaster.issuer,
        })
        .from(instrumentMaster)
        .where(and(
          or(
            eq(instrumentMaster.category, 'REIT'),
            eq(instrumentMaster.category, 'InvIT'),
            sql`LOWER(${instrumentMaster.assetClass}) LIKE '%reit%'`,
            sql`LOWER(${instrumentMaster.assetClass}) LIKE '%invit%'`
          ),
          or(
            sql`${instrumentMaster.name} ILIKE ${searchTerm}`,
            sql`${instrumentMaster.symbol} ILIKE ${searchTerm}`
          )
        ))
        .limit(20);
        results.push(...reitResults.map(r => ({ ...r, type: 'reits_invits' })));
        break;
        
      case 'fixed_deposits':
        const fdResults = await db.select({
          id: instrumentMaster.id,
          name: instrumentMaster.name,
          symbol: instrumentMaster.symbol,
          issuer: instrumentMaster.issuer,
        })
        .from(instrumentMaster)
        .where(and(
          or(
            eq(instrumentMaster.category, 'FD'),
            eq(instrumentMaster.assetClass, 'fixed_deposit'),
            sql`LOWER(${instrumentMaster.category}) = 'fixed deposit'`
          ),
          or(
            sql`${instrumentMaster.name} ILIKE ${searchTerm}`,
            sql`${instrumentMaster.issuer} ILIKE ${searchTerm}`
          )
        ))
        .limit(20);
        results.push(...fdResults.map(f => ({ ...f, type: 'fixed_deposits' })));
        break;
    }
    
    res.json({ success: true, results });
  } catch (error) {
    console.error("[API] Error searching products:", error);
    res.status(500).json({ success: false, error: "Failed to search products" });
  }
});

export default router;
