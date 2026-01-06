import * as cheerio from 'cheerio';

export interface WealthyInvestorInfo {
  name: string;
  pan: string;
  lastSync: string;
}

export interface WealthyTransaction {
  category: string;
  units: number;
  amount: number;
  nav: number;
  navDate: string;
}

export interface WealthyHolding {
  fundName: string;
  assetType: 'Equity' | 'Debt' | 'Hybrid';
  growthType: string;
  category: string;
  invested: number;
  currentValue: number;
  returns: number;
  folio: string;
  arn: string;
  startDate: string;
  ltcg: number;
  stcg: number;
  longTermUnits: number;
  shortTermUnits: number;
  isDemat: boolean;
  transactions: WealthyTransaction[];
}

export interface WealthyPortfolio {
  investor: WealthyInvestorInfo;
  summary: {
    totalInvested: number;
    currentValue: number;
    growth: number;
    equityPercent: number;
    debtPercent: number;
  };
  holdings: WealthyHolding[];
}

export class WealthyImportService {
  
  private readonly ALLOWED_HOSTS = ['reports.wealthy.in'];
  
  private validateUrl(urlString: string): URL {
    let parsedUrl: URL;
    
    try {
      parsedUrl = new URL(urlString);
    } catch {
      throw new Error('Invalid URL format');
    }

    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Only HTTPS URLs are allowed for security');
    }

    if (!this.ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
      throw new Error(`Invalid host. Only ${this.ALLOWED_HOSTS.join(', ')} is allowed`);
    }

    if (!parsedUrl.searchParams.has('token')) {
      throw new Error('URL must contain a token parameter');
    }

