import { GoogleGenAI } from '@google/genai';
import { logger } from '../logger';
import type { PortfolioData, UserProfile } from '../ai-portfolio-service';
import { realtimeMarketService, type MarketQuote } from './realtime-market-service';
import { newsSentimentService, type NewsArticle } from './news-sentiment-service';

export interface PortfolioHealthMetrics {
  overallScore: number; // 0-100
  diversificationScore: number;
  riskScore: number;
  performanceScore: number;
  liquidityScore: number;
  healthStatus: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface MarketPrediction {
  symbol: string;
  currentPrice: number;
  predictions: {
    timeframe: '1day' | '1week' | '1month' | '3months';
    predictedPrice: number;
    priceChange: number;
    priceChangePercent: number;
    confidence: number; // 0-100
    direction: 'bullish' | 'bearish' | 'neutral';
  }[];
  reasoning: string[];
  riskFactors: string[];
  opportunities: string[];
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  generatedAt: string;
}

export interface PersonalizedRecommendation {
  id: string;
  type: 'buy' | 'sell' | 'rebalance' | 'alert';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reasoning: string[];
  actionSteps: string[];
  expectedImpact: {
    returns: string;
    risk: string;
    timeline: string;
  };
  symbols: string[];
  estimatedCost?: number;
  urgency: 'immediate' | 'this_week' | 'this_month' | 'flexible';
}

class AIPortfolioEnhancedService {
  private geminiClient: GoogleGenAI | null;

  constructor() {
    const geminiKey = process.env.GEMINI_API_KEY || '';
    if (!geminiKey) {
      logger.warn('GEMINI_API_KEY not configured, AI portfolio analysis features will return default values');
      this.geminiClient = null;
    } else {
      this.geminiClient = new GoogleGenAI({ apiKey: geminiKey });
    }
  }

  /**
   * Check if Gemini client is available
   */
  isAvailable(): boolean {
    return this.geminiClient !== null;
  }

  /**
   * Comprehensive portfolio health analysis using Gemini 2.5 Pro
   */
  async analyzePortfolioHealth(
    portfolio: PortfolioData,
    userProfile: UserProfile
  ): Promise<PortfolioHealthMetrics> {
    if (!this.geminiClient) {
      logger.warn('Gemini client not available, returning default values for analyzePortfolioHealth');
      return {
        overallScore: 50,
        diversificationScore: 50,
        riskScore: 50,
        performanceScore: 50,
        liquidityScore: 50,
        healthStatus: 'fair',
        recommendations: [],
        strengths: [],
        weaknesses: [],
      };
    }

    try {
      const prompt = `Analyze this investment portfolio comprehensively. Return ONLY a JSON object:
{
  "overallScore": <0-100>,
  "diversificationScore": <0-100>,
  "riskScore": <0-100>,
  "performanceScore": <0-100>,
  "liquidityScore": <0-100>,
  "healthStatus": "<excellent|good|fair|poor>",
  "recommendations": [<array of 5-7 specific recommendations>],
  "strengths": [<array of 3-5 portfolio strengths>],
  "weaknesses": [<array of 3-5 portfolio weaknesses>]
}

Portfolio Data:
- Total Value: ₹${portfolio.totalValue}
- Holdings: ${portfolio.holdings.length} positions
- Asset Allocation: ${JSON.stringify(portfolio.assetAllocation)}
- Performance: ${portfolio.performance.totalGainLossPercent}% total return

User Profile:
- Age: ${userProfile.age}
- Risk Tolerance: ${userProfile.riskTolerance}
- Time Horizon: ${userProfile.timeHorizon} years
- Investment Goals: ${userProfile.investmentGoals.join(', ')}

Analyze diversification, risk exposure, performance metrics, liquidity, and alignment with user profile.`;

      const response = await this.geminiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseMimeType: 'application/json',
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      let result;
      try {
        result = JSON.parse(resultText);
      } catch (parseError) {
        logger.error('Failed to parse Gemini portfolio health response', { parseError, resultText });
        result = {};
      }
      
      return {
        overallScore: Math.max(0, Math.min(100, result.overallScore || 50)),
        diversificationScore: Math.max(0, Math.min(100, result.diversificationScore || 50)),
        riskScore: Math.max(0, Math.min(100, result.riskScore || 50)),
        performanceScore: Math.max(0, Math.min(100, result.performanceScore || 50)),
        liquidityScore: Math.max(0, Math.min(100, result.liquidityScore || 50)),
        healthStatus: result.healthStatus || 'fair',
        recommendations: result.recommendations || [],
        strengths: result.strengths || [],
        weaknesses: result.weaknesses || [],
      };
    } catch (error) {
      logger.error('Portfolio health analysis error', { error: String(error) });
      return {
        overallScore: 50,
        diversificationScore: 50,
        riskScore: 50,
        performanceScore: 50,
        liquidityScore: 50,
        healthStatus: 'fair',
        recommendations: [],
        strengths: [],
        weaknesses: [],
      };
    }
  }

