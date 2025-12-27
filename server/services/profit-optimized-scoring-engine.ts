import { 
  InvestmentProduct, 
  UnifiedProductType, 
  ClientProfile, 
  RiskLevel,
  LiquidityLevel,
  InvestmentHorizon
} from "@shared/unified-investment-product";
import {
  SuitabilityScore,
  UpsideScore,
  FinalScore,
  ScoredProduct,
  RecommendationMode,
  AgentOverride,
  RecommendationAuditLog,
  ExperimentAssignment,
  SUITABILITY_THRESHOLD,
  SUITABILITY_WEIGHTS,
  MODE_WEIGHTINGS,
  RECOMMENDATION_MODE,
} from "@shared/profit-optimized-scoring";

const RISK_HIERARCHY: Record<RiskLevel, number> = {
  'conservative': 1,
  'moderate': 2,
  'aggressive': 3,
  'very_aggressive': 4,
};

const HORIZON_HIERARCHY: Record<InvestmentHorizon, number> = {
  'ultra_short': 1,
  'short': 2,
  'medium': 3,
  'long': 4,
  'very_long': 5,
};

const LIQUIDITY_HIERARCHY: Record<LiquidityLevel, number> = {
  'high': 4,
  'medium': 3,
  'low': 2,
  'very_low': 1,
};

const CLIENT_CATEGORY_PRODUCTS: Record<string, UnifiedProductType[]> = {
  'retail': ['STOCK', 'MF', 'BOND', 'REIT', 'INVIT', 'IPO'],
  'HNI': ['STOCK', 'MF', 'BOND', 'REIT', 'INVIT', 'IPO', 'UNLISTED', 'MLD'],
  'sHNI': ['STOCK', 'MF', 'BOND', 'REIT', 'INVIT', 'IPO', 'UNLISTED', 'AIF', 'PMS', 'MLD'],
  'bHNI': ['STOCK', 'MF', 'BOND', 'REIT', 'INVIT', 'IPO', 'UNLISTED', 'AIF', 'PMS', 'MLD'],
  'institutional': ['STOCK', 'MF', 'BOND', 'REIT', 'INVIT', 'IPO'],
};

class ProfitOptimizedScoringEngine {
  private auditLogs: RecommendationAuditLog[] = [];
  private overrides: AgentOverride[] = [];
  private experimentAssignments: Map<string, ExperimentAssignment> = new Map();
  private killSwitchActive = false;
  private killSwitchReason?: string;

  calculateSuitabilityScore(
    product: InvestmentProduct,
    clientProfile: ClientProfile
  ): SuitabilityScore {
    const riskMatch = this.calculateRiskMatch(product.risk_level, clientProfile.risk_category);
    const timeHorizonMatch = this.calculateHorizonMatch(product.investment_horizon, clientProfile.investment_horizon);
    const liquidityMatch = this.calculateLiquidityMatch(product.liquidity, clientProfile.liquidity_needs);
    const regulatoryEligibility = this.calculateRegulatoryEligibility(product, clientProfile);

    const total = Math.round(
      (riskMatch * SUITABILITY_WEIGHTS.riskMatch +
       timeHorizonMatch * SUITABILITY_WEIGHTS.timeHorizonMatch +
       liquidityMatch * SUITABILITY_WEIGHTS.liquidityMatch +
       regulatoryEligibility * SUITABILITY_WEIGHTS.regulatoryEligibility)
    );

    const isEligible = total >= SUITABILITY_THRESHOLD && regulatoryEligibility >= 50;
    
    let exclusionReason: string | undefined;
    if (!isEligible) {
      if (regulatoryEligibility < 50) {
        exclusionReason = `Client category ${clientProfile.client_category} not eligible for ${product.product_type}`;
      } else if (total < SUITABILITY_THRESHOLD) {
        exclusionReason = `Suitability score ${total} below threshold ${SUITABILITY_THRESHOLD}`;
      }
    }

    return {
      total,
      breakdown: {
        riskMatch,
        timeHorizonMatch,
        liquidityMatch,
        regulatoryEligibility,
      },
      isEligible,
      exclusionReason,
    };
  }

  private calculateRiskMatch(productRisk: RiskLevel, clientRisk: RiskLevel): number {
    const productLevel = RISK_HIERARCHY[productRisk];
    const clientLevel = RISK_HIERARCHY[clientRisk];
    const diff = Math.abs(productLevel - clientLevel);
    
    if (diff === 0) return 100;
    if (diff === 1) return 80;
    if (diff === 2) return 50;
    return 20;
  }

