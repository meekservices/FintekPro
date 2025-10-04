import { db } from "./db";
import { taxRules } from "@shared/schema";

/**
 * Seed initial tax rules for the 2024-25 financial year
 * This includes:
 * - STCG: 20% (effective from July 23, 2024 budget)
 * - LTCG: 12.5% above ₹1.25L exemption (effective from July 23, 2024 budget)
 * - Income tax slabs for old and new regime
 */

const initialTaxRules = [
  // Capital Gains Tax Rules - FY 2024-25
  {
    ruleType: 'capital_gains',
    category: 'stcg',
    value: '20.00',
    minAmount: null,
    maxAmount: null,
    effectiveFrom: '2024-07-23', // Budget 2024 effective date
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'Short Term Capital Gains Tax on equity and equity mutual funds',
      budgetYear: '2024-25',
      assetClass: 'equity',
      holdingPeriod: 'Less than 12 months'
    }
  },
  {
    ruleType: 'capital_gains',
    category: 'ltcg',
    value: '12.50',
    minAmount: '125000.00', // Exemption limit of ₹1.25L
    maxAmount: null,
    effectiveFrom: '2024-07-23', // Budget 2024 effective date
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'Long Term Capital Gains Tax on equity and equity mutual funds above ₹1.25L',
      budgetYear: '2024-25',
      assetClass: 'equity',
      holdingPeriod: '12 months or more',
      exemptionLimit: 125000
    }
  },
  
  // New Tax Regime - Income Slabs FY 2024-25
  {
    ruleType: 'income_slab',
    category: 'new_regime_0_3',
    value: '0.00',
    minAmount: '0.00',
    maxAmount: '300000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'New regime: Income up to ₹3 lakh - NIL tax',
      regime: 'new',
      standardDeduction: 75000 // Standard deduction under new regime from FY 2024-25
    }
  },
  {
    ruleType: 'income_slab',
    category: 'new_regime_3_7',
    value: '5.00',
    minAmount: '300001.00',
    maxAmount: '700000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'New regime: Income between ₹3L-₹7L - 5%',
      regime: 'new'
    }
  },
  {
    ruleType: 'income_slab',
    category: 'new_regime_7_10',
    value: '10.00',
    minAmount: '700001.00',
    maxAmount: '1000000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'New regime: Income between ₹7L-₹10L - 10%',
      regime: 'new'
    }
  },
  {
    ruleType: 'income_slab',
    category: 'new_regime_10_12',
    value: '15.00',
    minAmount: '1000001.00',
    maxAmount: '1200000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'New regime: Income between ₹10L-₹12L - 15%',
      regime: 'new'
    }
  },
  {
    ruleType: 'income_slab',
    category: 'new_regime_12_15',
    value: '20.00',
    minAmount: '1200001.00',
    maxAmount: '1500000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'New regime: Income between ₹12L-₹15L - 20%',
      regime: 'new'
    }
  },
  {
    ruleType: 'income_slab',
    category: 'new_regime_above_15',
    value: '30.00',
    minAmount: '1500001.00',
    maxAmount: null,
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'New regime: Income above ₹15L - 30%',
      regime: 'new'
    }
  },

  // Old Tax Regime - Income Slabs FY 2024-25
  {
    ruleType: 'income_slab',
    category: 'old_regime_0_2.5',
    value: '0.00',
    minAmount: '0.00',
    maxAmount: '250000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'Old regime: Income up to ₹2.5 lakh - NIL tax',
      regime: 'old',
      deductionsAllowed: true
    }
  },
  {
    ruleType: 'income_slab',
    category: 'old_regime_2.5_5',
    value: '5.00',
    minAmount: '250001.00',
    maxAmount: '500000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'Old regime: Income between ₹2.5L-₹5L - 5%',
      regime: 'old',
      deductionsAllowed: true
    }
  },
  {
    ruleType: 'income_slab',
    category: 'old_regime_5_10',
    value: '20.00',
    minAmount: '500001.00',
    maxAmount: '1000000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'Old regime: Income between ₹5L-₹10L - 20%',
      regime: 'old',
      deductionsAllowed: true
    }
  },
  {
    ruleType: 'income_slab',
    category: 'old_regime_above_10',
    value: '30.00',
    minAmount: '1000001.00',
    maxAmount: null,
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'Old regime: Income above ₹10L - 30%',
      regime: 'old',
      deductionsAllowed: true
    }
  },

  // Common Deduction Limits
  {
    ruleType: 'deduction_limit',
    category: '80c',
    value: '150000.00',
    minAmount: null,
    maxAmount: '150000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'Section 80C deduction limit',
      applicableRegime: 'old',
      section: '80C'
    }
  },
  {
    ruleType: 'deduction_limit',
    category: '80d',
    value: '25000.00',
    minAmount: null,
    maxAmount: '25000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'Section 80D health insurance premium deduction (individual)',
      applicableRegime: 'old',
      section: '80D',
      category: 'self_family'
    }
  },
  {
    ruleType: 'deduction_limit',
    category: '80d_senior',
    value: '50000.00',
    minAmount: null,
    maxAmount: '50000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'Section 80D health insurance premium deduction (senior citizen)',
      applicableRegime: 'old',
      section: '80D',
      category: 'senior_citizen'
    }
  },

  // Exemption Limits
  {
    ruleType: 'exemption',
    category: 'ltcg_equity',
    value: '125000.00',
    minAmount: null,
    maxAmount: '125000.00',
    effectiveFrom: '2024-07-23',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'LTCG exemption limit for equity and equity mutual funds',
      budgetYear: '2024-25',
      assetClass: 'equity'
    }
  },
  {
    ruleType: 'exemption',
    category: 'basic_exemption_new',
    value: '300000.00',
    minAmount: null,
    maxAmount: '300000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'Basic exemption limit under new regime',
      regime: 'new'
    }
  },
  {
    ruleType: 'exemption',
    category: 'basic_exemption_old',
    value: '250000.00',
    minAmount: null,
    maxAmount: '250000.00',
    effectiveFrom: '2024-04-01',
    effectiveTo: null,
    isActive: true,
    metadata: {
      description: 'Basic exemption limit under old regime',
      regime: 'old'
    }
  }
];

export async function seedTaxRules() {
  console.log('🌱 Seeding tax rules for FY 2024-25...');
  
  try {
    // Insert all tax rules
    for (const rule of initialTaxRules) {
      await db.insert(taxRules).values(rule).onConflictDoNothing();
    }
    
    console.log(`✅ Successfully seeded ${initialTaxRules.length} tax rules`);
    console.log('📋 Tax rules summary:');
    console.log('   - Capital Gains: STCG 20%, LTCG 12.5%');
    console.log('   - New Regime: 7 income slabs');
    console.log('   - Old Regime: 4 income slabs');
    console.log('   - Deduction Limits: 80C, 80D');
    console.log('   - Exemptions: LTCG, Basic exemption');
    
  } catch (error) {
    console.error('❌ Error seeding tax rules:', error);
    throw error;
  }
}

// Run seed if this file is executed directly
if (require.main === module) {
  seedTaxRules()
    .then(() => {
      console.log('✅ Seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seed failed:', error);
      process.exit(1);
    });
}
