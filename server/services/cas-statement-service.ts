import { liveMFDataService } from './live-mf-data-service';
import { isinIntelligenceService } from './isin-intelligence-service';

/**
 * Parse CAS statement date format (DD-Mon-YYYY or DD/Mon/YYYY)
 * Examples: 18-Mar-2024, 02/Jul/2024, 29-Oct-2024
 */
export function parseCASDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Match DD-Mon-YYYY or DD/Mon/YYYY format
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

/**
 * Format Date to ISO date string (YYYY-MM-DD) for database storage
 */
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

export interface CASHolding {
  id: string;
  folioNumber: string;
  isin: string;
  schemeCode?: string;
  schemeName: string;
  amcName?: string;
  costValue: number;
  unitBalance: number;
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
}

export interface CASTransaction {
  id: string;
  folioNumber: string;
  isin: string;
  schemeName: string;
  transactionDate: string;
  transactionType: 'Purchase' | 'Redemption' | 'Switch In' | 'Switch Out' | 'SIP' | 'Dividend' | 'Other';
  amount: number;
  units: number;
  nav: number;
  balance?: number;
  description?: string;
}

export interface CASStatementResult {
  success: boolean;
  statementType: 'holding' | 'transaction' | 'combined';
  statementDate?: string;
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
    console.log('✅ CAS Statement Service initialized');
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
      statementType: 'holding',
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
      console.log('[CAS Service] Starting statement parse...');
      
      result.investor = this.extractInvestorInfo(text);
      result.statementDate = this.extractStatementDate(text);
      result.statementType = this.detectStatementType(text);
      
      console.log('[CAS Service] Statement type:', result.statementType);
      console.log('[CAS Service] Investor:', result.investor.name || 'Unknown');
      
      if (result.statementType === 'holding' || result.statementType === 'combined') {
        result.holdings = await this.parseHoldings(text);
      }
      
      if (result.statementType === 'transaction' || result.statementType === 'combined') {
        result.transactions = this.parseTransactions(text);
      }
      
      if (result.holdings.length > 0) {
        result.holdings = await this.enrichHoldingsWithDatabase(result.holdings);
      }
      
      result.summary = this.calculateSummary(result.holdings);
      result.confidenceScore = this.calculateConfidenceScore(result);
      result.success = result.holdings.length > 0 || result.transactions.length > 0;
      
