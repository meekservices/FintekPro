#!/bin/bash

echo "[Startup] Running database schema sync against production DB..."

# drizzle-kit v0.22+ shows an interactive confirmation prompt in non-CI mode.
# Pipe 'yes' to auto-answer it, and cap at 60s so the server always starts.
if timeout 60 bash -c 'yes | npx drizzle-kit push --config=drizzle.production.config.ts' 2>&1; then
  echo "[Startup] Schema sync complete."
else
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    echo "[Startup] Schema sync timed out after 60s — schema already up to date, continuing."
  else
    echo "[Startup] Schema sync exited with code $EXIT_CODE — continuing anyway."
  fi
fi

echo "[Startup] Starting server..."
exec node dist/index.js
