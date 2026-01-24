import { Router, Request, Response } from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { isAuthenticated } from '../replitAuth';
import { casStatementService, CASStatementResult } from '../services/cas-statement-service';
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
      
      const parser = new PDFParse({ data: req.file.buffer });
      const pdfResult = await parser.getText();
      const text = pdfResult.text;
      await parser.destroy();
      
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
      
      const parser = new PDFParse({ data: req.file.buffer });
      const pdfResult = await parser.getText();
      await parser.destroy();
      const result = await casStatementService.parseStatement(pdfResult.text);
      
      if (!result.success || result.holdings.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No holdings found in CAS statement',
          errors: result.errors
        });
      }
      
      const portfolioHoldingsData = casStatementService.convertToPortfolioHoldingsWithDates(result.holdings, result.transactions);
      const totalValue = result.summary.totalCurrentValue;
      
      const [existingPortfolio] = await db
        .select()
        .from(portfolios)
        .where(eq(portfolios.prospectId, prospectId))
        .limit(1);
      
      let portfolioId: string;
      
      if (existingPortfolio) {
        portfolioId = existingPortfolio.id;
        await db.update(portfolios)
          .set({
            totalValue: totalValue.toString(),
            source: 'cas_import',
            sourceFileName: req.file.originalname,
            updatedAt: new Date()
          })
          .where(eq(portfolios.id, portfolioId));
        
        await db.delete(portfolioHoldings)
          .where(eq(portfolioHoldings.portfolioId, portfolioId));
      } else {
        const [newPortfolio] = await db.insert(portfolios)
          .values({
            prospectId,
            name: `${prospect.name}'s Portfolio`,
            totalValue: totalValue.toString(),
            source: 'cas_import',
            sourceFileName: req.file.originalname,
            isDefault: true,
            isVerified: false
          })
          .returning();
        portfolioId = newPortfolio.id;
      }
      
      if (portfolioHoldingsData.length > 0) {
        await db.insert(portfolioHoldings).values(
          portfolioHoldingsData.map(h => ({
            portfolioId,
            symbol: h.symbol || null,
            name: h.name,
            isin: h.isin,
            quantity: h.quantity.toString(),
            avgPrice: h.averageCost?.toString() || null,
            currentValue: h.currentValue.toString(),
            investedValue: h.investedValue?.toString() || null,
            assetType: h.assetType,
            folioNumber: h.folioNumber || null,
            broker: h.broker || null,
            confidenceScore: h.confidenceScore,
            source: 'cas_import',
            purchaseDate: h.purchaseDate ? new Date(h.purchaseDate) : null
          }))
        );
      }
      
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
      
      const parser = new PDFParse({ data: req.file.buffer });
      const pdfResult = await parser.getText();
      const text = pdfResult.text;
      await parser.destroy();
      
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
