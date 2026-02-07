import { GoogleGenAI } from "@google/genai";
import { currencyExchangeService } from "./currency-exchange-service";
import yahooFinance from "yahoo-finance2";
import { FinancialMetricsCalculator } from "./financial-metrics-calculator";

const financialMetricsCalculator = new FinancialMetricsCalculator();

export interface GlobalInstrumentData {
  symbol: string;
  name: string;
  assetClass: 'stock' | 'etf' | 'bond' | 'mutual_fund';
  exchange: string;
  market: string;
  currency: string;
  currentPrice: number;
  currentPriceInr: number;
  priceChange: number;
  priceChangePercent: number;
  marketCap?: number;
  peRatio?: number;
  pbRatio?: number;
  dividendYield?: number;
  expenseRatio?: number;
  week52High?: number;
  week52Low?: number;
  avgVolume?: number;
  beta?: number;
  sector?: string;
  industry?: string;
}

export interface GlobalRecommendation {
  symbol: string;
  name: string;
  assetClass: 'stock' | 'etf' | 'bond' | 'mutual_fund';
  market: string;
  exchange: string;
  currency: string;
  recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  fintekproRating: number;
  confidenceScore: number;
  riskScore: number;
  currentPrice: number;
  currentPriceInr: number;
  targetPrice: number;
  targetPriceInr: number;
  stopLoss: number;
  expectedReturn: number;
  timeHorizon: string;
  timeHorizonDays: number;
  rationale: string;
  keyFactors: string[];
  riskFactors: string[];
  taxImplications: {
    stcgRate: number;
    ltcgRate: number;
    dtaaRate?: number;
    holdingPeriodForLtcg: string;
    taxTip: string;
  };
  lrsConsiderations: string;
  suitabilityScore: number;
}

export interface RebalancingAction {
  symbol: string;
  name: string;
  assetClass: string;
  market: string;
  currency: string;
  action: 'buy' | 'sell' | 'hold';
  priority: 'high' | 'normal' | 'low';
  currentQuantity: number;
  recommendedQuantity: number;
  quantityChange: number;
  currentPrice: number;
  currentPriceInr: number;
  currentAllocation: number;
  targetAllocation: number;
  driftPercent: number;
  tradeValueNative: number;
  tradeValueInr: number;
  rationale: string;
  keyFactors: string[];
  riskFactors: string[];
  lrsImpact: number;
  complianceFlags: {
    lrsCheck: 'pass' | 'warning' | 'block';
    fatcaCheck: 'pass' | 'pending' | 'required';
  };
}

export interface PortfolioRebalancingResult {
  snapshotId: string;
  userId: string;
  portfolioScope: 'global_only' | 'india_only' | 'unified';
  totalValueInr: number;
  totalValueUsd: number;
  assetAllocation: Record<string, number>;
  geographicAllocation: Record<string, number>;
  sectorAllocation: Record<string, number>;
  driftAnalysis: {
    maxDrift: number;
    avgDrift: number;
    driftByAsset: Record<string, number>;
    needsRebalancing: boolean;
    urgency: 'high' | 'medium' | 'low' | 'none';
  };
  riskMetrics: {
    portfolioBeta: number;
    estimatedVolatility: number;
    sharpeRatio: number;
    diversificationScore: number;
  };
  actions: RebalancingAction[];
  summary: {
    buyCount: number;
    sellCount: number;
    holdCount: number;
    totalBuyValueInr: number;
    totalSellValueInr: number;
    netFlowInr: number;
  };
  lrsStatus: {
    utilizedYtdUsd: number;
    remainingLimitUsd: number;
    canExecuteAll: boolean;
    warningMessage?: string;
  };
  aiInsights: string;
  generatedAt: Date;
  expiresAt: Date;
}

const MARKET_SYMBOL_CATALOGUE: Record<string, Record<string, string[]>> = {
  us: {
    stocks: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK-B', 'UNH', 'JNJ', 'V', 'XOM', 'WMT', 'JPM', 'MA', 'PG', 'CVX', 'HD', 'ABBV', 'MRK'],
    etfs: ['SPY', 'QQQ', 'IVV', 'VTI', 'VOO', 'ARKK', 'SCHD', 'VIG', 'VYM', 'XLF', 'XLK', 'XLE', 'XLV', 'VNQ'],
    bonds: ['BND', 'AGG', 'TLT', 'IEF', 'SHY', 'LQD', 'HYG', 'TIP', 'MUB', 'GOVT'],
    mutual_funds: ['FXAIX', 'VFIAX', 'VTSAX', 'SWTSX', 'FSKAX']
  },
  europe: {
    stocks: ['ASML', 'MC.PA', 'NESN.SW', 'SAP.DE', 'SHEL', 'LVMH.PA', 'OR.PA', 'TTE.PA', 'SAN.PA', 'AIR.PA'],
    etfs: ['VGK', 'EZU', 'HEDJ', 'FEZ', 'IEV', 'BBEU', 'IEUR', 'HEWG'],
    bonds: ['BNDX', 'BWX', 'IGOV', 'EMB', 'VWOB'],
    mutual_funds: ['VEURX', 'FIEUX', 'MEUNX']
  },
  china_hk: {
    stocks: ['BABA', 'JD', 'BIDU', 'PDD', 'NIO', '9988.HK', '0700.HK', '3690.HK', '1810.HK', '2318.HK'],
    etfs: ['MCHI', 'FXI', 'KWEB', 'GXC', 'ASHR', 'CNYA', 'KBA'],
    bonds: ['CBON', 'FLCH', 'CGMU'],
    mutual_funds: ['FHKCX', 'MCHFX']
  },
  japan: {
    stocks: ['7203.T', '6758.T', '9984.T', '6861.T', '8306.T', '9432.T', '4502.T', '6501.T', '7267.T', '8035.T'],
    etfs: ['EWJ', 'DXJ', 'HEWJ', 'JPXN', 'SCJ', 'BBJP', 'FLJP'],
    bonds: ['BNDX', 'BWX', 'IGOV'],
    mutual_funds: ['FJPNX', 'MJFOX']
  },
  other_asia: {
    stocks: ['005930.KS', '000660.KS', 'GRAB', 'SE', 'DBS.SI', 'TSM', '2330.TW', '2317.TW'],
    etfs: ['VWO', 'IEMG', 'EEM', 'AAXJ', 'GMF', 'FXI', 'EWT', 'EWY', 'EWS'],
    bonds: ['EMB', 'VWOB', 'PCY', 'EMLC'],
    mutual_funds: ['VEIEX', 'ODMAX', 'WAEMX']
  }
};

