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
import { eq, desc, and, gte, lte, like, or, sql, count, isNull, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { requireAuth, requireRole } from '../middleware/roleMiddleware';
import { orderAuditHook } from '../services/order-audit-hook';
import { mfBatchCredentialValidator } from '../services/mf-batch-credential-validator';
import { realizedGainsAggregationService } from '../services/realized-gains-aggregation-service';

const isAuthenticated = requireAuth;

const router = Router();
const ADMIN_ROLES = ['admin', 'superadmin', 'compliance_officer'];

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

router.post('/api/mf-orders/:id/suitability-ack', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { id } = req.params;
    const { clientRiskProfile, schemeRiskLevel, acknowledgementText, signatureType } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [existingOrder] = await db.select()
      .from(mfOrders)
      .where(eq(mfOrders.id, id))
      .limit(1);

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (existingOrder.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [ack] = await db.insert(suitabilityAcknowledgements).values({
      orderId: id,
      userId,
      clientRiskProfile,
      schemeRiskLevel,
      riskMismatch: true,
      acknowledgementText: acknowledgementText || 'I understand that this investment may not be suitable for my risk profile and I wish to proceed.',
      signatureType: signatureType || 'checkbox',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    } as any).returning();

    await db.update(mfOrders)
      .set({
        suitabilityAckProvided: true,
        updatedAt: new Date(),
      })
      .where(eq(mfOrders.id, id));

    await logOrderAudit(
      id, 
      userId, 
      'client', 
      'suitability_acknowledged', 
      undefined, 
      undefined, 
      { clientRiskProfile, schemeRiskLevel },
      req
    );

    res.status(201).json({ acknowledgement: ack });
  } catch (error) {
    console.error('[MF Orders] Error creating suitability acknowledgement:', error);
    res.status(500).json({ error: 'Failed to create suitability acknowledgement' });
  }
});

