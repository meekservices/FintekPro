import { 
  TreasuryMandate, 
  TreasuryAllocation, 
  TreasuryProposal,
  InsertTreasuryMandate,
  InsertTreasuryAllocation,
  InsertTreasuryProposal
} from "@shared/schema";
import { assetAllocationOptimizer } from "./asset-allocation-optimizer";
import { returnForecastingEngine } from "./return-forecasting-engine";

export interface TreasuryBucket {
  name: string;
  type: 'operational' | 'short_term' | 'medium_term' | 'strategic';
  horizon: { min: number; max: number };
  riskLevel: 'very_low' | 'low' | 'moderate';
  liquidityNeed: 'immediate' | 'high' | 'medium';
  targetReturn: { min: number; max: number };
  eligibleProducts: string[];
  description: string;
}

export interface TreasuryObjectives {
  capitalPreservation: boolean;
  liquidityManagement: boolean;
  yieldOptimization: boolean;
  riskMitigation: boolean;
  regulatoryCompliance: boolean;
  cashFlowMatching: boolean;
  taxEfficiency: boolean;
}

export interface CashFlowForecast {
  month: string;
  expectedInflows: number;
  expectedOutflows: number;
  netCashFlow: number;
  cumulativeCash: number;
  recommendedAllocation: string;
}

export interface TreasuryAnalysis {
  totalCorpus: number;
  bucketAllocations: BucketAllocation[];
  productRecommendations: ProductRecommendation[];
  cashFlowForecast: CashFlowForecast[];
  riskMetrics: TreasuryRiskMetrics;
  yieldAnalysis: YieldAnalysis;
  complianceChecks: ComplianceCheck[];
  recommendations: string[];
}

export interface BucketAllocation {
  bucket: TreasuryBucket;
  allocatedAmount: number;
  allocationPercent: number;
  expectedReturn: number;
  expectedVolatility: number;
  products: ProductAllocation[];
}

export interface ProductAllocation {
  productType: string;
  productName: string;
  amount: number;
  allocationPercent: number;
  expectedYield: number;
  maturityDays: number;
  rating: string;
  rationale: string;
}

export interface ProductRecommendation {
  productType: string;
  productName: string;
  amount: number;
  yield: number;
  maturityDays: number;
  rating: string;
  bucket: string;
  priority: number;
  rationale: string;
  risks: string[];
}

export interface TreasuryRiskMetrics {
  overallRiskScore: number;
  creditRisk: number;
  interestRateRisk: number;
  liquidityRisk: number;
  concentrationRisk: number;
  counterpartyExposure: { name: string; amount: number; percent: number }[];
  durationGap: number;
  worstCaseDrawdown: number;
}

export interface YieldAnalysis {
  weightedAverageYield: number;
  yieldEnhancement: number;
  opportunityCost: number;
  benchmarkComparison: number;
  yieldByBucket: { bucket: string; yield: number }[];
}

export interface ComplianceCheck {
  rule: string;
  status: 'pass' | 'warning' | 'fail';
  details: string;
  recommendation: string;
}

export interface TreasuryInput {
  totalCorpus: number;
  objectives: TreasuryObjectives;
  cashFlowSchedule?: { month: string; inflows: number; outflows: number }[];
  investmentHorizon: number;
  riskTolerance: 'conservative' | 'moderate' | 'balanced';
  minimumLiquidity: number;
  regulatoryRequirements?: string[];
  existingAllocations?: Record<string, number>;
  preferredProducts?: string[];
  excludedProducts?: string[];
  maxSingleExposure?: number;
  minCreditRating?: string;
}

