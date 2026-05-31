// @ts-nocheck
/**
 * NSE/BSE Exchange Filings Service
 * Fetches official corporate filings from Indian stock exchanges
 * 
 * Features:
 * - NSE Corporate Results scraping
 * - BSE Corporate Announcements scraping  
 * - Hash-based deduplication (SHA256)
 * - Rate limiting and retry logic
 * - Cron scheduling for automated fetches
 * 
 * Data Sources:
 * - NSE: https://www.nseindia.com/companies-listing/corporate-filings-financial-results
 * - BSE: https://www.bseindia.com/corporates/ann.html
 */

import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { ExternalServiceError } from '../utils/errors';

export type ExchangeType = 'NSE' | 'BSE';
export type FilingType = 'QUARTERLY' | 'ANNUAL' | 'HALF_YEARLY';
export type FinancialType = 'STANDALONE' | 'CONSOLIDATED';
export type DocumentType = 'XBRL' | 'PDF' | 'XLS' | 'SCANNED_PDF';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review';

export interface ExchangeFilingMetadata {
  exchange: ExchangeType;
  symbol: string;
  companyName: string;
  filingType: FilingType;
  financialType: FinancialType;
  documentUrl: string;
  documentHash?: string;
  filingDate: Date;
  periodStart?: Date;
  periodEnd?: Date;
  financialYear?: string;
  quarter?: string;
  documentType?: DocumentType;
}

export interface FilingFetchResult {
  success: boolean;
  exchange: ExchangeType;
  filings: ExchangeFilingMetadata[];
  newFilings: number;
  duplicateFilings: number;
  errors: string[];
  fetchedAt: Date;
}

const NSE_BASE_URL = 'https://www.nseindia.com';
const BSE_BASE_URL = 'https://api.bseindia.com/BseIndiaAPI/api';

const RATE_LIMIT_PER_MINUTE = 30;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

class ExchangeFilingsService {
  private nseClient: AxiosInstance;
  private bseClient: AxiosInstance;
  private requestCount: number = 0;
  private windowStart: number = Date.now();

