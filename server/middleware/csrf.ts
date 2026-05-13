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
      console.error(`CSRF validation failed for ${req.method} ${req.path}`);
      return res.status(403).json({ error: "Invalid CSRF token", code: "CSRF_TOKEN_REQUIRED" });
    }

    next();
  };
}
