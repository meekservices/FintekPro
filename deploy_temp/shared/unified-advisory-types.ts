/**
 * Unified AI Advisory Engine Types
 * 
 * Risk-Based | Controlled Advisory | Agent Portal
 * All products covered with regulatory gating and suitability controls
 */

export type ProductType = 
  | 'STOCK'           // Listed stocks (India) - Cash segment only
  | 'MF'              // Mutual Funds - All categories, horizon-gated
  | 'BOND'            // Bonds / NCDs - Credit & duration matched
  | 'UNLISTED'        // Unlisted / Pre-IPO Stocks - HNI+ only
  | 'MLD'             // Market Linked Debentures - Capital-at-risk disclosure
  | 'PMS'             // Portfolio Management Service - sHNI/bHNI only
  | 'AIF'             // Alternative Investment Fund Cat II/III - sHNI/bHNI only
  | 'CFD'             // CFDs / Global Equities - Offshore only, with regulatory notice
  | 'TREASURY';       // Treasury Products (Corporate) - Debt & cash only

export type ActionType = 'BUY' | 'SELL' | 'HOLD' | 'SWITCH';

export type RiskCategory = 
  | 'conservative'     // Liquid MF, Debt MF, AAA Bonds
  | 'moderate'         // Equity MF, Hybrid MF, Select Bonds
  | 'aggressive'       // Stocks, Equity MF, PMS, AIF, MLD
  | 'very_aggressive'; // Unlisted equity, AIF III, Offshore (HNI+)

export type ClientCategory = 
  | 'retail'           // Standard retail investor
  | 'HNI'              // High Net Worth Individual (₹2Cr+)
  | 'sHNI'             // Super HNI (₹5Cr+)
  | 'bHNI'             // Big HNI (₹25Cr+)
  | 'institutional';   // Institutional investor

export type InvestmentHorizon = 
  | 'ultra_short'      // < 1 month
  | 'short'            // 1-6 months
  | 'medium'           // 6 months - 2 years
  | 'long'             // 2-5 years
  | 'very_long';       // 5+ years

export type ExecutionChannel = 
  | 'API'              // Direct API execution (Stocks, MF, Bonds)
  | 'WORKFLOW'         // Application workflow (MLD, PMS, AIF)
  | 'ESCROW'           // Manual escrow/partner (Unlisted)
  | 'REDIRECT';        // Redirect to offshore broker (CFD)

export interface ProductEligibilityRule {
  productType: ProductType;
  allowedRiskCategories: RiskCategory[];
  requiredClientCategories: ClientCategory[];
  minHorizon: InvestmentHorizon;
  maxAllocationPercent: number;
  regulatoryNotice?: string;
  lockInPeriod?: string;
  executionChannel: ExecutionChannel;
}