router.get('/api/mf-orders/:id/audit-log', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [existingOrder] = await db.select()
      .from(mfOrders)
      .where(eq(mfOrders.id, id))
      .limit(1);

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (userRole !== 'admin' && existingOrder.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const logs = await db.select()
      .from(mfOrderAuditLog)
      .where(eq(mfOrderAuditLog.orderId, id))
      .orderBy(desc(mfOrderAuditLog.createdAt));

    res.json({ logs });
  } catch (error) {
    console.error('[MF Orders] Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

router.get('/api/admin/mf-orders', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userRole = (req.user as any)?.role;
    
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (status) {
      conditions.push(eq(mfOrders.status, status as string));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orders = await db.select({
      order: mfOrders,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      }
    })
      .from(mfOrders)
      .leftJoin(users, eq(mfOrders.userId, users.id))
      .where(whereClause)
      .orderBy(desc(mfOrders.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [{ total }] = await db.select({ total: count() })
      .from(mfOrders)
      .where(whereClause);

    const statusCounts = await db.select({
      status: mfOrders.status,
      count: count(),
    })
      .from(mfOrders)
      .groupBy(mfOrders.status);

    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(total),
        pages: Math.ceil(Number(total) / limitNum)
      },
      statusCounts: statusCounts.reduce((acc, { status, count }) => {
        acc[status || 'unknown'] = Number(count);
        return acc;
      }, {} as Record<string, number>)
    });
  } catch (error) {
    console.error('[MF Orders] Error fetching admin orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/api/admin/mf-orders/pending', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userRole = (req.user as any)?.role;
    
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const pendingStatuses = ['created', 'pending_payment', 'placed', 'processing'];

    const orders = await db.select({
      order: mfOrders,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      }
    })
      .from(mfOrders)
      .leftJoin(users, eq(mfOrders.userId, users.id))
      .where(inArray(mfOrders.status, pendingStatuses))
      .orderBy(desc(mfOrders.createdAt))
      .limit(100);

    res.json({ orders, count: orders.length });
  } catch (error) {
    console.error('[MF Orders] Error fetching pending orders:', error);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

router.get('/api/mf-orders/:id/contract-note', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [order] = await db.select({
      order: mfOrders,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      }
    })
      .from(mfOrders)
      .leftJoin(users, eq(mfOrders.userId, users.id))
      .where(eq(mfOrders.id, id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!ADMIN_ROLES.includes(userRole) && order.order.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!['executed', 'partially_executed', 'settled'].includes(order.order.status || '')) {
      return res.status(400).json({ error: 'Contract note available only for executed/settled orders' });
    }

    const contractNoteNumber = `CN/${new Date().getFullYear()}/${(order.order as any).bseOrderNumber || order.order.id.substring(0, 8).toUpperCase()}`;
    
    const contractNote = {
      contractNoteNumber,
      tradeDate: order.order.navApplied || (order.order as any).executedAt || order.order.createdAt,
      settlementDate: order.order.settledAt || null,
      client: {
        name: `${order.user?.firstName || ''} ${order.user?.lastName || ''}`.trim() || 'N/A',
        panNumber: 'XXXXX****X',
        clientCode: userId,
      },
      scheme: {
        name: order.order.schemeName,
        isin: order.order.isin || 'N/A',
        amcCode: (order.order as any).amcCode || 'N/A',
        schemeCode: order.order.schemeCode,
        option: (order.order as any).option || 'growth',
        planType: order.order.planType || 'direct',
      },
      transaction: {
        type: order.order.orderType,
        folioNumber: (order.order as any).folioNumber || 'New Folio',
        amount: order.order.amount,
        units: order.order.units || '0',
        nav: order.order.navApplied || '0',
        stampDuty: order.order.stampDuty || '0',
        stt: (order.order as any).stt || '0',
        exitLoad: (order.order as any).exitLoad || '0',
        netAmount: (order.order as any).netAmount || order.order.amount,
      },
      broker: {
        name: 'FintekPro Financial Services',
        sebiRegNo: 'INZ000000000',
        arnNumber: 'ARN-000000',
        contactEmail: 'support@fintekpro.com',
      },
      disclaimer: 'This contract note is electronically generated and is valid without signature. Please verify all details and report discrepancies within 24 hours.',
      generatedAt: new Date().toISOString(),
    };

    await logOrderAudit(id, userId, userRole || 'client', 'contract_note_viewed', undefined, undefined, { contractNoteNumber }, req);

    res.json({ contractNote });
  } catch (error) {
    console.error('[MF Orders] Error generating contract note:', error);
    res.status(500).json({ error: 'Failed to generate contract note' });
  }
});

router.get('/api/admin/mf-orders/reconciliation', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userRole = (req.user as any)?.role;
    
    if (!ADMIN_ROLES.includes(userRole)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { date, status } = req.query;
    const reconciliationDate = date ? new Date(date as string) : new Date();
    const startOfDay = new Date(reconciliationDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(reconciliationDate);
    endOfDay.setHours(23, 59, 59, 999);

    const conditions = [
      sql`${mfOrders.createdAt} >= ${startOfDay}`,
      sql`${mfOrders.createdAt} <= ${endOfDay}`,
    ];

    if (status) {
      conditions.push(eq(mfOrders.status, status as string));
    }

    const orders = await db.select()
      .from(mfOrders)
      .where(and(...conditions))
      .orderBy(mfOrders.createdAt);

    const summary = {
      date: reconciliationDate.toISOString().split('T')[0],
      totalOrders: orders.length,
      byStatus: {} as Record<string, number>,
      byOrderType: {} as Record<string, number>,
      totalBuyAmount: 0,
      totalSellAmount: 0,
      totalSIPAmount: 0,
      pendingSettlement: 0,
      executedButNotSettled: 0,
      failedOrders: 0,
      discrepancies: [] as Array<{ orderId: string; issue: string; severity: string }>,
    };

    for (const order of orders) {
      summary.byStatus[order.status || 'unknown'] = (summary.byStatus[order.status || 'unknown'] || 0) + 1;
      summary.byOrderType[order.orderType || 'unknown'] = (summary.byOrderType[order.orderType || 'unknown'] || 0) + 1;

      const amount = parseFloat(order.amount || '0');
      if (order.orderType === 'buy' || order.orderType === 'lumpsum') {
        summary.totalBuyAmount += amount;
      } else if (order.orderType === 'sell' || order.orderType === 'redemption') {
        summary.totalSellAmount += amount;
      } else if (order.orderType === 'sip') {
        summary.totalSIPAmount += amount;
      }

      if (order.status === 'executed' && !order.settledAt) {
        summary.executedButNotSettled++;
      }
      if (['pending_payment', 'processing', 'placed'].includes(order.status || '')) {
        summary.pendingSettlement++;
      }
      if (['failed', 'rejected'].includes(order.status || '')) {
        summary.failedOrders++;
      }

      if (order.status === 'executed' && !order.units) {
        summary.discrepancies.push({
          orderId: order.id,
          issue: 'Executed order missing units allocation',
          severity: 'high',
        });
      }
      if (order.status === 'executed' && !order.navApplied) {
        summary.discrepancies.push({
          orderId: order.id,
          issue: 'Executed order missing NAV applied',
          severity: 'high',
        });
      }
      if ((order as any).bseOrderNumber && order.status === 'created') {
        summary.discrepancies.push({
          orderId: order.id,
          issue: 'Order has BSE reference but status still created',
          severity: 'medium',
        });
      }
    };

    res.json({ 
      summary,
      orders: orders.map(o => ({
        id: o.id,
        orderType: o.orderType,
        status: o.status,
        amount: o.amount,
        units: o.units,
        navApplied: o.navApplied,
        bseOrderNumber: (o as any).bseOrderNumber,
        createdAt: o.createdAt,
        executedAt: (o as any).executedAt,
        settledAt: o.settledAt,
      })),
    });
  } catch (error) {
    console.error('[MF Orders] Error generating reconciliation report:', error);
    res.status(500).json({ error: 'Failed to generate reconciliation report' });
  }
});

router.post('/api/admin/mf-orders/:id/mark-settled', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role;
    const { id } = req.params;
    const { settlementReference, unitsAllotted, navApplied, remarks } = req.body;
    
    if (!ADMIN_ROLES.includes(userRole)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const [existingOrder] = await db.select()
      .from(mfOrders)
      .where(eq(mfOrders.id, id))
      .limit(1);

    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!['executed', 'partially_executed'].includes(existingOrder.status || '')) {
      return res.status(400).json({ error: 'Only executed orders can be marked as settled' });
    }

    const [updatedOrder] = await db.update(mfOrders)
      .set({
        status: 'settled',
        settledAt: new Date(),
        settlementReference,
        units: unitsAllotted || existingOrder.units,
        navApplied: navApplied || existingOrder.navApplied,
        adminRemarks: remarks,
        updatedAt: new Date(),
      } as any)
      .where(eq(mfOrders.id, id))
      .returning();

    await logOrderAudit(
      id,
      userId,
      userRole,
      'order_settled',
      'executed',
      'settled',
      { settlementReference, unitsAllotted, navApplied, remarks },
      req
    );

    // Create/update mfHoldings when order is settled
    if (['buy', 'lumpsum', 'sip'].includes(existingOrder.orderType || '')) {
      const finalUnits = parseFloat(unitsAllotted || existingOrder.units || '0');
      const finalNav = parseFloat(navApplied || existingOrder.navApplied || '0');
      const investedValue = parseFloat(existingOrder.amount || '0');
      
      // Check if holding exists for this scheme
      const [existingHolding] = await db.select()
        .from(mfHoldings)
        .where(and(
          eq(mfHoldings.userId, existingOrder.userId),
          eq(mfHoldings.schemeCode, existingOrder.schemeCode || '')
        ))
        .limit(1);
      
      if (existingHolding) {
        // Update existing holding
        const newUnits = parseFloat(existingHolding.units || '0') + finalUnits;
        const newInvested = parseFloat(existingHolding.investedValue || '0') + investedValue;
        const newCurrent = newUnits * finalNav;
        
        await db.update(mfHoldings)
          .set({
            units: String(newUnits),
            investedValue: String(newInvested),
            currentValue: String(newCurrent),
            currentNav: String(finalNav),
            navDate: new Date().toISOString().split('T')[0],
          })
          .where(eq(mfHoldings.id, existingHolding.id));
      } else if (existingOrder.folioId) {
        // Create new holding only if we have a valid folio
        // Derive option type from scheme name (IDCW, Growth, Dividend)
        const schemeName = existingOrder.schemeName?.toLowerCase() || '';
        let derivedOptionType = 'growth';
        if (schemeName.includes('idcw') || schemeName.includes('dividend')) {
          derivedOptionType = 'idcw';
        }
        
        await db.insert(mfHoldings).values({
          userId: existingOrder.userId,
          folioId: existingOrder.folioId,
          schemeCode: existingOrder.schemeCode || '',
          schemeName: existingOrder.schemeName || 'Unknown Fund',
          planType: existingOrder.planType || 'regular',
          optionType: derivedOptionType,
          units: String(finalUnits),
          investedValue: String(investedValue),
          currentValue: String(finalUnits * finalNav),
          currentNav: String(finalNav),
          navDate: new Date().toISOString().split('T')[0],
        });
      }
    } else if (['sell', 'redemption'].includes(existingOrder.orderType || '')) {
      // Reduce units for sell orders
      const unitsToReduce = parseFloat(unitsAllotted || existingOrder.units || '0');
      
      const [existingHolding] = await db.select()
        .from(mfHoldings)
        .where(and(
          eq(mfHoldings.userId, existingOrder.userId),
          eq(mfHoldings.schemeCode, existingOrder.schemeCode || '')
        ))
        .limit(1);
      
      if (existingHolding) {
        const newUnits = Math.max(0, parseFloat(existingHolding.units || '0') - unitsToReduce);
        const finalNav = parseFloat(navApplied || existingOrder.navApplied || existingHolding.currentNav || '0');
        const newCurrent = newUnits * finalNav;
        
        await db.update(mfHoldings)
          .set({
            units: String(newUnits),
            currentValue: String(newCurrent),
            currentNav: String(finalNav),
            navDate: new Date().toISOString().split('T')[0],
          })
          .where(eq(mfHoldings.id, existingHolding.id));
      }
      
      // Calculate and store realized capital gains for sell/redemption orders
      try {
        await realizedGainsAggregationService.calculateAndStoreTradeGains(id);
        await realizedGainsAggregationService.recalculateUserReminders(existingOrder.userId);
        console.log('[MF Orders] Capital gains calculated for sell order', id);
      } catch (gainError) {
        console.error('[MF Orders] Failed to calculate capital gains:', gainError);
        // Non-blocking - order is still settled
      }
    }

    res.json({ order: updatedOrder, message: 'Order marked as settled successfully' });
  } catch (error) {
    console.error('[MF Orders] Error marking order as settled:', error);
    res.status(500).json({ error: 'Failed to mark order as settled' });
  }
});

