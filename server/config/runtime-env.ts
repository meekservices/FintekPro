// ============================================================================
// FintekPro — Runtime Environment Validator
// Version: 2.0 | FASP-AI v1.0 compliant
//
// Checks all required environment variables at server boot.
// P0 (error)  → hard crash — server WILL NOT start
// P1 (warn)   → service degradation logged — server continues
// P2 (info)   → optional connector missing — silent degradation
//
// Structured log output for Cloud Run observability.
// ============================================================================

type EnvIssueLevel = "error" | "warn" | "info";
type ConnectorStatus = "✅ OK" | "⚠️ DEGRADED" | "❌ MISSING" | "⬜ OPTIONAL";

interface EnvIssue {
	level: EnvIssueLevel;
	category: string;
	connector: string;
	message: string;
}

interface ServiceStatus {
	name: string;
	status: ConnectorStatus;
	degraded?: string;
}

/**
 * Returns true if an env var is set with a non-empty value.
 */
function has(key: string): boolean {
	const v = process.env[key];
	return typeof v === "string" && v.trim().length > 0;
}

/**
 * Returns true if ANY of the given keys is set.
 */
function hasAny(...keys: string[]): boolean {
	return keys.some((k) => has(k));
}

/**
 * Returns true if ALL of the given keys are set.
 */
function hasAll(...keys: string[]): boolean {
	return keys.every((k) => has(k));
}

// ─────────────────────────────────────────────────────────────────────────────
// Core validation logic
// ─────────────────────────────────────────────────────────────────────────────

