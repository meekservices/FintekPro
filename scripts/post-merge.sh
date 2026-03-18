#!/bin/bash
set -e
npm install
# NOTE: drizzle.config.ts was intentionally removed from the project root to
# prevent Replit's deployment platform from auto-running migrations.
# Database schema is managed manually via:
#   npx drizzle-kit push --config=drizzle.local.config.ts
# Do NOT add db:push here — it will fail without drizzle.config.ts.
echo "Post-merge setup complete (db:push skipped — managed via drizzle.local.config.ts)"
