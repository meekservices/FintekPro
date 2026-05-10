/**
 * Investment Cache Service
 * Centralized caching layer for market data, fundamentals, AI rationales, 
 * portfolio metrics, and advanced financial metrics to reduce external API calls 
 * during rebalancing and proposal generation.
 */

import { db } from "../db";
import { eq, and, gte, lte, sql, or, desc, type SQL } from "drizzle-orm";
import { 
  marketDataSnapshots, 
  productFundamentalsCache, 
  aiRationaleCache, 
  portfolioMetricsDaily,
  rebalanceSummaries,
  proposalMaterializations,
  cacheRefreshJobs,
  stockFinancialMetrics,
  type MarketDataSnapshot,
  type ProductFundamentalsCache,
  type AiRationaleCache,
  type PortfolioMetricsDaily,
  type RebalanceSummary,
  type ProposalMaterialization,
  type InsertMarketDataSnapshot,
  type InsertProductFundamentalsCache,
  type InsertAiRationaleCache,
  type InsertPortfolioMetricsDaily,
  type InsertRebalanceSummary,
  type InsertProposalMaterialization
} from "@shared/schema";
import crypto from "crypto";

// Cache TTL configurations (in hours)
const CACHE_TTL = {
  MARKET_DATA: 1,           // 1 hour for intraday prices
  MARKET_DATA_EOD: 18,      // 18 hours for end-of-day data
  FUNDAMENTALS: 24,         // 24 hours for fundamentals
  FUNDAMENTALS_RATINGS: 72, // 72 hours for ratings
  AI_RATIONALE: 168,        // 7 days for AI rationales (inputs rarely change)
  PORTFOLIO_METRICS: 4,     // 4 hours for portfolio metrics
  REBALANCE_SUMMARY: 24,    // 24 hours for rebalance summaries
  PROPOSAL: 48,             // 48 hours for proposals
  PRICE_VALIDITY: 4         // 4 hours for price validity in proposals
};

/**
 * Generate SHA-256 hash for cache key
 */
