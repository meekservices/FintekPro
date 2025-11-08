/**
 * Account Aggregator API Routes
 * 
 * Endpoints for RBI-regulated Account Aggregator framework integration
 * Handles consent management, FI data fetching, and account discovery
 * 
 * Protected routes require user authentication
 * Admin routes require admin/super_admin role
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { accountAggregatorService } from './services/account-aggregator-service';
import { db } from './db';
import { aaConsents, aaDataFetchLogs, aaDiscoveredAccounts } from '../shared/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

// ==================== VALIDATION SCHEMAS ====================

const createConsentSchema = z.object({
  purpose: z.enum(['portfolio_sync', 'loan_application', 'wealth_management', 'tax_filing', 'insurance_planning']),
  fiTypes: z.array(z.string()).min(1).max(16),
  dataRangeFrom: z.string().transform(str => new Date(str)),
  dataRangeTo: z.string().transform(str => new Date(str)),
  consentExpiry: z.string().transform(str => new Date(str)),
  frequency: z.object({
    unit: z.enum(['hour', 'day', 'month', 'year']),
    value: z.number().int().positive()
  }),
  dataLifePeriod: z.object({
    unit: z.enum(['month', 'year']),
    value: z.number().int().positive()
  }).optional(),
  aaProvider: z.enum(['anumati', 'finvu', 'onemoney', 'perfios', 'nadl']).optional()
});

const fetchDataSchema = z.object({
  consentId: z.string().uuid(),
  sessionId: z.string().optional(),
  correlationId: z.string().uuid().optional()
});

const revokeConsentSchema = z.object({
  reason: z.string().optional()
});

const linkAccountSchema = z.object({
  portfolioId: z.string().uuid()
});

// ==================== REGISTRATION FUNCTION ====================

export function registerAARoutes(app: any) {

  // ==================== CONSENT MANAGEMENT ROUTES ====================

  /**
   * POST /api/aa/consent/create
   * Create a new consent request for AA data fetching
   */
  app.post('/api/aa/consent/create', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Please log in.'
      });
    }

    // Validate request body
    const validation = createConsentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      });
    }

    const data = validation.data;

    // Create consent
    const result = await accountAggregatorService.createConsent({
      userId,
      ...data
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.status(201).json(result);

  } catch (error: any) {
    console.error('❌ Consent creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create consent',
      error: error.message
    });
  }
});

/**
 * GET /api/aa/consent/:consentId/status
 * Get status of a specific consent
 */
app.get('/api/aa/consent/:consentId/status', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { consentId } = req.params;

    // Verify user owns this consent
    const [consent] = await db
      .select()
      .from(aaConsents)
      .where(and(
        eq(aaConsents.consentId, consentId),
        eq(aaConsents.userId, userId)
      ))
      .limit(1);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consent not found'
      });
    }

    // Get status
    const status = await accountAggregatorService.getConsentStatus(consentId);

    if (!status) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch consent status'
      });
    }

    return res.json({
      success: true,
      data: status
    });

  } catch (error: any) {
    console.error('❌ Consent status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch consent status',
      error: error.message
    });
  }
});

/**
 * POST /api/aa/consent/:consentId/approve
 * Approve a pending consent
 */
app.post('/api/aa/consent/:consentId/approve', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { consentId } = req.params;

    // Verify user owns this consent
    const [consent] = await db
      .select()
      .from(aaConsents)
      .where(and(
        eq(aaConsents.consentId, consentId),
        eq(aaConsents.userId, userId)
      ))
      .limit(1);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consent not found'
      });
    }

    // Check if consent is pending
    if (consent.consentStatus !== 'pending' && consent.consentStatus !== 'requested') {
      return res.status(400).json({
        success: false,
        message: `Consent cannot be approved. Current status: ${consent.consentStatus}`
      });
    }

    // Approve consent
    const approved = await accountAggregatorService.approveConsent(consentId);
    
    if (!approved) {
      return res.status(500).json({
        success: false,
        message: 'Failed to approve consent'
      });
    }

    // Activate consent for data fetching
    await accountAggregatorService.activateConsent(consentId);

    return res.json({
      success: true,
      message: 'Consent approved and activated successfully'
    });

  } catch (error: any) {
    console.error('❌ Consent approval error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to approve consent',
      error: error.message
    });
  }
});

/**
 * POST /api/aa/consent/:consentId/revoke
 * Revoke an active consent
 */
app.post('/api/aa/consent/:consentId/revoke', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { consentId } = req.params;

    // Validate request body
    const validation = revokeConsentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      });
    }

    const { reason } = validation.data;

    // Verify user owns this consent
    const [consent] = await db
      .select()
      .from(aaConsents)
      .where(and(
        eq(aaConsents.consentId, consentId),
        eq(aaConsents.userId, userId)
      ))
      .limit(1);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consent not found'
      });
    }

    // Revoke consent
    const success = await accountAggregatorService.revokeConsent(
      consentId,
      'user',
      reason
    );

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to revoke consent'
      });
    }

    return res.json({
      success: true,
      message: 'Consent revoked successfully'
    });

  } catch (error: any) {
    console.error('❌ Consent revocation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to revoke consent',
      error: error.message
    });
  }
});

