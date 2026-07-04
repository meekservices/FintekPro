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
import {
	authLimiter,
	otpLimiter,
	aiLimiter,
	adminCopilotLimiter,
	uploadLimiter,
} from "./middleware/rate-limiter";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

validateRuntimeEnv();

// ============================================================================
// PHASE 0: INFRASTRUCTURE & GLOBAL ERROR CATCHING
// ============================================================================

process.on("uncaughtException", (err) => {
	logger.error("❌ [FATAL] Uncaught Exception:", err);
	// Recovery actions are handled by auto-recovery-service if initialized
});

process.on("unhandledRejection", (reason, promise) => {
	logger.error(
		"❌ [FATAL] Unhandled Rejection",
		{ promise: String(promise) },
		new Error(String(reason)),
	);
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
	const distPath = path.resolve(__dirname, "..", "dist", "public");
	const indexPath = path.resolve(distPath, "index.html");

	// Serve static files first
	expressApp.use(express.static(distPath));

	// Catch-all route for SPA navigation
	expressApp.get("*", (req, res, next) => {
		// Skip API routes
		if (req.path.startsWith("/api")) return next();

		// In production, serve index.html for all SPA routes
		// This acts as a safety net if boot sequence hangs
		if (process.env.NODE_ENV === "production") {
			res.sendFile(indexPath, (err) => {
				if (err) {
					logger.error("❌ Failed to serve SPA index.html:", err);
					res
						.status(500)
						.send("System initializing... please refresh in 30 seconds.");
				}
			});
		} else {
			next();
		}
	});
}

// Register the catch-all immediately for production stability
if (process.env.NODE_ENV === "production") {
	logger.info("🛡️  Registering SPA catch-all (Phase 2 safety)...");
	registerSPACatchAll(app);
}

// ============================================================================
// PHASE 2.5: BIND PORT IMMEDIATELY
// ============================================================================
// Bind the port BEFORE any async operations so Cloud Run's startup probe
// succeeds immediately. DB connection and route registration happen after.
const PORT = Number(process.env.PORT) || 5000;
const server = app.listen(PORT, "0.0.0.0", () => {
	logger.info(
		`🚀 [v${APP_VERSION}] Server listening on port ${PORT} (Booting...)`,
	);
	bootState.serverListening = true;
});

// ============================================================================
// PHASE 3: ASYNC BOOT SEQUENCE
// ============================================================================

(async () => {
	try {
		logBootProgress("Step 1: Starting database connection...");

		// Test database connection
		const { db } = await import("./db");
		const { sql } = await import("drizzle-orm");

		try {
			await db.execute(sql`SELECT 1`);
			logger.info("✅ Database connection established");

			// ── Pool warmup: pre-open connections so Cold Run pod startup
			// doesn't exhaust the pool when the first burst of user requests
			// (e.g. KYC profile loads) arrive simultaneously. ────────────────
			Promise.allSettled(
				Array.from({ length: 5 }, () => db.execute(sql`SELECT 1`)),
			).then(() =>
				logger.info("✅ DB connection pool warmed up (5 connections)"),
			);
		} catch (dbErr) {
			// Log DB failure but do NOT crash — server is already listening
			logger.error(
				"❌ Database connection failed:",
				dbErr instanceof Error ? dbErr : new Error(String(dbErr)),
			);
			bootState.error = `DB Connection Error: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`;
			// Continue booting so Cloud Run keeps the instance alive
		}

		// ── STARTUP MIGRATIONS — run in background after routes are live ──────────────
		// CRITICAL FIX: Deferred to fire-and-forget so routesReady=true is set within
		// ~2-3s of boot. Previously ran synchronously, causing 3-4 min of 503s on
		// ALL API calls (including /api/login) before routes were registered.
		if (process.env.RUN_STARTUP_MIGRATIONS === "true") {
			void (async () => {
				try {
					logBootProgress("Step 2 (bg): Checking schema migrations...");
					const { runStartupSchemaRepairs } = await import(
						"./startup/schema-repairs"
					);
					await runStartupSchemaRepairs();

					// Seed model portfolio holdings (idempotent)
					logBootProgress("Step 2b (bg): Seeding model portfolio holdings...");
					const { seedModelPortfolioHoldings } = await import(
						"./startup/model-portfolio-holdings-seed"
					);
					await seedModelPortfolioHoldings();

					// FASP-AI v3.0 — create dynamic portfolio management tables
					logBootProgress("Step 2c (bg): FASP-AI v3.0 schema migrations...");
					const { runFASPAIv3Migrations, applyPhaseB_HoldingsUniqueIndex } = await import("./startup/schema-repairs");
					await runFASPAIv3Migrations();

					// Phase B — unique index + auto-migrate JSONB holdings → relational table
					logBootProgress("Step 2d (bg): Phase B — model_portfolio_holdings migration...");
					await applyPhaseB_HoldingsUniqueIndex();
					const { ensureHoldingsRelationalTablePopulated } = await import(
						"./services/model-portfolio-holdings-service"
					);
					await ensureHoldingsRelationalTablePopulated();

					// De-duplication: ensure shared route tables (agent_notifications,
					// partner_team_members, partner_agent_invitations) are created
					// from a single canonical source — not 11+ scattered route files.
					logBootProgress("Step 2e (bg): Ensuring shared route tables...");
					const { ensureSharedRouteTables } = await import("./startup/schema-repairs");
					await ensureSharedRouteTables();

					logBootProgress("Step 2 (bg): All schema migrations complete.");
				} catch (migErr: any) {
					logger.warn("[Boot] Background migration error (non-fatal):", migErr?.message);
				}
			})();
		} else {
			logBootProgress(
				"Step 2: Skipping startup schema repairs (run npm run db:repair or Cloud Run job)...",
			);
		}

		logBootProgress("Step 3: Initializing Middleware & Auth...");

		// ── SECURITY: Block common secret/config probe patterns ─────────────────
		// Returns 403 immediately — before CSRF, auth, or any route logic runs.
		// Protects against bots scanning for .env, .git, WordPress, phpinfo etc.
		// Evidence: /api/.env probe detected in Cloud Run logs 2026-06-27.
		const BLOCKED_PROBE_PREFIXES = [
			"/.env",
			"/api/.env",
			"/.git",
			"/.svn",
			"/wp-admin",
			"/wp-login",
			"/phpinfo",
			"/config.php",
			"/adminer",
			"/.DS_Store",
		];
		app.use((req, res, next) => {
			const path = req.path.toLowerCase();
			if (BLOCKED_PROBE_PREFIXES.some((p) => path.startsWith(p) || path === p)) {
				logger.warn("[SECURITY_PROBE_BLOCKED]", {
					event: "SECURITY_PROBE_BLOCKED",
					path: req.path,
					ip: req.ip,
					user_agent: req.headers["user-agent"]?.substring(0, 120) ?? "unknown",
					latency_ms: 0,
					status: "blocked",
				});
				return res.status(403).json({ error: "Forbidden" });
			}
			next();
		});

		// ── GLOBAL MIDDLEWARE ────────────────────────────────────────────────────
		// Subdomain detection must be first to set portal context flags
		app.use(subdomainDetection);


		// Acting-as context middleware — reads agent delegation session if present.
		// Must be after session middleware, before any route handlers.
		const { actingAsContextMiddleware } = await import("./middleware/acting-as-context");
		app.use(actingAsContextMiddleware);

		// ── AUTH & MIDDLEWARE ────────────────────────────────────────────────────
		try {
			const { setupAuth: setupSessionAuth } = await import("./auth-setup");
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
			app.get("/api/csrf-token", (req: Request, res: Response) => {
				if (!req.session) {
					return res.status(401).json({ error: "No session" });
				}

				const isNew = !(req.session as any).csrfToken;
				if (isNew) {
					(req.session as any).csrfToken = generateCsrfToken();
				}

				const token = (req.session as any).csrfToken;

				// Force-save the session so the token is persisted in the store.
				// This is critical for users going through the X-Session-ID fallback
				// path, where resave:false prevents automatic persistence.
				if (isNew) {
					req.session.save((err) => {
						if (err)
							logger.warn(
								"[CSRF] Failed to save session after token generation:",
								err,
							);
					});
				}

				res.json({ csrfToken: token });
			});

			// Apply CSRF protection after session/auth middleware
			app.use("/api", createCsrfProtection());

			// ── Auth + OTP rate limiters (must be after session, before routes serve) ──
			// tightest limits: 20 req/15min on all auth, 5 req/15min on OTP send only
			app.use("/api/login", authLimiter);
			app.use("/api/register", authLimiter);
			app.use("/api/otp/send", otpLimiter);
			app.use("/api/login/request-otp", otpLimiter);
			app.use("/api/auth", authLimiter);
		} catch (error: any) {
			logger.error("❌ [FATAL] Error in Step 3 block:", error);
			bootState.error = `Step 3 Error: ${error?.message || String(error)}`;
			throw error;
		}

		// ── CORE ROUTES ──────────────────────────────────────────────────────────
		logBootProgress("Step 4: Registering Core Routes...");
		logger.info("📦 Registering routes...");

		// ── Mobile App Routes (JWT auth + push notifications) ──────────────────
		const { mobileAuthRouter } = await import("./routes/mobile-auth");
		const { pushTokensRouter } = await import("./routes/push-tokens");
		const { notificationsRouter } = await import("./routes/notifications");
		app.use("/api/auth/mobile", mobileAuthRouter);
		app.use("/api/push-tokens", pushTokensRouter);
		app.use("/api/notifications", notificationsRouter);
		logger.info(
			"📱 Mobile auth, push token and FCM notification routes registered",
		);

		// Register Version API route
		const versionRoutes = await import("./routes/version");
		app.use(versionRoutes.default);

		// Register Zoho integration routes
		const zohoRoutes = await import("./zoho/routes");
		app.use("/api/zoho", zohoRoutes.default);

		// Register Firm Inventory
		const { registerFirmInventoryRoutes } = await import(
			"./routes/firm-inventory"
		);
		registerFirmInventoryRoutes(app);

		// Register Portal System Routes (Metadata, Config)
		const { registerPortalSystemRoutes } = await import(
			"./routes/portal-system"
		);
		registerPortalSystemRoutes(app);

		// Agent routes
		const [
			agentRoutes,
			agentRevenueRoutes,
			agentBasketsRoutes,
			agentSipHealthRoutes,
			agentPortfolioDriftRoutes,
			agentClientOrdersRoutes,
			agentMarketAlertsRoutes,
			agentTrackerRoutes,
		] = await Promise.all([
			import("./agent-routes"),
			import("./routes/agent-revenue-routes"),
			import("./routes/agent-baskets"),
			import("./routes/agent-sip-health"),
			import("./routes/agent-portfolio-drift"),
			import("./routes/agent-client-orders"),
			import("./routes/agent-market-alerts"),
			import("./routes/agent-tracker"),
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
				portal: req.subdomain || "main",
				headers: {
					host: req.get("host"),
					"x-forwarded-host": req.get("x-forwarded-host"),
					"x-forwarded-proto": req.get("x-forwarded-proto"),
				},
				trustProxy: app.get("trust proxy"),
			});
		});

		// Register Python Analytics Service proxy
		const pythonProxyRoutes = await import("./routes/python-proxy");
		app.use(pythonProxyRoutes.default);

		// ── CORE BUSINESS ROUTES — register FIRST so /api/login is immediately available ─
		// CRITICAL: routesReady=true is set right after registerRoutes() completes.
		// Steps 5-9b (KYC, marketplace, portfolio, algo) continue after the boot gate
		// opens, so they don't block user authentication.
		logBootProgress("Step 4b: Registering Core Business Routes (auth-critical)...");
		await registerRoutes(app);
		// ✔ Boot gate OPEN — /api/login, /api/user, /api/register are ready.
		bootState.routesReady = true;
		logBootProgress("Step 4b: Boot gate OPEN — server is serving auth requests.");

				logBootProgress("Step 5: Registering KYC & User Management Routes...");

		const [
			kycVaultMod,
			marketingMod,
			adminProspectsMod,
			twilioWebhookMod,
			credhiveAnalyticsMod,
			userMgmtMod,
			stakeholderMod,
			autoPopMod,
			adminMiscMod,
		] = await Promise.all([
			import("./kyc-vault-routes"),
			import("./marketing-routes"),
			import("./routes/admin-prospects"),
			import("./services/twilio-webhook-service"),
			import("./routes/credhive-analytics-routes"),
			import("./user-management-routes"),
			import("./stakeholder-routes"),
			import("./auto-population-routes"),
			import("./routes/admin-misc-routes"),
		]);
		kycVaultMod.registerKYCVaultRoutes(app);
		marketingMod.registerMarketingRoutes(app);
		adminProspectsMod.registerAdminProspectRoutes(app);
		adminMiscMod.registerAdminMiscRoutes(app);
		app.use("/api/twilio", twilioWebhookMod.createTwilioWebhookRouter());
		app.use("/api/admin/analytics", credhiveAnalyticsMod.default);
		userMgmtMod.registerUserManagementRoutes(app);
		stakeholderMod.registerStakeholderRoutes(app);
		app.use("/api/auto-population", autoPopMod.autoPopulationRouter);

		// ── KYC Orchestrator — Vault diff, broker submit, status polling ─────────
		// Mounts: POST /api/orchestrator/diff
		//         POST /api/orchestrator/submit  (auth + investor-authorization guard)
		//         GET  /api/orchestrator/status/:brokerId/:brokerClientId
		const { orchestratorRouter } = await import("./routes/orchestrator-routes");
		app.use("/api/orchestrator", orchestratorRouter);
		logger.info("✅ KYC Orchestrator routes registered at /api/orchestrator");

		// ── Investor Authorization + Acting-As Session Routes ─────────────────
		// Mounts: POST /api/kyc/acting-as/start
		//         POST /api/kyc/acting-as/end
		//         GET  /api/kyc/acting-as/status
		//         POST /api/kyc/investor-authorize/request  (agent sends OTP to investor mobile)
		//         POST /api/kyc/investor-authorize/confirm  (investor confirms OTP → event ID)
		const { investorAuthRouter } = await import("./routes/investor-auth-routes");
		app.use("/api/kyc", investorAuthRouter);
		logger.info("✅ Investor Authorization routes registered at /api/kyc/...");

		// ── KYC Vault Orchestrator v2 — Diff Engine + Provenance Vault ───────
		// Mounts: GET    /api/kyc/v2/vault/:userId/profile
		//         PATCH  /api/kyc/v2/vault/:userId/profile
		//         POST   /api/kyc/v2/consent
		//         POST   /api/kyc/v2/orchestrator/diff
		const kycVaultV2Router = await import("./routes/kyc-vault-routes");
		app.use("/api/kyc/v2", kycVaultV2Router.default);
		logger.info("✅ KYC Vault v2 (diff engine + provenance) registered at /api/kyc/v2/...");

		// ── Admin Compliance Dashboard ─────────────────────────────────────────
		// Mounts: GET /api/admin/compliance/audit
		//         GET /api/admin/compliance/assisted-access
		//         GET /api/admin/compliance/kra-reuse
		//         GET /api/admin/compliance/summary/:userId
		const { adminComplianceRouter } = await import("./routes/admin-compliance-routes");
		app.use("/api/admin/compliance", adminComplianceRouter);
		logger.info("✅ Admin Compliance dashboard routes registered at /api/admin/compliance");

		logBootProgress("Step 6: Registering Marketplace & Regulatory Routes...");
		const [
			unlistedRoutes,
			complianceRoutes,
			bondMarketplaceRoutes,
			bondSeedAdminRoutes,
			goldAdminRoutes,
			bondMarketplaceImprovements,
			bondMarketplaceCalendarRoutes,
			regulatoryAuditNormsRoutes,
			regulatoryComplianceRoutes,
		] = await Promise.all([
			import("./routes/unlisted"),

			import("./routes/compliance"),
			import("./routes/bond-marketplace"),
			import("./routes/bond-seed-admin"),
			import("./routes/gold-admin"),
			import("./routes/bond-marketplace-improvements"),
			import("./routes/bond-calendar-routes"),
			import("./routes/regulatory-audit-norms-routes"),
			import("./routes/regulatory-compliance-routes"),
		]);
		app.use("/api/unlisted", unlistedRoutes.default);
		app.use("/api/compliance", complianceRoutes.default);
		app.use("/api", regulatoryComplianceRoutes.default);
		app.use("/api/admin/regulatory-audit", regulatoryAuditNormsRoutes.default);
		app.use("/api/bonds", bondMarketplaceRoutes.default);
		app.use("/api/admin/bond-seed", bondSeedAdminRoutes.default);
		app.use("/api/migration", bondSeedAdminRoutes.migrationRouter);
		app.use("/api/admin/gold", goldAdminRoutes.default);
		app.use("/api/bonds", bondMarketplaceImprovements.default);
		app.use("/api/bond-calendar", bondMarketplaceCalendarRoutes.default);

		// Commission, framework, ISIN, alpha
		const [
			commissionConfigRoutes,
			regulatoryFrameworkRoutes,
			isinIntelligenceRoutes,
			aiAlphaEngineRoutes,
		] = await Promise.all([
			import("./commission-config-routes"),
			import("./routes/regulatory-framework-routes"),
			import("./routes/isin-intelligence"),
			import("./routes/ai-alpha-engine"),
		]);
		app.use("/api/admin", commissionConfigRoutes.default);
		app.use("/api/regulatory", regulatoryFrameworkRoutes.default);
		app.use("/api/isin", isinIntelligenceRoutes.default);
		app.use("/api/ai", aiLimiter);
		app.use("/api/ai", aiAlphaEngineRoutes.default);

		// Pick of the Day Routes
		logBootProgress("Step 7: Registering Pick of the Day Routes...");
		const picksRoutes = await import("./routes/pick-of-the-day");
		app.use("/api/picks", picksRoutes.default);

		// AI Mutual Fund Recommendation Routes
		// NOTE: Routes inside this file use full paths (e.g. /api/ai-mf/recommendations)
		// so we mount without a prefix using app.use(router) — same pattern as agentRoutes
		logBootProgress("Step 7b: Registering AI MF Recommendation Routes...");
		const aiMFRoutes = await import("./routes/ai-mf-recommendation-routes");
		app.use(aiMFRoutes.default);

		// MPAL Routes
		logBootProgress("Step 8: Registering MPAL Routes...");
		const mpalRoutes = await import("./routes/mpal-routes");
		app.use("/api/mpal", mpalRoutes.mpalRouter);

		// UniPortfolio — Multi-Broker Unified Portfolio + Quant Engine context
		logBootProgress("Step 8b: Registering UniPortfolio Routes...");
		const uniPortfolioRoutes = await import("./routes/uni-portfolio-routes");
		app.use("/api/portfolio", uniPortfolioRoutes.uniPortfolioRouter);

		// Portfolio Core (parts 1 + 2) — iris-fetch, external-holdings, smart-import,
		// wealthy-import and all portfolio import/sync routes live here.
		// IMPORTANT: routes inside unified-portfolio-routes-1/2 already include their
		// full paths (e.g. "/api/portfolio/iris-fetch", "/api/agent/external-holdings"),
		// so mount at "/" not "/api/portfolio" to avoid a double-prefix.
		const unifiedPortfolioRoutes = await import(
			"./routes/unified-portfolio-routes"
		);
		app.use("/", unifiedPortfolioRoutes.default);


		// Client Portfolio API — Broker-Agnostic Unified Portfolio Gateway
		// This is the ONLY endpoint the frontend should call for portfolio data.
		// Never expose IRIS/Alpaca/IIFL-specific routes directly to the frontend.
		logBootProgress("Step 8b-2: Registering Client Portfolio Gateway...");
		const { clientPortfolioRouter } = await import(
			"./routes/client-portfolio-api"
		);
		app.use("/api/clients", clientPortfolioRouter);

		// Admin Copilot — AI-powered admin assistant (Zoho Mail/CRM/Desk/Books/Meeting)
		logBootProgress("Step 8c: Registering Admin Copilot Routes...");
		const { adminCopilotRouter } = await import(
			"./routes/admin-copilot-routes"
		);
		app.use("/api/admin/copilot", adminCopilotLimiter);
		app.use("/api/admin/copilot", adminCopilotRouter);

		// Admin Portfolio Reconciliation — SEBI IA compliance dashboard
		logBootProgress(
			"Step 8d: Registering Portfolio Reconciliation Admin Routes...",
		);
		const adminReconRoutes = await import(
			"./routes/admin-portfolio-reconciliation"
		);
		app.use("/api/admin/portfolio/reconciliation", adminReconRoutes.default);

		// Alpaca Ribbit Integration Routes
		const alpacaRoutes = await import("./routes/alpaca/index");
		app.use("/api/alpaca", alpacaRoutes.default);

		// IRIS KFintech Integration Routes
		logBootProgress("Step 9: Registering IRIS KFintech Routes...");
		const { registerIrisKfintechRoutes } = await import(
			"./routes/iris-kfintech-routes"
		);
		registerIrisKfintechRoutes(app);

		// IRIS LAS/LAMF — Loan Against Securities & Mutual Funds
		const { registerIrisLasRoutes } = await import("./routes/iris-las-routes");
		registerIrisLasRoutes(app);

		// Algo Trading Signal Engine — FASP-AI v1.0 DSS
		logBootProgress("Step 9b: Registering Algo Trading Signal Routes...");
		const algoTradingRoutes = await import("./routes/algo-trading-routes");
		app.use("/api/us-trading/algo", algoTradingRoutes.default);

		// ── FINALIZATION ─────────────────────────────────────────────────────────

		// Boot audit event
		(async () => {
			try {
				const { auditLog } = await import("./middleware/audit-trail");
				await auditLog({
					action: "system_deploy",
					category: "admin",
					outcome: "success",
					riskLevel: "low",
					details: {
						event: "server_boot_complete",
						bootTimeMs: bootState.getBootTime(),
						nodeVersion: process.version,
						appVersion: APP_VERSION,
						timestamp: new Date().toISOString(),
					},
				});
			} catch {}
		})();

		// ── Step 11 moved to Step 4b above (before Step 5) so routesReady=true
		// is set as early as possible after core auth routes are available.
		logBootProgress("Step 12: All secondary routes registered. Server fully operational.");

		// ── Auto-load Alpaca credentials from DB if not in env ───────────────────
		// When ALPACA_API_KEY is not set via Cloud Run env vars, attempt to restore
		// from the encrypted credentials stored via the admin credential form.
		if (!process.env.ALPACA_API_KEY) {
			(async () => {
				try {
					const { alpacaBrokerService } = await import(
						"./services/alpaca-broker-service"
					);
					if (!alpacaBrokerService.isConfigured()) {
						const { db } = await import("./db");
						const { brokerConfigurations } = await import("../shared/schema");
						const { eq } = await import("drizzle-orm");
						const { decrypt } = await import("./utils/encryption");

						const rows = await db
							.select()
							.from(brokerConfigurations)
							.where(eq(brokerConfigurations.brokerCode, "ALPACA"))
							.limit(1);

						if (rows.length > 0 && rows[0].configuration) {
							const cfg = rows[0].configuration as Record<string, string>;
							if (cfg.apiKey && cfg.secretKeyEncrypted && cfg.baseUrl) {
								const secret = decrypt(cfg.secretKeyEncrypted);
								alpacaBrokerService.configure(cfg.apiKey, secret, cfg.baseUrl);
								// Also propagate to process.env so that alpacaMarketDataService.isConfigured()
								// returns true — it reads env vars directly (not via alpacaBrokerService).
								process.env.ALPACA_API_KEY = cfg.apiKey;
								process.env.ALPACA_SECRET_KEY = secret;
								process.env.ALPACA_BASE_URL = cfg.baseUrl;
								if (cfg.webhookSecret) {
									try {
										process.env.ALPACA_WEBHOOK_SECRET = decrypt(
											cfg.webhookSecret,
										);
									} catch {
										/* ignore */
									}
								}
								logBootProgress(
									"Step 12a: Alpaca credentials loaded from DB ✅ (market data service synced)",
								);
							}
						}
					}
				} catch (e: any) {
					logger.warn(
						"[Boot] Could not auto-load Alpaca credentials from DB:",
						e?.message,
					);
				}
			})();
		}

		startBackgroundSchedulers();
	} catch (error: any) {
		logger.error("❌ [FATAL] Server initialization failed:", error);
		bootState.error = `Boot Error: ${error?.message || String(error)}`;

		// In production, try to serve SPA even if boot failed partially
		if (process.env.NODE_ENV === "production") {
			try {
				registerSPACatchAll(app);
			} catch (_) {}
		}
	}
})();
