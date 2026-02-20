// FintekPro Server - Main entry point

// Signal handlers to diagnose unexpected process termination
process.on('SIGTERM', () => {
  console.log(`⚠️ [SIGNAL] SIGTERM received at ${new Date().toISOString()} (uptime: ${(process.uptime()/60).toFixed(1)}min, RSS: ${(process.memoryUsage().rss/1024/1024).toFixed(0)}MB)`);
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log(`⚠️ [SIGNAL] SIGINT received at ${new Date().toISOString()} (uptime: ${(process.uptime()/60).toFixed(1)}min)`);
  process.exit(0);
});
process.on('SIGHUP', () => {
  console.log(`ℹ️ [SIGNAL] SIGHUP received at ${new Date().toISOString()} (uptime: ${(process.uptime()/60).toFixed(1)}min) - graceful shutdown`);
  process.exit(0);
});

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
  // For other uncaught exceptions, log but don't crash in development
  console.error('[Global] Uncaught exception:', error);
  if (process.env.NODE_ENV === 'production') {
    // In production, give time for error logging then exit
    setTimeout(() => process.exit(1), 1000);
  }
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
import { setupAuth as setupReplitAuth } from "./replitAuth";
import { setupAuth as setupLocalAuth } from "./auth";
import { subdomainDetection, validateSessionPortal } from "./subdomain-middleware";
import { initializeCronJobs } from "./cron-jobs";
import { requestContextMiddleware } from "./middleware/request-context";
import { errorMonitoringMiddleware, globalErrorHandler } from "./error-monitor";
import { latencyTrackingMiddleware } from "./services/request-latency-tracker";
import { sensitiveDataMaskingMiddleware } from "./middleware/sensitive-data-masking";
import { setupGracefulShutdown } from "./graceful-shutdown";
import { auditTrailMiddleware } from "./middleware/audit-trail";
import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";
import "./services/sms-service"; // Initialize SMS service

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
const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
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
      frameAncestors: ["'self'", "https://*.replit.dev", "https://*.replit.com"],
    },
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
    
    // Allow Replit domains (for development and deployed app)
    const replitDomains = process.env.REPLIT_DOMAINS?.split(',').map(d => d.trim()) || [];
    const isReplitOrigin = replitDomains.some(domain => origin.includes(domain)) ||
        origin.endsWith('.replit.dev') ||
        origin.endsWith('.repl.co') ||
        origin.endsWith('.replit.app');
    
    if (isReplitOrigin) {
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
    
    const replitDomains = process.env.REPLIT_DOMAINS?.split(',').map(d => `https://${d.trim()}`) || [];
    allowedOrigins.push(...replitDomains);
    
    if (!isProduction) {
      allowedOrigins.push('http://localhost:5000', 'http://127.0.0.1:5000');
    }
    
    const requestOrigin = origin || (referer ? new URL(referer).origin : null);
    
    if (requestOrigin && !allowedOrigins.some(allowed => requestOrigin.startsWith(allowed.replace(/\/$/, '')))) {
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

// Portal-bound session validation - enforce portal mismatch security
app.use(validateSessionPortal);

// Compliance monitoring middleware
app.use(complianceMiddleware);

// Regulatory audit trail middleware - SEBI/RBI compliance logging
app.use(auditTrailMiddleware);

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

(async () => {
  // Health check endpoints (must be before auth - no authentication required)
  const { healthCheck, readinessCheck, livenessCheck } = await import('./health-check');
  app.get('/health', healthCheck);
  app.get('/ready', (req, res) => {
    // Enhanced readiness check that includes boot state
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
  
  // API health endpoint - BEFORE session middleware to ensure it always responds
  // This is critical for production load balancers and health checks
  // Returns 200 as long as server process is running (even during boot)
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: bootState.isFullyReady() ? 'ok' : 'booting',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      bootTime: bootState.getBootTime(),
      ready: bootState.isFullyReady()
    });
  });
  
  // HEAD request for /api/health (used by some monitoring tools)
  app.head('/api/health', (req, res) => {
    res.status(200).end();
  });
  
  // API ready endpoint - returns 503 during boot, 200 when fully ready
  app.get('/api/ready', async (req, res) => {
    if (bootState.isFullyReady()) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        bootTime: bootState.getBootTime()
      });
    } else {
      res.status(503).json({
        status: 'booting',
        message: 'Server is starting up, please wait...',
        bootTime: bootState.getBootTime(),
        state: {
          serverListening: bootState.serverListening,
          authReady: bootState.authReady,
          routesReady: bootState.routesReady
        }
      });
    }
  });
  
  // Initialize authentication (Passport & sessions must be set up first)
  await setupReplitAuth(app);
  
  // Then add local email/mobile authentication routes
  setupLocalAuth(app);
  
  // Auth is now ready
  bootState.authReady = true;
  console.log(`✅ Auth ready (${bootState.getBootTime()}ms)`);
  
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
  
  // ============================================================================
  // FAST BOOT: Start the HTTP server NOW, before heavy route registration
  // This ensures health endpoints respond immediately instead of 502 errors
  // ============================================================================
  const { createServer } = await import('http');
  const server = createServer(app);
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Boot-in-progress middleware - returns 503 for API routes not yet loaded
  // This will be removed once routes are fully registered
  const bootInProgressMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Skip if routes are ready
    if (bootState.routesReady) {
      return next();
    }
    
    // Allow health endpoints during boot
    if (req.path === '/api/health' || req.path === '/api/ready' || req.path === '/health' || req.path === '/ready') {
      return next();
    }
    
    // Allow auth-related endpoints during boot
    if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/login') || req.path.startsWith('/api/user')) {
      return next();
    }
    
    // Allow CSRF token endpoint during boot (needed for login forms)
    if (req.path === '/api/csrf-token') {
      return next();
    }
    
    // Return 503 for other API routes - server is still booting
    res.status(503).json({
      status: 'booting',
      message: 'Server is starting up, please wait a moment and refresh...',
      bootTime: bootState.getBootTime(),
      retryAfter: 5
    });
  };
  
  // Apply boot middleware for API routes
  app.use('/api', bootInProgressMiddleware);
  
  // Start listening IMMEDIATELY - don't wait for routes
  // Setup graceful shutdown handling (SIGTERM/SIGINT)
  setupGracefulShutdown(server);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    bootState.serverListening = true;
    console.log(`🚀 Server listening on port ${port} (boot time: ${bootState.getBootTime()}ms)`);
    logger.info(`Server listening on port ${port}`, { port, environment: process.env.NODE_ENV || 'development', bootTime: bootState.getBootTime() });
  });
  
  // Continue registering routes asynchronously (server is already listening)
  console.log('📦 Registering routes...');
  
  // Register Version API route (for PWA update checks)
  const versionRoutes = await import('./routes/version');
  app.use(versionRoutes.default);
  
  // Register Zoho integration routes
  const zohoRoutes = await import('./zoho/routes');
  app.use('/api/zoho', zohoRoutes.default);
  
  // Register Agent Onboarding routes
  const agentRoutes = await import('./agent-routes');
  app.use(agentRoutes.default);
  
  // Register Agent Revenue & Lead Pipeline routes
  const agentRevenueRoutes = await import('./routes/agent-revenue-routes');
  app.use(agentRevenueRoutes.default);
  
  // Register KYC Vault routes (Production-grade KYC system)
  const { registerKYCVaultRoutes } = await import('./kyc-vault-routes');
  registerKYCVaultRoutes(app);
  
  // Initialize Zoho Campaigns using shared refresh token (non-blocking)
  import('./zoho-campaigns-service').then(m => m.initZohoCampaignsService()).catch(() => {});
  
  // Register Marketing Automation routes (Zoho Campaigns, Twilio, Probe42)
  const { registerMarketingRoutes } = await import('./marketing-routes');
  registerMarketingRoutes(app);
  
  // Register Admin Prospect Dashboard routes (B2B leads, individual prospects, Zoho CRM import)
  const { registerAdminProspectRoutes } = await import('./routes/admin-prospects');
  registerAdminProspectRoutes(app);
  console.log('✅ Admin Prospect Dashboard routes registered');
  
  // Register Twilio Webhook routes (Two-way SMS & WhatsApp communication)
  const { createTwilioWebhookRouter } = await import('./services/twilio-webhook-service');
  app.use('/api/twilio', createTwilioWebhookRouter());
  console.log('✅ Twilio webhook routes registered');
  
  // Register Probe42 Advanced Analytics routes (Lead Scoring, Surplus Detection, Director Networks)
  const probe42AnalyticsRoutes = await import('./routes/probe42-analytics-routes');
  app.use('/api/admin/analytics', probe42AnalyticsRoutes.default);
  console.log('✅ Probe42 Analytics routes registered');
  
  // Register User Management routes (Admin user CRUD operations)
  const { registerUserManagementRoutes } = await import('./user-management-routes');
  registerUserManagementRoutes(app);
  
  // Register Stakeholder routes (Partners, Agents, Suppliers)
  const { registerStakeholderRoutes } = await import('./stakeholder-routes');
  registerStakeholderRoutes(app);
  
  // Register Auto-Population routes (Post-KYC data fetching)
  const { autoPopulationRouter } = await import('./auto-population-routes');
  app.use('/api/auto-population', autoPopulationRouter);
  
  // Register Unlisted Marketplace routes
  const unlistedRoutes = await import('./routes/unlisted');
  app.use('/api/unlisted', unlistedRoutes.default);
  
  // Register Compliance routes
  const complianceRoutes = await import('./routes/compliance');
  app.use('/api/compliance', complianceRoutes.default);
  
  // Register Bond Marketplace routes (SEBI NCS Compliant)
  const bondMarketplaceRoutes = await import('./routes/bond-marketplace');
  app.use('/api/bonds', bondMarketplaceRoutes.default);
  
  // Register Bond Seed Admin routes (Fee Profiles, Catalog, Publish Workflow)
  const bondSeedAdminRoutes = await import('./routes/bond-seed-admin');
  app.use('/api/admin/bond-seed', bondSeedAdminRoutes.default);
  
  // Register Migration routes (for one-time data sync between environments)
  app.use('/api/migration', bondSeedAdminRoutes.migrationRouter);
  
  // Register Gold/SGB Admin routes
  const goldAdminRoutes = await import('./routes/gold-admin');
  app.use('/api/admin/gold', goldAdminRoutes.default);
  
  // Register Bond Marketplace Improvements routes (Enhanced Filtering, Eligibility, Watchlist, Suitability)
  const bondMarketplaceImprovements = await import('./routes/bond-marketplace-improvements');
  app.use('/api/bonds', bondMarketplaceImprovements.default);
  
  // Register Bond Financial Calendar routes (Issuances, Maturities, Auctions)
  const bondCalendarRoutes = await import('./routes/bond-calendar-routes');
  app.use('/api/bond-calendar', bondCalendarRoutes.default);
  
  // Initialize Financial Calendar Service
  import('./services/financial-calendar-service').then(({ financialCalendarService }) => {
    financialCalendarService.initialize().catch(err => {
      console.error('Failed to initialize financial calendar service:', err);
    });
  });
  
  // Register Commission Configuration routes (Admin-Driven Role-Based Commission Calibration)
  const commissionConfigRoutes = await import('./commission-config-routes');
  app.use('/api/admin', commissionConfigRoutes.default);
  console.log('✅ Commission configuration routes registered');
  
  // Register Regulatory Framework routes (SEBI/RBI Investor Classification, Brokerage, Eligibility, Overrides)
  const regulatoryFrameworkRoutes = await import('./routes/regulatory-framework-routes');
  app.use('/api/regulatory', regulatoryFrameworkRoutes.default);
  
  // Register ISIN Intelligence Layer routes (Detection, Validation, Compliance)
  const isinIntelligenceRoutes = await import('./routes/isin-intelligence');
  app.use('/api/isin', isinIntelligenceRoutes.default);
  console.log('✅ ISIN Intelligence Layer routes registered');

  // Register Pick of the Day routes
  const pickOfTheDayRoutes = await import('./routes/pick-of-the-day');
  app.use('/api/picks', pickOfTheDayRoutes.default);
  console.log('✅ Pick of the Day routes registered');

  const { pickOfTheDayService } = await import('./services/pick-of-the-day-service');
  const { isProductionEnvironment } = await import('./utils/enrichment-guard');
  if (isProductionEnvironment()) {
    setTimeout(() => pickOfTheDayService.startDailyScheduler(), 60000);
  } else {
    console.log('⏭️ [PickOfTheDay] Daily scheduler skipped (development mode - production only)');
  }

  // Register AI Alpha Engine routes (Backtesting, Regime Detection, Portfolio Optimization)
  const aiAlphaEngineRoutes = await import('./routes/ai-alpha-engine');
  app.use('/api/ai', aiAlphaEngineRoutes.default);
  console.log('✅ AI Alpha Engine routes registered');

  // AI Regime Detection & Model Governance schedulers (production only - writes to DB)
  const cron = await import('node-cron');
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
  } else {
    console.log('⏭️ [AI Regime/Governance] Daily schedulers skipped (development mode - production only)');
  }
  
  // Register MF Order Execution routes (SEBI-compliant buy/sell order management)
  const mfOrdersRoutes = await import('./routes/mf-orders');
  app.use(mfOrdersRoutes.default);
  
  // Register Unified Order Management routes (cross-product order lifecycle)
  const { registerOrderRoutes } = await import('./order-routes');
  registerOrderRoutes(app);
  console.log('✅ Unified Order Management routes registered');
  
  // Register MF Enrichment & Internal Fund APIs (SEBI-compliant data pipeline)
  const { registerMFEnrichmentRoutes } = await import('./routes/mf-enrichment-routes');
  registerMFEnrichmentRoutes(app);

  // Register AI MF Recommendation routes (Smart fund recommendations with rich rationale)
  const aiMFRecommendationRoutes = await import('./routes/ai-mf-recommendation-routes');
  app.use(aiMFRecommendationRoutes.default);
  console.log('✅ AI MF Recommendation routes registered');
  
  // Register AuthBridge Aadhaar eSign (DSC) routes
  const esignRoutes = await import('./routes/esign-routes');
  app.use(esignRoutes.default);
  console.log('✅ AuthBridge eSign routes registered');
  
  // Register Admin eSign Provider Configuration routes
  const adminEsignRoutes = await import('./routes/admin-esign-routes');
  app.use(adminEsignRoutes.default);
  console.log('✅ Admin eSign provider configuration routes registered');
  
  // Register DSC Token eSign routes
  const dscEsignRoutes = await import('./routes/dsc-esign-routes');
  app.use('/api/esign', dscEsignRoutes.default);
  console.log('✅ DSC Token eSign routes registered');
  
  // Register Proposal eSign Workflow routes
  const proposalEsignRoutes = await import('./routes/proposal-esign-routes');
  app.use('/api/proposal-esign', proposalEsignRoutes.default);
  console.log('✅ Proposal eSign workflow routes registered');

  // Register eSign AI Analysis routes
  const esignAiRoutes = await import('./routes/esign-ai-routes');
  app.use('/api/esign/ai', esignAiRoutes.default);
  console.log('✅ eSign AI analysis routes registered');

  // Register Document Upload routes
  const documentUploadRoutes = await import('./routes/document-upload-routes');
  app.use('/api/documents', documentUploadRoutes.default);
  console.log('✅ Document upload routes registered');
  
  // Register CA (Chartered Accountant) routes
  const caRoutes = await import('./routes/ca-routes');
  app.use('/api/ca', caRoutes.default);
  console.log('✅ CA registration and assignment routes registered');
  
  // Register REIT/InvIT routes
  const reitInvitRoutes = await import('./routes/reit-invit-routes');
  app.use('/api/reit-invit', reitInvitRoutes.default);
  console.log('✅ REIT/InvIT investment routes registered');
  
  // Register Admin Database Management routes
  const adminDatabaseRoutes = await import('./routes/admin-database');
  app.use('/api/admin/database', adminDatabaseRoutes.default);
  console.log('✅ Admin Database Management routes registered');

  // Register error testing routes (development only)
  if (process.env.NODE_ENV === 'development') {
    const testErrorRoutes = await import('./test-error-handling');
    app.use('/api', testErrorRoutes.default);
  }
  
  registerRoleRoutes(app);
  
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
  console.log(`✅ All routes registered (total boot time: ${bootState.getBootTime()}ms)`);

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
  
  // Initialize Alert Monitoring Service
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
  
  // Initialize Session Cleanup Cron Job
  try {
    import('./session-cleanup-cron').then(({ initSessionCleanupCron }) => {
      initSessionCleanupCron();
    }).catch(error => {
      console.error('❌ Failed to initialize session cleanup cron:', error);
    });
  } catch (error) {
    console.error('❌ Error importing session cleanup cron:', error);
  }
  
  // Initialize CKYC Provider Configuration (non-blocking)
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
  
  // Seed default store categories if not present
  storage.seedDefaultStoreCategories().catch(error => {
    console.error('❌ Failed to seed store categories:', error);
  });

  // Seed central test account (test@fintekpro.com / Test@123456 / OTP: 123456)
  import('./seed-test-user').then(({ seedTestUser }) => {
    seedTestUser().catch(error => {
      console.error('⚠️ Failed to seed test user:', error instanceof Error ? error.message : error);
    });
  }).catch(() => {});

  // Comprehensive data bootstrap: seed all reference data
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
        const { PURCHASE_RESTRICTED_FUNDS } = await import('./services/agent-prospect-wizard-service');
        const ruleCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM scheme_transaction_rules`);
        const existingRules = parseInt(String((ruleCount.rows[0] as any)?.cnt || '0'));
        if (existingRules === 0 && PURCHASE_RESTRICTED_FUNDS.length > 0) {
          console.log('🔄 [Bootstrap] Seeding scheme transaction rules from restriction registry...');
          const seedResult = await schemeGovernanceService.seedTransactionRulesFromRegistry(PURCHASE_RESTRICTED_FUNDS);
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
})();
