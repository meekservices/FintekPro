import { db } from "../db";
import { 
  governmentSecurities, 
  corporateBonds, 
  userProfiles,
  GovernmentSecurity,
  CorporateBond
} from "@shared/schema";
import { eq, and, desc, gte, lte, or, sql, inArray } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

export interface BondRecommendationParams {
  investmentAmount: number;
  investmentHorizon: 'short' | 'medium' | 'long'; // short: <3y, medium: 3-7y, long: >7y
  riskTolerance: 'conservative' | 'moderately_conservative' | 'moderate' | 'moderately_aggressive' | 'aggressive';
  taxBracket: '0' | '5' | '10' | '15' | '20' | '25' | '30'; // Tax bracket percentage
  preferredBondTypes: string[]; // 'g_sec', 'corporate_bond', 'ncd', 'tax_free_bond', 'sgb', 'infrastructure_bond', 'sdl'
  minimumRating: 'AAA' | 'AA+' | 'AA' | 'AA-' | 'A+' | 'A' | 'BBB' | 'any';
  yieldPreference: 'high_yield' | 'balanced' | 'safety_first';
  liquidityNeeds: 'high' | 'medium' | 'low';
  taxOptimization: boolean;
  inflationProtection: boolean;
  monthlyIncomeNeeded: boolean;
  clientId?: string;
}

export interface BondRecommendation {
  id: string;
  bondType: 'government' | 'corporate';
  isin: string;
  name: string;
  issuer: string;
  bondCategory: string;
  currentPrice: number;
  yieldToMaturity: number;
  couponRate: number;
  couponFrequency: string;
  maturityDate: string;
  daysToMaturity: number;
  creditRating: string;
  suggestedAllocation: number; // Percentage of total investment
  suggestedAmount: number;
  expectedAnnualIncome: number;
  taxEfficiency: 'high' | 'medium' | 'low';
  riskScore: number; // 1-100
  suitabilityScore: number; // 1-100
  aiRationale: string;
  pros: string[];
  cons: string[];
  taxImplications: string;
  duration: number;
  modifiedDuration: number;
}

export interface BondPortfolioSummary {
  totalInvestment: number;
  weightedYield: number;
  weightedDuration: number;
  averageRating: string;
  expectedAnnualIncome: number;
  taxEfficiency: string;
  diversificationScore: number;
  recommendations: BondRecommendation[];
  portfolioRationale: string;
  riskAnalysis: {
    interestRateRisk: 'low' | 'medium' | 'high';
    creditRisk: 'low' | 'medium' | 'high';
    liquidityRisk: 'low' | 'medium' | 'high';
    reinvestmentRisk: 'low' | 'medium' | 'high';
  };
  ladderStrategy?: {
    enabled: boolean;
    buckets: Array<{
      maturityRange: string;
      percentage: number;
      bonds: string[];
    }>;
  };
}

const RATING_SCORES: Record<string, number> = {
  'AAA': 100, 'AA+': 95, 'AA': 90, 'AA-': 85,
  'A+': 80, 'A': 75, 'A-': 70,
  'BBB+': 65, 'BBB': 60, 'BBB-': 55,
  'BB+': 50, 'BB': 45, 'BB-': 40,
  'B+': 35, 'B': 30, 'B-': 25,
  'C': 15, 'D': 5
};

const RATING_ORDER = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+', 'B', 'B-', 'C', 'D'];