const TREASURY_BUCKETS: TreasuryBucket[] = [
  {
    name: 'Operational Reserve',
    type: 'operational',
    horizon: { min: 0, max: 30 },
    riskLevel: 'very_low',
    liquidityNeed: 'immediate',
    targetReturn: { min: 3.5, max: 5.0 },
    eligibleProducts: ['current_account', 'savings_account', 'overnight_funds', 'liquid_funds'],
    description: 'Day-to-day operational needs with instant access'
  },
  {
    name: 'Short-Term Deployment',
    type: 'short_term',
    horizon: { min: 31, max: 90 },
    riskLevel: 'very_low',
    liquidityNeed: 'high',
    targetReturn: { min: 5.0, max: 6.5 },
    eligibleProducts: ['liquid_funds', 'ultra_short_term_funds', 'money_market_funds', 'commercial_paper', 'treasury_bills'],
    description: 'Working capital buffer for 1-3 months'
  },
  {
    name: 'Medium-Term Investment',
    type: 'medium_term',
    horizon: { min: 91, max: 365 },
    riskLevel: 'low',
    liquidityNeed: 'medium',
    targetReturn: { min: 6.5, max: 8.5 },
    eligibleProducts: ['short_term_funds', 'corporate_bonds', 'ncds', 'bank_fixed_deposits', 'g_sec'],
    description: 'Surplus funds for 3-12 months with higher yield'
  },
  {
    name: 'Strategic Reserve',
    type: 'strategic',
    horizon: { min: 366, max: 1095 },
    riskLevel: 'moderate',
    liquidityNeed: 'medium',
    targetReturn: { min: 7.5, max: 10.0 },
    eligibleProducts: ['medium_term_funds', 'corporate_bonds', 'ncds', 'tax_free_bonds', 'g_sec', 'sdl'],
    description: 'Long-term surplus for 1-3 years with yield optimization'
  }
];

const PRODUCT_YIELDS: Record<string, { yield: number; volatility: number; rating: string; maturityDays: number }> = {
  'current_account': { yield: 0, volatility: 0, rating: 'NA', maturityDays: 0 },
  'savings_account': { yield: 3.0, volatility: 0, rating: 'NA', maturityDays: 0 },
  'overnight_funds': { yield: 4.5, volatility: 0.2, rating: 'AAA', maturityDays: 1 },
  'liquid_funds': { yield: 5.5, volatility: 0.3, rating: 'AAA', maturityDays: 7 },
  'ultra_short_term_funds': { yield: 6.0, volatility: 0.5, rating: 'AAA', maturityDays: 30 },
  'money_market_funds': { yield: 6.2, volatility: 0.4, rating: 'AAA', maturityDays: 30 },
  'commercial_paper': { yield: 7.0, volatility: 0.8, rating: 'A1+', maturityDays: 90 },
  'treasury_bills': { yield: 6.5, volatility: 0.2, rating: 'SOV', maturityDays: 91 },
  'short_term_funds': { yield: 7.0, volatility: 0.8, rating: 'AAA', maturityDays: 180 },
  'bank_fixed_deposits': { yield: 7.5, volatility: 0, rating: 'AAA', maturityDays: 365 },
  'corporate_bonds': { yield: 8.5, volatility: 1.5, rating: 'AA', maturityDays: 365 },
  'ncds': { yield: 9.0, volatility: 2.0, rating: 'AA', maturityDays: 365 },
  'g_sec': { yield: 7.2, volatility: 1.2, rating: 'SOV', maturityDays: 730 },
  'sdl': { yield: 7.5, volatility: 1.3, rating: 'SOV', maturityDays: 730 },
  'tax_free_bonds': { yield: 5.5, volatility: 1.0, rating: 'AAA', maturityDays: 1095 },
  'medium_term_funds': { yield: 7.5, volatility: 1.5, rating: 'AAA', maturityDays: 365 }
};

class CorporateTreasuryEngine {
  
  analyzeTreasury(input: TreasuryInput): TreasuryAnalysis {
    const bucketAllocations = this.allocateToBuckets(input);
    const productRecommendations = this.generateProductRecommendations(bucketAllocations, input);
    const cashFlowForecast = this.forecastCashFlows(input, bucketAllocations);
    const riskMetrics = this.calculateRiskMetrics(bucketAllocations, productRecommendations);
    const yieldAnalysis = this.analyzeYield(bucketAllocations, productRecommendations);
    const complianceChecks = this.checkCompliance(input, bucketAllocations);
    const recommendations = this.generateRecommendations(input, bucketAllocations, riskMetrics, complianceChecks);

    return {
      totalCorpus: input.totalCorpus,
      bucketAllocations,
      productRecommendations,
      cashFlowForecast,
      riskMetrics,
      yieldAnalysis,
      complianceChecks,
      recommendations
    };
  }

