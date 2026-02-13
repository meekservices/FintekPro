import { db } from "../db";
import { mutualFunds, listedStocks, corporateBonds, governmentSecurities } from "@shared/schema";
import { eq, and, desc, gte, lte, sql, inArray, ilike, or, isNotNull, isNull } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { financialMetricsCalculator } from "./financial-metrics-calculator";
import { getEnrichedStockSnapshot } from './screener/enriched-stock-data';

export type AssetClass = 'mutual_fund' | 'stock' | 'bond' | 'government_security' | 'reit' | 'commodity';

export interface FintekProRating {
  rating: number;
  stars: number;
  category: 'equity' | 'debt' | 'hybrid' | 'commodity' | 'alternative';
  percentile: number;
  evaluationDate: Date;
  riskAdjustedScore: number;
  qualityScore: number;
  assetQualityScore: number; // Backward compatibility alias for qualityScore
  liquidityScore: number;
  momentumScore: number;
  valuationScore: number;
  concentrationScore: number; // Backward compatibility
  overallScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  dataSource: 'database' | 'calculated' | 'ai_enhanced';
  advancedMetrics?: {
    piotroskiFScore?: number;
    altmanZScore?: number;
    earningsQualityRatio?: number;
    pegRatio?: number;
    evToEbitda?: number;
    roic?: number;
  };
}

export interface FintekProAnalysis {
  id: string;
  assetClass: AssetClass;
  name: string;
  symbol?: string;
  rating: FintekProRating;
  rationale: string;
  strengths: string[];
  concerns: string[];
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
  keyMetrics: Record<string, number | string>;
  peerComparison?: {
    rank: number;
    totalPeers: number;
    percentile: number;
  };
  aiInsights?: string;
}

export interface RatingParams {
  assetClass: AssetClass;
  id: string;
  includeAI?: boolean;
  includePeerComparison?: boolean;
}

export interface BulkRatingParams {
  assetClass: AssetClass;
  ids: string[];
  includeAI?: boolean;
  limit?: number;
}

const FUND_HOUSE_SCORES: Record<string, number> = {
  'sbi': 95, 'icici': 93, 'hdfc': 94, 'axis': 90, 'kotak': 89,
  'nippon': 87, 'aditya birla': 88, 'dsp': 85, 'tata': 86, 'uti': 84,
  'mirae': 83, 'franklin': 82, 'sundaram': 80, 'invesco': 79, 'edelweiss': 78
};

const SECTOR_RISK_WEIGHTS: Record<string, number> = {
  'banking': 0.85, 'it': 0.80, 'fmcg': 0.75, 'pharma': 0.82, 'auto': 0.88,
  'infrastructure': 0.90, 'realty': 0.95, 'metals': 0.92, 'energy': 0.87,
  'telecom': 0.83, 'chemicals': 0.86, 'consumer': 0.78, 'healthcare': 0.80
};

export class FintekProRatingService {
  private static instance: FintekProRatingService;
  private genAI: GoogleGenAI | null = null;
  private ratingCache = new Map<string, FintekProAnalysis>();
  private lastCacheUpdate = new Date();
  private readonly CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

