import axios from 'axios';
import * as cheerio from 'cheerio';
import { storage } from '../storage';
import type { InsertUnlistedPriceHistory, InsertUnlistedCompany } from '@shared/schema';
import { nsdlISINService } from './nsdl-isin-service';
import { mcaService } from './mca-service';

export interface MoneyControlCompany {
  name: string;
  isin: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  week1Change?: number;
  month1Change?: number;
  year1Change?: number;
}

export interface PriceImportResult {
  total: number;
  matched: number;
  imported: number;
  skipped: number;
  errors: string[];
  matchedCompanies: {
    moneyControlName: string;
    isin: string;
    matchedTo: string;
    matchedById: string;
    price: number;
    matchType: 'isin' | 'name';
  }[];
  unmatchedCompanies: {
    name: string;
    isin: string;
    price: number;
  }[];
}

class MoneyControlScraperService {
  private readonly baseUrl = 'https://www.moneycontrol.com/markets/unlisted-shares/top-companies/';
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async scrapeUnlistedPrices(): Promise<MoneyControlCompany[]> {
    console.log('[MoneyControl Scraper] Fetching unlisted share prices...');
    
    try {
      const response = await axios.get(this.baseUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      const companies: MoneyControlCompany[] = [];

      $('table tbody tr').each((_, row) => {
        try {
          const $row = $(row);
          const cells = $row.find('td');
          
          if (cells.length < 5) return;

          const imgSrc = $row.find('img').first().attr('src') || '';
          const isinMatch = imgSrc.match(/\/([A-Z0-9]{12})\./);
          const isin = isinMatch ? isinMatch[1] : '';

          const nameCell = $(cells[0]);
          const name = nameCell.text().replace(/\[Invest\].*$/i, '').replace(/!\[.*?\]\(.*?\)/g, '').trim();
          
          const priceText = $(cells[1]).text().replace(/,/g, '').trim();
          const changeText = $(cells[2]).text().replace(/,/g, '').trim();
          const changePercentText = $(cells[3]).text().replace(/,/g, '').trim();
          const prevCloseText = $(cells[4]).text().replace(/,/g, '').trim();

          const price = parseFloat(priceText) || 0;
          const change = parseFloat(changeText) || 0;
          const changePercent = parseFloat(changePercentText) || 0;
          const previousClose = parseFloat(prevCloseText) || 0;

          if (name && price > 0 && isin) {
            companies.push({
              name: this.cleanCompanyName(name),
              isin,
              price,
              change,
              changePercent,
              previousClose,
            });
          }
        } catch (err) {
        }
      });

      console.log(`[MoneyControl Scraper] Found ${companies.length} companies with prices`);
      return companies;
    } catch (error: any) {
      console.error('[MoneyControl Scraper] Error fetching data:', error.message);
      throw new Error(`Failed to fetch MoneyControl data: ${error.message}`);
    }
  }

  private cleanCompanyName(name: string): string {
    return name
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[Invest\].*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async matchAndImportPrices(dryRun: boolean = false): Promise<PriceImportResult> {
    const result: PriceImportResult = {
      total: 0,
      matched: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      matchedCompanies: [],
      unmatchedCompanies: [],
    };

    try {
      const mcCompanies = await this.scrapeUnlistedPrices();
      result.total = mcCompanies.length;

      const ourCompanies = await storage.getAllUnlistedCompanies({});
      
      const isinIndex = new Map<string, typeof ourCompanies[0]>();
      const nameIndex = new Map<string, typeof ourCompanies[0]>();
      
      for (const company of ourCompanies) {
        if (company.isin) {
          isinIndex.set(company.isin.toUpperCase(), company);
        }
        nameIndex.set(this.normalizeForMatch(company.name), company);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const mcCompany of mcCompanies) {
        let matchedCompany = isinIndex.get(mcCompany.isin.toUpperCase());
        let matchType: 'isin' | 'name' = 'isin';

        if (!matchedCompany) {
          const normalizedMcName = this.normalizeForMatch(mcCompany.name);
          matchedCompany = nameIndex.get(normalizedMcName);
          
          if (!matchedCompany) {
            const entries = Array.from(nameIndex.entries());
            for (let i = 0; i < entries.length; i++) {
              const [normalizedName, company] = entries[i];
              if (this.fuzzyMatch(normalizedMcName, normalizedName)) {
                matchedCompany = company;
                break;
              }
            }
          }
          
          if (matchedCompany) {
            matchType = 'name';
          }
        }

        if (matchedCompany) {
          result.matched++;
          result.matchedCompanies.push({
            moneyControlName: mcCompany.name,
            isin: mcCompany.isin,
            matchedTo: matchedCompany.name,
            matchedById: matchedCompany.id,
            price: mcCompany.price,
            matchType,
          });

          if (!dryRun) {
            try {
              const priceData: InsertUnlistedPriceHistory = {
                companyId: matchedCompany.id,
                date: today,
                price: mcCompany.price.toString(),
                sourceType: 'MONEYCONTROL',
                notes: `Auto-imported from MoneyControl. ISIN: ${mcCompany.isin}`,
              };

              await storage.upsertPriceHistory(priceData);
              result.imported++;
            } catch (err: any) {
              result.errors.push(`Failed to import price for ${mcCompany.name}: ${err.message}`);
              result.skipped++;
            }
          }
        } else {
          result.unmatchedCompanies.push({
            name: mcCompany.name,
            isin: mcCompany.isin,
            price: mcCompany.price,
          });
        }
      }

      console.log(`[MoneyControl Scraper] Import complete: ${result.matched} matched, ${result.imported} imported, ${result.unmatchedCompanies.length} unmatched`);
      return result;
    } catch (error: any) {
      result.errors.push(error.message);
      throw error;
    }
  }

  private normalizeForMatch(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(ltd|limited|pvt|private|inc|incorporated|llp|llc)\b/gi, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private fuzzyMatch(name1: string, name2: string): boolean {
    if (name1.includes(name2) || name2.includes(name1)) {
      return true;
    }

    const distance = this.levenshteinDistance(name1, name2);
    const maxLen = Math.max(name1.length, name2.length);
    const similarity = 1 - distance / maxLen;

    return similarity >= 0.8;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + 1
          );
        }
      }
    }

