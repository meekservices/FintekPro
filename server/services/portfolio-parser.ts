import * as cheerio from 'cheerio';
import { liveMFDataService } from './live-mf-data-service';
import { isinIntelligenceService } from './isin-intelligence-service';
import { unifiedPDFParser } from './unified-pdf-parser';
import { holdingNormalizationService } from './holding-normalization-service';
import { GoogleGenAI } from '@google/genai';

export interface TransactionLot {
  purchaseDate: string;
  transactionType: 'purchase' | 'sip' | 'switch_in' | 'bonus' | 'dividend_reinvest' | 'redemption' | 'switch_out';
  amount: number;
  units: number;
  navAtPurchase: number;
  runningBalance: number;
  description?: string;
}

export interface ImportedHolding {
  id?: string;
  name: string;
  isin?: string;
  symbol?: string;
  assetType: 'equity' | 'mutual_fund' | 'etf' | 'bond' | 'gold' | 'fd' | 'other';
  quantity: number;
  averageCost?: number;
  currentValue: number;
  currentNav?: number;
  investedValue?: number;
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
  folioNumber?: string;
  broker?: string;
  confidenceScore?: number;
  // ISIN Intelligence Layer enrichment
  instrumentType?: string;
  regulator?: string;
  isEdgeCase?: boolean;
  // Transaction-level lots for LTCG/STCG tracking
  lots?: TransactionLot[];
}

export interface ImportedAllocation {
  equity: number;
  debt: number;
  gold: number;
  cash: number;
  others: number;
}

export interface ImportedPortfolioSnapshot {
  holdings: ImportedHolding[];
  totalInvestedValue: number;
  totalCurrentValue: number;
  totalUnrealizedGain?: number;
  allocation?: ImportedAllocation;
  sourceType: 'pdf_upload' | 'url_import' | 'manual_entry' | 'api_fetch';
  sourceName?: string;
  sourceUrl?: string;
  fileName?: string;
  capturedAt: string;
  parsingStatus: 'pending' | 'parsing' | 'completed' | 'failed' | 'needs_review';
  parsingErrors?: string[];
  confidenceScore?: number;
  brokerDetected?: string;
}

interface ParseResult {
  success: boolean;
  holdings: ImportedHolding[];
  brokerDetected: string | null;
  confidenceScore: number;
  errors: string[];
  rawText?: string;
  expectedCount?: number;
  importedCount?: number;
  unimportedCount?: number;
  needsManualReview?: boolean;
}

import * as crypto from 'crypto';

interface CachedParseResult {
  result: ParseResult;
  timestamp: number;
}

const parseCache = new Map<string, CachedParseResult>();
const PARSE_CACHE_TTL = 24 * 60 * 60 * 1000;

// Export function to clear cache (useful after parser updates)
export function clearParseCache(): void {
  parseCache.clear();
  console.log('[PDF Parser] Cache cleared');
}

function computeFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 16);
}

function getCachedResult(hash: string): ParseResult | null {
  const cached = parseCache.get(hash);
  if (cached && Date.now() - cached.timestamp < PARSE_CACHE_TTL) {
    console.log(`[PDF Parser] Cache hit for hash ${hash}`);
    return cached.result;
  }
  if (cached) {
    parseCache.delete(hash);
  }
  return null;
}

function setCachedResult(hash: string, result: ParseResult): void {
  if (parseCache.size > 100) {
    const oldest = Array.from(parseCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) parseCache.delete(oldest[0]);
  }
  parseCache.set(hash, { result, timestamp: Date.now() });
}

const BROKER_PATTERNS: Record<string, { name: string; patterns: RegExp[] }> = {
  cas: {
    name: 'CAMS/KFintech CAS',
    patterns: [
      /consolidated\s*account\s*statement/i,
      /cams.*statement/i,
      /kfintech.*statement/i,
      /mutual\s*fund.*statement/i,
      /CAS\s*Report/i,
      /CAS\s*Summary/i
    ]
  },
  zerodha: {
    name: 'Zerodha',
    patterns: [/zerodha/i, /kite/i, /console\.zerodha/i, /holdings.*zerodha/i]
  },
  groww: {
    name: 'Groww',
    patterns: [/groww/i, /groww\.in/i, /groww\s+portfolio/i]
  },
  icici: {
    name: 'ICICI Direct',
    patterns: [/icici\s*direct/i, /icicidirect/i, /icici\s*securities/i]
  },
  hdfc: {
    name: 'HDFC Securities',
    patterns: [/hdfc\s*securities/i, /hdfcsec/i]
  },
  kotak: {
    name: 'Kotak Securities',
    patterns: [/kotak\s*securities/i, /kotaksecurities/i]
  },
  upstox: {
    name: 'Upstox',
    patterns: [/upstox/i, /upstox\.com/i]
  },
  angelone: {
    name: 'Angel One',
    patterns: [/angel\s*one/i, /angelbroking/i, /angel\s*broking/i]
  },
  mfcentral: {
    name: 'MF Central',
    patterns: [/mf\s*central/i, /mfcentral/i, /cams/i]
  },
  wealthy: {
    name: 'Wealthy.in',
    patterns: [/wealthy\.in/i, /wealthy/i]
  }
};

function detectBroker(text: string): { broker: string | null; confidence: number } {
  for (const [key, config] of Object.entries(BROKER_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(text)) {
        return { broker: config.name, confidence: 85 };
      }
    }
  }
  return { broker: null, confidence: 50 };
}

function parseZerodhaFormat(text: string): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  const lines = text.split('\n');
  
  const holdingPattern = /([A-Z][A-Z0-9&\-\s]{2,30})\s+(\d+(?:,\d+)*(?:\.\d+)?)\s+₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s+₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)/;
  
  for (const line of lines) {
    const match = line.match(holdingPattern);
    if (match) {
      const [, name, qty, avgCost, currentVal] = match;
      const quantity = parseFloat(qty.replace(/,/g, ''));
      const averageCost = parseFloat(avgCost.replace(/,/g, ''));
      const currentValue = parseFloat(currentVal.replace(/,/g, ''));
      
      if (quantity > 0 && currentValue > 0) {
        holdings.push({
          id: `holding-${Date.now()}-${holdings.length}`,
          name: name.trim(),
          assetType: 'equity',
          quantity,
          averageCost,
          currentValue,
          investedValue: quantity * averageCost,
          unrealizedGain: currentValue - (quantity * averageCost),
          broker: 'Zerodha',
          confidenceScore: 80
        });
      }
    }
  }
  
  return holdings;
}

function parseGrowwFormat(text: string): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  const lines = text.split('\n');
  
  const mfPattern = /([A-Za-z\s\-]+(?:Fund|Scheme)[A-Za-z\s\-]*)\s+(\d+(?:\.\d+)?)\s+units?\s+₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i;
  const stockPattern = /([A-Z][A-Z0-9&\s]{2,25})\s+(\d+)\s+shares?\s+₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i;
  
  for (const line of lines) {
    let match = line.match(mfPattern);
    if (match) {
      const [, name, units, value] = match;
      holdings.push({
        id: `holding-${Date.now()}-${holdings.length}`,
        name: name.trim(),
        assetType: 'mutual_fund',
        quantity: parseFloat(units),
        currentValue: parseFloat(value.replace(/,/g, '')),
        broker: 'Groww',
        confidenceScore: 75
      });
      continue;
    }
    
    match = line.match(stockPattern);
    if (match) {
      const [, name, qty, value] = match;
      holdings.push({
        id: `holding-${Date.now()}-${holdings.length}`,
        name: name.trim(),
        assetType: 'equity',
        quantity: parseInt(qty),
        currentValue: parseFloat(value.replace(/,/g, '')),
        broker: 'Groww',
        confidenceScore: 75
      });
    }
  }
  
  return holdings;
}

function parseMFCentralFormat(text: string): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  const lines = text.split('\n');
  
  const mfPattern = /([A-Za-z0-9\s\-&]+(?:Fund|Scheme|Plan|Growth|IDCW)[A-Za-z0-9\s\-&]*)\s+(?:Folio[:\s]*)?(\d+)\s+(\d+(?:\.\d+)?)\s+₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i;
  
  for (const line of lines) {
    const match = line.match(mfPattern);
    if (match) {
      const [, name, folio, units, value] = match;
      holdings.push({
        id: `holding-${Date.now()}-${holdings.length}`,
        name: name.trim(),
        assetType: 'mutual_fund',
        quantity: parseFloat(units),
        currentValue: parseFloat(value.replace(/,/g, '')),
        folioNumber: folio,
        broker: 'MF Central',
        confidenceScore: 85
      });
    }
  }
  
  return holdings;
}

