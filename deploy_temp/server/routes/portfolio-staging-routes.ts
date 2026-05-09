/**
 * Portfolio Staging Routes
 * 
 * API endpoints for reviewing imported holdings before final sync.
 * Provides a staging area where users can:
 * - View imported holdings
 * - Approve/reject individual holdings
 * - Edit holding details
 * - Final sync approved holdings to comprehensiveHoldings
 * 
 * Part of the Unified Portfolio Import System architecture.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  comprehensiveHoldings,
  portfolios,
  users
} from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const router = Router();

interface StagedHolding {
  id: string;
  name: string;
  isin?: string;
  symbol?: string;
  assetType: string;
  quantity: number;
  units?: number;
  averageCost?: number;
  currentPrice?: number;
  currentValue?: number;
  investedValue?: number;
  gainLoss?: number;
  gainLossPercent?: number;
  folioNumber?: string;
  dematAccountNumber?: string;
  source: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  originalData?: any;
  modifiedFields?: string[];
  validationErrors?: string[];
}

interface StagingSession {
  id: string;
  userId: string;
  holdings: StagedHolding[];
  totalValue: number;
  createdAt: string;
  status: 'pending_review' | 'partially_approved' | 'fully_approved' | 'synced';
}

const stagingSessions = new Map<string, StagingSession>();

/**
 * GET /api/portfolio/staging
 * Get current staging session for user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const session = stagingSessions.get(userId);
    
    if (!session) {
      return res.json({
        id: null,
        userId,
        holdings: [],
        totalValue: 0,
        createdAt: null,
        status: 'pending_review'
      });
    }

    res.json(session);
  } catch (error: any) {
    console.error('[Staging] Error getting session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/portfolio/staging/create
 * Create a new staging session with holdings to review
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { userId, holdings, source } = req.body;

    if (!userId || !holdings || !Array.isArray(holdings)) {
      return res.status(400).json({ error: 'userId and holdings array are required' });
    }

    const stagedHoldings: StagedHolding[] = holdings.map((h: any) => {
      const holding: StagedHolding = {
        id: h.id || nanoid(),
        name: h.name || h.assetName || h.schemeName || 'Unknown',
        isin: h.isin,
        symbol: h.symbol,
        assetType: h.assetType || 'equity',
        quantity: parseFloat(h.quantity) || 0,
        units: parseFloat(h.units) || undefined,
        averageCost: parseFloat(h.averageCost) || parseFloat(h.avgPrice) || undefined,
        currentPrice: parseFloat(h.currentPrice) || parseFloat(h.currentNav) || undefined,
        currentValue: parseFloat(h.currentValue) || parseFloat(h.marketValue) || undefined,
        investedValue: parseFloat(h.investedValue) || undefined,
        folioNumber: h.folioNumber || h.folio,
        dematAccountNumber: h.dematAccountNumber,
        source: source || h.source || 'manual',
        status: 'pending',
        originalData: h,
        validationErrors: validateHolding(h),
      };

      if (holding.currentValue && holding.investedValue) {
        holding.gainLoss = holding.currentValue - holding.investedValue;
        holding.gainLossPercent = holding.investedValue > 0 
          ? ((holding.currentValue - holding.investedValue) / holding.investedValue) * 100 
          : 0;
      }

      return holding;
    });

    const totalValue = stagedHoldings.reduce((sum, h) => sum + (h.currentValue || 0), 0);

    const session: StagingSession = {
      id: nanoid(),
      userId,
      holdings: stagedHoldings,
      totalValue,
      createdAt: new Date().toISOString(),
      status: 'pending_review'
    };

    stagingSessions.set(userId, session);

    console.log(`[Staging] Created session for user ${userId} with ${stagedHoldings.length} holdings`);

    res.json({
      success: true,
      sessionId: session.id,
      holdingsCount: stagedHoldings.length,
      totalValue
    });
  } catch (error: any) {
    console.error('[Staging] Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/portfolio/staging/approve
 * Approve selected holdings for sync
 */