    return parsedUrl;
  }
  
  async fetchAndParsePortfolio(url: string): Promise<WealthyPortfolio> {
    const validatedUrl = this.validateUrl(url);

    const response = await fetch(validatedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Wealthy.in report: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    
    if (html.length > 10 * 1024 * 1024) {
      throw new Error('Response too large (>10MB)');
    }
    
    return this.parseHtml(html);
  }

  parseHtml(html: string): WealthyPortfolio {
    const $ = cheerio.load(html);
    
    const investor = this.parseInvestorInfo($);
    const summary = this.parseSummary($);
    const holdings = this.parseHoldings($);

    return { investor, summary, holdings };
  }

  private parseInvestorInfo($: cheerio.CheerioAPI): WealthyInvestorInfo {
    let name = '';
    let pan = '';
    let lastSync = '';

    $('h3').each((_, el) => {
      const text = $(el).text().trim();
      if (text.startsWith('Name:')) {
        name = text.replace('Name:', '').trim();
      } else if (text.startsWith('PAN:')) {
        pan = text.replace('PAN:', '').trim();
      } else if (text.startsWith('Last Sync:')) {
        lastSync = text.replace('Last Sync:', '').trim();
      }
    });

    if (!name) {
      const bodyText = $('body').text();
      const nameMatch = bodyText.match(/Name:\s*([A-Z\s]+)/);
      if (nameMatch) name = nameMatch[1].trim();
      
      const panMatch = bodyText.match(/PAN:\s*([A-Z]{5}\d{4}[A-Z])/);
      if (panMatch) pan = panMatch[1];
      
      const syncMatch = bodyText.match(/Last Sync:\s*([\d-]+)/);
      if (syncMatch) lastSync = syncMatch[1];
    }

    return { name, pan, lastSync };
  }

  private parseSummary($: cheerio.CheerioAPI): WealthyPortfolio['summary'] {
    let totalInvested = 0;
    let currentValue = 0;
    let growth = 0;
    let equityPercent = 0;
    let debtPercent = 0;

    const bodyText = $('body').text();

    const investedMatch = bodyText.match(/Total Invested[^\d₹]*₹?\s*([\d,]+(?:\.\d+)?)/i);
    if (investedMatch) {
      totalInvested = this.parseIndianNumber(investedMatch[1]);
    }

    const currentMatch = bodyText.match(/Current Value[^\d₹]*₹?\s*([\d,]+(?:\.\d+)?)/i);
    if (currentMatch) {
      currentValue = this.parseIndianNumber(currentMatch[1]);
    }

    const growthMatch = bodyText.match(/Growth[^\d%]*(\d+(?:\.\d+)?)\s*%/i);
    if (growthMatch) {
      growth = parseFloat(growthMatch[1]);
    }

    const equityMatch = bodyText.match(/([\d.]+)%\s*Equity/i);
    if (equityMatch) {
      equityPercent = parseFloat(equityMatch[1]);
    }

    const debtMatch = bodyText.match(/([\d.]+)%\s*Debt/i);
    if (debtMatch) {
      debtPercent = parseFloat(debtMatch[1]);
    }

    return { totalInvested, currentValue, growth, equityPercent, debtPercent };
  }

  private parseHoldings($: cheerio.CheerioAPI): WealthyHolding[] {
    const holdings: WealthyHolding[] = [];
    const bodyText = $('body').text();

    const fundSections = bodyText.split(/(?=[\w\s]+ Fund[^a-z])/i);

    for (const section of fundSections) {
      const holding = this.parseHoldingSection(section);
      if (holding) {
        holdings.push(holding);
      }
    }

    if (holdings.length === 0) {
      const alternateHoldings = this.parseAlternateFormat($, bodyText);
      holdings.push(...alternateHoldings);
    }

    return holdings;
  }

  private parseHoldingSection(section: string): WealthyHolding | null {
    const fundNameMatch = section.match(/^([\w\s\-()]+Fund[\w\s\-()]*)/i);
    if (!fundNameMatch) return null;

    const fundName = fundNameMatch[1].trim();
    if (fundName.length < 10) return null;

    let assetType: 'Equity' | 'Debt' | 'Hybrid' = 'Equity';
    if (/Debt|Bond|Liquid|Money Market|Overnight|Ultra Short/i.test(section)) {
      assetType = 'Debt';
    } else if (/Hybrid|Balanced|Multi.?Asset|Dynamic Asset|Conservative/i.test(section)) {
      assetType = 'Hybrid';
    }

    let growthType = 'Growth';
    if (/IDCW|Dividend/i.test(section)) {
      growthType = 'IDCW';
    }

    let category = '';
    const categoryMatch = section.match(/\|([\w\s\/]+)\|/);
    if (categoryMatch) {
      category = categoryMatch[1].trim();
    }

    const investedMatch = section.match(/Invested[^\d₹]*₹?\s*([\d,]+(?:\.\d+)?)/i);
    const invested = investedMatch ? this.parseIndianNumber(investedMatch[1]) : 0;

    const currentMatch = section.match(/Current[^\d₹]*₹?\s*([\d,]+(?:\.\d+)?)/i);
    const currentValue = currentMatch ? this.parseIndianNumber(currentMatch[1]) : 0;

    const returnsMatch = section.match(/Returns[^\d%-]*(-?[\d.]+)\s*%/i);
    const returns = returnsMatch ? parseFloat(returnsMatch[1]) : 0;

    const folioMatch = section.match(/Folio[:\s]*([^\s*]+)/i);
    const folio = folioMatch ? folioMatch[1].replace(/\*+$/, '') : '';

    const arnMatch = section.match(/(?:ARN|Wealth Partner)[:\s]*([A-Z]{3}[0-9\-]+)/i);
    const arn = arnMatch ? arnMatch[1] : '';

    const startMatch = section.match(/Started[:\s]*([\d-A-Z]+)/i);
    const startDate = startMatch ? startMatch[1] : '';

    const ltcgMatch = section.match(/LTCG[^\d₹-]*₹?\s*(-?[\d,]+)/i);
    const ltcg = ltcgMatch ? this.parseIndianNumber(ltcgMatch[1]) : 0;

    const stcgMatch = section.match(/STCG[^\d₹-]*₹?\s*(-?[\d,]+)/i);
    const stcg = stcgMatch ? this.parseIndianNumber(stcgMatch[1]) : 0;

    const ltUnitsMatch = section.match(/Long Term Units[^\d]*(\d+(?:\.\d+)?)/i);
    const longTermUnits = ltUnitsMatch ? parseFloat(ltUnitsMatch[1]) : 0;

    const stUnitsMatch = section.match(/Short Term Units[^\d]*(\d+(?:\.\d+)?)/i);
    const shortTermUnits = stUnitsMatch ? parseFloat(stUnitsMatch[1]) : 0;

    const isDemat = /Demat[:\s]*Yes/i.test(section);

    const transactions: WealthyTransaction[] = [];
    const txMatches = section.matchAll(/Purchase\s*\|\s*([\d.]+)\s*\|\s*₹?\s*([\d,.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d-]+)/gi);
    for (const match of txMatches) {
      transactions.push({
        category: 'Purchase',
        units: parseFloat(match[1]),
        amount: this.parseIndianNumber(match[2]),
        nav: parseFloat(match[3]),
        navDate: match[4],
      });
    }

    if (invested === 0 && currentValue === 0) return null;

    return {
      fundName,
      assetType,
      growthType,
      category,
      invested,
      currentValue,
      returns,
      folio,
      arn,
      startDate,
      ltcg,
      stcg,
      longTermUnits,
      shortTermUnits,
      isDemat,
      transactions,
    };
  }

  private parseAlternateFormat($: cheerio.CheerioAPI, bodyText: string): WealthyHolding[] {
    const holdings: WealthyHolding[] = [];

    const fundPatterns = [
      /([A-Za-z\s]+(?:Fund|FOF)[^|]*)\s*(?:Equity|Debt|Hybrid)\s*\|\s*(?:Growth|IDCW|Dividend)/gi,
      /([A-Za-z\s-]+(?:Fund|FOF)[\w\s\-()]*)\s*Invested\s*₹?\s*([\d,]+)/gi,
    ];

    for (const pattern of fundPatterns) {
      let match;
      while ((match = pattern.exec(bodyText)) !== null) {
        const fundName = match[1].trim();
        
        const existing = holdings.find(h => h.fundName === fundName);
        if (existing) continue;

        const contextStart = Math.max(0, match.index);
        const contextEnd = Math.min(bodyText.length, match.index + 2000);
        const context = bodyText.slice(contextStart, contextEnd);

        const investedMatch = context.match(/Invested[^\d₹]*₹?\s*([\d,]+(?:\.\d+)?)/i);
        const invested = investedMatch ? this.parseIndianNumber(investedMatch[1]) : 0;

        const currentMatch = context.match(/Current[^\d₹]*₹?\s*([\d,]+(?:\.\d+)?)/i);
        const currentValue = currentMatch ? this.parseIndianNumber(currentMatch[1]) : 0;

        if (invested === 0 && currentValue === 0) continue;

        let assetType: 'Equity' | 'Debt' | 'Hybrid' = 'Equity';
        if (/Debt/i.test(context.slice(0, 200))) {
          assetType = 'Debt';
        } else if (/Hybrid/i.test(context.slice(0, 200))) {
          assetType = 'Hybrid';
        }

        const returnsMatch = context.match(/Returns[^\d%-]*(-?[\d.]+)\s*%/i);
        const returns = returnsMatch ? parseFloat(returnsMatch[1]) : 0;

        const folioMatch = context.match(/Folio[:\s]*([^\s*]+)/i);
        const folio = folioMatch ? folioMatch[1].replace(/\*+$/, '') : '';

        holdings.push({
          fundName,
          assetType,
          growthType: /IDCW|Dividend/i.test(fundName) ? 'IDCW' : 'Growth',
          category: '',
          invested,
          currentValue,
          returns,
          folio,
          arn: '',
          startDate: '',
          ltcg: 0,
          stcg: 0,
          longTermUnits: 0,
          shortTermUnits: 0,
          isDemat: false,
          transactions: [],
        });
      }
    }

    return holdings;
  }

  private parseIndianNumber(str: string): number {
    if (!str) return 0;
    const cleaned = str.replace(/[₹,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  async importToExternalHoldings(userId: string, portfolio: WealthyPortfolio): Promise<{
    imported: number;
    skipped: number;
    holdings: Array<{ fundName: string; invested: number; currentValue: number }>;
  }> {
    const { storage } = await import('../storage');
    
    let imported = 0;
    let skipped = 0;
    const importedHoldings: Array<{ fundName: string; invested: number; currentValue: number }> = [];

    for (const holding of portfolio.holdings) {
      try {
        const symbol = this.generateSymbol(holding.fundName);
        
        const totalUnits = holding.longTermUnits + holding.shortTermUnits;
        const avgPrice = totalUnits > 0 ? holding.invested / totalUnits : 0;

        await storage.createExternalHolding({
          userId,
          symbol,
          name: holding.fundName,
          isin: null,
          assetType: 'Mutual Fund',
          quantity: totalUnits.toFixed(4),
          avgPrice: avgPrice.toFixed(4),
          currentValue: holding.currentValue.toFixed(2),
          source: 'WEALTHY_IN',
          depository: holding.isDemat ? 'DEMAT' : 'NON-DEMAT',
          dpId: holding.folio || null,
          clientId: portfolio.investor.pan || null,
          cobStatus: 'none',
        });

        imported++;
        importedHoldings.push({
          fundName: holding.fundName,
          invested: holding.invested,
          currentValue: holding.currentValue,
        });
      } catch (error) {
        console.error(`Failed to import holding: ${holding.fundName}`, error);
        skipped++;
      }
    }

    return { imported, skipped, holdings: importedHoldings };
  }

  private generateSymbol(fundName: string): string {
    return fundName
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 4)
      .map(word => word.toUpperCase())
      .join('_')
      .slice(0, 20);
  }
}

export const wealthyImportService = new WealthyImportService();
