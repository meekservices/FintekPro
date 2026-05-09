import { moneyControlScraper, MoneyControlCompany } from './moneycontrol-scraper';
import { storage } from '../storage';
import type { 
  MoneyControlExternalCompany, 
  MoneyControlReconciliationCache,
  MoneyControlReconciliationSuggestion,
  UnlistedCompany
} from '@shared/schema';

const CACHE_TTL_HOURS = 6;

class MoneyControlReconciliationService {
  private cache: MoneyControlReconciliationCache | null = null;
  
  private normalizeForMatch(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(ltd|limited|pvt|private|inc|incorporated|llp|llc|india|co|company)\b/gi, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
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

  private calculateMatchScore(name1: string, name2: string): number {
    const normalized1 = this.normalizeForMatch(name1);
    const normalized2 = this.normalizeForMatch(name2);

    if (normalized1 === normalized2) return 100;

    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      const longerLen = Math.max(normalized1.length, normalized2.length);
      const shorterLen = Math.min(normalized1.length, normalized2.length);
      return Math.round((shorterLen / longerLen) * 90);
    }

    const distance = this.levenshteinDistance(normalized1, normalized2);
    const maxLen = Math.max(normalized1.length, normalized2.length);
    return Math.max(0, Math.round((1 - distance / maxLen) * 100));
  }

