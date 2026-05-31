// @ts-nocheck
import { db } from "../db";
import { 
  listedStocks, 
  mutualFunds,
  mutualFundMetrics,
  governmentSecurities, 
  corporateBonds,
  reits,
  invits,
  ipoCompanies,
  preIpoCompanies,
  aifMaster,
  userProfiles
} from "@shared/schema";
import { eq, and, desc, gte, lte, inArray, isNotNull, or, ilike, sql } from "drizzle-orm";
import { urcaeEngine } from "./allocation";
import { aiGovernanceEngine } from "./ai-governance";
import { unifiedAIRecommendationEngine } from "./unified-ai-recommendation-engine";
import { aiService, getComplexAnalysisModel, isGpt52Available } from "./ai-service";
import { 
  InvestmentProduct, 
  UnifiedProductType, 
  ClientProfile, 
  MarketContext,
  EvaluatedProduct,
  RecommendationBasket,
  BasketItem,
  RiskLevel,
  LiquidityLevel,
  InvestmentHorizon
} from "@shared/unified-investment-product";
import { 
  normalizeProduct, 
  normalizeProducts,
  productAdapters 
} from "./product-adapters";
import {
  getCachedRationale,
  cacheRationale,
  getCachedMarketDataBatch,
  cacheMarketData,
  getCachedFundamentalsBatch
} from "./investment-cache-service";

interface OrchestratorConfig {
  maxProductsPerType: number;
  cacheEnabled: boolean;
  aiRationaleEnabled: boolean;
}

interface CachedRationale {
  rationale: string;
  pros: string[];
  cons: string[];
  timestamp: Date;
}

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

const CLIENT_CATEGORY_MIN_INVESTMENT: Record<string, number> = {
  'retail': 0,
  'HNI': 2000000,
  'sHNI': 5000000,
  'bHNI': 25000000,
  'institutional': 100000000,
};

const PRODUCT_CLIENT_REQUIREMENTS: Record<UnifiedProductType, string[]> = {
  'STOCK': ['retail', 'HNI', 'sHNI', 'bHNI', 'institutional'],
  'MF': ['retail', 'HNI', 'sHNI', 'bHNI', 'institutional'],
  'BOND': ['retail', 'HNI', 'sHNI', 'bHNI', 'institutional'],
  'REIT': ['retail', 'HNI', 'sHNI', 'bHNI', 'institutional'],
  'INVIT': ['retail', 'HNI', 'sHNI', 'bHNI', 'institutional'],
  'IPO': ['retail', 'HNI', 'sHNI', 'bHNI', 'institutional'],
  'UNLISTED': ['HNI', 'sHNI', 'bHNI'],
  'AIF': ['sHNI', 'bHNI'],
  'PMS': ['sHNI', 'bHNI'],
  'MLD': ['HNI', 'sHNI', 'bHNI'],
};

const AI_RATIONALE_TTL: Record<UnifiedProductType, number> = {
  'STOCK': 4 * 60 * 60 * 1000,
  'MF': 4 * 60 * 60 * 1000,
  'BOND': 12 * 60 * 60 * 1000,
  'REIT': 4 * 60 * 60 * 1000,
  'INVIT': 4 * 60 * 60 * 1000,
  'IPO': 1 * 60 * 60 * 1000,
  'UNLISTED': 24 * 60 * 60 * 1000,
  'AIF': 24 * 60 * 60 * 1000,
  'PMS': 24 * 60 * 60 * 1000,
  'MLD': 24 * 60 * 60 * 1000,
};

class AIInvestmentOrchestratorService {
  private rationaleCache = new Map<string, CachedRationale>();
  private productCache = new Map<UnifiedProductType, { products: InvestmentProduct[], timestamp: Date }>();
  private readonly PRODUCT_CACHE_TTL = 15 * 60 * 1000;
  
  private config: OrchestratorConfig = {
    maxProductsPerType: 50,
    cacheEnabled: true,
    aiRationaleEnabled: true,
  };

  constructor() {
    const status = unifiedAIRecommendationEngine.getStatus();
    console.log(`✅ AI Investment Orchestrator initialized via Unified Engine (primary: ${status.primary})`);
  }

