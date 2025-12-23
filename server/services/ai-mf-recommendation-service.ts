import { db } from "../db";
import { 
  mutualFunds, 
  fundFinancialRatios,
  recommendationPerformance
} from "@shared/schema";
import { eq, and, desc, asc, gte, lte, sql, inArray, ilike, or, not, isNotNull } from "drizzle-orm";

interface MFRecommendation {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  currentNav: number;
  signal: 'buy' | 'hold' | 'exit';
  confidence: number;
  rationale: string;
  metrics: {
    portfolioPE?: number;
    peVsCategory?: number;
    avgROE?: number;
    sharpeRatio?: number;
    downsideCaptureRatio?: number;
    cagr1Y?: number;
    cagr3Y?: number;
    cagrVsCategory?: number;
    aumGrowthYoY?: number;
    expenseRatio?: number;
    exitLoadPercent?: number;
    exitLoadDays?: number;
    fintekproRating?: number;
    categoryPercentile?: number;
  };
}

interface RecommendationFilters {
  category?: string;
  riskLevel?: string;
  minInvestment?: number;
  includeGoldSilver?: boolean;
  maxFundsPerAMC?: number;
  minAMCs?: number;
  onlyTradable?: boolean;
  onlyTopRated?: boolean;
}

class AIMFRecommendationService {
  private riskFreeRate = 6.5; // Current RBI repo rate as risk-free rate
  
  constructor() {
    console.log("✅ AI MF Recommendation Service initialized");
  }

  async getSmartRecommendations(filters: RecommendationFilters = {}): Promise<MFRecommendation[]> {
    const {
      category,
      riskLevel,
      includeGoldSilver = true,
      maxFundsPerAMC = 2,
      minAMCs = 4,
      onlyTradable = true,
      onlyTopRated = true
    } = filters;

    try {
      const conditions: any[] = [
        eq(mutualFunds.isPublished, true),
        eq(mutualFunds.planType, 'regular')
      ];

      if (category) {
        conditions.push(ilike(mutualFunds.category, `%${category}%`));
      }

      if (riskLevel) {
        conditions.push(ilike(mutualFunds.riskLevel, `%${riskLevel}%`));
      }

      if (onlyTopRated) {
        conditions.push(
          or(
            lte(mutualFunds.crisilRating, 3),
            gte(mutualFunds.crisilPercentile, sql`50`)
          )
        );
      }

      let eligibleFunds = await db
        .select({
          id: mutualFunds.id,
          schemeCode: mutualFunds.schemeCode,
          schemeName: mutualFunds.schemeName,
          category: mutualFunds.category,
          fundHouse: mutualFunds.fundHouse,
          nav: mutualFunds.nav,
          returns1y: mutualFunds.returns1y,
          returns3y: mutualFunds.returns3y,
          returns5y: mutualFunds.returns5y,
          riskLevel: mutualFunds.riskLevel,
          expenseRatio: mutualFunds.expenseRatio,
          aum: mutualFunds.aum,
          crisilRating: mutualFunds.crisilRating,
          crisilPercentile: mutualFunds.crisilPercentile,
          crisilRiskAdjustedScore: mutualFunds.crisilRiskAdjustedScore,
          crisilOverallScore: mutualFunds.crisilOverallScore,
          extendedData: mutualFunds.extendedData,
        })
        .from(mutualFunds)
        .where(and(...conditions))
        .orderBy(desc(mutualFunds.crisilPercentile))
        .limit(100);

      if (includeGoldSilver) {
        const commodityFunds = await db
          .select({
            id: mutualFunds.id,
            schemeCode: mutualFunds.schemeCode,
            schemeName: mutualFunds.schemeName,
            category: mutualFunds.category,
            fundHouse: mutualFunds.fundHouse,
            nav: mutualFunds.nav,
            returns1y: mutualFunds.returns1y,
            returns3y: mutualFunds.returns3y,
            returns5y: mutualFunds.returns5y,
            riskLevel: mutualFunds.riskLevel,
            expenseRatio: mutualFunds.expenseRatio,
            aum: mutualFunds.aum,
            crisilRating: mutualFunds.crisilRating,
            crisilPercentile: mutualFunds.crisilPercentile,
            crisilRiskAdjustedScore: mutualFunds.crisilRiskAdjustedScore,
            crisilOverallScore: mutualFunds.crisilOverallScore,
            extendedData: mutualFunds.extendedData,
          })
          .from(mutualFunds)
          .where(
            and(
              eq(mutualFunds.isPublished, true),
              or(
                ilike(mutualFunds.category, '%gold%'),
                ilike(mutualFunds.category, '%silver%'),
                ilike(mutualFunds.category, '%commodity%'),
                ilike(mutualFunds.schemeName, '%gold%'),
                ilike(mutualFunds.schemeName, '%silver%')
              )
            )
          )
          .limit(10);
        
        eligibleFunds = [...eligibleFunds, ...commodityFunds];
      }

      const scoredFunds = eligibleFunds.map(fund => this.scoreFund(fund));
      scoredFunds.sort((a, b) => b.totalScore - a.totalScore);

      const diversifiedFunds = this.applyAMCDiversification(scoredFunds, maxFundsPerAMC, minAMCs);

      const recommendations = diversifiedFunds.map(fund => this.buildRecommendation(fund));

      return recommendations.slice(0, 10);
    } catch (error) {
      console.error('Error generating MF recommendations:', error);
      return [];
    }
  }

