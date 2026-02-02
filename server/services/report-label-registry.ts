/**
 * Centralized Report Label Registry
 * Fixes terminology typos and provides consistent labels across the platform
 */

export interface LabelEntry {
  key: string;
  label: string;
  description?: string;
}

const REPORT_LABELS: Record<string, LabelEntry> = {
  // Section Labels
  executive_summary: { key: 'executive_summary', label: 'Executive Summary', description: 'High-level overview of the proposal' },
  client_profile: { key: 'client_profile', label: 'Client Profile', description: 'Client information and investment objectives' },
  risk_assessment: { key: 'risk_assessment', label: 'Risk Assessment', description: 'Risk profiling and tolerance analysis' },
  current_portfolio: { key: 'current_portfolio', label: 'Current Portfolio Analysis', description: 'Analysis of existing investments' },
  recommended_allocation: { key: 'recommended_allocation', label: 'Recommended Asset Allocation', description: 'Suggested portfolio distribution' },
  exit_load: { key: 'exit_load', label: 'Exit Load Analysis', description: 'Exit load impact on redemptions' },
  capital_gains: { key: 'capital_gains', label: 'Capital Gains Summary', description: 'Tax implications of transactions' },
  tax_impact: { key: 'tax_impact', label: 'Tax Impact Analysis', description: 'Comprehensive tax analysis' },
  sip_projection: { key: 'sip_projection', label: 'SIP Projection', description: 'Systematic investment projections' },
  what_if_scenarios: { key: 'what_if_scenarios', label: 'What-If Scenarios', description: 'Market scenario analysis' },
  fee_disclosure: { key: 'fee_disclosure', label: 'Fee Disclosure', description: 'Fees and charges disclosure' },
  terms_conditions: { key: 'terms_conditions', label: 'Terms & Conditions', description: 'Legal terms and conditions' },

  // Metric Labels (Fixed typos)
  expense_ratio: { key: 'expense_ratio', label: 'Expense Ratio', description: 'Fund management cost percentage' },
  risk_heat_map: { key: 'risk_heat_map', label: 'Risk Heat Map', description: 'Visual risk distribution' },
  summary: { key: 'summary', label: 'Summary', description: 'Brief overview' },
  
  // Verdict Labels
  buy_verdict: { key: 'buy_verdict', label: 'BUY', description: 'Recommend purchasing' },
  hold_verdict: { key: 'hold_verdict', label: 'HOLD', description: 'Recommend maintaining position' },
  sell_verdict: { key: 'sell_verdict', label: 'SELL', description: 'Recommend selling' },

  // SIP Source Labels
  sip_rebalancing: { key: 'sip_rebalancing', label: 'Rebalancing SIP', description: 'SIP from existing holdings rebalancing' },
  sip_fresh: { key: 'sip_fresh', label: 'Fresh Investment SIP', description: 'SIP from new investment' },
  sip_hybrid: { key: 'sip_hybrid', label: 'Hybrid SIP', description: 'SIP combining rebalancing and fresh investment' },

  // Goal Labels
  goal_retirement: { key: 'goal_retirement', label: 'Retirement Planning', description: 'Long-term retirement savings' },
  goal_wealth_creation: { key: 'goal_wealth_creation', label: 'Wealth Creation', description: 'Capital appreciation focused' },
  goal_income_generation: { key: 'goal_income_generation', label: 'Income Generation', description: 'Regular income focused' },
  goal_capital_preservation: { key: 'goal_capital_preservation', label: 'Capital Preservation', description: 'Safety-focused investing' },
  goal_education: { key: 'goal_education', label: 'Education Funding', description: 'Children education planning' },
  goal_home_purchase: { key: 'goal_home_purchase', label: 'Home Purchase', description: 'Property down payment' },
  goal_emergency_fund: { key: 'goal_emergency_fund', label: 'Emergency Fund', description: 'Liquid safety net' },

  // Risk Profile Labels
  risk_conservative: { key: 'risk_conservative', label: 'Conservative', description: 'Low risk tolerance' },
  risk_moderate: { key: 'risk_moderate', label: 'Moderate', description: 'Balanced risk tolerance' },
  risk_aggressive: { key: 'risk_aggressive', label: 'Aggressive', description: 'High risk tolerance' },
  risk_very_aggressive: { key: 'risk_very_aggressive', label: 'Very Aggressive', description: 'Very high risk tolerance' },

  // Time Horizon Labels
  horizon_short: { key: 'horizon_short', label: 'Short Term', description: '0-3 years' },
  horizon_medium: { key: 'horizon_medium', label: 'Medium Term', description: '3-7 years' },
  horizon_long: { key: 'horizon_long', label: 'Long Term', description: '7+ years' },

  // Phase Labels
  phase_risk_profile: { key: 'phase_risk_profile', label: 'Risk Profile', description: 'Client risk assessment' },
  phase_investment_horizon: { key: 'phase_investment_horizon', label: 'Investment Horizon', description: 'Time frame selection' },
  phase_goal: { key: 'phase_goal', label: 'Goal Selection', description: 'Investment objective' },
  phase_portfolio_input: { key: 'phase_portfolio_input', label: 'Portfolio Input', description: 'Current holdings entry' },
  phase_analysis: { key: 'phase_analysis', label: 'Portfolio Analysis', description: 'Holdings analysis' },
  phase_recommendation: { key: 'phase_recommendation', label: 'AI Recommendations', description: 'Investment suggestions' },
  phase_rebalancing: { key: 'phase_rebalancing', label: 'Rebalancing', description: 'Portfolio optimization' },
  phase_verdict: { key: 'phase_verdict', label: 'Verdict Assignment', description: 'Buy/Hold/Sell decisions' },
  phase_report: { key: 'phase_report', label: 'Report Generation', description: 'Final proposal report' },

  // Scenario Labels
  scenario_base: { key: 'scenario_base', label: 'Base Case', description: 'Expected market conditions' },
  scenario_bull: { key: 'scenario_bull', label: 'Bull Case (+10%)', description: 'Optimistic market scenario' },
  scenario_bear_10: { key: 'scenario_bear_10', label: 'Bear Case (-10%)', description: 'Mild market correction' },
  scenario_bear_20: { key: 'scenario_bear_20', label: 'Bear Case (-20%)', description: 'Significant market downturn' },
  scenario_custom: { key: 'scenario_custom', label: 'Custom Scenario', description: 'User-defined assumptions' }
};