/**
 * POST /api/aa/consent/:consentId/pause
 * Pause an active consent
 */
app.post('/api/aa/consent/:consentId/pause', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { consentId } = req.params;

    // Verify user owns this consent
    const [consent] = await db
      .select()
      .from(aaConsents)
      .where(and(
        eq(aaConsents.consentId, consentId),
        eq(aaConsents.userId, userId)
      ))
      .limit(1);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consent not found'
      });
    }

    // Pause consent
    const success = await accountAggregatorService.pauseConsent(consentId);

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to pause consent'
      });
    }

    return res.json({
      success: true,
      message: 'Consent paused successfully'
    });

  } catch (error: any) {
    console.error('❌ Consent pause error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to pause consent',
      error: error.message
    });
  }
});

/**
 * POST /api/aa/consent/:consentId/resume
 * Resume a paused consent
 */
app.post('/api/aa/consent/:consentId/resume', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { consentId } = req.params;

    // Verify user owns this consent
    const [consent] = await db
      .select()
      .from(aaConsents)
      .where(and(
        eq(aaConsents.consentId, consentId),
        eq(aaConsents.userId, userId)
      ))
      .limit(1);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consent not found'
      });
    }

    // Resume consent
    const success = await accountAggregatorService.resumeConsent(consentId);

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to resume consent'
      });
    }

    return res.json({
      success: true,
      message: 'Consent resumed successfully'
    });

  } catch (error: any) {
    console.error('❌ Consent resume error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resume consent',
      error: error.message
    });
  }
});

/**
 * GET /api/aa/consents
 * Get all consents for logged-in user
 */
app.get('/api/aa/consents', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { status } = req.query;

    let query = db
      .select()
      .from(aaConsents)
      .where(eq(aaConsents.userId, userId))
      .orderBy(desc(aaConsents.requestedAt));

    if (status) {
      query = db
        .select()
        .from(aaConsents)
        .where(and(
          eq(aaConsents.userId, userId),
          eq(aaConsents.consentStatus, status as string)
        ))
        .orderBy(desc(aaConsents.requestedAt));
    }

    const consents = await query;

    return res.json({
      success: true,
      data: consents,
      count: consents.length
    });

  } catch (error: any) {
    console.error('❌ Consents fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch consents',
      error: error.message
    });
  }
});

// ==================== DATA FETCHING ROUTES ====================

/**
 * POST /api/aa/data/fetch
 * Trigger FI data fetch using an active consent
 */
app.post('/api/aa/data/fetch', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Validate request body
    const validation = fetchDataSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      });
    }

    const { consentId, sessionId, correlationId } = validation.data;

    // Verify user owns this consent
    const [consent] = await db
      .select()
      .from(aaConsents)
      .where(and(
        eq(aaConsents.consentId, consentId),
        eq(aaConsents.userId, userId)
      ))
      .limit(1);

    if (!consent) {
      return res.status(404).json({
        success: false,
        message: 'Consent not found'
      });
    }

    // Fetch data
    const result = await accountAggregatorService.fetchFIData({
      consentId,
      userId,
      sessionId,
      correlationId
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.json(result);

  } catch (error: any) {
    console.error('❌ FI data fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch FI data',
      error: error.message
    });
  }
});

/**
 * GET /api/aa/data/fetch/:sessionId/status
 * Get status of a data fetch session
 */
app.get('/api/aa/data/fetch/:sessionId/status', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { sessionId } = req.params;

    // Verify user owns this session
    const [fetchLog] = await db
      .select()
      .from(aaDataFetchLogs)
      .where(and(
        eq(aaDataFetchLogs.sessionId, sessionId),
        eq(aaDataFetchLogs.userId, userId)
      ))
      .limit(1);

    if (!fetchLog) {
      return res.status(404).json({
        success: false,
        message: 'Fetch session not found'
      });
    }

    // Get latest status
    const status = await accountAggregatorService.getFetchStatus(sessionId);

    if (!status) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch session status'
      });
    }

    return res.json({
      success: true,
      data: status
    });

  } catch (error: any) {
    console.error('❌ Fetch status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch session status',
      error: error.message
    });
  }
});

/**
 * GET /api/aa/data/fetch/history
 * Get data fetch history for user
 */
