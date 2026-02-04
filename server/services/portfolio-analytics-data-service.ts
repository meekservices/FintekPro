/**
 * Portfolio Analytics Data Service
 * 
 * Provides real financial metrics for analytics calculations by querying
 * the enriched database. Falls back to category/sector defaults when
 * database data is unavailable.
 * 
 * Data Sources (in priority order):
 * 1. Database (enriched from Yahoo Finance, MFAPI, etc.)
 * 2. Category/Sector defaults (industry averages)
 * 3. Conservative fallback (last resort)
 */

import { db } from '../db';
import { mutualFunds, listedStocks } from '@shared/schema';
import { eq, ilike, or, sql } from 'drizzle-orm';

export interface FinancialMetric {
  value: number;
  source: 'database' | 'category_default' | 'sector_default' | 'fallback';
  confidence: 'high' | 'medium' | 'low';
}

export interface DividendYieldLookup extends FinancialMetric {
  assetType: 'stock' | 'mutual_fund';
}

export interface ExpenseRatioLookup extends FinancialMetric {
  category?: string;
}

// Sector-based dividend yields (NSE/BSE averages)
const SECTOR_DIVIDEND_YIELDS: Record<string, number> = {
  'Information Technology': 1.5,
  'Financial Services': 1.2,
  'Banking': 1.0,
  'NBFC': 0.8,
  'Pharmaceuticals': 0.6,
  'Healthcare': 0.5,
  'Consumer Goods': 1.2,
  'FMCG': 1.4,
  'Automobile': 0.8,
  'Auto Ancillary': 1.0,
  'Capital Goods': 0.9,
  'Industrial': 1.0,
  'Power': 2.5,
  'Energy': 3.0,
  'Oil & Gas': 3.5,
  'Metals & Mining': 2.0,
  'Steel': 1.5,
  'Cement & Construction': 0.7,
  'Realty': 0.5,
  'Telecom': 0.3,
  'Media & Entertainment': 0.6,
  'Chemicals': 1.0,
  'Textiles': 1.2,
  'Hotels & Tourism': 0.4,
  'Default': 1.0,
};

// IDCW/Dividend MF category yields (based on historical payouts)
const MF_DIVIDEND_YIELDS: Record<string, number> = {
  'Dividend Yield': 4.5,
  'Equity': 2.5,
  'Large Cap': 2.0,
  'Mid Cap': 1.5,
  'Small Cap': 1.0,
  'Hybrid': 3.0,
  'Aggressive Hybrid': 2.5,
  'Conservative Hybrid': 4.0,
  'Balanced Advantage': 3.0,
  'Arbitrage': 5.0,
  'Debt': 6.0,
  'Corporate Bond': 6.5,
  'Credit Risk': 7.0,
  'Gilt': 5.5,
  'Money Market': 5.0,
  'Liquid': 4.5,
  'Default': 3.0,
};

