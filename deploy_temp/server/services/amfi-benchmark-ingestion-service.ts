import { db } from '../db';
import { amfiSchemeBenchmarks, mfBenchmarkMap, mfBenchmarkHistory, mutualFunds } from '@shared/schema';
import { eq, sql, and, isNotNull } from 'drizzle-orm';

interface NormalizationResult {
  normalizedCode: string | null;
  status: 'success' | 'failed' | 'ambiguous';
  reason: string;
}

const BENCHMARK_NORMALIZATION_RULES: Array<{ pattern: RegExp; indexCode: string; priority: number }> = [
  { pattern: /\bNIFTY\s*50\b(?!\s*(?:Next|Midcap|Smallcap|Equal|Value|Growth|100|200|500))/i, indexCode: 'NIFTY50', priority: 100 },
  { pattern: /\bNIFTY\s*100\b/i, indexCode: 'NIFTY100', priority: 95 },
  { pattern: /\bNIFTY\s*Next\s*50\b/i, indexCode: 'NIFTY_NEXT50', priority: 95 },
  { pattern: /\bNIFTY\s*200\b/i, indexCode: 'NIFTY200', priority: 90 },
  { pattern: /\bNIFTY\s*500\b/i, indexCode: 'NIFTY500', priority: 85 },
  { pattern: /\bNIFTY\s*Midcap\s*150\b/i, indexCode: 'NIFTY_MIDCAP_150', priority: 95 },
  { pattern: /\bNIFTY\s*Midcap\s*100\b/i, indexCode: 'NIFTY_MIDCAP_100', priority: 90 },
  { pattern: /\bNIFTY\s*Midcap\s*50\b/i, indexCode: 'NIFTY_MIDCAP_50', priority: 85 },
  { pattern: /\bNIFTY\s*Smallcap\s*250\b/i, indexCode: 'NIFTY_SMALLCAP_250', priority: 95 },
  { pattern: /\bNIFTY\s*Smallcap\s*100\b/i, indexCode: 'NIFTY_SMALLCAP_100', priority: 90 },
  { pattern: /\bNIFTY\s*Smallcap\s*50\b/i, indexCode: 'NIFTY_SMALLCAP_50', priority: 85 },
  { pattern: /\bNIFTY\s*Bank\b/i, indexCode: 'NIFTY_BANK', priority: 95 },
  { pattern: /\bNIFTY\s*Financial\s*Services?\b/i, indexCode: 'NIFTY_FINANCIAL', priority: 90 },
  { pattern: /\bNIFTY\s*IT\b|\bNIFTY\s*Information\s*Technology\b/i, indexCode: 'NIFTY_IT', priority: 95 },
  { pattern: /\bNIFTY\s*Pharma\b|\bNIFTY\s*Healthcare\b/i, indexCode: 'NIFTY_PHARMA', priority: 95 },
  { pattern: /\bNIFTY\s*Auto\b|\bNIFTY\s*Automobile\b/i, indexCode: 'NIFTY_AUTO', priority: 90 },
  { pattern: /\bNIFTY\s*FMCG\b/i, indexCode: 'NIFTY_FMCG', priority: 90 },
  { pattern: /\bNIFTY\s*Metal\b/i, indexCode: 'NIFTY_METAL', priority: 90 },
  { pattern: /\bNIFTY\s*Energy\b/i, indexCode: 'NIFTY_ENERGY', priority: 90 },
  { pattern: /\bNIFTY\s*Infra\b|\bNIFTY\s*Infrastructure\b/i, indexCode: 'NIFTY_INFRA', priority: 90 },
  { pattern: /\bNIFTY\s*Realty\b/i, indexCode: 'NIFTY_REALTY', priority: 90 },
  { pattern: /\bNIFTY\s*PSE\b|\bNIFTY\s*PSU\s*Bank\b/i, indexCode: 'NIFTY_PSE', priority: 90 },
  { pattern: /\bNIFTY\s*Private\s*Bank\b/i, indexCode: 'NIFTY_PVT_BANK', priority: 90 },
  { pattern: /\bNIFTY\s*Consumption\b/i, indexCode: 'NIFTY_CONSUMPTION', priority: 85 },
  { pattern: /\bNIFTY\s*Commodities?\b/i, indexCode: 'NIFTY_COMMODITIES', priority: 85 },
  { pattern: /\bNIFTY\s*MNC\b/i, indexCode: 'NIFTY_MNC', priority: 85 },
  { pattern: /\bNIFTY\s*Services\s*Sector\b/i, indexCode: 'NIFTY_SERVICES', priority: 85 },
  { pattern: /\bNIFTY\s*Large\s*Midcap\s*250\b/i, indexCode: 'NIFTY_LARGEMIDCAP_250', priority: 90 },
  { pattern: /\bNIFTY\s*Midcap\s*Select\b/i, indexCode: 'NIFTY_MIDCAP_SELECT', priority: 85 },
  { pattern: /\bBSE\s*Sensex\b|\bS&P\s*BSE\s*Sensex\b|\bSENSEX\b/i, indexCode: 'SENSEX', priority: 100 },
  { pattern: /\bS&P\s*BSE\s*100\b|\bBSE\s*100\b/i, indexCode: 'BSE100', priority: 90 },
  { pattern: /\bS&P\s*BSE\s*200\b|\bBSE\s*200\b/i, indexCode: 'BSE200', priority: 85 },
  { pattern: /\bS&P\s*BSE\s*500\b|\bBSE\s*500\b/i, indexCode: 'BSE500', priority: 80 },
  { pattern: /\bBSE\s*LargeMidcap\b|\bS&P\s*BSE\s*LargeMidcap\b|\bBSE\s*Large\s*Mid\s*Cap\b/i, indexCode: 'BSE_LARGEMID', priority: 85 },
  { pattern: /\bBSE\s*Midcap\b|\bS&P\s*BSE\s*Midcap\b/i, indexCode: 'BSE_MIDCAP', priority: 85 },
  { pattern: /\bBSE\s*Smallcap\b|\bS&P\s*BSE\s*Smallcap\b/i, indexCode: 'BSE_SMALLCAP', priority: 85 },
];

