/**
 * Unified AI Recommendation Engine
 * 
 * A centralized facade that orchestrates all AI-powered recommendation capabilities
 * across all product categories. Integrates with existing services for caching,
 * tracking, explainability, and compliance.
 * 
 * Product Categories Supported:
 * - Stocks, Mutual Funds, AIF, PMS, Bonds, Commodities, REITs, Derivatives, Unlisted
 * 
 * Features:
 * - Product-agnostic analysis with AI scoring and rationale generation
 * - Multi-model fallback (OpenAI primary, Gemini secondary)
 * - Response caching to minimize API costs
 * - Performance tracking for recommendation accuracy
 * - SEBI-compliant explainability and disclosures
 * - KYC-based regulatory guardrails
 * - A/B testing integration for strategy optimization
 */

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { aiResponseCacheService } from "./ai-response-cache-service";
import { aiRecommendationTrackingService } from "./ai-recommendation-tracking-service";
import { abTestingService } from "./ab-testing-service";
import { nanoid } from "nanoid";
import { getEnrichedStockSnapshot } from './screener/enriched-stock-data';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ProductCategory = 
  | 'stocks' 
  | 'mutual_funds' 
  | 'aif' 
  | 'pms' 
  | 'bonds' 
  | 'commodities' 
  | 'reits' 
  | 'derivatives' 
  | 'unlisted';

export type RiskProfile = 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
export type RecommendationAction = 'buy' | 'hold' | 'sell' | 'avoid';
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high';

export interface ProductData {
  id: string;
  name: string;
  category: ProductCategory;
  ticker?: string;
  isin?: string;
  amc?: string;
  fundHouse?: string;
  sector?: string;
  industry?: string;
  
  // Performance metrics
  returns1M?: number;
  returns3M?: number;
  returns6M?: number;
  returns1Y?: number;
  returns3Y?: number;
  returns5Y?: number;
  
  // Risk metrics
  volatility?: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  beta?: number;
  standardDeviation?: number;
  
  // Valuation
  currentPrice?: number;
  nav?: number;
  aum?: number;
  peRatio?: number;
  pbRatio?: number;
  dividendYield?: number;
  
  // Additional metadata
  minInvestment?: number;
  expenseRatio?: number;
  exitLoad?: string;
  lockInPeriod?: string;
  kycRequirement?: 'basic' | 'enhanced' | 'accredited';
  
  // Raw data for AI analysis
  rawData?: Record<string, any>;
}

export interface ClientProfile {
  id: string;
  riskProfile: RiskProfile;
  investmentHorizon: number; // years
  kycTier: 'basic' | 'enhanced' | 'accredited';
  age?: number;
  income?: number;
  netWorth?: number;
  existingHoldings?: { category: ProductCategory; value: number }[];
  goals?: { name: string; targetAmount: number; targetYears: number }[];
  taxBracket?: number;
}

export interface ProductAnalysis {
  productId: string;
  productName: string;
  category: ProductCategory;
  
  // AI-generated scores
  overallScore: number; // 0-100
  riskScore: number; // 0-100 (higher = riskier)
  returnPotentialScore: number; // 0-100
  qualityScore: number; // 0-100
  valuationScore: number; // 0-100
  
  // Classification
  riskProfile: RiskProfile;
  suitabilityScore: number; // 0-100 for given client
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number; // 0-100
  
  // Recommendation
  recommendation: RecommendationAction;
  targetPrice?: number;
  stopLoss?: number;
  expectedReturn: number;
  timeHorizon: 'short' | 'medium' | 'long';
  
  // AI-generated content
  selectionRationale: string;
  investmentThesis: string;
  keyStrengths: string[];
  keyRisks: string[];
  
  // Compliance
  kycRequirement: 'basic' | 'enhanced' | 'accredited';
  regulatoryWarnings: string[];
  disclosures: string[];
  
  // Metadata
  analyzedAt: string;
  modelUsed: 'gemini' | 'openai' | 'rule_based';
  cacheHit: boolean;
}

export interface RankedProduct {
  product: ProductData;
  analysis: ProductAnalysis;
  rank: number;
  matchScore: number; // 0-100 match with client profile
}

export interface RecommendationResult {
  recommendations: RankedProduct[];
  summary: {
    totalAnalyzed: number;
    recommended: number;
    averageScore: number;
    diversificationScore: number;
  };
  clientSuitability: {
    riskAlignment: number;
    horizonAlignment: number;
    kycCompliant: boolean;
  };
  generatedAt: string;
  trackingId: string;
}

export interface SyncResult {
  category: ProductCategory;
  imported: number;
  skipped: number;
  errors: string[];
}

// ============================================================================
// PRODUCT CATEGORY CONFIGURATIONS
// ============================================================================