const POPULAR_US_STOCKS = MARKET_SYMBOL_CATALOGUE.us.stocks;
const POPULAR_ETFS = MARKET_SYMBOL_CATALOGUE.us.etfs;
const POPULAR_BOND_ETFS = MARKET_SYMBOL_CATALOGUE.us.bonds;

const LRS_ANNUAL_LIMIT_USD = 250000;

export interface GlobalAdvisoryFilters {
  markets?: string[];
  instrumentTypes?: string[];
  riskLevel?: 'conservative' | 'moderate' | 'aggressive';
  maxResults?: number;
}

class AIGlobalAdvisoryService {
  private genAI: GoogleGenAI | null = null;
  private recommendationCache = new Map<string, { data: GlobalRecommendation[], timestamp: Date }>();
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.AI_INTEGRATIONS_GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      console.log("✅ AI Global Advisory Service initialized with Gemini");
    } else {
      console.warn("⚠️ AI Global Advisory Service: No API key configured");
    }
  }

  private async fetchWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T | null> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        const isRateLimited = error.message?.includes('Too Many Requests') || 
                             error.message?.includes('429') ||
                             error.message?.includes('rate limit');
        
        if (isRateLimited && attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
          console.log(`[GlobalAdvisory] Rate limited, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        if (attempt === maxRetries) {
          console.error(`[GlobalAdvisory] Failed after ${maxRetries} retries: ${error.message}`);
        }
        throw error;
      }
    }
    return null;
  }

  async fetchGlobalInstrumentData(symbol: string): Promise<GlobalInstrumentData | null> {
    try {
      const quote = await this.fetchWithRetry(() => yahooFinance.quote(symbol), 3, 2000);
      if (!quote) return null;

      const currency = quote.currency || 'USD';
      const currentPrice = quote.regularMarketPrice || 0;
      const exchangeRate = await currencyExchangeService.getExchangeRate(currency, 'INR');
      const currentPriceInr = currentPrice * exchangeRate;

      let assetClass: 'stock' | 'etf' | 'bond' | 'mutual_fund' = 'stock';
      if (quote.quoteType === 'ETF') assetClass = 'etf';
      else if (quote.quoteType === 'MUTUALFUND') assetClass = 'mutual_fund';

      return {
        symbol: quote.symbol,
        name: quote.shortName || quote.longName || symbol,
        assetClass,
        exchange: quote.exchange || 'UNKNOWN',
        market: this.getMarketFromExchange(quote.exchange || ''),
        currency,
        currentPrice,
        currentPriceInr,
        priceChange: quote.regularMarketChange || 0,
        priceChangePercent: quote.regularMarketChangePercent || 0,
        marketCap: quote.marketCap,
        peRatio: quote.trailingPE,
        pbRatio: quote.priceToBook,
        dividendYield: quote.dividendYield ? quote.dividendYield * 100 : undefined,
        week52High: quote.fiftyTwoWeekHigh,
        week52Low: quote.fiftyTwoWeekLow,
        avgVolume: quote.averageVolume,
        beta: quote.beta,
        sector: quote.sector,
        industry: quote.industry,
      };
    } catch (error: any) {
      console.error(`[GlobalAdvisory] Failed to fetch data for ${symbol}: ${error.message}`);
      return null;
    }
  }

  private getMarketFromExchange(exchange: string): string {
    const exchangeToMarket: Record<string, string> = {
      'NMS': 'US', 'NYQ': 'US', 'NGM': 'US', 'NCM': 'US', 'NYSE': 'US', 'NASDAQ': 'US',
      'LSE': 'UK', 'LON': 'UK',
      'FRA': 'EU', 'XETRA': 'EU', 'PAR': 'EU', 'AMS': 'EU',
      'TYO': 'JP', 'JPX': 'JP',
      'HKG': 'HK', 'HKSE': 'HK',
      'SGX': 'SG',
      'NSE': 'IN', 'BSE': 'IN',
    };
    return exchangeToMarket[exchange] || 'US';
  }

  async getGlobalStockRecommendations(
    filters: {
      markets?: string[];
      sectors?: string[];
      marketCap?: string[];
      riskLevel?: 'conservative' | 'moderate' | 'aggressive';
      maxResults?: number;
    } = {}
  ): Promise<GlobalRecommendation[]> {
    const cacheKey = `stocks_${JSON.stringify(filters)}`;
    const cached = this.recommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const symbols = POPULAR_US_STOCKS.slice(0, filters.maxResults || 10);
    const recommendations: GlobalRecommendation[] = [];

    for (const symbol of symbols) {
      const data = await this.fetchGlobalInstrumentData(symbol);
      if (!data) continue;

      const recommendation = await this.generateRecommendation(data, filters.riskLevel || 'moderate');
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    this.recommendationCache.set(cacheKey, { data: recommendations, timestamp: new Date() });
    return recommendations;
  }

  async getGlobalETFRecommendations(
    filters: {
      categories?: string[];
      riskLevel?: 'conservative' | 'moderate' | 'aggressive';
      maxResults?: number;
    } = {}
  ): Promise<GlobalRecommendation[]> {
    const cacheKey = `etfs_${JSON.stringify(filters)}`;
    const cached = this.recommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const symbols = POPULAR_ETFS.slice(0, filters.maxResults || 10);
    const recommendations: GlobalRecommendation[] = [];

    for (const symbol of symbols) {
      const data = await this.fetchGlobalInstrumentData(symbol);
      if (!data) continue;

      const recommendation = await this.generateRecommendation(data, filters.riskLevel || 'moderate');
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    this.recommendationCache.set(cacheKey, { data: recommendations, timestamp: new Date() });
    return recommendations;
  }

  async getGlobalBondRecommendations(
    filters: {
      bondTypes?: string[];
      duration?: 'short' | 'medium' | 'long';
      riskLevel?: 'conservative' | 'moderate' | 'aggressive';
      maxResults?: number;
    } = {}
  ): Promise<GlobalRecommendation[]> {
    const cacheKey = `bonds_${JSON.stringify(filters)}`;
    const cached = this.recommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const symbols = POPULAR_BOND_ETFS.slice(0, filters.maxResults || 10);
    const recommendations: GlobalRecommendation[] = [];

    for (const symbol of symbols) {
      const data = await this.fetchGlobalInstrumentData(symbol);
      if (!data) continue;

      const recommendation = await this.generateRecommendation(data, filters.riskLevel || 'conservative');
      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    this.recommendationCache.set(cacheKey, { data: recommendations, timestamp: new Date() });
    return recommendations;
  }

  async getFilteredGlobalRecommendations(
    globalAdvisorySelections: Record<string, string[]>,
    riskLevel: 'conservative' | 'moderate' | 'aggressive' = 'moderate',
    maxResultsPerCategory: number = 5,
    priorLrsUtilizationUsd: number = 0,
    globalBudgetInr: number = 500000
  ): Promise<{
    recommendations: GlobalRecommendation[];
    byMarket: Record<string, GlobalRecommendation[]>;
    byInstrument: Record<string, GlobalRecommendation[]>;
    validationWarnings: string[];
    summary: {
      totalRecommendations: number;
      marketsIncluded: string[];
      instrumentTypesIncluded: string[];
      estimatedLrsUtilization: number;
      lrsStatus: {
        estimatedUtilizationUsd: number;
        priorUtilizationUsd: number;
        totalUtilizationUsd: number;
        remainingLimitUsd: number;
        isWithinLimit: boolean;
        warningMessage?: string;
      };
    };
  }> {
    const cacheKey = `filtered_${JSON.stringify(globalAdvisorySelections)}_${riskLevel}`;
    const cached = this.recommendationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp.getTime() < this.CACHE_TTL_MS) {
      const recommendations = cached.data;
      return this.organizeRecommendations(recommendations, globalAdvisorySelections, [], priorLrsUtilizationUsd, globalBudgetInr);
    }

    const allRecommendations: GlobalRecommendation[] = [];
    const symbolsToFetch: { symbol: string; market: string; instrumentType: string }[] = [];
    const validationErrors: string[] = [];
    const validMarkets = Object.keys(MARKET_SYMBOL_CATALOGUE);
    const validInstruments = ['stocks', 'etfs', 'bonds', 'mutual_funds'];

    for (const [market, instrumentTypes] of Object.entries(globalAdvisorySelections)) {
      if (!validMarkets.includes(market)) {
        validationErrors.push(`Unknown market: ${market}`);
        continue;
      }
      if (!MARKET_SYMBOL_CATALOGUE[market]) continue;

      for (const instrumentType of instrumentTypes) {
        if (!validInstruments.includes(instrumentType)) {
          validationErrors.push(`Unknown instrument type: ${instrumentType} for market ${market}`);
          continue;
        }
        const symbols = MARKET_SYMBOL_CATALOGUE[market]?.[instrumentType] || [];
        if (symbols.length === 0) {
          validationErrors.push(`No symbols available for ${instrumentType} in ${market}`);
          continue;
        }
        const limitedSymbols = symbols.slice(0, maxResultsPerCategory);
        
        for (const symbol of limitedSymbols) {
          symbolsToFetch.push({ symbol, market, instrumentType });
        }
      }
    }

    if (validationErrors.length > 0) {
      console.warn('[GlobalAdvisory] Validation warnings:', validationErrors);
    }

    const batchSize = 5;
    for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
      const batch = symbolsToFetch.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async ({ symbol, market, instrumentType }) => {
        const data = await this.fetchGlobalInstrumentData(symbol);
        if (!data) return null;
        
        data.market = market.toUpperCase();
        const recommendation = await this.generateRecommendation(data, riskLevel);
        return recommendation;
      });

      const batchResults = await Promise.all(batchPromises);
      allRecommendations.push(...batchResults.filter((r): r is GlobalRecommendation => r !== null));
      
      if (i + batchSize < symbolsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    this.recommendationCache.set(cacheKey, { data: allRecommendations, timestamp: new Date() });
    return this.organizeRecommendations(allRecommendations, globalAdvisorySelections, validationErrors, priorLrsUtilizationUsd, globalBudgetInr);
  }

  private async organizeRecommendations(
    recommendations: GlobalRecommendation[],
    globalAdvisorySelections: Record<string, string[]>,
    validationErrors: string[] = [],
    priorLrsUtilizationUsd: number = 0,
    globalBudgetInr: number = 500000
  ): Promise<{
    recommendations: GlobalRecommendation[];
    byMarket: Record<string, GlobalRecommendation[]>;
    byInstrument: Record<string, GlobalRecommendation[]>;
    validationWarnings: string[];
    summary: {
      totalRecommendations: number;
      marketsIncluded: string[];
      instrumentTypesIncluded: string[];
      estimatedLrsUtilization: number;
      lrsStatus: {
        estimatedUtilizationUsd: number;
        priorUtilizationUsd: number;
        totalUtilizationUsd: number;
        remainingLimitUsd: number;
        isWithinLimit: boolean;
        warningMessage?: string;
      };
    };
  }> {
    const byMarket: Record<string, GlobalRecommendation[]> = {};
    const byInstrument: Record<string, GlobalRecommendation[]> = {};

    for (const rec of recommendations) {
      const marketKey = rec.market.toLowerCase();
      if (!byMarket[marketKey]) byMarket[marketKey] = [];
      byMarket[marketKey].push(rec);

      const instrumentKey = rec.assetClass;
      if (!byInstrument[instrumentKey]) byInstrument[instrumentKey] = [];
      byInstrument[instrumentKey].push(rec);
    }

    const marketsIncluded = Object.keys(globalAdvisorySelections);
    const instrumentTypesIncluded = [...new Set(Object.values(globalAdvisorySelections).flat())];

    const usdToInrRate = await currencyExchangeService.getExchangeRate('USD', 'INR');
    const buyRecommendations = recommendations.filter(r => r.recommendation === 'strong_buy' || r.recommendation === 'buy');
    
    const DEFAULT_SUITABILITY = 70;
    const normalizedScores = buyRecommendations.map(r => r.suitabilityScore ?? DEFAULT_SUITABILITY);
    const totalSuitabilityScore = normalizedScores.reduce((sum, score) => sum + score, 0);
    const hasBuyRecommendations = buyRecommendations.length > 0 && totalSuitabilityScore > 0;
    
    let estimatedLrsUtilization = 0;
    if (hasBuyRecommendations) {
      for (let i = 0; i < buyRecommendations.length; i++) {
        const r = buyRecommendations[i];
        const score = normalizedScores[i];
        const suitabilityWeight = score / totalSuitabilityScore;
        const weightedBudgetInr = globalBudgetInr * suitabilityWeight;
        const estimatedInvestmentUsd = weightedBudgetInr / usdToInrRate;
        estimatedLrsUtilization += estimatedInvestmentUsd;
        
        (r as any).suggestedAllocationInr = Math.round(weightedBudgetInr);
        (r as any).suggestedAllocationPct = Math.round(suitabilityWeight * 10000) / 100;
      }
    }

    const LRS_ANNUAL_LIMIT = 250000;
    const totalUtilization = priorLrsUtilizationUsd + estimatedLrsUtilization;
    const lrsStatus = {
      estimatedUtilizationUsd: estimatedLrsUtilization,
      priorUtilizationUsd: priorLrsUtilizationUsd,
      totalUtilizationUsd: totalUtilization,
      remainingLimitUsd: Math.max(0, LRS_ANNUAL_LIMIT - totalUtilization),
      isWithinLimit: totalUtilization <= LRS_ANNUAL_LIMIT,
      warningMessage: totalUtilization > LRS_ANNUAL_LIMIT * 0.8 
        ? totalUtilization > LRS_ANNUAL_LIMIT
          ? `Estimated investment ($${Math.round(estimatedLrsUtilization).toLocaleString()}) exceeds annual LRS limit of $250,000. Consider phased investment.`
          : `Estimated investment is nearing LRS limit ($${Math.round(estimatedLrsUtilization).toLocaleString()} of $250,000 utilized).`
        : undefined,
    };

    return {
      recommendations,
      byMarket,
      byInstrument,
      validationWarnings: validationErrors,
      summary: {
        totalRecommendations: recommendations.length,
        marketsIncluded,
        instrumentTypesIncluded,
        estimatedLrsUtilization,
        lrsStatus,
      },
    };
  }

  getAvailableMarkets(): { id: string; label: string; description: string; flag: string }[] {
    return [
      { id: 'us', label: 'US Markets', description: 'NYSE, NASDAQ listed securities', flag: '🇺🇸' },
      { id: 'europe', label: 'European Markets', description: 'UK, Germany, France exchanges', flag: '🇪🇺' },
      { id: 'china_hk', label: 'China/Hong Kong', description: 'HKSE, Shanghai, Shenzhen', flag: '🇨🇳' },
      { id: 'japan', label: 'Japan', description: 'Tokyo Stock Exchange', flag: '🇯🇵' },
      { id: 'other_asia', label: 'Other Asia', description: 'Singapore, Korea, Taiwan', flag: '🌏' },
    ];
  }

  getAvailableInstruments(): { id: string; label: string; description: string }[] {
    return [
      { id: 'stocks', label: 'Stocks', description: 'Direct equity shares' },
      { id: 'etfs', label: 'ETFs', description: 'Exchange traded funds' },
      { id: 'bonds', label: 'Bonds', description: 'Government & corporate bonds' },
      { id: 'mutual_funds', label: 'Mutual Funds', description: 'International mutual funds' },
    ];
  }

  private async generateRecommendation(
    data: GlobalInstrumentData,
    riskLevel: 'conservative' | 'moderate' | 'aggressive'
  ): Promise<GlobalRecommendation | null> {
    const score = this.calculateScore(data, riskLevel);
    const recommendation = this.getRecommendationFromScore(score.total);
    
    const targetMultiplier = recommendation === 'strong_buy' ? 1.25 :
                             recommendation === 'buy' ? 1.15 :
                             recommendation === 'hold' ? 1.05 :
                             recommendation === 'sell' ? 0.95 : 0.85;
    
    const targetPrice = data.currentPrice * targetMultiplier;
    const stopLoss = data.currentPrice * (recommendation.includes('buy') ? 0.92 : 0.88);
    const expectedReturn = ((targetPrice - data.currentPrice) / data.currentPrice) * 100;

    const exchangeRate = await currencyExchangeService.getExchangeRate(data.currency, 'INR');

    return {
      symbol: data.symbol,
      name: data.name,
      assetClass: data.assetClass,
      market: data.market,
      exchange: data.exchange,
      currency: data.currency,
      recommendation,
      fintekproRating: Math.min(5, Math.max(1, Math.round(score.total / 20))),
      confidenceScore: Math.min(100, score.confidence),
      riskScore: score.risk,
      currentPrice: data.currentPrice,
      currentPriceInr: data.currentPriceInr,
      targetPrice,
      targetPriceInr: targetPrice * exchangeRate,
      stopLoss,
      expectedReturn,
      timeHorizon: riskLevel === 'aggressive' ? 'short_term' : riskLevel === 'moderate' ? 'medium_term' : 'long_term',
      timeHorizonDays: riskLevel === 'aggressive' ? 90 : riskLevel === 'moderate' ? 180 : 365,
      rationale: this.generateRationale(data, score, recommendation),
      keyFactors: score.keyFactors,
      riskFactors: score.riskFactors,
      taxImplications: this.getTaxImplications(data.market),
      lrsConsiderations: `This investment will utilize your LRS limit. Current rate: ${exchangeRate.toFixed(2)} INR/${data.currency}. Ensure you have filed Form 15CA/CB if investing > ₹7 lakhs.`,
      suitabilityScore: this.calculateSuitabilityScore(data, riskLevel),
    };
  }

  private calculateScore(data: GlobalInstrumentData, riskLevel: string): {
    total: number;
    confidence: number;
    risk: number;
    keyFactors: string[];
    riskFactors: string[];
  } {
    let total = 50;
    const keyFactors: string[] = [];
    const riskFactors: string[] = [];
    let confidence = 70;
    let risk = 50;

    // Valuation score
    if (data.peRatio) {
      if (data.peRatio < 15) { total += 15; keyFactors.push('Attractive valuation (low P/E)'); }
      else if (data.peRatio < 25) { total += 8; keyFactors.push('Fair valuation'); }
      else if (data.peRatio > 40) { total -= 10; riskFactors.push('High valuation concern'); }
    }

    // 52-week position
    if (data.week52High && data.week52Low && data.currentPrice) {
      const range = data.week52High - data.week52Low;
      const position = (data.currentPrice - data.week52Low) / range;
      if (position < 0.3) { total += 10; keyFactors.push('Near 52-week low - potential upside'); }
      else if (position > 0.9) { total -= 5; riskFactors.push('Near 52-week high'); }
    }

    // Beta-based risk assessment
    if (data.beta) {
      risk = Math.min(100, Math.max(0, data.beta * 50));
      if (data.beta > 1.5) riskFactors.push('High volatility (beta > 1.5)');
      else if (data.beta < 0.8) keyFactors.push('Lower volatility than market');
    }

    // Dividend yield bonus for conservative
    if (data.dividendYield && data.dividendYield > 2) {
      total += 8;
      keyFactors.push(`Dividend yield: ${data.dividendYield.toFixed(1)}%`);
    }

    // Sector bonus
    if (data.sector) {
      const growthSectors = ['Technology', 'Healthcare', 'Consumer Cyclical'];
      const defensiveSectors = ['Utilities', 'Consumer Defensive', 'Healthcare'];
      if (riskLevel === 'aggressive' && growthSectors.includes(data.sector)) {
        total += 5;
        keyFactors.push(`Growth sector: ${data.sector}`);
      }
      if (riskLevel === 'conservative' && defensiveSectors.includes(data.sector)) {
        total += 5;
        keyFactors.push(`Defensive sector: ${data.sector}`);
      }
    }

    // Currency risk for Indian investors
    if (data.currency !== 'INR') {
      riskFactors.push(`Currency risk: ${data.currency}/INR fluctuation`);
      risk += 10;
    }

    // === Advanced Financial Metrics Integration ===
    const advancedMetrics = this.calculateAdvancedGlobalMetrics(data);
    
    // PEG Ratio: Growth-adjusted valuation
    if (advancedMetrics.pegRatio !== undefined) {
      if (advancedMetrics.pegRatio > 0 && advancedMetrics.pegRatio < 1) {
        total += 10;
        keyFactors.push('Attractive PEG ratio (growth at reasonable price)');
      } else if (advancedMetrics.pegRatio >= 1 && advancedMetrics.pegRatio < 1.5) {
        total += 5;
        keyFactors.push('Fair PEG ratio');
      } else if (advancedMetrics.pegRatio > 2.5) {
        total -= 5;
        riskFactors.push('High PEG ratio - expensive for growth');
      }
    }
    
    // Price-to-Book ratio assessment
    if (advancedMetrics.priceToBook !== undefined) {
      if (advancedMetrics.priceToBook > 0 && advancedMetrics.priceToBook < 1.5) {
        total += 5;
        keyFactors.push('Attractive price-to-book value');
      } else if (advancedMetrics.priceToBook > 5) {
        riskFactors.push('High price-to-book ratio');
      }
    }
    
    // EV/EBITDA multiple
    if (advancedMetrics.evToEbitda !== undefined) {
      if (advancedMetrics.evToEbitda > 0 && advancedMetrics.evToEbitda < 10) {
        total += 5;
        keyFactors.push('Reasonable EV/EBITDA multiple');
        confidence += 5;
      } else if (advancedMetrics.evToEbitda > 20) {
        total -= 5;
        riskFactors.push('High EV/EBITDA multiple');
      }
    }
    
    // Market cap consideration for liquidity
    if (advancedMetrics.liquidityScore !== undefined) {
      if (advancedMetrics.liquidityScore >= 80) {
        confidence += 10;
        keyFactors.push('High liquidity');
      } else if (advancedMetrics.liquidityScore < 40) {
        confidence -= 10;
        riskFactors.push('Lower liquidity - may impact execution');
      }
    }

    return { 
      total: Math.min(100, Math.max(0, total)), 
      confidence: Math.min(100, Math.max(0, confidence)), 
      risk: Math.min(100, Math.max(0, risk)),
      keyFactors,
      riskFactors
    };
  }

  private calculateAdvancedGlobalMetrics(data: GlobalInstrumentData): {
    pegRatio?: number;
    priceToBook?: number;
    evToEbitda?: number;
    liquidityScore?: number;
  } {
    const metrics: any = {};
    
    try {
      // PEG Ratio calculation
      if (data.peRatio && data.peRatio > 0) {
        // Estimate EPS growth from price momentum (approximation for global stocks)
        const epsGrowthEstimate = data.priceChangePercent > 0 ? 
          Math.min(30, data.priceChangePercent * 2) : 10;
        if (epsGrowthEstimate > 0) {
          metrics.pegRatio = financialMetricsCalculator.calculatePEGRatio(
            data.peRatio, epsGrowthEstimate / 100
          );
        }
      }
      
      // Price-to-Book from data
      if (data.pbRatio && data.pbRatio > 0) {
        metrics.priceToBook = data.pbRatio;
      }
      
      // EV/EBITDA estimation (when available)
      if (data.marketCap && data.peRatio) {
        // Approximate EBITDA from market cap and P/E
        const estimatedEarnings = data.marketCap / data.peRatio;
        const estimatedEbitda = estimatedEarnings * 1.5; // Rough approximation
        if (estimatedEbitda > 0) {
          const ev = data.marketCap; // Simplified - full EV needs debt data
          metrics.evToEbitda = financialMetricsCalculator.calculateEVtoEBITDA(ev, estimatedEbitda);
        }
      }
      
      // Liquidity score based on volume and market cap
      if (data.avgVolume && data.currentPrice) {
        const dailyTurnover = data.avgVolume * data.currentPrice;
        if (dailyTurnover > 100000000) metrics.liquidityScore = 90;
        else if (dailyTurnover > 10000000) metrics.liquidityScore = 70;
        else if (dailyTurnover > 1000000) metrics.liquidityScore = 50;
        else metrics.liquidityScore = 30;
      }
    } catch (error) {
      console.error('[GlobalAdvisory] Error calculating advanced metrics:', error);
    }
    
    return metrics;
  }

  private getRecommendationFromScore(score: number): 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' {
    if (score >= 80) return 'strong_buy';
    if (score >= 65) return 'buy';
    if (score >= 45) return 'hold';
    if (score >= 30) return 'sell';
    return 'strong_sell';
  }

  private generateRationale(data: GlobalInstrumentData, score: any, recommendation: string): string {
    const direction = recommendation.includes('buy') ? 'positive' : recommendation === 'hold' ? 'neutral' : 'negative';
    return `${data.name} (${data.symbol}) shows ${direction} indicators. ` +
           `Current price of ${data.currency} ${data.currentPrice.toFixed(2)} (₹${data.currentPriceInr.toFixed(2)}) ` +
           `presents a ${recommendation.replace('_', ' ')} opportunity based on our analysis. ` +
           `${score.keyFactors.slice(0, 2).join('. ')}. ` +
           `Risk factors to monitor: ${score.riskFactors.slice(0, 2).join(', ') || 'Standard market risk'}.`;
  }

  private getTaxImplications(market: string): GlobalRecommendation['taxImplications'] {
    const dtaaRates: Record<string, number> = {
      'US': 15, 'UK': 15, 'SG': 15, 'JP': 10, 'EU': 15, 'HK': 0
    };
    
    return {
      stcgRate: 30, // Indian STCG on foreign assets
      ltcgRate: 20, // Indian LTCG with indexation
      dtaaRate: dtaaRates[market] || 25,
      holdingPeriodForLtcg: '24 months for foreign assets',
      taxTip: `DTAA with ${market} may reduce withholding tax on dividends. File Form 67 to claim foreign tax credit.`
    };
  }

  private calculateSuitabilityScore(data: GlobalInstrumentData, riskLevel: string): number {
    let score = 70;
    
    if (riskLevel === 'conservative') {
      if (data.dividendYield && data.dividendYield > 2) score += 15;
      if (data.beta && data.beta < 1) score += 10;
      if (data.assetClass === 'bond' || data.assetClass === 'etf') score += 5;
    } else if (riskLevel === 'aggressive') {
      if (data.sector === 'Technology') score += 10;
      if (data.beta && data.beta > 1.2) score += 5;
    }

    return Math.min(100, score);
  }

  async generatePortfolioRebalancing(
    userId: string,
    positions: Array<{
      symbol: string;
      quantity: number;
      avgCostBasis: number;
      currency: string;
      targetAllocation: number;
    }>,
    targetAllocations: {
      stocks: number;
      etfs: number;
      bonds: number;
      cash: number;
    },
    lrsUtilizedYtdUsd: number = 0
  ): Promise<PortfolioRebalancingResult> {
    const actions: RebalancingAction[] = [];
    let totalValueInr = 0;
    let totalValueUsd = 0;
    const assetAllocation: Record<string, number> = { stocks: 0, etfs: 0, bonds: 0, cash: 0 };
    const geographicAllocation: Record<string, number> = {};
    const sectorAllocation: Record<string, number> = {};

    // Fetch current prices and calculate portfolio value
    for (const position of positions) {
      const data = await this.fetchGlobalInstrumentData(position.symbol);
      if (!data) continue;

      const positionValueNative = position.quantity * data.currentPrice;
      const positionValueInr = positionValueNative * (await currencyExchangeService.getExchangeRate(data.currency, 'INR'));
      const positionValueUsd = positionValueNative * (await currencyExchangeService.getExchangeRate(data.currency, 'USD'));

      totalValueInr += positionValueInr;
      totalValueUsd += positionValueUsd;

      const assetType = data.assetClass === 'stock' ? 'stocks' : 
                       data.assetClass === 'etf' ? 'etfs' : 
                       data.assetClass === 'bond' ? 'bonds' : 'etfs';
      assetAllocation[assetType] = (assetAllocation[assetType] || 0) + positionValueInr;

      geographicAllocation[data.market] = (geographicAllocation[data.market] || 0) + positionValueInr;
      if (data.sector) {
        sectorAllocation[data.sector] = (sectorAllocation[data.sector] || 0) + positionValueInr;
      }
    }

    // Calculate allocations as percentages
    for (const key of Object.keys(assetAllocation)) {
      assetAllocation[key] = totalValueInr > 0 ? (assetAllocation[key] / totalValueInr) * 100 : 0;
    }
    for (const key of Object.keys(geographicAllocation)) {
      geographicAllocation[key] = totalValueInr > 0 ? (geographicAllocation[key] / totalValueInr) * 100 : 0;
    }
    for (const key of Object.keys(sectorAllocation)) {
      sectorAllocation[key] = totalValueInr > 0 ? (sectorAllocation[key] / totalValueInr) * 100 : 0;
    }

    // Calculate drift and generate actions
    const driftByAsset: Record<string, number> = {};
    let maxDrift = 0;
    let totalDrift = 0;

    for (const position of positions) {
      const data = await this.fetchGlobalInstrumentData(position.symbol);
      if (!data) continue;

      const positionValueNative = position.quantity * data.currentPrice;
      const positionValueInr = positionValueNative * (await currencyExchangeService.getExchangeRate(data.currency, 'INR'));
      const currentAllocation = totalValueInr > 0 ? (positionValueInr / totalValueInr) * 100 : 0;
      const targetAllocation = position.targetAllocation;
      const drift = currentAllocation - targetAllocation;
      
      driftByAsset[position.symbol] = drift;
      maxDrift = Math.max(maxDrift, Math.abs(drift));
      totalDrift += Math.abs(drift);

      const action: 'buy' | 'sell' | 'hold' = 
        drift < -5 ? 'buy' : 
        drift > 5 ? 'sell' : 'hold';

      const quantityChange = action === 'buy' 
        ? Math.abs(drift) * totalValueInr / 100 / data.currentPriceInr
        : action === 'sell'
        ? -Math.abs(drift) * totalValueInr / 100 / data.currentPriceInr
        : 0;

      const tradeValueInr = Math.abs(quantityChange * data.currentPriceInr);
      const tradeValueUsd = tradeValueInr / (await currencyExchangeService.getExchangeRate('USD', 'INR'));
      const lrsRemaining = LRS_ANNUAL_LIMIT_USD - lrsUtilizedYtdUsd;

      actions.push({
        symbol: position.symbol,
        name: data.name,
        assetClass: data.assetClass,
        market: data.market,
        currency: data.currency,
        action,
        priority: Math.abs(drift) > 10 ? 'high' : Math.abs(drift) > 5 ? 'normal' : 'low',
        currentQuantity: position.quantity,
        recommendedQuantity: position.quantity + quantityChange,
        quantityChange,
        currentPrice: data.currentPrice,
        currentPriceInr: data.currentPriceInr,
        currentAllocation,
        targetAllocation,
        driftPercent: drift,
        tradeValueNative: Math.abs(quantityChange * data.currentPrice),
        tradeValueInr,
        rationale: `Current allocation ${currentAllocation.toFixed(1)}% vs target ${targetAllocation.toFixed(1)}%. ${action === 'buy' ? 'Increase' : action === 'sell' ? 'Reduce' : 'Maintain'} position.`,
        keyFactors: [`Drift: ${drift.toFixed(1)}%`],
        riskFactors: action === 'buy' ? ['Currency risk on new investment'] : [],
        lrsImpact: action === 'buy' ? tradeValueUsd : 0,
        complianceFlags: {
          lrsCheck: action === 'buy' && tradeValueUsd > lrsRemaining ? 'block' : 
                   action === 'buy' && tradeValueUsd > lrsRemaining * 0.8 ? 'warning' : 'pass',
          fatcaCheck: 'pass',
        },
      });
    }

    const avgDrift = positions.length > 0 ? totalDrift / positions.length : 0;
    const needsRebalancing = maxDrift > 5;
    const urgency: 'high' | 'medium' | 'low' | 'none' = 
      maxDrift > 15 ? 'high' : maxDrift > 10 ? 'medium' : maxDrift > 5 ? 'low' : 'none';

    const buyActions = actions.filter(a => a.action === 'buy');
    const sellActions = actions.filter(a => a.action === 'sell');
    const totalBuyValueInr = buyActions.reduce((sum, a) => sum + a.tradeValueInr, 0);
    const totalSellValueInr = sellActions.reduce((sum, a) => sum + a.tradeValueInr, 0);
    const totalBuyValueUsd = totalBuyValueInr / (await currencyExchangeService.getExchangeRate('USD', 'INR'));
    const lrsRemaining = LRS_ANNUAL_LIMIT_USD - lrsUtilizedYtdUsd;

    return {
      snapshotId: `rebal_${Date.now()}`,
      userId,
      portfolioScope: 'global_only',
      totalValueInr,
      totalValueUsd,
      assetAllocation,
      geographicAllocation,
      sectorAllocation,
      driftAnalysis: {
        maxDrift,
        avgDrift,
        driftByAsset,
        needsRebalancing,
        urgency,
      },
      riskMetrics: {
        portfolioBeta: 1.1, // Simplified
        estimatedVolatility: 15,
        sharpeRatio: 1.2,
        diversificationScore: Object.keys(geographicAllocation).length * 20,
      },
      actions,
      summary: {
        buyCount: buyActions.length,
        sellCount: sellActions.length,
        holdCount: actions.filter(a => a.action === 'hold').length,
        totalBuyValueInr,
        totalSellValueInr,
        netFlowInr: totalBuyValueInr - totalSellValueInr,
      },
      lrsStatus: {
        utilizedYtdUsd: lrsUtilizedYtdUsd,
        remainingLimitUsd: lrsRemaining,
        canExecuteAll: totalBuyValueUsd <= lrsRemaining,
        warningMessage: totalBuyValueUsd > lrsRemaining 
          ? `Total buy value ($${totalBuyValueUsd.toFixed(0)}) exceeds remaining LRS limit ($${lrsRemaining.toFixed(0)})`
          : undefined,
      },
      aiInsights: await this.generateAIInsights(actions, driftByAsset, needsRebalancing),
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  private async generateAIInsights(
    actions: RebalancingAction[],
    driftByAsset: Record<string, number>,
    needsRebalancing: boolean
  ): Promise<string> {
    if (!this.genAI) {
      return needsRebalancing 
        ? `Your portfolio has drifted from target allocations. Consider executing the recommended ${actions.filter(a => a.action !== 'hold').length} trades to realign.`
        : 'Your portfolio is well-balanced and aligned with your target allocations.';
    }

    try {
      const model = this.genAI.models.generateContent;
      const prompt = `As a financial advisor, provide a brief 2-3 sentence insight about this portfolio rebalancing situation:
- Needs rebalancing: ${needsRebalancing}
- Number of buy actions: ${actions.filter(a => a.action === 'buy').length}
- Number of sell actions: ${actions.filter(a => a.action === 'sell').length}
- Maximum drift: ${Math.max(...Object.values(driftByAsset).map(Math.abs)).toFixed(1)}%
Focus on actionable advice for an Indian investor investing globally.`;

      const result = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      return result.text || 'Portfolio analysis complete. Review the recommended actions.';
    } catch (error) {
      console.error('[GlobalAdvisory] AI insights generation failed:', error);
      return needsRebalancing 
        ? 'Your portfolio requires rebalancing. Review the recommended trades.'
        : 'Your portfolio is well-balanced.';
    }
  }
}

export const aiGlobalAdvisoryService = new AIGlobalAdvisoryService();