  async generateRecommendationBasket(
    clientProfile: ClientProfile,
    investmentAmount: number,
    productTypes?: UnifiedProductType[],
    marketContext?: MarketContext
  ): Promise<RecommendationBasket> {
    const context = marketContext || this.getDefaultMarketContext();
    const eligibleTypes = productTypes || this.getEligibleProductTypes(clientProfile);
    
    const allProducts = await this.fetchAllProducts(eligibleTypes);
    
    const filteredProducts = this.applyEligibilityFilters(allProducts, clientProfile);
    
    const evaluatedProducts = this.evaluateProducts(filteredProducts, clientProfile, context);
    
    // 24.1 URCAE Integration: Determine mathematical Target Allocation mix
    const urcaeTarget = await urcaeEngine.generateTargetAllocation({
      user_profile: {
        user_id: clientProfile.client_id,
        risk_profile: clientProfile.risk_category as any,
        investment_horizon: clientProfile.investment_horizon as any,
        liquidity_needs: clientProfile.liquidity_needs as any
      },
      market_state: {
        volatility: context.market_volatility || 0.15,
        interest_rates: 0.05,
        macro_regime: context.market_regime as any
      }
    });

    // Map URCAE Asset Weights to Product Types for Optimizer
    const structuralTarget: Record<string, number> = {};
    urcaeTarget.target_allocation.forEach((a: any) => {
       // Deep mapping from URCAE asset classes to Unified Product Types
       if (a.asset_class === 'equity_largecap') structuralTarget['STOCK'] = (structuralTarget['STOCK'] || 0) + (a.weight * 100);
       if (a.asset_class === 'equity_midcap') structuralTarget['MF'] = (structuralTarget['MF'] || 0) + (a.weight * 100);
       if (a.asset_class === 'bonds') structuralTarget['BOND'] = (structuralTarget['BOND'] || 0) + (a.weight * 100);
       if (a.asset_class === 'cash') structuralTarget['MLD'] = (structuralTarget['MLD'] || 0) + (a.weight * 100);
    });

    const basket = await this.optimizeBasket(evaluatedProducts, clientProfile, investmentAmount, structuralTarget);

    // 24.2 AAGE Governance Gate: Validate final basket compliance
    const aageCheck = await aiGovernanceEngine.validateAndResolve({
      user_id: clientProfile.client_id,
      query: "Generate investment recommendation basket",
      ai_output: { recommendation: JSON.stringify(basket.products) },
      user_profile: { risk_profile: clientProfile.risk_category as any, investment_horizon: clientProfile.investment_horizon as any, kyc_status: "verified", user_segment: "retail" },
      trace_id: basket.basket_id
    });

    if (aageCheck.decision === "BLOCK") {
       throw new Error(`Governance Intercept: ${aageCheck.violations.map(v => v.message).join(", ")}`);
    }
    
    if (this.config.aiRationaleEnabled) {
      await this.enrichWithAIRationales(basket, clientProfile);
    }
    
    return basket;
  }

  private getEligibleProductTypes(clientProfile: ClientProfile): UnifiedProductType[] {
    const eligible: UnifiedProductType[] = [];
    
    for (const [type, allowedCategories] of Object.entries(PRODUCT_CLIENT_REQUIREMENTS)) {
      if (allowedCategories.includes(clientProfile.client_category)) {
        eligible.push(type as UnifiedProductType);
      }
    }
    
    return eligible;
  }

  private async fetchAllProducts(productTypes: UnifiedProductType[]): Promise<InvestmentProduct[]> {
    const allProducts: InvestmentProduct[] = [];
    
    const fetchPromises = productTypes.map(async (type) => {
      if (this.config.cacheEnabled) {
        const cached = this.productCache.get(type);
        if (cached && Date.now() - cached.timestamp.getTime() < this.PRODUCT_CACHE_TTL) {
          return cached.products;
        }
      }
      
      const products = await this.fetchProductsByType(type);
      
      if (this.config.cacheEnabled) {
        this.productCache.set(type, { products, timestamp: new Date() });
      }
      
      return products;
    });
    
    const results = await Promise.all(fetchPromises);
    results.forEach(products => allProducts.push(...products));
    
    return allProducts;
  }