export const PRODUCT_ELIGIBILITY_MATRIX: ProductEligibilityRule[] = [
  {
    productType: 'STOCK',
    allowedRiskCategories: ['moderate', 'aggressive', 'very_aggressive'],
    requiredClientCategories: ['retail', 'HNI', 'sHNI', 'bHNI', 'institutional'],
    minHorizon: 'short',
    maxAllocationPercent: 100,
    executionChannel: 'API',
  },
  {
    productType: 'MF',
    allowedRiskCategories: ['conservative', 'moderate', 'aggressive', 'very_aggressive'],
    requiredClientCategories: ['retail', 'HNI', 'sHNI', 'bHNI', 'institutional'],
    minHorizon: 'ultra_short',
    maxAllocationPercent: 100,
    executionChannel: 'API',
  },
  {
    productType: 'BOND',
    allowedRiskCategories: ['conservative', 'moderate', 'aggressive'],
    requiredClientCategories: ['retail', 'HNI', 'sHNI', 'bHNI', 'institutional'],
    minHorizon: 'medium',
    maxAllocationPercent: 100,
    executionChannel: 'API',
  },
  {
    productType: 'UNLISTED',
    allowedRiskCategories: ['aggressive', 'very_aggressive'],
    requiredClientCategories: ['HNI', 'sHNI', 'bHNI'],
    minHorizon: 'long',
    maxAllocationPercent: 15,
    regulatoryNotice: 'High liquidity risk. Extended lock-in period. Valuation uncertainty.',
    lockInPeriod: '1-5 years',
    executionChannel: 'ESCROW',
  },
  {
    productType: 'MLD',
    allowedRiskCategories: ['aggressive', 'very_aggressive'],
    requiredClientCategories: ['HNI', 'sHNI', 'bHNI'],
    minHorizon: 'medium',
    maxAllocationPercent: 20,
    regulatoryNotice: 'Capital at risk. Returns linked to underlying index performance.',
    executionChannel: 'WORKFLOW',
  },
  {
    productType: 'PMS',
    allowedRiskCategories: ['aggressive', 'very_aggressive'],
    requiredClientCategories: ['sHNI', 'bHNI'],
    minHorizon: 'long',
    maxAllocationPercent: 40,
    regulatoryNotice: 'Capital loss risk. Illiquid. Manager discretion applies.',
    lockInPeriod: '3 years recommended',
    executionChannel: 'WORKFLOW',
  },
  {
    productType: 'AIF',
    allowedRiskCategories: ['aggressive', 'very_aggressive'],
    requiredClientCategories: ['sHNI', 'bHNI'],
    minHorizon: 'very_long',
    maxAllocationPercent: 30,
    regulatoryNotice: 'Capital loss risk. Illiquid. Extended lock-in. Manager risk.',
    lockInPeriod: '3-7 years',
    executionChannel: 'WORKFLOW',
  },
  {
    productType: 'CFD',
    allowedRiskCategories: ['very_aggressive'],
    requiredClientCategories: ['HNI', 'sHNI', 'bHNI'],
    minHorizon: 'short',
    maxAllocationPercent: 10,
    regulatoryNotice: 'International/Offshore Investment - Not SEBI-regulated. High leverage risk.',
    executionChannel: 'REDIRECT',
  },
  {
    productType: 'TREASURY',
    allowedRiskCategories: ['conservative', 'moderate'],
    requiredClientCategories: ['institutional'],
    minHorizon: 'ultra_short',
    maxAllocationPercent: 100,
    executionChannel: 'API',
  },
];

export interface PortfolioImpact {
  returnBefore: number;
  returnAfter: number;
  riskBefore: RiskCategory | 'low' | 'medium' | 'high';
  riskAfter: RiskCategory | 'low' | 'medium' | 'high';
  concentrationImpact?: string;
  diversificationScore?: number;
}

export interface UnifiedAdvisoryDecision {
  decisionId: string;
  productType: ProductType;
  action: ActionType;
  productName: string;
  productSymbol?: string;
  isin?: string;
  amount: number;
  units?: number;
  horizon: InvestmentHorizon;
  riskCategory: RiskCategory;
  clientCategory: ClientCategory;
  portfolioImpact: PortfolioImpact;
  primaryReason: string;
  supportingFactors: string[];
  riskNotes: string[];
  regulatoryDisclosures: string[];
  confidence: number;
  generatedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';
  agentId?: string;
  clientApprovalRequired: boolean;
}

export interface AdvisoryTriggerConditions {
  onboardingComplete: boolean;
  panVerified: boolean;
  kycComplete: boolean;
  fatcaComplete: boolean;
  riskProfileComplete: boolean;
  horizonDefined: boolean;
  portfolioAvailable: boolean;
  clientCategoryValidated: boolean;
}

export interface TriggerValidationResult {
  canProceed: boolean;
  missingConditions: string[];
  blockerReasons: string[];
}

export interface ProductSpecificLogic {
  productType: ProductType;
  buyConditions: string[];
  sellConditions: string[];
  holdConditions?: string[];
  switchConditions?: string[];
}

