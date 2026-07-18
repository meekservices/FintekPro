#!/bin/bash
# GCP Deployment Helper for FintekPro
# ─────────────────────────────────────────────────────────────────────────────
# IMPORTANT: This script always deploys from the FintekPro SOURCE repository
# root (the directory that contains this scripts/ folder), regardless of where
# you invoke it from. This eliminates the "stale deploy directory" risk where
# FintekPro_Deploy/ was out of sync with FintekPro/.
# ─────────────────────────────────────────────────────────────────────────────
set -e

# Force Python 3.12 for gcloud — Python 3.13 (brew default on macOS) has a
# known gzip.close() crash when compressing large archives (OSError: unexpected
# end of data). gcloud SDK 566+ requires Python ≥3.10; 3.12 is the sweet spot.
# Install once with: brew install python@3.12
if [ -x "/opt/homebrew/bin/python3.12" ]; then
  export CLOUDSDK_PYTHON="/opt/homebrew/bin/python3.12"
elif [ -x "/usr/local/bin/python3.12" ]; then
  export CLOUDSDK_PYTHON="/usr/local/bin/python3.12"
fi

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

# ── Build strategy: platform-aware ──────────────────────────────────────────
# macOS ARM (Apple Silicon): gcloud builds submit crashes with
#   OSError: unexpected end of data (Python tarfile bug on live filesystems)
# Fix: use cloudbuild-github.yaml — clones from GitHub on the remote build
#   server so no local files are read. Requires the commit to be pushed first.
# Linux/CI: standard builds submit works fine.
_ARCH="$(uname -m)"
_OS="$(uname -s)"
_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_REPO_ROOT="$(cd "${_SCRIPT_DIR}/.." && pwd)"
_CB_GITHUB="${_REPO_ROOT}/cloudbuild-github.yaml"

if [[ "$_OS" == "Darwin" && "$_ARCH" == "arm64" ]]; then
  echo "🍎 macOS ARM detected — using GitHub-clone Cloud Build (avoids tarfile OSError)"
  if [[ ! -f "$_CB_GITHUB" ]]; then
    echo "❌ cloudbuild-github.yaml not found at ${_CB_GITHUB}" && exit 1
  fi
  gcloud builds submit \
    --config="${_CB_GITHUB}" \
    --project="${PROJECT_ID}" \
    --no-source \
    --timeout=30m
else
  # Linux / CI: standard local-source build
  gcloud builds submit --tag "${IMAGE_URL}" --timeout=30m .
fi


