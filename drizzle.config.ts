import { defineConfig } from "drizzle-kit";

// Environment detection:
//   Cloud Run (deployment) → PRODUCTION_DATABASE_URL is set by Replit
//   Replit workspace (dev) → only DATABASE_URL is set (Helium local DB)
//
// SSL rules:
//   Production (Neon) requires SSL → ssl: { rejectUnauthorized: false }
//   Helium (local) does NOT support SSL → ssl: false
//
// schemaFilter restricts drizzle-kit to the isolated "drizzle_kit_managed" schema
// (6 tables in schema-stub.ts). It never introspects the 755 tables in "public"
// so no destructive DROP TABLE / DROP SEQUENCE statements are ever generated.
//
// NOTE: Do NOT append extra URL params (options, statement_timeout) to the
// production URL — Neon's pooler drops the connection ("SERVER unexpectedly
// disconnected") when it receives unrecognised libpq options via the URL.

const isProd = !!process.env.PRODUCTION_DATABASE_URL;

const dbUrl = isProd
  ? process.env.PRODUCTION_DATABASE_URL!
  : (process.env.DATABASE_URL || "postgresql://localhost:5432/placeholder");

export default defineConfig({
  out: "./drizzle-migrations",
  schema: "./shared/schema-stub.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
    ssl: isProd ? { rejectUnauthorized: false } : false,
  },
  schemaFilter: ["drizzle_kit_managed"],
});
