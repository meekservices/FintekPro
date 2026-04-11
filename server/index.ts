// FintekPro Server - Main entry point

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

import path from "path";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { validationResult } from "express-validator";
import { registerRoutes } from "./routes";
import { registerRoleRoutes } from "./role-routes";
import { setupVite, serveStatic, log as viteLog } from "./vite";
import { logger } from "./logger";
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
import "./services/sms-service"; // Initialize SMS service
import { registerAuthEventConsumers } from "./services/auth-event-consumers";

// Global boot state - tracks server initialization progress
export const bootState = {
  serverListening: false,
  authReady: false,
  routesReady: false,
  cronJobsReady: false,
  startTime: Date.now(),
  getBootTime: () => Date.now() - bootState.startTime,
  isFullyReady: () => bootState.serverListening && bootState.authReady && bootState.routesReady
};

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

// Environment validation for production readiness
const requiredEnvVars = ['PRODUCTION_DATABASE_URL', 'SESSION_SECRET'];
const optionalButRecommended = ['OPENAI_API_KEY', 'TWILIO_ACCOUNT_SID', 'CASHFREE_APP_ID'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ FATAL: Required environment variable ${envVar} is not set`);
    process.exit(1);
  }
}

if (process.env.NODE_ENV === 'production') {
  const missingOptional = optionalButRecommended.filter(v => !process.env[v]);
  if (missingOptional.length > 0) {
    console.warn(`⚠️ Recommended env vars not set: ${missingOptional.join(', ')}`);
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
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'", "https://*.railway.app"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  frameguard: process.env.NODE_ENV === 'development' ? false : { action: "sameorigin" }
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
  "https://fintekpro.com",
  "https://www.fintekpro.com",
  "https://admin.fintekpro.com",
  "https://agent.fintekpro.com",
  "https://partner.fintekpro.com",
];
if (!isProduction) {
  corsAllowedOrigins.push(
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://admin.localhost:5000",
    "http://agent.localhost:5000",
    "http://partner.localhost:5000"
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
    
    // Allow Railway domains
    const isRailwayOrigin = origin.endsWith('.railway.app') ||
        origin.endsWith('.up.railway.app');

    if (isRailwayOrigin) {
      return callback(null, true);
    }
    
    // Allow fintekpro subdomains dynamically
    const isFintekProOrigin = origin.endsWith('.fintekpro.com') || origin === 'https://fintekpro.com';
    if (isFintekProOrigin) {
      return callback(null, true);
    }
    
    // Block unknown origins in production with detailed logging
    if (isProduction) {
      logger.warn(`[CORS] Blocked request from unknown origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'), false);
    }
    
    // In development, allow all origins for testing
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "Cache-Control", "X-CSRF-Token"]
}));

// Rate limiting with proper proxy configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Limit each IP to 5000 requests per windowMs (increased for SPA with multiple concurrent API calls and retries)
  message: { message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip proxy configuration here - handled by app.set('trust proxy', 1)
  skip: (req) => {
    // Skip rate limiting for health checks and static assets
    return req.path.includes('/health') || req.path.includes('/static')
  }
});

app.use("/api", limiter);

// Stricter rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth requests per windowMs
  message: { message: "Too many authentication attempts, please try again later." },
  skipSuccessfulRequests: true,
  // Skip proxy configuration here - handled by app.set('trust proxy', 1)
});

app.use(["/api/login", "/api/register"], authLimiter);

// Raw body capture for webhook signature verification (Cashfree and PhonePe)
app.use('/api/payments/cashfree/webhook', express.raw({ type: 'application/json' }));
app.use('/api/payments/phonepe/callback', express.json({
  limit: "10mb",
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Raw body capture for Zoho webhook signature verification
app.use('/api/zoho/webhooks', express.json({
  limit: "10mb",
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Raw body capture for Sandbox.co.in webhook signature verification
app.use('/api/webhooks/sandbox', express.json({
  limit: "10mb",
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

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
    logger.warn(`[URL] Failed to decode malformed URL: ${req.url}`);
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
      allowedOrigins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
    }
    
    if (!isProduction) {
      allowedOrigins.push('http://localhost:5000', 'http://127.0.0.1:5000');
    }
    
    const requestOrigin = origin || (referer ? new URL(referer).origin : null);
    
    const isRailwayRequest = requestOrigin
      ? requestOrigin.endsWith('.railway.app') || requestOrigin.endsWith('.up.railway.app')
      : false;

    if (requestOrigin && !isRailwayRequest && !allowedOrigins.some(allowed => requestOrigin.startsWith(allowed.replace(/\/$/, '')))) {
      logger.warn(`[CSRF] Blocked request from: ${requestOrigin}`);
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
      logger.warn(`[CSRF] Token mismatch for user ${(req.session as any).user?.id}`);
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
      message: "Validation failed",
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
    return res.redirect(301, `https://www.${customDomain}${req.originalUrl}`);
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

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      if (isProduction && path === '/api/health') return;
      logger.http(req.method, path, res.statusCode, duration, capturedJsonResponse ? { response: capturedJsonResponse } : undefined);
    }
  });

  next();
});

// ============================================================================
// IMMEDIATE HEALTH CHECK HANDLERS - registered synchronously BEFORE async init
// These ensure the server responds to health checks as soon as server.listen() fires,
// even while route registration is still in progress inside the async IIFE.
// ============================================================================

// Root / handler for deployment health checks
app.get('/', (req: Request, res: Response, next: NextFunction) => {
  if (bootState.routesReady) {
    return next();
  }
  res.status(200).set({ 'Content-Type': 'text/html' }).send(
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>FintekPro</title>' +
    '<meta http-equiv="refresh" content="5"></head><body>' +
    '<p>Loading FintekPro...</p></body></html>'
  );
});

// /api/health - always returns 200 as long as process is running
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: bootState.isFullyReady() ? 'ok' : 'booting',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    bootTime: bootState.getBootTime(),
    ready: bootState.isFullyReady()
  });
});
app.head('/api/health', (_req: Request, res: Response) => {
  res.status(200).end();
});

// /health - simple health check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// /healthz - supervisor/orchestrator health check (Railway, Kubernetes, self-healing supervisor)
app.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

// ============================================================================
// IMMEDIATE SERVER START - Create and listen SYNCHRONOUSLY before any async work
// This ensures health checks respond within Replit's 5-second deployment timeout
// ============================================================================
import { createServer } from 'http';

const server = createServer(app);
const PORT = parseInt(process.env.PORT || '5000', 10);

// Boot-in-progress middleware - returns 503 for API routes not yet loaded
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (bootState.routesReady) return next();
  if (req.path === '/api/health' || req.path === '/api/ready' || req.path === '/health' || req.path === '/ready') return next();
  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/login') || req.path.startsWith('/api/user')) return next();
  if (req.path === '/api/csrf-token') return next();
  res.status(503).json({
    status: 'booting',
    message: 'Server is starting up, please wait a moment and refresh...',
    bootTime: bootState.getBootTime(),
    retryAfter: 5
  });
});

setupGracefulShutdown(server);

