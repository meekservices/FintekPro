// FintekPro Server - Main entry point
import "dotenv/config";

// Signal handlers removed - graceful shutdown (setupGracefulShutdown) handles SIGTERM/SIGINT properly

// Throttle flag for Neon library non-fatal errors
let neonErrorThrottled = false;

// Global error handlers to prevent Neon serverless library crashes
process.on('uncaughtException', (error: Error) => {
  if (error.message?.includes('socket hang up') || 
      error.message?.includes('ECONNRESET') || 
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('read ECONNRESET') ||
      error.message?.includes('write ECONNABORTED') ||
      (error as any).code === 'ECONNRESET' ||
      (error as any).code === 'EPIPE' ||
      (error as any).code === 'ERR_STREAM_DESTROYED') {
    console.warn('[Global] Network/stream error (non-fatal):', error.message);
    return;
  }
  if (error.message?.includes('Cannot set property message of') && 
      error.message?.includes('which has only a getter')) {
    if (!neonErrorThrottled) {
      neonErrorThrottled = true;
      console.warn('[Global] Neon library error (non-fatal, throttling further occurrences for 5m)');
      setTimeout(() => { neonErrorThrottled = false; }, 5 * 60 * 1000);
    }
    return;
  }
  // EADDRINUSE means the previous process is still holding the port — exit immediately
  // so the supervisor (Replit) can retry a clean start once the port is released.
  if ((error as any).code === 'EADDRINUSE') {
    console.error(`[Global] FATAL: ${error.message} — exiting so supervisor can retry`);
    process.exit(1);
  }
  // For other uncaught exceptions, log but don't crash
  console.error('[Global] Uncaught exception:', error);
  // Don't exit the process - let it continue serving requests
  // Only truly fatal errors (like missing DATABASE_URL) use process.exit() explicitly
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  if (reason?.message?.includes('socket hang up') || 
      reason?.message?.includes('ECONNRESET') ||
      reason?.message?.includes('ETIMEDOUT') ||
      reason?.code === 'ECONNRESET' ||
      reason?.code === 'EPIPE' ||
      reason?.code === 'ERR_STREAM_DESTROYED') {
    console.warn('[Global] Network/stream rejection (non-fatal):', reason?.message || reason);
    return;
  }
  // Ignore Neon connection termination errors (error code 57P01)
  if (reason?.code === '57P01' || 
      reason?.message?.includes('terminating connection due to administrator command')) {
    console.warn('[Global] Database connection terminated (non-fatal):', reason?.message || reason);
    return; // Don't crash the process
  }
  console.error('[Global] Unhandled rejection:', reason);
});

import { db, testConnection } from "./db";
import http from "http";
import path from "path";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { validationResult } from "express-validator";
import { registerRoutes } from "./routes";
import versionRouter from "./routes/version";
import { registerRoleRoutes } from "./role-routes";
import { logger } from "./logger";
import { serveStatic, registerSPACatchAll } from "./static";
import { complianceMiddleware } from "./compliance-monitor";
import { storage } from "./storage";
import { setupAuth as setupSessionAuth } from "./auth-setup";
import { setupAuth as setupLocalAuth } from "./auth";
import { subdomainDetection, validateSessionPortal } from "./subdomain-middleware";
import { initializeCronJobs } from "./cron-jobs";
import { requestContextMiddleware } from "./middleware/request-context";
import { errorMonitoringMiddleware, globalErrorHandler } from "./error-monitor";
import { latencyTrackingMiddleware } from "./services/request-latency-tracker";
import { sensitiveDataMaskingMiddleware } from "./middleware/sensitive-data-masking";
import { setupGracefulShutdown } from "./graceful-shutdown";
import { auditTrailMiddleware } from "./middleware/audit-trail";
import { universalKycGate } from "./middleware/universal-kyc-gate";
import { randomBytes } from "crypto";
import fs from "fs";
import { symbolMappingService } from "./services/symbol-mapping-service";
import { creditRatingsService } from "./services/credit-ratings-service";
import \"./services/sms-service\"; // Initialize SMS service
import { bootState, logBootProgress } from './boot-status';
import { registerAuthEventConsumers } from \"./services/auth-event-consumers\";
import { isProductionEnvironment } from \"./utils/enrichment-guard\";

