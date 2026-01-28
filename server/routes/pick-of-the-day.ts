import { Router, Request, Response, NextFunction } from "express";
import { pickOfTheDayService, PickCategory } from "../services/pick-of-the-day-service";
import { db } from "../db";
import { dailyPicks, listedStocks, mutualFunds, bondCatalog, unlistedCompanies, globalInstruments, instrumentMaster, sgbPrimaryIssues, pickWatchlist, pickPriceAlerts, investmentProposals, investmentProposalItems } from "@shared/schema";
import { eq, like, or, sql, desc, and, count } from "drizzle-orm";
import nodemailer from "nodemailer";
import { z } from "zod";

const watchlistAddSchema = z.object({
  pickId: z.number(),
  notes: z.string().optional(),
  priceAlertEnabled: z.boolean().optional(),
  alertThreshold: z.number().optional(),
  alertType: z.enum(['above', 'below', 'target_hit', 'stoploss_hit']).optional(),
});

const proposalAddSchema = z.object({
  pickId: z.number(),
  proposalId: z.string().optional(),
  amount: z.number().optional(),
  notes: z.string().optional(),
});

const shareSchema = z.object({
  pickId: z.number(),
  channel: z.enum(['email', 'whatsapp']),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  customMessage: z.string().optional(),
});

const alertUpdateSchema = z.object({
  priceAlertEnabled: z.boolean().optional(),
  alertThreshold: z.number().optional(),
  alertType: z.enum(['above', 'below', 'target_hit', 'stoploss_hit']).optional(),
});

const router = Router();

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as any).user) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  next();
};

router.get("/today", async (req, res) => {
  try {
    const picks = await pickOfTheDayService.getTodaysPicks();
    
    res.json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      picks,
      message: picks.length === 0 ? "No picks generated for today yet. Use admin panel to generate picks." : undefined,
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

// ==========================================
// WATCHLIST ENDPOINTS
// ==========================================

router.get("/watchlist", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    
    const watchlistItems = await db.select({
      watchlistId: pickWatchlist.id,
      pickId: pickWatchlist.pickId,
      addedAt: pickWatchlist.addedAt,
      notes: pickWatchlist.notes,
      priceAlertEnabled: pickWatchlist.priceAlertEnabled,
      alertThreshold: pickWatchlist.alertThreshold,
      alertType: pickWatchlist.alertType,
      pick: dailyPicks,
    })
    .from(pickWatchlist)
    .innerJoin(dailyPicks, eq(pickWatchlist.pickId, dailyPicks.id))
    .where(eq(pickWatchlist.userId, userId))
    .orderBy(desc(pickWatchlist.addedAt));
    
    res.json({ success: true, watchlist: watchlistItems });
  } catch (error) {
    console.error("[API] Error fetching watchlist:", error);
    res.status(500).json({ success: false, error: "Failed to fetch watchlist" });
  }
});

router.post("/watchlist/add", requireAuth, async (req, res) => {
  try {
    const parseResult = watchlistAddSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error.errors });
    }
    
    const userId = (req as any).user.id;
    const { pickId, notes, priceAlertEnabled, alertThreshold, alertType } = parseResult.data;
    
    const [pick] = await db.select().from(dailyPicks).where(eq(dailyPicks.id, pickId));
    if (!pick) {
      return res.status(404).json({ success: false, error: "Pick not found" });
    }
    
    const existing = await db.select().from(pickWatchlist)
      .where(and(eq(pickWatchlist.userId, userId), eq(pickWatchlist.pickId, pickId)));
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: "Pick already in watchlist" });
    }
    
    const [item] = await db.insert(pickWatchlist).values({
      userId,
      pickId,
      notes,
      priceAlertEnabled: priceAlertEnabled || false,
      alertThreshold: alertThreshold?.toString(),
      alertType,
    }).returning();
    
    res.json({ success: true, watchlistItem: item });
  } catch (error) {
    console.error("[API] Error adding to watchlist:", error);
    res.status(500).json({ success: false, error: "Failed to add to watchlist" });
  }
});

