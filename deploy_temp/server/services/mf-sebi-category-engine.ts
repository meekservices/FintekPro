import { db } from '../db';
import {
  mfCategoryRules,
  mutualFunds,
  mfEnrichmentAuditLogs,
  mfTaxonomyVersions,
  mfCategoryMaster,
  mfSubcategoryMaster,
  mfCategorizationAuditLog,
} from '@shared/schema';
import { eq, and, sql, isNull, or } from 'drizzle-orm';

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

// ── SEBI 2017 Rules (original circular) ──────────────────────────────────────
const SEBI_2017_RULES: CategoryRule[] = [
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

// ── SEBI 2026 Taxonomy Data ───────────────────────────────────────────────────
const SEBI_2026_CIRCULAR_REF = 'SEBI/HO/IMD/CIR/P/2026/26';
const SEBI_2026_EFFECTIVE_DATE = '2026-02-26';

interface SubcategoryDef {
  groupCode: string;
  subcategoryCode: string;
  subcategoryName: string;
  minEquityPct?: number;
  maxEquityPct?: number;
  minDebtPct?: number;
  maxDebtPct?: number;
  maxStocks?: number;
  lockInDays?: number;
  overlapThresholdPct?: number;
  notes?: string;
}

const SEBI_2026_CATEGORIES = [
  { groupCode: 'EQUITY', groupName: 'Equity Schemes', description: 'Schemes predominantly investing in equity and equity-related instruments' },
  { groupCode: 'DEBT', groupName: 'Debt Schemes', description: 'Schemes predominantly investing in debt instruments' },
  { groupCode: 'HYBRID', groupName: 'Hybrid Schemes', description: 'Schemes investing in both equity and debt instruments' },
  { groupCode: 'LIFECYCLE', groupName: 'Life Cycle Schemes', description: 'Target-date schemes with a glide path reducing equity allocation towards maturity — new in SEBI 2026 circular' },
  { groupCode: 'OTHER', groupName: 'Other Schemes', description: 'Index funds, ETFs, Fund of Funds and passive schemes' },
];

const SEBI_2026_SUBCATEGORIES: SubcategoryDef[] = [
  // EQUITY — 11 subcategories
  { groupCode: 'EQUITY', subcategoryCode: 'EQ_LARGE_CAP', subcategoryName: 'Large Cap Fund', minEquityPct: 80, notes: 'Min 80% in top 100 large cap stocks by market cap' },
  { groupCode: 'EQUITY', subcategoryCode: 'EQ_LARGE_MID', subcategoryName: 'Large & Mid Cap Fund', minEquityPct: 70, notes: 'Min 35% in large cap + min 35% in mid cap' },
  { groupCode: 'EQUITY', subcategoryCode: 'EQ_MID_CAP', subcategoryName: 'Mid Cap Fund', minEquityPct: 65, notes: 'Min 65% in mid cap stocks (101st-250th by market cap)' },
  { groupCode: 'EQUITY', subcategoryCode: 'EQ_SMALL_CAP', subcategoryName: 'Small Cap Fund', minEquityPct: 65, notes: 'Min 65% in small cap stocks (251st onwards)' },
  { groupCode: 'EQUITY', subcategoryCode: 'EQ_MULTI_CAP', subcategoryName: 'Multi Cap Fund', minEquityPct: 75, notes: 'Min 25% each in large, mid, small cap' },
  { groupCode: 'EQUITY', subcategoryCode: 'EQ_FLEXI_CAP', subcategoryName: 'Flexi Cap Fund', minEquityPct: 65, notes: 'Flexible allocation across market caps, min 65% equity' },
  { groupCode: 'EQUITY', subcategoryCode: 'EQ_FOCUSED', subcategoryName: 'Focused Fund', minEquityPct: 65, maxStocks: 30, notes: 'Max 30 stocks, min 65% equity' },
  { groupCode: 'EQUITY', subcategoryCode: 'EQ_VALUE_CONTRA', subcategoryName: 'Value/Contra Fund', minEquityPct: 65, notes: 'Value or contrarian investment strategy' },
  { groupCode: 'EQUITY', subcategoryCode: 'EQ_ELSS', subcategoryName: 'ELSS (Tax Saving)', minEquityPct: 80, lockInDays: 1095, notes: 'Min 80% equity, 3-year lock-in, Section 80C benefit' },
  { groupCode: 'EQUITY', subcategoryCode: 'EQ_DIVIDEND_YIELD', subcategoryName: 'Dividend Yield Fund', minEquityPct: 65, notes: 'Min 65% in dividend yielding stocks' },
  { groupCode: 'EQUITY', subcategoryCode: 'EQ_SECTORAL_THEMATIC', subcategoryName: 'Sectoral/Thematic Fund', minEquityPct: 80, overlapThresholdPct: 50, notes: 'Min 80% in a specific sector/theme. Strict overlap rule: >50% = breach' },
  // DEBT — 16 subcategories
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_OVERNIGHT', subcategoryName: 'Overnight Fund', notes: 'Maturity of 1 day' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_LIQUID', subcategoryName: 'Liquid Fund', notes: 'Macaulay duration ≤ 91 days' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_ULTRA_SHORT', subcategoryName: 'Ultra Short Duration Fund', notes: 'Macaulay duration 3-6 months' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_LOW_DURATION', subcategoryName: 'Low Duration Fund', notes: 'Macaulay duration 6-12 months' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_MONEY_MARKET', subcategoryName: 'Money Market Fund', notes: 'Maturity ≤ 1 year' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_SHORT_DURATION', subcategoryName: 'Short Duration Fund', notes: 'Macaulay duration 1-3 years' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_MEDIUM_DURATION', subcategoryName: 'Medium Duration Fund', notes: 'Macaulay duration 3-4 years' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_MEDIUM_LONG', subcategoryName: 'Medium to Long Duration Fund', notes: 'Macaulay duration 4-7 years' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_LONG_DURATION', subcategoryName: 'Long Duration Fund', notes: 'Macaulay duration > 7 years' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_DYNAMIC_BOND', subcategoryName: 'Dynamic Bond Fund', notes: 'Dynamic duration management' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_CORPORATE_BOND', subcategoryName: 'Corporate Bond Fund', minDebtPct: 80, notes: 'Min 80% in AA+ and above rated corporate bonds' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_CREDIT_RISK', subcategoryName: 'Credit Risk Fund', minDebtPct: 65, notes: 'Min 65% in AA and below rated corporate bonds' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_BANKING_PSU', subcategoryName: 'Banking and PSU Fund', minDebtPct: 80, notes: 'Min 80% in debt of banks, PSUs, PFIs' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_GILT', subcategoryName: 'Gilt Fund', minDebtPct: 80, notes: 'Min 80% in government securities' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_GILT_10Y_CONSTANT', subcategoryName: 'Gilt Fund with 10 Year Constant Duration', minDebtPct: 80, notes: 'G-Secs with Macaulay duration = 10 years' },
  { groupCode: 'DEBT', subcategoryCode: 'DEBT_FLOATER', subcategoryName: 'Floater Fund', minDebtPct: 65, notes: 'Min 65% in floating rate instruments' },
  // HYBRID — 6 subcategories
  { groupCode: 'HYBRID', subcategoryCode: 'HY_CONSERVATIVE', subcategoryName: 'Conservative Hybrid Fund', minEquityPct: 10, maxEquityPct: 25, minDebtPct: 75, maxDebtPct: 90 },
  { groupCode: 'HYBRID', subcategoryCode: 'HY_AGGRESSIVE', subcategoryName: 'Aggressive Hybrid Fund', minEquityPct: 65, maxEquityPct: 80, minDebtPct: 20, maxDebtPct: 35 },
  { groupCode: 'HYBRID', subcategoryCode: 'HY_BALANCED_ADVANTAGE', subcategoryName: 'Balanced Advantage Fund', minEquityPct: 0, maxEquityPct: 100, notes: 'Dynamic equity allocation 0-100%' },
  { groupCode: 'HYBRID', subcategoryCode: 'HY_MULTI_ASSET', subcategoryName: 'Multi Asset Allocation Fund', notes: 'Min 3 asset classes, each min 10%' },
  { groupCode: 'HYBRID', subcategoryCode: 'HY_ARBITRAGE', subcategoryName: 'Arbitrage Fund', minEquityPct: 65, notes: 'Min 65% in equity with arbitrage strategy' },
  { groupCode: 'HYBRID', subcategoryCode: 'HY_EQUITY_SAVINGS', subcategoryName: 'Equity Savings Fund', minEquityPct: 65, minDebtPct: 10, notes: 'Min 65% equity (hedged+unhedged), min 10% debt' },
  // LIFECYCLE — NEW in SEBI 2026 circular
  { groupCode: 'LIFECYCLE', subcategoryCode: 'LC_LIFECYCLE_FUND', subcategoryName: 'Life Cycle Fund', minEquityPct: 20, maxEquityPct: 80, notes: 'Equity starts high (~80%) and glides to low (~20%) by maturity. Maturity year must appear in scheme name. Glide path monotonically decreasing equity required.' },
  // OTHER — 4 subcategories
  { groupCode: 'OTHER', subcategoryCode: 'OTH_INDEX', subcategoryName: 'Index Fund', minEquityPct: 95, notes: 'Min 95% in index securities' },
  { groupCode: 'OTHER', subcategoryCode: 'OTH_ETF', subcategoryName: 'Exchange Traded Fund (ETF)', minEquityPct: 95, notes: 'Listed on exchange, tracks an index' },
  { groupCode: 'OTHER', subcategoryCode: 'OTH_FOF_DOMESTIC', subcategoryName: 'Fund of Funds (Domestic)', notes: 'Min 95% in domestic MF schemes' },
  { groupCode: 'OTHER', subcategoryCode: 'OTH_FOF_OVERSEAS', subcategoryName: 'Fund of Funds (Overseas)', notes: 'Min 95% in overseas funds' },
];

class SEBICategoryEngine {
  private static instance: SEBICategoryEngine;

  static getInstance(): SEBICategoryEngine {
    if (!this.instance) {
      this.instance = new SEBICategoryEngine();
    }
    return this.instance;
  }

  // ── Legacy 2017 rule seeding (existing mf_category_rules table) ──────────
  async seedCategoryRules(): Promise<{ seeded: number; skipped: number; errors: string[] }> {
    let seeded = 0, skipped = 0;
    const errors: string[] = [];

    for (const rule of SEBI_2017_RULES) {
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

    console.log(`[SEBICategoryEngine] Seeded ${seeded} 2017 rules, ${skipped} skipped, ${errors.length} errors`);
    return { seeded, skipped, errors };
  }

  // ── SEBI 2026 taxonomy seeding — idempotent ───────────────────────────────
  async seedSEBI2026Taxonomy(): Promise<{ versionsSeeded: number; categoriesSeeded: number; subcategoriesSeeded: number }> {
    let versionsSeeded = 0, categoriesSeeded = 0, subcategoriesSeeded = 0;

    // 1. Taxonomy version
    try {
      await db.execute(sql`
        INSERT INTO mf_taxonomy_versions (version, sebi_circular_ref, effective_date, description, is_active)
        VALUES ('SEBI_2026', ${SEBI_2026_CIRCULAR_REF}, ${SEBI_2026_EFFECTIVE_DATE},
          'SEBI Circular on Categorisation and Rationalisation of Mutual Fund Schemes (Feb 26, 2026)', true)
        ON CONFLICT (version) DO UPDATE SET
          sebi_circular_ref = EXCLUDED.sebi_circular_ref,
          is_active = true
      `);
      versionsSeeded++;

      // Also ensure SEBI_2017 exists
      await db.execute(sql`
        INSERT INTO mf_taxonomy_versions (version, sebi_circular_ref, effective_date, description, is_active)
        VALUES ('SEBI_2017', 'SEBI/HO/IMD/DF3/CIR/P/2017/114', '2017-10-06',
          'SEBI Circular on Categorisation and Rationalisation of Mutual Fund Schemes (Oct 6, 2017)', true)
        ON CONFLICT (version) DO NOTHING
      `);
    } catch (e: any) {
      console.error('[SEBICategoryEngine] Version seed error:', e.message);
    }

    // 2. Category groups
    for (const cat of SEBI_2026_CATEGORIES) {
      try {
        await db.execute(sql`
          INSERT INTO mf_category_master (taxonomy_version, group_code, group_name, description, is_active)
          VALUES ('SEBI_2026', ${cat.groupCode}, ${cat.groupName}, ${cat.description}, true)
          ON CONFLICT (taxonomy_version, group_code) DO UPDATE SET
            group_name = EXCLUDED.group_name,
            description = EXCLUDED.description,
            is_active = true
        `);
        categoriesSeeded++;
      } catch (e: any) {
        console.error(`[SEBICategoryEngine] Category seed error ${cat.groupCode}:`, e.message);
      }
    }

    // 3. Subcategories
    for (const sub of SEBI_2026_SUBCATEGORIES) {
      try {
        await db.execute(sql`
          INSERT INTO mf_subcategory_master (
            taxonomy_version, group_code, subcategory_code, subcategory_name,
            min_equity_pct, max_equity_pct, min_debt_pct, max_debt_pct,
            max_stocks, lock_in_days, overlap_threshold_pct, notes, is_active
          ) VALUES (
            'SEBI_2026', ${sub.groupCode}, ${sub.subcategoryCode}, ${sub.subcategoryName},
            ${sub.minEquityPct ?? null}, ${sub.maxEquityPct ?? null},
            ${sub.minDebtPct ?? null}, ${sub.maxDebtPct ?? null},
            ${sub.maxStocks ?? null}, ${sub.lockInDays ?? null},
            ${sub.overlapThresholdPct ?? 60}, ${sub.notes ?? null}, true
          )
          ON CONFLICT (subcategory_code) DO UPDATE SET
            subcategory_name = EXCLUDED.subcategory_name,
            notes = EXCLUDED.notes,
            is_active = true
        `);
        subcategoriesSeeded++;
      } catch (e: any) {
        console.error(`[SEBICategoryEngine] Subcategory seed error ${sub.subcategoryCode}:`, e.message);
      }
    }

    console.log(`[SEBICategoryEngine] SEBI 2026 taxonomy seeded: ${versionsSeeded} versions, ${categoriesSeeded} categories, ${subcategoriesSeeded} subcategories`);
    return { versionsSeeded, categoriesSeeded, subcategoriesSeeded };
  }

  // ── Lifecycle detection ───────────────────────────────────────────────────
  isLifecycleFund(fund: { lifecycleMetadata?: any; category?: string | null; schemeSubCategory?: string | null }): boolean {
    if (fund.lifecycleMetadata && typeof fund.lifecycleMetadata === 'object') return true;
    const cat = (fund.category || '').toLowerCase();
    const sub = (fund.schemeSubCategory || '').toLowerCase();
    return cat.includes('lifecycle') || cat.includes('life cycle') ||
           sub.includes('lifecycle') || sub.includes('life cycle') ||
           sub.includes('target date') || sub.includes('target maturity');
  }

  // ── Categorization audit log ──────────────────────────────────────────────
  async logCategorizationChange(
    schemeCode: string,
    oldCategory: string | null,
    newCategory: string,
    oldSubcategory: string | null,
    newSubcategory: string,
    triggeredBy: string,
    taxonomyVersion = 'SEBI_2026'
  ): Promise<void> {
    try {
      await db.insert(mfCategorizationAuditLog).values({
        schemeCode,
        oldCategory: oldCategory || null,
        newCategory,
        oldSubcategory: oldSubcategory || null,
        newSubcategory,
        triggeredBy,
        taxonomyVersion,
      });
    } catch (e: any) {
      console.error(`[SEBICategoryEngine] Audit log error for ${schemeCode}:`, e.message);
    }
  }

  // ── Scheme category validation ────────────────────────────────────────────
  async validateSchemeCategory(schemeCode: string): Promise<{
    valid: boolean;
    scheme: any;
    rule: any | null;
    issues: string[];
    isLifecycle: boolean;
  }> {
    const [fund] = await db.select({
      schemeCode: mutualFunds.schemeCode,
      schemeName: mutualFunds.schemeName,
      category: mutualFunds.category,
      schemeSubCategory: mutualFunds.schemeSubCategory,
      schemeStatus: mutualFunds.schemeStatus,
      lifecycleMetadata: mutualFunds.lifecycleMetadata,
      complianceStatus: mutualFunds.complianceStatus,
      taxonomyVersion: mutualFunds.taxonomyVersion,
    }).from(mutualFunds).where(eq(mutualFunds.schemeCode, schemeCode)).limit(1);

    if (!fund) return { valid: false, scheme: null, rule: null, issues: ['Scheme not found'], isLifecycle: false };

    const issues: string[] = [];
    const isLifecycle = this.isLifecycleFund(fund);

    if (!fund.category) issues.push('Missing category');
    if (!fund.schemeSubCategory) issues.push('Missing sub-category');

    // If lifecycle and not yet tagged
    if (isLifecycle && fund.category !== 'Lifecycle') {
      issues.push('Lifecycle fund must be classified under Lifecycle category (SEBI 2026)');
    }

    let rule = null;
    if (fund.category && fund.schemeSubCategory) {
      rule = await this.getRuleForCategory(fund.category, fund.schemeSubCategory);
      if (!rule) {
        issues.push(`No SEBI rule found for category: ${fund.category}/${fund.schemeSubCategory}`);
      }
    }

    // Mark as REQUIRES_REVIEW if fails deterministic mapping
    if (issues.length > 0 && fund.complianceStatus === 'PENDING') {
      try {
        await db.execute(sql`
          UPDATE mutual_funds SET compliance_status = 'REQUIRES_REVIEW'
          WHERE scheme_code = ${schemeCode} AND compliance_status = 'PENDING'
        `);
      } catch (statusErr: any) {
        console.warn('[SEBICategoryEngine] Failed to update compliance status:', statusErr?.message);
      }
    }

    return { valid: issues.length === 0, scheme: fund, rule, issues, isLifecycle };
  }

  async validateAllSchemes(limit = 1000): Promise<{
    total: number;
    valid: number;
    invalid: number;
    lifecycle: number;
    issues: Array<{ schemeCode: string; schemeName: string; issues: string[] }>;
  }> {
    const funds = await db.select({
      schemeCode: mutualFunds.schemeCode,
      schemeName: mutualFunds.schemeName,
      category: mutualFunds.category,
      schemeSubCategory: mutualFunds.schemeSubCategory,
      lifecycleMetadata: mutualFunds.lifecycleMetadata,
    }).from(mutualFunds).where(
      sql`${mutualFunds.category} IS NULL OR ${mutualFunds.schemeSubCategory} IS NULL`
    ).limit(limit);

    const issues: Array<{ schemeCode: string; schemeName: string; issues: string[] }> = [];
    let lifecycleCount = 0;

    for (const fund of funds) {
      const fundIssues: string[] = [];
      if (!fund.category) fundIssues.push('Missing SEBI category');
      if (!fund.schemeSubCategory) fundIssues.push('Missing SEBI sub-category');
      if (this.isLifecycleFund(fund)) {
        lifecycleCount++;
        if (fund.category !== 'Lifecycle') fundIssues.push('Lifecycle fund not classified under Lifecycle category');
      }
      if (fundIssues.length > 0) {
        issues.push({ schemeCode: fund.schemeCode, schemeName: fund.schemeName || '', issues: fundIssues });
      }
    }

    return {
      total: funds.length,
      valid: funds.length - issues.length,
      invalid: issues.length,
      lifecycle: lifecycleCount,
      issues: issues.slice(0, 100),
    };
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

  async getTaxonomy2026(): Promise<{ version: any; categories: any[]; subcategories: any[] }> {
    const [version] = await db.execute(sql`
      SELECT * FROM mf_taxonomy_versions WHERE version = 'SEBI_2026' LIMIT 1
    `).then(r => (r as any).rows || []);

    const categories = await db.execute(sql`
      SELECT * FROM mf_category_master WHERE taxonomy_version = 'SEBI_2026' ORDER BY group_code
    `).then(r => (r as any).rows || []);

    const subcategories = await db.execute(sql`
      SELECT * FROM mf_subcategory_master WHERE taxonomy_version = 'SEBI_2026' ORDER BY group_code, subcategory_code
    `).then(r => (r as any).rows || []);

    return { version, categories, subcategories };
  }
}

export const sebiCategoryEngine = SEBICategoryEngine.getInstance();
export default sebiCategoryEngine;