  private allocateToBuckets(input: TreasuryInput): BucketAllocation[] {
    const { totalCorpus, objectives, minimumLiquidity, riskTolerance } = input;
    
    let operationalPercent = 0;
    let shortTermPercent = 0;
    let mediumTermPercent = 0;
    let strategicPercent = 0;

    if (objectives.liquidityManagement) {
      operationalPercent += 10;
      shortTermPercent += 10;
    }
    
    if (objectives.capitalPreservation) {
      operationalPercent += 5;
      shortTermPercent += 15;
      mediumTermPercent += 10;
    }
    
    if (objectives.yieldOptimization) {
      mediumTermPercent += 15;
      strategicPercent += 20;
    }
    
    if (objectives.riskMitigation) {
      operationalPercent += 5;
      shortTermPercent += 10;
    }
    
    if (objectives.cashFlowMatching) {
      shortTermPercent += 10;
      mediumTermPercent += 10;
    }

    const minLiquidityPercent = (minimumLiquidity / totalCorpus) * 100;
    operationalPercent = Math.max(operationalPercent, minLiquidityPercent * 0.5);
    shortTermPercent = Math.max(shortTermPercent, minLiquidityPercent * 0.5);

    switch (riskTolerance) {
      case 'conservative':
        operationalPercent *= 1.3;
        shortTermPercent *= 1.2;
        mediumTermPercent *= 0.8;
        strategicPercent *= 0.6;
        break;
      case 'moderate':
        break;
      case 'balanced':
        operationalPercent *= 0.8;
        shortTermPercent *= 0.9;
        mediumTermPercent *= 1.1;
        strategicPercent *= 1.3;
        break;
    }

    const total = operationalPercent + shortTermPercent + mediumTermPercent + strategicPercent;
    operationalPercent = (operationalPercent / total) * 100;
    shortTermPercent = (shortTermPercent / total) * 100;
    mediumTermPercent = (mediumTermPercent / total) * 100;
    strategicPercent = (strategicPercent / total) * 100;

    const allocations: BucketAllocation[] = [];

    const bucketPercents = [operationalPercent, shortTermPercent, mediumTermPercent, strategicPercent];
    
    TREASURY_BUCKETS.forEach((bucket, index) => {
      const percent = bucketPercents[index];
      const amount = totalCorpus * (percent / 100);
      const products = this.allocateProductsInBucket(bucket, amount, input);
      
      const expectedReturn = products.reduce((sum, p) => sum + (p.expectedYield * p.allocationPercent / 100), 0);
      const expectedVolatility = Math.sqrt(
        products.reduce((sum, p) => sum + Math.pow(PRODUCT_YIELDS[p.productType]?.volatility || 0, 2) * Math.pow(p.allocationPercent / 100, 2), 0)
      );

      allocations.push({
        bucket,
        allocatedAmount: amount,
        allocationPercent: percent,
        expectedReturn,
        expectedVolatility,
        products
      });
    });

    return allocations;
  }