// CAS (Consolidated Account Statement) PDF parser for CAMS/KFintech/MFCentral statements
function parseCASFormat(text: string): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('[CAS Parser] Starting parse, total lines:', lines.length);
  
  let currentAMC = '';
  let currentFolio = '';
  let currentSchemeName = '';
  let currentISIN = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect AMC headers (e.g., "Aditya Birla Sun Life Mutual Fund", "ICICI Prudential Mutual Fund")
    if (/Mutual\s*Fund\s*$/i.test(line) && !line.includes('ISIN') && !line.includes('Folio')) {
      currentAMC = line.trim();
      console.log('[CAS Parser] Found AMC:', currentAMC);
      continue;
    }
    
    // Detect folio number (e.g., "Folio No: 1036594120" or "Folio No : 16888427")
    const folioMatch = line.match(/Folio\s*(?:No\.?|Number)?\s*[:\s]+\s*(\d+(?:\/\d+)?)/i);
    if (folioMatch) {
      currentFolio = folioMatch[1];
      console.log('[CAS Parser] Found Folio:', currentFolio);
      continue;
    }
    
    // MFCentral Format - Scheme name with ISIN on same or adjacent lines
    // Pattern: "Aditya Birla Sun Life Small Cap Fund Growth-Regular Plan (Advisor: ARN-28612)"
    // followed by: "ISIN: INF209K01EN2"
    // Key patterns to detect scheme names:
    // - Contains "Fund" or "Plan" or "FOF" or "ETF" or "Growth" or "IDCW"
    // - May have "(Advisor: ARN-XXXXX)" suffix
    // - NOT just "Mutual Fund" header lines
    
    const schemeNamePattern = /^(.+?(?:Fund|Plan|FOF|ETF|Growth|IDCW|Dividend)[A-Za-z0-9\s\-&()]*?)(?:\s*\(Advisor[:\s]+ARN[^\)]*\))?$/i;
    const schemeMatch = line.match(schemeNamePattern);
    
    if (schemeMatch && !line.includes('Mutual Fund$') && line.length > 20) {
      const potentialScheme = schemeMatch[1].trim();
      // Verify this looks like a scheme name and not just noise
      // Exclude: date-prefixed lines, "Scheme Name Change", transaction dates, notes
      const isValidSchemeName = potentialScheme.length > 15 && 
          !potentialScheme.match(/^(scheme|fund|name|units|nav|value|balance|date|registrar|isin)/i) &&
          !potentialScheme.match(/^Mutual\s*Fund$/i) &&
          !potentialScheme.match(/^\d{1,2}[-\/][A-Z]{3}[-\/]\d{2,4}/i) &&  // Date prefix like "30-JUN-2025"
          !potentialScheme.match(/Scheme\s*Name\s*Change/i) &&  // Footnotes about scheme changes
          !potentialScheme.match(/^(Transaction|Folio|Registrar|ISIN|Advisor|PAN|Email|Mobile|Address|Nominee)/i) &&
          !potentialScheme.match(/^(formerly|previously|erstwhile)\s/i);  // Avoid partial matches on footnotes
      
      if (isValidSchemeName) {
        currentSchemeName = potentialScheme;
        console.log('[CAS Parser] Found potential scheme name:', currentSchemeName);
      }
    }
    
    // Extract ISIN - often on its own line with scheme name at the start
    // Format: "Scheme Name (Advisor: ARN-...) ISIN: INF209K01PF4"
    const isinMatch = line.match(/ISIN[:\s]+([A-Z]{2}[A-Z0-9]{10})/i);
    if (isinMatch) {
      currentISIN = isinMatch[1];
      console.log('[CAS Parser] Found ISIN:', currentISIN);
      
      // Extract scheme name from before ISIN on the same line
      // This is the most reliable way to get scheme names in MFCentral format
      const schemeFromISINLine = line.replace(/\s*ISIN[:\s]+[A-Z0-9]+.*$/i, '')
                                      .replace(/\s*\(Advisor[:\s]+ARN[^\)]*\)/i, '')
                                      .replace(/\s*\(Erstwhile[^\)]*\)/i, '')
                                      .trim();
      
      if (schemeFromISINLine.length > 15 && 
          (schemeFromISINLine.match(/Fund|Plan|FOF|ETF/i) || schemeFromISINLine.includes('-'))) {
        currentSchemeName = schemeFromISINLine;
        console.log('[CAS Parser] Extracted scheme from ISIN line:', currentSchemeName);
      }
    }
    
    // MFCentral MAIN PATTERN - "Closing Unit Balance: X.XXX    Nav as on DD-MMM-YYYY: INR Y.YY    Valuation on DD-Mmm-YYYY : INR Z,ZZZ.ZZ"
    // This is the key line that contains the actual holding data
    const mfCentralPattern = /Closing\s*Unit\s*Balance[:\s]+([0-9,]+(?:\.\d+)?)\s+(?:Nav\s*(?:as\s*on)?[:\s]+)?(?:\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4})?[:\s]*(?:INR\s*)?([0-9,]+(?:\.\d+)?)\s+(?:Valuation\s*(?:on)?[:\s]+)?(?:\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{2,4})?[:\s]*(?:INR\s*)?([0-9,]+(?:\.\d+)?)/i;
    
    let match = line.match(mfCentralPattern);
    if (match) {
      const units = parseFloat(match[1].replace(/,/g, ''));
      const nav = parseFloat(match[2].replace(/,/g, ''));
      const valuation = parseFloat(match[3].replace(/,/g, ''));
      
      console.log('[CAS Parser] MFCentral pattern matched! Units:', units, 'NAV:', nav, 'Valuation:', valuation);
      
      if (units > 0 && valuation > 0) {
        // Try to find scheme name from previous lines if not already captured
        let schemeName = currentSchemeName;
        if (!schemeName || schemeName.length < 10) {
          // Look back up to 10 lines to find scheme name
          for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
            const prevLine = lines[j];
            // Must contain fund keywords and pass same validation as scheme name detection
            if (prevLine.match(/Fund|Plan|FOF|ETF|Growth|IDCW/i) && 
                !prevLine.includes('Mutual Fund$') &&
                !prevLine.includes('Closing Unit') &&
                !prevLine.includes('Opening Unit') &&
                !prevLine.match(/^\d{1,2}[-\/][A-Z]{3}[-\/]\d{2,4}/i) &&  // No date prefix
                !prevLine.match(/Scheme\s*Name\s*Change/i) &&  // No footnotes
                !prevLine.match(/^(Transaction|Folio|Registrar|ISIN|Advisor)/i) &&
                prevLine.length > 20) {
              schemeName = prevLine.replace(/\s*\(Advisor[:\s]+ARN[^\)]*\)/i, '').trim();
              break;
            }
          }
        }
        
        if (!schemeName) schemeName = `Unknown Scheme (ISIN: ${currentISIN || 'N/A'})`;
        
        holdings.push({
          id: `cas-${Date.now()}-${holdings.length}`,
          name: schemeName,
          isin: currentISIN || undefined,
          assetType: 'mutual_fund',
          quantity: units,
          currentNav: nav,
          currentValue: valuation,
          folioNumber: currentFolio,
          broker: 'MFCentral/CAMS',
          confidenceScore: 95
        });
        
        console.log('[CAS Parser] Added holding:', schemeName, '- Value:', valuation);
        
        // Reset for next fund
        currentSchemeName = '';
        currentISIN = '';
      }
      continue;
    }
    
    // Alternative MFCentral pattern - sometimes on separate lines or with different formatting
    // "Closing Unit Balance: 2,214.675" on one line
    const closingBalanceMatch = line.match(/Closing\s*Unit\s*Balance[:\s]+([0-9,]+(?:\.\d+)?)/i);
    if (closingBalanceMatch) {
      const units = parseFloat(closingBalanceMatch[1].replace(/,/g, ''));
      
      // Look for NAV and Valuation in the same line or next lines
      let navValue = 0;
      let valuation = 0;
      
      // Check rest of current line for Nav and Valuation
      const navMatch = line.match(/Nav[:\s]+(?:INR\s*)?([0-9,]+(?:\.\d+)?)/i) || 
                       line.match(/Nav\s*as\s*on[^:]*:[:\s]*(?:INR\s*)?([0-9,]+(?:\.\d+)?)/i);
      const valuationMatch = line.match(/Valuation[^:]*:[:\s]*(?:INR\s*)?([0-9,]+(?:\.\d+)?)/i);
      
      if (navMatch) navValue = parseFloat(navMatch[1].replace(/,/g, ''));
      if (valuationMatch) valuation = parseFloat(valuationMatch[1].replace(/,/g, ''));
      
      // If not found in current line, check next few lines
      if (navValue === 0 || valuation === 0) {
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          const nextLine = lines[j];
          if (navValue === 0) {
            const navNextMatch = nextLine.match(/Nav[:\s]+(?:INR\s*)?([0-9,]+(?:\.\d+)?)/i);
            if (navNextMatch) navValue = parseFloat(navNextMatch[1].replace(/,/g, ''));
          }
          if (valuation === 0) {
            const valNextMatch = nextLine.match(/Valuation[^:]*:[:\s]*(?:INR\s*)?([0-9,]+(?:\.\d+)?)/i);
            if (valNextMatch) valuation = parseFloat(valNextMatch[1].replace(/,/g, ''));
          }
        }
      }
      
      if (units > 0 && valuation > 0) {
        let schemeName = currentSchemeName;
        if (!schemeName || schemeName.length < 10) {
          for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
            const prevLine = lines[j];
            // Must contain fund keywords and pass same validation as scheme name detection
            if (prevLine.match(/Fund|Plan|FOF|ETF|Growth|IDCW/i) && 
                !prevLine.includes('Mutual Fund$') &&
                !prevLine.includes('Closing Unit') &&
                !prevLine.includes('Opening Unit') &&
                !prevLine.match(/^\d{1,2}[-\/][A-Z]{3}[-\/]\d{2,4}/i) &&  // No date prefix
                !prevLine.match(/Scheme\s*Name\s*Change/i) &&  // No footnotes
                !prevLine.match(/^(Transaction|Folio|Registrar|ISIN|Advisor)/i) &&
                prevLine.length > 20) {
              schemeName = prevLine.replace(/\s*\(Advisor[:\s]+ARN[^\)]*\)/i, '').trim();
              break;
            }
          }
        }
        
        if (!schemeName) schemeName = `Unknown Scheme (ISIN: ${currentISIN || 'N/A'})`;
        
        holdings.push({
          id: `cas-${Date.now()}-${holdings.length}`,
          name: schemeName,
          isin: currentISIN || undefined,
          assetType: 'mutual_fund',
          quantity: units,
          currentNav: navValue,
          currentValue: valuation,
          folioNumber: currentFolio,
          broker: 'MFCentral/CAMS',
          confidenceScore: 90
        });
        
        console.log('[CAS Parser] Added holding (alt pattern):', schemeName, '- Value:', valuation);
        
        currentSchemeName = '';
        currentISIN = '';
      }
      continue;
    }
    
    // Legacy patterns for other CAS formats
    // Pattern 1: "Scheme Name | Units: X.XXX | NAV: ₹Y.YY | Value: ₹Z,ZZZ.ZZ"
    const casPattern1 = /([A-Za-z0-9\s\-&()]+(?:Fund|Scheme|Plan|Growth|IDCW|Direct|Regular)[A-Za-z0-9\s\-&()]*)\s*[\|:]\s*Units?[:\s]+(\d+(?:\.\d+)?)\s*[\|:]\s*NAV[:\s]+₹?(\d+(?:,?\d+)*(?:\.\d+)?)\s*[\|:]\s*(?:Value|Market\s*Value)[:\s]+₹?(\d+(?:,?\d+)*(?:\.\d+)?)/i;
    
    match = line.match(casPattern1);
    if (match) {
      const [, name, units, nav, value] = match;
      holdings.push({
        id: `cas-${Date.now()}-${holdings.length}`,
        name: name.trim(),
        assetType: 'mutual_fund',
        quantity: parseFloat(units),
        currentNav: parseFloat(nav.replace(/,/g, '')),
        currentValue: parseFloat(value.replace(/,/g, '')),
        folioNumber: currentFolio,
        broker: 'CAMS/KFintech',
        confidenceScore: 90
      });
      continue;
    }
    
    // Pattern 3: Table format with columns (common in CAS PDFs)
    // IMPORTANT: Skip transaction lines that start with dates (e.g., "20-JUN-2025 Purchase SIP...")
    // These are individual transactions, not holdings summaries
    const isTransactionLine = line.match(/^\d{1,2}[-\/][A-Z]{3}[-\/]\d{2,4}/i) ||  // Date prefix
                              line.includes('Purchase') || 
                              line.includes('Redemption') ||
                              line.includes('SIP') ||
                              line.includes('Switch In') ||
                              line.includes('Switch Out') ||
                              line.includes('Dividend');
    
    if (!isTransactionLine) {
      const casPattern3 = /^(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:,\d+)*(?:\.\d+)?)\s*$/;
      match = line.match(casPattern3);
      if (match) {
        const [, name, units, nav, value] = match;
        const schemeName = name.trim();
        if (/^(scheme|fund|name|units|nav|value|balance|date|transaction|folio)/i.test(schemeName)) continue;
        if (parseFloat(units) > 0 && parseFloat(value.replace(/,/g, '')) > 0) {
          holdings.push({
            id: `cas-${Date.now()}-${holdings.length}`,
            name: schemeName,
            assetType: 'mutual_fund',
            quantity: parseFloat(units),
            currentNav: parseFloat(nav),
            currentValue: parseFloat(value.replace(/,/g, '')),
            folioNumber: currentFolio,
            broker: 'CAMS/KFintech',
            confidenceScore: 85
          });
        }
        continue;
      }
    }
  }
  
  console.log('[CAS Parser] Total holdings found:', holdings.length);
  console.log('[CAS Parser] Total value:', holdings.reduce((sum, h) => sum + h.currentValue, 0));
  
  return holdings;
}

/**
 * Column mapping configuration detected from headers
 */
interface ColumnMapping {
  costIndex: number;      // Index for Cost Value / Invested Value
  unitsIndex: number;     // Index for Unit Balance / Units
  navIndex: number;       // Index for NAV
  marketIndex: number;    // Index for Market Value / Current Value
  headerDetected: boolean;
}

/**
 * Detect column headers from CAS statement and return mapping
 * Supports various header formats:
 * - "Cost Value | Unit Balance | NAV | Market Value"
 * - "Invested | Units | NAV Date | NAV | Current Value"
 * - "Amount | Balance | Rate | Value"
 */
function detectColumnHeaders(text: string): ColumnMapping {
  const defaultMapping: ColumnMapping = {
    costIndex: 0,
    unitsIndex: 1,
    navIndex: 2,
    marketIndex: 3,
    headerDetected: false
  };
  
  // Common header patterns (case-insensitive)
  const headerPatterns = [
    // Standard CAMS/KFintech format
    /(?:folio|isin|scheme).*?(cost\s*(?:value)?|invested|amount).*?(unit\s*(?:balance)?|balance|units).*?(nav).*?(market\s*(?:value)?|current\s*(?:value)?|valuation)/i,
    // Alternative ordering
    /(?:folio|isin|scheme).*?(unit\s*(?:balance)?|balance|units).*?(cost\s*(?:value)?|invested|amount).*?(nav).*?(market\s*(?:value)?|current\s*(?:value)?|valuation)/i,
    // Header row patterns
    /(cost\s*value|invested\s*value|investment)[\s\|]+(unit\s*balance|units|balance)[\s\|]+(nav|net\s*asset\s*value)[\s\|]+(market\s*value|current\s*value|valuation)/i,
    /(unit\s*balance|units|balance)[\s\|]+(cost\s*value|invested|investment)[\s\|]+(nav|net\s*asset\s*value)[\s\|]+(market\s*value|current\s*value|valuation)/i,
  ];
  
  // Column header keywords for position detection
  const columnKeywords = {
    cost: ['cost', 'invested', 'investment', 'purchase', 'amount invested', 'acquisition'],
    units: ['unit', 'balance', 'quantity', 'holding', 'units held'],
    nav: ['nav', 'net asset', 'rate', 'price per unit'],
    market: ['market', 'current', 'valuation', 'present value', 'value as on', 'closing value']
  };
  
  // Split text into lines and look for header row
  const lines = text.split('\n');
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Check if this line looks like a header (contains multiple column keywords)
    let keywordMatches = 0;
    if (columnKeywords.cost.some(k => lowerLine.includes(k))) keywordMatches++;
    if (columnKeywords.units.some(k => lowerLine.includes(k))) keywordMatches++;
    if (columnKeywords.nav.some(k => lowerLine.includes(k))) keywordMatches++;
    if (columnKeywords.market.some(k => lowerLine.includes(k))) keywordMatches++;
    
    // If we found at least 3 column keywords, this is likely a header row
    if (keywordMatches >= 3) {
      console.log('[Header Detection] Found potential header row:', line.substring(0, 100));
      
      // Find position of each column type
      const positions: { type: string; index: number }[] = [];
      
      for (const keyword of columnKeywords.cost) {
        const idx = lowerLine.indexOf(keyword);
        if (idx >= 0) { positions.push({ type: 'cost', index: idx }); break; }
      }
      for (const keyword of columnKeywords.units) {
        const idx = lowerLine.indexOf(keyword);
        if (idx >= 0) { positions.push({ type: 'units', index: idx }); break; }
      }
      for (const keyword of columnKeywords.nav) {
        const idx = lowerLine.indexOf(keyword);
        if (idx >= 0) { positions.push({ type: 'nav', index: idx }); break; }
      }
      for (const keyword of columnKeywords.market) {
        const idx = lowerLine.indexOf(keyword);
        if (idx >= 0) { positions.push({ type: 'market', index: idx }); break; }
      }
      
      // Sort by position to get column order
      positions.sort((a, b) => a.index - b.index);
      
      if (positions.length >= 3) {
        const mapping: ColumnMapping = {
          costIndex: positions.findIndex(p => p.type === 'cost'),
          unitsIndex: positions.findIndex(p => p.type === 'units'),
          navIndex: positions.findIndex(p => p.type === 'nav'),
          marketIndex: positions.findIndex(p => p.type === 'market'),
          headerDetected: true
        };
        
        // Handle missing columns
        if (mapping.costIndex < 0) mapping.costIndex = 0;
        if (mapping.unitsIndex < 0) mapping.unitsIndex = 1;
        if (mapping.navIndex < 0) mapping.navIndex = 2;
        if (mapping.marketIndex < 0) mapping.marketIndex = 3;
        
        console.log('[Header Detection] Detected column order:', 
          `Cost=${mapping.costIndex}, Units=${mapping.unitsIndex}, NAV=${mapping.navIndex}, Market=${mapping.marketIndex}`);
        
        return mapping;
      }
    }
  }
  
  // Try regex patterns on full text
  for (const pattern of headerPatterns) {
    const match = text.match(pattern);
    if (match) {
      console.log('[Header Detection] Matched pattern:', match[0].substring(0, 80));
      
      // Determine order based on capture groups
      const groups = match.slice(1).map(g => g.toLowerCase());
      const mapping: ColumnMapping = {
        costIndex: groups.findIndex(g => columnKeywords.cost.some(k => g.includes(k))),
        unitsIndex: groups.findIndex(g => columnKeywords.units.some(k => g.includes(k))),
        navIndex: groups.findIndex(g => columnKeywords.nav.some(k => g.includes(k))),
        marketIndex: groups.findIndex(g => columnKeywords.market.some(k => g.includes(k))),
        headerDetected: true
      };
      
      // Fallback for undetected columns
      if (mapping.costIndex < 0) mapping.costIndex = 0;
      if (mapping.unitsIndex < 0) mapping.unitsIndex = 1;
      if (mapping.navIndex < 0) mapping.navIndex = 2;
      if (mapping.marketIndex < 0) mapping.marketIndex = 3;
      
      console.log('[Header Detection] Column order from pattern:', 
        `Cost=${mapping.costIndex}, Units=${mapping.unitsIndex}, NAV=${mapping.navIndex}, Market=${mapping.marketIndex}`);
      
      return mapping;
    }
  }
  
  console.log('[Header Detection] No header detected, using default order');
  return defaultMapping;
}

