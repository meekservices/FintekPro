/**
 * PDF Parser Engine v2.0
 * 
 * Next-generation PDF parsing with:
 * - Feature flag system for v1/v2 toggling
 * - Dual-run mode for comparison
 * - Document profiling and format learning
 * - Semantic block detection
 * - Confidence scoring
 * - Backward compatibility with v1
 */

import * as crypto from 'crypto';
import { pdfParserService } from './pdf-parser-service';

export type ParserVersion = 'v1' | 'v2' | 'dual';

export type PDFType = 
  | 'cas_cams'           // CAMS CAS statement
  | 'cas_kfintech'       // KFintech CAS statement
  | 'cas_combined'       // Combined CAMS + KFintech
  | 'broker_zerodha'     // Zerodha holdings
  | 'broker_groww'       // Groww holdings
  | 'broker_icici'       // ICICI Direct holdings
  | 'broker_hdfc'        // HDFC Securities holdings
  | 'broker_kotak'       // Kotak Securities holdings
  | 'broker_upstox'      // Upstox holdings
  | 'broker_angelone'    // Angel One holdings
  | 'aggregator_wealthy' // Wealthy.in summary
  | 'aggregator_mfcentral' // MF Central
  | 'summary_only'       // Summary PDF without transactions
  | 'transaction_only'   // Transaction statement only
  | 'unknown';

export type LayoutType = 
  | 'tabular'            // Clear table structure
  | 'semi_structured'    // Partial table structure
  | 'narrative'          // Text-heavy, no tables
  | 'mixed';             // Combination of layouts

export interface ParserConfig {
  version: ParserVersion;
  enableDualRun: boolean;
  enableLearning: boolean;
  enableConfidenceScoring: boolean;
  logComparisons: boolean;
  forceV1Fallback: boolean;
  minConfidenceThreshold: number;
}

export interface PDFProfile {
  id: string;
  fingerprint: string;
  pdfType: PDFType;
  layoutType: LayoutType;
  pageCount: number;
  textDensity: number;
  hasTableStructure: boolean;
  registrars: string[];
  headerPatterns: string[];
  columnOrder: string[];
  detectedAt: string;
  confidenceScore: number;
  version: string;
}

export interface ParserComparisonResult {
  v1HoldingsCount: number;
  v2HoldingsCount: number;
  v1TotalValue: number;
  v2TotalValue: number;
  matchPercentage: number;
  discrepancies: Array<{
    field: string;
    v1Value: any;
    v2Value: any;
    isin?: string;
  }>;
  v1Confidence: number;
  v2Confidence: number;
  preferredVersion: ParserVersion;
  reason: string;
}

export interface V2ParseResult {
  success: boolean;
  profile: PDFProfile;
  holdings: any[];
  transactions: any[];
  investor: {
    name?: string;
    pan?: string;
    email?: string;
  };
  summary: {
    totalHoldings: number;
    totalInvestedValue: number;
    totalCurrentValue: number;
    totalUnrealizedGain: number;
  };
  confidenceScore: number;
  parsingMetrics: {
    parseTimeMs: number;
    pagesProcessed: number;
    blocksDetected: number;
    validationsPassed: number;
    validationsFailed: number;
  };
  errors: string[];
  warnings: string[];
  requiresEnrichment: boolean;
  unreslovedItems: Array<{
    type: 'date' | 'isin' | 'value' | 'folio';
    description: string;
    affectedHoldings: string[];
  }>;
}

const DEFAULT_CONFIG: ParserConfig = {
  version: 'v1',
  enableDualRun: false,
  enableLearning: true,
  enableConfidenceScoring: true,
  logComparisons: true,
  forceV1Fallback: false,
  minConfidenceThreshold: 0.6,
};

let currentConfig: ParserConfig = { ...DEFAULT_CONFIG };

const profileCache = new Map<string, PDFProfile>();
const PROFILE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

class PDFParserV2Service {
  private static instance: PDFParserV2Service;

  private constructor() {
    console.log('✅ PDF Parser v2 Service initialized');
    console.log(`   Version: ${currentConfig.version}`);
    console.log(`   Dual-run: ${currentConfig.enableDualRun}`);
    console.log(`   Learning: ${currentConfig.enableLearning}`);
  }

  static getInstance(): PDFParserV2Service {
    if (!PDFParserV2Service.instance) {
      PDFParserV2Service.instance = new PDFParserV2Service();
    }
    return PDFParserV2Service.instance;
  }

  getConfig(): ParserConfig {
    return { ...currentConfig };
  }

  setConfig(config: Partial<ParserConfig>): void {
    currentConfig = { ...currentConfig, ...config };
    console.log('[Parser v2] Config updated:', currentConfig);
  }