// Category TER defaults (SEBI averages)
const CATEGORY_TER_DEFAULTS: Record<string, { direct: number; regular: number }> = {
  'Liquid': { direct: 0.15, regular: 0.25 },
  'Overnight': { direct: 0.10, regular: 0.20 },
  'Ultra Short Duration': { direct: 0.25, regular: 0.50 },
  'Money Market': { direct: 0.20, regular: 0.40 },
  'Low Duration': { direct: 0.30, regular: 0.65 },
  'Short Duration': { direct: 0.35, regular: 0.75 },
  'Medium Duration': { direct: 0.45, regular: 0.90 },
  'Long Duration': { direct: 0.50, regular: 1.00 },
  'Dynamic Bond': { direct: 0.45, regular: 0.95 },
  'Corporate Bond': { direct: 0.35, regular: 0.70 },
  'Credit Risk': { direct: 0.55, regular: 1.10 },
  'Banking & PSU': { direct: 0.25, regular: 0.55 },
  'Gilt': { direct: 0.35, regular: 0.70 },
  'Floater': { direct: 0.30, regular: 0.65 },
  'Large Cap': { direct: 0.55, regular: 1.50 },
  'Large & Mid Cap': { direct: 0.65, regular: 1.70 },
  'Mid Cap': { direct: 0.70, regular: 1.85 },
  'Small Cap': { direct: 0.75, regular: 2.00 },
  'Multi Cap': { direct: 0.60, regular: 1.65 },
  'Flexi Cap': { direct: 0.55, regular: 1.55 },
  'Focused': { direct: 0.60, regular: 1.60 },
  'Value': { direct: 0.70, regular: 1.80 },
  'Contra': { direct: 0.70, regular: 1.80 },
  'ELSS': { direct: 0.60, regular: 1.65 },
  'Dividend Yield': { direct: 0.65, regular: 1.70 },
  'Sectoral': { direct: 0.70, regular: 1.85 },
  'Thematic': { direct: 0.70, regular: 1.85 },
  'Index Funds': { direct: 0.20, regular: 0.40 },
  'ETF': { direct: 0.10, regular: 0.25 },
  'Aggressive Hybrid': { direct: 0.65, regular: 1.70 },
  'Conservative Hybrid': { direct: 0.50, regular: 1.20 },
  'Balanced Advantage': { direct: 0.60, regular: 1.55 },
  'Equity Savings': { direct: 0.50, regular: 1.30 },
  'Arbitrage': { direct: 0.35, regular: 0.75 },
  'Multi Asset Allocation': { direct: 0.65, regular: 1.60 },
  'Fund of Funds': { direct: 0.50, regular: 1.20 },
  'International': { direct: 0.80, regular: 2.00 },
  'Default': { direct: 0.60, regular: 1.50 },
};

// Beta values by sector (calculated from historical data)
const SECTOR_BETA: Record<string, number> = {
  'Information Technology': 1.15,
  'Financial Services': 1.20,
  'Banking': 1.25,
  'NBFC': 1.30,
  'Pharmaceuticals': 0.85,
  'Healthcare': 0.80,
  'Consumer Goods': 0.75,
  'FMCG': 0.70,
  'Automobile': 1.10,
  'Auto Ancillary': 1.15,
  'Capital Goods': 1.20,
  'Industrial': 1.10,
  'Power': 0.95,
  'Energy': 1.05,
  'Oil & Gas': 1.00,
  'Metals & Mining': 1.35,
  'Steel': 1.40,
  'Cement & Construction': 1.10,
  'Realty': 1.45,
  'Telecom': 0.90,
  'Media & Entertainment': 1.05,
  'Chemicals': 1.00,
  'Textiles': 1.10,
  'Hotels & Tourism': 1.20,
  'Default': 1.00,
};

class PortfolioAnalyticsDataService {
  
  /**
   * Get dividend yield for a stock by symbol or ISIN
   */
  async getStockDividendYield(
    symbol?: string, 
    isin?: string, 
    sector?: string
  ): Promise<DividendYieldLookup> {
    try {
      if (symbol || isin) {
        const conditions = [];
        if (symbol) conditions.push(ilike(listedStocks.symbol, symbol));
        if (isin) conditions.push(eq(listedStocks.isin, isin));
        
        const stock = await db.select({
          dividendYield: listedStocks.dividendYield,
          sector: listedStocks.sector,
          broadSector: listedStocks.broadSector,
        })
        .from(listedStocks)
        .where(or(...conditions))
        .limit(1);
        
        if (stock[0]?.dividendYield) {
          return {
            value: parseFloat(stock[0].dividendYield),
            source: 'database',
            confidence: 'high',
            assetType: 'stock',
          };
        }
        
        // Use sector from database record if available
        const stockSector = stock[0]?.broadSector || stock[0]?.sector || sector;
        if (stockSector && SECTOR_DIVIDEND_YIELDS[stockSector]) {
          return {
            value: SECTOR_DIVIDEND_YIELDS[stockSector],
            source: 'sector_default',
            confidence: 'medium',
            assetType: 'stock',
          };
        }
      }
      
      // Sector fallback
      if (sector && SECTOR_DIVIDEND_YIELDS[sector]) {
        return {
          value: SECTOR_DIVIDEND_YIELDS[sector],
          source: 'sector_default',
          confidence: 'medium',
          assetType: 'stock',
        };
      }
      
      // Conservative fallback
      return {
        value: SECTOR_DIVIDEND_YIELDS['Default'],
        source: 'fallback',
        confidence: 'low',
        assetType: 'stock',
      };
    } catch (error) {
      console.error('Error fetching stock dividend yield:', error);
      return {
        value: SECTOR_DIVIDEND_YIELDS['Default'],
        source: 'fallback',
        confidence: 'low',
        assetType: 'stock',
      };
    }
  }
  
