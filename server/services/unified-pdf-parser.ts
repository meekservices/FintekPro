/**
 * Unified PDF Parser Service
 * 
 * Single entry point for all PDF parsing operations:
 * - Text extraction
 * - Document profiling (type detection, layout analysis)
 * - Semantic data extraction (holdings, transactions, investor info)
 * - Holding lots building for LTCG/STCG calculations
 * - Confidence scoring
 * 
 * Consolidates pdf-parser-service.ts (v1) and pdf-parser-v2.ts
 */

import * as crypto from 'crypto';
import { PDFParse } from 'pdf-parse';

// ============================================
// TYPES - Document Profiling
// ============================================

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
  | 'broker_5paisa'      // 5Paisa holdings
  | 'broker_motilal'     // Motilal Oswal holdings
  | 'broker_axis'        // Axis Direct holdings
  | 'broker_iifl'        // IIFL Securities holdings
  | 'broker_sharekhan'   // Sharekhan holdings
  | 'aggregator_mfcentral' // MF Central
  | 'aggregator_indmoney' // INDmoney
  | 'aggregator_kuvera'  // Kuvera
  | 'aggregator_etmoney' // ET Money
  | 'aggregator_paytm'   // Paytm Money
  | 'aggregator_wealthy' // Wealthy.in
  | 'summary_only'       // Summary PDF without transactions
  | 'transaction_only'   // Transaction statement only
  | 'unknown';

export type LayoutType = 
  | 'tabular'            // Clear table structure
  | 'semi_structured'    // Partial table structure
  | 'narrative'          // Text-heavy, no tables
  | 'mixed';             // Combination of layouts

// ============================================
// TYPES - Text Extraction
// ============================================

export interface TextExtractResult {
  text: string;
  pageCount?: number;
  info?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface TextExtractOptions {
  maxPages?: number;
  maxFileSize?: number;
}

export interface SafeExtractResult {
  success: boolean;
  result?: TextExtractResult;
  error?: string;
  errorCode?: 'INVALID_INPUT' | 'FILE_TOO_LARGE' | 'PARSE_ERROR' | 'EMPTY_CONTENT' | 'UNKNOWN';
}

// ============================================
// TYPES - Document Profile
// ============================================

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
}

// ============================================
// TYPES - Semantic Extraction
// ============================================

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
  // Exit load fields extracted from CAS statement
  exitLoadText?: string;           // Raw exit load text from statement
  exitLoadPercent?: number;        // Parsed exit load percentage
  exitLoadDays?: number;           // Parsed exit load applicable days
  // Enriched fields (filled via ISIN lookup)
  category?: string;               // Fund category for STCG/LTCG determination
  fundHouse?: string;              // AMC name
  currentNav?: number;             // Latest NAV from live data
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

export interface InvestorInfo {
  name?: string;
  pan?: string;
  email?: string;
  mobile?: string;
  address?: string;
}

// ============================================
// TYPES - Holding Lots
// ============================================

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

// ============================================
// TYPES - Layout Analysis
// ============================================

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

// ============================================
// TYPES - Parse Result
// ============================================

export interface ParseResult {
  success: boolean;
  profile: PDFProfile;
  holdings: SemanticHolding[];
  transactions: TransactionRow[];
  investor: InvestorInfo;
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
  layoutAnalysis?: LayoutAnalysis;
}

// ============================================
// TYPES - Confidence Scoring
// ============================================

export interface ConfidenceBreakdown {
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

// ============================================
// TYPES - Parsing Metrics
// ============================================

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

interface ParsingLogEntry {
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

interface LearnedPattern {
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

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const PROFILE_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const MIN_CONFIDENCE_THRESHOLD = 0.5;

// ============================================
// CACHES
// ============================================

const profileCache = new Map<string, PDFProfile>();
const learnedPatterns = new Map<string, LearnedPattern>();
const parsingHistory: ParsingLogEntry[] = [];

// ============================================
// UNIFIED PDF PARSER SERVICE
// ============================================

class UnifiedPDFParser {
  private static instance: UnifiedPDFParser;
  private enableLearning = true;
  private minConfidenceThreshold = MIN_CONFIDENCE_THRESHOLD;

  private constructor() {
    console.log('✅ Unified PDF Parser initialized');
  }

  static getInstance(): UnifiedPDFParser {
    if (!UnifiedPDFParser.instance) {
      UnifiedPDFParser.instance = new UnifiedPDFParser();
    }
    return UnifiedPDFParser.instance;
  }

  // ============================================
  // TEXT EXTRACTION (from v1)
  // ============================================

