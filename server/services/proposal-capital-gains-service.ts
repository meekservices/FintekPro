/**
 * Proposal Capital Gains Service
 * Comprehensive capital gains tax calculation for investment proposal rebalancing
 * Includes: Date-based tax regimes, tax loss harvesting, holding period alerts,
 * grandfathering benefits, exit loads, and tax-efficient alternatives
 * 
 * Uses Sandbox.co.in Tax P&L API as primary source for accurate, up-to-date tax rates
 * with automatic fallback to local calculation if API is unavailable
 */

import { exitLoadService } from './exit-load-service';
import { historicalNavService } from './historical-nav-service';
import { holdingLotsStorageService } from './holding-lots-storage-service';
import { sandboxCapitalGainsService, type AssetType as SandboxAssetType } from './sandbox-capital-gains-service';

const USE_SANDBOX_API_FOR_TAX = process.env.USE_SANDBOX_TAX_API === 'true';
const SANDBOX_TAX_API_AVAILABLE = sandboxCapitalGainsService.isServiceAvailable();

// Cost Inflation Index (CII) data from Income Tax Department
// Source: https://incometaxindia.gov.in/Pages/tools/cost-inflation-index.aspx
const COST_INFLATION_INDEX: Record<string, number> = {
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
  '2025-26': 377  // Estimated (to be updated when announced)
};

// Deadline for indexation benefit eligibility
const INDEXATION_CUTOFF_DATE = new Date('2023-04-01');

// Tax Regime Constants
// Note: Debt MF taxation changed significantly:
// - Pre-April 2023: 3-year LTCG at 20% with indexation
// - Post-April 2023 to July 2024: ALL gains taxed at investor's slab rate (no STCG/LTCG distinction)
// - Post-July 2024: Proposed 20% STCG / 12.5% LTCG with 2-year threshold (awaiting final rules)
const TAX_REGIMES = {
  // Pre-July 23, 2024 Budget (includes post-April 2023 debt fund rules)
  PRE_BUDGET_2024: {
    effectiveUntil: new Date('2024-07-22'),
    equity: {
      stcg: { rate: 0.15, thresholdDays: 365 },
      ltcg: { rate: 0.10, thresholdDays: 365, exemption: 100000 }
    },
    debt: {
      // Post April 2023 - ALL gains taxed at slab rate regardless of holding period
      // Using 30% as conservative estimate for high-income investors
      // Note: No STCG/LTCG distinction - both taxed at slab
      stcg: { rate: 0.30, thresholdDays: Infinity, slabBased: true }, // Always slab-rate
      ltcg: { rate: 0.30, thresholdDays: Infinity, exemption: 0, slabBased: true } // No LTCG benefit
    },
    hybrid_equity: { // Equity-oriented hybrid (>65% equity)
      stcg: { rate: 0.15, thresholdDays: 365 },
      ltcg: { rate: 0.10, thresholdDays: 365, exemption: 100000 }
    },
    hybrid_debt: { // Debt-oriented hybrid (<65% equity) - same as debt post-April 2023
      stcg: { rate: 0.30, thresholdDays: Infinity, slabBased: true },
      ltcg: { rate: 0.30, thresholdDays: Infinity, exemption: 0, slabBased: true }
    },
    gold_silver: {
      stcg: { rate: 0.30, thresholdDays: 1095 },
      ltcg: { rate: 0.20, thresholdDays: 1095, exemption: 0, indexation: true }
    }
  },
  // Post-July 23, 2024 Budget (Current)
  POST_BUDGET_2024: {
    effectiveFrom: new Date('2024-07-23'),
    equity: {
      stcg: { rate: 0.20, thresholdDays: 365 },
      ltcg: { rate: 0.125, thresholdDays: 365, exemption: 125000 }
    },
    debt: {
      // Post-July 2024: 20% STCG, 12.5% LTCG with 2-year threshold
      stcg: { rate: 0.20, thresholdDays: 730 }, // 2 years
      ltcg: { rate: 0.125, thresholdDays: 730, exemption: 0 }
    },
    hybrid_equity: {
      stcg: { rate: 0.20, thresholdDays: 365 },
      ltcg: { rate: 0.125, thresholdDays: 365, exemption: 125000 }
    },
    hybrid_debt: {
      stcg: { rate: 0.20, thresholdDays: 730 },
      ltcg: { rate: 0.125, thresholdDays: 730, exemption: 0 }
    },
    gold_silver: {
      stcg: { rate: 0.20, thresholdDays: 730 },
      ltcg: { rate: 0.125, thresholdDays: 730, exemption: 0 }
    }
  }
};

// Grandfathering date for equity funds (SEBI circular dated Jan 31, 2018)
const GRANDFATHERING_DATE = new Date('2018-01-31');
// PLACEHOLDER: Grandfathering FMV estimation
// Without actual NAV data from Jan 31, 2018, we use a conservative 40% appreciation estimate
// This is clearly an approximation - actual grandfathering benefit may differ significantly
// Users should verify with actual NAV data or consult a tax professional
const GRANDFATHERING_FMV_APPRECIATION_ESTIMATE = 0.40; // Estimated 40% appreciation since purchase to Jan 2018

// Cess rate
const CESS_RATE = 0.04; // 4% Health & Education Cess

// Surcharge slabs for individuals
const SURCHARGE_SLABS = [
  { min: 0, max: 5000000, rate: 0 },
  { min: 5000000, max: 10000000, rate: 0.10 },
  { min: 10000000, max: 20000000, rate: 0.15 },
  { min: 20000000, max: 50000000, rate: 0.25 },
  { min: 50000000, max: Infinity, rate: 0.37 }
];

// Exit load assumptions (typical for MF)
const EXIT_LOAD_RULES = {
  equity: { withinDays: 365, rate: 0.01 }, // 1% if redeemed within 1 year
  debt: { withinDays: 365, rate: 0.005 }, // 0.5% typical
  hybrid: { withinDays: 365, rate: 0.01 },
  liquid: { withinDays: 7, rate: 0.0007 }, // 0.007% for 1 day, 0 after 7 days
  gold_silver: { withinDays: 365, rate: 0.01 }
};

export interface HoldingWithTax {
  name: string;
  productType: string;
  category?: string;
  isin?: string;
  schemeCode?: string;
  currentValue: number;
  investedAmount: number;
  purchaseDate?: Date | string;
  quantity?: number;
  unrealizedGain: number;
  holdingPeriodDays: number;
  taxType: 'STCG' | 'LTCG' | 'SLAB' | 'UNKNOWN';
  isSlabBased: boolean;
  applicableTaxRate: number;
  estimatedTax: number;
  estimatedTaxWithCess: number;
  exitLoad: number;
  exitLoadSource: 'database' | 'generic'; // Whether ISIN-specific or generic exit load was used
  daysToZeroExitLoad: number | null;
  totalCost: number; // Tax + Exit Load
  grandfatheringApplied: boolean;
  grandfatheringBenefit: number;
  grandfatheringUsedActualNav?: boolean; // Whether actual Jan 31, 2018 NAV was used
  grandfatheringNavDate?: string; // Date of NAV used for grandfathering
  taxRegime: 'PRE_BUDGET_2024' | 'POST_BUDGET_2024';
  alerts: TaxAlert[];
}

export interface TaxAlert {
  type: 'HOLDING_PERIOD_ALERT' | 'TAX_LOSS_HARVEST' | 'GRANDFATHERING_ELIGIBLE' | 'STP_RECOMMENDED' | 'WAIT_FOR_LTCG';
  severity: 'info' | 'warning' | 'opportunity';
  message: string;
  potentialSavings?: number;
  daysToWait?: number;
}

export interface LotTaxInfo {
  lotId: string;
  purchaseDate: string;
  purchaseNav: number;
  purchaseValue: number;
  units: number;
  remainingUnits: number;
  currentValue: number;
  holdingPeriodDays: number;
  unrealizedGain: number;
  taxType: 'STCG' | 'LTCG' | 'SLAB';
  applicableTaxRate: number;
  estimatedTax: number;
  exitLoadApplicable: boolean;
  exitLoadPercent: number;
  exitLoadAmount: number;
  daysToLTCG: number | null;
  daysToExitLoadFree: number | null;
  grandfatheringApplied: boolean;
  grandfatheringBenefit: number;
  source: 'purchase' | 'sip' | 'switch_in' | 'bonus';
}

export interface LotWiseTaxSummary {
  holdingName: string;
  isin?: string;
  schemeCode?: string;
  category?: string;
  totalUnits: number;
  totalCurrentValue: number;
  lots: LotTaxInfo[];
  stcgLots: number;
  ltcgLots: number;
  stcgValue: number;
  ltcgValue: number;
  totalSTCGTax: number;
  totalLTCGTax: number;
  totalExitLoad: number;
  optimizedRedemptionOrder: string[];
  alerts: TaxAlert[];
}

export interface TaxSummary {
  totalSTCG: number;
  totalLTCG: number;
  totalSlabGains: number; // For slab-based taxation (debt funds)
  stcgTax: number;
  ltcgTax: number;
  slabTax: number; // Tax on slab-based gains
  surcharge: number;
  cess: number;
  totalTaxLiability: number;
  totalExitLoad: number;
  netRebalancingCost: number;
  taxLossHarvestingOpportunity: number;
  grandfatheringBenefitTotal: number;
  holdings: HoldingWithTax[];
  alerts: TaxAlert[];
  fyBreakdown: FYTaxBreakdown[];
  disclosure: string;
}

export interface FYTaxBreakdown {
  financialYear: string;
  stcgAmount: number;
  ltcgAmount: number;
  slabAmount: number; // For slab-based taxation (debt funds)
  stcgTax: number;
  ltcgTax: number;
  slabTax: number; // Tax on slab-based gains
  totalTax: number;
}

