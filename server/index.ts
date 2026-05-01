import { type Express, type Request, type Response } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";
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
import cors from "cors";
import { subdomainDetection } from "./subdomain-middleware";
import { registerAuthEventConsumers } from "./services/auth-event-consumers";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ============================================================================
// PHASE 0: INFRASTRUCTURE & GLOBAL ERROR CATCHING
// ============================================================================

process.on('uncaughtException', (err) => {
  console.error('❌ [FATAL] Uncaught Exception:', err);
  // Recovery actions are handled by auto-recovery-service if initialized
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============================================================================
// PHASE 1: PRE-BOOT MIDDLEWARE & CORS
// ============================================================================

app.get("/api/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    booting: !bootState.routesReady,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Critical Health Check (Phase 1)
// registered early so Cloud Run health probes succeed during boot


const corsAllowedOrigins = [
  'https://fintekpro.com',
  'https://www.fintekpro.com',
  'https://admin.fintekpro.com',
  'https://agent.fintekpro.com',
  'https://partner.fintekpro.com',
  'https://ins.fintekpro.com',
  'https://fintekpro-app-7f3fb64pqq-el.a.run.app', 
  'https://fintekpro-app-124901641600.asia-south1.run.app', // Current production URL
];

// In development, allow localhost/Replit origins
if (process.env.NODE_ENV !== "production") {
  corsAllowedOrigins.push('http://localhost:5173');
  corsAllowedOrigins.push('http://localhost:5000');
  corsAllowedOrigins.push('http://0.0.0.0:5000');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow if:
    // 1. No origin (server-to-server or local)
    // 2. Explicitly listed in corsAllowedOrigins
    // 3. Subdomain of fintekpro.com
    // 4. Any GCP Cloud Run service in our project (fintekpro-app-*.run.app)
    const isAllowed = !origin || 
      corsAllowedOrigins.includes(origin) || 
      (typeof origin === 'string' && (
        origin.endsWith('.fintekpro.com') || 
        origin.includes('fintekpro-app') && origin.includes('.run.app') ||
        origin.includes('replit.dev') || 
        origin.includes('repl.co')
      ));

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked request from unauthorized origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['X-CSRF-Token']
}));

// Global boot status endpoint (available even in fallback mode)
app.get('/api/boot-status', (req, res) => {
  res.json({
    ready: bootState.routesReady,
    error: bootState.error,
    version: APP_VERSION,
    timestamp: new Date().toISOString()
  });
});

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
          console.error('❌ Failed to serve SPA index.html:', err);
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
  console.log('🛡️  Registering SPA catch-all (Phase 2 safety)...');
  registerSPACatchAll(app);
}

// ============================================================================
// PHASE 3: ASYNC BOOT SEQUENCE
// ============================================================================

