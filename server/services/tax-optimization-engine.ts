import { RebalanceAction } from "./allocation-policy-service";

export interface TaxLot {
  id: string;
  holdingId: string;
  purchaseDate: string;
  purchasePrice: number;
  quantity: number;
  currentValue: number;
}

export interface TaxImpact {
  stcgAmount: number;
  ltcgAmount: number;
  exitLoadAmount: number;
  taxPayable: number;
  netProceeds: number;
  holdingPeriodDays: number;
  isLongTerm: boolean;
  grandfatheringApplied: boolean;
  grandfatheringBenefit: number;
}

export interface TaxOptimizedAction {
  assetClass: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  amount: number;
  taxImpact: TaxImpact;
  lots?: Array<{
    lotId: string;
    quantity: number;
    sellValue: number;
    gainLoss: number;
    taxType: 'STCG' | 'LTCG';
  }>;
  recommendation: string;
}

export interface TaxOptimizationOutput {
  optimizedActions: TaxOptimizedAction[];
  totalTaxPayable: number;
  totalExitLoad: number;
  totalStcg: number;
  totalLtcg: number;
  grandfatheringBenefitsUsed: number;
  taxEfficiencyScore: number;
}

export class TaxOptimizationEngine {
  private static instance: TaxOptimizationEngine;
  
  private readonly EQUITY_STCG_RATE = 0.20;
  private readonly EQUITY_LTCG_RATE = 0.125;
  private readonly DEBT_STCG_RATE = 0.30;
  private readonly DEBT_LTCG_RATE = 0.20;
  private readonly EQUITY_LTCG_THRESHOLD = 365;
  private readonly DEBT_LTCG_THRESHOLD = 1095;
  private readonly GRANDFATHERING_DATE = new Date('2018-01-31');
  private readonly LTCG_EXEMPTION = 125000;

  private constructor() {}

  static getInstance(): TaxOptimizationEngine {
    if (!this.instance) {
      this.instance = new TaxOptimizationEngine();
    }
    return this.instance;
  }

  optimize(
    sellActions: Array<{ assetClass: string; amount: number; reason: string }>,
    lots: Map<string, TaxLot[]>,
    currentDate: Date = new Date()
  ): TaxOptimizationOutput {
    const optimizedActions: TaxOptimizedAction[] = [];
    let totalTaxPayable = 0;
    let totalExitLoad = 0;
    let totalStcg = 0;
    let totalLtcg = 0;
    let grandfatheringBenefitsUsed = 0;

    for (const action of sellActions) {
      const assetLots = lots.get(action.assetClass) || [];
      const optimized = this.optimizeSellOrder(assetLots, action.amount, action.assetClass, currentDate);
      
      totalTaxPayable += optimized.taxImpact.taxPayable;
      totalExitLoad += optimized.taxImpact.exitLoadAmount;
      totalStcg += optimized.taxImpact.stcgAmount;
      totalLtcg += optimized.taxImpact.ltcgAmount;
      grandfatheringBenefitsUsed += optimized.taxImpact.grandfatheringBenefit;

      optimizedActions.push({
        assetClass: action.assetClass,
        action: 'SELL',
        amount: action.amount,
        taxImpact: optimized.taxImpact,
        lots: optimized.lots,
        recommendation: optimized.recommendation
      });
    }

    const taxEfficiencyScore = this.calculateTaxEfficiency(totalTaxPayable, optimizedActions);

    return {
      optimizedActions,
      totalTaxPayable,
      totalExitLoad,
      totalStcg,
      totalLtcg,
      grandfatheringBenefitsUsed,
      taxEfficiencyScore
    };
  }

