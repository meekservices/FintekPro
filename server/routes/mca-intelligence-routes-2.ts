// @ts-nocheck
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
import { mcaDataCacheService } from '../services/mca-data-cache-service';
import { z } from 'zod';

const router = Router();

// Debug middleware to log ALL requests to MCA routes
router.use((req: Request, res: Response, next: Function) => {
  console.log(`[MCA Router] ${req.method} ${req.path} - Full URL: ${req.originalUrl}`);
  next();
});

// MCA Role middleware
function getMcaRole(req: Request): McaRole {
  // Check for system-level access via X-System-Token header (for internal API calls)
  // Token MUST be set via environment secret for security
  const systemToken = req.headers['x-system-token'];
  const envSystemToken = process.env.MCA_SYSTEM_ACCESS_TOKEN;
  if (systemToken && envSystemToken && systemToken === envSystemToken) {
    console.log(`[MCA Access] System token auth granted from IP: ${req.ip}`);
    return 'admin';
  }
  
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

/**
 * Data masking utility for role-based access control
 * Masks sensitive fields based on user role
 */
interface MaskingConfig {
  role: McaRole;
  includeFinancials?: boolean;
  includeEmail?: boolean;
  includeDirectorDetails?: boolean;
  adminOverride?: boolean;
}

function maskSensitiveData(
  data: any,
  config: MaskingConfig
): any {
  if (!data || typeof data !== 'object') return data;
  
  const { role, adminOverride } = config;
  
  // Admin with override sees everything
  if (role === 'admin' && adminOverride) return data;
  
  const masked = { ...data };
  
  // Email masking for non-admin/compliance roles
  if (role !== 'admin' && role !== 'compliance') {
    if (masked.email && typeof masked.email === 'string') {
      const [localPart, domain] = masked.email.split('@');
      if (localPart && domain) {
        masked.email = `${localPart.substring(0, 2)}***@${domain}`;
      }
    }
  }
  
  // Director DIN partial masking for advisor role
  if (role === 'advisor') {
    if (masked.din && typeof masked.din === 'string' && masked.din.length === 8) {
      masked.din = `${masked.din.substring(0, 2)}****${masked.din.substring(6)}`;
    }
    // Mask detailed financial values, show only summaries
    if (masked.profitAfterTax && typeof masked.profitAfterTax === 'string') {
      const value = Number.parseFloat(masked.profitAfterTax);
      if (!Number.isNaN(value)) {
        // Round to nearest crore for advisor role
        const inCrores = Math.round(value / 10000000);
        masked.profitAfterTax = `~${inCrores} Cr (approx)`;
        masked.isApproximate = true;
      }
    }
    if (masked.revenue && typeof masked.revenue === 'string') {
      const value = Number.parseFloat(masked.revenue);
      if (!Number.isNaN(value)) {
        const inCrores = Math.round(value / 10000000);
        masked.revenue = `~${inCrores} Cr (approx)`;
        masked.isApproximate = true;
      }
    }
  }
  
  // Recursively mask arrays
  for (const key of Object.keys(masked)) {
    if (Array.isArray(masked[key])) {
      masked[key] = masked[key].map((item: any) => 
        typeof item === 'object' ? maskSensitiveData(item, config) : item
      );
    }
  }
  
  return masked;
}

/**
 * Log sensitive data access for compliance
 */
async function logSensitiveAccess(
  req: Request,
  dataType: string,
  cin?: string,
  details?: string
): Promise<void> {
  const user = (req as any).user;
  const role = getMcaRole(req);
  
  // Log to audit trail for compliance tracking
  await (mcaIntelligenceService as any).logQuery({
    userId: user?.id,
    userName: user?.name || user?.email,
    userRole: role,
    queryType: 'sensitive_access',
    cin,
    actionTaken: `Accessed ${dataType}`,
    responseSummary: details,
    success: true, ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    accessedAt: new Date().toISOString(),
  });
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
router.post('/wallet/recharge/initiate', requireMcaAccess('full'), async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  
  // Return deprecation notice - wallet recharge is no longer needed
  res.status(200).json({
    success: true,
    deprecated: true,
    message: 'MCA API billing is now direct pay-per-request via Sandbox.co.in',
    instructions: 'Please add credits directly in your Sandbox.co.in dashboard. Each MCA API request will be billed automatically.',
    sandboxDashboard: 'https://dashboard.sandbox.co.in/billing',
  });
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
    const orderStatus! = await cashfreeService.getOrderStatus(order_id);
    console.log('[MCA Routes] Cashfree order status:', orderStatus!);

    if ((orderStatus! as any)?.orderStatus! === 'PAID') {
      // Atomically try to mark payment as success (only succeeds if status was 'pending')
      // This prevents race conditions - only one concurrent request can win
      const wasUpdated = await mcaIntelligenceService.markPaymentSuccessIfPending(order_id, {
        transactionId: orderStatus!.transactionId,
        paymentMethod: orderStatus!.paymentMethod,
      });

      if (wasUpdated) {
        // We successfully transitioned from pending to success, now credit wallet
        const amount = Number.parseFloat(payment.amount);
        await mcaIntelligenceService.updateWalletBalance(amount, 'recharge');
        console.log('[MCA Routes] Wallet credited:', { order_id, amount });

        // Create Zoho expense bill for MCA API credits (operational expense)
        try {
          const zohoService = await getZohoBooksService();
          if (zohoService) {
            const expense = await zohoService.createExpense({
              // account_name: 'MCA API Credits',
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
      }
        // Another request already processed this payment
        console.log('[MCA Routes] Payment already credited by concurrent request:', order_id);
        return res.redirect('/admin/mca-intelligence?payment=success&message=Already credited');
    }if (orderStatus!.orderStatus! === 'FAILED' || orderStatus!.orderStatus! === 'CANCELLED') {
      await mcaIntelligenceService.updateWalletPaymentStatus(order_id, {
        status: 'failed',
        failureReason: orderStatus!.orderStatus!,
      });
      return res.redirect('/admin/mca-intelligence?payment=failed&message=' + orderStatus!.orderStatus!);
    }
      return res.redirect('/admin/mca-intelligence?payment=pending&order_id=' + order_id);
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
        const orderStatus! = await cashfreeService.getOrderStatus(orderId);
        if ((orderStatus! as any)?.orderStatus! === 'PAID') {
          // Return the updated status info, but crediting happens via callback
          return res.json({
            success: true,
            data: { 
              ...payment, 
              cashfreeStatus: 'PAID',
              message: 'Payment successful - wallet will be credited shortly'
            },
          });
        }if (orderStatus!.orderStatus! === 'FAILED' || orderStatus!.orderStatus! === 'CANCELLED') {
          // Safe to update failed status
          await mcaIntelligenceService.updateWalletPaymentStatus(orderId, {
            status: 'failed',
            failureReason: orderStatus!.orderStatus!,
          });
          return res.json({
            success: true,
            data: { ...payment, status: 'failed', failureReason: orderStatus!.orderStatus! },
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
      limit: limit ? Number.parseInt(limit as string) : 100,
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

    const result = await (globalThis as any).mcaDataCacheService?.getCompanyWithCache(cin, {
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
        directors: directors.map((d: any) => ({
          din: d.din,
          name: d.name,
          designation: d.designation,
          status: d.dinStatus,
          totalAppointments: d.totalAppointments,
          activeAppointments: d.activeAppointments,
        })),
        charges: charges.map((c: any) => ({
          chargeId: c.chargeId,
          holder: c.chargeHolder,
          holderType: c.chargeHolderType,
          amount: c.chargeAmount,
          type: c.chargeType,
          creationDate: c.creationDate,
          satisfactionDate: c.satisfactionDate,
          status: c.status,
        })),
        financials: financials.map((f: any) => ({
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
          activeCharges: charges.filter((c: any) => c.status === 'active').length,
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

// NOTE: /company/:cin/financials is defined above (line ~716) with ratio computation
// This duplicate has been removed to avoid route conflicts

/**
 * GET /api/mca/search
 * Search companies in local cache
 */
router.get('/search', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const limit = Number.parseInt(req.query.limit as string) || 20;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters',
      });
    }

    const results = await (globalThis as any).mcaDataCacheService?.searchCachedCompanies(query, limit);

    res.json({
      success: true,
      data: results.map((c: any) => ({
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

export default router;
