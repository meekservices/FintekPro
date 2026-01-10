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
import { z } from 'zod';

const router = Router();

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
    if (!mcaIntelligenceService.hasAccess(role, action)) {
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
    res.status(500).json({
      success: false,
      error: error.message,
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

// Profitable companies filter schema
const profitableSchema = z.object({
  pat_min: z.coerce.number().optional().default(10000000),
  state: z.string().optional(),
  industry: z.string().optional(),
  limit: z.coerce.number().optional().default(100),
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

    // Get results directly from the service method
    const companies = await mcaIntelligenceService.getProfitableCompanies({
      patMin: parsed.data.pat_min,
      state: parsed.data.state,
      industry: parsed.data.industry,
      limit: parsed.data.limit,
    });

    res.json({
      success: true,
      result: companies,
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
 * POST /api/mca/wallet/recharge
 * Recharge MCA wallet (Admin only)
 */
router.post('/wallet/recharge', requireMcaAccess('full'), async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recharge amount',
      });
    }

    await mcaIntelligenceService.updateWalletBalance(amount, 'recharge');
    const wallet = await mcaIntelligenceService.getWalletStatus();

    res.json({
      success: true,
      message: `Wallet recharged with ₹${amount}`,
      data: wallet,
    });
  } catch (error: any) {
    console.error('[MCA Routes] Wallet recharge error:', error);
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

export default router;