function collectIssues(isProduction: boolean): EnvIssue[] {
	const issues: EnvIssue[] = [];

	const err = (category: string, connector: string, message: string) =>
		issues.push({ level: "error", category, connector, message });

	const warn = (category: string, connector: string, message: string) =>
		issues.push({ level: "warn", category, connector, message });

	// ── §1. INFRASTRUCTURE — P0 ───────────────────────────────────────────────

	if (!hasAny("PRODUCTION_DATABASE_URL", "DATABASE_URL")) {
		const msg =
			isProduction
				? "PRODUCTION_DATABASE_URL is not set. Cloud Run will fail to connect to Cloud SQL. " +
				  "Add via: gcloud secrets create PRODUCTION_DATABASE_URL --data-file=-"
				: "DATABASE_URL is not set for local development. Copy .env.example to .env.";
		isProduction ? err("Database", "Cloud SQL", msg) : warn("Database", "Local PG", msg);
	}

	if (isProduction && !has("SESSION_SECRET")) {
		err("Security", "Session", "SESSION_SECRET is not set. All user sessions will be insecure. " +
			"Generate with: openssl rand -hex 32");
	}

	if (isProduction && !has("ENCRYPTION_MASTER_KEY")) {
		err("Security", "Encryption", "ENCRYPTION_MASTER_KEY is not set. " +
			"PAN/Aadhaar field decryption will FAIL. All broker credential reads will throw.");
	}

	if (isProduction && !has("KMS_KEY_ID") && !has("ENCRYPTION_MASTER_KEY")) {
		warn("Security", "GCP KMS", "KMS_KEY_ID is not set. " +
			"Falling back to ENCRYPTION_MASTER_KEY for field encryption (non-compliant for PAN/Aadhaar in production).");
	}

	// ── §2. CACHE — P0 (production autoscale) ───────────────────────────────

	if (isProduction && !has("REDIS_URL")) {
		warn("Cache", "Redis / Memorystore",
			"REDIS_URL is not set. Compliance cache, rate-limiter, and KYC audit state will be " +
			"LOCAL to each Cloud Run pod — state WILL DIVERGE across autoscaled instances. " +
			"Provision via GCP Memorystore (Redis) and set: REDIS_URL=redis://PRIVATE_IP:6379");
	}

	// ── §3. AI / LLM ─────────────────────────────────────────────────────────

	if (!has("GEMINI_API_KEY")) {
		warn("AI", "Google Gemini",
			"GEMINI_API_KEY is not set. FASP-AI advisory engine, pick-of-the-day, and AI proposals will be DISABLED.");
	}

	if (!has("OPENAI_API_KEY")) {
		warn("AI", "OpenAI GPT-4",
			"OPENAI_API_KEY is not set. ChatGPT-powered analysis and ITR assistance will be unavailable.");
	}

	// ── §4. PAYMENTS ─────────────────────────────────────────────────────────

	const hasCashfreeCore = hasAny("CASHFREE_PG_APP_ID", "CASHFREE_APP_ID") &&
		hasAny("CASHFREE_PG_SECRET_KEY", "CASHFREE_SECRET_KEY");

	if (isProduction && !hasCashfreeCore) {
		warn("Payments", "Cashfree PG",
			"CASHFREE_APP_ID / CASHFREE_SECRET_KEY not set. " +
			"All payment collections, payouts, and SIP mandates will FAIL in production.");
	}

	if (isProduction && !hasAll("PHONEPE_MERCHANT_ID", "PHONEPE_SALT_KEY")) {
		warn("Payments", "PhonePe",
			"PHONEPE_MERCHANT_ID or PHONEPE_SALT_KEY not set. PhonePe payment flows will be unavailable.");
	}

	if (isProduction && !hasAll("CASHFREE_PAYOUTS_APP_ID", "CASHFREE_PAYOUTS_SECRET_KEY")) {
		warn("Payments", "Cashfree Payouts",
			"Cashfree Payouts credentials not set. Commission disbursements to agents/DSAs will FAIL.");
	}

	// ── §5. KYC CONNECTORS ───────────────────────────────────────────────────

	if (!hasAll("SANDBOX_API_KEY", "SANDBOX_API_SECRET")) {
		warn("KYC", "Sandbox.co.in",
			"SANDBOX_API_KEY / SANDBOX_API_SECRET not set. " +
			"Penny-drop bank verification, PAN validation, and GST lookup will be UNAVAILABLE.");
	}

	if (!hasAll("TRUTHSCREEN_USERNAME", "TRUTHSCREEN_PASSWORD")) {
		warn("KYC", "TruthScreen",
			"TruthScreen credentials not set. Aadhaar XML fetch, offline Aadhaar, and eSign flows will fail.");
	}

	if (!hasAll("AUTHBRIDGE_API_KEY", "AUTHBRIDGE_CLIENT_ID")) {
		warn("KYC", "AuthBridge",
			"AuthBridge credentials not set. CKYC registry bridge and AuthBridge eSign will be unavailable.");
	}

	if (!has("DIGILOCKER_CLIENT_ID")) {
		warn("KYC", "DigiLocker",
			"DIGILOCKER_CLIENT_ID not set. DigiLocker document fetch (Aadhaar XML via govt portal) will be unavailable.");
	}

	if (!hasAll("PROTEAN_ASP_ID", "PROTEAN_ASP_SECRET")) {
		warn("KYC", "Protean/NSDL eSign",
			"Protean eSign credentials not set. NSDL-based document eSigning will be unavailable.");
	}

	// ── §6. MARKET DATA ──────────────────────────────────────────────────────

	if (!has("FINNHUB_API_KEY")) {
		warn("Market Data", "Finnhub",
			"FINNHUB_API_KEY not set. Real-time global quotes, earnings calendar, and news feed will be unavailable.");
	}

	if (!hasAny("ALPHA_VANTAGE_API_KEY", "ALPHAVANTAGE_API_KEY")) {
		warn("Market Data", "Alpha Vantage",
			"ALPHA_VANTAGE_API_KEY not set. Technical indicators and FX rates will use fallback data only.");
	}

	if (!has("POLYGON_API_KEY")) {
		warn("Market Data", "Polygon.io",
			"POLYGON_API_KEY not set. US market data WebSocket, options chain, and flat-file history will be unavailable.");
	}

	if (!hasAny("FMP_API_KEY", "FINANCIAL_MODELING_PREP_API_KEY")) {
		warn("Market Data", "Financial Modeling Prep",
			"FMP_API_KEY not set. Stock fundamentals, DCF valuation, and income statements will be unavailable.");
	}

	// ── §7. EXCHANGE CONNECTORS ───────────────────────────────────────────────

	if (!hasAll("BSE_MEMBER_ID", "BSE_USER_ID", "BSE_PASSWORD")) {
		warn("Exchange", "BSE Direct",
			"BSE Direct credentials not set. BSE mutual fund order routing and CAS sync will be UNAVAILABLE.");
	}

	if (!has("BSE_STAR_API_KEY")) {
		warn("Exchange", "BSE STAR MF",
			"BSE_STAR_API_KEY not set. BSE STAR MF order placement will be unavailable.");
	}

	if (!hasAll("KFINTECH_API_KEY", "KFINTECH_USERNAME")) {
		warn("Exchange", "KFintech",
			"KFintech credentials not set. KFintech registry services and CAS integration will be unavailable.");
	}

	if (!hasAll("CAMS_API_KEY", "CAMS_MEMBER_ID")) {
		warn("Exchange", "CAMS",
			"CAMS credentials not set. CAMS registry and mutual fund statement access will be unavailable.");
	}

	if (!hasAll("MFCENTRAL_CLIENT_ID", "MFCENTRAL_CLIENT_SECRET")) {
		warn("Exchange", "MFCentral",
			"MFCentral credentials not set. Unified MF account access will be unavailable.");
	}

	// ── §8. BROKER APIs ──────────────────────────────────────────────────────

	if (isProduction && !hasAll("ALPACA_API_KEY", "ALPACA_SECRET_KEY")) {
		warn("Broker", "Alpaca",
			"ALPACA_API_KEY / ALPACA_SECRET_KEY not set. US equity trading and algo signals will be UNAVAILABLE. " +
			"Regenerate at https://broker-app.alpaca.markets");
	}

	if (!hasAll("IIFL_API_KEY", "IIFL_API_SECRET")) {
		warn("Broker", "IIFL Securities",
			"IIFL API credentials not set. IIFL market integration will be unavailable.");
	}

	// ── §9. COMMUNICATION ────────────────────────────────────────────────────

	if (!hasAll("EMAIL_HOST", "EMAIL_USER", "EMAIL_PASS")) {
		warn("Comms", "Email / SMTP",
			"Email SMTP credentials not set. Transactional emails (OTP, KYC notices, reports) will FAIL.");
	}

	if (!hasAll("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN")) {
		warn("Comms", "Twilio",
			"Twilio credentials not set. SMS OTP, WhatsApp notifications, and voice calls will FAIL.");
	}

	// ── §10. BANKING ─────────────────────────────────────────────────────────

	if (!hasAll("DECENTRO_CLIENT_ID", "DECENTRO_CLIENT_SECRET")) {
		warn("Banking", "Decentro",
			"Decentro credentials not set. UPI collection, VPA verification, and bank statement fetch will be unavailable.");
	}

	if (!hasAll("SETU_CLIENT_ID", "SETU_CLIENT_SECRET")) {
		warn("Banking", "Setu",
			"Setu credentials not set. Account Aggregator flows and UPI deeplink generation will be unavailable.");
	}

	// ── §11. STORAGE ─────────────────────────────────────────────────────────

	if (isProduction && !has("DEFAULT_OBJECT_STORAGE_BUCKET_ID")) {
		warn("Storage", "GCP Cloud Storage",
			"DEFAULT_OBJECT_STORAGE_BUCKET_ID not set. KYC document upload and presigned URL generation will FAIL.");
	}

	// ── §12. ZOHO CRM ────────────────────────────────────────────────────────

	if (!hasAll("ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN")) {
		warn("CRM", "Zoho Suite",
			"Zoho credentials not set. CRM sync, campaign automation, and Zoho Books integration will be DISABLED.");
	}

	return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service status dashboard
// ─────────────────────────────────────────────────────────────────────────────

function buildServiceDashboard(isProduction: boolean): ServiceStatus[] {
	return [
		{
			name: "PostgreSQL",
			status: hasAny("PRODUCTION_DATABASE_URL", "DATABASE_URL") ? "✅ OK" : "❌ MISSING",
		},
		{
			name: "Redis Cache",
			status: has("REDIS_URL") ? "✅ OK" : (isProduction ? "⚠️ DEGRADED" : "⬜ OPTIONAL"),
			degraded: isProduction ? "State will diverge across pods" : undefined,
		},
		{
			name: "Gemini AI",
			status: has("GEMINI_API_KEY") ? "✅ OK" : "⚠️ DEGRADED",
			degraded: "FASP-AI disabled",
		},
		{
			name: "OpenAI",
			status: has("OPENAI_API_KEY") ? "✅ OK" : "⚠️ DEGRADED",
		},
		{
			name: "Groq",
			status: has("GROQ_API_KEY") ? "✅ OK" : "⬜ OPTIONAL",
		},
		{
			name: "Cashfree PG",
			status: (hasAny("CASHFREE_PG_APP_ID", "CASHFREE_APP_ID") &&
				hasAny("CASHFREE_PG_SECRET_KEY", "CASHFREE_SECRET_KEY")) ? "✅ OK" : "⚠️ DEGRADED",
			degraded: "Payments will fail",
		},
		{
			name: "PhonePe",
			status: hasAll("PHONEPE_MERCHANT_ID", "PHONEPE_SALT_KEY") ? "✅ OK" : "⬜ OPTIONAL",
		},
		{
			name: "Sandbox KYC",
			status: hasAll("SANDBOX_API_KEY", "SANDBOX_API_SECRET") ? "✅ OK" : "⚠️ DEGRADED",
			degraded: "Penny-drop disabled",
		},
		{
			name: "TruthScreen",
			status: hasAll("TRUTHSCREEN_USERNAME", "TRUTHSCREEN_PASSWORD") ? "✅ OK" : "⚠️ DEGRADED",
		},
		{
			name: "AuthBridge",
			status: hasAll("AUTHBRIDGE_API_KEY", "AUTHBRIDGE_CLIENT_ID") ? "✅ OK" : "⚠️ DEGRADED",
		},
		{
			name: "Finnhub",
			status: has("FINNHUB_API_KEY") ? "✅ OK" : "⚠️ DEGRADED",
		},
		{
			name: "Polygon.io",
			status: has("POLYGON_API_KEY") ? "✅ OK" : "⬜ OPTIONAL",
		},
		{
			name: "Alpha Vantage",
			status: hasAny("ALPHA_VANTAGE_API_KEY", "ALPHAVANTAGE_API_KEY") ? "✅ OK" : "⬜ OPTIONAL",
		},
		{
			name: "BSE Direct",
			status: hasAll("BSE_MEMBER_ID", "BSE_USER_ID") ? "✅ OK" : "⚠️ DEGRADED",
		},
		{
			name: "KFintech",
			status: hasAll("KFINTECH_API_KEY", "KFINTECH_USERNAME") ? "✅ OK" : "⚠️ DEGRADED",
		},
		{
			name: "CAMS",
			status: hasAll("CAMS_API_KEY", "CAMS_MEMBER_ID") ? "✅ OK" : "⚠️ DEGRADED",
		},
		{
			name: "Alpaca Broker",
			status: hasAll("ALPACA_API_KEY", "ALPACA_SECRET_KEY") ? "✅ OK" : "⚠️ DEGRADED",
		},
		{
			name: "Email (SMTP)",
			status: hasAll("EMAIL_HOST", "EMAIL_USER", "EMAIL_PASS") ? "✅ OK" : "❌ MISSING",
		},
		{
			name: "Twilio",
			status: hasAll("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN") ? "✅ OK" : "⚠️ DEGRADED",
		},
		{
			name: "GCP Storage",
			status: has("DEFAULT_OBJECT_STORAGE_BUCKET_ID") ? "✅ OK" : (isProduction ? "⚠️ DEGRADED" : "⬜ OPTIONAL"),
		},
		{
			name: "Zoho CRM",
			status: hasAll("ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN") ? "✅ OK" : "⬜ OPTIONAL",
		},
	];
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates the runtime environment at server startup.
 *
 * - Prints a service status dashboard showing which connectors are operational.
 * - Emits structured warn/error logs for all missing variables.
 * - THROWS if any P0 (error-level) variable is missing — this prevents the
 *   server from booting in an unsafe or non-compliant state.
 *
 * Called once at the very top of server/index.ts before any middleware.
 *
 * @throws {Error} if any error-level env issues are found
 */
export function validateRuntimeEnv(): void {
	const isProduction = process.env.NODE_ENV === "production";
	const issues = collectIssues(isProduction);
	const dashboard = buildServiceDashboard(isProduction);

	// ── Service Status Dashboard ─────────────────────────────────────────────
	const ok = dashboard.filter(s => s.status === "✅ OK").length;
	const degraded = dashboard.filter(s => s.status === "⚠️ DEGRADED").length;
	const missing = dashboard.filter(s => s.status === "❌ MISSING").length;

	console.log("\n" + "═".repeat(62));
	console.log("  FintekPro — Connector Health Check");
	console.log("  Environment:", isProduction ? "🔴 PRODUCTION" : "🟢 DEVELOPMENT");
	console.log("═".repeat(62));

	for (const svc of dashboard) {
		const note = svc.status === "⚠️ DEGRADED" && svc.degraded
			? ` (${svc.degraded})`
			: "";
		console.log(`  ${svc.status.padEnd(14)} ${svc.name}${note}`);
	}

	console.log("═".repeat(62));
	console.log(`  Summary: ${ok} OK | ${degraded} degraded | ${missing} missing`);
	console.log("═".repeat(62) + "\n");

	// Emit structured log for Cloud Logging / observability
	const logEntry = {
		event: "ENV_VALIDATION_COMPLETE",
		environment: process.env.NODE_ENV,
		connectors_ok: ok,
		connectors_degraded: degraded,
		connectors_missing: missing,
		timestamp: new Date().toISOString(),
	};
	console.log("[STRUCTURED]", JSON.stringify(logEntry));

	// ── Per-issue logs ───────────────────────────────────────────────────────
	const errorIssues = issues.filter(i => i.level === "error");
	const warnIssues = issues.filter(i => i.level === "warn");

	for (const issue of warnIssues) {
		console.warn(`⚠️ [ENV:${issue.category}/${issue.connector}] ${issue.message}`);
	}

	for (const issue of errorIssues) {
		console.error(`❌ [ENV:${issue.category}/${issue.connector}] ${issue.message}`);
	}

	// ── Hard fail on P0 errors ───────────────────────────────────────────────
	if (errorIssues.length > 0) {
		throw new Error(
			`[ENV] ${errorIssues.length} critical environment variable(s) missing — server cannot start safely.\n` +
			errorIssues.map(i => `  ❌ [${i.category}/${i.connector}] ${i.message}`).join("\n"),
		);
	}

	if (warnIssues.length > 0) {
		console.warn(
			`⚠️ [ENV] ${warnIssues.length} connector(s) are degraded or missing. ` +
			`App will start but some features will be unavailable. ` +
			`See .env.example for the full configuration reference.`,
		);
	}
}

