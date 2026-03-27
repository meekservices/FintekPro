import { defineConfig } from "drizzle-kit";

// drizzle-kit config for the Replit Helium dev database (DATABASE_URL).
//
// This config manages the FULL application schema on the dev database.
// It is safe to use the full schema here because DATABASE_URL always points
// to the Replit-managed Helium PostgreSQL (a local, isolated dev database),
// never to the production Neon instance.
//
// SSL is explicitly disabled: Helium runs locally on Replit infrastructure
// and does NOT support SSL connections. Without ssl:false, the pg driver
// attempts an SSL handshake which causes "the socket disconnecting
// unexpectedly" — the root cause of the "SERVER unexpectedly disconnected"
// error in the Replit DB diff panel during publish.
//
// Enrichment data (AMFI NAV, stock prices, bond catalogs, etc.) lives only
// on PRODUCTION_DATABASE_URL (Neon). The dev Helium database starts empty
// and gets schema from:
//   npx drizzle-kit push --config=drizzle.local.config.ts
//
// NEVER use PRODUCTION_DATABASE_URL here.
//
// NOTE: This file is intentionally named drizzle.local.config.ts (not
// drizzle.config.ts) to prevent Replit's deployment platform from
// auto-detecting it and running migrations during deployment.

const baseUrl =
  process.env.DATABASE_URL ||
  "postgresql://localhost:5432/placeholder";

function appendParam(url: string, key: string, value: string): string {
  return url.includes("?") ? `${url}&${key}=${value}` : `${url}?${key}=${value}`;
}

let dbUrl = baseUrl;
if (!dbUrl.includes("connect_timeout=")) {
  dbUrl = appendParam(dbUrl, "connect_timeout", "15");
}
if (!dbUrl.includes("statement_timeout") && !dbUrl.includes("options=")) {
  dbUrl = appendParam(dbUrl, "options", "-c statement_timeout=30000");
}

export default defineConfig({
  out: "./drizzle-migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
    ssl: false,
  },
});
