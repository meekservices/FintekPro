/**
 * @file gcp-secret-manager.ts
 * @description GCP Secret Manager integration for FintekPro.
 *
 * Purpose:
 *   Replaces hard-coded `process.env.*` secret lookups with a layered secret
 *   resolution strategy:
 *     1. GCP Secret Manager (production) — rotatable, auditable, IAM-controlled
 *     2. Environment variables (development / fallback) — backward compatible
 *
 * Usage:
 *   import { getSecret } from "./gcp-secret-manager";
 *   const key = await getSecret("GEMINI_API_KEY");
 *
 * Bootstrap:
 *   Call `bootstrapSecrets()` once at server startup (before any DB/API clients
 *   are instantiated) to pre-load all critical secrets into process.env.
 *   This ensures existing `process.env.X` calls continue to work unchanged.
 *
 * Secret naming convention in GCP Secret Manager:
 *   Project: fintekpro
 *   Secret names: lowercase, hyphens (e.g. "gemini-api-key" for GEMINI_API_KEY)
 *
 * IAM:
 *   Cloud Run SA needs `roles/secretmanager.secretAccessor` on the project.
 *   Grant: gcloud projects add-iam-policy-binding fintekpro
 *           --member="serviceAccount:$(gcloud run services describe fintekpro-app --region=asia-south1 --format='value(spec.template.spec.serviceAccountName)')"
 *           --role="roles/secretmanager.secretAccessor"
 *
 * FASP-AI v3.0: All secret access is logged (event, status) for audit.
 *   PAN/Aadhaar/credentials are never logged in plaintext.
 */

import { logger } from "../logger";