router.delete("/watchlist/:pickId", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const pickId = parseInt(req.params.pickId);
    
    if (isNaN(pickId) || pickId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid pick ID" });
    }
    
    const deleted = await db.delete(pickWatchlist)
      .where(and(eq(pickWatchlist.userId, userId), eq(pickWatchlist.pickId, pickId)))
      .returning();
    
    if (deleted.length === 0) {
      return res.status(404).json({ success: false, error: "Pick not found in watchlist" });
    }
    
    res.json({ success: true, message: "Removed from watchlist" });
  } catch (error) {
    console.error("[API] Error removing from watchlist:", error);
    res.status(500).json({ success: false, error: "Failed to remove from watchlist" });
  }
});

router.patch("/watchlist/:pickId/alert", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const pickId = parseInt(req.params.pickId);
    
    if (isNaN(pickId) || pickId <= 0) {
      return res.status(400).json({ success: false, error: "Invalid pick ID" });
    }
    
    const parseResult = alertUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error.errors });
    }
    
    const { priceAlertEnabled, alertThreshold, alertType } = parseResult.data;
    
    const [updated] = await db.update(pickWatchlist)
      .set({
        priceAlertEnabled,
        alertThreshold: alertThreshold?.toString(),
        alertType,
      })
      .where(and(eq(pickWatchlist.userId, userId), eq(pickWatchlist.pickId, pickId)))
      .returning();
    
    if (!updated) {
      return res.status(404).json({ success: false, error: "Watchlist item not found" });
    }
    
    res.json({ success: true, watchlistItem: updated });
  } catch (error) {
    console.error("[API] Error updating alert settings:", error);
    res.status(500).json({ success: false, error: "Failed to update alert" });
  }
});

// ==========================================
// SECTOR DIVERSIFICATION ENDPOINT
// ==========================================

router.get("/diversification", requireAuth, async (req, res) => {
  try {
    const livePicks = await db.select({
      id: dailyPicks.id,
      category: dailyPicks.category,
      instrumentName: dailyPicks.instrumentName,
      sectorCategory: dailyPicks.sectorCategory,
      riskLevel: dailyPicks.riskLevel,
      timeHorizon: dailyPicks.timeHorizon,
      confidenceScore: dailyPicks.confidenceScore,
    })
    .from(dailyPicks)
    .where(eq(dailyPicks.status, 'live'));
    
    const sectorDistribution: Record<string, { count: number; picks: typeof livePicks }> = {};
    const categoryDistribution: Record<string, number> = {};
    const timeHorizonDistribution: Record<string, number> = {};
    const riskDistribution: Record<string, number> = {};
    
    for (const pick of livePicks) {
      const sector = pick.sectorCategory || 'Other';
      if (!sectorDistribution[sector]) {
        sectorDistribution[sector] = { count: 0, picks: [] };
      }
      sectorDistribution[sector].count++;
      sectorDistribution[sector].picks.push(pick);
      
      categoryDistribution[pick.category] = (categoryDistribution[pick.category] || 0) + 1;
      timeHorizonDistribution[pick.timeHorizon || 'medium_term'] = (timeHorizonDistribution[pick.timeHorizon || 'medium_term'] || 0) + 1;
      riskDistribution[pick.riskLevel || 'medium'] = (riskDistribution[pick.riskLevel || 'medium'] || 0) + 1;
    }
    
    const totalPicks = livePicks.length;
    const diversificationScore = totalPicks > 0 
      ? Math.min(100, Object.keys(sectorDistribution).length * 15 + Object.keys(categoryDistribution).length * 10)
      : 0;
    
    res.json({
      success: true,
      analysis: {
        totalLivePicks: totalPicks,
        diversificationScore,
        sectorDistribution,
        categoryDistribution,
        timeHorizonDistribution,
        riskDistribution,
        recommendations: getDiversificationRecommendations(sectorDistribution, categoryDistribution),
      },
    });
  } catch (error) {
    console.error("[API] Error analyzing diversification:", error);
    res.status(500).json({ success: false, error: "Failed to analyze diversification" });
  }
});

