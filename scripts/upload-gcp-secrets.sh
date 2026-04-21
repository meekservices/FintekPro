#!/bin/bash
# ============================================================
# FintekPro — GCP Secret Manager Upload Script
# Run this ONCE to populate all required secrets before deploying.
# Usage: bash scripts/upload-gcp-secrets.sh
# ============================================================
set -euo pipefail

PROJECT_ID="fintekpro"

# Helper: create or update a secret
upsert_secret() {
  local NAME="$1"
  local VALUE="$2"

  if [ -z "$VALUE" ] || [ "$VALUE" = "FILL_ME_IN" ]; then
    echo "⚠️  SKIPPING $NAME — value is empty or placeholder. Fill it in first."
    return
  fi

  # Check if secret already exists
  if gcloud secrets describe "$NAME" --project="$PROJECT_ID" &>/dev/null; then
    echo "🔄 Updating existing secret: $NAME"
    echo -n "$VALUE" | gcloud secrets versions add "$NAME" --data-file=- --project="$PROJECT_ID"
  else
    echo "➕ Creating new secret: $NAME"
    echo -n "$VALUE" | gcloud secrets create "$NAME" --data-file=- --replication-policy=automatic --project="$PROJECT_ID"
  fi
}

echo "============================================================"
echo " FintekPro — Uploading secrets to GCP Secret Manager"
echo " Project: $PROJECT_ID"
echo "============================================================"

# ── REQUIRED (server will crash without these) ──────────────────────────────

# Already uploaded — will update to ensure it's pointing at Cloud SQL, NOT Railway
upsert_secret "PRODUCTION_DATABASE_URL" "${PRODUCTION_DATABASE_URL:-FILL_ME_IN}"

# CRITICAL: was missing — this caused the startup crash
upsert_secret "SESSION_SECRET" "${SESSION_SECRET:-FILL_ME_IN}"

# ── SECURITY / ENCRYPTION ───────────────────────────────────────────────────
upsert_secret "FIELD_ENCRYPTION_KEY"    "${FIELD_ENCRYPTION_KEY:-FILL_ME_IN}"
upsert_secret "ENCRYPTION_MASTER_KEY"   "${ENCRYPTION_MASTER_KEY:-FILL_ME_IN}"

# ── PAYMENT GATEWAYS ────────────────────────────────────────────────────────
upsert_secret "CASHFREE_APP_ID"         "${CASHFREE_APP_ID:-FILL_ME_IN}"
upsert_secret "CASHFREE_SECRET_KEY"     "${CASHFREE_SECRET_KEY:-FILL_ME_IN}"
upsert_secret "CASHFREE_ENVIRONMENT"    "${CASHFREE_ENVIRONMENT:-FILL_ME_IN}"

upsert_secret "PHONEPE_MERCHANT_ID"     "${PHONEPE_MERCHANT_ID:-FILL_ME_IN}"
upsert_secret "PHONEPE_SALT_KEY"        "${PHONEPE_SALT_KEY:-FILL_ME_IN}"
upsert_secret "PHONEPE_SALT_INDEX"      "${PHONEPE_SALT_INDEX:-FILL_ME_IN}"

upsert_secret "STRIPE_SECRET_KEY"       "${STRIPE_SECRET_KEY:-FILL_ME_IN}"

# ── AI SERVICES ─────────────────────────────────────────────────────────────
upsert_secret "OPENAI_API_KEY"          "${OPENAI_API_KEY:-FILL_ME_IN}"
upsert_secret "GEMINI_API_KEY"          "${GEMINI_API_KEY:-FILL_ME_IN}"

# ── KYC / VERIFICATION ──────────────────────────────────────────────────────
upsert_secret "SANDBOX_API_KEY"         "${SANDBOX_API_KEY:-FILL_ME_IN}"
upsert_secret "SANDBOX_API_SECRET"      "${SANDBOX_API_SECRET:-FILL_ME_IN}"
upsert_secret "SANDBOX_BASE_URL"        "${SANDBOX_BASE_URL:-FILL_ME_IN}"

upsert_secret "TRUTHSCREEN_USERNAME"    "${TRUTHSCREEN_USERNAME:-FILL_ME_IN}"
upsert_secret "TRUTHSCREEN_PASSWORD"    "${TRUTHSCREEN_PASSWORD:-FILL_ME_IN}"

# ── COMMUNICATION ───────────────────────────────────────────────────────────
upsert_secret "TWILIO_ACCOUNT_SID"      "${TWILIO_ACCOUNT_SID:-FILL_ME_IN}"
upsert_secret "TWILIO_AUTH_TOKEN"       "${TWILIO_AUTH_TOKEN:-FILL_ME_IN}"
upsert_secret "TWILIO_PHONE_NUMBER"     "${TWILIO_PHONE_NUMBER:-FILL_ME_IN}"

upsert_secret "EMAIL_HOST"              "${EMAIL_HOST:-FILL_ME_IN}"
upsert_secret "EMAIL_PORT"              "${EMAIL_PORT:-FILL_ME_IN}"
upsert_secret "EMAIL_USER"              "${EMAIL_USER:-FILL_ME_IN}"
upsert_secret "EMAIL_PASS"              "${EMAIL_PASS:-FILL_ME_IN}"

# ── TRADING GATEWAYS ────────────────────────────────────────────────────────
upsert_secret "KFINTECH_API_KEY"        "${KFINTECH_API_KEY:-FILL_ME_IN}"
upsert_secret "ALPACA_API_KEY"          "${ALPACA_API_KEY:-FILL_ME_IN}"
upsert_secret "ALPACA_SECRET_KEY"       "${ALPACA_SECRET_KEY:-FILL_ME_IN}"

# ── PYTHON ANALYTICS SERVICE ────────────────────────────────────────────────
upsert_secret "PYTHON_SERVICE_URL"      "${PYTHON_SERVICE_URL:-FILL_ME_IN}"
upsert_secret "PYTHON_SERVICE_SECRET"   "${PYTHON_SERVICE_SECRET:-FILL_ME_IN}"

# ── MARKET DATA ─────────────────────────────────────────────────────────────
upsert_secret "FINNHUB_API_KEY"         "${FINNHUB_API_KEY:-FILL_ME_IN}"

echo ""
echo "============================================================"
echo " ✅ Done! Secrets uploaded."
echo " Now update gcp-deploy.sh --update-secrets flag to include"
echo " all the new secrets, then re-run: bash scripts/gcp-deploy.sh"
echo "============================================================"
