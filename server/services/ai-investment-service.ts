import { db } from "../db";
import { 
  aiProfitPicks, 
  portfolioAlerts, 
  aiPortfolioAnalysis, 
  aiTalkingPoints,
  portfolios,
  portfolioHoldings,
  userProfiles,
  users,
  marketData,
  investmentProposals,
  investmentProposalItems
} from "@shared/schema";
import type { 
  AiProfitPick, 
  InsertAiProfitPick,
  PortfolioAlert,
  InsertPortfolioAlert,
  AiPortfolioAnalysis,
  InsertAiPortfolioAnalysis,
  AiTalkingPoint,
  InsertAiTalkingPoint
} from "@shared/schema";
import { eq, and, desc, asc, gte, lte, sql, inArray } from "drizzle-orm";
let GoogleGenerativeAI: any;
try {
  GoogleGenerativeAI = require("@google/generative-ai").GoogleGenerativeAI;
} catch {
  GoogleGenerativeAI = null;
}

interface PortfolioHolding {
  id: string;
  symbol: string;
  quantity: string;
  avgPrice: string;
  assetType: string;
  sector?: string | null;
  marketCap?: string | null;
  beta?: string | null;
  peRatio?: string | null;
  dividendYield?: string | null;
}

interface StockAnalysis {
  symbol: string;
  stockName: string;
  currentPrice: number;
  targetPrice: number;
  upsidePercent: number;
  profitScore: number;
  signalType: 'buy' | 'sell' | 'hold';
  timeHorizon: 'ultra_short' | 'short' | 'medium' | 'long';
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
  sector: string;
  aiReason: string;
  keyFactors: string[];
  riskFactors: string[];
}

interface PortfolioMetrics {
  totalValue: number;
  totalInvested: number;
  gainLoss: number;
  gainLossPercent: number;
  equityAllocation: number;
  debtAllocation: number;
  riskScore: number;
  sectorConcentration: Record<string, number>;
  topHoldings: { symbol: string; weight: number }[];
}

class AIInvestmentService {
  private genAI: any = null;

