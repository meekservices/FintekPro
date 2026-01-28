/**
 * Portfolio Storage Service
 * 
 * Centralizes all portfolio CRUD operations for:
 * - Prospect portfolios
 * - Client portfolios
 * - External holdings sync
 * 
 * Provides unified upsert logic with conflict resolution
 */

import { db } from '../db';
import { portfolios, portfolioHoldings, externalHoldings, prospectClients } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { 
  UnifiedHolding, 
  PortfolioStorageOptions, 
  PortfolioUpsertResult,
  ImportSource,
  AllocationBreakdown
} from './unified-portfolio-types';
import { holdingNormalizationService } from './holding-normalization-service';
import { prospectPortfolioSyncService } from './prospect-portfolio-sync-service';

class PortfolioStorageService {

  async upsertProspectPortfolio(
    prospectId: string,
    holdings: UnifiedHolding[],
    options: PortfolioStorageOptions
  ): Promise<PortfolioUpsertResult> {
    const [prospect] = await db
      .select()
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);
    
    if (!prospect) {
      throw new Error(`Prospect not found: ${prospectId}`);
    }
    
    const [existingPortfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.prospectId, prospectId))
      .limit(1);
    
    const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
    const summary = holdingNormalizationService.computeSummary(holdings);
    
    let portfolioId: string;
    let isNewPortfolio = false;
    let holdingsDeleted = 0;
    
    if (existingPortfolio) {
      portfolioId = existingPortfolio.id;
      
      if (options.replaceExisting !== false) {
        const deleted = await db
          .delete(portfolioHoldings)
          .where(eq(portfolioHoldings.portfolioId, portfolioId))
          .returning();
        holdingsDeleted = deleted.length;
      }
      
      await db
        .update(portfolios)
        .set({
          totalValue: totalValue.toString(),
          source: this.mapSourceToStorageFormat(options.source),
          sourceFileName: options.sourceFileName,
          updatedAt: new Date()
        })
        .where(eq(portfolios.id, portfolioId));
    } else {
      isNewPortfolio = true;
      const [newPortfolio] = await db
        .insert(portfolios)
        .values({
          id: nanoid(),
          prospectId,
          name: `${prospect.name}'s Portfolio`,
          totalValue: totalValue.toString(),
          source: this.mapSourceToStorageFormat(options.source),
          sourceFileName: options.sourceFileName,
          isDefault: true,
          isVerified: false
        })
        .returning();
      portfolioId = newPortfolio.id;
    }
    
    const holdingRecords = holdings.map(h => ({
      id: nanoid(),
      portfolioId,
      symbol: h.symbol || h.isin || '',
      name: h.name,
      assetType: this.mapAssetTypeToStorage(h.assetType),
      quantity: h.quantity.toString(),
      avgPrice: (h.avgCostPerUnit || 0).toString(),
      currentValue: (h.currentValue || 0).toString(),
      isin: h.isin,
      folioNumber: h.folioNumber,
      schemeCode: h.schemeCode,
      purchaseDate: h.purchaseDate ? new Date(h.purchaseDate) : null,
      source: this.mapSourceToStorageFormat(options.source),
      confidenceScore: options.confidenceScore
    }));
    
    if (holdingRecords.length > 0) {
      await db.insert(portfolioHoldings).values(holdingRecords);
    }
    
    await this.updateProspectUploadedPortfolio(prospectId, holdings, summary, options);
    
    // Also update currentPortfolio JSON for unified storage (single source of truth)
    const normalizedHoldings = holdings.map(h => ({
      id: nanoid(),
      name: h.name,
      isin: h.isin,
      symbol: h.symbol,
      assetType: h.assetType || 'equity',
      quantity: h.quantity || 0,
      averageCost: h.avgCostPerUnit || 0,
      currentValue: h.currentValue || 0,
      investedValue: h.investedValue,
      folioNumber: h.folioNumber,
      broker: h.broker,
      purchaseDate: h.purchaseDate,
      confidenceScore: options.confidenceScore,
    }));
    
    await prospectPortfolioSyncService.replaceAllHoldings(prospectId, normalizedHoldings);
    
    return {
      portfolioId,
      holdingsInserted: holdingRecords.length,
      holdingsUpdated: 0,
      holdingsDeleted,
      isNewPortfolio
    };
  }

  async upsertUserPortfolio(
    userId: string,
    holdings: UnifiedHolding[],
    options: PortfolioStorageOptions
  ): Promise<PortfolioUpsertResult> {
    const [existingPortfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, userId))
      .limit(1);
    
    const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
    
    let portfolioId: string;
    let isNewPortfolio = false;
    let holdingsDeleted = 0;
    
    if (existingPortfolio) {
      portfolioId = existingPortfolio.id;
      
      if (options.replaceExisting !== false) {
        const deleted = await db
          .delete(portfolioHoldings)
          .where(eq(portfolioHoldings.portfolioId, portfolioId))
          .returning();
        holdingsDeleted = deleted.length;
      }
      
      await db
        .update(portfolios)
        .set({
          totalValue: totalValue.toString(),
          source: this.mapSourceToStorageFormat(options.source),
          sourceFileName: options.sourceFileName,
          updatedAt: new Date()
        })
        .where(eq(portfolios.id, portfolioId));
    } else {
      isNewPortfolio = true;
      const [newPortfolio] = await db
        .insert(portfolios)
        .values({
          id: nanoid(),
          userId,
          name: 'My Portfolio',
          totalValue: totalValue.toString(),
          source: this.mapSourceToStorageFormat(options.source),
          sourceFileName: options.sourceFileName,
          isDefault: true
        })
        .returning();
      portfolioId = newPortfolio.id;
    }
    
    const holdingRecords = holdings.map(h => ({
      id: nanoid(),
      portfolioId,
      symbol: h.symbol || h.isin || '',
      name: h.name,
      assetType: this.mapAssetTypeToStorage(h.assetType),
      quantity: h.quantity.toString(),
      avgPrice: (h.avgCostPerUnit || 0).toString(),
      currentValue: (h.currentValue || 0).toString(),
      isin: h.isin,
      folioNumber: h.folioNumber,
      schemeCode: h.schemeCode,
      purchaseDate: h.purchaseDate ? new Date(h.purchaseDate) : null,
      source: this.mapSourceToStorageFormat(options.source)
    }));
    
    if (holdingRecords.length > 0) {
      await db.insert(portfolioHoldings).values(holdingRecords);
    }
    
    return {
      portfolioId,
      holdingsInserted: holdingRecords.length,
      holdingsUpdated: 0,
      holdingsDeleted,
      isNewPortfolio
    };
  }

  async syncExternalHoldings(
    userId: string,
    holdings: UnifiedHolding[],
    source: ImportSource,
    replaceExisting: boolean = true
  ): Promise<{ imported: number; skipped: number }> {
    const sourceStr = this.mapSourceToStorageFormat(source);
    
    if (replaceExisting) {
      await db
        .delete(externalHoldings)
        .where(and(
          eq(externalHoldings.userId, userId),
          eq(externalHoldings.source, sourceStr)
        ));
    }
    
    let imported = 0;
    let skipped = 0;
    
    for (const h of holdings) {
      try {
        await db.insert(externalHoldings).values({
          id: nanoid(),
          userId,
          symbol: h.symbol || h.isin || h.name.substring(0, 20),
          name: h.name,
          assetType: this.mapAssetTypeToStorage(h.assetType),
          quantity: h.quantity.toString(),
          avgPrice: (h.avgCostPerUnit || 0).toString(),
          currentValue: (h.currentValue || 0).toString(),
          source: sourceStr,
          lastSyncedAt: new Date()
        });
        imported++;
      } catch (error) {
        console.error(`[PortfolioStorage] Failed to insert holding: ${h.name}`, error);
        skipped++;
      }
    }
    
    return { imported, skipped };
  }

  async getProspectPortfolio(prospectId: string): Promise<{ portfolio: any; holdings: any[] } | null> {
    // Read from unified currentPortfolio JSON for prospects (single source of truth)
    const holdings = await prospectPortfolioSyncService.getHoldings(prospectId);
    
    // Get the prospect's portfolio metadata
    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.prospectId, prospectId))
      .limit(1);
    
    // If no portfolio metadata exists but holdings exist in currentPortfolio, create a virtual portfolio object
    if (!portfolio && holdings.length > 0) {
      const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
      return {
        portfolio: {
          id: `prospect-${prospectId}`,
          prospectId,
          name: "Prospect Portfolio",
          totalValue: totalValue.toString(),
          source: 'currentPortfolio',
          isDefault: true
        },
        holdings
      };
    }
    
    if (!portfolio) return null;
    
    return { portfolio, holdings };
  }

  async getUserPortfolio(userId: string): Promise<{ portfolio: any; holdings: any[] } | null> {
    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, userId))
      .limit(1);
    
    if (!portfolio) return null;
    
    const holdings = await db
      .select()
      .from(portfolioHoldings)
      .where(eq(portfolioHoldings.portfolioId, portfolio.id));
    
    return { portfolio, holdings };
  }

  async deleteProspectPortfolio(prospectId: string): Promise<boolean> {
    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.prospectId, prospectId))
      .limit(1);
    
    if (!portfolio) return false;
    
    await db.delete(portfolioHoldings).where(eq(portfolioHoldings.portfolioId, portfolio.id));
    await db.delete(portfolios).where(eq(portfolios.id, portfolio.id));
    
    await db
      .update(prospectClients)
      .set({ uploadedPortfolio: null, updatedAt: new Date() })
      .where(eq(prospectClients.id, prospectId));
    
    return true;
  }

  private async updateProspectUploadedPortfolio(
    prospectId: string,
    holdings: UnifiedHolding[],
    summary: ReturnType<typeof holdingNormalizationService.computeSummary>,
    options: PortfolioStorageOptions
  ): Promise<void> {
    const uploadedPortfolio = {
      uploadedAt: new Date().toISOString(),
      fileName: options.sourceFileName,
      fileType: this.getFileTypeFromSource(options.source),
      parsedHoldings: holdings.map(h => ({
        name: h.name,
        quantity: h.quantity,
        value: h.currentValue,
        type: h.assetType
      })),
      totalValue: summary.totalCurrentValue,
      parsingStatus: 'completed',
      allocation: summary.allocation,
      confidenceScore: options.confidenceScore
    };
    
    await db
      .update(prospectClients)
      .set({
        uploadedPortfolio,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));
  }

  private mapSourceToStorageFormat(source: ImportSource): string {
    const mapping: Record<ImportSource, string> = {
      'cas_statement': 'CAS',
      'broker_pdf': 'uploaded',
      'wealthy_url': 'WEALTHY_IN',
      'bse_star_api': 'BSE_STAR',
      'manual_entry': 'manual',
      'csv_upload': 'CSV',
      'external_sync': 'external'
    };
    return mapping[source] || 'unknown';
  }

  private mapAssetTypeToStorage(assetType: string): string {
    const mapping: Record<string, string> = {
      'equity': 'equity',
      'mutual_fund': 'mutual_fund',
      'etf': 'etf',
      'bond': 'bond',
      'debt': 'debt',
      'gold': 'gold',
      'cash': 'cash',
      'fd': 'fd',
      'hybrid': 'hybrid',
      'pms': 'pms',
      'aif': 'aif',
      'reit': 'reit',
      'invit': 'invit',
      'unlisted': 'unlisted',
      'other': 'others'
    };
    return mapping[assetType] || 'others';
  }

  private getFileTypeFromSource(source: ImportSource): string {
    switch (source) {
      case 'cas_statement':
      case 'broker_pdf':
        return 'pdf';
      case 'csv_upload':
        return 'csv';
      case 'wealthy_url':
        return 'html';
      default:
        return 'api';
    }
  }
}

export const portfolioStorageService = new PortfolioStorageService();
