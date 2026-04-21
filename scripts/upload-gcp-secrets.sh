#!/bin/bash
# ============================================================
# FintekPro — Bulk GCP Secret Manager Upload (V2)
# This script reads your local .env and pushes everything to GCP.
# ============================================================
set -euo pipefail

PROJECT_ID="fintekpro"

# 1. Load local .env file
if [ -f .env ]; then
    echo "📂 Found .env file, loading local secrets..."
    # Robustly load .env (handling quotes and spaces better)
    # Note: We use a simple grep to avoid breaking on complex values
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ $key =~ ^[[:space:]]*# ]] && continue
        [[ -z $key ]] && continue
        
        # Remove leading/trailing quotes from value
        value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
        
        # Expert the variable
        export "$key=$value"
    done < .env
else
    echo "❌ No .env file found at root!"
    exit 1
fi

# Helper: create or update a secret
upsert_secret() {
  local NAME="$1"
  local VALUE="${2:-}"

  if [ -z "$VALUE" ] || [[ "$VALUE" == *"{{"* ]] || [ "$VALUE" = "FILL_ME_IN" ]; then
    echo "⏭️  SKIPPING $NAME — value is empty or remains a placeholder."
    return
  fi

  # Check if secret already exists
  if gcloud secrets describe "$NAME" --project="$PROJECT_ID" &>/dev/null; then
    echo "🔄 Updating: $NAME"
    echo -n "$VALUE" | gcloud secrets versions add "$NAME" --data-file=- --project="$PROJECT_ID" > /dev/null
  else
    echo "➕ Creating: $NAME"
    echo -n "$VALUE" | gcloud secrets create "$NAME" --data-file=- --replication-policy=automatic --project="$PROJECT_ID" > /dev/null
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " 🚀 Uploading Bulk Secrets to GCP: $PROJECT_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# List of all secrets we want to sync
SECRETS=(
    "PRODUCTION_DATABASE_URL"
    "SESSION_SECRET"
    "ENCRYPTION_MASTER_KEY"
    "CASHFREE_APP_ID"
    "CASHFREE_SECRET_KEY"
    "CASHFREE_ENVIRONMENT"
    "OPENAI_API_KEY"
    "GEMINI_API_KEY"
    "SANDBOX_API_KEY"
    "SANDBOX_API_SECRET"
    "SANDBOX_BASE_URL"
    "TRUTHSCREEN_USERNAME"
    "TRUTHSCREEN_PASSWORD"
    "TWILIO_ACCOUNT_SID"
    "TWILIO_AUTH_TOKEN"
    "TWILIO_PHONE_NUMBER"
    "PYTHON_SERVICE_URL"
    "PYTHON_SERVICE_SECRET"
    "FINNHUB_API_KEY"
    "ZOHO_CLIENT_ID"
    "ZOHO_CLIENT_SECRET"
    "ZOHO_REFRESH_TOKEN"
    "ZOHO_WEBHOOK_SECRET"
)

# SPECIAL MAPPING: FIELD_ENCRYPTION_KEY usually comes from ENCRYPTION_MASTER_KEY in your .env
# Disabled per user request
# if [ -z "${FIELD_ENCRYPTION_KEY:-}" ] && [ -n "${ENCRYPTION_MASTER_KEY:-}" ]; then
#     echo "🔗 Mapping ENCRYPTION_MASTER_KEY to FIELD_ENCRYPTION_KEY..."
#     FIELD_ENCRYPTION_KEY="$ENCRYPTION_MASTER_KEY"
# fi

for SECRET in "${SECRETS[@]}"; do
    VALUE="${!SECRET:-}"
    upsert_secret "$SECRET" "$VALUE"
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " ✅ Done! All secrets from .env are now in GCP."
echo " You can now run: bash scripts/gcp-deploy.sh"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
