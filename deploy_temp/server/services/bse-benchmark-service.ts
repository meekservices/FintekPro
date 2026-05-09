import { db } from '../db';
import { marketIndices, mfBenchmarkMap, mfBenchmarkLineage, amfiSchemeBenchmarks, mutualFunds } from '@shared/schema';
import { eq, sql, and, isNotNull, or } from 'drizzle-orm';
import { amfiBenchmarkIngestionService } from './amfi-benchmark-ingestion-service';

interface BenchmarkResolution {
  indexCode: string | null;
  source: 'manual' | 'amfi' | 'bse' | 'category' | null;
  confidence: number;
  reason: string;
}

const BSE_INDICES = [
  { indexCode: 'SENSEX', indexName: 'S&P BSE Sensex', provider: 'BSE', description: 'S&P BSE Sensex Total Return Index - Top 30 companies' },
  { indexCode: 'BSE100', indexName: 'S&P BSE 100', provider: 'BSE', description: 'S&P BSE 100 Index - Top 100 companies by market cap' },
  { indexCode: 'BSE200', indexName: 'S&P BSE 200', provider: 'BSE', description: 'S&P BSE 200 Index - Top 200 companies by market cap' },
  { indexCode: 'BSE500', indexName: 'S&P BSE 500', provider: 'BSE', description: 'S&P BSE 500 Index - Top 500 companies by market cap' },
  { indexCode: 'BSE_LARGEMID', indexName: 'S&P BSE LargeMidCap', provider: 'BSE', description: 'S&P BSE Large & Mid Cap Index' },
  { indexCode: 'BSE_MIDCAP', indexName: 'S&P BSE MidCap', provider: 'BSE', description: 'S&P BSE Mid Cap Index' },
  { indexCode: 'BSE_SMALLCAP', indexName: 'S&P BSE SmallCap', provider: 'BSE', description: 'S&P BSE Small Cap Index' },
];

const CONFIDENCE_MATRIX: Record<string, number> = {
  manual: 1.00,
  amfi: 0.95,
  bse: 0.90,
  category: 0.70,
};

const CATEGORY_BENCHMARK_DEFAULTS: Record<string, string> = {
  'Large Cap': 'NIFTY50',
  'Large & Mid Cap': 'NIFTY_LARGEMIDCAP_250',
  'Multi Cap': 'NIFTY500',
  'Flexi Cap': 'NIFTY500',
  'Mid Cap': 'NIFTY_MIDCAP_150',
  'Small Cap': 'NIFTY_SMALLCAP_250',
  'ELSS': 'NIFTY500',
  'Value': 'NIFTY500',
  'Focused': 'NIFTY50',
  'Contra': 'NIFTY500',
  'Dividend Yield': 'NIFTY50',
  'Sectoral/Banking': 'NIFTY_BANK',
  'Sectoral/Infrastructure': 'NIFTY_INFRA',
  'Sectoral/Pharma': 'NIFTY_PHARMA',
  'Sectoral/IT': 'NIFTY_IT',
  'Index Fund/Nifty 50': 'NIFTY50',
  'Index Fund/Sensex': 'SENSEX',
  'Hybrid/Balanced': 'NIFTY50',
  'Debt/Liquid': null,
  'Debt/Overnight': null,
};

class BseBenchmarkService {
  private static instance: BseBenchmarkService;

  static getInstance(): BseBenchmarkService {
    if (!BseBenchmarkService.instance) {
      BseBenchmarkService.instance = new BseBenchmarkService();
    }
    return BseBenchmarkService.instance;
  }

  async seedBseIndices(): Promise<{ seeded: number; existing: number }> {
    console.log('[BseBenchmark] Seeding BSE indices to market_indices table...');
    
    let seeded = 0;
    let existing = 0;

    for (const idx of BSE_INDICES) {
      try {
        const existingIndex = await db.select()
          .from(marketIndices)
          .where(eq(marketIndices.indexCode, idx.indexCode))
          .limit(1);

        if (existingIndex.length > 0) {
          existing++;
          continue;
        }

        await db.insert(marketIndices).values({
          indexCode: idx.indexCode,
          indexName: idx.indexName,
          provider: idx.provider,
          description: idx.description,
          isActive: true,
        });
        seeded++;
      } catch (error) {
        console.error(`[BseBenchmark] Error seeding ${idx.indexCode}:`, error);
      }
    }

    console.log(`[BseBenchmark] BSE indices seeded: ${seeded} new, ${existing} existing`);
    return { seeded, existing };
  }