  async extractText(input: Buffer | string, options: TextExtractOptions = {}): Promise<TextExtractResult> {
    const { maxFileSize = DEFAULT_MAX_FILE_SIZE } = options;

    let buffer: Buffer;
    if (typeof input === 'string') {
      try {
        buffer = Buffer.from(input, 'base64');
      } catch {
        throw new Error('Invalid base64 input');
      }
    } else {
      buffer = input;
    }

    if (!buffer || buffer.length === 0) {
      throw new Error('Empty or invalid PDF input');
    }

    if (buffer.length > maxFileSize) {
      throw new Error(`PDF file size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed (${(maxFileSize / 1024 / 1024).toFixed(2)}MB)`);
    }

    const header = buffer.slice(0, 5).toString();
    if (header !== '%PDF-') {
      throw new Error('Invalid PDF file: missing PDF header');
    }

    let parser: PDFParse | null = null;

    try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();

      const parseResult: TextExtractResult = {
        text: result.text || '',
        pageCount: result.numpages,
        info: result.info,
        metadata: result.metadata
      };

      if (!parseResult.text || parseResult.text.trim().length === 0) {
        console.warn('[UnifiedPDFParser] Warning: PDF parsed but contains no extractable text');
      }

      return parseResult;
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch (destroyError) {
          console.warn('[UnifiedPDFParser] Warning: Failed to destroy parser instance', destroyError);
        }
      }
    }
  }

  async extractTextSafe(input: Buffer | string, options: TextExtractOptions = {}): Promise<SafeExtractResult> {
    try {
      if (!input) {
        return { success: false, error: 'No input provided', errorCode: 'INVALID_INPUT' };
      }

      if (typeof input === 'string' && input.length === 0) {
        return { success: false, error: 'Empty base64 string provided', errorCode: 'INVALID_INPUT' };
      }

      const result = await this.extractText(input, options);

      if (!result.text || result.text.trim().length === 0) {
        return {
          success: true,
          result,
          error: 'PDF parsed but contains no extractable text',
          errorCode: 'EMPTY_CONTENT'
        };
      }

      return { success: true, result };
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown parsing error';
      
      let errorCode: SafeExtractResult['errorCode'] = 'UNKNOWN';
      if (errorMessage.includes('Invalid') || errorMessage.includes('Empty')) {
        errorCode = 'INVALID_INPUT';
      } else if (errorMessage.includes('exceeds maximum')) {
        errorCode = 'FILE_TOO_LARGE';
      } else {
        errorCode = 'PARSE_ERROR';
      }

      console.error('[UnifiedPDFParser] Parse error:', errorMessage);
      return { success: false, error: errorMessage, errorCode };
    }
  }

  isValidPDF(input: Buffer | string): boolean {
    try {
      let buffer: Buffer;
      if (typeof input === 'string') {
        buffer = Buffer.from(input, 'base64');
      } else {
        buffer = input;
      }

      if (!buffer || buffer.length < 5) return false;
      const header = buffer.slice(0, 5).toString();
      return header === '%PDF-';
    } catch {
      return false;
    }
  }

  getFileSize(input: Buffer | string): number {
    if (typeof input === 'string') {
      return Math.floor(input.length * 0.75);
    }
    return input.length;
  }

  // ============================================
  // DOCUMENT PROFILING
  // ============================================

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
    
    const parseResult = await this.extractTextSafe(buffer);
    if (!parseResult.success || !parseResult.result) {
      throw new Error(parseResult.error || 'Failed to extract PDF text');
    }

    const text = parseResult.result.text;
    const pageCount = parseResult.result.pageCount || 1;
    const fingerprint = this.computeFingerprint(text);

    const cached = profileCache.get(fingerprint);
    if (cached) {
      console.log('[UnifiedPDFParser] Profile cache hit:', fingerprint.substring(0, 8));
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
    };

    profile.confidenceScore = this.calculateProfileConfidence(profile);

    profileCache.set(fingerprint, profile);

    console.log(`[UnifiedPDFParser] Document profiled in ${Date.now() - startTime}ms:`, {
      type: profile.pdfType,
      layout: profile.layoutType,
      pages: profile.pageCount,
      confidence: profile.confidenceScore,
    });

    return profile;
  }

  // ============================================
  // FULL DOCUMENT PARSING
  // ============================================

  async parseDocument(buffer: Buffer, options?: {
    fileName?: string;
    userId?: string;
    agentId?: string;
  }): Promise<ParseResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    this.createParsingLog('parse_start', {});

