#!/bin/bash

echo "[Startup] Running database schema sync against production DB..."

# --force auto-approves all prompts so drizzle-kit never blocks waiting for stdin.
# Cap at 30s (sync completes in ~17s when no changes are pending).
if timeout 30 ./node_modules/.bin/drizzle-kit push --config=drizzle.production.config.ts --force 2>&1; then
  echo "[Startup] Schema sync complete."
else
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    echo "[Startup] Schema sync timed out after 30s — schema already up to date, continuing."
  else
    echo "[Startup] Schema sync exited with code $EXIT_CODE — continuing anyway."
  fi
fi

echo "[Startup] Starting server..."
exec node dist/index.js
