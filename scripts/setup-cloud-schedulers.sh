#!/usr/bin/env bash
# =============================================================================
# scripts/setup-cloud-schedulers.sh
#
# Configures and synchronizes GCP Cloud Scheduler HTTP triggers for all
# FintekPro Cloud Run Jobs.
#
# Schedulers configured:
#   1. fintekpro-picks-trigger      - 08:45 AM IST (03:15 UTC) Mon-Fri
#   2. fintekpro-enrichment-trigger - 06:00 PM IST (12:30 UTC) Mon-Fri
#   3. fintekpro-nav-sync-trigger   - 11:30 PM IST (18:00 UTC) Daily
#   4. fintekpro-compliance-trigger - 12:30 AM IST (19:00 UTC) Daily
#
# Requirements:
#   - gcloud CLI authenticated with project fintekpro
#   - Service Account: fintekpro-jobs@fintekpro.iam.gserviceaccount.com
# =============================================================================

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-fintekpro}"
REGION="${GCP_REGION:-asia-south1}"
SERVICE_ACCOUNT="${GCP_JOBS_SA:-124901641600-compute@developer.gserviceaccount.com}"

echo "================================================================="
echo " Configuring FintekPro Cloud Schedulers (Project: ${PROJECT_ID})"
echo " Region: ${REGION} | Service Account: ${SERVICE_ACCOUNT}"
echo "================================================================="

# Helper function to create or update scheduler job
upsert_scheduler_job() {
  local job_name="$1"
  local schedule="$2"
  local target_job="$3"
  local description="$4"
  local uri="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/${target_job}:run"

  echo ""
  echo "⏳ Processing scheduler: ${job_name}..."
  echo "   Schedule: '${schedule}'"
  echo "   Target:   ${target_job}"

  if gcloud scheduler jobs describe "${job_name}" --project="${PROJECT_ID}" --location="${REGION}" >/dev/null 2>&1; then
    echo "   Updating existing scheduler job..."
    gcloud scheduler jobs update http "${job_name}" \
      --project="${PROJECT_ID}" \
      --location="${REGION}" \
      --schedule="${schedule}" \
      --time-zone="Asia/Kolkata" \
      --uri="${uri}" \
      --http-method="POST" \
      --oauth-service-account-email="${SERVICE_ACCOUNT}" \
      --description="${description}" \
      --quiet
    echo "   ✅ Updated ${job_name}"
  else
    echo "   Creating new scheduler job..."
    gcloud scheduler jobs create http "${job_name}" \
      --project="${PROJECT_ID}" \
      --location="${REGION}" \
      --schedule="${schedule}" \
      --time-zone="Asia/Kolkata" \
      --uri="${uri}" \
      --http-method="POST" \
      --oauth-service-account-email="${SERVICE_ACCOUNT}" \
      --description="${description}" \
      --quiet
    echo "   ✅ Created ${job_name}"
  fi
}

# 1. Daily Picks Generator (Mon-Fri 08:45 AM IST)
upsert_scheduler_job \
  "fintekpro-picks-trigger" \
  "45 8 * * 1-5" \
  "fintekpro-picks" \
  "Triggers daily multi-asset candidate evaluation and pick generation prior to Indian market open"

# 2. Daily Market Data & Financial Enrichment (Daily 09:00 PM IST)
upsert_scheduler_job \
  "fintekpro-enrichment-trigger" \
  "0 21 * * *" \
  "fintekpro-enrichment" \
  "Enriches stock fundamentals, EOD market prices, and calculates financial ratios post market close"

# 3. AMFI Mutual Fund NAV Sync (Mon-Fri 10:00 AM IST)
upsert_scheduler_job \
  "fintekpro-nav-sync-trigger" \
  "0 10 * * 1-5" \
  "fintekpro-nav-sync" \
  "Ingests latest official AMFI mutual fund daily NAVs and refreshes fund return metrics"

# 4. Daily Regulatory Compliance & Audit Integrity (Daily 12:30 AM IST)
upsert_scheduler_job \
  "fintekpro-compliance-trigger" \
  "30 0 * * *" \
  "fintekpro-compliance" \
  "Runs nightly SEBI regulatory checks, audit log integrity validation, and compliance reconciliation"

# 5. Autonomous Model Portfolio Rebalancing & Risk/Reward Engine (Mon-Fri 07:00 PM IST)
upsert_scheduler_job \
  "fintekpro-rebalance-trigger" \
  "0 19 * * 1-5" \
  "fintekpro-rebalance" \
  "Executes autonomous model portfolio drift rebalancing, momentum swaps, and real-money risk/reward queue generation post market close"

echo ""
echo "================================================================="
echo "✅ All 5 Cloud Scheduler triggers configured successfully!"
echo "================================================================="