  /**
   * Get dividend yield for IDCW/Dividend mutual fund by scheme name or code
   * This is a synchronous function as it uses category-based defaults (no DB lookup)
   */
  getMFDividendYield(
    schemeName?: string, 
    schemeCode?: string,
    category?: string
  ): DividendYieldLookup {
    // For MFs, we use category-based yields since actual payout history
    // varies significantly and is not stored in our database
    const categoryKey = category || this.extractCategoryFromName(schemeName || '');
    
    for (const [key, yieldValue] of Object.entries(MF_DIVIDEND_YIELDS)) {
      if (categoryKey?.toLowerCase().includes(key.toLowerCase())) {
        return {
          value: yieldValue,
          source: 'category_default',
          confidence: 'medium',
          assetType: 'mutual_fund',
        };
      }
    }
    
    return {
      value: MF_DIVIDEND_YIELDS['Default'],
      source: 'fallback',
      confidence: 'low',
      assetType: 'mutual_fund',
    };
  }
  
  /**
   * Get expense ratio for a mutual fund
   */
  async getExpenseRatio(
    schemeName?: string, 
    schemeCode?: string, 
    isin?: string
  ): Promise<ExpenseRatioLookup> {
    try {
      const conditions = [];
      if (schemeCode) conditions.push(eq(mutualFunds.schemeCode, schemeCode));
      if (isin) conditions.push(eq(mutualFunds.isin, isin));
      if (schemeName) conditions.push(ilike(mutualFunds.schemeName, `%${schemeName.slice(0, 30)}%`));
      
      if (conditions.length > 0) {
        const fund = await db.select({
          expenseRatio: mutualFunds.expenseRatio,
          category: mutualFunds.category,
          schemeName: mutualFunds.schemeName,
        })
        .from(mutualFunds)
        .where(or(...conditions))
        .limit(1);
        
        if (fund[0]?.expenseRatio) {
          return {
            value: parseFloat(fund[0].expenseRatio),
            source: 'database',
            confidence: 'high',
            category: fund[0].category || undefined,
          };
        }
        
        // Category fallback
        const category = fund[0]?.category || this.extractCategoryFromName(schemeName || '');
        const isDirectPlan = schemeName?.toLowerCase().includes('direct');
        
        const ter = this.getCategoryTER(category, isDirectPlan);
        return {
          value: ter,
          source: 'category_default',
          confidence: 'medium',
          category,
        };
      }
      
      // Fallback without DB lookup
      const category = this.extractCategoryFromName(schemeName || '');
      const isDirectPlan = schemeName?.toLowerCase().includes('direct');
      
      return {
        value: this.getCategoryTER(category, isDirectPlan),
        source: 'category_default',
        confidence: 'medium',
        category,
      };
    } catch (error) {
      console.error('Error fetching expense ratio:', error);
      return {
        value: 1.50,
        source: 'fallback',
        confidence: 'low',
      };
    }
  }
  
  /**
   * Get beta for a stock
   */
  async getStockBeta(
    symbol?: string, 
    isin?: string, 
    sector?: string
  ): Promise<FinancialMetric> {
    // Beta calculation requires historical price correlation with index
    // For now, use sector-based beta values which are more reliable than random
    const effectiveSector = sector || 'Default';
    
    if (SECTOR_BETA[effectiveSector]) {
      return {
        value: SECTOR_BETA[effectiveSector],
        source: 'sector_default',
        confidence: 'medium',
      };
    }
    
    return {
      value: 1.00,
      source: 'fallback',
      confidence: 'low',
    };
  }
  
