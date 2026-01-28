import { Router, Request, Response } from 'express';
import multer from 'multer';
import { isAuthenticated } from '../replitAuth';
import { casStatementService, CASStatementResult } from '../services/cas-statement-service';
import { unifiedPDFParser } from '../services/unified-pdf-parser';
import { unifiedPortfolioImportService } from '../services/unified-portfolio-import-service';
import { portfolioStorageService } from '../services/portfolio-storage-service';
import { holdingNormalizationService } from '../services/holding-normalization-service';
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

export default router;
