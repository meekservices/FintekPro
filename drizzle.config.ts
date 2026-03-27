import { defineConfig } from "drizzle-kit";

// This is the default drizzle config detected by Replit's publish diff-check.
//
// Environment routing:
//   PRODUCTION_DATABASE_URL is set → Neon (production), requires SSL
//   PRODUCTION_DATABASE_URL is absent → DATABASE_URL (Helium dev), ssl: false
//
// Helium (Replit local PostgreSQL) does NOT support SSL.  Without ssl:false the
// pg driver attempts an SSL handshake which causes "SERVER unexpectedly
// disconnected" in the Replit DB diff panel during publish.
//
// schemaFilter restricts drizzle-kit to the isolated "drizzle_kit_managed"
// schema (6 tables in schema-stub.ts).  It NEVER introspects the 755 tables
// in "public" so no destructive DROP TABLE / DROP SEQUENCE statements are ever
// generated against the production Neon database.
//
// For full schema pushes to Helium dev:  npx drizzle-kit push --config=drizzle.local.config.ts
// For startup sync to Neon production:   npx drizzle-kit push --config=drizzle.production.config.ts

function toDirectUrl(url: string): string {
  // Remove Neon pooler cluster segment (e.g. ".c-2.") to get the direct endpoint.
  // Pooler:  ep-xxx.c-2.us-east-1.aws.neon.tech  ← breaks drizzle-kit
  // Direct:  ep-xxx.us-east-1.aws.neon.tech       ← works
  return url.replace(/\.c-\d+\./, ".");
}

const isProd = !!process.env.PRODUCTION_DATABASE_URL;

const rawUrl = isProd
  ? process.env.PRODUCTION_DATABASE_URL!
  : (process.env.DATABASE_URL || "postgresql://localhost:5432/placeholder");

const dbUrl = isProd ? toDirectUrl(rawUrl) : rawUrl;

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
