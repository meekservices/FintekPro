import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import express, { type Express, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import { APP_VERSION } from "../../shared/version";
import { bootState } from "../utils/boot-state";
import { globalLimiter } from "../middleware/rate-limiter";
import { logger } from "../logger";

// ── Allowed CORS origins ────────────────────────────────────────────────────
const PROD_ORIGINS = [
	"https://fintekpro.com",
	"https://admin.fintekpro.com",
	"https://agent.fintekpro.com",
	"https://partner.fintekpro.com",
	"https://ins.fintekpro.com",
	"https://fintekpro-app-7f3fb64pqq-el.a.run.app",
	"https://fintekpro-app-124901641600.asia-south1.run.app",
];

const DEV_ONLY_ORIGINS = [
	"http://localhost:5173",
	"http://localhost:5000",
	"http://0.0.0.0:5000",
	// Dev tunnels — never allowed in production
	...(process.env.NODE_ENV !== "production"
		? ["https://replit.dev", "https://repl.co"]
		: []),
];

function getAllowedOrigins(): string[] {
	return process.env.NODE_ENV === "production"
		? PROD_ORIGINS
		: [...PROD_ORIGINS, ...DEV_ONLY_ORIGINS];
}

function isAllowedCorsOrigin(
	origin: string | undefined,
	allowedOrigins: string[],
) {
	if (!origin) return true; // same-origin requests

	return (
		allowedOrigins.includes(origin) ||
		// Any *.fintekpro.com subdomain
		/^https:\/\/[a-z0-9-]+\.fintekpro\.com$/.test(origin) ||
		// Any fintekpro Cloud Run preview URL
		(origin.includes("fintekpro-app") && origin.endsWith(".run.app"))
	);
}

export function registerPrebootMiddleware(app: Express) {
	// ── Cloud Run: trust the Google Frontend proxy for real IPs ─────────────
	app.set("trust proxy", 1);

	// ── INFRA-M1: Gzip compression ────────────────────────────────────────────
	// Compresses JSON API responses and static assets before sending to client.
	// threshold:1024 — skip compression for very small responses (<1KB, not worth it).
	// level:6 — balanced compression (Node default). Level 9 = smaller but ~30% slower.
	// Expected savings: 60–80% reduction on API JSON responses over mobile connections.
	app.use(compression({ level: 6, threshold: 1024 }));

	// ── INFRA-M4: Structured Access Log (SEBI Audit Trail) ────────────────────
	// Logs every API request with user_id, endpoint, method, status, latency_ms.
	// SEBI Investment Advisory Regulations 2020 require a 5-year audit trail of
	// all advisor actions. Cloud Logging retains structured logs automatically.
	// Non-API paths (static assets) are excluded to reduce log volume.
	app.use((req: Request, res: Response, next) => {
		if (!req.path.startsWith("/api")) return next();
		const start = Date.now();
		res.on("finish", () => {
			const latencyMs = Date.now() - start;
			const userId =
				(req as any).session?.userId ??
				(req as any).user?.id ??
				null;
			// Skip health probes from the audit log — they generate high-frequency noise
			const skipPaths = ["/api/health", "/api/boot-status"];
			if (skipPaths.includes(req.path)) return;
			logger.info(JSON.stringify({
				event: "API_REQUEST",
				method: req.method,
				path: req.path,
				status: res.statusCode,
				latency_ms: latencyMs,
				user_id: userId,
				ip: req.ip,
				request_id: res.locals.requestId,
				user_agent: req.get("user-agent")?.slice(0, 80),
			}));
		});
		next();
	});

	// ── www → apex redirect ──────────────────────────────────────────────────
	app.use((req, res, next) => {
		const host = req.get("host") || "";
		if (host.toLowerCase().startsWith("www.")) {
			const newHost = host.substring(4);
			const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
			return res.redirect(301, `${protocol}://${newHost}${req.originalUrl}`);
		}
		next();
	});

	// ── Request ID — end-to-end tracing (M4 fix) ─────────────────────────────
	// Assigns a UUID to every request. Use res.locals.requestId in logger calls
	// for full traceability across Cloud Logging → Cloud Run → DB.
	// Respects upstream X-Request-Id headers (API gateway / Cloud Tasks).
	app.use((req, res, next) => {
		const requestId =
			(req.headers["x-request-id"] as string | undefined) ?? randomUUID();
		res.locals.requestId = requestId;
		res.setHeader("X-Request-Id", requestId);
		next();
	});

	// ── Helmet — security headers (MUST be first middleware) ─────────────────
	const isProd = process.env.NODE_ENV === "production";
	app.use(
		helmet({
			// Content-Security-Policy
			contentSecurityPolicy: {
				directives: {
					defaultSrc: ["'self'"],
					scriptSrc: isProd
						? ["'self'"]
						: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vite HMR needs this in dev
					styleSrc: [
						"'self'",
						"'unsafe-inline'",
						"https://fonts.googleapis.com",
					],
					fontSrc: ["'self'", "https://fonts.gstatic.com"],
					imgSrc: ["'self'", "data:", "https:"],
					connectSrc: [
						"'self'",
						"wss:",
						"https://*.fintekpro.com",
						"https://*.run.app",
						"https://*.googleapis.com",
					],
					frameSrc: ["'none'"],
					frameAncestors: ["'none'"], // blocks clickjacking
					objectSrc: ["'none'"],
					baseUri: ["'self'"],
					formAction: ["'self'"],
					upgradeInsecureRequests: isProd ? [] : null, // force HTTPS in prod
				},
			},
			// HTTP Strict Transport Security (2 years in prod)
			hsts: isProd
				? { maxAge: 63072000, includeSubDomains: true, preload: true }
				: false,
			// Prevent MIME-type sniffing
			noSniff: true,
			// Block iframe embedding
			frameguard: { action: "deny" },
			// Hide X-Powered-By: Express
			hidePoweredBy: true,
			// Referrer-Policy
			referrerPolicy: { policy: "strict-origin-when-cross-origin" },
			// Permissions-Policy (disable sensitive browser APIs)
			permittedCrossDomainPolicies: { permittedPolicies: "none" },
			// X-XSS-Protection (legacy, but belt-and-suspenders)
			xssFilter: true,
		}),
	);

	// ── Health probe (before CORS so Cloud Run can reach it unauthenticated) ─
	app.get("/api/health", (_req, res) => {
		res.status(200).json({
			status: "ok",
			booting: !bootState.routesReady,
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		});
	});

	// ── Cache-Control: no-store on ALL /api/ responses ────────────────────────
	// Prevents Firebase CDN (and any other proxy) from caching API responses.
	// Without this, a transient 404 during cold-start (before routes are
	// registered) gets cached by the CDN and served to every subsequent request.
	app.use("/api", (_req, res, next) => {
		res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
		res.setHeader("Pragma", "no-cache");
		res.setHeader("Expires", "0");
		next();
	});

	// ── Boot-gate: return 503 for API calls before routes are registered ──────
	// During the ~8-15s window between port-open and registerRoutes() completing,
	// Express would otherwise return its default 404 "Cannot GET /api/..."
	// response — which browsers and CDNs can cache. This gate returns a proper
	// 503 + Retry-After so React Query backs off and retries (not a 404 that
	// triggers permanent error state).
	// Excluded: /api/health and /api/boot-status are always available.
	app.use("/api", (req, res, next) => {
		if (bootState.routesReady) return next();
		// Safe paths bypass the boot gate — must be registered BEFORE registerRoutes()
		// and must NOT require DB access. /api/version is static (APP_VERSION env var).
		const safePaths = [
			"/api/health",
			"/api/boot-status",
			"/api/version",      // static, no DB — prevents 503 on frontend version check
		];
		if (safePaths.some((p) => req.path === p || req.originalUrl === p || req.originalUrl.startsWith(p + "?"))) return next();
		res.setHeader("Retry-After", "5");
		return res.status(503).json({
			success: false,
			message: "Server is initializing, please retry in a few seconds.",
			code: "BOOTING",
			retryable: true,
		});
	});

	// ── Body parsers ─────────────────────────────────────────────────────────
	// The `verify` callback captures the raw Buffer before JSON parsing so that
	// webhook routes (Alpaca, Cashfree, IRIS, Zoho) can verify HMAC signatures.
	app.use(
		express.json({
			limit: "10mb",
			verify: (req: any, _res, buf) => {
				req.rawBody = buf;
			},
		}),
	);
	app.use(express.urlencoded({ extended: false, limit: "10mb" }));

	// ── CORS ─────────────────────────────────────────────────────────────────
	app.use(
		cors({
			origin: (origin, callback) => {
				if (isAllowedCorsOrigin(origin, getAllowedOrigins())) {
					callback(null, true);
				} else {
					logger.warn(
						`[CORS] Blocked request from unauthorized origin: ${origin}`,
					);
					callback(new Error("Not allowed by CORS"));
				}
			},
			credentials: true,
			methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
			allowedHeaders: [
				"Content-Type",
				"Authorization",
				"X-CSRF-Token",
				"X-Requested-With",
				"Accept",
				"Origin",
			],
			exposedHeaders: ["X-CSRF-Token"],
			maxAge: 86400, // cache preflight for 24h
		}),
	);

	// ── Global rate limiter (DDoS backstop — 300 req/min per IP) ────────────
	app.use(globalLimiter);

	// ── Boot-status (public, after CORS) ─────────────────────────────────────
	app.get("/api/boot-status", (_req, res) => {
		res.json({
			ready: bootState.routesReady,
			error: bootState.error,
			version: APP_VERSION,
			timestamp: new Date().toISOString(),
		});
	});
}
