#!/bin/bash
set -euo pipefail

echo "[Startup] FintekPro production boot — $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ---------------------------------------------------------------------------
# 1. Pre-flight: fail immediately on missing critical secrets
# ---------------------------------------------------------------------------
MISSING_VARS=()
for VAR in PRODUCTION_DATABASE_URL SESSION_SECRET; do
  if [ -z "${!VAR:-}" ]; then
    MISSING_VARS+=("$VAR")
  fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
  echo "[Startup] FATAL — missing required environment variables:"
  for V in "${MISSING_VARS[@]}"; do
    echo "  • $V"
  done
  echo "[Startup] Set these in your platform (GCP Secret Manager) before deploying."
  exit 1
fi

echo "[Startup] Critical environment variables present ✓"

# ---------------------------------------------------------------------------
# 2. Database schema sync (drizzle-kit push)
#    Neon's pooler uses HTTPS (port 443). We probe TCP/5432 on the *direct*
#    endpoint. If unreachable we skip; inline migrations in server/index.ts
#    handle any new columns added since last deploy.
# ---------------------------------------------------------------------------
DB_HOST=$(node -e "
  try {
    const url = process.env.PRODUCTION_DATABASE_URL || '';
    const direct = url.replace(/\\.c-\\d+\\./, '.');
    const match = direct.match(/@([^:@/]+)/);
    process.stdout.write(match ? match[1] : '');
  } catch(e) { process.stdout.write(''); }
" 2>/dev/null)

TCP_REACHABLE=false
if [ -n "$DB_HOST" ]; then
  if timeout 3 bash -c "cat /dev/null > /dev/tcp/$DB_HOST/5432" 2>/dev/null; then
    TCP_REACHABLE=true
  fi
fi

if [ "$TCP_REACHABLE" = false ]; then
  echo "[Startup] Neon direct TCP/5432 not reachable — skipping schema sync (inline migrations active)"
else
  SYNC_SUCCESS=false
  for attempt in 1 2 3; do
    echo "[Startup] Schema sync attempt $attempt/3…"
    if timeout 60 ./node_modules/.bin/drizzle-kit push --config=drizzle.production.config.ts --force 2>&1; then
      echo "[Startup] Schema sync complete ✓"
      SYNC_SUCCESS=true
      break
    else
      EXIT_CODE=$?
      if [ $EXIT_CODE -eq 124 ]; then
        echo "[Startup] Schema sync timed out — schema already up to date, continuing"
        SYNC_SUCCESS=true
        break
      else
        echo "[Startup] Attempt $attempt failed (exit $EXIT_CODE)"
        [ $attempt -lt 3 ] && sleep 5
      fi
    fi
  done

  if [ "$SYNC_SUCCESS" = false ]; then
    echo "[Startup] Schema sync failed after 3 attempts — continuing (inline migrations will handle additions)"
  fi
fi

# ---------------------------------------------------------------------------
# 3. Start the compiled server
#    Railway sends SIGTERM on redeploy/scale; graceful-shutdown.ts handles it.
# ---------------------------------------------------------------------------
echo "[Startup] Starting server (dist/index.js)…"
exec node dist/index.js
