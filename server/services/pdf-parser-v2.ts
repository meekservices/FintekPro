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

// Phase 2: Layout Segmentation Types
export type PageZone = 'header' | 'body' | 'footer' | 'sidebar';

export interface PageSection {
  zone: PageZone;
  startLine: number;
  endLine: number;
  content: string;
  confidence: number;
}

export interface AMCBlock {
  amcName: string;
  folioNumber?: string;
  panNumber?: string;
  holdings: SemanticHolding[];
  startLine: number;
  endLine: number;
  registrar?: 'CAMS' | 'KFINTECH' | 'FRANKLIN' | 'OTHER';
}

export interface SemanticHolding {
  schemeName: string;
  isin?: string;
  folioNumber?: string;
  units: number;
  nav?: number;
  investedValue?: number;
  currentValue?: number;
  purchaseDate?: string;
  purchaseDateSource?: 'explicit' | 'transaction' | 'sip_first' | 'unresolved';
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
  confidenceScore: number;
  sourceLines: number[];
  requiresEnrichment: boolean;
  enrichmentReason?: string;
}

export interface TransactionRow {
  date: string;
  description: string;
  type: 'purchase' | 'sip' | 'switch_in' | 'switch_out' | 'redemption' | 'dividend' | 'bonus' | 'unknown';
  units: number;
  nav: number;
  amount: number;
  runningBalance?: number;
  isZeroAmount: boolean;
  isMultiLine: boolean;
  rawLines: string[];
  lineNumbers: number[];
}

export interface LayoutAnalysis {
  pages: Array<{
    pageNumber: number;
    sections: PageSection[];
    amcBlocks: AMCBlock[];
    hasTableStructure: boolean;
    continuationFromPrevious: boolean;
  }>;
  totalAMCBlocks: number;
  totalHoldingsFound: number;
  totalTransactionsFound: number;
  layoutConfidence: number;
}

export interface SemanticExtractionResult {
  holdings: SemanticHolding[];
  transactions: TransactionRow[];
  investor: {
    name?: string;
    pan?: string;
    email?: string;
    mobile?: string;
    address?: string;
  };
  unresolvedItems: Array<{
    type: 'date' | 'isin' | 'value' | 'folio' | 'units';
    description: string;
    affectedHoldings: string[];
    sourceLine: number;
  }>;
  summaryDetected: boolean;
  requiresEnrichment: boolean;
  enrichmentReasons: string[];
}

// Phase 3: Holding Lots Types
export interface HoldingLot {
  id: string;
  purchaseDate: string;
  purchaseNav: number;
  purchaseValue: number;
  units: number;
  remainingUnits: number;
  source: 'purchase' | 'sip' | 'switch_in' | 'bonus';
  status: 'active' | 'partial' | 'redeemed';
  redemptionDate?: string;
  redemptionNav?: number;
  transactionRef?: string;
}

export interface LotGainAnalysis {
  lotId: string;
  units: number;
  purchaseDate: string;
  purchaseNav: number;
  purchaseValue: number;
  currentNav: number;
  currentValue: number;
  absoluteGain: number;
  percentGain: number;
  holdingPeriodDays: number;
  isLongTerm: boolean;
  taxImplication: 'STCG' | 'LTCG';
}

export interface SummaryPDFAnalysis {
  isSummaryOnly: boolean;
  hasTransactionHistory: boolean;
  hasDetailedHoldings: boolean;
  aggregatorType: 'wealthy' | 'mfcentral' | 'generic_tracker' | null;
  requiresEnrichment: boolean;
  enrichmentSources: string[];
  confidence: number;
}

// Phase 4: Confidence Scoring Types
export interface ConfidenceScoreBreakdown {
  overall: number;
  components: {
    isinMatch: number;
    dateResolution: number;
    valueAccuracy: number;
    sourceQuality: number;
    unitBalance: number;
  };
  flags: string[];
  recommendations: string[];
}

// Phase 4: Learning Store Types
export interface LearnedPattern {
  fingerprint: string;
  pdfType: PDFType;
  layoutType: LayoutType;
  headerPatterns: string[];
  columnOrder: string[];
  successCount: number;
  lastUsed: string;
  avgHoldingsCount: number;
  avgConfidenceScore: number;
}

// Phase 5: Observability Types
export interface ParsingLogEntry {
  timestamp: string;
  eventType: string;
  sessionId: string;
  fingerprint?: string;
  pdfType?: PDFType;
  holdingsCount?: number;
  transactionsCount?: number;
  confidenceScore?: number;
  parseTimeMs?: number;
  errors?: string[];
  warnings?: string[];
  enrichmentReasons?: string[];
}

export interface ParsingMetrics {
  timeWindowHours: number;
  totalParses: number;
  successRate: number;
  errorRate: number;
  avgParseTimeMs: number;
  byPdfType: Record<string, { count: number; avgConfidence: number }>;
  enrichmentNeededCount: number;
  patternMatchRate: number;
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
  unresolvedItems: Array<{
    type: 'date' | 'isin' | 'value' | 'folio' | 'units';
    description: string;
    affectedHoldings: string[];
    sourceLine?: number;
  }>;
  holdingLots?: HoldingLot[];
  summaryAnalysis?: SummaryPDFAnalysis;
  layoutAnalysis?: LayoutAnalysis;
  semanticResult?: SemanticExtractionResult;
}

const DEFAULT_CONFIG: ParserConfig = {
  version: 'v2',
  enableDualRun: false,
  enableLearning: true,
  enableConfidenceScoring: true,
  logComparisons: true,
  forceV1Fallback: false,
  minConfidenceThreshold: 0.5,
};

let currentConfig: ParserConfig = { ...DEFAULT_CONFIG };

const profileCache = new Map<string, PDFProfile>();
const PROFILE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Learning Store - in-memory (would persist to pdf_profiles table)
const learnedPatterns = new Map<string, LearnedPattern>();