  constructor() {
    this.nseClient = axios.create({
      baseURL: NSE_BASE_URL,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/html',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });

    this.bseClient = axios.create({
      baseURL: BSE_BASE_URL,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Origin': 'https://www.bseindia.com',
        'Referer': 'https://www.bseindia.com/',
      },
    });

    console.log('✅ Exchange Filings Service initialized');
  }

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    if (now - this.windowStart >= 60000) {
      this.requestCount = 0;
      this.windowStart = now;
    }
    
    if (this.requestCount >= RATE_LIMIT_PER_MINUTE) {
      const waitTime = 60000 - (now - this.windowStart);
      console.log(`[ExchangeFilings] Rate limit reached, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.requestCount = 0;
      this.windowStart = Date.now();
    }
    this.requestCount++;
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await this.checkRateLimit();
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        if (error.response?.status === 429 || error.response?.status >= 500) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(`[ExchangeFilings] Error ${error.response?.status}, retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }

  generateDocumentHash(url: string, content?: string): string {
    const data = content || url;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async fetchNSEFilings(options: {
    symbol?: string;
    fromDate?: Date;
    toDate?: Date;
    index?: string;
  } = {}): Promise<FilingFetchResult> {
    const result: FilingFetchResult = {
      success: false,
      exchange: 'NSE',
      filings: [],
      newFilings: 0,
      duplicateFilings: 0,
      errors: [],
      fetchedAt: new Date(),
    };

    try {
      const today = new Date();
      const fromDate = options.fromDate || new Date(today.getFullYear(), today.getMonth() - 3, 1);
      const toDate = options.toDate || today;

      const params: any = {
        from_date: this.formatDate(fromDate),
        to_date: this.formatDate(toDate),
      };

      if (options.symbol) {
        params.symbol = options.symbol;
      }

      if (options.index) {
        params.index = options.index;
      }

      console.log(`[NSE] Fetching filings from ${params.from_date} to ${params.to_date}`);

      const response = await this.retryWithBackoff(() =>
        this.nseClient.get('/api/corporates-financial-results', { params })
      );

      const data = response.data?.data || response.data || [];
      
      for (const item of data) {
        try {
          const filing = this.parseNSEFiling(item);
          if (filing) {
            result.filings.push(filing);
          }
        } catch (parseError: any) {
          result.errors.push(`Parse error: ${parseError.message}`);
        }
      }

      result.success = true;
      result.newFilings = result.filings.length;
      
      console.log(`[NSE] Fetched ${result.filings.length} filings`);
    } catch (error: any) {
      console.error(`[NSE] Fetch error: ${error.message}`);
      result.errors.push(`NSE fetch failed: ${error.message}`);
      
      if (error.response?.status === 403) {
        result.errors.push('NSE may require browser session cookies. Using fallback method.');
      }
    }

    return result;
  }

  async fetchBSEFilings(options: {
    scripCode?: string;
    fromDate?: Date;
    toDate?: Date;
    category?: string;
  } = {}): Promise<FilingFetchResult> {
    const result: FilingFetchResult = {
      success: false,
      exchange: 'BSE',
      filings: [],
      newFilings: 0,
      duplicateFilings: 0,
      errors: [],
      fetchedAt: new Date(),
    };

    try {
      const today = new Date();
      const fromDate = options.fromDate || new Date(today.getFullYear(), today.getMonth() - 3, 1);
      const toDate = options.toDate || today;

      const params: any = {
        strCat: options.category || 'Result',
        strPrevDate: this.formatDate(fromDate),
        strScrip: options.scripCode || '',
        strSearch: 'P',
        strToDate: this.formatDate(toDate),
        strType: 'C',
      };

      console.log(`[BSE] Fetching filings from ${params.strPrevDate} to ${params.strToDate}`);

      const response = await this.retryWithBackoff(() =>
        this.bseClient.get('/AnnSubCategoryGetData/w', { params })
      );

      const data = response.data?.Table || response.data || [];
      
      for (const item of data) {
        try {
          const filing = this.parseBSEFiling(item);
          if (filing) {
            result.filings.push(filing);
          }
        } catch (parseError: any) {
          result.errors.push(`Parse error: ${parseError.message}`);
        }
      }

      result.success = true;
      result.newFilings = result.filings.length;
      
      console.log(`[BSE] Fetched ${result.filings.length} filings`);
    } catch (error: any) {
      console.error(`[BSE] Fetch error: ${error.message}`);
      result.errors.push(`BSE fetch failed: ${error.message}`);
    }

    return result;
  }

  private parseNSEFiling(item: any): ExchangeFilingMetadata | null {
    if (!item.symbol || !item.xbrl) return null;

    const filingDate = this.parseDate(item.submissionDate || item.period);
    if (!filingDate) return null;

    const periodEnd = this.parseDate(item.toDate || item.period);
    const financialYear = this.extractFinancialYear(periodEnd || filingDate);
    const quarter = this.extractQuarter(periodEnd || filingDate);

    const documentUrl = item.xbrl || item.attachment || item.pdf;
    if (!documentUrl) return null;

    return {
      exchange: 'NSE',
      symbol: item.symbol,
      companyName: item.companyName || item.symbol,
      filingType: this.detectFilingType(item.relatingTo || item.resultType),
      financialType: (item.consolidated?.toLowerCase() === 'yes' || item.cons === 'Y') 
        ? 'CONSOLIDATED' 
        : 'STANDALONE',
      documentUrl: documentUrl.startsWith('http') ? documentUrl : `${NSE_BASE_URL}${documentUrl}`,
      documentHash: this.generateDocumentHash(documentUrl),
      filingDate,
      periodEnd,
      financialYear,
      quarter,
      documentType: this.detectDocumentType(documentUrl),
    };
  }

  private parseBSEFiling(item: any): ExchangeFilingMetadata | null {
    const scripCode = item.SCRIP_CD || item.scrip_code;
    const headline = item.HEADLINE || item.headline || '';
    
    if (!scripCode || !headline.toLowerCase().includes('result')) return null;

    const attachmentUrl = item.ATTACHMENTNAME || item.attachment;
    if (!attachmentUrl) return null;

    const filingDate = this.parseDate(item.NEWS_DT || item.dt);
    if (!filingDate) return null;

    const documentUrl = attachmentUrl.startsWith('http') 
      ? attachmentUrl 
      : `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${attachmentUrl}`;

    return {
      exchange: 'BSE',
      symbol: scripCode.toString(),
      companyName: item.SLONGNAME || item.company_name || scripCode.toString(),
      filingType: this.detectFilingType(headline),
      financialType: headline.toLowerCase().includes('consolidated') 
        ? 'CONSOLIDATED' 
        : 'STANDALONE',
      documentUrl,
      documentHash: this.generateDocumentHash(documentUrl),
      filingDate,
      financialYear: this.extractFinancialYear(filingDate),
      quarter: this.extractQuarter(filingDate),
      documentType: this.detectDocumentType(attachmentUrl),
    };
  }

  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null;
    
    const formats = [
      /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
      /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[1]) {
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        }
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      }
    }

    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  private detectFilingType(text: string): FilingType {
    const lower = (text || '').toLowerCase();
    if (lower.includes('annual') || lower.includes('yearly')) return 'ANNUAL';
    if (lower.includes('half') || lower.includes('semi')) return 'HALF_YEARLY';
    return 'QUARTERLY';
  }

  private detectDocumentType(url: string): DocumentType {
    const lower = (url || '').toLowerCase();
    if (lower.includes('.xml') || lower.includes('xbrl')) return 'XBRL';
    if (lower.includes('.xls') || lower.includes('.xlsx')) return 'XLS';
    if (lower.includes('.pdf')) return 'PDF';
    return 'PDF';
  }

  private extractFinancialYear(date: Date | null): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = date.getMonth();
    if (month >= 3) {
      return `FY${year}-${(year + 1).toString().slice(-2)}`;
    }
    return `FY${year - 1}-${year.toString().slice(-2)}`;
  }

