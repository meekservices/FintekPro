import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Audit categories for compliance tracking
 * Aligned with SEBI/RBI regulatory requirements
 */
export type AuditCategory = 
  | 'authentication'
  | 'kyc'
  | 'transaction'
  | 'portfolio'
  | 'admin'
  | 'compliance'
  | 'data_access';

/**
 * Parameters for audit logging
 */
export interface AuditLogParams {
  userId?: number;
  action: string;
  category: AuditCategory;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  outcome: 'success' | 'failure';
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Determine audit category based on request path
 */
function categorizeRoute(path: string): AuditCategory {
  // Authentication routes
  if (path.includes('/login') || path.includes('/register') || path.includes('/auth')) {
    return 'authentication';
  }
  
  // KYC routes
  if (path.includes('/kyc') || path.includes('/ckyc')) {
    return 'kyc';
  }
  
  // Transaction routes
  if (path.includes('/orders') || path.includes('/cart') || path.includes('/payments')) {
    return 'transaction';
  }
  
  // Portfolio routes
  if (path.includes('/portfolio') || path.includes('/holdings')) {
    return 'portfolio';
  }
  
  // Admin routes
  if (path.includes('/admin')) {
    return 'admin';
  }
  
  // Compliance routes
  if (path.includes('/compliance')) {
    return 'compliance';
  }
  
  // Default to data_access for everything else
  return 'data_access';
}

/**
 * Determine risk level based on route and method
 */
function determineRiskLevel(path: string, method: string): 'low' | 'medium' | 'high' | 'critical' {
  // DELETE operations are high risk
  if (method === 'DELETE') {
    return 'high';
  }
  
  // Admin mutations are high risk
  if (path.includes('/admin') && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    return 'high';
  }
  
  // Transaction operations are high risk
  if (path.includes('/payments') || path.includes('/orders')) {
    return method === 'GET' ? 'medium' : 'high';
  }
  
  // KYC operations are medium to high risk
  if (path.includes('/kyc') || path.includes('/ckyc')) {
    return method === 'GET' ? 'low' : 'high';
  }
  
  // Authentication operations are medium to high risk
  if (path.includes('/auth') || path.includes('/login') || path.includes('/register')) {
    return 'medium';
  }
  
  // POST/PUT/PATCH are medium risk by default
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    return 'medium';
  }
  
  // GET operations are low risk
  return 'low';
}

/**
 * Core audit logging function
 * Inserts audit trail records into the database for regulatory compliance
 */
export async function auditLog(params: AuditLogParams): Promise<void> {
  try {
    // Prepare details as JSON
    const detailsJson = params.details ? JSON.stringify(params.details) : null;
    
    // Insert into audit_trail table using raw SQL
    // The table structure should match: audit_trail(user_id, action, category, details, ip_address, user_agent, outcome, risk_level, created_at)
    await db.execute(
      sql`
        INSERT INTO audit_trail (user_id, action, category, details, ip_address, user_agent, outcome, risk_level, created_at)
        VALUES (${params.userId || null}, ${params.action}, ${params.category}, ${detailsJson}, ${params.ipAddress || null}, ${params.userAgent || null}, ${params.outcome}, ${params.riskLevel || 'low'}, NOW())
      `
    );
  } catch (error: any) {
    // Log warning if table doesn't exist or other database error occurs
    // This is expected during initial deployment before migrations run
    if (error?.message?.includes('audit_trail') || error?.message?.includes('relation')) {
      console.warn('[AUDIT] Audit trail table not yet created - skipping record insert');
    } else {
      console.warn('[AUDIT] Failed to log audit trail:', error?.message || 'Unknown error');
    }
  }
}

/**
 * Express middleware for automatic audit trail logging
 * Logs all POST/PUT/PATCH/DELETE requests to /api/* endpoints
 * 
 * Usage: app.use(auditTrailMiddleware);
 */
const SENSITIVE_GET_PATTERNS = [
  '/api/kyc',
  '/api/ckyc',
  '/api/portfolio',
  '/api/holdings',
  '/api/orders',
  '/api/payments',
  '/api/admin',
  '/api/compliance',
  '/api/audit',
  '/api/users',
  '/api/proposals',
  '/api/capital-gains',
  '/api/tax',
  '/api/itr',
  '/api/cas',
  '/api/documents',
  '/api/esign',
  '/api/loans',
  '/api/export',
  '/api/download',
  '/api/report',
  '/api/statements',
];

export const auditTrailMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const isApiRoute = req.path.startsWith('/api/');
  const isHealthCheck = req.path === '/api/health' || req.path === '/api/ready' || req.path === '/api/live';
  
  if (!isApiRoute || isHealthCheck) {
    return next();
  }

  const isSensitiveGet = req.method === 'GET' && SENSITIVE_GET_PATTERNS.some(p => req.path.startsWith(p));
  
  if (!isMutatingMethod && !isSensitiveGet) {
    return next();
  }

  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const isSuccess = res.statusCode < 400;
    const outcome = isSuccess ? 'success' : 'failure';
    
    const userId = (req as any).user?.id || (req.session as any)?.passport?.user;
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('User-Agent');
    const category = categorizeRoute(req.path);
    const riskLevel = determineRiskLevel(req.path, req.method);
    
    const details: Record<string, any> = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      queryParamsCount: Object.keys(req.query).length,
    };
    
    const contentLength = req.get('Content-Length');
    if (contentLength) {
      details.requestBodySize = parseInt(contentLength, 10);
    }
    
    auditLog({
      userId,
      action: `${req.method} ${req.path}`,
      category,
      details,
      ipAddress,
      userAgent,
      outcome,
      riskLevel,
    }).catch((err) => {
      console.error('[AUDIT] Failed to log audit trail:', err?.message || 'Unknown error');
    });
  });
  
  next();
};
