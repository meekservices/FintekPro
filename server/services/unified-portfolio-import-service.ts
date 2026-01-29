/**
 * Unified Portfolio Import Service
 * 
 * Single entry point for all portfolio import methods:
 * - PDF/HTML file upload (CAS, broker statements)
 * - URL import (Wealthy.in)
 * - API fetch (BSE STAR MFD)
 * - Manual entry
 * 
 * Orchestrates parsing, normalization, and storage
 */

import type { 
  UnifiedHolding, 
  UnifiedImportResult,
  ImportSource,
  PortfolioStorageOptions
} from './unified-portfolio-types';
import { createEmptyImportResult } from './unified-portfolio-types';
import { holdingNormalizationService, type IsinEnrichmentResult } from './holding-normalization-service';
import { portfolioStorageService } from './portfolio-storage-service';
import { unifiedPDFParser, type SemanticHolding } from './unified-pdf-parser';
import { casStatementService, type CASHolding } from './cas-statement-service';
import { parsePDFPortfolio, parseURLPortfolio, type ImportedHolding } from './portfolio-parser';
import { WealthyImportService, type WealthyHolding } from './wealthy-import-service';

class UnifiedPortfolioImportService {
  private wealthyService: WealthyImportService;

  constructor() {
    this.wealthyService = new WealthyImportService();
  }

  async importFromPDF(
    buffer: Buffer,
    fileName: string,
    options?: { detectCAS?: boolean; enableDualRun?: boolean }
  ): Promise<UnifiedImportResult> {
    const result = createEmptyImportResult('broker_pdf');
    result.sourceFileName = fileName;
    const startTime = Date.now();

    try {
      const parseResult = await unifiedPDFParser.extractTextSafe(buffer);
      if (!parseResult.success || !parseResult.result) {
        result.errors.push(parseResult.error || 'Failed to parse PDF');
        result.parsingStatus = 'failed';
        return result;
      }

      const text = parseResult.result.text;
      result.rawTextLength = text.length;

      const isCAS = options?.detectCAS !== false && this.detectCASStatement(text);
      
      if (isCAS) {
        return this.importFromCASText(text, fileName);
      }

      // Use unified parser for all PDF parsing
      console.log('[Parser] Using unified PDF parser');
      const parserResult = await unifiedPDFParser.parseDocument(buffer, { fileName });
      
      if (!parserResult.success || parserResult.confidenceScore < 0.5) {
        console.warn(`[Parser] Unified parser result insufficient (success=${parserResult.success}, confidence=${parserResult.confidenceScore})`);
        // Fall through to legacy parsing
      } else {
        // Convert holdings to unified format with lot information
        result.holdings = parserResult.holdings.map(h => {
          const matchingLots = (parserResult.holdingLots || []).filter(lot => 
            lot.id?.startsWith(h.isin || '') || 
            lot.id?.includes(h.folioNumber || '')
          );
          
          return {
            id: crypto.randomUUID(),
            isin: h.isin || '',
            schemeName: h.schemeName,
            folioNumber: h.folioNumber,
            units: h.units,
            investedValue: h.investedValue || 0,
            currentValue: h.currentValue || 0,
            nav: h.nav || 0,
            unrealizedGain: h.unrealizedGain || 0,
            unrealizedGainPercent: h.unrealizedGainPercent || 0,
            purchaseDate: h.purchaseDate,
            confidenceScore: h.confidenceScore,
            assetType: 'mutual_fund' as const,
            source: 'pdf_upload' as const,
            lots: matchingLots.length > 0 ? matchingLots.map(lot => ({
              purchaseDate: lot.purchaseDate,
              quantity: lot.units,
              purchaseNav: lot.purchaseNav,
              purchaseValue: lot.purchaseValue,
              source: lot.source,
              status: lot.status,
            })) : undefined,
          };
        });

        // Enrich holdings with ISIN-based metadata (category, fundHouse, currentNav, exitLoad)
        result.holdings = await this.enrichHoldingsWithIsin(result.holdings, parserResult.holdings);
        
        (result as any).holdingLots = parserResult.holdingLots;
        
        result.summary = holdingNormalizationService.computeSummary(result.holdings);
        result.confidenceScore = parserResult.confidenceScore;
        result.success = parserResult.success;
        result.parsingStatus = parserResult.success ? 'completed' : 'needs_review';
        result.importedCount = parserResult.holdings.length;
        result.errors = parserResult.errors;
        result.capturedAt = new Date().toISOString();
        
        (result as any).profile = parserResult.profile;
        (result as any).parsingMetrics = parserResult.parsingMetrics;
        
        return result;
      }

      // Fallback to legacy portfolio parser if unified parser fails
      const portfolioResult = await parsePDFPortfolio(buffer, fileName);
      
      result.holdings = this.convertImportedHoldings(portfolioResult.holdings);
      result.summary = holdingNormalizationService.computeSummary(result.holdings);
      result.brokerDetected = portfolioResult.brokerDetected || undefined;
      result.confidenceScore = portfolioResult.confidenceScore;
      result.success = portfolioResult.success;
      result.parsingStatus = portfolioResult.success ? 'completed' : 'needs_review';
      result.expectedCount = portfolioResult.expectedCount;
      result.importedCount = portfolioResult.importedCount;
      result.skippedCount = portfolioResult.unimportedCount;
      result.needsManualReview = portfolioResult.needsManualReview;
      result.errors = portfolioResult.errors;
      result.capturedAt = new Date().toISOString();

      return result;
    } catch (error: any) {
      result.errors.push(error.message || 'Unknown error during PDF import');
      result.parsingStatus = 'failed';
      return result;
    }
  }