  private scoreFund(fund: any): any & { totalScore: number; metrics: any } {
    const returns1y = parseFloat(fund.returns1y || '0');
    const returns3y = parseFloat(fund.returns3y || '0');
    const returns5y = parseFloat(fund.returns5y || '0');
    const expenseRatio = parseFloat(fund.expenseRatio || '1.5');
    const aum = parseFloat(fund.aum || '0');
    const crisilRating = fund.crisilRating || 3;
    const crisilPercentile = parseFloat(fund.crisilPercentile || '50');
    const riskAdjustedScore = parseFloat(fund.crisilRiskAdjustedScore || '0');
    
    const extendedData = fund.extendedData as any || {};
    const exitLoad = this.parseExitLoad(extendedData.exitLoad);
    const purchaseAllowed = extendedData.purchaseAllowed !== false;
    const sipAllowed = extendedData.sipAllowed !== false;

    const returnsScore = (returns1y * 0.4 + returns3y * 0.35 + returns5y * 0.25);
    
    const sharpeEstimate = returnsScore > 0 ? (returnsScore - this.riskFreeRate) / Math.max(5, 15 - crisilPercentile / 10) : 0;
    
    const consistencyScore = returns3y > 0 && returns5y > 0 ? 
      Math.min(100, (returns3y / returns5y) * 50 + 50) : 50;
    
    const expenseScore = Math.max(0, 100 - (expenseRatio * 30));
    
    const aumScore = aum > 10000 ? 100 : aum > 5000 ? 80 : aum > 1000 ? 60 : 40;
    
    const ratingScore = (6 - crisilRating) * 20;
    
    const exitLoadScore = exitLoad.percent === 0 ? 100 : exitLoad.percent < 1 ? 80 : 60;

    const totalScore = (
      returnsScore * 0.30 +
      sharpeEstimate * 5 +
      consistencyScore * 0.15 +
      expenseScore * 0.10 +
      aumScore * 0.05 +
      ratingScore * 0.25 +
      exitLoadScore * 0.05 +
      (purchaseAllowed ? 10 : 0)
    );

    return {
      ...fund,
      totalScore,
      metrics: {
        returns1y,
        returns3y,
        returns5y,
        expenseRatio,
        aum,
        crisilRating,
        crisilPercentile,
        sharpeEstimate,
        consistencyScore,
        exitLoadPercent: exitLoad.percent,
        exitLoadDays: exitLoad.days,
        purchaseAllowed,
        sipAllowed
      }
    };
  }