class AIBondRecommendationService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.AI_INTEGRATIONS_GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      console.log("✅ AI Bond Recommendation Service initialized with Gemini");
    } else {
      console.log("⚠️ AI Bond Recommendation Service running in rule-based mode");
    }
  }

  async generateRecommendations(params: BondRecommendationParams): Promise<BondPortfolioSummary> {
    const govBonds = await this.fetchGovernmentSecurities(params);
    const corpBonds = await this.fetchCorporateBonds(params);
    
    const scoredGovBonds = govBonds.map(bond => this.scoreBond(bond, 'government', params));
    const scoredCorpBonds = corpBonds.map(bond => this.scoreBond(bond, 'corporate', params));
    
    const allBonds = [...scoredGovBonds, ...scoredCorpBonds]
      .sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    
    const selectedBonds = this.selectOptimalPortfolio(allBonds, params);
    
    const enrichedBonds = await this.enrichWithAIRationale(selectedBonds, params);
    
    const summary = this.buildPortfolioSummary(enrichedBonds, params);
    
    return summary;
  }

  private async fetchGovernmentSecurities(params: BondRecommendationParams): Promise<GovernmentSecurity[]> {
    const today = new Date();
    const minMaturity = new Date(today);
    const maxMaturity = new Date(today);
    
    switch (params.investmentHorizon) {
      case 'short':
        minMaturity.setMonth(minMaturity.getMonth() + 6);
        maxMaturity.setFullYear(maxMaturity.getFullYear() + 3);
        break;
      case 'medium':
        minMaturity.setFullYear(minMaturity.getFullYear() + 1);
        maxMaturity.setFullYear(maxMaturity.getFullYear() + 7);
        break;
      case 'long':
        minMaturity.setFullYear(minMaturity.getFullYear() + 5);
        maxMaturity.setFullYear(maxMaturity.getFullYear() + 30);
        break;
    }

    const allowedTypes: string[] = [];
    if (params.preferredBondTypes.includes('g_sec')) allowedTypes.push('g_sec');
    if (params.preferredBondTypes.includes('t_bill')) allowedTypes.push('t_bill');
    if (params.preferredBondTypes.includes('sdl')) allowedTypes.push('sdl');
    if (params.preferredBondTypes.includes('sgb')) allowedTypes.push('sgb');
    if (params.preferredBondTypes.includes('tax_free_bond')) allowedTypes.push('tax_free_bond');
    if (params.preferredBondTypes.includes('infrastructure_bond')) allowedTypes.push('infrastructure_bond');

    if (allowedTypes.length === 0) {
      allowedTypes.push('g_sec', 'sgb', 'tax_free_bond');
    }

    try {
      const bonds = await db
        .select()
        .from(governmentSecurities)
        .where(
          and(
            eq(governmentSecurities.tradingStatus, 'active'),
            inArray(governmentSecurities.securityType, allowedTypes)
          )
        )
        .limit(50);

      return bonds;
    } catch (error) {
      console.error('Error fetching government securities:', error);
      throw new Error('Bond data API not configured. Live bond market data service required.');
    }
  }

  private async fetchCorporateBonds(params: BondRecommendationParams): Promise<CorporateBond[]> {
    const allowedTypes: string[] = [];
    if (params.preferredBondTypes.includes('corporate_bond')) allowedTypes.push('corporate_bond');
    if (params.preferredBondTypes.includes('ncd')) allowedTypes.push('ncd');
    if (params.preferredBondTypes.includes('tax_free_bond')) allowedTypes.push('tax_free_bond');
    if (params.preferredBondTypes.includes('infrastructure_bond')) allowedTypes.push('infrastructure_bond');

    if (allowedTypes.length === 0) {
      allowedTypes.push('corporate_bond', 'ncd');
    }

    const minRatingIndex = RATING_ORDER.indexOf(params.minimumRating === 'any' ? 'D' : params.minimumRating);
    const acceptableRatings = RATING_ORDER.slice(0, minRatingIndex + 1);

    try {
      const bonds = await db
        .select()
        .from(corporateBonds)
        .where(
          and(
            eq(corporateBonds.tradingStatus, 'active'),
            eq(corporateBonds.instrumentStatus, 'SELLABLE'),
            inArray(corporateBonds.bondType, allowedTypes)
          )
        )
        .limit(50);

      return bonds.filter(bond => 
        !bond.creditRating || acceptableRatings.includes(bond.creditRating)
      );
    } catch (error) {
      console.error('Error fetching corporate bonds:', error);
      throw new Error('Bond data API not configured. Live bond market data service required.');
    }
  }

  private scoreBond(
    bond: GovernmentSecurity | CorporateBond, 
    type: 'government' | 'corporate',
    params: BondRecommendationParams
  ): BondRecommendation {
    const isGov = type === 'government';
    const govBond = isGov ? bond as GovernmentSecurity : null;
    const corpBond = !isGov ? bond as CorporateBond : null;

    const creditRating = isGov ? (govBond?.creditRating || 'AAA') : (corpBond?.creditRating || 'AA');
    const ratingScore = RATING_SCORES[creditRating] || 50;
    
    const ytm = parseFloat((isGov ? govBond?.yieldToMaturity : corpBond?.yieldToMaturity) || '7') || 7;
    const couponRate = parseFloat((isGov ? govBond?.couponRate : corpBond?.couponRate) || '6') || 6;
    const currentPrice = parseFloat((isGov ? govBond?.currentPrice : corpBond?.currentPrice) || '100') || 100;
    const duration = parseFloat((isGov ? govBond?.duration : corpBond?.duration) || '3') || 3;
    const modDuration = parseFloat((isGov ? govBond?.modifiedDuration : corpBond?.modifiedDuration) || '2.8') || 2.8;
    
    const maturityDate = isGov ? govBond?.maturityDate : corpBond?.maturityDate;
    const daysToMaturity = maturityDate ? 
      Math.max(0, Math.floor((new Date(maturityDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 1825;

    let suitabilityScore = 50;
    
    const riskToleranceWeights: Record<string, { safety: number; yield: number }> = {
      'conservative': { safety: 0.8, yield: 0.2 },
      'moderately_conservative': { safety: 0.65, yield: 0.35 },
      'moderate': { safety: 0.5, yield: 0.5 },
      'moderately_aggressive': { safety: 0.35, yield: 0.65 },
      'aggressive': { safety: 0.2, yield: 0.8 }
    };
    
    const weights = riskToleranceWeights[params.riskTolerance];
    suitabilityScore += (ratingScore / 100) * 30 * weights.safety;
    suitabilityScore += (ytm / 12) * 30 * weights.yield;

    if (params.yieldPreference === 'high_yield') {
      suitabilityScore += ytm > 8 ? 10 : ytm > 7 ? 5 : 0;
    } else if (params.yieldPreference === 'safety_first') {
      suitabilityScore += ratingScore >= 90 ? 10 : ratingScore >= 80 ? 5 : 0;
    }

    if (params.taxOptimization) {
      const taxStatus = isGov ? govBond?.taxStatus : corpBond?.taxStatus;
      if (taxStatus === 'tax_free') suitabilityScore += 15;
      else if (taxStatus === 'tax_exempt_on_redemption') suitabilityScore += 10;
      else if (taxStatus === 'tax_saving_eligible') suitabilityScore += 8;
    }

    if (params.inflationProtection && isGov && govBond?.securityType === 'sgb') {
      suitabilityScore += 12;
    }

    if (params.monthlyIncomeNeeded) {
      const couponFreq = isGov ? 'semi_annual' : (corpBond?.couponFrequency || 'annual');
      if (couponFreq === 'monthly') suitabilityScore += 10;
      else if (couponFreq === 'quarterly') suitabilityScore += 5;
    }

    if (params.liquidityNeeds === 'high' && isGov) {
      suitabilityScore += 8;
    }

    let horizonMonths = params.investmentHorizon === 'short' ? 18 : 
                        params.investmentHorizon === 'medium' ? 60 : 120;
    const daysToTarget = horizonMonths * 30;
    const maturityMatch = 1 - Math.min(1, Math.abs(daysToMaturity - daysToTarget) / daysToTarget);
    suitabilityScore += maturityMatch * 10;

    const riskScore = Math.round(100 - ratingScore + (modDuration * 3));

    const taxBracketNum = parseInt(params.taxBracket);
    const taxStatus = isGov ? govBond?.taxStatus : corpBond?.taxStatus;
    const taxEfficiency: 'high' | 'medium' | 'low' = 
      taxStatus === 'tax_free' ? 'high' :
      taxStatus === 'tax_exempt_on_redemption' ? 'high' :
      taxBracketNum >= 20 ? 'low' : 'medium';

    const bondName = isGov ? govBond?.securityName : corpBond?.bondName;
    const issuer = isGov ? govBond?.issuer : corpBond?.issuer;
    const bondCategory = isGov ? govBond?.securityType : corpBond?.bondType;
    const couponFrequency = isGov ? 'semi_annual' : (corpBond?.couponFrequency || 'annual');

    return {
      id: bond.id,
      bondType: type,
      isin: bond.isin,
      name: bondName || 'Unknown Bond',
      issuer: issuer || 'Unknown Issuer',
      bondCategory: bondCategory || 'bond',
      currentPrice,
      yieldToMaturity: ytm,
      couponRate,
      couponFrequency,
      maturityDate: maturityDate || new Date(Date.now() + 365 * 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      daysToMaturity,
      creditRating,
      suggestedAllocation: 0,
      suggestedAmount: 0,
      expectedAnnualIncome: 0,
      taxEfficiency,
      riskScore: Math.min(100, Math.max(0, riskScore)),
      suitabilityScore: Math.min(100, Math.max(0, Math.round(suitabilityScore))),
      aiRationale: '',
      pros: [],
      cons: [],
      taxImplications: '',
      duration,
      modifiedDuration: modDuration
    };
  }

  private selectOptimalPortfolio(
    bonds: BondRecommendation[], 
    params: BondRecommendationParams
  ): BondRecommendation[] {
    const selected: BondRecommendation[] = [];
    const targetCount = Math.min(8, Math.max(3, Math.floor(params.investmentAmount / 100000)));
    
    const govBonds = bonds.filter(b => b.bondType === 'government');
    const corpBonds = bonds.filter(b => b.bondType === 'corporate');
    
    let govAllocation = params.riskTolerance === 'conservative' ? 0.7 :
                        params.riskTolerance === 'moderately_conservative' ? 0.6 :
                        params.riskTolerance === 'moderate' ? 0.5 :
                        params.riskTolerance === 'moderately_aggressive' ? 0.4 : 0.3;
    
    const targetGovCount = Math.ceil(targetCount * govAllocation);
    const targetCorpCount = targetCount - targetGovCount;
    
    selected.push(...govBonds.slice(0, targetGovCount));
    selected.push(...corpBonds.slice(0, targetCorpCount));
    
    const totalScore = selected.reduce((sum, b) => sum + b.suitabilityScore, 0);
    let remainingAmount = params.investmentAmount;
    
    selected.forEach((bond, index) => {
      const baseAllocation = bond.suitabilityScore / totalScore;
      let allocation = baseAllocation;
      
      if (bond.bondType === 'government') {
        allocation = Math.min(0.35, allocation * 1.2);
      } else {
        allocation = Math.min(0.25, allocation);
      }
      
      bond.suggestedAllocation = Math.round(allocation * 100);
      bond.suggestedAmount = Math.round(params.investmentAmount * allocation);
      
      const units = Math.floor(bond.suggestedAmount / bond.currentPrice);
      bond.expectedAnnualIncome = units * bond.currentPrice * (bond.couponRate / 100);
    });

    const totalAllocation = selected.reduce((sum, b) => sum + b.suggestedAllocation, 0);
    if (totalAllocation !== 100 && selected.length > 0) {
      const adjustment = (100 - totalAllocation) / selected.length;
      selected.forEach(bond => {
        bond.suggestedAllocation = Math.round(bond.suggestedAllocation + adjustment);
        bond.suggestedAmount = Math.round(params.investmentAmount * (bond.suggestedAllocation / 100));
      });
    }

    return selected;
  }

  private async enrichWithAIRationale(
    bonds: BondRecommendation[], 
    params: BondRecommendationParams
  ): Promise<BondRecommendation[]> {
    if (!this.genAI || bonds.length === 0) {
      return bonds.map(bond => this.addRuleBasedRationale(bond, params));
    }

    try {
      const prompt = `You are an expert fixed income investment advisor. Analyze these bond recommendations and provide brief, professional rationale for each.

Investment Parameters:
- Investment Amount: ₹${params.investmentAmount.toLocaleString()}
- Horizon: ${params.investmentHorizon}
- Risk Tolerance: ${params.riskTolerance}
- Tax Bracket: ${params.taxBracket}%
- Yield Preference: ${params.yieldPreference}
- Tax Optimization: ${params.taxOptimization}
- Monthly Income Needed: ${params.monthlyIncomeNeeded}

Bonds to analyze:
${bonds.map((b, i) => `${i + 1}. ${b.name} (${b.bondCategory}) - YTM: ${b.yieldToMaturity}%, Rating: ${b.creditRating}, Duration: ${b.duration}y, Allocation: ${b.suggestedAllocation}%`).join('\n')}

For each bond, provide:
1. A 2-3 sentence rationale explaining why it fits this investor's needs
2. 2-3 key pros
3. 1-2 potential cons
4. Tax implications (1 sentence)

Format your response as JSON array matching this structure:
[{"bondIndex": 0, "rationale": "...", "pros": ["..."], "cons": ["..."], "taxImplications": "..."}]`;

      const model = this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const result = await model;
      const responseText = (result as any).response?.text?.() || '';
      
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const analyses = JSON.parse(jsonMatch[0]);
        analyses.forEach((analysis: any) => {
          const bond = bonds[analysis.bondIndex];
          if (bond) {
            bond.aiRationale = analysis.rationale || '';
            bond.pros = analysis.pros || [];
            bond.cons = analysis.cons || [];
            bond.taxImplications = analysis.taxImplications || '';
          }
        });
      }
    } catch (error) {
      console.error('Error getting AI rationale:', error);
    }

    return bonds.map(bond => 
      bond.aiRationale ? bond : this.addRuleBasedRationale(bond, params)
    );
  }

  private addRuleBasedRationale(bond: BondRecommendation, params: BondRecommendationParams): BondRecommendation {
    const pros: string[] = [];
    const cons: string[] = [];
    let rationale = '';

    if (bond.bondType === 'government') {
      pros.push('Sovereign guarantee - highest safety');
      pros.push('High liquidity in secondary market');
      if (bond.bondCategory === 'sgb') {
        pros.push('Gold price appreciation potential plus fixed coupon');
        pros.push('Tax-free capital gains on maturity');
      }
      rationale = `This ${bond.bondCategory.replace('_', ' ')} offers ${bond.yieldToMaturity}% yield with sovereign backing, making it suitable for ${params.riskTolerance} investors seeking stable returns.`;
      cons.push('Returns may lag inflation in rising rate environment');
    } else {
      if (RATING_SCORES[bond.creditRating] >= 90) {
        pros.push(`High credit quality (${bond.creditRating} rated)`);
      }
      pros.push(`Attractive yield of ${bond.yieldToMaturity}%`);
      if (bond.taxEfficiency === 'high') {
        pros.push('Tax-efficient returns');
      }
      rationale = `This ${bond.creditRating} rated ${bond.bondCategory} from ${bond.issuer} offers ${bond.yieldToMaturity}% yield, balancing ${params.yieldPreference === 'high_yield' ? 'higher income' : 'safety'} with reasonable credit risk.`;
      cons.push('Credit risk - depends on issuer financial health');
      if (bond.duration > 5) {
        cons.push('Higher interest rate sensitivity');
      }
    }

    const taxBracket = parseInt(params.taxBracket);
    let taxImplications = '';
    if (bond.taxEfficiency === 'high') {
      taxImplications = 'Interest income is tax-free, maximizing post-tax returns.';
    } else {
      taxImplications = `Interest taxed at ${taxBracket}%, resulting in post-tax yield of ~${(bond.yieldToMaturity * (1 - taxBracket/100)).toFixed(2)}%.`;
    }

    return {
      ...bond,
      aiRationale: rationale,
      pros,
      cons,
      taxImplications
    };
  }

  private buildPortfolioSummary(bonds: BondRecommendation[], params: BondRecommendationParams): BondPortfolioSummary {
    const totalInvestment = bonds.reduce((sum, b) => sum + b.suggestedAmount, 0);
    
    const weightedYield = bonds.reduce((sum, b) => 
      sum + (b.yieldToMaturity * b.suggestedAllocation / 100), 0);
    
    const weightedDuration = bonds.reduce((sum, b) => 
      sum + (b.duration * b.suggestedAllocation / 100), 0);
    
    const avgRatingScore = bonds.reduce((sum, b) => 
      sum + ((RATING_SCORES[b.creditRating] || 50) * b.suggestedAllocation / 100), 0);
    
    let averageRating = 'A';
    for (const [rating, score] of Object.entries(RATING_SCORES)) {
      if (score <= avgRatingScore + 5 && score >= avgRatingScore - 5) {
        averageRating = rating;
        break;
      }
    }

    const expectedAnnualIncome = bonds.reduce((sum, b) => sum + b.expectedAnnualIncome, 0);

    const bondTypes = new Set(bonds.map(b => b.bondCategory));
    const issuers = new Set(bonds.map(b => b.issuer));
    const diversificationScore = Math.min(100, 
      (bondTypes.size * 15) + (issuers.size * 10) + (bonds.length * 5));

    const govCount = bonds.filter(b => b.bondType === 'government').length;
    const taxFreeCount = bonds.filter(b => b.taxEfficiency === 'high').length;
    const taxEfficiency = taxFreeCount >= bonds.length / 2 ? 'High' : 
                         taxFreeCount > 0 ? 'Medium' : 'Low';

    const interestRateRisk: 'low' | 'medium' | 'high' = 
      weightedDuration < 3 ? 'low' : weightedDuration < 6 ? 'medium' : 'high';
    
    const creditRisk: 'low' | 'medium' | 'high' = 
      avgRatingScore >= 85 ? 'low' : avgRatingScore >= 70 ? 'medium' : 'high';
    
    const liquidityRisk: 'low' | 'medium' | 'high' = 
      govCount >= bonds.length / 2 ? 'low' : govCount > 0 ? 'medium' : 'high';
    
    const reinvestmentRisk: 'low' | 'medium' | 'high' = 
      params.investmentHorizon === 'long' ? 'high' : 
      params.investmentHorizon === 'medium' ? 'medium' : 'low';

    const portfolioRationale = this.generatePortfolioRationale(bonds, params, {
      weightedYield, weightedDuration, averageRating, diversificationScore
    });

    let ladderStrategy = undefined;
    if (bonds.length >= 3) {
      const shortTerm = bonds.filter(b => b.daysToMaturity < 1095);
      const mediumTerm = bonds.filter(b => b.daysToMaturity >= 1095 && b.daysToMaturity < 2555);
      const longTerm = bonds.filter(b => b.daysToMaturity >= 2555);
      
      if (shortTerm.length > 0 || mediumTerm.length > 0 || longTerm.length > 0) {
        ladderStrategy = {
          enabled: true,
          buckets: [
            {
              maturityRange: '0-3 years',
              percentage: shortTerm.reduce((sum, b) => sum + b.suggestedAllocation, 0),
              bonds: shortTerm.map(b => b.isin)
            },
            {
              maturityRange: '3-7 years',
              percentage: mediumTerm.reduce((sum, b) => sum + b.suggestedAllocation, 0),
              bonds: mediumTerm.map(b => b.isin)
            },
            {
              maturityRange: '7+ years',
              percentage: longTerm.reduce((sum, b) => sum + b.suggestedAllocation, 0),
              bonds: longTerm.map(b => b.isin)
            }
          ].filter(bucket => bucket.percentage > 0)
        };
      }
    }

    return {
      totalInvestment,
      weightedYield: Math.round(weightedYield * 100) / 100,
      weightedDuration: Math.round(weightedDuration * 100) / 100,
      averageRating,
      expectedAnnualIncome: Math.round(expectedAnnualIncome),
      taxEfficiency,
      diversificationScore,
      recommendations: bonds,
      portfolioRationale,
      riskAnalysis: {
        interestRateRisk,
        creditRisk,
        liquidityRisk,
        reinvestmentRisk
      },
      ladderStrategy
    };
  }

  private generatePortfolioRationale(
    bonds: BondRecommendation[], 
    params: BondRecommendationParams,
    metrics: { weightedYield: number; weightedDuration: number; averageRating: string; diversificationScore: number }
  ): string {
    const parts: string[] = [];
    
    parts.push(`This portfolio of ${bonds.length} bonds is designed for a ${params.riskTolerance.replace('_', ' ')} investor with a ${params.investmentHorizon}-term horizon.`);
    
    parts.push(`The portfolio offers a weighted average yield of ${metrics.weightedYield.toFixed(2)}% with ${metrics.averageRating} average credit quality.`);
    
    if (params.taxOptimization) {
      const taxFreeCount = bonds.filter(b => b.taxEfficiency === 'high').length;
      if (taxFreeCount > 0) {
        parts.push(`${taxFreeCount} tax-efficient bonds are included to optimize after-tax returns for the ${params.taxBracket}% tax bracket.`);
      }
    }
    
    const govAlloc = bonds.filter(b => b.bondType === 'government')
      .reduce((sum, b) => sum + b.suggestedAllocation, 0);
    if (govAlloc > 40) {
      parts.push(`${govAlloc}% allocation to government securities provides a stable foundation with sovereign backing.`);
    }
    
    parts.push(`Duration of ${metrics.weightedDuration.toFixed(1)} years balances income generation with interest rate risk management.`);

    return parts.join(' ');
  }

}

export const aiBondRecommendationService = new AIBondRecommendationService();
