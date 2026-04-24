import { db } from "../db";
import { dailyPicks, listedStocks, mutualFunds, bondCatalog, unlistedCompanies, companyRatios, companyFinancials, globalInstruments, instrumentMaster, sgbPrimaryIssues, stockFinancialMetrics, reits, invits, pickWatchlist, userNotifications, goldenPrices } from "@shared/schema";
import { eq, and, desc, gte, sql, ilike, or, asc, inArray } from "drizzle-orm";
import { unifiedAIRecommendationEngine } from "./unified-ai-recommendation-engine";
import { 
  isFundInvestable, 
  isETFInvestable, 
  logFilteredInstrument 
} from "./regulatory-investability-service";
import { getEnrichedStockSnapshot, getEnrichedStockSnapshots } from './screener/enriched-stock-data';
import type { EnrichedStockSnapshot } from './screener/enriched-stock-data';
import { marketRegimeDetector } from './risk';
import { aiGovernanceEngine } from './ai-governance';

// --- Strategy Imports ---
import { IPickStrategy } from './picks/types';
import { StockStrategy } from './picks/stock-strategy';
import { MutualFundStrategy } from './picks/mutual-fund-strategy';
import { UnlistedStrategy } from './picks/unlisted-strategy';
import { BondStrategy } from './picks/bond-strategy';
import { DerivativeStrategy } from './picks/derivative-strategy';
import { GlobalStockStrategy } from './picks/global-stock-strategy';
import { ETFStrategy } from './picks/etf-strategy';
import { SGBStrategy } from './picks/sgb-strategy';
import { REITInvITStrategy } from './picks/reit-invit-strategy';
import { FixedDepositStrategy } from './picks/fixed-deposit-strategy';

export type PickCategory = 
  | 'listed_stocks' 
  | 'mutual_funds' 
  | 'bonds' 
  | 'unlisted' 
  | 'global_stocks' 
  | 'etfs' 
  | 'reits_invits' 
  | 'fixed_deposits' 
  | 'sgb'
  | 'derivatives';

export type PickStatus = 'live' | 'target_hit' | 'stoploss_hit' | 'expired';

export const SCORER_VERSION = "3.0.0";
export const SCORER_MIN_THRESHOLD = 15;

export interface ScoreBreakdown {
  listingStageScore: number;
  pricingScore: number;
  sectorScore: number;
  governanceScore: number;
  riskAdjustment: number;
  fundamentalsScore: number;
  totalScore: number;
  scoringVersion: string;
  threshold: number;
  rankPosition?: number;
  totalCandidatesEvaluated?: number;
  eligibleCandidates?: number;
  riskBand?: 'Moderate' | 'Growth' | 'HighConviction';
}

export interface RationaleParams {
  name: string;
  category: PickCategory | string;
  currentPrice: number;
  targetPrice: number;
  stoplossPrice?: number;
  symbol?: string;
  strategy?: string;
  outlook?: string;
  metrics?: Record<string, any>;
}

export interface PickUpdateResult {
  updated: number;
  errors: number;
  details?: string[];
}

export interface DailyPickData {
  id?: number;
  category: PickCategory;
  instrumentId?: string;
  instrumentName: string;
  isin?: string;
  symbol?: string;
  market?: string;
  exchange?: string;
  recoDate: string;
  recoPrice: number;
  targetPrice: number;
  stoplossPrice: number;
  currentPrice?: number;
  status: PickStatus;
  expiryDate: string;
  returnPct?: number;
  daysHeld?: number;
  rationale: string;
  riskLevel: string;
  suitableFor: string[];
  keyMetrics?: {
    pe?: number;
    returns1y?: number;
    returns3y?: number;
    volatility?: number;
    sharpeRatio?: number;
    yield?: number;
    rating?: string;
    [key: string]: any;
  };
  timeHorizon?: string;
  confidenceScore?: number;
  sectorCategory?: string;
  updatedAt?: Date | string;
  statusUpdatedAt?: Date | string;
  scoringBreakdown?: ScoreBreakdown;
  riskScore?: number;
}

