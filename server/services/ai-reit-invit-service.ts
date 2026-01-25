import { GoogleGenAI } from "@google/genai";

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
  private genAI: GoogleGenAI | null = null;
  private isInitialized: boolean = false;

  constructor() {
    const apiKey = process.env.AI_INTEGRATIONS_GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      this.isInitialized = true;
      console.log('✅ AI REIT/InvIT Recommendation Service initialized with Gemini');
    } else {
      console.warn('⚠️ AI REIT/InvIT Recommendation Service: No Gemini API key configured. Using fallback recommendations.');
    }
  }

  async generatePersonalizedRecommendations(
    assets: ReitInvitAsset[],
    userProfile: UserProfile
  ): Promise<AIRecommendation[]> {
    if (!this.isInitialized) {
      return this.getDefaultRecommendations(assets, userProfile);
    }

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

      const response = await this.genAI!.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "array",
            items: {
              type: "object",
              properties: {
                symbol: { type: "string" },
                name: { type: "string" },
                type: { type: "string" },
                sector: { type: "string" },
                currentPrice: { type: "string" },
                distributionYield: { type: "string" },
                aiSignal: { type: "string" },
                aiConfidence: { type: "string" },
                aiRationale: { type: "string" },
                aiTargetPrice: { type: "string" },
                riskLevel: { type: "string" },
                suitabilityScore: { type: "number" }
              },
              required: ["symbol", "name", "type", "aiSignal", "aiConfidence", "aiRationale", "suitabilityScore"]
            }
          }
        },
        contents: prompt,
      });

      const responseText = response.text || "[]";
      // Handle both string and object responses to prevent "[object Object]" JSON parsing errors
      const recommendations = typeof responseText === 'object' ? responseText : JSON.parse(responseText);
      
      if (!Array.isArray(recommendations) || recommendations.length === 0) {
        console.warn('AI returned empty recommendations, using fallback');
        return this.getDefaultRecommendations(assets, userProfile);
      }
      
      return recommendations.slice(0, 5);
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
    if (!this.isInitialized) {
      return {
        analysis: `${asset.name} is a ${asset.type.toUpperCase()} in the ${asset.sector} sector offering ${asset.distributionYield}% yield.`,
        strengths: ['Strong distribution yield', 'Quality sponsor backing', 'Diversified portfolio'],
        risks: ['Market volatility', 'Interest rate sensitivity', 'Sector-specific risks'],
        outlook: 'Stable outlook with potential for yield improvement.'
      };
    }

    try {
      const prompt = `Analyze this ${asset.type === 'reit' ? 'Real Estate Investment Trust' : 'Infrastructure Investment Trust'}:

${JSON.stringify(asset, null, 2)}

Provide:
1. analysis: Brief 2-3 sentence overall assessment
2. strengths: Array of 3 key strengths
3. risks: Array of 3 key risks
4. outlook: 1-2 sentence forward-looking view

Return as JSON object.`;

      const response = await this.genAI!.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              analysis: { type: "string" },
              strengths: { type: "array", items: { type: "string" } },
              risks: { type: "array", items: { type: "string" } },
              outlook: { type: "string" }
            },
            required: ["analysis", "strengths", "risks", "outlook"]
          }
        },
        contents: prompt,
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error('AI asset analysis error:', error);
      return {
        analysis: `${asset.name} is a ${asset.type.toUpperCase()} offering ${asset.distributionYield}% distribution yield.`,
        strengths: ['Consistent yield distribution', 'Quality asset portfolio', 'Strong sponsor'],
        risks: ['Market conditions', 'Interest rate changes', 'Sector headwinds'],
        outlook: 'Stable outlook with growth potential.'
      };
    }
  }
}

export const aiReitInvitService = new AIReitInvitService();