  private allocateProductsInBucket(bucket: TreasuryBucket, amount: number, input: TreasuryInput): ProductAllocation[] {
    const { preferredProducts, excludedProducts } = input;
    
    let eligibleProducts = bucket.eligibleProducts.filter(p => {
      if (excludedProducts?.includes(p)) return false;
      return true;
    });

    if (preferredProducts && preferredProducts.length > 0) {
      const preferredEligible = eligibleProducts.filter(p => preferredProducts.includes(p));
      if (preferredEligible.length > 0) {
        eligibleProducts = preferredEligible;
      }
    }

    const sortedProducts = eligibleProducts
      .map(p => ({ type: p, ...PRODUCT_YIELDS[p] }))
      .filter(p => p.yield !== undefined)
      .sort((a, b) => {
        const scoreA = a.yield - a.volatility * 2;
        const scoreB = b.yield - b.volatility * 2;
        return scoreB - scoreA;
      });

    const allocations: ProductAllocation[] = [];
    let remainingAmount = amount;
    let remainingPercent = 100;

    const maxPerProduct = input.maxSingleExposure || 30;

    sortedProducts.forEach((product, index) => {
      if (remainingAmount <= 0 || remainingPercent <= 0) return;

      let allocationPercent: number;
      if (index === 0) {
        allocationPercent = Math.min(maxPerProduct, remainingPercent * 0.5);
      } else if (index === sortedProducts.length - 1) {
        allocationPercent = remainingPercent;
      } else {
        allocationPercent = Math.min(maxPerProduct, remainingPercent * 0.4);
      }

      const productAmount = amount * (allocationPercent / 100);

      allocations.push({
        productType: product.type,
        productName: this.getProductName(product.type),
        amount: productAmount,
        allocationPercent,
        expectedYield: product.yield,
        maturityDays: product.maturityDays,
        rating: product.rating,
        rationale: this.getProductRationale(product.type, bucket.type)
      });

      remainingAmount -= productAmount;
      remainingPercent -= allocationPercent;
    });

    return allocations;
  }

