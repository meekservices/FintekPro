import { db } from "../../db";
import { listedStocks, goldenPrices, stockFinancialMetrics } from "@shared/schema";
import { screenerStocks } from "@shared/schema/screener";
import { and, eq, sql, gte, asc, desc, count, or, ilike } from "drizzle-orm";

import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory, calculateSuggestedAllocation } from "../pick-of-the-day-service";
import { getEnrichedStockSnapshots, EnrichedStockSnapshot } from '../screener/enriched-stock-data';
import { FinancialMetricsCalculator } from "../financial-metrics-calculator";
import { unifiedAIRecommendationEngine } from "../unified-ai-recommendation-engine";

const financialMetricsCalculator = new FinancialMetricsCalculator();

/**
 * AI Alpha boost cache: keyed by symbol, stores the last AI conviction score (0-20)
 * for up to CACHE_TTL_MS milliseconds to avoid repeated Gemini calls per run.
 */
const _aiAlphaCache = new Map<string, { score: number; ts: number }>();
const AI_ALPHA_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// ── Broad-sector taxonomy ─────────────────────────────────────────────────────
// Maps 5 investor-friendly broad sectors to the keyword patterns found in the
// `sector` and `broad_sector` columns of listed_stocks (185 granular values).
export const BROAD_SECTORS = [
  {
    id: 'banking_finance',
    label: 'Banking & Finance',
    icon: '🏦',
    color: '#3B82F6',
    keywords: ['bank', 'finance', 'financial', 'nbfc', 'insurance', 'capital', 'invest', 'brokerage', 'microfinance', 'housing finance'],
  },
  {
    id: 'information_technology',
    label: 'Information Technology',
    icon: '💻',
    color: '#8B5CF6',
    keywords: ['it ', 'software', 'technology', 'tech', 'digital', 'saas', 'computer', 'data', 'internet', 'semiconductor', 'telecom'],
  },
  {
    id: 'healthcare_pharma',
    label: 'Healthcare & Pharma',
    icon: '💊',
    color: '#10B981',
    keywords: ['pharma', 'health', 'medical', 'hospital', 'biotech', 'diagnostics', 'drug', 'healthcare', 'life science'],
  },
  {
    id: 'auto_infra',
    label: 'Auto & Capital Goods',
    icon: '🏭',
    color: '#F59E0B',
    keywords: ['auto', 'automobile', 'vehicle', 'infrastructure', 'capital good', 'engineering', 'construction', 'cement', 'steel', 'metal', 'energy', 'power', 'oil', 'gas', 'mining', 'realty', 'real estate'],
  },
  {
    id: 'fmcg_consumer',
    label: 'FMCG & Consumer',
    icon: '🛒',
    color: '#EF4444',
    keywords: ['fmcg', 'consumer', 'retail', 'food', 'beverage', 'textile', 'apparel', 'media', 'entertainment', 'hotel', 'hospitality', 'agri', 'agriculture', 'chemical'],
  },
] as const;

export type BroadSectorId = typeof BROAD_SECTORS[number]['id'];

/**
 * Maps a granular NSE/BSE sector string to one of the 5 broad sector IDs.
 * Falls back to the last sector (FMCG/Consumer) if no keyword matches.
 */
export function mapToBroadSector(sector: string | null | undefined): BroadSectorId {
  if (!sector) return 'fmcg_consumer';
  const lower = sector.toLowerCase();
  for (const bs of BROAD_SECTORS) {
    if (bs.keywords.some(kw => lower.includes(kw))) return bs.id;
  }
  return 'fmcg_consumer'; // catch-all
}

/**
 * Simple concurrency limiter — runs `tasks` with at most `concurrency` running
 * simultaneously. Replaces p-limit without adding a dependency.
 * @param tasks  Array of async thunks (() => Promise<T>)
 * @param concurrency  Max parallel executions
 */
async function runConcurrent<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

/** Cached flag: undefined = unchecked, true = has rows, false = empty table */
let _metricsTableHasData: boolean | undefined;

export class StockStrategy extends BaseStrategy {
  category: PickCategory = 'listed_stocks';