  private async fetchProductsByType(type: UnifiedProductType): Promise<InvestmentProduct[]> {
    try {
      switch (type) {
        case 'STOCK':
          const stocks = await db.select().from(listedStocks)
            .where(isNotNull(listedStocks.currentPrice))
            .orderBy(desc(listedStocks.marketCapValue))
            .limit(this.config.maxProductsPerType);
          return normalizeProducts(stocks, 'STOCK');
          
        case 'MF':
          const fundsWithMetrics = await db.select({
            id: mutualFunds.id,
            schemeCode: mutualFunds.schemeCode,
            schemeName: mutualFunds.schemeName,
            fundHouse: mutualFunds.fundHouse,
            category: mutualFunds.category,
            schemeSubCategory: mutualFunds.schemeSubCategory,
            nav: mutualFunds.nav,
            aum: mutualFunds.aum,
            expenseRatio: mutualFunds.expenseRatio,
            riskLevel: mutualFunds.riskLevel,
            returns1y: sql<string>`COALESCE(${mutualFunds.returns1y}, ${mutualFundMetrics.return1y})`,
            returns3y: sql<string>`COALESCE(${mutualFunds.returns3y}, ${mutualFundMetrics.return3y})`,
            returns5y: sql<string>`COALESCE(${mutualFunds.returns5y}, ${mutualFundMetrics.return5y})`,
            crisilRating: mutualFunds.crisilRating,
            crisilPercentile: mutualFunds.crisilPercentile,
            crisilOverallScore: mutualFunds.crisilOverallScore,
            isin: mutualFunds.isin,
            planType: mutualFunds.planType,
            isPublished: mutualFunds.isPublished,
            lastUpdated: mutualFunds.lastUpdated,
            sharpeRatio: mutualFundMetrics.sharpeRatio,
            sortinoRatio: mutualFundMetrics.sortinoRatio,
            standardDeviation: mutualFundMetrics.standardDeviation,
            maxDrawdown: mutualFundMetrics.maxDrawdown,
            alpha: mutualFundMetrics.alpha,
            beta: mutualFundMetrics.beta,
            treynorRatio: mutualFundMetrics.treynorRatio,
            informationRatio: mutualFundMetrics.informationRatio,
          })
          .from(mutualFunds)
          .leftJoin(
            mutualFundMetrics,
            and(
              eq(mutualFunds.schemeCode, mutualFundMetrics.schemeCode),
              eq(mutualFundMetrics.fiscalYear, sql`(
                SELECT fiscal_year FROM mutual_fund_metrics m2
                WHERE m2.scheme_code = ${mutualFunds.schemeCode}
                ORDER BY calculated_at DESC LIMIT 1
              )`)
            )
          )
          .where(eq(mutualFunds.isPublished, true))
          .orderBy(desc(mutualFunds.crisilPercentile))
          .limit(this.config.maxProductsPerType);
          return normalizeProducts(fundsWithMetrics, 'MF');
          
        case 'BOND':
          const govBonds = await db.select().from(governmentSecurities)
            .where(eq(governmentSecurities.tradingStatus, 'active'))
            .limit(25);
          const corpBonds = await db.select().from(corporateBonds)
            .where(and(eq(corporateBonds.tradingStatus, 'active'), eq(corporateBonds.instrumentStatus, 'SELLABLE')))
            .limit(25);
          return [
            ...normalizeProducts(govBonds, 'BOND'),
            ...normalizeProducts(corpBonds, 'BOND'),
          ];
          
        case 'REIT':
          const reitProducts = await db.select().from(reits)
            .where(eq(reits.isActive, true))
            .limit(this.config.maxProductsPerType);
          return normalizeProducts(reitProducts, 'REIT');
          
        case 'INVIT':
          const invitProducts = await db.select().from(invits)
            .where(eq(invits.isActive, true))
            .limit(this.config.maxProductsPerType);
          return normalizeProducts(invitProducts, 'INVIT');
          
        case 'IPO':
          const ipos = await db.select().from(ipoCompanies)
            .where(or(
              eq(ipoCompanies.status, 'upcoming'),
              eq(ipoCompanies.status, 'ongoing')
            ))
            .limit(this.config.maxProductsPerType);
          return normalizeProducts(ipos, 'IPO');
          
        case 'UNLISTED':
          const unlisted = await db.select().from(preIpoCompanies)
            .where(eq(preIpoCompanies.isAvailableForInvestment, true))
            .limit(this.config.maxProductsPerType);
          return normalizeProducts(unlisted, 'UNLISTED');
          
        case 'AIF':
          const aifs = await db.select().from(aifMaster)
            .where(and(eq(aifMaster.fundStatus, 'active'), eq(aifMaster.isPublished, true)))
            .limit(this.config.maxProductsPerType);
          return normalizeProducts(aifs, 'AIF');
          
        case 'PMS':
        case 'MLD':
          return [];
          
        default:
          return [];
      }
    } catch (error) {
      console.error(`Error fetching ${type} products:`, error);
      return [];
    }
  }

