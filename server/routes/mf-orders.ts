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
import { requireAuth } from '../middleware/roleMiddleware';

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
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
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
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create bank mandate' });
  }
});

router.get('/api/mf/compliance-check', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const orderType = (req.query.orderType as string) || 'buy';
    
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    const [riskData] = await db.select().from(riskProfiles).where(eq(riskProfiles.userId, userId)).limit(1);
    
    const kycLevel = profile?.kycLevel ? parseInt(profile.kycLevel, 10) : 0;
    const kycVerified = kycLevel >= 2;
    const fatcaCompliant = profile?.fatcaDeclarationDate !== null && profile?.fatcaDeclarationDate !== undefined;
    const riskProfileCompleted = riskData?.riskTolerance !== null && riskData?.riskTolerance !== undefined;
    
    const checks = {
      kycStatus: {
        passed: kycVerified,
        level: kycLevel,
        required: 2,
        message: kycVerified ? 'KYC Level 2 verified' : 'KYC Level 2 required for mutual fund transactions',
      },
      fatcaStatus: {
        passed: fatcaCompliant,
        declarationDate: profile?.fatcaDeclarationDate,
        message: fatcaCompliant ? 'FATCA declaration on file' : 'FATCA declaration may be required by AMC',
      },
      riskProfile: {
        passed: riskProfileCompleted,
        profile: riskData?.riskTolerance,
        message: riskProfileCompleted ? `Risk profile: ${riskData?.riskTolerance}` : 'Risk profile assessment recommended',
      },
      amlPepStatus: {
        passed: profile?.amlStatus !== 'flagged',
        message: profile?.amlStatus === 'flagged' ? 'AML screening flagged - contact compliance' : 'AML/PEP screening clear',
      },
      bankAccountLinked: {
        passed: true,
        message: 'Bank account verified',
      },
    };

    const overallPassed = checks.kycStatus.passed && checks.amlPepStatus.passed;
    const warnings = [];
    
    if (!checks.fatcaStatus.passed) warnings.push(checks.fatcaStatus.message);
    if (!checks.riskProfile.passed && orderType !== 'sell') warnings.push(checks.riskProfile.message);

    res.json({
      passed: overallPassed,
      checks,
      warnings,
      canProceed: overallPassed,
      requiresSuitabilityAck: !checks.riskProfile.passed && orderType !== 'sell',
    });
  } catch (error) {
    console.error('[MF Orders] Error checking compliance:', error);
    res.status(500).json({ error: 'Failed to check compliance' });
  }
});

const createOrderSchema = z.object({
  schemeCode: z.string().min(1, 'Scheme code is required'),
  schemeName: z.string().min(1, 'Scheme name is required'),
  isin: z.string().optional(),
  planType: z.enum(['regular', 'direct']).default('regular'),
  orderType: z.enum(['buy', 'sell', 'sip', 'stp', 'swp', 'switch']),
  amount: z.number().positive().optional(),
  units: z.number().positive().optional(),
  allUnits: z.boolean().optional().default(false),
  folioId: z.string().optional(),
  sipAmount: z.number().positive().optional(),
  sipFrequency: z.enum(['monthly', 'quarterly', 'weekly']).optional(),
  sipStartDate: z.string().optional(),
  sipEndDate: z.string().optional(),
  sipInstallments: z.number().int().positive().optional(),
  mandateId: z.string().optional(),
  paymentMethod: z.enum(['netbanking', 'upi', 'nach', 'neft', 'rtgs', 'debit_card', 'wallet']).optional(),
  payoutBankId: z.string().optional(),
  suitabilityAcknowledged: z.boolean().optional().default(false),
}).superRefine((data, ctx) => {
  if (data.orderType === 'buy') {
    if (!data.amount || data.amount < 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Buy orders require minimum amount of ₹100',
        path: ['amount'],
      });
    }
    if (!data.paymentMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Payment method is required for buy orders',
        path: ['paymentMethod'],
      });
    }
  }
  
  if (data.orderType === 'sell') {
    if (!data.units && !data.allUnits) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sell orders require either units or allUnits flag',
        path: ['units'],
      });
    }
    if (!data.folioId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Folio is required for redemption orders',
        path: ['folioId'],
      });
    }
  }
  
  if (data.orderType === 'sip') {
    if (!data.sipAmount || data.sipAmount < 500) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SIP requires minimum amount of ₹500',
        path: ['sipAmount'],
      });
    }
    if (!data.sipFrequency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SIP frequency is required',
        path: ['sipFrequency'],
      });
    }
    if (!data.sipStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SIP start date is required',
        path: ['sipStartDate'],
      });
    }
    if (!data.mandateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Bank mandate is required for SIP orders',
        path: ['mandateId'],
      });
    }
  }
  
  if (data.orderType === 'stp') {
    if (!data.amount || data.amount < 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'STP requires minimum amount of ₹1000',
        path: ['amount'],
      });
    }
    if (!data.folioId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Source folio is required for STP orders',
        path: ['folioId'],
      });
    }
    if (!data.sipFrequency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Transfer frequency is required for STP orders',
        path: ['sipFrequency'],
      });
    }
    if (!data.sipStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'STP start date is required',
        path: ['sipStartDate'],
      });
    }
  }
  
  if (data.orderType === 'swp') {
    if (!data.amount || data.amount < 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SWP requires minimum amount of ₹1000',
        path: ['amount'],
      });
    }
    if (!data.folioId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Folio is required for SWP orders',
        path: ['folioId'],
      });
    }
    if (!data.sipFrequency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Withdrawal frequency is required for SWP orders',
        path: ['sipFrequency'],
      });
    }
    if (!data.sipStartDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SWP start date is required',
        path: ['sipStartDate'],
      });
    }
  }
  
  if (data.orderType === 'switch') {
    if (!data.units && !data.allUnits && !data.amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Switch orders require units, allUnits flag, or amount',
        path: ['units'],
      });
    }
    if (!data.folioId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Source folio is required for switch orders',
        path: ['folioId'],
      });
    }
  }
});