(async () => {
  try {
    logBootProgress("Step 1: Starting database connection...");

    // Test database connection immediately
    const { db } = await import('./db');
    const { sql } = await import('drizzle-orm');

    try {
      await db.execute(sql`SELECT 1`);
      console.log('✅ Database connection established');
    } catch (dbErr) {
      console.error('❌ Database connection failed:', dbErr);
      throw new Error(`DB Connection Error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
    }

    logBootProgress("Step 2: Checking schema migrations...");
    // ── DATABASE REPAIR & MIGRATION ──────────────────────────────────────────
    // Perform critical schema updates needed for boot.
    // We use a dedicated try/catch so migration errors don't necessarily 
    // kill the whole server if the core tables are still functional.
    try {
      const { db: migDb } = await import('./db');
      const { sql: migSql } = await import('drizzle-orm');

      console.log('🛠️ Running schema migrations/repairs...');

      // 1. ca_verification_status
      try {
        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS ca_verification_status (
            id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
            icai_membership_number VARCHAR,
            pan_number VARCHAR,
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
            cookies      JSONB NOT NULL,
            expires_at   TIMESTAMPTZ NOT NULL,
            created_at   TIMESTAMPTZ DEFAULT NOW()
          );
        `);
      } catch (e: any) {
        console.warn('[Migration] iris_sessions table skipped:', e?.message);
      }

      // 18. compliance_audit_trail repair
      try {
        await migDb.execute(migSql`
          ALTER TABLE compliance_audit_trail 
            ADD COLUMN IF NOT EXISTS field_changed varchar,
            ADD COLUMN IF NOT EXISTS entity_id varchar,
            ADD COLUMN IF NOT EXISTS entity_type varchar,
            ADD COLUMN IF NOT EXISTS performed_by varchar,
            ADD COLUMN IF NOT EXISTS performed_by_role varchar,
            ADD COLUMN IF NOT EXISTS old_value jsonb,
            ADD COLUMN IF NOT EXISTS new_value jsonb,
            ADD COLUMN IF NOT EXISTS risk_impact varchar,
            ADD COLUMN IF NOT EXISTS compliance_impact varchar,
            ADD COLUMN IF NOT EXISTS reason text,
            ADD COLUMN IF NOT EXISTS metadata jsonb,
            ADD COLUMN IF NOT EXISTS timestamp timestamp DEFAULT NOW();
        `);
        console.log('✅ compliance_audit_trail schema verified');
      } catch (e: any) {
        console.warn('[Migration] compliance_audit_trail repair skipped:', e?.message);
      }

      // 19. daily_picks table and enums
      try {
        // Create enums if they don't exist
        await migDb.execute(migSql`
          DO $$ 
          BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pick_category') THEN
                  CREATE TYPE pick_category AS ENUM ('listed_stocks', 'mutual_funds', 'bonds', 'unlisted', 'global_stocks', 'etfs', 'reits_invits', 'fixed_deposits', 'sgb', 'derivatives');
              END IF;
              IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pick_status') THEN
                  CREATE TYPE pick_status AS ENUM ('live', 'target_hit', 'stoploss_hit', 'expired');
              END IF;
          END $$;
        `);

        await migDb.execute(migSql`
          CREATE TABLE IF NOT EXISTS daily_picks (
            id SERIAL PRIMARY KEY,
            category pick_category NOT NULL DEFAULT 'listed_stocks',
            instrument_id VARCHAR(100),
            instrument_name VARCHAR(255) NOT NULL,
            isin VARCHAR(12),
            symbol VARCHAR(50),
            market VARCHAR(20),
            exchange VARCHAR(20),
            reco_date DATE,
            reco_price NUMERIC(18, 4),
            target_price NUMERIC(18, 4),
            stoploss_price NUMERIC(18, 4),
            current_price NUMERIC(18, 4),
            status pick_status DEFAULT 'live',
            expiry_date DATE,
            status_updated_at TIMESTAMPTZ,
            return_pct NUMERIC(8, 2),
            days_held INTEGER,
            rationale TEXT,
            risk_level VARCHAR(20),
            suitable_for TEXT[],
            time_horizon VARCHAR(20),
            confidence_score INTEGER,
            sector_category VARCHAR(100),
            key_metrics JSONB,
            generated_by VARCHAR(50),
            scoring_version VARCHAR(20),
            scoring_breakdown JSONB,
            risk_score INTEGER,
            is_active BOOLEAN DEFAULT true,
            is_live BOOLEAN DEFAULT false,
            published_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
        `);

        // Add missing columns if table already existed with old schema
        await migDb.execute(migSql`
          DO $$ 
          BEGIN
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='category') THEN
                  ALTER TABLE daily_picks ADD COLUMN category pick_category NOT NULL DEFAULT 'listed_stocks';
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='instrument_id') THEN
                  ALTER TABLE daily_picks ADD COLUMN instrument_id VARCHAR(100);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='instrument_name') THEN
                  ALTER TABLE daily_picks ADD COLUMN instrument_name VARCHAR(255) DEFAULT '';
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='isin') THEN
                  ALTER TABLE daily_picks ADD COLUMN isin VARCHAR(12);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='reco_date') THEN
                  ALTER TABLE daily_picks ADD COLUMN reco_date DATE;
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='reco_price') THEN
                  ALTER TABLE daily_picks ADD COLUMN reco_price NUMERIC(18, 4);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='stoploss_price') THEN
                  ALTER TABLE daily_picks ADD COLUMN stoploss_price NUMERIC(18, 4);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='status') THEN
                  ALTER TABLE daily_picks ADD COLUMN status pick_status DEFAULT 'live';
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='expiry_date') THEN
                  ALTER TABLE daily_picks ADD COLUMN expiry_date DATE;
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='suitable_for') THEN
                  ALTER TABLE daily_picks ADD COLUMN suitable_for TEXT[];
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='confidence_score') THEN
                  ALTER TABLE daily_picks ADD COLUMN confidence_score INTEGER;
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='target_price') THEN
                  ALTER TABLE daily_picks ADD COLUMN target_price NUMERIC(18, 4);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='current_price') THEN
                  ALTER TABLE daily_picks ADD COLUMN current_price NUMERIC(18, 4);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='time_horizon') THEN
                  ALTER TABLE daily_picks ADD COLUMN time_horizon VARCHAR(20);
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='key_metrics') THEN
                  ALTER TABLE daily_picks ADD COLUMN key_metrics JSONB;
              END IF;
              IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_picks' AND column_name='rationale') THEN
                  ALTER TABLE daily_picks ADD COLUMN rationale TEXT;
              END IF;
          END $$;
        `);
        console.log('✅ daily_picks schema verified and updated');
      } catch (e: any) {
        console.error('[Migration] daily_picks table error:', e?.message);
      }

      console.log('✅ Critical schema repairs complete');
    } catch (migErr) {
      console.error('❌ Migration sequence failed (non-fatal):', migErr);
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
      setupAuth(app);

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
      throw error;
    }

    // ── CORE ROUTES ──────────────────────────────────────────────────────────
    logBootProgress("Step 4: Registering Core Routes...");
    console.log('📦 Registering routes...');

    // Register Version API route
    const versionRoutes = await import('./routes/version');
    app.use(versionRoutes.default);

    // Register Zoho integration routes
    const zohoRoutes = await import('./zoho/routes');
    app.use('/api/zoho', zohoRoutes.default);

    // Register Firm Inventory
    const { registerFirmInventoryRoutes } = await import('./routes/firm-inventory');
    registerFirmInventoryRoutes(app);

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
    marketingMod.registerMarketingRoutes(app);
    adminProspectsMod.registerAdminProspectRoutes(app);
    app.use('/api/twilio', twilioWebhookMod.createTwilioWebhookRouter());
    app.use('/api/admin/analytics', credhiveAnalyticsMod.default);
    userMgmtMod.registerUserManagementRoutes(app);
    stakeholderMod.registerStakeholderRoutes(app);
    app.use('/api/auto-population', autoPopMod.autoPopulationRouter);

    logBootProgress("Step 6: Registering Marketplace & Regulatory Routes...");
    const [
      unlistedRoutes, complianceRoutes, bondMarketplaceRoutes, 
      bondSeedAdminRoutes, goldAdminRoutes, bondMarketplaceImprovements, 
      bondMarketplaceCalendarRoutes, regulatoryAuditNormsRoutes
    ] = await Promise.all([
      import('./routes/unlisted'),
      import('./routes/compliance'),
      import('./routes/bond-marketplace'),
      import('./routes/bond-seed-admin'),
      import('./routes/gold-admin'),
      import('./routes/bond-marketplace-improvements'),
      import('./routes/bond-calendar-routes'),
      import('./routes/regulatory-audit-norms-routes'),
    ]);
    app.use('/api/unlisted', unlistedRoutes.default);
    app.use('/api/compliance', complianceRoutes.default);
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
    app.use('/api/ai', aiAlphaEngineRoutes.default);

    // Pick of the Day Routes
    logBootProgress("Step 7: Registering Pick of the Day Routes...");
    const picksRoutes = await import('./routes/pick-of-the-day');
    app.use('/api/picks', picksRoutes.default);

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

    // Signal readiness
    bootState.routesReady = true;

    // ── REGISTER BUSINESS ROUTES ─────────────────────────────────────────────
    // Call the centralized route registration to ensure all API endpoints are up
    logBootProgress("Step 11: Registering Business Logic Routes...");
    await registerRoutes(app);

    logBootProgress("Step 12: Boot sequence complete. Server is operational.");

    // Start listening AFTER routes are registered
    const PORT = Number(process.env.PORT) || 5000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 [v${APP_VERSION}] Server listening on port ${PORT}`);
    });

    // Start background services with delay
    setTimeout(async () => {
      if (process.env.NODE_ENV === 'production') {
        const { kycExpiryMonitor } = await import('./services/kyc-expiry-monitor');
        kycExpiryMonitor.start();
      }

      // Initialize Pick of the Day Scheduler
      try {
        console.log('📈 Starting Pick of the Day Scheduler...');
        const { pickOfTheDayService } = await import('./services/pick-of-the-day-service');
        pickOfTheDayService.startDailyScheduler();
      } catch (error) {
        console.error('❌ Failed to start Pick of the Day Scheduler:', error);
      }

      // Initialize AI Regulatory Monitoring
      try {
        const { activityInsightsService } = await import('./services/activity-insights-service');
        activityInsightsService.startAutomatedMonitoring();
      } catch (error) {
        console.error('❌ Failed to start AI Regulatory Monitoring:', error);
      }
    }, 5000);

  } catch (error: any) {
    console.error('❌ [FATAL] Server initialization failed:', error);
    bootState.error = `Boot Error: ${error?.message || String(error)}`;
    
    // In production, try to serve SPA even if boot failed partially
    if (process.env.NODE_ENV === 'production') {
      try { registerSPACatchAll(app); } catch (_) {}
      
      // Still listen so we can serve the "System initializing" error message
      const PORT = Number(process.env.PORT) || 5000;
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`⚠️ Server listening in fallback mode on port ${PORT}`);
      });
    }
  }
})();