# 3. Deploy to Cloud Run
# ─── Prerequisite: create REDIS_URL secret once ────────────────────────────
# gcloud secrets create REDIS_URL --data-file=- <<< "redis://PRIVATE_IP:6379"
# The private IP is the Memorystore instance IP from:
#   gcloud redis instances describe fintekpro-cache --region=asia-south1
# ─────────────────────────────────────────────────────────────────────────────
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
    --min-instances 1 \
    --max-instances 10 \
    --add-cloudsql-instances=fintekpro:asia-south1:fintekpro-db \
    --vpc-connector=fintekpro-vpc-connector \
    --vpc-egress=all \
    --set-env-vars="NODE_ENV=production,NODE_OPTIONS=--max-old-space-size=3072,DEBUG_SUBDOMAIN=true,CUSTOM_DOMAIN=fintekpro.com,RUN_STARTUP_MIGRATIONS=true,PRIVATE_OBJECT_DIR=gs://fintekpro-documents/private" \
    --set-secrets="\
PRODUCTION_DATABASE_URL=PRODUCTION_DATABASE_URL:latest,\
DATABASE_URL=DATABASE_URL:latest,\
SESSION_SECRET=SESSION_SECRET:latest,\
FIELD_ENCRYPTION_KEY=FIELD_ENCRYPTION_KEY:latest,\
ENCRYPTION_MASTER_KEY=ENCRYPTION_MASTER_KEY:latest,\
REDIS_URL=REDIS_URL:latest,\
KMS_KEY_ID=KMS_KEY_ID:latest,\
CASHFREE_APP_ID=CASHFREE_APP_ID:latest,\
CASHFREE_SECRET_KEY=CASHFREE_SECRET_KEY:latest,\
CASHFREE_ENVIRONMENT=CASHFREE_ENVIRONMENT:latest,\
CASHFREE_PG_APP_ID=CASHFREE_PG_APP_ID:latest,\
CASHFREE_PG_SECRET_KEY=CASHFREE_PG_SECRET_KEY:latest,\
CASHFREE_PAYOUTS_APP_ID=CASHFREE_PAYOUTS_APP_ID:latest,\
CASHFREE_PAYOUTS_SECRET_KEY=CASHFREE_PAYOUTS_SECRET_KEY:latest,\
PHONEPE_MERCHANT_ID=PHONEPE_MERCHANT_ID:latest,\
PHONEPE_SALT_KEY=PHONEPE_SALT_KEY:latest,\
PHONEPE_SALT_INDEX=PHONEPE_SALT_INDEX:latest,\
OPENAI_API_KEY=OPENAI_API_KEY:latest,\
GEMINI_API_KEY=GEMINI_API_KEY:latest,\
GROQ_API_KEY=GROQ_API_KEY:latest,\
SANDBOX_API_KEY=SANDBOX_API_KEY:latest,\
SANDBOX_API_SECRET=SANDBOX_API_SECRET:latest,\
SANDBOX_BASE_URL=SANDBOX_BASE_URL:latest,\
TRUTHSCREEN_USERNAME=TRUTHSCREEN_USERNAME:latest,\
TRUTHSCREEN_PASSWORD=TRUTHSCREEN_PASSWORD:latest,\
AUTHBRIDGE_API_KEY=AUTHBRIDGE_API_KEY:latest,\
AUTHBRIDGE_CLIENT_ID=AUTHBRIDGE_CLIENT_ID:latest,\
AUTHBRIDGE_CLIENT_SECRET=AUTHBRIDGE_CLIENT_SECRET:latest,\
TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest,\
TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest,\
TWILIO_PHONE_NUMBER=TWILIO_PHONE_NUMBER:latest,\
TWILIO_PRIMARY_PHONE=TWILIO_PRIMARY_PHONE:latest,\
TWILIO_MESSAGING_SERVICE_SID=TWILIO_MESSAGING_SERVICE_SID:latest,\
TWILIO_VERIFY_SERVICE_SID=TWILIO_VERIFY_SERVICE_SID:latest,\
TWILIO_WHATSAPP_NUMBER=TWILIO_WHATSAPP_NUMBER:latest,\
PYTHON_SERVICE_URL=PYTHON_SERVICE_URL:latest,\
PYTHON_SERVICE_SECRET=PYTHON_SERVICE_SECRET:latest,\
FINNHUB_API_KEY=FINNHUB_API_KEY:latest,\
ALPHA_VANTAGE_API_KEY=ALPHA_VANTAGE_API_KEY:latest,\
POLYGON_API_KEY=POLYGON_API_KEY:latest,\
FMP_API_KEY=FMP_API_KEY:latest,\
ZOHO_CLIENT_ID=ZOHO_CLIENT_ID:latest,\
ZOHO_CLIENT_SECRET=ZOHO_CLIENT_SECRET:latest,\
ZOHO_REFRESH_TOKEN=ZOHO_REFRESH_TOKEN:latest,\
ZOHO_WEBHOOK_SECRET=ZOHO_WEBHOOK_SECRET:latest,\
COMPLIANCE_SECRET=COMPLIANCE_SECRET:latest,\
CLOUDFLARE_ACCOUNT_ID=CLOUDFLARE_ACCOUNT_ID:latest,\
CLOUDFLARE_API_KEY=CLOUDFLARE_API_KEY:latest,\
EMAIL_HOST=EMAIL_HOST:latest,\
EMAIL_USER=EMAIL_USER:latest,\
EMAIL_PASS=EMAIL_PASS:latest,\
EMAIL_PORT=EMAIL_PORT:latest,\
EMAIL_FROM=EMAIL_FROM:latest,\
CEREBRAS_API_KEY=CEREBRAS_API_KEY:latest,\
INDIAN_API_KEY=INDIAN_API_KEY:latest,\
DEFAULT_OBJECT_STORAGE_BUCKET_ID=DEFAULT_OBJECT_STORAGE_BUCKET_ID:latest,\
IRIS_USERNAME=IRIS_USERNAME:latest,\
IRIS_PASSWORD=IRIS_PASSWORD:latest\
"


echo ""
echo "🔀 Migrating traffic to latest revision..."
gcloud run services update-traffic $SERVICE_NAME \
    --to-latest \
    --project=$PROJECT_ID \
    --region=$REGION

echo "✅ Deployment complete!"
gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format='value(status.url)'

# ── Update ALL Cloud Run Jobs (image + Cloud SQL + secrets) ───────────────────
# All 3 cron jobs need --add-cloudsql-instances so the /cloudsql socket exists.
# Without it, the DB connection silently fails and jobs exit(0) in <500ms.

echo ""
echo "🔧 Updating fintekpro-schema-repairs job..."
gcloud run jobs update fintekpro-schema-repairs \
    --image=asia-south1-docker.pkg.dev/${PROJECT_ID}/fintekpro-repo/fintekpro-app:latest \
    --project=$PROJECT_ID \
    --region=$REGION \
    --add-cloudsql-instances=fintekpro:asia-south1:fintekpro-db \
    --command="node" \
    --args="dist/startup/schema-repairs-runner.js" \
    --set-secrets="PRODUCTION_DATABASE_URL=PRODUCTION_DATABASE_URL:latest,DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest" \
    2>&1 | tail -3

