#!/bin/bash
set -e
npm install
# NOTE: drizzle.config.ts is intentionally NOT present in the project root.
# The javascript_database:1.0.0 integration has its own bundled drizzle-kit
# that reads drizzle.config.ts from the root and runs a diff check during
# deployment — this fails with "SERVER unexpectedly disconnected" due to
# SSL/connection issues with the local Helium DB.
#
# The production drizzle config lives at drizzle.production.config.ts and is
# only invoked by scripts/start-production.sh during Cloud Run startup.
# For manual schema sync: npx drizzle-kit push --config=drizzle.production.config.ts
echo "Post-merge setup complete (db:push skipped — schema managed via drizzle.production.config.ts)"
