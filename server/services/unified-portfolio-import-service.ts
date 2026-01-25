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
import { holdingNormalizationService } from './holding-normalization-service';
import { portfolioStorageService } from './portfolio-storage-service';
import { pdfParserService } from './pdf-parser-service';
import { casStatementService, type CASHolding } from './cas-statement-service';
import { parsePDFPortfolio, parseURLPortfolio, type ImportedHolding } from './portfolio-parser';
import { WealthyImportService, type WealthyHolding } from './wealthy-import-service';
import { pdfParserV2Service, type ParserComparisonResult } from './pdf-parser-v2';

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
      const parseResult = await pdfParserService.extractTextSafe(buffer);
      if (!parseResult.success || !parseResult.result) {
        result.errors.push(parseResult.error || 'Failed to parse PDF');
        result.parsingStatus = 'failed';
        return result;
      }

      const text = parseResult.result.text;
      result.rawTextLength = text.length;

      const isCAS = options?.detectCAS !== false && this.detectCASStatement(text);
      
      if (isCAS) {
        return this.importFromCASText(text, fileName, options?.enableDualRun);
      }

      const isRollbackActive = pdfParserV2Service.isRollbackActive();
      const shouldDualRun = !isRollbackActive && pdfParserV2Service.shouldExecuteDualRun();
      const effectiveVersion = pdfParserV2Service.getEffectiveVersion();
      
      let profile = null;
      
      if (shouldDualRun || effectiveVersion === 'v2') {
        try {
          profile = await pdfParserV2Service.profileDocument(buffer);
          console.log('[Parser] Document profiled:', profile.pdfType, profile.layoutType, 'confidence:', profile.confidenceScore);
          (result as any).v2Profile = profile;
        } catch (profileError: any) {
          console.warn('[Parser] Profiling failed:', profileError.message);
        }
      }

      if (isRollbackActive) {
        console.log('[Parser] Rollback active - using v1 parser only');
      }

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

      (result as any).parserVersion = effectiveVersion;
      (result as any).dualRunEnabled = shouldDualRun;
      (result as any).rollbackActive = isRollbackActive;

      const auditRecord = pdfParserV2Service.createAuditRecord(
        profile,
        {
          success: result.success,
          holdingsCount: result.holdings.length,
          totalValue: result.summary?.totalCurrentValue || 0,
          confidenceScore: result.confidenceScore || 0,
          errors: result.errors,
          warnings: [],
          parseTimeMs: Date.now() - startTime,
        },
        {
          fileName,
          fileSize: buffer.length,
          dualRunEnabled: shouldDualRun,
        }
      );
      (result as any).auditRecord = auditRecord;

      return result;
    } catch (error: any) {
      result.errors.push(error.message || 'Unknown error during PDF import');
      result.parsingStatus = 'failed';
      return result;
    }
  }

  async importFromCASText(text: string, fileName?: string, enableDualRun?: boolean): Promise<UnifiedImportResult> {
    const result = createEmptyImportResult('cas_statement');
    result.sourceFileName = fileName;
    
    const config = pdfParserV2Service.getConfig();
    const shouldDualRun = enableDualRun ?? config.enableDualRun;
    
    if (shouldDualRun) {
      console.log('[Dual-Run] CAS statement parsing with v2 profiling enabled');
      (result as any).dualRunEnabled = true;
      (result as any).parserVersion = 'v1';
    }
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
}

export const unifiedPortfolioImportService = new UnifiedPortfolioImportService();
