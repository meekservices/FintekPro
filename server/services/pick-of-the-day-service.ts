import { db } from "../db";
import { dailyPicks, listedStocks, mutualFunds, bondCatalog, unlistedCompanies, companyRatios, companyFinancials, globalInstruments, instrumentMaster, sgbPrimaryIssues, stockFinancialMetrics, reits, invits, pickWatchlist, userNotifications, goldenPrices } from "@shared/schema";
import { eq, and, desc, gte, sql, ilike, or, asc, inArray } from "drizzle-orm";
import { callPython } from "../clients/python-client";
import { unifiedAIRecommendationEngine } from "./unified-ai-recommendation-engine";
import { FinancialMetricsCalculator } from "./financial-metrics-calculator";
import { 
  isFundInvestable, 
  isETFInvestable, 
  logFilteredInstrument 
} from "./regulatory-investability-service";
import { currencyExchangeService } from "./currency-exchange-service";
import { derivativesService } from './derivatives-service';
import { getEnrichedStockSnapshot, getEnrichedStockSnapshots } from './screener/enriched-stock-data';
import type { EnrichedStockSnapshot } from './screener/enriched-stock-data';

const financialMetricsCalculator = new FinancialMetricsCalculator();

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
  keyMetrics?: Record<string, any>;
  timeHorizon?: string;
  confidenceScore?: number;
  sectorCategory?: string;
  updatedAt?: Date | string;
  statusUpdatedAt?: Date | string;
  scoringBreakdown?: ScoreBreakdown;
  riskScore?: number;
}

interface StockCandidate {
  id: string;
  symbol: string;
  name: string;
  isin?: string;
  currentPrice: number;
  sector?: string;
  peRatio?: number;
  returns1Y?: number;
  returns3Y?: number;
  fintekproRating?: number;
  volatility?: number;
  marketCap?: string;
}

class PickOfTheDayService {
  private readonly DEFAULT_VALIDITY_DAYS = 30;
  private readonly ROTATION_DAYS = 7;
  private recentPicksCache: Map<string, Set<string>> = new Map();
  private _isGeneratingPicks = false;
  private _generationPromise: Promise<DailyPickData[]> | null = null;

  constructor() {
    const status = unifiedAIRecommendationEngine.getStatus();
    console.log(`✅ Pick of the Day Service initialized via Unified Engine (primary: ${status.primary})`);
    
    const isProduction = process.env.NODE_ENV === 'production' || process.env.REPL_DEPLOYMENT === '1';
    const refreshIntervalMs = isProduction ? 4 * 60 * 60 * 1000 : 30 * 60 * 1000; // 4h prod / 30min dev
    
    // Initial refresh after boot — delayed to 90 s so the T+45s Python health probe fires first
    // and resets the circuit breaker before we attempt ml/score calls.
    setTimeout(() => {
      this.refreshLivePicks()
        .then(r => console.log(`📊 [PickOfTheDay] Initial price refresh: ${r.updated} updated, ${r.errors} errors`))
        .catch(e => console.error("[PickOfTheDay] Initial refresh failed:", e));
    }, 90000);

    // Periodic refresh
    setInterval(() => {
      this.refreshLivePicks()
        .then(r => {
          if (r.updated > 0) {
            console.log(`📊 [PickOfTheDay] Periodic refresh: ${r.updated} updated, ${r.errors} errors`);
          }
        })
        .catch(e => console.error("[PickOfTheDay] Periodic refresh failed:", e));
    }, refreshIntervalMs);
    
    console.log(`📊 [PickOfTheDay] Price refresh active: every ${isProduction ? '4h' : '30min'}`);
  }

  // Get time horizon by category
  private getTimeHorizon(category: PickCategory): string {
    switch (category) {
      case 'listed_stocks':
      case 'global_stocks':
      case 'etfs':
        return 'short_term'; // 0-1 year
      case 'mutual_funds':
      case 'bonds':
      case 'fixed_deposits':
        return 'medium_term'; // 1-3 years
      case 'unlisted':
      case 'reits_invits':
      case 'sgb':
        return 'long_term'; // 3+ years
      default:
        return 'medium_term';
    }
  }

  // Get confidence score based on data quality and scoring
  private getConfidenceScore(category: PickCategory, score: number, maxScore: number): number {
    // Base confidence from scoring ratio (50-90 range)
    const scoreRatio = score / Math.max(maxScore, 1);
    let confidence = Math.round(50 + scoreRatio * 40);
    
    // Category adjustments
    switch (category) {
      case 'listed_stocks':
      case 'mutual_funds':
        confidence += 5; // More data available
        break;
      case 'unlisted':
        confidence -= 10; // Less liquid, more uncertainty
        break;
      case 'global_stocks':
        confidence -= 5; // Currency risk
        break;
    }
    
    return Math.min(100, Math.max(0, confidence));
  }

  private async getRecentlyPickedIds(category: PickCategory): Promise<Set<string>> {
    const cacheKey = category;
    if (this.recentPicksCache.has(cacheKey)) {
      return this.recentPicksCache.get(cacheKey)!;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.ROTATION_DAYS);
    const cutoff = cutoffDate.toISOString().split('T')[0];

    const recentPicks = await db
      .select({ instrumentId: dailyPicks.instrumentId })
      .from(dailyPicks)
      .where(
        and(
          eq(dailyPicks.category, category),
          gte(dailyPicks.recoDate, cutoff)
        )
      );

    const ids = new Set(recentPicks.map(p => p.instrumentId).filter(Boolean) as string[]);
    this.recentPicksCache.set(cacheKey, ids);
    return ids;
  }

  private clearRotationCache(): void {
    this.recentPicksCache.clear();
  }

  private filterRecentPicks<T extends { id?: string | number }>(
    candidates: T[],
    recentIds: Set<string>,
    idExtractor: (item: T) => string
  ): T[] {
    const filtered = candidates.filter(c => !recentIds.has(idExtractor(c)));
    if (filtered.length === 0) {
      console.log(`[PickOfTheDay] All candidates were recently picked, allowing repeats`);
      return candidates;
    }
    return filtered;
  }

  private applyRegimeAdjustments(picks: DailyPickData[], regime: string): void {
    for (const pick of picks) {
      if (!pick.keyMetrics) pick.keyMetrics = {};
      (pick.keyMetrics as any).regime = regime;

      switch (regime) {
        case 'bear':
          if (['listed_stocks', 'global_stocks', 'unlisted'].includes(pick.category)) {
            pick.confidenceScore = Math.max(30, (pick.confidenceScore || 70) - 10);
            pick.riskLevel = pick.riskLevel === 'low' ? 'medium' : pick.riskLevel === 'medium' ? 'high' : pick.riskLevel;
          }
          if (['bonds', 'sgb', 'fixed_deposits'].includes(pick.category)) {
            pick.confidenceScore = Math.min(95, (pick.confidenceScore || 70) + 5);
          }
          break;

        case 'bull':
          if (['listed_stocks', 'etfs', 'global_stocks'].includes(pick.category)) {
            pick.confidenceScore = Math.min(95, (pick.confidenceScore || 70) + 5);
          }
          break;

        case 'high_vol':
          if (['listed_stocks', 'global_stocks', 'derivatives'].includes(pick.category)) {
            pick.confidenceScore = Math.max(30, (pick.confidenceScore || 70) - 15);
            pick.riskLevel = 'high';
          }
          if (['bonds', 'sgb', 'fixed_deposits'].includes(pick.category)) {
            pick.confidenceScore = Math.min(95, (pick.confidenceScore || 70) + 10);
          }
          break;

        case 'sideways':
          break;
      }
    }
  }

  private getDynamicTargetStoploss(
    category: PickCategory,
    volatility?: number
  ): { targetPct: number; stoplossPct: number } {
    const baseTargets: Record<string, { target: number; stoploss: number }> = {
      listed_stocks: { target: 0.15, stoploss: 0.08 },
      mutual_funds: { target: 0.12, stoploss: 0.05 },
      bonds: { target: 0.08, stoploss: 0.03 },
      global_stocks: { target: 0.15, stoploss: 0.08 },
      etfs: { target: 0.10, stoploss: 0.05 },
      sgb: { target: 0.08, stoploss: 0.03 },
      reits_invits: { target: 0.12, stoploss: 0.06 },
      unlisted: { target: 0.25, stoploss: 0.15 },
      fixed_deposits: { target: 0, stoploss: 0 },
    };

    const base = baseTargets[category] || { target: 0.12, stoploss: 0.06 };

    if (!volatility || volatility <= 0 || category === 'fixed_deposits') {
      return { targetPct: base.target, stoplossPct: base.stoploss };
    }

    const volFactor = volatility / 20;
    const adjustedTarget = Math.min(base.target * (0.7 + 0.3 * volFactor), base.target * 1.5);
    const adjustedStoploss = Math.min(base.stoploss * (0.7 + 0.3 * volFactor), base.stoploss * 1.5);

    return {
      targetPct: Math.round(adjustedTarget * 1000) / 1000,
      stoplossPct: Math.round(adjustedStoploss * 1000) / 1000,
    };
  }

  async getTodaysPicks(): Promise<DailyPickData[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const picks = await db
      .select()
      .from(dailyPicks)
      .where(eq(dailyPicks.recoDate, today))
      .orderBy(dailyPicks.category);
    
    return picks.map(this.transformPick);
  }

