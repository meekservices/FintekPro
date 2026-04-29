import { randomBytes } from 'crypto';
import { type Request, type Response, type NextFunction } from 'express';
import { logger } from '../logger';

/**
 * Generate a cryptographically secure CSRF token.
 */
export const generateCsrfToken = (): string => randomBytes(32).toString('hex');

/**
 * Creates Express middleware implementing the Synchronizer Token Pattern.
 * Must be applied after session middleware so req.session is available.
 *
 * - Safe methods (GET, HEAD, OPTIONS) are passed through.
 * - Public API routes listed in publicRoutes are excluded.
 * - All other mutating requests must supply the X-CSRF-Token header
 *   matching the token stored in the session.
 */
export const createCsrfProtection = () => (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Skip safe HTTP methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip public / authentication routes
  const publicRoutes = [
    '/api/login',
    '/api/register',
    '/api/auth',
    '/api/health',
    '/api/public',
    '/api/csrf-token',
    '/api/webhooks',
  ];
  if (publicRoutes.some((r) => req.path.startsWith(r))) {
    return next();
  }

  // Origin check for production
  const requestOrigin = req.get('origin') || req.get('referer') || '';
  const allowedOrigins = [
    'https://fintekpro.com',
    'https://www.fintekpro.com',
    'https://admin.fintekpro.com',
    'https://agent.fintekpro.com',
    'https://partner.fintekpro.com',
    'https://ins.fintekpro.com',
  ];
  if (
    process.env.NODE_ENV === 'production' &&
    requestOrigin &&
    !allowedOrigins.some((o) => requestOrigin.startsWith(o)) &&
    !requestOrigin.includes('run.app') &&
    !requestOrigin.endsWith('.fintekpro.com')
  ) {
    logger.warn(`[CSRF] Blocked request from: ${requestOrigin}`);
    return res.status(403).json({ error: 'Forbidden', code: 'INVALID_ORIGIN' });
  }

  // Token validation
  const csrfToken = req.get('X-CSRF-Token');
  let sessionToken = (req.session as any)?.csrfToken;

  // Lazily generate session token if not present
  if (!sessionToken) {
    sessionToken = generateCsrfToken();
    (req.session as any).csrfToken = sessionToken;
  }

  if (!csrfToken || csrfToken !== sessionToken) {
    logger.warn(`[CSRF] Token mismatch for user ${ (req.session as any)?.user?.id }`);
    return res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_TOKEN_REQUIRED' });
  }

  return next();
};
