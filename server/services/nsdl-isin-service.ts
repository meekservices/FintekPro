// @ts-nocheck
import axios from 'axios';
import { mcaService } from './mca-service';
import { credhiveService } from './credhive-service';

interface ISINRecord {
  isin: string;
  issuerName: string;
  securityDescription: string;
  currency: string;
  interestRate: string;
  maturityDate: string;
  fisn: string;
  cfi: string;
}

interface ISINSearchResult {
  isin: string;
  issuerName: string;
  securityDescription: string;
  securityType: 'equity' | 'debt' | 'preference' | 'warrant' | 'other';
  matchScore: number;
}

class NSDLISINService {
  private cachedData: ISINRecord[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  private getMonthAbbreviation(month: number): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month];
  }

  private getCSVUrl(): string {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = this.getMonthAbbreviation(now.getMonth());
    const year = now.getFullYear();
    return `https://nsdl.co.in/downloadables/excel/cp-debt/ISIN_DETAILS_${day}-${month}-${year}.csv`;
  }

  private async downloadCSV(): Promise<string> {
    const url = this.getCSVUrl();
    console.log(`[NSDL ISIN Service] Downloading CSV from: ${url}`);
    
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/csv,application/csv,text/plain,*/*',
        },
        timeout: 60000,
        responseType: 'text',
      });
      
      return response.data;
    } catch (error: any) {
      // Try previous day if today's file is not available
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const day = yesterday.getDate().toString().padStart(2, '0');
      const month = this.getMonthAbbreviation(yesterday.getMonth());
      const year = yesterday.getFullYear();
      const fallbackUrl = `https://nsdl.co.in/downloadables/excel/cp-debt/ISIN_DETAILS_${day}-${month}-${year}.csv`;
      
      console.log(`[NSDL ISIN Service] Trying fallback URL: ${fallbackUrl}`);
      
      const response = await axios.get(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/csv,application/csv,text/plain,*/*',
        },
        timeout: 60000,
        responseType: 'text',
      });
      
      return response.data;
    }
  }

  private parseCSV(csvData: string): ISINRecord[] {
    const lines = csvData.split('\n');
    const records: ISINRecord[] = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse CSV with quoted fields
      const fields = this.parseCSVLine(line);
      
      if (fields.length >= 8) {
        records.push({
          isin: fields[0].replace(/"/g, ''),
          issuerName: fields[1].replace(/"/g, ''),
          securityDescription: fields[2].replace(/"/g, ''),
          currency: fields[3].replace(/"/g, ''),
          interestRate: fields[4].replace(/"/g, ''),
          maturityDate: fields[5].replace(/"/g, ''),
          fisn: fields[6].replace(/"/g, ''),
          cfi: fields[7].replace(/"/g, ''),
        });
      }
    }
    
    console.log(`[NSDL ISIN Service] Parsed ${records.length} ISIN records`);
    return records;
  }

  private parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    fields.push(current);
    return fields;
  }

  private async ensureDataLoaded(): Promise<ISINRecord[]> {
    const now = Date.now();
    
    if (this.cachedData && (now - this.cacheTimestamp) < this.CACHE_DURATION_MS) {
      return this.cachedData;
    }
    
    console.log('[NSDL ISIN Service] Refreshing ISIN data cache...');
    const csvData = await this.downloadCSV();
    this.cachedData = this.parseCSV(csvData);
    this.cacheTimestamp = now;
    
    return this.cachedData;
  }

  private getSecurityType(description: string, cfi: string): 'equity' | 'debt' | 'preference' | 'warrant' | 'other' {
    const descUpper = description.toUpperCase();
    const cfiUpper = cfi.toUpperCase();
    
    if (descUpper.includes(' EQ') || descUpper.endsWith(' EQ') || cfiUpper.startsWith('ES')) {
      return 'equity';
    }
    if (descUpper.includes('PREF') || cfiUpper.startsWith('EP') || cfiUpper.startsWith('EF')) {
      return 'preference';
    }
    if (descUpper.includes('WARRANT') || cfiUpper.startsWith('RW')) {
      return 'warrant';
    }
    if (descUpper.includes('NCD') || descUpper.includes('BD') || descUpper.includes('LOA') || 
        descUpper.includes('DEB') || cfiUpper.startsWith('DB') || cfiUpper.startsWith('DC') || cfiUpper.startsWith('DY')) {
      return 'debt';
    }
    
    return 'other';
  }

  private calculateMatchScore(searchTerm: string, issuerName: string): number {
    const searchLower = searchTerm.toLowerCase().trim();
    const nameLower = issuerName.toLowerCase().trim();
    
    // Exact match
    if (nameLower === searchLower) {
      return 100;
    }
    
    // Name starts with search term
    if (nameLower.startsWith(searchLower)) {
      return 90;
    }
    
    // Name contains search term as whole word
    const searchWords = searchLower.split(/\s+/);
    const nameWords = nameLower.split(/\s+/);
    
    let matchedWords = 0;
    for (const searchWord of searchWords) {
      if (nameWords.some(nameWord => nameWord === searchWord || nameWord.startsWith(searchWord))) {
        matchedWords++;
      }
    }
    
    if (matchedWords === searchWords.length) {
      return 80;
    }
    
    // Partial match
    if (nameLower.includes(searchLower)) {
      return 70;
    }
    
    // Any word matches
    if (matchedWords > 0) {
      return 50 + (matchedWords / searchWords.length) * 20;
    }
    
    return 0;
  }

  async searchByCompanyName(companyName: string, options?: {
    securityType?: 'equity' | 'debt' | 'preference' | 'warrant' | 'all';
    limit?: number;
  }): Promise<ISINSearchResult[]> {
    const data = await this.ensureDataLoaded();
    const securityType = options?.securityType || 'equity';
    const limit = options?.limit || 10;
    
    const results: ISINSearchResult[] = [];
    
    for (const record of data) {
      const matchScore = this.calculateMatchScore(companyName, record.issuerName);
      
      if (matchScore > 40) {
        const recordSecurityType = this.getSecurityType(record.securityDescription, record.cfi);
        
        // Filter by security type if specified
        if (securityType !== 'all' && recordSecurityType !== securityType) {
          continue;
        }
        
        results.push({
          isin: record.isin,
          issuerName: record.issuerName,
          securityDescription: record.securityDescription,
          securityType: recordSecurityType,
          matchScore,
        });
      }
    }
    
    // Sort by match score (descending) and then by issuer name
    results.sort((a, b) => {
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return a.issuerName.localeCompare(b.issuerName);
    });
    
    // Remove duplicates (same issuer might have multiple ISINs)
    const uniqueIssuers = new Map<string, ISINSearchResult>();
    for (const result of results) {
      const key = result.issuerName.toLowerCase();
      if (!uniqueIssuers.has(key)) {
        uniqueIssuers.set(key, result);
      }
    }
    
    return Array.from(uniqueIssuers.values()).slice(0, limit);
  }

  async getISINByExactName(companyName: string, securityType: 'equity' | 'all' = 'equity'): Promise<string | null> {
    const results = await this.searchByCompanyName(companyName, { 
      securityType,
      limit: 1 
    });
    
    if (results.length > 0 && results[0].matchScore >= 70) {
      return results[0].isin;
    }
    
    return null;
  }

  async refreshCache(): Promise<{ recordCount: number; timestamp: Date }> {
    const csvData = await this.downloadCSV();
    this.cachedData = this.parseCSV(csvData);
    this.cacheTimestamp = Date.now();
    
    return {
      recordCount: this.cachedData.length,
      timestamp: new Date(this.cacheTimestamp),
    };
  }

  async lookupByISIN(isin: string): Promise<{
    isin: string;
    issuerName: string;
    securityDescription: string;
    currency: string;
    interestRate: string;
    maturityDate: string;
    fisn: string;
    cfi: string;
    securityType: 'equity' | 'debt' | 'preference' | 'warrant' | 'other';
  } | null> {
    const data = await this.ensureDataLoaded();
    const normalizedISIN = isin.toUpperCase().trim();
    
    const record = data.find(r => r.isin.toUpperCase() === normalizedISIN);
    
    if (!record) {
      return null;
    }
    
    return {
      ...record,
      securityType: this.getSecurityType(record.securityDescription, record.cfi),
    };
  }

  async searchByISIN(isinPrefix: string, limit: number = 20): Promise<{
    isin: string;
    issuerName: string;
    securityDescription: string;
    securityType: 'equity' | 'debt' | 'preference' | 'warrant' | 'other';
    interestRate: string;
    maturityDate: string;
  }[]> {
    const data = await this.ensureDataLoaded();
    const normalizedPrefix = isinPrefix.toUpperCase().trim();
    
    const results = data
      .filter(r => r.isin.toUpperCase().startsWith(normalizedPrefix))
      .slice(0, limit)
      .map(record => ({
        isin: record.isin,
        issuerName: record.issuerName,
        securityDescription: record.securityDescription,
        securityType: this.getSecurityType(record.securityDescription, record.cfi),
        interestRate: record.interestRate,
        maturityDate: record.maturityDate,
      }));
    
    return results;
  }

  parseMaturityDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    // Format: DD-Mon-YYYY (e.g., "15-Jan-2030")
    const parts = dateStr.match(/(\d{1,2})-(\w{3})-(\d{4})/);
    if (parts) {
      const months: Record<string, number> = {
        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
      };
      const day = parseInt(parts[1]);
      const month = months[parts[2]];
      const year = parseInt(parts[3]);
      if (!isNaN(day) && month !== undefined && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    
    // Try standard ISO format
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }

  determineInstrumentType(securityDescription: string, issuerName: string): string {
    const desc = securityDescription.toUpperCase();
    const issuer = issuerName.toUpperCase();
    
    if (desc.includes('GOVT') || desc.includes('GOI') || issuer.includes('GOVERNMENT OF INDIA')) {
      if (desc.includes('T-BILL') || desc.includes('TBILL') || desc.includes('TREASURY BILL')) {
        return 'tbill';
      }
      if (desc.includes('SGB') || desc.includes('SOVEREIGN GOLD')) {
        return 'sgb';
      }
      return 'gsec';
    }
    
    if (issuer.includes('STATE') && (desc.includes('SDL') || desc.includes('STATE DEV'))) {
      return 'sdl';
    }
    
    if (desc.includes('NCD') || desc.includes('NON CONVERTIBLE') || desc.includes('DEBENTURE')) {
      return 'ncd';
    }
    
    if (desc.includes('INFRASTRUCTURE') || desc.includes('INFRA BOND')) {
      return 'infrastructure_bond';
    }
    
    if (desc.includes('TAX FREE') || desc.includes('TAX-FREE')) {
      return 'tax_free_bond';
    }
    
    return 'corporate_bond';
  }

  /**
   * ISIN to CIN Lookup - Maps ISIN to Company Identification Number
   * 
   * Flow:
   * 1. Try to get issuer name from NSDL registry
   * 2. Use issuer name to search MCA for CIN
   * 3. Fallback to CredHive search if MCA doesn't find it
   * 
   * @param isin - Indian ISIN (12 character alphanumeric starting with INE)
   * @returns Company identity data including CIN, or null if not found
   */
  async lookupCINByISIN(isin: string): Promise<{
    cin: string;
    companyName: string;
    isin: string;
    source: 'nsdl_mca' | 'nsdl_probe42' | 'mca_direct' | 'probe42_direct';
    confidence: number;
    additionalData?: {
      status?: string;
      registeredAddress?: string;
      incorporationDate?: string;
      authorizedCapital?: string;
      paidUpCapital?: string;
      pan?: string;
    };
  } | null> {
    const normalizedISIN = isin.toUpperCase().trim();
    
    // Validate ISIN format (Indian ISINs start with INE or IN0)
    if (!normalizedISIN.match(/^IN[E0][A-Z0-9]{9}$/)) {
      console.log(`[NSDL ISIN] Invalid ISIN format: ${isin}`);
      return null;
    }

    console.log(`[NSDL ISIN] Looking up CIN for ISIN: ${normalizedISIN}`);

    // Step 1: Try to get issuer name from NSDL registry
    let issuerName: string | null = null;
    try {
      const nsdlRecord = await this.lookupByISIN(normalizedISIN);
      if (nsdlRecord) {
        issuerName = nsdlRecord.issuerName;
        console.log(`[NSDL ISIN] Found issuer in NSDL: ${issuerName}`);
      }
    } catch (error) {
      console.log(`[NSDL ISIN] NSDL lookup failed, continuing with other sources`);
    }

    // Step 2: Try MCA search if we have issuer name
    if (issuerName) {
      try {
        const mcaResult = await mcaService.getCINByCompanyName(issuerName);
        if (mcaResult) {
          console.log(`[NSDL ISIN] Found CIN via MCA: ${mcaResult.cin}`);
          
          // Get full company data from MCA
          const fullData = await mcaService.getCompanyByCIN(mcaResult.cin);
          
          return {
            cin: mcaResult.cin,
            companyName: mcaResult.officialName,
            isin: normalizedISIN,
            source: 'nsdl_mca',
            confidence: 0.95,
            additionalData: fullData ? {
              status: fullData.status,
              registeredAddress: fullData.registeredAddress,
              incorporationDate: fullData.incorporationDate,
              authorizedCapital: fullData.authorizedCapital,
              paidUpCapital: fullData.paidUpCapital,
              pan: fullData.pan,
            } : undefined,
          };
        }
      } catch (error) {
        console.log(`[NSDL ISIN] MCA search failed for "${issuerName}"`);
      }

      // Step 3: Try Credhive search if MCA didn't find it
      try {
        const credhiveResults = await credhiveService.searchCompanyByNameOrCIN(issuerName);
        if (credhiveResults.length > 0) {
          const bestMatch = credhiveResults[0];
          console.log(`[NSDL ISIN] Found CIN via Credhive: ${bestMatch.cin}`);
          
          return {
            cin: bestMatch.cin,
            companyName: bestMatch.company_name,
            isin: normalizedISIN,
            source: 'nsdl_probe42' as const,
            confidence: 0.90,
            additionalData: {
              status: bestMatch.status,
            },
          };
        }
      } catch (error) {
        console.log(`[NSDL ISIN] Credhive search failed for "${issuerName}"`);
      }
    }

    // Step 4: If no issuer name from NSDL, try extracting company hint from ISIN pattern
    // Some ISINs have company identifiers embedded - limited success rate
    console.log(`[NSDL ISIN] Could not find CIN for ISIN: ${normalizedISIN}`);
    return null;
  }

  /**
   * Batch ISIN to CIN lookup for multiple ISINs
   * Used for MoneyControl bulk import
   */
  async batchLookupCINByISIN(isins: string[]): Promise<Map<string, {
    cin: string;
    companyName: string;
    source: string;
    confidence: number;
  } | null>> {
    const results = new Map<string, {
      cin: string;
      companyName: string;
      source: string;
      confidence: number;
    } | null>();

    console.log(`[NSDL ISIN] Batch lookup for ${isins.length} ISINs`);

    for (const isin of isins) {
      try {
        const result = await this.lookupCINByISIN(isin);
        results.set(isin, result ? {
          cin: result.cin,
          companyName: result.companyName,
          source: result.source,
          confidence: result.confidence,
        } : null);
        
        // Rate limiting - small delay between lookups
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[NSDL ISIN] Error looking up ${isin}:`, error);
        results.set(isin, null);
      }
    }

    const found = Array.from(results.values()).filter(v => v !== null).length;
    console.log(`[NSDL ISIN] Batch complete: ${found}/${isins.length} CINs found`);

    return results;
  }
}

export const nsdlISINService = new NSDLISINService();
