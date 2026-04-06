import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { 
  portfolios, 
  portfolioHoldings, 
  externalHoldings,
  users,
  userProfiles,
  transactionRecords,
  transactionReports
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middleware/roleMiddleware';
import { unifiedPortfolioImportService } from '../services/unified-portfolio-import-service';
import { portfolioStorageService } from '../services/portfolio-storage-service';
import { assertLotsNotDropped } from '../services/holding-transformer';
import multer from 'multer';

const router = Router();

const smartUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

interface UnifiedHolding {
  id: string;
  symbol: string;
  name: string;
  assetType: string;
  quantity: number;
  currentValue: number;
  avgPrice: number;
  gainLoss: number;
  gainLossPercent: number;
  source: 'FINTEKPRO' | 'CDSL' | 'NSDL' | 'UPLOADED';
  isin?: string;
  lastSyncedAt?: string;
}

router.post('/api/portfolio/import/pdf', requireAuth, smartUpload.single('portfolio'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filename = req.file.originalname.toLowerCase();
    const mimetype = req.file.mimetype;
    let importResult;
    if (filename.endsWith('.csv') || mimetype === 'text/csv') {
      importResult = await unifiedPortfolioImportService.importFromCSV(req.file.buffer.toString('utf-8'), req.file.originalname);
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      importResult = await unifiedPortfolioImportService.importFromExcel(req.file.buffer, req.file.originalname);
    } else if (filename.endsWith('.html') || filename.endsWith('.htm')) {
      importResult = await unifiedPortfolioImportService.importFromHTML(req.file.buffer.toString('utf-8'), req.file.originalname);
    } else {
      importResult = await unifiedPortfolioImportService.importFromPDF(req.file.buffer, req.file.originalname);
    }

    if (!importResult.success || importResult.holdings.length === 0) {
      return res.status(400).json({ success: false, error: 'No holdings found', errors: importResult.errors });
    }

    res.json({
      success: true,
      holdings: importResult.holdings,
      investor: importResult.investor,
      summary: importResult.summary,
      brokerDetected: importResult.brokerDetected,
      confidenceScore: importResult.confidenceScore,
      source: importResult.source,
      warnings: importResult.warnings || [],
      errors: importResult.errors,
    });
  } catch (error: any) {
    console.error('[Portfolio PDF Import] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse portfolio' });
  }
});

router.post('/api/portfolio/import/url', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const isWealthy = /wealthy\.in/i.test(url);
    const importResult = isWealthy
      ? await unifiedPortfolioImportService.importFromWealthyURL(url)
      : await unifiedPortfolioImportService.importFromURL(url);

    if (!importResult.success || importResult.holdings.length === 0) {
      return res.status(400).json({ success: false, error: 'No holdings found from URL', errors: importResult.errors });
    }

    res.json({
      success: true,
      holdings: importResult.holdings,
      investor: importResult.investor,
      summary: importResult.summary,
      brokerDetected: importResult.brokerDetected,
      confidenceScore: importResult.confidenceScore,
      source: importResult.source,
      warnings: importResult.warnings || [],
    });
  } catch (error: any) {
    console.error('[Portfolio URL Import] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to import from URL' });
  }
});

router.post('/api/portfolio/import/cas', requireAuth, smartUpload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const importResult = await unifiedPortfolioImportService.importFromPDF(
      req.file.buffer, req.file.originalname, { detectCAS: true }
    );

    if (!importResult.success || importResult.holdings.length === 0) {
      return res.status(400).json({ success: false, error: 'No holdings found in CAS statement', errors: importResult.errors });
    }

    res.json({
      success: true,
      holdings: importResult.holdings,
      investor: importResult.investor,
      summary: importResult.summary,
      brokerDetected: importResult.brokerDetected,
      confidenceScore: importResult.confidenceScore,
      source: importResult.source,
      warnings: importResult.warnings || [],
      errors: importResult.errors,
      tierBreakdown: importResult.tierBreakdown,
      lotCounts: importResult.lotCounts,
      reconciliation: importResult.reconciliation,
    });
  } catch (error: any) {
    console.error('[CAS Import] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse CAS statement' });
  }
});

