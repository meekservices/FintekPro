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
import "./services/sms-service"; // Initialize SMS service
import { bootState, logBootProgress } from './boot-status';
import { registerAuthEventConsumers } from "./services/auth-event-consumers";
import { isProductionEnvironment } from "./utils/enrichment-guard";

// Ensure static build is available for production deployments
// Vite builds to dist/public, but serveStatic expects server/public
function ensureStaticBuild(): void {
  if (process.env.NODE_ENV === 'production') {
    const buildPath = path.resolve(process.cwd(), 'dist', 'public');
    const publicPath = path.resolve(process.cwd(), 'server', 'public');
    
    try {
      if (fs.existsSync(buildPath) && !fs.existsSync(publicPath)) {
        console.log('📦 [Static] Creating symlink for static assets...');
        fs.mkdirSync(path.dirname(publicPath), { recursive: true });
        fs.symlinkSync(buildPath, publicPath, 'dir');
      }
    } catch (err) {
      console.warn('⚠️ [Static] Symlink creation failed (non-fatal):', err);
    }
  }
}

// Security: Generate a secure CSRF token
function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

// Security: Middleware for CSRF protection
function createCsrfProtection() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only verify non-GET/HEAD/OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    
    const token = req.headers['x-csrf-token'];
    const sessionToken = (req.session as any)?.csrfToken;
    
    if (!token || !sessionToken || token !== sessionToken) {
      console.warn(`[Security] CSRF mismatch for ${req.method} ${req.path}`);
      return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    
    next();
  };
}

const app = express();

// Initialize Boot State Tracker
bootState.reset();
logBootProgress("Step 0: Initializing server process...");

// Trust proxy for secure cookies on Cloud Run
app.set("trust proxy", 1);

// Global Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.googletagmanager.com", "https://*.stripe.com", "https://*.razorpay.com", "https://*.firebaseapp.com", "https://*.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "https://*.google-analytics.com", "https://*.googletagmanager.com", "https://*.razorpay.com", "https://*.stripe.com"],
      connectSrc: ["'self'", "https://*.google-analytics.com", "https://*.analytics.google.com", "https://*.googletagmanager.com", "https://*.stripe.com", "https://*.razorpay.com", "https://*.firebaseio.com", "https://*.googleapis.com", "https://*.algolia.net", "https://*.algolianet.com", "ws:", "wss:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      frameSrc: ["'self'", "https://*.stripe.com", "https://*.razorpay.com", "https://*.firebaseapp.com"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());
app.use(cors({
  origin: true,
  credentials: true,
  exposedHeaders: ['x-csrf-token']
}));

// Apply latency tracking early
app.use(latencyTrackingMiddleware);

// Request ID and Context
app.use(requestContextMiddleware);

// Diagnostic/Logging Middlewares
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let resSent = false;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (res.statusCode >= 400) {
        console.warn(`⚠️ [API] ${logLine}`);
      } else {
        // Only log 200s in dev or for critical paths
        if (process.env.NODE_ENV !== 'production' || duration > 1000) {
          console.log(`[API] ${logLine}`);
        }
      }
    }
  });

  next();
});

// Setup Global Error/Monitoring Middlewares
app.use(errorMonitoringMiddleware);
app.use(sensitiveDataMaskingMiddleware);
app.use(auditTrailMiddleware);

// Subdomain & Portal Detection
app.use(subdomainDetection);

