import { db } from "../db";
import { listedStocks, mutualFunds, bondCatalog, unlistedCompanies, globalInstruments, instrumentMaster, dailyPicks } from "@shared/schema";
import { eq, sql, inArray, and } from "drizzle-orm";
import { calculateSuggestedAllocation } from "../services/pick-of-the-day-service";

export const REGULATORY_DISCLAIMER = "Investment recommendations are AI-generated and for informational purposes only. Past performance does not guarantee future results. Investors should conduct independent due diligence and consult a SEBI-registered investment advisor before making investment decisions. FintekPro does not guarantee accuracy of third-party data. Data sourced from NSE, BSE, AMFI, Alpha Vantage, and Yahoo Finance.";

export const DATA_SOURCES: Record<string, { name: string; type: string; refreshInterval: string }> = {
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

export async function getLiveInstrumentPrice(pick: any): Promise<number | null> {
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

export async function enrichPicksWithDataSource(picks: any[]) {
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

    if (pick.recoDate) {
      pick.daysHeld = Math.floor((now.getTime() - new Date(pick.recoDate).getTime()) / (1000 * 60 * 60 * 24));
    }

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

    // RSI/ROIC enrichment for listed stocks — only fetch if not already cached
    if (pick.category === 'listed_stocks' && pick.symbol && pick.keyMetrics) {
      const km = typeof pick.keyMetrics === 'string' ? JSON.parse(pick.keyMetrics) : pick.keyMetrics;
      const needsRsi = km.rsi == null;
      const needsRoic = km.roic == null;
      const needsAllocation = km.suggestedAllocation == null;
      
      if (needsAllocation) {
        km.suggestedAllocation = calculateSuggestedAllocation(
          pick.category,
          pick.riskLevel || 'medium',
          pick.confidenceScore || 70,
          km
        );
      }
      
      if (needsRsi || needsRoic) {
        let metricsUpdated = false;
        try {
          if (needsRoic) {
            const stockRow = await db.execute(sql`SELECT roce FROM listed_stocks WHERE symbol = ${pick.symbol} AND roce IS NOT NULL LIMIT 1`);
            const row = (stockRow as any).rows?.[0];
            if (row?.roce != null) {
              km.roic = parseFloat(row.roce);
              metricsUpdated = true;
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
                    metricsUpdated = true;
                  }
                }
              } catch {}
            }
          }
          pick.keyMetrics = km;

          // ✅ Persist updated metrics back to DB so next request skips Yahoo Finance
          if (metricsUpdated && pick.id) {
            db.update(dailyPicks)
              .set({ keyMetrics: km, updatedAt: new Date() })
              .where(eq(dailyPicks.id, pick.id))
              .catch((err) => console.warn(`[PickEnrich] Failed to cache metrics for pick ${pick.id}:`, err));
          }
        } catch (err) {
          console.warn(`[PickEnrich] RSI/ROIC enrichment failed for ${pick.symbol}:`, err);
        }
      }
    }
  }
  
  if (expiredPickIds.length > 0) {
    try {
      // Use Drizzle's update method instead of raw SQL to avoid ANY() error
      await db.update(dailyPicks)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(and(inArray(dailyPicks.id, expiredPickIds), eq(dailyPicks.status, 'live' as any)));
    } catch (err) {
      console.warn('[PickOfDay] Failed to auto-expire picks in DB:', err);
    }
  }

  if (picksToUpdateInDb.length > 0) {
    // Fire-and-forget price sync — log failures instead of silently swallowing
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
          .catch((err) => console.warn(`[PickEnrich] DB price update failed for pick ${u.id}:`, err))
      )
    ).catch((err) => console.error('[PickEnrich] Batch price update error:', err));
  }

  return { picks, categoryLastUpdated };
}