  /**
   * Generates one pick per broad sector (up to 5).
   * Returns an array so the caller (pick-of-the-day-service) can governance-gate each independently.
   *
   * @param context - Scheduler context including today's date, market regime, and recently-picked IDs.
   * @returns Array of DailyPickData (may be empty on failure), or null on hard error.
   */
  async generate(context: StrategyContext): Promise<DailyPickData[] | null> {
    try {
      const results: DailyPickData[] = [];
      const usedIds = new Set<string>(context.recentIds ?? []);

      for (const broadSector of BROAD_SECTORS) {
        try {
          const pick = await this.pickBestForSector(broadSector, context, usedIds);
          if (pick) {
            results.push(pick);
            // Prevent the same stock appearing in multiple sectors
            if (pick.instrumentId) usedIds.add(pick.instrumentId);
          }
        } catch (sectorErr) {
          console.warn(`[StockStrategy] Failed to pick for sector ${broadSector.label}:`, sectorErr);
        }
      }

      if (results.length === 0) {
        console.warn('[StockStrategy] No sector picks generated — all sectors failed or were empty');
        return null;
      }

      console.info(`[StockStrategy] Generated ${results.length} sector picks: ${results.map(p => `${p.sectorCategory} → ${p.symbol}`).join(', ')}`);
      return results;
    } catch (error) {
      console.error("[StockStrategy] Fatal error:", error);
      return null;
    }
  }

