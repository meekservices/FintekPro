import { db } from "../db";
import { dailyPicks, listedStocks, mutualFunds, bondCatalog, unlistedCompanies, globalInstruments } from "@shared/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

export type PickCategory = 
  | 'listed_stocks' 
  | 'mutual_funds' 
  | 'bonds' 
  | 'unlisted' 
  | 'global_stocks' 
  | 'etfs' 
  | 'reits_invits' 
  | 'fixed_deposits' 
  | 'sgb';

export type PickStatus = 'live' | 'target_hit' | 'stoploss_hit' | 'expired';

export interface DailyPickData {
  id?: number;
  category: PickCategory;
  instrumentId?: string;
  instrumentName: string;
  isin?: string;
  symbol?: string;
  market?: string;
  recoDate: string;
  recoPrice: number;
  targetPrice: number;
  stoplossPrice: number;
  currentPrice?: number;
  status: PickStatus;
  expiryDate: string;
  returnPct?: number;
  daysHeld?: number;
  rationale: string;
  riskLevel: string;
  suitableFor: string[];
  keyMetrics?: Record<string, any>;
}

interface StockCandidate {
  id: string;
  symbol: string;
  name: string;
  isin?: string;
  currentPrice: number;
  sector?: string;
  peRatio?: number;
  returns1Y?: number;
  returns3Y?: number;
  fintekproRating?: number;
  volatility?: number;
  marketCap?: string;
}