function getDiversificationRecommendations(
  sectors: Record<string, { count: number }>,
  categories: Record<string, number>
): string[] {
  const recommendations: string[] = [];
  const sectorCount = Object.keys(sectors).length;
  const categoryCount = Object.keys(categories).length;
  
  if (sectorCount < 5) {
    recommendations.push("Consider adding picks from more diverse sectors to reduce concentration risk");
  }
  if (categoryCount < 4) {
    recommendations.push("Portfolio lacks asset class diversity - consider adding bonds, ETFs, or global stocks");
  }
  
  for (const [sector, data] of Object.entries(sectors)) {
    if (data.count > 3) {
      recommendations.push(`High concentration in ${sector} sector (${data.count} picks) - consider rebalancing`);
    }
  }
  
  if (!categories['bonds'] && !categories['sgb']) {
    recommendations.push("No fixed income picks - consider adding bonds or SGBs for stability");
  }
  
  return recommendations;
}

// ==========================================
// ENHANCED STATS WITH HISTORICAL ACCURACY
// ==========================================

router.get("/stats/enhanced", requireAuth, async (req, res) => {
  try {
    const allPicks = await db.select().from(dailyPicks);
    
    const completedPicks = allPicks.filter(p => ['target_hit', 'stoploss_hit', 'expired'].includes(p.status));
    const targetHits = completedPicks.filter(p => p.status === 'target_hit');
    const stoplossHits = completedPicks.filter(p => p.status === 'stoploss_hit');
    
    const hitRate = completedPicks.length > 0 
      ? (targetHits.length / completedPicks.length) * 100 
      : 0;
    
    const avgReturn = completedPicks.length > 0
      ? completedPicks.reduce((sum, p) => sum + (parseFloat(p.returnPct || '0')), 0) / completedPicks.length
      : 0;
    
    const avgDaysHeld = completedPicks.length > 0
      ? completedPicks.reduce((sum, p) => sum + (p.daysHeld || 0), 0) / completedPicks.length
      : 0;
    
    const categoryStats: Record<string, {
      total: number;
      targetHits: number;
      stoplossHits: number;
      avgReturn: number;
      hitRate: number;
    }> = {};
    
    for (const pick of completedPicks) {
      if (!categoryStats[pick.category]) {
        categoryStats[pick.category] = { total: 0, targetHits: 0, stoplossHits: 0, avgReturn: 0, hitRate: 0 };
      }
      const stat = categoryStats[pick.category];
      stat.total++;
      if (pick.status === 'target_hit') stat.targetHits++;
      if (pick.status === 'stoploss_hit') stat.stoplossHits++;
      stat.avgReturn += parseFloat(pick.returnPct || '0');
    }
    
    for (const cat of Object.keys(categoryStats)) {
      const stat = categoryStats[cat];
      stat.avgReturn = stat.total > 0 ? stat.avgReturn / stat.total : 0;
      stat.hitRate = stat.total > 0 ? (stat.targetHits / stat.total) * 100 : 0;
    }
    
    const monthlyPerformance: Record<string, { picks: number; hitRate: number; avgReturn: number }> = {};
    for (const pick of completedPicks) {
      const month = pick.recoDate.substring(0, 7);
      if (!monthlyPerformance[month]) {
        monthlyPerformance[month] = { picks: 0, hitRate: 0, avgReturn: 0 };
      }
      monthlyPerformance[month].picks++;
      monthlyPerformance[month].avgReturn += parseFloat(pick.returnPct || '0');
      if (pick.status === 'target_hit') monthlyPerformance[month].hitRate++;
    }
    
    for (const month of Object.keys(monthlyPerformance)) {
      const data = monthlyPerformance[month];
      data.avgReturn = data.picks > 0 ? data.avgReturn / data.picks : 0;
      data.hitRate = data.picks > 0 ? (data.hitRate / data.picks) * 100 : 0;
    }
    
    const confidenceAccuracy = completedPicks.reduce((acc, pick) => {
      const confidence = pick.confidenceScore || 70;
      const bucket = Math.floor(confidence / 10) * 10;
      if (!acc[bucket]) acc[bucket] = { predictions: 0, correct: 0 };
      acc[bucket].predictions++;
      if (pick.status === 'target_hit') acc[bucket].correct++;
      return acc;
    }, {} as Record<number, { predictions: number; correct: number }>);
    
    res.json({
      success: true,
      stats: {
        overall: {
          totalPicks: allPicks.length,
          livePicks: allPicks.filter(p => p.status === 'live').length,
          completedPicks: completedPicks.length,
          targetHits: targetHits.length,
          stoplossHits: stoplossHits.length,
          hitRate: Math.round(hitRate * 100) / 100,
          avgReturn: Math.round(avgReturn * 100) / 100,
          avgDaysHeld: Math.round(avgDaysHeld),
        },
        byCategory: categoryStats,
        monthlyTrend: monthlyPerformance,
        confidenceCalibration: confidenceAccuracy,
      },
    });
  } catch (error) {
    console.error("[API] Error fetching enhanced stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch enhanced stats" });
  }
});