  /**
   * Batch get expense ratios for multiple mutual funds - single DB query
   * Returns a map keyed by a composite key (isin|schemeCode|name) for reliable lookup
   */
  async batchGetExpenseRatios(funds: Array<{
    name: string;
    schemeCode?: string;
    isin?: string;
  }>): Promise<Map<string, ExpenseRatioLookup>> {
    const results = new Map<string, ExpenseRatioLookup>();
    
    // Helper to create stable lookup key
    const getKey = (f: { name: string; schemeCode?: string; isin?: string }) => 
      f.isin || f.schemeCode || f.name;
    
    try {
      // Extract scheme codes and ISINs for batch lookup
      const schemeCodes = funds.map(f => f.schemeCode).filter(Boolean) as string[];
      const isins = funds.map(f => f.isin).filter(Boolean) as string[];
      
      // Single batch query
      let dbFunds: Array<{ schemeCode: string | null; isin: string | null; expenseRatio: string | null; category: string | null; schemeName: string | null }> = [];
      
      if (schemeCodes.length > 0 || isins.length > 0) {
        const conditions = [];
        if (schemeCodes.length > 0) {
          conditions.push(sql`${mutualFunds.schemeCode} IN (${sql.join(schemeCodes.map(c => sql`${c}`), sql`, `)})`);
        }
        if (isins.length > 0) {
          conditions.push(sql`${mutualFunds.isin} IN (${sql.join(isins.map(i => sql`${i}`), sql`, `)})`);
        }
        
        dbFunds = await db.select({
          schemeCode: mutualFunds.schemeCode,
          isin: mutualFunds.isin,
          expenseRatio: mutualFunds.expenseRatio,
          category: mutualFunds.category,
          schemeName: mutualFunds.schemeName,
        })
        .from(mutualFunds)
        .where(or(...conditions));
      }
      
      // Create lookup maps for fast matching
      const bySchemeCode = new Map(dbFunds.filter(f => f.schemeCode).map(f => [f.schemeCode!, f]));
      const byIsin = new Map(dbFunds.filter(f => f.isin).map(f => [f.isin!, f]));
      
      // Match each fund to its expense ratio using stable key
      for (const fund of funds) {
        const key = getKey(fund);
        const dbMatch = (fund.isin && byIsin.get(fund.isin)) ||
                       (fund.schemeCode && bySchemeCode.get(fund.schemeCode));
        
        if (dbMatch?.expenseRatio) {
          results.set(key, {
            value: parseFloat(dbMatch.expenseRatio),
            source: 'database',
            confidence: 'high',
            category: dbMatch.category || undefined,
          });
        } else {
          // Category fallback
          const category = this.extractCategoryFromName(fund.name);
          const isDirectPlan = fund.name.toLowerCase().includes('direct');
          results.set(key, {
            value: this.getCategoryTER(category, isDirectPlan),
            source: 'category_default',
            confidence: 'medium',
            category,
          });
        }
      }
    } catch (error) {
      console.error('Error in batch expense ratio lookup:', error);
      // Fallback for all funds
      for (const fund of funds) {
        const key = getKey(fund);
        const category = this.extractCategoryFromName(fund.name);
        const isDirectPlan = fund.name.toLowerCase().includes('direct');
        results.set(key, {
          value: this.getCategoryTER(category, isDirectPlan),
          source: 'fallback',
          confidence: 'low',
          category,
        });
      }
    }
    
    return results;
  }
  
  /**
   * Batch get dividend yields for multiple stocks - single DB query
   * Returns a map keyed by ISIN (or name if no ISIN) for reliable lookup
   */
  async batchGetStockDividendYields(stocks: Array<{
    name: string;
    isin?: string;
    sector?: string;
  }>): Promise<Map<string, DividendYieldLookup>> {
    const results = new Map<string, DividendYieldLookup>();
    
    // Helper to create stable lookup key
    const getKey = (s: { name: string; isin?: string }) => s.isin || s.name;
    
    try {
      const isins = stocks.map(s => s.isin).filter(Boolean) as string[];
      
      let dbStocks: Array<{ isin: string | null; dividendYield: string | null; sector: string | null; broadSector: string | null }> = [];
      
      if (isins.length > 0) {
        dbStocks = await db.select({
          isin: listedStocks.isin,
          dividendYield: listedStocks.dividendYield,
          sector: listedStocks.sector,
          broadSector: listedStocks.broadSector,
        })
        .from(listedStocks)
        .where(sql`${listedStocks.isin} IN (${sql.join(isins.map(i => sql`${i}`), sql`, `)})`);
      }
      
      const byIsin = new Map(dbStocks.filter(s => s.isin).map(s => [s.isin!, s]));
      
      for (const stock of stocks) {
        const key = getKey(stock);
        const dbMatch = stock.isin && byIsin.get(stock.isin);
        
        if (dbMatch?.dividendYield) {
          results.set(key, {
            value: parseFloat(dbMatch.dividendYield),
            source: 'database',
            confidence: 'high',
            assetType: 'stock',
          });
        } else {
          const sector = dbMatch?.broadSector || dbMatch?.sector || stock.sector || 'Default';
          results.set(key, {
            value: SECTOR_DIVIDEND_YIELDS[sector] || SECTOR_DIVIDEND_YIELDS['Default'],
            source: 'sector_default',
            confidence: 'medium',
            assetType: 'stock',
          });
        }
      }
    } catch (error) {
      console.error('Error in batch stock dividend yield lookup:', error);
      for (const stock of stocks) {
        const key = getKey(stock);
        results.set(key, {
          value: SECTOR_DIVIDEND_YIELDS['Default'],
          source: 'fallback',
          confidence: 'low',
          assetType: 'stock',
        });
      }
    }
    
    return results;
  }
  
