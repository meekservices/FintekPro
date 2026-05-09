import { unifiedAIRecommendationEngine } from "./unified-ai-recommendation-engine";

export interface ReitInvitAsset {
  type: 'reit' | 'invit';
  symbol: string;
  name: string;
  sector: string;
  currentPrice: string;
  distributionYield: string;
  returns1Y: string | null;
  riskLevel: string;
  creditRating: string;
  occupancyRate?: string;
  concessionLife?: string;
  premiumToNav: string;
  sponsor: string;
}

export interface UserProfile {
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  investmentHorizon?: 'short_term' | 'medium_term' | 'long_term';
  investmentGoal?: 'income' | 'growth' | 'balanced' | 'capital_preservation';
  investmentAmount?: number;
}

export interface AIRecommendation {
  symbol: string;
  name: string;
  type: 'reit' | 'invit';
  sector: string;
  currentPrice: string;
  distributionYield: string;
  aiSignal: 'buy' | 'hold' | 'sell';
  aiConfidence: string;
  aiRationale: string;
  aiTargetPrice: string;
  riskLevel: string;
  suitabilityScore: number;
}

class AIReitInvitService {
  constructor() {
    const status = unifiedAIRecommendationEngine.getStatus();
    console.log(`✅ AI REIT/InvIT Recommendation Service initialized via Unified Engine (primary: ${status.primary})`);
  }

  async generatePersonalizedRecommendations(
    assets: ReitInvitAsset[],
    userProfile: UserProfile
  ): Promise<AIRecommendation[]> {
    try {
      const prompt = `You are a SEBI-compliant investment advisor specializing in REITs and InvITs in India.

## User Profile
- Risk Profile: ${userProfile.riskProfile}
- Investment Horizon: ${userProfile.investmentHorizon || 'medium_term'}
- Investment Goal: ${userProfile.investmentGoal || 'balanced'}
${userProfile.investmentAmount ? `- Investment Amount: ₹${userProfile.investmentAmount.toLocaleString()}` : ''}

## Available Assets
${JSON.stringify(assets, null, 2)}

## Task
Analyze and recommend the TOP 5 assets for this investor. For each:
1. aiSignal: "buy", "hold", or "sell"
2. aiConfidence: confidence percentage (0-100) as string
3. aiRationale: 2-3 sentence explanation tailored to user's profile
4. aiTargetPrice: 12-month target price as string
5. suitabilityScore: 1-100 based on profile fit

Consider:
- Risk alignment (conservative = low-risk assets only)
- Yield for income-focused users
- Growth potential for growth-focused users
- Credit ratings and sponsor quality
- Diversification across sectors

Return JSON array sorted by suitabilityScore (highest first).`;

      const { result } = await unifiedAIRecommendationEngine.runPrompt<AIRecommendation[]>({
        prompt,
        category: 'reits',
        cacheKey: `reit_recs:${userProfile.riskProfile}:${assets.length}`,
        responseParser: (text: string) => {
          const parsed = typeof text === 'object' ? text : JSON.parse(text);
          if (Array.isArray(parsed)) return parsed;
          const jsonMatch = text.match(/\[[\s\S]*\]/);
          if (jsonMatch) return JSON.parse(jsonMatch[0]);
          throw new Error('Could not parse REIT AI response');
        },
        fallback: () => this.getDefaultRecommendations(assets, userProfile),
      });

      if (!Array.isArray(result) || result.length === 0) {
        return this.getDefaultRecommendations(assets, userProfile);
      }
      
      return result.slice(0, 5);
    } catch (error) {
      console.error('AI REIT/InvIT recommendation error:', error);
      return this.getDefaultRecommendations(assets, userProfile);
    }
  }

  private getDefaultRecommendations(
    assets: ReitInvitAsset[],
    userProfile: UserProfile
  ): AIRecommendation[] {
    let filtered = [...assets];
    
    if (userProfile.riskProfile === 'conservative') {
      filtered = filtered.filter(a => a.riskLevel === 'low');
    } else if (userProfile.riskProfile === 'moderate') {
      filtered = filtered.filter(a => a.riskLevel !== 'high');
    }

    if (userProfile.investmentGoal === 'income') {
      filtered.sort((a, b) => parseFloat(b.distributionYield) - parseFloat(a.distributionYield));
    } else if (userProfile.investmentGoal === 'growth') {
      filtered.sort((a, b) => parseFloat(b.returns1Y || '0') - parseFloat(a.returns1Y || '0'));
    }

    return filtered.slice(0, 5).map((asset, index) => ({
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      sector: asset.sector,
      currentPrice: asset.currentPrice,
      distributionYield: asset.distributionYield,
      aiSignal: 'buy' as const,
      aiConfidence: String(85 - index * 3),
      aiRationale: this.generateDefaultRationale(asset, userProfile),
      aiTargetPrice: String((parseFloat(asset.currentPrice) * 1.12).toFixed(2)),
      riskLevel: asset.riskLevel,
      suitabilityScore: 90 - index * 5,
    }));
  }

  private generateDefaultRationale(asset: ReitInvitAsset, userProfile: UserProfile): string {
    const riskMatch = asset.riskLevel === 'low' && userProfile.riskProfile === 'conservative';
    const yieldStr = parseFloat(asset.distributionYield) > 8 ? 'high' : 'attractive';
    
    if (asset.type === 'reit') {
      return `${asset.name} offers ${yieldStr} distribution yield of ${asset.distributionYield}%. ${riskMatch ? 'Aligns well with your conservative risk profile.' : ''} ${asset.occupancyRate ? `Strong occupancy at ${asset.occupancyRate}%.` : ''} Backed by ${asset.sponsor}.`;
    } else {
      return `${asset.name} provides ${yieldStr} yield of ${asset.distributionYield}% with ${asset.concessionLife ? `${asset.concessionLife} years remaining concession life.` : 'long-term cash flow visibility.'} ${riskMatch ? 'Suitable for your risk profile.' : ''} Rated ${asset.creditRating}.`;
    }
  }

  async generateAssetAnalysis(asset: ReitInvitAsset): Promise<{
    analysis: string;
    strengths: string[];
    risks: string[];
    outlook: string;
  }> {
    const defaultAnalysis = {
      analysis: `${asset.name} is a ${asset.type.toUpperCase()} in the ${asset.sector} sector offering ${asset.distributionYield}% yield.`,
      strengths: ['Strong distribution yield', 'Quality sponsor backing', 'Diversified portfolio'],
      risks: ['Market volatility', 'Interest rate sensitivity', 'Sector-specific risks'],
      outlook: 'Stable outlook with potential for yield improvement.'
    };

    try {
      const prompt = `Analyze this ${asset.type === 'reit' ? 'Real Estate Investment Trust' : 'Infrastructure Investment Trust'}:

${JSON.stringify(asset, null, 2)}

Provide:
1. analysis: Brief 2-3 sentence overall assessment
2. strengths: Array of 3 key strengths
3. risks: Array of 3 key risks
4. outlook: 1-2 sentence forward-looking view

Return as JSON object.`;

      const { result } = await unifiedAIRecommendationEngine.runPrompt({
        prompt,
        category: 'reits',
        cacheKey: `reit_analysis:${asset.symbol}`,
        fallback: () => defaultAnalysis,
      });

      return result;
    } catch (error) {
      console.error('AI asset analysis error:', error);
      return defaultAnalysis;
    }
  }
}

export const aiReitInvitService = new AIReitInvitService();