/**
 * Extract transaction lots from CAS holding block text
 * Uses line-by-line parsing similar to cas-statement-service for robustness
 * Transaction line format: "DD-MMM-YYYY Transaction Type Amount Units NAV Running Balance"
 * Example: "18-Mar-2024 Purchase 499,975.00 31,610.576 15.8167 31,610.576"
 */
function extractTransactionLots(holdingBlockText: string): TransactionLot[] {
  const lots: TransactionLot[] = [];
  const lines = holdingBlockText.split('\n');
  
  // Transaction keywords (aligned with cas-statement-service)
  const transactionKeywords = [
    'Purchase', 'Redemption', 'Switch In', 'Switch Out', 'Switch-In', 'Switch-Out',
    'Systematic Investment', 'SIP', 'Initial Purchase', 'NFO Purchase',
    'Dividend', 'Dividend Reinvestment', 'Reinvestment', 'Bonus',
    'Additional Purchase', 'Transfer In', 'Transfer Out'
  ];
  const keywordPattern = new RegExp(`(${transactionKeywords.join('|')})`, 'i');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip non-transaction lines
    if (trimmedLine.includes('***') || trimmedLine.includes('Stamp Duty') || 
        trimmedLine.includes('NAV on') || trimmedLine.includes('Market Value on') ||
        trimmedLine.includes('Closing Unit') || trimmedLine.includes('Opening Unit')) {
      continue;
    }
    
    // Match date at start of line: DD-MMM-YYYY
    const dateMatch = trimmedLine.match(/^(\d{1,2}-[A-Za-z]{3}-\d{4})/);
    if (!dateMatch) continue;
    
    const dateStr = dateMatch[1];
    const restOfLine = trimmedLine.substring(dateMatch[0].length).trim();
    
    // Check if line contains a transaction keyword
    if (!keywordPattern.test(restOfLine)) continue;
    
    // Extract all numbers from the rest of the line
    const numberMatches = restOfLine.match(/[\d,]+\.?\d*/g) || [];
    const numbers = numberMatches
      .map(n => parseFloat(n.replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0);
    
    if (numbers.length < 2) continue; // Need at least amount and one more number
    
    // CAS transaction format can be:
    // 4 numbers: Amount, Units, NAV, RunningBalance (explicit units)
    // 3 numbers: Amount, NAV, RunningBalance (units = amount/nav)
    // We need to detect which format based on mathematical consistency
    let amount = 0, units = 0, nav = 0, balance = 0;
    
    // CAS transaction formats:
    // 4-num: Amount | Units | NAV | Balance  (Amount ≈ Units × NAV, NAV typically 5-500)
    // 3-num: Amount | NAV | Balance          (Balance ≈ Amount/NAV, NAV typically 5-500)
    
    if (numbers.length >= 3) {
      const n0 = numbers[0]; // Always Amount
      const n1 = numbers[1]; // Could be Units (4-num) or NAV (3-num)
      const n2 = numbers[2]; // Could be NAV (4-num) or Balance (3-num)
      const n3 = numbers.length >= 4 ? numbers[3] : n2;
      
      // Strategy: Try 3-number format first (Amount | NAV | Balance)
      // Key insight: In 3-num format, Balance ≈ Amount/NAV (i.e., Balance = Units accumulated)
      const nav3 = n1;
      const balance3 = n2;
      const units3 = nav3 > 0 ? n0 / nav3 : 0;
      const balanceMatchUnits3 = Math.abs(units3 - balance3) / Math.max(balance3, 1) < 0.01;
      const navInRange3 = nav3 > 1 && nav3 < 500;
      
      // Try 4-number format: Amount | Units | NAV | Balance
      // Key check: Amount ≈ Units × NAV
      const units4 = n1;
      const nav4 = n2;
      const balance4 = n3;
      const calculated4 = units4 * nav4;
      const amountMatch4 = Math.abs(calculated4 - n0) / Math.max(n0, 1) < 0.02;
      const navInRange4 = nav4 > 1 && nav4 < 500;
      
      // Prefer 3-number if: NAV in typical range AND calculated units match balance
      if (navInRange3 && balanceMatchUnits3) {
        amount = n0;
        nav = nav3;
        units = units3;
        balance = balance3;
      } 
      // Use 4-number if: Amount = Units × NAV AND NAV in range
      else if (amountMatch4 && navInRange4) {
        amount = n0;
        units = units4;
        nav = nav4;
        balance = balance4;
      }
      // Extended 4-number check: Allow higher NAV range (up to 5000 for some funds)
      else if (amountMatch4 && nav4 > 1 && nav4 < 5000) {
        amount = n0;
        units = units4;
        nav = nav4;
        balance = balance4;
      }
      // Fallback: Assume 3-number if NAV looks reasonable
      else if (nav3 > 1 && nav3 < 1000 && n0 > nav3) {
        amount = n0;
        nav = nav3;
        units = units3;
        balance = balance3;
      }
      // Final fallback: Use 4-number interpretation
      else {
        amount = n0;
        units = units4;
        nav = nav4;
        balance = balance4;
      }
    } else if (numbers.length === 2) {
      // 2-number format: Amount, NAV (units = amount/nav)
      amount = numbers[0];
      nav = numbers[1];
      units = nav > 0 ? amount / nav : 0;
      balance = units;
    }
    
    // Classify transaction type
    const lowerLine = restOfLine.toLowerCase();
    let transactionType: TransactionLot['transactionType'] = 'purchase';
    let isCredit = true;
    
    if (lowerLine.includes('sip') || lowerLine.includes('systematic')) {
      transactionType = 'sip';
    } else if (lowerLine.includes('switch') && (lowerLine.includes('in') || lowerLine.includes('-in'))) {
      transactionType = 'switch_in';
    } else if (lowerLine.includes('switch') && (lowerLine.includes('out') || lowerLine.includes('-out'))) {
      transactionType = 'switch_out';
      isCredit = false;
    } else if (lowerLine.includes('redemption')) {
      transactionType = 'redemption';
      isCredit = false;
    } else if (lowerLine.includes('bonus')) {
      transactionType = 'bonus';
    } else if (lowerLine.includes('dividend') || lowerLine.includes('reinvestment')) {
      transactionType = 'dividend_reinvest';
    }
    
    // Only add purchase-type transactions for lot tracking
    if (isCredit && units > 0) {
      lots.push({
        purchaseDate: dateStr,
        transactionType,
        amount,
        units,
        navAtPurchase: nav,
        runningBalance: balance,
        description: trimmedLine.substring(0, 100)
      });
    }
  }
  
  if (lots.length > 0) {
    console.log(`[Transaction Extractor] Found ${lots.length} transaction lots`);
    console.log('[Transaction Extractor] First:', lots[0].purchaseDate, lots[0].transactionType, '₹' + lots[0].amount);
  }
  
  return lots;
}

/**
 * Parse CAMS/KFintech Holding Statement format (tabular with columns)
 * Format: Folio No. | ISIN | Scheme Name | Cost Value | Unit Balance | NAV Date | NAV | Market Value | Registrar
 * This is a HOLDING statement (not transaction statement) - no transaction dates, just current holdings
 * 
 * Now with dynamic header detection to handle variable column orders.
 * 
 * Example row from PDF:
 * 404534/62     INF579M01AF8   IFIQRG - 360 ONE Quant Fund Regular Plan       500,000.000       31,610.576 22-Jan-2026     19.1761         606,167.57      CAMS
 * 
 * Key fields:
 * - ISIN: Fund identifier (INF...)
 * - Cost Value: Total invested amount
 * - Unit Balance: Number of units held
 * - NAV: Net Asset Value per unit
 * - Market Value: Current value (units × NAV)
 * - Registrar: CAMS or KFINTECH
 */
