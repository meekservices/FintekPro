import { liveMFDataService } from './live-mf-data-service';
import { holdingLotsStorageService, LotStorageInput } from './holding-lots-storage-service';
import { fifoLotLedgerService, LotLedgerResult } from './fifo-lot-ledger-service';

/**
 * Parse CAS statement date format (DD-Mon-YYYY or DD/Mon/YYYY)
 * Examples: 18-Mar-2024, 02/Jul/2024, 29-Oct-2024
 */
export function parseCASDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const match = dateStr.match(/(\d{1,2})[-\/]([A-Za-z]{3})[-\/](\d{4})/);
  if (!match) return null;
  
  const [, dayStr, monthStr, yearStr] = match;
  const monthMap: Record<string, number> = {
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
    'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
  };
  
  const month = monthMap[monthStr.toLowerCase()];
  if (month === undefined) return null;
  
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  
  if (isNaN(day) || isNaN(year) || day < 1 || day > 31) return null;
  
  return new Date(year, month, day);
}

export function formatDateToISO(date: Date | null): string | null {
  if (!date || isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

export interface CASInvestorInfo {
  email?: string;
  name?: string;
  pan?: string;
  mobile?: string;
  address?: string;
}

export interface CASNomineeDetails {
  nominee1?: string;
  nominee2?: string;
  nominee3?: string;
}

export interface CASTransaction {
  id: string;
  folioNumber: string;
  isin: string;
  schemeName: string;
  transactionDate: string;
  transactionType: 'Purchase' | 'Redemption' | 'Switch In' | 'Switch Out' | 'SIP' | 'Dividend' | 'Bonus' | 'Reinvestment' | 'STT' | 'Other';
  amount: number;
  units: number;
  nav: number;
  balance: number;
  description: string;
  stampDuty?: number;
  isCredit: boolean;
}

/**
 * Tiered Holding Classification (Epic T1-T3)
 * - FULL: Complete holding with transactions and lot data (Tier 1)
 * - VALUATION_ONLY: NAV + Market Value but no/incomplete transactions (Tier 2)
 * - SUMMARY_PLACEHOLDER: From CAS summary, missing from parsed holdings (Tier 3)
 */
export type HoldingTier = 'FULL' | 'VALUATION_ONLY' | 'SUMMARY_PLACEHOLDER';

export interface CASHolding {
  id: string;
  folioNumber: string;
  isin: string;
  schemeCode?: string;
  schemeName: string;
  amcName?: string;
  costValue: number;
  unitBalance: number;
  openingUnitBalance: number;
  navDate?: string;
  nav: number;
  marketValue: number;
  registrar: 'CAMS' | 'KFINTECH' | 'UNKNOWN';
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
  avgCostPerUnit?: number;
  assetType: 'mutual_fund' | 'etf' | 'equity' | 'bond' | 'other';
  planType?: 'Regular' | 'Direct';
  optionType?: 'Growth' | 'IDCW' | 'Dividend';
  isDemat: boolean;
  kycStatus?: string;
  advisorArn?: string;
  exitLoadText?: string;
  nomineeDetails?: CASNomineeDetails;
  transactions: CASTransaction[];
  firstPurchaseDate?: string;
  holderName?: string;
  holdingTier: HoldingTier;
  eligibleForTax: boolean;
  tierWarnings?: string[];
}

export interface CASPortfolioSummaryEntry {
  amcName: string;
  costValue: number;
  marketValue: number;
}

export interface CASPortfolioSummary {
  entries: CASPortfolioSummaryEntry[];
  totalCostValue: number;
  totalMarketValue: number;
}

/**
 * Epic 4.1: Per-holding confidence and reconciliation metadata
 */
export interface HoldingConfidence {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  reconciliationDelta: number;
  warnings: string[];
  missingFields: string[];
}

/**
 * Epic 1.3: Reconciliation result with strict validation
 */
export interface ReconciliationResult {
  passed: boolean;
  parsedTotal: number;
  expectedTotal: number;
  delta: number;
  deltaPercent: number;
  errorCode?: 'CAS_RECONCILIATION_ERROR' | 'CAS_PARTIAL_RECONCILIATION';
  message: string;
}

export interface CASStatementResult {
  success: boolean;
  statementType: 'holding' | 'transaction' | 'combined';
  statementDate?: string;
  statementPeriod?: { from: string; to: string };
  investor: CASInvestorInfo;
  holdings: CASHolding[];
  transactions: CASTransaction[];
  portfolioSummary?: CASPortfolioSummary;
  reconciliation?: ReconciliationResult;
  holdingConfidence: Map<string, HoldingConfidence>;
  lotLedger?: {
    results: LotLedgerResult[];
    summary: {
      totalHoldings: number;
      successfulLedgers: number;
      totalLots: number;
      reconciledCount: number;
      warnings: string[];
    };
  };
  summary: {
    totalHoldings: number;
    totalInvestedValue: number;
    totalCurrentValue: number;
    totalUnrealizedGain: number;
    totalUnrealizedGainPercent: number;
    registrarBreakdown: {
      cams: { count: number; value: number };
      kfintech: { count: number; value: number };
    };
  };
  errors: string[];
  warnings: string[];
  confidenceScore: number;
}

class CASStatementService {
  private static instance: CASStatementService;
  
  private constructor() {
    console.log('✅ CAS Statement Service initialized (v4 - Multi-Scheme Parser)');
  }
  
  static getInstance(): CASStatementService {
    if (!CASStatementService.instance) {
      CASStatementService.instance = new CASStatementService();
    }
    return CASStatementService.instance;
  }
  
  async parseStatement(text: string): Promise<CASStatementResult> {
    const result: CASStatementResult = {
      success: false,
      statementType: 'combined',
      investor: {},
      holdings: [],
      transactions: [],
      holdingConfidence: new Map<string, HoldingConfidence>(),
      summary: {
        totalHoldings: 0,
        totalInvestedValue: 0,
        totalCurrentValue: 0,
        totalUnrealizedGain: 0,
        totalUnrealizedGainPercent: 0,
        registrarBreakdown: {
          cams: { count: 0, value: 0 },
          kfintech: { count: 0, value: 0 }
        }
      },
      errors: [],
      warnings: [],
      confidenceScore: 0
    };
    
    try {
      console.log('[CAS Service v4] Starting multi-scheme parse...');
      console.log('[CAS Service v4] Text length:', text.length);
      
      // Normalize text: ensure date patterns start on new lines
      // This handles PDFs where text is extracted without proper line breaks
      text = this.normalizeTextForParsing(text);
      
      result.investor = this.extractInvestorInfo(text);
      result.statementPeriod = this.extractStatementPeriod(text);
      
      console.log('[CAS Service v4] Investor:', result.investor.name || 'Unknown');
      console.log('[CAS Service v4] PAN:', result.investor.pan || 'Not found');
      
      // Extract Portfolio Summary first - this is the source of truth
      result.portfolioSummary = this.extractPortfolioSummary(text);
      if (result.portfolioSummary) {
        console.log(`[CAS Service v4] Portfolio Summary: ${result.portfolioSummary.entries.length} AMCs`);
        console.log(`[CAS Service v4] Summary Total Cost: ₹${(result.portfolioSummary.totalCostValue / 100000).toFixed(2)} L`);
        console.log(`[CAS Service v4] Summary Total Market: ₹${(result.portfolioSummary.totalMarketValue / 100000).toFixed(2)} L`);
      }
      
      // Tiered Parsing: Extract scheme blocks with fallback recovery
      const { blocks: schemeBlocks, droppedForTier2 } = this.splitBySchemeBlocks(text);
      console.log('[CAS Service v4] Found', schemeBlocks.length, 'Tier 1 scheme blocks');
      
      // === TIER 1: Full parsing with transactions ===
      for (let i = 0; i < schemeBlocks.length; i++) {
        try {
          const holding = this.parseSchemeBlock(schemeBlocks[i], i);
          if (holding) {
            result.holdings.push(holding);
            result.transactions.push(...holding.transactions);
          }
        } catch (error: any) {
          console.warn('[CAS Service v4] Failed to parse scheme block', i, ':', error.message);
          result.warnings.push(`Scheme block ${i}: ${error.message}`);
        }
      }
      
      // Track ISINs already parsed in Tier 1
      const tier1ISINs = new Set(result.holdings.map(h => h.isin));
      
      // === TIER 2: Valuation-only fallback for dropped blocks ===
      let tier2RecoveryCount = 0;
      for (let i = 0; i < droppedForTier2.length; i++) {
        const { isin, blockText } = droppedForTier2[i];
        
        // Skip if already parsed in Tier 1
        if (tier1ISINs.has(isin)) continue;
        
        try {
          const tier2Holding = this.parseTier2ValuationOnlyBlock(blockText, isin, result.holdings.length);
          if (tier2Holding) {
            result.holdings.push(tier2Holding);
            tier2RecoveryCount++;
          }
        } catch (error: any) {
          console.warn('[CAS Service v4] Tier 2 recovery failed for', isin, ':', error.message);
        }
      }
      
      if (tier2RecoveryCount > 0) {
        console.log(`[CAS Service v4] Tier 2 recovered ${tier2RecoveryCount} valuation-only holdings`);
        result.warnings.push(`${tier2RecoveryCount} holdings imported without transaction history. Capital gains not computed for these.`);
      }
      
      // === TIER 3: Summary Diff Injection ===
      // Compare parsed AMC totals against CAS summary to inject placeholders for missing value
      if (result.portfolioSummary) {
        const tier3Holdings = this.applyTier3SummaryDiffInjection(result.holdings, result.portfolioSummary);
        if (tier3Holdings.length > 0) {
          result.holdings.push(...tier3Holdings);
          console.log(`[CAS Service v4] Tier 3 injected ${tier3Holdings.length} placeholder holdings for missing AMC value`);
          result.warnings.push(`${tier3Holdings.length} holdings require manual review - imported from CAS summary only.`);
        }
      }
      
      // Epic 1.3: Calculate pre-enrichment summary for strict reconciliation
      // Reconciliation must compare CAS-reported values against parsed values BEFORE database enrichment
      const preEnrichmentSummary = this.calculateSummary(result.holdings);
      
      // Epic 1.3: Strict reconciliation guardrail (before enrichment)
      if (result.portfolioSummary) {
        const preEnrichmentResult = { ...result, summary: preEnrichmentSummary };
        result.reconciliation = this.performStrictReconciliation(preEnrichmentResult, result.portfolioSummary);
        
        if (!result.reconciliation.passed) {
          // Reconciliation failed - but still return parsed holdings with warning
          // Agent can review and approve manually
          console.error(`[CAS Service v4] RECONCILIATION FAILED: ${result.reconciliation.message}`);
          result.warnings.push(`Reconciliation warning: ${result.reconciliation.message}`);
          result.warnings.push('Holdings parsed but may be incomplete. Please review before using for tax calculations.');
          
          // Mark all holdings as not eligible for tax (conservative approach)
          result.holdings.forEach(h => {
            h.eligibleForTax = false;
            h.tierWarnings = h.tierWarnings || [];
            h.tierWarnings.push('Reconciliation failed - verify holdings before tax calculations');
          });
          
          // Allow import to succeed if we have holdings - agent can review
          result.success = result.holdings.length > 0;
        } else {
          result.success = result.holdings.length > 0;
          if (result.reconciliation.deltaPercent > 0.1) {
            result.warnings.push(`Minor reconciliation delta: ${result.reconciliation.deltaPercent.toFixed(2)}%`);
          }
        }
      } else {
        // No portfolio summary - success if we have holdings, but add warning
        result.success = result.holdings.length > 0;
        result.warnings.push('No Portfolio Summary found for validation - reconciliation skipped');
      }
      
      // Database enrichment happens AFTER reconciliation to update with latest NAVs
      if (result.holdings.length > 0) {
        result.holdings = await this.enrichHoldingsWithDatabase(result.holdings);
      }
      
      // Final summary with enriched values
      result.summary = this.calculateSummary(result.holdings);
      
      // Epic 4.1: Build per-holding confidence scores
      result.holdingConfidence = this.buildHoldingConfidence(result.holdings);
      
      result.confidenceScore = this.calculateConfidenceScore(result);
      
      // Epic 2: Build FIFO lot ledger for all holdings
      if (result.holdings.length > 0) {
        result.lotLedger = fifoLotLedgerService.processAllHoldings(result.holdings);
        console.log(`[CAS Service v4] Lot Ledger: ${result.lotLedger.summary.totalLots} lots across ${result.lotLedger.summary.successfulLedgers} holdings`);
        
        // Add lot reconciliation warnings
        for (const lotResult of result.lotLedger.results) {
          if (lotResult.reconciliation.warning) {
            result.warnings.push(`${lotResult.isin}: ${lotResult.reconciliation.warning}`);
          }
        }
      }
      
      console.log('[CAS Service v4] Parse complete:', {
        holdings: result.holdings.length,
        transactions: result.transactions.length,
        totalInvested: result.summary.totalInvestedValue.toFixed(2),
        totalValue: result.summary.totalCurrentValue.toFixed(2),
        expectedTotal: result.portfolioSummary?.totalMarketValue.toFixed(2) || 'N/A',
        confidence: result.confidenceScore
      });
      
    } catch (error: any) {
      console.error('[CAS Service v4] Parse error:', error);
      result.errors.push(`Parse error: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Normalize text for parsing by ensuring date patterns start on new lines.
   * This fixes issues where PDF text extraction doesn't preserve proper line breaks.
   */
  private normalizeTextForParsing(text: string): string {
    // CAS date format: DD-Mon-YYYY (e.g., 01-Aug-2023, 18-Mar-2024)
    // Insert newline before date patterns that are preceded by non-newline chars
    // This ensures each transaction starts on its own line
    
    // Pattern: digit followed by date pattern (e.g., "83.85501-Aug-2023" -> "83.855\n01-Aug-2023")
    let normalized = text.replace(
      /(\d)(\d{2}-[A-Za-z]{3}-\d{4})/g, 
      '$1\n$2'
    );
    
    // Pattern: letter followed by date pattern (e.g., "OK01-Aug-2023" -> "OK\n01-Aug-2023")
    normalized = normalized.replace(
      /([A-Za-z])(\d{2}-[A-Za-z]{3}-\d{4})/g,
      '$1\n$2'
    );
    
    // Pattern: closing paren or asterisk followed by date (e.g., "***01-Aug-2023" -> "***\n01-Aug-2023")
    normalized = normalized.replace(
      /(\*{3}|\))(\d{2}-[A-Za-z]{3}-\d{4})/g,
      '$1\n$2'
    );
    
    // Ensure "Closing Unit Balance" starts on new line
    normalized = normalized.replace(
      /([^\n])(Closing Unit Balance)/gi,
      '$1\n$2'
    );
    
    // Ensure "Opening Unit Balance" starts on new line
    normalized = normalized.replace(
      /([^\n])(Opening Unit Balance)/gi,
      '$1\n$2'
    );
    
    // Ensure "Folio No:" starts on new line
    normalized = normalized.replace(
      /([^\n])(Folio No:)/gi,
      '$1\n$2'
    );
    
    // Ensure "ISIN:" has proper spacing
    normalized = normalized.replace(
      /([^\n\s])(ISIN:)/gi,
      '$1\n$2'
    );
    
    // Debug: Log normalization details
    const originalLines = text.split('\n').length;
    const normalizedLines = normalized.split('\n').length;
    console.log(`[CAS Service v4] Text normalization: ${originalLines} -> ${normalizedLines} lines (added ${normalizedLines - originalLines})`);
    
    // Log sample of date patterns found after normalization
    const dateLines = normalized.split('\n').filter(line => /^\d{2}-[A-Za-z]{3}-\d{4}/.test(line.trim()));
    console.log(`[CAS Service v4] Found ${dateLines.length} lines starting with dates after normalization`);
    
    return normalized;
  }
  
  private extractInvestorInfo(text: string): CASInvestorInfo {
    const info: CASInvestorInfo = {};
    
    const emailMatch = text.match(/Email\s*(?:Id)?[:\s]+([^\s@]+@[^\s@]+\.[^\s@]+)/i);
    if (emailMatch) info.email = emailMatch[1].trim();
    
    const mobileMatch = text.match(/Mobile[:\s]+(\d{10})/i);
    if (mobileMatch) info.mobile = mobileMatch[1];
    
    const panMatch = text.match(/PAN[:\s]+([A-Z]{5}\d{4}[A-Z])/i);
    if (panMatch) info.pan = panMatch[1];
    
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const line = lines[i];
      if (line.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+/) && 
          !line.includes('Consolidated') && 
          !line.includes('Statement') &&
          !line.includes('Email') &&
          !line.includes('Mobile') &&
          !line.includes('Mutual Fund') &&
          line.length < 50) {
        info.name = line.trim();
        break;
      }
    }
    
    return info;
  }
  
  private extractStatementPeriod(text: string): { from: string; to: string } | undefined {
    const periodMatch = text.match(/(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})\s*To\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})/i);
    if (periodMatch) {
      return { from: periodMatch[1], to: periodMatch[2] };
    }
    return undefined;
  }
  
  /**
   * Extract Portfolio Summary from CAS statement header.
   * This provides AMC-wise totals which serve as the source of truth.
   * 
   * Format:
   * PORTFOLIO SUMMARY
   *                                     Cost Value    Market Value
   * Mutual Fund including SIF             (INR)          (INR)
   * ICICI Prudential Mutual Fund       2,132,044.04   2,601,202.77
   * ...
   *                     Total          13,678,248.63  16,844,766.49
   */
  private extractPortfolioSummary(text: string): CASPortfolioSummary | undefined {
    try {
      const summaryMatch = text.match(/PORTFOLIO\s+SUMMARY[\s\S]*?(?=Date\s+Transaction|Folio No:|$)/i);
      if (!summaryMatch) {
        console.log('[CAS Service v4] Portfolio Summary section not found');
        return undefined;
      }
      
      const summaryText = summaryMatch[0];
      const entries: CASPortfolioSummaryEntry[] = [];
      let totalCostValue = 0;
      let totalMarketValue = 0;
      
      // Known AMC names to match (handles multi-line and partial names)
      const amcPatterns = [
        'ICICI Prudential Mutual Fund',
        'HDFC Mutual Fund',
        'DSP Mutual Fund',
        'SBI Mutual Fund',
        'HSBC Mutual Fund',
        'Franklin Templeton Mutual Fund',
        'Bandhan Mutual Fund',
        'NAVI MF',
        '360 ONE Mutual Fund',
        'Bajaj Finserv Mutual Fund',
        'MOTILAL OSWAL MUTUAL FUND',
        'Sundaram Mutual Fund',
        'Nippon India Mutual Fund',
        'Axis Mutual Fund',
        'Kotak Mutual Fund',
        'Aditya Birla Sun Life Mutual Fund',
        'UTI Mutual Fund',
        'Tata Mutual Fund',
        'Mirae Asset Mutual Fund',
        'PGIM India Mutual Fund',
        'Invesco Mutual Fund',
        'Canara Robeco Mutual Fund',
        'Edelweiss Mutual Fund',
        'Quantum Mutual Fund',
        'PPFAS Mutual Fund',
        'Parag Parikh Mutual Fund',
        'Quant Mutual Fund',
        'L&T Mutual Fund',
        'Baroda BNP Paribas Mutual Fund',
        'JM Financial Mutual Fund',
        'Groww Mutual Fund',
        'WhiteOak Capital Mutual Fund',
        'ITI Mutual Fund',
        'Samco Mutual Fund',
        'NJ Mutual Fund',
        'Helios Mutual Fund',
        'Trust Mutual Fund',
        'Old Bridge Mutual Fund',
        'Zerodha Fund House',
        'Mahindra Manulife Mutual Fund',
        'Bank of India Mutual Fund',
        'IDBI Mutual Fund',
        'LIC Mutual Fund',
        'Principal Mutual Fund',
        'Union Mutual Fund',
        'Shriram Mutual Fund',
        'IIFL Mutual Fund',
        'NAVI Mutual Fund',
        '360 ONE Mutual Fund',
        'Motilal Oswal Mutual Fund'
      ];
      
      // Split by lines and look for AMC entries with amounts
      const lines = summaryText.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if this line contains "Total" - this is the grand total line
        if (line.toLowerCase().includes('total') && !line.toLowerCase().includes('mutual fund')) {
          // Extract total values - look for two large numbers
          const totalMatch = line.match(/Total\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/i);
          if (totalMatch) {
            totalCostValue = parseFloat(totalMatch[1].replace(/,/g, ''));
            totalMarketValue = parseFloat(totalMatch[2].replace(/,/g, ''));
            console.log(`[CAS Service v4] Portfolio Summary Total - Cost: ${totalCostValue}, Market: ${totalMarketValue}`);
          } else {
            // Try alternative pattern - numbers might be on same line but different format
            const numbers = line.match(/[\d,]+\.?\d*/g);
            if (numbers && numbers.length >= 2) {
              const vals = numbers.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => n > 10000);
              if (vals.length >= 2) {
                totalCostValue = vals[vals.length - 2];
                totalMarketValue = vals[vals.length - 1];
                console.log(`[CAS Service v4] Portfolio Summary Total (alt) - Cost: ${totalCostValue}, Market: ${totalMarketValue}`);
              }
            }
          }
          continue;
        }
        
        // Look for AMC names and their corresponding values
        for (const amcName of amcPatterns) {
          if (line.toLowerCase().includes(amcName.toLowerCase().substring(0, 15))) {
            // Found an AMC - extract values from this line and possibly next line
            const combinedLine = line + ' ' + (lines[i + 1] || '');
            
            // Extract two consecutive numbers (cost and market value)
            const numbers = combinedLine.match(/[\d,]+\.?\d*/g);
            if (numbers && numbers.length >= 2) {
              const vals = numbers.map(n => parseFloat(n.replace(/,/g, ''))).filter(n => n > 1000);
              if (vals.length >= 2) {
                entries.push({
                  amcName: amcName,
                  costValue: vals[vals.length - 2],
                  marketValue: vals[vals.length - 1]
                });
                console.log(`[CAS Service v4] Portfolio Summary: ${amcName} - Cost: ${vals[vals.length - 2]}, Market: ${vals[vals.length - 1]}`);
              }
            }
            break;
          }
        }
      }
      
      if (entries.length === 0 && totalCostValue === 0) {
        console.log('[CAS Service v4] Could not parse Portfolio Summary entries');
        return undefined;
      }
      
      // If we found entries but not total, calculate from entries
      if (totalCostValue === 0 && entries.length > 0) {
        totalCostValue = entries.reduce((sum, e) => sum + e.costValue, 0);
        totalMarketValue = entries.reduce((sum, e) => sum + e.marketValue, 0);
      }
      
      console.log(`[CAS Service v4] Portfolio Summary: ${entries.length} AMCs, Total Cost: ${totalCostValue}, Total Market: ${totalMarketValue}`);
      
      return {
        entries,
        totalCostValue,
        totalMarketValue
      };
    } catch (error: any) {
      console.error('[CAS Service v4] Error extracting Portfolio Summary:', error.message);
      return undefined;
    }
  }
  
  /**
   * Tier 2: Parse valuation-only holdings from dropped blocks
   * These are holdings that have NAV + Market Value but no closing balance or transactions
   */
  private parseTier2ValuationOnlyBlock(blockText: string, isin: string, index: number): CASHolding | null {
    // Extract basic info even without closing balance
    const folioMatch = blockText.match(/Folio No:\s*([\d\/\s]+)/i);
    const folioNumber = folioMatch ? folioMatch[1].replace(/\s/g, '').trim() : 'unknown';
    const isDemat = /\(Demat\)/i.test(blockText) && !/\(Non-?Demat\)/i.test(blockText);
    
    // Extract NAV
    let nav = 0;
    const navPatterns = [
      /NAV on\s+[\d-]+[A-Za-z-]+[\d]+:\s*INR\s*([\d,]+\.?\d*)/i,
      /NAV[:\s]*([\d,]+\.?\d*)/i
    ];
    for (const pattern of navPatterns) {
      const match = blockText.match(pattern);
      if (match) {
        nav = this.parseNumber(match[1]);
        if (nav > 0) break;
      }
    }
    
    // Extract Market Value
    let marketValue = 0;
    const marketPatterns = [
      /Market Value\s*(?:on\s+[\d-]+[A-Za-z-]+[\d]+)?:\s*INR\s*([\d,]+\.?\d*)/i,
      /Valuation[:\s]*([\d,]+\.?\d*)/i,
      /Current Value[:\s]*([\d,]+\.?\d*)/i
    ];
    for (const pattern of marketPatterns) {
      const match = blockText.match(pattern);
      if (match) {
        marketValue = this.parseNumber(match[1]);
        if (marketValue > 0) break;
      }
    }
    
    if (nav <= 0 || marketValue <= 0) {
      return null; // Cannot recover without NAV and market value
    }
    
    // Infer units from market value / NAV
    const unitBalance = nav > 0 ? marketValue / nav : 0;
    
    // Extract cost value if available
    let costValue = 0;
    const costPatterns = [
      /Total Cost(?: Value)?:\s*(?:INR\s*)?([\d,]+\.?\d*)/i,
      /Cost Value:\s*(?:INR\s*)?([\d,]+\.?\d*)/i
    ];
    for (const pattern of costPatterns) {
      const match = blockText.match(pattern);
      if (match) {
        costValue = this.parseNumber(match[1]);
        if (costValue > 0) break;
      }
    }
    
    // Use market value as fallback for cost (conservative)
    if (costValue <= 0) {
      costValue = marketValue;
    }
    
    // Extract scheme name
    let schemeName = `Mutual Fund (${isin})`;
    const schemeMatch = blockText.match(/([A-Z][A-Za-z0-9\s&-]+(?:Fund|Growth|IDCW|Dividend|Plan))/i);
    if (schemeMatch) {
      schemeName = schemeMatch[1].trim().substring(0, 100);
    }
    
    const registrar: 'CAMS' | 'KFINTECH' | 'UNKNOWN' = /KFINTECH|KARVY/i.test(blockText) 
      ? 'KFINTECH' 
      : /CAMS/i.test(blockText) 
        ? 'CAMS' 
        : 'UNKNOWN';
    
    console.log(`[CAS Service Tier2] Recovered valuation-only: ${isin} | Folio ${folioNumber} | Units: ${unitBalance.toFixed(3)} | Market: ${marketValue.toFixed(2)}`);
    
    return {
      id: `cas-tier2-${isin}-${folioNumber}-${index}`,
      folioNumber,
      isin,
      schemeName,
      costValue,
      unitBalance,
      openingUnitBalance: 0,
      nav,
      marketValue,
      registrar,
      assetType: 'mutual_fund',
      isDemat,
      transactions: [],
      holdingTier: 'VALUATION_ONLY',
      eligibleForTax: false,
      tierWarnings: ['Recovered from valuation-only block - no transaction history available']
    };
  }

  /**
   * Tier 3: Create placeholder holdings from CAS summary for missing schemes
   * These are flagged as requiring manual review
   */
  private createTier3PlaceholderHolding(amcName: string, costValue: number, marketValue: number, index: number): CASHolding {
    const placeholderId = `cas-tier3-placeholder-${index}`;
    
    console.log(`[CAS Service Tier3] Created placeholder for ${amcName}: Cost ${costValue.toFixed(2)}, Market ${marketValue.toFixed(2)}`);
    
    return {
      id: placeholderId,
      folioNumber: 'PLACEHOLDER',
      isin: 'PLACEHOLDER',
      schemeName: `${amcName} - Unrecognized Holdings`,
      amcName,
      costValue,
      unitBalance: 0,
      openingUnitBalance: 0,
      nav: 0,
      marketValue,
      registrar: 'UNKNOWN',
      assetType: 'mutual_fund',
      isDemat: false,
      transactions: [],
      holdingTier: 'SUMMARY_PLACEHOLDER',
      eligibleForTax: false,
      tierWarnings: ['Manual review required - holdings not found in parsed data']
    };
  }

  /**
   * Tier 3: Summary Diff Injection (CONSERVATIVE MODE)
   * Only injects placeholders for AMCs that are COMPLETELY missing from parsed holdings
   * Does NOT inject for under-parsed AMCs to avoid duplicate counting
   * 
   * IMPORTANT: This is conservative by design. Missing individual schemes within an AMC
   * should be caught by Tier 2, not filled with placeholders that corrupt tax calculations.
   */
  private applyTier3SummaryDiffInjection(
    holdings: CASHolding[], 
    summary: CASPortfolioSummary
  ): CASHolding[] {
    const injectedHoldings: CASHolding[] = [];
    
    // Calculate parsed value per AMC with multiple name variations for matching
    const parsedByAMC = new Map<string, { costValue: number; marketValue: number }>();
    const amcNameVariations = new Map<string, string[]>(); // normalized -> original names
    
    for (const holding of holdings) {
      const originalAMC = holding.amcName || 'Unknown';
      const normalized = this.normalizeAMCName(originalAMC);
      
      const current = parsedByAMC.get(normalized) || { costValue: 0, marketValue: 0 };
      current.costValue += holding.costValue;
      current.marketValue += holding.marketValue;
      parsedByAMC.set(normalized, current);
      
      // Track variations
      if (!amcNameVariations.has(normalized)) {
        amcNameVariations.set(normalized, []);
      }
      if (!amcNameVariations.get(normalized)!.includes(originalAMC)) {
        amcNameVariations.get(normalized)!.push(originalAMC);
      }
    }
    
    // Only inject for COMPLETELY missing AMCs
    let placeholderIndex = 0;
    for (const entry of summary.entries) {
      const normalizedEntry = this.normalizeAMCName(entry.amcName);
      
      // Try exact normalized match first
      let parsed = parsedByAMC.get(normalizedEntry);
      
      // If not found, try fuzzy match (first word match)
      if (!parsed) {
        const firstWord = normalizedEntry.split(' ')[0];
        for (const [key, value] of parsedByAMC) {
          if (key.startsWith(firstWord) || key.includes(firstWord)) {
            parsed = value;
            break;
          }
        }
      }
      
      if (!parsed) {
        // AMC completely missing - inject placeholder with warning
        console.log(`[CAS Service Tier3] AMC "${entry.amcName}" not found in parsed holdings: Expected ₹${(entry.marketValue / 100000).toFixed(2)} L`);
        injectedHoldings.push(this.createTier3PlaceholderHolding(
          entry.amcName,
          entry.costValue,
          entry.marketValue,
          placeholderIndex++
        ));
      }
      // Note: We deliberately do NOT inject for under-parsed AMCs
      // This prevents double-counting and ensures conservative behavior
    }
    
    return injectedHoldings;
  }

  /**
   * Normalize AMC name for comparison
   */
  private normalizeAMCName(name: string): string {
    return name
      .toLowerCase()
      .replace(/mutual\s*fund/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Split CAS statement by scheme blocks using explicit anchors.
   * 
   * Epic 1.1: Robust Scheme Block Segmentation
   * - Segments using ISIN + Folio + Demat anchors
   * - Enforces 1 schemeText = 1 (ISIN + Folio + Demat)
   * - Prevents silent drops and overwrites
   * - Handles same ISIN across multiple folios correctly
   * 
   * Returns both valid blocks and dropped blocks for Tier 2 recovery
   */
  private splitBySchemeBlocks(text: string): { blocks: string[]; droppedForTier2: { isin: string; blockText: string }[] } {
    const blocks: string[] = [];
    const droppedForTier2: { isin: string; blockText: string }[] = [];
    const seenHoldings = new Map<string, { index: number; preview: string }>();
    const droppedBlocks: { reason: string; preview: string }[] = [];
    
    // Step 1: Find all ISIN occurrences as primary anchors
    // ISIN format: INF/INE/IN0 followed by 9 alphanumeric characters
    const isinPattern = /(INF[A-Z0-9]{9}|INE[A-Z0-9]{9}|IN0[A-Z0-9]{9})/g;
    const isinMatches: { isin: string; index: number }[] = [];
    
    let match;
    while ((match = isinPattern.exec(text)) !== null) {
      isinMatches.push({ isin: match[1], index: match.index });
    }
    
    console.log(`[CAS Service v4] Found ${isinMatches.length} ISIN occurrences`);
    
    // Step 2: For each ISIN, extract the complete scheme block
    for (let i = 0; i < isinMatches.length; i++) {
      const { isin, index: isinIndex } = isinMatches[i];
      
      // Find block boundaries
      // Start: Look backward for "Folio No:" before this ISIN
      let blockStart = isinIndex - 3000;
      blockStart = Math.max(0, blockStart);
      
      const textBeforeIsin = text.substring(blockStart, isinIndex);
      const folioPos = textBeforeIsin.lastIndexOf('Folio No:');
      
      if (folioPos > 0) {
        blockStart = blockStart + folioPos;
      } else {
        // No folio found - look for scheme name pattern instead
        const schemeLinePos = textBeforeIsin.lastIndexOf('\n');
        if (schemeLinePos > 0) {
          blockStart = blockStart + schemeLinePos;
        }
      }
      
      // End: Look forward for next ISIN or end of logical block
      let blockEnd: number;
      if (i < isinMatches.length - 1) {
        // Find the "Closing Unit Balance" or "NAV on" after this ISIN
        const closingPos = text.indexOf('Closing Unit Balance', isinIndex);
        const navLineEnd = text.indexOf('Market Value on', isinIndex);
        
        // Block ends after the market value line (add buffer for the value)
        const logicalEnd = Math.max(closingPos, navLineEnd);
        if (logicalEnd > 0 && logicalEnd < isinMatches[i + 1].index) {
          // Find end of line after market value
          const lineEnd = text.indexOf('\n', logicalEnd + 50);
          blockEnd = lineEnd > 0 ? lineEnd + 500 : logicalEnd + 1000;
        } else {
          blockEnd = isinMatches[i + 1].index - 50;
        }
      } else {
        // Last ISIN - go to end of text or reasonable buffer
        const closingPos = text.indexOf('Closing Unit Balance', isinIndex);
        if (closingPos > 0) {
          blockEnd = Math.min(text.length, closingPos + 1500);
        } else {
          blockEnd = Math.min(text.length, isinIndex + 3000);
        }
      }
      
      blockEnd = Math.min(text.length, blockEnd);
      
      const blockText = text.substring(blockStart, blockEnd);
      
      // Step 3: Validate block has required components
      const hasClosingBalance = /Closing Unit Balance:\s*[\d,]+\.?\d*/i.test(blockText);
      const hasCostValue = /Total Cost(?: Value)?:\s*[\d,]+\.?\d*/i.test(blockText);
      
      if (!hasClosingBalance) {
        droppedBlocks.push({
          reason: 'no_closing_balance',
          preview: `ISIN ${isin}: ${blockText.substring(0, 100).replace(/\n/g, ' ')}...`
        });
        // Save for Tier 2 recovery if has NAV or market value
        const hasNAV = /NAV[:\s]*([\d,]+\.?\d*)/i.test(blockText);
        const hasMarket = /Market Value|Valuation|Current Value/i.test(blockText);
        if (hasNAV || hasMarket) {
          droppedForTier2.push({ isin, blockText });
        }
        continue;
      }
      
      // Step 4: Extract unique holding key (ISIN + Folio + Demat)
      const folioMatch = blockText.match(/Folio No:\s*([\d\/\s]+)/i);
      const folioNumber = folioMatch ? folioMatch[1].replace(/\s/g, '').trim() : 'unknown';
      const isDemat = /\(Demat\)/i.test(blockText) && !/\(Non-?Demat\)/i.test(blockText);
      
      // Create unique holding key
      const holdingKey = `${isin}|${folioNumber}|${isDemat ? 'demat' : 'non-demat'}`;
      
      // Step 5: Check for duplicates - same ISIN+Folio+Demat should not appear twice
      if (seenHoldings.has(holdingKey)) {
        const existing = seenHoldings.get(holdingKey)!;
        droppedBlocks.push({
          reason: 'duplicate_holding',
          preview: `ISIN ${isin} Folio ${folioNumber}: Already processed at index ${existing.index}`
        });
        continue;
      }
      
      seenHoldings.set(holdingKey, { 
        index: blocks.length, 
        preview: blockText.substring(0, 80).replace(/\n/g, ' ') 
      });
      
      blocks.push(blockText);
    }
    
    // Log diagnostics
    console.log(`[CAS Service v4] Extracted ${blocks.length} unique scheme blocks from ${isinMatches.length} ISIN occurrences`);
    console.log(`[CAS Service v4] Unique holdings: ${seenHoldings.size}`);
    
    if (droppedBlocks.length > 0) {
      console.log(`[CAS Service v4] Dropped ${droppedBlocks.length} blocks:`);
      for (const dropped of droppedBlocks.slice(0, 5)) {
        console.log(`  - ${dropped.reason}: ${dropped.preview.substring(0, 100)}`);
      }
      if (droppedBlocks.length > 5) {
        console.log(`  ... and ${droppedBlocks.length - 5} more`);
      }
    }
    
    // Validate: Check for same ISIN across different folios (should be allowed)
    const isinToFolios = new Map<string, string[]>();
    for (const [key] of seenHoldings) {
      const [isin, folio] = key.split('|');
      if (!isinToFolios.has(isin)) {
        isinToFolios.set(isin, []);
      }
      isinToFolios.get(isin)!.push(folio);
    }
    
    // Log multi-folio ISINs (same scheme in multiple folios - valid scenario)
    for (const [isin, folios] of isinToFolios) {
      if (folios.length > 1) {
        console.log(`[CAS Service v4] ISIN ${isin} appears in ${folios.length} folios: ${folios.join(', ')}`);
      }
    }
    
    if (droppedForTier2.length > 0) {
      console.log(`[CAS Service v4] ${droppedForTier2.length} blocks available for Tier 2 valuation-only recovery`);
    }
    
    return { blocks, droppedForTier2 };
  }
  
  /**
   * Parse a single scheme block to extract holding and transaction data
   * Each block represents one mutual fund scheme (even if multiple schemes share a folio)
   */
  private parseSchemeBlock(blockText: string, index: number): CASHolding | null {
    let folioNumber = '';
    let pan = '';
    let kycStatus = '';
    
    const folioMatch = blockText.match(/Folio No:\s*([\d\/\s]+)/i);
    if (folioMatch) {
      folioNumber = folioMatch[1].replace(/\s/g, '').trim();
    }
    
    const panMatch = blockText.match(/PAN:\s*([A-Z]{5}\d{4}[A-Z])/i);
    if (panMatch) pan = panMatch[1];
    
    const kycMatch = blockText.match(/KYC:\s*(OK|PENDING|NOT\s*OK)/i);
    if (kycMatch) kycStatus = kycMatch[1].replace(/\s+/g, ' ');
    
    let isin = '';
    let schemeCode = '';
    let schemeName = '';
    
    const isinPatterns = [
      /([A-Z0-9]{2,10})\s*[-–]\s*([^-]+?)\s*[-–]\s*ISIN:\s*(INF[A-Z0-9]{9})/i,
      /([A-Z0-9]{2,10})-(.+?)\s*\([^)]*\)\s*-\s*ISIN:\s*(INF[A-Z0-9]{9})/i,
      /ISIN:\s*(INF[A-Z0-9]{9})/i
    ];
    
    for (const pattern of isinPatterns) {
      const isinMatch = blockText.match(pattern);
      if (isinMatch) {
        if (isinMatch.length >= 4) {
          schemeCode = isinMatch[1].trim();
          schemeName = isinMatch[2].trim()
            .replace(/\s+/g, ' ')
            .replace(/\([^)]*Non-?Demat[^)]*\)/gi, '')
            .replace(/\([^)]*Demat[^)]*\)/gi, '')
            .replace(/\s*[-–]\s*$/, '')
            .trim();
          isin = isinMatch[3].toUpperCase();
        } else {
          isin = isinMatch[1].toUpperCase();
          schemeName = `Mutual Fund (${isin})`;
        }
        break;
      }
    }
    
    if (!isin) {
      const isinOnlyMatch = blockText.match(/INF[A-Z0-9]{9}/);
      if (isinOnlyMatch) {
        isin = isinOnlyMatch[0].toUpperCase();
        schemeName = `Mutual Fund (${isin})`;
      }
    }
    
    if (!isin) {
      console.warn('[CAS Service v3] Folio block', index, 'has no ISIN');
      return null;
    }
    
    // PDF-parse extracts data in multi-line format:
    // Line 1: "Closing Unit Balance: X Total Cost Value: Y"
    // Line 2: "NAV on date: INR Z Market Value on date: INR W"
    // We need to extract from both lines separately
    
    let unitBalance = 0;
    let navDate = '';
    let nav = 0;
    let costValue = 0;
    let marketValue = 0;
    
    // Pattern 1: Original single-line format (for reference PDFs)
    const singleLinePattern = /Closing Unit Balance:\s*([\d,]+\.?\d*)\s+NAV on\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4}):\s*(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+Total Cost(?: Value)?:\s*([\d,]+\.?\d*)\s+Market Value on[^:]+:\s*(?:INR|Rs\.?)\s*([\d,]+\.?\d*)/i;
    const singleMatch = blockText.match(singleLinePattern);
    
    if (singleMatch && singleMatch.length >= 6) {
      unitBalance = this.parseNumber(singleMatch[1]);
      navDate = singleMatch[2] || '';
      nav = this.parseNumber(singleMatch[3]);
      costValue = this.parseNumber(singleMatch[4]);
      marketValue = this.parseNumber(singleMatch[5]);
      console.log(`[CAS Service v4] Single-line match: Units=${unitBalance}, Cost=${costValue}, Market=${marketValue}`);
    } else {
      // Pattern 2: Multi-line format from pdf-parse (common case)
      // Extract Units + Cost from "Closing Unit Balance: X Total Cost Value: Y"
      const closingCostPattern = /Closing Unit Balance:\s*([\d,]+\.?\d*)\s+Total Cost(?: Value)?:\s*([\d,]+\.?\d*)/i;
      const closingCostMatch = blockText.match(closingCostPattern);
      
      if (closingCostMatch) {
        unitBalance = this.parseNumber(closingCostMatch[1]);
        costValue = this.parseNumber(closingCostMatch[2]);
        console.log(`[CAS Service v4] Multi-line: Units=${unitBalance}, Cost=${costValue}`);
      } else {
        // Fallback: extract just units
        const unitsOnlyPattern = /Closing Unit Balance:\s*([\d,]+\.?\d*)/i;
        const unitsMatch = blockText.match(unitsOnlyPattern);
        if (unitsMatch) {
          unitBalance = this.parseNumber(unitsMatch[1]);
          console.log(`[CAS Service v4] Units-only: ${unitBalance}`);
        }
      }
      
      // Extract NAV and Market Value from separate line: "NAV on date: INR X Market Value on date: INR Y"
      const navMarketPattern = /NAV on\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4}):\s*(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+Market Value on[^:]+:\s*(?:INR|Rs\.?)\s*([\d,]+\.?\d*)/i;
      const navMarketMatch = blockText.match(navMarketPattern);
      
      if (navMarketMatch) {
        navDate = navMarketMatch[1];
        nav = this.parseNumber(navMarketMatch[2]);
        marketValue = this.parseNumber(navMarketMatch[3]);
        console.log(`[CAS Service v4] NAV+Market: NAV=${nav}, Market=${marketValue}, Date=${navDate}`);
      }
    }
    
    // Fallback NAV date extraction
    if (!navDate) {
      const navDateMatch = blockText.match(/NAV on\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})/i);
      if (navDateMatch) {
        navDate = navDateMatch[1];
      }
    }
    
    // Epic 1.2: Defensive logging for missing/incomplete valuation data
    const missingFields: string[] = [];
    if (unitBalance <= 0) missingFields.push('unitBalance');
    if (costValue <= 0) missingFields.push('costValue');
    if (nav <= 0) missingFields.push('nav');
    if (marketValue <= 0) missingFields.push('marketValue');
    if (!navDate) missingFields.push('navDate');
    
    if (missingFields.length > 0) {
      console.warn(`[CAS Service v4] WARN: Block ${index} (ISIN: ${isin}) missing fields: [${missingFields.join(', ')}]`);
      // Log the block content for debugging
      const blockPreview = blockText.substring(0, 300).replace(/\n/g, '\\n');
      console.warn(`[CAS Service v4] Block preview: ${blockPreview}...`);
    }
    
    // If we have units but no market value, try to compute from NAV
    if (unitBalance > 0 && marketValue <= 0 && nav > 0) {
      marketValue = unitBalance * nav;
      console.log(`[CAS Service v4] Computed marketValue from units*NAV: ${marketValue.toFixed(2)}`);
    }
    
    let registrar: 'CAMS' | 'KFINTECH' | 'UNKNOWN' = 'UNKNOWN';
    if (/Registrar\s*:\s*CAMS/i.test(blockText)) {
      registrar = 'CAMS';
    } else if (/Registrar\s*:\s*KFINTECH/i.test(blockText)) {
      registrar = 'KFINTECH';
    }
    
    let advisorArn = '';
    const arnMatch = blockText.match(/\(Advisor:\s*(ARN-\d+|DIRECT)\)/i);
    if (arnMatch) advisorArn = arnMatch[1];
    
    const isDemat = /\(Demat\)/i.test(blockText) && !/\(Non-?Demat\)/i.test(blockText);
    
    let planType: 'Regular' | 'Direct' | undefined;
    if (/Direct\s*Plan/i.test(schemeName) || advisorArn === 'DIRECT') {
      planType = 'Direct';
    } else if (/Regular\s*Plan/i.test(schemeName) || /ARN-\d+/i.test(advisorArn)) {
      planType = 'Regular';
    }
    
    let optionType: 'Growth' | 'IDCW' | 'Dividend' | undefined;
    if (/Growth/i.test(schemeName)) {
      optionType = 'Growth';
    } else if (/IDCW/i.test(schemeName) || /Dividend/i.test(schemeName)) {
      optionType = 'IDCW';
    }
    
    let amcName = '';
    const amcPatterns = [
      /^(\w+(?:\s+\w+)?\s+(?:Mutual\s+)?Fund)/im,
      /(\w+\s+Prudential\s+Mutual\s+Fund)/i,
      /(\w+\s+Finserv\s+Mutual\s+Fund)/i,
      /(\w+\s+Templeton\s+Mutual\s+Fund)/i
    ];
    for (const pattern of amcPatterns) {
      const amcMatch = blockText.match(pattern);
      if (amcMatch) {
        amcName = amcMatch[1].trim();
        break;
      }
    }
    
    const nomineeDetails: CASNomineeDetails = {};
    const nominee1Match = blockText.match(/Nominee\s*1:\s*([A-Za-z\s]+?)(?=\s*Nominee\s*2:|$)/i);
    if (nominee1Match && nominee1Match[1].trim()) nomineeDetails.nominee1 = nominee1Match[1].trim();
    const nominee2Match = blockText.match(/Nominee\s*2:\s*([A-Za-z\s]+?)(?=\s*Nominee\s*3:|$)/i);
    if (nominee2Match && nominee2Match[1].trim()) nomineeDetails.nominee2 = nominee2Match[1].trim();
    const nominee3Match = blockText.match(/Nominee\s*3:\s*([A-Za-z\s]+)/i);
    if (nominee3Match && nominee3Match[1].trim()) nomineeDetails.nominee3 = nominee3Match[1].trim();
    
    let openingUnitBalance = 0;
    const openingMatch = blockText.match(/Opening Unit Balance:\s*([\d,]+\.?\d*)/i);
    if (openingMatch) {
      openingUnitBalance = this.parseNumber(openingMatch[1]);
    }
    
    let exitLoadText = '';
    const exitLoadPatterns = [
      /(?:Exit Load|Entry Load)[:\s]*([^"]+?)(?="Please ensure|$)/is,
      /Exit Load[:\s-]*(.{10,500}?)(?=\n\n|\nClosing|Entry Load|$)/is
    ];
    for (const pattern of exitLoadPatterns) {
      const exitLoadMatch = blockText.match(pattern);
      if (exitLoadMatch) {
        exitLoadText = exitLoadMatch[1].trim().substring(0, 500);
        break;
      }
    }
    
    const transactions = this.parseTransactionsFromBlock(blockText, isin, folioNumber, schemeName);
    
    let firstPurchaseDate: string | undefined;
    const purchaseTransactions = transactions.filter(t => t.isCredit && t.units > 0);
    if (purchaseTransactions.length > 0) {
      const sortedDates = purchaseTransactions
        .map(t => ({ date: t.transactionDate, parsed: parseCASDate(t.transactionDate) }))
        .filter(d => d.parsed !== null)
        .sort((a, b) => (a.parsed as Date).getTime() - (b.parsed as Date).getTime());
      
      if (sortedDates.length > 0) {
        // Convert to YYYY-MM-DD format for frontend date input compatibility
        const parsedDate = sortedDates[0].parsed as Date;
        firstPurchaseDate = parsedDate.toISOString().split('T')[0];
      }
    }
    
    let holderName = '';
    const lines = blockText.split('\n');
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.match(/^[A-Z][A-Za-z]+\s+[A-Z][A-Za-z]+/) && 
          !line.includes('Folio') && 
          !line.includes('PAN') &&
          !line.includes('Mutual Fund') &&
          line.length < 50) {
        holderName = line;
        break;
      }
    }
    
    const unrealizedGain = marketValue - costValue;
    const unrealizedGainPercent = costValue > 0 ? (unrealizedGain / costValue) * 100 : 0;
    const avgCostPerUnit = unitBalance > 0 ? costValue / unitBalance : 0;
    
    const hasPurchaseTransactions = transactions.some(t => t.isCredit && t.units > 0);
    const holdingTier: HoldingTier = hasPurchaseTransactions ? 'FULL' : 'VALUATION_ONLY';
    let eligibleForTax = holdingTier === 'FULL';
    const tierWarnings: string[] = [];
    
    if (holdingTier === 'VALUATION_ONLY') {
      tierWarnings.push('No purchase transactions found - capital gains cannot be computed');
    }
    
    // Step 5: Lot reconciliation - verify sum of lot units matches closing balance
    const purchaseTxns = transactions.filter(t => t.isCredit && ['Purchase', 'SIP', 'Switch In', 'Bonus', 'Reinvestment'].includes(t.transactionType));
    const redemptionTxns = transactions.filter(t => !t.isCredit);
    
    const totalPurchaseUnits = purchaseTxns.reduce((sum, t) => sum + Math.abs(t.units), 0);
    const totalRedemptionUnits = redemptionTxns.reduce((sum, t) => sum + Math.abs(t.units), 0);
    const calculatedBalance = openingUnitBalance + totalPurchaseUnits - totalRedemptionUnits;
    const reconciliationDelta = Math.abs(calculatedBalance - unitBalance);
    const reconciliationTolerance = 0.01; // 0.01 unit tolerance
    
    if (hasPurchaseTransactions && reconciliationDelta > reconciliationTolerance) {
      const deltaPct = unitBalance > 0 ? (reconciliationDelta / unitBalance) * 100 : 0;
      if (deltaPct > 5) {
        tierWarnings.push(`Lot reconciliation mismatch: ${purchaseTxns.length} lots = ${calculatedBalance.toFixed(3)} units vs closing ${unitBalance.toFixed(3)} (delta: ${reconciliationDelta.toFixed(3)})`);
        console.warn(`[CAS Lot Reconciliation] MISMATCH for ${isin}: Lots=${calculatedBalance.toFixed(3)}, Closing=${unitBalance.toFixed(3)}, Delta=${reconciliationDelta.toFixed(3)} (${deltaPct.toFixed(2)}%)`);
        // Don't mark as ineligible for tax if the delta is small - could be rounding
        if (deltaPct > 20) {
          eligibleForTax = false;
        }
      }
    } else if (hasPurchaseTransactions) {
      console.log(`[CAS Lot Reconciliation] ✓ PASS for ${isin}: ${purchaseTxns.length} lots = ${totalPurchaseUnits.toFixed(3)} units, Closing = ${unitBalance.toFixed(3)}`);
    }
    
    console.log(`[CAS Service v4] Parsed: Folio ${folioNumber} | ${schemeName.substring(0, 35)}... | Units: ${unitBalance.toFixed(3)} | Cost: ${costValue.toFixed(2)} | Market: ${marketValue.toFixed(2)} | Txns: ${transactions.length} (${purchaseTxns.length} purchases) | Tier: ${holdingTier}`);
    
    return {
      id: `cas-${isin}-${folioNumber}-${index}`,
      folioNumber,
      isin,
      schemeCode,
      schemeName,
      amcName,
      costValue,
      unitBalance,
      openingUnitBalance,
      navDate,
      nav,
      marketValue,
      registrar,
      unrealizedGain,
      unrealizedGainPercent,
      avgCostPerUnit,
      assetType: 'mutual_fund',
      planType,
      optionType,
      isDemat,
      kycStatus,
      advisorArn,
      exitLoadText,
      nomineeDetails,
      transactions,
      firstPurchaseDate,
      holderName,
      holdingTier,
      eligibleForTax,
      tierWarnings
    };
  }
  
  /**
   * Parse all transactions from a folio block with strict lot-level accuracy.
   * 
   * CRITICAL FIX: Each financial transaction row = one transaction = one lot.
   * Do NOT collapse multiple purchases into one investment.
   * 
   * Transaction line format (typical):
   * DD-Mon-YYYY Purchase-BSE - - ARN-XXXX 199,990.00 4,974.876 40.200 4,974.876
   */
  private parseTransactionsFromBlock(blockText: string, isin: string, folioNumber: string, schemeName: string): CASTransaction[] {
    const transactions: CASTransaction[] = [];
    const lines = blockText.split('\n');
    let txnIndex = 0;
    
    // Step 1: Strict transaction row regex - captures amount, units, NAV, balance
    // Format: DD-Mon-YYYY TransactionType [Details] Amount Units NAV Balance
    const TRANSACTION_ROW_REGEX = /^(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})\s+(Purchase|Purchase-BSE|Purchase-NSE|SIP\s*Purchase|Systematic Investment Purchase|Systematic Investment|Switch[\s-]*In|Equity Switch[\s-]*In|Switch[\s-]*Out|Transfer[\s-]*In|Transfer[\s-]*Out|Redemption|Dividend|Dividend Reinvestment|Reinvestment|Bonus|Initial Purchase|NFO Purchase|Additional Purchase)/i;
    
    // Keywords for validation
    const transactionKeywords = [
      'Purchase', 'Redemption', 'Switch In', 'Switch Out', 'Switch-In', 'Switch-Out',
      'Systematic Investment', 'SIP', 'Initial Purchase', 'NFO Purchase',
      'Dividend', 'Dividend Reinvestment', 'Reinvestment', 'Bonus',
      'STT', 'Gross', 'Net', 'Unclaimed', 'Rejection', 'Reversal',
      'Additional Purchase', 'Transfer In', 'Transfer Out', 'Transmission',
      'Purchase-BSE', 'Purchase-NSE', 'Equity Switch'
    ];
    
    const keywordPattern = new RegExp(`(${transactionKeywords.join('|')})`, 'i');
    
    console.log(`[CAS Txn Parser] Processing ${lines.length} lines for ISIN ${isin}, Folio ${folioNumber}`);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Step 2: Explicitly ignore metadata rows (non-financial)
      if (line.includes('***') || 
          line.includes('Stamp Duty') || 
          line.includes('Registration of Nominee') ||
          line.includes('Address Updated') ||
          line.includes('Change of Broker') || 
          line.includes('Cancellation') ||
          line.includes('KYC') ||
          line.includes('Opening Unit Balance')) {
        continue;
      }
      
      // Try strict regex match first
      const strictMatch = line.match(TRANSACTION_ROW_REGEX);
      
      // Fallback to flexible date + keyword detection
      const dateMatch = line.match(/^(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})/);
      if (!dateMatch && !strictMatch) continue;
      
      const dateStr = strictMatch ? strictMatch[1] : dateMatch![1];
      const restOfLine = line.substring(dateStr.length).trim();
      
      if (!keywordPattern.test(restOfLine)) continue;
      
      // Remove installment numbers before extracting financial values
      // This prevents "Instalment No - 1" from being counted as a number
      const cleanedLine = restOfLine
        .replace(/Instalment\s*No\s*[-–]\s*\d+(?:\/\d+)?/gi, '')
        .replace(/No\s*[-–]\s*\d+(?:\/\d+)?/gi, '')
        .replace(/ARN-\d+/gi, '') // Remove ARN codes to avoid confusion with numbers
        .replace(/--/g, ' '); // Normalize double dashes
      
      const numbers = this.extractNumbers(cleanedLine);
      
      // Need at least 2 numbers (units + NAV minimum)
      if (numbers.length < 2) {
        console.log(`[CAS Txn Parser] Skipped line (insufficient numbers): ${line.substring(0, 60)}...`);
        continue;
      }
      
      let amount = 0;
      let units = 0;
      let nav = 0;
      let balance = 0;
      
      // Parse numbers: Amount, Units, NAV, Balance (typical 4-column format)
      if (numbers.length >= 4) {
        amount = numbers[0];
        units = numbers[1];
        nav = numbers[2];
        balance = numbers[3];
      } else if (numbers.length === 3) {
        amount = numbers[0];
        units = numbers[1];
        nav = numbers[2];
        balance = units;
      } else if (numbers.length === 2) {
        units = numbers[0];
        nav = numbers[1];
        balance = units;
      }
      
      // Skip if units are zero or negative (not a real transaction)
      if (units <= 0 && !restOfLine.toLowerCase().includes('redemption') && !restOfLine.toLowerCase().includes('switch out')) {
        continue;
      }
      
      const description = restOfLine.replace(/[\d,]+\.?\d*/g, '').replace(/\s+/g, ' ').trim();
      
      const { transactionType, isCredit } = this.classifyTransaction(description);
      
      // Check for stamp duty on next line
      let stampDuty = 0;
      if (i + 1 < lines.length && lines[i + 1].includes('Stamp Duty')) {
        const stampMatch = lines[i + 1].match(/([\d,]+\.?\d*)/);
        if (stampMatch) {
          stampDuty = this.parseNumber(stampMatch[1]);
        }
      }
      
      const txn: CASTransaction = {
        id: `txn-${isin}-${folioNumber}-${txnIndex++}`,
        folioNumber,
        isin,
        schemeName,
        transactionDate: dateStr,
        transactionType,
        amount: Math.abs(amount),
        units: isCredit ? Math.abs(units) : -Math.abs(units),
        nav,
        balance,
        description,
        stampDuty,
        isCredit
      };
      
      transactions.push(txn);
      console.log(`[CAS Txn Parser] ✓ Txn ${txnIndex}: ${dateStr} ${transactionType} | Units: ${units.toFixed(3)} | NAV: ${nav.toFixed(3)} | Amount: ${amount.toFixed(2)}`);
    }
    
    console.log(`[CAS Txn Parser] Extracted ${transactions.length} transactions for ISIN ${isin}`);
    
    // Step 5: Log lot reconciliation warning if purchase transactions exist
    const purchaseTxns = transactions.filter(t => t.isCredit && t.units > 0);
    if (purchaseTxns.length > 0) {
      const totalUnits = purchaseTxns.reduce((sum, t) => sum + t.units, 0);
      console.log(`[CAS Txn Parser] Purchase lots: ${purchaseTxns.length} | Total units: ${totalUnits.toFixed(3)}`);
    }
    
    return transactions;
  }
  
  /**
   * Classify transaction type and determine if it's a credit (units added) or debit (units removed)
   */
  private classifyTransaction(description: string): { transactionType: CASTransaction['transactionType']; isCredit: boolean } {
    const desc = description.toLowerCase();
    
    if (/systematic investment|sip/i.test(desc)) {
      return { transactionType: 'SIP', isCredit: true };
    }
    if (/initial purchase|nfo purchase|additional purchase/i.test(desc)) {
      return { transactionType: 'Purchase', isCredit: true };
    }
    if (/purchase(?!.*switch)/i.test(desc)) {
      return { transactionType: 'Purchase', isCredit: true };
    }
    if (/redemption/i.test(desc)) {
      return { transactionType: 'Redemption', isCredit: false };
    }
    if (/switch[\s-]*in|transfer[\s-]*in/i.test(desc)) {
      return { transactionType: 'Switch In', isCredit: true };
    }
    if (/switch[\s-]*out|transfer[\s-]*out/i.test(desc)) {
      return { transactionType: 'Switch Out', isCredit: false };
    }
    if (/dividend.*reinvest|reinvest.*dividend/i.test(desc)) {
      return { transactionType: 'Reinvestment', isCredit: true };
    }
    if (/dividend/i.test(desc)) {
      return { transactionType: 'Dividend', isCredit: true };
    }
    if (/bonus/i.test(desc)) {
      return { transactionType: 'Bonus', isCredit: true };
    }
    if (/reinvest/i.test(desc)) {
      return { transactionType: 'Reinvestment', isCredit: true };
    }
    if (/stt/i.test(desc)) {
      return { transactionType: 'STT', isCredit: false };
    }
    if (/rejection|reversal/i.test(desc)) {
      return { transactionType: 'Other', isCredit: false };
    }
    if (/transmission|unclaimed/i.test(desc)) {
      return { transactionType: 'Other', isCredit: true };
    }
    
    return { transactionType: 'Other', isCredit: true };
  }
  
  /**
   * Extract all numeric values from a string (preserving zeros and negative signs)
   */
  private extractNumbers(text: string): number[] {
    const numbers: number[] = [];
    const pattern = /(-?[\d,]+\.?\d*)/g;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const numStr = match[1].replace(/,/g, '');
      const num = parseFloat(numStr);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
    
    return numbers;
  }
  
  /**
   * Parse number from string, handling commas and optional decimals
   */
  private parseNumber(str: string): number {
    if (!str) return 0;
    const cleaned = str.replace(/,/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  
  private async enrichHoldingsWithDatabase(holdings: CASHolding[]): Promise<CASHolding[]> {
    const isins = holdings.map(h => h.isin).filter(isin => isin.startsWith('INF'));
    
    if (isins.length === 0) return holdings;
    
    console.log('[CAS Service v3] Enriching', isins.length, 'holdings from database...');
    
    try {
      const fundLookup = await liveMFDataService.getFundsByIsinBatch(isins);
      
      return holdings.map(holding => {
        if (fundLookup.has(holding.isin)) {
          const dbFund = fundLookup.get(holding.isin)!;
          const currentNav = dbFund.nav || holding.nav;
          
          let calculatedMarketValue = holding.marketValue;
          if (holding.unitBalance > 0 && currentNav > 0) {
            calculatedMarketValue = holding.unitBalance * currentNav;
          }
          
          const unrealizedGain = calculatedMarketValue - holding.costValue;
          const unrealizedGainPercent = holding.costValue > 0 ? (unrealizedGain / holding.costValue) * 100 : 0;
          
          return {
            ...holding,
            schemeName: dbFund.schemeName || holding.schemeName,
            amcName: dbFund.fundHouse || holding.amcName,
            nav: currentNav,
            marketValue: calculatedMarketValue,
            unrealizedGain,
            unrealizedGainPercent
          };
        }
        return holding;
      });
    } catch (error: any) {
      console.warn('[CAS Service v3] Database enrichment failed:', error.message);
      return holdings;
    }
  }
  
  private calculateSummary(holdings: CASHolding[]): CASStatementResult['summary'] {
    const totalInvestedValue = holdings.reduce((sum, h) => sum + h.costValue, 0);
    const totalCurrentValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const totalUnrealizedGain = totalCurrentValue - totalInvestedValue;
    const totalUnrealizedGainPercent = totalInvestedValue > 0 ? (totalUnrealizedGain / totalInvestedValue) * 100 : 0;
    
    const camsHoldings = holdings.filter(h => h.registrar === 'CAMS');
    const kfintechHoldings = holdings.filter(h => h.registrar === 'KFINTECH');
    
    return {
      totalHoldings: holdings.length,
      totalInvestedValue,
      totalCurrentValue,
      totalUnrealizedGain,
      totalUnrealizedGainPercent,
      registrarBreakdown: {
        cams: {
          count: camsHoldings.length,
          value: camsHoldings.reduce((sum, h) => sum + h.marketValue, 0)
        },
        kfintech: {
          count: kfintechHoldings.length,
          value: kfintechHoldings.reduce((sum, h) => sum + h.marketValue, 0)
        }
      }
    };
  }
  
  /**
   * Epic 4.1: Build per-holding confidence scores
   */
  private buildHoldingConfidence(holdings: CASHolding[]): Map<string, HoldingConfidence> {
    const confidenceMap = new Map<string, HoldingConfidence>();
    
    for (const holding of holdings) {
      const holdingKey = `${holding.isin}|${holding.folioNumber}`;
      const missingFields: string[] = [];
      const warnings: string[] = [];
      
      // Check for missing fields
      if (holding.unitBalance <= 0) missingFields.push('unitBalance');
      if (holding.costValue <= 0) missingFields.push('costValue');
      if (holding.nav <= 0) missingFields.push('nav');
      if (holding.marketValue <= 0) missingFields.push('marketValue');
      if (!holding.navDate) missingFields.push('navDate');
      if (!holding.folioNumber) missingFields.push('folioNumber');
      
      // Add warnings for partial data
      if (holding.transactions.length === 0) {
        warnings.push('No transactions found');
      }
      
      if (!holding.firstPurchaseDate && holding.transactions.length > 0) {
        warnings.push('Could not determine first purchase date');
      }
      
      // Validate cost per unit consistency
      if (holding.unitBalance > 0 && holding.costValue > 0) {
        const avgCost = holding.costValue / holding.unitBalance;
        if (holding.avgCostPerUnit && Math.abs(avgCost - holding.avgCostPerUnit) > 1) {
          warnings.push(`Avg cost inconsistency: calculated ${avgCost.toFixed(2)} vs stored ${holding.avgCostPerUnit?.toFixed(2)}`);
        }
      }
      
      // Determine confidence level
      let level: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
      if (missingFields.length > 0 || warnings.length > 0) {
        level = missingFields.length > 2 ? 'LOW' : 'MEDIUM';
      }
      
      confidenceMap.set(holdingKey, {
        level,
        reconciliationDelta: 0, // Will be updated during reconciliation
        warnings,
        missingFields
      });
    }
    
    return confidenceMap;
  }
  
  /**
   * Epic 1.3: Strict reconciliation with 0.5% threshold
   * Fails import if discrepancy > 0.5%
   */
  private performStrictReconciliation(
    result: CASStatementResult,
    summary: CASPortfolioSummary
  ): ReconciliationResult {
    const parsedTotal = result.summary.totalCurrentValue;
    const expectedTotal = summary.totalMarketValue;
    
    const delta = Math.abs(parsedTotal - expectedTotal);
    const deltaPercent = expectedTotal > 0 ? (delta / expectedTotal) * 100 : 0;
    
    console.log(`[CAS Service v4] Strict Reconciliation:`);
    console.log(`  Parsed Total:  ₹${parsedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`  Expected Total: ₹${expectedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
    console.log(`  Delta: ₹${delta.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${deltaPercent.toFixed(3)}%)`);
    
    // Also check at AMC level for diagnostics
    const holdingsByAmc = new Map<string, number>();
    for (const holding of result.holdings) {
      const amcName = holding.amcName || 'Unknown';
      holdingsByAmc.set(amcName, (holdingsByAmc.get(amcName) || 0) + holding.marketValue);
    }
    
    // Log AMC-level discrepancies for debugging
    for (const entry of summary.entries) {
      const parsedAmcValue = holdingsByAmc.get(entry.amcName) || 0;
      const amcDelta = Math.abs(parsedAmcValue - entry.marketValue);
      const amcDeltaPercent = entry.marketValue > 0 ? (amcDelta / entry.marketValue) * 100 : 0;
      if (amcDeltaPercent > 0.5) {
        console.log(`  AMC ${entry.amcName}: Parsed ₹${parsedAmcValue.toLocaleString('en-IN')} vs Expected ₹${entry.marketValue.toLocaleString('en-IN')} (${amcDeltaPercent.toFixed(2)}% delta)`);
      }
    }
    
    // Epic 1.3: Strict 0.5% threshold
    if (deltaPercent > 0.5) {
      return {
        passed: false,
        parsedTotal,
        expectedTotal,
        delta,
        deltaPercent,
        errorCode: 'CAS_RECONCILIATION_ERROR',
        message: `RECONCILIATION FAILED: Parsed ₹${(parsedTotal / 100000).toFixed(2)} L but expected ₹${(expectedTotal / 100000).toFixed(2)} L from CAS Portfolio Summary. Delta: ${deltaPercent.toFixed(2)}% exceeds 0.5% threshold. Holdings may be missing or incorrectly parsed.`
      };
    }
    
    // Success - delta within tolerance
    const confidenceMessage = delta <= 1 
      ? 'Exact match (delta ≤ ₹1)'
      : `Minor delta: ₹${delta.toFixed(2)} (${deltaPercent.toFixed(3)}%)`;
    
    console.log(`[CAS Service v4] Reconciliation PASSED: ${confidenceMessage}`);
    
    return {
      passed: true,
      parsedTotal,
      expectedTotal,
      delta,
      deltaPercent,
      message: confidenceMessage
    };
  }
  
  /**
   * @deprecated Use performStrictReconciliation instead
   * Kept for backward compatibility
   */
  private validateAgainstPortfolioSummary(
    result: CASStatementResult, 
    summary: CASPortfolioSummary
  ): string | null {
    const parsedTotal = result.summary.totalCurrentValue;
    const expectedTotal = summary.totalMarketValue;
    
    const discrepancy = Math.abs(parsedTotal - expectedTotal);
    const discrepancyPercent = expectedTotal > 0 ? (discrepancy / expectedTotal) * 100 : 0;
    
    console.log(`[CAS Service v4] Validation: Parsed ₹${(parsedTotal / 100000).toFixed(2)} L vs Expected ₹${(expectedTotal / 100000).toFixed(2)} L`);
    console.log(`[CAS Service v4] Discrepancy: ₹${(discrepancy / 100000).toFixed(2)} L (${discrepancyPercent.toFixed(1)}%)`);
    
    // Also validate at AMC level
    const holdingsByAmc = new Map<string, number>();
    for (const holding of result.holdings) {
      const amcName = holding.amcName || 'Unknown';
      holdingsByAmc.set(amcName, (holdingsByAmc.get(amcName) || 0) + holding.marketValue);
    }
    
    // Compare with summary entries
    for (const entry of summary.entries) {
      const parsedAmcValue = holdingsByAmc.get(entry.amcName) || 0;
      const amcDiscrepancy = Math.abs(parsedAmcValue - entry.marketValue);
      if (amcDiscrepancy > 10000) {
        console.log(`[CAS Service v4] AMC Discrepancy - ${entry.amcName}: Parsed ₹${(parsedAmcValue / 100000).toFixed(2)} L vs Expected ₹${(entry.marketValue / 100000).toFixed(2)} L`);
      }
    }
    
    // Allow 2% tolerance for rounding differences
    if (discrepancyPercent > 2) {
      return `Portfolio value discrepancy: Parsed ₹${(parsedTotal / 100000).toFixed(2)} L but expected ₹${(expectedTotal / 100000).toFixed(2)} L from Portfolio Summary (${discrepancyPercent.toFixed(1)}% difference)`;
    }
    
    return null;
  }
  
  private calculateConfidenceScore(result: CASStatementResult): number {
    let score = 50;
    
    if (result.investor.email) score += 5;
    if (result.investor.name) score += 5;
    if (result.investor.pan) score += 5;
    
    if (result.holdings.length > 0) score += 15;
    if (result.holdings.length > 5) score += 5;
    if (result.holdings.length > 10) score += 5;
    
    const holdingsWithIsin = result.holdings.filter(h => h.isin && h.isin.length === 12);
    const holdingsWithFolio = result.holdings.filter(h => h.folioNumber);
    const holdingsWithNav = result.holdings.filter(h => h.nav > 0);
    const holdingsWithTransactions = result.holdings.filter(h => h.transactions.length > 0);
    
    if (holdingsWithIsin.length === result.holdings.length) score += 5;
    if (holdingsWithFolio.length === result.holdings.length) score += 5;
    if (holdingsWithNav.length === result.holdings.length) score += 5;
    if (holdingsWithTransactions.length > 0) score += 5;
    
    if (result.errors.length > 0) score -= 10;
    if (result.warnings.length > 0) score -= 5;
    
    return Math.min(100, Math.max(0, score));
  }
  
  async getHoldingByISIN(holdings: CASHolding[], isin: string): Promise<CASHolding | undefined> {
    return holdings.find(h => h.isin === isin);
  }
  
  async getHoldingsByRegistrar(holdings: CASHolding[], registrar: 'CAMS' | 'KFINTECH'): Promise<CASHolding[]> {
    return holdings.filter(h => h.registrar === registrar);
  }
  
  getFirstPurchaseDatePerFolio(holdings: CASHolding[]): Map<string, string> {
    const result = new Map<string, string>();
    
    for (const holding of holdings) {
      if (holding.firstPurchaseDate && holding.folioNumber) {
        const key = `${holding.folioNumber}-${holding.isin}`;
        if (!result.has(key)) {
          result.set(key, holding.firstPurchaseDate);
        }
      }
    }
    
    return result;
  }
  
  getTransactionLotsByHolding(holding: CASHolding): CASTransaction[] {
    return holding.transactions.filter(t => t.isCredit && t.units > 0);
  }
  
  getRedemptionsByHolding(holding: CASHolding): CASTransaction[] {
    return holding.transactions.filter(t => !t.isCredit);
  }

  async persistLotsToDatabase(
    result: CASStatementResult,
    userId: string,
    portfolioId: string
  ): Promise<{ inserted: number; errors: string[] }> {
    const lots: LotStorageInput[] = [];

    for (const holding of result.holdings) {
      const purchaseTransactions = holding.transactions.filter(t => 
        t.isCredit && ['Purchase', 'SIP', 'Switch In', 'Bonus', 'Reinvestment'].includes(t.transactionType)
      );

      let runningBalance = holding.openingUnitBalance || 0;

      for (const txn of purchaseTransactions) {
        if (txn.units <= 0) continue;

        runningBalance += txn.units;

        lots.push({
          portfolioId,
          userId,
          isin: holding.isin,
          folioNumber: holding.folioNumber,
          schemeName: holding.schemeName,
          amcCode: holding.amcName,
          purchaseDate: txn.transactionDate,
          purchaseDateSource: 'cas_explicit',
          purchaseDateConfidence: 1.0,
          transactionType: txn.transactionType.toLowerCase().replace(' ', '_'),
          units: txn.units,
          costPerUnit: txn.nav,
          totalCost: txn.amount,
          stampDuty: txn.stampDuty,
          purchaseNav: txn.nav,
          balanceAfterTransaction: runningBalance,
          transactionDescription: txn.description,
          exitLoadText: holding.exitLoadText,
          advisorArn: holding.advisorArn,
          status: 'active',
          remainingUnits: txn.units,
        });
      }
    }

    if (lots.length === 0) {
      console.log('[CAS Service v4] No purchase lots to persist');
      return { inserted: 0, errors: [] };
    }

    console.log(`[CAS Service v4] Persisting ${lots.length} lots to database`);
    return holdingLotsStorageService.insertLots(lots);
  }
}

export const casStatementService = CASStatementService.getInstance();