const TRI_PATTERNS = [
  /\bTRI\b/i,
  /\bTotal\s*Return\s*Index\b/i,
  /\bTotal\s*Return\b/i,
];

class AmfiBenchmarkIngestionService {
  private static instance: AmfiBenchmarkIngestionService;

  static getInstance(): AmfiBenchmarkIngestionService {
    if (!AmfiBenchmarkIngestionService.instance) {
      AmfiBenchmarkIngestionService.instance = new AmfiBenchmarkIngestionService();
    }
    return AmfiBenchmarkIngestionService.instance;
  }

  normalizeBenchmark(rawText: string | null): NormalizationResult {
    if (!rawText || rawText.trim().length === 0) {
      return { normalizedCode: null, status: 'failed', reason: 'Empty benchmark text' };
    }

    const cleanedText = rawText.trim();
    const matchedRules: Array<{ indexCode: string; priority: number }> = [];

    for (const rule of BENCHMARK_NORMALIZATION_RULES) {
      if (rule.pattern.test(cleanedText)) {
        matchedRules.push({ indexCode: rule.indexCode, priority: rule.priority });
      }
    }

    if (matchedRules.length === 0) {
      return { 
        normalizedCode: null, 
        status: 'failed', 
        reason: `No matching normalization rule for: "${cleanedText.substring(0, 100)}"` 
      };
    }

    if (matchedRules.length > 1) {
      matchedRules.sort((a, b) => b.priority - a.priority);
      if (matchedRules[0].priority === matchedRules[1].priority) {
        return { 
          normalizedCode: null, 
          status: 'ambiguous', 
          reason: `Multiple matches with same priority: ${matchedRules.map(r => r.indexCode).join(', ')}` 
        };
      }
    }

    return { 
      normalizedCode: matchedRules[0].indexCode, 
      status: 'success', 
      reason: `Normalized to ${matchedRules[0].indexCode}` 
    };
  }

