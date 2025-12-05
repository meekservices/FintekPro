/**
 * Tofler Integration Service
 * Primary data source for company financials and ratios
 * 
 * Tofler provides:
 * - Company search by name/CIN
 * - Financial statements (Revenue, PAT, Networth)
 * - Financial ratios (P/E, P/B, ROE, ROCE, margins)
 * - Director information
 * 
 * Data Source: Tofler aggregates from MCA and 100+ authoritative sources
 * 
 * Note: Enterprise API requires contacting support@tofler.in
 * This implementation uses web scraping for public data as a fallback
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { 
  InsertCompanyFinancials, 
  InsertCompanyRatios 
} from '@shared/schema';

const TOFLER_BASE_URL = 'https://www.tofler.in';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface ToflerCompanySearchResult {
  name: string;
  cin: string;
  url: string;
  status?: string;
  type?: string;
}

export interface ToflerCompanyDetails {
  name: string;
  cin: string;
  status: string;
  category?: string;
  subcategory?: string;
  classOfCompany?: string;
  dateOfIncorporation?: string;
  rocCode?: string;
  registeredAddress?: string;
  authorizedCapital?: number;
  paidUpCapital?: number;
  listingStatus?: string;
  industry?: string;
  description?: string;
}

export interface ToflerFinancialData {
  financialYear: string;
  revenue?: number;
  pat?: number;
  networth?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  totalDebt?: number;
  ebitda?: number;
  operatingProfit?: number;
  shareCapital?: number;
  reserves?: number;
}

export interface ToflerRatiosData {
  financialYear: string;
  peRatio?: number;
  pbRatio?: number;
  roe?: number;
  roce?: number;
  debtEquity?: number;
  currentRatio?: number;
  marginEbitda?: number;
  marginPat?: number;
  marginOperating?: number;
  assetTurnover?: number;
  returnOnAssets?: number;
}

export interface ToflerCompanyFullData {
  details: ToflerCompanyDetails;
  financials: ToflerFinancialData[];
  ratios: ToflerRatiosData[];
}

class ToflerService {
  private async fetchPage(url: string): Promise<cheerio.CheerioAPI | null> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive',
        },
        timeout: 30000,
      });
      return cheerio.load(response.data);
    } catch (error: any) {
      console.error(`[Tofler] Error fetching ${url}:`, error.message);
      return null;
    }
  }

  /**
   * Search for companies by name on Tofler
   */
  async searchCompanies(query: string): Promise<ToflerCompanySearchResult[]> {
    console.log(`[Tofler] Searching for companies: ${query}`);
    
    const searchUrl = `${TOFLER_BASE_URL}/search?q=${encodeURIComponent(query)}`;
    const $ = await this.fetchPage(searchUrl);
    
    if (!$) {
      console.log('[Tofler] Failed to fetch search results');
      return [];
    }

    const results: ToflerCompanySearchResult[] = [];

    // Parse search results
    $('.company-card, .search-result-item, [class*="company"]').each((_, elem) => {
      const $elem = $(elem);
      const link = $elem.find('a').first();
      const href = link.attr('href') || '';
      const name = link.text().trim() || $elem.find('[class*="name"]').text().trim();
      
      // Extract CIN from URL (format: /company-name/company/CIN)
      const cinMatch = href.match(/\/company\/([A-Z0-9]{21})/i);
      const cin = cinMatch ? cinMatch[1] : '';

      if (name && cin) {
        results.push({
          name,
          cin,
          url: href.startsWith('http') ? href : `${TOFLER_BASE_URL}${href}`,
          status: $elem.find('[class*="status"]').text().trim() || undefined,
          type: $elem.find('[class*="type"]').text().trim() || undefined,
        });
      }
    });

    console.log(`[Tofler] Found ${results.length} companies`);
    return results;
  }

  /**
   * Search company by CIN directly
   */
  async searchByCIN(cin: string): Promise<ToflerCompanySearchResult | null> {
    console.log(`[Tofler] Searching by CIN: ${cin}`);
    
    // Try direct URL pattern: https://www.tofler.in/company-name/company/CIN
    // We'll search and look for exact CIN match
    const results = await this.searchCompanies(cin);
    return results.find(r => r.cin.toLowerCase() === cin.toLowerCase()) || null;
  }

  /**
   * Get full company details including financials and ratios
   */
  async getCompanyDetails(cinOrUrl: string): Promise<ToflerCompanyFullData | null> {
    console.log(`[Tofler] Fetching company details: ${cinOrUrl}`);

    // Determine URL
    let url = cinOrUrl;
    if (!cinOrUrl.startsWith('http')) {
      // It's a CIN, need to find the URL first
      const searchResult = await this.searchByCIN(cinOrUrl);
      if (!searchResult) {
        console.log(`[Tofler] Company not found for CIN: ${cinOrUrl}`);
        return null;
      }
      url = searchResult.url;
    }

    const $ = await this.fetchPage(url);
    if (!$) {
      return null;
    }

    // Parse company details
    const details = this.parseCompanyDetails($);
    if (!details) {
      return null;
    }

    // Parse financials
    const financials = this.parseFinancials($);

    // Parse ratios
    const ratios = this.parseRatios($);

    return {
      details,
      financials,
      ratios,
    };
  }

  private parseCompanyDetails($: cheerio.CheerioAPI): ToflerCompanyDetails | null {
    try {
      const name = $('h1').first().text().trim() || 
                   $('[class*="company-name"]').first().text().trim();
      
      if (!name) {
        return null;
      }

      // Extract CIN from the page
      const cinText = $('body').text();
      const cinMatch = cinText.match(/CIN[:\s]*([A-Z0-9]{21})/i) ||
                       cinText.match(/([UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})/);
      const cin = cinMatch ? cinMatch[1] : '';

      // Parse key-value pairs from company info sections
      const getFieldValue = (labels: string[]): string => {
        for (const label of labels) {
          const regex = new RegExp(`${label}[:\\s]*([^\\n]+)`, 'i');
          const match = $('body').text().match(regex);
          if (match) return match[1].trim();
        }
        return '';
      };

      const parseNumber = (text: string): number | undefined => {
        const cleaned = text.replace(/[₹,\s]/g, '').replace(/cr$/i, '0000000').replace(/lakh$/i, '00000');
        const num = parseFloat(cleaned);
        return isNaN(num) ? undefined : num;
      };

      return {
        name,
        cin,
        status: getFieldValue(['Status', 'Company Status']) || 'Active',
        category: getFieldValue(['Category', 'Company Category']),
        subcategory: getFieldValue(['Sub Category', 'Subcategory']),
        classOfCompany: getFieldValue(['Class', 'Class of Company']),
        dateOfIncorporation: getFieldValue(['Incorporation', 'Date of Incorporation', 'Incorporated']),
        rocCode: getFieldValue(['ROC', 'RoC Code', 'Registrar']),
        registeredAddress: getFieldValue(['Address', 'Registered Address', 'Registered Office']),
        authorizedCapital: parseNumber(getFieldValue(['Authorized Capital', 'Authorised Capital'])),
        paidUpCapital: parseNumber(getFieldValue(['Paid Up Capital', 'Paid-Up Capital'])),
        listingStatus: getFieldValue(['Listed', 'Listing Status']) || 'Unlisted',
        industry: getFieldValue(['Industry', 'Sector', 'Business Activity']),
        description: $('meta[name="description"]').attr('content') || undefined,
      };
    } catch (error: any) {
      console.error('[Tofler] Error parsing company details:', error.message);
      return null;
    }
  }

  private parseFinancials($: cheerio.CheerioAPI): ToflerFinancialData[] {
    const financials: ToflerFinancialData[] = [];

    try {
      // Look for financial tables
      const tables = $('table');
      
      tables.each((_, table) => {
        const $table = $(table);
        const headerText = $table.prev().text().toLowerCase() + 
                          $table.find('th').text().toLowerCase();
        
        // Check if this is a financial statement table
        if (headerText.includes('revenue') || 
            headerText.includes('profit') || 
            headerText.includes('financial')) {
          
          const headers: string[] = [];
          $table.find('thead th, tr:first-child th, tr:first-child td').each((_, th) => {
            headers.push($(th).text().trim());
          });

          // Find year columns (FY patterns like 2023-24, 2022-23, etc.)
          const yearIndices: { year: string; index: number }[] = [];
          headers.forEach((header, index) => {
            const yearMatch = header.match(/\d{4}[-–]\d{2,4}|\d{4}/);
            if (yearMatch) {
              yearIndices.push({ year: yearMatch[0], index });
            }
          });

          // Parse each row
          const parseRow = (rowText: string, indices: typeof yearIndices): { [year: string]: number } => {
            const cells = rowText.split(/\s{2,}|\t/);
            const values: { [year: string]: number } = {};
            indices.forEach(({ year, index }) => {
              if (cells[index]) {
                const num = parseFloat(cells[index].replace(/[₹,\s]/g, ''));
                if (!isNaN(num)) values[year] = num;
              }
            });
            return values;
          };

          $table.find('tbody tr').each((_, row) => {
            const rowText = $(row).text().toLowerCase();
            const cells: string[] = [];
            $(row).find('td').each((_, td) => { cells.push($(td).text().trim()); });
            
            // Match financial metrics
            yearIndices.forEach(({ year, index }) => {
              let data = financials.find(f => f.financialYear === year);
              if (!data) {
                data = { financialYear: year };
                financials.push(data);
              }

              const value = parseFloat((cells[index] || '').replace(/[₹,\s]/g, ''));
              if (isNaN(value)) return;

              const metric = cells[0]?.toLowerCase() || rowText.split(/\s{2,}/)[0];
              
              if (metric.includes('revenue') || metric.includes('sales') || metric.includes('turnover')) {
                data.revenue = value * 10000000; // Convert Cr to absolute
              } else if (metric.includes('pat') || metric.includes('net profit') || metric.includes('profit after')) {
                data.pat = value * 10000000;
              } else if (metric.includes('networth') || metric.includes('net worth') || metric.includes('shareholder')) {
                data.networth = value * 10000000;
              } else if (metric.includes('total asset')) {
                data.totalAssets = value * 10000000;
              } else if (metric.includes('ebitda')) {
                data.ebitda = value * 10000000;
              } else if (metric.includes('debt') || metric.includes('borrowing')) {
                data.totalDebt = value * 10000000;
              }
            });
          });
        }
      });

      // Also try to parse from text patterns
      const pageText = $('body').text();
      const fyPattern = /FY\s*(\d{4}[-–]\d{2,4})/gi;
      let match;
      while ((match = fyPattern.exec(pageText)) !== null) {
        const year = match[1];
        if (!financials.find(f => f.financialYear === year)) {
          financials.push({ financialYear: year });
        }
      }

    } catch (error: any) {
      console.error('[Tofler] Error parsing financials:', error.message);
    }

    console.log(`[Tofler] Parsed ${financials.length} years of financial data`);
    return financials;
  }

  private parseRatios($: cheerio.CheerioAPI): ToflerRatiosData[] {
    const ratios: ToflerRatiosData[] = [];

    try {
      const pageText = $('body').text();

      // Parse ratio values with patterns like "ROE: 15.5%" or "P/E Ratio 25.3"
      const parseRatio = (patterns: RegExp[]): number | undefined => {
        for (const pattern of patterns) {
          const match = pageText.match(pattern);
          if (match) {
            const value = parseFloat(match[1].replace(/[%,]/g, ''));
            if (!isNaN(value)) return value;
          }
        }
        return undefined;
      };

      // Look for ratio sections
      const ratioSection = $('[class*="ratio"], [class*="metric"]').text() || pageText;
      
      // Try to extract latest year's ratios
      const latestRatio: ToflerRatiosData = {
        financialYear: new Date().getFullYear().toString(),
        peRatio: parseRatio([/P\/E\s*(?:Ratio)?[:\s]*([0-9.]+)/i, /PE[:\s]*([0-9.]+)/i]),
        pbRatio: parseRatio([/P\/B\s*(?:Ratio)?[:\s]*([0-9.]+)/i, /Price.?Book[:\s]*([0-9.]+)/i]),
        roe: parseRatio([/ROE[:\s]*([0-9.]+)/i, /Return.?Equity[:\s]*([0-9.]+)/i]),
        roce: parseRatio([/ROCE[:\s]*([0-9.]+)/i, /Return.?Capital[:\s]*([0-9.]+)/i]),
        debtEquity: parseRatio([/Debt.?Equity[:\s]*([0-9.]+)/i, /D\/E[:\s]*([0-9.]+)/i]),
        currentRatio: parseRatio([/Current\s*Ratio[:\s]*([0-9.]+)/i]),
        marginEbitda: parseRatio([/EBITDA\s*Margin[:\s]*([0-9.]+)/i]),
        marginPat: parseRatio([/(?:PAT|Net\s*Profit)\s*Margin[:\s]*([0-9.]+)/i]),
        marginOperating: parseRatio([/Operating\s*(?:Profit\s*)?Margin[:\s]*([0-9.]+)/i]),
      };

      // Only add if we found some ratios
      const hasRatios = Object.values(latestRatio).some(v => v !== undefined && typeof v === 'number');
      if (hasRatios) {
        ratios.push(latestRatio);
      }

      // Also parse from tables similar to financials
      $('table').each((_, table) => {
        const $table = $(table);
        const tableText = $table.text().toLowerCase();
        
        if (tableText.includes('ratio') || tableText.includes('roe') || tableText.includes('roce')) {
          // Parse ratio table
          const headers: string[] = [];
          $table.find('thead th, tr:first-child th').each((_, th) => {
            headers.push($(th).text().trim());
          });

          const yearIndices: { year: string; index: number }[] = [];
          headers.forEach((header, index) => {
            const yearMatch = header.match(/\d{4}/);
            if (yearMatch) {
              yearIndices.push({ year: yearMatch[0], index });
            }
          });

          $table.find('tbody tr').each((_, row) => {
            const cells: string[] = [];
            $(row).find('td').each((_, td) => { cells.push($(td).text().trim()); });
            
            yearIndices.forEach(({ year, index }) => {
              let data = ratios.find(r => r.financialYear === year);
              if (!data) {
                data = { financialYear: year };
                ratios.push(data);
              }

              const value = parseFloat((cells[index] || '').replace(/[%,]/g, ''));
              if (isNaN(value)) return;

              const metric = cells[0]?.toLowerCase() || '';
              
              if (metric.includes('p/e') || metric.includes('pe ratio')) {
                data.peRatio = value;
              } else if (metric.includes('p/b') || metric.includes('pb ratio')) {
                data.pbRatio = value;
              } else if (metric.includes('roe')) {
                data.roe = value / 100; // Convert percentage to decimal
              } else if (metric.includes('roce')) {
                data.roce = value / 100;
              } else if (metric.includes('debt') && metric.includes('equity')) {
                data.debtEquity = value;
              } else if (metric.includes('ebitda') && metric.includes('margin')) {
                data.marginEbitda = value / 100;
              } else if (metric.includes('pat') && metric.includes('margin')) {
                data.marginPat = value / 100;
              }
            });
          });
        }
      });

    } catch (error: any) {
      console.error('[Tofler] Error parsing ratios:', error.message);
    }

    console.log(`[Tofler] Parsed ${ratios.length} years of ratio data`);
    return ratios;
  }

  /**
   * Convert Tofler data to FintekPro schema format
   */
  toFintekProFinancials(
    companyId: string, 
    toflerData: ToflerFinancialData[]
  ): InsertCompanyFinancials[] {
    return toflerData.map(data => ({
      companyId,
      financialYear: data.financialYear,
      revenue: data.revenue?.toString() || null,
      pat: data.pat?.toString() || null,
      networth: data.networth?.toString() || null,
      totalAssets: data.totalAssets?.toString() || null,
      totalLiabilities: data.totalLiabilities?.toString() || null,
      totalDebt: data.totalDebt?.toString() || null,
      ebitda: data.ebitda?.toString() || null,
      shareCapital: data.shareCapital?.toString() || null,
      reserves: data.reserves?.toString() || null,
      periodStart: null,
      periodEnd: null,
      ebit: null,
      pbt: null,
      operatingCashFlow: null,
      investingCashFlow: null,
      financingCashFlow: null,
      freeCashFlow: null,
      grossProfit: null,
      longTermDebt: null,
      shortTermDebt: null,
      dataSource: 'tofler',
    }));
  }

  toFintekProRatios(
    companyId: string, 
    toflerData: ToflerRatiosData[]
  ): InsertCompanyRatios[] {
    return toflerData.map(data => ({
      companyId,
      financialYear: data.financialYear,
      peRatio: data.peRatio?.toString() || null,
      pbRatio: data.pbRatio?.toString() || null,
      roe: data.roe?.toString() || null,
      roce: data.roce?.toString() || null,
      debtEquity: data.debtEquity?.toString() || null,
      currentRatio: data.currentRatio?.toString() || null,
      marginEbitda: data.marginEbitda?.toString() || null,
      marginPat: data.marginPat?.toString() || null,
      marginOperating: data.marginOperating?.toString() || null,
      assetTurnover: data.assetTurnover?.toString() || null,
      roa: data.returnOnAssets?.toString() || null,
      evEbitda: null,
      priceToSales: null,
      debtToAssets: null,
      interestCoverage: null,
      quickRatio: null,
      inventoryTurnover: null,
      receivableTurnover: null,
      dataSource: 'tofler',
    }));
  }
}

export const toflerService = new ToflerService();