router.post('/api/portfolio/import/save', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { holdings, source, replaceExisting } = req.body;
    if (!holdings || !Array.isArray(holdings) || holdings.length === 0) {
      return res.status(400).json({ error: 'No holdings to save' });
    }

    const unifiedHoldings = holdings.map((h: any) => ({
      name: h.name || h.schemeName || 'Unknown',
      isin: h.isin,
      symbol: h.symbol,
      folioNumber: h.folioNumber,
      assetType: h.assetType || 'mutual_fund',
      quantity: parseFloat(h.quantity || h.units || '0'),
      avgCostPerUnit: parseFloat(h.avgPrice || h.averagePrice || '0'),
      investedValue: parseFloat(h.investedValue || '0'),
      currentValue: parseFloat(h.currentValue || '0'),
      broker: h.broker,
      purchaseDate: h.purchaseDate,
    }));

    const storageResult = await portfolioStorageService.upsertUserPortfolio(
      userId,
      unifiedHoldings,
      { source: source || 'broker_pdf', confidenceScore: 85, replaceExisting: replaceExisting || false }
    );

    unifiedPortfolioImportService.notifyLinkedAgents(userId, unifiedHoldings.length, source || 'broker_pdf').catch(() => {});

    res.json({
      success: true,
      savedCount: unifiedHoldings.length,
      portfolioId: storageResult.portfolioId,
    });
  } catch (error: any) {
    console.error('[Portfolio Save] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to save holdings' });
  }
});

