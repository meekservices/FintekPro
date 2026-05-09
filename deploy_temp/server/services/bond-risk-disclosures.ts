/**
 * Bond Risk Disclosure Service
 * SEBI NCS (Non-Convertible Securities) Compliant Risk Disclosures
 * 
 * Required disclosures for different bond types per SEBI regulations:
 * - Listed NCDs: Standard risk disclosures
 * - Unlisted NCDs: Enhanced risk disclosures (private placement)
 * - Government Securities: Minimal disclosures (sovereign guarantee)
 * - Corporate Bonds: Credit risk disclosures
 */

import { RegulatoryTier, REGULATORY_TIERS } from '../bond-kyc-gate';

export interface BondRiskDisclosure {
  id: string;
  category: 'credit' | 'interest_rate' | 'liquidity' | 'reinvestment' | 'call' | 'regulatory' | 'tax' | 'default' | 'inflation';
  title: string;
  description: string;
  mandatory: boolean;
  applicableTo: string[]; // Bond types this applies to
}

export interface BondRiskAcknowledgment {
  userId: string;
  bondId: string;
  isin: string;
  bondType: string;
  tradeType: 'buy' | 'sell';
  acknowledgedAt: Date;
  ipAddress: string;
  userAgent: string;
  disclosureVersion: string;
  regulatoryTier: RegulatoryTier;
  disclosuresAcknowledged: string[];
}

