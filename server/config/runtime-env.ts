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
    hasValue(process.env.PRODUCTION_DATABASE_URL) || hasValue(process.env.DATABASE_URL);

  if (isProduction && !hasDatabaseUrl) {
    issues.push({
      level: "warn",
      message: "PRODUCTION_DATABASE_URL or DATABASE_URL not found at boot-time. Ensure Secret Manager bindings are configured in Cloud Run.",
    });
  }

  if (isProduction && !hasValue(process.env.SESSION_SECRET)) {
    issues.push({
      level: "warn",
      message: "SESSION_SECRET not found at boot-time. Ensure Secret Manager bindings are configured in Cloud Run.",
    });
  }

  if (isProduction && !hasValue(process.env.INSTANCE_CONNECTION_NAME)) {
    issues.push({
      level: "warn",
      message: "INSTANCE_CONNECTION_NAME is not set; falling back to the built-in Cloud SQL instance name.",
    });
  }

  if (isProduction && process.env.RUN_BACKGROUND_SCHEDULERS !== "false") {
    issues.push({
      level: "warn",
      message:
        "RUN_BACKGROUND_SCHEDULERS is enabled in the web service. Prefer Cloud Run jobs/scheduler for singleton background work.",
    });
  }

  return issues;
}

export function validateRuntimeEnv() {
  const issues = collectRuntimeEnvIssues();
  const errors = issues.filter((issue) => issue.level === "error");

  for (const issue of issues) {
    const prefix = issue.level === "error" ? "❌ [ENV]" : "⚠️ [ENV]";
    console[issue.level === "error" ? "error" : "warn"](`${prefix} ${issue.message}`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid runtime environment: ${errors.map((issue) => issue.message).join(" ")}`);
  }
}
