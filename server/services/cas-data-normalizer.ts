/**
 * CAS Data Normalizer Service
 * 
 * Transforms parsed CAS data into FintekPro's portfolio/holdings schema
 * Handles:
 * - CAMS vs KFin format differences
 * - Data source tracking (cams/kfintech)
 * - Deduplication logic for multiple CAS sources
 * - Merging with existing portfolio holdings
 */

import { db } from '../db';
import { 
  portfolios,
  comprehensiveHoldings,
  type InsertComprehensiveHolding,
  type ComprehensiveHolding
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import type { ParsedCASData, FolioHolding, CASProvider } from './cas-parser-service';
import { createLogger } from './logger';

const logger = createLogger({ service: 'cas-normalizer' });

export interface NormalizationResult {
  success: boolean;
  totalFolios: number;
  insertedHoldings: number;
  updatedHoldings: number;
  skippedDuplicates: number;
  errors: string[];
  warnings: string[];
}

export interface MergeOptions {
  overwriteExisting: boolean;
  addOnlyNewFolios: boolean;
  respectManualEntries: boolean;
  mergeStrategy: 'latest' | 'sum' | 'max';
}

export class CASDataNormalizer {
  
  async normalizeCASData(
    userId: string,
    portfolioId: string,
    parsedData: ParsedCASData,
    options: Partial<MergeOptions> = {}
  ): Promise<NormalizationResult> {
    const result: NormalizationResult = {
      success: false,
      totalFolios: parsedData.folios.length,
      insertedHoldings: 0,
      updatedHoldings: 0,
      skippedDuplicates: 0,
      errors: [],
      warnings: []
    };

    const mergeOptions: MergeOptions = {
      overwriteExisting: options.overwriteExisting ?? true,
      addOnlyNewFolios: options.addOnlyNewFolios ?? false,
      respectManualEntries: options.respectManualEntries ?? true,
      mergeStrategy: options.mergeStrategy ?? 'latest'
    };

    try {
      logger.info('Normalizing CAS data', { 
        userId, 
        portfolioId, 
        provider: parsedData.provider,
        folios: parsedData.folios.length 
      });

      const portfolio = await db
        .select()
        .from(portfolios)
        .where(and(
          eq(portfolios.id, portfolioId),
          eq(portfolios.userId, userId)
        ))
        .limit(1);

      if (portfolio.length === 0) {
        result.errors.push('Portfolio not found or does not belong to user');
        return result;
      }

      const existingHoldings = await this.getExistingCASHoldings(userId, portfolioId);
      const existingFolioMap = new Map<string, ComprehensiveHolding>();
      
      for (const holding of existingHoldings) {
        if (holding.folio) {
          existingFolioMap.set(holding.folio, holding);
        }
      }

      for (const folio of parsedData.folios) {
        try {
          const normalized = this.normalizeFolio(
            userId,
            portfolioId,
            folio,
            parsedData.provider
          );

          const existingHolding = folio.folioNumber 
            ? existingFolioMap.get(folio.folioNumber)
            : undefined;

          if (existingHolding) {
            if (mergeOptions.respectManualEntries && existingHolding.dataSource === 'manual') {
              logger.info('Skipping manual entry', { folio: folio.folioNumber });
              result.skippedDuplicates++;
              continue;
            }

            if (mergeOptions.overwriteExisting) {
              await db
                .update(comprehensiveHoldings)
                .set({
                  ...normalized,
                  updatedAt: new Date()
                })
                .where(eq(comprehensiveHoldings.id, existingHolding.id));
              
              result.updatedHoldings++;
              logger.info('Updated existing holding', { folio: folio.folioNumber });
            } else {
              result.skippedDuplicates++;
            }
          } else {
            if (!mergeOptions.addOnlyNewFolios || !existingFolioMap.has(folio.folioNumber)) {
              await db
                .insert(comprehensiveHoldings)
                .values(normalized);
              
              result.insertedHoldings++;
              logger.info('Inserted new holding', { folio: folio.folioNumber });
            }
          }
        } catch (error: any) {
          logger.error('Error processing folio', { folio: folio.folioNumber, error });
          result.errors.push(`Folio ${folio.folioNumber}: ${error.message}`);
        }
      }

      result.success = result.errors.length === 0 || result.insertedHoldings > 0 || result.updatedHoldings > 0;

      logger.info('CAS normalization completed', result);
      
      return result;

    } catch (error: any) {
      logger.error('CAS normalization failed', error);
      result.errors.push(`Normalization failed: ${error.message}`);
      return result;
    }
  }

  private normalizeFolio(
    userId: string,
    portfolioId: string,
    folio: FolioHolding,
    provider: CASProvider
  ): InsertComprehensiveHolding {
    const dataSource = provider === 'CAMS' ? 'cams' : 'kfintech';
    
    const normalized: InsertComprehensiveHolding = {
      portfolioId,
      userId,
      holdingDate: new Date().toISOString().split('T')[0],
      
      symbol: folio.scheme.isin || folio.scheme.schemeName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 10),
      isin: folio.scheme.isin || null,
      assetName: folio.scheme.schemeName,
      assetType: 'mutual_fund',
      assetClass: this.determineAssetClass(folio.scheme.schemeType, folio.scheme.schemeName),
      subAssetClass: folio.scheme.schemeOption,
      
      quantity: null,
      units: folio.units.toString(),
      avgPrice: folio.costValue && folio.units > 0 
        ? (folio.costValue / folio.units).toFixed(4)
        : null,
      currentPrice: folio.nav.toString(),
      marketValue: folio.valueAtNav.toString(),
      investedValue: folio.costValue?.toString() || null,
      gainLoss: folio.costValue 
        ? (folio.valueAtNav - folio.costValue).toFixed(2)
        : null,
      gainLossPercent: folio.costValue && folio.costValue > 0
        ? (((folio.valueAtNav - folio.costValue) / folio.costValue) * 100).toFixed(4)
        : null,
      
      dataSource,
      sourceAccountNumber: folio.folioNumber,
      folio: folio.folioNumber,
      dematAccountNumber: null,
      
      sector: this.extractSector(folio.scheme.schemeName),
      industry: null,
      marketCap: null,
      beta: null,
      dividendYield: null,
      peRatio: null,
      maturityDate: null,
      interestRate: null,
      
      contributionFrequency: null,
      nomineeName: null,
      nomineeRelation: null,
      
      metadata: {
        casProvider: provider,
        registrar: folio.registrar,
        amcName: folio.scheme.amcName,
        schemePlan: folio.scheme.schemePlan,
        schemeOption: folio.scheme.schemeOption,
        kycStatus: folio.kycStatus,
        advisor: folio.scheme.advisor,
        arn: folio.scheme.arn,
        euin: folio.scheme.euin,
        dateOfFirstInvestment: folio.dateOfFirstInvestment,
        dateOfLastInvestment: folio.dateOfLastInvestment,
        importedAt: new Date().toISOString()
      }
    };

    return normalized;
  }

  private determineAssetClass(schemeType: string, schemeName: string): string {
    const nameLower = schemeName.toLowerCase();
    
    if (schemeType === 'Equity') {
      if (nameLower.includes('large cap') || nameLower.includes('bluechip')) {
        return 'large_cap';
      } else if (nameLower.includes('mid cap')) {
        return 'mid_cap';
      } else if (nameLower.includes('small cap')) {
        return 'small_cap';
      } else if (nameLower.includes('multi cap') || nameLower.includes('flexi cap')) {
        return 'multi_cap';
      }
      return 'equity';
    }
    
    if (schemeType === 'Debt') return 'debt';
    if (schemeType === 'Hybrid' || schemeType === 'Balanced') return 'hybrid';
    if (schemeType === 'Liquid') return 'liquid';
    
    return 'other';
  }

  private extractSector(schemeName: string): string | null {
    const nameLower = schemeName.toLowerCase();
    
    const sectorKeywords: Record<string, string> = {
      'pharma': 'Healthcare',
      'health': 'Healthcare',
      'technology': 'Technology',
      'tech': 'Technology',
      'banking': 'Banking',
      'financial': 'Financial Services',
      'infrastructure': 'Infrastructure',
      'consumption': 'Consumer Goods',
      'fmcg': 'FMCG',
      'auto': 'Automotive',
      'energy': 'Energy'
    };
    
    for (const [keyword, sector] of Object.entries(sectorKeywords)) {
      if (nameLower.includes(keyword)) {
        return sector;
      }
    }
    
    return null;
  }

  private async getExistingCASHoldings(
    userId: string,
    portfolioId: string
  ): Promise<ComprehensiveHolding[]> {
    const holdings = await db
      .select()
      .from(comprehensiveHoldings)
      .where(and(
        eq(comprehensiveHoldings.userId, userId),
        eq(comprehensiveHoldings.portfolioId, portfolioId)
      ));

    return holdings.filter(h => 
      h.dataSource === 'cams' || h.dataSource === 'kfintech'
    );
  }
}

export const casDataNormalizer = new CASDataNormalizer();
