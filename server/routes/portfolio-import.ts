import { Router, Request, Response } from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import { db } from '../db';
import { prospectClients, portfolios, portfolioHoldings } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { isAuthenticated } from '../replitAuth';
import { parsePDFPortfolio, parseURLPortfolio, createPortfolioSnapshot } from '../services/portfolio-parser';

// Helper function to detect if file is HTML
function isHTMLFile(filename: string, mimetype: string): boolean {
  const ext = filename.toLowerCase();
  return ext.endsWith('.html') || ext.endsWith('.htm') || 
         mimetype === 'text/html' || mimetype === 'application/xhtml+xml';
}

const router = Router();

// Helper function to normalize asset type strings
function normalizeAssetType(type: string | undefined): string {
  if (!type) return 'equity';
  const normalized = type.toLowerCase().trim();
  if (normalized.includes('equity') || normalized.includes('stock')) return 'equity';
  if (normalized.includes('debt') || normalized.includes('bond') || normalized.includes('fixed')) return 'debt';
  if (normalized.includes('gold') || normalized.includes('commodity')) return 'gold';
  if (normalized.includes('cash') || normalized.includes('liquid') || normalized.includes('money')) return 'cash';
  if (normalized.includes('mutual') || normalized.includes('fund')) return 'mutual_fund';
  return 'others';
}

// Helper function to derive allocation from holdings
function deriveAllocation(holdings: any[]): Record<string, number> {
  const allocation: Record<string, number> = { equity: 0, debt: 0, gold: 0, cash: 0, others: 0 };
  const total = holdings.reduce((sum: number, h: any) => sum + (h.currentValue || 0), 0);
  
  if (total === 0) return allocation;
  
  holdings.forEach((h: any) => {
    const value = h.currentValue || 0;
    const type = h.assetType || 'others';
    const key = ['equity', 'debt', 'gold', 'cash'].includes(type) ? type : 'others';
    allocation[key] = (allocation[key] || 0) + (value / total) * 100;
  });
  
  // Round to 2 decimal places
  Object.keys(allocation).forEach(key => {
    allocation[key] = Math.round(allocation[key] * 100) / 100;
  });
  
  return allocation;
}

