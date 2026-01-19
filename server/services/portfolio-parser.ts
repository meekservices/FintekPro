import * as cheerio from 'cheerio';
import { PDFParse } from 'pdf-parse';
import { liveMFDataService } from './live-mf-data-service';

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
 * Parse CAMS/KFintech tabular CAS format
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
  if (holdings.length === 0 && uniqueISINs.length > 0) {
    console.log('[CAMS Table Parser] Trying ISIN-based extraction...');
    
    // CAMS PDF format after text extraction:
    // ...SchemeName Units Date NAV Registrar ISIN Cost Folio MarketValue SchemeCode - NextSchemeName...
    // The market value appears AFTER the ISIN: ISIN -> Cost -> Folio -> MarketValue -> SchemeCode
    // Example: "INF846K01J79  80,000.000 91085045342/0 91,703.02128AFGPG - Axis..."
    
    for (const isin of uniqueISINs) {
      const isinIndex = text.indexOf(isin);
      if (isinIndex >= 0) {
        // Look for data AFTER the ISIN - contains cost, folio, market value, scheme info
        const afterIsin = text.substring(isinIndex + isin.length, Math.min(text.length, isinIndex + isin.length + 500));
        // Also look before for context
        const beforeIsin = text.substring(Math.max(0, isinIndex - 200), isinIndex);
        
        console.log('[CAMS Table Parser] After ISIN:', afterIsin.substring(0, 120));
        
        // Pattern after ISIN: " 80,000.000\n91085045342/0 91,703.02128AFGPG - Axis..."
        // The market value is the SECOND decimal number after folio pattern
        // Or pattern: "Cost FolioNo MarketValueSchemeCode - SchemeName"
        
        // Look for: folio pattern followed by market value (XX,XXX.XX) followed by scheme code
        const afterPattern = afterIsin.match(/\d{5,}(?:\/\d+)?\s+([\d,]+\.\d{2})(\d*[A-Z]+)\s*-\s*(.+?)(?:\n|Growth|IDCW|Regular|Direct)/i);
        
        let marketValue = 0;
        let schemeName = '';
        let folio = '';
        
        if (afterPattern) {
          marketValue = parseFloat(afterPattern[1].replace(/,/g, ''));
          schemeName = afterPattern[3].trim();
          console.log('[CAMS Table Parser] Matched after pattern:', afterPattern[1], afterPattern[3]);
        } else {
          // Alternate: look for all decimal numbers after ISIN, skip cost (first big one), take next one
          const allDecimals = afterIsin.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/g);
          console.log('[CAMS Table Parser] All decimals after ISIN:', allDecimals?.slice(0, 5));
          
          if (allDecimals && allDecimals.length >= 2) {
            // Pattern: First decimal is cost (80,000.000), second is market value (91,703.02)
            // But we need the one that looks like a market value (tens of thousands typically)
            const parsedValues = allDecimals.map(v => parseFloat(v.replace(/,/g, '')));
            
            // Find folio in afterIsin to locate the market value
            const folioInAfter = afterIsin.match(/(\d{5,}(?:\/\d+)?)/);
            if (folioInAfter) {
              folio = folioInAfter[1];
              // Market value comes right after folio
              const afterFolioIdx = afterIsin.indexOf(folioInAfter[0]) + folioInAfter[0].length;
              const afterFolio = afterIsin.substring(afterFolioIdx);
              const mvMatch = afterFolio.match(/^\s*([\d,]+\.\d{2})/);
              if (mvMatch) {
                marketValue = parseFloat(mvMatch[1].replace(/,/g, ''));
                console.log('[CAMS Table Parser] Market value after folio:', marketValue);
              }
            }
            
            // Fallback: take the value that's in reasonable MF range (10K - 10L typically)
            if (marketValue === 0) {
              const reasonableValues = parsedValues.filter(v => v >= 1000 && v <= 1000000);
              if (reasonableValues.length > 0) {
                // Take the second reasonable value if available (first is often cost)
                marketValue = reasonableValues.length > 1 ? reasonableValues[1] : reasonableValues[0];
              }
            }
          }
        }
        
        // Extract scheme name from after ISIN if not already found
        if (!schemeName) {
          // Look for "SchemeCode - SchemeName" pattern
          const schemeMatch = afterIsin.match(/[A-Z0-9]+\s*-\s*([A-Za-z][A-Za-z0-9\s&\-()]+(?:Fund|Plan)[A-Za-z0-9\s&\-()]*)/i);
          schemeName = schemeMatch ? schemeMatch[1].trim() : '';
        }
        
        // Also try to get scheme name from BEFORE the ISIN (same line context)
        if (!schemeName) {
          const beforeScheme = beforeIsin.match(/([A-Za-z][A-Za-z0-9\s&\-()]+(?:Fund|Plan)[A-Za-z0-9\s&\-()]*)\s*$/i);
          schemeName = beforeScheme ? beforeScheme[1].trim() : `Unknown Fund (${isin})`;
        }
        
        // Clean up scheme name
        schemeName = schemeName
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/\s*\d+\s*$/, '')
          .replace(/\s*(KFINTECH|CAMS)\s*$/i, '')
          .replace(/\s*\d{1,2}-[A-Za-z]{3}-\d{4}\s*$/, '')
          .trim();
        
        // Add suffix if present
        const suffixMatch = afterIsin.match(/\b(Growth|IDCW|Regular\s*Plan|Direct\s*Plan)\b/i);
        if (suffixMatch && !schemeName.toLowerCase().includes(suffixMatch[1].toLowerCase())) {
          schemeName += ' - ' + suffixMatch[1];
        }
        
        if (marketValue > 100 && schemeName.length > 5) {
          holdings.push({
            id: `cas-isin-${Date.now()}-${holdings.length}`,
            name: schemeName,
            isin: isin,
            assetType: 'mutual_fund',
            quantity: 0,
            currentValue: marketValue,
            folioNumber: folio,
            broker: 'CAMS/KFintech',
            confidenceScore: 80
          });
          
          console.log('[CAMS Table Parser] Found holding (ISIN-based):', schemeName, 'Value:', marketValue);
        }
      }
    }
  }
  
  console.log('[CAMS Table Parser] Total holdings found:', holdings.length);
  console.log('[CAMS Table Parser] Total value:', holdings.reduce((sum, h) => sum + h.currentValue, 0));
  
  return holdings;
}