const CATEGORY_CONFIG: Record<ProductCategory, {
  displayName: string;
  defaultKyc: 'basic' | 'enhanced' | 'accredited';
  typicalHorizon: 'short' | 'medium' | 'long';
  riskMultiplier: number;
  cacheTtlMinutes: number;
}> = {
  stocks: {
    displayName: 'Stocks',
    defaultKyc: 'basic',
    typicalHorizon: 'medium',
    riskMultiplier: 1.2,
    cacheTtlMinutes: 30,
  },
  mutual_funds: {
    displayName: 'Mutual Funds',
    defaultKyc: 'basic',
    typicalHorizon: 'long',
    riskMultiplier: 0.8,
    cacheTtlMinutes: 120,
  },
  aif: {
    displayName: 'Alternative Investment Funds',
    defaultKyc: 'accredited',
    typicalHorizon: 'long',
    riskMultiplier: 1.5,
    cacheTtlMinutes: 120,
  },
  pms: {
    displayName: 'Portfolio Management Services',
    defaultKyc: 'enhanced',
    typicalHorizon: 'long',
    riskMultiplier: 1.3,
    cacheTtlMinutes: 120,
  },
  bonds: {
    displayName: 'Bonds',
    defaultKyc: 'basic',
    typicalHorizon: 'medium',
    riskMultiplier: 0.5,
    cacheTtlMinutes: 240,
  },
  commodities: {
    displayName: 'Commodities',
    defaultKyc: 'enhanced',
    typicalHorizon: 'short',
    riskMultiplier: 1.4,
    cacheTtlMinutes: 15,
  },
  reits: {
    displayName: 'REITs/InvITs',
    defaultKyc: 'basic',
    typicalHorizon: 'long',
    riskMultiplier: 0.9,
    cacheTtlMinutes: 120,
  },
  derivatives: {
    displayName: 'Derivatives',
    defaultKyc: 'accredited',
    typicalHorizon: 'short',
    riskMultiplier: 2.0,
    cacheTtlMinutes: 5,
  },
  unlisted: {
    displayName: 'Unlisted Securities',
    defaultKyc: 'accredited',
    typicalHorizon: 'long',
    riskMultiplier: 1.8,
    cacheTtlMinutes: 240,
  },
};

// ============================================================================
// UNIFIED AI RECOMMENDATION ENGINE
// ============================================================================

class UnifiedAIRecommendationEngine {
  private gemini: GoogleGenAI | null = null;
  private openai: OpenAI | null = null;
  private modelPreference: 'gemini' | 'openai' = 'gemini';

  constructor() {
    this.initializeModels();
  }

  private initializeModels() {
    // Initialize OpenAI (primary) - prefer Replit AI Integrations with its proxy base URL
    const useAiIntegrations = !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const openaiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || 
                      process.env.OPENAI_API_KEY;
    if (openaiKey) {
      const config: { apiKey: string; baseURL?: string } = { apiKey: openaiKey };
      if (useAiIntegrations && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
        config.baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
      }
      this.openai = new OpenAI(config);
    }

    // Initialize Gemini (fallback)
    const geminiKey = process.env.GEMINI_API_KEY || 
                      process.env.GOOGLE_API_KEY || 
                      process.env.AI_INTEGRATIONS_GOOGLE_API_KEY;
    if (geminiKey) {
      this.gemini = new GoogleGenAI({ apiKey: geminiKey });
    }

    const status = [];
    if (this.openai) status.push('OpenAI (primary)');
    if (this.gemini) status.push('Gemini (fallback)');
    
    console.log(`✅ Unified AI Recommendation Engine initialized: ${status.join(', ') || 'rule-based only'}`);
  }

  // ============================================================================
  // CORE ANALYSIS METHODS
  // ============================================================================

