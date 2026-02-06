import { db } from "../db";
import { commodities, userProfiles, Commodity } from "@shared/schema";
import { eq, and, desc, gte, lte, or, sql, inArray } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

export interface CommodityRecommendationParams {
  investmentAmount: number;
  investmentHorizon: 'short' | 'medium' | 'long';
  riskTolerance: 'conservative' | 'moderately_conservative' | 'moderate' | 'moderately_aggressive' | 'aggressive';
  preferredCommodityTypes: string[];
  investmentVehicle: 'etf' | 'sgb' | 'physical' | 'futures' | 'any';
  inflationProtection: boolean;
  safeHavenAllocation: boolean;
  portfolioDiversification: boolean;
  clientId?: string;
}

export interface CommodityRecommendation {
  id: string;
  symbol: string;
  name: string;
  commodityType: string;
  subType: string;
  currentPrice: number;
  unit: string;
  currency: string;
  suggestedAllocation: number;
  suggestedAmount: number;
  investmentVehicle: string;
  returns1y: number;
  returns3y: number;
  volatility: number;
  suitabilityScore: number;
  riskScore: number;
  aiRationale: string;
  pros: string[];
  cons: string[];
  inflationHedge: boolean;
  safeHaven: boolean;
  globalDemand: string;
  supplyOutlook: string;
}

export interface CommodityPortfolioSummary {
  totalInvestment: number;
  expectedAnnualReturn: number;
  portfolioVolatility: number;
  diversificationScore: number;
  inflationProtectionScore: number;
  recommendations: CommodityRecommendation[];
  portfolioRationale: string;
  riskAnalysis: {
    priceVolatilityRisk: 'low' | 'medium' | 'high';
    currencyRisk: 'low' | 'medium' | 'high';
    storageRisk: 'low' | 'medium' | 'high';
    liquidityRisk: 'low' | 'medium' | 'high';
  };
  allocationBreakdown: {
    preciousMetals: number;
    energy: number;
    industrialMetals: number;
    agricultural: number;
  };
}

const COMMODITY_TYPE_SCORES: Record<string, number> = {
  'precious_metal': 90,
  'energy': 75,
  'industrial_metal': 70,
  'agricultural': 60
};

