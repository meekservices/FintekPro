/**
 * Product Eligibility Matrix for KYC Compliance
 * Based on SEBI, RBI, PMLA, and IRDAI regulations
 * Last Updated: October 2025
 */

export type KycTier = 'basic' | 'enhanced' | 'accredited_investor';

export type ProductCategory = 
  | 'mutual_funds'
  | 'equity_cash'
  | 'equity_derivatives'
  | 'currency_derivatives'
  | 'commodity_derivatives'
  | 'ipo'
  | 'government_bonds'
  | 'corporate_bonds'
  | 'aif'
  | 'pms'
  | 'insurance'
  | 'nps'
  | 'fixed_deposits'
  | 'loans'
  | 'credit_cards'
  | 'forex';

export interface ProductEligibilityRule {
  productCode: ProductCategory;
  productName: string;
  minKycTier: KycTier;
  requiresVideoKyc: boolean;
  requiresPanVerified: boolean;
  requiresAadhaarVerified: boolean;
  requiresBankVerified: boolean;
  requiresIncomeProof: boolean;
  minAnnualIncome?: number; // in INR
  minNetWorth?: number; // in INR
  maxInvestmentWithoutEnhanced?: number; // in INR
  regulatoryNotes: string;
  sebiGuideline?: string;
}

/**
 * SEBI/RBI Product Eligibility Matrix
 * Defines minimum KYC requirements per product category
 */