  async syncAmfiSchemeBenchmarks(): Promise<{ total: number; parsed: number; normalized: number; failed: number }> {
    console.log('[AmfiBenchmarkIngestion] Starting AMFI scheme benchmark sync...');
    
    const fundsWithBenchmark = await db.select({
      isin: mutualFunds.isin,
      schemeCode: mutualFunds.schemeCode,
      schemeName: mutualFunds.schemeName,
      category: mutualFunds.category,
      benchmarkIndex: mutualFunds.benchmarkIndex,
    })
    .from(mutualFunds)
    .where(and(
      isNotNull(mutualFunds.isin),
      isNotNull(mutualFunds.benchmarkIndex),
      sql`${mutualFunds.isin} != ''`,
      sql`${mutualFunds.benchmarkIndex} != ''`
    ));

    console.log(`[AmfiBenchmarkIngestion] Found ${fundsWithBenchmark.length} funds with benchmark data`);

    let parsed = 0;
    let normalized = 0;
    let failed = 0;

    for (const fund of fundsWithBenchmark) {
      if (!fund.isin) continue;

      const normResult = this.normalizeBenchmark(fund.benchmarkIndex);

      try {
        await db.insert(amfiSchemeBenchmarks)
          .values({
            mfIsin: fund.isin,
            schemeCode: fund.schemeCode,
            schemeName: fund.schemeName,
            schemeCategory: fund.category,
            rawBenchmark: fund.benchmarkIndex,
            normalizedBenchmark: normResult.normalizedCode,
            normalizationStatus: normResult.status,
          })
          .onConflictDoUpdate({
            target: amfiSchemeBenchmarks.mfIsin,
            set: {
              schemeCode: fund.schemeCode,
              schemeName: fund.schemeName,
              schemeCategory: fund.category,
              rawBenchmark: fund.benchmarkIndex,
              normalizedBenchmark: normResult.normalizedCode,
              normalizationStatus: normResult.status,
              updatedAt: new Date(),
            }
          });

        parsed++;
        if (normResult.status === 'success') {
          normalized++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`[AmfiBenchmarkIngestion] Error processing ${fund.isin}:`, error);
        failed++;
      }
    }

    console.log(`[AmfiBenchmarkIngestion] Sync complete: ${parsed} parsed, ${normalized} normalized, ${failed} failed`);
    return { total: fundsWithBenchmark.length, parsed, normalized, failed };
  }

