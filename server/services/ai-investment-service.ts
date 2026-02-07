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
  investmentProposalItems,
  mutualFunds,
  aifMaster,
  pmsMaster,
  mldMaster,
  unlistedCompanies,
  corporateBonds,
  ncdPublicIssues,
  listedStocks,
  prospectClients
} from "@shared/schema";
import { unifiedHoldingsReaderService, type UnifiedHolding } from './unified-holdings-reader-service';
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
import { eq, and, desc, asc, gte, lte, sql, inArray, ilike, or } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

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
  stopLossPrice: number;
  upsidePercent: number;
  downsidePercent: number;
  profitScore: number;
  confidenceLevel: 'low' | 'medium' | 'high' | 'very_high';
  signalType: 'buy' | 'sell' | 'hold';
  signalStrength: 'weak' | 'moderate' | 'strong';
  timeHorizon: 'ultra_short' | 'short' | 'medium' | 'long';
  timeHorizonDays: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high';
  riskScore: number;
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
  private genAI: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.AI_INTEGRATIONS_GOOGLE_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      console.log("✅ AI Investment Service initialized with Gemini");
    } else {
      console.log("⚠️ AI Investment Service running without Gemini (using rule-based analysis)");
    }
  }

  /**
   * Helper: Add default values for required StockAnalysis fields
   * Used by non-stock product methods (mutual funds, AIF, PMS, MLD, bonds, NCDs, unlisted)
   */
  private addDefaultStockFields(base: Omit<StockAnalysis, 'stopLossPrice' | 'downsidePercent' | 'confidenceLevel' | 'signalStrength' | 'timeHorizonDays' | 'riskScore'>): StockAnalysis {
    const stopLossPercent = base.riskLevel === 'low' ? 5 : base.riskLevel === 'moderate' ? 8 : base.riskLevel === 'high' ? 12 : 15;
    const stopLossPrice = base.currentPrice * (1 - stopLossPercent / 100);
    const confidenceLevel = base.profitScore >= 85 ? 'very_high' : base.profitScore >= 75 ? 'high' : base.profitScore >= 60 ? 'medium' : 'low';
    const signalStrength = base.profitScore >= 85 ? 'strong' : base.profitScore >= 70 ? 'moderate' : 'weak';
    const timeHorizonDays = base.timeHorizon === 'long' ? 365 : base.timeHorizon === 'medium' ? 180 : base.timeHorizon === 'short' ? 90 : 30;
    const riskScore = base.riskLevel === 'low' ? 25 : base.riskLevel === 'moderate' ? 50 : base.riskLevel === 'high' ? 75 : 90;

    return {
      ...base,
      stopLossPrice,
      downsidePercent: stopLossPercent,
      confidenceLevel: confidenceLevel as 'low' | 'medium' | 'high' | 'very_high',
      signalStrength: signalStrength as 'weak' | 'moderate' | 'strong',
      timeHorizonDays,
      riskScore
    };
  }

  /**
   * Get store-eligible mutual funds for AI recommendations
   * Only returns funds that are:
   * 1. Published in the store (is_published = true)
   * 2. Match the correct plan type based on store settings
   * 
   * REGULATORY COMPLIANCE: Only recommends funds available in the store
   */
  async getStoreEligibleMutualFunds(options: {
    category?: string;
    riskLevel?: string;
    limit?: number;
  } = {}): Promise<StockAnalysis[]> {
    try {
      const { category, riskLevel, limit = 20 } = options;

      // Query only published funds with regular plan type (since direct is not enabled)
      // This ensures regulatory compliance - only recommend what's in the store
      const conditions = [
        eq(mutualFunds.isPublished, true),
        eq(mutualFunds.planType, 'regular') // Only regular schemes - direct not enabled in store
      ];

      if (category) {
        conditions.push(ilike(mutualFunds.category, `%${category}%`));
      }

      if (riskLevel) {
        conditions.push(ilike(mutualFunds.riskLevel, `%${riskLevel}%`));
      }

      const eligibleFunds = await db
        .select({
          id: mutualFunds.id,
          schemeName: mutualFunds.schemeName,
          schemeCode: mutualFunds.schemeCode,
          category: mutualFunds.category,
          fundHouse: mutualFunds.fundHouse,
          nav: mutualFunds.nav,
          returns1y: mutualFunds.returns1y,
          returns3y: mutualFunds.returns3y,
          riskLevel: mutualFunds.riskLevel,
          planType: mutualFunds.planType,
        })
        .from(mutualFunds)
        .where(and(...conditions))
        .limit(limit);

      // Convert to StockAnalysis format for compatibility
      return eligibleFunds.map(fund => {
        const nav = parseFloat(fund.nav || '0');
        const returns1y = parseFloat(fund.returns1y || '0');
        
        // Determine time horizon and risk based on category
        let timeHorizon: 'ultra_short' | 'short' | 'medium' | 'long' = 'medium';
        let risk: 'low' | 'moderate' | 'high' | 'very_high' = 'moderate';
        
        const categoryLower = (fund.category || '').toLowerCase();
        if (categoryLower.includes('liquid') || categoryLower.includes('overnight') || categoryLower.includes('money market')) {
          timeHorizon = 'ultra_short';
          risk = 'low';
        } else if (categoryLower.includes('ultra short') || categoryLower.includes('low duration')) {
          timeHorizon = 'short';
          risk = 'low';
        } else if (categoryLower.includes('equity') || categoryLower.includes('small cap') || categoryLower.includes('mid cap')) {
          timeHorizon = 'long';
          risk = categoryLower.includes('small') ? 'high' : 'moderate';
        } else if (categoryLower.includes('debt') || categoryLower.includes('bond')) {
          timeHorizon = 'medium';
          risk = 'low';
        }

        // Calculate profit score based on returns and risk
        const profitScore = Math.min(95, Math.max(50, 70 + (returns1y * 2)));

        return this.addDefaultStockFields({
          symbol: fund.schemeCode || fund.id,
          stockName: fund.schemeName || 'Unknown Fund',
          currentPrice: nav,
          targetPrice: nav * (1 + (returns1y / 100) * 0.8), // Conservative target
          upsidePercent: returns1y * 0.8,
          profitScore: Math.round(profitScore),
          signalType: 'buy' as const,
          timeHorizon,
          riskLevel: risk,
          sector: fund.category || 'Mutual Fund',
          aiReason: `${fund.fundHouse} ${fund.category} fund with ${returns1y.toFixed(1)}% 1-year returns. Regular plan available in store.`,
          keyFactors: [
            `Fund House: ${fund.fundHouse}`,
            `Category: ${fund.category}`,
            `1Y Returns: ${returns1y.toFixed(1)}%`
          ],
          riskFactors: this.getCategoryRiskFactors(fund.category || '')
        });
      });
    } catch (error) {
      console.error('Error fetching store-eligible mutual funds:', error);
      return [];
    }
  }

  private getCategoryRiskFactors(category: string): string[] {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes('equity')) {
      return ['Market volatility', 'Sector concentration'];
    } else if (categoryLower.includes('debt') || categoryLower.includes('bond')) {
      return ['Interest rate sensitivity', 'Credit risk'];
    } else if (categoryLower.includes('liquid') || categoryLower.includes('overnight')) {
      return ['Lower returns compared to equity'];
    }
    return ['Market conditions', 'Fund performance'];
  }

  /**
   * Get store-eligible AIFs for AI recommendations
   * Only returns AIFs that are published and active
   */
  async getStoreEligibleAIF(options: {
    category?: string;
    riskScore?: number;
    limit?: number;
  } = {}): Promise<StockAnalysis[]> {
    try {
      const { category, riskScore, limit = 10 } = options;

      const conditions = [
        eq(aifMaster.isPublished, true),
        eq(aifMaster.fundStatus, 'active')
      ];

      if (category) {
        conditions.push(ilike(aifMaster.category, `%${category}%`));
      }

      const eligibleAIFs = await db
        .select()
        .from(aifMaster)
        .where(and(...conditions))
        .limit(limit);

      return eligibleAIFs.map(aif => {
        const nav = parseFloat(aif.latestNav || '100');
        const returns1y = parseFloat(aif.return1Y || '0');
        const minInvestment = parseFloat(aif.minInvestment || '10000000');
        const risk = (aif.riskScore || 5) > 7 ? 'very_high' : (aif.riskScore || 5) > 5 ? 'high' : 'moderate';

        return this.addDefaultStockFields({
          symbol: aif.registrationNo || aif.id,
          stockName: aif.name,
          currentPrice: nav,
          targetPrice: nav * 1.15,
          upsidePercent: 15,
          profitScore: Math.min(90, 70 + (returns1y > 0 ? returns1y / 2 : 0)),
          signalType: 'buy' as const,
          timeHorizon: 'long' as const,
          riskLevel: risk as 'low' | 'moderate' | 'high' | 'very_high',
          sector: `AIF - ${aif.category || 'Category II'}`,
          aiReason: `${aif.fundHouseName || 'AIF'} - ${aif.subcategory || aif.category} fund. Min investment ₹${(minInvestment / 10000000).toFixed(1)}Cr.`,
          keyFactors: [
            `Category: ${aif.category}`,
            `Style: ${aif.style || 'Growth'}`,
            `AUM: ₹${(parseFloat(aif.aum || '0') / 10000000).toFixed(0)}Cr`
          ],
          riskFactors: ['Illiquid investment', 'Long lock-in period', 'Higher minimum investment']
        });
      });
    } catch (error) {
      console.error('Error fetching store-eligible AIFs:', error);
      return [];
    }
  }

  /**
   * Get store-eligible PMS for AI recommendations
   * Only returns PMS schemes that are published and active
   */
  async getStoreEligiblePMS(options: {
    strategy?: string;
    limit?: number;
  } = {}): Promise<StockAnalysis[]> {
    try {
      const { strategy, limit = 10 } = options;

      const conditions = [
        eq(pmsMaster.isPublished, true),
        eq(pmsMaster.fundStatus, 'active')
      ];

      if (strategy) {
        conditions.push(ilike(pmsMaster.strategy, `%${strategy}%`));
      }

      const eligiblePMS = await db
        .select()
        .from(pmsMaster)
        .where(and(...conditions))
        .limit(limit);

      return eligiblePMS.map(pms => {
        const nav = parseFloat(pms.latestNav || '100');
        const returns1y = parseFloat(pms.return1Y || '0');
        const minInvestment = parseFloat(pms.minInvestment || '5000000');
        const risk = (pms.riskScore || 5) > 7 ? 'high' : (pms.riskScore || 5) > 4 ? 'moderate' : 'low';

        return this.addDefaultStockFields({
          symbol: pms.registrationNo || pms.id,
          stockName: pms.name,
          currentPrice: nav,
          targetPrice: nav * (1 + (returns1y / 100) * 0.8),
          upsidePercent: returns1y * 0.8,
          profitScore: Math.min(92, 72 + (returns1y > 0 ? returns1y / 2 : 0)),
          signalType: 'buy' as const,
          timeHorizon: 'long' as const,
          riskLevel: risk as 'low' | 'moderate' | 'high' | 'very_high',
          sector: `PMS - ${pms.strategy || 'Multi-Cap'}`,
          aiReason: `${pms.fundHouseName || 'PMS'} - ${pms.strategy || 'Diversified'} strategy. Min investment ₹${(minInvestment / 100000).toFixed(0)}L.`,
          keyFactors: [
            `Strategy: ${pms.strategy || 'Multi-Cap'}`,
            `Style: ${pms.style || 'Growth'}`,
            `1Y Returns: ${returns1y.toFixed(1)}%`
          ],
          riskFactors: ['Market-linked returns', 'No guaranteed returns', 'Management fee applicable']
        });
      });
    } catch (error) {
      console.error('Error fetching store-eligible PMS:', error);
      return [];
    }
  }

  /**
   * Get store-eligible MLDs for AI recommendations
   * Only returns MLDs that are published and active
   */
  async getStoreEligibleMLD(options: {
    payoffType?: string;
    limit?: number;
  } = {}): Promise<StockAnalysis[]> {
    try {
      const { payoffType, limit = 10 } = options;

      const conditions = [
        eq(mldMaster.isPublished, true),
        eq(mldMaster.status, 'active')
      ];

      if (payoffType) {
        conditions.push(eq(mldMaster.payoffType, payoffType));
      }

      const eligibleMLDs = await db
        .select()
        .from(mldMaster)
        .where(and(...conditions))
        .limit(limit);

      return eligibleMLDs.map(mld => {
        const price = parseFloat(mld.latestPrice || mld.faceValue || '1000000');
        const ytm = parseFloat(mld.ytm || '8');
        const risk = (mld.riskScore || 5) > 6 ? 'high' : (mld.riskScore || 5) > 3 ? 'moderate' : 'low';

        return this.addDefaultStockFields({
          symbol: mld.isin,
          stockName: mld.name,
          currentPrice: price,
          targetPrice: price * (1 + ytm / 100),
          upsidePercent: ytm,
          profitScore: Math.min(88, 70 + ytm),
          signalType: 'buy' as const,
          timeHorizon: 'medium' as const,
          riskLevel: risk as 'low' | 'moderate' | 'high' | 'very_high',
          sector: `MLD - ${mld.payoffType || 'Structured'}`,
          aiReason: `${mld.issuer} MLD linked to ${mld.underlying}. Rating: ${mld.rating || 'AA'}. YTM: ${ytm.toFixed(1)}%.`,
          keyFactors: [
            `Underlying: ${mld.underlying}`,
            `Payoff Type: ${mld.payoffType}`,
            `Rating: ${mld.rating || 'AA'}`
          ],
          riskFactors: ['Credit risk', 'Market-linked returns', 'Illiquid until maturity']
        });
      });
    } catch (error) {
      console.error('Error fetching store-eligible MLDs:', error);
      return [];
    }
  }

  /**
   * Get store-eligible Unlisted Stocks for AI recommendations
   * Only returns unlisted companies with published pricing and not suspended
   */
  async getStoreEligibleUnlistedStocks(options: {
    sector?: string;
    limit?: number;
  } = {}): Promise<StockAnalysis[]> {
    try {
      const { sector, limit = 10 } = options;

      const conditions = [
        eq(unlistedCompanies.pricingStatus, 'published'),
        eq(unlistedCompanies.status, 'active'),
        eq(unlistedCompanies.tradingSuspended, false)
      ];

      if (sector) {
        conditions.push(ilike(unlistedCompanies.sector, `%${sector}%`));
      }

      const eligibleUnlisted = await db
        .select()
        .from(unlistedCompanies)
        .where(and(...conditions))
        .limit(limit);

      return eligibleUnlisted.map(company => {
        const buyPrice = parseFloat(company.publishedBuyPrice || '0');
        const sellPrice = parseFloat(company.publishedSellPrice || '0');
        const avgPrice = (buyPrice + sellPrice) / 2 || 1000;

        return this.addDefaultStockFields({
          symbol: company.cin || company.id,
          stockName: company.name,
          currentPrice: avgPrice,
          targetPrice: avgPrice * 1.25,
          upsidePercent: 25,
          profitScore: 75,
          signalType: 'buy' as const,
          timeHorizon: 'long' as const,
          riskLevel: 'very_high' as const,
          sector: `Unlisted - ${company.sector || 'Private'}`,
          aiReason: `${company.name} - ${company.industry || company.sector} sector unlisted company. Pre-IPO opportunity.`,
          keyFactors: [
            `Sector: ${company.sector}`,
            `Industry: ${company.industry || 'N/A'}`,
            `Listing Stage: ${company.listingStage || 'Unlisted'}`
          ],
          riskFactors: ['High illiquidity', 'No price discovery', 'Regulatory risk', 'Lock-in period']
        });
      });
    } catch (error) {
      console.error('Error fetching store-eligible unlisted stocks:', error);
      return [];
    }
  }

  /**
   * Get store-eligible Bonds for AI recommendations
   * Only returns active corporate bonds
   */
  async getStoreEligibleBonds(options: {
    bondType?: string;
    creditRating?: string;
    limit?: number;
  } = {}): Promise<StockAnalysis[]> {
    try {
      const { bondType, creditRating, limit = 10 } = options;

      const conditions = [
        eq(corporateBonds.tradingStatus, 'active')
      ];

      if (bondType) {
        conditions.push(eq(corporateBonds.bondType, bondType));
      }

      if (creditRating) {
        conditions.push(ilike(corporateBonds.creditRating, `%${creditRating}%`));
      }

      const eligibleBonds = await db
        .select()
        .from(corporateBonds)
        .where(and(...conditions))
        .limit(limit);

      return eligibleBonds.map(bond => {
        const price = parseFloat(bond.currentPrice || bond.faceValue || '1000');
        const ytm = parseFloat(bond.yieldToMaturity || '8');
        const coupon = parseFloat(bond.couponRate || '7');
        const ratingScore = bond.creditRating?.includes('AAA') ? 1 : bond.creditRating?.includes('AA') ? 2 : 3;
        const risk = ratingScore === 1 ? 'low' : ratingScore === 2 ? 'moderate' : 'high';

        return this.addDefaultStockFields({
          symbol: bond.isin,
          stockName: bond.bondName,
          currentPrice: price,
          targetPrice: price * (1 + ytm / 100),
          upsidePercent: ytm,
          profitScore: Math.min(85, 65 + ytm + (3 - ratingScore) * 5),
          signalType: 'buy' as const,
          timeHorizon: 'medium' as const,
          riskLevel: risk as 'low' | 'moderate' | 'high' | 'very_high',
          sector: `Bond - ${bond.bondType || 'Corporate'}`,
          aiReason: `${bond.issuer} ${bond.bondType} bond. Rating: ${bond.creditRating}. Coupon: ${coupon.toFixed(2)}%, YTM: ${ytm.toFixed(2)}%.`,
          keyFactors: [
            `Credit Rating: ${bond.creditRating}`,
            `Coupon: ${coupon.toFixed(2)}%`,
            `YTM: ${ytm.toFixed(2)}%`
          ],
          riskFactors: bond.secured ? ['Interest rate risk'] : ['Credit risk', 'Interest rate risk']
        });
      });
    } catch (error) {
      console.error('Error fetching store-eligible bonds:', error);
      return [];
    }
  }

  /**
   * Get store-eligible NCDs for AI recommendations
   * Only returns open or listed NCDs
   */
  async getStoreEligibleNCDs(options: {
    limit?: number;
  } = {}): Promise<StockAnalysis[]> {
    try {
      const { limit = 10 } = options;

      const eligibleNCDs = await db
        .select()
        .from(ncdPublicIssues)
        .where(
          or(
            eq(ncdPublicIssues.issueStatus, 'open'),
            eq(ncdPublicIssues.issueStatus, 'listed')
          )
        )
        .limit(limit);

      return eligibleNCDs.map(ncd => {
        const faceValue = parseFloat(ncd.faceValue || '1000');
        const coupon = parseFloat(ncd.couponRate || '8');
        const yield_ = parseFloat(ncd.effectiveYield || ncd.couponRate || '8');
        const ratingScore = ncd.creditRating?.includes('AAA') ? 1 : ncd.creditRating?.includes('AA') ? 2 : 3;
        const risk = ratingScore === 1 ? 'low' : ratingScore === 2 ? 'moderate' : 'high';

        return this.addDefaultStockFields({
          symbol: ncd.isin || ncd.issueId,
          stockName: ncd.issueName,
          currentPrice: faceValue,
          targetPrice: faceValue * (1 + yield_ / 100),
          upsidePercent: yield_,
          profitScore: Math.min(82, 62 + yield_ + (3 - ratingScore) * 5),
          signalType: 'buy' as const,
          timeHorizon: 'medium' as const,
          riskLevel: risk as 'low' | 'moderate' | 'high' | 'very_high',
          sector: `NCD - ${ncd.ncdCategory || 'Secured'}`,
          aiReason: `${ncd.issuerName} NCD issue. Rating: ${ncd.creditRating} (${ncd.ratingAgency}). Coupon: ${coupon.toFixed(2)}%, Tenor: ${ncd.tenorYears}Y.`,
          keyFactors: [
            `Credit Rating: ${ncd.creditRating}`,
            `Coupon: ${coupon.toFixed(2)}%`,
            `Tenor: ${ncd.tenorYears} years`
          ],
          riskFactors: ncd.secured ? ['Interest rate sensitivity'] : ['Credit risk', 'Interest rate sensitivity']
        });
      });
    } catch (error) {
      console.error('Error fetching store-eligible NCDs:', error);
      return [];
    }
  }

  /**
   * Get store-eligible Listed Stocks for AI recommendations
   * Fetches from the synced NSE/BSE stock database
   * Applies risk-based filtering based on market cap
   */
  async getStoreEligibleListedStocks(options: {
    riskLevel?: string;
    sectors?: string[];
    limit?: number;
  } = {}): Promise<StockAnalysis[]> {
    try {
      const { riskLevel, sectors, limit = 30 } = options;

      const conditions = [eq(listedStocks.isPublished, true)];

      const stocks = await db
        .select()
        .from(listedStocks)
        .where(and(...conditions))
        .limit(limit * 5);

      if (!stocks.length) {
        console.log('[AI Service] No published stocks found in database');
        return [];
      }

      // Normalize risk level to handle both user profile values and standard names
      const normalizedRisk = this.normalizeRiskLevel(riskLevel);

      const riskToMarketCap: Record<string, string[]> = {
        'conservative': ['Large Cap'],
        'low': ['Large Cap'],
        'moderate': ['Large Cap', 'Mid Cap'],
        'medium': ['Large Cap', 'Mid Cap'],
        'aggressive': ['Large Cap', 'Mid Cap', 'Small Cap'],
        'high': ['Large Cap', 'Mid Cap', 'Small Cap'],
        'very_aggressive': ['Mid Cap', 'Small Cap']
      };

      const allowedMarketCaps = normalizedRisk ? riskToMarketCap[normalizedRisk] || ['Large Cap'] : ['Large Cap', 'Mid Cap'];

      // Deterministic sector diversification: max 3 stocks per sector, max 10 sectors
      const sectorCounts: Record<string, number> = {};
      const maxStocksPerSector = 3;
      const maxSectors = 10;

      const filteredStocks = stocks
        .filter(stock => {
          const marketCap = stock.marketCap || 'Large Cap';
          if (!allowedMarketCaps.includes(marketCap)) return false;
          if (sectors && sectors.length > 0) {
            if (!stock.sector || !sectors.some(s => stock.sector?.toLowerCase().includes(s.toLowerCase()))) {
              return false;
            }
          }
          const sector = stock.sector || 'Diversified';
          const currentCount = sectorCounts[sector] || 0;
          const uniqueSectors = Object.keys(sectorCounts).length;
          if (currentCount >= maxStocksPerSector) return false;
          if (currentCount === 0 && uniqueSectors >= maxSectors) return false;
          sectorCounts[sector] = currentCount + 1;
          return true;
        })
        .slice(0, limit);

      console.log(`[AI Service] Risk: ${riskLevel} -> ${normalizedRisk}, Allowed caps: ${allowedMarketCaps.join(', ')}, Found: ${filteredStocks.length} stocks`);

      return filteredStocks.map(stock => {
        const currentPrice = parseFloat(stock.currentPrice || '0');
        const previousClose = parseFloat(stock.previousClose || '0');
        const dayChangePercent = parseFloat(stock.dayChangePercent || '0');
        const returns1Y = parseFloat(stock.returns1Y || '0');
        const beta = parseFloat(stock.beta || '1');
        const low52Week = parseFloat(stock.weekLow52 || '0');
        
        // Calculate upside based on returns momentum and market cap
        const estimatedUpside = Math.max(5, Math.min(30, 10 + returns1Y * 0.3 + (stock.marketCap === 'Large Cap' ? 2 : 5)));
        const targetPrice = currentPrice * (1 + estimatedUpside / 100);
        
        // Calculate stop loss: 8-15% below current price based on volatility/beta
        const stopLossPercent = Math.min(15, Math.max(8, 8 + (beta - 1) * 5));
        const stopLossPrice = currentPrice * (1 - stopLossPercent / 100);
        const downsidePercent = stopLossPercent;
        
        // Calculate profit score (0-100)
        const profitScore = Math.min(95, Math.max(50, 
          70 + 
          (returns1Y > 20 ? 10 : returns1Y > 0 ? 5 : 0) +
          (dayChangePercent > 0 ? 3 : -2) +
          (stock.marketCap === 'Large Cap' ? 5 : stock.marketCap === 'Mid Cap' ? 2 : 0)
        ));

        // Determine signal type and strength
        const signalType: 'buy' | 'sell' | 'hold' = 
          estimatedUpside > 15 ? 'buy' : estimatedUpside > 5 ? 'hold' : 'sell';
        const signalStrength: 'weak' | 'moderate' | 'strong' = 
          profitScore >= 85 ? 'strong' : profitScore >= 70 ? 'moderate' : 'weak';

        // Calculate confidence level
        const confidenceLevel: 'low' | 'medium' | 'high' | 'very_high' = 
          profitScore >= 90 ? 'very_high' : 
          profitScore >= 80 ? 'high' : 
          profitScore >= 65 ? 'medium' : 'low';

        // Risk assessment
        const stockRiskLevel: 'low' | 'moderate' | 'high' | 'very_high' = 
          stock.marketCap === 'Large Cap' ? 'low' :
          stock.marketCap === 'Mid Cap' ? 'moderate' : 'high';
        const riskScore = stockRiskLevel === 'low' ? 25 : 
          stockRiskLevel === 'moderate' ? 50 : 
          stockRiskLevel === 'high' ? 75 : 90;

        // Time horizon
        const timeHorizon: 'ultra_short' | 'short' | 'medium' | 'long' = 
          stock.marketCap === 'Large Cap' ? 'long' :
          stock.marketCap === 'Mid Cap' ? 'medium' : 'short';
        const timeHorizonDays = timeHorizon === 'long' ? 365 : 
          timeHorizon === 'medium' ? 180 : 
          timeHorizon === 'short' ? 90 : 30;

        return {
          symbol: stock.symbol,
          stockName: stock.companyName,
          currentPrice,
          targetPrice,
          stopLossPrice,
          upsidePercent: estimatedUpside,
          downsidePercent,
          profitScore: Math.round(profitScore),
          confidenceLevel,
          signalType,
          signalStrength,
          timeHorizon,
          timeHorizonDays,
          riskLevel: stockRiskLevel,
          riskScore,
          sector: stock.sector || stock.industry || 'Diversified',
          aiReason: `${stock.companyName} (${stock.symbol}) - ${stock.marketCap || 'Mid Cap'} stock in ${stock.sector || stock.industry || 'diversified'} sector. Target: ₹${targetPrice.toFixed(0)} (+${estimatedUpside.toFixed(1)}%), Stop Loss: ₹${stopLossPrice.toFixed(0)} (-${stopLossPercent.toFixed(1)}%). ${returns1Y > 0 ? `1Y returns: ${returns1Y.toFixed(1)}%.` : ''} Risk-Reward: ${(estimatedUpside / stopLossPercent).toFixed(2)}:1.`,
          keyFactors: [
            stock.marketCap ? `Market Cap: ${stock.marketCap}` : 'Established company',
            stock.sector ? `Sector: ${stock.sector}` : 'Diversified business',
            returns1Y > 15 ? 'Strong momentum' : returns1Y > 0 ? 'Positive returns' : 'Value opportunity',
            `Risk-Reward: ${(estimatedUpside / stopLossPercent).toFixed(2)}:1`
          ],
          riskFactors: [
            stock.marketCap === 'Small Cap' ? 'Higher volatility' : 'Market risk',
            'Sector-specific risks',
            beta > 1.3 ? `High Beta (${beta.toFixed(2)})` : 'Normal volatility'
          ]
        };
      });
    } catch (error) {
      console.error('Error fetching store-eligible listed stocks:', error);
      return [];
    }
  }

  async getClientPortfolio(clientId: string): Promise<{ portfolio: any; holdings: PortfolioHolding[] } | null> {
    // Use unified holdings reader - single source of truth for both prospects and registered clients
    const clientType = await unifiedHoldingsReaderService.getClientType(clientId);
    const unifiedHoldings = await unifiedHoldingsReaderService.getHoldings(clientId);

    if (unifiedHoldings.length === 0) {
      // Fallback to legacy portfolioHoldings for backwards compatibility
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

    // Convert unified holdings to legacy format for compatibility
    const holdings: PortfolioHolding[] = unifiedHoldings.map(h => ({
      id: h.id,
      symbol: h.symbol || h.isin || 'UNKNOWN',
      quantity: String(h.quantity || 0),
      avgPrice: String(h.averageCost || 0),
      assetType: h.assetType,
      sector: null,
      marketCap: null,
      beta: null,
      peRatio: null,
      dividendYield: null,
    }));

    // Create a virtual portfolio object
    const portfolio = {
      id: `unified-${clientId}`,
      userId: clientId,
      name: clientType.isProspect ? 'Prospect Portfolio' : 'Client Portfolio',
      isDefault: true,
      source: 'unified_holdings_reader',
    };

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

      const result = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      const text = result.text || "";
      
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
        stopLossPrice: String(pick.stopLossPrice),
        upsidePercent: String(pick.upsidePercent),
        downsidePercent: String(pick.downsidePercent),
        profitScore: pick.profitScore,
        confidenceLevel: pick.confidenceLevel,
        signalType: pick.signalType,
        signalStrength: pick.signalStrength,
        timeHorizon: pick.timeHorizon,
        timeHorizonDays: pick.timeHorizonDays,
        riskLevel: pick.riskLevel,
        riskScore: pick.riskScore,
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
    // Fetch listed stocks from database (synced from NSE/BSE)
    // This replaces the hardcoded stock list with actual published stocks
    const stockUniverse = await this.getStoreEligibleListedStocks({
      riskLevel: clientRiskProfile,
      limit: 30
    });

    console.log(`[AI Service] Fetched ${stockUniverse.length} listed stocks from database for risk profile: ${clientRiskProfile}`);

    // REGULATORY COMPLIANCE: Only recommend products that are published/enabled in store
    const mappedHorizon = options.timeHorizon ? this.mapTimeHorizon(options.timeHorizon) : null;
    
    // Determine category filter based on time horizon for mutual funds
    let mfCategory: string | undefined;
    if (mappedHorizon === 'ultra_short') {
      mfCategory = 'liquid'; // Includes Liquid, Money Market, Overnight, Ultra Short
    } else if (mappedHorizon === 'short') {
      mfCategory = 'short';
    } else if (mappedHorizon === 'long') {
      mfCategory = 'equity';
    }

    // Fetch all store-eligible products in parallel for efficiency
    const [
      storeEligibleFunds,
      storeEligibleAIFs,
      storeEligiblePMS,
      storeEligibleMLDs,
      storeEligibleUnlisted,
      storeEligibleBonds,
      storeEligibleNCDs
    ] = await Promise.all([
      this.getStoreEligibleMutualFunds({ category: mfCategory, riskLevel: options.riskLevel, limit: 10 }),
      this.getStoreEligibleAIF({ limit: 5 }),
      this.getStoreEligiblePMS({ limit: 5 }),
      this.getStoreEligibleMLD({ limit: 5 }),
      this.getStoreEligibleUnlistedStocks({ limit: 5 }),
      this.getStoreEligibleBonds({ limit: 5 }),
      this.getStoreEligibleNCDs({ limit: 5 })
    ]);

    // Combine all product types with stock recommendations
    // Each product type filters by store availability (published/active)
    let combinedUniverse = [
      ...stockUniverse,
      ...storeEligibleFunds,      // Mutual Funds (Regular plans only)
      ...storeEligibleAIFs,       // Alternative Investment Funds
      ...storeEligiblePMS,        // Portfolio Management Services
      ...storeEligibleMLDs,       // Market Linked Debentures
      ...storeEligibleUnlisted,   // Unlisted Stocks
      ...storeEligibleBonds,      // Corporate Bonds
      ...storeEligibleNCDs        // Non-Convertible Debentures
    ];
    
    let filteredStocks = combinedUniverse.filter(s => !options.existingHoldings.includes(s.symbol));

    if (mappedHorizon) {
      filteredStocks = filteredStocks.filter(s => s.timeHorizon === mappedHorizon);
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

  private mapTimeHorizon(frontendHorizon: string): string {
    const mapping: Record<string, string> = {
      ultra_short_term: 'ultra_short',
      short_term: 'short',
      medium_term: 'medium',
      long_term: 'long'
    };
    return mapping[frontendHorizon] || frontendHorizon;
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

    // EXIT CALL MONITORING: Individual holding target achievement and market dynamics
    const exitAlerts = await this.generateExitAlerts(clientId, holdings, portfolio.id);
    alerts.push(...exitAlerts);

    const insertedAlerts: PortfolioAlert[] = [];
    for (const alert of alerts) {
      const [inserted] = await db.insert(portfolioAlerts).values(alert).returning();
      insertedAlerts.push(inserted);
    }

    return insertedAlerts;
  }

  /**
   * COMPREHENSIVE PROFIT OPTIMIZATION ENGINE
   * AI-powered exit call system with 20+ criteria for maximum profit potential
   * Categories: Fundamental, Technical, Time-based, Portfolio-based, Market Signals, Insider Activity
   */
  private async generateExitAlerts(
    clientId: string, 
    holdings: PortfolioHolding[], 
    portfolioId: string
  ): Promise<InsertPortfolioAlert[]> {
    const exitAlerts: InsertPortfolioAlert[] = [];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;

    for (const holding of holdings) {
      if (!holding.symbol || holding.assetType?.toLowerCase() === 'cash') continue;

      try {
        const avgPrice = parseFloat(holding.avgPrice || '0');
        const quantity = parseFloat(holding.quantity || '0');
        if (avgPrice <= 0 || quantity <= 0) continue;

        const [stockData] = await db
          .select()
          .from(listedStocks)
          .where(eq(listedStocks.symbol, holding.symbol))
          .limit(1);

        if (!stockData) continue;

        const currentPrice = parseFloat(stockData.currentPrice || '0');
        const returns1Y = parseFloat(stockData.returns1Y || '0');
        const returns3Y = parseFloat(stockData.returns3Y || '0');
        const dayChange = parseFloat(stockData.dayChangePercent || '0');
        const high52Week = parseFloat(stockData.weekHigh52 || '0');
        const low52Week = parseFloat(stockData.weekLow52 || '0');
        const peRatio = parseFloat(stockData.peRatio || '0');
        const pbRatio = parseFloat(stockData.pbRatio || '0');
        const dividendYield = parseFloat(stockData.dividendYield || '0');
        const volume = parseFloat(stockData.averageVolume || '0');
        const avgVolume = parseFloat(stockData.averageVolume || '1');
        const beta = parseFloat(stockData.beta || '1');
        const marketCap = stockData.marketCap || 'Mid Cap';
        const sector = stockData.sector || 'Diversified';

        const holdingGainPercent = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 : 0;
        const holdingValue = currentPrice * quantity;
        const stopLossPrice = avgPrice * 0.85;
        const targetPrice = avgPrice * 1.20;

        // ═══════════════════════════════════════════════════════════════
        // 1. TARGET ACHIEVED EXIT ALERT (15%+ gain)
        // ═══════════════════════════════════════════════════════════════
        if (holdingGainPercent >= 15) {
          const severity = holdingGainPercent >= 30 ? 'high' : 'medium';
          exitAlerts.push({
            clientId, portfolioId,
            alertType: 'target_achieved',
            alertCategory: 'exit_call',
            severity,
            alertTitle: `🎯 Target Achieved: ${holding.symbol}`,
            alertMessage: `${holding.symbol} gained ${holdingGainPercent.toFixed(1)}%. Target: ₹${targetPrice.toFixed(0)}, Current: ₹${currentPrice.toFixed(0)}`,
            symbol: holding.symbol,
            currentWeight: String(holdingValue),
            triggerMetric: 'holding_return',
            triggerValue: String(holdingGainPercent.toFixed(2)),
            triggerThreshold: '15',
            triggerDirection: 'above',
            recommendedAction: 'sell',
            actionDescription: holdingGainPercent >= 25 
              ? `Strong gains! Sell 50-75% to lock profits. Trail stop-loss at ₹${(currentPrice * 0.92).toFixed(0)}`
              : `Book 25-50% profits. Set trailing stop-loss at ₹${(currentPrice * 0.90).toFixed(0)}`,
            aiInsight: `Current: ₹${currentPrice.toFixed(2)} | Cost: ₹${avgPrice.toFixed(2)} | Gain: ${holdingGainPercent.toFixed(1)}% | Recommended Stop-Loss: ₹${stopLossPrice.toFixed(0)}`,
            actionUrgency: holdingGainPercent >= 30 ? 'urgent' : 'recommended',
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 2. STOP LOSS ALERT (15%+ loss)
        // ═══════════════════════════════════════════════════════════════
        if (holdingGainPercent <= -15) {
          const severity = holdingGainPercent <= -25 ? 'critical' : 'high';
          exitAlerts.push({
            clientId, portfolioId,
            alertType: 'stop_loss',
            alertCategory: 'exit_call',
            severity,
            alertTitle: `⚠️ Stop Loss Triggered: ${holding.symbol}`,
            alertMessage: `${holding.symbol} down ${Math.abs(holdingGainPercent).toFixed(1)}% from ₹${avgPrice.toFixed(0)}`,
            symbol: holding.symbol,
            triggerMetric: 'holding_return',
            triggerValue: String(holdingGainPercent.toFixed(2)),
            triggerThreshold: '-15',
            triggerDirection: 'below',
            recommendedAction: holdingGainPercent <= -25 ? 'sell' : 'review',
            actionDescription: holdingGainPercent <= -25 
              ? `Exit position to prevent further losses. Redeploy capital to better opportunities.`
              : `Review thesis. Average down only if fundamentals intact, else exit.`,
            aiInsight: `Cost: ₹${avgPrice.toFixed(2)} | Current: ₹${currentPrice.toFixed(2)} | Loss: ${Math.abs(holdingGainPercent).toFixed(1)}%`,
            actionUrgency: 'urgent',
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 3. VALUATION STRETCH (P/E exceeds sector average)
        // ═══════════════════════════════════════════════════════════════
        const sectorPEAvg = this.getSectorAveragePE(sector);
        if (peRatio > 0 && peRatio > sectorPEAvg * 1.5) {
          exitAlerts.push({
            clientId, portfolioId,
            alertType: 'valuation_stretch',
            alertCategory: 'fundamental',
            severity: peRatio > sectorPEAvg * 2 ? 'high' : 'medium',
            alertTitle: `📊 Overvalued: ${holding.symbol}`,
            alertMessage: `P/E ${peRatio.toFixed(1)} is ${((peRatio / sectorPEAvg - 1) * 100).toFixed(0)}% above sector average (${sectorPEAvg.toFixed(1)})`,
            symbol: holding.symbol,
            triggerMetric: 'pe_ratio',
            triggerValue: String(peRatio.toFixed(2)),
            triggerThreshold: String(sectorPEAvg * 1.5),
            triggerDirection: 'above',
            recommendedAction: 'review',
            actionDescription: `Stock trading at premium valuation. Consider trimming if growth doesn't justify P/E.`,
            aiInsight: `P/E: ${peRatio.toFixed(1)} vs Sector: ${sectorPEAvg.toFixed(1)} | P/B: ${pbRatio.toFixed(2)} | Consider partial exit if no earnings catalyst.`,
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 4. DIVIDEND YIELD TRAP (High yield with poor momentum)
        // ═══════════════════════════════════════════════════════════════
        if (dividendYield > 6 && returns1Y < -15) {
          exitAlerts.push({
            clientId, portfolioId,
            alertType: 'dividend_trap',
            alertCategory: 'fundamental',
            severity: 'high',
            alertTitle: `⚠️ Dividend Trap Alert: ${holding.symbol}`,
            alertMessage: `High yield (${dividendYield.toFixed(1)}%) with poor price action (-${Math.abs(returns1Y).toFixed(1)}% 1Y) may signal trouble`,
            symbol: holding.symbol,
            triggerMetric: 'dividend_yield',
            triggerValue: String(dividendYield.toFixed(2)),
            triggerThreshold: '6',
            triggerDirection: 'above',
            recommendedAction: 'review',
            actionDescription: `High yield may indicate dividend cut risk. Verify payout ratio and earnings stability.`,
            aiInsight: `Yield: ${dividendYield.toFixed(1)}% | 1Y Return: ${returns1Y.toFixed(1)}% | Capital loss exceeds dividend income.`,
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 5. 52-WEEK HIGH BREAKOUT
        // ═══════════════════════════════════════════════════════════════
        if (high52Week > 0 && currentPrice >= high52Week * 0.98) {
          exitAlerts.push({
            clientId, portfolioId,
            alertType: '52_week_high',
            alertCategory: 'technical',
            severity: 'medium',
            alertTitle: `🚀 52-Week High: ${holding.symbol}`,
            alertMessage: `Trading at ₹${currentPrice.toFixed(0)}, near 52-week high of ₹${high52Week.toFixed(0)}`,
            symbol: holding.symbol,
            triggerMetric: '52w_high_proximity',
            triggerValue: String(currentPrice),
            triggerThreshold: String(high52Week * 0.98),
            triggerDirection: 'above',
            recommendedAction: holdingGainPercent > 20 ? 'sell' : 'hold',
            actionDescription: holdingGainPercent > 20 
              ? `Book profits at resistance. Set trailing stop at ₹${(currentPrice * 0.95).toFixed(0)}`
              : `Momentum strong. Hold with stop-loss at ₹${(currentPrice * 0.92).toFixed(0)}`,
            aiInsight: `52W High: ₹${high52Week.toFixed(0)} | 52W Low: ₹${low52Week.toFixed(0)} | Your Gain: ${holdingGainPercent.toFixed(1)}%`,
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 6. 52-WEEK LOW BREAKDOWN (Near 52-week low)
        // ═══════════════════════════════════════════════════════════════
        if (low52Week > 0 && currentPrice <= low52Week * 1.05) {
          exitAlerts.push({
            clientId, portfolioId,
            alertType: '52_week_low',
            alertCategory: 'technical',
            severity: 'high',
            alertTitle: `📉 52-Week Low Alert: ${holding.symbol}`,
            alertMessage: `Trading near 52-week low of ₹${low52Week.toFixed(0)}. Current: ₹${currentPrice.toFixed(0)}`,
            symbol: holding.symbol,
            triggerMetric: '52w_low_proximity',
            triggerValue: String(currentPrice),
            triggerThreshold: String(low52Week * 1.05),
            triggerDirection: 'below',
            recommendedAction: 'review',
            actionDescription: `Near 52-week low. Exit if downtrend continues or accumulate if fundamentals strong.`,
            aiInsight: `Potential value buy or falling knife. Verify: no debt issues, earnings intact, sector outlook positive.`,
            actionUrgency: 'recommended',
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 7. VOLUME SPIKE (Unusual selling pressure)
        // ═══════════════════════════════════════════════════════════════
        if (avgVolume > 0 && volume > avgVolume * 3 && dayChange < -2) {
          exitAlerts.push({
            clientId, portfolioId,
            alertType: 'volume_spike',
            alertCategory: 'technical',
            severity: 'high',
            alertTitle: `📊 Heavy Selling: ${holding.symbol}`,
            alertMessage: `Volume ${(volume / avgVolume).toFixed(1)}x normal with ${Math.abs(dayChange).toFixed(1)}% decline`,
            symbol: holding.symbol,
            triggerMetric: 'volume_ratio',
            triggerValue: String((volume / avgVolume).toFixed(2)),
            triggerThreshold: '3',
            triggerDirection: 'above',
            recommendedAction: 'review',
            actionDescription: `Institutional selling detected. Monitor closely for continued weakness.`,
            aiInsight: `Today's Volume: ${(volume / 100000).toFixed(1)}L | Average: ${(avgVolume / 100000).toFixed(1)}L | Ratio: ${(volume / avgVolume).toFixed(1)}x`,
            actionUrgency: 'urgent',
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 8. MOMENTUM REVERSAL
        // ═══════════════════════════════════════════════════════════════
        if (holdingGainPercent > 10 && returns1Y < -10) {
          exitAlerts.push({
            clientId, portfolioId,
            alertType: 'momentum_reversal',
            alertCategory: 'technical',
            severity: 'medium',
            alertTitle: `📉 Momentum Reversal: ${holding.symbol}`,
            alertMessage: `Your gain: +${holdingGainPercent.toFixed(1)}% but 1Y return: ${returns1Y.toFixed(1)}%`,
            symbol: holding.symbol,
            triggerMetric: 'momentum_1y',
            triggerValue: String(returns1Y.toFixed(2)),
            triggerThreshold: '-10',
            triggerDirection: 'below',
            recommendedAction: 'sell',
            actionDescription: `Lock profits before momentum fully reverses. Set stop-loss at ₹${(currentPrice * 0.95).toFixed(0)}`,
            aiInsight: `Your early entry worked well. Market sentiment has shifted. Protect gains by exiting 50% position.`,
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 9. SHARP DAILY DECLINE
        // ═══════════════════════════════════════════════════════════════
        if (dayChange <= -5) {
          exitAlerts.push({
            clientId, portfolioId,
            alertType: 'sharp_decline',
            alertCategory: 'technical',
            severity: dayChange <= -10 ? 'critical' : 'high',
            alertTitle: `🔴 Sharp Drop: ${holding.symbol}`,
            alertMessage: `Down ${Math.abs(dayChange).toFixed(1)}% today. Investigate immediately.`,
            symbol: holding.symbol,
            triggerMetric: 'day_change',
            triggerValue: String(dayChange.toFixed(2)),
            triggerThreshold: '-5',
            triggerDirection: 'below',
            recommendedAction: 'review',
            actionDescription: `Check for: earnings miss, management issues, sector selloff, or market panic.`,
            aiInsight: `Today's drop erased ₹${(Math.abs(dayChange) / 100 * holdingValue).toFixed(0)} from your position value.`,
            actionUrgency: 'urgent',
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 10. LTCG HOLDING PERIOD (Tax optimization)
        // ═══════════════════════════════════════════════════════════════
        // Note: This would need purchase date from holdings
        if (holdingGainPercent > 10 && currentMonth >= 1 && currentMonth <= 3) {
          exitAlerts.push({
            clientId, portfolioId,
            alertType: 'ltcg_optimization',
            alertCategory: 'tax',
            severity: 'low',
            alertTitle: `📅 Tax Planning: ${holding.symbol}`,
            alertMessage: `Review holding period for LTCG benefits (12+ months for 10% tax vs STCG 15%)`,
            symbol: holding.symbol,
            triggerMetric: 'tax_optimization',
            triggerValue: String(holdingGainPercent.toFixed(2)),
            triggerThreshold: '10',
            triggerDirection: 'above',
            recommendedAction: 'review',
            actionDescription: `If held > 1 year, LTCG tax is 10% above ₹1L. If < 1 year, wait if profitable or book STCG for tax purposes.`,
            aiInsight: `Gain: ${holdingGainPercent.toFixed(1)}% | Value: ₹${holdingValue.toFixed(0)} | Verify holding period for tax efficiency.`,
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 11. TAX-LOSS HARVESTING (Before March end)
        // ═══════════════════════════════════════════════════════════════
        if (holdingGainPercent < -5 && currentMonth >= 1 && currentMonth <= 3) {
          exitAlerts.push({
            clientId, portfolioId,
            alertType: 'tax_loss_harvest',
            alertCategory: 'tax',
            severity: 'medium',
            alertTitle: `💰 Tax-Loss Harvest: ${holding.symbol}`,
            alertMessage: `Book ₹${Math.abs(holdingGainPercent / 100 * holdingValue).toFixed(0)} loss before March 31 to offset capital gains`,
            symbol: holding.symbol,
            triggerMetric: 'tax_loss_harvest',
            triggerValue: String(holdingGainPercent.toFixed(2)),
            triggerThreshold: '-5',
            triggerDirection: 'below',
            recommendedAction: 'sell',
            actionDescription: `Sell to book loss, wait 30 days, repurchase if still bullish on fundamentals.`,
            aiInsight: `Loss: ${Math.abs(holdingGainPercent).toFixed(1)}% | Can offset gains and save up to 15% tax on equivalent profits.`,
            actionUrgency: currentMonth === 3 ? 'urgent' : 'recommended',
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 12. HIGH BETA RISK (Portfolio volatility)
        // ═══════════════════════════════════════════════════════════════
        if (beta > 1.5) {
          exitAlerts.push({
            clientId, portfolioId,
            alertType: 'high_beta',
            alertCategory: 'portfolio_risk',
            severity: beta > 2 ? 'high' : 'medium',
            alertTitle: `⚡ High Volatility: ${holding.symbol}`,
            alertMessage: `Beta ${beta.toFixed(2)} means ${((beta - 1) * 100).toFixed(0)}% more volatile than market`,
            symbol: holding.symbol,
            triggerMetric: 'beta',
            triggerValue: String(beta.toFixed(2)),
            triggerThreshold: '1.5',
            triggerDirection: 'above',
            recommendedAction: 'review',
            actionDescription: `High beta amplifies both gains and losses. Reduce exposure if risk tolerance is conservative.`,
            aiInsight: `Beta: ${beta.toFixed(2)} | If Nifty drops 10%, expect ${(beta * 10).toFixed(0)}% drop in this stock.`,
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 13. SECTOR ROTATION SIGNAL
        // ═══════════════════════════════════════════════════════════════
        const weakSectors = ['Real Estate', 'Metals', 'PSU Banks'];
        if (sector && weakSectors.some(ws => sector.toLowerCase().includes(ws.toLowerCase())) && returns1Y < 0) {
          exitAlerts.push({
            clientId, portfolioId,
            alertType: 'sector_rotation',
            alertCategory: 'market_signal',
            severity: 'medium',
            alertTitle: `🔄 Sector Weakness: ${holding.symbol}`,
            alertMessage: `${sector} sector showing weakness. Consider rotating to stronger sectors.`,
            symbol: holding.symbol,
            triggerMetric: 'sector_trend',
            triggerValue: String(returns1Y.toFixed(2)),
            triggerThreshold: '0',
            triggerDirection: 'below',
            recommendedAction: 'review',
            actionDescription: `Sector underperforming. Evaluate switching to IT, Pharma, or FMCG if bullish on defensives.`,
            aiInsight: `${sector} 1Y Return: ${returns1Y.toFixed(1)}% | Consider sector ETF or stronger peers.`,
            status: 'active'
          });
        }

        // ═══════════════════════════════════════════════════════════════
        // 14. BETTER OPPORTUNITY (Higher-rated alternative)
        // ═══════════════════════════════════════════════════════════════
        if (holdingGainPercent < 5 && holdingGainPercent > -10) {
          const betterAlternatives = await this.findBetterAlternatives(holding.symbol, sector);
          if (betterAlternatives.length > 0) {
            const best = betterAlternatives[0];
            exitAlerts.push({
              clientId, portfolioId,
              alertType: 'better_opportunity',
              alertCategory: 'opportunity',
              severity: 'low',
              alertTitle: `💡 Better Alternative: ${best.symbol}`,
              alertMessage: `${best.symbol} in same sector has higher profit score (${best.profitScore} vs your holding)`,
              symbol: holding.symbol,
              triggerMetric: 'opportunity_cost',
              triggerValue: String(holdingGainPercent.toFixed(2)),
              triggerThreshold: '5',
              triggerDirection: 'below',
              recommendedAction: 'review',
              actionDescription: `Consider switching from ${holding.symbol} to ${best.symbol} for potentially higher returns.`,
              aiInsight: `Alternative: ${best.symbol} | Upside: ${best.upsidePercent.toFixed(1)}% | Score: ${best.profitScore}`,
              status: 'active'
            });
          }
        }

      } catch (error) {
        console.error(`[AI Profit Engine] Error analyzing ${holding.symbol}:`, error);
      }
    }

    console.log(`[AI Profit Engine] Generated ${exitAlerts.length} profit optimization alerts for ${holdings.length} holdings`);
    return exitAlerts;
  }

  private getSectorAveragePE(sector: string): number {
    const sectorPE: Record<string, number> = {
      'banking': 15, 'banks': 15, 'financial services': 18,
      'it': 25, 'technology': 25, 'information technology': 25,
      'pharma': 22, 'healthcare': 22, 'pharmaceuticals': 22,
      'fmcg': 35, 'consumer goods': 35,
      'auto': 18, 'automobile': 18, 'automotive': 18,
      'energy': 12, 'oil & gas': 12, 'power': 14,
      'metals': 10, 'mining': 10, 'steel': 10,
      'realty': 20, 'real estate': 20,
      'telecom': 25, 'telecommunications': 25,
      'cement': 18, 'construction': 16,
      'chemicals': 20, 'fertilizers': 15,
      'insurance': 20, 'nbfc': 18
    };
    const normalizedSector = sector.toLowerCase();
    for (const [key, pe] of Object.entries(sectorPE)) {
      if (normalizedSector.includes(key)) return pe;
    }
    return 20;
  }

  private async findBetterAlternatives(currentSymbol: string, sector: string): Promise<Array<{symbol: string; profitScore: number; upsidePercent: number}>> {
    try {
      const alternatives = await db
        .select({
          symbol: listedStocks.symbol,
          returns1Y: listedStocks.returns1Y,
          marketCap: listedStocks.marketCap
        })
        .from(listedStocks)
        .where(and(
          eq(listedStocks.isPublished, true),
          ilike(listedStocks.sector, `%${sector}%`)
        ))
        .limit(10);

      return alternatives
        .filter(alt => alt.symbol !== currentSymbol)
        .map(alt => ({
          symbol: alt.symbol,
          profitScore: Math.min(95, 70 + parseFloat(alt.returns1Y || '0') * 0.5),
          upsidePercent: Math.max(5, parseFloat(alt.returns1Y || '0') * 0.3 + 10)
        }))
        .sort((a, b) => b.profitScore - a.profitScore)
        .slice(0, 3);
    } catch {
      return [];
    }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * UNIFIED PROFIT OPTIMIZATION SCORING ENGINE
   * Combines 20+ criteria into a single profit optimization score (0-100)
   * Categories: Fundamental (30%), Technical (25%), Momentum (20%), Risk (15%), Tax (10%)
   * ═══════════════════════════════════════════════════════════════════════════
   */
  calculateUnifiedProfitScore(stock: {
    currentPrice: number;
    avgPrice?: number;
    targetPrice?: number;
    returns1Y: number;
    returns3Y?: number;
    dayChangePercent: number;
    peRatio?: number;
    pbRatio?: number;
    dividendYield?: number;
    beta?: number;
    high52Week?: number;
    low52Week?: number;
    volume?: number;
    avgVolume?: number;
    marketCap?: string;
    sector?: string;
    holdingPeriodDays?: number;
  }): {
    totalScore: number;
    fundamentalScore: number;
    technicalScore: number;
    momentumScore: number;
    riskScore: number;
    taxEfficiencyScore: number;
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    keyInsights: string[];
    urgentActions: string[];
  } {
    const insights: string[] = [];
    const urgentActions: string[] = [];

    // ═══════════════════════════════════════════════════════════════
    // 1. FUNDAMENTAL SCORE (30% weight) - Value & Quality
    // ═══════════════════════════════════════════════════════════════
    let fundamentalScore = 50;
    
    // P/E Valuation (max ±15 points)
    if (stock.peRatio && stock.peRatio > 0) {
      const sectorPE = this.getSectorAveragePE(stock.sector || 'Diversified');
      const peDeviation = (stock.peRatio - sectorPE) / sectorPE;
      if (peDeviation < -0.2) {
        fundamentalScore += 15;
        insights.push(`Undervalued: P/E ${stock.peRatio.toFixed(1)} vs sector avg ${sectorPE.toFixed(1)}`);
      } else if (peDeviation > 0.5) {
        fundamentalScore -= 15;
        insights.push(`Overvalued: P/E ${stock.peRatio.toFixed(1)} is ${((peDeviation) * 100).toFixed(0)}% above sector`);
      } else if (peDeviation < 0.2) {
        fundamentalScore += 8;
      }
    }

    // P/B Ratio (max ±10 points)
    if (stock.pbRatio && stock.pbRatio > 0) {
      if (stock.pbRatio < 1) {
        fundamentalScore += 10;
        insights.push(`Asset discount: Trading below book value (P/B: ${stock.pbRatio.toFixed(2)})`);
      } else if (stock.pbRatio > 5) {
        fundamentalScore -= 10;
      }
    }

    // Dividend Yield Quality (max ±10 points)
    if (stock.dividendYield && stock.dividendYield > 0) {
      if (stock.dividendYield > 3 && stock.dividendYield < 8 && stock.returns1Y > -10) {
        fundamentalScore += 10;
        insights.push(`Healthy dividend yield: ${stock.dividendYield.toFixed(1)}%`);
      } else if (stock.dividendYield > 8 && stock.returns1Y < -15) {
        fundamentalScore -= 10;
        urgentActions.push(`Dividend trap warning: ${stock.dividendYield.toFixed(1)}% yield with poor price action`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. TECHNICAL SCORE (25% weight) - Price Action & Levels
    // ═══════════════════════════════════════════════════════════════
    let technicalScore = 50;

    // 52-Week Position (max ±15 points)
    if (stock.high52Week && stock.low52Week && stock.currentPrice > 0) {
      const range = stock.high52Week - stock.low52Week;
      const position = (stock.currentPrice - stock.low52Week) / range;
      
      if (position > 0.95) {
        technicalScore += 15;
        insights.push(`Near 52-week high: Strong momentum`);
      } else if (position < 0.1) {
        technicalScore -= 10;
        urgentActions.push(`Near 52-week low: Review fundamentals before averaging`);
      } else if (position > 0.7) {
        technicalScore += 8;
      }
    }

    // Volume Analysis (max ±10 points)
    if (stock.volume && stock.avgVolume && stock.avgVolume > 0) {
      const volumeRatio = stock.volume / stock.avgVolume;
      if (volumeRatio > 3 && stock.dayChangePercent < -2) {
        technicalScore -= 10;
        urgentActions.push(`Heavy selling: Volume ${volumeRatio.toFixed(1)}x normal with price decline`);
      } else if (volumeRatio > 2 && stock.dayChangePercent > 2) {
        technicalScore += 10;
        insights.push(`Accumulation: High volume with price gain`);
      }
    }

    // Daily Change Impact (max ±10 points)
    if (stock.dayChangePercent <= -5) {
      technicalScore -= 10;
      urgentActions.push(`Sharp decline: ${Math.abs(stock.dayChangePercent).toFixed(1)}% drop today`);
    } else if (stock.dayChangePercent >= 3) {
      technicalScore += 5;
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. MOMENTUM SCORE (20% weight) - Return Trends
    // ═══════════════════════════════════════════════════════════════
    let momentumScore = 50;

    // 1Y Returns (max ±20 points)
    if (stock.returns1Y > 30) {
      momentumScore += 20;
      insights.push(`Strong momentum: ${stock.returns1Y.toFixed(1)}% 1Y returns`);
    } else if (stock.returns1Y > 15) {
      momentumScore += 12;
    } else if (stock.returns1Y > 0) {
      momentumScore += 5;
    } else if (stock.returns1Y < -20) {
      momentumScore -= 15;
    } else if (stock.returns1Y < -10) {
      momentumScore -= 8;
    }

    // 3Y Returns trend (max ±10 points)
    if (stock.returns3Y) {
      const annualized3Y = stock.returns3Y / 3;
      if (annualized3Y > 15) {
        momentumScore += 10;
      } else if (annualized3Y < 0) {
        momentumScore -= 5;
      }
    }

    // Holding Return Analysis (if applicable)
    if (stock.avgPrice && stock.avgPrice > 0) {
      const holdingReturn = ((stock.currentPrice - stock.avgPrice) / stock.avgPrice) * 100;
      if (holdingReturn >= 25) {
        urgentActions.push(`Target achieved: ${holdingReturn.toFixed(1)}% gain - consider partial profit booking`);
      } else if (holdingReturn <= -15) {
        urgentActions.push(`Stop loss zone: ${holdingReturn.toFixed(1)}% loss - review thesis`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 4. RISK SCORE (15% weight) - Volatility & Safety
    // ═══════════════════════════════════════════════════════════════
    let riskScore = 60;

    // Beta Analysis (max ±15 points)
    const beta = stock.beta || 1;
    if (beta > 1.5) {
      riskScore -= 15;
      insights.push(`High volatility: Beta ${beta.toFixed(2)}`);
    } else if (beta < 0.8) {
      riskScore += 10;
      insights.push(`Low volatility: Defensive stock (Beta ${beta.toFixed(2)})`);
    }

    // Market Cap Safety (max ±10 points)
    if (stock.marketCap === 'Large Cap') {
      riskScore += 10;
    } else if (stock.marketCap === 'Small Cap') {
      riskScore -= 10;
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. TAX EFFICIENCY SCORE (10% weight) - LTCG/STCG Optimization
    // ═══════════════════════════════════════════════════════════════
    let taxEfficiencyScore = 50;
    const currentMonth = new Date().getMonth() + 1;

    if (stock.holdingPeriodDays) {
      if (stock.holdingPeriodDays >= 365) {
        taxEfficiencyScore += 25;
        insights.push(`LTCG eligible: 10% tax on gains above ₹1L`);
      } else if (stock.holdingPeriodDays >= 330 && stock.holdingPeriodDays < 365) {
        taxEfficiencyScore += 15;
        insights.push(`Near LTCG: ${365 - stock.holdingPeriodDays} days to qualify`);
      }
    }

    // Tax-Loss Harvesting Window
    if (currentMonth >= 1 && currentMonth <= 3 && stock.avgPrice && stock.currentPrice < stock.avgPrice) {
      const loss = ((stock.avgPrice - stock.currentPrice) / stock.avgPrice) * 100;
      if (loss > 5) {
        taxEfficiencyScore += 20;
        urgentActions.push(`Tax-loss harvest: Book ${loss.toFixed(1)}% loss before March 31`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CALCULATE WEIGHTED TOTAL SCORE
    // ═══════════════════════════════════════════════════════════════
    const weightedScore = 
      fundamentalScore * 0.30 +
      technicalScore * 0.25 +
      momentumScore * 0.20 +
      riskScore * 0.15 +
      taxEfficiencyScore * 0.10;

    const totalScore = Math.min(100, Math.max(0, Math.round(weightedScore)));

    // Determine recommendation
    let recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
    if (totalScore >= 80) {
      recommendation = 'strong_buy';
    } else if (totalScore >= 65) {
      recommendation = 'buy';
    } else if (totalScore >= 45) {
      recommendation = 'hold';
    } else if (totalScore >= 30) {
      recommendation = 'sell';
    } else {
      recommendation = 'strong_sell';
    }

    return {
      totalScore,
      fundamentalScore: Math.min(100, Math.max(0, fundamentalScore)),
      technicalScore: Math.min(100, Math.max(0, technicalScore)),
      momentumScore: Math.min(100, Math.max(0, momentumScore)),
      riskScore: Math.min(100, Math.max(0, riskScore)),
      taxEfficiencyScore: Math.min(100, Math.max(0, taxEfficiencyScore)),
      recommendation,
      keyInsights: insights.slice(0, 5),
      urgentActions: urgentActions.slice(0, 3)
    };
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

  private normalizeRiskLevel(riskLevel?: string): string {
    if (!riskLevel) return 'moderate';
    const normalized = riskLevel.toLowerCase().trim();
    const riskMap: Record<string, string> = {
      'low': 'conservative',
      'very_low': 'conservative',
      'very low': 'conservative',
      'conservative': 'conservative',
      'medium': 'moderate',
      'moderate': 'moderate',
      'balanced': 'moderate',
      'high': 'aggressive',
      'aggressive': 'aggressive',
      'very_high': 'very_aggressive',
      'very high': 'very_aggressive',
      'very_aggressive': 'very_aggressive'
    };
    return riskMap[normalized] || 'moderate';
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
