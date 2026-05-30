import "dotenv/config";
import { type Express, type Request, type Response } from "express";
import { registerRoutes } from "./routes";
import { registerAuthRoutes } from "./auth";
import { storage } from "./storage";
import { logger } from "./logger";
import { bootState, logBootProgress } from "./utils/boot-state";
import { createCsrfProtection, generateCsrfToken } from "./middleware/csrf";
import { creditRatingsService } from "./services/credit-ratings-service";
import { symbolMappingService } from "./services/symbol-mapping-service";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { APP_VERSION } from "../shared/version";
import { subdomainDetection } from "./subdomain-middleware";
import { registerAuthEventConsumers } from "./services/auth-event-consumers";
import { startBackgroundSchedulers } from "./startup/background-schedulers";
import { validateRuntimeEnv } from "./config/runtime-env";
import { registerPrebootMiddleware } from "./startup/preboot-middleware";
import { authLimiter, otpLimiter, aiLimiter, adminCopilotLimiter, uploadLimiter } from "./middleware/rate-limiter";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

validateRuntimeEnv();

// ============================================================================
// PHASE 0: INFRASTRUCTURE & GLOBAL ERROR CATCHING
// ============================================================================

process.on('uncaughtException', (err) => {
  logger.error('❌ [FATAL] Uncaught Exception:', err);
  // Recovery actions are handled by auto-recovery-service if initialized
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('❌ [FATAL] Unhandled Rejection', new Error(String(reason)), { promise: String(promise) });
});

// ============================================================================
// PHASE 1: PRE-BOOT MIDDLEWARE & CORS
// ============================================================================

registerPrebootMiddleware(app);

// ============================================================================
// PHASE 2: EARLY SPA SAFETY ROUTE
// ============================================================================

/**
 * Register the SPA catch-all route immediately.
 * This ensures that if the async boot sequence (Phase 3) takes a long time
 * or fails partway through, the browser still receives index.html instead
 * of "Cannot GET /" or a raw Express error.
 *

* The frontend UI is designed to show a "Connecting to server..." splash 
 * screen until it receives a successful response from /api/boot-status.
 */
function registerSPACatchAll(expressApp: Express) {
  const distPath = path.resolve(__dirname, '..', 'dist', 'public');
  const indexPath = path.resolve(distPath, 'index.html');

  // Serve static files first
  expressApp.use(express.static(distPath));

  // Catch-all route for SPA navigation
  expressApp.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) return next();

    // In production, serve index.html for all SPA routes
    // This acts as a safety net if boot sequence hangs
    if (process.env.NODE_ENV === 'production') {
      res.sendFile(indexPath, (err) => {
        if (err) {
          logger.error('❌ Failed to serve SPA index.html:', err);
          res.status(500).send('System initializing... please refresh in 30 seconds.');
        }
      });
    } else {
      next();
    }
  });
}


// Register the catch-all immediately for production stability
if (process.env.NODE_ENV === 'production') {
  logger.info('🛡️  Registering SPA catch-all (Phase 2 safety)...');
  registerSPACatchAll(app);
}

// ============================================================================
// PHASE 2.5: BIND PORT IMMEDIATELY
// ============================================================================
// Bind the port BEFORE any async operations so Cloud Run's startup probe
// succeeds immediately. DB connection and route registration happen after.
const PORT = Number(process.env.PORT) || 5000;
const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info(`🚀 [v${APP_VERSION}] Server listening on port ${PORT} (Booting...)`);
  bootState.serverListening = true;
});

// ============================================================================
// PHASE 3: ASYNC BOOT SEQUENCE
// ============================================================================

