type EnvIssueLevel = "warn" | "error";

interface EnvIssue {
	level: EnvIssueLevel;
	message: string;
}

function hasValue(value: string | undefined): boolean {
	return typeof value === "string" && value.trim().length > 0;
}

function collectRuntimeEnvIssues(): EnvIssue[] {
	const issues: EnvIssue[] = [];
	const isProduction = process.env.NODE_ENV === "production";
	const hasDatabaseUrl =
		hasValue(process.env.PRODUCTION_DATABASE_URL) ||
		hasValue(process.env.DATABASE_URL);

	if (isProduction && !hasDatabaseUrl) {
		issues.push({
			level: "warn",
			message:
				"PRODUCTION_DATABASE_URL or DATABASE_URL not found at boot-time. Ensure Secret Manager bindings are configured in Cloud Run.",
		});
	}

	if (isProduction && !hasValue(process.env.SESSION_SECRET)) {
		issues.push({
			level: "warn",
			message:
				"SESSION_SECRET not found at boot-time. Ensure Secret Manager bindings are configured in Cloud Run.",
		});
	}

	if (isProduction && !hasValue(process.env.INSTANCE_CONNECTION_NAME)) {
		issues.push({
			level: "warn",
			message:
				"INSTANCE_CONNECTION_NAME is not set; falling back to the built-in Cloud SQL instance name.",
		});
	}

	if (isProduction && process.env.RUN_BACKGROUND_SCHEDULERS !== "false") {
		issues.push({
			level: "warn",
			message:
				"RUN_BACKGROUND_SCHEDULERS is enabled in the web service. Prefer Cloud Run jobs/scheduler for singleton background work.",
		});
	}

	// ── Encryption & AI keys ─────────────────────────────────────────────────
	if (isProduction && !hasValue(process.env.ENCRYPTION_MASTER_KEY)) {
		issues.push({
			level: "warn",
			message:
				"ENCRYPTION_MASTER_KEY not found. Alpaca broker credentials stored at-rest will fail to decrypt. " +
				"Set via GCP Secret Manager: gcloud secrets versions access latest --secret=ENCRYPTION_MASTER_KEY",
		});
	}

	if (!hasValue(process.env.GEMINI_API_KEY)) {
		issues.push({
			level: "warn",
			message:
				"GEMINI_API_KEY not found. All AI advisory features (FASP-AI) and Gemini-powered analysis will be disabled. " +
				"Set via GCP Secret Manager or .env for local dev.",
		});
	}

	if (isProduction && !hasValue(process.env.ALPACA_API_KEY)) {
		issues.push({
			level: "warn",
			message:
				"ALPACA_API_KEY not found. US equity trading, market data, and algo signals will be unavailable. " +
				"Regenerate at https://broker-app.alpaca.markets → API/Devs → Generate.",
		});
	}

	if (isProduction && !hasValue(process.env.ALPACA_SECRET_KEY)) {
		issues.push({
			level: "warn",
			message:
				"ALPACA_SECRET_KEY not found. Required alongside ALPACA_API_KEY for all Alpaca Broker API calls.",
		});
	}

	// ── Summary (always, not just production) ────────────────────────────────
	const missing = issues.filter(
		(i) => i.level === "warn" || i.level === "error",
	);
	if (missing.length > 0) {
		console.warn(
			`⚠️ [ENV] ${missing.length} environment variable issue(s) detected at startup. ` +
				`Check GCP Secret Manager bindings. App will continue but affected features may be degraded.`,
		);
	}

	return issues;
}

export function validateRuntimeEnv() {
	const issues = collectRuntimeEnvIssues();
	const errors = issues.filter((issue) => issue.level === "error");

	for (const issue of issues) {
		const prefix = issue.level === "error" ? "❌ [ENV]" : "⚠️ [ENV]";
		console[issue.level === "error" ? "error" : "warn"](
			`${prefix} ${issue.message}`,
		);
	}

	if (errors.length > 0) {
		throw new Error(
			`Invalid runtime environment: ${errors.map((issue) => issue.message).join(" ")}`,
		);
	}
}
