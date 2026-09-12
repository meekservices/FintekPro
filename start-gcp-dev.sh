#!/bin/bash
# ============================================================
# FintekPro — GCP-Backed Local Dev Launcher
# Deps: gcloud auth (ADC), cloud-sql-proxy binary in repo root
# Usage: ./start-gcp-dev.sh
# ============================================================

set -e

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'; BOLD='\033[1m'

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
PROXY_BIN="$REPO_ROOT/cloud-sql-proxy"
ENV_FILE="$REPO_ROOT/.env.gcp-local"
SQL_INSTANCE="fintekpro:asia-south1:fintekpro-db"
PROXY_PORT=5433

echo -e "${CYAN}${BOLD}"
echo "  ██████╗ ██████╗ ██████╗     GCP LOCAL DEV"
echo "  ██╔════╝ ██╔══██╗██╔════╝    Cloud SQL + Cloud Run"
echo "  █████╗   ██████╔╝██║         No Docker needed"
echo "  ██╔══╝   ██╔═══╝ ██║  ████╗  "
echo "  ██║      ██║     ╚██████╔╝   "
echo -e "${NC}"

# ── 1. Check gcloud auth ────────────────────────────────────
echo -e "${CYAN}[1/4] Checking GCP auth...${NC}"
if ! gcloud auth application-default print-access-token > /dev/null 2>&1; then
  echo -e "${YELLOW}⚠  No Application Default Credentials. Running login...${NC}"
  gcloud auth application-default login
fi
echo -e "${GREEN}✓ GCP auth OK${NC}"

# ── 2. Kill any stale proxy/server ──────────────────────────
echo -e "${CYAN}[2/4] Cleaning up stale processes...${NC}"
pkill -f "cloud-sql-proxy.*$SQL_INSTANCE" 2>/dev/null && echo -e "${YELLOW}  Killed old proxy${NC}" || true
pkill -f "tsx server/index.ts" 2>/dev/null && echo -e "${YELLOW}  Killed old dev server${NC}" || true

# ── 3. Start Cloud SQL Proxy ─────────────────────────────────
echo -e "${CYAN}[3/4] Starting Cloud SQL Auth Proxy → port $PROXY_PORT...${NC}"
"$PROXY_BIN" "$SQL_INSTANCE" --port="$PROXY_PORT" > /tmp/cloud-sql-proxy.log 2>&1 &
PROXY_PID=$!
echo "  Proxy PID: $PROXY_PID"

# Wait for proxy to be ready
for i in $(seq 1 10); do
  if pg_isready -h localhost -p $PROXY_PORT -U postgres > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Cloud SQL Proxy ready on localhost:$PROXY_PORT${NC}"
    break
  fi
  if [ $i -eq 10 ]; then
    echo -e "${RED}✗ Proxy failed to start. Check /tmp/cloud-sql-proxy.log${NC}"
    kill $PROXY_PID 2>/dev/null
    exit 1
  fi
  sleep 1
done

# ── 4. Start Node.js Dev Server ──────────────────────────────
echo -e "${CYAN}[4/4] Starting FintekPro dev server...${NC}"
echo -e "  DB  : ${GREEN}GCP Cloud SQL (fintekpro-db)${NC} via proxy"
echo -e "  API : ${GREEN}http://localhost:5001${NC}"
echo -e "  Py  : ${GREEN}GCP Cloud Run (fintekpro-python)${NC}"
echo ""

# Load GCP env and start server
set -a
source "$ENV_FILE"
set +a

# Cleanup on exit
cleanup() {
  echo -e "\n${YELLOW}🛑 Shutting down...${NC}"
  kill $PROXY_PID 2>/dev/null
  pkill -f "tsx server/index.ts" 2>/dev/null
  echo -e "${GREEN}✓ Done. Cloud SQL proxy stopped.${NC}"
}
trap cleanup SIGINT SIGTERM EXIT

npm run dev
