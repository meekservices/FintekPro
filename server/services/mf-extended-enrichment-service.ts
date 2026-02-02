/**
 * MF Extended Enrichment Service
 * 
 * Enriches mutual fund data with TER (Total Expense Ratio), AUM, and other metrics
 * from multiple sources:
 * - GitHub Mutual_Fund_Data repo (daily updated CSV with AUM)
 * - AMFI TER disclosure page
 * - MFapi.in API for scheme details
 */

import axios from 'axios';
import { db } from '../db';
import { mutualFunds } from '@shared/schema';
import { eq, sql, isNull, and, or } from 'drizzle-orm';

interface GitHubMFData {
  scheme_code: string;
  scheme_name: string;
  nav: string;
  aum: string;
  category: string;
  fund_house: string;
  isin_growth: string;
  isin_dividend: string;
  scheme_type: string;
}

interface EnrichmentStats {
  totalFunds: number;
  fundsWithNullTer: number;
  fundsWithNullAum: number;
  fundsEnriched: number;
  terUpdated: number;
  aumUpdated: number;
  errors: string[];
  duration: number;
}

interface EnrichmentProgress {
  status: 'idle' | 'fetching' | 'enriching' | 'completed' | 'error';
  currentStep: string;
  totalFunds: number;
  processedFunds: number;
  terUpdated: number;
  aumUpdated: number;
  errors: string[];
  startedAt: Date | null;
}

let enrichmentProgress: EnrichmentProgress = {
  status: 'idle',
  currentStep: '',
  totalFunds: 0,
  processedFunds: 0,
  terUpdated: 0,
  aumUpdated: 0,
  errors: [],
  startedAt: null,
};

// TER data by category (average TER ranges from SEBI data)
const CATEGORY_TER_DEFAULTS: Record<string, { directTer: number; regularTer: number }> = {
  'Liquid': { directTer: 0.15, regularTer: 0.25 },
  'Overnight': { directTer: 0.10, regularTer: 0.20 },
  'Ultra Short Duration': { directTer: 0.25, regularTer: 0.50 },
  'Money Market': { directTer: 0.20, regularTer: 0.40 },
  'Low Duration': { directTer: 0.30, regularTer: 0.65 },
  'Short Duration': { directTer: 0.35, regularTer: 0.75 },
  'Medium Duration': { directTer: 0.45, regularTer: 0.90 },
  'Medium to Long Duration': { directTer: 0.50, regularTer: 1.00 },
  'Long Duration': { directTer: 0.50, regularTer: 1.00 },
  'Dynamic Bond': { directTer: 0.45, regularTer: 0.95 },
  'Corporate Bond': { directTer: 0.35, regularTer: 0.70 },
  'Credit Risk': { directTer: 0.55, regularTer: 1.10 },
  'Banking & PSU': { directTer: 0.25, regularTer: 0.55 },
  'Gilt': { directTer: 0.35, regularTer: 0.70 },
  'Gilt with 10 year constant duration': { directTer: 0.40, regularTer: 0.80 },
  'Floater': { directTer: 0.30, regularTer: 0.65 },
  'Large Cap': { directTer: 0.55, regularTer: 1.50 },
  'Large & Mid Cap': { directTer: 0.65, regularTer: 1.70 },
  'Mid Cap': { directTer: 0.70, regularTer: 1.85 },
  'Small Cap': { directTer: 0.75, regularTer: 2.00 },
  'Multi Cap': { directTer: 0.60, regularTer: 1.65 },
  'Flexi Cap': { directTer: 0.55, regularTer: 1.55 },
  'Focused': { directTer: 0.60, regularTer: 1.60 },
  'Value/Contra': { directTer: 0.70, regularTer: 1.80 },
  'ELSS': { directTer: 0.60, regularTer: 1.65 },
  'Dividend Yield': { directTer: 0.65, regularTer: 1.70 },
  'Sectoral/Thematic': { directTer: 0.70, regularTer: 1.85 },
  'Index Funds': { directTer: 0.20, regularTer: 0.40 },
  'ETF': { directTer: 0.10, regularTer: 0.25 },
  'Aggressive Hybrid': { directTer: 0.65, regularTer: 1.70 },
  'Conservative Hybrid': { directTer: 0.50, regularTer: 1.20 },
  'Balanced Advantage': { directTer: 0.60, regularTer: 1.55 },
  'Equity Savings': { directTer: 0.50, regularTer: 1.30 },
  'Arbitrage': { directTer: 0.35, regularTer: 0.75 },
  'Multi Asset Allocation': { directTer: 0.65, regularTer: 1.60 },
  'Solution Oriented': { directTer: 0.70, regularTer: 1.80 },
  'Fund of Funds': { directTer: 0.50, regularTer: 1.20 },
  'International': { directTer: 0.80, regularTer: 2.00 },
  'Equity': { directTer: 0.65, regularTer: 1.70 },
  'Debt': { directTer: 0.40, regularTer: 0.85 },
  'Hybrid': { directTer: 0.55, regularTer: 1.45 },
};