  async importFromCASText(text: string, fileName?: string): Promise<UnifiedImportResult> {
    const result = createEmptyImportResult('cas_statement');
    result.sourceFileName = fileName;
    result.rawTextLength = text.length;

    try {
      const casResult = await casStatementService.parseStatement(text);
      
      if (!casResult.success) {
        result.errors.push('Failed to parse CAS statement');
        result.parsingStatus = 'failed';
        return result;
      }

      result.investor = {
        name: casResult.investor.name,
        email: casResult.investor.email,
        pan: casResult.investor.pan,
        mobile: casResult.investor.mobile,
        address: casResult.investor.address
      };

      result.holdings = this.convertCASHoldings(casResult.holdings);
      
      // Enrich CAS holdings with ISIN-based metadata
      result.holdings = await this.enrichCASHoldingsWithIsin(result.holdings);
      
      result.summary = holdingNormalizationService.computeSummary(result.holdings);
      result.summary.registrarBreakdown = {
        cams: casResult.summary.registrarBreakdown.cams,
        kfintech: casResult.summary.registrarBreakdown.kfintech,
        franklin: { count: 0, value: 0 },
        other: { count: 0, value: 0 }
      };
      
      result.success = true;
      result.parsingStatus = 'completed';
      result.confidenceScore = 95;
      result.importedCount = result.holdings.length;
      result.capturedAt = new Date().toISOString();

      return result;
    } catch (error: any) {
      result.errors.push(error.message || 'Unknown error during CAS import');
      result.parsingStatus = 'failed';
      return result;
    }
  }

  async importFromWealthyURL(url: string): Promise<UnifiedImportResult> {
    const result = createEmptyImportResult('wealthy_url');
    result.sourceUrl = url;

    try {
      const wealthyResult = await this.wealthyService.fetchAndParsePortfolio(url);
      
      result.investor = {
        name: wealthyResult.investor.name,
        pan: wealthyResult.investor.pan
      };

      result.holdings = this.convertWealthyHoldings(wealthyResult.holdings);
      result.summary = holdingNormalizationService.computeSummary(result.holdings);
      result.success = true;
      result.parsingStatus = 'completed';
      result.confidenceScore = 90;
      result.importedCount = result.holdings.length;
      result.capturedAt = new Date().toISOString();

      return result;
    } catch (error: any) {
      result.errors.push(error.message || 'Failed to import from Wealthy.in');
      result.parsingStatus = 'failed';
      return result;
    }
  }

