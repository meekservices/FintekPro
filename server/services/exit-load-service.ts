/**
 * Centralized Exit Load Service
 * Provides ISIN/schemeCode-based exit load lookup for all FintekPro services
 * Features: Database lookup, in-memory caching, generic fallback rates
 */

import { db } from "../db";
import { mfSchemeExitLoads, mutualFunds } from "@shared/schema";
import { eq, sql, or } from "drizzle-orm";

// Generic fallback exit load rules when ISIN-specific data is unavailable
const GENERIC_EXIT_LOAD_RULES: Record<string, ExitLoadRule[]> = {
  equity: [
    { minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ],
  debt: [
    { minDays: 0, maxDays: 90, exitLoadPercent: 0.25, description: "0.25% if redeemed within 90 days" },
    { minDays: 91, maxDays: 365, exitLoadPercent: 0.1, description: "0.1% if redeemed within 1 year" },
    { minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ],
  liquid: [
    { minDays: 0, maxDays: 1, exitLoadPercent: 0.0070, description: "0.0070% for Day 1" },
    { minDays: 2, maxDays: 2, exitLoadPercent: 0.0065, description: "0.0065% for Day 2" },
    { minDays: 3, maxDays: 3, exitLoadPercent: 0.0060, description: "0.0060% for Day 3" },
    { minDays: 4, maxDays: 4, exitLoadPercent: 0.0055, description: "0.0055% for Day 4" },
    { minDays: 5, maxDays: 5, exitLoadPercent: 0.0050, description: "0.0050% for Day 5" },
    { minDays: 6, maxDays: 6, exitLoadPercent: 0.0045, description: "0.0045% for Day 6" },
    { minDays: 7, maxDays: null, exitLoadPercent: 0, description: "Nil after 7 days" }
  ],
  overnight: [
    { minDays: 0, maxDays: null, exitLoadPercent: 0, description: "Nil exit load" }
  ],
  elss: [
    { minDays: 0, maxDays: 1095, exitLoadPercent: 0, description: "Lock-in period - 3 years (no exit load but cannot redeem)" },
    { minDays: 1096, maxDays: null, exitLoadPercent: 0, description: "Nil after 3 years" }
  ],
  hybrid_equity: [
    { minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ],
  hybrid_debt: [
    { minDays: 0, maxDays: 365, exitLoadPercent: 0.5, description: "0.5% if redeemed within 1 year" },
    { minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ],
  gold: [
    { minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year" },
    { minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ],
  index: [
    { minDays: 0, maxDays: 7, exitLoadPercent: 0.25, description: "0.25% if redeemed within 7 days" },
    { minDays: 8, maxDays: null, exitLoadPercent: 0, description: "Nil after 7 days" }
  ],
  sectoral: [
    { minDays: 0, maxDays: 30, exitLoadPercent: 0.5, description: "0.5% if redeemed within 30 days" },
    { minDays: 31, maxDays: null, exitLoadPercent: 0, description: "Nil after 30 days" }
  ],
  default: [
    { minDays: 0, maxDays: 365, exitLoadPercent: 1.0, description: "1% if redeemed within 1 year (default)" },
    { minDays: 366, maxDays: null, exitLoadPercent: 0, description: "Nil after 1 year" }
  ]
};

export interface ExitLoadRule {
  minDays: number;
  maxDays: number | null;
  exitLoadPercent: number;
  description: string;
}

export interface ExitLoadResult {
  exitLoadPercent: number;
  exitLoadAmount: number;
  description: string;
  daysToZeroExitLoad: number | null;
  source: 'database' | 'generic';
  fundCategory?: string;
  allTiers: ExitLoadRule[];
}

export interface ExitLoadLookupParams {
  isin?: string;
  schemeCode?: string;
  holdingDays: number;
  redemptionAmount?: number;
  category?: string;
  schemeName?: string;
}

// In-memory cache for exit load data
interface CacheEntry {
  data: ExitLoadRule[];
  timestamp: number;
  source: 'database' | 'generic';
}

class ExitLoadService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get exit load for a fund by ISIN or scheme code
   * Primary method for all FintekPro services
   */
  async getExitLoad(params: ExitLoadLookupParams): Promise<ExitLoadResult> {
    const { isin, schemeCode, holdingDays, redemptionAmount = 0, category, schemeName } = params;

    // Try to get from cache first
    const cacheKey = isin || schemeCode || '';
    const cached = this.getFromCache(cacheKey);
    
    let exitLoadRules: ExitLoadRule[];
    let source: 'database' | 'generic';

    if (cached) {
      exitLoadRules = cached.data;
      source = cached.source;
    } else {
      // Try database lookup
      const dbResult = await this.lookupFromDatabase(isin, schemeCode);
      
      if (dbResult.length > 0) {
        exitLoadRules = dbResult;
        source = 'database';
        this.setCache(cacheKey, exitLoadRules, 'database');
      } else {
        // Fallback to generic rules based on category
        const fundCategory = await this.detectFundCategory(isin, schemeCode, category, schemeName);
        exitLoadRules = this.getGenericRules(fundCategory);
        source = 'generic';
        this.setCache(cacheKey, exitLoadRules, 'generic');
      }
    }

    // Find applicable tier based on holding days
    const applicableTier = this.findApplicableTier(exitLoadRules, holdingDays);
    const exitLoadPercent = applicableTier?.exitLoadPercent || 0;
    const exitLoadAmount = redemptionAmount * (exitLoadPercent / 100);

    // Calculate days to zero exit load
    const daysToZero = this.calculateDaysToZeroExitLoad(exitLoadRules, holdingDays);

    return {
      exitLoadPercent,
      exitLoadAmount: Math.round(exitLoadAmount * 100) / 100,
      description: applicableTier?.description || 'No exit load applicable',
      daysToZeroExitLoad: daysToZero,
      source,
      fundCategory: category,
      allTiers: exitLoadRules
    };
  }

  /**
   * Get exit load timeline for a fund (all tiers)
   */
  async getExitLoadTimeline(isin?: string, schemeCode?: string): Promise<ExitLoadRule[]> {
    const dbResult = await this.lookupFromDatabase(isin, schemeCode);
    if (dbResult.length > 0) {
      return dbResult;
    }
    
    // Return default equity rules if not found
    return GENERIC_EXIT_LOAD_RULES.default;
  }

  /**
   * Calculate exit load amount for a given redemption
   */
  async calculateExitLoadAmount(
    params: ExitLoadLookupParams & { redemptionAmount: number }
  ): Promise<{ exitLoadAmount: number; netRedemption: number; exitLoadPercent: number }> {
    const result = await this.getExitLoad(params);
    return {
      exitLoadAmount: result.exitLoadAmount,
      netRedemption: Math.round((params.redemptionAmount - result.exitLoadAmount) * 100) / 100,
      exitLoadPercent: result.exitLoadPercent
    };
  }

  /**
   * Batch lookup for multiple funds
   */
  async batchGetExitLoads(
    funds: Array<{ isin?: string; schemeCode?: string; holdingDays: number; redemptionAmount?: number; category?: string }>
  ): Promise<Map<string, ExitLoadResult>> {
    const results = new Map<string, ExitLoadResult>();
    
    // Process in parallel
    const promises = funds.map(async (fund) => {
      const key = fund.isin || fund.schemeCode || '';
      const result = await this.getExitLoad(fund);
      results.set(key, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Check if a fund has ISIN-specific exit load data
   */
  async hasSpecificExitLoadData(isin?: string, schemeCode?: string): Promise<boolean> {
    const dbResult = await this.lookupFromDatabase(isin, schemeCode);
    return dbResult.length > 0;
  }

  /**
   * Get statistics about exit load data coverage
   */
  async getDataCoverageStats(): Promise<{
    totalFundsWithExitLoad: number;
    totalUniqueFunds: number;
    coveragePercent: number;
    lastUpdated: Date | null;
  }> {
    const [exitLoadStats] = await db.select({
      count: sql<number>`COUNT(DISTINCT scheme_code)`,
      lastUpdated: sql<Date>`MAX(updated_at)`
    }).from(mfSchemeExitLoads);

    const [fundStats] = await db.select({
      count: sql<number>`COUNT(*)`
    }).from(mutualFunds);

    const totalWithExitLoad = Number(exitLoadStats?.count || 0);
    const totalFunds = Number(fundStats?.count || 0);

    return {
      totalFundsWithExitLoad: totalWithExitLoad,
      totalUniqueFunds: totalFunds,
      coveragePercent: totalFunds > 0 ? Math.round((totalWithExitLoad / totalFunds) * 100 * 100) / 100 : 0,
      lastUpdated: exitLoadStats?.lastUpdated || null
    };
  }

  /**
   * Clear cache (useful after data refresh)
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[ExitLoadService] Cache cleared');
  }

  /**
   * Preload cache for popular funds
   */
  async preloadCache(schemeCodes: string[]): Promise<number> {
    let loaded = 0;
    for (const schemeCode of schemeCodes) {
      const dbResult = await this.lookupFromDatabase(undefined, schemeCode);
      if (dbResult.length > 0) {
        this.setCache(schemeCode, dbResult, 'database');
        loaded++;
      }
    }
    console.log(`[ExitLoadService] Preloaded ${loaded} funds into cache`);
    return loaded;
  }

  // Private methods

  private async lookupFromDatabase(isin?: string, schemeCode?: string): Promise<ExitLoadRule[]> {
    if (!isin && !schemeCode) {
      return [];
    }

    try {
      const conditions = [];
      if (isin) {
        conditions.push(eq(mfSchemeExitLoads.isin, isin));
      }
      if (schemeCode) {
        conditions.push(eq(mfSchemeExitLoads.schemeCode, schemeCode));
      }

      const rows = await db
        .select({
          tier: mfSchemeExitLoads.tier,
          minDays: mfSchemeExitLoads.minDays,
          maxDays: mfSchemeExitLoads.maxDays,
          exitLoadPercent: mfSchemeExitLoads.exitLoadPercent,
          description: mfSchemeExitLoads.description
        })
        .from(mfSchemeExitLoads)
        .where(conditions.length === 1 ? conditions[0] : or(...conditions))
        .orderBy(mfSchemeExitLoads.tier);

      return rows.map(r => ({
        minDays: r.minDays,
        maxDays: r.maxDays,
        exitLoadPercent: parseFloat(r.exitLoadPercent || '0'),
        description: r.description || ''
      }));
    } catch (error) {
      console.error('[ExitLoadService] Database lookup error:', error);
      return [];
    }
  }

  private async detectFundCategory(
    isin?: string,
    schemeCode?: string,
    providedCategory?: string,
    schemeName?: string
  ): Promise<string> {
    // If category is provided, normalize and use it
    if (providedCategory) {
      return this.normalizeFundCategory(providedCategory, schemeName);
    }

    // Try to lookup from mutual funds table
    if (schemeCode || isin) {
      try {
        const [fund] = await db
          .select({ category: mutualFunds.category, schemeName: mutualFunds.schemeName })
          .from(mutualFunds)
          .where(
            schemeCode 
              ? eq(mutualFunds.schemeCode, schemeCode)
              : eq(mutualFunds.isin, isin || '')
          )
          .limit(1);

        if (fund?.category) {
          return this.normalizeFundCategory(fund.category, fund.schemeName || schemeName);
        }
      } catch (error) {
        console.error('[ExitLoadService] Category lookup error:', error);
      }
    }

    return 'default';
  }

  private normalizeFundCategory(category: string, schemeName?: string): string {
    const lowerCategory = category.toLowerCase();
    const lowerName = (schemeName || '').toLowerCase();

    // Check for specific fund types
    if (lowerCategory.includes('liquid') || lowerName.includes('liquid')) {
      return 'liquid';
    }
    if (lowerCategory.includes('overnight') || lowerName.includes('overnight')) {
      return 'overnight';
    }
    if (lowerCategory.includes('elss') || lowerName.includes('elss') || lowerName.includes('tax saver')) {
      return 'elss';
    }
    if (lowerCategory.includes('index') || lowerName.includes('index') || lowerName.includes('nifty') || lowerName.includes('sensex')) {
      return 'index';
    }
    if (lowerCategory.includes('sectoral') || lowerCategory.includes('thematic') || lowerName.includes('sectoral')) {
      return 'sectoral';
    }
    if (lowerCategory.includes('gold') || lowerName.includes('gold')) {
      return 'gold';
    }
    if (lowerCategory.includes('hybrid')) {
      if (lowerCategory.includes('aggressive') || lowerCategory.includes('balanced advantage') || lowerCategory.includes('equity')) {
        return 'hybrid_equity';
      }
      return 'hybrid_debt';
    }
    if (lowerCategory.includes('debt') || lowerCategory.includes('bond') || lowerCategory.includes('gilt') || 
        lowerCategory.includes('money market') || lowerCategory.includes('corporate bond')) {
      return 'debt';
    }
    if (lowerCategory.includes('equity') || lowerCategory.includes('large cap') || lowerCategory.includes('mid cap') ||
        lowerCategory.includes('small cap') || lowerCategory.includes('flexi cap') || lowerCategory.includes('multi cap')) {
      return 'equity';
    }

    return 'default';
  }

  private getGenericRules(category: string): ExitLoadRule[] {
    return GENERIC_EXIT_LOAD_RULES[category] || GENERIC_EXIT_LOAD_RULES.default;
  }

  private findApplicableTier(rules: ExitLoadRule[], holdingDays: number): ExitLoadRule | null {
    return rules.find(tier => 
      holdingDays >= tier.minDays && 
      (tier.maxDays === null || holdingDays <= tier.maxDays)
    ) || null;
  }

  private calculateDaysToZeroExitLoad(rules: ExitLoadRule[], currentHoldingDays: number): number | null {
    // Find the tier where exit load becomes zero
    const zeroLoadTier = rules.find(tier => tier.exitLoadPercent === 0);
    
    if (!zeroLoadTier) {
      return null;
    }

    if (currentHoldingDays >= zeroLoadTier.minDays) {
      return 0; // Already at zero exit load
    }

    return zeroLoadTier.minDays - currentHoldingDays;
  }

  private getFromCache(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if cache is still valid
    if (Date.now() - entry.timestamp > this.CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  private setCache(key: string, data: ExitLoadRule[], source: 'database' | 'generic'): void {
    if (!key) return;
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      source
    });
  }
}

// Export singleton instance
export const exitLoadService = new ExitLoadService();