export const SEBI_BOND_RISK_DISCLOSURES: BondRiskDisclosure[] = [
  // Credit Risk Disclosures
  {
    id: 'credit-1',
    category: 'credit',
    title: 'Credit/Default Risk',
    description: 'The issuer may fail to make timely payment of principal and/or interest (coupon). Credit rating downgrades may affect bond prices negatively. Lower-rated bonds carry higher default risk.',
    mandatory: true,
    applicableTo: ['ncd', 'corporate_bond', 'debenture', 'unlisted_ncd', 'private_placement'],
  },
  {
    id: 'credit-2',
    category: 'credit',
    title: 'Credit Rating Changes',
    description: 'Credit ratings are subject to change. A downgrade in credit rating by rating agencies (CRISIL, ICRA, CARE, etc.) can significantly impact the market price and liquidity of the bond.',
    mandatory: true,
    applicableTo: ['ncd', 'corporate_bond', 'debenture', 'unlisted_ncd'],
  },
  
  // Interest Rate Risk
  {
    id: 'interest-1',
    category: 'interest_rate',
    title: 'Interest Rate Risk',
    description: 'Bond prices move inversely to interest rates. When interest rates rise, existing bond prices fall. Longer duration bonds are more sensitive to interest rate changes.',
    mandatory: true,
    applicableTo: ['g_sec', 'sdl', 't_bill', 'sgb', 'ncd', 'corporate_bond', 'tax_free_bond', 'infrastructure_bond'],
  },
  {
    id: 'interest-2',
    category: 'interest_rate',
    title: 'Duration Risk',
    description: 'Longer maturity bonds have higher duration risk. A 1% change in interest rates can cause significant price movement in long-duration bonds.',
    mandatory: true,
    applicableTo: ['g_sec', 'sdl', 'ncd', 'corporate_bond', 'tax_free_bond'],
  },
  
  // Liquidity Risk
  {
    id: 'liquidity-1',
    category: 'liquidity',
    title: 'Liquidity Risk',
    description: 'Not all bonds trade actively in the secondary market. You may not be able to sell your bonds when needed at the desired price. Lower-rated and longer-maturity bonds typically have lower liquidity.',
    mandatory: true,
    applicableTo: ['ncd', 'corporate_bond', 'debenture', 'tax_free_bond', 'infrastructure_bond'],
  },
  {
    id: 'liquidity-2',
    category: 'liquidity',
    title: 'Unlisted Bond Liquidity',
    description: 'Unlisted bonds and private placement NCDs have very limited or no secondary market. You may have to hold these until maturity. Exit before maturity may not be possible.',
    mandatory: true,
    applicableTo: ['unlisted_ncd', 'private_placement', 'subordinated_debt'],
  },
  
  // Reinvestment Risk
  {
    id: 'reinvestment-1',
    category: 'reinvestment',
    title: 'Reinvestment Risk',
    description: 'When bonds mature or coupons are received, you may have to reinvest at prevailing interest rates which could be lower than your current yield, reducing overall returns.',
    mandatory: false,
    applicableTo: ['g_sec', 'ncd', 'corporate_bond', 'tax_free_bond'],
  },
  
  // Call Risk
  {
    id: 'call-1',
    category: 'call',
    title: 'Call/Put Option Risk',
    description: 'Some bonds have embedded call options allowing issuers to redeem before maturity, typically when interest rates fall. This limits price appreciation potential and forces early reinvestment.',
    mandatory: true,
    applicableTo: ['ncd', 'corporate_bond', 'at1_bond', 'perpetual_bond'],
  },
  
  // AT1/Perpetual Bond Specific
  {
    id: 'call-2',
    category: 'call',
    title: 'AT1 Bond Risks',
    description: 'Additional Tier 1 (AT1) bonds are perpetual with no maturity date. They can be written down or converted to equity if the issuing bank\'s capital falls below regulatory thresholds. Coupon payments can be skipped without default.',
    mandatory: true,
    applicableTo: ['at1_bond', 'perpetual_bond'],
  },
  
  // Regulatory Risk
  {
    id: 'regulatory-1',
    category: 'regulatory',
    title: 'Regulatory Changes',
    description: 'Changes in RBI, SEBI, or other regulatory norms may affect bond valuations, eligibility criteria, or tax treatment. Compliance requirements may change during the investment period.',
    mandatory: true,
    applicableTo: ['ncd', 'corporate_bond', 'at1_bond', 'subordinated_debt'],
  },
  {
    id: 'regulatory-2',
    category: 'regulatory',
    title: 'Private Placement Regulations',
    description: 'Private placement NCDs are subject to SEBI (Issue and Listing of Non-Convertible Securities) Regulations. Only qualified institutional buyers and high net worth individuals meeting specified criteria can invest.',
    mandatory: true,
    applicableTo: ['unlisted_ncd', 'private_placement'],
  },
  
  // Tax Risk
  {
    id: 'tax-1',
    category: 'tax',
    title: 'Tax Implications',
    description: 'Interest income from most bonds is taxable at your marginal tax rate. TDS is deducted on interest payments. Capital gains on sale are subject to applicable tax rates. Tax laws may change.',
    mandatory: true,
    applicableTo: ['ncd', 'corporate_bond', 'debenture', 'g_sec', 'sdl'],
  },
  {
    id: 'tax-2',
    category: 'tax',
    title: 'Tax-Free Bond Status',
    description: 'Tax-free bonds provide tax-exempt interest under Section 10(15)(iv)(h). However, capital gains on sale are taxable. Tax exemption benefits apply only to specified government-backed infrastructure bonds.',
    mandatory: true,
    applicableTo: ['tax_free_bond', 'infrastructure_bond'],
  },
  {
    id: 'tax-3',
    category: 'tax',
    title: 'Section 54EC Bond Benefits',
    description: '54EC bonds provide capital gains tax exemption under specific conditions. Investment must be within 6 months of capital gain, lock-in period of 5 years applies, and maximum investment limit of ₹50 lakhs per financial year.',
    mandatory: true,
    applicableTo: ['54ec_bond'],
  },
  
  // Default Risk
  {
    id: 'default-1',
    category: 'default',
    title: 'Issuer Default',
    description: 'In case of issuer default, bondholders may lose principal and/or accrued interest. Recovery depends on the issuer\'s assets and your position in the creditor hierarchy. Secured bonds have priority over unsecured bonds.',
    mandatory: true,
    applicableTo: ['ncd', 'corporate_bond', 'debenture', 'unlisted_ncd', 'subordinated_debt'],
  },
  {
    id: 'default-2',
    category: 'default',
    title: 'Subordinated Debt Risk',
    description: 'Subordinated debt ranks lower than senior debt in liquidation. In case of issuer default, subordinated debt holders are paid after senior creditors, significantly increasing loss risk.',
    mandatory: true,
    applicableTo: ['subordinated_debt', 'at1_bond'],
  },
  
  // Inflation Risk
  {
    id: 'inflation-1',
    category: 'inflation',
    title: 'Inflation Risk',
    description: 'Fixed coupon bonds may provide negative real returns if inflation exceeds the coupon rate. Purchasing power of future cash flows may be eroded by inflation over the investment period.',
    mandatory: false,
    applicableTo: ['g_sec', 'sdl', 'ncd', 'corporate_bond', 'tax_free_bond'],
  },
  
  // Government Securities Specific
  {
    id: 'gsec-1',
    category: 'interest_rate',
    title: 'G-Sec Market Risk',
    description: 'While Government Securities carry sovereign guarantee for principal and interest, they are subject to market price fluctuations. Selling before maturity may result in capital gains or losses based on prevailing interest rates.',
    mandatory: true,
    applicableTo: ['g_sec', 'sdl', 't_bill'],
  },
  
  // SGB Specific
  {
    id: 'sgb-1',
    category: 'liquidity',
    title: 'SGB Lock-in and Liquidity',
    description: 'Sovereign Gold Bonds have an 8-year tenure with exit option after 5 years. Early redemption is available only on interest payment dates after year 5. Secondary market trading may have limited liquidity.',
    mandatory: true,
    applicableTo: ['sgb'],
  },
  {
    id: 'sgb-2',
    category: 'interest_rate',
    title: 'Gold Price Risk',
    description: 'SGB returns depend on gold price movements. Gold prices can be volatile and there is no guaranteed appreciation. The redemption value is linked to prevailing gold prices which may be lower than purchase price.',
    mandatory: true,
    applicableTo: ['sgb'],
  },
];

