import { Router, Request, Response, NextFunction } from "express";
import { pickOfTheDayService, PickCategory } from "../services/pick-of-the-day-service";
import { db } from "../db";
import { dailyPicks, listedStocks, mutualFunds, bondCatalog, unlistedCompanies, globalInstruments, instrumentMaster, sgbPrimaryIssues, pickWatchlist, pickPriceAlerts, investmentProposals, investmentProposalItems, userNotifications } from "@shared/schema";
import { eq, like, or, sql, desc, and, count } from "drizzle-orm";
import nodemailer from "nodemailer";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/roleMiddleware";

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


export default router;