export const PRODUCT_ELIGIBILITY_MATRIX: ProductEligibilityRule[] = [
  // Mutual Funds - Basic KYC (< ₹50,000 annual investment)
  {
    productCode: 'mutual_funds',
    productName: 'Mutual Funds',
    minKycTier: 'basic',
    requiresVideoKyc: false,
    requiresPanVerified: false, // Only for investments > ₹50,000
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: false,
    maxInvestmentWithoutEnhanced: 50000, // ₹50,000 per year
    regulatoryNotes: 'SEBI allows simplified KYC for investments < ₹50,000/year. PAN mandatory above this limit.',
    sebiGuideline: 'SEBI Circular SEBI/HO/MIRSD/MIRSD-PoD-1/P/CIR/2023/107'
  },
  
  // Equity Cash Segment - Enhanced KYC
  {
    productCode: 'equity_cash',
    productName: 'Equity Trading (Cash)',
    minKycTier: 'enhanced',
    requiresVideoKyc: true,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: true,
    minAnnualIncome: 100000, // ₹1 lakh minimum
    regulatoryNotes: 'Enhanced KYC mandatory for equity trading. Income proof required for risk assessment.',
    sebiGuideline: 'SEBI (KYC Registration Agency) Regulations, 2011'
  },
  
  // Equity Derivatives (F&O) - Enhanced KYC + Trading Experience
  {
    productCode: 'equity_derivatives',
    productName: 'Equity Derivatives (F&O)',
    minKycTier: 'enhanced',
    requiresVideoKyc: true,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: true,
    minAnnualIncome: 200000, // ₹2 lakh minimum
    regulatoryNotes: 'Enhanced KYC + Trading experience or financial awareness certificate required.',
    sebiGuideline: 'SEBI Circular on Derivatives Trading (2023)'
  },
  
  // Currency Derivatives - Enhanced KYC
  {
    productCode: 'currency_derivatives',
    productName: 'Currency Derivatives',
    minKycTier: 'enhanced',
    requiresVideoKyc: true,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: true,
    minAnnualIncome: 200000,
    regulatoryNotes: 'Enhanced KYC mandatory for currency derivatives trading.',
    sebiGuideline: 'SEBI Guidelines for Currency Derivatives Segment'
  },
  
  // Commodity Derivatives - Enhanced KYC
  {
    productCode: 'commodity_derivatives',
    productName: 'Commodity Derivatives',
    minKycTier: 'enhanced',
    requiresVideoKyc: true,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: true,
    minAnnualIncome: 200000,
    regulatoryNotes: 'Enhanced KYC required for commodity futures and options.',
    sebiGuideline: 'SEBI (Commodity Derivatives) Regulations'
  },
  
  // IPO - Enhanced KYC
  {
    productCode: 'ipo',
    productName: 'IPO Applications',
    minKycTier: 'enhanced',
    requiresVideoKyc: false,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: false,
    regulatoryNotes: 'PAN, Aadhaar, and bank verification mandatory for IPO applications.',
    sebiGuideline: 'SEBI (ICDR) Regulations, 2018'
  },
  
  // Government Bonds - Basic KYC
  {
    productCode: 'government_bonds',
    productName: 'Government Securities (G-Sec)',
    minKycTier: 'basic',
    requiresVideoKyc: false,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: false,
    regulatoryNotes: 'Basic KYC sufficient for government securities. Safe and low-risk investment.',
    sebiGuideline: 'RBI Retail Direct Scheme Guidelines'
  },
  
  // Corporate Bonds - Enhanced KYC
  {
    productCode: 'corporate_bonds',
    productName: 'Corporate Bonds',
    minKycTier: 'enhanced',
    requiresVideoKyc: true,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: true,
    minAnnualIncome: 500000, // ₹5 lakh minimum
    regulatoryNotes: 'Enhanced KYC + income proof for corporate bond investments.',
    sebiGuideline: 'SEBI (Issue and Listing of Non-Convertible Securities) Regulations'
  },
  
  // Alternative Investment Funds (AIF) - Accredited Investor ONLY
  {
    productCode: 'aif',
    productName: 'Alternative Investment Funds (AIF)',
    minKycTier: 'accredited_investor',
    requiresVideoKyc: true,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: true,
    minAnnualIncome: 20000000, // ₹2 Crore
    minNetWorth: 75000000, // ₹7.5 Crore (excluding residence)
    regulatoryNotes: 'MANDATORY Accredited Investor status. Minimum investment ₹1 Crore. Annual renewal required.',
    sebiGuideline: 'SEBI (AIF) Regulations, 2012 - Accredited Investor Criteria'
  },
  
  // Portfolio Management Services (PMS) - Accredited Investor
  {
    productCode: 'pms',
    productName: 'Portfolio Management Services (PMS)',
    minKycTier: 'accredited_investor',
    requiresVideoKyc: true,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: true,
    minAnnualIncome: 20000000, // ₹2 Crore OR
    minNetWorth: 75000000, // ₹7.5 Crore
    regulatoryNotes: 'Accredited Investor status required. Minimum investment ₹50 lakh.',
    sebiGuideline: 'SEBI (Portfolio Managers) Regulations, 2020'
  },
  
  // Insurance - Basic KYC
  {
    productCode: 'insurance',
    productName: 'Insurance Products',
    minKycTier: 'basic',
    requiresVideoKyc: false,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: false,
    requiresIncomeProof: false,
    regulatoryNotes: 'Basic KYC for term insurance. Enhanced KYC for ULIP and investment-linked policies.',
    sebiGuideline: 'IRDAI KYC Guidelines 2023'
  },
  
  // National Pension System (NPS) - Basic KYC
  {
    productCode: 'nps',
    productName: 'National Pension System (NPS)',
    minKycTier: 'basic',
    requiresVideoKyc: false,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: false,
    regulatoryNotes: 'Basic KYC + Aadhaar mandatory for NPS account opening.',
    sebiGuideline: 'PFRDA (NPS) Regulations'
  },
  
  // Fixed Deposits - Basic KYC
  {
    productCode: 'fixed_deposits',
    productName: 'Fixed Deposits',
    minKycTier: 'basic',
    requiresVideoKyc: false,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: false,
    regulatoryNotes: 'Basic KYC sufficient. PAN mandatory for interest > ₹40,000/year.',
    sebiGuideline: 'RBI Master Direction - KYC for Bank Accounts'
  },
  
  // Loans - Basic KYC (Lender partners handle eligibility)
  {
    productCode: 'loans',
    productName: 'Loans & Credit',
    minKycTier: 'basic',
    requiresVideoKyc: false,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: false, // Partner lenders verify income
    regulatoryNotes: 'Basic KYC to view pre-approved offers. Partner lenders perform full eligibility checks.',
    sebiGuideline: 'RBI Guidelines on Digital Lending'
  },
  
  // Credit Cards - Basic KYC (Issuer banks handle eligibility)
  {
    productCode: 'credit_cards',
    productName: 'Credit Cards',
    minKycTier: 'basic',
    requiresVideoKyc: false,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: false, // Issuer banks verify income
    regulatoryNotes: 'Basic KYC to view pre-approved offers. Issuer banks perform credit checks and income verification.',
    sebiGuideline: 'RBI Master Direction on Credit Card Operations'
  },
  
  // Forex Trading - Enhanced KYC
  {
    productCode: 'forex',
    productName: 'Forex Trading',
    minKycTier: 'enhanced',
    requiresVideoKyc: true,
    requiresPanVerified: true,
    requiresAadhaarVerified: true,
    requiresBankVerified: true,
    requiresIncomeProof: true,
    minAnnualIncome: 500000, // ₹5 lakh minimum
    regulatoryNotes: 'Enhanced KYC + trading experience required for forex trading.',
    sebiGuideline: 'RBI/FEMA Guidelines on Foreign Exchange Trading'
  }
];