router.post('/approve', async (req: Request, res: Response) => {
  try {
    const { userId, holdingIds } = req.body;

    if (!userId || !holdingIds || !Array.isArray(holdingIds)) {
      return res.status(400).json({ error: 'userId and holdingIds array are required' });
    }

    const session = stagingSessions.get(userId);
    if (!session) {
      return res.status(404).json({ error: 'No staging session found' });
    }

    let approvedCount = 0;
    session.holdings = session.holdings.map(h => {
      if (holdingIds.includes(h.id) && h.status !== 'rejected') {
        approvedCount++;
        return { ...h, status: 'approved' as const };
      }
      return h;
    });

    updateSessionStatus(session);
    stagingSessions.set(userId, session);

    res.json({ success: true, approvedCount });
  } catch (error: any) {
    console.error('[Staging] Error approving holdings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/portfolio/staging/reject
 * Reject selected holdings (exclude from sync)
 */
router.post('/reject', async (req: Request, res: Response) => {
  try {
    const { userId, holdingIds } = req.body;

    if (!userId || !holdingIds || !Array.isArray(holdingIds)) {
      return res.status(400).json({ error: 'userId and holdingIds array are required' });
    }

    const session = stagingSessions.get(userId);
    if (!session) {
      return res.status(404).json({ error: 'No staging session found' });
    }

    let rejectedCount = 0;
    session.holdings = session.holdings.map(h => {
      if (holdingIds.includes(h.id)) {
        rejectedCount++;
        return { ...h, status: 'rejected' as const };
      }
      return h;
    });

    updateSessionStatus(session);
    session.totalValue = session.holdings
      .filter(h => h.status !== 'rejected')
      .reduce((sum, h) => sum + (h.currentValue || 0), 0);
    
    stagingSessions.set(userId, session);

    res.json({ success: true, rejectedCount });
  } catch (error: any) {
    console.error('[Staging] Error rejecting holdings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/portfolio/staging/update
 * Update a specific holding in staging
 */
router.patch('/update', async (req: Request, res: Response) => {
  try {
    const { userId, holdingId, data } = req.body;

    if (!userId || !holdingId || !data) {
      return res.status(400).json({ error: 'userId, holdingId, and data are required' });
    }

    const session = stagingSessions.get(userId);
    if (!session) {
      return res.status(404).json({ error: 'No staging session found' });
    }

    const holdingIndex = session.holdings.findIndex(h => h.id === holdingId);
    if (holdingIndex === -1) {
      return res.status(404).json({ error: 'Holding not found in staging' });
    }

    const original = session.holdings[holdingIndex];
    const modifiedFields: string[] = [];

    Object.keys(data).forEach(key => {
      if ((data as any)[key] !== (original as any)[key]) {
        modifiedFields.push(key);
      }
    });

    const updated: StagedHolding = {
      ...original,
      ...data,
      status: modifiedFields.length > 0 ? 'modified' : original.status,
      modifiedFields: [...(original.modifiedFields || []), ...modifiedFields],
    };

    if (updated.currentPrice && updated.units) {
      updated.currentValue = updated.currentPrice * updated.units;
    } else if (updated.currentPrice && updated.quantity) {
      updated.currentValue = updated.currentPrice * updated.quantity;
    }

    if (updated.currentValue && updated.investedValue) {
      updated.gainLoss = updated.currentValue - updated.investedValue;
      updated.gainLossPercent = updated.investedValue > 0 
        ? ((updated.currentValue - updated.investedValue) / updated.investedValue) * 100 
        : 0;
    }

    updated.validationErrors = validateHolding(updated);

    session.holdings[holdingIndex] = updated;
    session.totalValue = session.holdings
      .filter(h => h.status !== 'rejected')
      .reduce((sum, h) => sum + (h.currentValue || 0), 0);

    stagingSessions.set(userId, session);

    res.json({ success: true, holding: updated });
  } catch (error: any) {
    console.error('[Staging] Error updating holding:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/portfolio/staging/sync
 * Final sync - write approved holdings to comprehensiveHoldings table
 */
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const { userId, sessionId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const session = stagingSessions.get(userId);
    if (!session) {
      return res.status(404).json({ error: 'No staging session found' });
    }

    const holdingsToSync = session.holdings.filter(h => 
      h.status === 'approved' || h.status === 'modified'
    );

    if (holdingsToSync.length === 0) {
      return res.status(400).json({ error: 'No approved holdings to sync' });
    }

    let [portfolio] = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, userId))
      .limit(1);

    if (!portfolio) {
      [portfolio] = await db.insert(portfolios).values({
        userId,
        name: 'Primary Portfolio',
        isDefault: true,
      }).returning();
    }

    const holdingDate = new Date().toISOString().split('T')[0];
    let syncedCount = 0;
    const errors: string[] = [];

    for (const holding of holdingsToSync) {
      try {
        const existingCheck = holding.isin ? await db
          .select({ id: comprehensiveHoldings.id })
          .from(comprehensiveHoldings)
          .where(and(
            eq(comprehensiveHoldings.userId, userId),
            eq(comprehensiveHoldings.isin as any, holding.isin),
            holding.folioNumber ? eq(comprehensiveHoldings.folio as any, holding.folioNumber) : undefined
          ))
          .limit(1) : [];

        if (existingCheck.length > 0) {
          await db.update(comprehensiveHoldings)
            .set({
              quantity: holding.quantity?.toString(),
              units: holding.units?.toString(),
              avgPrice: holding.averageCost?.toString(),
              currentPrice: holding.currentPrice?.toString(),
              marketValue: holding.currentValue?.toString(),
              investedValue: holding.investedValue?.toString(),
              gainLoss: holding.gainLoss?.toString(),
              gainLossPercent: holding.gainLossPercent?.toString(),
              updatedAt: new Date(),
            })
            .where(eq(comprehensiveHoldings.id, existingCheck[0].id));
        } else {
          await db.insert(comprehensiveHoldings).values({
            id: nanoid(),
            portfolioId: portfolio.id,
            userId,
            holdingDate,
            symbol: holding.symbol || holding.name,
            isin: holding.isin,
            assetName: holding.name,
            assetType: holding.assetType,
            quantity: holding.quantity?.toString(),
            units: holding.units?.toString(),
            avgPrice: holding.averageCost?.toString(),
            currentPrice: holding.currentPrice?.toString(),
            marketValue: holding.currentValue?.toString(),
            investedValue: holding.investedValue?.toString(),
            gainLoss: holding.gainLoss?.toString(),
            gainLossPercent: holding.gainLossPercent?.toString(),
            dataSource: holding.source,
            folio: holding.folioNumber,
            dematAccountNumber: holding.dematAccountNumber,
          });
        }

        syncedCount++;
      } catch (err: any) {
        console.error(`[Staging] Error syncing holding ${holding.name}:`, err);
        errors.push(`${holding.name}: ${err.message}`);
      }
    }

    session.status = 'synced';
    stagingSessions.set(userId, session);

    setTimeout(() => {
      stagingSessions.delete(userId);
    }, 5 * 60 * 1000);

    console.log(`[Staging] Synced ${syncedCount} holdings for user ${userId}`);

    res.json({
      success: true,
      syncedCount,
      totalValue: session.totalValue,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: any) {
    console.error('[Staging] Error syncing holdings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/portfolio/staging
 * Clear staging session
 */
router.delete('/', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    stagingSessions.delete(userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Staging] Error clearing session:', error);
    res.status(500).json({ error: error.message });
  }
});

function validateHolding(holding: any): string[] {
  const errors: string[] = [];

  if (!holding.name && !holding.assetName && !holding.schemeName) {
    errors.push('Missing holding name');
  }

  const qty = holding.units || holding.quantity;
  if (!qty || qty <= 0) {
    errors.push('Invalid quantity/units');
  }

  if (!holding.assetType) {
    errors.push('Missing asset type');
  }

  return errors;
}

function updateSessionStatus(session: StagingSession) {
  const approved = session.holdings.filter(h => h.status === 'approved' || h.status === 'modified').length;
  const total = session.holdings.filter(h => h.status !== 'rejected').length;

  if (approved === 0) {
    session.status = 'pending_review';
  } else if (approved === total) {
    session.status = 'fully_approved';
  } else {
    session.status = 'partially_approved';
  }
}

export default router;