  async resolveBenchmark(mfIsin: string): Promise<BenchmarkResolution> {
    // Step 1: Check for manual override (highest priority)
    const existingMapping = await db.select()
      .from(mfBenchmarkMap)
      .where(eq(mfBenchmarkMap.mfIsin, mfIsin))
      .limit(1);

    if (existingMapping.length > 0) {
      const mapping = existingMapping[0];
      if (mapping.isOverridden) {
        return {
          indexCode: mapping.indexCode,
          source: 'manual',
          confidence: CONFIDENCE_MATRIX.manual,
          reason: `Manual override by admin: ${mapping.mappingReason || 'No reason provided'}`,
        };
      }
    }

    // Step 2: Get ALL AMFI data (regardless of normalization status) to access raw benchmark
    const allAmfiData = await db.select()
      .from(amfiSchemeBenchmarks)
      .where(eq(amfiSchemeBenchmarks.mfIsin, mfIsin))
      .limit(1);

    const rawBenchmark = allAmfiData[0]?.rawBenchmark;

    // Step 3: Check if AMFI normalization succeeded (second priority)
    if (allAmfiData.length > 0 && 
        allAmfiData[0].normalizationStatus === 'success' && 
        allAmfiData[0].normalizedBenchmark) {
      return {
        indexCode: allAmfiData[0].normalizedBenchmark,
        source: 'amfi',
        confidence: CONFIDENCE_MATRIX.amfi,
        reason: `AMFI explicit benchmark: ${rawBenchmark?.substring(0, 60) || 'N/A'}`,
      };
    }

    // Step 4: Try BSE explicit benchmark parsing (third priority)
    // This runs EVEN IF AMFI normalization failed - check raw benchmark text for BSE patterns
    const bseNormResult = this.checkBseExplicitBenchmark(rawBenchmark);
    if (bseNormResult) {
      return {
        indexCode: bseNormResult,
        source: 'bse',
        confidence: CONFIDENCE_MATRIX.bse,
        reason: `BSE explicit benchmark: ${rawBenchmark?.substring(0, 60) || 'N/A'}`,
      };
    }

    // Step 5: Also check mutualFunds.benchmarkIndex for BSE patterns (fallback source)
    const fund = await db.select()
      .from(mutualFunds)
      .where(eq(mutualFunds.isin, mfIsin))
      .limit(1);

    if (fund.length > 0 && fund[0].benchmarkIndex) {
      const bseFromFund = this.checkBseExplicitBenchmark(fund[0].benchmarkIndex);
      if (bseFromFund) {
        return {
          indexCode: bseFromFund,
          source: 'bse',
          confidence: CONFIDENCE_MATRIX.bse,
          reason: `BSE from MF data: ${fund[0].benchmarkIndex?.substring(0, 60) || 'N/A'}`,
        };
      }
    }

    if (fund.length > 0 && fund[0].category) {
      const categoryBenchmark = this.getCategoryDefault(fund[0].category);
      if (categoryBenchmark) {
        return {
          indexCode: categoryBenchmark,
          source: 'category',
          confidence: CONFIDENCE_MATRIX.category,
          reason: `Category default for ${fund[0].category}`,
        };
      }
    }

    return {
      indexCode: null,
      source: null,
      confidence: 0,
      reason: 'No benchmark resolution available - relative metrics disabled',
    };
  }

  private checkBseExplicitBenchmark(rawBenchmark: string | null | undefined): string | null {
    if (!rawBenchmark) return null;

    const text = rawBenchmark.toLowerCase();
    if (text.includes('sensex') || text.includes('s&p bse sensex')) {
      return 'SENSEX';
    }
    if (/bse\s*100|s&p\s*bse\s*100/.test(text)) {
      return 'BSE100';
    }
    if (/bse\s*200|s&p\s*bse\s*200/.test(text)) {
      return 'BSE200';
    }
    if (/bse\s*500|s&p\s*bse\s*500/.test(text)) {
      return 'BSE500';
    }
    if (/bse\s*largemidcap|bse\s*large\s*mid/.test(text)) {
      return 'BSE_LARGEMID';
    }
    return null;
  }

  private getCategoryDefault(category: string): string | null {
    const normalizedCategory = category.toLowerCase();
    
    for (const [key, value] of Object.entries(CATEGORY_BENCHMARK_DEFAULTS)) {
      if (normalizedCategory.includes(key.toLowerCase())) {
        return value;
      }
    }

    if (normalizedCategory.includes('large') && normalizedCategory.includes('mid')) {
      return 'NIFTY_LARGEMIDCAP_250';
    }
    if (normalizedCategory.includes('large')) {
      return 'NIFTY50';
    }
    if (normalizedCategory.includes('mid')) {
      return 'NIFTY_MIDCAP_150';
    }
    if (normalizedCategory.includes('small')) {
      return 'NIFTY_SMALLCAP_250';
    }
    if (normalizedCategory.includes('equity')) {
      return 'NIFTY500';
    }

    return null;
  }