  private parseExitLoad(exitLoadStr: string | undefined): { percent: number; days: number } {
    if (!exitLoadStr) return { percent: 1, days: 365 };
    
    const percentMatch = exitLoadStr.match(/(\d+\.?\d*)%/);
    const daysMatch = exitLoadStr.match(/(\d+)\s*(?:day|month|year)/i);
    
    let percent = percentMatch ? parseFloat(percentMatch[1]) : 1;
    let days = 365;
    
    if (daysMatch) {
      const value = parseInt(daysMatch[1]);
      if (exitLoadStr.toLowerCase().includes('year')) {
        days = value * 365;
      } else if (exitLoadStr.toLowerCase().includes('month')) {
        days = value * 30;
      } else {
        days = value;
      }
    }
    
    if (exitLoadStr.toLowerCase().includes('nil') || exitLoadStr === '0') {
      percent = 0;
      days = 0;
    }
    
    return { percent, days };
  }

  private applyAMCDiversification(
    funds: any[], 
    maxPerAMC: number, 
    minAMCs: number
  ): any[] {
    const amcCounts: Record<string, number> = {};
    const selectedFunds: any[] = [];
    const uniqueAMCs = new Set<string>();

    for (const fund of funds) {
      const amc = fund.fundHouse || 'Unknown';
      const currentCount = amcCounts[amc] || 0;
      
      if (currentCount < maxPerAMC) {
        selectedFunds.push(fund);
        amcCounts[amc] = currentCount + 1;
        uniqueAMCs.add(amc);
      }
      
      if (selectedFunds.length >= 15) break;
    }

    if (uniqueAMCs.size < minAMCs && funds.length > selectedFunds.length) {
      const missingCount = minAMCs - uniqueAMCs.size;
      const remainingFunds = funds.filter(f => !selectedFunds.includes(f));
      
      for (const fund of remainingFunds) {
        const amc = fund.fundHouse || 'Unknown';
        if (!uniqueAMCs.has(amc)) {
          selectedFunds.push(fund);
          uniqueAMCs.add(amc);
          amcCounts[amc] = (amcCounts[amc] || 0) + 1;
          if (uniqueAMCs.size >= minAMCs) break;
        }
      }
    }

    return selectedFunds;
  }

  private buildRecommendation(fund: any): MFRecommendation {
    const { metrics } = fund;
    const nav = parseFloat(fund.nav || '0');
    
    const signal = this.determineSignal(metrics);
    const confidence = Math.min(95, Math.max(50, fund.totalScore));
    const rationale = this.generateRichRationale(fund, metrics, signal);

    return {
      schemeCode: fund.schemeCode,
      schemeName: fund.schemeName || 'Unknown Fund',
      fundHouse: fund.fundHouse || 'Unknown AMC',
      category: fund.category || 'Equity',
      currentNav: nav,
      signal,
      confidence: Math.round(confidence),
      rationale,
      metrics: {
        portfolioPE: undefined,
        peVsCategory: undefined,
        avgROE: undefined,
        sharpeRatio: metrics.sharpeEstimate,
        downsideCaptureRatio: undefined,
        cagr1Y: metrics.returns1y,
        cagr3Y: metrics.returns3y,
        cagrVsCategory: undefined,
        aumGrowthYoY: undefined,
        expenseRatio: metrics.expenseRatio,
        exitLoadPercent: metrics.exitLoadPercent,
        exitLoadDays: metrics.exitLoadDays,
        fintekproRating: metrics.crisilRating,
        categoryPercentile: metrics.crisilPercentile
      }
    };
  }

  private determineSignal(metrics: any): 'buy' | 'hold' | 'exit' {
    const { returns1y, returns3y, crisilRating, crisilPercentile, purchaseAllowed } = metrics;
    
    if (!purchaseAllowed) return 'hold';
    
    if (returns1y < 0 && returns3y < 5) return 'exit';
    
    if (crisilRating <= 2 && crisilPercentile >= 70 && returns1y > 10) return 'buy';
    
    if (crisilRating <= 3 && returns1y > 5 && returns3y > 8) return 'buy';
    
    if (returns1y < 5 || (crisilRating >= 4 && crisilPercentile < 40)) return 'exit';
    
    return 'hold';
  }