  async importFromHTML(htmlContent: string, fileName?: string): Promise<UnifiedImportResult> {
    const result = createEmptyImportResult('broker_pdf');
    result.sourceFileName = fileName;

    try {
      const portfolioResult = await parseURLPortfolio(htmlContent);
      
      result.holdings = this.convertImportedHoldings(portfolioResult.holdings);
      result.summary = holdingNormalizationService.computeSummary(result.holdings);
      result.brokerDetected = portfolioResult.brokerDetected || undefined;
      result.confidenceScore = portfolioResult.confidenceScore;
      result.success = portfolioResult.success;
      result.parsingStatus = portfolioResult.success ? 'completed' : 'needs_review';
      result.errors = portfolioResult.errors;
      result.capturedAt = new Date().toISOString();

      return result;
    } catch (error: any) {
      result.errors.push(error.message || 'Failed to parse HTML');
      result.parsingStatus = 'failed';
      return result;
    }
  }

  async importManualHoldings(holdings: Partial<UnifiedHolding>[]): Promise<UnifiedImportResult> {
    const result = createEmptyImportResult('manual_entry');

    try {
      result.holdings = holdings.map(h => {
        const enriched = holdingNormalizationService.enrichHolding(h);
        return holdingNormalizationService.calculateGains(enriched);
      });
      
      result.summary = holdingNormalizationService.computeSummary(result.holdings);
      result.success = true;
      result.parsingStatus = 'completed';
      result.confidenceScore = 100;
      result.importedCount = result.holdings.length;
      result.capturedAt = new Date().toISOString();

      return result;
    } catch (error: any) {
      result.errors.push(error.message || 'Failed to process manual holdings');
      result.parsingStatus = 'failed';
      return result;
    }
  }

