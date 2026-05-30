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
    success: true,
    metadata: {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      accessedAt: new Date().toISOString(),
    },
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
router.post('/query', requireMcaAccess('query'), async (req: Request, res: Response) => {
  try {
    const parsed = querySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: parsed.error.issues,
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
        details: parsed.error.issues,
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

// ===============================================
// DIRECT JSON INGEST ENDPOINTS
// For populating MCA data without XBRL parsing
// Matches canonical API contract from architecture
// ===============================================

// Company master ingest schema
const ingestCompanySchema = z.object({
  cin: z.string().length(21, 'CIN must be 21 characters'),
  companyName: z.string().min(1, 'Company name required'),
  companyStatus: z.string().optional().default('Active'),
  incorporationDate: z.string().optional(),
  registeredState: z.string().optional(),
  registeredCity: z.string().optional(),
  registeredAddress: z.string().optional(),
  companyCategory: z.string().optional(),
  companySubCategory: z.string().optional(),
  companyClass: z.string().optional(),
  authorizedCapital: z.union([z.string(), z.number()]).optional(),
  paidUpCapital: z.union([z.string(), z.number()]).optional(),
  lastFilingYear: z.string().optional(),
  email: z.string().email().optional(),
  industry: z.string().optional(),
  source: z.string().optional().default('DIRECT_INGEST'),
});

// Financial data ingest schema
const ingestFinancialsSchema = z.object({
  cin: z.string().length(21, 'CIN must be 21 characters'),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-YY (e.g., 2023-24)'),
  revenue: z.union([z.string(), z.number()]).optional(),
  profitBeforeTax: z.union([z.string(), z.number()]).optional(),
  profitAfterTax: z.union([z.string(), z.number()]).optional(),
  netWorth: z.union([z.string(), z.number()]).optional(),
  totalAssets: z.union([z.string(), z.number()]).optional(),
  totalLiabilities: z.union([z.string(), z.number()]).optional(),
  shareCapital: z.union([z.string(), z.number()]).optional(),
  reserves: z.union([z.string(), z.number()]).optional(),
  longTermBorrowing: z.union([z.string(), z.number()]).optional(),
  shortTermBorrowing: z.union([z.string(), z.number()]).optional(),
  source: z.string().optional().default('DIRECT_INGEST'),
  notes: z.string().optional(),
});

// Bulk ingest schema
const ingestBulkSchema = z.object({
  companies: z.array(ingestCompanySchema).optional(),
  financials: z.array(ingestFinancialsSchema).optional(),
});

/**
 * POST /api/mca/ingest-company
 * Direct JSON ingest for company master data
 * No XBRL parsing - accepts clean JSON
 */
router.post('/ingest-company', requireMcaAccess('ingest'), async (req: Request, res: Response) => {
  try {
    const parsed = ingestCompanySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid company data',
        details: parsed.error.issues,
      });
    }

    const user = (req as any).user;
    const data = parsed.data;
    
    // Upsert company master record
    const result = await mcaIntelligenceService.upsertCompanyMaster({
      cin: data.cin,
      companyName: data.companyName,
      companyStatus: data.companyStatus,
      incorporationDate: data.incorporationDate,
      registeredState: data.registeredState,
      registeredCity: data.registeredCity,
      registeredAddress: data.registeredAddress,
      companyCategory: data.companyCategory,
      companySubCategory: data.companySubCategory,
      companyClass: data.companyClass,
      authorizedCapital: data.authorizedCapital?.toString(),
      paidUpCapital: data.paidUpCapital?.toString(),
      lastFilingYear: data.lastFilingYear,
      email: data.email,
      industry: data.industry,
      sourceAttribution: data.source,
    });

    // Log the ingest action
    await mcaIntelligenceService.logQuery({
      userId: user?.id,
      userName: user?.name || user?.email || 'system',
      userRole: getMcaRole(req),
      queryType: 'ingest' as any,
      cin: data.cin,
      actionTaken: 'Company master ingested via direct JSON',
      responseSummary: `Company ${data.companyName} added/updated`,
      success: true,
    });

    res.json({
      success: true,
      message: 'Company master ingested successfully',
      data: {
        cin: data.cin,
        companyName: data.companyName,
        source: data.source,
      },
      data_quality: {
        source: 'DIRECT_INGEST',
        confidence: 'AUDIT_GRADE',
        last_updated: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[MCA Routes] Ingest company error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/mca/ingest-financials
 * Direct JSON ingest for financial data
 * No XBRL parsing - accepts clean JSON with numeric values
 */
router.post('/ingest-financials', requireMcaAccess('ingest'), async (req: Request, res: Response) => {
  try {
    const parsed = ingestFinancialsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid financial data',
        details: parsed.error.issues,
      });
    }

    const user = (req as any).user;
    const data = parsed.data;
    
    // Check if company exists first
    const companyExists = await mcaIntelligenceService.companyExists(data.cin);
    if (!companyExists) {
      return res.status(400).json({
        success: false,
        error: `Company with CIN ${data.cin} not found. Ingest company master first.`,
        hint: 'POST to /api/mca/ingest-company first',
      });
    }
    
    // Upsert financial snapshot
    const result = await mcaIntelligenceService.upsertFinancialSnapshot({
      cin: data.cin,
      financialYear: data.financialYear,
      revenue: data.revenue?.toString(),
      profitBeforeTax: data.profitBeforeTax?.toString(),
      profitAfterTax: data.profitAfterTax?.toString(),
      netWorth: data.netWorth?.toString(),
      totalAssets: data.totalAssets?.toString(),
      totalLiabilities: data.totalLiabilities?.toString(),
      shareCapital: data.shareCapital?.toString(),
      reserves: data.reserves?.toString(),
      longTermBorrowing: data.longTermBorrowing?.toString(),
      shortTermBorrowing: data.shortTermBorrowing?.toString(),
      source: data.source || 'DIRECT_INGEST',
      derivedBy: user?.email || 'system',
      notes: data.notes,
    });

    // Log the ingest action
    await mcaIntelligenceService.logQuery({
      userId: user?.id,
      userName: user?.name || user?.email || 'system',
      userRole: getMcaRole(req),
      queryType: 'ingest' as any,
      cin: data.cin,
      actionTaken: `Financial data ingested for FY ${data.financialYear}`,
      responseSummary: `PAT: ${data.profitAfterTax}, Revenue: ${data.revenue}`,
      success: true,
    });

    res.json({
      success: true,
      message: 'Financial data ingested successfully',
      data: {
        cin: data.cin,
        financialYear: data.financialYear,
        profitAfterTax: data.profitAfterTax,
        revenue: data.revenue,
        source: data.source,
      },
      data_quality: {
        source: 'DIRECT_INGEST',
        confidence: 'AUDIT_GRADE',
        last_updated: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[MCA Routes] Ingest financials error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/mca/ingest-bulk
 * Bulk ingest for multiple companies and/or financials
 * Best-effort processing with per-item status tracking
 * Note: Not atomic - partial success is possible. Check results.errors for failures.
 */
router.post('/ingest-bulk', requireMcaAccess('ingest'), async (req: Request, res: Response) => {
  try {
    const parsed = ingestBulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bulk data',
        details: parsed.error.issues,
      });
    }

    const user = (req as any).user;
    const { companies = [], financials = [] } = parsed.data;
    
    // Track successfully ingested company CINs for FK validation
    const ingestedCompanyCins = new Set<string>();
    
    const results = {
      companiesIngested: 0,
      companiesFailed: 0,
      financialsIngested: 0,
      financialsFailed: 0,
      financialsSkipped: 0,
      errors: [] as string[],
      warnings: [] as string[],
    };

    // First, ingest all companies
    for (const company of companies) {
      try {
        await mcaIntelligenceService.upsertCompanyMaster({
          cin: company.cin,
          companyName: company.companyName,
          companyStatus: company.companyStatus,
          incorporationDate: company.incorporationDate,
          registeredState: company.registeredState,
          registeredCity: company.registeredCity,
          registeredAddress: company.registeredAddress,
          companyCategory: company.companyCategory,
          companySubCategory: company.companySubCategory,
          companyClass: company.companyClass,
          authorizedCapital: company.authorizedCapital?.toString(),
          paidUpCapital: company.paidUpCapital?.toString(),
          lastFilingYear: company.lastFilingYear,
          email: company.email,
          industry: company.industry,
          sourceAttribution: company.source,
        });
        results.companiesIngested++;
        ingestedCompanyCins.add(company.cin);
      } catch (err: any) {
        results.companiesFailed++;
        results.errors.push(`Company ${company.cin}: ${err.message}`);
      }
    }

    // Then, ingest all financials (with FK validation)
    for (const fin of financials) {
      try {
        // Check if company exists (either already in DB or just ingested in this batch)
        const companyExists = ingestedCompanyCins.has(fin.cin) || 
                              await mcaIntelligenceService.companyExists(fin.cin);
        
        if (!companyExists) {
          results.financialsSkipped++;
          results.warnings.push(`Financials ${fin.cin}/${fin.financialYear}: Skipped - company not found. Ingest company first.`);
          continue;
        }
        
        await mcaIntelligenceService.upsertFinancialSnapshot({
          cin: fin.cin,
          financialYear: fin.financialYear,
          revenue: fin.revenue?.toString(),
          profitBeforeTax: fin.profitBeforeTax?.toString(),
          profitAfterTax: fin.profitAfterTax?.toString(),
          netWorth: fin.netWorth?.toString(),
          totalAssets: fin.totalAssets?.toString(),
          totalLiabilities: fin.totalLiabilities?.toString(),
          shareCapital: fin.shareCapital?.toString(),
          reserves: fin.reserves?.toString(),
          longTermBorrowing: fin.longTermBorrowing?.toString(),
          shortTermBorrowing: fin.shortTermBorrowing?.toString(),
          source: fin.source || 'BULK_INGEST',
          derivedBy: user?.email || 'system',
          notes: fin.notes,
        });
        results.financialsIngested++;
      } catch (err: any) {
        results.financialsFailed++;
        results.errors.push(`Financials ${fin.cin}/${fin.financialYear}: ${err.message}`);
      }
    }

    // Log the bulk ingest action
    await mcaIntelligenceService.logQuery({
      userId: user?.id,
      userName: user?.name || user?.email || 'system',
      userRole: getMcaRole(req),
      queryType: 'ingest' as any,
      actionTaken: 'Bulk data ingest',
      responseSummary: `Companies: ${results.companiesIngested}/${companies.length}, Financials: ${results.financialsIngested}/${financials.length}`,
      success: results.companiesFailed === 0 && results.financialsFailed === 0,
    });

    // Determine overall success and confidence level
    const allSucceeded = results.companiesFailed === 0 && results.financialsFailed === 0 && results.financialsSkipped === 0;
    const partialSuccess = results.companiesIngested > 0 || results.financialsIngested > 0;
    
    res.json({
      success: partialSuccess,
      message: allSucceeded 
        ? 'Bulk ingest completed successfully' 
        : 'Bulk ingest completed with some issues',
      results,
      data_quality: {
        source: 'BULK_INGEST',
        confidence: allSucceeded ? 'AUDIT_GRADE' : 'PARTIAL',
        partial_success: !allSucceeded && partialSuccess,
        last_updated: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[MCA Routes] Bulk ingest error:', error);
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

export default router;