function parseCAMSHoldingStatementFormat(text: string): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  
  console.log('[CAMS Holding Parser] Starting parse...');
  
  // STEP 1: Detect column headers dynamically
  const columnMapping = detectColumnHeaders(text);
  console.log('[CAMS Holding Parser] Using column mapping:', columnMapping);
  
  // Find all ISINs in the text
  // INF = Mutual Funds, INE = Stocks/ETFs, IN0 = Debt instruments
  // Also check for 12-character ISINs that may be formatted differently
  const isinPattern = /IN[EF0][A-Z0-9]{9}/gi;
  const isinMatches = [...new Set(text.match(isinPattern) || [])];
  
  // Also look for ISINs with potential spaces or hyphens (sometimes OCR artifacts)
  const spacedIsinPattern = /IN[EF0]\s*[A-Z0-9]{2}\s*[A-Z0-9]{2}\s*[A-Z0-9]{2}\s*[A-Z0-9]{3}/gi;
  const spacedMatches = (text.match(spacedIsinPattern) || []).map(m => m.replace(/\s/g, ''));
  
  // Combine both patterns
  const allIsinMatches = [...new Set([...isinMatches, ...spacedMatches])];
  
  // Log what we're finding for debugging
  console.log('[CAMS Holding Parser] Found', allIsinMatches.length, 'unique ISINs');
  console.log('[CAMS Holding Parser] ISIN breakdown - INF (MF):', allIsinMatches.filter(i => i.startsWith('INF')).length, 
    'INE (Stock):', allIsinMatches.filter(i => i.startsWith('INE')).length,
    'IN0 (Debt):', allIsinMatches.filter(i => i.startsWith('IN0')).length);
  
  if (allIsinMatches.length === 0) {
    // Check for UNCLAIMDISIN or other special markers
    const hasUnclaimedFunds = text.includes('UNCLAIMDISIN') || text.includes('Unclaimed');
    if (hasUnclaimedFunds) {
      console.log('[CAMS Holding Parser] Found unclaimed funds - skipping those');
    }
    return holdings;
  }
  
  // For each ISIN, extract the holding data
  for (const isin of allIsinMatches) {
    try {
      // Find position of ISIN in text
      const isinIndex = text.indexOf(isin);
      if (isinIndex < 0) continue;
      
      // Get text around ISIN (before and after)
      // Use larger window (2000 chars) to capture NAV/Market Value which appear at end of holding block
      const beforeIsin = text.substring(Math.max(0, isinIndex - 100), isinIndex);
      const afterIsin = text.substring(isinIndex + isin.length, Math.min(text.length, isinIndex + isin.length + 2000));
      
      console.log('[CAMS Holding Parser] Processing ISIN:', isin);
      console.log('[CAMS Holding Parser] Before:', beforeIsin.slice(-50));
      console.log('[CAMS Holding Parser] After (first 100):', afterIsin.substring(0, 100));
      
      // Extract Folio number (before ISIN)
      // Pattern: digits with optional /digit suffix, e.g., "404534/62" or "7775083296/0"
      const folioMatch = beforeIsin.match(/(\d{5,}(?:\/\d+)?)\s*$/);
      const folioNumber = folioMatch ? folioMatch[1] : '';
      
      // Extract scheme name and numeric data from after ISIN
      // The format after ISIN is typically:
      // "   IFIQRG - 360 ONE Quant Fund Regular Plan       500,000.000       31,610.576 22-Jan-2026     19.1761         606,167.57      CAMS"
      
      // First, get scheme code and name
      const schemeMatch = afterIsin.match(/^\s*([A-Z0-9]+)\s*-\s*([^0-9]+?)(?=\d{1,3}(?:,\d{3})*\.)/i);
      let schemeName = '';
      if (schemeMatch) {
        schemeName = `${schemeMatch[1]} - ${schemeMatch[2]}`.trim();
        // Clean up scheme name - remove excess whitespace and trailing dashes
        schemeName = schemeName.replace(/\s+/g, ' ').replace(/\s*-\s*$/, '').trim();
      }
      
      // Extract all numbers from afterIsin (with or without decimals)
      // Pattern 1: Numbers with commas and decimals like "500,000.000" or "31,610.576" or "19.1761"
      // Pattern 2: Numbers with commas but no decimals like "1,68,52,343" (Indian format) or "168,523"
      // Pattern 3: Plain integers like "199990" or "1470"
      const decimalPattern = /(\d{1,3}(?:,\d{2,3})*\.\d{2,6})/g;
      const indianCommaPattern = /(\d{1,2}(?:,\d{2})*(?:,\d{3}))/g;
      const plainIntegerPattern = /\b(\d{4,})\b/g;
      
      const numbers: number[] = [];
      let match;
      
      // First extract decimal numbers (highest priority)
      while ((match = decimalPattern.exec(afterIsin)) !== null) {
        const num = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(num) && num > 0) {
          numbers.push(num);
        }
      }
      
      // Helper to check if a number should be excluded
      const shouldExcludeNumber = (num: number): boolean => {
        // Exclude years (2020-2030 range)
        if (num >= 2020 && num <= 2030) return true;
        // Exclude folio numbers (very large integers, typically 9+ digits)
        if (num >= 100000000) return true;
        // Exclude numbers that are too small to be meaningful (less than 0.01)
        if (num < 0.01) return true;
        return false;
      };
      
      // Then extract Indian comma format numbers (like 1,68,52,343)
      const afterWithoutDecimals = afterIsin.replace(decimalPattern, ' ');
      while ((match = indianCommaPattern.exec(afterWithoutDecimals)) !== null) {
        const num = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(num) && num > 1000 && !numbers.includes(num) && !shouldExcludeNumber(num)) {
          numbers.push(num);
        }
      }
      
      // Finally extract plain integers (4+ digits) not already captured
      const afterWithoutCommas = afterWithoutDecimals.replace(indianCommaPattern, ' ');
      while ((match = plainIntegerPattern.exec(afterWithoutCommas)) !== null) {
        const num = parseFloat(match[1]);
        if (!isNaN(num) && num > 100 && !numbers.includes(num) && !shouldExcludeNumber(num)) {
          numbers.push(num);
        }
      }
      
      console.log('[CAMS Holding Parser] Extracted numbers:', numbers.slice(0, 8));
      
      let costValue = 0;
      let unitBalance = 0;
      let nav = 0;
      let marketValue = 0;
      
      // PRIORITY 0: Look for explicit NAV, Market Value, and Closing Unit Balance patterns
      // These are the most accurate values in CAS statements
      // Pattern: "NAV on DD-Mon-YYYY: INR X.XX"
      // Pattern: "Market Value on DD-Mon-YYYY: INR X,XX,XXX.XX"
      // Pattern: "Closing Unit Balance: X,XXX.XXX"
      const navPattern = /NAV\s+on\s+[\d\w-]+:\s*(?:INR|Rs\.?|₹)?\s*([\d,]+\.?\d*)/i;
      const marketPattern = /Market\s+Value\s+on\s+[\d\w-]+:\s*(?:INR|Rs\.?|₹)?\s*([\d,]+\.?\d*)/i;
      const closingUnitsPattern = /Closing\s+Unit\s+Balance:\s*([\d,]+\.?\d*)/i;
      const openingUnitsPattern = /Opening\s+Unit\s+Balance:\s*([\d,]+\.?\d*)/i;
      
      const navMatch = afterIsin.match(navPattern);
      const marketMatch = afterIsin.match(marketPattern);
      const closingUnitsMatch = afterIsin.match(closingUnitsPattern);
      
      if (navMatch && marketMatch && closingUnitsMatch) {
        nav = parseFloat(navMatch[1].replace(/,/g, ''));
        marketValue = parseFloat(marketMatch[1].replace(/,/g, ''));
        unitBalance = parseFloat(closingUnitsMatch[1].replace(/,/g, ''));
        
        // Try to find cost from Purchase transactions or first large number
        // Look for purchase amount pattern
        const purchasePattern = /Purchase\s+([\d,]+\.?\d*)/gi;
        let totalPurchases = 0;
        let purchaseMatch;
        while ((purchaseMatch = purchasePattern.exec(afterIsin)) !== null) {
          const amount = parseFloat(purchaseMatch[1].replace(/,/g, ''));
          if (amount > 1000) {
            totalPurchases += amount;
          }
        }
        
        if (totalPurchases > 0) {
          costValue = totalPurchases;
        } else {
          // Fallback: use first large number as cost
          const largeCostNum = numbers.find(n => n > 10000);
          costValue = largeCostNum || marketValue;
        }
        
        console.log('[CAMS Holding Parser] PRIORITY 0 MATCH - Explicit patterns found:');
        console.log(`[CAMS Holding Parser]   Units: ${unitBalance}, NAV: ₹${nav}, Market: ₹${marketValue.toLocaleString()}, Cost: ₹${costValue.toLocaleString()}`);
      }
      
      // PRIORITY 1: Use header-detected column mapping if available (skip if PRIORITY 0 succeeded)
      if (unitBalance === 0 && marketValue === 0 && columnMapping.headerDetected && numbers.length >= 4) {
        // Map numbers using detected column order
        const maxIdx = Math.max(columnMapping.costIndex, columnMapping.unitsIndex, columnMapping.navIndex, columnMapping.marketIndex);
        
        if (maxIdx < numbers.length) {
          costValue = numbers[columnMapping.costIndex];
          unitBalance = numbers[columnMapping.unitsIndex];
          nav = numbers[columnMapping.navIndex];
          marketValue = numbers[columnMapping.marketIndex];
          
          // Validate: Units × NAV ≈ Market Value
          const calculated = unitBalance * nav;
          const tolerance = Math.abs(calculated - marketValue) / Math.max(marketValue, 1);
          
          if (tolerance < 0.05) {
            console.log('[CAMS Holding Parser] Header-based mapping validated! Units:', unitBalance, 'Cost:', costValue, 'NAV:', nav, 'Market:', marketValue);
          } else {
            console.log('[CAMS Holding Parser] Header-based mapping failed validation, falling back to combination search');
            // Reset and fall through to combination search
            costValue = 0;
            unitBalance = 0;
            nav = 0;
            marketValue = 0;
          }
        }
      }
      
      // PRIORITY 2: If header mapping didn't work, try all combinations
      if (unitBalance === 0 && marketValue === 0) {
        // Try all possible combinations to find the correct mapping
        // The key validation: Units × NAV ≈ Market Value (within 5% tolerance)
        // Then select the combination where Cost is most reasonable (closest to Market)
        
        interface MatchCandidate {
          units: number;
          cost: number;
          nav: number;
          market: number;
          score: number;
        }
        
        const candidates: MatchCandidate[] = [];
        const numLimit = Math.min(numbers.length, 8);
        
        // Try all possible 4-number combinations
        for (let uIdx = 0; uIdx < numLimit; uIdx++) {
          for (let cIdx = 0; cIdx < numLimit; cIdx++) {
            if (cIdx === uIdx) continue;
            for (let nIdx = 0; nIdx < numLimit; nIdx++) {
              if (nIdx === uIdx || nIdx === cIdx) continue;
              for (let mIdx = 0; mIdx < numLimit; mIdx++) {
              if (mIdx === uIdx || mIdx === cIdx || mIdx === nIdx) continue;
              
              const testUnits = numbers[uIdx];
              const testCost = numbers[cIdx];
              const testNav = numbers[nIdx];
              const testMarket = numbers[mIdx];
              
              // NAV sanity check (typical MF NAV range: 5 to 5000)
              if (testNav > 5000 || testNav < 5) continue;
              if (testUnits <= 0 || testMarket <= 0) continue;
              
              // Market value sanity check (should be at least ₹100)
              if (testMarket < 100) continue;
              
              // Units should typically be much smaller than market value for reasonable NAVs
              // If units > market, it's likely a wrong mapping
              if (testUnits > testMarket && testNav > 1) continue;
              
              // Cost should be in reasonable range (at least ₹100)
              if (testCost < 100) continue;
              
              // KEY: Units × NAV ≈ Market Value
              const calculated = testUnits * testNav;
              const marketTolerance = Math.abs(calculated - testMarket) / Math.max(testMarket, 1);
              
              if (marketTolerance < 0.05) {
                // Cost should be reasonable (not wildly different from market)
                // For mutual funds, cost is typically within 0.2x to 5x of market
                const costRatio = testCost / Math.max(testMarket, 1);
                const costReasonable = costRatio > 0.1 && costRatio < 10;
                
                // Additional check: if Cost equals Market exactly, it's suspicious
                // (parser might be using same number for both)
                const costEqualsMarket = Math.abs(testCost - testMarket) < 1;
                
                // Prefer: lower tolerance + cost closer to market + distinct values
                const costScore = Math.abs(Math.log(Math.max(costRatio, 0.1))) / 5;
                const score = marketTolerance 
                  + (costReasonable ? 0 : 2) 
                  + costScore * 0.1
                  + (costEqualsMarket ? 1 : 0);  // Penalize when cost=market
                
                candidates.push({
                  units: testUnits,
                  cost: testCost,
                  nav: testNav,
                  market: testMarket,
                  score
                });
              }
            }
          }
        }
      }
        
        // Sort by score and pick best
        candidates.sort((a, b) => a.score - b.score);
        
        if (candidates.length > 0) {
          const best = candidates[0];
          unitBalance = best.units;
          costValue = best.cost;
          nav = best.nav;
          marketValue = best.market;
          console.log('[CAMS Holding Parser] Best match found - Units:', unitBalance, 'Cost:', costValue, 'NAV:', nav, 'Market:', marketValue);
        } else if (numbers.length >= 4) {
          // Fallback: use first 4 numbers as Cost, Units, NAV, Market
          costValue = numbers[0];
          unitBalance = numbers[1];
          nav = numbers[2];
          marketValue = numbers[3];
          
          // If NAV × Units doesn't match Market, recalculate NAV
          const calculated = unitBalance * nav;
          if (Math.abs(calculated - marketValue) / marketValue > 0.1 && unitBalance > 0) {
            nav = marketValue / unitBalance;
          }
          console.log('[CAMS Holding Parser] Using fallback - Units:', unitBalance, 'Cost:', costValue, 'NAV:', nav, 'Market:', marketValue);
        } else if (numbers.length === 3) {
          costValue = numbers[0];
          unitBalance = numbers[1];
          marketValue = numbers[2];
          nav = unitBalance > 0 ? marketValue / unitBalance : 0;
        } else if (numbers.length === 2) {
          unitBalance = numbers[0];
          marketValue = numbers[1];
          nav = unitBalance > 0 ? marketValue / unitBalance : 0;
        }
      } // End of PRIORITY 2 combination search
      
      // Detect registrar (CAMS or KFINTECH)
      const registrarMatch = afterIsin.match(/(CAMS|KFINTECH)/i);
      const registrar = registrarMatch ? registrarMatch[1].toUpperCase() : 'CAMS';
      
      // Skip if we don't have meaningful data
      if (unitBalance === 0 && marketValue === 0) {
        console.log('[CAMS Holding Parser] Skipping ISIN - no valid data:', isin);
        continue;
      }
      
      // Final validation: If NAV seems unreasonably high (>10000), it might be wrong
      if (nav > 10000) {
        // NAV is probably wrong, recalculate
        nav = unitBalance > 0 ? marketValue / unitBalance : 0;
      }
      
      // Extract transaction lots from the holding block
      const lots = extractTransactionLots(afterIsin);
      
      // If we found transaction lots, calculate cost from sum of transactions
      let finalCostValue = costValue;
      if (lots.length > 0) {
        const lotsTotal = lots.reduce((sum, lot) => sum + lot.amount, 0);
        console.log(`[CAMS Holding Parser] Found ${lots.length} transaction lots with total cost: ₹${lotsTotal.toLocaleString()}`);
        // Use lots total if it's more accurate (within reasonable range of units)
        if (lotsTotal > 0 && Math.abs(lotsTotal - costValue) > 100) {
          console.log(`[CAMS Holding Parser] Using transaction-based cost: ₹${lotsTotal.toLocaleString()} instead of extracted cost: ₹${costValue.toLocaleString()}`);
          finalCostValue = lotsTotal;
        }
      }
      
      const holding: ImportedHolding = {
        id: `cas-holding-${Date.now()}-${holdings.length}`,
        name: schemeName || `Mutual Fund (ISIN: ${isin})`,
        isin: isin,
        assetType: 'mutual_fund',
        quantity: unitBalance,
        averageCost: unitBalance > 0 ? finalCostValue / unitBalance : 0,
        investedValue: finalCostValue,
        currentNav: nav,
        currentValue: marketValue,
        unrealizedGain: marketValue - finalCostValue,
        unrealizedGainPercent: finalCostValue > 0 ? ((marketValue - finalCostValue) / finalCostValue) * 100 : 0,
        folioNumber: folioNumber,
        broker: registrar === 'KFINTECH' ? 'KFintech' : 'CAMS',
        confidenceScore: 90,
        lots: lots.length > 0 ? lots : undefined
      };
      
      console.log('[CAMS Holding Parser] Added holding:', {
        isin,
        name: schemeName,
        folio: folioNumber,
        units: unitBalance,
        cost: costValue,
        nav,
        marketValue,
        registrar
      });
      
      holdings.push(holding);
    } catch (error: any) {
      console.error('[CAMS Holding Parser] Error processing ISIN', isin, ':', error.message);
    }
  }
  
  console.log('[CAMS Holding Parser] Total holdings extracted:', holdings.length);
  console.log('[CAMS Holding Parser] Total market value:', holdings.reduce((sum, h) => sum + h.currentValue, 0).toFixed(2));
  
  return holdings;
}