    try {
      const profile = await this.profileDocument(buffer);

      const matchedPattern = this.findMatchingPattern(profile);
      if (matchedPattern) {
        this.createParsingLog('pattern_matched', {
          fingerprint: profile.fingerprint,
          pdfType: profile.pdfType,
        });
      }

      const parseResult = await this.extractTextSafe(buffer);
      if (!parseResult.success || !parseResult.result) {
        throw new Error(parseResult.error || 'Failed to extract PDF text');
      }
      const text = parseResult.result.text;

      const layoutAnalysis = this.analyzeLayout(text);
      const semanticResult = this.extractSemanticData(text, layoutAnalysis, profile);
      const holdingsWithDates = this.resolvePurchaseDates(
        semanticResult.holdings,
        semanticResult.transactions
      );
      const holdingLots = this.buildHoldingLots(semanticResult.transactions);

      const unitBalanceValidation = this.validateUnitBalance(semanticResult.transactions);
      const confidenceBreakdown = this.calculateConfidenceScore(
        holdingsWithDates,
        semanticResult.transactions,
        profile,
        { unitBalanceValid: unitBalanceValidation.valid }
      );

      const summaryAnalysis = this.detectSummaryPDF(text, profile);

      if (confidenceBreakdown.flags.length > 0) {
        warnings.push(...confidenceBreakdown.flags);
      }
      if (!unitBalanceValidation.valid) {
        warnings.push(`Unit balance discrepancies: ${unitBalanceValidation.discrepancies.length}`);
      }

      const result: ParseResult = {
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
        layoutAnalysis,
      };

      if (this.enableLearning && result.success && result.confidenceScore >= 0.7) {
        await this.storeLearnedPattern(profile, {
          success: true,
          holdingsCount: result.holdings.length,
          confidenceScore: result.confidenceScore,
        });
      }

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

  // ============================================
  // PDF TYPE DETECTION
  // ============================================

  private detectPDFType(text: string): PDFType {
    if (/consolidated\s*account\s*statement/i.test(text)) {
      if (/cams/i.test(text) && /kfintech|karvy/i.test(text)) {
        return 'cas_combined';
      }
      if (/kfintech|karvy/i.test(text)) {
        return 'cas_kfintech';
      }
      return 'cas_cams';
    }

    if (/zerodha|kite\.|console\.zerodha/i.test(text)) return 'broker_zerodha';
    if (/groww\.in|groww\s+portfolio|groww\s+investments/i.test(text)) return 'broker_groww';
    if (/icici\s*direct|icicidirect\.com/i.test(text)) return 'broker_icici';
    if (/hdfc\s*securities|hdfcsec\.com/i.test(text)) return 'broker_hdfc';
    if (/kotak\s*securities|kotaksecurities/i.test(text)) return 'broker_kotak';
    if (/upstox|upstox\.com/i.test(text)) return 'broker_upstox';
    if (/angel\s*one|angelbroking|angelone\.in/i.test(text)) return 'broker_angelone';
    if (/5paisa|5\s*paisa|fivepaisa/i.test(text)) return 'broker_5paisa';
    if (/motilal\s*oswal|motilaloswal/i.test(text)) return 'broker_motilal';
    if (/axis\s*direct|axisdirect\.in/i.test(text)) return 'broker_axis';
    if (/iifl\s*securities|indiainfoline/i.test(text)) return 'broker_iifl';
    if (/sharekhan/i.test(text)) return 'broker_sharekhan';
    
    if (/wealthy\.in|wealthy\s+portfolio/i.test(text)) return 'aggregator_wealthy';
    if (/mf\s*central|mfcentral\.com/i.test(text)) return 'aggregator_mfcentral';
    if (/indmoney|ind\s*money/i.test(text)) return 'aggregator_indmoney';
    if (/kuvera\.in|kuvera\s+portfolio/i.test(text)) return 'aggregator_kuvera';
    if (/et\s*money|etmoney\.com/i.test(text)) return 'aggregator_etmoney';
    if (/paytm\s*money|paytmmoney/i.test(text)) return 'aggregator_paytm';

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

  // ============================================
  // LAYOUT ANALYSIS
  // ============================================

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

      const pageText = pageLines.join('\n');
      const transactionCount = this.countTransactionsInPage(pageText);
      analysisResult.totalTransactionsFound += transactionCount;

      previousPageHadContinuation = this.endsWithContinuation(pageLines);
    }

    analysisResult.layoutConfidence = this.calculateLayoutConfidence(analysisResult);

    return analysisResult;
  }