function generateHash(input: Record<string, unknown>): string {
  const normalized = JSON.stringify(input, Object.keys(input).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * Calculate expiry timestamp
 */
function getExpiry(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

/**
 * Check if cache entry is still valid
 */
function isValid(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) > new Date();
}

// =====================================================
// MARKET DATA CACHE
// =====================================================

export async function getCachedMarketData(
  assetType: string,
  assetId: string,
  snapshotDate?: Date
): Promise<MarketDataSnapshot | null> {
  const targetDate = snapshotDate || new Date();
  const dateStr = targetDate.toISOString().split("T")[0];
  
  const [cached] = await db
    .select()
    .from(marketDataSnapshots)
    .where(
      and(
        eq(marketDataSnapshots.assetType, assetType),
        eq(marketDataSnapshots.assetId, assetId),
        eq(marketDataSnapshots.snapshotDate, dateStr),
        gte(marketDataSnapshots.expiresAt, new Date())
      )
    )
    .limit(1);
  
  return cached || null;
}

export async function getCachedMarketDataBatch(
  assets: Array<{ assetType: string; assetId: string }>
): Promise<Map<string, MarketDataSnapshot>> {
  if (assets.length === 0) return new Map();
  
  const today = new Date().toISOString().split("T")[0];
  const conditions = assets.map(a => 
    and(
      eq(marketDataSnapshots.assetType, a.assetType),
      eq(marketDataSnapshots.assetId, a.assetId)
    )
  );
  
  const results = await db
    .select()
    .from(marketDataSnapshots)
    .where(
      and(
        or(...conditions),
        eq(marketDataSnapshots.snapshotDate, today),
        gte(marketDataSnapshots.expiresAt, new Date())
      )
    );
  
  const map = new Map<string, MarketDataSnapshot>();
  results.forEach(r => {
    map.set(`${r.assetType}:${r.assetId}`, r);
  });
  
  return map;
}

export async function cacheMarketData(
  data: Omit<InsertMarketDataSnapshot, "expiresAt">,
  ttlHours: number = CACHE_TTL.MARKET_DATA
): Promise<MarketDataSnapshot> {
  const [result] = await db
    .insert(marketDataSnapshots)
    .values({
      ...data,
      expiresAt: getExpiry(ttlHours),
      snapshotDate: data.snapshotDate || new Date().toISOString().split("T")[0]
    })
    .onConflictDoUpdate({
      target: [marketDataSnapshots.assetType, marketDataSnapshots.assetId, marketDataSnapshots.snapshotDate],
      set: {
        currentPrice: data.currentPrice,
        previousClose: data.previousClose,
        return1D: data.return1D,
        return1W: data.return1W,
        return1M: data.return1M,
        return3M: data.return3M,
        return6M: data.return6M,
        return1Y: data.return1Y,
        return3Y: data.return3Y,
        return5Y: data.return5Y,
        returnSI: data.returnSI,
        nav: data.nav,
        aum: data.aum,
        volume: data.volume,
        yieldToMaturity: data.yieldToMaturity,
        couponRate: data.couponRate,
        fetchedAt: new Date(),
        expiresAt: getExpiry(ttlHours),
        isStale: false,
        rawData: data.rawData
      }
    })
    .returning();
  
  return result;
}

export async function invalidateMarketData(assetType?: string, assetId?: string): Promise<number> {
  let query = db.update(marketDataSnapshots).set({ isStale: true });
  
  if (assetType && assetId) {
    query = query.where(and(
      eq(marketDataSnapshots.assetType, assetType),
      eq(marketDataSnapshots.assetId, assetId)
    ));
  } else if (assetType) {
    query = query.where(eq(marketDataSnapshots.assetType, assetType));
  }
  
  const result = await query;
  return result.rowCount || 0;
}

// =====================================================
// FUNDAMENTALS CACHE
// =====================================================

export async function getCachedFundamentals(
  productType: string,
  productId: string
): Promise<ProductFundamentalsCache | null> {
  const [cached] = await db
    .select()
    .from(productFundamentalsCache)
    .where(
      and(
        eq(productFundamentalsCache.productType, productType),
        eq(productFundamentalsCache.productId, productId),
        gte(productFundamentalsCache.expiresAt, new Date())
      )
    )
    .limit(1);
  
  return cached || null;
}

export async function getCachedFundamentalsBatch(
  products: Array<{ productType: string; productId: string }>
): Promise<Map<string, ProductFundamentalsCache>> {
  if (products.length === 0) return new Map();
  
  const conditions = products.map(p => 
    and(
      eq(productFundamentalsCache.productType, p.productType),
      eq(productFundamentalsCache.productId, p.productId)
    )
  );
  
  const results = await db
    .select()
    .from(productFundamentalsCache)
    .where(
      and(
        or(...conditions),
        gte(productFundamentalsCache.expiresAt, new Date())
      )
    );
  
  const map = new Map<string, ProductFundamentalsCache>();
  results.forEach(r => {
    map.set(`${r.productType}:${r.productId}`, r);
  });
  
  return map;
}

export async function cacheFundamentals(
  data: Omit<InsertProductFundamentalsCache, "expiresAt" | "ttlHours">,
  ttlHours: number = CACHE_TTL.FUNDAMENTALS
): Promise<ProductFundamentalsCache> {
  const [result] = await db
    .insert(productFundamentalsCache)
    .values({
      ...data,
      expiresAt: getExpiry(ttlHours),
      ttlHours
    })
    .onConflictDoUpdate({
      target: [productFundamentalsCache.productType, productFundamentalsCache.productId],
      set: {
        productName: data.productName,
        marketCap: data.marketCap,
        peRatio: data.peRatio,
        pbRatio: data.pbRatio,
        eps: data.eps,
        dividendYield: data.dividendYield,
        roe: data.roe,
        roce: data.roce,
        debtToEquity: data.debtToEquity,
        revenueGrowth3Y: data.revenueGrowth3Y,
        profitGrowth3Y: data.profitGrowth3Y,
        expenseRatio: data.expenseRatio,
        alpha: data.alpha,
        beta: data.beta,
        sharpeRatio: data.sharpeRatio,
        sortinoRatio: data.sortinoRatio,
        standardDeviation: data.standardDeviation,
        maxDrawdown: data.maxDrawdown,
        creditRating: data.creditRating,
        creditRatingAgency: data.creditRatingAgency,
        riskScore: data.riskScore,
        volatilityScore: data.volatilityScore,
        liquidityScore: data.liquidityScore,
        fintekproRating: data.fintekproRating,
        morningstarRating: data.morningstarRating,
        sector: data.sector,
        industry: data.industry,
        category: data.category,
        fundManagerId: data.fundManagerId,
        fundManagerName: data.fundManagerName,
        dataSource: data.dataSource,
        cachedAt: new Date(),
        expiresAt: getExpiry(ttlHours),
        rawData: data.rawData
      }
    })
    .returning();
  
  return result;
}

// =====================================================
// AI RATIONALE CACHE
// =====================================================

export async function getCachedRationale(
  rationaleType: string,
  inputParams: Record<string, unknown>
): Promise<AiRationaleCache | null> {
  const inputHash = generateHash(inputParams);
  
  const [cached] = await db
    .select()
    .from(aiRationaleCache)
    .where(
      and(
        eq(aiRationaleCache.inputHash, inputHash),
        eq(aiRationaleCache.rationaleType, rationaleType),
        eq(aiRationaleCache.isInvalidated, false),
        gte(aiRationaleCache.expiresAt, new Date())
      )
    )
    .limit(1);
  
  if (cached) {
    // Increment hit count
    await db
      .update(aiRationaleCache)
      .set({ 
        hitCount: sql`${aiRationaleCache.hitCount} + 1`,
        lastHitAt: new Date()
      })
      .where(eq(aiRationaleCache.id, cached.id));
  }
  
  return cached || null;
}

export async function cacheRationale(
  rationaleType: string,
  inputParams: Record<string, unknown>,
  rationale: string,
  options: {
    summary?: string;
    keyPoints?: unknown[];
    riskWarnings?: unknown[];
    confidenceScore?: number;
    modelUsed?: string;
    tokensUsed?: number;
    generationTimeMs?: number;
    productType?: string;
    productId?: string;
    userId?: string;
    riskProfile?: string;
    investmentHorizon?: string;
  } = {},
  ttlHours: number = CACHE_TTL.AI_RATIONALE
): Promise<AiRationaleCache> {
  const inputHash = generateHash(inputParams);
  
  const [result] = await db
    .insert(aiRationaleCache)
    .values({
      inputHash,
      rationaleType,
      inputSnapshot: inputParams,
      rationale,
      summary: options.summary,
      keyPoints: options.keyPoints,
      riskWarnings: options.riskWarnings,
      confidenceScore: options.confidenceScore?.toString(),
      modelUsed: options.modelUsed,
      tokensUsed: options.tokensUsed,
      generationTimeMs: options.generationTimeMs,
      productType: options.productType,
      productId: options.productId,
      userId: options.userId,
      riskProfile: options.riskProfile,
      investmentHorizon: options.investmentHorizon,
      expiresAt: getExpiry(ttlHours)
    })
    .onConflictDoUpdate({
      target: [aiRationaleCache.inputHash, aiRationaleCache.rationaleType],
      set: {
        rationale,
        summary: options.summary,
        keyPoints: options.keyPoints,
        riskWarnings: options.riskWarnings,
        confidenceScore: options.confidenceScore?.toString(),
        modelUsed: options.modelUsed,
        tokensUsed: options.tokensUsed,
        generationTimeMs: options.generationTimeMs,
        expiresAt: getExpiry(ttlHours),
        isInvalidated: false
      }
    })
    .returning();
  
  return result;
}

export async function invalidateRationale(
  rationaleType?: string,
  productType?: string,
  productId?: string
): Promise<number> {
  let conditions: SQL[] = [];
  
  if (rationaleType) conditions.push(eq(aiRationaleCache.rationaleType, rationaleType));
  if (productType) conditions.push(eq(aiRationaleCache.productType, productType));
  if (productId) conditions.push(eq(aiRationaleCache.productId, productId));
  
  const result = await db
    .update(aiRationaleCache)
    .set({ isInvalidated: true })
    .where(conditions.length > 0 ? and(...conditions) : sql`1=1`);
  
  return (result as { rowCount?: number }).rowCount || 0;
}

// =====================================================
// PORTFOLIO METRICS CACHE
// =====================================================

export async function getCachedPortfolioMetrics(
  userId: string,
  portfolioId?: string,
  date?: Date
): Promise<PortfolioMetricsDaily | null> {
  const targetDate = date || new Date();
  const dateStr = targetDate.toISOString().split("T")[0];
  
  let conditions: SQL[] = [
    eq(portfolioMetricsDaily.userId, userId),
    eq(portfolioMetricsDaily.metricsDate, dateStr)
  ];
  
  if (portfolioId) {
    conditions.push(eq(portfolioMetricsDaily.portfolioId, portfolioId));
  }
  
  const [cached] = await db
    .select()
    .from(portfolioMetricsDaily)
    .where(and(...conditions))
    .orderBy(desc(portfolioMetricsDaily.computedAt))
    .limit(1);
  
  return cached || null;
}

export async function cachePortfolioMetrics(
  data: InsertPortfolioMetricsDaily
): Promise<PortfolioMetricsDaily> {
  const [result] = await db
    .insert(portfolioMetricsDaily)
    .values({
      ...data,
      metricsDate: data.metricsDate || new Date().toISOString().split("T")[0]
    })
    .onConflictDoUpdate({
      target: [portfolioMetricsDaily.userId, portfolioMetricsDaily.portfolioId, portfolioMetricsDaily.metricsDate],
      set: {
        totalValue: data.totalValue,
        totalCost: data.totalCost,
        unrealizedGainLoss: data.unrealizedGainLoss,
        dayChange: data.dayChange,
        dayChangePercent: data.dayChangePercent,
        return1D: data.return1D,
        return1W: data.return1W,
        return1M: data.return1M,
        return3M: data.return3M,
        return6M: data.return6M,
        return1Y: data.return1Y,
        returnSI: data.returnSI,
        xirr: data.xirr,
        cagr: data.cagr,
        allocationEquity: data.allocationEquity,
        allocationDebt: data.allocationDebt,
        allocationGold: data.allocationGold,
        allocationCash: data.allocationCash,
        allocationAlternatives: data.allocationAlternatives,
        allocationInternational: data.allocationInternational,
        portfolioVolatility: data.portfolioVolatility,
        portfolioBeta: data.portfolioBeta,
        portfolioSharpe: data.portfolioSharpe,
        maxDrawdown: data.maxDrawdown,
        riskScore: data.riskScore,
        top5Concentration: data.top5Concentration,
        sectorConcentration: data.sectorConcentration,
        driftFromTarget: data.driftFromTarget,
        needsRebalancing: data.needsRebalancing,
        totalHoldings: data.totalHoldings,
        equityHoldings: data.equityHoldings,
        debtHoldings: data.debtHoldings,
        mfHoldings: data.mfHoldings,
        computedAt: new Date(),
        computationTimeMs: data.computationTimeMs
      }
    })
    .returning();
  
  return result;
}

// =====================================================
// REBALANCE SUMMARY CACHE
// =====================================================

export async function getCachedRebalanceSummary(
  userId: string,
  portfolioId?: string
): Promise<RebalanceSummary | null> {
  let conditions: SQL[] = [
    eq(rebalanceSummaries.userId, userId),
    eq(rebalanceSummaries.status, "pending"),
    gte(rebalanceSummaries.expiresAt, new Date())
  ];
  
  if (portfolioId) {
    conditions.push(eq(rebalanceSummaries.portfolioId, portfolioId));
  }
  
  const [cached] = await db
    .select()
    .from(rebalanceSummaries)
    .where(and(...conditions))
    .orderBy(desc(rebalanceSummaries.computedAt))
    .limit(1);
  
  return cached || null;
}

export async function cacheRebalanceSummary(
  data: Omit<InsertRebalanceSummary, "expiresAt">,
  ttlHours: number = CACHE_TTL.REBALANCE_SUMMARY
): Promise<RebalanceSummary> {
  const [result] = await db
    .insert(rebalanceSummaries)
    .values({
      ...data,
      expiresAt: getExpiry(ttlHours)
    })
    .returning();
  
  return result;
}

// =====================================================
// PROPOSAL MATERIALIZATION CACHE
// =====================================================

export async function getCachedProposal(
  inputParams: Record<string, unknown>,
  proposalType: string
): Promise<ProposalMaterialization | null> {
  const inputHash = generateHash(inputParams);
  
  const [cached] = await db
    .select()
    .from(proposalMaterializations)
    .where(
      and(
        eq(proposalMaterializations.inputHash, inputHash),
        eq(proposalMaterializations.proposalType, proposalType),
        gte(proposalMaterializations.expiresAt, new Date()),
        gte(proposalMaterializations.priceValidUntil, new Date())
      )
    )
    .orderBy(desc(proposalMaterializations.createdAt))
    .limit(1);
  
  if (cached) {
    // Increment hit count
    await db
      .update(proposalMaterializations)
      .set({ 
        hitCount: sql`${proposalMaterializations.hitCount} + 1`,
        lastAccessedAt: new Date()
      })
      .where(eq(proposalMaterializations.id, cached.id));
  }
  
  return cached || null;
}

export async function cacheProposal(
  data: Omit<InsertProposalMaterialization, "expiresAt" | "priceValidUntil" | "inputHash">,
  inputParams: Record<string, unknown>,
  ttlHours: number = CACHE_TTL.PROPOSAL,
  priceValidityHours: number = CACHE_TTL.PRICE_VALIDITY
): Promise<ProposalMaterialization> {
  const inputHash = generateHash(inputParams);
  
  const [result] = await db
    .insert(proposalMaterializations)
    .values({
      ...data,
      inputHash,
      expiresAt: getExpiry(ttlHours),
      priceValidUntil: getExpiry(priceValidityHours)
    })
    .returning();
  
  return result;
}

// =====================================================
// CACHE STATISTICS & MAINTENANCE
// =====================================================

export async function getCacheStats(): Promise<{
  marketData: { total: number; valid: number; stale: number };
  fundamentals: { total: number; valid: number };
  rationales: { total: number; valid: number; totalHits: number };
  portfolioMetrics: { total: number; today: number };
  proposals: { total: number; valid: number; totalHits: number };
}> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  
  const marketStats = (await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN expires_at > NOW() AND is_stale = false THEN 1 ELSE 0 END) as valid,
      SUM(CASE WHEN is_stale = true THEN 1 ELSE 0 END) as stale
    FROM market_data_snapshots
  `)).rows[0] as { total: string; valid: string; stale: string };
  
  const fundStats = (await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN expires_at > NOW() THEN 1 ELSE 0 END) as valid
    FROM product_fundamentals_cache
  `)).rows[0] as { total: string; valid: string };
  
  const rationaleStats = (await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN expires_at > NOW() AND is_invalidated = false THEN 1 ELSE 0 END) as valid,
      SUM(hit_count) as total_hits
    FROM ai_rationale_cache
  `)).rows[0] as { total: string; valid: string; total_hits: string };
  
  const portfolioStats = (await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN metrics_date = ${today} THEN 1 ELSE 0 END) as today
    FROM portfolio_metrics_daily
  `)).rows[0] as { total: string; today: string };
  
  const proposalStats = (await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN expires_at > NOW() THEN 1 ELSE 0 END) as valid,
      SUM(hit_count) as total_hits
    FROM proposal_materializations
  `)).rows[0] as { total: string; valid: string; total_hits: string };
  
  return {
    marketData: {
      total: Number(marketStats?.total || 0),
      valid: Number(marketStats?.valid || 0),
      stale: Number(marketStats?.stale || 0)
    },
    fundamentals: {
      total: Number(fundStats?.total || 0),
      valid: Number(fundStats?.valid || 0)
    },
    rationales: {
      total: Number(rationaleStats?.total || 0),
      valid: Number(rationaleStats?.valid || 0),
      totalHits: Number(rationaleStats?.total_hits || 0)
    },
    portfolioMetrics: {
      total: Number(portfolioStats?.total || 0),
      today: Number(portfolioStats?.today || 0)
    },
    proposals: {
      total: Number(proposalStats?.total || 0),
      valid: Number(proposalStats?.valid || 0),
      totalHits: Number(proposalStats?.total_hits || 0)
    }
  };
}

// =====================================================
// FINANCIAL METRICS CACHE (Advanced Quality Scores)
// =====================================================

export interface CachedFinancialMetrics {
  symbol: string;
  piotroskiFScore?: number;
  altmanZScore?: number;
  pegRatio?: number;
  evToEbitda?: number;
  roic?: number;
  earningsQuality?: number;
  debtToEquity?: number;
  currentRatio?: number;
  roe?: number;
  roce?: number;
  lastUpdated: Date;
}

export async function getCachedFinancialMetrics(
  symbol: string
): Promise<CachedFinancialMetrics | null> {
  const [cached] = await db
    .select()
    .from(stockFinancialMetrics)
    .where(eq(stockFinancialMetrics.symbol, symbol))
    .orderBy(desc(stockFinancialMetrics.lastUpdated))
    .limit(1);
  
  if (!cached) return null;
  
  return {
    symbol: cached.symbol,
    piotroskiFScore: cached.piotroskiFScore ?? undefined,
    altmanZScore: cached.altmanZScore ? parseFloat(cached.altmanZScore) : undefined,
    pegRatio: cached.pegRatio ? parseFloat(cached.pegRatio) : undefined,
    evToEbitda: cached.evToEbitda ? parseFloat(cached.evToEbitda) : undefined,
    roic: cached.roic ? parseFloat(cached.roic) : undefined,
    earningsQuality: cached.earningsQuality ? parseFloat(cached.earningsQuality) : undefined,
    debtToEquity: cached.debtToEquity ? parseFloat(cached.debtToEquity) : undefined,
    currentRatio: cached.currentRatio ? parseFloat(cached.currentRatio) : undefined,
    roe: cached.roe ? parseFloat(cached.roe) : undefined,
    roce: cached.roce ? parseFloat(cached.roce) : undefined,
    lastUpdated: cached.lastUpdated || new Date()
  };
}

export async function getCachedFinancialMetricsBatch(
  symbols: string[]
): Promise<Map<string, CachedFinancialMetrics>> {
  if (symbols.length === 0) return new Map();
  
  // Sanitize symbols to prevent SQL injection - only allow alphanumeric and periods
  const sanitizedSymbols = symbols
    .filter(s => s && typeof s === 'string')
    .map(s => s.replace(/[^a-zA-Z0-9.]/g, '').toUpperCase())
    .filter(s => s.length > 0);
  
  if (sanitizedSymbols.length === 0) return new Map();
  
  // Build OR conditions for each symbol using parameterized queries
  const conditions = sanitizedSymbols.map(s => eq(stockFinancialMetrics.symbol, s));
  
  const results = await db
    .select()
    .from(stockFinancialMetrics)
    .where(or(...conditions))
    .orderBy(desc(stockFinancialMetrics.lastUpdated));
  
  const map = new Map<string, CachedFinancialMetrics>();
  results.forEach(r => {
    if (!map.has(r.symbol)) {
      map.set(r.symbol, {
        symbol: r.symbol,
        piotroskiFScore: r.piotroskiFScore ?? undefined,
        altmanZScore: r.altmanZScore ? parseFloat(r.altmanZScore) : undefined,
        pegRatio: r.pegRatio ? parseFloat(r.pegRatio) : undefined,
        evToEbitda: r.evToEbitda ? parseFloat(r.evToEbitda) : undefined,
        roic: r.roic ? parseFloat(r.roic) : undefined,
        earningsQuality: r.earningsQuality ? parseFloat(r.earningsQuality) : undefined,
        debtToEquity: r.debtToEquity ? parseFloat(r.debtToEquity) : undefined,
        currentRatio: r.currentRatio ? parseFloat(r.currentRatio) : undefined,
        roe: r.roe ? parseFloat(r.roe) : undefined,
        roce: r.roce ? parseFloat(r.roce) : undefined,
        lastUpdated: r.lastUpdated || new Date()
      });
    }
  });
  
  return map;
}

export function calculateEnhancedQualityScore(metrics: CachedFinancialMetrics): number {
  let score = 50; // Base score
  
  // Piotroski F-Score (0-9): Higher is better
  if (metrics.piotroskiFScore !== undefined) {
    if (metrics.piotroskiFScore >= 8) score += 20;
    else if (metrics.piotroskiFScore >= 6) score += 12;
    else if (metrics.piotroskiFScore >= 4) score += 5;
    else score -= 10;
  }
  
  // Altman Z-Score: Financial distress indicator
  if (metrics.altmanZScore !== undefined) {
    if (metrics.altmanZScore > 2.99) score += 15; // Safe zone
    else if (metrics.altmanZScore >= 1.81) score += 5; // Grey zone
    else score -= 15; // Distress zone
  }
  
  // PEG Ratio: Growth at reasonable price
  if (metrics.pegRatio !== undefined && metrics.pegRatio > 0) {
    if (metrics.pegRatio < 1) score += 10;
    else if (metrics.pegRatio < 1.5) score += 5;
    else if (metrics.pegRatio > 2.5) score -= 5;
  }
  
  // ROIC: Return on Invested Capital
  if (metrics.roic !== undefined) {
    if (metrics.roic > 20) score += 10;
    else if (metrics.roic > 15) score += 5;
    else if (metrics.roic < 5) score -= 5;
  }
  
  // Earnings Quality: OCF/Net Income ratio
  if (metrics.earningsQuality !== undefined) {
    if (metrics.earningsQuality >= 1) score += 5; // High quality
    else if (metrics.earningsQuality < 0.5) score -= 5; // Low quality
  }
  
  return Math.min(100, Math.max(0, score));
}

export async function cleanupExpiredCache(): Promise<{
  marketDataDeleted: number;
  fundamentalsDeleted: number;
  rationalesDeleted: number;
  metricsDeleted: number;
  proposalsDeleted: number;
}> {
  const retentionDays = 30; // Keep expired entries for 30 days for debugging
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  
  const [md] = await db.delete(marketDataSnapshots).where(lte(marketDataSnapshots.expiresAt, cutoffDate)).returning();
  const [pf] = await db.delete(productFundamentalsCache).where(lte(productFundamentalsCache.expiresAt, cutoffDate)).returning();
  const [ar] = await db.delete(aiRationaleCache).where(lte(aiRationaleCache.expiresAt, cutoffDate)).returning();
  const [pm] = await db.delete(portfolioMetricsDaily).where(lte(portfolioMetricsDaily.metricsDate, cutoffDate.toISOString().split("T")[0])).returning();
  const [pp] = await db.delete(proposalMaterializations).where(lte(proposalMaterializations.expiresAt, cutoffDate)).returning();
  
  return {
    marketDataDeleted: Array.isArray(md) ? md.length : 0,
    fundamentalsDeleted: Array.isArray(pf) ? pf.length : 0,
    rationalesDeleted: Array.isArray(ar) ? ar.length : 0,
    metricsDeleted: Array.isArray(pm) ? pm.length : 0,
    proposalsDeleted: Array.isArray(pp) ? pp.length : 0
  };
}

// Export cache TTL for external use
export { CACHE_TTL, generateHash, getExpiry, isValid };
