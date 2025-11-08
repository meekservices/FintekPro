// FintekPro Server - Main entry point
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { validationResult } from "express-validator";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log as viteLog } from "./vite";
import { logger } from "./logger";
import { complianceMiddleware } from "./compliance-monitor";
import { storage } from "./storage";
import { setupAuth as setupReplitAuth } from "./replitAuth";
import { setupAuth as setupLocalAuth } from "./auth";
import { subdomainDetection } from "./subdomain-middleware";
import { requestCorrelationMiddleware } from "./middleware/request-correlation";
import "./services/sms-service"; // Initialize SMS service

const app = express();

// Trust proxy configuration for Replit environment
app.set('trust proxy', 1);

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
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      // Production domains
      "https://fintekpro.com",
      "https://www.fintekpro.com",
      "https://admin.fintekpro.com",
      // Development domains
      "http://localhost:5000",
      "http://127.0.0.1:5000",
      "http://admin.localhost:5000",
    ];
    
    // Allow Replit domains (*.replit.dev, *.repl.co, *.replit.app)
    if (!origin || 
        allowedOrigins.includes(origin) ||
        origin.endsWith('.replit.dev') ||
        origin.endsWith('.repl.co') ||
        origin.endsWith('.replit.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

// Rate limiting with proper proxy configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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

// Raw body capture for webhook signature verification
app.use('/api/payments/cashfree/webhook', express.raw({ type: 'application/json' }));

// Raw body capture for Zoho webhook signature verification (HMAC-SHA256)
// CRITICAL: Must be before express.json() to capture the raw payload
app.use('/api/zoho/webhooks/*', express.json({
  verify: (req: any, _res, buf) => {
    // Store raw body for HMAC verification
    req.rawBody = buf.toString('utf8');
  }
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

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
  if (req.path === '/api/payments/cashfree/webhook') {
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
        if (obj.hasOwnProperty(key)) {
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

// Request correlation middleware for request ID tracking
app.use(requestCorrelationMiddleware);

// Subdomain detection middleware - must come early to be available in all routes
app.use(subdomainDetection);

// Compliance monitoring middleware
app.use(complianceMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      const logContext = {
        requestId: req.requestId,
        ...(capturedJsonResponse ? { response: capturedJsonResponse } : {})
      };
      logger.http(req.method, path, res.statusCode, duration, logContext);
    }
  });

  next();
});

(async () => {
  // Health check endpoints (must be before auth - no authentication required)
  const { healthCheck, readinessCheck, livenessCheck, metricsEndpoint, cacheStatsEndpoint } = await import('./health-check');
  app.get('/health', healthCheck);
  app.get('/ready', readinessCheck);
  app.get('/live', livenessCheck);
  app.get('/metrics', metricsEndpoint);
  app.get('/cache/stats', cacheStatsEndpoint);
  
  // Initialize authentication (Passport & sessions must be set up first)
  await setupReplitAuth(app);
  
  // Then add local email/mobile authentication routes
  setupLocalAuth(app);
  
  // Register Zoho integration routes
  const zohoRoutes = await import('./zoho/routes');
  app.use('/api/zoho', zohoRoutes.default);
  
  // Register Agent Onboarding routes
  const agentRoutes = await import('./agent-routes');
  app.use(agentRoutes.default);
  
  // Register KYC Vault routes (Production-grade KYC system)
  const { registerKYCVaultRoutes } = await import('./kyc-vault-routes');
  registerKYCVaultRoutes(app);
  
  // Register KYC Priority Workflow routes (4-tier verification: CKYC → KRA → Video → Manual)
  const { registerKYCPriorityRoutes } = await import('./kyc-priority-routes');
  registerKYCPriorityRoutes(app);
  
  // Register Marketing Automation routes (Zoho Campaigns, AiSensy, Probe42)
  const { registerMarketingRoutes } = await import('./marketing-routes');
  registerMarketingRoutes(app);
  
  // Register User Management routes (Admin user CRUD operations)
  const { registerUserManagementRoutes } = await import('./user-management-routes');
  registerUserManagementRoutes(app);
  
  // Register Stakeholder routes (Partners, Agents, Suppliers)
  const { registerStakeholderRoutes } = await import('./stakeholder-routes');
  registerStakeholderRoutes(app);
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    logger.info(`Server listening on port ${port}`, { port, environment: process.env.NODE_ENV || 'development' });
    
    // Initialize Capital Gains Tax Reminder Scheduler
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
    
    // Initialize Bond Catalog Service
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
    
    // Initialize Currency Exchange Service
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

    // Initialize Data Cleanup Cron Job
    try {
      import('./data-cleanup-cron').then(({ startDataCleanupCron }) => {
        startDataCleanupCron();
      }).catch(error => {
        console.error('❌ Failed to initialize data cleanup cron:', error);
      });
    } catch (error) {
      console.error('❌ Error importing data cleanup cron:', error);
    }
  });
})();