router.get('/api/portfolio/external-holdings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const source = req.query.source as string | undefined;
    
    let holdings;
    if (source) {
      holdings = await db.select()
        .from(externalHoldings)
        .where(and(
          eq(externalHoldings.userId, userId),
          eq(externalHoldings.source, source)
        ))
        .orderBy(desc(externalHoldings.lastSyncedAt));
    } else {
      holdings = await db.select()
        .from(externalHoldings)
        .where(eq(externalHoldings.userId, userId))
        .orderBy(desc(externalHoldings.lastSyncedAt));
    }

    const totalInvested = holdings.reduce((sum, h) => {
      const qty = parseFloat(h.quantity?.toString() || '0');
      const avgPrice = parseFloat(h.avgPrice?.toString() || '0');
      return sum + (qty * avgPrice);
    }, 0);

    const totalCurrentValue = holdings.reduce((sum, h) => {
      return sum + parseFloat(h.currentValue?.toString() || '0');
    }, 0);

    res.json({
      holdings,
      summary: {
        totalHoldings: holdings.length,
        totalInvested,
        totalCurrentValue,
        gainLoss: totalCurrentValue - totalInvested,
        gainLossPercent: totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0,
      },
    });
  } catch (error: any) {
    console.error('[External Holdings] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unified Portfolio Sync - Complete view with holdings grouped by asset type and transaction history
router.get('/api/portfolio/unified-complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch all portfolios for user
    const userPortfolios = await db.select()
      .from(portfolios)
      .where(eq(portfolios.userId, userId));

    if (userPortfolios.length === 0) {
      return res.json({
        success: true,
        holdingsByAssetType: {},
        transactions: [],
        summary: {
          totalHoldings: 0,
          totalValue: 0,
          assetTypes: [],
          sources: [],
          lastSyncedAt: null
        }
      });
    }

    // Fetch all holdings for user's portfolios
    const portfolioIds = userPortfolios.map(p => p.id);
    const allHoldings: any[] = [];
    
    for (const portfolioId of portfolioIds) {
      const holdings = await db.select()
        .from(portfolioHoldings)
        .where(eq(portfolioHoldings.portfolioId, portfolioId));
      allHoldings.push(...holdings);
    }

    // Group holdings by asset type
    const holdingsByAssetType: Record<string, any[]> = {};
    let totalValue = 0;
    const sources = new Set<string>();

    for (const holding of allHoldings) {
      const assetType = holding.assetType || 'other';
      if (!holdingsByAssetType[assetType]) {
        holdingsByAssetType[assetType] = [];
      }
      
      const currentValue = parseFloat(holding.currentValue?.toString() || '0');
      const investedValue = parseFloat(holding.investedValue?.toString() || '0');
      const quantity = parseFloat(holding.quantity?.toString() || '0');
      const avgPrice = parseFloat(holding.avgPrice?.toString() || '0');
      
      holdingsByAssetType[assetType].push({
        id: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        isin: holding.isin,
        assetType,
        quantity,
        avgPrice,
        currentValue,
        investedValue,
        gainLoss: currentValue - investedValue,
        gainLossPercent: investedValue > 0 ? ((currentValue - investedValue) / investedValue) * 100 : 0,
        source: holding.source,
        broker: holding.broker,
        folioNumber: holding.folioNumber,
        confidenceScore: holding.confidenceScore,
        updatedAt: holding.updatedAt
      });
      
      totalValue += currentValue;
      if (holding.source) sources.add(holding.source);
    }

    // Fetch transaction reports for user
    const reports = await db.select()
      .from(transactionReports)
      .where(eq(transactionReports.userId, userId))
      .orderBy(desc(transactionReports.fetchedAt));

    // Fetch recent transactions with source from report (limit to 100 most recent)
    const transactionsWithSource = await db.select({
      transaction: transactionRecords,
      source: transactionReports.source,
      assetType: transactionReports.assetType
    })
      .from(transactionRecords)
      .leftJoin(transactionReports, eq(transactionRecords.reportId, transactionReports.id))
      .where(eq(transactionRecords.userId, userId))
      .orderBy(desc(transactionRecords.transactionDate))
      .limit(100);

    const formattedTransactions = transactionsWithSource.map(({ transaction: tx, source, assetType }) => ({
      id: tx.id,
      date: tx.transactionDate,
      type: tx.transactionType,
      fundName: tx.fundName,
      fundCode: tx.fundCode,
      isin: tx.fundCode, // Using fundCode as ISIN fallback
      folioNumber: tx.folio,
      units: parseFloat(tx.units?.toString() || '0'),
      nav: parseFloat(tx.nav?.toString() || '0'),
      amount: parseFloat(tx.amount?.toString() || '0'),
      netAmount: parseFloat(tx.netAmount?.toString() || '0'),
      stampDuty: parseFloat(tx.stampDuty?.toString() || '0'),
      stt: parseFloat(tx.stt?.toString() || '0'),
      tds: parseFloat(tx.tds?.toString() || '0'),
      registrar: tx.registrar,
      source: source || 'unknown', // Source from report: bse_star_cas, nsdl, cdsl
      assetType: assetType || 'mutual_fund',
      createdAt: tx.createdAt
    }));

    // Get the most recent sync timestamp
    const lastSyncedAt = userPortfolios
      .map(p => p.lastFetchedAt)
      .filter(Boolean)
      .sort((a, b) => (b?.getTime() || 0) - (a?.getTime() || 0))[0];

    res.json({
      success: true,
      holdingsByAssetType,
      transactions: formattedTransactions,
      transactionReports: reports.map(r => ({
        id: r.id,
        financialYear: r.financialYear,
        source: r.source,
        assetType: r.assetType,
        transactionCount: r.transactionCount,
        totalPurchases: r.totalPurchases,
        totalRedemptions: r.totalRedemptions,
        totalSwitches: r.totalSwitches,
        totalDividendReceived: r.totalDividendReceived,
        status: r.status,
        fetchedAt: r.fetchedAt
      })),
      summary: {
        totalHoldings: allHoldings.length,
        totalValue,
        assetTypes: Object.keys(holdingsByAssetType),
        sources: Array.from(sources),
        lastSyncedAt,
        fetchStatus: userPortfolios[0]?.lastFetchStatus,
        portfolioCount: userPortfolios.length
      }
    });
  } catch (error: any) {
    console.error('[Unified Complete] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Agent endpoint to view client's unified portfolio
router.get('/api/agent/clients/:clientId/portfolio/unified', requireAuth, requireRole('admin', 'agent', 'partner'), async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    
    // Fetch client's portfolios
    const clientPortfolios = await db.select()
      .from(portfolios)
      .where(eq(portfolios.userId, clientId));

    if (clientPortfolios.length === 0) {
      return res.json({
        success: true,
        holdingsByAssetType: {},
        transactions: [],
        summary: {
          totalHoldings: 0,
          totalValue: 0,
          assetTypes: [],
          sources: [],
          lastSyncedAt: null
        }
      });
    }

    // Fetch all holdings for client's portfolios
    const portfolioIds = clientPortfolios.map(p => p.id);
    const allHoldings: any[] = [];
    
    for (const portfolioId of portfolioIds) {
      const holdings = await db.select()
        .from(portfolioHoldings)
        .where(eq(portfolioHoldings.portfolioId, portfolioId));
      allHoldings.push(...holdings);
    }

    // Group holdings by asset type
    const holdingsByAssetType: Record<string, any[]> = {};
    let totalValue = 0;
    const sources = new Set<string>();

    for (const holding of allHoldings) {
      const assetType = holding.assetType || 'other';
      if (!holdingsByAssetType[assetType]) {
        holdingsByAssetType[assetType] = [];
      }
      
      const currentValue = parseFloat(holding.currentValue?.toString() || '0');
      const investedValue = parseFloat(holding.investedValue?.toString() || '0');
      const quantity = parseFloat(holding.quantity?.toString() || '0');
      const avgPrice = parseFloat(holding.avgPrice?.toString() || '0');
      
      holdingsByAssetType[assetType].push({
        id: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        isin: holding.isin,
        assetType,
        quantity,
        avgPrice,
        currentValue,
        investedValue,
        gainLoss: currentValue - investedValue,
        gainLossPercent: investedValue > 0 ? ((currentValue - investedValue) / investedValue) * 100 : 0,
        source: holding.source,
        broker: holding.broker,
        folioNumber: holding.folioNumber,
        confidenceScore: holding.confidenceScore,
        updatedAt: holding.updatedAt
      });
      
      totalValue += currentValue;
      if (holding.source) sources.add(holding.source);
    }

    // Fetch transaction reports for client
    const reports = await db.select()
      .from(transactionReports)
      .where(eq(transactionReports.userId, clientId))
      .orderBy(desc(transactionReports.fetchedAt));

    // Fetch recent transactions with source from report (limit to 100 most recent)
    const transactionsWithSource = await db.select({
      transaction: transactionRecords,
      source: transactionReports.source,
      assetType: transactionReports.assetType
    })
      .from(transactionRecords)
      .leftJoin(transactionReports, eq(transactionRecords.reportId, transactionReports.id))
      .where(eq(transactionRecords.userId, clientId))
      .orderBy(desc(transactionRecords.transactionDate))
      .limit(100);

    const formattedTransactions = transactionsWithSource.map(({ transaction: tx, source, assetType }) => ({
      id: tx.id,
      date: tx.transactionDate,
      type: tx.transactionType,
      fundName: tx.fundName,
      fundCode: tx.fundCode,
      isin: tx.fundCode,
      folioNumber: tx.folio,
      units: parseFloat(tx.units?.toString() || '0'),
      nav: parseFloat(tx.nav?.toString() || '0'),
      amount: parseFloat(tx.amount?.toString() || '0'),
      netAmount: parseFloat(tx.netAmount?.toString() || '0'),
      source: source || 'unknown',
      assetType: assetType || 'mutual_fund'
    }));

    // Get the most recent sync timestamp
    const lastSyncedAt = clientPortfolios
      .map(p => p.lastFetchedAt)
      .filter(Boolean)
      .sort((a, b) => (b?.getTime() || 0) - (a?.getTime() || 0))[0];

    res.json({
      success: true,
      holdingsByAssetType,
      transactions: formattedTransactions,
      transactionReports: reports.map(r => ({
        id: r.id,
        financialYear: r.financialYear,
        source: r.source,
        assetType: r.assetType,
        transactionCount: r.transactionCount,
        status: r.status,
        fetchedAt: r.fetchedAt
      })),
      summary: {
        totalHoldings: allHoldings.length,
        totalValue,
        assetTypes: Object.keys(holdingsByAssetType),
        sources: Array.from(sources),
        lastSyncedAt,
        fetchStatus: clientPortfolios[0]?.lastFetchStatus,
        portfolioCount: clientPortfolios.length
      }
    });
  } catch (error: any) {
    console.error('[Agent Unified] Error:', error);
    res.status(500).json({ error: error.message });
  }
});


export default router;