/**
 * Get minimum KYC tier required for a product
 */
export function getMinKycTierForProduct(productCode: ProductCategory): KycTier {
  const rule = PRODUCT_ELIGIBILITY_MATRIX.find(r => r.productCode === productCode);
  return rule?.minKycTier || 'enhanced'; // Default to enhanced for safety
}

/**
 * Check if user's KYC tier meets product requirements
 */
export function isKycTierSufficient(userTier: KycTier, requiredTier: KycTier): boolean {
  const tierHierarchy: Record<KycTier, number> = {
    'basic': 1,
    'enhanced': 2,
    'accredited_investor': 3
  };
  
  return tierHierarchy[userTier] >= tierHierarchy[requiredTier];
}

/**
 * Get all products accessible with a given KYC tier
 */
export function getAccessibleProducts(userTier: KycTier): ProductEligibilityRule[] {
  return PRODUCT_ELIGIBILITY_MATRIX.filter(rule => 
    isKycTierSufficient(userTier, rule.minKycTier)
  );
}

/**
 * Get products that are locked (require higher KYC tier)
 */
export function getLockedProducts(userTier: KycTier): ProductEligibilityRule[] {
  return PRODUCT_ELIGIBILITY_MATRIX.filter(rule => 
    !isKycTierSufficient(userTier, rule.minKycTier)
  );
}

/**
 * Get next KYC tier user should upgrade to for accessing more products
 */
export function getNextKycTier(currentTier: KycTier): KycTier | null {
  if (currentTier === 'basic') return 'enhanced';
  if (currentTier === 'enhanced') return 'accredited_investor';
  return null; // Already at highest tier
}

/**
 * KYC Tier Display Metadata
 */
export const KYC_TIER_METADATA = {
  basic: {
    label: 'Basic KYC',
    color: 'blue',
    icon: 'Shield',
    description: 'Simplified verification for basic investments',
    maxAnnualInvestment: 50000,
    productsUnlocked: ['Mutual Funds (limited)', 'Government Bonds', 'Insurance', 'NPS', 'Fixed Deposits']
  },
  enhanced: {
    label: 'Enhanced KYC',
    color: 'green',
    icon: 'ShieldCheck',
    description: 'Full verification for trading and advanced products',
    maxAnnualInvestment: null, // No limit
    productsUnlocked: ['All Equity Trading', 'Derivatives', 'IPOs', 'Corporate Bonds', 'Loans', 'Credit Cards', 'Forex']
  },
  accredited_investor: {
    label: 'Accredited Investor',
    color: 'purple',
    icon: 'Crown',
    description: 'Exclusive access to premium investment products',
    minIncome: 20000000,
    minNetWorth: 75000000,
    productsUnlocked: ['AIF', 'PMS', 'Hedge Funds', 'Private Equity', 'Structured Products']
  }
} as const;
