import { RebalanceAction } from "./allocation-policy-service";
import { ProductSelection } from "./product-selection-engine";
import { TaxOptimizedAction } from "./tax-optimization-engine";

export interface ExplainableAction {
  actionId: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  assetClass: string;
  productName?: string;
  amount: number;
  whyAction: string;
  whyAmount: string;
  whyThisFund?: string;
  taxConsiderations?: string;
  riskConsiderations?: string;
  confidenceLevel: 'high' | 'medium' | 'low';
  sourceEngine: 'rebalancing' | 'tax_optimization' | 'product_selection' | 'advisor_override';
}

export interface ExplainabilityOutput {
  actions: ExplainableAction[];
  overallRationale: string;
  keyInsights: string[];
  generatedAt: string;
  version: string;
}

export class ExplainabilityService {
  private static instance: ExplainabilityService;

  private constructor() {}

  static getInstance(): ExplainabilityService {
    if (!this.instance) {
      this.instance = new ExplainabilityService();
    }
    return this.instance;
  }

  explainRebalanceActions(
    actions: Array<{ assetClass: string; action: 'BUY' | 'SELL' | 'HOLD'; amount: number; reason: string }>,
    currentAllocations: Record<string, number>,
    targetAllocations: Record<string, number>
  ): ExplainableAction[] {
    return actions.map((action, idx) => {
      const current = currentAllocations[action.assetClass] || 0;
      const target = targetAllocations[action.assetClass] || 0;
      const deviation = Math.abs(current - target);

      let whyAction = '';
      let whyAmount = '';
      let confidenceLevel: 'high' | 'medium' | 'low' = 'high';

      if (action.action === 'BUY') {
        whyAction = `Your ${action.assetClass} allocation is ${current.toFixed(1)}%, which is below the target band. ` +
          `Increasing to ${target.toFixed(1)}% aligns with your risk profile.`;
        whyAmount = `The investment amount of ₹${this.formatAmount(action.amount)} will bring your ${action.assetClass} ` +
          `allocation from ${current.toFixed(1)}% to approximately ${target.toFixed(1)}%.`;
        confidenceLevel = deviation > 10 ? 'high' : deviation > 5 ? 'medium' : 'low';
      } else if (action.action === 'SELL') {
        whyAction = `Your ${action.assetClass} allocation is ${current.toFixed(1)}%, which exceeds the target band. ` +
          `Reducing to ${target.toFixed(1)}% improves risk management.`;
        whyAmount = `Selling ₹${this.formatAmount(action.amount)} worth of ${action.assetClass} will rebalance ` +
          `your portfolio to the target allocation of ${target.toFixed(1)}%.`;
        confidenceLevel = deviation > 10 ? 'high' : deviation > 5 ? 'medium' : 'low';
      } else {
        whyAction = `Your ${action.assetClass} allocation at ${current.toFixed(1)}% is within the acceptable band. ` +
          `No action required.`;
        whyAmount = 'Current allocation is already optimal.';
        confidenceLevel = 'high';
      }

      return {
        actionId: `rebal-${idx}`,
        action: action.action,
        assetClass: action.assetClass,
        amount: action.amount,
        whyAction,
        whyAmount,
        riskConsiderations: this.generateRiskConsideration(action.assetClass, action.action),
        confidenceLevel,
        sourceEngine: 'rebalancing' as const
      };
    });
  }

  explainTaxOptimizedActions(
    actions: TaxOptimizedAction[]
  ): ExplainableAction[] {
    return actions.map((action, idx) => {
      const { taxImpact } = action;
      
      let taxConsiderations = '';
      if (taxImpact.isLongTerm) {
        taxConsiderations = `Long-term capital gains of ₹${this.formatAmount(taxImpact.ltcgAmount)} ` +
          `will be taxed at 12.5% (after ₹1.25L exemption). `;
      } else {
        taxConsiderations = `Short-term capital gains of ₹${this.formatAmount(taxImpact.stcgAmount)} ` +
          `will be taxed at 20%. `;
      }

      if (taxImpact.grandfatheringApplied) {
        taxConsiderations += `Grandfathering benefit of ₹${this.formatAmount(taxImpact.grandfatheringBenefit)} has been applied.`;
      }

      if (taxImpact.exitLoadAmount > 0) {
        taxConsiderations += ` Exit load of ₹${this.formatAmount(taxImpact.exitLoadAmount)} will apply.`;
      }

      return {
        actionId: `tax-${idx}`,
        action: action.action,
        assetClass: action.assetClass,
        amount: action.amount,
        whyAction: action.recommendation,
        whyAmount: `After tax and exit load, net proceeds will be ₹${this.formatAmount(taxImpact.netProceeds)}.`,
        taxConsiderations,
        confidenceLevel: taxImpact.taxPayable > 10000 ? 'high' : 'medium',
        sourceEngine: 'tax_optimization' as const
      };
    });
  }

