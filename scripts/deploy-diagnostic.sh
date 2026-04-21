#!/bin/bash
# FintekPro Diagnostic Deployment Wrapper
# This script fixes PATH issues and ensures gcloud is reachable before deploying.

set -e

echo "🔎 [Diagnostic] Locating Google Cloud SDK..."

# Common paths for GCP SDK on macOS
GCP_PATHS=(
    "$HOME/google-cloud-sdk/bin"
    "/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin"
    "/usr/local/bin"
    "/opt/homebrew/bin"
)

for p in "${GCP_PATHS[@]}"; do
    if [ -f "$p/gcloud" ]; then
        echo "✅ Found gcloud at $p"
        export PATH="$p:$PATH"
        break
    fi
done

# Verify gcloud works
if ! command -v gcloud &> /dev/null; then
    echo "❌ FATAL: gcloud command still not found. Please install Google Cloud SDK or ensure it is in your PATH."
    exit 1
fi

echo "🔐 [Diagnostic] Checking GCP Authentication..."
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo "⚠️  No active GCP account found. Please run: gcloud auth login"
    exit 1
else
    echo "✅ Authenticated as: $ACTIVE_ACCOUNT"
fi

echo "📁 [Diagnostic] Current Directory: $(pwd)"
echo "📦 [Diagnostic] Synchronizing Secrets..."
bash scripts/upload-gcp-secrets.sh

echo "🚀 [Diagnostic] Launching Deployment Service..."
bash scripts/gcp-deploy.sh

echo "----------------------------------------------------"
echo "✅ Deployment update triggered successfully!"
echo "📡 Monitor progress at: https://fintekpro-app-7f3fb64pqq-el.a.run.app/api/health"
echo "----------------------------------------------------"
