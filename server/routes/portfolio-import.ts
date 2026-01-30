import { Router, Request, Response } from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import { db } from '../db';
import { prospectClients, portfolios, portfolioHoldings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { isAuthenticated } from '../replitAuth';
import { parsePDFPortfolio, parseURLPortfolio, createPortfolioSnapshot, clearParseCache } from '../services/portfolio-parser';

// Clear parse cache on server start to ensure fresh parsing after code updates
clearParseCache();
import { holdingNormalizationService } from '../services/holding-normalization-service';
import { portfolioStorageService } from '../services/portfolio-storage-service';
import { unifiedPortfolioImportService } from '../services/unified-portfolio-import-service';
import type { UnifiedHolding } from '../services/unified-portfolio-types';

function isHTMLFile(filename: string, mimetype: string): boolean {
  const ext = filename.toLowerCase();
  return ext.endsWith('.html') || ext.endsWith('.htm') || 
         mimetype === 'text/html' || mimetype === 'application/xhtml+xml';
}

const router = Router();

const normalizeAssetType = (type: string | undefined) => holdingNormalizationService.normalizeAssetType(type);

const deriveAllocation = (holdings: any[]) => {
  const unifiedHoldings: UnifiedHolding[] = holdings.map(h => ({
    name: h.name || '',
    assetType: holdingNormalizationService.normalizeAssetType(h.assetType),
    quantity: h.quantity || 0,
    currentValue: h.currentValue || 0
  }));
  return holdingNormalizationService.deriveAllocationFromHoldings(unifiedHoldings);
};

async function upsertProspectPortfolio(
  prospectId: string,
  prospectName: string,
  holdings: any[],
  source: string,
  sourceFileName?: string,
  confidenceScore?: number
): Promise<string> {
  const unifiedHoldings: UnifiedHolding[] = holdings.map(h => ({
    name: h.name || h.productName || 'Unknown',
    isin: h.isin,
    symbol: h.symbol,
    folioNumber: h.folioNumber,
    assetType: holdingNormalizationService.normalizeAssetType(h.assetType || h.type || h.productType),
    quantity: h.quantity || 1,
    avgCostPerUnit: h.avgPrice || h.averageCost,
    investedValue: h.investedValue,
    currentValue: h.currentValue || h.value || 0,
    broker: h.broker,
    purchaseDate: h.purchaseDate
  }));

  const result = await portfolioStorageService.upsertProspectPortfolio(
    prospectId,
    unifiedHoldings,
    {
      source: source === 'uploaded' ? 'broker_pdf' : 'cas_statement',
      sourceFileName,
      confidenceScore,
      replaceExisting: true
    }
  );

  return result.portfolioId;
}


function isCSVFile(filename: string, mimetype: string): boolean {
  const ext = filename.toLowerCase();
  return ext.endsWith('.csv') || mimetype === 'text/csv' || mimetype === 'application/csv';
}

function isExcelFile(filename: string, mimetype: string): boolean {
  const ext = filename.toLowerCase();
  return ext.endsWith('.xlsx') || ext.endsWith('.xls') ||
         mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
         mimetype === 'application/vnd.ms-excel';
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf', 
      'application/x-pdf',
      'text/html',
      'application/xhtml+xml',
      'text/csv',
      'application/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    const filename = file.originalname.toLowerCase();
    const isHtmlFile = filename.endsWith('.html') || filename.endsWith('.htm');
    const isCsvFile = filename.endsWith('.csv');
    const isExcelExt = filename.endsWith('.xlsx') || filename.endsWith('.xls');
    
    if (allowedMimes.includes(file.mimetype) || isHtmlFile || isCsvFile || isExcelExt) {
      cb(null, true);
    } else {
      cb(new Error('Supported formats: PDF, HTML, CSV, Excel (.xlsx, .xls)'));
    }
  }
});

