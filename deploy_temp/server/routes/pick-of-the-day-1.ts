import { Router, Request, Response, NextFunction } from "express";
import { pickOfTheDayService, PickCategory } from "../services/pick-of-the-day-service";
import { db } from "../db";
import { dailyPicks, listedStocks, mutualFunds, bondCatalog, unlistedCompanies, globalInstruments, instrumentMaster, sgbPrimaryIssues, pickWatchlist, pickPriceAlerts, investmentProposals, investmentProposalItems, userNotifications } from "@shared/schema";
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

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!(req as any).user) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  const user = (req as any).user;
  const role = user.role;
  const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
  const isAdmin = role === 'admin' || role === 'superadmin' || roles.includes('admin') || roles.includes('superadmin');
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
};

const REGULATORY_DISCLAIMER = "Investment recommendations are AI-generated and for informational purposes only. Past performance does not guarantee future results. Investors should conduct independent due diligence and consult a SEBI-registered investment advisor before making investment decisions. FintekPro does not guarantee accuracy of third-party data. Data sourced from NSE, BSE, AMFI, Alpha Vantage, and Yahoo Finance.";

const DATA_SOURCES: Record<string, { name: string; type: string; refreshInterval: string }> = {
  listed_stocks: { name: "NSE/BSE Exchange Feed", type: "Real-time (15-min delay)", refreshInterval: "Every 4 hours" },
  mutual_funds: { name: "AMFI NAV Service", type: "End-of-day NAV", refreshInterval: "Daily after 11:30 PM IST" },
  bonds: { name: "NSE/BSE Bond Catalog", type: "Daily pricing", refreshInterval: "Daily" },
  global_stocks: { name: "Alpha Vantage / Yahoo Finance", type: "Near real-time", refreshInterval: "Every 30 minutes" },
  etfs: { name: "NSE/Yahoo Finance", type: "Near real-time", refreshInterval: "Every 30 minutes" },
  reits_invits: { name: "NSE India / Yahoo Finance", type: "Daily pricing", refreshInterval: "Every 6 hours" },
  sgb: { name: "RBI / Gold Spot Price", type: "Gold-linked valuation", refreshInterval: "Daily" },
  unlisted: { name: "FintekPro OTC Desk", type: "Dealer quote", refreshInterval: "On update" },
  derivatives: { name: "NSE F&O Data / Options Chain", type: "Real-time (15-min delay)", refreshInterval: "Every 4 hours" },
};