export async function enrichHoldingsWithDatabaseLookup(holdings: ImportedHolding[]): Promise<ImportedHolding[]> {
  const isins = holdings
    .filter(h => h.isin && h.isin.length === 12)
    .map(h => h.isin!);
  
  if (isins.length === 0) {
    console.log('[CAS Parser] No ISINs to lookup for enrichment');
    return holdings;
  }
  
  console.log(`[CAS Parser] Looking up ${isins.length} ISINs in database for fund name enrichment`);
  
  const fundLookup = await liveMFDataService.getFundsByIsinBatch(isins);
  console.log(`[CAS Parser] Found ${fundLookup.size} funds in database`);
  
  return holdings.map(holding => {
    if (holding.isin && fundLookup.has(holding.isin)) {
      const dbFund = fundLookup.get(holding.isin)!;
      const needsEnrichment = holding.name.includes('Unknown') || 
                              holding.name.includes('ISIN:') ||
                              holding.name.length < 20;
      
      if (needsEnrichment) {
        console.log(`[CAS Parser] Enriched "${holding.name}" -> "${dbFund.schemeName}" from database`);
        return {
          ...holding,
          name: dbFund.schemeName,
          broker: holding.broker || dbFund.fundHouse
        };
      }
    }
    return holding;
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
  try {
    // Use the new pdf-parse v2 API with PDFParse class
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text;
    
    // Clean up the parser
    await parser.destroy();
    
    const { broker, confidence } = detectBroker(text);
    let holdings: ImportedHolding[] = [];
    
    // Extract expected fund count from PDF header (e.g., "MUTUAL FUNDS (25)")
    const expectedCountMatch = text.match(/MUTUAL FUNDS\s*\((\d+)\)/i);
    const expectedCount = expectedCountMatch ? parseInt(expectedCountMatch[1], 10) : undefined;
    
    if (broker === 'CAMS/KFintech CAS') {
      // Try table format first (newer format with columns)
      holdings = parseCAMSKfintechTableFormat(text);
      // Fall back to MFCentral format if table parsing fails
      if (holdings.length === 0) {
        holdings = parseCASFormat(text);
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
    
    // If no holdings found with specific parser, try CAMS table format first (common for CAS statements)
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
    
    // Build error messages
    const errors: string[] = [];
    if (holdings.length === 0) {
      errors.push('Could not extract holdings from PDF. Please verify the format.');
    }
    
    // Log and track unimported funds
    if (needsManualReview && expectedCount) {
      const errorMsg = `${unimportedCount} of ${expectedCount} funds could not be imported automatically. Please review and add missing funds manually.`;
      errors.push(errorMsg);
      console.warn(`[Portfolio Parser] ALERT: ${errorMsg} (File: ${fileName}, Broker: ${broker})`);
      console.warn(`[Portfolio Parser] Imported funds: ${holdings.map(h => h.name).join(', ')}`);
    }
    
    const avgConfidence = holdings.length > 0 
      ? holdings.reduce((sum, h) => sum + (h.confidenceScore || 50), 0) / holdings.length
      : 30;
    
    // Enrich holdings with proper fund names from database using ISIN lookup
    holdings = await enrichHoldingsWithDatabaseLookup(holdings);
    
    return {
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
