// @ts-nocheck
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
      return res.status(400).json({ error: 'Invalid request', details: error.issues });
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
      return res.status(400).json({ error: 'Invalid request', details: error.issues });
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
      return res.status(400).json({ error: 'Invalid request', details: error.issues });
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


export default router;
