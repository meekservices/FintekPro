#!/bin/bash
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║  FintekPro — GCP Redis (Memorystore) Setup Script                       ║
# ║  Provisions a Redis instance and wires it into Cloud Run via VPC         ║
# ║                                                                          ║
# ║  Run ONCE before deploying to production:                                ║
# ║    bash scripts/setup-redis-gcp.sh                                      ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
PROJECT_ID="fintekpro"
REGION="asia-south1"
REDIS_INSTANCE_NAME="fintekpro-cache"
REDIS_TIER="STANDARD_HA"        # STANDARD_HA = 1 replica (HA). Use BASIC for dev.
REDIS_SIZE_GB=1                 # 1 GB is sufficient for compliance cache + sessions
REDIS_VERSION="REDIS_7_0"
VPC_CONNECTOR_NAME="fintekpro-vpc-connector"
VPC_NETWORK="default"
VPC_SUBNET_RANGE="10.8.0.0/28"  # /28 gives 14 IPs — enough for the connector
SERVICE_NAME="fintekpro-app"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  FintekPro Redis + VPC Setup                        ║"
echo "║  Project: $PROJECT_ID | Region: $REGION       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Ensure required APIs are enabled ─────────────────────────────────
echo "▶ Step 1: Enabling required GCP APIs..."
gcloud services enable redis.googleapis.com \
    vpcaccess.googleapis.com \
    cloudresourcemanager.googleapis.com \
    --project="$PROJECT_ID"
echo "  ✅ APIs enabled"

# ── Step 2: Create Serverless VPC Access Connector ───────────────────────────
# Cloud Run needs a VPC connector to reach Memorystore (private IP only).
echo ""
echo "▶ Step 2: Creating Serverless VPC Access Connector..."

if gcloud compute networks vpc-access connectors describe "$VPC_CONNECTOR_NAME" \
    --region="$REGION" --project="$PROJECT_ID" &>/dev/null; then
    echo "  ℹ️  VPC connector '$VPC_CONNECTOR_NAME' already exists — skipping."
else
    gcloud compute networks vpc-access connectors create "$VPC_CONNECTOR_NAME" \
        --region="$REGION" \
        --network="$VPC_NETWORK" \
        --range="$VPC_SUBNET_RANGE" \
        --min-instances=2 \
        --max-instances=3 \
        --machine-type=e2-micro \
        --project="$PROJECT_ID"
    echo "  ✅ VPC connector created: $VPC_CONNECTOR_NAME"
fi

# ── Step 3: Create Memorystore Redis Instance ─────────────────────────────────
echo ""
echo "▶ Step 3: Creating Memorystore Redis instance..."

if gcloud redis instances describe "$REDIS_INSTANCE_NAME" \
    --region="$REGION" --project="$PROJECT_ID" &>/dev/null; then
    echo "  ℹ️  Redis instance '$REDIS_INSTANCE_NAME' already exists — skipping."
else
    gcloud redis instances create "$REDIS_INSTANCE_NAME" \
        --size="$REDIS_SIZE_GB" \
        --region="$REGION" \
        --tier="$REDIS_TIER" \
        --redis-version="$REDIS_VERSION" \
        --network="$VPC_NETWORK" \
        --project="$PROJECT_ID"
    echo "  ✅ Redis instance created (this may take 3-5 minutes to be READY)"
    echo "  ⏳ Waiting for Redis instance to be READY..."
    while true; do
        STATUS=$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" \
            --region="$REGION" --project="$PROJECT_ID" \
            --format="value(state)" 2>/dev/null || echo "UNKNOWN")
        echo "     Status: $STATUS"
        if [ "$STATUS" = "READY" ]; then break; fi
        sleep 15
    done
    echo "  ✅ Redis instance is READY"
fi

# ── Step 4: Get Redis private IP ──────────────────────────────────────────────
echo ""
echo "▶ Step 4: Fetching Redis private IP..."
REDIS_HOST=$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" \
    --region="$REGION" --project="$PROJECT_ID" \
    --format="value(host)")
REDIS_PORT=$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" \
    --region="$REGION" --project="$PROJECT_ID" \
    --format="value(port)")
REDIS_URL="redis://$REDIS_HOST:$REDIS_PORT"
echo "  Redis Host: $REDIS_HOST"
echo "  Redis Port: $REDIS_PORT"
echo "  Redis URL:  $REDIS_URL"

# ── Step 5: Store Redis URL in GCP Secret Manager ─────────────────────────────
echo ""
echo "▶ Step 5: Storing REDIS_URL in GCP Secret Manager..."

if gcloud secrets describe "REDIS_URL" --project="$PROJECT_ID" &>/dev/null; then
    echo "$REDIS_URL" | gcloud secrets versions add "REDIS_URL" \
        --data-file=- --project="$PROJECT_ID"
    echo "  ✅ REDIS_URL secret updated"
else
    echo "$REDIS_URL" | gcloud secrets create "REDIS_URL" \
        --data-file=- \
        --replication-policy="automatic" \
        --project="$PROJECT_ID"
    echo "  ✅ REDIS_URL secret created"
fi

# ── Step 6: Grant Cloud Run SA access to the secret ──────────────────────────
echo ""
echo "▶ Step 6: Granting Cloud Run service account access to REDIS_URL secret..."

# Get the project number to construct the Cloud Run SA
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
CLOUD_RUN_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding "REDIS_URL" \
    --member="serviceAccount:$CLOUD_RUN_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID"
echo "  ✅ IAM binding added for: $CLOUD_RUN_SA"

# ── Step 7: Update the KMS_KEY_ID secret placeholder ────────────────────────
echo ""
echo "▶ Step 7: Checking KMS_KEY_ID secret..."
if gcloud secrets describe "KMS_KEY_ID" --project="$PROJECT_ID" &>/dev/null; then
    echo "  ℹ️  KMS_KEY_ID secret already exists."
else
    echo "  ⚠️  KMS_KEY_ID secret does not exist."
    echo "  To create a KMS key ring and key:"
    echo "    gcloud kms keyrings create fintekpro-keyring --location=$REGION"
    echo "    gcloud kms keys create kyc-field-key --keyring=fintekpro-keyring --location=$REGION --purpose=encryption"
    echo "  Then create the secret:"
    echo "    gcloud secrets create KMS_KEY_ID --data-file=- <<< \\"
    echo "      \"projects/$PROJECT_ID/locations/$REGION/keyRings/fintekpro-keyring/cryptoKeys/kyc-field-key\""
fi

# ── Step 8: Update min-instances to 1 for VPC warmup ────────────────────────
echo ""
echo "▶ Step 8: Summary"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  ✅ Redis:         $REDIS_URL"
echo "  ✅ VPC Connector: $VPC_CONNECTOR_NAME"
echo "  ✅ Secret:        REDIS_URL stored in Secret Manager"
echo ""
echo "  Next steps:"
echo "  1. Run the deploy script to apply changes:"
echo "     bash scripts/gcp-deploy.sh"
echo ""
echo "  2. The deploy script will automatically:"
echo "     - Bind REDIS_URL secret to Cloud Run"
echo "     - Attach --vpc-connector=$VPC_CONNECTOR_NAME"
echo "     - Set --min-instances=1 (keeps 1 pod warm for Redis connection)"
echo ""
echo "  3. To verify Redis is connected after deploy:"
echo "     gcloud run services logs read $SERVICE_NAME \\"
echo "       --region=$REGION --project=$PROJECT_ID | grep DistributedCache"
echo ""
echo "  Expected log: '[DistributedCache] Redis connected — using distributed cache'"
echo ""
echo "═══════════════════════════════════════════════════════════"
