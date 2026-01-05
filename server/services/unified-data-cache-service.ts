/**
 * Unified Data Cache Service
 * 
 * Implements cache-first pattern for all external API calls to reduce operational costs.
 * 
 * Cache TTLs (based on Indian regulatory and data volatility):
 * - Company Master (CIN, PAN, GSTIN): Permanent (manual refresh only)
 * - Verification Results (PAN, Aadhaar): 24 months (per SEBI KYC norms)
 * - Company Financials: 120 days (quarterly refresh)
 * - Market Data Quotes: 15 seconds
 * - Market Data Indices: 5 minutes
 * - Market Data NAVs: 24 hours
 */

import { db } from '../db';
import { eq, and, gt, desc } from 'drizzle-orm';
import crypto from 'crypto';

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  VERIFICATION: 24 * 30 * 24 * 60 * 60 * 1000, // 24 months
  COMPANY_FINANCIALS: 120 * 24 * 60 * 60 * 1000, // 120 days
  MARKET_QUOTE: 15 * 1000, // 15 seconds
  MARKET_INDEX: 5 * 60 * 1000, // 5 minutes
  MARKET_NAV: 24 * 60 * 60 * 1000, // 24 hours
  MARKET_EOD: 24 * 60 * 60 * 1000, // 24 hours
};

// Cost estimates per API call (in INR)
export const API_COST_ESTIMATES = {
  probe42_company_search: 0.50,
  probe42_company_details: 1.00,
  probe42_financials: 2.00,
  sandbox_pan: 0.75,
  sandbox_gstin: 0.50,
  sandbox_mca: 1.50,
  cashfree_pan: 0.50,
  cashfree_aadhaar: 1.00,
  finnhub_quote: 0.01,
  nse_quote: 0.005,
};

// Helper to hash identifiers for privacy
export function hashIdentifier(identifier: string): string {
  return crypto.createHash('sha256').update(identifier.toUpperCase()).digest('hex');
}

// Helper to mask identifiers for display
export function maskIdentifier(identifier: string, type: 'pan' | 'aadhaar' | 'gstin'): string {
  const upper = identifier.toUpperCase();
  switch (type) {
    case 'pan':
      return upper.slice(0, 4) + '****' + upper.slice(-2);
    case 'aadhaar':
      return '****' + upper.slice(-4);
    case 'gstin':
      return upper.slice(0, 4) + '****' + upper.slice(-4);
    default:
      return '****';
  }
}

// Cache service class
export class UnifiedDataCacheService {
  
  // ===================================================================
  // COMPANY MASTER CACHE (Permanent - CIN, PAN, GSTIN)
  // ===================================================================
  
  async getCompanyByCIN(cin: string): Promise<any | null> {
    try {
      const result = await db.execute(`
        SELECT * FROM company_master_cache 
        WHERE cin = $1
        LIMIT 1
      `, [cin.toUpperCase()]);
      
      if (result.rows && result.rows.length > 0) {
        await this.trackApiUsage('company_master', 'cache_lookup', true, cin);
        return result.rows[0];
      }
      return null;
    } catch (error) {
      console.error('Error fetching company from cache:', error);
      return null;
    }
  }
  
  async getCompanyByPAN(pan: string): Promise<any | null> {
    try {
      const result = await db.execute(`
        SELECT * FROM company_master_cache 
        WHERE pan = $1
        LIMIT 1
      `, [pan.toUpperCase()]);
      
      if (result.rows && result.rows.length > 0) {
        await this.trackApiUsage('company_master', 'cache_lookup', true, pan);
        return result.rows[0];
      }
      return null;
    } catch (error) {
      console.error('Error fetching company from cache:', error);
      return null;
    }
  }
  
  async saveCompanyToCache(company: {
    cin?: string;
    pan?: string;
    gstin?: string;
    tan?: string;
    companyName: string;
    companyStatus?: string;
    companyClass?: string;
    companyCategory?: string;
    dateOfIncorporation?: Date;
    registrationNumber?: string;
    rocState?: string;
    registeredAddress?: string;
    authorizedCapital?: number;
    paidUpCapital?: number;
    directors?: any[];
    dataSource: string;
    sourceReferenceId?: string;
  }): Promise<string | null> {
    try {
      const result = await db.execute(`
        INSERT INTO company_master_cache (
          cin, pan, gstin, tan, company_name, company_status, company_class,
          company_category, date_of_incorporation, registration_number, roc_state,
          registered_address, authorized_capital, paid_up_capital, directors,
          data_source, source_reference_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (cin) DO UPDATE SET
          pan = COALESCE(EXCLUDED.pan, company_master_cache.pan),
          gstin = COALESCE(EXCLUDED.gstin, company_master_cache.gstin),
          company_name = EXCLUDED.company_name,
          company_status = EXCLUDED.company_status,
          directors = EXCLUDED.directors,
          last_verified_at = NOW()
        RETURNING id
      `, [
        company.cin?.toUpperCase(),
        company.pan?.toUpperCase(),
        company.gstin?.toUpperCase(),
        company.tan?.toUpperCase(),
        company.companyName,
        company.companyStatus,
        company.companyClass,
        company.companyCategory,
        company.dateOfIncorporation,
        company.registrationNumber,
        company.rocState,
        company.registeredAddress,
        company.authorizedCapital,
        company.paidUpCapital,
        JSON.stringify(company.directors || []),
        company.dataSource,
        company.sourceReferenceId
      ]);
      
      return result.rows?.[0]?.id || null;
    } catch (error) {
      console.error('Error saving company to cache:', error);
      return null;
    }
  }
  