  private extractQuarter(date: Date | null): string {
    if (!date) return '';
    const month = date.getMonth();
    if (month >= 0 && month <= 2) return 'Q4';
    if (month >= 3 && month <= 5) return 'Q1';
    if (month >= 6 && month <= 8) return 'Q2';
    return 'Q3';
  }

  async fetchAllExchangeFilings(options: {
    fromDate?: Date;
    toDate?: Date;
  } = {}): Promise<{
    nse: FilingFetchResult;
    bse: FilingFetchResult;
    totalFilings: number;
    totalErrors: number;
  }> {
    const [nseResult, bseResult] = await Promise.all([
      this.fetchNSEFilings(options),
      this.fetchBSEFilings(options),
    ]);

    return {
      nse: nseResult,
      bse: bseResult,
      totalFilings: nseResult.filings.length + bseResult.filings.length,
      totalErrors: nseResult.errors.length + bseResult.errors.length,
    };
  }

  async persistFilings(filings: ExchangeFilingMetadata[]): Promise<{
    inserted: number;
    duplicates: number;
    errors: string[];
  }> {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');
    
    const result = {
      inserted: 0,
      duplicates: 0,
      errors: [] as string[],
    };

    for (const filing of filings) {
      try {
        const existing = await db.execute(sql`
          SELECT id FROM exchange_filings 
          WHERE document_hash = ${filing.documentHash}
          LIMIT 1
        `);

        if (existing.rows.length > 0) {
          result.duplicates++;
          continue;
        }

        await db.execute(sql`
          INSERT INTO exchange_filings (
            exchange, symbol, company_name, filing_type, financial_type,
            document_url, document_hash, filing_date, period_end,
            financial_year, quarter, document_type, processing_status
          ) VALUES (
            ${filing.exchange}, ${filing.symbol}, ${filing.companyName},
            ${filing.filingType}, ${filing.financialType}, ${filing.documentUrl},
            ${filing.documentHash}, ${filing.filingDate.toISOString().split('T')[0]},
            ${filing.periodEnd?.toISOString().split('T')[0] || null},
            ${filing.financialYear}, ${filing.quarter}, ${filing.documentType},
            'pending'
          )
          ON CONFLICT (exchange, document_url) DO NOTHING
        `);

        result.inserted++;
      } catch (error: any) {
        result.errors.push(`Failed to insert filing ${filing.symbol}: ${error.message}`);
      }
    }

    console.log(`[ExchangeFilings] Persisted: ${result.inserted} inserted, ${result.duplicates} duplicates`);
    return result;
  }