export const PRODUCT_ADVISORY_LOGIC: ProductSpecificLogic[] = [
  {
    productType: 'STOCK',
    buyConditions: [
      'Improves portfolio risk-adjusted CAGR',
      'Earnings & ROCE stable or improving',
      'Sector concentration within limits',
      'Valuation attractive relative to peers'
    ],
    sellConditions: [
      'Fundamental deterioration (declining margins, rising debt)',
      'Valuation risk (P/E significantly above historical)',
      'Goal mismatch (horizon change)',
      'Concentration exceeds limits'
    ],
  },
  {
    productType: 'MF',
    buyConditions: [
      'Positive rolling alpha vs benchmark',
      'Lower downside capture ratio',
      'Improves portfolio diversification',
      'Expense ratio competitive'
    ],
    sellConditions: [
      'Sustained underperformance (>2 years below benchmark)',
      'Excess overlap with existing holdings',
      'Expense inefficiency',
      'Fund manager change with track record concern'
    ],
    switchConditions: [
      'Better alternative in same category available',
      'Tax harvesting opportunity'
    ],
  },
  {
    productType: 'BOND',
    buyConditions: [
      'Credit rating within risk tolerance',
      'Duration aligned with investment horizon',
      'Yield improves portfolio stability',
      'Issuer fundamentals stable'
    ],
    sellConditions: [
      'Credit downgrade or outlook negative',
      'Duration mismatch with goals',
      'Better risk-adjusted alternative available',
      'Issuer stress signals'
    ],
  },
  {
    productType: 'UNLISTED',
    buyConditions: [
      'Client type ≥ HNI',
      'Risk profile = Aggressive',
      'Allocation cap respected (10-15%)',
      'Lock-in acceptance confirmed',
      'Company fundamentals strong',
      'Pre-IPO pipeline promising'
    ],
    sellConditions: [
      'Liquidity event available (IPO, secondary sale)',
      'Valuation target achieved',
      'Fundamental deterioration',
      'Better deployment opportunity'
    ],
  },
  {
    productType: 'MLD',
    buyConditions: [
      'Underlying product understood by client',
      'Issuer rating AA+/AAA',
      'Horizon matches payoff structure',
      'Client accepts capital-at-risk'
    ],
    sellConditions: [
      'Approaching maturity',
      'Credit concern on issuer',
      'Better structured alternative'
    ],
  },
  {
    productType: 'PMS',
    buyConditions: [
      'Long-term goals only (3+ years)',
      'Client category sHNI/bHNI',
      'IRR consistency proven (>3 year track record)',
      'Strategy aligned with risk profile'
    ],
    sellConditions: [
      'Consistent underperformance',
      'Manager departure',
      'Goal achieved or changed',
      'Better alternative available'
    ],
  },
  {
    productType: 'AIF',
    buyConditions: [
      'Very long-term horizon (5+ years)',
      'Client category sHNI/bHNI',
      'Fund strategy understood',
      'Lock-in accepted',
      'Allocation within limits'
    ],
    sellConditions: [
      'Lock-in period ended',
      'Fund performance below expectations',
      'Capital call concerns',
      'Exit opportunity optimal'
    ],
  },
  {
    productType: 'CFD',
    buyConditions: [
      'Client qualifies as Eligible Investor',
      'Offshore broker integration exists',
      'Risk acknowledged',
      'Allocation minimal (<10%)',
      'Hedging or diversification purpose clear'
    ],
    sellConditions: [
      'Target achieved',
      'Risk limits breached',
      'Better domestic alternative available'
    ],
  },
  {
    productType: 'TREASURY',
    buyConditions: [
      'Corporate cash deployment need',
      'Duration within mandate',
      'Credit risk within policy',
      'Yield optimizes idle cash'
    ],
    sellConditions: [
      'Operating cash requirement',
      'Better yield opportunity',
      'Credit concern'
    ],
  },
];