    return dp[m][n];
  }

  async previewImport(): Promise<PriceImportResult> {
    return this.matchAndImportPrices(true);
  }

  async executeImport(): Promise<PriceImportResult> {
    return this.matchAndImportPrices(false);
  }

  /**
   * Search for a company's ISIN from MoneyControl data
   * Returns the best matching ISIN if found
   */
  async searchISINByCompanyName(companyName: string): Promise<{
    isin: string | null;
    matchedName: string | null;
    matchScore: number;
    price: number | null;
  }> {
    try {
      console.log(`[MoneyControl] Searching ISIN for company: ${companyName}`);
      
      const companies = await this.scrapeUnlistedPrices();
      if (companies.length === 0) {
        console.log('[MoneyControl] No companies found in scrape');
        return { isin: null, matchedName: null, matchScore: 0, price: null };
      }

      const normalizedSearchName = this.normalizeForMatch(companyName);
      let bestMatch: { company: MoneyControlCompany; score: number } | null = null;

      for (const company of companies) {
        const normalizedCompanyName = this.normalizeForMatch(company.name);
        
        // Calculate similarity score
        let score = 0;
        
        // Exact match after normalization
        if (normalizedSearchName === normalizedCompanyName) {
          score = 100;
        }
        // One contains the other
        else if (normalizedSearchName.includes(normalizedCompanyName) || normalizedCompanyName.includes(normalizedSearchName)) {
          const longerLen = Math.max(normalizedSearchName.length, normalizedCompanyName.length);
          const shorterLen = Math.min(normalizedSearchName.length, normalizedCompanyName.length);
          score = (shorterLen / longerLen) * 90; // Up to 90% for containment
        }
        // Fuzzy match using Levenshtein
        else {
          const distance = this.levenshteinDistance(normalizedSearchName, normalizedCompanyName);
          const maxLen = Math.max(normalizedSearchName.length, normalizedCompanyName.length);
          score = Math.max(0, (1 - distance / maxLen) * 100);
        }

        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { company, score };
        }
      }

      if (bestMatch && bestMatch.score >= 50) {
        console.log(`[MoneyControl] Found ISIN ${bestMatch.company.isin} for "${companyName}" -> matched "${bestMatch.company.name}" (${bestMatch.score.toFixed(1)}% match)`);
        return {
          isin: bestMatch.company.isin,
          matchedName: bestMatch.company.name,
          matchScore: bestMatch.score,
          price: bestMatch.company.price,
        };
      }

      console.log(`[MoneyControl] No good match found for "${companyName}" (best: ${bestMatch?.score.toFixed(1) || 0}%)`);
      return { isin: null, matchedName: null, matchScore: bestMatch?.score || 0, price: null };
    } catch (error: any) {
      console.error(`[MoneyControl] Error searching ISIN: ${error.message}`);
      return { isin: null, matchedName: null, matchScore: 0, price: null };
    }
  }

  /**
   * IDENTITY ENRICHMENT FLOW
   * For unmatched MoneyControl companies:
   * 1. Use ISIN to lookup CIN via NSDL/MCA/Probe42
   * 2. Get full company profile (legal name, PAN, address, etc.)
   * 3. Create new unlisted company with enriched data
   * 4. Set initial price at 97% of MoneyControl price
   */
  async enrichAndCreateFromMoneyControl(mcCompany: MoneyControlCompany): Promise<{
    success: boolean;
    companyId?: string;
    companyName?: string;
    cin?: string;
    enrichmentSource?: string;
    initialPrice?: number;
    error?: string;
  }> {
    console.log(`\n[MC Enrichment] Starting enrichment for: ${mcCompany.name} (ISIN: ${mcCompany.isin})`);

    try {
      // Step 1: Validate ISIN format
      if (!mcCompany.isin || !mcCompany.isin.match(/^IN[E0][A-Z0-9]{9}$/)) {
        return {
          success: false,
          error: `Invalid ISIN format: ${mcCompany.isin}`,
        };
      }

      // Step 2: Check if company already exists by ISIN
      const existingCompanies = await storage.getAllUnlistedCompanies({});
      const existingByISIN = existingCompanies.find(
        c => c.isin?.toUpperCase() === mcCompany.isin.toUpperCase()
      );
      
      if (existingByISIN) {
        console.log(`[MC Enrichment] Company already exists: ${existingByISIN.name}`);
        return {
          success: true,
          companyId: existingByISIN.id,
          companyName: existingByISIN.name,
          cin: existingByISIN.cin || undefined,
          enrichmentSource: 'existing',
        };
      }

      // Step 3: Lookup CIN using ISIN
      console.log(`[MC Enrichment] Looking up CIN for ISIN: ${mcCompany.isin}`);
      const cinLookup = await nsdlISINService.lookupCINByISIN(mcCompany.isin);
      
      let cin: string | null = null;
      let legalName: string | null = null;
      let pan: string | null = null;
      let registeredAddress: string | null = null;
      let incorporationDate: string | null = null;
      let authorizedCapital: string | null = null;
      let paidUpCapital: string | null = null;
      let status: string = 'active';
      let enrichmentSource = 'moneycontrol_only';

      if (cinLookup) {
        cin = cinLookup.cin;
        legalName = cinLookup.companyName;
        enrichmentSource = cinLookup.source;
        
        if (cinLookup.additionalData) {
          pan = cinLookup.additionalData.pan || null;
          registeredAddress = cinLookup.additionalData.registeredAddress || null;
          incorporationDate = cinLookup.additionalData.incorporationDate || null;
          authorizedCapital = cinLookup.additionalData.authorizedCapital || null;
          paidUpCapital = cinLookup.additionalData.paidUpCapital || null;
          status = cinLookup.additionalData.status || 'active';
        }
        
        console.log(`[MC Enrichment] Found CIN: ${cin}, Legal Name: ${legalName}`);
      } else {
        // Try direct MCA search by company name
        console.log(`[MC Enrichment] CIN lookup failed, trying MCA by name: ${mcCompany.name}`);
        const mcaResult = await mcaService.getCINByCompanyName(mcCompany.name);
        
        if (mcaResult) {
          cin = mcaResult.cin;
          legalName = mcaResult.officialName;
          enrichmentSource = 'mca_name_search';
          
          // Get full MCA data
          const fullMCA = await mcaService.getCompanyByCIN(cin);
          if (fullMCA) {
            pan = fullMCA.pan || null;
            registeredAddress = fullMCA.registeredAddress || null;
            incorporationDate = fullMCA.incorporationDate || null;
            authorizedCapital = fullMCA.authorizedCapital || null;
            paidUpCapital = fullMCA.paidUpCapital || null;
            status = fullMCA.status || 'active';
          }
          console.log(`[MC Enrichment] Found via MCA search: ${cin}`);
        }
      }

      // Step 4: Calculate initial selling price (97% of MoneyControl price)
      const DISCOUNT_FACTOR = 0.97; // 3% below MoneyControl price
      const initialPrice = Math.round(mcCompany.price * DISCOUNT_FACTOR * 100) / 100;
      
      console.log(`[MC Enrichment] Setting initial price: ₹${initialPrice} (97% of MC ₹${mcCompany.price})`);

      // Step 5: Create the unlisted company
      const companyData: InsertUnlistedCompany = {
        name: mcCompany.name,
        companyName: legalName || mcCompany.name,
        legalName: legalName || null,
        cin: cin || null,
        isin: mcCompany.isin,
        pan: pan,
        status: status.toLowerCase().includes('active') ? 'active' : 'inactive',
        currentPrice: initialPrice.toString(),
        previousClose: mcCompany.previousClose?.toString() || null,
        priceChangePercent: mcCompany.changePercent?.toString() || null,
        registeredAddress: registeredAddress,
        incorporationDate: incorporationDate,
        authorizedCapital: authorizedCapital,
        paidUpCapital: paidUpCapital,
        dataSource: 'moneycontrol',
        lastPriceUpdate: new Date(),
        isVerified: false, // Needs admin verification
        tradingEnabled: cin ? true : false, // Only enable trading if CIN found
      };

      const newCompany = await storage.createUnlistedCompany(companyData);
      
      console.log(`[MC Enrichment] Created company: ${newCompany.id} - ${newCompany.name}`);

      // Step 6: Record initial price in history
      const priceHistoryData: InsertUnlistedPriceHistory = {
        companyId: newCompany.id,
        date: new Date(),
        price: initialPrice.toString(),
        sourceType: 'MONEYCONTROL',
        notes: `Initial price from MoneyControl (97% of ₹${mcCompany.price}). Enrichment source: ${enrichmentSource}`,
      };
      
      await storage.upsertPriceHistory(priceHistoryData);

      return {
        success: true,
        companyId: newCompany.id,
        companyName: newCompany.name,
        cin: cin || undefined,
        enrichmentSource,
        initialPrice,
      };

    } catch (error: any) {
      console.error(`[MC Enrichment] Error:`, error);
      return {
        success: false,
        error: error.message || 'Unknown error during enrichment',
      };
    }
  }

  /**
   * Process all unmatched companies from MoneyControl import
   * Enriches identity and creates new companies
   */
  async processUnmatchedCompanies(dryRun: boolean = false): Promise<{
    total: number;
    enriched: number;
    created: number;
    failed: number;
    results: {
      name: string;
      isin: string;
      success: boolean;
      companyId?: string;
      cin?: string;
      source?: string;
      error?: string;
    }[];
  }> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[MC Import] Starting unmatched company processing (dryRun: ${dryRun})`);
    console.log(`${'='.repeat(60)}\n`);

    const importResult = await this.matchAndImportPrices(true); // Always dry run first to get unmatched
    const unmatched = importResult.unmatchedCompanies;

    const result = {
      total: unmatched.length,
      enriched: 0,
      created: 0,
      failed: 0,
      results: [] as {
        name: string;
        isin: string;
        success: boolean;
        companyId?: string;
        cin?: string;
        source?: string;
        error?: string;
      }[],
    };

    console.log(`[MC Import] Found ${unmatched.length} unmatched companies to process`);

    for (const mcCompany of unmatched) {
      if (dryRun) {
        // In dry run, just check if we can enrich
        const cinLookup = await nsdlISINService.lookupCINByISIN(mcCompany.isin);
        result.results.push({
          name: mcCompany.name,
          isin: mcCompany.isin,
          success: cinLookup !== null,
          cin: cinLookup?.cin,
          source: cinLookup?.source,
          error: cinLookup ? undefined : 'CIN lookup failed',
        });
        if (cinLookup) result.enriched++;
        else result.failed++;
      } else {
        // Actually create the company
        const enrichResult = await this.enrichAndCreateFromMoneyControl({
          ...mcCompany,
          change: 0,
          changePercent: 0,
          previousClose: mcCompany.price,
        });
        
        result.results.push({
          name: mcCompany.name,
          isin: mcCompany.isin,
          success: enrichResult.success,
          companyId: enrichResult.companyId,
          cin: enrichResult.cin,
          source: enrichResult.enrichmentSource,
          error: enrichResult.error,
        });

        if (enrichResult.success) {
          result.enriched++;
          if (enrichResult.companyId) result.created++;
        } else {
          result.failed++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[MC Import] Processing complete`);
    console.log(`  Total: ${result.total}`);
    console.log(`  Enriched: ${result.enriched}`);
    console.log(`  Created: ${result.created}`);
    console.log(`  Failed: ${result.failed}`);
    console.log(`${'='.repeat(60)}\n`);

    return result;
  }
}

export const moneyControlScraper = new MoneyControlScraperService();