/**
 * Parse CAMS/KFintech tabular CAS format (legacy parser)
 * Format: Folio No. | ISIN | Scheme Name | Cost Value | Unit Balance | NAV Date | NAV | Market Value | Registrar
 * Example: 91085045342/0 INF846K01J79   128OGGPG - Axis Large & Mid Cap Fund -       80,000.000        2,908.240 03-Dec-2025       33.33          96,931.64 KFINTECH
 */
function parseCAMSKfintechTableFormat(text: string): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('[CAMS Table Parser] Starting parse, total lines:', lines.length);
  
  // Log first 30 lines for debugging
  console.log('[CAMS Table Parser] First 30 lines of extracted text:');
  lines.slice(0, 30).forEach((line, idx) => {
    console.log(`[CAMS Table Parser] Line ${idx}: "${line.substring(0, 120)}${line.length > 120 ? '...' : ''}"`);
  });
  
  // Check for ISIN patterns in the text
  const isinMatches = text.match(/INF[A-Z0-9]{9}/gi) || [];
  console.log('[CAMS Table Parser] Found ISINs in text:', isinMatches.length, isinMatches.slice(0, 5));
  
  // Handle PDF extraction format where columns get merged together
  // Pattern: "91085045342/0 96,931.64128OGGPG - Axis Large & Mid Cap Fund -"
  // The folio, market value, and scheme code are concatenated
  const mergedLinePattern = /^(\d{5,}(?:\/\d+)?)\s+([\d,]+\.?\d*)([\dA-Z]+)\s*-\s*(.+)$/i;
  
  // Also look for ISIN-based extraction from the full text
  // Pattern: Find each ISIN and extract surrounding data
  const uniqueISINs = [...new Set(isinMatches)];
  console.log('[CAMS Table Parser] Unique ISINs:', uniqueISINs.length);
  
  // Extract holdings from merged format lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip header, footer, and disclaimer lines
    if (line.includes('Folio No') || line.includes('Scheme Name') || line.includes('NAV Date') ||
        line.includes('Registrar') || line.includes('ISIN') || line.match(/^\s*\(INR\)\s*$/) ||
        line.includes('Entry Load') || line.includes('Exit Load') || line.includes('w.e.f') ||
        line.includes('Total') || line.includes('Loads and Fees') || line.includes('Page ') ||
        line.includes('CAMSCASWS') || line.includes('Version:') || line.includes('Email Id') ||
        line.includes('Consolidated Account') || line.includes('brought to you') ||
        line.includes('IDCW -') || line.match(/^#?\s*IDCW/i)) {
      continue;
    }
    
    // Match merged format: Folio MarketValueSchemeCode - SchemeName
    const mergedMatch = line.match(mergedLinePattern);
    if (mergedMatch) {
      const [, folio, marketValue, schemeCode, schemeNamePart] = mergedMatch;
      const cleanMarketValue = parseFloat(marketValue.replace(/,/g, ''));
      
      // Skip if this looks like an address or non-fund line
      if (schemeNamePart.match(/CHIN|DORNALA|PRAKASAM|Pradesh|India/i)) {
        continue;
      }
      
      // Get full scheme name (may continue on next line)
      let fullSchemeName = schemeNamePart.trim();
      
      // Check next line for continuation (scheme names often wrap)
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        // Continuation lines are typically just text without folios or special markers
        if (nextLine && !nextLine.match(/^\d{5,}/) && !nextLine.includes('Load') &&
            !nextLine.includes('Total') && !nextLine.includes('Page') &&
            nextLine.match(/^[A-Za-z]/)) {
          fullSchemeName += ' ' + nextLine;
          i++; // Skip the continuation line
        }
      }
      
      // Clean up the scheme name
      fullSchemeName = fullSchemeName
        .replace(/\s+/g, ' ')
        .replace(/\s*-\s*$/, '')
        .replace(/^\s*-\s*/, '')
        .trim();
      
      // Find the corresponding ISIN by matching scheme code patterns
      let matchedISIN = '';
      for (const isin of uniqueISINs) {
        // Check if this ISIN appears near the scheme code in the original text
        const isinIndex = text.indexOf(isin);
        const schemeCodeIndex = text.indexOf(schemeCode);
        if (isinIndex >= 0 && schemeCodeIndex >= 0 && Math.abs(isinIndex - schemeCodeIndex) < 200) {
          matchedISIN = isin;
          break;
        }
      }
      
      if (cleanMarketValue > 0 && fullSchemeName.length > 5) {
        holdings.push({
          id: `cas-table-${Date.now()}-${holdings.length}`,
          name: fullSchemeName,
          isin: matchedISIN,
          assetType: 'mutual_fund',
          quantity: 0, // Will need to extract from other patterns
          currentValue: cleanMarketValue,
          folioNumber: folio,
          broker: 'CAMS/KFintech',
          confidenceScore: 85
        });
        
        console.log('[CAMS Table Parser] Found holding (merged):', fullSchemeName, 'Value:', cleanMarketValue);
      }
    }
  }
  
  // If we still have no holdings, try to extract from the full text using ISIN-based approach
  // Only process ISINs starting with "INF" (mutual funds)
  const mfISINs = uniqueISINs.filter(isin => isin.startsWith('INF'));
  
  if (holdings.length === 0 && mfISINs.length > 0) {
    console.log('[CAMS Table Parser] Trying ISIN-based extraction for', mfISINs.length, 'mutual fund ISINs...');
    
    // CAMS PDF format after text extraction (from logs):
    // BEFORE ISIN: "...SchemeName\nUnits Date NAV Registrar\n"
    // Example: "Growth\n2,908.240 03-Dec-2025 33.33 KFINTECH\n"
    // AFTER ISIN: " Cost\nFolio MarketValueSchemeCode - NextSchemeName..."
    // Example: " 80,000.000\n91085045342/0 91,703.02128AFGPG - Axis..."
    
    for (const isin of mfISINs) {
      const isinIndex = text.indexOf(isin);
      if (isinIndex >= 0) {
        // Look for data BEFORE the ISIN - contains Units, Date, NAV, Registrar
        const beforeIsin = text.substring(Math.max(0, isinIndex - 300), isinIndex);
        // Look for data AFTER the ISIN - contains Cost, Folio, MarketValue, NextScheme
        const afterIsin = text.substring(isinIndex + isin.length, Math.min(text.length, isinIndex + isin.length + 400));
        
        console.log('[CAMS Table Parser] ISIN:', isin);
        console.log('[CAMS Table Parser] Before ISIN (last 100):', beforeIsin.slice(-100));
        console.log('[CAMS Table Parser] After ISIN (first 100):', afterIsin.substring(0, 100));
        
        // Extract Units from BEFORE ISIN
        // Pattern: "Growth\n2,908.240 03-Dec-2025 33.33 KFINTECH\n"
        // Units is typically the first decimal number before the date (DD-Mon-YYYY)
        const unitsMatch = beforeIsin.match(/(\d{1,3}(?:,\d{3})*\.\d{2,4})\s+\d{1,2}-[A-Za-z]{3}-\d{4}/);
        let units = 0;
        if (unitsMatch) {
          units = parseFloat(unitsMatch[1].replace(/,/g, ''));
          console.log('[CAMS Table Parser] Extracted units:', units);
        }
        
        // Extract Statement NAV Date from before ISIN
        const navDateMatch = beforeIsin.match(/(\d{1,2}-[A-Za-z]{3}-\d{4})/);
        const statementNavDate = navDateMatch ? navDateMatch[1] : '';
        
        // Extract Cost (invested value) from AFTER ISIN - first decimal number
        const costMatch = afterIsin.match(/^\s*([\d,]+\.\d{2,3})/);
        let investedValue = 0;
        if (costMatch) {
          investedValue = parseFloat(costMatch[1].replace(/,/g, ''));
          console.log('[CAMS Table Parser] Extracted cost/invested:', investedValue);
        }
        
        // Extract Folio from AFTER ISIN
        const folioMatch = afterIsin.match(/(\d{5,}(?:\/\d+)?)/);
        const folio = folioMatch ? folioMatch[1] : '';
        
        // Extract Statement Market Value from AFTER ISIN (after folio)
        let statementMarketValue = 0;
        if (folioMatch) {
          const afterFolio = afterIsin.substring(afterIsin.indexOf(folioMatch[0]) + folioMatch[0].length);
          const mvMatch = afterFolio.match(/^\s*([\d,]+\.\d{2})/);
          if (mvMatch) {
            statementMarketValue = parseFloat(mvMatch[1].replace(/,/g, ''));
            console.log('[CAMS Table Parser] Extracted statement market value:', statementMarketValue);
          }
        }
        
        // Skip if we couldn't extract essential data
        if (units === 0 && investedValue === 0 && statementMarketValue === 0) {
          console.log('[CAMS Table Parser] Skipping ISIN - no valid data extracted:', isin);
          continue;
        }
        
        // Use units if we got it, otherwise estimate from market value / typical NAV
        const quantity = units > 0 ? units : 0;
        
        // For now, use statement market value - will be recalculated with current NAV later
        const currentValue = statementMarketValue > 0 ? statementMarketValue : investedValue;
        
        if (currentValue > 100) {
          holdings.push({
            id: `cas-isin-${Date.now()}-${holdings.length}`,
            name: `ISIN: ${isin}`, // Will be enriched from database
            isin: isin,
            assetType: 'mutual_fund',
            quantity: quantity,
            averageCost: quantity > 0 && investedValue > 0 ? investedValue / quantity : 0,
            investedValue: investedValue,
            currentValue: currentValue,
            folioNumber: folio,
            broker: 'CAMS/KFintech',
            confidenceScore: 85
          });
          
          console.log('[CAMS Table Parser] Found holding:', isin, 'Units:', quantity, 'Cost:', investedValue, 'Value:', currentValue);
        }
      }
    }
  }
  
  console.log('[CAMS Table Parser] Total holdings found:', holdings.length);
  console.log('[CAMS Table Parser] Total value:', holdings.reduce((sum, h) => sum + h.currentValue, 0));
  
  return holdings;
}

async function enrichWithISINIntelligence(holdings: ImportedHolding[]): Promise<ImportedHolding[]> {
  const holdingsWithISIN = holdings.filter(h => h.isin && h.isin.length === 12);
  
  if (holdingsWithISIN.length === 0) {
    console.log('[ISIN Intelligence] No ISINs found for classification');
    return holdings;
  }
  
  console.log(`[ISIN Intelligence] Classifying ${holdingsWithISIN.length} instruments by ISIN prefix`);
  
  const classificationMap = new Map<string, {
    assetType: 'equity' | 'mutual_fund' | 'etf' | 'bond' | 'gold' | 'fd' | 'other';
    regulator: string;
    instrumentType: string;
    isEdgeCase: boolean;
  }>();
  
  for (const holding of holdingsWithISIN) {
    try {
      // Build metadata from holding information for better classification
      const metadata = {
        schemeName: holding.name,
        amcName: holding.broker,
        // Detect ETF indicators from name
        isETF: holding.name?.toUpperCase().includes('ETF') || 
               holding.name?.toUpperCase().includes('BEES') ||
               holding.name?.toUpperCase().includes('EXCHANGE TRADED')
      };
      
      const detection = await isinIntelligenceService.detectInstrument(holding.isin!, metadata);
      
      // Map ISIN Intelligence asset class to ImportedHolding asset type
      let assetType: 'equity' | 'mutual_fund' | 'etf' | 'bond' | 'gold' | 'fd' | 'other' = 'other';
      
      switch (detection.assetClass) {
        case 'Equity':
          assetType = 'equity';
          break;
        case 'Mutual Fund':
          assetType = detection.instrumentType === 'ETF' ? 'etf' : 'mutual_fund';
          break;
        case 'Fixed Income':
        case 'Debt':
          assetType = 'bond';
          break;
        case 'Commodities':
          if (detection.subAssetClass?.includes('Gold')) {
            assetType = 'gold';
          } else {
            assetType = 'other';
          }
          break;
        case 'Alternatives':
          assetType = detection.instrumentType === 'REIT' || detection.instrumentType === 'InvIT' 
            ? 'equity'  // REITs/InvITs traded like equities
            : 'other';
          break;
        default:
          assetType = 'other';
      }
      
      classificationMap.set(holding.isin!, {
        assetType,
        regulator: detection.primaryRegulator || 'Unknown',
        instrumentType: detection.instrumentType,
        isEdgeCase: detection.isEdgeCase
      });
      
      if (detection.isEdgeCase) {
        console.log(`[ISIN Intelligence] Edge case detected: ${holding.isin} → ${detection.instrumentType} (${detection.edgeCaseType})`);
      }
    } catch (error: any) {
      console.warn(`[ISIN Intelligence] Failed to classify ${holding.isin}: ${error.message}`);
    }
  }
  
  console.log(`[ISIN Intelligence] Classified ${classificationMap.size} instruments`);
  
  // Apply classifications to holdings
  return holdings.map(holding => {
    if (holding.isin && classificationMap.has(holding.isin)) {
      const classification = classificationMap.get(holding.isin)!;
      
      // Update asset type and persist additional classification info
      return {
        ...holding,
        assetType: classification.assetType !== 'other' ? classification.assetType : holding.assetType,
        instrumentType: classification.instrumentType,
        regulator: classification.regulator,
        isEdgeCase: classification.isEdgeCase
      };
    }
    return holding;
  });
}

