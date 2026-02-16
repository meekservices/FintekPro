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

router.get('/api/portfolio/unified-positions', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const includeExternal = req.query.includeExternal !== 'false';

    const userPortfolios = await db.select()
      .from(portfolios)
      .where(eq(portfolios.userId, userId));

    const unifiedHoldings: UnifiedHolding[] = [];
    let internalCount = 0;
    let externalCount = 0;
    let totalInternalValue = 0;
    let totalExternalValue = 0;

    for (const portfolio of userPortfolios) {
      const holdings = await db.select()
        .from(portfolioHoldings)
        .where(eq(portfolioHoldings.portfolioId, portfolio.id));

      for (const holding of holdings) {
        const avgPrice = parseFloat(holding.avgPrice?.toString() || '0');
        const quantity = parseFloat(holding.quantity?.toString() || '0');
        const investedValue = avgPrice * quantity;
        const currentValue = investedValue * 1.1;
        const gainLoss = currentValue - investedValue;
        const gainLossPercent = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;

        unifiedHoldings.push({
          id: holding.id,
          symbol: holding.symbol || '',
          name: holding.symbol || '',
          assetType: holding.assetType || 'Other',
          quantity,
          currentValue,
          avgPrice,
          gainLoss,
          gainLossPercent,
          source: 'FINTEKPRO',
          isin: undefined,
        });

        internalCount++;
        totalInternalValue += currentValue;
      }
    }

    if (includeExternal) {
      try {
        const extHoldings = await db.select()
          .from(externalHoldings)
          .where(eq(externalHoldings.userId, userId));

        for (const ext of extHoldings) {
          const currentValue = parseFloat(ext.currentValue?.toString() || '0');
          const avgPrice = parseFloat(ext.avgPrice?.toString() || '0');
          const quantity = parseFloat(ext.quantity?.toString() || '0');
          const investedValue = avgPrice * quantity;
          const gainLoss = currentValue - investedValue;
          const gainLossPercent = investedValue > 0 ? (gainLoss / investedValue) * 100 : 0;

          unifiedHoldings.push({
            id: ext.id,
            symbol: ext.symbol || '',
            name: ext.name || ext.symbol || '',
            assetType: ext.assetType || 'Other',
            quantity,
            currentValue,
            avgPrice,
            gainLoss,
            gainLossPercent,
            source: (ext.source as any) || 'CDSL',
            isin: ext.isin || undefined,
            lastSyncedAt: ext.lastSyncedAt?.toISOString(),
          });

          externalCount++;
          totalExternalValue += currentValue;
        }
      } catch (e) {
        console.log('[UnifiedPortfolio] External holdings table may not exist, skipping');
      }
    }

    res.json({
      success: true,
      holdings: unifiedHoldings,
      summary: {
        internalCount,
        externalCount,
        totalCount: internalCount + externalCount,
        totalInternalValue,
        totalExternalValue,
        totalValue: totalInternalValue + totalExternalValue,
      }
    });
  } catch (error: any) {
    console.error('[UnifiedPortfolio] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/portfolio/external-holdings', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let holdings: any[] = [];
    
    try {
      holdings = await db.select()
        .from(externalHoldings)
        .where(eq(externalHoldings.userId, userId));
    } catch (e) {
      holdings = [];
    }

    const formattedHoldings = holdings.map(h => ({
      id: h.id,
      symbol: h.symbol,
      name: h.name || h.symbol,
      assetType: h.assetType || 'Other',
      quantity: parseFloat(h.quantity?.toString() || '0'),
      currentValue: parseFloat(h.currentValue?.toString() || '0'),
      avgPrice: parseFloat(h.avgPrice?.toString() || '0'),
      source: h.source || 'CDSL',
      isin: h.isin,
      depository: h.depository,
      dpId: h.dpId,
      clientId: h.clientId,
      lastSyncedAt: h.lastSyncedAt?.toISOString(),
    }));

    res.json({
      success: true,
      holdings: formattedHoldings,
      count: formattedHoldings.length,
    });
  } catch (error: any) {
    console.error('[ExternalHoldings] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const syncExternalHoldingsSchema = z.object({
  source: z.enum(['CDSL', 'NSDL', 'UPLOADED']),
  holdings: z.array(z.object({
    symbol: z.string(),
    name: z.string().optional(),
    isin: z.string().optional(),
    assetType: z.string().optional(),
    quantity: z.number(),
    avgPrice: z.number().optional(),
    currentValue: z.number().optional(),
    depository: z.string().optional(),
    dpId: z.string().optional(),
    clientId: z.string().optional(),
  })),
  consentId: z.string().optional(),
});

router.post('/api/portfolio/external-holdings/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { source, holdings, consentId } = syncExternalHoldingsSchema.parse(req.body);

    const syncedHoldings = [];
    for (const holding of holdings) {
      try {
        const existing = holding.isin ? await db.select()
          .from(externalHoldings)
          .where(and(
            eq(externalHoldings.userId, userId),
            eq(externalHoldings.isin, holding.isin),
            eq(externalHoldings.source, source)
          ))
          .limit(1) : [];

        let synced;
        if (existing.length > 0) {
          [synced] = await db.update(externalHoldings)
            .set({
              quantity: holding.quantity.toString(),
              avgPrice: holding.avgPrice?.toString() || '0',
              currentValue: holding.currentValue?.toString() || '0',
              lastSyncedAt: new Date(),
            })
            .where(eq(externalHoldings.id, existing[0].id))
            .returning();
        } else {
          [synced] = await db.insert(externalHoldings).values({
            userId,
            symbol: holding.symbol,
            name: holding.name || holding.symbol,
            isin: holding.isin,
            assetType: holding.assetType || 'Equity',
            quantity: holding.quantity.toString(),
            avgPrice: holding.avgPrice?.toString() || '0',
            currentValue: holding.currentValue?.toString() || '0',
            source,
            depository: holding.depository,
            dpId: holding.dpId,
            clientId: holding.clientId,
            consentId,
            lastSyncedAt: new Date(),
          }).returning();
        }
        
        syncedHoldings.push(synced);
      } catch (e) {
        console.error('[ExternalHoldings] Error syncing holding:', holding.symbol, e);
      }
    }

    res.json({
      success: true,
      syncedCount: syncedHoldings.length,
      holdings: syncedHoldings,
    });
  } catch (error: any) {
    console.error('[ExternalHoldings] Sync error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/agent/external-holdings', requireAuth, requireRole('admin', 'agent', 'partner'), async (req: Request, res: Response) => {
  try {
    const { clientId, pan } = req.query;

    let holdings: any[] = [];
    
    try {
      if (pan) {
        const panQuery = pan as string;
        const matchingProfiles = await db.select({
          userId: userProfiles.userId,
          panNumber: userProfiles.panNumber,
        })
        .from(userProfiles)
        .where(eq(userProfiles.panNumber, panQuery.toUpperCase()))
        .limit(1);

        if (matchingProfiles.length === 0) {
          return res.json({
            success: true,
            holdings: [],
            count: 0,
            message: 'No client found with the provided PAN',
          });
        }

        holdings = await db.select({
          holding: externalHoldings,
          user: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
          },
          profile: {
            panNumber: userProfiles.panNumber,
          }
        })
        .from(externalHoldings)
        .innerJoin(users, eq(externalHoldings.userId, users.id))
        .innerJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(eq(userProfiles.panNumber, panQuery.toUpperCase()));
      } else if (clientId) {
        holdings = await db.select({
          holding: externalHoldings,
          user: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
          },
          profile: {
            panNumber: userProfiles.panNumber,
          }
        })
        .from(externalHoldings)
        .innerJoin(users, eq(externalHoldings.userId, users.id))
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(eq(externalHoldings.userId, clientId as string));
      } else {
        // Return all external holdings for agents/admins when no filter provided
        holdings = await db.select({
          holding: externalHoldings,
          user: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
          },
          profile: {
            panNumber: userProfiles.panNumber,
          }
        })
        .from(externalHoldings)
        .innerJoin(users, eq(externalHoldings.userId, users.id))
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .orderBy(desc(externalHoldings.lastUpdated))
        .limit(500);
      }
    } catch (e) {
      console.error('[AgentExternalHoldings] Query error:', e);
      holdings = [];
    }

    const maskPan = (pan: string | null) => {
      if (!pan || pan.length < 10) return 'XXXXX****X';
      return pan.substring(0, 5) + '****' + pan.substring(9);
    };

    const formattedHoldings = holdings.map(h => ({
      id: h.holding.id,
      clientName: h.user.fullName || 'Unknown',
      clientId: h.user.id,
      clientPan: maskPan(h.profile?.panNumber || null),
      symbol: h.holding.symbol,
      name: h.holding.name,
      quantity: parseFloat(h.holding.quantity?.toString() || '0'),
      currentValue: parseFloat(h.holding.currentValue?.toString() || '0'),
      currentBroker: h.holding.source === 'CDSL' ? 'CDSL Depository' : h.holding.source === 'NSDL' ? 'NSDL Depository' : 'External',
      source: h.holding.source,
      isin: h.holding.isin,
      status: h.holding.cobStatus || 'pending',
    }));

    res.json({
      success: true,
      holdings: formattedHoldings,
      count: formattedHoldings.length,
    });
  } catch (error: any) {
    console.error('[AgentExternalHoldings] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const initiateCobSchema = z.object({
  holdingId: z.string(),
  targetBroker: z.string().default('fintekpro'),
  reason: z.string().optional(),
});

router.post('/api/agent/initiate-cob', requireAuth, requireRole('admin', 'agent', 'partner'), async (req: Request, res: Response) => {
  try {
    const agentId = (req.user as any)?.id;
    if (!agentId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { holdingId, targetBroker, reason } = initiateCobSchema.parse(req.body);

    try {
      await db.update(externalHoldings)
        .set({
          cobStatus: 'in_progress',
          cobInitiatedAt: new Date(),
          cobInitiatedBy: agentId,
          cobTargetBroker: targetBroker,
          cobReason: reason,
        })
        .where(eq(externalHoldings.id, holdingId));
    } catch (e) {
      console.error('[COB] Error updating holding:', e);
    }

    res.json({
      success: true,
      message: 'COB request initiated successfully',
      holdingId,
      status: 'in_progress',
    });
  } catch (error: any) {
    console.error('[COB] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

const wealthyImportSchema = z.object({
  url: z.string().url().refine(
    (url) => url.includes('reports.wealthy.in') && url.includes('token='),
    { message: 'Invalid Wealthy.in URL. Expected format: https://reports.wealthy.in/?token=...' }
  ),
  replaceExisting: z.boolean().optional().default(false),
});

router.post('/api/portfolio/import-wealthy', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { url, replaceExisting } = wealthyImportSchema.parse(req.body);

    console.log(`[Wealthy Import] Using unified service for user ${userId}`);
    const importResult = await unifiedPortfolioImportService.importFromWealthyURL(url);

    if (!importResult.success || importResult.holdings.length === 0) {
      return res.status(400).json({
        error: 'No holdings found in the portfolio',
        message: 'The Wealthy.in report did not contain any mutual fund holdings.',
      });
    }

    if (replaceExisting) {
      await db.delete(externalHoldings).where(
        and(
          eq(externalHoldings.userId, userId),
          eq(externalHoldings.source, 'WEALTHY_IN')
        )
      );
      console.log(`[Wealthy Import] Deleted existing holdings for user ${userId}`);
    }

    const { wealthyImportService } = await import('../services/wealthy-import-service');
    const wealthyPortfolio = await wealthyImportService.fetchAndParsePortfolio(url);
    const storageResult = await wealthyImportService.importToExternalHoldings(userId, wealthyPortfolio);

    console.log(`[Wealthy Import] Imported ${storageResult.imported} holdings for user ${userId}`);

    unifiedPortfolioImportService.notifyLinkedAgents(userId, storageResult.imported, 'wealthy_url').catch(() => {});

    res.json({
      success: true,
      investor: importResult.investor,
      summary: {
        totalHoldings: importResult.holdings.length,
        totalCurrentValue: importResult.summary.totalCurrentValue,
        totalInvestedValue: importResult.summary.totalInvestedValue,
      },
      imported: storageResult.imported,
      skipped: storageResult.skipped,
      holdings: storageResult.holdings,
    });
  } catch (error: any) {
    console.error('[Wealthy Import] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to import portfolio' });
  }
});

router.post('/api/portfolio/import/smart', requireAuth, smartUpload.single('portfolio'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const url = req.body?.url;
    if (!req.file && !url) {
      return res.status(400).json({ error: 'Please upload a file or provide a URL' });
    }

    let importResult;
    if (url) {
      const isWealthy = /wealthy\.in/i.test(url);
      importResult = isWealthy
        ? await unifiedPortfolioImportService.importFromWealthyURL(url)
        : await unifiedPortfolioImportService.importFromURL(url);
    } else if (req.file) {
      const filename = req.file.originalname.toLowerCase();
      const mimetype = req.file.mimetype;
      if (filename.endsWith('.csv') || mimetype === 'text/csv') {
        importResult = await unifiedPortfolioImportService.importFromCSV(req.file.buffer.toString('utf-8'), req.file.originalname);
      } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
        importResult = await unifiedPortfolioImportService.importFromExcel(req.file.buffer, req.file.originalname);
      } else if (filename.endsWith('.html') || filename.endsWith('.htm')) {
        importResult = await unifiedPortfolioImportService.importFromHTML(req.file.buffer.toString('utf-8'), req.file.originalname);
      } else {
        importResult = await unifiedPortfolioImportService.importFromPDF(req.file.buffer, req.file.originalname);
      }
    }

    if (!importResult || !importResult.success || importResult.holdings.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No holdings found in the uploaded file',
        errors: importResult?.errors || ['Failed to parse portfolio']
      });
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
      portfolioSummary: importResult.portfolioSummary,
    });
  } catch (error: any) {
    console.error('[Smart Import] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to import portfolio' });
  }
});

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
