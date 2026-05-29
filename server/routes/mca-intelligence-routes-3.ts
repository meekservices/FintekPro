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
router.get('/cache-stats', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const stats = await (globalThis as any).mcaDataCacheService?.getCacheStats();

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

/**
 * GET /api/mca/audit-export
 * Export audit logs for compliance (Admin only)
 */
router.get('/audit-export', requireMcaAccess('full'), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const startDate = req.query.startDate as string;
  const endDate = req.query.endDate as string;
  const format = (req.query.format as string) || 'json';

  try {
    const logs = await mcaIntelligenceService.getAuditLogs({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: 10000,
    });

    // Log this access for meta-audit
    await mcaIntelligenceService.logQuery({
      userId: user?.id,
      userName: user?.name || user?.email,
      userRole: getMcaRole(req),
      queryType: 'audit_export',
      actionTaken: 'Exported audit logs',
      responseSummary: `Exported ${logs.length} records from ${startDate || 'beginning'} to ${endDate || 'now'}`,
      success: true,
    });

    if (format === 'csv') {
      const headers = ['Timestamp', 'User', 'Role', 'Action', 'CIN', 'Query Type', 'Result', 'Success'];
      const rows = logs.map(log => [
        log.createdAt,
        log.userName || 'Anonymous',
        log.userRole,
        log.actionTaken || '',
        log.cin || '',
        log.queryType,
        log.responseSummary || '',
        log.success ? 'Yes' : 'No',
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=mca-audit-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csv);
    }

    res.json({
      success: true,
      data: logs,
      meta: {
        count: logs.length,
        dateRange: { start: startDate, end: endDate },
        exportedBy: user?.email,
        exportedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[MCA Audit Export] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export audit logs',
    });
  }
});

/**
 * GET /api/mca/data-freshness
 * Get data freshness dashboard statistics
 */
router.get('/data-freshness', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const [cacheStats, companyStats] = await Promise.all([
      (globalThis as any).mcaDataCacheService?.getCacheStats(),
      (globalThis as any).mcaDataCacheService?.getDataFreshnessStats(),
    ]);

    const currentYear = new Date().getFullYear();
    const expectedFY = `${currentYear - 1}-${currentYear.toString().slice(-2)}`;

    res.json({
      success: true,
      data: {
        cache: {
          totalCompanies: cacheStats.totalCompanies || 0,
          totalFinancialRecords: cacheStats.totalFinancialRecords || 0,
          companiesFetchedLast24h: cacheStats.companiesFetchedLast24h || 0,
          apiCallsSavedThisMonth: cacheStats.apiCallsSavedThisMonth || 0,
        },
        freshness: {
          expectedFilingYear: expectedFY,
          companiesWithCurrentFiling: companyStats?.currentFilingCount || 0,
          companiesWithDelayedFiling: companyStats?.delayedFilingCount || 0,
          companiesWithMissingFiling: companyStats?.missingFilingCount || 0,
          averageFilingAgeDays: companyStats?.averageFilingAgeDays || 0,
        },
        lastUpdated: new Date().toISOString(),
        disclaimer: 'Data sourced from MCA via Sandbox.co.in. This is cached data and may not reflect real-time MCA records.',
      },
    });
  } catch (error: any) {
    console.error('[MCA Data Freshness] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve data freshness statistics',
    });
  }
});

/**
 * GET /api/mca/compliance-disclaimer
 * Get legal compliance disclaimer for MCA data usage
 */
router.get('/compliance-disclaimer', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      disclaimer: 'All company data displayed on this platform is sourced from the Ministry of Corporate Affairs (MCA) via authorized third-party APIs. This data is provided for informational purposes only and should not be construed as financial, legal, or investment advice.',
      dataSource: 'Ministry of Corporate Affairs (MCA) via Sandbox.co.in',
      limitations: [
        'Data may be cached and not reflect real-time MCA records',
        'Financial data is derived from filed AOC-4 returns and may not include latest updates',
        'Some companies may have delayed or missing filings',
        'Director information is based on publicly available MCA records',
      ],
      lastUpdated: new Date().toISOString(),
      version: '1.0',
    },
  });
});

// ===================================================================
// DATA ENRICHMENT ENDPOINTS
// ===================================================================

/**
 * GET /api/mca/enrichment/stats
 * Get enrichment statistics for dashboard
 */
