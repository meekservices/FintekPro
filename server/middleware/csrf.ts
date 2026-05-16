import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Enhanced CSRF protection with diagnostic logging for production triage.
 */
export const createCsrfProtection = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Skip GET/HEAD/OPTIONS
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    const sessionToken = (req.session as any)?.csrfToken;
    const headerToken = req.headers['x-csrf-token'];

    // 2. Validate token match
    if (sessionToken && headerToken === sessionToken) {
      return next();
    }

    // 3. Diagnostic logging for validation failures
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      host: req.get('host'),
      origin: req.get('origin'),
      userAgent: req.get('user-agent'),
      hasSession: !!req.session,
      sessionToken: sessionToken ? `${sessionToken.substring(0, 4)}...` : 'MISSING',
      headerToken: headerToken ? `${String(headerToken).substring(0, 4)}...` : 'MISSING',
      ip: req.ip || req.headers['x-forwarded-for'],
    };

    console.warn(`[CSRF_FAILURE] 🛡️ Blocked ${req.method} ${req.path}`, logData);

    // In production, return 403. In development, we might be more lenient but 
    // for this deployment we enforce strict check.
    res.status(403).json({
      error: "Invalid CSRF token",
      message: "Security validation failed. Please refresh the page.",
      code: "CSRF_ERROR"
    });
  };
};