  explainProductSelections(
    selections: ProductSelection[]
  ): ExplainableAction[] {
    const actions: ExplainableAction[] = [];

    for (const selection of selections) {
      for (const sp of selection.selectedProducts) {
        actions.push({
          actionId: `prod-${sp.product.id}`,
          action: selection.action,
          assetClass: selection.assetClass,
          productName: sp.product.name,
          amount: sp.allocatedAmount,
          whyAction: `Investing in ${sp.product.name} to achieve your ${selection.assetClass} allocation target.`,
          whyAmount: `₹${this.formatAmount(sp.allocatedAmount)} (${sp.allocatedPercent.toFixed(1)}% of this asset class allocation).`,
          whyThisFund: sp.rationale,
          confidenceLevel: sp.product.isRecommended ? 'high' : 'medium',
          sourceEngine: 'product_selection' as const
        });
      }
    }

    return actions;
  }

  generateComprehensiveExplanation(
    rebalanceActions: ExplainableAction[],
    taxActions: ExplainableAction[],
    productActions: ExplainableAction[]
  ): ExplainabilityOutput {
    const allActions = [...rebalanceActions, ...taxActions, ...productActions];

    const sellCount = allActions.filter(a => a.action === 'SELL').length;
    const buyCount = allActions.filter(a => a.action === 'BUY').length;
    const holdCount = allActions.filter(a => a.action === 'HOLD').length;

    let overallRationale = '';
    if (sellCount > 0 && buyCount > 0) {
      overallRationale = 'This proposal involves rebalancing your portfolio by selling overweight positions and buying underweight asset classes. ';
    } else if (buyCount > 0) {
      overallRationale = 'This proposal focuses on investing in underweight asset classes to optimize your portfolio allocation. ';
    } else if (sellCount > 0) {
      overallRationale = 'This proposal recommends reducing certain positions to manage risk and improve diversification. ';
    } else {
      overallRationale = 'Your portfolio is well-balanced. No immediate action is required. ';
    }

    overallRationale += 'All recommendations are designed to align with your risk profile and investment goals.';

    const keyInsights = this.generateKeyInsights(allActions);

    return {
      actions: allActions,
      overallRationale,
      keyInsights,
      generatedAt: new Date().toISOString(),
      version: '1.0'
    };
  }

  private generateKeyInsights(actions: ExplainableAction[]): string[] {
    const insights: string[] = [];

    const highConfidenceActions = actions.filter(a => a.confidenceLevel === 'high' && a.action !== 'HOLD');
    if (highConfidenceActions.length > 0) {
      insights.push(`${highConfidenceActions.length} high-confidence recommendations require your attention.`);
    }

    const taxActions = actions.filter(a => a.sourceEngine === 'tax_optimization');
    if (taxActions.length > 0) {
      insights.push('Tax-efficient selling strategy has been applied to minimize capital gains tax.');
    }

    const productActions = actions.filter(a => a.whyThisFund);
    if (productActions.length > 0) {
      insights.push(`${productActions.length} specific investment products have been recommended based on your profile.`);
    }

    const sellActions = actions.filter(a => a.action === 'SELL');
    const totalSellAmount = sellActions.reduce((sum, a) => sum + a.amount, 0);
    if (totalSellAmount > 0) {
      insights.push(`Total rebalancing involves selling ₹${this.formatAmount(totalSellAmount)} worth of investments.`);
    }

    return insights;
  }

  private generateRiskConsideration(assetClass: string, action: 'BUY' | 'SELL' | 'HOLD'): string {
    const riskNotes: Record<string, string> = {
      equity: 'Equity investments carry market risk. Consider your investment horizon.',
      debt: 'Debt investments carry interest rate and credit risk.',
      gold: 'Gold provides portfolio hedging but has no yield.',
      cash: 'Cash holdings are safe but may lose value to inflation.',
      alternates: 'Alternative investments may have limited liquidity.',
      international: 'International investments carry currency risk.'
    };

    return riskNotes[assetClass.toLowerCase()] || 'Consider your risk tolerance before proceeding.';
  }

  private formatAmount(amount: number): string {
    if (amount >= 10000000) {
      return `${(amount / 10000000).toFixed(2)} Cr`;
    } else if (amount >= 100000) {
      return `${(amount / 100000).toFixed(2)} L`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toFixed(0);
  }

  markAsAdvisorOverride(action: ExplainableAction, reason: string): ExplainableAction {
    return {
      ...action,
      sourceEngine: 'advisor_override',
      whyAction: `[ADVISOR OVERRIDE] ${reason}. Original: ${action.whyAction}`,
      confidenceLevel: 'high'
    };
  }
}

export const explainabilityService = ExplainabilityService.getInstance();