// ── Secret name mapping: ENV_VAR_NAME → GCP Secret Manager ID ────────────────
// GCP secrets use the same UPPER_CASE name as the env var (no translation).
// Full inventory verified 2026-07-05 from: gcloud secrets list --project=fintekpro
export const SECRET_MAP: Record<string, string> = {
  // ── Database ────────────────────────────────────────────────────────────────
  DATABASE_URL:                     "DATABASE_URL",
  PRODUCTION_DATABASE_URL:          "PRODUCTION_DATABASE_URL",
  // ── AI / LLM ────────────────────────────────────────────────────────────────
  GEMINI_API_KEY:                   "GEMINI_API_KEY",
  OPENAI_API_KEY:                   "OPENAI_API_KEY",
  GROQ_API_KEY:                     "GROQ_API_KEY",
  CEREBRAS_API_KEY:                 "CEREBRAS_API_KEY",
  // ── Market data providers ────────────────────────────────────────────────────
  FMP_API_KEY:                      "FMP_API_KEY",
  ALPHA_VANTAGE_API_KEY:            "ALPHA_VANTAGE_API_KEY",
  FINNHUB_API_KEY:                  "FINNHUB_API_KEY",
  POLYGON_API_KEY:                  "POLYGON_API_KEY",
  INDIAN_API_KEY:                   "INDIAN_API_KEY",
  EXCHANGE_RATE_API_KEY:            "EXCHANGE_RATE_API_KEY",
  // ── Infrastructure / caching ─────────────────────────────────────────────────
  REDIS_URL:                        "REDIS_URL",
  PYTHON_SERVICE_URL:               "PYTHON_SERVICE_URL",
  PYTHON_SERVICE_SECRET:            "PYTHON_SERVICE_SECRET",
  SERVICE_NAME:                     "SERVICE_NAME",
  DEFAULT_OBJECT_STORAGE_BUCKET_ID: "DEFAULT_OBJECT_STORAGE_BUCKET_ID",
  // ── Payments — Cashfree ──────────────────────────────────────────────────────
  CASHFREE_APP_ID:                  "CASHFREE_APP_ID",
  CASHFREE_SECRET_KEY:              "CASHFREE_SECRET_KEY",
  CASHFREE_ENVIRONMENT:             "CASHFREE_ENVIRONMENT",
  CASHFREE_PG_APP_ID:               "CASHFREE_PG_APP_ID",
  CASHFREE_PG_SECRET_KEY:           "CASHFREE_PG_SECRET_KEY",
  CASHFREE_PAYOUTS_APP_ID:          "CASHFREE_PAYOUTS_APP_ID",
  CASHFREE_PAYOUTS_SECRET_KEY:      "CASHFREE_PAYOUTS_SECRET_KEY",
  // ── Payments — PhonePe ───────────────────────────────────────────────────────
  PHONEPE_MERCHANT_ID:              "PHONEPE_MERCHANT_ID",
  PHONEPE_SALT_KEY:                 "PHONEPE_SALT_KEY",
  PHONEPE_SALT_INDEX:               "PHONEPE_SALT_INDEX",
  // ── Testing / sandbox ────────────────────────────────────────────────────────
  SANDBOX_API_KEY:                  "SANDBOX_API_KEY",
  SANDBOX_API_SECRET:               "SANDBOX_API_SECRET",
  SANDBOX_BASE_URL:                 "SANDBOX_BASE_URL",
  // ── Compliance / KYC ────────────────────────────────────────────────────────
  AUTHBRIDGE_API_KEY:               "AUTHBRIDGE_API_KEY",
  AUTHBRIDGE_CLIENT_ID:             "AUTHBRIDGE_CLIENT_ID",
  AUTHBRIDGE_CLIENT_SECRET:         "AUTHBRIDGE_CLIENT_SECRET",
  KMS_KEY_ID:                       "KMS_KEY_ID",
  COMPLIANCE_SECRET:                "COMPLIANCE_SECRET",
  TRUTHSCREEN_USERNAME:             "TRUTHSCREEN_USERNAME",
  TRUTHSCREEN_PASSWORD:             "TRUTHSCREEN_PASSWORD",
  // ── eSign / IRIS ─────────────────────────────────────────────────────────────
  IRIS_USERNAME:                    "IRIS_USERNAME",
  IRIS_PASSWORD:                    "IRIS_PASSWORD",
  // ── Encryption ───────────────────────────────────────────────────────────────
  ENCRYPTION_MASTER_KEY:            "ENCRYPTION_MASTER_KEY",
  FIELD_ENCRYPTION_KEY:             "FIELD_ENCRYPTION_KEY",
  // ── Session / auth ───────────────────────────────────────────────────────────
  SESSION_SECRET:                   "SESSION_SECRET",
  // ── Communication — Twilio ───────────────────────────────────────────────────
  TWILIO_ACCOUNT_SID:               "TWILIO_ACCOUNT_SID",
  TWILIO_AUTH_TOKEN:                "TWILIO_AUTH_TOKEN",
  TWILIO_PHONE_NUMBER:              "TWILIO_PHONE_NUMBER",
  TWILIO_PRIMARY_PHONE:             "TWILIO_PRIMARY_PHONE",
  TWILIO_MESSAGING_SERVICE_SID:     "TWILIO_MESSAGING_SERVICE_SID",
  TWILIO_VERIFY_SERVICE_SID:        "TWILIO_VERIFY_SERVICE_SID",
  TWILIO_WHATSAPP_NUMBER:           "TWILIO_WHATSAPP_NUMBER",
  // ── Communication — Email ────────────────────────────────────────────────────
  EMAIL_HOST:                       "EMAIL_HOST",
  EMAIL_PORT:                       "EMAIL_PORT",
  EMAIL_USER:                       "EMAIL_USER",
  EMAIL_PASS:                       "EMAIL_PASS",
  EMAIL_FROM:                       "EMAIL_FROM",
  // ── Communication — Slack ────────────────────────────────────────────────────
  SLACK_BOT_TOKEN:                  "SLACK_BOT_TOKEN",
  SLACK_SIGNING_SECRET:             "SLACK_SIGNING_SECRET",
  // ── CRM — Zoho ───────────────────────────────────────────────────────────────
  ZOHO_CLIENT_ID:                   "ZOHO_CLIENT_ID",
  ZOHO_CLIENT_SECRET:               "ZOHO_CLIENT_SECRET",
  ZOHO_REFRESH_TOKEN:               "ZOHO_REFRESH_TOKEN",
  ZOHO_WEBHOOK_SECRET:              "ZOHO_WEBHOOK_SECRET",
  // ── Infra — Cloudflare ───────────────────────────────────────────────────────
  CLOUDFLARE_API_KEY:               "CLOUDFLARE_API_KEY",
  CLOUDFLARE_ACCOUNT_ID:            "CLOUDFLARE_ACCOUNT_ID",
  // ── Dev tools ────────────────────────────────────────────────────────────────
  GITHUB_TOKEN:                     "GITHUB_TOKEN",
};

