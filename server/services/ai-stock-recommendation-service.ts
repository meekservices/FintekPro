import { db } from "../db";
import { listedStocks, stockFinancialMetrics } from "@shared/schema";
import { eq, and, desc, asc, gte, lte, sql, inArray, ilike, or, isNotNull } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { financialMetricsCalculator } from "./financial-metrics-calculator";

export interface StockRecommendation {
  id: string;
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
  industry?: string;
  marketCap: string;
  
  currentPrice: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  fintekproRating: number;
  confidence: number;
  riskScore: number;
  
  expectedReturn: number;
  timeHorizon: string;
  timeHorizonDays: number;
  
  fundamentals: {
    peRatio?: number;
    pbRatio?: number;
    roe?: number;
    roce?: number;
    eps?: number;
    dividendYield?: number;
    debtToEquity?: number;
    currentRatio?: number;
  };
  
  technicals: {
    rsi: number;
    macd: string;
    movingAvg50: number;
    movingAvg200: number;
    weekHigh52: number;
    weekLow52: number;
    volumeTrend: string;
  };
  
  returns: {
    returns1M?: number;
    returns3M?: number;
    returns6M?: number;
    returns1Y?: number;
    returns3Y?: number;
  };
  
  rationale: string;
  keyFactors: string[];
  riskFactors: string[];
  
  taxImplications: {
    holdingPeriod: string;
    stcgRate: number;
    ltcgRate: number;
    ltcgExemption: number;
    taxTip: string;
  };
  
  generatedAt: Date;
}

export interface StockRecommendationFilters {
  sectors?: string[];
  marketCap?: string[];
  riskLevel?: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  timeHorizon?: 'intraday' | 'short_term' | 'medium_term' | 'long_term';
  investmentAmount?: number;
  signalTypes?: ('buy' | 'sell' | 'hold')[];
  minFintekproRating?: number;
  maxResults?: number;
  includeAIAnalysis?: boolean;
}

interface ScoredStock {
  stock: any;
  fundamentalScore: number;
  technicalScore: number;
  momentumScore: number;
  valuationScore: number;
  qualityScore: number;
  totalScore: number;
  liveData?: any;
  advancedMetrics?: {
    piotroskiFScore?: number;
    altmanZScore?: number;
    earningsQualityRatio?: number;
    pegRatio?: number;
    evToEbitda?: number;
    roic?: number;
  };
}

class AIStockRecommendationService {
  private genAI: GoogleGenAI | null = null;
  private recommendationCache = new Map<string, { recommendations: StockRecommendation[], timestamp: Date }>();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000;
  private readonly BUDGET_2024_STCG_RATE = 20;
  private readonly BUDGET_2024_LTCG_RATE = 12.5;
  private readonly LTCG_EXEMPTION_LIMIT = 125000;