  private optimizeSellOrder(
    lots: TaxLot[],
    targetAmount: number,
    assetClass: string,
    currentDate: Date
  ): {
    taxImpact: TaxImpact;
    lots: Array<{
      lotId: string;
      quantity: number;
      sellValue: number;
      gainLoss: number;
      taxType: 'STCG' | 'LTCG';
    }>;
    recommendation: string;
  } {
    const isEquity = ['equity', 'mutual_fund', 'etf'].includes(assetClass.toLowerCase());
    const ltcgThreshold = isEquity ? this.EQUITY_LTCG_THRESHOLD : this.DEBT_LTCG_THRESHOLD;
    const stcgRate = isEquity ? this.EQUITY_STCG_RATE : this.DEBT_STCG_RATE;
    const ltcgRate = isEquity ? this.EQUITY_LTCG_RATE : this.DEBT_LTCG_RATE;

    const sortedLots = [...lots].sort((a, b) => {
      const holdingDaysA = this.daysBetween(new Date(a.purchaseDate), currentDate);
      const holdingDaysB = this.daysBetween(new Date(b.purchaseDate), currentDate);
      const isLtA = holdingDaysA > ltcgThreshold;
      const isLtB = holdingDaysB > ltcgThreshold;
      
      if (isLtA && !isLtB) return -1;
      if (!isLtA && isLtB) return 1;
      
      const gainA = (a.currentValue / a.quantity) - a.purchasePrice;
      const gainB = (b.currentValue / b.quantity) - b.purchasePrice;
      
      return gainA - gainB;
    });

    let remainingAmount = targetAmount;
    const selectedLots: Array<{
      lotId: string;
      quantity: number;
      sellValue: number;
      gainLoss: number;
      taxType: 'STCG' | 'LTCG';
    }> = [];
    
    let totalStcg = 0;
    let totalLtcg = 0;
    let grandfatheringBenefit = 0;
    let totalExitLoad = 0;
    let totalDays = 0;
    let lotCount = 0;

    for (const lot of sortedLots) {
      if (remainingAmount <= 0) break;

      const pricePerUnit = lot.currentValue / lot.quantity;
      const unitsToSell = Math.min(lot.quantity, remainingAmount / pricePerUnit);
      const sellValue = unitsToSell * pricePerUnit;
      const costBasis = unitsToSell * lot.purchasePrice;
      let gainLoss = sellValue - costBasis;

      const holdingDays = this.daysBetween(new Date(lot.purchaseDate), currentDate);
      const isLongTerm = holdingDays > ltcgThreshold;
      
      if (isEquity && isLongTerm && new Date(lot.purchaseDate) <= this.GRANDFATHERING_DATE) {
        const fairValueOnGfDate = lot.purchasePrice * 1.15;
        const adjustedCost = Math.max(lot.purchasePrice, Math.min(fairValueOnGfDate, pricePerUnit));
        const adjustedGain = sellValue - (adjustedCost * unitsToSell);
        grandfatheringBenefit += Math.max(0, gainLoss - adjustedGain);
        gainLoss = adjustedGain;
      }

      if (isLongTerm) {
        totalLtcg += gainLoss;
      } else {
        totalStcg += gainLoss;
      }

      const exitLoadRate = this.calculateExitLoad(holdingDays, assetClass);
      totalExitLoad += sellValue * exitLoadRate;

      selectedLots.push({
        lotId: lot.id,
        quantity: unitsToSell,
        sellValue,
        gainLoss,
        taxType: isLongTerm ? 'LTCG' : 'STCG'
      });

      remainingAmount -= sellValue;
      totalDays += holdingDays;
      lotCount++;
    }

    const taxableStcg = totalStcg;
    const taxableLtcg = Math.max(0, totalLtcg - this.LTCG_EXEMPTION);
    const taxPayable = (taxableStcg * stcgRate) + (taxableLtcg * ltcgRate);
    const avgHoldingDays = lotCount > 0 ? totalDays / lotCount : 0;

    const taxImpact: TaxImpact = {
      stcgAmount: totalStcg,
      ltcgAmount: totalLtcg,
      exitLoadAmount: totalExitLoad,
      taxPayable,
      netProceeds: targetAmount - taxPayable - totalExitLoad,
      holdingPeriodDays: avgHoldingDays,
      isLongTerm: avgHoldingDays > ltcgThreshold,
      grandfatheringApplied: grandfatheringBenefit > 0,
      grandfatheringBenefit
    };

    let recommendation = '';
    if (totalStcg > 0 && totalLtcg > 0) {
      recommendation = 'Mixed short-term and long-term holdings sold. Consider waiting for short-term holdings to convert to long-term for lower tax rates.';
    } else if (totalStcg > 0) {
      recommendation = 'Selling short-term holdings incurs higher tax rate. Hold for longer if possible.';
    } else if (totalLtcg > 0) {
      recommendation = 'Selling long-term holdings qualifies for lower tax rate. Consider harvesting losses if available.';
    } else {
      recommendation = 'No significant capital gains impact.';
    }

    return { taxImpact, lots: selectedLots, recommendation };
  }

  private daysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private calculateExitLoad(holdingDays: number, assetClass: string): number {
    if (assetClass === 'debt' || assetClass === 'liquid') {
      if (holdingDays < 7) return 0.0070;
      if (holdingDays < 30) return 0.0065;
      if (holdingDays < 60) return 0.0055;
      return 0;
    }
    
    if (holdingDays < 365) return 0.01;
    return 0;
  }

  private calculateTaxEfficiency(totalTax: number, actions: TaxOptimizedAction[]): number {
    const totalSellValue = actions.reduce((sum, a) => sum + a.amount, 0);
    if (totalSellValue === 0) return 100;
    
    const taxRate = (totalTax / totalSellValue) * 100;
    return Math.max(0, 100 - (taxRate * 5));
  }

  generateTaxReport(output: TaxOptimizationOutput): string {
    let report = '## Tax Optimization Report\n\n';
    report += `**Total Tax Payable:** ₹${output.totalTaxPayable.toFixed(2)}\n`;
    report += `**Total Exit Load:** ₹${output.totalExitLoad.toFixed(2)}\n`;
    report += `**STCG:** ₹${output.totalStcg.toFixed(2)}\n`;
    report += `**LTCG:** ₹${output.totalLtcg.toFixed(2)}\n`;
    report += `**Grandfathering Benefits:** ₹${output.grandfatheringBenefitsUsed.toFixed(2)}\n`;
    report += `**Tax Efficiency Score:** ${output.taxEfficiencyScore.toFixed(0)}%\n\n`;
    
    report += '### Actions\n';
    for (const action of output.optimizedActions) {
      report += `- **${action.assetClass}**: ${action.action} ₹${action.amount.toFixed(2)}\n`;
      report += `  - Tax: ₹${action.taxImpact.taxPayable.toFixed(2)}\n`;
      report += `  - ${action.recommendation}\n`;
    }
    
    return report;
  }
}

export const taxOptimizationEngine = TaxOptimizationEngine.getInstance();