  private applyEligibilityFilters(
    products: InvestmentProduct[], 
    clientProfile: ClientProfile
  ): InvestmentProduct[] {
    return products.filter(product => {
      if (!PRODUCT_CLIENT_REQUIREMENTS[product.product_type]?.includes(clientProfile.client_category)) {
        return false;
      }
      
      if (RISK_HIERARCHY[product.risk_level] > RISK_HIERARCHY[clientProfile.risk_category] + 1) {
        return false;
      }
      
      if (HORIZON_HIERARCHY[product.investment_horizon] > HORIZON_HIERARCHY[clientProfile.investment_horizon] + 1) {
        return false;
      }
      
      if (clientProfile.liquidity_needs === 'high' && LIQUIDITY_HIERARCHY[product.liquidity] < 3) {
        return false;
      }
      
      return true;
    });
  }

  private evaluateProducts(
    products: InvestmentProduct[],
    clientProfile: ClientProfile,
    marketContext: MarketContext
  ): EvaluatedProduct[] {
    return products.map(product => {
      const { score, breakdown } = this.calculateProductScore(product, clientProfile, marketContext);
      
      return {
        ...product,
        suitability_score: score,
        risk_adjusted_score: this.calculateRiskAdjustedScore(product, score),
        rationale_inputs: {
          score_breakdown: breakdown,
          key_factors: this.getKeyFactors(product, clientProfile),
          risk_factors: this.getRiskFactors(product),
          opportunity_factors: this.getOpportunityFactors(product, marketContext),
        },
      };
    });
  }

  private calculateProductScore(
    product: InvestmentProduct,
    clientProfile: ClientProfile,
    marketContext: MarketContext
  ): { score: number; breakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {};
    
    const riskDiff = Math.abs(
      RISK_HIERARCHY[product.risk_level] - RISK_HIERARCHY[clientProfile.risk_category]
    );
    breakdown.risk_alignment = Math.max(0, 25 - riskDiff * 10);
    
    const horizonDiff = Math.abs(
      HORIZON_HIERARCHY[product.investment_horizon] - HORIZON_HIERARCHY[clientProfile.investment_horizon]
    );
    breakdown.horizon_alignment = Math.max(0, 20 - horizonDiff * 5);
    
    const expectedReturn = (product.expected_return_band.min + product.expected_return_band.max) / 2;
    breakdown.return_potential = Math.min(20, expectedReturn);
    
    breakdown.liquidity_match = LIQUIDITY_HIERARCHY[product.liquidity] * 5;
    
    if (product.rating) {
      const ratingScore = this.getRatingScore(product.rating);
      breakdown.quality_rating = ratingScore;
    } else {
      breakdown.quality_rating = 10;
    }
    
    if (product.sector && marketContext.sector_momentum[product.sector]) {
      breakdown.sector_momentum = Math.min(10, marketContext.sector_momentum[product.sector] * 2);
    } else {
      breakdown.sector_momentum = 5;
    }
    
    const totalScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    
    return { score: Math.min(100, totalScore), breakdown };
  }

  private getRatingScore(rating: string): number {
    const r = rating.toUpperCase();
    if (r.includes('5 STAR') || r === 'AAA' || r.includes('STRONG BUY')) return 15;
    if (r.includes('4 STAR') || r === 'AA+' || r.includes('BUY')) return 13;
    if (r.includes('3 STAR') || r === 'AA' || r.includes('HOLD')) return 10;
    if (r.includes('2 STAR') || r === 'A') return 7;
    return 5;
  }

  private calculateRiskAdjustedScore(product: InvestmentProduct, baseScore: number): number {
    const volatilityPenalty = Math.min(15, product.volatility_proxy / 3);
    return Math.max(0, baseScore - volatilityPenalty);
  }

