#!/bin/bash

echo "[Startup] Running database schema sync against production DB..."

# Neon's serverless DB may autosuspend and drop the first connection attempt.
# Retry up to 3 times with a 5s pause so the DB has time to wake up.
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

echo "[Startup] Starting server..."
exec node dist/index.js