// ==========================================
// ADD TO PROPOSAL INTEGRATION
// ==========================================

router.post("/add-to-proposal", requireAuth, async (req, res) => {
  try {
    const parseResult = proposalAddSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error.errors });
    }
    
    const userId = (req as any).user.id;
    const { pickId, proposalId, amount, notes } = parseResult.data;
    
    const [pick] = await db.select().from(dailyPicks).where(eq(dailyPicks.id, pickId));
    if (!pick) {
      return res.status(404).json({ success: false, error: "Pick not found" });
    }
    
    let targetProposalId = proposalId;
    
    if (targetProposalId) {
      const [existingProposal] = await db.select().from(investmentProposals)
        .where(eq(investmentProposals.id, targetProposalId));
      
      if (!existingProposal) {
        return res.status(404).json({ success: false, error: "Proposal not found" });
      }
      
      if (existingProposal.agentId !== userId && existingProposal.clientId !== userId) {
        return res.status(403).json({ success: false, error: "You do not have access to this proposal" });
      }
    } else {
      const existingDraft = await db.select().from(investmentProposals)
        .where(and(
          eq(investmentProposals.agentId, userId),
          eq(investmentProposals.status, 'pending')
        ))
        .limit(1);
      
      if (existingDraft.length > 0) {
        targetProposalId = existingDraft[0].id;
      } else {
        const newId = `PICK-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const [newProposal] = await db.insert(investmentProposals).values({
          id: newId,
          clientId: userId,
          agentId: userId,
          proposalSource: 'agent',
          title: 'Pick of the Day Proposal',
          description: 'Investment proposal based on recommended picks',
          recommendations: [],
          totalInvestmentAmount: '0',
          status: 'pending',
        }).returning();
        targetProposalId = newProposal.id;
      }
    }
    
    const productType = getProductTypeFromCategory(pick.category);
    const productCode = pick.isin || pick.symbol || pick.instrumentId || pick.id.toString();
    
    const itemId = `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    const [proposalItem] = await db.insert(investmentProposalItems).values({
      id: itemId,
      proposalId: targetProposalId,
      productType,
      productCode,
      productName: pick.instrumentName,
      category: pick.category,
      recommendedAmount: amount?.toString() || '10000',
      allocationPercentage: '0',
      selectionReason: pick.rationale,
      expectedOutcome: `Target: ${pick.targetPrice}, Stoploss: ${pick.stoplossPrice}`,
    }).returning();
    
    res.json({
      success: true,
      message: "Pick added to proposal",
      proposalId: targetProposalId,
      proposalItem,
    });
  } catch (error) {
    console.error("[API] Error adding pick to proposal:", error);
    res.status(500).json({ success: false, error: "Failed to add to proposal" });
  }
});

function getProductTypeFromCategory(category: string): string {
  const mapping: Record<string, string> = {
    'listed_stocks': 'equity',
    'mutual_funds': 'mutual_fund',
    'bonds': 'bond',
    'global_stocks': 'global_equity',
    'etfs': 'etf',
    'sgb': 'sgb',
    'unlisted': 'unlisted_equity',
    'reits_invits': 'reit_invit',
    'fixed_deposits': 'fixed_deposit',
  };
  return mapping[category] || 'other';
}

// ==========================================
// SHARE FUNCTIONALITY (Email/WhatsApp)
// ==========================================