  private getKeyFactors(product: InvestmentProduct, clientProfile: ClientProfile): string[] {
    const factors: string[] = [];
    
    if (product.risk_level === clientProfile.risk_category) {
      factors.push('Risk profile alignment');
    }
    
    if (product.yield_or_return && product.yield_or_return > 10) {
      factors.push('Attractive return potential');
    }
    
    if (product.liquidity === 'high') {
      factors.push('High liquidity');
    }
    
    if (product.rating) {
      factors.push(`Quality rating: ${product.rating}`);
    }
    
    return factors;
  }

  private getRiskFactors(product: InvestmentProduct): string[] {
    const factors: string[] = [];
    
    if (product.volatility_proxy > 25) {
      factors.push('High volatility');
    }
    
    if (product.liquidity === 'very_low') {
      factors.push('Limited liquidity');
    }
    
    if (product.lock_in_period && product.lock_in_period > 12) {
      factors.push(`Lock-in period: ${product.lock_in_period} months`);
    }
    
    if (product.risk_level === 'very_aggressive') {
      factors.push('Suitable for aggressive investors only');
    }
    
    return factors;
  }

  private getOpportunityFactors(product: InvestmentProduct, marketContext: MarketContext): string[] {
    const factors: string[] = [];
    
    if (marketContext.market_regime === 'bull' && product.product_type === 'STOCK') {
      factors.push('Favorable equity market conditions');
    }
    
    if (marketContext.interest_rate_outlook === 'falling' && product.product_type === 'BOND') {
      factors.push('Potential for capital appreciation');
    }
    
    if (product.sector && marketContext.sector_momentum[product.sector] > 5) {
      factors.push(`Strong sector momentum: ${product.sector}`);
    }
    
    return factors;
  }