  async autoMapFromAmfi(): Promise<{ mapped: number; updated: number; skipped: number; recompute: string[] }> {
    console.log('[AmfiBenchmarkIngestion] Auto-mapping funds from AMFI data...');
    
    const amfiData = await db.select()
      .from(amfiSchemeBenchmarks)
      .where(and(
        isNotNull(amfiSchemeBenchmarks.normalizedBenchmark),
        eq(amfiSchemeBenchmarks.normalizationStatus, 'success')
      ));

    let mapped = 0;
    let updated = 0;
    let skipped = 0;
    const recomputeIsins: string[] = [];

    for (const amfi of amfiData) {
      if (!amfi.mfIsin || !amfi.normalizedBenchmark) continue;

      const existingMap = await db.select()
        .from(mfBenchmarkMap)
        .where(eq(mfBenchmarkMap.mfIsin, amfi.mfIsin))
        .limit(1);

      if (existingMap.length > 0) {
        const existing = existingMap[0];
        
        if (existing.isOverridden) {
          skipped++;
          continue;
        }

        if (existing.source === 'amfi' && existing.indexCode === amfi.normalizedBenchmark) {
          skipped++;
          continue;
        }

        if (existing.indexCode !== amfi.normalizedBenchmark) {
          await db.insert(mfBenchmarkHistory).values({
            mfIsin: amfi.mfIsin,
            oldIndexCode: existing.indexCode,
            newIndexCode: amfi.normalizedBenchmark,
            oldRawBenchmark: amfi.rawBenchmark,
            newRawBenchmark: amfi.rawBenchmark,
            changeSource: 'amfi_update',
          });

          recomputeIsins.push(amfi.mfIsin);
        }

        await db.update(mfBenchmarkMap)
          .set({
            indexCode: amfi.normalizedBenchmark,
            source: 'amfi',
            confidenceScore: '0.95',
            mappingReason: `AMFI explicit: ${amfi.rawBenchmark?.substring(0, 50)}`,
            updatedAt: new Date(),
          })
          .where(eq(mfBenchmarkMap.mfIsin, amfi.mfIsin));
        
        updated++;
      } else {
        await db.insert(mfBenchmarkMap).values({
          mfIsin: amfi.mfIsin,
          mfSchemeCode: amfi.schemeCode,
          indexCode: amfi.normalizedBenchmark,
          source: 'amfi',
          confidenceScore: '0.95',
          mappingReason: `AMFI explicit: ${amfi.rawBenchmark?.substring(0, 50)}`,
        });

        mapped++;
        recomputeIsins.push(amfi.mfIsin);
      }
    }

    console.log(`[AmfiBenchmarkIngestion] Auto-map complete: ${mapped} new, ${updated} updated, ${skipped} skipped`);
    return { mapped, updated, skipped, recompute: recomputeIsins };
  }

  async getAmfiStats(): Promise<{
    total: number;
    normalized: number;
    failed: number;
    ambiguous: number;
    byIndex: Record<string, number>;
  }> {
    const stats = await db.select({
      status: amfiSchemeBenchmarks.normalizationStatus,
      count: sql<number>`count(*)`,
    })
    .from(amfiSchemeBenchmarks)
    .groupBy(amfiSchemeBenchmarks.normalizationStatus);

    const indexStats = await db.select({
      indexCode: amfiSchemeBenchmarks.normalizedBenchmark,
      count: sql<number>`count(*)`,
    })
    .from(amfiSchemeBenchmarks)
    .where(isNotNull(amfiSchemeBenchmarks.normalizedBenchmark))
    .groupBy(amfiSchemeBenchmarks.normalizedBenchmark);

    const byIndex: Record<string, number> = {};
    for (const stat of indexStats) {
      if (stat.indexCode) {
        byIndex[stat.indexCode] = Number(stat.count);
      }
    }

    const total = stats.reduce((sum, s) => sum + Number(s.count), 0);
    const normalized = stats.find(s => s.status === 'success')?.count || 0;
    const failed = stats.find(s => s.status === 'failed')?.count || 0;
    const ambiguous = stats.find(s => s.status === 'ambiguous')?.count || 0;

    return { total, normalized: Number(normalized), failed: Number(failed), ambiguous: Number(ambiguous), byIndex };
  }

  async getConflicts(): Promise<Array<{
    isin: string;
    schemeName: string | null;
    amfiBenchmark: string | null;
    amfiNormalized: string | null;
    currentMapping: string | null;
    currentSource: string | null;
    currentConfidence: string | null;
  }>> {
    const conflicts = await db.select({
      isin: amfiSchemeBenchmarks.mfIsin,
      schemeName: amfiSchemeBenchmarks.schemeName,
      amfiBenchmark: amfiSchemeBenchmarks.rawBenchmark,
      amfiNormalized: amfiSchemeBenchmarks.normalizedBenchmark,
      currentMapping: mfBenchmarkMap.indexCode,
      currentSource: mfBenchmarkMap.source,
      currentConfidence: mfBenchmarkMap.confidenceScore,
    })
    .from(amfiSchemeBenchmarks)
    .innerJoin(mfBenchmarkMap, eq(amfiSchemeBenchmarks.mfIsin, mfBenchmarkMap.mfIsin))
    .where(and(
      isNotNull(amfiSchemeBenchmarks.normalizedBenchmark),
      eq(amfiSchemeBenchmarks.normalizationStatus, 'success'),
      sql`${amfiSchemeBenchmarks.normalizedBenchmark} != ${mfBenchmarkMap.indexCode}`,
      eq(mfBenchmarkMap.isOverridden, false)
    ))
    .limit(100);

    return conflicts;
  }

