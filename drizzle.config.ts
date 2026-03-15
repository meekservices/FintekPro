import { defineConfig } from "drizzle-kit";

// DATABASE_URL (Replit-managed heliumdb, local) is the correct target for
// drizzle-kit. The tables in schema-stub.ts have already been pushed to this
// DB, so the diff is empty → fast, safe, no destructive statements.
//
// NEVER use PRODUCTION_DATABASE_URL here — the production Neon DB has 755
// tables and different column types (e.g. agent_notifications.id is serial
// there vs uuid in schema-stub.ts), which would cause drizzle-kit to generate
// destructive ALTER TABLE / DROP SEQUENCE statements against live data.
//
// The postgresql-16 Replit module (which ran drizzle-kit studio against the
// 755-table Neon DB → OOM → "SERVER unexpectedly disconnected") has been
// intentionally removed from .replit modules. DATABASE_URL is still set by
// the javascript_database integration and is safe to use here.
const baseUrl =
  process.env.DATABASE_URL ||
  "postgresql://localhost:5432/placeholder";

// Hard timeouts so drizzle-kit always exits cleanly even when the DB is busy.
//   connect_timeout=15  → TCP / auth must succeed within 15 s
//   statement_timeout   → any single SQL statement must complete within 15 s
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
  },
  // Limit introspection to only the 6 tables managed by drizzle-kit.
  // Without this, all tables in heliumdb are introspected and drizzle-kit
  // generates DROP statements for tables outside the schema-stub.
  tablesFilter: [
    "agent_notifications",
    "corporate_actions",
    "price_adjustments",
    "symbol_mapping",
    "credit_ratings",
    "instrument_returns",
  ],
});
