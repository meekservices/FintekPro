import { GoogleGenAI } from "@google/genai";

export interface UnlistedStockAsset {
  id: string;
  name: string;
  cin?: string;
  sector?: string;
  industry?: string;
  listingStage?: string;
  publishedBuyPrice?: string;
  publishedSellPrice?: string;
  paidUpCapital?: string;
  revenue?: string;
  pat?: string;
  networth?: string;
  peRatio?: string;
  pbRatio?: string;
  roe?: string;
  debtToEquity?: string;
  revenueGrowth?: string;
  profitGrowth?: string;
  complianceStatus?: string;
  complianceRiskScore?: number;
}

export interface UserProfile {
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  investmentHorizon?: 'short_term' | 'medium_term' | 'long_term';
  investmentGoal?: 'income' | 'growth' | 'balanced' | 'capital_preservation';
  investmentAmount?: number;
}

export interface AIUnlistedRecommendation {
  companyId: string;
  name: string;
  sector: string;
  listingStage: string;
  currentPrice: string;
  aiSignal: 'buy' | 'hold' | 'avoid';
  aiConfidence: string;
  aiRationale: string;
  aiTargetPrice: string;
  riskLevel: string;
  suitabilityScore: number;
  potentialUpside: string;
  keyRisks: string[];
  keyStrengths: string[];
}

class AIUnlistedRecommendationService {
  private genAI: GoogleGenAI | null = null;
  private isInitialized: boolean = false;

