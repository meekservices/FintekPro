import { Router, Request, Response } from 'express';
import { fixedIncomeStatusEngine } from '../services/fixed-income-status-engine';
import { runDailyFixedIncomeRefresh } from '../cron/fixed-income-daily-refresh';
import { apiResponse } from '../utils/responses';
import { requireAuth, requireRole } from '../middleware/roleMiddleware';
import { db } from '../db';
import { corporateBonds, fixedIncomeStatusLog } from '@shared/schema';
import { eq, sql, and, desc } from 'drizzle-orm';

const router = Router();

router.get('/advisor/search', requireAuth, async (req: Request, res: Response) => {
  try {
    const { 
      bondType,
      minYield,
      maxYield,
      creditRating,
      limit = '50',
      offset = '0'
    } = req.query;

    let query = db.select().from(corporateBonds)
      .where(
        and(
          eq(corporateBonds.tradingStatus, 'active'),
          eq(corporateBonds.instrumentStatus, 'SELLABLE')
        )
      );

    const bonds = await query
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string))
      .orderBy(desc(corporateBonds.yieldToMaturity));

    const total = await db.select({ count: sql`count(*)` })
      .from(corporateBonds)
      .where(
        and(
          eq(corporateBonds.tradingStatus, 'active'),
          eq(corporateBonds.instrumentStatus, 'SELLABLE')
        )
      );

    return apiResponse.success(res, {
      bonds: bonds.map(b => ({
        ...b,
        canRecommend: true,
        canTransact: true
      })),
      total: parseInt(total[0]?.count as string || '0'),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error: any) {
    console.error('Error in advisor bond search:', error);
    return apiResponse.serverError(res, 'Failed to search bonds');
  }
});

router.get('/holdings', requireAuth, async (req: Request, res: Response) => {
  try {
    const { limit = '100', offset = '0' } = req.query;

    const bonds = await db.select().from(corporateBonds)
      .where(
        and(
          eq(corporateBonds.tradingStatus, 'active'),
          sql`${corporateBonds.instrumentStatus} IN ('SELLABLE', 'VISIBLE')`
        )
      )
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    return apiResponse.success(res, {
      bonds: bonds.map(b => ({
        ...b,
        canRecommend: b.instrumentStatus === 'SELLABLE',
        canTransact: b.instrumentStatus === 'SELLABLE',
        viewOnly: b.instrumentStatus === 'VISIBLE',
        warningBanner: b.instrumentStatus === 'VISIBLE' 
          ? 'This instrument is shown for reference only and cannot be recommended or transacted.'
          : null
      })),
      total: bonds.length
    });
  } catch (error: any) {
    console.error('Error fetching holdings:', error);
    return apiResponse.serverError(res, 'Failed to fetch holdings');
  }
});

router.get('/status/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const summary = await fixedIncomeStatusEngine.getStatusSummary();
    return apiResponse.success(res, summary);
  } catch (error: any) {
    console.error('Error fetching status summary:', error);
    return apiResponse.serverError(res, 'Failed to fetch status summary');
  }
});

router.get('/status/:isin', requireAuth, async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;

    const [bond] = await db.select().from(corporateBonds)
      .where(eq(corporateBonds.isin, isin));

    if (!bond) {
      return apiResponse.notFound(res, 'Bond not found');
    }

    const history = await fixedIncomeStatusEngine.getStatusTransitionHistory(isin);

    return apiResponse.success(res, {
      isin: bond.isin,
      bondName: bond.bondName,
      currentStatus: bond.instrumentStatus,
      statusReason: bond.statusReason,
      statusLastUpdated: bond.statusLastUpdated,
      isListed: bond.isListed,
      liquidityScore: bond.liquidityScore,
      creditRating: bond.creditRating,
      history
    });
  } catch (error: any) {
    console.error('Error fetching bond status:', error);
    return apiResponse.serverError(res, 'Failed to fetch bond status');
  }
});

router.post('/status/:isin/evaluate', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;

    const evaluation = await fixedIncomeStatusEngine.evaluateInstrumentStatus(isin);

    if (!evaluation) {
      return apiResponse.notFound(res, 'Bond not found');
    }

    await fixedIncomeStatusEngine.updateInstrumentStatus(isin, evaluation, 'manual');

    return apiResponse.success(res, {
      message: evaluation.changed ? 'Status updated' : 'No status change needed',
      evaluation
    });
  } catch (error: any) {
    console.error('Error evaluating bond status:', error);
    return apiResponse.serverError(res, 'Failed to evaluate bond status');
  }
});

router.post('/status/refresh-all', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const result = await runDailyFixedIncomeRefresh();

    return apiResponse.success(res, result);
  } catch (error: any) {
    console.error('Error running status refresh:', error);
    return apiResponse.serverError(res, 'Failed to run status refresh');
  }
});

router.get('/status/log', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { limit = '100', offset = '0' } = req.query;

    const logs = await db.select().from(fixedIncomeStatusLog)
      .orderBy(desc(fixedIncomeStatusLog.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    return apiResponse.success(res, { logs });
  } catch (error: any) {
    console.error('Error fetching status logs:', error);
    return apiResponse.serverError(res, 'Failed to fetch status logs');
  }
});

export default router;

// Admin routes for bond universe seeding
import { seedBondUniverse, getBondUniverseStats } from '../services/bond-universe-seeder';

router.post('/admin/seed-universe', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { count = 8000 } = req.body;
    const result = await seedBondUniverse(Math.min(count, 12000));
    return apiResponse.success(res, result);
  } catch (error: any) {
    console.error('Error seeding bond universe:', error);
    return apiResponse.serverError(res, 'Failed to seed bond universe');
  }
});

router.get('/admin/universe-stats', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const stats = await getBondUniverseStats();
    return apiResponse.success(res, stats);
  } catch (error: any) {
    console.error('Error fetching universe stats:', error);
    return apiResponse.serverError(res, 'Failed to fetch universe stats');
  }
});

router.get('/admin/audit-logs', requireAuth, requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const logs = await db.select().from(fixedIncomeStatusLog).orderBy(desc(fixedIncomeStatusLog.createdAt)).limit(100);
    const formattedLogs = logs.map(log => ({
      id: log.id.toString(),
      userId: log.userId || 'system',
      eventType: log.eventType || 'status_change',
      entityType: 'fixed_income',
      entityId: log.isin || 'N/A',
      eventDetails: {
        status: log.status,
        field: log.field,
        details: log.details
      },
      createdAt: log.createdAt?.toISOString() || new Date().toISOString()
    }));
    return apiResponse.success(res, formattedLogs);
  } catch (error: any) {
    console.error('Error fetching fixed income audit logs:', error);
    return apiResponse.serverError(res, 'Failed to fetch audit logs');
  }
});