  private async optimizeBasket(
    evaluatedProducts: EvaluatedProduct[],
    clientProfile: ClientProfile,
    investmentAmount: number,
    targetAllocationOverride?: Record<string, number>
  ): Promise<RecommendationBasket> {
    evaluatedProducts.sort((a, b) => b.suitability_score - a.suitability_score);
    
    const targetAllocation = targetAllocationOverride || this.getTargetAllocation(clientProfile);
    const basketItems: BasketItem[] = [];
    const typeAllocations: Record<UnifiedProductType, number> = {} as any;
    
    for (const product of evaluatedProducts) {
      const type = product.product_type;
      const currentAllocation = typeAllocations[type] || 0;
      const maxAllocation = targetAllocation[type] || 10;
      
      if (currentAllocation >= maxAllocation) continue;
      
      const remainingAllocation = maxAllocation - currentAllocation;
      const productAllocation = Math.min(remainingAllocation, 15);
      
      const suggestedAmount = (investmentAmount * productAllocation) / 100;
      
      if (suggestedAmount < product.min_investment) continue;
      
      basketItems.push({
        product,
        allocation_percent: productAllocation,
        suggested_amount: suggestedAmount,
        rationale: this.generateRuleBasedRationale(product, clientProfile),
        pros: product.rationale_inputs.key_factors,
        cons: product.rationale_inputs.risk_factors,
        action: 'buy',
        priority: product.suitability_score > 70 ? 'must_have' : 
                  product.suitability_score > 50 ? 'recommended' : 'optional',
      });
      
      typeAllocations[type] = currentAllocation + productAllocation;
      
      if (basketItems.length >= 10) break;
    }
    
    const totalAllocation = basketItems.reduce((sum, item) => sum + item.allocation_percent, 0);
    if (totalAllocation < 100 && basketItems.length > 0) {
      const scale = 100 / totalAllocation;
      basketItems.forEach(item => {
        item.allocation_percent = Math.round(item.allocation_percent * scale);
        item.suggested_amount = (investmentAmount * item.allocation_percent) / 100;
      });
    }
    
    const assetAllocation: Record<UnifiedProductType, number> = {} as any;
    basketItems.forEach(item => {
      const type = item.product.product_type;
      assetAllocation[type] = (assetAllocation[type] || 0) + item.allocation_percent;
    });
    
    return {
      basket_id: `BASKET-${Date.now()}`,
      client_id: clientProfile.client_id,
      generated_at: new Date(),
      products: basketItems,
      portfolio_summary: {
        total_investment: investmentAmount,
        weighted_expected_return: this.calculateWeightedReturn(basketItems),
        weighted_risk_score: this.calculateWeightedRisk(basketItems),
        diversification_score: this.calculateDiversificationScore(basketItems),
        asset_allocation: assetAllocation,
      },
      portfolio_rationale: this.generatePortfolioRationale(basketItems, clientProfile),
      risk_analysis: this.analyzePortfolioRisk(basketItems),
      compliance_flags: this.checkCompliance(basketItems, clientProfile),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  private getTargetAllocation(clientProfile: ClientProfile): Record<UnifiedProductType, number> {
    const risk = clientProfile.risk_category;
    
    if (risk === 'conservative') {
      return {
        STOCK: 10, MF: 30, BOND: 40, REIT: 5, INVIT: 5, 
        IPO: 0, UNLISTED: 0, AIF: 0, PMS: 0, MLD: 10,
      };
    } else if (risk === 'moderate') {
      return {
        STOCK: 25, MF: 35, BOND: 20, REIT: 5, INVIT: 5,
        IPO: 5, UNLISTED: 0, AIF: 0, PMS: 0, MLD: 5,
      };
    } else if (risk === 'aggressive') {
      return {
        STOCK: 40, MF: 30, BOND: 10, REIT: 5, INVIT: 5,
        IPO: 5, UNLISTED: 5, AIF: 0, PMS: 0, MLD: 0,
      };
    } else {
      return {
        STOCK: 50, MF: 20, BOND: 5, REIT: 5, INVIT: 5,
        IPO: 5, UNLISTED: 10, AIF: 0, PMS: 0, MLD: 0,
      };
    }
  }

  private generateRuleBasedRationale(product: InvestmentProduct, clientProfile: ClientProfile): string {
    const parts: string[] = [];
    
    parts.push(`${product.name} is a ${product.risk_level} risk ${product.product_type.toLowerCase()} investment.`);
    
    if (product.yield_or_return) {
      parts.push(`Expected return: ${product.yield_or_return.toFixed(1)}%.`);
    }
    
    if (product.rating) {
      parts.push(`Rating: ${product.rating}.`);
    }
    
    parts.push(`Suitable for ${product.investment_horizon.replace('_', ' ')} investment horizon.`);
    
    return parts.join(' ');
  }

  private calculateWeightedReturn(items: BasketItem[]): number {
    let totalWeight = 0;
    let weightedReturn = 0;
    
    items.forEach(item => {
      const avgReturn = (item.product.expected_return_band.min + item.product.expected_return_band.max) / 2;
      weightedReturn += avgReturn * item.allocation_percent;
      totalWeight += item.allocation_percent;
    });
    
    return totalWeight > 0 ? weightedReturn / totalWeight : 0;
  }

  private calculateWeightedRisk(items: BasketItem[]): number {
    let totalWeight = 0;
    let weightedRisk = 0;
    
    items.forEach(item => {
      weightedRisk += RISK_HIERARCHY[item.product.risk_level] * item.allocation_percent;
      totalWeight += item.allocation_percent;
    });
    
    return totalWeight > 0 ? (weightedRisk / totalWeight) * 25 : 50;
  }

  private calculateDiversificationScore(items: BasketItem[]): number {
    const types = new Set(items.map(i => i.product.product_type));
    const sectors = new Set(items.filter(i => i.product.sector).map(i => i.product.sector));
    
    const typeScore = Math.min(40, types.size * 10);
    const sectorScore = Math.min(40, sectors.size * 5);
    const countScore = Math.min(20, items.length * 2);
    
    return typeScore + sectorScore + countScore;
  }

  private generatePortfolioRationale(items: BasketItem[], clientProfile: ClientProfile): string {
    const types = [...new Set(items.map(i => i.product.product_type))];
    const avgReturn = this.calculateWeightedReturn(items);
    
    return `This diversified portfolio includes ${types.length} asset classes (${types.join(', ')}) ` +
           `aligned with your ${clientProfile.risk_category} risk profile. ` +
           `Expected portfolio return: ${avgReturn.toFixed(1)}% with balanced risk exposure.`;
  }

  private analyzePortfolioRisk(items: BasketItem[]): RecommendationBasket['risk_analysis'] {
    const avgLiquidity = items.reduce((sum, i) => sum + LIQUIDITY_HIERARCHY[i.product.liquidity], 0) / items.length;
    const avgRisk = items.reduce((sum, i) => sum + RISK_HIERARCHY[i.product.risk_level], 0) / items.length;
    const maxAllocation = Math.max(...items.map(i => i.allocation_percent));
    
    return {
      concentration_risk: maxAllocation > 30 ? 'high' : maxAllocation > 20 ? 'medium' : 'low',
      liquidity_risk: avgLiquidity < 2 ? 'high' : avgLiquidity < 3 ? 'medium' : 'low',
      market_risk: avgRisk > 3 ? 'high' : avgRisk > 2 ? 'medium' : 'low',
      credit_risk: items.some(i => i.product.product_type === 'BOND' && !i.product.rating?.includes('AA')) ? 'medium' : 'low',
    };
  }

  private checkCompliance(items: BasketItem[], clientProfile: ClientProfile): string[] {
    const flags: string[] = [];
    
    items.forEach(item => {
      if (item.product.product_type === 'UNLISTED' && clientProfile.client_category === 'retail') {
        flags.push(`${item.product.name}: Not suitable for retail investors`);
      }
      
      if (item.product.product_type === 'AIF' && !['sHNI', 'bHNI'].includes(clientProfile.client_category)) {
        flags.push(`${item.product.name}: AIF requires sHNI/bHNI status`);
      }
    });
    
    return flags;
  }

  private async enrichWithAIRationales(basket: RecommendationBasket, clientProfile: ClientProfile): Promise<void> {
    
    const itemsNeedingRationale: BasketItem[] = [];
    
    // Check database cache for each item
    for (const item of basket.products) {
      const inputParams = {
        productId: item.product.product_id,
        productType: item.product.product_type,
        riskCategory: clientProfile.risk_category,
        allocation: item.allocation_percent
      };
      
      try {
        const cached = await getCachedRationale('investment_recommendation', inputParams);
        if (cached) {
          item.ai_explanation = cached.rationale;
          if (cached.keyPoints) {
            const keyPoints = cached.keyPoints as any[];
            item.pros = keyPoints.filter(p => p.type === 'pro').map(p => p.text);
            item.cons = keyPoints.filter(p => p.type === 'con').map(p => p.text);
          }
          console.log(`📦 Cache HIT for ${item.product.name} rationale`);
          continue;
        }
      } catch (error) {
        console.warn('Cache lookup failed:', error);
      }
      
      // Also check in-memory cache as fallback
      const memCacheKey = this.getRationaleCacheKey(item.product, clientProfile);
      const memCached = this.rationaleCache.get(memCacheKey);
      if (memCached) {
        const ttl = AI_RATIONALE_TTL[item.product.product_type] || 4 * 60 * 60 * 1000;
        if (Date.now() - memCached.timestamp.getTime() < ttl) {
          item.ai_explanation = memCached.rationale;
          item.pros = memCached.pros;
          item.cons = memCached.cons;
          continue;
        }
      }
      
      itemsNeedingRationale.push(item);
    }
    
    if (itemsNeedingRationale.length === 0) return;
    
    console.log(`🔄 Generating ${itemsNeedingRationale.length} AI rationales (cache miss)`);
    
    const batchSize = 3;
    for (let i = 0; i < itemsNeedingRationale.length; i += batchSize) {
      const batch = itemsNeedingRationale.slice(i, i + batchSize);
      await Promise.all(batch.map(item => this.generateAIRationale(item, clientProfile)));
    }
  }

  private getRationaleCacheKey(product: InvestmentProduct, clientProfile: ClientProfile): string {
    return `${product.product_id}:${product.product_type}:${clientProfile.risk_category}`;
  }

  private async generateAIRationale(item: BasketItem, clientProfile: ClientProfile): Promise<void> {
    const useGpt52 = isGpt52Available();
    
    const startTime = Date.now();
    
    try {
      const prompt = `Generate a brief investment rationale for:
Product: ${item.product.name} (${item.product.product_type})
Issuer: ${item.product.issuer}
Risk Level: ${item.product.risk_level}
Expected Return: ${item.product.expected_return_band.min}% - ${item.product.expected_return_band.max}%
Client Risk Profile: ${clientProfile.risk_category}
Allocation: ${item.allocation_percent}%

Provide:
1. A 2-3 sentence rationale explaining why this is suitable
2. Top 3 pros (brief phrases)
3. Top 3 cons (brief phrases)

Format response as JSON: {"rationale": "...", "pros": ["...", "...", "..."], "cons": ["...", "...", "..."]}`;

      let parsed: { rationale: string; pros: string[]; cons: string[] } | null = null;
      let modelUsed = '';
      
      if (useGpt52) {
        const { provider, model } = getComplexAnalysisModel();
        modelUsed = model;
        const response = await aiService.chat(
          [{ role: 'user', content: prompt }],
          { provider, model, maxTokens: 1024, reasoningEffort: 'high' }
        );
        const text = response.content;
        console.log(`📊 Investment rationale generated using ${model}`);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } else {
        const fallbackResult = { rationale: this.generateRuleBasedRationale(item.product, clientProfile), pros: item.product.rationale_inputs?.key_factors || [], cons: item.product.rationale_inputs?.risk_factors || [] };
        const { result, modelUsed: usedModel } = await unifiedAIRecommendationEngine.runPrompt<{ rationale: string; pros: string[]; cons: string[] }>({
          prompt,
          category: 'investment_analysis',
          fallback: () => fallbackResult,
        });
        parsed = result;
        modelUsed = usedModel;
      }
      
      if (parsed) {
        item.ai_explanation = parsed.rationale;
        if (parsed.pros?.length) item.pros = parsed.pros;
        if (parsed.cons?.length) item.cons = parsed.cons;
        
        const cacheKey = this.getRationaleCacheKey(item.product, clientProfile);
        this.rationaleCache.set(cacheKey, {
          rationale: parsed.rationale,
          pros: parsed.pros || [],
          cons: parsed.cons || [],
          timestamp: new Date(),
        });
        
        const inputParams = {
          productId: item.product.product_id,
          productType: item.product.product_type,
          riskCategory: clientProfile.risk_category,
          allocation: item.allocation_percent
        };
        
        const keyPoints = [
          ...(parsed.pros || []).map((t: string) => ({ type: 'pro', text: t })),
          ...(parsed.cons || []).map((t: string) => ({ type: 'con', text: t }))
        ];
        
        const ttlHours = (AI_RATIONALE_TTL[item.product.product_type] || 4 * 60 * 60 * 1000) / (60 * 60 * 1000);
        
        await cacheRationale(
          'investment_recommendation',
          inputParams,
          parsed.rationale,
          {
            summary: parsed.rationale.substring(0, 200),
            keyPoints,
            modelUsed,
            generationTimeMs: Date.now() - startTime,
            productType: item.product.product_type,
            productId: item.product.product_id,
            riskProfile: clientProfile.risk_category
          },
          ttlHours
        ).catch(err => console.warn('Failed to persist rationale cache:', err));
      }
    } catch (error) {
      console.warn(`AI rationale generation failed for ${item.product.name}:`, error);
    }
  }

  private getDefaultMarketContext(): MarketContext {
    return {
      market_regime: 'sideways',
      interest_rate_outlook: 'stable',
      inflation_outlook: 'moderate',
      sector_momentum: {
        'IT': 5,
        'Banking': 3,
        'Pharma': 4,
        'FMCG': 2,
        'Infrastructure': 6,
        'Energy': 3,
      },
      timestamp: new Date(),
    };
  }

  async getQuickRecommendations(
    riskLevel: RiskLevel,
    productTypes?: UnifiedProductType[],
    limit: number = 5
  ): Promise<EvaluatedProduct[]> {
    const mockProfile: ClientProfile = {
      client_id: 'quick-rec',
      risk_category: riskLevel,
      client_category: 'retail',
      investment_horizon: riskLevel === 'conservative' ? 'short' : 'medium',
      liquidity_needs: 'medium',
      tax_bracket: 30,
      investment_experience: 'intermediate',
    };
    
    const types = productTypes || ['STOCK', 'MF', 'BOND'];
    const products = await this.fetchAllProducts(types);
    const filtered = this.applyEligibilityFilters(products, mockProfile);
    const evaluated = this.evaluateProducts(filtered, mockProfile, this.getDefaultMarketContext());
    
    return evaluated
      .sort((a, b) => b.suitability_score - a.suitability_score)
      .slice(0, limit);
  }

  getCacheMetrics(): Record<string, any> {
    return {
      productCacheSize: this.productCache.size,
      rationaleCacheSize: this.rationaleCache.size,
      productCacheTypes: [...this.productCache.keys()],
    };
  }

  clearCache(): void {
    this.productCache.clear();
    this.rationaleCache.clear();
  }
}

export const aiInvestmentOrchestrator = new AIInvestmentOrchestratorService();
