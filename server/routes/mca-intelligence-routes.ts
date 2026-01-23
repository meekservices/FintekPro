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
        details: parsed.error.errors,
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
        details: parsed.error.errors,
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
        details: parsed.error.errors,
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
      queryType: 'risk_assessment',
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

// NOTE: /company/:cin/financials is defined above (line ~716) with ratio computation
// This duplicate has been removed to avoid route conflicts

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
      mcaDataCacheService.getCacheStats(),
      mcaDataCacheService.getDataFreshnessStats(),
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

export default router;