  async fetchAndCacheMoneyControlCompanies(forceRefresh: boolean = false): Promise<MoneyControlExternalCompany[]> {
    const now = new Date();

    if (!forceRefresh && this.cache && this.cache.expiresAt > now) {
      console.log(`[MC Reconciliation] Using cached data (${this.cache.companies.length} companies, expires ${this.cache.expiresAt.toISOString()})`);
      return this.cache.companies;
    }

    console.log('[MC Reconciliation] Fetching fresh data from MoneyControl...');
    
    try {
      const mcCompanies = await moneyControlScraper.scrapeUnlistedPrices();
      
      const externalCompanies: MoneyControlExternalCompany[] = mcCompanies.map(mc => ({
        name: mc.name,
        isin: mc.isin,
        price: mc.price,
        change: mc.change,
        changePercent: mc.changePercent,
        previousClose: mc.previousClose,
        scrapedAt: now,
      }));

      this.cache = {
        companies: externalCompanies,
        scrapedAt: now,
        expiresAt: new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000),
        source: 'moneycontrol.com',
      };

      console.log(`[MC Reconciliation] Cached ${externalCompanies.length} companies from MoneyControl`);
      return externalCompanies;
    } catch (error: any) {
      console.error('[MC Reconciliation] Failed to fetch MoneyControl data:', error.message);
      throw error;
    }
  }

  async getReconciliationSuggestions(forceRefresh: boolean = false): Promise<{
    suggestions: MoneyControlReconciliationSuggestion[];
    cacheInfo: {
      scrapedAt: Date;
      expiresAt: Date;
      totalMoneyControlCompanies: number;
      totalFintekProCompanies: number;
      matchedCount: number;
      unmatchedCount: number;
    };
  }> {
    const mcCompanies = await this.fetchAndCacheMoneyControlCompanies(forceRefresh);
    const fpCompanies = await storage.getAllUnlistedCompanies({});

    console.log(`[MC Reconciliation] Comparing ${mcCompanies.length} MoneyControl companies against ${fpCompanies.length} FintekPro companies`);

    const isinIndex = new Map<string, UnlistedCompany>();
    const nameIndex = new Map<string, UnlistedCompany>();
    
    for (const company of fpCompanies) {
      if (company.isin) {
        isinIndex.set(company.isin.toUpperCase(), company);
      }
      nameIndex.set(this.normalizeForMatch(company.name), company);
    }

    const suggestions: MoneyControlReconciliationSuggestion[] = [];
    let matchedCount = 0;

    for (const mcCompany of mcCompanies) {
      let exactMatch = isinIndex.get(mcCompany.isin.toUpperCase());
      
      if (!exactMatch) {
        const normalizedName = this.normalizeForMatch(mcCompany.name);
        exactMatch = nameIndex.get(normalizedName);
      }

      if (exactMatch) {
        matchedCount++;
        continue;
      }

      const possibleMatches: { companyId: string; companyName: string; matchScore: number }[] = [];
      
      for (const fpCompany of fpCompanies) {
        const score = this.calculateMatchScore(mcCompany.name, fpCompany.name);
        if (score >= 40 && score < 85) {
          possibleMatches.push({
            companyId: fpCompany.id,
            companyName: fpCompany.name,
            matchScore: score,
          });
        }
      }

      possibleMatches.sort((a, b) => b.matchScore - a.matchScore);
      const topMatches = possibleMatches.slice(0, 3);

      let matchConfidence: 'none' | 'low' | 'partial' = 'none';
      if (topMatches.length > 0) {
        if (topMatches[0].matchScore >= 70) {
          matchConfidence = 'partial';
        } else if (topMatches[0].matchScore >= 50) {
          matchConfidence = 'low';
        }
      }

      suggestions.push({
        externalCompany: mcCompany,
        matchConfidence,
        possibleMatches: topMatches,
        status: 'new',
      });
    }

    suggestions.sort((a, b) => {
      const priceSort = b.externalCompany.price - a.externalCompany.price;
      if (a.matchConfidence !== b.matchConfidence) {
        const order = { none: 0, low: 1, partial: 2 };
        return order[a.matchConfidence] - order[b.matchConfidence];
      }
      return priceSort;
    });

    console.log(`[MC Reconciliation] Found ${suggestions.length} unmatched companies (${matchedCount} already synced)`);

    return {
      suggestions,
      cacheInfo: {
        scrapedAt: this.cache?.scrapedAt || new Date(),
        expiresAt: this.cache?.expiresAt || new Date(),
        totalMoneyControlCompanies: mcCompanies.length,
        totalFintekProCompanies: fpCompanies.length,
        matchedCount,
        unmatchedCount: suggestions.length,
      },
    };
  }

  async syncCompanyFromMoneyControl(mcCompany: MoneyControlExternalCompany, adminUserId?: string): Promise<UnlistedCompany> {
    console.log(`[MC Reconciliation] Syncing company: ${mcCompany.name} (ISIN: ${mcCompany.isin})`);

    const existingByIsin = mcCompany.isin ? 
      (await storage.getAllUnlistedCompanies({})).find(c => c.isin?.toUpperCase() === mcCompany.isin.toUpperCase()) :
      null;

    if (existingByIsin) {
      throw new Error(`Company with ISIN ${mcCompany.isin} already exists: ${existingByIsin.name}`);
    }

    const newCompany = await storage.createUnlistedCompany({
      name: mcCompany.name,
      isin: mcCompany.isin || undefined,
      sector: mcCompany.sector || 'Unknown',
      status: 'active',
      listingStage: 'unlisted',
      description: `Imported from MoneyControl on ${new Date().toISOString().split('T')[0]}`,
      createdBy: adminUserId,
      tags: ['moneycontrol-import'],
    });

    if (mcCompany.price > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      await storage.upsertPriceHistory({
        companyId: newCompany.id,
        date: today,
        price: mcCompany.price.toString(),
        sourceType: 'MONEYCONTROL',
        notes: `Initial price from MoneyControl import. ISIN: ${mcCompany.isin}`,
      });
    }

    console.log(`[MC Reconciliation] Successfully synced: ${newCompany.name} (ID: ${newCompany.id})`);
    return newCompany;
  }

  async syncMultipleCompanies(mcCompanies: MoneyControlExternalCompany[], adminUserId?: string): Promise<{
    success: UnlistedCompany[];
    failed: { company: MoneyControlExternalCompany; error: string }[];
  }> {
    const success: UnlistedCompany[] = [];
    const failed: { company: MoneyControlExternalCompany; error: string }[] = [];

    for (const mcCompany of mcCompanies) {
      try {
        const synced = await this.syncCompanyFromMoneyControl(mcCompany, adminUserId);
        success.push(synced);
      } catch (error: any) {
        failed.push({ company: mcCompany, error: error.message });
      }
    }

    return { success, failed };
  }

  /**
   * Lookup the MoneyControl market price for a single company.
   * Matches by ISIN first (exact), then by name similarity (score >= 70).
   * Returns the price as a number, or null if no confident match found.
   * Uses the 6-hour in-memory cache — safe to call per-request.
   */
  async lookupMarketPrice(name: string, isin?: string | null): Promise<number | null> {
    try {
      const mcCompanies = await this.fetchAndCacheMoneyControlCompanies();

      if (isin) {
        const byIsin = mcCompanies.find(c => c.isin?.toUpperCase() === isin.toUpperCase());
        if (byIsin && byIsin.price > 0) return byIsin.price;
      }

      let bestScore = 0;
      let bestPrice: number | null = null;
      for (const mc of mcCompanies) {
        if (!mc.price || mc.price <= 0) continue;
        const score = this.calculateMatchScore(name, mc.name);
        if (score > bestScore) {
          bestScore = score;
          bestPrice = mc.price;
        }
      }

      if (bestScore >= 70 && bestPrice !== null) {
        console.log(`[MC Reconciliation] Price lookup: "${name}" → ₹${bestPrice} (score: ${bestScore})`);
        return bestPrice;
      }

      return null;
    } catch (err: any) {
      console.warn(`[MC Reconciliation] lookupMarketPrice failed for "${name}": ${err.message}`);
      return null;
    }
  }

  getCacheStatus(): { 
    isCached: boolean; 
    scrapedAt: Date | null; 
    expiresAt: Date | null; 
    companyCount: number;
  } {
    if (!this.cache) {
      return { isCached: false, scrapedAt: null, expiresAt: null, companyCount: 0 };
    }

    return {
      isCached: this.cache.expiresAt > new Date(),
      scrapedAt: this.cache.scrapedAt,
      expiresAt: this.cache.expiresAt,
      companyCount: this.cache.companies.length,
    };
  }

  invalidateCache(): void {
    console.log('[MC Reconciliation] Cache invalidated');
    this.cache = null;
  }
}

export const moneyControlReconciliation = new MoneyControlReconciliationService();