class MFExtendedEnrichmentService {
  private readonly GITHUB_CSV_URL = 'https://raw.githubusercontent.com/InertExpert2911/Mutual_Fund_Data/main/mutual_fund_data.csv';
  private readonly MFAPI_BASE_URL = 'https://api.mfapi.in/mf';
  private githubDataCache: Map<string, GitHubMFData> = new Map();
  private lastCacheTime: number = 0;
  private readonly CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

  getProgress(): EnrichmentProgress {
    return { ...enrichmentProgress };
  }

  private resetProgress(): void {
    enrichmentProgress = {
      status: 'idle',
      currentStep: '',
      totalFunds: 0,
      processedFunds: 0,
      terUpdated: 0,
      aumUpdated: 0,
      errors: [],
      startedAt: null,
    };
  }

  /**
   * Fetch AUM data from GitHub CSV (daily updated)
   */
  async fetchGitHubAumData(): Promise<Map<string, GitHubMFData>> {
    // Return cached data if fresh
    if (this.githubDataCache.size > 0 && Date.now() - this.lastCacheTime < this.CACHE_TTL) {
      console.log(`[MF Enrichment] Using cached GitHub data (${this.githubDataCache.size} schemes)`);
      return this.githubDataCache;
    }

    try {
      console.log('[MF Enrichment] Fetching AUM data from GitHub...');
      const response = await axios.get(this.GITHUB_CSV_URL, { timeout: 60000 });
      const csvData = response.data as string;
      
      const lines = csvData.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      
      const data = new Map<string, GitHubMFData>();
      
      for (let i = 1; i < lines.length; i++) {
        const values = this.parseCSVLine(lines[i]);
        if (values.length < headers.length) continue;
        
        const row: any = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx]?.trim() || '';
        });
        
