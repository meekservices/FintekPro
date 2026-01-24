/**
 * Proposal Capital Gains Service
 * Comprehensive capital gains tax calculation for investment proposal rebalancing
 * Includes: Date-based tax regimes, tax loss harvesting, holding period alerts,
 * grandfathering benefits, exit loads, and tax-efficient alternatives
 */

import { exitLoadService } from './exit-load-service';

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
   */
  calculateGrandfatheringBenefit(
    purchaseDate: Date | string | undefined,
    investedAmount: number,
    currentValue: number,
    productType: string
  ): { applies: boolean; adjustedCost: number; benefit: number } {
    if (!purchaseDate) {
      return { applies: false, adjustedCost: investedAmount, benefit: 0 };
    }

    const purchase = typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate;
    const assetCategory = this.getAssetCategory(productType);
    
    // Grandfathering only applies to equity and equity-oriented hybrid
    if (assetCategory !== 'equity' && assetCategory !== 'hybrid_equity') {
      return { applies: false, adjustedCost: investedAmount, benefit: 0 };
    }
    
    // Check if purchased before grandfathering date
    if (purchase >= GRANDFATHERING_DATE) {
      return { applies: false, adjustedCost: investedAmount, benefit: 0 };
    }
    
    // PLACEHOLDER: Estimate FMV on Jan 31, 2018 using appreciation estimate
    // In production, should fetch actual NAV from historical data
    // Current implementation uses conservative 40% appreciation estimate
    const estimatedFMV = investedAmount * (1 + GRANDFATHERING_FMV_APPRECIATION_ESTIMATE);
    
    // Cost of acquisition = Higher of (actual cost, lower of (FMV on 31/1/18, sale price))
    const lowerOfFMVAndSale = Math.min(estimatedFMV, currentValue);
    const adjustedCost = Math.max(investedAmount, lowerOfFMVAndSale);
    
    const originalGain = currentValue - investedAmount;
    const adjustedGain = currentValue - adjustedCost;
    const benefit = Math.max(0, originalGain - adjustedGain);
    
    return { applies: true, adjustedCost, benefit };
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
      
      // Calculate taxable gain after exemption (only for LTCG)
      if (!isSTCG && rules?.ltcg?.exemption) {
        taxableGain = Math.max(0, unrealizedGain - rules.ltcg.exemption);
      }
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
    const taxRegime = this.getTaxRegime(transactionDate);
    const regime = TAX_REGIMES[taxRegime];
    const assetCategory = this.getAssetCategory(holding.productType, holding.category);
    const rules = regime[assetCategory as keyof typeof regime] as any;
    
    const currentValue = holding.sellAmount || holding.currentValue;
    const investedAmount = holding.investedAmount || currentValue * 0.85;
    const holdingPeriodDays = this.calculateHoldingPeriod(holding.purchaseDate);
    
    let unrealizedGain = currentValue - investedAmount;
    
    const grandfathering = this.calculateGrandfatheringBenefit(
      holding.purchaseDate,
      investedAmount,
      currentValue,
      holding.productType
    );
    
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
      
      if (!isSTCG && rules?.ltcg?.exemption) {
        taxableGain = Math.max(0, unrealizedGain - rules.ltcg.exemption);
      }
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
    
    const alerts = this.generateAlerts(holding, holdingPeriodDays, unrealizedGain, assetCategory, taxRegime);
    
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
      taxRegime,
      alerts
    };
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
}

export const proposalCapitalGainsService = new ProposalCapitalGainsService();
