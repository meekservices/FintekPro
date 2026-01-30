import { Router, Request, Response } from 'express';
import multer from 'multer';
import { isAuthenticated } from '../replitAuth';
import { casStatementService, CASStatementResult } from '../services/cas-statement-service';
import { unifiedPDFParser } from '../services/unified-pdf-parser';
import { unifiedPortfolioImportService } from '../services/unified-portfolio-import-service';
import { portfolioStorageService } from '../services/portfolio-storage-service';
import { holdingNormalizationService } from '../services/holding-normalization-service';
import { lotTaxCalculatorService } from '../services/lot-tax-calculator-service';
import { fifoLotLedgerService } from '../services/fifo-lot-ledger-service';
import type { UnifiedHolding } from '../services/unified-portfolio-types';
import { db } from '../db';
import { portfolios, portfolioHoldings, prospectClients } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

router.post(
  '/parse',
  isAuthenticated,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      
      console.log('[CAS Routes] Parsing CAS statement:', req.file.originalname);
      
      const parseResult = await unifiedPDFParser.extractTextSafe(req.file.buffer);
      if (!parseResult.success || !parseResult.result) {
        return res.status(400).json({ 
          success: false, 
          error: parseResult.error || 'Failed to parse PDF file'
        });
      }
      const text = parseResult.result.text;
      
      const result = await casStatementService.parseStatement(text);
      
      res.json({
        success: result.success,
        fileName: req.file.originalname,
        ...result
      });
    } catch (error: any) {
      console.error('[CAS Routes] Parse error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to parse CAS statement'
      });
    }
  }
);

router.post(
  '/import/:prospectId',
  isAuthenticated,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { prospectId } = req.params;
      const agentId = req.user?.id;
      
      if (!agentId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      
      const [prospect] = await db
        .select()
        .from(prospectClients)
        .where(eq(prospectClients.id, prospectId))
        .limit(1);
      
      if (!prospect) {
        return res.status(404).json({ success: false, error: 'Prospect not found' });
      }
      
      console.log('[CAS Routes] Importing CAS for prospect:', prospect.name);
      
      const parseResult = await unifiedPDFParser.extractTextSafe(req.file.buffer);
      if (!parseResult.success || !parseResult.result) {
        return res.status(400).json({
          success: false,
          error: parseResult.error || 'Failed to parse PDF file'
        });
      }
      const result = await casStatementService.parseStatement(parseResult.result.text);
      
      if (!result.success || result.holdings.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No holdings found in CAS statement',
          errors: result.errors
        });
      }
      
      const portfolioHoldingsData = casStatementService.convertToPortfolioHoldingsWithDates(result.holdings, result.transactions);
      const totalValue = result.summary.totalCurrentValue;
      
      // Convert to UnifiedHolding format and use centralized storage
      const unifiedHoldings: UnifiedHolding[] = portfolioHoldingsData.map(h => ({
        name: h.name,
        isin: h.isin,
        symbol: h.symbol,
        folioNumber: h.folioNumber,
        assetType: holdingNormalizationService.normalizeAssetType(h.assetType),
        quantity: h.quantity,
        avgCostPerUnit: h.averageCost,
        investedValue: h.investedValue,
        currentValue: h.currentValue,
        broker: h.broker,
        purchaseDate: h.purchaseDate
      }));
      
      const storageResult = await portfolioStorageService.upsertProspectPortfolio(
        prospectId,
        unifiedHoldings,
        {
          source: 'cas_statement',
          sourceFileName: req.file.originalname,
          confidenceScore: result.confidenceScore,
          replaceExisting: true
        }
      );
      
      const portfolioId = storageResult.portfolioId;
      
      await db.update(prospectClients)
        .set({
          uploadedPortfolio: {
            uploadedAt: new Date().toISOString(),
            fileName: req.file.originalname,
            fileType: 'pdf',
            source: 'cas_statement',
            parsedHoldings: portfolioHoldingsData.map(h => ({
              name: h.name,
              isin: h.isin,
              quantity: h.quantity,
              value: h.currentValue,
              type: h.assetType
            })),
            totalValue: totalValue,
            totalInvested: result.summary.totalInvestedValue,
            unrealizedGain: result.summary.totalUnrealizedGain,
            parsingStatus: 'completed',
            brokerDetected: 'CAMS/KFintech CAS',
            confidenceScore: result.confidenceScore
          },
          updatedAt: new Date()
        })
        .where(eq(prospectClients.id, prospectId));
      
      res.json({
        success: true,
        message: `Successfully imported ${result.holdings.length} holdings from CAS statement`,
        portfolioId,
        holdings: portfolioHoldingsData,
        summary: result.summary,
        investor: result.investor,
        confidenceScore: result.confidenceScore
      });
    } catch (error: any) {
      console.error('[CAS Routes] Import error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to import CAS statement'
      });
    }
  }
);