// Common typo corrections
const TYPO_CORRECTIONS: Record<string, string> = {
  'expense reatio': 'expense_ratio',
  'expense_reatio': 'expense_ratio',
  'expenseReatio': 'expense_ratio',
  'risk hit map': 'risk_heat_map',
  'risk_hit_map': 'risk_heat_map',
  'riskHitMap': 'risk_heat_map',
  'summery': 'summary',
  'sumary': 'summary',
  'reccomendation': 'recommendation',
  'recomendation': 'recommendation',
  'rebalencing': 'rebalancing',
  'rebalncing': 'rebalancing',
  'porfolio': 'portfolio',
  'portoflio': 'portfolio',
  'capitial': 'capital',
  'alocaiton': 'allocation',
  'allcoation': 'allocation'
};

export class ReportLabelRegistry {
  static getLabel(key: string): string {
    const normalizedKey = this.normalizeKey(key);
    return REPORT_LABELS[normalizedKey]?.label || key;
  }

  static getDescription(key: string): string | undefined {
    const normalizedKey = this.normalizeKey(key);
    return REPORT_LABELS[normalizedKey]?.description;
  }

  static getLabelEntry(key: string): LabelEntry | undefined {
    const normalizedKey = this.normalizeKey(key);
    return REPORT_LABELS[normalizedKey];
  }

  static normalizeKey(key: string): string {
    const lowercaseKey = key.toLowerCase().trim();
    
    if (TYPO_CORRECTIONS[lowercaseKey]) {
      return TYPO_CORRECTIONS[lowercaseKey];
    }

    const snakeKey = lowercaseKey.replace(/\s+/g, '_');
    if (TYPO_CORRECTIONS[snakeKey]) {
      return TYPO_CORRECTIONS[snakeKey];
    }

    return snakeKey;
  }

  static correctTypo(text: string): string {
    let corrected = text;
    
    for (const [typo, correction] of Object.entries(TYPO_CORRECTIONS)) {
      const regex = new RegExp(typo.replace(/_/g, '[ _]'), 'gi');
      const correctLabel = REPORT_LABELS[correction]?.label || correction;
      corrected = corrected.replace(regex, correctLabel);
    }
    
    return corrected;
  }

  static getAllLabels(): Record<string, LabelEntry> {
    return { ...REPORT_LABELS };
  }

  static getLabelsForCategory(prefix: string): LabelEntry[] {
    return Object.values(REPORT_LABELS).filter(entry => 
      entry.key.startsWith(prefix)
    );
  }

  static getSectionLabels(): LabelEntry[] {
    return this.getLabelsForCategory('');
  }

  static getVerdictLabels(): LabelEntry[] {
    return [
      REPORT_LABELS.buy_verdict,
      REPORT_LABELS.hold_verdict,
      REPORT_LABELS.sell_verdict
    ];
  }

  static getGoalLabels(): LabelEntry[] {
    return this.getLabelsForCategory('goal_');
  }

  static getRiskProfileLabels(): LabelEntry[] {
    return this.getLabelsForCategory('risk_');
  }

  static getPhaseLabels(): LabelEntry[] {
    return this.getLabelsForCategory('phase_');
  }

  static getScenarioLabels(): LabelEntry[] {
    return this.getLabelsForCategory('scenario_');
  }
}

console.log('✅ Report Label Registry initialized');
