/**
 * Cached Probe42 Service
 * 
 * Wraps the Probe42 service with cache-first pattern to reduce API costs.
 * 
 * Cache Strategy:
 * - Company Master Data (CIN, PAN, directors): Permanent (never expires)
 * - Company Financials: 120 days (quarterly refresh)
 * - Ratios: 120 days (quarterly refresh)
 */

import { probe42Service, Probe42CompanyDetails, Probe42FinancialData, Probe42RatiosData } from './probe42-service';
import { dataCacheService, CACHE_TTL } from './unified-data-cache-service';

export class CachedProbe42Service {
  
  /**
   * Get company details - Cache-first pattern
   * Checks permanent cache before calling API
   */
  async getCompanyDetails(cin: string): Promise<Probe42CompanyDetails | null> {
    // 1. Check cache first (permanent storage)
    const cached = await dataCacheService.getCompanyByCIN(cin);
    if (cached) {
      console.log(`[CachedProbe42] Cache HIT for company: ${cin}`);
      return this.mapCacheToCompanyDetails(cached);
    }
    
    console.log(`[CachedProbe42] Cache MISS for company: ${cin}, calling API`);
    
    // 2. Call API
    const apiResult = await probe42Service.getCompanyDetails(cin);
    
    // 3. Save to permanent cache if successful
    if (apiResult) {
      await dataCacheService.saveCompanyToCache({
        cin: apiResult.cin,
        pan: apiResult.pan,
        companyName: apiResult.name,
        companyStatus: apiResult.status,
        dateOfIncorporation: apiResult.incorporation_date ? new Date(apiResult.incorporation_date) : undefined,
        paidUpCapital: apiResult.paid_up_capital,
        directors: apiResult.directors,
        dataSource: 'probe42',
        sourceReferenceId: apiResult.company_id,
      });
      
      // Track API usage
      await dataCacheService.trackApiUsage('probe42-details', 'company_details', false, cin);
    }
    
    return apiResult;
  }
  
  /**
   * Get company financials - Cache-first with 120-day TTL
   */
  async getCompanyFinancials(cin: string, years: number = 3): Promise<Probe42FinancialData[]> {
    // 1. Check cache first
    const cached = await dataCacheService.getCompanyFinancials(cin);
    if (cached.length > 0) {
      console.log(`[CachedProbe42] Cache HIT for financials: ${cin} (${cached.length} records)`);
      return cached.map(this.mapCacheToFinancialData);
    }
    
    console.log(`[CachedProbe42] Cache MISS for financials: ${cin}, calling API`);
    
    // 2. Call API
    const apiResult = await probe42Service.getCompanyFinancials(cin, years);
    
    // 3. Save to cache with 120-day TTL
    for (const financial of apiResult) {
      await dataCacheService.saveCompanyFinancials({
        cin,
        financialYear: financial.financial_year,
        periodStart: financial.period_start ? new Date(financial.period_start) : undefined,
        periodEnd: financial.period_end ? new Date(financial.period_end) : undefined,
        revenue: financial.revenue,
        ebitda: financial.ebitda,
        ebit: financial.ebit,
        pbt: financial.pbt,
        pat: financial.pat,
        netProfit: financial.net_profit,
        totalAssets: financial.total_assets,
        totalLiabilities: financial.total_liabilities,
        networth: financial.networth,
        shareCapital: financial.share_capital,
        reserves: financial.reserves,
        totalDebt: financial.total_debt,
        longTermDebt: financial.long_term_debt,
        shortTermDebt: financial.short_term_debt,
        operatingCashFlow: financial.operating_cash_flow,
        investingCashFlow: financial.investing_cash_flow,
        financingCashFlow: financial.financing_cash_flow,
        freeCashFlow: financial.free_cash_flow,
        dataSource: 'probe42',
      });
    }
    
    // Track API usage
    await dataCacheService.trackApiUsage('probe42-financials', 'company_financials', false, cin);
    
    return apiResult;
  }
  
  /**
   * Get company ratios - Uses financials cache
   */
  async getCompanyRatios(cin: string, years: number = 3): Promise<Probe42RatiosData[]> {
    // Check if we have cached financials with ratios
    const cached = await dataCacheService.getCompanyFinancials(cin);
    if (cached.length > 0 && cached.some(c => c.ratios && Object.keys(c.ratios).length > 0)) {
      console.log(`[CachedProbe42] Cache HIT for ratios: ${cin}`);
      return cached.map(c => ({
        company_id: cin,
        financial_year: c.financial_year,
        ...(c.ratios as any)
      }));
    }
    
    // Call API and store in financials cache
    const apiResult = await probe42Service.getCompanyRatios(cin, years);
    
    // Track API usage
    await dataCacheService.trackApiUsage('probe42-ratios', 'company_ratios', false, cin);
    
    return apiResult;
  }
  
  /**
   * Search companies - Pass-through (no caching for search)
   */
  async searchCompanyByNameOrCIN(query: string) {
    return probe42Service.searchCompanyByNameOrCIN(query);
  }
  
  /**
   * Search with details - Pass-through
   */
  async searchCompanyByNameOrCINWithDetails(query: string) {
    return probe42Service.searchCompanyByNameOrCINWithDetails(query);
  }
  
  // Helper methods for mapping cache to API response format
  private mapCacheToCompanyDetails(cached: any): Probe42CompanyDetails {
    return {
      company_id: cached.source_reference_id || cached.cin,
      name: cached.company_name,
      cin: cached.cin,
      pan: cached.pan,
      sector: cached.company_category,
      industry: cached.company_class,
      incorporation_date: cached.date_of_incorporation,
      paid_up_capital: parseFloat(cached.paid_up_capital) || undefined,
      status: cached.company_status || 'Unknown',
      directors: typeof cached.directors === 'string' ? JSON.parse(cached.directors) : cached.directors,
    };
  }
  
  private mapCacheToFinancialData(cached: any): Probe42FinancialData {
    return {
      company_id: cached.cin,
      financial_year: cached.financial_year,
      period_start: cached.period_start,
      period_end: cached.period_end,
      revenue: parseFloat(cached.revenue) || undefined,
      ebitda: parseFloat(cached.ebitda) || undefined,
      ebit: parseFloat(cached.ebit) || undefined,
      pbt: parseFloat(cached.pbt) || undefined,
      pat: parseFloat(cached.pat) || undefined,
      net_profit: parseFloat(cached.net_profit) || undefined,
      total_assets: parseFloat(cached.total_assets) || undefined,
      total_liabilities: parseFloat(cached.total_liabilities) || undefined,
      networth: parseFloat(cached.networth) || undefined,
      share_capital: parseFloat(cached.share_capital) || undefined,
      reserves: parseFloat(cached.reserves) || undefined,
      total_debt: parseFloat(cached.total_debt) || undefined,
      long_term_debt: parseFloat(cached.long_term_debt) || undefined,
      short_term_debt: parseFloat(cached.short_term_debt) || undefined,
      operating_cash_flow: parseFloat(cached.operating_cash_flow) || undefined,
      investing_cash_flow: parseFloat(cached.investing_cash_flow) || undefined,
      financing_cash_flow: parseFloat(cached.financing_cash_flow) || undefined,
      free_cash_flow: parseFloat(cached.free_cash_flow) || undefined,
    };
  }
}

// Singleton instance
export const cachedProbe42Service = new CachedProbe42Service();