(async () => {
  try {
    logBootProgress("Step 1: Starting database connection...");

    // Test database connection
    const { db } = await import('./db');
    const { sql } = await import('drizzle-orm');

    try {
      await db.execute(sql`SELECT 1`);
      logger.info('✅ Database connection established');
    } catch (dbErr) {
      // Log DB failure but do NOT crash — server is already listening
      logger.error('❌ Database connection failed:', dbErr);
      bootState.error = `DB Connection Error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`;
      // Continue booting so Cloud Run keeps the instance alive
    }

    if (process.env.RUN_STARTUP_MIGRATIONS === "true") {
      logBootProgress("Step 2: Checking schema migrations...");
      const { runStartupSchemaRepairs } = await import("./startup/schema-repairs");
      await runStartupSchemaRepairs();
    } else {
      logBootProgress("Step 2: Skipping startup schema repairs (run npm run db:repair or Cloud Run job)...");
    }

    logBootProgress("Step 3: Initializing Middleware & Auth...");

    // ── GLOBAL MIDDLEWARE ────────────────────────────────────────────────────
    // Subdomain detection must be first to set portal context flags
    app.use(subdomainDetection);


    // ── AUTH & MIDDLEWARE ────────────────────────────────────────────────────
    try {
      const { setupAuth: setupSessionAuth } = await import('./auth-setup');
      // registerAuthEventConsumers is now statically imported at top level

      // Step 3a: Initialize Session Store (Redis or Postgres)
      await setupSessionAuth(app);

      // Step 3b: Initialize Passport Strategies (Local, OTP, etc)
      registerAuthRoutes(app);

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

      // ── Auth + OTP rate limiters (must be after session, before routes serve) ──
      // tightest limits: 20 req/15min on all auth, 5 req/15min on OTP send only
      app.use('/api/login',        authLimiter);
      app.use('/api/register',     authLimiter);
      app.use('/api/otp/send',     otpLimiter);
      app.use('/api/login/request-otp', otpLimiter);
      app.use('/api/auth',         authLimiter);
    } catch (error: any) {
      logger.error('❌ [FATAL] Error in Step 3 block:', error);
      bootState.error = `Step 3 Error: ${error?.message || String(error)}`;
      throw error;
    }

    // ── CORE ROUTES ──────────────────────────────────────────────────────────
    logBootProgress("Step 4: Registering Core Routes...");
    logger.info('📦 Registering routes...');

    // Register Version API route
    const versionRoutes = await import('./routes/version');
    app.use(versionRoutes.default);

    // Register Zoho integration routes
    const zohoRoutes = await import('./zoho/routes');
    app.use('/api/zoho', zohoRoutes.default);

    // Register Firm Inventory
    const { registerFirmInventoryRoutes } = await import('./routes/firm-inventory');
    registerFirmInventoryRoutes(app);

    // Register Portal System Routes (Metadata, Config)
    const { registerPortalSystemRoutes } = await import('./routes/portal-system');
    registerPortalSystemRoutes(app);

    // Agent routes
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

    // Diagnostics for subdomain detection
    app.get("/api/internal/diagnostics", (req: any, res: any) => {
      res.json({
        hostname: req.hostname,
        subdomain: req.subdomain,
        portal: req.subdomain || 'main',
        headers: {
          host: req.get('host'),
          'x-forwarded-host': req.get('x-forwarded-host'),
          'x-forwarded-proto': req.get('x-forwarded-proto')
        },
        trustProxy: app.get('trust proxy')
      });
    });

    // Register Python Analytics Service proxy
    const pythonProxyRoutes = await import('./routes/python-proxy');
    app.use(pythonProxyRoutes.default);

    logBootProgress("Step 5: Registering KYC & User Management Routes...");

    const [
      kycVaultMod, marketingMod, adminProspectsMod, twilioWebhookMod,
      credhiveAnalyticsMod, userMgmtMod, stakeholderMod, autoPopMod,
      adminMiscMod,
    ] = await Promise.all([
      import('./kyc-vault-routes'),
      import('./marketing-routes'),
      import('./routes/admin-prospects'),
      import('./services/twilio-webhook-service'),
      import('./routes/credhive-analytics-routes'),
      import('./user-management-routes'),
      import('./stakeholder-routes'),
      import('./auto-population-routes'),
      import('./routes/admin-misc-routes'),
    ]);
    kycVaultMod.registerKYCVaultRoutes(app);
    marketingMod.registerMarketingRoutes(app);
    adminProspectsMod.registerAdminProspectRoutes(app);
    adminMiscMod.registerAdminMiscRoutes(app);
    app.use('/api/twilio', twilioWebhookMod.createTwilioWebhookRouter());
    app.use('/api/admin/analytics', credhiveAnalyticsMod.default);
    userMgmtMod.registerUserManagementRoutes(app);
    stakeholderMod.registerStakeholderRoutes(app);
    app.use('/api/auto-population', autoPopMod.autoPopulationRouter);

    logBootProgress("Step 6: Registering Marketplace & Regulatory Routes...");
    const [
      unlistedRoutes, complianceRoutes, bondMarketplaceRoutes, 
      bondSeedAdminRoutes, goldAdminRoutes, bondMarketplaceImprovements, 
      bondMarketplaceCalendarRoutes, regulatoryAuditNormsRoutes, regulatoryComplianceRoutes
    ] = await Promise.all([
      import('./routes/unlisted'),

import('./routes/compliance'),
      import('./routes/bond-marketplace'),
      import('./routes/bond-seed-admin'),
      import('./routes/gold-admin'),
      import('./routes/bond-marketplace-improvements'),
      import('./routes/bond-calendar-routes'),
      import('./routes/regulatory-audit-norms-routes'),
      import('./routes/regulatory-compliance-routes'),
    ]);
    app.use('/api/unlisted', unlistedRoutes.default);
    app.use('/api/compliance', complianceRoutes.default);
    app.use('/api', regulatoryComplianceRoutes.default);
    app.use('/api/admin/regulatory-audit', regulatoryAuditNormsRoutes.default);
    app.use('/api/bonds', bondMarketplaceRoutes.default);
    app.use('/api/admin/bond-seed', bondSeedAdminRoutes.default);
    app.use('/api/migration', bondSeedAdminRoutes.migrationRouter);
    app.use('/api/admin/gold', goldAdminRoutes.default);
    app.use('/api/bonds', bondMarketplaceImprovements.default);
    app.use('/api/bond-calendar', bondMarketplaceCalendarRoutes.default);

    // Commission, framework, ISIN, alpha
    const [
      commissionConfigRoutes, regulatoryFrameworkRoutes, isinIntelligenceRoutes,
      aiAlphaEngineRoutes,
    ] = await Promise.all([
      import('./commission-config-routes'),
      import('./routes/regulatory-framework-routes'),
      import('./routes/isin-intelligence'),
      import('./routes/ai-alpha-engine'),
    ]);
    app.use('/api/admin', commissionConfigRoutes.default);
    app.use('/api/regulatory', regulatoryFrameworkRoutes.default);
    app.use('/api/isin', isinIntelligenceRoutes.default);
    app.use('/api/ai', aiLimiter);
    app.use('/api/ai', aiAlphaEngineRoutes.default);

    // Pick of the Day Routes
    logBootProgress("Step 7: Registering Pick of the Day Routes...");
    const picksRoutes = await import('./routes/pick-of-the-day');
    app.use('/api/picks', picksRoutes.default);

    // MPAL Routes
    logBootProgress("Step 8: Registering MPAL Routes...");
    const mpalRoutes = await import('./routes/mpal-routes');
    app.use('/api/mpal', mpalRoutes.mpalRouter);

    // UniPortfolio — Multi-Broker Unified Portfolio + Quant Engine context
    logBootProgress("Step 8b: Registering UniPortfolio Routes...");
    const uniPortfolioRoutes = await import('./routes/uni-portfolio-routes');
    app.use('/api/portfolio', uniPortfolioRoutes.uniPortfolioRouter);

    // Admin Copilot — AI-powered admin assistant (Zoho Mail/CRM/Desk/Books/Meeting)
    logBootProgress("Step 8c: Registering Admin Copilot Routes...");
    const { adminCopilotRouter } = await import('./routes/admin-copilot-routes');
    app.use('/api/admin/copilot', adminCopilotLimiter);
    app.use('/api/admin/copilot', adminCopilotRouter);

    // Alpaca Ribbit Integration Routes
    const alpacaRoutes = await import('./routes/alpaca/index');
    app.use('/api/alpaca', alpacaRoutes.default);

    // IRIS KFintech Integration Routes
    logBootProgress("Step 9: Registering IRIS KFintech Routes...");
    const { registerIrisKfintechRoutes } = await import('./routes/iris-kfintech-routes');
    registerIrisKfintechRoutes(app);

    // ── FINALIZATION ─────────────────────────────────────────────────────────

    // Boot audit event
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
            appVersion: APP_VERSION,
            timestamp: new Date().toISOString(),
          },
        });
      } catch {}
    })();

    // ── REGISTER BUSINESS ROUTES ─────────────────────────────────────────────
    // Call the centralized route registration to ensure all API endpoints are up
    logBootProgress("Step 11: Registering Business Logic Routes...");
    await registerRoutes(app);
    bootState.routesReady = true;

    logBootProgress("Step 12: Boot sequence complete. Server is operational.");

    startBackgroundSchedulers();

  } catch (error: any) {
    logger.error('❌ [FATAL] Server initialization failed:', error);
    bootState.error = `Boot Error: ${error?.message || String(error)}`;

    // In production, try to serve SPA even if boot failed partially
    if (process.env.NODE_ENV === 'production') {
      try { registerSPACatchAll(app); } catch (_) {}

    }
  }
})();