  private splitIntoPages(lines: string[]): string[][] {
    const pages: string[][] = [];
    let currentPage: string[] = [];

    const pageBreakPatterns = [
      /^page\s*\d+\s*(of\s*\d+)?$/i,
      /^\s*-\s*\d+\s*-\s*$/,
      /\f/,
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

    const footerStartIdx = Math.max(lineCount - Math.floor(lineCount * 0.1), lineCount - 10);
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

  private isHeaderContent(content: string): boolean {
    const headerPatterns = [
      /consolidated\s*account\s*statement/i,
      /statement\s*period/i,
      /as\s*on\s*date/i,
      /investor\s*name/i,
      /pan\s*:/i,
    ];
    return headerPatterns.some(p => p.test(content));
  }

  private isFooterContent(content: string): boolean {
    const footerPatterns = [
      /page\s*\d+\s*(of\s*\d+)?/i,
      /disclaimer/i,
      /this\s+is\s+a\s+computer\s+generated/i,
      /for\s+any\s+queries/i,
    ];
    return footerPatterns.some(p => p.test(content));
  }

  private detectAMCBlocks(lines: string[], pageIndex: number): AMCBlock[] {
    const blocks: AMCBlock[] = [];
    const amcPatterns = [
      /([A-Z][A-Za-z\s]+(?:Mutual\s*Fund|Asset\s*Management|AMC))/i,
      /^(HDFC|ICICI|SBI|Axis|Kotak|Nippon|Aditya\s*Birla|Tata|Franklin|DSP)/i,
    ];

    let currentBlock: AMCBlock | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of amcPatterns) {
        const match = line.match(pattern);
        if (match) {
          if (currentBlock) {
            currentBlock.endLine = i - 1;
            blocks.push(currentBlock);
          }
          currentBlock = {
            amcName: match[1].trim(),
            holdings: [],
            startLine: i,
            endLine: lines.length,
          };
          break;
        }
      }

      const folioMatch = line.match(/folio\s*(?:no\.?|number)?:?\s*(\d+\/?\d*)/i);
      if (folioMatch && currentBlock) {
        currentBlock.folioNumber = folioMatch[1];
      }
    }

    if (currentBlock) {
      blocks.push(currentBlock);
    }

    return blocks;
  }

  private detectTableInSection(text: string): boolean {
    const lines = text.split('\n');
    let tableLineCount = 0;

    for (const line of lines) {
      const hasMultipleNumbers = (line.match(/[\d,]+\.?\d*/g) || []).length >= 2;
      const hasDelimiters = /\s{2,}|\t|\|/.test(line);
      if (hasMultipleNumbers && hasDelimiters) {
        tableLineCount++;
      }
    }

    return tableLineCount >= 3;
  }

  private detectContinuation(lines: string[]): boolean {
    const firstFewLines = lines.slice(0, 5).join('\n').toLowerCase();
    return /continued|contd\.|\.{3,}/.test(firstFewLines);
  }

  private endsWithContinuation(lines: string[]): boolean {
    const lastFewLines = lines.slice(-5).join('\n').toLowerCase();
    return /continued\s+on\s+next|to\s+be\s+continued|\.{3,}$/.test(lastFewLines);
  }

  private countTransactionsInPage(text: string): number {
    const transactionPatterns = [
      /\d{2}[-\/]\d{2}[-\/]\d{4}\s+(?:purchase|sip|redemption|switch)/gi,
      /(?:purchase|sip|redemption|switch)\s+\d+\.?\d*/gi,
    ];

    let count = 0;
    for (const pattern of transactionPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }
    return count;
  }

  private calculateLayoutConfidence(analysis: LayoutAnalysis): number {
    let score = 0.5;

    if (analysis.pages.length > 0) score += 0.1;
    if (analysis.totalAMCBlocks > 0) score += 0.15;
    if (analysis.totalHoldingsFound > 0) score += 0.15;
    if (analysis.pages.some(p => p.hasTableStructure)) score += 0.1;

    return Math.min(score, 1.0);
  }

  // ============================================
  // SEMANTIC DATA EXTRACTION
  // ============================================

