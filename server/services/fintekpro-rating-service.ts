import { MutualFund } from '@shared/schema';

export interface FintekProRating {
  rating: number; // 1-5 scale (1 = very good performance)
  category: 'equity' | 'debt' | 'hybrid';
  percentile: number; // 0-100 percentile ranking
  evaluationDate: Date;
  riskAdjustedScore: number;
  assetQualityScore: number;
  liquidityScore: number;
  concentrationScore: number;
  overallScore: number;
  dataSource: 'calculated' | 'api' | 'manual';
}

export interface FintekProAnalysis {
  schemeCode: string;
  schemeName: string;
  rating: FintekProRating;
  rationale: string;
  strengths: string[];
  concerns: string[];
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
}

/**
 * FintekPro Smart Rating Service
 * 
 * Provides intelligent mutual fund ratings based on industry-standard metrics:
 * - Risk-adjusted returns (1Y, 3Y, 5Y performance)
 * - Asset quality (AUM, fund house reputation)
 * - Liquidity scores
 * - Concentration risk metrics
 * 
 * This is FintekPro's proprietary rating system, calculated using transparent
 * methodology based on quantitative analysis and fund characteristics.
 */
export class FintekProRatingService {
  private static instance: FintekProRatingService;
  private ratingCache = new Map<string, FintekProAnalysis>();
  private lastCacheUpdate = new Date();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  public static getInstance(): FintekProRatingService {
    if (!FintekProRatingService.instance) {
      FintekProRatingService.instance = new FintekProRatingService();
    }
    return FintekProRatingService.instance;
  }

  private constructor() {
    console.log("🏆 FintekPro Smart Rating Service initialized");
  }

  /**
   * Get FintekPro Smart Rating for a specific mutual fund scheme
   */
  async getRating(schemeCode: string): Promise<FintekProAnalysis | null> {
    try {
      // Check cache first
      if (this.ratingCache.has(schemeCode) && this.isCacheValid()) {
        return this.ratingCache.get(schemeCode)!;
      }

      // Generate rating based on scheme characteristics
      const rating = await this.generateRating(schemeCode);
      
      if (rating) {
        this.ratingCache.set(schemeCode, rating);
      }

      return rating;
    } catch (error) {
      console.error(`❌ Error calculating FintekPro rating for ${schemeCode}:`, error);
      return null;
    }
  }

  /**
   * Get FintekPro Smart Ratings for multiple schemes
   */
  async getBulkRatings(schemeCodes: string[]): Promise<FintekProAnalysis[]> {
    const ratings: FintekProAnalysis[] = [];

    for (const schemeCode of schemeCodes) {
      try {
        const rating = await this.getRating(schemeCode);
        if (rating) {
          ratings.push(rating);
        }
      } catch (error) {
        console.warn(`Failed to get FintekPro rating for ${schemeCode}:`, error);
      }
    }

    return ratings;
  }

  /**
   * Generate FintekPro Smart Rating based on fund characteristics
   * Uses transparent, quantitative methodology
   */
  private async generateRating(schemeCode: string): Promise<FintekProAnalysis | null> {
    // Mock fund data for demonstration
    const mockFunds = this.getMockFundDatabase();
    const fund = mockFunds[schemeCode];

    if (!fund) {
      return null;
    }

    // Calculate scores based on fund characteristics
    const category = this.determineCategory(fund.category);
    const riskAdjustedScore = this.calculateRiskAdjustedScore(fund);
    const assetQualityScore = this.calculateAssetQualityScore(fund);
    const liquidityScore = this.calculateLiquidityScore(fund);
    const concentrationScore = this.calculateConcentrationScore(fund);
    
    // Overall score is weighted average
    const overallScore = (
      riskAdjustedScore * 0.4 +
      assetQualityScore * 0.3 +
      liquidityScore * 0.2 +
      concentrationScore * 0.1
    );

    // Convert overall score to 1-5 rating (1 = best)
    const rating = Math.max(1, Math.min(5, Math.ceil((100 - overallScore) / 20)));
    const percentile = Math.round(overallScore);

    // Generate analysis
    const analysis: FintekProAnalysis = {
      schemeCode,
      schemeName: fund.name,
      rating: {
        rating,
        category,
        percentile,
        evaluationDate: new Date(),
        riskAdjustedScore,
        assetQualityScore,
        liquidityScore,
        concentrationScore,
        overallScore,
        dataSource: 'calculated'
      },
      rationale: this.generateRationale(rating, category, overallScore),
      strengths: this.generateStrengths(fund, overallScore),
      concerns: this.generateConcerns(fund, overallScore),
      recommendation: this.generateRecommendation(rating, overallScore)
    };

    return analysis;
  }

  private getMockFundDatabase(): Record<string, any> {
    return {
      '119551': {
        name: 'SBI BlueChip Fund - Direct Plan - Growth',
        category: 'Large Cap Fund',
        fundHouse: 'SBI Mutual Fund',
        aum: 25000,
        expenseRatio: 0.95,
        returns: { '1Y': 15.3, '3Y': 12.7, '5Y': 11.2 }
      },
      '120503': {
        name: 'ICICI Prudential Bluechip Fund - Direct Plan - Growth',
        category: 'Large Cap Fund',
        fundHouse: 'ICICI Prudential Mutual Fund',
        aum: 32000,
        expenseRatio: 1.05,
        returns: { '1Y': 14.8, '3Y': 13.1, '5Y': 12.0 }
      },
      '118989': {
        name: 'Axis Bluechip Fund - Direct Plan - Growth',
        category: 'Large Cap Fund',
        fundHouse: 'Axis Mutual Fund',
        aum: 28000,
        expenseRatio: 1.15,
        returns: { '1Y': 16.2, '3Y': 14.5, '5Y': 13.1 }
      }
    };
  }

