/**
 * Epic 3: Tax & Exit Load Computation Engine
 * 
 * Provides lot-level capital gains and exit load calculations
 * integrated with the FIFO Lot Ledger.
 */

import { db } from "../db";
import { mutualFunds } from "@shared/schema";
import { eq, or, ilike } from "drizzle-orm";
import { InvestmentLot } from "./fifo-lot-ledger-service";
import { exitLoadService, ExitLoadResult } from "./exit-load-service";

/**
 * Epic 3.1: Asset Classification Types
 */
export type AssetClass = 
  | 'equity'
  | 'debt'
  | 'hybrid_equity'  // >65% equity
  | 'hybrid_debt'    // <65% equity
  | 'gold'
  | 'international'
  | 'liquid'
  | 'overnight'
  | 'elss'
  | 'index'
  | 'sectoral'
  | 'unknown';

/**
 * LTCG holding period thresholds (in days) by asset class
 */
const LTCG_THRESHOLDS: Record<AssetClass, number> = {
  equity: 365,           // 1 year
  debt: 730,             // 2 years (post Apr 2023) - no indexation
  hybrid_equity: 365,    // Treated as equity if >65% equity
  hybrid_debt: 730,      // Treated as debt if <65% equity
  gold: 730,             // 2 years
  international: 730,    // 2 years
  liquid: 730,           // 2 years
  overnight: 730,        // 2 years
  elss: 1095,            // 3 years lock-in + capital gains threshold
  index: 365,            // Follows equity
  sectoral: 365,         // Follows equity
  unknown: 365,          // Default to equity
};

/**
 * Tax rates by asset class and capital gains type
 */
const TAX_RATES: Record<AssetClass, { stcg: number; ltcg: number }> = {
  equity: { stcg: 0.20, ltcg: 0.125 },      // 20% STCG, 12.5% LTCG
  debt: { stcg: 0.30, ltcg: 0.30 },         // Slab rate (using max 30%)
  hybrid_equity: { stcg: 0.20, ltcg: 0.125 },
  hybrid_debt: { stcg: 0.30, ltcg: 0.30 },
  gold: { stcg: 0.30, ltcg: 0.125 },        // Gold: slab for STCG, 12.5% LTCG
  international: { stcg: 0.30, ltcg: 0.30 }, // No LTCG benefit for foreign
  liquid: { stcg: 0.30, ltcg: 0.30 },
  overnight: { stcg: 0.30, ltcg: 0.30 },
  elss: { stcg: 0.20, ltcg: 0.125 },
  index: { stcg: 0.20, ltcg: 0.125 },
  sectoral: { stcg: 0.20, ltcg: 0.125 },
  unknown: { stcg: 0.20, ltcg: 0.125 },
};

/**
 * Equity LTCG exemption limit (per financial year)
 */
const EQUITY_LTCG_EXEMPTION = 125000;  // ₹1.25 lakh

/**
 * Grandfathering date for equity (Jan 31, 2018)
 */
const GRANDFATHERING_DATE = new Date('2018-01-31');

/**
 * Cost Inflation Index for debt fund indexation (pre-Apr 2023 purchases)
 */
const CII_DATA: Record<string, number> = {
  '2001-02': 100,
  '2002-03': 105,
  '2003-04': 109,
  '2004-05': 113,
  '2005-06': 117,
  '2006-07': 122,
  '2007-08': 129,
  '2008-09': 137,
  '2009-10': 148,
  '2010-11': 167,
  '2011-12': 184,
  '2012-13': 200,
  '2013-14': 220,
  '2014-15': 240,
  '2015-16': 254,
  '2016-17': 264,
  '2017-18': 272,
  '2018-19': 280,
  '2019-20': 289,
  '2020-21': 301,
  '2021-22': 317,
  '2022-23': 331,
  '2023-24': 348,
  '2024-25': 363,
  '2025-26': 380,  // Estimated
};

/**
 * Lot-level tax calculation result
 */
export interface LotTaxResult {
  lotId: string;
  isin: string;
  assetClass: AssetClass;
  holdingPeriodDays: number;
  capitalGainsType: 'stcg' | 'ltcg';
  units: number;
  costBasis: number;
  currentValue: number;
  unrealizedGain: number;
  estimatedTax: number;
  taxRate: number;
  exitLoad: ExitLoadResult | null;
  netProceedsAfterTaxAndExit: number;
  recommendation: 'SELL_NOW' | 'WAIT_FOR_LTCG' | 'WAIT_FOR_EXIT_LOAD' | 'HOLD';
  daysToLTCG: number | null;
  daysToZeroExitLoad: number | null;
  warnings: string[];
}

