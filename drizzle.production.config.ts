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
// IMPORTANT: drizzle-kit must use Neon's DIRECT connection URL, not the pooler.
// Neon pooler URLs contain ".c-N." between the endpoint ID and region:
//   Pooler:  ep-xxx.c-2.us-east-1.aws.neon.tech  ← breaks drizzle-kit
//   Direct:  ep-xxx.us-east-1.aws.neon.tech       ← works
// We strip the pooler segment automatically so no extra secret is needed.

function toDirectUrl(url: string): string {
  // Remove Neon pooler cluster segment (e.g. ".c-2.") to get the direct endpoint.
  return url.replace(/\.c-\d+\./, ".");
}

const rawUrl = process.env.PRODUCTION_DATABASE_URL!;
if (!rawUrl) {
    throw new Error("PRODUCTION_DATABASE_URL must be defined");
}

// Convert pooler URL to direct URL for drizzle-kit
const dbUrl = toDirectUrl(rawUrl);

export default defineConfig({
  out: "./drizzle-migrations",
  schema: "./shared/schema-stub.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
    ssl: { rejectUnauthorized: false }, // Force SSL mode matching PRODUCTION_DATABASE_URL
  },
  schemaFilter: ["drizzle_kit_managed"],
});
