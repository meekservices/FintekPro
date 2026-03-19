#!/bin/bash
set -e

echo "[Startup] Running database schema sync against production DB..."
npx drizzle-kit push --config=drizzle.config.ts
echo "[Startup] Schema sync complete. Starting server..."

exec node dist/index.js
