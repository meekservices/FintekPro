#!/bin/bash
# Helper script to start the Cloud SQL Auth Proxy for local development.
# Requires the 'cloud-sql-proxy' binary to be in the root directory.

INSTANCE_CONNECTION_NAME="fintekpro:asia-south1:fintekpro-db"
PORT=5432

echo "🚀 Starting Cloud SQL Auth Proxy for $INSTANCE_CONNECTION_NAME on port $PORT..."
chmod +x ./cloud-sql-proxy
./cloud-sql-proxy $INSTANCE_CONNECTION_NAME --port $PORT