router.get('/api/mf-orders/:id/settlement-status', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role;
    const { id } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [order] = await db.select()
      .from(mfOrders)
      .where(eq(mfOrders.id, id))
      .limit(1);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!ADMIN_ROLES.includes(userRole) && order.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let expectedSettlementDate: Date | null = null;
    if (order.navApplied) {
      expectedSettlementDate = new Date(order.navApplied);
      if (['buy', 'lumpsum', 'sip'].includes(order.orderType || '')) {
        expectedSettlementDate.setDate(expectedSettlementDate.getDate() + 2);
      } else if (['sell', 'redemption', 'swp', 'switch'].includes(order.orderType || '')) {
        if (order.schemeName?.toLowerCase().includes('liquid') || order.schemeName?.toLowerCase().includes('overnight')) {
          expectedSettlementDate.setDate(expectedSettlementDate.getDate() + 1);
        } else {
          expectedSettlementDate.setDate(expectedSettlementDate.getDate() + 3);
        }
      }
    }

    const settlementTimeline = [
      { 
        stage: 'Order Placed',
        status: 'completed',
        date: order.createdAt,
        description: 'Order successfully submitted to exchange',
      },
      { 
        stage: 'Payment Received',
        status: order.paymentStatus === 'success' ? 'completed' : order.paymentStatus === 'pending' ? 'in_progress' : 'pending',
        date: order.paymentCompletedAt || null,
        description: 'Payment confirmation from gateway',
      },
      { 
        stage: 'Order Executed',
        status: (order as any).executedAt ? 'completed' : ['processing', 'placed'].includes(order.status || '') ? 'in_progress' : 'pending',
        date: (order as any).executedAt || null,
        description: 'Units allotted at applicable NAV',
      },
      { 
        stage: 'Settlement Complete',
        status: order.settledAt ? 'completed' : order.status === 'executed' ? 'in_progress' : 'pending',
        date: order.settledAt || null,
        description: 'Final settlement and folio update',
      },
    ];

    res.json({
      orderId: order.id,
      currentStatus: order.status,
      settlementTimeline,
      expectedSettlementDate,
      actualSettlementDate: order.settledAt,
      isDelayed: expectedSettlementDate && !order.settledAt && new Date() > expectedSettlementDate,
      settlementReference: order.settlementReference,
      unitsAllotted: order.units,
      navApplied: order.navApplied,
    });
  } catch (error) {
    console.error('[MF Orders] Error fetching settlement status:', error);
    res.status(500).json({ error: 'Failed to fetch settlement status' });
  }
});

