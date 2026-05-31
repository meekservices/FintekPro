// @ts-nocheck
import { db } from '../db';
import { goalBenchmarkMapping, InsertGoalBenchmarkMapping } from '@shared/schema';
import { eq, and, gte, lte, or } from 'drizzle-orm';

export type GoalType = 
  | 'retirement'
  | 'wealth_creation'
  | 'income_generation'
  | 'capital_preservation'
  | 'education'
  | 'home_purchase'
  | 'emergency_fund'
  | 'travel'
  | 'wedding'
  | 'tax_saving'
  | 'child_education'
  | 'regular_income';

export type RiskProfile = 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';

export interface BenchmarkSelection {
  benchmarkCode: string;
  benchmarkName: string;
  rationale: string;
  isDefault: boolean;
  overriddenBy?: string;
}

const DEFAULT_BENCHMARKS: InsertGoalBenchmarkMapping[] = [
  // Retirement - Long term horizons
  { goalType: 'retirement', riskProfile: 'conservative', horizonYearsMin: 10, horizonYearsMax: 99, benchmarkCode: 'NIFTY50', benchmarkName: 'NIFTY 50 TRI', benchmarkRationale: 'Large cap stability for long-term retirement goals', isDefault: true },
  { goalType: 'retirement', riskProfile: 'moderate', horizonYearsMin: 10, horizonYearsMax: 99, benchmarkCode: 'NIFTY500', benchmarkName: 'NIFTY 500 TRI', benchmarkRationale: 'Broad market exposure for moderate risk retirement planning', isDefault: true },
  { goalType: 'retirement', riskProfile: 'aggressive', horizonYearsMin: 10, horizonYearsMax: 99, benchmarkCode: 'NIFTYMIDCAP150', benchmarkName: 'NIFTY Midcap 150 TRI', benchmarkRationale: 'Higher growth potential for aggressive retirement portfolios', isDefault: true },

  // Wealth Creation
  { goalType: 'wealth_creation', riskProfile: 'conservative', horizonYearsMin: 5, horizonYearsMax: 99, benchmarkCode: 'NIFTYLARGECAP', benchmarkName: 'NIFTY Large Cap 100 TRI', benchmarkRationale: 'Blue chip focus for conservative wealth building', isDefault: true },
  { goalType: 'wealth_creation', riskProfile: 'moderate', horizonYearsMin: 5, horizonYearsMax: 99, benchmarkCode: 'NIFTY50', benchmarkName: 'NIFTY 50 TRI', benchmarkRationale: 'Market benchmark for balanced wealth creation', isDefault: true },
  { goalType: 'wealth_creation', riskProfile: 'aggressive', horizonYearsMin: 5, horizonYearsMax: 99, benchmarkCode: 'NIFTYSMALLCAP250', benchmarkName: 'NIFTY Smallcap 250 TRI', benchmarkRationale: 'High growth small cap exposure for aggressive wealth building', isDefault: true },

  // Income Generation
  { goalType: 'income_generation', riskProfile: 'conservative', horizonYearsMin: 1, horizonYearsMax: 99, benchmarkCode: 'CRISIL_COMPOSITE', benchmarkName: 'CRISIL Composite Bond Index', benchmarkRationale: 'Fixed income benchmark for regular income generation', isDefault: true },
  { goalType: 'income_generation', riskProfile: 'moderate', horizonYearsMin: 1, horizonYearsMax: 99, benchmarkCode: 'NIFTY_DIV_OPP', benchmarkName: 'NIFTY Dividend Opportunities 50 TRI', benchmarkRationale: 'Dividend-focused equity for moderate income needs', isDefault: true },

  // Capital Preservation
  { goalType: 'capital_preservation', riskProfile: 'conservative', horizonYearsMin: 0, horizonYearsMax: 99, benchmarkCode: 'CRISIL_LIQUID', benchmarkName: 'CRISIL Liquid Fund Index', benchmarkRationale: 'Capital safety with minimal volatility', isDefault: true },
  { goalType: 'capital_preservation', riskProfile: 'moderate', horizonYearsMin: 0, horizonYearsMax: 99, benchmarkCode: 'CRISIL_SHORT_TERM', benchmarkName: 'CRISIL Short Term Bond Index', benchmarkRationale: 'Short duration bonds for capital stability', isDefault: true },

  // Education
  { goalType: 'education', riskProfile: 'conservative', horizonYearsMin: 3, horizonYearsMax: 10, benchmarkCode: 'CRISIL_HYBRID', benchmarkName: 'CRISIL Hybrid 35+65 Index', benchmarkRationale: 'Balanced approach for medium-term education goals', isDefault: true },
  { goalType: 'education', riskProfile: 'moderate', horizonYearsMin: 5, horizonYearsMax: 15, benchmarkCode: 'NIFTY50', benchmarkName: 'NIFTY 50 TRI', benchmarkRationale: 'Growth-focused for longer education planning', isDefault: true },
  { goalType: 'education', riskProfile: 'aggressive', horizonYearsMin: 10, horizonYearsMax: 20, benchmarkCode: 'NIFTYMIDCAP150', benchmarkName: 'NIFTY Midcap 150 TRI', benchmarkRationale: 'Higher growth for very long-term education funding', isDefault: true },

  // Home Purchase
  { goalType: 'home_purchase', riskProfile: 'conservative', horizonYearsMin: 2, horizonYearsMax: 5, benchmarkCode: 'CRISIL_SHORT_TERM', benchmarkName: 'CRISIL Short Term Bond Index', benchmarkRationale: 'Capital protection for near-term home purchase', isDefault: true },
  { goalType: 'home_purchase', riskProfile: 'moderate', horizonYearsMin: 5, horizonYearsMax: 10, benchmarkCode: 'NIFTYLARGECAP', benchmarkName: 'NIFTY Large Cap 100 TRI', benchmarkRationale: 'Balanced growth for medium-term property goals', isDefault: true },

  // Emergency Fund
  { goalType: 'emergency_fund', riskProfile: 'conservative', horizonYearsMin: 0, horizonYearsMax: 99, benchmarkCode: 'CRISIL_LIQUID', benchmarkName: 'CRISIL Liquid Fund Index', benchmarkRationale: 'Immediate liquidity with capital safety', isDefault: true },
];

