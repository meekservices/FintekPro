import { Request, Response, NextFunction } from "express";

/**
 * Middleware to detect and handle subdomain routing.
 * Cloud Run specific logic:
 * - Detects 'admin.', 'agent.', or 'partner.' prefixes.
 * - Injects 'subdomain' into the request object.
 * - Handles host-only cookies (since subdomains share the root domain session).
 */
export function subdomainMiddleware(req: Request, res: Response, next: NextFunction) {
  const host = req.headers.host || "";
  
  // Skip logic for local dev if desired, but good for testing locally with /etc/hosts
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    (req as any).subdomain = null;
    return next();
  }

  // Detect portal based on subdomain
  // Format: admin.fintekpro.com or agent.fintekpro.com
  const parts = host.split(".");
  
  // Detailed logging for Cloud Run domain mapping debugging
  if (host.includes(".a.run.app")) {
     console.log(`[SUBDOMAIN_DEBUG] Internal Cloud Run URL hit: ${host}`);
  }

  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase();
    if (["admin", "agent", "partner"].includes(sub)) {
      (req as any).subdomain = sub;
      // Also inject into session if available for persistence across domain jumps
      if (req.session) {
        (req.session as any).subdomain = sub;
        (req.session as any).portalType = sub;
      }
    } else {
      (req as any).subdomain = null;
    }
  } else {
    (req as any).subdomain = null;
  }

  next();
}

/**
 * Helper to get the correct base domain for cross-subdomain cookies.
 * In production, this should return 'fintekpro.com'.
 */
export function getBaseDomain(req: Request): string {
  const host = req.headers.host || "";
  if (host.includes("localhost")) return "localhost";
  
  const parts = host.split(".");
  if (parts.length >= 2) {
    // Return last two parts: example.com
    return parts.slice(-2).join(".");
  }
  return host;
}
