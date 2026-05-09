import type { IStorage } from './storage';
import { db } from './db';
import { partners } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Seed product data for FintekPro marketplace - Updated schema sync
export async function seedProducts(storage: IStorage) {
  console.log('🌱 Seeding products with complete schema...');

  const partnerId = 'platform-partner-001'; // Default partner for all seed products
  
  // Ensure the default partner exists before seeding products
  try {
    const existingPartner = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);
    if (existingPartner.length === 0) {
      console.log('📦 Creating default platform partner...');
      await db.insert(partners).values({
        id: partnerId,
        companyName: 'FintekPro Platform',
        contactEmail: 'platform@fintekpro.com',
        password: 'platform-internal-partner',
        partnerType: 'product_provider',
        isActive: true,
        isVerified: true
      });
      console.log('✅ Default platform partner created');
    } else {
      console.log('✅ Default platform partner already exists');
    }
  } catch (partnerError) {
    console.error('⚠️ Error ensuring partner exists:', partnerError);
    // Continue anyway - products will fail gracefully
  }

  const products = [
    // Mutual Funds - Equity
    {
      partnerId,
      category: 'mutual_fund',
      subcategory: 'equity',
      name: 'HDFC Flexi Cap Fund',
      provider: 'HDFC Mutual Fund',
      description: 'Multi-cap equity fund investing across market capitalizations',
      aum: 62500000000,
      nav: 845.32,
      returns1Y: 28.5,
      returns3Y: 22.3,
      returns5Y: 18.7,
      riskLevel: 'high',
      minInvestment: 500,
      expenseRatio: 1.85,
      totalExpenseRatio: 1.92,
      investmentStyle: 'blend',
      marketCapFocus: 'multi_cap',
      strategyFactors: ['momentum', 'quality'],
      sectorFocus: 'diversified',
      investmentTheme: 'general',
      benchmarkIndex: 'NIFTY 500',
      sharpeRatio: 1.45,
      alphaRatio: 3.2,
      betaRatio: 0.98,
      fundManagerName: 'Roshi Jain',
      fundManagerTenure: 8,
      exitLoad: { years: 1, percentage: 1 },
      portfolioHoldings: [
        { name: 'ICICI Bank', percentage: 8.5 },
        { name: 'Infosys', percentage: 7.2 },
        { name: 'Reliance Industries', percentage: 6.8 }
      ],
      sectorAllocation: {
      'Financial Services': 28.5,
        'Technology': 18.2,
        'Energy': 12.3,
        'Consumer': 10.5
      },
      isPublic: true,
      status: 'active'
    },
    {
      partnerId: 'platform-partner-001',
      category: 'mutual_fund',
      subcategory: 'equity',
      name: 'SBI Small Cap Fund',
      provider: 'SBI Mutual Fund',
      description: 'Small cap equity fund for aggressive growth',
      aum: 28000000000,
      nav: 156.84,
      returns1Y: 42.8,
      returns3Y: 31.5,
      returns5Y: 24.2,
      riskLevel: 'very_high',
      minInvestment: 500,
      expenseRatio: 2.15,
      totalExpenseRatio: 2.25,
      investmentStyle: 'growth',
      marketCapFocus: 'small_cap',
      strategyFactors: ['growth', 'momentum'],
      sectorFocus: 'diversified',
      investmentTheme: 'general',
      benchmarkIndex: 'NIFTY Smallcap 250',
      sharpeRatio: 1.22,
      alphaRatio: 5.8,
      betaRatio: 1.15,
      fundManagerName: 'R. Srinivasan',
      fundManagerTenure: 5,
      exitLoad: { years: 1, percentage: 1 },
      isPublic: true,
      status: 'active'
    },
    {
      partnerId: 'platform-partner-001',
      category: 'mutual_fund',
      subcategory: 'debt',
      name: 'ICICI Prudential Corporate Bond Fund',
      provider: 'ICICI Prudential Mutual Fund',
      description: 'High quality corporate bonds for stable income',
      aum: 45000000000,
      nav: 28.45,
      returns1Y: 7.2,
      returns3Y: 7.8,
      returns5Y: 8.1,
      riskLevel: 'low',
      minInvestment: 5000,
      expenseRatio: 0.95,
      totalExpenseRatio: 1.02,
      investmentStyle: 'value',
      creditRating: 'AAA',
      benchmarkIndex: 'CRISIL Corporate Bond Index',
      sharpeRatio: 2.85,
      fundManagerName: 'Manish Banthia',
      fundManagerTenure: 6,
      isPublic: true,
      status: 'active'
    },
    
    // Bonds & NCDs
    {
      partnerId: 'platform-partner-001',
      category: 'bond',
      subcategory: 'ncd',
      name: 'Bajaj Finance NCD Series 2024',
      provider: 'Bajaj Finance',
      issuer: 'Bajaj Finance Limited',
      description: 'Non-convertible debentures with fixed coupon rate',
      couponRate: 8.85,
      maturityDate: '2027-12-15',
      faceValue: 1000,
      creditRating: 'AAA',
      minInvestment: 10000,
      tenure: '36 months',
      yieldToMaturity: 9.2,
      issueSize: 5000000000,
      riskLevel: 'low',
      isPublic: true,
      status: 'active'
    },
    {
      partnerId: 'platform-partner-001',
      category: 'bond',
      subcategory: 'ncd',
      name: 'Tata Capital NCD',
      provider: 'Tata Capital',
      issuer: 'Tata Capital Financial Services',
      description: 'Secured NCDs with quarterly interest payout',
      couponRate: 8.50,
      maturityDate: '2028-03-31',
      faceValue: 1000,
      creditRating: 'AA+',
      minInvestment: 10000,
      tenure: '48 months',
      yieldToMaturity: 8.8,
      issueSize: 3000000000,
      riskLevel: 'moderate',
      isPublic: true,
      status: 'active'
    },
    
    // Market Linked Debentures
    {
      partnerId: 'platform-partner-001',
      category: 'mld',
      subcategory: 'capital_protected',
      name: 'HSBC NIFTY 50 Linked Debenture',
      provider: 'HSBC',
      issuer: 'HSBC India',
      description: '100% capital protected with NIFTY 50 linked returns',
      benchmarkIndex: 'NIFTY 50',
      capitalProtection: '100%',
      participationRate: '85%',
      tenure: '36 months',
      minInvestment: 100000,
      maturityDate: '2027-11-30',
      riskLevel: 'low',
      isPublic: true,
      status: 'active'
    },
    {
      partnerId: 'platform-partner-001',
      category: 'mld',
      subcategory: 'exotic',
      name: 'Axis Bank Multi-Index Digital MLD',
      provider: 'Axis Bank',
      issuer: 'Axis Bank Limited',
      description: 'Digital payoff structure linked to multiple indices',
      benchmarkIndex: 'NIFTY 50, Bank Nifty',
      capitalProtection: '90%',
      participationRate: '120%',
      tenure: '42 months',
      minInvestment: 250000,
      maturityDate: '2028-06-15',
      riskLevel: 'moderate',
      isPublic: true,
      status: 'active'
    },
    
    // Insurance Products
    {
      partnerId: 'platform-partner-001',
      category: 'insurance',
      subcategory: 'life',
      name: 'HDFC Life Click 2 Protect Plus',
      provider: 'HDFC Life',
      description: 'Online term life insurance with comprehensive coverage',
      maxCoverage: 10000000,
      annualPremium: 18000,
      tenure: '30 years',
      claimSettlementRatio: '98.66%',
      taxBenefit: true,
      riskLevel: 'low',
      features: ['Critical illness rider', 'Accidental death benefit', 'Premium waiver'],
      isPublic: true,
      status: 'active'
    },
    {
      partnerId: 'platform-partner-001',
      category: 'insurance',
      subcategory: 'health',
      name: 'Star Health Comprehensive',
      provider: 'Star Health Insurance',
      description: 'Family health insurance with extensive coverage',
      maxCoverage: 2000000,
      annualPremium: 24500,
      claimSettlementRatio: '92.3%',
      taxBenefit: true,
      riskLevel: 'low',
      features: ['Cashless hospitalization', 'Pre and post hospitalization', 'No claim bonus', 'Daily hospital cash'],
      isPublic: true,
      status: 'active'
    },
    {
      partnerId: 'platform-partner-001',
      category: 'insurance',
      subcategory: 'motor',
      name: 'ICICI Lombard Comprehensive Car Insurance',
      provider: 'ICICI Lombard',
      description: 'Complete car protection with add-on covers',
      annualPremium: 15000,
      claimSettlementRatio: '95.8%',
      riskLevel: 'low',
      features: ['Zero depreciation', 'Engine protection', 'NCB protection', 'Return to invoice'],
      isPublic: true,
      status: 'active'
    },
    
    // Banking Products
    {
      partnerId: 'platform-partner-001',
      category: 'banking',
      subcategory: 'fixed-deposits',
      name: 'HDFC Bank Fixed Deposit',
      provider: 'HDFC Bank',
      description: 'High interest fixed deposit for senior citizens',
      interestRate: 7.75,
      minDeposit: 10000,
      tenure: '18 months',
      riskLevel: 'very_low',
      features: ['Quarterly interest payout', 'Auto-renewal', 'Premature withdrawal', 'Loan against FD'],
      isPublic: true,
      status: 'active'
    },
    {
      partnerId: 'platform-partner-001',
      category: 'banking',
      subcategory: 'savings',
      name: 'ICICI Bank Wealth Management Savings',
      provider: 'ICICI Bank',
      description: 'Premium savings account with high interest',
      interestRate: 6.5,
      minDeposit: 100000,
      riskLevel: 'very_low',
      features: ['Free NEFT/RTGS', 'Priority banking', 'Unlimited ATM withdrawals', 'Concierge services'],
      isPublic: true,
      status: 'active'
    },
    {
      partnerId: 'platform-partner-001',
      category: 'banking',
      subcategory: 'credit-cards',
      name: 'SBI Card ELITE',
      provider: 'SBI Card',
      description: 'Premium credit card with rewards and travel benefits',
      annualFee: 4999,
      rewards: '5X rewards on dining, 10X on travel',
      riskLevel: 'low',
      features: ['Lounge access', 'Fuel surcharge waiver', 'Golf benefits', 'Milestone rewards'],
      isPublic: true,
      status: 'active'
    },
    {
      partnerId: 'platform-partner-001',
      category: 'banking',
      subcategory: 'credit-cards',
      name: 'HDFC Regalia Gold Credit Card',
      provider: 'HDFC Bank',
      description: 'Lifestyle credit card with cashback and rewards',
      annualFee: 2500,
      rewards: '4 reward points per ₹150 spent',
      riskLevel: 'low',
      features: ['Welcome benefits', 'Airport lounge', 'Dining privileges', 'SmartBuy offers'],
      isPublic: true,
      status: 'active'
    }
  ];

  let created = 0;
  for (const product of products) {
    try {
      await storage.createProduct(product as any);
      created++;
    } catch (error) {
      console.error(`Failed to create product ${product.name}:`, error);
    }
  }

  console.log(`✅ Successfully seeded ${created} products`);
  return created;
}