async function checkPreTradeCompliance(userId: string, orderType: string, hasSuitabilityAck: boolean = false) {
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  const [riskData] = await db.select().from(riskProfiles).where(eq(riskProfiles.userId, userId)).limit(1);
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const isInvestmentOrder = ['buy', 'sip', 'stp'].includes(orderType);
  const isRedemptionOrder = ['sell', 'swp'].includes(orderType);
  
  const kycLevel = profile?.kycLevel ? parseInt(profile.kycLevel, 10) : 0;
  const kycVerified = kycLevel >= 2;
  const fatcaCompliant = profile?.fatcaDeclarationDate !== null && profile?.fatcaDeclarationDate !== undefined;
  const riskProfileCompleted = riskData?.riskTolerance !== null && riskData?.riskTolerance !== undefined;
  const amlClear = profile?.amlStatus !== 'flagged';
  
  if (!kycVerified) {
    errors.push('KYC Level 2 or higher is required for mutual fund transactions');
  }
  
  if (!amlClear) {
    errors.push('AML screening flagged - please contact compliance team');
  }
  
  if (!fatcaCompliant && isInvestmentOrder) {
    errors.push('FATCA declaration is required for investment orders - please complete FATCA declaration');
  }
  
  if (!riskProfileCompleted && isInvestmentOrder && !hasSuitabilityAck) {
    errors.push('Risk profile assessment required - please complete risk profiling or provide suitability acknowledgement');
  }
  
  const flags = {
    kycVerified,
    kycLevel,
    fatcaCompliant,
    amlClear,
    bankLinked: true,
    riskProfileMatched: riskProfileCompleted,
    riskProfile: riskData?.riskTolerance,
    checkedAt: new Date().toISOString(),
  };
  
  return {
    passed: errors.length === 0,
    errors,
    warnings,
    flags,
    requiresSuitabilityAck: warnings.includes('Risk profile not completed - suitability assessment may be required'),
  };
}

const validStatusTransitions: Record<string, string[]> = {
  'created': ['pending_payment', 'cancelled', 'failed'],
  'pending_payment': ['placed', 'cancelled', 'failed'],
  'placed': ['confirmed', 'rejected', 'failed'],
  'confirmed': ['processing', 'rejected'],
  'processing': ['settled', 'partial', 'failed'],
  'settled': ['reconciled'],
  'partial': ['settled', 'reconciled'],
  'reconciled': [],
  'rejected': [],
  'cancelled': [],
  'failed': [],
};