// ============ ARN/EUIN BATCH CREDENTIAL VALIDATION ============
// SEBI (Mutual Funds) Regulations Compliance: Validate distributor credentials before batch submission

const batchValidationSchema = z.object({
  batchId: z.string(),
  arnCode: z.string(),
  euinCode: z.string().optional(),
  transactionCount: z.number().int().positive(),
  totalAmount: z.number().positive()
});

router.post('/api/mf/batch/validate-credentials', requireRole(['agent', 'admin', 'compliance_officer']), async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const data = batchValidationSchema.parse(req.body);
    
    const result = await mfBatchCredentialValidator.validateBatchCredentials({
      batchId: data.batchId,
      agentId: user.id,
      arnCode: data.arnCode,
      euinCode: data.euinCode,
      transactionCount: data.transactionCount,
      totalAmount: data.totalAmount,
      productType: 'mutual_fund'
    });
    
    res.json({
      success: result.canProceed,
      validation: result,
      message: result.canProceed 
        ? 'Credentials validated successfully. Batch can proceed.'
        : 'Credential validation failed. Please review errors.'
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid batch data', details: error.issues });
    }
    console.error('[MF Orders] Batch credential validation error:', error);
    res.status(500).json({ error: 'Failed to validate batch credentials' });
  }
});