/**
 * Holdings-level tax summary
 */
export interface TaxSummary {
  isin: string;
  schemeName: string;
  assetClass: AssetClass;
  lots: LotTaxResult[];
  totalUnits: number;
  totalCostBasis: number;
  totalCurrentValue: number;
  totalUnrealizedGain: number;
  stcgAmount: number;
  ltcgAmount: number;
  totalEstimatedTax: number;
  totalExitLoad: number;
  netProceedsAfterTaxAndExit: number;
  overallRecommendation: string;
}

class LotTaxCalculatorService {
  private static instance: LotTaxCalculatorService;
  private assetClassCache: Map<string, AssetClass> = new Map();

  private constructor() {
    console.log('✅ Lot Tax Calculator Service initialized');
  }

  static getInstance(): LotTaxCalculatorService {
    if (!LotTaxCalculatorService.instance) {
      LotTaxCalculatorService.instance = new LotTaxCalculatorService();
    }
    return LotTaxCalculatorService.instance;
  }

  /**
   * Epic 3.1: Get asset classification for an ISIN
   */
  async getAssetClass(isin: string, schemeName?: string): Promise<AssetClass> {
    // Check cache first
    if (this.assetClassCache.has(isin)) {
      return this.assetClassCache.get(isin)!;
    }

    try {
      // Try database lookup
      const fund = await db.select()
        .from(mutualFunds)
        .where(eq(mutualFunds.isin, isin))
        .limit(1);

      if (fund.length > 0) {
        const assetClass = this.classifyFromFundData(fund[0]);
        this.assetClassCache.set(isin, assetClass);
        return assetClass;
      }
    } catch (error) {
      console.warn(`[LotTax] Database lookup failed for ${isin}:`, error);
    }

    // Fallback: Classify from scheme name
    const assetClass = this.classifyFromSchemeName(schemeName || '');
    this.assetClassCache.set(isin, assetClass);
    return assetClass;
  }

  /**
   * Classify asset from fund database record
   */
  private classifyFromFundData(fund: any): AssetClass {
    const category = (fund.category || '').toLowerCase();
    const subCategory = (fund.subCategory || '').toLowerCase();
    const schemeName = (fund.schemeName || '').toLowerCase();

    // ELSS
    if (category.includes('elss') || subCategory.includes('elss') || schemeName.includes('elss')) {
      return 'elss';
    }

    // Liquid/Overnight
    if (category.includes('liquid') || subCategory.includes('liquid')) {
      return 'liquid';
    }
    if (category.includes('overnight') || subCategory.includes('overnight')) {
      return 'overnight';
    }

    // Equity categories
    if (category.includes('equity') && !category.includes('hybrid')) {
      if (category.includes('index') || schemeName.includes('index') || schemeName.includes('nifty') || schemeName.includes('sensex')) {
        return 'index';
      }
      if (category.includes('sector') || subCategory.includes('sector') || subCategory.includes('thematic')) {
        return 'sectoral';
      }
      return 'equity';
    }

    // Debt categories
    if (category.includes('debt') || category.includes('fixed income') || category.includes('bond')) {
      return 'debt';
    }

    // Hybrid
    if (category.includes('hybrid')) {
      // Check equity allocation
      const equityAllocation = parseFloat(fund.equityAllocation || '0');
      if (equityAllocation >= 65) {
        return 'hybrid_equity';
      } else {
        return 'hybrid_debt';
      }
    }

    // Gold
    if (category.includes('gold') || schemeName.includes('gold')) {
      return 'gold';
    }

    // International
    if (category.includes('international') || category.includes('global') || 
        schemeName.includes('international') || schemeName.includes('global') ||
        schemeName.includes('us ') || schemeName.includes('nasdaq')) {
      return 'international';
    }

    return 'unknown';
  }