echo ""
echo "🔧 Updating fintekpro-compliance job..."
gcloud run jobs update fintekpro-compliance \
    --image=asia-south1-docker.pkg.dev/${PROJECT_ID}/fintekpro-repo/fintekpro-app:latest \
    --project=$PROJECT_ID \
    --region=$REGION \
    --add-cloudsql-instances=fintekpro:asia-south1:fintekpro-db \
    --vpc-connector=fintekpro-vpc-connector \
    --vpc-egress=all \
    --command="node" \
    --args="dist/jobs/compliance.js" \
    --set-secrets="PRODUCTION_DATABASE_URL=PRODUCTION_DATABASE_URL:latest,DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,EMAIL_HOST=EMAIL_HOST:latest,EMAIL_USER=EMAIL_USER:latest,EMAIL_PASS=EMAIL_PASS:latest,EMAIL_PORT=EMAIL_PORT:latest,EMAIL_FROM=EMAIL_FROM:latest,TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest,TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest,TWILIO_PHONE_NUMBER=TWILIO_PHONE_NUMBER:latest,COMPLIANCE_SECRET=COMPLIANCE_SECRET:latest" \
    2>&1 | tail -3

echo ""
echo "🔧 Updating fintekpro-enrichment job..."
gcloud run jobs update fintekpro-enrichment \
    --image=asia-south1-docker.pkg.dev/${PROJECT_ID}/fintekpro-repo/fintekpro-app:latest \
    --project=$PROJECT_ID \
    --region=$REGION \
    --add-cloudsql-instances=fintekpro:asia-south1:fintekpro-db \
    --vpc-connector=fintekpro-vpc-connector \
    --vpc-egress=all \
    --command="node" \
    --args="dist/jobs/enrichment.js" \
    --set-secrets="PRODUCTION_DATABASE_URL=PRODUCTION_DATABASE_URL:latest,DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,FMP_API_KEY=FMP_API_KEY:latest,INDIAN_API_KEY=INDIAN_API_KEY:latest,FINNHUB_API_KEY=FINNHUB_API_KEY:latest,ALPHA_VANTAGE_API_KEY=ALPHA_VANTAGE_API_KEY:latest,EMAIL_HOST=EMAIL_HOST:latest,EMAIL_USER=EMAIL_USER:latest,EMAIL_PASS=EMAIL_PASS:latest,EMAIL_PORT=EMAIL_PORT:latest,EMAIL_FROM=EMAIL_FROM:latest,IRIS_USERNAME=IRIS_USERNAME:latest,IRIS_PASSWORD=IRIS_PASSWORD:latest,IRIS_TENANT_CODE=IRIS_TENANT_CODE:latest" \
    2>&1 | tail -3


echo ""
echo "🔧 Updating fintekpro-nav-sync job..."
gcloud run jobs update fintekpro-nav-sync \
    --image=asia-south1-docker.pkg.dev/${PROJECT_ID}/fintekpro-repo/fintekpro-app:latest \
    --project=$PROJECT_ID \
    --region=$REGION \
    --add-cloudsql-instances=fintekpro:asia-south1:fintekpro-db \
    --vpc-connector=fintekpro-vpc-connector \
    --vpc-egress=all \
    --command="node" \
    --args="dist/jobs/nav-sync.js" \
    --set-secrets="PRODUCTION_DATABASE_URL=PRODUCTION_DATABASE_URL:latest,DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,EMAIL_HOST=EMAIL_HOST:latest,EMAIL_USER=EMAIL_USER:latest,EMAIL_PASS=EMAIL_PASS:latest,EMAIL_PORT=EMAIL_PORT:latest,EMAIL_FROM=EMAIL_FROM:latest" \
    2>&1 | tail -3

echo "✅ All 4 Cloud Run Jobs updated — next executions will have DB access + latest code."

# ── Firebase Hosting Deploy (serves the static frontend at agent.fintekpro.com) ──
echo ""
echo "🔥 Building frontend locally for Firebase Hosting..."
echo "   (Firebase Hosting serves agent.fintekpro.com — must deploy from freshly built dist/)"
NODE_OPTIONS=--max-old-space-size=8192 npm run build 2>&1 | tail -5
if [ $? -ne 0 ]; then
  echo "❌ Local vite build failed — Firebase deploy aborted"
  exit 1
fi
AGENT_HASH=$(ls dist/public/assets/chunk-agent-*.js 2>/dev/null | head -1 | xargs basename 2>/dev/null || echo "unknown")
echo "   Built bundle: ${AGENT_HASH}"

echo ""
echo "🔥 Deploying frontend to Firebase Hosting..."
echo "   (Firebase Hosting is the CDN that serves agent.fintekpro.com — must stay in sync with Cloud Run)"
npx -y firebase-tools@latest deploy --only hosting --project fintekpro --non-interactive 2>&1 | tail -8

echo ""
echo "✅ Firebase Hosting deploy complete — frontend is now in sync with backend!"