router.post(
  '/validate',
  isAuthenticated,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      
      const parseResult = await unifiedPDFParser.extractTextSafe(req.file.buffer);
      if (!parseResult.success || !parseResult.result) {
        return res.status(400).json({
          success: false,
          error: parseResult.error || 'Failed to parse PDF file'
        });
      }
      const text = parseResult.result.text;
      
      const isinPattern = /INF[A-Z0-9]{9}/gi;
      const isinMatches = [...new Set(text.match(isinPattern) || [])];
      
      const isCASStatement = /Consolidated\s*Account\s*Statement/i.test(text) ||
                            /CAMS.*Statement/i.test(text) ||
                            /KFintech.*Statement/i.test(text);
      
      const statementDateMatch = text.match(/As\s*on\s*(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})/i);
      
      res.json({
        success: true,
        isValidCAS: isCASStatement,
        statementDate: statementDateMatch ? statementDateMatch[1] : null,
        isinCount: isinMatches.length,
        isins: isinMatches.slice(0, 10),
        hasCAMS: /CAMS/i.test(text),
        hasKFintech: /KFINTECH/i.test(text),
        fileName: req.file.originalname
      });
    } catch (error: any) {
      console.error('[CAS Routes] Validation error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to validate file'
      });
    }
  }
);

/**
 * Epic 3: Tax Analysis Endpoint
 * Returns lot-level capital gains and exit load analysis
 */