export interface RebalanceRecommendationWithTax {
  action: 'SELL' | 'SWITCH' | 'BUY' | 'HOLD';
  productName: string;
  productType: string;
  currentValue?: number;
  changeAmount?: number;
  suggestedValue?: number;
  taxImplications?: {
    taxType: 'STCG' | 'LTCG' | 'SLAB' | 'UNKNOWN';
    isSlabBased?: boolean;
    estimatedGain: number;
    estimatedTax: number;
    exitLoad: number;
    totalCost: number;
    holdingPeriodDays?: number;
    alerts: TaxAlert[];
  };
  taxEfficientAlternative?: {
    type: 'STP' | 'WAIT_FOR_LTCG' | 'TAX_LOSS_HARVEST';
    description: string;
    potentialSavings: number;
    suggestedAction: string;
  };
}

class ProposalCapitalGainsService {
  
  /**
   * Determine which tax regime applies based on transaction date
   */
  getTaxRegime(transactionDate: Date = new Date()): 'PRE_BUDGET_2024' | 'POST_BUDGET_2024' {
    const budget2024Date = new Date('2024-07-23');
    return transactionDate >= budget2024Date ? 'POST_BUDGET_2024' : 'PRE_BUDGET_2024';
  }

  /**
   * Get asset category for tax purposes
   */
  getAssetCategory(productType: string, category?: string): keyof typeof TAX_REGIMES.POST_BUDGET_2024 {
    const lowerType = productType?.toLowerCase() || '';
    const lowerCategory = category?.toLowerCase() || '';
    
    if (lowerType.includes('debt') || lowerCategory.includes('debt') || 
        lowerCategory.includes('liquid') || lowerCategory.includes('money market') ||
        lowerCategory.includes('gilt') || lowerCategory.includes('corporate bond')) {
      return 'debt';
    }
    
    if (lowerType.includes('gold') || lowerCategory.includes('gold') ||
        lowerType.includes('silver') || lowerCategory.includes('silver')) {
      return 'gold_silver';
    }
    
    if (lowerType.includes('hybrid') || lowerCategory.includes('hybrid')) {
      // Check if equity-oriented or debt-oriented
      if (lowerCategory.includes('aggressive') || lowerCategory.includes('balanced advantage') ||
          lowerCategory.includes('equity savings') || lowerCategory.includes('multi asset')) {
        return 'hybrid_equity';
      }
      return 'hybrid_debt';
    }
    
    // Default to equity for mutual funds, stocks, etc.
    return 'equity';
  }

