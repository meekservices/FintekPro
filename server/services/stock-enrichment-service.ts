/**
 * Stock Enrichment Service
 * Auto-fills missing data in listed_stocks using existing FintekPro APIs:
 * - Probe42: CIN, PAN, financials, ratios
 * - NSE/BSE APIs: Price, PE, market cap
 * - Finnhub: Fallback for missing data
 */

import { db } from "../db";
import { listedStocks } from "@shared/schema";
import { eq, isNull, or, and, sql } from "drizzle-orm";
import { probe42Service } from "./probe42-service";
import { dataEnrichmentService } from "./data-enrichment-service";
import { exchangeStockService } from "./exchange-stock-service";
import { mapToBroadSector } from "../utils/sector-consolidation";

export interface EnrichmentProgress {
  status: 'idle' | 'running' | 'complete' | 'error';
  total: number;
  processed: number;
  enriched: number;
  failed: number;
  currentStock?: string;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface EnrichmentResult {
  stockId: string;
  symbol: string;
  fieldsEnriched: string[];
  source: string;
  success: boolean;
  error?: string;
}

class StockEnrichmentService {
  private progress: EnrichmentProgress = {
    status: 'idle',
    total: 0,
    processed: 0,
    enriched: 0,
    failed: 0,
  };

  getProgress(): EnrichmentProgress {
    return { ...this.progress };
  }

