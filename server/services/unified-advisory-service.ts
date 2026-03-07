/**
 * Unified AI Advisory Engine Service
 * 
 * System-driven advisory across all products:
 * - Risk-appetite aligned
 * - Horizon-matched
 * - Explainable
 * - Client-approved before execution
 * - Fully auditable
 */

import { db } from '../db';
import { 
  users, 
  userProfiles, 
  portfolios, 
  portfolioHoldings,
  marketData,
  investmentProposals,
  investmentProposalItems,
  complianceAuditTrail,
  mutualFunds,
  mutualFundMetrics,
  mfHoldings,
  mfFolios,
} from '@shared/schema';
import { eq, and, desc, sql, like, or, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  ProductType,
  ActionType,
  RiskCategory,
  ClientCategory,
  InvestmentHorizon,
  ExecutionChannel,
  UnifiedAdvisoryDecision,
  AdvisoryTriggerConditions,
  TriggerValidationResult,
  PortfolioImpact,
  PRODUCT_ELIGIBILITY_MATRIX,
  PRODUCT_ADVISORY_LOGIC,
  REGULATORY_DISCLOSURES,
  AdvisoryAuditLog,
  isHorizonSufficient,
  determineClientCategory,
  getRiskScoreForCategory
} from '@shared/unified-advisory-types';
import { GoogleGenAI } from "@google/genai";
import { callPython } from '../clients/python-client';

interface ClientProfile {
  userId: string;
  riskCategory: RiskCategory;
  clientCategory: ClientCategory;
  investmentHorizon: InvestmentHorizon;
  netWorth: number;
  annualIncome: number;
  onboardingComplete: boolean;
  panVerified: boolean;
  kycComplete: boolean;
  fatcaComplete: boolean;
  riskProfileComplete: boolean;
}

interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  gainLoss: number;
  gainLossPercent: number;
  riskScore: number;
  sectorAllocation: Record<string, number>;
  assetAllocation: Record<string, number>;
  holdings: Array<{
    symbol: string;
    name: string;
    value: number;
    weight: number;
    assetType: string;
    sector: string;
  }>;
}

