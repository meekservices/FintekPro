/**
 * Request Tracing Middleware
 * 
 * Adds distributed tracing capabilities to track requests across services
 */

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../logger';

// Extend Express Request to include trace IDs
declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      spanId?: string;
      parentSpanId?: string;
    }
  }
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  timestamp: string;
  method: string;
  path: string;
  userAgent?: string;
  ip?: string;
}

/**
 * Request tracing middleware - adds distributed tracing headers
 */
export function requestTracingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate or extract trace ID
  const traceId = req.headers['x-trace-id'] as string || randomUUID();
  const parentSpanId = req.headers['x-parent-span-id'] as string;
  const spanId = randomUUID();

  // Attach to request
  req.traceId = traceId;
  req.spanId = spanId;
  req.parentSpanId = parentSpanId;

  // Add to response headers for client tracking
  res.setHeader('X-Trace-Id', traceId);
  res.setHeader('X-Span-Id', spanId);

  // Log trace context
  const traceContext: TraceContext = {
    traceId,
    spanId,
    parentSpanId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  };

  logger.debug('Request trace', traceContext);

  next();
}

/**
 * Get trace context from request
 */
export function getTraceContext(req: Request): TraceContext | null {
  if (!req.traceId || !req.spanId) {
    return null;
  }

  return {
    traceId: req.traceId,
    spanId: req.spanId,
    parentSpanId: req.parentSpanId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  };
}

/**
 * Create child span for nested operations
 */
export function createChildSpan(req: Request): { spanId: string; parentSpanId: string; traceId: string } {
  if (!req.traceId || !req.spanId) {
    throw new Error('Cannot create child span without trace context');
  }

  return {
    traceId: req.traceId,
    spanId: randomUUID(),
    parentSpanId: req.spanId
  };
}