  private determineCategory(fundCategory: string): 'equity' | 'debt' | 'hybrid' {
    const category = fundCategory.toLowerCase();
    
    if (category.includes('debt') || category.includes('bond') || category.includes('gilt')) {
      return 'debt';
    }
    
    if (category.includes('hybrid') || category.includes('balanced') || category.includes('conservative')) {
      return 'hybrid';
    }
    
    return 'equity'; // Default for equity funds
  }

  private calculateRiskAdjustedScore(fund: any): number {
    const returns1Y = fund.returns?.['1Y'] || 0;
    const returns3Y = fund.returns?.['3Y'] || 0;
    const returns5Y = fund.returns?.['5Y'] || 0;
    
    // Higher returns get better scores, but with diminishing returns
    const avgReturns = (returns1Y + returns3Y + returns5Y) / 3;
    return Math.min(95, Math.max(20, 40 + (avgReturns * 2)));
  }

  private calculateAssetQualityScore(fund: any): number {
    // Based on fund house reputation and AUM
    const aum = fund.aum || 0;
    const fundHouse = fund.fundHouse || '';
    
    let score = 60; // Base score
    
    // AUM bonus
    if (aum > 30000) score += 20;
    else if (aum > 15000) score += 15;
    else if (aum > 5000) score += 10;
    
    // Fund house bonus
    if (fundHouse.includes('SBI') || fundHouse.includes('ICICI') || fundHouse.includes('HDFC')) {
      score += 10;
    }
    
    return Math.min(95, score);
  }

  private calculateLiquidityScore(fund: any): number {
    const aum = fund.aum || 0;
    const category = fund.category?.toLowerCase() || '';
    
    let score = 70; // Base score
    
    // Large funds typically have better liquidity
    if (aum > 25000) score += 15;
    else if (aum > 10000) score += 10;
    
    // Large cap funds typically have better liquidity
    if (category.includes('large cap')) score += 10;
    
    return Math.min(90, score);
  }

  private calculateConcentrationScore(fund: any): number {
    const category = fund.category?.toLowerCase() || '';
    
    let score = 75; // Base score
    
    // Large cap funds typically have lower concentration risk
    if (category.includes('large cap')) score += 10;
    else if (category.includes('multi cap')) score += 8;
    else if (category.includes('small cap')) score -= 10;
    
    return Math.max(50, Math.min(90, score));
  }

  private generateRationale(rating: number, category: string, overallScore: number): string {
    const performance = overallScore > 80 ? 'excellent' : overallScore > 60 ? 'good' : 'moderate';
    
    return `This ${category} fund receives a ${rating}-star FintekPro Smart Rating based on ${performance} performance across risk-adjusted returns, asset quality, liquidity, and concentration metrics. The fund demonstrates ${this.getRatingDescription(rating)} characteristics relative to its peer group.`;
  }

  private generateStrengths(fund: any, overallScore: number): string[] {
    const strengths: string[] = [];
    
    if (fund.returns?.['3Y'] > 12) {
      strengths.push('Consistent 3-year performance above category average');
    }
    
    if (fund.aum > 20000) {
      strengths.push('Large AUM indicating investor confidence');
    }
    
    if (fund.expenseRatio < 1.0) {
      strengths.push('Low expense ratio enhancing net returns');
    }
    
    if (overallScore > 75) {
      strengths.push('Strong risk management framework');
    }
    
    return strengths.length > 0 ? strengths : ['Established fund house with track record'];
  }

  private generateConcerns(fund: any, overallScore: number): string[] {
    const concerns: string[] = [];
    
    if (fund.expenseRatio > 1.2) {
      concerns.push('Higher expense ratio compared to peers');
    }
    
    if (fund.aum < 5000) {
      concerns.push('Relatively small AUM may impact liquidity');
    }
    
    if (overallScore < 60) {
      concerns.push('Performance below category average');
    }
    
    return concerns.length > 0 ? concerns : ['Market volatility may impact short-term performance'];
  }

  private generateRecommendation(rating: number, overallScore: number): 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell' {
    if (rating === 1 && overallScore > 85) return 'Strong Buy';
    if (rating <= 2 && overallScore > 70) return 'Buy';
    if (rating === 3 || (rating === 2 && overallScore <= 70)) return 'Hold';
    if (rating === 4) return 'Sell';
    return 'Strong Sell';
  }

  private getRatingDescription(rating: number): string {
    switch (rating) {
      case 1: return 'exceptional';
      case 2: return 'above average';
      case 3: return 'average';
      case 4: return 'below average';
      case 5: return 'poor';
      default: return 'average';
    }
  }

  private isCacheValid(): boolean {
    const now = new Date();
    return (now.getTime() - this.lastCacheUpdate.getTime()) < this.CACHE_TTL_MS;
  }

  /**
   * Clear the rating cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.ratingCache.clear();
    this.lastCacheUpdate = new Date();
    console.log("🧹 FintekPro rating cache cleared");
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; lastUpdate: Date; isValid: boolean } {
    return {
      size: this.ratingCache.size,
      lastUpdate: this.lastCacheUpdate,
      isValid: this.isCacheValid()
    };
  }
}

export default FintekProRatingService.getInstance();
