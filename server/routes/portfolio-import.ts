import { Router, Request, Response } from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import { db } from '../db';
import { prospectClients } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { isAuthenticated } from '../replitAuth';
import { parsePDFPortfolio, parseURLPortfolio, createPortfolioSnapshot } from '../services/portfolio-parser';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'application/x-pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

router.post(
  '/prospects/:prospectId/portfolio/upload',
  isAuthenticated,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { prospectId } = req.params;
      const agentId = req.user?.id;
      
      if (!agentId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      const [prospect] = await db
        .select()
        .from(prospectClients)
        .where(and(
          eq(prospectClients.id, prospectId),
          eq(prospectClients.agentId, agentId)
        ))
        .limit(1);
      
      if (!prospect) {
        return res.status(404).json({ error: 'Prospect not found' });
      }
      
      const parseResult = await parsePDFPortfolio(req.file.buffer, req.file.originalname);
      
      const snapshot = createPortfolioSnapshot(
        parseResult.holdings,
        'pdf_upload',
        {
          fileName: req.file.originalname,
          brokerDetected: parseResult.brokerDetected || undefined,
          confidenceScore: parseResult.confidenceScore,
          errors: parseResult.errors.length > 0 ? parseResult.errors : undefined
        }
      );
      
      await db
        .update(prospectClients)
        .set({
          uploadedPortfolio: {
            uploadedAt: new Date().toISOString(),
            fileName: req.file.originalname,
            fileType: 'pdf',
            parsedHoldings: snapshot.holdings.map(h => ({
              name: h.name,
              quantity: h.quantity,
              value: h.currentValue,
              type: h.assetType
            })),
            totalValue: snapshot.totalCurrentValue,
            parsingStatus: snapshot.parsingStatus,
            brokerDetected: snapshot.brokerDetected,
            allocation: snapshot.allocation,
            confidenceScore: snapshot.confidenceScore
          },
          updatedAt: new Date()
        })
        .where(eq(prospectClients.id, prospectId));
      
      res.json({
        success: true,
        message: parseResult.success 
          ? `Successfully parsed ${parseResult.holdings.length} holdings from ${parseResult.brokerDetected || 'portfolio'}`
          : 'Portfolio uploaded but parsing needs review',
        portfolio: snapshot,
        holdingsCount: parseResult.holdings.length,
        brokerDetected: parseResult.brokerDetected,
        confidenceScore: parseResult.confidenceScore,
        needsReview: snapshot.parsingStatus === 'needs_review',
        errors: parseResult.errors
      });
    } catch (error: any) {
      console.error('Portfolio upload error:', error);
      res.status(500).json({ error: error.message || 'Failed to upload portfolio' });
    }
  }
);