export class PickOfTheDayService {
  private strategies: Map<PickCategory, IPickStrategy>;
  private readonly DEFAULT_VALIDITY_DAYS = 30;

  constructor() {
    this.strategies = new Map();
    this.strategies.set('listed_stocks', new StockStrategy());
    this.strategies.set('mutual_funds', new MutualFundStrategy());
    this.strategies.set('unlisted', new UnlistedStrategy());
    this.strategies.set('bonds', new BondStrategy());
    this.strategies.set('derivatives', new DerivativeStrategy());
    this.strategies.set('global_stocks', new GlobalStockStrategy());
    this.strategies.set('etfs', new ETFStrategy());
    this.strategies.set('sgb', new SGBStrategy());
    this.strategies.set('reits_invits', new REITInvITStrategy());
    this.strategies.set('fixed_deposits', new FixedDepositStrategy());
  }

  private getStrategy(category: PickCategory): IPickStrategy {
    const strategy = this.strategies.get(category);
    if (!strategy) throw new Error(`No strategy found for category: ${category}`);
    return strategy;
  }

  async generateDailyPicks(): Promise<DailyPickData[]> {
    console.log(`[PickOfTheDay] Starting daily pick generation (v${SCORER_VERSION})...`);
    const generated: DailyPickData[] = [];
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Systemic Resilience Check: Detect Black Swan Regime
    const isBlackSwan = marketRegimeDetector.detectBlackSwanEvent();
    
    // Ordered by priority
    let categories: PickCategory[] = [
      'listed_stocks', 'mutual_funds', 'bonds', 'unlisted', 
      'global_stocks', 'etfs', 'reits_invits', 'sgb', 
      'fixed_deposits', 'derivatives'
    ];

    if (isBlackSwan) {
      console.warn(`🛑 [PickOfTheDay] 10σ Black Swan detected. Pivoting to Defensive Advasory mode.`);
      // Restriction: Only safe-haven/defensive assets allowed during systemic instability
      categories = ['sgb', 'bonds', 'fixed_deposits', 'mutual_funds'];
    }

    for (const category of categories) {
      try {
        const strategy = this.getStrategy(category);
        const recentIds = await this.getRecentlyPickedIds(category);

        const pick = await strategy.generate({
          today,
          regime: isBlackSwan ? 'BLACK_SWAN' : 'NORMAL',
          recentIds,
          service: this
        });

        if (pick) {
          // 2. Governance Gate: Every pick must pass suitability and compliance floors
          const aageCheck = await aiGovernanceEngine.validateAndResolve({
             user_id: "SYSTEM_ADVISORY",
             query: `Generate ${category} pick for ${today}`,
             ai_output: { recommendation: JSON.stringify(pick) },
             user_profile: { risk_profile: (isBlackSwan ? 'conservative' : 'aggressive') as any, investment_horizon: 'medium', kyc_status: 'verified', user_segment: 'retail' },
             trace_id: `POTD-${category}-${today}`
          });

          if (aageCheck.decision === "BLOCK") {
             console.warn(`⚠️ [PickOfTheDay] Governance Block for ${pick.instrumentName}: ${aageCheck.audit_id}`);
             continue;
          }

          await this.savePick(pick);
          generated.push(pick);
          console.log(`✅ [PickOfTheDay] Generated ${category} pick: ${pick.instrumentName}`);
        }
      } catch (error) {
        console.error(`❌ [PickOfTheDay] Failed to generate ${category} pick:`, error);
      }
    }

    return generated;
  }

  async syncPickPrices(): Promise<PickUpdateResult> {
    return this.refreshLivePicks();
  }