  /**
   * Picks the single best stock for a given broad sector.
   * Fetches up to 8 candidates, scores them, returns the top scorer.
   *
   * @param broadSector - One of the 5 BROAD_SECTORS definitions.
   * @param context     - Strategy context (today, recentIds, service).
   * @param usedIds     - Already-selected stock IDs to exclude (cross-sector dedup).
   * @returns A DailyPickData for the best stock in this sector, or null if none qualify.
   */
  private async pickBestForSector(
    broadSector: typeof BROAD_SECTORS[number],
    context: StrategyContext,
    usedIds: Set<string>
  ): Promise<DailyPickData | null> {
    // Build keyword filter — match any of the sector's keywords in the sector column
    const sectorConditions = broadSector.keywords.map(kw =>
      ilike(listedStocks.sector, `%${kw}%`)
    );
    const broadSectorConditions = broadSector.keywords.map(kw =>
      ilike(listedStocks.broadSector, `%${kw}%`)
    );

    let stocks = await db
      .select()
      .from(listedStocks)
      .where(
        and(
          eq(listedStocks.isPublished, true),
          sql`${listedStocks.currentPrice} IS NOT NULL`,
          sql`CAST(${listedStocks.currentPrice} AS DECIMAL) > 50`,
          or(
            or(...sectorConditions),
            or(...broadSectorConditions)
          )
        )
      )
      .limit(8);

    // Fallback to screenerStocks if listedStocks has no sector data
    if (stocks.length === 0) {
      const screenerConditions = broadSector.keywords.map(kw =>
        ilike(screenerStocks.sector, `%${kw}%`)
      );
      const screenerRows = await db
        .select()
        .from(screenerStocks)
        .where(
          and(
            eq(screenerStocks.isActive, true),
            sql`${screenerStocks.currentPrice} IS NOT NULL`,
            sql`CAST(${screenerStocks.currentPrice} AS DECIMAL) > 50`,
            or(...screenerConditions)
          )
        )
        .limit(8);

      stocks = screenerRows.map(r => ({
        id: r.id,
        symbol: r.symbol,
        companyName: r.companyName,
        currentPrice: r.currentPrice,
        sector: r.sector ?? null,
        marketCap: r.marketCapCategory ?? null,
        peRatio: null, pbRatio: null, dividendYield: null, eps: null,
        bookValue: null, roe: null, roce: null,
        returns1M: null, returns3M: null, returns6M: null,
        returns1Y: null, returns3Y: null, returns5Y: null,
        beta: null, volatility: null, riskLevel: null,
        analystRating: null, targetPrice: null,
        numberOfAnalysts: null, averageVolume: null,
        faceValue: '10', lotSize: 1, minimumInvestment: '0',
        isPublished: false, publishedAt: null, publishedBy: null,
        selectionNotes: null, investmentThesis: null,
        historicalStartDate: null, historicalEndDate: null,
        historicalComplete: false, lastDailyUpdate: null,
        isActive: r.isActive ?? true, dataSource: r.dataSource ?? 'screener',
        enrichmentStatus: 'partial', lastEnrichedAt: null, enrichmentSource: null,
        lastUpdated: r.updatedAt ?? new Date(), createdAt: r.createdAt ?? new Date(),
        previousClose: null, dayChange: null, dayChangePercent: null,
        weekHigh52: null, weekLow52: null,
        marketCapValue: r.marketCapValue ?? null, isin: r.isin ?? null,
        bseCode: null, nseCode: null, cin: null, companyPan: null,
        broadSector: null, industry: r.industry ?? null,
        indexMembership: [], exchangeInfo: {},
      } as typeof listedStocks.$inferSelect));
    }

    // Exclude stocks already picked for another sector today
    const freshStocks = stocks.filter(s => !usedIds.has(s.id));
    if (freshStocks.length === 0) return null;

    // Fetch enriched snapshots for scoring
    const symbols = freshStocks.map(s => s.symbol).filter(Boolean) as string[];
    let enrichedSnapshots: Map<string, EnrichedStockSnapshot> = new Map();
    try {
      enrichedSnapshots = await getEnrichedStockSnapshots(symbols);
    } catch { /* non-fatal — scoring degrades gracefully */ }

    // Score all candidates, pick the top scorer
    const scoringTasks = freshStocks.map(stock => async () => ({
      stock,
      enriched: stock.symbol ? (enrichedSnapshots.get(stock.symbol.toUpperCase()) || null) : null,
      score: await this.score(stock, stock.symbol ? enrichedSnapshots.get(stock.symbol.toUpperCase()) || null : null),
    }));
    const scored = (await runConcurrent(scoringTasks, 4)).sort((a, b) => b.score - a.score);
    if (scored.length === 0) return null;

    const { stock: topStock, enriched: topEnriched, score: topScore } = scored[0];
    const currentPrice = parseFloat(topStock.currentPrice || '0');
    if (currentPrice <= 0) return null;

    const volatility = topStock.volatility ? parseFloat(topStock.volatility) : undefined;
    const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('listed_stocks', volatility);
    const targetPrice  = Math.round(currentPrice * (1 + targetPct)  * 100) / 100;
    const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

    let directRsi: number | null = null;
    let directRoic: number | null = null;
    if (!topEnriched?.fundamentals?.roic && topStock.roce)  directRoic = parseFloat(topStock.roce);
    if (!topEnriched?.technicals?.rsi && (topStock.isin || topStock.symbol))
      directRsi = await this.fetchRsiFromGoldenPrices(topStock);

    const sectorLabel = broadSector.label;
    const rationale = await context.service.generateRationale({
      category: 'listed_stocks',
      name: topStock.companyName || topStock.symbol,
      symbol: topStock.symbol,
      currentPrice,
      targetPrice,
      stoplossPrice,
      metrics: {
        pe: topStock.peRatio || undefined,
        roic: topEnriched?.fundamentals?.roic ?? directRoic ?? undefined,
        rsi:  topEnriched?.technicals?.rsi  ?? directRsi  ?? undefined,
        returns1y: topStock.returns1Y || undefined,
      },
    });

    const exchange = topStock.nseCode ? 'NSE' : (topStock.bseCode ? 'BSE' : 'NSE');
    const riskLevel = this.getRiskLevel(volatility ?? 20);
    const confidenceScore = this.getConfidenceScore('listed_stocks', topScore, 70);
    const suggestedAllocation = calculateSuggestedAllocation(
      'listed_stocks', riskLevel, confidenceScore, { marketCap: topStock.marketCap }
    );

    return {
      category: 'listed_stocks',
      instrumentId: topStock.id,
      instrumentName: topStock.companyName || topStock.symbol,
      isin: topStock.isin || undefined,
      symbol: topStock.symbol,
      exchange,
      recoDate: context.today,
      recoPrice: currentPrice,
      targetPrice,
      stoplossPrice,
      currentPrice,
      status: 'live',
      expiryDate: this.getExpiryDate(this.DEFAULT_VALIDITY_DAYS),
      rationale,
      riskLevel,
      suitableFor: this.deriveSuitableFor(riskLevel, 'listed_stocks'),
      timeHorizon: this.getTimeHorizon('listed_stocks'),
      confidenceScore,
      // Store both the granular sector and the broad sector label for UI grouping
      sectorCategory: topStock.sector || sectorLabel,
      keyMetrics: {
        cmp: currentPrice,
        pe: topStock.peRatio ? parseFloat(topStock.peRatio) : undefined,
        returns1y: topStock.returns1Y ? parseFloat(topStock.returns1Y) : undefined,
        returns3y: topStock.returns3Y ? parseFloat(topStock.returns3Y) : undefined,
        volatility: volatility,
        sector: topStock.sector || sectorLabel,
        broadSector: broadSector.id,      // ← used by the UI for grouping
        broadSectorLabel: sectorLabel,    // ← human-readable label
        broadSectorIcon: broadSector.icon,
        broadSectorColor: broadSector.color,
        marketCap: topStock.marketCap || undefined,
        analystRating: topStock.analystRating || undefined,
        roic: topEnriched?.fundamentals?.roic ?? directRoic ?? null,
        rsi:  topEnriched?.technicals?.rsi  ?? directRsi  ?? null,
        suggestedAllocation,
      },
    };
  }

