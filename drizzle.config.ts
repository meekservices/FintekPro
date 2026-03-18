import { defineConfig } from "drizzle-kit";

// This file is read by Replit's deployment pipeline for the database diff check.
//
// It targets DATABASE_URL (Replit-managed heliumdb) with ssl:false.
// ssl:false is REQUIRED: Helium runs locally on Replit infrastructure and does
// NOT support SSL. Without it the pg driver attempts an SSL handshake which
// causes "the socket disconnecting unexpectedly" — the root cause of the
// "SERVER unexpectedly disconnected" error in the Replit DB diff panel.
//
// schemaFilter restricts drizzle-kit to the isolated "drizzle_kit_managed"
// schema which contains only the 6 tables in schema-stub.ts.
// This ensures drizzle-kit never sees the 755 tables in "public" and never
// generates destructive DROP statements.
//
// NEVER use PRODUCTION_DATABASE_URL here.

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
  dbUrl = appendParam(dbUrl, "options", "-c statement_timeout=15000");
}

export default defineConfig({
  out: "./drizzle-migrations",
  schema: "./shared/schema-stub.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
    ssl: false,
  },
  schemaFilter: ["drizzle_kit_managed"],
});
