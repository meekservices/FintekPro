import axios from 'axios';

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
}

export const nsdlISINService = new NSDLISINService();
