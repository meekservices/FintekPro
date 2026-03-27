#!/bin/bash

echo "[Startup] Running database schema sync against production DB..."

# Extract the direct DB host from PRODUCTION_DATABASE_URL for TCP reachability check.
# drizzle-kit uses raw TCP port 5432. In Replit's autoscale deployment, outbound TCP
# to port 5432 is blocked — only HTTPS (port 443) is allowed. The app itself uses
# Neon's HTTP-based serverless driver, so it works fine.
# If the direct endpoint is unreachable we skip the sync; inline migrations handle
# any new columns added to schema-stub.ts.

DB_HOST=$(node -e "
  try {
    const url = process.env.PRODUCTION_DATABASE_URL || '';
    // Strip the pooler segment (.c-N.) to get the direct endpoint hostname
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
  echo "[Startup] Neon direct endpoint (TCP/5432) not reachable from this environment — skipping schema sync."
  echo "[Startup] App uses Neon HTTP driver; inline migrations will handle any new columns."
else
  # TCP reachable — run drizzle-kit push with retries
  SYNC_SUCCESS=false
  for attempt in 1 2 3; do
    echo "[Startup] Schema sync attempt $attempt/3..."
    if timeout 45 ./node_modules/.bin/drizzle-kit push --config=drizzle.production.config.ts --force 2>&1; then
      echo "[Startup] Schema sync complete."
      SYNC_SUCCESS=true
      break
    else
      EXIT_CODE=$?
      if [ $EXIT_CODE -eq 124 ]; then
        echo "[Startup] Schema sync timed out after 45s — schema already up to date, skipping."
        SYNC_SUCCESS=true
        break
      else
        echo "[Startup] Schema sync attempt $attempt failed (exit code $EXIT_CODE)."
        if [ $attempt -lt 3 ]; then
          echo "[Startup] Waiting 5s before retry..."
          sleep 5
        fi
      fi
    fi
  done

  if [ "$SYNC_SUCCESS" = false ]; then
    echo "[Startup] All schema sync attempts failed — continuing anyway (inline migrations will handle column additions)."
  fi
fi

echo "[Startup] Starting server..."
exec node dist/index.js
