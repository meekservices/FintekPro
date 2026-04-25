#!/bin/bash
# GCP Deployment Helper for FintekPro Python ML Service
# Mirrors the main app deploy pattern with Cloud SQL + Secret Manager.
set -e

# Configuration — must match the main app's GCP project
PROJECT_ID="fintekpro"
REGION="asia-south1"
SERVICE_NAME="fintekpro-python"
REPO_NAME="fintekpro-repo"
PYTHON_SRC_DIR="services/python"

echo "🚀 Starting FintekPro Python Service Deployment"

# 1. Build and push using Cloud Build (from the services/python directory)
echo "🏗️  Building Python Docker image via Cloud Build..."
IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$SERVICE_NAME:latest"

gcloud builds submit --tag "$IMAGE_URL" "$PYTHON_SRC_DIR"

# 2. Deploy to Cloud Run with Cloud SQL + secrets
echo "🚀 Deploying Python service to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_URL" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --port 8001 \
    --memory 2Gi \
    --cpu 1 \
    --timeout 300 \
    --min-instances 0 \
    --max-instances 2 \
    --add-cloudsql-instances=fintekpro:asia-south1:fintekpro-db \
    --remove-env-vars=PRODUCTION_DATABASE_URL,PYTHON_SERVICE_SECRET \
    --set-secrets="\
PRODUCTION_DATABASE_URL=PRODUCTION_DATABASE_URL:latest,\
PYTHON_SERVICE_SECRET=PYTHON_SERVICE_SECRET:latest\
"

echo "✅ Python service deployment complete!"
gcloud run services describe "$SERVICE_NAME" --platform managed --region "$REGION" --format='value(status.url)'