  setVersion(version: ParserVersion): void {
    currentConfig.version = version;
    console.log(`[Parser v2] Version set to: ${version}`);
  }

  enableDualRun(enable: boolean = true): void {
    currentConfig.enableDualRun = enable;
    console.log(`[Parser v2] Dual-run mode: ${enable ? 'enabled' : 'disabled'}`);
  }

  forceV1Fallback(force: boolean = true): void {
    currentConfig.forceV1Fallback = force;
    console.log(`[Parser v2] Force v1 fallback: ${force ? 'enabled' : 'disabled'}`);
  }

  computeFingerprint(text: string): string {
    const normalizedText = text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\d+/g, 'N')
      .substring(0, 10000);
    
    return crypto.createHash('sha256').update(normalizedText).digest('hex').substring(0, 32);
  }

  async profileDocument(buffer: Buffer): Promise<PDFProfile> {
    const startTime = Date.now();
    
    const parseResult = await pdfParserService.extractTextSafe(buffer);
    if (!parseResult.success || !parseResult.result) {
      throw new Error(parseResult.error || 'Failed to extract PDF text');
    }

    const text = parseResult.result.text;
    const pageCount = parseResult.result.pageCount || 1;
    const fingerprint = this.computeFingerprint(text);

    const cached = profileCache.get(fingerprint);
    if (cached) {
      console.log('[Parser v2] Profile cache hit:', fingerprint.substring(0, 8));
      return cached;
    }

    const profile: PDFProfile = {
      id: crypto.randomUUID(),
      fingerprint,
      pdfType: this.detectPDFType(text),
      layoutType: this.detectLayoutType(text),
      pageCount,
      textDensity: this.calculateTextDensity(text, pageCount),
      hasTableStructure: this.detectTableStructure(text),
      registrars: this.detectRegistrars(text),
      headerPatterns: this.detectHeaderPatterns(text),
      columnOrder: this.detectColumnOrder(text),
      detectedAt: new Date().toISOString(),
      confidenceScore: 0,
      version: '2.0',
    };

    profile.confidenceScore = this.calculateProfileConfidence(profile);

    profileCache.set(fingerprint, profile);

    console.log(`[Parser v2] Document profiled in ${Date.now() - startTime}ms:`, {
      type: profile.pdfType,
      layout: profile.layoutType,
      pages: profile.pageCount,
      confidence: profile.confidenceScore,
    });

    return profile;
  }

  private detectPDFType(text: string): PDFType {
    const lowerText = text.toLowerCase();

    if (/consolidated\s*account\s*statement/i.test(text)) {
      if (/cams/i.test(text) && /kfintech|karvy/i.test(text)) {
        return 'cas_combined';
      }
      if (/kfintech|karvy/i.test(text)) {
        return 'cas_kfintech';
      }
      return 'cas_cams';
    }

    if (/zerodha|kite\./i.test(text)) return 'broker_zerodha';
    if (/groww\.in|groww\s+portfolio/i.test(text)) return 'broker_groww';
    if (/icici\s*direct|icicidirect/i.test(text)) return 'broker_icici';
    if (/hdfc\s*securities/i.test(text)) return 'broker_hdfc';
    if (/kotak\s*securities/i.test(text)) return 'broker_kotak';
    if (/upstox/i.test(text)) return 'broker_upstox';
    if (/angel\s*one|angelbroking/i.test(text)) return 'broker_angelone';
    if (/wealthy\.in|wealthy\s+portfolio/i.test(text)) return 'aggregator_wealthy';
    if (/mf\s*central|mfcentral/i.test(text)) return 'aggregator_mfcentral';

    const hasTransactions = /transaction\s*date|purchase|redemption|switch\s*(in|out)/i.test(text);
    const hasHoldings = /unit\s*balance|market\s*value|current\s*value/i.test(text);

    if (hasHoldings && !hasTransactions) return 'summary_only';
    if (hasTransactions && !hasHoldings) return 'transaction_only';

    return 'unknown';
  }

  private detectLayoutType(text: string): LayoutType {
    const lines = text.split('\n');
    let tabularLines = 0;
    let narrativeLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const hasMultipleNumbers = (trimmed.match(/[\d,]+\.\d{2}/g) || []).length >= 2;
      const hasDelimiters = /\s{3,}|\t|\|/.test(trimmed);

      if (hasMultipleNumbers && hasDelimiters) {
        tabularLines++;
      } else if (trimmed.length > 50 && !/\d/.test(trimmed)) {
        narrativeLines++;
      }
    }

    const tabularRatio = tabularLines / Math.max(lines.length, 1);
    const narrativeRatio = narrativeLines / Math.max(lines.length, 1);

    if (tabularRatio > 0.3) return 'tabular';
    if (narrativeRatio > 0.5) return 'narrative';
    if (tabularRatio > 0.1 && narrativeRatio > 0.1) return 'mixed';
    return 'semi_structured';
  }

  private calculateTextDensity(text: string, pageCount: number): number {
    const charCount = text.replace(/\s/g, '').length;
    return Math.round(charCount / Math.max(pageCount, 1));
  }

  private detectTableStructure(text: string): boolean {
    const tableIndicators = [
      /folio\s*no\.?.*scheme\s*name.*unit\s*balance/i,
      /isin.*nav.*market\s*value/i,
      /date.*transaction.*units.*amount/i,
      /scheme.*invested.*current/i,
    ];

    return tableIndicators.some(pattern => pattern.test(text));
  }

  private detectRegistrars(text: string): string[] {
    const registrars: string[] = [];
    if (/cams/i.test(text)) registrars.push('CAMS');
    if (/kfintech|karvy/i.test(text)) registrars.push('KFINTECH');
    if (/franklin/i.test(text)) registrars.push('FRANKLIN');
    return registrars;
  }

  private detectHeaderPatterns(text: string): string[] {
    const patterns: string[] = [];
    const lines = text.split('\n');

    const headerKeywords = [
      'folio', 'isin', 'scheme', 'name', 'cost', 'invested', 
      'units', 'balance', 'nav', 'market', 'current', 'value'
    ];

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const matchCount = headerKeywords.filter(k => lowerLine.includes(k)).length;
      if (matchCount >= 4) {
        patterns.push(line.trim().substring(0, 200));
      }
    }

    return patterns.slice(0, 5);
  }

  private detectColumnOrder(text: string): string[] {
    const columnKeywords = {
      cost: ['cost', 'invested', 'investment', 'purchase amount'],
      units: ['unit', 'balance', 'quantity', 'holding'],
      nav: ['nav', 'net asset', 'rate'],
      market: ['market', 'current', 'valuation', 'present value'],
    };

    const lines = text.split('\n');
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      const positions: Array<{ type: string; index: number }> = [];
      
      for (const [type, keywords] of Object.entries(columnKeywords)) {
        for (const keyword of keywords) {
          const idx = lowerLine.indexOf(keyword);
          if (idx >= 0) {
            positions.push({ type, index: idx });
            break;
          }
        }
      }
      
      if (positions.length >= 3) {
        positions.sort((a, b) => a.index - b.index);
        return positions.map(p => p.type);
      }
    }

    return ['cost', 'units', 'nav', 'market'];
  }

  private calculateProfileConfidence(profile: PDFProfile): number {
    let score = 0.5;

    if (profile.pdfType !== 'unknown') score += 0.15;
    if (profile.hasTableStructure) score += 0.1;
    if (profile.registrars.length > 0) score += 0.1;
    if (profile.headerPatterns.length > 0) score += 0.1;
    if (profile.columnOrder.length >= 4) score += 0.05;

    return Math.min(score, 1.0);
  }

  async compareResults(
    v1Result: any,
    v2Result: V2ParseResult
  ): Promise<ParserComparisonResult> {
    const v1Holdings = v1Result?.holdings || [];
    const v2Holdings = v2Result?.holdings || [];

    const v1Total = v1Holdings.reduce((sum: number, h: any) => sum + (h.currentValue || 0), 0);
    const v2Total = v2Holdings.reduce((sum: number, h: any) => sum + (h.currentValue || 0), 0);

    const discrepancies: ParserComparisonResult['discrepancies'] = [];

    const v1ISINs = new Set(v1Holdings.map((h: any) => h.isin).filter(Boolean));
    const v2ISINs = new Set(v2Holdings.map((h: any) => h.isin).filter(Boolean));

    for (const isin of v1ISINs) {
      if (!v2ISINs.has(isin)) {
        discrepancies.push({
          field: 'missing_holding',
          v1Value: isin,
          v2Value: null,
          isin,
        });
      }
    }

    for (const isin of v2ISINs) {
      if (!v1ISINs.has(isin)) {
        discrepancies.push({
          field: 'new_holding',
          v1Value: null,
          v2Value: isin,
          isin,
        });
      }
    }

    for (const isin of v1ISINs) {
      if (v2ISINs.has(isin)) {
        const v1Holding = v1Holdings.find((h: any) => h.isin === isin);
        const v2Holding = v2Holdings.find((h: any) => h.isin === isin);

        if (v1Holding && v2Holding) {
          const valueDiff = Math.abs((v1Holding.currentValue || 0) - (v2Holding.currentValue || 0));
          if (valueDiff > 100) {
            discrepancies.push({
              field: 'value_mismatch',
              v1Value: v1Holding.currentValue,
              v2Value: v2Holding.currentValue,
              isin,
            });
          }

          const unitsDiff = Math.abs((v1Holding.quantity || 0) - (v2Holding.quantity || 0));
          if (unitsDiff > 0.01) {
            discrepancies.push({
              field: 'units_mismatch',
              v1Value: v1Holding.quantity,
              v2Value: v2Holding.quantity,
              isin,
            });
          }
        }
      }
    }

    const matchedCount = v1Holdings.length - discrepancies.filter(d => d.field === 'missing_holding').length;
    const matchPercentage = v1Holdings.length > 0 
      ? (matchedCount / v1Holdings.length) * 100 
      : 100;

    const v1Confidence = v1Result?.confidenceScore || 0.5;
    const v2Confidence = v2Result?.confidenceScore || 0.5;

    let preferredVersion: ParserVersion = 'v1';
    let reason = 'Default to v1 for stability';

    if (v2Confidence > v1Confidence + 0.1 && discrepancies.length < 3) {
      preferredVersion = 'v2';
      reason = 'v2 has higher confidence with minimal discrepancies';
    } else if (matchPercentage < 90 && v2Holdings.length > v1Holdings.length) {
      preferredVersion = 'v2';
      reason = 'v2 extracted more holdings';
    }

    const comparison: ParserComparisonResult = {
      v1HoldingsCount: v1Holdings.length,
      v2HoldingsCount: v2Holdings.length,
      v1TotalValue: v1Total,
      v2TotalValue: v2Total,
      matchPercentage,
      discrepancies,
      v1Confidence,
      v2Confidence,
      preferredVersion,
      reason,
    };

    if (currentConfig.logComparisons) {
      console.log('[Parser v2] Comparison result:', {
        v1Holdings: comparison.v1HoldingsCount,
        v2Holdings: comparison.v2HoldingsCount,
        matchPct: comparison.matchPercentage.toFixed(1),
        preferred: comparison.preferredVersion,
        reason: comparison.reason,
      });
    }

    return comparison;
  }

  clearProfileCache(): void {
    profileCache.clear();
    console.log('[Parser v2] Profile cache cleared');
  }

  getProfileCacheStats(): { size: number; entries: string[] } {
    return {
      size: profileCache.size,
      entries: Array.from(profileCache.keys()).map(k => k.substring(0, 8)),
    };
  }

  /**
   * Check if rollback is active (forces v1 usage)
   */
  isRollbackActive(): boolean {
    return currentConfig.forceV1Fallback;
  }

  /**
   * Get the effective parser version based on config and rollback
   */
  getEffectiveVersion(): ParserVersion {
    if (currentConfig.forceV1Fallback) {
      return 'v1';
    }
    return currentConfig.version;
  }

  /**
   * Check if dual-run should be executed
   */
  shouldExecuteDualRun(): boolean {
    if (currentConfig.forceV1Fallback) {
      return false;
    }
    return currentConfig.enableDualRun || currentConfig.version === 'dual';
  }

  /**
   * Create audit record for parsing attempt
   */
  createAuditRecord(
    profile: PDFProfile | null,
    result: {
      success: boolean;
      holdingsCount: number;
      totalValue: number;
      confidenceScore: number;
      errors: string[];
      warnings: string[];
      parseTimeMs: number;
    },
    options?: {
      userId?: string;
      agentId?: string;
      fileName?: string;
      fileSize?: number;
      dualRunEnabled?: boolean;
      comparison?: ParserComparisonResult;
    }
  ): any {
    const auditRecord = {
      profileId: profile?.id || null,
      fingerprint: profile?.fingerprint || null,
      fileName: options?.fileName,
      fileSize: options?.fileSize,
      parserVersion: this.getEffectiveVersion(),
      parsingStrategy: profile?.pdfType || 'unknown',
      parseTimeMs: result.parseTimeMs,
      success: result.success,
      holdingsExtracted: result.holdingsCount,
      totalValueExtracted: result.totalValue,
      confidenceScore: result.confidenceScore,
      errors: result.errors,
      warnings: result.warnings,
      dualRunEnabled: options?.dualRunEnabled || false,
      v1HoldingsCount: options?.comparison?.v1HoldingsCount,
      v2HoldingsCount: options?.comparison?.v2HoldingsCount,
      matchPercentage: options?.comparison?.matchPercentage,
      preferredVersion: options?.comparison?.preferredVersion,
      comparisonDiscrepancies: options?.comparison?.discrepancies,
      requiresEnrichment: profile?.pdfType === 'summary_only',
      createdAt: new Date().toISOString(),
    };

    console.log('[Parser v2] Audit record created:', {
      success: auditRecord.success,
      holdings: auditRecord.holdingsExtracted,
      confidence: auditRecord.confidenceScore,
      version: auditRecord.parserVersion,
    });

    return auditRecord;
  }
}

export const pdfParserV2Service = PDFParserV2Service.getInstance();