  /**
   * Analyze a single product using AI
   */
  async analyzeProduct(
    product: ProductData,
    clientProfile?: ClientProfile
  ): Promise<ProductAnalysis> {
    const cacheKey = this.generateCacheKey('product_analysis', product, clientProfile);
    
    // Check cache first
    const cached = aiResponseCacheService.get(cacheKey, `${product.category}_recommendation`);
    if (cached) {
      return { ...cached, cacheHit: true };
    }

    let enrichedProduct = product;
    if (product.category === 'stocks' && product.ticker) {
      try {
        const snapshot = await getEnrichedStockSnapshot(product.ticker);
        if (snapshot) {
          enrichedProduct = {
            ...product,
            rawData: {
              ...(product.rawData || {}),
              enrichedFMP: {
                fundamentals: snapshot.fundamentals ? {
                  PE: snapshot.fundamentals.peRatio,
                  PB: snapshot.fundamentals.pbRatio,
                  ROE: snapshot.fundamentals.roe,
                  ROIC: snapshot.fundamentals.roic,
                  debtToEquity: snapshot.fundamentals.debtToEquity,
                  evToEbitda: snapshot.fundamentals.evToEbitda,
                } : null,
                growth: snapshot.growth ? {
                  revenueGrowth: snapshot.growth.revenueGrowth,
                  epsGrowth: snapshot.growth.epsGrowth,
                  fcfGrowth: snapshot.growth.freeCashFlowGrowth,
                } : null,
                dcf: snapshot.dcf ? {
                  intrinsicValue: snapshot.dcf.dcfValue,
                  upsidePercent: snapshot.dcf.upsidePercent,
                } : null,
                companyRating: snapshot.companyRating ? {
                  rating: snapshot.companyRating.rating,
                  recommendation: snapshot.companyRating.ratingRecommendation,
                } : null,
                analystTargets: snapshot.analystTargets ? {
                  avgPriceTarget: snapshot.analystTargets.avgPriceTarget,
                  count: snapshot.analystTargets.count,
                } : null,
                technicals: snapshot.technicals ? {
                  RSI: snapshot.technicals.rsi,
                  SMA50: snapshot.technicals.sma50,
                  SMA200: snapshot.technicals.sma200,
                } : null,
              },
            },
          };
        }
      } catch (err: any) {
        console.warn(`[UnifiedAI] Could not fetch enriched data for ${product.ticker}:`, err.message);
      }
    }

    let analysis: ProductAnalysis;
    let modelUsed: 'gemini' | 'openai' | 'rule_based' = 'rule_based';

    try {
      if (this.gemini) {
        analysis = await this.analyzeWithGemini(enrichedProduct, clientProfile);
        modelUsed = 'gemini';
      } else if (this.openai) {
        analysis = await this.analyzeWithOpenAI(enrichedProduct, clientProfile);
        modelUsed = 'openai';
      } else {
        analysis = this.analyzeWithRules(enrichedProduct, clientProfile);
        modelUsed = 'rule_based';
      }
    } catch (error: any) {
      console.error(`[UnifiedAI] Primary analysis failed for ${enrichedProduct.name}:`, error.message);
      
      if (modelUsed === 'gemini' && this.openai) {
        try {
          analysis = await this.analyzeWithOpenAI(enrichedProduct, clientProfile);
          modelUsed = 'openai';
        } catch (fallbackError: any) {
          console.error(`[UnifiedAI] OpenAI fallback also failed:`, fallbackError.message);
          analysis = this.analyzeWithRules(enrichedProduct, clientProfile);
          modelUsed = 'rule_based';
        }
      } else {
        analysis = this.analyzeWithRules(enrichedProduct, clientProfile);
        modelUsed = 'rule_based';
      }
    }

    analysis.modelUsed = modelUsed;
    analysis.cacheHit = false;

    // Cache the result
    aiResponseCacheService.set(cacheKey, analysis, `${product.category}_recommendation`);

    return analysis;
  }

  /**
   * Analyze and rank multiple products
   */
  async rankProducts(
    products: ProductData[],
    clientProfile: ClientProfile,
    criteria?: {
      prioritizeReturns?: boolean;
      prioritizeSafety?: boolean;
      diversify?: boolean;
      limit?: number;
    }
  ): Promise<RankedProduct[]> {
    const analyses = await Promise.all(
      products.map(p => this.analyzeProduct(p, clientProfile))
    );

    // Calculate match scores and create ranked list
    const ranked: RankedProduct[] = products.map((product, index) => {
      const analysis = analyses[index];
      const matchScore = this.calculateMatchScore(analysis, clientProfile, criteria);
      
      return {
        product,
        analysis,
        rank: 0,
        matchScore,
      };
    });

    // Sort by match score
    ranked.sort((a, b) => b.matchScore - a.matchScore);

    // Assign ranks
    ranked.forEach((item, index) => {
      item.rank = index + 1;
    });

    // Apply limit if specified
    const limit = criteria?.limit || ranked.length;
    return ranked.slice(0, limit);
  }

  /**
   * Generate personalized recommendations for a client
   */
  async generateRecommendation(
    clientProfile: ClientProfile,
    products: ProductData[],
    options?: {
      maxRecommendations?: number;
      categories?: ProductCategory[];
      excludeIds?: string[];
    }
  ): Promise<RecommendationResult> {
    const trackingId = nanoid();
    const maxRecs = options?.maxRecommendations || 10;

    // Filter products by category if specified
    let filteredProducts = products;
    if (options?.categories?.length) {
      filteredProducts = products.filter(p => options.categories!.includes(p.category));
    }
    if (options?.excludeIds?.length) {
      filteredProducts = filteredProducts.filter(p => !options.excludeIds!.includes(p.id));
    }

    // Check KYC compliance
    const kycCompliantProducts = filteredProducts.filter(p => 
      this.isKycCompliant(p, clientProfile)
    );

    // Rank products
    const ranked = await this.rankProducts(kycCompliantProducts, clientProfile, {
      limit: maxRecs,
      diversify: true,
    });

    // Filter to only recommended products
    const recommended = ranked.filter(r => 
      r.analysis.recommendation === 'buy' && 
      r.analysis.suitabilityScore >= 60
    );

    // Calculate summary metrics
    const avgScore = recommended.length > 0
      ? recommended.reduce((sum, r) => sum + r.analysis.overallScore, 0) / recommended.length
      : 0;

    const diversificationScore = this.calculateDiversification(recommended);

    // Track the recommendation
    await this.trackRecommendation(trackingId, clientProfile, recommended);

    return {
      recommendations: recommended,
      summary: {
        totalAnalyzed: filteredProducts.length,
        recommended: recommended.length,
        averageScore: Math.round(avgScore),
        diversificationScore,
      },
      clientSuitability: {
        riskAlignment: this.calculateRiskAlignment(recommended, clientProfile),
        horizonAlignment: this.calculateHorizonAlignment(recommended, clientProfile),
        kycCompliant: true,
      },
      generatedAt: new Date().toISOString(),
      trackingId,
    };
  }

