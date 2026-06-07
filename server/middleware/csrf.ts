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

    // 2. Bypass CSRF for machine-originated POST endpoints that cannot carry
    //    a browser CSRF token (e.g. ErrorBoundary componentDidCatch, feedback).
    // CSRF is exempt for:
    // 1. Machine-originated endpoints that cannot carry a browser CSRF token
    // 2. eSign endpoints — protected by requireAuth; CSRF token is unavailable in
    //    post-provider-redirect and embedded iframe contexts typical of eSign flows
    // 3. Document upload routes — same rationale as eSign
    //
    // IMPORTANT: This middleware is mounted at app.use('/api', ...) so Express
    // strips the '/api' prefix from req.path. Use paths WITHOUT the /api prefix here.
    // e.g. POST /api/esign/initiate → req.path === '/esign/initiate'
    const CSRF_EXEMPT_PATHS = [
      '/errors/ingest',
      '/errors/feedback',
      '/esign/initiate',
      '/esign/verify',
      '/esign/resend-otp',
      '/esign/generate-hash',
      '/esign/documents',
      '/esign/user-signature/sign',
      '/esign/user-signature/validate',
      '/esign/ai',          // AI analysis — protected by requireAuth; CSRF token
                            // unavailable in document preview / post-redirect contexts
      '/documents/upload',
    ];
    if (CSRF_EXEMPT_PATHS.some(p => req.path === p || req.path.startsWith(p + '/') || req.path.endsWith(p))) {
      return next();
    }

    // 3. Bypass CSRF for mobile app requests — identified by X-Platform: mobile header.
    //    Mobile apps use Bearer JWT auth (not session cookies) so CSRF doesn't apply.
    //    The JWT signature itself provides equivalent request integrity protection.
    if (req.headers['x-platform'] === 'mobile') {
      return next();
    }

    const sessionToken = (req.session as any)?.csrfToken;
    const headerToken = req.headers['x-csrf-token'];

    // 2. Validate token match
    if (sessionToken && headerToken === sessionToken) {
      return next();
    }

    // 3. Auto-heal: if session exists but has NO csrfToken yet (e.g. first mutation
    //    after an X-Session-ID restore, before the client had a chance to call
    //    GET /api/csrf-token), generate one now and let the request through.
    //    The client will pick up the fresh token from the response header.
    if (req.session && !sessionToken) {
      const newToken = generateCsrfToken();
      (req.session as any).csrfToken = newToken;
      req.session.save(() => {}); // fire-and-forget persistence
      res.setHeader('X-CSRF-Token-Refresh', newToken);
      console.info(`[CSRF_AUTOHEAL] 🔧 Generated fresh CSRF token for session with missing token (${req.method} ${req.path})`);
      return next();
    }

    // 4. Diagnostic logging for genuine validation failures (both tokens present but mismatch)
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