  /**
   * Classify asset from scheme name (fallback)
   */
  private classifyFromSchemeName(schemeName: string): AssetClass {
    const name = schemeName.toLowerCase();

    if (name.includes('elss') || name.includes('tax saver')) return 'elss';
    if (name.includes('liquid')) return 'liquid';
    if (name.includes('overnight')) return 'overnight';
    if (name.includes('index') || name.includes('nifty') || name.includes('sensex')) return 'index';
    if (name.includes('sector') || name.includes('thematic') || name.includes('pharma') || 
        name.includes('banking') || name.includes('technology') || name.includes('infrastructure')) return 'sectoral';
    if (name.includes('gold') || name.includes('precious')) return 'gold';
    if (name.includes('international') || name.includes('global') || name.includes('nasdaq') ||
        name.includes('us equity') || name.includes('world')) return 'international';
    if (name.includes('hybrid') || name.includes('balanced')) {
      if (name.includes('aggressive') || name.includes('equity')) return 'hybrid_equity';
      return 'hybrid_debt';
    }
    if (name.includes('debt') || name.includes('bond') || name.includes('gilt') || 
        name.includes('credit') || name.includes('duration') || name.includes('corporate')) return 'debt';
    if (name.includes('equity') || name.includes('growth') || name.includes('bluechip') ||
        name.includes('large cap') || name.includes('mid cap') || name.includes('small cap') ||
        name.includes('flexi') || name.includes('multi cap') || name.includes('focused')) return 'equity';

    return 'unknown';
  }

