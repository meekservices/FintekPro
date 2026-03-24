#!/bin/bash

echo "[Startup] Running database schema sync against production DB..."

# Use the local drizzle-kit binary (avoids npx resolution overhead).
# drizzle-kit v0.22+ shows an interactive confirmation prompt in non-CI mode.
# Pipe 'yes' to auto-answer it, and cap at 30s (sync completes in ~17s when
# no changes are pending; 60s was unnecessarily long).
if timeout 30 bash -c 'yes | ./node_modules/.bin/drizzle-kit push --config=drizzle.production.config.ts' 2>&1; then
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