  private calculateHorizonMatch(productHorizon: InvestmentHorizon, clientHorizon: InvestmentHorizon): number {
    const productLevel = HORIZON_HIERARCHY[productHorizon];
    const clientLevel = HORIZON_HIERARCHY[clientHorizon];
    
    if (productLevel <= clientLevel) {
      return 100;
    }
    
    const diff = productLevel - clientLevel;
    if (diff === 1) return 70;
    if (diff === 2) return 40;
    return 20;
  }

  private calculateLiquidityMatch(productLiquidity: LiquidityLevel, clientNeeds: LiquidityLevel): number {
    const productLevel = LIQUIDITY_HIERARCHY[productLiquidity];
    const clientLevel = LIQUIDITY_HIERARCHY[clientNeeds];
    
    if (productLevel >= clientLevel) {
      return 100;
    }
    
    const diff = clientLevel - productLevel;
    if (diff === 1) return 70;
    if (diff === 2) return 40;
    return 20;
  }

  private calculateRegulatoryEligibility(product: InvestmentProduct, clientProfile: ClientProfile): number {
    const allowedProducts = CLIENT_CATEGORY_PRODUCTS[clientProfile.client_category] || [];
    
    if (!allowedProducts.includes(product.product_type)) {
      return 0;
    }
    
    if (product.min_investment > 0) {
      const estimatedCapacity = this.estimateInvestmentCapacity(clientProfile);
      if (estimatedCapacity < product.min_investment) {
        return 30;
      }
    }
    
    return 100;
  }

  private estimateInvestmentCapacity(clientProfile: ClientProfile): number {
    const categoryCapacity: Record<string, number> = {
      'retail': 500000,
      'HNI': 5000000,
      'sHNI': 25000000,
      'bHNI': 100000000,
      'institutional': 500000000,
    };
    return categoryCapacity[clientProfile.client_category] || 100000;
  }

  calculateUpsideScore(product: InvestmentProduct): UpsideScore {
    switch (product.product_type) {
      case 'STOCK':
        return this.calculateStockUpside(product);
      case 'MF':
        return this.calculateMFUpside(product);
      case 'BOND':
      case 'MLD':
        return this.calculateBondUpside(product);
      case 'REIT':
      case 'INVIT':
        return this.calculateREITInvITUpside(product);
      case 'IPO':
        return this.calculateIPOUpside(product);
      case 'UNLISTED':
        return this.calculateUnlistedUpside(product);
      case 'AIF':
      case 'PMS':
        return this.calculateAIFPMSUpside(product);
      default:
        return this.calculateDefaultUpside(product);
    }
  }

  private calculateStockUpside(product: InvestmentProduct): UpsideScore {
    const raw = product.raw_data || {};
    
    const returnPotential = Math.min(100, Math.max(0,
      ((product.expected_return_band.max - 8) / 20) * 100
    ));
    
    const momentumScore = this.calculateMomentumScore(raw);
    const valuationScore = this.calculateValuationScore(raw);
    const sectorScore = this.calculateSectorScore(product.sector || 'general');
    
    const total = Math.round(
      returnPotential * 0.30 +
      momentumScore * 0.25 +
      valuationScore * 0.25 +
      sectorScore * 0.20
    );

    return {
      total: Math.min(100, Math.max(0, total)),
      breakdown: {
        returnPotential,
        momentumScore,
        valuationScore,
        sectorScore,
      },
      methodology: 'STOCK: Return potential (30%) + Momentum (25%) + Valuation (25%) + Sector (20%)',
      inputs: {
        expectedReturnMax: product.expected_return_band.max,
        sector: product.sector,
        volatility: product.volatility_proxy,
      },
    };
  }