export async function enrichHoldingsWithDatabaseLookup(holdings: ImportedHolding[]): Promise<ImportedHolding[]> {
  // Step 1: Extract embedded ISINs from fund names and normalize
  holdings = holdings.map(h => {
    const result = holdingNormalizationService.normalizeAndExtract(h.name);
    return {
      ...h,
      name: result.normalizedName,
      isin: h.isin || result.isin,
      folioNumber: h.folioNumber || result.folio
    };
  });
  
  // Step 2: Enrich all holdings with ISIN Intelligence classification
  holdings = await enrichWithISINIntelligence(holdings);
  
  const isins = holdings
    .filter(h => h.isin && h.isin.length === 12 && h.isin.startsWith('INF'))
    .map(h => h.isin!);
  
  if (isins.length === 0) {
    console.log('[CAS Parser] No mutual fund ISINs to lookup for enrichment');
    return holdings;
  }
  
  console.log(`[CAS Parser] Looking up ${isins.length} ISINs in database for fund name and NAV enrichment`);
  
  const fundLookup = await liveMFDataService.getFundsByIsinBatch(isins);
  console.log(`[CAS Parser] Found ${fundLookup.size} funds in database`);
  
  return holdings.map(holding => {
    if (holding.isin && fundLookup.has(holding.isin)) {
      const dbFund = fundLookup.get(holding.isin)!;
      const currentNav = dbFund.nav || 0;
      
      // CRITICAL: Preserve original CAS market value if it exists and is reasonable
      // Only recalculate if original value is missing/zero or if the CAS value seems like invested value
      // (detected when CAS value equals investedValue, meaning market value wasn't parsed separately)
      let finalCurrentValue = holding.currentValue;
      let shouldUseDbNav = false;
      
      // Check if we should use database NAV to recalculate:
      // 1. If currentValue is 0 or missing
      // 2. If currentValue equals investedValue (market wasn't parsed separately)
      // 3. If currentValue seems unreasonable (e.g., matches avg cost × units pattern)
      const originalMarketValue = holding.currentValue || 0;
      const investedValue = holding.investedValue || 0;
      
      if (originalMarketValue === 0) {
        shouldUseDbNav = true;
        console.log(`[CAS Parser] No market value found, will calculate from DB NAV`);
      } else if (originalMarketValue === investedValue && investedValue > 0) {
        // Market value wasn't parsed separately - it was set to invested value as fallback
        shouldUseDbNav = true;
        console.log(`[CAS Parser] Market value equals invested value (fallback), will recalculate`);
      }
      
      if (shouldUseDbNav && holding.quantity > 0 && currentNav > 0) {
        finalCurrentValue = holding.quantity * currentNav;
        console.log(`[CAS Parser] Calculated current value: ${holding.quantity} units × ₹${currentNav} NAV = ₹${finalCurrentValue.toFixed(2)}`);
      } else if (originalMarketValue > 0) {
        // PRESERVE the original CAS market value - it's more accurate
        finalCurrentValue = originalMarketValue;
        console.log(`[CAS Parser] PRESERVING original CAS market value: ₹${originalMarketValue.toFixed(2)} (DB NAV would give ₹${(holding.quantity * currentNav).toFixed(2)})`);
      }
      
      // Calculate unrealized gain if we have invested value
      let unrealizedGain = 0;
      let unrealizedGainPercent = 0;
      if (investedValue > 0) {
        unrealizedGain = finalCurrentValue - investedValue;
        unrealizedGainPercent = (unrealizedGain / investedValue) * 100;
      }
      
      console.log(`[CAS Parser] Enriched: ${dbFund.schemeName} | Folio: ${holding.folioNumber} | Units: ${holding.quantity} | NAV: ₹${currentNav} | Value: ₹${finalCurrentValue.toFixed(2)}`);
      
      return {
        ...holding,
        name: dbFund.schemeName,
        currentNav: currentNav,
        currentValue: finalCurrentValue,
        unrealizedGain: unrealizedGain,
        unrealizedGainPercent: unrealizedGainPercent,
        broker: holding.broker || dbFund.fundHouse,
        confidenceScore: 90 // Higher confidence when enriched from database
      };
    }
    
    // If not found in database, keep original but mark lower confidence
    console.log(`[CAS Parser] Fund not found in database: ${holding.isin}`);
    return {
      ...holding,
      confidenceScore: 60
    };
  });
}

function parseWealthyPDFFormat(text: string): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  
  let currentFund: any = null;
  let fundIndex = 0;
  
  // State machine for value collection
  let expectingInvestedValue = false;
  let expectingCurrentValue = false;
  let expectingReturns = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = lines[i + 1] || '';
    
    // Skip navigation, headers, and page markers
    if (line.includes('Sync Info') || line === 'More' || 
        line.includes('https://') || line.includes('Portfolio Overview') ||
        line.match(/^MUTUAL FUNDS \(\d+\)/) || line.includes('Holding Analysis') ||
        line.match(/^\d+\/\d+\/\d+/) || line.length < 3 ||
        line.match(/^-- \d+ of \d+ --$/) || line === 'Hello' ||
        line.includes('Wealth Manager') || line.includes('Here is an analysis') ||
        line.includes('fund portfolio') || line.includes('manager will walk')) {
      continue;
    }
    
    // Skip standalone category lines - they contain "| Growth |" or "| Dividend |" etc.
    // These are NOT fund names even if they contain "Fund" in the subcategory
    if (line.match(/^(Equity|Debt|Hybrid)\s*\|/i)) {
      // Set category for current fund if available
      if (currentFund) {
        if (line.includes('Equity')) currentFund.category = 'equity';
        else if (line.includes('Debt')) currentFund.category = 'debt';
        else if (line.includes('Hybrid')) currentFund.category = 'hybrid';
      }
      continue;
    }
    
    // Detect "Invested" label - next line will have the value
    if (line === 'Invested') {
      expectingInvestedValue = true;
      continue;
    }
    
    // Detect "Current" label - next line will have the value
    if (line === 'Current') {
      expectingCurrentValue = true;
      continue;
    }
    
    // Detect "Returns" label - next line will have the percentage
    if (line === 'Returns') {
      expectingReturns = true;
      continue;
    }
    
    // Capture invested value
    if (expectingInvestedValue && currentFund) {
      const valueMatch = line.match(/₹\s*([\d,]+)/);
      if (valueMatch) {
        currentFund.investedValue = parseFloat(valueMatch[1].replace(/,/g, ''));
        console.log(`[Wealthy Parser] Invested value for ${currentFund.name}: ₹${currentFund.investedValue}`);
      }
      expectingInvestedValue = false;
      continue;
    }
    
    // Capture current value
    if (expectingCurrentValue && currentFund) {
      const valueMatch = line.match(/₹\s*([\d,]+)/);
      if (valueMatch) {
        currentFund.currentValue = parseFloat(valueMatch[1].replace(/,/g, ''));
        console.log(`[Wealthy Parser] Current value for ${currentFund.name}: ₹${currentFund.currentValue}`);
      }
      expectingCurrentValue = false;
      continue;
    }
    
    // Capture returns percentage
    if (expectingReturns && currentFund) {
      const percentMatch = line.match(/([\-\d\.]+)\s*%/);
      if (percentMatch) {
        currentFund.unrealizedGainPercent = parseFloat(percentMatch[1]);
        currentFund.unrealizedGain = currentFund.currentValue - currentFund.investedValue;
        console.log(`[Wealthy Parser] Returns for ${currentFund.name}: ${currentFund.unrealizedGainPercent}%`);
      }
      expectingReturns = false;
      continue;
    }
    
    // Detect fund name - must meet these criteria:
    // 1. Contains "Fund" keyword OR other MF patterns (Asset Allocation, FOF, etc.)
    // 2. Does NOT start with category prefix (Equity|Debt|Hybrid)
    // 3. Does NOT contain rupee symbol
    // 4. Is not just a plan type like "(G)" alone
    // 5. Is not a false positive like "Mutual Fund Report"
    // 6. Also detect AMC names where "Fund" appears on next line (e.g., "Nippon India" + "Services Fund (G)")
    const hasFundKeyword = line.includes('Fund') || 
                           line.includes('Asset Allocation') || 
                           line.includes('(FOF)') ||
                           line.includes('Savings');
    
    // Check if this line is an AMC prefix with "Fund" on the next line
    // Common patterns: "Nippon India" + "Services Fund (G)", "HDFC" + "Manufacturing Fund"
    const amcPrefixes = ['Nippon India', 'HDFC', 'ICICI Pru', 'SBI', 'Axis', 'Kotak', 'Aditya Birla', 
                         'UTI', 'Tata', 'Franklin', 'DSP', 'Mirae', 'Motilal', 'Invesco', 'Bandhan',
                         'Sundaram', 'Canara', 'PGIM', 'Edelweiss', 'L&T', 'Mahindra', 'Quant', 'JM'];
    const matchingPrefix = amcPrefixes.find(prefix => line.startsWith(prefix));
    const isAmcPrefix = matchingPrefix &&
                        nextLine && nextLine.includes('Fund') && 
                        (nextLine.includes('(G)') || nextLine.includes('(IDCW)'));
    
    const isFundName = (
      (hasFundKeyword || isAmcPrefix) &&
      !line.match(/^(Equity|Debt|Hybrid)\s*\|/i) &&
      !line.includes('₹') &&
      !line.match(/^(Invested|Current|Returns|NAV)/i) &&
      !line.match(/^Mutual Fund Report$/i) && // Skip false positive
      !line.includes('fund portfolio') &&
      (line.length > 15 || isAmcPrefix) // AMC prefix lines can be shorter
    );
    
    if (isFundName) {
      // Save previous fund if valid (has both name and currentValue)
      if (currentFund && currentFund.name && currentFund.currentValue > 0) {
        holdings.push(currentFund);
        console.log(`[Wealthy Parser] ✓ Added fund: ${currentFund.name} = ₹${currentFund.currentValue}`);
      }
      
      // Check if fund name is split across 2 lines
      // Pattern: "ICICI Pru Dynamic Asset Allocation" on line 1, "Active FOF-Reg (G)" on line 2
      // Pattern: "Invesco India Technology Fund -" on line 1, "Direct (G)" on line 2
      // Pattern: "HDFC Retirement Savings Fund-" on line 1, "Hybrid Equity (G)" on line 2
      // Pattern: "Nippon India" on line 1, "Services Fund (G)" on line 2
      let fullName = line;
      const needsContinuation = (
        // Ends with hyphen = definitely continues
        line.endsWith('-') ||
        // Is an AMC prefix pattern
        isAmcPrefix ||
        // Doesn't have a plan type suffix = needs continuation
        (!line.includes('(G)') && 
         !line.includes('(IDCW)') && 
         !line.match(/\(Growth\)|\(Dividend\)/i))
      );
      
      // Check if next line looks like a continuation
      const nextLineIsContinuation = (
        nextLine && 
        !nextLine.match(/^(Equity|Debt|Hybrid)\s*\|/i) &&
        !nextLine.includes('₹') &&
        !nextLine.includes('Invested') &&
        nextLine.length < 50 && // Continuation lines are usually short (increased for patterns like "Services Fund (G)")
        (nextLine.includes('(G)') || 
         nextLine.includes('(IDCW)') || 
         nextLine.includes('(FOF)') ||
         nextLine.includes('Fund') || // For AMC prefix patterns
         nextLine.match(/^(Direct|Regular|Active|Growth|Dividend|Hybrid|Services)/i))
      );
      
      if (needsContinuation && nextLineIsContinuation) {
        fullName = line + ' ' + nextLine;
        i++; // Skip the next line since we've consumed it
      }
      
      // Clean up the fund name
      fullName = fullName.replace(/\s+/g, ' ').trim();
      
      currentFund = {
        id: `wealthy-pdf-${Date.now()}-${fundIndex++}`,
        name: fullName,
        assetType: 'mutual_fund' as const,
        quantity: 1,
        currentValue: 0,
        investedValue: 0,
        broker: 'Wealthy.in',
        confidenceScore: 85
      };
      console.log(`[Wealthy Parser] Found fund #${fundIndex}: ${currentFund.name}`);
      continue;
    }
  }
  
  // Don't forget the last fund
  if (currentFund && currentFund.name && currentFund.currentValue > 0) {
    holdings.push(currentFund);
    console.log(`[Wealthy Parser] ✓ Added last fund: ${currentFund.name} = ₹${currentFund.currentValue}`);
  }
  
  console.log(`[Wealthy Parser] Total holdings found: ${holdings.length}`);
  return holdings;
}

function parseGenericFormat(text: string): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  const lines = text.split('\n');
  
  const valuePattern = /([A-Za-z][A-Za-z0-9\s\-&\.]{3,40})\s+(\d+(?:,\d+)*(?:\.\d+)?)\s+(?:units?|shares?|qty)?\s*₹?\s*(\d+(?:,\d+)*(?:\.\d+)?)/i;
  
  for (const line of lines) {
    const match = line.match(valuePattern);
    if (match) {
      const [, name, qty, value] = match;
      const quantity = parseFloat(qty.replace(/,/g, ''));
      const currentValue = parseFloat(value.replace(/,/g, ''));
      
      if (quantity > 0 && currentValue > 100) {
        const isMutualFund = /fund|scheme|growth|idcw|plan/i.test(name);
        holdings.push({
          id: `holding-${Date.now()}-${holdings.length}`,
          name: name.trim(),
          assetType: isMutualFund ? 'mutual_fund' : 'equity',
          quantity,
          currentValue,
          confidenceScore: 50
        });
      }
    }
  }
  
  return holdings;
}

