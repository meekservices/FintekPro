#!/bin/bash
# GCP Deployment Helper for FintekPro
set -e

# Configuration - Change these to match your GCP project
PROJECT_ID="fintekpro"  # Updated to match your current GCP project
REGION="asia-south1"    # e.g., us-central1, asia-south1
SERVICE_NAME="fintekpro-app"
REPO_NAME="fintekpro-repo"

echo "🚀 Starting FintekPro GCP Deployment Process"

# 1. Ensure gcloud is configured
echo "📝 Checking GCP configuration..."
# gcloud config set project $PROJECT_ID

# 2. Create Artifact Registry if it doesn't exist
# echo "📦 Ensuring Artifact Registry exists..."
# gcloud artifacts repositories create $REPO_NAME \
#     --repository-format=docker \
#     --location=$REGION \
#     --description="FintekPro Docker Repository" || true

# 3. Build and Push using Cloud Build (Server-side build, no local Docker needed)
echo "🏗️  Building and pushing image to Artifact Registry..."
IMAGE_URL="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$SERVICE_NAME:latest"

gcloud builds submit --tag $IMAGE_URL .

# 4. Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_URL \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --port 5000 \
    --memory 2Gi \
    --cpu 2 \
    --timeout 300 \
    --cpu-boost \
    --min-instances 0 \
    --max-instances 3 \
    --add-cloudsql-instances=fintekpro:asia-south1:fintekpro-db \
    --set-env-vars="NODE_ENV=production,NODE_OPTIONS=--max-old-space-size=1536" \
    --update-secrets="PRODUCTION_DATABASE_URL=PRODUCTION_DATABASE_URL:latest,SESSION_SECRET=SESSION_SECRET:latest"

echo "✅ Deployment complete!"
gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format='value(status.url)'