  private calculateMomentumScore(raw: any): number {
    const priceChange = raw.changePercent || raw.change_percent || 0;
    const weekChange = raw.week52Change || raw.fiftyTwoWeekChange || 0;
    
    let score = 50;
    
    if (priceChange > 0) score += Math.min(20, priceChange * 2);
    else score += Math.max(-20, priceChange * 2);
    
    if (weekChange > 0) score += Math.min(30, weekChange * 0.5);
    else score += Math.max(-30, weekChange * 0.5);
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateValuationScore(raw: any): number {
    const pe = raw.pe || raw.peRatio || raw.priceToEarnings || 25;
    const pbv = raw.pbv || raw.priceToBook || 3;
    
    let score = 50;
    
    if (pe < 15) score += 25;
    else if (pe < 25) score += 15;
    else if (pe > 50) score -= 20;
    else if (pe > 35) score -= 10;
    
    if (pbv < 1.5) score += 15;
    else if (pbv < 3) score += 5;
    else if (pbv > 5) score -= 15;
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateSectorScore(sector: string): number {
    const highGrowthSectors = ['technology', 'fintech', 'healthcare', 'renewable_energy', 'ev', 'ai'];
    const moderateGrowthSectors = ['consumer', 'banking', 'infrastructure', 'manufacturing'];
    const defensiveSectors = ['utilities', 'fmcg', 'pharma'];
    
    const normalizedSector = sector.toLowerCase().replace(/[\s-]/g, '_');
    
    if (highGrowthSectors.some(s => normalizedSector.includes(s))) return 85;
    if (moderateGrowthSectors.some(s => normalizedSector.includes(s))) return 65;
    if (defensiveSectors.some(s => normalizedSector.includes(s))) return 50;
    return 60;
  }

  private calculateMFUpside(product: InvestmentProduct): UpsideScore {
    const raw = product.raw_data || {};
    
    const returnPotential = Math.min(100, Math.max(0,
      ((product.expected_return_band.max - 6) / 15) * 100
    ));
    
    const alphaScore = this.calculateAlphaScore(raw);
    const consistencyScore = this.calculateConsistencyScore(raw);
    const ratingScore = this.calculateRatingScore(product.rating);
    
    const total = Math.round(
      returnPotential * 0.35 +
      alphaScore * 0.25 +
      consistencyScore * 0.25 +
      ratingScore * 0.15
    );

    return {
      total: Math.min(100, Math.max(0, total)),
      breakdown: {
        returnPotential,
        alphaScore,
        consistencyScore,
        ratingScore,
      },
      methodology: 'MF: Return potential (35%) + Alpha (25%) + Consistency (25%) + Rating (15%)',
      inputs: {
        expectedReturnMax: product.expected_return_band.max,
        rating: product.rating,
        fundCategory: raw.category,
      },
    };
  }

  private calculateAlphaScore(raw: any): number {
    const alpha = raw.alpha || raw.jensenAlpha || 0;
    const sharpe = raw.sharpe || raw.sharpeRatio || 1;
    
    let score = 50;
    
    if (alpha > 3) score += 30;
    else if (alpha > 1) score += 20;
    else if (alpha > 0) score += 10;
    else score -= 10;
    
    if (sharpe > 1.5) score += 20;
    else if (sharpe > 1) score += 10;
    else if (sharpe < 0.5) score -= 15;
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateConsistencyScore(raw: any): number {
    const returns1y = raw.return1y || raw.oneYearReturn || 0;
    const returns3y = raw.return3y || raw.threeYearReturn || 0;
    const returns5y = raw.return5y || raw.fiveYearReturn || 0;
    
    const avgReturn = (returns1y + returns3y + returns5y) / 3;
    const volatility = Math.abs(returns1y - avgReturn) + Math.abs(returns3y - avgReturn) + Math.abs(returns5y - avgReturn);
    
    let score = 70;
    if (volatility < 5) score += 20;
    else if (volatility < 10) score += 10;
    else if (volatility > 20) score -= 20;
    
    if (avgReturn > 15) score += 10;
    else if (avgReturn < 5) score -= 15;
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateRatingScore(rating?: string): number {
    if (!rating) return 50;
    
    const normalizedRating = rating.toLowerCase();
    
    if (normalizedRating.includes('5') || normalizedRating.includes('aaa') || normalizedRating === 'platinum') return 100;
    if (normalizedRating.includes('4') || normalizedRating.includes('aa') || normalizedRating === 'gold') return 80;
    if (normalizedRating.includes('3') || normalizedRating.includes('a') || normalizedRating === 'silver') return 60;
    if (normalizedRating.includes('2') || normalizedRating.includes('bb')) return 40;
    return 30;
  }

  private calculateBondUpside(product: InvestmentProduct): UpsideScore {
    const raw = product.raw_data || {};
    
    const yieldScore = Math.min(100, Math.max(0,
      ((product.yield_or_return || product.expected_return_band.max) - 5) / 8 * 100
    ));
    
    const creditScore = this.calculateCreditScore(product.rating);
    const durationScore = this.calculateDurationScore(raw);
    const spreadScore = this.calculateSpreadScore(raw);
    
    const total = Math.round(
      yieldScore * 0.40 +
      creditScore * 0.25 +
      durationScore * 0.20 +
      spreadScore * 0.15
    );

    return {
      total: Math.min(100, Math.max(0, total)),
      breakdown: {
        yieldScore,
        creditScore,
        durationScore,
        spreadScore,
      },
      methodology: 'BOND: Yield (40%) + Credit Quality (25%) + Duration (20%) + Spread (15%)',
      inputs: {
        yield: product.yield_or_return,
        rating: product.rating,
        maturity: raw.maturityDate,
      },
    };
  }

  private calculateCreditScore(rating?: string): number {
    if (!rating) return 50;
    
    const normalizedRating = rating.toUpperCase();
    
    if (normalizedRating.includes('AAA') || normalizedRating.includes('SOV')) return 100;
    if (normalizedRating.includes('AA+')) return 90;
    if (normalizedRating.includes('AA')) return 80;
    if (normalizedRating.includes('A+')) return 70;
    if (normalizedRating.includes('A')) return 60;
    if (normalizedRating.includes('BBB')) return 50;
    if (normalizedRating.includes('BB')) return 35;
    return 25;
  }

  private calculateDurationScore(raw: any): number {
    const duration = raw.duration || raw.modifiedDuration || 5;
    
    if (duration < 2) return 85;
    if (duration < 4) return 75;
    if (duration < 6) return 60;
    if (duration < 8) return 45;
    return 30;
  }

  private calculateSpreadScore(raw: any): number {
    const spread = raw.spread || raw.creditSpread || 100;
    
    if (spread > 200) return 80;
    if (spread > 150) return 70;
    if (spread > 100) return 60;
    if (spread > 50) return 50;
    return 40;
  }

  private calculateREITInvITUpside(product: InvestmentProduct): UpsideScore {
    const raw = product.raw_data || {};
    
    const dividendYield = product.yield_or_return || raw.dividendYield || 6;
    const yieldScore = Math.min(100, ((dividendYield - 4) / 6) * 100);
    
    const navDiscount = raw.navDiscount || raw.discountToNav || 0;
    const navScore = Math.min(100, Math.max(0, 50 + navDiscount * 2));
    
    const occupancyScore = this.calculateOccupancyScore(raw);
    const growthScore = this.calculateDistributionGrowthScore(raw);
    
    const total = Math.round(
      yieldScore * 0.35 +
      navScore * 0.25 +
      occupancyScore * 0.20 +
      growthScore * 0.20
    );

    return {
      total: Math.min(100, Math.max(0, total)),
      breakdown: {
        yieldScore,
        navScore,
        occupancyScore,
        growthScore,
      },
      methodology: 'REIT/InvIT: Yield (35%) + NAV Discount (25%) + Occupancy (20%) + Growth (20%)',
      inputs: {
        dividendYield,
        navDiscount,
        occupancy: raw.occupancyRate,
      },
    };
  }

  private calculateOccupancyScore(raw: any): number {
    const occupancy = raw.occupancyRate || raw.occupancy || 90;
    
    if (occupancy >= 95) return 100;
    if (occupancy >= 90) return 85;
    if (occupancy >= 85) return 70;
    if (occupancy >= 80) return 55;
    return 40;
  }

  private calculateDistributionGrowthScore(raw: any): number {
    const growth = raw.distributionGrowth || raw.dividendGrowth || 5;
    
    if (growth >= 15) return 100;
    if (growth >= 10) return 80;
    if (growth >= 5) return 60;
    if (growth >= 0) return 40;
    return 20;
  }

  private calculateIPOUpside(product: InvestmentProduct): UpsideScore {
    const raw = product.raw_data || {};
    
    const subscriptionScore = this.calculateSubscriptionScore(raw);
    const valuationScore = this.calculateIPOValuationScore(raw);
    const sectorScore = this.calculateSectorScore(product.sector || 'general');
    const qualityScore = this.calculateIssuerQualityScore(raw);
    
    const total = Math.round(
      subscriptionScore * 0.30 +
      valuationScore * 0.30 +
      sectorScore * 0.20 +
      qualityScore * 0.20
    );

    return {
      total: Math.min(100, Math.max(0, total)),
      breakdown: {
        subscriptionScore,
        valuationScore,
        sectorScore,
        qualityScore,
      },
      methodology: 'IPO: Subscription (30%) + Valuation (30%) + Sector (20%) + Issuer Quality (20%)',
      inputs: {
        subscriptionTimes: raw.subscriptionTimes,
        pe: raw.pe,
        sector: product.sector,
      },
    };
  }

  private calculateSubscriptionScore(raw: any): number {
    const subscription = raw.subscriptionTimes || raw.oversubscription || 1;
    
    if (subscription >= 100) return 100;
    if (subscription >= 50) return 85;
    if (subscription >= 20) return 70;
    if (subscription >= 5) return 55;
    if (subscription >= 1) return 40;
    return 25;
  }

  private calculateIPOValuationScore(raw: any): number {
    const pe = raw.pe || raw.priceToEarnings || 25;
    const industryPE = raw.industryPE || raw.sectorPE || 25;
    
    const peDiscount = ((industryPE - pe) / industryPE) * 100;
    
    if (peDiscount > 20) return 90;
    if (peDiscount > 10) return 75;
    if (peDiscount > 0) return 60;
    if (peDiscount > -10) return 45;
    return 30;
  }

  private calculateIssuerQualityScore(raw: any): number {
    let score = 50;
    
    if (raw.revenueGrowth > 30) score += 15;
    else if (raw.revenueGrowth > 15) score += 10;
    
    if (raw.profitMargin > 20) score += 15;
    else if (raw.profitMargin > 10) score += 10;
    else if (raw.profitMargin < 0) score -= 15;
    
    if (raw.debtToEquity < 0.5) score += 10;
    else if (raw.debtToEquity > 2) score -= 10;
    
    if (raw.promoterHolding > 60) score += 10;
    else if (raw.promoterHolding < 30) score -= 10;
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateUnlistedUpside(product: InvestmentProduct): UpsideScore {
    const raw = product.raw_data || {};
    
    const ipoProximityScore = this.calculateIPOProximityScore(raw);
    const growthScore = this.calculateCompanyGrowthScore(raw);
    const valuationScore = this.calculateUnlistedValuationScore(raw);
    const liquidityDiscount = this.calculateLiquidityDiscount(product);
    
    const total = Math.round(
      ipoProximityScore * 0.30 +
      growthScore * 0.30 +
      valuationScore * 0.25 +
      liquidityDiscount * 0.15
    );

    return {
      total: Math.min(100, Math.max(0, total)),
      breakdown: {
        ipoProximityScore,
        growthScore,
        valuationScore,
        liquidityDiscount,
      },
      methodology: 'UNLISTED: IPO Proximity (30%) + Growth (30%) + Valuation (25%) + Liquidity Premium (15%)',
      inputs: {
        ipoTimeline: raw.ipoTimeline,
        revenueGrowth: raw.revenueGrowth,
        sector: product.sector,
      },
    };
  }

  private calculateIPOProximityScore(raw: any): number {
    const timeline = raw.ipoTimeline || raw.expectedIPO;
    
    if (timeline === 'filed' || timeline === 'drhp_filed') return 95;
    if (timeline === '6_months' || timeline === 'imminent') return 85;
    if (timeline === '12_months') return 70;
    if (timeline === '24_months') return 50;
    return 35;
  }

  private calculateCompanyGrowthScore(raw: any): number {
    const revenueGrowth = raw.revenueGrowth || 0;
    const profitGrowth = raw.profitGrowth || 0;
    
    let score = 50;
    
    if (revenueGrowth > 50) score += 25;
    else if (revenueGrowth > 30) score += 20;
    else if (revenueGrowth > 15) score += 10;
    else if (revenueGrowth < 0) score -= 15;
    
    if (profitGrowth > 40) score += 25;
    else if (profitGrowth > 20) score += 15;
    else if (profitGrowth > 0) score += 5;
    else if (profitGrowth < 0) score -= 10;
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateUnlistedValuationScore(raw: any): number {
    const peRatio = raw.pe || 30;
    const industryPE = raw.industryPE || 25;
    
    const discount = ((industryPE - peRatio) / industryPE) * 100;
    
    if (discount > 30) return 90;
    if (discount > 15) return 75;
    if (discount > 0) return 60;
    if (discount > -15) return 45;
    return 30;
  }

  private calculateLiquidityDiscount(product: InvestmentProduct): number {
    const expectedReturn = product.expected_return_band.max;
    const riskPremium = expectedReturn - 12;
    
    if (riskPremium > 25) return 85;
    if (riskPremium > 15) return 70;
    if (riskPremium > 5) return 55;
    return 40;
  }

  private calculateAIFPMSUpside(product: InvestmentProduct): UpsideScore {
    const raw = product.raw_data || {};
    
    const trackRecordScore = this.calculateTrackRecordScore(raw);
    const strategyScore = this.calculateStrategyScore(raw);
    const alphaScore = this.calculateAlphaScore(raw);
    const riskAdjustedScore = this.calculateRiskAdjustedReturnScore(raw);
    
    const total = Math.round(
      trackRecordScore * 0.30 +
      strategyScore * 0.25 +
      alphaScore * 0.25 +
      riskAdjustedScore * 0.20
    );

    return {
      total: Math.min(100, Math.max(0, total)),
      breakdown: {
        trackRecordScore,
        strategyScore,
        alphaScore,
        riskAdjustedScore,
      },
      methodology: 'AIF/PMS: Track Record (30%) + Strategy (25%) + Alpha (25%) + Risk-Adjusted (20%)',
      inputs: {
        returns: raw.returns,
        strategy: raw.strategy,
        aum: raw.aum,
      },
    };
  }

  private calculateTrackRecordScore(raw: any): number {
    const yearsActive = raw.yearsActive || raw.vintage || 3;
    const avgReturn = raw.avgAnnualReturn || raw.cagr || 12;
    
    let score = 50;
    
    if (yearsActive >= 10) score += 20;
    else if (yearsActive >= 5) score += 15;
    else if (yearsActive >= 3) score += 10;
    else score -= 10;
    
    if (avgReturn > 25) score += 30;
    else if (avgReturn > 18) score += 20;
    else if (avgReturn > 12) score += 10;
    else if (avgReturn < 8) score -= 15;
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateStrategyScore(raw: any): number {
    const strategy = (raw.strategy || raw.investmentStyle || '').toLowerCase();
    
    if (strategy.includes('multi') || strategy.includes('diversified')) return 75;
    if (strategy.includes('growth')) return 80;
    if (strategy.includes('value')) return 70;
    if (strategy.includes('momentum')) return 75;
    if (strategy.includes('quant')) return 70;
    if (strategy.includes('long_short') || strategy.includes('hedge')) return 65;
    return 60;
  }

  private calculateRiskAdjustedReturnScore(raw: any): number {
    const sharpe = raw.sharpeRatio || raw.sharpe || 1;
    const sortino = raw.sortinoRatio || raw.sortino || sharpe * 1.2;
    
    const avgRatio = (sharpe + sortino) / 2;
    
    if (avgRatio > 2) return 100;
    if (avgRatio > 1.5) return 85;
    if (avgRatio > 1) return 70;
    if (avgRatio > 0.5) return 50;
    return 30;
  }

  private calculateDefaultUpside(product: InvestmentProduct): UpsideScore {
    const returnPotential = Math.min(100, Math.max(0,
      ((product.expected_return_band.max - 6) / 20) * 100
    ));
    
    return {
      total: returnPotential,
      breakdown: { returnPotential },
      methodology: 'DEFAULT: Return potential only',
      inputs: {
        expectedReturnMax: product.expected_return_band.max,
      },
    };
  }

  calculateFinalScore(
    suitability: SuitabilityScore,
    upside: UpsideScore,
    mode: RecommendationMode
  ): FinalScore {
    const effectiveMode = this.killSwitchActive ? RECOMMENDATION_MODE.BALANCED : mode;
    const weightings = MODE_WEIGHTINGS[effectiveMode];
    
    const total = Math.round(
      suitability.total * weightings.suitability +
      upside.total * weightings.upside
    );

    return {
      total,
      suitabilityScore: suitability.total,
      upsideScore: upside.total,
      mode: effectiveMode,
      weightings,
    };
  }

  scoreProducts(
    products: InvestmentProduct[],
    clientProfile: ClientProfile,
    mode: RecommendationMode = RECOMMENDATION_MODE.BALANCED
  ): ScoredProduct[] {
    const scoredProducts: ScoredProduct[] = [];
    
    for (const product of products) {
      const suitability = this.calculateSuitabilityScore(product, clientProfile);
      
      if (!suitability.isEligible) {
        console.log(`[SCORING] Excluded: ${product.name} - ${suitability.exclusionReason}`);
        continue;
      }
      
      const upside = this.calculateUpsideScore(product);
      const finalScore = this.calculateFinalScore(suitability, upside, mode);
      
      scoredProducts.push({
        ...product,
        suitability,
        upside,
        finalScore,
        ranking: 0,
      });
    }
    
    scoredProducts.sort((a, b) => b.finalScore.total - a.finalScore.total);
    scoredProducts.forEach((p, idx) => p.ranking = idx + 1);
    
    return scoredProducts;
  }

  registerOverride(override: Omit<AgentOverride, 'overrideId' | 'timestamp'>): AgentOverride {
    const fullOverride: AgentOverride = {
      ...override,
      overrideId: `ovr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    
    this.overrides.push(fullOverride);
    console.log(`[AUDIT] Override registered: ${fullOverride.overrideType} by agent ${fullOverride.agentId}`);
    
    return fullOverride;
  }

  getOverridesForClient(clientId: string): AgentOverride[] {
    return this.overrides.filter(o => o.clientId === clientId);
  }

  createAuditLog(params: Omit<RecommendationAuditLog, 'logId' | 'timestamp'>): RecommendationAuditLog {
    const log: RecommendationAuditLog = {
      ...params,
      logId: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    
    this.auditLogs.push(log);
    console.log(`[AUDIT] Recommendation logged: ${log.mode} mode, ${log.productsRecommended} products for client ${log.clientId}`);
    
    return log;
  }

  getAuditLogs(filters?: { clientId?: string; agentId?: string; startDate?: Date; endDate?: Date }): RecommendationAuditLog[] {
    let logs = this.auditLogs;
    
    if (filters?.clientId) {
      logs = logs.filter(l => l.clientId === filters.clientId);
    }
    if (filters?.agentId) {
      logs = logs.filter(l => l.agentId === filters.agentId);
    }
    if (filters?.startDate) {
      logs = logs.filter(l => l.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      logs = logs.filter(l => l.timestamp <= filters.endDate!);
    }
    
    return logs;
  }

  activateKillSwitch(reason: string): void {
    this.killSwitchActive = true;
    this.killSwitchReason = reason;
    console.log(`[KILL SWITCH] Activated: ${reason}`);
  }

  deactivateKillSwitch(): void {
    this.killSwitchActive = false;
    this.killSwitchReason = undefined;
    console.log(`[KILL SWITCH] Deactivated`);
  }

  isKillSwitchActive(): boolean {
    return this.killSwitchActive;
  }

  getKillSwitchStatus(): { active: boolean; reason?: string } {
    return {
      active: this.killSwitchActive,
      reason: this.killSwitchReason,
    };
  }

  compareWithBalanced(
    growthOptimizedProducts: ScoredProduct[],
    balancedProducts: ScoredProduct[]
  ): { rankingDifference: number; allocationDifference: Record<UnifiedProductType, number> } {
    const growthRankings = new Map(growthOptimizedProducts.map(p => [p.product_id, p.ranking]));
    const balancedRankings = new Map(balancedProducts.map(p => [p.product_id, p.ranking]));
    
    let totalDifference = 0;
    let count = 0;
    
    for (const [productId, growthRank] of growthRankings) {
      const balancedRank = balancedRankings.get(productId);
      if (balancedRank !== undefined) {
        totalDifference += Math.abs(growthRank - balancedRank);
        count++;
      }
    }
    
    const rankingDifference = count > 0 ? totalDifference / count : 0;
    
    const growthAllocation: Record<string, number> = {};
    const balancedAllocation: Record<string, number> = {};
    
    for (const p of growthOptimizedProducts.slice(0, 10)) {
      growthAllocation[p.product_type] = (growthAllocation[p.product_type] || 0) + 1;
    }
    for (const p of balancedProducts.slice(0, 10)) {
      balancedAllocation[p.product_type] = (balancedAllocation[p.product_type] || 0) + 1;
    }
    
    const allProductTypes = new Set([...Object.keys(growthAllocation), ...Object.keys(balancedAllocation)]);
    const allocationDifference: Record<UnifiedProductType, number> = {} as any;
    
    for (const type of allProductTypes) {
      allocationDifference[type as UnifiedProductType] = 
        ((growthAllocation[type] || 0) - (balancedAllocation[type] || 0)) * 10;
    }
    
    return { rankingDifference, allocationDifference };
  }
}

export const profitOptimizedScoringEngine = new ProfitOptimizedScoringEngine();
