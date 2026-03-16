import { defineConfig } from "drizzle-kit";

// drizzle-kit targets DATABASE_URL (Replit-managed heliumdb) and is ONLY
// allowed to manage the "drizzle_kit_managed" schema — a completely isolated
// schema that contains just the 6 tables in schema-stub.ts.
//
// By limiting introspection to this private schema, drizzle-kit never sees the
// 755 tables / 85 sequences in the "public" schema, so it never generates DROP
// SEQUENCE or DROP TABLE statements.
//
// SSL is explicitly disabled: Helium runs locally on Replit infrastructure and
// does NOT support SSL connections (unlike the legacy Neon database which
// required SSL). Without ssl:false, the pg driver may attempt an SSL handshake
// which causes "the socket disconnecting unexpectedly" — the root cause of the
// "SERVER unexpectedly disconnected" error in the Replit DB diff panel.
//
// NEVER use PRODUCTION_DATABASE_URL here. The production database stores live
// user data and has a different schema layout.

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
  out: "./migrations",
  schema: "./shared/schema-stub.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
    ssl: false,
  },
  // Restrict drizzle-kit to the isolated "drizzle_kit_managed" schema only.
  // This schema is completely separate from "public" and contains only the
  // 6 tables managed by schema-stub.ts — no foreign sequences or extra tables.
  schemaFilter: ["drizzle_kit_managed"],
});