app.get('/api/aa/data/fetch/history', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { limit = 20, offset = 0 } = req.query;

    const fetchLogs = await db
      .select()
      .from(aaDataFetchLogs)
      .where(eq(aaDataFetchLogs.userId, userId))
      .orderBy(desc(aaDataFetchLogs.initiatedAt))
      .limit(Number(limit))
      .offset(Number(offset));

    return res.json({
      success: true,
      data: fetchLogs,
      count: fetchLogs.length
    });

  } catch (error: any) {
    console.error('❌ Fetch history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch history',
      error: error.message
    });
  }
});

// ==================== DISCOVERED ACCOUNTS ROUTES ====================

/**
 * GET /api/aa/discovered-accounts
 * Get all accounts discovered via AA for user
 */
app.get('/api/aa/discovered-accounts', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { fiType, isLinked } = req.query;

    let query = db
      .select()
      .from(aaDiscoveredAccounts)
      .where(eq(aaDiscoveredAccounts.userId, userId))
      .orderBy(desc(aaDiscoveredAccounts.lastDataFetchAt));

    // Apply filters
    const filters = [eq(aaDiscoveredAccounts.userId, userId)];
    if (fiType) {
      filters.push(eq(aaDiscoveredAccounts.fiType, fiType as string));
    }
    if (isLinked !== undefined) {
      filters.push(eq(aaDiscoveredAccounts.isLinked, isLinked === 'true'));
    }

    if (filters.length > 1) {
      query = db
        .select()
        .from(aaDiscoveredAccounts)
        .where(and(...filters))
        .orderBy(desc(aaDiscoveredAccounts.lastDataFetchAt));
    }

    const accounts = await query;

    // Group by FIP
    const grouped = accounts.reduce((acc: any, account) => {
      const fipId = account.fipId;
      if (!acc[fipId]) {
        acc[fipId] = {
          fipId: account.fipId,
          fipName: account.fipName,
          accounts: []
        };
      }
      acc[fipId].accounts.push(account);
      return acc;
    }, {});

    return res.json({
      success: true,
      data: {
        accounts,
        grouped: Object.values(grouped),
        totalAccounts: accounts.length,
        linkedAccounts: accounts.filter(a => a.isLinked).length
      }
    });

  } catch (error: any) {
    console.error('❌ Discovered accounts fetch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch discovered accounts',
      error: error.message
    });
  }
});

/**
 * POST /api/aa/discovered-accounts/:accountId/link
 * Link a discovered account to user's portfolio
 */
app.post('/api/aa/discovered-accounts/:accountId/link', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { accountId } = req.params;

    // Validate request body
    const validation = linkAccountSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      });
    }

    const { portfolioId } = validation.data;

    // Verify user owns this account
    const [account] = await db
      .select()
      .from(aaDiscoveredAccounts)
      .where(and(
        eq(aaDiscoveredAccounts.id, accountId),
        eq(aaDiscoveredAccounts.userId, userId)
      ))
      .limit(1);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Link account to portfolio
    await db
      .update(aaDiscoveredAccounts)
      .set({
        isLinked: true,
        linkedToPortfolioId: portfolioId,
        linkedAt: new Date(),
        accountStatus: 'linked'
      })
      .where(eq(aaDiscoveredAccounts.id, accountId));

    return res.json({
      success: true,
      message: 'Account linked to portfolio successfully'
    });

  } catch (error: any) {
    console.error('❌ Account linking error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to link account',
      error: error.message
    });
  }
});

/**
 * POST /api/aa/discovered-accounts/:accountId/unlink
 * Unlink a discovered account from portfolio
 */
app.post('/api/aa/discovered-accounts/:accountId/unlink', async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { accountId } = req.params;

    // Verify user owns this account
    const [account] = await db
      .select()
      .from(aaDiscoveredAccounts)
      .where(and(
        eq(aaDiscoveredAccounts.id, accountId),
        eq(aaDiscoveredAccounts.userId, userId)
      ))
      .limit(1);

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      });
    }

    // Unlink account
    await db
      .update(aaDiscoveredAccounts)
      .set({
        isLinked: false,
        linkedToPortfolioId: null,
        linkedAt: null,
        accountStatus: 'discovered'
      })
      .where(eq(aaDiscoveredAccounts.id, accountId));

    return res.json({
      success: true,
      message: 'Account unlinked from portfolio successfully'
    });

  } catch (error: any) {
    console.error('❌ Account unlinking error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unlink account',
      error: error.message
    });
  }
});

// ==================== WEBHOOK HANDLER ====================

/**
 * POST /api/aa/webhook
 * Handle webhooks from AA provider
 */
app.post('/api/aa/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    console.log('🪝 Received AA webhook:', payload.event);

    // Process webhook
    const success = await accountAggregatorService.handleWebhook(payload);

    if (!success) {
      return res.status(500).json({
        success: false,
        message: 'Webhook processing failed'
      });
    }

    return res.json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error: any) {
    console.error('❌ Webhook processing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
});

  console.log('✅ AA routes registered');
}
