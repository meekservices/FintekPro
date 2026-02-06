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
export const auditTrailMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Only audit sensitive operations (POST, PUT, PATCH, DELETE)
  const isSensitiveMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  
  // Only audit API endpoints
  const isApiRoute = req.path.startsWith('/api/');
  
  // Skip health checks and non-sensitive routes
  const isHealthCheck = req.path === '/api/health' || req.path === '/api/ready' || req.path === '/api/live';
  
  if (!isSensitiveMethod || !isApiRoute || isHealthCheck) {
    return next();
  }

  // Capture the original response
  const originalSend = res.send;
  const startTime = Date.now();
  
  // Override res.send to capture response status
  res.send = function(data: any) {
    // Calculate response duration
    const duration = Date.now() - startTime;
    
    // Determine if operation was successful
    const isSuccess = res.statusCode < 400;
    const outcome = isSuccess ? 'success' : 'failure';
    
    // Extract user ID from session
    const userId = (req.session as any)?.user?.id;
    
    // Get IP address
    const ipAddress = req.ip || req.socket?.remoteAddress;
    
    // Get user agent
    const userAgent = req.get('User-Agent');
    
    // Categorize the route
    const category = categorizeRoute(req.path);
    
    // Determine risk level
    const riskLevel = determineRiskLevel(req.path, req.method);
    
    // Prepare audit details
    const details: Record<string, any> = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      queryParamsCount: Object.keys(req.query).length,
    };
    
    // Add body size if present
    const contentLength = req.get('Content-Length');
    if (contentLength) {
      details.requestBodySize = parseInt(contentLength, 10);
    }
    
    // Log the audit trail
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
      // Silently catch audit logging errors to prevent disrupting main request flow
      console.error('[AUDIT] Failed to log audit trail:', err?.message || 'Unknown error');
    });
    
    // Call the original send method
    return originalSend.call(this, data);
  };
  
  next();
};
