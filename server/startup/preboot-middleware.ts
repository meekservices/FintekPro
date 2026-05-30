import cors from "cors";
import helmet from "helmet";
import express, { type Express } from "express";
import { APP_VERSION } from "../../shared/version";
import { bootState } from "../utils/boot-state";
import { globalLimiter } from "../middleware/rate-limiter";
import { logger } from "../logger";

// ── Allowed CORS origins ────────────────────────────────────────────────────
const PROD_ORIGINS = [
  "https://fintekpro.com",
  "https://admin.fintekpro.com",
  "https://agent.fintekpro.com",
  "https://partner.fintekpro.com",
  "https://ins.fintekpro.com",
  "https://fintekpro-app-7f3fb64pqq-el.a.run.app",
  "https://fintekpro-app-124901641600.asia-south1.run.app",
];

const DEV_ONLY_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5000",
  "http://0.0.0.0:5000",
  // Dev tunnels — never allowed in production
  ...(process.env.NODE_ENV !== "production"
    ? ["https://replit.dev", "https://repl.co"]
    : []),
];

function getAllowedOrigins(): string[] {
  return process.env.NODE_ENV === "production"
    ? PROD_ORIGINS
    : [...PROD_ORIGINS, ...DEV_ONLY_ORIGINS];
}

function isAllowedCorsOrigin(origin: string | undefined, allowedOrigins: string[]) {
  if (!origin) return true; // same-origin requests

  return (
    allowedOrigins.includes(origin) ||
    // Any *.fintekpro.com subdomain
    /^https:\/\/[a-z0-9-]+\.fintekpro\.com$/.test(origin) ||
    // Any fintekpro Cloud Run preview URL
    (origin.includes("fintekpro-app") && origin.endsWith(".run.app"))
  );
}

export function registerPrebootMiddleware(app: Express) {
  // ── Cloud Run: trust the Google Frontend proxy for real IPs ─────────────
  app.set('trust proxy', 1);

  // ── www → apex redirect ──────────────────────────────────────────────────
  app.use((req, res, next) => {
    const host = req.get("host") || "";
    if (host.toLowerCase().startsWith("www.")) {
      const newHost = host.substring(4);
      const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
      return res.redirect(301, `${protocol}://${newHost}${req.originalUrl}`);
    }
    next();
  });

  // ── Helmet — security headers (MUST be first middleware) ─────────────────
  const isProd = process.env.NODE_ENV === "production";
  app.use(
    helmet({
      // Content-Security-Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc:     ["'self'"],
          scriptSrc:      isProd
            ? ["'self'"]
            : ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vite HMR needs this in dev
          styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc:        ["'self'", "https://fonts.gstatic.com"],
          imgSrc:         ["'self'", "data:", "https:"],
          connectSrc:     [
            "'self'",
            "wss:",
            "https://*.fintekpro.com",
            "https://*.run.app",
            "https://*.googleapis.com",
          ],
          frameSrc:       ["'none'"],
          frameAncestors: ["'none'"],    // blocks clickjacking
          objectSrc:      ["'none'"],
          baseUri:        ["'self'"],
          formAction:     ["'self'"],
          upgradeInsecureRequests: isProd ? [] : null, // force HTTPS in prod
        },
      },
      // HTTP Strict Transport Security (2 years in prod)
      hsts: isProd
        ? { maxAge: 63072000, includeSubDomains: true, preload: true }
        : false,
      // Prevent MIME-type sniffing
      noSniff: true,
      // Block iframe embedding
      frameguard: { action: "deny" },
      // Hide X-Powered-By: Express
      hidePoweredBy: true,
      // Referrer-Policy
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      // Permissions-Policy (disable sensitive browser APIs)
      permittedCrossDomainPolicies: { permittedPolicies: "none" },
      // X-XSS-Protection (legacy, but belt-and-suspenders)
      xssFilter: true,
    }),
  );

  // ── Health probe (before CORS so Cloud Run can reach it unauthenticated) ─
  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      booting: !bootState.routesReady,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ── Body parsers ─────────────────────────────────────────────────────────
  // The `verify` callback captures the raw Buffer before JSON parsing so that
  // webhook routes (Alpaca, Cashfree, IRIS, Zoho) can verify HMAC signatures.
  app.use(express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: false, limit: '10mb' }));

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isAllowedCorsOrigin(origin, getAllowedOrigins())) {
          callback(null, true);
        } else {
          logger.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
      exposedHeaders: ["X-CSRF-Token"],
      maxAge: 86400, // cache preflight for 24h
    }),
  );

  // ── Global rate limiter (DDoS backstop — 300 req/min per IP) ────────────
  app.use(globalLimiter);

  // ── Boot-status (public, after CORS) ─────────────────────────────────────
  app.get("/api/boot-status", (_req, res) => {
    res.json({
      ready: bootState.routesReady,
      error: bootState.error,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    });
  });
}