  async refreshLivePicks(): Promise<PickUpdateResult> {
    let updated = 0;
    let errors = 0;
    const details: string[] = [];
    
    try {
      const livePicks = await db.select().from(dailyPicks).where(eq(dailyPicks.status, 'live'));
      console.log(`[PickOfTheDay] Syncing prices for ${livePicks.length} live picks...`);

      for (const pick of livePicks) {
        try {
          const category = pick.category as PickCategory;
          const strategy = this.getStrategy(category);
          
          const livePrice = await strategy.getLivePrice(pick.instrumentId || pick.symbol || '');
          if (livePrice != null) {
            const recoPrice = parseFloat(pick.recoPrice);
            const returnPct = ((livePrice - recoPrice) / recoPrice) * 100;
            
            const recoDate = new Date(pick.recoDate);
            const daysHeld = Math.floor((Date.now() - recoDate.getTime()) / (1000 * 60 * 60 * 24));
            
            const targetPrice = parseFloat(pick.targetPrice);
            const stoplossPrice = parseFloat(pick.stoplossPrice);
            let newStatus: PickStatus = 'live';
            
            if (livePrice >= targetPrice) newStatus = 'target_hit';
            else if (livePrice <= stoplossPrice) newStatus = 'stoploss_hit';

            const expiryDate = new Date(pick.expiryDate);
            if (new Date() > expiryDate && newStatus === 'live') newStatus = 'expired';

            await db.update(dailyPicks).set({
              currentPrice: livePrice.toString(),
              returnPct: returnPct.toFixed(2),
              daysHeld,
              status: newStatus,
              updatedAt: new Date(),
              ...(newStatus !== pick.status ? { statusUpdatedAt: new Date() } : {})
            }).where(eq(dailyPicks.id, pick.id));

            updated++;
            if (newStatus !== pick.status) {
              details.push(`${pick.instrumentName}: ${pick.status} -> ${newStatus} @ ₹${livePrice}`);
            }
            
            if (newStatus !== 'live' && newStatus !== pick.status) {
               await this.notifyWatchlistSubscribers(pick, newStatus, livePrice, returnPct);
            }
          }
        } catch (err) {
          console.error(`[PickOfTheDay] Sync failure for ${pick.instrumentName}:`, err);
          errors++;
        }
      }
      return { updated, errors, details };
    } catch (error) {
      console.error("[PickOfTheDay] Error in refreshLivePicks:", error);
      return { updated, errors, details };
    }
  }

  async getTodaysPicks(): Promise<DailyPickData[]> {
    const today = new Date().toISOString().split('T')[0];
    const picks = await db.select().from(dailyPicks).where(eq(dailyPicks.recoDate, today)).orderBy(dailyPicks.category);
    return picks.map(p => this.transformPick(p));
  }

  async getLivePicks(): Promise<DailyPickData[]> {
    const picks = await db.select().from(dailyPicks).where(eq(dailyPicks.status, 'live')).orderBy(desc(dailyPicks.recoDate));
    return picks.map(p => this.transformPick(p));
  }