function calculateAllocation(holdings: ImportedHolding[]): ImportedAllocation {
  let equity = 0, debt = 0, gold = 0, others = 0;
  const total = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  
  if (total === 0) return { equity: 0, debt: 0, gold: 0, cash: 0, others: 0 };
  
  for (const holding of holdings) {
    const value = holding.currentValue;
    const name = holding.name.toLowerCase();
    
    if (holding.assetType === 'gold' || /gold|sovereign/i.test(name)) {
      gold += value;
    } else if (holding.assetType === 'bond' || /debt|bond|gilt|fixed|liquid|overnight/i.test(name)) {
      debt += value;
    } else if (holding.assetType === 'equity' || holding.assetType === 'mutual_fund' || /equity|growth|index|flexi|multi.*cap/i.test(name)) {
      equity += value;
    } else {
      others += value;
    }
  }
  
  return {
    equity: Math.round((equity / total) * 100),
    debt: Math.round((debt / total) * 100),
    gold: Math.round((gold / total) * 100),
    cash: 0,
    others: Math.round((others / total) * 100)
  };
}

export async function parsePDFPortfolio(buffer: Buffer, fileName: string): Promise<ParseResult> {
  const fileHash = computeFileHash(buffer);
  
  const cached = getCachedResult(fileHash);
  if (cached) {
    return cached;
  }
  
  try {
    // Use centralized PDF parser service
    const parseResult = await unifiedPDFParser.extractTextSafe(buffer);
    if (!parseResult.success || !parseResult.result) {
      return {
        success: false,
        holdings: [],
        brokerDetected: null,
        confidenceScore: 0,
        errors: [parseResult.error || 'Failed to parse PDF file']
      };
    }
    const text = parseResult.result.text;
    
    const { broker, confidence } = detectBroker(text);
    let holdings: ImportedHolding[] = [];
    
    // Extract expected fund count from PDF header (e.g., "MUTUAL FUNDS (25)")
    const expectedCountMatch = text.match(/MUTUAL FUNDS\s*\((\d+)\)/i);
    const expectedCount = expectedCountMatch ? parseInt(expectedCountMatch[1], 10) : undefined;
    
    // Extract PORTFOLIO SUMMARY section (AMC-wise totals)
    // Format: "AMC Name   Cost   MarketValue" followed by "Total  X  Y"
    interface AMCSummary {
      amcName: string;
      costValue: number;
      marketValue: number;
    }
    const amcSummaries: AMCSummary[] = [];
    let expectedTotalValue: number | undefined;
    let expectedTotalCost: number | undefined;
    
    // Look for PORTFOLIO SUMMARY section
    const portfolioSummaryMatch = text.match(/PORTFOLIO\s+SUMMARY[\s\S]*?Total\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/i);
    if (portfolioSummaryMatch) {
      expectedTotalCost = parseFloat(portfolioSummaryMatch[1].replace(/,/g, ''));
      expectedTotalValue = parseFloat(portfolioSummaryMatch[2].replace(/,/g, ''));
      console.log('[PDF Parser] PORTFOLIO SUMMARY found:');
      console.log(`[PDF Parser]   Total Cost: ₹${expectedTotalCost.toLocaleString('en-IN')}`);
      console.log(`[PDF Parser]   Total Market: ₹${expectedTotalValue.toLocaleString('en-IN')}`);
      
      // Extract individual AMC lines
      // Pattern: "AMC Name  cost_value  market_value" (AMC names often have "Mutual Fund" suffix)
      const amcPattern = /([A-Za-z\s]+(?:Mutual\s+Fund|MF))\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)/gi;
      let amcMatch;
      while ((amcMatch = amcPattern.exec(text)) !== null) {
        const amcName = amcMatch[1].trim();
        const cost = parseFloat(amcMatch[2].replace(/,/g, ''));
        const market = parseFloat(amcMatch[3].replace(/,/g, ''));
        
        // Only add if values are reasonable (> 1000)
        if (cost > 1000 && market > 1000 && !amcName.toLowerCase().includes('total')) {
          amcSummaries.push({ amcName, costValue: cost, marketValue: market });
          console.log(`[PDF Parser]   ${amcName}: Cost ₹${cost.toLocaleString('en-IN')}, Market ₹${market.toLocaleString('en-IN')}`);
        }
      }
    }
    
    // Fallback: Try other patterns for total value
    if (!expectedTotalValue) {
      const totalValuePatterns = [
        /Total\s*Value\s*[:\s]*(?:Rs\.?|₹|INR)?\s*([\d,]+(?:\.\d{2})?)/i,
        /Market\s*Value\s*[:\s]*(?:Rs\.?|₹|INR)?\s*([\d,]+(?:\.\d{2})?)/i,
        /Grand\s*Total\s*[:\s]*(?:Rs\.?|₹|INR)?\s*([\d,]+(?:\.\d{2})?)/i,
      ];
      
      for (const pattern of totalValuePatterns) {
        const match = text.match(pattern);
        if (match) {
          expectedTotalValue = parseFloat(match[1].replace(/,/g, ''));
          console.log('[PDF Parser] Expected total value from PDF:', expectedTotalValue.toLocaleString('en-IN'));
          break;
        }
      }
    }
    
    if (expectedCount) {
      console.log('[PDF Parser] Expected fund count from PDF header:', expectedCount);
    }
    
    if (broker === 'CAMS/KFintech CAS') {
      // Try the new ISIN-based holding statement parser first (most accurate)
      holdings = parseCAMSHoldingStatementFormat(text);
      console.log('[PDF Parser] CAMS Holding Statement parser found:', holdings.length, 'holdings');
      
      // Fall back to table format if holding statement parser fails
      if (holdings.length === 0) {
        holdings = parseCAMSKfintechTableFormat(text);
        console.log('[PDF Parser] CAMS Table parser found:', holdings.length, 'holdings');
      }
      
      // Fall back to MFCentral format if table parsing also fails
      if (holdings.length === 0) {
        holdings = parseCASFormat(text);
        console.log('[PDF Parser] CAS format parser found:', holdings.length, 'holdings');
      }
    } else if (broker === 'Wealthy.in') {
      holdings = parseWealthyPDFFormat(text);
    } else if (broker === 'Zerodha') {
      holdings = parseZerodhaFormat(text);
    } else if (broker === 'Groww') {
      holdings = parseGrowwFormat(text);
    } else if (broker === 'MF Central') {
      holdings = parseMFCentralFormat(text);
    }
    
    // If no holdings found with specific parser, try CAMS holding statement parser first (most accurate for CAS PDFs)
    if (holdings.length === 0) {
      holdings = parseCAMSHoldingStatementFormat(text);
      if (holdings.length > 0) {
        console.log('[PDF Parser] Fallback: CAMS Holding Statement parser found:', holdings.length, 'holdings');
      }
    }
    
    // If still no holdings, try CAMS table format (older format)
    if (holdings.length === 0) {
      holdings = parseCAMSKfintechTableFormat(text);
    }
    
    // If still no holdings, try CAS format (MFCentral style)
    if (holdings.length === 0) {
      holdings = parseCASFormat(text);
    }
    
    // If still no holdings, try Wealthy format (common PDF format)
    if (holdings.length === 0) {
      holdings = parseWealthyPDFFormat(text);
    }
    
    // If still no holdings, try generic format
    if (holdings.length === 0) {
      holdings = parseGenericFormat(text);
    }
    
    const importedCount = holdings.length;
    const unimportedCount = expectedCount ? Math.max(0, expectedCount - importedCount) : 0;
    const needsManualReview = unimportedCount > 0;
    
    // Calculate parsed total value
    let parsedTotalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
    let parsedTotalCost = holdings.reduce((sum, h) => sum + (h.investedValue || 0), 0);
    console.log('[PDF Parser] Parsed total value:', parsedTotalValue.toLocaleString('en-IN'));
    console.log('[PDF Parser] Parsed total cost:', parsedTotalCost.toLocaleString('en-IN'));
    
    // Build error messages
    const errors: string[] = [];
    if (holdings.length === 0) {
      errors.push('Could not extract holdings from PDF. Please verify the format.');
    }
    
    // CRITICAL: If we have portfolio summary and parsed values are significantly off,
    // use AMC-wise summaries to correct the values
    if (expectedTotalValue && amcSummaries.length > 0 && parsedTotalValue > 0) {
      const valueDiffPercent = Math.abs(parsedTotalValue - expectedTotalValue) / expectedTotalValue * 100;
      
      if (valueDiffPercent > 20) {
        console.log('[PDF Parser] Significant value mismatch detected. Attempting AMC-based correction...');
        
        // Create AMC lookup map (normalize names for matching)
        const amcLookup = new Map<string, AMCSummary>();
        for (const amc of amcSummaries) {
          // Create various forms of the name for matching
          const normalizedName = amc.amcName.toLowerCase().replace(/\s+/g, ' ').trim();
          amcLookup.set(normalizedName, amc);
          
          // Also store without "Mutual Fund" suffix
          const shortName = normalizedName.replace(/\s*mutual\s*fund\s*$/i, '').trim();
          amcLookup.set(shortName, amc);
        }
        
        // Group holdings by fund house and calculate totals
        const holdingsByAMC = new Map<string, typeof holdings>();
        for (const holding of holdings) {
          // Try to identify AMC from fund name or broker
          const fundName = (holding.name || '').toLowerCase();
          let matchedAMC: AMCSummary | undefined;
          
          // Try to match against known AMCs
          for (const [key, amc] of amcLookup.entries()) {
            if (fundName.includes(key) || key.split(' ')[0] && fundName.includes(key.split(' ')[0])) {
              matchedAMC = amc;
              break;
            }
          }
          
          if (matchedAMC) {
            const amcKey = matchedAMC.amcName;
            if (!holdingsByAMC.has(amcKey)) {
              holdingsByAMC.set(amcKey, []);
            }
            holdingsByAMC.get(amcKey)!.push(holding);
          }
        }
        
        // Calculate scaling factors per AMC and apply corrections
        let correctedCount = 0;
        for (const [amcName, amcHoldings] of holdingsByAMC.entries()) {
          const amcSummary = amcSummaries.find(a => a.amcName === amcName);
          if (!amcSummary) continue;
          
          const parsedAMCTotal = amcHoldings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
          const expectedAMCTotal = amcSummary.marketValue;
          
          if (parsedAMCTotal > 0 && Math.abs(parsedAMCTotal - expectedAMCTotal) / expectedAMCTotal > 0.1) {
            const scaleFactor = expectedAMCTotal / parsedAMCTotal;
            console.log(`[PDF Parser] AMC ${amcName}: Scaling by ${scaleFactor.toFixed(2)} (parsed ₹${parsedAMCTotal.toLocaleString('en-IN')} → expected ₹${expectedAMCTotal.toLocaleString('en-IN')})`);
            
            // Apply scaling factor to each holding in this AMC
            for (const holding of amcHoldings) {
              holding.currentValue = (holding.currentValue || 0) * scaleFactor;
              correctedCount++;
            }
          }
        }
        
        if (correctedCount > 0) {
          // Recalculate totals after correction
          parsedTotalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
          console.log(`[PDF Parser] Applied AMC-based corrections to ${correctedCount} holdings. New total: ₹${parsedTotalValue.toLocaleString('en-IN')}`);
        }
      }
    }
    
    // Check if parsed value still significantly differs from expected value
    if (expectedTotalValue && parsedTotalValue > 0) {
      const valueDiff = Math.abs(parsedTotalValue - expectedTotalValue);
      const valueDiffPercent = (valueDiff / expectedTotalValue) * 100;
      
      if (valueDiffPercent > 10) {
        const missingValue = expectedTotalValue - parsedTotalValue;
        console.warn(`[Portfolio Parser] VALUE MISMATCH: Expected ₹${expectedTotalValue.toLocaleString('en-IN')}, Parsed ₹${parsedTotalValue.toLocaleString('en-IN')}`);
        console.warn(`[Portfolio Parser] Missing value: ₹${missingValue.toLocaleString('en-IN')} (${valueDiffPercent.toFixed(1)}% difference)`);
        
        if (missingValue > 0) {
          errors.push(`Parsing may be incomplete. Expected ₹${(expectedTotalValue/100000).toFixed(2)}L but found ₹${(parsedTotalValue/100000).toFixed(2)}L. Some holdings may need manual review.`);
        }
      }
    }
    
    // Log and track unimported funds
    if (needsManualReview && expectedCount) {
      const errorMsg = `${unimportedCount} of ${expectedCount} funds could not be imported automatically. Please review and add missing funds manually.`;
      errors.push(errorMsg);
      console.warn(`[Portfolio Parser] ALERT: ${errorMsg} (File: ${fileName}, Broker: ${broker})`);
      console.warn(`[Portfolio Parser] Imported funds: ${holdings.map(h => h.name).join(', ')}`);
    }
    
    let avgConfidence = holdings.length > 0 
      ? holdings.reduce((sum, h) => sum + (h.confidenceScore || 50), 0) / holdings.length
      : 30;
    
    // AI fallback: when holdings are empty or confidence is too low (<60% threshold)
    if (holdings.length === 0 || avgConfidence < 60) {
      console.log('[PDF Parser] Low confidence or no holdings, trying AI-assisted parsing...');
      try {
        const aiHoldings = await parsePortfolioWithAI(text);
        if (aiHoldings.length > 0) {
          console.log(`[PDF Parser] AI parser found ${aiHoldings.length} holdings`);
          holdings = aiHoldings;
          avgConfidence = 75;
          errors.length = 0;
          errors.push('Parsed using AI assistance - please verify extracted data');
        }
      } catch (aiError) {
        console.warn('[PDF Parser] AI fallback failed:', aiError);
      }
    }
    
    // Enrich holdings with proper fund names from database using ISIN lookup
    holdings = await enrichHoldingsWithDatabaseLookup(holdings);
    
    const result: ParseResult = {
      success: holdings.length > 0,
      holdings,
      brokerDetected: broker,
      confidenceScore: Math.round(avgConfidence),
      errors,
      rawText: text.substring(0, 2000),
      expectedCount,
      importedCount,
      unimportedCount,
      needsManualReview
    };
    
    setCachedResult(fileHash, result);
    return result;
  } catch (error: any) {
    return {
      success: false,
      holdings: [],
      brokerDetected: null,
      confidenceScore: 0,
      errors: [`PDF parsing failed: ${error.message}`]
    };
  }
}