router.get('/enrichment/stats', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const stats = await mcaIntelligenceService.getEnrichmentStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('[MCA Enrichment] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get enrichment statistics',
    });
  }
});

/**
 * GET /api/mca/enrichment/stale
 * Get list of companies needing data refresh
 */
router.get('/enrichment/stale', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const maxAgeDays = parseInt(req.query.maxAgeDays as string) || 90;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const onlyUnlisted = req.query.onlyUnlisted !== 'false';

    const staleCompanies = await mcaIntelligenceService.getCompaniesNeedingRefresh({
      maxAgeDays,
      limit,
      onlyUnlisted,
    });

    res.json({
      success: true,
      data: {
        count: staleCompanies.length,
        maxAgeDays,
        companies: staleCompanies,
      },
    });
  } catch (error: any) {
    console.error('[MCA Enrichment] Error getting stale companies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get stale companies list',
    });
  }
});

/**
 * POST /api/mca/enrichment/enrich/:cin
 * Manually trigger enrichment for a single company
 */
router.post('/enrichment/enrich/:cin', requireMcaAccess('ingest'), async (req: Request, res: Response) => {
  try {
    const { cin } = req.params;
    const forceRefresh = req.body.forceRefresh === true;

    if (!cin || cin.length !== 21) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CIN format. CIN must be 21 characters.',
      });
    }

    console.log(`[MCA Enrichment] Manual enrichment triggered for ${cin} (force: ${forceRefresh})`);
    
    const result = await mcaIntelligenceService.enrichCompanyData(cin, { forceRefresh });

    res.json({
      success: result.success,
      data: result,
    });
  } catch (error: any) {
    console.error('[MCA Enrichment] Error enriching company:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enrich company data',
    });
  }
});

/**
 * POST /api/mca/enrichment/bulk-enrich
 * Trigger bulk enrichment for multiple companies
 */
router.post('/enrichment/bulk-enrich', requireMcaAccess('ingest'), async (req: Request, res: Response) => {
  try {
    const { cins, forceRefresh = false, batchSize = 5 } = req.body;

    if (!Array.isArray(cins) || cins.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'cins must be a non-empty array of CIN strings',
      });
    }

    if (cins.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 CINs allowed per request',
      });
    }

    // Validate CIN formats
    const invalidCins = cins.filter((cin: string) => typeof cin !== 'string' || cin.length !== 21);
    if (invalidCins.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Invalid CIN format for: ${invalidCins.slice(0, 5).join(', ')}${invalidCins.length > 5 ? '...' : ''}`,
      });
    }

    console.log(`[MCA Enrichment] Bulk enrichment triggered for ${cins.length} companies`);
    
    const result = await mcaIntelligenceService.bulkEnrichCompanies(cins, {
      forceRefresh,
      batchSize: Math.min(batchSize, 10),
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[MCA Enrichment] Error in bulk enrichment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk enrichment',
    });
  }
});

/**
 * POST /api/mca/enrichment/refresh-stale
 * Automatically refresh all stale companies
 * Admin-only endpoint
 */
router.post('/enrichment/refresh-stale', requireMcaAccess('full'), async (req: Request, res: Response) => {
  try {
    const { maxAgeDays = 90, limit = 50, onlyUnlisted = true } = req.body;

    console.log(`[MCA Enrichment] Stale refresh triggered (maxAge: ${maxAgeDays}, limit: ${limit})`);
    
    const result = await mcaIntelligenceService.refreshStaleCompanies({
      maxAgeDays,
      limit: Math.min(limit, 100),
      onlyUnlisted,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[MCA Enrichment] Error refreshing stale companies:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh stale companies',
    });
  }
});

/**
 * GET /api/mca/enrichment/check-freshness/:cin
 * Check if a specific company's data is stale
 */
router.get('/enrichment/check-freshness/:cin', requireMcaAccess('read'), async (req: Request, res: Response) => {
  try {
    const { cin } = req.params;
    const maxAgeDays = parseInt(req.query.maxAgeDays as string) || 90;

    if (!cin || cin.length !== 21) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CIN format',
      });
    }

    const result = await mcaIntelligenceService.isDataStale(cin, maxAgeDays);

    res.json({
      success: true,
      data: {
        cin,
        ...result,
      },
    });
  } catch (error: any) {
    console.error('[MCA Enrichment] Error checking freshness:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check data freshness',
    });
  }
});


export default router;
