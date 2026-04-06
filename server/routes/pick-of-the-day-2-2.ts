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

router.get("/stats/enhanced", requireAuth, async (req, res) => {
  try {
    const overallResult = await db.execute(sql`
      SELECT
        COUNT(*) as total_picks,
        COUNT(*) FILTER (WHERE status = 'live') as live_picks,
        COUNT(*) FILTER (WHERE status IN ('target_hit','stoploss_hit','expired')) as completed_picks,
        COUNT(*) FILTER (WHERE status = 'target_hit') as target_hits,
        COUNT(*) FILTER (WHERE status = 'stoploss_hit') as stoploss_hits,
        COALESCE(AVG(return_pct::numeric) FILTER (WHERE status IN ('target_hit','stoploss_hit','expired')), 0) as avg_return,
        COALESCE(AVG(days_held) FILTER (WHERE status IN ('target_hit','stoploss_hit','expired')), 0) as avg_days_held
      FROM daily_picks
    `);

    const r = (overallResult as any).rows?.[0] || (overallResult as any)[0] || {};
    const completedCount = parseInt(r.completed_picks || '0');
    const targetHitsCount = parseInt(r.target_hits || '0');
    const hitRate = completedCount > 0 ? (targetHitsCount / completedCount) * 100 : 0;

    const catResult = await db.execute(sql`
      SELECT
        category,
        COUNT(*) FILTER (WHERE status IN ('target_hit','stoploss_hit','expired')) as total,
        COUNT(*) FILTER (WHERE status = 'target_hit') as target_hits,
        COUNT(*) FILTER (WHERE status = 'stoploss_hit') as stoploss_hits,
        COALESCE(AVG(return_pct::numeric) FILTER (WHERE status IN ('target_hit','stoploss_hit','expired')), 0) as avg_return
      FROM daily_picks
      GROUP BY category
    `);

    const categoryStats: Record<string, any> = {};
    for (const cr of ((catResult as any).rows || catResult)) {
      const total = parseInt(cr.total || '0');
      const th = parseInt(cr.target_hits || '0');
      categoryStats[cr.category] = {
        total,
        targetHits: th,
        stoplossHits: parseInt(cr.stoploss_hits || '0'),
        avgReturn: Math.round(parseFloat(cr.avg_return || '0') * 100) / 100,
        hitRate: total > 0 ? Math.round((th / total) * 100 * 100) / 100 : 0,
      };
    }

    const monthResult = await db.execute(sql`
      SELECT
        SUBSTRING(reco_date, 1, 7) as month,
        COUNT(*) as picks,
        COUNT(*) FILTER (WHERE status = 'target_hit') as hits,
        COALESCE(AVG(return_pct::numeric), 0) as avg_return
      FROM daily_picks
      WHERE status IN ('target_hit','stoploss_hit','expired')
      GROUP BY SUBSTRING(reco_date, 1, 7)
      ORDER BY month
    `);

    const monthlyPerformance: Record<string, any> = {};
    for (const mr of ((monthResult as any).rows || monthResult)) {
      const picks = parseInt(mr.picks || '0');
      monthlyPerformance[mr.month] = {
        picks,
        hitRate: picks > 0 ? Math.round((parseInt(mr.hits || '0') / picks) * 100 * 100) / 100 : 0,
        avgReturn: Math.round(parseFloat(mr.avg_return || '0') * 100) / 100,
      };
    }

    const confResult = await db.execute(sql`
      SELECT
        (COALESCE(confidence_score, 70) / 10) * 10 as bucket,
        COUNT(*) as predictions,
        COUNT(*) FILTER (WHERE status = 'target_hit') as correct
      FROM daily_picks
      WHERE status IN ('target_hit','stoploss_hit','expired')
      GROUP BY bucket
      ORDER BY bucket
    `);

    const confidenceAccuracy: Record<number, { predictions: number; correct: number }> = {};
    for (const cr of ((confResult as any).rows || confResult)) {
      confidenceAccuracy[parseInt(cr.bucket)] = {
        predictions: parseInt(cr.predictions || '0'),
        correct: parseInt(cr.correct || '0'),
      };
    }

    res.json({
      success: true,
      stats: {
        overall: {
          totalPicks: parseInt(r.total_picks || '0'),
          livePicks: parseInt(r.live_picks || '0'),
          completedPicks: completedCount,
          targetHits: targetHitsCount,
          stoplossHits: parseInt(r.stoploss_hits || '0'),
          hitRate: Math.round(hitRate * 100) / 100,
          avgReturn: Math.round(parseFloat(r.avg_return || '0') * 100) / 100,
          avgDaysHeld: Math.round(parseFloat(r.avg_days_held || '0')),
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

router.post("/refresh-prices", requireAdmin, async (req, res) => {
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