router.post("/share", requireAuth, async (req, res) => {
  try {
    const parseResult = shareSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error.errors });
    }
    
    const { pickId, channel, recipientEmail, recipientPhone, customMessage } = parseResult.data;
    const user = (req as any).user;
    
    const [pick] = await db.select().from(dailyPicks).where(eq(dailyPicks.id, pickId));
    if (!pick) {
      return res.status(404).json({ success: false, error: "Pick not found" });
    }
    
    const shareMessage = generateShareMessage(pick, customMessage, user.name || user.email);
    
    if (channel === 'email' && recipientEmail) {
      await sendEmailShare(recipientEmail, pick, shareMessage);
      res.json({ success: true, message: "Pick shared via email" });
    } else if (channel === 'whatsapp') {
      const whatsappUrl = recipientPhone 
        ? generateWhatsAppLink(recipientPhone, shareMessage)
        : `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
      res.json({ success: true, message: "WhatsApp share link generated", whatsappUrl });
    } else if (channel === 'email' && !recipientEmail) {
      res.status(400).json({ success: false, error: "Email address is required" });
    } else {
      res.status(400).json({ success: false, error: "Invalid channel" });
    }
  } catch (error) {
    console.error("[API] Error sharing pick:", error);
    res.status(500).json({ success: false, error: "Failed to share pick" });
  }
});

function generateShareMessage(pick: any, customMessage: string | undefined, agentName: string): string {
  const returnPotential = ((parseFloat(pick.targetPrice) - parseFloat(pick.recoPrice)) / parseFloat(pick.recoPrice) * 100).toFixed(1);
  
  let message = `🎯 Investment Recommendation from ${agentName}\n\n`;
  message += `📈 ${pick.instrumentName}\n`;
  message += `Category: ${pick.category.replace('_', ' ').toUpperCase()}\n`;
  message += `Current Price: ₹${parseFloat(pick.currentPrice || pick.recoPrice).toLocaleString()}\n`;
  message += `Target Price: ₹${parseFloat(pick.targetPrice).toLocaleString()} (+${returnPotential}%)\n`;
  message += `Stop Loss: ₹${parseFloat(pick.stoplossPrice).toLocaleString()}\n`;
  message += `Risk Level: ${pick.riskLevel || 'Medium'}\n`;
  message += `Time Horizon: ${(pick.timeHorizon || 'medium_term').replace('_', ' ')}\n\n`;
  message += `📝 ${pick.rationale.substring(0, 200)}...\n\n`;
  
  if (customMessage) {
    message += `💬 Personal Note: ${customMessage}\n\n`;
  }
  
  message += `⚠️ Disclaimer: This is not investment advice. Please consult a SEBI-registered advisor before investing.`;
  
  return message;
}

async function sendEmailShare(recipientEmail: string, pick: any, message: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || process.env.GMAIL_USER,
      pass: process.env.EMAIL_PASS || process.env.GMAIL_PASS,
    },
  });
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER || process.env.GMAIL_USER,
    to: recipientEmail,
    subject: `Investment Recommendation: ${pick.instrumentName}`,
    text: message,
    html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${message}</pre>`,
  });
}

function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

// ==========================================
// CLIENT SUITABILITY MATCHING
// ==========================================

router.get("/:id/suitability", requireAuth, async (req, res) => {
  try {
    const pickId = parseInt(req.params.id);
    const { clientRiskProfile, investmentGoal, timeHorizon: clientTimeHorizon } = req.query;
    
    const [pick] = await db.select().from(dailyPicks).where(eq(dailyPicks.id, pickId));
    if (!pick) {
      return res.status(404).json({ success: false, error: "Pick not found" });
    }
    
    const suitabilityScore = calculateSuitabilityScore(pick, {
      riskProfile: clientRiskProfile as string,
      investmentGoal: investmentGoal as string,
      timeHorizon: clientTimeHorizon as string,
    });
    
    res.json({
      success: true,
      pickId,
      suitability: {
        score: suitabilityScore.overall,
        riskMatch: suitabilityScore.riskMatch,
        timeHorizonMatch: suitabilityScore.timeHorizonMatch,
        goalAlignment: suitabilityScore.goalAlignment,
        recommendation: suitabilityScore.recommendation,
        warnings: suitabilityScore.warnings,
      },
    });
  } catch (error) {
    console.error("[API] Error calculating suitability:", error);
    res.status(500).json({ success: false, error: "Failed to calculate suitability" });
  }
});