export const REGULATORY_DISCLOSURES: Record<ProductType, string[]> = {
  STOCK: [
    'Market risks apply. Investments in securities are subject to market risks.',
    'Past performance is not indicative of future returns.',
    'Read all scheme related documents carefully before investing.'
  ],
  MF: [
    'Mutual Fund investments are subject to market risks.',
    'Read all scheme related documents carefully before investing.',
    'Past performance is not indicative of future returns.'
  ],
  BOND: [
    'Bond prices are subject to interest rate and credit risk.',
    'Capital may be at risk. Read offer documents carefully.',
    'Liquidity in secondary market may be limited.'
  ],
  UNLISTED: [
    'Unlisted securities are illiquid and high risk.',
    'Valuation is uncertain and exit may take extended period.',
    'Capital loss is possible. Suitable only for sophisticated investors.',
    'Not regulated by stock exchanges.'
  ],
  MLD: [
    'Capital is at risk. Principal protection is not guaranteed.',
    'Returns are linked to underlying market performance.',
    'Read product term sheet carefully before investing.',
    'Issuer credit risk applies.'
  ],
  PMS: [
    'Capital loss risk exists. Not a guaranteed product.',
    'Manager discretion in investment decisions.',
    'Minimum investment ₹50 lakhs. SEBI regulated.',
    'Past performance not indicative of future returns.'
  ],
  AIF: [
    'Alternative Investment Funds are high risk, illiquid investments.',
    'Lock-in periods of 3-7 years typically apply.',
    'Capital loss is possible. Manager risk exists.',
    'Minimum investment ₹1 crore. SEBI Category II/III regulated.'
  ],
  CFD: [
    'International/Offshore Investment - NOT SEBI-regulated.',
    'High leverage can result in losses exceeding initial investment.',
    'Currency risk applies. Not suitable for retail investors.',
    'Consult offshore broker terms and conditions.'
  ],
  TREASURY: [
    'Corporate treasury products are debt instruments only.',
    'Credit risk and interest rate risk apply.',
    'Suitable for institutional investors with appropriate mandates.'
  ],
};

export interface AdvisoryAuditLog {
  logId: string;
  sessionId: string;
  agentId: string;
  clientId: string;
  timestamp: Date;
  eventType: 'trigger_check' | 'eligibility_check' | 'recommendation_generated' | 
             'recommendation_shared' | 'client_approved' | 'client_rejected' |
             'execution_initiated' | 'execution_completed' | 'execution_failed';
  productType?: ProductType;
  decisionId?: string;
  riskProfileUsed?: RiskCategory;
  clientCategoryUsed?: ClientCategory;
  eligibilityResult?: boolean;
  aiReasoningSnapshot?: string;
  disclosuresShown?: string[];
  clientResponse?: string;
  executionOutcome?: string;
  metadata: Record<string, any>;
  retentionYears: number;
}

export function getHorizonOrder(horizon: InvestmentHorizon): number {
  const order: Record<InvestmentHorizon, number> = {
    ultra_short: 0,
    short: 1,
    medium: 2,
    long: 3,
    very_long: 4
  };
  return order[horizon];
}

export function isHorizonSufficient(clientHorizon: InvestmentHorizon, requiredHorizon: InvestmentHorizon): boolean {
  return getHorizonOrder(clientHorizon) >= getHorizonOrder(requiredHorizon);
}

export function getNetWorthForCategory(category: ClientCategory): number {
  const thresholds: Record<ClientCategory, number> = {
    retail: 0,
    HNI: 20000000,      // ₹2 Cr
    sHNI: 50000000,     // ₹5 Cr
    bHNI: 250000000,    // ₹25 Cr
    institutional: 0     // Different criteria
  };
  return thresholds[category];
}

export function determineClientCategory(netWorth: number, isInstitutional: boolean = false): ClientCategory {
  if (isInstitutional) return 'institutional';
  if (netWorth >= 250000000) return 'bHNI';
  if (netWorth >= 50000000) return 'sHNI';
  if (netWorth >= 20000000) return 'HNI';
  return 'retail';
}

export function getRiskScoreForCategory(category: RiskCategory): { min: number; max: number } {
  const ranges: Record<RiskCategory, { min: number; max: number }> = {
    conservative: { min: 0, max: 35 },
    moderate: { min: 25, max: 65 },
    aggressive: { min: 55, max: 85 },
    very_aggressive: { min: 75, max: 100 }
  };
  return ranges[category];
}