  async getPickHistory(category?: PickCategory, limit: number = 50): Promise<DailyPickData[]> {
    const conditions = [];
    if (category) {
      conditions.push(eq(dailyPicks.category, category));
    }
    
    const picks = await db.select()
      .from(dailyPicks)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dailyPicks.recoDate))
      .limit(limit);
    return picks.map(p => this.transformPick(p));
  }

  async getPerformanceStats(): Promise<any> {
    const allPicks = await db.select().from(dailyPicks);
    const totalPicks = allPicks.length;
    if (totalPicks === 0) return { totalPicks: 0, livePicks: 0, targetHits: 0, stoplossHits: 0, hitRate: 0, avgReturn: 0 };

    const resolved = allPicks.filter(p => p.status !== 'live');
    const targetHits = resolved.filter(p => p.status === 'target_hit').length;
    const hitRate = resolved.length > 0 ? (targetHits / resolved.length) * 100 : 0;
    
    const returns = allPicks.map(p => parseFloat(p.returnPct || '0')).filter(r => !isNaN(r));
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;

    return {
      totalPicks,
      livePicks: allPicks.filter(p => p.status === 'live').length,
      targetHits,
      stoplossHits: allPicks.filter(p => p.status === 'stoploss_hit').length,
      expired: allPicks.filter(p => p.status === 'expired').length,
      hitRate: parseFloat(hitRate.toFixed(2)),
      avgReturn: parseFloat(avgReturn.toFixed(2))
    };
  }

  async updatePickStatuses(): Promise<PickUpdateResult> {
    return this.refreshLivePicks();
  }

  async getRecentlyPickedIds(category: PickCategory): Promise<Set<string>> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14); // 2 weeks lookback
    
    const recent = await db
      .select({ instrumentId: dailyPicks.instrumentId, symbol: dailyPicks.symbol })
      .from(dailyPicks)
      .where(and(eq(dailyPicks.category, category), gte(dailyPicks.recoDate, cutoff.toISOString().split('T')[0])));
      
    const ids = new Set<string>();
    recent.forEach(r => {
      if (r.instrumentId) ids.add(r.instrumentId);
      if (r.symbol) ids.add(r.symbol);
    });
    return ids;
  }

  async generateRationale(params: RationaleParams): Promise<string> {
    try {
      const prompt = this.buildRationalePrompt(params);
      const category = params.category || 'stocks';
      const { result } = await unifiedAIRecommendationEngine.runPrompt<string>({
        prompt,
        category,
        responseParser: (text: string) => text,
        fallback: () => this.generateFallbackRationale(params),
      });
      return this.extractRationaleText(result || this.generateFallbackRationale(params));
    } catch (error) {
      console.error("[PickOfTheDay] AI rationale generation failed:", error);
      return this.generateFallbackRationale(params);
    }
  }

  private buildRationalePrompt(params: RationaleParams): string {
    const currentPrice = params.currentPrice ?? 0;
    const targetPrice = params.targetPrice ?? 0;
    const upside = currentPrice > 0 ? Math.round((targetPrice / currentPrice - 1) * 100) : 0;

    return `Generate a concise, professional investment rationale for today's pick.
Product: ${params.name}
Category: ${params.category}
Current Price: ₹${currentPrice}
Target Price: ₹${targetPrice} (${upside}% upside)
Metrics: ${JSON.stringify(params.metrics || {})}

Write a 2-3 sentence rationale explaining why this is today's top pick. Focus on key strengths and catalysts. Do not use markdown.`;
  }

  private generateFallbackRationale(params: RationaleParams): string {
    const currentPrice = params.currentPrice ?? 0;
    const targetPrice = params.targetPrice ?? 0;
    const upside = currentPrice > 0 ? Math.round((targetPrice / currentPrice - 1) * 100) : 0;
    return `${params.name} is selected as today's top pick based on strong fundamentals and a compelling target upside of ${upside}%. The technical outlook remains positive with favorable risk-reward indicators.`;
  }

  private extractRationaleText(raw: string): string {
    let text = raw.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
    if (text.startsWith('{')) {
      try {
        const parsed = JSON.parse(text);
        return (parsed.rationale || parsed.content || text).trim();
      } catch { return text; }
    }
    return text;
  }

  private async savePick(pick: DailyPickData): Promise<void> {
    await db.insert(dailyPicks).values({
      category: pick.category,
      instrumentId: pick.instrumentId,
      instrumentName: pick.instrumentName,
      isin: pick.isin,
      symbol: pick.symbol,
      market: pick.market,
      exchange: pick.exchange,
      recoDate: pick.recoDate,
      recoPrice: pick.recoPrice.toString(),
      targetPrice: pick.targetPrice.toString(),
      stoplossPrice: pick.stoplossPrice.toString(),
      currentPrice: pick.currentPrice?.toString() || pick.recoPrice.toString(),
      status: pick.status,
      expiryDate: pick.expiryDate,
      rationale: pick.rationale,
      riskLevel: pick.riskLevel,
      suitableFor: pick.suitableFor,
      keyMetrics: pick.keyMetrics,
      timeHorizon: pick.timeHorizon,
      confidenceScore: pick.confidenceScore || 70,
      sectorCategory: pick.sectorCategory,
      generatedBy: 'ai',
      updatedAt: new Date(),
    } as typeof dailyPicks.$inferInsert);
  }

  private async notifyWatchlistSubscribers(
    pick: typeof dailyPicks.$inferSelect, newStatus: PickStatus, currentPrice: number, returnPct: number
  ): Promise<void> {
    try {
      const subscribers = await db.select({ userId: pickWatchlist.userId }).from(pickWatchlist).where(eq(pickWatchlist.pickId, pick.id));
      if (subscribers.length === 0) return;

      const title = `${newStatus.toUpperCase()}: ${pick.instrumentName}`;
      const message = `${pick.instrumentName} has hit its ${newStatus.replace('_', ' ')} at ₹${currentPrice.toLocaleString()} with a ${returnPct.toFixed(1)}% return.`;

      for (const sub of subscribers) {
        await db.insert(userNotifications).values({
          userId: sub.userId,
          type: newStatus === 'target_hit' ? 'info' : 'alert',
          title,
          message,
          actionUrl: '/agent/picks',
          priority: newStatus === 'stoploss_hit' ? 'high' : 'medium',
        });
      }
    } catch (error) {
      console.error(`[PickOfTheDay] Notification failure:`, error);
    }
  }

  private transformPick(pick: typeof dailyPicks.$inferSelect): DailyPickData {
    return {
      id: pick.id,
      category: pick.category,
      instrumentId: pick.instrumentId ?? undefined,
      instrumentName: pick.instrumentName,
      isin: pick.isin ?? undefined,
      symbol: pick.symbol ?? undefined,
      market: pick.market ?? undefined,
      exchange: pick.exchange ?? undefined,
      recoDate: pick.recoDate,
      recoPrice: parseFloat(pick.recoPrice),
      targetPrice: parseFloat(pick.targetPrice),
      stoplossPrice: parseFloat(pick.stoplossPrice),
      currentPrice: pick.currentPrice ? parseFloat(pick.currentPrice) : undefined,
      status: pick.status,
      expiryDate: pick.expiryDate,
      returnPct: pick.returnPct ? parseFloat(pick.returnPct) : undefined,
      daysHeld: pick.daysHeld ?? undefined,
      rationale: pick.rationale,
      riskLevel: pick.riskLevel || 'medium',
      suitableFor: pick.suitableFor || [],
      keyMetrics: pick.keyMetrics ?? undefined,
      timeHorizon: pick.timeHorizon || 'medium_term',
      confidenceScore: pick.confidenceScore || 70,
      updatedAt: pick.updatedAt ?? undefined,
    };
  }

  async getMostRecentPicks(): Promise<DailyPickData[]> {
    const latestDate = await db.select({ maxDate: sql<string>`MAX(reco_date)` }).from(dailyPicks);
    const recoDate = latestDate[0]?.maxDate;
    if (!recoDate) return [];
    const picks = await db.select().from(dailyPicks).where(eq(dailyPicks.recoDate, recoDate)).orderBy(dailyPicks.category);
    return picks.map(p => this.transformPick(p));
  }

  async startDailyScheduler(): Promise<void> {
    await this.catchUpIfNeeded();
    
    // Simple 24h interval for now, can be refined to specific IST hours
    setInterval(() => this.scheduledGenerate(), 24 * 60 * 60 * 1000);
    setInterval(() => this.refreshLivePicks(), 12 * 60 * 60 * 1000);
    
    console.log(`📅 [PickOfTheDay] Scheduler started (Generation 24h, Prices 12h)`);
  }

  private async catchUpIfNeeded(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const existing = await db.select({ count: sql<number>`COUNT(*)` }).from(dailyPicks).where(eq(dailyPicks.recoDate, today));
    if (Number(existing[0]?.count || 0) === 0) {
      console.log(`🔄 [PickOfTheDay] Startup catch-up: generating picks for ${today}...`);
      await this.generateDailyPicks();
    }
  }

  private async scheduledGenerate(): Promise<void> {
    await this.generateDailyPicks();
  }
}

export const pickOfTheDayService = new PickOfTheDayService();
