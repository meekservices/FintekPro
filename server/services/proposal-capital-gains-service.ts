/**
 * Proposal Capital Gains Service
 * Comprehensive capital gains tax calculation for investment proposal rebalancing
 * Includes: Date-based tax regimes, tax loss harvesting, holding period alerts,
 * grandfathering benefits, exit loads, and tax-efficient alternatives
 */

// Tax Regime Constants
const TAX_REGIMES = {
  // Pre-July 23, 2024 Budget
  PRE_BUDGET_2024: {
    effectiveUntil: new Date('2024-07-22'),
    equity: {
      stcg: { rate: 0.15, thresholdDays: 365 },
      ltcg: { rate: 0.10, thresholdDays: 365, exemption: 100000 }
    },
    debt: {
      // Post April 2023 - taxed at slab rate, no indexation
      stcg: { rate: 0.30, thresholdDays: 1095 }, // 3 years
      ltcg: { rate: 0.30, thresholdDays: 1095, exemption: 0 }
    },
    hybrid_equity: { // Equity-oriented hybrid (>65% equity)
      stcg: { rate: 0.15, thresholdDays: 365 },
      ltcg: { rate: 0.10, thresholdDays: 365, exemption: 100000 }
    },
    hybrid_debt: { // Debt-oriented hybrid (<65% equity)
      stcg: { rate: 0.30, thresholdDays: 1095 },
      ltcg: { rate: 0.30, thresholdDays: 1095, exemption: 0 }
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
      stcg: { rate: 0.30, thresholdDays: 730 }, // Changed to 2 years
      ltcg: { rate: 0.125, thresholdDays: 730, exemption: 0 }
    },
    hybrid_equity: {
      stcg: { rate: 0.20, thresholdDays: 365 },
      ltcg: { rate: 0.125, thresholdDays: 365, exemption: 125000 }
    },
    hybrid_debt: {
      stcg: { rate: 0.30, thresholdDays: 730 },
      ltcg: { rate: 0.125, thresholdDays: 730, exemption: 0 }
    },
    gold_silver: {
      stcg: { rate: 0.20, thresholdDays: 730 },
      ltcg: { rate: 0.125, thresholdDays: 730, exemption: 0 }
    }
  }
};

