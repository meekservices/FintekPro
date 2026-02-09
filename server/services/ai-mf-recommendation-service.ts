import { db } from "../db";
import { 
  mutualFunds, 
  fundFinancialRatios,
  recommendationPerformance
} from "@shared/schema";
import { eq, and, desc, asc, gte, lte, sql, inArray, ilike, or, not, isNotNull } from "drizzle-orm";
import { liveMFDataService } from "./live-mf-data-service";
import { FinancialMetricsCalculator } from "./financial-metrics-calculator";
import { 
  regulatoryInvestabilityService,
  isOverseasFund as sharedIsOverseasFund,
  isFundInvestable as sharedIsFundInvestable,
  logFilteredInstrument
} from "./regulatory-investability-service";

const financialMetricsCalculator = new FinancialMetricsCalculator();

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

      // Enhance funds with live data from AMFI
      const enhancedFunds = await this.enhanceWithLiveData(eligibleFunds);

      const scoredFunds = enhancedFunds.map(fund => this.scoreFund(fund));
      scoredFunds.sort((a, b) => b.totalScore - a.totalScore);

      const diversifiedFunds = this.applyAMCDiversification(scoredFunds, maxFundsPerAMC, minAMCs);

      const recommendations = diversifiedFunds.map(fund => this.buildRecommendation(fund));

      return recommendations.slice(0, 10);
    } catch (error) {
      console.error('Error generating MF recommendations:', error);
      return [];
    }
  }

  // Parse AMFI date format deterministically (DD-Mon-YYYY e.g., "21-Jan-2026")
  private parseAmfiDate(navDateStr: string): Date | null {
    try {
      const parts = navDateStr.split('-');
      if (parts.length !== 3) return null;
      
      const day = parseInt(parts[0]);
      const monthStr = parts[1];
      const year = parseInt(parts[2]);
      
      if (isNaN(day) || isNaN(year)) return null;
      
      const monthMap: { [key: string]: number } = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      
      const month = monthMap[monthStr];
      if (month === undefined) return null;
      
      return new Date(year, month, day);
    } catch {
      return null;
    }
  }

  // Check if NAV date is recent (within 7 days)
  private isNavDateRecent(navDateStr: string): boolean {
    const navDate = this.parseAmfiDate(navDateStr);
    if (!navDate) return false;
    
    const daysDiff = (Date.now() - navDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 7;
  }

  // Sanity check returns - cap unrealistic values based on fund category
  private sanitizeReturns(returns: number, category: string): number {
    const lowerCategory = category.toLowerCase();
    let maxReturn = 200; // Default for equity
    
    if (lowerCategory.includes('overnight') || lowerCategory.includes('liquid') || 
        lowerCategory.includes('money market') || lowerCategory.includes('ultra short')) {
      maxReturn = 15;
    } else if (lowerCategory.includes('debt') || lowerCategory.includes('bond') || 
               lowerCategory.includes('gilt') || lowerCategory.includes('fixed')) {
      maxReturn = 30;
    } else if (lowerCategory.includes('hybrid') || lowerCategory.includes('balanced')) {
      maxReturn = 100;
    }
    
    if (Math.abs(returns) > maxReturn) {
      console.warn(`[AI-MF] Capping unrealistic return ${returns}% to 0 for ${category} fund`);
      return 0;
    }
    return returns;
  }

  // Fetch live NAV from AMFI API - only use funds with recent data and investable status
  private async enhanceWithLiveData(funds: any[]): Promise<any[]> {
    try {
      const schemeCodes = funds.map(f => f.schemeCode);
      const liveNavData = await liveMFDataService.getLiveNavBatch(schemeCodes);
      
      const enhancedFunds: any[] = [];
      let discontinuedCount = 0;
      let regulatoryRestrictedCount = 0;
      let purchaseBlockedCount = 0;

      for (const fund of funds) {
        const liveData = liveNavData.get(fund.schemeCode);
        
        if (liveData && this.isNavDateRecent(liveData.date)) {
          // Fund has recent AMFI data - check investability
          const enhancedFund = {
            ...fund,
            nav: liveData.nav.toString(),
            navDate: liveData.date,
            isLiveData: true
          };
          
          // Check regulatory and operational investability
          const investability = this.isFundInvestable(enhancedFund);
          
          if (investability.investable) {
            enhancedFunds.push(enhancedFund);
          } else {
            // Audit log for filtered instrument
            logFilteredInstrument('mutual_fund', fund.schemeName, investability.reason || 'Unknown restriction');
            
            // Count by restriction type
            if (investability.reason?.includes('SEBI') || investability.reason?.includes('regulatory')) {
              regulatoryRestrictedCount++;
            } else {
              purchaseBlockedCount++;
            }
          }
        } else {
          // Fund has no recent AMFI data - likely discontinued
          logFilteredInstrument('mutual_fund', fund.schemeName, 'Discontinued: No recent AMFI NAV data');
          discontinuedCount++;
        }
      }

      console.log(`[AI-MF] Enhanced ${enhancedFunds.length}/${funds.length} funds with live AMFI data.`);
      console.log(`[AI-MF] Excluded: ${discontinuedCount} discontinued, ${regulatoryRestrictedCount} regulatory-restricted, ${purchaseBlockedCount} purchase-blocked funds.`);

      return enhancedFunds;
    } catch (error) {
      console.error('[AI-MF] Error enhancing with live data:', error);
      // On error, return empty to avoid recommending potentially stale funds
      return [];
    }
  }

  private scoreFund(fund: any): any & { totalScore: number; metrics: any } {
    // Use enhanced category detection for accurate return limits
    const detectedCategory = this.detectFundCategoryEnhanced(fund);
    const rawReturns1y = parseFloat(fund.returns1y || '0');
    const rawReturns3y = parseFloat(fund.returns3y || '0');
    const rawReturns5y = parseFloat(fund.returns5y || '0');
    
    // Sanitize returns to prevent unrealistic values from corrupted data
    const returns1y = this.sanitizeReturns(rawReturns1y, detectedCategory);
    const returns3y = this.sanitizeReturns(rawReturns3y, detectedCategory);
    const returns5y = this.sanitizeReturns(rawReturns5y, detectedCategory);
    const expenseRatio = parseFloat(fund.expenseRatio || '1.5');
    const aum = parseFloat(fund.aum || '0');
    const smartRating = fund.crisilRating || 3;
    const smartPercentile = parseFloat(fund.crisilPercentile || '50');
    const riskAdjustedScore = parseFloat(fund.crisilRiskAdjustedScore || '0');
    
    const extendedData = fund.extendedData as any || {};
    const exitLoad = this.parseExitLoad(extendedData.exitLoad);
    const purchaseAllowed = extendedData.purchaseAllowed !== false;
    const sipAllowed = extendedData.sipAllowed !== false;
    
    // Use detectedCategory from earlier for category-based scoring
    const category = detectedCategory;

    // Enhanced multi-factor scoring
    const returnsScore = this.calculateReturnsScore(returns1y, returns3y, returns5y, category);
    const sharpeEstimate = this.calculateSharpeEstimate(returns1y, returns3y, smartPercentile, category);
    const consistencyScore = this.calculateConsistencyScore(returns1y, returns3y, returns5y);
    const expenseScore = this.calculateExpenseScore(expenseRatio, category);
    const aumScore = this.calculateAUMScore(aum);
    const exitLoadScore = exitLoad.percent === 0 ? 100 : exitLoad.percent < 1 ? 80 : 60;

    // FintekPro proprietary rating (1-5 stars)
    const fintekproRating = this.calculateFintekProRating({
      returns1y, returns3y, returns5y,
      expenseRatio, smartRating, smartPercentile,
      consistencyScore, sharpeEstimate, aum, category
    });

    // Weighted scoring with category-aware adjustments
    const baseScore = (
      returnsScore * 0.25 +
      sharpeEstimate * 8 +
      consistencyScore * 0.20 +
      expenseScore * 0.15 +
      aumScore * 0.05 +
      fintekproRating * 10 +
      exitLoadScore * 0.05 +
      (purchaseAllowed ? 10 : 0) +
      (sipAllowed ? 5 : 0)
    );

    // Category-based bonus for well-performing funds
    const categoryBonus = this.getCategoryBonus(category, returns1y, returns3y);
    
    // Advanced Financial Metrics bonus for equity-oriented funds
    const advancedMetrics = this.calculateAdvancedMFMetrics(fund, returns1y, returns3y);
    const advancedMetricsBonus = this.getAdvancedMetricsBonus(advancedMetrics, category);
    
    const totalScore = Math.min(100, baseScore + categoryBonus + advancedMetricsBonus);

    return {
      ...fund,
      totalScore,
      metrics: {
        returns1y,
        returns3y,
        returns5y,
        expenseRatio,
        aum,
        smartRating,
        smartPercentile,
        sharpeEstimate,
        consistencyScore,
        exitLoadPercent: exitLoad.percent,
        exitLoadDays: exitLoad.days,
        purchaseAllowed,
        sipAllowed,
        fintekproRating,
        category,
        ...advancedMetrics
      }
    };
  }

  private calculateAdvancedMFMetrics(fund: any, returns1y: number, returns3y: number): {
    portfolioQualityScore?: number;
    riskAdjustedAlpha?: number;
    downsideProtection?: number;
    sortinoRatio?: number;
    maxDrawdown?: number;
  } {
    const metrics: any = {};
    const extendedData = fund.extendedData as any || {};
    
    try {
      // Portfolio Quality Score based on underlying holdings quality
      const portfolioPE = parseFloat(extendedData.portfolioPE || 0);
      const portfolioROE = parseFloat(extendedData.portfolioROE || 0);
      
      if (portfolioPE > 0 && portfolioROE > 0) {
        let qualityScore = 50;
        if (portfolioPE < 20 && portfolioROE > 15) qualityScore = 85;
        else if (portfolioPE < 25 && portfolioROE > 12) qualityScore = 70;
        else if (portfolioPE < 30) qualityScore = 55;
        metrics.portfolioQualityScore = qualityScore;
      }
      
      // Calculate Sharpe-like risk-adjusted metrics
      const riskFreeRate = 6.5;
      const volatility = parseFloat(extendedData.volatility || fund.volatility || 15);
      if (returns1y && volatility > 0) {
        metrics.sortinoRatio = financialMetricsCalculator.calculateSortinoRatio(
          returns1y, riskFreeRate, volatility * 0.7
        );
      }
      
      // Downside protection score
      const downsideCaptureRatio = parseFloat(extendedData.downsideCaptureRatio || 100);
      if (downsideCaptureRatio > 0) {
        metrics.downsideProtection = Math.max(0, 100 - downsideCaptureRatio);
      }
      
      // Max drawdown from NAV history if available
      if (extendedData.navHistory && Array.isArray(extendedData.navHistory)) {
        const navValues = extendedData.navHistory.map((n: any) => parseFloat(n.nav || n));
        if (navValues.length > 10) {
          metrics.maxDrawdown = financialMetricsCalculator.calculateMaxDrawdown(navValues) * 100;
        }
      }
      
      // Risk-adjusted alpha estimation
      const benchmarkReturns = this.getCategoryBenchmarks(fund.category || '').expected1Y;
      if (returns1y && benchmarkReturns) {
        const beta = parseFloat(extendedData.beta || 1);
        metrics.riskAdjustedAlpha = financialMetricsCalculator.calculateAlpha(
          returns1y, benchmarkReturns, beta, riskFreeRate
        );
      }
    } catch (error) {
      console.error('[AI-MF] Error calculating advanced metrics:', error);
    }
    
    return metrics;
  }

  private getAdvancedMetricsBonus(metrics: any, category: string): number {
    let bonus = 0;
    const cat = category.toLowerCase();
    
    // Only apply advanced metrics bonus to equity-oriented categories
    const isEquityOriented = cat.includes('equity') || cat.includes('flexi') || 
                              cat.includes('multi') || cat.includes('hybrid') ||
                              cat.includes('focused') || cat.includes('elss');
    
    if (!isEquityOriented) return 0;
    
    // Portfolio Quality Score bonus (max 5 points)
    if (metrics.portfolioQualityScore !== undefined) {
      if (metrics.portfolioQualityScore >= 80) bonus += 5;
      else if (metrics.portfolioQualityScore >= 65) bonus += 3;
    }
    
    // Sortino Ratio bonus (max 4 points)
    if (metrics.sortinoRatio !== undefined) {
      if (metrics.sortinoRatio > 1.5) bonus += 4;
      else if (metrics.sortinoRatio > 1) bonus += 2;
    }
    
    // Downside Protection bonus (max 3 points)
    if (metrics.downsideProtection !== undefined) {
      if (metrics.downsideProtection > 30) bonus += 3;
      else if (metrics.downsideProtection > 15) bonus += 1;
    }
    
    // Risk-adjusted Alpha bonus (max 3 points)
    if (metrics.riskAdjustedAlpha !== undefined) {
      if (metrics.riskAdjustedAlpha > 5) bonus += 3;
      else if (metrics.riskAdjustedAlpha > 2) bonus += 1;
    }
    
    // Penalize high max drawdown
    if (metrics.maxDrawdown !== undefined && metrics.maxDrawdown > 30) {
      bonus -= 2;
    }
    
    return bonus;
  }

  // Enhanced returns scoring with category benchmarks
  private calculateReturnsScore(r1y: number, r3y: number, r5y: number, category: string): number {
    const benchmarks = this.getCategoryBenchmarks(category);
    const r1yScore = r1y >= benchmarks.expected1Y ? Math.min(30, 20 + (r1y - benchmarks.expected1Y)) : Math.max(0, 20 - (benchmarks.expected1Y - r1y) * 2);
    const r3yScore = r3y >= benchmarks.expected3Y ? Math.min(25, 15 + (r3y - benchmarks.expected3Y)) : Math.max(0, 15 - (benchmarks.expected3Y - r3y) * 2);
    const r5yScore = r5y >= benchmarks.expected5Y ? Math.min(20, 10 + (r5y - benchmarks.expected5Y)) : Math.max(0, 10 - (benchmarks.expected5Y - r5y) * 2);
    return r1yScore + r3yScore + r5yScore;
  }

  // Category-specific benchmarks for returns - expanded to handle FOF and scheme name patterns
  private getCategoryBenchmarks(categoryOrName: string): { expected1Y: number; expected3Y: number; expected5Y: number; volatility: number } {
    const cat = categoryOrName.toLowerCase();
    
    // Gold, Silver, Commodity - check category AND common scheme name patterns
    if (cat.includes('gold') || cat.includes('silver') || cat.includes('commodity') || 
        cat.includes('precious') || cat.includes('fof') && (cat.includes('gold') || cat.includes('silver'))) {
      return { expected1Y: 8, expected3Y: 8, expected5Y: 9, volatility: 15 };
    }
    
    // Fund of Funds - lower expectations than direct equity
    if (cat.includes('fund of fund') || cat.includes('fof')) {
      return { expected1Y: 10, expected3Y: 10, expected5Y: 11, volatility: 12 };
    }
    
    // Debt, Liquid, Money Market
    if (cat.includes('debt') || cat.includes('liquid') || cat.includes('money market') || 
        cat.includes('overnight') || cat.includes('ultra short') || cat.includes('floating rate')) {
      return { expected1Y: 6, expected3Y: 7, expected5Y: 7.5, volatility: 2 };
    }
    
    // Hybrid, Balanced, Multi-asset
    if (cat.includes('hybrid') || cat.includes('balanced') || cat.includes('multi asset') || 
        cat.includes('dynamic') || cat.includes('equity savings')) {
      return { expected1Y: 10, expected3Y: 10, expected5Y: 11, volatility: 10 };
    }
    
    // Small/Mid Cap - higher expectations and volatility
    if (cat.includes('small') || cat.includes('mid')) {
      return { expected1Y: 15, expected3Y: 15, expected5Y: 16, volatility: 20 };
    }
    
    // Index funds and ETFs - track benchmark closely
    if (cat.includes('index') || cat.includes('etf') || cat.includes('passive')) {
      return { expected1Y: 11, expected3Y: 11, expected5Y: 12, volatility: 14 };
    }
    
    // International/Global funds
    if (cat.includes('international') || cat.includes('global') || cat.includes('overseas')) {
      return { expected1Y: 10, expected3Y: 10, expected5Y: 11, volatility: 18 };
    }
    
    // Large cap / equity default
    return { expected1Y: 12, expected3Y: 12, expected5Y: 13, volatility: 15 };
  }

  // Enhanced category detection that checks both category and scheme name
  private detectFundCategoryEnhanced(fund: any): string {
    const category = (fund.category || '').toLowerCase();
    const schemeName = (fund.schemeName || '').toLowerCase();
    const combined = `${category} ${schemeName}`;
    
    // Priority 1: Gold/Silver/Commodity - check scheme name first (most reliable)
    if (schemeName.includes('gold') || schemeName.includes('silver') || 
        schemeName.includes('commodity') || schemeName.includes('precious')) {
      return 'gold commodity';
    }
    
    // Priority 2: ETF detection
    if (schemeName.includes('etf') || category.includes('etf')) {
      if (combined.includes('gold') || combined.includes('silver')) {
        return 'gold commodity etf';
      }
      return 'etf index';
    }
    
    // Priority 3: Fund of Funds
    if (category.includes('fund of fund') || schemeName.includes('fof') || 
        category.includes('fof')) {
      if (combined.includes('gold') || combined.includes('silver')) {
        return 'gold commodity fof';
      }
      return 'fund of funds';
    }
    
    // Priority 4: Debt/Liquid
    if (category.includes('debt') || category.includes('liquid') || 
        category.includes('money market') || category.includes('overnight')) {
      return 'debt liquid';
    }
    
    // Priority 5: Hybrid/Balanced
    if (category.includes('hybrid') || category.includes('balanced') || 
        category.includes('multi asset')) {
      return 'hybrid balanced';
    }
    
    // Priority 6: Small/Mid Cap
    if (category.includes('small') || category.includes('mid')) {
      return 'small mid cap';
    }
    
    // Default: treat as large cap equity
    return category || 'equity large cap';
  }

  // Delegate to shared regulatory investability service
  private isOverseasFund(fund: any): boolean {
    return sharedIsOverseasFund(fund);
  }

  // Delegate to shared regulatory investability service
  private isFundInvestable(fund: any): { investable: boolean; reason: string | null } {
    return sharedIsFundInvestable(fund);
  }

  // Delegate to shared regulatory investability service
  static updateOverseasInvestmentStatus(frozen: boolean): void {
    regulatoryInvestabilityService.updateOverseasInvestmentStatus(frozen);
  }

  static updateOverseasETFStatus(frozen: boolean): void {
    regulatoryInvestabilityService.updateOverseasETFStatus(frozen);
  }

  static getOverseasInvestmentStatus(): { investmentFrozen: boolean; etfFrozen: boolean } {
    const status = regulatoryInvestabilityService.getStatus();
    return {
      investmentFrozen: status.overseasInvestmentFrozen,
      etfFrozen: status.overseasETFFrozen
    };
  }

  // Improved Sharpe ratio estimation
  private calculateSharpeEstimate(r1y: number, r3y: number, percentile: number, category: string): number {
    const benchmarks = this.getCategoryBenchmarks(category);
    const avgReturn = (r1y + r3y) / 2;
    const estimatedVolatility = benchmarks.volatility * (1 + (100 - percentile) / 100);
    const excessReturn = avgReturn - this.riskFreeRate;
    return estimatedVolatility > 0 ? excessReturn / estimatedVolatility : 0;
  }

  // Consistency score based on returns trajectory
  private calculateConsistencyScore(r1y: number, r3y: number, r5y: number): number {
    if (r5y <= 0) return 30; // Insufficient data
    
    const trajectory = r1y >= r3y && r3y >= r5y ? 20 : 0; // Improving trend
    const stability = Math.abs(r1y - r3y) < 5 && Math.abs(r3y - r5y) < 5 ? 30 : 
                     Math.abs(r1y - r3y) < 10 ? 20 : 10;
    const positivity = (r1y > 0 ? 15 : 0) + (r3y > 0 ? 15 : 0) + (r5y > 0 ? 10 : 0);
    
    return Math.min(100, trajectory + stability + positivity);
  }

  // Expense ratio scoring with category awareness
  private calculateExpenseScore(expenseRatio: number, category: string): number {
    const categoryAvgExpense = category.includes('debt') || category.includes('liquid') ? 0.5 :
                               category.includes('index') || category.includes('etf') ? 0.3 :
                               category.includes('small') || category.includes('mid') ? 2.0 : 1.5;
    
    if (expenseRatio <= categoryAvgExpense * 0.5) return 100;
    if (expenseRatio <= categoryAvgExpense * 0.75) return 85;
    if (expenseRatio <= categoryAvgExpense) return 70;
    if (expenseRatio <= categoryAvgExpense * 1.25) return 55;
    return 40;
  }

  // AUM scoring for fund stability
  private calculateAUMScore(aum: number): number {
    if (aum > 20000) return 100; // >20000 Cr - Very Large
    if (aum > 10000) return 90;  // >10000 Cr - Large
    if (aum > 5000) return 80;   // >5000 Cr - Medium-Large
    if (aum > 2000) return 70;   // >2000 Cr - Medium
    if (aum > 500) return 60;    // >500 Cr - Small
    return 50;                   // <500 Cr - Very Small
  }

  // FintekPro proprietary rating (1-5 stars)
  private calculateFintekProRating(params: {
    returns1y: number; returns3y: number; returns5y: number;
    expenseRatio: number; smartRating: number; smartPercentile: number;
    consistencyScore: number; sharpeEstimate: number; aum: number; category: string;
  }): number {
    const { returns1y, returns3y, returns5y, expenseRatio, smartRating, smartPercentile,
            consistencyScore, sharpeEstimate, aum, category } = params;
    
    let score = 0;
    const benchmarks = this.getCategoryBenchmarks(category);
    
    // Performance component (max 30 points)
    if (returns1y >= benchmarks.expected1Y * 1.5) score += 15;
    else if (returns1y >= benchmarks.expected1Y) score += 10;
    else if (returns1y >= benchmarks.expected1Y * 0.7) score += 5;
    
    if (returns3y >= benchmarks.expected3Y * 1.3) score += 15;
    else if (returns3y >= benchmarks.expected3Y) score += 10;
    else if (returns3y >= benchmarks.expected3Y * 0.7) score += 5;
    
    // Risk-adjusted returns (max 20 points)
    if (sharpeEstimate > 1.5) score += 20;
    else if (sharpeEstimate > 1) score += 15;
    else if (sharpeEstimate > 0.5) score += 10;
    else if (sharpeEstimate > 0) score += 5;
    
    // Consistency (max 15 points)
    score += Math.min(15, consistencyScore * 0.15);
    
    // Cost efficiency (max 15 points)
    if (expenseRatio < 0.5) score += 15;
    else if (expenseRatio < 1) score += 12;
    else if (expenseRatio < 1.5) score += 8;
    else if (expenseRatio < 2) score += 5;
    
    // External validation (max 10 points)
    if (smartRating <= 1) score += 10;
    else if (smartRating <= 2) score += 8;
    else if (smartRating <= 3) score += 5;
    
    // Category percentile (max 10 points)
    score += Math.min(10, smartPercentile / 10);
    
    // Convert to 1-5 star rating
    if (score >= 80) return 5;
    if (score >= 65) return 4;
    if (score >= 50) return 3;
    if (score >= 35) return 2;
    return 1;
  }

  // Category-specific bonus for outperformers
  private getCategoryBonus(category: string, r1y: number, r3y: number): number {
    const benchmarks = this.getCategoryBenchmarks(category);
    let bonus = 0;
    
    if (r1y > benchmarks.expected1Y * 1.5) bonus += 5;
    if (r3y > benchmarks.expected3Y * 1.3) bonus += 5;
    
    // Gold/Commodity funds get extra weight during uncertain times
    if (category.includes('gold') || category.includes('commodity')) {
      if (r1y > 10) bonus += 3;
    }
    
    return bonus;
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
    const confidence = this.calculateCalibratedConfidence(fund.totalScore, metrics, signal);
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
        fintekproRating: metrics.fintekproRating,
        categoryPercentile: metrics.smartPercentile
      }
    };
  }

  // Category-aware signal determination with missing data handling
  private determineSignal(metrics: any): 'buy' | 'hold' | 'exit' {
    const { returns1y, returns3y, returns5y, smartRating, smartPercentile, 
            purchaseAllowed, fintekproRating, consistencyScore, category } = metrics;
    
    if (!purchaseAllowed) return 'hold';
    
    const benchmarks = this.getCategoryBenchmarks(category || '');
    
    // CRITICAL: Missing or zero returns data = hold with low confidence, NOT exit
    // This prevents flagging new or data-poor funds as exits incorrectly
    const hasReturnsData = returns1y !== 0 || returns3y !== 0 || returns5y !== 0;
    if (!hasReturnsData) {
      return 'hold'; // Insufficient data - recommend hold pending more info
    }
    
    // Strong exit signals - require CONFIRMED underperformance (not just missing data)
    // Both 1Y AND 3Y must be negative/poor relative to benchmarks
    if (returns1y < 0 && returns3y < 0) return 'exit';
    if (returns1y < benchmarks.expected1Y * -0.5 && returns3y < benchmarks.expected3Y * 0.3) return 'exit';
    if (smartRating >= 5 && smartPercentile < 15 && returns1y < 0) return 'exit';
    
    // Strong buy signals - outperformance with quality
    if (fintekproRating >= 4 && returns1y >= benchmarks.expected1Y && purchaseAllowed) return 'buy';
    if (fintekproRating >= 3 && returns3y >= benchmarks.expected3Y * 1.2 && consistencyScore >= 60) return 'buy';
    if (smartRating <= 2 && smartPercentile >= 75 && returns1y >= benchmarks.expected1Y * 0.8) return 'buy';
    
    // Additional buy signal for gold/commodity during positive trends
    if (category.includes('gold') || category.includes('commodity')) {
      if (returns1y > 5 && fintekproRating >= 3) return 'buy';
    }
    
    // Moderate exit signals - only for confirmed poor performers
    if (returns1y < 0 && returns3y < benchmarks.expected3Y * 0.3 && fintekproRating <= 2) return 'exit';
    
    // Default to hold for moderate performers and uncertain data
    return 'hold';
  }

  // Calibrated confidence based on data quality and consistency
  private calculateCalibratedConfidence(totalScore: number, metrics: any, signal: string): number {
    let baseConfidence = Math.min(90, Math.max(40, totalScore));
    
    // Boost confidence for consistent performers
    if (metrics.consistencyScore >= 70) baseConfidence += 5;
    if (metrics.returns3y > 0 && metrics.returns5y > 0) baseConfidence += 3;
    
    // Reduce confidence for missing data
    if (!metrics.returns5y || metrics.returns5y === 0) baseConfidence -= 10;
    if (!metrics.smartPercentile || metrics.smartPercentile === 0) baseConfidence -= 5;
    
    // Adjust based on signal strength
    if (signal === 'buy' && metrics.fintekproRating >= 4) baseConfidence += 5;
    if (signal === 'exit' && metrics.fintekproRating <= 2) baseConfidence += 5;
    
    // Clamp to reasonable range
    return Math.min(95, Math.max(35, baseConfidence));
  }

  private generateRichRationale(fund: any, metrics: any, signal: 'buy' | 'hold' | 'exit'): string {
    const parts: string[] = [];
    
    if (metrics.smartPercentile >= 70) {
      parts.push(`Top ${100 - Math.round(metrics.smartPercentile)}% in ${fund.category || 'category'}`);
    } else if (metrics.smartPercentile >= 50) {
      parts.push(`Above average in ${fund.category || 'category'}`);
    } else {
      parts.push(`Bottom ${Math.round(metrics.smartPercentile)}% in ${fund.category || 'category'}`);
    }
    
    // Use FintekPro proprietary rating (1-5 stars)
    const fintekRating = metrics.fintekproRating || 3;
    const ratingStars = '★'.repeat(fintekRating) + '☆'.repeat(5 - fintekRating);
    parts.push(`FintekPro Rating: ${ratingStars}`);
    
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

  /**
   * Analyze user's existing portfolio holdings and provide AI-powered recommendations
   * This is the core method for portfolio analysis across FintekPro
   */
  async analyzePortfolioHoldings(holdings: {
    schemeCode?: string;
    schemeName: string;
    currentValue: number;
    units?: number;
    category?: string;
    fundHouse?: string;
  }[]): Promise<{
    holdingsAnalysis: Array<{
      schemeName: string;
      schemeCode?: string;
      currentValue: number;
      signal: 'buy_more' | 'hold' | 'exit' | 'switch';
      confidence: number;
      rationale: string;
      betterAlternative?: MFRecommendation;
      metrics: {
        fintekproRating?: number;
        cagr1Y?: number;
        categoryPercentile?: number;
        expenseRatio?: number;
      };
    }>;
    exitCandidates: MFRecommendation[];
    improvementSuggestions: MFRecommendation[];
    commodityAllocation: MFRecommendation[];
    portfolioHealthScore: number;
    aiSummary: string;
  }> {
    try {
      const holdingsAnalysis: Array<{
        schemeName: string;
        schemeCode?: string;
        currentValue: number;
        signal: 'buy_more' | 'hold' | 'exit' | 'switch';
        confidence: number;
        rationale: string;
        betterAlternative?: MFRecommendation;
        metrics: {
          fintekproRating?: number;
          cagr1Y?: number;
          categoryPercentile?: number;
          expenseRatio?: number;
        };
      }> = [];

      let totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
      let exitCount = 0;
      let strongHoldCount = 0;

      for (const holding of holdings) {
        let fundData = null;
        
        // Try to match by scheme code first, then by name
        if (holding.schemeCode) {
          const [fund] = await db
            .select()
            .from(mutualFunds)
            .where(eq(mutualFunds.schemeCode, holding.schemeCode))
            .limit(1);
          fundData = fund;
        }
        
        if (!fundData && holding.schemeName) {
          const [fund] = await db
            .select()
            .from(mutualFunds)
            .where(ilike(mutualFunds.schemeName, `%${holding.schemeName.substring(0, 30)}%`))
            .limit(1);
          fundData = fund;
        }

        if (fundData) {
          const scored = this.scoreFund(fundData);
          const signal = this.determineSignalFromScore(scored.totalScore, scored.cagr1Y, scored.categoryRank);
          
          let betterAlternative: MFRecommendation | undefined;
          if (signal === 'exit' || signal === 'switch') {
            // Find a better alternative in the same category
            const alternatives = await this.getSmartRecommendations({ 
              category: fundData.category || undefined,
              maxFundsPerAMC: 1,
              minAMCs: 2
            });
            if (alternatives.length > 0 && alternatives[0].schemeCode !== fundData.schemeCode) {
              betterAlternative = alternatives[0];
            }
          }

          holdingsAnalysis.push({
            schemeName: holding.schemeName,
            schemeCode: holding.schemeCode,
            currentValue: holding.currentValue,
            signal: signal as any,
            confidence: Math.min(95, Math.max(40, 50 + scored.totalScore * 5)),
            rationale: this.generateHoldingRationale(scored, fundData, signal),
            betterAlternative,
            metrics: {
              fintekproRating: scored.fintekproRating,
              cagr1Y: scored.cagr1Y,
              categoryPercentile: scored.categoryPercentile,
              expenseRatio: scored.expenseRatio
            }
          });

          if (signal === 'exit') exitCount++;
          if (signal === 'hold' || signal === 'buy_more') strongHoldCount++;
        } else {
          // Fund not found in database - mark as needs review
          holdingsAnalysis.push({
            schemeName: holding.schemeName,
            schemeCode: holding.schemeCode,
            currentValue: holding.currentValue,
            signal: 'hold',
            confidence: 30,
            rationale: 'Fund data not available in our database. Manual review recommended.',
            metrics: {}
          });
        }
      }

      // Get exit recommendations for portfolio
      const exitCandidates = await this.getExitRecommendations(
        holdings.map(h => h.schemeCode).filter(Boolean) as string[]
      );

      // Get improvement suggestions based on portfolio gaps
      const categories = [...new Set(holdings.map(h => h.category).filter(Boolean))];
      const improvementSuggestions: MFRecommendation[] = [];
      
      for (const category of categories.slice(0, 3)) {
        const suggestions = await this.getSmartRecommendations({ 
          category: category || undefined,
          maxFundsPerAMC: 1,
          minAMCs: 2
        });
        improvementSuggestions.push(...suggestions.slice(0, 2));
      }

      // Get commodity allocation for diversification
      const commodityAllocation = await this.getCommodityFOFRecommendations();

      // Calculate portfolio health score
      const portfolioHealthScore = this.calculatePortfolioHealthScore(
        holdingsAnalysis,
        exitCount,
        strongHoldCount,
        holdings.length
      );

      // Generate AI summary
      const aiSummary = this.generatePortfolioSummary(
        holdingsAnalysis,
        portfolioHealthScore,
        exitCount,
        commodityAllocation.length > 0
      );

      return {
        holdingsAnalysis,
        exitCandidates,
        improvementSuggestions: improvementSuggestions.slice(0, 5),
        commodityAllocation: commodityAllocation.slice(0, 3),
        portfolioHealthScore,
        aiSummary
      };
    } catch (error) {
      console.error('Error analyzing portfolio holdings:', error);
      return {
        holdingsAnalysis: [],
        exitCandidates: [],
        improvementSuggestions: [],
        commodityAllocation: [],
        portfolioHealthScore: 50,
        aiSummary: 'Unable to analyze portfolio at this time. Please try again later.'
      };
    }
  }

  private determineSignalFromScore(totalScore: number, cagr1Y: number, categoryRank: number): string {
    if (totalScore >= 7 && cagr1Y > 0) return 'buy_more';
    if (totalScore >= 5 && cagr1Y >= 0) return 'hold';
    if (totalScore < 3 || cagr1Y < -5) return 'exit';
    if (totalScore < 5 && categoryRank > 70) return 'switch';
    return 'hold';
  }

  private generateHoldingRationale(scored: any, fundData: any, signal: string): string {
    const parts: string[] = [];
    
    const stars = '★'.repeat(scored.fintekproRating || 3) + '☆'.repeat(5 - (scored.fintekproRating || 3));
    parts.push(`FintekPro Rating: ${stars}.`);

    if (scored.cagr1Y !== undefined) {
      if (scored.cagr1Y > 15) {
        parts.push(`Strong 1Y returns of ${scored.cagr1Y.toFixed(1)}%.`);
      } else if (scored.cagr1Y > 0) {
        parts.push(`Positive 1Y returns of ${scored.cagr1Y.toFixed(1)}%.`);
      } else {
        parts.push(`Negative 1Y returns of ${scored.cagr1Y.toFixed(1)}% - review needed.`);
      }
    }

    if (scored.categoryPercentile > 75) {
      parts.push(`Top quartile performer in category.`);
    } else if (scored.categoryPercentile < 25) {
      parts.push(`Below average category performance.`);
    }

    if (signal === 'exit') {
      parts.push(`Consider switching to a better-performing alternative.`);
    } else if (signal === 'buy_more') {
      parts.push(`Strong candidate for additional investment.`);
    }

    return parts.join(' ');
  }

  private calculatePortfolioHealthScore(
    holdings: any[],
    exitCount: number,
    strongHoldCount: number,
    totalCount: number
  ): number {
    if (totalCount === 0) return 50;
    
    let score = 70; // Base score
    
    // Penalty for exit candidates
    score -= exitCount * 10;
    
    // Bonus for strong holds
    score += strongHoldCount * 5;
    
    // Penalty for too many holdings (over-diversification)
    if (totalCount > 10) score -= (totalCount - 10) * 2;
    
    // Bonus for moderate diversification
    if (totalCount >= 4 && totalCount <= 8) score += 5;
    
    return Math.min(100, Math.max(0, score));
  }

  private generatePortfolioSummary(
    holdings: any[],
    healthScore: number,
    exitCount: number,
    hasCommodity: boolean
  ): string {
    const parts: string[] = [];
    
    if (healthScore >= 80) {
      parts.push('Your mutual fund portfolio is well-positioned.');
    } else if (healthScore >= 60) {
      parts.push('Your portfolio has some areas for improvement.');
    } else {
      parts.push('Your portfolio requires attention.');
    }

    if (exitCount > 0) {
      parts.push(`${exitCount} fund${exitCount > 1 ? 's' : ''} should be reviewed for potential switching.`);
    }

    const strongHoldings = holdings.filter(h => h.signal === 'buy_more' || h.signal === 'hold').length;
    if (strongHoldings > 0) {
      parts.push(`${strongHoldings} holding${strongHoldings > 1 ? 's are' : ' is'} performing well.`);
    }

    if (!hasCommodity) {
      parts.push('Consider adding 5-10% allocation to Gold/Silver FOF for downside protection.');
    }

    return parts.join(' ');
  }

  /**
   * Get smart fund recommendations for proposal generation
   * Used by ProposalOrchestrator and AIProposalEngine
   */
  async getProposalRecommendations(params: {
    riskCategory: 'conservative' | 'moderate' | 'aggressive';
    investmentAmount: number;
    existingCategories?: string[];
    excludeISINs?: string[];
  }): Promise<{
    equityFunds: MFRecommendation[];
    debtFunds: MFRecommendation[];
    hybridFunds: MFRecommendation[];
    commodityFunds: MFRecommendation[];
  }> {
    const { riskCategory, investmentAmount, existingCategories = [], excludeISINs = [] } = params;
    
    // Determine allocation based on risk
    const allocations = {
      conservative: { equity: 20, debt: 60, hybrid: 15, commodity: 5 },
      moderate: { equity: 50, debt: 30, hybrid: 15, commodity: 5 },
      aggressive: { equity: 70, debt: 15, hybrid: 10, commodity: 5 }
    };
    
    const allocation = allocations[riskCategory];

    // Get recommendations for each category
    const [equityFunds, debtFunds, hybridFunds, commodityFunds] = await Promise.all([
      this.getSmartRecommendations({ 
        category: 'Equity',
        riskLevel: riskCategory === 'conservative' ? 'low' : riskCategory === 'aggressive' ? 'high' : undefined,
        maxFundsPerAMC: 2,
        minAMCs: 3
      }),
      this.getSmartRecommendations({ 
        category: 'Debt',
        maxFundsPerAMC: 2,
        minAMCs: 2
      }),
      this.getSmartRecommendations({ 
        category: 'Hybrid',
        maxFundsPerAMC: 2,
        minAMCs: 2
      }),
      this.getCommodityFOFRecommendations()
    ]);

    return {
      equityFunds: equityFunds.slice(0, 4),
      debtFunds: debtFunds.slice(0, 3),
      hybridFunds: hybridFunds.slice(0, 2),
      commodityFunds: commodityFunds.slice(0, 2)
    };
  }
}

export const aiMFRecommendationService = new AIMFRecommendationService();
