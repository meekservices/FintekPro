// @ts-nocheck
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { 
  mfOrders, mfFolios, mfHoldings, bankMandates, 
  mfOrderAuditLog, suitabilityAcknowledgements, mfReconciliationEntries, mfContractNotes,
  insertMfOrderSchema, insertMfFolioSchema, insertMfHoldingSchema, insertBankMandateSchema,
  insertMfOrderAuditLogSchema, insertSuitabilityAcknowledgementSchema,
  users, userProfiles, riskProfiles
} from '@shared/schema';
import { eq, desc, and, gte, lte, like, or, sql, count, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { requireAuth, requireRole } from '../middleware/roleMiddleware';
import { orderAuditHook } from '../services/order-audit-hook';
import { mfBatchCredentialValidator } from '../services/mf-batch-credential-validator';
import { realizedGainsAggregationService } from '../services/realized-gains-aggregation-service';

const isAuthenticated = requireAuth;

const router = Router();

function generateOrderReference(orderType: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid(6).toUpperCase();
  return `FTX-MF-${orderType.toUpperCase().slice(0, 3)}-${timestamp}-${random}`;
}

function logOrderAudit(
  orderId: string, 
  actorId: string | null, 
  actorRole: string, 
  action: string, 
  previousStatus?: string, 
  newStatus?: string, 
  details?: object,
  req?: Request
) {
  return db.insert(mfOrderAuditLog).values({
    orderId,
    actorId,
    actorRole,
    action,
    previousStatus,
    newStatus,
    details: details || {},
    ipAddress: req?.ip || null,
    userAgent: req?.get('user-agent') || null,
  });
}

router.get('/api/mf/folios', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const folios = await db.select()
      .from(mfFolios)
      .where(and(eq(mfFolios.userId, userId), eq(mfFolios.isActive, true)))
      .orderBy(desc(mfFolios.createdAt));

    res.json({ folios });
  } catch (error) {
    console.error('[MF Orders] Error fetching folios:', error);
    res.status(500).json({ error: 'Failed to fetch folios' });
  }
});

router.post('/api/mf/folios', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = insertMfFolioSchema.parse({ ...req.body, userId });
    
    const [folio] = await db.insert(mfFolios).values(validated).returning();
    
    res.status(201).json({ folio });
  } catch (error) {
    console.error('[MF Orders] Error creating folio:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to create folio' });
  }
});

router.get('/api/mf/holdings', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const holdings = await db.select({
      holding: mfHoldings,
      folio: mfFolios,
    })
      .from(mfHoldings)
      .leftJoin(mfFolios, eq(mfHoldings.folioId, mfFolios.id))
      .where(eq(mfHoldings.userId, userId))
      .orderBy(desc(mfHoldings.currentValue));

    const totalInvested = holdings.reduce((sum, h) => sum + parseFloat(h.holding.investedValue || '0'), 0);
    const totalCurrent = holdings.reduce((sum, h) => sum + parseFloat(h.holding.currentValue || '0'), 0);

    res.json({ 
      holdings, 
      summary: {
        totalInvested,
        totalCurrent,
        totalGain: totalCurrent - totalInvested,
        gainPercent: totalInvested > 0 ? ((totalCurrent - totalInvested) / totalInvested) * 100 : 0
      }
    });
  } catch (error) {
    console.error('[MF Orders] Error fetching holdings:', error);
    res.status(500).json({ error: 'Failed to fetch holdings' });
  }
});

router.get('/api/mf/bank-mandates', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const mandates = await db.select()
      .from(bankMandates)
      .where(eq(bankMandates.userId, userId))
      .orderBy(desc(bankMandates.createdAt));

    res.json({ mandates });
  } catch (error) {
    console.error('[MF Orders] Error fetching bank mandates:', error);
    res.status(500).json({ error: 'Failed to fetch bank mandates' });
  }
});

router.post('/api/mf/bank-mandates', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = insertBankMandateSchema.parse({ ...req.body, userId });
    
    const [mandate] = await db.insert(bankMandates).values(validated).returning();
    
    res.status(201).json({ mandate });
  } catch (error) {
    console.error('[MF Orders] Error creating bank mandate:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ error: 'Failed to create bank mandate' });
  }
});


export default router;