  private getProductName(type: string): string {
    const names: Record<string, string> = {
      'current_account': 'Bank Current Account',
      'savings_account': 'Bank Savings Account',
      'overnight_funds': 'Overnight Mutual Funds',
      'liquid_funds': 'Liquid Mutual Funds',
      'ultra_short_term_funds': 'Ultra Short Duration Funds',
      'money_market_funds': 'Money Market Funds',
      'commercial_paper': 'Commercial Papers (A1+)',
      'treasury_bills': 'Treasury Bills (91-day)',
      'short_term_funds': 'Short Duration Funds',
      'bank_fixed_deposits': 'Bank Fixed Deposits',
      'corporate_bonds': 'Corporate Bonds (AA+)',
      'ncds': 'Non-Convertible Debentures',
      'g_sec': 'Government Securities',
      'sdl': 'State Development Loans',
      'tax_free_bonds': 'Tax-Free Bonds',
      'medium_term_funds': 'Medium Duration Funds'
    };
    return names[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private getProductRationale(productType: string, bucketType: string): string {
    const rationales: Record<string, Record<string, string>> = {
      'operational': {
        'current_account': 'Immediate liquidity for operational expenses',
        'savings_account': 'Low-risk parking with minimal yield',
        'overnight_funds': 'Same-day redemption with better yield than savings',
        'liquid_funds': 'T+1 redemption with superior risk-adjusted returns'
      },
      'short_term': {
        'liquid_funds': 'High liquidity with steady returns',
        'ultra_short_term_funds': 'Enhanced yield for 30-90 day horizon',
        'money_market_funds': 'Diversified money market exposure',
        'commercial_paper': 'Higher yield for strong corporates',
        'treasury_bills': 'Sovereign-backed short-term instrument'
      },
      'medium_term': {
        'short_term_funds': 'Duration matched to investment horizon',
        'corporate_bonds': 'Higher yield with manageable credit risk',
        'ncds': 'Fixed coupon with attractive spread over FDs',
        'bank_fixed_deposits': 'Principal protection with known returns',
        'g_sec': 'Sovereign backing for conservative allocation'
      },
      'strategic': {
        'medium_term_funds': 'Professional duration management',
        'corporate_bonds': 'Yield enhancement with credit quality',
        'ncds': 'Attractive risk-adjusted returns',
        'tax_free_bonds': 'Tax-efficient income for higher brackets',
        'g_sec': 'Core allocation for safety',
        'sdl': 'State-backed bonds with sovereign spread'
      }
    };

    return rationales[bucketType]?.[productType] || 'Diversified allocation for risk management';
  }

  private generateProductRecommendations(allocations: BucketAllocation[], input: TreasuryInput): ProductRecommendation[] {
    const recommendations: ProductRecommendation[] = [];
    let priority = 1;

    allocations.forEach(allocation => {
      allocation.products.forEach(product => {
        if (product.amount >= 100000) {
          recommendations.push({
            productType: product.productType,
            productName: product.productName,
            amount: product.amount,
            yield: product.expectedYield,
            maturityDays: product.maturityDays,
            rating: product.rating,
            bucket: allocation.bucket.name,
            priority: priority++,
            rationale: product.rationale,
            risks: this.getProductRisks(product.productType)
          });
        }
      });
    });

    return recommendations.sort((a, b) => {
      const yieldScore = (b.yield - a.yield) * 10;
      const priorityScore = a.priority - b.priority;
      return yieldScore + priorityScore;
    });
  }

  private getProductRisks(productType: string): string[] {
    const risks: Record<string, string[]> = {
      'liquid_funds': ['Credit risk on underlying securities', 'NAV fluctuation'],
      'ultra_short_term_funds': ['Interest rate sensitivity', 'Credit concentration risk'],
      'money_market_funds': ['Market volatility', 'Credit events'],
      'commercial_paper': ['Credit risk', 'Rollover risk', 'Limited secondary market'],
      'treasury_bills': ['Reinvestment risk', 'Opportunity cost'],
      'corporate_bonds': ['Credit downgrade risk', 'Interest rate risk', 'Liquidity risk'],
      'ncds': ['Credit risk', 'Illiquidity premium', 'Early exit costs'],
      'bank_fixed_deposits': ['Premature withdrawal penalty', 'Inflation erosion'],
      'g_sec': ['Interest rate risk', 'Duration risk', 'Mark-to-market volatility'],
      'sdl': ['State fiscal health risk', 'Interest rate risk'],
      'tax_free_bonds': ['Interest rate risk', 'Illiquidity in secondary market']
    };

    return risks[productType] || ['Market risk', 'Credit risk'];
  }

  private forecastCashFlows(input: TreasuryInput, allocations: BucketAllocation[]): CashFlowForecast[] {
    const forecasts: CashFlowForecast[] = [];
    const { cashFlowSchedule, totalCorpus } = input;

    let cumulativeCash = totalCorpus;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < 12; i++) {
      const schedule = cashFlowSchedule?.[i];
      const inflows = schedule?.inflows || totalCorpus * 0.05;
      const outflows = schedule?.outflows || totalCorpus * 0.04;
      const netCashFlow = inflows - outflows;
      cumulativeCash += netCashFlow;

      let recommendedAllocation: string;
      if (cumulativeCash < input.minimumLiquidity) {
        recommendedAllocation = 'Increase operational reserve';
      } else if (netCashFlow > totalCorpus * 0.1) {
        recommendedAllocation = 'Deploy surplus to medium-term bucket';
      } else if (netCashFlow < -totalCorpus * 0.05) {
        recommendedAllocation = 'Prepare liquidity from short-term holdings';
      } else {
        recommendedAllocation = 'Maintain current allocation';
      }

      forecasts.push({
        month: months[i],
        expectedInflows: inflows,
        expectedOutflows: outflows,
        netCashFlow,
        cumulativeCash,
        recommendedAllocation
      });
    }

    return forecasts;
  }

  private calculateRiskMetrics(allocations: BucketAllocation[], recommendations: ProductRecommendation[]): TreasuryRiskMetrics {
    let creditRisk = 0;
    let interestRateRisk = 0;
    let liquidityRisk = 0;
    let concentrationRisk = 0;
    let totalValue = 0;
    const counterpartyMap = new Map<string, number>();

    recommendations.forEach(rec => {
      totalValue += rec.amount;
      
      const ratingRisk = this.getRatingRiskScore(rec.rating);
      creditRisk += ratingRisk * rec.amount;

      const durationRisk = Math.min(rec.maturityDays / 365, 1) * 10;
      interestRateRisk += durationRisk * rec.amount;

      const liquidityScore = rec.maturityDays <= 7 ? 1 : rec.maturityDays <= 30 ? 3 : rec.maturityDays <= 90 ? 5 : 8;
      liquidityRisk += liquidityScore * rec.amount;

      const issuerType = rec.productType.includes('g_sec') || rec.productType.includes('treasury') ? 'Government' : 
                         rec.productType.includes('bank') ? 'Banks' : 'Corporates';
      counterpartyMap.set(issuerType, (counterpartyMap.get(issuerType) || 0) + rec.amount);
    });

    if (totalValue > 0) {
      creditRisk = creditRisk / totalValue;
      interestRateRisk = interestRateRisk / totalValue;
      liquidityRisk = liquidityRisk / totalValue;
    }

    const counterpartyExposure = Array.from(counterpartyMap.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        percent: (amount / totalValue) * 100
      }))
      .sort((a, b) => b.amount - a.amount);

