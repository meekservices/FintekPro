import { Request, Response, NextFunction } from "express";
import { auditBufferService } from "../services/audit-buffer-service";

export type AuditCategory = 
  | 'authentication'
  | 'kyc'
  | 'transaction'
  | 'portfolio'
  | 'admin'
  | 'compliance'
  | 'data_access';

export interface AuditLogParams {
  userId?: string | number;
  action: string;
  category: AuditCategory;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  outcome: 'success' | 'failure';
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

function categorizeRoute(path: string): AuditCategory {
  if (path.includes('/login') || path.includes('/register') || path.includes('/auth')) return 'authentication';
  if (path.includes('/kyc') || path.includes('/ckyc')) return 'kyc';
  if (path.includes('/orders') || path.includes('/cart') || path.includes('/payments')) return 'transaction';
  if (path.includes('/portfolio') || path.includes('/holdings')) return 'portfolio';
  if (path.includes('/admin')) return 'admin';
  if (path.includes('/compliance')) return 'compliance';
  return 'data_access';
}

function determineRiskLevel(path: string, method: string): 'low' | 'medium' | 'high' | 'critical' {
  if (method === 'DELETE') return 'high';
  if (path.includes('/admin') && (method === 'POST' || method === 'PUT' || method === 'PATCH')) return 'high';
  if (path.includes('/payments') || path.includes('/orders')) return method === 'GET' ? 'medium' : 'high';
  if (path.includes('/kyc') || path.includes('/ckyc')) return method === 'GET' ? 'low' : 'high';
  if (path.includes('/auth') || path.includes('/login') || path.includes('/register')) return 'medium';
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') return 'medium';
  return 'low';
}

/**
 * Core audit logging function — now buffered via auditBufferService.
 * Writes are batched every 2 seconds (or every 200 entries) for DB efficiency.
 * On DB failure the buffer drains to /tmp/audit-fallback/audit-fallback.jsonl.
 */
export async function auditLog(params: AuditLogParams): Promise<void> {
  auditBufferService.push({
    userId: params.userId != null ? String(params.userId) : null,
    action: params.action,
    category: params.category,
    details: params.details ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    outcome: params.outcome,
    riskLevel: params.riskLevel ?? 'low',
  });
}

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
  
  if (!isApiRoute || isHealthCheck) return next();

  const isSensitiveGet = req.method === 'GET' && SENSITIVE_GET_PATTERNS.some(p => req.path.startsWith(p));
  
  if (!isMutatingMethod && !isSensitiveGet) return next();

  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const outcome = res.statusCode < 400 ? 'success' : 'failure';
    
    const userId = (req as any).user?.id || (req.session as any)?.passport?.user;
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    const details: Record<string, any> = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      queryParamsCount: Object.keys(req.query).length,
    };
    
    const contentLength = req.get('Content-Length');
    if (contentLength) details.requestBodySize = parseInt(contentLength, 10);
    
    auditLog({
      userId,
      action: `${req.method} ${req.path}`,
      category: categorizeRoute(req.path),
      details,
      ipAddress,
      userAgent,
      outcome: outcome as 'success' | 'failure',
      riskLevel: determineRiskLevel(req.path, req.method),
    }).catch(() => {});
  });
  
  next();
};