// ── Startup sequence: Service health enrichment ───────────────────────────
(async () => {
  try {
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL;
    if (pythonServiceUrl) {
      console.log(`🚀 [Python] Connected to: ${pythonServiceUrl}`);
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

    logBootProgress("Step 1: Setting up Health Checks & Verifying Database...");
    
    // CRITICAL: Setup health check routes IMMEDIATELY so the load balancer sees us as "up"
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
      // Liveness is just "process is running and listening"
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
    
    logBootProgress("Step 2: Initializing Session Authentication...");
    // Initialize authentication (Passport & sessions must be set up first)
    await setupSessionAuth(app);
    
    // Then add local email/mobile authentication routes
    setupLocalAuth(app);
    
    // Auth is now ready
    bootState.authReady = true;
    logBootProgress("Step 3: Auth Ready. Auditing Regulatory Env...");
    console.log(`✅ Auth ready (${bootState.getBootTime()}ms)`);

    try {
      logBootProgress("Step 3a: Logging Gateway Readiness...");
      // Log API gateway readiness (instrument-specific: MF=Iris, US=Alpaca, Indian=IIFL, etc.)
      try {
        const { logGatewayReadinessSummary } = await import('./services/api-gateway-readiness');
        logGatewayReadinessSummary();
      } catch (e) { 
        console.warn('⚠️ [GatewayReadiness] Summary failed (non-fatal):', e);
      }

      logBootProgress("Step 3b: Auditing Env Vars...");

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
        const msg = `[EnvAudit] ⚠️  Missing ${env.severity.toUpperCase()}: ${env.key} — ${env.purpose}`;
        if (env.severity === 'critical') { console.error(msg); missingCritical.push(env.key); }
        else if (env.severity === 'high') { console.warn(msg); missingHigh.push(env.key); }
        else { console.warn(msg); missingMedium.push(env.key); }
      }
    }
    if (missingCritical.length > 0) {
      console.error(`[EnvAudit] ❌ ${missingCritical.length} CRITICAL compliance env vars missing. Platform is operating in a degraded, non-compliant state.`);
    } else {
      console.log(`[EnvAudit] ✅ All critical compliance env vars present. ${missingHigh.length} high + ${missingMedium.length} medium warnings.`);
    }

      logBootProgress("Step 3c: Registering Auth Consumers...");
      // Register auth event consumers (structured logging + high-risk DB persistence)
      registerAuthEventConsumers();

      logBootProgress("Step 3d: Setting up CSRF...");

    
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
      bootState.error = `Step 3 Error: ${error?.message || String(error)}`;
      // Do NOT rethrow yet so outer catch can still force ready if needed
      throw error;
    }
    
    // Continue registering routes asynchronously (server is already listening)
    logBootProgress("Step 4: Registering Core Routes...");
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

    // ── Business Intelligence & Analytics ────────────────────────────────────
    const [
      amlRoutes, complianceRoutes, biRoutes, autoPopulateRoutes, kycVaultRoutes,
      commissionRoutes, stakeholderRoutes, roleRoutes, userMgmtRoutes,
    ] = await Promise.all([
      import('./aml-routes'),
      import('./compliance-routes'),
      import('./routes/bi-routes'),
      import('./auto-population-routes'),
      import('./kyc-vault-routes'),
      import('./commission-config-routes'),
      import('./stakeholder-routes'),
      import('./role-routes'),
      import('./user-management-routes'),
    ]);
    app.use(amlRoutes.default);
    app.use(complianceRoutes.default);
    app.use(biRoutes.default);
    app.use(autoPopulateRoutes.default);
    app.use(kycVaultRoutes.default);
    app.use(commissionRoutes.default);
    app.use(stakeholderRoutes.default);
    app.use(roleRoutes.default);
    app.use(userMgmtRoutes.default);

    // ── Product-specific routes ──────────────────────────────────────────────
    const [
      orderRoutes, taxRoutes, form15Routes, smartInvestRoutes, yieldTrackerRoutes,
    ] = await Promise.all([
      import('./order-routes'),
      import('./tax-routes'),
      import('./form15-routes'),
      import('./routes/smart-investment-routes'),
      import('./routes/yield-tracker-routes'),
    ]);
    app.use(orderRoutes.default);
    app.use(taxRoutes.default);
    app.use(form15Routes.default);
    app.use(smartInvestRoutes.default);
    app.use(yieldTrackerRoutes.default);

    logBootProgress("Step 5: Finalizing Core Route Registration...");
    const { registerRoutes: registerLegacyRoutes } = await import('./routes');
    await registerLegacyRoutes(app);

    logBootProgress("Step 6: Executing Database Migrations (Phase 1)...");
    
    // ============================================================================
    // DATABASE ENHANCEMENTS & MIGRATIONS
    // ============================================================================
    // Ensure critical columns and indices exist before the app starts serving 
    // traffic that depends on them. 
    try {
      const { db: bootstrapDb } = await import('./db');
      const { sql: bootstrapSql } = await import('drizzle-orm');
      
      const dedupAndIndex = async (tableName: string, dedupSql: string, indexSql: string) => {
        try {
          console.log(`🔨 [Migration] Optimizing ${tableName}...`);
          await bootstrapDb.execute(bootstrapSql.raw(dedupSql));
          await bootstrapDb.execute(bootstrapSql.raw(indexSql));
        } catch (err: any) {
          console.warn(`⚠️  [Migration] ${tableName} index failed:`, err.message);
        }
      };

      // 1. users (userId)
      await dedupAndIndex(
        'users',
        `DELETE FROM users 
         WHERE id NOT IN (
           SELECT DISTINCT ON (user_id) id 
           FROM users 
           ORDER BY user_id, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_users_user_id ON users (user_id)`
      );

      // 2. users (email)
      await dedupAndIndex(
        'users',
        `DELETE FROM users 
         WHERE id NOT IN (
           SELECT DISTINCT ON (email) id 
           FROM users 
           WHERE email IS NOT NULL
           ORDER BY email, id DESC
         )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email) WHERE email IS NOT NULL`
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

  logBootProgress("Step 7: Executing Database Migrations (Phase 2)...");
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
    console.warn('[Migration] UNIQUE index sequence skipped:', e?.message);
  }

  // PHASE 2 MIGRATIONS (BACKGROUND)
  // ============================================================================
  // These migrations add missing columns and create utility tables. They are
  // executed in the background via setImmediate to avoid blocking the main boot
  // sequence and triggering Cloud Run timeouts.
  setImmediate(async () => {
    try {
      const { db: migDb } = await import('./db');
      const { sql: migSql } = await import('drizzle-orm');

      logBootProgress("Background: Starting Phase 2 Database Migrations...");

      // 1. mca_financial_snapshot.data_completeness
      try {
        await migDb.execute(migSql.raw(`
          ALTER TABLE mca_financial_snapshot 
          ADD COLUMN IF NOT EXISTS data_completeness JSONB DEFAULT '{}'::jsonb
        `));
      } catch (e: any) { console.warn('[Migration] MCA completeness failed:', e.message); }

      // 2. audit_trail.risk_level
      try {
        await migDb.execute(migSql.raw(`
          ALTER TABLE compliance_audit_trail
          ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'low'
        `));
      } catch (e: any) { console.warn('[Migration] Audit risk level failed:', e.message); }

      // 3. insurance_policies.premium_frequency
      try {
        await migDb.execute(migSql.raw(`
          ALTER TABLE insurance_policies
          ADD COLUMN IF NOT EXISTS premium_frequency TEXT DEFAULT 'annual'
        `));
      } catch (e: any) { console.warn('[Migration] Premium frequency failed:', e.message); }

      // 4. users.last_password_change (SEBI CSCRF §8)
      try {
        await migDb.execute(migSql.raw(`
          ALTER TABLE users
          ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP DEFAULT NOW()
        `));
      } catch (e: any) { console.warn('[Migration] Password change tracking failed:', e.message); }

      // 5. Create index_refresh_logs table if not exists
      try {
        await migDb.execute(migSql.raw(`
          CREATE TABLE IF NOT EXISTS index_refresh_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            index_name TEXT NOT NULL,
            table_name TEXT NOT NULL,
            refresh_type TEXT NOT NULL,
            status TEXT NOT NULL,
            started_at TIMESTAMP DEFAULT NOW(),
            completed_at TIMESTAMP,
            error_message TEXT
          )
        `));
      } catch (e: any) { console.warn('[Migration] Refresh logs table failed:', e.message); }

      logBootProgress("Background: Database Migrations (Phase 2) complete.");
    } catch (err: any) {
      console.error('❌ [Migration] Background sequence failed:', err.message);
    }
  });

  logBootProgress("Step 8: Global Error Handler Attached.");
  // Error Handling (must be after all routes)
  app.use(globalErrorHandler);

  logBootProgress("Step 9: Serving Static Assets...");
  // Static assets and catch-all for SPA
  if (process.env.NODE_ENV === 'production') {
    ensureStaticBuild();
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(app);
  }
  
  // Register SPA catch-all (ensures frontend routing works)
  registerSPACatchAll(app);

  logBootProgress("Step 10: Initializing Background Tasks...");
  // Initialize cron jobs and background services
  try {
    await initializeCronJobs();
  } catch (err: any) {
    console.error('⚠️  [Cron] Initialization failed (non-fatal):', err.message);
  }

  logBootProgress("Step 11: Finalizing Boot Diagnostics...");
  // Server initialization diagnostics
  const server = http.createServer(app);
  const port = Number(process.env.PORT) || 5000;

  server.listen(port, "0.0.0.0", () => {
    bootState.serverListening = true;
    const time = bootState.getBootTime();
    console.log(`
  🚀 FintekPro Server ${process.env.npm_package_version || '1.0.0'}
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment: ${process.env.NODE_ENV || 'development'}
  Port:        ${port}
  Boot Time:   ${time}ms
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
    
    // Log final boot state
    logBootProgress(`Step 11a: Server listening on port ${port}`);
  });

  // Regulatory: Log deployment audit event
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

  // ============================================================================
  // PHASE 3: FINALIZATION & READINESS
  // ============================================================================
  
  // CRITICAL: Signal that the app is ready for traffic
  bootState.routesReady = true;
  logBootProgress("Step 12: Boot sequence complete. Server is fully operational.");

  // ============================================================================
  // PHASE 4: BACKGROUND SERVICES (NON-BLOCKING)
  // These start after routesReady=true so they don't delay the primary boot.
  // ============================================================================
  
  setTimeout(async () => {
    try {
      logBootProgress("Background: Starting schedulers and monitors...");
      
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
             console.error("❌ [Scheduler] MF returns initialization failed:", e);
           }
        }, 30000);

        // Bond Catalog (60s delay)
        setTimeout(async () => {
           try {
             const { bondCatalogService } = await import('./bond-catalog-service');
             bondCatalogService.startAutoRefresh();
           } catch (e) {
             console.error("❌ [Catalog] Bond service start failed:", e);
           }
        }, 60000);

        // Production Bootstrap (90s delay - very heavy)
        setTimeout(async () => {
           try {
             logBootProgress("Background: Starting heavy data bootstrap...");
             const { runProductionBootstrap } = await import('./production-bootstrap');
             await runProductionBootstrap();
             logBootProgress("Background: Data bootstrap complete.");
           } catch (e) {
             console.error("❌ [Bootstrap] Production data seeding failed:", e);
           }
        }, 90000);
      }

    } catch (err) {
      console.error("❌ [Boot] Error starting background services:", err);
    }
  }, 5000);

  } catch (error: any) {
    console.error('❌ [FATAL] Server initialization failed:', error);
    bootState.error = `Boot Error: ${error?.message || String(error)}`;
    // Ensure the SPA catch-all is registered even if boot failed partway through
    // so users see the frontend (with its own error handling) rather than "Cannot GET /"
    if (process.env.NODE_ENV === 'production') {
      try {
        registerSPACatchAll(app);
      } catch (_) { /* already registered — safe to ignore */ }
    }
    // REMOVED: bootState.routesReady = true; -> Do not lie about readiness on fatal error.
  }
})();