  private generateRichRationale(fund: any, metrics: any, signal: 'buy' | 'hold' | 'exit'): string {
    const parts: string[] = [];
    
    if (metrics.crisilPercentile >= 70) {
      parts.push(`Top ${100 - Math.round(metrics.crisilPercentile)}% in ${fund.category || 'category'}`);
    } else if (metrics.crisilPercentile >= 50) {
      parts.push(`Above average in ${fund.category || 'category'}`);
    } else {
      parts.push(`Bottom ${Math.round(metrics.crisilPercentile)}% in ${fund.category || 'category'}`);
    }
    
    if (metrics.crisilRating) {
      const ratingStars = '★'.repeat(6 - metrics.crisilRating) + '☆'.repeat(metrics.crisilRating - 1);
      parts.push(`FintekPro Rating: ${ratingStars}`);
    }
    
    if (metrics.returns1y > 15) {
      parts.push(`Strong 1Y CAGR of ${metrics.returns1y.toFixed(1)}%`);
    } else if (metrics.returns1y > 10) {
      parts.push(`Solid 1Y returns of ${metrics.returns1y.toFixed(1)}%`);
    } else if (metrics.returns1y > 0) {
      parts.push(`Moderate 1Y returns of ${metrics.returns1y.toFixed(1)}%`);
    } else {
      parts.push(`Negative 1Y returns of ${metrics.returns1y.toFixed(1)}% - review needed`);
    }
    
    if (metrics.returns3y > 12) {
      parts.push(`3Y CAGR of ${metrics.returns3y.toFixed(1)}% shows consistency`);
    }
    
    if (metrics.sharpeEstimate > 1) {
      parts.push(`Strong risk-adjusted returns (Sharpe ~${metrics.sharpeEstimate.toFixed(2)})`);
    }
    
    if (metrics.expenseRatio <= 1) {
      parts.push(`Low expense ratio of ${metrics.expenseRatio.toFixed(2)}%`);
    } else if (metrics.expenseRatio >= 2) {
      parts.push(`High expense ratio of ${metrics.expenseRatio.toFixed(2)}% impacts returns`);
    } else {
      parts.push(`Expense ratio: ${metrics.expenseRatio.toFixed(2)}%`);
    }
    
    if (metrics.exitLoadPercent === 0) {
      parts.push(`Exit Load: Nil - no lock-in`);
    } else if (metrics.exitLoadPercent && metrics.exitLoadDays) {
      parts.push(`Exit Load: ${metrics.exitLoadPercent}% within ${metrics.exitLoadDays} days`);
    }
    
    if (signal === 'buy') {
      parts.push(`Recommended for long-term wealth creation`);
    } else if (signal === 'exit') {
      parts.push(`Consider switching to better-performing alternative`);
    }
    
    return parts.join('. ') + '.';
  }

