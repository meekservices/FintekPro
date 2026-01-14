/**
 * MCA Intelligence Routes
 * API endpoints for MCA-related queries, filing ingestion, and analytics
 * 
 * RBAC:
 * - Admin: Full access
 * - Compliance: Read + Query
 * - Advisor: Read-only insights
 * - Ops: Read + Filing ingestion
 */

import { Router, Request, Response } from 'express';
import { mcaIntelligenceService, McaRole, McaQueryType } from '../services/mca-intelligence-service';
import { cashfreeService } from '../cashfree-service';
import { getZohoBooksService } from '../zoho/services/books';
import { z } from 'zod';

const router = Router();

// Debug middleware to log ALL requests to MCA routes
router.use((req: Request, res: Response, next: Function) => {
  console.log(`[MCA Router] ${req.method} ${req.path} - Full URL: ${req.originalUrl}`);
  next();
});

// MCA Role middleware
function getMcaRole(req: Request): McaRole {
  const user = (req as any).user;
  if (!user) return 'advisor'; // Default to lowest access
  
  // Map user role to MCA role - check both single role and roles array
  const role = user.role?.toLowerCase();
  const roles = user.roles || [];
  const rolesLower = roles.map((r: string) => r?.toLowerCase());
  
  // Check if user is admin
  if (role === 'admin' || role === 'superadmin' || 
      rolesLower.includes('admin') || rolesLower.includes('superadmin')) {
    return 'admin';
  }
  if (role === 'compliance' || rolesLower.includes('compliance')) return 'compliance';
  if (role === 'ops' || role === 'operations' || 
      rolesLower.includes('ops') || rolesLower.includes('operations')) return 'ops';
  return 'advisor';
}

// Check access middleware
function requireMcaAccess(action: 'read' | 'query' | 'ingest' | 'full') {
  return (req: Request, res: Response, next: Function) => {
    const role = getMcaRole(req);
    const user = (req as any).user;
    console.log(`[MCA Access] Checking ${action} access - Role: ${role}, User: ${user?.email}, UserRole: ${user?.role}, UserRoles: ${JSON.stringify(user?.roles)}`);
    
    if (!mcaIntelligenceService.hasAccess(role, action)) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(403).json({
        success: false,
        error: `Access denied. Role '${role}' cannot perform '${action}' action.`,
      });
    }
    next();
  };
}

// Query validation schema
const querySchema = z.object({
  queryType: z.enum([
    'company_lookup',
    'financial_availability',
    'last_filed_aoc4',
    'profit_check',
    'filing_status',
    'wallet_check',
    'profitable_filter',
    'director_search',
    'charges_analysis',
  ]),
  cin: z.string().length(21).optional().or(z.literal('')), // Allow empty string
  din: z.string().optional(),
  directorName: z.string().optional(),
  threshold: z.number().optional(),
  patMin: z.number().optional(),
  state: z.string().optional(),
  industry: z.string().optional(),
  limit: z.number().optional(),
}).transform(data => ({
  ...data,
  cin: data.cin === '' ? undefined : data.cin, // Convert empty string to undefined
}));

/**
 * POST /api/mca/query
 * Handle MCA query console requests
 */
router.post('/query', requireMcaAccess('query'), async (req: Request, res: Response) => {
  try {
    const parsed = querySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parsed.error.errors,
      });
    }

    const { queryType, ...params } = parsed.data;
    const user = (req as any).user;
    
    const result = await mcaIntelligenceService.handleQuery(
      queryType as McaQueryType,
      params,
      {
        id: user?.id,
        name: user?.name || user?.email,
        role: getMcaRole(req),
      }
    );

    res.json(result);
  } catch (error: any) {
    console.error('[MCA Routes] Query error:', error);
    const isDbError = error.message?.includes('connection') || error.message?.includes('database') || error.code === 'ECONNREFUSED';
    const isApiError = error.message?.includes('API') || error.message?.includes('fetch') || error.message?.includes('timeout');
    
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      errorType: isDbError ? 'database' : isApiError ? 'external_api' : 'internal',
      timestamp: new Date().toISOString(),
    });
  }
});

// Ingest validation schema
const ingestSchema = z.object({
  cin: z.string().length(21),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-YY'),
  xbrlContent: z.string().min(100),
});