  /**
   * Enrich all stocks with missing data
   */
  async enrichAllMissingData(): Promise<EnrichmentResult[]> {
    if (this.progress.status === 'running') {
      throw new Error('Enrichment already in progress');
    }

    this.progress = {
      status: 'running',
      total: 0,
      processed: 0,
      enriched: 0,
      failed: 0,
      startedAt: new Date(),
    };

    const results: EnrichmentResult[] = [];

    try {
      const stocksNeedingEnrichment = await db
        .select()
        .from(listedStocks)
        .where(
          or(
            isNull(listedStocks.broadSector),
            and(
              isNull(listedStocks.peRatio),
              sql`${listedStocks.currentPrice} IS NOT NULL`
            ),
            isNull(listedStocks.cin),
            eq(listedStocks.enrichmentStatus, 'pending'),
            eq(listedStocks.enrichmentStatus, 'failed')
          )
        )
        .limit(500);

      this.progress.total = stocksNeedingEnrichment.length;
      console.log(`[StockEnrichment] Starting enrichment for ${this.progress.total} stocks`);

      for (const stock of stocksNeedingEnrichment) {
        this.progress.currentStock = stock.symbol;
        
        try {
          const result = await this.enrichSingleStock(stock);
          results.push(result);
          
          if (result.success && result.fieldsEnriched.length > 0) {
            this.progress.enriched++;
          }
        } catch (error: any) {
          this.progress.failed++;
          results.push({
            stockId: stock.id,
            symbol: stock.symbol,
            fieldsEnriched: [],
            source: 'none',
            success: false,
            error: error.message,
          });
        }

        this.progress.processed++;

        if (this.progress.processed % 50 === 0) {
          console.log(`[StockEnrichment] Progress: ${this.progress.processed}/${this.progress.total}`);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.progress.status = 'complete';
      this.progress.completedAt = new Date();
      console.log(`[StockEnrichment] Complete: ${this.progress.enriched} enriched, ${this.progress.failed} failed`);

    } catch (error: any) {
      this.progress.status = 'error';
      this.progress.errorMessage = error.message;
      console.error('[StockEnrichment] Error:', error);
    }

    return results;
  }

  /**
   * Enrich a single stock with all available data
   */
  async enrichSingleStock(stock: typeof listedStocks.$inferSelect): Promise<EnrichmentResult> {
    const fieldsEnriched: string[] = [];
    let primarySource = 'local';
    const updateData: Partial<typeof listedStocks.$inferInsert> = {};

    try {
      if (!stock.broadSector && stock.sector) {
        updateData.broadSector = mapToBroadSector(stock.sector);
        fieldsEnriched.push('broadSector');
      }

      if (!stock.cin || !stock.companyPan) {
        try {
          const searchResult = await probe42Service.searchCompany(stock.companyName);
          
          if (searchResult.success && searchResult.data && searchResult.data.length > 0) {
            const companyData = searchResult.data[0];
            
            if (!stock.cin && companyData.cin) {
              updateData.cin = companyData.cin;
              fieldsEnriched.push('cin');
            }
            
            if (!stock.companyPan && companyData.pan) {
              updateData.companyPan = companyData.pan;
              fieldsEnriched.push('companyPan');
            }
            
            primarySource = 'probe42';
          }
        } catch (error) {
          console.log(`[StockEnrichment] Probe42 failed for ${stock.symbol}:`, error);
        }
      }

      if (!stock.peRatio || !stock.roe || !stock.roce) {
        try {
          if (stock.cin) {
            const financials = await probe42Service.getCompanyFinancials(stock.cin);
            
            if (financials.success && financials.data) {
              if (!stock.roe && financials.data.roe) {
                updateData.roe = String(financials.data.roe);
                fieldsEnriched.push('roe');
              }
              if (!stock.roce && financials.data.roce) {
                updateData.roce = String(financials.data.roce);
                fieldsEnriched.push('roce');
              }
              
              primarySource = 'probe42';
            }
          }
        } catch (error) {
          console.log(`[StockEnrichment] Financials failed for ${stock.symbol}:`, error);
        }
      }

      if (fieldsEnriched.length > 0) {
        updateData.enrichmentStatus = 'complete';
        updateData.lastEnrichedAt = new Date();
        updateData.enrichmentSource = primarySource;
        updateData.lastUpdated = new Date();

        await db
          .update(listedStocks)
          .set(updateData)
          .where(eq(listedStocks.id, stock.id));
      }

      return {
        stockId: stock.id,
        symbol: stock.symbol,
        fieldsEnriched,
        source: primarySource,
        success: true,
      };

    } catch (error: any) {
      await db
        .update(listedStocks)
        .set({ 
          enrichmentStatus: 'failed',
          lastUpdated: new Date(),
        })
        .where(eq(listedStocks.id, stock.id));

      return {
        stockId: stock.id,
        symbol: stock.symbol,
        fieldsEnriched: [],
        source: 'none',
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Populate broad_sector for all stocks based on existing sector data
   */
  async populateBroadSectors(): Promise<{ updated: number; errors: number }> {
    console.log('[StockEnrichment] Populating broad sectors...');
    
    const stocksWithoutBroadSector = await db
      .select({ id: listedStocks.id, sector: listedStocks.sector })
      .from(listedStocks)
      .where(
        and(
          isNull(listedStocks.broadSector),
          sql`${listedStocks.sector} IS NOT NULL`
        )
      );

    let updated = 0;
    let errors = 0;

    for (const stock of stocksWithoutBroadSector) {
      try {
        const broadSector = mapToBroadSector(stock.sector);
        
        await db
          .update(listedStocks)
          .set({ broadSector })
          .where(eq(listedStocks.id, stock.id));
        
        updated++;
      } catch (error) {
        errors++;
      }
    }

    console.log(`[StockEnrichment] Broad sectors populated: ${updated} updated, ${errors} errors`);
    return { updated, errors };
  }

  /**
   * Get enrichment statistics
   */
  async getEnrichmentStats(): Promise<{
    total: number;
    withCin: number;
    withPan: number;
    withBroadSector: number;
    withPe: number;
    pending: number;
    complete: number;
    failed: number;
  }> {
    const [stats] = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(cin) as with_cin,
        COUNT(company_pan) as with_pan,
        COUNT(broad_sector) as with_broad_sector,
        COUNT(pe_ratio) as with_pe,
        COUNT(CASE WHEN enrichment_status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN enrichment_status = 'complete' THEN 1 END) as complete,
        COUNT(CASE WHEN enrichment_status = 'failed' THEN 1 END) as failed
      FROM listed_stocks
    `);

    const row = stats as any;
    return {
      total: parseInt(row.total) || 0,
      withCin: parseInt(row.with_cin) || 0,
      withPan: parseInt(row.with_pan) || 0,
      withBroadSector: parseInt(row.with_broad_sector) || 0,
      withPe: parseInt(row.with_pe) || 0,
      pending: parseInt(row.pending) || 0,
      complete: parseInt(row.complete) || 0,
      failed: parseInt(row.failed) || 0,
    };
  }
}

export const stockEnrichmentService = new StockEnrichmentService();