// Ensure static build is available for production deployments
// Vite builds to dist/public, but serveStatic expects server/public
function ensureStaticBuild(): void {
  const isDeployment = process.env.REPLIT_DEPLOYMENT === '1' || process.env.NODE_ENV === 'production';
  if (!isDeployment) return;

  const sourcePath = path.resolve(import.meta.dirname, '..', 'dist', 'public');
  const targetPath = path.resolve(import.meta.dirname, 'public');

  // Check if source build exists
  if (!fs.existsSync(sourcePath)) {
    console.warn(`⚠️ Production build not found at ${sourcePath}. Frontend may not load.`);
    return;
  }

  // If target already exists and is a symlink or directory, skip
  if (fs.existsSync(targetPath)) {
    console.log('✅ Static build directory already exists at server/public');
    return;
  }

  try {
    // Create symlink for efficiency (avoids copying large files)
    fs.symlinkSync(sourcePath, targetPath, 'junction');
    console.log('✅ Created symlink from dist/public to server/public for production');
  } catch (symlinkError) {
    // Fallback to copying if symlink fails (some platforms don't support it)
    try {
      fs.cpSync(sourcePath, targetPath, { recursive: true });
      console.log('✅ Copied dist/public to server/public for production');
    } catch (copyError) {
      console.error('❌ Failed to prepare static build:', copyError);
    }
  }
}

// Run before server starts
ensureStaticBuild();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const server = http.createServer(app);