  async getExitRecommendations(userHoldings?: string[]): Promise<MFRecommendation[]> {
    try {
      const conditions: any[] = [
        eq(mutualFunds.isPublished, true),
        or(
          lte(mutualFunds.returns1y, sql`5`),
          and(
            gte(mutualFunds.crisilRating, 4),
            lte(mutualFunds.crisilPercentile, sql`30`)
          )
        )
      ];

      if (userHoldings && userHoldings.length > 0) {
        conditions.push(inArray(mutualFunds.schemeCode, userHoldings));
      }

      const underperformers = await db
        .select({
          id: mutualFunds.id,
          schemeCode: mutualFunds.schemeCode,
          schemeName: mutualFunds.schemeName,
          category: mutualFunds.category,
          fundHouse: mutualFunds.fundHouse,
          nav: mutualFunds.nav,
          returns1y: mutualFunds.returns1y,
          returns3y: mutualFunds.returns3y,
          returns5y: mutualFunds.returns5y,
          riskLevel: mutualFunds.riskLevel,
          expenseRatio: mutualFunds.expenseRatio,
          aum: mutualFunds.aum,
          crisilRating: mutualFunds.crisilRating,
          crisilPercentile: mutualFunds.crisilPercentile,
          crisilRiskAdjustedScore: mutualFunds.crisilRiskAdjustedScore,
          extendedData: mutualFunds.extendedData,
        })
        .from(mutualFunds)
        .where(and(...conditions))
        .orderBy(asc(mutualFunds.returns1y))
        .limit(20);

      const recommendations = underperformers.map(fund => {
        const scored = this.scoreFund(fund);
        const rec = this.buildRecommendation(scored);
        rec.signal = 'exit';
        return rec;
      });

      return recommendations;
    } catch (error) {
      console.error('Error generating exit recommendations:', error);
      return [];
    }
  }

  async getCommodityFOFRecommendations(): Promise<MFRecommendation[]> {
    try {
      const commodityFunds = await db
        .select({
          id: mutualFunds.id,
          schemeCode: mutualFunds.schemeCode,
          schemeName: mutualFunds.schemeName,
          category: mutualFunds.category,
          fundHouse: mutualFunds.fundHouse,
          nav: mutualFunds.nav,
          returns1y: mutualFunds.returns1y,
          returns3y: mutualFunds.returns3y,
          returns5y: mutualFunds.returns5y,
          riskLevel: mutualFunds.riskLevel,
          expenseRatio: mutualFunds.expenseRatio,
          aum: mutualFunds.aum,
          crisilRating: mutualFunds.crisilRating,
          crisilPercentile: mutualFunds.crisilPercentile,
          crisilRiskAdjustedScore: mutualFunds.crisilRiskAdjustedScore,
          extendedData: mutualFunds.extendedData,
        })
        .from(mutualFunds)
        .where(
          and(
            eq(mutualFunds.isPublished, true),
            or(
              ilike(mutualFunds.category, '%gold%'),
              ilike(mutualFunds.category, '%silver%'),
              ilike(mutualFunds.category, '%commodity%'),
              ilike(mutualFunds.category, '%precious%'),
              ilike(mutualFunds.schemeName, '%gold%'),
              ilike(mutualFunds.schemeName, '%silver%'),
              ilike(mutualFunds.schemeName, '%commodity%')
            )
          )
        )
        .orderBy(desc(mutualFunds.crisilPercentile))
        .limit(10);

      const scoredFunds = commodityFunds.map(fund => this.scoreFund(fund));
      scoredFunds.sort((a, b) => b.totalScore - a.totalScore);

      const diversified = this.applyAMCDiversification(scoredFunds, 1, 3);
      
      return diversified.map(fund => this.buildRecommendation(fund));
    } catch (error) {
      console.error('Error getting commodity FOF recommendations:', error);
      return [];
    }
  }

  async fetchLiveNAV(schemeCode: string): Promise<number | null> {
    try {
      const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}/latest`);
      if (!response.ok) return null;
      
      const data = await response.json();
      if (data && data.data && data.data.length > 0) {
        return parseFloat(data.data[0].nav);
      }
      return null;
    } catch (error) {
      console.error(`Error fetching NAV for ${schemeCode}:`, error);
      return null;
    }
  }

  async getRecommendationsWithLiveNAV(filters: RecommendationFilters = {}): Promise<MFRecommendation[]> {
    const recommendations = await this.getSmartRecommendations(filters);
    
    const updatedRecommendations = await Promise.all(
      recommendations.map(async (rec) => {
        const liveNav = await this.fetchLiveNAV(rec.schemeCode);
        if (liveNav) {
          rec.currentNav = liveNav;
        }
        return rec;
      })
    );
    
    return updatedRecommendations;
  }
}

export const aiMFRecommendationService = new AIMFRecommendationService();