function calculateSuitabilityScore(pick: any, clientProfile: {
  riskProfile?: string;
  investmentGoal?: string;
  timeHorizon?: string;
}): {
  overall: number;
  riskMatch: number;
  timeHorizonMatch: number;
  goalAlignment: number;
  recommendation: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  let riskMatch = 70;
  let timeHorizonMatch = 70;
  let goalAlignment = 70;
  
  const pickRisk = pick.riskLevel || 'medium';
  const clientRisk = clientProfile.riskProfile || 'moderate';
  
  const riskMap: Record<string, number> = { 'low': 1, 'medium': 2, 'high': 3, 'conservative': 1, 'moderate': 2, 'aggressive': 3 };
  const pickRiskLevel = riskMap[pickRisk.toLowerCase()] || 2;
  const clientRiskLevel = riskMap[clientRisk.toLowerCase()] || 2;
  
  if (pickRiskLevel === clientRiskLevel) {
    riskMatch = 100;
  } else if (Math.abs(pickRiskLevel - clientRiskLevel) === 1) {
    riskMatch = 70;
  } else {
    riskMatch = 40;
    warnings.push(`Risk mismatch: Pick is ${pickRisk} risk but client prefers ${clientRisk}`);
  }
  
  const pickHorizon = pick.timeHorizon || 'medium_term';
  const clientHorizon = clientProfile.timeHorizon || 'medium_term';
  
  if (pickHorizon === clientHorizon) {
    timeHorizonMatch = 100;
  } else if ((pickHorizon.includes('short') && clientHorizon.includes('medium')) || 
             (pickHorizon.includes('medium') && clientHorizon.includes('long'))) {
    timeHorizonMatch = 75;
  } else {
    timeHorizonMatch = 50;
    warnings.push(`Time horizon mismatch: Pick is ${pickHorizon.replace('_', ' ')} but client prefers ${clientHorizon.replace('_', ' ')}`);
  }
  
  const goal = clientProfile.investmentGoal?.toLowerCase() || 'growth';
  const category = pick.category;
  
  if (goal === 'income' && ['bonds', 'sgb', 'fixed_deposits', 'reits_invits'].includes(category)) {
    goalAlignment = 100;
  } else if (goal === 'growth' && ['listed_stocks', 'mutual_funds', 'etfs', 'global_stocks'].includes(category)) {
    goalAlignment = 100;
  } else if (goal === 'speculation' && ['unlisted', 'global_stocks'].includes(category)) {
    goalAlignment = 100;
  } else {
    goalAlignment = 60;
  }
  
  const overall = Math.round((riskMatch * 0.4 + timeHorizonMatch * 0.3 + goalAlignment * 0.3));
  
  let recommendation: string;
  if (overall >= 80) {
    recommendation = 'Highly Suitable - This pick aligns well with the client profile';
  } else if (overall >= 60) {
    recommendation = 'Moderately Suitable - Consider with some adjustments';
  } else {
    recommendation = 'Low Suitability - Significant profile mismatch, proceed with caution';
  }
  
  return { overall, riskMatch, timeHorizonMatch, goalAlignment, recommendation, warnings };
}

// ==========================================
// PRICE REFRESH
// ==========================================

router.post("/refresh-prices", async (req, res) => {
  try {
    console.log("[API] Triggering price refresh for live picks");
    const result = await pickOfTheDayService.refreshLivePicks();
    res.json({ 
      success: true, 
      message: `Refreshed prices for ${result.updated} picks`,
      ...result 
    });
  } catch (error) {
    console.error("[API] Error refreshing prices:", error);
    res.status(500).json({ success: false, error: "Failed to refresh prices" });
  }
});

// ==========================================
// PRICE ALERTS
// ==========================================

router.get("/alerts/history", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const alerts = await db.select({
      alert: pickPriceAlerts,
      pick: dailyPicks,
    })
    .from(pickPriceAlerts)
    .innerJoin(dailyPicks, eq(pickPriceAlerts.pickId, dailyPicks.id))
    .where(eq(pickPriceAlerts.userId, userId))
    .orderBy(desc(pickPriceAlerts.createdAt))
    .limit(limit);
    
    res.json({ success: true, alerts });
  } catch (error) {
    console.error("[API] Error fetching alert history:", error);
    res.status(500).json({ success: false, error: "Failed to fetch alert history" });
  }
});

export default router;
