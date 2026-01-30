import { liveMFDataService } from './live-mf-data-service';
import { isinIntelligenceService } from './isin-intelligence-service';

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
  transactionType: 'Purchase' | 'Redemption' | 'Switch In' | 'Switch Out' | 'SIP' | 'Dividend' | 'Bonus' | 'Other';
  amount: number;
  units: number;
  nav: number;
  balance: number;
  description: string;
  stampDuty?: number;
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

interface HoldingBlock {
  rawText: string;
  folioLine: string;
  schemeLine: string;
  closingLine: string;
  transactionLines: string[];
  exitLoadLine?: string;
}

class CASStatementService {
  private static instance: CASStatementService;
  
  private constructor() {
    console.log('✅ CAS Statement Service initialized (v2 - Block Parser)');
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
      console.log('[CAS Service v2] Starting block-based parse...');
      
      result.investor = this.extractInvestorInfo(text);
      result.statementPeriod = this.extractStatementPeriod(text);
      
      console.log('[CAS Service v2] Investor:', result.investor.name || 'Unknown');
      console.log('[CAS Service v2] PAN:', result.investor.pan || 'Not found');
      
      const holdingBlocks = this.splitIntoHoldingBlocks(text);
      console.log('[CAS Service v2] Found', holdingBlocks.length, 'holding blocks');
      
      for (let i = 0; i < holdingBlocks.length; i++) {
        try {
          const holding = this.parseHoldingBlock(holdingBlocks[i], i);
          if (holding && holding.unitBalance > 0) {
            result.holdings.push(holding);
            result.transactions.push(...holding.transactions);
          }
        } catch (error: any) {
          console.warn('[CAS Service v2] Failed to parse block', i, ':', error.message);
          result.warnings.push(`Block ${i}: ${error.message}`);
        }
      }
      
      if (result.holdings.length > 0) {
        result.holdings = await this.enrichHoldingsWithDatabase(result.holdings);
      }
      
      result.summary = this.calculateSummary(result.holdings);
      result.confidenceScore = this.calculateConfidenceScore(result);
      result.success = result.holdings.length > 0;
      
      console.log('[CAS Service v2] Parse complete:', {
        holdings: result.holdings.length,
        transactions: result.transactions.length,
        totalInvested: result.summary.totalInvestedValue.toFixed(2),
        totalValue: result.summary.totalCurrentValue.toFixed(2),
        confidence: result.confidenceScore
      });
      
    } catch (error: any) {
      console.error('[CAS Service v2] Parse error:', error);
      result.errors.push(`Parse error: ${error.message}`);
    }
    