  async importFromURL(url: string): Promise<UnifiedImportResult> {
    const result = createEmptyImportResult('wealthy_url');
    result.sourceUrl = url;

    try {
      // Check if it's a Wealthy.in URL
      if (url.includes('wealthy.in')) {
        return this.importFromWealthyURL(url);
      }

      // Fetch HTML from URL
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        result.errors.push(`Failed to fetch URL: ${response.status}`);
        result.parsingStatus = 'failed';
        return result;
      }

      const html = await response.text();
      const urlObj = new URL(url);
      
      const portfolioResult = await parseURLPortfolio(html, url);
      
      result.holdings = this.convertImportedHoldings(portfolioResult.holdings);
      result.summary = holdingNormalizationService.computeSummary(result.holdings);
      result.brokerDetected = portfolioResult.brokerDetected || urlObj.hostname;
      result.confidenceScore = portfolioResult.confidenceScore;
      result.success = portfolioResult.success;
      result.parsingStatus = portfolioResult.success ? 'completed' : 'needs_review';
      result.errors = portfolioResult.errors;
      result.capturedAt = new Date().toISOString();

      return result;
    } catch (error: any) {
      result.errors.push(error.message || 'Failed to import from URL');
      result.parsingStatus = 'failed';
      return result;
    }
  }

  async importAndSaveForProspect(
    prospectId: string,
    buffer: Buffer,
    fileName: string,
    options?: { detectCAS?: boolean; replaceExisting?: boolean }
  ): Promise<UnifiedImportResult & { storageResult?: any }> {
    const importResult = await this.importFromPDF(buffer, fileName, options);
    
    if (!importResult.success || importResult.holdings.length === 0) {
      return importResult;
    }

    const storageOptions: PortfolioStorageOptions = {
      prospectId,
      source: importResult.source,
      sourceFileName: fileName,
      replaceExisting: options?.replaceExisting !== false,
      confidenceScore: importResult.confidenceScore
    };

    const storageResult = await portfolioStorageService.upsertProspectPortfolio(
      prospectId,
      importResult.holdings,
      storageOptions
    );

    return {
      ...importResult,
      storageResult
    };
  }

  async importWealthyAndSaveForUser(
    userId: string,
    url: string,
    replaceExisting: boolean = true
  ): Promise<UnifiedImportResult & { storageResult?: any }> {
    const importResult = await this.importFromWealthyURL(url);
    
    if (!importResult.success || importResult.holdings.length === 0) {
      return importResult;
    }

    const storageResult = await portfolioStorageService.syncExternalHoldings(
      userId,
      importResult.holdings,
      'wealthy_url',
      replaceExisting
    );

    return {
      ...importResult,
      storageResult: {
        imported: storageResult.imported,
        skipped: storageResult.skipped
      }
    };
  }

  private detectCASStatement(text: string): boolean {
    return /Consolidated\s*Account\s*Statement/i.test(text) ||
           /CAMS.*Statement/i.test(text) ||
           /KFintech.*Statement/i.test(text) ||
           /CAS\s*Report/i.test(text);
  }

  private convertImportedHoldings(holdings: ImportedHolding[]): UnifiedHolding[] {
    return holdings.map(h => {
      const unified: UnifiedHolding = {
        id: h.id,
        name: h.name,
        isin: h.isin,
        symbol: h.symbol,
        folioNumber: h.folioNumber,
        assetType: holdingNormalizationService.normalizeAssetType(h.assetType),
        quantity: h.quantity,
        avgCostPerUnit: h.averageCost,
        investedValue: h.investedValue,
        currentNav: h.currentNav,
        currentValue: h.currentValue,
        unrealizedGain: h.unrealizedGain,
        unrealizedGainPercent: h.unrealizedGainPercent,
        broker: h.broker,
        confidenceScore: h.confidenceScore,
        instrumentType: h.instrumentType,
        regulator: h.regulator,
        isEdgeCase: h.isEdgeCase
      };
      return holdingNormalizationService.calculateGains(unified);
    });
  }

  private convertCASHoldings(holdings: CASHolding[]): UnifiedHolding[] {
    return holdings.map(h => {
      const unified: UnifiedHolding = {
        id: h.id,
        name: h.schemeName,
        isin: h.isin,
        schemeCode: h.schemeCode,
        folioNumber: h.folioNumber,
        assetType: holdingNormalizationService.normalizeAssetType(h.assetType),
        quantity: h.unitBalance,
        avgCostPerUnit: h.avgCostPerUnit,
        investedValue: h.costValue,
        currentNav: h.nav,
        currentValue: h.marketValue,
        unrealizedGain: h.unrealizedGain,
        unrealizedGainPercent: h.unrealizedGainPercent,
        amcName: h.amcName,
        registrar: h.registrar === 'UNKNOWN' ? 'OTHER' : h.registrar,
        navDate: h.navDate,
        planType: h.planType,
        optionType: h.optionType,
        isDemat: h.isDemat
      };
      return unified;
    });
  }

  private convertWealthyHoldings(holdings: WealthyHolding[]): UnifiedHolding[] {
    return holdings.map(h => {
      const unified: UnifiedHolding = {
        name: h.fundName,
        folioNumber: h.folio,
        assetType: holdingNormalizationService.normalizeAssetTypeFromMFCategory(h.category),
        quantity: 0,
        investedValue: h.invested,
        currentValue: h.currentValue,
        unrealizedGain: h.returns,
        unrealizedGainPercent: h.invested > 0 ? (h.returns / h.invested) * 100 : 0,
        broker: 'WEALTHY_IN',
        planType: h.growthType?.includes('Direct') ? 'Direct' : 'Regular',
        optionType: h.growthType?.includes('Growth') ? 'Growth' : 'IDCW',
        isDemat: h.isDemat
      };
      return unified;
    });
  }

  /**
   * Enrich holdings with ISIN-based metadata from database
   * Adds category, fundHouse, currentNav, exitLoad for capital gains calculations
   */
  private async enrichHoldingsWithIsin(
    holdings: any[], 
    semanticHoldings: SemanticHolding[]
  ): Promise<any[]> {
    // Collect all ISINs that need enrichment
    const isins = holdings
      .map(h => h.isin)
      .filter((isin): isin is string => !!isin && isin.length >= 10);

    if (isins.length === 0) {
      console.log('[Import] No ISINs to enrich');
      return holdings;
    }

    // Batch lookup enrichment data
    const enrichmentMap = await holdingNormalizationService.enrichByIsins(isins);
    
    let enrichedCount = 0;
    const enrichedHoldings = holdings.map((holding, index) => {
      const isin = holding.isin;
      if (!isin) return holding;

      const enrichment = enrichmentMap.get(isin);
      const semantic = semanticHoldings[index];

      if (enrichment?.found) {
        enrichedCount++;
        
        // Calculate holding period (days since purchase = today - purchaseDate)
        const holdingPeriodDays = this.calculateHoldingPeriodDays(holding.purchaseDate);
        
        // Exit load from database (primary source by ISIN)
        const exitLoadApplicableDays = enrichment.exitLoadDays;
        const exitLoadPercent = enrichment.exitLoadPercent;
        
        // Determine if exit load is currently applicable
        const exitLoadApplicable = holdingPeriodDays !== null && 
          exitLoadApplicableDays !== undefined && 
          holdingPeriodDays < exitLoadApplicableDays;

        return {
          ...holding,
          // Category for STCG/LTCG determination
          category: enrichment.category,
          assetType: enrichment.category ? 
            holdingNormalizationService.normalizeAssetTypeFromMFCategory(enrichment.category) : 
            holding.assetType,
          // Fund metadata
          fundHouse: enrichment.fundHouse || holding.amcName,
          amcName: enrichment.fundHouse || holding.amcName,
          schemeCode: enrichment.schemeCode || holding.schemeCode,
          // Use database NAV if more recent
          currentNav: enrichment.currentNav || holding.nav,
          navDate: enrichment.navDate || holding.navDate,
          // Holding period - days since purchase (today - purchaseDate)
          holdingPeriodDays,
          // Exit load from database (primary source by ISIN)
          exitLoadPercent,
          exitLoadApplicableDays,
          exitLoadApplicable,
          // Plan and option types
          planType: holding.planType || enrichment.planType,
          optionType: holding.optionType || enrichment.optionType,
          // Returns data
          returns1y: enrichment.returns1y,
          returns3y: enrichment.returns3y,
          returns5y: enrichment.returns5y,
          riskLevel: enrichment.riskLevel,
          // Flag for enrichment status
          enrichedFromDb: true,
        };
      }

      // Still add parsed exit load even if DB enrichment failed
      if (semantic?.exitLoadText) {
        const holdingPeriodDays = this.calculateHoldingPeriodDays(holding.purchaseDate);
        const exitLoadApplicable = holdingPeriodDays !== null && 
          semantic.exitLoadDays !== undefined && 
          holdingPeriodDays < semantic.exitLoadDays;

        return {
          ...holding,
          holdingPeriodDays,
          exitLoadPercent: semantic.exitLoadPercent,
          exitLoadApplicableDays: semantic.exitLoadDays,
          exitLoadText: semantic.exitLoadText,
          exitLoadApplicable,
          enrichedFromDb: false,
        };
      }

      // Add holding period even without exit load data
      const holdingPeriodDays = this.calculateHoldingPeriodDays(holding.purchaseDate);
      return {
        ...holding,
        holdingPeriodDays,
      };
    });

    console.log(`[Import] Enriched ${enrichedCount}/${holdings.length} holdings with ISIN metadata`);
    return enrichedHoldings;
  }

  /**
   * Calculate days since purchase (holding period)
   * Returns null if purchaseDate is not available
   */
  private calculateHoldingPeriodDays(purchaseDate?: string | Date): number | null {
    if (!purchaseDate) return null;

    try {
      const purchase = typeof purchaseDate === 'string' 
        ? new Date(purchaseDate) 
        : purchaseDate;
      
      if (isNaN(purchase.getTime())) return null;

      const today = new Date();
      const diffTime = today.getTime() - purchase.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays >= 0 ? diffDays : null;
    } catch {
      return null;
    }
  }

  /**
   * Enrich CAS holdings with ISIN-based metadata from database
   * Exit load data comes from database lookup by ISIN (primary source)
   */
  private async enrichCASHoldingsWithIsin(holdings: UnifiedHolding[]): Promise<UnifiedHolding[]> {
    const isins = holdings
      .map(h => h.isin)
      .filter((isin): isin is string => !!isin && isin.length >= 10);

    if (isins.length === 0) {
      console.log('[CAS Import] No ISINs to enrich');
      return holdings;
    }

    // Batch lookup enrichment data from database
    const enrichmentMap = await holdingNormalizationService.enrichByIsins(isins);
    
    let enrichedCount = 0;
    const enrichedHoldings = holdings.map(holding => {
      const isin = holding.isin;
      if (!isin) return holding;

      const enrichment = enrichmentMap.get(isin);
      
      // Calculate holding period (days since purchase = today - purchaseDate)
      const holdingPeriodDays = this.calculateHoldingPeriodDays(holding.purchaseDate);
      
      if (enrichment?.found) {
        enrichedCount++;
        
        // Exit load from database (primary source)
        const exitLoadApplicableDays = enrichment.exitLoadDays;
        const exitLoadPercent = enrichment.exitLoadPercent;
        
        // Determine if exit load is currently applicable
        const exitLoadApplicable = holdingPeriodDays !== null && 
          exitLoadApplicableDays !== undefined && 
          holdingPeriodDays < exitLoadApplicableDays;

        return {
          ...holding,
          // Category for STCG/LTCG determination
          category: enrichment.category,
          assetType: enrichment.category ? 
            holdingNormalizationService.normalizeAssetTypeFromMFCategory(enrichment.category) : 
            holding.assetType,
          // Fund metadata
          fundHouse: enrichment.fundHouse || holding.amcName,
          amcName: enrichment.fundHouse || holding.amcName,
          schemeCode: enrichment.schemeCode || holding.schemeCode,
          // NAV data
          currentNav: enrichment.currentNav || holding.currentNav,
          navDate: enrichment.navDate || holding.navDate,
          // Holding period - days since purchase
          holdingPeriodDays,
          // Exit load from database (primary source by ISIN)
          exitLoadPercent,
          exitLoadApplicableDays,
          exitLoadApplicable,
          // Plan and option types
          planType: holding.planType || enrichment.planType,
          optionType: holding.optionType || enrichment.optionType,
          // Returns data
          returns1y: enrichment.returns1y,
          returns3y: enrichment.returns3y,
          returns5y: enrichment.returns5y,
          riskLevel: enrichment.riskLevel,
          enrichedFromDb: true,
        };
      }

      // Still add holding period even if DB enrichment failed
      return {
        ...holding,
        holdingPeriodDays,
        enrichedFromDb: false,
      };
    });

    console.log(`[CAS Import] Enriched ${enrichedCount}/${holdings.length} holdings with ISIN metadata from database`);
    return enrichedHoldings;
  }
}

export const unifiedPortfolioImportService = new UnifiedPortfolioImportService();
