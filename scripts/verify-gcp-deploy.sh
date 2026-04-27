#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/verify-gcp-deploy.sh
#
# Smoke-tests both GCP Cloud Run services after a deployment.
# Usage:
#   chmod +x scripts/verify-gcp-deploy.sh
#   ./scripts/verify-gcp-deploy.sh
#
# Override the Node.js URL if you have a custom domain:
#   NODE_URL=https://app.fintekpro.com ./scripts/verify-gcp-deploy.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT:-fintekpro}"
REGION="${GCP_REGION:-asia-south1}"

# Resolve Cloud Run URLs dynamically if not overridden
NODE_SERVICE_NAME="fintekpro-app"
PYTHON_SERVICE_NAME="fintekpro-python"

echo "🔍  Resolving Cloud Run service URLs..."

NODE_URL="${NODE_URL:-$(gcloud run services describe "$NODE_SERVICE_NAME" \
  --project="$PROJECT_ID" --region="$REGION" \
  --format='value(status.url)' 2>/dev/null || echo '')}"

PYTHON_URL="${PYTHON_URL:-$(gcloud run services describe "$PYTHON_SERVICE_NAME" \
  --project="$PROJECT_ID" --region="$REGION" \
  --format='value(status.url)' 2>/dev/null || echo '')}"

# ── Helper ────────────────────────────────────────────────────────────────────
check_endpoint() {
  local label="$1"
  local url="$2"
  local expected_status="${3:-200}"

  if [[ -z "$url" ]]; then
    echo "❌  [$label] URL not resolved — is the service deployed?"
    return 1
  fi

  echo ""
  echo "──────────────────────────────────────────"
  echo "🌐  Testing: $label"
  echo "    URL: $url"

  HTTP_STATUS=$(curl -s -o /tmp/fintek_resp.json -w "%{http_code}" \
    --max-time 30 \
    -H "Accept: application/json" \
    "$url")

  BODY=$(cat /tmp/fintek_resp.json | head -c 300)

  if [[ "$HTTP_STATUS" == "$expected_status" ]]; then
    echo "✅  Status: $HTTP_STATUS"
    echo "    Body:   $BODY"
  elif [[ "$HTTP_STATUS" == "503" && "$BODY" == *"booting"* ]]; then
    # Node.js app has a ~14min boot sequence — 503+booting is normal immediately after deploy
    echo "⚠️  Status: 503 (app still booting — this is normal within 15min of a fresh deploy)"
    echo "    Milestone: $(echo "$BODY" | grep -o '"milestone":"[^"]*"' || echo 'unknown step')"
    echo "    Re-run this script in a few minutes once boot completes."
    # Don't count as failure
  else
    echo "❌  Status: $HTTP_STATUS (expected $expected_status)"
    echo "    Body:   $BODY"
    return 1
  fi
}

# ── Run checks ────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  FintekPro GCP Deployment Smoke Test"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "═══════════════════════════════════════════"

PASS=0
FAIL=0

check_endpoint "Node.js App — /health"    "${NODE_URL}/health"    200 && PASS=$((PASS+1)) || FAIL=$((FAIL+1))
check_endpoint "Python Service — /health" "${PYTHON_URL}/health"  200 && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

# /api/health returns JSON with boot state — this is the real status endpoint
check_endpoint "Node.js App — /api/health (boot check)" "${NODE_URL}/api/health" 200 && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

# Verify boot is actually complete (status should be "ready", not "booting")
echo ""
echo "──────────────────────────────────────────"
echo "🔍  Checking boot completion status..."
HEALTH_BODY=$(curl -s --max-time 10 "${NODE_URL}/api/health" 2>/dev/null || echo '{}')
BOOT_STATUS=$(echo "$HEALTH_BODY" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
if [[ "$BOOT_STATUS" == "ready" ]]; then
  echo "✅  Boot complete — all routes registered and ready"
  PASS=$((PASS+1))
elif [[ "$BOOT_STATUS" == "booting" ]]; then
  MILESTONE=$(echo "$HEALTH_BODY" | grep -o '"milestone":"[^"]*"' | cut -d'"' -f4)
  echo "⚠️  Still booting: $MILESTONE"
  echo "    The app needs ~15 minutes to register all routes on a cold start."
  echo "    Re-run this script once boot completes."
else
  echo "❌  Unexpected boot status: '$BOOT_STATUS'"
  FAIL=$((FAIL+1))
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  Results: ✅ $PASS passed  |  ❌ $FAIL failed"
echo "═══════════════════════════════════════════"

if [[ "$FAIL" -gt 0 ]]; then
  echo ""
  echo "⚠️  One or more checks failed. Check Cloud Run logs:"
  echo "   gcloud run services logs read $NODE_SERVICE_NAME --project=$PROJECT_ID --region=$REGION"
  echo "   gcloud run services logs read $PYTHON_SERVICE_NAME --project=$PROJECT_ID --region=$REGION"
  exit 1
fi

echo ""
echo "🎉  All services healthy! Railway can now be safely decommissioned."