  constructor() {
    const apiKey = process.env.AI_INTEGRATIONS_GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      this.isInitialized = true;
      console.log('✅ AI Unlisted Stock Recommendation Service initialized with Gemini');
    } else {
      console.warn('⚠️ AI Unlisted Stock Recommendation Service: No Gemini API key configured. Using fallback recommendations.');
    }
  }

  async generatePersonalizedRecommendations(
    assets: UnlistedStockAsset[],
    userProfile: UserProfile
  ): Promise<AIUnlistedRecommendation[]> {
    if (!this.isInitialized) {
      return this.getDefaultRecommendations(assets, userProfile);
    }

    if (!assets || assets.length === 0) {
      return [];
    }

    try {
      const prompt = `You are a SEBI-compliant investment advisor specializing in pre-IPO and unlisted stocks in India.

## User Profile
- Risk Profile: ${userProfile.riskProfile}
- Investment Horizon: ${userProfile.investmentHorizon || 'medium_term'}
- Investment Goal: ${userProfile.investmentGoal || 'growth'}
${userProfile.investmentAmount ? `- Investment Amount: ₹${userProfile.investmentAmount.toLocaleString()}` : ''}

## Available Unlisted Stocks
${JSON.stringify(assets, null, 2)}

## Task
Analyze and recommend the TOP 5 unlisted/pre-IPO stocks for this investor. For each:
1. aiSignal: "buy", "hold", or "avoid"
2. aiConfidence: confidence percentage (0-100) as string
3. aiRationale: 2-3 sentence explanation tailored to user's profile
4. aiTargetPrice: 12-24 month target price as string (estimate based on fundamentals)
5. suitabilityScore: 1-100 based on profile fit
6. potentialUpside: estimated upside percentage as string
7. keyRisks: array of 2-3 main risks
8. keyStrengths: array of 2-3 main strengths
9. riskLevel: "low", "moderate", "high", or "very_high"

Consider:
- Pre-IPO/unlisted stocks are inherently HIGH RISK - conservative investors should see very few recommendations
- Compliance status (avoid companies with compliance issues)
- Financial health (P/E ratio, debt levels, profitability)
- Growth trajectory (revenue and profit growth)
- Listing stage (pre_ipo stocks have potential IPO upside)
- Sector alignment with user's goals
- Liquidity risks (unlisted shares are harder to sell)

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
                companyId: { type: "string" },
                name: { type: "string" },
                sector: { type: "string" },
                listingStage: { type: "string" },
                currentPrice: { type: "string" },
                aiSignal: { type: "string" },
                aiConfidence: { type: "string" },
                aiRationale: { type: "string" },
                aiTargetPrice: { type: "string" },
                riskLevel: { type: "string" },
                suitabilityScore: { type: "number" },
                potentialUpside: { type: "string" },
                keyRisks: { type: "array", items: { type: "string" } },
                keyStrengths: { type: "array", items: { type: "string" } }
              },
              required: ["companyId", "name", "aiSignal", "aiConfidence", "aiRationale", "suitabilityScore", "riskLevel"]
            }
          }
        },
        contents: prompt,
      });

      const responseText = response.text || "[]";
      // Handle both string and object responses to prevent "[object Object]" JSON parsing errors
      const recommendations = typeof responseText === 'object' ? responseText : JSON.parse(responseText);
      
      if (!Array.isArray(recommendations) || recommendations.length === 0) {
        console.warn('AI returned empty unlisted recommendations, using fallback');
        return this.getDefaultRecommendations(assets, userProfile);
      }
      
      return recommendations.slice(0, 5);
    } catch (error) {
      console.error('AI Unlisted Stock recommendation error:', error);
      return this.getDefaultRecommendations(assets, userProfile);
    }
  }

  private getDefaultRecommendations(
    assets: UnlistedStockAsset[],
    userProfile: UserProfile
  ): AIUnlistedRecommendation[] {
    if (!assets || assets.length === 0) return [];

    const riskMultiplier = userProfile.riskProfile === 'conservative' ? 0.5 
      : userProfile.riskProfile === 'moderate' ? 1.0 
      : 1.5;

    const scored = assets
      .filter(a => a.complianceStatus !== 'blocked')
      .map(asset => {
        let score = 50;
        
        if (asset.listingStage === 'pre_ipo') score += 15;
        if (asset.listingStage === 'growth') score += 10;
        
        const roe = parseFloat(asset.roe || '0');
        if (roe > 20) score += 15;
        else if (roe > 10) score += 10;
        else if (roe > 0) score += 5;
        
        const debtToEquity = parseFloat(asset.debtToEquity || '0');
        if (debtToEquity < 0.5) score += 10;
        else if (debtToEquity < 1) score += 5;
        else if (debtToEquity > 2) score -= 10;
        
        const revenueGrowth = parseFloat(asset.revenueGrowth || '0');
        if (revenueGrowth > 30) score += 15;
        else if (revenueGrowth > 15) score += 10;
        else if (revenueGrowth > 0) score += 5;
        
        if (asset.complianceRiskScore && asset.complianceRiskScore > 50) {
          score -= 20;
        }

        score = Math.round(score * riskMultiplier);
        score = Math.min(100, Math.max(0, score));

        const riskLevel = debtToEquity > 1.5 || asset.complianceRiskScore! > 50 ? 'high'
          : debtToEquity > 0.8 || !asset.pat ? 'moderate'
          : 'low';

        const priceStr = asset.publishedBuyPrice || asset.publishedSellPrice || '0';
        const price = parseFloat(priceStr) || 0;
        const safeRevenueGrowth = isNaN(revenueGrowth) ? 0 : revenueGrowth;
        const targetPrice = price > 0 ? price * (1 + safeRevenueGrowth / 100 * 0.5) : 0;
        const confidence = Math.min(85, 50 + score * 0.35);
        
        return {
          companyId: asset.id,
          name: asset.name,
          sector: asset.sector || 'Unknown',
          listingStage: asset.listingStage || 'unlisted',
          currentPrice: String(price.toFixed(2)),
          aiSignal: (score >= 70 ? 'buy' : score >= 40 ? 'hold' : 'avoid') as 'buy' | 'hold' | 'avoid',
          aiConfidence: confidence.toFixed(1),
          aiRationale: this.generateRationale(asset, userProfile, score),
          aiTargetPrice: targetPrice.toFixed(2),
          riskLevel,
          suitabilityScore: score,
          potentialUpside: `${Math.max(0, safeRevenueGrowth * 0.5).toFixed(1)}%`,
          keyRisks: this.getKeyRisks(asset),
          keyStrengths: this.getKeyStrengths(asset),
        };
      })
      .sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    return scored.slice(0, 5);
  }

  private generateRationale(asset: UnlistedStockAsset, userProfile: UserProfile, score: number): string {
    const parts: string[] = [];
    
    if (asset.listingStage === 'pre_ipo') {
      parts.push('Pre-IPO stage offers potential listing gains');
    }
    
    const roe = parseFloat(asset.roe || '0');
    if (roe > 15) {
      parts.push(`strong ROE of ${roe}%`);
    }
    
    const revenueGrowth = parseFloat(asset.revenueGrowth || '0');
    if (revenueGrowth > 20) {
      parts.push(`impressive ${revenueGrowth}% revenue growth`);
    }
    
    if (userProfile.riskProfile === 'conservative' && score < 60) {
      parts.push('higher risk may not suit conservative investors');
    }
    
    if (parts.length === 0) {
      return `${asset.name} in the ${asset.sector || 'diversified'} sector with moderate fundamentals. Consider based on your risk appetite.`;
    }
    
    return `${asset.name} shows ${parts.slice(0, 2).join(' and ')}. ${parts.length > 2 ? parts[2] : ''}`;
  }

  private getKeyRisks(asset: UnlistedStockAsset): string[] {
    const risks: string[] = ['Low liquidity - may be difficult to exit'];
    
    const debtToEquity = parseFloat(asset.debtToEquity || '0');
    if (debtToEquity > 1) {
      risks.push('High debt levels');
    }
    
    if (!asset.pat || parseFloat(asset.pat) <= 0) {
      risks.push('Not yet profitable');
    }
    
    if (asset.complianceRiskScore && asset.complianceRiskScore > 30) {
      risks.push('Compliance concerns flagged');
    }
    
    return risks.slice(0, 3);
  }

  private getKeyStrengths(asset: UnlistedStockAsset): string[] {
    const strengths: string[] = [];
    
    const revenueGrowth = parseFloat(asset.revenueGrowth || '0');
    if (revenueGrowth > 20) {
      strengths.push('Strong revenue growth');
    }
    
    const roe = parseFloat(asset.roe || '0');
    if (roe > 15) {
      strengths.push('High return on equity');
    }
    
    if (asset.listingStage === 'pre_ipo') {
      strengths.push('IPO potential for listing gains');
    }
    
    const debtToEquity = parseFloat(asset.debtToEquity || '0');
    if (debtToEquity < 0.5) {
      strengths.push('Conservative debt levels');
    }
    
    if (strengths.length === 0) {
      strengths.push('Established business operations');
    }
    
    return strengths.slice(0, 3);
  }
}

export const aiUnlistedRecommendationService = new AIUnlistedRecommendationService();
