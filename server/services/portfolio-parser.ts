import * as cheerio from 'cheerio';

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
    const pdfParseModule = await import('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;
    
    const { broker, confidence } = detectBroker(text);
    let holdings: ImportedHolding[] = [];
    
    if (broker === 'Zerodha') {
      holdings = parseZerodhaFormat(text);
    } else if (broker === 'Groww') {
      holdings = parseGrowwFormat(text);
    } else if (broker === 'MF Central') {
      holdings = parseMFCentralFormat(text);
    }
    
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
    
    return {
      success: holdings.length > 0,
      holdings,
      brokerDetected: broker,
      confidenceScore: Math.round(avgConfidence),
      errors: holdings.length === 0 ? ['Could not extract holdings from URL. Please verify the link.'] : []
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
  
  // Wealthy.in has a specific pattern for each fund:
  // Fund Name followed by category, then Invested/Current/Returns values
  
  // Pattern to match fund blocks with their details
  // Look for fund names followed by category and financial values
  const fundPattern = /([A-Z][A-Za-z\s\-\(\)]+(?:Fund|Growth|IDCW|Plan|Direct|Regular)[^\n]*)\s*(?:Equity|Debt|Hybrid)\s*\|\s*(?:Growth|Dividend|IDCW)\s*\|[^\n]*\s*Invested\s*₹\s*([\d,]+)\s*Current\s*₹\s*([\d,]+)\s*Returns\s*([\-\d\.]+)%\s*(?:\*\*Folio:\*\*\s*(\d+[\/\d]*)|Folio[:\s]*(\d+[\/\d]*))?/gi;
  
  let match;
  let index = 0;
  
  while ((match = fundPattern.exec(bodyText)) !== null) {
    const name = match[1].trim();
    const invested = parseFloat(match[2].replace(/,/g, ''));
    const current = parseFloat(match[3].replace(/,/g, ''));
    const returns = parseFloat(match[4]);
    const folio = match[5] || match[6] || '';
    
    if (name && current > 0) {
      // Determine asset type from name/context
      let assetType: 'equity' | 'mutual_fund' | 'etf' | 'bond' | 'gold' | 'fd' | 'other' = 'mutual_fund';
      const nameLower = name.toLowerCase();
      if (nameLower.includes('equity') || nameLower.includes('flexi') || nameLower.includes('contra')) {
        assetType = 'mutual_fund'; // Equity MF
      }
      
      holdings.push({
        id: `wealthy-${Date.now()}-${index}`,
        name: name.replace(/\s+/g, ' ').trim(),
        assetType,
        quantity: 1,
        currentValue: current,
        investedValue: invested,
        unrealizedGain: current - invested,
        unrealizedGainPercent: returns,
        folioNumber: folio,
        broker: 'Wealthy.in',
        confidenceScore: 90
      });
      index++;
    }
  }
  
  // If regex didn't work, try a simpler text-based approach
  if (holdings.length === 0) {
    // Split by common fund name patterns and extract details
    const lines = bodyText.split('\n').filter(l => l.trim());
    let currentFund: any = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if this is a fund name (contains "Fund" and typical fund indicators)
      if ((line.includes('Fund') || line.includes('(G)') || line.includes('(IDCW)')) && 
          !line.includes('₹') && line.length > 10 && line.length < 100) {
        
        // Save previous fund if exists
        if (currentFund && currentFund.name && currentFund.currentValue > 0) {
          holdings.push(currentFund);
        }
        
        currentFund = {
          id: `wealthy-${Date.now()}-${holdings.length}`,
          name: line.replace(/\s+/g, ' ').trim(),
          assetType: 'mutual_fund' as const,
          quantity: 1,
          currentValue: 0,
          broker: 'Wealthy.in',
          confidenceScore: 80
        };
      }
      
      // Extract values from subsequent lines
      if (currentFund) {
        // Match "Invested ₹ X,XXX" pattern
        const investedMatch = line.match(/Invested\s*₹\s*([\d,]+)/i);
        if (investedMatch) {
          currentFund.investedValue = parseFloat(investedMatch[1].replace(/,/g, ''));
        }
        
        // Match "Current ₹ X,XXX" pattern  
        const currentMatch = line.match(/Current\s*₹\s*([\d,]+)/i);
        if (currentMatch) {
          currentFund.currentValue = parseFloat(currentMatch[1].replace(/,/g, ''));
        }
        
        // Match "Returns X.XX%" pattern
        const returnsMatch = line.match(/Returns\s*([\-\d\.]+)%/i);
        if (returnsMatch) {
          currentFund.unrealizedGainPercent = parseFloat(returnsMatch[1]);
        }
        
        // Match "Folio: XXXXX" pattern
        const folioMatch = line.match(/Folio[:\s]*(\d+[\/\d]*)/i);
        if (folioMatch) {
          currentFund.folioNumber = folioMatch[1];
        }
      }
    }
    
    // Don't forget the last fund
    if (currentFund && currentFund.name && currentFund.currentValue > 0) {
      holdings.push(currentFund);
    }
  }
  
  // Calculate unrealized gain if we have invested and current values
  holdings.forEach(h => {
    if (h.investedValue && h.currentValue && !h.unrealizedGain) {
      h.unrealizedGain = h.currentValue - h.investedValue;
    }
  });
  
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