  private extractSemanticData(text: string, layout: LayoutAnalysis, profile: PDFProfile): {
    holdings: SemanticHolding[];
    transactions: TransactionRow[];
    investor: InvestorInfo;
    unresolvedItems: Array<{
      type: 'date' | 'isin' | 'value' | 'folio' | 'units';
      description: string;
      affectedHoldings: string[];
      sourceLine?: number;
    }>;
    requiresEnrichment: boolean;
  } {
    const holdings: SemanticHolding[] = [];
    const transactions: TransactionRow[] = [];
    const unresolvedItems: Array<{
      type: 'date' | 'isin' | 'value' | 'folio' | 'units';
      description: string;
      affectedHoldings: string[];
      sourceLine?: number;
    }> = [];

    const investor = this.extractInvestorInfo(text);

    const lines = text.split('\n');
    let currentFolio: string | undefined;
    let currentScheme: string | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const folioMatch = line.match(/folio\s*(?:no\.?|number)?:?\s*(\d+\/?\d*)/i);
      if (folioMatch) {
        currentFolio = folioMatch[1];
      }

      const schemeMatch = line.match(/^([A-Z][A-Za-z\s\-]+(?:Fund|Plan|Growth|Dividend|Direct|Regular))/i);
      if (schemeMatch && schemeMatch[1].length > 10) {
        currentScheme = schemeMatch[1].trim();
      }

      const isinMatch = line.match(/\b(INF[A-Z0-9]{9})\b/i);
      const unitsMatch = line.match(/(\d+(?:,\d{3})*\.?\d*)\s*(?:units?|balance)/i);
      const valueMatch = line.match(/(?:current|market|value)[:\s]*₹?\s*(\d+(?:,\d{3})*\.?\d*)/i);

      if (isinMatch && unitsMatch) {
        const holding: SemanticHolding = {
          schemeName: currentScheme || 'Unknown Scheme',
          isin: isinMatch[1].toUpperCase(),
          folioNumber: currentFolio,
          units: parseFloat(unitsMatch[1].replace(/,/g, '')),
          currentValue: valueMatch ? parseFloat(valueMatch[1].replace(/,/g, '')) : undefined,
          confidenceScore: 0.7,
          sourceLines: [i],
          requiresEnrichment: !currentScheme,
        };
        holdings.push(holding);
      }

      const txnMatch = line.match(/(\d{2}[-\/]\d{2}[-\/]\d{4})\s+(purchase|sip|redemption|switch\s*(?:in|out)|dividend|bonus)/i);
      if (txnMatch) {
        const amountMatch = line.match(/(\d+(?:,\d{3})*\.?\d*)\s*$/);
        const unitsMatch2 = line.match(/(\d+\.?\d*)\s+(?:units?)?.*(\d+(?:,\d{3})*\.?\d*)$/i);

        transactions.push({
          date: txnMatch[1],
          description: line.trim(),
          type: this.mapTransactionType(txnMatch[2]),
          units: unitsMatch2 ? parseFloat(unitsMatch2[1]) : 0,
          nav: 0,
          amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0,
          isZeroAmount: false,
          isMultiLine: false,
          rawLines: [line],
          lineNumbers: [i],
        });
      }
    }

    for (const holding of holdings) {
      if (!holding.isin) {
        unresolvedItems.push({
          type: 'isin',
          description: `Missing ISIN for ${holding.schemeName}`,
          affectedHoldings: [holding.schemeName],
        });
      }
    }

    // Extract exit load information for each holding
    const holdingsWithExitLoad = this.extractExitLoadForHoldings(text, holdings);

    const requiresEnrichment = holdingsWithExitLoad.some(h => h.requiresEnrichment) || 
      unresolvedItems.length > 0 ||
      profile.pdfType === 'summary_only';