  /**
   * Epic 3.2: Calculate capital gains for a single lot
   */
  async calculateLotTax(
    lot: InvestmentLot,
    currentNav: number,
    referenceDate: Date = new Date()
  ): Promise<LotTaxResult> {
    const warnings: string[] = [];
    
    // Get asset class
    const assetClass = await this.getAssetClass(lot.isin, lot.schemeName);
    
    // Calculate holding period
    const holdingPeriodDays = Math.floor(
      (referenceDate.getTime() - lot.purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Determine capital gains type
    const ltcgThreshold = LTCG_THRESHOLDS[assetClass];
    const capitalGainsType: 'stcg' | 'ltcg' = holdingPeriodDays >= ltcgThreshold ? 'ltcg' : 'stcg';

    // Calculate values
    const units = lot.remainingUnits;
    const costBasis = lot.costPerUnit * units;
    const currentValue = currentNav * units;
    let unrealizedGain = currentValue - costBasis;

    // Apply grandfathering for equity purchased before Feb 2018
    if (assetClass === 'equity' && lot.purchaseDate < GRANDFATHERING_DATE && capitalGainsType === 'ltcg') {
      // TODO: Look up Jan 31, 2018 NAV for this fund
      // For now, add warning
      warnings.push('Grandfathering benefit may apply - pre-Feb 2018 purchase');
    }

    // Get tax rate
    const taxRates = TAX_RATES[assetClass];
    const taxRate = capitalGainsType === 'stcg' ? taxRates.stcg : taxRates.ltcg;

    // Calculate estimated tax (note: equity LTCG exemption applied at portfolio level)
    const taxableGain = Math.max(0, unrealizedGain);
    const estimatedTax = taxableGain * taxRate;

    // Epic 3.3: Calculate exit load
    let exitLoad: ExitLoadResult | null = null;
    try {
      exitLoad = await exitLoadService.getExitLoad({
        isin: lot.isin,
        holdingDays: holdingPeriodDays,
        redemptionAmount: currentValue,
        category: assetClass,
        schemeName: lot.schemeName,
      });
    } catch (error: any) {
      warnings.push(`Exit load lookup failed: ${error.message}`);
    }

    const exitLoadAmount = exitLoad?.exitLoadAmount || 0;
    const netProceedsAfterTaxAndExit = currentValue - estimatedTax - exitLoadAmount;

    // Calculate days to LTCG
    const daysToLTCG = capitalGainsType === 'stcg' ? ltcgThreshold - holdingPeriodDays : null;

    // Generate recommendation
    const recommendation = this.generateRecommendation(
      capitalGainsType,
      daysToLTCG,
      exitLoad?.daysToZeroExitLoad || null,
      unrealizedGain
    );

    return {
      lotId: lot.id,
      isin: lot.isin,
      assetClass,
      holdingPeriodDays,
      capitalGainsType,
      units,
      costBasis,
      currentValue,
      unrealizedGain,
      estimatedTax,
      taxRate,
      exitLoad,
      netProceedsAfterTaxAndExit,
      recommendation,
      daysToLTCG,
      daysToZeroExitLoad: exitLoad?.daysToZeroExitLoad || null,
      warnings,
    };
  }

  /**
   * Generate sell/wait recommendation based on tax and exit load
   */
  private generateRecommendation(
    capitalGainsType: 'stcg' | 'ltcg',
    daysToLTCG: number | null,
    daysToZeroExitLoad: number | null,
    unrealizedGain: number
  ): 'SELL_NOW' | 'WAIT_FOR_LTCG' | 'WAIT_FOR_EXIT_LOAD' | 'HOLD' {
    // If gain is negative, selling now is fine
    if (unrealizedGain < 0) {
      return 'SELL_NOW';
    }

    // Check if close to LTCG threshold (within 30 days)
    if (daysToLTCG !== null && daysToLTCG > 0 && daysToLTCG <= 30) {
      return 'WAIT_FOR_LTCG';
    }

    // Check exit load (within 15 days of zero exit load)
    if (daysToZeroExitLoad !== null && daysToZeroExitLoad > 0 && daysToZeroExitLoad <= 15) {
      return 'WAIT_FOR_EXIT_LOAD';
    }

    // If LTCG and no exit load, can sell
    if (capitalGainsType === 'ltcg' && (daysToZeroExitLoad === null || daysToZeroExitLoad === 0)) {
      return 'SELL_NOW';
    }

    return 'HOLD';
  }

  /**
   * Calculate tax summary for all lots of a holding
   */
  async calculateHoldingTaxSummary(
    lots: InvestmentLot[],
    currentNav: number,
    schemeName: string
  ): Promise<TaxSummary> {
    const activeLots = lots.filter(l => l.remainingUnits > 0);
    const lotResults: LotTaxResult[] = [];

    for (const lot of activeLots) {
      const result = await this.calculateLotTax(lot, currentNav);
      lotResults.push(result);
    }

    const assetClass = lotResults.length > 0 ? lotResults[0].assetClass : 'unknown';
    const totalUnits = lotResults.reduce((sum, l) => sum + l.units, 0);
    const totalCostBasis = lotResults.reduce((sum, l) => sum + l.costBasis, 0);
    const totalCurrentValue = lotResults.reduce((sum, l) => sum + l.currentValue, 0);
    const totalUnrealizedGain = lotResults.reduce((sum, l) => sum + l.unrealizedGain, 0);
    const stcgAmount = lotResults
      .filter(l => l.capitalGainsType === 'stcg')
      .reduce((sum, l) => sum + Math.max(0, l.unrealizedGain), 0);
    const ltcgAmount = lotResults
      .filter(l => l.capitalGainsType === 'ltcg')
      .reduce((sum, l) => sum + Math.max(0, l.unrealizedGain), 0);
    const totalEstimatedTax = lotResults.reduce((sum, l) => sum + l.estimatedTax, 0);
    const totalExitLoad = lotResults.reduce((sum, l) => sum + (l.exitLoad?.exitLoadAmount || 0), 0);
    const netProceedsAfterTaxAndExit = totalCurrentValue - totalEstimatedTax - totalExitLoad;

    // Overall recommendation
    const waitingLots = lotResults.filter(l => 
      l.recommendation === 'WAIT_FOR_LTCG' || l.recommendation === 'WAIT_FOR_EXIT_LOAD'
    );
    const overallRecommendation = waitingLots.length > 0
      ? `${waitingLots.length} lots recommended to wait`
      : 'All lots clear for redemption';

    return {
      isin: activeLots[0]?.isin || '',
      schemeName,
      assetClass,
      lots: lotResults,
      totalUnits,
      totalCostBasis,
      totalCurrentValue,
      totalUnrealizedGain,
      stcgAmount,
      ltcgAmount,
      totalEstimatedTax,
      totalExitLoad,
      netProceedsAfterTaxAndExit,
      overallRecommendation,
    };
  }

  /**
   * Get fiscal year string from date
   */
  getFiscalYear(date: Date): string {
    const month = date.getMonth();
    const year = date.getFullYear();
    if (month >= 3) {  // April onwards
      return `${year}-${(year + 1).toString().slice(2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(2)}`;
    }
  }

  /**
   * Calculate indexed cost for debt funds (pre-Apr 2023 purchases)
   */
  calculateIndexedCost(purchaseDate: Date, purchaseCost: number, saleDate: Date = new Date()): number {
    // Indexation benefit only for purchases before April 1, 2023
    const indexationCutoff = new Date('2023-04-01');
    if (purchaseDate >= indexationCutoff) {
      return purchaseCost;  // No indexation for post-Apr 2023 purchases
    }

    const purchaseFY = this.getFiscalYear(purchaseDate);
    const saleFY = this.getFiscalYear(saleDate);

    const purchaseCII = CII_DATA[purchaseFY] || 100;
    const saleCII = CII_DATA[saleFY] || 380;

    const indexedCost = purchaseCost * (saleCII / purchaseCII);
    return indexedCost;
  }
}

export const lotTaxCalculatorService = LotTaxCalculatorService.getInstance();