  constructor() {
    const apiKey = process.env.AI_INTEGRATIONS_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      console.log("✅ AI Investment Service initialized with Gemini");
    } else {
      console.log("⚠️ AI Investment Service running without Gemini (using rule-based analysis)");
    }
  }

  async getClientPortfolio(clientId: string): Promise<{ portfolio: any; holdings: PortfolioHolding[] } | null> {
    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, clientId))
      .limit(1);

    if (!portfolio) return null;

    const holdings = await db
      .select()
      .from(portfolioHoldings)
      .where(eq(portfolioHoldings.portfolioId, portfolio.id));

    return { portfolio, holdings };
  }

  async analyzePortfolio(clientId: string, portfolioId?: string): Promise<AiPortfolioAnalysis> {
    const clientData = await this.getClientPortfolio(clientId);
    if (!clientData) {
      throw new Error("Client portfolio not found");
    }

    const { portfolio, holdings } = clientData;
    const metrics = await this.calculatePortfolioMetrics(holdings);
    
    const [userProfile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, clientId))
      .limit(1);

    const clientRiskProfile = userProfile?.riskTolerance || 'moderate';
    const portfolioRiskAlignment = this.assessRiskAlignment(metrics.riskScore, clientRiskProfile);
    
    let aiSummary = "";
    let keyStrengths: string[] = [];
    let keyWeaknesses: string[] = [];
    let recommendations: string[] = [];

    if (this.genAI) {
      const aiInsights = await this.generateAIInsights(holdings, metrics, clientRiskProfile);
      aiSummary = aiInsights.summary;
      keyStrengths = aiInsights.strengths;
      keyWeaknesses = aiInsights.weaknesses;
      recommendations = aiInsights.recommendations;
    } else {
      const ruleBasedInsights = this.generateRuleBasedInsights(holdings, metrics, clientRiskProfile);
      aiSummary = ruleBasedInsights.summary;
      keyStrengths = ruleBasedInsights.strengths;
      keyWeaknesses = ruleBasedInsights.weaknesses;
      recommendations = ruleBasedInsights.recommendations;
    }

    const overallHealthScore = this.calculateHealthScore(metrics, portfolioRiskAlignment);

    const [analysisResult] = await db.insert(aiPortfolioAnalysis).values({
      clientId,
      portfolioId: portfolio.id,
      totalValue: String(metrics.totalValue),
      totalInvested: String(metrics.totalInvested),
      totalGainLoss: String(metrics.gainLoss),
      totalGainLossPercent: String(metrics.gainLossPercent),
      riskScore: metrics.riskScore,
      equityAllocation: String(metrics.equityAllocation),
      debtAllocation: String(metrics.debtAllocation),
      sectorConcentration: metrics.sectorConcentration,
      topHoldingWeight: String(metrics.topHoldings[0]?.weight || 0),
      top5HoldingsWeight: String(metrics.topHoldings.slice(0, 5).reduce((sum, h) => sum + h.weight, 0)),
      clientRiskProfile,
      portfolioRiskAlignment,
      overallHealthScore,
      aiSummary,
      keyStrengths,
      keyWeaknesses,
      recommendations,
      status: "completed",
    }).returning();

    return analysisResult;
  }

  private async calculatePortfolioMetrics(holdings: PortfolioHolding[]): Promise<PortfolioMetrics> {
    let totalValue = 0;
    let totalInvested = 0;
    const sectorAllocation: Record<string, number> = {};
    const holdingValues: { symbol: string; value: number }[] = [];
    let equityValue = 0;
    let debtValue = 0;

    for (const holding of holdings) {
      const quantity = parseFloat(holding.quantity) || 0;
      const avgPrice = parseFloat(holding.avgPrice) || 0;
      const invested = quantity * avgPrice;
      
      const [marketDataEntry] = await db
        .select()
        .from(marketData)
        .where(eq(marketData.symbol, holding.symbol))
        .limit(1);
      
      const currentPrice = marketDataEntry?.price ? parseFloat(marketDataEntry.price) : avgPrice;
      const currentValue = quantity * currentPrice;

      totalInvested += invested;
      totalValue += currentValue;
      holdingValues.push({ symbol: holding.symbol, value: currentValue });

      const sector = holding.sector || 'Other';
      sectorAllocation[sector] = (sectorAllocation[sector] || 0) + currentValue;

      if (holding.assetType === 'equity' || holding.assetType === 'mf') {
        equityValue += currentValue;
      } else if (holding.assetType === 'bond' || holding.assetType === 'debt') {
        debtValue += currentValue;
      }
    }

    const sectorConcentration: Record<string, number> = {};
    for (const [sector, value] of Object.entries(sectorAllocation)) {
      sectorConcentration[sector] = totalValue > 0 ? (value / totalValue) * 100 : 0;
    }

    holdingValues.sort((a, b) => b.value - a.value);
    const topHoldings = holdingValues.slice(0, 10).map(h => ({
      symbol: h.symbol,
      weight: totalValue > 0 ? (h.value / totalValue) * 100 : 0
    }));

    const maxConcentration = Math.max(...Object.values(sectorConcentration), 0);
    const topHoldingWeight = topHoldings[0]?.weight || 0;
    const riskScore = Math.min(100, Math.round(
      (maxConcentration * 0.3) + 
      (topHoldingWeight * 0.3) + 
      ((100 - (debtValue / totalValue * 100)) * 0.4)
    ));

    return {
      totalValue,
      totalInvested,
      gainLoss: totalValue - totalInvested,
      gainLossPercent: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
      equityAllocation: totalValue > 0 ? (equityValue / totalValue) * 100 : 0,
      debtAllocation: totalValue > 0 ? (debtValue / totalValue) * 100 : 0,
      riskScore,
      sectorConcentration,
      topHoldings
    };
  }

  private assessRiskAlignment(portfolioRiskScore: number, clientRiskProfile: string): string {
    const riskThresholds: Record<string, { min: number; max: number }> = {
      conservative: { min: 0, max: 35 },
      moderate: { min: 25, max: 65 },
      aggressive: { min: 55, max: 100 }
    };

    const threshold = riskThresholds[clientRiskProfile] || riskThresholds.moderate;
    
    if (portfolioRiskScore >= threshold.min && portfolioRiskScore <= threshold.max) {
      return 'aligned';
    } else if (Math.abs(portfolioRiskScore - (threshold.min + threshold.max) / 2) <= 20) {
      return 'slightly_misaligned';
    }
    return 'misaligned';
  }

  private calculateHealthScore(metrics: PortfolioMetrics, riskAlignment: string): number {
    let score = 70;

    if (riskAlignment === 'aligned') score += 15;
    else if (riskAlignment === 'slightly_misaligned') score += 5;
    else score -= 10;

    if (metrics.gainLossPercent > 0) score += Math.min(10, metrics.gainLossPercent);
    else score += Math.max(-10, metrics.gainLossPercent / 2);

    const maxSectorConcentration = Math.max(...Object.values(metrics.sectorConcentration), 0);
    if (maxSectorConcentration < 30) score += 5;
    else if (maxSectorConcentration > 50) score -= 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private async generateAIInsights(
    holdings: PortfolioHolding[],
    metrics: PortfolioMetrics,
    clientRiskProfile: string
  ): Promise<{ summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] }> {
    if (!this.genAI) {
      return this.generateRuleBasedInsights(holdings, metrics, clientRiskProfile);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `Analyze this investment portfolio and provide insights:

Portfolio Summary:
- Total Value: ₹${metrics.totalValue.toLocaleString('en-IN')}
- Total Invested: ₹${metrics.totalInvested.toLocaleString('en-IN')}
- Gain/Loss: ${metrics.gainLossPercent.toFixed(2)}%
- Equity Allocation: ${metrics.equityAllocation.toFixed(1)}%
- Debt Allocation: ${metrics.debtAllocation.toFixed(1)}%
- Risk Score: ${metrics.riskScore}/100
- Client Risk Profile: ${clientRiskProfile}

Top Holdings:
${metrics.topHoldings.slice(0, 5).map(h => `- ${h.symbol}: ${h.weight.toFixed(1)}%`).join('\n')}

Sector Concentration:
${Object.entries(metrics.sectorConcentration).map(([s, v]) => `- ${s}: ${v.toFixed(1)}%`).join('\n')}

Provide a JSON response with:
{
  "summary": "Brief 2-3 sentence portfolio summary",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || "Portfolio analysis completed.",
          strengths: parsed.strengths || [],
          weaknesses: parsed.weaknesses || [],
          recommendations: parsed.recommendations || []
        };
      }
    } catch (error) {
      console.error("AI insights generation failed:", error);
    }

    return this.generateRuleBasedInsights(holdings, metrics, clientRiskProfile);
  }

  private generateRuleBasedInsights(
    holdings: PortfolioHolding[],
    metrics: PortfolioMetrics,
    clientRiskProfile: string
  ): { summary: string; strengths: string[]; weaknesses: string[]; recommendations: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const recommendations: string[] = [];

    if (metrics.gainLossPercent > 5) {
      strengths.push(`Portfolio showing positive returns of ${metrics.gainLossPercent.toFixed(1)}%`);
    }
    
    if (Object.keys(metrics.sectorConcentration).length >= 4) {
      strengths.push("Good sector diversification across multiple industries");
    }

    if (holdings.length >= 10) {
      strengths.push("Well-diversified with multiple holdings");
    }

    const maxConcentration = Math.max(...Object.values(metrics.sectorConcentration), 0);
    if (maxConcentration > 40) {
      weaknesses.push(`High concentration in single sector (${maxConcentration.toFixed(1)}%)`);
      recommendations.push("Consider reducing sector concentration to below 30%");
    }

    if (metrics.topHoldings[0]?.weight > 25) {
      weaknesses.push(`Top holding represents ${metrics.topHoldings[0].weight.toFixed(1)}% of portfolio`);
      recommendations.push("Reduce single stock concentration to below 20%");
    }

    const riskAlignment = this.assessRiskAlignment(metrics.riskScore, clientRiskProfile);
    if (riskAlignment === 'misaligned') {
      weaknesses.push(`Portfolio risk (${metrics.riskScore}) doesn't match ${clientRiskProfile} profile`);
      if (clientRiskProfile === 'conservative' && metrics.riskScore > 50) {
        recommendations.push("Increase debt allocation to reduce portfolio risk");
      } else if (clientRiskProfile === 'aggressive' && metrics.riskScore < 40) {
        recommendations.push("Consider increasing equity exposure for growth");
      }
    }

    if (metrics.debtAllocation < 10 && clientRiskProfile !== 'aggressive') {
      recommendations.push("Add fixed income instruments for portfolio stability");
    }

    const summary = `Portfolio of ₹${metrics.totalValue.toLocaleString('en-IN')} with ${metrics.gainLossPercent >= 0 ? 'positive' : 'negative'} returns of ${Math.abs(metrics.gainLossPercent).toFixed(1)}%. Risk score of ${metrics.riskScore}/100 is ${riskAlignment.replace('_', ' ')} with your ${clientRiskProfile} profile.`;

    return { summary, strengths, weaknesses, recommendations };
  }

  async generateProfitPicks(clientId: string, options: {
    count?: number;
    timeHorizon?: string;
    riskLevel?: string;
  } = {}): Promise<AiProfitPick[]> {
    const { count = 5, timeHorizon, riskLevel } = options;

    const clientData = await this.getClientPortfolio(clientId);
    const [userProfile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, clientId))
      .limit(1);

    const clientRiskProfile = userProfile?.riskTolerance || 'moderate';
    
    const stockPicks = await this.generateStockRecommendations(clientRiskProfile, {
      count,
      timeHorizon,
      riskLevel,
      existingHoldings: clientData?.holdings.map(h => h.symbol) || []
    });

    const insertedPicks: AiProfitPick[] = [];
    
    for (const pick of stockPicks) {
      const [inserted] = await db.insert(aiProfitPicks).values({
        clientId,
        stockName: pick.stockName,
        symbol: pick.symbol,
        currentPrice: String(pick.currentPrice),
        targetPrice: String(pick.targetPrice),
        upsidePercent: String(pick.upsidePercent),
        profitScore: pick.profitScore,
        signalType: pick.signalType,
        timeHorizon: pick.timeHorizon,
        riskLevel: pick.riskLevel,
        sector: pick.sector,
        aiReason: pick.aiReason,
        keyFactors: pick.keyFactors,
        riskFactors: pick.riskFactors,
        status: "active",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }).returning();
      
      insertedPicks.push(inserted);
    }

    return insertedPicks;
  }

  private async generateStockRecommendations(
    clientRiskProfile: string,
    options: {
      count: number;
      timeHorizon?: string;
      riskLevel?: string;
      existingHoldings: string[];
    }
  ): Promise<StockAnalysis[]> {
    const stockUniverse: StockAnalysis[] = [
      {
        symbol: "RELIANCE",
        stockName: "Reliance Industries Ltd",
        currentPrice: 2850,
        targetPrice: 3200,
        upsidePercent: 12.28,
        profitScore: 85,
        signalType: 'buy',
        timeHorizon: 'medium',
        riskLevel: 'moderate',
        sector: "Energy",
        aiReason: "Strong retail and digital business growth with stable refining margins. Jio Platforms continues to show robust subscriber additions.",
        keyFactors: ["Retail expansion", "5G rollout catalyst", "Green energy investments"],
        riskFactors: ["Oil price volatility", "High capital expenditure"]
      },
      {
        symbol: "HDFCBANK",
        stockName: "HDFC Bank Ltd",
        currentPrice: 1680,
        targetPrice: 1900,
        upsidePercent: 13.10,
        profitScore: 88,
        signalType: 'buy',
        timeHorizon: 'medium',
        riskLevel: 'low',
        sector: "Banking",
        aiReason: "Best-in-class asset quality with consistent loan growth. Post-merger integration proceeding smoothly with synergy benefits.",
        keyFactors: ["Strong NIM", "Digital banking leadership", "Low NPA ratio"],
        riskFactors: ["Interest rate sensitivity", "Competition from fintech"]
      },
      {
        symbol: "TCS",
        stockName: "Tata Consultancy Services",
        currentPrice: 4150,
        targetPrice: 4600,
        upsidePercent: 10.84,
        profitScore: 82,
        signalType: 'buy',
        timeHorizon: 'long',
        riskLevel: 'low',
        sector: "Technology",
        aiReason: "Market leader in IT services with strong deal pipeline. AI/ML investments positioning well for future growth.",
        keyFactors: ["Consistent dividend payer", "Strong brand", "AI integration"],
        riskFactors: ["Currency fluctuation", "Tech spending slowdown"]
      },
      {
        symbol: "INFY",
        stockName: "Infosys Ltd",
        currentPrice: 1820,
        targetPrice: 2100,
        upsidePercent: 15.38,
        profitScore: 80,
        signalType: 'buy',
        timeHorizon: 'medium',
        riskLevel: 'low',
        sector: "Technology",
        aiReason: "Strong large deal momentum with improving margins. Cloud and digital services driving growth.",
        keyFactors: ["Large deal wins", "Operating margin improvement", "Digital transformation leader"],
        riskFactors: ["Client concentration", "Visa regulations"]
      },
      {
        symbol: "BHARTIARTL",
        stockName: "Bharti Airtel Ltd",
        currentPrice: 1580,
        targetPrice: 1850,
        upsidePercent: 17.09,
        profitScore: 84,
        signalType: 'buy',
        timeHorizon: 'medium',
        riskLevel: 'moderate',
        sector: "Telecom",
        aiReason: "Market share gains with ARPU improvement. 5G network expansion creating new revenue streams.",
        keyFactors: ["5G monetization", "Africa business growth", "ARPU expansion"],
        riskFactors: ["Spectrum cost", "Competition from Jio"]
      },
      {
        symbol: "TATAMOTORS",
        stockName: "Tata Motors Ltd",
        currentPrice: 980,
        targetPrice: 1180,
        upsidePercent: 20.41,
        profitScore: 78,
        signalType: 'buy',
        timeHorizon: 'short',
        riskLevel: 'high',
        sector: "Automobile",
        aiReason: "JLR turnaround story with strong EV pipeline. Domestic EV market leadership strengthening.",
        keyFactors: ["EV market share", "JLR profitability", "Chip shortage easing"],
        riskFactors: ["Commodity prices", "Currency volatility", "EV competition"]
      },
      {
        symbol: "SBIN",
        stockName: "State Bank of India",
        currentPrice: 820,
        targetPrice: 950,
        upsidePercent: 15.85,
        profitScore: 79,
        signalType: 'buy',
        timeHorizon: 'medium',
        riskLevel: 'moderate',
        sector: "Banking",
        aiReason: "Improved asset quality with strong credit growth. Digital transformation driving efficiency.",
        keyFactors: ["Credit cost reduction", "CASA ratio improvement", "Government support"],
        riskFactors: ["PSU bank challenges", "Rate sensitivity"]
      },
      {
        symbol: "WIPRO",
        stockName: "Wipro Ltd",
        currentPrice: 520,
        targetPrice: 600,
        upsidePercent: 15.38,
        profitScore: 72,
        signalType: 'buy',
        timeHorizon: 'medium',
        riskLevel: 'moderate',
        sector: "Technology",
        aiReason: "Turnaround story with focus on large deals. Improved deal win momentum in recent quarters.",
        keyFactors: ["Large deal wins", "Margin improvement focus", "Capco integration"],
        riskFactors: ["Client attrition", "Execution risk"]
      },
      {
        symbol: "ICICIBANK",
        stockName: "ICICI Bank Ltd",
        currentPrice: 1240,
        targetPrice: 1420,
        upsidePercent: 14.52,
        profitScore: 86,
        signalType: 'buy',
        timeHorizon: 'long',
        riskLevel: 'low',
        sector: "Banking",
        aiReason: "Strong retail franchise with best-in-class digital capabilities. Consistent earnings growth trajectory.",
        keyFactors: ["Digital banking", "Loan growth", "Asset quality"],
        riskFactors: ["Retail NPAs", "Competition"]
      },
      {
        symbol: "BAJFINANCE",
        stockName: "Bajaj Finance Ltd",
        currentPrice: 6800,
        targetPrice: 7800,
        upsidePercent: 14.71,
        profitScore: 81,
        signalType: 'buy',
        timeHorizon: 'medium',
        riskLevel: 'moderate',
        sector: "NBFC",
        aiReason: "Consumer finance leader with strong AUM growth. Digital lending platform showing strong traction.",
        keyFactors: ["AUM growth", "Customer acquisition", "Cross-selling"],
        riskFactors: ["Interest rate sensitivity", "Regulatory changes"]
      }
    ];

    let filteredStocks = stockUniverse.filter(s => !options.existingHoldings.includes(s.symbol));

    if (options.timeHorizon) {
      filteredStocks = filteredStocks.filter(s => s.timeHorizon === options.timeHorizon);
    }

    const targetRiskLevel = options.riskLevel || this.mapRiskProfile(clientRiskProfile);
    if (targetRiskLevel) {
      filteredStocks = filteredStocks.filter(s => {
        if (targetRiskLevel === 'low') return s.riskLevel === 'low';
        if (targetRiskLevel === 'moderate') return s.riskLevel !== 'very_high';
        return true;
      });
    }

    filteredStocks.sort((a, b) => b.profitScore - a.profitScore);

    return filteredStocks.slice(0, options.count);
  }

  private mapRiskProfile(profile: string): string {
    const mapping: Record<string, string> = {
      conservative: 'low',
      moderate: 'moderate',
      aggressive: 'high'
    };
    return mapping[profile] || 'moderate';
  }

  async generateAlerts(clientId: string): Promise<PortfolioAlert[]> {
    const clientData = await this.getClientPortfolio(clientId);
    if (!clientData) return [];

    const { portfolio, holdings } = clientData;
    const metrics = await this.calculatePortfolioMetrics(holdings);
    const alerts: InsertPortfolioAlert[] = [];

    const maxSectorConcentration = Math.max(...Object.values(metrics.sectorConcentration), 0);
    if (maxSectorConcentration > 40) {
      const topSector = Object.entries(metrics.sectorConcentration)
        .sort((a, b) => b[1] - a[1])[0];
      
      alerts.push({
        clientId,
        portfolioId: portfolio.id,
        alertType: 'concentration',
        alertCategory: 'risk',
        severity: maxSectorConcentration > 50 ? 'high' : 'medium',
        alertTitle: 'High Sector Concentration',
        alertMessage: `${topSector[0]} sector represents ${topSector[1].toFixed(1)}% of your portfolio`,
        triggerMetric: 'sector_concentration',
        triggerValue: String(topSector[1]),
        triggerThreshold: '40',
        triggerDirection: 'above',
        recommendedAction: 'rebalance',
        actionDescription: 'Consider diversifying into other sectors to reduce concentration risk',
        aiInsight: `High concentration in ${topSector[0]} increases portfolio volatility. Consider reducing exposure to maintain a balanced risk profile.`,
        status: 'active'
      });
    }

    if (metrics.topHoldings[0]?.weight > 20) {
      alerts.push({
        clientId,
        portfolioId: portfolio.id,
        alertType: 'concentration',
        alertCategory: 'risk',
        severity: metrics.topHoldings[0].weight > 30 ? 'high' : 'medium',
        alertTitle: 'Single Stock Concentration',
        alertMessage: `${metrics.topHoldings[0].symbol} represents ${metrics.topHoldings[0].weight.toFixed(1)}% of portfolio`,
        symbol: metrics.topHoldings[0].symbol,
        currentWeight: String(metrics.topHoldings[0].weight),
        recommendedWeight: '15',
        triggerMetric: 'holding_weight',
        triggerValue: String(metrics.topHoldings[0].weight),
        triggerThreshold: '20',
        triggerDirection: 'above',
        recommendedAction: 'sell',
        actionDescription: 'Reduce position size to below 15% for better diversification',
        status: 'active'
      });
    }

    if (metrics.gainLossPercent < -10) {
      alerts.push({
        clientId,
        portfolioId: portfolio.id,
        alertType: 'loss_trigger',
        alertCategory: 'performance',
        severity: metrics.gainLossPercent < -20 ? 'critical' : 'high',
        alertTitle: 'Significant Portfolio Loss',
        alertMessage: `Portfolio is down ${Math.abs(metrics.gainLossPercent).toFixed(1)}% from invested value`,
        triggerMetric: 'portfolio_return',
        triggerValue: String(metrics.gainLossPercent),
        triggerThreshold: '-10',
        triggerDirection: 'below',
        recommendedAction: 'review',
        actionDescription: 'Review holdings and consider tax-loss harvesting opportunities',
        actionUrgency: 'urgent',
        status: 'active'
      });
    }

    if (metrics.gainLossPercent > 25) {
      alerts.push({
        clientId,
        portfolioId: portfolio.id,
        alertType: 'profit_trigger',
        alertCategory: 'performance',
        severity: 'medium',
        alertTitle: 'Profit Booking Opportunity',
        alertMessage: `Portfolio is up ${metrics.gainLossPercent.toFixed(1)}% - consider partial profit booking`,
        triggerMetric: 'portfolio_return',
        triggerValue: String(metrics.gainLossPercent),
        triggerThreshold: '25',
        triggerDirection: 'above',
        recommendedAction: 'sell',
        actionDescription: 'Consider booking partial profits in outperforming positions',
        status: 'active'
      });
    }

    const insertedAlerts: PortfolioAlert[] = [];
    for (const alert of alerts) {
      const [inserted] = await db.insert(portfolioAlerts).values(alert).returning();
      insertedAlerts.push(inserted);
    }

    return insertedAlerts;
  }

  async generateTalkingPoints(clientId: string, analysisId?: string): Promise<AiTalkingPoint[]> {
    const latestAnalysis = analysisId 
      ? await db.select().from(aiPortfolioAnalysis).where(eq(aiPortfolioAnalysis.id, analysisId)).limit(1)
      : await db.select().from(aiPortfolioAnalysis)
          .where(eq(aiPortfolioAnalysis.clientId, clientId))
          .orderBy(desc(aiPortfolioAnalysis.createdAt))
          .limit(1);

    if (!latestAnalysis.length) {
      throw new Error("No portfolio analysis found. Run analysis first.");
    }

    const analysis = latestAnalysis[0];
    const talkingPoints: InsertAiTalkingPoint[] = [];

    const [user] = await db.select().from(users).where(eq(users.id, clientId)).limit(1);
    const clientName = user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}` : "Client";

    talkingPoints.push({
      clientId,
      analysisId: analysis.id,
      pointType: 'greeting',
      category: 'performance',
      title: 'Opening Greeting',
      agentScript: `Good ${this.getTimeOfDay()}, ${clientName}! I've completed a comprehensive review of your investment portfolio. Let me walk you through the key findings and some exciting opportunities I've identified for you.`,
      clientFacingVersion: `Review of your investment portfolio with key insights and opportunities.`,
      tone: 'friendly',
      sequenceOrder: 1,
      isRequired: true,
      status: 'active'
    });

    talkingPoints.push({
      clientId,
      analysisId: analysis.id,
      pointType: 'portfolio_summary',
      category: 'performance',
      title: 'Portfolio Overview',
      agentScript: `Your portfolio is currently valued at ₹${parseFloat(analysis.totalValue || '0').toLocaleString('en-IN')} with an overall health score of ${analysis.overallHealthScore}/100. ${analysis.aiSummary || ''}`,
      clientFacingVersion: `Portfolio value: ₹${parseFloat(analysis.totalValue || '0').toLocaleString('en-IN')}. Health Score: ${analysis.overallHealthScore}/100.`,
      supportingData: {
        totalValue: analysis.totalValue,
        healthScore: analysis.overallHealthScore,
        gainLoss: analysis.totalGainLoss,
        gainLossPercent: analysis.totalGainLossPercent
      },
      tone: 'professional',
      sequenceOrder: 2,
      isRequired: true,
      status: 'active'
    });

    const strengths = (analysis.keyStrengths as string[] || []).slice(0, 2);
    if (strengths.length > 0) {
      talkingPoints.push({
        clientId,
        analysisId: analysis.id,
        pointType: 'recommendation',
        category: 'performance',
        title: 'Portfolio Strengths',
        agentScript: `I'm pleased to highlight some strengths in your portfolio: ${strengths.join('. Also, ')}. These are working well for your long-term goals.`,
        clientFacingVersion: strengths.join('. '),
        emphasis: 'positive',
        tone: 'friendly',
        sequenceOrder: 3,
        status: 'active'
      });
    }

    const weaknesses = (analysis.keyWeaknesses as string[] || []).slice(0, 2);
    if (weaknesses.length > 0) {
      talkingPoints.push({
        clientId,
        analysisId: analysis.id,
        pointType: 'risk_warning',
        category: 'risk',
        title: 'Areas for Improvement',
        agentScript: `There are a few areas we should address: ${weaknesses.join('. Additionally, ')}. I have specific recommendations to help improve these.`,
        clientFacingVersion: weaknesses.join('. '),
        emphasis: 'cautionary',
        tone: 'cautious',
        sequenceOrder: 4,
        status: 'active'
      });
    }

    const recommendations = (analysis.recommendations as string[] || []).slice(0, 3);
    if (recommendations.length > 0) {
      talkingPoints.push({
        clientId,
        analysisId: analysis.id,
        pointType: 'action_item',
        category: 'recommendation',
        title: 'Recommended Actions',
        agentScript: `Based on my analysis, here are my top recommendations: ${recommendations.map((r, i) => `${i + 1}. ${r}`).join('. ')}`,
        clientFacingVersion: recommendations.join('. '),
        tone: 'professional',
        sequenceOrder: 5,
        isRequired: true,
        status: 'active'
      });
    }

    talkingPoints.push({
      clientId,
      analysisId: analysis.id,
      pointType: 'closing',
      category: 'compliance',
      title: 'Closing & Disclaimer',
      agentScript: `These recommendations are based on current market conditions and your risk profile. Shall I prepare a formal proposal for you to review at your convenience? Remember, all investments carry inherent risks, and past performance doesn't guarantee future returns.`,
      clientFacingVersion: `Investment recommendations are subject to market risks. Please review the proposal carefully before making any decisions.`,
      tone: 'professional',
      sequenceOrder: 10,
      isRequired: true,
      status: 'active'
    });

    const insertedPoints: AiTalkingPoint[] = [];
    for (const point of talkingPoints) {
      const [inserted] = await db.insert(aiTalkingPoints).values(point).returning();
      insertedPoints.push(inserted);
    }

    return insertedPoints;
  }

  private getTimeOfDay(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  }

  async getClientProfitPicks(clientId: string, status?: string): Promise<AiProfitPick[]> {
    const conditions = [eq(aiProfitPicks.clientId, clientId)];
    if (status) {
      conditions.push(eq(aiProfitPicks.status, status));
    }

    return db
      .select()
      .from(aiProfitPicks)
      .where(and(...conditions))
      .orderBy(desc(aiProfitPicks.profitScore));
  }

  async getClientAlerts(clientId: string, status?: string): Promise<PortfolioAlert[]> {
    const conditions = [eq(portfolioAlerts.clientId, clientId)];
    if (status) {
      conditions.push(eq(portfolioAlerts.status, status));
    }

    return db
      .select()
      .from(portfolioAlerts)
      .where(and(...conditions))
      .orderBy(desc(portfolioAlerts.severity), desc(portfolioAlerts.createdAt));
  }

  async approveProfitPick(pickId: string, agentId: string, modifications?: {
    targetPrice?: number;
    quantity?: number;
    notes?: string;
  }): Promise<AiProfitPick> {
    const updateData: any = {
      agentApproved: true,
      updatedAt: new Date()
    };

    if (modifications) {
      if (modifications.targetPrice) {
        updateData.modifiedTargetPrice = String(modifications.targetPrice);
        updateData.agentModified = true;
      }
      if (modifications.quantity) {
        updateData.modifiedQuantity = modifications.quantity;
        updateData.agentModified = true;
      }
      if (modifications.notes) {
        updateData.agentNotes = modifications.notes;
      }
    }

    const [updated] = await db
      .update(aiProfitPicks)
      .set(updateData)
      .where(eq(aiProfitPicks.id, pickId))
      .returning();

    return updated;
  }

  async createProposalFromPicks(
    clientId: string,
    agentId: string,
    pickIds: string[],
    proposalTitle?: string
  ): Promise<{ proposalId: string; itemCount: number }> {
    const picks = await db
      .select()
      .from(aiProfitPicks)
      .where(inArray(aiProfitPicks.id, pickIds));

    if (picks.length === 0) {
      throw new Error("No valid picks found");
    }

    const totalAmount = picks.reduce((sum, pick) => {
      const quantity = pick.modifiedQuantity || pick.proposedQuantity || 10;
      const price = parseFloat(pick.modifiedTargetPrice || pick.currentPrice);
      return sum + (quantity * price);
    }, 0);

    const proposalId = `AI-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const recommendationsData = picks.map(pick => ({
      symbol: pick.symbol,
      stockName: pick.stockName,
      signalType: pick.signalType,
      currentPrice: pick.currentPrice,
      targetPrice: pick.targetPrice,
      upsidePercent: pick.upsidePercent,
      profitScore: pick.profitScore,
      timeHorizon: pick.timeHorizon,
      riskLevel: pick.riskLevel,
      aiReason: pick.aiReason
    }));

    const [proposal] = await db.insert(investmentProposals).values({
      id: proposalId,
      clientId,
      agentId,
      proposalSource: 'ai',
      title: proposalTitle || 'AI-Generated Investment Recommendations',
      description: `Investment proposal based on AI analysis with ${picks.length} stock recommendations`,
      recommendations: recommendationsData,
      totalInvestmentAmount: String(totalAmount),
      status: 'draft',
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }).returning();

    for (const pick of picks) {
      const quantity = pick.modifiedQuantity || pick.proposedQuantity || 10;
      const price = parseFloat(pick.currentPrice);
      const itemAmount = quantity * price;
      const allocationPct = totalAmount > 0 ? (itemAmount / totalAmount) * 100 : 0;
      
      await db.insert(investmentProposalItems).values({
        proposalId: proposal.id,
        productType: 'equity',
        productName: pick.stockName,
        productCode: pick.symbol,
        recommendedAmount: String(itemAmount),
        allocationPercentage: String(allocationPct),
        selectionReason: pick.aiReason,
        riskRating: pick.riskLevel,
        expectedOutcome: `Expected upside of ${pick.upsidePercent}% with ${pick.timeHorizon} horizon`,
      });

      await db
        .update(aiProfitPicks)
        .set({
          addedToProposal: true,
          proposalId: proposal.id,
          proposedQuantity: quantity,
          proposedAmount: String(quantity * price),
          updatedAt: new Date()
        })
        .where(eq(aiProfitPicks.id, pick.id));
    }

    return { proposalId: proposal.id, itemCount: picks.length };
  }

  // Check benchmark alerts for a client - returns active alerts or generates new ones
  async checkBenchmarkAlerts(clientId: string): Promise<PortfolioAlert[]> {
    // First, try to get existing active alerts
    const existingAlerts = await this.getClientAlerts(clientId, 'active');
    
    if (existingAlerts.length > 0) {
      return existingAlerts;
    }
    
    // If no active alerts, generate new ones
    try {
      const generatedAlerts = await this.generateAlerts(clientId);
      return generatedAlerts;
    } catch (error) {
      // If alert generation fails (e.g., no portfolio), return empty array
      console.log('No alerts generated for client:', clientId);
      return [];
    }
  }
}

export const aiInvestmentService = new AIInvestmentService();