    return { holdings: holdingsWithExitLoad, transactions, investor, unresolvedItems, requiresEnrichment };
  }

  private extractInvestorInfo(text: string): InvestorInfo {
    const investor: InvestorInfo = {};

    const nameMatch = text.match(/(?:investor|account\s*holder|name)\s*[:\-]?\s*([A-Z][A-Za-z\s]+?)(?:\n|pan|email)/i);
    if (nameMatch) {
      investor.name = nameMatch[1].trim();
    }

    const panMatch = text.match(/\b([A-Z]{5}\d{4}[A-Z])\b/);
    if (panMatch) {
      investor.pan = panMatch[1];
    }

    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      investor.email = emailMatch[1];
    }

    const mobileMatch = text.match(/(?:mobile|phone|contact)\s*[:\-]?\s*(\+?91?\s*)?(\d{10})/i);
    if (mobileMatch) {
      investor.mobile = mobileMatch[2];
    }

    return investor;
  }

  private mapTransactionType(type: string): TransactionRow['type'] {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('sip')) return 'sip';
    if (lowerType.includes('purchase')) return 'purchase';
    if (lowerType.includes('redemption')) return 'redemption';
    if (lowerType.includes('switch') && lowerType.includes('in')) return 'switch_in';
    if (lowerType.includes('switch') && lowerType.includes('out')) return 'switch_out';
    if (lowerType.includes('dividend')) return 'dividend';
    if (lowerType.includes('bonus')) return 'bonus';
    return 'unknown';
  }

  /**
   * Parse exit load text from CAS statement
   * Examples:
   * - "Exit Load- 1% if redeemed/switched out, on or before 12 months from the date of allotment"
   * - "Exit Load: 1% if redeemed / switched out within 6 months"
   * - "Exit Load : (w.e.f 08-May-2020) If redeemed / Switched Out within 365 days - 1.00%"
   * - "Exit Load: Nil"
   */
  private parseExitLoadText(text: string): { exitLoadText: string; exitLoadPercent?: number; exitLoadDays?: number } | null {
    // Find exit load text pattern
    const exitLoadPatterns = [
      /exit\s*load[:\-\s]*([^.]+(?:\.\s*[^.]+)?)/i,
      /exit\s*load[:\-\s]*(nil|none)/i,
    ];

    for (const pattern of exitLoadPatterns) {
      const match = text.match(pattern);
      if (match) {
        const exitLoadText = match[1].trim();
        
        // Check for Nil/None
        if (/^(nil|none|no\s*exit\s*load)$/i.test(exitLoadText)) {
          return { exitLoadText: 'Nil', exitLoadPercent: 0, exitLoadDays: 0 };
        }

        // Extract percentage
        let exitLoadPercent: number | undefined;
        const percentPatterns = [
          /(\d+(?:\.\d+)?)\s*%/,                    // 1% or 1.00%
          /(\d+(?:\.\d+)?)\s*percent/i,             // 1 percent
        ];
        for (const pPattern of percentPatterns) {
          const pMatch = exitLoadText.match(pPattern);
          if (pMatch) {
            exitLoadPercent = parseFloat(pMatch[1]);
            break;
          }
        }

        // Extract days/period
        let exitLoadDays: number | undefined;
        const daysPatterns = [
          /within\s*(\d+)\s*days/i,                  // within 365 days
          /before\s*(\d+)\s*days/i,                  // before 30 days
          /(\d+)\s*days?\s*from/i,                   // 30 days from
          /within\s*(\d+)\s*months?/i,               // within 12 months
          /before\s*(\d+)\s*months?/i,               // before 6 months
          /(\d+)\s*months?\s*from/i,                 // 6 months from
          /within\s*(\d+)\s*years?/i,                // within 1 year
          /before\s*(\d+)\s*years?/i,                // before 1 year
          /(\d+)\s*years?\s*from/i,                  // 1 year from
          /on\s*or\s*before\s*(\d+)\s*(day|month|year)s?/i,  // on or before 12 months
        ];

        for (const dPattern of daysPatterns) {
          const dMatch = exitLoadText.match(dPattern);
          if (dMatch) {
            const value = parseInt(dMatch[1], 10);
            const unit = dMatch[2]?.toLowerCase() || '';
            
            // Also check context for units
            const contextLower = exitLoadText.toLowerCase();
            
            if (unit.includes('year') || contextLower.includes('year')) {
              exitLoadDays = value * 365;
            } else if (unit.includes('month') || contextLower.includes('month')) {
              exitLoadDays = value * 30;
            } else {
              exitLoadDays = value;
            }
            break;
          }
        }

        // If still no days found, try common patterns
        if (!exitLoadDays) {
          if (exitLoadText.toLowerCase().includes('1 year') || exitLoadText.toLowerCase().includes('12 month')) {
            exitLoadDays = 365;
          } else if (exitLoadText.toLowerCase().includes('6 month')) {
            exitLoadDays = 180;
          } else if (exitLoadText.toLowerCase().includes('3 month')) {
            exitLoadDays = 90;
          }
        }

        return { exitLoadText, exitLoadPercent, exitLoadDays };
      }
    }

    return null;
  }

  /**
   * Extract exit load for holdings from full text
   * Parses the text after each holding to find associated exit load
   */
  private extractExitLoadForHoldings(text: string, holdings: SemanticHolding[]): SemanticHolding[] {
    const lines = text.split('\n');
    
    return holdings.map(holding => {
      // Find the ISIN line
      const isinLine = lines.findIndex(line => 
        line.includes(holding.isin || '') && holding.isin
      );
      
      if (isinLine === -1) return holding;

      // Look for exit load in the next 30 lines after the ISIN
      for (let i = isinLine; i < Math.min(isinLine + 30, lines.length); i++) {
        const line = lines[i];
        if (/exit\s*load/i.test(line)) {
          // Gather full exit load text (may span multiple lines)
          let exitLoadBlock = line;
          let j = i + 1;
          while (j < lines.length && 
                 !lines[j].match(/folio/i) && 
                 !lines[j].match(/^[A-Z][A-Z0-9]+-/) &&  // Next scheme
                 j < i + 5) {
            exitLoadBlock += ' ' + lines[j];
            j++;
          }

          const parsed = this.parseExitLoadText(exitLoadBlock);
          if (parsed) {
            return {
              ...holding,
              exitLoadText: parsed.exitLoadText,
              exitLoadPercent: parsed.exitLoadPercent,
              exitLoadDays: parsed.exitLoadDays,
            };
          }
          break;
        }
      }

      return holding;
    });
  }

  // ============================================
  // PURCHASE DATE RESOLUTION
  // ============================================

  private resolvePurchaseDates(holdings: SemanticHolding[], transactions: TransactionRow[]): SemanticHolding[] {
    return holdings.map(holding => {
      if (holding.purchaseDate) {
        return { ...holding, purchaseDateSource: 'explicit' as const };
      }

      const matchingTxns = transactions.filter(t => 
        t.type === 'purchase' || t.type === 'sip'
      ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (matchingTxns.length > 0) {
        return {
          ...holding,
          purchaseDate: matchingTxns[0].date,
          purchaseDateSource: matchingTxns[0].type === 'sip' ? 'sip_first' as const : 'transaction' as const,
        };
      }

      return { ...holding, purchaseDateSource: 'unresolved' as const };
    });
  }

  // ============================================
  // HOLDING LOTS BUILDER
  // ============================================

  private buildHoldingLots(transactions: TransactionRow[]): HoldingLot[] {
    const lots: HoldingLot[] = [];

    const purchaseTxns = transactions.filter(t => 
      t.type === 'purchase' || t.type === 'sip' || t.type === 'switch_in' || t.type === 'bonus'
    );

    for (const txn of purchaseTxns) {
      if (txn.units > 0) {
        lots.push({
          id: crypto.randomUUID(),
          purchaseDate: txn.date,
          purchaseNav: txn.nav || (txn.amount / txn.units),
          purchaseValue: txn.amount,
          units: txn.units,
          remainingUnits: txn.units,
          source: txn.type as 'purchase' | 'sip' | 'switch_in' | 'bonus',
          status: 'active',
          transactionRef: txn.lineNumbers.join('-'),
        });
      }
    }

    const redemptionTxns = transactions.filter(t => 
      t.type === 'redemption' || t.type === 'switch_out'
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const redemption of redemptionTxns) {
      let unitsToRedeem = redemption.units;
      
      const activeLots = lots
        .filter(l => l.status === 'active' || l.status === 'partial')
        .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());

      for (const lot of activeLots) {
        if (unitsToRedeem <= 0) break;

        if (lot.remainingUnits <= unitsToRedeem) {
          unitsToRedeem -= lot.remainingUnits;
          lot.remainingUnits = 0;
          lot.status = 'redeemed';
          lot.redemptionDate = redemption.date;
          lot.redemptionNav = redemption.nav;
        } else {
          lot.remainingUnits -= unitsToRedeem;
          lot.status = 'partial';
          unitsToRedeem = 0;
        }
      }
    }

    return lots;
  }

  // ============================================
  // UNIT BALANCE VALIDATION
  // ============================================

  private validateUnitBalance(transactions: TransactionRow[]): {
    valid: boolean;
    discrepancies: Array<{ expected: number; actual: number; line: number }>;
  } {
    const discrepancies: Array<{ expected: number; actual: number; line: number }> = [];
    let runningBalance = 0;

    for (const txn of transactions) {
      if (txn.type === 'purchase' || txn.type === 'sip' || txn.type === 'switch_in' || txn.type === 'bonus') {
        runningBalance += txn.units;
      } else if (txn.type === 'redemption' || txn.type === 'switch_out') {
        runningBalance -= txn.units;
      }

      if (txn.runningBalance !== undefined) {
        const diff = Math.abs(runningBalance - txn.runningBalance);
        if (diff > 0.01) {
          discrepancies.push({
            expected: runningBalance,
            actual: txn.runningBalance,
            line: txn.lineNumbers[0],
          });
        }
      }
    }

    return { valid: discrepancies.length === 0, discrepancies };
  }

  // ============================================
  // CONFIDENCE SCORING
  // ============================================

  private calculateConfidenceScore(
    holdings: SemanticHolding[],
    transactions: TransactionRow[],
    profile: PDFProfile,
    options: { unitBalanceValid: boolean }
  ): ConfidenceBreakdown {
    const breakdown: ConfidenceBreakdown = {
      overall: 0.5,
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

    const holdingsWithISIN = holdings.filter(h => h.isin).length;
    breakdown.components.isinMatch = holdingsWithISIN / Math.max(holdings.length, 1);
    if (breakdown.components.isinMatch < 0.5) {
      breakdown.flags.push('LOW_ISIN_MATCH');
      breakdown.recommendations.push('Consider manual ISIN lookup for unmatched holdings');
    }

    const holdingsWithDate = holdings.filter(h => h.purchaseDate && h.purchaseDateSource !== 'unresolved').length;
    breakdown.components.dateResolution = holdingsWithDate / Math.max(holdings.length, 1);
    if (breakdown.components.dateResolution < 0.5) {
      breakdown.flags.push('LOW_DATE_RESOLUTION');
    }

    const holdingsWithValue = holdings.filter(h => h.currentValue && h.currentValue > 0).length;
    breakdown.components.valueAccuracy = holdingsWithValue / Math.max(holdings.length, 1);

    breakdown.components.sourceQuality = profile.confidenceScore;

    breakdown.components.unitBalance = options.unitBalanceValid ? 1.0 : 0.5;
    if (!options.unitBalanceValid) {
      breakdown.flags.push('UNIT_BALANCE_MISMATCH');
    }

    breakdown.overall = (
      breakdown.components.isinMatch * 0.25 +
      breakdown.components.dateResolution * 0.2 +
      breakdown.components.valueAccuracy * 0.2 +
      breakdown.components.sourceQuality * 0.2 +
      breakdown.components.unitBalance * 0.15
    );

    if (breakdown.overall < this.minConfidenceThreshold) {
      breakdown.flags.push('BELOW_THRESHOLD');
    }

    return breakdown;
  }

  // ============================================
  // SUMMARY PDF DETECTION
  // ============================================

  private detectSummaryPDF(text: string, profile: PDFProfile): {
    isSummaryOnly: boolean;
    hasTransactionHistory: boolean;
    hasDetailedHoldings: boolean;
    requiresEnrichment: boolean;
    enrichmentSources: string[];
    confidence: number;
  } {
    const hasTransactions = /transaction\s*date|purchase.*\d{2}[-\/]\d{2}/i.test(text);
    const hasSummaryMarkers = /portfolio\s*summary|investment\s*summary|valuation\s*summary/i.test(text);
    const hasDetailedHoldings = /isin.*nav|folio.*units.*value/i.test(text);

    const isSummaryOnly = hasSummaryMarkers && !hasTransactions && !hasDetailedHoldings;
    const enrichmentSources: string[] = [];

    if (isSummaryOnly) {
      enrichmentSources.push('mf_central_api');
      enrichmentSources.push('bse_star_mfd');
    }

    if (profile.pdfType === 'aggregator_wealthy' || profile.pdfType === 'aggregator_indmoney') {
      enrichmentSources.push('cas_statement');
    }

    return {
      isSummaryOnly,
      hasTransactionHistory: hasTransactions,
      hasDetailedHoldings,
      requiresEnrichment: isSummaryOnly || enrichmentSources.length > 0,
      enrichmentSources,
      confidence: isSummaryOnly ? 0.6 : 0.9,
    };
  }

  // ============================================
  // LEARNING STORE
  // ============================================

  private findMatchingPattern(profile: PDFProfile): LearnedPattern | undefined {
    return learnedPatterns.get(profile.fingerprint);
  }

  private async storeLearnedPattern(profile: PDFProfile, result: {
    success: boolean;
    holdingsCount: number;
    confidenceScore: number;
  }): Promise<void> {
    const existing = learnedPatterns.get(profile.fingerprint);
    
    if (existing) {
      existing.successCount++;
      existing.lastUsed = new Date().toISOString();
      existing.avgHoldingsCount = (existing.avgHoldingsCount + result.holdingsCount) / 2;
      existing.avgConfidenceScore = (existing.avgConfidenceScore + result.confidenceScore) / 2;
    } else {
      learnedPatterns.set(profile.fingerprint, {
        fingerprint: profile.fingerprint,
        pdfType: profile.pdfType,
        layoutType: profile.layoutType,
        headerPatterns: profile.headerPatterns,
        columnOrder: profile.columnOrder,
        successCount: 1,
        lastUsed: new Date().toISOString(),
        avgHoldingsCount: result.holdingsCount,
        avgConfidenceScore: result.confidenceScore,
      });
    }
  }

  // ============================================
  // OBSERVABILITY
  // ============================================

  private createParsingLog(eventType: string, data: Partial<ParsingLogEntry>): void {
    const entry: ParsingLogEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      sessionId: crypto.randomUUID(),
      ...data,
    };
    parsingHistory.push(entry);

    if (parsingHistory.length > 1000) {
      parsingHistory.splice(0, 100);
    }
  }

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

  // ============================================
  // CACHE MANAGEMENT
  // ============================================

  clearProfileCache(): void {
    profileCache.clear();
    console.log('[UnifiedPDFParser] Profile cache cleared');
  }

  clearParseCache(): void {
    profileCache.clear();
    learnedPatterns.clear();
    console.log('[UnifiedPDFParser] All caches cleared');
  }

  getProfileCacheStats(): { size: number; entries: string[] } {
    return {
      size: profileCache.size,
      entries: Array.from(profileCache.keys()).map(k => k.substring(0, 8)),
    };
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  setLearningEnabled(enabled: boolean): void {
    this.enableLearning = enabled;
    console.log(`[UnifiedPDFParser] Learning ${enabled ? 'enabled' : 'disabled'}`);
  }

  setMinConfidenceThreshold(threshold: number): void {
    this.minConfidenceThreshold = Math.max(0, Math.min(1, threshold));
    console.log(`[UnifiedPDFParser] Min confidence threshold set to ${this.minConfidenceThreshold}`);
  }

  getLearningEnabled(): boolean {
    return this.enableLearning;
  }

  getMinConfidenceThreshold(): number {
    return this.minConfidenceThreshold;
  }

  getConfig(): { enableLearning: boolean; minConfidenceThreshold: number } {
    return {
      enableLearning: this.enableLearning,
      minConfidenceThreshold: this.minConfidenceThreshold,
    };
  }
}

export const unifiedPDFParser = UnifiedPDFParser.getInstance();
