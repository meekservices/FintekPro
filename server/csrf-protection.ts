import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { getCookieDomain } from './cookie-domain';

// Extend express-session to include csrfToken
declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
  }
}

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Middleware to initialize CSRF token in session
 * Should be applied early in the middleware chain
 */
export function initializeCsrfToken() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.session && !req.session.csrfToken) {
      req.session.csrfToken = generateCsrfToken();
    }
    next();
  };
}

/**
 * API endpoint to fetch CSRF token for SPA clients
 * GET /api/csrf-token
 */
export function getCsrfToken(req: Request, res: Response) {
  if (!req.session) {
    return res.status(500).json({ error: 'Session not initialized' });
  }

  // Ensure token exists in session
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }

  const cookieDomain = getCookieDomain(req.hostname);

  // Set token in cookie FIRST (double-submit pattern)
  res.cookie('x-csrf-token', req.session.csrfToken, {
    httpOnly: false, // Must be accessible to JavaScript
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Use 'lax' for better browser compatibility
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week (matches session)
    domain: cookieDomain,
  });

  // Return token (client will include in x-csrf-token header)
  res.json({ 
    csrfToken: req.session.csrfToken,
    cookieName: 'x-csrf-token'
  });
}

/**
 * Middleware to validate CSRF token on state-changing requests
 * Validates token from x-csrf-token header against session token
 */
export function validateCsrfToken() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF validation for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Skip for routes that don't need CSRF (webhooks use signature validation)
    const exemptPaths = [
      '/api/webhooks/',                    // Generic webhooks
      '/api/payments/cashfree/webhook',    // Cashfree payment webhooks
      '/api/payments/phonepe/webhook',     // PhonePe payment webhooks
      '/api/zoho/webhooks/',               // Zoho integration webhooks
      '/api/aa/webhook',                   // Account Aggregator webhooks
    ];
    
    if (exemptPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Get token from header
    const headerToken = req.headers['x-csrf-token'] as string;
    
    // Get token from session
    const sessionToken = req.session?.csrfToken;

    // Validate tokens exist and match
    if (!headerToken || !sessionToken || headerToken !== sessionToken) {
      console.warn('CSRF validation failed:', {
        path: req.path,
        method: req.method,
        hasHeaderToken: !!headerToken,
        hasSessionToken: !!sessionToken,
        tokensMatch: headerToken === sessionToken,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(403).json({ 
        error: 'Invalid or missing CSRF token',
        code: 'CSRF_VALIDATION_FAILED'
      });
    }

    // Token is valid, proceed
    next();
  };
}

/**
 * Regenerate CSRF token (call after login to prevent fixation)
 */
export function regenerateCsrfToken(req: Request): void {
  if (req.session) {
    req.session.csrfToken = generateCsrfToken();
  }
}