router.get('/api/mf/batch/preflight/:agentId', requireRole(['agent', 'admin', 'compliance_officer']), async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const user = req.user as any;
    
    if (user.role !== 'admin' && user.role !== 'compliance_officer' && user.id !== agentId) {
      return res.status(403).json({ error: 'Cannot check credentials for other agents' });
    }
    
    const preflightResult = await mfBatchCredentialValidator.preflightCheck(agentId);
    
    res.json(preflightResult);
  } catch (error: any) {
    console.error('[MF Orders] Preflight check error:', error);
    res.status(500).json({ error: 'Failed to perform preflight check' });
  }
});

router.get('/api/admin/mf/batch/validation-status', requireRole(['admin', 'compliance_officer']), async (req: Request, res: Response) => {
  try {
    const status = mfBatchCredentialValidator.getValidationStatus();
    
    res.json(status);
  } catch (error: any) {
    console.error('[MF Orders] Validation status error:', error);
    res.status(500).json({ error: 'Failed to get validation status' });
  }
});

router.post('/api/admin/mf/batch/clear-cache', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    mfBatchCredentialValidator.clearCache();
    
    res.json({ success: true, message: 'Validation cache cleared' });
  } catch (error: any) {
    console.error('[MF Orders] Clear cache error:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});


export default router;
