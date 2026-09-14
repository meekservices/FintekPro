#!/usr/bin/env bash
# scripts/start-db-proxy.sh
# Starts the Cloud SQL Auth Proxy for local development.
# Must be running before: npm run dev
#
# Usage:  ./scripts/start-db-proxy.sh
# Stop:   pkill -f cloud-sql-proxy

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PROXY_BIN="$REPO_ROOT/cloud-sql-proxy"
INSTANCE="fintekpro:asia-south1:fintekpro-db"
PORT=5432
LOG_FILE="/tmp/cloud-sql-proxy.log"

if ! command -v gcloud &>/dev/null; then
  echo "❌ gcloud CLI not found. Run: brew install --cask google-cloud-sdk"
  exit 1
fi

if [ ! -x "$PROXY_BIN" ]; then
  echo "❌ Cloud SQL Auth Proxy not found at $PROXY_BIN"
  exit 1
fi

# Kill any existing proxy
if pgrep -f "cloud-sql-proxy" &>/dev/null; then
  echo "⚠️  Killing existing proxy..."
  pkill -f "cloud-sql-proxy" || true
  sleep 1
fi

# Free port if occupied
if lsof -i :$PORT &>/dev/null; then
  echo "⚠️  Port $PORT in use — clearing..."
  lsof -i :$PORT | awk 'NR>1 {print $2}' | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo "🚀 Starting Cloud SQL Auth Proxy..."
nohup "$PROXY_BIN" "$INSTANCE" --port="$PORT" > "$LOG_FILE" 2>&1 &
PROXY_PID=$!

sleep 2

if ! ps -p $PROXY_PID &>/dev/null; then
  echo "❌ Proxy failed to start. Check $LOG_FILE"
  cat "$LOG_FILE"
  exit 1
fi

echo "✅ Cloud SQL Auth Proxy running (PID $PROXY_PID)"
echo "   Connect: postgresql://finpro_user:***@localhost:$PORT/finpro_db"
echo ""
echo "   Now run: npm run dev"
echo "   To stop: pkill -f cloud-sql-proxy"