router.post(
  '/prospects/:prospectId/portfolio/upload',
  isAuthenticated,
  upload.single('portfolio'),
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
      
      // Determine file type and use appropriate parser
      const filename = req.file.originalname;
      const mimetype = req.file.mimetype;
      const isHTML = isHTMLFile(filename, mimetype);
      const isCSV = isCSVFile(filename, mimetype);
      const isExcel = isExcelFile(filename, mimetype);
      
      let fileType = 'pdf';
      let importResult;
      
      if (isCSV) {
        fileType = 'csv';
        importResult = await unifiedPortfolioImportService.importFromCSV(
          req.file.buffer.toString('utf-8'),
          filename
        );
      } else if (isExcel) {
        fileType = 'excel';
        importResult = await unifiedPortfolioImportService.importFromExcel(
          req.file.buffer,
          filename
        );
      } else if (isHTML) {
        fileType = 'html';
        importResult = await unifiedPortfolioImportService.importFromHTML(
          req.file.buffer.toString('utf-8'),
          filename
        );
      } else {
        fileType = 'pdf';
        importResult = await unifiedPortfolioImportService.importFromPDF(
          req.file.buffer,
          filename
        );
      }
      
      if (!importResult.success) {
        return res.status(400).json({ 
          error: importResult.error || 'Failed to parse portfolio', 
          errors: importResult.errors 
        });
      }
      
      const snapshot = createPortfolioSnapshot(
        importResult.holdings.map(h => ({
          name: h.name || 'Unknown',
          symbol: h.symbol,
          isin: h.isin,
          quantity: h.quantity,
          currentValue: h.currentValue,
          assetType: h.assetType
        })),
        'pdf_upload',
        {
          fileName: req.file.originalname,
          brokerDetected: importResult.brokerDetected || undefined,
          confidenceScore: importResult.confidenceScore,
          errors: importResult.errors?.length > 0 ? importResult.errors : undefined
        }
      );
      
      await db
        .update(prospectClients)
        .set({
          uploadedPortfolio: {
            uploadedAt: new Date().toISOString(),
            fileName: req.file.originalname,
            fileType: fileType,
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
      
      // Save to unified portfolio tables using centralized storage service
      await upsertProspectPortfolio(
        prospectId,
        prospect.name,
        importResult.holdings,
        fileType === 'pdf' ? 'broker_pdf' : 'wealthy_url',
        req.file.originalname,
        importResult.confidenceScore
      );
      
      // Build the success message based on import results
      const holdingsCount = importResult.holdings.length;
      let message = `Successfully parsed ${holdingsCount} holdings from ${importResult.brokerDetected || 'portfolio'}`;
      if (importResult.unimportedCount && importResult.unimportedCount > 0) {
        message = `Imported ${importResult.importedCount} of ${importResult.expectedCount} holdings from ${importResult.brokerDetected || 'portfolio'}. ${importResult.unimportedCount} fund(s) could not be imported automatically.`;
      }
      
      res.json({
        success: true,
        message,
        portfolio: snapshot,
        holdings: snapshot.holdings,
        holdingsCount,
        brokerDetected: importResult.brokerDetected,
        confidenceScore: importResult.confidenceScore,
        needsReview: snapshot.parsingStatus === 'needs_review' || importResult.needsManualReview,
        expectedCount: importResult.expectedCount,
        importedCount: importResult.importedCount,
        unimportedCount: importResult.unimportedCount,
        needsManualEntry: importResult.needsManualReview,
        errors: importResult.errors
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
      const { url, portfolioUrl } = req.body;
      const importUrl = url || portfolioUrl; // Accept both for compatibility
      const agentId = req.user?.id;
      
      if (!agentId) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      if (!importUrl) {
        return res.status(400).json({ error: 'URL is required' });
      }
      
      try {
        new URL(importUrl);
      } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
      
      const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
      const urlObj = new URL(importUrl);
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
      
      // Use unified import service for URL import
      const importResult = await unifiedPortfolioImportService.importFromURL(importUrl);
      
      if (!importResult.success) {
        return res.status(400).json({ 
          error: importResult.error || 'Failed to import from URL', 
          errors: importResult.errors 
        });
      }
      
      const snapshot = createPortfolioSnapshot(
        importResult.holdings.map(h => ({
          name: h.name || 'Unknown',
          symbol: h.symbol,
          isin: h.isin,
          quantity: h.quantity,
          currentValue: h.currentValue,
          assetType: h.assetType
        })),
        'url_import',
        {
          sourceUrl: importUrl,
          sourceName: importResult.brokerDetected || urlObj.hostname,
          brokerDetected: importResult.brokerDetected || undefined,
          confidenceScore: importResult.confidenceScore,
          errors: importResult.errors?.length > 0 ? importResult.errors : undefined
        }
      );
      
      await db
        .update(prospectClients)
        .set({
          fetchedPortfolio: {
            fetchedAt: new Date().toISOString(),
            source: importResult.brokerDetected || urlObj.hostname,
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
      
      // Save to unified portfolio tables using centralized storage
      await upsertProspectPortfolio(
        prospectId,
        prospect.name,
        importResult.holdings,
        "wealthy_url",
        undefined,
        importResult.confidenceScore
      );
      
      const holdingsCount = importResult.holdings.length;
      res.json({
        success: true,
        message: `Successfully imported ${holdingsCount} holdings from ${importResult.brokerDetected || urlObj.hostname}`,
        portfolio: snapshot,
        holdings: snapshot.holdings,
        holdingsCount,
        brokerDetected: importResult.brokerDetected,
        confidenceScore: importResult.confidenceScore,
        needsReview: snapshot.parsingStatus === 'needs_review',
        errors: importResult.errors
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
      
      const uploaded = prospect.uploadedPortfolio as any;
      const fetched = prospect.fetchedPortfolio as any;
      
      const hasUploadedPortfolio = uploaded?.parsedHoldings?.length > 0;
      const hasFetchedPortfolio = fetched?.holdings?.length > 0;
      
      // Merge portfolios into a unified format for the frontend
      let portfolio = null;
      if (hasUploadedPortfolio || hasFetchedPortfolio) {
        // Normalize holdings from either source with complete field set
        const holdings = hasUploadedPortfolio 
          ? uploaded.parsedHoldings.map((h: any, idx: number) => ({
              id: `h-${idx}`,
              name: h.name || 'Unknown',
              symbol: h.symbol || '',
              isin: h.isin || '',
              assetType: normalizeAssetType(h.type),
              currentValue: parseFloat(h.value) || 0,
              units: parseFloat(h.quantity) || 0,
              avgPrice: h.avgPrice || null,
              returns: h.returns || null
            }))
          : fetched?.holdings?.map((h: any, idx: number) => ({
              id: `h-${idx}`,
              name: h.name || 'Unknown',
              symbol: h.symbol || '',
              isin: h.isin || '',
              assetType: normalizeAssetType(h.type),
              currentValue: parseFloat(h.currentValue) || 0,
              units: parseFloat(h.quantity) || 0,
              avgPrice: h.avgPrice || null,
              returns: h.returns || null
            })) || [];
        
        // Get allocation or derive from holdings
        let allocation = hasUploadedPortfolio 
          ? uploaded.allocation 
          : fetched?.allocation;
        
        if (!allocation || Object.keys(allocation).length === 0) {
          allocation = deriveAllocation(holdings);
        }
        
        // Calculate totalValue from holdings if not set
        let totalValue = hasUploadedPortfolio 
          ? (uploaded.totalValue || 0) 
          : (fetched?.totalValue || 0);
        
        if (!totalValue && holdings.length > 0) {
          totalValue = holdings.reduce((sum: number, h: any) => sum + (h.currentValue || 0), 0);
        }
        
        portfolio = {
          holdings,
          allocation,
          totalValue,
          source: hasUploadedPortfolio ? 'pdf_upload' : 'url_import',
          brokerDetected: hasUploadedPortfolio ? uploaded.brokerDetected : fetched?.source,
          importedAt: hasUploadedPortfolio ? uploaded.uploadedAt : fetched?.fetchedAt,
          confidenceScore: hasUploadedPortfolio ? uploaded.confidenceScore : fetched?.confidenceScore,
          parsingStatus: hasUploadedPortfolio ? uploaded.parsingStatus : fetched?.parsingStatus,
          fileName: hasUploadedPortfolio ? uploaded.fileName : undefined
        };
      }
      
      res.json({
        success: true,
        prospectId: prospect.id,
        prospectName: prospect.name,
        hasPortfolio: hasUploadedPortfolio || hasFetchedPortfolio,
        portfolio,
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

// CAS/Statement parsing endpoint (preview before import)
router.post(
  '/portfolio/parse-cas',
  isAuthenticated,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const agentId = req.user?.id;
      
      if (!agentId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      
      const statementType = req.body.type || 'cas'; // 'cas' or 'demat'
      
      // Parse the PDF
      const parseResult = await parsePDFPortfolio(req.file.buffer, req.file.originalname);
      
      if (!parseResult.success || parseResult.holdings.length === 0) {
        return res.json({
          success: false,
          error: parseResult.errors?.[0] || 'No holdings found in the PDF',
          errors: parseResult.errors
        });
      }
      
      // Transform holdings to expected format with confidence scores and transaction lots
      const holdings = parseResult.holdings.map((h, idx) => ({
        id: `cas-${idx}-${Date.now()}`,
        name: h.name || 'Unknown Fund',
        symbol: h.symbol || '',
        isin: h.isin || '',
        quantity: h.quantity || 0,
        averagePrice: h.averageCost || 0,
        investedValue: h.investedValue || 0,
        currentValue: h.currentValue || 0,
        currentNav: h.currentNav || 0,
        unrealizedGain: h.unrealizedGain || 0,
        unrealizedGainPercent: h.unrealizedGainPercent || 0,
        assetType: h.assetType || 'mutual_fund',
        folioNumber: h.folioNumber || '',
        confidenceScore: h.confidenceScore || 85,
        broker: parseResult.brokerDetected || (statementType === 'cas' ? 'CAMS/KFintech' : 'NSDL/CDSL'),
        transactionLots: h.lots || []
      }));
      
      const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
      const totalInvested = holdings.reduce((sum, h) => sum + (h.investedValue || 0), 0);
      const fundsCount = holdings.length;
      
      // Generate import summary message
      const importSummary = `${fundsCount} mutual fund${fundsCount > 1 ? 's' : ''} imported. Current value calculated using today's NAV from FintekPro database.`;
      
      res.json({
        success: true,
        holdings,
        brokerDetected: parseResult.brokerDetected || (statementType === 'cas' ? 'CAMS/KFintech CAS' : 'NSDL/CDSL Demat'),
        confidenceScore: parseResult.confidenceScore,
        totalValue: totalValue,
        totalInvested: totalInvested,
        holdingsCount: fundsCount,
        importSummary: importSummary
      });
    } catch (error: any) {
      console.error('CAS parsing error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to parse statement',
        errors: [error.message || 'Unknown error']
      });
    }
  }
);

router.get(
  '/prospects/:prospectId/portfolio/unified',
  async (req: Request<{ prospectId: string }>, res: Response) => {
    try {
      const prospectId = req.params.prospectId;

      const prospect = await db
        .select()
        .from(prospectClients)
        .where(eq(prospectClients.id, prospectId))
        .limit(1);

      if (!prospect[0]) {
        return res.status(404).json({ error: 'Prospect not found' });
      }

      const portfolio = await db
        .select()
        .from(portfolios)
        .where(eq(portfolios.prospectId, prospectId))
        .limit(1);

      if (!portfolio[0]) {
        return res.json({
          success: true,
          hasPortfolio: false,
          portfolio: null,
          holdings: []
        });
      }

      const holdings = await db
        .select()
        .from(portfolioHoldings)
        .where(eq(portfolioHoldings.portfolioId, portfolio[0].id));

      const totalValue = holdings.reduce((sum, h) => sum + (Number(h.currentValue) || 0), 0);
      const totalInvested = holdings.reduce((sum, h) => sum + (Number(h.investedValue) || 0), 0);

      const allocationMap: Record<string, number> = {};
      holdings.forEach(h => {
        const type = h.productType || h.assetType || 'other';
        allocationMap[type] = (allocationMap[type] || 0) + (Number(h.currentValue) || 0);
      });

      const allocation: Record<string, number> = {};
      Object.entries(allocationMap).forEach(([type, value]) => {
        allocation[type] = totalValue > 0 ? Math.round((value / totalValue) * 100) : 0;
      });

      res.json({
        success: true,
        hasPortfolio: true,
        portfolio: {
          id: portfolio[0].id,
          name: portfolio[0].name,
          totalValue,
          totalInvested,
          source: portfolio[0].source,
          sourceFileName: portfolio[0].sourceFileName,
          isVerified: portfolio[0].isVerified,
          lastFetchedAt: portfolio[0].lastFetchedAt,
          createdAt: portfolio[0].createdAt,
          updatedAt: portfolio[0].updatedAt
        },
        holdings: holdings.map(h => ({
          id: h.id,
          symbol: h.symbol,
          name: h.name,
          isin: h.isin,
          quantity: Number(h.quantity),
          avgPrice: Number(h.avgPrice) || 0,
          currentValue: Number(h.currentValue) || 0,
          investedValue: Number(h.investedValue) || 0,
          assetType: h.assetType,
          productType: h.productType,
          folioNumber: h.folioNumber,
          broker: h.broker,
          confidenceScore: h.confidenceScore
        })),
        allocation,
        summary: {
          holdingsCount: holdings.length,
          totalValue,
          totalInvested,
          gain: totalValue - totalInvested,
          gainPercent: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0
        }
      });
    } catch (error: any) {
      console.error('Error fetching unified portfolio:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to fetch portfolio' 
      });
    }
  }
);

export default router;
