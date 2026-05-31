// @ts-nocheck
/**
 * Epic 3: Tax & Exit Load Computation Engine
 * 
 * Provides lot-level capital gains and exit load calculations
 * integrated with the FIFO Lot Ledger.
 * 
 * Tax rates and thresholds sourced from centralized tax-regime-config.ts
 */

import { db } from "../db";
import { mutualFunds } from "@shared/schema";
import { eq, or, ilike } from "drizzle-orm";
import { InvestmentLot } from "./fifo-lot-ledger-service";
import { exitLoadService, ExitLoadResult } from "./exit-load-service";
import {
  GRANDFATHERING_DATE,
  INDEXATION_CUTOFF_DATE,
  COST_INFLATION_INDEX as CII_DATA,
  getTaxRatesForAsset,
  getTaxRegime,
  getFiscalYear,
  getCII,
  type TaxAssetClass,
} from './tax-regime-config';

export type AssetClass = TaxAssetClass;

function getThresholdsAndRatesForDate(transactionDate: Date = new Date()) {
  const rates = getTaxRatesForAsset('equity', transactionDate);
  const allClasses: AssetClass[] = ['equity', 'debt', 'hybrid_equity', 'hybrid_debt', 'gold_silver', 'liquid', 'overnight'];
  const thresholds: Record<string, number> = {};
  const taxRates: Record<string, { stcg: number; ltcg: number }> = {};
  let equityExemption = rates.ltcgExemption;

  for (const cls of allClasses) {
    const r = getTaxRatesForAsset(cls, transactionDate);
    thresholds[cls] = r.ltcgThresholdDays;
    taxRates[cls] = { stcg: r.stcg, ltcg: r.ltcg };
    if (cls === 'equity') equityExemption = r.ltcgExemption;
  }

  return {
    thresholds: thresholds as Record<AssetClass, number>,
    taxRates: taxRates as Record<AssetClass, { stcg: number; ltcg: number }>,
    equityExemption,
  };
}

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

    // Determine capital gains type using date-based regime selection
    const { thresholds, taxRates: regimeTaxRates, equityExemption } = getThresholdsAndRatesForDate(referenceDate);
    const ltcgThreshold = thresholds[assetClass];
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

    // Get tax rate from regime-appropriate config
    const taxRate = capitalGainsType === 'stcg' ? regimeTaxRates[assetClass].stcg : regimeTaxRates[assetClass].ltcg;

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
    if (purchaseDate >= INDEXATION_CUTOFF_DATE) {
      return purchaseCost;
    }

    const purchaseFY = this.getFiscalYear(purchaseDate);
    const saleFY = this.getFiscalYear(saleDate);

    const purchaseCII = getCII(purchaseFY);
    const saleCII = getCII(saleFY);

    const indexedCost = purchaseCost * (saleCII / purchaseCII);
    return indexedCost;
  }

  /**
   * FIX SPEC SECTION 4.4: HARD BLOCKERS - FAIL CLOSED
   * Validate lots before computing capital gains
   * If lots are missing or dates are invalid, refuse to compute
   */
  validateLotsForTax(lots: Array<{ purchaseDate: string | Date | null; units: number }>): {
    isValid: boolean;
    capitalGainsEnabled: boolean;
    exitLoadEnabled: boolean;
    validationErrors: string[];
    disabledReason: string | null;
  } {
    const errors: string[] = [];
    
    // Check 1: No lots at all
    if (!lots || lots.length === 0) {
      return {
        isValid: false,
        capitalGainsEnabled: false,
        exitLoadEnabled: false,
        validationErrors: ['No transaction lots available'],
        disabledReason: 'No transaction-level data from CAS statement. Tax and exit load calculations disabled.'
      };
    }

    // Check 2: Any lot has null/invalid purchase date
    let lotsWithMissingDates = 0;
    let lotsWithInvalidDates = 0;
    
    for (const lot of lots) {
      if (!lot.purchaseDate) {
        lotsWithMissingDates++;
        errors.push(`Lot with ${lot.units} units has no purchase date`);
      } else {
        const date = new Date(lot.purchaseDate);
        if (isNaN(date.getTime())) {
          lotsWithInvalidDates++;
          errors.push(`Lot with ${lot.units} units has invalid date: ${lot.purchaseDate}`);
        }
      }
    }

    if (lotsWithMissingDates > 0 || lotsWithInvalidDates > 0) {
      return {
        isValid: false,
        capitalGainsEnabled: false,
        exitLoadEnabled: false,
        validationErrors: errors,
        disabledReason: `${lotsWithMissingDates + lotsWithInvalidDates} lot(s) have missing or invalid dates. Per FintekPro policy, tax calculations require verified transaction dates.`
      };
    }

    // All validations passed
    return {
      isValid: true,
      capitalGainsEnabled: true,
      exitLoadEnabled: true,
      validationErrors: [],
      disabledReason: null
    };
  }

  /**
   * FIX SPEC SECTION 4.2: DSP Healthcare validation
   * Validate that engine correctly identifies mixed STCG/LTCG
   */
  validateTaxCalculation(lots: Array<{ purchaseDate: string; units: number }>): {
    ltcgUnits: number;
    stcgUnits: number;
    lotsBreakdown: Array<{ date: string; units: number; type: 'LTCG' | 'STCG'; holdingDays: number }>;
  } {
    const today = new Date();
    let ltcgUnits = 0;
    let stcgUnits = 0;
    const breakdown: Array<{ date: string; units: number; type: 'LTCG' | 'STCG'; holdingDays: number }> = [];

    for (const lot of lots) {
      const purchaseDate = new Date(lot.purchaseDate);
      const holdingDays = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      const type: 'LTCG' | 'STCG' = holdingDays >= 365 ? 'LTCG' : 'STCG';
      
      if (type === 'LTCG') {
        ltcgUnits += lot.units;
      } else {
        stcgUnits += lot.units;
      }

      breakdown.push({
        date: lot.purchaseDate,
        units: lot.units,
        type,
        holdingDays
      });
    }

    return { ltcgUnits, stcgUnits, lotsBreakdown: breakdown };
  }

  /**
   * FIX SPEC SECTION 5.2: Partial Redemption FIFO Logic
   * Calculate which lots are consumed when redeeming a specific amount.
   * Uses centralized ExitLoadService for ISIN-specific exit load lookup.
   */
  async simulateFIFORedemption(
    lots: Array<{ purchaseDate: string; units: number; nav: number; isin?: string; schemeName?: string }>,
    redemptionAmount: number,
    currentNav: number,
    isin?: string,
    category?: string
  ): Promise<{
    unitsToRedeem: number;
    consumedLots: Array<{
      purchaseDate: string;
      units: number;
      taxType: 'LTCG' | 'STCG';
      hasExitLoad: boolean;
      exitLoadAmount: number;
      exitLoadSource: 'database' | 'generic';
    }>;
    totalExitLoad: number;
    ltcgAmount: number;
    stcgAmount: number;
  }> {
    const today = new Date();
    const unitsToRedeem = redemptionAmount / currentNav;
    let remainingUnits = unitsToRedeem;
    
    const consumedLots: Array<{
      purchaseDate: string;
      units: number;
      taxType: 'LTCG' | 'STCG';
      hasExitLoad: boolean;
      exitLoadAmount: number;
      exitLoadSource: 'database' | 'generic';
    }> = [];

    let totalExitLoad = 0;
    let ltcgAmount = 0;
    let stcgAmount = 0;

    const sortedLots = [...lots].sort((a, b) => 
      new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
    );

    for (const lot of sortedLots) {
      if (remainingUnits <= 0) break;

      const unitsFromThisLot = Math.min(remainingUnits, lot.units);
      const purchaseDate = new Date(lot.purchaseDate);
      const holdingDays = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      const taxType: 'LTCG' | 'STCG' = holdingDays >= 365 ? 'LTCG' : 'STCG';
      
      const lotValue = unitsFromThisLot * currentNav;
      let exitLoadAmount = 0;
      let hasExitLoad = false;
      let exitLoadSource: 'database' | 'generic' = 'generic';

      const lookupIsin = lot.isin || isin;
      try {
        const exitResult = await exitLoadService.getExitLoad({
          isin: lookupIsin,
          holdingDays,
          redemptionAmount: lotValue,
          category: category,
          schemeName: lot.schemeName,
        });
        exitLoadAmount = exitResult.exitLoadAmount;
        hasExitLoad = exitLoadAmount > 0;
        exitLoadSource = exitResult.source;
      } catch (error) {
        console.warn(`[LotTax FIFO] Exit load lookup failed for lot ${lot.purchaseDate}, using zero:`, error);
      }
      
      const gain = (currentNav - lot.nav) * unitsFromThisLot;
      if (taxType === 'LTCG') {
        ltcgAmount += Math.max(0, gain);
      } else {
        stcgAmount += Math.max(0, gain);
      }

      consumedLots.push({
        purchaseDate: lot.purchaseDate,
        units: unitsFromThisLot,
        taxType,
        hasExitLoad,
        exitLoadAmount,
        exitLoadSource
      });

      totalExitLoad += exitLoadAmount;
      remainingUnits -= unitsFromThisLot;
    }

    return {
      unitsToRedeem,
      consumedLots,
      totalExitLoad,
      ltcgAmount,
      stcgAmount
    };
  }
}

export const lotTaxCalculatorService = LotTaxCalculatorService.getInstance();
