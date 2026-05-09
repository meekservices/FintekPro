import { db } from '../db';
import { mfBenchmarkMap, mutualFunds } from '@shared/schema';
import { eq, isNull, and, sql } from 'drizzle-orm';

interface BenchmarkMapping {
  categoryPattern: RegExp;
  indexCode: string;
  confidenceScore: number;
  reason: string;
}

const CATEGORY_BENCHMARK_RULES: BenchmarkMapping[] = [
  { categoryPattern: /large\s*cap/i, indexCode: 'NIFTY50', confidenceScore: 0.85, reason: 'Large Cap → NIFTY 50' },
  { categoryPattern: /large\s*&?\s*mid\s*cap/i, indexCode: 'NIFTY100', confidenceScore: 0.80, reason: 'Large & Mid Cap → NIFTY 100' },
  { categoryPattern: /flexi\s*cap|multi\s*cap|diversified/i, indexCode: 'NIFTY500', confidenceScore: 0.75, reason: 'Flexi/Multi Cap → NIFTY 500' },
  { categoryPattern: /mid\s*cap/i, indexCode: 'NIFTY_MIDCAP_150', confidenceScore: 0.85, reason: 'Mid Cap → NIFTY Midcap 150' },
  { categoryPattern: /small\s*cap/i, indexCode: 'NIFTY_SMALLCAP_250', confidenceScore: 0.85, reason: 'Small Cap → NIFTY Smallcap 250' },
  { categoryPattern: /banking|bank\s*&?\s*financial/i, indexCode: 'NIFTY_BANK', confidenceScore: 0.85, reason: 'Banking Sector → NIFTY Bank' },
  { categoryPattern: /technology|tech|it\s*fund/i, indexCode: 'NIFTY_IT', confidenceScore: 0.85, reason: 'IT Sector → NIFTY IT' },
  { categoryPattern: /pharma|healthcare|health/i, indexCode: 'NIFTY_PHARMA', confidenceScore: 0.80, reason: 'Pharma/Healthcare → NIFTY Pharma' },
  { categoryPattern: /index|passive|etf/i, indexCode: 'NIFTY50', confidenceScore: 0.90, reason: 'Index/Passive → NIFTY 50' },
  { categoryPattern: /focused|concentrated/i, indexCode: 'NIFTY50', confidenceScore: 0.75, reason: 'Focused Fund → NIFTY 50' },
  { categoryPattern: /elss|tax\s*saver/i, indexCode: 'NIFTY500', confidenceScore: 0.75, reason: 'ELSS → NIFTY 500' },
  { categoryPattern: /thematic|sectoral/i, indexCode: 'NIFTY500', confidenceScore: 0.65, reason: 'Thematic/Sectoral → NIFTY 500 (lower confidence)' },
  { categoryPattern: /value|contra|dividend\s*yield/i, indexCode: 'NIFTY500', confidenceScore: 0.70, reason: 'Value/Contra → NIFTY 500' },
];

const DEFAULT_EQUITY_BENCHMARK = { indexCode: 'NIFTY500', confidenceScore: 0.60, reason: 'Default Equity → NIFTY 500' };

class MfBenchmarkMappingService {
  private static instance: MfBenchmarkMappingService;

  static getInstance(): MfBenchmarkMappingService {
    if (!MfBenchmarkMappingService.instance) {
      MfBenchmarkMappingService.instance = new MfBenchmarkMappingService();
    }
    return MfBenchmarkMappingService.instance;
  }

  determineBenchmark(category: string | null, schemeName: string | null): { indexCode: string; confidenceScore: number; reason: string } | null {
    const searchText = `${category || ''} ${schemeName || ''}`.toLowerCase();

    if (/debt|bond|gilt|liquid|money\s*market|overnight|ultra\s*short|short\s*duration|medium\s*duration|long\s*duration|dynamic\s*bond|credit\s*risk|banking\s*&?\s*psu|corporate\s*bond|floater/i.test(searchText)) {
      return null;
    }

    if (/hybrid|balanced|aggressive|conservative|equity\s*savings|arbitrage|multi\s*asset|solution|retirement|children/i.test(searchText)) {
      return null;
    }

    if (/gold|silver|commodity|international|global|overseas|us\s*equity|world|emerging\s*market/i.test(searchText)) {
      return null;
    }

    for (const rule of CATEGORY_BENCHMARK_RULES) {
      if (rule.categoryPattern.test(searchText)) {
        return { indexCode: rule.indexCode, confidenceScore: rule.confidenceScore, reason: rule.reason };
      }
    }

    if (/equity/i.test(searchText)) {
      return DEFAULT_EQUITY_BENCHMARK;
    }

    return null;
  }

