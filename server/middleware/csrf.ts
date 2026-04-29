import { Request, Response, NextFunction } from "express";
import csrf from "csurf";

/**
 * CSRF Protection Middleware
 * 
 * In production (Cloud Run behind Firebase Hosting), we use cookie-based 
 * CSRF tokens. This ensures that even if the frontend is served via CDN,
 * the API calls are protected against cross-site requests.
 */

const csrfProtection = csrf({
  cookie: {
    key: "_csrf",
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  },
});

export const setupCsrf = (app: any) => {
  // Apply CSRF protection to all routes except explicitly excluded ones
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip CSRF for health checks and specific webhooks if needed
    if (req.path === "/api/health" || req.path.startsWith("/api/webhooks")) {
      return next();
    }
    csrfProtection(req, res, next);
  });

  // Provide the token to the frontend via a custom header or cookie
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.csrfToken) {
      const token = req.csrfToken();
      res.cookie("XSRF-TOKEN", token, {
        path: "/",
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }
    next();
  });
};

export { csrfProtection };
