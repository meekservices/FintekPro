// FintekPro Server - Main entry point
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { validationResult } from "express-validator";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { complianceMiddleware } from "./compliance-monitor";
import { storage } from "./storage";
import { setupAuth } from "./auth";

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
  origin: process.env.NODE_ENV === "production" 
    ? ["https://*.replit.app", "https://*.repl.co", "https://fintekpro.com", "https://www.fintekpro.com"]
    : ["http://localhost:5000", "http://127.0.0.1:5000"],
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

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
});

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

      log(logLine);
    }
  });

  next();
});

// Initialize authentication routes
setupAuth(app);

(async () => {
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
    log(`serving on port ${port}`);
    
    // Initialize Capital Gains Tax Reminder Scheduler
    try {
      import('./services/reminder-scheduler').then(({ reminderScheduler }) => {
        reminderScheduler.start();
        log('✅ Capital Gains Tax Reminder Scheduler initialized');
      }).catch(error => {
        console.error('❌ Failed to initialize reminder scheduler:', error);
      });
    } catch (error) {
      console.error('❌ Error importing reminder scheduler:', error);
    }
    
    // Initialize Bond Catalog Service
    try {
      import('./bond-catalog-service').then(({ bondCatalogService }) => {
        bondCatalogService.startAutoRefresh();
        log('✅ Bond Catalog Service initialized');
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
        log('✅ Alert Monitoring Service initialized');
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
        log('✅ Currency Exchange Service initialized');
      }).catch(error => {
        console.error('❌ Failed to initialize currency exchange service:', error);
      });
    } catch (error) {
      console.error('❌ Error importing currency exchange service:', error);
    }
  });
})();