const GCP_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "fintekpro";
const SECRET_VERSION  = "latest";
const CACHE_TTL_MS   = 60 * 60 * 1000; // 1 hour — rotate secrets without restart

// ── In-memory cache ───────────────────────────────────────────────────────────
const _cache = new Map<string, { value: string; at: number }>();

// ── GCP client (lazy-loaded) ─────────────────────────────────────────────────
let _smClient: any = null;
async function getGCPClient() {
  if (_smClient) return _smClient;
  try {
    const { SecretManagerServiceClient } = await import("@google-cloud/secret-manager");
    _smClient = new SecretManagerServiceClient();
    return _smClient;
  } catch {
    // @google-cloud/secret-manager not installed (dev env) — return null
    return null;
  }
}

/**
 * Resolves a secret value by ENV_VAR_NAME.
 *
 * Resolution order:
 *   1. In-memory cache (1h TTL)
 *   2. GCP Secret Manager (production)
 *   3. process.env (fallback — development + backward compat)
 *
 * @param envVarName - e.g. "GEMINI_API_KEY"
 * @returns Secret value string
 * @throws If secret is required but not found in any source
 */
export async function getSecret(envVarName: string): Promise<string | undefined> {
  // 1. Cache check
  const cached = _cache.get(envVarName);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  // 2. GCP Secret Manager (only in production or when GOOGLE_CLOUD_PROJECT is set)
  const secretId = SECRET_MAP[envVarName];
  if (secretId && (process.env.NODE_ENV === "production" || process.env.GOOGLE_CLOUD_PROJECT)) {
    const client = await getGCPClient();
    if (client) {
      try {
        const name = `projects/${GCP_PROJECT_ID}/secrets/${secretId}/versions/${SECRET_VERSION}`;
        const [version] = await client.accessSecretVersion({ name });
        const value = version.payload?.data?.toString();
        if (value) {
          _cache.set(envVarName, { value, at: Date.now() });
          logger.info("[SecretManager] Secret resolved from GCP", {
            event: "SECRET_RESOLVED_GCP",
            user_id: "system",
            secret_name: envVarName.substring(0, 8) + "...", // mask name
            latency_ms: 0,
            status: "success",
          });
          return value;
        }
      } catch (err: any) {
        logger.warn("[SecretManager] GCP Secret Manager failed, falling back to env", {
          event: "SECRET_GCP_FALLBACK",
          user_id: "system",
          secret_id: secretId,
          error: err?.message?.substring(0, 100),
          latency_ms: 0,
          status: "warning",
        });
      }
    }
  }

  // 3. Environment variable fallback
  const envValue = process.env[envVarName];
  if (envValue) {
    _cache.set(envVarName, { value: envValue, at: Date.now() });
    return envValue;
  }

  return undefined;
}

/**
 * Bootstraps all critical secrets from GCP Secret Manager into process.env.
 *
 * Call ONCE at server startup — before DB, Redis, or API clients are instantiated.
 * This ensures all existing `process.env.X` calls work unchanged.
 *
 * Secrets already set in process.env are NOT overwritten (local dev takes precedence).
 */
