import { defineConfig } from "drizzle-kit";

// Environment detection:
//   Cloud Run (deployment) → PRODUCTION_DATABASE_URL is set by Replit
//   Replit workspace (dev) → only DATABASE_URL is set (Helium local DB)
//
// SSL rules:
//   Production (Neon/Cloud SQL) requires SSL → ssl: { rejectUnauthorized: false }
//   Helium (local) does NOT support SSL → ssl: false
//   Mixing these up causes "SERVER unexpectedly disconnected" or Cloud Run migration failures.
//
// schemaFilter restricts drizzle-kit to the isolated "drizzle_kit_managed" schema
// (6 tables in schema-stub.ts). It never introspects the 755 tables in "public"
// so no destructive DROP TABLE / DROP SEQUENCE statements are ever generated.

const isProd = !!process.env.PRODUCTION_DATABASE_URL;

const baseUrl = isProd
  ? process.env.PRODUCTION_DATABASE_URL!
  : (process.env.DATABASE_URL || "postgresql://localhost:5432/placeholder");

function appendParam(url: string, key: string, value: string): string {
  return url.includes("?") ? `${url}&${key}=${value}` : `${url}?${key}=${value}`;
}

let dbUrl = baseUrl;
if (!dbUrl.includes("connect_timeout=")) {
  dbUrl = appendParam(dbUrl, "connect_timeout", "15");
}
if (!dbUrl.includes("statement_timeout") && !dbUrl.includes("options=")) {
  dbUrl = appendParam(dbUrl, "options", "-c statement_timeout=15000");
}

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