  // ===================================================================
  // VERIFICATION CACHE (24 months TTL)
  // ===================================================================
  
  async getVerificationResult(
    type: 'pan' | 'aadhaar' | 'gstin' | 'bank_account' | 'tan',
    identifier: string
  ): Promise<any | null> {
    try {
      const hash = hashIdentifier(identifier);
      const now = new Date();
      
      const result = await db.execute(`
        SELECT * FROM verification_cache 
        WHERE verification_type = $1 
          AND identifier_hash = $2 
          AND expires_at > $3
        ORDER BY verified_at DESC
        LIMIT 1
      `, [type, hash, now.toISOString()]);
      
      if (result.rows && result.rows.length > 0) {
        await this.trackApiUsage('verification', `${type}_lookup`, true, hash);
        return result.rows[0];
      }
      return null;
    } catch (error) {
      console.error('Error fetching verification from cache:', error);
      return null;
    }
  }
  
  async saveVerificationResult(params: {
    type: 'pan' | 'aadhaar' | 'gstin' | 'bank_account' | 'tan';
    identifier: string;
    verified: boolean;
    verificationStatus?: string;
    registeredName?: string;
    nameMatchScore?: number;
    additionalData?: any;
    provider: string;
    providerReferenceId?: string;
    requestedBy?: string;
    requestContext?: string;
  }): Promise<string | null> {
    try {
      const hash = hashIdentifier(params.identifier);
      const masked = maskIdentifier(params.identifier, params.type as any);
      const expiresAt = new Date(Date.now() + CACHE_TTL.VERIFICATION);
      
      const result = await db.execute(`
        INSERT INTO verification_cache (
          verification_type, identifier_hash, identifier_masked, verified,
          verification_status, registered_name, name_match_score, additional_data,
          provider, provider_reference_id, expires_at, requested_by, request_context
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
        params.type,
        hash,
        masked,
        params.verified,
        params.verificationStatus,
        params.registeredName,
        params.nameMatchScore,
        JSON.stringify(params.additionalData || {}),
        params.provider,
        params.providerReferenceId,
        expiresAt.toISOString(),
        params.requestedBy,
        params.requestContext
      ]);
      
      return result.rows?.[0]?.id || null;
    } catch (error) {
      console.error('Error saving verification to cache:', error);
      return null;
    }
  }
  
  // ===================================================================
  // COMPANY FINANCIALS CACHE (120 days TTL)
  // ===================================================================
  
  async getCompanyFinancials(cin: string, financialYear?: string): Promise<any[]> {
    try {
      const now = new Date();
      
      let query = `
        SELECT * FROM company_financials_cache 
        WHERE cin = $1 AND expires_at > $2
      `;
      const params: any[] = [cin.toUpperCase(), now.toISOString()];
      
      if (financialYear) {
        query += ` AND financial_year = $3`;
        params.push(financialYear);
      }
      
      query += ` ORDER BY financial_year DESC, quarter DESC`;
      
      const result = await db.execute(query, params);
      
      if (result.rows && result.rows.length > 0) {
        await this.trackApiUsage('financials', 'cache_lookup', true, cin);
        return result.rows;
      }
      return [];
    } catch (error) {
      console.error('Error fetching financials from cache:', error);
      return [];
    }
  }
  
  async saveCompanyFinancials(params: {
    companyId?: string;
    cin: string;
    financialYear: string;
    quarter?: string;
    periodStart?: Date;
    periodEnd?: Date;
    revenue?: number;
    ebitda?: number;
    ebit?: number;
    pbt?: number;
    pat?: number;
    netProfit?: number;
    totalAssets?: number;
    totalLiabilities?: number;
    networth?: number;
    shareCapital?: number;
    reserves?: number;
    totalDebt?: number;
    longTermDebt?: number;
    shortTermDebt?: number;
    operatingCashFlow?: number;
    investingCashFlow?: number;
    financingCashFlow?: number;
    freeCashFlow?: number;
    ratios?: any;
    dataSource: string;
  }): Promise<string | null> {
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL.COMPANY_FINANCIALS);
      
      const result = await db.execute(`
        INSERT INTO company_financials_cache (
          company_id, cin, financial_year, quarter, period_start, period_end,
          revenue, ebitda, ebit, pbt, pat, net_profit,
          total_assets, total_liabilities, networth, share_capital, reserves,
          total_debt, long_term_debt, short_term_debt,
          operating_cash_flow, investing_cash_flow, financing_cash_flow, free_cash_flow,
          ratios, data_source, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
        RETURNING id
      `, [
        params.companyId,
        params.cin.toUpperCase(),
        params.financialYear,
        params.quarter,
        params.periodStart,
        params.periodEnd,
        params.revenue,
        params.ebitda,
        params.ebit,
        params.pbt,
        params.pat,
        params.netProfit,
        params.totalAssets,
        params.totalLiabilities,
        params.networth,
        params.shareCapital,
        params.reserves,
        params.totalDebt,
        params.longTermDebt,
        params.shortTermDebt,
        params.operatingCashFlow,
        params.investingCashFlow,
        params.financingCashFlow,
        params.freeCashFlow,
        JSON.stringify(params.ratios || {}),
        params.dataSource,
        expiresAt.toISOString()
      ]);
      
      return result.rows?.[0]?.id || null;
    } catch (error) {
      console.error('Error saving financials to cache:', error);
      return null;
    }
  }
  
  // ===================================================================
  // MARKET DATA CACHE (Tiered TTLs)
  // ===================================================================
  
  async getMarketData(
    symbol: string, 
    dataType: 'quote' | 'index' | 'nav' | 'eod_price'
  ): Promise<any | null> {
    try {
      const now = new Date();
      
      const result = await db.execute(`
        SELECT * FROM market_data_cache 
        WHERE symbol = $1 
          AND data_type = $2 
          AND expires_at > $3
        ORDER BY fetched_at DESC
        LIMIT 1
      `, [symbol.toUpperCase(), dataType, now.toISOString()]);
      
      if (result.rows && result.rows.length > 0) {
        await this.trackApiUsage('market_data', `${dataType}_lookup`, true, symbol);
        return result.rows[0];
      }
      return null;
    } catch (error) {
      console.error('Error fetching market data from cache:', error);
      return null;
    }
  }
  
  async saveMarketData(params: {
    symbol: string;
    exchange?: string;
    dataType: 'quote' | 'index' | 'nav' | 'eod_price';
    lastPrice?: number;
    previousClose?: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
    change?: number;
    changePercent?: number;
    additionalData?: any;
    provider: string;
  }): Promise<string | null> {
    try {
      // Determine TTL based on data type
      let ttl: number;
      switch (params.dataType) {
        case 'quote': ttl = CACHE_TTL.MARKET_QUOTE; break;
        case 'index': ttl = CACHE_TTL.MARKET_INDEX; break;
        case 'nav': ttl = CACHE_TTL.MARKET_NAV; break;
        case 'eod_price': ttl = CACHE_TTL.MARKET_EOD; break;
        default: ttl = CACHE_TTL.MARKET_QUOTE;
      }
      
      const expiresAt = new Date(Date.now() + ttl);
      
      const result = await db.execute(`
        INSERT INTO market_data_cache (
          symbol, exchange, data_type, last_price, previous_close, open, high, low,
          volume, change, change_percent, additional_data, provider, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
      `, [
        params.symbol.toUpperCase(),
        params.exchange,
        params.dataType,
        params.lastPrice,
        params.previousClose,
        params.open,
        params.high,
        params.low,
        params.volume,
        params.change,
        params.changePercent,
        JSON.stringify(params.additionalData || {}),
        params.provider,
        expiresAt.toISOString()
      ]);
      
      return result.rows?.[0]?.id || null;
    } catch (error) {
      console.error('Error saving market data to cache:', error);
      return null;
    }
  }
  
  // ===================================================================
  // API USAGE TRACKING
  // ===================================================================
  
  async trackApiUsage(
    provider: string,
    endpoint: string,
    cacheHit: boolean,
    cacheKey?: string,
    responseStatus?: number,
    responseTimeMs?: number,
    requestedBy?: string,
    requestContext?: string
  ): Promise<void> {
    try {
      const costKey = `${provider}_${endpoint.split('/').pop()}`;
      const estimatedCost = cacheHit ? 0 : (API_COST_ESTIMATES[costKey as keyof typeof API_COST_ESTIMATES] || 0);
      
      await db.execute(`
        INSERT INTO api_usage_tracking (
          provider, endpoint, cache_hit, cache_key, estimated_cost_inr,
          response_status, response_time_ms, requested_by, request_context
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        provider,
        endpoint,
        cacheHit,
        cacheKey,
        estimatedCost,
        responseStatus,
        responseTimeMs,
        requestedBy,
        requestContext
      ]);
    } catch (error) {
      // Don't fail the main operation for tracking errors
      console.error('Error tracking API usage:', error);
    }
  }
  
  // ===================================================================
  // CACHE STATISTICS
  // ===================================================================
  
  async getCacheStats(): Promise<{
    companyMaster: { count: number };
    verifications: { count: number; expired: number };
    financials: { count: number; expired: number };
    marketData: { count: number; expired: number };
    apiUsage: { 
      totalCalls: number; 
      cacheHits: number; 
      hitRate: number;
      estimatedSavings: number;
    };
  }> {
    try {
      const [companyCount, verificationStats, financialsStats, marketDataStats, apiStats] = await Promise.all([
        db.execute(`SELECT COUNT(*) as count FROM company_master_cache`),
        db.execute(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired
          FROM verification_cache
        `),
        db.execute(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired
          FROM company_financials_cache
        `),
        db.execute(`
          SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired
          FROM market_data_cache
        `),
        db.execute(`
          SELECT 
            COUNT(*) as total_calls,
            COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
            COALESCE(SUM(CASE WHEN cache_hit = true THEN estimated_cost_inr ELSE 0 END), 0) as estimated_savings
          FROM api_usage_tracking
          WHERE created_at > NOW() - INTERVAL '30 days'
        `)
      ]);
      
      const totalCalls = parseInt(apiStats.rows?.[0]?.total_calls || '0');
      const cacheHits = parseInt(apiStats.rows?.[0]?.cache_hits || '0');
      
      return {
        companyMaster: { count: parseInt(companyCount.rows?.[0]?.count || '0') },
        verifications: { 
          count: parseInt(verificationStats.rows?.[0]?.total || '0'),
          expired: parseInt(verificationStats.rows?.[0]?.expired || '0')
        },
        financials: { 
          count: parseInt(financialsStats.rows?.[0]?.total || '0'),
          expired: parseInt(financialsStats.rows?.[0]?.expired || '0')
        },
        marketData: { 
          count: parseInt(marketDataStats.rows?.[0]?.total || '0'),
          expired: parseInt(marketDataStats.rows?.[0]?.expired || '0')
        },
        apiUsage: {
          totalCalls,
          cacheHits,
          hitRate: totalCalls > 0 ? (cacheHits / totalCalls) * 100 : 0,
          estimatedSavings: parseFloat(apiStats.rows?.[0]?.estimated_savings || '0')
        }
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      throw error;
    }
  }
  
  // ===================================================================
  // CACHE CLEANUP
  // ===================================================================
  
  async cleanupExpiredCache(): Promise<{ deleted: number }> {
    try {
      const now = new Date().toISOString();
      
      const [v, f, m] = await Promise.all([
        db.execute(`DELETE FROM verification_cache WHERE expires_at <= $1`, [now]),
        db.execute(`DELETE FROM company_financials_cache WHERE expires_at <= $1`, [now]),
        db.execute(`DELETE FROM market_data_cache WHERE expires_at <= $1`, [now])
      ]);
      
      const deleted = (v.rowCount || 0) + (f.rowCount || 0) + (m.rowCount || 0);
      console.log(`Cleaned up ${deleted} expired cache entries`);
      
      return { deleted };
    } catch (error) {
      console.error('Error cleaning up cache:', error);
      throw error;
    }
  }
  
  async getApiUsageBreakdown(days: number = 30): Promise<any[]> {
    try {
      const result = await db.execute(`
        SELECT 
          provider,
          COUNT(*) as total_calls,
          COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
          COUNT(*) FILTER (WHERE cache_hit = false) as api_calls,
          ROUND(100.0 * COUNT(*) FILTER (WHERE cache_hit = true) / NULLIF(COUNT(*), 0), 2) as hit_rate_percent,
          COALESCE(SUM(estimated_cost_inr), 0) as total_cost,
          COALESCE(SUM(CASE WHEN cache_hit = true THEN estimated_cost_inr ELSE 0 END), 0) as saved_cost
        FROM api_usage_tracking
        WHERE created_at > NOW() - INTERVAL '${days} days'
        GROUP BY provider
        ORDER BY total_calls DESC
      `);
      
      return result.rows || [];
    } catch (error) {
      console.error('Error fetching API usage breakdown:', error);
      return [];
    }
  }
  
  async getRefreshSchedules(): Promise<any[]> {
    try {
      const result = await db.execute(`
        SELECT * FROM cache_refresh_schedule
        ORDER BY priority ASC
      `);
      
      return result.rows || [];
    } catch (error) {
      console.error('Error fetching refresh schedules:', error);
      return [];
    }
  }
}

// Singleton instance
export const dataCacheService = new UnifiedDataCacheService();
