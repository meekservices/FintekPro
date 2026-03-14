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
import { db } from '../db';
import { clientAgentRelationships, userNotifications, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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
      result.confidenceScore = casResult.confidenceScore || 95;
      result.brokerDetected = 'CAMS/KFintech CAS';
      result.importedCount = result.holdings.length;
      result.capturedAt = new Date().toISOString();
      result.warnings = casResult.warnings;

      if (casResult.reconciliation) {
        result.reconciliation = {
          passed: casResult.reconciliation.passed,
          parsedTotal: casResult.reconciliation.parsedTotal,
          expectedTotal: casResult.reconciliation.expectedTotal,
          delta: casResult.reconciliation.delta,
          deltaPercent: casResult.reconciliation.deltaPercent,
          message: casResult.reconciliation.message,
        };
      }

      if (casResult.portfolioSummary) {
        result.portfolioSummary = {
          entries: casResult.portfolioSummary.entries,
          totalCostValue: casResult.portfolioSummary.totalCostValue,
          totalMarketValue: casResult.portfolioSummary.totalMarketValue,
        };
      }

      const tierCounts = { FULL: 0, VALUATION_ONLY: 0, SUMMARY_PLACEHOLDER: 0 };
      result.holdings.forEach(h => {
        const tier = h.holdingTier || 'FULL';
        tierCounts[tier as keyof typeof tierCounts]++;
      });
      result.tierBreakdown = tierCounts;

      const holdingsWithLots = result.holdings.filter(h => h.lots && h.lots.length > 0);
      result.lotCounts = {
        withLots: holdingsWithLots.length,
        withMultipleLots: result.holdings.filter(h => h.lots && h.lots.length > 1).length,
        withoutLots: result.holdings.length - holdingsWithLots.length,
      };

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
        isDemat: h.isDemat,
        purchaseDate: h.firstPurchaseDate,
        confidenceScore: (h as any).confidenceScore || 90,
        broker: 'CAMS/KFintech CAS',
        firstPurchaseDate: h.firstPurchaseDate,
        holdingTier: h.holdingTier,
        eligibleForTax: h.eligibleForTax,
        tierWarnings: h.tierWarnings,
        lotCount: h.lotCount || h.lots?.length || 0,
        lotSummary: h.lotSummary || `${h.lots?.length || 0} lot${(h.lots?.length || 0) !== 1 ? 's' : ''}`,
        lots: h.lots?.map(lot => ({
          transactionDate: lot.transactionDate instanceof Date 
            ? lot.transactionDate.toISOString() 
            : String(lot.transactionDate || ''),
          transactionDateStr: lot.transactionDate instanceof Date 
            ? lot.transactionDate.toISOString().split('T')[0]
            : (typeof lot.transactionDate === 'string' ? lot.transactionDate.split('T')[0] : ''),
          transactionType: lot.transactionType,
          amount: lot.amount,
          units: lot.units,
          nav: lot.nav,
          cost: lot.amount,
          remainingUnits: lot.units,
          description: lot.description || '',
          purchaseDate: lot.transactionDate instanceof Date 
            ? lot.transactionDate.toISOString().split('T')[0]
            : String(lot.transactionDate || ''),
        })) || [],
        transactions: h.transactions?.map(t => ({
          date: t.transactionDate,
          transactionType: t.transactionType,
          amount: t.amount,
          units: t.units,
          nav: t.nav,
          balance: t.balance,
          description: t.description,
          isCredit: t.isCredit,
        })) || [],
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

  /**
   * Import portfolio from CSV file content
   * Supports flexible column detection for various formats:
   * - Mutual funds: scheme name, folio, units, NAV, invested amount
   * - Stocks: symbol, quantity, avg price, sector
   * - Generic: name, quantity, value
   */
  async importFromCSV(
    csvContent: string,
    fileName?: string,
    options?: { 
      defaultAssetType?: AssetType;
      detectAssetType?: boolean;
    }
  ): Promise<UnifiedImportResult> {
    const result = createEmptyImportResult('csv_upload');
    result.sourceFileName = fileName;
    const startTime = Date.now();

    try {
      const lines = csvContent.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        result.errors.push('CSV file must have headers and at least one data row');
        result.parsingStatus = 'failed';
        return result;
      }

      // Parse headers with flexible column detection
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      
      // Column detection with priority matching
      const columnMap = this.detectCSVColumns(headers);
      
      if (!columnMap.hasMinimumColumns) {
        result.errors.push('CSV must have at least name/symbol and quantity/units columns');
        result.parsingStatus = 'failed';
        return result;
      }

      const parsedHoldings: UnifiedHolding[] = [];
      const parseErrors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row = this.parseCSVRow(lines[i]);
        
        if (row.length === 0) continue;

        try {
          const holding = this.parseCSVRowToHolding(row, columnMap, options);
          if (holding) {
            parsedHoldings.push(holding);
          }
        } catch (err: any) {
          parseErrors.push(`Row ${i + 1}: ${err.message || 'Failed to parse'}`);
        }
      }

      if (parsedHoldings.length === 0) {
        result.errors.push('No valid holdings found in CSV');
        result.errors.push(...parseErrors.slice(0, 5));
        result.parsingStatus = 'failed';
        return result;
      }

      // Enrich holdings with ISIN lookup if names/symbols are present
      result.holdings = await this.enrichCSVHoldings(parsedHoldings);
      result.summary = holdingNormalizationService.computeSummary(result.holdings);
      result.success = true;
      result.parsingStatus = parseErrors.length > 0 ? 'needs_review' : 'completed';
      result.confidenceScore = parseErrors.length === 0 ? 0.9 : 0.7;
      result.capturedAt = new Date().toISOString();
      
      if (parseErrors.length > 0) {
        result.errors = parseErrors.slice(0, 10);
      }

      console.log(`[CSV Import] Parsed ${result.holdings.length} holdings from ${fileName || 'CSV'} in ${Date.now() - startTime}ms`);
      return result;
    } catch (error: any) {
      result.errors.push(error.message || 'Failed to parse CSV');
      result.parsingStatus = 'failed';
      return result;
    }
  }

  /**
   * Detect CSV columns with flexible matching
   */
  private detectCSVColumns(headers: string[]): CSVColumnMap {
    const findColumn = (patterns: string[]): number => {
      for (const pattern of patterns) {
        const idx = headers.findIndex(h => h.includes(pattern) || h === pattern);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const nameIdx = findColumn(['name', 'scheme', 'fund', 'security', 'stock', 'scrip']);
    const symbolIdx = findColumn(['symbol', 'ticker', 'scrip code', 'nse', 'bse']);
    const isinIdx = findColumn(['isin']);
    const folioIdx = findColumn(['folio', 'folio number', 'folio no']);
    const quantityIdx = findColumn(['quantity', 'qty', 'units', 'shares', 'unit']);
    const avgPriceIdx = findColumn(['avg', 'average', 'cost', 'price', 'nav', 'buy price', 'purchase']);
    const currentValueIdx = findColumn(['current value', 'value', 'market value', 'amount']);
    const investedValueIdx = findColumn(['invested', 'investment', 'cost value', 'purchase value']);
    const typeIdx = findColumn(['type', 'asset', 'category', 'asset type', 'product']);
    const sectorIdx = findColumn(['sector', 'industry']);
    const dateIdx = findColumn(['date', 'purchase date', 'buy date', 'transaction date']);

    return {
      nameIdx,
      symbolIdx,
      isinIdx,
      folioIdx,
      quantityIdx,
      avgPriceIdx,
      currentValueIdx,
      investedValueIdx,
      typeIdx,
      sectorIdx,
      dateIdx,
      hasMinimumColumns: (nameIdx !== -1 || symbolIdx !== -1 || isinIdx !== -1) && 
                         (quantityIdx !== -1 || currentValueIdx !== -1)
    };
  }

  /**
   * Parse a CSV row handling quoted values and commas
   */
  private parseCSVRow(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));

    return values;
  }

  /**
   * Convert a parsed CSV row to a UnifiedHolding
   */
  private parseCSVRowToHolding(
    values: string[],
    columnMap: CSVColumnMap,
    options?: { defaultAssetType?: AssetType; detectAssetType?: boolean }
  ): UnifiedHolding | null {
    const getValue = (idx: number): string => (idx >= 0 && idx < values.length) ? values[idx] : '';
    const getNumber = (idx: number): number => {
      const val = getValue(idx).replace(/[₹$,\s]/g, '');
      return parseFloat(val) || 0;
    };

    const name = getValue(columnMap.nameIdx) || getValue(columnMap.symbolIdx) || '';
    const symbol = getValue(columnMap.symbolIdx) || '';
    const isin = getValue(columnMap.isinIdx) || '';
    const quantity = getNumber(columnMap.quantityIdx);
    const avgPrice = getNumber(columnMap.avgPriceIdx);
    let currentValue = getNumber(columnMap.currentValueIdx);
    const investedValue = getNumber(columnMap.investedValueIdx) || (quantity * avgPrice);
    const folioNumber = getValue(columnMap.folioIdx);
    const typeRaw = getValue(columnMap.typeIdx).toLowerCase();
    const purchaseDateStr = getValue(columnMap.dateIdx);

    // Skip rows without essential data
    if (!name && !symbol && !isin) return null;
    if (quantity <= 0 && currentValue <= 0) return null;

    // Calculate current value if not provided
    if (currentValue <= 0 && quantity > 0 && avgPrice > 0) {
      currentValue = quantity * avgPrice;
    }

    // Determine asset type
    let assetType: AssetType = options?.defaultAssetType || 'equity';
    if (options?.detectAssetType !== false && typeRaw) {
      assetType = holdingNormalizationService.normalizeAssetType(typeRaw);
    } else if (name.toLowerCase().includes('fund') || folioNumber) {
      assetType = 'mutual_fund';
    }

    // Parse purchase date - use today as default for capital gains tracking
    let purchaseDate: string | undefined;
    if (purchaseDateStr) {
      try {
        const parsed = new Date(purchaseDateStr);
        if (!isNaN(parsed.getTime())) {
          purchaseDate = parsed.toISOString().split('T')[0];
        }
      } catch {}
    }
    // Default to today's date if not provided (important for capital gains tracking)
    if (!purchaseDate) {
      purchaseDate = new Date().toISOString().split('T')[0];
    }

    // Ensure currentValue has a minimum value for calculations
    if (currentValue <= 0 && investedValue > 0) {
      currentValue = investedValue;
    }

    return {
      id: crypto.randomUUID(),
      name: name || symbol || isin,
      symbol: symbol.toUpperCase() || undefined,
      isin: isin.toUpperCase() || undefined,
      folioNumber: folioNumber || undefined,
      assetType,
      quantity: quantity || 1, // Default to 1 unit if not provided
      avgCostPerUnit: avgPrice || (currentValue / (quantity || 1)) || undefined,
      investedValue: investedValue || currentValue || undefined,
      currentValue: currentValue || investedValue || 0,
      purchaseDate,
      source: 'csv_upload' as any,
    };
  }

  /**
   * Enrich CSV holdings with ISIN lookup from database
   */
  private async enrichCSVHoldings(holdings: UnifiedHolding[]): Promise<UnifiedHolding[]> {
    const enrichedHoldings: UnifiedHolding[] = [];

    for (const holding of holdings) {
      let enriched = { ...holding };

      // Try to enrich with ISIN lookup if we have a symbol or name but no ISIN
      if (!holding.isin && (holding.symbol || holding.name)) {
        try {
          const searchTerm = holding.symbol || holding.name;
          const enrichment = await holdingNormalizationService.enrichWithISIN(searchTerm);
          if (enrichment.isin) {
            enriched.isin = enrichment.isin;
            enriched.name = enrichment.schemeName || enriched.name;
            if (enrichment.assetType) {
              enriched.assetType = enrichment.assetType as AssetType;
            }
          }
        } catch (err) {
          // Continue without enrichment
        }
      }

      // Calculate unrealized gain if we have cost and current value
      if (enriched.investedValue && enriched.currentValue) {
        enriched.unrealizedGain = enriched.currentValue - enriched.investedValue;
        enriched.unrealizedGainPercent = enriched.investedValue > 0 
          ? (enriched.unrealizedGain / enriched.investedValue) * 100 
          : 0;
      }

      enrichedHoldings.push(enriched);
    }

    return enrichedHoldings;
  }

  /**
   * Import portfolio from Excel file (.xlsx, .xls)
   * Supports same flexible column detection as CSV import
   */
  async importFromExcel(
    buffer: Buffer,
    fileName?: string,
    options?: {
      sheetName?: string;
      defaultAssetType?: AssetType;
      detectAssetType?: boolean;
    }
  ): Promise<UnifiedImportResult> {
    const result = createEmptyImportResult('csv_upload');
    result.sourceFileName = fileName;
    const startTime = Date.now();

    try {
      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      // Get the target sheet (first sheet by default, or specified by name)
      const worksheet = options?.sheetName
        ? workbook.getWorksheet(options.sheetName)
        : workbook.worksheets[0];

      if (!worksheet) {
        const sheetLabel = options?.sheetName || 'first sheet';
        result.errors.push(`Sheet "${sheetLabel}" not found in Excel file`);
        result.parsingStatus = 'failed';
        return result;
      }

      // Convert sheet to JSON array
      const jsonData: any[][] = [];
      worksheet.eachRow({ includeEmpty: true }, (row) => {
        jsonData.push((row.values as any[]).slice(1));
      });

      if (jsonData.length < 2) {
        result.errors.push('Excel file must have headers and at least one data row');
        result.parsingStatus = 'failed';
        return result;
      }

      // Extract headers (first row)
      const headers = (jsonData[0] as any[]).map(h => 
        String(h || '').trim().toLowerCase()
      );

      const columnMap = this.detectCSVColumns(headers);

      if (!columnMap.hasMinimumColumns) {
        result.errors.push('Excel must have at least name/symbol and quantity/units columns');
        result.parsingStatus = 'failed';
        return result;
      }

      const parsedHoldings: UnifiedHolding[] = [];
      const parseErrors: string[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = (jsonData[i] as any[]).map(v => String(v ?? '').trim());
        
        if (row.every(cell => !cell)) continue;

        try {
          const holding = this.parseCSVRowToHolding(row, columnMap, options);
          if (holding) {
            parsedHoldings.push(holding);
          }
        } catch (err: any) {
          parseErrors.push(`Row ${i + 1}: ${err.message || 'Failed to parse'}`);
        }
      }

      if (parsedHoldings.length === 0) {
        result.errors.push('No valid holdings found in Excel file');
        result.errors.push(...parseErrors.slice(0, 5));
        result.parsingStatus = 'failed';
        return result;
      }

      // Enrich holdings with ISIN lookup
      result.holdings = await this.enrichCSVHoldings(parsedHoldings);
      result.summary = holdingNormalizationService.computeSummary(result.holdings);
      result.success = true;
      result.parsingStatus = parseErrors.length > 0 ? 'needs_review' : 'completed';
      result.confidenceScore = parseErrors.length === 0 ? 0.9 : 0.7;
      result.capturedAt = new Date().toISOString();

      if (parseErrors.length > 0) {
        result.errors = parseErrors.slice(0, 10);
      }

      console.log(`[Excel Import] Parsed ${result.holdings.length} holdings from ${fileName || 'Excel'} in ${Date.now() - startTime}ms`);
      return result;
    } catch (error: any) {
      result.errors.push(error.message || 'Failed to parse Excel file');
      result.parsingStatus = 'failed';
      return result;
    }
  }

  /**
   * Import and save for prospect (CSV/Excel)
   */
  async importCSVAndSaveForProspect(
    prospectId: string,
    content: string | Buffer,
    fileName: string,
    options?: { replaceExisting?: boolean; isExcel?: boolean }
  ): Promise<UnifiedImportResult & { storageResult?: any }> {
    let importResult: UnifiedImportResult;

    if (options?.isExcel) {
      importResult = await this.importFromExcel(
        Buffer.isBuffer(content) ? content : Buffer.from(content),
        fileName
      );
    } else {
      importResult = await this.importFromCSV(
        Buffer.isBuffer(content) ? content.toString('utf-8') : content,
        fileName
      );
    }

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

  async notifyLinkedAgents(userId: string, holdingsCount: number, source: string): Promise<void> {
    try {
      const activeRelationships = await db
        .select({ agentId: clientAgentRelationships.agentId })
        .from(clientAgentRelationships)
        .where(and(
          eq(clientAgentRelationships.clientId, userId),
          eq(clientAgentRelationships.isActive, true)
        ));

      if (activeRelationships.length === 0) return;

      const [client] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const clientName = client
        ? [client.firstName, client.lastName].filter(Boolean).join(' ') || 'A client'
        : 'A client';

      const sourceLabel = source === 'cas_statement' ? 'CAS statement'
        : source === 'wealthy_url' ? 'Wealthy.in'
        : source === 'broker_pdf' ? 'broker statement'
        : 'external file';

      for (const rel of activeRelationships) {
        await db.insert(userNotifications).values({
          id: crypto.randomUUID(),
          userId: rel.agentId,
          type: 'portfolio_import',
          title: `${clientName} imported a portfolio`,
          message: `${clientName} uploaded ${holdingsCount} holding${holdingsCount !== 1 ? 's' : ''} from a ${sourceLabel}. Review their portfolio for advisory opportunities.`,
          actionUrl: `/agent/clients`,
          priority: 'medium',
          isRead: false,
          createdAt: new Date(),
        });
      }

      console.log(`[Portfolio Notification] Notified ${activeRelationships.length} agent(s) about ${clientName}'s portfolio import (${holdingsCount} holdings)`);
    } catch (error) {
      console.error('[Portfolio Notification] Failed to notify agents:', error);
    }
  }
}

interface CSVColumnMap {
  nameIdx: number;
  symbolIdx: number;
  isinIdx: number;
  folioIdx: number;
  quantityIdx: number;
  avgPriceIdx: number;
  currentValueIdx: number;
  investedValueIdx: number;
  typeIdx: number;
  sectorIdx: number;
  dateIdx: number;
  hasMinimumColumns: boolean;
}

export const unifiedPortfolioImportService = new UnifiedPortfolioImportService();
