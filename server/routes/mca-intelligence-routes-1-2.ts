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

function maskSensitiveData<T extends Record<string, any>>(
  data: T,
  config: MaskingConfig
): T {
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
      const value = parseFloat(masked.profitAfterTax);
      if (!isNaN(value)) {
        // Round to nearest crore for advisor role
        const inCrores = Math.round(value / 10000000);
        masked.profitAfterTax = `~${inCrores} Cr (approx)`;
        masked.isApproximate = true;
      }
    }
    if (masked.revenue && typeof masked.revenue === 'string') {
      const value = parseFloat(masked.revenue);
      if (!isNaN(value)) {
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
  await mcaIntelligenceService.logQuery({
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
router.get('/profitable-companies', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const parsed = (undefined as any).safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filter parameters',
        details: parsed.error.issues,
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

// NOTE: Primary /company/:cin handler is defined in Phase 1.3 section (line ~1304)
// with caching support via mcaDataCacheService.getCompanyWithCache

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
 * GET /api/mca/company/:cin/history
 * Get financial history with FY-wise data and YoY growth
 * Used by Company Profile page for trend visualization
 */
router.get('/company/:cin/history', requireMcaAccess('read'), async (req: Request, res: Response) => {
  const { cin } = req.params;
  const limit = parseInt(req.query.limit as string) || 10;
  const user = (req as any).user;

  if (!cin || cin.length !== 21) {
    return res.status(400).json({
      success: false,
      error: 'Invalid CIN format. CIN must be 21 characters.',
    });
  }

  try {
    const history = await mcaIntelligenceService.getFinancialHistory(cin, Math.min(limit, 20));

    await mcaIntelligenceService.logQuery({
      userId: user?.id,
      userName: user?.name || user?.email,
      userRole: getMcaRole(req),
      queryType: 'financial_availability',
      cin,
      actionTaken: 'Financial history lookup',
      responseSummary: history.hasData 
        ? `Found ${history.financialYears.length} years of data` 
        : 'No financial history available',
      resultCount: history.financialYears.length,
      success: true,
    });

    res.json({
      success: true,
      hasData: history.hasData,
      data: history,
    });
  } catch (error: any) {
    console.error('[MCA Routes] Financial history error:', { cin, error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve financial history',
    });
  }
});

/**
 * GET /api/mca/company/:cin/risk-score
 * Calculate composite risk score for a company
 * Components: profit consistency, leverage, compliance freshness, status, margins
 */
router.get('/company/:cin/risk-score', requireMcaAccess('read'), async (req: Request, res: Response) => {
  const { cin } = req.params;
  const user = (req as any).user;

  if (!cin || cin.length !== 21) {
    return res.status(400).json({
      success: false,
      error: 'Invalid CIN format. CIN must be 21 characters.',
    });
  }

  try {
    const riskScore = await mcaIntelligenceService.calculateRiskScore(cin);

    await mcaIntelligenceService.logQuery({
      userId: user?.id,
      userName: user?.name || user?.email,
      userRole: getMcaRole(req),
      queryType: 'risk_assessment' as any,
      cin,
      actionTaken: 'Risk score calculation',
      responseSummary: riskScore.hasData 
        ? `Grade ${riskScore.riskGrade} (Score: ${riskScore.overallScore}/100)` 
        : 'Insufficient data for risk assessment',
      success: true,
    });

    res.json({
      success: true,
      hasData: riskScore.hasData,
      data: riskScore,
    });
  } catch (error: any) {
    console.error('[MCA Routes] Risk score error:', { cin, error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to calculate risk score',
    });
  }
});

/**
 * GET /api/mca/wallet
 * Get MCA API usage stats - Direct pay-per-request mode via Sandbox.co.in
 * Wallet balance is no longer used; billing is handled directly by Sandbox API
 */
router.get('/wallet', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    // Return usage stats instead of wallet balance (Sandbox.co.in handles billing directly)
    const stats = await mcaIntelligenceService.getApiUsageStats();
    res.json({
      success: true,
      data: {
        paymentMode: 'direct', // Pay-per-request via Sandbox.co.in
        billingProvider: 'Sandbox.co.in',
        totalRequests: stats?.totalRequests || 0,
        requestsThisMonth: stats?.requestsThisMonth || 0,
        lastRequestDate: stats?.lastRequestDate,
        message: 'MCA API requests are billed directly by Sandbox.co.in per API call',
      },
    });
  } catch (error: any) {
    console.error('[MCA Routes] API usage stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/mca/wallet/recharge/initiate
 * DEPRECATED - Direct pay-per-request mode via Sandbox.co.in
 * MCA API billing is now handled directly by Sandbox.co.in per API call
 */


export default router;