  async resolveConflict(isin: string, resolution: 'accept_amfi' | 'keep_current' | 'manual', manualIndexCode?: string, adminId?: string): Promise<boolean> {
    const amfiData = await db.select()
      .from(amfiSchemeBenchmarks)
      .where(eq(amfiSchemeBenchmarks.mfIsin, isin))
      .limit(1);

    if (amfiData.length === 0) {
      console.log(`[AmfiBenchmarkIngestion] No AMFI data found for ${isin}`);
      return false;
    }

    const existingMap = await db.select()
      .from(mfBenchmarkMap)
      .where(eq(mfBenchmarkMap.mfIsin, isin))
      .limit(1);

    if (resolution === 'accept_amfi') {
      const newIndexCode = amfiData[0].normalizedBenchmark;
      if (!newIndexCode) return false;

      if (existingMap.length > 0) {
        await db.insert(mfBenchmarkHistory).values({
          mfIsin: isin,
          oldIndexCode: existingMap[0].indexCode,
          newIndexCode,
          changeSource: 'admin_override',
        });

        await db.update(mfBenchmarkMap)
          .set({
            indexCode: newIndexCode,
            source: 'amfi',
            confidenceScore: '0.95',
            mappingReason: `Admin accepted AMFI: ${amfiData[0].rawBenchmark?.substring(0, 50)}`,
            updatedAt: new Date(),
          })
          .where(eq(mfBenchmarkMap.mfIsin, isin));
      }
    } else if (resolution === 'keep_current') {
      if (existingMap.length > 0) {
        await db.update(mfBenchmarkMap)
          .set({
            isOverridden: true,
            overriddenBy: adminId,
            overriddenAt: new Date(),
            mappingReason: `Admin kept category default over AMFI`,
            updatedAt: new Date(),
          })
          .where(eq(mfBenchmarkMap.mfIsin, isin));
      }
    } else if (resolution === 'manual' && manualIndexCode) {
      if (existingMap.length > 0) {
        await db.insert(mfBenchmarkHistory).values({
          mfIsin: isin,
          oldIndexCode: existingMap[0].indexCode,
          newIndexCode: manualIndexCode,
          changeSource: 'admin_override',
        });
      }

      await db.insert(mfBenchmarkMap)
        .values({
          mfIsin: isin,
          indexCode: manualIndexCode,
          source: 'manual',
          confidenceScore: '1.00',
          mappingReason: `Admin manual override`,
          isOverridden: true,
          overriddenBy: adminId,
          overriddenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: mfBenchmarkMap.mfIsin,
          set: {
            indexCode: manualIndexCode,
            source: 'manual',
            confidenceScore: '1.00',
            mappingReason: `Admin manual override`,
            isOverridden: true,
            overriddenBy: adminId,
            overriddenAt: new Date(),
            updatedAt: new Date(),
          }
        });
    }

    return true;
  }

  async getBenchmarkHistory(isin?: string, limit: number = 50): Promise<Array<{
    mfIsin: string;
    oldIndexCode: string | null;
    newIndexCode: string | null;
    changeSource: string | null;
    changedAt: Date | null;
  }>> {
    const query = db.select()
      .from(mfBenchmarkHistory)
      .orderBy(sql`${mfBenchmarkHistory.changedAt} DESC`)
      .limit(limit);

    if (isin) {
      return query.where(eq(mfBenchmarkHistory.mfIsin, isin));
    }

    return query;
  }
}

export const amfiBenchmarkIngestionService = AmfiBenchmarkIngestionService.getInstance();