export class GoalBenchmarkMapper {
  static async initializeDefaults(): Promise<void> {
    for (const mapping of DEFAULT_BENCHMARKS) {
      const existing = await db
        .select()
        .from(goalBenchmarkMapping)
        .where(
          and(
            eq(goalBenchmarkMapping.goalType, mapping.goalType),
            eq(goalBenchmarkMapping.riskProfile, mapping.riskProfile),
            eq(goalBenchmarkMapping.horizonYearsMin, mapping.horizonYearsMin)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(goalBenchmarkMapping).values(mapping);
      }
    }
    console.log('✅ Goal Benchmark Mapper defaults initialized');
  }

  static async selectBenchmark(
    goalType: GoalType,
    riskProfile: RiskProfile,
    horizonYears: number
  ): Promise<BenchmarkSelection> {
    const mappings = await db
      .select()
      .from(goalBenchmarkMapping)
      .where(
        and(
          eq(goalBenchmarkMapping.goalType, goalType),
          eq(goalBenchmarkMapping.riskProfile, riskProfile),
          lte(goalBenchmarkMapping.horizonYearsMin, horizonYears)
        )
      );

    const validMappings = mappings.filter(m => {
      const maxYears = m.horizonYearsMax ?? 99;
      return horizonYears <= maxYears;
    });

    const bestMatch = validMappings.sort((a, b) => {
      if (!a.isDefault && b.isDefault) return -1;
      if (a.isDefault && !b.isDefault) return 1;
      return 0;
    })[0];

    if (bestMatch) {
      return {
        benchmarkCode: bestMatch.benchmarkCode,
        benchmarkName: bestMatch.benchmarkName,
        rationale: bestMatch.benchmarkRationale || '',
        isDefault: bestMatch.isDefault ?? true,
        overriddenBy: bestMatch.overriddenBy || undefined
      };
    }

    return this.getFallbackBenchmark(riskProfile);
  }

  private static getFallbackBenchmark(riskProfile: RiskProfile): BenchmarkSelection {
    const fallbacks: Record<RiskProfile, BenchmarkSelection> = {
      conservative: {
        benchmarkCode: 'NIFTY50',
        benchmarkName: 'NIFTY 50 TRI',
        rationale: 'Default large cap benchmark for conservative risk profile',
        isDefault: true
      },
      moderate: {
        benchmarkCode: 'NIFTY500',
        benchmarkName: 'NIFTY 500 TRI',
        rationale: 'Broad market benchmark for moderate risk profile',
        isDefault: true
      },
      aggressive: {
        benchmarkCode: 'NIFTYMIDCAP150',
        benchmarkName: 'NIFTY Midcap 150 TRI',
        rationale: 'Mid-cap benchmark for aggressive risk profile',
        isDefault: true
      },
      very_aggressive: {
        benchmarkCode: 'NIFTYSMALLCAP250',
        benchmarkName: 'NIFTY Smallcap 250 TRI',
        rationale: 'Small-cap benchmark for very aggressive risk profile',
        isDefault: true
      }
    };

    return fallbacks[riskProfile];
  }

  static async overrideBenchmark(
    goalType: GoalType,
    riskProfile: RiskProfile,
    horizonYearsMin: number,
    benchmarkCode: string,
    benchmarkName: string,
    rationale: string,
    overriddenBy: string
  ): Promise<void> {
    const existing = await db
      .select()
      .from(goalBenchmarkMapping)
      .where(
        and(
          eq(goalBenchmarkMapping.goalType, goalType),
          eq(goalBenchmarkMapping.riskProfile, riskProfile),
          eq(goalBenchmarkMapping.horizonYearsMin, horizonYearsMin)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(goalBenchmarkMapping)
        .set({
          benchmarkCode,
          benchmarkName,
          benchmarkRationale: rationale,
          isDefault: false,
          overriddenBy,
          overriddenAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(goalBenchmarkMapping.id, existing[0].id));
    } else {
      await db.insert(goalBenchmarkMapping).values({
        goalType,
        riskProfile,
        horizonYearsMin,
        benchmarkCode,
        benchmarkName,
        benchmarkRationale: rationale,
        isDefault: false,
        overriddenBy,
        overriddenAt: new Date()
      });
    }
  }

  static async getAllMappings(): Promise<any[]> {
    return db.select().from(goalBenchmarkMapping);
  }

  static getBenchmarkExplanation(
    goalType: GoalType,
    riskProfile: RiskProfile,
    horizonYears: number,
    benchmark: BenchmarkSelection
  ): string {
    const goalNames: Record<GoalType, string> = {
      retirement: 'Retirement',
      wealth_creation: 'Wealth Creation',
      income_generation: 'Income Generation',
      capital_preservation: 'Capital Preservation',
      education: 'Education',
      home_purchase: 'Home Purchase',
      emergency_fund: 'Emergency Fund',
      travel: 'Travel',
      wedding: 'Wedding',
      tax_saving: 'Tax Saving',
      child_education: 'Child Education',
      regular_income: 'Regular Income',
    };

    return `For your ${goalNames[goalType]} goal with a ${riskProfile} risk profile and ${horizonYears}-year horizon, we've selected ${benchmark.benchmarkName} as your benchmark. ${benchmark.rationale}`;
  }
}

console.log('✅ Goal Benchmark Mapper initialized');
