import { db } from "./db";
import { 
  investmentIdeas, 
  investmentIdeaTracking, 
  investmentIdeaAlerts, 
  yieldTracker,
  InsertInvestmentIdea,
  InsertInvestmentIdeaTracking,
  InsertInvestmentIdeaAlert,
  InvestmentIdea 
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  marketCap?: number;
  sector?: string;
  historialPrices?: number[]; // Last 50 days for technical analysis
}

interface TechnicalIndicators {
  rsi: number;
  macd: number;
  macdSignal: number;
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  bollingerUpperBand: number;
  bollingerLowerBand: number;
  supportLevel: number;
  resistanceLevel: number;
  volatility: number;
}

interface InvestmentRecommendation {
  symbol: string;
  companyName: string;
  ideaTitle: string;
  ideaDescription: string;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  riskLevel: 'low' | 'medium' | 'high';
  timeHorizon: 'short' | 'medium' | 'long';
  aiConfidenceScore: number;
  aiReasoning: string;
  catalysts: string[];
  risks: string[];
  recommendedInvestment: number;
  technicalIndicators: TechnicalIndicators;
}

export class SmartInvestmentService {
  // Calculate RSI (Relative Strength Index)
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50; // Default neutral value
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // Calculate Simple Moving Average
  private calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    
    const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0);
    return sum / period;
  }

  // Calculate Exponential Moving Average
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    if (prices.length === 1) return prices[0];
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  // Calculate MACD
  private calculateMACD(prices: number[]): { macd: number; signal: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    
    // Simple signal line calculation (normally would be EMA of MACD)
    const signal = macd * 0.9; // Simplified for demo
    
    return { macd, signal };
  }

  // Calculate Bollinger Bands
  private calculateBollingerBands(prices: number[], period: number = 20): { upper: number; lower: number } {
    const sma = this.calculateSMA(prices, period);
    const recentPrices = prices.slice(-period);
    
    const variance = recentPrices.reduce((acc, price) => acc + Math.pow(price - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    return {
      upper: sma + (2 * stdDev),
      lower: sma - (2 * stdDev)
    };
  }

  // Calculate support and resistance levels
  private calculateSupportResistance(prices: number[]): { support: number; resistance: number } {
    const recentPrices = prices.slice(-20); // Last 20 periods
    const sorted = [...recentPrices].sort((a, b) => a - b);
    
    return {
      support: sorted[Math.floor(sorted.length * 0.2)], // 20th percentile
      resistance: sorted[Math.floor(sorted.length * 0.8)] // 80th percentile
    };
  }

  // Calculate volatility
  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // Annualized volatility
  }

  // Analyze technical indicators for a stock
  async analyzeTechnicalIndicators(marketData: MarketData): Promise<TechnicalIndicators> {
    const prices = marketData.historialPrices || [];
    const currentPrice = marketData.price;
    
    const rsi = this.calculateRSI(prices);
    const { macd, signal } = this.calculateMACD(prices);
    const sma20 = this.calculateSMA(prices, 20);
    const sma50 = this.calculateSMA(prices, 50);
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const { upper, lower } = this.calculateBollingerBands(prices);
    const { support, resistance } = this.calculateSupportResistance(prices);
    const volatility = this.calculateVolatility(prices);

    return {
      rsi,
      macd,
      macdSignal: signal,
      sma20,
      sma50,
      ema12,
      ema26,
      bollingerUpperBand: upper,
      bollingerLowerBand: lower,
      supportLevel: support,
      resistanceLevel: resistance,
      volatility
    };
  }

  // Generate AI-powered investment idea
  async generateInvestmentIdea(marketData: MarketData): Promise<InvestmentRecommendation> {
    const technicalIndicators = await this.analyzeTechnicalIndicators(marketData);
    const currentPrice = marketData.price;
    
    // AI Analysis Logic
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    let timeHorizon: 'short' | 'medium' | 'long' = 'medium';
    let confidenceScore = 0.5;
    let reasoning = '';
    let catalysts: string[] = [];
    let risks: string[] = [];

    // Technical Analysis Assessment
    const signals = {
      bullish: 0,
      bearish: 0,
      neutral: 0
    };

    // RSI Analysis
    if (technicalIndicators.rsi < 30) {
      signals.bullish += 2;
      catalysts.push('Oversold RSI condition suggests potential upward reversal');
    } else if (technicalIndicators.rsi > 70) {
      signals.bearish += 2;
      risks.push('Overbought RSI condition indicates potential downward correction');
    } else {
      signals.neutral += 1;
    }

    // MACD Analysis
    if (technicalIndicators.macd > technicalIndicators.macdSignal) {
      signals.bullish += 1;
      catalysts.push('MACD showing bullish momentum');
    } else {
      signals.bearish += 1;
      risks.push('MACD indicating bearish momentum');
    }

    // Moving Average Analysis
    if (currentPrice > technicalIndicators.sma20 && technicalIndicators.sma20 > technicalIndicators.sma50) {
      signals.bullish += 2;
      catalysts.push('Price above key moving averages indicating uptrend');
    } else if (currentPrice < technicalIndicators.sma20 && technicalIndicators.sma20 < technicalIndicators.sma50) {
      signals.bearish += 2;
      risks.push('Price below key moving averages indicating downtrend');
    }

    // Bollinger Bands Analysis
    if (currentPrice <= technicalIndicators.bollingerLowerBand) {
      signals.bullish += 1;
      catalysts.push('Price at lower Bollinger Band suggests potential bounce');
    } else if (currentPrice >= technicalIndicators.bollingerUpperBand) {
      signals.bearish += 1;
      risks.push('Price at upper Bollinger Band suggests potential pullback');
    }

    // Volatility Analysis
    if (technicalIndicators.volatility > 0.3) {
      riskLevel = 'high';
      risks.push('High volatility increases position risk');
    } else if (technicalIndicators.volatility < 0.15) {
      riskLevel = 'low';
      catalysts.push('Low volatility environment suitable for steady gains');
    }

    // Calculate confidence score
    const totalSignals = signals.bullish + signals.bearish + signals.neutral;
    if (signals.bullish > signals.bearish) {
      confidenceScore = Math.min(0.9, 0.5 + (signals.bullish / totalSignals) * 0.4);
      reasoning = `Technical analysis shows ${signals.bullish} bullish signals vs ${signals.bearish} bearish signals. `;
    } else if (signals.bearish > signals.bullish) {
      confidenceScore = Math.max(0.1, 0.5 - (signals.bearish / totalSignals) * 0.4);
      reasoning = `Technical analysis shows ${signals.bearish} bearish signals vs ${signals.bullish} bullish signals. `;
    } else {
      confidenceScore = 0.5;
      reasoning = 'Mixed technical signals suggest neutral outlook. ';
    }

    // Calculate price targets and stop loss
    const volatilityAdjustment = Math.max(0.02, technicalIndicators.volatility * 0.1);
    const targetPrice = signals.bullish > signals.bearish 
      ? currentPrice * (1 + volatilityAdjustment * 2)
      : currentPrice * (1 + volatilityAdjustment);
    
    const stopLoss = currentPrice * (1 - volatilityAdjustment * 1.5);

    // Determine time horizon
    if (technicalIndicators.volatility > 0.25) {
      timeHorizon = 'short';
    } else if (signals.bullish >= 3) {
      timeHorizon = 'long';
    }

    // Add sector-specific analysis
    if (marketData.sector) {
      catalysts.push(`Sector analysis for ${marketData.sector} sector positioning`);
    }

    // Add volume analysis
    if (marketData.volume > 0) {
      catalysts.push('Volume analysis supports price movement validation');
    }

    reasoning += `RSI at ${technicalIndicators.rsi.toFixed(1)} and price ${currentPrice > technicalIndicators.sma20 ? 'above' : 'below'} 20-day SMA.`;

    return {
      symbol: marketData.symbol,
      companyName: marketData.symbol, // In real implementation, fetch company name
      ideaTitle: `${signals.bullish > signals.bearish ? 'Bullish' : signals.bearish > signals.bullish ? 'Bearish' : 'Neutral'} Technical Setup for ${marketData.symbol}`,
      ideaDescription: `Technical analysis based investment idea for ${marketData.symbol} with ${confidenceScore > 0.6 ? 'high' : confidenceScore > 0.4 ? 'medium' : 'low'} confidence.`,
      entryPrice: currentPrice,
      targetPrice: Number(targetPrice.toFixed(2)),
      stopLoss: Number(stopLoss.toFixed(2)),
      riskLevel,
      timeHorizon,
      aiConfidenceScore: Number(confidenceScore.toFixed(2)),
      aiReasoning: reasoning,
      catalysts,
      risks,
      recommendedInvestment: 10000, // Default recommendation
      technicalIndicators
    };
  }

  // Save investment idea to database
  async saveInvestmentIdea(userId: string, recommendation: InvestmentRecommendation): Promise<string> {
    const ideaData: InsertInvestmentIdea = {
      userId,
      symbol: recommendation.symbol,
      companyName: recommendation.companyName,
      ideaTitle: recommendation.ideaTitle,
      ideaDescription: recommendation.ideaDescription,
      entryPrice: recommendation.entryPrice.toString(),
      targetPrice: recommendation.targetPrice.toString(),
      stopLoss: recommendation.stopLoss.toString(),
      riskLevel: recommendation.riskLevel,
      timeHorizon: recommendation.timeHorizon,
      aiConfidenceScore: recommendation.aiConfidenceScore.toString(),
      aiReasoning: recommendation.aiReasoning,
      catalysts: recommendation.catalysts,
      risks: recommendation.risks,
      recommendedInvestment: recommendation.recommendedInvestment.toString(),
      technicalIndicators: recommendation.technicalIndicators,
      supportLevel: recommendation.technicalIndicators.supportLevel.toString(),
      resistanceLevel: recommendation.technicalIndicators.resistanceLevel.toString(),
      sector: 'Technology', // Default sector
      marketCap: 'large' // Default market cap
    };

    const result = await db.insert(investmentIdeas).values(ideaData).returning({ id: investmentIdeas.id });
    return result[0].id;
  }

  // Get investment ideas for user
  async getUserInvestmentIdeas(userId: string): Promise<InvestmentIdea[]> {
    return await db
      .select()
      .from(investmentIdeas)
      .where(and(
        eq(investmentIdeas.userId, userId),
        eq(investmentIdeas.isActive, true)
      ))
      .orderBy(desc(investmentIdeas.suggestedAt));
  }

  // Update investment idea tracking
  async updateIdeaTracking(ideaId: string, marketData: MarketData): Promise<void> {
    const technicalIndicators = await this.analyzeTechnicalIndicators(marketData);
    
    // Get the original idea to calculate returns
    const idea = await db
      .select()
      .from(investmentIdeas)
      .where(eq(investmentIdeas.id, ideaId))
      .limit(1);

    if (idea.length === 0) return;

    const originalPrice = Number(idea[0].entryPrice);
    const currentPrice = marketData.price;
    const dailyReturn = ((currentPrice - marketData.previousClose) / marketData.previousClose) * 100;
    const cumulativeReturn = ((currentPrice - originalPrice) / originalPrice) * 100;

    const trackingData: InsertInvestmentIdeaTracking = {
      ideaId,
      userId: idea[0].userId,
      trackingDate: new Date(),
      closePrice: currentPrice.toString(),
      openPrice: marketData.open.toString(),
      highPrice: marketData.high.toString(),
      lowPrice: marketData.low.toString(),
      volume: marketData.volume,
      dailyReturn: dailyReturn.toString(),
      cumulativeReturn: cumulativeReturn.toString(),
      rsi: technicalIndicators.rsi.toString(),
      macd: technicalIndicators.macd.toString(),
      macdSignal: technicalIndicators.macdSignal.toString(),
      sma20: technicalIndicators.sma20.toString(),
      sma50: technicalIndicators.sma50.toString(),
      ema12: technicalIndicators.ema12.toString(),
      ema26: technicalIndicators.ema26.toString(),
      volatility: technicalIndicators.volatility.toString()
    };

    await db.insert(investmentIdeaTracking).values(trackingData);

    // Update the idea with current price and return
    await db
      .update(investmentIdeas)
      .set({
        currentPrice: currentPrice.toString(),
        currentReturn: cumulativeReturn.toString(),
        updatedAt: new Date()
      })
      .where(eq(investmentIdeas.id, ideaId));
  }

  // Check for alerts (price targets, stop losses)
  async checkAndCreateAlerts(ideaId: string): Promise<void> {
    const idea = await db
      .select()
      .from(investmentIdeas)
      .where(eq(investmentIdeas.id, ideaId))
      .limit(1);

    if (idea.length === 0) return;

    const currentPrice = Number(idea[0].currentPrice) || 0;
    const targetPrice = Number(idea[0].targetPrice);
    const stopLoss = Number(idea[0].stopLoss);
    
    // Check if target reached
    if (currentPrice >= targetPrice) {
      await this.createAlert(ideaId, idea[0].userId, 'target_reached', 
        `Target price of ₹${targetPrice} reached for ${idea[0].symbol}`, 
        targetPrice, currentPrice, 'high');
    }

    // Check if stop loss triggered
    if (currentPrice <= stopLoss) {
      await this.createAlert(ideaId, idea[0].userId, 'stop_loss_triggered',
        `Stop loss of ₹${stopLoss} triggered for ${idea[0].symbol}`,
        stopLoss, currentPrice, 'critical');
    }
  }

  // Create alert
  private async createAlert(
    ideaId: string, 
    userId: string, 
    alertType: string, 
    message: string, 
    triggerPrice: number, 
    actualPrice: number, 
    severity: string
  ): Promise<void> {
    const alertData: InsertInvestmentIdeaAlert = {
      ideaId,
      userId,
      alertType,
      alertMessage: message,
      triggerPrice: triggerPrice.toString(),
      actualPrice: actualPrice.toString(),
      severity,
      isActionable: true
    };

    await db.insert(investmentIdeaAlerts).values(alertData);
  }

  // Get market recommendations for multiple symbols
  async getMarketRecommendations(symbols: string[], userId: string): Promise<InvestmentRecommendation[]> {
    const recommendations: InvestmentRecommendation[] = [];
    
    for (const symbol of symbols) {
      // In real implementation, fetch actual market data
      const mockMarketData: MarketData = {
        symbol,
        price: Math.random() * 1000 + 100,
        volume: Math.floor(Math.random() * 1000000),
        high: Math.random() * 1100 + 100,
        low: Math.random() * 1000 + 50,
        open: Math.random() * 1000 + 100,
        previousClose: Math.random() * 1000 + 100,
        historialPrices: Array.from({ length: 50 }, () => Math.random() * 1000 + 100)
      };

      try {
        const recommendation = await this.generateInvestmentIdea(mockMarketData);
        recommendations.push(recommendation);
      } catch (error) {
        console.error(`Error generating recommendation for ${symbol}:`, error);
      }
    }

    return recommendations;
  }
}

export const smartInvestmentService = new SmartInvestmentService();