// Parsing History - in-memory for observability (would persist to pdf_parsing_audit_trail)
const parsingHistory: ParsingLogEntry[] = [];

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

  /**
   * Full v2 parsing pipeline with integrated logging and metrics
   */
  async parseDocumentV2(buffer: Buffer, options?: {
    fileName?: string;
    userId?: string;
    agentId?: string;
  }): Promise<V2ParseResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    // Log parse start
    this.createParsingLog('parse_start', {
      fingerprint: undefined,
      pdfType: undefined,
    });

    try {
      // Step 1: Profile the document
      const profile = await this.profileDocument(buffer);

      // Log pattern matching
      const matchedPattern = this.findMatchingPattern(profile);
      if (matchedPattern) {
        this.createParsingLog('pattern_matched', {
          fingerprint: profile.fingerprint,
          pdfType: profile.pdfType,
        });
      }

      // Step 2: Extract text
      const parseResult = await pdfParserService.extractTextSafe(buffer);
      if (!parseResult.success || !parseResult.result) {
        throw new Error(parseResult.error || 'Failed to extract PDF text');
      }
      const text = parseResult.result.text;

      // Step 3: Layout analysis
      const layoutAnalysis = this.analyzeLayout(text);

      // Step 4: Semantic extraction (pass profile for proper summary detection)
      const semanticResult = this.extractSemanticData(text, layoutAnalysis, profile);

      // Step 5: Resolve purchase dates
      const holdingsWithDates = this.resolvePurchaseDates(
        semanticResult.holdings,
        semanticResult.transactions
      );

      // Step 6: Build holding lots
      const holdingLots = this.buildHoldingLots(semanticResult.transactions);

      // Step 7: Calculate confidence score
      const unitBalanceValidation = this.validateUnitBalance(semanticResult.transactions);
      const confidenceBreakdown = this.calculateConfidenceScore(
        holdingsWithDates,
        semanticResult.transactions,
        profile,
        { unitBalanceValid: unitBalanceValidation.valid }
      );

      // Step 8: Summary PDF detection
      const summaryAnalysis = this.detectSummaryPDF(text, profile);

      // Compile warnings
      if (confidenceBreakdown.flags.length > 0) {
        warnings.push(...confidenceBreakdown.flags);
      }
      if (!unitBalanceValidation.valid) {
        warnings.push(`Unit balance discrepancies: ${unitBalanceValidation.discrepancies.length}`);
      }

      // Build result
      const result: V2ParseResult = {
        success: true,
        profile,
        holdings: holdingsWithDates,
        transactions: semanticResult.transactions,
        investor: semanticResult.investor,
        summary: {
          totalHoldings: holdingsWithDates.length,
          totalInvestedValue: holdingsWithDates.reduce((sum, h) => sum + (h.investedValue || 0), 0),
          totalCurrentValue: holdingsWithDates.reduce((sum, h) => sum + (h.currentValue || 0), 0),
          totalUnrealizedGain: holdingsWithDates.reduce((sum, h) => sum + (h.unrealizedGain || 0), 0),
        },
        confidenceScore: confidenceBreakdown.overall,
        parsingMetrics: {
          parseTimeMs: Date.now() - startTime,
          pagesProcessed: layoutAnalysis.pages.length,
          blocksDetected: layoutAnalysis.totalAMCBlocks,
          validationsPassed: confidenceBreakdown.flags.filter(f => !f.startsWith('LOW_')).length,
          validationsFailed: confidenceBreakdown.flags.filter(f => f.startsWith('LOW_') || f === 'BELOW_THRESHOLD').length,
        },
        errors,
        warnings,
        requiresEnrichment: summaryAnalysis.requiresEnrichment || semanticResult.requiresEnrichment,
        unresolvedItems: semanticResult.unresolvedItems,
        holdingLots,
        summaryAnalysis,
        layoutAnalysis,
        semanticResult,
      };

      // Learn from successful parse
      if (result.success && result.confidenceScore >= 0.7) {
        await this.storeLearnedPattern(profile, {
          success: true,
          holdingsCount: result.holdings.length,
          confidenceScore: result.confidenceScore,
        });
      }

      // Log enrichment needed
      if (result.requiresEnrichment) {
        this.createParsingLog('enrichment_needed', {
          fingerprint: profile.fingerprint,
          pdfType: profile.pdfType,
          holdingsCount: result.holdings.length,
          enrichmentReasons: summaryAnalysis.enrichmentSources,
        });
      }

      // Log parse complete
      this.createParsingLog('parse_complete', {
        fingerprint: profile.fingerprint,
        pdfType: profile.pdfType,
        holdingsCount: result.holdings.length,
        transactionsCount: result.transactions.length,
        confidenceScore: result.confidenceScore,
        parseTimeMs: result.parsingMetrics.parseTimeMs,
        warnings,
      });

      return result;

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown parsing error';
      errors.push(errorMessage);

      // Log parse error
      this.createParsingLog('parse_error', {
        errors: [errorMessage],
        parseTimeMs: Date.now() - startTime,
      });

      return {
        success: false,
        profile: {} as PDFProfile,
        holdings: [],
        transactions: [],
        investor: {},
        summary: {
          totalHoldings: 0,
          totalInvestedValue: 0,
          totalCurrentValue: 0,
          totalUnrealizedGain: 0,
        },
        confidenceScore: 0,
        parsingMetrics: {
          parseTimeMs: Date.now() - startTime,
          pagesProcessed: 0,
          blocksDetected: 0,
          validationsPassed: 0,
          validationsFailed: 0,
        },
        errors,
        warnings,
        requiresEnrichment: false,
        unresolvedItems: [],
      };
    }
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

  // ============================================
  // PHASE 2: LAYOUT SEGMENTATION
  // ============================================

  /**
   * Analyze document layout - identify page zones, AMC blocks, and structure
   */
  analyzeLayout(text: string): LayoutAnalysis {
    const lines = text.split('\n');
    const pages = this.splitIntoPages(lines);
    const analysisResult: LayoutAnalysis = {
      pages: [],
      totalAMCBlocks: 0,
      totalHoldingsFound: 0,
      totalTransactionsFound: 0,
      layoutConfidence: 0,
    };

    let previousPageHadContinuation = false;

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const pageLines = pages[pageIdx];
      const sections = this.identifyPageZones(pageLines, pageIdx);
      const amcBlocks = this.detectAMCBlocks(pageLines, pageIdx);
      const hasTable = this.detectTableInSection(pageLines.join('\n'));
      const isContinuation = previousPageHadContinuation || this.detectContinuation(pageLines);

      analysisResult.pages.push({
        pageNumber: pageIdx + 1,
        sections,
        amcBlocks,
        hasTableStructure: hasTable,
        continuationFromPrevious: isContinuation,
      });

      analysisResult.totalAMCBlocks += amcBlocks.length;
      amcBlocks.forEach(block => {
        analysisResult.totalHoldingsFound += block.holdings.length;
      });

      // Count transactions in this page
      const pageText = pageLines.join('\n');
      const transactionCount = this.countTransactionsInPage(pageText);
      analysisResult.totalTransactionsFound += transactionCount;

      previousPageHadContinuation = this.endsWithContinuation(pageLines);
    }

    analysisResult.layoutConfidence = this.calculateLayoutConfidence(analysisResult);

    console.log('[Parser v2] Layout analysis complete:', {
      pages: analysisResult.pages.length,
      amcBlocks: analysisResult.totalAMCBlocks,
      holdings: analysisResult.totalHoldingsFound,
      transactions: analysisResult.totalTransactionsFound,
      confidence: analysisResult.layoutConfidence.toFixed(2),
    });

    return analysisResult;
  }

  private splitIntoPages(lines: string[]): string[][] {
    const pages: string[][] = [];
    let currentPage: string[] = [];

    const pageBreakPatterns = [
      /^page\s*\d+\s*(of\s*\d+)?$/i,
      /^\s*-\s*\d+\s*-\s*$/,
      /\f/,  // Form feed character
      /^.*continued\s+on\s+next\s+page.*$/i,
    ];

    for (const line of lines) {
      const isPageBreak = pageBreakPatterns.some(p => p.test(line.trim()));
      
      if (isPageBreak && currentPage.length > 10) {
        pages.push(currentPage);
        currentPage = [];
      } else {
        currentPage.push(line);
      }
    }

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages.length > 0 ? pages : [lines];
  }

  private identifyPageZones(lines: string[], pageIndex: number): PageSection[] {
    const sections: PageSection[] = [];
    const lineCount = lines.length;

    if (lineCount === 0) return sections;

    // Header zone: typically first 5-15% of page with logos, dates, titles
    const headerEndIdx = Math.min(Math.floor(lineCount * 0.15), 20);
    const headerContent = lines.slice(0, headerEndIdx).join('\n');
    
    if (this.isHeaderContent(headerContent)) {
      sections.push({
        zone: 'header',
        startLine: 0,
        endLine: headerEndIdx,
        content: headerContent,
        confidence: 0.8,
      });
    }

    // Footer zone: typically last 5-10% with page numbers, disclaimers
    const footerStartIdx = Math.max(Math.floor(lineCount * 0.9), lineCount - 10);
    const footerContent = lines.slice(footerStartIdx).join('\n');

    if (this.isFooterContent(footerContent)) {
      sections.push({
        zone: 'footer',
        startLine: footerStartIdx,
        endLine: lineCount,
        content: footerContent,
        confidence: 0.8,
      });
    }

    // Body zone: everything between header and footer
    const bodyStart = headerEndIdx;
    const bodyEnd = footerStartIdx;
    
    if (bodyEnd > bodyStart) {
      sections.push({
        zone: 'body',
        startLine: bodyStart,
        endLine: bodyEnd,
        content: lines.slice(bodyStart, bodyEnd).join('\n'),
        confidence: 0.9,
      });
    }

    return sections;
  }

  private isHeaderContent(text: string): boolean {
    const headerIndicators = [
      /consolidated\s*account\s*statement/i,
      /statement\s*period/i,
      /statement\s*as\s*on/i,
      /mutual\s*fund/i,
      /portfolio\s*summary/i,
      /investor\s*name/i,
      /pan\s*:?\s*[A-Z]{5}\d{4}[A-Z]/i,
      /^(cams|kfintech|nsdl|cdsl)/i,
    ];
    return headerIndicators.some(p => p.test(text));
  }

  private isFooterContent(text: string): boolean {
    const footerIndicators = [
      /page\s*\d+/i,
      /disclaimer/i,
      /this\s*is\s*a\s*computer\s*generated/i,
      /mutual\s*fund\s*investments\s*are\s*subject/i,
      /please\s*read\s*scheme\s*information/i,
      /continued\s*(on\s*next|\.{2,})/i,
    ];
    return footerIndicators.some(p => p.test(text));
  }

  private detectAMCBlocks(lines: string[], pageOffset: number): AMCBlock[] {
    const blocks: AMCBlock[] = [];
    
    const amcPatterns = [
      { pattern: /^(.*?)\s*(mutual\s*fund|mf)\s*$/i, nameGroup: 1 },
      { pattern: /^amc\s*:\s*(.+)/i, nameGroup: 1 },
      { pattern: /^(hdfc|icici|sbi|axis|kotak|nippon|dsp|birla|tata|aditya|uti|franklin|mirae)\s*(.*mutual\s*fund)?/i, nameGroup: 0 },
    ];

    const folioPattern = /folio\s*(?:no\.?|number)?\s*:?\s*(\d+[\/\-]?\d*)/i;
    const panPattern = /pan\s*:?\s*([A-Z]{5}\d{4}[A-Z])/i;

    let currentBlock: AMCBlock | null = null;
    let blockStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for AMC header
      for (const { pattern, nameGroup } of amcPatterns) {
        const match = line.match(pattern);
        if (match) {
          // Save previous block
          if (currentBlock) {
            currentBlock.endLine = blockStartLine + i - 1;
            blocks.push(currentBlock);
          }
          
          currentBlock = {
            amcName: match[nameGroup === 0 ? 0 : 1]?.trim() || line,
            holdings: [],
            startLine: pageOffset * 1000 + i,
            endLine: pageOffset * 1000 + i,
            registrar: this.detectRegistrarFromAMC(line),
          };
          blockStartLine = i;
          break;
        }
      }

      // Extract folio number
      const folioMatch = line.match(folioPattern);
      if (folioMatch && currentBlock) {
        currentBlock.folioNumber = folioMatch[1];
      }

      // Extract PAN
      const panMatch = line.match(panPattern);
      if (panMatch && currentBlock) {
        currentBlock.panNumber = panMatch[1];
      }

      // Try to extract holdings within current block
      if (currentBlock) {
        const holding = this.extractHoldingFromLine(line, lines, i);
        if (holding) {
          currentBlock.holdings.push(holding);
        }
      }
    }

    // Don't forget the last block
    if (currentBlock) {
      currentBlock.endLine = pageOffset * 1000 + lines.length;
      blocks.push(currentBlock);
    }

    return blocks;
  }

  private detectRegistrarFromAMC(text: string): 'CAMS' | 'KFINTECH' | 'FRANKLIN' | 'OTHER' {
    const camsAMCs = /hdfc|icici|axis|dsp|birla|aditya|sundaram|invesco|boi|ppfas|quant/i;
    const kfintechAMCs = /sbi|nippon|kotak|tata|uti|mirae|motilal|edelweiss|canara/i;
    const franklinAMCs = /franklin|templeton/i;

    if (camsAMCs.test(text)) return 'CAMS';
    if (kfintechAMCs.test(text)) return 'KFINTECH';
    if (franklinAMCs.test(text)) return 'FRANKLIN';
    return 'OTHER';
  }

  private countTransactionsInPage(text: string): number {
    // Count transaction-like lines (date + transaction type indicators)
    const datePattern = /\d{1,2}[-\/](?:\w{3}|\d{1,2})[-\/]\d{2,4}/g;
    const transactionKeywords = /purchase|sip|redemption|switch\s*(in|out)|dividend|bonus/gi;
    
    const dateMatches = text.match(datePattern) || [];
    const keywordMatches = text.match(transactionKeywords) || [];
    
    // Estimate transaction count as minimum of dates and keywords found
    return Math.min(dateMatches.length, Math.max(keywordMatches.length, 1));
  }

  private extractHoldingFromLine(line: string, allLines: string[], lineIndex: number): SemanticHolding | null {
    // Skip empty lines and headers
    if (!line || line.length < 10) return null;

    // ISIN pattern
    const isinMatch = line.match(/INF[A-Z0-9]{9}/);
    
    // Value patterns - numbers with commas
    const valuePatterns = line.match(/[\d,]+\.\d{2}/g) || [];
    
    // Units pattern - typically decimal with 3-4 places
    const unitsMatch = line.match(/(\d+\.\d{3,4})/);

    // If we have ISIN or significant numeric values, this might be a holding
    if (isinMatch || valuePatterns.length >= 2) {
      // Look for scheme name in previous lines if not on this line
      let schemeName = '';
      const schemePatterns = [
        /^([A-Z][A-Za-z\s\-&]+(?:fund|plan|growth|dividend|direct|regular|option|hybrid|equity|debt|liquid|balanced))/i,
      ];

      // Check current line and previous lines for scheme name
      for (let offset = 0; offset >= -3 && lineIndex + offset >= 0; offset--) {
        const checkLine = allLines[lineIndex + offset]?.trim() || '';
        for (const pattern of schemePatterns) {
          const match = checkLine.match(pattern);
          if (match) {
            schemeName = match[1].trim();
            break;
          }
        }
        if (schemeName) break;
      }

      if (!schemeName && valuePatterns.length >= 2) {
        // Extract scheme name from line start
        const nameMatch = line.match(/^([A-Za-z][A-Za-z\s\-&]+?)(?:\s+INF|\s+\d)/);
        schemeName = nameMatch?.[1]?.trim() || '';
      }

      if (schemeName || isinMatch) {
        const values = valuePatterns.map(v => parseFloat(v.replace(/,/g, '')));
        
        return {
          schemeName: schemeName || 'Unknown Scheme',
          isin: isinMatch?.[0],
          units: unitsMatch ? parseFloat(unitsMatch[1]) : 0,
          investedValue: values[0],
          currentValue: values[values.length > 1 ? values.length - 1 : 0],
          confidenceScore: isinMatch ? 0.8 : 0.5,
          sourceLines: [lineIndex],
          requiresEnrichment: !isinMatch,
          enrichmentReason: !isinMatch ? 'Missing ISIN' : undefined,
        };
      }
    }

    return null;
  }

  private detectTableInSection(text: string): boolean {
    const tableIndicators = [
      /folio\s*no\.?.*scheme\s*name.*unit/i,
      /isin.*nav.*market\s*value/i,
      /scheme.*cost.*current/i,
      /\|\s*\w+\s*\|\s*\w+\s*\|/,  // Pipe-separated tables
    ];
    return tableIndicators.some(p => p.test(text));
  }

  private detectContinuation(lines: string[]): boolean {
    const firstLines = lines.slice(0, 5).join(' ');
    return /continued\s*from\s*previous/i.test(firstLines) ||
           /\.\.\.\s*cont/i.test(firstLines);
  }

  private endsWithContinuation(lines: string[]): boolean {
    const lastLines = lines.slice(-5).join(' ');
    return /continued\s*on\s*next/i.test(lastLines) ||
           /cont\.{2,}/i.test(lastLines);
  }

  private calculateLayoutConfidence(analysis: LayoutAnalysis): number {
    let score = 0.5;

    if (analysis.totalAMCBlocks > 0) score += 0.2;
    if (analysis.totalHoldingsFound > 0) score += 0.15;
    
    const pagesWithBody = analysis.pages.filter(p => 
      p.sections.some(s => s.zone === 'body')
    ).length;
    if (pagesWithBody === analysis.pages.length) score += 0.1;

    const pagesWithTable = analysis.pages.filter(p => p.hasTableStructure).length;
    if (pagesWithTable > 0) score += 0.05;

    return Math.min(score, 1.0);
  }

  // ============================================
  // PHASE 2: SEMANTIC BLOCK DETECTION
  // ============================================

  /**
   * Extract semantic entities with version-tolerant matching
   */
  extractSemanticData(text: string, layout: LayoutAnalysis, profile?: PDFProfile): SemanticExtractionResult {
    const result: SemanticExtractionResult = {
      holdings: [],
      transactions: [],
      investor: {},
      unresolvedItems: [],
      summaryDetected: false,
      requiresEnrichment: false,
      enrichmentReasons: [],
    };

    // Extract investor info
    result.investor = this.extractInvestorInfo(text);

    // Extract from AMC blocks
    for (const page of layout.pages) {
      for (const block of page.amcBlocks) {
        result.holdings.push(...block.holdings.map(h => ({
          ...h,
          folioNumber: h.folioNumber || block.folioNumber,
        })));
      }
    }

    // Extract transactions
    result.transactions = this.extractTransactions(text);

    // Detect summary-only PDF using unified detectSummaryPDF
    // Only run summary detection if profile is provided (use parseDocumentV2 for full detection)
    if (profile) {
      const summaryAnalysis = this.detectSummaryPDF(text, profile);
      result.summaryDetected = summaryAnalysis.isSummaryOnly;
      if (summaryAnalysis.requiresEnrichment) {
        result.requiresEnrichment = true;
        result.enrichmentReasons.push(...summaryAnalysis.enrichmentSources.map(s => 
          `Enrichment suggested: ${s}`
        ));
        if (!summaryAnalysis.hasTransactionHistory) {
          result.enrichmentReasons.push('Summary PDF detected - no transaction history');
        }
      }
    } else {
      // Basic summary detection without profile
      result.summaryDetected = result.transactions.length === 0 && result.holdings.length > 0;
      if (result.summaryDetected) {
        result.requiresEnrichment = true;
        result.enrichmentReasons.push('Summary PDF detected - no transaction history');
      }
    }

    // Flag unresolved items
    for (const holding of result.holdings) {
      if (!holding.isin) {
        result.unresolvedItems.push({
          type: 'isin',
          description: `Missing ISIN for scheme: ${holding.schemeName}`,
          affectedHoldings: [holding.schemeName],
          sourceLine: holding.sourceLines[0] || 0,
        });
      }
      if (holding.purchaseDateSource === 'unresolved') {
        result.unresolvedItems.push({
          type: 'date',
          description: `Cannot resolve purchase date for: ${holding.schemeName}`,
          affectedHoldings: [holding.schemeName],
          sourceLine: holding.sourceLines[0] || 0,
        });
      }
    }

    // Mark holdings that need enrichment
    const holdingsNeedingEnrichment = result.holdings.filter(h => h.requiresEnrichment);
    if (holdingsNeedingEnrichment.length > 0) {
      result.requiresEnrichment = true;
      result.enrichmentReasons.push(
        `${holdingsNeedingEnrichment.length} holdings need ISIN/data enrichment`
      );
    }

    console.log('[Parser v2] Semantic extraction:', {
      holdings: result.holdings.length,
      transactions: result.transactions.length,
      unresolvedItems: result.unresolvedItems.length,
      requiresEnrichment: result.requiresEnrichment,
    });

    return result;
  }

  private extractInvestorInfo(text: string): SemanticExtractionResult['investor'] {
    const investor: SemanticExtractionResult['investor'] = {};

    // PAN extraction with multiple format support
    const panPatterns = [
      /pan\s*:?\s*([A-Z]{5}\d{4}[A-Z])/i,
      /permanent\s*account\s*number\s*:?\s*([A-Z]{5}\d{4}[A-Z])/i,
    ];
    for (const pattern of panPatterns) {
      const match = text.match(pattern);
      if (match) {
        investor.pan = match[1];
        break;
      }
    }

    // Name extraction
    const namePatterns = [
      /investor\s*name\s*:?\s*(.+?)(?:\n|pan|email)/i,
      /name\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})(?:\s|\n)/,
      /dear\s+(?:mr\.?|mrs\.?|ms\.?|shri|smt\.?)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/i,
    ];
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        investor.name = match[1].trim();
        break;
      }
    }

    // Email extraction
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
    if (emailMatch) {
      investor.email = emailMatch[0];
    }

    // Mobile extraction
    const mobilePatterns = [
      /mobile\s*:?\s*(\+?91[-\s]?\d{10})/i,
      /phone\s*:?\s*(\+?91[-\s]?\d{10})/i,
      /(?<!\d)(\+?91[-\s]?\d{10})(?!\d)/,
    ];
    for (const pattern of mobilePatterns) {
      const match = text.match(pattern);
      if (match) {
        investor.mobile = match[1].replace(/[-\s]/g, '');
        break;
      }
    }

    return investor;
  }

  private detectSummaryOnlyPDF(text: string, holdings: SemanticHolding[]): boolean {
    // Summary PDFs typically have aggregated values without transactions
    const summaryIndicators = [
      /portfolio\s*summary/i,
      /consolidated\s*summary/i,
      /asset\s*allocation.*summary/i,
    ];

    const hasTransactionSection = /transaction\s*(detail|history|statement)/i.test(text);
    const hasSummaryIndicator = summaryIndicators.some(p => p.test(text));
    
    // If no transaction data and has summary indicators
    if (hasSummaryIndicator && !hasTransactionSection) {
      return true;
    }

    // If holdings don't have purchase dates and no transactions found
    const holdingsWithoutDates = holdings.filter(h => !h.purchaseDate || h.purchaseDateSource === 'unresolved');
    if (holdingsWithoutDates.length === holdings.length && holdings.length > 0) {
      return true;
    }

    return false;
  }

  // ============================================
  // PHASE 2: TRANSACTION INTELLIGENCE
  // ============================================

  /**
   * Extract transactions with multi-line handling and validation
   */
  extractTransactions(text: string): TransactionRow[] {
    const transactions: TransactionRow[] = [];
    const lines = text.split('\n');
    
    const transactionPatterns = {
      purchase: /^(purchase|buy|subscription)/i,
      sip: /^(sip|systematic\s*investment)/i,
      switch_in: /^(switch\s*in|transfer\s*in)/i,
      switch_out: /^(switch\s*out|transfer\s*out)/i,
      redemption: /^(redemption|redeem|withdrawal|sell)/i,
      dividend: /^(dividend|distribution)/i,
      bonus: /^(bonus)/i,
    };

    const datePattern = /(\d{1,2}[-\/]\w{3}[-\/]\d{2,4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/;
    const valuePattern = /[\d,]+\.\d{2}/g;
    const unitsPattern = /(\d+\.\d{3,4})/;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Check if this line starts a transaction
      const dateMatch = line.match(datePattern);
      if (!dateMatch) {
        i++;
        continue;
      }

      // Determine transaction type
      let txType: TransactionRow['type'] = 'unknown';
      for (const [type, pattern] of Object.entries(transactionPatterns)) {
        if (pattern.test(line)) {
          txType = type as TransactionRow['type'];
          break;
        }
      }

      // Handle multi-line transactions
      const rawLines: string[] = [line];
      const lineNumbers: number[] = [i];
      let fullLine = line;

      // Check if next lines are continuations (no date, but have values)
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (!nextLine || datePattern.test(nextLine) || nextLine.length < 5) {
          break;
        }
        // If next line has numeric values but no date, it's a continuation
        if (valuePattern.test(nextLine) || /^\s{10,}/.test(lines[i + 1])) {
          rawLines.push(nextLine);
          lineNumbers.push(i + 1);
          fullLine += ' ' + nextLine;
          i++;
        } else {
          break;
        }
      }

      // Extract values from combined line
      const values = (fullLine.match(valuePattern) || []).map(v => parseFloat(v.replace(/,/g, '')));
      const unitsMatch = fullLine.match(unitsPattern);

      // Validate and create transaction
      const units = unitsMatch ? parseFloat(unitsMatch[1]) : 0;
      const amount = values[values.length - 1] || 0;
      const nav = values.length >= 2 ? values[values.length - 2] : 0;

      const transaction: TransactionRow = {
        date: dateMatch[1],
        description: fullLine.substring(0, 100),
        type: txType,
        units,
        nav,
        amount,
        isZeroAmount: amount === 0,
        isMultiLine: rawLines.length > 1,
        rawLines,
        lineNumbers,
      };

      // Validate transaction
      if (this.validateTransaction(transaction)) {
        transactions.push(transaction);
      }

      i++;
    }

    console.log(`[Parser v2] Extracted ${transactions.length} transactions`);
    return transactions;
  }

  private validateTransaction(tx: TransactionRow): boolean {
    // Zero-amount transactions might be valid (bonus, dividend reinvest)
    if (tx.isZeroAmount && tx.type !== 'bonus' && tx.type !== 'dividend') {
      return false;
    }

    // Must have either units or amount
    if (tx.units === 0 && tx.amount === 0) {
      return false;
    }

    // Date must be parseable
    if (!tx.date || tx.date.length < 6) {
      return false;
    }

    return true;
  }

  /**
   * Validate unit balance consistency across transactions
   */
  validateUnitBalance(transactions: TransactionRow[]): {
    valid: boolean;
    discrepancies: Array<{ date: string; expected: number; actual: number }>;
  } {
    let runningBalance = 0;
    const discrepancies: Array<{ date: string; expected: number; actual: number }> = [];

    // Sort by date
    const sorted = [...transactions].sort((a, b) => {
      const dateA = new Date(a.date.replace(/(\d{2})[-\/](\w{3})[-\/](\d{2,4})/, '$2 $1, $3'));
      const dateB = new Date(b.date.replace(/(\d{2})[-\/](\w{3})[-\/](\d{2,4})/, '$2 $1, $3'));
      return dateA.getTime() - dateB.getTime();
    });

    for (const tx of sorted) {
      const expectedBalance = runningBalance;
      
      if (['purchase', 'sip', 'switch_in', 'bonus'].includes(tx.type)) {
        runningBalance += tx.units;
      } else if (['redemption', 'switch_out'].includes(tx.type)) {
        runningBalance -= tx.units;
      }

      if (tx.runningBalance !== undefined && Math.abs(tx.runningBalance - runningBalance) > 0.01) {
        discrepancies.push({
          date: tx.date,
          expected: runningBalance,
          actual: tx.runningBalance,
        });
      }
    }

    return {
      valid: discrepancies.length === 0,
      discrepancies,
    };
  }

  // ============================================
  // PHASE 3: PURCHASE DATE ENGINE
  // ============================================

  /**
   * Resolve purchase dates for holdings using transaction analysis
   * - Switch-In treated as fresh purchase
   * - SIP: use first SIP date
   * - Flag unresolved dates
   */
  resolvePurchaseDates(
    holdings: SemanticHolding[],
    transactions: TransactionRow[]
  ): SemanticHolding[] {
    const holdingsByScheme = new Map<string, SemanticHolding>();
    holdings.forEach(h => holdingsByScheme.set(h.schemeName.toLowerCase(), h));

    // Group transactions by scheme
    const txByScheme = new Map<string, TransactionRow[]>();
    for (const tx of transactions) {
      const schemeName = this.normalizeSchemeNameForMatch(tx.description);
      if (!txByScheme.has(schemeName)) {
        txByScheme.set(schemeName, []);
      }
      txByScheme.get(schemeName)!.push(tx);
    }

    // Process each holding
    for (const [schemeName, holding] of holdingsByScheme) {
      const schemeTxs = txByScheme.get(schemeName) || [];
      
      if (schemeTxs.length === 0) {
        // No transactions found - mark as unresolved
        holding.purchaseDateSource = 'unresolved';
        continue;
      }

      // Sort transactions by date (oldest first)
      const sortedTxs = this.sortTransactionsByDate(schemeTxs);

      // Find the effective purchase date
      const purchaseInfo = this.findEffectivePurchaseDate(sortedTxs);
      
      holding.purchaseDate = purchaseInfo.date;
      holding.purchaseDateSource = purchaseInfo.source;

      console.log(`[Parser v2] Purchase date for ${schemeName}:`, purchaseInfo);
    }

    return holdings;
  }

  private normalizeSchemeNameForMatch(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s*(growth|dividend|direct|regular|option|plan|idcw).*$/i, '')
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 30);
  }

  private sortTransactionsByDate(transactions: TransactionRow[]): TransactionRow[] {
    return [...transactions].sort((a, b) => {
      const dateA = this.parseTransactionDate(a.date);
      const dateB = this.parseTransactionDate(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  }

  private parseTransactionDate(dateStr: string): Date {
    // Handle formats: DD-MMM-YYYY, DD/MM/YYYY, DD-MM-YYYY
    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    // DD-MMM-YYYY format
    const dmy = dateStr.match(/(\d{1,2})[-\/](\w{3})[-\/](\d{2,4})/);
    if (dmy) {
      const day = parseInt(dmy[1]);
      const month = monthMap[dmy[2].toLowerCase()] || 0;
      let year = parseInt(dmy[3]);
      if (year < 100) year += 2000;
      return new Date(year, month, day);
    }

    // DD/MM/YYYY format
    const numeric = dateStr.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
    if (numeric) {
      const day = parseInt(numeric[1]);
      const month = parseInt(numeric[2]) - 1;
      let year = parseInt(numeric[3]);
      if (year < 100) year += 2000;
      return new Date(year, month, day);
    }

    return new Date();
  }

  private findEffectivePurchaseDate(sortedTxs: TransactionRow[]): {
    date: string;
    source: SemanticHolding['purchaseDateSource'];
  } {
    // Priority 1: Switch-In is treated as a fresh purchase
    const switchIn = sortedTxs.find(tx => tx.type === 'switch_in');
    if (switchIn) {
      return { date: switchIn.date, source: 'transaction' };
    }

    // Priority 2: First SIP transaction
    const firstSIP = sortedTxs.find(tx => tx.type === 'sip');
    if (firstSIP) {
      return { date: firstSIP.date, source: 'sip_first' };
    }

    // Priority 3: First purchase transaction
    const firstPurchase = sortedTxs.find(tx => tx.type === 'purchase');
    if (firstPurchase) {
      return { date: firstPurchase.date, source: 'transaction' };
    }

    // Priority 4: Any first transaction that adds units
    const addingTx = sortedTxs.find(tx => 
      ['purchase', 'sip', 'switch_in', 'bonus'].includes(tx.type)
    );
    if (addingTx) {
      return { date: addingTx.date, source: 'transaction' };
    }

    // Unable to resolve
    return { date: '', source: 'unresolved' };
  }

  // ============================================
  // PHASE 3: HOLDING LOTS BUILDER
  // ============================================

  /**
   * Build holding lots from transactions for lot-level tracking
   * Uses FIFO method by default
   */
  buildHoldingLots(
    transactions: TransactionRow[],
    method: 'fifo' | 'lifo' = 'fifo'
  ): HoldingLot[] {
    const lots: HoldingLot[] = [];
    
    // Sort transactions chronologically
    const sortedTxs = this.sortTransactionsByDate(transactions);

    for (const tx of sortedTxs) {
      if (['purchase', 'sip', 'switch_in', 'bonus'].includes(tx.type)) {
        // Create new lot
        const lot: HoldingLot = {
          id: crypto.randomUUID(),
          purchaseDate: tx.date,
          purchaseNav: tx.nav,
          purchaseValue: tx.amount,
          units: tx.units,
          remainingUnits: tx.units,
          source: tx.type === 'sip' ? 'sip' : tx.type === 'switch_in' ? 'switch_in' : 'purchase',
          status: 'active',
          transactionRef: tx.lineNumbers[0]?.toString(),
        };
        lots.push(lot);
      } else if (['redemption', 'switch_out'].includes(tx.type)) {
        // Deplete lots using FIFO/LIFO
        let unitsToDeplete = tx.units;
        const sortedLots = method === 'fifo' 
          ? lots.filter(l => l.remainingUnits > 0).sort((a, b) => 
              this.parseTransactionDate(a.purchaseDate).getTime() - 
              this.parseTransactionDate(b.purchaseDate).getTime()
            )
          : lots.filter(l => l.remainingUnits > 0).sort((a, b) =>
              this.parseTransactionDate(b.purchaseDate).getTime() - 
              this.parseTransactionDate(a.purchaseDate).getTime()
            );

        for (const lot of sortedLots) {
          if (unitsToDeplete <= 0) break;

          const depleteUnits = Math.min(lot.remainingUnits, unitsToDeplete);
          const hadAllUnits = lot.remainingUnits === lot.units;
          lot.remainingUnits -= depleteUnits;
          unitsToDeplete -= depleteUnits;

          if (lot.remainingUnits === 0) {
            lot.status = 'redeemed';
            lot.redemptionDate = tx.date;
            lot.redemptionNav = tx.nav;
          } else if (lot.remainingUnits < lot.units) {
            // Partial redemption - mark as partial
            lot.status = 'partial';
          }
        }
      }
    }

    console.log(`[Parser v2] Built ${lots.length} holding lots, ${lots.filter(l => l.status === 'active').length} active`);
    return lots;
  }

  /**
   * Calculate lot-level gains
   */
  calculateLotGains(lots: HoldingLot[], currentNav: number): LotGainAnalysis[] {
    return lots
      .filter(lot => lot.status === 'active' && lot.remainingUnits > 0)
      .map(lot => {
        const currentValue = lot.remainingUnits * currentNav;
        const purchaseValue = lot.remainingUnits * lot.purchaseNav;
        const absoluteGain = currentValue - purchaseValue;
        const percentGain = purchaseValue > 0 ? (absoluteGain / purchaseValue) * 100 : 0;
        
        const purchaseDate = this.parseTransactionDate(lot.purchaseDate);
        const holdingPeriodDays = Math.floor(
          (Date.now() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const isLongTerm = holdingPeriodDays > 365;

        return {
          lotId: lot.id,
          units: lot.remainingUnits,
          purchaseDate: lot.purchaseDate,
          purchaseNav: lot.purchaseNav,
          purchaseValue,
          currentNav,
          currentValue,
          absoluteGain,
          percentGain,
          holdingPeriodDays,
          isLongTerm,
          taxImplication: isLongTerm ? 'LTCG' : 'STCG',
        };
      });
  }

  // ============================================
  // PHASE 3: SUMMARY PDF DETECTION
  // ============================================

  /**
   * Detect if PDF is summary-only (requires external enrichment)
   */
  detectSummaryPDF(text: string, profile: PDFProfile): SummaryPDFAnalysis {
    const analysis: SummaryPDFAnalysis = {
      isSummaryOnly: false,
      hasTransactionHistory: false,
      hasDetailedHoldings: false,
      aggregatorType: null,
      requiresEnrichment: false,
      enrichmentSources: [],
      confidence: 0,
    };

    // Check for aggregator patterns
    if (/wealthy\.in|mywealthy/i.test(text)) {
      analysis.aggregatorType = 'wealthy';
      analysis.isSummaryOnly = true;
    } else if (/mf\s*central|mfcentral/i.test(text)) {
      analysis.aggregatorType = 'mfcentral';
      analysis.isSummaryOnly = true;
    } else if (/portfolio\s*tracker|your\s*investments\s*at\s*a\s*glance/i.test(text)) {
      analysis.aggregatorType = 'generic_tracker';
      analysis.isSummaryOnly = true;
    }

    // Check for transaction section
    analysis.hasTransactionHistory = /transaction\s*(detail|history|statement)/i.test(text) ||
      /purchase|redemption|switch\s*(in|out)/i.test(text);

    // Check for detailed holdings (with purchase dates, NAV history)
    analysis.hasDetailedHoldings = /purchase\s*date|first\s*investment|acquisition/i.test(text);

    // Summary-only if no transactions and no detailed holdings
    if (!analysis.hasTransactionHistory && !analysis.hasDetailedHoldings) {
      analysis.isSummaryOnly = true;
    }

    // Determine enrichment needs
    if (analysis.isSummaryOnly) {
      analysis.requiresEnrichment = true;
      
      // Suggest enrichment sources based on what's available
      if (profile.registrars.includes('CAMS')) {
        analysis.enrichmentSources.push('CAMS CAS Statement');
      }
      if (profile.registrars.includes('KFINTECH')) {
        analysis.enrichmentSources.push('KFintech CAS Statement');
      }
      if (analysis.aggregatorType === 'mfcentral') {
        analysis.enrichmentSources.push('MFCentral detailed statement');
      }
      
      // Always suggest BSE Star MFD as an option
      analysis.enrichmentSources.push('BSE Star MFD API');
    }

    // Calculate confidence
    analysis.confidence = this.calculateSummaryDetectionConfidence(analysis, text);

    console.log('[Parser v2] Summary PDF analysis:', {
      isSummary: analysis.isSummaryOnly,
      aggregator: analysis.aggregatorType,
      needsEnrichment: analysis.requiresEnrichment,
      confidence: analysis.confidence.toFixed(2),
    });

    return analysis;
  }

  private calculateSummaryDetectionConfidence(
    analysis: SummaryPDFAnalysis,
    text: string
  ): number {
    let confidence = 0.5;

    // High confidence indicators
    if (analysis.aggregatorType) confidence += 0.25;
    if (!analysis.hasTransactionHistory) confidence += 0.15;
    if (!analysis.hasDetailedHoldings) confidence += 0.1;

    // Count ISINs - if few ISINs found, might be summary
    const isinCount = (text.match(/INF[A-Z0-9]{9}/g) || []).length;
    const schemeCount = (text.match(/(?:growth|direct|regular)\s*(?:plan|option)/gi) || []).length;
    
    if (schemeCount > 0 && isinCount < schemeCount / 2) {
      confidence += 0.1; // Missing ISINs suggests summary
    }

    return Math.min(confidence, 1.0);
  }

  // ============================================
  // PHASE 4: CONFIDENCE SCORING RULES
  // ============================================

  /**
   * Calculate detailed confidence score with component breakdown
   */
  calculateConfidenceScore(
    holdings: SemanticHolding[],
    transactions: TransactionRow[],
    profile: PDFProfile,
    validationResults?: { unitBalanceValid: boolean }
  ): ConfidenceScoreBreakdown {
    const breakdown: ConfidenceScoreBreakdown = {
      overall: 0,
      components: {
        isinMatch: 0,
        dateResolution: 0,
        valueAccuracy: 0,
        sourceQuality: 0,
        unitBalance: 0,
      },
      flags: [],
      recommendations: [],
    };

    // 1. ISIN Match Score (25% weight)
    const holdingsWithISIN = holdings.filter(h => h.isin?.startsWith('INF'));
    breakdown.components.isinMatch = holdings.length > 0
      ? (holdingsWithISIN.length / holdings.length)
      : 0;
    
    if (breakdown.components.isinMatch < 0.8) {
      breakdown.flags.push('LOW_ISIN_COVERAGE');
      breakdown.recommendations.push('Consider AMFI lookup for missing ISINs');
    }

    // 2. Date Resolution Score (20% weight)
    const holdingsWithDates = holdings.filter(h => 
      h.purchaseDateSource && h.purchaseDateSource !== 'unresolved'
    );
    breakdown.components.dateResolution = holdings.length > 0
      ? (holdingsWithDates.length / holdings.length)
      : 0;
    
    if (breakdown.components.dateResolution < 0.7) {
      breakdown.flags.push('UNRESOLVED_DATES');
      breakdown.recommendations.push('Request CAS statement with transaction history');
    }

    // 3. Value Accuracy Score (20% weight)
    const holdingsWithValues = holdings.filter(h => 
      h.currentValue && h.currentValue > 0 && h.units > 0
    );
    breakdown.components.valueAccuracy = holdings.length > 0
      ? (holdingsWithValues.length / holdings.length)
      : 0;

    // 4. Source Quality Score (20% weight)
    const sourceScores: Record<PDFType, number> = {
      'cas_cams': 0.95,
      'cas_kfintech': 0.95,
      'cas_combined': 0.90,
      'broker_zerodha': 0.85,
      'broker_groww': 0.85,
      'broker_icici': 0.85,
      'broker_hdfc': 0.85,
      'broker_kotak': 0.85,
      'broker_upstox': 0.80,
      'broker_angelone': 0.80,
      'aggregator_wealthy': 0.60,
      'aggregator_mfcentral': 0.70,
      'summary_only': 0.40,
      'transaction_only': 0.50,
      'unknown': 0.30,
    };
    breakdown.components.sourceQuality = sourceScores[profile.pdfType] || 0.3;

    if (profile.pdfType === 'summary_only' || profile.pdfType === 'unknown') {
      breakdown.flags.push('LOW_SOURCE_QUALITY');
      breakdown.recommendations.push('Upload official CAS statement for better accuracy');
    }

    // 5. Unit Balance Score (15% weight)
    breakdown.components.unitBalance = validationResults?.unitBalanceValid ? 1.0 : 0.5;
    
    if (!validationResults?.unitBalanceValid) {
      breakdown.flags.push('UNIT_BALANCE_MISMATCH');
      breakdown.recommendations.push('Transaction history may be incomplete');
    }

    // Calculate overall weighted score
    breakdown.overall = 
      breakdown.components.isinMatch * 0.25 +
      breakdown.components.dateResolution * 0.20 +
      breakdown.components.valueAccuracy * 0.20 +
      breakdown.components.sourceQuality * 0.20 +
      breakdown.components.unitBalance * 0.15;

    // Apply minimum threshold
    if (breakdown.overall < currentConfig.minConfidenceThreshold) {
      breakdown.flags.push('BELOW_THRESHOLD');
      breakdown.recommendations.push(
        `Confidence ${(breakdown.overall * 100).toFixed(0)}% below ${(currentConfig.minConfidenceThreshold * 100).toFixed(0)}% threshold`
      );
    }

    console.log('[Parser v2] Confidence score:', {
      overall: (breakdown.overall * 100).toFixed(1) + '%',
      flags: breakdown.flags.length,
    });

    return breakdown;
  }

  // ============================================
  // PHASE 4: LEARNING STORE
  // ============================================

  /**
   * Store successful parsing pattern for future matching
   */
  async storeLearnedPattern(
    profile: PDFProfile,
    parseResult: { success: boolean; holdingsCount: number; confidenceScore: number }
  ): Promise<void> {
    if (!currentConfig.enableLearning) {
      return;
    }

    // Only learn from successful high-confidence parses
    if (!parseResult.success || parseResult.confidenceScore < 0.7) {
      return;
    }

    const pattern: LearnedPattern = {
      fingerprint: profile.fingerprint,
      pdfType: profile.pdfType,
      layoutType: profile.layoutType,
      headerPatterns: profile.headerPatterns,
      columnOrder: profile.columnOrder,
      successCount: 1,
      lastUsed: new Date().toISOString(),
      avgHoldingsCount: parseResult.holdingsCount,
      avgConfidenceScore: parseResult.confidenceScore,
    };

    // Store in memory (would persist to DB in production)
    learnedPatterns.set(profile.fingerprint, pattern);

    console.log('[Parser v2] Pattern learned:', {
      fingerprint: profile.fingerprint.substring(0, 8),
      type: profile.pdfType,
      confidence: parseResult.confidenceScore.toFixed(2),
    });
  }

  /**
   * Find matching learned pattern for new document
   */
  findMatchingPattern(profile: PDFProfile): LearnedPattern | null {
    // Exact fingerprint match
    const exactMatch = learnedPatterns.get(profile.fingerprint);
    if (exactMatch) {
      exactMatch.lastUsed = new Date().toISOString();
      exactMatch.successCount++;
      return exactMatch;
    }

    // Similar pattern matching (same type + layout + header patterns)
    for (const [_, pattern] of learnedPatterns) {
      if (
        pattern.pdfType === profile.pdfType &&
        pattern.layoutType === profile.layoutType &&
        this.headerPatternsMatch(pattern.headerPatterns, profile.headerPatterns)
      ) {
        return pattern;
      }
    }

    return null;
  }

  private headerPatternsMatch(p1: string[], p2: string[]): boolean {
    if (p1.length === 0 || p2.length === 0) return false;
    
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    const set1 = new Set(p1.map(normalize));
    
    let matches = 0;
    for (const p of p2) {
      if (set1.has(normalize(p))) matches++;
    }

    return matches >= Math.min(p1.length, p2.length) / 2;
  }

  getLearnedPatternsStats(): { 
    totalPatterns: number; 
    byType: Record<string, number>;
    topPatterns: Array<{ fingerprint: string; type: string; successCount: number }>;
  } {
    const byType: Record<string, number> = {};
    const allPatterns: Array<{ fingerprint: string; type: string; successCount: number }> = [];

    for (const [fp, pattern] of learnedPatterns) {
      byType[pattern.pdfType] = (byType[pattern.pdfType] || 0) + 1;
      allPatterns.push({
        fingerprint: fp.substring(0, 8),
        type: pattern.pdfType,
        successCount: pattern.successCount,
      });
    }

    return {
      totalPatterns: learnedPatterns.size,
      byType,
      topPatterns: allPatterns.sort((a, b) => b.successCount - a.successCount).slice(0, 10),
    };
  }

  // ============================================
  // PHASE 5: STRUCTURED LOGGING & OBSERVABILITY
  // ============================================

  /**
   * Create structured parsing log entry
   */
  createParsingLog(
    eventType: 'parse_start' | 'parse_complete' | 'parse_error' | 'enrichment_needed' | 'pattern_matched',
    data: {
      fingerprint?: string;
      pdfType?: PDFType;
      holdingsCount?: number;
      transactionsCount?: number;
      confidenceScore?: number;
      parseTimeMs?: number;
      errors?: string[];
      warnings?: string[];
      enrichmentReasons?: string[];
    }
  ): ParsingLogEntry {
    const entry: ParsingLogEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      sessionId: crypto.randomUUID().substring(0, 8),
      ...data,
    };

    // Console structured log
    const logLevel = eventType === 'parse_error' ? 'error' : 'info';
    const logMethod = logLevel === 'error' ? console.error : console.log;
    
    logMethod(`[Parser v2] [${eventType.toUpperCase()}]`, JSON.stringify({
      fingerprint: entry.fingerprint?.substring(0, 8),
      type: entry.pdfType,
      holdings: entry.holdingsCount,
      confidence: entry.confidenceScore?.toFixed(2),
      timeMs: entry.parseTimeMs,
      errors: entry.errors?.length || 0,
    }));

    // Add to parsing history (in-memory, would persist to DB)
    parsingHistory.push(entry);
    if (parsingHistory.length > 1000) {
      parsingHistory.shift(); // Keep last 1000 entries
    }

    return entry;
  }

  /**
   * Get parsing metrics for dashboard
   */
  getParsingMetrics(timeWindowHours: number = 24): ParsingMetrics {
    const cutoff = Date.now() - timeWindowHours * 60 * 60 * 1000;
    const recentLogs = parsingHistory.filter(
      e => new Date(e.timestamp).getTime() > cutoff
    );

    const successCount = recentLogs.filter(e => e.eventType === 'parse_complete').length;
    const errorCount = recentLogs.filter(e => e.eventType === 'parse_error').length;
    const total = successCount + errorCount;

    const byType: Record<string, { count: number; avgConfidence: number }> = {};
    for (const log of recentLogs.filter(e => e.eventType === 'parse_complete')) {
      if (!log.pdfType) continue;
      if (!byType[log.pdfType]) {
        byType[log.pdfType] = { count: 0, avgConfidence: 0 };
      }
      byType[log.pdfType].count++;
      byType[log.pdfType].avgConfidence += log.confidenceScore || 0;
    }
    for (const type of Object.keys(byType)) {
      byType[type].avgConfidence /= byType[type].count;
    }

    const avgParseTime = recentLogs
      .filter(e => e.parseTimeMs)
      .reduce((sum, e) => sum + (e.parseTimeMs || 0), 0) / 
      Math.max(recentLogs.filter(e => e.parseTimeMs).length, 1);

    const enrichmentNeeded = recentLogs.filter(e => e.eventType === 'enrichment_needed').length;

    return {
      timeWindowHours,
      totalParses: total,
      successRate: total > 0 ? (successCount / total) * 100 : 0,
      errorRate: total > 0 ? (errorCount / total) * 100 : 0,
      avgParseTimeMs: avgParseTime,
      byPdfType: byType,
      enrichmentNeededCount: enrichmentNeeded,
      patternMatchRate: recentLogs.filter(e => e.eventType === 'pattern_matched').length / Math.max(total, 1) * 100,
    };
  }

  /**
   * Get error tracking summary
   */
  getErrorSummary(limit: number = 20): Array<{
    timestamp: string;
    fingerprint?: string;
    pdfType?: string;
    errors: string[];
  }> {
    return parsingHistory
      .filter(e => e.eventType === 'parse_error' && e.errors && e.errors.length > 0)
      .slice(-limit)
      .map(e => ({
        timestamp: e.timestamp,
        fingerprint: e.fingerprint?.substring(0, 8),
        pdfType: e.pdfType,
        errors: e.errors || [],
      }));
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