async function getLiveInstrumentPrice(pick: any): Promise<number | null> {
  try {
    switch (pick.category) {
      case 'listed_stocks': {
        const row = await db.select({ currentPrice: listedStocks.currentPrice })
          .from(listedStocks).where(eq(listedStocks.id, pick.instrumentId)).limit(1);
        return row[0]?.currentPrice ? parseFloat(row[0].currentPrice) : null;
      }
      case 'mutual_funds': {
        const row = await db.select({ nav: mutualFunds.nav })
          .from(mutualFunds).where(eq(mutualFunds.schemeCode, pick.instrumentId)).limit(1);
        return row[0]?.nav ? parseFloat(row[0].nav) : null;
      }
      case 'bonds': {
        const row = await db.select({ cleanPrice: bondCatalog.cleanPrice })
          .from(bondCatalog).where(eq(bondCatalog.id, pick.instrumentId)).limit(1);
        return row[0]?.cleanPrice ? parseFloat(row[0].cleanPrice) : null;
      }
      case 'unlisted': {
        const row = await db.select({ publishedBuyPrice: unlistedCompanies.publishedBuyPrice })
          .from(unlistedCompanies).where(eq(unlistedCompanies.id, pick.instrumentId)).limit(1);
        return row[0]?.publishedBuyPrice ? parseFloat(row[0].publishedBuyPrice) : null;
      }
      case 'etfs': {
        const row = await db.select({ lastPrice: instrumentMaster.lastPrice })
          .from(instrumentMaster).where(eq(instrumentMaster.id, pick.instrumentId)).limit(1);
        return row[0]?.lastPrice ? parseFloat(row[0].lastPrice) : null;
      }
      case 'global_stocks': {
        const row = await db.select({ lastPrice: globalInstruments.lastPrice })
          .from(globalInstruments).where(eq(globalInstruments.id, pick.instrumentId)).limit(1);
        return row[0]?.lastPrice ? parseFloat(row[0].lastPrice) : null;
      }
      case 'reits_invits': {
        const result = await db.execute(sql`
          SELECT current_price FROM reits WHERE id::text = ${pick.instrumentId}
          UNION ALL SELECT current_price FROM invits WHERE id::text = ${pick.instrumentId}
          LIMIT 1
        `);
        const reitRow = (result as any).rows?.[0] || (result as any)[0];
        return reitRow?.current_price ? parseFloat(reitRow.current_price) : null;
      }
      case 'sgb': {
        const result = await db.execute(sql`
          SELECT current_price FROM commodity_prices WHERE symbol = 'GOLD' ORDER BY last_updated DESC LIMIT 1
        `);
        const goldRow = (result as any).rows?.[0] || (result as any)[0];
        return goldRow?.current_price ? parseFloat(goldRow.current_price) : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

async function enrichPicksWithDataSource(picks: any[]) {
  const categoryLastUpdated: Record<string, string> = {};
  const now = new Date();
  const expiredPickIds: number[] = [];
  const picksToUpdateInDb: { id: number; currentPrice: string; returnPct: string; daysHeld: number; status: string }[] = [];

  for (const pick of picks) {
    if (pick.status === 'live' && pick.expiryDate) {
      const expiry = new Date(pick.expiryDate);
      if (expiry < now) {
        pick.status = 'expired';
        if (pick.id) expiredPickIds.push(pick.id);
      }
    }

    // --- Always compute daysHeld fresh ---
    if (pick.recoDate) {
      pick.daysHeld = Math.floor((now.getTime() - new Date(pick.recoDate).getTime()) / (1000 * 60 * 60 * 24));
    }

    // --- Fetch live price from instrument table for live picks ---
    if (pick.status === 'live' && pick.instrumentId) {
      try {
        const freshPrice = await getLiveInstrumentPrice(pick);
        if (freshPrice !== null && freshPrice > 0) {
          pick.currentPrice = freshPrice;
          pick.lastPriceUpdate = now.toISOString();

          if (pick.recoPrice) {
            const recoPrice = parseFloat(pick.recoPrice);
            if (recoPrice > 0) {
              pick.returnPct = parseFloat((((freshPrice - recoPrice) / recoPrice) * 100).toFixed(2));
            }
          }

          // Determine new status from fresh price
          let newStatus = 'live';
          if (pick.targetPrice && freshPrice >= parseFloat(pick.targetPrice)) newStatus = 'target_hit';
          else if (pick.stoplossPrice && freshPrice <= parseFloat(pick.stoplossPrice)) newStatus = 'stoploss_hit';
          if (newStatus !== pick.status) pick.status = newStatus;

          if (pick.id) {
            picksToUpdateInDb.push({
              id: pick.id,
              currentPrice: freshPrice.toString(),
              returnPct: pick.returnPct?.toString() ?? '0',
              daysHeld: pick.daysHeld ?? 0,
              status: pick.status,
            });
          }
        }
      } catch {}
    }

    const source = DATA_SOURCES[pick.category];
    pick.priceDataSource = source?.name || 'Unknown';
    pick.priceDataType = source?.type || 'Unknown';
    pick.priceRefreshInterval = source?.refreshInterval || 'Unknown';
    
    if (pick.lastPriceUpdate || pick.updatedAt || pick.statusUpdatedAt) {
      const updatedAt = pick.lastPriceUpdate || pick.statusUpdatedAt || pick.updatedAt;
      pick.lastPriceUpdate = updatedAt;
      const cat = pick.category;
      if (!categoryLastUpdated[cat] || new Date(updatedAt) > new Date(categoryLastUpdated[cat])) {
        categoryLastUpdated[cat] = updatedAt;
      }
    }
    
    const ageHours = pick.lastPriceUpdate ? 
      (Date.now() - new Date(pick.lastPriceUpdate).getTime()) / (1000 * 60 * 60) : null;
    
    if (ageHours === null) {
      pick.dataFreshness = 'unknown';
    } else if (ageHours < 1) {
      pick.dataFreshness = 'live';
    } else if (ageHours < 6) {
      pick.dataFreshness = 'recent';
    } else if (ageHours < 24) {
      pick.dataFreshness = 'delayed';
    } else {
      pick.dataFreshness = 'stale';
    }

    if (pick.category === 'listed_stocks' && pick.symbol && pick.keyMetrics) {
      const km = typeof pick.keyMetrics === 'string' ? JSON.parse(pick.keyMetrics) : pick.keyMetrics;
      const needsRsi = km.rsi == null;
      const needsRoic = km.roic == null;
      if (needsRsi || needsRoic) {
        try {
          if (needsRoic) {
            const stockRow = await db.execute(sql`SELECT roce FROM listed_stocks WHERE symbol = ${pick.symbol} AND roce IS NOT NULL LIMIT 1`);
            const row = (stockRow as any).rows?.[0];
            if (row?.roce != null) {
              km.roic = parseFloat(row.roce);
            }
          }
          if (needsRsi) {
            const yahooFinance = (await import('yahoo-finance2')).default;
            const suffixes = ['.NS', '.BO'];
            for (const suffix of suffixes) {
              if (km.rsi != null) break;
              try {
                const yahooSymbol = `${pick.symbol}${suffix}`;
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);
                const chartResult = await yahooFinance.chart(yahooSymbol, {
                  period1: startDate,
                  period2: endDate,
                  interval: '1d',
                });
                const quotes = chartResult?.quotes;
                if (quotes && quotes.length >= 15) {
                  const closes = quotes.map((q: any) => q.close).filter((c: any) => c != null);
                  if (closes.length >= 15) {
                    let gains = 0, losses = 0;
                    for (let i = 1; i <= 14; i++) {
                      const diff = closes[closes.length - i] - closes[closes.length - i - 1];
                      if (diff > 0) gains += diff;
                      else losses += Math.abs(diff);
                    }
                    const avgGain = gains / 14;
                    const avgLoss = losses / 14;
                    km.rsi = avgLoss === 0 ? 100 : Math.round((100 - (100 / (1 + avgGain / avgLoss))) * 100) / 100;
                  }
                }
              } catch {}
            }
          }
          pick.keyMetrics = km;
        } catch {
        }
      }
    }
  }
  
  if (expiredPickIds.length > 0) {
    try {
      await db.execute(
        sql`UPDATE daily_picks SET status = 'expired', updated_at = NOW() WHERE id = ANY(${expiredPickIds}) AND status = 'live'`
      );
      console.log(`[PickOfDay] Auto-expired ${expiredPickIds.length} pick(s): ${expiredPickIds.join(', ')}`);
    } catch (err) {
      console.warn('[PickOfDay] Failed to auto-expire picks in DB:', err);
    }
  }

  // Persist freshly fetched prices back to DB in the background (fire-and-forget)
  if (picksToUpdateInDb.length > 0) {
    Promise.all(
      picksToUpdateInDb.map(u =>
        db.update(dailyPicks)
          .set({
            currentPrice: u.currentPrice,
            returnPct: u.returnPct,
            daysHeld: u.daysHeld,
            status: u.status as any,
            updatedAt: new Date(),
          })
          .where(eq(dailyPicks.id, u.id))
          .catch(() => {})
      )
    ).catch(() => {});
  }

  return { picks, categoryLastUpdated };
}

router.get("/today", async (req, res) => {
  try {
    let rawPicks = await pickOfTheDayService.getTodaysPicks();
    let isFallback = false;

    if (rawPicks.length === 0) {
      rawPicks = await pickOfTheDayService.getMostRecentPicks();
      isFallback = rawPicks.length > 0;
    }

    const { picks, categoryLastUpdated } = await enrichPicksWithDataSource(rawPicks);
    const fallbackDate = isFallback && picks.length > 0 ? picks[0].recoDate : undefined;
    
    res.json({
      success: true,
      date: new Date().toISOString().split('T')[0],
      picks,
      categoryLastUpdated,
      lastRefreshedAt: new Date().toISOString(),
      dataSources: DATA_SOURCES,
      disclaimer: REGULATORY_DISCLAIMER,
      isFallback,
      fallbackDate,
      message: picks.length === 0 
        ? "No picks generated yet. Picks will be auto-generated daily at 9:00 AM IST." 
        : isFallback 
          ? `Showing most recent picks from ${fallbackDate}. Today's picks will be generated shortly.`
          : undefined,
    });
  } catch (error) {
    console.error("[API] Error fetching today's picks:", error);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

router.get("/live", async (req, res) => {
  try {
    const rawPicks = await pickOfTheDayService.getLivePicks();
    const { picks: allPicks, categoryLastUpdated } = await enrichPicksWithDataSource(rawPicks);
    // Exclude picks that were just auto-expired by enrichment (expiryDate passed)
    const picks = allPicks.filter(p => p.status !== 'expired');
    const lastUpdated = await db.select({ maxUpdated: sql<string>`MAX(updated_at)` }).from(dailyPicks).where(eq(dailyPicks.status, 'live'));

    res.json({
      success: true,
      count: picks.length,
      picks,
      categoryLastUpdated,
      lastRefreshedAt: lastUpdated[0]?.maxUpdated || new Date().toISOString(),
      dataSources: DATA_SOURCES,
      disclaimer: REGULATORY_DISCLAIMER,
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
    
    const rawPicks = await pickOfTheDayService.getPickHistory(category, limit);
    const { picks, categoryLastUpdated } = await enrichPicksWithDataSource(rawPicks);
    res.json({
      success: true,
      count: picks.length,
      picks,
      dataSources: DATA_SOURCES,
      categoryLastUpdated,
      disclaimer: REGULATORY_DISCLAIMER,
    });
  } catch (error) {
    console.error("[API] Error fetching pick history:", error);
    res.status(500).json({ success: false, error: "Failed to fetch history" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const stats = await pickOfTheDayService.getPerformanceStats();
    const lastUpdated = await db.select({ maxUpdated: sql<string>`MAX(updated_at)` }).from(dailyPicks);

    res.json({
      success: true,
      stats,
      asOfDate: new Date().toISOString(),
      lastDataRefresh: lastUpdated[0]?.maxUpdated || new Date().toISOString(),
      dataSources: DATA_SOURCES,
      disclaimer: REGULATORY_DISCLAIMER,
    });
  } catch (error) {
    console.error("[API] Error fetching pick stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});


router.post("/generate", requireAdmin, async (req, res) => {
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

router.post("/update-statuses", requireAdmin, async (req, res) => {
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

router.get("/admin/list", requireAdmin, async (req, res) => {
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

router.get("/admin/:id", requireAdmin, async (req, res) => {
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

router.post("/admin/create", requireAdmin, async (req, res) => {
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

router.patch("/admin/:id", requireAdmin, async (req, res) => {
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

router.delete("/admin/:id", requireAdmin, async (req, res) => {
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


export default router;