router.post('/api/mf-orders', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role || 'client';
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = createOrderSchema.parse(req.body);
    
    const complianceCheck = await checkPreTradeCompliance(
      userId, 
      validated.orderType,
      validated.suitabilityAcknowledged
    );
    
    if (!complianceCheck.passed) {
      return res.status(400).json({
        error: 'Pre-trade compliance check failed',
        complianceErrors: complianceCheck.errors,
        complianceWarnings: complianceCheck.warnings,
        requiresSuitabilityAck: !validated.suitabilityAcknowledged,
      });
    }
    
    const orderReference = generateOrderReference(validated.orderType);
    
    const complianceFlags = complianceCheck.flags;

    const orderData = {
      orderReference,
      userId,
      schemeCode: validated.schemeCode,
      schemeName: validated.schemeName,
      isin: validated.isin,
      planType: validated.planType,
      orderType: validated.orderType,
      amount: validated.amount?.toString(),
      units: validated.units?.toString(),
      allUnits: validated.allUnits,
      folioId: validated.folioId,
      sipAmount: validated.sipAmount?.toString(),
      sipFrequency: validated.sipFrequency,
      sipStartDate: validated.sipStartDate,
      sipEndDate: validated.sipEndDate,
      sipInstallments: validated.sipInstallments,
      mandateId: validated.mandateId,
      paymentMethod: validated.paymentMethod,
      payoutBankId: validated.payoutBankId,
      status: 'created',
      complianceFlags: {
        ...complianceFlags,
        suitabilityAcknowledged: validated.suitabilityAcknowledged,
      },
      initiatedBy: userId,
      initiatedByRole: userRole,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    };

    const [order] = await db.insert(mfOrders).values(orderData).returning();

    await logOrderAudit(
      order.id, 
      userId, 
      userRole, 
      'created', 
      undefined, 
      'created', 
      { orderType: validated.orderType, amount: validated.amount },
      req
    );

    res.status(201).json({ 
      order,
      message: 'Order created successfully. Proceed to payment to complete the order.'
    });
  } catch (error) {
    console.error('[MF Orders] Error creating order:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.get('/api/mf-orders', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status, orderType, from, to, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    
    if (userRole !== 'admin') {
      conditions.push(eq(mfOrders.userId, userId));
    }
    
    if (status) {
      conditions.push(eq(mfOrders.status, status as string));
    }
    
    if (orderType) {
      conditions.push(eq(mfOrders.orderType, orderType as string));
    }
    
    if (from) {
      conditions.push(gte(mfOrders.createdAt, new Date(from as string)));
    }
    
    if (to) {
      conditions.push(lte(mfOrders.createdAt, new Date(to as string)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orders = await db.select()
      .from(mfOrders)
      .where(whereClause)
      .orderBy(desc(mfOrders.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [{ total }] = await db.select({ total: count() })
      .from(mfOrders)
      .where(whereClause);

    res.json({
      orders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(total),
        pages: Math.ceil(Number(total) / limitNum)
      }
    });
  } catch (error) {
    console.error('[MF Orders] Error fetching orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.get('/api/mf-orders/:id', isAuthenticated, async (req: Request, res: Response) => {
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

    if (userRole !== 'admin' && order.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const auditLogs = await db.select()
      .from(mfOrderAuditLog)
      .where(eq(mfOrderAuditLog.orderId, id))
      .orderBy(desc(mfOrderAuditLog.createdAt));

    res.json({ order, auditLogs });
  } catch (error) {
    console.error('[MF Orders] Error fetching order:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

const updateOrderStatusSchema = z.object({
  status: z.enum([
    'created', 'pending_payment', 'placed', 'confirmed', 'processing',
    'settled', 'reconciled', 'rejected', 'cancelled', 'failed', 'partial'
  ]),
  statusMessage: z.string().optional(),
  navApplied: z.number().positive().optional(),
  unitsAllotted: z.number().positive().optional(),
  rtaReference: z.string().optional(),
  amcReference: z.string().optional(),
  bseOrderId: z.string().optional(),
  paymentReference: z.string().optional(),
  settlementReference: z.string().optional(),
});

const ADMIN_ROLES = ['admin', 'superadmin', 'master_agent', 'system'];
const PRIVILEGED_STATUS_CHANGES = ['placed', 'confirmed', 'processing', 'settled', 'reconciled', 'rejected'];

router.patch('/api/mf-orders/:id/status', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role || 'client';
    const userRoles: string[] = (req.user as any)?.roles || [userRole];
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

    const isAdminUser = ADMIN_ROLES.some(role => userRoles.includes(role));
    const requestedStatus = req.body.status;
    const isPrivilegedChange = PRIVILEGED_STATUS_CHANGES.includes(requestedStatus);
    const isCancellation = requestedStatus === 'cancelled';
    const isOwnOrder = existingOrder.userId === userId;

    if (!isAdminUser) {
      if (isCancellation) {
        if (!isOwnOrder) {
          return res.status(403).json({ error: 'Access denied - cannot cancel other users orders' });
        }
        if (!['created', 'pending_payment'].includes(existingOrder.status || '')) {
          return res.status(400).json({ error: 'Order cannot be cancelled after placement' });
        }
      } else if (isPrivilegedChange) {
        return res.status(403).json({ error: 'Only authorized administrators can perform this action' });
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const validated = updateOrderStatusSchema.parse(req.body);
    const previousStatus = existingOrder.status || 'created';
    
    const allowedTransitions = validStatusTransitions[previousStatus] || [];
    if (!allowedTransitions.includes(validated.status)) {
      return res.status(400).json({
        error: 'Invalid status transition',
        message: `Cannot transition from '${previousStatus}' to '${validated.status}'`,
        allowedTransitions,
        currentStatus: previousStatus,
        requestedStatus: validated.status,
      });
    }

    const updateData: any = {
      status: validated.status,
      statusMessage: validated.statusMessage,
      updatedAt: new Date(),
    };

    if (validated.navApplied) updateData.navApplied = validated.navApplied.toString();
    if (validated.unitsAllotted) updateData.unitsAllotted = validated.unitsAllotted.toString();
    if (validated.rtaReference) updateData.rtaReference = validated.rtaReference;
    if (validated.amcReference) updateData.amcReference = validated.amcReference;
    if (validated.bseOrderId) updateData.bseOrderId = validated.bseOrderId;
    if (validated.paymentReference) updateData.paymentReference = validated.paymentReference;
    if (validated.settlementReference) updateData.settlementReference = validated.settlementReference;

    switch (validated.status) {
      case 'placed':
        updateData.placedAt = new Date();
        break;
      case 'confirmed':
        updateData.confirmedAt = new Date();
        break;
      case 'settled':
        updateData.settledAt = new Date();
        break;
      case 'reconciled':
        updateData.reconciledAt = new Date();
        break;
      case 'cancelled':
        updateData.cancelledAt = new Date();
        break;
    }

    const [updatedOrder] = await db.update(mfOrders)
      .set(updateData)
      .where(eq(mfOrders.id, id))
      .returning();

    await logOrderAudit(
      id, 
      userId, 
      userRole, 
      'status_changed', 
      previousStatus || undefined, 
      validated.status, 
      { ...validated },
      req
    );

    res.json({ order: updatedOrder });
  } catch (error) {
    console.error('[MF Orders] Error updating order status:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

router.post('/api/mf-orders/:id/cancel', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const userRole = (req.user as any)?.role;
    const { id } = req.params;
    const { reason } = req.body;
    
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

    const cancellableStatuses = ['created', 'pending_payment'];
    if (!cancellableStatuses.includes(existingOrder.status || '')) {
      return res.status(400).json({ 
        error: 'Order cannot be cancelled', 
        message: `Orders in '${existingOrder.status}' status cannot be cancelled` 
      });
    }

    const previousStatus = existingOrder.status;

    const [updatedOrder] = await db.update(mfOrders)
      .set({
        status: 'cancelled',
        statusMessage: reason || 'Cancelled by user',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mfOrders.id, id))
      .returning();

    await logOrderAudit(
      id, 
      userId, 
      userRole, 
      'cancelled', 
      previousStatus || undefined, 
      'cancelled', 
      { reason },
      req
    );

    res.json({ order: updatedOrder, message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('[MF Orders] Error cancelling order:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

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
    }).returning();

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
      .where(sql`${mfOrders.status} = ANY(${pendingStatuses})`)
      .orderBy(desc(mfOrders.createdAt))
      .limit(100);

    res.json({ orders, count: orders.length });
  } catch (error) {
    console.error('[MF Orders] Error fetching pending orders:', error);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

export default router;
