import { Router, Request, Response, NextFunction } from "express";
import { pickOfTheDayService, PickCategory } from "../services/pick-of-the-day-service";
import { db } from "../db";
import { dailyPicks, listedStocks, mutualFunds, bondCatalog, unlistedCompanies, globalInstruments, instrumentMaster, sgbPrimaryIssues, pickWatchlist, pickPriceAlerts, investmentProposals, investmentProposalItems, userNotifications } from "@shared/schema";
import { eq, like, or, sql, desc, and, count } from "drizzle-orm";
import nodemailer from "nodemailer";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/roleMiddleware";
import { REGULATORY_DISCLAIMER, DATA_SOURCES, enrichPicksWithDataSource } from "./pick-of-the-day-utils";

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
      return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error.issues });
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
      return res.status(400).json({ success: false, error: "Invalid request", details: parseResult.error.issues });
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


export default router;