export async function bootstrapSecrets(): Promise<void> {
  const t0 = Date.now();

  // Skip GCP fetch if not in production and GOOGLE_CLOUD_PROJECT is not set
  if (process.env.NODE_ENV !== "production" && !process.env.GOOGLE_CLOUD_PROJECT) {
    logger.info("[SecretManager] Development mode — using process.env secrets only", {
      event: "SECRET_BOOTSTRAP_DEV",
      user_id: "system",
      latency_ms: 0,
      status: "success",
    });
    return;
  }

  const client = await getGCPClient();
  if (!client) {
    logger.warn("[SecretManager] @google-cloud/secret-manager not available — env fallback", {
      event: "SECRET_BOOTSTRAP_NO_CLIENT",
      user_id: "system",
      latency_ms: 0,
      status: "warning",
    });
    return;
  }

  let resolved = 0;
  let failed = 0;
  let skipped = 0;

  const entries = Object.entries(SECRET_MAP);

  await Promise.allSettled(
    entries.map(async ([envVar, secretId]) => {
      // Don't overwrite existing env vars (local dev / Cloud Run env var overrides)
      if (process.env[envVar]) {
        skipped++;
        return;
      }
      try {
        const name = `projects/${GCP_PROJECT_ID}/secrets/${secretId}/versions/${SECRET_VERSION}`;
        const [version] = await client.accessSecretVersion({ name });
        const value = version.payload?.data?.toString();
        if (value) {
          process.env[envVar] = value;
          _cache.set(envVar, { value, at: Date.now() });
          resolved++;
        } else {
          failed++;
        }
      } catch {
        failed++;
        // Non-fatal: secret may not exist yet (new secret, not yet created in GCP)
      }
    })
  );

  const latency = Date.now() - t0;
  logger.info("[SecretManager] Bootstrap complete", {
    event: "SECRET_BOOTSTRAP_DONE",
    user_id: "system",
    total: entries.length,
    resolved,
    skipped,
    failed,
    latency_ms: latency,
    status: "success",
  });

  if (failed > 0) {
    logger.warn(`[SecretManager] ${failed} secrets not found in GCP (may be OK for new deployments)`, {
      event: "SECRET_BOOTSTRAP_PARTIAL",
      user_id: "system",
      failed,
      latency_ms: latency,
      status: "warning",
    });
  }
}

/**
 * Rotates a secret in GCP Secret Manager (adds a new version).
 * The old version is not disabled — do that manually after verifying the new one.
 *
 * @param envVarName - e.g. "GEMINI_API_KEY"
 * @param newValue - The new secret value
 * @returns The new version resource name
 */
export async function rotateSecret(
  envVarName: string,
  newValue: string
): Promise<string | null> {
  const secretId = SECRET_MAP[envVarName];
  if (!secretId) {
    logger.error("[SecretManager] Unknown secret for rotation", {
      event: "SECRET_ROTATION_UNKNOWN",
      user_id: "system",
      env_var: envVarName,
      latency_ms: 0,
      status: "error",
    });
    return null;
  }

  const client = await getGCPClient();
  if (!client) return null;

  try {
    const parent = `projects/${GCP_PROJECT_ID}/secrets/${secretId}`;
    const [version] = await client.addSecretVersion({
      parent,
      payload: { data: Buffer.from(newValue) },
    });

    // Invalidate cache
    _cache.delete(envVarName);

    logger.info("[SecretManager] Secret rotated", {
      event: "SECRET_ROTATED",
      user_id: "system",
      secret_id: secretId,
      new_version: version.name,
      latency_ms: 0,
      status: "success",
    });
    return version.name ?? null;
  } catch (err: any) {
    logger.error("[SecretManager] Rotation failed", {
      event: "SECRET_ROTATION_FAILED",
      user_id: "system",
      secret_id: secretId,
      error: err?.message?.substring(0, 100),
      latency_ms: 0,
      status: "error",
    });
    return null;
  }
}

/**
 * Creates all FintekPro secrets in GCP Secret Manager with placeholder values.
 * Run once during initial GCP setup.
 *
 * Usage: node -e "require('./gcp-secret-manager').createAllSecrets()"
 */
export async function createAllSecrets(): Promise<void> {
  const client = await getGCPClient();
  if (!client) throw new Error("GCP client unavailable");

  for (const [envVar, secretId] of Object.entries(SECRET_MAP)) {
    try {
      await client.createSecret({
        parent: `projects/${GCP_PROJECT_ID}`,
        secretId,
        secret: {
          replication: { automatic: {} },
          labels: {
            app: "fintekpro",
            env_var: envVar.toLowerCase().replace(/_/g, "-"),
          },
        },
      });
      console.log(`✅ Created secret: ${secretId}`);
    } catch (err: any) {
      if (err?.message?.includes("ALREADY_EXISTS")) {
        console.log(`⏭️  Already exists: ${secretId}`);
      } else {
        console.error(`❌ Failed to create ${secretId}: ${err?.message}`);
      }
    }
  }
}