  async score(stock: any, enriched?: EnrichedStockSnapshot | null): Promise<number> {
    let score = 0;
    
    const analystRating = stock.analystRating?.toLowerCase() || '';
    if (analystRating.includes('strong buy')) score += 25;
    else if (analystRating.includes('buy')) score += 20;
    
    const returns1Y = stock.returns1Y ? parseFloat(stock.returns1Y) : 0;
    if (returns1Y > 30) score += 20;
    else if (returns1Y > 15) score += 15;
    
    const pe = stock.peRatio ? parseFloat(stock.peRatio) : 0;
    if (pe > 0 && pe < 15) score += 15;
    else if (pe >= 15 && pe < 25) score += 10;
    
    if (stock.marketCap === 'Large Cap') score += 10;
    else if (stock.marketCap === 'Mid Cap') score += 8;
    
    const advancedMetrics = await this.calculateAdvancedMetrics(stock);
    if (advancedMetrics.piotroskiFScore && advancedMetrics.piotroskiFScore >= 8) score += 15;
    if (advancedMetrics.roic && advancedMetrics.roic > 20) score += 10;

    if (enriched) {
      if (enriched.fundamentals?.roe && enriched.fundamentals.roe > 15) score += 8;
      if (enriched.growth?.epsGrowth && enriched.growth.epsGrowth > 20) score += 8;
    }

    // ── AI Alpha Boost (merged from Stock AI engine) ───────────────────────────
    // Queries the unified AI recommendation engine for additional conviction.
    // Adds up to +20 points based on AI-assessed signal strength.
    // Non-fatal: if AI is unavailable, pick generation continues with quant score only.
    if (stock.symbol) {
      const aiBoost = await this.getAIAlphaBoost(stock, enriched);
      score += aiBoost;
    }
    
    return Math.max(0, score);
  }

  /**
   * Queries the unified AI recommendation engine for an alpha conviction boost.
   * Returns 0–20 additional score points based on AI signal strength.
   * Results are cached per symbol for 4 hours to avoid repeated API calls per batch run.
   *
   * @param stock - The stock row from listedStocks or screenerStocks.
   * @param enriched - Optional enriched snapshot with fundamentals/technicals.
   * @returns A score boost in the range [0, 20]. Returns 0 on any error.
   */
  private async getAIAlphaBoost(stock: any, enriched?: EnrichedStockSnapshot | null): Promise<number> {
    const symbol: string = stock.symbol || '';
    if (!symbol) return 0;

    // Check cache first to avoid repeated Gemini calls within the same batch
    const cached = _aiAlphaCache.get(symbol);
    if (cached && (Date.now() - cached.ts) < AI_ALPHA_CACHE_TTL_MS) {
      return cached.score;
    }

    try {
      const pe = stock.peRatio ? parseFloat(stock.peRatio) : undefined;
      const roe = enriched?.fundamentals?.roe ?? (stock.roe ? parseFloat(stock.roe) : undefined);
      const returns1Y = stock.returns1Y ? parseFloat(stock.returns1Y) : undefined;
      const sector = stock.sector || stock.broadSector || 'Equity';
      const currentPrice = stock.currentPrice ? parseFloat(stock.currentPrice) : undefined;

      // Build a ProductData object for the unified engine's analyzeProduct method
      const productData = {
        id: stock.id || symbol,
        name: stock.companyName || symbol,
        category: 'stocks' as const,
        ticker: symbol,
        isin: stock.isin,
        sector,
        currentPrice,
        peRatio: pe,
        returns1Y,
        dividendYield: stock.dividendYield ? parseFloat(stock.dividendYield) : undefined,
        rawData: {
          roe,
          marketCap: stock.marketCap,
          analystRating: stock.analystRating,
          returns3Y: stock.returns3Y ? parseFloat(stock.returns3Y) : undefined,
          volatility: stock.volatility ? parseFloat(stock.volatility) : undefined,
        },
      };

      const analysis = await unifiedAIRecommendationEngine.analyzeProduct(productData);

      // Map the overall score (0-100) to a boost (0-20 pts).
      // Only apply a meaningful boost for buy-rated, high-confidence picks.
      let boost = 0;
      if (analysis.recommendation === 'buy' && analysis.confidenceScore >= 60) {
        boost = Math.round((analysis.overallScore / 100) * 20);
      } else if (analysis.recommendation === 'buy') {
        boost = Math.round((analysis.overallScore / 100) * 10);
      }

      boost = Math.max(0, Math.min(20, boost));
      _aiAlphaCache.set(symbol, { score: boost, ts: Date.now() });
      return boost;
    } catch (err) {
      // AI unavailable — non-fatal, quant score is sufficient
      console.warn(`[StockStrategy] AI alpha boost unavailable for ${symbol}:`, (err as Error).message);
      _aiAlphaCache.set(symbol, { score: 0, ts: Date.now() });
      return 0;
    }
  }