/**
 * POST /api/mca/ingest
 * Ingest XBRL filing and extract financial data
 */
router.post('/ingest', requireMcaAccess('ingest'), async (req: Request, res: Response) => {
  try {
    const parsed = ingestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ingestion parameters',
        details: parsed.error.errors,
      });
    }

    const user = (req as any).user;
    const result = await mcaIntelligenceService.ingestXBRLFiling({
      cin: parsed.data.cin,
      financialYear: parsed.data.financialYear,
      xbrlContent: parsed.data.xbrlContent,
      uploadedBy: user?.id || user?.email || 'system',
      uploadedByRole: getMcaRole(req),
    });

    res.json(result);
  } catch (error: any) {
    console.error('[MCA Routes] Ingest error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Profitable companies filter schema with strict validation
const profitableSchema = z.object({
  pat_min: z.coerce.number().min(0).optional().default(10000000),
  pat_max: z.coerce.number().min(0).optional(),
  state: z.string().max(100).optional(),
  industry: z.string().max(200).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50), // Strict cap at 100
  offset: z.coerce.number().min(0).max(10000).optional().default(0), // Strict cap at 10000
  sort_by: z.enum(['pat', 'revenue', 'patMargin', 'roe']).optional().default('pat'),
});

/**
 * GET /api/mca/profitable-companies
 * Get companies with PAT above threshold
 */
router.get('/profitable-companies', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const parsed = profitableSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filter parameters',
        details: parsed.error.errors,
      });
    }

    const user = (req as any).user;
    
    // Log the query for audit
    await mcaIntelligenceService.logQuery({
      userId: user?.id,
      userName: user?.name || user?.email,
      userRole: getMcaRole(req),
      queryType: 'profitable_filter',
      queryParameters: parsed.data,
      actionTaken: 'Profitable companies filter',
      success: true,
    });

    // Get results directly from the service method (now includes computed ratios)
    const companies = await mcaIntelligenceService.getProfitableCompanies({
      patMin: parsed.data.pat_min,
      patMax: parsed.data.pat_max,
      state: parsed.data.state,
      industry: parsed.data.industry,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      sortBy: parsed.data.sort_by,
    });

    res.json({
      success: true,
      result: companies,
      count: companies.length,
      pagination: {
        offset: parsed.data.offset,
        limit: parsed.data.limit,
        hasMore: companies.length === parsed.data.limit,
      },
      filters: {
        patMin: parsed.data.pat_min,
        patMax: parsed.data.pat_max,
        state: parsed.data.state,
        industry: parsed.data.industry,
        sortBy: parsed.data.sort_by,
      },
      attribution: 'Derived from statutory public filings sourced from MCA.',
    });
  } catch (error: any) {
    console.error('[MCA Routes] Profitable companies error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/mca/company/:cin
 * Lookup company by CIN
 */
router.get('/company/:cin', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const { cin } = req.params;
    if (!cin || cin.length !== 21) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CIN format. CIN must be 21 characters.',
      });
    }

    const user = (req as any).user;
    const result = await mcaIntelligenceService.handleQuery(
      'company_lookup',
      { cin },
      {
        id: user?.id,
        name: user?.name || user?.email,
        role: getMcaRole(req),
      }
    );

    res.json(result);
  } catch (error: any) {
    console.error('[MCA Routes] Company lookup error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/mca/company/:cin/financials
 * Get computed financial ratios for a company
 * Used by Unlisted Shares pages and portfolio analysis
 */
router.get('/company/:cin/financials', requireMcaAccess('read'), async (req: Request, res: Response) => {
  const { cin } = req.params;
  const user = (req as any).user;
  
  // Validate CIN format
  if (!cin || cin.length !== 21) {
    return res.status(400).json({
      success: false,
      error: 'Invalid CIN format. CIN must be 21 characters.',
      errorType: 'validation_error',
    });
  }

  try {
    // Get computed financial ratios
    const financials = await mcaIntelligenceService.getCompanyFinancialRatios(cin);

    // Log the query for audit (after successful fetch)
    await mcaIntelligenceService.logQuery({
      userId: user?.id,
      userName: user?.name || user?.email,
      userRole: getMcaRole(req),
      queryType: 'financial_availability',
      cin,
      actionTaken: 'Financial ratios lookup for unlisted shares',
      responseSummary: financials.hasData 
        ? `Found data for FY ${financials.latestYear}` 
        : 'No MCA data available',
      success: true,
    });

    // Return with explicit status about data availability
    res.json({
      success: true,
      hasData: financials.hasData,
      data: financials,
    });
  } catch (error: any) {
    console.error('[MCA Routes] Financial ratios error:', { cin, error: error.message });
    
    // Log failed query for audit
    await mcaIntelligenceService.logQuery({
      userId: user?.id,
      userName: user?.name || user?.email,
      userRole: getMcaRole(req),
      queryType: 'financial_availability',
      cin,
      actionTaken: 'Financial ratios lookup for unlisted shares',
      success: false,
      errorMessage: error.message,
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve financial data',
      errorType: 'internal_error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * GET /api/mca/wallet
 * Get MCA wallet status
 */
router.get('/wallet', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const wallet = await mcaIntelligenceService.getWalletStatus();
    res.json({
      success: true,
      data: wallet,
    });
  } catch (error: any) {
    console.error('[MCA Routes] Wallet status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/mca/wallet/recharge/initiate
 * Initiate MCA wallet recharge via Cashfree payment (Admin only)
 */
router.post('/wallet/recharge/initiate', requireMcaAccess('full'), async (req: Request, res: Response) => {
  const user = (req as any).user;
  console.log('[MCA Routes] Recharge initiate request:', { 
    body: req.body, 
    user: user?.email,
    role: getMcaRole(req)
  });
  
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0 || amount > 500000) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recharge amount (must be between ₹1 and ₹5,00,000)',
      });
    }

    // Check if Cashfree is configured
    if (!cashfreeService.hasValidCredentials()) {
      return res.status(503).json({
        success: false,
        error: 'Payment gateway not configured. Please contact support.',
      });
    }

    // Get base URL for callback
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'] || process.env.REPLIT_DEV_DOMAIN;
    const baseUrl = `${protocol}://${host}`;
    const returnUrl = `${baseUrl}/api/mca/wallet/recharge/callback`;

    // Create Cashfree order
    const orderResponse = await cashfreeService.createOrder({
      amount: amount,
      userId: user?.id || 'mca-admin',
      email: user?.email || 'admin@fintekpro.com',
      name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'MCA Admin',
      phone: user?.mobile || '9999999999',
      returnUrl: returnUrl,
    });

    if (!orderResponse.success || !orderResponse.orderId) {
      // Enhanced error message for payment gateway issues
      let errorMessage = orderResponse.message || 'Failed to create payment order';
      let troubleshooting = null;
      
      if (errorMessage.toLowerCase().includes('authentication')) {
        troubleshooting = 'Please verify your Cashfree API credentials in the Secrets panel. For sandbox testing, use sandbox credentials from your Cashfree dashboard.';
        console.error('[MCA Routes] Cashfree authentication failed. Verify CASHFREE_APP_ID and CASHFREE_SECRET_KEY are correct and match the environment (sandbox/production).');
      }
      
      return res.status(500).json({
        success: false,
        error: errorMessage,
        troubleshooting: troubleshooting,
      });
    }

    // Save payment record
    const payment = await mcaIntelligenceService.createWalletPayment({
      orderId: orderResponse.orderId,
      paymentSessionId: orderResponse.paymentSessionId,
      amount: amount,
      initiatedBy: user?.email || 'unknown',
      initiatedByUserId: user?.id,
      paymentUrl: orderResponse.paymentUrl,
      returnUrl: returnUrl,
    });

    console.log('[MCA Routes] Payment order created:', { 
      orderId: orderResponse.orderId, 
      amount,
      paymentUrl: orderResponse.paymentUrl 
    });

    res.json({
      success: true,
      message: 'Payment order created',
      data: {
        orderId: orderResponse.orderId,
        paymentSessionId: orderResponse.paymentSessionId,
        paymentUrl: orderResponse.paymentUrl,
        amount: amount,
      },
    });
  } catch (error: any) {
    console.error('[MCA Routes] Wallet recharge initiate error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/mca/wallet/recharge/callback
 * Cashfree payment callback - verify and credit wallet
 * Uses idempotent credit to prevent race conditions
 */
router.get('/wallet/recharge/callback', async (req: Request, res: Response) => {
  const { order_id } = req.query;
  
  console.log('[MCA Routes] Payment callback received:', { order_id, query: req.query });
  
  try {
    if (!order_id || typeof order_id !== 'string') {
      return res.redirect('/admin/mca-intelligence?payment=error&message=Invalid order');
    }

    // Get payment record
    const payment = await mcaIntelligenceService.getWalletPaymentByOrderId(order_id);
    if (!payment) {
      return res.redirect('/admin/mca-intelligence?payment=error&message=Payment not found');
    }

    // Already processed? (idempotency check)
    if (payment.status === 'success') {
      console.log('[MCA Routes] Payment already credited, skipping:', order_id);
      return res.redirect('/admin/mca-intelligence?payment=success&message=Already credited');
    }

    // Verify with Cashfree
    const orderStatus = await cashfreeService.getOrderStatus(order_id);
    console.log('[MCA Routes] Cashfree order status:', orderStatus);

    if (orderStatus.orderStatus === 'PAID') {
      // Atomically try to mark payment as success (only succeeds if status was 'pending')
      // This prevents race conditions - only one concurrent request can win
      const wasUpdated = await mcaIntelligenceService.markPaymentSuccessIfPending(order_id, {
        transactionId: orderStatus.transactionId,
        paymentMethod: orderStatus.paymentMethod,
      });

      if (wasUpdated) {
        // We successfully transitioned from pending to success, now credit wallet
        const amount = parseFloat(payment.amount);
        await mcaIntelligenceService.updateWalletBalance(amount, 'recharge');
        console.log('[MCA Routes] Wallet credited:', { order_id, amount });

        // Create Zoho expense bill for MCA API credits (operational expense)
        try {
          const zohoService = await getZohoBooksService();
          if (zohoService) {
            const expense = await zohoService.createExpense({
              account_name: 'MCA API Credits',
              amount: amount,
              date: new Date().toISOString().split('T')[0],
              description: `MCA wallet recharge - Order: ${order_id}`,
              reference_number: order_id,
            });
            
            if (expense?.expense_id) {
              await mcaIntelligenceService.updateWalletPaymentStatus(order_id, {
                status: 'success',
                zohoExpenseId: expense.expense_id,
              });
              console.log('[MCA Routes] Zoho expense created:', expense.expense_id);
            }
          }
        } catch (zohoError: any) {
          console.error('[MCA Routes] Zoho expense creation failed:', zohoError.message);
        }

        return res.redirect('/admin/mca-intelligence?payment=success&amount=' + amount);
      } else {
        // Another request already processed this payment
        console.log('[MCA Routes] Payment already credited by concurrent request:', order_id);
        return res.redirect('/admin/mca-intelligence?payment=success&message=Already credited');
      }
    } else if (orderStatus.orderStatus === 'FAILED' || orderStatus.orderStatus === 'CANCELLED') {
      await mcaIntelligenceService.updateWalletPaymentStatus(order_id, {
        status: 'failed',
        failureReason: orderStatus.orderStatus,
      });
      return res.redirect('/admin/mca-intelligence?payment=failed&message=' + orderStatus.orderStatus);
    } else {
      return res.redirect('/admin/mca-intelligence?payment=pending&order_id=' + order_id);
    }
  } catch (error: any) {
    console.error('[MCA Routes] Payment callback error:', error);
    return res.redirect('/admin/mca-intelligence?payment=error&message=' + encodeURIComponent(error.message));
  }
});

/**
 * GET /api/mca/wallet/payments/:orderId
 * Check payment status (read-only, does not credit wallet)
 * Credit only happens via callback endpoint to prevent race conditions
 */
router.get('/wallet/payments/:orderId', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const payment = await mcaIntelligenceService.getWalletPaymentByOrderId(orderId);
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found',
      });
    }

    // If still pending, check with Cashfree (but don't credit here)
    if (payment.status === 'pending') {
      try {
        const orderStatus = await cashfreeService.getOrderStatus(orderId);
        if (orderStatus.orderStatus === 'PAID') {
          // Return the updated status info, but crediting happens via callback
          return res.json({
            success: true,
            data: { 
              ...payment, 
              cashfreeStatus: 'PAID',
              message: 'Payment successful - wallet will be credited shortly'
            },
          });
        } else if (orderStatus.orderStatus === 'FAILED' || orderStatus.orderStatus === 'CANCELLED') {
          // Safe to update failed status
          await mcaIntelligenceService.updateWalletPaymentStatus(orderId, {
            status: 'failed',
            failureReason: orderStatus.orderStatus,
          });
          return res.json({
            success: true,
            data: { ...payment, status: 'failed', failureReason: orderStatus.orderStatus },
          });
        }
      } catch (e) {
        // Ignore Cashfree check errors
      }
    }

    res.json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    console.error('[MCA Routes] Payment status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/mca/wallet/payments
 * Get recent wallet payments
 */
router.get('/wallet/payments', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const payments = await mcaIntelligenceService.getRecentWalletPayments(20);
    res.json({
      success: true,
      data: payments,
    });
  } catch (error: any) {
    console.error('[MCA Routes] Payments list error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/mca/filings/:cin
 * Get filing history for a company
 */
router.get('/filings/:cin', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const { cin } = req.params;
    const filings = await mcaIntelligenceService.getFilingHistory(cin);
    
    res.json({
      success: true,
      data: filings,
    });
  } catch (error: any) {
    console.error('[MCA Routes] Filing history error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/mca/dashboard
 * Get MCA dashboard stats
 */
router.get('/dashboard', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const stats = await mcaIntelligenceService.getDashboardStats();
    
    res.json({
      success: true,
      data: stats,
      attribution: 'Derived from statutory public filings sourced from MCA.',
    });
  } catch (error: any) {
    console.error('[MCA Routes] Dashboard error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/mca/audit-log
 * Get query audit log (Admin/Compliance only)
 */
router.get('/audit-log', requireMcaAccess('query'), async (req: Request, res: Response) => {
  try {
    const { userId, queryType, cin, startDate, endDate, limit } = req.query;
    
    const logs = await mcaIntelligenceService.getQueryHistory({
      userId: userId as string,
      queryType: queryType as string,
      cin: cin as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : 100,
    });

    res.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error('[MCA Routes] Audit log error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/mca/charges/:cin
 * Analyze charges for a company
 */
router.get('/charges/:cin', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const { cin } = req.params;
    const user = (req as any).user;
    
    const result = await mcaIntelligenceService.handleQuery(
      'charges_analysis',
      { cin },
      {
        id: user?.id,
        name: user?.name || user?.email,
        role: getMcaRole(req),
      }
    );

    res.json(result);
  } catch (error: any) {
    console.error('[MCA Routes] Charges analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============ COMPANY PROFILE API (Phase 1.3) ============
import { mcaDataCacheService } from '../services/mca-data-cache-service';

/**
 * GET /api/mca/company/:cin
 * Get complete company profile with caching
 * Aggregates master + directors + charges + financials
 */
router.get('/company/:cin', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const { cin } = req.params;
    const forceRefresh = req.query.refresh === 'true';
    const user = (req as any).user;

    if (!cin || cin.length !== 21) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CIN format. CIN must be exactly 21 characters.',
      });
    }

    console.log(`[MCA Profile] Fetching company profile for ${cin} (forceRefresh: ${forceRefresh})`);

    const result = await mcaDataCacheService.getCompanyWithCache(cin, {
      forceRefresh,
      userId: user?.id,
    });

    if (!result.success || !result.data) {
      return res.status(404).json({
        success: false,
        error: result.error || 'Company not found',
        apiCallMade: result.apiCallMade,
      });
    }

    const { company, directors, charges, financials, fromCache, cacheAge } = result.data;

    res.json({
      success: true,
      data: {
        company: {
          cin: company.cin,
          name: company.companyName,
          status: company.companyStatus,
          category: company.companyCategory,
          subCategory: company.companySubCategory,
          class: company.companyClass,
          incorporationDate: company.incorporationDate,
          registeredAddress: company.registeredAddress,
          registeredState: company.registeredState,
          registeredCity: company.registeredCity,
          email: company.email,
          industry: company.industry,
          authorizedCapital: company.authorizedCapital,
          paidUpCapital: company.paidUpCapital,
          lastAnnualReturn: company.lastAnnualReturn,
          lastBalanceSheet: company.lastBalanceSheet,
          lastFilingYear: company.lastFilingYear,
        },
        directors: directors.map(d => ({
          din: d.din,
          name: d.name,
          designation: d.designation,
          status: d.dinStatus,
          totalAppointments: d.totalAppointments,
          activeAppointments: d.activeAppointments,
        })),
        charges: charges.map(c => ({
          chargeId: c.chargeId,
          holder: c.chargeHolder,
          holderType: c.chargeHolderType,
          amount: c.chargeAmount,
          type: c.chargeType,
          creationDate: c.creationDate,
          satisfactionDate: c.satisfactionDate,
          status: c.status,
        })),
        financials: financials.map(f => ({
          financialYear: f.financialYear,
          revenue: f.revenue,
          profitBeforeTax: f.profitBeforeTax,
          profitAfterTax: f.profitAfterTax,
          netWorth: f.netWorth,
          totalAssets: f.totalAssets,
          totalLiabilities: f.totalLiabilities,
          shareCapital: f.shareCapital,
          reserves: f.reserves,
          longTermBorrowing: f.longTermBorrowing,
          shortTermBorrowing: f.shortTermBorrowing,
          source: f.source,
          isVerified: f.isVerified,
        })),
        summary: {
          totalDirectors: directors.length,
          activeCharges: charges.filter(c => c.status === 'active').length,
          financialYears: financials.length,
        },
      },
      meta: {
        fromCache,
        cacheAgeHours: cacheAge?.toFixed(1),
        apiCallMade: result.apiCallMade,
        dataSource: 'FintekPro MCA Database',
        lastUpdated: company.updatedAt,
      },
      attribution: 'Derived from statutory public filings sourced from MCA via Sandbox.co.in',
    });
  } catch (error: any) {
    console.error('[MCA Profile] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/mca/company/:cin/financials
 * Get financial history API with FY-wise data series
 */
router.get('/company/:cin/financials', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const { cin } = req.params;
    const maxYears = parseInt(req.query.years as string) || 10;

    if (!cin || cin.length !== 21) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CIN format',
      });
    }

    const cachedData = await mcaDataCacheService.getCachedCompany(cin);
    
    if (!cachedData) {
      return res.status(404).json({
        success: false,
        error: 'Company not found in cache. Use /company/:cin to fetch first.',
      });
    }

    const financials = cachedData.financials.slice(0, maxYears);

    res.json({
      success: true,
      data: {
        cin,
        companyName: cachedData.company.companyName,
        financials: financials.map(f => ({
          financialYear: f.financialYear,
          revenue: f.revenue,
          profitBeforeTax: f.profitBeforeTax,
          profitAfterTax: f.profitAfterTax,
          netWorth: f.netWorth,
          totalAssets: f.totalAssets,
          totalLiabilities: f.totalLiabilities,
          shareCapital: f.shareCapital,
          reserves: f.reserves,
          longTermBorrowing: f.longTermBorrowing,
          shortTermBorrowing: f.shortTermBorrowing,
        })),
      },
      meta: {
        totalYears: financials.length,
        dataSource: 'FintekPro MCA Database',
      },
    });
  } catch (error: any) {
    console.error('[MCA Financials] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/mca/search
 * Search companies in local cache
 */
router.get('/search', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    const results = await mcaDataCacheService.searchCachedCompanies(query, limit);

    res.json({
      success: true,
      data: results.map(c => ({
        cin: c.cin,
        name: c.companyName,
        status: c.companyStatus,
        category: c.companyCategory,
        state: c.registeredState,
        authorizedCapital: c.authorizedCapital,
        paidUpCapital: c.paidUpCapital,
        lastUpdated: c.updatedAt,
      })),
      meta: {
        count: results.length,
        query,
      },
    });
  } catch (error: any) {
    console.error('[MCA Search] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/mca/cache-stats
 * Get cache statistics
 */
router.get('/cache-stats', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const stats = await mcaDataCacheService.getCacheStats();

    res.json({
      success: true,
      data: {
        ...stats,
        cacheTtlHours: 24,
      },
    });
  } catch (error: any) {
    console.error('[MCA Cache Stats] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
