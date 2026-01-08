import * as cheerio from 'cheerio';
import { PDFParse } from 'pdf-parse';

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
}

const BROKER_PATTERNS: Record<string, { name: string; patterns: RegExp[] }> = {
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

function parseWealthyPDFFormat(text: string): ImportedHolding[] {
  const holdings: ImportedHolding[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Debug: Log first 60 lines to understand structure
  console.log('[Wealthy Parser] First 60 lines:', lines.slice(0, 60));
  
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
    const hasFundKeyword = line.includes('Fund') || 
                           line.includes('Asset Allocation') || 
                           line.includes('(FOF)') ||
                           line.includes('Savings');
    
    const isFundName = (
      hasFundKeyword &&
      !line.match(/^(Equity|Debt|Hybrid)\s*\|/i) &&
      !line.includes('₹') &&
      !line.match(/^(Invested|Current|Returns|NAV)/i) &&
      !line.match(/^Mutual Fund Report$/i) && // Skip false positive
      !line.includes('fund portfolio') &&
      line.length > 15 // Real fund names are longer
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
      let fullName = line;
      const needsContinuation = (
        // Ends with hyphen = definitely continues
        line.endsWith('-') ||
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
        nextLine.length < 40 && // Continuation lines are usually short
        (nextLine.includes('(G)') || 
         nextLine.includes('(IDCW)') || 
         nextLine.includes('(FOF)') ||
         nextLine.match(/^(Direct|Regular|Active|Growth|Dividend|Hybrid)/i))
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
    
    if (broker === 'Wealthy.in') {
      holdings = parseWealthyPDFFormat(text);
    } else if (broker === 'Zerodha') {
      holdings = parseZerodhaFormat(text);
    } else if (broker === 'Groww') {
      holdings = parseGrowwFormat(text);
    } else if (broker === 'MF Central') {
      holdings = parseMFCentralFormat(text);
    }
    
    // If no holdings found with specific parser, try Wealthy format (common PDF format)
    if (holdings.length === 0) {
      holdings = parseWealthyPDFFormat(text);
    }
    
    // If still no holdings, try generic format
    if (holdings.length === 0) {
      holdings = parseGenericFormat(text);
    }
    
    const avgConfidence = holdings.length > 0 
      ? holdings.reduce((sum, h) => sum + (h.confidenceScore || 50), 0) / holdings.length
      : 30;
    
    return {
      success: holdings.length > 0,
      holdings,
      brokerDetected: broker,
      confidenceScore: Math.round(avgConfidence),
      errors: holdings.length === 0 ? ['Could not extract holdings from PDF. Please verify the format.'] : [],
      rawText: text.substring(0, 2000)
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