  private async calculateAdvancedMetrics(stock: any): Promise<{ piotroskiFScore?: number; roic?: number }> {
    try {
      if (!stock.id && !stock.symbol) return {};

      // One-time table check: if stockFinancialMetrics is empty, skip all 30
      // per-stock queries and return {} immediately. Cached for the batch run.
      if (_metricsTableHasData === false) return {};
      if (_metricsTableHasData === undefined) {
        const [{ value }] = await db
          .select({ value: count() })
          .from(stockFinancialMetrics);
        _metricsTableHasData = (value ?? 0) > 0;
        if (!_metricsTableHasData) {
          console.info('[StockStrategy] stockFinancialMetrics table is empty — skipping advanced metrics for this batch');
          return {};
        }
      }

      // Fetch the most recent metrics row for this stock
      const rows = await db
        .select({
          piotroskiFScore: stockFinancialMetrics.piotroskiFScore,
          roic:            stockFinancialMetrics.roic,
          roa:             stockFinancialMetrics.roa,
          operatingCashFlow: stockFinancialMetrics.operatingCashFlow,
          debtToEquity:    stockFinancialMetrics.debtToEquity,
          currentRatio:    stockFinancialMetrics.currentRatio,
          grossMargin:     stockFinancialMetrics.grossMargin,
          assetTurnover:   stockFinancialMetrics.assetTurnover,
          netIncome:       stockFinancialMetrics.netIncome,
        })
        .from(stockFinancialMetrics)
        .where(
          stock.id
            ? eq(stockFinancialMetrics.stockId, stock.id)
            : eq(stockFinancialMetrics.symbol, stock.symbol)
        )
        .orderBy(desc(stockFinancialMetrics.fiscalYear))
        .limit(1);

      if (rows.length === 0) return {};
      const m = rows[0];

      const roic = m.roic ? parseFloat(m.roic) : undefined;

      // Use pre-computed Piotroski F-Score if available
      if (m.piotroskiFScore != null) {
        return { piotroskiFScore: m.piotroskiFScore, roic };
      }

      // Derive a simplified Piotroski-style score from available ratios (4 signals)
      // Full 9-signal score requires 2-year comparison; we score what we can
      let score = 0;
      if (m.roa && parseFloat(m.roa) > 0) score++;                          // ROA positive
      if (m.operatingCashFlow && parseFloat(m.operatingCashFlow) > 0) score++; // OCF positive
      if (m.debtToEquity && parseFloat(m.debtToEquity) < 0.5) score++;       // Low leverage
      if (m.currentRatio && parseFloat(m.currentRatio) > 1.5) score++;        // Good liquidity
      if (m.grossMargin && parseFloat(m.grossMargin) > 0.3) score++;          // Healthy margins
      if (m.assetTurnover && parseFloat(m.assetTurnover) > 0.5) score++;      // Efficient assets
      if (m.netIncome && parseFloat(m.netIncome) > 0) score++;               // Profitable

      // Scale to 0–9 range proportionally (7 signals → 9)
      const scaledScore = Math.round((score / 7) * 9);
      return { piotroskiFScore: scaledScore, roic };
    } catch (err) {
      console.warn('[StockStrategy] calculateAdvancedMetrics failed:', err);
      return {};
    }
  }


  private async fetchRsiFromGoldenPrices(stock: any): Promise<number | null> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 35);
      const priceRows = await db
        .select({ price: goldenPrices.price, priceDate: goldenPrices.priceDate })
        .from(goldenPrices)
        .where(
          and(
            stock.isin ? eq(goldenPrices.isin, stock.isin) : eq(goldenPrices.symbol, stock.symbol!),
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
        return avgLoss === 0 ? 100 : Math.round((100 - (100 / (1 + avgGain / avgLoss))) * 100) / 100;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getLivePrice(instrumentId: string): Promise<number | null> {
    const row = await db.select({ currentPrice: listedStocks.currentPrice })
      .from(listedStocks).where(eq(listedStocks.id, instrumentId)).limit(1);
    return row[0]?.currentPrice ? parseFloat(row[0].currentPrice) : null;
  }
}