  async autoMapWithBsePrecedence(): Promise<{ mapped: number; updated: number; skipped: number; lineageRecords: number }> {
    console.log('[BseBenchmark] Running BSE-aware auto-mapping with precedence rules...');
    
    const funds = await db.select({
      isin: mutualFunds.isin,
      category: mutualFunds.category,
    })
    .from(mutualFunds)
    .where(isNotNull(mutualFunds.isin));

    let mapped = 0;
    let updated = 0;
    let skipped = 0;
    let lineageRecords = 0;

    for (const fund of funds) {
      if (!fund.isin) continue;

      const resolution = await this.resolveBenchmark(fund.isin);
      
      if (!resolution.indexCode) {
        skipped++;
        continue;
      }

      const existingMapping = await db.select()
        .from(mfBenchmarkMap)
        .where(eq(mfBenchmarkMap.mfIsin, fund.isin))
        .limit(1);

      if (existingMapping.length > 0) {
        const existing = existingMapping[0];
        
        if (existing.isOverridden) {
          skipped++;
          continue;
        }

        if (existing.indexCode === resolution.indexCode && existing.source === resolution.source) {
          skipped++;
          continue;
        }

        await db.insert(mfBenchmarkLineage).values({
          mfIsin: fund.isin,
          previousSource: existing.source as any,
          newSource: resolution.source!,
          previousIndex: existing.indexCode,
          newIndex: resolution.indexCode,
          reason: `Auto-remap: ${resolution.reason}`,
        });
        lineageRecords++;

        await db.update(mfBenchmarkMap)
          .set({
            indexCode: resolution.indexCode,
            source: resolution.source,
            confidenceScore: resolution.confidence.toFixed(2),
            mappingReason: resolution.reason,
            updatedAt: new Date(),
          })
          .where(eq(mfBenchmarkMap.mfIsin, fund.isin));
        
        updated++;
      } else {
        await db.insert(mfBenchmarkMap).values({
          mfIsin: fund.isin,
          indexCode: resolution.indexCode,
          source: resolution.source,
          confidenceScore: resolution.confidence.toFixed(2),
          mappingReason: resolution.reason,
        });

        await db.insert(mfBenchmarkLineage).values({
          mfIsin: fund.isin,
          newSource: resolution.source!,
          newIndex: resolution.indexCode,
          reason: `Initial mapping: ${resolution.reason}`,
        });
        lineageRecords++;

        mapped++;
      }
    }

    console.log(`[BseBenchmark] Auto-map complete: ${mapped} new, ${updated} updated, ${skipped} skipped, ${lineageRecords} lineage records`);
    return { mapped, updated, skipped, lineageRecords };
  }

  async getBenchmarkLineage(mfIsin?: string, limit: number = 50): Promise<Array<{
    mfIsin: string;
    previousSource: string | null;
    newSource: string;
    previousIndex: string | null;
    newIndex: string;
    reason: string | null;
    changedAt: Date;
  }>> {
    let query = db.select()
      .from(mfBenchmarkLineage)
      .orderBy(sql`${mfBenchmarkLineage.changedAt} DESC`)
      .limit(limit);

    if (mfIsin) {
      return query.where(eq(mfBenchmarkLineage.mfIsin, mfIsin));
    }

    return query;
  }

  async getSourceStats(): Promise<{
    total: number;
    bySource: Record<string, number>;
    avgConfidence: Record<string, number>;
  }> {
    const stats = await db.select({
      source: mfBenchmarkMap.source,
      count: sql<number>`count(*)`,
      avgConfidence: sql<number>`avg(${mfBenchmarkMap.confidenceScore}::decimal)`,
    })
    .from(mfBenchmarkMap)
    .groupBy(mfBenchmarkMap.source);

    const bySource: Record<string, number> = {};
    const avgConfidence: Record<string, number> = {};
    let total = 0;

    for (const stat of stats) {
      const source = stat.source || 'unknown';
      bySource[source] = Number(stat.count);
      avgConfidence[source] = Number(stat.avgConfidence) || 0;
      total += Number(stat.count);
    }

    return { total, bySource, avgConfidence };
  }