      console.log('[CAS Service] Parse complete:', {
        holdings: result.holdings.length,
        transactions: result.transactions.length,
        totalValue: result.summary.totalCurrentValue.toFixed(2),
        confidence: result.confidenceScore
      });
      
    } catch (error: any) {
      console.error('[CAS Service] Parse error:', error);
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
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i];
      if (line.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+/) && 
          !line.includes('Consolidated') && 
          !line.includes('Statement') &&
          !line.includes('Email') &&
          !line.includes('Mobile') &&
          line.length < 50) {
        info.name = line.trim();
        break;
      }
    }
    
    return info;
  }
  
  private extractStatementDate(text: string): string | undefined {
    const dateMatch = text.match(/As\s*on\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})/i);
    return dateMatch ? dateMatch[1] : undefined;
  }
  
  private detectStatementType(text: string): 'holding' | 'transaction' | 'combined' {
    const hasTransactionDates = /\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4}\s+(Purchase|Redemption|Switch|SIP|Dividend)/i.test(text);
    const hasHoldingColumns = /Cost\s*Value|Unit\s*Balance|Market\s*Value|NAV\s*Date/i.test(text);
    
    if (hasTransactionDates && hasHoldingColumns) return 'combined';
    if (hasTransactionDates) return 'transaction';
    return 'holding';
  }
  
  private async parseHoldings(text: string): Promise<CASHolding[]> {
    const holdings: CASHolding[] = [];
    
    const isinPattern = /INF[A-Z0-9]{9}/gi;
    const isinMatches = [...new Set(text.match(isinPattern) || [])];
    
    console.log('[CAS Service] Found', isinMatches.length, 'unique ISINs');
    
    if (isinMatches.length === 0) {
      return holdings;
    }
    
    for (const isin of isinMatches) {
      try {
        const holding = this.extractHoldingByISIN(text, isin, holdings.length);
        if (holding) {
          holdings.push(holding);
        }
      } catch (error: any) {
        console.warn('[CAS Service] Failed to parse holding for ISIN:', isin, error.message);
      }
    }
    
    return holdings;
  }
  
  private extractHoldingByISIN(text: string, isin: string, index: number): CASHolding | null {
    const isinIndex = text.indexOf(isin);
    if (isinIndex < 0) return null;
    
    const beforeIsin = text.substring(Math.max(0, isinIndex - 150), isinIndex);
    const afterIsin = text.substring(isinIndex + isin.length, Math.min(text.length, isinIndex + isin.length + 800));
    
    const folioMatch = beforeIsin.match(/(\d{5,}(?:\/\d+)?)\s*$/);
    const folioNumber = folioMatch ? folioMatch[1] : '';
    
    let schemeName = '';
    let schemeCode = '';
    
    const schemeMatch = afterIsin.match(/^\s*([A-Z0-9]{2,10})\s*[-–]\s*(.+?)(?=\d{1,3}(?:,\d{3})*\.\d{2})/is);
    if (schemeMatch) {
      schemeCode = schemeMatch[1].trim();
      schemeName = schemeMatch[2].trim();
      schemeName = schemeName.replace(/\s+/g, ' ').replace(/\s*[-–]\s*$/, '').replace(/\(Non-?Demat\)/gi, '').replace(/\(Demat\)/gi, '').trim();
    }
    
    const numberPattern = /(\d{1,3}(?:,\d{3})*\.\d{2,6})/g;
    const allNumbers: { value: number; position: number }[] = [];
    let match;
    while ((match = numberPattern.exec(afterIsin)) !== null) {
      const num = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(num) && num > 0) {
        allNumbers.push({ value: num, position: match.index });
      }
    }
    
    console.log(`[CAS Debug] ISIN ${isin}: Found ${allNumbers.length} numbers:`, allNumbers.map(n => n.value));
    
    if (allNumbers.length < 4) {
      console.warn('[CAS Service] Insufficient numeric data for ISIN:', isin, 'found:', allNumbers.length);
      return null;
    }
    
    const numbers = allNumbers.map(n => n.value);
    
    let costValue = 0;
    let unitBalance = 0;
    let nav = 0;
    let marketValue = 0;
    let bestMatch = { costIdx: 0, unitIdx: 1, navIdx: 2, marketIdx: 3, score: Infinity };
    
    for (let costIdx = 0; costIdx < Math.min(numbers.length - 3, 3); costIdx++) {
      for (let unitIdx = costIdx + 1; unitIdx < Math.min(numbers.length - 2, costIdx + 3); unitIdx++) {
        for (let navIdx = unitIdx + 1; navIdx < Math.min(numbers.length - 1, unitIdx + 3); navIdx++) {
          for (let marketIdx = navIdx + 1; marketIdx < Math.min(numbers.length, navIdx + 3); marketIdx++) {
            const testCost = numbers[costIdx];
            const testUnits = numbers[unitIdx];
            const testNav = numbers[navIdx];
            const testMarket = numbers[marketIdx];
            
            if (testNav > 50000) continue;
            if (testNav < 1) continue;
            if (testUnits <= 0) continue;
            
            const calculatedMarket = testUnits * testNav;
            const tolerance = Math.abs(calculatedMarket - testMarket) / Math.max(testMarket, 1);
            
            if (tolerance < 0.05) {
              const costCheck = Math.abs(testCost - testMarket) / Math.max(testMarket, 1);
              const score = tolerance + (costCheck > 2 ? 0.5 : 0);
              
              if (score < bestMatch.score) {
                bestMatch = { costIdx, unitIdx, navIdx, marketIdx, score };
              }
            }
          }
        }
      }
    }
    
    if (bestMatch.score < 0.1) {
      costValue = numbers[bestMatch.costIdx];
      unitBalance = numbers[bestMatch.unitIdx];
      nav = numbers[bestMatch.navIdx];
      marketValue = numbers[bestMatch.marketIdx];
      console.log(`[CAS Debug] ISIN ${isin}: Best match found - Cost: ${costValue}, Units: ${unitBalance}, NAV: ${nav}, Market: ${marketValue}`);
    } else {
      costValue = numbers[0];
      unitBalance = numbers[1];
      
      for (let i = 2; i < numbers.length - 1; i++) {
        const testNav = numbers[i];
        const testMarket = numbers[i + 1];
        
        if (testNav >= 1 && testNav <= 50000) {
          const calculated = unitBalance * testNav;
          const tolerance = Math.abs(calculated - testMarket) / Math.max(testMarket, 1);
          
          if (tolerance < 0.1) {
            nav = testNav;
            marketValue = testMarket;
            break;
          }
        }
      }
      
      if (marketValue === 0 && numbers.length >= 4) {
        nav = numbers[2];
        marketValue = numbers[3];
      }
      
      console.log(`[CAS Debug] ISIN ${isin}: Fallback - Cost: ${costValue}, Units: ${unitBalance}, NAV: ${nav}, Market: ${marketValue}`);
    }
    
    if (nav > 10000 || nav < 0.1) {
      if (unitBalance > 0 && marketValue > 0) {
        nav = marketValue / unitBalance;
        console.log(`[CAS Debug] ISIN ${isin}: Recalculated NAV: ${nav}`);
      }
    }
    
    const navDateMatch = afterIsin.match(/(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})/);
    const navDate = navDateMatch ? navDateMatch[1] : undefined;
    
    const registrarMatch = afterIsin.match(/(CAMS|KFINTECH)/i);
    const registrar = registrarMatch ? 
      (registrarMatch[1].toUpperCase() === 'KFINTECH' ? 'KFINTECH' : 'CAMS') : 
      'UNKNOWN';
    
    const isDemat = /\(Demat\)/i.test(afterIsin) || !/\(Non-?Demat\)/i.test(afterIsin) && beforeIsin.includes('Demat');
    
    let planType: 'Regular' | 'Direct' | undefined;
    if (/Direct\s*(Plan)?/i.test(schemeName) || /Direct\s*(Plan)?/i.test(afterIsin)) {
      planType = 'Direct';
    } else if (/Regular\s*(Plan)?/i.test(schemeName) || /Regular\s*(Plan)?/i.test(afterIsin)) {
      planType = 'Regular';
    }
    
    let optionType: 'Growth' | 'IDCW' | 'Dividend' | undefined;
    if (/Growth/i.test(schemeName)) {
      optionType = 'Growth';
    } else if (/IDCW/i.test(schemeName) || /Dividend/i.test(schemeName)) {
      optionType = 'IDCW';
    }
    
    const unrealizedGain = marketValue - costValue;
    const unrealizedGainPercent = costValue > 0 ? (unrealizedGain / costValue) * 100 : 0;
    const avgCostPerUnit = unitBalance > 0 ? costValue / unitBalance : 0;
    
    return {
      id: `cas-${isin}-${index}`,
      folioNumber,
      isin,
      schemeCode,
      schemeName: schemeName || `Mutual Fund (ISIN: ${isin})`,
      costValue,
      unitBalance,
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
      isDemat
    };
  }
  
  private parseTransactions(text: string): CASTransaction[] {
    const transactions: CASTransaction[] = [];
    
    const txnPattern = /(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})\s+(Purchase|Redemption|Switch\s*In|Switch\s*Out|SIP|Dividend|Systematic[^,]*)/gi;
    let match;
    let index = 0;
    
    while ((match = txnPattern.exec(text)) !== null) {
      const date = match[1];
      const type = match[2].trim();
      
      const afterMatch = text.substring(match.index + match[0].length, Math.min(text.length, match.index + match[0].length + 200));
      
      const amountMatch = afterMatch.match(/(-?[\d,]+\.\d{2})/);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;
      
      const unitsMatch = afterMatch.match(/(\d+\.\d{3,4})/);
      const units = unitsMatch ? parseFloat(unitsMatch[1]) : 0;
      
      const navMatch = afterMatch.match(/(\d+\.\d{4})/);
      const nav = navMatch ? parseFloat(navMatch[1]) : 0;
      
      let transactionType: CASTransaction['transactionType'] = 'Other';
      if (/Purchase|SIP|Systematic.*Investment/i.test(type)) transactionType = 'Purchase';
      else if (/Redemption/i.test(type)) transactionType = 'Redemption';
      else if (/Switch\s*In/i.test(type)) transactionType = 'Switch In';
      else if (/Switch\s*Out/i.test(type)) transactionType = 'Switch Out';
      else if (/SIP/i.test(type)) transactionType = 'SIP';
      else if (/Dividend/i.test(type)) transactionType = 'Dividend';
      
      transactions.push({
        id: `txn-${Date.now()}-${index++}`,
        folioNumber: '',
        isin: '',
        schemeName: '',
        transactionDate: date,
        transactionType,
        amount,
        units,
        nav,
        description: type
      });
    }
    
    return transactions;
  }
  
  private async enrichHoldingsWithDatabase(holdings: CASHolding[]): Promise<CASHolding[]> {
    const isins = holdings.map(h => h.isin).filter(isin => isin.startsWith('INF'));
    
    if (isins.length === 0) return holdings;
    
    console.log('[CAS Service] Enriching', isins.length, 'holdings from database...');
    
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
            amcName: dbFund.fundHouse,
            nav: currentNav,
            marketValue: calculatedMarketValue,
            unrealizedGain,
            unrealizedGainPercent
          };
        }
        return holding;
      });
    } catch (error: any) {
      console.warn('[CAS Service] Database enrichment failed:', error.message);
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
    
    if (holdingsWithIsin.length === result.holdings.length) score += 5;
    if (holdingsWithFolio.length === result.holdings.length) score += 5;
    if (holdingsWithNav.length === result.holdings.length) score += 5;
    
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
  
  /**
   * Get first purchase date per folio from transactions
   */
  getFirstPurchaseDateByFolio(transactions: CASTransaction[]): Map<string, string> {
    const folioFirstPurchase = new Map<string, string>();
    
    // Filter purchase-type transactions and sort by date using proper CAS date parser
    const purchaseTransactions = transactions
      .filter(t => t.transactionType === 'Purchase' || t.transactionType === 'SIP')
      .sort((a, b) => {
        const dateA = parseCASDate(a.transactionDate);
        const dateB = parseCASDate(b.transactionDate);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime();
      });
    
    // Get first purchase date for each folio
    for (const txn of purchaseTransactions) {
      if (!folioFirstPurchase.has(txn.folioNumber)) {
        folioFirstPurchase.set(txn.folioNumber, txn.transactionDate);
      }
    }
    
    return folioFirstPurchase;
  }

  /**
   * Convert CAS holdings to portfolio format with purchase dates
   */
  convertToPortfolioHoldingsWithDates(
    holdings: CASHolding[], 
    transactions: CASTransaction[]
  ): any[] {
    const folioFirstPurchase = this.getFirstPurchaseDateByFolio(transactions);
    
    return holdings.map(h => {
      const dateStr = folioFirstPurchase.get(h.folioNumber);
      const parsedDate = dateStr ? parseCASDate(dateStr) : null;
      
      return {
        id: h.id,
        name: h.schemeName,
        isin: h.isin,
        symbol: h.schemeCode,
        assetType: h.assetType,
        quantity: h.unitBalance,
        averageCost: h.avgCostPerUnit,
        investedValue: h.costValue,
        currentNav: h.nav,
        currentValue: h.marketValue,
        unrealizedGain: h.unrealizedGain,
        unrealizedGainPercent: h.unrealizedGainPercent,
        folioNumber: h.folioNumber,
        purchaseDate: parsedDate ? formatDateToISO(parsedDate) : null,
        broker: h.registrar === 'KFINTECH' ? 'KFintech' : 'CAMS',
        confidenceScore: 90
      };
    });
  }

  async getHoldingsByFolio(holdings: CASHolding[], folioNumber: string): Promise<CASHolding[]> {
    return holdings.filter(h => h.folioNumber === folioNumber);
  }
  
  convertToPortfolioHoldings(holdings: CASHolding[]): any[] {
    return holdings.map(h => ({
      id: h.id,
      name: h.schemeName,
      isin: h.isin,
      symbol: h.schemeCode,
      assetType: h.assetType,
      quantity: h.unitBalance,
      averageCost: h.avgCostPerUnit,
      investedValue: h.costValue,
      currentNav: h.nav,
      currentValue: h.marketValue,
      unrealizedGain: h.unrealizedGain,
      unrealizedGainPercent: h.unrealizedGainPercent,
      folioNumber: h.folioNumber,
      broker: h.registrar === 'KFINTECH' ? 'KFintech' : 'CAMS',
      confidenceScore: 90
    }));
  }
}

export const casStatementService = CASStatementService.getInstance();