class PickOfTheDayService {
  private genAI: GoogleGenAI | null = null;
  private readonly DEFAULT_VALIDITY_DAYS = 30;
  private readonly STOCK_TARGET_PCT = 0.15; // 15% target
  private readonly STOCK_STOPLOSS_PCT = 0.08; // 8% stoploss
  private readonly MF_TARGET_PCT = 0.12; // 12% target for MFs
  private readonly MF_STOPLOSS_PCT = 0.05; // 5% stoploss for MFs
  private readonly BOND_TARGET_PCT = 0.08; // 8% target for bonds
  private readonly BOND_STOPLOSS_PCT = 0.03; // 3% stoploss for bonds

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.genAI = new GoogleGenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    console.log("✅ Pick of the Day Service initialized");
  }

  async getTodaysPicks(): Promise<DailyPickData[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const picks = await db
      .select()
      .from(dailyPicks)
      .where(eq(dailyPicks.recoDate, today))
      .orderBy(dailyPicks.category);
    
    return picks.map(this.transformPick);
  }

  async getLivePicks(): Promise<DailyPickData[]> {
    const picks = await db
      .select()
      .from(dailyPicks)
      .where(eq(dailyPicks.status, 'live'))
      .orderBy(desc(dailyPicks.recoDate));
    
    return picks.map(this.transformPick);
  }

  async getPickHistory(category?: PickCategory, limit = 50): Promise<DailyPickData[]> {
    let query = db.select().from(dailyPicks);
    
    if (category) {
      query = query.where(eq(dailyPicks.category, category)) as any;
    }
    
    const picks = await query
      .orderBy(desc(dailyPicks.recoDate))
      .limit(limit);
    
    return picks.map(this.transformPick);
  }

  async getPerformanceStats(): Promise<{
    totalPicks: number;
    livePicks: number;
    targetHits: number;
    stoplossHits: number;
    expired: number;
    hitRate: number;
    avgReturn: number;
    byCategory: Record<string, { total: number; hits: number; hitRate: number }>;
  }> {
    const allPicks = await db.select().from(dailyPicks);
    
    const stats = {
      totalPicks: allPicks.length,
      livePicks: 0,
      targetHits: 0,
      stoplossHits: 0,
      expired: 0,
      hitRate: 0,
      avgReturn: 0,
      byCategory: {} as Record<string, { total: number; hits: number; hitRate: number }>,
    };

    let totalReturn = 0;
    let closedPicks = 0;

    for (const pick of allPicks) {
      const category = pick.category;
      if (!stats.byCategory[category]) {
        stats.byCategory[category] = { total: 0, hits: 0, hitRate: 0 };
      }
      stats.byCategory[category].total++;

      switch (pick.status) {
        case 'live':
          stats.livePicks++;
          break;
        case 'target_hit':
          stats.targetHits++;
          stats.byCategory[category].hits++;
          closedPicks++;
          if (pick.returnPct) totalReturn += parseFloat(pick.returnPct);
          break;
        case 'stoploss_hit':
          stats.stoplossHits++;
          closedPicks++;
          if (pick.returnPct) totalReturn += parseFloat(pick.returnPct);
          break;
        case 'expired':
          stats.expired++;
          closedPicks++;
          if (pick.returnPct) totalReturn += parseFloat(pick.returnPct);
          break;
      }
    }

    stats.hitRate = stats.targetHits > 0 ? 
      Math.round((stats.targetHits / (stats.targetHits + stats.stoplossHits + stats.expired)) * 100) : 0;
    stats.avgReturn = closedPicks > 0 ? Math.round((totalReturn / closedPicks) * 100) / 100 : 0;

    for (const cat in stats.byCategory) {
      const catStats = stats.byCategory[cat];
      catStats.hitRate = catStats.total > 0 ? 
        Math.round((catStats.hits / catStats.total) * 100) : 0;
    }

    return stats;
  }

  async generateDailyPicks(): Promise<DailyPickData[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const existingPicks = await db
      .select()
      .from(dailyPicks)
      .where(eq(dailyPicks.recoDate, today));
    
    if (existingPicks.length > 0) {
      console.log(`[PickOfTheDay] Picks already exist for ${today}`);
      return existingPicks.map(this.transformPick);
    }

    const picks: DailyPickData[] = [];

    const stockPick = await this.generateStockPick();
    if (stockPick) picks.push(stockPick);

    const mfPick = await this.generateMutualFundPick();
    if (mfPick) picks.push(mfPick);

    const bondPick = await this.generateBondPick();
    if (bondPick) picks.push(bondPick);

    const unlistedPick = await this.generateUnlistedPick();

    const globalStockPick = await this.generateGlobalStockPick();
    if (globalStockPick) picks.push(globalStockPick);
    if (unlistedPick) picks.push(unlistedPick);

    for (const pick of picks) {
      await this.savePick(pick);
    }

    console.log(`✅ [PickOfTheDay] Generated ${picks.length} picks for ${today}`);
    return picks;
  }

  private async generateStockPick(): Promise<DailyPickData | null> {
    try {
      const stocks = await db
        .select()
        .from(listedStocks)
        .where(
          and(
            eq(listedStocks.isPublished, true),
            sql`${listedStocks.currentPrice} IS NOT NULL`,
            sql`CAST(${listedStocks.currentPrice} AS DECIMAL) > 50`
          )
        )
        .limit(100);

      if (stocks.length === 0) {
        console.log("[PickOfTheDay] No suitable stocks found");
        return null;
      }

      const scoredStocks = stocks.map(stock => ({
        stock,
        score: this.scoreStock(stock),
      })).sort((a, b) => b.score - a.score);

      const topStock = scoredStocks[0].stock;
      const currentPrice = parseFloat(topStock.currentPrice || "0");
      const targetPrice = Math.round(currentPrice * (1 + this.STOCK_TARGET_PCT) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - this.STOCK_STOPLOSS_PCT) * 100) / 100;

      const rationale = await this.generateRationale({
        category: 'listed_stocks',
        name: topStock.companyName || topStock.symbol,
        symbol: topStock.symbol,
        sector: topStock.sector,
        currentPrice,
        targetPrice,
        stoplossPrice,
        peRatio: topStock.peRatio ? parseFloat(topStock.peRatio) : undefined,
        returns1Y: topStock.returns1Y ? parseFloat(topStock.returns1Y) : undefined,
        analystRating: topStock.analystRating,
      });

      return {
        category: 'listed_stocks',
        instrumentId: topStock.id,
        instrumentName: topStock.companyName || topStock.symbol,
        isin: topStock.isin || undefined,
        symbol: topStock.symbol,
        recoDate: new Date().toISOString().split('T')[0],
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(this.DEFAULT_VALIDITY_DAYS),
        rationale,
        riskLevel: this.getRiskLevel(topStock.volatility ? parseFloat(topStock.volatility) : 20),
        suitableFor: ['Balanced', 'Aggressive'],
        keyMetrics: {
          pe: topStock.peRatio ? parseFloat(topStock.peRatio) : null,
          returns1y: topStock.returns1Y ? parseFloat(topStock.returns1Y) : null,
          analystRating: topStock.analystRating,
          sector: topStock.sector,
          marketCap: topStock.marketCap,
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating stock pick:", error);
      return null;
    }
  }

  private async generateMutualFundPick(): Promise<DailyPickData | null> {
    try {
      const funds = await db
        .select()
        .from(mutualFunds)
        .where(
          and(
            eq(mutualFunds.isPublished, true),
            sql`${mutualFunds.nav} IS NOT NULL`
          )
        )
        .limit(100);

      if (funds.length === 0) {
        console.log("[PickOfTheDay] No suitable mutual funds found");
        return null;
      }

      const scoredFunds = funds.map(fund => ({
        fund,
        score: this.scoreMutualFund(fund),
      })).sort((a, b) => b.score - a.score);

      const topFund = scoredFunds[0].fund;
      const currentNav = parseFloat(topFund.nav || "0");
      const targetNav = Math.round(currentNav * (1 + this.MF_TARGET_PCT) * 100) / 100;
      const stoplossNav = Math.round(currentNav * (1 - this.MF_STOPLOSS_PCT) * 100) / 100;

      const rationale = await this.generateRationale({
        category: 'mutual_funds',
        name: topFund.schemeName,
        fundHouse: topFund.fundHouse,
        category2: topFund.category,
        currentPrice: currentNav,
        targetPrice: targetNav,
        stoplossPrice: stoplossNav,
        returns1Y: topFund.returns1Y ? parseFloat(topFund.returns1Y) : undefined,
        returns3Y: topFund.returns3Y ? parseFloat(topFund.returns3Y) : undefined,
        crisilRating: topFund.crisilRating,
        expenseRatio: topFund.expenseRatio ? parseFloat(topFund.expenseRatio) : undefined,
      });

      return {
        category: 'mutual_funds',
        instrumentId: topFund.schemeCode,
        instrumentName: topFund.schemeName,
        isin: topFund.isin || undefined,
        symbol: topFund.schemeCode,
        recoDate: new Date().toISOString().split('T')[0],
        recoPrice: currentNav,
        targetPrice: targetNav,
        stoplossPrice: stoplossNav,
        currentPrice: currentNav,
        status: 'live',
        expiryDate: this.getExpiryDate(90),
        rationale,
        riskLevel: topFund.riskLevel || 'medium',
        suitableFor: ['Conservative', 'Balanced'],
        keyMetrics: {
          returns1y: topFund.returns1Y ? parseFloat(topFund.returns1Y) : null,
          returns3y: topFund.returns3Y ? parseFloat(topFund.returns3Y) : null,
          crisilRating: topFund.crisilRating,
          fundHouse: topFund.fundHouse,
          category: topFund.category,
          expenseRatio: topFund.expenseRatio ? parseFloat(topFund.expenseRatio) : null,
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating MF pick:", error);
      return null;
    }
  }

  private async generateBondPick(): Promise<DailyPickData | null> {
    try {
      const bonds = await db
        .select()
        .from(bondCatalog)
        .where(
          and(
            eq(bondCatalog.status, 'active'),
            sql`${bondCatalog.cleanPrice} IS NOT NULL`
          )
        )
        .orderBy(desc(bondCatalog.yieldToMaturity))
        .limit(20);

      if (bonds.length === 0) {
        console.log("[PickOfTheDay] No suitable bonds found");
        return null;
      }

      const scoredBonds = bonds.map(bond => ({
        bond,
        score: this.scoreBond(bond),
      })).sort((a, b) => b.score - a.score);

      const topBond = scoredBonds[0].bond;
      const currentPrice = parseFloat(topBond.cleanPrice || "100");
      const targetPrice = Math.round(currentPrice * (1 + this.BOND_TARGET_PCT) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - this.BOND_STOPLOSS_PCT) * 100) / 100;

      const rationale = await this.generateRationale({
        category: 'bonds',
        name: topBond.bondName,
        issuer: topBond.issuerName,
        currentPrice,
        targetPrice,
        stoplossPrice,
        yield: topBond.yieldToMaturity ? parseFloat(topBond.yieldToMaturity) : undefined,
        couponRate: topBond.couponRate ? parseFloat(topBond.couponRate) : undefined,
        creditRating: topBond.creditRating,
        maturityDate: topBond.maturityDate,
      });

      return {
        category: 'bonds',
        instrumentId: topBond.id?.toString(),
        instrumentName: topBond.bondName,
        isin: topBond.isin || undefined,
        recoDate: new Date().toISOString().split('T')[0],
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(180),
        rationale,
        riskLevel: 'low',
        suitableFor: ['Conservative', 'Balanced'],
        keyMetrics: {
          yield: topBond.yieldToMaturity ? parseFloat(topBond.yieldToMaturity) : null,
          couponRate: topBond.couponRate ? parseFloat(topBond.couponRate) : null,
          creditRating: topBond.creditRating,
          issuer: topBond.issuerName,
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating bond pick:", error);
      return null;
    }
  }

  private async generateUnlistedPick(): Promise<DailyPickData | null> {
    try {
      const companies = await db
        .select()
        .from(unlistedCompanies)
        .where(
          and(
            eq(unlistedCompanies.isActive, true),
            sql`${unlistedCompanies.lastPrice} IS NOT NULL`
          )
        )
        .orderBy(desc(unlistedCompanies.priceChangePercent))
        .limit(20);

      if (companies.length === 0) {
        console.log("[PickOfTheDay] No suitable unlisted companies found");
        return null;
      }

      const scoredCompanies = companies.map(company => ({
        company,
        score: this.scoreUnlisted(company),
      })).sort((a, b) => b.score - a.score);

      const topCompany = scoredCompanies[0].company;
      const currentPrice = parseFloat(topCompany.lastPrice || "0");
      const targetPrice = Math.round(currentPrice * 1.25 * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * 0.85 * 100) / 100;

      const rationale = await this.generateRationale({
        category: 'unlisted',
        name: topCompany.companyName,
        sector: topCompany.sector,
        currentPrice,
        targetPrice,
        stoplossPrice,
        ipoStatus: topCompany.expectedListingDate ? 'IPO Expected' : undefined,
      });

      return {
        category: 'unlisted',
        instrumentId: topCompany.id,
        instrumentName: topCompany.companyName,
        isin: topCompany.isin || undefined,
        recoDate: new Date().toISOString().split('T')[0],
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(365),
        rationale,
        riskLevel: 'high',
        suitableFor: ['Aggressive'],
        keyMetrics: {
          sector: topCompany.sector,
          ipoExpected: topCompany.expectedListingDate,
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating unlisted pick:", error);
      return null;
    }
  }

  private mapMarketCode(market: string): string {
    const marketMap: Record<string, string> = {
      "US": "us",
      "UK": "uk_europe",
      "EU": "uk_europe",
      "DE": "uk_europe",
      "FR": "uk_europe",
      "JP": "japan",
      "HK": "china",
      "CN": "china",
      "SG": "other",
      "AU": "other",
      "IN": "other",
    };
    return marketMap[market?.toUpperCase()] || "other";
  }

  private scoreGlobalStock(instrument: any): number {
    let score = 0;
    
    const returns1Y = instrument.returns1Y ? parseFloat(instrument.returns1Y) : 0;
    if (returns1Y > 30) score += 25;
    else if (returns1Y > 15) score += 18;
    else if (returns1Y > 0) score += 10;
    
    const pe = instrument.peRatio ? parseFloat(instrument.peRatio) : 0;
    if (pe > 0 && pe < 15) score += 15;
    else if (pe >= 15 && pe < 25) score += 10;
    else if (pe >= 25 && pe < 40) score += 5;
    
    const marketCap = parseFloat(instrument.marketCap || "0");
    if (marketCap > 100000000000) score += 15;
    else if (marketCap > 10000000000) score += 10;
    else if (marketCap > 1000000000) score += 5;
    
    const epsGrowth = parseFloat(instrument.epsGrowth || "0");
    if (epsGrowth > 20) score += 10;
    else if (epsGrowth > 10) score += 5;
    
    return score;
  }

  private async generateGlobalStockPick(): Promise<DailyPickData | null> {
    try {
      const instruments = await db
        .select()
        .from(globalInstruments)
        .where(
          and(
            eq(globalInstruments.assetClass, "stock"),
            eq(globalInstruments.isActive, true),
            sql`${globalInstruments.lastPrice} IS NOT NULL`
          )
        )
        .limit(30);

      if (instruments.length === 0) {
        console.log("[PickOfTheDay] No global stocks found in database");
        return null;
      }

      const scoredInstruments = instruments.map(inst => ({
        instrument: inst,
        score: this.scoreGlobalStock(inst),
      })).sort((a, b) => b.score - a.score);

      const topInstrument = scoredInstruments[0].instrument;
      const currentPrice = parseFloat(topInstrument.lastPrice || "0");
      const targetPrice = Math.round(currentPrice * (1 + this.STOCK_TARGET_PCT) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - this.STOCK_STOPLOSS_PCT) * 100) / 100;
      const market = this.mapMarketCode(topInstrument.market);

      const rationale = await this.generateRationale({
        category: "global_stocks",
        name: topInstrument.name,
        symbol: topInstrument.symbol,
        sector: topInstrument.sector,
        currentPrice,
        targetPrice,
        stoplossPrice,
        returns1Y: topInstrument.returns1Y ? parseFloat(topInstrument.returns1Y) : undefined,
        peRatio: topInstrument.peRatio ? parseFloat(topInstrument.peRatio) : undefined,
      });

      console.log(`[PickOfTheDay] Generated global stock pick: ${topInstrument.symbol} (${market})`);

      return {
        category: "global_stocks",
        instrumentId: topInstrument.id,
        instrumentName: topInstrument.name,
        isin: topInstrument.isin || undefined,
        symbol: topInstrument.symbol,
        market,
        recoDate: new Date().toISOString().split("T")[0],
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: "live",
        expiryDate: this.getExpiryDate(this.DEFAULT_VALIDITY_DAYS),
        rationale,
        riskLevel: "medium",
        suitableFor: ["Balanced", "Aggressive"],
        keyMetrics: {
          exchange: topInstrument.exchange,
          market: topInstrument.market,
          currency: topInstrument.currency,
          pe: topInstrument.peRatio ? parseFloat(topInstrument.peRatio) : null,
          returns1y: topInstrument.returns1Y ? parseFloat(topInstrument.returns1Y) : null,
          sector: topInstrument.sector,
        },
      };
    } catch (error) {
      console.error("[PickOfTheDay] Error generating global stock pick:", error);
      return null;
    }
  }

  private scoreStock(stock: any): number {
    let score = 0;
    
    const analystRating = stock.analystRating?.toLowerCase() || '';
    if (analystRating.includes('strong buy')) score += 25;
    else if (analystRating.includes('buy')) score += 20;
    else if (analystRating.includes('hold')) score += 10;
    
    const returns1Y = stock.returns1Y ? parseFloat(stock.returns1Y) : 0;
    if (returns1Y > 30) score += 20;
    else if (returns1Y > 15) score += 15;
    else if (returns1Y > 0) score += 10;
    
    const pe = stock.peRatio ? parseFloat(stock.peRatio) : 0;
    if (pe > 0 && pe < 15) score += 15;
    else if (pe >= 15 && pe < 25) score += 10;
    else if (pe >= 25 && pe < 40) score += 5;
    
    if (stock.marketCap === 'Large Cap') score += 10;
    else if (stock.marketCap === 'Mid Cap') score += 8;
    else if (stock.marketCap === 'Small Cap') score += 5;
    
    return score;
  }

  private scoreMutualFund(fund: any): number {
    let score = 0;
    
    const crisilRating = fund.crisilRating ? parseInt(fund.crisilRating) : 0;
    if (crisilRating >= 5) score += 25;
    else if (crisilRating >= 4) score += 20;
    else if (crisilRating >= 3) score += 15;
    
    const returns1Y = fund.returns1Y ? parseFloat(fund.returns1Y) : 0;
    if (returns1Y > 20) score += 20;
    else if (returns1Y > 12) score += 15;
    else if (returns1Y > 6) score += 10;
    
    const returns3Y = fund.returns3Y ? parseFloat(fund.returns3Y) : 0;
    if (returns3Y > 15) score += 15;
    else if (returns3Y > 10) score += 10;
    
    const expenseRatio = fund.expenseRatio ? parseFloat(fund.expenseRatio) : 2;
    if (expenseRatio < 0.5) score += 15;
    else if (expenseRatio < 1) score += 10;
    else if (expenseRatio < 1.5) score += 5;
    
    return score;
  }

  private scoreBond(bond: any): number {
    let score = 0;
    
    const ytm = bond.yieldToMaturity ? parseFloat(bond.yieldToMaturity) : 0;
    if (ytm > 10) score += 25;
    else if (ytm > 8) score += 20;
    else if (ytm > 6) score += 15;
    
    const rating = bond.creditRating?.toUpperCase() || '';
    if (rating.includes('AAA')) score += 25;
    else if (rating.includes('AA')) score += 20;
    else if (rating.includes('A')) score += 15;
    
    return score;
  }

  private scoreUnlisted(company: any): number {
    let score = 0;
    
    if (company.expectedListingDate) score += 30;
    
    const priceChange = company.priceChangePercent ? parseFloat(company.priceChangePercent) : 0;
    if (priceChange > 20) score += 20;
    else if (priceChange > 10) score += 15;
    else if (priceChange > 0) score += 10;
    
    if (company.sector?.toLowerCase().includes('tech')) score += 10;
    if (company.sector?.toLowerCase().includes('fintech')) score += 10;
    
    return score;
  }

  private async generateRationale(params: any): Promise<string> {
    if (!this.genAI) {
      return this.generateFallbackRationale(params);
    }

    try {
      const prompt = this.buildRationalePrompt(params);
      const model = this.genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      
      const response = await model;
      return response.text || this.generateFallbackRationale(params);
    } catch (error) {
      console.error("[PickOfTheDay] AI rationale generation failed:", error);
      return this.generateFallbackRationale(params);
    }
  }

  private buildRationalePrompt(params: any): string {
    const categoryName = {
      'listed_stocks': 'Stock',
      'mutual_funds': 'Mutual Fund',
      'bonds': 'Bond',
      'unlisted': 'Unlisted Stock',
    }[params.category] || 'Investment';

    return `Generate a concise, professional investment rationale for today's ${categoryName} pick.

Product: ${params.name}
${params.symbol ? `Symbol: ${params.symbol}` : ''}
${params.sector ? `Sector: ${params.sector}` : ''}
Current Price: ₹${params.currentPrice}
Target Price: ₹${params.targetPrice} (${Math.round((params.targetPrice / params.currentPrice - 1) * 100)}% upside)
Stop Loss: ₹${params.stoplossPrice}
${params.fintekproRating ? `FintekPro Rating: ${params.fintekproRating}/5` : ''}
${params.peRatio ? `P/E Ratio: ${params.peRatio}` : ''}
${params.returns1Y ? `1Y Returns: ${params.returns1Y}%` : ''}
${params.yield ? `Yield: ${params.yield}%` : ''}
${params.creditRating ? `Credit Rating: ${params.creditRating}` : ''}

Write a 2-3 sentence rationale explaining why this is today's top pick. Focus on key strengths, recent catalysts, and risk-reward. Be specific and actionable. Do not use markdown formatting.`;
  }

  private generateFallbackRationale(params: any): string {
    const upside = Math.round((params.targetPrice / params.currentPrice - 1) * 100);
    
    const categoryRationales: Record<string, string> = {
      'listed_stocks': `${params.name} shows strong fundamentals with ${params.fintekproRating ? `a ${params.fintekproRating}-star FintekPro rating` : 'solid metrics'}${params.returns1Y ? ` and ${params.returns1Y}% 1-year returns` : ''}. With ${upside}% upside potential to target, this stock offers an attractive risk-reward profile for growth-oriented investors.`,
      'mutual_funds': `${params.name} from ${params.fundHouse || 'a top AMC'} demonstrates consistent performance${params.returns1Y ? ` with ${params.returns1Y}% trailing returns` : ''}. ${params.fintekproRating ? `Rated ${params.fintekproRating} stars by FintekPro, ` : ''}this fund is well-suited for investors seeking quality exposure to ${params.category2 || 'diversified assets'}.`,
      'bonds': `${params.name} offers an attractive yield${params.yield ? ` of ${params.yield}%` : ''}${params.creditRating ? ` with ${params.creditRating} credit rating` : ''}. This fixed-income pick provides stable returns with capital preservation focus, ideal for conservative portfolios.`,
      'unlisted': `${params.name} in the ${params.sector || 'growth'} sector presents a compelling pre-listing opportunity${params.ipoStatus ? ` with ${params.ipoStatus}` : ''}. High potential returns with 25% target upside for investors with higher risk appetite.`,
    };

    return categoryRationales[params.category] || `${params.name} is selected as today's top pick based on comprehensive analysis of fundamentals, technicals, and market conditions. Target upside of ${upside}% with defined risk management.`;
  }

  private getRiskLevel(volatility: number): string {
    if (volatility < 15) return 'low';
    if (volatility < 25) return 'medium';
    return 'high';
  }

  private getExpiryDate(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  private detectMarketRegion(symbol?: string, exchange?: string, name?: string): string | undefined {
    if (!symbol && !exchange && !name) return undefined;
    
    const text = `${symbol || ""} ${exchange || ""} ${name || ""}`.toUpperCase();
    
    // US Markets
    if (text.includes("NYSE") || text.includes("NASDAQ") || text.includes(".US") ||
        text.match(/\.(N|O)$/) || exchange?.includes("US") ||
        ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA"].some(s => text.includes(s))) {
      return "us";
    }
    
    // China Markets
    if (text.includes("SHANGHAI") || text.includes("SHENZHEN") || text.includes(".SS") ||
        text.includes(".SZ") || text.includes(".HK") || exchange?.includes("CN") ||
        text.includes("ALIBABA") || text.includes("TENCENT") || text.includes("BAIDU")) {
      return "china";
    }
    
    // UK/Europe Markets
    if (text.includes(".L") || text.includes("LSE") || text.includes("LONDON") ||
        text.includes(".PA") || text.includes(".DE") || text.includes(".AS") ||
        text.includes("EURONEXT") || text.includes("FRANKFURT") || exchange?.includes("EU")) {
      return "uk_europe";
    }
    
    // Japan Markets
    if (text.includes(".T") || text.includes("TOKYO") || text.includes("NIKKEI") ||
        text.includes("TSE") || exchange?.includes("JP")) {
      return "japan";
    }
    
    // Default to other for any global stock without specific market
    return "other";
  }

  private async savePick(pick: DailyPickData): Promise<void> {
    await db.insert(dailyPicks).values({
      category: pick.category,
      instrumentId: pick.instrumentId,
      instrumentName: pick.instrumentName,
      isin: pick.isin,
      symbol: pick.symbol,
      market: pick.market,
      recoDate: pick.recoDate,
      recoPrice: pick.recoPrice.toString(),
      targetPrice: pick.targetPrice.toString(),
      stoplossPrice: pick.stoplossPrice.toString(),
      currentPrice: pick.currentPrice?.toString(),
      status: pick.status,
      expiryDate: pick.expiryDate,
      rationale: pick.rationale,
      riskLevel: pick.riskLevel,
      suitableFor: pick.suitableFor,
      keyMetrics: pick.keyMetrics,
      generatedBy: 'ai',
    });
  }

  async updatePickStatuses(): Promise<{ updated: number; details: string[] }> {
    const livePicks = await db
      .select()
      .from(dailyPicks)
      .where(eq(dailyPicks.status, 'live'));

    let updated = 0;
    const details: string[] = [];
    const today = new Date().toISOString().split('T')[0];

    for (const pick of livePicks) {
      const currentPrice = await this.getCurrentPrice(pick);
      if (!currentPrice) continue;

      const recoPrice = parseFloat(pick.recoPrice);
      const targetPrice = parseFloat(pick.targetPrice);
      const stoplossPrice = parseFloat(pick.stoplossPrice);
      const returnPct = ((currentPrice - recoPrice) / recoPrice) * 100;
      const recoDate = new Date(pick.recoDate);
      const daysHeld = Math.floor((Date.now() - recoDate.getTime()) / (1000 * 60 * 60 * 24));

      let newStatus: PickStatus = 'live';
      
      if (currentPrice >= targetPrice) {
        newStatus = 'target_hit';
        details.push(`${pick.instrumentName}: Target hit at ₹${currentPrice} (+${returnPct.toFixed(1)}%)`);
      } else if (currentPrice <= stoplossPrice) {
        newStatus = 'stoploss_hit';
        details.push(`${pick.instrumentName}: Stoploss hit at ₹${currentPrice} (${returnPct.toFixed(1)}%)`);
      } else if (pick.expiryDate < today) {
        newStatus = 'expired';
        details.push(`${pick.instrumentName}: Expired with ${returnPct.toFixed(1)}% return`);
      }

      if (newStatus !== 'live' || currentPrice !== parseFloat(pick.currentPrice || '0')) {
        await db
          .update(dailyPicks)
          .set({
            currentPrice: currentPrice.toString(),
            status: newStatus,
            returnPct: returnPct.toFixed(2),
            daysHeld,
            statusUpdatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(dailyPicks.id, pick.id));
        
        if (newStatus !== 'live') updated++;
      }
    }

    return { updated, details };
  }

  private async getCurrentPrice(pick: any): Promise<number | null> {
    try {
      switch (pick.category) {
        case 'listed_stocks':
        case 'global_stocks':
          const stock = await db
            .select({ currentPrice: listedStocks.currentPrice })
            .from(listedStocks)
            .where(eq(listedStocks.id, pick.instrumentId))
            .limit(1);
          return stock[0]?.currentPrice ? parseFloat(stock[0].currentPrice) : null;

        case 'mutual_funds':
          const fund = await db
            .select({ nav: mutualFunds.nav })
            .from(mutualFunds)
            .where(eq(mutualFunds.schemeCode, pick.instrumentId))
            .limit(1);
          return fund[0]?.nav ? parseFloat(fund[0].nav) : null;

        case 'bonds':
          const bond = await db
            .select({ currentPrice: bondCatalog.currentPrice })
            .from(bondCatalog)
            .where(eq(bondCatalog.id, parseInt(pick.instrumentId)))
            .limit(1);
          return bond[0]?.currentPrice ? parseFloat(bond[0].currentPrice) : null;

        case 'unlisted':
          const company = await db
            .select({ lastPrice: unlistedCompanies.lastPrice })
            .from(unlistedCompanies)
            .where(eq(unlistedCompanies.id, pick.instrumentId))
            .limit(1);
          return company[0]?.lastPrice ? parseFloat(company[0].lastPrice) : null;

        default:
          return null;
      }
    } catch (error) {
      console.error(`[PickOfTheDay] Error getting current price for ${pick.instrumentName}:`, error);
      return null;
    }
  }

  private transformPick(pick: any): DailyPickData {
    return {
      id: pick.id,
      category: pick.category,
      instrumentId: pick.instrumentId,
      instrumentName: pick.instrumentName,
      isin: pick.isin,
      symbol: pick.symbol,
      market: pick.market,
      recoDate: pick.recoDate,
      recoPrice: parseFloat(pick.recoPrice),
      targetPrice: parseFloat(pick.targetPrice),
      stoplossPrice: parseFloat(pick.stoplossPrice),
      currentPrice: pick.currentPrice ? parseFloat(pick.currentPrice) : undefined,
      status: pick.status,
      expiryDate: pick.expiryDate,
      returnPct: pick.returnPct ? parseFloat(pick.returnPct) : undefined,
      daysHeld: pick.daysHeld,
      rationale: pick.rationale,
      riskLevel: pick.riskLevel || 'medium',
      suitableFor: pick.suitableFor || [],
      keyMetrics: pick.keyMetrics,
    };
  }
}

export const pickOfTheDayService = new PickOfTheDayService();