class AICommodityRecommendationService {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.AI_INTEGRATIONS_GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      console.log("✅ AI Commodity Recommendation Service initialized with Gemini");
    } else {
      console.log("⚠️ AI Commodity Recommendation Service running in rule-based mode");
    }
  }

  async generateRecommendations(params: CommodityRecommendationParams): Promise<CommodityPortfolioSummary> {
    const availableCommodities = await this.fetchCommodities(params);
    const scoredCommodities = availableCommodities.map(c => this.scoreCommodity(c, params));
    const sortedCommodities = scoredCommodities.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
    const selectedCommodities = this.selectOptimalPortfolio(sortedCommodities, params);
    const enrichedCommodities = await this.enrichWithAIRationale(selectedCommodities, params);
    const summary = this.buildPortfolioSummary(enrichedCommodities, params);
    return summary;
  }

  private async fetchCommodities(params: CommodityRecommendationParams): Promise<Commodity[]> {
    const allowedTypes = params.preferredCommodityTypes.length > 0 
      ? params.preferredCommodityTypes 
      : ['precious_metal', 'energy', 'industrial_metal', 'agricultural'];

    try {
      const result = await db
        .select()
        .from(commodities)
        .where(
          and(
            eq(commodities.isPublished, true),
            inArray(commodities.commodityType, allowedTypes)
          )
        )
        .limit(50);

      if (result.length === 0) {
        throw new Error('Commodity data API not configured. Live commodity market data service required.');
      }
      return result;
    } catch (error) {
      console.error('Error fetching commodities:', error);
      throw new Error('Commodity data API not configured. Live commodity market data service required.');
    }
  }

  private scoreCommodity(commodity: Commodity, params: CommodityRecommendationParams): CommodityRecommendation & { rawScore: number } {
    let suitabilityScore = 50;
    let riskScore = 50;

    const typeScore = COMMODITY_TYPE_SCORES[commodity.commodityType || 'precious_metal'] || 50;
    suitabilityScore += (typeScore - 50) * 0.2;

    const volatility = parseFloat(commodity.volatility?.toString() || '20');
    switch (params.riskTolerance) {
      case 'conservative':
        if (volatility < 15) suitabilityScore += 20;
        else if (volatility > 25) suitabilityScore -= 20;
        riskScore = volatility > 20 ? 70 : 40;
        break;
      case 'moderately_conservative':
        if (volatility < 20) suitabilityScore += 15;
        else if (volatility > 30) suitabilityScore -= 15;
        riskScore = volatility > 25 ? 65 : 45;
        break;
      case 'moderate':
        if (volatility >= 15 && volatility <= 25) suitabilityScore += 10;
        riskScore = 50;
        break;
      case 'moderately_aggressive':
        if (volatility >= 20 && volatility <= 35) suitabilityScore += 15;
        riskScore = volatility < 20 ? 35 : 55;
        break;
      case 'aggressive':
        if (volatility > 25) suitabilityScore += 20;
        riskScore = 30;
        break;
    }

    if (params.inflationProtection && commodity.inflationHedge) {
      suitabilityScore += 15;
    }

    if (params.safeHavenAllocation && commodity.safeHaven) {
      suitabilityScore += 15;
    }

    const returns1y = parseFloat(commodity.returns1y?.toString() || '10');
    if (returns1y > 20) suitabilityScore += 10;
    else if (returns1y > 10) suitabilityScore += 5;
    else if (returns1y < 0) suitabilityScore -= 10;

    if (params.investmentVehicle !== 'any') {
      const hasVehicle = 
        (params.investmentVehicle === 'etf' && commodity.hasEtf) ||
        (params.investmentVehicle === 'sgb' && commodity.hasSgb) ||
        (params.investmentVehicle === 'physical' && commodity.hasPhysical) ||
        (params.investmentVehicle === 'futures' && commodity.hasFutures);
      
      if (!hasVehicle) suitabilityScore -= 30;
    }

    suitabilityScore = Math.max(0, Math.min(100, suitabilityScore));
    riskScore = Math.max(0, Math.min(100, riskScore));

    const investmentVehicle = this.selectInvestmentVehicle(commodity, params);

    return {
      id: commodity.id,
      symbol: commodity.symbol,
      name: commodity.name,
      commodityType: commodity.commodityType || 'precious_metal',
      subType: commodity.subType || '',
      currentPrice: parseFloat(commodity.currentPrice?.toString() || '0'),
      unit: commodity.unit || 'gram',
      currency: commodity.currency || 'INR',
      suggestedAllocation: 0,
      suggestedAmount: 0,
      investmentVehicle,
      returns1y: parseFloat(commodity.returns1y?.toString() || '0'),
      returns3y: parseFloat(commodity.returns3y?.toString() || '0'),
      volatility: parseFloat(commodity.volatility?.toString() || '0'),
      suitabilityScore,
      riskScore,
      aiRationale: '',
      pros: this.generatePros(commodity),
      cons: this.generateCons(commodity),
      inflationHedge: commodity.inflationHedge || false,
      safeHaven: commodity.safeHaven || false,
      globalDemand: commodity.globalDemand || 'medium',
      supplyOutlook: commodity.supplyOutlook || 'neutral',
      rawScore: suitabilityScore
    };
  }

  private selectInvestmentVehicle(commodity: Commodity, params: CommodityRecommendationParams): string {
    if (params.investmentVehicle !== 'any') {
      return params.investmentVehicle;
    }

    if (commodity.hasSgb && commodity.subType === 'gold') return 'sgb';
    if (commodity.hasEtf) return 'etf';
    if (commodity.hasFutures && params.riskTolerance === 'aggressive') return 'futures';
    if (commodity.hasPhysical) return 'physical';
    return 'etf';
  }

  private generatePros(commodity: Commodity): string[] {
    const pros: string[] = [];
    
    if (commodity.inflationHedge) pros.push('Effective inflation hedge');
    if (commodity.safeHaven) pros.push('Safe haven asset during market turmoil');
    if (commodity.globalDemand === 'high') pros.push('Strong global demand');
    if (commodity.supplyOutlook === 'bullish') pros.push('Favorable supply outlook');
    
    const returns1y = parseFloat(commodity.returns1y?.toString() || '0');
    if (returns1y > 15) pros.push(`Strong 1-year returns of ${returns1y.toFixed(1)}%`);
    
    if (commodity.hasEtf) pros.push('Easy access via ETFs');
    if (commodity.hasSgb) pros.push('Sovereign Gold Bond option available');
    
    const volatility = parseFloat(commodity.volatility?.toString() || '0');
    if (volatility < 15) pros.push('Low volatility');

    return pros.slice(0, 4);
  }

  private generateCons(commodity: Commodity): string[] {
    const cons: string[] = [];
    
    const volatility = parseFloat(commodity.volatility?.toString() || '0');
    if (volatility > 25) cons.push(`High volatility of ${volatility.toFixed(1)}%`);
    
    if (!commodity.inflationHedge) cons.push('Limited inflation protection');
    if (commodity.globalDemand === 'low') cons.push('Weak global demand');
    if (commodity.supplyOutlook === 'bearish') cons.push('Unfavorable supply outlook');
    
    const returns1y = parseFloat(commodity.returns1y?.toString() || '0');
    if (returns1y < 0) cons.push(`Negative 1-year returns of ${returns1y.toFixed(1)}%`);
    
    if (!commodity.hasEtf && !commodity.hasSgb) cons.push('Limited investment vehicle options');
    if (commodity.hasPhysical && !commodity.hasEtf) cons.push('Storage and security considerations');

    return cons.slice(0, 3);
  }

  private selectOptimalPortfolio(
    scoredCommodities: (CommodityRecommendation & { rawScore: number })[],
    params: CommodityRecommendationParams
  ): CommodityRecommendation[] {
    const maxCommodities = params.portfolioDiversification ? 5 : 3;
    const selected = scoredCommodities.slice(0, maxCommodities);
    
    const totalScore = selected.reduce((sum, c) => sum + c.rawScore, 0);
    
    return selected.map(commodity => {
      const allocation = totalScore > 0 ? (commodity.rawScore / totalScore) * 100 : 100 / selected.length;
      return {
        ...commodity,
        suggestedAllocation: Math.round(allocation * 10) / 10,
        suggestedAmount: Math.round((allocation / 100) * params.investmentAmount)
      };
    });
  }

  private async enrichWithAIRationale(
    recommendations: CommodityRecommendation[],
    params: CommodityRecommendationParams
  ): Promise<CommodityRecommendation[]> {
    if (!this.genAI) {
      return recommendations.map(rec => ({
        ...rec,
        aiRationale: this.generateRuleBasedRationale(rec, params)
      }));
    }

    try {
      const prompt = `You are an expert commodity investment advisor. Analyze these commodity recommendations for a client with the following profile:
      - Investment Amount: ₹${params.investmentAmount.toLocaleString()}
      - Investment Horizon: ${params.investmentHorizon}
      - Risk Tolerance: ${params.riskTolerance}
      - Inflation Protection Priority: ${params.inflationProtection ? 'Yes' : 'No'}
      - Safe Haven Allocation: ${params.safeHavenAllocation ? 'Yes' : 'No'}

      Commodities being recommended:
      ${recommendations.map(r => `- ${r.name} (${r.commodityType}): ${r.suggestedAllocation}% allocation, ₹${r.suggestedAmount}, 1Y Return: ${r.returns1y}%, Volatility: ${r.volatility}%`).join('\n')}

      For each commodity, provide a brief (2-3 sentences) personalized rationale explaining why it's suitable for this client's profile. Focus on risk-reward, inflation protection, and portfolio fit.

      Return JSON array with format: [{"symbol": "GOLD", "rationale": "..."}]`;

      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const responseText = result.text || '';
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        const rationales = JSON.parse(jsonMatch[0]);
        return recommendations.map(rec => {
          const aiData = rationales.find((r: any) => r.symbol === rec.symbol);
          return {
            ...rec,
            aiRationale: aiData?.rationale || this.generateRuleBasedRationale(rec, params)
          };
        });
      }
    } catch (error) {
      console.error('Error generating AI rationales:', error);
    }

    return recommendations.map(rec => ({
      ...rec,
      aiRationale: this.generateRuleBasedRationale(rec, params)
    }));
  }

  private generateRuleBasedRationale(rec: CommodityRecommendation, params: CommodityRecommendationParams): string {
    const parts: string[] = [];

    if (rec.inflationHedge && params.inflationProtection) {
      parts.push(`${rec.name} serves as an effective inflation hedge, protecting your purchasing power.`);
    }

    if (rec.safeHaven && params.safeHavenAllocation) {
      parts.push(`As a safe haven asset, ${rec.name} provides stability during market uncertainty.`);
    }

    if (rec.returns1y > 15) {
      parts.push(`With ${rec.returns1y.toFixed(1)}% returns over the past year, ${rec.name} shows strong momentum.`);
    }

    if (rec.volatility < 15) {
      parts.push(`Low volatility of ${rec.volatility.toFixed(1)}% aligns with your ${params.riskTolerance} risk profile.`);
    }

    if (parts.length === 0) {
      parts.push(`${rec.name} offers diversification benefits and exposure to the ${rec.commodityType.replace('_', ' ')} sector.`);
    }

    return parts.slice(0, 2).join(' ');
  }

  private buildPortfolioSummary(
    recommendations: CommodityRecommendation[],
    params: CommodityRecommendationParams
  ): CommodityPortfolioSummary {
    const totalInvestment = params.investmentAmount;
    
    const weightedReturn = recommendations.reduce((sum, r) => 
      sum + (r.returns1y * r.suggestedAllocation / 100), 0);
    
    const weightedVolatility = recommendations.reduce((sum, r) => 
      sum + (r.volatility * r.suggestedAllocation / 100), 0);
    
    const uniqueTypes = new Set(recommendations.map(r => r.commodityType)).size;
    const diversificationScore = Math.min(100, uniqueTypes * 25);
    
    const inflationHedgeAllocation = recommendations
      .filter(r => r.inflationHedge)
      .reduce((sum, r) => sum + r.suggestedAllocation, 0);
    const inflationProtectionScore = Math.min(100, inflationHedgeAllocation * 1.5);

    const allocationBreakdown = {
      preciousMetals: recommendations
        .filter(r => r.commodityType === 'precious_metal')
        .reduce((sum, r) => sum + r.suggestedAllocation, 0),
      energy: recommendations
        .filter(r => r.commodityType === 'energy')
        .reduce((sum, r) => sum + r.suggestedAllocation, 0),
      industrialMetals: recommendations
        .filter(r => r.commodityType === 'industrial_metal')
        .reduce((sum, r) => sum + r.suggestedAllocation, 0),
      agricultural: recommendations
        .filter(r => r.commodityType === 'agricultural')
        .reduce((sum, r) => sum + r.suggestedAllocation, 0)
    };

    const riskAnalysis = {
      priceVolatilityRisk: weightedVolatility > 25 ? 'high' as const : weightedVolatility > 15 ? 'medium' as const : 'low' as const,
      currencyRisk: allocationBreakdown.energy > 30 ? 'high' as const : 'medium' as const,
      storageRisk: recommendations.some(r => r.investmentVehicle === 'physical') ? 'medium' as const : 'low' as const,
      liquidityRisk: recommendations.some(r => r.investmentVehicle === 'futures') ? 'medium' as const : 'low' as const
    };

    const portfolioRationale = this.generatePortfolioRationale(recommendations, params, allocationBreakdown);

    return {
      totalInvestment,
      expectedAnnualReturn: Math.round(weightedReturn * 100) / 100,
      portfolioVolatility: Math.round(weightedVolatility * 100) / 100,
      diversificationScore,
      inflationProtectionScore,
      recommendations,
      portfolioRationale,
      riskAnalysis,
      allocationBreakdown
    };
  }

  private generatePortfolioRationale(
    recommendations: CommodityRecommendation[],
    params: CommodityRecommendationParams,
    breakdown: CommodityPortfolioSummary['allocationBreakdown']
  ): string {
    const parts: string[] = [];

    if (breakdown.preciousMetals > 50) {
      parts.push(`Portfolio emphasizes precious metals (${breakdown.preciousMetals.toFixed(0)}%) for stability and inflation protection.`);
    }

    if (params.inflationProtection) {
      const hedgeCount = recommendations.filter(r => r.inflationHedge).length;
      parts.push(`${hedgeCount} inflation-hedging commodities included to protect purchasing power.`);
    }

    if (params.safeHavenAllocation) {
      const safeHavenCount = recommendations.filter(r => r.safeHaven).length;
      parts.push(`${safeHavenCount} safe haven assets provide downside protection.`);
    }

    parts.push(`Diversified across ${recommendations.length} commodities to manage concentration risk.`);

    return parts.join(' ');
  }

  async getClientCommodityProfile(clientId: string): Promise<CommodityRecommendationParams | null> {
    try {
      const profile = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, clientId))
        .limit(1);

      if (profile.length === 0) return null;

      const p = profile[0];
      
      return {
        investmentAmount: 100000,
        investmentHorizon: this.mapHorizon(p.investmentHorizon),
        riskTolerance: this.mapRiskTolerance(p.riskAppetite),
        preferredCommodityTypes: ['precious_metal', 'energy'],
        investmentVehicle: 'any',
        inflationProtection: true,
        safeHavenAllocation: p.riskAppetite === 'conservative',
        portfolioDiversification: true,
        clientId
      };
    } catch (error) {
      console.error('Error fetching client profile:', error);
      return null;
    }
  }

  private mapHorizon(horizon: string | null): 'short' | 'medium' | 'long' {
    if (!horizon) return 'medium';
    if (horizon.includes('short') || horizon.includes('1-3')) return 'short';
    if (horizon.includes('long') || horizon.includes('7') || horizon.includes('10')) return 'long';
    return 'medium';
  }

  private mapRiskTolerance(risk: string | null): CommodityRecommendationParams['riskTolerance'] {
    if (!risk) return 'moderate';
    const lower = risk.toLowerCase();
    if (lower.includes('conservative')) return 'conservative';
    if (lower.includes('aggressive')) return 'aggressive';
    return 'moderate';
  }
}

export const aiCommodityRecommendationService = new AICommodityRecommendationService();