  // ============================================================================
  // AI ANALYSIS IMPLEMENTATIONS
  // ============================================================================

  private async analyzeWithGemini(
    product: ProductData,
    clientProfile?: ClientProfile
  ): Promise<ProductAnalysis> {
    const prompt = this.buildAnalysisPrompt(product, clientProfile);
    
    const model = this.gemini!.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const response = await model;
    const text = response.text || '';
    
    return this.parseAIResponse(text, product, clientProfile);
  }

  private async analyzeWithOpenAI(
    product: ProductData,
    clientProfile?: ClientProfile
  ): Promise<ProductAnalysis> {
    const prompt = this.buildAnalysisPrompt(product, clientProfile);
    
    const response = await this.openai!.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a SEBI-registered investment advisor providing analysis for Indian financial products. Respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content || '{}';
    return this.parseAIResponse(text, product, clientProfile);
  }

  private analyzeWithRules(
    product: ProductData,
    clientProfile?: ClientProfile
  ): ProductAnalysis {
    const config = CATEGORY_CONFIG[product.category];
    
    // Calculate rule-based scores
    const returnScore = this.calculateReturnScore(product);
    const riskScore = this.calculateRiskScore(product) * config.riskMultiplier;
    const qualityScore = this.calculateQualityScore(product);
    const valuationScore = this.calculateValuationScore(product);
    
    const overallScore = (returnScore * 0.35 + (100 - riskScore) * 0.25 + qualityScore * 0.25 + valuationScore * 0.15);
    
    // Determine risk profile
    const riskProfile = this.determineRiskProfile(riskScore);
    
    // Calculate suitability if client profile provided
    const suitabilityScore = clientProfile 
      ? this.calculateSuitabilityScore(product, riskProfile, clientProfile)
      : 70;
    
    // Determine recommendation
    const recommendation = this.determineRecommendation(overallScore, suitabilityScore);
    
    // Calculate confidence
    const dataCompleteness = this.calculateDataCompleteness(product);
    const confidenceScore = Math.min(95, dataCompleteness * 0.7 + 30);
    
    return {
      productId: product.id,
      productName: product.name,
      category: product.category,
      overallScore: Math.round(overallScore),
      riskScore: Math.round(riskScore),
      returnPotentialScore: Math.round(returnScore),
      qualityScore: Math.round(qualityScore),
      valuationScore: Math.round(valuationScore),
      riskProfile,
      suitabilityScore: Math.round(suitabilityScore),
      confidenceLevel: this.getConfidenceLevel(confidenceScore),
      confidenceScore: Math.round(confidenceScore),
      recommendation,
      expectedReturn: product.returns1Y || 12,
      timeHorizon: config.typicalHorizon,
      selectionRationale: this.generateRuleBasedRationale(product, overallScore),
      investmentThesis: this.generateInvestmentThesis(product),
      keyStrengths: this.identifyStrengths(product),
      keyRisks: this.identifyRisks(product),
      kycRequirement: product.kycRequirement || config.defaultKyc,
      regulatoryWarnings: this.generateRegulatoryWarnings(product, clientProfile),
      disclosures: this.generateDisclosures(product),
      analyzedAt: new Date().toISOString(),
      modelUsed: 'rule_based',
      cacheHit: false,
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private buildAnalysisPrompt(product: ProductData, clientProfile?: ClientProfile): string {
    const categoryName = CATEGORY_CONFIG[product.category].displayName;
    
    let prompt = `Analyze this ${categoryName} investment product and provide a JSON response:

Product: ${product.name}
Category: ${categoryName}
${product.ticker ? `Ticker: ${product.ticker}` : ''}
${product.isin ? `ISIN: ${product.isin}` : ''}
${product.amc || product.fundHouse ? `Fund House: ${product.amc || product.fundHouse}` : ''}
${product.sector ? `Sector: ${product.sector}` : ''}

Performance Metrics:
- 1M Return: ${product.returns1M ?? 'N/A'}%
- 3M Return: ${product.returns3M ?? 'N/A'}%
- 6M Return: ${product.returns6M ?? 'N/A'}%
- 1Y Return: ${product.returns1Y ?? 'N/A'}%
- 3Y Return: ${product.returns3Y ?? 'N/A'}%
- 5Y Return: ${product.returns5Y ?? 'N/A'}%

Risk Metrics:
- Volatility: ${product.volatility ?? 'N/A'}
- Sharpe Ratio: ${product.sharpeRatio ?? 'N/A'}
- Max Drawdown: ${product.maxDrawdown ?? 'N/A'}%
- Beta: ${product.beta ?? 'N/A'}

Valuation:
- Current Price/NAV: ${product.currentPrice || product.nav || 'N/A'}
- AUM: ${product.aum ? `₹${(product.aum / 10000000).toFixed(2)} Cr` : 'N/A'}
- P/E Ratio: ${product.peRatio ?? 'N/A'}
- Dividend Yield: ${product.dividendYield ?? 'N/A'}%
`;

    const enriched = product.rawData?.enrichedFMP;
    if (enriched) {
      prompt += `\nEnriched FMP Screener Data:`;
      if (enriched.fundamentals) {
        prompt += `\nFundamentals: PE=${enriched.fundamentals.PE ?? 'N/A'}, PB=${enriched.fundamentals.PB ?? 'N/A'}, ROE=${enriched.fundamentals.ROE ?? 'N/A'}, ROIC=${enriched.fundamentals.ROIC ?? 'N/A'}, D/E=${enriched.fundamentals.debtToEquity ?? 'N/A'}, EV/EBITDA=${enriched.fundamentals.evToEbitda ?? 'N/A'}`;
      }
      if (enriched.growth) {
        prompt += `\nGrowth: Revenue=${enriched.growth.revenueGrowth ?? 'N/A'}, EPS=${enriched.growth.epsGrowth ?? 'N/A'}, FCF=${enriched.growth.fcfGrowth ?? 'N/A'}`;
      }
      if (enriched.dcf) {
        prompt += `\nDCF: Intrinsic Value=${enriched.dcf.intrinsicValue ?? 'N/A'}, Upside=${enriched.dcf.upsidePercent ?? 'N/A'}%`;
      }
      if (enriched.companyRating) {
        prompt += `\nCompany Rating: ${enriched.companyRating.rating ?? 'N/A'}, Recommendation=${enriched.companyRating.recommendation ?? 'N/A'}`;
      }
      if (enriched.analystTargets) {
        prompt += `\nAnalyst Targets: Avg Price Target=${enriched.analystTargets.avgPriceTarget ?? 'N/A'}, Count=${enriched.analystTargets.count ?? 'N/A'}`;
      }
      if (enriched.technicals) {
        prompt += `\nTechnicals: RSI=${enriched.technicals.RSI ?? 'N/A'}, SMA50=${enriched.technicals.SMA50 ?? 'N/A'}, SMA200=${enriched.technicals.SMA200 ?? 'N/A'}`;
      }
      prompt += '\n';
    }

    if (clientProfile) {
      prompt += `
Client Profile:
- Risk Profile: ${clientProfile.riskProfile}
- Investment Horizon: ${clientProfile.investmentHorizon} years
- KYC Tier: ${clientProfile.kycTier}
${clientProfile.age ? `- Age: ${clientProfile.age}` : ''}
`;
    }

    prompt += `
Provide analysis as JSON with these fields:
{
  "overallScore": (0-100),
  "riskScore": (0-100, higher=riskier),
  "returnPotentialScore": (0-100),
  "qualityScore": (0-100),
  "valuationScore": (0-100),
  "riskProfile": "conservative|moderate|aggressive|very_aggressive",
  "suitabilityScore": (0-100),
  "confidenceScore": (0-100),
  "recommendation": "buy|hold|sell|avoid",
  "expectedReturn": (annual % expected),
  "timeHorizon": "short|medium|long",
  "selectionRationale": "2-3 sentence explanation",
  "investmentThesis": "Key investment case in 2-3 sentences",
  "keyStrengths": ["strength1", "strength2", "strength3"],
  "keyRisks": ["risk1", "risk2", "risk3"],
  "regulatoryWarnings": ["warning if any"]
}`;

    return prompt;
  }

  private parseAIResponse(
    text: string,
    product: ProductData,
    clientProfile?: ClientProfile
  ): ProductAnalysis {
    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const config = CATEGORY_CONFIG[product.category];
      
      return {
        productId: product.id,
        productName: product.name,
        category: product.category,
        overallScore: parsed.overallScore || 70,
        riskScore: parsed.riskScore || 50,
        returnPotentialScore: parsed.returnPotentialScore || 70,
        qualityScore: parsed.qualityScore || 70,
        valuationScore: parsed.valuationScore || 70,
        riskProfile: parsed.riskProfile || 'moderate',
        suitabilityScore: parsed.suitabilityScore || 70,
        confidenceLevel: this.getConfidenceLevel(parsed.confidenceScore || 75),
        confidenceScore: parsed.confidenceScore || 75,
        recommendation: parsed.recommendation || 'hold',
        targetPrice: parsed.targetPrice,
        stopLoss: parsed.stopLoss,
        expectedReturn: parsed.expectedReturn || product.returns1Y || 12,
        timeHorizon: parsed.timeHorizon || config.typicalHorizon,
        selectionRationale: parsed.selectionRationale || 'Analysis based on historical performance and risk metrics.',
        investmentThesis: parsed.investmentThesis || 'Potential for steady returns with manageable risk.',
        keyStrengths: parsed.keyStrengths || ['Consistent performance', 'Strong fundamentals'],
        keyRisks: parsed.keyRisks || ['Market volatility', 'Economic uncertainty'],
        kycRequirement: product.kycRequirement || config.defaultKyc,
        regulatoryWarnings: parsed.regulatoryWarnings || [],
        disclosures: this.generateDisclosures(product),
        analyzedAt: new Date().toISOString(),
        modelUsed: 'gemini',
        cacheHit: false,
      };
    } catch (error) {
      console.error('[UnifiedAI] Failed to parse AI response:', error);
      return this.analyzeWithRules(product, clientProfile);
    }
  }

  private generateCacheKey(
    type: string,
    product: ProductData,
    clientProfile?: ClientProfile
  ): string {
    const productKey = `${product.id}_${product.category}_${product.returns1Y || 0}`;
    const clientKey = clientProfile 
      ? `${clientProfile.riskProfile}_${clientProfile.investmentHorizon}_${clientProfile.kycTier}`
      : 'no_client';
    return `${type}_${productKey}_${clientKey}`;
  }

  private calculateMatchScore(
    analysis: ProductAnalysis,
    clientProfile: ClientProfile,
    criteria?: { prioritizeReturns?: boolean; prioritizeSafety?: boolean; diversify?: boolean }
  ): number {
    let score = analysis.suitabilityScore * 0.4 + analysis.overallScore * 0.3;
    
    // Risk alignment
    const riskMatch = this.getRiskMatchScore(analysis.riskProfile, clientProfile.riskProfile);
    score += riskMatch * 0.2;
    
    // Confidence adjustment
    score += analysis.confidenceScore * 0.1;
    
    // Apply criteria adjustments
    if (criteria?.prioritizeReturns) {
      score += analysis.returnPotentialScore * 0.15;
    }
    if (criteria?.prioritizeSafety) {
      score += (100 - analysis.riskScore) * 0.15;
    }
    
    return Math.min(100, Math.round(score));
  }

  private getRiskMatchScore(productRisk: RiskProfile, clientRisk: RiskProfile): number {
    const riskLevels: Record<RiskProfile, number> = {
      conservative: 1,
      moderate: 2,
      aggressive: 3,
      very_aggressive: 4,
    };
    
    const diff = Math.abs(riskLevels[productRisk] - riskLevels[clientRisk]);
    return [100, 75, 40, 10][diff] || 0;
  }

  private isKycCompliant(product: ProductData, client: ClientProfile): boolean {
    const kycLevels: Record<string, number> = {
      basic: 1,
      enhanced: 2,
      accredited: 3,
    };
    
    const required = product.kycRequirement || CATEGORY_CONFIG[product.category].defaultKyc;
    return kycLevels[client.kycTier] >= kycLevels[required];
  }

  private calculateDiversification(products: RankedProduct[]): number {
    if (products.length === 0) return 0;
    
    const categories = new Set(products.map(p => p.product.category));
    const sectors = new Set(products.map(p => p.product.sector).filter(Boolean));
    
    const categoryScore = Math.min(100, categories.size * 15);
    const sectorScore = Math.min(100, sectors.size * 10);
    
    return Math.round((categoryScore + sectorScore) / 2);
  }

  private calculateRiskAlignment(products: RankedProduct[], client: ClientProfile): number {
    if (products.length === 0) return 0;
    
    const alignments = products.map(p => 
      this.getRiskMatchScore(p.analysis.riskProfile, client.riskProfile)
    );
    
    return Math.round(alignments.reduce((a, b) => a + b, 0) / alignments.length);
  }

  private calculateHorizonAlignment(products: RankedProduct[], client: ClientProfile): number {
    if (products.length === 0) return 0;
    
    const horizonYears: Record<string, number> = {
      short: 2,
      medium: 5,
      long: 10,
    };
    
    const alignments = products.map(p => {
      const productHorizon = horizonYears[p.analysis.timeHorizon];
      const diff = Math.abs(productHorizon - client.investmentHorizon);
      return Math.max(0, 100 - diff * 15);
    });
    
    return Math.round(alignments.reduce((a, b) => a + b, 0) / alignments.length);
  }

  private async trackRecommendation(
    trackingId: string,
    client: ClientProfile,
    recommendations: RankedProduct[]
  ): Promise<void> {
    try {
      for (const rec of recommendations.slice(0, 5)) { // Track top 5
        await aiRecommendationTrackingService.recordRecommendation({
          productId: rec.product.id,
          productName: rec.product.name,
          assetType: rec.product.category,
          sector: rec.product.sector || 'General',
          recommendedPrice: rec.product.currentPrice || rec.product.nav || 0,
          targetPrice: rec.analysis.targetPrice || (rec.product.currentPrice || 100) * 1.15,
          stopLoss: rec.analysis.stopLoss || (rec.product.currentPrice || 100) * 0.9,
          confidenceScore: rec.analysis.confidenceScore,
          timeframe: rec.analysis.timeHorizon,
          source: 'unified_ai_engine',
          aiRationale: rec.analysis.selectionRationale,
          status: 'active',
        });
      }
    } catch (error) {
      console.error('[UnifiedAI] Failed to track recommendations:', error);
    }
  }

  // ============================================================================
  // SCORING HELPERS
  // ============================================================================

  private calculateReturnScore(product: ProductData): number {
    const returns = [
      (product.returns1Y || 0) * 0.4,
      (product.returns3Y || 0) * 0.3,
      (product.returns5Y || 0) * 0.3,
    ];
    
    const avgReturn = returns.reduce((a, b) => a + b, 0);
    return Math.min(100, Math.max(0, avgReturn * 3 + 40));
  }

  private calculateRiskScore(product: ProductData): number {
    let score = 50;
    
    if (product.volatility) {
      score += Math.min(30, product.volatility);
    }
    if (product.maxDrawdown) {
      score += Math.min(20, Math.abs(product.maxDrawdown) * 0.5);
    }
    if (product.beta && product.beta > 1) {
      score += (product.beta - 1) * 20;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateQualityScore(product: ProductData): number {
    let score = 60;
    
    if (product.sharpeRatio) {
      score += Math.min(25, product.sharpeRatio * 15);
    }
    if (product.aum && product.aum > 100000000) {
      score += Math.min(15, Math.log10(product.aum / 10000000) * 5);
    }
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateValuationScore(product: ProductData): number {
    let score = 70;
    
    if (product.peRatio) {
      if (product.peRatio < 15) score += 15;
      else if (product.peRatio < 25) score += 5;
      else if (product.peRatio > 40) score -= 15;
    }
    if (product.dividendYield && product.dividendYield > 2) {
      score += Math.min(10, product.dividendYield * 3);
    }
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateSuitabilityScore(
    product: ProductData,
    productRisk: RiskProfile,
    client: ClientProfile
  ): number {
    const riskMatch = this.getRiskMatchScore(productRisk, client.riskProfile);
    const kycCompliant = this.isKycCompliant(product, client) ? 100 : 0;
    
    return Math.round(riskMatch * 0.6 + kycCompliant * 0.4);
  }

  private calculateDataCompleteness(product: ProductData): number {
    const fields = [
      product.returns1Y,
      product.returns3Y,
      product.volatility,
      product.sharpeRatio,
      product.aum || product.currentPrice,
    ];
    
    const filled = fields.filter(f => f !== undefined && f !== null).length;
    return (filled / fields.length) * 100;
  }

  private determineRiskProfile(riskScore: number): RiskProfile {
    if (riskScore <= 30) return 'conservative';
    if (riskScore <= 50) return 'moderate';
    if (riskScore <= 70) return 'aggressive';
    return 'very_aggressive';
  }

  private determineRecommendation(overallScore: number, suitabilityScore: number): RecommendationAction {
    const combined = overallScore * 0.6 + suitabilityScore * 0.4;
    
    if (combined >= 75) return 'buy';
    if (combined >= 55) return 'hold';
    if (combined >= 35) return 'sell';
    return 'avoid';
  }

  private getConfidenceLevel(score: number): ConfidenceLevel {
    if (score >= 85) return 'very_high';
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  private generateRuleBasedRationale(product: ProductData, score: number): string {
    const categoryName = CATEGORY_CONFIG[product.category].displayName;
    const performance = product.returns1Y 
      ? `with ${product.returns1Y.toFixed(1)}% 1-year returns` 
      : 'based on available metrics';
    
    if (score >= 75) {
      return `Strong ${categoryName} showing excellent risk-adjusted performance ${performance}. Well-suited for growth-oriented portfolios.`;
    } else if (score >= 55) {
      return `Solid ${categoryName} ${performance}. Offers balanced risk-return profile suitable for diversified portfolios.`;
    } else {
      return `${categoryName} ${performance}. Consider alternatives with better risk-adjusted returns.`;
    }
  }

  private generateInvestmentThesis(product: ProductData): string {
    const categoryName = CATEGORY_CONFIG[product.category].displayName;
    const sector = product.sector || 'diversified';
    
    return `This ${categoryName} provides exposure to ${sector} with potential for long-term wealth creation. Key value drivers include consistent track record and professional management.`;
  }

  private identifyStrengths(product: ProductData): string[] {
    const strengths: string[] = [];
    
    if (product.returns1Y && product.returns1Y > 15) {
      strengths.push('Strong recent performance');
    }
    if (product.sharpeRatio && product.sharpeRatio > 1) {
      strengths.push('Excellent risk-adjusted returns');
    }
    if (product.aum && product.aum > 1000000000) {
      strengths.push('Large AUM indicates investor confidence');
    }
    if (product.dividendYield && product.dividendYield > 2) {
      strengths.push('Attractive dividend yield');
    }
    
    if (strengths.length === 0) {
      strengths.push('Diversification benefit', 'Professional management');
    }
    
    return strengths.slice(0, 4);
  }

  private identifyRisks(product: ProductData): string[] {
    const risks: string[] = [];
    const config = CATEGORY_CONFIG[product.category];
    
    if (product.volatility && product.volatility > 20) {
      risks.push('High volatility');
    }
    if (product.maxDrawdown && Math.abs(product.maxDrawdown) > 30) {
      risks.push('Significant drawdown history');
    }
    if (config.riskMultiplier > 1.3) {
      risks.push(`${config.displayName} carry inherent higher risk`);
    }
    
    risks.push('Market risk', 'Economic uncertainty');
    
    return risks.slice(0, 4);
  }

  private generateRegulatoryWarnings(product: ProductData, client?: ClientProfile): string[] {
    const warnings: string[] = [];
    const config = CATEGORY_CONFIG[product.category];
    
    if (config.defaultKyc === 'accredited') {
      warnings.push('This product is suitable only for accredited investors');
    }
    if (client && !this.isKycCompliant(product, client)) {
      warnings.push('Enhanced KYC verification required before investment');
    }
    if (product.lockInPeriod) {
      warnings.push(`Lock-in period: ${product.lockInPeriod}`);
    }
    
    return warnings;
  }

  private generateDisclosures(product: ProductData): string[] {
    return [
      'Past performance is not indicative of future results.',
      'Investments are subject to market risks. Read all scheme related documents carefully.',
      'The investment analysis is based on available data and AI-generated insights.',
      'Please consult your financial advisor before making investment decisions.',
    ];
  }

  // ============================================================================
  // PUBLIC UTILITY METHODS
  // ============================================================================

  /**
   * Get supported product categories
   */
  getCategories(): { id: ProductCategory; name: string; kycRequired: string }[] {
    return Object.entries(CATEGORY_CONFIG).map(([id, config]) => ({
      id: id as ProductCategory,
      name: config.displayName,
      kycRequired: config.defaultKyc,
    }));
  }

  /**
   * Public delegated AI call for asset-specific services.
   * Routes all AI calls through the unified engine for caching, model fallback,
   * and tracking — while letting each service keep its own prompts and parsers.
   */
  async runPrompt<T = any>(options: {
    prompt: string;
    category: ProductCategory | string;
    cacheKey?: string;
    cacheTtlMinutes?: number;
    systemPrompt?: string;
    responseParser?: (text: string) => T;
    fallback?: () => T;
  }): Promise<{ result: T; modelUsed: 'gemini' | 'openai' | 'fallback'; cacheHit: boolean }> {
    const { prompt, category, systemPrompt, responseParser, fallback } = options;

    const cacheKey = options.cacheKey || `runPrompt:${category}:${this.hashPrompt(prompt)}`;
    const cacheNamespace = `${category}_delegated`;

    const cached = aiResponseCacheService.get(cacheKey, cacheNamespace);
    if (cached) {
      return { result: cached as T, modelUsed: 'gemini', cacheHit: true };
    }

    const defaultParser = (text: string): T => {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as T;
      throw new Error('Could not parse AI JSON response');
    };

    const parse = responseParser || defaultParser;

    let result: T;
    let modelUsed: 'gemini' | 'openai' | 'fallback' = 'fallback';

    try {
      if (this.openai) {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt || 'You are a SEBI-registered investment advisor. Respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        });
        const text = response.choices[0]?.message?.content || '{}';
        result = parse(text);
        modelUsed = 'openai';
      } else if (this.gemini) {
        const response = await this.gemini.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });
        const text = response.text || '';
        result = parse(text);
        modelUsed = 'gemini';
      } else if (fallback) {
        result = fallback();
        modelUsed = 'fallback';
      } else {
        throw new Error('No AI model available and no fallback provided');
      }
    } catch (error: any) {
      console.error(`[UnifiedAI:runPrompt] Primary model failed for ${category}:`, error.message);

      if (modelUsed === 'openai' || (!this.openai && !this.gemini)) {
        if (this.gemini && modelUsed !== 'gemini') {
          try {
            const response = await this.gemini.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
            });
            const text = response.text || '';
            result = parse(text);
            modelUsed = 'gemini';
          } catch (fallbackError: any) {
            console.error(`[UnifiedAI:runPrompt] Gemini fallback failed:`, fallbackError.message);
            if (fallback) {
              result = fallback();
              modelUsed = 'fallback';
            } else {
              throw fallbackError;
            }
          }
        } else if (fallback) {
          result = fallback();
          modelUsed = 'fallback';
        } else {
          throw error;
        }
      } else if (fallback) {
        result = fallback();
        modelUsed = 'fallback';
      } else {
        throw error;
      }
    }

    if (modelUsed !== 'fallback') {
      aiResponseCacheService.set(cacheKey, result, cacheNamespace);
    }

    return { result, modelUsed, cacheHit: false };
  }

  private hashPrompt(prompt: string): string {
    let hash = 0;
    for (let i = 0; i < Math.min(prompt.length, 500); i++) {
      const char = prompt.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check AI service availability
   */
  getStatus(): { gemini: boolean; openai: boolean; primary: string } {
    return {
      gemini: !!this.gemini,
      openai: !!this.openai,
      primary: this.openai ? 'openai' : this.gemini ? 'gemini' : 'rule_based',
    };
  }

  /**
   * Get cache metrics
   */
  getCacheMetrics() {
    return aiResponseCacheService.getMetrics();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const unifiedAIRecommendationEngine = new UnifiedAIRecommendationEngine();