router.post(
  '/tax-analysis',
  isAuthenticated,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      
      console.log('[CAS Routes] Generating tax analysis for:', req.file.originalname);
      
      const parseResult = await unifiedPDFParser.extractTextSafe(req.file.buffer);
      if (!parseResult.success || !parseResult.result) {
        return res.status(400).json({ 
          success: false, 
          error: parseResult.error || 'Failed to parse PDF file'
        });
      }
      const text = parseResult.result.text;
      
      const result = await casStatementService.parseStatement(text);
      
      if (!result.success || !result.lotLedger) {
        return res.status(400).json({
          success: false,
          error: 'Failed to parse CAS statement or build lot ledger',
          errors: result.errors,
        });
      }
      
      // Epic 1.3: Gate tax analysis on reconciliation success
      if (result.reconciliation && !result.reconciliation.passed) {
        return res.status(400).json({
          success: false,
          error: 'Tax analysis blocked - CAS reconciliation failed. Please verify the statement is complete.',
          reconciliation: result.reconciliation,
          errors: result.errors,
        });
      }
      
      // Calculate tax for each holding's lots (Tier 1 only)
      const taxAnalysis = [];
      
      for (const holding of result.holdings) {
        // Tax safety invariant: Only Tier 1 (FULL) holdings enter CG engine
        if (!holding.eligibleForTax) {
          console.log('[CAS Routes] Skipping tax analysis for non-eligible holding:', holding.isin, 'tier:', holding.holdingTier);
          continue;
        }
        
        const lotResult = result.lotLedger.results.find(r => r.isin === holding.isin);
        if (!lotResult || lotResult.lots.length === 0) continue;
        
        // Guard against zero/undefined unit balance to avoid NaN/Infinity
        if (!holding.unitBalance || holding.unitBalance <= 0) {
          console.log('[CAS Routes] Skipping tax analysis for holding with zero units:', holding.isin);
          continue;
        }
        const currentNav = holding.nav || (holding.marketValue / holding.unitBalance);
        const taxSummary = await lotTaxCalculatorService.calculateHoldingTaxSummary(
          lotResult.lots,
          currentNav,
          holding.schemeName
        );
        
        taxAnalysis.push({
          isin: holding.isin,
          schemeName: holding.schemeName.substring(0, 50),
          assetClass: taxSummary.assetClass,
          totalUnits: taxSummary.totalUnits,
          totalCostBasis: taxSummary.totalCostBasis,
          totalCurrentValue: taxSummary.totalCurrentValue,
          unrealizedGain: taxSummary.totalUnrealizedGain,
          stcgAmount: taxSummary.stcgAmount,
          ltcgAmount: taxSummary.ltcgAmount,
          estimatedTax: taxSummary.totalEstimatedTax,
          exitLoadAmount: taxSummary.totalExitLoad,
          netProceedsAfterTaxAndExit: taxSummary.netProceedsAfterTaxAndExit,
          recommendation: taxSummary.overallRecommendation,
          lotCount: taxSummary.lots.length,
          lotDetails: taxSummary.lots.map(l => ({
            lotId: l.lotId,
            holdingPeriodDays: l.holdingPeriodDays,
            capitalGainsType: l.capitalGainsType,
            units: l.units,
            costBasis: l.costBasis,
            currentValue: l.currentValue,
            unrealizedGain: l.unrealizedGain,
            estimatedTax: l.estimatedTax,
            recommendation: l.recommendation,
            daysToLTCG: l.daysToLTCG,
            daysToZeroExitLoad: l.daysToZeroExitLoad,
          })),
        });
      }
      
      // Summary
      const totalStcg = taxAnalysis.reduce((sum, t) => sum + t.stcgAmount, 0);
      const totalLtcg = taxAnalysis.reduce((sum, t) => sum + t.ltcgAmount, 0);
      const totalTax = taxAnalysis.reduce((sum, t) => sum + t.estimatedTax, 0);
      const totalExitLoad = taxAnalysis.reduce((sum, t) => sum + t.exitLoadAmount, 0);
      
      // Audit transparency: Count holdings by tier
      const tierCounts = { FULL: 0, VALUATION_ONLY: 0, SUMMARY_PLACEHOLDER: 0 };
      result.holdings.forEach(h => {
        const tier = h.holdingTier || 'FULL';
        tierCounts[tier as keyof typeof tierCounts]++;
      });
      
      res.json({
        success: true,
        fileName: req.file.originalname,
        summary: {
          holdingsAnalyzed: taxAnalysis.length,
          totalHoldings: result.holdings.length,
          totalSTCG: totalStcg,
          totalLTCG: totalLtcg,
          totalEstimatedTax: totalTax,
          totalExitLoad: totalExitLoad,
          equityLTCGExemption: 125000,  // ₹1.25L exemption
          ltcgAfterExemption: Math.max(0, totalLtcg - 125000),
        },
        // Audit transparency: Show agent which holdings are tax-eligible
        auditInfo: {
          tierBreakdown: tierCounts,
          taxEligibleCount: tierCounts.FULL,
          valuationOnlyCount: tierCounts.VALUATION_ONLY,
          placeholderCount: tierCounts.SUMMARY_PLACEHOLDER,
          message: `${tierCounts.FULL} holdings with full transaction history (tax computed). ${tierCounts.VALUATION_ONLY + tierCounts.SUMMARY_PLACEHOLDER} holdings excluded from capital gains (valuation only).`
        },
        holdings: taxAnalysis,
        warnings: result.warnings.slice(0, 10),
      });
    } catch (error: any) {
      console.error('[CAS Routes] Tax analysis error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to generate tax analysis'
      });
    }
  }
);

/**
 * Epic 4.2: Audit View Endpoint
 * Returns reconciliation details for agent review
 */
