import pdfParse from 'pdf-parse';
import * as cheerio from 'cheerio';
import type { PortfolioHolding, PortfolioSnapshot, PortfolioAllocation } from '@shared/schema';

interface ParseResult {
  success: boolean;
  holdings: PortfolioHolding[];
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

function parseZerodhaFormat(text: string): PortfolioHolding[] {
  const holdings: PortfolioHolding[] = [];
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

function parseGrowwFormat(text: string): PortfolioHolding[] {
  const holdings: PortfolioHolding[] = [];
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

function parseMFCentralFormat(text: string): PortfolioHolding[] {
  const holdings: PortfolioHolding[] = [];
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

function parseGenericFormat(text: string): PortfolioHolding[] {
  const holdings: PortfolioHolding[] = [];
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

function calculateAllocation(holdings: PortfolioHolding[]): PortfolioAllocation {
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
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;
    
    const { broker, confidence } = detectBroker(text);
    let holdings: PortfolioHolding[] = [];
    
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
    let holdings: PortfolioHolding[] = [];
    
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

function parseWealthyHTML($: cheerio.CheerioAPI): PortfolioHolding[] {
  const holdings: PortfolioHolding[] = [];
  
  $('[class*="fund"], [class*="holding"], [class*="scheme"]').each((i, elem) => {
    const name = $(elem).find('[class*="name"], [class*="title"]').first().text().trim();
    const valueText = $(elem).find('[class*="value"], [class*="amount"]').first().text().trim();
    const unitsText = $(elem).find('[class*="unit"], [class*="qty"]').first().text().trim();
    
    if (name && valueText) {
      const value = parseFloat(valueText.replace(/[₹,\s]/g, ''));
      const units = parseFloat(unitsText.replace(/[,\s]/g, '')) || 1;
      
      if (value > 0) {
        holdings.push({
          id: `holding-${Date.now()}-${i}`,
          name,
          assetType: 'mutual_fund',
          quantity: units,
          currentValue: value,
          broker: 'Wealthy.in',
          confidenceScore: 75
        });
      }
    }
  });
  
  return holdings;
}

function parseGrowwHTML($: cheerio.CheerioAPI): PortfolioHolding[] {
  const holdings: PortfolioHolding[] = [];
  
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

function parseGenericHTML($: cheerio.CheerioAPI): PortfolioHolding[] {
  const holdings: PortfolioHolding[] = [];
  
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
  holdings: PortfolioHolding[],
  sourceType: 'pdf_upload' | 'url_import' | 'manual_entry' | 'api_fetch',
  options: {
    fileName?: string;
    sourceUrl?: string;
    sourceName?: string;
    brokerDetected?: string;
    confidenceScore?: number;
    errors?: string[];
  }
): PortfolioSnapshot {
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