  async resolveConflict(
    mfIsin: string, 
    resolution: 'accept_amfi' | 'accept_bse' | 'manual', 
    manualIndexCode?: string, 
    adminId?: string,
    reason?: string
  ): Promise<boolean> {
    const existingMapping = await db.select()
      .from(mfBenchmarkMap)
      .where(eq(mfBenchmarkMap.mfIsin, mfIsin))
      .limit(1);

    const previousSource = existingMapping[0]?.source || null;
    const previousIndex = existingMapping[0]?.indexCode || null;

    let newSource: string;
    let newIndex: string;
    let confidence: number;

    if (resolution === 'accept_amfi') {
      const amfiData = await db.select()
        .from(amfiSchemeBenchmarks)
        .where(eq(amfiSchemeBenchmarks.mfIsin, mfIsin))
        .limit(1);
      
      if (!amfiData[0]?.normalizedBenchmark) return false;
      
      newSource = 'amfi';
      newIndex = amfiData[0].normalizedBenchmark;
      confidence = CONFIDENCE_MATRIX.amfi;
    } else if (resolution === 'accept_bse') {
      const amfiData = await db.select()
        .from(amfiSchemeBenchmarks)
        .where(eq(amfiSchemeBenchmarks.mfIsin, mfIsin))
        .limit(1);
      
      const bseIndex = this.checkBseExplicitBenchmark(amfiData[0]?.rawBenchmark);
      if (!bseIndex) return false;
      
      newSource = 'bse';
      newIndex = bseIndex;
      confidence = CONFIDENCE_MATRIX.bse;
    } else if (resolution === 'manual' && manualIndexCode) {
      newSource = 'manual';
      newIndex = manualIndexCode;
      confidence = CONFIDENCE_MATRIX.manual;
    } else {
      return false;
    }

    await db.insert(mfBenchmarkLineage).values({
      mfIsin,
      previousSource: previousSource as any,
      newSource,
      previousIndex,
      newIndex,
      reason: reason || `Admin ${resolution} resolution`,
      changedBy: adminId,
    });

    await db.insert(mfBenchmarkMap)
      .values({
        mfIsin,
        indexCode: newIndex,
        source: newSource,
        confidenceScore: confidence.toFixed(2),
        mappingReason: reason || `Admin ${resolution} resolution`,
        isOverridden: resolution === 'manual',
        overriddenBy: resolution === 'manual' ? adminId : undefined,
        overriddenAt: resolution === 'manual' ? new Date() : undefined,
      })
      .onConflictDoUpdate({
        target: mfBenchmarkMap.mfIsin,
        set: {
          indexCode: newIndex,
          source: newSource,
          confidenceScore: confidence.toFixed(2),
          mappingReason: reason || `Admin ${resolution} resolution`,
          isOverridden: resolution === 'manual',
          overriddenBy: resolution === 'manual' ? adminId : undefined,
          overriddenAt: resolution === 'manual' ? new Date() : undefined,
          updatedAt: new Date(),
        },
      });

    return true;
  }

  async getAmfiBseConflicts(): Promise<Array<{
    isin: string;
    schemeName: string | null;
    rawBenchmark: string | null;
    amfiIndex: string | null;
    bseIndex: string | null;
    currentMapping: string | null;
    currentSource: string | null;
  }>> {
    const schemesWithBenchmarks = await db.select({
      isin: amfiSchemeBenchmarks.mfIsin,
      schemeName: amfiSchemeBenchmarks.schemeName,
      rawBenchmark: amfiSchemeBenchmarks.rawBenchmark,
      amfiIndex: amfiSchemeBenchmarks.normalizedBenchmark,
    })
    .from(amfiSchemeBenchmarks)
    .where(and(
      isNotNull(amfiSchemeBenchmarks.normalizedBenchmark),
      eq(amfiSchemeBenchmarks.normalizationStatus, 'success')
    ))
    .limit(500);

    const conflicts: Array<{
      isin: string;
      schemeName: string | null;
      rawBenchmark: string | null;
      amfiIndex: string | null;
      bseIndex: string | null;
      currentMapping: string | null;
      currentSource: string | null;
    }> = [];

    for (const scheme of schemesWithBenchmarks) {
      const bseIndex = this.checkBseExplicitBenchmark(scheme.rawBenchmark);
      
      if (bseIndex && bseIndex !== scheme.amfiIndex) {
        const currentMap = await db.select()
          .from(mfBenchmarkMap)
          .where(eq(mfBenchmarkMap.mfIsin, scheme.isin!))
          .limit(1);

        conflicts.push({
          isin: scheme.isin!,
          schemeName: scheme.schemeName,
          rawBenchmark: scheme.rawBenchmark,
          amfiIndex: scheme.amfiIndex,
          bseIndex,
          currentMapping: currentMap[0]?.indexCode || null,
          currentSource: currentMap[0]?.source || null,
        });
      }
    }

    return conflicts;
  }
}

export const bseBenchmarkService = BseBenchmarkService.getInstance();