// Grandfathering date for equity funds
const GRANDFATHERING_DATE = new Date('2018-01-31');
const GRANDFATHERING_NAV_MULTIPLIER = 1.0; // Assume NAV on Jan 31, 2018 equals cost for older holdings

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
  currentValue: number;
  investedAmount: number;
  purchaseDate?: Date | string;
  quantity?: number;
  unrealizedGain: number;
  holdingPeriodDays: number;
  taxType: 'STCG' | 'LTCG' | 'UNKNOWN';
  applicableTaxRate: number;
  estimatedTax: number;
  estimatedTaxWithCess: number;
  exitLoad: number;
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
  stcgTax: number;
  ltcgTax: number;
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
  stcgTax: number;
  ltcgTax: number;
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
    taxType: 'STCG' | 'LTCG' | 'UNKNOWN';
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
    
    // Estimate NAV on Jan 31, 2018 (simplified - in production, fetch actual NAV)
    // Assume fair market value (FMV) on Jan 31, 2018 is higher than purchase cost
    const estimatedFMV = investedAmount * 1.4; // Assume 40% appreciation till Jan 2018
    
    // Cost of acquisition = Higher of (actual cost, lower of (FMV on 31/1/18, sale price))
    const lowerOfFMVAndSale = Math.min(estimatedFMV, currentValue);
    const adjustedCost = Math.max(investedAmount, lowerOfFMVAndSale);
    
    const originalGain = currentValue - investedAmount;
    const adjustedGain = currentValue - adjustedCost;
    const benefit = Math.max(0, originalGain - adjustedGain);
    
    return { applies: true, adjustedCost, benefit };
  }

  /**
   * Calculate exit load
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
    
    const stcgThreshold = rules.stcg.thresholdDays;
    
    // Holding Period Alert - close to LTCG threshold
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
    
    // Tax Loss Harvesting opportunity
    if (unrealizedGain < 0) {
      alerts.push({
        type: 'TAX_LOSS_HARVEST',
        severity: 'opportunity',
        message: `Loss of ₹${Math.abs(unrealizedGain).toLocaleString('en-IN')} can offset gains from other holdings`,
        potentialSavings: Math.abs(unrealizedGain) * rules.stcg.rate
      });
    }
    
    // STP recommendation for large redemptions
    if (unrealizedGain > 500000) { // More than 5L gains
      alerts.push({
        type: 'STP_RECOMMENDED',
        severity: 'info',
        message: 'Consider STP over 2-3 FYs to spread tax liability and utilize LTCG exemption each year'
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
    
    // Determine STCG or LTCG
    const isSTCG = holdingPeriodDays < (rules?.stcg?.thresholdDays || 365);
    const taxType: 'STCG' | 'LTCG' = isSTCG ? 'STCG' : 'LTCG';
    
    // Get applicable rate
    let applicableTaxRate = isSTCG ? rules?.stcg?.rate || 0.20 : rules?.ltcg?.rate || 0.125;
    
    // Calculate taxable gain after exemption
    let taxableGain = unrealizedGain;
    if (!isSTCG && rules?.ltcg?.exemption) {
      taxableGain = Math.max(0, unrealizedGain - rules.ltcg.exemption);
    }
    
    // Calculate base tax
    let estimatedTax = Math.max(0, taxableGain * applicableTaxRate);
    
    // Add cess
    const cess = estimatedTax * CESS_RATE;
    const estimatedTaxWithCess = estimatedTax + cess;
    
    // Calculate exit load
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
      applicableTaxRate,
      estimatedTax,
      estimatedTaxWithCess,
      exitLoad,
      totalCost: estimatedTaxWithCess + exitLoad,
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
    let stcgTax = 0;
    let ltcgTax = 0;
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
        if (taxInfo.taxType === 'STCG') {
          totalSTCG += taxInfo.unrealizedGain;
          stcgTax += taxInfo.estimatedTax;
        } else {
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
    
    // Calculate surcharge on total gains
    const totalGains = totalSTCG + totalLTCG;
    const totalBaseTax = stcgTax + ltcgTax;
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
      stcgTax,
      ltcgTax,
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
      if (h.taxType === 'STCG') {
        acc.stcgAmount += h.unrealizedGain;
        acc.stcgTax += h.estimatedTax;
      } else {
        acc.ltcgAmount += h.unrealizedGain;
        acc.ltcgTax += h.estimatedTax;
      }
      return acc;
    }, { stcgAmount: 0, ltcgAmount: 0, stcgTax: 0, ltcgTax: 0 });
    
    return [
      {
        financialYear: currentFY,
        stcgAmount: currentFYTotal.stcgAmount,
        ltcgAmount: currentFYTotal.ltcgAmount,
        stcgTax: currentFYTotal.stcgTax,
        ltcgTax: currentFYTotal.ltcgTax,
        totalTax: currentFYTotal.stcgTax + currentFYTotal.ltcgTax
      },
      {
        financialYear: nextFY,
        stcgAmount: 0,
        ltcgAmount: 0,
        stcgTax: 0,
        ltcgTax: 0,
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

**Debt Funds (purchased after April 1, 2023):**
• Taxed as per individual income tax slab rate
• Holding period for LTCG: ${isPostBudget ? '2 years' : '3 years'}

**Gold/Silver Funds:**
• STCG: ${isPostBudget ? '20%' : 'As per slab'} (holding period < ${isPostBudget ? '2' : '3'} years)
• LTCG: ${isPostBudget ? '12.5%' : '20% with indexation'}

**Additional Charges:**
• Surcharge: 0-15% based on total income (capped at 15% for LTCG)
• Health & Education Cess: 4% on tax + surcharge
• Exit Load: As per fund scheme (typically 1% within 1 year)

**Grandfathering Benefit:**
For equity funds purchased before January 31, 2018, the cost of acquisition is the higher of actual cost or fair market value on that date.

**Important Notes:**
1. These are estimated calculations based on available data
2. Actual tax liability may vary based on your overall income and tax situation
3. Purchase dates are assumed where not provided (conservative STCG assumption)
4. Please consult a qualified tax advisor before making investment decisions
5. Tax laws are subject to change

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
