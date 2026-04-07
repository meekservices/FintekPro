/**
 * Centralized Error Handling Middleware
 * Processes all errors and returns consistent responses
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, normalizeError } from '../utils/errors';
import { apiResponse } from '../utils/responses';
import { ZodError } from 'zod';
import { logErrorWithTraceId } from '../services/error-tracking-service';
import { logger } from '../logger';
import { handleErrorWithAutoRecovery } from '../services/auto-recovery-service';

/**
 * Format Zod validation errors
 */
function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');
}

/**
 * Log error with context and trace ID
 */
async function logError(error: AppError, req: Request, traceId: string): Promise<void> {
  const logData = {
    traceId,
    error: error.name,
    message: error.message,
    status: error.status,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.id,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    context: error.context,
    timestamp: error.timestamp.toISOString(),
  };

  if (error.status >= 500) {
    logger.error('[ErrorHandler] Server error', logData);
    if (error.stack) {
      logger.error('[ErrorHandler] Stack trace', { stack: error.stack });
    }
  } else {
    logger.warn('[ErrorHandler] Client error', logData);
  }
  
  try {
    await logErrorWithTraceId(error, req, traceId);
  } catch (trackingError) {
    logger.error('[ErrorHandler] Failed to persist error to tracking service', { error: trackingError instanceof Error ? trackingError.message : String(trackingError) });
  }

  // Auto-recovery: for 5xx errors, check if a recovery action should be triggered
  if (error.status >= 500) {
    const errorMsg = `${error.message} ${error.stack || ''}`;
    handleErrorWithAutoRecovery(errorMsg, `${req.method} ${req.path}`).catch(() => {});
  }
}

/**
 * Error handling middleware
 * Should be registered last in the middleware chain
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    return next(err);
  }

  const traceId = req.traceId || res.locals.traceId || 'unknown';
  
  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const message = formatZodError(err);
    const appError = new AppError(message, 400, 'Please check your input and try again.', false, {
      validationErrors: err.errors,
    });
    
    logError(appError, req, traceId);
    apiResponse.error(res, appError);
    return;
  }

  // Normalize to AppError
  const appError = normalizeError(err);
  
  // Log the error with trace ID
  logError(appError, req, traceId);

  // Send response
  apiResponse.error(res, appError);
}

/**
 * Not found handler middleware
 * Handles 404 errors for undefined routes
 * Note: Non-API routes should be handled by SPA fallback before reaching this
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  apiResponse.notFound(res, `Route ${req.method} ${req.path} not found`);
}

/**
 * Async route handler wrapper
 * Catches errors from async route handlers
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