  /**
   * Calculate holding period in days
   */
  calculateHoldingPeriod(purchaseDate?: Date | string): number {
    if (!purchaseDate) {
      // If no purchase date, assume conservative estimate (less than 1 year for STCG)
      return 180; // 6 months - conservative assumption
    }
    
    const purchase = typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate;
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - purchase.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate grandfathering benefit for equity funds held before Jan 31, 2018
   * Sync version - uses estimated FMV (fallback when no historical data)
   */
  calculateGrandfatheringBenefit(
    purchaseDate: Date | string | undefined,
    investedAmount: number,
    currentValue: number,
    productType: string
  ): { applies: boolean; adjustedCost: number; benefit: number; usedActualNav: boolean } {
    if (!purchaseDate) {
      return { applies: false, adjustedCost: investedAmount, benefit: 0, usedActualNav: false };
    }

    const purchase = typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate;
    const assetCategory = this.getAssetCategory(productType);
    
    // Grandfathering only applies to equity and equity-oriented hybrid
    if (assetCategory !== 'equity' && assetCategory !== 'hybrid_equity') {
      return { applies: false, adjustedCost: investedAmount, benefit: 0, usedActualNav: false };
    }
    
    // Check if purchased before grandfathering date
    if (purchase >= GRANDFATHERING_DATE) {
      return { applies: false, adjustedCost: investedAmount, benefit: 0, usedActualNav: false };
    }
    
    // PLACEHOLDER: Estimate FMV on Jan 31, 2018 using appreciation estimate
    // Use async version with schemeCode for actual NAV lookup
    const estimatedFMV = investedAmount * (1 + GRANDFATHERING_FMV_APPRECIATION_ESTIMATE);
    
    // Cost of acquisition = Higher of (actual cost, lower of (FMV on 31/1/18, sale price))
    const lowerOfFMVAndSale = Math.min(estimatedFMV, currentValue);
    const adjustedCost = Math.max(investedAmount, lowerOfFMVAndSale);
    
    const originalGain = currentValue - investedAmount;
    const adjustedGain = currentValue - adjustedCost;
    const benefit = Math.max(0, originalGain - adjustedGain);
    
    return { applies: true, adjustedCost, benefit, usedActualNav: false };
  }

  /**
   * Calculate grandfathering benefit using actual Jan 31, 2018 NAV from database
   * Async version - uses actual historical NAV data when available
   */
  async calculateGrandfatheringBenefitAsync(params: {
    purchaseDate: Date | string | undefined;
    investedAmount: number;
    currentValue: number;
    productType: string;
    schemeCode?: string;
    units?: number;
  }): Promise<{ applies: boolean; adjustedCost: number; benefit: number; usedActualNav: boolean; navDate?: string }> {
    const { purchaseDate, investedAmount, currentValue, productType, schemeCode, units } = params;
    
    if (!purchaseDate) {
      return { applies: false, adjustedCost: investedAmount, benefit: 0, usedActualNav: false };
    }

    const purchase = typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate;
    const assetCategory = this.getAssetCategory(productType);
    
    // Grandfathering only applies to equity and equity-oriented hybrid
    if (assetCategory !== 'equity' && assetCategory !== 'hybrid_equity') {
      return { applies: false, adjustedCost: investedAmount, benefit: 0, usedActualNav: false };
    }
    
    // Check if purchased before grandfathering date
    if (purchase >= GRANDFATHERING_DATE) {
      return { applies: false, adjustedCost: investedAmount, benefit: 0, usedActualNav: false };
    }
    
    let fmv: number;
    let usedActualNav = false;
    let navDate: string | undefined;
    
    // Try to get actual Jan 31, 2018 NAV from database
    if (schemeCode && units && units > 0) {
      try {
        const grandfatheringNav = await historicalNavService.getGrandfatheringNav(schemeCode);
        if (grandfatheringNav) {
          fmv = grandfatheringNav.nav * units;
          usedActualNav = true;
          navDate = grandfatheringNav.date;
          console.log(`[Grandfathering] Used actual NAV ${grandfatheringNav.nav} from ${navDate} for scheme ${schemeCode}`);
        } else {
          // Fallback to estimate
          fmv = investedAmount * (1 + GRANDFATHERING_FMV_APPRECIATION_ESTIMATE);
          console.log(`[Grandfathering] No historical NAV for scheme ${schemeCode}, using estimate`);
        }
      } catch (error) {
        // Fallback to estimate on error
        fmv = investedAmount * (1 + GRANDFATHERING_FMV_APPRECIATION_ESTIMATE);
        console.log(`[Grandfathering] Error fetching NAV for scheme ${schemeCode}, using estimate`);
      }
    } else {
      // No scheme code or units - use estimate
      fmv = investedAmount * (1 + GRANDFATHERING_FMV_APPRECIATION_ESTIMATE);
    }
    
    // Cost of acquisition = Higher of (actual cost, lower of (FMV on 31/1/18, sale price))
    const lowerOfFMVAndSale = Math.min(fmv, currentValue);
    const adjustedCost = Math.max(investedAmount, lowerOfFMVAndSale);
    
    const originalGain = currentValue - investedAmount;
    const adjustedGain = currentValue - adjustedCost;
    const benefit = Math.max(0, originalGain - adjustedGain);
    
    return { applies: true, adjustedCost, benefit, usedActualNav, navDate };
  }

  /**
   * Calculate exit load (sync version - uses generic rates, kept for backward compatibility)
   */
  calculateExitLoad(
    amount: number,
    holdingPeriodDays: number,
    productType: string,
    category?: string
  ): number {
    const assetCategory = this.getAssetCategory(productType, category);
    let exitLoadRule = EXIT_LOAD_RULES.equity;
    
    if (assetCategory === 'debt') {
      exitLoadRule = category?.toLowerCase().includes('liquid') 
        ? EXIT_LOAD_RULES.liquid 
        : EXIT_LOAD_RULES.debt;
    } else if (assetCategory.includes('hybrid')) {
      exitLoadRule = EXIT_LOAD_RULES.hybrid;
    } else if (assetCategory === 'gold_silver') {
      exitLoadRule = EXIT_LOAD_RULES.gold_silver;
    }
    
    if (holdingPeriodDays <= exitLoadRule.withinDays) {
      return amount * exitLoadRule.rate;
    }
    
    return 0;
  }

  /**
   * Calculate exit load (async version - uses ISIN-specific lookup from centralized ExitLoadService)
   * Falls back to generic rates if ISIN-specific data not available
   */
  async calculateExitLoadAsync(params: {
    amount: number;
    holdingPeriodDays: number;
    productType: string;
    category?: string;
    isin?: string;
    schemeCode?: string;
  }): Promise<{ exitLoad: number; source: 'database' | 'generic'; daysToZeroExitLoad: number | null }> {
    const { amount, holdingPeriodDays, productType, category, isin, schemeCode } = params;
    
    // Try ISIN/schemeCode lookup first
    if (isin || schemeCode) {
      try {
        const result = await exitLoadService.getExitLoad({
          isin,
          schemeCode,
          holdingDays: holdingPeriodDays,
          redemptionAmount: amount,
          category,
          schemeName: undefined
        });
        
        return {
          exitLoad: result.exitLoadAmount,
          source: result.source,
          daysToZeroExitLoad: result.daysToZeroExitLoad
        };
      } catch (error) {
        console.error('[ProposalCapitalGains] Exit load lookup failed, using generic:', error);
      }
    }
    
    // Fallback to generic calculation
    const exitLoad = this.calculateExitLoad(amount, holdingPeriodDays, productType, category);
    return {
      exitLoad,
      source: 'generic',
      daysToZeroExitLoad: null
    };
  }

  /**
   * Calculate surcharge based on total income
   */
  calculateSurcharge(taxAmount: number, totalGains: number): number {
    // For capital gains, maximum surcharge is capped at 15% for LTCG
    const applicableSlab = SURCHARGE_SLABS.find(
      slab => totalGains >= slab.min && totalGains < slab.max
    );
    
    if (!applicableSlab || applicableSlab.rate === 0) {
      return 0;
    }
    
    // Cap surcharge at 15% for long-term capital gains
    const effectiveRate = Math.min(applicableSlab.rate, 0.15);
    return taxAmount * effectiveRate;
  }

  /**
   * Check if asset category is slab-based (no STCG/LTCG distinction)
   */
  isSlabBasedTaxation(assetCategory: string, taxRegime: 'PRE_BUDGET_2024' | 'POST_BUDGET_2024'): boolean {
    const regime = TAX_REGIMES[taxRegime];
    const rules = regime[assetCategory as keyof typeof regime] as any;
    return rules?.stcg?.slabBased === true || rules?.ltcg?.slabBased === true;
  }

  /**
   * Generate tax alerts for a holding
   */
  generateAlerts(
    holding: any,
    holdingPeriodDays: number,
    unrealizedGain: number,
    assetCategory: string,
    taxRegime: 'PRE_BUDGET_2024' | 'POST_BUDGET_2024'
  ): TaxAlert[] {
    const alerts: TaxAlert[] = [];
    const regime = TAX_REGIMES[taxRegime];
    const rules = regime[assetCategory as keyof typeof regime] as any;
    
    if (!rules) return alerts;
    
    // Check if this asset is taxed at slab rate (no STCG/LTCG benefit)
    const isSlabBased = rules.stcg?.slabBased === true;
    
    if (isSlabBased) {
      // For slab-based assets (debt funds post-April 2023), no LTCG wait benefit
      if (unrealizedGain > 0) {
        alerts.push({
          type: 'STP_RECOMMENDED' as any,
          severity: 'info',
          message: 'Debt fund gains are taxed at slab rate (no LTCG benefit). Consider STP to spread gains across FYs.'
        });
      }
    } else {
      const stcgThreshold = rules.stcg.thresholdDays;
      
      // LTCG Exemption info alert (only for equity/equity-hybrid with LTCG gains)
      if (holdingPeriodDays >= stcgThreshold && unrealizedGain > 0 && 
          (assetCategory === 'equity' || assetCategory === 'hybrid_equity')) {
        alerts.push({
          type: 'EXEMPTION_INFO' as any,
          severity: 'info',
          message: '₹1.25L LTCG exemption applies at portfolio level (shared across all equity sales in FY)'
        });
      }
      
      // Holding Period Alert - close to LTCG threshold (only for non-slab-based)
      if (holdingPeriodDays >= stcgThreshold - 90 && holdingPeriodDays < stcgThreshold) {
        const daysToWait = stcgThreshold - holdingPeriodDays;
        const stcgRate = rules.stcg.rate;
        const ltcgRate = rules.ltcg.rate;
        const potentialSavings = unrealizedGain * (stcgRate - ltcgRate);
        
        alerts.push({
          type: 'WAIT_FOR_LTCG',
          severity: 'opportunity',
          message: `Wait ${daysToWait} days to convert STCG (${(stcgRate * 100).toFixed(0)}%) to LTCG (${(ltcgRate * 100).toFixed(1)}%)`,
          potentialSavings: Math.max(0, potentialSavings),
          daysToWait
        });
      }
      
      // STP recommendation for large redemptions (only for non-slab-based with LTCG exemption)
      if (unrealizedGain > 500000 && rules.ltcg?.exemption > 0) {
        alerts.push({
          type: 'STP_RECOMMENDED',
          severity: 'info',
          message: 'Consider STP over 2-3 FYs to spread tax liability and utilize LTCG exemption each year'
        });
      }
    }
    
    // Tax Loss Harvesting opportunity (applies to all asset types)
    if (unrealizedGain < 0) {
      alerts.push({
        type: 'TAX_LOSS_HARVEST',
        severity: 'opportunity',
        message: `Loss of ₹${Math.abs(unrealizedGain).toLocaleString('en-IN')} can offset gains from other holdings`,
        potentialSavings: Math.abs(unrealizedGain) * rules.stcg.rate
      });
    }
    
    // Exit load expiry alert - check if approaching exit load-free date
    const exitLoadDays = holding.exitLoadApplicableDays;
    if (exitLoadDays && holdingPeriodDays > 0) {
      const daysToExitLoadFree = exitLoadDays - holdingPeriodDays;
      
      if (daysToExitLoadFree > 0 && daysToExitLoadFree <= 30) {
        // Within 30 days of exit load expiry
        const exitLoadPercent = holding.exitLoadPercent || 1;
        const currentValue = holding.currentValue || 0;
        const potentialSavings = currentValue * (exitLoadPercent / 100);
        
        alerts.push({
          type: 'HOLDING_PERIOD_ALERT',
          severity: 'opportunity',
          message: `Exit load (${exitLoadPercent}%) expires in ${daysToExitLoadFree} days. Wait to save ₹${potentialSavings.toLocaleString('en-IN')}`,
          potentialSavings,
          daysToWait: daysToExitLoadFree
        });
      } else if (daysToExitLoadFree <= 0) {
        // Exit load free
        alerts.push({
          type: 'HOLDING_PERIOD_ALERT',
          severity: 'info',
          message: 'Exit load period has passed. No exit load applicable on redemption.'
        });
      }
    }
    
    return alerts;
  }
  
  /**
   * Enhanced alert generation with exit load from database
   */
  async generateAlertsAsync(
    holding: any,
    holdingPeriodDays: number,
    unrealizedGain: number,
    assetCategory: string,
    taxRegime: 'PRE_BUDGET_2024' | 'POST_BUDGET_2024'
  ): Promise<TaxAlert[]> {
    // Start with sync alerts
    const alerts = this.generateAlerts(holding, holdingPeriodDays, unrealizedGain, assetCategory, taxRegime);
    
    // Add exit load specific alerts if we have ISIN and can lookup from DB
    if (holding.isin && holding.currentValue > 0) {
      try {
        const exitLoadInfo = await exitLoadService.getExitLoad({
          isin: holding.isin,
          amount: holding.currentValue,
          holdingDays: holdingPeriodDays,
          productType: holding.productType,
          category: holding.category
        });
        
        if (exitLoadInfo.daysToZeroExitLoad !== null && exitLoadInfo.daysToZeroExitLoad > 0) {
          const daysRemaining = exitLoadInfo.daysToZeroExitLoad;
          
          // Check if we already have an exit load alert
          const hasExitLoadAlert = alerts.some(a => 
            a.type === 'HOLDING_PERIOD_ALERT' && a.message.includes('Exit load')
          );
          
          if (!hasExitLoadAlert && daysRemaining <= 60) {
            alerts.push({
              type: 'HOLDING_PERIOD_ALERT',
              severity: daysRemaining <= 15 ? 'opportunity' : 'info',
              message: `Exit load expires in ${daysRemaining} days. Potential savings: ₹${exitLoadInfo.exitLoadAmount.toLocaleString('en-IN')}`,
              potentialSavings: exitLoadInfo.exitLoadAmount,
              daysToWait: daysRemaining
            });
          }
        }
      } catch (error) {
        // Silently continue if exit load lookup fails
      }
    }
    
    return alerts;
  }

  /**
   * Calculate tax for a single holding being sold/switched
   */
  calculateHoldingTax(
    holding: {
      name: string;
      productType: string;
      category?: string;
      currentValue: number;
      investedAmount?: number;
      purchaseDate?: Date | string;
      quantity?: number;
      sellAmount?: number; // Partial or full redemption amount
    },
    transactionDate: Date = new Date()
  ): HoldingWithTax {
    const taxRegime = this.getTaxRegime(transactionDate);
    const regime = TAX_REGIMES[taxRegime];
    const assetCategory = this.getAssetCategory(holding.productType, holding.category);
    const rules = regime[assetCategory as keyof typeof regime] as any;
    
    const currentValue = holding.sellAmount || holding.currentValue;
    const investedAmount = holding.investedAmount || currentValue * 0.85; // Assume 15% gain if not provided
    const holdingPeriodDays = this.calculateHoldingPeriod(holding.purchaseDate);
    
    // Calculate unrealized gain
    let unrealizedGain = currentValue - investedAmount;
    
    // Apply grandfathering if applicable
    const grandfathering = this.calculateGrandfatheringBenefit(
      holding.purchaseDate,
      investedAmount,
      currentValue,
      holding.productType
    );
    
    if (grandfathering.applies) {
      unrealizedGain = currentValue - grandfathering.adjustedCost;
    }
    
    // Check if this is slab-based taxation (debt funds post-April 2023)
    const isSlabBased = rules?.stcg?.slabBased === true;
    
    let taxType: 'STCG' | 'LTCG' | 'SLAB' | 'UNKNOWN';
    let applicableTaxRate: number;
    let taxableGain = unrealizedGain;
    
    if (isSlabBased) {
      // Slab-based taxation - no STCG/LTCG distinction
      // All gains taxed at investor's slab rate (using 30% as conservative estimate)
      taxType = 'SLAB';
      applicableTaxRate = rules?.stcg?.rate || 0.30; // Use the slab rate (30%)
      // No exemption for slab-based taxation
      taxableGain = unrealizedGain;
    } else {
      // Normal STCG/LTCG classification
      const isSTCG = holdingPeriodDays < (rules?.stcg?.thresholdDays || 365);
      taxType = isSTCG ? 'STCG' : 'LTCG';
      
      // Get applicable rate
      applicableTaxRate = isSTCG ? rules?.stcg?.rate || 0.20 : rules?.ltcg?.rate || 0.125;
      
      // NOTE: LTCG exemption (₹1.25L) is applied at PORTFOLIO level, not per-holding
      // Per-holding tax shows the full liability before exemption
      // The exemption is shared across all equity LTCG in a financial year
      // taxableGain remains as unrealizedGain (exemption applied in portfolio summary)
    }
    
    // Calculate base tax
    let estimatedTax = Math.max(0, taxableGain * applicableTaxRate);
    
    // Add cess
    const cess = estimatedTax * CESS_RATE;
    const estimatedTaxWithCess = estimatedTax + cess;
    
    // Calculate exit load (sync - uses generic rates)
    const exitLoad = this.calculateExitLoad(currentValue, holdingPeriodDays, holding.productType, holding.category);
    
    // Generate alerts
    const alerts = this.generateAlerts(holding, holdingPeriodDays, unrealizedGain, assetCategory, taxRegime);
    
    return {
      name: holding.name,
      productType: holding.productType,
      category: holding.category,
      currentValue,
      investedAmount,
      purchaseDate: holding.purchaseDate,
      quantity: holding.quantity,
      unrealizedGain,
      holdingPeriodDays,
      taxType,
      isSlabBased,
      applicableTaxRate,
      estimatedTax,
      estimatedTaxWithCess,
      exitLoad,
      exitLoadSource: 'generic' as const,
      daysToZeroExitLoad: null,
      totalCost: estimatedTaxWithCess + exitLoad,
      grandfatheringApplied: grandfathering.applies,
      grandfatheringBenefit: grandfathering.benefit,
      taxRegime,
      alerts
    };
  }

  /**
   * Calculate tax for a single holding being sold/switched (async version with ISIN-specific exit load)
   */
  async calculateHoldingTaxAsync(
    holding: {
      name: string;
      productType: string;
      category?: string;
      isin?: string;
      schemeCode?: string;
      currentValue: number;
      investedAmount?: number;
      purchaseDate?: Date | string;
      quantity?: number;
      sellAmount?: number;
    },
    transactionDate: Date = new Date()
  ): Promise<HoldingWithTax> {
    if (USE_SANDBOX_API_FOR_TAX && SANDBOX_TAX_API_AVAILABLE) {
      try {
        const result = await this.calculateHoldingTaxWithSandboxAPI(holding, transactionDate);
        console.log(`[CapitalGains] Using Sandbox API for ${holding.name}`);
        return result;
      } catch (error) {
        console.warn(`[CapitalGains] Sandbox API failed for ${holding.name}, using local calculation:`, error);
      }
    }

    const taxRegime = this.getTaxRegime(transactionDate);
    const regime = TAX_REGIMES[taxRegime];
    const assetCategory = this.getAssetCategory(holding.productType, holding.category);
    const rules = regime[assetCategory as keyof typeof regime] as any;
    
    const currentValue = holding.sellAmount || holding.currentValue;
    const investedAmount = holding.investedAmount || currentValue * 0.85;
    const holdingPeriodDays = this.calculateHoldingPeriod(holding.purchaseDate);
    
    let unrealizedGain = currentValue - investedAmount;
    
    // Use async grandfathering with actual Jan 31, 2018 NAV lookup when possible
    const grandfathering = await this.calculateGrandfatheringBenefitAsync({
      purchaseDate: holding.purchaseDate,
      investedAmount,
      currentValue,
      productType: holding.productType,
      schemeCode: holding.schemeCode,
      units: holding.quantity
    });
    
    if (grandfathering.applies) {
      unrealizedGain = currentValue - grandfathering.adjustedCost;
    }
    
    const isSlabBased = rules?.stcg?.slabBased === true;
    
    let taxType: 'STCG' | 'LTCG' | 'SLAB' | 'UNKNOWN';
    let applicableTaxRate: number;
    let taxableGain = unrealizedGain;
    
    if (isSlabBased) {
      taxType = 'SLAB';
      applicableTaxRate = rules?.stcg?.rate || 0.30;
      taxableGain = unrealizedGain;
    } else {
      const isSTCG = holdingPeriodDays < (rules?.stcg?.thresholdDays || 365);
      taxType = isSTCG ? 'STCG' : 'LTCG';
      applicableTaxRate = isSTCG ? rules?.stcg?.rate || 0.20 : rules?.ltcg?.rate || 0.125;
      
      // NOTE: LTCG exemption (₹1.25L) is applied at PORTFOLIO level, not per-holding
      // Per-holding tax shows the full liability before exemption
      // The exemption is shared across all equity LTCG in a financial year
    }
    
    let estimatedTax = Math.max(0, taxableGain * applicableTaxRate);
    const cess = estimatedTax * CESS_RATE;
    const estimatedTaxWithCess = estimatedTax + cess;
    
    // Calculate exit load using centralized service (ISIN-specific lookup)
    const exitLoadResult = await this.calculateExitLoadAsync({
      amount: currentValue,
      holdingPeriodDays,
      productType: holding.productType,
      category: holding.category,
      isin: holding.isin,
      schemeCode: holding.schemeCode
    });
    
    // Use async alerts with ISIN-based exit load lookup
    const alerts = await this.generateAlertsAsync(holding, holdingPeriodDays, unrealizedGain, assetCategory, taxRegime);
    
    return {
      name: holding.name,
      productType: holding.productType,
      category: holding.category,
      isin: holding.isin,
      schemeCode: holding.schemeCode,
      currentValue,
      investedAmount,
      purchaseDate: holding.purchaseDate,
      quantity: holding.quantity,
      unrealizedGain,
      holdingPeriodDays,
      taxType,
      isSlabBased,
      applicableTaxRate,
      estimatedTax,
      estimatedTaxWithCess,
      exitLoad: exitLoadResult.exitLoad,
      exitLoadSource: exitLoadResult.source,
      daysToZeroExitLoad: exitLoadResult.daysToZeroExitLoad,
      totalCost: estimatedTaxWithCess + exitLoadResult.exitLoad,
      grandfatheringApplied: grandfathering.applies,
      grandfatheringBenefit: grandfathering.benefit,
      grandfatheringUsedActualNav: grandfathering.usedActualNav,
      grandfatheringNavDate: grandfathering.navDate,
      taxRegime,
      alerts
    };
  }

  /**
   * Calculate tax using Sandbox.co.in Tax P&L API for accurate, up-to-date rates
   * Falls back to local calculation if API is unavailable
   */
  async calculateHoldingTaxWithSandboxAPI(
    holding: {
      name: string;
      productType: string;
      category?: string;
      isin?: string;
      schemeCode?: string;
      currentValue: number;
      investedAmount?: number;
      purchaseDate?: Date | string;
      quantity?: number;
      sellAmount?: number;
    },
    transactionDate: Date = new Date()
  ): Promise<HoldingWithTax & { taxRateSource: 'SANDBOX_API' | 'LOCAL_FALLBACK' }> {
    const currentValue = holding.sellAmount || holding.currentValue;
    const investedAmount = holding.investedAmount || currentValue * 0.85;
    const holdingPeriodDays = this.calculateHoldingPeriod(holding.purchaseDate);
    const purchaseDateStr = this.formatPurchaseDate(holding.purchaseDate);

    if (sandboxCapitalGainsService.isServiceAvailable() && purchaseDateStr) {
      try {
        const sandboxAssetType = this.mapToSandboxAssetType(holding.productType, holding.category);
        
        const sandboxResult = await sandboxCapitalGainsService.calculateSingleHoldingTax({
          productName: holding.name,
          isin: holding.isin,
          assetType: sandboxAssetType,
          purchaseDate: purchaseDateStr,
          purchaseValue: investedAmount,
          currentValue,
          quantity: holding.quantity || 1,
          category: holding.category,
        });

        const exitLoadResult = await this.calculateExitLoadAsync({
          amount: currentValue,
          holdingPeriodDays,
          productType: holding.productType,
          category: holding.category,
          isin: holding.isin,
          schemeCode: holding.schemeCode
        });

        const estimatedTaxWithCess = sandboxResult.estimatedTax * (1 + CESS_RATE);
        
        console.log(`[CapitalGains] Using Sandbox API rates for ${holding.name}: ${sandboxResult.taxType} @ ${(sandboxResult.applicableTaxRate * 100).toFixed(1)}%`);

        return {
          name: holding.name,
          productType: holding.productType,
          category: holding.category,
          isin: holding.isin,
          schemeCode: holding.schemeCode,
          currentValue,
          investedAmount,
          purchaseDate: holding.purchaseDate,
          quantity: holding.quantity,
          unrealizedGain: sandboxResult.unrealizedGain,
          holdingPeriodDays: sandboxResult.holdingPeriodDays,
          taxType: sandboxResult.taxType === 'SLAB' ? 'SLAB' : sandboxResult.taxType,
          isSlabBased: sandboxResult.taxType === 'SLAB',
          applicableTaxRate: sandboxResult.applicableTaxRate,
          estimatedTax: sandboxResult.estimatedTax,
          estimatedTaxWithCess,
          exitLoad: exitLoadResult.exitLoad,
          exitLoadSource: exitLoadResult.source,
          daysToZeroExitLoad: exitLoadResult.daysToZeroExitLoad,
          totalCost: estimatedTaxWithCess + exitLoadResult.exitLoad,
          grandfatheringApplied: false,
          grandfatheringBenefit: sandboxResult.indexationBenefit || 0,
          taxRegime: 'POST_BUDGET_2024',
          alerts: [],
          taxRateSource: 'SANDBOX_API',
        };
      } catch (error) {
        console.warn(`[CapitalGains] Sandbox API failed for ${holding.name}, using local fallback:`, error);
      }
    }

    const localResult = await this.calculateHoldingTaxAsync(holding, transactionDate);
    return {
      ...localResult,
      taxRateSource: 'LOCAL_FALLBACK',
    };
  }

  /**
   * Get current tax rates from Sandbox API or local fallback
   */
  async getCurrentTaxRates(): Promise<{
    stcgEquity: number;
    ltcgEquity: number;
    stcgDebt: number;
    ltcgDebt: number;
    ltcgExemptionLimit: number;
    effectiveDate: string;
    source: 'SANDBOX_API' | 'LOCAL_FALLBACK';
  }> {
    return sandboxCapitalGainsService.getCurrentTaxRates();
  }

  private mapToSandboxAssetType(productType: string, category?: string): SandboxAssetType {
    const type = productType.toLowerCase();
    const cat = category?.toLowerCase() || '';
    
    if (type.includes('equity') || type.includes('stock')) return 'equity';
    if (type.includes('etf')) return 'etf';
    if (type.includes('bond')) return 'bond';
    if (type.includes('debt') || cat.includes('debt') || cat.includes('liquid') || cat.includes('money market')) return 'debt_fund';
    if (type.includes('derivative') || type.includes('future') || type.includes('option')) return 'derivative';
    if (type.includes('mutual') || type.includes('mf') || type === 'fund') {
      if (cat.includes('equity') || cat.includes('large cap') || cat.includes('mid cap') || cat.includes('small cap') || cat.includes('flexi') || cat.includes('elss')) {
        return 'mutual_fund';
      }
      if (cat.includes('debt') || cat.includes('liquid') || cat.includes('gilt') || cat.includes('money')) {
        return 'debt_fund';
      }
      return 'mutual_fund';
    }
    return 'equity';
  }

  private formatPurchaseDate(purchaseDate?: Date | string): string | null {
    if (!purchaseDate) return null;
    
    if (purchaseDate instanceof Date) {
      return purchaseDate.toISOString().split('T')[0];
    }
    
    if (typeof purchaseDate === 'string') {
      const parsed = new Date(purchaseDate);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    
    return null;
  }

  /**
   * Calculate comprehensive tax summary for portfolio rebalancing
   */
  calculateRebalancingTaxSummary(
    holdings: Array<{
      name: string;
      productType: string;
      category?: string;
      currentValue: number;
      investedAmount?: number;
      purchaseDate?: Date | string;
      quantity?: number;
      action: 'SELL' | 'SWITCH' | 'HOLD';
      changeAmount?: number;
    }>,
    transactionDate: Date = new Date()
  ): TaxSummary {
    const holdingsWithTax: HoldingWithTax[] = [];
    let totalSTCG = 0;
    let totalLTCG = 0;
    let totalSlabGains = 0; // For slab-based taxation (debt funds)
    let stcgTax = 0;
    let ltcgTax = 0;
    let slabTax = 0; // Tax on slab-based gains
    let totalExitLoad = 0;
    let taxLossHarvestingOpportunity = 0;
    let grandfatheringBenefitTotal = 0;
    const allAlerts: TaxAlert[] = [];
    
    for (const holding of holdings) {
      if (holding.action === 'HOLD') continue;
      
      const sellAmount = holding.action === 'SELL' 
        ? Math.abs(holding.changeAmount || holding.currentValue)
        : holding.currentValue;
      
      const taxInfo = this.calculateHoldingTax({
        ...holding,
        sellAmount
      }, transactionDate);
      
      holdingsWithTax.push(taxInfo);
      
      if (taxInfo.unrealizedGain > 0) {
        if (taxInfo.taxType === 'SLAB' || taxInfo.isSlabBased) {
          // Slab-based taxation (debt funds post-April 2023)
          totalSlabGains += taxInfo.unrealizedGain;
          slabTax += taxInfo.estimatedTax;
        } else if (taxInfo.taxType === 'STCG') {
          totalSTCG += taxInfo.unrealizedGain;
          stcgTax += taxInfo.estimatedTax;
        } else if (taxInfo.taxType === 'LTCG') {
          totalLTCG += taxInfo.unrealizedGain;
          ltcgTax += taxInfo.estimatedTax;
        }
      } else {
        taxLossHarvestingOpportunity += Math.abs(taxInfo.unrealizedGain);
      }
      
      totalExitLoad += taxInfo.exitLoad;
      grandfatheringBenefitTotal += taxInfo.grandfatheringBenefit;
      allAlerts.push(...taxInfo.alerts);
    }
    
    // Calculate surcharge on total gains (including slab-based)
    const totalGains = totalSTCG + totalLTCG + totalSlabGains;
    const totalBaseTax = stcgTax + ltcgTax + slabTax;
    const surcharge = this.calculateSurcharge(totalBaseTax, totalGains);
    
    // Calculate cess on (tax + surcharge)
    const cess = (totalBaseTax + surcharge) * CESS_RATE;
    
    const totalTaxLiability = totalBaseTax + surcharge + cess;
    const netRebalancingCost = totalTaxLiability + totalExitLoad;
    
    // Generate FY breakdown (current FY and next FY for STP planning)
    const fyBreakdown = this.generateFYBreakdown(holdingsWithTax, transactionDate);
    
    // Generate disclosure
    const disclosure = this.generateTaxDisclosure(transactionDate);
    
    return {
      totalSTCG,
      totalLTCG,
      totalSlabGains,
      stcgTax,
      ltcgTax,
      slabTax,
      surcharge,
      cess,
      totalTaxLiability,
      totalExitLoad,
      netRebalancingCost,
      taxLossHarvestingOpportunity,
      grandfatheringBenefitTotal,
      holdings: holdingsWithTax,
      alerts: allAlerts,
      fyBreakdown,
      disclosure
    };
  }

  /**
   * Generate FY-wise tax breakdown
   */
  generateFYBreakdown(holdings: HoldingWithTax[], transactionDate: Date): FYTaxBreakdown[] {
    const currentFY = this.getCurrentFY(transactionDate);
    const nextFY = this.getNextFY(currentFY);
    
    // All transactions in current request assumed in current FY
    const currentFYTotal = holdings.reduce((acc, h) => {
      if (h.taxType === 'SLAB' || h.isSlabBased) {
        // Slab-based taxation (debt funds)
        acc.slabAmount += h.unrealizedGain;
        acc.slabTax += h.estimatedTax;
      } else if (h.taxType === 'STCG') {
        acc.stcgAmount += h.unrealizedGain;
        acc.stcgTax += h.estimatedTax;
      } else if (h.taxType === 'LTCG') {
        acc.ltcgAmount += h.unrealizedGain;
        acc.ltcgTax += h.estimatedTax;
      }
      return acc;
    }, { stcgAmount: 0, ltcgAmount: 0, slabAmount: 0, stcgTax: 0, ltcgTax: 0, slabTax: 0 });
    
    return [
      {
        financialYear: currentFY,
        stcgAmount: currentFYTotal.stcgAmount,
        ltcgAmount: currentFYTotal.ltcgAmount,
        slabAmount: currentFYTotal.slabAmount,
        stcgTax: currentFYTotal.stcgTax,
        ltcgTax: currentFYTotal.ltcgTax,
        slabTax: currentFYTotal.slabTax,
        totalTax: currentFYTotal.stcgTax + currentFYTotal.ltcgTax + currentFYTotal.slabTax
      },
      {
        financialYear: nextFY,
        stcgAmount: 0,
        ltcgAmount: 0,
        slabAmount: 0,
        stcgTax: 0,
        ltcgTax: 0,
        slabTax: 0,
        totalTax: 0
      }
    ];
  }

  /**
   * Get current financial year string
   */
  getCurrentFY(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    
    if (month >= 3) { // April onwards
      return `FY ${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `FY ${year - 1}-${year.toString().slice(-2)}`;
    }
  }

  /**
   * Get next financial year string
   */
  getNextFY(currentFY: string): string {
    const match = currentFY.match(/FY (\d{4})-(\d{2})/);
    if (!match) return 'FY 2025-26';
    
    const startYear = parseInt(match[1]) + 1;
    const endYear = (startYear + 1).toString().slice(-2);
    return `FY ${startYear}-${endYear}`;
  }

  /**
   * Generate tax disclosure text
   */
  generateTaxDisclosure(transactionDate: Date = new Date()): string {
    const taxRegime = this.getTaxRegime(transactionDate);
    const isPostBudget = taxRegime === 'POST_BUDGET_2024';
    
    return `
**Capital Gains Tax Disclosure**

The tax estimates provided are based on the ${isPostBudget ? 'Union Budget 2024 (effective July 23, 2024)' : 'pre-July 2024 Budget'} tax rates:

**Equity & Equity-Oriented Funds:**
• Short-Term Capital Gains (STCG): ${isPostBudget ? '20%' : '15%'} (holding period < 1 year)
• Long-Term Capital Gains (LTCG): ${isPostBudget ? '12.5%' : '10%'} (holding period ≥ 1 year)
• LTCG Exemption: ₹${isPostBudget ? '1.25 Lakh' : '1 Lakh'} per financial year

**Debt Funds:**
${isPostBudget ? 
`• STCG: 20% (holding period < 2 years)
• LTCG: 12.5% (holding period ≥ 2 years)` : 
`• For funds purchased after April 1, 2023: ALL gains taxed at investor's slab rate
• No STCG/LTCG distinction - estimated at 30% (highest slab) for conservative calculation
• Indexation benefit removed for debt funds`}

**Gold/Silver Funds:**
• STCG: ${isPostBudget ? '20%' : 'As per slab'} (holding period < ${isPostBudget ? '2' : '3'} years)
• LTCG: ${isPostBudget ? '12.5%' : '20% with indexation'}

**Additional Charges:**
• Surcharge: 0-15% based on total income (capped at 15% for LTCG)
• Health & Education Cess: 4% on tax + surcharge
• Exit Load: As per fund scheme (typically 1% within 1 year)

**Grandfathering Benefit (PLACEHOLDER):**
For equity funds purchased before January 31, 2018, a grandfathering benefit applies. **Note:** Without actual NAV data from Jan 31, 2018, we use an estimated 40% appreciation from purchase date as a placeholder. Actual benefit may differ significantly - verify with your fund house or tax advisor.

**Important Notes:**
1. These are ESTIMATED calculations based on available data and assumptions
2. Actual tax liability may vary based on your overall income and tax situation
3. Purchase dates are assumed where not provided (conservative 6-month STCG assumption)
4. Debt fund taxation uses 30% slab rate estimate for high-income investors
5. Please consult a qualified tax advisor before making investment decisions
6. Tax laws are subject to change

_This is not tax advice. Consult your CA/Tax Advisor for personalized guidance._
    `.trim();
  }

  /**
   * Add tax implications to rebalancing recommendations
   */
  enrichRecommendationsWithTax(
    recommendations: any[],
    portfolioHoldings: any[],
    transactionDate: Date = new Date()
  ): RebalanceRecommendationWithTax[] {
    return recommendations.map(rec => {
      if (rec.action !== 'SELL' && rec.action !== 'SWITCH') {
        return rec as RebalanceRecommendationWithTax;
      }
      
      // Find matching holding
      const holding = portfolioHoldings.find(h => 
        h.name === rec.productName || h.productName === rec.productName
      );
      
      if (!holding) {
        return {
          ...rec,
          taxImplications: {
            taxType: 'UNKNOWN' as const,
            estimatedGain: 0,
            estimatedTax: 0,
            exitLoad: 0,
            totalCost: 0,
            alerts: []
          }
        };
      }
      
      const sellAmount = Math.abs(rec.changeAmount || holding.currentValue);
      const proportionalInvested = holding.investedAmount 
        ? (holding.investedAmount * sellAmount / holding.currentValue)
        : sellAmount * 0.85;
      
      const taxInfo = this.calculateHoldingTax({
        name: holding.name || rec.productName,
        productType: holding.productType || 'mutual_fund',
        category: holding.category,
        currentValue: sellAmount,
        investedAmount: proportionalInvested,
        purchaseDate: holding.purchaseDate,
        quantity: holding.quantity
      }, transactionDate);
      
      const enrichedRec: RebalanceRecommendationWithTax = {
        ...rec,
        taxImplications: {
          taxType: taxInfo.taxType,
          estimatedGain: taxInfo.unrealizedGain,
          estimatedTax: taxInfo.estimatedTaxWithCess,
          exitLoad: taxInfo.exitLoad,
          totalCost: taxInfo.totalCost,
          holdingPeriodDays: taxInfo.holdingPeriodDays,
          alerts: taxInfo.alerts
        }
      };
      
      // Add tax-efficient alternative if applicable
      const waitAlert = taxInfo.alerts.find(a => a.type === 'WAIT_FOR_LTCG');
      const stpAlert = taxInfo.alerts.find(a => a.type === 'STP_RECOMMENDED');
      
      if (waitAlert && waitAlert.daysToWait && waitAlert.daysToWait <= 90) {
        enrichedRec.taxEfficientAlternative = {
          type: 'WAIT_FOR_LTCG',
          description: `Wait ${waitAlert.daysToWait} days to qualify for LTCG (lower tax rate)`,
          potentialSavings: waitAlert.potentialSavings || 0,
          suggestedAction: `Defer redemption until ${new Date(Date.now() + waitAlert.daysToWait * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}`
        };
      } else if (stpAlert) {
        enrichedRec.taxEfficientAlternative = {
          type: 'STP',
          description: 'Use Systematic Transfer Plan to spread gains across financial years',
          potentialSavings: taxInfo.estimatedTax * 0.3, // Rough estimate of savings
          suggestedAction: 'Set up monthly STP over 12-24 months to utilize LTCG exemption each FY'
        };
      }
      
      return enrichedRec;
    });
  }

  /**
   * Calculate lot-wise capital gains for SIP investments
   * Each SIP installment is treated as a separate lot with its own holding period
   */
  calculateLotWiseTax(
    holdingName: string,
    lots: Array<{
      id: string;
      purchaseDate: string;
      purchaseNav: number;
      purchaseValue: number;
      units: number;
      remainingUnits: number;
      source: 'purchase' | 'sip' | 'switch_in' | 'bonus';
    }>,
    currentNav: number,
    productType: string = 'mutual_fund',
    category?: string,
    isin?: string,
    schemeCode?: string,
    exitLoadDays?: number,
    exitLoadPercent?: number,
    transactionDate: Date = new Date()
  ): LotWiseTaxSummary {
    const taxRegime = this.getTaxRegime(transactionDate);
    const regime = TAX_REGIMES[taxRegime];
    const assetCategory = this.getAssetCategory(productType, category);
    const rules = regime[assetCategory as keyof typeof regime] as any;
    const isSlabBased = rules?.stcg?.slabBased === true;
    const stcgThreshold = rules?.stcg?.thresholdDays || 365;
    
    const lotTaxInfos: LotTaxInfo[] = [];
    let totalSTCGTax = 0;
    let totalLTCGTax = 0;
    let totalExitLoad = 0;
    let stcgLots = 0;
    let ltcgLots = 0;
    let stcgValue = 0;
    let ltcgValue = 0;
    const alerts: TaxAlert[] = [];
    
    for (const lot of lots) {
      if (lot.remainingUnits <= 0) continue;
      
      const holdingPeriodDays = this.calculateHoldingPeriod(lot.purchaseDate);
      const lotCurrentValue = lot.remainingUnits * currentNav;
      const lotPurchaseValue = lot.remainingUnits * lot.purchaseNav;
      const unrealizedGain = lotCurrentValue - lotPurchaseValue;
      
      // Determine tax type
      let taxType: 'STCG' | 'LTCG' | 'SLAB';
      let applicableTaxRate: number;
      let estimatedTax: number;
      
      if (isSlabBased) {
        taxType = 'SLAB';
        applicableTaxRate = rules.stcg.rate;
        estimatedTax = Math.max(0, unrealizedGain * applicableTaxRate);
      } else if (holdingPeriodDays < stcgThreshold) {
        taxType = 'STCG';
        applicableTaxRate = rules.stcg.rate;
        estimatedTax = Math.max(0, unrealizedGain * applicableTaxRate);
        stcgLots++;
        stcgValue += lotCurrentValue;
        totalSTCGTax += estimatedTax;
      } else {
        taxType = 'LTCG';
        applicableTaxRate = rules.ltcg.rate;
        estimatedTax = Math.max(0, unrealizedGain * applicableTaxRate);
        ltcgLots++;
        ltcgValue += lotCurrentValue;
        totalLTCGTax += estimatedTax;
      }
      
      // Calculate exit load
      let exitLoadApplicable = false;
      let exitLoadAmount = 0;
      const effectiveExitLoadDays = exitLoadDays || 365;
      const effectiveExitLoadPercent = exitLoadPercent || 1;
      
      if (holdingPeriodDays < effectiveExitLoadDays) {
        exitLoadApplicable = true;
        exitLoadAmount = lotCurrentValue * (effectiveExitLoadPercent / 100);
        totalExitLoad += exitLoadAmount;
      }
      
      // Calculate days to LTCG and exit load free
      const daysToLTCG = holdingPeriodDays < stcgThreshold 
        ? stcgThreshold - holdingPeriodDays 
        : null;
      const daysToExitLoadFree = holdingPeriodDays < effectiveExitLoadDays 
        ? effectiveExitLoadDays - holdingPeriodDays 
        : null;
      
      // Check grandfathering
      const grandfathering = this.calculateGrandfatheringBenefit(
        lot.purchaseDate,
        lotPurchaseValue,
        lotCurrentValue,
        productType
      );
      
      lotTaxInfos.push({
        lotId: lot.id,
        purchaseDate: lot.purchaseDate,
        purchaseNav: lot.purchaseNav,
        purchaseValue: lotPurchaseValue,
        units: lot.units,
        remainingUnits: lot.remainingUnits,
        currentValue: lotCurrentValue,
        holdingPeriodDays,
        unrealizedGain,
        taxType,
        applicableTaxRate,
        estimatedTax,
        exitLoadApplicable,
        exitLoadPercent: effectiveExitLoadPercent,
        exitLoadAmount,
        daysToLTCG,
        daysToExitLoadFree,
        grandfatheringApplied: grandfathering.applies,
        grandfatheringBenefit: grandfathering.benefit,
        source: lot.source
      });
    }
    
    // Sort for optimized redemption order (LTCG first, then by days to LTCG desc)
    const optimizedLots = [...lotTaxInfos].sort((a, b) => {
      if (a.taxType === 'LTCG' && b.taxType !== 'LTCG') return -1;
      if (a.taxType !== 'LTCG' && b.taxType === 'LTCG') return 1;
      if (!a.exitLoadApplicable && b.exitLoadApplicable) return -1;
      if (a.exitLoadApplicable && !b.exitLoadApplicable) return 1;
      return (a.daysToLTCG || 0) - (b.daysToLTCG || 0);
    });
    
    // Generate alerts
    const lotsNearLTCG = lotTaxInfos.filter(l => l.daysToLTCG !== null && l.daysToLTCG <= 30);
    if (lotsNearLTCG.length > 0) {
      const totalValueNearLTCG = lotsNearLTCG.reduce((sum, l) => sum + l.currentValue, 0);
      const potentialSavings = lotsNearLTCG.reduce((sum, l) => sum + l.estimatedTax * 0.5, 0);
      alerts.push({
        type: 'WAIT_FOR_LTCG',
        severity: 'opportunity',
        message: `${lotsNearLTCG.length} SIP lots (₹${totalValueNearLTCG.toLocaleString('en-IN')}) will convert to LTCG within 30 days`,
        potentialSavings,
        daysToWait: Math.max(...lotsNearLTCG.map(l => l.daysToLTCG || 0))
      });
    }
    
    const lotsNearExitLoadFree = lotTaxInfos.filter(l => l.daysToExitLoadFree !== null && l.daysToExitLoadFree <= 30 && l.exitLoadApplicable);
    if (lotsNearExitLoadFree.length > 0) {
      const potentialSavings = lotsNearExitLoadFree.reduce((sum, l) => sum + l.exitLoadAmount, 0);
      alerts.push({
        type: 'HOLDING_PERIOD_ALERT',
        severity: 'opportunity',
        message: `${lotsNearExitLoadFree.length} SIP lots will become exit load-free within 30 days. Potential savings: ₹${potentialSavings.toLocaleString('en-IN')}`,
        potentialSavings,
        daysToWait: Math.max(...lotsNearExitLoadFree.map(l => l.daysToExitLoadFree || 0))
      });
    }
    
    return {
      holdingName,
      isin,
      schemeCode,
      category,
      totalUnits: lotTaxInfos.reduce((sum, l) => sum + l.remainingUnits, 0),
      totalCurrentValue: lotTaxInfos.reduce((sum, l) => sum + l.currentValue, 0),
      lots: lotTaxInfos,
      stcgLots,
      ltcgLots,
      stcgValue,
      ltcgValue,
      totalSTCGTax,
      totalLTCGTax,
      totalExitLoad,
      optimizedRedemptionOrder: optimizedLots.map(l => l.lotId),
      alerts
    };
  }

  /**
   * Get optimized redemption strategy for a given amount
   * Returns which lots to redeem and in what order to minimize tax
   */
  getOptimizedRedemptionPlan(
    lotWiseSummary: LotWiseTaxSummary,
    targetAmount: number,
    strategy: 'tax_efficient' | 'exit_load_efficient' | 'fifo' = 'tax_efficient'
  ): {
    lotsToRedeem: Array<{ lotId: string; unitsToRedeem: number; value: number; taxType: string; tax: number; exitLoad: number }>;
    totalValue: number;
    totalTax: number;
    totalExitLoad: number;
    unredeemed: number;
    recommendation: string;
  } {
    let sortedLots: LotTaxInfo[];
    
    switch (strategy) {
      case 'tax_efficient':
        // Prioritize LTCG lots, then lots with no exit load, then by holding period
        sortedLots = [...lotWiseSummary.lots].sort((a, b) => {
          if (a.taxType === 'LTCG' && b.taxType !== 'LTCG') return -1;
          if (a.taxType !== 'LTCG' && b.taxType === 'LTCG') return 1;
          if (!a.exitLoadApplicable && b.exitLoadApplicable) return -1;
          if (a.exitLoadApplicable && !b.exitLoadApplicable) return 1;
          return b.holdingPeriodDays - a.holdingPeriodDays;
        });
        break;
      case 'exit_load_efficient':
        // Prioritize lots with no exit load
        sortedLots = [...lotWiseSummary.lots].sort((a, b) => {
          if (!a.exitLoadApplicable && b.exitLoadApplicable) return -1;
          if (a.exitLoadApplicable && !b.exitLoadApplicable) return 1;
          return b.holdingPeriodDays - a.holdingPeriodDays;
        });
        break;
      case 'fifo':
        // First in, first out - oldest lots first
        sortedLots = [...lotWiseSummary.lots].sort((a, b) => 
          b.holdingPeriodDays - a.holdingPeriodDays
        );
        break;
    }
    
    const lotsToRedeem: Array<{ lotId: string; unitsToRedeem: number; value: number; taxType: string; tax: number; exitLoad: number }> = [];
    let remainingAmount = targetAmount;
    let totalValue = 0;
    let totalTax = 0;
    let totalExitLoad = 0;
    
    for (const lot of sortedLots) {
      if (remainingAmount <= 0) break;
      if (lot.remainingUnits <= 0) continue;
      
      const lotValue = lot.currentValue;
      const redeemValue = Math.min(lotValue, remainingAmount);
      const redeemRatio = redeemValue / lotValue;
      const unitsToRedeem = lot.remainingUnits * redeemRatio;
      
      const tax = lot.estimatedTax * redeemRatio;
      const exitLoad = lot.exitLoadApplicable ? lot.exitLoadAmount * redeemRatio : 0;
      
      lotsToRedeem.push({
        lotId: lot.lotId,
        unitsToRedeem,
        value: redeemValue,
        taxType: lot.taxType,
        tax,
        exitLoad
      });
      
      totalValue += redeemValue;
      totalTax += tax;
      totalExitLoad += exitLoad;
      remainingAmount -= redeemValue;
    }
    
    let recommendation = '';
    if (strategy === 'tax_efficient') {
      recommendation = `Tax-efficient redemption prioritizes LTCG lots to minimize tax outgo. Total estimated tax: ₹${totalTax.toLocaleString('en-IN')}`;
    } else if (strategy === 'exit_load_efficient') {
      recommendation = `Exit load-efficient redemption prioritizes lots past exit load period. Total exit load: ₹${totalExitLoad.toLocaleString('en-IN')}`;
    } else {
      recommendation = `FIFO redemption follows standard first-in-first-out order as per tax rules.`;
    }
    
    return {
      lotsToRedeem,
      totalValue,
      totalTax,
      totalExitLoad,
      unredeemed: Math.max(0, targetAmount - totalValue),
      recommendation
    };
  }

  /**
   * Generate tax-efficient sell timing advice for AI recommendations
   * Returns actionable insights about when to sell holdings for optimal tax efficiency
   */
  async generateTaxEfficientSellAdvice(holdings: Array<{
    name: string;
    productType: string;
    category?: string;
    isin?: string;
    schemeCode?: string;
    currentValue: number;
    investedAmount?: number;
    purchaseDate?: Date | string;
    quantity?: number;
    unrealizedGain?: number;
  }>): Promise<{
    holdingsWithAdvice: Array<{
      name: string;
      isin?: string;
      currentValue: number;
      unrealizedGain: number;
      taxType: 'STCG' | 'LTCG' | 'SLAB' | 'UNKNOWN';
      daysToLTCG: number | null;
      daysToExitLoadFree: number | null;
      sellAdvice: 'SELL_NOW' | 'WAIT_FOR_LTCG' | 'WAIT_FOR_EXIT_LOAD' | 'WAIT_FOR_BOTH' | 'OPTIMAL';
      estimatedSavingsIfWait: number;
      advisoryMessage: string;
      waitDays: number;
    }>;
    summary: {
      totalHoldings: number;
      optimalToSell: number;
      waitForLTCG: number;
      waitForExitLoad: number;
      potentialTaxSavings: number;
      potentialExitLoadSavings: number;
    };
  }> {
    const holdingsWithAdvice: Array<{
      name: string;
      isin?: string;
      currentValue: number;
      unrealizedGain: number;
      taxType: 'STCG' | 'LTCG' | 'SLAB' | 'UNKNOWN';
      daysToLTCG: number | null;
      daysToExitLoadFree: number | null;
      sellAdvice: 'SELL_NOW' | 'WAIT_FOR_LTCG' | 'WAIT_FOR_EXIT_LOAD' | 'WAIT_FOR_BOTH' | 'OPTIMAL';
      estimatedSavingsIfWait: number;
      advisoryMessage: string;
      waitDays: number;
    }> = [];

    let totalOptimal = 0;
    let totalWaitLTCG = 0;
    let totalWaitExitLoad = 0;
    let potentialTaxSavings = 0;
    let potentialExitLoadSavings = 0;

    for (const holding of holdings) {
      const taxDetails = await this.calculateHoldingTaxAsync(holding);
      const holdingPeriodDays = this.calculateHoldingPeriod(holding.purchaseDate);
      
      // Calculate days to LTCG (365 days for equity, 1095 for debt)
      const ltcgThreshold = this.isEquityOriented(holding.productType, holding.category) ? 365 : 1095;
      const daysToLTCG = holdingPeriodDays < ltcgThreshold ? ltcgThreshold - holdingPeriodDays : null;
      
      // Calculate days to exit load free
      const daysToExitLoadFree = taxDetails.daysToZeroExitLoad;
      
      // Determine sell advice
      let sellAdvice: 'SELL_NOW' | 'WAIT_FOR_LTCG' | 'WAIT_FOR_EXIT_LOAD' | 'WAIT_FOR_BOTH' | 'OPTIMAL' = 'OPTIMAL';
      let estimatedSavingsIfWait = 0;
      let advisoryMessage = '';
      let waitDays = 0;

      // Check if STCG and close to LTCG threshold (within 90 days)
      const shouldWaitForLTCG = daysToLTCG !== null && daysToLTCG <= 90 && taxDetails.unrealizedGain > 0;
      
      // Check if exit load applies and close to expiry (within 60 days)
      const shouldWaitForExitLoad = daysToExitLoadFree !== null && daysToExitLoadFree > 0 && daysToExitLoadFree <= 60;

      if (shouldWaitForLTCG && shouldWaitForExitLoad) {
        sellAdvice = 'WAIT_FOR_BOTH';
        waitDays = Math.max(daysToLTCG, daysToExitLoadFree);
        
        // Calculate STCG vs LTCG savings (20% STCG vs 12.5% LTCG post-budget)
        const stcgTax = taxDetails.unrealizedGain * 0.20;
        const ltcgTax = Math.max(0, taxDetails.unrealizedGain - 125000) * 0.125; // ₹1.25L exemption
        const taxSavings = stcgTax - ltcgTax;
        
        estimatedSavingsIfWait = taxSavings + taxDetails.exitLoad;
        potentialTaxSavings += taxSavings;
        potentialExitLoadSavings += taxDetails.exitLoad;
        
        advisoryMessage = `Wait ${waitDays} days to save ₹${Math.round(estimatedSavingsIfWait).toLocaleString('en-IN')} (LTCG + exit load)`;
        totalWaitLTCG++;
        totalWaitExitLoad++;
      } else if (shouldWaitForLTCG) {
        sellAdvice = 'WAIT_FOR_LTCG';
        waitDays = daysToLTCG;
        
        const stcgTax = taxDetails.unrealizedGain * 0.20;
        const ltcgTax = Math.max(0, taxDetails.unrealizedGain - 125000) * 0.125;
        estimatedSavingsIfWait = stcgTax - ltcgTax;
        potentialTaxSavings += estimatedSavingsIfWait;
        
        advisoryMessage = `Wait ${daysToLTCG} days to convert STCG to LTCG, saving ₹${Math.round(estimatedSavingsIfWait).toLocaleString('en-IN')} in taxes`;
        totalWaitLTCG++;
      } else if (shouldWaitForExitLoad) {
        sellAdvice = 'WAIT_FOR_EXIT_LOAD';
        waitDays = daysToExitLoadFree;
        estimatedSavingsIfWait = taxDetails.exitLoad;
        potentialExitLoadSavings += estimatedSavingsIfWait;
        
        advisoryMessage = `Wait ${daysToExitLoadFree} days to avoid ₹${Math.round(taxDetails.exitLoad).toLocaleString('en-IN')} exit load`;
        totalWaitExitLoad++;
      } else if (taxDetails.unrealizedGain < 0) {
        sellAdvice = 'SELL_NOW';
        advisoryMessage = 'Consider tax loss harvesting - this loss can offset gains';
      } else {
        sellAdvice = 'OPTIMAL';
        advisoryMessage = 'No timing benefit - can sell at current conditions';
        totalOptimal++;
      }

      holdingsWithAdvice.push({
        name: holding.name,
        isin: holding.isin,
        currentValue: holding.currentValue,
        unrealizedGain: taxDetails.unrealizedGain,
        taxType: taxDetails.taxType,
        daysToLTCG,
        daysToExitLoadFree,
        sellAdvice,
        estimatedSavingsIfWait,
        advisoryMessage,
        waitDays
      });
    }

    return {
      holdingsWithAdvice,
      summary: {
        totalHoldings: holdings.length,
        optimalToSell: totalOptimal,
        waitForLTCG: totalWaitLTCG,
        waitForExitLoad: totalWaitExitLoad,
        potentialTaxSavings,
        potentialExitLoadSavings
      }
    };
  }

  /**
   * Calculate indexation benefit for debt funds purchased before April 1, 2023
   * Indexation adjusts the purchase cost for inflation, reducing taxable gains
   * 
   * Eligibility:
   * - Debt funds purchased BEFORE April 1, 2023
   * - Holding period of 3+ years (1095 days)
   * - Also applies to gold/silver funds
   */
  calculateIndexationBenefit(input: {
    purchaseDate: Date | string;
    saleDate?: Date | string;
    purchaseCost: number;
    saleValue: number;
    productType: string;
    category?: string;
  }): {
    eligible: boolean;
    eligibilityReason: string;
    purchaseCost: number;
    indexedCost: number;
    saleValue: number;
    gainWithoutIndexation: number;
    gainWithIndexation: number;
    taxWithoutIndexation: number;
    taxWithIndexation: number;
    taxSavingsFromIndexation: number;
    purchaseFY: string;
    saleFY: string;
    purchaseCII: number;
    saleCII: number;
    indexationFactor: number;
  } {
    const purchaseDate = new Date(input.purchaseDate);
    const saleDate = input.saleDate ? new Date(input.saleDate) : new Date();
    
    // Get financial years
    const purchaseFY = this.getFinancialYear(purchaseDate);
    const saleFY = this.getFinancialYear(saleDate);
    
    // Calculate holding period
    const holdingPeriodDays = Math.floor((saleDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Check eligibility
    let eligible = false;
    let eligibilityReason = '';
    
    // Check if purchased before April 1, 2023
    if (purchaseDate >= INDEXATION_CUTOFF_DATE) {
      eligibilityReason = 'Purchased after April 1, 2023 - indexation benefit not available for debt funds';
    } else if (holdingPeriodDays < 1095) {
      eligibilityReason = `Holding period (${holdingPeriodDays} days) is less than 3 years (1095 days)`;
    } else {
      // Check if it's a debt/gold fund
      const isDebtOrGold = this.isDebtOrGoldFund(input.productType, input.category);
      if (!isDebtOrGold) {
        eligibilityReason = 'Indexation benefit only applies to debt and gold funds';
      } else {
        eligible = true;
        eligibilityReason = 'Eligible for indexation benefit (debt/gold fund purchased before April 2023, held for 3+ years)';
      }
    }
    
    // Get CII values
    const purchaseCII = COST_INFLATION_INDEX[purchaseFY] || COST_INFLATION_INDEX['2024-25'];
    const saleCII = COST_INFLATION_INDEX[saleFY] || COST_INFLATION_INDEX['2025-26'];
    
    // Calculate indexation factor
    const indexationFactor = saleCII / purchaseCII;
    
    // Calculate indexed cost of acquisition
    const indexedCost = eligible ? input.purchaseCost * indexationFactor : input.purchaseCost;
    
    // Calculate gains
    const gainWithoutIndexation = input.saleValue - input.purchaseCost;
    const gainWithIndexation = input.saleValue - indexedCost;
    
    // Calculate taxes
    // Without indexation: 30% slab rate (post-April 2023 rules)
    // With indexation: 20% LTCG rate (pre-April 2023 rules for grandfathered holdings)
    const taxRateWithoutIndexation = 0.30;
    const taxRateWithIndexation = 0.20;
    
    const taxWithoutIndexation = Math.max(0, gainWithoutIndexation * taxRateWithoutIndexation);
    const taxWithIndexation = eligible ? Math.max(0, gainWithIndexation * taxRateWithIndexation) : taxWithoutIndexation;
    
    const taxSavingsFromIndexation = eligible ? taxWithoutIndexation - taxWithIndexation : 0;
    
    return {
      eligible,
      eligibilityReason,
      purchaseCost: input.purchaseCost,
      indexedCost: Math.round(indexedCost * 100) / 100,
      saleValue: input.saleValue,
      gainWithoutIndexation: Math.round(gainWithoutIndexation * 100) / 100,
      gainWithIndexation: Math.round(gainWithIndexation * 100) / 100,
      taxWithoutIndexation: Math.round(taxWithoutIndexation * 100) / 100,
      taxWithIndexation: Math.round(taxWithIndexation * 100) / 100,
      taxSavingsFromIndexation: Math.round(taxSavingsFromIndexation * 100) / 100,
      purchaseFY,
      saleFY,
      purchaseCII,
      saleCII,
      indexationFactor: Math.round(indexationFactor * 1000) / 1000
    };
  }

  /**
   * Get the financial year string for a given date
   * Financial year runs from April 1 to March 31
   */
  private getFinancialYear(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    
    // If date is between Jan 1 and Mar 31, it's part of previous calendar year's FY
    if (month < 3) { // Jan, Feb, Mar
      return `${year - 1}-${String(year).slice(2)}`;
    } else { // Apr onwards
      return `${year}-${String(year + 1).slice(2)}`;
    }
  }

  /**
   * Check if a fund is debt or gold-oriented (eligible for indexation)
   */
  private isDebtOrGoldFund(productType: string, category?: string): boolean {
    const debtGoldTypes = ['DEBT', 'BOND', 'GOLD', 'SILVER', 'LIQUID', 'GILT'];
    if (debtGoldTypes.some(t => productType?.toUpperCase().includes(t))) {
      return true;
    }
    
    const debtGoldCategories = [
      'debt', 'bond', 'gilt', 'liquid', 'money market', 'ultra short', 'short duration',
      'medium duration', 'long duration', 'dynamic bond', 'corporate bond', 'banking psu',
      'credit risk', 'floater', 'overnight', 'gold', 'silver', 'commodity'
    ];
    if (category && debtGoldCategories.some(c => category.toLowerCase().includes(c))) {
      return true;
    }
    
    return false;
  }

  /**
   * Helper to check if a fund is equity-oriented (for tax threshold purposes)
   */
  private isEquityOriented(productType: string, category?: string): boolean {
    const equityTypes = ['STOCK', 'EQUITY', 'ETF'];
    if (equityTypes.some(t => productType?.toUpperCase().includes(t))) {
      return true;
    }
    
    const equityCategories = ['equity', 'large cap', 'mid cap', 'small cap', 'flexi cap', 'multi cap', 'focused', 'elss', 'index'];
    if (category && equityCategories.some(c => category.toLowerCase().includes(c))) {
      return true;
    }
    
    return false;
  }

  async calculateLotWiseTaxFromDatabase(
    userId: string,
    isin: string,
    holdingName: string,
    currentNav: number,
    productType: string = 'mutual_fund',
    category?: string
  ): Promise<LotWiseTaxSummary | null> {
    try {
      const { lots } = await holdingLotsStorageService.getLotsByIsin(userId, isin);
      
      if (lots.length === 0) {
        console.log(`[CapitalGains] No stored lots found for ${isin}`);
        return null;
      }

      const formattedLots = lots
        .filter(lot => lot.status === 'active' || lot.status === 'partial')
        .map(lot => {
          const purchaseNav = parseFloat(lot.purchaseNav ?? lot.costPerUnit ?? '0');
          const purchaseValue = parseFloat(lot.totalCost ?? '0');
          const units = parseFloat(lot.units ?? '0');
          const remainingUnits = parseFloat(lot.remainingUnits ?? lot.units ?? '0');
          
          return {
            id: lot.id,
            purchaseDate: lot.purchaseDate,
            purchaseNav: isNaN(purchaseNav) ? 0 : purchaseNav,
            purchaseValue: isNaN(purchaseValue) ? 0 : purchaseValue,
            units: isNaN(units) ? 0 : units,
            remainingUnits: isNaN(remainingUnits) ? 0 : remainingUnits,
            source: (lot.transactionType === 'sip' ? 'sip' : 
                     lot.transactionType === 'switch_in' ? 'switch_in' :
                     lot.transactionType === 'bonus' ? 'bonus' : 'purchase') as 'purchase' | 'sip' | 'switch_in' | 'bonus'
          };
        })
        .filter(lot => lot.remainingUnits > 0);

      if (formattedLots.length === 0) {
        console.log(`[CapitalGains] No active lots for ${isin}`);
        return null;
      }

      console.log(`[CapitalGains] Calculating tax for ${formattedLots.length} lots from database for ${isin}`);
      
      return this.calculateLotWiseTax(
        holdingName,
        formattedLots,
        currentNav,
        productType,
        category,
        isin
      );
    } catch (error) {
      console.error(`[CapitalGains] Error reading lots from database:`, error);
      return null;
    }
  }
}

export const proposalCapitalGainsService = new ProposalCapitalGainsService();
