import { db } from '../db';
import { mfCategoryRules, mutualFunds, mfEnrichmentAuditLogs } from '@shared/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';

interface CategoryRule {
  category: string;
  subCategory: string;
  sebiCircularRef: string;
  effectiveDate: string;
  rules: {
    description: string;
    minEquityPercent?: number;
    maxEquityPercent?: number;
    minDebtPercent?: number;
    maxDebtPercent?: number;
    maxStockPercent?: number;
    minMarketCapPercent?: number;
    lockInPeriod?: number;
    minStocks?: number;
    maxStocks?: number;
    notes?: string;
  };
}

const SEBI_CATEGORY_RULES: CategoryRule[] = [
  { category: 'Equity', subCategory: 'Large Cap', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 80% in large cap stocks (top 100 by market cap)', minEquityPercent: 80, notes: 'Large cap = 1st-100th company by full market cap' } },
  { category: 'Equity', subCategory: 'Large & Mid Cap', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 35% in large cap, min 35% in mid cap', minEquityPercent: 70, notes: 'Large cap >= 35%, Mid cap >= 35%' } },
  { category: 'Equity', subCategory: 'Mid Cap', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 65% in mid cap stocks (101st-250th by market cap)', minEquityPercent: 65, notes: 'Mid cap = 101st-250th company' } },
  { category: 'Equity', subCategory: 'Small Cap', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 65% in small cap stocks (251st onwards by market cap)', minEquityPercent: 65, notes: 'Small cap = 251st onwards' } },
  { category: 'Equity', subCategory: 'Multi Cap', sebiCircularRef: 'SEBI/HO/IMD/DF2/CIR/P/2020/174', effectiveDate: '2020-09-11',
    rules: { description: 'Min 75% equity: min 25% each in large, mid, small cap', minEquityPercent: 75, notes: 'Min 25% in each cap segment' } },
  { category: 'Equity', subCategory: 'Flexi Cap', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2020/228', effectiveDate: '2020-11-06',
    rules: { description: 'Min 65% in equity, flexible across market caps', minEquityPercent: 65 } },
  { category: 'Equity', subCategory: 'Focused', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 65% equity, max 30 stocks', minEquityPercent: 65, maxStocks: 30 } },
  { category: 'Equity', subCategory: 'Value/Contra', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 65% equity following value/contrarian strategy', minEquityPercent: 65 } },
  { category: 'Equity', subCategory: 'ELSS', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 80% equity, 3-year lock-in for tax benefits', minEquityPercent: 80, lockInPeriod: 1095 } },
  { category: 'Equity', subCategory: 'Dividend Yield', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 65% in dividend yielding stocks', minEquityPercent: 65 } },
  { category: 'Equity', subCategory: 'Sectoral/Thematic', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 80% in stocks of a particular sector/theme', minEquityPercent: 80 } },
  { category: 'Debt', subCategory: 'Overnight', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Investment in overnight securities with maturity of 1 day', notes: 'Maturity = 1 day' } },
  { category: 'Debt', subCategory: 'Liquid', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Investment in debt/money market securities with maturity up to 91 days', notes: 'Macaulay duration ≤ 91 days' } },
  { category: 'Debt', subCategory: 'Ultra Short Duration', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Macaulay duration 3-6 months', notes: 'Macaulay duration 3-6 months' } },
  { category: 'Debt', subCategory: 'Low Duration', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Macaulay duration 6-12 months', notes: 'Macaulay duration 6-12 months' } },
  { category: 'Debt', subCategory: 'Money Market', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Investment in money market instruments with maturity up to 1 year', notes: 'Maturity ≤ 1 year' } },
  { category: 'Debt', subCategory: 'Short Duration', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Macaulay duration 1-3 years', notes: 'Macaulay duration 1-3 years' } },
  { category: 'Debt', subCategory: 'Medium Duration', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Macaulay duration 3-4 years', notes: 'Macaulay duration 3-4 years' } },
  { category: 'Debt', subCategory: 'Medium to Long Duration', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Macaulay duration 4-7 years', notes: 'Macaulay duration 4-7 years' } },
  { category: 'Debt', subCategory: 'Long Duration', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Macaulay duration > 7 years', notes: 'Macaulay duration > 7 years' } },
  { category: 'Debt', subCategory: 'Dynamic Bond', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Investment across duration, dynamic management', notes: 'Dynamic duration management' } },
  { category: 'Debt', subCategory: 'Corporate Bond', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 80% in AA+ and above rated corporate bonds', minDebtPercent: 80, notes: 'AA+ and above' } },
  { category: 'Debt', subCategory: 'Credit Risk', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 65% in AA and below rated corporate bonds', minDebtPercent: 65, notes: 'AA and below rated' } },
  { category: 'Debt', subCategory: 'Banking & PSU', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 80% in banks, PSUs, PFIs', minDebtPercent: 80 } },
  { category: 'Debt', subCategory: 'Gilt', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 80% in G-Secs across duration', minDebtPercent: 80 } },
  { category: 'Debt', subCategory: 'Floater', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 65% in floating rate instruments', minDebtPercent: 65 } },
  { category: 'Hybrid', subCategory: 'Conservative Hybrid', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Equity 10-25%, Debt 75-90%', minEquityPercent: 10, maxEquityPercent: 25, minDebtPercent: 75, maxDebtPercent: 90 } },
  { category: 'Hybrid', subCategory: 'Aggressive Hybrid', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Equity 65-80%, Debt 20-35%', minEquityPercent: 65, maxEquityPercent: 80, minDebtPercent: 20, maxDebtPercent: 35 } },
  { category: 'Hybrid', subCategory: 'Balanced Advantage', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Dynamic equity allocation 0-100%', minEquityPercent: 0, maxEquityPercent: 100 } },
  { category: 'Hybrid', subCategory: 'Multi Asset Allocation', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 3 asset classes, each min 10%', notes: 'Min 10% in each of at least 3 asset classes' } },
  { category: 'Hybrid', subCategory: 'Arbitrage', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 65% in equity with arbitrage strategy', minEquityPercent: 65 } },
  { category: 'Hybrid', subCategory: 'Equity Savings', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Equity min 65% (hedged + unhedged), debt min 10%', minEquityPercent: 65, minDebtPercent: 10 } },
  { category: 'Solution Oriented', subCategory: 'Retirement', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Retirement benefit with 5-year lock-in or till retirement', lockInPeriod: 1825 } },
  { category: 'Solution Oriented', subCategory: 'Children', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'For children fund with 5-year lock-in or till child turns 18', lockInPeriod: 1825 } },
  { category: 'Other', subCategory: 'Index Funds', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 95% in securities of index being replicated', minEquityPercent: 95 } },
  { category: 'Other', subCategory: 'Fund of Funds', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Min 95% in underlying funds', notes: 'Min 95% invested in underlying MF schemes' } },
  { category: 'Other', subCategory: 'ETF', sebiCircularRef: 'SEBI/HO/IMD/DF3/CIR/P/2017/114', effectiveDate: '2017-10-06',
    rules: { description: 'Exchange traded fund tracking an index', minEquityPercent: 95, notes: 'Tracking error to be monitored' } },
];

class SEBICategoryEngine {
  private static instance: SEBICategoryEngine;

  static getInstance(): SEBICategoryEngine {
    if (!this.instance) {
      this.instance = new SEBICategoryEngine();
    }
    return this.instance;
  }

  async seedCategoryRules(): Promise<{ seeded: number; skipped: number; errors: string[] }> {
    let seeded = 0, skipped = 0;
    const errors: string[] = [];

    for (const rule of SEBI_CATEGORY_RULES) {
      try {
        await db.insert(mfCategoryRules).values({
          category: rule.category,
          subCategory: rule.subCategory,
          sebiCircularRef: rule.sebiCircularRef,
          effectiveDate: rule.effectiveDate,
          rules: rule.rules,
          isActive: true,
          version: 1,
        }).onConflictDoNothing();
        seeded++;
      } catch (error: any) {
        if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
          skipped++;
        } else {
          errors.push(`${rule.category}/${rule.subCategory}: ${error.message}`);
        }
      }
    }

    console.log(`[SEBICategoryEngine] Seeded ${seeded} rules, ${skipped} skipped, ${errors.length} errors`);
    return { seeded, skipped, errors };
  }

  async getAllRules(): Promise<any[]> {
    return db.select().from(mfCategoryRules).where(eq(mfCategoryRules.isActive, true));
  }

  async getRuleForCategory(category: string, subCategory: string): Promise<any | null> {
    const [rule] = await db.select().from(mfCategoryRules).where(
      and(
        eq(mfCategoryRules.category, category),
        eq(mfCategoryRules.subCategory, subCategory),
        eq(mfCategoryRules.isActive, true)
      )
    ).limit(1);
    return rule || null;
  }

  async validateSchemeCategory(schemeCode: string): Promise<{
    valid: boolean;
    scheme: any;
    rule: any | null;
    issues: string[];
  }> {
    const [fund] = await db.select({
      schemeCode: mutualFunds.schemeCode,
      schemeName: mutualFunds.schemeName,
      category: mutualFunds.category,
      schemeSubCategory: mutualFunds.schemeSubCategory,
      schemeStatus: mutualFunds.schemeStatus,
    }).from(mutualFunds).where(eq(mutualFunds.schemeCode, schemeCode)).limit(1);

    if (!fund) return { valid: false, scheme: null, rule: null, issues: ['Scheme not found'] };

    const issues: string[] = [];

    if (!fund.category) issues.push('Missing category');
    if (!fund.schemeSubCategory) issues.push('Missing sub-category');

    let rule = null;
    if (fund.category && fund.schemeSubCategory) {
      rule = await this.getRuleForCategory(fund.category, fund.schemeSubCategory);
      if (!rule) {
        const altRule = await this.getRuleForCategory(fund.category, fund.category);
        if (!altRule) {
          issues.push(`No SEBI rule found for category: ${fund.category}/${fund.schemeSubCategory}`);
        } else {
          rule = altRule;
        }
      }
    }

    return { valid: issues.length === 0, scheme: fund, rule, issues };
  }

  async validateAllSchemes(limit = 1000): Promise<{
    total: number;
    valid: number;
    invalid: number;
    issues: Array<{ schemeCode: string; schemeName: string; issues: string[] }>;
  }> {
    const funds = await db.select({
      schemeCode: mutualFunds.schemeCode,
      schemeName: mutualFunds.schemeName,
      category: mutualFunds.category,
      schemeSubCategory: mutualFunds.schemeSubCategory,
    }).from(mutualFunds).where(
      sql`${mutualFunds.category} IS NULL OR ${mutualFunds.schemeSubCategory} IS NULL`
    ).limit(limit);

    const issues: Array<{ schemeCode: string; schemeName: string; issues: string[] }> = [];

    for (const fund of funds) {
      const fundIssues: string[] = [];
      if (!fund.category) fundIssues.push('Missing SEBI category');
      if (!fund.schemeSubCategory) fundIssues.push('Missing SEBI sub-category');
      if (fundIssues.length > 0) {
        issues.push({ schemeCode: fund.schemeCode, schemeName: fund.schemeName || '', issues: fundIssues });
      }
    }

    return {
      total: funds.length,
      valid: funds.length - issues.length,
      invalid: issues.length,
      issues: issues.slice(0, 100),
    };
  }

  async getCategoryStats(): Promise<Record<string, { count: number; withSubCategory: number }>> {
    const results = await db.select({
      category: mutualFunds.category,
      total: sql<number>`COUNT(*)`,
      withSubCat: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.schemeSubCategory} IS NOT NULL)`,
    }).from(mutualFunds).groupBy(mutualFunds.category);

    const stats: Record<string, { count: number; withSubCategory: number }> = {};
    for (const row of results) {
      stats[row.category || 'Uncategorized'] = {
        count: Number(row.total),
        withSubCategory: Number(row.withSubCat),
      };
    }
    return stats;
  }
}

export const sebiCategoryEngine = SEBICategoryEngine.getInstance();
export default sebiCategoryEngine;