  /**
   * Get beta values for stocks based on sector (no DB query needed - uses sector defaults)
   * Note: Beta is only meaningful for stocks/equities, not mutual funds
   */
  getBetaForSector(sector?: string): FinancialMetric {
    const effectiveSector = sector || 'Default';
    
    if (SECTOR_BETA[effectiveSector]) {
      return {
        value: SECTOR_BETA[effectiveSector],
        source: 'sector_default',
        confidence: 'medium',
      };
    }
    
    return {
      value: 1.00,
      source: 'fallback',
      confidence: 'low',
    };
  }
  
  // Helper: Extract category from fund name
  private extractCategoryFromName(name: string): string {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('liquid')) return 'Liquid';
    if (nameLower.includes('overnight')) return 'Overnight';
    if (nameLower.includes('index') || nameLower.includes('etf')) return 'Index Funds';
    if (nameLower.includes('large cap') || nameLower.includes('largecap')) return 'Large Cap';
    if (nameLower.includes('mid cap') || nameLower.includes('midcap')) return 'Mid Cap';
    if (nameLower.includes('small cap') || nameLower.includes('smallcap')) return 'Small Cap';
    if (nameLower.includes('flexi cap') || nameLower.includes('flexicap')) return 'Flexi Cap';
    if (nameLower.includes('multi cap') || nameLower.includes('multicap')) return 'Multi Cap';
    if (nameLower.includes('large & mid') || nameLower.includes('large and mid')) return 'Large & Mid Cap';
    if (nameLower.includes('elss') || nameLower.includes('tax saver')) return 'ELSS';
    if (nameLower.includes('balanced') || nameLower.includes('hybrid')) return 'Balanced Advantage';
    if (nameLower.includes('arbitrage')) return 'Arbitrage';
    if (nameLower.includes('gilt')) return 'Gilt';
    if (nameLower.includes('corporate bond')) return 'Corporate Bond';
    if (nameLower.includes('credit risk')) return 'Credit Risk';
    if (nameLower.includes('dividend yield')) return 'Dividend Yield';
    if (nameLower.includes('focused')) return 'Focused';
    if (nameLower.includes('value') || nameLower.includes('contra')) return 'Value';
    if (nameLower.includes('sector') || nameLower.includes('thematic')) return 'Sectoral';
    if (nameLower.includes('international') || nameLower.includes('global')) return 'International';
    
    return 'Default';
  }
  
  // Helper: Get TER by category
  private getCategoryTER(category: string | undefined, isDirect: boolean): number {
    const cat = category || 'Default';
    const defaults = CATEGORY_TER_DEFAULTS[cat] || CATEGORY_TER_DEFAULTS['Default'];
    return isDirect ? defaults.direct : defaults.regular;
  }
  
  // Helper: Check if fund is IDCW/Dividend plan
  private isIDCWPlan(name: string): boolean {
    const nameLower = name.toLowerCase();
    return nameLower.includes('idcw') || 
           nameLower.includes('dividend') || 
           nameLower.includes('payout') || 
           nameLower.includes('income distribution');
  }
}

export const portfolioAnalyticsDataService = new PortfolioAnalyticsDataService();
