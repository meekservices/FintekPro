#!/bin/bash
# GCP Deployment Helper for FintekPro
# ─────────────────────────────────────────────────────────────────────────────
# IMPORTANT: This script always deploys from the FintekPro SOURCE repository
# root (the directory that contains this scripts/ folder), regardless of where
# you invoke it from. This eliminates the "stale deploy directory" risk where
# FintekPro_Deploy/ was out of sync with FintekPro/.
# ─────────────────────────────────────────────────────────────────────────────
set -e

# Resolve the project root (parent of the scripts/ directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "📂 Deploying from source: $PROJECT_ROOT"
cd "$PROJECT_ROOT"

# Configuration
PROJECT_ID="fintekpro"
REGION="asia-south1"
SERVICE_NAME="fintekpro-app"
REPO_NAME="fintekpro-repo"

echo "🚀 Starting FintekPro GCP Deployment Process"

# ── Quality Gate (must pass before Cloud Build) ────────────────────────────
echo ""
echo "🔒 Running pre-deploy quality gate..."
if ! bash "$SCRIPT_DIR/pre-commit-check.sh"; then
  echo ""
  echo "❌ Deploy BLOCKED — quality gate failed."
  echo "   Fix all errors above, then re-run the deploy script."
  echo "   Emergency bypass: SKIP_PRECOMMIT=1 bash scripts/gcp-deploy.sh"
  exit 1
fi
echo ""

# 1. Ensure gcloud is configured
echo "📝 Checking GCP configuration..."

# 2. Build and Push using Cloud Build (Server-side build, no local Docker needed)
echo "🏗️  Building and pushing image to Artifact Registry..."
IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$SERVICE_NAME:latest"

gcloud builds submit --tag $IMAGE_URL --timeout=30m .

# 3. Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_URL \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 8080 \
    --memory 4Gi \
    --cpu 2 \
    --timeout 300 \
    --cpu-boost \
    --min-instances 0 \
    --max-instances 10 \
    --add-cloudsql-instances=fintekpro:asia-south1:fintekpro-db \
    --set-env-vars="NODE_ENV=production,NODE_OPTIONS=--max-old-space-size=3072,DEBUG_SUBDOMAIN=true,CUSTOM_DOMAIN=fintekpro.com,RUN_STARTUP_MIGRATIONS=true,PRIVATE_OBJECT_DIR=gs://fintekpro-documents/private" \
    --set-secrets="\
PRODUCTION_DATABASE_URL=PRODUCTION_DATABASE_URL:latest,\
DATABASE_URL=DATABASE_URL:latest,\
SESSION_SECRET=SESSION_SECRET:latest,\
FIELD_ENCRYPTION_KEY=FIELD_ENCRYPTION_KEY:latest,\
ENCRYPTION_MASTER_KEY=ENCRYPTION_MASTER_KEY:latest,\
CASHFREE_APP_ID=CASHFREE_APP_ID:latest,\
CASHFREE_SECRET_KEY=CASHFREE_SECRET_KEY:latest,\
CASHFREE_ENVIRONMENT=CASHFREE_ENVIRONMENT:latest,\
OPENAI_API_KEY=OPENAI_API_KEY:latest,\
GEMINI_API_KEY=GEMINI_API_KEY:latest,\
SANDBOX_API_KEY=SANDBOX_API_KEY:latest,\
SANDBOX_API_SECRET=SANDBOX_API_SECRET:latest,\
SANDBOX_BASE_URL=SANDBOX_BASE_URL:latest,\
TRUTHSCREEN_USERNAME=TRUTHSCREEN_USERNAME:latest,\
TRUTHSCREEN_PASSWORD=TRUTHSCREEN_PASSWORD:latest,\
TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest,\
TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest,\
TWILIO_PHONE_NUMBER=TWILIO_PHONE_NUMBER:latest,\
TWILIO_PRIMARY_PHONE=TWILIO_PRIMARY_PHONE:latest,\
TWILIO_MESSAGING_SERVICE_SID=TWILIO_MESSAGING_SERVICE_SID:latest,\
TWILIO_VERIFY_SERVICE_SID=TWILIO_VERIFY_SERVICE_SID:latest,\
PYTHON_SERVICE_URL=PYTHON_SERVICE_URL:latest,\
PYTHON_SERVICE_SECRET=PYTHON_SERVICE_SECRET:latest,\
FINNHUB_API_KEY=FINNHUB_API_KEY:latest,\
ZOHO_CLIENT_ID=ZOHO_CLIENT_ID:latest,\
ZOHO_CLIENT_SECRET=ZOHO_CLIENT_SECRET:latest,\
ZOHO_REFRESH_TOKEN=ZOHO_REFRESH_TOKEN:latest,\
ZOHO_WEBHOOK_SECRET=ZOHO_WEBHOOK_SECRET:latest,\
COMPLIANCE_SECRET=COMPLIANCE_SECRET:latest,\
GROQ_API_KEY=GROQ_API_KEY:latest,\
EMAIL_HOST=EMAIL_HOST:latest,\
EMAIL_USER=EMAIL_USER:latest,\
EMAIL_PASS=EMAIL_PASS:latest,\
EMAIL_PORT=EMAIL_PORT:latest,\
EMAIL_FROM=EMAIL_FROM:latest\
"

echo "✅ Deployment complete!"
gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format='value(status.url)'
