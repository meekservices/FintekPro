// FintekPro Server - Main entry point
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
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
import { subdomainDetection } from "./subdomain-middleware";
import { initializeCronJobs } from "./cron-jobs";
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

// Raw body capture for webhook signature verification
app.use('/api/payments/cashfree/webhook', express.raw({ type: 'application/json' }));

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

      logger.http(req.method, path, res.statusCode, duration, capturedJsonResponse ? { response: capturedJsonResponse } : undefined);
    }
  });

  next();
});

(async () => {
  // Health check endpoints (must be before auth - no authentication required)
  const { healthCheck, readinessCheck, livenessCheck } = await import('./health-check');
  app.get('/health', healthCheck);
  app.get('/ready', readinessCheck);
  app.get('/live', livenessCheck);
  
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
  
  // Register Agent Revenue & Lead Pipeline routes
  const agentRevenueRoutes = await import('./routes/agent-revenue-routes');
  app.use(agentRevenueRoutes.default);
  
  // Register KYC Vault routes (Production-grade KYC system)
  const { registerKYCVaultRoutes } = await import('./kyc-vault-routes');
  registerKYCVaultRoutes(app);
  
  // Register Marketing Automation routes (Zoho Campaigns, AiSensy, Probe42)
  const { registerMarketingRoutes } = await import('./marketing-routes');
  registerMarketingRoutes(app);
  
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
  
  // Register MF Order Execution routes (SEBI-compliant buy/sell order management)
  const mfOrdersRoutes = await import('./routes/mf-orders');
  app.use(mfOrdersRoutes.default);
  
  // Register Unified Order Management routes (cross-product order lifecycle)
  const { registerOrderRoutes } = await import('./order-routes');
  registerOrderRoutes(app);
  console.log('✅ Unified Order Management routes registered');
  
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
  
  // Register CA (Chartered Accountant) routes
  const caRoutes = await import('./routes/ca-routes');
  app.use('/api/ca', caRoutes.default);
  console.log('✅ CA registration and assignment routes registered');
  
  // Register REIT/InvIT routes
  const reitInvitRoutes = await import('./routes/reit-invit-routes');
  app.use('/api/reit-invit', reitInvitRoutes.default);
  console.log('✅ REIT/InvIT investment routes registered');
  
  // Register error testing routes (development only)
  if (process.env.NODE_ENV === 'development') {
    const testErrorRoutes = await import('./test-error-handling');
    app.use('/api', testErrorRoutes.default);
  }
  
  registerRoleRoutes(app);
  const server = await registerRoutes(app);

  // Setup Vite BEFORE error handlers so it can serve the frontend
  // and its catch-all middleware doesn't conflict with API error handling
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Centralized error handling middleware (must be after all routes and Vite)
  const { errorHandler, notFoundHandler } = await import('./middleware/error-handler');
  app.use(notFoundHandler);
  app.use(errorHandler);

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
    
    // Initialize Retention Cleanup Service (8-year PMLA/RBI compliance)
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
      logger.service('Unlisted Marketplace Cron', 'Cron jobs initialized successfully');
    } catch (error) {
      logger.serviceError('Unlisted Marketplace Cron', 'Failed to initialize cron jobs', error instanceof Error ? error : undefined);
    }
  });
})();