router.post(
  '/prospects/:prospectId/portfolio/import-url',
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { prospectId } = req.params;
      const { url } = req.body;
      const agentId = req.user?.id;
      
      if (!agentId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }
      
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
      
      const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
      const urlObj = new URL(url);
      if (blockedDomains.some(d => urlObj.hostname.includes(d))) {
        return res.status(400).json({ error: 'Invalid URL - local addresses not allowed' });
      }
      
      const [prospect] = await db
        .select()
        .from(prospectClients)
        .where(and(
          eq(prospectClients.id, prospectId),
          eq(prospectClients.agentId, agentId)
        ))
        .limit(1);
      
      if (!prospect) {
        return res.status(404).json({ error: 'Prospect not found' });
      }
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });
      
      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch URL: ${response.status}` });
      }
      
      const html = await response.text();
      const parseResult = await parseURLPortfolio(html, url);
      
      const snapshot = createPortfolioSnapshot(
        parseResult.holdings,
        'url_import',
        {
          sourceUrl: url,
          sourceName: parseResult.brokerDetected || urlObj.hostname,
          brokerDetected: parseResult.brokerDetected || undefined,
          confidenceScore: parseResult.confidenceScore,
          errors: parseResult.errors.length > 0 ? parseResult.errors : undefined
        }
      );
      
      await db
        .update(prospectClients)
        .set({
          fetchedPortfolio: {
            fetchedAt: new Date().toISOString(),
            source: parseResult.brokerDetected || urlObj.hostname,
            holdings: snapshot.holdings.map(h => ({
              isin: h.isin,
              symbol: h.symbol,
              name: h.name,
              quantity: h.quantity,
              currentValue: h.currentValue,
              type: h.assetType
            })),
            totalValue: snapshot.totalCurrentValue,
            parsingStatus: snapshot.parsingStatus,
            allocation: snapshot.allocation,
            confidenceScore: snapshot.confidenceScore
          },
          updatedAt: new Date()
        })
        .where(eq(prospectClients.id, prospectId));
      
      res.json({
        success: true,
        message: parseResult.success 
          ? `Successfully imported ${parseResult.holdings.length} holdings from ${parseResult.brokerDetected || urlObj.hostname}`
          : 'URL imported but parsing needs review',
        portfolio: snapshot,
        holdingsCount: parseResult.holdings.length,
        brokerDetected: parseResult.brokerDetected,
        confidenceScore: parseResult.confidenceScore,
        needsReview: snapshot.parsingStatus === 'needs_review',
        errors: parseResult.errors
      });
    } catch (error: any) {
      console.error('Portfolio URL import error:', error);
      res.status(500).json({ error: error.message || 'Failed to import portfolio from URL' });
    }
  }
);

router.get(
  '/prospects/:prospectId/portfolio',
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { prospectId } = req.params;
      const agentId = req.user?.id;
      
      if (!agentId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const [prospect] = await db
        .select({
          id: prospectClients.id,
          name: prospectClients.name,
          uploadedPortfolio: prospectClients.uploadedPortfolio,
          fetchedPortfolio: prospectClients.fetchedPortfolio
        })
        .from(prospectClients)
        .where(and(
          eq(prospectClients.id, prospectId),
          eq(prospectClients.agentId, agentId)
        ))
        .limit(1);
      
      if (!prospect) {
        return res.status(404).json({ error: 'Prospect not found' });
      }
      
      const hasUploadedPortfolio = prospect.uploadedPortfolio && 
        (prospect.uploadedPortfolio as any).parsedHoldings?.length > 0;
      const hasFetchedPortfolio = prospect.fetchedPortfolio && 
        (prospect.fetchedPortfolio as any).holdings?.length > 0;
      
      res.json({
        prospectId: prospect.id,
        prospectName: prospect.name,
        hasPortfolio: hasUploadedPortfolio || hasFetchedPortfolio,
        uploadedPortfolio: prospect.uploadedPortfolio || null,
        fetchedPortfolio: prospect.fetchedPortfolio || null
      });
    } catch (error: any) {
      console.error('Get portfolio error:', error);
      res.status(500).json({ error: error.message || 'Failed to get portfolio' });
    }
  }
);

router.delete(
  '/prospects/:prospectId/portfolio',
  isAuthenticated,
  async (req: Request, res: Response) => {
    try {
      const { prospectId } = req.params;
      const { type } = req.query;
      const agentId = req.user?.id;
      
      if (!agentId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const [prospect] = await db
        .select()
        .from(prospectClients)
        .where(and(
          eq(prospectClients.id, prospectId),
          eq(prospectClients.agentId, agentId)
        ))
        .limit(1);
      
      if (!prospect) {
        return res.status(404).json({ error: 'Prospect not found' });
      }
      
      const updateData: any = { updatedAt: new Date() };
      if (type === 'uploaded' || !type) {
        updateData.uploadedPortfolio = null;
      }
      if (type === 'fetched' || !type) {
        updateData.fetchedPortfolio = null;
      }
      
      await db
        .update(prospectClients)
        .set(updateData)
        .where(eq(prospectClients.id, prospectId));
      
      res.json({ success: true, message: 'Portfolio deleted successfully' });
    } catch (error: any) {
      console.error('Delete portfolio error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete portfolio' });
    }
  }
);

export default router;