  async getLivePicks(): Promise<DailyPickData[]> {
    const picks = await db
      .select()
      .from(dailyPicks)
      .where(eq(dailyPicks.status, 'live'))
      .orderBy(desc(dailyPicks.recoDate), desc(dailyPicks.id));

    // Deduplicate: for the same instrument+category keep the most recent pick only.
    // Picks are already sorted newest-first so the first occurrence wins.
    const seen = new Set<string>();
    const deduped = picks.filter(p => {
      const key = (p.instrumentId ?? p.instrumentName ?? '') + '::' + p.category;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped.map(this.transformPick);
  }

  async getPickHistory(category?: PickCategory, limit = 50): Promise<DailyPickData[]> {
    let query = db.select().from(dailyPicks);
    
    if (category) {
      query = query.where(eq(dailyPicks.category, category)) as any;
    }
    
    const picks = await query
      .orderBy(desc(dailyPicks.recoDate))
      .limit(limit);
    
    return picks.map(this.transformPick);
  }

  async getPerformanceStats(): Promise<{
    totalPicks: number;
    livePicks: number;
    targetHits: number;
    stoplossHits: number;
    expired: number;
    hitRate: number;
    avgReturn: number;
    byCategory: Record<string, { total: number; hits: number; hitRate: number }>;
  }> {
    const overallResult = await db.execute(sql`
      SELECT
        COUNT(*) as total_picks,
        COUNT(*) FILTER (WHERE status = 'live') as live_picks,
        COUNT(*) FILTER (WHERE status = 'target_hit') as target_hits,
        COUNT(*) FILTER (WHERE status = 'stoploss_hit') as stoploss_hits,
        COUNT(*) FILTER (WHERE status = 'expired') as expired,
        COALESCE(AVG(return_pct::numeric) FILTER (WHERE return_pct IS NOT NULL), 0) as avg_return
      FROM daily_picks
    `);

    const row = (overallResult as any).rows?.[0] || (overallResult as any)[0] || {};
    const totalPicks = parseInt(row.total_picks || '0');
    const livePicks = parseInt(row.live_picks || '0');
    const targetHits = parseInt(row.target_hits || '0');
    const stoplossHits = parseInt(row.stoploss_hits || '0');
    const expired = parseInt(row.expired || '0');
    const avgReturn = Math.round(parseFloat(row.avg_return || '0') * 100) / 100;

    const closedTotal = targetHits + stoplossHits + expired;
    const hitRate = closedTotal > 0 ? Math.round((targetHits / closedTotal) * 100) : 0;

    const categoryResult = await db.execute(sql`
      SELECT
        category,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'target_hit') as hits
      FROM daily_picks
      GROUP BY category
    `);

    const byCategory: Record<string, { total: number; hits: number; hitRate: number }> = {};
    const catRows = (categoryResult as any).rows || categoryResult;
    for (const catRow of catRows) {
      const catTotal = parseInt(catRow.total || '0');
      const catHits = parseInt(catRow.hits || '0');
      byCategory[catRow.category] = {
        total: catTotal,
        hits: catHits,
        hitRate: catTotal > 0 ? Math.round((catHits / catTotal) * 100) : 0,
      };
    }

    return { totalPicks, livePicks, targetHits, stoplossHits, expired, hitRate, avgReturn, byCategory };
  }

  async generateDailyPicks(): Promise<DailyPickData[]> {
    // Concurrency guard: if already generating, return the in-flight promise to avoid duplicate picks
    if (this._isGeneratingPicks && this._generationPromise) {
      console.log('[PickOfTheDay] Generation already in progress — awaiting existing run');
      return this._generationPromise;
    }

    this._isGeneratingPicks = true;
    this._generationPromise = this._generateDailyPicksInternal().finally(() => {
      this._isGeneratingPicks = false;
      this._generationPromise = null;
    });
    return this._generationPromise;
  }

  private async _generateDailyPicksInternal(): Promise<DailyPickData[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const existingPicks = await db
      .select()
      .from(dailyPicks)
      .where(eq(dailyPicks.recoDate, today));
    
    // Per-category check: only generate for categories not yet covered by admin or prior run
    const ALL_CATEGORIES: PickCategory[] = [
      'listed_stocks', 'mutual_funds', 'bonds', 'unlisted',
      'global_stocks', 'etfs', 'sgb', 'reits_invits',
      'fixed_deposits', 'derivatives',
    ];
    const existingCategories = new Set(existingPicks.map(p => p.category));
    const missingCategories = ALL_CATEGORIES.filter(c => !existingCategories.has(c));
    // Track instrument+category combos already picked today to prevent same-day same-instrument duplicates
    const existingInstrumentKeys = new Set(
      existingPicks.map(p => (p.instrumentId ?? p.instrumentName ?? '') + '::' + p.category)
    );
    (this as any)._existingInstrumentKeys = existingInstrumentKeys;

    if (missingCategories.length === 0) {
      console.log(`[PickOfTheDay] Picks already exist for ${today}: ${existingPicks.length} picks (all categories covered)`);
      return existingPicks.map(this.transformPick);
    }

    if (existingPicks.length > 0) {
      console.log(`[PickOfTheDay] Partial picks for ${today} (${existingPicks.length} exist). Auto-generating missing: ${missingCategories.join(', ')}`);
    }

    let currentRegime: string | null = null;
    // ── Python sidecar regime (GMM + 6-signal) — primary ─────────────────────
    try {
      const pyRegime = await callPython<any>('/api/regime/detect', 'POST', { lookback_days: 90 });
      if (pyRegime?.regime) {
        currentRegime = pyRegime.regime;
        console.log(`[PickOfTheDay] Python regime: ${currentRegime} (signal_score: ${pyRegime.signal_score?.toFixed(2)}, confidence: ${(pyRegime.confidence * 100)?.toFixed(0)}%)`);
      }
    } catch {
      // Python unavailable — fall through to local engine
    }
    // ── Local regime engine fallback ──────────────────────────────────────────
    if (!currentRegime) {
      try {
        const { aiRegimeDetectionEngine } = await import('./ai-regime-detection-engine');
        const regime = await aiRegimeDetectionEngine.getCurrentRegime();
        if (regime) {
          currentRegime = regime.regimeLabel;
          console.log(`[PickOfTheDay] Local regime: ${currentRegime} (confidence: ${regime.confidence}%)`);
        } else {
          const detected = await aiRegimeDetectionEngine.detectCurrentRegime();
          await aiRegimeDetectionEngine.persistRegime(detected);
          currentRegime = detected.regimeLabel;
          console.log(`[PickOfTheDay] Local regime (on-demand): ${currentRegime}`);
        }
      } catch (err) {
        console.warn('[PickOfTheDay] Regime detection unavailable, proceeding without regime context');
      }
    }
    // ─────────────────────────────────────────────────────────────────────────
    (this as any)._currentRegime = currentRegime;

    this.clearRotationCache();

    // Start with admin-created picks that already exist
    const picks: DailyPickData[] = existingPicks.map(this.transformPick);

    // Only generate for categories not already covered
    const need = (cat: PickCategory) => missingCategories.includes(cat);

    if (need('listed_stocks')) {
      const p = await this.generateStockPick();
      if (p) picks.push(p);
    }
    if (need('mutual_funds')) {
      const p = await this.generateMutualFundPick();
      if (p) picks.push(p);
    }
    if (need('bonds')) {
      const p = await this.generateBondPick();
      if (p) picks.push(p);
    }
    if (need('unlisted')) {
      const p = await this.generateUnlistedPick();
      if (p) picks.push(p);
    }
    if (need('global_stocks')) {
      const p = await this.generateGlobalStockPick();
      if (p) picks.push(p);
    }
    if (need('etfs')) {
      const p = await this.generateETFPick();
      if (p) picks.push(p);
    }
    if (need('sgb')) {
      const p = await this.generateSGBPick();
      if (p) picks.push(p);
    }
    if (need('reits_invits')) {
      const p = await this.generateREITInvITPick();
      if (p) picks.push(p);
    }
    if (need('fixed_deposits')) {
      const p = await this.generateFixedDepositPick();
      if (p) picks.push(p);
    }
    if (need('derivatives')) {
      const p = await this.generateDerivativesPick();
      if (p) picks.push(p);
    }

    if (currentRegime) {
      this.applyRegimeAdjustments(picks, currentRegime);
    }

    try {
      const { aiMLScoringEngine } = await import('./ai-ml-scoring-engine');
      for (const pick of picks) {
        const features = pick.keyMetrics || {};
        const numericFeatures: Record<string, number> = {};
        for (const [k, v] of Object.entries(features)) {
          if (typeof v === 'number') numericFeatures[k] = v;
        }
        if (Object.keys(numericFeatures).length > 0) {
          const mlResult = await aiMLScoringEngine.score(
            pick.instrumentId || pick.symbol || pick.instrumentName,
            pick.category, numericFeatures, currentRegime || undefined
          );
          if (mlResult) {
            pick.confidenceScore = Math.round(mlResult.confidence);
            if (!pick.keyMetrics) pick.keyMetrics = {};
            (pick.keyMetrics as any).mlPredictedReturn = mlResult.predictedReturn;
            (pick.keyMetrics as any).mlModelVersion = mlResult.modelVersion;
            (pick.keyMetrics as any).mlFeatureContributions = mlResult.featureContributions;

            // ── Python GBR ML Score blend ──────────────────────────────────────
            try {
              const pyML = await callPython<any>('/api/ml/score', 'POST', {
                assetClass: pick.category,
                assets: [{
                  id: pick.instrumentId || pick.symbol || pick.instrumentName,
                  returns1y: numericFeatures.returns1Y ?? numericFeatures.returns1y ?? null,
                  returns3y: numericFeatures.returns3Y ?? numericFeatures.returns3y ?? null,
                  volatility: numericFeatures.volatility ?? null,
                  sharpeRatio: numericFeatures.sharpeRatio ?? null,
                  pe: numericFeatures.pe ?? numericFeatures.peRatio ?? null,
                  yield: numericFeatures.yield ?? null,
                  confidenceScore: pick.confidenceScore,
                }],
                regime: currentRegime ?? 'sideways',
              });
              if (pyML?.results?.length && !pyML.error) {
                const pyScore = pyML.results[0];
                if (pyScore?.predictedReturn != null) {
                  const pyDelta = Math.min(15, Math.max(-15, pyScore.predictedReturn * 100));
                  pick.confidenceScore = Math.min(95, Math.max(20, Math.round(
                    pick.confidenceScore * 0.7 + (pick.confidenceScore + pyDelta) * 0.3
                  )));
                  (pick.keyMetrics as any).pyMlPredictedReturn = pyScore.predictedReturn;
                  (pick.keyMetrics as any).pyMlConfidence = pyScore.confidence;
                  (pick.keyMetrics as any).scorerVersion = SCORER_VERSION;
                }
              }
            } catch {
              // Python GBR unavailable — local ML confidence used
            }
            // ──────────────────────────────────────────────────────────────────
          }
        }
      }
    } catch (err) {
      console.warn('[PickOfTheDay] ML scoring unavailable, using rule-based scoring');
    }

    for (const pick of picks) {
      await this.savePick(pick);
    }

    try {
      const { aiBacktestingEngine } = await import('./ai-backtesting-engine');
      for (const pick of picks) {
        await aiBacktestingEngine.snapshotFeatures(
          pick.instrumentId || pick.symbol || pick.instrumentName,
          pick.category,
          pick.keyMetrics || {},
          currentRegime || undefined,
          pick.confidenceScore
        );
      }
    } catch (err) {
      console.warn('[PickOfTheDay] Feature snapshot failed (non-critical):', err);
    }

    console.log(`✅ [PickOfTheDay] Generated ${picks.length} picks for ${today}${currentRegime ? ` (regime: ${currentRegime})` : ''}`);
    return picks;
  }

  private async generateStockPick(): Promise<DailyPickData | null> {
    try {
      const stocks = await db
        .select()
        .from(listedStocks)
        .where(
          and(
            eq(listedStocks.isPublished, true),
            sql`${listedStocks.currentPrice} IS NOT NULL`,
            sql`CAST(${listedStocks.currentPrice} AS DECIMAL) > 50`
          )
        )
        .limit(100);

      if (stocks.length === 0) {
        console.log("[PickOfTheDay] No suitable stocks found");
        return null;
      }

      const recentIds = await this.getRecentlyPickedIds('listed_stocks');
      const freshStocks = this.filterRecentPicks(stocks, recentIds, s => s.id);

      const stockSymbols = freshStocks.map(s => s.symbol).filter(Boolean) as string[];
      let enrichedSnapshots: Map<string, EnrichedStockSnapshot> = new Map();
      try {
        enrichedSnapshots = await getEnrichedStockSnapshots(stockSymbols);
      } catch (err) {
        console.warn("[PickOfTheDay] Failed to fetch enriched snapshots, continuing without:", err);
      }

      const scoredStocksRaw = await Promise.all(
        freshStocks.map(async stock => {
          const enriched = stock.symbol ? enrichedSnapshots.get(stock.symbol.toUpperCase()) || null : null;
          return {
            stock,
            enriched,
            score: await this.scoreStock(stock, enriched),
          };
        })
      );
      const scoredStocks = scoredStocksRaw.sort((a, b) => b.score - a.score);

      const topStock = scoredStocks[0].stock;
      const topEnriched = scoredStocks[0].enriched;
      const currentPrice = parseFloat(topStock.currentPrice || "0");
      const volatility = topStock.volatility ? parseFloat(topStock.volatility) : undefined;
      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('listed_stocks', volatility);
      const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

      let directRsi: number | null = null;
      let directRoic: number | null = null;
      const needsRsi = !topEnriched?.technicals?.rsi;
      const needsRoic = !topEnriched?.fundamentals?.roic;

      if (needsRoic && topStock.roce) {
        directRoic = parseFloat(topStock.roce);
        if (!isNaN(directRoic)) {
          console.log(`[PickOfTheDay] ROCE fallback for ROIC on ${topStock.symbol}: ${directRoic.toFixed(2)}%`);
        } else {
          directRoic = null;
        }
      }

      // ── RSI from golden_prices (NSE-sourced, no Yahoo Finance) ─────────────
      if (needsRsi && (topStock.isin || topStock.symbol)) {
        try {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 35);
          const priceRows = await db
            .select({ price: goldenPrices.price, priceDate: goldenPrices.priceDate })
            .from(goldenPrices)
            .where(
              and(
                topStock.isin
                  ? eq(goldenPrices.isin, topStock.isin)
                  : eq(goldenPrices.symbol, topStock.symbol!),
                gte(goldenPrices.priceDate, cutoff.toISOString().split('T')[0])
              )
            )
            .orderBy(asc(goldenPrices.priceDate))
            .limit(40);
          if (priceRows.length >= 15) {
            const closes = priceRows.map(r => parseFloat(r.price));
            let gains = 0, losses = 0;
            for (let i = closes.length - 14; i < closes.length; i++) {
              const diff = closes[i] - closes[i - 1];
              if (diff > 0) gains += diff;
              else losses += Math.abs(diff);
            }
            const avgGain = gains / 14;
            const avgLoss = losses / 14;
            directRsi = avgLoss === 0 ? 100 : Math.round((100 - (100 / (1 + avgGain / avgLoss))) * 100) / 100;
            console.log(`[PickOfTheDay] Golden prices RSI(14) for ${topStock.symbol}: ${directRsi}`);
          }
        } catch (err) {
          console.warn(`[PickOfTheDay] Golden prices RSI fallback failed for ${topStock.symbol}:`, err);
        }
      }

      // ── RSI fallback via yahoo-finance2 when golden_prices is empty ──────────
      if (needsRsi && directRsi === null && topStock.symbol) {
        try {
          const yahooFinance = require('yahoo-finance2').default;
          const nseSymbol = `${topStock.symbol}.NS`;
          const period1 = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const historical = await yahooFinance.historical(nseSymbol, { period1, interval: '1d' });
          if (historical && historical.length >= 15) {
            const closes = historical.map((h: any) => h.close as number);
            let gains = 0, losses = 0;
            for (let i = closes.length - 14; i < closes.length; i++) {
              const diff = closes[i] - closes[i - 1];
              if (diff > 0) gains += diff;
              else losses += Math.abs(diff);
            }
            const avgGain = gains / 14;
            const avgLoss = losses / 14;
            directRsi = avgLoss === 0 ? 100 : Math.round((100 - (100 / (1 + avgGain / avgLoss))) * 100) / 100;
            console.log(`[PickOfTheDay] Yahoo Finance RSI(14) for ${topStock.symbol}: ${directRsi}`);
          }
        } catch (err) {
          console.warn(`[PickOfTheDay] Yahoo Finance RSI fallback failed for ${topStock.symbol}:`, err);
        }
      }
      // ─────────────────────────────────────────────────────────────────────────

      const enrichedRationaleData: Record<string, any> = {};
      if (topEnriched) {
        if (topEnriched.dcf?.upsidePercent != null) {
          enrichedRationaleData.dcfUpside = topEnriched.dcf.upsidePercent;
        }
        if (topEnriched.fundamentals?.roic != null) {
          enrichedRationaleData.roic = topEnriched.fundamentals.roic;
        }
        if (topEnriched.growth?.epsGrowth != null) {
          enrichedRationaleData.epsGrowth = topEnriched.growth.epsGrowth;
        }
        if (topEnriched.companyRating?.ratingRecommendation) {
          enrichedRationaleData.companyRating = topEnriched.companyRating.ratingRecommendation;
        }
        if (topEnriched.technicals?.rsi != null) {
          enrichedRationaleData.rsi = topEnriched.technicals.rsi;
        }
        if (topEnriched.analystTargets?.avgPriceTarget != null) {
          enrichedRationaleData.analystAvgTarget = topEnriched.analystTargets.avgPriceTarget;
          enrichedRationaleData.analystCount = topEnriched.analystTargets.count;
        }
      }
      if (directRoic != null && !enrichedRationaleData.roic) {
        enrichedRationaleData.roic = directRoic;
      }
      if (directRsi != null && !enrichedRationaleData.rsi) {
        enrichedRationaleData.rsi = directRsi;
      }

      const rationale = await this.generateRationale({
        category: 'listed_stocks',
        name: topStock.companyName || topStock.symbol,
        symbol: topStock.symbol,
        sector: topStock.sector,
        currentPrice,
        targetPrice,
        stoplossPrice,
        peRatio: topStock.peRatio ? parseFloat(topStock.peRatio) : undefined,
        returns1Y: topStock.returns1Y ? parseFloat(topStock.returns1Y) : undefined,
        analystRating: topStock.analystRating,
        ...enrichedRationaleData,
      });

      const exchange = topStock.nseCode ? 'NSE' : (topStock.bseCode ? 'BSE' : 'NSE');
      
      return {
        category: 'listed_stocks',
        instrumentId: topStock.id,
        instrumentName: topStock.companyName || topStock.symbol,
        isin: topStock.isin || undefined,
        symbol: topStock.symbol,
        exchange,
        recoDate: new Date().toISOString().split('T')[0],
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(this.DEFAULT_VALIDITY_DAYS),
        rationale,
        riskLevel: this.getRiskLevel(topStock.volatility ? parseFloat(topStock.volatility) : 20),
        suitableFor: this.deriveSuitableFor(this.getRiskLevel(topStock.volatility ? parseFloat(topStock.volatility) : 20), 'listed_stocks'),
        timeHorizon: this.getTimeHorizon('listed_stocks'),
        confidenceScore: this.getConfidenceScore('listed_stocks', scoredStocks[0].score, 70),
        sectorCategory: topStock.sector,
        keyMetrics: {
          cmp: currentPrice,
          pe: topStock.peRatio ? parseFloat(topStock.peRatio) : null,
          returns1y: topStock.returns1Y ? parseFloat(topStock.returns1Y) : null,
          returns3y: topStock.returns3Y ? parseFloat(topStock.returns3Y) : null,
          volatility: topStock.volatility ? parseFloat(topStock.volatility) : null,
          sector: topStock.sector,
          marketCap: topStock.marketCap,
          analystRating: topStock.analystRating,
          dividendYield: topStock.dividendYield ? parseFloat(topStock.dividendYield) : null,
          roic: topEnriched?.fundamentals?.roic ?? directRoic ?? null,
          epsGrowth: topEnriched?.growth?.epsGrowth ?? null,
          dcfUpside: topEnriched?.dcf?.upsidePercent ?? null,
          enrichedRating: topEnriched?.companyRating?.ratingRecommendation ?? null,
          rsi: topEnriched?.technicals?.rsi ?? directRsi ?? null,
          institutionalHolderCount: topEnriched?.institutional?.totalCount ?? null,
          analystAvgTarget: topEnriched?.analystTargets?.avgPriceTarget ?? null,
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating stock pick:", error);
      return null;
    }
  }

  private async generateMutualFundPick(): Promise<DailyPickData | null> {
    try {
      const funds = await db
        .select()
        .from(mutualFunds)
        .where(
          and(
            eq(mutualFunds.isPublished, true),
            sql`${mutualFunds.nav} IS NOT NULL`,
            sql`${mutualFunds.nav}::float > 0`,
            sql`(${mutualFunds.category} IS NULL OR ${mutualFunds.category} NOT ILIKE '%ETF%')`,
            sql`${mutualFunds.schemeName} NOT ILIKE '%ETF%'`,
            sql`(${mutualFunds.lastUpdated} IS NULL OR ${mutualFunds.lastUpdated} > NOW() - INTERVAL '45 days')`
          )
        )
        .limit(100);

      if (funds.length === 0) {
        console.log("[PickOfTheDay] No suitable mutual funds found");
        return null;
      }

      // Strip ETF-type schemes — must not appear in the MF category pick
      const nonEtfFunds = funds.filter(fund => {
        const name = (fund.schemeName || '').toUpperCase();
        const cat = (fund.category || '').toUpperCase();
        const isEtf = name.includes('ETF') || name.includes('BEES') || name.includes('EXCHANGE TRADED') ||
          cat.includes('ETF') || cat.includes('EXCHANGE TRADED');
        if (isEtf) logFilteredInstrument('mutual_fund', fund.schemeName, 'ETF scheme filtered from MF category');
        return !isEtf;
      });

      // Filter out non-investable funds (overseas funds with frozen limits, etc.)
      const investableFunds = nonEtfFunds.filter(fund => {
        const investability = isFundInvestable(fund);
        if (!investability.investable) {
          logFilteredInstrument('mutual_fund', fund.schemeName, investability.reason || 'Unknown');
          return false;
        }
        return true;
      });

      if (investableFunds.length === 0) {
        console.log("[PickOfTheDay] No investable mutual funds found after regulatory filtering");
        return null;
      }

      const recentIds = await this.getRecentlyPickedIds('mutual_funds');
      const freshFunds = this.filterRecentPicks(investableFunds, recentIds, f => f.schemeCode);

      const scoredFunds = freshFunds.map(fund => ({
        fund,
        score: this.scoreMutualFund(fund),
      })).sort((a, b) => b.score - a.score);

      const topFund = scoredFunds[0].fund;
      const currentNav = parseFloat(topFund.nav || "0");
      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('mutual_funds');
      const targetNav = Math.round(currentNav * (1 + targetPct) * 100) / 100;
      const stoplossNav = Math.round(currentNav * (1 - stoplossPct) * 100) / 100;

      const rationale = await this.generateRationale({
        category: 'mutual_funds',
        name: topFund.schemeName,
        fundHouse: topFund.fundHouse,
        category2: topFund.category,
        currentPrice: currentNav,
        targetPrice: targetNav,
        stoplossPrice: stoplossNav,
        returns1Y: topFund.returns1Y ? parseFloat(topFund.returns1Y) : undefined,
        returns3Y: topFund.returns3Y ? parseFloat(topFund.returns3Y) : undefined,
        smartRating: topFund.crisilRating,
        expenseRatio: topFund.expenseRatio ? parseFloat(topFund.expenseRatio) : undefined,
      });

      return {
        category: 'mutual_funds',
        instrumentId: topFund.schemeCode,
        instrumentName: topFund.schemeName,
        isin: topFund.isin || undefined,
        symbol: topFund.schemeCode,
        recoDate: new Date().toISOString().split('T')[0],
        recoPrice: currentNav,
        targetPrice: targetNav,
        stoplossPrice: stoplossNav,
        currentPrice: currentNav,
        status: 'live',
        expiryDate: this.getExpiryDate(90),
        rationale,
        riskLevel: topFund.riskLevel || 'medium',
        suitableFor: this.deriveSuitableFor(topFund.riskLevel, 'mutual_funds'),
        timeHorizon: this.getTimeHorizon('mutual_funds'),
        confidenceScore: this.getConfidenceScore('mutual_funds', scoredFunds[0].score, 70),
        sectorCategory: topFund.category,
        keyMetrics: {
          cmp: currentNav,
          nav: currentNav,
          returns1y: topFund.returns1Y ? parseFloat(topFund.returns1Y) : null,
          returns3y: topFund.returns3Y ? parseFloat(topFund.returns3Y) : null,
          returns5y: topFund.returns5y ? parseFloat(topFund.returns5y) : null,
          smartRating: topFund.crisilRating,
          riskAdjustedScore: topFund.crisilRiskAdjustedScore ? parseFloat(topFund.crisilRiskAdjustedScore) : null,
          fundHouse: topFund.fundHouse,
          category: topFund.category,
          subCategory: topFund.schemeSubCategory || null,
          expenseRatio: topFund.expenseRatio ? parseFloat(topFund.expenseRatio) : null,
          aum: topFund.aum ? parseFloat(topFund.aum) : null,
          exitLoadPercent: topFund.exitLoadPercent ? parseFloat(topFund.exitLoadPercent) : null,
          exitLoadDays: topFund.exitLoadDays || null,
          minSipAmount: topFund.minSipAmount ? parseFloat(topFund.minSipAmount) : null,
          benchmarkIndex: topFund.benchmarkIndex || null,
          riskLevel: topFund.riskLevel,
          planType: topFund.planType,
          schemeStatus: topFund.schemeStatus,
          isin: topFund.isin || null,
          launchDate: topFund.launchDate || null,
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating MF pick:", error);
      return null;
    }
  }

  private async generateBondPick(): Promise<DailyPickData | null> {
    try {
      const bonds = await db
        .select()
        .from(bondCatalog)
        .where(
          and(
            eq(bondCatalog.status, 'published'),
            sql`${bondCatalog.cleanPrice} IS NOT NULL`
          )
        )
        .orderBy(desc(bondCatalog.yieldToMaturity))
        .limit(20);

      if (bonds.length === 0) {
        console.log("[PickOfTheDay] No suitable bonds found");
        return null;
      }

      const recentIds = await this.getRecentlyPickedIds('bonds');
      const freshBonds = this.filterRecentPicks(bonds, recentIds, b => b.id?.toString() || '');

      const scoredBonds = freshBonds.map(bond => ({
        bond,
        score: this.scoreBond(bond),
      })).sort((a, b) => b.score - a.score);

      const topBond = scoredBonds[0].bond;
      const currentPrice = parseFloat(topBond.cleanPrice || "100");
      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('bonds');
      const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

      const rationale = await this.generateRationale({
        category: 'bonds',
        name: topBond.bondName,
        issuer: topBond.issuerName,
        currentPrice,
        targetPrice,
        stoplossPrice,
        yield: topBond.yieldToMaturity ? parseFloat(topBond.yieldToMaturity) : undefined,
        couponRate: topBond.couponRate ? parseFloat(topBond.couponRate) : undefined,
        creditRating: topBond.creditRating,
        maturityDate: topBond.maturityDate,
      });

      // Bonds trade on NSE/BSE - use exchange field from bondCatalog or default to NSE
      const exchange = topBond.exchange || 'NSE';

      return {
        category: 'bonds',
        instrumentId: topBond.id?.toString(),
        instrumentName: topBond.bondName,
        isin: topBond.isin || undefined,
        symbol: topBond.symbol || undefined,
        exchange,
        recoDate: new Date().toISOString().split('T')[0],
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(180),
        rationale,
        riskLevel: 'low',
        suitableFor: ['Conservative', 'Balanced'],
        timeHorizon: this.getTimeHorizon('bonds'),
        confidenceScore: this.getConfidenceScore('bonds', scoredBonds[0].score, 50),
        sectorCategory: topBond.creditRating || 'Fixed Income',
        keyMetrics: {
          cmp: currentPrice,
          yieldToMaturity: topBond.yieldToMaturity ? parseFloat(topBond.yieldToMaturity) : null,
          yieldToCall: topBond.yieldToCall ? parseFloat(topBond.yieldToCall) : null,
          couponRate: topBond.couponRate ? parseFloat(topBond.couponRate) : null,
          couponType: topBond.couponType,
          couponFrequency: topBond.couponFrequency,
          creditRating: topBond.creditRating,
          ratingAgency: topBond.ratingAgency,
          outlookStatus: topBond.outlookStatus,
          issuer: topBond.issuerName,
          bondType: topBond.bondType,
          faceValue: topBond.faceValue ? parseFloat(topBond.faceValue) : null,
          tenorYears: topBond.tenorYears ? parseFloat(topBond.tenorYears) : null,
          duration: topBond.duration ? parseFloat(topBond.duration) : null,
          modifiedDuration: topBond.modifiedDuration ? parseFloat(topBond.modifiedDuration) : null,
          issueDate: topBond.issueDate,
          maturityDate: topBond.maturityDate,
          secured: topBond.secured,
          securityType: topBond.securityType,
          minimumInvestment: topBond.minimumInvestment ? parseFloat(topBond.minimumInvestment) : null,
          exchange,
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating bond pick:", error);
      return null;
    }
  }

  private async generateUnlistedPick(): Promise<DailyPickData | null> {
    try {
      // Fetch all active unlisted companies — no price gate (auto-publish from AI scoring)
      const companies = await db
        .select()
        .from(unlistedCompanies)
        .where(
          and(
            eq(unlistedCompanies.status, 'active'),
            sql`${unlistedCompanies.tradingSuspended} = false`
          )
        )
        .limit(40);

      if (companies.length === 0) {
        console.log("[PickOfTheDay] No active unlisted companies found");
        return null;
      }

      const recentIds = await this.getRecentlyPickedIds('unlisted');
      const freshCompanies = this.filterRecentPicks(companies, recentIds, c => c.id);

      // Fetch latest financial ratios for all candidates in one query
      const companyIds = freshCompanies.map(c => c.id);
      const ratiosRows = await db
        .select()
        .from(companyRatios)
        .where(inArray(companyRatios.companyId, companyIds))
        .orderBy(desc(companyRatios.financialYear));

      // Build a ratios map (latest FY per company)
      const ratiosMap = new Map<string, typeof ratiosRows[0]>();
      for (const row of ratiosRows) {
        if (!ratiosMap.has(row.companyId)) {
          ratiosMap.set(row.companyId, row);
        }
      }

      // Fetch latest financials for revenue and cash flow data
      const financialsRows = await db
        .select()
        .from(companyFinancials)
        .where(inArray(companyFinancials.companyId, companyIds))
        .orderBy(desc(companyFinancials.financialYear));

      const financialsMap = new Map<string, typeof financialsRows[0]>();
      for (const row of financialsRows) {
        if (!financialsMap.has(row.companyId)) {
          financialsMap.set(row.companyId, row);
        }
      }

      // Score each company — returns a full ScoreBreakdown for SEBI audit traceability
      const scoredCompanies = freshCompanies.map(company => {
        const ratios = ratiosMap.get(company.id);
        const financials = financialsMap.get(company.id);
        const breakdown = this.scoreUnlistedWithRatios(company, ratios, financials);
        return { company, ratios, financials, breakdown };
      }).sort((a, b) => b.breakdown.totalScore - a.breakdown.totalScore);

      const eligibleCompanies = scoredCompanies.filter(c => c.breakdown.totalScore >= SCORER_MIN_THRESHOLD);

      // Structured telemetry — satisfies observability requirement
      console.log("[UNLISTED_PICK_SCORING]", JSON.stringify({
        scoringVersion: SCORER_VERSION,
        totalCandidates: freshCompanies.length,
        eligibleCount: eligibleCompanies.length,
        threshold: SCORER_MIN_THRESHOLD,
        topScore: scoredCompanies[0]?.breakdown.totalScore ?? 0,
        topCompany: scoredCompanies[0]?.company.name ?? 'none',
      }));

      if (scoredCompanies.length === 0) {
        console.log("[PickOfTheDay] No scorable unlisted companies found");
        return null;
      }
      if (eligibleCompanies.length === 0) {
        throw new Error(`No companies met scoring threshold of ${SCORER_MIN_THRESHOLD} — top score: ${scoredCompanies[0].breakdown.totalScore}`);
      }

      const top = eligibleCompanies[0];
      // Annotate breakdown with rank and audit context
      top.breakdown.rankPosition = 1;
      top.breakdown.totalCandidatesEvaluated = freshCompanies.length;
      top.breakdown.eligibleCandidates = eligibleCompanies.length;

      const { company, ratios, financials } = top;

      // Auto-price: publishedBuyPrice → draftBuyPrice → book value → faceValue → 100
      let currentPrice = 0;
      let priceSource = 'published';
      if (company.publishedBuyPrice && parseFloat(company.publishedBuyPrice) > 0) {
        currentPrice = parseFloat(company.publishedBuyPrice);
        priceSource = 'published';
      } else if (company.draftBuyPrice && parseFloat(company.draftBuyPrice) > 0) {
        currentPrice = parseFloat(company.draftBuyPrice);
        priceSource = 'draft';
      } else if (financials?.networth && company.totalShares && company.totalShares > 0) {
        currentPrice = Math.round((parseFloat(financials.networth) / company.totalShares) * 100) / 100;
        priceSource = 'book_value';
      } else if (company.faceValue && parseFloat(company.faceValue) > 0) {
        currentPrice = parseFloat(company.faceValue);
        priceSource = 'face_value';
      } else {
        currentPrice = 100;
        priceSource = 'placeholder';
      }

      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('unlisted');
      const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

      // Build rich keyMetrics from all available ratio data
      const keyMetrics: Record<string, any> = {
        cin: company.cin,
        isin: company.isin,
        sector: company.sector,
        industry: company.industry,
        listingStage: company.listingStage,
        lotSize: (company as any).minOrderQuantity,
        pricingStatus: company.pricingStatus,
        priceSource,
        identityConfidence: company.identityConfidence ? parseFloat(company.identityConfidence) : null,
        complianceStatus: company.complianceStatus,
        riskCategory: company.riskCategory,
        paidUpCapital: company.paidUpCapital ? parseFloat(company.paidUpCapital) : null,
        totalShares: company.totalShares,
        faceValue: company.faceValue ? parseFloat(company.faceValue) : null,
      };

      // Add ratio data if available
      if (ratios) {
        if (ratios.roe != null) keyMetrics.roe = parseFloat(ratios.roe);
        if (ratios.roce != null) keyMetrics.roce = parseFloat(ratios.roce);
        if (ratios.roa != null) keyMetrics.roa = parseFloat(ratios.roa);
        if (ratios.debtEquity != null) keyMetrics.debtToEquity = parseFloat(ratios.debtEquity);
        if (ratios.revenueGrowth != null) keyMetrics.revenueGrowth = parseFloat(ratios.revenueGrowth);
        if (ratios.profitGrowth != null) keyMetrics.profitGrowth = parseFloat(ratios.profitGrowth);
        if (ratios.marginEbitda != null) keyMetrics.ebitdaMargin = parseFloat(ratios.marginEbitda);
        if (ratios.marginPat != null) keyMetrics.patMargin = parseFloat(ratios.marginPat);
        if (ratios.marginOperating != null) keyMetrics.operatingMargin = parseFloat(ratios.marginOperating);
        if (ratios.peRatio != null) keyMetrics.peRatio = parseFloat(ratios.peRatio);
        if (ratios.pbRatio != null) keyMetrics.pbRatio = parseFloat(ratios.pbRatio);
        if (ratios.evEbitda != null) keyMetrics.evEbitda = parseFloat(ratios.evEbitda);
        if (ratios.currentRatio != null) keyMetrics.currentRatio = parseFloat(ratios.currentRatio);
        if (ratios.interestCoverage != null) keyMetrics.interestCoverage = parseFloat(ratios.interestCoverage);
        if (ratios.assetTurnover != null) keyMetrics.assetTurnover = parseFloat(ratios.assetTurnover);
        keyMetrics.ratiosFY = ratios.financialYear;
      }

      // Add income statement and cash flow data if available
      if (financials) {
        if (financials.revenue != null) keyMetrics.revenue = parseFloat(financials.revenue);
        if (financials.ebitda != null) keyMetrics.ebitda = parseFloat(financials.ebitda);
        if (financials.pat != null) keyMetrics.pat = parseFloat(financials.pat);
        if (financials.networth != null) keyMetrics.networth = parseFloat(financials.networth);
        if (financials.totalDebt != null) keyMetrics.totalDebt = parseFloat(financials.totalDebt);
        if (financials.freeCashFlow != null) keyMetrics.freeCashFlow = parseFloat(financials.freeCashFlow);
        if (financials.operatingCashFlow != null) keyMetrics.operatingCashFlow = parseFloat(financials.operatingCashFlow);
        keyMetrics.financialsFY = financials.financialYear;
        keyMetrics.dataSource = financials.dataSource;
        keyMetrics.dataQualityScore = financials.dataQualityScore;
      }

      keyMetrics.aiScore = top.breakdown.totalScore;
      keyMetrics.scoringVersion = SCORER_VERSION;
      keyMetrics.riskBand = top.breakdown.riskBand;
      keyMetrics.scoringBreakdown = top.breakdown;

      const rationale = await this.generateRationale({
        category: 'unlisted',
        name: company.name,
        sector: company.sector,
        currentPrice,
        targetPrice,
        stoplossPrice,
        listingStage: company.listingStage,
        roe: keyMetrics.roe,
        debtToEquity: keyMetrics.debtToEquity,
        revenueGrowth: keyMetrics.revenueGrowth,
        ebitdaMargin: keyMetrics.ebitdaMargin,
        pbRatio: keyMetrics.pbRatio,
        priceSource,
      });

      return {
        category: 'unlisted',
        instrumentId: company.id,
        instrumentName: company.name,
        isin: company.isin || undefined,
        symbol: company.cin || undefined,
        recoDate: new Date().toISOString().split('T')[0],
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(365),
        rationale,
        riskLevel: 'high',
        suitableFor: ['Aggressive'],
        timeHorizon: this.getTimeHorizon('unlisted'),
        confidenceScore: this.getConfidenceScore('unlisted', top.breakdown.totalScore, 100),
        sectorCategory: company.sector || 'Pre-IPO / Unlisted',
        keyMetrics,
        scoringBreakdown: top.breakdown,
        riskScore: top.breakdown.riskAdjustment,
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating unlisted pick:", error);
      return null;
    }
  }

  private mapMarketCode(market: string): string {
    const marketMap: Record<string, string> = {
      "US": "us",
      "UK": "uk_europe",
      "EU": "uk_europe",
      "DE": "uk_europe",
      "FR": "uk_europe",
      "JP": "japan",
      "HK": "china",
      "CN": "china",
      "SG": "other",
      "AU": "other",
      "IN": "other",
    };
    return marketMap[market?.toUpperCase()] || "other";
  }

  private scoreGlobalStock(instrument: any): number {
    let score = 0;
    
    const returns1Y = instrument.returns1Y ? parseFloat(instrument.returns1Y) : 0;
    if (returns1Y > 30) score += 25;
    else if (returns1Y > 15) score += 18;
    else if (returns1Y > 0) score += 10;
    
    const pe = instrument.peRatio ? parseFloat(instrument.peRatio) : 0;
    if (pe > 0 && pe < 15) score += 15;
    else if (pe >= 15 && pe < 25) score += 10;
    else if (pe >= 25 && pe < 40) score += 5;
    
    const marketCap = parseFloat(instrument.marketCap || "0");
    if (marketCap > 100000000000) score += 15;
    else if (marketCap > 10000000000) score += 10;
    else if (marketCap > 1000000000) score += 5;
    
    const epsGrowth = parseFloat(instrument.epsGrowth || "0");
    if (epsGrowth > 20) score += 10;
    else if (epsGrowth > 10) score += 5;
    
    return score;
  }

  private async generateGlobalStockPick(): Promise<DailyPickData | null> {
    try {
      // First try to get stocks with prices
      let instruments = await db
        .select()
        .from(globalInstruments)
        .where(
          and(
            eq(globalInstruments.assetClass, "stock"),
            eq(globalInstruments.isActive, true),
            sql`${globalInstruments.lastPrice} IS NOT NULL`
          )
        )
        .limit(30);

      // If no stocks with prices, get any active stocks (use mock price)
      if (instruments.length === 0) {
        instruments = await db
          .select()
          .from(globalInstruments)
          .where(
            and(
              eq(globalInstruments.assetClass, "stock"),
              eq(globalInstruments.isActive, true)
            )
          )
          .limit(30);
      }

      if (instruments.length === 0) {
        console.log("[PickOfTheDay] No global stocks found in database");
        return null;
      }

      const recentIds = await this.getRecentlyPickedIds('global_stocks');
      const freshInstruments = this.filterRecentPicks(instruments, recentIds, i => i.id);

      const scoredInstruments = freshInstruments.map(inst => ({
        instrument: inst,
        score: this.scoreGlobalStock(inst),
      })).sort((a, b) => b.score - a.score);

      const topInstrument = scoredInstruments[0].instrument;
      const currentPrice = parseFloat(topInstrument.lastPrice || "0") ||
        await this.getLiveGlobalPrice(topInstrument.symbol || '', topInstrument.id) ||
        100;
      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('global_stocks');
      const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;
      const market = this.mapMarketCode(topInstrument.market);

      const rationale = await this.generateRationale({
        category: "global_stocks",
        name: topInstrument.name,
        symbol: topInstrument.symbol,
        sector: topInstrument.sector,
        currentPrice,
        targetPrice,
        stoplossPrice,
        returns1Y: topInstrument.returns1Y ? parseFloat(topInstrument.returns1Y) : undefined,
        peRatio: topInstrument.peRatio ? parseFloat(topInstrument.peRatio) : undefined,
      });

      console.log(`[PickOfTheDay] Generated global stock pick: ${topInstrument.symbol} (${market})`);

      // Detect exchange from symbol suffix or market data
      const detectGlobalExchange = (): string => {
        const sym = topInstrument.symbol?.toUpperCase() || '';
        if (topInstrument.exchange) return topInstrument.exchange;
        if (sym.endsWith('.O') || market === 'us') return 'NASDAQ';
        if (sym.endsWith('.N') || sym.endsWith('.K')) return 'NYSE';
        if (sym.endsWith('.L')) return 'LSE';
        if (sym.endsWith('.T')) return 'TSE';
        if (sym.endsWith('.HK')) return 'HKEX';
        return 'NASDAQ'; // Default for US stocks
      };
      const exchange = detectGlobalExchange();

      return {
        category: "global_stocks",
        instrumentId: topInstrument.id,
        instrumentName: topInstrument.name,
        isin: topInstrument.isin || undefined,
        symbol: topInstrument.symbol,
        market,
        exchange,
        recoDate: new Date().toISOString().split("T")[0],
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: "live",
        expiryDate: this.getExpiryDate(this.DEFAULT_VALIDITY_DAYS),
        rationale,
        riskLevel: "medium",
        suitableFor: this.deriveSuitableFor(null, 'global_stocks'),
        timeHorizon: this.getTimeHorizon('global_stocks'),
        confidenceScore: this.getConfidenceScore('global_stocks', scoredInstruments[0].score, 60),
        sectorCategory: topInstrument.sector || 'Global Equity',
        keyMetrics: {
          cmp: currentPrice,
          pe: topInstrument.peRatio ? parseFloat(topInstrument.peRatio) : null,
          returns1y: topInstrument.returns1Y ? parseFloat(topInstrument.returns1Y) : null,
          currency: topInstrument.currency,
          sector: topInstrument.sector,
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating global stock pick:", error);
      return null;
    }
  }

  private async generateETFPick(): Promise<DailyPickData | null> {
    try {
      const etfs = await db
        .select({
          id: instrumentMaster.id,
          name: instrumentMaster.name,
          symbol: instrumentMaster.symbol,
          isin: instrumentMaster.isin,
          category: instrumentMaster.category,
          assetClass: instrumentMaster.assetClass,
          issuer: instrumentMaster.issuer,
          currency: instrumentMaster.currency,
          lastPrice: instrumentMaster.lastPrice,
        })
        .from(instrumentMaster)
        .where(
          and(
            eq(instrumentMaster.assetClass, 'mutual_fund'),
            eq(instrumentMaster.category, 'ETF'),
            sql`${instrumentMaster.lastPrice} IS NOT NULL`
          )
        )
        .limit(100);

      if (etfs.length === 0) {
        console.log("[PickOfTheDay] No ETFs found in database");
        return null;
      }

      // Filter out non-investable ETFs (overseas ETFs with frozen limits)
      const investableETFs = etfs.filter(etf => {
        const investability = isETFInvestable(etf);
        if (!investability.investable) {
          logFilteredInstrument('etfs', etf.name, investability.reason || 'Unknown');
          return false;
        }
        return true;
      });

      if (investableETFs.length === 0) {
        console.log("[PickOfTheDay] No investable ETFs found after regulatory filtering");
        return null;
      }

      const recentIds = await this.getRecentlyPickedIds('etfs');
      const freshETFs = this.filterRecentPicks(investableETFs, recentIds, e => e.id);

      const scoredETFs = freshETFs.map(etf => ({
        etf,
        score: this.scoreETF(etf),
      })).sort((a, b) => b.score - a.score);

      const topETF = scoredETFs[0].etf;
      const currentPrice = parseFloat(topETF.lastPrice || "0");
      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('etfs');
      const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

      const rationale = await this.generateRationale({
        category: 'etfs',
        name: topETF.name,
        issuer: topETF.issuer,
        currentPrice,
        targetPrice,
        stoplossPrice,
        trackingIndex: topETF.name.includes('Nifty') ? 'Nifty' : topETF.name.includes('Gold') ? 'Gold' : 'Other',
      });

      console.log(`[PickOfTheDay] Generated ETF pick: ${topETF.name}`);

      // ETFs trade on NSE/BSE - default to NSE (most common)
      const exchange = 'NSE';

      return {
        category: 'etfs',
        instrumentId: topETF.id,
        instrumentName: topETF.name,
        isin: topETF.isin || undefined,
        symbol: topETF.symbol || undefined,
        exchange,
        recoDate: new Date().toISOString().split('T')[0],
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(60), // 60 days for ETFs
        rationale,
        riskLevel: 'medium',
        suitableFor: this.deriveETFSuitableFor(topETF.name, topETF.category),
        timeHorizon: this.getTimeHorizon('etfs'),
        confidenceScore: this.getConfidenceScore('etfs', scoredETFs[0].score, 60),
        sectorCategory: topETF.category || 'ETF',
        keyMetrics: {
          cmp: currentPrice,
          issuer: topETF.issuer,
          category: topETF.category,
          currency: topETF.currency,
          nav: currentPrice,
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating ETF pick:", error);
      return null;
    }
  }

  private async generateSGBPick(): Promise<DailyPickData | null> {
    try {
      const sgbs = await db
        .select()
        .from(sgbPrimaryIssues)
        .where(eq(sgbPrimaryIssues.issueStatus, 'open'))
        .limit(10);

      if (sgbs.length === 0) {
        // Fall back to upcoming SGBs
        const upcomingSgbs = await db
          .select()
          .from(sgbPrimaryIssues)
          .where(eq(sgbPrimaryIssues.issueStatus, 'upcoming'))
          .limit(10);

        if (upcomingSgbs.length === 0) {
          console.log("[PickOfTheDay] No open or upcoming SGBs found");
          return null;
        }
        
        const topSGB = upcomingSgbs[0];
        return this.createSGBPick(topSGB);
      }

      const topSGB = sgbs[0];
      return this.createSGBPick(topSGB);
    } catch (error) {
      console.error("[PickOfTheDay] Error generating SGB pick:", error);
      return null;
    }
  }

  private async createSGBPick(sgb: any): Promise<DailyPickData> {
    const issuePrice = parseFloat(sgb.issuePrice || sgb.issuePricePerGram || "0");
    const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('sgb');
    const targetPrice = Math.round(issuePrice * (1 + targetPct) * 100) / 100;
    const stoplossPrice = Math.round(issuePrice * (1 - stoplossPct) * 100) / 100;

    const rationale = await this.generateRationale({
      category: 'sgb',
      name: sgb.seriesName,
      seriesCode: sgb.seriesCode,
      issuePrice,
      targetPrice,
      stoplossPrice,
      interestRate: sgb.interestRate,
      tenorYears: sgb.tenorYears,
      maturityDate: sgb.maturityDate,
    });

    console.log(`[PickOfTheDay] Generated SGB pick: ${sgb.seriesName}`);

    return {
      category: 'sgb',
      instrumentId: sgb.id,
      instrumentName: sgb.seriesName,
      symbol: sgb.seriesCode,
      recoDate: new Date().toISOString().split('T')[0],
      recoPrice: issuePrice,
      targetPrice,
      stoplossPrice,
      currentPrice: issuePrice,
      status: 'live',
      expiryDate: this.getExpiryDate(365), // 365 days for SGBs
      rationale,
      riskLevel: 'low',
      suitableFor: ['Conservative', 'Balanced'],
      keyMetrics: {
        seriesCode: sgb.seriesCode,
        issuePrice: issuePrice,
        issuePricePerGram: issuePrice,
        gramsPerUnit: 1,
        goldPurity: '24k',
        interestRate: sgb.interestRate ? parseFloat(String(sgb.interestRate)) : null,
        interestPaymentFrequency: 'semi_annual',
        tenorYears: sgb.tenorYears ? parseFloat(String(sgb.tenorYears)) : null,
        issueDate: sgb.issueDate || null,
        maturityDate: sgb.maturityDate,
        issueStatus: sgb.issueStatus,
        openDate: sgb.openDate || null,
        closeDate: sgb.closeDate || null,
        capitalGainsTaxExempt: sgb.capitalGainsTaxExempt ?? true,
        underlying: 'Gold (24 Carat)',
        exchange: 'NSE/BSE',
      },
    };
  }

  private async generateREITInvITPick(): Promise<DailyPickData | null> {
    try {
      // Query from dedicated reits table using raw SQL for columns
      const reitsList = await db.execute(sql`
        SELECT 
          id, name, symbol, isin_code as isin, sector, 
          current_price::numeric as "currentPrice",
          distribution_yield::numeric as "dividendYield",
          nav::numeric,
          'REIT' as type
        FROM reits 
        WHERE is_active = true AND current_price IS NOT NULL
        LIMIT 25
      `);

      // Query from dedicated invits table
      const invitsList = await db.execute(sql`
        SELECT 
          id, name, symbol, isin_code as isin, sector,
          current_price::numeric as "currentPrice",
          distribution_yield::numeric as "dividendYield",
          nav::numeric,
          'InvIT' as type
        FROM invits 
        WHERE is_active = true AND current_price IS NOT NULL
        LIMIT 25
      `);

      const allReitsInvits = [...(reitsList.rows || []), ...(invitsList.rows || [])] as any[];

      if (allReitsInvits.length === 0) {
        console.log("[PickOfTheDay] No REITs/InvITs found in database - skipping category");
        return null;
      }

      const recentIds = await this.getRecentlyPickedIds('reits_invits');
      const freshReitsInvits = this.filterRecentPicks(
        allReitsInvits, recentIds, r => String(r.id)
      );

      const scoredReits = freshReitsInvits.map(reit => ({
        reit,
        score: this.scoreREIT(reit),
      })).sort((a, b) => b.score - a.score);

      const topReit = scoredReits[0].reit;
      const currentPrice = parseFloat(String(topReit.currentPrice || topReit.current_price || "0"));
      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('reits_invits');
      const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

      const rationale = await this.generateRationale({
        category: 'reits_invits',
        name: topReit.name,
        symbol: topReit.symbol,
        currentPrice,
        targetPrice,
        stoplossPrice,
        dividendYield: topReit.dividendYield,
      });

      console.log(`[PickOfTheDay] Generated REIT/InvIT pick: ${topReit.name}`);

      // REITs/InvITs trade on NSE/BSE - determine from symbol or default to NSE
      const exchange = topReit.symbol?.includes('BSE') ? 'BSE' : 'NSE';

      return {
        category: 'reits_invits',
        instrumentId: String(topReit.id),
        instrumentName: topReit.name || 'Unknown REIT/InvIT',
        isin: topReit.isin || undefined,
        symbol: topReit.symbol || undefined,
        exchange,
        recoDate: new Date().toISOString().split('T')[0],
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(180),
        rationale,
        riskLevel: 'medium',
        suitableFor: ['Balanced', 'Aggressive'],
        timeHorizon: this.getTimeHorizon('reits_invits'),
        confidenceScore: this.getConfidenceScore('reits_invits', scoredReits[0].score, 50),
        sectorCategory: topReit.type || 'REIT/InvIT',
        keyMetrics: {
          type: topReit.type,
          sector: topReit.sector,
          dividendYield: topReit.dividendYield ? parseFloat(String(topReit.dividendYield)) : null,
          nav: topReit.nav ? parseFloat(String(topReit.nav)) : null,
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating REIT/InvIT pick:", error);
      return null;
    }
  }

  private scoreREIT(reit: any): number {
    let score = 0;
    
    const dividendYield = parseFloat(String(reit.dividendYield || '0'));
    if (dividendYield >= 7) score += 25;
    else if (dividendYield >= 5) score += 20;
    else if (dividendYield >= 3) score += 12;
    else if (dividendYield > 0) score += 5;

    const nav = parseFloat(String(reit.nav || '0'));
    const price = parseFloat(String(reit.currentPrice || reit.current_price || reit.lastPrice || '0'));
    if (nav > 0 && price > 0) {
      const navDiscount = ((nav - price) / nav) * 100;
      if (navDiscount > 10) score += 20;
      else if (navDiscount > 5) score += 15;
      else if (navDiscount > 0) score += 8;
    }

    if (price > 200 && price < 1000) score += 10;
    else if (price > 0) score += 5;

    const name = reit.name?.toLowerCase() || '';
    if (name.includes('embassy') || name.includes('brookfield')) score += 5;
    else if (name.includes('mindspace') || name.includes('nexus')) score += 4;

    return score;
  }

  private scoreFD(fd: any): number {
    let score = 0;

    const issuer = fd.issuer?.toLowerCase() || '';
    if (issuer.includes('sbi') || issuer.includes('hdfc') || issuer.includes('icici')) score += 25;
    else if (issuer.includes('axis') || issuer.includes('kotak') || issuer.includes('bajaj')) score += 20;
    else if (issuer.includes('bank') || issuer.includes('finance')) score += 12;
    else score += 5;

    const name = fd.name?.toLowerCase() || '';
    if (name.includes('senior citizen') || name.includes('senior')) score += 10;
    if (name.includes('tax') || name.includes('5 year')) score += 8;
    if (name.includes('cumulative')) score += 5;

    return score;
  }

  private async generateFixedDepositPick(): Promise<DailyPickData | null> {
    try {
      const fds = await db
        .select({
          id: instrumentMaster.id,
          name: instrumentMaster.name,
          symbol: instrumentMaster.symbol,
          isin: instrumentMaster.isin,
          category: instrumentMaster.category,
          assetClass: instrumentMaster.assetClass,
          issuer: instrumentMaster.issuer,
        })
        .from(instrumentMaster)
        .where(
          or(
            eq(instrumentMaster.category, 'FD'),
            eq(instrumentMaster.assetClass, 'fixed_deposit'),
            sql`LOWER(${instrumentMaster.category}) = 'fixed deposit'`
          )
        )
        .limit(50);

      if (fds.length === 0) {
        console.log("[PickOfTheDay] No Fixed Deposits found in database - skipping category");
        return null;
      }

      const recentIds = await this.getRecentlyPickedIds('fixed_deposits');
      const freshFDs = this.filterRecentPicks(fds, recentIds, f => f.id);

      const scoredFDs = freshFDs.map(fd => ({
        fd,
        score: this.scoreFD(fd),
      })).sort((a, b) => b.score - a.score);

      const topFD = scoredFDs[0].fd;

      const rationale = await this.generateRationale({
        category: 'fixed_deposits',
        name: topFD.name,
        issuer: topFD.issuer,
      });

      console.log(`[PickOfTheDay] Generated Fixed Deposit pick: ${topFD.name}`);

      return {
        category: 'fixed_deposits',
        instrumentId: topFD.id,
        instrumentName: topFD.name,
        symbol: topFD.symbol,
        recoDate: new Date().toISOString().split('T')[0],
        recoPrice: 0,
        targetPrice: 0,
        stoplossPrice: 0,
        currentPrice: 0,
        status: 'live',
        expiryDate: this.getExpiryDate(365),
        rationale,
        riskLevel: 'low',
        suitableFor: ['Conservative', 'Balanced'],
        timeHorizon: this.getTimeHorizon('fixed_deposits'),
        confidenceScore: 75,
        sectorCategory: 'Fixed Income',
        keyMetrics: {
          issuer: topFD.issuer,
          category: topFD.category,
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating Fixed Deposit pick:", error);
      return null;
    }
  }

  private async generateDerivativesPick(): Promise<DailyPickData | null> {
    try {
      const { symbols, lotSizes } = await derivativesService.getAvailableSymbols();

      const indexSymbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'];
      const stockSymbols = symbols.filter(s => !indexSymbols.includes(s) && !['MIDCPNIFTY'].includes(s));

      const recentDerivatives = this.recentPicksCache.get('derivatives') || new Set<string>();

      const useIndex = Math.random() > 0.4;
      const candidatePool = useIndex ? indexSymbols : stockSymbols;
      const availableCandidates = candidatePool.filter(s => !recentDerivatives.has(s));
      const selectedSymbol = availableCandidates.length > 0
        ? availableCandidates[Math.floor(Math.random() * availableCandidates.length)]
        : candidatePool[Math.floor(Math.random() * candidatePool.length)];

      const chain = await derivativesService.getOptionsChain(selectedSymbol);
      const spotPrice = chain.underlyingValue;
      const nearestExpiry = chain.expiryDates[0];
      const lotSize = lotSizes[selectedSymbol] || 50;

      const strategies = [
        { name: 'Bull Call Spread', outlook: 'bullish', risk: 'medium' },
        { name: 'Bear Put Spread', outlook: 'bearish', risk: 'medium' },
        { name: 'Long Call', outlook: 'bullish', risk: 'high' },
        { name: 'Long Put', outlook: 'bearish', risk: 'high' },
        { name: 'Iron Condor', outlook: 'neutral', risk: 'low' },
        { name: 'Long Straddle', outlook: 'volatile', risk: 'high' },
        { name: 'Covered Call', outlook: 'neutral', risk: 'medium' },
      ];

      const strategy = strategies[Math.floor(Math.random() * strategies.length)];
      const isIndex = indexSymbols.includes(selectedSymbol);
      const strikeInterval = isIndex ? (selectedSymbol === 'BANKNIFTY' ? 100 : 50) : this.getDerivativeStrikeInterval(spotPrice);
      const atmStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;

      const atmCall = chain.options.calls.find(c => c.strikePrice === atmStrike);
      const atmPut = chain.options.puts.find(p => p.strikePrice === atmStrike);
      const otmCallStrike = atmStrike + strikeInterval * 2;
      const otmPutStrike = atmStrike - strikeInterval * 2;
      const otmCall = chain.options.calls.find(c => c.strikePrice === otmCallStrike);
      const otmPut = chain.options.puts.find(p => p.strikePrice === otmPutStrike);

      let entryPrice: number;
      let targetPrice: number;
      let stoplossPrice: number;
      let maxProfit: number | string;
      let maxLoss: number | string;
      let breakeven: number[];
      let strategyLegs: string;
      let marginRequired: number;

      const callPremium = atmCall?.lastPrice || spotPrice * 0.02;
      const putPremium = atmPut?.lastPrice || spotPrice * 0.02;
      const otmCallPremium = otmCall?.lastPrice || spotPrice * 0.01;
      const otmPutPremium = otmPut?.lastPrice || spotPrice * 0.01;
      const iv = atmCall?.impliedVolatility || 20;

      switch (strategy.name) {
        case 'Bull Call Spread':
          entryPrice = (callPremium - otmCallPremium) * lotSize;
          maxProfit = (otmCallStrike - atmStrike - callPremium + otmCallPremium) * lotSize;
          maxLoss = entryPrice;
          breakeven = [atmStrike + callPremium - otmCallPremium];
          targetPrice = entryPrice * 1.6;
          stoplossPrice = entryPrice * 0.4;
          strategyLegs = `Buy ${atmStrike} CE @ ₹${callPremium.toFixed(1)}, Sell ${otmCallStrike} CE @ ₹${otmCallPremium.toFixed(1)}`;
          marginRequired = entryPrice * 1.2;
          break;
        case 'Bear Put Spread':
          entryPrice = (putPremium - otmPutPremium) * lotSize;
          maxProfit = (atmStrike - otmPutStrike - putPremium + otmPutPremium) * lotSize;
          maxLoss = entryPrice;
          breakeven = [atmStrike - putPremium + otmPutPremium];
          targetPrice = entryPrice * 1.6;
          stoplossPrice = entryPrice * 0.4;
          strategyLegs = `Buy ${atmStrike} PE @ ₹${putPremium.toFixed(1)}, Sell ${otmPutStrike} PE @ ₹${otmPutPremium.toFixed(1)}`;
          marginRequired = entryPrice * 1.2;
          break;
        case 'Long Call':
          entryPrice = callPremium * lotSize;
          maxProfit = -1;
          maxLoss = entryPrice;
          breakeven = [atmStrike + callPremium];
          targetPrice = callPremium * 1.5 * lotSize;
          stoplossPrice = callPremium * 0.5 * lotSize;
          strategyLegs = `Buy ${atmStrike} CE @ ₹${callPremium.toFixed(1)}`;
          marginRequired = entryPrice;
          break;
        case 'Long Put':
          entryPrice = putPremium * lotSize;
          maxProfit = (atmStrike - putPremium) * lotSize;
          maxLoss = entryPrice;
          breakeven = [atmStrike - putPremium];
          targetPrice = putPremium * 1.5 * lotSize;
          stoplossPrice = putPremium * 0.5 * lotSize;
          strategyLegs = `Buy ${atmStrike} PE @ ₹${putPremium.toFixed(1)}`;
          marginRequired = entryPrice;
          break;
        case 'Iron Condor':
          const netCredit = (otmCallPremium + otmPutPremium - (otmCall ? chain.options.calls.find(c => c.strikePrice === otmCallStrike + strikeInterval * 2)?.lastPrice || otmCallPremium * 0.3 : otmCallPremium * 0.3) - (otmPut ? chain.options.puts.find(p => p.strikePrice === otmPutStrike - strikeInterval * 2)?.lastPrice || otmPutPremium * 0.3 : otmPutPremium * 0.3)) * lotSize;
          entryPrice = Math.abs(netCredit);
          maxProfit = Math.abs(netCredit);
          maxLoss = (strikeInterval * 2 * lotSize) - Math.abs(netCredit);
          breakeven = [otmPutStrike + netCredit / lotSize, otmCallStrike - netCredit / lotSize];
          targetPrice = entryPrice * 0.8;
          stoplossPrice = entryPrice * 2;
          strategyLegs = `Sell ${otmCallStrike} CE, Buy ${otmCallStrike + strikeInterval * 2} CE, Sell ${otmPutStrike} PE, Buy ${otmPutStrike - strikeInterval * 2} PE`;
          marginRequired = typeof maxLoss === 'number' ? maxLoss * 1.5 : entryPrice * 3;
          break;
        case 'Long Straddle':
          entryPrice = (callPremium + putPremium) * lotSize;
          maxProfit = -1;
          maxLoss = entryPrice;
          breakeven = [atmStrike - callPremium - putPremium, atmStrike + callPremium + putPremium];
          targetPrice = entryPrice * 1.5;
          stoplossPrice = entryPrice * 0.4;
          strategyLegs = `Buy ${atmStrike} CE @ ₹${callPremium.toFixed(1)}, Buy ${atmStrike} PE @ ₹${putPremium.toFixed(1)}`;
          marginRequired = entryPrice;
          break;
        default:
          entryPrice = spotPrice * lotSize - otmCallPremium * lotSize;
          maxProfit = (otmCallStrike - spotPrice + otmCallPremium) * lotSize;
          maxLoss = (spotPrice - otmCallPremium) * lotSize;
          breakeven = [spotPrice - otmCallPremium];
          targetPrice = entryPrice + (typeof maxProfit === 'number' ? maxProfit * 0.7 : 0);
          stoplossPrice = entryPrice * 0.95;
          strategyLegs = `Buy ${selectedSymbol} Futures, Sell ${otmCallStrike} CE @ ₹${otmCallPremium.toFixed(1)}`;
          marginRequired = spotPrice * lotSize * 0.15;
          break;
      }

      const daysToExpiry = Math.max(1, Math.ceil((new Date(nearestExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      const greeks = derivativesService.calculateGreeks(
        spotPrice, atmStrike, daysToExpiry, iv / 100, 0.06,
        strategy.outlook === 'bearish' ? 'put' : 'call'
      );

      let rationale = '';
      try {
        rationale = await this.generateRationale({
          type: 'derivatives',
          name: `${selectedSymbol} ${strategy.name}`,
          strategy: strategy.name,
          symbol: selectedSymbol,
          spotPrice,
          strikePrice: atmStrike,
          expiry: nearestExpiry,
          iv,
          outlook: strategy.outlook,
          lotSize,
          entryPrice: Math.round(entryPrice),
          maxProfit: maxProfit === -1 ? 'Unlimited' : `₹${Math.round(typeof maxProfit === 'number' ? maxProfit : 0).toLocaleString()}`,
          maxLoss: `₹${Math.round(typeof maxLoss === 'number' ? maxLoss : 0).toLocaleString()}`,
        });
      } catch (e) {
        console.error("[PickOfTheDay] AI rationale failed for derivatives:", e);
      }

      if (!rationale) {
        rationale = `${strategy.name} on ${selectedSymbol} with ${strategy.outlook} outlook. ${strategyLegs}. Spot at ₹${spotPrice.toFixed(0)}, IV at ${iv.toFixed(1)}%. ` +
          `Max profit: ${maxProfit === -1 ? 'Unlimited' : `₹${Math.round(typeof maxProfit === 'number' ? maxProfit : 0).toLocaleString()}`}, ` +
          `Max loss: ₹${Math.round(typeof maxLoss === 'number' ? maxLoss : 0).toLocaleString()}. ` +
          `Lot size: ${lotSize}, Expiry: ${nearestExpiry}. Suitable for ${strategy.outlook} market view with ${strategy.risk} risk appetite.`;
      }

      if (!this.recentPicksCache.has('derivatives')) {
        this.recentPicksCache.set('derivatives', new Set());
      }
      this.recentPicksCache.get('derivatives')!.add(selectedSymbol);

      const expiryDate = new Date(nearestExpiry);
      const suitableProfiles = strategy.risk === 'low'
        ? ['conservative', 'moderate', 'aggressive']
        : strategy.risk === 'medium'
        ? ['moderate', 'aggressive']
        : ['aggressive', 'very_aggressive'];

      return {
        category: 'derivatives',
        instrumentName: `${selectedSymbol} ${strategy.name}`,
        symbol: selectedSymbol,
        exchange: 'NSE',
        recoDate: new Date().toISOString().split('T')[0],
        recoPrice: Math.round(entryPrice * 100) / 100,
        targetPrice: Math.round(targetPrice * 100) / 100,
        stoplossPrice: Math.round(stoplossPrice * 100) / 100,
        status: 'live',
        expiryDate: expiryDate.toISOString().split('T')[0],
        rationale,
        riskLevel: strategy.risk,
        suitableFor: suitableProfiles,
        timeHorizon: 'short_term',
        confidenceScore: 60 + Math.floor(Math.random() * 25),
        sectorCategory: isIndex ? 'Index Derivatives' : 'Stock Derivatives',
        keyMetrics: {
          strategy: strategy.name,
          outlook: strategy.outlook,
          lotSize,
          strikePrice: atmStrike,
          spotPrice: Math.round(spotPrice * 100) / 100,
          optionType: strategy.outlook === 'bearish' ? 'PE' : strategy.outlook === 'bullish' ? 'CE' : 'CE+PE',
          impliedVolatility: Math.round(iv * 100) / 100,
          marginRequired: Math.round(marginRequired),
          maxProfit: maxProfit === -1 ? 'Unlimited' : Math.round(typeof maxProfit === 'number' ? maxProfit : 0),
          maxLoss: Math.round(typeof maxLoss === 'number' ? maxLoss : 0),
          breakeven: breakeven.map(b => Math.round(b * 100) / 100),
          legs: strategyLegs,
          expiry: nearestExpiry,
          daysToExpiry,
          greeks: {
            delta: greeks.delta,
            theta: greeks.theta,
            vega: greeks.vega,
            gamma: greeks.gamma,
            iv: greeks.impliedVolatility,
          },
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Failed to generate derivatives pick:", error);
      return null;
    }
  }

  private getDerivativeStrikeInterval(price: number): number {
    if (price < 100) return 2.5;
    if (price < 500) return 5;
    if (price < 1000) return 10;
    if (price < 5000) return 25;
    return 50;
  }

  private scoreETF(etf: any): number {
    let score = 0;
    
    // Score by ETF type
    const name = etf.name?.toLowerCase() || '';
    if (name.includes('nifty 50') || name.includes('sensex')) score += 25; // Blue-chip tracking
    else if (name.includes('gold') || name.includes('silver')) score += 20; // Precious metals
    else if (name.includes('bank') || name.includes('it')) score += 18; // Sector ETFs
    else if (name.includes('nifty')) score += 15; // Other index ETFs
    
    // Score by issuer reputation
    const issuer = etf.issuer?.toLowerCase() || '';
    if (issuer.includes('hdfc') || issuer.includes('sbi') || issuer.includes('icici')) score += 15;
    else if (issuer.includes('nippon') || issuer.includes('kotak') || issuer.includes('axis')) score += 12;
    else score += 8;

    // Score by price (lower expense implied by bigger fund houses)
    const price = parseFloat(etf.lastPrice || '0');
    if (price > 100 && price < 500) score += 10; // Sweet spot for retail investors
    else if (price > 50) score += 8;
    
    return score;
  }

  private scoreSGB(sgb: any): number {
    let score = 0;
    
    // Prefer open issues over upcoming
    if (sgb.issueStatus === 'open') score += 30;
    else if (sgb.issueStatus === 'upcoming') score += 20;
    
    // Higher interest rate is better
    const interestRate = parseFloat(sgb.interestRate || '0');
    if (interestRate >= 2.5) score += 15;
    else if (interestRate >= 2.0) score += 10;
    
    // Tax benefits
    if (sgb.capitalGainsTaxExempt) score += 20;
    
    return score;
  }

  private async scoreStock(stock: any, enriched?: EnrichedStockSnapshot | null): Promise<number> {
    let score = 0;
    
    const analystRating = stock.analystRating?.toLowerCase() || '';
    if (analystRating.includes('strong buy')) score += 25;
    else if (analystRating.includes('buy')) score += 20;
    else if (analystRating.includes('hold')) score += 10;
    
    const returns1Y = stock.returns1Y ? parseFloat(stock.returns1Y) : 0;
    if (returns1Y > 30) score += 20;
    else if (returns1Y > 15) score += 15;
    else if (returns1Y > 0) score += 10;
    
    const pe = stock.peRatio ? parseFloat(stock.peRatio) : 0;
    if (pe > 0 && pe < 15) score += 15;
    else if (pe >= 15 && pe < 25) score += 10;
    else if (pe >= 25 && pe < 40) score += 5;
    
    if (stock.marketCap === 'Large Cap') score += 10;
    else if (stock.marketCap === 'Mid Cap') score += 8;
    else if (stock.marketCap === 'Small Cap') score += 5;
    
    const advancedMetrics = await this.calculateAdvancedMetricsForStock(stock);
    
    if (advancedMetrics.piotroskiFScore !== undefined) {
      if (advancedMetrics.piotroskiFScore >= 8) score += 15;
      else if (advancedMetrics.piotroskiFScore >= 6) score += 10;
      else if (advancedMetrics.piotroskiFScore < 4) score -= 5;
    }
    
    if (advancedMetrics.altmanZScore !== undefined) {
      if (advancedMetrics.altmanZScore > 2.99) score += 10;
      else if (advancedMetrics.altmanZScore < 1.81) score -= 10;
    }
    
    if (advancedMetrics.pegRatio !== undefined) {
      if (advancedMetrics.pegRatio > 0 && advancedMetrics.pegRatio < 1) score += 10;
      else if (advancedMetrics.pegRatio >= 1 && advancedMetrics.pegRatio < 1.5) score += 5;
    }
    
    if (advancedMetrics.roic !== undefined) {
      if (advancedMetrics.roic > 20) score += 10;
      else if (advancedMetrics.roic > 15) score += 5;
    }
    
    if (advancedMetrics.evToEbitda !== undefined) {
      if (advancedMetrics.evToEbitda > 0 && advancedMetrics.evToEbitda < 10) score += 5;
      else if (advancedMetrics.evToEbitda > 20) score -= 5;
    }

    if (enriched) {
      if (enriched.fundamentals) {
        const f = enriched.fundamentals;
        if (f.roe != null && f.roe > 15) score += 8;
        else if (f.roe != null && f.roe > 10) score += 4;
        if (f.roic != null && f.roic > 20) score += 8;
        else if (f.roic != null && f.roic > 12) score += 4;
        if (f.debtToEquity != null && f.debtToEquity >= 0 && f.debtToEquity < 0.5) score += 6;
        else if (f.debtToEquity != null && f.debtToEquity >= 0.5 && f.debtToEquity < 1.0) score += 3;
        else if (f.debtToEquity != null && f.debtToEquity > 2.0) score -= 4;
        if (f.peRatio != null && f.peRatio > 0 && f.peRatio < 15) score += 5;
        else if (f.peRatio != null && f.peRatio >= 15 && f.peRatio < 25) score += 3;
      }

      if (enriched.growth) {
        const g = enriched.growth;
        if (g.epsGrowth != null && g.epsGrowth > 20) score += 8;
        else if (g.epsGrowth != null && g.epsGrowth > 10) score += 5;
        else if (g.epsGrowth != null && g.epsGrowth > 0) score += 2;
        if (g.revenueGrowth != null && g.revenueGrowth > 15) score += 6;
        else if (g.revenueGrowth != null && g.revenueGrowth > 5) score += 3;
        if (g.freeCashFlowGrowth != null && g.freeCashFlowGrowth > 10) score += 5;
        else if (g.freeCashFlowGrowth != null && g.freeCashFlowGrowth > 0) score += 2;
      }

      if (enriched.dcf) {
        const upside = enriched.dcf.upsidePercent;
        if (upside != null && upside > 30) score += 10;
        else if (upside != null && upside > 15) score += 7;
        else if (upside != null && upside > 0) score += 4;
        else if (upside != null && upside < -20) score -= 5;
      }

      if (enriched.companyRating) {
        const rs = enriched.companyRating.ratingScore;
        if (rs != null && rs >= 4) score += 10;
        else if (rs != null && rs > 3) score += 6;
        else if (rs != null && rs >= 3) score += 3;
      }

      if (enriched.technicals) {
        const rsi = enriched.technicals.rsi;
        if (rsi != null) {
          if (rsi >= 30 && rsi <= 50) score += 8;
          else if (rsi > 50 && rsi <= 70) score += 2;
          else if (rsi > 70) score -= 6;
          else if (rsi < 30) score += 4;
        }
      }

      if (enriched.analystTargets) {
        const at = enriched.analystTargets;
        if (at.avgPriceTarget != null && stock.currentPrice) {
          const curPrice = parseFloat(stock.currentPrice);
          if (curPrice > 0 && at.avgPriceTarget > curPrice * 1.15) score += 8;
          else if (curPrice > 0 && at.avgPriceTarget > curPrice * 1.05) score += 4;
          else if (curPrice > 0 && at.avgPriceTarget < curPrice * 0.9) score -= 4;
        }
        if (at.count >= 5) score += 3;
      }
    }
    
    return Math.max(0, score);
  }

  private async calculateAdvancedMetricsForStock(stock: any): Promise<{
    piotroskiFScore?: number;
    altmanZScore?: number;
    pegRatio?: number;
    roic?: number;
    evToEbitda?: number;
    earningsQuality?: number;
  }> {
    const metrics: any = {};
    
    try {
      const netIncome = parseFloat(stock.netIncome || 0);
      const totalAssets = parseFloat(stock.totalAssets || 1);
      const operatingCashFlow = parseFloat(stock.operatingCashFlow || 0);
      const longTermDebt = parseFloat(stock.longTermDebt || 0);
      const currentRatio = parseFloat(stock.currentRatio || 1.5);
      const sharesOutstanding = parseFloat(stock.sharesOutstanding || 1);
      const grossMargin = parseFloat(stock.grossMargin || 0);
      const revenue = parseFloat(stock.revenue || 0);
      const assetTurnover = revenue > 0 && totalAssets > 0 ? revenue / totalAssets : 0;
      
      try {
        const stockId = stock.id || stock.instrumentId;
        if (stockId) {
          const dbMetrics = await db
            .select({
              piotroskiFScore: stockFinancialMetrics.piotroskiFScore,
              altmanZScore: stockFinancialMetrics.altmanZScore,
              roic: stockFinancialMetrics.roic,
              evToEbitda: stockFinancialMetrics.evToEbitda,
              earningsQuality: stockFinancialMetrics.earningsQuality,
              pegRatio: stockFinancialMetrics.pegRatio,
            })
            .from(stockFinancialMetrics)
            .where(eq(stockFinancialMetrics.stockId, String(stockId)))
            .orderBy(desc(stockFinancialMetrics.fiscalYear))
            .limit(1);

          if (dbMetrics.length > 0) {
            const m = dbMetrics[0];
            if (m.piotroskiFScore !== null) metrics.piotroskiFScore = m.piotroskiFScore;
            if (m.altmanZScore) metrics.altmanZScore = parseFloat(String(m.altmanZScore));
            if (m.roic) metrics.roic = parseFloat(String(m.roic));
            if (m.evToEbitda) metrics.evToEbitda = parseFloat(String(m.evToEbitda));
            if (m.earningsQuality) metrics.earningsQuality = parseFloat(String(m.earningsQuality));
            if (m.pegRatio) metrics.pegRatio = parseFloat(String(m.pegRatio));
            return metrics;
          }
        }
      } catch {
      }

      if (netIncome && totalAssets && operatingCashFlow) {
      }
      
      // Calculate Altman Z-Score
      const workingCapital = parseFloat(stock.workingCapital || totalAssets * 0.2);
      const retainedEarnings = parseFloat(stock.retainedEarnings || netIncome * 3);
      const ebit = parseFloat(stock.ebit || netIncome * 1.3);
      const marketCap = parseFloat(stock.marketCapValue || 0);
      const totalLiabilities = parseFloat(stock.totalLiabilities || totalAssets * 0.4);
      
      if (totalAssets && totalLiabilities && revenue) {
        const zScoreData = {
          workingCapital, retainedEarnings, ebit, marketCap,
          totalLiabilities, revenue, totalAssets
        };
        metrics.altmanZScore = financialMetricsCalculator.calculateAltmanZScore(zScoreData);
      }
      
      // Calculate PEG Ratio
      const pe = parseFloat(stock.peRatio || 0);
      const stockReturns1Y = parseFloat(stock.returns1Y || 10);
      const epsGrowth = parseFloat(stock.epsGrowth || stockReturns1Y) / 100;
      if (pe > 0 && epsGrowth > 0) {
        metrics.pegRatio = financialMetricsCalculator.calculatePEGRatio(pe, epsGrowth);
      }
      
      // Calculate ROIC
      const ebitValue = parseFloat(stock.ebit || netIncome * 1.3);
      const taxRate = 0.25;
      const totalEquity = parseFloat(stock.totalEquity || totalAssets * 0.6);
      const nopat = ebitValue * (1 - taxRate);
      const investedCapital = totalEquity + longTermDebt;
      if (investedCapital > 0) {
        metrics.roic = (nopat / investedCapital) * 100;
      }
      
      // Calculate EV/EBITDA
      const ebitda = parseFloat(stock.ebitda || ebitValue * 1.1);
      const cash = parseFloat(stock.cash || 0);
      const totalDebt = parseFloat(stock.totalDebt || longTermDebt);
      if (marketCap > 0 && ebitda > 0) {
        const ev = financialMetricsCalculator.calculateEnterpriseValue(marketCap, totalDebt, cash);
        metrics.evToEbitda = financialMetricsCalculator.calculateEVtoEBITDA(ev, ebitda);
      }
      
      // Calculate Earnings Quality
      if (operatingCashFlow && netIncome) {
        metrics.earningsQuality = financialMetricsCalculator.calculateEarningsQuality(operatingCashFlow, netIncome);
      }
    } catch (error) {
      console.error('[PickOfTheDay] Error calculating advanced metrics:', error);
    }
    
    return metrics;
  }

  private scoreMutualFund(fund: any): number {
    let score = 0;
    
    const smartRating = fund.crisilRating ? parseInt(fund.crisilRating) : 0;
    if (smartRating >= 5) score += 25;
    else if (smartRating >= 4) score += 20;
    else if (smartRating >= 3) score += 15;
    
    const returns1Y = fund.returns1Y ? parseFloat(fund.returns1Y) : 0;
    if (returns1Y > 20) score += 20;
    else if (returns1Y > 12) score += 15;
    else if (returns1Y > 6) score += 10;
    
    const returns3Y = fund.returns3Y ? parseFloat(fund.returns3Y) : 0;
    if (returns3Y > 15) score += 15;
    else if (returns3Y > 10) score += 10;
    
    const expenseRatio = fund.expenseRatio ? parseFloat(fund.expenseRatio) : 2;
    if (expenseRatio < 0.5) score += 15;
    else if (expenseRatio < 1) score += 10;
    else if (expenseRatio < 1.5) score += 5;
    
    return score;
  }

  private scoreBond(bond: any): number {
    let score = 0;
    
    // Risk-free rate = 7.15% (India 10Y G-Sec, Mar 2026).
    // A bond below risk-free adds no value over sovereign paper — score 0 for YTM component.
    const ytm = bond.yieldToMaturity ? parseFloat(bond.yieldToMaturity) : 0;
    if (ytm > 10) score += 25;      // Strong spread (285 bps+), high-conviction
    else if (ytm > 8.5) score += 20; // Good spread (135 bps+)
    else if (ytm > 7.5) score += 12; // Thin positive spread — acceptable
    // ytm <= 7.15% = at or below risk-free → 0 pts for YTM component
    
    const rating = bond.creditRating?.toUpperCase() || '';
    if (rating.includes('AAA')) score += 25;
    else if (rating.includes('AA')) score += 20;
    else if (rating.includes('A')) score += 15;
    
    return score;
  }

  private getRiskBand(score: number): 'Moderate' | 'Growth' | 'HighConviction' {
    if (score >= 60) return 'HighConviction';
    if (score >= 40) return 'Growth';
    return 'Moderate';
  }

  private scoreUnlistedWithRatios(company: any, ratios: any, financials: any): ScoreBreakdown {

    // ── Bucket 1: Listing Stage ───────────────────────────────────────────────
    // Unlisted = highest upside (undiscovered); pre_ipo = more validated but lower delta
    let listingStageScore = 0;
    if (company.listingStage === 'unlisted' || !company.listingStage) listingStageScore = 10;
    else if (company.listingStage === 'pre_ipo') listingStageScore = 8;
    else if (company.listingStage === 'growth') listingStageScore = 6;
    else if (company.listingStage === 'mature') listingStageScore = 4;

    // ── Bucket 2: Pricing Validation ─────────────────────────────────────────
    let pricingScore = 0;
    if (company.publishedBuyPrice && parseFloat(company.publishedBuyPrice) > 0) pricingScore = 10;
    else if (company.draftBuyPrice && parseFloat(company.draftBuyPrice) > 0) pricingScore = 5;

    // ── Bucket 3: Sector Conviction ──────────────────────────────────────────
    let sectorScore = 0;
    const sector = company.sector?.toLowerCase() || '';
    if (sector.includes('tech') || sector.includes('software')) sectorScore += 12;
    if (sector.includes('fintech')) sectorScore += 12;
    if (sector.includes('financial') || sector.includes('banking')) sectorScore += 8;
    if (sector.includes('pharma') || sector.includes('health')) sectorScore += 6;
    if (sector.includes('consumer') || sector.includes('fmcg')) sectorScore += 5;
    if (sector.includes('ev') || sector.includes('electric')) sectorScore += 10;
    if (sector.includes('ai') || sector.includes('deeptech')) sectorScore += 10;
    sectorScore = Math.min(sectorScore, 20); // cap to prevent sector double-dipping

    // ── Bucket 4: Governance & Data Quality ──────────────────────────────────
    let governanceScore = 0;
    const confidence = company.identityConfidence ? parseFloat(company.identityConfidence) : 0;
    if (confidence >= 0.9) governanceScore += 8;
    else if (confidence >= 0.7) governanceScore += 5;
    if (company.complianceStatus === 'cleared') governanceScore += 5;
    else if (company.complianceStatus === 'blocked') governanceScore -= 30;

    // ── Bucket 5: Risk Adjustment (inverse volatility via D/E proxy) ─────────
    // D/E is the best available proxy for financial risk on unlisted companies
    let riskAdjustment = 0;
    const de = ratios?.debtEquity != null ? parseFloat(ratios.debtEquity) : null;
    if (de == null) riskAdjustment = 5;       // no data → neutral
    else if (de < 0.3) riskAdjustment = 10;   // very low leverage → low risk
    else if (de < 0.7) riskAdjustment = 7;
    else if (de < 1.2) riskAdjustment = 4;
    else if (de < 2.0) riskAdjustment = 0;
    else riskAdjustment = -5;                  // high leverage → risk penalty

    // ── Bucket 6: Financial Fundamentals ─────────────────────────────────────
    let fundamentalsScore = 0;

    // ROE (primary profitability signal)
    const roe = ratios?.roe != null ? parseFloat(ratios.roe) : null;
    if (roe != null) {
      if (roe > 20) fundamentalsScore += 20;
      else if (roe > 15) fundamentalsScore += 15;
      else if (roe > 10) fundamentalsScore += 10;
      else if (roe > 0) fundamentalsScore += 5;
      else fundamentalsScore -= 10;
    }

    // Revenue growth
    const revGrowth = ratios?.revenueGrowth != null ? parseFloat(ratios.revenueGrowth) : null;
    if (revGrowth != null) {
      if (revGrowth > 30) fundamentalsScore += 18;
      else if (revGrowth > 20) fundamentalsScore += 13;
      else if (revGrowth > 10) fundamentalsScore += 8;
      else if (revGrowth > 0) fundamentalsScore += 3;
      else fundamentalsScore -= 5;
    }

    // EBITDA margin
    const ebitdaMargin = ratios?.marginEbitda != null ? parseFloat(ratios.marginEbitda) : null;
    if (ebitdaMargin != null) {
      if (ebitdaMargin > 25) fundamentalsScore += 10;
      else if (ebitdaMargin > 15) fundamentalsScore += 6;
      else if (ebitdaMargin > 5) fundamentalsScore += 3;
    }

    // Profit growth
    const profitGrowth = ratios?.profitGrowth != null ? parseFloat(ratios.profitGrowth) : null;
    if (profitGrowth != null) {
      if (profitGrowth > 30) fundamentalsScore += 8;
      else if (profitGrowth > 10) fundamentalsScore += 5;
      else if (profitGrowth < 0) fundamentalsScore -= 5;
    }

    // Free cash flow (financial momentum)
    const fcf = financials?.freeCashFlow != null ? parseFloat(financials.freeCashFlow) : null;
    if (fcf != null && fcf > 0) fundamentalsScore += 5;

    const totalScore = Math.max(0,
      listingStageScore +
      pricingScore +
      sectorScore +
      governanceScore +
      riskAdjustment +
      fundamentalsScore
    );

    return {
      listingStageScore,
      pricingScore,
      sectorScore,
      governanceScore,
      riskAdjustment,
      fundamentalsScore,
      totalScore,
      scoringVersion: SCORER_VERSION,
      threshold: SCORER_MIN_THRESHOLD,
      riskBand: this.getRiskBand(totalScore),
    };
  }

  private extractRationaleText(raw: string): string {
    // Strip markdown code fences
    let text = raw.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
    // If the AI returned a JSON object, extract the actual text field
    if (text.startsWith('{')) {
      try {
        const parsed = JSON.parse(text);
        const extracted =
          parsed.investment_rationale?.rationale ??
          parsed.investment_rationale ??
          parsed.rationale ??
          parsed.content ??
          parsed.text ??
          null;
        if (typeof extracted === 'string' && extracted.length > 10) return extracted.trim();
        if (typeof extracted === 'object' && extracted !== null) {
          return (extracted.rationale || extracted.content || JSON.stringify(extracted)).trim();
        }
      } catch {
        // Not valid JSON — return as-is
      }
    }
    return text;
  }

  private async generateRationale(params: any): Promise<string> {
    try {
      const prompt = this.buildRationalePrompt(params);
      const category = params.category || params.type || 'stocks';
      const { result } = await unifiedAIRecommendationEngine.runPrompt<string>({
        prompt,
        category,
        responseParser: (text: string) => text,
        fallback: () => this.generateFallbackRationale(params),
      });
      const raw = result || this.generateFallbackRationale(params);
      return this.extractRationaleText(raw);
    } catch (error) {
      console.error("[PickOfTheDay] AI rationale generation failed:", error);
      return this.generateFallbackRationale(params);
    }
  }

  private buildRationalePrompt(params: any): string {
    const isDerivative = params.type === 'derivatives' || params.category === 'derivatives';

    if (isDerivative) {
      const spotPrice = params.spotPrice ?? params.currentPrice ?? params.entryPrice ?? 0;
      const strike = params.strikePrice ?? params.strike ?? 0;
      return `Generate a concise, professional trading rationale for a derivatives strategy pick.

Instrument: ${params.name || params.symbol}
Symbol: ${params.symbol}
Strategy: ${params.strategy}
Outlook: ${params.outlook}
Spot Price: ₹${spotPrice.toFixed(0)}
Strike Price: ₹${strike}
Expiry: ${params.expiry}
Entry Price: ₹${params.entryPrice}
Implied Volatility: ${params.iv ? params.iv.toFixed(1) + '%' : 'N/A'}
Lot Size: ${params.lotSize}
Max Profit: ${params.maxProfit}
Max Loss: ${params.maxLoss}

Write a 2-3 sentence rationale for this ${params.strategy} strategy. Explain the market view, key risk-reward, and why this expiry/strike makes sense today. Be specific and actionable. Do not use markdown formatting.`;
    }

    const categoryName = {
      'listed_stocks': 'Stock',
      'mutual_funds': 'Mutual Fund',
      'bonds': 'Bond',
      'unlisted': 'Unlisted Stock',
    }[params.category] || 'Investment';

    let enrichedContext = '';
    if (params.dcfUpside != null) {
      enrichedContext += `\nDCF Upside: ${params.dcfUpside}%`;
    }
    if (params.roic != null) {
      enrichedContext += `\nROIC: ${params.roic.toFixed(1)}%`;
    }
    if (params.epsGrowth != null) {
      enrichedContext += `\nEPS Growth: ${params.epsGrowth.toFixed(1)}%`;
    }
    if (params.companyRating) {
      enrichedContext += `\nCompany Rating: ${params.companyRating}`;
    }
    if (params.rsi != null) {
      enrichedContext += `\nRSI: ${params.rsi.toFixed(1)}`;
    }
    if (params.analystAvgTarget != null) {
      enrichedContext += `\nAnalyst Avg Target: ₹${params.analystAvgTarget.toFixed(0)} (${params.analystCount || 0} analysts)`;
    }

    const currentPrice = params.currentPrice ?? 0;
    const targetPrice = params.targetPrice ?? 0;
    const upside = currentPrice > 0 ? Math.round((targetPrice / currentPrice - 1) * 100) : 0;

    return `Generate a concise, professional investment rationale for today's ${categoryName} pick.

Product: ${params.name}
${params.symbol ? `Symbol: ${params.symbol}` : ''}
${params.sector ? `Sector: ${params.sector}` : ''}
Current Price: ₹${currentPrice}
Target Price: ₹${targetPrice} (${upside}% upside)
Stop Loss: ₹${params.stoplossPrice ?? 'N/A'}
${params.fintekproRating ? `FintekPro Rating: ${params.fintekproRating}/5` : ''}
${params.peRatio ? `P/E Ratio: ${params.peRatio}` : ''}
${params.returns1Y ? `1Y Returns: ${params.returns1Y}%` : ''}
${params.yield ? `Yield: ${params.yield}%` : ''}
${params.creditRating ? `Credit Rating: ${params.creditRating}` : ''}${enrichedContext}

Write a 2-3 sentence rationale explaining why this is today's top pick. Focus on key strengths, recent catalysts, and risk-reward. Be specific and actionable. Do not use markdown formatting.`;
  }

  private generateFallbackRationale(params: any): string {
    const isDerivative = params.type === 'derivatives' || params.category === 'derivatives';
    if (isDerivative) {
      const spotPrice = params.spotPrice ?? params.currentPrice ?? params.entryPrice ?? 0;
      return `${params.strategy} on ${params.symbol} with ${params.outlook} outlook. Spot at ₹${spotPrice.toFixed(0)}, IV at ${params.iv ? params.iv.toFixed(1) + '%' : 'N/A'}. Max profit: ${params.maxProfit}, Max loss: ${params.maxLoss}. Lot size: ${params.lotSize}, Expiry: ${params.expiry}. Suitable for ${params.outlook} market view.`;
    }

    const currentPrice = params.currentPrice ?? 0;
    const targetPrice = params.targetPrice ?? 0;
    const upside = currentPrice > 0 ? Math.round((targetPrice / currentPrice - 1) * 100) : 0;
    
    let enrichedInsights = '';
    if (params.dcfUpside != null) {
      enrichedInsights += ` DCF analysis shows ${params.dcfUpside > 0 ? '+' : ''}${params.dcfUpside}% upside.`;
    }
    if (params.roic != null) {
      enrichedInsights += ` ROIC of ${params.roic.toFixed(1)}% indicates ${params.roic > 15 ? 'a quality' : 'an adequate'} business.`;
    }
    if (params.epsGrowth != null && params.epsGrowth > 0) {
      enrichedInsights += ` EPS growth at ${params.epsGrowth.toFixed(1)}% signals earnings momentum.`;
    }
    if (params.analystAvgTarget != null && params.analystCount > 0) {
      enrichedInsights += ` ${params.analystCount} analysts set an average target of ₹${params.analystAvgTarget.toFixed(0)}.`;
    }

    const categoryRationales: Record<string, string> = {
      'listed_stocks': `${params.name} shows strong fundamentals with ${params.fintekproRating ? `a ${params.fintekproRating}-star FintekPro rating` : 'solid metrics'}${params.returns1Y ? ` and ${params.returns1Y}% 1-year returns` : ''}. With ${upside}% upside potential to target, this stock offers an attractive risk-reward profile for growth-oriented investors.${enrichedInsights}`,
      'mutual_funds': `${params.name} from ${params.fundHouse || 'a top AMC'} demonstrates consistent performance${params.returns1Y ? ` with ${params.returns1Y}% trailing returns` : ''}. ${params.fintekproRating ? `Rated ${params.fintekproRating} stars by FintekPro, ` : ''}this fund is well-suited for investors seeking quality exposure to ${params.category2 || 'diversified assets'}.`,
      'bonds': `${params.name} offers an attractive yield${params.yield ? ` of ${params.yield}%` : ''}${params.creditRating ? ` with ${params.creditRating} credit rating` : ''}. This fixed-income pick provides stable returns with capital preservation focus, ideal for conservative portfolios.`,
      'unlisted': `${params.name} in the ${params.sector || 'growth'} sector presents a compelling pre-listing opportunity${params.ipoStatus ? ` with ${params.ipoStatus}` : ''}. High potential returns with 25% target upside for investors with higher risk appetite.`,
    };

    return categoryRationales[params.category] || `${params.name} is selected as today's top pick based on comprehensive analysis of fundamentals, technicals, and market conditions. Target upside of ${upside}% with defined risk management.${enrichedInsights}`;
  }

  private deriveSuitableFor(riskLevel: string | null | undefined, category: PickCategory): string[] {
    const risk = (riskLevel || '').toLowerCase().trim();
    if (risk === 'low' || risk === 'very low' || risk === 'low risk') return ['Conservative', 'Balanced'];
    if (risk === 'moderately low' || risk === 'low to moderate') return ['Conservative', 'Balanced'];
    if (risk === 'moderate') return ['Balanced'];
    if (risk === 'moderately high' || risk === 'moderate to high') return ['Balanced', 'Aggressive'];
    if (risk === 'high') return ['Balanced', 'Aggressive'];
    if (risk === 'very high' || risk === 'very high risk') return ['Aggressive'];
    if (category === 'bonds' || category === 'sgb' || category === 'fixed_deposits') return ['Conservative', 'Balanced'];
    if (category === 'unlisted') return ['Aggressive'];
    if (category === 'listed_stocks' || category === 'global_stocks' || category === 'reits_invits') return ['Balanced', 'Aggressive'];
    return ['Balanced'];
  }

  private deriveETFSuitableFor(name: string | null | undefined, category: string | null | undefined): string[] {
    const label = `${name || ''} ${category || ''}`.toUpperCase();
    if (label.includes('LIQUID') || label.includes('OVERNIGHT') || label.includes('MONEY MARKET') ||
        label.includes('GILT') || label.includes('BOND ETF') || label.includes('DEBT')) {
      return ['Conservative', 'Balanced'];
    }
    if (label.includes('GOLD') || label.includes('SILVER') || label.includes('COMMODITY')) {
      return ['Conservative', 'Balanced'];
    }
    if (label.includes('SMALL CAP') || label.includes('MIDCAP') || label.includes('TECHNOLOGY') ||
        label.includes('PHARMA') || label.includes('SECTOR') || label.includes('THEMATIC')) {
      return ['Aggressive'];
    }
    return ['Balanced', 'Aggressive'];
  }

  private async getLiveGlobalPrice(symbol: string, instrumentId: string): Promise<number> {
    try {
      const yahooFinance = (await import('yahoo-finance2')).default;
      const quote = await yahooFinance.quote(symbol);
      const price = (quote as any)?.regularMarketPrice || 0;
      if (price > 0) {
        await db.update(globalInstruments)
          .set({ lastPrice: price.toString() })
          .where(eq(globalInstruments.id, instrumentId));
        console.log(`[PickOfTheDay] Fetched live price for ${symbol}: ${price}`);
      }
      return price;
    } catch (err) {
      console.warn(`[PickOfTheDay] Could not fetch live price for ${symbol}:`, err);
      return 0;
    }
  }

  private getRiskLevel(volatility: number): string {
    if (volatility < 15) return 'low';
    if (volatility < 25) return 'medium';
    return 'high';
  }

  private getExpiryDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  private detectMarketRegion(symbol?: string, exchange?: string, name?: string): string | undefined {
    if (!symbol && !exchange && !name) return undefined;
    
    const text = `${symbol || ""} ${exchange || ""} ${name || ""}`.toUpperCase();
    
    // US Markets
    if (text.includes("NYSE") || text.includes("NASDAQ") || text.includes(".US") ||
        text.match(/\.(N|O)$/) || exchange?.includes("US") ||
        ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA"].some(s => text.includes(s))) {
      return "us";
    }
    
    // China Markets
    if (text.includes("SHANGHAI") || text.includes("SHENZHEN") || text.includes(".SS") ||
        text.includes(".SZ") || text.includes(".HK") || exchange?.includes("CN") ||
        text.includes("ALIBABA") || text.includes("TENCENT") || text.includes("BAIDU")) {
      return "china";
    }
    
    // UK/Europe Markets
    if (text.includes(".L") || text.includes("LSE") || text.includes("LONDON") ||
        text.includes(".PA") || text.includes(".DE") || text.includes(".AS") ||
        text.includes("EURONEXT") || text.includes("FRANKFURT") || exchange?.includes("EU")) {
      return "uk_europe";
    }
    
    // Japan Markets
    if (text.includes(".T") || text.includes("TOKYO") || text.includes("NIKKEI") ||
        text.includes("TSE") || exchange?.includes("JP")) {
      return "japan";
    }
    
    // Default to other for any global stock without specific market
    return "other";
  }

  private async savePick(pick: DailyPickData): Promise<void> {
    await db.insert(dailyPicks).values({
      category: pick.category,
      instrumentId: pick.instrumentId,
      instrumentName: pick.instrumentName,
      isin: pick.isin,
      symbol: pick.symbol,
      market: pick.market,
      recoDate: pick.recoDate,
      recoPrice: pick.recoPrice.toString(),
      targetPrice: pick.targetPrice.toString(),
      stoplossPrice: pick.stoplossPrice.toString(),
      currentPrice: pick.currentPrice?.toString(),
      status: pick.status,
      expiryDate: pick.expiryDate,
      rationale: pick.rationale,
      riskLevel: pick.riskLevel,
      suitableFor: pick.suitableFor,
      keyMetrics: pick.keyMetrics,
      timeHorizon: pick.timeHorizon || this.getTimeHorizon(pick.category),
      confidenceScore: pick.confidenceScore || 70,
      sectorCategory: pick.sectorCategory,
      generatedBy: 'ai',
      scoringVersion: pick.scoringBreakdown?.scoringVersion ?? null,
      scoringBreakdown: pick.scoringBreakdown ?? null,
      riskScore: pick.riskScore ?? null,
    } as any);
  }

  async updatePickStatuses(): Promise<{ updated: number; details: string[] }> {
    const livePicks = await db
      .select()
      .from(dailyPicks)
      .where(eq(dailyPicks.status, 'live'));

    let updated = 0;
    const details: string[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const pick of livePicks) {
      const currentPrice = await this.getCurrentPrice(pick);
      if (!currentPrice) continue;

      const recoPrice = parseFloat(pick.recoPrice);
      const targetPrice = parseFloat(pick.targetPrice);
      const stoplossPrice = parseFloat(pick.stoplossPrice);
      const returnPct = ((currentPrice - recoPrice) / recoPrice) * 100;
      const recoDate = new Date(pick.recoDate);
      const daysHeld = Math.floor((Date.now() - recoDate.getTime()) / (1000 * 60 * 60 * 24));

      let newStatus: PickStatus = 'live';
      
      if (currentPrice >= targetPrice) {
        newStatus = 'target_hit';
        details.push(`${pick.instrumentName}: Target hit at ₹${currentPrice} (+${returnPct.toFixed(1)}%)`);
      } else if (currentPrice <= stoplossPrice) {
        newStatus = 'stoploss_hit';
        details.push(`${pick.instrumentName}: Stoploss hit at ₹${currentPrice} (${returnPct.toFixed(1)}%)`);
      } else if (pick.expiryDate < today) {
        newStatus = 'expired';
        details.push(`${pick.instrumentName}: Expired with ${returnPct.toFixed(1)}% return`);
      }

      if (newStatus !== 'live' || currentPrice !== parseFloat(pick.currentPrice || '0')) {
        await db
          .update(dailyPicks)
          .set({
            currentPrice: currentPrice.toString(),
            status: newStatus,
            returnPct: returnPct.toFixed(2),
            daysHeld,
            statusUpdatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(dailyPicks.id, pick.id));
        
        if (newStatus !== 'live') {
          updated++;
          await this.notifyWatchlistSubscribers(pick, newStatus, currentPrice, returnPct);
        }
      }
    }

    return { updated, details };
  }

  private async notifyWatchlistSubscribers(
    pick: any, newStatus: string, currentPrice: number, returnPct: number
  ): Promise<void> {
    try {
      const subscribers = await db
        .select({ userId: pickWatchlist.userId })
        .from(pickWatchlist)
        .where(eq(pickWatchlist.pickId, pick.id));

      if (subscribers.length === 0) return;

      const isTarget = newStatus === 'target_hit';
      const title = isTarget
        ? `Target Hit: ${pick.instrumentName}`
        : newStatus === 'stoploss_hit'
          ? `Stoploss Hit: ${pick.instrumentName}`
          : `Pick Expired: ${pick.instrumentName}`;
      const message = isTarget
        ? `${pick.instrumentName} has hit the target price of ₹${parseFloat(pick.targetPrice).toLocaleString()} with a return of +${returnPct.toFixed(1)}%. Consider booking profits.`
        : newStatus === 'stoploss_hit'
          ? `${pick.instrumentName} has hit the stoploss at ₹${currentPrice.toLocaleString()} (${returnPct.toFixed(1)}%). The position has been flagged for exit.`
          : `${pick.instrumentName} recommendation has expired with ${returnPct.toFixed(1)}% return.`;

      for (const sub of subscribers) {
        await db.insert(userNotifications).values({
          userId: sub.userId,
          type: isTarget ? 'info' : 'alert',
          title,
          message,
          actionUrl: '/agent/picks',
          priority: newStatus === 'stoploss_hit' ? 'high' : 'medium',
        });
      }

      console.log(`[PickOfTheDay] Notified ${subscribers.length} subscribers about ${pick.instrumentName} ${newStatus}`);
    } catch (error) {
      console.error(`[PickOfTheDay] Error notifying subscribers:`, error);
    }
  }

  private async getCurrentPrice(pick: any): Promise<number | null> {
    try {
      switch (pick.category) {
        case 'listed_stocks':
          const stock = await db
            .select({ currentPrice: listedStocks.currentPrice })
            .from(listedStocks)
            .where(eq(listedStocks.id, pick.instrumentId))
            .limit(1);
          return stock[0]?.currentPrice ? parseFloat(stock[0].currentPrice) : null;

        case 'global_stocks':
          const globalStock = await db
            .select({ lastPrice: globalInstruments.lastPrice })
            .from(globalInstruments)
            .where(eq(globalInstruments.id, pick.instrumentId))
            .limit(1);
          if (globalStock[0]?.lastPrice) {
            return parseFloat(globalStock[0].lastPrice);
          }
          const cacheResult = await db.execute(sql`
            SELECT current_price FROM financial_instruments_cache
            WHERE instrument_type = 'global_stock'
            AND symbol = (SELECT symbol FROM global_instruments WHERE id = ${pick.instrumentId} LIMIT 1)
            AND current_price IS NOT NULL
            ORDER BY fetched_at DESC LIMIT 1
          `);
          const cacheRow = (cacheResult as any).rows?.[0] || (cacheResult as any)[0];
          if (cacheRow?.current_price) {
            return parseFloat(cacheRow.current_price);
          }
          if (pick.symbol && process.env.ALPHA_VANTAGE_API_KEY) {
            try {
              const avUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(pick.symbol)}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
              const avResp = await fetch(avUrl, { signal: AbortSignal.timeout(8000) });
              const avJson = await avResp.json();
              const avPrice = avJson?.['Global Quote']?.['05. price'];
              if (avPrice) {
                const price = parseFloat(avPrice);
                await db.execute(sql`
                  UPDATE global_instruments SET last_price = ${price}, data_source = 'alpha_vantage', last_updated = NOW()
                  WHERE id = ${pick.instrumentId}
                `);
                return price;
              }
            } catch {}
          }
          return null;

        case 'mutual_funds':
          const fund = await db
            .select({ nav: mutualFunds.nav })
            .from(mutualFunds)
            .where(eq(mutualFunds.schemeCode, pick.instrumentId))
            .limit(1);
          return fund[0]?.nav ? parseFloat(fund[0].nav) : null;

        case 'bonds':
          const bond = await db
            .select({ cleanPrice: bondCatalog.cleanPrice })
            .from(bondCatalog)
            .where(eq(bondCatalog.id, pick.instrumentId))
            .limit(1);
          return bond[0]?.cleanPrice ? parseFloat(bond[0].cleanPrice) : null;

        case 'unlisted':
          const company = await db
            .select({ publishedBuyPrice: unlistedCompanies.publishedBuyPrice })
            .from(unlistedCompanies)
            .where(eq(unlistedCompanies.id, pick.instrumentId))
            .limit(1);
          return company[0]?.publishedBuyPrice ? parseFloat(company[0].publishedBuyPrice) : null;

        case 'etfs':
          const etf = await db
            .select({ lastPrice: instrumentMaster.lastPrice })
            .from(instrumentMaster)
            .where(eq(instrumentMaster.id, pick.instrumentId))
            .limit(1);
          return etf[0]?.lastPrice ? parseFloat(etf[0].lastPrice) : null;

        case 'reits_invits':
          const reitResult = await db.execute(sql`
            SELECT current_price FROM reits WHERE id::text = ${pick.instrumentId}
            UNION ALL
            SELECT current_price FROM invits WHERE id::text = ${pick.instrumentId}
            LIMIT 1
          `);
          const reitRow = (reitResult as any).rows?.[0] || (reitResult as any)[0];
          return reitRow?.current_price ? parseFloat(reitRow.current_price) : null;

        case 'sgb':
          const sgbResult = await db.execute(sql`
            SELECT issue_price FROM sgb_primary_issues WHERE id = ${pick.instrumentId} LIMIT 1
          `);
          const sgbRow = (sgbResult as any).rows?.[0] || (sgbResult as any)[0];
          if (!sgbRow?.issue_price) return null;
          const sgbIssuePrice = parseFloat(sgbRow.issue_price);
          const goldResult = await db.execute(sql`
            SELECT price FROM commodity_prices WHERE symbol = 'GOLD' AND price IS NOT NULL ORDER BY last_updated DESC LIMIT 1
          `);
          const goldRow = (goldResult as any).rows?.[0] || (goldResult as any)[0];
          if (goldRow?.price) {
            const goldPriceUSD = parseFloat(goldRow.price);
            let usdToInr = 83.5;
            try { usdToInr = await currencyExchangeService.getExchangeRate('USD', 'INR'); } catch {}
            const goldPricePerGramINR = (goldPriceUSD / 31.1035) * usdToInr;
            const sgbGramsPerUnit = 1;
            const estimatedCurrentValue = goldPricePerGramINR * sgbGramsPerUnit;
            if (estimatedCurrentValue > 0 && estimatedCurrentValue < sgbIssuePrice * 3) {
              return Math.round(estimatedCurrentValue * 100) / 100;
            }
          }
          try {
            const yahooGoldResult = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1d', {
              signal: AbortSignal.timeout(5000),
              headers: { 'User-Agent': 'FintekPro/2.5' }
            });
            if (yahooGoldResult.ok) {
              const goldData = await yahooGoldResult.json();
              const goldPrice = goldData?.chart?.result?.[0]?.meta?.regularMarketPrice;
              if (goldPrice) {
                let usdToInrFallback = 83.5;
                try { usdToInrFallback = await currencyExchangeService.getExchangeRate('USD', 'INR'); } catch {}
                const goldPricePerGramINR = (goldPrice / 31.1035) * usdToInrFallback;
                if (goldPricePerGramINR > 0 && goldPricePerGramINR < sgbIssuePrice * 3) {
                  await db.execute(sql`
                    INSERT INTO commodity_prices (id, symbol, name, category, price, price_unit, last_updated)
                    VALUES (gen_random_uuid()::text, 'GOLD', 'Gold Spot (XAU/USD)', 'precious_metals', ${goldPrice}, 'USD/oz', NOW())
                    ON CONFLICT (symbol) DO UPDATE SET price = ${goldPrice}, last_updated = NOW()
                  `).catch(() => {});
                  return Math.round(goldPricePerGramINR * 100) / 100;
                }
              }
            }
          } catch {}
          return sgbIssuePrice;

        default:
          return null;
      }
    } catch (error) {
      console.error(`[PickOfTheDay] Error getting current price for ${pick.instrumentName}:`, error);
      return null;
    }
  }

  /**
   * Refresh prices for all live picks - called periodically to keep returnPct accurate
   */
  async refreshLivePicks(): Promise<{ updated: number; errors: number }> {
    let updated = 0;
    let errors = 0;
    
    try {
      // Get all live picks
      const livePicks = await db
        .select()
        .from(dailyPicks)
        .where(eq(dailyPicks.status, 'live'));

      console.log(`[PickOfTheDay] Refreshing prices for ${livePicks.length} live picks`);

      for (const pick of livePicks) {
        try {
          const currentPrice = await this.getCurrentPrice(pick);
          
          if (currentPrice !== null && pick.recoPrice) {
            const recoPrice = parseFloat(pick.recoPrice);
            const returnPct = ((currentPrice - recoPrice) / recoPrice) * 100;
            
            // Calculate days held
            const recoDate = new Date(pick.recoDate);
            const today = new Date();
            const daysHeld = Math.floor((today.getTime() - recoDate.getTime()) / (1000 * 60 * 60 * 24));
            
            // Check if target or stoploss hit
            const targetPrice = parseFloat(pick.targetPrice);
            const stoplossPrice = parseFloat(pick.stoplossPrice);
            let newStatus = 'live';
            
            if (currentPrice >= targetPrice) {
              newStatus = 'target_hit';
            } else if (currentPrice <= stoplossPrice) {
              newStatus = 'stoploss_hit';
            }
            
            // Check if expired
            const expiryDate = new Date(pick.expiryDate);
            if (today > expiryDate && newStatus === 'live') {
              newStatus = 'expired';
            }

            await db
              .update(dailyPicks)
              .set({
                currentPrice: currentPrice.toString(),
                returnPct: returnPct.toFixed(2),
                daysHeld,
                status: newStatus,
                updatedAt: new Date(),
              })
              .where(eq(dailyPicks.id, pick.id));

            updated++;
          }
        } catch (err) {
          console.error(`[PickOfTheDay] Error refreshing pick ${pick.id}:`, err);
          errors++;
        }
      }

      console.log(`[PickOfTheDay] Refresh complete: ${updated} updated, ${errors} errors`);
      return { updated, errors };
    } catch (error) {
      console.error("[PickOfTheDay] Error in refreshLivePicks:", error);
      return { updated, errors };
    }
  }

  private transformPick(pick: any): DailyPickData {
    return {
      id: pick.id,
      category: pick.category,
      instrumentId: pick.instrumentId,
      instrumentName: pick.instrumentName,
      isin: pick.isin,
      symbol: pick.symbol,
      market: pick.market,
      exchange: pick.exchange,
      recoDate: pick.recoDate,
      recoPrice: parseFloat(pick.recoPrice),
      targetPrice: parseFloat(pick.targetPrice),
      stoplossPrice: parseFloat(pick.stoplossPrice),
      currentPrice: pick.currentPrice ? parseFloat(pick.currentPrice) : undefined,
      status: pick.status,
      expiryDate: pick.expiryDate,
      returnPct: pick.returnPct ? parseFloat(pick.returnPct) : undefined,
      daysHeld: pick.daysHeld,
      rationale: pick.rationale,
      riskLevel: pick.riskLevel || 'medium',
      suitableFor: pick.suitableFor || [],
      keyMetrics: pick.keyMetrics,
      timeHorizon: pick.timeHorizon || this.getTimeHorizon(pick.category),
      confidenceScore: pick.confidenceScore || 70,
      sectorCategory: pick.sectorCategory,
      updatedAt: pick.updatedAt,
      statusUpdatedAt: pick.statusUpdatedAt,
    };
  }

  async updateLivePricesDaily(): Promise<void> {
    try {
      const livePicks = await db.select().from(dailyPicks).where(eq(dailyPicks.status, 'live'));
      if (livePicks.length === 0) return;

      let updated = 0;

      for (const pick of livePicks) {
        try {
          let newPrice: number | null = null;

          switch (pick.category) {
            case 'listed_stocks':
            case 'etfs':
            case 'etf': {
              if (pick.symbol) {
                const rows = await db.select({ p: listedStocks.currentPrice }).from(listedStocks).where(eq(listedStocks.symbol, pick.symbol)).limit(1);
                newPrice = rows[0]?.p ? parseFloat(rows[0].p) : null;
              }
              if (newPrice == null && pick.isin) {
                const rows = await db.select({ p: listedStocks.currentPrice }).from(listedStocks).where(eq(listedStocks.isin, pick.isin)).limit(1);
                newPrice = rows[0]?.p ? parseFloat(rows[0].p) : null;
              }
              break;
            }
            case 'mutual_funds': {
              const schemeCode = pick.instrumentId || pick.symbol;
              if (schemeCode) {
                const rows = await db.select({ p: mutualFunds.nav }).from(mutualFunds).where(eq(mutualFunds.schemeCode, schemeCode)).limit(1);
                newPrice = rows[0]?.p ? parseFloat(rows[0].p) : null;
              }
              if (newPrice == null && pick.isin) {
                const rows = await db.select({ p: mutualFunds.nav }).from(mutualFunds).where(eq(mutualFunds.isin, pick.isin)).limit(1);
                newPrice = rows[0]?.p ? parseFloat(rows[0].p) : null;
              }
              break;
            }
            case 'bonds': {
              if (pick.instrumentId) {
                const rows = await db.select({ p: bondCatalog.cleanPrice }).from(bondCatalog).where(eq(bondCatalog.id, pick.instrumentId)).limit(1);
                newPrice = rows[0]?.p ? parseFloat(rows[0].p) : null;
              }
              if (newPrice == null && pick.isin) {
                const rows = await db.select({ p: bondCatalog.cleanPrice }).from(bondCatalog).where(eq(bondCatalog.isin, pick.isin)).limit(1);
                newPrice = rows[0]?.p ? parseFloat(rows[0].p) : null;
              }
              break;
            }
            case 'global_stocks': {
              if (pick.symbol) {
                const rows = await db.select({ p: globalInstruments.lastPrice }).from(globalInstruments).where(eq(globalInstruments.symbol, pick.symbol)).limit(1);
                newPrice = rows[0]?.p ? parseFloat(String(rows[0].p)) : null;
              }
              break;
            }
            case 'reit_invit': {
              if (pick.isin) {
                const reit = await db.execute(sql`SELECT current_price FROM reits WHERE isin_code = ${pick.isin} LIMIT 1`);
                if (reit.rows[0]?.current_price) {
                  newPrice = parseFloat(String(reit.rows[0].current_price));
                } else {
                  const invit = await db.execute(sql`SELECT current_price FROM invits WHERE isin_code = ${pick.isin} LIMIT 1`);
                  if (invit.rows[0]?.current_price) newPrice = parseFloat(String(invit.rows[0].current_price));
                }
              }
              break;
            }
            case 'derivatives': {
              // Auto-expire derivatives whose F&O contract has passed
              if (pick.expiryDate && new Date(pick.expiryDate) < new Date()) {
                await db.update(dailyPicks).set({ status: 'expired', statusUpdatedAt: new Date(), updatedAt: new Date() }).where(eq(dailyPicks.id, pick.id));
              }
              continue;
            }
            // No daily price for sgb, unlisted, fixed_deposits
            default:
              continue;
          }

          if (newPrice && newPrice > 0) {
            const recoPrice = parseFloat(String(pick.recoPrice));
            const returnPct = recoPrice > 0 ? ((newPrice - recoPrice) / recoPrice) * 100 : null;
            const targetPrice = pick.targetPrice ? parseFloat(String(pick.targetPrice)) : null;
            const stoplossPrice = pick.stoplossPrice ? parseFloat(String(pick.stoplossPrice)) : null;

            let newStatus: string = pick.status;
            if (targetPrice && newPrice >= targetPrice) newStatus = 'target_hit';
            else if (stoplossPrice && stoplossPrice > 0 && newPrice <= stoplossPrice) newStatus = 'stoploss_hit';

            await db.update(dailyPicks).set({
              currentPrice: String(Math.round(newPrice * 10000) / 10000),
              returnPct: returnPct != null ? String(Math.round(returnPct * 100) / 100) : null,
              status: newStatus as any,
              updatedAt: new Date(),
              ...(newStatus !== pick.status ? { statusUpdatedAt: new Date() } : {}),
            }).where(eq(dailyPicks.id, pick.id));
            updated++;
          }
        } catch (err) {
          console.warn(`[PickOfTheDay] Price update failed for ${pick.instrumentName}:`, err);
        }
      }

      console.log(`✅ [PickOfTheDay] Daily price refresh: updated ${updated}/${livePicks.length} live picks`);
    } catch (error) {
      console.error('[PickOfTheDay] Failed to run daily price refresh:', error);
    }
  }

  async startDailyScheduler(): Promise<void> {
    await this.catchUpIfNeeded();

    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);

    // Schedule pick generation at 9:00 AM IST
    const genTarget = new Date(istNow);
    genTarget.setHours(9, 0, 0, 0);
    if (istNow >= genTarget) genTarget.setDate(genTarget.getDate() + 1);
    const msUntilGen = genTarget.getTime() - istNow.getTime();

    setTimeout(() => {
      this.scheduledGenerate();
      setInterval(() => this.scheduledGenerate(), 24 * 60 * 60 * 1000);
    }, msUntilGen);

    // Schedule daily price refresh at 4:00 PM IST (30 min after market close at 3:30 PM IST)
    const priceTarget = new Date(istNow);
    priceTarget.setHours(16, 0, 0, 0);
    if (istNow >= priceTarget) priceTarget.setDate(priceTarget.getDate() + 1);
    const msUntilPrice = priceTarget.getTime() - istNow.getTime();

    setTimeout(() => {
      this.updateLivePricesDaily();
      setInterval(() => this.updateLivePricesDaily(), 24 * 60 * 60 * 1000);
    }, msUntilPrice);

    const hoursUntilGen = Math.round(msUntilGen / (1000 * 60 * 60) * 10) / 10;
    const hoursUntilPrice = Math.round(msUntilPrice / (1000 * 60 * 60) * 10) / 10;
    console.log(`📅 [PickOfTheDay] Daily auto-generation scheduled at 9:00 AM IST (next run in ${hoursUntilGen}h)`);
    console.log(`📈 [PickOfTheDay] Daily price refresh scheduled at 4:00 PM IST (next run in ${hoursUntilPrice}h)`);
  }

  private async catchUpIfNeeded(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const existing = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(dailyPicks)
        .where(eq(dailyPicks.recoDate, today));

      const count = Number(existing[0]?.count || 0);
      if (count === 0) {
        console.log(`🔄 [PickOfTheDay] No picks for today (${today}), generating on startup...`);
        const picks = await this.generateDailyPicks();
        console.log(`✅ [PickOfTheDay] Startup catch-up: generated ${picks.length} picks`);
      } else {
        console.log(`✅ [PickOfTheDay] Picks already exist for today (${today}): ${count} picks`);
      }
    } catch (error) {
      console.error(`❌ [PickOfTheDay] Startup catch-up failed:`, error);
    }
  }

  private async scheduledGenerate(): Promise<void> {
    try {
      console.log(`📅 [PickOfTheDay] Running scheduled daily generation...`);
      const picks = await this.generateDailyPicks();
      console.log(`✅ [PickOfTheDay] Scheduled generation complete: ${picks.length} picks`);
    } catch (error) {
      console.error(`❌ [PickOfTheDay] Scheduled generation failed:`, error);
    }
  }

  async getMostRecentPicks(): Promise<DailyPickData[]> {
    const latestDate = await db
      .select({ maxDate: sql<string>`MAX(reco_date)` })
      .from(dailyPicks);

    const recoDate = latestDate[0]?.maxDate;
    if (!recoDate) return [];

    const picks = await db
      .select()
      .from(dailyPicks)
      .where(eq(dailyPicks.recoDate, recoDate))
      .orderBy(dailyPicks.category);

    return picks.map(this.transformPick);
  }
}

export const pickOfTheDayService = new PickOfTheDayService();