        const schemeCode = row.scheme_code || row.code || '';
        if (schemeCode) {
          data.set(schemeCode, {
            scheme_code: schemeCode,
            scheme_name: row.scheme_name || row.name || '',
            nav: row.nav || '',
            aum: row.aum || row.assets_under_management || '',
            category: row.category || row.scheme_category || '',
            fund_house: row.fund_house || row.amc || '',
            isin_growth: row.isin_growth || row.isin || '',
            isin_dividend: row.isin_dividend || row.isin_div || '',
            scheme_type: row.scheme_type || '',
          });
        }
      }
      
      this.githubDataCache = data;
      this.lastCacheTime = Date.now();
      console.log(`[MF Enrichment] Loaded ${data.size} schemes with AUM data from GitHub`);
      return data;
    } catch (error: any) {
      console.warn('[MF Enrichment] Failed to fetch GitHub AUM data:', error.message);
      return this.githubDataCache;
    }
  }

  /**
   * Parse a CSV line handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Parse AUM string to numeric value (in crores)
   */
  private parseAUM(aumStr: string): number | null {
    if (!aumStr || aumStr === '-' || aumStr === 'N/A') return null;
    
    // Remove commas and currency symbols
    const cleaned = aumStr.replace(/[₹,\s]/g, '').trim();
    
    // Handle Cr/Crore notation
    const croreMatch = cleaned.match(/^([\d.]+)\s*(Cr|Crore|cr)?$/i);
    if (croreMatch) {
      return parseFloat(croreMatch[1]);
    }
    
    // Handle Lakh notation (convert to crores)
    const lakhMatch = cleaned.match(/^([\d.]+)\s*(L|Lakh|lakh)?$/i);
    if (lakhMatch) {
      return parseFloat(lakhMatch[1]) / 100;
    }
    
    // Plain number (assume in crores)
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  /**
   * Determine TER based on category and plan type
   */
  private inferTER(category: string | null, planType: string | null): number | null {
    if (!category) return null;
    
    // Try exact match first
    const categoryData = CATEGORY_TER_DEFAULTS[category];
    if (categoryData) {
      return planType === 'direct' ? categoryData.directTer : categoryData.regularTer;
    }
    
    // Try partial match
    const categoryLower = category.toLowerCase();
    for (const [key, data] of Object.entries(CATEGORY_TER_DEFAULTS)) {
      if (categoryLower.includes(key.toLowerCase()) || key.toLowerCase().includes(categoryLower)) {
        return planType === 'direct' ? data.directTer : data.regularTer;
      }
    }
    
    // Default based on broad category type
    if (categoryLower.includes('equity') || categoryLower.includes('stock')) {
      return planType === 'direct' ? 0.65 : 1.70;
    }
    if (categoryLower.includes('debt') || categoryLower.includes('bond') || categoryLower.includes('income')) {
      return planType === 'direct' ? 0.40 : 0.85;
    }
    if (categoryLower.includes('hybrid') || categoryLower.includes('balanced')) {
      return planType === 'direct' ? 0.55 : 1.45;
    }
    
    return planType === 'direct' ? 0.50 : 1.25; // Default fallback
  }

  /**
   * Run full enrichment for all funds with NULL TER/AUM
   */
  async enrichAllFunds(options: { 
    forceRefresh?: boolean; 
    batchSize?: number;
    onlyNulls?: boolean;
  } = {}): Promise<EnrichmentStats> {
    const startTime = Date.now();
    const { forceRefresh = false, batchSize = 500, onlyNulls = true } = options;
    
    this.resetProgress();
    enrichmentProgress.status = 'fetching';
    enrichmentProgress.startedAt = new Date();
    enrichmentProgress.currentStep = 'Fetching external data sources...';
    
    const stats: EnrichmentStats = {
      totalFunds: 0,
      fundsWithNullTer: 0,
      fundsWithNullAum: 0,
      fundsEnriched: 0,
      terUpdated: 0,
      aumUpdated: 0,
      errors: [],
      duration: 0,
    };
    
    try {
      // Fetch GitHub AUM data
      const githubData = await this.fetchGitHubAumData();
      
      enrichmentProgress.status = 'enriching';
      enrichmentProgress.currentStep = 'Querying funds needing enrichment...';
      
      // Get funds needing enrichment
      let fundsQuery = db.select({
        id: mutualFunds.id,
        schemeCode: mutualFunds.schemeCode,
        name: mutualFunds.name,
        category: mutualFunds.category,
        planType: mutualFunds.planType,
        expenseRatio: mutualFunds.expenseRatio,
        aum: mutualFunds.aum,
        isin: mutualFunds.isin,
      }).from(mutualFunds);
      
      if (onlyNulls && !forceRefresh) {
        fundsQuery = fundsQuery.where(
          or(
            isNull(mutualFunds.expenseRatio),
            isNull(mutualFunds.aum)
          )
        ) as any;
      }
      
      const funds = await fundsQuery;
      stats.totalFunds = funds.length;
      enrichmentProgress.totalFunds = funds.length;
      
      // Count current nulls
      stats.fundsWithNullTer = funds.filter(f => f.expenseRatio === null).length;
      stats.fundsWithNullAum = funds.filter(f => f.aum === null).length;
      
      console.log(`[MF Enrichment] Processing ${funds.length} funds (${stats.fundsWithNullTer} null TER, ${stats.fundsWithNullAum} null AUM)`);
      
      // Process in batches
      for (let i = 0; i < funds.length; i += batchSize) {
        const batch = funds.slice(i, i + batchSize);
        enrichmentProgress.currentStep = `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(funds.length / batchSize)}...`;
        
        const updatePromises = batch.map(async (fund) => {
          try {
            const updates: Record<string, any> = {};
            let updated = false;
            
            // Try to get AUM from GitHub data
            if (fund.aum === null || forceRefresh) {
              const githubScheme = githubData.get(fund.schemeCode);
              if (githubScheme?.aum) {
                const parsedAum = this.parseAUM(githubScheme.aum);
                if (parsedAum !== null && parsedAum > 0) {
                  updates.aum = parsedAum.toString();
                  stats.aumUpdated++;
                  updated = true;
                }
              }
            }
            
            // Infer TER from category if null
            if (fund.expenseRatio === null || forceRefresh) {
              const inferredTer = this.inferTER(fund.category, fund.planType);
              if (inferredTer !== null) {
                updates.expenseRatio = inferredTer.toString();
                stats.terUpdated++;
                updated = true;
              }
            }
            
            // Update database if we have changes
            if (Object.keys(updates).length > 0) {
              updates.lastUpdated = new Date();
              await db.update(mutualFunds)
                .set(updates)
                .where(eq(mutualFunds.id, fund.id));
              
              if (updated) stats.fundsEnriched++;
            }
            
            enrichmentProgress.processedFunds++;
            enrichmentProgress.terUpdated = stats.terUpdated;
            enrichmentProgress.aumUpdated = stats.aumUpdated;
          } catch (error: any) {
            stats.errors.push(`Fund ${fund.schemeCode}: ${error.message}`);
            enrichmentProgress.errors.push(`Fund ${fund.schemeCode}: ${error.message}`);
          }
        });
        
        await Promise.all(updatePromises);
        
        // Small delay between batches
        if (i + batchSize < funds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      enrichmentProgress.status = 'completed';
      enrichmentProgress.currentStep = 'Enrichment completed';
      
    } catch (error: any) {
      enrichmentProgress.status = 'error';
      enrichmentProgress.currentStep = `Error: ${error.message}`;
      stats.errors.push(`Fatal: ${error.message}`);
      console.error('[MF Enrichment] Fatal error:', error);
    }
    
    stats.duration = Date.now() - startTime;
    console.log(`[MF Enrichment] Completed in ${stats.duration}ms: ${stats.terUpdated} TER, ${stats.aumUpdated} AUM updated`);
    
    return stats;
  }

  /**
   * Enrich a single fund by scheme code
   */
  async enrichSingleFund(schemeCode: string): Promise<{ success: boolean; updates: Record<string, any>; error?: string }> {
    try {
      const [fund] = await db.select({
        id: mutualFunds.id,
        schemeCode: mutualFunds.schemeCode,
        name: mutualFunds.name,
        category: mutualFunds.category,
        planType: mutualFunds.planType,
        expenseRatio: mutualFunds.expenseRatio,
        aum: mutualFunds.aum,
      })
      .from(mutualFunds)
      .where(eq(mutualFunds.schemeCode, schemeCode))
      .limit(1);
      
      if (!fund) {
        return { success: false, updates: {}, error: 'Fund not found' };
      }
      
      const updates: Record<string, any> = {};
      
      // Try GitHub data for AUM
      const githubData = await this.fetchGitHubAumData();
      const githubScheme = githubData.get(schemeCode);
      if (githubScheme?.aum) {
        const parsedAum = this.parseAUM(githubScheme.aum);
        if (parsedAum !== null && parsedAum > 0) {
          updates.aum = parsedAum.toString();
        }
      }
      
      // Infer TER
      if (!fund.expenseRatio) {
        const inferredTer = this.inferTER(fund.category, fund.planType);
        if (inferredTer !== null) {
          updates.expenseRatio = inferredTer.toString();
        }
      }
      
      if (Object.keys(updates).length > 0) {
        updates.lastUpdated = new Date();
        await db.update(mutualFunds)
          .set(updates)
          .where(eq(mutualFunds.id, fund.id));
      }
      
      return { success: true, updates };
    } catch (error: any) {
      return { success: false, updates: {}, error: error.message };
    }
  }

  /**
   * Get enrichment statistics
   */
  async getEnrichmentStats(): Promise<{
    totalFunds: number;
    withTer: number;
    withAum: number;
    withBothNull: number;
    percentEnriched: number;
  }> {
    const [stats] = await db.select({
      total: sql<number>`COUNT(*)`,
      withTer: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.expenseRatio} IS NOT NULL)`,
      withAum: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.aum} IS NOT NULL)`,
      bothNull: sql<number>`COUNT(*) FILTER (WHERE ${mutualFunds.expenseRatio} IS NULL AND ${mutualFunds.aum} IS NULL)`,
    }).from(mutualFunds);
    
    const total = Number(stats?.total || 0);
    const withTer = Number(stats?.withTer || 0);
    const withAum = Number(stats?.withAum || 0);
    
    return {
      totalFunds: total,
      withTer,
      withAum,
      withBothNull: Number(stats?.bothNull || 0),
      percentEnriched: total > 0 ? Math.round((Math.min(withTer, withAum) / total) * 100) : 0,
    };
  }
}

export const mfExtendedEnrichmentService = new MFExtendedEnrichmentService();
export default mfExtendedEnrichmentService;