  async autoMapUnmappedFunds(limit: number = 1000): Promise<{ mapped: number; skipped: number }> {
    console.log('[MfBenchmarkMapping] Auto-mapping unmapped funds (batch mode)...');

    const existingMappings = await db.select({ mfIsin: mfBenchmarkMap.mfIsin }).from(mfBenchmarkMap);
    const mappedIsins = new Set(existingMappings.map(m => m.mfIsin));
    console.log(`[MfBenchmarkMapping] ${mappedIsins.size} existing mappings loaded`);

    const fundsWithIsin = await db.select({
      isin: mutualFunds.isin,
      schemeCode: mutualFunds.schemeCode,
      category: mutualFunds.category,
      schemeName: mutualFunds.schemeName,
    })
    .from(mutualFunds)
    .where(and(
      sql`${mutualFunds.isin} IS NOT NULL`,
      sql`${mutualFunds.isin} != ''`
    ))
    .limit(limit);

    let mapped = 0;
    let skipped = 0;
    const batchInserts: Array<{
      mfIsin: string;
      mfSchemeCode: string | null;
      indexCode: string;
      confidenceScore: string;
      source: string;
      mappingReason: string;
    }> = [];

    for (const fund of fundsWithIsin) {
      if (!fund.isin) continue;

      if (mappedIsins.has(fund.isin)) {
        skipped++;
        continue;
      }

      const benchmark = this.determineBenchmark(fund.category, fund.schemeName);
      
      if (benchmark) {
        batchInserts.push({
          mfIsin: fund.isin,
          mfSchemeCode: fund.schemeCode,
          indexCode: benchmark.indexCode,
          confidenceScore: benchmark.confidenceScore.toString(),
          source: 'auto',
          mappingReason: benchmark.reason,
        });
        mapped++;
      } else {
        skipped++;
      }
    }

    if (batchInserts.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < batchInserts.length; i += batchSize) {
        const batch = batchInserts.slice(i, i + batchSize);
        try {
          await db.insert(mfBenchmarkMap).values(batch).onConflictDoNothing();
        } catch (error) {
          console.error(`[MfBenchmarkMapping] Batch insert error at offset ${i}:`, error);
          for (const item of batch) {
            try {
              await db.insert(mfBenchmarkMap).values(item).onConflictDoNothing();
            } catch (itemErr: any) {
              console.warn('[MfBenchmarkMapping] Individual insert failed:', itemErr?.message);
            }
          }
        }
      }
    }

    console.log(`[MfBenchmarkMapping] Mapped: ${mapped}, Skipped: ${skipped}`);
    return { mapped, skipped };
  }

  async updateMutualFundBenchmarkReference(isin: string): Promise<void> {
    const [mapping] = await db.select()
      .from(mfBenchmarkMap)
      .where(eq(mfBenchmarkMap.mfIsin, isin))
      .limit(1);

    if (!mapping) return;

    await db.update(mutualFunds)
      .set({
        benchmarkIndexCode: mapping.indexCode,
        benchmarkConfidenceScore: mapping.confidenceScore,
      })
      .where(eq(mutualFunds.isin, isin));
  }

  async getBenchmarkMapping(isin: string): Promise<{ indexCode: string; confidenceScore: number } | null> {
    const [mapping] = await db.select()
      .from(mfBenchmarkMap)
      .where(eq(mfBenchmarkMap.mfIsin, isin))
      .limit(1);

    if (!mapping) return null;

    return {
      indexCode: mapping.indexCode,
      confidenceScore: parseFloat(mapping.confidenceScore),
    };
  }

  async overrideBenchmark(isin: string, indexCode: string, adminUsername: string): Promise<void> {
    await db.update(mfBenchmarkMap)
      .set({
        indexCode,
        isOverridden: true,
        overriddenBy: adminUsername,
        overriddenAt: new Date(),
        confidenceScore: '1.00',
        source: 'manual',
        updatedAt: new Date(),
      })
      .where(eq(mfBenchmarkMap.mfIsin, isin));

    await this.updateMutualFundBenchmarkReference(isin);
  }

  async getMappingStats(): Promise<{
    totalMappings: number;
    autoMappings: number;
    manualOverrides: number;
    highConfidence: number;
    byIndexCode: Record<string, number>;
  }> {
    const allMappings = await db.select().from(mfBenchmarkMap);

    const byIndexCode: Record<string, number> = {};
    let autoMappings = 0;
    let manualOverrides = 0;
    let highConfidence = 0;

    for (const m of allMappings) {
      byIndexCode[m.indexCode] = (byIndexCode[m.indexCode] || 0) + 1;
      if (m.source === 'auto') autoMappings++;
      if (m.isOverridden) manualOverrides++;
      if (parseFloat(m.confidenceScore) >= 0.70) highConfidence++;
    }

    return {
      totalMappings: allMappings.length,
      autoMappings,
      manualOverrides,
      highConfidence,
      byIndexCode,
    };
  }
}

export const mfBenchmarkMappingService = MfBenchmarkMappingService.getInstance();