// Start listening IMMEDIATELY - before ANY async initialization
// reusePort: true (SO_REUSEPORT) lets a new instance bind even if the old one
// is still holding the port during a supervisor restart — no fuser/lsof needed.
server.listen({ port: PORT, host: '0.0.0.0', reusePort: true }, () => {
  bootState.serverListening = true;
  console.log(`🚀 Server listening on port ${PORT} (boot time: ${bootState.getBootTime()}ms)`);
  logger.info(`Server listening on port ${PORT}`, { port: PORT, environment: process.env.NODE_ENV || 'development', bootTime: bootState.getBootTime() });
});

(async () => {
  // Python analytics micro-service (Railway private network or public URL via PYTHON_SERVICE_URL).
  // Log the configured URL so it's visible in every boot.
  const pyUrl = process.env.PYTHON_SERVICE_URL;
  if (pyUrl) {
    console.log(`ℹ️  [Python] Using external service at ${pyUrl}`);
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

  // Extended health check endpoints
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
  app.get('/live', livenessCheck);
  
  // Initialize authentication (Passport & sessions must be set up first)
  await setupSessionAuth(app);
  
  // Then add local email/mobile authentication routes
  setupLocalAuth(app);
  
  // Auth is now ready
  bootState.authReady = true;
  console.log(`✅ Auth ready (${bootState.getBootTime()}ms)`);

  // Register auth event consumers (structured logging + high-risk DB persistence)
  registerAuthEventConsumers();
  
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
  
  // Continue registering routes asynchronously (server is already listening)
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

  // Register Python Analytics Service proxy (proxies to PYTHON_SERVICE_URL when set)
  const pythonProxyRoutes = await import('./routes/python-proxy');
  app.use(pythonProxyRoutes.default);
  console.log(`✅ Python Analytics Service proxy registered${process.env.PYTHON_SERVICE_URL ? ` → ${process.env.PYTHON_SERVICE_URL}` : ' (stub — set PYTHON_SERVICE_URL to activate)'}`);
  
  // ── KYC, marketing, user management: import all in parallel ─────────────────
  const [
    kycVaultMod, marketingMod, adminProspectsMod, twilioWebhookMod,
    credhiveAnalyticsMod, userMgmtMod, stakeholderMod, autoPopMod,
  ] = await Promise.all([
    import('./kyc-vault-routes'),
    import('./marketing-routes'),
    import('./routes/admin-prospects'),
    import('./services/twilio-webhook-service'),
    import('./routes/credhive-analytics-routes'),
    import('./user-management-routes'),
    import('./stakeholder-routes'),
    import('./auto-population-routes'),
  ]);
  kycVaultMod.registerKYCVaultRoutes(app);
  // Initialize Zoho Campaigns using shared refresh token (non-blocking)
  import('./zoho-campaigns-service').then(m => m.initZohoCampaignsService()).catch(() => {});
  marketingMod.registerMarketingRoutes(app);
  adminProspectsMod.registerAdminProspectRoutes(app);
  app.use('/api/twilio', twilioWebhookMod.createTwilioWebhookRouter());
  app.use('/api/admin/analytics', credhiveAnalyticsMod.default);
  userMgmtMod.registerUserManagementRoutes(app);
  stakeholderMod.registerStakeholderRoutes(app);
  app.use('/api/auto-population', autoPopMod.autoPopulationRouter);
  console.log('✅ KYC, marketing, prospect, user management routes registered');
  
  // ── Marketplace routes: import all in parallel, register in order ────────────
  const [
    unlistedRoutes, complianceRoutes, bondMarketplaceRoutes, bondSeedAdminRoutes,
    goldAdminRoutes, bondMarketplaceImprovements, bondCalendarRoutes,
  ] = await Promise.all([
    import('./routes/unlisted'),
    import('./routes/compliance'),
    import('./routes/bond-marketplace'),
    import('./routes/bond-seed-admin'),
    import('./routes/gold-admin'),
    import('./routes/bond-marketplace-improvements'),
    import('./routes/bond-calendar-routes'),
  ]);
  app.use('/api/unlisted', unlistedRoutes.default);
  app.use('/api/compliance', complianceRoutes.default);

  // Regulatory Audit Norms — centralised SEBI/AMFI/PMLA/RBI norm definitions + health checks
  const { default: regulatoryAuditNormsRoutes } = await import('./routes/regulatory-audit-norms-routes');
  app.use('/api/admin/regulatory-audit', regulatoryAuditNormsRoutes);
  console.log('✅ Regulatory Audit Norms routes registered (/api/admin/regulatory-audit/*)');

  app.use('/api/bonds', bondMarketplaceRoutes.default);
  app.use('/api/admin/bond-seed', bondSeedAdminRoutes.default);
  app.use('/api/migration', bondSeedAdminRoutes.migrationRouter);
  app.use('/api/admin/gold', goldAdminRoutes.default);
  app.use('/api/bonds', bondMarketplaceImprovements.default);
  app.use('/api/bond-calendar', bondCalendarRoutes.default);
  
  // Initialize Financial Calendar Service
  import('./services/financial-calendar-service').then(({ financialCalendarService }) => {
    financialCalendarService.initialize().catch(err => {
      console.error('Failed to initialize financial calendar service:', err);
    });
  });
  
  // ── Commission, regulatory, ISIN, picks, AI alpha: import all in parallel ───
  const [
    commissionConfigRoutes, regulatoryFrameworkRoutes, isinIntelligenceRoutes,
    pickOfTheDayRoutes, pickOfTheDayMod, enrichmentGuardMod,
    aiAlphaEngineRoutes, cron,
  ] = await Promise.all([
    import('./commission-config-routes'),
    import('./routes/regulatory-framework-routes'),
    import('./routes/isin-intelligence'),
    import('./routes/pick-of-the-day'),
    import('./services/pick-of-the-day-service'),
    import('./utils/enrichment-guard'),
    import('./routes/ai-alpha-engine'),
    import('node-cron'),
  ]);
  app.use('/api/admin', commissionConfigRoutes.default);
  app.use('/api/regulatory', regulatoryFrameworkRoutes.default);
  app.use('/api/isin', isinIntelligenceRoutes.default);
  app.use('/api/picks', pickOfTheDayRoutes.default);
  app.use('/api/ai', aiAlphaEngineRoutes.default);
  const { pickOfTheDayService } = pickOfTheDayMod;
  const { isProductionEnvironment } = enrichmentGuardMod;
  if (isProductionEnvironment()) {
    setTimeout(() => pickOfTheDayService.startDailyScheduler(), 60000);
  } else {
    console.log('⏭️ [PickOfTheDay] Daily scheduler skipped (development mode - production only)');
  }
  console.log('✅ Commission, regulatory, ISIN, picks, AI alpha routes registered');

  // AI Regime Detection & Model Governance schedulers (production only - writes to DB)
  if (isProductionEnvironment()) {
    const { aiRegimeDetectionEngine } = await import('./services/ai-regime-detection-engine');
    cron.schedule('0 3 * * *', async () => {
      console.log('[AI Regime] Running daily regime detection (8:30 AM IST / 3:00 AM UTC)...');
      try {
        const result = await aiRegimeDetectionEngine.detectCurrentRegime();
        await aiRegimeDetectionEngine.persistRegime(result);
        console.log(`[AI Regime] Detected: ${result.regimeLabel} (confidence: ${result.confidence.toFixed(1)}%)`);
      } catch (error) {
        console.error('[AI Regime] Detection failed:', error);
      }
    }, { timezone: 'UTC' });

    const { aiModelGovernance } = await import('./services/ai-model-governance');
    cron.schedule('30 2 * * *', async () => {
      console.log('[AI Governance] Running daily governance check (8:00 AM IST)...');
      try {
        await aiModelGovernance.updatePredictionOutcomes();
        const summary = await aiModelGovernance.runGovernanceCheck();
        console.log(`[AI Governance] Models: ${summary.healthyModels} healthy, ${summary.warningModels} warning, ${summary.criticalModels} critical`);
        if (summary.modelsNeedingRetrain.length > 0) {
          console.log(`[AI Governance] Auto-retraining: ${summary.modelsNeedingRetrain.join(', ')}`);
          for (const assetClass of summary.modelsNeedingRetrain) {
            try {
              await aiModelGovernance.triggerRetrain(assetClass);
              console.log(`[AI Governance] Retrained model for ${assetClass}`);
            } catch (err) {
              console.error(`[AI Governance] Retrain failed for ${assetClass}:`, err);
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
          console.log(`[ML Cron] Auto-training triggered with ${count} completed picks`);
        } else {
          console.log(`[ML Cron] Skipped — only ${count} completed picks (need ≥20)`);
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
        console.log(`[PicksExpiry] Expired ${count} picks past their expiry date`);

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
          console.log(`[PicksExpiry] Expired ${staleMfCount} MF picks with stale NAV data (>45 days)`);
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
          console.log(`[PicksExpiry] Force-expired ${ageCount} picks older than 180 days`);
        }

        // Also run the service's full status update (target/stoploss hits)
        const { pickOfTheDayService: svc } = await import('./services/pick-of-the-day-service');
        const r = await svc.updatePickStatuses();
        console.log(`[PicksExpiry] Status sweep complete: ${r.updated} picks updated`);
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
  const { runGoldenPricingMigration } = await import("./db-migrations/golden-pricing-migration");
  await runGoldenPricingMigration();

  const { runInstitutionalDataMigration } = await import("./db-migrations/institutional-data-migration");
  await runInstitutionalDataMigration();

  const { initializeSecurityMaster } = await import("./db-migrations/security-master-migration");
  await initializeSecurityMaster();

  // Boot-time: create agent_notifications table if missing
  try {
    const { db: notifDb } = await import('./db');
    const { sql: notifSql } = await import('drizzle-orm');
    await notifDb.execute(notifSql`
      CREATE TABLE IF NOT EXISTS agent_notifications (
        id          SERIAL PRIMARY KEY,
        agent_id    TEXT NOT NULL,
        title       TEXT NOT NULL,
        body        TEXT NOT NULL,
        type        TEXT NOT NULL DEFAULT 'info',
        link        TEXT,
        read_at     TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Migrate agent_id from INTEGER to TEXT if still an integer column (old deployments)
    await notifDb.execute(notifSql`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'agent_notifications'
            AND column_name = 'agent_id'
            AND data_type = 'integer'
        ) THEN
          ALTER TABLE agent_notifications ALTER COLUMN agent_id TYPE TEXT USING agent_id::TEXT;
        END IF;
      END $$;
    `);
    await notifDb.execute(notifSql`
      CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id
        ON agent_notifications (agent_id)
    `);
  } catch (e: any) {
    console.error('[Migration] agent_notifications table error:', e?.message);
  }

  // Boot-time: ensure UNIQUE indexes on cache tables so ON CONFLICT upserts work correctly.
  // Must deduplicate first — Railway DB may have duplicate rows from runs before the
  // unique constraint was present; CREATE UNIQUE INDEX fails if duplicates exist.
  try {
    const { db: cacheDb } = await import('./db');
    const { sql: cacheSql } = await import('drizzle-orm');

    // ── stock_prices_cache ────────────────────────────────────────────────────
    // Deduplicate: keep the most-recently-updated row per symbol
    await cacheDb.execute(cacheSql`
      DELETE FROM stock_prices_cache
      WHERE id NOT IN (
        SELECT DISTINCT ON (symbol) id
        FROM stock_prices_cache
        ORDER BY symbol, updated_at DESC NULLS LAST
      )
    `);
    await cacheDb.execute(cacheSql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_prices_cache_symbol
        ON stock_prices_cache (symbol)
    `);

    // ── financial_instruments_cache ───────────────────────────────────────────
    // Deduplicate: keep the most-recently-updated row per (instrument_type, symbol, exchange)
    await cacheDb.execute(cacheSql`
      DELETE FROM financial_instruments_cache
      WHERE id NOT IN (
        SELECT DISTINCT ON (instrument_type, symbol, COALESCE(exchange, '')) id
        FROM financial_instruments_cache
        ORDER BY instrument_type, symbol, COALESCE(exchange, ''), updated_at DESC NULLS LAST
      )
    `);
    await cacheDb.execute(cacheSql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_instruments_cache_type_symbol_exchange
        ON financial_instruments_cache (instrument_type, symbol, exchange)
    `);

    console.log('✅ [Migration] cache table UNIQUE indexes verified/created');
  } catch (e: any) {
    // Non-fatal: tables may not exist on very first boot (created lazily by their services)
    console.warn('[Migration] cache UNIQUE index skipped:', e?.message);
  }

  // Boot-time: add missing UNIQUE indexes so ON CONFLICT upserts work correctly.
  // These tables have .unique() / uniqueIndex() in the Drizzle schema but the
  // constraints were never applied to the existing Railway DB.
  try {
    const { db: uqDb } = await import('./db');
    const { sql: uqSql } = await import('drizzle-orm');

    // ── currency_rates (base_currency, target_currency) ───────────────────────
    await uqDb.execute(uqSql`
      DELETE FROM currency_rates
      WHERE id NOT IN (
        SELECT DISTINCT ON (base_currency, target_currency) id
        FROM currency_rates
        ORDER BY base_currency, target_currency, last_updated DESC NULLS LAST
      )
    `);
    await uqDb.execute(uqSql`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_currency_rates_base_target
        ON currency_rates (base_currency, target_currency)
    `);

    // ── mf_taxonomy_versions (version) ───────────────────────────────────────
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
      CREATE UNIQUE INDEX IF NOT EXISTS uq_mf_subcategory_master_code
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
          await bgDb.execute(bgSql.raw(dedupsql));
          await bgDb.execute(bgSql.raw(indexsql));
          console.log(`✅ [Migration] ${label} unique index created (background)`);
        } catch (e: any) {
          console.warn(`[Migration] ${label} (background):`, e?.message);
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

      // 8. financial_instruments_cache (instrument_type, symbol, exchange)
      await dedupAndIndex(
        'financial_instruments_cache',
        `DELETE FROM financial_instruments_cache
         WHERE id NOT IN (
           SELECT DISTINCT ON (instrument_type, symbol, exchange) id
           FROM financial_instruments_cache
           ORDER BY instrument_type, symbol, exchange, fetched_at DESC NULLS LAST
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_fin_cache_type_symbol_exchange
           ON financial_instruments_cache (instrument_type, symbol, exchange)`
      );

      // 9. instrument_prices (instrument_id, price_date)
      await dedupAndIndex(
        'instrument_prices',
        `DELETE FROM instrument_prices
         WHERE id NOT IN (
           SELECT DISTINCT ON (instrument_id, price_date) id
           FROM instrument_prices
           ORDER BY instrument_id, price_date, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_instrument_price
           ON instrument_prices (instrument_id, price_date)`
      );

      // 10. ai_regime_history (regime_date) — column-level .unique() may not exist on prod
      await dedupAndIndex(
        'ai_regime_history',
        `DELETE FROM ai_regime_history
         WHERE id NOT IN (
           SELECT DISTINCT ON (regime_date) id
           FROM ai_regime_history
           ORDER BY regime_date, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_regime_history_date
           ON ai_regime_history (regime_date)`
      );

      // 11. exchange_filings (exchange, document_url)
      await dedupAndIndex(
        'exchange_filings',
        `DELETE FROM exchange_filings
         WHERE id NOT IN (
           SELECT DISTINCT ON (exchange, document_url) id
           FROM exchange_filings
           ORDER BY exchange, document_url, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_exchange_filings_url
           ON exchange_filings (exchange, document_url)`
      );

      // 12. company_master_cache (cin)
      await dedupAndIndex(
        'company_master_cache',
        `DELETE FROM company_master_cache
         WHERE id NOT IN (
           SELECT DISTINCT ON (cin) id
           FROM company_master_cache
           ORDER BY cin, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_company_master_cache_cin
           ON company_master_cache (cin)`
      );

      // 13. ca_verification_status (user_id)
      await dedupAndIndex(
        'ca_verification_status',
        `DELETE FROM ca_verification_status
         WHERE id NOT IN (
           SELECT DISTINCT ON (user_id) id
           FROM ca_verification_status
           ORDER BY user_id, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_ca_verification_user_id
           ON ca_verification_status (user_id)`
      );

      // 14. user_bank_accounts (user_id, account_number)
      await dedupAndIndex(
        'user_bank_accounts',
        `DELETE FROM user_bank_accounts
         WHERE id NOT IN (
           SELECT DISTINCT ON (user_id, account_number) id
           FROM user_bank_accounts
           ORDER BY user_id, account_number, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_user_bank_accounts_user_acct
           ON user_bank_accounts (user_id, account_number)`
      );

      // 15. agent_empanelments (agent_id)
      await dedupAndIndex(
        'agent_empanelments',
        `DELETE FROM agent_empanelments
         WHERE id NOT IN (
           SELECT DISTINCT ON (agent_id) id
           FROM agent_empanelments
           ORDER BY agent_id, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_empanelments_agent_id
           ON agent_empanelments (agent_id)`
      );

      // 16. cache_refresh_schedule (cache_type)
      await dedupAndIndex(
        'cache_refresh_schedule',
        `DELETE FROM cache_refresh_schedule
         WHERE id NOT IN (
           SELECT DISTINCT ON (cache_type) id
           FROM cache_refresh_schedule
           ORDER BY cache_type, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_cache_refresh_schedule_type
           ON cache_refresh_schedule (cache_type)`
      );

      // 17. corporate_actions (isin, ex_date, action_type)
      await dedupAndIndex(
        'corporate_actions',
        `DELETE FROM corporate_actions
         WHERE id NOT IN (
           SELECT DISTINCT ON (isin, ex_date, action_type) id
           FROM corporate_actions
           ORDER BY isin, ex_date, action_type, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_corp_actions_isin_ex_type
           ON corporate_actions (isin, ex_date, action_type)`
      );
    });
  } catch (e: any) {
    console.warn('[Migration] ON CONFLICT UNIQUE index skipped:', e?.message);
  }

  // Boot-time: add missing columns to tables that exist in Railway DB but predate schema additions.
  try {
    const { db: colDb } = await import('./db');
    const { sql: colSql } = await import('drizzle-orm');

    // mca_financial_snapshot.data_completeness — queried by MCA refresh scheduler
    await colDb.execute(colSql`
      ALTER TABLE mca_financial_snapshot
        ADD COLUMN IF NOT EXISTS data_completeness NUMERIC DEFAULT 0
    `);

    console.log('✅ [Migration] mca_financial_snapshot.data_completeness verified/added');
  } catch (e: any) {
    console.warn('[Migration] mca_financial_snapshot column skipped:', e?.message);
  }

  // Migrate capital_gains_tax_reminders: add prospect_id + created_by_agent_id if missing
  try {
    const { db: mainDb } = await import('./db');
    const { sql: migSql } = await import('drizzle-orm');
    await mainDb.execute(migSql`
      ALTER TABLE capital_gains_tax_reminders
        ADD COLUMN IF NOT EXISTS prospect_id VARCHAR,
        ADD COLUMN IF NOT EXISTS created_by_agent_id VARCHAR REFERENCES users(id)
    `);
    console.log('✅ [Migration] capital_gains_tax_reminders columns verified/added');
  } catch (e: any) {
    console.error('[Migration] capital_gains_tax_reminders error:', e?.message);
  }

  // Migrate agents + partners: add arn_expiry_date if missing (KYC Expiry Monitor depends on this)
  try {
    const { db: mainDb } = await import('./db');
    const { sql: migSql } = await import('drizzle-orm');
    await mainDb.execute(migSql`
      ALTER TABLE agents ADD COLUMN IF NOT EXISTS arn_expiry_date TIMESTAMPTZ;
      ALTER TABLE partners ADD COLUMN IF NOT EXISTS arn_expiry_date TIMESTAMPTZ
    `);
    console.log('✅ [Migration] agents/partners arn_expiry_date columns verified/added');
  } catch (e: any) {
    console.error('[Migration] agents/partners arn_expiry_date error:', e?.message);
  }

  // Migrate prospect_id into tables that reference prospects/agents
  try {
    const { db: mainDb } = await import('./db');
    const { sql: migSql } = await import('drizzle-orm');
    await mainDb.execute(migSql`
      ALTER TABLE tax_reminder_subscriptions ADD COLUMN IF NOT EXISTS prospect_id VARCHAR;
      ALTER TABLE kyc_approvals              ADD COLUMN IF NOT EXISTS prospect_id VARCHAR;
      ALTER TABLE mf_orders                  ADD COLUMN IF NOT EXISTS prospect_id VARCHAR;
      ALTER TABLE prospect_proposals         ADD COLUMN IF NOT EXISTS prospect_id VARCHAR
    `);
    console.log('✅ [Migration] prospect_id columns verified/added (tax_reminders, kyc_approvals, mf_orders, prospect_proposals)');
  } catch (e: any) {
    console.error('[Migration] prospect_id columns error:', e?.message);
  }

  // Migrate created_by_agent_id into tables that link agent-created records
  try {
    const { db: mainDb } = await import('./db');
    const { sql: migSql } = await import('drizzle-orm');
    await mainDb.execute(migSql`
      ALTER TABLE tax_reminder_subscriptions ADD COLUMN IF NOT EXISTS created_by_agent_id VARCHAR REFERENCES users(id);
      ALTER TABLE capital_gains_tax_reminders ADD COLUMN IF NOT EXISTS created_by_agent_id VARCHAR REFERENCES users(id)
    `);
    console.log('✅ [Migration] created_by_agent_id columns verified/added (tax_reminder_subscriptions, capital_gains_tax_reminders)');
  } catch (e: any) {
    console.error('[Migration] created_by_agent_id columns error:', e?.message);
  }

  try {
    const { db: mainDb } = await import('./db');
    const { sql: migSql } = await import('drizzle-orm');
    await mainDb.execute(migSql`
      ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
      ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS current_price NUMERIC(20,6);
      ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS market_cap_value NUMERIC(20,2);
      ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS market_cap_category VARCHAR(20);
      ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS country VARCHAR(10) DEFAULT 'IN';
      ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR';
      ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS data_source VARCHAR(50);
      ALTER TABLE screener_stocks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    `);
    console.log('✅ [Migration] screener_stocks columns verified/added');
  } catch (e: any) {
    console.error('[Migration] screener_stocks columns error:', e?.message);
  }

  // mutual_funds — add columns introduced after initial production deployment
  try {
    const { db } = await import('./db');
    const { sql } = await import('drizzle-orm');
    await db.execute(sql`
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
    console.log('✅ [Migration] mutual_funds columns verified/added');
  } catch (e: any) {
    console.error('[Migration] mutual_funds columns error:', e?.message);
  }

  // Boot-time: add new Alpaca account opening columns to us_broker_accounts
  try {
    const { db: migDb } = await import('./db');
    const { sql: migSql } = await import('drizzle-orm');
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
    console.log('✅ [Migration] us_broker_accounts account opening columns verified/added');
  } catch (e: any) {
    console.warn('[Migration] us_broker_accounts account opening columns skipped:', e?.message);
  }

  // agent_services column on users + agent_notifications table
  try {
    const { db: agDb } = await import('./db');
    const { sql: agSql } = await import('drizzle-orm');
    await agDb.execute(agSql`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS agent_services TEXT[]
    `);
    await agDb.execute(agSql`
      CREATE TABLE IF NOT EXISTS agent_notifications (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR NOT NULL DEFAULT 'info',
        title VARCHAR NOT NULL DEFAULT '',
        message TEXT NOT NULL DEFAULT '',
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await agDb.execute(agSql`
      CREATE INDEX IF NOT EXISTS idx_agent_notifications_agent_id
        ON agent_notifications(agent_id)
    `);
    console.log('✅ [Migration] agent_services column + agent_notifications table verified/created');
  } catch (e: any) {
    console.warn('[Migration] agent_services/agent_notifications skipped:', e?.message);
  }

  // agent_empanelment_status column on users (tracks empanelment workflow state)
  try {
    const { db: aeDb } = await import('./db');
    const { sql: aeSql } = await import('drizzle-orm');
    await aeDb.execute(aeSql`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS agent_empanelment_status TEXT DEFAULT 'draft'
    `);
    // Backfill from agent_empanelments table
    await aeDb.execute(aeSql`
      UPDATE users u
      SET agent_empanelment_status = e.status
      FROM agent_empanelments e
      WHERE e.agent_id = u.id
        AND u.agent_empanelment_status IS DISTINCT FROM e.status
    `);
    console.log('✅ [Migration] agent_empanelment_status column verified/backfilled on users');
  } catch (e: any) {
    console.warn('[Migration] agent_empanelment_status skipped:', e?.message);
  }

  // prospect_leads scoring engine columns — added after initial table creation
  try {
    const { db: plDb } = await import('./db');
    const { sql: plSql } = await import('drizzle-orm');
    await plDb.execute(plSql`
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
    console.log('✅ [Migration] prospect_leads scoring columns verified/added');
  } catch (e: any) {
    console.warn('[Migration] prospect_leads scoring columns skipped:', e?.message);
  }

  // ca_verification_status — create table + add any columns missing from earlier deployments
  try {
    const { db: caDb } = await import('./db');
    const { sql: caSql } = await import('drizzle-orm');
    await caDb.execute(caSql`
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
        pan_number VARCHAR NOT NULL DEFAULT '',
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
      )
    `);
    // Add any columns missing from older table instances
    // NOTE: user_id / icai_membership_number are included here so that tables
    // created before this schema revision (which used ca_id) get the new columns.
    // They are nullable because pre-existing rows were written under the old schema.
    await caDb.execute(caSql`
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
    console.log('✅ [Migration] ca_verification_status table verified/created');
  } catch (e: any) {
    console.warn('[Migration] ca_verification_status schema skipped:', e?.message);
  }

  // partners — ICAI scraper result columns
  try {
    const { db: icaiDb } = await import('./db');
    const { sql: icaiSql } = await import('drizzle-orm');
    await icaiDb.execute(icaiSql`
      ALTER TABLE partners
        ADD COLUMN IF NOT EXISTS icai_scraped_name       VARCHAR,
        ADD COLUMN IF NOT EXISTS icai_scraper_status     VARCHAR DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS icai_scraper_run_at     TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS icai_scraper_source     VARCHAR,
        ADD COLUMN IF NOT EXISTS icai_confidence_score   NUMERIC(4,2),
        ADD COLUMN IF NOT EXISTS icai_cop_status         VARCHAR
    `);
    console.log('✅ [Migration] partners ICAI scraper columns verified/added');
  } catch (e: any) {
    console.warn('[Migration] partners ICAI scraper columns skipped:', e?.message);
  }

  // FintekPro Subscription / Monetization columns on users table
  try {
    const { db: subDb } = await import('./db');
    const { sql: subSql } = await import('drizzle-orm');
    await subDb.execute(subSql`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS plan_tier VARCHAR DEFAULT 'free',
        ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS cashfree_subscription_id VARCHAR
    `);
    await subDb.execute(subSql`
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
      )
    `);
    await subDb.execute(subSql`
      CREATE INDEX IF NOT EXISTS idx_platform_subs_user   ON platform_subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_platform_subs_status ON platform_subscriptions(status);
      CREATE INDEX IF NOT EXISTS idx_platform_subs_tier   ON platform_subscriptions(plan_tier);
    `);
    console.log('✅ [Migration] Subscription monetization schema verified/created');
  } catch (e: any) {
    console.warn('[Migration] Subscription monetization schema skipped:', e?.message);
  }

  // Boot-time: create audit_trail table if missing (used by audit-trail middleware)
  try {
    const { db: auditDb } = await import('./db');
    const { sql: auditSql } = await import('drizzle-orm');
    await auditDb.execute(auditSql`
      CREATE TABLE IF NOT EXISTS audit_trail (
        id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     VARCHAR,
        action      VARCHAR NOT NULL,
        category    VARCHAR NOT NULL,
        details     TEXT,
        ip_address  VARCHAR,
        user_agent  TEXT,
        outcome     VARCHAR,
        risk_level  VARCHAR,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ [Migration] audit_trail table verified/created');
  } catch (e: any) {
    console.error('[Migration] audit_trail table error:', e?.message);
  }

  // Boot-time: self_healing_events table for auto-recovery audit log
  try {
    const { db: shDb } = await import('./db');
    const { sql: shSql } = await import('drizzle-orm');
    await shDb.execute(shSql`
      CREATE TABLE IF NOT EXISTS self_healing_events (
        id            SERIAL PRIMARY KEY,
        event_type    VARCHAR(50) NOT NULL,
        trigger_message TEXT,
        action_taken  VARCHAR(100),
        success       BOOLEAN,
        message       TEXT,
        context       TEXT,
        occurred_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await shDb.execute(shSql`
      CREATE INDEX IF NOT EXISTS idx_self_healing_events_occurred_at
        ON self_healing_events (occurred_at DESC)
    `);
    console.log('✅ [Migration] self_healing_events table verified/created');
  } catch (e: any) {
    console.error('[Migration] self_healing_events table error:', e?.message);
  }

  // Boot-time: self_healing_feedback table (execution feedback loop)
  try {
    const { db: fbDb } = await import('./db');
    const { sql: fbSql } = await import('drizzle-orm');
    await fbDb.execute(fbSql`
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
      )
    `);
    await fbDb.execute(fbSql`
      CREATE INDEX IF NOT EXISTS idx_self_healing_feedback_module_occurred
        ON self_healing_feedback (module, occurred_at DESC)
    `);
    console.log('✅ [Migration] self_healing_feedback table verified/created');
  } catch (e: any) {
    console.error('[Migration] self_healing_feedback table error:', e?.message);
  }

  // iris_sessions — persist IRIS/KFintech JWT tokens across restarts
  try {
    const { db: mainDb } = await import('./db');
    const { sql: migSql } = await import('drizzle-orm');
    await mainDb.execute(migSql`
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
    console.log('✅ [Migration] iris_sessions table verified/created');
  } catch (e: any) {
    console.error('[Migration] iris_sessions table error:', e?.message);
  }

  // lrs_remittance_logs — track LRS remittances (USD transfers under FEMA/LRS)
  try {
    const { db: mainDb } = await import('./db');
    const { sql: migSql } = await import('drizzle-orm');
    await mainDb.execute(migSql`
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
    console.log('✅ [Migration] lrs_remittance_logs table verified/created');
  } catch (e: any) {
    console.error('[Migration] lrs_remittance_logs table error:', e?.message);
  }

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
    apiResponse.notFound(res, `Route ${req.method} ${req.path} not found`);
  });

  // Setup Vite BEFORE error handlers so it can serve the frontend
  // and its catch-all middleware doesn't conflict with API error handling
  // Check both app.get("env") and REPLIT_DEPLOYMENT for production detection
  const isDevelopmentMode = app.get("env") === "development" && process.env.REPLIT_DEPLOYMENT !== '1';
  if (isDevelopmentMode) {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Centralized error handling middleware (must be after all routes and Vite)
  const { errorHandler, notFoundHandler } = await import('./middleware/error-handler');
  app.use(notFoundHandler);
  app.use(errorHandler);

  // ============================================================================
  // ROUTES ARE NOW FULLY REGISTERED - mark as ready
  // ============================================================================
  bootState.routesReady = true;
  const bootMs = bootState.getBootTime();
  console.log(`✅ All routes registered (total boot time: ${bootMs}ms)`);

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
          bootTimeMs: bootMs,
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
    console.error("Failed to seed credit ratings:", err);
  });

  // Seed symbol mapping from existing data (fire-and-forget)
  symbolMappingService.seedSymbolMapping().catch(err => {
    console.error("Failed to seed symbol mapping:", err);
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

  // Initialize background services now that server is fully ready
  
  // Initialize Capital Gains Tax Reminder Scheduler (production only - sends notifications)
  if (isProductionEnvironment()) {
    try {
      import('./services/reminder-scheduler').then(({ reminderScheduler }) => {
        reminderScheduler.start();
        logger.service('Capital Gains Tax Reminder Scheduler', 'Service initialized successfully');
      }).catch(error => {
        logger.serviceError('Capital Gains Tax Reminder Scheduler', 'Failed to initialize service', error instanceof Error ? error : undefined);
      });
    } catch (error) {
      logger.serviceError('Capital Gains Tax Reminder Scheduler', 'Error importing service module', error instanceof Error ? error : undefined);
    }
  } else {
    console.log('⏭️ [CapitalGainsReminder] Scheduler skipped (development mode - production only)');
  }

  // GAP 4 FIX: KYC Expiry Monitor — daily check, runs in all environments
  try {
    import('./services/kyc-expiry-monitor').then(({ kycExpiryMonitor }) => {
      kycExpiryMonitor.start();
      logger.service('KYC Expiry Monitor', 'Service initialized — daily ARN/EUIN expiry checks active');
    }).catch(error => {
      console.error('❌ Failed to initialize KYC Expiry Monitor:', error);
    });
  } catch (error) {
    console.error('❌ Error importing KYC Expiry Monitor:', error);
  }
  
  // Initialize Bond Catalog Service (production only - writes to DB)
  if (isProductionEnvironment()) {
    setTimeout(() => {
      try {
        import('./bond-catalog-service').then(({ bondCatalogService }) => {
          bondCatalogService.startAutoRefresh();
          logger.service('Bond Catalog Service', 'Service initialized successfully');
        }).catch(error => {
          console.error('❌ Failed to initialize bond catalog service:', error);
        });
      } catch (error) {
        console.error('❌ Error importing bond catalog service:', error);
      }
    }, 30000);
  } else {
    console.log('⏭️ [BondCatalog] Auto-refresh skipped (development mode - production only)');
  }
  
  // Initialize Alert Monitoring Service (production only - writes to DB)
  if (isProductionEnvironment()) {
    try {
      import('./services/alert-monitoring-service').then(({ alertMonitoringService }) => {
        alertMonitoringService.start();
        logger.service('Alert Monitoring Service', 'Service initialized successfully');
      }).catch(error => {
        console.error('❌ Failed to initialize alert monitoring service:', error);
      });
    } catch (error) {
      console.error('❌ Error importing alert monitoring service:', error);
    }
  } else {
    console.log('⏭️ [AlertMonitoring] Skipped (development mode - production only)');
  }
  
  // Initialize Currency Exchange Service (production only - writes to DB)
  if (isProductionEnvironment()) {
    setTimeout(() => {
      try {
        import('./services/currency-exchange-service').then(async ({ currencyExchangeService }) => {
          await currencyExchangeService.initializeRates();
          currencyExchangeService.startAutoRefresh();
          logger.service('Currency Exchange Service', 'Service initialized successfully');
        }).catch(error => {
          console.error('❌ Failed to initialize currency exchange service:', error);
        });
      } catch (error) {
        console.error('❌ Error importing currency exchange service:', error);
      }
    }, 45000);
  } else {
    console.log('⏭️ [CurrencyExchange] Auto-refresh skipped (development mode - production only)');
  }
  
  // Initialize Session Cleanup Cron Job (production only - writes to DB)
  if (isProductionEnvironment()) {
    try {
      import('./session-cleanup-cron').then(({ initSessionCleanupCron }) => {
        initSessionCleanupCron();
      }).catch(error => {
        console.error('❌ Failed to initialize session cleanup cron:', error);
      });
    } catch (error) {
      console.error('❌ Error importing session cleanup cron:', error);
    }
  } else {
    console.log('⏭️ [SessionCleanup] Skipped (development mode - production only)');
  }
  
  // Initialize CKYC Provider Configuration (production only - writes to DB)
  // 5s delay lets Neon pool fully warm before first DB write
  if (isProductionEnvironment()) {
    setTimeout(() => {
      try {
        import('./services/ckyc-provider-resolution-service').then(({ ckycProviderResolutionService }) => {
          ckycProviderResolutionService.seedDefaultProviders().then(() => {
            console.log('✅ CKYC Provider Configuration Service initialized');
          }).catch(error => {
            console.warn('⚠️ CKYC Provider seeding skipped (will retry on first request):', error instanceof Error ? error.message : 'Unknown error');
          });
        }).catch(error => {
          console.warn('⚠️ CKYC Provider Service not loaded (app continues without it):', error instanceof Error ? error.message : 'Unknown error');
        });
      } catch (error) {
        console.warn('⚠️ Error importing CKYC provider service (non-blocking):', error instanceof Error ? error.message : 'Unknown error');
      }
    }, 5000);
  } else {
    console.log('⏭️ [CKYCProvider] Seeding skipped (development mode - production only)');
  }
  
  // Initialize AMFI Subscription Sync Service (production only - syncs per-fund subscription status from mfapi.in)
  // 5s delay lets Neon pool fully warm before DB writes
  if (isProductionEnvironment()) {
    setTimeout(() => {
      try {
        import('./services/amfi-subscription-sync-service').then(({ amfiSubscriptionSyncService }) => {
          amfiSubscriptionSyncService.sync().catch(err =>
            console.error('❌ [SubscriptionSync] Boot-time sync failed:', err)
          );
        }).catch(error => {
          console.error('❌ Failed to import amfi-subscription-sync-service:', error);
        });
      } catch (error) {
        console.error('❌ Error initializing subscription sync:', error);
      }
    }, 5000);
  } else {
    console.log('⏭️ [SubscriptionSync] Boot-time sync skipped (development mode - production only)');
  }

  // Initialize Retention Cleanup Service (production only - deletes old data per PMLA/RBI compliance)
  if (isProductionEnvironment()) {
    try {
      import('./services/retention-cleanup-service').then(({ retentionCleanupService }) => {
        retentionCleanupService.scheduleCleanup();
        logger.service('Retention Cleanup Service', 'Scheduled daily cleanup at 2:00 AM IST');
      }).catch(error => {
        console.error('❌ Failed to initialize retention cleanup service:', error);
      });
    } catch (error) {
      console.error('❌ Error importing retention cleanup service:', error);
    }
  } else {
    console.log('⏭️ [RetentionCleanup] Scheduler skipped (development mode - production only)');
  }
  
  // Initialize Background Job Queue
  try {
    import('./services/background-job-queue').then(({ jobQueue }) => {
      import('./services/government-scheme-data-fetcher').then(({ governmentSchemeDataFetcher }) => {
        jobQueue.registerHandler('epf_passbook_download', async (payload) => {
          return governmentSchemeDataFetcher.fetchSchemeData({
            userId: payload.userId,
            schemeType: 'epf',
            panNumber: String(payload.panNumber || ''),
            name: String(payload.name || ''),
            dateOfBirth: String(payload.dateOfBirth || ''),
            consentId: payload.consentId
          });
        });
        
        jobQueue.registerHandler('nps_statement_fetch', async (payload) => {
          return governmentSchemeDataFetcher.fetchSchemeData({
            userId: payload.userId,
            schemeType: 'nps',
            panNumber: String(payload.panNumber || ''),
            name: String(payload.name || ''),
            dateOfBirth: String(payload.dateOfBirth || ''),
            consentId: payload.consentId
          });
        });
        
        logger.service('Background Job Queue', 'Initialized with government scheme handlers');
      });
    }).catch(error => {
      console.error('❌ Failed to initialize background job queue:', error);
    });
  } catch (error) {
    console.error('❌ Error importing background job queue:', error);
  }
  
  // Initialize Unlisted Marketplace Cron Jobs
  try {
    initializeCronJobs();
    bootState.cronJobsReady = true;
    logger.service('Unlisted Marketplace Cron', 'Cron jobs initialized successfully');
  } catch (error) {
    logger.serviceError('Unlisted Marketplace Cron', 'Failed to initialize cron jobs', error instanceof Error ? error : undefined);
  }
  
  // Initialize Financial Data Scheduler for database-driven caching (production only)
  const isProduction = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';
  if (isProduction) {
    setTimeout(() => {
      try {
        import('./services/financial-data-scheduler').then(({ financialDataScheduler }) => {
          financialDataScheduler.start();
          logger.service('Financial Data Scheduler', 'Started periodic data refresh');
        }).catch(error => {
          console.error('❌ Failed to start financial data scheduler:', error);
        });
      } catch (error) {
        console.error('❌ Error initializing financial data scheduler:', error);
      }
    }, 180000);
    
    // Initialize MF Returns Scheduler (calculates live CAGR returns from historical NAV)
    setTimeout(() => {
      try {
        import('./services/mf-returns-scheduler').then(({ mfReturnsScheduler }) => {
          mfReturnsScheduler.initialize();
          console.log('📊 [MFReturnsScheduler] Returns sync scheduler initialized');
        }).catch(error => {
          console.error('❌ Failed to start MF returns scheduler:', error);
        });
      } catch (error) {
        console.error('❌ Error initializing MF returns scheduler:', error);
      }
    }, 240000);
  } else {
    console.log('⏭️ [Financial Data Scheduler] Skipped (development mode - production only)');
    console.log('⏭️ [MFReturnsScheduler] Skipped (development mode - production only)');
  }
  
  // Seed default store categories if not present (production only - writes to DB)
  // 5s delay lets Neon pool fully warm before DB writes
  if (isProductionEnvironment()) {
    setTimeout(() => {
      storage.seedDefaultStoreCategories().catch(error => {
        console.error('❌ Failed to seed store categories:', error);
      });
    }, 5000);
  } else {
    console.log('⏭️ [StoreCategories] Seeding skipped (development mode - production only)');
  }

  // Seed central test account (production only - no mock data on shared production DB from development)
  if (isProductionEnvironment()) {
    import('./seed-test-user').then(({ seedTestUser }) => {
      seedTestUser().catch(error => {
        console.error('⚠️ Failed to seed test user:', error instanceof Error ? error.message : error);
      });
    }).catch(() => {});
  } else {
    console.log('⏭️ [TestUser] Seeding skipped (development mode - no mock data on production DB)');
  }

  // Comprehensive data bootstrap: seed all reference data (production only - heavy DB writes)
  if (isProductionEnvironment()) {
  setTimeout(async () => {
    try {
      const { runProductionBootstrap } = await import('./production-bootstrap');
      await runProductionBootstrap();

      const { db } = await import('./db');
      const { sql } = await import('drizzle-orm');

      const indicesCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM market_indices`);
      const indicesCount = parseInt(String((indicesCheck.rows[0] as any)?.cnt || '0'));

      if (indicesCount <= 7) {
        console.log('🔄 [Bootstrap] Seeding benchmark index data...');

        try {
          const { bseBenchmarkService } = await import('./services/bse-benchmark-service');
          const bseResult = await bseBenchmarkService.seedBseIndices();
          console.log(`✅ [Bootstrap] BSE indices seeded: ${bseResult.seeded} new, ${bseResult.existing} existing`);
        } catch (err: any) {
          console.error('⚠️ [Bootstrap] BSE index seeding failed:', err.message);
        }

        console.log('✅ [Bootstrap] Benchmark data seeding completed');
      } else {
        console.log(`✅ [Bootstrap] ${indicesCount} market indices already exist`);
      }

      // Category-based benchmark mapping - maps equity MFs to market indices using category rules
      // This runs independently of AMFI raw benchmark text (which may not be available)
      try {
        const benchmarkMapCheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM mf_benchmark_map`);
        const benchmarkMapCount = parseInt(String((benchmarkMapCheck.rows[0] as any)?.cnt || '0'));
        
        const fundsWithIsin = await db.execute(sql`
          SELECT COUNT(*) as cnt FROM mutual_funds WHERE isin IS NOT NULL AND isin != ''
        `);
        const totalFundsWithIsin = parseInt(String((fundsWithIsin.rows[0] as any)?.cnt || '0'));
        const mappingGap = totalFundsWithIsin > 0 ? ((totalFundsWithIsin - benchmarkMapCount) / totalFundsWithIsin) * 100 : 0;
        
        if (benchmarkMapCount === 0 || mappingGap > 50) {
          console.log(`🔄 [Bootstrap] Benchmark mapping gap: ${benchmarkMapCount}/${totalFundsWithIsin} mapped (${mappingGap.toFixed(1)}% unmapped) - running category-based auto-mapping...`);
          const { mfBenchmarkMappingService } = await import('./services/mf-benchmark-mapping-service');
          const mapResult = await mfBenchmarkMappingService.autoMapUnmappedFunds(totalFundsWithIsin);
          console.log(`✅ [Bootstrap] Category benchmark mapping: ${mapResult.mapped} mapped, ${mapResult.skipped} skipped`);
          
          // Also try AMFI raw benchmark text if available
          const { amfiBenchmarkIngestionService } = await import('./services/amfi-benchmark-ingestion-service');
          const amfiResult = await amfiBenchmarkIngestionService.syncAmfiSchemeBenchmarks();
          if (amfiResult.normalized > 0) {
            const amfiMapResult = await amfiBenchmarkIngestionService.autoMapFromAmfi();
            console.log(`✅ [Bootstrap] AMFI benchmark overlay: ${amfiMapResult.mapped} new, ${amfiMapResult.updated} updated (overrides category mappings with higher confidence)`);
          } else {
            console.log(`ℹ️ [Bootstrap] AMFI raw benchmark text not available yet - category mapping is active`);
          }
        } else {
          console.log(`✅ [Bootstrap] Benchmark mapping: ${benchmarkMapCount}/${totalFundsWithIsin} funds mapped`);
        }
      } catch (err: any) {
        console.error('⚠️ [Bootstrap] Benchmark mapping failed:', err.message);
      }

      try {
        const { schemeGovernanceService } = await import('./services/scheme-governance-service');
        const { LEGACY_PURCHASE_RESTRICTED_FUNDS } = await import('./services/agent-prospect-wizard-service');
        const ruleCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM scheme_transaction_rules`);
        const existingRules = parseInt(String((ruleCount.rows[0] as any)?.cnt || '0'));
        if (existingRules === 0 && LEGACY_PURCHASE_RESTRICTED_FUNDS.length > 0) {
          console.log('🔄 [Bootstrap] Seeding scheme transaction rules from restriction registry...');
          const seedResult = await schemeGovernanceService.seedTransactionRulesFromRegistry(LEGACY_PURCHASE_RESTRICTED_FUNDS);
          console.log(`✅ [Bootstrap] Scheme transaction rules seeded: ${seedResult.seeded} rules, ${seedResult.errors} errors`);
        } else {
          console.log(`✅ [Bootstrap] ${existingRules} scheme transaction rules already exist`);
        }
      } catch (err: any) {
        console.error('⚠️ [Bootstrap] Scheme transaction rules seeding failed:', err.message);
      }

      const isBootstrapProduction = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';
      if (isBootstrapProduction) {
        const mfCheck = await db.execute(sql`
          SELECT COUNT(*) as total, 
                 SUM(CASE WHEN returns_1y IS NULL THEN 1 ELSE 0 END) as missing
          FROM mutual_funds
        `);
        const mfTotal = parseInt(String((mfCheck.rows[0] as any)?.total || '0'));
        const mfMissing = parseInt(String((mfCheck.rows[0] as any)?.missing || '0'));
        const gapPercent = mfTotal > 0 ? (mfMissing / mfTotal) * 100 : 0;

        if (gapPercent > 80 && mfTotal > 100) {
          console.log(`🔄 [Bootstrap] MF returns gap: ${gapPercent.toFixed(1)}% missing - starting initial enrichment for top 500 funds...`);
          try {
            const { mfReturnsSyncService } = await import('./services/mf-returns-sync-service');
            const result = await mfReturnsSyncService.runBatchSync(500);
            console.log(`✅ [Bootstrap] MF returns initial enrichment: synced ${typeof result === 'object' ? JSON.stringify(result) : result}`);
          } catch (err: any) {
            console.error('⚠️ [Bootstrap] MF returns initial enrichment failed:', err.message);
          }
        }
      } else {
        console.log('⏭️ [Bootstrap] MF returns enrichment skipped (development mode - production only)');
      }
    } catch (error: any) {
      console.error('❌ [Bootstrap] Data seeding failed:', error.message);
    }
  }, 60000);
  } else {
    console.log('⏭️ [ProductionBootstrap] All data seeding skipped (development mode - production only)');
  }
})().catch((error: any) => {
  console.error('❌ [FATAL] Server initialization failed:', error?.message || error);
  // Don't exit - the server may still be able to handle health checks
  // Only exit if the server never started listening
  if (!bootState.serverListening) {
    console.error('❌ Server never started listening, exiting...');
    process.exit(1);
  }
});
