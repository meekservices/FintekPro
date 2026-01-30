import { liveMFDataService } from './live-mf-data-service';
import { holdingLotsStorageService, LotStorageInput } from './holding-lots-storage-service';

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
}

export interface CASStatementResult {
  success: boolean;
  statementType: 'holding' | 'transaction' | 'combined';
  statementDate?: string;
  statementPeriod?: { from: string; to: string };
  investor: CASInvestorInfo;
  holdings: CASHolding[];
  transactions: CASTransaction[];
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
      
      const schemeBlocks = this.splitBySchemeBlocks(text);
      console.log('[CAS Service v4] Found', schemeBlocks.length, 'scheme blocks');
      
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
      
      if (result.holdings.length > 0) {
        result.holdings = await this.enrichHoldingsWithDatabase(result.holdings);
      }
      
      result.summary = this.calculateSummary(result.holdings);
      result.confidenceScore = this.calculateConfidenceScore(result);
      result.success = result.holdings.length > 0;
      
      console.log('[CAS Service v4] Parse complete:', {
        holdings: result.holdings.length,
        transactions: result.transactions.length,
        totalInvested: result.summary.totalInvestedValue.toFixed(2),
        totalValue: result.summary.totalCurrentValue.toFixed(2),
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
   * Split CAS statement by scheme blocks (ISIN-based)
   * This handles multiple schemes under the same folio
   */
  private splitBySchemeBlocks(text: string): string[] {
    const blocks: string[] = [];
    
    const closingLinePattern = /Closing Unit Balance:\s*[\d,]+\.?\d*/gi;
    const closingMatches: { index: number }[] = [];
    
    let match;
    while ((match = closingLinePattern.exec(text)) !== null) {
      closingMatches.push({ index: match.index });
    }
    
    console.log('[CAS Service v4] Found', closingMatches.length, 'Closing Unit Balance lines');
    
    for (let i = 0; i < closingMatches.length; i++) {
      const closingIndex = closingMatches[i].index;
      
      let blockStart = closingIndex - 5000;
      for (let j = i - 1; j >= 0; j--) {
        const prevClosingEnd = text.indexOf('\n', closingMatches[j].index) + 200;
        if (prevClosingEnd > blockStart && prevClosingEnd < closingIndex) {
          blockStart = prevClosingEnd;
          break;
        }
      }
      blockStart = Math.max(0, blockStart);
      
      const isinBefore = text.substring(blockStart, closingIndex).lastIndexOf('ISIN:');
      if (isinBefore > 0) {
        const folioBeforeIsin = text.substring(blockStart, blockStart + isinBefore).lastIndexOf('Folio No:');
        if (folioBeforeIsin > 0) {
          blockStart = blockStart + folioBeforeIsin;
        }
      }
      
      let blockEnd = closingIndex + 1500;
      if (i < closingMatches.length - 1) {
        const nextIsinPos = text.indexOf('ISIN:', closingIndex + 50);
        if (nextIsinPos > 0 && nextIsinPos < closingMatches[i + 1].index) {
          blockEnd = nextIsinPos - 50;
        }
      }
      blockEnd = Math.min(text.length, blockEnd);
      
      const blockText = text.substring(blockStart, blockEnd);
      
      // Check if this block has valid ISIN and closing balance
      const hasINFIsin = blockText.match(/INF[A-Z0-9]{9}/);
      const hasINEIsin = blockText.match(/INE[A-Z0-9]{9}/);
      const hasIN0Isin = blockText.match(/IN0[A-Z0-9]{9}/);
      const hasIsin = hasINFIsin || hasINEIsin || hasIN0Isin;
      const hasClosingBalance = blockText.includes('Closing Unit Balance');
      
      if (hasIsin && hasClosingBalance) {
        blocks.push(blockText);
      } else {
        // Debug: Log why block was skipped
        const preview = blockText.substring(0, 150).replace(/\n/g, ' ');
        console.log(`[CAS Service v4] Skipped block ${i+1}: hasISIN=${!!hasIsin} hasClosing=${hasClosingBalance} preview="${preview}..."`);
      }
    }
    
    console.log(`[CAS Service v4] Extracted ${blocks.length} valid blocks from ${closingMatches.length} closing balance lines`);
    
    return blocks;
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
    
    const closingPatterns = [
      /Closing Unit Balance:\s*([\d,]+\.?\d*)\s+NAV on\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4}):\s*(?:INR|Rs\.?)\s*([\d,]+\.?\d*)\s+Total Cost(?: Value)?:\s*([\d,]+\.?\d*)\s+Market Value on[^:]+:\s*(?:INR|Rs\.?)\s*([\d,]+\.?\d*)/i,
      /Closing Unit Balance:\s*([\d,]+\.?\d*)\s+NAV[^:]*:\s*(?:INR|Rs\.?)?\s*([\d,]+\.?\d*)\s+.*?Cost[^:]*:\s*([\d,]+\.?\d*)\s+.*?Value[^:]*:\s*(?:INR|Rs\.?)?\s*([\d,]+\.?\d*)/i,
      /Closing Unit Balance:\s*([\d,]+\.?\d*)/i
    ];
    
    let unitBalance = 0;
    let navDate = '';
    let nav = 0;
    let costValue = 0;
    let marketValue = 0;
    
    for (const pattern of closingPatterns) {
      const closingMatch = blockText.match(pattern);
      if (closingMatch) {
        if (closingMatch.length >= 6) {
          unitBalance = this.parseNumber(closingMatch[1]);
          navDate = closingMatch[2] || '';
          nav = this.parseNumber(closingMatch[3]);
          costValue = this.parseNumber(closingMatch[4]);
          marketValue = this.parseNumber(closingMatch[5]);
        } else if (closingMatch.length >= 5) {
          unitBalance = this.parseNumber(closingMatch[1]);
          nav = this.parseNumber(closingMatch[2]);
          costValue = this.parseNumber(closingMatch[3]);
          marketValue = this.parseNumber(closingMatch[4]);
        } else if (closingMatch.length >= 2) {
          unitBalance = this.parseNumber(closingMatch[1]);
        }
        
        if (unitBalance > 0) break;
      }
    }
    
    const navDateMatch = blockText.match(/NAV on\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})/i);
    if (navDateMatch && !navDate) {
      navDate = navDateMatch[1];
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
        firstPurchaseDate = sortedDates[0].date;
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
    
    console.log(`[CAS Service v3] Parsed: Folio ${folioNumber} | ${schemeName.substring(0, 35)}... | Units: ${unitBalance.toFixed(3)} | Cost: ${costValue.toFixed(2)} | Market: ${marketValue.toFixed(2)} | Txns: ${transactions.length}`);
    
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
      holderName
    };
  }
  
  /**
   * Parse all transactions from a folio block with comprehensive pattern matching
   */
  private parseTransactionsFromBlock(blockText: string, isin: string, folioNumber: string, schemeName: string): CASTransaction[] {
    const transactions: CASTransaction[] = [];
    const lines = blockText.split('\n');
    let txnIndex = 0;
    
    const transactionKeywords = [
      'Purchase', 'Redemption', 'Switch In', 'Switch Out', 'Switch-In', 'Switch-Out',
      'Systematic Investment', 'SIP', 'Initial Purchase', 'NFO Purchase',
      'Dividend', 'Dividend Reinvestment', 'Reinvestment', 'Bonus',
      'STT', 'Gross', 'Net', 'Unclaimed', 'Rejection', 'Reversal',
      'Additional Purchase', 'Transfer In', 'Transfer Out', 'Transmission'
    ];
    
    const keywordPattern = new RegExp(`(${transactionKeywords.join('|')})`, 'i');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.includes('***') || line.includes('Stamp Duty') || 
          line.includes('Registration') || line.includes('Address Updated') ||
          line.includes('Change of Broker') || line.includes('Cancellation')) {
        continue;
      }
      
      const dateMatch = line.match(/^(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})/);
      if (!dateMatch) continue;
      
      const dateStr = dateMatch[1];
      const restOfLine = line.substring(dateMatch[0].length).trim();
      
      if (!keywordPattern.test(restOfLine)) continue;
      
      // Remove installment numbers before extracting financial values
      // This prevents "Instalment No - 1" from being counted as a number
      const cleanedLine = restOfLine
        .replace(/Instalment\s*No\s*[-–]\s*\d+(?:\/\d+)?/gi, '')
        .replace(/No\s*[-–]\s*\d+(?:\/\d+)?/gi, '');
      
      const numbers = this.extractNumbers(cleanedLine);
      
      if (numbers.length < 2) continue;
      
      let amount = 0;
      let units = 0;
      let nav = 0;
      let balance = 0;
      
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
      
      const description = restOfLine.replace(/[\d,]+\.?\d*/g, '').trim();
      
      const { transactionType, isCredit } = this.classifyTransaction(description);
      
      let stampDuty = 0;
      if (i + 1 < lines.length && lines[i + 1].includes('Stamp Duty')) {
        const stampMatch = lines[i + 1].match(/([\d,]+\.?\d*)/);
        if (stampMatch) {
          stampDuty = this.parseNumber(stampMatch[1]);
        }
      }
      
      transactions.push({
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
      });
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