export async function parseURLPortfolio(html: string, url: string): Promise<ParseResult> {
  try {
    const $ = cheerio.load(html);
    const text = $('body').text();
    
    // Check for expired/invalid link indicators
    const expiredIndicators = [
      'link has expired',
      'token expired',
      'session expired',
      'please login',
      'sign in',
      'invalid token',
      'unauthorized',
      'access denied',
      'link is no longer valid',
      'report not found',
      'page not found',
      '404',
      'error occurred'
    ];
    
    const lowerText = text.toLowerCase();
    const isExpiredLink = expiredIndicators.some(indicator => lowerText.includes(indicator));
    
    if (isExpiredLink) {
      return {
        success: false,
        holdings: [],
        brokerDetected: url.includes('wealthy.in') ? 'Wealthy.in' : null,
        confidenceScore: 0,
        errors: ['The report link has expired or is no longer valid. Please generate a fresh link from your broker platform and use it immediately.']
      };
    }
    
    const { broker, confidence } = detectBroker(url + ' ' + text);
    let holdings: ImportedHolding[] = [];
    
    if (url.includes('wealthy.in')) {
      holdings = parseWealthyHTML($);
    } else if (broker === 'Groww') {
      holdings = parseGrowwHTML($);
    } else {
      holdings = parseGenericHTML($);
    }
    
    if (holdings.length === 0) {
      holdings = parseGenericFormat(text);
    }
    
    const avgConfidence = holdings.length > 0 
      ? holdings.reduce((sum, h) => sum + (h.confidenceScore || 50), 0) / holdings.length
      : 30;
    
    // Provide specific guidance if no holdings found
    let errorMessage = 'Could not extract holdings from URL. Please verify the link.';
    if (url.includes('wealthy.in') && holdings.length === 0) {
      errorMessage = 'Could not extract holdings. Wealthy.in links expire quickly. Please generate a fresh report link and use it within 5 minutes, or save the page as HTML and upload it.';
    }
    
    return {
      success: holdings.length > 0,
      holdings,
      brokerDetected: broker,
      confidenceScore: Math.round(avgConfidence),
      errors: holdings.length === 0 ? [errorMessage] : []
    };
  } catch (error: any) {
    return {
      success: false,
      holdings: [],
      brokerDetected: null,
      confidenceScore: 0,
      errors: [`URL parsing failed: ${error.message}`]
    };
  }
}

function parseWealthyHTML($: cheerio.CheerioAPI): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  const bodyText = $('body').text();
  
  // Use a robust line-by-line approach that handles:
  // - Fund names starting with numbers (e.g., "360 ONE Focused Fund")
  // - Special characters like &, ', etc.
  // - Alphanumeric folio numbers
  
  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l);
  let currentFund: any = null;
  let fundIndex = 0;
  
  // Pattern to detect fund names - allows numbers, letters, special chars
  // Must contain "Fund" or end with "(G)" or "(IDCW)" or similar
  const fundNamePattern = /^[\d\s]*[A-Za-z0-9][\w\s\-\(\)&'\.]+(?:Fund|Scheme|\(G\)|\(IDCW\)|\(Growth\)|\(Dividend\))[\s\-\(\)A-Za-z0-9]*$/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip header lines and navigation
    if (line.includes('Portfolio Overview') || line.includes('Holding Analysis') || 
        line.includes('MUTUAL FUNDS') || line.length < 5) {
      continue;
    }
    
    // Check if this line looks like a fund name
    const isFundName = (
      (line.includes('Fund') || line.includes('(G)') || line.includes('(IDCW)') || 
       line.includes('Growth') || line.includes('Dividend')) &&
      !line.includes('₹') && 
      !line.includes('Invested') && 
      !line.includes('Current') && 
      !line.includes('Returns') &&
      !line.includes('Folio') &&
      !line.includes('Category') &&
      !line.includes('NAV') &&
      line.length > 15 && 
      line.length < 120
    );
    
    if (isFundName) {
      // Save previous fund if it has valid data
      if (currentFund && currentFund.name && currentFund.currentValue > 0) {
        // Calculate gain if not set
        if (currentFund.investedValue && !currentFund.unrealizedGain) {
          currentFund.unrealizedGain = currentFund.currentValue - currentFund.investedValue;
        }
        holdings.push(currentFund);
      }
      
      // Start new fund
      currentFund = {
        id: `wealthy-${Date.now()}-${fundIndex++}`,
        name: line.replace(/\s+/g, ' ').trim(),
        assetType: 'mutual_fund' as const,
        quantity: 1,
        currentValue: 0,
        investedValue: 0,
        broker: 'Wealthy.in',
        confidenceScore: 85
      };
      continue;
    }
    
    // Extract financial values for current fund
    if (currentFund) {
      // Match "Invested₹ X,XX,XXX" or "Invested ₹ X,XX,XXX" patterns (supports lakhs format)
      const investedMatch = line.match(/Invested\s*₹?\s*([\d,]+)/i);
      if (investedMatch && !currentFund.investedValue) {
        currentFund.investedValue = parseFloat(investedMatch[1].replace(/,/g, ''));
      }
      
      // Match "Current₹ X,XX,XXX" or "Current ₹ X,XX,XXX" patterns
      const currentMatch = line.match(/Current\s*₹?\s*([\d,]+)/i);
      if (currentMatch && !currentFund.currentValue) {
        currentFund.currentValue = parseFloat(currentMatch[1].replace(/,/g, ''));
      }
      
      // Match "Returns X.XX%" or "Returns -X.XX%" patterns
      const returnsMatch = line.match(/Returns\s*([\-\d\.]+)\s*%/i);
      if (returnsMatch) {
        currentFund.unrealizedGainPercent = parseFloat(returnsMatch[1]);
      }
      
      // Match "Folio: XXXXX" or "**Folio:** XXXXX" - allows alphanumeric folio numbers
      const folioMatch = line.match(/Folio[:\s\*]*\s*([\w\/\-]+)/i);
      if (folioMatch && !currentFund.folioNumber) {
        currentFund.folioNumber = folioMatch[1].trim();
      }
      
      // Detect asset category from category line (Equity | Growth | Sectoral)
      if (line.includes('Equity') && line.includes('|')) {
        currentFund.category = 'equity';
      } else if (line.includes('Debt') && line.includes('|')) {
        currentFund.category = 'debt';
      } else if (line.includes('Hybrid') && line.includes('|')) {
        currentFund.category = 'hybrid';
      }
    }
  }
  
  // Don't forget the last fund
  if (currentFund && currentFund.name && currentFund.currentValue > 0) {
    if (currentFund.investedValue && !currentFund.unrealizedGain) {
      currentFund.unrealizedGain = currentFund.currentValue - currentFund.investedValue;
    }
    holdings.push(currentFund);
  }
  
  return holdings;
}

function extractHoldingsFromJSON(data: any, broker: string): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  
  // Handle various JSON structures
  const possibleArrays = [
    data.holdings,
    data.funds,
    data.investments,
    data.portfolio?.holdings,
    data.data?.holdings,
    data.mutualFunds,
    data.schemes,
    Array.isArray(data) ? data : null
  ].filter(Boolean);
  
  for (const arr of possibleArrays) {
    if (!Array.isArray(arr)) continue;
    
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      const name = item.schemeName || item.fundName || item.name || item.scheme_name || '';
      const value = item.currentValue || item.current_value || item.marketValue || item.value || 0;
      const units = item.units || item.quantity || item.nav_units || 1;
      const invested = item.investedValue || item.invested_value || item.cost || value;
      
      if (name && value > 0) {
        holdings.push({
          id: `holding-${Date.now()}-${i}`,
          name: name.trim(),
          assetType: 'mutual_fund',
          quantity: typeof units === 'number' ? units : parseFloat(units) || 1,
          currentValue: typeof value === 'number' ? value : parseFloat(value) || 0,
          investedValue: typeof invested === 'number' ? invested : parseFloat(invested) || undefined,
          isin: item.isin || item.ISIN,
          folioNumber: item.folioNumber || item.folio,
          broker,
          confidenceScore: 85
        });
      }
    }
    
    if (holdings.length > 0) break;
  }
  
  return holdings;
}

function parseGrowwHTML($: cheerio.CheerioAPI): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  
  $('[class*="stock"], [class*="fund"], [class*="holding"]').each((i, elem) => {
    const name = $(elem).find('[class*="name"]').first().text().trim();
    const valueText = $(elem).find('[class*="value"], [class*="current"]').first().text().trim();
    
    if (name && valueText) {
      const value = parseFloat(valueText.replace(/[₹,\s]/g, ''));
      if (value > 0) {
        holdings.push({
          id: `holding-${Date.now()}-${i}`,
          name,
          assetType: /fund|scheme/i.test(name) ? 'mutual_fund' : 'equity',
          quantity: 1,
          currentValue: value,
          broker: 'Groww',
          confidenceScore: 70
        });
      }
    }
  });
  
  return holdings;
}

function parseGenericHTML($: cheerio.CheerioAPI): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  
  $('table tr').each((i, row) => {
    if (i === 0) return;
    
    const cells = $(row).find('td');
    if (cells.length >= 3) {
      const name = $(cells[0]).text().trim();
      const qty = parseFloat($(cells[1]).text().replace(/[,\s]/g, ''));
      const value = parseFloat($(cells[cells.length - 1]).text().replace(/[₹,\s]/g, ''));
      
      if (name && !isNaN(value) && value > 0) {
        holdings.push({
          id: `holding-${Date.now()}-${i}`,
          name,
          assetType: /fund|scheme|growth/i.test(name) ? 'mutual_fund' : 'equity',
          quantity: isNaN(qty) ? 1 : qty,
          currentValue: value,
          confidenceScore: 50
        });
      }
    }
  });
  
  return holdings;
}

export function createPortfolioSnapshot(
  holdings: ImportedHolding[],
  sourceType: 'pdf_upload' | 'url_import' | 'manual_entry' | 'api_fetch',
  options: {
    fileName?: string;
    sourceUrl?: string;
    sourceName?: string;
    brokerDetected?: string;
    confidenceScore?: number;
    errors?: string[];
  }
): ImportedPortfolioSnapshot {
  const totalCurrentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalInvestedValue = holdings.reduce((sum, h) => sum + (h.investedValue || h.currentValue), 0);
  const allocation = calculateAllocation(holdings);
  
  const hasLowConfidence = holdings.some(h => (h.confidenceScore || 100) < 60);
  
  return {
    holdings,
    totalInvestedValue,
    totalCurrentValue,
    totalUnrealizedGain: totalCurrentValue - totalInvestedValue,
    allocation,
    sourceType,
    sourceName: options.sourceName,
    sourceUrl: options.sourceUrl,
    fileName: options.fileName,
    capturedAt: new Date().toISOString(),
    parsingStatus: options.errors && options.errors.length > 0 ? 'failed' : (hasLowConfidence ? 'needs_review' : 'completed'),
    parsingErrors: options.errors,
    confidenceScore: options.confidenceScore,
    brokerDetected: options.brokerDetected
  };
}

const geminiAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function parsePortfolioWithAI(text: string): Promise<ImportedHolding[]> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[AI Parser] Gemini API key not configured');
    return [];
  }

  const truncatedText = text.substring(0, 15000);
  
  const prompt = `Extract mutual fund holdings from this portfolio statement text. For each holding, extract:
- name: Full scheme name
- isin: 12-character ISIN code (INF...)
- folioNumber: Folio number
- quantity: Number of units
- investedValue: Amount invested
- currentValue: Current market value

Return ONLY a JSON array of holdings. If a value is not found, use null.

Portfolio Text:
${truncatedText}`;

  try {
    const response = await geminiAi.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              isin: { type: 'string', nullable: true },
              folioNumber: { type: 'string', nullable: true },
              quantity: { type: 'number' },
              investedValue: { type: 'number', nullable: true },
              currentValue: { type: 'number' }
            },
            required: ['name', 'quantity', 'currentValue']
          }
        }
      },
      contents: prompt
    });

    const rawJson = response.text;
    if (!rawJson) return [];

    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any) => ({
      name: holdingNormalizationService.normalizeHoldingName(item.name || ''),
      isin: item.isin || undefined,
      folioNumber: item.folioNumber || undefined,
      assetType: 'mutual_fund' as const,
      quantity: item.quantity || 0,
      investedValue: item.investedValue || undefined,
      currentValue: item.currentValue || 0,
      confidenceScore: 75
    }));
  } catch (error) {
    console.error('[AI Parser] Failed to parse with Gemini:', error);
    return [];
  }
}