// Helper function to upsert portfolio into unified tables
async function upsertProspectPortfolio(
  prospectId: string,
  prospectName: string,
  holdings: any[],
  source: string,
  sourceFileName?: string,
  confidenceScore?: number
): Promise<string> {
  // Check if portfolio already exists for this prospect
  const [existingPortfolio] = await db
    .select()
    .from(portfolios)
    .where(eq(portfolios.prospectId, prospectId))
    .limit(1);

  let portfolioId: string;
  const totalValue = holdings.reduce((sum: number, h: any) => sum + (h.currentValue || h.value || 0), 0);

  if (existingPortfolio) {
    // Update existing portfolio
    portfolioId = existingPortfolio.id;
    await db
      .update(portfolios)
      .set({
        totalValue: totalValue.toString(),
        source,
        sourceFileName,
        updatedAt: new Date()
      })
      .where(eq(portfolios.id, portfolioId));
    
    // Delete existing holdings and insert new ones
    await db
      .delete(portfolioHoldings)
      .where(eq(portfolioHoldings.portfolioId, portfolioId));
  } else {
    // Create new portfolio
    const [newPortfolio] = await db
      .insert(portfolios)
      .values({
        prospectId,
        name: `${prospectName}'s Portfolio`,
        totalValue: totalValue.toString(),
        source,
        sourceFileName,
        isDefault: true,
        isVerified: false
      })
      .returning();
    portfolioId = newPortfolio.id;
  }

  // Insert holdings into unified table
  if (holdings.length > 0) {
    await db.insert(portfolioHoldings).values(
      holdings.map(h => ({
        portfolioId,
        symbol: h.symbol || null,
        name: h.name || h.productName || 'Unknown',
        isin: h.isin || null,
        quantity: (h.quantity || 1).toString(),
        avgPrice: h.avgPrice?.toString() || h.averageCost?.toString() || null,
        currentValue: (h.currentValue || h.value || 0).toString(),
        investedValue: h.investedValue?.toString() || null,
        assetType: normalizeAssetType(h.assetType || h.type || h.productType),
        productType: h.productType || null,
        folioNumber: h.folioNumber || null,
        broker: h.broker || null,
        confidenceScore: confidenceScore || null,
        source: 'uploaded',
        purchaseDate: h.purchaseDate ? new Date(h.purchaseDate) : null
      }))
    );
  }

  return portfolioId;
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
      'application/xhtml+xml'
    ];
    // Also check file extension for HTML files (some browsers send different mime types)
    const isHtmlFile = file.originalname.toLowerCase().endsWith('.html') || 
                       file.originalname.toLowerCase().endsWith('.htm');
    if (allowedMimes.includes(file.mimetype) || isHtmlFile) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and HTML files are allowed'));
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
      
      // Detect if the file is HTML or PDF and parse accordingly
      const isHTML = isHTMLFile(req.file.originalname, req.file.mimetype);
      let parseResult;
      
      if (isHTML) {
        // Parse HTML file using the URL parser logic
        const htmlContent = req.file.buffer.toString('utf-8');
        // Try to detect source URL from filename (e.g., Wealthy_timestamp.html)
        const sourceUrl = req.file.originalname.toLowerCase().includes('wealthy') 
          ? 'wealthy.in' 
          : 'html_upload';
        parseResult = await parseURLPortfolio(htmlContent, sourceUrl);
      } else {
        // Parse PDF file
        parseResult = await parsePDFPortfolio(req.file.buffer, req.file.originalname);
      }
      
      const fileType = isHTML ? 'html' : 'pdf';
      
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
      
      // Also save to unified portfolio tables
      await upsertProspectPortfolio(
        prospectId,
        prospect.name,
        snapshot.holdings,
        "uploaded",
        req.file.originalname,
        parseResult.confidenceScore
      );
      
      // Build the success message based on import results
      let message = '';
      if (parseResult.success) {
        if (parseResult.unimportedCount && parseResult.unimportedCount > 0) {
          message = `Imported ${parseResult.importedCount} of ${parseResult.expectedCount} holdings from ${parseResult.brokerDetected || 'portfolio'}. ${parseResult.unimportedCount} fund(s) could not be imported automatically.`;
        } else {
          message = `Successfully parsed ${parseResult.holdings.length} holdings from ${parseResult.brokerDetected || 'portfolio'}`;
        }
      } else {
        message = 'Portfolio uploaded but parsing needs review';
      }
      
      res.json({
        success: true,
        message,
        portfolio: snapshot,
        holdings: snapshot.holdings, // For frontend compatibility
        holdingsCount: parseResult.holdings.length,
        brokerDetected: parseResult.brokerDetected,
        confidenceScore: parseResult.confidenceScore,
        needsReview: snapshot.parsingStatus === 'needs_review' || parseResult.needsManualReview,
        expectedCount: parseResult.expectedCount,
        importedCount: parseResult.importedCount,
        unimportedCount: parseResult.unimportedCount,
        needsManualEntry: parseResult.needsManualReview,
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
      
      const response = await fetch(importUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 30000
      });
      
      if (!response.ok) {
        return res.status(400).json({ error: `Failed to fetch URL: ${response.status}` });
      }
      
      const html = await response.text();
      const parseResult = await parseURLPortfolio(html, importUrl);
      
      const snapshot = createPortfolioSnapshot(
        parseResult.holdings,
        'url_import',
        {
          sourceUrl: importUrl,
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
      
      // Also save to unified portfolio tables
      await upsertProspectPortfolio(
        prospectId,
        prospect.name,
        snapshot.holdings,
        "cas_fetch",
        undefined,
        parseResult.confidenceScore
      );
      
      res.json({
        success: true,
        message: parseResult.success 
          ? `Successfully imported ${parseResult.holdings.length} holdings from ${parseResult.brokerDetected || urlObj.hostname}`
          : 'URL imported but parsing needs review',
        portfolio: snapshot,
        holdings: snapshot.holdings, // For frontend compatibility
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
      
      // Transform holdings to expected format with confidence scores
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
        broker: parseResult.brokerDetected || (statementType === 'cas' ? 'CAMS/KFintech' : 'NSDL/CDSL')
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