  /**
   * Market prediction engine using multi-model ensemble
   */
  async predictMarketMovement(
    symbol: string,
    historicalData?: any[]
  ): Promise<MarketPrediction> {
    if (!this.geminiClient) {
      logger.warn('Gemini client not available, returning default values for predictMarketMovement');
      return {
        symbol,
        currentPrice: 0,
        predictions: [],
        reasoning: [],
        riskFactors: [],
        opportunities: [],
        recommendation: 'hold',
        generatedAt: new Date().toISOString(),
      };
    }

    try {
      // Get current quote - handle null gracefully
      const currentQuote = await realtimeMarketService.getQuote(symbol);
      
      if (!currentQuote) {
        logger.warn('Failed to get quote for symbol, returning default prediction', { symbol });
        return {
          symbol,
          currentPrice: 0,
          predictions: [],
          reasoning: [],
          riskFactors: [],
          opportunities: [],
          recommendation: 'hold',
          generatedAt: new Date().toISOString(),
        };
      }

      // Get recent news sentiment - handle null gracefully
      const news = await newsSentimentService.getFinancialNews({
        query: symbol,
        limit: 10,
      }).catch(() => []);

      const newsSentiment = news.length > 0
        ? news.reduce((sum, n) => sum + n.sentiment.score, 0) / news.length
        : 0;

      // Build comprehensive analysis prompt
      const prompt = `Predict future price movements for ${symbol}. Return ONLY a JSON object:
{
  "predictions": [
    {
      "timeframe": "1day",
      "predictedPrice": <number>,
      "priceChange": <number>,
      "priceChangePercent": <number>,
      "confidence": <0-100>,
      "direction": "<bullish|bearish|neutral>"
    },
    {
      "timeframe": "1week",
      "predictedPrice": <number>,
      "priceChange": <number>,
      "priceChangePercent": <number>,
      "confidence": <0-100>,
      "direction": "<bullish|bearish|neutral>"
    },
    {
      "timeframe": "1month",
      "predictedPrice": <number>,
      "priceChange": <number>,
      "priceChangePercent": <number>,
      "confidence": <0-100>,
      "direction": "<bullish|bearish|neutral>"
    },
    {
      "timeframe": "3months",
      "predictedPrice": <number>,
      "priceChange": <number>,
      "priceChangePercent": <number>,
      "confidence": <0-100>,
      "direction": "<bullish|bearish|neutral>"
    }
  ],
  "reasoning": [<array of key reasons for predictions>],
  "riskFactors": [<array of identified risk factors>],
  "opportunities": [<array of potential opportunities>],
  "recommendation": "<strong_buy|buy|hold|sell|strong_sell>"
}

Current Data:
- Symbol: ${symbol}
- Current Price: $${currentQuote.price}
- Day Change: ${currentQuote.changePercent}%
- High: $${currentQuote.high}, Low: $${currentQuote.low}
- News Sentiment: ${newsSentiment > 0 ? 'Positive' : newsSentiment < 0 ? 'Negative' : 'Neutral'} (${newsSentiment.toFixed(2)})
- Recent News: ${news.slice(0, 3).map(n => n.title).join('; ')}

Consider technical indicators, market sentiment, news impact, and broader market trends.`;

      const response = await this.geminiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseMimeType: 'application/json',
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      let result;
      try {
        result = JSON.parse(resultText);
      } catch (parseError) {
        logger.error('Failed to parse Gemini market prediction response', { parseError, resultText });
        result = {};
      }

      return {
        symbol,
        currentPrice: currentQuote.price,
        predictions: result.predictions || [],
        reasoning: result.reasoning || [],
        riskFactors: result.riskFactors || [],
        opportunities: result.opportunities || [],
        recommendation: result.recommendation || 'hold',
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Market prediction error', { symbol, error: String(error) });
      return {
        symbol,
        currentPrice: 0,
        predictions: [],
        reasoning: [],
        riskFactors: [],
        opportunities: [],
        recommendation: 'hold',
        generatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Generate personalized investment recommendations
   */
  async generatePersonalizedRecommendations(
    portfolio: PortfolioData,
    userProfile: UserProfile,
    marketConditions?: {
      quotes: MarketQuote[];
      news: NewsArticle[];
    }
  ): Promise<PersonalizedRecommendation[]> {
    if (!this.geminiClient) {
      logger.warn('Gemini client not available, returning default values for generatePersonalizedRecommendations');
      return [];
    }

    try {
      const prompt = `Generate personalized investment recommendations. Return ONLY a JSON array:
[
  {
    "type": "<buy|sell|rebalance|alert>",
    "priority": "<high|medium|low>",
    "title": "recommendation title",
    "description": "detailed description",
    "reasoning": [<array of reasons>],
    "actionSteps": [<array of specific action steps>],
    "expectedImpact": {
      "returns": "expected returns description",
      "risk": "risk assessment",
      "timeline": "expected timeline"
    },
    "symbols": [<array of affected symbols>],
    "estimatedCost": <number or null>,
    "urgency": "<immediate|this_week|this_month|flexible>"
  }
]

Portfolio:
- Total Value: ₹${portfolio.totalValue}
- Current Allocation: ${JSON.stringify(portfolio.assetAllocation)}
- Top Holdings: ${portfolio.holdings.slice(0, 5).map(h => `${h.symbol} (${h.assetType})`).join(', ')}
- Performance: ${portfolio.performance.totalGainLossPercent}%

User Profile:
- Age: ${userProfile.age}
- Risk Tolerance: ${userProfile.riskTolerance}
- Time Horizon: ${userProfile.timeHorizon} years
- Goals: ${userProfile.investmentGoals.join(', ')}
- Monthly Income: ${userProfile.monthlyIncome ? '₹' + userProfile.monthlyIncome : 'Not provided'}

Generate 5-10 actionable recommendations based on:
1. Portfolio optimization opportunities
2. Market conditions and trends
3. User's risk profile and goals
4. Diversification gaps
5. Tax optimization
6. Risk management`;

      const response = await this.geminiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseMimeType: 'application/json',
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      
      let recommendations;
      try {
        recommendations = JSON.parse(resultText);
      } catch (parseError) {
        logger.error('Failed to parse Gemini recommendations response', { parseError, resultText });
        recommendations = [];
      }

      return recommendations.map((rec: any, index: number) => ({
        id: `rec-${Date.now()}-${index}`,
        type: rec.type || 'alert',
        priority: rec.priority || 'medium',
        title: rec.title || 'Investment Recommendation',
        description: rec.description || '',
        reasoning: rec.reasoning || [],
        actionSteps: rec.actionSteps || [],
        expectedImpact: rec.expectedImpact || {
          returns: 'Not specified',
          risk: 'Medium',
          timeline: '6-12 months',
        },
        symbols: rec.symbols || [],
        estimatedCost: rec.estimatedCost,
        urgency: rec.urgency || 'flexible',
      }));
    } catch (error) {
      logger.error('Personalized recommendations error', { error: String(error) });
      return [];
    }
  }

  /**
   * Multi-symbol portfolio prediction
   */
  async predictPortfolioPerformance(
    portfolio: PortfolioData,
    timeframe: '1month' | '3months' | '6months' | '1year'
  ): Promise<{
    expectedReturn: number;
    expectedReturnPercent: number;
    confidence: number;
    breakdown: Array<{
      symbol: string;
      contribution: number;
      prediction: number;
    }>;
    scenarios: {
      optimistic: { return: number; probability: number };
      realistic: { return: number; probability: number };
      pessimistic: { return: number; probability: number };
    };
  }> {
    if (!this.geminiClient) {
      logger.warn('Gemini client not available, returning default values for predictPortfolioPerformance');
      return {
        expectedReturn: 0,
        expectedReturnPercent: 0,
        confidence: 0,
        breakdown: [],
        scenarios: {
          optimistic: { return: 0, probability: 0 },
          realistic: { return: 0, probability: 0 },
          pessimistic: { return: 0, probability: 0 },
        },
      };
    }

    try {
      const symbols = portfolio.holdings.slice(0, 10).map(h => h.symbol);
      const predictions = await Promise.all(
        symbols.map(symbol => this.predictMarketMovement(symbol))
      );

      const prompt = `Predict overall portfolio performance for ${timeframe}. Return ONLY a JSON object:
{
  "expectedReturn": <number in currency>,
  "expectedReturnPercent": <number>,
  "confidence": <0-100>,
  "breakdown": [
    {
      "symbol": "symbol",
      "contribution": <number in currency>,
      "prediction": <predicted price change %>
    }
  ],
  "scenarios": {
    "optimistic": { "return": <number>, "probability": <0-100> },
    "realistic": { "return": <number>, "probability": <0-100> },
    "pessimistic": { "return": <number>, "probability": <0-100> }
  }
}

Current Portfolio Value: ₹${portfolio.totalValue}
Holdings with Predictions:
${predictions.map((pred, i) => {
  const holding = portfolio.holdings.find(h => h.symbol === pred.symbol);
  const timeframePred = pred.predictions.find(p => p.timeframe === timeframe);
  return `${pred.symbol}: Current ₹${holding?.currentValue || 0}, Predicted ${timeframePred?.priceChangePercent || 0}%`;
}).join('\n')}

Consider market correlations, diversification effects, and risk factors.`;

      const response = await this.geminiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseMimeType: 'application/json',
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      try {
        return JSON.parse(resultText);
      } catch (parseError) {
        logger.error('Failed to parse Gemini portfolio prediction response', { parseError, resultText });
        return {
          expectedReturn: 0,
          expectedReturnPercent: 0,
          confidence: 0,
          breakdown: [],
          scenarios: {
            optimistic: { return: 0, probability: 0 },
            realistic: { return: 0, probability: 0 },
            pessimistic: { return: 0, probability: 0 },
          },
        };
      }
    } catch (error) {
      logger.error('Portfolio prediction error', { error: String(error) });
      return {
        expectedReturn: 0,
        expectedReturnPercent: 0,
        confidence: 0,
        breakdown: [],
        scenarios: {
          optimistic: { return: 0, probability: 0 },
          realistic: { return: 0, probability: 0 },
          pessimistic: { return: 0, probability: 0 },
        },
      };
    }
  }
}

export const aiPortfolioEnhancedService = new AIPortfolioEnhancedService();
