import { defineConfig } from "drizzle-kit";

// In the Replit deployment diff-check environment, DATABASE_URL points to
// Helium which is local-only (not reachable from the build container).
// PRODUCTION_DATABASE_URL (Neon) IS reachable from anywhere, so we prefer
// it when available. In the local workspace, only DATABASE_URL is used
// (Helium, no SSL — Helium does not support SSL per Replit upgrade docs).

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