  public static getInstance(): FintekProRatingService {
    if (!FintekProRatingService.instance) {
      FintekProRatingService.instance = new FintekProRatingService();
    }
    return FintekProRatingService.instance;
  }

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.AI_INTEGRATIONS_GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      console.log("🏆 FintekPro Smart Rating Service initialized with AI");
    } else {
      console.log("🏆 FintekPro Smart Rating Service initialized (rule-based mode)");
    }
  }

  async getRating(paramsOrSchemeCode: RatingParams | string): Promise<FintekProAnalysis | null> {
    // Backward compatibility: if string is passed, assume it's a mutual fund scheme code
    const params: RatingParams = typeof paramsOrSchemeCode === 'string' 
      ? { assetClass: 'mutual_fund', id: paramsOrSchemeCode }
      : paramsOrSchemeCode;

    const cacheKey = `${params.assetClass}:${params.id}`;
    
    if (this.ratingCache.has(cacheKey) && this.isCacheValid()) {
      return this.ratingCache.get(cacheKey)!;
    }

    try {
      let analysis: FintekProAnalysis | null = null;

      switch (params.assetClass) {
        case 'mutual_fund':
          analysis = await this.rateMutualFund(params.id, params.includeAI);
          break;
        case 'stock':
          analysis = await this.rateStock(params.id, params.includeAI);
          break;
        case 'bond':
          analysis = await this.rateCorporateBond(params.id, params.includeAI);
          break;
        case 'government_security':
          analysis = await this.rateGovernmentSecurity(params.id, params.includeAI);
          break;
        default:
          console.warn(`Asset class ${params.assetClass} not yet supported`);
          return null;
      }

      if (analysis) {
        this.ratingCache.set(cacheKey, analysis);
      }

      return analysis;
    } catch (error) {
      console.error(`❌ Error calculating FintekPro rating for ${params.id}:`, error);
      return null;
    }
  }

  async getBulkRatings(params: BulkRatingParams): Promise<FintekProAnalysis[]> {
    const ratings: FintekProAnalysis[] = [];
    const limit = params.limit || 50;
    const idsToProcess = params.ids.slice(0, limit);

    for (const id of idsToProcess) {
      try {
        const rating = await this.getRating({
          assetClass: params.assetClass,
          id,
          includeAI: params.includeAI
        });
        if (rating) {
          ratings.push(rating);
        }
      } catch (error) {
        console.warn(`Failed to get FintekPro rating for ${id}:`, error);
      }
    }

    return ratings.sort((a, b) => b.rating.overallScore - a.rating.overallScore);
  }

  async persistRating(schemeCode: string, analysis: FintekProAnalysis): Promise<boolean> {
    try {
      const r = analysis.rating;
      await db.update(mutualFunds)
        .set({
          crisilRating: r.stars,
          crisilCategory: r.category,
          crisilPercentile: r.percentile.toFixed(2),
          crisilEvaluationDate: r.evaluationDate,
          crisilRiskAdjustedScore: r.riskAdjustedScore.toFixed(4),
          crisilAssetQualityScore: r.qualityScore.toFixed(4),
          crisilLiquidityScore: r.liquidityScore.toFixed(4),
          crisilConcentrationScore: (r.concentrationScore || 80).toFixed(4),
          crisilOverallScore: r.overallScore.toFixed(4),
          crisilDataSource: 'calculated',
          crisilLastUpdated: new Date(),
        })
        .where(eq(mutualFunds.schemeCode, schemeCode));
      return true;
    } catch (error: any) {
      console.warn(`[FintekProRating] Failed to persist rating for ${schemeCode}: ${error.message}`);
      return false;
    }
  }

  async computeAndPersistRating(schemeCode: string): Promise<FintekProAnalysis | null> {
    const analysis = await this.rateMutualFund(schemeCode, false);
    if (analysis) {
      await this.persistRating(schemeCode, analysis);
    }
    return analysis;
  }

  async batchComputeAndPersist(options: {
    onlyNullRatings?: boolean;
    batchSize?: number;
    maxFunds?: number;
    onProgress?: (processed: number, total: number, schemeCode: string) => void;
  } = {}): Promise<{ processed: number; persisted: number; failed: number; errors: string[] }> {
    const { onlyNullRatings = true, batchSize = 100, maxFunds = 50000 } = options;
    const result = { processed: 0, persisted: 0, failed: 0, errors: [] as string[] };

    const conditions: any[] = [];
    if (onlyNullRatings) {
      conditions.push(isNull(mutualFunds.crisilRating));
    }

    const funds = await db.select({
      schemeCode: mutualFunds.schemeCode,
    })
      .from(mutualFunds)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(maxFunds);

    console.log(`[FintekProRating] Batch rating: ${funds.length} funds to process`);

    for (let i = 0; i < funds.length; i += batchSize) {
      const batch = funds.slice(i, i + batchSize);
      for (const fund of batch) {
        try {
          const analysis = await this.rateMutualFund(fund.schemeCode, false);
          if (analysis) {
            const saved = await this.persistRating(fund.schemeCode, analysis);
            if (saved) {
              result.persisted++;
            } else {
              result.failed++;
            }
          } else {
            result.failed++;
          }
          result.processed++;
          if (options.onProgress) {
            options.onProgress(result.processed, funds.length, fund.schemeCode);
          }
        } catch (error: any) {
          result.failed++;
          result.processed++;
          if (result.errors.length < 50) {
            result.errors.push(`${fund.schemeCode}: ${error.message}`);
          }
        }
      }
    }

    console.log(`[FintekProRating] Batch complete: ${result.persisted} persisted, ${result.failed} failed out of ${result.processed}`);
    return result;
  }

  async getTopRated(assetClass: AssetClass, limit: number = 10): Promise<FintekProAnalysis[]> {
    try {
      switch (assetClass) {
        case 'mutual_fund':
          return this.getTopRatedMutualFunds(limit);
        case 'stock':
          return this.getTopRatedStocks(limit);
        case 'bond':
          return this.getTopRatedBonds(limit);
        default:
          return [];
      }
    } catch (error) {
      console.error(`Error fetching top rated ${assetClass}:`, error);
      return [];
    }
  }

  private async rateMutualFund(schemeCode: string, includeAI?: boolean): Promise<FintekProAnalysis | null> {
    const funds = await db
      .select()
      .from(mutualFunds)
      .where(eq(mutualFunds.schemeCode, schemeCode))
      .limit(1);

    if (funds.length === 0) return null;
    const fund = funds[0];

    const returns1y = parseFloat(fund.returns1y?.toString() || '0');
    const returns3y = parseFloat(fund.returns3y?.toString() || '0');
    const returns5y = parseFloat(fund.returns5y?.toString() || '0');
    const expenseRatio = parseFloat(fund.expenseRatio?.toString() || '1.5');
    const aum = parseFloat(fund.aum?.toString() || '1000');
    const nav = parseFloat(fund.nav?.toString() || '100');

    const riskAdjustedScore = this.calculateMFRiskAdjustedScore(returns1y, returns3y, returns5y, expenseRatio);
    const qualityScore = this.calculateMFQualityScore(fund.fundHouse || '', aum, fund.crisilRating);
    const liquidityScore = this.calculateMFLiquidityScore(aum, fund.category || '');
    const momentumScore = this.calculateMomentumScore(returns1y, returns3y);
    const valuationScore = this.calculateMFValuationScore(expenseRatio, fund.category || '');

    const overallScore = (
      riskAdjustedScore * 0.35 +
      qualityScore * 0.25 +
      liquidityScore * 0.15 +
      momentumScore * 0.15 +
      valuationScore * 0.10
    );

    const stars = this.scoreToStars(overallScore);
    const category = this.determineMFCategory(fund.category || '');
    const percentile = this.scoreToPercentile(overallScore);

    const rating: FintekProRating = {
      rating: stars,
      stars,
      category,
      percentile,
      evaluationDate: new Date(),
      riskAdjustedScore,
      qualityScore,
      assetQualityScore: qualityScore, // Backward compatibility
      concentrationScore: 80, // Default concentration score for backward compatibility
      liquidityScore,
      momentumScore,
      valuationScore,
      overallScore,
      confidenceLevel: aum > 5000 ? 'high' : aum > 1000 ? 'medium' : 'low',
      dataSource: includeAI && this.genAI ? 'ai_enhanced' : 'database'
    };

    const keyMetrics = {
      returns1Y: `${returns1y.toFixed(2)}%`,
      returns3Y: `${returns3y.toFixed(2)}%`,
      returns5Y: `${returns5y.toFixed(2)}%`,
      expenseRatio: `${expenseRatio.toFixed(2)}%`,
      aum: `₹${(aum).toFixed(0)} Cr`,
      nav: `₹${nav.toFixed(2)}`,
      fintekproRating: fund.crisilRating ? `${fund.crisilRating}-Star` : 'Not Rated'
    };

    const strengths = this.generateMFStrengths(fund, overallScore, returns1y, returns3y, aum, expenseRatio);
    const concerns = this.generateMFConcerns(fund, overallScore, returns1y, aum, expenseRatio);
    const recommendation = this.generateRecommendation(stars, overallScore);
    const rationale = this.generateMFRationale(fund, rating, keyMetrics);

    let aiInsights: string | undefined;
    if (includeAI && this.genAI) {
      aiInsights = await this.generateAIInsights('mutual_fund', fund.schemeName || '', keyMetrics, rating);
    }

    return {
      id: schemeCode,
      assetClass: 'mutual_fund',
      name: fund.schemeName || 'Unknown Fund',
      symbol: fund.schemeCode,
      rating,
      rationale,
      strengths,
      concerns,
      recommendation,
      keyMetrics,
      aiInsights
    };
  }

  private async rateStock(stockId: string, includeAI?: boolean): Promise<FintekProAnalysis | null> {
    const stocks = await db
      .select()
      .from(listedStocks)
      .where(or(eq(listedStocks.id, stockId), eq(listedStocks.symbol, stockId)))
      .limit(1);

    if (stocks.length === 0) return null;
    const stock = stocks[0];

    const enriched = await getEnrichedStockSnapshot(stock.symbol || stockId);

    const currentPrice = parseFloat(stock.currentPrice?.toString() || '0');
    const peRatio = enriched?.fundamentals?.peRatio ?? parseFloat(stock.peRatio?.toString() || '25');
    const pbRatio = enriched?.fundamentals?.pbRatio ?? parseFloat(stock.pbRatio?.toString() || '3');
    const roe = enriched?.fundamentals?.roe ?? parseFloat(stock.roe?.toString() || '15');
    const marketCap = enriched?.fundamentals?.marketCap ?? parseFloat(stock.marketCap?.toString() || '10000');
    const returns1y = parseFloat(stock.returns1y?.toString() || '0');
    const returns3y = parseFloat(stock.returns3y?.toString() || '0');
    const beta = parseFloat(stock.beta?.toString() || '1');
    const debtToEquity = enriched?.fundamentals?.debtToEquity ?? parseFloat(stock.debtToEquity?.toString() || '1');
    const enrichedRoic = enriched?.fundamentals?.roic ?? null;
    const enrichedEvToEbitda = enriched?.fundamentals?.evToEbitda ?? null;
    const enrichedInterestCoverage = enriched?.fundamentals?.interestCoverage ?? null;
    const enrichedDividendYield = enriched?.fundamentals?.dividendYield ?? null;

    const hasEnrichedData = !!enriched;

    const riskAdjustedScore = this.calculateStockRiskAdjustedScore(returns1y, returns3y, beta);
    let qualityScore = this.calculateStockQualityScore(roe, debtToEquity.toString(), stock.sector || '');
    const liquidityScore = this.calculateStockLiquidityScore(marketCap, stock.avgVolume?.toString());
    let momentumScore = this.calculateMomentumScore(returns1y, returns3y);
    let valuationScore = this.calculateStockValuationScore(peRatio, pbRatio, stock.sector || '');
    
    const advancedMetrics = this.calculateAdvancedMetricsForStock(stock);

    if (enrichedRoic != null) {
      advancedMetrics.roic = enrichedRoic;
    }
    if (enrichedEvToEbitda != null) {
      advancedMetrics.evToEbitda = enrichedEvToEbitda;
    }
    if (enriched?.growth?.epsGrowth != null && enriched.growth.epsGrowth > 0 && peRatio > 0) {
      const epsGrowthPct = enriched.growth.epsGrowth > 1 ? enriched.growth.epsGrowth / 100 : enriched.growth.epsGrowth;
      if (epsGrowthPct > 0) {
        advancedMetrics.pegRatio = peRatio / (epsGrowthPct * 100);
      }
    }

    if (advancedMetrics.piotroskiFScore !== undefined) {
      if (advancedMetrics.piotroskiFScore >= 8) qualityScore += 15;
      else if (advancedMetrics.piotroskiFScore >= 6) qualityScore += 8;
      else if (advancedMetrics.piotroskiFScore < 4) qualityScore -= 10;
    }
    
    if (advancedMetrics.altmanZScore !== undefined) {
      if (advancedMetrics.altmanZScore > 2.99) qualityScore += 10;
      else if (advancedMetrics.altmanZScore < 1.81) qualityScore -= 15;
    }
    
    if (advancedMetrics.pegRatio !== undefined && advancedMetrics.pegRatio < 1.5) {
      valuationScore += 10;
    }
    
    if (advancedMetrics.roic !== undefined && advancedMetrics.roic > 15) {
      qualityScore += 10;
    }

    if (enriched?.companyRating?.ratingScore != null) {
      const fmpScore = enriched.companyRating.ratingScore;
      if (fmpScore >= 4) qualityScore += 12;
      else if (fmpScore >= 3) qualityScore += 6;
      else if (fmpScore <= 1) qualityScore -= 8;
    }

    if (enrichedInterestCoverage != null) {
      if (enrichedInterestCoverage > 5) qualityScore += 5;
      else if (enrichedInterestCoverage < 1.5) qualityScore -= 8;
    }

    if (enriched?.growth) {
      const g = enriched.growth;
      let growthBoost = 0;
      if (g.revenueGrowth != null && g.revenueGrowth > 10) growthBoost += 5;
      if (g.epsGrowth != null && g.epsGrowth > 15) growthBoost += 5;
      if (g.freeCashFlowGrowth != null && g.freeCashFlowGrowth > 10) growthBoost += 5;
      if (g.revenueGrowth != null && g.revenueGrowth < -10) growthBoost -= 5;
      if (g.epsGrowth != null && g.epsGrowth < -15) growthBoost -= 5;
      momentumScore += growthBoost;
    }

    if (enriched?.dcf?.upsidePercent != null) {
      const upside = enriched.dcf.upsidePercent;
      if (upside > 30) valuationScore += 15;
      else if (upside > 15) valuationScore += 10;
      else if (upside > 0) valuationScore += 5;
      else if (upside < -20) valuationScore -= 10;
    }

    if (enriched?.technicals?.rsi != null) {
      const rsi = enriched.technicals.rsi;
      if (rsi >= 30 && rsi <= 50) momentumScore += 8;
      else if (rsi > 50 && rsi <= 70) momentumScore += 0;
      else if (rsi > 70) momentumScore -= 8;
      else if (rsi < 30) momentumScore += 4;
    }
    
    qualityScore = Math.min(100, Math.max(0, qualityScore));
    valuationScore = Math.min(100, Math.max(0, valuationScore));
    momentumScore = Math.min(100, Math.max(0, momentumScore));

    const overallScore = (
      riskAdjustedScore * 0.30 +
      qualityScore * 0.25 +
      liquidityScore * 0.15 +
      momentumScore * 0.15 +
      valuationScore * 0.15
    );

    const stars = this.scoreToStars(overallScore);
    const percentile = this.scoreToPercentile(overallScore);

    const dataSource: 'database' | 'calculated' | 'ai_enhanced' = 
      includeAI && this.genAI ? 'ai_enhanced' : hasEnrichedData ? 'database' : 'calculated';

    const rating: FintekProRating = {
      rating: stars,
      stars,
      category: 'equity',
      percentile,
      evaluationDate: new Date(),
      riskAdjustedScore,
      qualityScore,
      assetQualityScore: qualityScore,
      concentrationScore: 80,
      liquidityScore,
      momentumScore,
      valuationScore,
      overallScore,
      confidenceLevel: marketCap > 50000 ? 'high' : marketCap > 10000 ? 'medium' : 'low',
      dataSource,
      advancedMetrics
    };

    const keyMetrics: Record<string, number | string> = {
      currentPrice: `₹${currentPrice.toFixed(2)}`,
      peRatio: peRatio.toFixed(2),
      pbRatio: pbRatio.toFixed(2),
      roe: `${roe.toFixed(2)}%`,
      marketCap: `₹${(marketCap / 100).toFixed(0)} Cr`,
      returns1Y: `${returns1y.toFixed(2)}%`,
      beta: beta.toFixed(2),
      sector: stock.sector || 'N/A'
    };

    if (enrichedRoic != null) keyMetrics.roic = `${enrichedRoic.toFixed(2)}%`;
    if (enriched?.growth?.epsGrowth != null) keyMetrics.epsGrowth = `${enriched.growth.epsGrowth.toFixed(2)}%`;
    if (enriched?.dcf?.upsidePercent != null) keyMetrics.dcfUpside = `${enriched.dcf.upsidePercent.toFixed(1)}%`;
    if (enriched?.companyRating?.ratingScore != null) keyMetrics.fmpRating = enriched.companyRating.ratingScore;
    if (enriched?.fundamentals?.grahamNumber != null) keyMetrics.grahamNumber = `₹${enriched.fundamentals.grahamNumber.toFixed(2)}`;
    if (enrichedEvToEbitda != null) keyMetrics.evToEbitda = enrichedEvToEbitda.toFixed(2);
    if (enriched?.technicals?.rsi != null) keyMetrics.rsi = enriched.technicals.rsi.toFixed(1);

    const strengths = this.generateStockStrengths(stock, overallScore, returns1y, roe, peRatio);
    const concerns = this.generateStockConcerns(stock, overallScore, returns1y, peRatio, beta);
    const recommendation = this.generateRecommendation(stars, overallScore);

    let rationale = this.generateStockRationale(stock, rating, keyMetrics);
    if (enriched?.dcf?.upsidePercent != null) {
      rationale += ` DCF analysis suggests ${enriched.dcf.upsidePercent > 0 ? 'an upside' : 'a downside'} of ${enriched.dcf.upsidePercent.toFixed(1)}%.`;
    }
    if (enrichedRoic != null && enrichedRoic > 15) {
      rationale += ` ROIC of ${enrichedRoic.toFixed(1)}% indicates strong capital efficiency.`;
    }
    if (enriched?.analystTargets && enriched.analystTargets.count > 0 && enriched.analystTargets.avgPriceTarget != null) {
      rationale += ` Analyst consensus target: ₹${enriched.analystTargets.avgPriceTarget.toFixed(0)} (${enriched.analystTargets.count} analysts).`;
    }

    let aiInsights: string | undefined;
    if (includeAI && this.genAI) {
      aiInsights = await this.generateAIInsights('stock', stock.companyName || stock.symbol || '', keyMetrics, rating);
    }

    return {
      id: stockId,
      assetClass: 'stock',
      name: stock.companyName || stock.symbol || 'Unknown Stock',
      symbol: stock.symbol || undefined,
      rating,
      rationale,
      strengths,
      concerns,
      recommendation,
      keyMetrics,
      aiInsights
    };
  }

  private async rateCorporateBond(bondId: string, includeAI?: boolean): Promise<FintekProAnalysis | null> {
    const bonds = await db
      .select()
      .from(corporateBonds)
      .where(or(eq(corporateBonds.id, bondId), eq(corporateBonds.isin, bondId)))
      .limit(1);

    if (bonds.length === 0) return null;
    const bond = bonds[0];

    const yieldToMaturity = parseFloat(bond.yieldToMaturity?.toString() || '8');
    const couponRate = parseFloat(bond.couponRate?.toString() || '7');
    const faceValue = parseFloat(bond.faceValue?.toString() || '1000');
    const currentPrice = parseFloat(bond.currentPrice?.toString() || '1000');

    const creditScore = this.getCreditRatingScore(bond.creditRating || 'BBB');
    const yieldScore = Math.min(100, 50 + yieldToMaturity * 5);
    const liquidityScore = bond.tradingStatus === 'active' ? 80 : 50;
    const issuerScore = this.getIssuerScore(bond.issuerName || '');
    const durationScore = this.getDurationScore(bond.maturityDate?.toString() || '');

    const overallScore = (
      creditScore * 0.35 +
      yieldScore * 0.25 +
      liquidityScore * 0.15 +
      issuerScore * 0.15 +
      durationScore * 0.10
    );

    const stars = this.scoreToStars(overallScore);
    const percentile = this.scoreToPercentile(overallScore);

    const rating: FintekProRating = {
      rating: stars,
      stars,
      category: 'debt',
      percentile,
      evaluationDate: new Date(),
      riskAdjustedScore: creditScore,
      qualityScore: issuerScore,
      assetQualityScore: issuerScore,
      liquidityScore,
      momentumScore: yieldScore,
      valuationScore: durationScore,
      concentrationScore: 80,
      overallScore,
      confidenceLevel: bond.creditRating?.startsWith('AA') ? 'high' : 'medium',
      dataSource: includeAI && this.genAI ? 'ai_enhanced' : 'database'
    };

    const keyMetrics = {
      yieldToMaturity: `${yieldToMaturity.toFixed(2)}%`,
      couponRate: `${couponRate.toFixed(2)}%`,
      creditRating: bond.creditRating || 'N/A',
      issuer: bond.issuerName || 'N/A',
      maturityDate: bond.maturityDate?.toString() || 'N/A',
      faceValue: `₹${faceValue.toFixed(0)}`,
      currentPrice: `₹${currentPrice.toFixed(2)}`
    };

    const strengths = this.generateBondStrengths(bond, overallScore, yieldToMaturity, creditScore);
    const concerns = this.generateBondConcerns(bond, overallScore, yieldToMaturity);
    const recommendation = this.generateRecommendation(stars, overallScore);
    const rationale = `This ${bond.creditRating || 'rated'} corporate bond from ${bond.issuerName || 'the issuer'} offers ${yieldToMaturity.toFixed(2)}% yield with a ${stars}-star FintekPro rating based on credit quality, yield attractiveness, and liquidity.`;

    return {
      id: bondId,
      assetClass: 'bond',
      name: bond.bondName || 'Unknown Bond',
      symbol: bond.isin || undefined,
      rating,
      rationale,
      strengths,
      concerns,
      recommendation,
      keyMetrics
    };
  }

  private async rateGovernmentSecurity(securityId: string, includeAI?: boolean): Promise<FintekProAnalysis | null> {
    const securities = await db
      .select()
      .from(governmentSecurities)
      .where(or(eq(governmentSecurities.id, securityId), eq(governmentSecurities.isin, securityId)))
      .limit(1);

    if (securities.length === 0) return null;
    const security = securities[0];

    const yieldToMaturity = parseFloat(security.yieldToMaturity?.toString() || '7');
    const couponRate = parseFloat(security.couponRate?.toString() || '6');

    const safetyScore = 100;
    const yieldScore = Math.min(100, 50 + yieldToMaturity * 6);
    const liquidityScore = security.tradingStatus === 'active' ? 95 : 70;
    const durationScore = this.getDurationScore(security.maturityDate?.toString() || '');

    const overallScore = (
      safetyScore * 0.30 +
      yieldScore * 0.30 +
      liquidityScore * 0.25 +
      durationScore * 0.15
    );

    const stars = this.scoreToStars(overallScore);

    const rating: FintekProRating = {
      rating: stars,
      stars,
      category: 'debt',
      percentile: this.scoreToPercentile(overallScore),
      evaluationDate: new Date(),
      riskAdjustedScore: safetyScore,
      qualityScore: safetyScore,
      assetQualityScore: safetyScore,
      liquidityScore,
      momentumScore: yieldScore,
      valuationScore: durationScore,
      concentrationScore: 90,
      overallScore,
      confidenceLevel: 'high',
      dataSource: 'database'
    };

    return {
      id: securityId,
      assetClass: 'government_security',
      name: security.securityName || 'Government Security',
      symbol: security.isin || undefined,
      rating,
      rationale: `This ${security.securityType || 'government'} security offers ${yieldToMaturity.toFixed(2)}% yield with sovereign guarantee, rated ${stars} stars for safety and yield attractiveness.`,
      strengths: ['Sovereign guarantee - zero credit risk', 'High liquidity in secondary market', `Attractive yield of ${yieldToMaturity.toFixed(2)}%`],
      concerns: ['Interest rate risk if rates rise', 'Lower yields compared to corporate bonds'],
      recommendation: this.generateRecommendation(stars, overallScore),
      keyMetrics: {
        yieldToMaturity: `${yieldToMaturity.toFixed(2)}%`,
        couponRate: `${couponRate.toFixed(2)}%`,
        securityType: security.securityType || 'G-Sec',
        maturityDate: security.maturityDate?.toString() || 'N/A'
      }
    };
  }

  private async getTopRatedMutualFunds(limit: number): Promise<FintekProAnalysis[]> {
    const funds = await db
      .select()
      .from(mutualFunds)
      .where(and(
        eq(mutualFunds.isPublished, true),
        isNotNull(mutualFunds.returns3y)
      ))
      .orderBy(desc(mutualFunds.crisilPercentile))
      .limit(limit * 2);

    const ratings: FintekProAnalysis[] = [];
    for (const fund of funds.slice(0, limit)) {
      const rating = await this.rateMutualFund(fund.schemeCode, false);
      if (rating) ratings.push(rating);
    }

    return ratings.sort((a, b) => b.rating.overallScore - a.rating.overallScore).slice(0, limit);
  }

  private async getTopRatedStocks(limit: number): Promise<FintekProAnalysis[]> {
    const stocks = await db
      .select()
      .from(listedStocks)
      .where(and(
        eq(listedStocks.isPublished, true),
        isNotNull(listedStocks.returns1y)
      ))
      .orderBy(desc(listedStocks.marketCap))
      .limit(limit * 2);

    const ratings: FintekProAnalysis[] = [];
    for (const stock of stocks.slice(0, limit)) {
      const rating = await this.rateStock(stock.id, false);
      if (rating) ratings.push(rating);
    }

    return ratings.sort((a, b) => b.rating.overallScore - a.rating.overallScore).slice(0, limit);
  }

  private async getTopRatedBonds(limit: number): Promise<FintekProAnalysis[]> {
    const bonds = await db
      .select()
      .from(corporateBonds)
      .where(eq(corporateBonds.tradingStatus, 'active'))
      .orderBy(desc(corporateBonds.yieldToMaturity))
      .limit(limit * 2);

    const ratings: FintekProAnalysis[] = [];
    for (const bond of bonds.slice(0, limit)) {
      const rating = await this.rateCorporateBond(bond.id, false);
      if (rating) ratings.push(rating);
    }

    return ratings.sort((a, b) => b.rating.overallScore - a.rating.overallScore).slice(0, limit);
  }

  private async generateAIInsights(
    assetClass: string,
    name: string,
    metrics: Record<string, number | string>,
    rating: FintekProRating
  ): Promise<string | undefined> {
    if (!this.genAI) return undefined;

    try {
      const prompt = `You are a SEBI-compliant investment analyst. Provide a brief 2-3 sentence insight for this ${assetClass}:

Name: ${name}
Key Metrics: ${JSON.stringify(metrics)}
FintekPro Rating: ${rating.stars}/5 stars (${rating.overallScore.toFixed(1)} overall score)
Category: ${rating.category}

Focus on: investment suitability, key risks, and potential. Be factual and balanced.`;

      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      return result.text?.trim();
    } catch (error) {
      console.warn('Failed to generate AI insights:', error);
      return undefined;
    }
  }

  private calculateMFRiskAdjustedScore(returns1y: number, returns3y: number, returns5y: number, expenseRatio: number): number {
    const avgReturn = (returns1y * 0.4 + returns3y * 0.35 + returns5y * 0.25);
    const netReturn = avgReturn - expenseRatio;
    const riskFreeRate = 6.5;
    const excessReturn = netReturn - riskFreeRate;
    return Math.min(100, Math.max(20, 50 + excessReturn * 3));
  }

  private calculateMFQualityScore(fundHouse: string, aum: number, existingRating?: number | null): number {
    let score = 60;
    const fundHouseLower = fundHouse.toLowerCase();
    for (const [name, bonus] of Object.entries(FUND_HOUSE_SCORES)) {
      if (fundHouseLower.includes(name)) {
        score = Math.max(score, bonus);
        break;
      }
    }
    if (aum > 30000) score = Math.min(100, score + 5);
    else if (aum > 10000) score = Math.min(100, score + 3);
    if (existingRating && existingRating <= 2) score = Math.min(100, score + 5);
    return score;
  }

  private calculateMFLiquidityScore(aum: number, category: string): number {
    let score = 70;
    if (aum > 25000) score += 20;
    else if (aum > 10000) score += 15;
    else if (aum > 5000) score += 10;
    if (category.toLowerCase().includes('large cap')) score += 5;
    return Math.min(100, score);
  }

  private calculateMomentumScore(returns1y: number, returns3y: number): number {
    const momentum = returns1y * 0.6 + returns3y * 0.4;
    return Math.min(100, Math.max(20, 50 + momentum * 2));
  }

  private calculateMFValuationScore(expenseRatio: number, category: string): number {
    let score = 80;
    if (expenseRatio < 0.5) score += 15;
    else if (expenseRatio < 1.0) score += 10;
    else if (expenseRatio < 1.5) score += 5;
    else if (expenseRatio > 2.0) score -= 15;
    return Math.min(100, Math.max(30, score));
  }

  private calculateStockRiskAdjustedScore(returns1y: number, returns3y: number, beta: number): number {
    const avgReturn = returns1y * 0.5 + returns3y * 0.5;
    const riskAdjusted = avgReturn / Math.max(0.5, beta);
    return Math.min(100, Math.max(20, 50 + riskAdjusted * 2));
  }

  private calculateAdvancedMetricsForStock(stock: any): {
    piotroskiFScore?: number;
    altmanZScore?: number;
    earningsQualityRatio?: number;
    pegRatio?: number;
    evToEbitda?: number;
    roic?: number;
  } {
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
      
      if (netIncome && totalAssets && operatingCashFlow) {
        metrics.piotroskiFScore = financialMetricsCalculator.calculatePiotroskiFScore(
          netIncome, totalAssets, operatingCashFlow, longTermDebt, currentRatio,
          sharesOutstanding, grossMargin, assetTurnover,
          netIncome * 0.9, totalAssets, longTermDebt, currentRatio,
          grossMargin, assetTurnover, sharesOutstanding
        );
      }
      
      const workingCapital = parseFloat(stock.workingCapital || totalAssets * 0.2);
      const retainedEarnings = parseFloat(stock.retainedEarnings || netIncome * 3);
      const ebit = parseFloat(stock.ebit || netIncome * 1.3);
      const marketCap = parseFloat(stock.marketCap || 0);
      const totalLiabilities = parseFloat(stock.totalLiabilities || totalAssets * 0.4);
      
      if (totalAssets && totalLiabilities && revenue) {
        metrics.altmanZScore = financialMetricsCalculator.calculateAltmanZScore(
          workingCapital, retainedEarnings, ebit, marketCap,
          totalLiabilities, revenue, totalAssets
        );
      }
      
      if (operatingCashFlow && netIncome) {
        metrics.earningsQualityRatio = financialMetricsCalculator.calculateEarningsQualityRatio(
          operatingCashFlow, netIncome
        );
      }
      
      const peRatio = parseFloat(stock.peRatio || 0);
      const epsGrowth = parseFloat(stock.epsGrowth || 15);
      if (peRatio && epsGrowth && epsGrowth > 0) {
        const epsGrowthDecimal = epsGrowth > 1 ? epsGrowth / 100 : epsGrowth;
        metrics.pegRatio = financialMetricsCalculator.calculatePEGRatio(peRatio, epsGrowthDecimal);
      }
      
      const ebitda = parseFloat(stock.ebitda || ebit * 1.15);
      const enterpriseValue = parseFloat(stock.enterpriseValue || marketCap * 1.1);
      if (enterpriseValue && ebitda && ebitda > 0) {
        metrics.evToEbitda = financialMetricsCalculator.calculateEVtoEBITDA(enterpriseValue, ebitda);
      }
      
      const investedCapital = parseFloat(stock.investedCapital || totalAssets * 0.7);
      const taxRate = 0.25;
      if (ebit && investedCapital && investedCapital > 0) {
        const nopat = ebit * (1 - taxRate);
        metrics.roic = financialMetricsCalculator.calculateROIC(nopat, investedCapital);
      }
    } catch (error) {
      console.warn('[FintekProRating] Error calculating advanced metrics:', error);
    }
    
    return metrics;
  }

  private calculateStockQualityScore(roe: number, debtToEquity?: string, sector?: string): number {
    let score = 60;
    if (roe > 20) score += 25;
    else if (roe > 15) score += 15;
    else if (roe > 10) score += 5;
    const de = parseFloat(debtToEquity || '1');
    if (de < 0.5) score += 10;
    else if (de > 2) score -= 10;
    return Math.min(100, Math.max(30, score));
  }

  private calculateStockLiquidityScore(marketCap: number, avgVolume?: string): number {
    let score = 60;
    if (marketCap > 100000) score += 30;
    else if (marketCap > 50000) score += 25;
    else if (marketCap > 10000) score += 15;
    return Math.min(100, score);
  }

  private calculateStockValuationScore(peRatio: number, pbRatio: number, sector: string): number {
    let score = 70;
    if (peRatio < 15) score += 15;
    else if (peRatio < 25) score += 5;
    else if (peRatio > 40) score -= 15;
    if (pbRatio < 2) score += 10;
    else if (pbRatio > 5) score -= 10;
    return Math.min(100, Math.max(30, score));
  }

  private getCreditRatingScore(rating: string): number {
    const scores: Record<string, number> = {
      'AAA': 100, 'AA+': 95, 'AA': 90, 'AA-': 85,
      'A+': 80, 'A': 75, 'A-': 70,
      'BBB+': 65, 'BBB': 60, 'BBB-': 55,
      'BB+': 50, 'BB': 45, 'BB-': 40,
      'B+': 35, 'B': 30, 'B-': 25, 'C': 15, 'D': 5
    };
    return scores[rating.toUpperCase()] || 60;
  }

  private getIssuerScore(issuerName: string): number {
    const name = issuerName.toLowerCase();
    if (name.includes('hdfc') || name.includes('icici') || name.includes('sbi') || name.includes('lic')) return 95;
    if (name.includes('tata') || name.includes('reliance') || name.includes('infosys')) return 90;
    if (name.includes('bajaj') || name.includes('kotak') || name.includes('axis')) return 85;
    return 70;
  }

  private getDurationScore(maturityDate: string): number {
    if (!maturityDate) return 70;
    const years = (new Date(maturityDate).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000);
    if (years < 2) return 85;
    if (years < 5) return 80;
    if (years < 10) return 70;
    return 60;
  }

  private scoreToStars(score: number): number {
    if (score >= 85) return 5;
    if (score >= 70) return 4;
    if (score >= 55) return 3;
    if (score >= 40) return 2;
    return 1;
  }

  private scoreToPercentile(score: number): number {
    return Math.min(99, Math.max(1, score));
  }

  private determineMFCategory(category: string): 'equity' | 'debt' | 'hybrid' | 'commodity' | 'alternative' {
    const cat = category.toLowerCase();
    if (cat.includes('debt') || cat.includes('bond') || cat.includes('gilt') || cat.includes('liquid')) return 'debt';
    if (cat.includes('hybrid') || cat.includes('balanced')) return 'hybrid';
    if (cat.includes('gold') || cat.includes('silver') || cat.includes('commodity')) return 'commodity';
    if (cat.includes('reit') || cat.includes('invit') || cat.includes('fof')) return 'alternative';
    return 'equity';
  }

  private generateMFStrengths(fund: any, score: number, returns1y: number, returns3y: number, aum: number, expenseRatio: number): string[] {
    const strengths: string[] = [];
    if (returns3y > 12) strengths.push(`Strong 3-year returns of ${returns3y.toFixed(1)}%`);
    if (returns1y > 15) strengths.push(`Excellent 1-year performance of ${returns1y.toFixed(1)}%`);
    if (aum > 20000) strengths.push('Large AUM indicates investor confidence');
    if (expenseRatio < 1.0) strengths.push(`Low expense ratio of ${expenseRatio.toFixed(2)}%`);
    if (fund.crisilRating && fund.crisilRating <= 2) strengths.push('Top-tier FintekPro Smart Rating');
    if (score > 80) strengths.push('Strong risk-adjusted performance');
    return strengths.length > 0 ? strengths : ['Established fund with consistent track record'];
  }

  private generateMFConcerns(fund: any, score: number, returns1y: number, aum: number, expenseRatio: number): string[] {
    const concerns: string[] = [];
    if (expenseRatio > 2.0) concerns.push(`High expense ratio of ${expenseRatio.toFixed(2)}%`);
    if (aum < 500) concerns.push('Small AUM may affect liquidity');
    if (returns1y < 0) concerns.push('Negative recent returns');
    if (score < 50) concerns.push('Below-average risk-adjusted performance');
    return concerns.length > 0 ? concerns : ['Market volatility may impact short-term performance'];
  }

  private generateStockStrengths(stock: any, score: number, returns1y: number, roe: number, peRatio: number): string[] {
    const strengths: string[] = [];
    if (returns1y > 20) strengths.push(`Strong 1-year returns of ${returns1y.toFixed(1)}%`);
    if (roe > 18) strengths.push(`High ROE of ${roe.toFixed(1)}% indicates efficiency`);
    if (peRatio < 20) strengths.push('Attractive valuation relative to earnings');
    if (score > 80) strengths.push('Strong fundamentals and growth potential');
    return strengths.length > 0 ? strengths : ['Established company with market presence'];
  }

  private generateStockConcerns(stock: any, score: number, returns1y: number, peRatio: number, beta: number): string[] {
    const concerns: string[] = [];
    if (returns1y < 0) concerns.push('Negative recent performance');
    if (peRatio > 40) concerns.push('High valuation may limit upside');
    if (beta > 1.5) concerns.push(`High volatility (beta: ${beta.toFixed(2)})`);
    if (score < 50) concerns.push('Below-average fundamental scores');
    return concerns.length > 0 ? concerns : ['Sector-specific and market risks apply'];
  }

  private generateBondStrengths(bond: any, score: number, yield_: number, creditScore: number): string[] {
    const strengths: string[] = [];
    if (creditScore >= 90) strengths.push('High credit quality (investment grade)');
    if (yield_ > 9) strengths.push(`Attractive yield of ${yield_.toFixed(2)}%`);
    if (bond.tradingStatus === 'active') strengths.push('Active secondary market trading');
    return strengths.length > 0 ? strengths : ['Regular coupon payments'];
  }

  private generateBondConcerns(bond: any, score: number, yield_: number): string[] {
    const concerns: string[] = [];
    if (score < 60) concerns.push('Below-average credit quality');
    if (yield_ < 7) concerns.push('Below-market yield');
    return concerns.length > 0 ? concerns : ['Interest rate and credit risk apply'];
  }

  private generateRecommendation(stars: number, score: number): 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell' {
    if (stars >= 5 && score >= 85) return 'Strong Buy';
    if (stars >= 4 && score >= 70) return 'Buy';
    if (stars >= 3 || score >= 50) return 'Hold';
    if (stars === 2) return 'Sell';
    return 'Strong Sell';
  }

  private generateMFRationale(fund: any, rating: FintekProRating, metrics: Record<string, any>): string {
    const performance = rating.overallScore > 80 ? 'excellent' : rating.overallScore > 60 ? 'good' : 'moderate';
    return `This ${rating.category} fund receives a ${rating.stars}-star FintekPro Smart Rating based on ${performance} performance across risk-adjusted returns (${metrics.returns3Y} 3Y), quality metrics, and liquidity. The fund is in the ${rating.percentile}th percentile of its category.`;
  }

  private generateStockRationale(stock: any, rating: FintekProRating, metrics: Record<string, any>): string {
    const quality = rating.qualityScore > 80 ? 'strong' : rating.qualityScore > 60 ? 'good' : 'moderate';
    return `This ${stock.sector || 'equity'} stock receives a ${rating.stars}-star FintekPro Smart Rating with ${quality} fundamentals. Key metrics include P/E of ${metrics.peRatio}, ROE of ${metrics.roe}, and 1-year returns of ${metrics.returns1Y}.`;
  }

  private isCacheValid(): boolean {
    return (Date.now() - this.lastCacheUpdate.getTime()) < this.CACHE_TTL_MS;
  }

  clearCache(): void {
    this.ratingCache.clear();
    this.lastCacheUpdate = new Date();
    console.log("🧹 FintekPro rating cache cleared");
  }

  getCacheStats(): { size: number; lastUpdate: Date; isValid: boolean } {
    return {
      size: this.ratingCache.size,
      lastUpdate: this.lastCacheUpdate,
      isValid: this.isCacheValid()
    };
  }
}

export default FintekProRatingService.getInstance();