router.post(
  '/audit-view',
  isAuthenticated,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      
      console.log('[CAS Routes] Generating audit view for:', req.file.originalname);
      
      const parseResult = await unifiedPDFParser.extractTextSafe(req.file.buffer);
      if (!parseResult.success || !parseResult.result) {
        return res.status(400).json({ 
          success: false, 
          error: parseResult.error || 'Failed to parse PDF file'
        });
      }
      const text = parseResult.result.text;
      
      const result = await casStatementService.parseStatement(text);
      
      // Build audit view response
      const auditView = {
        success: result.success,
        fileName: req.file.originalname,
        
        // Reconciliation summary
        reconciliation: result.reconciliation ? {
          status: result.reconciliation.passed ? 'PASSED' : 'FAILED',
          parsedTotal: result.reconciliation.parsedTotal,
          expectedTotal: result.reconciliation.expectedTotal,
          delta: result.reconciliation.delta,
          deltaPercent: result.reconciliation.deltaPercent,
          message: result.reconciliation.message,
        } : null,
        
        // Portfolio summary from CAS
        casSummary: result.portfolioSummary ? {
          amcCount: result.portfolioSummary.entries.length,
          totalCostValue: result.portfolioSummary.totalCostValue,
          totalMarketValue: result.portfolioSummary.totalMarketValue,
          entries: result.portfolioSummary.entries,
        } : null,
        
        // Parsed holdings summary
        parsedSummary: {
          holdingsCount: result.holdings.length,
          totalCostValue: result.summary.totalInvestedValue,
          totalMarketValue: result.summary.totalCurrentValue,
          unrealizedGain: result.summary.totalUnrealizedGain,
          unrealizedGainPercent: result.summary.totalUnrealizedGainPercent,
        },
        
        // Lot ledger summary
        lotLedger: result.lotLedger ? {
          totalLots: result.lotLedger.summary.totalLots,
          successfulLedgers: result.lotLedger.summary.successfulLedgers,
          reconciledCount: result.lotLedger.summary.reconciledCount,
          warnings: result.lotLedger.summary.warnings.slice(0, 10),
        } : null,
        
        // Flagged holdings (low confidence or warnings)
        flaggedHoldings: result.holdings
          .filter(h => {
            const conf = result.holdingConfidence.get(`${h.isin}|${h.folioNumber}`);
            return conf && (conf.level !== 'HIGH' || conf.warnings.length > 0);
          })
          .map(h => {
            const conf = result.holdingConfidence.get(`${h.isin}|${h.folioNumber}`);
            return {
              isin: h.isin,
              folioNumber: h.folioNumber,
              schemeName: h.schemeName.substring(0, 50),
              unitBalance: h.unitBalance,
              marketValue: h.marketValue,
              confidence: conf?.level,
              warnings: conf?.warnings || [],
              missingFields: conf?.missingFields || [],
            };
          }),
        
        // Overall warnings and errors
        errors: result.errors,
        warnings: result.warnings.slice(0, 20),
        
        // Confidence score
        confidenceScore: result.confidenceScore,
      };
      
      res.json(auditView);
    } catch (error: any) {
      console.error('[CAS Routes] Audit view error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to generate audit view'
      });
    }
  }
);

/**
 * Epic 5: Regression Test Runner Endpoint
 * Runs CAS parser regression tests (dev environment only)
 */
router.get('/run-tests', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Tests not available in production' });
  }
  
  try {
    console.log('[CAS Routes] Running regression tests...');
    
    // Dynamic import for test module
    const testModule = await import('../tests/cas-parser-regression-test');
    
    // Run date parsing tests
    const dateResults = testModule.testDateParsing();
    
    // Run format variance tests
    const formatResults = await testModule.testFormatVariance();
    
    // Run full regression suite (includes golden fixtures if available)
    const fullResults = await testModule.runAllCASRegressionTests();
    
    res.json({
      success: fullResults.passed,
      dateParsing: dateResults,
      formatVariance: formatResults,
      summary: {
        goldenFixtures: fullResults.goldenFixtures,
        formatVariance: fullResults.formatVariance,
        overallPassed: fullResults.passed,
      },
    });
  } catch (error: any) {
    console.error('[CAS Routes] Regression test error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to run regression tests'
    });
  }
});

export default router;