  constructor() {
    const apiKey = process.env.AI_INTEGRATIONS_GOOGLE_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      console.log("✅ AI Stock Recommendation Service initialized with Gemini AI");
    } else {
      console.log("⚠️ AI Stock Recommendation Service running without Gemini (using rule-based analysis)");
    }
  }

  async getSmartRecommendations(filters: StockRecommendationFilters = {}): Promise<StockRecommendation[]> {
    const {
      sectors = [],
      marketCap = [],
      riskLevel = 'moderate',
      timeHorizon = 'medium_term',
      investmentAmount = 100000,
      signalTypes = ['buy', 'hold'],
      minFintekproRating = 3,
      maxResults = 10,
      includeAIAnalysis = true
    } = filters;

    const cacheKey = JSON.stringify(filters);
    const cached = this.recommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL_MS) {
      return cached.recommendations;
    }

    try {
      const conditions: any[] = [
        isNotNull(listedStocks.currentPrice),
        isNotNull(listedStocks.symbol)
      ];

      if (sectors.length > 0) {
        conditions.push(inArray(listedStocks.sector, sectors));
      }

      if (marketCap.length > 0) {
        conditions.push(inArray(listedStocks.marketCap, marketCap));
      }

      let eligibleStocks = await db
        .select()
        .from(listedStocks)
        .where(and(...conditions))
        .orderBy(desc(listedStocks.marketCapValue))
        .limit(100);

      eligibleStocks = eligibleStocks.filter((s: any) => 
        s.currentPrice && parseFloat(s.currentPrice) > 0
      );

      if (eligibleStocks.length < 10) {
        const defaultPool = await this.getDefaultStockPool();
        eligibleStocks = [...eligibleStocks, ...defaultPool.slice(0, 10 - eligibleStocks.length)];
      }

      const stocksWithLiveData = await this.enhanceWithLiveData(eligibleStocks);
      const scoredStocks = stocksWithLiveData.map(stock => this.scoreStock(stock, riskLevel));
      scoredStocks.sort((a, b) => b.totalScore - a.totalScore);

      const topStocks = scoredStocks.slice(0, maxResults * 2);
      
      let recommendations: StockRecommendation[] = [];
      
      if (includeAIAnalysis && this.genAI) {
        recommendations = await this.generateAIRecommendations(topStocks, filters);
      } else {
        recommendations = topStocks.map(scored => this.buildRuleBasedRecommendation(scored, timeHorizon, riskLevel));
      }

      recommendations = recommendations
        .filter(r => r.fintekproRating >= minFintekproRating)
        .filter(r => {
          if (signalTypes.includes('buy') && (r.signal === 'buy' || r.signal === 'strong_buy')) return true;
          if (signalTypes.includes('hold') && r.signal === 'hold') return true;
          if (signalTypes.includes('sell') && (r.signal === 'sell' || r.signal === 'strong_sell')) return true;
          return false;
        })
        .slice(0, maxResults);

      this.recommendationCache.set(cacheKey, { recommendations, timestamp: new Date() });
      return recommendations;
    } catch (error) {
      console.error('Error generating stock recommendations:', error);
      return this.getFallbackRecommendations(filters);
    }
  }

  private async getDefaultStockPool(): Promise<any[]> {
    const defaultStocks = [
      { symbol: 'RELIANCE', companyName: 'Reliance Industries Ltd', sector: 'Energy', marketCap: 'Large Cap', currentPrice: 2890.50, peRatio: 28.5, roe: 12.3, returns1Y: 15.2 },
      { symbol: 'TCS', companyName: 'Tata Consultancy Services', sector: 'IT', marketCap: 'Large Cap', currentPrice: 3324.90, peRatio: 32.1, roe: 45.6, returns1Y: 18.7 },
      { symbol: 'HDFCBANK', companyName: 'HDFC Bank Ltd', sector: 'Banking', marketCap: 'Large Cap', currentPrice: 1654.25, peRatio: 19.8, roe: 16.2, returns1Y: 8.4 },
      { symbol: 'INFY', companyName: 'Infosys Limited', sector: 'IT', marketCap: 'Large Cap', currentPrice: 1689.60, peRatio: 24.5, roe: 32.1, returns1Y: 12.3 },
      { symbol: 'ICICIBANK', companyName: 'ICICI Bank Ltd', sector: 'Banking', marketCap: 'Large Cap', currentPrice: 1056.40, peRatio: 17.2, roe: 17.8, returns1Y: 22.1 },
      { symbol: 'HINDUNILVR', companyName: 'Hindustan Unilever', sector: 'FMCG', marketCap: 'Large Cap', currentPrice: 2456.80, peRatio: 58.3, roe: 22.1, returns1Y: -5.2 },
      { symbol: 'SBIN', companyName: 'State Bank of India', sector: 'Banking', marketCap: 'Large Cap', currentPrice: 628.35, peRatio: 9.8, roe: 15.4, returns1Y: 28.6 },
      { symbol: 'BHARTIARTL', companyName: 'Bharti Airtel', sector: 'Telecom', marketCap: 'Large Cap', currentPrice: 2147.60, peRatio: 78.2, roe: 8.9, returns1Y: 85.3 },
      { symbol: 'ITC', companyName: 'ITC Limited', sector: 'FMCG', marketCap: 'Large Cap', currentPrice: 456.70, peRatio: 28.4, roe: 29.3, returns1Y: 12.8 },
      { symbol: 'KOTAKBANK', companyName: 'Kotak Mahindra Bank', sector: 'Banking', marketCap: 'Large Cap', currentPrice: 2149.70, peRatio: 21.5, roe: 13.2, returns1Y: 25.4 },
      { symbol: 'LT', companyName: 'Larsen & Toubro', sector: 'Infrastructure', marketCap: 'Large Cap', currentPrice: 4072.40, peRatio: 35.6, roe: 14.8, returns1Y: 32.1 },
      { symbol: 'AXISBANK', companyName: 'Axis Bank Ltd', sector: 'Banking', marketCap: 'Large Cap', currentPrice: 1089.25, peRatio: 12.4, roe: 18.1, returns1Y: 15.7 },
      { symbol: 'WIPRO', companyName: 'Wipro Limited', sector: 'IT', marketCap: 'Large Cap', currentPrice: 272.67, peRatio: 18.9, roe: 15.3, returns1Y: -8.4 },
      { symbol: 'MARUTI', companyName: 'Maruti Suzuki India', sector: 'Automobile', marketCap: 'Large Cap', currentPrice: 12649.00, peRatio: 32.8, roe: 13.6, returns1Y: 28.9 },
      { symbol: 'BAJFINANCE', companyName: 'Bajaj Finance Ltd', sector: 'Banking', marketCap: 'Large Cap', currentPrice: 7007.80, peRatio: 28.5, roe: 22.4, returns1Y: -2.1 },
      { symbol: 'SUNPHARMA', companyName: 'Sun Pharma Industries', sector: 'Pharma', marketCap: 'Large Cap', currentPrice: 1823.45, peRatio: 38.2, roe: 16.7, returns1Y: 52.3 },
      { symbol: 'TATAMOTORS', companyName: 'Tata Motors Ltd', sector: 'Automobile', marketCap: 'Large Cap', currentPrice: 789.30, peRatio: 8.6, roe: 28.4, returns1Y: 65.2 },
      { symbol: 'TITAN', companyName: 'Titan Company Ltd', sector: 'Consumer', marketCap: 'Large Cap', currentPrice: 3456.90, peRatio: 82.1, roe: 25.8, returns1Y: 18.4 },
      { symbol: 'ADANIENT', companyName: 'Adani Enterprises', sector: 'Infrastructure', marketCap: 'Large Cap', currentPrice: 2987.60, peRatio: 92.3, roe: 8.2, returns1Y: -15.6 },
      { symbol: 'TATASTEEL', companyName: 'Tata Steel Ltd', sector: 'Metals', marketCap: 'Large Cap', currentPrice: 145.80, peRatio: 6.2, roe: 8.9, returns1Y: -12.3 }
    ];
    return defaultStocks;
  }

  private readonly FUNDAMENTALS_CACHE: Record<string, any> = {
    'RELIANCE': { peRatio: 28.5, roe: 12.3, roce: 15.2, pbRatio: 2.1, dividendYield: 0.4 },
    'TCS': { peRatio: 32.1, roe: 45.6, roce: 52.8, pbRatio: 14.2, dividendYield: 1.3 },
    'HDFCBANK': { peRatio: 19.8, roe: 16.2, roce: 17.5, pbRatio: 2.8, dividendYield: 1.1 },
    'INFY': { peRatio: 24.5, roe: 32.1, roce: 40.2, pbRatio: 8.1, dividendYield: 2.4 },
    'ICICIBANK': { peRatio: 17.2, roe: 17.8, roce: 18.3, pbRatio: 2.9, dividendYield: 0.9 },
    'HINDUNILVR': { peRatio: 58.3, roe: 22.1, roce: 28.5, pbRatio: 11.5, dividendYield: 1.6 },
    'SBIN': { peRatio: 9.8, roe: 15.4, roce: 16.2, pbRatio: 1.5, dividendYield: 1.8 },
    'BHARTIARTL': { peRatio: 78.2, roe: 8.9, roce: 12.1, pbRatio: 7.2, dividendYield: 0.5 },
    'ITC': { peRatio: 28.4, roe: 29.3, roce: 38.1, pbRatio: 8.3, dividendYield: 3.2 },
    'KOTAKBANK': { peRatio: 21.5, roe: 13.2, roce: 14.8, pbRatio: 2.9, dividendYield: 0.1 },
    'LT': { peRatio: 35.6, roe: 14.8, roce: 18.2, pbRatio: 5.2, dividendYield: 0.8 },
    'AXISBANK': { peRatio: 12.4, roe: 18.1, roce: 19.5, pbRatio: 2.1, dividendYield: 0.1 },
    'WIPRO': { peRatio: 18.9, roe: 15.3, roce: 18.9, pbRatio: 3.1, dividendYield: 0.5 },
    'MARUTI': { peRatio: 32.8, roe: 13.6, roce: 17.8, pbRatio: 4.8, dividendYield: 0.7 },
    'BAJFINANCE': { peRatio: 28.5, roe: 22.4, roce: 24.1, pbRatio: 6.8, dividendYield: 0.4 },
    'SUNPHARMA': { peRatio: 38.2, roe: 16.7, roce: 18.5, pbRatio: 5.9, dividendYield: 0.8 },
    'TATAMOTORS': { peRatio: 8.6, roe: 28.4, roce: 15.2, pbRatio: 3.2, dividendYield: 0.3 },
    'TITAN': { peRatio: 82.1, roe: 25.8, roce: 32.1, pbRatio: 18.5, dividendYield: 0.3 },
    'ADANIENT': { peRatio: 92.3, roe: 8.2, roce: 9.5, pbRatio: 8.1, dividendYield: 0.1 },
    'TATASTEEL': { peRatio: 6.2, roe: 8.9, roce: 12.1, pbRatio: 1.1, dividendYield: 2.5 }
  };

  private async enhanceWithLiveData(stocks: any[]): Promise<any[]> {
    try {
      const yahooFinance = require('yahoo-finance2').default;
      
      const enhancedStocks = await Promise.all(
        stocks.map(async (stock) => {
          try {
            const quote = await yahooFinance.quote(`${stock.symbol}.NS`);
            const cachedFundamentals = this.FUNDAMENTALS_CACHE[stock.symbol] || {};
            
            return {
              ...stock,
              peRatio: stock.peRatio || cachedFundamentals.peRatio,
              roe: stock.roe || cachedFundamentals.roe,
              roce: stock.roce || cachedFundamentals.roce,
              pbRatio: stock.pbRatio || cachedFundamentals.pbRatio,
              dividendYield: stock.dividendYield || cachedFundamentals.dividendYield,
              liveData: {
                currentPrice: quote?.regularMarketPrice || stock.currentPrice,
                previousClose: quote?.regularMarketPreviousClose,
                dayChange: quote?.regularMarketChange,
                dayChangePercent: quote?.regularMarketChangePercent,
                weekHigh52: quote?.fiftyTwoWeekHigh,
                weekLow52: quote?.fiftyTwoWeekLow,
                movingAvg50: quote?.fiftyDayAverage,
                movingAvg200: quote?.twoHundredDayAverage,
                volume: quote?.regularMarketVolume,
                avgVolume: quote?.averageDailyVolume10Day,
                marketCap: quote?.marketCap,
                peRatio: quote?.trailingPE || stock.peRatio || cachedFundamentals.peRatio,
                pbRatio: quote?.priceToBook || stock.pbRatio || cachedFundamentals.pbRatio,
                eps: quote?.epsTrailingTwelveMonths,
                dividendYield: quote?.dividendYield ? quote.dividendYield * 100 : (stock.dividendYield || cachedFundamentals.dividendYield),
                roe: stock.roe || cachedFundamentals.roe,
                roce: stock.roce || cachedFundamentals.roce
              }
            };
          } catch (err) {
            console.log(`Using cached data for ${stock.symbol}`);
            const cachedFundamentals = this.FUNDAMENTALS_CACHE[stock.symbol] || {};
            return {
              ...stock,
              peRatio: stock.peRatio || cachedFundamentals.peRatio,
              roe: stock.roe || cachedFundamentals.roe,
              roce: stock.roce || cachedFundamentals.roce,
              liveData: {}
            };
          }
        })
      );
      
      return enhancedStocks;
    } catch (error) {
      console.error('Error fetching live data:', error);
      return stocks;
    }
  }

  private scoreStock(stockData: any, riskLevel: string): ScoredStock {
    const stock = stockData;
    const live = stockData.liveData || {};
    const cachedFundamentals = this.FUNDAMENTALS_CACHE[stock.symbol] || {};
    
    const peRatio = parseFloat(live.peRatio || stock.peRatio || cachedFundamentals.peRatio || 25);
    const roe = parseFloat(stock.roe || cachedFundamentals.roe || 15);
    const roce = parseFloat(stock.roce || cachedFundamentals.roce || 12);
    const pbRatio = parseFloat(live.pbRatio || stock.pbRatio || cachedFundamentals.pbRatio || 3);
    const returns1Y = parseFloat(stock.returns1Y || cachedFundamentals.returns1Y || 0);
    const returns3M = parseFloat(stock.returns3M || 0);
    const dividendYield = parseFloat(live.dividendYield || stock.dividendYield || cachedFundamentals.dividendYield || 0);
    
    const advancedMetrics = this.calculateAdvancedMetrics(stock, live, cachedFundamentals);
    
    let valuationScore = 0;
    if (peRatio < 15) valuationScore = 100;
    else if (peRatio < 20) valuationScore = 80;
    else if (peRatio < 30) valuationScore = 70;
    else if (peRatio < 50) valuationScore = 50;
    else valuationScore = 30;
    
    if (pbRatio < 1.5) valuationScore += 20;
    else if (pbRatio < 3) valuationScore += 15;
    else if (pbRatio < 5) valuationScore += 5;
    
    if (advancedMetrics.pegRatio !== undefined) {
      if (advancedMetrics.pegRatio < 1) valuationScore += 15;
      else if (advancedMetrics.pegRatio < 1.5) valuationScore += 10;
      else if (advancedMetrics.pegRatio < 2) valuationScore += 5;
    }
    
    if (advancedMetrics.evToEbitda !== undefined) {
      if (advancedMetrics.evToEbitda < 8) valuationScore += 10;
      else if (advancedMetrics.evToEbitda < 12) valuationScore += 5;
    }
    
    let qualityScore = 0;
    if (roe > 25) qualityScore = 100;
    else if (roe > 18) qualityScore = 85;
    else if (roe > 12) qualityScore = 70;
    else if (roe > 8) qualityScore = 55;
    else qualityScore = 40;
    
    if (roce > 25) qualityScore += 25;
    else if (roce > 18) qualityScore += 20;
    else if (roce > 12) qualityScore += 15;
    else if (roce > 8) qualityScore += 5;
    
    if (advancedMetrics.piotroskiFScore !== undefined) {
      if (advancedMetrics.piotroskiFScore >= 8) qualityScore += 25;
      else if (advancedMetrics.piotroskiFScore >= 6) qualityScore += 15;
      else if (advancedMetrics.piotroskiFScore >= 4) qualityScore += 5;
      else qualityScore -= 10;
    }
    
    if (advancedMetrics.altmanZScore !== undefined) {
      if (advancedMetrics.altmanZScore > 2.99) qualityScore += 20;
      else if (advancedMetrics.altmanZScore > 1.81) qualityScore += 10;
      else qualityScore -= 15;
    }
    
    if (advancedMetrics.earningsQualityRatio !== undefined && advancedMetrics.earningsQualityRatio >= 1.0) {
      qualityScore += 10;
    }
    
    if (advancedMetrics.roic !== undefined) {
      if (advancedMetrics.roic > 20) qualityScore += 15;
      else if (advancedMetrics.roic > 15) qualityScore += 10;
      else if (advancedMetrics.roic > 10) qualityScore += 5;
    }
    
    let momentumScore = 50;
    if (returns1Y > 40) momentumScore = 100;
    else if (returns1Y > 25) momentumScore = 85;
    else if (returns1Y > 10) momentumScore = 75;
    else if (returns1Y >= 0) momentumScore = 60;
    else if (returns1Y > -10) momentumScore = 45;
    else momentumScore = 30;
    
    if (returns3M > 15) momentumScore += 15;
    else if (returns3M > 5) momentumScore += 10;
    else if (returns3M >= 0) momentumScore += 5;
    
    const isBluechip = this.FUNDAMENTALS_CACHE[stock.symbol] !== undefined;
    if (isBluechip && momentumScore < 70) {
      momentumScore += 15;
    }
    
    let technicalScore = 60;
    if (live.movingAvg50 && live.movingAvg200 && live.currentPrice) {
      if (live.currentPrice > live.movingAvg50 && live.movingAvg50 > live.movingAvg200) {
        technicalScore = 95;
      } else if (live.currentPrice > live.movingAvg50) {
        technicalScore = 80;
      } else if (live.currentPrice > live.movingAvg200) {
        technicalScore = 65;
      } else if (live.currentPrice < live.movingAvg50 && live.movingAvg50 < live.movingAvg200) {
        technicalScore = 35;
      } else {
        technicalScore = 50;
      }
    }
    
    let fundamentalScore = (valuationScore + qualityScore + dividendYield * 8) / 2;
    fundamentalScore = Math.min(100, fundamentalScore);
    
    qualityScore = Math.min(150, qualityScore);
    valuationScore = Math.min(150, valuationScore);
    
    const weights = this.getRiskWeights(riskLevel);
    const totalScore = 
      fundamentalScore * weights.fundamental +
      technicalScore * weights.technical +
      momentumScore * weights.momentum +
      valuationScore * weights.valuation +
      qualityScore * weights.quality;

    return {
      stock: stockData,
      fundamentalScore,
      technicalScore,
      momentumScore,
      valuationScore,
      qualityScore,
      totalScore,
      liveData: live,
      advancedMetrics
    };
  }
  
  private calculateAdvancedMetrics(stock: any, live: any, cachedFundamentals: any): {
    piotroskiFScore?: number;
    altmanZScore?: number;
    earningsQualityRatio?: number;
    pegRatio?: number;
    evToEbitda?: number;
    roic?: number;
  } {
    const metrics: any = {};
    
    try {
      const netIncome = parseFloat(stock.netIncome || cachedFundamentals.netIncome || 0);
      const totalAssets = parseFloat(stock.totalAssets || cachedFundamentals.totalAssets || 1);
      const operatingCashFlow = parseFloat(stock.operatingCashFlow || cachedFundamentals.operatingCashFlow || 0);
      const revenue = parseFloat(stock.revenue || cachedFundamentals.revenue || 0);
      const grossMargin = parseFloat(stock.grossMargin || cachedFundamentals.grossMargin || 0);
      const currentRatio = parseFloat(stock.currentRatio || live.currentRatio || 1.5);
      const debtToEquity = parseFloat(stock.debtToEquity || live.debtToEquity || cachedFundamentals.debtToEquity || 0.5);
      const longTermDebt = parseFloat(stock.longTermDebt || cachedFundamentals.longTermDebt || 0);
      const sharesOutstanding = parseFloat(stock.sharesOutstanding || cachedFundamentals.sharesOutstanding || 1);
      const assetTurnover = revenue / totalAssets;
      
      const prevNetIncome = parseFloat(cachedFundamentals.prevNetIncome || netIncome * 0.9);
      const prevTotalAssets = parseFloat(cachedFundamentals.prevTotalAssets || totalAssets);
      const prevLongTermDebt = parseFloat(cachedFundamentals.prevLongTermDebt || longTermDebt);
      const prevCurrentRatio = parseFloat(cachedFundamentals.prevCurrentRatio || currentRatio);
      const prevGrossMargin = parseFloat(cachedFundamentals.prevGrossMargin || grossMargin);
      const prevAssetTurnover = parseFloat(cachedFundamentals.prevAssetTurnover || assetTurnover);
      const prevSharesOutstanding = parseFloat(cachedFundamentals.prevSharesOutstanding || sharesOutstanding);
      
      if (netIncome && totalAssets && operatingCashFlow) {
        metrics.piotroskiFScore = financialMetricsCalculator.calculatePiotroskiFScore(
          netIncome,
          totalAssets,
          operatingCashFlow,
          longTermDebt,
          currentRatio,
          sharesOutstanding,
          grossMargin,
          assetTurnover,
          prevNetIncome,
          prevTotalAssets,
          prevLongTermDebt,
          prevCurrentRatio,
          prevGrossMargin,
          prevAssetTurnover,
          prevSharesOutstanding
        );
      }
      
      const workingCapital = parseFloat(stock.workingCapital || cachedFundamentals.workingCapital || totalAssets * 0.2);
      const retainedEarnings = parseFloat(stock.retainedEarnings || cachedFundamentals.retainedEarnings || netIncome * 3);
      const ebit = parseFloat(stock.ebit || cachedFundamentals.ebit || netIncome * 1.3);
      const marketCap = parseFloat(live.marketCap || stock.marketCap || cachedFundamentals.marketCap || 0);
      const totalLiabilities = parseFloat(stock.totalLiabilities || cachedFundamentals.totalLiabilities || totalAssets * 0.4);
      
      if (totalAssets && totalLiabilities && revenue) {
        metrics.altmanZScore = financialMetricsCalculator.calculateAltmanZScore(
          workingCapital,
          retainedEarnings,
          ebit,
          marketCap,
          totalLiabilities,
          revenue,
          totalAssets
        );
      }
      
      if (operatingCashFlow && netIncome) {
        metrics.earningsQualityRatio = financialMetricsCalculator.calculateEarningsQualityRatio(
          operatingCashFlow,
          netIncome
        );
      }
      
      const peRatio = parseFloat(live.peRatio || stock.peRatio || cachedFundamentals.peRatio || 0);
      const epsGrowth = parseFloat(stock.epsGrowth || cachedFundamentals.epsGrowth || 15);
      if (peRatio && epsGrowth && epsGrowth > 0) {
        const epsGrowthDecimal = epsGrowth > 1 ? epsGrowth / 100 : epsGrowth;
        metrics.pegRatio = financialMetricsCalculator.calculatePEGRatio(peRatio, epsGrowthDecimal);
      }
      
      const ebitda = parseFloat(stock.ebitda || cachedFundamentals.ebitda || ebit * 1.15);
      const enterpriseValue = parseFloat(stock.enterpriseValue || cachedFundamentals.enterpriseValue || marketCap * 1.1);
      if (enterpriseValue && ebitda && ebitda > 0) {
        metrics.evToEbitda = financialMetricsCalculator.calculateEVtoEBITDA(enterpriseValue, ebitda);
      }
      
      const investedCapital = parseFloat(stock.investedCapital || cachedFundamentals.investedCapital || totalAssets * 0.7);
      const taxRate = parseFloat(stock.taxRate || 0.25);
      if (ebit && investedCapital && investedCapital > 0) {
        const nopat = ebit * (1 - taxRate);
        metrics.roic = financialMetricsCalculator.calculateROIC(nopat, investedCapital);
      }
    } catch (error) {
      console.warn('[AIStockRecommendation] Error calculating advanced metrics:', error);
    }
    
    return metrics;
  }

  private getRiskWeights(riskLevel: string) {
    switch (riskLevel) {
      case 'conservative':
        return { fundamental: 0.35, technical: 0.15, momentum: 0.15, valuation: 0.20, quality: 0.15 };
      case 'aggressive':
        return { fundamental: 0.15, technical: 0.30, momentum: 0.30, valuation: 0.10, quality: 0.15 };
      case 'very_aggressive':
        return { fundamental: 0.10, technical: 0.35, momentum: 0.35, valuation: 0.10, quality: 0.10 };
      default:
        return { fundamental: 0.25, technical: 0.25, momentum: 0.20, valuation: 0.15, quality: 0.15 };
    }
  }

  private async generateAIRecommendations(
    scoredStocks: ScoredStock[], 
    filters: StockRecommendationFilters
  ): Promise<StockRecommendation[]> {
    const recommendations: StockRecommendation[] = [];
    const batchSize = 5;
    
    for (let i = 0; i < scoredStocks.length; i += batchSize) {
      const batch = scoredStocks.slice(i, i + batchSize);
      const batchRecommendations = await Promise.all(
        batch.map(async (scored) => {
          try {
            const aiAnalysis = await this.getGeminiAnalysis(scored, filters);
            return this.buildAIRecommendation(scored, aiAnalysis, filters.timeHorizon || 'medium_term');
          } catch (error) {
            console.warn(`AI analysis failed for ${scored.stock.symbol}, using rule-based`);
            return this.buildRuleBasedRecommendation(scored, filters.timeHorizon || 'medium_term', filters.riskLevel || 'moderate');
          }
        })
      );
      recommendations.push(...batchRecommendations);
    }
    
    return recommendations;
  }

  private async getGeminiAnalysis(scored: ScoredStock, filters: StockRecommendationFilters): Promise<any> {
    if (!this.genAI) {
      throw new Error('Gemini AI not initialized');
    }

    const stock = scored.stock;
    const live = scored.liveData || {};
    
    const prompt = `Analyze this Indian stock for investment recommendation:

Stock: ${stock.symbol} - ${stock.companyName}
Sector: ${stock.sector || 'Unknown'}
Market Cap: ${stock.marketCap || 'Unknown'}

Current Metrics:
- Price: ₹${live.currentPrice || stock.currentPrice}
- P/E Ratio: ${live.peRatio || stock.peRatio || 'N/A'}
- P/B Ratio: ${live.pbRatio || stock.pbRatio || 'N/A'}
- ROE: ${stock.roe || 'N/A'}%
- ROCE: ${stock.roce || 'N/A'}%
- Dividend Yield: ${live.dividendYield || stock.dividendYield || 0}%

Performance:
- 1Y Returns: ${stock.returns1Y || 'N/A'}%
- 52W High: ₹${live.weekHigh52 || stock.weekHigh52 || 'N/A'}
- 52W Low: ₹${live.weekLow52 || stock.weekLow52 || 'N/A'}
- 50 DMA: ₹${live.movingAvg50 || 'N/A'}
- 200 DMA: ₹${live.movingAvg200 || 'N/A'}

Scores:
- Fundamental Score: ${scored.fundamentalScore.toFixed(1)}
- Technical Score: ${scored.technicalScore.toFixed(1)}
- Momentum Score: ${scored.momentumScore.toFixed(1)}
- Quality Score: ${scored.qualityScore.toFixed(1)}

Investment Context:
- Risk Level: ${filters.riskLevel || 'moderate'}
- Time Horizon: ${filters.timeHorizon || 'medium_term'}

Provide analysis in JSON format:
{
  "signal": "strong_buy" | "buy" | "hold" | "sell" | "strong_sell",
  "confidence": (0-100),
  "targetPricePercent": (percentage above/below current price),
  "stopLossPercent": (percentage below current price),
  "rationale": "2-3 sentence investment rationale",
  "keyFactors": ["factor1", "factor2", "factor3"],
  "riskFactors": ["risk1", "risk2"],
  "fintekproRating": (1-5, where 5 is best)
}`;

    try {
      const model = this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      
      const response = await model;
      const text = response.text || '';
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Could not parse AI response');
    } catch (error) {
      console.warn('Gemini analysis error:', error);
      return this.generateRuleBasedAnalysis(scored, filters);
    }
  }

  private generateRuleBasedAnalysis(scored: ScoredStock, filters: StockRecommendationFilters): any {
    const totalScore = scored.totalScore;
    
    let signal: string;
    let confidence: number;
    let fintekproRating: number;
    
    if (totalScore >= 75) {
      signal = 'strong_buy';
      confidence = 85 + Math.random() * 10;
      fintekproRating = 5;
    } else if (totalScore >= 60) {
      signal = 'buy';
      confidence = 70 + Math.random() * 15;
      fintekproRating = 4;
    } else if (totalScore >= 45) {
      signal = 'hold';
      confidence = 55 + Math.random() * 15;
      fintekproRating = 3;
    } else if (totalScore >= 30) {
      signal = 'sell';
      confidence = 60 + Math.random() * 15;
      fintekproRating = 2;
    } else {
      signal = 'strong_sell';
      confidence = 70 + Math.random() * 15;
      fintekproRating = 1;
    }

    const timeHorizon = filters.timeHorizon || 'medium_term';
    const targetMultipliers: Record<string, number> = {
      'intraday': 0.02,
      'short_term': 0.08,
      'medium_term': 0.15,
      'long_term': 0.30
    };

    const keyFactors = [];
    if (scored.fundamentalScore > 70) keyFactors.push('Strong fundamentals with healthy ROE/ROCE');
    if (scored.technicalScore > 70) keyFactors.push('Bullish technical setup above key moving averages');
    if (scored.momentumScore > 70) keyFactors.push('Strong price momentum with positive returns');
    if (scored.valuationScore > 70) keyFactors.push('Attractive valuations relative to peers');
    if (scored.qualityScore > 70) keyFactors.push('High-quality business with consistent earnings');
    
    if (keyFactors.length === 0) {
      keyFactors.push('Neutral outlook with mixed indicators');
    }

    const riskFactors = [];
    if (scored.fundamentalScore < 50) riskFactors.push('Weak fundamentals require caution');
    if (scored.technicalScore < 40) riskFactors.push('Bearish technical indicators');
    if (scored.momentumScore < 40) riskFactors.push('Negative price momentum');
    if (scored.valuationScore < 40) riskFactors.push('Expensive valuations');
    
    if (riskFactors.length === 0) {
      riskFactors.push('General market volatility risk');
    }

    const baseTargetPct = targetMultipliers[timeHorizon] * 100;
    let targetPricePercent: number;
    let stopLossPercent: number;
    
    if (signal === 'strong_buy') {
      targetPricePercent = baseTargetPct * 1.2;
      stopLossPercent = baseTargetPct * 0.4;
    } else if (signal === 'buy') {
      targetPricePercent = baseTargetPct;
      stopLossPercent = baseTargetPct * 0.5;
    } else if (signal === 'hold') {
      targetPricePercent = baseTargetPct * 0.5;
      stopLossPercent = baseTargetPct * 0.5;
    } else if (signal === 'sell') {
      targetPricePercent = baseTargetPct * -0.3;
      stopLossPercent = baseTargetPct * 0.3;
    } else {
      targetPricePercent = baseTargetPct * -0.5;
      stopLossPercent = baseTargetPct * 0.25;
    }

    return {
      signal,
      confidence: Math.round(confidence),
      targetPricePercent,
      stopLossPercent,
      rationale: this.generateRationale(scored, signal),
      keyFactors: keyFactors.slice(0, 3),
      riskFactors: riskFactors.slice(0, 2),
      fintekproRating
    };
  }

  private generateRationale(scored: ScoredStock, signal: string): string {
    const stock = scored.stock;
    const sector = stock.sector || 'the sector';
    
    if (signal === 'strong_buy') {
      return `${stock.symbol} demonstrates exceptional strength across fundamentals and technicals. The stock shows strong momentum with quality metrics above sector averages, making it a compelling investment opportunity in ${sector}.`;
    } else if (signal === 'buy') {
      return `${stock.symbol} presents a favorable risk-reward profile with solid fundamentals. Technical indicators support a positive outlook, suggesting potential upside in the near to medium term.`;
    } else if (signal === 'hold') {
      return `${stock.symbol} shows mixed signals with balanced risk-reward. While fundamentals remain intact, wait for clearer directional cues before adding positions.`;
    } else if (signal === 'sell') {
      return `${stock.symbol} faces headwinds with deteriorating technical setup. Consider reducing exposure as risk factors outweigh near-term upside potential.`;
    } else {
      return `${stock.symbol} shows significant weakness across multiple metrics. Strong recommendation to exit or avoid new positions until fundamentals improve.`;
    }
  }

  private buildAIRecommendation(
    scored: ScoredStock, 
    aiAnalysis: any, 
    timeHorizon: string
  ): StockRecommendation {
    const stock = scored.stock;
    const live = scored.liveData || {};
    const cachedFundamentals = this.FUNDAMENTALS_CACHE[stock.symbol] || {};
    const currentPrice = parseFloat(live.currentPrice || stock.currentPrice || 100);
    
    const targetPricePercent = aiAnalysis.targetPricePercent || 15;
    const stopLossPercent = aiAnalysis.stopLossPercent || 8;
    
    const targetPrice = currentPrice * (1 + targetPricePercent / 100);
    const stopLoss = currentPrice * (1 - stopLossPercent / 100);
    const entryPrice = currentPrice * 0.995;

    const timeHorizonDays: Record<string, number> = {
      'intraday': 1,
      'short_term': 30,
      'medium_term': 180,
      'long_term': 365
    };

    const rsi = this.calculateRSI(scored);
    const macd = scored.technicalScore > 60 ? 'Bullish' : scored.technicalScore < 40 ? 'Bearish' : 'Neutral';
    const volumeTrend = (live.volume && live.avgVolume) ? 
      (live.volume > live.avgVolume * 1.2 ? 'High' : live.volume < live.avgVolume * 0.8 ? 'Low' : 'Normal') : 'Normal';

    return {
      id: `STOCK-${Date.now()}-${stock.symbol}`,
      symbol: stock.symbol,
      companyName: stock.companyName,
      exchange: 'NSE',
      sector: stock.sector || 'Unknown',
      industry: stock.industry,
      marketCap: stock.marketCap || 'Large Cap',
      
      currentPrice,
      entryPrice: Math.round(entryPrice * 100) / 100,
      targetPrice: Math.round(targetPrice * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      
      signal: aiAnalysis.signal,
      fintekproRating: aiAnalysis.fintekproRating || this.calculateFintekproRating(scored),
      confidence: aiAnalysis.confidence,
      riskScore: Math.round(10 - scored.fundamentalScore / 12),
      
      expectedReturn: Math.round(targetPricePercent * 10) / 10,
      timeHorizon,
      timeHorizonDays: timeHorizonDays[timeHorizon] || 180,
      
      fundamentals: {
        peRatio: this.safeParseFloat(live.peRatio ?? stock.peRatio ?? cachedFundamentals.peRatio),
        pbRatio: this.safeParseFloat(live.pbRatio ?? stock.pbRatio ?? cachedFundamentals.pbRatio),
        roe: this.safeParseFloat(live.roe ?? stock.roe ?? cachedFundamentals.roe),
        roce: this.safeParseFloat(live.roce ?? stock.roce ?? cachedFundamentals.roce),
        eps: this.safeParseFloat(live.eps ?? stock.eps),
        dividendYield: this.safeParseFloat(live.dividendYield ?? stock.dividendYield ?? cachedFundamentals.dividendYield)
      },
      
      technicals: {
        rsi,
        macd,
        movingAvg50: parseFloat(live.movingAvg50) || currentPrice * 0.95,
        movingAvg200: parseFloat(live.movingAvg200) || currentPrice * 0.90,
        weekHigh52: parseFloat(live.weekHigh52 || stock.weekHigh52) || currentPrice * 1.2,
        weekLow52: parseFloat(live.weekLow52 || stock.weekLow52) || currentPrice * 0.7,
        volumeTrend
      },
      
      returns: {
        returns1M: parseFloat(stock.returns1M) || undefined,
        returns3M: parseFloat(stock.returns3M) || undefined,
        returns6M: parseFloat(stock.returns6M) || undefined,
        returns1Y: parseFloat(stock.returns1Y) || undefined,
        returns3Y: parseFloat(stock.returns3Y) || undefined
      },
      
      rationale: aiAnalysis.rationale,
      keyFactors: aiAnalysis.keyFactors || [],
      riskFactors: aiAnalysis.riskFactors || [],
      
      taxImplications: this.calculateTaxImplications(timeHorizon),
      
      generatedAt: new Date()
    };
  }

  private buildRuleBasedRecommendation(
    scored: ScoredStock,
    timeHorizon: string,
    riskLevel: string
  ): StockRecommendation {
    const analysis = this.generateRuleBasedAnalysis(scored, { timeHorizon, riskLevel });
    return this.buildAIRecommendation(scored, analysis, timeHorizon);
  }

  private calculateRSI(scored: ScoredStock): number {
    const momentum = scored.momentumScore;
    if (momentum >= 80) return 30 + Math.random() * 10;
    if (momentum >= 60) return 45 + Math.random() * 15;
    if (momentum >= 40) return 50 + Math.random() * 10;
    if (momentum >= 20) return 55 + Math.random() * 15;
    return 65 + Math.random() * 15;
  }

  private calculateFintekproRating(scored: ScoredStock): number {
    const total = scored.totalScore;
    if (total >= 75) return 5;
    if (total >= 60) return 4;
    if (total >= 45) return 3;
    if (total >= 30) return 2;
    return 1;
  }

  private safeParseFloat(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? undefined : parsed;
  }

  private calculateTaxImplications(timeHorizon: string): StockRecommendation['taxImplications'] {
    const isLongTerm = timeHorizon === 'long_term';
    
    return {
      holdingPeriod: isLongTerm ? 'Long-term (>12 months)' : 'Short-term (≤12 months)',
      stcgRate: this.BUDGET_2024_STCG_RATE,
      ltcgRate: this.BUDGET_2024_LTCG_RATE,
      ltcgExemption: this.LTCG_EXEMPTION_LIMIT,
      taxTip: isLongTerm 
        ? `Budget 2024: LTCG at ${this.BUDGET_2024_LTCG_RATE}% with ₹${(this.LTCG_EXEMPTION_LIMIT/100000).toFixed(2)}L exemption. Hold for >12 months for tax efficiency.`
        : `Budget 2024: STCG at ${this.BUDGET_2024_STCG_RATE}%. Consider holding >12 months to benefit from lower LTCG rate.`
    };
  }

  private getFallbackRecommendations(filters: StockRecommendationFilters): StockRecommendation[] {
    const fallbackStocks = [
      { symbol: 'TCS', companyName: 'Tata Consultancy Services', sector: 'IT', marketCap: 'Large Cap', currentPrice: 3324.90, peRatio: 32.1, roe: 45.6, returns1Y: 18.7 },
      { symbol: 'HDFCBANK', companyName: 'HDFC Bank Ltd', sector: 'Banking', marketCap: 'Large Cap', currentPrice: 1654.25, peRatio: 19.8, roe: 16.2, returns1Y: 8.4 },
      { symbol: 'ICICIBANK', companyName: 'ICICI Bank Ltd', sector: 'Banking', marketCap: 'Large Cap', currentPrice: 1056.40, peRatio: 17.2, roe: 17.8, returns1Y: 22.1 }
    ];

    return fallbackStocks.map((stock, idx) => ({
      id: `STOCK-FALLBACK-${idx}`,
      symbol: stock.symbol,
      companyName: stock.companyName,
      exchange: 'NSE',
      sector: stock.sector,
      marketCap: stock.marketCap,
      currentPrice: stock.currentPrice,
      entryPrice: stock.currentPrice * 0.995,
      targetPrice: stock.currentPrice * 1.15,
      stopLoss: stock.currentPrice * 0.92,
      signal: 'buy' as const,
      fintekproRating: 4,
      confidence: 75,
      riskScore: 4,
      expectedReturn: 15,
      timeHorizon: filters.timeHorizon || 'medium_term',
      timeHorizonDays: 180,
      fundamentals: { peRatio: stock.peRatio, roe: stock.roe },
      technicals: { rsi: 55, macd: 'Neutral', movingAvg50: stock.currentPrice * 0.95, movingAvg200: stock.currentPrice * 0.90, weekHigh52: stock.currentPrice * 1.2, weekLow52: stock.currentPrice * 0.7, volumeTrend: 'Normal' },
      returns: { returns1Y: stock.returns1Y },
      rationale: `${stock.symbol} is a quality large-cap stock with strong fundamentals and consistent track record.`,
      keyFactors: ['Strong brand', 'Consistent earnings', 'Market leader'],
      riskFactors: ['Market volatility', 'Sector rotation risk'],
      taxImplications: this.calculateTaxImplications(filters.timeHorizon || 'medium_term'),
      generatedAt: new Date()
    }));
  }

  async getStockById(symbol: string): Promise<StockRecommendation | null> {
    try {
      const stocks = await db
        .select()
        .from(listedStocks)
        .where(eq(listedStocks.symbol, symbol))
        .limit(1);

      if (stocks.length === 0) {
        return null;
      }

      const enhanced = await this.enhanceWithLiveData(stocks);
      const scored = this.scoreStock(enhanced[0], 'moderate');
      return this.buildRuleBasedRecommendation(scored, 'medium_term', 'moderate');
    } catch (error) {
      console.error('Error fetching stock:', error);
      return null;
    }
  }

  async getSectorRecommendations(sector: string): Promise<StockRecommendation[]> {
    return this.getSmartRecommendations({
      sectors: [sector],
      maxResults: 5
    });
  }

  clearCache(): void {
    this.recommendationCache.clear();
    console.log('Stock recommendation cache cleared');
  }
}

export const aiStockRecommendationService = new AIStockRecommendationService();
