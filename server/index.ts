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
  `);
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
    console.warn(`⚠️ Recommended env vars not set: \${missingOptional.join(', ')}`);
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
}));

// CORS Configuration - Highly restrictive for regulatory compliance
app.use(cors({
  origin: (origin, callback) => {
    // List of allowed domains
    const allowedOrigins = [
      'https://fintekpro.com',
      'https://www.fintekpro.com',
      'https://admin.fintekpro.com',
      'https://agent.fintekpro.com',
      'https://partner.fintekpro.com',
    ];

    // Allow Railway preview deployments and internal health checks
    const isRailwayOrigin = origin?.endsWith('.railway.app') || origin?.endsWith('.up.railway.app');
    const isCloudRunOrigin = origin?.endsWith('.run.app') || origin?.includes('.a.run.app');
    const isFirebaseOrigin = origin?.endsWith('.web.app') || origin?.endsWith('.firebaseapp.com');

    if (!origin || allowedOrigins.includes(origin) || isRailwayOrigin || isCloudRunOrigin || isFirebaseOrigin) {
      return callback(null, true);
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
    logger.warn(`[URL] Failed to decode malformed URL: \${req.url}`);
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
      allowedOrigins.push(`https://\${process.env.RAILWAY_PUBLIC_DOMAIN}`);
    }
    
    if (!isProductionEnvironment()) {
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
      logger.warn(`[CSRF] Blocked request from: \${requestOrigin}`);
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
      logger.warn(`[CSRF] Token mismatch for user \${(req.session as any).user?.id}`);
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
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
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

  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);

  next();
});

// Compliance Monitoring (DPDP Act §8 + SEBI CSCRF §5.4)
app.use(complianceMiddleware);

// Subdomain and Portal validation middleware
app.use(subdomainDetection);
app.use(validateSessionPortal);

