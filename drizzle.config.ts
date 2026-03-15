import { defineConfig } from "drizzle-kit";

// Build a connection URL with hard timeouts so drizzle-kit always exits
// cleanly rather than hanging and triggering "SERVER unexpectedly disconnected".
//
// connect_timeout=15  → TCP / authentication must complete within 15s
// statement_timeout   → any single SQL statement must complete within 15s
//
// Without these, a busy DB (many active queries) causes the schema-pull to
// spin forever and the Replit diff tool kills the process with the above error.
const baseUrl =
  process.env.DATABASE_URL ||
  process.env.PRODUCTION_DATABASE_URL ||
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
  },
  // Limit introspection to only the tables defined in schema-stub.ts.
  // Without this, drizzle-kit pulls ALL tables from the production DB (hundreds),
  // which takes so long the process is killed → "SERVER unexpectedly disconnected".
  tablesFilter: [
    "agent_notifications",
    "corporate_actions",
    "price_adjustments",
    "symbol_mapping",
    "credit_ratings",
    "instrument_returns",
  ],
});