    return result;
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
   * Split the CAS statement into individual holding blocks.
   * Each block starts with "Folio No:" and ends before the next "Folio No:" or AMC section.
   */
  private splitIntoHoldingBlocks(text: string): HoldingBlock[] {
    const blocks: HoldingBlock[] = [];
    
    const closingLinePattern = /Closing Unit Balance:\s*([\d,]+\.\d+)\s*NAV on\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4}):\s*INR\s*([\d,]+\.\d+)\s*Total Cost Value:\s*([\d,]+\.\d+)\s*Market Value on\s*[\d\-A-Za-z]+:\s*INR\s*([\d,]+\.\d+)/gi;
    
    let match;
    const closingLinePositions: { position: number; match: string }[] = [];
    
    while ((match = closingLinePattern.exec(text)) !== null) {
      closingLinePositions.push({ position: match.index, match: match[0] });
    }
    
    console.log('[CAS Service v2] Found', closingLinePositions.length, 'closing lines');
    
    for (const closingPos of closingLinePositions) {
      const blockStart = Math.max(0, closingPos.position - 3000);
      const blockEnd = Math.min(text.length, closingPos.position + closingPos.match.length + 1500);
      const blockText = text.substring(blockStart, blockEnd);
      
      const folioMatch = blockText.match(/Folio No:\s*([\d\/]+)\s*(?:.*?)PAN:\s*([A-Z]{5}\d{4}[A-Z])/i);
      const schemeMatch = blockText.match(/([A-Z0-9]{2,10})-([^(]+)\s*\([^)]*\)\s*-\s*ISIN:\s*(INF[A-Z0-9]{9})/i);
      const closingMatch = blockText.match(/Closing Unit Balance:\s*([\d,]+\.\d+)\s*NAV on\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4}):\s*INR\s*([\d,]+\.\d+)\s*Total Cost Value:\s*([\d,]+\.\d+)\s*Market Value on\s*[\d\-A-Za-z]+:\s*INR\s*([\d,]+\.\d+)/i);
      
      if (closingMatch) {
        blocks.push({
          rawText: blockText,
          folioLine: folioMatch ? folioMatch[0] : '',
          schemeLine: schemeMatch ? schemeMatch[0] : '',
          closingLine: closingMatch[0],
          transactionLines: [],
          exitLoadLine: undefined
        });
      }
    }
    
    return blocks;
  }
  
  /**
   * Parse a single holding block to extract all data
   */
  private parseHoldingBlock(block: HoldingBlock, index: number): CASHolding | null {
    const text = block.rawText;
    
    const closingMatch = text.match(/Closing Unit Balance:\s*([\d,]+\.\d+)\s*NAV on\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4}):\s*INR\s*([\d,]+\.\d+)\s*Total Cost Value:\s*([\d,]+\.\d+)\s*Market Value on\s*[\d\-A-Za-z]+:\s*INR\s*([\d,]+\.\d+)/i);
    
    if (!closingMatch) {
      console.warn('[CAS Service v2] Block', index, 'has no valid closing line');
      return null;
    }
    
    const unitBalance = parseFloat(closingMatch[1].replace(/,/g, ''));
    const navDate = closingMatch[2];
    const nav = parseFloat(closingMatch[3].replace(/,/g, ''));
    const costValue = parseFloat(closingMatch[4].replace(/,/g, ''));
    const marketValue = parseFloat(closingMatch[5].replace(/,/g, ''));
    
    let folioNumber = '';
    let pan = '';
    let kycStatus = '';
    const folioMatch = text.match(/Folio No:\s*([\d\/\s]+)/i);
    if (folioMatch) {
      folioNumber = folioMatch[1].replace(/\s/g, '').trim();
    }
    
    const panMatch = text.match(/PAN:\s*([A-Z]{5}\d{4}[A-Z])/i);
    if (panMatch) pan = panMatch[1];
    
    const kycMatch = text.match(/KYC:\s*(OK|PENDING|NOT OK)/i);
    if (kycMatch) kycStatus = kycMatch[1];
    
    let isin = '';
    let schemeCode = '';
    let schemeName = '';
    const schemeMatch = text.match(/([A-Z0-9]{2,10})-(.+?)\s*(?:\([^)]*Non-?Demat[^)]*\)|\([^)]*Demat[^)]*\))?\s*-\s*ISIN:\s*(INF[A-Z0-9]{9})/i);
    if (schemeMatch) {
      schemeCode = schemeMatch[1].trim();
      schemeName = schemeMatch[2].trim()
        .replace(/\s+/g, ' ')
        .replace(/\([^)]*Non-?Demat[^)]*\)/gi, '')
        .replace(/\([^)]*Demat[^)]*\)/gi, '')
        .trim();
      isin = schemeMatch[3].toUpperCase();
    } else {
      const isinOnlyMatch = text.match(/ISIN:\s*(INF[A-Z0-9]{9})/i);
      if (isinOnlyMatch) {
        isin = isinOnlyMatch[1].toUpperCase();
        schemeName = `Mutual Fund (${isin})`;
      }
    }
    
    if (!isin) {
      console.warn('[CAS Service v2] Block', index, 'has no ISIN');
      return null;
    }
    
    let registrar: 'CAMS' | 'KFINTECH' | 'UNKNOWN' = 'UNKNOWN';
    if (/Registrar\s*:\s*CAMS/i.test(text)) {
      registrar = 'CAMS';
    } else if (/Registrar\s*:\s*KFINTECH/i.test(text)) {
      registrar = 'KFINTECH';
    }
    
    let advisorArn = '';
    const arnMatch = text.match(/\(Advisor:\s*(ARN-\d+|DIRECT)\)/i);
    if (arnMatch) advisorArn = arnMatch[1];
    
    const isDemat = /\(Demat\)/i.test(text) && !/\(Non-?Demat\)/i.test(text);
    
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
      /(\w+\s+(?:Mutual\s+)?Fund)\s*$/im,
      /^(\w+\s+(?:Prudential|Finserv|Templeton)?\s*Mutual\s*Fund)/im
    ];
    for (const pattern of amcPatterns) {
      const amcMatch = text.match(pattern);
      if (amcMatch) {
        amcName = amcMatch[1].trim();
        break;
      }
    }
    
    const nomineeDetails: CASNomineeDetails = {};
    const nominee1Match = text.match(/Nominee\s*1:\s*([A-Za-z\s]+?)(?=Nominee\s*2:|$)/i);
    if (nominee1Match) nomineeDetails.nominee1 = nominee1Match[1].trim();
    const nominee2Match = text.match(/Nominee\s*2:\s*([A-Za-z\s]+?)(?=Nominee\s*3:|$)/i);
    if (nominee2Match) nomineeDetails.nominee2 = nominee2Match[1].trim();
    const nominee3Match = text.match(/Nominee\s*3:\s*([A-Za-z\s]+)/i);
    if (nominee3Match) nomineeDetails.nominee3 = nominee3Match[1].trim();
    
    let openingUnitBalance = 0;
    const openingMatch = text.match(/Opening Unit Balance:\s*([\d,]+\.\d+)/i);
    if (openingMatch) {
      openingUnitBalance = parseFloat(openingMatch[1].replace(/,/g, ''));
    }
    
    let exitLoadText = '';
    const exitLoadMatch = text.match(/(?:Exit Load|Entry Load)[:\s]*([^"]+?)(?="Please ensure|$)/is);
    if (exitLoadMatch) {
      exitLoadText = exitLoadMatch[1].trim().substring(0, 500);
    }
    
    const transactions = this.parseTransactionsFromBlock(text, isin, folioNumber, schemeName);
    
    let firstPurchaseDate: string | undefined;
    const purchaseTransactions = transactions.filter(t => 
      ['Purchase', 'SIP', 'Switch In'].includes(t.transactionType)
    );
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
    const holderMatch = text.match(/Folio No:[^\n]+\n([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (holderMatch) {
      holderName = holderMatch[1].trim();
    }
    
    const unrealizedGain = marketValue - costValue;
    const unrealizedGainPercent = costValue > 0 ? (unrealizedGain / costValue) * 100 : 0;
    const avgCostPerUnit = unitBalance > 0 ? costValue / unitBalance : 0;
    
    console.log(`[CAS Service v2] Parsed: ${schemeName.substring(0, 40)}... | Units: ${unitBalance} | Cost: ${costValue} | Market: ${marketValue} | Txns: ${transactions.length}`);
    
    return {
      id: `cas-${isin}-${index}`,
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
   * Parse all transactions from a holding block
   */
  private parseTransactionsFromBlock(text: string, isin: string, folioNumber: string, schemeName: string): CASTransaction[] {
    const transactions: CASTransaction[] = [];
    
    const txnPattern = /(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})\s+((?:Purchase|Redemption|Switch[\s-]*In|Switch[\s-]*Out|Systematic Investment|Initial Purchase|NFO Purchase|Dividend)[^\n]*?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{3,6})\s+([\d,]+\.\d{4})\s+([\d,]+\.\d{3,6})/gi;
    
    let match;
    let txnIndex = 0;
    
    while ((match = txnPattern.exec(text)) !== null) {
      const dateStr = match[1];
      const description = match[2].trim();
      const amount = parseFloat(match[3].replace(/,/g, ''));
      const units = parseFloat(match[4].replace(/,/g, ''));
      const nav = parseFloat(match[5].replace(/,/g, ''));
      const balance = parseFloat(match[6].replace(/,/g, ''));
      
      let transactionType: CASTransaction['transactionType'] = 'Other';
      
      if (/Systematic Investment|SIP/i.test(description)) {
        transactionType = 'SIP';
      } else if (/Initial Purchase|NFO Purchase|Purchase/i.test(description)) {
        transactionType = 'Purchase';
      } else if (/Redemption/i.test(description)) {
        transactionType = 'Redemption';
      } else if (/Switch[\s-]*In/i.test(description)) {
        transactionType = 'Switch In';
      } else if (/Switch[\s-]*Out/i.test(description)) {
        transactionType = 'Switch Out';
      } else if (/Dividend/i.test(description)) {
        transactionType = 'Dividend';
      } else if (/Bonus/i.test(description)) {
        transactionType = 'Bonus';
      }
      
      let stampDuty = 0;
      const stampDutyMatch = text.substring(match.index, match.index + 200).match(/\*{3}\s*Stamp Duty\s*\*{3}\s*([\d,]+\.\d{2})/i);
      if (stampDutyMatch) {
        stampDuty = parseFloat(stampDutyMatch[1].replace(/,/g, ''));
      }
      
      transactions.push({
        id: `txn-${isin}-${txnIndex++}`,
        folioNumber,
        isin,
        schemeName,
        transactionDate: dateStr,
        transactionType,
        amount,
        units,
        nav,
        balance,
        description,
        stampDuty
      });
    }
    
    return transactions;
  }
  
  private async enrichHoldingsWithDatabase(holdings: CASHolding[]): Promise<CASHolding[]> {
    const isins = holdings.map(h => h.isin).filter(isin => isin.startsWith('INF'));
    
    if (isins.length === 0) return holdings;
    
    console.log('[CAS Service v2] Enriching', isins.length, 'holdings from database...');
    
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
      console.warn('[CAS Service v2] Database enrichment failed:', error.message);
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
    return holding.transactions.filter(t => 
      ['Purchase', 'SIP', 'Switch In', 'Bonus', 'Dividend'].includes(t.transactionType) &&
      t.units > 0
    );
  }
}

export const casStatementService = CASStatementService.getInstance();