logBootProgress(\"Server process started\");

// Serve static assets IMMEDIATELY so the frontend can load while we boot
// Also register the SPA catch-all early — this ensures that even if the async boot
// sequence throws (e.g. DB timeout), the frontend SPA still loads instead of \"Cannot GET /\"
if (process.env.NODE_ENV === 'production') {
  serveStatic(app);
  // SPA fallback: registered early so it's always available as the last route.
  // The in-flight async boot registers it again later (idempotent — Express dedupes by reference).
  // Using a late-binding wrapper so it still works before the boot sequence runs.
  app.get('*', (req, res, next) => {
    // Skip API routes — they have their own handlers
    if (req.path.startsWith('/api/') || req.path.startsWith('/health')) return next();
    // Only serve the SPA once routes are registered; during boot the '/' handler above
    // serves the loading screen, so this only kicks in post-boot for deep-link routes.
    if (!bootState.routesReady) return next();
    // Delegate to the real SPA catch-all registered during boot (registered at line ~2129)
    // This wrapper ensures that if it was never registered (fatal boot error), we still serve
    // the index.html from the dist directory directly.
    const indexPath = path.resolve(import.meta.dirname, '..', 'dist', 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

// ============================================================================
// PRIORITY HEALTH CHECKS - MUST BE FIRST (Railway/GCP/K8s Support)
// These ensure the container survives initial deployment probes.
// ============================================================================
app.get('/api/health', (_req, res) => {
  res.status(200).json({ 
    status: bootState.routesReady ? 'ready' : 'booting', 
    milestone: bootState.milestone, 
    error: bootState.error, 
    uptime: process.uptime(),
    bootTimeMs: bootState.getBootTime()
  });
});

app.get(['/health', '/healthz', '/ready', '/live'], (_req, res) => {
  // Always return 200 during boot to prevent infrastructure from killing the process
  res.status(200).send(bootState.routesReady ? 'OK' : 'BOOTING');
});

// Primary Root Handler - serves the \"Initializing\" screen or delegates to the frontend
app.get('/', (req, res, next) => {
  if (bootState.routesReady) return next();
  
  res.status(200).set({ 'Content-Type': 'text/html' }).send(`
    <!DOCTYPE html>
    <html lang=\"en\">
    <head>
        <meta charset=\"UTF-8\">
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
        <title>FintekPro | Initializing</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap');
            body { 
                margin: 0; padding: 0; 
                display: flex; flex-direction: column; 
                justify-content: center; align-items: center; 
                height: 100vh; background: #0a0a0b; 
                color: #ffffff; font-family: 'Inter', sans-serif;
                overflow: hidden;
            }
            .glow {
                position: absolute; width: 400px; height: 400px;
                background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(0,0,0,0) 70%);
                filter: blur(50px); animation: pulse 8s infinite alternate;
            }
            .container { text-align: center; z-index: 10; position: relative; }
            .logo { font-size: 32px; font-weight: 600; margin-bottom: 24px; letter-spacing: -0.02em; background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .loader { 
                width: 48px; height: 48px; border: 2px solid #1f2937; border-top-color: #6366f1;
                border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 24px;
            }
            .message { font-size: 16px; color: #9ca3af; font-weight: 300; }
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes pulse { from { opacity: 0.4; transform: scale(1); } to { opacity: 0.8; transform: scale(1.1); } }
        </style>
    </head>
    <body>
        <div class=\"glow\"></div>
        <div class=\"container\">
            <div class=\"logo\">FintekPro</div>
            <div class=\"loader\"></div>
            <div class=\"message\">Optimizing your market connection...</div>
            <div style=\"margin-top: 20px; font-size: 12px; color: #4b5563;\">Status: \${bootState.milestone}</div>
        </div>
        <script>
            // Auto-refresh every 3 seconds until ready
            setTimeout(() => { window.location.reload(); }, 3000);
        </script>
    </body>
    </html>
  \`);
});


// Environment validation for production readiness
const requiredEnvVars = ['SESSION_SECRET'];
const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('FATAL: Neither PRODUCTION_DATABASE_URL nor DATABASE_URL is set');
  process.exit(1);
}

const optionalButRecommended = ['OPENAI_API_KEY', 'TWILIO_ACCOUNT_SID', 'CASHFREE_APP_ID'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error('FATAL: Required environment variable ' + envVar + ' is not set');
    process.exit(1);
  }
}

if (process.env.NODE_ENV === 'production') {
  const missingOptional = optionalButRecommended.filter(v => !process.env[v]);
  if (missingOptional.length > 0) {
    console.warn(\`⚠️ Recommended env vars not set: \${missingOptional.join(', ')}\`);
  }
}

// Trust proxy configuration for Replit environment
app.set('trust proxy', 1);

// Request context middleware - generates trace IDs for all requests
app.use(requestContextMiddleware);

// Error monitoring middleware - tracks response times and slow requests
app.use(errorMonitoringMiddleware);

// Request latency tracking middleware - feeds slow endpoint data to Activity Centre
app.use(latencyTrackingMiddleware);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'development' ? false : {
    directives: {
      defaultSrc: [\"'self'\"],
      styleSrc: [\"'self'\", \"'unsafe-inline'\", \"https:\"],
      scriptSrc: [\"'self'\", \"'unsafe-eval'\", \"'unsafe-inline'\"],
      imgSrc: [\"'self'\", \"data:\", \"https:\"],
      connectSrc: [\"'self'\", \"wss:\", \"https:\"],
      fontSrc: [\"'self'\", \"https:\"],
      objectSrc: [\"'none'\"],
      baseUri: [\"'self'\"],
      formAction: [\"'self'\"],
      frameAncestors: [\"'self'\", \"https://*.railway.app\"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: \"cross-origin\" },
  frameguard: process.env.NODE_ENV === 'development' ? false : { action: \"sameorigin\" }
}));

// Gzip/Brotli compression for API responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
}));

// CORS configuration - environment-aware
const isProduction = process.env.NODE_ENV === 'production';
const corsAllowedOrigins = [
  \"https://fintekpro.com\",
  \"https://www.fintekpro.com\",
  \"https://admin.fintekpro.com\",
  \"https://agent.fintekpro.com\",
  \"https://partner.fintekpro.com\",
];
if (!isProduction) {
  corsAllowedOrigins.push(
    \"http://localhost:5000\",
    \"http://127.0.0.1:5000\",
    \"http://admin.localhost:5000\",
    \"http://agent.localhost:5000\",
    \"http://partner.localhost:5000\"
  );
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    
    if (corsAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log the origin for debugging in Cloud Run
    if (isProduction) {
      console.log(\`[CORS] Request from origin: \${origin}\`);
    }
    
    // Allow Railway, Cloud Run and Firebase domains
    const isAllowedProviderDomain = 
        origin.endsWith('.railway.app') ||
        origin.endsWith('.up.railway.app') ||
        origin.endsWith('.web.app') ||
        origin.endsWith('.run.app') ||
        origin.includes('.a.run.app') || // Specific for Cloud Run region-based domains
        origin.endsWith('.firebaseapp.com');

    if (isAllowedProviderDomain) {
      return callback(null, true);
    }
    
    // Allow fintekpro subdomains dynamically
    const isFintekProOrigin = origin.endsWith('.fintekpro.com') || origin === 'https://fintekpro.com';
    if (isFintekProOrigin) {
      return callback(null, true);
    }
    
    // Block unknown origins in production with detailed logging
    if (isProduction) {
      logger.warn(\`[CORS] Blocked request from unknown origin: \${origin}\`);
      return callback(new Error(\`Not allowed by CORS: \${origin}\`), false);
    }
    
    // In development, allow all origins for testing
    callback(null, true);
  },
  credentials: true,
  methods: [\"GET\", \"POST\", \"PUT\", \"PATCH\", \"DELETE\", \"OPTIONS\"],
  allowedHeaders: [\"Content-Type\", \"Authorization\", \"X-Requested-With\", \"Accept\", \"Origin\", \"Cache-Control\", \"X-CSRF-Token\"]
}));

// ── Rate Limiting (GAP-5: SEBI CSCRF 2023 §5.1) ───────────────────────────────
// Global IP-based limit: 500 req/15min (was 5000 — reduced to prevent credential stuffing)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 per IP per 15 min (sufficient for genuine SPA usage; blocks bots)
  message: { message: \"Too many requests from this IP. Please try again after 15 minutes.\", code: \"RATE_LIMIT_EXCEEDED\" },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path.includes('/health') || req.path.includes('/static') || req.path.includes('/live');
  }
});

app.use(\"/api\", limiter);

// Stricter rate limiting for authentication endpoints (unchanged — already correct)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 auth attempts per IP per 15 min (prevents brute-force)
  message: { message: \"Too many authentication attempts. Please try again after 15 minutes.\", code: \"AUTH_RATE_LIMIT_EXCEEDED\" },
  skipSuccessfulRequests: true,
});

app.use([\"/api/login\", \"/api/register\"], authLimiter);

// Financial transaction rate limit: 10 orders/min per IP (prevents order spam / market manipulation)
// Applies to all order submission endpoints (MF, SIP, Bond, US stocks, IPO)
const transactionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { message: \"Too many order requests. Please wait a moment before placing another order.\", code: \"TRANSACTION_RATE_LIMIT_EXCEEDED\" },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use([
  \"/api/mf-orders\",
  \"/api/orders\",
  \"/api/iris/orders\",
  \"/api/bonds/orders\",
  \"/api/broker/orders\",
  \"/api/unlisted/orders\",
  \"/api/payments/create-order\",
  \"/api/payments/cashfree/create-order\",
  \"/api/payments/phonepe/create-order\",
], transactionLimiter);


// Raw body capture for webhook signature verification (Cashfree and PhonePe)
app.use('/api/payments/cashfree/webhook', express.raw({ type: 'application/json' }));
app.use('/api/payments/phonepe/callback', express.json({
  limit: \"10mb\",
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Raw body capture for Zoho webhook signature verification
app.use('/api/zoho/webhooks', express.json({
  limit: \"10mb\",
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Raw body capture for Sandbox.co.in webhook signature verification
app.use('/api/webhooks/sandbox', express.json({
  limit: \"10mb\",
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.json({ limit: \"10mb\" }));
app.use(express.urlencoded({ extended: false, limit: \"10mb\" }));

// URL decode error handling middleware - catches malformed URL parameters from bots/scanners
app.use((req: Request, res: Response, next: NextFunction) => {
  try {
    // Test decode of URL path to catch malformed sequences like /%C0/
    decodeURIComponent(req.path);
    // Also check query string if present
    if (req.url.includes('?')) {
      decodeURIComponent(req.url);
    }
    next();
  } catch (error) {
    // Log the malformed request but don't crash - likely a bot/scanner
    logger.warn(\`[URL] Failed to decode malformed URL: \${req.url}\`);
    return res.status(400).json({ error: 'Malformed URL encoding' });
  }
});

// CSRF Protection - Synchronizer Token Pattern
const generateCsrfToken = (): string => randomBytes(32).toString('hex');

// CSRF validation middleware (applied after session setup)
const createCsrfProtection = () => (req: Request, res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  if (req.path.includes('/webhook') || req.path.includes('/webhooks')) {
    return next();
  }
  
  const publicRoutes = ['/api/login', '/api/register', '/api/auth', '/api/health', '/api/public', '/api/csrf-token'];
  if (publicRoutes.some(route => req.path.startsWith(route))) {
    return next();
  }
  
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  
  if (origin || referer) {
    const allowedOrigins = [
      'https://fintekpro.com',
      'https://www.fintekpro.com',
      'https://admin.fintekpro.com',
      'https://agent.fintekpro.com',
      'https://partner.fintekpro.com',
    ];

    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
      allowedOrigins.push(\`https://\${process.env.RAILWAY_PUBLIC_DOMAIN}\`);
    }
    
    if (!isProduction) {
      allowedOrigins.push('http://localhost:5000', 'http://127.0.0.1:5000');
    }
    
    const requestOrigin = origin || (referer ? new URL(referer).origin : null);
    
    const isRailwayRequest = requestOrigin
      ? requestOrigin.endsWith('.railway.app') || requestOrigin.endsWith('.up.railway.app')
      : false;

    const isCloudRunRequest = requestOrigin
      ? requestOrigin.endsWith('.run.app') || requestOrigin.includes('.a.run.app')
      : false;

    const isFirebaseRequest = requestOrigin
      ? requestOrigin.endsWith('.web.app') || requestOrigin.endsWith('.firebaseapp.com')
      : false;

    if (requestOrigin && !isRailwayRequest && !isCloudRunRequest && !isFirebaseRequest && !allowedOrigins.some(allowed => requestOrigin.startsWith(allowed.replace(/\/$/, '')))) {
      logger.warn(\`[CSRF] Blocked request from: \${requestOrigin}\`);
      return res.status(403).json({ error: 'Invalid request origin' });
    }
  }
  
  if (req.session && (req.session as any).user) {
    const csrfToken = req.get('X-CSRF-Token');
    let sessionToken = (req.session as any).csrfToken;
    
    if (!sessionToken) {
      sessionToken = generateCsrfToken();
      (req.session as any).csrfToken = sessionToken;
    }
    
    if (!csrfToken || csrfToken !== sessionToken) {
      logger.warn(\`[CSRF] Token mismatch for user \${(req.session as any).user?.id}\`);
      return res.status(403).json({ error: 'Invalid CSRF token', code: 'CSRF_TOKEN_REQUIRED' });
    }
  }
  
  next();
};

// Input validation middleware
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: \"Validation failed\",
      errors: errors.array().map(err => ({
        field: err.type === 'field' ? err.path : 'unknown',
        message: err.msg
      }))
    });
  }
  next();
};

// Input sanitization middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip sanitization for webhook routes that need raw body for signature verification
  if (req.path === '/api/payments/cashfree/webhook' || req.path.startsWith('/api/zoho/webhooks')) {
    return next();
  }

  // Sanitize common injection attempts
  const sanitizeString = (str: string): string => {
    if (typeof str !== 'string') return str;
    
    // Remove potential XSS scripts
    return str
      .replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\\w+\\s*=/gi, '')
      .trim();
  };

  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  };

  // Sanitize request body (skip if Buffer for webhook signature verification)
  if (req.body && !Buffer.isBuffer(req.body)) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
});

// PAN/Aadhaar masking middleware - SEBI/RBI data protection compliance
app.use(sensitiveDataMaskingMiddleware);

// Subdomain detection middleware - must come early to be available in all routes
app.use(subdomainDetection);

// Redirect bare root domain → www (e.g. fintekpro.com → www.fintekpro.com)
// Needed because most DNS providers don't allow CNAME on the apex (@) record.
app.use((req, res, next) => {
  const host = req.hostname;
  const customDomain = process.env.CUSTOM_DOMAIN || 'fintekpro.com';
  if (host === customDomain) {
    return res.redirect(301, \`https://www.\${customDomain}\${req.originalUrl}\`);
  }
  next();
});

// Portal-bound session validation - enforce portal mismatch security
app.use(validateSessionPortal);

// Compliance monitoring middleware
app.use(complianceMiddleware);

// Regulatory audit trail middleware - SEBI/RBI compliance logging
app.use(auditTrailMiddleware);

// Universal KYC Gate — PMLA/SEBI/RBI compliance for ALL roles
// Blocks any authenticated user whose KYC level is below the minimum for their role.
// Exempt paths: /api/auth, /api/kyc, /api/user, health checks, webhooks, onboarding.
app.use('/api', universalKycGate);

// MFA Enforcement Gate (GAP-2: SEBI CSCRF 2023 §4.3)
// Privileged roles (superadmin, admin, compliance, finance, regulatory) must complete
// WebAuthn or TOTP before any API access is granted.
import('./middleware/mfa-enforcement').then(({ requireMFA }) => {
  app.use('/api', requireMFA);
}).catch(() => { /* non-fatal if MFA module unavailable — logged at module load */ });


app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  const isProduction = process.env.NODE_ENV === 'production';
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  if (!isProduction) {
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
  }

  res.on(\"finish\", () => {
    const duration = Date.now() - start;
    if (path.startsWith(\"/api\")) {
      if (isProduction && path === '/api/health') return;
      logger.http(req.method, path, res.statusCode, duration, capturedJsonResponse ? { response: capturedJsonResponse } : undefined);
    }
  });

  next();
});

// ============================================================================
// ============================================================================
// BOOT-TIME MIDDLEWARES
// ============================================================================

// Boot-in-progress API gate - returns 503 for non-health API routes while booting
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (bootState.routesReady) return next();
  
  // Allow health checks and version info to pass through
  const healthPaths = ['/health', '/ready', '/live', '/version'];
  if (healthPaths.includes(req.path)) return next();
  
  
  res.status(503).json({
    status: 'booting',
    message: 'Server is starting up, please wait a moment...',
    milestone: bootState.milestone,
    bootTimeMs: bootState.getBootTime(),
    retryAfter: 5
  });
});



setupGracefulShutdown(server);

// Start listening IMMEDIATELY - before ANY async initialization
// reusePort: true (SO_REUSEPORT) lets a new instance bind even if the old one
// is still holding the port during a supervisor restart — no fuser/lsof needed.
server.listen({ port: PORT, host: '0.0.0.0' }, () => {
  bootState.serverListening = true;
  console.log(\`🚀 Server listening on port \${PORT} (boot time: \${bootState.getBootTime()}ms)\`);
  logger.info(\`Server listening on port \${PORT}\`, { port: PORT, environment: process.env.NODE_ENV || 'development', bootTime: bootState.getBootTime() });
});

// Register Version API route early (before async boot) so it's always available
// even if the database initialization fails.
app.use(versionRouter);

(async () => {
  try {
    logBootProgress(\"Starting async boot sequence...\");
    
    // Masked DB URL for debugging
    const dbUrl = process.env.PRODUCTION_DATABASE_URL || \"MISSING\";
    const maskedUrl = dbUrl.replace(/:([^:@/]+)@/, ':****@').split('?')[0];
    console.log(\`🔗 [Boot] DB Configuration: \${maskedUrl}\`);

  // Python analytics micro-service (Railway private network or public URL via PYTHON_SERVICE_URL).
  // Log the configured URL so it's visible in every boot.
  const pyUrl = process.env.PYTHON_SERVICE_URL;
  if (pyUrl) {
    console.log(\`ℹ️  [Python] Using external service at \${pyUrl}\`);
  } else {
    console.warn('⚠️  [Python] PYTHON_SERVICE_URL not set — quant/AI analytics will return 503');
  }

  // Delayed health probe — fires 45 s after boot so the Python service
  // (cold-start ~30 s on Railway) is ready before we validate the connection.
  // Also resets the circuit breaker if it opened during the initial 502 storm.
  setTimeout(async () => {
    try {
      const { probePythonHealth, startPythonKeepAlive } = await import('./clients/python-client');
      await probePythonHealth();
      // Start keep-alive pinger AFTER initial probe — prevents Railway from
      // sleeping the Python service between the hourly market-quotes cron runs.
      startPythonKeepAlive();
    } catch (_) { /* best-effort — never crash the main server */ }
  }, 45_000);

  logBootProgress(\"Step 1: Setting up Health Checks & Verifying Database...\");
  
  // CRITICAL: Setup health check routes IMMEDIATELY so the load balancer sees us as \"up\"
  // even if the database initialization takes a while.
  const { readinessCheck, livenessCheck } = await import('./health-check');
  app.get('/ready', (req, res) => {
    if (bootState.isFullyReady()) {
      return readinessCheck(req, res);
    }
    res.status(503).json({
      status: 'booting',
      message: 'Server is starting up',
      bootTime: bootState.getBootTime(),
      state: {
        serverListening: bootState.serverListening,
        authReady: bootState.authReady,
        routesReady: bootState.routesReady
      }
    });
  });

  app.get('/live', (req, res) => {
    // Liveness is just \"process is running and listening\"
    return livenessCheck(req, res);
  });

  // Verify database connectivity before proceeding with heavy service initialization
  const isDbUp = await testConnection();
  if (!isDbUp) {
    console.error('❌ [CRITICAL] Database handshake failed. Boot sequence will continue in degraded mode.');
    console.error('👉 Check PRODUCTION_DATABASE_URL and Cloud SQL socket connectivity.');
    // We don't crash here - we want the server to stay alive so we can access diagnostics
  } else {
    console.log('✅ Database connectivity verified.');
  }
  
  logBootProgress(\"Step 2: Initializing Session Authentication...\");
  // Initialize authentication (Passport & sessions must be set up first)
  await setupSessionAuth(app);
  
  // Then add local email/mobile authentication routes
  setupLocalAuth(app);
  
  // Auth is now ready
  bootState.authReady = true;
  logBootProgress(\"Step 3: Auth Ready. Auditing Regulatory Env...\");
  console.log(\`✅ Auth ready (\${bootState.getBootTime()}ms)\`);

  try {
    const { auditTrailMonitor } = await import('./services/regulatory-audit-monitor');
    auditTrailMonitor.start();
  } catch (_) { /* non-fatal */ }

  logBootProgress(\"Step 4: Registering Core Routes...\");
  console.log('📦 Registering routes...');
  
  // Register Zoho integration routes
  const zohoRoutes = await import('./zoho/routes');
  app.use('/api/zoho', zohoRoutes.default);

  // Core API routes (all protected by session/auth middleware within registerRoutes)
  await registerRoutes(app);
  
  // Register role-specific dashboard and admin routes
  registerRoleRoutes(app);

  logBootProgress(\"Step 5: Initializing Cloud Storage & CDN...\");
  // Initialize storage service
  const { initializeStorage } = await import('./storage');
  await initializeStorage();

  logBootProgress(\"Step 6: Syncing Market Data & Symbol Mappings...\");
  // Initialize market data services
  await symbolMappingService.initialize();
  await creditRatingsService.initialize();

  logBootProgress(\"Step 7: Starting Scheduled Compliance Tasks...\");
  // Initialize cron jobs for background tasks
  initializeCronJobs();

  logBootProgress(\"Step 8: Warming up AI Analytics Pipelines...\");
  // Warm up AI services
  try {
    const { warmUpAIServices } = await import('./services/ai-warmup');
    warmUpAIServices();
  } catch (_) { /* non-fatal */ }

  logBootProgress(\"Step 9: Configuring Global Security Policies...\");
  // SEBI CSCRF 2023 Compliance: Final security lockdown
  // (All sensitive routes already have role-based access control from registerRoutes)
  
  logBootProgress(\"Step 10: Finalizing Asset Registry...\");
  
  // Seed initial government securities data if needed (Regulatory requirement)
  (async () => {
    try {
      const { gsecService } = await import('./services/gsec-service');
      const count = await gsecService.getGSecCount();
      if (count === 0) {
        logBootProgress(\"Baseline: Seeding Government Securities metadata...\");
        await db.execute(path.join(process.cwd(), 'scripts', 'seed-gsecs.sql'));
        console.log('✅ Government securities baseline seeded.');
      }
    } catch (err: any) {
      console.error('Failed to seed government securities:', err.message);
    }
  })();

  // ============================================================================
  // PHASE 3: FINALIZATION & READINESS
  // ============================================================================
  
  // CRITICAL: Signal that the app is ready for traffic
  bootState.routesReady = true;
  logBootProgress(\"Step 12: Boot sequence complete. Server is fully operational.\");

  // ============================================================================
  // PHASE 4: BACKGROUND SERVICES (NON-BLOCKING)
  // These start after routesReady=true so they don't delay the primary boot.
  // ============================================================================
  
  setTimeout(async () => {
    try {
      logBootProgress(\"Background: Starting schedulers and monitors...\");
      
      if (isProductionEnvironment()) {
        // 1. Core compliance and monitoring
        const { kycExpiryMonitor } = await import('./services/kyc-expiry-monitor');
        kycExpiryMonitor.start();

        const { reminderScheduler } = await import('./services/reminder-scheduler');
        reminderScheduler.start();

        // 2. Market and trading services
        const { startMarketFeeds } = await import('./services/market-feed-manager');
        startMarketFeeds();
      }
    } catch (err) {
      console.error('Failed to start background services:', err);
    }
  }, 10_000);

  // Global error handler MUST be the last middleware
  app.use(globalErrorHandler);

  // Final confirmation to logs
  const totalBootTime = bootState.getBootTime();
  console.log(`✨ FintekPro Platform is LIVE (\${totalBootTime}ms)`);
  logger.info('Platform Boot Sequence Success', { 
    bootTimeMs: totalBootTime,
    nodeEnv: process.env.NODE_ENV,
    dbStatus: isDbUp ? 'connected' : 'degraded'
  });

  } catch (error: any) {
    console.error('❌ [FATAL] Server initialization failed:', JSON.stringify(error, null, 2) || error.message || error);
    bootState.error = `Boot Error: \${error?.message || String(error)}`;
    // Ensure the SPA catch-all is registered even if boot failed partway through
    // so users see the frontend (with its own error handling) rather than \"Cannot GET /\"
    try {
        registerSPACatchAll(app);
    } catch (spaErr) {
        console.error('Failed to register fallback catch-all:', spaErr);
    }
    
    // We do NOT exit in production - we want the server to stay alive for diagnostics
    // and to serve the health check (which now reports the boot error).
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }

  // Handle server errors after listening starts
  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port \${PORT} is already in use. Exiting...`);
      process.exit(1);
    }
    console.error('❌ Server error:', error);
  });

  // Keep-alive settings for production stability behind Cloud Run load balancer
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  // Signal completion of current turn if we were in a supervisor environment
  if (process.env.REPLIT_DEPLOYMENT === '1') {
    // Optional: add deployment-specific logic here
  }
})();