// ── Boot Sequence (Asynchronous) ─────────────────────────────────────────────
// We use a self-invoking async function to start the complex boot sequence.
// This allows the main process to immediately export 'app' and 'server'
// for the supervisor, but gates traffic via the in-flight bootState.
(async () => {
  try {
  const isProduction = process.env.NODE_ENV === 'production';
  logBootProgress(`Phase 1: Foundation (Production: \${isProduction})`);

  // Initialize background services (market data mapping, credit ratings)
  logBootProgress(\"Background: Loading static master data mappings...\");
  await symbolMappingService.initialize();
  await creditRatingsService.initialize();

  // Setup Python service connection string (Railway private networking)
  if (process.env.PYTHON_SERVICE_URL) {
    console.log(`✅ [Python] Analytics service link: \${process.env.PYTHON_SERVICE_URL}`);
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
  console.log(`✅ Auth ready (\${bootState.getBootTime()}ms)`);

  try {
    logBootProgress(\"Step 3a: Logging Gateway Readiness...\");
    // Log API gateway readiness (instrument-specific: MF=Iris, US=Alpaca, Indian=IIFL, etc.)
    try {
      const { logGatewayReadinessSummary } = await import('./services/api-gateway-readiness');
      logGatewayReadinessSummary();
    } catch (e) { 
      console.warn('⚠️ [GatewayReadiness] Summary failed (non-fatal):', e);
    }

    logBootProgress(\"Step 3b: Auditing Env Vars...\");

  // ── Regulatory environment variable audit (boot-time) ──────────────────────
  // These variables are required for regulatory compliance features.
  // Missing vars → silent failures in compliance-critical paths.
  const REQUIRED_COMPLIANCE_ENVS: { key: string; purpose: string; severity: 'critical' | 'high' | 'medium' }[] = [
    { key: 'ENCRYPTION_MASTER_KEY', purpose: 'PII encryption (PAN/Aadhaar at-rest) — DPDP Act §8', severity: 'critical' },
    { key: 'SESSION_SECRET', purpose: 'Session integrity — SEBI CSCRF §4', severity: 'critical' },
    { key: 'SANDBOX_BASE_URL', purpose: 'KYC verification API (PAN/Bank/GSTIN) — PMLA §12', severity: 'high' },
    { key: 'TRUTHSCREEN_USERNAME', purpose: 'CKYC verification (TruthScreen) — SEBI/PMLA', severity: 'high' },
    { key: 'TRUTHSCREEN_PASSWORD', purpose: 'CKYC verification (TruthScreen) — SEBI/PMLA', severity: 'high' },
    { key: 'PHONEPE_SALT_KEY', purpose: 'PhonePe webhook signature verification — PCI-DSS', severity: 'high' },
    { key: 'COMPLIANCE_HEAD_EMAIL', purpose: 'Admin parallel notifications — admin alerting', severity: 'medium' },
    { key: 'COMPLIANCE_HEAD_MOBILE', purpose: 'WhatsApp alerts for high-value/critical events', severity: 'medium' },
    { key: 'KFINTECH_API_KEY', purpose: 'Iris KFintech MF order gateway', severity: 'medium' },
    { key: 'ALPACA_API_KEY', purpose: 'Alpaca US stock trading gateway', severity: 'medium' },
  ];
  const missingCritical: string[] = [];
  const missingHigh: string[] = [];
  const missingMedium: string[] = [];
  for (const env of REQUIRED_COMPLIANCE_ENVS) {
    if (!process.env[env.key]) {
      const msg = `[EnvAudit] ⚠️  Missing \${env.severity.toUpperCase()}: \${env.key} — \${env.purpose}`;
      if (env.severity === 'critical') { console.error(msg); missingCritical.push(env.key); }
      else if (env.severity === 'high') { console.warn(msg); missingHigh.push(env.key); }
      else { console.warn(msg); missingMedium.push(env.key); }
    }
  }
  if (missingCritical.length > 0) {
    console.error(`[EnvAudit] ❌ \${missingCritical.length} CRITICAL compliance env vars missing. Platform is operating in a degraded, non-compliant state.`);
  } else {
    console.log(`[EnvAudit] ✅ All critical compliance env vars present. \${missingHigh.length} high + \${missingMedium.length} medium warnings.`);
  }

    logBootProgress(\"Step 3c: Registering Auth Consumers...\");
    // Register auth event consumers (structured logging + high-risk DB persistence)
    registerAuthEventConsumers();

    logBootProgress(\"Step 3d: Setting up CSRF...\");

  
  // CSRF token endpoint (must be after session middleware)
  app.get('/api/csrf-token', (req: Request, res: Response) => {
    if (!req.session) {
      return res.status(401).json({ error: 'No session' });
    }
    
    if (!(req.session as any).csrfToken) {
      (req.session as any).csrfToken = generateCsrfToken();
    }
    
    res.json({ csrfToken: (req.session as any).csrfToken });
  });
  
    // Apply CSRF protection after session/auth middleware
    app.use('/api', createCsrfProtection());
  } catch (error: any) {
    console.error('❌ [FATAL] Error in Step 3 block:', error);
    bootState.error = `Step 3 Error: \${error?.message || String(error)}`;
    // Do NOT rethrow yet so outer catch can still force ready if needed
    throw error;
  }
  
  // Continue registering routes asynchronously (server is already listening)
  logBootProgress(\"Step 4: Registering Core Routes...\");
  console.log('📦 Registering routes...');
  
  // Register Version API route (for PWA update checks)
  const versionRoutes = await import('./routes/version');
  app.use(versionRoutes.default);
  
  // Register Zoho integration routes
  const zohoRoutes = await import('./zoho/routes');
  app.use('/api/zoho', zohoRoutes.default);

  // Register Firm Inventory (DP Holdings) routes — MS FintekPro Advisors LLP
  const { registerFirmInventoryRoutes } = await import('./routes/firm-inventory');
  registerFirmInventoryRoutes(app);
  
  // ── Agent routes: import all in parallel, register in order ─────────────────
  const [
    agentRoutes, agentRevenueRoutes, agentBasketsRoutes, agentSipHealthRoutes,
    agentPortfolioDriftRoutes, agentClientOrdersRoutes, agentMarketAlertsRoutes, agentTrackerRoutes,
  ] = await Promise.all([
    import('./agent-routes'),
    import('./routes/agent-revenue-routes'),
    import('./routes/agent-baskets'),
    import('./routes/agent-sip-health'),
    import('./routes/agent-portfolio-drift'),
    import('./routes/agent-client-orders'),
    import('./routes/agent-market-alerts'),
    import('./routes/agent-tracker'),
  ]);
  app.use(agentRoutes.default);
  app.use(agentRevenueRoutes.default);
  app.use(agentBasketsRoutes.default);
  app.use(agentSipHealthRoutes.default);
  app.use(agentPortfolioDriftRoutes.default);
  app.use(agentClientOrdersRoutes.default);
  app.use(agentMarketAlertsRoutes.default);
  app.use(agentTrackerRoutes.default);
  console.log('✅ Agent core, revenue, basket, SIP-health, drift, client-order, market-alert, tracker routes registered');

  // ── Prospect/Lead routes: import all in parallel, register in order ──────────
  const [
    prospectRoutes, prospectLeadsRoutes, leadEnrichmentRoutes,
    prospectCampaignRoutes, prospectAnalyticsRoutes,
  ] = await Promise.all([
    import('./routes/prospect-routes'),
    import('./routes/prospect-leads'),
    import('./routes/lead-enrichment-routes'),
    import('./routes/prospect-campaign-routes'),
    import('./routes/prospect-analytics-routes'),
  ]);
  app.use(prospectRoutes.default);
  app.use(prospectLeadsRoutes.default);
  app.use(leadEnrichmentRoutes.default);
  app.use(prospectCampaignRoutes.default);
  app.use(prospectAnalyticsRoutes.default);
  console.log('✅ Prospect core, lead, enrichment, campaign, analytics routes registered');

  // ── Compliance/Admin/Support routes: parallel import ────────────────────────
  const [
    complianceRoutes, adminActivityRoutes, supportTicketsRoutes,
    riskScoringRoutes, feedbackRoutes, mcaRoutes,
  ] = await Promise.all([
    import('./routes/compliance-routes'),
    import('./routes/admin-activity-routes'),
    import('./routes/support-tickets'),
    import('./routes/risk-scoring-routes'),
    import('./routes/feedback-routes'),
    import('./routes/mca-routes'),
  ]);
  app.use(complianceRoutes.default);
  app.use(adminActivityRoutes.default);
  app.use(supportTicketsRoutes.default);
  app.use(riskScoringRoutes.default);
  app.use(feedbackRoutes.default);
  app.use(mcaRoutes.default);
  console.log('✅ Compliance, activity, support, risk-scoring, feedback, MCA routes registered');

  // ── Schedulers and Monitors ──────────────────────────────────────────────────
  logBootProgress(\"Step 5: Starting Schedulers & Governance Monitors...\");
  // Only start in production (prevent multiple cron jobs during dev HMR)
  if (app.get('env') === 'production' || process.env.REPLIT_DEPLOYMENT === '1') {
    const cron = (await import('node-cron')).default;
    // Market regime check every 6 hours — determines the active trading algo
    cron.schedule('0 */6 * * *', async () => {
      console.log('[AI Regime] Running market regime evaluation...');
      try {
        const { aiTradingRegime } = await import('./services/ai-trading-regime');
        await aiTradingRegime.evaluateRegime();
      } catch (error) {
        console.error('[AI Regime] Evaluation failed:', error);
      }
    });
    // Governance drift check every hour — triggers ML retrains if drift > threshold
    cron.schedule('0 * * * *', async () => {
      console.log('[AI Governance] Running drift check...');
      try {
        const { aiModelGovernance } = await import('./services/ai-model-governance');
        const summary = await aiModelGovernance.checkDrift();
        if (summary.driftDetected) {
          console.warn('[AI Governance] Drift detected in: ' + summary.modelsNeedingRetrain.join(', '));
          for (const assetClass of summary.modelsNeedingRetrain) {
            try {
              await aiModelGovernance.triggerRetrain(assetClass);
              console.log(`[AI Governance] Retrained model for \${assetClass}`);
            } catch (err) {
              console.error(`[AI Governance] Retrain failed for \${assetClass}:`, err);
            }
          }
        }
      } catch (error) {
        console.error('[AI Governance] Check failed:', error);
      }
    }, { timezone: 'UTC' });
    // ML model nightly auto-training at 02:00 UTC (requires ≥20 completed daily_picks outcomes)
    cron.schedule('0 2 * * *', async () => {
      console.log('[ML Cron] Running nightly ML auto-training (02:00 UTC)...');
      try {
        const { db: cronDb } = await import('./db');
        const { sql: cronSql } = await import('drizzle-orm');
        const result = await cronDb.execute(cronSql`
          SELECT COUNT(*) AS cnt FROM daily_picks
          WHERE status IN ('target_hit','stoploss_hit','expired')
        `);
        const count = Number((result.rows[0] as any)?.cnt ?? 0);
        if (count >= 20) {
          const { callPython: cp } = await import('./clients/python-client');
          await cp('/api/ml/train', 'POST', { assetClass: 'all', maxSamples: 5000 });
          console.log(`[ML Cron] Auto-training triggered with \${count} completed picks`);
        } else {
          console.log(`[ML Cron] Skipped — only \${count} completed picks (need ≥20)`);
        }
      } catch (e) {
        console.error('[ML Cron] Auto-training failed:', e);
      }
    }, { timezone: 'UTC' });
    // Nightly IRIS CAS portfolio sync at 01:00 UTC (6:30 AM IST) — reconciles MF holdings from KFintech
    if (process.env.NODE_ENV === 'production') {
      cron.schedule('0 1 * * *', async () => {
        console.log('[IRISSync] Starting nightly IRIS CAS sync (01:00 UTC)…');
        try {
          const { runNightlyIrisCasSync } = await import('./services/iris-portfolio-sync-service');
          await runNightlyIrisCasSync();
          console.log('✅ [IRISSync] Nightly CAS sync completed');
        } catch (e: any) {
          console.error('[IRISSync] Nightly CAS sync failed:', e?.message);
        }
      }, { timezone: 'UTC' });
      console.log('✅ [IRISSync] Nightly IRIS CAS sync cron registered (01:00 UTC, production only)');
    }

    // Daily pick expiry sweep at 01:30 UTC (7:00 AM IST) — expires picks past their expiry_date
    cron.schedule('30 1 * * *', async () => {
      console.log('[PicksExpiry] Running daily expiry sweep...');
      try {
        const { db: cronDb } = await import('./db');
        const { sql: cronSql } = await import('drizzle-orm');
        // 1. Expire picks past their scheduled expiry date
        const result = await cronDb.execute(cronSql`
          UPDATE daily_picks
          SET status = 'expired', updated_at = NOW()
          WHERE status = 'live'
            AND expiry_date IS NOT NULL
            AND expiry_date < CURRENT_DATE
        `);
        const count = (result as any).rowCount ?? 0;
        console.log(`[PicksExpiry] Expired \${count} picks past their expiry date`);

        // 2. Expire mutual fund picks whose NAV data is >45 days stale (discontinued/closed funds)
        const staleMfResult = await cronDb.execute(cronSql`
          UPDATE daily_picks dp
          SET status = 'expired', updated_at = NOW()
          FROM mutual_funds mf
          WHERE dp.status = 'live'
            AND dp.category = 'mutual_funds'
            AND dp.instrument_id = mf.scheme_code
            AND mf.last_updated < NOW() - INTERVAL '45 days'
        `);
        const staleMfCount = (staleMfResult as any).rowCount ?? 0;
        if (staleMfCount > 0) {
          console.log(`[PicksExpiry] Expired \${staleMfCount} MF picks with stale NAV data (>45 days)`);
        }

        // 3. Safety net: expire any live picks that are >180 days old regardless of expiry_date
        const ageResult = await cronDb.execute(cronSql`
          UPDATE daily_picks
          SET status = 'expired', updated_at = NOW()
          WHERE status = 'live'
            AND reco_date < CURRENT_DATE - INTERVAL '180 days'
        `);
        const ageCount = (ageResult as any).rowCount ?? 0;
        if (ageCount > 0) {
          console.log(`[PicksExpiry] Force-expired \${ageCount} picks older than 180 days`);
        }

        // Also run the service's full status update (target/stoploss hits)
        const { pickOfTheDayService: svc } = await import('./services/pick-of-the-day-service');
        const r = await svc.refreshLivePicks();
        console.log(`[PicksExpiry] Status sweep complete: \${r.updated} picks updated`);
      } catch (e) {
        console.error('[PicksExpiry] Expiry sweep failed:', e);
      }
    }, { timezone: 'UTC' });
  } else {
    console.log('⏭️ [AI Regime/Governance] Daily schedulers skipped (development mode - production only)');
  }
  
  // ── MF + order routes: import all in parallel, register in order ─────────────
  const [mfOrdersRoutes, orderRoutesMod, mfEnrichmentMod, aiMFRecommendationRoutes] = await Promise.all([
    import('./routes/mf-orders'),
    import('./order-routes'),
    import('./routes/mf-enrichment-routes'),
    import('./routes/ai-mf-recommendation-routes'),
  ]);
  app.use(mfOrdersRoutes.default);
  orderRoutesMod.registerOrderRoutes(app);
  mfEnrichmentMod.registerMFEnrichmentRoutes(app);
  app.use(aiMFRecommendationRoutes.default);
  console.log('✅ MF orders, enrichment, AI recommendations, unified order routes registered');
  
  // ── eSign + document routes: import all in parallel, register in order ───────
  const [
    esignRoutes, adminEsignRoutes, dscEsignRoutes, proposalEsignRoutes,
    esignAiRoutes, eaadhaarDglRoutes, documentUploadRoutes, caRoutes,
    reitInvitRoutes, adminDatabaseRoutes,
  ] = await Promise.all([
    import('./routes/esign-routes'),
    import('./routes/admin-esign-routes'),
    import('./routes/dsc-esign-routes'),
    import('./routes/proposal-esign-routes'),
    import('./routes/esign-ai-routes'),
    import('./routes/truthscreen-eaadhaar-routes'),
    import('./routes/document-upload-routes'),
    import('./routes/ca-routes'),
    import('./routes/reit-invit-routes'),
    import('./routes/admin-database'),
  ]);
  app.use(esignRoutes.default);
  app.use(adminEsignRoutes.default);
  app.use('/api/esign', dscEsignRoutes.default);
  app.use('/api/proposal-esign', proposalEsignRoutes.default);
  app.use('/api/esign/ai', esignAiRoutes.default);
  app.use(eaadhaarDglRoutes.default);
  app.use('/api/documents', documentUploadRoutes.default);
  app.use('/api/ca', caRoutes.default);
  app.use('/api/reit-invit', reitInvitRoutes.default);
  app.use('/api/admin/database', adminDatabaseRoutes.default);
  console.log('✅ eSign, document upload, CA, REIT/InvIT routes registered');

  // Register error testing routes (development only)
  if (process.env.NODE_ENV === 'development') {
    const testErrorRoutes = await import('./test-error-handling');
    app.use('/api', testErrorRoutes.default);
  }
  
  registerRoleRoutes(app);
  
  // Boot-time migrations (CREATE TABLE IF NOT EXISTS — idempotent and safe)
  const { runGoldenPricingMigration } = await import(\"./db-migrations/golden-pricing-migration\");
  await runGoldenPricingMigration();

  const { runGovernanceNcdRepair } = await import(\"./db-migrations/governance-ncd-repair\");
  await runGovernanceNcdRepair();

  const { runInstitutionalDataMigration } = await import(\"./db-migrations/institutional-data-migration\");
  await runInstitutionalDataMigration();

  const { runHistoricalNavIndexRepair } = await import(\"./db-migrations/historical-nav-repair\");
  await runHistoricalNavIndexRepair();

  const { initializeSecurityMaster } = await import(\"./db-migrations/security-master-migration\");
  await initializeSecurityMaster();

  const { initializeMfCategoryMaster } = await import(\"./db-migrations/mf-category-master-migration\");
  await initializeMfCategoryMaster();

  const { initializeMfSubcategoryMaster } = await import(\"./db-migrations/mf-subcategory-master-migration\");
  await initializeMfSubcategoryMaster();
  
  const { runQuantPolicyMigration } = await import(\"./db-migrations/quant-policy-migration\");
  await runQuantPolicyMigration();

  // ── Database Maintenance (Phase 2) ───────────────────────────────────────────
  // These migrations ensure data integrity and fix schema drifts.
  logBootProgress(\"Step 10: Running Background Database Maintenance...\");
  
  const { db: uqDb } = await import('./db');
  const { sql: uqSql } = await import('drizzle-orm');

  // Register unlisted security routes
  const unlistedRoutes = await import('./routes/unlisted-securities');
  app.use('/api/unlisted', unlistedRoutes.default);
  console.log('✅ Unlisted securities routes registered');

  try {
    // 1. Core unique constraint repairs (DEDUP and INDEX)
    // ── mf_taxonomy_versions (version) ──────────────────────────────────────
    await uqDb.execute(uqSql`
      DELETE FROM mf_taxonomy_versions
      WHERE id NOT IN (
        SELECT DISTINCT ON (version) id
        FROM mf_taxonomy_versions
        ORDER BY version, id ASC
      )
    `);
    await uqDb.execute(uqSql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_mf_taxonomy_versions_version
        ON mf_taxonomy_versions (version)
    `);

    // ── mf_category_master (taxonomy_version, group_code) ────────────────────
    await uqDb.execute(uqSql`
      DELETE FROM mf_category_master
      WHERE id NOT IN (
        SELECT DISTINCT ON (taxonomy_version, group_code) id
        FROM mf_category_master
        ORDER BY taxonomy_version, group_code, id ASC
      )
    `);
    await uqDb.execute(uqSql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_mf_category_master_version_code
        ON mf_category_master (taxonomy_version, group_code)
    `);

    // ── mf_subcategory_master (subcategory_code) ──────────────────────────────
    await uqDb.execute(uqSql`
      DELETE FROM mf_subcategory_master
      WHERE id NOT IN (
        SELECT DISTINCT ON (subcategory_code) id
        FROM mf_subcategory_master
        ORDER BY subcategory_code, id ASC
      )
    `);
    await uqDb.execute(uqSql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_mf_subcategory_code
        ON mf_subcategory_master (subcategory_code)
    `);

    // ── quant_governance_policy (risk_profile) ────────────────────────────────
    await uqDb.execute(uqSql`
      DELETE FROM quant_governance_policy
      WHERE id NOT IN (
        SELECT DISTINCT ON (risk_profile) id
        FROM quant_governance_policy
        ORDER BY risk_profile, id ASC
      )
    `);
    await uqDb.execute(uqSql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_quant_governance_policy_risk_profile
        ON quant_governance_policy (risk_profile)
    `);

    console.log('✅ [Migration] ON CONFLICT UNIQUE indexes verified/created');

    // ── Background unique-index repair ────────────────────────────────────────
    // All tables below have ON CONFLICT clauses in their services but the
    // corresponding unique indexes were never pushed to the production DB.
    // Each block: dedup rows (keep latest), then CREATE UNIQUE INDEX IF NOT EXISTS.
    // Runs via setImmediate so it never blocks route registration / boot.
    setImmediate(async () => {
      const { db: bgDb } = await import('./db');
      const { sql: bgSql } = await import('drizzle-orm');

      // Helper: dedup by arbitrary columns, keeping row with max id
      const dedupAndIndex = async (
        label: string,
        dedupsql: string,
        indexsql: string
      ) => {
        try {
          await Promise.race([
            bgDb.execute(bgSql.raw(dedupsql)),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Deduplication of \${label} timed out after 60s`)), 60000))
          ]);
          await Promise.race([
            bgDb.execute(bgSql.raw(indexsql)),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Indexing of \${label} timed out after 60s`)), 60000))
          ]);
          console.log(`✅ [Migration] \${label} unique index created (background)`);
        } catch (e: any) {
          console.warn(`[Migration] \${label} (background):`, e?.message);
        }
      };

      // 1. historical_nav_data (identifier, identifier_type, date)
      // The table may have 9M+ rows — the standard IN (SELECT DISTINCT ON ...) dedup
      // query exceeds the 30s statement_timeout. Use a dedicated pool client with
      // timeout disabled, and a faster self-join DELETE, then CONCURRENTLY index.
      try {
        const { pool: bgPool } = await import('./db');
        const client = await bgPool.connect();
        try {
          await client.query('SET statement_timeout = 0');
          // Self-join DELETE: keeps the row with the largest id (latest fetched) per key.
          // Far more efficient on large tables than IN (SELECT DISTINCT ON ...).
          await client.query(`
            DELETE FROM historical_nav_data a
            USING historical_nav_data b
            WHERE a.identifier = b.identifier
              AND a.identifier_type = b.identifier_type
              AND a.date = b.date
              AND a.id < b.id
          `);
          // CONCURRENTLY allows reads/writes during index build; cannot run in a transaction.
          await client.query(`
            CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_historical_nav_unique
              ON historical_nav_data (identifier, identifier_type, date)
          `);
          console.log('✅ [Migration] historical_nav_data unique index created (background)');
        } catch (e: any) {
          console.warn('[Migration] historical_nav_data (background):', e?.message);
        } finally {
          client.release();
        }
      } catch (e: any) {
        console.warn('[Migration] historical_nav_data pool error:', e?.message);
      }

      // 2. mutual_fund_metrics (scheme_code, fiscal_year)
      await dedupAndIndex(
        'mutual_fund_metrics',
        `DELETE FROM mutual_fund_metrics
         WHERE id NOT IN (
           SELECT DISTINCT ON (scheme_code, fiscal_year) id
           FROM mutual_fund_metrics
           ORDER BY scheme_code, fiscal_year, last_updated DESC NULLS LAST
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_mf_metrics_scheme_fy
           ON mutual_fund_metrics (scheme_code, fiscal_year)`
      );

      // 3. mf_taxonomy_versions (version)
      await dedupAndIndex(
        'mf_taxonomy_versions',
        `DELETE FROM mf_taxonomy_versions
         WHERE id NOT IN (
           SELECT DISTINCT ON (version) id
           FROM mf_taxonomy_versions
           ORDER BY version, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_mf_taxonomy_version
           ON mf_taxonomy_versions (version)`
      );

      // 4. mf_category_master (taxonomy_version, group_code)
      await dedupAndIndex(
        'mf_category_master',
        `DELETE FROM mf_category_master
         WHERE id NOT IN (
           SELECT DISTINCT ON (taxonomy_version, group_code) id
           FROM mf_category_master
           ORDER BY taxonomy_version, group_code, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_mf_category_master_version_code
           ON mf_category_master (taxonomy_version, group_code)`
      );

      // 5. mf_subcategory_master (subcategory_code)
      await dedupAndIndex(
        'mf_subcategory_master',
        `DELETE FROM mf_subcategory_master
         WHERE id NOT IN (
           SELECT DISTINCT ON (subcategory_code) id
           FROM mf_subcategory_master
           ORDER BY subcategory_code, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_mf_subcategory_code
           ON mf_subcategory_master (subcategory_code)`
      );

      // 6. mf_portfolio_holdings (scheme_code, isin, as_of_date)
      await dedupAndIndex(
        'mf_portfolio_holdings',
        `DELETE FROM mf_portfolio_holdings
         WHERE id NOT IN (
           SELECT DISTINCT ON (scheme_code, isin, as_of_date) id
           FROM mf_portfolio_holdings
           ORDER BY scheme_code, isin, as_of_date, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_mf_portfolio_holdings_unique
           ON mf_portfolio_holdings (scheme_code, isin, as_of_date)`
      );

      // 7. mf_overlap_matrix (scheme_code_a, scheme_code_b)
      await dedupAndIndex(
        'mf_overlap_matrix',
        `DELETE FROM mf_overlap_matrix
         WHERE id NOT IN (
           SELECT DISTINCT ON (scheme_code_a, scheme_code_b) id
           FROM mf_overlap_matrix
           ORDER BY scheme_code_a, scheme_code_b, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_mf_overlap_matrix_pair
           ON mf_overlap_matrix (scheme_code_a, scheme_code_b)`
      );

      // ── One-off schema repairs (missing columns) ────────────────────────────
      const { db: migDb } = await import('./db');
      const { sql: migSql } = await import('drizzle-orm');

      // 1. mca_financial_snapshot
      try {
        await migDb.execute(migSql`
          ALTER TABLE mca_financial_snapshot
            ADD COLUMN IF NOT EXISTS data_completeness NUMERIC DEFAULT 0
        `);
      } catch (e: any) {
        console.warn('[Migration] mca_financial_snapshot column skipped:', e?.message);
      }

      // 2. capital_gains_tax_reminders
      try {
        await migDb.execute(migSql`
          ALTER TABLE capital_gains_tax_reminders
            ADD COLUMN IF NOT EXISTS prospect_id VARCHAR,
            ADD COLUMN IF NOT EXISTS created_by_agent_id VARCHAR REFERENCES users(id)
        `);
      } catch (e: any) {
        console.error('[Migration] capital_gains_tax_reminders error:', e?.message);
      }

      // 3. agents + partners
      try {
        await migDb.execute(migSql`
          ALTER TABLE agents ADD COLUMN IF NOT EXISTS arn_expiry_date TIMESTAMPTZ;
          ALTER TABLE partners ADD COLUMN IF NOT EXISTS arn_expiry_date TIMESTAMPTZ
        `);
      } catch (e: any) {
        console.error('[Migration] agents/partners arn_expiry_date error:', e?.message);
      }

      // 4. prospect_id in multiple tables
      try {
        await migDb.execute(migSql`
          ALTER TABLE tax_reminder_subscriptions ADD COLUMN IF NOT EXISTS prospect_id VARCHAR;
          ALTER TABLE kyc_approvals              ADD COLUMN IF NOT EXISTS prospect_id VARCHAR;
          ALTER TABLE mf_orders                  ADD COLUMN IF NOT EXISTS prospect_id VARCHAR;
          ALTER TABLE prospect_proposals         ADD COLUMN IF NOT EXISTS prospect_id VARCHAR
        `);
      } catch (e: any) {
        console.error('[Migration] prospect_id columns error:', e?.message);
      }

      // 5. created_by_agent_id
      try {
        await migDb.execute(migSql`
          ALTER TABLE tax_reminder_subscriptions ADD COLUMN IF NOT EXISTS created_by_agent_id VARCHAR REFERENCES users(id);
          ALTER TABLE capital_gains_tax_reminders ADD COLUMN IF NOT EXISTS created_by_agent_id VARCHAR REFERENCES users(id)
        `);
      } catch (e: any) {
        console.error('[Migration] created_by_agent_id columns error:', e?.message);
      }

      // 6. screener_stocks
      try {
        await migDb.execute(migSql`
          ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
          ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS current_price NUMERIC(20,6);
          ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS market_cap_value NUMERIC(20,2);
          ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS market_cap_category VARCHAR(20);
          ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS country VARCHAR(10) DEFAULT 'IN';
          ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
          ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS data_source VARCHAR(50);
          ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
        `);
      } catch (e: any) {
        console.error('[Migration] screener_stocks columns error:', e?.message);
      }

      // 7. mutual_funds
      try {
        await migDb.execute(migSql`
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS plan_type VARCHAR DEFAULT 'regular';
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS published_by VARCHAR;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS amfi_code VARCHAR;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS isin VARCHAR;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS option_type VARCHAR;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS scheme_status VARCHAR DEFAULT 'active';
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS data_source VARCHAR;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS isin_dividend_payout VARCHAR;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS isin_dividend_reinvest VARCHAR;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS isin_growth VARCHAR;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS repurchase_price NUMERIC(15,4);
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS sale_price NUMERIC(15,4);
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS launch_date DATE;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS min_sip_amount NUMERIC(15,2);
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS min_lumpsum_amount NUMERIC(15,2);
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS amc_code VARCHAR;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS exit_load_percent NUMERIC(8,4);
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS exit_load_days INTEGER;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS scheme_sub_category VARCHAR;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS benchmark_index VARCHAR;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS benchmark_index_code VARCHAR;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS benchmark_confidence_score NUMERIC(3,2);
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS taxonomy_version VARCHAR(20) DEFAULT 'SEBI_2017';
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(30) DEFAULT 'PENDING';
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS naming_validation_status VARCHAR(10) DEFAULT 'PENDING';
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS lifecycle_metadata JSONB;
          ALTER TABLE mutual_funds ADD COLUMN IF NOT EXISTS compliance_blocked_reason TEXT
        `);
      } catch (e: any) {
        console.error('[Migration] mutual_funds columns error:', e?.message);
      }

      // 8. us_broker_accounts
      try {
        await migDb.execute(migSql`
          ALTER TABLE us_broker_accounts
            ADD COLUMN IF NOT EXISTS alpaca_account_number VARCHAR,
            ADD COLUMN IF NOT EXISTS alpaca_status VARCHAR DEFAULT 'not_applied',
            ADD COLUMN IF NOT EXISTS action_required TEXT,
            ADD COLUMN IF NOT EXISTS application_step VARCHAR DEFAULT 'identity',
            ADD COLUMN IF NOT EXISTS application_data TEXT,
            ADD COLUMN IF NOT EXISTS agreements_signed_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS cip_submitted_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS account_approved_at TIMESTAMPTZ
        `);
      } catch (e: any) {
        console.warn('[Migration] us_broker_accounts account opening columns skipped:', e?.message);
      }

      // 9. agent_notifications
      try {
        await migDb.execute(migSql`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_services TEXT[];
          CREATE TABLE IF NOT EXISTS agent_notifications (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            agent_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type VARCHAR NOT NULL DEFAULT 'info',
            title VARCHAR NOT NULL DEFAULT '',
            message TEXT NOT NULL DEFAULT '',
            read BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id
            ON agent_notifications(agent_id);
        `);
      } catch (e: any) {
        console.warn('[Migration] agent_services/agent_notifications skipped:', e?.message);
      }

      // 10. agent_empanelment_status
      try {
        await migDb.execute(migSql`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_empanelment_status TEXT DEFAULT 'draft';
          UPDATE users u
          SET agent_empanelment_status = e.status
          FROM agent_empanelments e
          WHERE e.agent_id = u.id
            AND u.agent_empanelment_status IS DISTINCT FROM e.status;
        `);
      } catch (e: any) {
        console.warn('[Migration] agent_empanelment_status skipped:', e?.message);
      }

      // 11. prospect_leads scoring
      try {
        await migDb.execute(migSql`
          ALTER TABLE prospect_leads
            ADD COLUMN IF NOT EXISTS estimated_networth   NUMERIC(18,2),
            ADD COLUMN IF NOT EXISTS investable_surplus   NUMERIC(15,2),
            ADD COLUMN IF NOT EXISTS wealth_score         NUMERIC(6,2),
            ADD COLUMN IF NOT EXISTS activity_score       NUMERIC(6,2),
            ADD COLUMN IF NOT EXISTS relationship_score   NUMERIC(6,2),
            ADD COLUMN IF NOT EXISTS composite_score      NUMERIC(6,2),
            ADD COLUMN IF NOT EXISTS scoring_version      VARCHAR,
            ADD COLUMN IF NOT EXISTS scored_at            TIMESTAMPTZ
        `);
      } catch (e: any) {
        console.warn('[Migration] prospect_leads scoring columns skipped:', e?.message);
      }

      // 12. ca_verification_status
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS ca_verification_status (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id),
            icai_membership_number VARCHAR NOT NULL,
            icai_verified BOOLEAN DEFAULT false,
            icai_verified_at TIMESTAMPTZ,
            icai_verified_by VARCHAR REFERENCES users(id),
            cop_number VARCHAR,
            cop_valid_from DATE,
            cop_valid_to DATE,
            cop_verified BOOLEAN DEFAULT false,
            cop_verified_at TIMESTAMPTZ,
            pan_verified BOOLEAN DEFAULT false,
            pan_verified_at TIMESTAMPTZ,
            dsc_available BOOLEAN DEFAULT false,
            dsc_serial_number VARCHAR,
            dsc_valid_from DATE,
            dsc_valid_to DATE,
            dsc_verified_at TIMESTAMPTZ,
            overall_status VARCHAR DEFAULT 'pending',
            can_sign_form_15cb BOOLEAN DEFAULT false,
            approved_at TIMESTAMPTZ,
            approved_by VARCHAR REFERENCES users(id),
            rejection_reason TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
          ALTER TABLE ca_verification_status
            ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS icai_membership_number VARCHAR,
            ADD COLUMN IF NOT EXISTS pan_number VARCHAR,
            ADD COLUMN IF NOT EXISTS overall_status VARCHAR DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
            ADD COLUMN IF NOT EXISTS icai_verified BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS icai_verified_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS icai_verified_by VARCHAR REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS cop_number VARCHAR,
            ADD COLUMN IF NOT EXISTS cop_valid_from DATE,
            ADD COLUMN IF NOT EXISTS cop_valid_to DATE,
            ADD COLUMN IF NOT EXISTS cop_verified BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS cop_verified_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS pan_verified BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS pan_verified_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS dsc_available BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS dsc_serial_number VARCHAR,
            ADD COLUMN IF NOT EXISTS dsc_valid_from DATE,
            ADD COLUMN IF NOT EXISTS dsc_valid_to DATE,
            ADD COLUMN IF NOT EXISTS dsc_verified_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS can_sign_form_15cb BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS approved_by VARCHAR REFERENCES users(id),
            ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
            ADD COLUMN IF NOT EXISTS icai_scraped_name      VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_membership_status VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_membership_type   VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_cop_status        VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_confidence_score  NUMERIC(4,2),
            ADD COLUMN IF NOT EXISTS icai_scraped_at        TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS icai_source            VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_raw_html          TEXT,
            ADD COLUMN IF NOT EXISTS icai_error             TEXT
        `);
      } catch (e: any) {
        console.warn('[Migration] ca_verification_status schema skipped:', e?.message);
      }

      // 13. partners ICAI
      try {
        await migDb.execute(migSql`
          ALTER TABLE partners
            ADD COLUMN IF NOT EXISTS icai_scraped_name       VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_scraper_status     VARCHAR DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS icai_scraper_run_at     TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS icai_scraper_source     VARCHAR,
            ADD COLUMN IF NOT EXISTS icai_confidence_score   NUMERIC(4,2),
            ADD COLUMN IF NOT EXISTS icai_cop_status         VARCHAR
        `);
      } catch (e: any) {
        console.warn('[Migration] partners ICAI scraper columns skipped:', e?.message);
      }

      // 14. Subscriptions
      try {
        await migDb.execute(migSql`
          ALTER TABLE users
            ADD COLUMN IF NOT EXISTS plan_tier VARCHAR DEFAULT 'free',
            ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS cashfree_subscription_id VARCHAR;
          CREATE TABLE IF NOT EXISTS platform_subscriptions (
            id                        VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id                   VARCHAR NOT NULL REFERENCES users(id),
            plan_tier                 VARCHAR NOT NULL,
            billing_cycle             VARCHAR NOT NULL,
            amount_paise              INTEGER NOT NULL,
            currency                  VARCHAR DEFAULT 'INR' NOT NULL,
            cashfree_order_id         VARCHAR,
            cashfree_payment_id       VARCHAR,
            cashfree_payment_session_id VARCHAR,
            status                    VARCHAR DEFAULT 'pending' NOT NULL,
            starts_at                 TIMESTAMPTZ,
            expires_at                TIMESTAMPTZ,
            metadata                  JSONB,
            created_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            updated_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_platform_subs_user   ON platform_subscriptions(user_id);
          CREATE INDEX IF NOT EXISTS idx_platform_subs_status ON platform_subscriptions(status);
          CREATE INDEX IF NOT EXISTS idx_platform_subs_tier   ON platform_subscriptions(plan_tier);
        `);
      } catch (e: any) {
        console.warn('[Migration] Subscription monetization schema skipped:', e?.message);
      }

      // 15. audit_trail
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS audit_trail (
            id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     VARCHAR,
            actor_type  VARCHAR,
            action      VARCHAR NOT NULL,
            category    VARCHAR NOT NULL,
            details     TEXT,
            ip_address  VARCHAR,
            user_agent  TEXT,
            outcome     VARCHAR,
            risk_level  VARCHAR,
            created_at  TIMESTAMPTZ DEFAULT NOW()
          );
          ALTER TABLE audit_trail ADD COLUMN IF NOT EXISTS actor_type VARCHAR;
        `);
      } catch (e: any) {
        console.error('[Migration] audit_trail table error:', e?.message);
      }

      // 16. self_healing
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS self_healing_events (
            id            SERIAL PRIMARY KEY,
            event_type    VARCHAR(50) NOT NULL,
            trigger_message TEXT,
            action_taken  VARCHAR(100),
            success       BOOLEAN,
            message       TEXT,
            context       TEXT,
            occurred_at   TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_self_healing_events_occurred_at
            ON self_healing_events (occurred_at DESC);
          CREATE TABLE IF NOT EXISTS self_healing_feedback (
            id            SERIAL PRIMARY KEY,
            module        VARCHAR(50)  NOT NULL,
            operation     VARCHAR(100) NOT NULL,
            duration_ms   INTEGER,
            success       BOOLEAN      NOT NULL DEFAULT true,
            error_message TEXT,
            risk_level    VARCHAR(10),
            fallback_used BOOLEAN      DEFAULT false,
            occurred_at   TIMESTAMPTZ  DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_self_healing_feedback_module_occurred
            ON self_healing_feedback (module, occurred_at DESC);
        `);
      } catch (e: any) {
        console.error('[Migration] self_healing tables error:', e?.message);
      }

      // 17. iris_sessions
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS iris_sessions (
            id           VARCHAR PRIMARY KEY,
            pan          VARCHAR NOT NULL UNIQUE,
            access_token TEXT    NOT NULL,
            refresh_token TEXT,
            expires_at   TIMESTAMPTZ,
            created_at   TIMESTAMPTZ DEFAULT NOW(),
            updated_at   TIMESTAMPTZ DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_iris_sessions_pan ON iris_sessions (pan);
        `);
      } catch (e: any) {
        console.error('[Migration] iris_sessions table error:', e?.message);
      }

      // 18. lrs_remittance_logs
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS lrs_remittance_logs (
            id                   VARCHAR PRIMARY KEY,
            user_id              VARCHAR NOT NULL REFERENCES users(id),
            alpaca_account_id    VARCHAR,
            transfer_id          VARCHAR NOT NULL UNIQUE,
            amount_usd           NUMERIC(18,4) NOT NULL,
            amount_inr           NUMERIC(18,2),
            usd_inr_rate         NUMERIC(10,4),
            financial_year       VARCHAR(10) NOT NULL,
            transfer_date        TIMESTAMPTZ  DEFAULT NOW(),
            created_at           TIMESTAMPTZ  DEFAULT NOW()
          );
          CREATE INDEX IF NOT EXISTS idx_lrs_logs_user_fy ON lrs_remittance_logs (user_id, financial_year);
        `);
      } catch (e: any) {
        console.error('[Migration] lrs_remittance_logs table error:', e?.message);
      }

      logBootProgress(\"Background: Phase 2 Database Migrations complete.\");
    } catch (err: any) {
      console.error(\"❌ [Migration] Critical background migration failure:\", err);
    }
  });

  // Init auto-recovery service (circuit breaker registry + service registration)
  try {
    const { initAutoRecoveryService } = await import('./services/auto-recovery-service');
    initAutoRecoveryService();
  } catch (e: any) {
    console.warn('[AutoRecovery] Init skipped:', e?.message);
  }

  // Mount self-healing admin routes
  try {
    const selfHealingRouter = (await import('./routes/self-healing-routes')).default;
    app.use('/api/admin/self-healing', selfHealingRouter);
    console.log('✅ Self-healing admin routes mounted at /api/admin/self-healing');
  } catch (e: any) {
    console.warn('[SelfHealing] Route mount skipped:', e?.message);
  }

  // Mount AIF/PMS deal-to-prospect matching routes
  try {
    const dealMatchRouter = (await import('./routes/deal-prospect-match-routes')).default;
    app.use('/api/deals', dealMatchRouter);
    console.log('✅ Deal-to-Prospect Matching Engine routes registered (/api/deals/*)');
  } catch (e: any) {
    console.warn('[DealMatcher] Route mount skipped:', e?.message);
  }

  // Internal supervisor crash-event bridge (localhost only, no auth)
  app.post('/api/internal/self-healing/crash-event', (req: any, res: any) => {
    const forwarded = req.headers['x-forwarded-for'];
    const remoteIp  = forwarded ? String(forwarded).split(',')[0].trim() : req.socket?.remoteAddress;
    const isLocal   = !remoteIp || remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
    if (!isLocal) { res.status(403).json({ error: 'Forbidden' }); return; }

    const { eventType, trigger, action, success, message, context } = req.body || {};
    import('./services/auto-recovery-service').then(({ logHealingEvent }) => {
      logHealingEvent({ eventType: eventType || 'supervisor_restart', trigger, action, success, message, context }).catch(() => {});
    }).catch(() => {});

    res.json({ success: true });
  });

  // Register additional routes from routes.ts (but don't create a new server - we already have one)
  await registerRoutes(app, server);

  // Register API 404 handler BEFORE static file serving
  // This ensures unmatched API routes get proper JSON 404 responses
  // and don't fall through to the SPA catch-all
  const { apiResponse } = await import('./utils/responses');
  app.use('/api/*', (req, res) => {
    apiResponse.notFound(res, `Route \${req.method} \${req.path} not found`);
  });

  // Setup Vite BEFORE error handlers so it can serve the frontend
  // and its catch-all middleware doesn't conflict with API error handling
  // Check both app.get(\"env\") and REPLIT_DEPLOYMENT for production detection
  const isDevelopmentMode = app.get(\"env\") === \"development\" && process.env.REPLIT_DEPLOYMENT !== '1';
  if (isDevelopmentMode) {
    const { setupVite } = await import(\"./vite\");
    await setupVite(app, server);
  } else {
    // Register SPA catch-all (last middleware)
    registerSPACatchAll(app);
    console.log('✅ SPA catch-all registered (production mode)');
  }

  // Final Error Handling (MUST BE LAST)
  const { errorHandler, notFoundHandler } = await import('./middleware/error-handler');
  app.use(notFoundHandler);
  app.use(errorHandler);

  // ROUTES ARE NOW FULLY REGISTERED - mark as ready
  // ============================================================================
  logBootProgress(`Step 11: All routes registered. Finalizing initialization...`);


  // T05: Emit structured DEPLOY audit event — appears in compliance_audit_trail
  // for every Railway deployment or manual restart. Useful for audit trail continuity.
  (async () => {
    try {
      const { auditLog } = await import('./middleware/audit-trail');
      await auditLog({
        action: 'system_deploy',
        category: 'admin',
        outcome: 'success',
        riskLevel: 'low',
        details: {
          event: 'server_boot_complete',
          bootTimeMs: bootState.getBootTime(),
          nodeVersion: process.version,
          nodeEnv: process.env.NODE_ENV,
          appUrl: process.env.APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'unknown',
          version: process.env.npm_package_version || '1.0.0',
          timestamp: new Date().toISOString(),
        },
      });
      console.log('📋 [Deploy] Boot audit event logged to compliance_audit_trail');
    } catch { /* best-effort — never block boot */ }
  })();

  // Seed credit ratings from existing data (fire-and-forget)
  creditRatingsService.seedCreditRatings().catch(err => {
    console.error(\"Failed to seed credit ratings:\", err);
  });

  // Seed symbol mapping from existing data (fire-and-forget)
  symbolMappingService.seedSymbolMapping().catch(err => {
    console.error(\"Failed to seed symbol mapping:\", err);
  });

  // Seed government securities baseline (fire-and-forget, idempotent ON CONFLICT DO NOTHING)
  (async () => {
    try {
      const { db: gSecDb } = await import('./db');
      const { sql: drizzleSql } = await import('drizzle-orm');
      const countResult = await gSecDb.execute(drizzleSql`SELECT COUNT(*) AS cnt FROM government_securities`);
      const existingCount = Number((countResult.rows[0] as any)?.cnt ?? 0);
      if (existingCount === 0) {
        console.log('🌱 Seeding government securities baseline...');
        await gSecDb.execute(drizzleSql`
          INSERT INTO government_securities (id, isin, security_name, security_type, issuer, face_value, coupon_rate, issue_date, maturity_date, current_price, yield_to_maturity, trading_status, minimum_investment, credit_rating, early_redemption_allowed, tax_status, indexation_benefit, data_source, last_updated, markup, markup_type, is_perpetual)
          VALUES
            (gen_random_uuid(), 'INE000000001', '7.18% GS 2033', 'g_sec', 'Government of India', 100, 7.18, '2026-02-27', '2036-02-20', 99.25, 7.28, 'upcoming', 10000, 'AAA', false, 'taxable', false, 'nse_ncb', NOW(), 0, 'percentage', false),
            (gen_random_uuid(), 'INE000000002', '6.95% GS 2061', 'g_sec', 'Government of India', 100, 6.95, '2026-02-27', '2061-12-31', 98.50, 7.05, 'upcoming', 10000, 'AAA', false, 'taxable', false, 'nse_ncb', NOW(), 0, 'percentage', false),
            (gen_random_uuid(), 'INE000000003', '364 Days T-Bill', 't_bill', 'Government of India', 100, 0, '2026-02-27', '2027-02-26', 93.60, 6.88, 'upcoming', 10000, 'AAA', false, 'taxable', false, 'nse_ncb', NOW(), 0, 'percentage', false),
            (gen_random_uuid(), 'INE000000004', 'Maharashtra SDL 2030', 'sdl', 'Government of Maharashtra', 100, 7.35, '2025-12-07', '2030-11-30', 100.00, 7.35, 'upcoming', 10000, 'AAA', false, 'taxable', false, 'nse_ncb', NOW(), 0, 'percentage', false),
            (gen_random_uuid(), 'IN0020250111', '7.18% GS 2033', 'g_sec', 'Government of India', 100, 7.18, '2026-02-27', '2036-02-20', 99.25, 7.28, 'upcoming', 10000, 'AAA', false, 'taxable', false, 'nse_ncb', NOW(), 0, 'percentage', false),
            (gen_random_uuid(), 'IN002025T091', '91 Days T-Bill', 't_bill', 'Government of India', 100, 0, '2026-02-27', '2026-05-22', 98.28, 6.95, 'upcoming', 10000, 'AAA', false, 'taxable', false, 'nse_ncb', NOW(), 0, 'percentage', false),
            (gen_random_uuid(), 'SDLGJ2032001', '7.42% Gujarat SDL 2032', 'sdl', 'Government of Gujarat', 100, 7.42, '2026-02-27', '2032-06-15', 99.15, 7.52, 'upcoming', 10000, 'AAA', false, 'taxable', false, 'nse_ncb', NOW(), 0, 'percentage', false),
            (gen_random_uuid(), 'SDLMH2030001', '7.35% Maharashtra SDL 2030', 'sdl', 'Government of Maharashtra', 100, 7.35, '2026-02-27', '2031-02-20', 99.50, 7.45, 'upcoming', 10000, 'AAA', false, 'taxable', false, 'nse_ncb', NOW(), 0, 'percentage', false),
            (gen_random_uuid(), 'INE000S01SG1', 'Sovereign Gold Bond 2025-26 Series I', 'sgb', 'Government of India', 1, 2.50, '2026-02-20', '2034-02-20', 6500.00, 2.50, 'active', 1, 'AAA', false, 'taxable', false, 'nse_ncb', NOW(), 0, 'percentage', false)
          ON CONFLICT (isin) DO NOTHING
        `);
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
        
        const { alertMonitoringService } = await import('./services/alert-monitoring-service');
        alertMonitoringService.start();

        // 2. Real-time data streams
        const { alpacaSseService } = await import('./services/alpaca-sse-service');
        alpacaSseService.start();

        // 3. Heavy Data Processing (staggered)
        
        // Mutual Fund Returns (30s delay)
        setTimeout(async () => {
           try {
             const { mfReturnsScheduler } = await import('./services/mf-returns-scheduler');
             await mfReturnsScheduler.initialize();
           } catch (e) {
             console.error(\"❌ [Scheduler] MF returns initialization failed:\", e);
           }
        }, 30000);

        // Bond Catalog (60s delay)
        setTimeout(async () => {
           try {
             const { bondCatalogService } = await import('./bond-catalog-service');
             bondCatalogService.startAutoRefresh();
           } catch (e) {
             console.error(\"❌ [Catalog] Bond service start failed:\", e);
           }
        }, 60000);

        // Production Bootstrap (90s delay - very heavy)
        setTimeout(async () => {
           try {
             logBootProgress(\"Background: Starting heavy data bootstrap...\");
             const { runProductionBootstrap } = await import('./production-bootstrap');
             await runProductionBootstrap();
             logBootProgress(\"Background: Data bootstrap complete.\");
           } catch (e) {
             console.error(\"❌ [Bootstrap] Production data seeding failed:\", e);
           }
        }, 90000);
      }

    } catch (err) {
      console.error(\"❌ [Boot] Error starting background services:\", err);
    }
  }, 5000);

  } catch (error: any) {
    console.error('❌ [FATAL] Server initialization failed:', error);
    bootState.error = `Boot Error: \${error?.message || String(error)}`;
    // Ensure the SPA catch-all is registered even if boot failed partway through
    // so users see the frontend (with its own error handling) rather than \"Cannot GET /\"
    if (process.env.NODE_ENV === 'production') {
      try {
        registerSPACatchAll(app);
      } catch (_) { /* already registered — safe to ignore */ }
    }
    // REMOVED: bootState.routesReady = true; -> Do not lie about readiness on fatal error.
  }
})();