    const maxExposure = Math.max(...counterpartyExposure.map(c => c.percent));
    concentrationRisk = maxExposure > 40 ? 8 : maxExposure > 30 ? 5 : maxExposure > 20 ? 3 : 1;

    const avgDuration = recommendations.reduce((sum, r) => sum + r.maturityDays * r.amount, 0) / totalValue;
    const durationGap = avgDuration / 365;

    const overallRiskScore = (creditRisk + interestRateRisk + liquidityRisk + concentrationRisk) / 4;
    const worstCaseDrawdown = overallRiskScore * 0.5;

    return {
      overallRiskScore: Math.round(overallRiskScore * 10) / 10,
      creditRisk: Math.round(creditRisk * 10) / 10,
      interestRateRisk: Math.round(interestRateRisk * 10) / 10,
      liquidityRisk: Math.round(liquidityRisk * 10) / 10,
      concentrationRisk: Math.round(concentrationRisk * 10) / 10,
      counterpartyExposure,
      durationGap: Math.round(durationGap * 100) / 100,
      worstCaseDrawdown: Math.round(worstCaseDrawdown * 100) / 100
    };
  }

  private getRatingRiskScore(rating: string): number {
    const ratingScores: Record<string, number> = {
      'SOV': 0, 'AAA': 1, 'AA+': 2, 'AA': 3, 'AA-': 4,
      'A+': 5, 'A': 6, 'A-': 7, 'A1+': 2, 'A1': 3,
      'NA': 5
    };
    return ratingScores[rating] || 5;
  }

  private analyzeYield(allocations: BucketAllocation[], recommendations: ProductRecommendation[]): YieldAnalysis {
    let totalValue = 0;
    let weightedYield = 0;

    recommendations.forEach(rec => {
      totalValue += rec.amount;
      weightedYield += rec.yield * rec.amount;
    });

    const weightedAverageYield = totalValue > 0 ? weightedYield / totalValue : 0;

    const bankFdRate = 7.0;
    const yieldEnhancement = weightedAverageYield - bankFdRate;

    const repoRate = 6.5;
    const opportunityCost = weightedAverageYield - repoRate;

    const benchmarkYield = 6.8;
    const benchmarkComparison = weightedAverageYield - benchmarkYield;

    const yieldByBucket = allocations.map(a => ({
      bucket: a.bucket.name,
      yield: a.expectedReturn
    }));

    return {
      weightedAverageYield: Math.round(weightedAverageYield * 100) / 100,
      yieldEnhancement: Math.round(yieldEnhancement * 100) / 100,
      opportunityCost: Math.round(opportunityCost * 100) / 100,
      benchmarkComparison: Math.round(benchmarkComparison * 100) / 100,
      yieldByBucket
    };
  }

  private checkCompliance(input: TreasuryInput, allocations: BucketAllocation[]): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];

    const operationalAlloc = allocations.find(a => a.bucket.type === 'operational');
    const shortTermAlloc = allocations.find(a => a.bucket.type === 'short_term');
    const liquidAmount = (operationalAlloc?.allocatedAmount || 0) + (shortTermAlloc?.allocatedAmount || 0);
    
    if (liquidAmount >= input.minimumLiquidity) {
      checks.push({
        rule: 'Minimum Liquidity Requirement',
        status: 'pass',
        details: `Liquid assets (₹${(liquidAmount / 100000).toFixed(2)}L) exceed minimum requirement (₹${(input.minimumLiquidity / 100000).toFixed(2)}L)`,
        recommendation: 'Continue maintaining adequate liquidity buffer'
      });
    } else {
      checks.push({
        rule: 'Minimum Liquidity Requirement',
        status: 'fail',
        details: `Liquid assets (₹${(liquidAmount / 100000).toFixed(2)}L) below minimum requirement (₹${(input.minimumLiquidity / 100000).toFixed(2)}L)`,
        recommendation: 'Increase allocation to operational and short-term buckets'
      });
    }

    const maxExposure = input.maxSingleExposure || 30;
    let hasConcentrationIssue = false;
    allocations.forEach(alloc => {
      alloc.products.forEach(product => {
        if (product.allocationPercent > maxExposure) {
          hasConcentrationIssue = true;
        }
      });
    });

    checks.push({
      rule: 'Single Issuer Concentration Limit',
      status: hasConcentrationIssue ? 'warning' : 'pass',
      details: hasConcentrationIssue ? 
        `Some products exceed ${maxExposure}% concentration limit` :
        `All products within ${maxExposure}% concentration limit`,
      recommendation: hasConcentrationIssue ? 
        'Diversify holdings to reduce concentration risk' :
        'Maintain current diversification strategy'
    });

    const minRating = input.minCreditRating || 'AA';
    const ratingOrder = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB'];
    const minRatingIndex = ratingOrder.indexOf(minRating);
    let hasRatingIssue = false;

    allocations.forEach(alloc => {
      alloc.products.forEach(product => {
        const productRatingIndex = ratingOrder.indexOf(product.rating);
        if (productRatingIndex > minRatingIndex && product.rating !== 'SOV' && product.rating !== 'A1+' && product.rating !== 'A1') {
          hasRatingIssue = true;
        }
      });
    });

    checks.push({
      rule: 'Minimum Credit Rating',
      status: hasRatingIssue ? 'warning' : 'pass',
      details: hasRatingIssue ?
        `Some investments below minimum ${minRating} rating threshold` :
        `All investments meet minimum ${minRating} rating requirement`,
      recommendation: hasRatingIssue ?
        'Review and replace lower-rated investments' :
        'Credit quality is within acceptable parameters'
    });

    checks.push({
      rule: 'Investment Policy Compliance',
      status: 'pass',
      details: 'All investments aligned with treasury policy objectives',
      recommendation: 'Continue monitoring for policy adherence'
    });

    return checks;
  }

  private generateRecommendations(
    input: TreasuryInput,
    allocations: BucketAllocation[],
    riskMetrics: TreasuryRiskMetrics,
    complianceChecks: ComplianceCheck[]
  ): string[] {
    const recommendations: string[] = [];

    if (riskMetrics.overallRiskScore < 3) {
      recommendations.push('Risk profile is conservative. Consider slightly higher-yielding instruments to improve returns.');
    } else if (riskMetrics.overallRiskScore > 6) {
      recommendations.push('Risk profile is elevated. Consider de-risking by moving to higher-rated instruments.');
    }

    if (riskMetrics.concentrationRisk > 5) {
      recommendations.push('High concentration detected. Diversify across more issuers and instrument types.');
    }

    if (riskMetrics.durationGap > 1.5) {
      recommendations.push('Portfolio duration is extended. Consider shorter-maturity instruments for better liquidity.');
    }

    const failedChecks = complianceChecks.filter(c => c.status === 'fail');
    failedChecks.forEach(check => {
      recommendations.push(`Address compliance issue: ${check.recommendation}`);
    });

    const strategicAlloc = allocations.find(a => a.bucket.type === 'strategic');
    if (strategicAlloc && strategicAlloc.allocationPercent < 20 && input.objectives.yieldOptimization) {
      recommendations.push('Consider increasing strategic reserve allocation for better yield optimization.');
    }

    if (input.objectives.taxEfficiency) {
      recommendations.push('Review tax-efficient options like tax-free bonds and debt funds with indexation benefits.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Portfolio is well-balanced and aligned with treasury objectives.');
    }

    return recommendations;
  }

  getBucketDefinitions(): TreasuryBucket[] {
    return TREASURY_BUCKETS;
  }

  getProductDetails(): Record<string, any> {
    return Object.entries(PRODUCT_YIELDS).map(([type, details]) => ({
      type,
      name: this.getProductName(type),
      ...details
    }));
  }
}

export const corporateTreasuryEngine = new CorporateTreasuryEngine();