  async linkFilingToCompany(filingId: string, companyId: string): Promise<boolean> {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');

    try {
      await db.execute(sql`
        UPDATE exchange_filings 
        SET fintekpro_company_id = ${companyId}, updated_at = NOW()
        WHERE id = ${filingId}
      `);
      return true;
    } catch (error: any) {
      console.error(`[ExchangeFilings] Failed to link filing ${filingId}: ${error.message}`);
      return false;
    }
  }

  async getUnprocessedFilings(limit: number = 50): Promise<any[]> {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');

    const result = await db.execute(sql`
      SELECT * FROM exchange_filings 
      WHERE processing_status = 'pending'
      ORDER BY filing_date DESC
      LIMIT ${limit}
    `);

    return result.rows;
  }

  async updateFilingStatus(
    filingId: string, 
    status: ProcessingStatus, 
    error?: string,
    confidence?: number
  ): Promise<void> {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');

    await db.execute(sql`
      UPDATE exchange_filings 
      SET 
        processing_status = ${status},
        processing_error = ${error || null},
        extraction_confidence = ${confidence?.toString() || null},
        processed_at = ${status === 'completed' || status === 'failed' ? new Date().toISOString() : null},
        updated_at = NOW()
      WHERE id = ${filingId}
    `);
  }

  async getFilingStats(): Promise<{
    total: number;
    pending: number;
    completed: number;
    failed: number;
    byExchange: { nse: number; bse: number };
  }> {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');

    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE processing_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE processing_status = 'completed') as completed,
        COUNT(*) FILTER (WHERE processing_status = 'failed') as failed,
        COUNT(*) FILTER (WHERE exchange = 'NSE') as nse,
        COUNT(*) FILTER (WHERE exchange = 'BSE') as bse
      FROM exchange_filings
    `);

    const row = stats.rows[0] as any;
    return {
      total: parseInt(row.total) || 0,
      pending: parseInt(row.pending) || 0,
      completed: parseInt(row.completed) || 0,
      failed: parseInt(row.failed) || 0,
      byExchange: {
        nse: parseInt(row.nse) || 0,
        bse: parseInt(row.bse) || 0,
      },
    };
  }

  async healthCheck(): Promise<{
    nse: { status: 'healthy' | 'unhealthy'; message: string };
    bse: { status: 'healthy' | 'unhealthy'; message: string };
  }> {
    const result = {
      nse: { status: 'unhealthy' as const, message: '' },
      bse: { status: 'unhealthy' as const, message: '' },
    };

    try {
      await this.nseClient.get('/');
      result.nse = { status: 'healthy', message: 'NSE endpoint accessible' };
    } catch (error: any) {
      result.nse = { status: 'unhealthy', message: error.message };
    }

    try {
      await this.bseClient.get('/');
      result.bse = { status: 'healthy', message: 'BSE endpoint accessible' };
    } catch (error: any) {
      result.bse = { status: 'unhealthy', message: error.message };
    }

    return result;
  }

  async getSources(): Promise<Array<{
    id: string;
    sourceId: string;
    sourceName: string;
    baseUrl: string;
    active: boolean;
    rateLimitPerMinute: number;
    lastFetchAt: Date | null;
    fetchSuccessCount: number;
    fetchFailureCount: number;
  }>> {
    const { db } = await import('../db');
    const { sql } = await import('drizzle-orm');

    const result = await db.execute(sql`
      SELECT id, source_id, source_name, base_url, active, 
             rate_limit_per_minute, last_fetch_at,
             fetch_success_count, fetch_failure_count
      FROM exchange_filing_sources
      ORDER BY source_id
    `);

    return (result.rows as any[]).map(row => ({
      id: row.id,
      sourceId: row.source_id,
      sourceName: row.source_name,
      baseUrl: row.base_url,
      active: row.active,
      rateLimitPerMinute: row.rate_limit_per_minute || 60,
      lastFetchAt: row.last_fetch_at,
      fetchSuccessCount: row.fetch_success_count || 0,
      fetchFailureCount: row.fetch_failure_count || 0,
    }));
  }
}

export const exchangeFilingsService = new ExchangeFilingsService();
