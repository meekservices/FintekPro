import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function createCsrfProtection() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF for safe methods
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    const token = req.headers["x-csrf-token"];
    const sessionToken = req.session.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
      console.error(`[CSRF] Validation failed for ${req.method} ${req.path}`);
      console.error(`  - Header Token: ${token ? 'present' : 'missing'}`);
      console.error(`  - Session Token: ${sessionToken ? 'present' : 'missing'}`);
      if (token && sessionToken && token !== sessionToken) {
        console.error('  - Error: Token mismatch');
      }

      const errorCode = !token ? "CSRF_TOKEN_REQUIRED" : "CSRF_TOKEN_INVALID";

      return res.status(403).json({ 
        error: !token ? "CSRF token required" : "Invalid CSRF token", 
        code: errorCode,
        message: "Your session may have expired or been initialized in another tab. Please refresh."
      });
    }

    next();
  };
}