export interface BondDisclosureResult {
  disclosures: BondRiskDisclosure[];
  mandatoryCount: number;
  allMandatory: BondRiskDisclosure[];
  optional: BondRiskDisclosure[];
  version: string;
}

/**
 * Get applicable risk disclosures for a specific bond type
 */
export function getBondRiskDisclosures(bondType: string, tier: RegulatoryTier): BondDisclosureResult {
  const normalizedType = bondType.toLowerCase().replace(/[_-]/g, '');
  
  // Filter disclosures applicable to this bond type
  const applicableDisclosures = SEBI_BOND_RISK_DISCLOSURES.filter(disclosure => {
    return disclosure.applicableTo.some(type => 
      normalizedType.includes(type.replace(/[_-]/g, '')) || 
      type.replace(/[_-]/g, '').includes(normalizedType)
    );
  });
  
  // Add tier-specific disclosures
  const tierRequirements = REGULATORY_TIERS[tier];
  
  // All disclosures for tier 3 (accredited investor) products
  if (tier === 'tier3_accredited') {
    const additionalDisclosures: BondRiskDisclosure[] = [
      {
        id: 'accredited-1',
        category: 'regulatory',
        title: 'Accredited Investor Declaration',
        description: `By proceeding, you confirm that you meet the SEBI Accredited Investor criteria: Net worth of at least ₹7.5 crores (excluding principal residence) or annual income of at least ₹2 crores, or combined annual income of ₹1.5 crores and net worth of ₹3.75 crores.`,
        mandatory: true,
        applicableTo: ['all'],
      },
      {
        id: 'accredited-2',
        category: 'regulatory',
        title: 'Sophisticated Investor Acknowledgment',
        description: 'You acknowledge that as an accredited investor, you are expected to understand complex financial instruments and have the financial capacity to bear potential losses from high-risk investments.',
        mandatory: true,
        applicableTo: ['all'],
      },
    ];
    applicableDisclosures.push(...additionalDisclosures);
  }
  
  const mandatoryDisclosures = applicableDisclosures.filter(d => d.mandatory);
  const optionalDisclosures = applicableDisclosures.filter(d => !d.mandatory);
  
  return {
    disclosures: applicableDisclosures,
    mandatoryCount: mandatoryDisclosures.length,
    allMandatory: mandatoryDisclosures,
    optional: optionalDisclosures,
    version: '1.0.0',
  };
}

/**
 * Validate that all mandatory disclosures have been acknowledged
 */
export function validateDisclosureAcknowledgments(
  bondType: string, 
  tier: RegulatoryTier,
  acknowledgedIds: string[]
): { valid: boolean; missingDisclosures: BondRiskDisclosure[] } {
  const { allMandatory } = getBondRiskDisclosures(bondType, tier);
  
  const missingDisclosures = allMandatory.filter(
    disclosure => !acknowledgedIds.includes(disclosure.id)
  );
  
  return {
    valid: missingDisclosures.length === 0,
    missingDisclosures,
  };
}

/**
 * Get disclosure summary for display
 */
export function getDisclosureSummary(bondType: string, tier: RegulatoryTier): string {
  const { mandatoryCount, allMandatory } = getBondRiskDisclosures(bondType, tier);
  
  const categories = Array.from(new Set(allMandatory.map(d => d.category)));
  const categoryNames = categories.map(cat => 
    cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')
  );
  
  return `You must acknowledge ${mandatoryCount} mandatory risk disclosures covering: ${categoryNames.join(', ')}.`;
}

export const bondRiskDisclosureService = {
  getDisclosures: getBondRiskDisclosures,
  validateAcknowledgments: validateDisclosureAcknowledgments,
  getSummary: getDisclosureSummary,
  allDisclosures: SEBI_BOND_RISK_DISCLOSURES,
};