class UnifiedAdvisoryService {
  private genAI: GoogleGenAI | null = null;
  private auditLogs: Map<string, AdvisoryAuditLog> = new Map();

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.AI_INTEGRATIONS_GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      console.log("✅ Unified Advisory Engine initialized with Gemini AI");
    } else {
      console.log("⚠️ Unified Advisory Engine running in rule-based mode");
    }
  }

  async validateTriggerConditions(clientId: string): Promise<TriggerValidationResult> {
    const missingConditions: string[] = [];
    const blockerReasons: string[] = [];

    const [user] = await db.select().from(users).where(eq(users.id, clientId)).limit(1);
    if (!user) {
      return {
        canProceed: false,
        missingConditions: ['Client not found'],
        blockerReasons: ['Invalid client ID']
      };
    }

    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, clientId)).limit(1);
    
    const conditions: AdvisoryTriggerConditions = {
      onboardingComplete: user.isEmailVerified === true || user.isMobileVerified === true,
      panVerified: !!user.panNumber && user.panVerifiedViaSmartKyc === true,
      kycComplete: user.panVerifiedViaSmartKyc === true && user.aadhaarVerifiedViaSmartKyc === true,
      fatcaComplete: !!profile?.investmentObjective,
      riskProfileComplete: !!profile?.riskTolerance,
      horizonDefined: !!profile?.investmentExperience,
      portfolioAvailable: true,
      clientCategoryValidated: !!profile?.riskTolerance && !!profile?.annualIncomeAmount
    };

    const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.userId, clientId)).limit(1);
    conditions.portfolioAvailable = !!portfolio;

    if (!conditions.onboardingComplete) {
      missingConditions.push('Onboarding incomplete');
      blockerReasons.push('Complete user onboarding before accessing advisory');
    }
    if (!conditions.panVerified) {
      missingConditions.push('PAN not verified');
      blockerReasons.push('PAN verification required for investment advisory');
    }
    if (!conditions.kycComplete) {
      missingConditions.push('KYC incomplete');
      blockerReasons.push('Complete KYC verification first');
    }
    if (!conditions.fatcaComplete) {
      missingConditions.push('FATCA declaration incomplete');
      blockerReasons.push('FATCA/CRS declaration required');
    }
    if (!conditions.riskProfileComplete) {
      missingConditions.push('Risk profile not assessed');
      blockerReasons.push('Complete risk profiling questionnaire');
    }
    if (!conditions.horizonDefined) {
      missingConditions.push('Investment horizon not defined');
      blockerReasons.push('Define your investment timeline');
    }
    if (!conditions.portfolioAvailable) {
      missingConditions.push('No portfolio data');
      blockerReasons.push('Upload or link portfolio data');
    }

    await this.logAuditEvent({
      logId: nanoid(),
      sessionId: nanoid(),
      agentId: 'system',
      clientId,
      timestamp: new Date(),
      eventType: 'trigger_check',
      metadata: { conditions, missingConditions },
      retentionYears: 8
    });

    return {
      canProceed: missingConditions.length === 0,
      missingConditions,
      blockerReasons
    };
  }

  async getClientProfile(clientId: string): Promise<ClientProfile | null> {
    const [user] = await db.select().from(users).where(eq(users.id, clientId)).limit(1);
    if (!user) return null;

    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, clientId)).limit(1);

    const riskTolerance = profile?.riskTolerance || 'moderate';
    let riskCategory: RiskCategory = 'moderate';
    if (riskTolerance === 'conservative' || riskTolerance === 'low') riskCategory = 'conservative';
    else if (riskTolerance === 'aggressive' || riskTolerance === 'high') riskCategory = 'aggressive';
    else if (riskTolerance === 'very_aggressive') riskCategory = 'very_aggressive';

    const netWorth = parseFloat(String(profile?.netWorthAmount)) || 0;
    const clientCategory = determineClientCategory(netWorth);

    let investmentHorizon: InvestmentHorizon = 'medium';
    const experience = profile?.investmentExperience || '';
    if (experience.includes('short') || experience.includes('less')) investmentHorizon = 'short';
    else if (experience.includes('long') || experience.includes('5+')) investmentHorizon = 'long';
    else if (experience.includes('very') || experience.includes('10+')) investmentHorizon = 'very_long';

    return {
      userId: clientId,
      riskCategory,
      clientCategory,
      investmentHorizon,
      netWorth,
      annualIncome: parseFloat(String(profile?.annualIncomeAmount)) || 0,
      onboardingComplete: user.isEmailVerified === true || user.isMobileVerified === true,
      panVerified: !!user.panNumber && user.panVerifiedViaSmartKyc === true,
      kycComplete: user.panVerifiedViaSmartKyc === true,
      fatcaComplete: !!profile?.investmentObjective,
      riskProfileComplete: !!profile?.riskTolerance
    };
  }

  async getEligibleProducts(clientId: string): Promise<{
    eligible: ProductType[];
    ineligible: Array<{ product: ProductType; reason: string }>;
  }> {
    const profile = await this.getClientProfile(clientId);
    if (!profile) {
      return {
        eligible: [],
        ineligible: PRODUCT_ELIGIBILITY_MATRIX.map(p => ({
          product: p.productType,
          reason: 'Client profile not found'
        }))
      };
    }

    const eligible: ProductType[] = [];
    const ineligible: Array<{ product: ProductType; reason: string }> = [];

    for (const rule of PRODUCT_ELIGIBILITY_MATRIX) {
      const reasons: string[] = [];

      if (!rule.allowedRiskCategories.includes(profile.riskCategory)) {
        reasons.push(`Risk profile ${profile.riskCategory} not suitable for ${rule.productType}`);
      }

      if (!rule.requiredClientCategories.includes(profile.clientCategory)) {
        reasons.push(`Client category ${profile.clientCategory} not eligible. Required: ${rule.requiredClientCategories.join('/')}`);
      }

      if (!isHorizonSufficient(profile.investmentHorizon, rule.minHorizon)) {
        reasons.push(`Investment horizon too short. Required: ${rule.minHorizon}+`);
      }

      if (reasons.length === 0) {
        eligible.push(rule.productType);
      } else {
        ineligible.push({
          product: rule.productType,
          reason: reasons.join('; ')
        });
      }
    }

    await this.logAuditEvent({
      logId: nanoid(),
      sessionId: nanoid(),
      agentId: 'system',
      clientId,
      timestamp: new Date(),
      eventType: 'eligibility_check',
      riskProfileUsed: profile.riskCategory,
      clientCategoryUsed: profile.clientCategory,
      eligibilityResult: eligible.length > 0,
      metadata: { eligible, ineligible },
      retentionYears: 8
    });

    return { eligible, ineligible };
  }

  async getPortfolioSummary(clientId: string): Promise<PortfolioSummary | null> {
    let totalValue = 0;
    let totalInvested = 0;
    const sectorAllocation: Record<string, number> = {};
    const assetAllocation: Record<string, number> = {};
    const holdingDetails: PortfolioSummary['holdings'] = [];

    // ── Source 1: Generic portfolios/portfolioHoldings ────────────────
    const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.userId, clientId)).limit(1);
    if (portfolio) {
      const holdings = await db.select().from(portfolioHoldings).where(eq(portfolioHoldings.portfolioId, portfolio.id));
      for (const holding of holdings) {
        const quantity = parseFloat(holding.quantity) || 0;
        const avgPrice = parseFloat(holding.avgPrice) || 0;
        const invested = quantity * avgPrice;
        const [market] = await db.select().from(marketData).where(eq(marketData.symbol, holding.symbol)).limit(1);
        const currentPrice = market?.price ? parseFloat(market.price) : avgPrice;
        const currentValue = quantity * currentPrice;
        totalInvested += invested;
        totalValue += currentValue;
        const sector = holding.sector || 'Other';
        const assetType = holding.assetType || 'EQUITY';
        sectorAllocation[sector] = (sectorAllocation[sector] || 0) + currentValue;
        assetAllocation[assetType] = (assetAllocation[assetType] || 0) + currentValue;
        holdingDetails.push({ symbol: holding.symbol, name: holding.symbol, value: currentValue, weight: 0, assetType, sector });
      }
    }

    // ── Source 2: MF holdings (mf_holdings JOIN mf_folios) ──────────────
    // This is the primary data source for most clients
    const mfFolioRows = await db.select().from(mfFolios).where(eq(mfFolios.userId, clientId));
    for (const folio of mfFolioRows) {
      const mfRows = await db.select().from(mfHoldings).where(eq(mfHoldings.folioId, folio.id));
      for (const h of mfRows) {
        const currentValue = parseFloat(h.currentValue?.toString() || '0');
        const investedValue = parseFloat(h.units?.toString() || '0') * parseFloat(h.averageNav?.toString() || '0');
        totalValue += currentValue;
        totalInvested += investedValue;
        assetAllocation['MF'] = (assetAllocation['MF'] || 0) + currentValue;
        sectorAllocation['Mutual Fund'] = (sectorAllocation['Mutual Fund'] || 0) + currentValue;
        holdingDetails.push({
          symbol: h.schemeCode,
          name: h.schemeName || h.schemeCode,
          value: currentValue,
          weight: 0,
          assetType: 'MF',
          sector: 'Mutual Fund',
        });
      }
    }

    if (totalValue === 0 && holdingDetails.length === 0) return null;

    for (const h of holdingDetails) {
      h.weight = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
    }
    for (const sector of Object.keys(sectorAllocation)) {
      sectorAllocation[sector] = totalValue > 0 ? (sectorAllocation[sector] / totalValue) * 100 : 0;
    }
    for (const asset of Object.keys(assetAllocation)) {
      assetAllocation[asset] = totalValue > 0 ? (assetAllocation[asset] / totalValue) * 100 : 0;
    }

    const maxConcentration = Math.max(...Object.values(sectorAllocation), 0);
    const topHoldingWeight = holdingDetails.length > 0 ? Math.max(...holdingDetails.map(h => h.weight)) : 0;
    const equityWeight = (assetAllocation['EQUITY'] || assetAllocation['equity'] || 0) + (assetAllocation['MF'] || 0) * 0.7;
    const riskScore = Math.min(100, Math.round((maxConcentration * 0.3) + (topHoldingWeight * 0.3) + (equityWeight * 0.4)));

    return {
      totalValue,
      totalInvested,
      gainLoss: totalValue - totalInvested,
      gainLossPercent: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
      riskScore,
      sectorAllocation,
      assetAllocation,
      holdings: holdingDetails.sort((a, b) => b.value - a.value),
    };
  }

  async generateRecommendations(
    clientId: string,
    productTypes: ProductType[],
    options: { count?: number; agentId?: string } = {}
  ): Promise<UnifiedAdvisoryDecision[]> {
    const { count = 5, agentId = 'system' } = options;

    const validation = await this.validateTriggerConditions(clientId);
    if (!validation.canProceed) {
      throw new Error(`Advisory blocked: ${validation.blockerReasons.join('; ')}`);
    }

    const profile = await this.getClientProfile(clientId);
    if (!profile) throw new Error('Client profile not found');

    const { eligible } = await this.getEligibleProducts(clientId);
    const validProducts = productTypes.filter(p => eligible.includes(p));

    if (validProducts.length === 0) {
      throw new Error('No eligible products for this client');
    }

    // ── T003: Fetch market regime from Python sidecar ────────────────────
    let marketRegime: { regime: string; signal_score: number; confidence: number } | null = null;
    try {
      const regimeResult = await callPython<any>('/api/regime/detect', 'POST', { lookback_days: 90 });
      if (regimeResult?.regime) {
        marketRegime = {
          regime: regimeResult.regime,
          signal_score: regimeResult.signal_score ?? 0,
          confidence: regimeResult.confidence ?? 0,
        };
        console.log(`[UnifiedAdvisory] Market regime: ${marketRegime.regime} (score=${marketRegime.signal_score}, confidence=${marketRegime.confidence})`);
      }
    } catch {
      console.warn('[UnifiedAdvisory] Regime detection unavailable — proceeding without regime context');
    }

    const portfolio = await this.getPortfolioSummary(clientId);
    const recommendations: UnifiedAdvisoryDecision[] = [];

    for (const productType of validProducts) {
      const productRecs = await this.generateProductRecommendations(
        productType,
        profile,
        portfolio,
        Math.ceil(count / validProducts.length),
        marketRegime,
      );
      recommendations.push(...productRecs);
    }

    for (const rec of recommendations) {
      await this.logAuditEvent({
        logId: nanoid(),
        sessionId: nanoid(),
        agentId,
        clientId,
        timestamp: new Date(),
        eventType: 'recommendation_generated',
        productType: rec.productType,
        decisionId: rec.decisionId,
        riskProfileUsed: profile.riskCategory,
        clientCategoryUsed: profile.clientCategory,
        aiReasoningSnapshot: rec.primaryReason,
        disclosuresShown: rec.regulatoryDisclosures,
        metadata: { recommendation: rec },
        retentionYears: 8
      });
    }

    return recommendations.slice(0, count);
  }

  private async generateProductRecommendations(
    productType: ProductType,
    profile: ClientProfile,
    portfolio: PortfolioSummary | null,
    count: number,
    marketRegime: { regime: string; signal_score: number; confidence: number } | null = null,
  ): Promise<UnifiedAdvisoryDecision[]> {
    const recommendations: UnifiedAdvisoryDecision[] = [];
    const disclosures = REGULATORY_DISCLOSURES[productType] || [];
    const logic = PRODUCT_ADVISORY_LOGIC.find(l => l.productType === productType);

    if (this.genAI) {
      try {
        const aiRecs = await this.generateAIRecommendations(productType, profile, portfolio, count, marketRegime);
        for (const rec of aiRecs) {
          rec.regulatoryDisclosures = disclosures;
          recommendations.push(rec);
        }
        return recommendations;
      } catch (error) {
        console.error(`AI recommendation failed for ${productType}:`, error);
      }
    }

    const ruleBasedRecs = await this.generateRuleBasedRecommendations(
      productType, 
      profile, 
      portfolio, 
      count,
      logic,
      disclosures,
      marketRegime,
    );
    
    return ruleBasedRecs;
  }

  private async generateAIRecommendations(
    productType: ProductType,
    profile: ClientProfile,
    portfolio: PortfolioSummary | null,
    count: number,
    marketRegime: { regime: string; signal_score: number; confidence: number } | null = null,
  ): Promise<UnifiedAdvisoryDecision[]> {
    if (!this.genAI) return [];

    // Regime context section for the prompt
    const regimeSection = marketRegime
      ? `\nMarket Regime (as of now):
- Regime: ${marketRegime.regime} (signal_score: ${marketRegime.signal_score.toFixed(2)}, confidence: ${(marketRegime.confidence * 100).toFixed(0)}%)
- Adjust equity exposure DOWN in bear/high_vol regimes. Prefer defensive/debt in bear. Favour growth in bull.`
      : '';

    const prompt = `You are a SEBI-compliant investment advisor. Generate exactly ${count} ${productType} recommendations.

Client Profile:
- Risk Category: ${profile.riskCategory}
- Client Category: ${profile.clientCategory}
- Investment Horizon: ${profile.investmentHorizon}
- Net Worth: ₹${profile.netWorth.toLocaleString('en-IN')}
- Annual Income: ₹${profile.annualIncome.toLocaleString('en-IN')}
${regimeSection}
${portfolio ? `Current Portfolio:
- Total Value: ₹${portfolio.totalValue.toLocaleString('en-IN')}
- Gain/Loss: ${portfolio.gainLossPercent.toFixed(2)}%
- Risk Score: ${portfolio.riskScore}/100
- Asset Allocation: ${JSON.stringify(portfolio.assetAllocation)}
- Top Holdings: ${portfolio.holdings.slice(0, 5).map(h => `${h.name} (${h.weight.toFixed(1)}%)`).join(', ')}` : 'No existing portfolio data'}

Rules:
- Match recommendations to client's risk profile
- Consider existing portfolio concentration
- Include clear risk warnings
- Never guarantee returns
- If regime is bear or high_vol, prefer defensive products`;

    const result = await this.genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productName: { type: 'string' },
                  productSymbol: { type: 'string' },
                  action: { type: 'string' },
                  amount: { type: 'number' },
                  primaryReason: { type: 'string' },
                  supportingFactors: { type: 'array', items: { type: 'string' } },
                  riskNotes: { type: 'array', items: { type: 'string' } },
                  confidence: { type: 'number' },
                  returnBefore: { type: 'number' },
                  returnAfter: { type: 'number' },
                  riskBefore: { type: 'string' },
                  riskAfter: { type: 'string' },
                },
                required: ['productName', 'action', 'amount', 'primaryReason', 'confidence'],
              },
            },
          },
          required: ['recommendations'],
        },
      },
      contents: prompt,
    });

    const text = result.text || '';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('[UnifiedAdvisory] Gemini returned invalid JSON:', text.slice(0, 300));
      return [];
    }

    const currentReturn = portfolio?.gainLossPercent || 0;
    const recommendations: UnifiedAdvisoryDecision[] = [];

    for (const rec of parsed.recommendations || []) {
      recommendations.push({
        decisionId: nanoid(),
        productType,
        action: (rec.action || 'BUY') as ActionType,
        productName: rec.productName || 'Unknown',
        productSymbol: rec.productSymbol,
        amount: rec.amount || 100000,
        horizon: profile.investmentHorizon,
        riskCategory: profile.riskCategory,
        clientCategory: profile.clientCategory,
        portfolioImpact: {
          returnBefore: (rec.returnBefore ?? currentReturn / 100),
          returnAfter: (rec.returnAfter ?? currentReturn / 100),
          riskBefore: (rec.riskBefore || this.mapRiskScore(portfolio?.riskScore || 50)) as any,
          riskAfter: (rec.riskAfter || this.mapRiskScore(portfolio?.riskScore || 50)) as any,
        },
        primaryReason: rec.primaryReason || 'AI-generated recommendation',
        supportingFactors: rec.supportingFactors || [],
        riskNotes: rec.riskNotes || [],
        regulatoryDisclosures: [],
        confidence: rec.confidence || 70,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        clientApprovalRequired: true,
      });
    }

    return recommendations;
  }

  private generateRuleBasedRecommendations(
    productType: ProductType,
    profile: ClientProfile,
    portfolio: PortfolioSummary | null,
    count: number,
    logic: typeof PRODUCT_ADVISORY_LOGIC[0] | undefined,
    disclosures: string[]
  ): UnifiedAdvisoryDecision[] {
    const recommendations: UnifiedAdvisoryDecision[] = [];

    const productDatabase = this.getProductDatabase(productType, profile.riskCategory);

    for (let i = 0; i < Math.min(count, productDatabase.length); i++) {
      const product = productDatabase[i];
      const existingHolding = portfolio?.holdings.find(
        h => h.symbol === product.symbol
      );

      let action: ActionType = 'BUY';
      let primaryReason = '';

      if (existingHolding) {
        if (existingHolding.weight > 25) {
          action = 'SELL';
          primaryReason = `Position size (${existingHolding.weight.toFixed(1)}%) exceeds concentration limit`;
        } else {
          action = 'HOLD';
          primaryReason = 'Current allocation optimal for portfolio balance';
        }
      } else {
        action = 'BUY';
        primaryReason = logic?.buyConditions[0] || 'Improves portfolio diversification';
      }

      const currentReturn = portfolio?.gainLossPercent || 0;
      const estimatedImpact = action === 'BUY' ? 1.5 : (action === 'SELL' ? -0.5 : 0);

      recommendations.push({
        decisionId: nanoid(),
        productType,
        action,
        productName: product.name,
        productSymbol: product.symbol,
        isin: product.isin,
        amount: this.calculateSuggestedAmount(profile, portfolio, productType),
        horizon: profile.investmentHorizon,
        riskCategory: profile.riskCategory,
        clientCategory: profile.clientCategory,
        portfolioImpact: {
          returnBefore: currentReturn / 100,
          returnAfter: (currentReturn + estimatedImpact) / 100,
          riskBefore: this.mapRiskScore(portfolio?.riskScore || 50),
          riskAfter: this.mapRiskScore((portfolio?.riskScore || 50) + (action === 'BUY' ? 5 : -5))
        },
        primaryReason,
        supportingFactors: logic?.buyConditions.slice(0, 3) || [],
        riskNotes: product.riskFactors || [],
        regulatoryDisclosures: disclosures,
        confidence: 75,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'pending',
        clientApprovalRequired: true
      });
    }

    return recommendations;
  }

  private getProductDatabase(productType: ProductType, riskCategory: RiskCategory): Array<{
    symbol: string;
    name: string;
    isin?: string;
    riskFactors: string[];
  }> {
    const databases: Record<ProductType, Array<{ symbol: string; name: string; isin?: string; riskFactors: string[] }>> = {
      STOCK: [
        { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', isin: 'INE040A01034', riskFactors: ['Interest rate risk', 'Credit cycle exposure'] },
        { symbol: 'RELIANCE', name: 'Reliance Industries', isin: 'INE002A01018', riskFactors: ['Oil price volatility', 'High capex'] },
        { symbol: 'TCS', name: 'Tata Consultancy Services', isin: 'INE467B01029', riskFactors: ['Currency risk', 'IT spending slowdown'] },
        { symbol: 'INFY', name: 'Infosys Ltd', isin: 'INE009A01021', riskFactors: ['Client concentration', 'Visa regulations'] },
        { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', isin: 'INE090A01021', riskFactors: ['Credit risk', 'NPA exposure'] },
      ],
      MF: [
        { symbol: 'HDFCNIFTY', name: 'HDFC Nifty 50 Index Fund', riskFactors: ['Market risk', 'Tracking error'] },
        { symbol: 'SBILARGE', name: 'SBI Bluechip Fund', riskFactors: ['Market risk', 'Fund manager risk'] },
        { symbol: 'AXISLIQ', name: 'Axis Liquid Fund', riskFactors: ['Interest rate risk', 'Credit risk'] },
        { symbol: 'PPFASFLEX', name: 'Parag Parikh Flexi Cap Fund', riskFactors: ['Currency risk', 'Market risk'] },
        { symbol: 'MOTILALMID', name: 'Motilal Oswal Midcap Fund', riskFactors: ['High volatility', 'Liquidity risk'] },
      ],
      BOND: [
        { symbol: 'GSEC2030', name: 'GOI 7.26% 2030', isin: 'IN0020220017', riskFactors: ['Interest rate risk', 'Duration risk'] },
        { symbol: 'ICICIBOND', name: 'ICICI Bank 8.5% NCD', riskFactors: ['Credit risk', 'Liquidity risk'] },
        { symbol: 'HDFCNCD', name: 'HDFC Ltd 8.75% NCD', riskFactors: ['Credit risk', 'Interest rate risk'] },
        { symbol: 'TBILL91', name: 'Treasury Bill 91 Days', riskFactors: ['Low yield', 'Reinvestment risk'] },
      ],
      UNLISTED: [
        { symbol: 'TATATECH', name: 'Tata Technologies Ltd', riskFactors: ['Illiquidity', 'Valuation uncertainty', 'Lock-in period'] },
        { symbol: 'NSDLIPO', name: 'NSDL e-Governance', riskFactors: ['Regulatory risk', 'Pre-IPO pricing risk'] },
        { symbol: 'NSEBSE', name: 'NSE Unlisted', riskFactors: ['High valuation', 'Regulatory dependence'] },
      ],
      MLD: [
        { symbol: 'HDFCMLD', name: 'HDFC Nifty Linked MLD', riskFactors: ['Capital at risk', 'Complex payoff', 'Issuer credit risk'] },
        { symbol: 'ABORAMLD', name: 'Aditya Birla Equity Linked MLD', riskFactors: ['Market-linked returns', 'Early exit penalty'] },
      ],
      PMS: [
        { symbol: 'MOTILPMS', name: 'Motilal Oswal Value PMS', riskFactors: ['Manager discretion', 'Capital risk', 'High fees'] },
        { symbol: 'ASWPMS', name: 'ASK India Select PMS', riskFactors: ['Concentrated portfolio', 'Liquidity constraints'] },
      ],
      AIF: [
        { symbol: 'KOTAK AIF', name: 'Kotak Special Situations Fund', riskFactors: ['Lock-in 5 years', 'High minimum', 'Capital calls'] },
        { symbol: 'ICICICREDIT', name: 'ICICI Prudential Credit AIF', riskFactors: ['Credit risk', 'Illiquidity', 'Long lock-in'] },
      ],
      CFD: [
        { symbol: 'SPYCFD', name: 'S&P 500 CFD', riskFactors: ['Leverage risk', 'Currency risk', 'Not SEBI regulated'] },
        { symbol: 'GOLDCFD', name: 'Gold CFD', riskFactors: ['Commodity volatility', 'Margin requirements', 'Offshore execution'] },
      ],
      TREASURY: [
        { symbol: 'OVERNIGHTFUND', name: 'Overnight Fund', riskFactors: ['Low yield', 'Reinvestment risk'] },
        { symbol: 'LIQUIDFUND', name: 'Liquid Fund', riskFactors: ['Credit risk', 'Interest rate sensitivity'] },
      ],
    };

    return databases[productType] || [];
  }

  private calculateSuggestedAmount(
    profile: ClientProfile,
    portfolio: PortfolioSummary | null,
    productType: ProductType
  ): number {
    const eligibilityRule = PRODUCT_ELIGIBILITY_MATRIX.find(r => r.productType === productType);
    const maxAllocation = eligibilityRule?.maxAllocationPercent || 100;

    const totalPortfolioValue = portfolio?.totalValue || profile.netWorth * 0.3;
    const maxAmount = totalPortfolioValue * (maxAllocation / 100);

    const defaultAmounts: Record<RiskCategory, number> = {
      conservative: 100000,
      moderate: 200000,
      aggressive: 500000,
      very_aggressive: 1000000
    };

    const suggestedAmount = Math.min(
      defaultAmounts[profile.riskCategory],
      maxAmount,
      profile.netWorth * 0.1
    );

    return Math.max(10000, Math.round(suggestedAmount / 10000) * 10000);
  }

  private mapRiskScore(score: number): 'low' | 'medium' | 'high' {
    if (score <= 35) return 'low';
    if (score <= 65) return 'medium';
    return 'high';
  }

  async approveRecommendation(decisionId: string, clientId: string, agentId: string): Promise<boolean> {
    await this.logAuditEvent({
      logId: nanoid(),
      sessionId: nanoid(),
      agentId,
      clientId,
      timestamp: new Date(),
      eventType: 'client_approved',
      decisionId,
      metadata: { approvedAt: new Date() },
      retentionYears: 8
    });

    return true;
  }

  async rejectRecommendation(decisionId: string, clientId: string, reason: string, agentId: string): Promise<boolean> {
    await this.logAuditEvent({
      logId: nanoid(),
      sessionId: nanoid(),
      agentId,
      clientId,
      timestamp: new Date(),
      eventType: 'client_rejected',
      decisionId,
      clientResponse: reason,
      metadata: { rejectedAt: new Date(), reason },
      retentionYears: 8
    });

    return true;
  }

  async createProposalFromRecommendations(
    clientId: string,
    agentId: string,
    decisions: UnifiedAdvisoryDecision[]
  ): Promise<{ proposalId: string; success: boolean }> {
    const approvedDecisions = decisions.filter(d => d.status === 'pending' || d.status === 'approved');
    if (approvedDecisions.length === 0) {
      throw new Error('No recommendations to convert to proposal');
    }

    const totalAmount = approvedDecisions.reduce((sum, d) => sum + d.amount, 0);
    const proposalId = `AI-${nanoid(8)}`;

    const [proposal] = await db.insert(investmentProposals).values({
      id: proposalId,
      clientId,
      agentId,
      proposalSource: 'ai',
      title: `AI Advisory Proposal - ${new Date().toLocaleDateString('en-IN')}`,
      description: `System-generated proposal with ${approvedDecisions.length} recommendations based on risk profile analysis`,
      recommendations: approvedDecisions.map(d => ({
        productType: d.productType,
        productSymbol: d.productSymbol,
        productName: d.productName,
        action: d.action,
        amount: d.amount,
        reason: d.primaryReason
      })),
      totalInvestmentAmount: String(totalAmount),
      riskProfile: approvedDecisions[0]?.riskCategory || 'moderate',
      status: 'pending',
    }).returning();

    for (const decision of approvedDecisions) {
      const allocationPct = totalAmount > 0 ? (decision.amount / totalAmount) * 100 : 0;
      await db.insert(investmentProposalItems).values({
        proposalId: proposal.id,
        productType: decision.productType.toLowerCase(),
        productCode: decision.productSymbol || decision.productName.replace(/\s/g, '_').toUpperCase(),
        productName: decision.productName,
        recommendedAmount: String(decision.amount),
        allocationPercentage: String(allocationPct.toFixed(2)),
        rationale: decision.primaryReason,
        riskFactors: decision.riskNotes,
      });
    }

    await this.logAuditEvent({
      logId: nanoid(),
      sessionId: nanoid(),
      agentId,
      clientId,
      timestamp: new Date(),
      eventType: 'execution_initiated',
      metadata: { proposalId: proposal.id, decisions: approvedDecisions.map(d => d.decisionId) },
      retentionYears: 8
    });

    return { proposalId: proposal.id, success: true };
  }

  getExecutionChannel(productType: ProductType): ExecutionChannel {
    const rule = PRODUCT_ELIGIBILITY_MATRIX.find(r => r.productType === productType);
    return rule?.executionChannel || 'API';
  }

  getDisclosuresForProduct(productType: ProductType): string[] {
    return REGULATORY_DISCLOSURES[productType] || [];
  }

  private async logAuditEvent(event: AdvisoryAuditLog): Promise<void> {
    this.auditLogs.set(event.logId, event);
    
    try {
      await db.insert(complianceAuditTrail).values({
        userId: event.clientId,
        action: event.eventType,
        fieldChanged: 'unified_advisory',
        oldValue: null,
        newValue: JSON.stringify({
          decisionId: event.decisionId,
          productType: event.productType,
          riskProfile: event.riskProfileUsed,
          clientCategory: event.clientCategoryUsed
        }),
        reason: event.aiReasoningSnapshot || 'Unified advisory event',
        performedBy: event.agentId,
        performedByRole: event.agentId === 'system' ? 'system' : 'agent',
        riskImpact: 'medium',
        complianceImpact: 'minor',
        metadata: event.metadata
      });
    } catch (error) {
      console.error('[Unified Advisory] Audit log write failed:', error);
    }
  }

  async getAuditTrail(clientId: string, limit: number = 50): Promise<AdvisoryAuditLog[]> {
    const logs = Array.from(this.auditLogs.values())
      .filter(log => log.clientId === clientId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
    
    return logs;
  }
}

export const unifiedAdvisoryService = new UnifiedAdvisoryService();
